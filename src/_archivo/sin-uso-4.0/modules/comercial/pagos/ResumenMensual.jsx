// Resumen por mes · calendario de 12 meses (compromiso / pagado / vencidos) +
// tabla mes × categoría expandible + modal de exportación "pagos por pagar".
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { Panel, TablaCompacta, Pill, Boton, EASE } from '../../../components/kit';
import { CATEGORIA_META, MESES_CORTOS, MESES_LARGOS, EstatusPill, CategoriaPill, Modal, MONO } from './pagosUI';

export function CalendarioPagos({ registros, clienteKey, anio }) {
  const { theme } = useTheme();
  const regs = registros.filter((r) => r.cliente === clienteKey);
  const porMes = {};
  for (let m = 1; m <= 12; m++) porMes[m] = { total: 0, pagado: 0, pendiente: 0, porCat: {}, nPend: 0, nPag: 0, vencidos: 0 };
  const hoy = new Date();
  regs.forEach((r) => {
    const fechaStr = r.fecha_pago_real || r.fecha_compromiso;
    if (!fechaStr) return;
    const parts = String(fechaStr).slice(0, 10).split('-').map((n) => parseInt(n, 10));
    if (parts.length !== 3 || parts[0] !== anio) return;
    const m = parts[1];
    if (m < 1 || m > 12) return;
    const monto = Number(r.monto) || 0;
    const isPagado = !!r.fecha_pago_real || r.estatus === 'pagado';
    porMes[m].total += monto;
    if (isPagado) { porMes[m].pagado += monto; porMes[m].nPag++; }
    else {
      porMes[m].pendiente += monto; porMes[m].nPend++;
      if (r.fecha_compromiso) {
        const pp = String(r.fecha_compromiso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
        if (pp.length === 3 && new Date(pp[0], pp[1] - 1, pp[2]) < hoy) porMes[m].vencidos++;
      }
    }
    const cat = r.categoria || 'otros';
    porMes[m].porCat[cat] = (porMes[m].porCat[cat] || 0) + monto;
  });
  const mesActual = hoy.getMonth() + 1;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
        const d = porMes[m];
        const hasData = d.total > 0;
        const pct = d.total > 0 ? (d.pagado / d.total) * 100 : 0;
        const col = pct >= 100 ? theme.green : pct >= 50 ? theme.accent : theme.orange;
        return (
          <div key={m} style={{ border: `1px solid ${d.vencidos > 0 ? theme.red : m === mesActual ? theme.accent : theme.border}`, borderRadius: 10, padding: '8px 10px', background: theme.surface, opacity: hasData ? 1 : 0.55, display: 'flex', flexDirection: 'column', gap: 6, fontFamily: TYPO.fontText }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text }}>{MESES_LARGOS[m - 1]}</span>
              {d.vencidos > 0 ? <Pill tone="red" size="xs" dot>{d.vencidos} vencido{d.vencidos === 1 ? '' : 's'}</Pill> : m === mesActual ? <Pill tone="blue" size="xs">Actual</Pill> : null}
            </div>
            {hasData ? (
              <>
                <div style={{ ...MONO, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, lineHeight: 1 }}>{formatMXN(d.total)}</div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginBottom: 3, ...MONO }}>
                    <span style={{ color: theme.green, fontWeight: 600 }}>Pagado {formatMXN(d.pagado)}</span>
                    <span style={{ color: theme.textMuted, fontWeight: 600 }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 3, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: col, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {Object.entries(d.porCat).map(([cat, monto]) => (
                    <Pill key={cat} tone={CATEGORIA_META[cat]?.tone || 'gray'} size="xs" title={`${CATEGORIA_META[cat]?.label || cat}: ${formatMXN(monto)}`}>{CATEGORIA_META[cat]?.label || cat} {formatMXN(monto)}</Pill>
                  ))}
                </div>
                <div style={{ fontSize: 10, color: theme.textMuted, display: 'flex', gap: 8, paddingTop: 4, borderTop: `1px dashed ${theme.border}`, ...MONO }}>
                  <span>✓ {d.nPag} pagados</span><span>○ {d.nPend} pendientes</span>
                </div>
              </>
            ) : <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>Sin pagos</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function ResumenMensual({ registros, clienteKey, anio, mb, totalAnio, expandedMonth, setExpandedMonth, onAbrirExport }) {
  const { theme } = useTheme();
  const cats = ['promociones', 'marketing', 'pagosFijos', 'pagosVariables', 'rebate'];
  const columnas = [
    { key: 'mes', label: 'Mes', align: 'left', render: (m) => { const [yr, mo] = m.mes.split('-'); return <span style={{ fontWeight: 600 }}>{MESES_CORTOS[parseInt(mo, 10) - 1]} {yr}</span>; } },
    ...cats.map((c) => ({ key: c, label: CATEGORIA_META[c].label, align: 'right', sum: true, fmt: formatMXN, render: (m) => (m[c] > 0 ? formatMXN(m[c]) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) })),
    { key: 'total', label: 'Total', align: 'right', sum: true, fmt: formatMXN, render: (m) => <span style={{ fontWeight: 600 }}>{formatMXN(m.total)}</span> },
  ];
  const renderExpandido = (m) => (
    <div style={{ padding: '6px 10px 10px', background: theme.bg }}>
      <TablaCompacta dense columnas={[
        { key: 'concepto', label: 'Concepto', align: 'left', maxWidth: 320, render: (r) => r.concepto },
        { key: 'categoria', label: 'Categoría', align: 'left', render: (r) => <CategoriaPill categoria={r.categoria} size="xs" /> },
        { key: 'monto', label: 'Monto', align: 'right', render: (r) => formatMXN(r.monto || 0) },
        { key: 'estatus', label: 'Estatus', align: 'left', render: (r) => <EstatusPill estatus={r.estatus} size="xs" /> },
      ]} filas={m.records} rowKey={(r, i) => r.id ?? i} vacio="Sin registros en este mes." />
    </div>
  );
  return (
    <Panel plegable abiertoInicial={false} titulo="Resumen por mes" meta={`${mb.length} meses · total anual ${formatMXN(totalAnio)}`}
      acciones={<Boton onClick={onAbrirExport} title="Exporta a Excel los pagos por pagar de uno o varios meses">Exportar por pagar</Boton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <CalendarioPagos registros={registros} clienteKey={clienteKey} anio={anio} />
        <TablaCompacta columnas={columnas} filas={mb} rowKey={(m) => m.mes} onRowClick={(m) => setExpandedMonth(expandedMonth === m.mes ? null : m.mes)} renderExpandido={renderExpandido} expandidoKey={expandedMonth} />
      </div>
    </Panel>
  );
}

export function ExportModal({ mbList, registros, exportMeses, setExportMeses, onClose, onExportar }) {
  const { theme } = useTheme();
  const porPagarMes = (mesKey) => registros.filter((r) => r.fecha_compromiso && String(r.fecha_compromiso).slice(0, 7) === mesKey && ['pendiente', 'en_proceso', 'vencido'].includes(r.estatus));
  const toggleMes = (k) => setExportMeses((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));
  const selectedSum = exportMeses.reduce((s, k) => s + porPagarMes(k).reduce((a, r) => a + (Number(r.monto) || 0), 0), 0);
  const selectedCount = exportMeses.reduce((s, k) => s + porPagarMes(k).length, 0);
  const mesesConPendientes = mbList.filter((m) => porPagarMes(m.mes).length > 0);
  return (
    <Modal titulo="Exportar pagos por pagar" sub="Pendientes / en proceso / vencidos de los meses elegidos, en una sola hoja con subtotales." onClose={onClose} width={460}
      footer={<><Boton onClick={onClose}>Cancelar</Boton><Boton primario onClick={onExportar} disabled={exportMeses.length === 0 || selectedCount === 0}>Descargar Excel</Boton></>}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.textMuted, fontWeight: 600 }}>Meses</span>
        <span style={{ display: 'flex', gap: 6 }}>
          <Pill tone="blue" size="xs" onClick={() => setExportMeses(mesesConPendientes.map((m) => m.mes))}>Seleccionar todos</Pill>
          <Pill tone="gray" size="xs" onClick={() => setExportMeses([])}>Limpiar</Pill>
        </span>
      </div>
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, maxHeight: 280, overflowY: 'auto' }}>
        {mbList.length === 0 && <div style={{ padding: 20, textAlign: 'center', fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>No hay meses con registros de pago</div>}
        {mbList.map((m) => {
          const [a, mm] = m.mes.split('-');
          const cnt = porPagarMes(m.mes).length;
          const checked = exportMeses.includes(m.mes);
          const disabled = cnt === 0;
          return (
            <label key={m.mes} title={disabled ? 'Sin pagos por pagar en este mes' : ''}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderBottom: `1px solid ${theme.border}`, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1, background: checked ? theme.surfaceHover : 'transparent', fontSize: 12, fontFamily: TYPO.fontText }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input type="checkbox" checked={checked} disabled={disabled} onChange={() => !disabled && toggleMes(m.mes)} />
                <span style={{ color: theme.text }}>{MESES_LARGOS[Number(mm) - 1]} {a}</span>
              </span>
              <span style={{ fontSize: 11, color: theme.textMuted, ...MONO }}>{cnt} pago{cnt !== 1 ? 's' : ''}</span>
            </label>
          );
        })}
      </div>
      {exportMeses.length > 0 && (
        <div style={{ padding: '8px 10px', borderRadius: 8, background: theme.surfaceHover || theme.bg, fontSize: 11.5, color: theme.text, ...MONO }}>
          {selectedCount > 0
            ? <>Se exportarán <strong>{selectedCount} pagos</strong> de <strong>{exportMeses.length} mes{exportMeses.length !== 1 ? 'es' : ''}</strong> por un total de <strong>{formatMXN(selectedSum)}</strong>.</>
            : <>Los meses seleccionados no tienen pagos por pagar.</>}
        </div>
      )}
    </Modal>
  );
}
