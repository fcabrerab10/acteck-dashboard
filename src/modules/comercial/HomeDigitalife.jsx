// HomeDigitalife · rediseño Apple-editorial (Propuesta híbrida A+C)
// ─ Hero editorial dark
// ─ 4 KPI split cards (Sell In · Sell Out · Inventario · Cobranza global)
// ─ 3 tarjetas secundarias: Marketing (próximamente) · Pagos (próximamente) · Cobranza detallada (aging)
// ─ Timeline mensual con línea de cuota
// ─ Grid final: marcas + Copilot Ferruteck

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ChevronRight, Sparkles, AlertTriangle, Clock, TrendingUp } from 'lucide-react';

const NOMBRES_MES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MARCA_COLOR_KEY = ['accent','orange','green','purple','indigo','red','teal'];

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
const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));

export default function HomeDigitalife({ cliente, clienteKey, onUploadComplete }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const [ventasMes, setVentasMes] = useState([]);
  const [cuotasMes, setCuotasMes] = useState([]);
  const [aging, setAging] = useState(null);
  const [marcasTop, setMarcasTop] = useState([]);
  const [rango, setRango] = useState('anio');

  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;

  useEffect(() => {
    let cancel = false;
    (async () => {
      // Últimos 30 días para marca share
      const hace30 = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
      const [vR, cR, ecR, soR] = await Promise.all([
        supabase.from('ventas_mensuales').select('*').eq('cliente', clienteKey).eq('anio', anio).order('mes'),
        supabase.from('cuotas_mensuales').select('*').eq('cliente', clienteKey).eq('anio', anio),
        supabase.from('estados_cuenta').select('id').eq('cliente', clienteKey).order('fecha_corte', { ascending: false }).limit(1),
        supabase.from('sellout_detalle').select('total, marca, fecha').eq('cliente', clienteKey).gte('fecha', hace30),
      ]);
      if (cancel) return;
      setVentasMes(vR.data || []);
      setCuotasMes(cR.data || []);

      // Aging desde estados_cuenta_detalle del último corte
      const ecActualId = (ecR.data || [])[0]?.id;
      if (ecActualId) {
        const { data: det } = await supabase
          .from('estados_cuenta_detalle')
          .select('saldo_actual, vencimiento')
          .eq('estado_cuenta_id', ecActualId);
        if (cancel) return;
        const now = Date.now();
        const buckets = { d0_30: 0, d31_60: 0, d61_90: 0, mas90: 0 };
        let total = 0, vencido = 0, alDia = 0;
        (det || []).forEach(f => {
          const saldo = Number(f.saldo_actual) || 0;
          if (saldo <= 0) return;
          total += saldo;
          if (!f.vencimiento) { alDia += saldo; buckets.d0_30 += saldo; return; }
          const v = new Date(f.vencimiento + 'T00:00:00').getTime();
          const dias = Math.floor((now - v) / 86400000);
          if (dias <= 0) { alDia += saldo; buckets.d0_30 += saldo; }
          else if (dias <= 30) { vencido += saldo; buckets.d0_30 += saldo; }
          else if (dias <= 60) { vencido += saldo; buckets.d31_60 += saldo; }
          else if (dias <= 90) { vencido += saldo; buckets.d61_90 += saldo; }
          else { vencido += saldo; buckets.mas90 += saldo; }
        });
        setAging({ total, vencido, alDia, buckets });
      } else {
        setAging({ total: 0, vencido: 0, alDia: 0, buckets: { d0_30: 0, d31_60: 0, d61_90: 0, mas90: 0 } });
      }

      // Marca share últimos 30 días
      const marcaMap = {};
      (soR.data || []).forEach(r => {
        const m = r.marca || 'Otros';
        marcaMap[m] = (marcaMap[m] || 0) + (Number(r.total) || 0);
      });
      const arr = Object.entries(marcaMap).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([n, v]) => ({ n, v }));
      setMarcasTop(arr);
    })();
    return () => { cancel = true; };
  }, [clienteKey]);

  // ═════ KPI current values ═════
  const cuotaMesActual = cuotasMes.find(c => Number(c.mes) === mesActual);
  const cuotaIdeal = Number(cuotaMesActual?.cuota_ideal) || cliente?.kpis?.cuotaMes || 0;
  const sellInMes = Number(ventasMes.find(v => Number(v.mes) === mesActual)?.sell_in) || cliente?.kpis?.sellInMes || 0;
  const sellOutMes = Number(ventasMes.find(v => Number(v.mes) === mesActual)?.sell_out) || cliente?.kpis?.sellOut || 0;
  const pctCuota = cuotaIdeal > 0 ? (sellInMes / cuotaIdeal * 100) : 0;
  const inventarioDias = Number(cliente?.kpis?.diasInventario) || 0;
  const inventarioValor = Number(cliente?.kpis?.inventarioValor) || 0;
  const metaInvDias = 45;

  // Sell In vs mes anterior
  const sellInMesAnt = Number(ventasMes.find(v => Number(v.mes) === mesActual - 1)?.sell_in) || 0;
  const deltaSellIn = sellInMesAnt > 0 ? ((sellInMes - sellInMesAnt) / sellInMesAnt * 100) : null;
  const sellOutMesAnt = Number(ventasMes.find(v => Number(v.mes) === mesActual - 1)?.sell_out) || 0;
  const deltaSellOut = sellOutMesAnt > 0 ? ((sellOutMes - sellOutMesAnt) / sellOutMesAnt * 100) : null;

  // Series últimos 7 meses para mini charts
  const ultimos7 = useMemo(() => {
    const meses = [];
    for (let i = 6; i >= 0; i--) {
      const m = mesActual - i;
      if (m < 1) meses.push(null);
      else meses.push(ventasMes.find(v => Number(v.mes) === m));
    }
    return meses;
  }, [ventasMes, mesActual]);
  const miniSellIn = ultimos7.map(v => Number(v?.sell_in) || 0);
  const miniSellOut = ultimos7.map(v => Number(v?.sell_out) || 0);

  // ═════ Timeline chart ═════
  const mesesTimeline = useMemo(() => {
    const arr = [];
    for (let m = 1; m <= 12; m++) {
      arr.push({
        mes: m,
        label: NOMBRES_MES[m - 1],
        sellIn: Number(ventasMes.find(v => Number(v.mes) === m)?.sell_in) || 0,
        cuota: Number(cuotasMes.find(c => Number(c.mes) === m)?.cuota_ideal) || 0,
        actual: m === mesActual,
        futuro: m > mesActual,
      });
    }
    if (rango === 'trimestre') {
      const iniQ = Math.floor((mesActual - 1) / 3) * 3;
      return arr.slice(iniQ, iniQ + 3);
    }
    return arr;
  }, [ventasMes, cuotasMes, mesActual, rango]);

  const maxVentaChart = Math.max(1, ...mesesTimeline.map(x => Math.max(x.sellIn, x.cuota)));

  // ═════ Copilot recomendaciones (data-driven) ═════
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
      arr.push({
        sev: aging.vencido > (aging.total || 0) * 0.15 ? 'urgente' : 'warn',
        title: `${fmtMoney(aging.vencido)} de cobranza vencida`,
        sub: `${fmtMoney(aging.buckets.d61_90 + aging.buckets.mas90)} > 60d en riesgo`,
      });
    }
    if (pctCuota >= 100) {
      arr.push({
        sev: 'info',
        title: `Digitalife va ${(pctCuota - 100).toFixed(1)}% arriba de cuota`,
        sub: `Considera subir meta trimestral para mantener incentivo`,
      });
    } else if (pctCuota > 0 && pctCuota < 85) {
      arr.push({
        sev: 'warn',
        title: `Sell In al ${Math.round(pctCuota)}% de la cuota`,
        sub: `Falta ${fmtMoney(cuotaIdeal - sellInMes)} para cerrar el mes en meta`,
      });
    }
    return arr.slice(0, 3);
  }, [inventarioDias, inventarioValor, aging, pctCuota, cuotaIdeal, sellInMes]);

  // ═════ Estilos ═════
  const surface = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14 };
  const heroBg = isDark ? 'linear-gradient(135deg, #1C1C1E, #0A0A0C)' : (theme.key === 'marfil' ? 'linear-gradient(135deg, #0055B5, #003D80)' : '#1C1C1E');
  const heroText = '#FFF';
  const heroEyebrow = 'rgba(255,255,255,0.55)';
  const heroNarr = 'rgba(255,255,255,0.7)';

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* ═════ HERO ═════ */}
      <div style={{
        background: heroBg, color: heroText, borderRadius: 16, padding: '22px 24px',
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 24, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: heroEyebrow, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: '#EF4444' }} />
            Digitalife · {NOMBRES_MES[mesActual - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 600, margin: '4px 0 3px', color: heroText, letterSpacing: '-0.03em' }}>
            {narrativa(pctCuota, sellInMes, cuotaIdeal)}
          </h2>
          <p style={{ color: heroNarr, fontSize: 12.5, maxWidth: 380, lineHeight: 1.5, margin: 0 }}>
            {subnarrativa(sellInMes, cuotaIdeal, sellOutMes, deltaSellOut, marcasTop[0])}
          </p>
        </div>
        <HeroStat k="Sell In mes" v={fmtMoney(sellInMes)} sub={cuotaIdeal > 0 ? `${Math.round(pctCuota)}% cuota` : ''} col={heroText} eyebrow={heroEyebrow} />
        <HeroStat k="Sell Out mes" v={fmtMoney(sellOutMes)} sub={deltaSellOut != null ? `${deltaSellOut >= 0 ? '+' : ''}${deltaSellOut.toFixed(0)}% vs ${NOMBRES_MES[mesActual - 2] || ''}` : ''} col={heroText} eyebrow={heroEyebrow} />
      </div>

      {/* ═════ FILA 1: 4 KPIs ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <SplitCard theme={theme} P={P}
          eyebrow="Sell In" title="vs cuota mensual"
          big={fmtMoney(sellInMes)}
          bigColor={pctCuota >= 100 ? P.green : pctCuota >= 85 ? theme.text : P.orange}
          sub={<>
            <strong style={{ color: pctCuota >= 100 ? P.green : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>
              {pctCuota > 0 ? fmtPct(pctCuota) : '—'}
            </strong>
            {' '}· meta {fmtMoney(cuotaIdeal)}
          </>}
          series={miniSellIn} highlightLast highlightColor={P.green} baseColor={P.accent}
        />
        <SplitCard theme={theme} P={P}
          eyebrow="Sell Out" title="últimos 30 días"
          big={fmtMoney(sellOutMes)}
          sub={<>
            {deltaSellOut != null && (
              <>
                <strong style={{ color: deltaSellOut >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>
                  {deltaSellOut >= 0 ? '+' : ''}{Math.round(deltaSellOut)}%
                </strong>
                {' '}vs mes ant.
              </>
            )}
          </>}
          series={miniSellOut} highlightLast highlightColor={P.green} baseColor={P.green}
        />
        <SplitCard theme={theme} P={P}
          eyebrow="Inventario" title="días de inventario"
          big={inventarioDias > 0 ? `${Math.round(inventarioDias)}d` : '—'}
          bigColor={inventarioDias > metaInvDias ? P.orange : P.green}
          sub={<>
            {fmtMoney(inventarioValor)} · meta{' '}
            <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{metaInvDias}d</strong>
            {inventarioDias > 0 && inventarioDias > metaInvDias && (
              <>{' '}· <strong style={{ color: P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>▲{Math.round(inventarioDias - metaInvDias)}d</strong></>
            )}
          </>}
          series={[]} baseColor={P.orange}
        />
        <SplitCard theme={theme} P={P}
          eyebrow="Cobranza global" title="cartera al día"
          big={fmtMoney(aging?.alDia || 0)}
          bigColor={P.green}
          sub={<>
            {aging?.vencido > 0 && <>{fmtMoney(aging.vencido)} vencido</>}
          </>}
          series={[]} baseColor={P.green}
        />
      </div>

      {/* ═════ FILA 2: Marketing · Pagos · Cobranza detalle ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
        <SoonCard theme={theme} P={P} eyebrow="Marketing" title="campañas activas" />
        <SoonCard theme={theme} P={P} eyebrow="Pagos" title="rebates & spiffs" />
        <CobranzaCard theme={theme} P={P} aging={aging} />
      </div>

      {/* ═════ TIMELINE ═════ */}
      <div style={{ ...surface, padding: '16px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 }}>
          <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
            Sell In mensual · vs cuota ideal
          </h5>
          <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
            {[{ k: 'trimestre', l: 'Trimestre' }, { k: 'anio', l: 'Año' }].map(op => (
              <button key={op.k} onClick={() => setRango(op.k)}
                style={{
                  border: 0, background: rango === op.k ? theme.surface : 'transparent',
                  padding: '4px 12px', borderRadius: 6,
                  fontFamily: rango === op.k ? TYPO.fontDisplay : TYPO.fontText,
                  fontSize: 11, color: rango === op.k ? theme.text : theme.textMuted,
                  fontWeight: rango === op.k ? 600 : 500, cursor: 'pointer',
                  boxShadow: rango === op.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                  border: rango === op.k ? `1px solid ${theme.border}` : '1px solid transparent',
                }}>{op.l}</button>
            ))}
          </div>
        </div>
        <TimelineChart data={mesesTimeline} max={maxVentaChart} theme={theme} P={P} />
      </div>

      {/* ═════ FILA FINAL: Marcas + Copilot ═════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <MarcasCard theme={theme} P={P} marcas={marcasTop} />
        <CopilotCard theme={theme} P={P} recos={copilotRecos} />
      </div>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// Componentes auxiliares
// ═════════════════════════════════════════════════════════════════

function narrativa(pct, sellIn, cuota) {
  if (!cuota) return 'Bienvenido a Digitalife';
  if (pct >= 100) return `Vamos ${(pct - 100).toFixed(1)}% arriba de la cuota mensual`;
  if (pct >= 85) return `Vamos al ${Math.round(pct)}% de la cuota mensual`;
  if (pct > 0) return `Falta un empujón para la cuota del mes`;
  return `Aún sin datos de sell in para este mes`;
}
function subnarrativa(sellIn, cuota, sellOut, delta, marca) {
  const parts = [];
  if (sellIn > 0) parts.push(`Sell In ${fmtMoney(sellIn)}`);
  if (cuota > 0) parts.push(`${Math.round((sellIn / cuota) * 100)}% de la cuota ideal`);
  if (marca) parts.push(`${marca.n} tuvo mejor mes`);
  if (parts.length === 0) return 'Carga los datos del mes para ver el resumen aquí.';
  return parts.join(' · ');
}

function HeroStat({ k, v, sub, col, eyebrow }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: eyebrow, fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 600, letterSpacing: '-0.03em', color: col, marginTop: 3 }}>{v}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: eyebrow, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SplitCard({ theme, P, eyebrow, title, big, bigColor, sub, series, highlightLast, highlightColor, baseColor }) {
  const [hover, setHover] = useState(false);
  const max = Math.max(1, ...(series || []));
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 14, padding: 16, cursor: 'pointer',
        transition: 'all 200ms cubic-bezier(0.32, 0.72, 0, 1)',
        transform: hover ? 'translateY(-2px)' : 'none',
        boxShadow: hover ? '0 8px 24px rgba(0,0,0,0.08)' : 'none',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <ChevronRight size={15} style={{ position: 'absolute', top: 14, right: 16, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 3 }}>{eyebrow}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 10px', color: theme.text }}>{title}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: bigColor || theme.text }}>{big}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
      {series && series.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 34, marginTop: 12 }}>
          {series.map((v, i) => {
            const isLast = i === series.length - 1;
            const useHighlight = highlightLast && isLast;
            return (
              <div key={i}
                style={{
                  flex: 1,
                  background: `linear-gradient(180deg, ${useHighlight ? (highlightColor || baseColor) : baseColor}, ${useHighlight ? (highlightColor || baseColor) : baseColor}AA)`,
                  borderRadius: '3px 3px 0 0',
                  height: `${Math.max(4, (v / max) * 100)}%`,
                  minHeight: 4,
                  opacity: v > 0 ? 1 : 0.2,
                }} />
            );
          })}
        </div>
      )}
    </div>
  );
}

function SoonCard({ theme, P, eyebrow, title }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: 16, opacity: 0.72,
      position: 'relative', overflow: 'hidden',
    }}>
      <ChevronRight size={15} style={{ position: 'absolute', top: 14, right: 16, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 3 }}>{eyebrow}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 10px', color: theme.text }}>{title}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: theme.textMuted }}>—</div>
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 999,
        background: `${P.accent}18`, color: P.accent,
        fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 10,
      }}>
        <Sparkles size={10} /> Próximamente
      </div>
    </div>
  );
}

function CobranzaCard({ theme, P, aging }) {
  const total = aging?.total || 0;
  const vencido = aging?.vencido || 0;
  const buckets = aging?.buckets || { d0_30: 0, d31_60: 0, d61_90: 0, mas90: 0 };
  const maxB = Math.max(1, buckets.d0_30, buckets.d31_60, buckets.d61_90, buckets.mas90);
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: 16, position: 'relative', gridColumn: 'span 2',
    }}>
      <ChevronRight size={15} style={{ position: 'absolute', top: 14, right: 16, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 3 }}>
        Crédito & Cobranza
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 12px', color: theme.text }}>
        aging de la cartera
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 20, alignItems: 'start' }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, color: P.green }}>
            {fmtMoney(total)}
          </div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 4, maxWidth: 200 }}>
            Total cartera{vencido > 0 && (
              <> · <strong style={{ color: P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtMoney(vencido)} vencido</strong></>
            )}
          </div>
        </div>
        <div>
          <AgingRow theme={theme} label="0-30 d" val={buckets.d0_30} pct={buckets.d0_30 / maxB * 100} color={P.green} />
          <AgingRow theme={theme} label="31-60 d" val={buckets.d31_60} pct={buckets.d31_60 / maxB * 100} color={P.orange} />
          <AgingRow theme={theme} label="61-90 d" val={buckets.d61_90} pct={buckets.d61_90 / maxB * 100} color={P.red} />
          <AgingRow theme={theme} label="+ 90 d" val={buckets.mas90} pct={buckets.mas90 / maxB * 100} color={P.red} />
        </div>
      </div>
    </div>
  );
}

function AgingRow({ theme, label, val, pct, color }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr 60px', gap: 8, alignItems: 'center', padding: '5px 0', fontSize: 11 }}>
      <span style={{ fontFamily: TYPO.fontText, color: theme.textMuted, fontWeight: 500 }}>{label}</span>
      <span style={{ height: 5, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', background: color, borderRadius: 999, width: `${Math.min(100, pct)}%`, transition: 'width 400ms cubic-bezier(0.32, 0.72, 0, 1)' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, textAlign: 'right', color: theme.text, fontWeight: 600 }}>{fmtMoney(val)}</span>
    </div>
  );
}

function TimelineChart({ data, max, theme, P }) {
  const cuotaMedia = data.filter(d => d.cuota > 0).reduce((s, d) => s + d.cuota, 0) / Math.max(1, data.filter(d => d.cuota > 0).length);
  const cuotaTop = cuotaMedia > 0 ? (1 - cuotaMedia / max) * 100 : 50;
  const isDark = theme.mode === 'dark';
  return (
    <div style={{ position: 'relative', height: 200, padding: '20px 12px 4px' }}>
      <div style={{ position: 'absolute', inset: '20px 12px 20px', borderLeft: `1px solid ${theme.divider || theme.border}`, borderBottom: `1px solid ${theme.divider || theme.border}` }}>
        {[25, 50, 75].map(y => (
          <div key={y} style={{ position: 'absolute', left: 0, right: 0, bottom: `${y}%`, borderTop: `1px dashed ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}` }} />
        ))}
      </div>
      {cuotaMedia > 0 && (
        <div style={{ position: 'absolute', top: `${cuotaTop}%`, left: 12, right: 12, borderTop: `1.5px dashed ${P.orange}` }}>
          <span style={{
            position: 'absolute', right: 0, top: -18,
            padding: '2px 8px', borderRadius: 6,
            background: P.orange, color: '#FFF',
            fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '0.08em',
          }}>Cuota {fmtMoney(cuotaMedia)}</span>
        </div>
      )}
      <div style={{ position: 'absolute', inset: '20px 20px 20px', display: 'flex', alignItems: 'flex-end', gap: 4 }}>
        {data.map((d, i) => {
          const alt = (d.sellIn / max) * 100;
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
              <div style={{
                width: '100%',
                background: d.actual
                  ? `linear-gradient(180deg, ${P.green}, ${P.green}88)`
                  : `linear-gradient(180deg, ${P.accent}, ${P.accent}88)`,
                borderRadius: '4px 4px 0 0',
                position: 'relative', minHeight: 3,
                height: `${d.futuro ? 0 : Math.max(3, alt)}%`,
                opacity: d.futuro ? 0.15 : 1,
                boxShadow: d.actual ? `0 -2px 8px ${P.green}66` : 'none',
                transition: 'height 500ms cubic-bezier(0.32, 0.72, 0, 1)',
              }} />
              <span style={{
                fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
                color: d.actual ? P.green : theme.textMuted,
                fontWeight: d.actual ? 700 : 500,
                opacity: d.futuro ? 0.4 : 1,
                marginTop: 6,
              }}>{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function MarcasCard({ theme, P, marcas }) {
  const max = Math.max(1, ...marcas.map(m => m.v));
  const palette = [P.accent, P.orange, P.green, P.purple, P.indigo, P.red];
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '14px 16px' }}>
      <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 12px', color: theme.text }}>
        Sell Out por marca · últimos 30 días
      </h5>
      {marcas.length === 0 && (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5 }}>
          Sin datos aún
        </div>
      )}
      {marcas.map((m, i) => (
        <div key={m.n} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 68px', gap: 10, alignItems: 'center', padding: '8px 0', fontSize: 12 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.n}</span>
          <span style={{ height: 6, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
            <span style={{
              display: 'block', height: '100%',
              background: palette[i % palette.length],
              borderRadius: 999,
              width: `${(m.v / max) * 100}%`,
              transition: 'width 500ms cubic-bezier(0.32, 0.72, 0, 1)',
            }} />
          </span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, textAlign: 'right', color: theme.text, fontWeight: 600 }}>{fmtMoney(m.v)}</span>
        </div>
      ))}
    </div>
  );
}

function CopilotCard({ theme, P, recos }) {
  const isDark = theme.mode === 'dark';
  return (
    <div style={{
      background: isDark
        ? `linear-gradient(135deg, ${P.accent}12, ${P.purple}0E)`
        : `linear-gradient(135deg, ${P.accent}0F, ${P.purple}0A)`,
      border: `1px solid ${P.accent}26`,
      borderRadius: 14, padding: '16px 18px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <span style={{
          padding: '3px 10px', borderRadius: 999,
          background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`,
          color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
          <Sparkles size={10} /> Ferruteck
        </span>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, margin: 0, letterSpacing: '-0.015em', color: theme.text }}>
          Recomendaciones
        </h5>
      </div>
      {recos.length === 0 && (
        <div style={{ padding: '14px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11.5 }}>
          Todo bajo control · sin recomendaciones activas
        </div>
      )}
      {recos.map((r, i) => (
        <CopilotRow key={i} theme={theme} P={P} r={r} first={i === 0} />
      ))}
    </div>
  );
}

function CopilotRow({ theme, P, r, first }) {
  const grad = r.sev === 'urgente' ? `linear-gradient(135deg, ${P.red}, #C22B22)`
    : r.sev === 'warn' ? `linear-gradient(135deg, ${P.orange}, #C56E00)`
    : `linear-gradient(135deg, ${P.accent}, ${P.accent}AA)`;
  const Icon = r.sev === 'urgente' ? AlertTriangle : r.sev === 'warn' ? Clock : TrendingUp;
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '32px 1fr auto', gap: 12,
      padding: '8px 0', borderTop: first ? 'none' : `1px solid ${P.accent}1E`,
      alignItems: 'center',
    }}>
      <span style={{ width: 32, height: 32, borderRadius: 8, background: grad, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
        <Icon size={15} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{r.title}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{r.sub}</div>
      </div>
      <button style={{
        background: 'transparent', border: 0, color: P.accent,
        fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600,
        cursor: 'pointer', padding: '4px 8px', borderRadius: 6,
      }}>Ver ›</button>
    </div>
  );
}
