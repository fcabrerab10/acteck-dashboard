// Pagos fijos · un Panel plegable por concepto con meses activos, faltantes (+ Crear),
// y carpetas de pagados / futuros / no aplica. Incluye el formulario "Nuevo pago fijo".
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { Panel, Boton, Pill, TablaCompacta } from '../../../components/kit';
import { esMesFuturo, mesKeyDeFijo, Campo, Input, Select, CheckPagado, FilaToggle, MONO } from './pagosUI';
import { useRenderCell } from './TablaPendientes';

const MESES_ARR = [
  { key: '01', short: 'Ene', full: 'Enero' }, { key: '02', short: 'Feb', full: 'Febrero' }, { key: '03', short: 'Mar', full: 'Marzo' },
  { key: '04', short: 'Abr', full: 'Abril' }, { key: '05', short: 'May', full: 'Mayo' }, { key: '06', short: 'Jun', full: 'Junio' },
  { key: '07', short: 'Jul', full: 'Julio' }, { key: '08', short: 'Ago', full: 'Agosto' }, { key: '09', short: 'Sep', full: 'Septiembre' },
  { key: '10', short: 'Oct', full: 'Octubre' }, { key: '11', short: 'Nov', full: 'Noviembre' }, { key: '12', short: 'Dic', full: 'Diciembre' },
];
export { MESES_ARR };

export function FormNuevoFijo({ newFijo, setNewFijo, fijoGroups, onSave, onCancel }) {
  const { theme } = useTheme();
  const invalido = !newFijo.existente || (newFijo.existente === '__nuevo__' && !newFijo.concepto.trim()) || newFijo.meses.length === 0;
  const existingGroup = newFijo.existente && newFijo.existente !== '__nuevo__' ? fijoGroups[newFijo.existente] : null;
  return (
    <Panel titulo="Nuevo pago fijo" meta="Crea un registro por cada mes seleccionado" acciones={
      <>
        <Boton onClick={onCancel}>Cancelar</Boton>
        <Boton primario disabled={invalido} onClick={onSave}>Crear {newFijo.meses.length > 0 ? `${newFijo.meses.length} mes(es)` : 'pago fijo'}</Boton>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        <Campo label="¿A qué concepto?">
          <Select value={newFijo.existente} onChange={(e) => { const v = e.target.value; setNewFijo((p) => ({ ...p, existente: v, concepto: v === '__nuevo__' ? '' : v })); }}>
            <option value="">— Selecciona —</option>
            <option value="__nuevo__">+ Crear nuevo concepto</option>
            {Object.keys(fijoGroups).map((k) => <option key={k} value={k}>{k}</option>)}
          </Select>
        </Campo>
        {newFijo.existente === '__nuevo__' && (
          <>
            <Campo label="Concepto *"><Input type="text" value={newFijo.concepto} onChange={(e) => setNewFijo((p) => ({ ...p, concepto: e.target.value }))} placeholder="Ej: Renta oficina" /></Campo>
            <Campo label="Monto mensual (MXN)"><Input type="number" value={newFijo.monto} onChange={(e) => setNewFijo((p) => ({ ...p, monto: e.target.value }))} placeholder="0" style={MONO} /></Campo>
            <Campo label="Responsable"><Input type="text" value={newFijo.responsable} onChange={(e) => setNewFijo((p) => ({ ...p, responsable: e.target.value }))} placeholder="Responsable" /></Campo>
          </>
        )}
      </div>
      {newFijo.existente && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>Selecciona los meses</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            <Pill tone={newFijo.meses.length === 12 ? 'inverse' : 'gray'} onClick={() => setNewFijo((p) => ({ ...p, meses: p.meses.length === 12 ? [] : MESES_ARR.map((m) => m.key) }))}>Todos</Pill>
            {MESES_ARR.map((m) => {
              const sel = newFijo.meses.includes(m.key);
              const ya = existingGroup ? existingGroup.some((r) => mesKeyDeFijo(r) === m.key) : false;
              return (
                <Pill key={m.key} tone={ya ? 'green' : sel ? 'inverse' : 'gray'} title={ya ? 'Ya existe' : undefined}
                  onClick={ya ? undefined : () => setNewFijo((p) => ({ ...p, meses: sel ? p.meses.filter((x) => x !== m.key) : [...p.meses, m.key] }))}
                  style={{ opacity: ya ? 0.6 : 1, cursor: ya ? 'not-allowed' : 'pointer' }}>
                  {m.short}{ya ? ' ✓' : ''}
                </Pill>
              );
            })}
          </div>
        </div>
      )}
    </Panel>
  );
}

function GrupoFijo({ conceptoKey, records, canEdit, dbOk, edit, expandedFijos, toggleFijo, togglePagado, crearMesFijo, handleDeleteFijo }) {
  const { theme } = useTheme();
  const renderCell = useRenderCell({ edit, canEdit, dbOk });
  const totalAnual = records.reduce((s, r) => s + (r.monto || 0), 0);
  const pagadosN = records.filter((r) => r.estatus === 'pagado').length;
  const porPagar = records.filter((r) => r.estatus === 'pendiente' && !esMesFuturo(r.fecha_compromiso)).length;
  const futurosN = records.filter((r) => r.estatus === 'pendiente' && esMesFuturo(r.fecha_compromiso)).length;
  const vencidosN = records.filter((r) => r.estatus === 'vencido').length;
  const inactivosN = records.filter((r) => r.estatus === 'no_aplica' || r.estatus === 'cancelado').length;
  const montoMes = records[0] ? (records[0].monto || 0) : 0;
  const sorted = [...records].sort((a, b) => (mesKeyDeFijo(a) || '99').localeCompare(mesKeyDeFijo(b) || '99'));
  const filasActivas = sorted.filter((r) => (r.estatus === 'pendiente' && !esMesFuturo(r.fecha_compromiso)) || r.estatus === 'en_proceso' || r.estatus === 'vencido');
  const filasPagados = sorted.filter((r) => r.estatus === 'pagado');
  const filasFuturos = sorted.filter((r) => r.estatus === 'pendiente' && esMesFuturo(r.fecha_compromiso));
  const filasInactivos = sorted.filter((r) => r.estatus === 'no_aplica' || r.estatus === 'cancelado');
  const keyP = `${conceptoKey}::pagados`, keyF = `${conceptoKey}::futuros`, keyI = `${conceptoKey}::inactivos`;
  const mesKeysExistentes = new Set(sorted.map(mesKeyDeFijo).filter(Boolean));
  const faltantes = canEdit ? MESES_ARR.filter((m) => !mesKeysExistentes.has(m.key)) : [];
  const nombreMes = (r) => { const mk = mesKeyDeFijo(r) || '??'; const mi = MESES_ARR.find((m) => m.key === mk); return mi ? mi.full : mk; };

  const cols = (modo) => [
    { key: '_mes', label: 'Mes', align: 'left', render: (r) => r._faltante
      ? <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>{r._mes.full}</span>
      : <span style={{ fontWeight: 500, textDecoration: modo === 'inactivos' ? 'line-through' : 'none', color: modo === 'activos' ? theme.text : theme.textMuted }}>{nombreMes(r)}</span> },
    { key: 'monto', label: 'Monto', align: 'right', render: (r) => r._faltante ? <span style={{ color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', ...MONO }}>{formatMXN(montoMes)}</span> : renderCell(r, 'monto', 'number') },
    { key: 'estatus', label: 'Estatus', align: 'left', render: (r) => r._faltante
      ? <span style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>sin registrar</span>
      : modo === 'futuros' ? <Pill tone="blue" dot>Programado</Pill> : renderCell(r, 'estatus', 'sel-estatus') },
    { key: 'fecha_compromiso', label: 'Compromiso', align: 'left', mono: true, render: (r) => r._faltante ? '—' : renderCell(r, 'fecha_compromiso', 'date') },
    { key: 'fecha_pago_real', label: 'Pago real', align: 'left', mono: true, render: (r) => r._faltante ? '—' : renderCell(r, 'fecha_pago_real', 'date') },
    { key: 'folio', label: 'Folio', align: 'left', mono: true, render: (r) => r._faltante
      ? <Boton primario style={{ height: 22, fontSize: 10.5 }} onClick={() => crearMesFijo(conceptoKey, r._mes.key, records)}>+ Crear</Boton>
      : renderCell(r, 'folio') },
    ...(canEdit ? [{ key: '_ok', label: '✓', align: 'center', width: 36, render: (r) => r._faltante || modo === 'futuros' || modo === 'inactivos' ? null : (
      <CheckPagado pagado={r.estatus === 'pagado'} onClick={() => togglePagado(r)} title={r.estatus === 'pagado' ? `Pagado el ${r.fecha_pago_real || '—'}. Click para desmarcar.` : 'Marcar como pagado con la fecha de hoy'} />
    ) }] : []),
  ];

  const filasPrincipal = [...faltantes.map((m) => ({ id: `faltante-${m.key}`, _faltante: true, _mes: m })), ...filasActivas];
  const resumen = (
    <span style={{ ...MONO }}>
      {formatMXN(montoMes)}/mes · {records.length} meses
      {pagadosN > 0 && <> · <span style={{ color: theme.green }}>{pagadosN} pagados</span></>}
      {porPagar > 0 && <> · <span style={{ color: theme.orange }}>{porPagar} por pagar</span></>}
      {vencidosN > 0 && <> · <span style={{ color: theme.red }}>{vencidosN} vencidos</span></>}
      {futurosN > 0 && <> · {futurosN} futuros</>}
      {inactivosN > 0 && <> · {inactivosN} no aplica</>}
    </span>
  );

  return (
    <Panel plegable abiertoInicial={!!expandedFijos[conceptoKey]} titulo={conceptoKey} meta={resumen} padding="8px 10px 10px" acciones={
      <>
        <span style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: theme.text }}>{formatMXN(totalAnual)}</span>
        <span style={{ fontSize: 10, color: theme.textMuted }}>anual</span>
        {canEdit && dbOk && <Boton peligro style={{ height: 24, fontSize: 10.5 }} onClick={() => handleDeleteFijo(conceptoKey, records.map((r) => r.id))}>Eliminar todo</Boton>}
      </>
    }>
      <TablaCompacta dense columnas={cols('activos')} filas={filasPrincipal} rowKey={(r) => r.id} vacio="✓ No hay pagos pendientes en este concepto" />
      {filasPagados.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <FilaToggle tone="green" abierto={!!expandedFijos[keyP]} onClick={() => toggleFijo(keyP)}>
            {filasPagados.length} pago{filasPagados.length !== 1 ? 's' : ''} completado{filasPagados.length !== 1 ? 's' : ''}
            <span style={{ fontWeight: 400, ...MONO }}>({formatMXN(filasPagados.reduce((s, r) => s + (r.monto || 0), 0))})</span>
          </FilaToggle>
          {expandedFijos[keyP] && <TablaCompacta dense columnas={cols('pagados')} filas={filasPagados} rowKey={(r) => r.id} />}
        </div>
      )}
      {filasFuturos.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <FilaToggle abierto={!!expandedFijos[keyF]} onClick={() => toggleFijo(keyF)}>
            {filasFuturos.length} mes{filasFuturos.length !== 1 ? 'es' : ''} futuro{filasFuturos.length !== 1 ? 's' : ''} (programados)
          </FilaToggle>
          {expandedFijos[keyF] && <TablaCompacta dense columnas={cols('futuros')} filas={filasFuturos} rowKey={(r) => r.id} />}
        </div>
      )}
      {filasInactivos.length > 0 && (
        <div style={{ marginTop: 6 }}>
          <FilaToggle abierto={!!expandedFijos[keyI]} onClick={() => toggleFijo(keyI)}>
            {filasInactivos.length} no aplica / cancelado{filasInactivos.length !== 1 ? 's' : ''}
          </FilaToggle>
          {expandedFijos[keyI] && <TablaCompacta dense columnas={cols('inactivos')} filas={filasInactivos} rowKey={(r) => r.id} />}
        </div>
      )}
    </Panel>
  );
}

export default function PagosFijos({ fijoGroups, canEdit, dbOk, edit, expandedFijos, toggleFijo, togglePagado, crearMesFijo, handleDeleteFijo, showAddFijo, setShowAddFijo, newFijo, setNewFijo, handleAddFijo }) {
  const { theme } = useTheme();
  const keys = Object.keys(fijoGroups);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {dbOk && canEdit && (showAddFijo
        ? <FormNuevoFijo newFijo={newFijo} setNewFijo={setNewFijo} fijoGroups={fijoGroups} onSave={handleAddFijo} onCancel={() => { setShowAddFijo(false); setNewFijo({ concepto: '', monto: '', responsable: '', meses: [], existente: '' }); }} />
        : <div><Boton primario onClick={() => setShowAddFijo(true)}>+ Nuevo pago fijo</Boton></div>)}
      {keys.length === 0
        ? <div style={{ textAlign: 'center', padding: 24, color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>No hay pagos fijos registrados</div>
        : keys.map((k) => (
          <GrupoFijo key={k} conceptoKey={k} records={fijoGroups[k]} canEdit={canEdit} dbOk={dbOk} edit={edit}
            expandedFijos={expandedFijos} toggleFijo={toggleFijo} togglePagado={togglePagado} crearMesFijo={crearMesFijo} handleDeleteFijo={handleDeleteFijo} />
        ))}
    </div>
  );
}
