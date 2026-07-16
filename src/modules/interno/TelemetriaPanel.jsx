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

// Requiere evaluación mensual todo interno que no sea super_admin.
// Permisivo con `tipo`: si es null/undefined lo trata como interno (evita que se pierda la eval por dato faltante).
const requiereEvaluacion = (u) => u.rol !== 'super_admin' && u.tipo !== 'externo';

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
  const perfil = usePerfil(); // Context inyecta el perfil directo, NO {perfil}
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
    if (!esAdmin) { setLoading(false); return; } // defensa: no fetch si no es admin
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
  }, [anioActual, mesActual, esAdmin]);

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
        ? (dias.size > 0 ? (BONO_BASE + facturacionMes * BONO_PCT) : BONO_BASE)
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
  // Tipo null/undefined → asumir interno (para no ocultar usuarios con dato faltante)
  const internos = usuariosVisibles.filter((u) => u.tipo !== 'externo');
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

  // Defensa: si no es super_admin, no renderizar contenido (el gate real está en App.jsx).
  if (!esAdmin) {
    return (
      <div style={WRAPPER_STYLE}>
        <h1 style={{ fontSize: 34, fontWeight: 700, letterSpacing: '-0.02em', margin: 0 }}>Actividad del equipo</h1>
        <p style={{ color: '#6E6E73', fontSize: 14, margin: '4px 0 24px' }}>Sin acceso.</p>
      </div>
    );
  }

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

      {/* Modo enfocado: sólo la card seleccionada + panel */}
      {selectedUserId ? (() => {
        const uSel = usuarios.find((u) => u.user_id === selectedUserId);
        if (!uSel) return null;
        return (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <button onClick={() => setSelectedUserId(null)} style={{
                background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.08)',
                padding: '8px 14px', borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: 'pointer', color: '#1D1D1F', display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>← Ver todos</button>
              <div style={{ fontSize: 12, color: '#6E6E73' }}>
                Enfoque en <strong style={{ color: '#1D1D1F' }}>{uSel.nombre}</strong>
              </div>
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 16, marginBottom: 12,
            }}>
              <UserCard u={uSel} kpis={kpisPorUser.get(uSel.user_id)}
                bonoBase={(BONO_BASE + facturacionMes * BONO_PCT)}
                evaluacionActual={evalPorUser.get(uSel.user_id)}
                onClick={() => setSelectedUserId(null)} />
            </div>
            <UserDetailPanel user={uSel} esAdmin={esAdmin} perfilId={perfil?.user_id}
              onClose={() => setSelectedUserId(null)} />
          </>
        );
      })() : (
        <>
          {/* Sección Internos */}
          {internos.length > 0 && (
            <>
              <SeccionHeader color="#FF375F" label="Acteck · Equipo interno" cnt={`${internos.length} ${internos.length === 1 ? 'usuario' : 'usuarios'}`} />
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                gap: 16, marginBottom: 24,
              }}>
                {internos.map((u) => (
                  <UserCard key={u.user_id} u={u} kpis={kpisPorUser.get(u.user_id)}
                    bonoBase={(BONO_BASE + facturacionMes * BONO_PCT)}
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
        </>
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

// ═══════════════════ Panel de detalle inline (se despliega debajo) ═══════════════════
function UserDetailPanel({ user, esAdmin, perfilId, onClose }) {
  const hoy = new Date();
  const [mesRef, setMesRef] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const [eventos, setEventos] = useState([]);
  const [evaluacion, setEvaluacion] = useState(null);
  const [evalPrev, setEvalPrev] = useState(null); // bono del mes anterior (cerrado) para trend
  const [facturacion, setFacturacion] = useState(0);
  const [cuota, setCuota] = useState(0);
  const [loading, setLoading] = useState(true);

  // Últimos 6 meses (incluye actual) ordenados cronológicamente izq→der
  const mesesDisponibles = useMemo(() => {
    const arr = [];
    let a = hoy.getFullYear(), m = hoy.getMonth() + 1;
    for (let i = 0; i < 6; i++) {
      arr.push({ anio: a, mes: m });
      m--; if (m < 1) { m = 12; a--; }
    }
    return arr.reverse(); // más antiguo primero → actual al final (derecha)
  }, []);

  const reload = React.useCallback(async () => {
    setLoading(true);
    const { ini, fin } = rangoMes(mesRef.anio, mesRef.mes);
    // Mes anterior — para trend del bono
    const mesPrev = mesRef.mes === 1 ? 12 : mesRef.mes - 1;
    const anioPrev = mesRef.mes === 1 ? mesRef.anio - 1 : mesRef.anio;
    const [evs, fact, cuotas, evalRes, evalPrevRes] = await Promise.all([
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
      supabase.from('evaluaciones_mensuales').select('bono_total,cerrada')
        .eq('user_id', user.user_id).eq('anio', anioPrev).eq('mes', mesPrev).maybeSingle(),
    ]);
    setEventos(evs.data || []);
    setFacturacion((fact.data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0));
    setCuota((cuotas.data || []).reduce((s, r) => s + (Number(r.cuota_min) || 0), 0) + DIGITALIFE_CUOTA_ANUAL / 12);
    setEvaluacion(evalRes.data || null);
    setEvalPrev(evalPrevRes.data && evalPrevRes.data.cerrada ? evalPrevRes.data : null);
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

  // Mostrar evaluación siempre que se abra el panel. Sin filtros por rol/tipo que
  // puedan fallar por datos inconsistentes en la DB. Si abre su propia card el super_admin
  // simplemente ve la eval vacía y no la usa.
  const puedeEvaluar = true;
  const aplicaBono = true;
  const bonoBase = (BONO_BASE + facturacion * BONO_PCT);
  const ajustesTotal = (evaluacion?.ajustes || []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const bonoTotal = bonoBase + ajustesTotal;
  const cuotaPct = cuota > 0 ? (facturacion / cuota * 100) : 0;

  // Scroll suave al abrir para que el panel entre en vista
  const panelRef = React.useRef(null);
  useEffect(() => {
    if (panelRef.current) panelRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [user.user_id]);

  return (
    <div ref={panelRef} style={{
      marginTop: 8,
      background: 'rgba(255,255,255,0.85)',
      backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
      border: '1px solid rgba(255,255,255,0.7)',
      borderRadius: 22,
      boxShadow: '0 8px 40px rgba(0,0,0,0.08)',
      overflow: 'hidden',
      animation: 'slidedown 280ms cubic-bezier(0.32, 0.72, 0, 1)',
    }}>
      <style>{`
        @keyframes slidedown { from { transform: translateY(-12px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
      `}</style>

      {/* Header con avatar + cerrar + meses (todo en una fila) */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14,
        padding: '12px 18px', borderBottom: '1px solid rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 999, background: colorAvatar(user),
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0,
            boxShadow: `0 2px 8px ${accentUser(user)}44`,
          }}>{iniciales(user.nombre || user.email)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.01em' }}>{user.nombre}</div>
            <div style={{ fontSize: 11.5, color: '#8E8E93' }}>{u_desc(user)} · {user.email}</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'inline-flex', background: 'rgba(0,0,0,0.06)', borderRadius: 10, padding: 2, gap: 1 }}>
            {mesesDisponibles.map((m) => {
              const on = m.anio === mesRef.anio && m.mes === mesRef.mes;
              const label = m.anio === hoy.getFullYear() ? MESES_CORTO[m.mes - 1] : `${MESES_CORTO[m.mes - 1]} ${String(m.anio).slice(2)}`;
              return (
                <button key={`${m.anio}-${m.mes}`} onClick={() => setMesRef(m)} style={{
                  border: 'none', background: on ? 'white' : 'transparent',
                  color: on ? '#1D1D1F' : '#6E6E73',
                  padding: '5px 10px', fontSize: 11.5, fontWeight: 600, borderRadius: 8,
                  cursor: 'pointer', boxShadow: on ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                }}>{label}</button>
              );
            })}
          </div>
          <button onClick={onClose} style={{
            width: 28, height: 28, borderRadius: 999, border: 'none',
            background: 'rgba(0,0,0,0.06)', color: '#1D1D1F', fontSize: 14,
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>✕</button>
        </div>
      </div>

      {loading ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#8E8E93', fontSize: 13 }}>Cargando…</div>
      ) : (
        <EvalPanel
          user={user} anio={mesRef.anio} mes={mesRef.mes}
          facturacion={facturacion} cuota={cuota} cuotaPct={cuotaPct}
          evaluacion={evaluacion} bonoPrev={evalPrev?.bono_total || null}
          onSaved={reload} perfilId={perfilId}
          telemetria={{
            dias, diasEnMes, heartbeats, eventos, cliOrden, totalCli,
          }}
        />
      )}
    </div>
  );
}

function u_desc(user) {
  const tipoTxt = user.tipo === 'externo' ? 'Externo' : 'Interno';
  return `${user.puesto || user.rol} · ${tipoTxt}`;
}

function SubSectSheet({ titulo, children }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.7)', borderRadius: 12, padding: '10px 12px', marginBottom: 8 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 7 }}>{titulo}</div>
      {children}
    </div>
  );
}

function MiniKPI({ k, v, s }) {
  return (
    <div style={{ background: 'white', borderRadius: 9, padding: '7px 9px' }}>
      <div style={{ fontSize: 9.5, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 700 }}>{k}</div>
      <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 10, color: '#8E8E93', marginTop: 0 }}>{s}</div>
    </div>
  );
}

// ═══════════════════ Panel completo (telemetría + evaluación, layout 2-col balanceado) ═══════════════════
function EvalPanel({ user, anio, mes, facturacion, cuota, cuotaPct, evaluacion, bonoPrev, onSaved, perfilId, telemetria }) {
  // Estado local optimista — inicia del prop y se actualiza inmediato en cada click.
  // Los saves a Supabase corren en background sin bloquear UI.
  const [evalLocal, setEvalLocal] = useState(evaluacion);
  const [copied, setCopied] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);
  const idRef = React.useRef(evaluacion?.id || null);

  // Resincroniza cuando cambia el mes o llega data fresca del servidor
  useEffect(() => {
    setEvalLocal(evaluacion);
    idRef.current = evaluacion?.id || null;
  }, [evaluacion?.id, anio, mes]);

  const isCerrada = evalLocal?.cerrada === true;
  const bonoBase = (BONO_BASE + facturacion * BONO_PCT);
  const ajustesTotal = (evalLocal?.ajustes || []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const bonoTotal = bonoBase + ajustesTotal;

  const accent = accentUser(user);

  const upsertPatch = (patch) => {
    if (isCerrada) return;
    // 1. Update UI instantáneo
    setEvalLocal((prev) => ({ ...(prev || {}), ...patch }));
    // 2. Save background
    (async () => {
      if (idRef.current) {
        await supabase.from('evaluaciones_mensuales').update(patch).eq('id', idRef.current);
      } else {
        const { data } = await supabase.from('evaluaciones_mensuales').insert({
          user_id: user.user_id, anio, mes,
          facturacion, cuota_total: cuota, cuota_pct: cuotaPct,
          bono_base: bonoBase, bono_ajustes: 0, bono_total: bonoBase,
          ...patch,
        }).select('id').single();
        if (data?.id) idRef.current = data.id;
      }
    })();
  };

  const cerrarEvaluacion = async () => {
    if (isCerrada) return;
    const patch = {
      facturacion, cuota_total: cuota, cuota_pct: cuotaPct,
      bono_base: bonoBase, bono_ajustes: ajustesTotal, bono_total: bonoTotal,
      cerrada: true, cerrada_ts: new Date().toISOString(), cerrada_por: perfilId,
    };
    setEvalLocal((prev) => ({ ...(prev || {}), ...patch }));
    setConfirmCerrar(false);
    if (idRef.current) await supabase.from('evaluaciones_mensuales').update(patch).eq('id', idRef.current);
    else {
      const { data } = await supabase.from('evaluaciones_mensuales')
        .insert({ user_id: user.user_id, anio, mes, ...patch }).select('id').single();
      if (data?.id) idRef.current = data.id;
    }
    if (onSaved) onSaved();
  };

  // Alias para compatibilidad — la variable original evaluacion se usa mucho abajo
  const evaluacion_ = evalLocal;

  const copiarTexto = () => {
    const rats = RATINGS.map((r) => evaluacion_?.[r.key]).filter(Boolean);
    const promRat = rats.length ? rats.reduce((s, v) => s + v, 0) / rats.length : 0;
    const tareas = evaluacion_?.tareas || [];
    const cumplidas = tareas.filter((t) => t.cumplida).length;
    const pendientes = tareas.filter((t) => !t.cumplida);
    const ajustes = evaluacion_?.ajustes || [];
    const nombreCorto = (user.nombre || '').split(' ')[0];
    const bonoPct = facturacion * BONO_PCT;

    // Highlights automáticos en texto plano (mismas reglas que la UI)
    const autoHl = [];
    if (cliOrden.length > 0) {
      const [topCli, topCnt] = cliOrden[0];
      const topPct = totalCli > 0 ? (topCnt / totalCli * 100) : 0;
      if (topPct >= 45) autoHl.push(`Más foco en ${CLIENTE_LABEL[topCli] || topCli} (${topPct.toFixed(0)}% del tiempo).`);
    }
    const clientesConEventos = new Set(cliOrden.map(([c]) => Number(c)));
    const clienteKeyToId = { digitalife: 1, pcel: 2, dicotech: 3 };
    for (const key of CLIENTES_BONO) {
      const id = clienteKeyToId[key];
      if (!clientesConEventos.has(id)) autoHl.push(`Sin visitas a ${CLIENTE_LABEL[id] || key} este mes.`);
    }
    const pctDias = diasEnMes > 0 ? (dias / diasEnMes * 100) : 0;
    if (pctDias > 0 && pctDias < 40) autoHl.push(`Actividad baja: sólo ${dias}/${diasEnMes} días con sesión.`);

    const L = [];
    L.push(`Evaluación de ${nombreCorto} · ${MESES[mes-1]} ${anio}`);

    // 1. Alcance de cuota
    L.push('');
    L.push(`Alcance de cuota: ${fmtMoney(facturacion)} de ${fmtMoney(cuota)} (${cuotaPct.toFixed(0)}%${cuotaPct >= 100 ? ', superada' : ''}).`);

    // 2. Evaluación cualitativa
    if (rats.length > 0) {
      L.push('');
      L.push(`Evaluación cualitativa: ${promRat.toFixed(1)}/5.`);
    }

    // 3. Highlights automáticos por cuenta
    if (autoHl.length > 0) {
      L.push('');
      L.push('Notas automáticas:');
      for (const h of autoHl) L.push(`- ${h}`);
    }

    // 4. Feedback manual
    if (evaluacion_?.comentarios?.trim()) {
      L.push('');
      L.push(`Feedback: ${evaluacion_.comentarios.trim()}`);
    }

    // 5. Tareas
    if (tareas.length > 0) {
      L.push('');
      L.push(`Tareas: ${cumplidas} de ${tareas.length} cumplidas${pendientes.length > 0 && pendientes.length <= 3 ? `; pendientes: ${pendientes.map((t) => t.texto).join('; ')}` : ''}.`);
    }

    // 6. Ajustes
    if (ajustes.length > 0) {
      L.push('');
      L.push('Ajustes:');
      for (const a of ajustes) {
        const signo = Number(a.monto) >= 0 ? '+' : '−';
        L.push(`- ${signo}${fmtMoney(Math.abs(Number(a.monto)))} · ${a.descripcion || ''}`);
      }
    }

    // 7. Bono con desglose al final
    L.push('');
    L.push('Bono:');
    L.push(`- Variable fija: ${fmtMoney(BONO_BASE)}`);
    L.push(`- Comisión ${(BONO_PCT*100).toFixed(2)}% sobre ${fmtMoney(facturacion)}: ${fmtMoney(bonoPct)}`);
    if (ajustesTotal !== 0) L.push(`- Ajustes: ${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)}`);
    L.push(`Total a pagar: ${fmtMoney(bonoTotal)}`);

    navigator.clipboard.writeText(L.join('\n'));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const { dias, diasEnMes, heartbeats, eventos, cliOrden, totalCli } = telemetria;

  // Trend vs mes anterior (sólo si el prev está cerrado)
  const trendPct = bonoPrev && bonoPrev > 0 ? ((bonoTotal - bonoPrev) / bonoPrev * 100) : null;
  const trendAbs = bonoPrev != null ? (bonoTotal - bonoPrev) : null;

  // Highlights automáticos de telemetría — reglas simples, señales accionables
  const highlights = React.useMemo(() => {
    const out = [];
    // 1. Cliente más atendido
    if (cliOrden.length > 0) {
      const [topCli, topCnt] = cliOrden[0];
      const topPct = totalCli > 0 ? (topCnt / totalCli * 100) : 0;
      if (topPct >= 45) out.push({
        icon: '↑', color: '#1F7A3D',
        text: <>Más foco en <strong>{CLIENTE_LABEL[topCli] || topCli}</strong> · {topPct.toFixed(0)}% del tiempo</>,
      });
    }
    // 2. Clientes de bono con 0 visitas
    const clientesConEventos = new Set(cliOrden.map(([c]) => Number(c)));
    const clienteKeyToId = { digitalife: 1, pcel: 2, dicotech: 3 };
    for (const key of CLIENTES_BONO) {
      const id = clienteKeyToId[key];
      if (!clientesConEventos.has(id)) {
        out.push({
          icon: '!', color: '#B25000',
          text: <>Sin visitas a <strong>{CLIENTE_LABEL[id] || key}</strong> este mes</>,
        });
      }
    }
    // 3. Días activos bajos
    const pctDias = diasEnMes > 0 ? (dias / diasEnMes * 100) : 0;
    if (pctDias > 0 && pctDias < 40) out.push({
      icon: '↓', color: '#B00020',
      text: <>Actividad baja · sólo <strong>{dias}/{diasEnMes}</strong> días con sesión</>,
    });
    // 4. Racha de días activos (streak) — últimos días consecutivos con sesión
    const diasSet = new Set(eventos.map((e) => new Date(e.ts).toISOString().slice(0, 10)));
    let streak = 0;
    const cursor = new Date();
    while (diasSet.has(cursor.toISOString().slice(0, 10)) && streak < 60) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }
    if (streak >= 5) out.push({
      icon: '★', color: '#1F7A3D',
      text: <>Racha activa · <strong>{streak}</strong> días consecutivos</>,
    });
    // 5. Sin sesiones en X días recientes
    const ultimoISO = eventos[0]?.ts;
    if (ultimoISO) {
      const diasSinSesion = Math.floor((Date.now() - new Date(ultimoISO).getTime()) / 86400000);
      if (diasSinSesion >= 3) out.push({
        icon: '!', color: '#B25000',
        text: <>Sin sesión hace <strong>{diasSinSesion} días</strong></>,
      });
    }
    return out.slice(0, 4); // máximo 4 para no saturar
  }, [cliOrden, totalCli, dias, diasEnMes, eventos]);

  return (
    <div style={{ padding: '14px 20px 20px',
      display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.15fr)', gap: 14,
      alignItems: 'start',
    }}>
      {/* ═══════════ COLUMNA IZQUIERDA — contexto/KPIs ═══════════ */}
      <div>
      {/* Actividad del mes */}
      <SubSectSheet titulo="Actividad del mes">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          <MiniKPI k="Días" v={`${dias}/${diasEnMes}`} s={`${(dias/diasEnMes*100).toFixed(0)}%`} />
          <MiniKPI k="Tiempo" v={fmtHm(heartbeats)} s={`${(heartbeats/Math.max(1,dias)/60).toFixed(1)} h/día`} />
          <MiniKPI k="Última" v={fmtHace(eventos[0]?.ts).replace('hace ', '')}
            s={eventos[0] ? fmtFechaHora(eventos[0].ts).split(',')[0] : '—'} />
        </div>
        {cliOrden.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#8E8E93', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 5 }}>Atención por cliente</div>
            {cliOrden.map(([cli, cnt]) => {
              const pct = totalCli > 0 ? (cnt / totalCli * 100) : 0;
              return (
                <div key={cli} style={{ marginBottom: 4 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginBottom: 2 }}>
                    <span style={{ fontWeight: 600 }}>{CLIENTE_LABEL[cli] || cli}</span>
                    <span style={{ color: '#8E8E93', fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: CLIENTE_COLOR[cli] || '#94A3B8', borderRadius: 2 }} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SubSectSheet>

      {/* Highlights automáticos */}
      {highlights.length > 0 && (
        <SubSectSheet titulo="Highlights">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {highlights.map((h, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 12 }}>
                <span style={{
                  width: 18, height: 18, borderRadius: 999, background: `${h.color}18`, color: h.color,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 700, flexShrink: 0,
                }}>{h.icon}</span>
                <span style={{ color: '#1D1D1F', lineHeight: 1.4 }}>{h.text}</span>
              </div>
            ))}
          </div>
        </SubSectSheet>
      )}

      {/* Bono hero — compacto */}
      <div style={{
        background: 'white',
        border: `1px solid ${accent}22`,
        borderRadius: 14, padding: '12px 14px', marginBottom: 10,
        boxShadow: `0 1px 6px ${accent}15`,
        position: 'relative', overflow: 'hidden',
      }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: accent }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: '#8E8E93' }}>
              Bono · {MESES_CORTO[mes-1]} {anio}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 4 }}>
              <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1,
                color: accent, fontVariantNumeric: 'tabular-nums' }}>
                {fmtMoney(bonoTotal)}
              </div>
              {trendPct != null && (
                <div style={{
                  fontSize: 11, fontWeight: 700,
                  color: trendAbs >= 0 ? '#1F7A3D' : '#B00020',
                  display: 'inline-flex', alignItems: 'center', gap: 2,
                  fontVariantNumeric: 'tabular-nums',
                }} title={`Mes anterior: ${fmtMoney(bonoPrev)}`}>
                  {trendAbs >= 0 ? '↗' : '↘'} {trendAbs >= 0 ? '+' : ''}{trendPct.toFixed(0)}%
                </div>
              )}
            </div>
          </div>
          <div style={{
            fontSize: 10.5, fontWeight: 600, padding: '4px 9px', borderRadius: 999,
            background: isCerrada ? 'rgba(52,199,89,0.14)' : 'rgba(0,0,0,0.06)',
            color: isCerrada ? '#1F7A3D' : '#6E6E73', whiteSpace: 'nowrap',
          }}>
            {isCerrada ? '✓ Cerrada' : 'Abierta'}
          </div>
        </div>
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid rgba(0,0,0,0.06)',
          fontSize: 11, color: '#8E8E93' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>Variable fija</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#1D1D1F', fontWeight: 600 }}>{fmtMoney(BONO_BASE)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
            <span>+ {(BONO_PCT*100).toFixed(2)}% sobre facturación de {fmtMoney(facturacion)}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums', color: '#1D1D1F', fontWeight: 600 }}>
              +{fmtMoney(facturacion * BONO_PCT)}
            </span>
          </div>
          {ajustesTotal !== 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
              <span>Ajustes</span>
              <span style={{ fontVariantNumeric: 'tabular-nums', color: ajustesTotal >= 0 ? '#1F7A3D' : '#B00020', fontWeight: 600 }}>
                {ajustesTotal >= 0 ? '+' : ''}{fmtMoney(ajustesTotal)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Botones acciones */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <button onClick={copiarTexto} style={{
          flex: 1, background: 'white', border: '1px solid rgba(0,0,0,0.1)',
          padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
          transition: 'background 120ms',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'white'}>
          {copied ? '✓ Copiado' : 'Copiar resumen'}
        </button>
        {!isCerrada && !confirmCerrar && (
          <button onClick={() => setConfirmCerrar(true)} style={{
            flex: 1, background: '#1F7A3D', border: 'none', color: 'white',
            padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            transition: 'background 120ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = '#175F30'}
          onMouseLeave={(e) => e.currentTarget.style.background = '#1F7A3D'}>
            Cerrar y pagar
          </button>
        )}
        {confirmCerrar && (
          <>
            <button onClick={() => setConfirmCerrar(false)} style={{
              flex: 1, background: 'rgba(0,0,0,0.06)', border: 'none', padding: '8px',
              borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Cancelar</button>
            <button onClick={cerrarEvaluacion} style={{
              flex: 1, background: '#B00020', border: 'none', color: 'white',
              padding: '8px', borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}>Confirmar</button>
          </>
        )}
      </div>

      {/* Nota junio 2026 */}
      {anio === 2026 && mes === 6 && (
        <div style={{ background: 'rgba(255,159,10,0.10)', borderLeft: `3px solid #FF9F0A`,
                      padding: '10px 14px', borderRadius: 8, fontSize: 12, color: '#7A4A00', marginBottom: 12 }}>
          <strong>Nota</strong> · La telemetría inició en julio 2026. Junio se evalúa con actividad estimada al 100%.
        </div>
      )}

      {/* Cuota */}
      <SubSectSheet titulo="Cuota alcanzada">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 14, alignItems: 'center' }}>
          <div>
            <div style={{ height: 8, background: 'rgba(0,0,0,0.06)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, cuotaPct)}%`,
                background: '#1F7A3D', borderRadius: 4, transition: 'width 320ms cubic-bezier(0.32,0.72,0,1)' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, marginTop: 6, color: '#6E6E73' }}>
              <span>Fact. <strong style={{ color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(facturacion)}</strong></span>
              <span>Cuota <strong style={{ color: '#1D1D1F', fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(cuota)}</strong></span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: cuotaPct >= 100 ? '#1F7A3D' : '#1D1D1F',
              letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{cuotaPct.toFixed(0)}%</div>
          </div>
        </div>
      </SubSectSheet>

      </div>{/* ═══════════ /COLUMNA IZQUIERDA ═══════════ */}

      {/* ═══════════ COLUMNA DERECHA — evaluación manual ═══════════ */}
      <div>
      {/* Ratings — pills segmentadas 1-5 */}
      <SubSectSheet titulo="Evaluación cualitativa">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {RATINGS.map((r) => (
            <RatingRow key={r.key} label={r.label}
              value={evaluacion_?.[r.key] || 0}
              onChange={(n) => upsertPatch({ [r.key]: n })}
              disabled={isCerrada} accent={accent} />
          ))}
        </div>
      </SubSectSheet>

      {/* Comentarios */}
      <SubSectSheet titulo="Comentarios">
        <textarea disabled={isCerrada} defaultValue={evaluacion_?.comentarios || ''}
          key={`comm-${anio}-${mes}`}
          onBlur={(e) => e.target.value !== (evaluacion_?.comentarios || '') && upsertPatch({ comentarios: e.target.value })}
          placeholder="Feedback del mes…"
          style={{ width: '100%', minHeight: 80, padding: 12, fontSize: 13,
            border: '1px solid rgba(0,0,0,0.08)', borderRadius: 12, background: 'white',
            resize: 'vertical', fontFamily: 'inherit', outline: 'none',
            transition: 'border-color 120ms',
          }}
          onFocus={(e) => e.currentTarget.style.borderColor = accent}
          onBlurCapture={(e) => e.currentTarget.style.borderColor = 'rgba(0,0,0,0.08)'} />
      </SubSectSheet>

      {/* Tareas */}
      <SubSectSheet titulo={`Tareas del mes${evaluacion_?.tareas?.length ? ` · ${(evaluacion_.tareas || []).filter((t) => t.cumplida).length}/${evaluacion_.tareas.length}` : ''}`}>
        <TareasLista tareas={evaluacion_?.tareas || []} onChange={(t) => upsertPatch({ tareas: t })} disabled={isCerrada} accent={accent} />
      </SubSectSheet>

      {/* Ajustes */}
      <SubSectSheet titulo={`Ajustes al bono${ajustesTotal !== 0 ? ` · ${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)}` : ''}`}>
        <AjustesLista ajustes={evaluacion_?.ajustes || []} onChange={(a) => upsertPatch({ ajustes: a })} disabled={isCerrada} />
      </SubSectSheet>
      </div>{/* ═══════════ /COLUMNA DERECHA ═══════════ */}
    </div>
  );
}

// Segmented control 1-5 (Apple-style)
function RatingRow({ label, value, onChange, disabled, accent }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 10, alignItems: 'center' }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: '#1D1D1F' }}>{label}</div>
      <div style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2, gap: 1 }}>
        {[1,2,3,4,5].map((n) => {
          const on = value === n;
          return (
            <button key={n} disabled={disabled}
              onClick={() => onChange(n)}
              style={{
                flex: 1, border: 'none', padding: '4px 0', borderRadius: 6,
                background: on ? accent : 'transparent',
                color: on ? 'white' : '#6E6E73',
                fontSize: 11.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
                transition: 'background 120ms, color 120ms, transform 80ms',
                boxShadow: on ? '0 1px 2px rgba(0,0,0,0.15)' : 'none',
                fontVariantNumeric: 'tabular-nums',
              }}
              onMouseDown={(e) => !disabled && !on && (e.currentTarget.style.transform = 'scale(0.94)')}
              onMouseUp={(e) => e.currentTarget.style.transform = 'scale(1)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}>
              {n}
            </button>
          );
        })}
      </div>
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
