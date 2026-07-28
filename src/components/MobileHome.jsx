// MobileHome — Resumen mobile-native con segmented Negocio/Clientes.
// Estructura Health-style aprobada en mockup v3.
//
// - Segmented: Negocio ↔ Mis Clientes (persistido en localStorage)
// - Ferruteck card B con logo original (gradient rosa→naranja + sparkle)
// - Grupos colapsables tema-aware (Claro/Midnight/Marfil)
// - Iconografía Lucide idéntica al sidebar web

import React, { useEffect, useMemo, useState } from 'react';
import {
  ChevronRight, ChevronDown, Sparkles,
  ShoppingCart, ShoppingBag, HandCoins, ClipboardList, Package,
  Activity, Calculator, PieChart, Target, TrendingUp, FileCheck, Building2, Users,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { formatMXN } from '../lib/utils';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = {
  digitalife: '#5856D6',
  dicotech:   '#FF9500',
  pcel:       '#34C759',
};
const MES_ACTUAL = { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
const MES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

const LS_KEY = 'mobile_home_mode';
const loadMode = () => { try { return localStorage.getItem(LS_KEY) || 'negocio'; } catch { return 'negocio'; } };
const saveMode = (m) => { try { localStorage.setItem(LS_KEY, m); } catch {} };

export default function MobileHome({ perfil, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const [mode, setMode] = useState(loadMode);
  useEffect(() => { saveMode(mode); }, [mode]);

  const [ventas, setVentas] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [cartera, setCartera] = useState({}); // { cliente: { saldo_actual, saldo_vencido, dso } }
  const [pendCount, setPendCount] = useState(0);
  const [mesData, setMesData] = useState(MES_ACTUAL.mes); // mes real con data (puede no ser el mes actual)

  useEffect(() => {
    let alive = true;
    (async () => {
      const [v, c, dso, p] = await Promise.all([
        // Traer todos los meses del año, luego escogemos el último con data
        supabase.from('v_ventas_mensuales_agg').select('cliente,anio,mes,sell_in').eq('anio', MES_ACTUAL.anio),
        supabase.from('cuotas_mensuales').select('cliente,anio,mes,cuota_min,cuota_ideal,cuota_meta').eq('anio', MES_ACTUAL.anio),
        supabase.from('v_dso_real').select('cliente,saldo_actual_total,saldo_vencido,dso_real,dso_erp'),
        supabase.from('pendientes_equipo').select('id', { count: 'exact', head: true }).eq('estatus', 'pendiente'),
      ]);
      if (!alive) return;
      setVentas(v.data || []);
      setCuotas(c.data || []);

      // Cartera map por cliente
      const cMap = {};
      (dso.data || []).forEach(r => {
        cMap[r.cliente] = {
          saldo: Number(r.saldo_actual_total) || 0,
          vencido: Number(r.saldo_vencido) || 0,
          dso: r.dso_real != null ? Math.round(Number(r.dso_real)) : (r.dso_erp != null ? Math.round(Number(r.dso_erp)) : null),
        };
      });
      setCartera(cMap);

      setPendCount(p.count || 0);

      // Detectar el último mes con al menos un dato de sell_in > 0
      const mesesConData = new Set((v.data || []).filter(r => Number(r.sell_in) > 0).map(r => Number(r.mes)));
      const ultimoMes = Math.max(0, ...Array.from(mesesConData));
      if (ultimoMes > 0) setMesData(ultimoMes);
    })();
    return () => { alive = false; };
  }, []);

  // Agregados del último mes con data
  const clienteKpis = useMemo(() => {
    const out = {};
    (ventas || []).filter(r => Number(r.mes) === mesData).forEach((r) => {
      if (!out[r.cliente]) out[r.cliente] = { facturado: 0, cuota: 0 };
      out[r.cliente].facturado += Number(r.sell_in || 0);
    });
    (cuotas || []).filter(r => Number(r.mes) === mesData).forEach((r) => {
      if (!out[r.cliente]) out[r.cliente] = { facturado: 0, cuota: 0 };
      out[r.cliente].cuota += Number(r.cuota_min || r.cuota_ideal || r.cuota_meta || 0);
    });
    Object.entries(out).forEach(([k, v]) => {
      v.pct = v.cuota > 0 ? Math.round((v.facturado / v.cuota) * 100) : 0;
      v.gap = Math.max(0, v.cuota - v.facturado);
    });
    return out;
  }, [ventas, cuotas, mesData]);

  const totales = useMemo(() => {
    const vals = Object.values(clienteKpis);
    const facturado = vals.reduce((s, v) => s + v.facturado, 0);
    const cuota = vals.reduce((s, v) => s + v.cuota, 0);
    const gap = vals.reduce((s, v) => s + v.gap, 0);
    const pct = cuota > 0 ? Math.round((facturado / cuota) * 100) : 0;
    return { facturado, cuota, gap, pct };
  }, [clienteKpis]);

  const diasRestantes = useMemo(() => {
    const now = new Date();
    const ult = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return Math.max(0, Math.ceil((ult - now) / (1000 * 60 * 60 * 24)));
  }, []);

  return (
    <div style={{
      background: theme.bg, color: theme.text,
      fontFamily: TYPO.fontText, minHeight: '100vh',
    }}>
      {/* Título */}
      <div style={{ padding: '10px 18px 4px' }}>
        <h1 style={{
          margin: 0, fontFamily: TYPO.fontDisplay,
          fontSize: 32, fontWeight: 700, letterSpacing: '-.03em',
          color: theme.text,
        }}>Resumen</h1>
      </div>

      {/* Segmented Negocio / Clientes */}
      <div style={{
        margin: '8px 18px 12px', padding: 3,
        background: isDark ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)',
        borderRadius: 10,
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3,
      }}>
        {['negocio', 'clientes'].map((m) => (
          <button key={m}
            onClick={() => setMode(m)}
            style={{
              padding: '8px 10px', borderRadius: 8, border: 'none',
              background: mode === m ? theme.surface : 'transparent',
              color: mode === m ? theme.text : theme.textMuted,
              fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: mode === m ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              transition: 'background 160ms, color 160ms',
            }}
          >{m === 'negocio' ? 'Negocio' : 'Mis Clientes'}</button>
        ))}
      </div>

      {/* Highlight card */}
      <div style={{
        margin: '0 18px 10px', padding: '14px 16px',
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted }}>
            {mode === 'negocio'
              ? `Cierre ${MES_FULL[MES_ACTUAL.mes - 1]} · consolidado`
              : `${Object.keys(CLIENTES).filter(k => CLIENTES[k].activo).length} clientes · ${MES_FULL[MES_ACTUAL.mes - 1]}`}
          </div>
          <button
            onClick={() => onNavegar(null, mode === 'negocio' ? 'estadoResultados' : 'analisisClientes')}
            style={{ background: 'transparent', border: 'none', color: theme.accent, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}
          >{mode === 'negocio' ? 'EdR ›' : 'Ver todo'}</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Metric theme={theme} label={mode === 'negocio' ? 'Facturación' : 'Cuota total'}
            value={mode === 'negocio' ? formatMXN(totales.facturado) : `${totales.pct}%`}
            delta="+9% YoY" positive />
          <Metric theme={theme} label={mode === 'negocio' ? 'Gap' : 'Gap consolidado'}
            value={formatMXN(totales.gap)}
            delta={`${diasRestantes}d restantes`} positive={false} />
        </div>
      </div>

      {/* Ferruteck card B */}
      <FerruteckCard theme={theme} isDark={isDark} onNavegar={onNavegar} />

      {/* Contenido según modo */}
      {mode === 'negocio' ? (
        <GruposNegocio theme={theme} isDark={isDark} onNavegar={onNavegar} totales={totales} pendCount={pendCount} />
      ) : (
        <ListaClientes theme={theme} isDark={isDark} onNavegar={onNavegar} clienteKpis={clienteKpis} cartera={cartera} mesData={mesData} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Ferruteck card B (protagonista) — con logo original
// ═══════════════════════════════════════════════════════════════════════
function FerruteckCard({ theme, isDark, onNavegar }) {
  const suggestions = [
    { tag: 'Top movidos', txt: '12 SKUs con inv', valor: '$96K', accion: () => onNavegar(null, 'propuestas') },
    { tag: 'Reposición',  txt: 'Cobertura baja', valor: '$45K', accion: () => onNavegar(null, 'inventarioGlobal') },
    { tag: 'Oportunidad', txt: 'Precio agresivo', valor: '$193K', accion: () => onNavegar(null, 'estrategiaPrecios') },
  ];
  return (
    <div style={{
      margin: '0 18px 10px', padding: '14px 16px', borderRadius: 18,
      background: isDark
        ? 'linear-gradient(135deg, rgba(255,55,95,.14), rgba(255,159,10,.08))'
        : 'linear-gradient(135deg, rgba(255,45,85,.10), rgba(255,149,0,.06))',
      border: `1px solid ${isDark ? 'rgba(255,55,95,.28)' : 'rgba(255,45,85,.20)'}`,
      position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '-30%', right: '-10%', width: '60%', height: '130%',
        background: 'radial-gradient(circle, rgba(255,149,0,.14), transparent 65%)',
        pointerEvents: 'none',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 12,
          background: 'linear-gradient(135deg, #FF2D55, #FF9500)',
          display: 'grid', placeItems: 'center', color: '#fff',
          boxShadow: '0 6px 14px rgba(255,45,85,.30)',
        }}>
          <Sparkles size={18} strokeWidth={2} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 800, letterSpacing: '-.01em', color: theme.text }}>Ferruteck</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1 }}>3 sugerencias para cerrar el mes</div>
        </div>
        <span style={{
          padding: '3px 8px', borderRadius: 100, background: theme.pink || '#FF375F',
          color: '#fff', fontSize: 10.5, fontWeight: 800,
        }}>3</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12, position: 'relative' }}>
        {suggestions.map((s, i) => (
          <button key={i} onClick={s.accion}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '9px 12px', background: isDark ? 'rgba(255,255,255,.04)' : theme.surface,
              border: `1px solid ${theme.border}`, borderRadius: 10, cursor: 'pointer',
              textAlign: 'left', fontFamily: TYPO.fontText,
              transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)',
            }}
            onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.98)'}
            onPointerUp={(e) => e.currentTarget.style.transform = ''}
            onPointerLeave={(e) => e.currentTarget.style.transform = ''}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{s.tag}</span>
              <span style={{ fontSize: 12.5, color: theme.text, fontWeight: 600 }}>{s.txt}</span>
            </div>
            <span style={{ color: theme.text, fontVariantNumeric: 'tabular-nums', fontSize: 12.5, fontWeight: 700 }}>{s.valor}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Grupos NEGOCIO — Dirección General + Dirección Comercial
// ═══════════════════════════════════════════════════════════════════════
function GruposNegocio({ theme, isDark, onNavegar, totales, pendCount }) {
  const [expanded, setExpanded] = useState({ dgral: true, dcom: true });
  const toggle = (k) => setExpanded((s) => ({ ...s, [k]: !s[k] }));

  const dgral = [
    { id: 'estadoResultados', label: 'Estado de Resultados', valor: formatMXN(totales.facturado || 0) },
  ];
  const dcom = [
    { id: 'visionGeneral',    label: 'Visión General',      valor: '+12% vs mes anterior', positive: true },
    { id: 'analisisClientes', label: 'Análisis por Cliente', valor: '3 activos' },
    { id: 'sellIn',           label: 'Sell In',             valor: formatMXN(totales.facturado || 0), positive: true },
    { id: 'sellOut',          label: 'Sell Out',            valor: 'Ver detalle' },
    { id: 'inventarioGlobal', label: 'Inventario',          valor: 'Ver detalle' },
    { id: 'cobranzaGlobal',   label: 'Cobranza',            valor: 'Ver detalle' },
    { id: 'forecastClientes', label: 'S&OP',                valor: 'Q3 forecast' },
  ];

  return (
    <div style={{ padding: '4px 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Group theme={theme} isDark={isDark}
        title="Dirección General" count={dgral.length}
        icon={<Calculator size={16} />} iconBg={theme.indigo || '#5856D6'}
        open={expanded.dgral} onToggle={() => toggle('dgral')}
      >
        {dgral.map((r) => (
          <GroupItem key={r.id} theme={theme} label={r.label} valor={r.valor}
            onClick={() => onNavegar(null, r.id)} />
        ))}
      </Group>
      <Group theme={theme} isDark={isDark}
        title="Dirección Comercial" count={dcom.length}
        icon={<Activity size={16} />} iconBg={theme.accent}
        open={expanded.dcom} onToggle={() => toggle('dcom')}
      >
        {dcom.map((r) => (
          <GroupItem key={r.id} theme={theme} label={r.label} valor={r.valor} positive={r.positive}
            onClick={() => onNavegar(null, r.id)} />
        ))}
      </Group>
      {/* Grupo Documentos colapsable */}
      <Group theme={theme} isDark={isDark}
        title="Documentos" count={3}
        icon={<Package size={16} />} iconBg={theme.purple || '#AF52DE'}
        open={expanded.docs} onToggle={() => toggle('docs')}
      >
        <GroupItem theme={theme} label="Propuestas" valor="Ver activas" onClick={() => onNavegar(null, 'propuestas')} />
        <GroupItem theme={theme} label="Estrategia de Precios" valor="Ver listas" onClick={() => onNavegar(null, 'estrategiaPrecios')} />
        <GroupItem theme={theme} label="Tracking Pedidos" valor="Ver OC" onClick={() => onNavegar(null, 'ordenesCompra')} />
      </Group>
      {/* Grupo Operación mobile-only */}
      <Group theme={theme} isDark={isDark}
        title="Operación" count={pendCount ? 2 : 1}
        icon={<ClipboardList size={16} />} iconBg={theme.orange || '#FF9500'}
        open={expanded.oper} onToggle={() => toggle('oper')}
      >
        <GroupItem theme={theme} label="Pendientes hoy" valor={`${pendCount || 0}`}
          onClick={() => onNavegar(null, 'adminInterna')} />
        <GroupItem theme={theme} label="Actividad del equipo" valor="En vivo"
          onClick={() => onNavegar(null, 'telemetria')} />
      </Group>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Lista MIS CLIENTES — cards por cliente con KPIs + barra
// ═══════════════════════════════════════════════════════════════════════
function ListaClientes({ theme, isDark, onNavegar, clienteKpis, cartera, mesData }) {
  const lista = Object.keys(CLIENTES).filter((k) => CLIENTES[k].activo);
  const [expandedId, setExpandedId] = useState(null);
  const toggle = (id) => setExpandedId((cur) => cur === id ? null : id);

  const PESTANA_ICON = {
    home: Building2, sellIn: ShoppingCart, estrategia: ShoppingBag,
    marketing: Users, pagos: HandCoins, cartera: FileCheck,
  };
  const PESTANA_COLOR = {
    home: '#8E8E93', sellIn: '#007AFF', estrategia: '#FF9500',
    marketing: '#AF52DE', pagos: '#34C759', cartera: '#FF2D55',
  };

  return (
    <div style={{ padding: '4px 18px 24px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lista.map((id) => {
        const cli = CLIENTES[id];
        const kpi = clienteKpis[id] || { facturado: 0, cuota: 0, gap: 0, pct: 0 };
        const car = cartera?.[id];
        const color = CLIENTE_DOT[id] || theme.accent;
        const expanded = expandedId === id;
        const pestanas = (cli.pestanas || []).filter(p => !p.disabled);

        return (
          <div key={id} style={{
            background: theme.surface, border: `1px solid ${expanded ? color : theme.border}`,
            borderRadius: 16, overflow: 'hidden',
            transition: 'border-color 200ms cubic-bezier(.4,0,.2,1)',
          }}>
            {/* Cabecera tap para expandir */}
            <button
              onClick={() => toggle(id)}
              style={{
                width: '100%', background: 'transparent', border: 'none',
                padding: 14, textAlign: 'left', cursor: 'pointer', fontFamily: TYPO.fontText,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <div style={{
                  width: 34, height: 34, borderRadius: 10, background: color,
                  color: '#fff', display: 'grid', placeItems: 'center',
                  fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13,
                }}>{cli.label.slice(0, 2).toUpperCase()}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 700, letterSpacing: '-.01em', color: theme.text }}>{cli.label}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, fontWeight: 500, marginTop: 1 }}>{id === 'pcel' ? 'Acteck' : 'Acteck · Balam Rush'}</div>
                </div>
                {expanded
                  ? <ChevronDown size={16} style={{ color }} />
                  : <ChevronRight size={16} style={{ color: theme.textSubtle }} />}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                <ClienteMetric theme={theme} label="Sell In" value={formatMXN(kpi.facturado)}
                  sub={`${MES_FULL[mesData - 1]?.slice(0, 3) || ''}`} />
                <ClienteMetric theme={theme} label="Cuota" value={`${kpi.pct}%`}
                  sub={kpi.gap > 0 ? `Gap ${formatMXN(kpi.gap)}` : 'On track'}
                  positive={kpi.gap === 0} />
                <ClienteMetric theme={theme} label="Cartera"
                  value={car?.saldo ? formatMXN(car.saldo) : '—'}
                  sub={car?.dso != null ? `DSO ${car.dso}d` : car?.saldo ? '—' : 'Ver detalle'}
                  positive={car?.dso != null && car.dso <= 30 ? true : car?.dso > 60 ? false : undefined} />
              </div>
              <div style={{
                height: 4, background: isDark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.08)',
                borderRadius: 2, marginTop: 10, overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${Math.min(100, kpi.pct)}%`,
                  background: color, borderRadius: 2,
                  transition: 'width 400ms cubic-bezier(.4,0,.2,1)',
                }} />
              </div>
            </button>

            {/* Sub-menú de pestañas del cliente */}
            {expanded && (
              <div style={{
                borderTop: `1px solid ${theme.divider}`,
                background: isDark ? 'rgba(255,255,255,.02)' : 'rgba(0,0,0,.015)',
                animation: 'mhClienteExpand 220ms cubic-bezier(.4,0,.2,1)',
              }}>
                {pestanas.map((p) => {
                  const Icon = PESTANA_ICON[p.id] || Building2;
                  const iconCol = PESTANA_COLOR[p.id] || theme.accent;
                  return (
                    <button
                      key={p.id}
                      onClick={() => onNavegar(id, p.id)}
                      style={{
                        width: '100%', padding: '11px 14px', background: 'transparent', border: 'none',
                        borderTop: `1px solid ${theme.divider}`, cursor: 'pointer', textAlign: 'left',
                        display: 'flex', alignItems: 'center', gap: 12, fontFamily: TYPO.fontText,
                        color: theme.text, transition: 'background 160ms',
                      }}
                      onPointerEnter={(e) => e.currentTarget.style.background = theme.surfaceHover}
                      onPointerLeave={(e) => e.currentTarget.style.background = 'transparent'}
                    >
                      <div style={{
                        width: 28, height: 28, borderRadius: 8, background: `${iconCol}18`, color: iconCol,
                        display: 'grid', placeItems: 'center', flex: '0 0 auto',
                      }}>
                        <Icon size={14} strokeWidth={2} />
                      </div>
                      <div style={{ flex: 1, fontSize: 13.5, fontWeight: 500 }}>{p.label}</div>
                      <ChevronRight size={14} style={{ color: theme.textSubtle }} />
                    </button>
                  );
                })}
              </div>
            )}
            <style>{`@keyframes mhClienteExpand { from { opacity: 0; max-height: 0; } to { opacity: 1; max-height: 500px; } }`}</style>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// Piezas reutilizables
// ═══════════════════════════════════════════════════════════════════════
function Metric({ theme, label, value, delta, positive }) {
  const color = positive ? (theme.green || '#34C759') : (theme.pink || theme.red || '#FF3B30');
  return (
    <div>
      <div style={{ fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-.025em', marginTop: 2, fontVariantNumeric: 'tabular-nums', color: theme.text, fontFamily: TYPO.fontDisplay }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 1, color }}>{delta}</div>
    </div>
  );
}

function Group({ theme, isDark, title, count, icon, iconBg, open, onToggle, children }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 16, overflow: 'hidden',
    }}>
      <button
        onClick={onToggle}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 14px', background: 'transparent', border: 'none',
          borderBottom: open ? `1px solid ${theme.divider}` : 'none',
          cursor: 'pointer', textAlign: 'left', color: theme.text,
        }}
      >
        <div style={{
          width: 30, height: 30, borderRadius: 8, background: iconBg,
          color: '#fff', display: 'grid', placeItems: 'center',
        }}>{icon}</div>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: '-.01em' }}>{title}</div>
        <div style={{ marginLeft: 'auto', fontSize: 11, color: theme.textMuted }}>{count}</div>
        {open
          ? <ChevronDown size={16} style={{ color: theme.textSubtle }} />
          : <ChevronRight size={16} style={{ color: theme.textSubtle }} />}
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

function GroupItem({ theme, label, valor, onClick, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px', gap: 12,
        background: 'transparent', border: 'none', cursor: 'pointer',
        borderTop: `1px solid ${theme.divider}`, color: theme.text,
        fontFamily: TYPO.fontText, fontSize: 13, textAlign: 'left',
      }}
    >
      <span style={{ color: theme.text }}>{label}</span>
      <span style={{ color, fontSize: 12, fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{valor}</span>
    </button>
  );
}

function ClienteMetric({ theme, label, value, sub, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || '#FF375F') : theme.textMuted;
  return (
    <div>
      <div style={{ fontSize: 9.5, textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, letterSpacing: '.06em' }}>{label}</div>
      <div style={{ fontSize: 17, fontWeight: 700, letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums', marginTop: 2, color: theme.text, fontFamily: TYPO.fontDisplay }}>{value}</div>
      {sub && <div style={{ fontSize: 10, fontWeight: 600, marginTop: 1, color }}>{sub}</div>}
    </div>
  );
}
