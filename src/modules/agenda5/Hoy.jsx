// Agenda V5 · Hoy: lista del día (tiempo estimado vs real, cronómetro) + reloj del día (Google, reuniones, bloques) +
// mes completo en pequeño (Fernando: «me gusta ver el calendario de mes completo, pero en pequeño»).
import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, CalendarCheck, Link2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Panel, Boton, Pill, toast } from '../../components/kit';
import { FilaTarea, Titulo, Seccion } from './comun';
import { hoyDe, bloquesDia, conteosMes, fraseHoy, fmtMin, fmtHora, isoDia, sumarDias, siguienteDe } from './calculo';
import { nombreClienteAgenda } from '../agenda/etiquetas';
import { completarItem, cronometro, moverA, posponer, estimar, actualizarItem } from './datos';

const DIAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export function MiniMes({ mes, setMes, dia, onDia, conteos, hoyIso }) {
  const { theme } = useTheme();
  const primero = new Date(mes.getFullYear(), mes.getMonth(), 1);
  const desde = new Date(primero); desde.setDate(primero.getDate() - ((primero.getDay() + 6) % 7));
  const celdas = Array.from({ length: 42 }, (_, i) => sumarDias(desde, i));
  return (
    <div style={{ fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 700, color: theme.text }}>{MESES[mes.getMonth()]} {mes.getFullYear()}</span>
        <span style={{ display: 'flex', gap: 2 }}>
          {[-1, 1].map((d) => <button key={d} type="button" onClick={() => setMes(new Date(mes.getFullYear(), mes.getMonth() + d, 1))} style={{ border: 0, background: 'transparent', color: theme.accent, cursor: 'pointer', padding: 2, display: 'grid' }}>{d < 0 ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}</button>)}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
        {DIAS.map((d, i) => <div key={i} style={{ textAlign: 'center', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, fontWeight: 600 }}>{d}</div>)}
        {celdas.map((c) => {
          const iso = isoDia(c); const n = conteos.get(iso); const fuera = c.getMonth() !== mes.getMonth(); const sel = iso === dia; const esHoy = iso === hoyIso;
          return (
            <button key={iso} type="button" onClick={() => onDia(iso)} title={n ? `${n.tareas} pendientes · ${n.reuniones + n.google} reuniones` : ''}
              style={{ aspectRatio: '1', border: 0, borderRadius: 8, background: sel ? theme.accent : esHoy ? `${theme.accent}18` : 'transparent', color: sel ? '#fff' : fuera ? theme.textSubtle || theme.textMuted : theme.text, fontSize: 11.5, fontWeight: esHoy || sel ? 700 : 500, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 0, transition: `background ${DUR.tap}ms ${EASE}`, fontFamily: TYPO.fontDisplay }}>
              {c.getDate()}
              <span style={{ display: 'flex', gap: 2, height: 4 }}>
                {n?.tareas > 0 && <i style={{ width: 4, height: 4, borderRadius: 2, background: sel ? '#fff' : theme.accent }} />}
                {(n?.reuniones > 0 || n?.google > 0) && <i style={{ width: 4, height: 4, borderRadius: 2, background: sel ? '#fff' : (theme.purple || '#BF5AF2') }} />}
                {n?.hechas > 0 && !n?.tareas && <i style={{ width: 4, height: 4, borderRadius: 2, background: sel ? '#fff' : theme.green }} />}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
const snap = (m, paso = 15) => Math.round(m / paso) * paso;

/** Reloj del día. Edición (2026-10-05): soltar una tarea de la lista = darle hora; arrastrar un bloque = moverlo;
 *  estirar el borde inferior = cambiar la duración. Todo en pasos de 15 min. */
export function Reloj({ h, hoyIso, esHoy, onAbrir, h0 = 7, h1 = 20, alto = 420, puedeEditar = false, onSoltar }) {
  const { theme } = useTheme();
  const [ahora, setAhora] = useState(() => new Date());
  const [fantasma, setFantasma] = useState(null);   // minuto donde caería lo que se arrastra
  const [edit, setEdit] = useState(null);           // { id, modo: 'mover'|'estirar', ini, fin, y0, ini0, fin0 }
  const refCaja = React.useRef(null);
  useEffect(() => { const t = setInterval(() => setAhora(new Date()), 60000); return () => clearInterval(t); }, []);
  const bloques = useMemo(() => bloquesDia(h, { hoyIso }), [h, hoyIso]);
  const per = alto / (h1 - h0);
  const y = (m) => ((m - h0 * 60) / 60) * per;
  const nowMin = ahora.getHours() * 60 + ahora.getMinutes();
  const minDeY = (clientY) => { const r = refCaja.current?.getBoundingClientRect(); if (!r) return null; const m = h0 * 60 + ((clientY - r.top) / per) * 60; return Math.max(h0 * 60, Math.min(h1 * 60, snap(m))); };
  const onDragOver = (e) => { if (!puedeEditar || !onSoltar) return; e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setFantasma(minDeY(e.clientY)); };
  const onDrop = (e) => { if (!puedeEditar || !onSoltar) return; e.preventDefault(); const id = e.dataTransfer.getData('agenda/item'); const m = minDeY(e.clientY); setFantasma(null); if (id && m != null) onSoltar(id, hhmm(m)); };
  // Mover / estirar con el puntero (bloques de tareas; los eventos de Google y reuniones no se editan aquí)
  const empezar = (e, b, modo) => { if (!puedeEditar || b.tipo === 'google' || b.tipo === 'reunion') return; e.preventDefault(); e.stopPropagation(); setEdit({ id: b.id, modo, ini: b.ini, fin: b.fin, y0: e.clientY, ini0: b.ini, fin0: b.fin, ref: b.ref, moved: false }); };
  useEffect(() => {
    if (!edit) return undefined;
    const mv = (e) => { const d = snap(((e.clientY - edit.y0) / per) * 60); setEdit((x) => x && ({ ...x, moved: x.moved || Math.abs(e.clientY - x.y0) > 3, ini: x.modo === 'mover' ? Math.max(h0 * 60, Math.min(h1 * 60 - (x.fin0 - x.ini0), x.ini0 + d)) : x.ini0, fin: x.modo === 'mover' ? Math.max(h0 * 60, Math.min(h1 * 60 - (x.fin0 - x.ini0), x.ini0 + d)) + (x.fin0 - x.ini0) : Math.max(x.ini0 + 15, Math.min(h1 * 60, x.fin0 + d)) })); };
    const up = () => { setEdit((x) => { if (x && x.moved) { const cambios = x.modo === 'mover' ? { hora: hhmm(x.ini) } : { duracion_min: x.fin - x.ini }; actualizarItem(x.ref.id, cambios).catch(() => {}); } return null; }); };
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up);
    return () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); };
  }, [edit?.id, edit?.modo]); // eslint-disable-line react-hooks/exhaustive-deps
  const col = { google: [theme.purple || '#BF5AF2', 'rgba(191,90,242,0.16)'], reunion: [theme.purple || '#BF5AF2', 'rgba(191,90,242,0.16)'], tarea: [theme.accent, `${theme.accent}22`], hecha: [theme.green, 'rgba(48,209,88,0.16)'] };
  return (
    <div ref={refCaja} onDragOver={onDragOver} onDragLeave={() => setFantasma(null)} onDrop={onDrop} style={{ position: 'relative', height: alto, overflow: 'hidden', borderRadius: 12, background: theme.surface2 || theme.surfaceHover || 'rgba(120,120,128,0.06)', outline: fantasma != null ? `2px dashed ${theme.accent}` : 'none', userSelect: edit ? 'none' : 'auto' }}>
      {Array.from({ length: h1 - h0 + 1 }, (_, i) => h0 + i).map((hh) => <div key={hh} style={{ position: 'absolute', left: 0, right: 0, top: y(hh * 60), borderTop: `1px solid ${theme.border}`, fontSize: 10, color: theme.textSubtle || theme.textMuted }}><span style={{ position: 'absolute', left: 10, top: -7, fontFamily: TYPO.fontDisplay }}>{String(hh).padStart(2, '0')}:00</span></div>)}
      {fantasma != null && <div style={{ position: 'absolute', left: 52, right: 10, top: y(fantasma), height: 2, background: theme.accent, zIndex: 3 }}><span style={{ position: 'absolute', left: 0, top: -16, fontSize: 10.5, fontWeight: 700, color: theme.accent, fontFamily: TYPO.fontDisplay }}>{hhmm(fantasma)}</span></div>}
      {bloques.map((b0) => { const b = edit && edit.id === b0.id ? { ...b0, ini: edit.ini, fin: edit.fin } : b0; const [c, bg] = col[b.tipo] || col.tarea; const top = Math.max(0, y(b.ini)); const hgt = Math.max(18, y(b.fin) - y(b.ini) - 3); const editable = puedeEditar && b.tipo !== 'google' && b.tipo !== 'reunion'; return (
        <div key={b.id} onClick={() => { if (!edit?.moved) onAbrir?.(b); }} onPointerDown={editable ? (e) => empezar(e, b, 'mover') : undefined} title={`${b.titulo} · ${hhmm(b.ini)}${editable ? ' · arrastra para mover, estira abajo para la duración' : ''}`}
          style={{ position: 'absolute', left: 52, right: 10, top, height: hgt, borderRadius: 8, padding: '3px 9px', background: bg, color: c, borderLeft: `3px solid ${c}`, fontSize: 11.5, fontWeight: 600, overflow: 'hidden', cursor: editable ? 'grab' : 'pointer', transition: edit?.id === b.id ? 'none' : `transform ${DUR.tap}ms ${EASE}, top ${DUR.state}ms ${EASE}, height ${DUR.state}ms ${EASE}`, boxShadow: edit?.id === b.id ? '0 8px 24px rgba(0,0,0,0.18)' : 'none', zIndex: edit?.id === b.id ? 4 : 1 }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateX(2px)'; }} onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
          {b.tipo === 'google' && <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, marginRight: 5, verticalAlign: -1, background: 'conic-gradient(#4285F4 0 25%,#34A853 0 50%,#FBBC05 0 75%,#EA4335 0)' }} />}{b.titulo}
          {hgt > 30 && <div style={{ fontWeight: 400, opacity: 0.8, fontSize: 10.5 }}>{hhmm(b.ini)} – {hhmm(b.fin)}{b.tipo === 'google' ? ' · Google' : ''}{edit?.id === b.id && edit.modo === 'estirar' ? ` · ${b.fin - b.ini} min` : ''}</div>}
          {editable && <div onPointerDown={(e) => empezar(e, b, 'estirar')} title="Estirar" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, cursor: 'ns-resize' }} />}
        </div>); })}
      {esHoy && nowMin >= h0 * 60 && nowMin <= h1 * 60 && <div style={{ position: 'absolute', left: 44, right: 0, top: y(nowMin), borderTop: `2px solid ${theme.red}`, zIndex: 2 }}><i style={{ position: 'absolute', left: -5, top: -5, width: 8, height: 8, borderRadius: 4, background: theme.red }} /></div>}
      {!bloques.length && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', fontSize: 12, color: theme.textMuted }}>Sin bloques: ponle hora a una tarea para verla aquí.</div>}
    </div>
  );
}

/** «Ahora» (3.71.0): la Agenda dirige. Qué está en curso o qué toca ya, qué sigue y cuánto hay en la cola. */
export function Ahora({ h, hoyIso, puedeEditar, onAbrirItem, onAbrirReunion, onToggle, onCrono, compacta = false }) {
  const { theme } = useTheme();
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), 60000); return () => clearInterval(t); }, []);
  const s = useMemo(() => siguienteDe(h, new Date(), { hoyIso }), [h, hoyIso, tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  const abrirBloque = (b) => { if (!b) return; if (b.tipo === 'tarea') onAbrirItem?.(b.ref); else if (b.tipo === 'reunion') onAbrirReunion?.(b.ref); else if (b.ref?.url) window.open(b.ref.url, '_blank', 'noopener'); };
  const siguienteTarea = s.cola.find((it) => !(s.actual && s.actual.tipo === 'tarea' && s.actual.ref.id === it.id)) || null;
  const nada = !s.actual && !s.proximo && !s.cola.length;
  const nombreBloque = (b) => (b.tipo === 'reunion' ? `Reunión · ${b.titulo}` : b.titulo);
  const cli = (k) => (k && k !== 'interno' ? nombreClienteAgenda(k) : null);
  return (
    <div style={{ background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.bg, borderRadius: 14, padding: compacta ? '12px 14px' : '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.6 }}>{s.actual ? 'Ahora' : 'Lo que toca'}</span>
        {s.vencidos > 0 && <span style={{ fontSize: 11.5, fontWeight: 600, color: '#FF453A' }}>{s.vencidos} vencido{s.vencidos === 1 ? '' : 's'}</span>}
      </div>
      {nada ? <div style={{ fontSize: 14.5, fontWeight: 500 }}>Nada pendiente ahora. {h.hechasHoy.length ? `Llevas ${h.hechasHoy.length} hecha${h.hechasHoy.length === 1 ? '' : 's'}.` : 'Captura o jala algo de la Bandeja.'}</div> : (
        <>
          {s.actual ? (
            <div onClick={() => abrirBloque(s.actual)} style={{ cursor: 'pointer' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: compacta ? 17 : 19, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{nombreBloque(s.actual)}</div>
              <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 2 }}>hasta las {hhmm(s.actual.fin)}{cli(s.actual.ref?.cliente_key) ? ` · ${cli(s.actual.ref.cliente_key)}` : ''}</div>
            </div>
          ) : siguienteTarea ? (
            <div onClick={() => onAbrirItem?.(siguienteTarea)} style={{ cursor: 'pointer' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: compacta ? 17 : 19, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{siguienteTarea.titulo}</div>
              <div style={{ fontSize: 12.5, opacity: 0.7, marginTop: 2 }}>{[siguienteTarea.hora ? `a las ${siguienteTarea.hora}` : null, siguienteTarea.duracion_min ? fmtMin(siguienteTarea.duracion_min) : null, cli(siguienteTarea.cliente_key), h.deAyer.some((x) => x.id === siguienteTarea.id) ? 'venía de días anteriores' : null].filter(Boolean).join(' · ') || 'sin hora ni estimado'}</div>
            </div>
          ) : (
            <div onClick={() => abrirBloque(s.proximo)} style={{ cursor: 'pointer' }}><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700 }}>{nombreBloque(s.proximo)}</div><div style={{ fontSize: 12.5, opacity: 0.7 }}>a las {hhmm(s.proximo.ini)}</div></div>
          )}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {puedeEditar && !s.actual && siguienteTarea && <>
              <BotonInv onClick={() => onCrono?.(siguienteTarea, siguienteTarea.inicio_real ? 'parar' : 'iniciar')}>{siguienteTarea.inicio_real ? 'Parar' : 'Empezar'}</BotonInv>
              <BotonInv onClick={() => onToggle?.(siguienteTarea, true)}>Hecha</BotonInv>
            </>}
            {puedeEditar && s.actual?.tipo === 'tarea' && <>
              <BotonInv onClick={() => onCrono?.(s.actual.ref, s.actual.ref.inicio_real ? 'parar' : 'iniciar')}>{s.actual.ref.inicio_real ? 'Parar' : 'Empezar'}</BotonInv>
              <BotonInv onClick={() => onToggle?.(s.actual.ref, true)}>Hecha</BotonInv>
            </>}
            <span style={{ fontSize: 12, opacity: 0.7, marginLeft: 'auto' }}>
              {s.proximo && s.actual ? `Luego: ${s.proximo.titulo} a las ${hhmm(s.proximo.ini)}` : s.proximo && siguienteTarea ? `Después: ${s.proximo.titulo} ${hhmm(s.proximo.ini)}${s.minutosLibres != null ? ` · ${fmtMin(s.minutosLibres)} libres` : ''}` : s.cola.length > 1 ? `${s.cola.length - 1} más en la cola` : s.cola.length === 1 && siguienteTarea ? 'Es lo último del día' : ''}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
function BotonInv({ children, onClick }) {
  const { theme } = useTheme();
  return <button type="button" onClick={(e) => { e.stopPropagation(); onClick?.(); }} style={{ border: 0, borderRadius: 999, padding: '6px 12px', background: `${theme.bg}26`, color: 'inherit', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>{children}</button>;
}

export default function Hoy({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar, onAbrirReunion }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const [dia, setDia] = useState(hoyIso);
  const [mes, setMes] = useState(() => new Date(hoy.getFullYear(), hoy.getMonth(), 1));
  const fecha = useMemo(() => new Date(`${dia}T12:00:00`), [dia]);
  const esHoy = dia === hoyIso;
  const h = useMemo(() => hoyDe(d.items, propietario, fecha, { reuniones: d.reuniones, google: d.google, ahora: esHoy ? new Date() : new Date(`${dia}T09:00:00`) }), [d.items, d.reuniones, d.google, propietario, fecha, esHoy, dia]);
  const conteos = useMemo(() => conteosMes(d.items, propietario, { reuniones: d.reuniones, google: d.google }), [d.items, d.reuniones, d.google, propietario]);
  const toggle = (it, hecha) => completarItem(it, hecha).catch((e) => toast.error(e.message));
  const crono = (it, acc) => cronometro(it, acc).catch((e) => toast.error(e.message));
  const titulo = esHoy ? 'Hoy' : `${DIAS_LARGO[fecha.getDay()][0].toUpperCase()}${DIAS_LARGO[fecha.getDay()].slice(1)} ${fecha.getDate()}`;
  const frase = esHoy ? fraseHoy(h) : `${h.deHoy.length} pendiente${h.deHoy.length === 1 ? '' : 's'} · ${h.reunionesHoy.length + h.googleHoy.length} reunión(es)`;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Titulo meta={frase} acciones={<div style={{ display: 'flex', gap: 8 }}>{!esHoy && <Boton onClick={() => { setDia(hoyIso); setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1)); }}>Volver a hoy</Boton>}{puedeEditar && <Boton primario icon={CalendarCheck} onClick={onCapturar}>Capturar (N)</Boton>}</div>}>{titulo}{esHoy ? <span style={{ fontWeight: 500, color: theme.textMuted, fontSize: 14 }}> · {DIAS_LARGO[hoy.getDay()]} {hoy.getDate()} de {MESES[hoy.getMonth()].toLowerCase()}</span> : null}</Titulo>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.15fr) minmax(0, 1fr) 250px', gap: 12, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {esHoy && <div style={{ marginBottom: 10 }}><Ahora h={h} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrirItem={onAbrirItem} onAbrirReunion={onAbrirReunion} onToggle={toggle} onCrono={crono} /></div>}
          {h.deAyer.length > 0 && esHoy && (<>
            <Seccion meta={`${h.deAyer.length}`}>De días anteriores</Seccion>
            {h.deAyer.map((it) => <div key={it.id} draggable={puedeEditar} onDragStart={(e) => { e.dataTransfer.setData('agenda/item', it.id); }}><FilaTarea item={it} personasPorId={personasPorId} uid={uid} onToggle={toggle} onAbrir={onAbrirItem} mostrarFecha
              extra={puedeEditar && <span style={{ display: 'flex', gap: 4 }}><Pill size="xs" tone="blue" onClick={(e) => { e.stopPropagation(); moverA(it, hoyIso); }} style={{ cursor: 'pointer' }}>Hoy</Pill><Pill size="xs" tone="gray" onClick={(e) => { e.stopPropagation(); moverA(it, isoDia(sumarDias(hoy, 1))); }} style={{ cursor: 'pointer' }}>Mañana</Pill><Pill size="xs" tone="gray" onClick={(e) => { e.stopPropagation(); posponer(it, 14); }} style={{ cursor: 'pointer' }}>Algún día</Pill></span>} /></div>)}
          </>)}
          <Seccion meta={h.minTareas ? `${fmtMin(h.minTareas)} planeadas${h.minReales ? ` · ${fmtMin(h.minReales)} reales` : ''}` : h.deHoy.length ? `${h.sinEstimado} sin estimar` : ''}>Pendientes del día</Seccion>
          {h.deHoy.length === 0 && <div style={{ padding: '18px 10px', fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>Nada planeado{esHoy ? ' para hoy' : ''}. {puedeEditar ? 'Captura con N o jala algo de la Bandeja.' : ''}</div>}
          {h.deHoy.map((it) => <div key={it.id} draggable={puedeEditar} onDragStart={(e) => { e.dataTransfer.setData('agenda/item', it.id); e.dataTransfer.effectAllowed = 'move'; }} title={puedeEditar ? 'Arrastra al reloj para darle hora' : ''}><FilaTarea item={it} personasPorId={personasPorId} uid={uid} onToggle={toggle} onAbrir={onAbrirItem} onCrono={puedeEditar ? crono : null}
            extra={puedeEditar && !it.duracion_min && <span style={{ display: 'flex', gap: 3 }} title="Estimar">{[15, 30, 60].map((m) => <Pill key={m} size="xs" tone="gray" onClick={(e) => { e.stopPropagation(); estimar(it, m); }} style={{ cursor: 'pointer' }}>{m}m</Pill>)}</span>} /></div>)}
          {h.hechasHoy.length > 0 && (<>
            <Seccion meta={h.minReales ? fmtMin(h.minReales) : ''}>Hechas {esHoy ? 'hoy' : 'ese día'}</Seccion>
            {h.hechasHoy.map((it) => <FilaTarea key={it.id} item={it} personasPorId={personasPorId} uid={uid} onToggle={toggle} onAbrir={onAbrirItem} compacta />)}
          </>)}
        </div>
        <Panel titulo="Reloj del día" meta={`${h.googleHoy.length + h.reunionesHoy.length} reunión(es) · ${esHoy && h.minTareas ? `cierras ${fmtHora(h.cierre)}` : ''}`} padding="8px"
          acciones={d.googleEstado?.conectado ? <Pill size="xs" tone="green" title={d.googleEstado.email || ''}>Google</Pill> : <Boton size="sm" icon={Link2} onClick={() => d.googleEstado?.conectar?.().catch((e) => toast.error(e.message))}>Conectar Google</Boton>}>
          <Reloj h={h} hoyIso={dia} esHoy={esHoy} puedeEditar={puedeEditar} onSoltar={(id, hora) => actualizarItem(id, { hora, cuando: dia, bandeja: false }).then(() => toast.ok(`Bloque a las ${hora}`)).catch((e) => toast.error(e.message))} onAbrir={(b) => { if (b.tipo === 'tarea' || b.tipo === 'hecha') onAbrirItem?.(b.ref); else if (b.tipo === 'reunion') onAbrirReunion?.(b.ref); else if (b.ref?.url) window.open(b.ref.url, '_blank', 'noopener'); }} />
        </Panel>
        <Panel titulo="" padding="10px 12px">
          <MiniMes mes={mes} setMes={setMes} dia={dia} onDia={setDia} conteos={conteos} hoyIso={hoyIso} />
          <div style={{ marginTop: 10, borderTop: `1px solid ${theme.border}`, paddingTop: 8, fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
            <span style={{ color: theme.accent }}>●</span> pendientes &nbsp;<span style={{ color: theme.purple || '#BF5AF2' }}>●</span> reuniones &nbsp;<span style={{ color: theme.green }}>●</span> hechas
          </div>
        </Panel>
      </div>
    </div>
  );
}
