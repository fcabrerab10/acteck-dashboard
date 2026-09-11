// Drill del SKU (fila expandida de la tabla S&OP). Conserva el simulador what-if, el KPI strip, el consumo por cliente
// (heatmap Pareto 80 %) y la lista de tránsito; V3 añade demanda real 12 m vs ritmo del motor (Recharts), cobertura
// proyectada mes a mes (6 m, stock + tránsito por ETA + compra simulada − demanda proyectada) y "Quién lo compra"
// (useQuienLoCompra de inventario/compartir.js). Costos sólo con `sensible`. Sin Tailwind; sólo tokens de tema + kit.
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { Pill, HeatCell, TablaCompacta, Cargando, GraficaLineas } from '../../../components/kit';
import { roadmapTone } from '../sellin/textos';
import { fmtInt, fmtDias, fmtCompact, tonoCobertura, etiquetaCobertura, MONO } from '../inventario/constantes';
import { useQuienLoCompra } from '../inventario/compartir';

const MES_CORTO = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const fmtFechaC = (iso) => {
  if (!iso) return '—';
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  if (!y || !m) return '—';
  return `${d} ${MES_CORTO[m - 1]} ${String(y).slice(2)}`;
};
const usd2 = (n) => `$${Number(n || 0).toFixed(2)}`;
const usd0 = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

const ESTATUS_PILL = {
  'TRANSITO MARITIMO': { tone: 'blue', label: 'TRÁNSITO' },
  'PROXIMO A ZARPAR': { tone: 'orange', label: 'ZARPARÁ' },
  'EN PRODUCCION': { tone: 'gray', label: 'PRODUCCIÓN' },
  'EN RESGUARDO': { tone: 'blue', label: 'RESGUARDO' },
  'EN ESPERA DE CONSOLIDAR': { tone: 'gray', label: 'CONSOLIDAR' },
  'PENDIENTE MODULAR': { tone: 'orange', label: 'PENDIENTE' },
};

/** Últimos 12 meses (mes actual incluido) [{ anio, mes, key, label }]. */
function meses12(hoy = new Date()) {
  const out = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MES_CORTO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` });
  }
  return out;
}
/** Próximos n meses a partir del siguiente [{ anio, mes, key, label, fin }]. */
function mesesFuturos(n, hoy = new Date()) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + i, 1);
    out.push({ anio: d.getFullYear(), mes: d.getMonth() + 1, key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: `${MES_CORTO[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`, fin: new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59) });
  }
  return out;
}

function MiniKpi({ label, value, u, sub, color, borderLeft, dim }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '2px 12px', borderLeft: borderLeft ? `1px solid ${theme.divider || theme.border}` : 'none', minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 4 }}>{label}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: dim ? 16 : 19, fontWeight: dim ? 500 : 600, letterSpacing: '-0.02em', lineHeight: 1, color: color || (dim ? theme.textMuted : theme.text), fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
        {value}
        {u && <span style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, fontWeight: 500, marginLeft: 3 }}>{u}</span>}
      </div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

function SimKpi({ lbl, val, valU, valColor, sub, subDim }) {
  const { theme } = useTheme();
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 1 }}>{lbl}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.02em', color: valColor || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
        {val}{valU && <span style={{ fontFamily: TYPO.fontText, fontSize: 9, color: theme.textMuted, fontWeight: 500, marginLeft: 2 }}>{valU}</span>}
      </div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 9, color: subDim ? theme.textMuted : theme.green, fontWeight: subDim ? 500 : 600, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  );
}

function SimField({ lbl, val, sub, mono, color, truncate }) {
  const { theme } = useTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 1 }}>{lbl}</div>
      <div title={truncate ? String(val) : undefined} style={{ fontFamily: mono ? MONO : TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: mono ? 0 : '-0.01em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.2, ...(truncate ? { whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' } : {}) }}>{val}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 8.5, color: theme.textMuted, fontWeight: 500, lineHeight: 1.2 }}>{sub}</div>}
    </div>
  );
}

function QtyBtn({ children, onClick }) {
  const { theme } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ width: 22, height: 22, borderRadius: 6, border: `1px solid ${theme.border}`, background: theme.surface, fontSize: 12, color: theme.text, cursor: 'pointer', fontFamily: TYPO.fontDisplay, fontWeight: 600, lineHeight: 1 }}>{children}</button>
  );
}

function Tarjeta({ titulo, meta, aside, children, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 12px', minWidth: 0, ...style }}>
      {(titulo || aside) && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{titulo}</div>
            {meta && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{meta}</div>}
          </div>
          {aside}
        </div>
      )}
      {children}
    </div>
  );
}

export default function DrillSku({ r, enExport, cantidadEnExport, onAgregarSolicitud, puedeEditar, sensible, facturacion, metaBySku }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const hair = `1px solid ${theme.divider || theme.border}`;

  // Simulador what-if: cantidad a comprar (inicia con lo del export si ya existe, sino el sugerido, sino 1 contenedor)
  const cntPz = Number(r.piezasPorContenedor || 0);
  const qtyInicial = Number(cantidadEnExport || r.sugerido || cntPz || 0);
  const [qty, setQty] = useState(qtyInicial);
  useEffect(() => { setQty(qtyInicial); /* eslint-disable-next-line */ }, [r.sku, cantidadEnExport]);
  const [mostrarOtros, setMostrarOtros] = useState(false);

  const costoUnit = Number(r.ultimoCostoUsd || 0);
  const usdComprometido = qty * costoUnit;
  const demandaMesTotalReal = Number(r.demandaMesErp || 0);
  const demDia = demandaMesTotalReal / 30;
  const cobHoy = demDia > 0 ? r.inv / demDia : null;
  const cobPost = demDia > 0 ? (r.inv + qty) / demDia : null;
  const gananciaDias = cobPost != null && cobHoy != null ? cobPost - cobHoy : null;
  const ltDias = Number(r.ltDias || 0);
  const diasParaProxOc = cobPost != null ? Math.max(0, cobPost - ltDias) : null;
  const proxOcFecha = diasParaProxOc != null ? new Date(Date.now() + diasParaProxOc * 86400000) : null;
  const proxOcLabel = proxOcFecha ? `${MES_CORTO[proxOcFecha.getMonth()]} ${proxOcFecha.getFullYear()}` : '—';

  const CLIENTE_COLORS = [theme.accent, theme.purple, theme.teal, theme.orange, theme.pink, theme.indigo, theme.yellow, theme.green, theme.red];
  const erpClientes = Array.isArray(r.demandaPorClienteErp) ? r.demandaPorClienteErp : [];

  const presets = cntPz > 0 ? [0, cntPz, cntPz * 2, cntPz * 3] : [0, 500, 1000, 2000];
  const presetLabels = cntPz > 0 ? ['0', '1 cnt', '2 cnt', '3 cnt'] : ['0', '500 pz', '1,000 pz', '2,000 pz'];
  const onConfirmar = () => onAgregarSolicitud?.({ ...r, __qtySimulada: qty });

  // ── (a) Demanda real 12 m (facturacion_clientes) vs ritmo del motor ──
  const ritmo3m = Number(r.ritmo3m || 0);
  const crec = Number(r.crecimientoPct || 0);
  const demProy = (ritmo3m > 0 ? ritmo3m : demandaMesTotalReal) * (1 + crec);
  const serieDemanda = useMemo(() => {
    const m12 = meses12();
    const porMes = new Map(m12.map((m) => [m.key, 0]));
    (facturacion || []).forEach((f) => {
      if (String(f.sku || '').trim() !== r.sku) return;
      const k = `${f.anio}-${Number(f.mes)}`;
      if (porMes.has(k)) porMes.set(k, porMes.get(k) + Number(f.piezas || 0));
    });
    const reales = m12.map((m, i) => ({ label: m.label, real: Math.round(porMes.get(m.key)), motor: i >= 9 ? Math.round(ritmo3m) : null, futuro: false }));
    const futuros = mesesFuturos(3).map((m) => ({ label: m.label, real: null, motor: Math.round(demProy), futuro: true }));
    return [...reales, ...futuros];
  }, [facturacion, r.sku, ritmo3m, demProy]);
  const total12m = serieDemanda.reduce((a, p) => a + (p.real || 0), 0);

  // ── (b) Cobertura proyectada 6 meses: stock + tránsito por ETA (+ compra simulada al lead time) − demanda proyectada ──
  const coberturaProy = useMemo(() => {
    const hoy = new Date();
    const llegadaSim = qty > 0 && ltDias > 0 ? new Date(hoy.getTime() + ltDias * 86400000) : null;
    return mesesFuturos(6).map((m, i) => {
      const traHasta = (r.embarques || []).reduce((a, e) => (e.eta && new Date(e.eta) <= m.fin ? a + Number(e.cantidad || 0) : a), 0);
      const sim = llegadaSim && llegadaSim <= m.fin ? qty : 0;
      const stock = Number(r.inv || 0) + traHasta + sim - demProy * (i + 1);
      const dias = demProy > 0 ? stock / (demProy / 30) : null;
      return { ...m, stock, dias, traHasta, sim };
    });
  }, [r.inv, r.embarques, demProy, qty, ltDias]);

  // ── (c) Quién lo compra (sell in 6 m por cliente/canal · carga sólo al abrir) ──
  const { datos: compra, cargando: cargandoCompra } = useQuienLoCompra(r.sku, true);
  const colsCompra = [
    { key: 'cliente', label: 'Cliente', align: 'left', maxWidth: 200, render: (c) => <span title={c.cliente} style={{ fontFamily: TYPO.fontDisplay, fontWeight: c.otros ? 400 : 500, color: c.otros ? theme.textMuted : theme.text }}>{c.cliente}</span> },
    { key: 'canal', label: 'Canal', align: 'left', render: (c) => (c.canal ? <Pill tone="gray" size="xs">{c.canal}</Pill> : '—') },
    { key: 'piezas', label: 'Piezas', width: 64, render: (c) => fmtInt(c.piezas), renderTotal: (v) => fmtInt(v) },
    { key: 'monto', label: 'Facturado', width: 80, render: (c) => fmtCompact(c.monto), renderTotal: (v) => fmtCompact(v) },
    { key: 'share', label: '% pz', width: 52, render: (c) => (compra?.totalPz > 0 ? <span style={{ color: theme.textMuted }}>{((c.piezas / compra.totalPz) * 100).toFixed(0)}%</span> : '—') },
    { key: 'meses', label: 'Meses', width: 50, render: (c) => (c.otros ? '—' : `${c.meses}/6`) },
  ];

  const ejeTick = { fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontDisplay };
  const tooltipStyle = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text, boxShadow: 'none' };

  const uc = r.ultimaCompra || {};
  const ltDecl = Number(uc.ltDeclarado || 0);
  const ltMostrar = ltDecl > 0 ? ltDecl : ltDias;
  const ltSub = ltDecl > 0 ? 'declarado en PO' : ltDias > 0 ? `${r.ltMuestras || 0} OCs · calculado` : '';
  const cbmU = Number(uc.cbmUnitario || 0);
  const tipoCargaShort = uc.tipoCarga ? String(uc.tipoCarga).slice(0, 8) : '—';
  const cob = r.coberturaDiasErp;
  const cobColor = cob == null ? null : cob < 30 ? theme.red : cob < 60 ? theme.orange : theme.green;

  return (
    <div style={{ padding: 10, background: theme.bg, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: TYPO.fontText, animation: `sopDrillOpen ${DUR.page}ms ${EASE} both`, transformOrigin: 'top' }}>
      <style>{`@keyframes sopDrillOpen { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }`}</style>

      {/* Cabecera compacta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 4px' }}>
        <span style={{ fontFamily: MONO, fontSize: 12, fontWeight: 600, color: theme.accent }}>{r.sku}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }} title={r.descripcion}>{r.descripcion || r.sku}</span>
        {r.roadmapEstado && <Pill tone={roadmapTone(r.roadmapEstado)} size="xs">{r.roadmapEstado}</Pill>}
        {r.familia && <Pill tone="gray" size="xs">{r.familia}</Pill>}
        <Pill tone="gray" size="xs">{r.marca || 'Sin marca'} · {r.supplier || 'Sin proveedor'}</Pill>
        {cntPz > 0
          ? <Pill tone="blue" size="xs">1 cnt = {fmtInt(cntPz)} pz</Pill>
          : (r.tieneCompras && <Pill tone="orange" size="xs" title="Todas las compras históricas fueron consolidadas — aún no se ha comprado un contenedor completo de este SKU">sin contenedor completo aún</Pill>)}
        {sensible && costoUnit > 0 && <Pill tone="green" size="xs">{usd2(costoUnit)} USD</Pill>}
        {r.esCritico && <Pill tone="yellow" size="xs">⭐ crítico</Pill>}
      </div>

      {/* KPI strip */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: '10px 4px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(0, 1fr))' }}>
          <MiniKpi label="Inventario" value={fmtInt(r.inv)} u="pz" sub="stock comercial" />
          <MiniKpi label="Tránsito" value={fmtInt(r.traCant)} u="pz" sub={r.traCant > 0 ? 'en camino' : 'sin POs'} borderLeft />
          <MiniKpi label="Próximo arribo" value={r.traEta ? fmtFechaC(r.traEta).split(' ').slice(0, 2).join(' ') : '—'} sub={r.traEta ? 'próxima OC' : 'sin OC'} borderLeft dim={!r.traEta} />
          <MiniKpi label="Demanda 3m" value={fmtInt(r.demandaMesErp)} u="pz/m" sub={`${erpClientes.length} clientes ERP`} borderLeft />
          <MiniKpi label="Días inv." value={cob == null ? '∞' : Math.round(cob)} u={cob == null ? '' : 'd'} sub={cob == null ? 'sin demanda' : cob < 30 ? 'crítica' : cob < 60 ? 'tensa' : 'holgura sana'} color={cobColor} borderLeft />
          <MiniKpi label="Sugerido" value={r.sugerido > 0 ? fmtInt(r.sugerido) : '—'} u={r.sugerido > 0 ? 'pz' : ''} sub={r.sugerido > 0 ? `${r.contenedoresSugeridos || 1} cnt` : 'sin brecha'} color={r.sugerido > 0 ? theme.orange : null} borderLeft dim={r.sugerido <= 0} />
        </div>
      </div>

      {/* Simulador */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.accent}33`, borderRadius: 10, padding: '7px 12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: sensible ? 'auto auto 1fr auto auto auto auto auto' : 'auto auto 1fr auto auto auto auto', gap: 10, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.accent, marginBottom: 1 }}>Simulador</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <QtyBtn onClick={() => setQty((q) => Math.max(0, q - (cntPz || 100)))}>−</QtyBtn>
              <input type="text" value={qty > 0 ? qty.toLocaleString('es-MX') : '0'} aria-label="Cantidad a simular"
                onChange={(e) => { const raw = String(e.target.value).replace(/[^0-9]/g, ''); setQty(raw ? Number(raw) : 0); }}
                style={{ width: 74, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', border: 0, background: 'transparent', outline: 'none' }} />
              <QtyBtn onClick={() => setQty((q) => q + (cntPz || 100))}>+</QtyBtn>
            </div>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 9, color: theme.textMuted, fontWeight: 500, textAlign: 'center' }}>
              pz{cntPz > 0 ? ` · ${(qty / cntPz).toFixed(qty % cntPz === 0 ? 0 : 1)} cnt` : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {presets.map((v, i) => (
              <button key={i} type="button" onClick={() => setQty(v)}
                style={{ padding: '4px 7px', borderRadius: 6, border: `1px solid ${qty === v ? theme.text : theme.border}`, background: qty === v ? theme.text : 'transparent', color: qty === v ? theme.bg : theme.textMuted, fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: `background ${DUR.state}ms ${EASE}` }}>
                {presetLabels[i]}
              </button>
            ))}
          </div>
          <div />
          <div style={{ width: 1, height: 24, background: theme.divider || theme.border }} />
          {sensible && <SimKpi lbl="USD" val={usdComprometido > 0 ? usd0(usdComprometido) : '—'} sub="al últ. costo" subDim />}
          <SimKpi lbl="Cobertura" val={cobPost != null ? Math.round(cobPost) : '—'} valU="d" sub={gananciaDias != null ? `↑ +${Math.round(gananciaDias)} d` : ''} valColor={theme.green} />
          <SimKpi lbl="Próx. OC" val={proxOcLabel.split(' ')[0]} valU={proxOcLabel.split(' ')[1] || ''} sub={diasParaProxOc != null ? `~${Math.round(diasParaProxOc)} d` : ''} subDim />
          <button type="button" onClick={onConfirmar} disabled={!puedeEditar}
            style={{ padding: '6px 12px', borderRadius: 999, background: enExport ? theme.green : theme.accent, color: '#FFF', border: 0, fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, cursor: puedeEditar ? 'pointer' : 'not-allowed', opacity: puedeEditar ? 1 : 0.5, whiteSpace: 'nowrap' }}>
            {enExport ? 'Actualizar cantidad' : 'Agregar al export'}
          </button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: sensible ? '2fr 1fr 1fr 1fr 1fr 1fr 1fr' : '2fr 1fr 1fr 1fr 1fr', gap: 10, paddingTop: 6, marginTop: 7, borderTop: hair, alignItems: 'baseline' }}>
          <SimField lbl="Proveedor" val={r.supplier || '—'} sub={r.ltMuestras > 0 ? `${r.ltMuestras} OCs históricas` : 'sin histórico'} truncate />
          {sensible && <SimField lbl="Costo prom USD" val={r.costoPromedioUsd > 0 ? usd2(r.costoPromedioUsd) : '—'} mono />}
          {sensible && <SimField lbl="Últ. costo USD" val={r.ultimoCostoUsd > 0 ? usd2(r.ultimoCostoUsd) : '—'} mono color={theme.green} />}
          <SimField lbl="Pz / cnt" val={cntPz > 0 ? fmtInt(cntPz) : (r.tieneCompras ? '—' : 'sin data')} sub={cntPz > 0 ? '' : (r.tieneCompras ? 'sin contenedor completo aún' : '')} mono color={cntPz > 0 ? theme.text : theme.orange} />
          <SimField lbl="Lead time" val={ltMostrar > 0 ? `${Math.round(ltMostrar)} d` : '—'} sub={ltSub} mono color={ltDecl > 0 ? theme.text : theme.textMuted} />
          <SimField lbl="Tipo carga" val={tipoCargaShort} sub={uc.tipoContenedor || ''} />
          <SimField lbl="CBM unit" val={cbmU > 0 ? cbmU.toFixed(3) : '—'} sub={cbmU > 0 && cntPz > 0 ? `${(cbmU * cntPz).toFixed(1)} m³ por cnt` : ''} mono />
        </div>
        {r.esConsolidado && r.tieneCompras && <div style={{ fontSize: 10, color: theme.orange, fontStyle: 'italic', marginTop: 6 }}>Comparte contenedor con otros SKUs (consolidado)</div>}
      </div>

      {/* (a) Demanda 12 m vs motor · (b) Cobertura proyectada */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 8 }}>
        <Tarjeta titulo="Demanda real 12 meses vs ritmo del motor" meta={`facturacion_clientes · ${fmtInt(total12m)} pz en 12 m · línea = ritmo 3 m${crec > 0 ? ` y proyección +${Math.round(crec * 100)}%` : ''}`}
          aside={<Pill tone="blue" size="xs">{fmtInt(demProy)} pz/m proyectado</Pill>}>
          <GraficaLineas datos={serieDemanda.map((d) => ({ x: d.label, real: d.real, motor: d.motor }))}
            series={[{ key: 'real', label: 'Real ERP', tipo: 'principal' }, { key: 'motor', label: 'Motor S&OP', tipo: 'linea', color: theme.orange, dash: '4 3' }]}
            formato={(v) => `${fmtInt(v)} pz`} alto={170} />
        </Tarjeta>
        <Tarjeta titulo="Cobertura proyectada" meta={`stock + tránsito por ETA${qty > 0 && ltDias > 0 ? ` + ${fmtInt(qty)} pz simuladas (${Math.round(ltDias)} d)` : ''} − ${fmtInt(demProy)} pz/m`}>
          {demProy <= 0 ? (
            <div style={{ fontSize: 11.5, color: theme.textMuted, padding: '10px 0' }}>Sin demanda ERP: la cobertura no se puede proyectar.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {coberturaProy.map((m) => (
                <div key={m.key} style={{ display: 'grid', gridTemplateColumns: '58px 1fr auto', gap: 8, alignItems: 'center', fontSize: 11 }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em', color: theme.text, fontSize: 10.5 }}>{m.label}</span>
                  <span style={{ color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {m.stock >= 0 ? `${fmtInt(m.stock)} pz` : `faltan ${fmtInt(-m.stock)} pz`}
                    {m.traHasta > 0 && <span> · +{fmtInt(m.traHasta)} tránsito</span>}
                    {m.sim > 0 && <span style={{ color: theme.accent }}> · +{fmtInt(m.sim)} sim</span>}
                  </span>
                  <Pill tone={tonoCobertura(m.stock > 0 ? m.dias : null, m.stock > 0)} size="xs" title={etiquetaCobertura(m.stock > 0 ? m.dias : null, m.stock > 0)}>
                    {m.stock > 0 ? fmtDias(m.dias) : 'agotado'}
                  </Pill>
                </div>
              ))}
            </div>
          )}
        </Tarjeta>
      </div>

      {/* Consumo por cliente · heatmap Pareto 80 % (6 m) */}
      <Tarjeta titulo="Consumo por cliente" meta={`${erpClientes.length} clientes ERP · 6 m · intensidad = mes vs. pico del cliente · corte 80 %`}
        aside={<Pill tone="orange" size="xs">Pareto 80%</Pill>}>
        {erpClientes.length === 0 ? (
          <div style={{ padding: '14px 0', color: theme.textMuted, fontSize: 12, textAlign: 'center' }}>
            Sin ventas registradas en el ERP en los últimos 6 meses
            <div style={{ marginTop: 3, color: theme.textSubtle || theme.textMuted, fontSize: 10.5 }}>este SKU no ha facturado en el periodo</div>
          </div>
        ) : (() => {
          const mesesCol = (erpClientes[0] && erpClientes[0].mensual) || [];
          const totalesMes = mesesCol.map((m, idx) => erpClientes.reduce((a, c) => a + Number(c.mensual[idx]?.piezas || 0), 0));
          const total6mGrand = totalesMes.reduce((a, b) => a + b, 0);
          const ordenados = erpClientes.map((c) => ({ ...c, pctSku: total6mGrand > 0 ? (c.total6m / total6mGrand) * 100 : 0 }));
          let acum = 0, cortePareto = 0;
          for (let i = 0; i < ordenados.length; i++) {
            acum += ordenados[i].pctSku; ordenados[i].pctAcum = acum;
            if (acum < 80) cortePareto = i + 1;
            else if (cortePareto === 0) { cortePareto = i + 1; break; }
          }
          const pareto = ordenados.slice(0, cortePareto);
          const cola = ordenados.slice(cortePareto);
          const colaMensual = mesesCol.map((m, idx) => ({ key: m.key, piezas: cola.reduce((a, x) => a + Number(x.mensual[idx]?.piezas || 0), 0) }));
          const colaTotal6m = colaMensual.reduce((a, x) => a + x.piezas, 0);
          const colaPct = total6mGrand > 0 ? (colaTotal6m / total6mGrand) * 100 : 0;
          const totalMaxMes = Math.max(0, ...totalesMes);
          const th = { padding: '5px 6px', fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: hair, textAlign: 'right', whiteSpace: 'nowrap' };
          const td = { padding: '4px 6px', textAlign: 'right', verticalAlign: 'middle', borderBottom: hair };
          const numPill = (v, strong) => (Number(v) > 0 ? <Pill tone="blue" size="xs" style={{ minWidth: 34, justifyContent: 'center', fontWeight: strong ? 700 : 500 }}>{fmtInt(v)}</Pill> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>);
          const pctPill = (p) => <Pill tone="orange" size="xs" style={{ minWidth: 32, justifyContent: 'center' }}>{p >= 1 ? `${Math.round(p)}%` : p > 0 ? `${p.toFixed(1)}%` : '—'}</Pill>;
          const fila = (p, i, esMenor = false) => {
            const maxCli = Math.max(0, ...p.mensual.map((m) => Number(m.piezas || 0)));
            const color = CLIENTE_COLORS[i % CLIENTE_COLORS.length];
            return (
              <tr key={`c-${i}-${p.cliente}`}>
                <td style={{ ...td, textAlign: 'left', fontFamily: MONO, fontSize: 10, color: theme.textMuted, width: 22 }}>{i + 1}</td>
                <td style={{ ...td, textAlign: 'left' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, paddingLeft: esMenor ? 12 : 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 50, background: color, flex: '0 0 6px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 230 }}>{p.cliente}</div>
                      {p.canal && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginTop: 1 }}>{p.canal}</div>}
                    </div>
                  </div>
                </td>
                {p.mensual.map((m, mi) => <td key={mi} style={td}><HeatCell v={m.piezas} max={maxCli} /></td>)}
                <td style={td}>{numPill(p.prom6m)}</td>
                <td style={td}>{numPill(p.total6m, true)}</td>
                <td style={td}>{pctPill(p.pctSku)}</td>
                <td style={{ ...td, fontFamily: MONO, fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{(p.pctAcum ?? 0).toFixed(1)}%</td>
              </tr>
            );
          };
          return (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', width: 22 }}>#</th>
                    <th style={{ ...th, textAlign: 'left' }}>Cliente</th>
                    {mesesCol.map((m, i) => <th key={i} style={th}>{MES_CORTO[m.mes - 1]}</th>)}
                    <th style={th}>Prom /m</th><th style={th}>Total 6m</th><th style={th}>%</th><th style={th}>Acum</th>
                  </tr>
                </thead>
                <tbody>
                  {pareto.map((p, i) => fila(p, i))}
                  {cola.length > 0 && (
                    <tr>
                      <td colSpan={mesesCol.length + 6} style={{ padding: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px', borderTop: `1px dashed ${theme.orange}`, borderBottom: `1px dashed ${theme.orange}` }}>
                          <Pill tone="orange" size="xs">Corte Pareto · 80%</Pill>
                          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted }}>{pareto.length} cliente{pareto.length === 1 ? '' : 's'} concentran el {(pareto[pareto.length - 1]?.pctAcum ?? 0).toFixed(1)}% de la venta</span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {cola.length > 0 && (
                    <tr onClick={() => setMostrarOtros(!mostrarOtros)} style={{ cursor: 'pointer', background: theme.surfaceHover || 'transparent' }}>
                      <td style={{ ...td, textAlign: 'left', color: theme.accent, fontFamily: MONO, fontSize: 10 }}>{mostrarOtros ? '▾' : '▸'}</td>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.accent }}>Cola larga · {cola.length} cliente{cola.length === 1 ? '' : 's'} menores</div>
                        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginTop: 1 }}>{(100 - (pareto[pareto.length - 1]?.pctAcum ?? 80)).toFixed(1)}% restante · click para {mostrarOtros ? 'colapsar' : 'expandir'}</div>
                      </td>
                      {colaMensual.map((m, mi) => <td key={mi} style={td}><HeatCell v={m.piezas} max={Math.max(0, ...colaMensual.map((x) => x.piezas))} /></td>)}
                      <td style={td}>{numPill(colaTotal6m / 6)}</td>
                      <td style={td}>{numPill(colaTotal6m, true)}</td>
                      <td style={td}>{pctPill(colaPct)}</td>
                      <td style={{ ...td, fontFamily: MONO, fontSize: 10, color: theme.textMuted }}>100.0%</td>
                    </tr>
                  )}
                  {mostrarOtros && cola.map((p, i) => fila(p, pareto.length + i, true))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={2} style={{ ...td, textAlign: 'left', borderBottom: 0, borderTop: hair, fontFamily: TYPO.fontDisplay, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>Total {erpClientes.length} clientes</td>
                    {totalesMes.map((v, i) => <td key={i} style={{ ...td, borderBottom: 0, borderTop: hair }}><HeatCell v={v} max={totalMaxMes} /></td>)}
                    <td style={{ ...td, borderBottom: 0, borderTop: hair }}>{numPill(total6mGrand / 6, true)}</td>
                    <td style={{ ...td, borderBottom: 0, borderTop: hair }}>{numPill(total6mGrand, true)}</td>
                    <td style={{ ...td, borderBottom: 0, borderTop: hair, fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 700 }}>100%</td>
                    <td style={{ ...td, borderBottom: 0, borderTop: hair }} />
                  </tr>
                </tfoot>
              </table>
            </div>
          );
        })()}
      </Tarjeta>

      {/* Tránsito · Quién lo compra */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 8 }}>
        <Tarjeta titulo="Tránsito" meta="próximos shipments" aside={<span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{(r.embarques || []).length}<span style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, fontWeight: 500, marginLeft: 3 }}>POs</span></span>}>
          {(r.embarques || []).length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {r.embarques.slice(0, 6).map((e, i) => {
                const p = e.prog || null;
                const est = String(e.estatus || '').toUpperCase();
                const pill = ESTATUS_PILL[est] || { tone: 'gray', label: est || 'OTRO' };
                return (
                  <div key={i} style={{ padding: '7px 0', borderTop: i > 0 ? hair : 'none' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center', fontSize: 11 }}>
                      <Pill tone={pill.tone} size="xs">{pill.label}</Pill>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {e.po ? `PO-${e.po}` : '—'} · <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 700 }}>{fmtInt(e.cantidad)}</strong> pz
                        {e.contenedor && <> · <span style={{ color: theme.textSubtle || theme.textMuted }}>{e.contenedor}</span></>}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 10.5, color: theme.textMuted }}>{fmtFechaC(e.eta)}</span>
                    </div>
                    {p && (
                      <div style={{ marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap', fontSize: 10, color: theme.textSubtle || theme.textMuted }}>
                        {p.terminal && <span>📍 {p.terminal}</span>}
                        {p.cita && <span>🕒 cita {fmtFechaC(p.cita)}</span>}
                        {p.arribo_almacen && <span style={{ color: theme.text }}>✓ almacén {fmtFechaC(p.arribo_almacen)}</span>}
                        {p.linea_transportista && <span>🚚 {p.linea_transportista}</span>}
                        {Number(p.dias_demoras) > 0 && <span style={{ color: theme.orange, fontWeight: 600 }}>⚠ {p.dias_demoras}d demora</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '12px 0', color: theme.textMuted, fontSize: 11.5, textAlign: 'center' }}>
              Sin tránsito programado<div style={{ marginTop: 3, color: theme.textSubtle || theme.textMuted, fontSize: 10.5 }}>no hay compras en camino</div>
            </div>
          )}
        </Tarjeta>
        <Tarjeta titulo="Quién lo compra" meta={compra && compra.nClientes > 0
          ? `sell in últimos 6 meses · ${fmtInt(compra.nClientes)} cliente${compra.nClientes === 1 ? '' : 's'} · ${fmtInt(compra.totalPz)} pz${compra.porCanal.length ? ` · ${compra.porCanal.slice(0, 3).map((c) => `${c.canal} ${compra.totalPz > 0 ? Math.round((c.piezas / compra.totalPz) * 100) : 0}%`).join(' · ')}` : ''}`
          : cargandoCompra ? 'cargando sell in…' : 'sin sell in en los últimos 6 meses'}>
          {cargandoCompra && <Cargando pantalla="sopDrill" minHeight={120} />}
          {!cargandoCompra && compra && compra.filas.length > 0 && <TablaCompacta columnas={colsCompra} filas={compra.filas} rowKey={(c) => c.cliente} dense totales={{ piezas: compra.totalPz, monto: compra.totalMonto }} />}
        </Tarjeta>
      </div>

      {(r.canibalizacion || r.preventaDeficit > 0) && (
        <div style={{ background: `${theme.orange}0F`, borderLeft: `3px solid ${theme.orange}`, padding: '8px 12px', borderRadius: 6, fontSize: 11.5, lineHeight: 1.5, color: theme.text }}>
          {r.canibalizacion && <div><b>⚠ Canibalización</b> · {r.canibalizacion.mensaje || 'Este SKU compite con otro de la misma familia (Digitalife y PCEL con demanda).'}</div>}
          {r.preventaDeficit > 0 && <div style={{ marginTop: 4 }}><b>🚀 Preventa</b> · Déficit acumulado de {fmtInt(r.preventaDeficit)} pz respecto a compromiso.</div>}
        </div>
      )}
    </div>
  );
}
