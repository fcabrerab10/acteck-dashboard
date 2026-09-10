// Estado vacío / error / próximamente · centrado, con icono opcional.
import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

export default function Vacio({ icon: Icon = CheckCircle2, color, titulo = 'Todo al corriente', sub, accion, style }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, padding: '32px 20px', textAlign: 'center', ...style }}>
      {Icon && <Icon size={30} color={color || theme.green} strokeWidth={1.7} />}
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em', marginTop: 4 }}>{titulo}</span>
      {sub && <span style={{ fontSize: 12.5, color: theme.textMuted, lineHeight: 1.45, maxWidth: 300 }}>{sub}</span>}
      {accion && <div style={{ marginTop: 10 }}>{accion}</div>}
    </div>
  );
}

/** Mensaje "Próximamente en el celular" para hojas de pestañas sin versión móvil. */
export function Proximamente({ que }) {
  const { theme } = useTheme();
  return (
    <Vacio icon={null} titulo={`${que ? `${que} · ` : ''}Próximamente en el celular`} sub="Esta pestaña todavía se edita desde la computadora. Aquí llegará en una próxima versión."
      style={{ padding: '28px 20px 36px', color: theme.text }} />
  );
}
