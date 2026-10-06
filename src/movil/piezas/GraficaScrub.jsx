// Gráfica de líneas que se lee arrastrando el dedo (genérica · 2026-10-05, nacida del «2026 frente a 2025» de Inicio).
// SVG con N series sobre las mismas filas; `touch-action: pan-y` deja que el scroll vertical siga siendo de la página
// y el movimiento horizontal engancha punto a punto (vibración corta si el equipo la tiene). Tocar sin arrastrar
// avisa `onTocar(i)`.
//   series = [{ key, label, color, dash?, area?, grosor? }]   (se dibujan en ese orden; la última queda encima)
//   datos  = [{ label, ...valores }]                           (null = sin dato: la línea se corta)
//   formato(n) · tooltip(fila, i) → nodo (si no viene, se arma con las series) · activo = índice con punto fijo
//   etiqueta(fila, i) → texto del eje (por defecto la primera letra del label).
import React, { useRef, useState, useCallback, useId, useEffect } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';

const W0 = 340, H = 176, L = 10, R = 10, T = 26, B = 22;

export default function GraficaScrub({ series = [], datos = [], formato = (n) => String(n), tooltip, activo = null, onTocar, etiqueta, alto = H }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const uid = useId();
  const [i, setI] = useState(null);
  // Responsivo (2026-10-05, Fernando: la gráfica salía demasiado alta en iPad mini): el viewBox se mide al ancho real
  // del contenedor y la altura queda fija (`alto`), así los textos no se deforman ni crece con la pantalla.
  const [W, setW] = useState(W0);
  useEffect(() => {
    const el = ref.current?.parentElement; if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => { const w = Math.round(el.getBoundingClientRect().width); if (w > 0) setW(Math.max(280, w)); };
    medir(); const ro = new ResizeObserver(medir); ro.observe(el); return () => ro.disconnect();
  }, []);
  const moved = useRef(false);
  const Hh = alto;
  const vals = datos.flatMap((d) => series.map((s) => d[s.key])).filter((v) => v != null && Number.isFinite(v));
  const max = Math.max(1, ...vals) * 1.08;
  const n = datos.length || 1;
  const x = (k) => L + (k * (W - L - R)) / Math.max(1, n - 1);
  const y = (v) => T + (Hh - T - B) * (1 - Math.max(0, v) / max);
  const path = (key) => { let d = ''; datos.forEach((f, k) => { const v = f[key]; if (v == null) { d += ''; return; } d += `${d && datos[k - 1]?.[key] != null ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`; }); return d; };
  const area = (key) => {
    const last = datos.reduce((u, f, k) => (f[key] != null ? k : u), -1);
    if (last < 0) return '';
    let first = -1; datos.some((f, k) => { if (f[key] != null) { first = k; return true; } return false; });
    return `M${x(first)},${y(0)}${datos.slice(first, last + 1).map((f, k) => `L${x(first + k).toFixed(1)},${y(f[key] ?? 0).toFixed(1)}`).join('')}L${x(last)},${y(0)}Z`;
  };

  const indiceDe = useCallback((e) => {
    const svg = ref.current; if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
  }, [n]);
  const mostrar = (k) => { if (k == null || k === i) return; setI(k); try { if (navigator.vibrate) navigator.vibrate(4); } catch { /* sin háptico */ } };
  const onDown = (e) => { moved.current = false; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ya capturado */ } mostrar(indiceDe(e)); };
  const onMove = (e) => { if (e.pointerType === 'mouse' && !e.buttons) { mostrar(indiceDe(e)); return; } moved.current = true; mostrar(indiceDe(e)); };
  const onUp = (e) => { const k = indiceDe(e); if (!moved.current && k != null && onTocar) onTocar(k); setTimeout(() => setI(null), 900); };
  const sel = i != null ? datos[i] : null;
  const tipX = i != null ? Math.max(78, Math.min(W - 78, x(i))) : 0;
  const principal = series.find((s) => s.area) || series[series.length - 1];
  const tipDefault = (f) => (
    <>
      <b style={{ fontSize: 12.5 }}>{f.label}</b>
      {series.map((s) => (f[s.key] != null ? <span key={s.key}> · {s.label} <b style={{ fontSize: 12.5, color: s.key === principal?.key ? undefined : undefined }}>{formato(f[s.key])}</b></span> : null))}
    </>
  );

  return (
    <div style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setI(null)} onPointerLeave={() => setTimeout(() => setI(null), 500)}>
      <svg ref={ref} viewBox={`0 0 ${W} ${Hh}`} style={{ display: 'block', width: '100%', height: Hh }} preserveAspectRatio="none">
        <defs>
          {series.filter((s) => s.area).map((s) => (
            <linearGradient key={s.key} id={`${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={s.color} stopOpacity=".3" /><stop offset="1" stopColor={s.color} stopOpacity="0" /></linearGradient>
          ))}
        </defs>
        {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={L} x2={W - R} y1={y(max * k)} y2={y(max * k)} stroke={theme.border} strokeWidth="1" />)}
        {series.filter((s) => s.area).map((s) => <path key={`a-${s.key}`} d={area(s.key)} fill={`url(#${uid}-${s.key})`} />)}
        {series.map((s) => <path key={s.key} d={path(s.key)} fill="none" stroke={s.color} strokeWidth={s.grosor || (s.area ? 2.6 : 1.8)} strokeDasharray={s.dash ? '4 4' : undefined} strokeLinecap="round" strokeLinejoin="round" />)}
        {activo != null && i == null && principal && datos[activo]?.[principal.key] != null && <circle cx={x(activo)} cy={y(datos[activo][principal.key])} r="4.5" fill={principal.color} stroke={theme.surface} strokeWidth="2" />}
        {sel && (
          <g>
            <line x1={x(i)} x2={x(i)} y1={T - 8} y2={Hh - B + 2} stroke={theme.text} strokeOpacity=".35" strokeWidth="1" />
            {series.map((s) => (sel[s.key] != null && !s.dash ? <circle key={s.key} cx={x(i)} cy={y(sel[s.key])} r={s.area ? 5 : 4} fill={s.color} stroke={theme.surface} strokeWidth="2" /> : null))}
          </g>
        )}
        {datos.map((f, k) => <text key={k} x={x(k)} y={Hh - 6} textAnchor="middle" fontSize="9" fill={theme.textMuted} fontFamily={TYPO.fontText}>{etiqueta ? etiqueta(f, k) : String(f.label || '').slice(0, 1)}</text>)}
      </svg>
      <div aria-live="polite" style={{ position: 'absolute', top: 0, left: `${(tipX / W) * 100}%`, transform: 'translateX(-50%)', background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.surface, borderRadius: 10, padding: '6px 10px', fontSize: 11, lineHeight: 1.35, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: sel ? 1 : 0, transition: 'opacity 120ms', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontText, maxWidth: '96%', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {sel && (tooltip ? tooltip(sel, i) : tipDefault(sel))}
      </div>
    </div>
  );
}

/** Leyenda chica para debajo de la gráfica: [{ label, color, dash? }] + texto a la derecha. */
export function LeyendaScrub({ items = [], derecha }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 12, fontSize: 11, color: theme.textMuted, padding: '2px 4px 4px', flexWrap: 'wrap', alignItems: 'center' }}>
      {items.map((it) => (
        <span key={it.label}><i style={{ display: 'inline-block', width: 10, height: it.dash ? 0 : 3, borderRadius: 2, background: it.dash ? 'transparent' : it.color, borderTop: it.dash ? `2px dashed ${it.color}` : undefined, verticalAlign: 'middle', marginRight: 5 }} />{it.label}</span>
      ))}
      {derecha && <span style={{ marginLeft: 'auto' }}>{derecha}</span>}
    </div>
  );
}
