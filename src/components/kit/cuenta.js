// Cifra que «cuenta» al cambiar (2026-11-11). Recibe el texto ya formateado ("$57.5M", "73 %", "1,204")
// y anima sólo su parte numérica conservando prefijo, sufijo, decimales y separador de miles.
// El primer pintado muestra el valor final (nada de contar desde cero al cargar) y respeta reduce-motion.
import { useEffect, useRef, useState } from 'react';
import { reduceMotion } from '../../lib/motion';

const RE = /^([^\d-]*)(-?\d[\d,]*(?:\.\d+)?)(.*)$/s;

export function partir(texto) {
  if (typeof texto !== 'string') return null;
  const m = RE.exec(texto);
  if (!m) return null;
  const crudo = m[2];
  const valor = Number(crudo.replace(/,/g, ''));
  if (!Number.isFinite(valor)) return null;
  return { pre: m[1], valor, post: m[3], dec: (crudo.split('.')[1] || '').length, miles: crudo.includes(',') };
}

export function armar(p, v) {
  const fijo = Math.abs(v).toFixed(p.dec);
  const [ent, dec] = fijo.split('.');
  const entero = p.miles ? ent.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ent;
  return `${p.pre}${v < 0 ? '-' : ''}${entero}${dec ? `.${dec}` : ''}${p.post}`;
}

export function useCuenta(texto, ms = 420) {
  const [anim, setAnim] = useState(null); // null = pinta el texto tal cual
  const previo = useRef(texto);
  useEffect(() => {
    const a = partir(previo.current), b = partir(texto);
    previo.current = texto;
    if (!a || !b || a.pre !== b.pre || a.post !== b.post || a.valor === b.valor || reduceMotion() || typeof requestAnimationFrame === 'undefined') { setAnim(null); return undefined; }
    let raf = 0; const t0 = performance.now();
    const paso = (t) => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - (1 - k) ** 3;
      if (k >= 1) { setAnim(null); return; }
      setAnim(armar(b, a.valor + (b.valor - a.valor) * e));
      raf = requestAnimationFrame(paso);
    };
    raf = requestAnimationFrame(paso);
    return () => { cancelAnimationFrame(raf); setAnim(null); };
  }, [texto, ms]);
  return anim ?? texto;
}
