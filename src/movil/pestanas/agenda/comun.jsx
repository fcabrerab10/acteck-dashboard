// Agenda móvil · piezas compartidas por Hoy (A), Tablero (C), Reuniones, Minuta, Clientes y Semana.
//   · FilaGesto: deslizar a la derecha = hecho · a la izquierda = posponer (touch-action: pan-y, umbral, salida animada)
//   · useLongPress: mantener presionada una tarjeta (450 ms, se cancela al mover > 10 px)
//   · TarjetaItem / TarjetaAviso / TarjetaReunion: tarjetas de tarea-punto, aviso del sistema y reunión
//   · FAB, PalomitaM, ChipM, Tag* (pills de #cliente @persona /categoría reutilizadas de la web)
// La lógica pura viene de src/modules/agenda (calculo.js · etiquetas.js · textos.js); aquí sólo hay layout táctil.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Plus, ChevronRight, Mic, MicOff } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../../lib/motion';
import { elevation } from '../../../lib/elevation';
import { Pill, toneColors } from '../../../components/kit';
import { TagCliente, TagPersona, CatPill, TONE_FUENTE } from '../../../modules/agenda/comun';
import { cuando, vencido, vecesArrastrado, ordinal, resumenReunion, isoDia, fmtHora } from '../../../modules/agenda/calculo';
import { nombreClienteAgenda } from '../../../modules/agenda/etiquetas';
import { useNav, ALTO_BARRA } from '../../nav';
import { MONO } from '../../util';

export { TagCliente, TagPersona, CatPill, TONE_FUENTE };
export const primerNombre = (s) => String(s || '').split(' ')[0];

/** Alto libre sobre la barra inferior (modo "barra") o sobre el borde (modo "cajón"). */
export function useBottomOffset(extra = 0) {
  const nav = useNav();
  return nav?.modo === 'barra' ? `calc(${ALTO_BARRA + 24 + extra}px + env(safe-area-inset-bottom))` : `calc(${16 + extra}px + env(safe-area-inset-bottom))`;
}

/** Botón flotante "+" (siempre visible, encima de la barra). */
export function FAB({ onClick, icon: Icon = Plus, label = 'Nueva tarea o punto', style }) {
  const { theme } = useTheme();
  const bottom = useBottomOffset();
  const [down, setDown] = useState(false);
  return (
    <button type="button" onClick={onClick} aria-label={label}
      onTouchStart={() => setDown(true)} onTouchEnd={() => setDown(false)} onTouchCancel={() => setDown(false)}
      style={{ position: 'fixed', right: 16, bottom, width: 52, height: 52, borderRadius: 999, border: 0, background: theme.accent, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 8px 20px ${theme.accent}59`, cursor: 'pointer', zIndex: 40, transform: down ? 'scale(0.92)' : 'scale(1)', transition: `transform ${DUR.tap}ms ${EASE}`, ...style }}>
      <Icon size={26} strokeWidth={2.4} />
    </button>
  );
}

/** Palomita táctil (22 px, área de 36). */
export function PalomitaM({ hecha, onClick, size = 22, disabled }) {
  const { theme } = useTheme();
  const green = theme.green;
  return (
    <button type="button" disabled={disabled} aria-pressed={hecha} aria-label={hecha ? 'Reabrir' : 'Marcar como hecha'}
      onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }}
      style={{ width: 36, height: 36, margin: -7, padding: 0, border: 0, background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1 }}>
      <span style={{ width: size, height: size, borderRadius: 999, border: `1.5px solid ${hecha ? green : theme.borderStrong || theme.border}`, background: hecha ? green : 'transparent', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: `background ${DUR.tap}ms ${EASE}, border-color ${DUR.tap}ms ${EASE}` }}>
        {hecha && <Check size={size - 8} strokeWidth={3} />}
      </span>
    </button>
  );
}

/** Chip de captura (confirmación de lo entendido). on = negro/inverso. */
export function ChipM({ children, on, onClick, tone, style }) {
  const { theme } = useTheme();
  const inv = theme.surfaceInverse || '#000', invTxt = theme.textOnInverse || '#F5F5F7';
  const [bg, col] = tone ? toneColors(theme, tone) : [theme.surface, theme.textMuted];
  return (
    <button type="button" onClick={onClick} style={{ border: `1px solid ${on ? inv : theme.border}`, borderRadius: 999, padding: '5px 11px', minHeight: 30, fontSize: 12, fontFamily: TYPO.fontText, fontWeight: on ? 600 : 500, background: on ? inv : bg, color: on ? invTxt : col, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap', transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`, ...style }}>
      {children}
    </button>
  );
}

/** Encabezado de sección dentro de una lista ("VENCIDAS · 2"). */
export function SeccionM({ children, n, tone, style }) {
  const { theme } = useTheme();
  const col = tone ? toneColors(theme, tone)[1] : theme.textSubtle || theme.textMuted;
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, padding: '12px 4px 6px', fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600, color: col, ...style }}>
      {children}{n != null && <span style={{ fontFamily: MONO, letterSpacing: 0, fontWeight: 500 }}>· {n}</span>}
    </div>
  );
}

// ─── Mantener presionado ───
export function useLongPress(onLong, { ms = 450, onTap } = {}) {
  const t = useRef(null); const st = useRef(null); const disparo = useRef(false);
  const limpiar = () => { if (t.current) clearTimeout(t.current); t.current = null; };
  const onTouchStart = (e) => {
    const p = e.touches?.[0] || e; st.current = { x: p.clientX, y: p.clientY }; disparo.current = false;
    limpiar(); t.current = setTimeout(() => { disparo.current = true; try { navigator.vibrate?.(12); } catch { /* sin vibración */ } onLong?.(); }, ms);
  };
  const onTouchMove = (e) => { const p = e.touches?.[0]; const s = st.current; if (!p || !s) return; if (Math.abs(p.clientX - s.x) > 10 || Math.abs(p.clientY - s.y) > 10) limpiar(); };
  const onTouchEnd = () => { limpiar(); };
  const onClick = (e) => { if (disparo.current) { e.preventDefault(); e.stopPropagation(); disparo.current = false; return; } onTap?.(e); };
  const onContextMenu = (e) => { e.preventDefault(); };
  return { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd, onClick, onContextMenu, onMouseDown: (e) => onTouchStart(e), onMouseUp: onTouchEnd, onMouseLeave: onTouchEnd };
}

// ─── Deslizar: derecha = hecho · izquierda = posponer ───
const UMBRAL_MIN = 76;
export function FilaGesto({ children, onDerecha, onIzquierda, labelDerecha = 'Hecho', labelIzquierda = 'Mañana', iconoDerecha: IconD = Check, iconoIzquierda: IconI = Clock, disabled = false, style }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(true);
  const [salida, setSalida] = useState(null); // 'der' | 'izq' → la fila se va y se colapsa
  const st = useRef(null); const dxRef = useRef(0);
  const ponDx = (v) => { dxRef.current = v; setDx(v); };
  const sinAnim = reduceMotion();

  const onStart = (e) => { if (disabled || salida) return; const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, eje: null, t0: Date.now() }; setAnim(false); };
  const onMove = (e) => {
    const s = st.current; if (!s) return;
    const t = e.touches[0]; const ddx = t.clientX - s.x, ddy = t.clientY - s.y;
    if (s.eje == null) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; s.eje = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? 'x' : 'y'; }
    if (s.eje !== 'x') return;
    const w = ref.current?.clientWidth || 360;
    const lim = w * 0.6;
    const v = Math.abs(ddx) > lim ? Math.sign(ddx) * (lim + (Math.abs(ddx) - lim) * 0.3) : ddx;
    if ((v > 0 && !onDerecha) || (v < 0 && !onIzquierda)) { ponDx(v * 0.15); return; }
    ponDx(v);
  };
  const onEnd = () => {
    const s = st.current; st.current = null; setAnim(true);
    if (!s || s.eje !== 'x') { ponDx(0); return; }
    const w = ref.current?.clientWidth || 360;
    const umbral = Math.max(UMBRAL_MIN, w * 0.32);
    const rapido = Date.now() - s.t0 < 260 && Math.abs(dxRef.current) > 48;
    const v = dxRef.current;
    if (v > 0 && onDerecha && (v > umbral || rapido)) { setSalida('der'); ponDx(w); setTimeout(() => onDerecha(), sinAnim ? 0 : DUR.exit); return; }
    if (v < 0 && onIzquierda && (-v > umbral || rapido)) { setSalida('izq'); ponDx(-w); setTimeout(() => onIzquierda(), sinAnim ? 0 : DUR.exit); return; }
    ponDx(0);
  };
  const pct = Math.min(1, Math.abs(dx) / UMBRAL_MIN);
  const der = dx > 0;
  const fondo = der ? theme.green : theme.orange;
  return (
    <div ref={ref} style={{ position: 'relative', overflow: 'hidden', borderRadius: 12, maxHeight: salida ? 0 : 400, marginBottom: salida ? 0 : 8, opacity: salida ? 0 : 1, transition: salida ? `max-height ${DUR.content}ms ${EASE} ${DUR.exit}ms, margin ${DUR.content}ms ${EASE} ${DUR.exit}ms, opacity ${DUR.exit}ms ${EASE}` : 'none', ...style }}>
      {dx !== 0 && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: fondo, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: der ? 'flex-start' : 'flex-end', padding: '0 18px', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, opacity: 0.35 + pct * 0.65 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, transform: `scale(${0.8 + pct * 0.2})` }}>
            {der ? <><IconD size={18} strokeWidth={2.6} />{labelDerecha}</> : <>{labelIzquierda}<IconI size={18} strokeWidth={2.6} /></>}
          </span>
        </div>
      )}
      <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
        style={{ position: 'relative', touchAction: 'pan-y', transform: `translateX(${dx}px)`, transition: anim ? `transform ${DUR.content}ms ${EASE}` : 'none', willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}

// ─── Tarjetas ───
const base = (theme, { late, meet, sys, hecha }) => ({
  background: sys ? (theme.mode === 'dark' ? theme.surfaceHover : 'rgba(120,120,128,0.10)') : theme.surface,
  border: `1px solid ${theme.border}`, borderLeft: late ? `3px solid ${theme.red}` : meet ? `3px solid ${theme.purple || theme.indigo}` : `1px solid ${theme.border}`,
  borderRadius: 12, padding: '10px 12px', boxShadow: sys ? 'none' : elevation(theme, 'reposo'), fontFamily: TYPO.fontText,
  display: 'flex', gap: 10, alignItems: 'flex-start', color: theme.text, opacity: hecha ? 0.55 : 1, boxSizing: 'border-box', width: '100%', textAlign: 'left',
});

/** Tarea o punto de reunión. */
export function TarjetaItem({ item, personasPorId, porId, hoy, reunion, onToggle, onAbrir, gestos, compacta = false, mostrarCliente = true, mostrarPersonas = true, style }) {
  const { theme } = useTheme();
  const hecha = item.estado === 'hecha';
  const venc = vencido(item, hoy);
  const n = vecesArrastrado(item, porId);
  const w = cuando(item.fecha_limite, hoy);
  const cuerpo = (
    <div {...(gestos || {})} onClick={gestos?.onClick || (() => onAbrir?.(item))} role="button" style={{ ...base(theme, { late: venc, hecha }), ...style }}>
      <div style={{ paddingTop: 1 }}><PalomitaM hecha={hecha} onClick={() => onToggle?.(item, !hecha)} disabled={!onToggle} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compacta ? 13 : 14, fontWeight: 500, lineHeight: 1.3, letterSpacing: '-0.005em', textDecoration: hecha ? 'line-through' : 'none', color: hecha ? theme.textMuted : theme.text, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{item.titulo}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 5, fontSize: 11, color: theme.textMuted }}>
          {item.tipo === 'punto' && <Pill tone="gray" size="xs">punto</Pill>}
          {mostrarCliente && <TagCliente clienteKey={item.cliente_key} />}
          {mostrarPersonas && (item.responsables || []).slice(0, 2).map((u) => <TagPersona key={u} persona={personasPorId?.get(u)} />)}
          <CatPill categoria={item.categoria} />
          {item.prioridad === 'alta' && !hecha && <Pill tone="red" size="xs" dot>alta</Pill>}
          {n > 0 && <Pill tone="orange" size="xs">{ordinal(n)}</Pill>}
          {reunion && <span>· {reunion.titulo}</span>}
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: venc ? theme.red : theme.textMuted, fontWeight: venc ? 600 : 400, whiteSpace: 'nowrap', paddingTop: 2 }}>
        {hecha ? '✓' : item.hora && w === 'hoy' ? String(item.hora).slice(0, 5) : w === 'sin fecha' ? '' : w}
      </span>
    </div>
  );
  return cuerpo;
}

/** Aviso del sistema (sólo lectura, acción que navega). */
export function TarjetaAviso({ aviso, hoy, onNavegar, style }) {
  const { theme } = useTheme();
  const sev = aviso.severidad === 'critica' ? 'red' : aviso.severidad === 'alta' ? 'orange' : null;
  const [bg, col] = toneColors(theme, TONE_FUENTE[aviso.fuente] || 'gray');
  return (
    <div style={{ ...base(theme, { sys: true }), ...style }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: col }} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.3, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{aviso.titulo}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 5, fontSize: 11, color: theme.textMuted }}>
          <Pill tone="gray" size="xs">{aviso.fuente}</Pill>
          <TagCliente clienteKey={aviso.cliente_key} />
          {sev && <Pill tone={sev} size="xs" dot>{aviso.severidad}</Pill>}
          {aviso.sub && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{aviso.sub}</span>}
        </div>
        {aviso.accion && onNavegar && (
          <button type="button" onClick={() => onNavegar(aviso)} style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 2, border: 0, background: 'transparent', padding: 0, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>{aviso.accion.label}<ChevronRight size={14} /></button>
        )}
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', paddingTop: 2 }}>{cuando(aviso.fecha, hoy)}</span>
    </div>
  );
}

/** Reunión / evento como tarjeta (botón Minuta o Preparar). */
export function TarjetaReunion({ reunion: r, items, porId, hoy, onMinuta, onEditar, gestos, style }) {
  const { theme } = useTheme();
  const res = useMemo(() => resumenReunion(r, items, porId), [r, items, porId]);
  const f = new Date(r.fecha);
  const esEvento = r.tipo === 'evento';
  const w = cuando(isoDia(f), hoy);
  const label = r.estado === 'cerrada' ? 'Ver minuta' : res.arrastradosAqui.length && r.estado === 'programada' ? `Preparar · ${res.arrastradosAqui.length}` : r.estado === 'en_curso' ? 'Abrir minuta' : 'Minuta';
  return (
    <div {...(gestos || {})} onClick={gestos?.onClick || (() => (esEvento ? onEditar?.(r) : onMinuta?.(r)))} role="button" style={{ ...base(theme, { meet: true }), ...style }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.3 }}>{esEvento ? 'Evento' : 'Reunión'} {nombreClienteAgenda(r.cliente_key)} · {r.titulo}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 5, fontSize: 11, color: theme.textMuted }}>
          <TagCliente clienteKey={r.cliente_key} />
          <span>{r.lugar ? `${r.lugar} · ` : ''}{w} {fmtHora(f)}</span>
          {r.estado === 'en_curso' && <Pill tone="blue" size="xs" dot>en curso</Pill>}
          {!esEvento && r.estado !== 'cerrada' && <span>· {res.abiertos.length} abierto{res.abiertos.length === 1 ? '' : 's'}</span>}
          {!esEvento && (
            <button type="button" onClick={(e) => { e.stopPropagation(); onMinuta?.(r); }} style={{ border: 0, background: theme.accentBg || 'rgba(0,122,255,0.10)', color: theme.accent, borderRadius: 999, padding: '2px 9px', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>{label}</button>
          )}
        </div>
      </div>
      <span style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', paddingTop: 2 }}>{fmtHora(f)}</span>
    </div>
  );
}

// ─── Dictado (webkitSpeechRecognition / SpeechRecognition, es-MX) ───
export const soportaDictado = () => typeof window !== 'undefined' && !!(window.SpeechRecognition || window.webkitSpeechRecognition);

/** Botón de micrófono: mientras escucha llama onTexto(parcial, final). Se oculta si el navegador no lo soporta. */
export function BotonMic({ onTexto, size = 44, onEstado, style }) {
  const { theme } = useTheme();
  const [activo, setActivo] = useState(false);
  const rec = useRef(null);
  const soporta = soportaDictado();
  useEffect(() => () => { try { rec.current?.abort(); } catch { /* nada */ } }, []);
  if (!soporta) return null;
  const parar = () => { try { rec.current?.stop(); } catch { /* nada */ } setActivo(false); onEstado?.(false); };
  const empezar = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const r = new SR(); r.lang = 'es-MX'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let final = '';
    r.onresult = (e) => { let parcial = ''; for (let i = e.resultIndex; i < e.results.length; i += 1) { const t = e.results[i][0].transcript; if (e.results[i].isFinal) final += t; else parcial += t; } onTexto?.(final + parcial, !!final && !parcial); };
    r.onerror = () => parar();
    r.onend = () => { setActivo(false); onEstado?.(false); rec.current = null; };
    rec.current = r;
    try { r.start(); setActivo(true); onEstado?.(true); } catch { setActivo(false); }
  };
  return (
    <button type="button" onClick={activo ? parar : empezar} aria-label={activo ? 'Detener dictado' : 'Dictar'} aria-pressed={activo}
      style={{ width: size, height: size, borderRadius: 999, border: 0, background: activo ? theme.red : (theme.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(120,120,128,0.14)'), color: activo ? '#FFF' : theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0, transition: `background ${DUR.state}ms ${EASE}`, animation: activo ? 'movilMicPulso 1.1s ease-in-out infinite' : 'none', ...style }}>
      {activo ? <MicOff size={Math.round(size * 0.42)} /> : <Mic size={Math.round(size * 0.42)} />}
      <style>{'@keyframes movilMicPulso{0%,100%{box-shadow:0 0 0 0 rgba(255,59,48,.45)}50%{box-shadow:0 0 0 10px rgba(255,59,48,0)}}'}</style>
    </button>
  );
}

/** Reloj de "● guardado hace N s" (re-render cada segundo). */
export function useReloj(activo = true) {
  const [, setTick] = useState(0);
  useEffect(() => { if (!activo) return undefined; const t = setInterval(() => setTick((x) => x + 1), 1000); return () => clearInterval(t); }, [activo]);
}

/** Campo de texto móvil (input/textarea) con estilo iOS. */
export function CampoM({ value, onChange, placeholder, multiline = false, inputRef, onEnter, autoFocus, type = 'text', style, ...rest }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const st = { width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: 12, padding: multiline ? '10px 12px' : '0 12px', minHeight: multiline ? 64 : 44, background: dark ? 'rgba(255,255,255,0.06)' : theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 16, outline: 'none', resize: 'none', lineHeight: 1.4, ...style };
  const onKey = (e) => { if (e.key === 'Enter' && !e.shiftKey && onEnter) { e.preventDefault(); onEnter(); } };
  return multiline
    ? <textarea ref={inputRef} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={2} onKeyDown={onKey} autoFocus={autoFocus} style={st} {...rest} />
    : <input ref={inputRef} type={type} value={value ?? ''} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} onKeyDown={onKey} autoFocus={autoFocus} style={st} {...rest} />;
}

export const lbl = (theme) => ({ fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, marginBottom: 6, display: 'block' });

/** Mías · Equipo · Todo — filtro de responsables sobre ítems. */
export function filtrarPor(items, seg, uid) {
  if (seg === 'todo') return items;
  if (seg === 'mias') return items.filter((it) => (it.responsables || []).includes(uid) || (!(it.responsables || []).length && it.creado_por === uid));
  return items.filter((it) => (it.responsables || []).length && !(it.responsables || []).includes(uid));
}

