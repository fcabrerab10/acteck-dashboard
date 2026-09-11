// SelectorTrimestres · Kit V3 · pills Q1 Q2 Q3 Q4 + "Año" combinables (aprobado por Fernando 2026-09-10).
// value: Set de 'Q1'..'Q4' · onChange(Set). Cada Q es un interruptor; "Año" marca los 4; si quitas uno, "Año" se apaga;
// siempre queda al menos uno. `resumen` (texto) pinta una pastilla gris a la derecha ("Q2 + Q3 · $229 M · 6 meses").
// Helpers: Q_MESES, TRIMESTRES, qDe(mes), mesesDeTrimestres(set) → [1..12] ordenados, etiquetaTrimestres(set) → "Q2 + Q3",
// usePersistTrimestres(clave, inicial) → [set, setSet, persistido] guardado en localStorage `trimestres:<clave>`.
import React, { useCallback, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';

export const TRIMESTRES = ['Q1', 'Q2', 'Q3', 'Q4'];
export const Q_MESES = { Q1: [1, 2, 3], Q2: [4, 5, 6], Q3: [7, 8, 9], Q4: [10, 11, 12] };
export const qDe = (mes) => (mes <= 3 ? 'Q1' : mes <= 6 ? 'Q2' : mes <= 9 ? 'Q3' : 'Q4');
const TODOS = () => new Set(TRIMESTRES);

/** Meses (1..12) de los trimestres marcados. Set vacío o inválido → los 12. */
export function mesesDeTrimestres(set) {
  if (!set || typeof set.has !== 'function' || set.size === 0) return [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
  const out = [];
  TRIMESTRES.forEach((q) => { if (set.has(q)) out.push(...Q_MESES[q]); });
  return out;
}

/** "Q2 + Q3" · "Año" si están los 4. */
export function etiquetaTrimestres(set) {
  if (!set || set.size === 0 || set.size === 4) return 'Año';
  return TRIMESTRES.filter((q) => set.has(q)).join(' + ');
}

const leer = (clave) => {
  try {
    const raw = localStorage.getItem(`trimestres:${clave}`);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    const set = new Set((Array.isArray(arr) ? arr : []).filter((q) => TRIMESTRES.includes(q)));
    return set.size ? set : null;
  } catch { return null; }
};
const guardar = (clave, set) => { try { localStorage.setItem(`trimestres:${clave}`, JSON.stringify([...set])); } catch { /* sin storage */ } };

/** Selección de trimestres persistida por pantalla. `inicial`: Set o fn → Set (default: el trimestre del mes actual). */
export function usePersistTrimestres(clave, inicial) {
  const [estado, setEstado] = useState(() => {
    const guardado = clave ? leer(clave) : null;
    if (guardado) return { set: guardado, persistido: true };
    const ini = typeof inicial === 'function' ? inicial() : inicial;
    return { set: ini instanceof Set && ini.size ? ini : new Set([qDe(new Date().getMonth() + 1)]), persistido: false };
  });
  const set = useCallback((next) => {
    setEstado((prev) => {
      const val = typeof next === 'function' ? next(prev.set) : next;
      const limpio = val instanceof Set && val.size ? val : TODOS();
      if (clave) guardar(clave, limpio);
      return { set: limpio, persistido: true };
    });
  }, [clave]);
  return [estado.set, set, estado.persistido];
}

export default function SelectorTrimestres({ value, onChange, resumen, size = 'sm', style }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const sel = value instanceof Set ? value : new Set(Array.isArray(value) ? value : value ? [value] : []);
  const todos = sel.size === 4;
  const toggle = (q) => {
    const next = new Set(sel);
    if (next.has(q)) { if (next.size === 1) return; next.delete(q); } else next.add(q);
    onChange?.(next);
  };
  const anio = () => { if (!todos) onChange?.(TODOS()); };
  const md = size === 'md';
  const base = {
    border: `1px solid ${theme.border}`, borderRadius: 999, padding: md ? '4px 12px' : '3px 10px', cursor: 'pointer',
    fontFamily: TYPO.fontDisplay, fontSize: md ? 12 : 11, fontWeight: 600, letterSpacing: '0.01em', lineHeight: 1.4,
    background: theme.surface, color: theme.textMuted, transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}`,
    whiteSpace: 'nowrap',
  };
  const on = { background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.surface, borderColor: theme.surfaceInverse || theme.text };
  const anioOn = { background: dark ? 'rgba(10,132,255,0.16)' : 'rgba(0,122,255,0.10)', color: theme.accent, borderColor: 'transparent' };
  return (
    <div role="group" aria-label="Trimestres" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', ...style }}>
      {TRIMESTRES.map((q) => {
        const activo = sel.has(q);
        return (
          <button key={q} type="button" aria-pressed={activo} onClick={() => toggle(q)} title={activo ? `Quitar ${q}` : `Sumar ${q}`}
            style={{ ...base, ...(activo ? on : null) }}>{q}</button>
        );
      })}
      <button type="button" aria-pressed={todos} onClick={anio} title="Los cuatro trimestres" style={{ ...base, ...(todos ? anioOn : null) }}>Año</button>
      {resumen && (
        <span style={{ marginLeft: 3, display: 'inline-flex', alignItems: 'center', borderRadius: 999, padding: '2px 8px', fontSize: 10, fontWeight: 600,
          fontFamily: TYPO.fontDisplay, color: theme.textMuted, border: `1px solid ${theme.border}`, background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
          fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{resumen}</span>
      )}
    </div>
  );
}
