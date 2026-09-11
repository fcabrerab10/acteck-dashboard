// Agenda · calendario: Panel con Segmented Semana · Mes, fuentes con toggle (Google, reuniones, tareas, arribos,
// cargas, cotizaciones), ‹ Hoy ›. En Semana se puede arrastrar una tarea a otro día (cambia fecha_limite) y
// crear reunión/evento desde un día (clic en el encabezado o en un hueco).
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, toneColors, toast, EASE, DUR } from '../../components/kit';
import { eventosCalendario, FUENTES_CALENDARIO, inicioSemana, sumarDias, isoDia, fmtHora } from './calculo';
import { actualizarItem } from './datos';
import Mes from './Mes';
import { EnlaceExterno } from './comun';

const DIAS = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const TONE = Object.fromEntries(FUENTES_CALENDARIO.map((f) => [f.id, f.tone]));

export default function Semana({ d, items, reuniones, hoy, google, rango, setRango, abrirItem, abrirMinuta, nuevaReunion, puedeEditar, compacta = false, style }) {
  const { theme } = useTheme();
  const [vista, setVista] = useState('semana');
  const [ini, setIni] = useState(() => inicioSemana(hoy));
  const [toggles, setToggles] = useState(() => new Set(FUENTES_CALENDARIO.map((f) => f.id)));
  const [finDeSemana, setFinDeSemana] = useState(false);
  const [dragOver, setDragOver] = useState(null);
  const nDias = finDeSemana ? 7 : 5;
  const dias = useMemo(() => Array.from({ length: nDias }, (_, i) => sumarDias(ini, i)), [ini, nDias]);

  const datos = useMemo(() => ({ reuniones, items, google: google?.eventos || [], transito: d.transito, fuentesManuales: d.fuentesManuales, tracking: d.tracking }), [reuniones, items, google?.eventos, d.transito, d.fuentesManuales, d.tracking]);
  const desdeIso = isoDia(ini), hastaIso = isoDia(sumarDias(ini, 6));
  const eventos = useMemo(() => eventosCalendario(datos, desdeIso, hastaIso, toggles), [datos, desdeIso, hastaIso, toggles]);

  const mover = (delta) => {
    const n = vista === 'mes' ? new Date(ini.getFullYear(), ini.getMonth() + delta, 1) : sumarDias(ini, 7 * delta);
    setIni(vista === 'mes' ? n : inicioSemana(n));
    asegurarRango(n);
  };
  const asegurarRango = (fecha) => {
    const a = isoDia(sumarDias(fecha, -45)), b = isoDia(sumarDias(fecha, 60));
    if (a < rango.desde || b > rango.hasta) setRango({ desde: a < rango.desde ? a : rango.desde, hasta: b > rango.hasta ? b : rango.hasta });
  };
  const irHoy = () => { setIni(vista === 'mes' ? new Date(hoy.getFullYear(), hoy.getMonth(), 1) : inicioSemana(hoy)); };
  const cambiarVista = (v) => { setVista(v); setIni(v === 'mes' ? new Date(ini.getFullYear(), ini.getMonth(), 1) : inicioSemana(ini < hoy && sumarDias(ini, 31) > hoy ? hoy : ini)); };
  const toggleF = (id) => setToggles((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const onDrop = async (e, dia) => {
    e.preventDefault(); setDragOver(null);
    const id = e.dataTransfer.getData('agenda/item'); if (!id) return;
    const it = items.find((x) => x.id === id); if (!it) return;
    const iso = isoDia(dia); if (it.fecha_limite === iso) return;
    try { await actualizarItem(id, { fecha_limite: iso }); toast.ok(`«${it.titulo.slice(0, 32)}» → ${dia.getDate()} ${MESES[dia.getMonth()]}`); } catch (err) { toast.error(err.message); }
  };
  const abrirEv = (ev) => {
    if (ev.fuente === 'tareas') abrirItem?.(ev.ref);
    else if (ev.fuente === 'reuniones' && ev.ref.tipo === 'reunion') abrirMinuta?.(ev.ref);
    else if (ev.fuente === 'google' && ev.url) window.open(ev.url, '_blank', 'noopener');
  };
  const titulo = vista === 'mes' ? `${['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][ini.getMonth()]} ${ini.getFullYear()}` : `${ini.getDate()} – ${sumarDias(ini, nDias - 1).getDate()} ${MESES[sumarDias(ini, nDias - 1).getMonth()]}`;
  const navBtn = (Icon, onClick, title) => <button type="button" onClick={onClick} title={title} style={{ width: 24, height: 24, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0 }}><Icon size={12} /></button>;

  return (
    <Panel titulo={vista === 'mes' ? 'Mes' : 'Semana'} meta={`${titulo}${google?.conectado ? ' · Google + agenda' : ' · agenda'}`} padding="0" style={style}
      acciones={<>
        <Segmented options={[{ id: 'semana', label: 'Semana' }, { id: 'mes', label: 'Mes' }]} value={vista} onChange={cambiarVista} />
        {navBtn(ChevronLeft, () => mover(-1), 'Anterior')}
        <button type="button" onClick={irHoy} style={{ height: 24, padding: '0 9px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11, cursor: 'pointer' }}>Hoy</button>
        {navBtn(ChevronRight, () => mover(1), 'Siguiente')}
      </>}>
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '7px 10px', borderBottom: `1px solid ${theme.border}`, alignItems: 'center' }}>
        {FUENTES_CALENDARIO.map((f) => {
          const on = toggles.has(f.id);
          const inactiva = f.id === 'google' && !google?.conectado;
          return <Pill key={f.id} tone={on && !inactiva ? f.tone : 'gray'} size="xs" dot onClick={inactiva ? google?.onConectar : () => toggleF(f.id)} title={inactiva ? 'Conectar Google Calendar' : (on ? 'Ocultar' : 'Mostrar')} style={{ cursor: 'pointer', opacity: on && !inactiva ? 1 : 0.55, border: `1px solid ${theme.border}` }}>{f.label}{inactiva ? ' · conectar' : ''}</Pill>;
        })}
        {vista === 'semana' && <Pill tone="gray" size="xs" onClick={() => setFinDeSemana((v) => !v)} style={{ cursor: 'pointer', marginLeft: 'auto', border: `1px solid ${theme.border}` }}>{finDeSemana ? 'L–D' : 'L–V'}</Pill>}
        {google?.error && <span style={{ fontSize: 10, color: theme.orange }}>{google.error.message}</span>}
      </div>
      {vista === 'mes' ? (
        <Mes ini={ini} datos={datos} toggles={toggles} hoy={hoy} onAbrir={abrirEv} onDia={puedeEditar ? (dia) => nuevaReunion?.({ fecha: dia }) : undefined} />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${nDias}, minmax(0, 1fr))`, borderTop: 0 }}>
          {dias.map((dia) => {
            const iso = isoDia(dia); const esHoy = iso === isoDia(hoy);
            const evs = eventos.get(iso) || [];
            return (
              <div key={iso} onDragOver={(e) => { e.preventDefault(); setDragOver(iso); }} onDragLeave={() => setDragOver(null)} onDrop={(e) => onDrop(e, dia)}
                style={{ borderRight: `1px solid ${theme.border}`, minHeight: compacta ? 150 : 220, background: dragOver === iso ? (theme.accentBg || 'rgba(0,122,255,0.08)') : esHoy ? (theme.mode === 'dark' ? 'rgba(10,132,255,0.06)' : 'rgba(0,122,255,0.04)') : 'transparent', transition: `background ${DUR.state}ms ${EASE}`, display: 'flex', flexDirection: 'column' }}>
                <div onClick={puedeEditar ? () => nuevaReunion?.({ fecha: dia }) : undefined} title={puedeEditar ? 'Crear reunión o evento este día' : undefined} style={{ padding: '6px 6px 4px', borderBottom: `1px solid ${theme.border}`, textAlign: 'center', cursor: puedeEditar ? 'pointer' : 'default' }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted }}>{DIAS[(dia.getDay() + 6) % 7]}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: esHoy ? theme.accent : theme.text }}>{dia.getDate()}</div>
                </div>
                <div style={{ padding: 3, display: 'flex', flexDirection: 'column', gap: 3, flex: 1 }}>
                  {evs.map((ev) => <Evento key={ev.id} ev={ev} theme={theme} onClick={() => abrirEv(ev)} arrastrable={puedeEditar && ev.fuente === 'tareas'} compacta={compacta} />)}
                  {puedeEditar && !evs.length && <div onClick={() => nuevaReunion?.({ fecha: dia })} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textSubtle || theme.textMuted, cursor: 'pointer', opacity: 0.5 }} title="Crear reunión o evento"><Plus size={12} /></div>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '6px 10px', fontSize: 10, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}>
        {FUENTES_CALENDARIO.filter((f) => toggles.has(f.id)).map((f) => <span key={f.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><i style={{ width: 8, height: 8, borderRadius: 2, background: toneColors(theme, f.tone)[1], display: 'inline-block' }} />{f.label}</span>)}
        {vista === 'semana' && puedeEditar && <span style={{ marginLeft: 'auto' }}>arrastra una tarea a otro día · clic en un día crea reunión</span>}
      </div>
    </Panel>
  );
}

export function Evento({ ev, theme, onClick, arrastrable, compacta }) {
  const [bg, col] = toneColors(theme, TONE[ev.fuente] || 'gray');
  return (
    <div draggable={arrastrable} onDragStart={arrastrable ? (e) => { e.dataTransfer.setData('agenda/item', ev.ref.id); e.dataTransfer.effectAllowed = 'move'; } : undefined} onClick={onClick} title={`${ev.titulo}${ev.hora ? ` · ${ev.hora}` : ''}`}
      style={{ borderRadius: 6, padding: '2px 6px', background: bg, color: col, borderLeft: `3px solid ${col}`, fontSize: compacta ? 9.5 : 10.5, fontWeight: 600, lineHeight: 1.3, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', cursor: arrastrable ? 'grab' : 'pointer', fontFamily: TYPO.fontText }}>
      {ev.hora && <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', marginRight: 4, fontWeight: 500 }}>{ev.hora}</span>}{ev.titulo}
      {ev.fuente === 'google' && ev.url && <span style={{ marginLeft: 4 }}><EnlaceExterno href={ev.url}>Google</EnlaceExterno></span>}
    </div>
  );
}
