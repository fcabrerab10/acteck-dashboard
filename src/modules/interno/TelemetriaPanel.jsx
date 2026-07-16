import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { usePerfil } from '../../lib/perfilContext';

// ═══════════════════ Constantes / helpers ═══════════════════
const CLIENTE_LABEL = { 1: 'Digitalife', 2: 'PCEL', 3: 'Dicotech', 4: 'Mercado Libre', 99: 'Global' };
const CLIENTE_COLOR = { 1: '#8B5CF6', 2: '#10B981', 3: '#0EA5E9', 4: '#F59E0B', 99: '#94A3B8' };
const PAGINA_LABEL = {
  1: 'Home', 2: 'Análisis', 3: 'Sell In', 4: 'Sell Out', 5: 'Marketing', 6: 'Pagos', 7: 'Cartera', 8: 'Forecast',
  9: 'Sell Out global', 10: 'Inventario global', 11: 'Estrategia precios', 12: 'Tracking pedidos',
  13: 'Análisis clientes', 14: 'Uploads', 15: 'Telemetría', 16: 'Evaluaciones', 17: 'Settings',
};

const BONO_BASE = 3000;
const BONO_PCT = 0.0004;
const CLIENTES_BONO = ['digitalife', 'pcel', 'dicotech'];
const DIGITALIFE_CUOTA_ANUAL = 25_000_000;

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const requiereEvaluacion = (u) => u.tipo === 'interno' && u.rol !== 'super_admin';

const RATINGS = [
  { key: 'rating_comunicacion', label: 'Comunicación' },
  { key: 'rating_iniciativa',   label: 'Iniciativa' },
  { key: 'rating_calidad',      label: 'Calidad del trabajo' },
  { key: 'rating_cumplimiento', label: 'Cumplimiento' },
  { key: 'rating_valor',        label: 'Aporte de valor' },
];

// Colores/estilo por usuario según tipo/rol
const colorAvatar = (u) => u.rol === 'super_admin'
  ? 'linear-gradient(135deg, #007AFF, #64B5F6)'
  : u.tipo === 'externo'
  ? 'linear-gradient(135deg, #FF9F0A, #FFB84D)'
  : 'linear-gradient(135deg, #FF375F, #FF6B8B)';

const accentUser = (u) => u.rol === 'super_admin' ? '#007AFF' : u.tipo === 'externo' ? '#FF9F0A' : '#FF375F';

function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}
function fmtHm(mins) {
  if (!mins || mins < 1) return '0m';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtHace(iso) {
  if (!iso) return '—';
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'hace segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  return `hace ${Math.floor(diff / 86400)} días`;
}
function fmtFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtMoney(n) {
  if (n == null || !isFinite(n)) return '$—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}
function rangoMes(anio, mes) {
  return { ini: new Date(anio, mes - 1, 1), fin: new Date(anio, mes, 1) };
}

// Ring tipo Apple Watch (SVG)
function Ring({ pct, color, size = 44, stroke = 5 }) {
  const r = size / 2 - stroke;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(100, pct)) / 100;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} style={{ width: size, height: size }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F0F0" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={`${c * p} ${c}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
    </svg>
  );
}

// ═══════════════════ Componente principal ═══════════════════
export default function TelemetriaPanel() {
  const { perfil } = usePerfil();
  // Doble check por si el campo `rol` no es exacto — usa también flag booleano
  const esAdmin = perfil?.rol === 'super_admin' || perfil?.es_super_admin === true;

  // Estado global (mes actual — el sheet lateral maneja meses individualmente)
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActual = hoy.getMonth() + 1;

  const [usuarios, setUsuarios] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [facturacionMes, setFacturacionMes] = useState(0);
  const [cuotaMes, setCuotaMes] = useState(0);
  const [evaluacionesMesActual, setEvaluacionesMesActual] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Fetch inicial. Cada query en su propio try/catch para que un error puntual
  // (RLS, view faltante) no rompa toda la vista.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      const { ini, fin } = rangoMes(anioActual, mesActual);
      const safe = async (label, promise, fallback) => {
        try {
          const res = await promise;
          if (res.error) { console.warn(`[Telemetria][${label}]`, res.error); return fallback; }
          return res.data ?? fallback;
        } catch (e) { console.warn(`[Telemetria][${label}]`, e); return fallback; }
      };
      const [perf, evs, fact, cuotas, evalRes] = await Promise.all([
        safe('perfiles', supabase.from('perfiles').select('user_id,nombre,email,rol,tipo,puesto').order('nombre'), []),
        safe('eventos_usuario', supabase.from('eventos_usuario')
          .select('id,user_id,ts,tipo,cliente,pagina,detalle')
          .gte('ts', ini.toISOString()).lt('ts', fin.toISOString())
          .order('ts', { ascending: false }).limit(20000), []),
        safe('facturacion_clientes', supabase.from('facturacion_clientes')
          .select('monto,cliente_key').in('cliente_key', CLIENTES_BONO)
          .eq('anio', anioActual).eq('mes', mesActual), []),
        safe('cuotas_mensuales', supabase.from('cuotas_mensuales')
          .select('cliente,cuota_min').in('cliente', ['pcel', 'dicotech'])
          .eq('anio', anioActual).eq('mes', mesActual), []),
        safe('evaluaciones_mensuales', supabase.from('evaluaciones_mensuales').select('*').eq('anio', anioActual).eq('mes', mesActual), []),
      ]);
      if (cancelled) return;
      setUsuarios(perf);
      setEventos(evs);
      setFacturacionMes(fact.reduce((s, r) => s + (Number(r.monto) || 0), 0));
      setCuotaMes(cuotas.reduce((s, r) => s + (Number(r.cuota_min) || 0), 0) + DIGITALIFE_CUOTA_ANUAL / 12);
      setEvaluacionesMesActual(evalRes);
      if (perf.length === 0) setFetchError('No se pudieron cargar los usuarios. Revisa la consola.');
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [anioActual, mesActual]);

  // Índices y KPIs por usuario para las cards
  const eventosPorUser = useMemo(() => {
    const m = new Map();
    for (const e of eventos) {
      if (!m.has(e.user_id)) m.set(e.user_id, []);
      m.get(e.user_id).push(e);
    }
    return m;
  }, [eventos]);

  const kpisPorUser = useMemo(() => {
    const m = new Map();
    const diasEnMes = new Date(anioActual, mesActual, 0).getDate();
    for (const u of usuarios) {
      const evs = eventosPorUser.get(u.user_id) || [];
      const heartbeats = evs.filter((e) => e.tipo === 10).length;
      const dias = new Set(evs.map((e) => new Date(e.ts).toISOString().slice(0, 10)));
      const ultimo = evs[0]?.ts || null;
      const cliCount = {};
      for (const e of evs) if (e.tipo === 10 && e.cliente) cliCount[e.cliente] = (cliCount[e.cliente] || 0) + 1;
      let clienteTop = null; let maxCli = 0;
      for (const k of Object.keys(cliCount)) if (cliCount[k] > maxCli) { maxCli = cliCount[k]; clienteTop = Number(k); }
      const totalCli = Object.values(cliCount).reduce((s, v) => s + v, 0);
      const pctTop = totalCli > 0 ? (maxCli / totalCli * 100) : 0;
      const aplicaBono = requiereEvaluacion(u);
      const bonoEstimado = aplicaBono
        ? (dias.size > 0 ? Math.max(BONO_BASE, facturacionMes * BONO_PCT) : BONO_BASE)
        : null;
      m.set(u.user_id, {
        diasActivos: dias.size, diasEnMes,
        minutos: heartbeats, ultimo, clienteTop, pctTop, cliCount, totalCli,
        bonoEstimado, aplicaBono,
      });
    }
    return m;
  }, [usuarios, eventosPorUser, anioActual, mesActual, facturacionMes]);

  // Alert pendiente de evaluación (mes anterior)
  const [alertPend, setAlertPend] = useState([]);
  useEffect(() => {
    if (!esAdmin || usuarios.length === 0) { setAlertPend([]); return; }
    const dia = hoy.getDate();
    if (dia > 5) return; // sólo primeros 5 días del mes
    const mesPrev = hoy.getMonth();
    const anioPrev = mesPrev === 0 ? hoy.getFullYear() - 1 : hoy.getFullYear();
    const mesPrevNum = mesPrev === 0 ? 12 : mesPrev;
    const internos = usuarios.filter(requiereEvaluacion);
    if (internos.length === 0) { setAlertPend([]); return; }
    (async () => {
      const pend = [];
      for (const u of internos) {
        const { data } = await supabase.from('evaluaciones_mensuales')
          .select('cerrada').eq('user_id', u.user_id).eq('anio', anioPrev).eq('mes', mesPrevNum).maybeSingle();
        if (!data || !data.cerrada) pend.push({ user: u, anio: anioPrev, mes: mesPrevNum, dia });
      }
      setAlertPend(pend);
    })();
  }, [esAdmin, usuarios]);

  const evalPorUser = useMemo(() => {
    const m = new Map();
    for (const e of evaluacionesMesActual) m.set(e.user_id, e);
    return m;
  }, [evaluacionesMesActual]);

  // Si es admin, ve todos. Si no es admin pero perfil está cargado, ve sólo el suyo.
  // Si perfil aún no carga, muestra todos (RLS del backend ya filtra la data sensible).
  const usuariosVisibles = esAdmin
    ? usuarios
    : perfil?.user_id
      ? usuarios.filter((u) => u.user_id === perfil.user_id)
      : usuarios;
  const internos = usuariosVisibles.filter((u) => u.tipo === 'interno');
  const externos = usuariosVisibles.filter((u) => u.tipo === 'externo');
  // Karolina primero dentro de internos
  internos.sort((a, b) => {
    if (requiereEvaluacion(a) && !requiereEvaluacion(b)) return -1;
    if (!requiereEvaluacion(a) && requiereEvaluacion(b)) return 1;
    return 0;
  });

  const WRAPPER_STYLE = {
    background: 'linear-gradient(135deg, #E8F1FF 0%, #FFF5F8 50%, #FFE8D6 100%)',
    borderRadius: 24, padding: 28, minHeight: '100vh',
  };

  if (loading) {
    return (
      <div style={WRAPPER_STYLE}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Actividad del equipo</h1>
        <p style={{ color: '#6E6E73', fontSize: 14, margin: '4px 0 24px' }}>Cargando…</p>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={WRAPPER_STYLE}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Actividad del equipo</h1>
        <div style={{ background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.3)',
          borderRadius: 12, padding: 16, marginTop: 20, fontSize: 14, color: '#B00020' }}>
          <strong>Error al cargar:</strong> {fetchError}
        </div>
      </div>
    );
  }

  return (
    <div style={WRAPPER_STYLE}>
      {/* Header */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Actividad del equipo</h1>
          <p style={{ color: '#6E6E73', fontSize: 14, margin: '4px 0 0' }}>
            {MESES[mesActual - 1]} {anioActual} · Telemetría automática + evaluación mensual
          </p>
        </div>
      </div>

      {/* Alert pendiente */}
      {alertPend.length > 0 && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(255,159,10,0.14), rgba(255,159,10,0.06))',
          border: '1px solid rgba(255,159,10,0.3)', borderRadius: 16,
          padding: '14px 18px', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <div style={{ fontSize: 22 }}>⏰</div>
          <div style={{ flex: 1, fontSize: 14, color: '#7A4A00' }}>
            <strong>Pendiente:</strong> evaluar {alertPend.map((p) => p.user.nombre).join(', ')} ·{' '}
            <strong>{MESES[alertPend[0].mes - 1]} {alertPend[0].anio}</strong>.{' '}
            {alertPend[0].dia < 3
              ? <>Debes cerrar antes del <strong>día 3</strong>.</>
              : alertPend[0].dia === 3 ? <><strong>VENCE HOY.</strong></> : <>Venció el día 3.</>}
          </div>
          <button onClick={() => setSelectedUserId(alertPend[0].user.user_id)}
            style={{ background: '#FF9F0A', color: 'white', border: 'none',
                     padding: '8px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            Evaluar ahora →
          </button>
        </div>
      )}

      {/* Sección Internos */}
      {internos.length > 0 && (
        <>
          <SeccionHeader color="#FF375F" label="Acteck · Equipo interno" cnt={`${internos.length} ${internos.length === 1 ? 'usuario' : 'usuarios'}`} />
          <div style={{
            display: 'grid',
            gridTemplateColumns: internos.length === 1 ? '1fr'
              : requiereEvaluacion(internos[0]) ? '1.4fr 1fr'
              : 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: 16, marginBottom: 24,
          }}>
            {internos.map((u) => (
              <UserCard key={u.user_id} u={u} kpis={kpisPorUser.get(u.user_id)}
                bonoBase={Math.max(BONO_BASE, facturacionMes * BONO_PCT)}
                evaluacionActual={evalPorUser.get(u.user_id)}
                onClick={() => setSelectedUserId(u.user_id)} />
            ))}
          </div>
        </>
      )}

      {/* Sección Externos */}
      {externos.length > 0 && (
        <>
          <SeccionHeader color="#FF9F0A" label="Externos · clientes y aliados" cnt={`${externos.length} ${externos.length === 1 ? 'usuario' : 'usuarios'}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 }}>
            {externos.map((u) => (
              <UserCard key={u.user_id} u={u} kpis={kpisPorUser.get(u.user_id)}
                onClick={() => setSelectedUserId(u.user_id)} />
            ))}
          </div>
        </>
      )}

      {/* Sheet lateral */}
      {selectedUserId && (
        <UserSheet
          user={usuarios.find((u) => u.user_id === selectedUserId)}
          esAdmin={esAdmin}
          perfilId={perfil?.user_id}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}

// ═══════════════════ SeccionHeader ═══════════════════
function SeccionHeader({ color, label, cnt }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
                  marginBottom: 12, paddingLeft: 4 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#1D1D1F', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }}></span>
        {label}
      </div>
      <div style={{ fontSize: 12, color: '#6E6E73' }}>{cnt}</div>
    </div>
  );
}

// ═══════════════════ UserCard (glassmorphism) ═══════════════════
function UserCard({ u, kpis, bonoBase, evaluacionActual, onClick }) {
  const pendEval = requiereEvaluacion(u) && evaluacionActual && !evaluacionActual.cerrada;
  const bonoStr = kpis?.bonoEstimado != null ? fmtMoney(kpis.bonoEstimado) : null;
  const diasPct = kpis ? (kpis.diasActivos / kpis.diasEnMes * 100) : 0;
  const tiempoPct = kpis ? Math.min(100, kpis.minutos / (kpis.diasEnMes * 60 * 3) * 100) : 0; // meta 3h/día
  const cliPct = kpis?.pctTop || 0;
  const isKarolina = requiereEvaluacion(u);

  return (
    <div onClick={onClick} style={{
      background: 'rgba(255,255,255,0.72)',
      backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      border: '1px solid rgba(255,255,255,0.6)',
      borderRadius: 20, padding: 22,
      boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
      cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s',
    }}
    onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(0,0,0,0.08)'; }}
    onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 24px rgba(0,0,0,0.06)'; }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
        <div>
          <div style={{
            width: 56, height: 56, borderRadius: 999, background: colorAvatar(u),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 20,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          }}>{iniciales(u.nombre || u.email)}</div>
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 12 }}>
            {u.nombre || u.email?.split('@')[0]}
          </div>
          <div style={{ fontSize: 12.5, color: '#6E6E73', marginTop: 2 }}>
            {u.puesto || u.rol}{u.puesto ? ` · ${u.rol}` : ''}
          </div>
          {pendEval && (
            <div style={{
              display: 'inline-block', fontSize: 11, fontWeight: 600,
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(255,159,10,0.15)', color: '#B25000', marginTop: 8,
            }}>⏰ Evaluar</div>
          )}
        </div>
        {(isKarolina && bonoStr) ? (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Bono estimado
            </div>
            <div style={{ fontSize: 32, fontWeight: 700, color: accentUser(u), letterSpacing: '-0.03em', lineHeight: 1, marginTop: 4 }}>
              {bonoStr}
            </div>
            <div style={{ fontSize: 11.5, color: '#6E6E73', marginTop: 3 }}>
              del mes en curso
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Tiempo activo
            </div>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 4 }}>
              {fmtHm(kpis?.minutos || 0)}
            </div>
            <div style={{ fontSize: 11.5, color: '#6E6E73', marginTop: 3 }}>
              {kpis?.diasActivos || 0}/{kpis?.diasEnMes || 0} días
            </div>
          </div>
        )}
      </div>

      {/* Rings de actividad */}
      <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.06)' }}>
        <RingCell pct={diasPct} color="#FF375F" num={`${kpis?.diasActivos || 0}/${kpis?.diasEnMes || 0}`} lbl="Días" />
        <RingCell pct={tiempoPct} color="#34C759" num={fmtHm(kpis?.minutos || 0)} lbl="Tiempo" />
        <RingCell pct={cliPct} color={kpis?.clienteTop ? (CLIENTE_COLOR[kpis.clienteTop] || '#8B5CF6') : '#94A3B8'}
          num={kpis?.clienteTop ? `${cliPct.toFixed(0)}%` : '—'}
          lbl={kpis?.clienteTop ? CLIENTE_LABEL[kpis.clienteTop] : 'Sin datos'} />
        <RingCell pct={100} color="#8E8E93" num={fmtHace(kpis?.ultimo).replace('hace ', '')} lbl="Última" />
      </div>
    </div>
  );
}

function RingCell({ pct, color, num, lbl }) {
  return (
    <div style={{ textAlign: 'center', flex: 1 }}>
      <div style={{ display: 'flex', justifyContent: 'center' }}><Ring pct={pct} color={color} /></div>
      <div style={{ fontSize: 11.5, fontWeight: 700, color: '#1D1D1F', marginTop: 4 }}>{num}</div>
      <div style={{ fontSize: 9.5, fontWeight: 500, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{lbl}</div>
    </div>
  );
}

// ═══════════════════ Sheet lateral con detalle ═══════════════════
function UserSheet({ user, esAdmin, perfilId, onClose }) {
  const hoy = new Date();
  const [mesRef, setMesRef] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [eventos, setEventos] = useState([]);
  const [evaluacion, setEvaluacion] = useState(null);
  const [facturacion, setFacturacion] = useState(0);
  const [cuota, setCuota] = useState(0);
  const [loading, setLoading] = useState(true);

  // Últimos 6 meses (incluye actual)
  const mesesDisponibles = useMemo(() => {
    const arr = [];
    let a = hoy.getFullYear(), m = hoy.getMonth() + 1;
    for (let i = 0; i < 6; i++) {
      arr.push({ anio: a, mes: m });
      m--; if (m < 1) { m = 12; a--; }
    }
    return arr;
  }, []);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const { ini, fin } = rangoMes(mesRef.anio, mesRef.mes);
    const [evs, fact, cuotas, evalRes] = await Promise.all([
      supabase.from('eventos_usuario')
        .select('id,ts,tipo,cliente,pagina,detalle')
        .eq('user_id', user.user_id)
        .gte('ts', ini.toISOString()).lt('ts', fin.toISOString())
        .order('ts', { ascending: false }).limit(5000),
      supabase.from('facturacion_clientes')
        .select('monto,cliente_key').in('cliente_key', CLIENTES_BONO)
        .eq('anio', mesRef.anio).eq('mes', mesRef.mes),
      supabase.from('cuotas_mensuales')
        .select('cliente,cuota_min').in('cliente', ['pcel', 'dicotech'])
        .eq('anio', mesRef.anio).eq('mes', mesRef.mes),
      supabase.from('evaluaciones_mensuales').select('*')
        .eq('user_id', user.user_id).eq('anio', mesRef.anio).eq('mes', mesRef.mes).maybeSingle(),
    ]);
    setEventos(evs.data || []);
    setFacturacion((fact.data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0));
    setCuota((cuotas.data || []).reduce((s, r) => s + (Number(r.cuota_min) || 0), 0) + DIGITALIFE_CUOTA_ANUAL / 12);
    setEvaluacion(evalRes.data || null);
    setLoading(false);
  }, [mesRef.anio, mesRef.mes, user.user_id]);

  useEffect(() => { reload(); }, [reload]);

  // ESC cierra
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const diasEnMes = new Date(mesRef.anio, mesRef.mes, 0).getDate();
  const heartbeats = eventos.filter((e) => e.tipo === 10).length;
  const dias = new Set(eventos.map((e) => new Date(e.ts).toISOString().slice(0, 10))).size;
  const cliCount = {};
  for (const e of eventos) if (e.tipo === 10 && e.cliente) cliCount[e.cliente] = (cliCount[e.cliente] || 0) + 1;
  const totalCli = Object.values(cliCount).reduce((s, v) => s + v, 0);
  const cliOrden = Object.entries(cliCount).sort((a, b) => b[1] - a[1]);

  const aplicaBono = requiereEvaluacion(user);
  const bonoBase = Math.max(BONO_BASE, facturacion * BONO_PCT);
  const ajustesTotal = (evaluacion?.ajustes || []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const bonoTotal = bonoBase + ajustesTotal;
  const cuotaPct = cuota > 0 ? (facturacion / cuota * 100) : 0;

  return (
    <>
      {/* Overlay */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.35)',
        backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)',
        zIndex: 100, animation: 'fadein 200ms',
      }} />
      {/* Sheet */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: '520px', maxWidth: '92vw',
        background: 'rgba(250,250,252,0.98)',
        backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
        zIndex: 101, overflowY: 'auto',
        boxShadow: '-8px 0 40px rgba(0,0,0,0.15)',
        animation: 'slidein 240ms cubic-bezier(0.32, 0.72, 0, 1)',
      }}>
        <style>{`
          @keyframes fadein { from { opacity: 0 } to { opacity: 1 } }
          @keyframes slidein { from { transform: translateX(100%) } to { transform: translateX(0) } }
        `}</style>
        {/* Botón cerrar */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '14px 20px 0' }}>
          <button onClick={onClose} style={{
            width: 30, height: 30, borderRadius: 999, border: 'none',
            background: 'rgba(0,0,0,0.06)', color: '#1D1D1F', fontSize: 16,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>

        {/* Hero */}
        <div style={{ padding: '8px 28px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginBottom: 16 }}>
            <div style={{
              width: 80, height: 80, borderRadius: 999, background: colorAvatar(user),
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 700, fontSize: 28,
              boxShadow: `0 6px 20px ${accentUser(user)}55`,
            }}>{iniciales(user.nombre || user.email)}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em' }}>{user.nombre}</div>
              <div style={{ fontSize: 13, color: '#6E6E73' }}>{u_desc(user)}</div>
              <div style={{ fontSize: 11.5, color: '#8E8E93', marginTop: 3 }}>{user.email}</div>
            </div>
          </div>

          {/* Segmented control meses */}
          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.06)', borderRadius: 12, padding: 3, gap: 2, marginBottom: 4, flexWrap: 'wrap' }}>
            {mesesDisponibles.map((m) => {
              const on = m.anio === mesRef.anio && m.mes === mesRef.mes;
              const label = m.anio === hoy.getFullYear() ? MESES_CORTO[m.mes - 1] : `${MESES_CORTO[m.mes - 1]} ${String(m.anio).slice(2)}`;
              return (
                <button key={`${m.anio}-${m.mes}`} onClick={() => setMesRef(m)} style={{
                  border: 'none', background: on ? 'white' : 'transparent',
                  color: on ? '#1D1D1F' : '#6E6E73',
                  padding: '7px 12px', fontSize: 12.5, fontWeight: 600, borderRadius: 9,
                  cursor: 'pointer', boxShadow: on ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>{label}</button>
              );
            })}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#8E8E93' }}>Cargando…</div>
        ) : (
          <div style={{ padding: '0 24px 32px' }}>
            {/* Telemetría del mes */}
            <SubSectSheet titulo="Actividad del mes">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                <MiniKPI k="Días activos" v={`${dias}/${diasEnMes}`} s={`${(dias/diasEnMes*100).toFixed(0)}% del mes`} />
                <MiniKPI k="Tiempo activo" v={fmtHm(heartbeats)} s={`${(heartbeats/Math.max(1,dias)/60).toFixed(1)} h/día`} />
                <MiniKPI k="Última sesión" v={fmtHace(eventos[0]?.ts).replace('hace ', '')}
                  s={eventos[0] ? fmtFechaHora(eventos[0].ts) : 'Sin sesiones'} />
              </div>
              {cliOrden.length > 0 && (
                <div style={{ marginTop: 14 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Atención por cliente</div>
                  {cliOrden.map(([cli, cnt]) => {
                    const pct = totalCli > 0 ? (cnt / totalCli * 100) : 0;
                    return (
                      <div key={cli} style={{ marginBottom: 6 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                          <span style={{ fontWeight: 600 }}>{CLIENTE_LABEL[cli] || cli}</span>
                          <span style={{ color: '#6E6E73' }}>{pct.toFixed(0)}% · {cnt}m</span>
                        </div>
                        <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: CLIENTE_COLOR[cli] || '#94A3B8', borderRadius: 3 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </SubSectSheet>

            {/* Evaluación (sólo internos con evaluación y sólo admin ve) */}
            {aplicaBono && esAdmin && (
              <EvalSheet user={user} anio={mesRef.anio} mes={mesRef.mes}
                facturacion={facturacion} cuota={cuota} cuotaPct={cuotaPct}
                evaluacion={evaluacion} onSaved={reload} perfilId={perfilId} />
            )}
          </div>
        )}
      </div>
    </>
  );
}

function u_desc(user) {
  const tipoTxt = user.tipo === 'externo' ? 'Externo' : 'Interno';
  return `${user.puesto || user.rol} · ${tipoTxt}`;
}

function SubSectSheet({ titulo, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 14, padding: '14px 16px', marginBottom: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 700, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>{titulo}</div>
      {children}
    </div>
  );
}

function MiniKPI({ k, v, s }) {
  return (
    <div style={{ background: 'white', borderRadius: 11, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: '#6E6E73', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 10.5, color: '#8E8E93', marginTop: 1 }}>{s}</div>
    </div>
  );
}

// ═══════════════════ Bloque evaluación dentro del sheet ═══════════════════
function EvalSheet({ user, anio, mes, facturacion, cuota, cuotaPct, evaluacion, onSaved, perfilId }) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  const isCerrada = evaluacion?.cerrada === true;
  const bonoBase = Math.max(BONO_BASE, facturacion * BONO_PCT);
  const ajustesTotal = (evaluacion?.ajustes || []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const bonoTotal = bonoBase + ajustesTotal;

  const upsertPatch = async (patch) => {
    if (isCerrada) return;
    setSaving(true);
    if (evaluacion?.id) {
      await supabase.from('evaluaciones_mensuales').update(patch).eq('id', evaluacion.id);
    } else {
      await supabase.from('evaluaciones_mensuales').insert({
        user_id: user.user_id, anio, mes,
        facturacion, cuota_total: cuota, cuota_pct: cuotaPct,
        bono_base: bonoBase, bono_ajustes: 0, bono_total: bonoBase,
        ...patch,
      });
    }
    setSaving(false);
    if (onSaved) await onSaved();
  };

  const cerrarEvaluacion = async () => {
    if (isCerrada) return;
    setSaving(true);
    const patch = {
      facturacion, cuota_total: cuota, cuota_pct: cuotaPct,
      bono_base: bonoBase, bono_ajustes: ajustesTotal, bono_total: bonoTotal,
      cerrada: true, cerrada_ts: new Date().toISOString(), cerrada_por: perfilId,
    };
    if (evaluacion?.id) await supabase.from('evaluaciones_mensuales').update(patch).eq('id', evaluacion.id);
    else await supabase.from('evaluaciones_mensuales').insert({ user_id: user.user_id, anio, mes, ...patch });
    setSaving(false);
    setConfirmCerrar(false);
    if (onSaved) await onSaved();
  };

  const copiarTexto = () => {
    const sep = '═══════════════════════════════════════════════════════════';
    const ratings = RATINGS.map((r) => ({ label: r.label, val: evaluacion?.[r.key] || null }));
    const conRat = ratings.filter((r) => r.val);
    const promRat = conRat.length ? conRat.reduce((s, r) => s + r.val, 0) / conRat.length : 0;
    const tareas = evaluacion?.tareas || [];
    const cumplidas = tareas.filter((t) => t.cumplida).length;
    const ajustes = evaluacion?.ajustes || [];

    let txt = `Bono ${user.nombre} · ${MESES[mes-1]} ${anio} · ${fmtMoney(bonoTotal)} MXN\n\n`;
    txt += sep + '\nCUOTA ALCANZADA\n';
    txt += `Facturado: ${fmtMoney(facturacion)} | Cuota: ${fmtMoney(cuota)}\n`;
    txt += `Alcance: ${cuotaPct.toFixed(1)}%${cuotaPct >= 100 ? ' (superó la cuota)' : ''}\n\n`;

    txt += sep + '\nEVALUACIÓN CUALITATIVA\n';
    for (const r of ratings) txt += `· ${r.label.padEnd(22, ' ')}: ${r.val ? `${r.val}/5` : '—'}\n`;
    if (promRat > 0) txt += `Promedio: ${promRat.toFixed(1)}/5\n`;
    if (evaluacion?.comentarios) txt += `\nFeedback:\n${evaluacion.comentarios}\n`;

    if (tareas.length > 0) {
      txt += '\n' + sep + `\nTAREAS DEL MES (${cumplidas} de ${tareas.length})\n`;
      for (const t of tareas) {
        txt += `${t.cumplida ? '✓' : '✗'} ${t.texto}\n`;
        if (t.nota) txt += `    → ${t.nota}\n`;
      }
    }
    if (ajustes.length > 0) {
      txt += '\n' + sep + `\nAJUSTES AL BONO (${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)})\n`;
      for (const a of ajustes) {
        const signo = Number(a.monto) >= 0 ? '+' : '−';
        txt += `${a.fecha || ''}  ${signo}${fmtMoney(Math.abs(Number(a.monto)))}  ${a.descripcion || ''}\n`;
      }
    }
    txt += '\n' + sep + '\nCÁLCULO DEL BONO\n';
    txt += `Base       = max(${fmtMoney(BONO_BASE)}, ${(BONO_PCT*100).toFixed(2)}% × ${fmtMoney(facturacion)}) = ${fmtMoney(bonoBase)}\n`;
    if (ajustesTotal !== 0) txt += `Ajustes    = ${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)}\n`;
    txt += `─────────────────────\nTotal a pagar: ${fmtMoney(bonoTotal)} MXN\n\n`;
    if (isCerrada) txt += `Evaluación cerrada el ${new Date(evaluacion.cerrada_ts).toLocaleDateString('es-MX')} · inmutable\n`;
    else txt += `(evaluación aún abierta — puede cambiar)\n`;

    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div>
      {/* Bono hero */}
      <div style={{
        background: `linear-gradient(135deg, ${accentUser(user)} 0%, ${accentUser(user)}CC 100%)`,
        color: 'white', borderRadius: 18, padding: '20px 22px', marginBottom: 12,
        boxShadow: `0 6px 20px ${accentUser(user)}44`,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'rgba(255,255,255,0.85)' }}>
              Bono {MESES[mes-1]} {anio}
            </div>
            <div style={{ fontSize: 40, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, marginTop: 6 }}>
              {fmtMoney(bonoTotal)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6 }}>
              {isCerrada
                ? <>✓ Cerrada · pagada el {new Date(evaluacion.cerrada_ts).toLocaleDateString('es-MX')}</>
                : cuotaPct >= 100 ? <>Cuota superada · {cuotaPct.toFixed(0)}%</> : <>Cuota al {cuotaPct.toFixed(0)}%</>}
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.25)', fontSize: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
            <span>Base ({(BONO_PCT*100).toFixed(2)}% × {fmtMoney(facturacion)})</span>
            <span>{fmtMoney(bonoBase)}</span>
          </div>
          {ajustesTotal !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
              <span>+ Ajustes manuales</span>
              <span>{ajustesTotal >= 0 ? '+' : ''}{fmtMoney(ajustesTotal)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Botones acciones */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={copiarTexto} style={{
          flex: 1, background: 'white', border: '1px solid rgba(0,0,0,0.1)',
          padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>{copied ? '✓ Copiado' : '📄 Copiar resumen'}</button>
        {!isCerrada && !confirmCerrar && (
          <button onClick={() => setConfirmCerrar(true)} style={{
            flex: 1, background: '#34C759', border: 'none', color: 'white',
            padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
          }}>✓ Cerrar y pagar</button>
        )}
        {confirmCerrar && (
          <>
            <button onClick={() => setConfirmCerrar(false)} style={{
              flex: 1, background: 'rgba(0,0,0,0.06)', border: 'none', padding: '10px',
              borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={cerrarEvaluacion} disabled={saving} style={{
              flex: 1, background: '#34C759', border: 'none', color: 'white',
              padding: '10px', borderRadius: 12, fontSize: 13, fontWeight: 600, cursor: 'pointer',
            }}>Confirmar (irreversible)</button>
          </>
        )}
      </div>

      {/* Nota junio 2026 */}
      {anio === 2026 && mes === 6 && (
        <div style={{ background: 'rgba(255,159,10,0.14)', borderLeft: '3px solid #FF9F0A',
                      padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#7A4A00', marginBottom: 12 }}>
          <strong>Nota:</strong> La telemetría inició en julio 2026. Junio se evalúa con actividad estimada al 100%.
        </div>
      )}

      {/* Cuota */}
      <SubSectSheet titulo="📊 Cuota alcanzada">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
          <div>
            <div style={{ height: 10, background: 'rgba(0,0,0,0.06)', borderRadius: 5, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, cuotaPct)}%`,
                background: 'linear-gradient(90deg, #34C759 0%, #30B04E 100%)', borderRadius: 5 }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 5, color: '#6E6E73' }}>
              <span>Fact. <strong style={{ color: '#1D1D1F' }}>{fmtMoney(facturacion)}</strong></span>
              <span>Cuota <strong style={{ color: '#1D1D1F' }}>{fmtMoney(cuota)}</strong></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#30B04E', letterSpacing: '-0.02em' }}>{cuotaPct.toFixed(1)}%</div>
          </div>
        </div>
      </SubSectSheet>

      {/* Ratings */}
      <SubSectSheet titulo="⭐ Rating por categoría">
        {RATINGS.map((r) => (
          <div key={r.key} style={{ display: 'grid', gridTemplateColumns: '140px 1fr 35px', gap: 10,
            alignItems: 'center', padding: '5px 0', borderBottom: '1px dashed rgba(0,0,0,0.08)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 600 }}>{r.label}</div>
            <div style={{ display: 'flex', gap: 2 }}>
              {[1,2,3,4,5].map((n) => (
                <button key={n} disabled={isCerrada}
                  onClick={() => upsertPatch({ [r.key]: n })}
                  style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: isCerrada ? 'default' : 'pointer',
                    padding: 0, color: (evaluacion?.[r.key] || 0) >= n ? '#FF9F0A' : '#E5E5EA' }}>★</button>
              ))}
            </div>
            <div style={{ fontSize: 11, color: '#6E6E73', textAlign: 'right' }}>{evaluacion?.[r.key] ? `${evaluacion[r.key]}/5` : '—'}</div>
          </div>
        ))}
      </SubSectSheet>

      {/* Comentarios */}
      <SubSectSheet titulo="💬 Comentarios">
        <textarea disabled={isCerrada} defaultValue={evaluacion?.comentarios || ''}
          onBlur={(e) => e.target.value !== (evaluacion?.comentarios || '') && upsertPatch({ comentarios: e.target.value })}
          placeholder="Feedback del mes..."
          style={{ width: '100%', minHeight: 70, padding: 10, fontSize: 12.5,
            border: '1px solid rgba(0,0,0,0.1)', borderRadius: 10, background: 'white',
            resize: 'vertical', fontFamily: 'inherit', outline: 'none' }} />
      </SubSectSheet>

      {/* Tareas */}
      <SubSectSheet titulo={`✓ Tareas${evaluacion?.tareas?.length ? ` (${(evaluacion.tareas || []).filter((t) => t.cumplida).length}/${evaluacion.tareas.length})` : ''}`}>
        <TareasLista tareas={evaluacion?.tareas || []} onChange={(t) => upsertPatch({ tareas: t })} disabled={isCerrada} />
      </SubSectSheet>

      {/* Ajustes */}
      <SubSectSheet titulo={`💵 Ajustes al bono${ajustesTotal !== 0 ? ` (${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)})` : ''}`}>
        <AjustesLista ajustes={evaluacion?.ajustes || []} onChange={(a) => upsertPatch({ ajustes: a })} disabled={isCerrada} />
      </SubSectSheet>
    </div>
  );
}

function TareasLista({ tareas, onChange, disabled }) {
  const [nuevaTexto, setNuevaTexto] = useState('');
  const add = () => {
    const t = nuevaTexto.trim(); if (!t) return;
    onChange([...tareas, { id: Date.now(), texto: t, cumplida: false, nota: '' }]);
    setNuevaTexto('');
  };
  const toggle = (i) => onChange(tareas.map((t, k) => k === i ? { ...t, cumplida: !t.cumplida } : t));
  const remove = (i) => onChange(tareas.filter((_, k) => k !== i));
  const setNota = (i, nota) => onChange(tareas.map((t, k) => k === i ? { ...t, nota } : t));
  return (
    <div>
      {tareas.length === 0 && <div style={{ fontSize: 12, color: '#8E8E93', fontStyle: 'italic' }}>Sin tareas aún</div>}
      {tareas.map((t, i) => (
        <div key={t.id || i} style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 8,
          alignItems: 'flex-start', padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.08)' }}>
          <button disabled={disabled} onClick={() => toggle(i)} style={{
            width: 18, height: 18, marginTop: 2, borderRadius: 4, border: '2px solid #D1D1D6',
            background: t.cumplida ? '#34C759' : 'white', color: 'white', fontSize: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            borderColor: t.cumplida ? '#34C759' : '#D1D1D6', cursor: disabled ? 'default' : 'pointer',
          }}>{t.cumplida ? '✓' : ''}</button>
          <div>
            <div style={{ fontSize: 12.5, color: t.cumplida ? '#8E8E93' : '#1D1D1F',
              textDecoration: t.cumplida ? 'line-through' : 'none' }}>{t.texto}</div>
            {!disabled && (
              <input defaultValue={t.nota || ''}
                onBlur={(e) => e.target.value !== (t.nota || '') && setNota(i, e.target.value)}
                placeholder="+ nota" style={{ fontSize: 10.5, color: '#6E6E73', background: 'transparent',
                  border: 'none', outline: 'none', width: '100%', marginTop: 2 }} />
            )}
            {disabled && t.nota && <div style={{ fontSize: 10.5, color: '#8E8E93', fontStyle: 'italic', marginTop: 2 }}>→ {t.nota}</div>}
          </div>
          {!disabled && <button onClick={() => remove(i)} style={{ color: '#8E8E93', background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer' }}>×</button>}
        </div>
      ))}
      {!disabled && (
        <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
          <input value={nuevaTexto} onChange={(e) => setNuevaTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Nueva tarea..." style={{ flex: 1, fontSize: 12, padding: '6px 10px',
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, outline: 'none' }} />
          <button onClick={add} style={{ background: '#34C759', border: 'none', color: 'white',
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+</button>
        </div>
      )}
    </div>
  );
}

function AjustesLista({ ajustes, onChange, disabled }) {
  const [nueva, setNueva] = useState({ fecha: new Date().toISOString().slice(0, 10), descripcion: '', monto: '' });
  const add = () => {
    const monto = Number(nueva.monto);
    if (!nueva.descripcion.trim() || !isFinite(monto) || monto === 0) return;
    onChange([...ajustes, { id: Date.now(), ...nueva, descripcion: nueva.descripcion.trim(), monto }]);
    setNueva({ fecha: nueva.fecha, descripcion: '', monto: '' });
  };
  const remove = (i) => onChange(ajustes.filter((_, k) => k !== i));
  return (
    <div>
      {ajustes.length === 0 && <div style={{ fontSize: 12, color: '#8E8E93', fontStyle: 'italic' }}>Sin ajustes aún</div>}
      {ajustes.map((a, i) => (
        <div key={a.id || i} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto auto', gap: 10,
          alignItems: 'baseline', padding: '6px 0', borderBottom: '1px dashed rgba(0,0,0,0.08)', fontSize: 12 }}>
          <div style={{ fontSize: 10.5, color: '#8E8E93' }}>{a.fecha}</div>
          <div>{a.descripcion}</div>
          <div style={{ fontWeight: 700, color: Number(a.monto) >= 0 ? '#30B04E' : '#FF3B30' }}>
            {Number(a.monto) >= 0 ? '+' : '−'}{fmtMoney(Math.abs(Number(a.monto)))}
          </div>
          {!disabled && <button onClick={() => remove(i)} style={{ color: '#8E8E93', background: 'transparent', border: 'none', fontSize: 14, cursor: 'pointer' }}>×</button>}
        </div>
      ))}
      {!disabled && (
        <div style={{ marginTop: 8, display: 'grid', gridTemplateColumns: '100px 1fr 90px auto', gap: 6 }}>
          <input type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
            style={{ fontSize: 11, padding: '6px 8px', border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8 }} />
          <input value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Descripción..." style={{ fontSize: 12, padding: '6px 10px',
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, outline: 'none' }} />
          <input type="number" value={nueva.monto} onChange={(e) => setNueva({ ...nueva, monto: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="±$" step="50" style={{ fontSize: 12, padding: '6px 8px',
              border: '1px solid rgba(0,0,0,0.1)', borderRadius: 8, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
          <button onClick={add} style={{ background: '#34C759', border: 'none', color: 'white',
            padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>+</button>
        </div>
      )}
    </div>
  );
}
