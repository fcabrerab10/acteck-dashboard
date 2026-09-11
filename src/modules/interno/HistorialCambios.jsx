// HistorialCambios · auditoría de las tablas que la app escribe.
// Lee `auditoria_cambios` (la llena el trigger fn_auditoria, migración
// 20260910_auditoria_cambios.sql). Lectura directa con supabase.from —
// sin cachedQuery: la tabla cambia a cada rato.
//
// El rango (Hoy · 7 días · 30 días · Todo) se aplica en el servidor y se traen
// bloques de LOTE filas; el resto (persona, área, tipo, cliente, búsqueda sin
// acentos, ruido de preferencias) se resuelve en el navegador para que los
// conteos de cada pill se recalculen con los demás filtros aplicados.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando, Segmented } from '../../components/kit';
import ExportMenu from '../../components/ExportMenu';
import Filtros from '../comercial/sellin/Filtros';
import { traducirAccion, areaDeTabla } from './equipo/textos';
import { ChevronDown, ChevronRight, History, Search, RefreshCw } from 'lucide-react';

// ═══════════════════ Constantes ═══════════════════
const LOTE = 1000;      // filas por petición al servidor
const VISIBLES = 150;   // filas pintadas antes de "Mostrar más"

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
  sync_solicitudes: 'Corridas del puente',
  agenda_items: 'Agenda · pendientes',
  agenda_reuniones: 'Agenda · reuniones',
};
const tablaLabel = (t) => TABLA_LABEL[t] || (t || '').replace(/_/g, ' ');

const CLIENTE_LABEL = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
const clienteLabel = (c) => CLIENTE_LABEL[c] || c;

const OP_LABEL = { INSERT: 'Alta', UPDATE: 'Cambio', DELETE: 'Baja' };
// Tipo de cambio en lenguaje de negocio (filtro + badge)
const TIPO_DE_OP = { INSERT: 'creado', UPDATE: 'editado', DELETE: 'borrado' };
const TIPOS = [
  { id: 'creado', label: 'Creado', tone: 'green' },
  { id: 'editado', label: 'Editado', tone: 'blue' },
  { id: 'borrado', label: 'Borrado', tone: 'red' },
];
const LABEL_RUIDO = 'Preferencias de usuario';

const RANGOS = [
  { id: 'hoy', label: 'Hoy' },
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: 'todo', label: 'Todo' },
];

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const GRUPOS = ['usuario', 'area', 'tipo', 'cliente'];
const selVacia = () => ({ usuario: new Set(), area: new Set(), tipo: new Set(), cliente: new Set() });

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
const normalizar = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

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

function fmtExcelFecha(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${hhmm(d)}:${pad2(d.getSeconds())}`;
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

// Texto plano de los cambios (Excel y búsqueda)
function cambiosTexto(row, cambios) {
  if (!cambios.length) return '';
  return cambios.map((c) => (row.operacion === 'UPDATE'
    ? `${c.campo}: ${fmtValor(c.de, false)} → ${fmtValor(c.a, false)}`
    : `${c.campo}: ${fmtValor(c.a, false)}`)).join(' · ');
}

// Fila enriquecida: traducción a negocio + claves de filtro + texto de búsqueda
function enriquecer(r) {
  const t = traducirAccion(r);
  const ruido = t === null;
  const label = ruido ? LABEL_RUIDO : t.label;
  const area = ruido ? areaDeTabla(r.tabla) : t.area;
  const cambios = listaCambios(r);
  const texto = cambiosTexto(r, cambios);
  const haystack = normalizar([
    label, area, r.tabla, tablaLabel(r.tabla), r.operacion, OP_LABEL[r.operacion], TIPO_DE_OP[r.operacion],
    r.usuario_email, nombreCorto(r.usuario_email), r.registro_id, r.cliente_key, clienteLabel(r.cliente_key), texto,
  ].filter(Boolean).join(' '));
  return {
    ...r, label, area, ruido, cambios, texto, haystack,
    tipo: TIPO_DE_OP[r.operacion] || 'editado',
    kUsuario: r.usuario_email || '__sys__',
    kCliente: r.cliente_key || '__none__',
  };
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
  const rootRef = useRef(null);

  // Filtros
  const [rango, setRango] = useState('7d');
  const [sel, setSel] = useState(selVacia);
  const [mostrarPrefs, setMostrarPrefs] = useState(false);
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
  const [visibles, setVisibles] = useState(VISIBLES);

  // KPIs (hoy · semana · usuarios 30 días)
  const [kpi, setKpi] = useState({ hoy: null, semana: null, usuarios: null });

  useEffect(() => {
    const t = setTimeout(() => setQ(normalizar(busqueda.trim())), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  // Query base: sólo el rango se aplica en el servidor
  const buildQuery = useCallback(() => {
    let b = supabase.from('auditoria_cambios').select('*');
    const desde = desdeRango(rango);
    if (desde) b = b.gte('creado_at', desde);
    return b;
  }, [rango]);

  // Primer lote (se reinicia al cambiar rango o al actualizar)
  useEffect(() => {
    let cancel = false;
    setLoading(true); setError(null); setExpandidos(new Set()); setVisibles(VISIBLES);
    buildQuery().order('id', { ascending: false }).limit(LOTE)
      .then(({ data, error: err }) => {
        if (cancel) return;
        if (err) { setError(err.message); setRows([]); setHasMore(false); }
        else { setRows((data || []).map(enriquecer)); setHasMore((data || []).length === LOTE); }
        setLoading(false);
      });
    return () => { cancel = true; };
  }, [buildQuery, refreshTick]);

  const cargarMas = async () => {
    if (!rows.length || loadingMore) return;
    setLoadingMore(true);
    const cursor = rows[rows.length - 1].id;
    const { data, error: err } = await buildQuery().lt('id', cursor).order('id', { ascending: false }).limit(LOTE);
    if (err) setError(err.message);
    else {
      setRows((prev) => [...prev, ...(data || []).map(enriquecer)]);
      setHasMore((data || []).length === LOTE);
    }
    setLoadingMore(false);
  };

  // KPIs
  useEffect(() => {
    let cancel = false;
    // Un builder por consulta: en supabase-js v2 comparten la URL si se reusa from().
    const t = () => supabase.from('auditoria_cambios');
    Promise.all([
      t().select('id', { count: 'exact', head: true }).gte('creado_at', inicioHoy().toISOString()),
      t().select('id', { count: 'exact', head: true }).gte('creado_at', haceDias(7).toISOString()),
      t().select('usuario_email').gte('creado_at', haceDias(30).toISOString()).not('usuario_email', 'is', null).order('id', { ascending: false }).limit(5000),
    ]).then(([h, s, f]) => {
      if (cancel) return;
      setKpi({
        hoy: h.count ?? 0,
        semana: s.count ?? 0,
        usuarios: new Set((f.data || []).map((r) => r.usuario_email)).size,
      });
    }).catch(() => { /* KPIs son decorativos */ });
    return () => { cancel = true; };
  }, [refreshTick]);

  // ─── Filtrado en el navegador ───
  // `omitir` = grupo cuyo filtro NO se aplica (para calcular su conteo facetado)
  const pasa = useCallback((r, omitir) => {
    if (omitir !== 'prefs' && !mostrarPrefs && r.ruido) return false;
    if (q && !r.haystack.includes(q)) return false;
    if (omitir !== 'usuario' && sel.usuario.size && !sel.usuario.has(r.kUsuario)) return false;
    if (omitir !== 'area' && sel.area.size && !sel.area.has(r.area)) return false;
    if (omitir !== 'tipo' && sel.tipo.size && !sel.tipo.has(r.tipo)) return false;
    if (omitir !== 'cliente' && sel.cliente.size && !sel.cliente.has(r.kCliente)) return false;
    return true;
  }, [sel, q, mostrarPrefs]);

  const filtradas = useMemo(() => rows.filter((r) => pasa(r)), [rows, pasa]);

  const facetas = useMemo(() => {
    const conteo = (grupo, key) => {
      const m = new Map();
      rows.forEach((r) => { if (pasa(r, grupo)) m.set(r[key], (m.get(r[key]) || 0) + 1); });
      sel[grupo].forEach((k) => { if (!m.has(k)) m.set(k, 0); });
      return m;
    };
    const ordenado = (m, label) => [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, label: label(id), n }));
    const prefs = rows.reduce((n, r) => n + (r.ruido && pasa(r, 'prefs') ? 1 : 0), 0);
    return {
      usuario: ordenado(conteo('usuario', 'kUsuario'), (id) => (id === '__sys__' ? 'Sistema' : nombreCorto(id))),
      area: ordenado(conteo('area', 'area'), (id) => id),
      tipo: (() => { const m = conteo('tipo', 'tipo'); return TIPOS.map((t) => ({ ...t, n: m.get(t.id) || 0 })); })(),
      cliente: ordenado(conteo('cliente', 'kCliente'), (id) => (id === '__none__' ? 'Sin cliente' : clienteLabel(id))),
      prefs,
    };
  }, [rows, sel, pasa]);

  const toggleSel = (grupo, id) => setSel((prev) => {
    const n = new Set(prev[grupo]);
    if (n.has(id)) n.delete(id); else n.add(id);
    return { ...prev, [grupo]: n };
  });

  const nActivos = GRUPOS.reduce((n, g) => n + sel[g].size, 0) + (q ? 1 : 0) + (mostrarPrefs ? 1 : 0);
  const hayFiltro = nActivos > 0;
  const limpiar = () => { setSel(selVacia()); setBusqueda(''); setQ(''); setMostrarPrefs(false); };

  const toggle = (id) => setExpandidos((prev) => {
    const n = new Set(prev);
    if (n.has(id)) n.delete(id); else n.add(id);
    return n;
  });

  const tipoColor = (tipo) => (tipo === 'creado' ? P.green : tipo === 'borrado' ? P.red : P.blue);

  const ultimo = filtradas[0];
  const narrativa = useMemo(() => {
    if (kpi.hoy == null) return 'Quién cambió qué y cuándo.';
    if (kpi.hoy === 0) return 'Sin movimientos hoy.';
    return `${kpi.hoy} ${kpi.hoy === 1 ? 'cambio' : 'cambios'} hoy en lo que la app escribe.`;
  }, [kpi.hoy]);

  const rangoLabel = RANGOS.find((r) => r.id === rango)?.label || '';

  // ─── Exportar (columnas traducidas, sobre las filas filtradas) ───
  const excel = () => ({
    archivo: 'Historial de cambios',
    hojas: [{
      nombre: 'Historial',
      subtitulo: `${rangoLabel}${hayFiltro ? ' · filtrado' : ''} · ${filtradas.length.toLocaleString('es-MX')} cambios`,
      columnas: [
        { label: 'Fecha', key: 'fecha', ancho: 18 },
        { label: 'Persona', key: 'persona', ancho: 18 },
        { label: 'Acción', key: 'accion', ancho: 32 },
        { label: 'Área', key: 'area', ancho: 14 },
        { label: 'Tipo', key: 'tipo', ancho: 10 },
        { label: 'Cliente', key: 'cliente', ancho: 12 },
        { label: 'Registro', key: 'registro', ancho: 16 },
        { label: 'Cambios', key: 'cambios', ancho: 70 },
        { label: 'Tabla (técnico)', key: 'tabla', ancho: 24 },
        { label: 'Operación (técnico)', key: 'op', ancho: 12 },
        { label: 'Correo', key: 'correo', ancho: 28 },
      ],
      filas: filtradas.map((r) => ({
        fecha: fmtExcelFecha(r.creado_at),
        persona: nombreCorto(r.usuario_email),
        accion: r.label,
        area: r.area,
        tipo: TIPOS.find((t) => t.id === r.tipo)?.label || r.tipo,
        cliente: r.cliente_key ? clienteLabel(r.cliente_key) : '',
        registro: r.registro_id || '',
        cambios: r.texto,
        tabla: r.tabla,
        op: r.operacion,
        correo: r.usuario_email || '',
      })),
    }],
  });

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

  const pintadas = filtradas.slice(0, visibles);

  return (
    <div ref={rootRef} style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            {narrativa}{ultimo ? ` Último: ${nombreCorto(ultimo.usuario_email)} · ${ultimo.label}, ${fmtRelativo(ultimo.creado_at)}.` : ''}
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
          <Segmented options={RANGOS} value={rango} onChange={setRango} />

          {/* Búsqueda (sin acentos: acción, tabla, persona, contenido del cambio) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, border, borderRadius: 9, padding: '4px 9px', flex: '1 1 200px', minWidth: 160, background: theme.bg }}>
            <Search style={{ width: 12, height: 12, color: theme.textMuted, flexShrink: 0 }} />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar acción, persona, registro o contenido del cambio…"
              style={{ border: 'none', outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, width: '100%' }}
            />
          </div>

          <button type="button" onClick={() => setRefreshTick((n) => n + 1)} title="Actualizar" style={{ ...pillStyle(false), padding: '4px 8px' }}>
            <RefreshCw style={{ width: 11, height: 11 }} /> Actualizar
          </button>
          <ExportMenu
            titulo="Historial de cambios"
            subtitulo={rangoLabel}
            excel={excel}
            pdf={{ ref: rootRef }}
            deshabilitado={loading || !filtradas.length}
          />
        </div>

        <Filtros
          grupos={[
            { id: 'usuario', label: 'Persona', opciones: facetas.usuario, sel: sel.usuario },
            { id: 'area', label: 'Área', opciones: facetas.area, sel: sel.area },
            { id: 'tipo', label: 'Tipo', opciones: facetas.tipo, sel: sel.tipo },
            { id: 'cliente', label: 'Cliente', opciones: facetas.cliente, sel: sel.cliente },
          ]}
          toggles={[{ id: 'prefs', label: 'Mostrar cambios de preferencias', on: mostrarPrefs, n: facetas.prefs }]}
          onToggle={toggleSel}
          onToggleFlag={() => setMostrarPrefs((v) => !v)}
          onLimpiar={limpiar}
          activos={nActivos}
        />
      </div>

      {/* ═══ Tabla ═══ */}
      <div style={{ background: theme.surface, border, borderRadius: 12, overflow: 'hidden' }}>
        {loading ? (
          <Cargando pantalla="historialCambios" label="Cargando historial…" sub="Leyendo auditoría de cambios" minHeight={260} />
        ) : error ? (
          <div style={{ padding: 24, color: P.red, fontSize: 12 }}>No se pudo leer la auditoría: {error}</div>
        ) : filtradas.length === 0 ? (
          <div style={{ padding: '40px 24px', textAlign: 'center', color: theme.textMuted, fontSize: 12.5 }}>
            Sin cambios registrados {hayFiltro ? 'con estos filtros' : `en ${rangoLabel.toLowerCase()}`}.
            {!hayFiltro && rows.length > 0 && facetas.prefs > 0 && (
              <div style={{ marginTop: 6, fontSize: 11.5 }}>Hay {facetas.prefs} {facetas.prefs === 1 ? 'cambio' : 'cambios'} de preferencias ocultos.</div>
            )}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
              <thead>
                <tr>
                  <th style={{ ...th, width: 22 }} />
                  <th style={{ ...th, width: 110 }}>Cuándo</th>
                  <th style={{ ...th, width: 150 }}>Persona</th>
                  <th style={{ ...th, width: 230 }}>Acción</th>
                  <th style={{ ...th, width: 74 }}>Tipo</th>
                  <th style={{ ...th, width: 130 }}>Registro</th>
                  <th style={th}>Cambios</th>
                </tr>
              </thead>
              <tbody>
                {pintadas.map((r) => {
                  const abierto = expandidos.has(r.id);
                  const cambios = r.cambios;
                  const col = tipoColor(r.tipo);
                  const Chev = abierto ? ChevronDown : ChevronRight;
                  const tecnico = `${r.tabla} · ${r.operacion}`;
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        onClick={() => toggle(r.id)}
                        style={{ cursor: 'pointer', background: abierto ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)') : 'transparent', opacity: r.ruido ? 0.7 : 1 }}
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
                        <td style={{ ...td }} title={tecnico}>
                          <div style={{ fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', lineHeight: 1.25 }}>{r.label}</div>
                          <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 220 }}>
                            {r.area} · {tablaLabel(r.tabla)}{r.cliente_key ? ` · ${clienteLabel(r.cliente_key)}` : ''}
                          </div>
                        </td>
                        <td style={{ ...td, whiteSpace: 'nowrap' }} title={OP_LABEL[r.operacion] || r.operacion}>
                          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', padding: '2px 7px', borderRadius: 999, background: `${col}1A`, color: col }}>
                            {r.tipo}
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
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', borderTop: border, gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...mono, fontSize: 11, color: theme.textMuted }}>
              {filtradas.length.toLocaleString('es-MX')} {filtradas.length === 1 ? 'cambio' : 'cambios'}
              {hayFiltro ? ` de ${rows.length.toLocaleString('es-MX')} cargados` : ''}
              {hasMore ? ' · hay más antiguos' : ''}
            </span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              {filtradas.length > visibles && (
                <button type="button" onClick={() => setVisibles((v) => v + VISIBLES)} style={pillStyle(false)}>
                  Mostrar {Math.min(VISIBLES, filtradas.length - visibles)} más
                </button>
              )}
              {hasMore && (
                <button type="button" onClick={cargarMas} disabled={loadingMore} style={{ ...pillStyle(true), opacity: loadingMore ? 0.6 : 1 }}>
                  {loadingMore ? 'Cargando…' : `Cargar ${LOTE.toLocaleString('es-MX')} más antiguos`}
                </button>
              )}
            </span>
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
        <span><span style={eyebrow}>Acción</span> <span style={{ color: theme.text, fontWeight: 600 }}>{row.label}</span></span>
        <span><span style={eyebrow}>Área</span> <span>{row.area}</span></span>
        <span><span style={eyebrow}>Fecha</span> <span style={mono}>{fmtAbsoluto(row.creado_at)}</span></span>
        <span><span style={eyebrow}>Tabla</span> <span style={mono}>{row.tabla}</span></span>
        <span><span style={eyebrow}>Operación</span> <span style={mono}>{row.operacion} · {OP_LABEL[row.operacion] || row.operacion}</span></span>
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
