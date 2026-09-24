// Celular · tarjeta de respuesta de «Buscar o preguntar» (misma lógica que la web: src/lib/preguntas).
import React from 'react';
import { ArrowUpRight, Sparkles } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { BotonGrande } from '../../piezas';

export default function RespuestaM({ r, cargando, onIr }) {
  const { theme } = useTheme();
  if (cargando && !r) {
    return <div style={{ margin: '0 16px 14px', padding: 14, borderRadius: 14, background: theme.surface, border: `1px solid ${theme.border}` }}><div style={{ height: 10, width: 150, borderRadius: 5, background: theme.border }} /><div style={{ height: 28, width: 120, borderRadius: 6, background: theme.border, opacity: 0.7, marginTop: 10 }} /></div>;
  }
  if (!r) return null;
  return (
    <div style={{ margin: '0 16px 14px', padding: 14, borderRadius: 14, background: theme.surface, border: `1px solid ${theme.border}`, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}><Sparkles size={12} />{r.titulo}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 30, fontWeight: 700, letterSpacing: '-0.03em', fontVariantNumeric: 'tabular-nums', color: r.error ? theme.red || '#FF3B30' : theme.text, marginTop: 4 }}>{r.cifra}</div>
      {r.sub && <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 2 }}>{r.sub}</div>}
      {r.lineas?.length > 0 && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>{r.lineas.map((l, i) => <div key={i} style={{ fontSize: 13, color: theme.text }}>{l}</div>)}</div>}
      {r.abrir && <div style={{ marginTop: 12 }}><BotonGrande primario icon={ArrowUpRight} onClick={() => onIr?.(r.abrir)}>{r.abrir.label}</BotonGrande></div>}
      {r.tambien?.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {r.tambien.map((t, i) => <button key={i} type="button" onClick={() => onIr?.(t)} style={{ border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, borderRadius: 999, padding: '6px 11px', fontFamily: TYPO.fontText, fontSize: 12.5 }}>{t.label}</button>)}
        </div>
      )}
    </div>
  );
}

export function SugerenciasM({ lista, onElegir }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '0 16px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {lista.map((s) => <button key={s} type="button" onClick={() => onElegir(s)} style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, borderRadius: 999, padding: '7px 12px', fontFamily: TYPO.fontText, fontSize: 12.5 }}>{s}</button>)}
    </div>
  );
}
