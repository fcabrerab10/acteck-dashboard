// Rebate · Digitalife (trimestral por categoría), Dicotech (mensual por tier con
// selector inline de %) y PCEL (trimestral + fondo MKT con aprobación sin cuota).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { Panel, TablaCompacta, Pill, Boton, Segmented } from '../../../components/kit';
import { MESES_CORTOS, Campo, Input, MONO, Nota } from './pagosUI';

const mesActualIdx = () => new Date().getMonth() + 1;

// Color del tier según umbral de alcance · 90 % amarillo.
export function useTierColor() {
  const { theme } = useTheme();
  return (minAlcance) => {
    const a = Number(minAlcance) || 0;
    if (a >= 1.3) return theme.green;
    if (a >= 1.15) return theme.accent;
    if (a >= 1.0) return theme.purple;
    if (a >= 0.9) return theme.yellow || theme.orange;
    return theme.orange;
  };
}

function AlcancePct({ alcance, sellIn, min = 0.9 }) {
  const { theme } = useTheme();
  if (!(sellIn > 0)) return <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const col = alcance >= 1.2 ? theme.green : alcance >= min ? theme.accent : theme.red;
  return <span style={{ fontWeight: 700, color: col }}>{(alcance * 100).toFixed(0)}%</span>;
}

// ═══ Digitalife · trimestral por categoría ═══
export function RebateDigitalife({ rebateQ, setRebateQ, rebateLoading, rebateData, REBATE_PCT, rebateSynced, canEdit, actualizarRebatePago, borrarRebatePago, registrarRebateQ, anio }) {
  const { theme } = useTheme();
  const filas = [
    { key: 'monitores', label: 'Monitores' }, { key: 'sillas', label: 'Sillas' }, { key: 'accesorios', label: 'Accesorios' },
  ].map((r) => { const si = rebateData[r.key] || 0; const pct = REBATE_PCT[r.key]; return { ...r, si, pct, reb: Math.round(si * pct) }; });
  const totalReb = filas.reduce((s, r) => s + r.reb, 0);
  const totalSI = filas.reduce((s, r) => s + r.si, 0);
  const registrado = rebateSynced[rebateQ];
  return (
    <Panel titulo={`Rebate Q${rebateQ} ${anio}`} meta="Sell In del trimestre × % por categoría"
      acciones={<Segmented value={rebateQ} onChange={setRebateQ} options={[1, 2, 3, 4].map((q) => ({ id: q, label: `Q${q}` }))} />}>
      {rebateLoading ? <div style={{ padding: 16, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>Cargando datos de Sell In…</div> : (
        <>
          <TablaCompacta columnas={[
            { key: 'label', label: 'Categoría', align: 'left', bold: true },
            { key: 'si', label: 'Sell In', align: 'right', render: (r) => (r.si > 0 ? formatMXN(r.si) : '—') },
            { key: 'pct', label: 'Rebate %', align: 'right', render: (r) => `${(r.pct * 100).toFixed(0)}%` },
            { key: 'reb', label: 'Rebate $', align: 'right', render: (r) => <span style={{ fontWeight: 600, color: r.reb > 0 ? theme.red : theme.textMuted }}>{r.reb > 0 ? formatMXN(r.reb) : '—'}</span> },
          ]} filas={filas} rowKey={(r) => r.key} totales={{ si: totalSI, reb: totalReb }} />
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            <Nota>Rebate basado en Sell In del trimestre. Se paga al cierre de Q{rebateQ}. Monitores y sillas {(REBATE_PCT.monitores * 100).toFixed(0)}%, accesorios {(REBATE_PCT.accesorios * 100).toFixed(0)}%.</Nota>
            {totalReb > 0 && (registrado ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Pill tone="green" dot>Pago Q{rebateQ} registrado</Pill>
                {canEdit && <Boton onClick={actualizarRebatePago} title="Recalcular con Sell In actualizado y actualizar el monto del pago">Actualizar</Boton>}
                {canEdit && <Boton peligro onClick={borrarRebatePago} title="Eliminar el pago registrado">Borrar</Boton>}
              </span>
            ) : canEdit && <Boton primario onClick={() => registrarRebateQ(totalReb)}>Registrar pago Q{rebateQ} · {formatMXN(totalReb)}</Boton>)}
          </div>
        </>
      )}
    </Panel>
  );
}

// ═══ Dicotech · mensual por tier con selector inline ═══
export function RebateDicotech({ dicoRebateCalc, dicoRebateTotalYTD, lineamientos, pctPorMes, setPctPorMes, canEdit, generarRebateDicotech, marcarRebateDicotechNoAplica, revertirSpiff, anio }) {
  const { theme } = useTheme();
  const tierColor = useTierColor();
  const mesAct = mesActualIdx();
  const tiersOrd = (lineamientos?.rebate?.tiers || []).slice().sort((a, b) => Number(b.min_alcance) - Number(a.min_alcance));
  const nombreOficial = lineamientos?.rebate?.nombre_oficial || 'Fondo para Generación Sell Out';
  const alcanceMinPago = ((lineamientos?.rebate?.alcance_minimo_pago || 0.9) * 100).toFixed(0);

  const filas = dicoRebateCalc.map((m) => {
    const p = m.pagoExistente;
    const isNoAplica = p && p.estatus === 'cancelado';
    const isGenerado = p && p.estatus !== 'cancelado';
    const pctAuto = Number(m.tier?.pct || 0);
    const pctSel = pctPorMes[m.mes] != null ? Number(pctPorMes[m.mes]) : pctAuto;
    const montoSel = Math.round(m.sellIn * pctSel);
    return { ...m, p, isNoAplica, isGenerado, pctAuto, pctSel, montoSel, esOverride: pctSel !== pctAuto, enCurso: m.mes >= mesAct };
  });

  const columnas = [
    { key: 'label', label: 'Mes', align: 'left', render: (m) => (
      <span style={{ fontWeight: 600, color: m.enCurso ? theme.textMuted : theme.text, opacity: m.isNoAplica ? 0.5 : 1 }}>{m.label}{m.mes === mesAct && <Pill tone="blue" size="xs" style={{ marginLeft: 6 }}>Actual</Pill>}</span>
    ) },
    { key: 'sellIn', label: 'Sell-in', align: 'right', render: (m) => (m.sellIn > 0 ? <span style={{ color: m.enCurso ? theme.textMuted : theme.text }}>{formatMXN(m.sellIn)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'cuota', label: 'Cuota', align: 'right', render: (m) => <span style={{ color: theme.textMuted }}>{formatMXN(m.cuota)}</span> },
    { key: 'alcance', label: 'Alcance %', align: 'right', render: (m) => <AlcancePct alcance={m.alcance} sellIn={m.sellIn} min={Number(lineamientos?.rebate?.alcance_minimo_pago) || 0.9} /> },
    { key: 'tier', label: 'Tier', align: 'center', render: (m) => {
      if (m.sellIn > 0 && !m.isGenerado && !m.isNoAplica) {
        const tSel = tiersOrd.find((t) => Number(t.pct) === m.pctSel);
        const col = tSel ? tierColor(tSel.min_alcance) : theme.textMuted;
        return (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <select value={m.pctSel} disabled={!canEdit} onChange={(e) => setPctPorMes((prev) => ({ ...prev, [m.mes]: Number(e.target.value) }))}
              title={m.esOverride ? `Override — sugerido: ${(m.pctAuto * 100).toFixed(2)}% (${m.tier?.label || 'sin tier'})` : `Sugerido según alcance · ${m.tier?.label || ''}`}
              style={{ ...MONO, fontSize: 10.5, fontWeight: 700, padding: '2px 6px', borderRadius: 999, border: `1px solid ${col}55`, background: `${col}1A`, color: col, cursor: canEdit ? 'pointer' : 'not-allowed', outline: 'none', minWidth: 60, textAlign: 'center' }}>
              {tiersOrd.map((t, i) => <option key={i} value={Number(t.pct)}>{(Number(t.pct) * 100).toFixed(2)}%</option>)}
              {m.pctSel === 0 && !tiersOrd.some((t) => Number(t.pct) === 0) && <option value={0}>0.00%</option>}
            </select>
            {m.esOverride && <button onClick={() => setPctPorMes((prev) => { const n = { ...prev }; delete n[m.mes]; return n; })} title="Restaurar sugerido" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, fontSize: 11, padding: 0 }}>↺</button>}
          </span>
        );
      }
      if (m.tier) { const col = tierColor(m.tier.min_alcance); return <span style={{ ...MONO, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: `${col}1A`, color: col }}>{(Number(m.tier.pct) * 100).toFixed(2)}%</span>; }
      return <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
    } },
    { key: 'montoSel', label: 'Rebate $', align: 'right', render: (m) => (m.isNoAplica || !(m.montoSel > 0) ? <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span> : <span style={{ fontWeight: 700, color: theme.red }}>{formatMXN(m.montoSel)}</span>) },
    { key: '_estatus', label: 'Estatus', align: 'left', render: (m) => {
      if (m.isNoAplica) return <Pill tone="gray" dot>No aplica</Pill>;
      if (m.isGenerado) return <Pill tone={m.p.estatus === 'pagado' ? 'green' : 'orange'} dot>{m.p.estatus === 'pagado' ? 'Pagado' : 'Por pagar'}</Pill>;
      if (m.sellIn > 0 && m.montoSel > 0) return <Pill tone="blue" dot>Se genera</Pill>;
      if (m.sellIn > 0) return <Pill tone="gray" dot>Sin rebate</Pill>;
      return <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>Sin datos</span>;
    } },
    ...(canEdit ? [{ key: '_acc', label: '', align: 'right', render: (m) => {
      if (m.isNoAplica) return <Boton onClick={() => revertirSpiff(m.p.id)}>↺ Revertir</Boton>;
      if (m.isGenerado) return <Boton peligro onClick={() => revertirSpiff(m.p.id)} title="Eliminar pago">Eliminar</Boton>;
      if (m.sellIn > 0 && m.montoSel > 0) return (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Boton primario onClick={() => generarRebateDicotech(m, m.pctSel)} title={!m.cumple ? `Pagar aunque no llegue a ${alcanceMinPago}%` : ''} style={!m.cumple && !m.esOverride ? { background: theme.orange, borderColor: theme.orange } : undefined}>Generar</Boton>
          <Boton onClick={() => marcarRebateDicotechNoAplica(m)}>No aplica</Boton>
        </span>
      );
      if (m.sellIn > 0) return <Boton onClick={() => marcarRebateDicotechNoAplica(m)}>No aplica</Boton>;
      return null;
    } }] : []),
  ];

  return (
    <Panel titulo={`Rebate mensual ${anio}`} meta={`${nombreOficial} · pago el 15 del mes siguiente`}
      acciones={<><span style={{ fontSize: 10, color: theme.textMuted }}>Acumulado YTD</span><span style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: theme.red }}>{formatMXN(dicoRebateTotalYTD)}</span></>}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
        {tiersOrd.map((t, i) => { const col = tierColor(t.min_alcance); return <span key={i} style={{ ...MONO, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: `${col}1A`, color: col }}>{t.label} · {(Number(t.pct) * 100).toFixed(2)}%</span>; })}
        <Pill tone="gray" size="sm">&lt; {alcanceMinPago}% → sin rebate auto</Pill>
      </div>
      <TablaCompacta columnas={columnas} filas={filas} rowKey={(m) => m.mes} />
      <Nota style={{ marginTop: 6 }}>Fecha de pago automática: día 15 del mes siguiente (rebate de enero → 15 de febrero). El % aplicado depende del tier que alcance el mes; el selector permite un override por fila. Meses en curso en gris.</Nota>
    </Panel>
  );
}

// ═══ PCEL · trimestral (Rebate + Fondo MKT) ═══
export function RebatePcel({ pcelCalc, pcelRebateTiers, pcelOverrideRebate, setPcelOverrideRebate, pcelOverrideFondo, setPcelOverrideFondo, pcelPagosReg, showPagoForm, setShowPagoForm, pagoFormData, setPagoFormData, guardarPagoPcel, canEdit, anio }) {
  const { theme } = useTheme();
  const filas = pcelCalc.quarterly.map((q) => {
    const isRebApproved = pcelOverrideRebate[q.q] === 'approved';
    const isFondoApproved = pcelOverrideFondo[q.q] === 'approved';
    const meetsQuota = q.alcance >= 0.9;
    const payRebate = q.sellIn > 0 && (meetsQuota || isRebApproved);
    const payFondo = q.sellIn > 0 && (meetsQuota || isFondoApproved);
    const rebateAmt = payRebate ? q.sellIn * q.rebatePct : 0;
    const fondoAmt = payFondo ? q.fondoAmount : 0;
    const pagoReg = pcelPagosReg.find((p) => p.categoria === 'rebate' && p.folio && p.folio.includes('Q' + q.q));
    return { ...q, isRebApproved, isFondoApproved, meetsQuota, payRebate, payFondo, rebateAmt, fondoAmt, pagoReg, shouldPay: payRebate || payFondo, formKey: 'rebate-Q' + q.q };
  });
  const totRebate = filas.reduce((s, q) => s + q.rebateAmt, 0);
  const totFondo = filas.reduce((s, q) => s + q.fondoAmt, 0);
  const columnas = [
    { key: 'label', label: 'Trimestre', align: 'left', bold: true },
    { key: 'sellIn', label: 'Sell In', align: 'right', render: (q) => (q.sellIn > 0 ? formatMXN(q.sellIn) : '—') },
    { key: 'cuota', label: 'Cuota', align: 'right', render: (q) => <span style={{ color: theme.textMuted }}>{q.cuota > 0 ? formatMXN(q.cuota) : '—'}</span> },
    { key: 'alcance', label: 'Alcance %', align: 'right', render: (q) => <AlcancePct alcance={q.alcance} sellIn={q.sellIn} /> },
    { key: 'rebateAmt', label: 'Rebate', align: 'right', render: (q) => <span style={{ fontWeight: 700, color: q.payRebate ? (q.isRebApproved && !q.meetsQuota ? theme.orange : theme.accent) : theme.textMuted }}>{q.payRebate ? formatMXN(q.rebateAmt) + (!q.meetsQuota && q.isRebApproved ? ' *' : '') : q.sellIn > 0 ? '$0' : '—'}</span> },
    { key: 'fondoAmt', label: 'Fondo MKT', align: 'right', render: (q) => <span style={{ fontWeight: 700, color: q.payFondo ? (q.isFondoApproved && !q.meetsQuota ? theme.orange : theme.green) : theme.textMuted }}>{q.payFondo ? formatMXN(q.fondoAmt) + (!q.meetsQuota && q.isFondoApproved ? ' *' : '') : q.sellIn > 0 ? '$0' : '—'}</span> },
    { key: '_aprobar', label: 'Aprobar', align: 'center', render: (q) => {
      if (q.sellIn > 0 && q.meetsQuota) return <Pill tone="green" dot size="xs" title="Auto-aprobado por cuota cumplida">Cuota</Pill>;
      if (q.sellIn > 0) return (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Pill tone={q.isRebApproved ? 'blue' : 'gray'} size="xs" onClick={canEdit ? () => setPcelOverrideRebate((prev) => ({ ...prev, [q.q]: prev[q.q] === 'approved' ? '' : 'approved' })) : undefined} title="Aprobar/desaprobar pago de Rebate aunque no llegue a cuota">{q.isRebApproved ? '✓ Rebate' : 'Rebate'}</Pill>
          <Pill tone={q.isFondoApproved ? 'green' : 'gray'} size="xs" onClick={canEdit ? () => setPcelOverrideFondo((prev) => ({ ...prev, [q.q]: prev[q.q] === 'approved' ? '' : 'approved' })) : undefined} title="Aprobar/desaprobar pago de Fondo MKT aunque no llegue a cuota">{q.isFondoApproved ? '✓ Fondo MKT' : 'Fondo MKT'}</Pill>
        </span>
      );
      return null;
    } },
    { key: '_reg', label: 'Registro', align: 'center', render: (q) => q.pagoReg
      ? <Pill tone={q.pagoReg.estatus === 'pagado' ? 'green' : 'orange'} dot>{q.pagoReg.estatus === 'pagado' ? 'Pagado' : 'Por pagar'}</Pill>
      : q.shouldPay && canEdit ? <Boton onClick={() => setShowPagoForm(showPagoForm === q.formKey ? null : q.formKey)}>+ Registrar</Boton> : null },
  ];
  return (
    <Panel titulo={`Rebate trimestral ${anio}`} meta={`Tiers: ${pcelRebateTiers.map((t) => `${t.label}=${(t.pct * 100).toFixed(2)}%`).join(' · ')}`}>
      <TablaCompacta columnas={columnas} filas={filas} rowKey={(q) => q.q} totales={{ sellIn: pcelCalc.totalSellIn, rebateAmt: totRebate, fondoAmt: totFondo }}
        renderExpandido={(q) => <PcelPagoForm periodoLabel={q.label} monto={q.rebateAmt} pagoFormData={pagoFormData} setPagoFormData={setPagoFormData} onSave={() => guardarPagoPcel('rebate', 'Q' + q.q, q.rebateAmt)} onCancel={() => setShowPagoForm(null)} />}
        expandidoKey={showPagoForm && String(showPagoForm).startsWith('rebate-Q') ? Number(String(showPagoForm).replace('rebate-Q', '')) : null} />
      <Nota style={{ marginTop: 6 }}>* Aprobado manualmente sin llegar a cuota. Cada concepto (Rebate / Fondo MKT) se aprueba por separado.</Nota>
    </Panel>
  );
}

export function PcelPagoForm({ periodoLabel, monto, pagoFormData, setPagoFormData, onSave, onCancel }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '8px 10px', background: theme.bg, display: 'flex', alignItems: 'flex-end', gap: 8, flexWrap: 'wrap', fontFamily: TYPO.fontText }}>
      <span style={{ fontSize: 11, color: theme.textMuted, alignSelf: 'center' }}>Registrar {periodoLabel} · <strong style={{ ...MONO, color: theme.text }}>{formatMXN(monto)}</strong></span>
      <Campo label="Compromiso" style={{ width: 150 }}><Input type="date" value={pagoFormData.fecha_compromiso} onChange={(e) => setPagoFormData((p) => ({ ...p, fecha_compromiso: e.target.value }))} /></Campo>
      <Campo label="Responsable" style={{ width: 160 }}><Input type="text" value={pagoFormData.responsable} onChange={(e) => setPagoFormData((p) => ({ ...p, responsable: e.target.value }))} /></Campo>
      <Campo label="Notas" style={{ flex: 1, minWidth: 160 }}><Input type="text" value={pagoFormData.notas} onChange={(e) => setPagoFormData((p) => ({ ...p, notas: e.target.value }))} /></Campo>
      <Boton primario onClick={onSave}>Guardar</Boton>
      <Boton onClick={onCancel}>Cancelar</Boton>
    </div>
  );
}

export { MESES_CORTOS };
