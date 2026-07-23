// HomeDigitalife V2 · rediseño Apple con timeline lineal y Ferruteck cósmico
// ─ Hero editorial compacto
// ─ 4 KPI cards compactas (Sell In · Sell Out · Inventario · Cobranza)
// ─ 3 tarjetas secundarias (Marketing/Pagos próximamente · Cobranza aging)
// ─ Timeline lineal: año anterior + este año + cuota + filtros Q1..Q4/Año + sums
// ─ Sell In vs Sell Out temporal + Ferruteck cósmico (side-by-side)
// ─ Sell In vs Sell Out por marca (barras paralelas)

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ChevronRight, Sparkles, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

const NOMBRES_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_INICIAL = ['E','F','M','A','M','J','J','A','S','O','N','D'];
const Q_MESES = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12], anio: [1,2,3,4,5,6,7,8,9,10,11,12] };

function paletteFromTheme(theme) {
  return {
    accent: theme.accent || '#007AFF',
    green:  theme.green  || '#34C759',
    orange: theme.orange || '#FF9500',
    red:    theme.red    || '#FF3B30',
    purple: theme.purple || '#AF52DE',
    indigo: theme.indigo || '#5856D6',
    teal:   theme.teal   || '#5AC8FA',
  };
}

const fmtMoney = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(Number(n));
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
const fmtPct = (n) => (n == null || !isFinite(n) ? '—' : `${Math.round(n)}%`);

export default function HomeDigitalife({ cliente, clienteKey }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;

  const [ventasActual, setVentasActual] = useState([]);
  const [ventasAnt, setVentasAnt] = useState([]);
  const [cuotasMes, setCuotasMes] = useState([]);
  const [aging, setAging] = useState(null);
  const [sellInSku, setSellInSku] = useState([]);
  const [sellOutDetalle, setSellOutDetalle] = useState([]);
  const [productos, setProductos] = useState([]);
  const [rango, setRango] = useState(getCurrentQ(mesActual));
  const [marcaRango, setMarcaRango] = useState(getCurrentQ(mesActual));

  function getCurrentQ(m) {
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
  }

  useEffect(() => {
    let cancel = false;
    (async () => {
      const [vAct, vAnt, cR, ecR, siR, prR, soR] = await Promise.all([
        supabase.from('ventas_mensuales').select('*').eq('cliente', clienteKey).eq('anio', anio).order('mes'),
        supabase.from('ventas_mensuales').select('*').eq('cliente', clienteKey).eq('anio', anio - 1).order('mes'),
        supabase.from('cuotas_mensuales').select('*').eq('cliente', clienteKey).eq('anio', anio),
        supabase.from('estados_cuenta').select('id').eq('cliente', clienteKey).order('fecha_corte', { ascending: false }).limit(1),
        supabase.from('sell_in_sku').select('sku, mes, monto_pesos, piezas').eq('cliente', clienteKey).eq('anio', anio),
        supabase.from('productos_cliente').select('sku, marca, precio_venta').eq('cliente', clienteKey),
        supabase.from('sellout_detalle').select('total, marca, mes, cantidad').eq('cliente', clienteKey).gte('anio', anio),
      ]);
      if (cancel) return;
      setVentasActual(vAct.data || []);
      setVentasAnt(vAnt.data || []);
      setCuotasMes(cR.data || []);
      setSellInSku(siR.data || []);
      setProductos(prR.data || []);
      setSellOutDetalle(soR.data || []);

      // Aging (mismo cálculo que antes, buckets sólo vencidos)
      const ecActualId = (ecR.data || [])[0]?.id;
      if (ecActualId) {
        const { data: det } = await supabase
          .from('estados_cuenta_detalle')
          .select('*')
          .eq('estado_cuenta_id', ecActualId);
        if (cancel) return;
        const now = Date.now();
        const buckets = { d1_30: [], d31_60: [], d61_90: [], mas90: [] };
        let total = 0, vencido = 0, alDia = 0;
        (det || []).forEach(f => {
          const saldo = Number(f.saldo_actual) || 0;
          if (saldo <= 0) return;
          total += saldo;
          if (!f.vencimiento) { alDia += saldo; return; }
          const v = new Date(f.vencimiento + 'T00:00:00').getTime();
          const dias = Math.floor((now - v) / 86400000);
          if (dias <= 0) alDia += saldo;
          else if (dias <= 30) { vencido += saldo; buckets.d1_30.push({ ...f, dias, saldo }); }
          else if (dias <= 60) { vencido += saldo; buckets.d31_60.push({ ...f, dias, saldo }); }
          else if (dias <= 90) { vencido += saldo; buckets.d61_90.push({ ...f, dias, saldo }); }
          else { vencido += saldo; buckets.mas90.push({ ...f, dias, saldo }); }
        });
        setAging({ total, vencido, alDia, buckets });
      } else {
        setAging({ total: 0, vencido: 0, alDia: 0, buckets: { d1_30: [], d31_60: [], d61_90: [], mas90: [] } });
      }
    })();
    return () => { cancel = true; };
  }, [clienteKey, anio]);

  // ═════ KPIs ═════
  const sellInMes = Number(ventasActual.find(v => Number(v.mes) === mesActual)?.sell_in) || cliente?.kpis?.sellInMes || 0;
  const sellOutMes = Number(ventasActual.find(v => Number(v.mes) === mesActual)?.sell_out) || cliente?.kpis?.sellOut || 0;
  const cuotaMesActual = cuotasMes.find(c => Number(c.mes) === mesActual);
  const cuotaIdeal = Number(cuotaMesActual?.cuota_ideal) || cliente?.kpis?.cuotaMes || 0;
  const pctCuota = cuotaIdeal > 0 ? (sellInMes / cuotaIdeal * 100) : 0;
  const sellInMesAnt = Number(ventasActual.find(v => Number(v.mes) === mesActual - 1)?.sell_in) || 0;
  const deltaSellIn = sellInMesAnt > 0 ? ((sellInMes - sellInMesAnt) / sellInMesAnt * 100) : null;
  const sellOutMesAnt = Number(ventasActual.find(v => Number(v.mes) === mesActual - 1)?.sell_out) || 0;
  const deltaSellOut = sellOutMesAnt > 0 ? ((sellOutMes - sellOutMesAnt) / sellOutMesAnt * 100) : null;
  const inventarioDias = Number(cliente?.kpis?.diasInventario) || 0;
  const inventarioValor = Number(cliente?.kpis?.inventarioValor) || 0;
  const metaInvDias = 45;

  // Mini series (últimos 7 meses)
  const mini = useMemo(() => {
    const arr = { si: [], so: [], inv: [], cb: [] };
    for (let i = 6; i >= 0; i--) {
      const m = mesActual - i;
      const v = m >= 1 ? ventasActual.find(x => Number(x.mes) === m) : null;
      arr.si.push(Number(v?.sell_in) || 0);
      arr.so.push(Number(v?.sell_out) || 0);
      arr.inv.push(Number(v?.inventario_dias) || 0);
      arr.cb.push(Number(v?.sell_in) * 0.6 || 0); // proxy cobranza
    }
    return arr;
  }, [ventasActual, mesActual]);

  // ═════ Timeline lineal ═════
  const timelineMeses = useMemo(() => {
    const meses = Q_MESES[rango] || Q_MESES.anio;
    return meses.map(m => ({
      mes: m,
      label: NOMBRES_MES[m - 1],
      sellIn2026: Number(ventasActual.find(v => Number(v.mes) === m)?.sell_in) || 0,
      sellIn2025: Number(ventasAnt.find(v => Number(v.mes) === m)?.sell_in) || 0,
      cuota: Number(cuotasMes.find(c => Number(c.mes) === m)?.cuota_ideal) || 0,
      actual: m === mesActual,
      futuro: m > mesActual,
    }));
  }, [ventasActual, ventasAnt, cuotasMes, rango, mesActual]);

  const timelineSums = useMemo(() => {
    const meses = Q_MESES[rango] || Q_MESES.anio;
    let s2026 = 0, s2025 = 0, cuota = 0;
    meses.forEach(m => {
      s2026 += Number(ventasActual.find(v => Number(v.mes) === m)?.sell_in) || 0;
      s2025 += Number(ventasAnt.find(v => Number(v.mes) === m)?.sell_in) || 0;
      cuota += Number(cuotasMes.find(c => Number(c.mes) === m)?.cuota_ideal) || 0;
    });
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    const deltaCuota = cuota > 0 ? ((s2026 - cuota) / cuota * 100) : null;
    return { s2026, s2025, cuota, deltaYoY, deltaCuota };
  }, [ventasActual, ventasAnt, cuotasMes, rango]);

  // ═════ Sell In vs Sell Out global (todos los meses del año) ═════
  const sivsoTemporal = useMemo(() => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      const v = ventasActual.find(x => Number(x.mes) === m);
      arr.push({
        mes: m,
        sellIn: Number(v?.sell_in) || 0,
        sellOut: Number(v?.sell_out) || 0,
        futuro: m > mesActual,
      });
    }
    return arr;
  }, [ventasActual, mesActual]);

  const ratioGlobal = useMemo(() => {
    const activos = sivsoTemporal.filter(x => !x.futuro && x.sellIn > 0);
    const totSI = activos.reduce((s, x) => s + x.sellIn, 0);
    const totSO = activos.reduce((s, x) => s + x.sellOut, 0);
    const activosAnt = ventasAnt.filter(v => v.sell_in > 0);
    const totSIAnt = activosAnt.reduce((s, v) => s + (Number(v.sell_in) || 0), 0);
    const totSOAnt = activosAnt.reduce((s, v) => s + (Number(v.sell_out) || 0), 0);
    const ratio = totSI > 0 ? (totSO / totSI * 100) : null;
    const ratioAnt = totSIAnt > 0 ? (totSOAnt / totSIAnt * 100) : null;
    return { ratio, ratioAnt, deltaPP: ratio != null && ratioAnt != null ? ratio - ratioAnt : null };
  }, [sivsoTemporal, ventasAnt]);

  // ═════ Sell In vs Sell Out por marca ═════
  const marcasSIvsSO = useMemo(() => {
    const meses = Q_MESES[marcaRango] || Q_MESES.anio;
    // Mapa SKU → marca + precio_venta
    const skuMap = {};
    productos.forEach(p => { skuMap[String(p.sku)] = p; });

    // Sell In agregado por marca (usando sell_in_sku × precio_venta desde productos)
    const siByMarca = {};
    sellInSku.forEach(r => {
      if (!meses.includes(Number(r.mes))) return;
      const prod = skuMap[String(r.sku)];
      const marca = prod?.marca || 'Sin Marca';
      const monto = Number(r.monto_pesos) || 0;
      siByMarca[marca] = (siByMarca[marca] || 0) + monto;
    });

    // Sell Out agregado por marca (desde sellout_detalle)
    const soByMarca = {};
    sellOutDetalle.forEach(r => {
      if (!meses.includes(Number(r.mes))) return;
      const marca = r.marca || 'Sin Marca';
      soByMarca[marca] = (soByMarca[marca] || 0) + (Number(r.total) || 0);
    });

    const marcas = new Set([...Object.keys(siByMarca), ...Object.keys(soByMarca)]);
    const arr = [];
    marcas.forEach(m => {
      const si = siByMarca[m] || 0;
      const so = soByMarca[m] || 0;
      const ratio = si > 0 ? (so / si * 100) : null;
      arr.push({ marca: m, si, so, ratio });
    });
    return arr.sort((a, b) => (b.si + b.so) - (a.si + a.so)).slice(0, 6);
  }, [sellInSku, sellOutDetalle, productos, marcaRango]);

  // ═════ Copilot recos ═════
  const copilotRecos = useMemo(() => {
    const arr = [];
    if (inventarioDias > metaInvDias + 15) {
      arr.push({
        sev: 'warn',
        title: `Inventario alto · ${Math.round(inventarioDias)}d`,
        sub: `Meta ${metaInvDias}d · valor ${fmtMoney(inventarioValor)}. Cabe una promo para rotar.`,
      });
    }
    if (aging && aging.vencido > 0) {
      const riesgo = (aging.buckets.d61_90 || []).reduce((s, f) => s + f.saldo, 0) + (aging.buckets.mas90 || []).reduce((s, f) => s + f.saldo, 0);
      arr.push({
        sev: aging.vencido > (aging.total || 0) * 0.15 ? 'urgente' : 'warn',
        title: `${fmtMoney(aging.vencido)} vencido en cartera`,
        sub: riesgo > 0 ? `${fmtMoney(riesgo)} > 60d en riesgo` : 'Revisa antes de que envejezca',
      });
    }
    if (pctCuota >= 100) {
      arr.push({
        sev: 'info',
        title: `Digitalife ${(pctCuota - 100).toFixed(1)}% arriba de cuota`,
        sub: 'Sube meta trimestral para mantener incentivo',
      });
    } else if (pctCuota > 0 && pctCuota < 85) {
      arr.push({
        sev: 'warn',
        title: `Sell In al ${Math.round(pctCuota)}% de cuota`,
        sub: `Falta ${fmtMoney(cuotaIdeal - sellInMes)} para meta`,
      });
    }
    return arr.slice(0, 3);
  }, [inventarioDias, inventarioValor, aging, pctCuota, cuotaIdeal, sellInMes]);

  // ═════ Estilos ═════
  const heroBg = isDark ? '#0A0A0C' : (theme.key === 'marfil' ? '#0055B5' : '#1C1C1E');

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero compacto */}
      <div style={{
        background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 20, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#EF4444' }} />
            Digitalife · {NOMBRES_MES[mesActual - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {narrativa(pctCuota)}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 380, lineHeight: 1.4, margin: 0 }}>
            {subnarrativa(sellInMes, cuotaIdeal, marcasSIvsSO[0])}
          </p>
        </div>
        <HeroStat k="Sell In mes" v={fmtMoney(sellInMes)} sub={cuotaIdeal > 0 ? `${Math.round(pctCuota)}% cuota` : ''} />
        <HeroStat k="Sell Out mes" v={fmtMoney(sellOutMes)} sub={deltaSellOut != null ? `${deltaSellOut >= 0 ? '+' : ''}${deltaSellOut.toFixed(0)}% vs ${NOMBRES_MES[mesActual - 2] || ''}` : ''} />
      </div>

      {/* Fila 1: 4 KPIs compactas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} P={P} eyebrow="Sell In" title="vs cuota mensual"
          big={fmtMoney(sellInMes)}
          bigColor={pctCuota >= 100 ? P.green : pctCuota >= 85 ? theme.text : P.orange}
          sub={<><strong style={{ color: pctCuota >= 100 ? P.green : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{pctCuota > 0 ? fmtPct(pctCuota) : '—'}</strong> · meta {fmtMoney(cuotaIdeal)}</>}
          series={mini.si} baseColor={P.accent} highlightColor={P.green}
        />
        <KpiCard theme={theme} P={P} eyebrow="Sell Out" title="últimos 30 días"
          big={fmtMoney(sellOutMes)}
          sub={<>{deltaSellOut != null && (<><strong style={{ color: deltaSellOut >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{deltaSellOut >= 0 ? '+' : ''}{Math.round(deltaSellOut)}%</strong> vs mes ant.</>)}</>}
          series={mini.so} baseColor={P.green} highlightColor={P.green}
        />
        <KpiCard theme={theme} P={P} eyebrow="Inventario" title="días de inventario"
          big={inventarioDias > 0 ? `${Math.round(inventarioDias)}d` : '—'}
          bigColor={inventarioDias > metaInvDias ? P.orange : P.green}
          sub={<>{fmtMoney(inventarioValor)} · meta <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{metaInvDias}d</strong>{inventarioDias > metaInvDias && (<> · <strong style={{ color: P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>▲{Math.round(inventarioDias - metaInvDias)}d</strong></>)}</>}
          series={mini.inv} baseColor={P.orange} highlightColor={P.orange}
        />
        <KpiCard theme={theme} P={P} eyebrow="Cobranza global" title="cartera al día"
          big={fmtMoney(aging?.alDia || 0)}
          bigColor={P.green}
          sub={aging?.vencido > 0 ? <><strong style={{ color: P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(aging.vencido)}</strong> vencido</> : 'sin vencido'}
          series={mini.cb} baseColor={P.green} highlightColor={P.green}
        />
      </div>

      {/* Fila 2: Marketing · Pagos · Cobranza detalle */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
        <SoonCard theme={theme} P={P} eyebrow="Marketing" title="campañas activas" />
        <SoonCard theme={theme} P={P} eyebrow="Pagos" title="rebates & spiffs" />
        <CobranzaCard theme={theme} P={P} aging={aging} />
      </div>

      {/* Timeline lineal */}
      <TimelineLineal
        theme={theme} P={P}
        data={timelineMeses}
        sums={timelineSums}
        rango={rango}
        onChangeRango={setRango}
      />

      {/* Fila: Sell In vs Sell Out temporal + Ferruteck cósmico */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 10 }}>
        <SIvsSOTemporal theme={theme} P={P} data={sivsoTemporal} ratioGlobal={ratioGlobal} mesActual={mesActual} />
        <FerruteckCosmicCard recos={copilotRecos} />
      </div>

      {/* Sell In vs Sell Out por marca */}
      <MarcasSIvsSOCard theme={theme} P={P} marcas={marcasSIvsSO} rango={marcaRango} onChangeRango={setMarcaRango} />
    </div>
  );
}

function narrativa(pct) {
  if (!pct || pct <= 0) return 'Aún sin datos de sell in para este mes';
  if (pct >= 100) return `Vamos ${(pct - 100).toFixed(1)}% arriba de la cuota mensual`;
  if (pct >= 85) return `Vamos al ${Math.round(pct)}% de la cuota mensual`;
  return 'Falta un empujón para la cuota del mes';
}
function subnarrativa(sellIn, cuota, marca) {
  const parts = [];
  if (sellIn > 0) parts.push(`Sell In ${fmtMoney(sellIn)}`);
  if (cuota > 0) parts.push(`${Math.round((sellIn / cuota) * 100)}% de la cuota ideal`);
  if (marca) parts.push(`${marca.marca} lideró`);
  return parts.length > 0 ? parts.join(' · ') : 'Carga los datos del mes para ver el resumen aquí.';
}

function HeroStat({ k, v, sub }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: '#FFF', marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

// ═══════════════ KPI card compacta ═══════════════
function KpiCard({ theme, P, eyebrow, title, big, bigColor, sub, series, baseColor, highlightColor }) {
  const [hover, setHover] = useState(false);
  const max = Math.max(1, ...(series || []));
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
        transition: 'transform 200ms, box-shadow 200ms',
        transform: hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
        position: 'relative',
      }}
    >
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 2 }}>{eyebrow}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', margin: '0 0 8px', color: theme.text }}>{title}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: bigColor || theme.text }}>{big}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
      {series && series.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 22, marginTop: 8 }}>
          {series.map((v, i) => {
            const isLast = i === series.length - 1;
            return (
              <div key={i} style={{
                flex: 1,
                background: isLast ? (highlightColor || baseColor) : baseColor,
                borderRadius: '2px 2px 0 0',
                height: `${Math.max(4, (v / max) * 100)}%`,
                minHeight: 3,
                opacity: v > 0 ? (isLast ? 1 : 0.5) : 0.15,
              }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════ Soon card ═══════════════
function SoonCard({ theme, P, eyebrow, title }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '12px 14px', opacity: 0.7, position: 'relative',
    }}>
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 2 }}>{eyebrow}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, margin: '0 0 6px', color: theme.text }}>{title}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, color: theme.textMuted, lineHeight: 1, margin: '0 0 6px' }}>—</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 8px', borderRadius: 999,
        background: `${P.accent}1E`, color: P.accent,
        fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em',
      }}>
        <Sparkles size={9} /> Próximamente
      </div>
    </div>
  );
}

// ═══════════════ Cobranza card (compact) ═══════════════
function CobranzaCard({ theme, P, aging }) {
  const [expanded, setExpanded] = useState(null);
  const total = aging?.total || 0;
  const alDia = aging?.alDia || 0;
  const vencido = aging?.vencido || 0;
  const buckets = aging?.buckets || { d1_30: [], d31_60: [], d61_90: [], mas90: [] };
  const sum = (arr) => (arr || []).reduce((s, f) => s + (f.saldo || 0), 0);
  const s1 = sum(buckets.d1_30), s2 = sum(buckets.d31_60), s3 = sum(buckets.d61_90), s4 = sum(buckets.mas90);
  const maxB = Math.max(1, s1, s2, s3, s4);
  const exp = expanded ? buckets[expanded] || [] : [];
  const expTop = [...exp].sort((a, b) => b.saldo - a.saldo).slice(0, 3);

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 12, padding: '12px 14px', position: 'relative',
      gridColumn: 'span 2', cursor: 'pointer',
    }}>
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 2 }}>Crédito & Cobranza</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, margin: '0 0 8px', color: theme.text }}>aging de la cartera</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 16, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: P.green, lineHeight: 1 }}>{fmtMoney(total)}</div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 3, maxWidth: 220, lineHeight: 1.35 }}>
            Total · <strong style={{ color: P.green, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(alDia)} al día</strong>
            {vencido > 0 && <> · <strong style={{ color: P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(vencido)} vencido</strong></>}
          </div>
        </div>
        <div>
          <AgingMini theme={theme} label="1-30 d" val={s1} count={buckets.d1_30.length} pct={s1 / maxB * 100} color={P.orange} active={expanded === 'd1_30'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'd1_30' ? null : 'd1_30'); }} />
          <AgingMini theme={theme} label="31-60 d" val={s2} count={buckets.d31_60.length} pct={s2 / maxB * 100} color={P.orange} active={expanded === 'd31_60'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'd31_60' ? null : 'd31_60'); }} />
          <AgingMini theme={theme} label="61-90 d" val={s3} count={buckets.d61_90.length} pct={s3 / maxB * 100} color={P.red} active={expanded === 'd61_90'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'd61_90' ? null : 'd61_90'); }} />
          <AgingMini theme={theme} label="+ 90 d" val={s4} count={buckets.mas90.length} pct={s4 / maxB * 100} color={P.red} active={expanded === 'mas90'} onClick={(e) => { e.stopPropagation(); setExpanded(expanded === 'mas90' ? null : 'mas90'); }} />
        </div>
      </div>
      {expanded && expTop.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.divider || theme.border}` }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>Top 3 en este bucket</div>
          {expTop.map((f, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, padding: '3px 0', fontSize: 10.5, alignItems: 'center' }}>
              <span style={{ fontFamily: TYPO.fontText, color: theme.text, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.factura || f.folio || 'Factura'}</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted }}>{f.dias}d</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.text, fontWeight: 600 }}>{fmtMoney(f.saldo)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgingMini({ theme, label, val, count, pct, color, active, onClick }) {
  const [hover, setHover] = useState(false);
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display: 'grid', gridTemplateColumns: '55px 1fr 22px 55px', gap: 6, alignItems: 'center',
        padding: '3px 6px', margin: '1px -6px', borderRadius: 6,
        fontSize: 10.5, cursor: 'pointer',
        background: active ? `${color}14` : hover ? `${theme.text}06` : 'transparent',
      }}
    >
      <span style={{ fontFamily: TYPO.fontText, color: theme.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', background: color, borderRadius: 999, width: `${Math.min(100, pct)}%`, transition: 'width 400ms' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, textAlign: 'right' }}>{count > 0 ? count : '—'}</span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, textAlign: 'right', color: theme.text, fontWeight: 600 }}>{fmtMoney(val)}</span>
    </div>
  );
}

// ═══════════════ Timeline lineal (año-vs-año + cuota) ═══════════════
function TimelineLineal({ theme, P, data, sums, rango, onChangeRango }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const filtros = [
    { k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }, { k: 'anio', l: 'Año' },
  ];

  // Escalas
  const W = 600, H = 200;
  const padL = 30, padR = 20, padT = 15, padB = 25;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxV = Math.max(1,
    ...data.map(d => d.sellIn2026),
    ...data.map(d => d.sellIn2025),
    ...data.map(d => d.cuota)
  );

  const xOf = (i) => padL + (i / Math.max(1, data.length - 1)) * chartW;
  const yOf = (v) => padT + chartH - (v / maxV) * chartH;

  const line2026 = data.filter(d => !d.futuro).map((d, i) => `${xOf(i)},${yOf(d.sellIn2026)}`).join(' ');
  const line2025 = data.map((d, i) => `${xOf(i)},${yOf(d.sellIn2025)}`).join(' ');
  const lineCuota = data.map((d, i) => `${xOf(i)},${yOf(d.cuota)}`).join(' ');
  const areaLastIdx = data.findIndex(d => d.futuro) - 1;
  const areaEndIdx = areaLastIdx >= 0 ? areaLastIdx : data.length - 1;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Evolución mensual · Sell In
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
          {filtros.map(f => (
            <button key={f.k} onClick={() => onChangeRango(f.k)}
              style={{
                border: 0, background: rango === f.k ? theme.surface : 'transparent',
                padding: '4px 10px', borderRadius: 6,
                fontFamily: rango === f.k ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10.5, color: rango === f.k ? theme.text : theme.textMuted,
                fontWeight: rango === f.k ? 600 : 500, cursor: 'pointer',
                boxShadow: rango === f.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderWidth: 1, borderStyle: 'solid', borderColor: rango === f.k ? theme.border : 'transparent',
              }}>{f.l}</button>
          ))}
        </div>
      </div>

      {/* Sums row */}
      <div style={{ display: 'flex', gap: 16, padding: '8px 0 10px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 10 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} />Sell In {anio - 1}</>} v={fmtMoney(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={P.accent} />Sell In {anio}</>} v={fmtMoney(sums.s2026)} vColor={theme.text} />
        <SumStat theme={theme} k={<><Dot color={P.orange} dashed />Cuota {anio}</>} v={fmtMoney(sums.cuota)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ año-vs-año" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
        )}
        {sums.deltaCuota != null && (
          <SumStat theme={theme} k="Δ vs cuota" v={`${sums.deltaCuota >= 0 ? '+' : ''}${sums.deltaCuota.toFixed(1)}%`} vColor={sums.deltaCuota >= 0 ? P.green : P.red} />
        )}
      </div>

      {/* Chart */}
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 200, display: 'block' }}>
          {/* Grid */}
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={padL} y1={padT + chartH * f} x2={W - padR} y2={padT + chartH * f}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} strokeDasharray="3 4" />
          ))}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={theme.divider || theme.border} />

          {/* Sell In 2025 (línea gris, referencia) */}
          <polyline points={line2025} fill="none" stroke={theme.textMuted} strokeWidth="2" opacity="0.55" />

          {/* Cuota 2026 dashed naranja */}
          <polyline points={lineCuota} fill="none" stroke={P.orange} strokeWidth="2" strokeDasharray="5 4" opacity="0.85" />

          {/* Sell In 2026 azul */}
          <polyline points={line2026} fill="none" stroke={P.accent} strokeWidth="2.5" />

          {/* Dots 2026 */}
          {data.map((d, i) => !d.futuro && (
            <circle key={`p-${i}`} cx={xOf(i)} cy={yOf(d.sellIn2026)} r={d.actual ? 5 : 3.5}
              fill={d.actual ? P.green : P.accent}
              stroke={theme.surface} strokeWidth={d.actual ? 2 : 1.5} />
          ))}

          {/* Hover overlay: rectángulos invisibles por columna */}
          {data.map((d, i) => (
            <rect key={`h-${i}`}
              x={xOf(i) - chartW / (data.length * 2)}
              y={padT}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}

          {/* Guía vertical hover */}
          {hoverIdx != null && (
            <line x1={xOf(hoverIdx)} y1={padT} x2={xOf(hoverIdx)} y2={H - padB}
              stroke={theme.textMuted} strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
          )}

          {/* X labels */}
          {data.map((d, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 8} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9"
              fill={d.actual ? P.green : theme.textMuted}
              fontWeight={d.actual ? 700 : 500}
              opacity={d.futuro ? 0.4 : 1}>
              {d.label}
            </text>
          ))}
        </svg>

        {hoverIdx != null && (
          <TimelineTooltip theme={theme} P={P} data={data[hoverIdx]} anio={anio}
            xPct={(hoverIdx / (data.length - 1)) * 100} />
        )}
      </div>
    </div>
  );
}

function Dot({ color, dashed }) {
  return (
    <span style={{ display: 'inline-block', width: 8, height: dashed ? 0 : 2, borderRadius: 1, background: dashed ? 'transparent' : color, borderTop: dashed ? `2px dashed ${color}` : 'none', marginRight: 4 }} />
  );
}
function SumStat({ theme, k, v, vColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: vColor || theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

function TimelineTooltip({ theme, P, data, anio, xPct }) {
  const delta2025 = data.sellIn2025 > 0 ? ((data.sellIn2026 - data.sellIn2025) / data.sellIn2025 * 100) : null;
  const deltaCuota = data.cuota > 0 ? ((data.sellIn2026 - data.cuota) / data.cuota * 100) : null;
  return (
    <div style={{
      position: 'absolute', top: 8, left: `${xPct}%`, transform: 'translateX(-50%)',
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', pointerEvents: 'none',
      zIndex: 5, minWidth: 160, maxWidth: 220,
    }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{data.label} · {anio}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
        <span style={{ color: theme.textMuted }}>Sell In {anio}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.sellIn2026)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
        <span style={{ color: theme.textMuted }}>Sell In {anio - 1}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.sellIn2025)}</span>
      </div>
      {data.cuota > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: theme.textMuted }}>Cuota</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmtMoney(data.cuota)}</span>
        </div>
      )}
      {(delta2025 != null || deltaCuota != null) && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${theme.divider || theme.border}` }}>
          {delta2025 != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: theme.textMuted }}>Δ vs {anio - 1}</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: delta2025 >= 0 ? P.green : P.red }}>
                {delta2025 >= 0 ? '+' : ''}{delta2025.toFixed(1)}%
              </span>
            </div>
          )}
          {deltaCuota != null && (
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, marginTop: 1 }}>
              <span style={{ color: theme.textMuted }}>Δ vs cuota</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: deltaCuota >= 0 ? P.green : P.orange }}>
                {deltaCuota >= 0 ? '+' : ''}{deltaCuota.toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════ Sell In vs Sell Out temporal ═══════════════
function SIvsSOTemporal({ theme, P, data, ratioGlobal, mesActual }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const isDark = theme.mode === 'dark';

  const W = 500, H = 160;
  const padL = 25, padR = 20, padT = 12, padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  const maxV = Math.max(1, ...data.map(d => Math.max(d.sellIn, d.sellOut)));
  const xOf = (i) => padL + (i / Math.max(1, data.length - 1)) * chartW;
  const yOf = (v) => padT + chartH - (v / maxV) * chartH;

  const lineSI = data.filter(d => !d.futuro).map((d, i) => `${xOf(i)},${yOf(d.sellIn)}`).join(' ');
  const lineSO = data.filter(d => !d.futuro).map((d, i) => `${xOf(i)},${yOf(d.sellOut)}`).join(' ');
  const hovered = hoverIdx != null ? data[hoverIdx] : null;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px', position: 'relative' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Sell In vs Sell Out · {new Date().getFullYear()}
        </h5>
        {ratioGlobal.ratio != null && (
          <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
            Ratio SO/SI: <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtPct(ratioGlobal.ratio)}</strong>
            {ratioGlobal.deltaPP != null && (
              <> · <strong style={{ color: ratioGlobal.deltaPP >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{ratioGlobal.deltaPP >= 0 ? '+' : ''}{ratioGlobal.deltaPP.toFixed(1)}pp</strong> vs {new Date().getFullYear() - 1}</>
            )}
          </div>
        )}
      </div>
      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: theme.textMuted, marginBottom: 6 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 14, height: 2, background: P.accent, borderRadius: 1 }} /> Sell In</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 14, height: 2, background: P.green, borderRadius: 1 }} /> Sell Out</span>
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 160, display: 'block' }}>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={padL} y1={padT + chartH * f} x2={W - padR} y2={padT + chartH * f}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} strokeDasharray="3 4" />
          ))}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={theme.divider || theme.border} />

          <polyline points={lineSI} fill="none" stroke={P.accent} strokeWidth="2.5" />
          <polyline points={lineSO} fill="none" stroke={P.green} strokeWidth="2.5" />

          {data.map((d, i) => !d.futuro && (
            <React.Fragment key={`p-${i}`}>
              <circle cx={xOf(i)} cy={yOf(d.sellIn)} r={i === mesActual - 1 ? 4 : 2.5} fill={P.accent} stroke={theme.surface} strokeWidth="1.5" />
              <circle cx={xOf(i)} cy={yOf(d.sellOut)} r={i === mesActual - 1 ? 4 : 2.5} fill={P.green} stroke={theme.surface} strokeWidth="1.5" />
            </React.Fragment>
          ))}

          {data.map((d, i) => (
            <rect key={`h-${i}`}
              x={xOf(i) - chartW / (data.length * 2)} y={padT} width={chartW / data.length} height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)} onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }} />
          ))}
          {hoverIdx != null && !data[hoverIdx].futuro && (
            <line x1={xOf(hoverIdx)} y1={padT} x2={xOf(hoverIdx)} y2={H - padB} stroke={theme.textMuted} strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
          )}

          {data.map((d, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 6} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="8.5"
              fill={theme.textMuted} opacity={d.futuro ? 0.4 : 1}>{MES_INICIAL[d.mes - 1]}</text>
          ))}
        </svg>
        {hovered && !hovered.futuro && (
          <div style={{
            position: 'absolute', top: 4, left: `${((hoverIdx) / (data.length - 1)) * 100}%`, transform: 'translateX(-50%)',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
            padding: '6px 10px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', pointerEvents: 'none', zIndex: 5, minWidth: 130,
          }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, color: theme.text }}>{NOMBRES_MES[hovered.mes - 1]}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: P.accent }}>Sell In</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: theme.text }}>{fmtMoney(hovered.sellIn)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
              <span style={{ color: P.green }}>Sell Out</span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: theme.text }}>{fmtMoney(hovered.sellOut)}</span>
            </div>
            {hovered.sellIn > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, paddingTop: 3, marginTop: 3, borderTop: `1px dashed ${theme.divider || theme.border}` }}>
                <span style={{ color: theme.textMuted }}>SO/SI</span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: theme.text }}>{fmtPct(hovered.sellOut / hovered.sellIn * 100)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════ Ferruteck Cosmic Card ═══════════════
function FerruteckCosmicCard({ recos }) {
  return (
    <div style={{
      borderRadius: 12, padding: '14px 16px',
      background: `
        radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 60%),
        radial-gradient(circle at 80% 80%, rgba(100,210,255,0.25) 0%, transparent 60%),
        linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
      color: '#FFF',
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Estrellitas */}
      <FerruteckStars />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, position: 'relative' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 4,
          padding: '3px 8px 3px 6px', borderRadius: 999,
          background: 'rgba(255,255,255,0.10)', border: '1px solid rgba(191,90,242,0.3)',
          color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.06em',
        }}>
          <FerruMini size={12} />
          Ferruteck
        </span>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, margin: 0, color: '#FFF' }}>Recomendaciones</h5>
      </div>
      {recos.length === 0 && (
        <div style={{ padding: '14px 4px', textAlign: 'center', color: 'rgba(255,255,255,0.5)', fontSize: 11, position: 'relative' }}>
          Todo bajo control · sin recomendaciones activas
        </div>
      )}
      {recos.map((r, i) => (
        <FerruReco key={i} r={r} first={i === 0} />
      ))}
    </div>
  );
}

function FerruReco({ r, first }) {
  const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';
  const iconColor = r.sev === 'info' ? '#000' : '#FFF';
  const Icon = r.sev === 'urgente' ? AlertTriangle : r.sev === 'warn' ? Clock : TrendingUp;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 8,
      padding: '7px 0', borderTop: first ? 'none' : '1px solid rgba(255,255,255,0.08)',
      alignItems: 'center', position: 'relative',
    }}>
      <span style={{ width: 24, height: 24, borderRadius: 6, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: iconColor }}>
        <Icon size={13} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: '#FFF' }}>{r.title}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{r.sub}</div>
      </div>
      <button style={{ background: 'transparent', border: 0, color: '#64D2FF', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, cursor: 'pointer', padding: '3px 6px', borderRadius: 6 }}>Ver ›</button>
    </div>
  );
}

function FerruteckStars() {
  const stars = [
    { top: '10%', left: '18%', d: 0 }, { top: '25%', left: '82%', d: 0.4 },
    { top: '55%', left: '10%', d: 0.9 }, { top: '80%', left: '65%', d: 1.4 },
    { top: '15%', left: '55%', d: 1.9 }, { top: '45%', left: '90%', d: 2.4 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes fCosmicTwinkle { 0%,100% { opacity:0.3; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.4); } }`}</style>
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          animation: `fCosmicTwinkle 3s ease-in-out ${s.d}s infinite`,
        }} />
      ))}
    </div>
  );
}

function FerruMini({ size = 12 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ferruMiniBody" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="40%" stopColor="#D0A8F0" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill="url(#ferruMiniBody)" />
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

// ═══════════════ Sell In vs Sell Out por marca ═══════════════
function MarcasSIvsSOCard({ theme, P, marcas, rango, onChangeRango }) {
  const maxSI = Math.max(1, ...marcas.map(m => m.si));
  const maxSO = Math.max(1, ...marcas.map(m => m.so));
  const isDark = theme.mode === 'dark';

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Sell In vs Sell Out por marca
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 6, padding: 2 }}>
          {[{ k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }, { k: 'anio', l: 'YTD' }].map(op => (
            <button key={op.k} onClick={() => onChangeRango(op.k)}
              style={{
                border: 0, background: rango === op.k ? theme.surface : 'transparent',
                padding: '3px 8px', borderRadius: 4,
                fontFamily: rango === op.k ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10, color: rango === op.k ? theme.text : theme.textMuted,
                fontWeight: rango === op.k ? 600 : 500, cursor: 'pointer',
                borderWidth: 1, borderStyle: 'solid', borderColor: rango === op.k ? theme.border : 'transparent',
              }}>{op.l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, fontSize: 10, color: theme.textMuted, marginBottom: 8 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2, background: P.accent, borderRadius: 1 }} /> Sell In
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ display: 'inline-block', width: 14, height: 2, background: P.green, borderRadius: 1 }} /> Sell Out
        </span>
        <span style={{ color: theme.textSubtle || theme.textMuted }}>· ratio SO/SI</span>
      </div>

      {marcas.length === 0 && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>
          Sin datos de sell in/out para este rango
        </div>
      )}
      {marcas.map((m) => {
        const ratio = m.ratio;
        const ratioColor = ratio == null ? theme.textMuted : ratio >= 80 ? P.green : ratio >= 60 ? P.orange : P.red;
        return (
          <div key={m.marca} style={{
            display: 'grid', gridTemplateColumns: '100px 1fr 1fr 76px', gap: 10, alignItems: 'center',
            padding: '6px 0', fontSize: 11, borderTop: `1px solid ${theme.divider || theme.border}`,
          }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.marca}</span>
            <MarcaBar val={m.si} max={maxSI} color={P.accent} theme={theme} />
            <MarcaBar val={m.so} max={maxSO} color={P.green} theme={theme} />
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, textAlign: 'right', color: ratioColor, fontWeight: 700 }}>
              {ratio != null ? fmtPct(ratio) : '—'}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function MarcaBar({ val, max, color, theme }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ flex: 1, height: 12, background: `${theme.text}0A`, borderRadius: 3, overflow: 'hidden', position: 'relative' }}>
        <span style={{ display: 'block', height: '100%', background: color, borderRadius: 3, width: `${Math.min(100, (val / max) * 100)}%`, transition: 'width 500ms' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, minWidth: 42, textAlign: 'right', fontWeight: 600 }}>{fmtMoney(val)}</span>
    </div>
  );
}
