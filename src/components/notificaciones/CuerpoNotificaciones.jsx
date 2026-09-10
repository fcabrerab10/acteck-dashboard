// CuerpoNotificaciones — el interior del centro de notificaciones sin la campana ni el
// contenedor flotante: Segmented Hoy / Semana / Silenciadas + pilas por área (inmediatas
// arriba, "Resumen programado HH:MM" abajo) con sus acciones. Lo montan CentroNotificaciones
// (popover de la campana), la pestaña Avisos del PanelAvatar y la hoja "Alertas" del modo iPhone.
//
//   const ref = useRef();  // ref.current.marcarTodo() · ref.current.hayNuevas
//   <CuerpoNotificaciones ref={ref} onNavegar={…} onCerrar={…} email? activo={true} />
//
// Props:
//   onNavegar(clienteKey, paginaId, extra) — como App.handleNavegar.
//   onCerrar()  — se llama después de navegar por una alerta (cerrar el panel que lo contiene).
//   activo      — false mientras el cuerpo no se ve (evita cargar pospuestas); default true.
//   maxAlto     — alto máximo de la lista con scroll (default '64vh').
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { DUR, reduceMotion } from '../../lib/motion';
import { Segmented } from '../kit';
import { supabase } from '../../lib/supabase';
import {
  useAlertas, useAlertasPospuestas, useNoLeidas, usePreferenciasNotif,
  resolverAlerta, posponerAlerta, marcarLeidas, ejecutarAccion, agruparPorArea, areaAlerta, aplicaCliente, esNueva,
} from '../../lib/alertas';
import Pila from './Pila';
import useContadorNotificaciones from './useContadorNotificaciones';

export const TABS = [{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'silenciadas', label: 'Silenciadas' }];

export function inicioHoyCDMX() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Mexico_City' }));
  const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return `${iso}T06:00:00.000Z`; // 00:00 CDMX (UTC-6 fijo)
}

async function emailActual(email) {
  if (email) return email;
  try { const { data } = await supabase.auth.getUser(); return data?.user?.email || 'usuario'; }
  catch { return 'usuario'; }
}

export function Vacio({ texto = 'Todo al corriente', sub }) {
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

const CuerpoNotificaciones = forwardRef(function CuerpoNotificaciones({ onNavegar, onCerrar, email, activo = true, maxAlto = '64vh', style }, ref) {
  const { theme } = useTheme();
  const [tab, setTab] = useState('hoy');
  const [saliendo, setSaliendo] = useState(() => new Set());
  const [ocultas, setOcultas] = useState(() => new Set());

  const { data: alertas = [], isLoading, isError } = useAlertas();
  const { data: pospuestas = [] } = useAlertasPospuestas({ enabled: activo && tab === 'silenciadas' });
  const { data: lecturas } = useNoLeidas();
  const { data: prefs } = usePreferenciasNotif();
  const contador = useContadorNotificaciones();

  // ─── Clasificación ───
  const hoyIso = useMemo(() => inicioHoyCDMX(), []);
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
  const ver = (a) => { marcarLeidas([a.id]).catch(() => {}); if (ejecutarAccion(a, onNavegar)) onCerrar?.(); };
  const leerPila = (p) => { const ids = p.alertas.filter((a) => esNueva(a, lecturas)).map((a) => a.id); if (ids.length) marcarLeidas(ids).catch(() => {}); };
  const hayNuevas = [...inmediatas, ...resumen].some((a) => esNueva(a, lecturas));
  const marcarTodo = useCallback(() => {
    const ids = [...inmediatas, ...resumen].filter((a) => esNueva(a, lecturas)).map((a) => a.id);
    if (ids.length) marcarLeidas(ids).catch((e) => console.error('marcarLeidas:', e));
  }, [inmediatas, resumen, lecturas]);
  useImperativeHandle(ref, () => ({ marcarTodo, hayNuevas }), [marcarTodo, hayNuevas]);

  // ─── Render ───
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
    <div style={{ fontFamily: TYPO.fontText, ...style }}>
      <div style={{ padding: '0 16px 10px' }}>
        <Segmented size="sm" value={tab} onChange={setTab} style={{ width: '100%', display: 'flex' }}
          options={TABS.map((t) => ({ ...t, badge: t.id === 'hoy' && contador.nuevas ? contador.nuevas : undefined }))} />
      </div>
      <div style={{ maxHeight: maxAlto, overflowY: 'auto', borderTop: `1px solid ${theme.border}` }}>
        {cuerpo()}
      </div>
    </div>
  );
});

export default CuerpoNotificaciones;
