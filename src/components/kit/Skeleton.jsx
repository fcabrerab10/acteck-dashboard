// Skeleton con brillo 1.3 s · sustituye al loader central cuando la estructura ya se conoce.
import React from 'react';
import { useTheme } from '../../lib/themeContext';
import { SILUETAS } from './siluetas';

export default function Skeleton({ w = '100%', h = 12, r = 6, style }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const a = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', b = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  return (
    <>
      <style>{`@keyframes kitShimmer{to{background-position:-200% 0}}`}</style>
      <span style={{ display: 'block', width: w, height: h, borderRadius: r, background: `linear-gradient(90deg, ${a} 25%, ${b} 50%, ${a} 75%)`, backgroundSize: '200% 100%', animation: 'kitShimmer 1.3s linear infinite', ...style }} />
    </>
  );
}

// ── Silueta paramétrica ─────────────────────────────────────────────────
// `silueta` = arreglo de filas con las mismas dimensiones que el kit real:
//   { tipo:'hero',  stats? }                 Hero: 88 px, radio 12 (banda oscura + N stats a la derecha)
//   { tipo:'kpis',  n, cols? }               fila de KpiCard: 82 px cada una (repeat(n,1fr) o `cols` literal)
//   { tipo:'panel', lineas?, alto?, titulo? } Panel: cabecera 38 px + N líneas de 11 px (o alto fijo)
//   { tipo:'tabla', filas?, cols?, alto? }   TablaCompacta: header 26 px + filas de 26 px
//   { tipo:'grid',  cols, items:[fila…] }    columnas de paneles/tablas lado a lado (cols = gridTemplateColumns)
//   { tipo:'fila',  alto?, items? }          barra de controles (Segmented/filtros): 30 px por defecto
//   { tipo:'chart', alto? }                  área de gráfica dentro de un panel (barras verticales)
// `gap` opcional por fila para separar del siguiente bloque (10 px por defecto, como las pantallas del kit).
const ANCHOS = [60, 85, 70, 90, 55, 78, 64, 88, 72, 50, 82, 66];

function Lineas({ n = 5, offset = 0 }) {
  return Array.from({ length: n }, (_, i) => <Skeleton key={i} w={`${ANCHOS[(i + offset) % ANCHOS.length]}%`} h={11} />);
}

function Caja({ theme, children, style, padding = 12 }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0, boxSizing: 'border-box', ...style }}>
      {children}
    </div>
  );
}

function HeroSk({ theme, stats = 0 }) {
  // Card inversa (negra en Claro/Marfil): el shimmer va claro encima.
  const bg = theme.surfaceInverse || '#000';
  const sh = { background: 'rgba(255,255,255,0.10)', animation: 'none' };
  return (
    <div style={{ background: bg, borderRadius: 12, height: 88, padding: '14px 18px', display: 'grid', gridTemplateColumns: `minmax(0,1fr) repeat(${stats}, auto)`, gap: 20, alignItems: 'center', boxSizing: 'border-box' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7, minWidth: 0 }}>
        <Skeleton w={120} h={9} style={sh} />
        <Skeleton w="42%" h={18} r={6} style={sh} />
        <Skeleton w="60%" h={10} style={sh} />
      </div>
      {Array.from({ length: stats }, (_, i) => (
        <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 6 }}>
          <Skeleton w={56} h={9} style={sh} />
          <Skeleton w={84} h={18} r={6} style={sh} />
        </div>
      ))}
    </div>
  );
}

function KpiSk({ theme }) {
  return (
    <Caja theme={theme} padding="12px 14px" style={{ height: 82, gap: 0, justifyContent: 'space-between' }}>
      <Skeleton w="55%" h={9} />
      <Skeleton w="48%" h={20} r={6} />
      <Skeleton w="70%" h={9} />
    </Caja>
  );
}

function PanelSk({ theme, lineas = 5, alto, titulo = true, offset = 0, chart }) {
  return (
    <Caja theme={theme} padding={0} style={{ height: alto, gap: 0 }}>
      {titulo && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', borderBottom: `1px solid ${theme.border}`, height: 38, boxSizing: 'border-box' }}>
          <Skeleton w={140} h={12} />
          <Skeleton w={60} h={9} />
        </div>
      )}
      <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 8, flex: alto ? 1 : undefined, minHeight: 0 }}>
        {chart ? <ChartSk alto={typeof chart === 'number' ? chart : undefined} /> : <Lineas n={lineas} offset={offset} />}
      </div>
    </Caja>
  );
}

function ChartSk({ alto = 160 }) {
  const barras = [55, 70, 40, 85, 65, 95, 50, 75, 60, 88, 45, 70];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: alto, padding: '0 4px' }}>
      {barras.map((p, i) => <Skeleton key={i} h={`${p}%`} r={4} style={{ flex: 1, width: 'auto' }} />)}
    </div>
  );
}

function TablaSk({ theme, filas = 8, cols = 6, alto }) {
  const widths = Array.from({ length: cols }, (_, i) => (i === 0 ? '2fr' : '1fr')).join(' ');
  const Row = ({ header, i }) => (
    <div style={{ display: 'grid', gridTemplateColumns: widths, gap: 12, alignItems: 'center', height: 26, padding: '0 8px', borderBottom: `1px solid ${theme.border}`, boxSizing: 'border-box' }}>
      {Array.from({ length: cols }, (_, c) => <Skeleton key={c} w={header ? '60%' : `${c === 0 ? 75 : ANCHOS[(i + c) % ANCHOS.length] - 20}%`} h={header ? 8 : 10} style={{ justifySelf: c === 0 ? 'start' : 'end' }} />)}
    </div>
  );
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden', height: alto, boxSizing: 'border-box' }}>
      <Row header i={0} />
      {Array.from({ length: filas }, (_, i) => <Row key={i} i={i + 1} />)}
    </div>
  );
}

function FilaSk({ items = 3, alto = 30 }) {
  const ws = [160, 110, 90, 130, 100, 80];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, height: alto }}>
      {Array.from({ length: items }, (_, i) => <Skeleton key={i} w={ws[i % ws.length]} h={alto - 4} r={8} />)}
    </div>
  );
}

function Bloque({ fila, theme, idx = 0 }) {
  switch (fila.tipo) {
    case 'hero': return <HeroSk theme={theme} stats={fila.stats ?? 0} />;
    case 'kpis': {
      const n = fila.n ?? 4;
      return (
        <div style={{ display: 'grid', gridTemplateColumns: fila.cols || `repeat(${n}, minmax(0,1fr))`, gap: 8 }}>
          {Array.from({ length: n }, (_, i) => <KpiSk key={i} theme={theme} />)}
        </div>
      );
    }
    case 'panel': return <PanelSk theme={theme} lineas={fila.lineas} alto={fila.alto} titulo={fila.titulo !== false} offset={idx} chart={fila.chart} />;
    case 'chart': return <PanelSk theme={theme} alto={fila.alto} titulo={fila.titulo !== false} chart={fila.altoChart || true} />;
    case 'tabla': return <TablaSk theme={theme} filas={fila.filas} cols={fila.cols} alto={fila.alto} />;
    case 'fila': return <FilaSk items={fila.items} alto={fila.alto} />;
    case 'grid': {
      const items = fila.items || [];
      return (
        <div style={{ display: 'grid', gridTemplateColumns: fila.cols || `repeat(${items.length}, minmax(0,1fr))`, gap: fila.gap ?? 10, alignItems: fila.align || 'start' }}>
          {items.map((it, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
              {(Array.isArray(it) ? it : [it]).map((sub, j) => <Bloque key={j} fila={sub} theme={theme} idx={idx + i + j} />)}
            </div>
          ))}
        </div>
      );
    }
    default: return null;
  }
}

export function SkeletonPantalla({ silueta, pantalla, style }) {
  const { theme } = useTheme();
  const filas = silueta || SILUETAS[pantalla] || SILUETAS.default;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      {filas.map((f, i) => <div key={i} style={f.gap != null ? { marginBottom: f.gap - 10 } : undefined}><Bloque fila={f} theme={theme} idx={i} /></div>)}
    </div>
  );
}
