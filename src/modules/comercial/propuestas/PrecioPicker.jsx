// PrecioPicker — chip de precio con popover de listas (v_estrategia_precios_lista) + precio personalizado.
// r = fila del catálogo ({ precios: { lista → precio } }) · val = { listaSel, precio } · onChange(patch)
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, elevation, bordeFlotante, EASE, DUR } from '../../../components/kit';
import { money } from '../../../lib/format';
import { listaColor, listaShort } from './constantes';

const fmtPx = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PrecioPicker({ r, val, onChange }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [customEditing, setCustomEditing] = useState(false);
  const wrapRef = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const listasKeys = Object.keys(r.precios || {});
  const listaActiva = val.listaSel === '__custom' ? '__custom' : (val.listaSel && listasKeys.includes(val.listaSel) ? val.listaSel : listasKeys[0]);
  const esCustom = listaActiva === '__custom';
  const chipColor = esCustom ? (theme.orange || '#FF9500') : listaColor(listaActiva);
  const elegir = (k) => {
    if (k === '__custom') { onChange({ listaSel: '__custom' }); setCustomEditing(true); setOpen(false); return; }
    onChange({ listaSel: k, precio: r.precios[k] || 0 });
    setOpen(false); setCustomEditing(false);
  };
  const item = (k, label, precio, activo, color) => (
    <div key={k} onClick={() => elegir(k)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 11.5, background: activo ? `${theme.accent || '#007AFF'}18` : 'transparent', color: theme.text, transition: `background ${DUR.state}ms ${EASE}` }}
      onMouseEnter={(e) => { if (!activo) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
      onMouseLeave={(e) => { if (!activo) e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}><span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />{label}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{precio}{activo ? ' ✓' : ''}</span>
    </div>
  );
  return (
    <div ref={wrapRef} style={{ position: 'relative', display: 'inline-block' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <button type="button" onClick={() => setOpen((o) => !o)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 7px 0 8px', borderRadius: 7, background: theme.surfaceHover || 'rgba(0,0,0,0.03)', border: `1px solid ${open ? (theme.accent || '#007AFF') : theme.border}`, cursor: 'pointer', fontFamily: TYPO.fontDisplay, color: theme.text, transition: `border-color ${DUR.state}ms ${EASE}` }}>
          <span style={{ fontWeight: 600, fontSize: 11.5, fontVariantNumeric: 'tabular-nums' }}>{fmtPx(val.precio)}</span>
          <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', padding: '1px 4px', borderRadius: 3, background: `${chipColor}22`, color: chipColor }}>{esCustom ? 'CUSTOM' : listaShort(listaActiva)}</span>
          <span style={{ fontSize: 9, color: theme.textMuted }}>▾</span>
        </button>
        {esCustom && customEditing && (
          <input type="number" min="0" step="0.01" value={val.precio ?? ''} autoFocus
            onChange={(e) => onChange({ precio: Number(e.target.value) || 0 })} onBlur={() => setCustomEditing(false)}
            style={{ width: 70, height: 24, padding: '0 6px', textAlign: 'right', fontSize: 11, fontFamily: TYPO.fontDisplay, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.text, outline: 'none' }} />
        )}
        {esCustom && !customEditing && <Pill tone="orange" size="xs" onClick={() => setCustomEditing(true)} style={{ cursor: 'pointer' }}>editar</Pill>}
      </div>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, zIndex: 40, background: theme.surface, border: bordeFlotante(theme), borderRadius: 10, boxShadow: elevation(theme, 'flotante'), padding: 6, minWidth: 230 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textMuted, padding: '6px 10px 4px' }}>Lista para este SKU</div>
          {listasKeys.length === 0 && <div style={{ padding: '6px 10px', fontSize: 11, color: theme.textMuted }}>Sin listas de precio para este SKU</div>}
          {listasKeys.map((k) => item(k, k, money(r.precios[k]), listaActiva === k, listaColor(k)))}
          <div style={{ borderTop: `1px dashed ${theme.border}`, marginTop: 4, paddingTop: 4 }}>
            {item('__custom', 'Personalizado', 'editable', esCustom, theme.orange || '#FF9500')}
          </div>
        </div>
      )}
    </div>
  );
}
