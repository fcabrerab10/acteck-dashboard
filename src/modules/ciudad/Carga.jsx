// Acteck Ciudad · pantalla de carga «Descenso desde órbita» (elegida por Fernando, 2026-10-05): la Tierra en la
// oscuridad, la cámara baja hacia México, sigue bajando hasta Guadalajara (el punto azul de Acteck late y crece),
// cruza una capa de nubes y se disuelve sobre el mapa. Dura lo que tarde la carga, nunca menos de 3.6 s.
//   <Carga pasos={['Bajando el motor 3D…', …]} listo={bool} onFin={() => …} />
import React, { useEffect, useRef, useState } from 'react';

const MX = [[-120, -40], [-60, -70], [20, -60], [70, -30], [110, -20], [90, 10], [40, 20], [10, 60], [-20, 30], [-80, 10]]; // contorno estilizado (unidades)
const GDL = [-35, 12]; // Guadalajara dentro del contorno
const MIN_MS = 3600, SALIDA_MS = 700;

export default function Carga({ pasos = [], listo = false, onFin }) {
  const ref = useRef(null);
  const [paso, setPaso] = useState(0);
  const [saliendo, setSaliendo] = useState(false);
  const finRef = useRef(onFin); finRef.current = onFin;
  const listoRef = useRef(listo); listoRef.current = listo;

  useEffect(() => {
    const cv = ref.current; const ctx = cv.getContext('2d');
    let W = 0, H = 0, DPR = 1, raf = 0, salida = null, acabado = false;
    const size = () => { DPR = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth; H = cv.clientHeight; cv.width = W * DPR; cv.height = H * DPR; ctx.setTransform(DPR, 0, 0, DPR, 0, 0); };
    size(); const ro = new ResizeObserver(size); ro.observe(cv);
    const estrellas = Array.from({ length: 160 }, (_, i) => ({ x: (i * 977) % 1000 / 1000, y: (i * 613) % 1000 / 1000, a: .2 + (i % 5) / 10 }));
    const t0 = performance.now();
    const ease = (t) => 1 - Math.pow(1 - t, 3);
    function dibujar(now) {
      const tt = now - t0;
      // progreso del descenso: llega a 0.86 en MIN_MS y de ahí espera a `listo`; con listo, remata a 1 y sale
      let p = Math.min(.86, tt / MIN_MS);
      if (listoRef.current && tt >= MIN_MS) { if (!salida) salida = now; p = .86 + .14 * Math.min(1, (now - salida) / SALIDA_MS); }
      const e = ease(p);
      ctx.fillStyle = '#05060a'; ctx.fillRect(0, 0, W, H);
      for (const s of estrellas) { ctx.fillStyle = `rgba(255,255,255,${s.a * (1 - e)})`; ctx.fillRect(s.x * W, s.y * H, 1.3, 1.3); }
      // planeta: crece y se desplaza para que Guadalajara termine en el centro
      const r = H * .34 + e * H * 7;
      const k = r / 420;
      const gx = GDL[0] * k, gy = (GDL[1] - 328) * k; // posición de GDL relativa al centro del planeta
      const cx = W / 2 - gx * e, cy = H * .92 * (1 - e) + (H / 2 - gy) * e; // al final Guadalajara cae en el centro de la pantalla
      const g = ctx.createRadialGradient(cx - r * .3, cy - r * .4, r * .1, cx, cy, r); g.addColorStop(0, '#6FB1E8'); g.addColorStop(.55, '#2F6FB5'); g.addColorStop(1, '#0b2340');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      // continente
      ctx.save(); ctx.translate(cx, cy - 328 * k); ctx.scale(k, k);
      ctx.fillStyle = '#E8DCC2'; ctx.beginPath(); MX.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.fill();
      // Guadalajara: punto azul que late, con etiqueta cuando ya estamos cerca
      const lat = 1 + Math.sin(now / 260) * .18;
      ctx.fillStyle = 'rgba(10,132,255,.25)'; ctx.beginPath(); ctx.arc(GDL[0], GDL[1], 9 * lat, 0, 7); ctx.fill();
      ctx.fillStyle = '#0A84FF'; ctx.beginPath(); ctx.arc(GDL[0], GDL[1], 3.2, 0, 7); ctx.fill();
      ctx.restore();
      if (e > .55) { const a = Math.min(1, (e - .55) / .2); ctx.fillStyle = `rgba(245,245,247,${a})`; ctx.font = `700 ${Math.min(34, 14 + e * 20)}px -apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'; const px = cx + GDL[0] * k, py = cy + (GDL[1] - 328) * k; ctx.fillText('acteck. · Guadalajara', px, py - 14 * k - 6); }
      // atmósfera
      ctx.strokeStyle = `rgba(160,210,255,${.5 * (1 - e)})`; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, r + 4, 0, 7); ctx.stroke();
      // nubes al cruzar y disolución final
      if (p > .62 && p < .9) { const q = (p - .62) / .28; ctx.fillStyle = `rgba(255,255,255,${Math.sin(q * Math.PI) * .85})`; ctx.fillRect(0, 0, W, H); }
      if (p > .9) { const q = (p - .9) / .1; ctx.fillStyle = `rgba(234,242,247,${q})`; ctx.fillRect(0, 0, W, H); if (!saliendo && q > .5) setSaliendo(true); }
      setPaso(Math.min(pasos.length - 1, Math.floor(Math.min(1, tt / MIN_MS) * pasos.length)));
      if (p >= 1 && !acabado) { acabado = true; finRef.current?.(); return; }
      raf = requestAnimationFrame(dibujar);
    }
    raf = requestAnimationFrame(dibujar);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 8, background: '#05060a', opacity: saliendo ? 0 : 1, transition: 'opacity 500ms cubic-bezier(.32,.72,0,1)', pointerEvents: saliendo ? 'none' : 'auto' }}>
      <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, bottom: 34, textAlign: 'center', color: 'rgba(245,245,247,.75)', fontSize: 13, fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", Helvetica, Arial, sans-serif', textShadow: '0 1px 8px rgba(0,0,0,.6)' }}>
        <div style={{ fontWeight: 700, letterSpacing: '-0.03em', fontSize: 22, color: '#F5F5F7' }}>acteck<span style={{ color: '#0A84FF' }}>.</span> Ciudad</div>
        <div style={{ marginTop: 6, minHeight: 18 }}>{pasos[paso] || ''}</div>
      </div>
    </div>
  );
}
