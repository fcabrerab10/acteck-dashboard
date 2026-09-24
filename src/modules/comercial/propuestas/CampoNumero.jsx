// CampoNumero — captura numérica fluida para piezas y precios (2026-09-24, Fernando: «cuando escribo
// números en casillas que sea más fluido… no se pueden escribir bien»). El problema era `type="number"`
// con `Number(e.target.value) || 0` en cada tecla: al borrar aparecía 0, no se podía dejar vacío y el
// navegador metía flechas y validación. Aquí el texto vive en un estado local mientras se edita y se
// confirma en cada cambio válido; al salir se normaliza y se muestra con separador de miles.
import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';

const fmt = (v, dec) => (v == null || v === '' || Number.isNaN(Number(v)) ? '' : new Intl.NumberFormat('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: dec }).format(Number(v)));

export default function CampoNumero({ value, onChange, onEnter, decimales = 0, placeholder, ancho = 62, alto = 24, acento = false, invalido = false, title, ariaLabel, style, autoFocus, onBlur }) {
  const { theme } = useTheme();
  const [foco, setFoco] = useState(false);
  const [texto, setTexto] = useState(() => (value == null || value === '' ? '' : String(value)));
  const ref = useRef(null);
  useEffect(() => { if (!foco) setTexto(value == null || value === '' ? '' : String(value)); }, [value, foco]);
  const limpiar = (s) => String(s).replace(/[^\d.,-]/g, '').replace(/,/g, decimales ? '.' : '');
  const cambiar = (e) => {
    const t = limpiar(e.target.value);
    setTexto(t);
    if (t === '' || t === '-' || t === '.') { onChange?.(null); return; }
    const n = Number(t);
    if (!Number.isNaN(n)) onChange?.(decimales ? Math.round(n * 10 ** decimales) / 10 ** decimales : Math.round(n));
  };
  const salir = (e) => { setFoco(false); const n = Number(texto); onChange?.(texto === '' || Number.isNaN(n) ? 0 : (decimales ? n : Math.round(n))); onBlur?.(e); };
  return (
    <input ref={ref} className="prop-piezas" type="text" inputMode={decimales ? 'decimal' : 'numeric'} autoComplete="off" autoFocus={autoFocus}
      value={foco ? texto : fmt(value, decimales)} placeholder={placeholder} title={title} aria-label={ariaLabel}
      onFocus={(e) => { setFoco(true); setTexto(value == null || value === '' ? '' : String(value)); requestAnimationFrame(() => e.target.select?.()); }}
      onChange={cambiar} onBlur={salir} onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); ref.current?.blur(); onEnter?.(e); } if (e.key === 'Escape') ref.current?.blur(); }}
      style={{ width: ancho, height: alto, padding: '0 8px', textAlign: 'right', fontSize: 11.5, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', fontWeight: 600, background: theme.bg, border: `1px solid ${invalido ? (theme.red || '#FF3B30') : foco || acento ? (theme.accent || '#007AFF') : theme.border}`, borderRadius: 7, color: theme.text, outline: 'none', boxSizing: 'border-box', ...style }} />
  );
}
