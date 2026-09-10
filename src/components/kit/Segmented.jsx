// Segmented control iOS · pastilla que se desliza 220 ms.
// options: [{ id, label, badge?, disabled?, title? }] · value · onChange(id).
import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation } from '../../lib/elevation';

export default function Segmented({ options, value, onChange, size = 'sm', style }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ left: 2, width: 0 });
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-seg-id="${CSS.escape(String(value))}"]`);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [value, options]);
  const h = size === 'md' ? 34 : 30;
  return (
    <div ref={ref} role="tablist" style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2,
      background: dark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)', borderRadius: 9, height: h, ...style,
    }}>
      {thumb.width > 0 && (
        <span aria-hidden style={{
          position: 'absolute', top: 2, bottom: 2, left: thumb.left, width: thumb.width, borderRadius: 7,
          background: dark ? 'rgba(99,99,102,0.9)' : '#FFFFFF',
          boxShadow: elevation(theme, 'hover'),
          transition: `left ${DUR.state}ms ${EASE}, width ${DUR.state}ms ${EASE}`,
        }} />
      )}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button key={o.id} data-seg-id={o.id} role="tab" aria-selected={on} disabled={o.disabled} title={o.title}
            onClick={() => !o.disabled && onChange?.(o.id)}
            style={{
              position: 'relative', zIndex: 1, padding: size === 'md' ? '5px 14px' : '4px 12px', borderRadius: 7, border: 0, background: 'transparent',
              cursor: o.disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
              color: on ? theme.text : o.disabled ? (theme.textSubtle || theme.textMuted) : (dark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)'),
              fontFamily: TYPO.fontDisplay, fontSize: size === 'md' ? 12.5 : 12, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em',
              whiteSpace: 'nowrap', transition: `color ${DUR.state}ms ${EASE}`,
            }}>
            {o.label}
            {o.badge != null && <span style={{ fontSize: 9.5, padding: '0 6px', borderRadius: 999, background: dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)', color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{o.badge}</span>}
          </button>
        );
      })}
    </div>
  );
}
