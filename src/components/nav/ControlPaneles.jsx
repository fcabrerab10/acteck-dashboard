// Control "Paneles" de la barra superior · sólo en monitores panorámicos (≥ 1900 px).
// Elige cuántas pantallas se ven a la vez (1 · 2 · 3 · 4) y el ancho máximo del contenido.
// El tope de columnas lo pone el ancho real: 900 px mínimos por columna (27" → 2, 34" → 3, 49" → 4).
import React, { useState } from 'react';
import { Columns3 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useDispositivo, usePrefsDispositivo, setPrefDispositivo, maxColumnas, normalizarPaneles, ANCHOS_MAX } from '../../lib/dispositivo';

export default function ControlPaneles({ oscuro = false }) {
  const { theme } = useTheme();
  const { modo, ancho } = useDispositivo();
  const prefs = usePrefsDispositivo();
  const [abierto, setAbierto] = useState(false);
  if (modo !== 'panoramico') return null;

  const tope = maxColumnas(ancho);
  const activas = Math.max(1, Math.min(tope, prefs.paneles.length || 1));
  const poner = (n) => setPrefDispositivo(modo, 'paneles', n <= 1 ? [] : normalizarPaneles(prefs.paneles, n));

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={() => setAbierto((v) => !v)} title="Paneles · ver varias pantallas a la vez"
        style={{
          height: 28, padding: '0 9px', border: 0, borderRadius: 999, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: activas > 1
            ? (oscuro ? 'rgba(255,255,255,0.18)' : `${theme.accent}18`)
            : (oscuro ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.05)'),
          color: activas > 1 ? (oscuro ? '#FFF' : theme.accent) : (oscuro ? 'rgba(255,255,255,0.8)' : theme.textMuted),
          fontFamily: TYPO.fontText, fontSize: 12,
        }}>
        <Columns3 size={13} /> <span>{activas > 1 ? `${activas} paneles` : 'Paneles'}</span>
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{
            position: 'absolute', top: 34, right: 0, zIndex: 91, width: 250, padding: 10,
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.18)', fontFamily: TYPO.fontText, color: theme.text,
          }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Pantallas a la vez</div>
            <div style={{ display: 'flex', gap: 6, marginBottom: 4 }}>
              {[1, 2, 3, 4].map((n) => {
                const bloqueada = n > tope;
                const on = n === activas;
                return (
                  <button key={n} type="button" disabled={bloqueada} onClick={() => poner(n)}
                    title={bloqueada ? `Tu monitor (${ancho} px) no da para ${n} columnas de 900 px` : `${n} panel${n === 1 ? '' : 'es'}`}
                    style={{
                      flex: 1, height: 30, borderRadius: 8, cursor: bloqueada ? 'not-allowed' : 'pointer',
                      border: `1px solid ${on ? theme.accent : theme.border}`,
                      background: on ? `${theme.accent}14` : 'transparent',
                      color: bloqueada ? theme.textSubtle || theme.textMuted : on ? theme.accent : theme.text,
                      opacity: bloqueada ? 0.45 : 1, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600,
                    }}>
                    {n}
                  </button>
                );
              })}
            </div>
            <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 10 }}>
              La primera columna sigue a tu menú; las demás se eligen en su cabecera.
            </div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Ancho del contenido</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {ANCHOS_MAX.map((a) => {
                const on = Number(prefs.anchoMax) === a.id;
                return (
                  <button key={a.id} type="button" onClick={() => setPrefDispositivo(modo, 'anchoMax', a.id)}
                    style={{
                      flex: 1, height: 28, borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${on ? theme.accent : theme.border}`,
                      background: on ? `${theme.accent}14` : 'transparent', color: on ? theme.accent : theme.text,
                      fontFamily: TYPO.fontText, fontSize: 11.5,
                    }}>
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
