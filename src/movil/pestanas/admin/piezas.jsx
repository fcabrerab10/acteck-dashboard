// Piezas propias de Administración en el celular.
//   · TriNivelM: el TriNivel de la web (Oculto · Ver · Editar) en tamaño táctil (32 px, pastilla deslizante).
//   · FilaPermiso: fila de una pestaña con su TriNivelM a la derecha.
//   · FilaToggle: fila con interruptor iOS (reusa ToggleIOS del centro de notificaciones).
//   · Atajos: "ocultar · ver · editar todo" para las 7 pestañas de un cliente.
//   · deshacer(): toast con botón Deshacer (patrón de la app móvil).
// Nada de hex fuera de theme.*; niveles y etiquetas vienen de modules/configuracion/comun.jsx.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { elevation } from '../../../lib/elevation';
import { NIVELES, NIVEL_LABEL, nivelDe } from '../../../modules/configuracion/comun';
import { ToggleIOS } from '../../../components/notificaciones/PreferenciasNotificaciones';
import { toast } from '../../piezas';

export { ToggleIOS };

/** Tri-estado táctil Oculto · Ver · Editar (32 px de alto, la pastilla se desliza en 220 ms). */
export function TriNivelM({ value, onChange, disabled = false, title }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ left: 3, width: 0 });
  const v = nivelDe(value);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-nivel="${v}"]`);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [v]);
  const colorOn = { oculto: theme.text, ver: theme.accent, edit: theme.green }[v];
  return (
    <div ref={ref} role="radiogroup" aria-disabled={disabled} title={title}
      style={{
        position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: 3, height: 32, borderRadius: 9, flexShrink: 0,
        background: dark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)', opacity: disabled ? 0.45 : 1,
      }}>
      {thumb.width > 0 && (
        <span aria-hidden style={{
          position: 'absolute', top: 3, bottom: 3, left: thumb.left, width: thumb.width, borderRadius: 7,
          background: dark ? 'rgba(99,99,102,0.9)' : theme.surface, boxShadow: elevation(theme, 'hover'),
          transition: `left ${DUR.state}ms ${EASE}, width ${DUR.state}ms ${EASE}`,
        }} />
      )}
      {NIVELES.map((n) => {
        const on = n === v;
        return (
          <button key={n} type="button" role="radio" aria-checked={on} data-nivel={n} disabled={disabled}
            onClick={(e) => { e.stopPropagation(); if (!disabled && !on) onChange?.(n); }}
            style={{
              position: 'relative', zIndex: 1, height: 26, padding: '0 10px', borderRadius: 7, border: 0, background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em',
              color: on ? colorOn : (dark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)'), whiteSpace: 'nowrap', transition: `color ${DUR.state}ms ${EASE}`,
            }}>
            {NIVEL_LABEL[n]}
          </button>
        );
      })}
    </div>
  );
}

/** Fila de permiso: etiqueta (con motivo debajo si está bloqueada) + TriNivelM. */
export function FilaPermiso({ label, desc, value, onChange, disabled, motivo }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', minHeight: 50, boxSizing: 'border-box', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: TYPO.fontText, fontSize: 14.5, fontWeight: 500, color: theme.text, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {(motivo || desc) && <span style={{ display: 'block', fontSize: 11, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{motivo || desc}</span>}
      </span>
      <TriNivelM value={value} onChange={onChange} disabled={disabled} title={motivo || desc} />
    </div>
  );
}

/** Fila con interruptor iOS. */
export function FilaToggle({ titulo, sub, on, onChange, disabled, alto = 56 }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', minHeight: alto, boxSizing: 'border-box', opacity: disabled ? 0.6 : 1 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontFamily: TYPO.fontText, fontSize: 15, fontWeight: 500, color: theme.text, letterSpacing: '-0.01em' }}>{titulo}</span>
        {sub && <span style={{ display: 'block', fontSize: 11.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35 }}>{sub}</span>}
      </span>
      <ToggleIOS on={on} label={titulo} onChange={disabled ? undefined : onChange} />
    </div>
  );
}

/** "ocultar · ver · editar todo" para un cliente. */
export function Atajos({ onTodas }) {
  const { theme } = useTheme();
  const b = (color) => ({ border: 0, background: 'transparent', color, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: 'pointer', padding: '4px 2px' });
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <button type="button" style={b(theme.textMuted)} onClick={() => onTodas('oculto')}>ocultar</button>
      <span style={{ color: theme.textSubtle || theme.textMuted }}>·</span>
      <button type="button" style={b(theme.accent)} onClick={() => onTodas('ver')}>ver</button>
      <span style={{ color: theme.textSubtle || theme.textMuted }}>·</span>
      <button type="button" style={b(theme.green)} onClick={() => onTodas('edit')}>editar</button>
    </span>
  );
}

/** Toast con "Deshacer" (devuelve el valor anterior al tocarlo). */
export function toastDeshacer(msg, deshacer) {
  toast.ok(msg, { accion: 'Deshacer', onAccion: deshacer, ms: 5000 });
}
