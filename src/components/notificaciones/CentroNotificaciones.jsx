// CentroNotificaciones — campana + panel flotante "Centro iOS" (propuesta A).
//
//   <CentroNotificaciones onNavegar={handleNavegar} />
//
// Props:
//   onNavegar(clienteKey, paginaId, extra) — como App.handleNavegar. `extra`
//                trae { tipo, label, sku, alerta }. Las acciones tipo url abren
//                pestaña nueva (uploads.html).
//   email      — opcional, para resuelta_por; si no viene se toma de supabase.auth.
//   align      — 'right' (default) | 'left': lado hacia el que se abre el panel.
//   size       — tamaño del botón (default 32).
//
// Una sola cola (tabla `alertas`) en pilas por área. Arriba: críticas + áreas en
// modo "inmediato". Abajo, "Resumen programado {hora}": lo no crítico de las
// áreas en modo "resumen". Silenciadas: pospuestas + áreas en modo "silencio".
// Badge = nº de pilas con novedades (rojo si hay crítica nueva).
// Al abrir una pila, sus alertas quedan leídas (notificaciones_lectura).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, Settings, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { Segmented } from '../kit';
import { supabase } from '../../lib/supabase';
import {
  useAlertas, useAlertasPospuestas, useNoLeidas, usePreferenciasNotif,
  resolverAlerta, posponerAlerta, marcarLeidas, ejecutarAccion, agruparPorArea, areaAlerta, aplicaCliente, esNueva,
} from '../../lib/alertas';
import Pila from './Pila';
import PreferenciasNotificaciones from './PreferenciasNotificaciones';
import useContadorNotificaciones from './useContadorNotificaciones';

const ANCHO = 380;
const TABS = [{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'silenciadas', label: 'Silenciadas' }];

function inicioHoyCDMX() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${iso}T06:00:00.000Z`; // 00:00 CDMX (UTC-6 fijo)
}

async function emailActual(email) {
  if (email) return email;
  try { const { data } = await supabase.auth.getUser(); return data?.user?.email || 'usuario'; }
  catch { return 'usuario'; }
}

function Vacio({ texto = 'Todo al corriente', sub }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '36px 16px' }}>
      <CheckCircle2 size={28} color={theme.green || '#34C759'} strokeWidth={1.8} />
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em' }}>{texto}</span>
      {sub && <span style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>{sub}</span>}
    </div>
  );
}

function Seccion({ titulo, meta }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '12px 16px 6px', background: theme.bg }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle }}>{titulo}</span>
      {meta && <span style={{ fontSize: 11, color: theme.textSubtle }}>{meta}</span>}
    </div>
  );
}

export default function CentroNotificaciones({ onNavegar, email, align = 'right', size = 32 }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [visible, setVisible] = useState(false); // para animar salida
  const [tab, setTab] = useState('hoy');
  const [vista, setVista] = useState('lista'); // 'lista' | 'prefs'
  const [saliendo, setSaliendo] = useState(() => new Set());
  const [ocultas, setOcultas] = useState(() => new Set());
  const raiz = useRef(null);

  const { data: alertas = [], isLoading, isError } = useAlertas();
  const { data: pospuestas = [] } = useAlertasPospuestas({ enabled: abierto && tab === 'silenciadas' });
  const { data: lecturas } = useNoLeidas();
  const { data: prefs } = usePreferenciasNotif();
  const contador = useContadorNotificaciones();

  // Abrir / cerrar con animación (220 ms EASE, salida DUR.exit)
  const abrir = useCallback(() => { setAbierto(true); requestAnimationFrame(() => setVisible(true)); }, []);
  // Inicio ("Ver las N en Notificaciones ›") y otras pantallas abren el centro con este evento.
  useEffect(() => {
    const on = (e) => { e.preventDefault(); abrir(); };
    window.addEventListener('acteck:abrir-notificaciones', on);
    return () => window.removeEventListener('acteck:abrir-notificaciones', on);
  }, [abrir]);
  const cerrar = useCallback(() => {
    setVisible(false);
    setTimeout(() => { setAbierto(false); setVista('lista'); }, reduceMotion() ? 0 : DUR.exit);
  }, []);
  useEffect(() => {
    if (!abierto) return undefined;
    const onDoc = (e) => { if (raiz.current && !raiz.current.contains(e.target)) cerrar(); };
    const onKey = (e) => { if (e.key === 'Escape') cerrar(); };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey); };
  }, [abierto, cerrar]);

  // ─── Clasificación ───
  const hoyIso = useMemo(() => inicioHoyCDMX(), [abierto]); // eslint-disable-line react-hooks/exhaustive-deps
  const activas = useMemo(() => alertas.filter((a) => !ocultas.has(a.id)), [alertas, ocultas]);
  const modoDe = (a) => prefs?.areas?.[areaAlerta(a)] || 'resumen';
  const enAlcance = (a) => aplicaCliente(a, prefs);

  const { inmediatas, resumen, silenciadas } = useMemo(() => {
    const inm = [], res = [], sil = [];
    for (const a of activas) {
      if (!enAlcance(a)) continue;
      const modo = modoDe(a);
      if (a.severidad === 'critica' || modo === 'inmediato') inm.push(a);
      else if (modo === 'resumen') res.push(a);
      else sil.push(a);
    }
    const filtroTab = (arr) => (tab === 'hoy'
      ? arr.filter((a) => esNueva(a, lecturas) || String(a.generada_at || '') >= hoyIso)
      : arr);
    return { inmediatas: filtroTab(inm), resumen: filtroTab(res), silenciadas: sil };
  }, [activas, prefs, lecturas, tab, hoyIso]); // eslint-disable-line react-hooks/exhaustive-deps

  const pilasInm = useMemo(() => agruparPorArea(inmediatas, lecturas), [inmediatas, lecturas]);
  const pilasRes = useMemo(() => agruparPorArea(resumen, lecturas), [resumen, lecturas]);
  const pilasSil = useMemo(() => agruparPorArea([...silenciadas, ...pospuestas.filter((a) => !ocultas.has(a.id))], lecturas), [silenciadas, pospuestas, ocultas, lecturas]);

  // ─── Acciones ───
  const salir = (id, accion) => {
    setSaliendo((s) => new Set(s).add(id));
    setTimeout(async () => {
      setOcultas((s) => new Set(s).add(id));
      setSaliendo((s) => { const n = new Set(s); n.delete(id); return n; });
      try { await accion(); }
      catch (e) { console.error('notificaciones:', e); setOcultas((s) => { const n = new Set(s); n.delete(id); return n; }); }
    }, reduceMotion() ? 0 : DUR.exit);
  };
  const resolver = (a) => salir(a.id, async () => resolverAlerta(a.id, await emailActual(email)));
  const posponer = (a) => salir(a.id, () => posponerAlerta(a.id, 3));
  const ver = (a) => { marcarLeidas([a.id]).catch(() => {}); if (ejecutarAccion(a, onNavegar)) cerrar(); };
  const leerPila = (p) => { const ids = p.alertas.filter((a) => esNueva(a, lecturas)).map((a) => a.id); if (ids.length) marcarLeidas(ids).catch(() => {}); };
  const marcarTodo = () => {
    const ids = [...inmediatas, ...resumen].filter((a) => esNueva(a, lecturas)).map((a) => a.id);
    if (ids.length) marcarLeidas(ids).catch((e) => console.error('marcarLeidas:', e));
  };
  const hayNuevas = [...inmediatas, ...resumen].some((a) => esNueva(a, lecturas));

  // ─── Render ───
  const badgeN = contador.pilas;
  const badgeCol = contador.criticaNueva ? (theme.red || '#FF3B30') : (theme.accent || '#007AFF');
  const hora = prefs?.resumen?.hora || '13:00';
  const pilaProps = { lecturas, saliendo, onAccion: ver, onVer: ver, onPosponer: posponer, onResolver: resolver, onAbrir: leerPila };

  const cuerpo = () => {
    if (isLoading) return <div style={{ padding: '18px 16px', fontSize: 12.5, color: theme.textSubtle }}>Cargando…</div>;
    if (isError) return <div style={{ padding: '18px 16px', fontSize: 12.5, color: theme.red || '#FF3B30' }}>No se pudieron cargar las notificaciones.</div>;
    if (tab === 'silenciadas') {
      if (!pilasSil.length) return <Vacio texto="Nada silenciado" sub="Aquí aparecen las alertas pospuestas y las áreas en modo Silencio." />;
      return pilasSil.map((p) => <Pila key={p.area} pila={p} quieta {...pilaProps} />);
    }
    if (!pilasInm.length && !pilasRes.length) {
      return <Vacio texto="Todo al corriente" sub={tab === 'hoy' ? 'Sin novedades hoy. Mira "Semana" para ver lo pendiente.' : 'No hay alertas activas en tus áreas.'} />;
    }
    return (
      <>
        {pilasInm.map((p, i) => <Pila key={p.area} pila={p} abiertaInicial={i === 0 && p.criticaNueva} {...pilaProps} />)}
        {pilasRes.length > 0 && (
          <>
            <Seccion titulo={`Resumen programado ${hora}`} meta={`${resumen.length} no crítica${resumen.length === 1 ? '' : 's'}`} />
            {pilasRes.map((p) => <Pila key={p.area} pila={p} quieta {...pilaProps} />)}
          </>
        )}
      </>
    );
  };

  return (
    <div ref={raiz} style={{ position: 'relative', display: 'inline-flex', fontFamily: TYPO.fontText }}>
      <button type="button" onClick={() => (abierto ? cerrar() : abrir())} title="Notificaciones" aria-haspopup="dialog" aria-expanded={abierto}
        style={{
          position: 'relative', width: size, height: size, borderRadius: 999, border: `1px solid ${abierto ? theme.borderStrong || theme.border : 'transparent'}`,
          background: abierto ? (theme.surfaceHover || 'rgba(0,0,0,0.04)') : 'transparent', color: abierto ? theme.text : theme.textMuted,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0,
          transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
        }}
        onMouseEnter={(e) => { if (!abierto) e.currentTarget.style.color = theme.text; }}
        onMouseLeave={(e) => { if (!abierto) e.currentTarget.style.color = theme.textMuted; }}>
        <Bell size={Math.round(size * 0.53)} strokeWidth={1.9} />
        {badgeN > 0 && (
          <span aria-label={`${badgeN} con novedades`} style={{
            position: 'absolute', top: -2, right: -3, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 999,
            background: badgeCol, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, lineHeight: '16px', textAlign: 'center',
            border: `2px solid ${theme.surface}`, boxSizing: 'content-box', boxShadow: contador.criticaNueva ? `0 0 8px ${badgeCol}88` : 'none', fontVariantNumeric: 'tabular-nums',
          }}>{badgeN > 9 ? '9+' : badgeN}</span>
        )}
      </button>

      {abierto && (
        <div role="dialog" aria-label="Notificaciones" style={{
          position: 'absolute', top: size + 8, [align === 'left' ? 'left' : 'right']: 0, width: ANCHO, maxWidth: 'calc(100vw - 24px)', zIndex: 1000,
          background: theme.surface, border: bordeFlotante(theme), borderRadius: 12, boxShadow: elevation(theme, 'flotante'), overflow: 'hidden',
          opacity: visible ? 1 : 0, transform: visible ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.98)', transformOrigin: `top ${align}`,
          transition: reduceMotion() ? 'none' : `opacity ${DUR.state}ms ${EASE}, transform ${DUR.state}ms ${EASE}`,
        }}>
          {vista === 'prefs' ? (
            <div style={{ maxHeight: '72vh', overflowY: 'auto' }}><PreferenciasNotificaciones onVolver={() => setVista('lista')} /></div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 12px 10px 16px' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Notificaciones</span>
                <span style={{ flex: 1 }} />
                <button type="button" onClick={marcarTodo} disabled={!hayNuevas} style={{ border: 0, background: 'transparent', color: hayNuevas ? (theme.accent || '#007AFF') : theme.textSubtle, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: hayNuevas ? 'pointer' : 'default', padding: '2px 4px' }}>Marcar leídas</button>
                <button type="button" onClick={() => setVista('prefs')} title="Preferencias" style={{ width: 26, height: 26, borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <Settings size={14} />
                </button>
              </div>
              <div style={{ padding: '0 16px 10px' }}>
                <Segmented size="sm" value={tab} onChange={setTab} style={{ width: '100%', display: 'flex' }}
                  options={TABS.map((t) => ({ ...t, badge: t.id === 'hoy' && contador.nuevas ? contador.nuevas : undefined }))} />
              </div>
              <div style={{ maxHeight: '64vh', overflowY: 'auto', borderTop: `1px solid ${theme.border}` }}>
                {cuerpo()}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
