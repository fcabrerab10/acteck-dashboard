// Control "Paneles" de la barra superior · sólo en monitores panorámicos (≥ 1900 px).
// Elige la **disposición** (uno · comparativa · tres en fila · dos y una alta · una alta y dos ·
// una arriba y dos abajo · 4 puestos) y el ancho máximo del contenido.
// Qué disposiciones caben lo decide el monitor: 900 px por columna y ~420 px de alto por fila
// apilada (27" → todas menos "tres en fila"; 34" y 49" → todas).
import React, { useState } from 'react';
import { LayoutGrid } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  useDispositivo, usePrefsDispositivo, setPrefDispositivo,
  panelesEfectivos, normalizarPaneles, DISPOSICION_POR_ID, ANCHOS_MAX,
} from '../../lib/dispositivo';
import SelectorDisposicion from './SelectorDisposicion';

export default function ControlPaneles({ oscuro = false }) {
  const { theme } = useTheme();
  const { modo, ancho, alto } = useDispositivo();
  const prefs = usePrefsDispositivo();
  const [abierto, setAbierto] = useState(false);
  if (modo !== 'panoramico') return null;

  const actual = panelesEfectivos(prefs.paneles, { ancho, alto });
  const def = DISPOSICION_POR_ID[actual.disposicion];
  const activas = def?.slots || 1;

  const poner = (id) => {
    const d = DISPOSICION_POR_ID[id];
    if (!d) return;
    setPrefDispositivo(modo, 'paneles', d.slots <= 1
      ? { disposicion: 'uno', slots: [] }
      : { disposicion: id, slots: normalizarPaneles(actual.slots, d.slots) });
  };

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
        <LayoutGrid size={13} /> <span>{activas > 1 ? def.nombre : 'Paneles'}</span>
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 90 }} />
          <div style={{
            position: 'absolute', top: 34, right: 0, zIndex: 91, width: 300, padding: 10,
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
            boxShadow: '0 16px 40px rgba(0,0,0,0.18)', fontFamily: TYPO.fontText, color: theme.text,
          }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, marginBottom: 6 }}>Disposición</div>
            <SelectorDisposicion valor={actual.disposicion} onElegir={poner} ancho={ancho} alto={alto} compacto />
            <div style={{ fontSize: 10.5, color: theme.textMuted, margin: '8px 0 10px' }}>
              El panel azul sigue a tu menú y a ⌘K; los demás se eligen en su cabecera y se intercambian arrastrándola.
              Las disposiciones en gris no caben en {ancho} × {alto} px.
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
            <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6 }}>
              Sólo aplica con una pantalla: con varios paneles la rejilla usa todo el monitor.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
