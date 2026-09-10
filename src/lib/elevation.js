// Sombras estilo macOS · escala de tres niveles (V3).
//   reposo   → sin sombra: las superficies en reposo se separan con hairline (theme.border).
//   hover    → dos capas suaves para cards/botones que responden al cursor.
//   flotante → menús, popovers, modales y toasts (lo que flota sobre la página).
// Uso: import { ELEV, elevation } from '../lib/elevation'  (o desde '../components/kit')
//   style={{ boxShadow: elevation(theme, hover ? 'hover' : 'reposo') }}
//   const s = elevation(theme, 'flotante');  → en Midnight además conviene border: theme.borderStrong.
export const ELEV = {
  reposo: 'none',
  hover: '0 1px 2px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.08)',
  flotante: '0 2px 6px rgba(0,0,0,0.08), 0 16px 48px rgba(0,0,0,0.16)',
};

// Midnight: el fondo es negro, la sombra debe ser más densa para leerse.
export const ELEV_DARK = {
  reposo: 'none',
  hover: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px rgba(0,0,0,0.5)',
  flotante: '0 2px 6px rgba(0,0,0,0.5), 0 16px 48px rgba(0,0,0,0.7)',
};

const esOscuro = (theme) => theme?.mode === 'dark' || theme?.key === 'midnight';

// elevation(theme, nivel) → string CSS de box-shadow. nivel: 'reposo' | 'hover' | 'flotante'.
export function elevation(theme, nivel = 'reposo') {
  const t = esOscuro(theme) ? ELEV_DARK : ELEV;
  return t[nivel] ?? t.reposo;
}

// Borde recomendado para superficies flotantes: en Midnight la sombra sola no separa, se refuerza con borderStrong.
export function bordeFlotante(theme) {
  return `1px solid ${esOscuro(theme) ? (theme?.borderStrong || 'rgba(255,255,255,0.15)') : (theme?.border || 'rgba(0,0,0,0.08)')}`;
}
