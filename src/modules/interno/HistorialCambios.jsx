// HistorialCambios · auditoría de las tablas que la app escribe.
// Lee `auditoria_cambios` (la llena el trigger fn_auditoria, migración
// 20260910_auditoria_cambios.sql). Lectura directa con supabase.from —
// sin cachedQuery: la tabla cambia a cada rato.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando } from '../../components/kit';
import { ChevronDown, ChevronRight, History, Search, RefreshCw } from 'lucide-react';

// ═══════════════════ Constantes ═══════════════════
const PAGE = 50;

const TABLA_LABEL = {
  pagos: 'Pagos',
  pendientes: 'Pendientes',
  pendientes_equipo: 'Pendientes equipo',
  tareas_recurrentes: 'Tareas recurrentes',
  minutas: 'Minutas',
  minuta_acuerdos: 'Acuerdos de minuta',
  inversion_marketing: 'Inversión marketing',
  marketing_actividades: 'Actividades marketing',
  fondos_mkt_movimientos: 'Fondo marketing',
  propuestas_borradores: 'Propuestas (borradores)',
  propuestas_equipo: 'Propuestas equipo',
  spiffs: 'SPIFFs',
  lineamientos_cliente: 'Lineamientos',
  forecast_propuestas: 'Forecast · propuestas',
  forecast_propuesta_lineas: 'Forecast · líneas',
  forecast_avisos: 'Forecast · avisos',
  sugeridos_compra: 'Sugeridos de compra',
  solicitudes_compra: 'Solicitudes de compra',
  solicitudes_compra_lineas: 'Solicitudes · líneas',
  oc_clientes: 'OCs',
  oc_clientes_skus: 'OCs · SKUs',
  oc_envios: 'Envíos',
  oc_envio_skus: 'Envíos · SKUs',
  perfiles: 'Usuarios',
  cuotas_mensuales: 'Cuotas',
  cuotas_canales: 'Cuotas por canal',
  clientes_credito_config: 'Crédito clientes',
  evaluaciones: 'Evaluaciones',
  evaluaciones_mensuales: 'Evaluaciones mensuales',
  evaluaciones_kpis_template: 'KPIs evaluación',
  eventos_cliente: 'Eventos cliente',
  eventos_equipo: 'Eventos equipo',
  sku_config: 'Config SKU',
  almacenes_config: 'Almacenes',
  roadmap_sku: 'Roadmap SKU',
  ventas_mensuales: 'Ventas mensuales',
};
const tablaLabel = (t) => TABLA_LABEL[t] || (t || '').replace(/_/g, ' ');

const CLIENTE_LABEL = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
const clienteLabel = (c) => CLIENTE_LABEL[c] || c;

const OP_LABEL = { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Baja' };

const RANGOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'todo', label: 'Todo' },
];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// ═══════════════════ Helpers ═══════════════════
const inicioHoy = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
const haceDias = (n) => new Date(Date.now() - n * 864e5);

function desdeRango(rango) {
  if (rango === 'hoy') return inicioHoy().toISOString();
  if (rango === '7d') return haceDias(7).toISOString();
  if (rango === '30d') return haceDias(30).toISOString();
  return null;
}

const pad2 = (n) => String(n).padStart(2, '0');
const hhmm = (d) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

function fmtRelativo(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const diff = Math.max(0, (Date.now() - d.getTime()) / 1000);
  if (diff < 60) return 'ahora mismo';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  const hoy = inicioHoy();
  if (d >= hoy) return `hoy ${hhmm(d)}`;
  if (d >= new Date(hoy.getTime() - 864e5)) return `ayer ${hhmm(d)}`;
  const mismoAnio = d.getFullYear() === new Date().getFullYear();
  return `${d.getDate()} ${MESES[d.getMonth()]}${mismoAnio ? '' : ` ${d.getFullYear()}`} ${hhmm(d)}`;
}

function fmtAbsoluto(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} · ${hhmm(d)}:${pad2(d.getSeconds())}`;
}

const isoFechaRe = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?/;

function fmtValor(v, corto = true) {
  if (v === null || v === undefined) return '∅';
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'number') return v.toLocaleString('es-MX', { maximumFractionDigits: 2 });
  if (typeof v === 'object') {
    const s = JSON.stringify(v);
    return corto && s.length > 48 ? `${s.slice(0, 45)}…` : s;
  }
  const s = String(v);
  if (isoFechaRe.test(s) && s.length >= 19 && s.includes('T')) {
    const d = new Date(s);
    if (!isNaN(d)) return `${d.getDate()} ${MESES[d.getMonth()]} ${d.getFullYear()} ${hhmm(d)}`;
  }
  return corto && s.length > 48 ? `${s.slice(0, 45)}…` : s;
}

function iniciales(email) {
  if (!email) return 'SYS';
  const local = email.split('@')[0];
  const partes = local.split(/[._-]+/).filter(Boolean);
  return (partes.length >= 2 ? partes[0][0] + partes[1][0] : local.slice(0, 2)).toUpperCase();
}

function nombreCorto(email) {
  if (!email) return 'Sistema';
  const local = email.split('@')[0];
  return local.split(/[._-]+/).filter(Boolean)
    .map((p) => p[0].toUpperCase() + p.slice(1)).join(' ');
}

// Color estable por email (hash → paleta iOS)
const PALETA_AVATAR = ['#007AFF', '#AF52DE', '#FF9500', '#34C759', '#FF2D55', '#5AC8FA', '#5856D6', '#FFCC00'];
function colorAvatar(email) {
  if (!email) return '#86868B';
  let h = 0;
  for (let i = 0; i < email.length; i++) h = (h * 31 + email.charCodeAt(i)) >>> 0;
  return PALETA_AVATAR[h % PALETA_AVATAR.length];
}

// Lista plana de cambios [{campo, de, a}] a partir del jsonb `cambios`
function listaCambios(row) {
  const c = row.cambios || {};
  if (row.operacion === 'UPDATE') {
    return Object.entries(c).map(([campo, v]) => ({ campo, de: v?.de, a: v?.a }));
  }
  return Object.entries(c).map(([campo, v]) => ({ campo, de: undefined, a: v }));
}

// ═══════════════════ Componente ═══════════════════
export default function HistorialCambios() {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const P = {
    blue: theme.accent || '#007AFF',
    green: theme.green || '#34C759',
    red: theme.red || '#FF3B30',
    orange: theme.orange || '#FF9500',
  };
  const border = `1px solid ${theme.border}`;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  // Filtros
  const [rango, setRango] = useState('7d');
  const [tabla, setTabla] = useState(null);
  const [usuario, setUsuario] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [busqueda, setBusqueda] = useState('');
  const [q, setQ] = useState(''); // búsqueda con debounce

  // Datos
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState(null);
  const [expandidos, setExpandidos] = useState(() => new Set());
  const [refreshTick, setRefreshTick] = useState(0);

  // KPIs + facetas (últimos 30 días)
  const [kpi, setKpi] = useState({ hoy: null, semana: null, usuarios: null });
  const [facetas, setFacetas] = useState({ tablas: [], usuarios: [], clientes: [] });

  useEffect(() => {
    const t = setTimeout(() => setQ(busqueda.trim()), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Construye la query con filtros (sin cursor)
  const buildQuery = useCallback(() => {
    let b = supabase.from('auditoria_cambios').select('*');
    const desde = desdeRango(rango);
    if (desde) b = b.gte('creado_at', desde);
    if (tabla) b = b.eq('tabla', tabla);
    if (usuario) b = usuario === '__sys__' ? b.is('usuario_email', null) : b.eq('usuario_email', usuario);
    if (cliente) b = cliente === '__none__' ? b.is('cliente_key', null) : b.eq('cliente_key', cliente);
    if (q) {
      const s = q.replace(/[%,()]/g, ' ').trim();
      if (s) b = b.or(`registro_id.ilike.%${s}%,usuario_email.ilike.%${s}%,tabla.ilike.%${s}%,cliente_key.ilike.%${s}%`);
    }
    return b;
  }, [rango, tabla, usuario, cliente, q]);

  // Primera página (se reinicia al cambiar filtros)
  useEffect(() => {
    let cancel = false;
    setLoading(true); setError(null); setExpandidos(new Set());
    buildQuery().order('id', { ascending: false }).limit(PAGE)
      .then(({ data, error: err }) => {
        if (cancel) return;
        if (err) { setError(err.message); setRows([]); setHasMore(false); }
        else { setRows(data || []); setHasMore((data || []).length === PAGE); }
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [buildQuery, refreshTick]);

  const cargarMas = async () => {
    if (!rows.length || loadingMore) return;
    setLoadingMore(true);
    const cursor = rows[rows.length - 1].id;
    const { data, error: err } = await buildQuery().lt('id', cursor).order('id', { ascending: false }).limit(PAGE);
    if (err) setError(err.message);
    else {
      setRows((prev) => [...prev, ...(data || [])]);
      setHasMore((data || []).length === PAGE);
    }
    setLoadingMore(false);
  };

  // KPIs + facetas
  useEffect(() => {
    let cancel = false;
    // Un builder por consulta: en supabase-js v2 comparten la URL si se reusa from().
    const t = () => supabase.from('auditoria_cambios');
    Promise.all([
      t().select('id', { count: 'exact', head: true }).gte('creado_at', inicioHoy().toISOString()),
      t().select('id', { count: 'exact', head: true }).gte('creado_at', haceDias(7).toISOString()),
      t().select('tabla,usuario_email,cliente_key').gte('creado_at', haceDias(30).toISOString()).order('id', { ascending: false }).limit(5000),
    ]).then(([h, s, f]) => {
      if (cancel) return;
      const rowsF = f.data || [];
      const cnt = (key) => {
        const m = new Map();
        rowsF.forEach((r) => { const k = r[key]; m.set(k, (m.get(k) || 0) + 1); });
        return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => ({ k, n }));
      };
      const us = cnt('usuario_email');
      setKpi({
        hoy: h.count ?? 0,
        semana: s.count ?? 0,
        usuarios: us.filter((u) => u.k).length,
      });
      setFacetas({ tablas: cnt('tabla'), usuarios: us, clientes: cnt('cliente_key') });
    }).catch(() => { /* KPIs son decorativos */ });
    return () => { cancel = true; };
  }, [refreshTick]);

  const toggle = (id) => setExpandidos((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const hayFiltro = !!(tabla || usuario || cliente || q);
  const limpiar = () => { setTabla(null); setUsuario(null); setCliente(null); setBusqueda(''); setQ(''); };

  const opColor = (op) => (op === 'INSERT' ? P.green : op === 'DELETE' ? P.red : P.blue);

  const ultimo = rows[0];
  const narrativa = useMemo(() => {
    if (kpi.hoy == null) return 'Quién cambió qué y cuándo.';
    if (kpi.hoy === 0) return 'Sin movimientos hoy.';
    return `${kpi.hoy} ${kpi.hoy === 1 ? 'cambio' : 'cambios'} hoy en lo que la app escribe.`;
  }, [kpi.hoy]);

  // ─── Estilos reutilizables ───
  const pillStyle = (activo, color = P.blue) => ({
    fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.01em',
    padding: '4px 10px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
    border: `1px solid ${activo ? color : theme.border}`,
    background: activo ? `${color}1A` : 'transparent',
    color: activo ? color : theme.textMuted,
    transition: 'all 120ms',
    display: 'inline-flex', alignItems: 'center', gap: 5,
  });
  const eyebrow = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 };
  const th = { ...eyebrow, textAlign: 'left', padding: '6px 8px', borderBottom: border, whiteSpace: 'nowrap' };
  const td = { padding: '7px 8px', fontSize: 12, verticalAlign: 'top', borderBottom: `1px solid ${theme.border}` };

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* ═══ Hero ═══ */}
      <div style={{
        background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 20, alignItems: 'center',
      }}>
        <div style={{ minWidth: 0 }}>
          <span style={{ ...eyebrow, color: 'rgba(255,255,255,0.55)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <History style={{ width: 11, height: 11 }} strokeWidth={2.2} />
            Administración interna · auditoría
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            Historial de cambios
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 440, lineHeight: 1.4, margin: 0 }}>
            {narrativa}{ultimo ? ` Último: ${nombreCorto(ultimo.usuario_email)} en ${tablaLabel(ultimo.tabla)}, ${fmtRelativo(ultimo.creado_at)}.` : ''}
          </p>
        </div>
        <HeroStat k="Hoy" v={kpi.hoy == null ? '—' : kpi.hoy.toLocaleString('es-MX')} sub="cambios" mono={mono} />
        <HeroStat k="Esta semana" v={kpi.semana == null ? '—' : kpi.semana.toLocaleString('es-MX')} sub="últimos 7 días" mono={mono} />
        <HeroStat k="Usuarios activos" v={kpi.usuarios == null ? '—' : String(kpi.usuarios)} sub="últimos 30 días" mono={mono} />
      </div>

      {/* ═══ Filtros ═══ */}
      <div style={{ background: theme.surface, border, borderRadius: 12, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {/* Rango · segmented */}
          <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 9, padding: 2 }}>
            {RANGOS.map((r) => (
              <button key={r.id} type="button" onClick={() => setRango(r.id)} style={{
                fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 7, border: 'none', cursor: 'pointer',
                background: rango === r.id ? theme.surface : 'transparent',
                color: rango === r.id ? theme.text : theme.textMuted,
                boxShadow: rango === r.id ? '0 1px 2px rgba(0,0,0,0.12)' : 'none',
              }}>{r.label}</button>
            ))}
          </div>

          {/* Búsqueda */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border, borderRadius: 9, padding: '4px 9px', flex: '1 1 200px', minWidth: 160, background: theme.bg }}>
            <Search style={{ width: 12, height: 12, color: theme.textMuted, flexShrink: 0 }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar registro, usuario, tabla…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, width: '100%' }}
            />
          </div>

          <button type="button" onClick={() => setRefreshTick((n) => n + 1)} title="Actualizar" style={{ ...pillStyle(false), padding: '4px 8px' }}>
            <RefreshCw style={{ width: 11, height: 11 }} /> Actualizar
          </button>
          {hayFiltro && (
            <button type="button" onClick={limpiar} style={pillStyle(false, P.red)}>Limpiar filtros</button>
          )}
        </div>

        {/* Usuario · pills con avatar */}
        {facetas.usuarios.length > 0 && (
          <FilaPills label="Usuario">
            <button type="button" onClick={() => setUsuario(null)} style={pillStyle(!usuario)}>Todos</button>
            {facetas.usuarios.map((u) => {
              const key = u.k || '__sys__';
              const col = colorAvatar(u.k);
              return (
                <button key={key} type="button" onClick={() => setUsuario(usuario === key ? null : key)} style={pillStyle(usuario === key, col)} title={u.k || 'Sin usuario (service role / SQL)'}>
                  <Avatar email={u.k} size={16} />
                  {nombreCorto(u.k)}
                  <span style={{ ...mono, fontSize: 9.5, opacity: 0.7 }}>{u.n}</span>
                </button>
              );
            })}
          </FilaPills>
        )}

        {/* Cliente */}
        {facetas.clientes.length > 0 && (
          <FilaPills label="Cliente">
            <button type="button" onClick={() => setCliente(null)} style={pillStyle(!cliente)}>Todos</button>
            {facetas.clientes.map((c) => {
              const key = c.k || '__none__';
              return (
                <button key={key} type="button" onClick={() => setCliente(cliente === key ? null : key)} style={pillStyle(cliente === key)}>
                  {c.k ? clienteLabel(c.k) : 'Sin cliente'}
                  <span style={{ ...mono, fontSize: 9.5, opacity: 0.7 }}>{c.n}</span>
                </button>
              );
            })}
          </FilaPills>
        )}

        {/* Tabla */}
        {facetas.tablas.length > 0 && (
          <FilaPills label="Tabla">
            <button type="button" onClick={() => setTabla(null)} style={pillStyle(!tabla)}>Todas</button>
            {facetas.tablas.map((t) => (
              <button key={t.k} type="button" onClick={() => setTabla(tabla === t.k ? null : t.k)} style={pillStyle(tabla === t.k)} title={t.k}>
                {tablaLabel(t.k)}
                <span style={{ ...mono, fontSize: 9.5, opacity: 0.7 }}>{t.n}</span>
              </button>
            ))}
          </FilaPills>
        )}
      </div>

      {/* ═══ Tabla ═══ */}
      <div style={{ background: theme.surface, border, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <Cargando label="Cargando historial…" sub="Leyendo auditoría de cambios" minHeight={260} />
        ) : error ? (
          <div style={{ padding: 24, color: P.red, fontSize: 12 }}>No se pudo leer la auditoría: {error}</div>
        ) : rows.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: theme.textMuted, fontSize: 12.5 }}>
            Sin cambios registrados {hayFiltro ? 'con estos filtros' : `en ${RANGOS.find((r) => r.id === rango)?.label.toLowerCase()}`}.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 22 }} />
                  <th style={{ ...th, width: 110 }}>Cuándo</th>
                  <th style={{ ...th, width: 150 }}>Usuario</th>
                  <th style={{ ...th, width: 150 }}>Tabla</th>
                  <th style={{ ...th, width: 70 }}>Op.</th>
                  <th style={{ ...th, width: 130 }}>Registro</th>
                  <th style={th}>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const abierto = expandidos.has(r.id);
                  const cambios = listaCambios(r);
                  const col = opColor(r.operacion);
                  const Chev = abierto ? ChevronDown : ChevronRight;
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => toggle(r.id)}
                        style={{ cursor: 'pointer', background: abierto ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent' }}
                        onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.02)'; }}
                        onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.background = 'transparent'; }}
                      >
                        <td style={{ ...td, color: theme.textMuted, paddingRight: 0 }}>
                          <Chev style={{ width: 13, height: 13 }} strokeWidth={2} />
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }} title={fmtAbsoluto(r.creado_at)}>
                          <span style={{ ...mono, fontSize: 11.5, color: theme.text }}>{fmtRelativo(r.creado_at)}</span>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }} title={r.usuario_email || 'Sin usuario (service role / SQL)'}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <Avatar email={r.usuario_email} size={20} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: r.usuario_email ? theme.text : theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 110 }}>{nombreCorto(r.usuario_email)}</span>
                          </span>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', color: theme.text }} title={r.tabla}>
                            {tablaLabel(r.tabla)}
                          </span>
                          {r.cliente_key && <span style={{ marginLeft: 6, fontSize: 10.5, color: theme.textMuted }}>{clienteLabel(r.cliente_key)}</span>}
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }}>
                          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: `${col}1A`, color: col }}>
                            {OP_LABEL[r.operacion] || r.operacion}
                          </span>
                        </td>
                        <td style={{ ...td }} title={r.registro_id || ''}>
                          <span style={{ ...mono, fontSize: 11, color: theme.textMuted, display: 'inline-block', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                            {r.registro_id || '—'}
                          </span>
                        </td>
                        <td style={{ ...td, minWidth: 260 }}>
                          <ResumenCambios cambios={cambios} op={r.operacion} theme={theme} P={P} mono={mono} />
                        </td>
                      </tr>
                      {abierto && (
                        <tr>
                          <td colSpan={7} style={{ padding: '0 8px 10px 38px', borderBottom: `1px solid ${theme.border}`, background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
                            <DetalleCambios row={r} cambios={cambios} theme={theme} P={P} mono={mono} border={border} eyebrow={eyebrow} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !error && rows.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: border }}>
            <span style={{ ...mono, fontSize: 11, color: theme.textMuted }}>{rows.length.toLocaleString('es-MX')} {rows.length === 1 ? 'registro' : 'registros'}{hasMore ? ' · hay más' : ''}</span>
            {hasMore && (
              <button type="button" onClick={cargarMas} disabled={loadingMore} style={{ ...pillStyle(true), opacity: loadingMore ? 0.6 : 1 }}>
                {loadingMore ? 'Cargando…' : `Cargar ${PAGE} más`}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════ Subcomponentes ═══════════════════
function HeroStat({ k, v, sub, mono }) {
  return (
    <div style={{ textAlign: 'right', minWidth: 84 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k}</div>
      <div style={{ ...mono, fontSize: 24, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: '#FFF', marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function FilaPills({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600, opacity: 0.55, width: 52, flexShrink: 0 }}>{label}</span>
      {children}
    </div>
  );
}

function Avatar({ email, size = 20 }) {
  const col = colorAvatar(email);
  return (
    <span style={{
      width: size, height: size, borderRadius: 999, background: `${col}22`, color: col, flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: TYPO.fontDisplay, fontSize: Math.round(size * 0.42), fontWeight: 700, letterSpacing: '0.02em',
    }}>
      {iniciales(email)}
    </span>
  );
}

function ResumenCambios({ cambios, op, theme, P, mono }) {
  const max = 3;
  const vis = cambios.slice(0, max);
  const resto = cambios.length - vis.length;
  if (!cambios.length) return <span style={{ color: theme.textMuted, fontSize: 11.5 }}>—</span>;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px 10px', alignItems: 'baseline' }}>
      {vis.map((c) => (
        <span key={c.campo} style={{ fontSize: 11.5, whiteSpace: 'nowrap', maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ color: theme.textMuted }}>{c.campo}:</span>{' '}
          {op === 'UPDATE' ? (
            <>
              <span style={{ ...mono, color: P.red, textDecoration: 'line-through', textDecorationColor: `${P.red}88` }}>{fmtValor(c.de)}</span>
              <span style={{ color: theme.textMuted }}> → </span>
              <span style={{ ...mono, color: P.green, fontWeight: 600 }}>{fmtValor(c.a)}</span>
            </>
          ) : (
            <span style={{ ...mono, color: theme.text }}>{fmtValor(c.a)}</span>
          )}
        </span>
      ))}
      {resto > 0 && <span style={{ ...mono, fontSize: 10.5, color: theme.textMuted }}>+{resto} más</span>}
    </div>
  );
}

function DetalleCambios({ row, cambios, theme, P, mono, border, eyebrow }) {
  const esUpdate = row.operacion === 'UPDATE';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 11, color: theme.textMuted }}>
        <span><span style={eyebrow}>Fecha</span> <span style={mono}>{fmtAbsoluto(row.creado_at)}</span></span>
        <span><span style={eyebrow}>Tabla</span> <span style={mono}>{row.tabla}</span></span>
        <span><span style={eyebrow}>Registro</span> <span style={mono}>{row.registro_id || '—'}</span></span>
        {row.usuario_email && <span><span style={eyebrow}>Usuario</span> <span style={mono}>{row.usuario_email}</span></span>}
        {row.cliente_key && <span><span style={eyebrow}>Cliente</span> <span style={mono}>{clienteLabel(row.cliente_key)}</span></span>}
        <span><span style={eyebrow}>#</span> <span style={mono}>{row.id}</span></span>
      </div>
      {cambios.length === 0 ? (
        <span style={{ fontSize: 11.5, color: theme.textMuted }}>Sin campos.</span>
      ) : (
        <div style={{ border, borderRadius: 10, overflow: 'hidden', background: theme.surface }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ ...eyebrow, textAlign: 'left', padding: '5px 10px', borderBottom: border, width: 180 }}>Campo</th>
                {esUpdate && <th style={{ ...eyebrow, textAlign: 'left', padding: '5px 10px', borderBottom: border }}>Antes</th>}
                <th style={{ ...eyebrow, textAlign: 'left', padding: '5px 10px', borderBottom: border }}>{esUpdate ? 'Después' : 'Valor'}</th>
              </tr>
            </thead>
            <tbody>
              {cambios.map((c, i) => (
                <tr key={c.campo} style={{ borderBottom: i < cambios.length - 1 ? `1px solid ${theme.border}` : 'none' }}>
                  <td style={{ padding: '5px 10px', fontSize: 11.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500, verticalAlign: 'top' }}>{c.campo}</td>
                  {esUpdate && <td style={{ ...mono, padding: '5px 10px', fontSize: 11.5, color: P.red, verticalAlign: 'top', wordBreak: 'break-word' }}>{fmtValor(c.de, false)}</td>}
                  <td style={{ ...mono, padding: '5px 10px', fontSize: 11.5, color: esUpdate ? P.green : theme.text, fontWeight: esUpdate ? 600 : 400, verticalAlign: 'top', wordBreak: 'break-word' }}>{fmtValor(c.a, false)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
