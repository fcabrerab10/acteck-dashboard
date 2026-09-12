// Piezas de "Actividad del equipo" en el celular.
//   · Deslizable: fila que se desliza (izquierda = acción, derecha = abrir) y REGRESA sola (no se colapsa,
//     a diferencia de FilaGesto de la Agenda, pensada para tareas que desaparecen al cerrarlas).
//   · FilaPersona: avatar · nombre y puesto · última entrada · pendientes · acciones de la semana.
//   · Avatar: perfiles.avatar_url si existe; si no, iniciales con su color estable.
import React, { useRef, useState } from 'react';
import { Bell, ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../../lib/motion';
import { relativo } from '../../../lib/format';
import { AvatarImg } from '../../../lib/avatar';
import { Pill } from '../../piezas';
import { fmtHmCorto, plural, textoInactividad, CLIENTE_LABEL } from '../../../modules/interno/equipo/textos.js';

const UMBRAL_MIN = 72;

/** Deslizar: izquierda = `onIzquierda` (fondo naranja) · derecha = `onDerecha` (fondo azul). Vuelve a su sitio. */
export function Deslizable({ children, onIzquierda, onDerecha, labelIzquierda = 'Recordar', labelDerecha = 'Abrir', iconoIzquierda: IconI = Bell, iconoDerecha: IconD = ChevronRight, style }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const st = useRef(null);
  const dxRef = useRef(0);
  const supr = useRef(false);   // hubo gesto: el click que sigue se ignora
  const [dx, setDx] = useState(0);
  const [anim, setAnim] = useState(true);
  const sinAnim = reduceMotion();
  const ponDx = (v) => { dxRef.current = v; setDx(v); };

  const onStart = (e) => { const t = e.touches[0]; st.current = { x: t.clientX, y: t.clientY, eje: null, t0: Date.now() }; setAnim(false); };
  const onMove = (e) => {
    const s = st.current; if (!s) return;
    const t = e.touches[0]; const ddx = t.clientX - s.x, ddy = t.clientY - s.y;
    if (s.eje == null) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; s.eje = Math.abs(ddx) > Math.abs(ddy) * 1.3 ? 'x' : 'y'; }
    if (s.eje !== 'x') return;
    const lim = (ref.current?.clientWidth || 360) * 0.5;
    const v = Math.abs(ddx) > lim ? Math.sign(ddx) * (lim + (Math.abs(ddx) - lim) * 0.3) : ddx;
    if ((v > 0 && !onDerecha) || (v < 0 && !onIzquierda)) { ponDx(v * 0.15); return; }
    ponDx(v);
  };
  const onEnd = () => {
    const s = st.current; st.current = null; setAnim(true);
    if (s?.eje === 'x' && Math.abs(dxRef.current) > 8) supr.current = true;   // el gesto no debe contar como toque
    if (!s || s.eje !== 'x') { ponDx(0); return; }
    const w = ref.current?.clientWidth || 360;
    const umbral = Math.max(UMBRAL_MIN, w * 0.3);
    const rapido = Date.now() - s.t0 < 260 && Math.abs(dxRef.current) > 48;
    const v = dxRef.current;
    ponDx(0);
    if (v > 0 && onDerecha && (v > umbral || rapido)) setTimeout(() => onDerecha(), sinAnim ? 0 : DUR.tap);
    else if (v < 0 && onIzquierda && (-v > umbral || rapido)) setTimeout(() => onIzquierda(), sinAnim ? 0 : DUR.tap);
  };

  const pct = Math.min(1, Math.abs(dx) / UMBRAL_MIN);
  const der = dx > 0;
  return (
    <div ref={ref} style={{ position: 'relative', overflow: 'hidden', ...style }}>
      {dx !== 0 && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, background: der ? theme.accent : theme.orange, color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: der ? 'flex-start' : 'flex-end', padding: '0 18px', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, opacity: 0.35 + pct * 0.65 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, transform: `scale(${0.82 + pct * 0.18})` }}>
            {der ? <><IconD size={17} strokeWidth={2.6} />{labelDerecha}</> : <>{labelIzquierda}<IconI size={17} strokeWidth={2.6} /></>}
          </span>
        </div>
      )}
      <div onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
        onClickCapture={(e) => { if (supr.current) { supr.current = false; e.preventDefault(); e.stopPropagation(); } }}
        style={{ position: 'relative', background: theme.surface, touchAction: 'pan-y', transform: `translateX(${dx}px)`, transition: anim ? `transform ${DUR.content}ms ${EASE}` : 'none', willChange: 'transform' }}>
        {children}
      </div>
    </div>
  );
}

/** "hoy · 9:12" · "ayer" · "hace 4 días" · "sin actividad en 28 días" */
export function ultimaEntrada(iso, hoyIso) {
  if (!iso) return 'sin actividad en 28 días';
  const d = new Date(iso);
  const dia = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  if (dia === hoyIso) return `hoy · ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
  return relativo(iso);
}

export function FilaPersona({ u, datos, hoyIso, externo = false, onAbrir, recordado }) {
  const { theme } = useTheme();
  const { tele, acc, agenda, inact } = datos || {};
  const inactTxt = externo ? null : textoInactividad(inact);
  const sub = { fontSize: 11.5, color: theme.textMuted };

  return (
    <div role="button" onClick={onAbrir} style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 12px', width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer' }}>
      <AvatarImg perfil={u} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || u.email}</span>
          {tele?.activoHoy && <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.green, flexShrink: 0 }} />}
        </div>
        <div style={{ ...sub, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {u.puesto || u.rol || (externo ? 'externo' : '—')} · {ultimaEntrada(tele?.ultimo, hoyIso)}
        </div>

        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {inactTxt && <Pill tone={inact.sinEntrar ? 'red' : 'orange'} size="xs" dot>{inactTxt}</Pill>}
          {!externo && agenda?.vencidos > 0 && <Pill tone="red" size="xs">{plural(agenda.vencidos, 'vencido', 'vencidos')}</Pill>}
          {!externo && agenda && agenda.vencidos === 0 && agenda.abiertos > 0 && <Pill tone="gray" size="xs">{plural(agenda.abiertos, 'pendiente', 'pendientes')}</Pill>}
          {externo && tele?.paginasTop?.length > 0 && <Pill tone="gray" size="xs">{tele.paginasTop.length === 1 ? 'usa 1 pantalla' : `usa ${tele.paginasTop.length} pantallas`}</Pill>}
          {externo && tele?.clienteTop && <Pill tone="blue" size="xs">{CLIENTE_LABEL[tele.clienteTop]}</Pill>}
          {recordado && <Pill tone="blue" size="xs" dot>recordado hoy</Pill>}
        </div>

        {!externo && (
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6, alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap' }}>
              {acc?.semana ? `${plural(acc.semana, 'acción', 'acciones')} · ` : 'sin acciones · '}{fmtHmCorto(tele?.minutosSemana || 0)}
            </span>
            {(acc?.principales || []).map((p) => <Pill key={p.label} tone="gray" size="xs">{p.label} · {p.n}</Pill>)}
          </div>
        )}
      </div>
      <ChevronRight size={15} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0, marginTop: 12 }} />
    </div>
  );
}
