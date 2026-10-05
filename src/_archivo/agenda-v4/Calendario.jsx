// Agenda V4 · calendario de ancho completo, ARRIBA de todo (decisión de Fernando, 2026-09-21).
// Mes por defecto (‹ › Hoy) con Segmented Mes · Semana — la vista Semana es la de siempre (Semana.jsx).
// Pinta: eventos de Google, reuniones, viajes/ausencias, pendientes con fecha, arribos de PO y cargas
// de datos. Arrastrar un pendiente a otro día cambia su fecha; hacer clic en un día abre el menú
// Pendiente (lo normal) · Reunión · Viaje / ausencia.
import React, { useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, ListPlus, CalendarPlus, Plane } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, toneColors, toast } from '../../components/kit';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { eventosCalendario, FUENTES_CALENDARIO, inicioSemana, sumarDias, isoDia } from './calculo';
import { actualizarItem } from './datos';
import Mes from './Mes';
import SemanaRejilla from './Semana';

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const VISTAS = [{ id: 'mes', label: 'Mes' }, { id: 'semana', label: 'Semana' }];

export default function Calendario(p) {
  const { theme } = useTheme();
  const { items, reuniones, hoy, google, rango, setRango, abrirItem, abrirMinuta, nuevaReunion, nuevoPendiente, nuevoViaje, puedeEditar, d } = p;
  const [vista, setVista] = useState('mes');
  const [ini, setIni] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const [toggles, setToggles] = useState(() => new Set(FUENTES_CALENDARIO.map((f) => f.id)));
  const [menu, setMenu] = useState(null);   // { dia, x, y }
  const ref = useRef(null);

  const datos = useMemo(() => ({ reuniones, items, google: google?.eventos || [], transito: d?.transito || [], fuentesManuales: d?.fuentesManuales || [], tracking: d?.tracking || [] }),
    [reuniones, items, google?.eventos, d?.transito, d?.fuentesManuales, d?.tracking]);

  const asegurarRango = (fecha) => {
    const a = isoDia(sumarDias(fecha, -45)), b = isoDia(sumarDias(fecha, 60));
    if (a < rango.desde || b > rango.hasta) setRango({ desde: a < rango.desde ? a : rango.desde, hasta: b > rango.hasta ? b : rango.hasta });
  };
  const mover = (delta) => {
    const n = vista === 'mes' ? new Date(ini.getFullYear(), ini.getMonth() + delta, 1) : sumarDias(ini, 7 * delta);
    setIni(vista === 'mes' ? n : inicioSemana(n));
    asegurarRango(n);
  };
  const irHoy = () => setIni(vista === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : inicioSemana(hoy));
  const cambiarVista = (v) => { setVista(v); setIni(v === 'mes' ? new Date(ini.getFullYear(), ini.getMonth(), 1) : inicioSemana(ini)); };
  const toggleF = (id) => setToggles((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const abrirEv = (ev) => {
    if (ev.fuente === 'tareas') abrirItem?.(ev.ref);
    else if ((ev.fuente === 'reuniones' || ev.fuente === 'viajes') && ev.ref?.tipo === 'reunion') abrirMinuta?.(ev.ref);
    else if (ev.fuente === 'reuniones' || ev.fuente === 'viajes') p.editarReunion?.(ev.ref);
    else if (ev.fuente === 'google' && ev.url) window.open(ev.url, '_blank', 'noopener');
  };
  const soltar = async (e, dia) => {
    const id = e.dataTransfer.getData('agenda/item'); if (!id) return;
    const it = items.find((x) => x.id === id); if (!it) return;
    const iso = isoDia(dia); if (it.fecha_limite === iso) return;
    const prev = it.fecha_limite || null;
    try {
      await actualizarItem(id, { fecha_limite: iso });
      toast.ok(`«${it.titulo.slice(0, 32)}» → ${dia.getDate()} ${MES_CORTO[dia.getMonth()]}`, { accion: 'Deshacer', onAccion: () => actualizarItem(id, { fecha_limite: prev }).catch((err) => toast.error(err.message)) });
    } catch (err) { toast.error(err.message); }
  };
  const abrirMenu = (dia, e) => {
    if (!puedeEditar) return;
    const caja = ref.current?.getBoundingClientRect();
    setMenu({ dia, x: (e?.clientX ?? 0) - (caja?.left ?? 0), y: (e?.clientY ?? 0) - (caja?.top ?? 0) });
  };
  const elegir = (accion) => {
    const dia = menu?.dia; setMenu(null);
    if (!dia) return;
    if (accion === 'pendiente') nuevoPendiente?.(isoDia(dia));
    if (accion === 'reunion') nuevaReunion?.({ fecha: dia });
    if (accion === 'viaje') nuevoViaje?.(dia);
  };

  const titulo = vista === 'mes'
    ? `${MESES[ini.getMonth()]} ${ini.getFullYear()}`
    : `${ini.getDate()} – ${sumarDias(ini, 6).getDate()} ${MES_CORTO[sumarDias(ini, 6).getMonth()]}`;
  const navBtn = (Icon, onClick, title) => (
    <button type="button" onClick={onClick} title={title}
      style={{ width: 24, height: 24, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon size={12} /></button>
  );

  return (
    <div ref={ref} style={{ position: 'relative' }} onClick={() => menu && setMenu(null)}>
      <Panel titulo="Calendario" meta={`${titulo}${google?.conectado ? ' · Google + agenda' : ' · agenda'}`} padding="0"
        acciones={<>
          <Segmented options={VISTAS} value={vista} onChange={cambiarVista} />
          {navBtn(ChevronLeft, () => mover(-1), 'Anterior')}
          <button type="button" onClick={irHoy} style={{ height: 24, padding: '0 9px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11, cursor: 'pointer' }}>Hoy</button>
          {navBtn(ChevronRight, () => mover(1), 'Siguiente')}
        </>}>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '7px 10px', borderBottom: `1px solid ${theme.border}`, alignItems: 'center' }}>
          {FUENTES_CALENDARIO.map((f) => {
            const on = toggles.has(f.id);
            const inactiva = f.id === 'google' && !google?.conectado;
            return <Pill key={f.id} tone={on && !inactiva ? f.tone : 'gray'} size="xs" dot onClick={inactiva ? google?.onConectar : () => toggleF(f.id)}
              title={inactiva ? 'Conectar Google Calendar' : (on ? 'Ocultar' : 'Mostrar')}
              style={{ cursor: 'pointer', opacity: on && !inactiva ? 1 : 0.55, border: `1px solid ${theme.border}` }}>{f.label}{inactiva ? ' · conectar' : ''}</Pill>;
          })}
          {puedeEditar && <span style={{ marginLeft: 'auto', fontSize: 10, color: theme.textMuted }}>clic en un día para crear · arrastra un pendiente a otro día</span>}
        </div>

        {vista === 'mes'
          ? <Mes ini={ini} datos={datos} toggles={toggles} hoy={hoy} onAbrir={abrirEv} onDia={puedeEditar ? abrirMenu : undefined} puedeEditar={puedeEditar} onSoltar={soltar} />
          : <SemanaRejilla {...p} ini={ini} toggles={toggles} datos={datos} onAbrir={abrirEv} onSoltar={soltar} onDia={puedeEditar ? abrirMenu : undefined} />}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '6px 10px', fontSize: 10, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}>
          {FUENTES_CALENDARIO.filter((f) => toggles.has(f.id)).map((f) => (
            <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <i style={{ width: 8, height: 8, borderRadius: 2, background: toneColors(theme, f.tone)[1], display: 'inline-block' }} />{f.label}
            </span>
          ))}
          {google?.error && <span style={{ marginLeft: 'auto', color: theme.orange }}>{google.error.message}</span>}
        </div>
      </Panel>

      {menu && (
        <div role="menu" onClick={(e) => e.stopPropagation()}
          style={{ position: 'absolute', left: Math.max(4, Math.min(menu.x, (ref.current?.clientWidth || 600) - 200)), top: menu.y + 6, zIndex: 50, minWidth: 190, background: theme.surface, border: bordeFlotante(theme), borderRadius: 10, boxShadow: elevation(theme, 'flotante'), overflow: 'hidden', fontFamily: TYPO.fontText }}>
          <div style={{ padding: '7px 11px 5px', fontSize: 10.5, color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>
            {menu.dia.getDate()} {MES_CORTO[menu.dia.getMonth()]} {menu.dia.getFullYear()}
          </div>
          {[{ id: 'pendiente', icon: ListPlus, label: 'Pendiente', sub: 'lo normal' }, { id: 'reunion', icon: CalendarPlus, label: 'Reunión', sub: 'con minuta' }, { id: 'viaje', icon: Plane, label: 'Viaje / ausencia', sub: 'varios días' }].map((o) => (
            <button key={o.id} type="button" onClick={() => elegir(o.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '8px 11px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.04)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              <o.icon size={14} style={{ color: theme.textMuted, flexShrink: 0 }} />
              <span style={{ flex: 1 }}>{o.label}</span>
              <span style={{ fontSize: 10.5, color: theme.textMuted }}>{o.sub}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
