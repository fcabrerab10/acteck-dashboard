// Inicio móvil · «<año> frente a <año-1>» (2026-10-05, propuesta A elegida por Fernando: «muy importante que el
// desplazamiento dentro de la gráfica sea muy bueno»). SVG con 2026 (área + línea), año anterior y cuota punteada.
// Se lee arrastrando el dedo: `touch-action: pan-y` deja que el scroll vertical siga siendo de la página y el
// movimiento horizontal engancha mes a mes (vibración corta si el equipo la tiene). Tocar sin arrastrar elige el mes.
import React, { useRef, useState, useCallback } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';

const W = 340, H = 176, L = 10, R = 10, T = 26, B = 22;

export default function GraficaScrub({ meses, anio, formato, mesActivo, onMes }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const [i, setI] = useState(null);
  const moved = useRef(false);
  const vals = meses.flatMap((m) => [m.fn, m.prev, m.cuota]).filter((v) => v != null && Number.isFinite(v));
  const max = Math.max(1, ...vals) * 1.08;
  const n = meses.length || 12;
  const x = (k) => L + (k * (W - L - R)) / Math.max(1, n - 1);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const path = (key) => { let d = ''; meses.forEach((m, k) => { const v = m[key]; if (v == null) return; d += `${d ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`; }); return d; };
  const last = meses.reduce((u, m, k) => (m.fn != null ? k : u), -1);
  const area = last >= 0 ? `M${x(0)},${y(0)}${meses.slice(0, last + 1).map((m, k) => (m.fn != null ? `L${x(k).toFixed(1)},${y(m.fn).toFixed(1)}` : '')).join('')}L${x(last)},${y(0)}Z` : '';
  const gris = theme.mode === 'dark' ? '#8E8E93' : '#AEAEB2';

  const indiceDe = useCallback((e) => {
    const svg = ref.current; if (!svg) return null;
    const rect = svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    return Math.max(0, Math.min(n - 1, Math.round((px - L) / ((W - L - R) / Math.max(1, n - 1)))));
  }, [n]);
  const mostrar = (k) => { if (k == null || k === i) return; setI(k); try { if (navigator.vibrate) navigator.vibrate(4); } catch { /* sin háptico */ } };
  const onDown = (e) => { moved.current = false; try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ya capturado */ } mostrar(indiceDe(e)); };
  const onMove = (e) => { if (e.pointerType === 'mouse' && !e.buttons) { mostrar(indiceDe(e)); return; } moved.current = true; mostrar(indiceDe(e)); };
  const onUp = (e) => { const k = indiceDe(e); if (!moved.current && k != null && onMes && meses[k]?.fn != null) onMes(k + 1); setTimeout(() => setI(null), 900); };
  const sel = i != null ? meses[i] : null;
  const tipX = i != null ? Math.max(78, Math.min(W - 78, x(i))) : 0;

  return (
    <div style={{ position: 'relative', touchAction: 'pan-y', userSelect: 'none', WebkitUserSelect: 'none' }}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={() => setI(null)} onPointerLeave={() => setTimeout(() => setI(null), 500)}>
      <svg ref={ref} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', width: '100%', height: 'auto' }}>
        <defs><linearGradient id="inicio-area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={theme.accent} stopOpacity=".3" /><stop offset="1" stopColor={theme.accent} stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75, 1].map((k) => <line key={k} x1={L} x2={W - R} y1={y(max * k)} y2={y(max * k)} stroke={theme.border} strokeWidth="1" />)}
        {area && <path d={area} fill="url(#inicio-area)" />}
        <path d={path('cuota')} fill="none" stroke={theme.orange} strokeWidth="1.5" strokeDasharray="4 4" strokeLinecap="round" />
        <path d={path('prev')} fill="none" stroke={gris} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path('fn')} fill="none" stroke={theme.accent} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        {mesActivo != null && i == null && meses[mesActivo]?.fn != null && <circle cx={x(mesActivo)} cy={y(meses[mesActivo].fn)} r="4.5" fill={theme.accent} stroke={theme.surface} strokeWidth="2" />}
        {sel && (
          <g>
            <line x1={x(i)} x2={x(i)} y1={T - 8} y2={H - B + 2} stroke={theme.text} strokeOpacity=".35" strokeWidth="1" />
            {sel.prev != null && <circle cx={x(i)} cy={y(sel.prev)} r="4" fill={gris} stroke={theme.surface} strokeWidth="2" />}
            {sel.fn != null && <circle cx={x(i)} cy={y(sel.fn)} r="5" fill={theme.accent} stroke={theme.surface} strokeWidth="2" />}
          </g>
        )}
        {meses.map((m, k) => <text key={k} x={x(k)} y={H - 6} textAnchor="middle" fontSize="9" fill={theme.textMuted} fontFamily={TYPO.fontText}>{String(m.label || '').slice(0, 1)}</text>)}
      </svg>
      <div aria-live="polite" style={{ position: 'absolute', top: 0, left: `${(tipX / W) * 100}%`, transform: 'translateX(-50%)', background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.surface, borderRadius: 10, padding: '6px 10px', fontSize: 11, lineHeight: 1.35, whiteSpace: 'nowrap', pointerEvents: 'none', opacity: sel ? 1 : 0, transition: 'opacity 120ms', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontText }}>
        {sel && (
          <>
            <b style={{ fontSize: 12.5 }}>{sel.label}{sel.enCurso ? ' ·' : ''}</b> · {anio} <b style={{ fontSize: 12.5 }}>{sel.fn != null ? formato(sel.fn) : '—'}</b>{sel.pct != null ? ` · ${Math.round(sel.pct)}% cuota` : ''}<br />
            {anio - 1} {sel.prev != null ? formato(sel.prev) : '—'}{sel.yoy != null ? <> · <span style={{ color: sel.yoy >= 0 ? theme.green : theme.red }}>{sel.yoy >= 0 ? '+' : ''}{Math.round(sel.yoy)}%</span></> : null}{sel.cuota ? ` · cuota ${formato(sel.cuota)}` : ''}
          </>
        )}
      </div>
    </div>
  );
}
