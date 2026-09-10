// Hoja de atajos de teclado (se abre con `?`).
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Overlay, Kbd, vidrio, hairline } from './comun';
import { etiquetaNodo } from './arbol';

const ES_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || '');
export const MOD = ES_MAC ? '⌘' : 'Ctrl';

export default function AtajosHoja({ abierto, onClose, favoritos = [] }) {
  const { theme } = useTheme();
  const filas = [
    { teclas: [`${MOD} K`], desc: 'Buscar pestañas, clientes y SKUs' },
    { teclas: ['?'], desc: 'Esta hoja de atajos' },
    { teclas: ['Esc'], desc: 'Cerrar menús, hojas y la paleta' },
    ...favoritos.slice(0, 9).map((n, i) => ({ teclas: [`${MOD} ${i + 1}`], desc: etiquetaNodo(n) })),
  ];
  return (
    <Overlay abierto={abierto} onClose={onClose} zIndex={70} alinear="center">
      <div role="dialog" aria-modal="true" style={{ width: 'min(440px, calc(100vw - 24px))', borderRadius: 12, overflow: 'hidden', ...vidrio(theme, 'popover'), fontFamily: TYPO.fontText, color: theme.text, animation: `atajosIn ${DUR.state}ms ${EASE} both` }}>
        <style>{`@keyframes atajosIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: none; } }`}</style>
        <div style={{ padding: '14px 16px 10px', borderBottom: `1px solid ${hairline(theme)}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>Atajos de teclado</div>
          <Kbd theme={theme}>esc</Kbd>
        </div>
        <div style={{ padding: '8px 8px 12px', maxHeight: '60vh', overflowY: 'auto' }}>
          {filas.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 8px', borderRadius: 8 }}>
              <span style={{ flex: 1, fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.desc}</span>
              <span style={{ display: 'inline-flex', gap: 4 }}>{f.teclas.map((t) => <Kbd key={t} theme={theme} style={{ fontSize: 11, padding: '4px 7px' }}>{t}</Kbd>)}</span>
            </div>
          ))}
          {favoritos.length === 0 && <div style={{ padding: '8px 8px 0', fontSize: 11.5, color: theme.textMuted }}>Añade favoritos (☆) para asignarles {MOD} 1-9.</div>}
        </div>
      </div>
    </Overlay>
  );
}
