// GraficaLineas · Kit V3 · la única gráfica de evolución mensual del dashboard (estilo B "Bolsa" con la
// línea de A: trazo 2.4 px con relleno degradado bajo la serie principal). Recharts ComposedChart sin animación.
//
// datos:  [{ x: 'Ene', actual, anterior, cuota, cuotaMin?, … }]  (x = etiqueta del eje; el resto son claves de `series`)
// series: [{ key, label, tipo: 'principal' | 'anterior' | 'cuota' | 'linea', color?, dash?, eje?: 'izq' | 'der', formato? }]
//   principal → área + puntos + máx/mín · anterior → gris punteado 4 4 · cuota → verde punteado 2 4 · linea → color libre.
//   eje 'der' pinta la serie contra un segundo eje oculto (p. ej. MC % junto a pesos).
// formato:         fn(valor) → texto (default moneyCompact). Se usa en pastillas, anotaciones y eje.
// alto:            px (default 240). compacto: sin anotaciones, sin eje Y, sin leyenda ni cabecera (tarjetas chicas / móvil).
// mesActivo:       índice a resaltar (punto grande + etiqueta del eje en negritas).
// mesesAtenuados:  índices fuera de la selección de trimestres → los puntos bajan a opacidad .35 y un velo del color
//                  de la superficie (overlay absoluto sobre el SVG) deja la zona al 35 %.
// onClickMes(i):   clic en un mes. mostrarMinMax (default true). puntos (default: datos.length <= 24).
// titulo/meta/acciones: si se pasan, envuelve en Panel y la cabecera de valores va en `acciones`.
// Cabecera de valores: pastillas con el mes bajo el cursor (o mesActivo, o el último con dato): principal (azul),
// anterior (gris), cuota (verde), las demás series (gris) y Δ % vs anterior (DeltaPill). No hay tooltip flotante:
// el cursor es una guía vertical punteada y la cabecera hace de lectura del mes.
import React, { useEffect, useId, useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid, LabelList, useXAxisScale, usePlotArea, useActiveTooltipLabel } from 'recharts';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { moneyCompact } from '../../lib/format';
import Panel from './Panel';
import Pill, { DeltaPill } from './Pill';

const OPACIDAD_ATENUADO = 0.35;
const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));

/** Colores y trazo de cada tipo de serie a partir del tema. */
function estiloSerie(theme, s, i) {
  const libres = [theme.orange, theme.purple, theme.pink, theme.teal, theme.indigo].filter(Boolean);
  switch (s.tipo) {
    case 'principal': return { color: s.color || theme.accent, width: 2.4, dash: s.dash };
    case 'anterior':  return { color: s.color || theme.textMuted, width: 1.6, dash: s.dash || '4 4' };
    case 'cuota':     return { color: s.color || theme.green, width: 1.6, dash: s.dash || '2 4' };
    default:          return { color: s.color || libres[i % libres.length] || theme.orange, width: 1.6, dash: s.dash };
  }
}

/** Mide la zona de los meses atenuados y la reporta al padre (Recharts pinta sus hijos desconocidos por
 *  debajo de las series, así que el velo se dibuja fuera del SVG, como overlay absoluto). Hooks de Recharts 3. */
/** Reporta al padre el mes bajo el cursor. En Recharts 3 el estado de `onMouseMove` ya no trae
 *  `activeTooltipIndex`: el dato vive en el store y se lee con este hook. */
function MideHover({ onHover }) {
  const label = useActiveTooltipLabel();
  useEffect(() => { onHover(label == null ? null : String(label)); }, [label]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function MideBandas({ indices, etiquetas, onMedir }) {
  const escala = useXAxisScale();
  const area = usePlotArea();
  let rects = [];
  if (escala && area && indices.length && etiquetas.length >= 2) {
    const x0 = escala(etiquetas[0]), x1 = escala(etiquetas[1]);
    if (x0 != null && x1 != null) {
      const paso = Math.abs(x1 - x0), n = etiquetas.length;
      const tramos = [];
      [...indices].sort((a, b) => a - b).forEach((i) => {
        const t = tramos[tramos.length - 1];
        if (t && t.fin === i - 1) t.fin = i; else tramos.push({ ini: i, fin: i });
      });
      rects = tramos.map((t) => {
        const xi = escala(etiquetas[t.ini]), xf = escala(etiquetas[t.fin]);
        if (xi == null || xf == null) return null;
        const izq = t.ini === 0 ? area.x : xi - paso / 2;
        const der = t.fin === n - 1 ? area.x + area.width : xf + paso / 2;
        return { x: izq, y: area.y, w: Math.max(0, der - izq), h: area.height };
      }).filter(Boolean);
    }
  }
  const firma = JSON.stringify(rects);
  useEffect(() => { onMedir(rects); }, [firma]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

export default function GraficaLineas({
  datos = [], series = [], formato = moneyCompact, alto = 240, mesActivo = null, mesesAtenuados = null, onClickMes,
  compacto = false, mostrarMinMax = true, puntos, titulo, meta, acciones, desdeCero = true, leyenda, cabecera, style,
  mini = false, // trazo del kit en miniatura (sparkline): sin ejes, sin cuadrícula, sin cursor; sólo área + línea + punto final
}) {
  const { theme } = useTheme();
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const [etiquetaHover, setEtiquetaHover] = useState(null);
  const [velo, setVelo] = useState([]);

  const principal = series.find((s) => s.tipo === 'principal') || series[0];
  const anterior = series.find((s) => s.tipo === 'anterior');
  const cuotas = series.filter((s) => s.tipo === 'cuota');
  const otras = series.filter((s) => s !== principal && s !== anterior && s.tipo !== 'cuota');
  const etiquetas = useMemo(() => datos.map((d) => String(d.x ?? '')), [datos]);
  const atenuados = useMemo(() => new Set(mesesAtenuados || []), [mesesAtenuados]);
  const conPuntos = mini ? false : (puntos ?? datos.length <= 24);
  const conEjeDer = series.some((s) => s.eje === 'der');
  if (mini) compacto = true;
  const verLeyenda = mini ? false : (leyenda ?? !compacto);
  const verCabecera = mini ? false : (cabecera ?? !compacto);

  // Último mes con dato en la principal · máximo y mínimo (sólo entre valores no nulos).
  const { ultimo, idxMax, idxMin } = useMemo(() => {
    let ultimo = -1, idxMax = -1, idxMin = -1;
    if (!principal) return { ultimo, idxMax, idxMin };
    datos.forEach((d, i) => {
      const v = num(d[principal.key]);
      if (v == null) return;
      ultimo = i;
      if (idxMax < 0 || v > num(datos[idxMax][principal.key])) idxMax = i;
      if (idxMin < 0 || v < num(datos[idxMin][principal.key])) idxMin = i;
    });
    return { ultimo, idxMax, idxMin };
  }, [datos, principal]);

  const mesHover = etiquetaHover == null ? -1 : etiquetas.indexOf(etiquetaHover);
  const idxCab = mesHover >= 0 ? mesHover : (mesActivo != null && mesActivo >= 0 && mesActivo < datos.length ? mesActivo : ultimo);
  const fila = idxCab >= 0 ? datos[idxCab] : null;
  const fmtDe = (s) => s?.formato || formato;

  // Cabecera de valores (pastillas) · principal, anterior, cuota(s) y Δ % vs anterior.
  const pastillas = verCabecera && fila && principal ? (() => {
    const vp = num(fila[principal.key]), va = anterior ? num(fila[anterior.key]) : null;
    const delta = vp != null && va != null && va !== 0 ? ((vp - va) / Math.abs(va)) * 100 : null;
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', justifyContent: titulo ? 'flex-start' : 'flex-end', minWidth: 0 }}>
        <Pill tone="blue" size="xs">{fila.x} · {vp == null ? '—' : fmtDe(principal)(vp)}</Pill>
        {anterior && <Pill tone="gray" size="xs">{anterior.label} · {va == null ? '—' : fmtDe(anterior)(va)}</Pill>}
        {cuotas.map((c) => { const v = num(fila[c.key]); return v == null ? null : <Pill key={c.key} tone="green" size="xs">{c.label} · {fmtDe(c)(v)}</Pill>; })}
        {otras.map((l) => { const v = num(fila[l.key]); return v == null ? null : <Pill key={l.key} tone="gray" size="xs">{l.label} · {fmtDe(l)(v)}</Pill>; })}
        {anterior && delta != null && <DeltaPill value={delta} digits={1} />}
      </div>
    );
  })() : null;

  const tick = { fontSize: compacto ? 9 : 10, fill: theme.textMuted, fontFamily: TYPO.fontDisplay };
  const ejeYFmt = (v) => String(formato(v)).replace('$', '');
  const tickX = (p) => {
    const { x, y, payload, index } = p;
    const i = index ?? etiquetas.indexOf(payload?.value);
    const activo = mesActivo != null && i === mesActivo;
    return (
      <text x={x} y={y + 10} textAnchor="middle" fontSize={tick.fontSize} fontFamily={TYPO.fontDisplay}
        fill={activo ? theme.text : theme.textMuted} fontWeight={activo ? 700 : 500} opacity={atenuados.has(i) ? OPACIDAD_ATENUADO + 0.25 : 1}>
        {payload?.value}
      </text>
    );
  };

  // Punto de la serie principal: r 3.5 con borde surface · último y activo r 5 · atenuados al .35.
  const puntoPrincipal = (color) => (p) => {
    const { cx, cy, index, value } = p;
    if (cx == null || cy == null || value == null || Number.isNaN(cy)) return <g key={`p-${index}`} />;
    const grande = index === ultimo || index === mesActivo;
    return (
      <circle key={`p-${index}`} cx={cx} cy={cy} r={grande ? 5 : 3.5} fill={color} stroke={theme.surface} strokeWidth={grande ? 2 : 1.5}
        opacity={atenuados.has(index) ? OPACIDAD_ATENUADO : 1} />
    );
  };
  const puntoActivo = (color) => (p) => {
    const { cx, cy, index, value } = p;
    if (cx == null || cy == null || value == null) return <g key={`a-${index}`} />;
    return <circle key={`a-${index}`} cx={cx} cy={cy} r={5.5} fill={color} stroke={theme.surface} strokeWidth={2} />;
  };

  // Anotación máx / mín sobre la serie principal (LabelList con contenido propio).
  const etiquetaMinMax = (p) => {
    const { x, y, index, value } = p;
    if (x == null || y == null || value == null) return null;
    const esMax = index === idxMax, esMin = index === idxMin;
    if (!esMax && !esMin) return null;
    if (esMax && esMin) return null; // un solo punto: la cabecera ya lo dice
    const anchor = index === 0 ? 'start' : index === datos.length - 1 ? 'end' : 'middle';
    // El mín se anota debajo del punto, salvo que ya esté pegado al eje X: entonces arriba, para no pisar el eje ni otras líneas.
    const pegadoAbajo = y + 16 > alto - 26;
    const ty = esMax || pegadoAbajo ? y - 11 : y + 16;
    return (
      <text x={x} y={ty} textAnchor={anchor} fontSize={9.5} fontFamily={TYPO.fontDisplay} fill={theme.textMuted} fontWeight={500}>
        {esMax ? 'máx' : 'mín'} {formato(value)}
      </text>
    );
  };

  const onClick = (st) => {
    if (!onClickMes) return;
    const n = Number(st?.activeTooltipIndex);
    const i = !Number.isNaN(n) && n >= 0 && n < datos.length ? n : mesHover;
    if (i >= 0 && i < datos.length) onClickMes(i, datos[i]);
  };

  const margen = mini ? { top: 3, right: 4, left: 2, bottom: 2 } : compacto ? { top: 6, right: 8, left: 8, bottom: 0 } : { top: mostrarMinMax ? 18 : 8, right: 12, left: 0, bottom: 0 };
  const grafica = (
    <div style={{ position: 'relative', width: '100%', height: alto, minWidth: 0, fontFamily: TYPO.fontText }}>
      <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 600, height: alto }}>
        <ComposedChart data={datos} margin={margen} onMouseLeave={() => setEtiquetaHover(null)} onClick={onClick}
          style={{ cursor: onClickMes ? 'pointer' : 'default' }}>
          <defs>
            {series.map((s, i) => {
              if (s.tipo !== 'principal') return null;
              const { color } = estiloSerie(theme, s, i);
              return (
                <linearGradient key={s.key} id={`gl-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              );
            })}
          </defs>
          {!mini && <CartesianGrid vertical={false} stroke={theme.border} strokeOpacity={0.6} />}
          <XAxis dataKey="x" hide={mini} tick={tickX} axisLine={false} tickLine={false} interval={compacto && datos.length > 12 ? 'preserveStartEnd' : 0} height={mini ? 0 : compacto ? 18 : 22} />
          <YAxis yAxisId="izq" hide={compacto} tickFormatter={ejeYFmt} tick={tick} axisLine={false} tickLine={false} width={compacto ? 0 : 40}
            tickCount={4} domain={desdeCero ? [0, 'auto'] : ['auto', 'auto']} />
          {conEjeDer && <YAxis yAxisId="der" orientation="right" hide domain={[0, 'auto']} />}
          {!mini && <Tooltip cursor={{ stroke: theme.text, strokeOpacity: 0.5, strokeDasharray: '3 3', strokeWidth: 1 }} content={() => null} isAnimationActive={false} />}
          {series.map((s, i) => {
            const { color, width, dash } = estiloSerie(theme, s, i);
            const eje = s.eje === 'der' ? 'der' : 'izq';
            if (s.tipo === 'principal') {
              return (
                <Area key={s.key} yAxisId={eje} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={width} strokeLinejoin="round" strokeLinecap="round"
                  strokeDasharray={dash} fill={`url(#gl-${uid}-${s.key})`} fillOpacity={1} isAnimationActive={false} connectNulls={false}
                  dot={conPuntos ? puntoPrincipal(color) : mini ? ((pr) => (pr.index === ultimo ? <circle key={pr.index} cx={pr.cx} cy={pr.cy} r={2.6} fill={color} stroke={theme.surface} strokeWidth={1.2} /> : null)) : false} activeDot={mini ? false : puntoActivo(color)}>
                  {!compacto && mostrarMinMax && <LabelList dataKey={s.key} content={etiquetaMinMax} />}
                </Area>
              );
            }
            return (
              <Line key={s.key} yAxisId={eje} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={width} strokeDasharray={dash}
                strokeOpacity={s.tipo === 'anterior' ? 0.9 : 1} dot={false} activeDot={{ r: 4, fill: color, stroke: theme.surface, strokeWidth: 1.5 }}
                isAnimationActive={false} connectNulls />
            );
          })}
          {(verCabecera || onClickMes) && <MideHover onHover={setEtiquetaHover} />}
          {atenuados.size > 0 && <MideBandas indices={[...atenuados]} etiquetas={etiquetas} onMedir={setVelo} />}
        </ComposedChart>
      </ResponsiveContainer>
      {atenuados.size > 0 && velo.map((r, i) => (
        <div key={i} aria-hidden style={{ position: 'absolute', left: r.x, top: r.y, width: r.w, height: r.h,
          background: theme.surface, opacity: 1 - OPACIDAD_ATENUADO, pointerEvents: 'none' }} />
      ))}
    </div>
  );

  const leyendaEl = verLeyenda && series.length > 0 ? (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 10, color: theme.textMuted, fontFamily: TYPO.fontDisplay, fontWeight: 500, marginTop: 4, padding: '0 2px' }}>
      {series.map((s, i) => {
        const { color, dash } = estiloSerie(theme, s, i);
        return (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 14, height: 0, borderTop: `2px ${dash ? (dash.startsWith('2') || dash.startsWith('1') ? 'dotted' : 'dashed') : 'solid'} ${color}` }} />
            {s.label}
          </span>
        );
      })}
    </div>
  ) : null;

  // Las pastillas de lectura van en su propia fila, encima del trazo: nunca en la cabecera del Panel
  // (ahí competían con el título y se encimaban cuando había varias series).
  const cuerpo = (
    <div style={style}>
      {pastillas && <div style={{ display: 'flex', justifyContent: titulo ? 'flex-start' : 'flex-end', marginBottom: 6, minWidth: 0 }}>{pastillas}</div>}
      {grafica}
      {leyendaEl}
    </div>
  );

  if (!titulo) return cuerpo;
  return <Panel titulo={titulo} meta={meta} acciones={acciones}>{cuerpo}</Panel>;
}
