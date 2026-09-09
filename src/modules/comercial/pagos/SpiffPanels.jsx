// SPIFF · Digitalife (flat sobre sell-out con umbral y palancas con candado),
// Dicotech (compradora % con candado + ranking de vendedores con premios) y PCEL (mensual % fijo).
import React from 'react';
import { Lock, Unlock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { Panel, TablaCompacta, Pill, Boton } from '../../../components/kit';
import { MESES_LARGOS, MESES_CORTOS, Campo, Input, MONO, Nota } from './pagosUI';
import { PcelPagoForm } from './RebatePanels';

const mesActualIdx = () => new Date().getMonth() + 1;

function BotonCandado({ unlocked, onToggle, title }) {
  const { theme } = useTheme();
  return (
    <Boton onClick={onToggle} title={title} icon={unlocked ? Unlock : Lock} style={unlocked ? { color: theme.orange, borderColor: theme.orange } : undefined}>
      {unlocked ? 'Editando' : 'Bloqueado'}
    </Boton>
  );
}

// Input numérico de palanca (%), sólo editable si el candado está abierto.
function PalancaInput({ label, valuePct, decimals, onSave, unlocked, onEscape, width = 110, inputRef, max = 500 }) {
  const { theme } = useTheme();
  return (
    <Campo label={label} style={{ width }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <Input ref={inputRef} type="number" step={decimals >= 3 ? '0.001' : '0.01'} min="0" max={max} key={valuePct} defaultValue={valuePct.toFixed(decimals)} readOnly={!unlocked}
          onBlur={(e) => { if (!unlocked) return; const raw = Number(e.target.value); if (isFinite(raw) && raw >= 0 && Math.abs(raw - valuePct) > 1e-9) onSave(raw); }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { onEscape?.(); e.currentTarget.blur(); } }}
          style={{ ...MONO, fontSize: 14, fontWeight: 600, textAlign: 'right', borderColor: unlocked ? theme.orange : theme.border, cursor: unlocked ? 'text' : 'not-allowed', opacity: unlocked ? 1 : 0.8 }} />
        <span style={{ ...MONO, fontSize: 13, fontWeight: 600, color: theme.textMuted }}>%</span>
      </span>
    </Campo>
  );
}

function EstatusSpiff({ p, comision, tieneDatos, noCumple }) {
  const { theme } = useTheme();
  if (p && p.estatus === 'cancelado') return <Pill tone="gray" dot>No aplica</Pill>;
  if (p) return <Pill tone={p.estatus === 'pagado' ? 'green' : 'orange'} dot>{p.estatus === 'pagado' ? 'Pagado' : 'Por pagar'}</Pill>;
  if (comision > 0) return <Pill tone="blue" dot>Se genera</Pill>;
  if (tieneDatos && noCumple) return <Pill tone="red" dot>No cumple</Pill>;
  return <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>Sin datos</span>;
}

// ═══ Digitalife ═══
export function SpiffDigitalife({ spiffCalc, spiffTotalYTD, SPIFF_CUOTA_SO_FACTOR, SPIFF_FLAT_PCT, SPIFF_MIN_ALCANCE, spiffDigiTiersUnlocked, setSpiffDigiTiersUnlocked, guardarSpiffDigiConfig, canEdit, crearSpiffPago, marcarSpiffNoAplica, revertirSpiff, anio }) {
  const { theme } = useTheme();
  const mesAct = mesActualIdx();
  const filas = spiffCalc.map((c) => ({ ...c, p: c.pagoExistente, enCurso: c.mes >= mesAct }));
  const columnas = [
    { key: 'mes', label: 'Mes', align: 'left', render: (c) => <span style={{ fontWeight: 600, color: c.enCurso ? theme.textMuted : theme.text }}>{MESES_LARGOS[c.mes - 1]}{c.mes === mesAct && <Pill tone="blue" size="xs" style={{ marginLeft: 6 }}>Actual</Pill>}</span> },
    { key: 'cuotaSI', label: 'Cuota SI', align: 'right', render: (c) => <span style={{ color: theme.textMuted }}>{c.cuotaSI > 0 ? formatMXN(c.cuotaSI) : '—'}</span> },
    { key: 'cuotaSOMin', label: 'Cuota SO', align: 'right', render: (c) => (c.cuotaSOMin > 0 ? formatMXN(c.cuotaSOMin) : '—') },
    { key: 'soActual', label: 'Sell-out', align: 'right', render: (c) => (c.soActual > 0 ? formatMXN(c.soActual) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'alcance', label: 'Alcance %', align: 'right', render: (c) => {
      if (!(c.soActual > 0 && c.cuotaSOMin > 0)) return <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
      const col = c.alcance >= 1.1 ? theme.green : c.alcance >= SPIFF_MIN_ALCANCE ? theme.accent : theme.red;
      return <span style={{ fontWeight: 700, color: col }}>{(c.alcance * 100).toFixed(0)}%</span>;
    } },
    { key: 'comision', label: 'Comisión', align: 'right', render: (c) => (c.comision > 0 ? <span style={{ fontWeight: 700 }}>{formatMXN(c.comision)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: '_est', label: 'Estatus', align: 'left', render: (c) => <EstatusSpiff p={c.p} comision={c.comision} tieneDatos={c.soActual > 0} noCumple={!c.aplica} /> },
    ...(canEdit ? [{ key: '_acc', label: '', align: 'right', render: (c) => {
      const p = c.p;
      if (p && p.estatus === 'cancelado') return <Boton onClick={() => revertirSpiff(p.id)}>↺ Revertir</Boton>;
      if (p) return <Boton peligro onClick={() => revertirSpiff(p.id)} title="Eliminar pago">Eliminar</Boton>;
      if (c.comision > 0) return <span style={{ display: 'inline-flex', gap: 4 }}><Boton primario onClick={() => crearSpiffPago(c)}>Generar</Boton><Boton onClick={() => marcarSpiffNoAplica(c.mes)}>No aplica</Boton></span>;
      if (c.soActual > 0) return (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          <Boton primario style={{ background: theme.orange, borderColor: theme.orange }} onClick={() => crearSpiffPago(c, true)} title={`Pagar manualmente aunque no cumpla el umbral · monto ${formatMXN(c.soActual * SPIFF_FLAT_PCT)}`}>Pagar manual</Boton>
          <Boton onClick={() => marcarSpiffNoAplica(c.mes)}>No aplica</Boton>
        </span>
      );
      return null;
    } }] : []),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Panel titulo="Palancas del SPIFF" meta="Afectan todos los cálculos de comisión de Digitalife"
        acciones={canEdit && <BotonCandado unlocked={spiffDigiTiersUnlocked} title={spiffDigiTiersUnlocked ? 'Bloquear' : 'Desbloquear para editar'}
          onToggle={() => { if (spiffDigiTiersUnlocked) { setSpiffDigiTiersUnlocked(false); return; } if (!confirm('¿Desbloquear edición de las palancas SPIFF?\n\nAfecta todos los cálculos de comisión Digitalife.')) return; setSpiffDigiTiersUnlocked(true); }} />}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <PalancaInput label="Cuota SO / Cuota SI" valuePct={SPIFF_CUOTA_SO_FACTOR * 100} decimals={0} unlocked={spiffDigiTiersUnlocked} onSave={(raw) => guardarSpiffDigiConfig({ cuota_so_factor: raw / 100 })} onEscape={() => setSpiffDigiTiersUnlocked(false)} />
          <PalancaInput label="Umbral mínimo alcance SO" valuePct={SPIFF_MIN_ALCANCE * 100} decimals={0} unlocked={spiffDigiTiersUnlocked} onSave={(raw) => guardarSpiffDigiConfig({ min_alcance: raw / 100 })} onEscape={() => setSpiffDigiTiersUnlocked(false)} />
          <PalancaInput label="% Comisión sobre SO" valuePct={SPIFF_FLAT_PCT * 100} decimals={3} unlocked={spiffDigiTiersUnlocked} onSave={(raw) => guardarSpiffDigiConfig({ flat_pct: raw / 100 })} onEscape={() => setSpiffDigiTiersUnlocked(false)} width={130} />
          <Nota style={{ flex: 1, minWidth: 220 }}>Cuota SO mensual = cuota SI × {(SPIFF_CUOTA_SO_FACTOR * 100).toFixed(0)}%. Comisión = SO × {(SPIFF_FLAT_PCT * 100).toFixed(3)}% sólo si alcance ≥ {(SPIFF_MIN_ALCANCE * 100).toFixed(0)}%.</Nota>
        </div>
      </Panel>
      <Panel titulo={`SPIFF mensual ${anio}`} meta="Por sell-out del mes · PM Digitalife"
        acciones={<><span style={{ fontSize: 10, color: theme.textMuted }}>Comisión YTD</span><span style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: theme.purple }}>{formatMXN(spiffTotalYTD)}</span></>}>
        <TablaCompacta columnas={columnas} filas={filas} rowKey={(c) => c.mes} />
        <Nota style={{ marginTop: 6 }}>Fecha de pago automática: día 15 del mes siguiente · Responsable: PM Digitalife.</Nota>
      </Panel>
    </div>
  );
}

// ═══ Dicotech · compradora + vendedores ═══
export function SpiffDicotech({ spiffDicotechCalc, spiffDicotechTotalYTD, spiffDicoCompradoraPct, spiffPctUnlocked, setSpiffPctUnlocked, spiffPctInputRef, guardarSpiffDicoConfig, canEdit, crearSpiffDicotechPago, marcarSpiffDicotechNoAplica, revertirSpiff, anio }) {
  const { theme } = useTheme();
  const mesAct = mesActualIdx();
  const filas = spiffDicotechCalc.map((c) => ({ ...c, p: c.pagoSI, enCurso: c.mes >= mesAct }));
  const columnas = [
    { key: 'mes', label: 'Mes', align: 'left', render: (c) => <span style={{ fontWeight: 600, color: c.enCurso ? theme.textMuted : theme.text }}>{MESES_LARGOS[c.mes - 1]}{c.mes === mesAct && <Pill tone="blue" size="xs" style={{ marginLeft: 6 }}>Actual</Pill>}</span> },
    { key: 'siActual', label: 'Sell-in real', align: 'right', render: (c) => (c.siActual > 0 ? formatMXN(c.siActual) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'comisionSI', label: 'Comisión', align: 'right', render: (c) => (c.comisionSI > 0 ? <span style={{ fontWeight: 700 }}>{formatMXN(c.comisionSI)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: '_est', label: 'Estatus', align: 'left', render: (c) => <EstatusSpiff p={c.p} comision={c.comisionSI} tieneDatos={c.siActual > 0} /> },
    ...(canEdit ? [{ key: '_acc', label: '', align: 'right', render: (c) => {
      const p = c.p;
      if (p && p.estatus === 'cancelado') return <Boton onClick={() => revertirSpiff(p.id)}>↺ Revertir</Boton>;
      if (p) return <Boton peligro onClick={() => revertirSpiff(p.id)} title="Eliminar pago">Eliminar</Boton>;
      if (c.comisionSI > 0) return <span style={{ display: 'inline-flex', gap: 4 }}><Boton primario onClick={() => crearSpiffDicotechPago(c, 'SI', false)}>Generar</Boton><Boton onClick={() => marcarSpiffDicotechNoAplica(c.mes, 'SI')}>No aplica</Boton></span>;
      return null;
    } }] : []),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Panel titulo="SPIFF Compradora" meta={`Sell-in Revko × ${(spiffDicoCompradoraPct * 100).toFixed(3)}% · Beatriz Reyes · mensual`}
        acciones={
          <>
            {canEdit && <BotonCandado unlocked={spiffPctUnlocked} title={spiffPctUnlocked ? 'Bloquear · click para prevenir cambios' : 'Desbloquear · click para editar'}
              onToggle={() => { if (spiffPctUnlocked) { setSpiffPctUnlocked(false); return; } if (!confirm('¿Desbloquear edición del % Compradora?\n\nEste valor afecta todos los cálculos de comisión SPIFF.')) return; setSpiffPctUnlocked(true); setTimeout(() => spiffPctInputRef.current?.focus(), 50); }} />}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Input ref={spiffPctInputRef} type="number" step="0.001" min="0" max="10" key={spiffDicoCompradoraPct} defaultValue={(spiffDicoCompradoraPct * 100).toFixed(3)} readOnly={!spiffPctUnlocked}
                onBlur={(e) => { if (!spiffPctUnlocked) return; const pct = Number(e.target.value) / 100; if (pct !== spiffDicoCompradoraPct && pct >= 0 && pct <= 0.1) guardarSpiffDicoConfig({ compradora_pct: pct }); setSpiffPctUnlocked(false); }}
                onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setSpiffPctUnlocked(false); e.currentTarget.blur(); } }}
                style={{ ...MONO, width: 90, height: 28, fontSize: 13, fontWeight: 600, textAlign: 'right', borderColor: spiffPctUnlocked ? theme.orange : theme.border, cursor: spiffPctUnlocked ? 'text' : 'not-allowed' }} />
              <span style={{ ...MONO, fontSize: 12, fontWeight: 600, color: theme.textMuted }}>%</span>
            </span>
            <span style={{ fontSize: 10, color: theme.textMuted, marginLeft: 6 }}>YTD</span><span style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: theme.purple }}>{formatMXN(spiffDicotechTotalYTD.si)}</span>
          </>
        }>
        <TablaCompacta columnas={columnas} filas={filas} rowKey={(c) => c.mes} />
      </Panel>

      <Panel titulo="SPIFF Vendedores Dicotech" meta="Top 5 del sell-out del mes que superen la cuota mínima · premios editables por mes">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {spiffDicotechCalc.map((c) => {
            const mesKey = `${anio}-${String(c.mes).padStart(2, '0')}`;
            const esActual = c.mes === mesAct;
            const esFuturo = c.mes > mesAct;
            const sinData = c.vendedoresMes.length === 0;
            return (
              <Panel key={mesKey} plegable abiertoInicial={esActual} padding="8px 10px 10px" style={{ opacity: esFuturo ? 0.6 : 1, borderColor: esActual ? theme.accent : theme.border }}
                titulo={`${MESES_LARGOS[c.mes - 1]} ${anio}`}
                meta={<span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                  {esActual && <Pill tone="blue" size="xs">Actual</Pill>}
                  {esFuturo && <Pill tone="gray" size="xs">Pendiente</Pill>}
                  {sinData && !esFuturo && <Pill tone="orange" size="xs">Sin data Revko</Pill>}
                  {c.vendedoresMes.length > 0 && <span style={MONO}>{c.vendedoresMes.length} vendedores · <strong style={{ color: theme.text }}>{c.ganadores.length}</strong> califican</span>}
                  {c.cuotaMin > 0 && <span style={MONO}>· cuota mín <strong style={{ color: theme.text }}>{formatMXN(c.cuotaMin)}</strong></span>}
                </span>}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 10 }}>
                  <Campo label="Cuota mín $">
                    <Input type="number" min="0" step="1000" defaultValue={c.cuotaMin || ''} placeholder="0" readOnly={!canEdit} style={MONO}
                      onBlur={(e) => { if (!canEdit) return; const v = Number(e.target.value) || 0; if (v !== c.cuotaMin) guardarSpiffDicoConfig({ mesKey, cuota_min: v }); }} />
                  </Campo>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <Campo key={i} label={`Premio #${i + 1}`}>
                      <Input type="text" defaultValue={c.premios[i] || ''} placeholder="Ej. Tarjeta $500" readOnly={!canEdit}
                        onBlur={(e) => { if (!canEdit) return; const nuevos = [...c.premios]; nuevos[i] = e.target.value.trim(); if (nuevos[i] !== (c.premios[i] || '')) guardarSpiffDicoConfig({ mesKey, premios: nuevos }); }} />
                    </Campo>
                  ))}
                </div>
                {c.ganadores.length > 0 ? (
                  <TablaCompacta dense columnas={[
                    { key: 'posicion', label: '#', align: 'center', width: 40, render: (g) => {
                      const bg = g.posicion === 1 ? (theme.yellow || theme.orange) : g.posicion === 2 ? theme.textSubtle : g.posicion === 3 ? theme.orange : theme.border;
                      return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, background: bg, color: g.posicion <= 3 ? '#000' : theme.textMuted, ...MONO, fontSize: 10.5, fontWeight: 700 }}>{g.posicion}</span>;
                    } },
                    { key: 'nombre', label: 'Vendedor', align: 'left', bold: true },
                    { key: 'monto', label: 'Sell-out', align: 'right', render: (g) => <span style={{ fontWeight: 600 }}>{formatMXN(g.monto)}</span> },
                    { key: 'premio', label: 'Premio', align: 'left', render: (g) => (g.premio ? g.premio : <span style={{ color: theme.textSubtle || theme.textMuted, fontStyle: 'italic' }}>— sin definir —</span>) },
                  ]} filas={c.ganadores} rowKey={(g) => g.posicion} />
                ) : sinData ? (
                  <Nota style={{ padding: 12, textAlign: 'center', border: `1px dashed ${theme.border}`, borderRadius: 10 }}>Sin datos de Revko para este mes. Sube el archivo semanal en <code style={{ fontFamily: TYPO.fontDisplay }}>/uploads.html</code>.</Nota>
                ) : (
                  <Nota style={{ padding: 12, textAlign: 'center', border: `1px solid ${theme.orange}55`, borderRadius: 10, color: theme.orange }}>Hay {c.vendedoresMes.length} vendedores pero ninguno supera la cuota mínima de {formatMXN(c.cuotaMin)}. Baja la cuota o revisa la data.</Nota>
                )}
              </Panel>
            );
          })}
        </div>
        <Nota style={{ marginTop: 8 }}>Premios de texto libre (tarjetas, productos, dinero…). Se guardan por mes en Supabase con historial auditable. Los pagos a vendedores se registran fuera del sistema.</Nota>
      </Panel>
    </div>
  );
}

// ═══ PCEL · mensual % fijo ═══
export function SpiffPcel({ pcelCalc, SPIFF_PCT, pcelOverrideSpiff, setPcelOverrideSpiff, pcelPagosReg, showPagoForm, setShowPagoForm, pagoFormData, setPagoFormData, guardarPagoPcel, canEdit, anio }) {
  const { theme } = useTheme();
  const filas = pcelCalc.monthly.map((r) => {
    const isApproved = pcelOverrideSpiff[r.mes] === 'approved';
    const meetsQuota = r.alcance >= 0.9;
    const shouldPay = r.sellIn > 0 && (meetsQuota || isApproved);
    const spiffAmt = shouldPay ? r.sellIn * SPIFF_PCT : 0;
    const pagoReg = pcelPagosReg.find((p) => p.categoria === 'spiff' && p.folio && p.folio.includes('M' + r.mes + '-'));
    return { ...r, isApproved, meetsQuota, shouldPay, spiffAmt, pagoReg, formKey: 'spiff-M' + r.mes };
  });
  const total = filas.reduce((s, r) => s + r.spiffAmt, 0);
  const columnas = [
    { key: 'mes', label: 'Mes', align: 'left', render: (r) => <span style={{ fontWeight: 600 }}>{MESES_CORTOS[r.mes - 1]}</span> },
    { key: 'sellIn', label: 'Sell In', align: 'right', render: (r) => (r.sellIn > 0 ? formatMXN(r.sellIn) : '—') },
    { key: 'cuota', label: 'Cuota', align: 'right', render: (r) => <span style={{ color: theme.textMuted }}>{r.cuota > 0 ? formatMXN(r.cuota) : '—'}</span> },
    { key: 'alcance', label: 'Alcance %', align: 'right', render: (r) => (r.sellIn > 0 ? <span style={{ fontWeight: 700, color: r.alcance >= 1.2 ? theme.green : r.alcance >= 0.9 ? theme.accent : theme.red }}>{(r.alcance * 100).toFixed(1)}%</span> : '—') },
    { key: 'spiffAmt', label: 'SPIFF', align: 'right', render: (r) => <span style={{ fontWeight: 700, color: r.shouldPay ? (r.isApproved && !r.meetsQuota ? theme.orange : theme.purple) : theme.textMuted }}>{r.shouldPay ? formatMXN(r.spiffAmt) + (!r.meetsQuota && r.isApproved ? ' *' : '') : r.sellIn > 0 ? '$0' : '—'}</span> },
    { key: '_aprobar', label: 'Aprobar', align: 'center', render: (r) => (r.sellIn > 0 && !r.meetsQuota
      ? <Pill tone={r.isApproved ? 'orange' : 'gray'} size="xs" onClick={canEdit ? () => setPcelOverrideSpiff((prev) => ({ ...prev, [r.mes]: prev[r.mes] === 'approved' ? '' : 'approved' })) : undefined}>{r.isApproved ? '✓ Aprobado' : 'Pagar'}</Pill>
      : r.sellIn > 0 ? <Pill tone="green" dot size="xs">Cuota</Pill> : null) },
    { key: '_reg', label: 'Registro', align: 'center', render: (r) => r.pagoReg
      ? <Pill tone={r.pagoReg.estatus === 'pagado' ? 'green' : 'orange'} dot>{r.pagoReg.estatus === 'pagado' ? 'Pagado' : 'Por pagar'}</Pill>
      : r.shouldPay && canEdit ? <Boton onClick={() => setShowPagoForm(showPagoForm === r.formKey ? null : r.formKey)}>+ Registrar</Boton> : null },
  ];
  return (
    <Panel titulo={`SPIFF mensual ${anio}`} meta={`${(SPIFF_PCT * 100).toFixed(2)}% sobre Sell In`}
      acciones={<><span style={{ fontSize: 10, color: theme.textMuted }}>Total</span><span style={{ ...MONO, fontSize: 12.5, fontWeight: 600, color: theme.purple }}>{formatMXN(total)}</span></>}>
      <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.mes} totales={{ sellIn: pcelCalc.totalSellIn, spiffAmt: total }}
        renderExpandido={(r) => <PcelPagoForm periodoLabel={MESES_LARGOS[r.mes - 1]} monto={r.spiffAmt} pagoFormData={pagoFormData} setPagoFormData={setPagoFormData} onSave={() => guardarPagoPcel('spiff', 'M' + r.mes, r.spiffAmt)} onCancel={() => setShowPagoForm(null)} />}
        expandidoKey={showPagoForm && String(showPagoForm).startsWith('spiff-M') ? Number(String(showPagoForm).replace('spiff-M', '')) : null} />
      <Nota style={{ marginTop: 6 }}>* Aprobado manualmente sin llegar a cuota.</Nota>
    </Panel>
  );
}
