// Tabla de pagos (pendientes / por categoría) · TablaCompacta con edición inline,
// ✓ marcar pagado, menú de fila y desglose de actividades de marketing.
import React from 'react';
import { ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN, formatFecha } from '../../../lib/utils';
import { TablaCompacta, Pill, Boton, EASE, DUR } from '../../../components/kit';
import { CATEGORIA_META, ESTATUS_OPT, TIPOS_ACTIVIDAD_MKT, FUENTE_META, CategoriaPill, EstatusPill, MenuFila, CheckPagado, MONO, useInputStyle } from './pagosUI';

// Celda editable inline (click → input/select · Enter guarda · Esc cancela).
export function useRenderCell({ edit, canEdit, dbOk }) {
  const { theme } = useTheme();
  const inputStyle = useInputStyle();
  const { editingCell, editValue, setEditValue, saveEdit, cancelEdit, startEdit } = edit;
  const editable = dbOk && canEdit;
  const onKey = (e) => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') cancelEdit(); };
  const inp = { ...inputStyle, height: 26, fontSize: 11.5, borderColor: theme.accent, minWidth: 90 };

  return (row, field, type = 'text') => {
    const isEditing = editingCell?.id === row.id && editingCell?.field === field;
    if (isEditing) {
      if (type === 'sel-estatus') {
        return (
          <select autoFocus value={editValue} style={inp} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={onKey}>
            {ESTATUS_OPT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      if (type === 'sel-cat') {
        return (
          <select autoFocus value={editValue} style={inp} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={onKey}>
            {Object.entries(CATEGORIA_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        );
      }
      return <input autoFocus type={type} value={editValue} style={inp} onChange={(e) => setEditValue(e.target.value)} onBlur={saveEdit} onKeyDown={onKey} />;
    }
    const handleClick = (e) => { e.stopPropagation(); if (!editable) return; startEdit(row.id, field, field === 'monto' ? (row.monto ?? '') : (row[field] ?? '')); };
    const wrap = (child, extra = {}) => (
      <span onClick={handleClick} title={editable ? 'Click para editar' : undefined}
        style={{ display: 'inline-block', cursor: editable ? 'text' : 'default', borderRadius: 5, padding: '1px 3px', margin: '-1px -3px', transition: `background ${DUR.state}ms ${EASE}`, maxWidth: '100%', ...extra }}
        onMouseEnter={(e) => { if (editable) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
        {child}
      </span>
    );
    if (field === 'estatus') return wrap(<EstatusPill estatus={row.estatus} />);
    if (field === 'categoria') return wrap(<CategoriaPill categoria={row.categoria} />);
    if (field === 'monto') {
      return wrap((row.monto || 0) > 0
        ? <span style={{ ...MONO, fontWeight: 600 }}>{formatMXN(row.monto)}</span>
        : <span style={{ color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', fontSize: 10.5 }}>Por definir</span>);
    }
    if (field === 'fecha_compromiso' || field === 'fecha_pago_real') {
      return wrap(row[field] ? <span style={MONO}>{formatFecha(row[field])}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>);
    }
    return wrap(row[field]
      ? <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block', maxWidth: '100%', verticalAlign: 'bottom' }} title={String(row[field])}>{row[field]}</span>
      : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>);
  };
}

export default function TablaPendientes({
  filas, canEdit, dbOk, edit, catActiva,
  togglePagado, verHistorial, handleDuplicate, handleDelete,
  expandedPagoId, togglePagoExpand, actividadesPorPago, excluirActividadDePago,
}) {
  const { theme } = useTheme();
  const renderCell = useRenderCell({ edit, canEdit, dbOk });

  const columnas = [
    { key: 'concepto', label: 'Concepto', align: 'left', maxWidth: 260, render: (r) => {
      const esMkt = r.categoria === 'marketing';
      const abierto = expandedPagoId === r.id;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%' }}>
          {esMkt && (
            <button onClick={(e) => { e.stopPropagation(); togglePagoExpand(r.id); }} title={abierto ? 'Ocultar actividades' : 'Ver actividades'}
              style={{ width: 18, height: 18, border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0 }}>
              <ChevronRight size={13} style={{ transform: abierto ? 'rotate(90deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />
            </button>
          )}
          <span style={{ fontWeight: 500, minWidth: 0 }}>{renderCell(r, 'concepto')}</span>
        </span>
      );
    } },
    { key: 'categoria', label: 'Categoría', align: 'left', render: (r) => {
      const esMkt = r.categoria === 'marketing';
      const tipo = esMkt && r.tipo_actividad ? (TIPOS_ACTIVIDAD_MKT.find((t) => t.value === r.tipo_actividad)?.label || r.tipo_actividad) : null;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          {renderCell(r, 'categoria', 'sel-cat')}
          {tipo && <Pill tone="gray" size="xs">{tipo}</Pill>}
        </span>
      );
    } },
    { key: 'monto', label: 'Monto', align: 'right', render: (r) => renderCell(r, 'monto', 'number') },
    { key: 'fecha_compromiso', label: 'Compromiso', align: 'left', mono: true, render: (r) => renderCell(r, 'fecha_compromiso', 'date') },
    { key: 'fuente', label: 'Fuente', align: 'left', render: (r) => {
      const f = FUENTE_META[r.fuente];
      return f ? <Pill tone={f.tone} size="xs">{f.label}</Pill> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
    } },
    { key: 'estatus', label: 'Estatus', align: 'left', render: (r) => renderCell(r, 'estatus', 'sel-estatus') },
    { key: 'responsable', label: 'Responsable', align: 'left', maxWidth: 130, render: (r) => renderCell(r, 'responsable') },
    { key: 'folio', label: 'Folio', align: 'left', mono: true, maxWidth: 110, render: (r) => renderCell(r, 'folio') },
    { key: 'notas', label: 'Notas', align: 'left', maxWidth: 200, render: (r) => renderCell(r, 'notas') },
    ...(canEdit ? [{ key: '_ok', label: '✓', align: 'center', width: 36, render: (r) => (
      <CheckPagado pagado={r.estatus === 'pagado'} onClick={() => togglePagado(r)}
        title={r.estatus === 'pagado' ? `Pagado el ${r.fecha_pago_real || '—'}. Click para desmarcar.` : 'Marcar como pagado con la fecha de hoy'} />
    ) }] : []),
    ...(dbOk ? [{ key: '_menu', label: '', align: 'center', width: 32, render: (r) => (
      <MenuFila items={[
        canEdit && { label: 'Editar concepto', onClick: () => edit.startEdit(r.id, 'concepto', r.concepto ?? '') },
        canEdit && { label: r.estatus === 'pagado' ? 'Desmarcar pagado' : 'Marcar pagado hoy', onClick: () => togglePagado(r) },
        canEdit && { label: 'Duplicar al siguiente mes', onClick: () => handleDuplicate(r) },
        { label: 'Bitácora de cambios', onClick: () => verHistorial(r) },
        { label: 'Eliminar', peligro: true, onClick: () => handleDelete(r.id) },
      ]} />
    ) }] : []),
  ];

  const renderExpandido = (row) => {
    const acts = actividadesPorPago[row.id] || [];
    const total = acts.reduce((a, x) => a + (Number(x.inversion) || 0), 0);
    return (
      <div style={{ padding: '8px 12px 10px 34px', background: theme.bg, fontFamily: TYPO.fontText }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, marginBottom: 6 }}>
          Actividades incluidas en este pago ({acts.length})
          {acts.length === 0 && <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>— sin actividades</span>}
        </div>
        {acts.length > 0 && (
          <TablaCompacta dense columnas={[
            { key: 'nombre', label: 'Actividad', align: 'left', render: (a) => a.nombre || '—' },
            { key: 'tipo', label: 'Tipo', align: 'left', render: (a) => a.tipo || '—' },
            { key: 'fecha', label: 'Fecha', align: 'left', mono: true, render: (a) => a.fecha || '—' },
            { key: 'responsable', label: 'Responsable', align: 'left', render: (a) => a.responsable || '—' },
            { key: 'inversion', label: 'Inversión', align: 'right', sum: true, fmt: formatMXN, render: (a) => formatMXN(a.inversion || 0) },
            ...(canEdit ? [{ key: '_x', label: '', align: 'center', width: 70, render: (a) => (
              <Boton size="sm" peligro onClick={() => excluirActividadDePago(row.id, a.id)} title="Excluir esta actividad del pago (volverá a Marketing)" style={{ height: 22, fontSize: 10.5 }}>Excluir</Boton>
            ) }] : []),
          ]} filas={acts} totales={{ inversion: total }} />
        )}
        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontStyle: 'italic' }}>
          Excluir una actividad la deja como pendiente en Marketing y resta su inversión del pago. Si excluyes la última, el pago se elimina.
        </div>
      </div>
    );
  };

  return (
    <TablaCompacta
      columnas={columnas}
      filas={filas}
      rowKey={(r) => r.id}
      renderExpandido={renderExpandido}
      expandidoKey={expandedPagoId}
      vacio={`No hay registros${catActiva !== 'todas' ? ' en esta categoría' : ' pendientes'}.`}
    />
  );
}
