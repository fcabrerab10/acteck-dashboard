// MobileEquipo — vista mobile-native de telemetría del equipo.
// Reemplaza TelemetriaPanel cuando mobile === true.
//
// Estructura aprobada en mockup:
//   - Título "Equipo" + badge "Vivo" pulsante
//   - Segmented Miembros ↔ Actividad
//   - Miembros: KPIs (conectados/acciones) + lista con estado activo/ausente
//   - Actividad: timeline vertical de últimas acciones con dot de color por tipo
//
// Auto-refresh cada 30s para mantener el "vivo" real.

import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { supabase } from '../lib/supabase';

// ─── Constantes ───
const PAGINA_LABEL = {
  1: 'Home', 2: 'Análisis', 3: 'Sell In', 4: 'Sell Out', 5: 'Marketing',
  6: 'Pagos', 7: 'Cartera', 8: 'Forecast', 9: 'Sell Out global',
  10: 'Inventario global', 11: 'Estrategia precios', 12: 'Tracking pedidos',
  13: 'Análisis clientes', 14: 'Uploads', 15: 'Telemetría',
  16: 'Evaluaciones', 17: 'Settings', 18: 'Resumen clientes',
  19: 'Propuestas', 20: 'Pendientes', 21: 'Estado de resultados',
};
const CLIENTE_LABEL = { 1: 'Digitalife', 2: 'PCEL', 3: 'Dicotech', 4: 'Mercado Libre', 99: 'Global' };

// Tipos de eventos (ver constants.js del proyecto)
const TIPO = {
  10: { label: 'viendo',     color: '#5AC8FA' }, // heartbeat
  20: { label: 'navegó a',   color: '#007AFF' },
  30: { label: 'cambió cliente', color: '#5856D6' },
  40: { label: 'editó',      color: '#FF9500' },
  50: { label: 'creó',       color: '#34C759' },
  60: { label: 'exportó',    color: '#AF52DE' },
  70: { label: 'guardó',     color: '#34C759' },
  80: { label: 'login',      color: '#34C759' },
  81: { label: 'logout',     color: '#8E8E93' },
  90: { label: 'error',      color: '#FF3B30' },
};

const AVATAR_GRADIENTS = [
  ['#FF2D55', '#FF9500'], ['#5856D6', '#AF52DE'], ['#5AC8FA', '#007AFF'],
  ['#34C759', '#5AC8FA'], ['#FF9500', '#FFCC00'], ['#AF52DE', '#FF2D55'],
];
const iniciales = (nombre) => (nombre || '?').split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase();
const fmtHace = (iso) => {
  if (!iso) return '—';
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'ahora';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
};

const CONECTADO_UMBRAL_S = 90; // heartbeat en últimos 90s = conectado

export default function MobileEquipo({ perfil, onNavegar }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('miembros'); // miembros | actividad
  const [loading, setLoading] = useState(true);
  const [perfiles, setPerfiles] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [tick, setTick] = useState(0);

  // Fetch + auto-refresh cada 30s
  useEffect(() => {
    let alive = true;
    const load = async () => {
      const hoy = new Date();
      hoy.setHours(0, 0, 0, 0);
      const [p, e] = await Promise.all([
        supabase.from('perfiles').select('user_id,nombre,email,rol,tipo,puesto').eq('activo', true).order('nombre'),
        supabase.from('telemetria')
          .select('id,user_id,ts,tipo,cliente,pagina,detalle')
          .gte('ts', hoy.toISOString())
          .order('ts', { ascending: false })
          .limit(500),
      ]);
      if (!alive) return;
      setPerfiles(p.data || []);
      setEventos(e.data || []);
      setLoading(false);
    };
    load();
    const iv = setInterval(load, 30000);
    return () => { alive = false; clearInterval(iv); };
  }, []);

  // Tick para re-render de "hace X" cada 30s
  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, []);

  // Estado por usuario
  const estadoPorUser = useMemo(() => {
    const now = Date.now();
    const m = {};
    perfiles.forEach(u => {
      const evsU = eventos.filter(e => e.user_id === u.user_id);
      const ultimo = evsU[0];
      const ultimoTs = ultimo ? new Date(ultimo.ts).getTime() : 0;
      const diffS = (now - ultimoTs) / 1000;
      m[u.user_id] = {
        online: ultimoTs > 0 && diffS < CONECTADO_UMBRAL_S,
        ultimoTs: ultimo?.ts,
        haciendoQue: ultimo ? describirEvento(ultimo) : null,
        acciones: evsU.filter(e => e.tipo !== 10).length,
      };
    });
    return m;
  }, [perfiles, eventos, tick]);

  const conectadosCount = Object.values(estadoPorUser).filter(x => x.online).length;
  const totalCount = perfiles.length;
  const accionesHoy = eventos.filter(e => e.tipo !== 10).length;

  // Últimas acciones (no heartbeats)
  const acciones = useMemo(
    () => eventos.filter(e => e.tipo !== 10).slice(0, 40),
    [eventos]
  );

  // Ordenar miembros: online primero, luego por última actividad
  const miembrosOrdenados = useMemo(() => {
    return [...perfiles].sort((a, b) => {
      const ea = estadoPorUser[a.user_id];
      const eb = estadoPorUser[b.user_id];
      if (ea?.online !== eb?.online) return ea?.online ? -1 : 1;
      return (eb?.ultimoTs || 0) > (ea?.ultimoTs || 0) ? 1 : -1;
    });
  }, [perfiles, estadoPorUser]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Título */}
      <div style={{ padding: '10px 18px 4px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>
          Equipo
        </h1>
        <LiveBadge theme={theme} count={conectadosCount} />
      </div>

      {/* Segmented */}
      <div style={{
        margin: '10px 18px 12px', padding: 3,
        background: theme.mode === 'dark' ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)',
        borderRadius: 10, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3,
      }}>
        {[['miembros','Miembros'],['actividad','Actividad']].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{
              padding: '8px 10px', borderRadius: 8, border: 'none',
              background: tab === k ? theme.surface : 'transparent',
              color: tab === k ? theme.text : theme.textMuted,
              fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 600,
              cursor: 'pointer',
              boxShadow: tab === k ? '0 1px 2px rgba(0,0,0,.06)' : 'none',
              transition: 'background 160ms',
            }}
          >{l}</button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : tab === 'miembros' ? (
        <MiembrosView
          theme={theme}
          perfiles={miembrosOrdenados}
          estadoPorUser={estadoPorUser}
          conectados={conectadosCount}
          total={totalCount}
          accionesHoy={accionesHoy}
        />
      ) : (
        <ActividadView theme={theme} perfiles={perfiles} acciones={acciones} />
      )}
    </div>
  );
}

// ═══════════════════ Sub-vistas ═══════════════════

function MiembrosView({ theme, perfiles, estadoPorUser, conectados, total, accionesHoy }) {
  return (
    <>
      {/* KPIs */}
      <div style={{ padding: '0 18px 10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <KpiTile theme={theme} label="Conectados ahora"
          value={<>{conectados} <span style={{ fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>de {total}</span></>}
          sub={conectados > 0 ? 'en vivo' : 'nadie ahora'} />
        <KpiTile theme={theme} label="Acciones hoy"
          value={accionesHoy}
          sub="desde media noche" />
      </div>

      <SectionHead theme={theme} title={`Miembros · ${perfiles.length}`} />
      <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {perfiles.map((u, i) => (
          <MiembroRow key={u.user_id} theme={theme} usuario={u} estado={estadoPorUser[u.user_id]} idx={i} />
        ))}
      </div>
    </>
  );
}

function ActividadView({ theme, perfiles, acciones }) {
  const nombrePorId = useMemo(() => {
    const m = {}; perfiles.forEach(u => { m[u.user_id] = u.nombre || u.email || '—'; });
    return m;
  }, [perfiles]);

  if (acciones.length === 0) {
    return (
      <div style={{ margin: '4px 18px 24px', padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>
        Sin actividad hoy
      </div>
    );
  }

  return (
    <>
      <SectionHead theme={theme} title="Últimas acciones" />
      <div style={{ padding: '0 18px 24px' }}>
        {acciones.map((e, i) => {
          const t = TIPO[e.tipo] || { label: `evento ${e.tipo}`, color: theme.textMuted };
          const nombre = nombrePorId[e.user_id] || '—';
          const contexto = e.pagina ? PAGINA_LABEL[e.pagina] : e.cliente ? CLIENTE_LABEL[e.cliente] : (e.detalle || '');
          const isLast = i === acciones.length - 1;
          return (
            <div key={e.id} style={{
              display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10,
              padding: '10px 0', borderBottom: isLast ? 'none' : `1px solid ${theme.divider}`,
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 4 }}>
                <div style={{
                  width: 10, height: 10, borderRadius: '50%',
                  background: t.color, border: `2px solid ${theme.surface}`,
                  boxShadow: `0 0 0 1px ${theme.border}`,
                }} />
                {!isLast && <div style={{ width: 2, flex: 1, background: theme.divider, marginTop: 4 }} />}
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, color: theme.text, lineHeight: 1.4 }}>
                  <b style={{ fontWeight: 700 }}>{nombre}</b>
                  <span style={{ color: theme.textMuted }}> {t.label} </span>
                  {contexto && <b style={{ fontWeight: 700 }}>{contexto}</b>}
                </div>
              </div>
              <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', alignSelf: 'flex-start', paddingTop: 2 }}>
                {fmtHace(e.ts)}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ═══════════════════ Componentes ═══════════════════

function LiveBadge({ theme, count }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 8px', borderRadius: 100,
      background: 'rgba(52,199,89,.15)', color: theme.green || '#34C759',
      fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%',
        background: theme.green || '#34C759',
        animation: count > 0 ? 'meq-pulse 1.6s ease-in-out infinite' : 'none',
      }} />
      {count > 0 ? 'Vivo' : 'Inactivo'}
      <style>{`@keyframes meq-pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
    </span>
  );
}

function KpiTile({ theme, label, value, sub }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, padding: 12,
    }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function SectionHead({ theme, title }) {
  return (
    <div style={{ padding: '12px 18px 4px' }}>
      <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '.08em', color: theme.textMuted, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

function MiembroRow({ theme, usuario, estado, idx }) {
  const online = !!estado?.online;
  const grad = AVATAR_GRADIENTS[idx % AVATAR_GRADIENTS.length];
  const esExterno = usuario.tipo === 'externo';
  const esYo = false; // No sabemos el yo aquí, pero perfil viene arriba y podríamos comparar

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: 12, display: 'flex', alignItems: 'center', gap: 12,
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: '50%',
        background: online ? `linear-gradient(135deg, ${grad[0]}, ${grad[1]})` : (theme.mode === 'dark' ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)'),
        color: online ? '#fff' : theme.textMuted,
        display: 'grid', placeItems: 'center',
        fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13, letterSpacing: '.02em',
        flex: '0 0 auto', position: 'relative',
      }}>
        {iniciales(usuario.nombre || usuario.email)}
        {online && (
          <span style={{
            position: 'absolute', bottom: -1, right: -1,
            width: 12, height: 12, borderRadius: '50%',
            background: theme.green || '#34C759',
            border: `2px solid ${theme.surface}`,
          }} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: theme.text, display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{usuario.nombre || usuario.email}</span>
          {esExterno && (
            <span style={{
              fontSize: 9.5, fontWeight: 700, color: theme.orange || '#FF9500',
              textTransform: 'uppercase', letterSpacing: '.06em',
              padding: '1px 5px', borderRadius: 4,
              background: 'rgba(255,149,0,.12)',
              flex: '0 0 auto',
            }}>EXT</span>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {online
            ? (estado?.haciendoQue || 'Viendo dashboard')
            : (estado?.ultimoTs ? `Última conexión · hace ${fmtHace(estado.ultimoTs)}` : 'Sin actividad hoy')}
        </div>
      </div>
      <span style={{
        fontSize: 10.5, padding: '3px 8px', borderRadius: 100, fontWeight: 700,
        background: online ? 'rgba(52,199,89,.15)' : (theme.mode === 'dark' ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'),
        color: online ? (theme.green || '#34C759') : theme.textMuted,
        flex: '0 0 auto',
      }}>{online ? 'activo' : 'ausente'}</span>
    </div>
  );
}

// ─── Descripciones legibles de eventos ───
function describirEvento(e) {
  if (e.tipo === 10 && e.pagina) return `Viendo · ${PAGINA_LABEL[e.pagina] || `pág ${e.pagina}`}`;
  if (e.tipo === 20 && e.pagina) return `Navegó a · ${PAGINA_LABEL[e.pagina] || `pág ${e.pagina}`}`;
  if (e.tipo === 30 && e.cliente) return `Cambió a · ${CLIENTE_LABEL[e.cliente] || `cliente ${e.cliente}`}`;
  if (e.tipo === 40) return 'Editando';
  if (e.tipo === 50) return 'Creó algo';
  if (e.tipo === 60) return 'Exportando';
  if (e.tipo === 70) return 'Guardando';
  if (e.tipo === 80) return 'Conectado';
  if (e.tipo === 90) return 'Error';
  return e.detalle || 'Viendo dashboard';
}
