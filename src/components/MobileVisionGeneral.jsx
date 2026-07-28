// MobileVisionGeneral — Dashboard consolidado del negocio para mobile.
// Reemplaza VisionGeneral desktop en mobile.
//
// Estructura:
//   - Back header · Dirección Comercial
//   - Título "Visión General"
//   - Year picker
//   - 2×2 KPI tiles (Sell In YTD, Sell Out YTD, Cartera, Inventario)
//   - Chart Sell In vs Sell Out mensual
//   - Bar-list por canal (Digitalife/PCEL/Dicotech)
//   - Alertas críticas (agotados, retrasadas, cartera vencida)
//   - Grupos colapsables con detalle
//
// Aplica los 3 temas via useTheme().

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, ChevronDown, AlertTriangle, TrendingUp, Package, HandCoins } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const CANAL_COLOR = {
  digitalife: '#5856D6',
  dicotech:   '#FF9500',
  pcel:       '#34C759',
  mercadolibre: '#FFCC00',
};
const CANAL_LABEL = {
  digitalife: 'Digitalife',
  dicotech:   'Dicotech',
  pcel:       'PCEL',
  mercadolibre: 'ML',
};

const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${(a / 1e3).toFixed(0)}K`;
  return `${sign}$${Math.round(a)}`;
};
const fmtInt = (n) => isFinite(n) ? Math.round(n).toLocaleString('es-MX') : '—';

async function safeFetch(query) {
  try { const r = await query; return r.data || []; } catch { return []; }
}
async function safeFetchOne(query) {
  try { const r = await query; return r.data || null; } catch { return null; }
}

export default function MobileVisionGeneral({ onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(true);

  const [facCanalAct, setFacCanalAct] = useState([]);
  const [facCanalPrev, setFacCanalPrev] = useState([]);
  const [soCanal, setSoCanal] = useState([]);
  const [soMensual, setSoMensual] = useState([]);
  const [cartera, setCartera] = useState([]);
  const [invGlobal, setInvGlobal] = useState(null);
  const [caminoResumen, setCaminoResumen] = useState([]);
  const [caminoAgotados, setCaminoAgotados] = useState([]);
  const [caminoRetrasadas, setCaminoRetrasadas] = useState([]);

  const [expanded, setExpanded] = useState({ alertas: true, canal: true, inventario: false });

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const [fa, fp, sc, sm, cart, invg, cr, ag, ret] = await Promise.all([
        safeFetch(supabase.from('v_vision_factura_canal').select('*').eq('anio', anio)),
        safeFetch(supabase.from('v_vision_factura_canal').select('*').eq('anio', anio - 1)),
        safeFetch(supabase.from('v_vision_sellout_canal').select('*').eq('anio', anio)),
        safeFetch(supabase.from('v_vision_sellout_mensual').select('*').eq('anio', anio)),
        safeFetch(supabase.from('v_vision_cartera_consolidada').select('*')),
        safeFetchOne(supabase.from('v_vision_inventario_global').select('*').single()),
        safeFetch(supabase.from('v_vision_camino_resumen').select('*')),
        safeFetch(supabase.from('v_vision_camino_agotados').select('*').limit(10)),
        safeFetch(supabase.from('v_vision_camino_retrasadas').select('*').limit(10)),
      ]);
      if (!alive) return;
      setFacCanalAct(fa); setFacCanalPrev(fp);
      setSoCanal(sc); setSoMensual(sm);
      setCartera(cart); setInvGlobal(invg);
      setCaminoResumen(cr); setCaminoAgotados(ag); setCaminoRetrasadas(ret);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, [anio]);

  // Último mes con data
  const mesActual = useMemo(() => {
    let last = 0;
    facCanalAct.forEach(r => { const m = Number(r.mes) || 0; if (m > last && Number(r.importe || r.venta || 0) > 0) last = m; });
    return last || new Date().getMonth() + 1;
  }, [facCanalAct]);

  // KPIs YTD
  const sellInYTD = useMemo(() => facCanalAct.reduce((s, r) => s + (Number(r.importe || r.venta || 0)), 0), [facCanalAct]);
  const sellInYTDPrev = useMemo(() => facCanalPrev.reduce((s, r) => s + (Number(r.importe || r.venta || 0)), 0), [facCanalPrev]);
  const sellOutYTD = useMemo(() => soCanal.reduce((s, r) => s + (Number(r.importe || 0)), 0), [soCanal]);

  const carteraTotal = useMemo(() => cartera.reduce((s, r) => s + (Number(r.saldo_actual_total || r.saldo_actual || 0)), 0), [cartera]);
  const carteraVencida = useMemo(() => cartera.reduce((s, r) => s + (Number(r.saldo_vencido || 0)), 0), [cartera]);
  const inventarioTotal = Number(invGlobal?.valor_total || invGlobal?.valor || 0);

  const deltaSI = sellInYTDPrev > 0 ? Math.round(((sellInYTD - sellInYTDPrev) / sellInYTDPrev) * 100) : null;
  const ratioSISO = sellInYTD > 0 ? Math.round((sellOutYTD / sellInYTD) * 100) : 0;

  // Por canal · sell in del mes actual
  const porCanal = useMemo(() => {
    const m = new Map();
    facCanalAct.filter(r => Number(r.mes) === mesActual).forEach(r => {
      const k = r.canal || r.cliente || 'otro';
      m.set(k, (m.get(k) || 0) + (Number(r.importe || r.venta || 0)));
    });
    // Fallback: si el mes actual está vacío, usar YTD
    if (m.size === 0) {
      facCanalAct.forEach(r => {
        const k = r.canal || r.cliente || 'otro';
        m.set(k, (m.get(k) || 0) + (Number(r.importe || r.venta || 0)));
      });
    }
    const arr = Array.from(m.entries()).map(([k, v]) => ({
      k, label: CANAL_LABEL[k] || k, color: CANAL_COLOR[k] || theme.accent, monto: v,
    })).sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 }));
  }, [facCanalAct, mesActual, theme.accent]);

  // Serie mensual SI vs SO
  const serieSI = useMemo(() => {
    const arr = Array(12).fill(0);
    facCanalAct.forEach(r => { const m = Number(r.mes) - 1; if (m >= 0 && m < 12) arr[m] += Number(r.importe || r.venta || 0); });
    return arr;
  }, [facCanalAct]);
  const serieSO = useMemo(() => {
    const arr = Array(12).fill(0);
    soMensual.forEach(r => { const m = Number(r.mes) - 1; if (m >= 0 && m < 12) arr[m] += Number(r.importe || r.monto || 0); });
    return arr;
  }, [soMensual]);

  // Camino resumen summary
  const embarquesActivos = useMemo(() => {
    const total = caminoResumen.find(r => r.tipo === 'total' || r.metric === 'oc_activas');
    if (total) return Number(total.valor || total.total || 0);
    return caminoResumen.length;
  }, [caminoResumen]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Back */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} /> Inicio
        </button>
        <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>Dirección Comercial</span>
      </div>

      {/* Título */}
      <div style={{ padding: '2px 18px 6px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Visión General</h1>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>
          {MES_FULL[mesActual - 1]} {anio} · YTD acumulado
        </div>
      </div>

      {/* Year picker */}
      <div style={{ padding: '10px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }} className="mvg-hide">
        {[anio - 2, anio - 1, anio, anio + 1].map(a => (
          <button key={a}
            onClick={() => setAnio(a)}
            style={{
              flex: '0 0 auto', padding: '7px 14px', borderRadius: 999,
              background: anio === a ? theme.text : theme.surface,
              border: `1px solid ${anio === a ? theme.text : theme.border}`,
              color: anio === a ? theme.bg : theme.textMuted,
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText,
              transition: 'background 240ms cubic-bezier(.32,.72,0,1), color 240ms',
            }}
          >{a}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : (
        <>
          {/* 2×2 KPI tiles */}
          <div style={{ padding: '6px 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label="Sell In YTD"
              value={fmtCompact(sellInYTD)}
              delta={deltaSI != null ? `${deltaSI > 0 ? '+' : ''}${deltaSI}% vs ${anio - 1}` : `${MES_CORTO[mesActual - 1]} ${anio}`}
              positive={deltaSI != null && deltaSI >= 0} />
            <KpiTile theme={theme} label="Sell Out YTD"
              value={fmtCompact(sellOutYTD)}
              delta={ratioSISO > 0 ? `${ratioSISO}% ratio SI/SO` : '—'}
              positive={ratioSISO >= 70} />
            <KpiTile theme={theme} label="Cartera total"
              value={fmtCompact(carteraTotal)}
              delta={carteraVencida > 0 ? `${fmtCompact(carteraVencida)} vencido` : 'al día'}
              positive={carteraVencida === 0} />
            <KpiTile theme={theme} label="Inventario"
              value={fmtCompact(inventarioTotal)}
              delta={embarquesActivos > 0 ? `${embarquesActivos} OCs activas` : '—'} />
          </div>

          {/* Alertas */}
          {(caminoAgotados.length > 0 || caminoRetrasadas.length > 0 || carteraVencida > 0) && (
            <Group theme={theme} isDark={isDark}
              title="Alertas críticas" count={caminoAgotados.length + caminoRetrasadas.length + (carteraVencida > 0 ? 1 : 0)}
              Icon={AlertTriangle} color={theme.red || '#FF3B30'}
              open={expanded.alertas} onToggle={() => setExpanded(p => ({ ...p, alertas: !p.alertas }))}
            >
              {carteraVencida > 0 && (
                <ItemRow theme={theme} label="Cartera vencida" valor={fmtCompact(carteraVencida)}
                  color={theme.red || '#FF3B30'} onClick={() => onNavegar(null, 'cobranzaGlobal')} />
              )}
              {caminoAgotados.slice(0, 5).map((r, i) => (
                <ItemRow key={`ag-${i}`} theme={theme}
                  label={`${r.sku || r.no_parte || 'SKU'} · Agotado`}
                  valor={r.dias_sin_venta ? `${r.dias_sin_venta}d` : '—'}
                  color={theme.orange || '#FF9500'} onClick={() => onNavegar(null, 'inventarioGlobal')} />
              ))}
              {caminoRetrasadas.slice(0, 5).map((r, i) => (
                <ItemRow key={`re-${i}`} theme={theme}
                  label={`OC ${r.numero_oc || r.numero_oc_cliente || '—'} · Retrasada`}
                  valor={r.dias_retraso ? `${r.dias_retraso}d` : '—'}
                  color={theme.pink || '#FF2D55'} onClick={() => onNavegar(null, 'ordenesCompra')} />
              ))}
            </Group>
          )}

          {/* Sell In vs Sell Out mensual */}
          {(serieSI.some(v => v > 0) || serieSO.some(v => v > 0)) && (
            <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>Sell In vs Sell Out</div>
                <div style={{ fontSize: 11, color: theme.textMuted }}>{anio} · mensual</div>
              </div>
              <div style={{ display: 'flex', gap: 12, marginBottom: 8, fontSize: 11, color: theme.textMuted }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.accent }} /> Sell In
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: theme.orange || '#FF9500' }} /> Sell Out
                </span>
              </div>
              <ChartSISO theme={theme} serieSI={serieSI} serieSO={serieSO} />
            </div>
          )}

          {/* Bar-list por canal */}
          {porCanal.length > 0 && (
            <Group theme={theme} isDark={isDark}
              title="Sell In por canal" count={porCanal.length}
              subValor={fmtCompact(porCanal.reduce((s, r) => s + r.monto, 0))}
              Icon={TrendingUp} color={theme.accent}
              open={expanded.canal} onToggle={() => setExpanded(p => ({ ...p, canal: !p.canal }))}
            >
              <div style={{ padding: '10px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {porCanal.map((r) => (
                  <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: theme.text, fontWeight: 600 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.color }} />
                      {r.label}
                    </span>
                    <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${r.pct}%`, background: r.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.32,.72,0,1)' }} />
                    </div>
                    <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtCompact(r.monto)}</span>
                  </div>
                ))}
              </div>
            </Group>
          )}

          {/* Camino de compras resumen */}
          {caminoResumen.length > 0 && (
            <Group theme={theme} isDark={isDark}
              title="Camino de compras" count={caminoResumen.length}
              Icon={Package} color={theme.purple || '#AF52DE'}
              open={expanded.inventario} onToggle={() => setExpanded(p => ({ ...p, inventario: !p.inventario }))}
            >
              {caminoResumen.map((r, i) => {
                const label = r.metric || r.tipo || r.categoria || `Item ${i + 1}`;
                const valor = r.valor ?? r.total ?? r.count ?? '—';
                return <ItemRow key={i} theme={theme} label={String(label).replace(/_/g, ' ')} valor={typeof valor === 'number' ? fmtInt(valor) : String(valor)} onClick={() => onNavegar(null, 'ordenesCompra')} />;
              })}
            </Group>
          )}

          <div style={{ height: 20 }} />
        </>
      )}

      <style>{`.mvg-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

// ─────────────── Sub-componentes ───────────────
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

function Group({ theme, isDark, title, count, subValor, Icon, color, open, onToggle, children }) {
  return (
    <div style={{ margin: '4px 18px 8px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <button onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
          background: 'transparent', border: 'none',
          borderBottom: open ? `1px solid ${theme.divider}` : 'none',
          cursor: 'pointer', textAlign: 'left', fontFamily: TYPO.fontText,
        }}
      >
        <div style={{ width: 30, height: 30, borderRadius: 8, background: color, display: 'grid', placeItems: 'center', color: '#fff' }}>
          <Icon size={15} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>{title}</div>
        </div>
        {subValor && <div style={{ fontSize: 12.5, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{subValor}</div>}
        {count != null && !subValor && <div style={{ fontSize: 11, color: theme.textMuted }}>{count}</div>}
        {open ? <ChevronDown size={14} style={{ color: theme.textSubtle }} /> : <ChevronRight size={14} style={{ color: theme.textSubtle }} />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function ItemRow({ theme, label, valor, color, onClick }) {
  return (
    <button onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px', background: 'transparent', border: 'none',
        borderTop: `1px solid ${theme.divider}`, cursor: 'pointer', textAlign: 'left',
        fontFamily: TYPO.fontText, color: theme.text, fontSize: 12.5,
      }}
    >
      {color && <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flex: '0 0 auto' }} />}
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <span style={{ color: color || theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700, fontSize: 12 }}>{valor}</span>
    </button>
  );
}

function ChartSISO({ theme, serieSI, serieSO }) {
  const maxIdx = (() => {
    let m = -1;
    for (let i = 0; i < 12; i++) if (Math.abs(serieSI[i]) > 0 || Math.abs(serieSO[i]) > 0) m = i;
    return m;
  })();
  const nMeses = maxIdx + 1;
  if (nMeses <= 0) return <div style={{ padding: 12, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>Sin data mensual</div>;

  const W = 340, H = 130, PAD_TOP = 4, PAD_BOTTOM = 18;
  const maxV = Math.max(...serieSI.slice(0, nMeses), ...serieSO.slice(0, nMeses), 1);
  const slotW = W / Math.max(nMeses, 1);
  const barW = Math.min(16, slotW * 0.4);
  const scale = (v) => ((H - PAD_TOP - PAD_BOTTOM) * Math.abs(v)) / maxV;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} preserveAspectRatio="none">
      {Array.from({ length: nMeses }).map((_, i) => {
        const v = serieSI[i] || 0;
        const u = serieSO[i] || 0;
        const cx = i * slotW + slotW / 2;
        const hv = scale(v);
        const hu = scale(u);
        return (
          <g key={i}>
            <rect x={cx - barW - 1} y={H - PAD_BOTTOM - hv} width={barW} height={hv} fill={theme.accent} opacity="0.9" rx="1.5" />
            <rect x={cx + 1} y={H - PAD_BOTTOM - hu} width={barW} height={hu} fill={theme.orange || '#FF9500'} opacity="0.9" rx="1.5" />
            <text x={cx} y={H - 4} textAnchor="middle" fontSize="9" fill={theme.textMuted} fontFamily={TYPO.fontText}>{MES_CORTO[i]}</text>
          </g>
        );
      })}
    </svg>
  );
}
