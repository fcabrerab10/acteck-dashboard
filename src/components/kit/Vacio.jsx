// Pantalla o tabla vacía con intención (2026-11-11): icono en su ficha, una frase que explica y, si aplica,
// el botón de lo que sigue. Sustituye a los «Sin datos.» sueltos. `compacto` para dentro de tablas y paneles.
import React from 'react';
import { Inbox } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function Vacio({ icon: Icon = Inbox, titulo, sub, accion, compacto = false, style }) {
  const { theme } = useTheme();
  const acento = theme.accent || '#007AFF';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 6, padding: compacto ? '18px 16px' : '36px 20px', fontFamily: TYPO.fontText, ...style }}>
      {Icon && <span style={{ width: compacto ? 34 : 44, height: compacto ? 34 : 44, borderRadius: compacto ? 11 : 14, background: `${acento}1F`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={compacto ? 17 : 22} color={acento} strokeWidth={1.9} /></span>}
      {titulo && <span style={{ fontFamily: TYPO.fontDisplay, fontSize: compacto ? 13 : 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, marginTop: 4 }}>{titulo}</span>}
      {sub && <span style={{ fontSize: 12.5, lineHeight: 1.45, color: theme.textMuted, maxWidth: 360 }}>{sub}</span>}
      {accion && <div style={{ marginTop: 8 }}>{accion}</div>}
    </div>
  );
}
