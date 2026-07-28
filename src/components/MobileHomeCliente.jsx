// MobileHomeCliente — portada del cliente mobile-native.
// Reemplaza HomeDigitalife/Dicotech/Pcel cuando mobile === true.
//
// Estructura:
//   - Back header (a "Global"/Resumen)
//   - Título grande con nombre del cliente
//   - Hero card: ring de cuota % del mes + subtítulos
//   - 2×2 KPI tiles (Sell In, Sell Out, Cartera, DSO)
//   - Accesos rápidos a las 5 pestañas cliente

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft, ChevronRight,
  ShoppingCart, ShoppingBag, Megaphone, Wallet, CreditCard,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };

const fmtMXN = (n) => {
  if (!isFinite(n) || !n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};

export default function MobileHomeCliente({ clienteKey, onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const anio = new Date().getFullYear();
  const mesActual = new Date().getMonth() + 1;
  const cliente = CLIENTES[clienteKey];
  const color = CLIENTE_DOT[clienteKey] || theme.accent;
  const hoyMs = useMemo(() => new Date().setHours(0, 0, 0, 0), []);

  const [loading, setLoading] = useState(true);
  const [sellIn, setSellIn] = useState(0);
  const [sellInPrev, setSellInPrev] = useState(0);
  const [cuota, setCuota] = useState(0);
  const [sellOut, setSellOut] = useState(0);
  const [sellOutPrev, setSellOutPrev] = useState(0);
  const [cartera, setCartera] = useState(0);
  const [dso, setDso] = useState(null);
  const [mktCount, setMktCount] = useState(0);
  const [mktInv, setMktInv] = useState(0);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const view = `v_sellout_${clienteKey}_mensual`;
        const safeQuery = async (q) => {
          try { const r = await q; return r.data || []; } catch { return []; }
        };
        const [fact, ct, so, ec, mkt] = await Promise.all([
          safeQuery(supabase.from('facturacion_clientes').select('mes,monto').eq('cliente_key', clienteKey).eq('anio', anio)),
          safeQuery(supabase.from('cuotas_mensuales').select('mes,cuota_min,cuota_ideal').eq('cliente', clienteKey).eq('anio', anio)),
          safeQuery(supabase.from(view).select('mes,monto').eq('anio', anio)),
          safeQuery(supabase.from('estados_cuenta').select('id,fecha_corte,saldo_actual,dso').eq('cliente', clienteKey).order('fecha_corte', { ascending: false }).limit(1)),
          safeQuery(supabase.from('marketing_actividades').select('inversion,estatus,fecha,mes').eq('cliente', clienteKey).eq('anio', anio)),
        ]);
        if (!alive) return;

        // Sell In mes actual + previo
        const facturaPorMes = Array(13).fill(0);
        fact.forEach(r => { const m = Number(r.mes); if (m >= 1 && m <= 12) facturaPorMes[m] += Number(r.monto) || 0; });
        setSellIn(facturaPorMes[mesActual]);
        setSellInPrev(mesActual > 1 ? facturaPorMes[mesActual - 1] : 0);

        // Cuota mes actual
        const cuotaMes = ct.find(r => Number(r.mes) === mesActual);
        setCuota(Number(cuotaMes?.cuota_min || cuotaMes?.cuota_ideal || 0));

        // Sell Out mes actual + previo
        const soPorMes = Array(13).fill(0);
        so.forEach(r => { const m = Number(r.mes); if (m >= 1 && m <= 12) soPorMes[m] += Number(r.monto) || 0; });
        setSellOut(soPorMes[mesActual]);
        setSellOutPrev(mesActual > 1 ? soPorMes[mesActual - 1] : 0);

        // Cartera del último corte
        const est = ec?.[0];
        if (est?.id) {
          setCartera(Number(est.saldo_actual) || 0);
          if (est.dso != null) setDso(Math.round(Number(est.dso)));
          else {
            // Calcular DSO desde detalle
            const { data: det } = await supabase.from('estados_cuenta_detalle').select('saldo_actual,fecha_emision').eq('estado_cuenta_id', est.id);
            let num = 0, den = 0;
            (det || []).forEach(f => {
              if (!f.fecha_emision) return;
              const s = Number(f.saldo_actual) || 0;
              if (s <= 0) return;
              const d = Math.floor((hoyMs - new Date(f.fecha_emision + 'T00:00:00').getTime()) / 86400000);
              if (d < 0) return;
              num += s * d; den += s;
            });
            setDso(den > 0 ? Math.round(num / den) : null);
          }
        }

        // Marketing del mes
        const parseMes = (a) => {
          if (a.fecha) { const [, m] = a.fecha.split('-').map(Number); return m; }
          return Number(a.mes) || 0;
        };
        const actMes = mkt.filter(a => parseMes(a) === mesActual);
        setMktCount(actMes.length);
        setMktInv(actMes.reduce((s, a) => s + (Number(a.inversion) || 0), 0));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clienteKey, anio, mesActual, hoyMs]);

  const cuotaPct = cuota > 0 ? Math.round((sellIn / cuota) * 100) : 0;
  const gap = Math.max(0, cuota - sellIn);
  const deltaSI = sellInPrev > 0 ? Math.round(((sellIn - sellInPrev) / sellInPrev) * 100) : 0;
  const deltaSO = sellOutPrev > 0 ? Math.round(((sellOut - sellOutPrev) / sellOutPrev) * 100) : 0;
  const diasCierre = useMemo(() => {
    const now = new Date();
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(0, Math.ceil((last - now) / 86400000));
  }, []);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Back */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} /> Resumen
        </button>
      </div>

      {/* Título */}
      <div style={{ padding: '2px 18px 8px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: '50%', background: color, flex: '0 0 auto' }} />
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>
          {cliente?.label || clienteKey}
        </h1>
      </div>
      <div style={{ padding: '0 18px 4px', color: theme.textMuted, fontSize: 12.5 }}>
        {MES_CORTO[mesActual - 1]} {anio} · {diasCierre}d para el cierre
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          {/* Hero cuota con ring */}
          <div style={{
            margin: '10px 18px 10px', padding: '18px 20px',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 20,
            display: 'grid', gridTemplateColumns: '110px 1fr', gap: 16, alignItems: 'center',
          }}>
            <RingCuota pct={cuotaPct} color={color} theme={theme} />
            <div>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>Cuota {MES_CORTO[mesActual - 1]}</div>
              <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', color: theme.text, fontFamily: TYPO.fontDisplay, marginTop: 2 }}>{fmtMXN(sellIn)}</div>
              <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 1 }}>de {fmtMXN(cuota)}</div>
              {gap > 0 ? (
                <div style={{ fontSize: 11.5, marginTop: 6, color: theme.pink || theme.red || '#FF3B30', fontWeight: 600 }}>
                  Gap {fmtMXN(gap)} · {diasCierre}d
                </div>
              ) : (
                <div style={{ fontSize: 11.5, marginTop: 6, color: theme.green || '#34C759', fontWeight: 700 }}>
                  ✓ Cuota cumplida
                </div>
              )}
            </div>
          </div>

          {/* 2×2 KPI tiles */}
          <div style={{ padding: '4px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label="Sell In"
              value={fmtMXN(sellIn)}
              delta={deltaSI ? `${deltaSI > 0 ? '+' : ''}${deltaSI}% vs mes ant.` : '—'}
              positive={deltaSI >= 0} />
            <KpiTile theme={theme} label="Sell Out"
              value={fmtMXN(sellOut)}
              delta={deltaSO ? `${deltaSO > 0 ? '+' : ''}${deltaSO}% vs mes ant.` : '—'}
              positive={deltaSO >= 0} />
            <KpiTile theme={theme} label="Cartera"
              value={fmtMXN(cartera)}
              delta={dso != null ? `DSO ${dso}d` : 'sin corte'}
              positive={dso != null && dso <= 30 ? true : dso != null && dso > 60 ? false : undefined} />
            <KpiTile theme={theme} label="Marketing"
              value={mktCount}
              delta={mktInv > 0 ? `${fmtMXN(mktInv)} inv.` : 'sin actividades'} />
          </div>

          {/* Accesos rápidos a las 5 pestañas */}
          <SectionHead theme={theme} title="Ir a" />
          <div style={{ padding: '4px 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(cliente?.pestanas || []).filter(p => !p.disabled).map((p) => {
              const IconMap = { home: ShoppingCart, sellIn: ShoppingCart, estrategia: ShoppingBag, marketing: Megaphone, pagos: Wallet, cartera: CreditCard };
              const Icon = IconMap[p.id] || ShoppingCart;
              if (p.id === 'home') return null; // ya estamos aquí
              const cli = CLIENTES[clienteKey];
              const iconColor = { sellIn: theme.accent, estrategia: theme.orange || '#FF9500', marketing: theme.purple || '#AF52DE', pagos: theme.green || '#34C759', cartera: theme.pink || '#FF3B30' }[p.id] || theme.accent;
              return (
                <button key={p.id}
                  onClick={() => onNavegar(clienteKey, p.id)}
                  style={{
                    width: '100%', background: theme.surface, border: `1px solid ${theme.border}`,
                    borderRadius: 14, padding: '12px 14px', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 12, fontFamily: TYPO.fontText,
                    textAlign: 'left', transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)',
                  }}
                  onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.99)'}
                  onPointerUp={(e) => e.currentTarget.style.transform = ''}
                  onPointerLeave={(e) => e.currentTarget.style.transform = ''}
                >
                  <div style={{
                    width: 34, height: 34, borderRadius: 10, background: `${iconColor}18`, color: iconColor,
                    display: 'grid', placeItems: 'center', flex: '0 0 auto',
                  }}>
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 600, color: theme.text }}>{p.label}</div>
                  </div>
                  <ChevronRight size={16} style={{ color: theme.textSubtle || theme.textMuted, flex: '0 0 auto' }} />
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

// ─────────────── Sub-componentes ───────────────
function RingCuota({ pct, color, theme }) {
  const size = 110, stroke = 10;
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const dash = c * Math.min(1, pct / 100);
  const trackColor = theme.mode === 'dark' ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)';
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={trackColor} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={c} strokeDashoffset={c - dash} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(.4,0,.2,1)' }} />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: '-.03em', color: theme.text, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' }}>
          {pct}<span style={{ fontSize: 14, color: theme.textMuted }}>%</span>
        </div>
      </div>
    </div>
  );
}

function KpiTile({ theme, label, value, delta, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}
    </div>
  );
}

function SectionHead({ theme, title, sub }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}
