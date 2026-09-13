// Mapa de México por estado · Sell Out consolidado.
//
// Geometría: `mexico-estados.json` — fronteras reales de los 32 estados, simplificadas
// (Douglas-Peucker) y ya proyectadas a un viewBox de 1000 de ancho, con los nombres en
// MAYÚSCULAS SIN ACENTOS iguales a los que devuelve normalizar_estado_mx() en Postgres.
// Origen y tamaño: ver el reporte de la migración 20260912_sellout_global_*.
//
// Esta pieza sólo pinta y avisa: los tres modos (Medir · Cuentas · Tiempo), el ranking y
// las listas viven en PanelMapa.jsx, y el cálculo en calculo.js.
//
// Interacción: color por la medida elegida, hover con ficha junto al cursor, clic que
// selecciona el estado (y filtra la pantalla entera).
// "Sin estado" no es un estado del mapa: va como fila aparte con su porcentaje.
import React, { useMemo, useRef, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Segmented, Pill } from '../../../components/kit';
import { capitalizarEstado, fmtMoney, fmtInt, fmtPct, fmtSigno } from './textos';
import GEO from './mexico-estados.json';

/** Las seis medidas del modo Medir. `ticketCf` y `cuentas` salen de porEstado(). */
export const MEDIDAS_MAPA = [
  { id: 'importe', label: 'Sell out' },
  { id: 'yoy', label: 'Δ vs año pasado' },
  { id: 'clientes', label: 'Clientes finales' },
  { id: 'ticketCf', label: '$ por cliente' },
  { id: 'cuentas', label: 'Cuentas activas' },
  { id: 'vendedores', label: 'Vendedores' },
];

/** Los 32 nombres del mapa, para calcular huecos sin meter la geometría en calculo.js. */
export const ESTADOS_MX = GEO.estados.map((g) => g.nombre);

const VB = GEO.viewBox.split(' ').map(Number);
const ALTO_VB = VB[3];
const ANCHO_VB = VB[2];
const DIVERGENTE = new Set(['yoy']);

/** Escala de color: azul para magnitudes, rojo↔verde para Δ. Funciona en Midnight. */
export function colorDe(valor, max, min, medida, theme) {
  const dark = theme.mode === 'dark';
  const vacio = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';
  if (valor == null || !Number.isFinite(valor)) return vacio;
  if (DIVERGENTE.has(medida)) {
    if (valor === 0) return vacio;
    const tope = Math.max(Math.abs(max ?? 0), Math.abs(min ?? 0), 1);
    const t = Math.min(1, Math.abs(valor) / tope);
    const base = valor >= 0 ? (dark ? '48,209,88' : '52,199,89') : (dark ? '255,69,58' : '255,59,48');
    return `rgba(${base},${(0.12 + t * 0.78).toFixed(3)})`;
  }
  if (!max || valor <= 0) return vacio;
  // Raíz cuadrada: sin ella Jalisco deja al resto del país en blanco.
  const t = Math.min(1, Math.sqrt(valor / max));
  const base = dark ? '100,210,255' : '0,122,255';
  return `rgba(${base},${(0.10 + t * 0.82).toFixed(3)})`;
}

export const valorDe = (e, medida) => {
  if (!e) return null;
  if (medida === 'yoy') return e.yoy;
  if (medida === 'clientes') return e.clientes;
  if (medida === 'vendedores') return e.vendedores;
  if (medida === 'cuentas') return e.cuentasActivas;
  if (medida === 'ticketCf') return e.ticketCf;
  return e.importe;
};
export const fmtValor = (v, medida) => {
  if (v == null || !Number.isFinite(v)) return '—';
  if (medida === 'yoy') return fmtSigno(v);
  if (medida === 'importe' || medida === 'ticketCf') return fmtMoney(v);
  return fmtInt(v);
};

/**
 * @param {Array}  datos     salida de calculo.porEstado(): [{ estado, importe, importePrev, yoy, pct, clientes, vendedores, cuentas, cuentasActivas, ticketCf }]
 * @param {string} seleccion estado seleccionado (o null)
 * @param {fn}     onSelect  (estado|null) → void
 * @param {string} medida    controlada desde fuera; si se omite, el mapa trae su propio Segmented
 * @param {object} escala    { max, min } forzada (small multiples comparten escala)
 * @param {Set}    huecosSet estados a pintar como "hueco" (naranja) en el modo Cuentas
 * @param {fn}     ficha     (estado, dato) → nodo extra dentro del tooltip
 * @param {Map}    burbujas  estado → número: círculo proporcional encima del estado
 */
export default function MapaMexico({
  datos = [], seleccion = null, onSelect, medida: medidaProp, onMedida, medidas = MEDIDAS_MAPA,
  alto = 380, compacto = false, mini = false, topSku, escala = null, huecosSet = null,
  ficha, onHover, resaltado = null, burbujas = null, leyenda: leyendaProp,
}) {
  const { theme } = useTheme();
  const [medidaInterna, setMedidaInterna] = useState('importe');
  const medida = medidaProp ?? medidaInterna;
  const setMedida = onMedida ?? setMedidaInterna;
  const [hover, setHover] = useState(null); // { nombre, x, y } en px dentro de la caja
  const cajaRef = useRef(null);
  const leyenda = leyendaProp ?? !mini;

  const { porEstado, max, min, sinEstado } = useMemo(() => {
    const m = new Map();
    let sin = null;
    for (const d of datos) {
      if (d.estado === 'SIN ESTADO') { sin = d; continue; }
      m.set(d.estado, d);
    }
    const vals = [...m.values()].map((e) => valorDe(e, medida)).filter((v) => v != null && Number.isFinite(v));
    return {
      porEstado: m,
      max: escala?.max ?? (vals.length ? Math.max(...vals) : 0),
      min: escala?.min ?? (vals.length ? Math.min(...vals) : 0),
      sinEstado: sin,
    };
  }, [datos, medida, escala]);

  const activo = hover?.nombre || resaltado || seleccion;
  const datoActivo = activo ? porEstado.get(activo) : null;
  const conDato = [...porEstado.values()].filter((e) => e.importe > 0).length;

  const maxBurbuja = useMemo(() => (burbujas ? Math.max(1, ...[...burbujas.values()].map((v) => Number(v) || 0)) : 0), [burbujas]);

  const entrar = (g, ev) => {
    const caja = cajaRef.current?.getBoundingClientRect();
    setHover({
      nombre: g.nombre,
      x: caja ? ev.clientX - caja.left : (g.cx / ANCHO_VB) * (caja?.width || 0),
      y: caja ? ev.clientY - caja.top : (g.cy / ALTO_VB) * (caja?.height || 0),
    });
    onHover?.(g.nombre);
  };
  const salir = () => { setHover(null); onHover?.(null); };

  const anchoCaja = cajaRef.current?.clientWidth || 0;

  return (
    <div style={{ fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column', gap: mini ? 4 : 8, minWidth: 0 }}>
      {!compacto && !mini && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Segmented options={medidas} value={medida} onChange={setMedida} />
          <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {conDato} estado{conDato === 1 ? '' : 's'} con venta
          </span>
          {seleccion && (
            <Pill tone="blue" size="xs" onClick={() => onSelect?.(null)} style={{ cursor: 'pointer' }}>
              {capitalizarEstado(seleccion)} ✕
            </Pill>
          )}
        </div>
      )}

      <div ref={cajaRef} style={{ position: 'relative', width: '100%', minWidth: 0 }} onMouseLeave={salir}>
        <svg viewBox={GEO.viewBox} role="img" aria-label="Mapa de México por estado"
          style={{ width: '100%', height: alto, display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet">
          {GEO.estados.map((g) => {
            const d = porEstado.get(g.nombre);
            const v = valorDe(d, medida);
            const sel = seleccion === g.nombre;
            const hov = activo === g.nombre;
            const hueco = huecosSet?.has(g.nombre);
            return (
              <path key={g.nombre} d={g.d}
                fill={hueco ? (theme.mode === 'dark' ? 'rgba(255,159,10,0.30)' : 'rgba(255,149,0,0.26)') : colorDe(v, max, min, medida, theme)}
                stroke={sel ? theme.text : hov ? (theme.accent || '#007AFF') : hueco ? (theme.orange || '#FF9500') : theme.border}
                strokeWidth={sel ? 2.2 : hov ? 1.8 : 0.6}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'fill 200ms, stroke 160ms' }}
                onMouseEnter={(ev) => entrar(g, ev)}
                onMouseMove={(ev) => entrar(g, ev)}
                onClick={onSelect ? () => onSelect(sel ? null : g.nombre) : undefined}>
                <title>{`${capitalizarEstado(g.nombre)} · ${fmtValor(v, medida)}`}</title>
              </path>
            );
          })}

          {/* Burbujas opcionales (clientes finales) encima del relleno. */}
          {burbujas && GEO.estados.map((g) => {
            const v = Number(burbujas.get(g.nombre)) || 0;
            if (v <= 0) return null;
            const r = 4 + Math.sqrt(v / maxBurbuja) * 26;
            return <circle key={`b-${g.nombre}`} cx={g.cx} cy={g.cy} r={r} pointerEvents="none"
              fill={theme.mode === 'dark' ? 'rgba(255,214,10,0.34)' : 'rgba(255,149,0,0.32)'}
              stroke={theme.orange || '#FF9500'} strokeWidth={0.8} vectorEffect="non-scaling-stroke" />;
          })}

          {/* Punto en el centroide del estado activo. */}
          {activo && GEO.estados.some((g) => g.nombre === activo) && (() => {
            const g = GEO.estados.find((x) => x.nombre === activo);
            return (
              <g pointerEvents="none">
                <circle cx={g.cx} cy={g.cy} r={4} fill={theme.accent || '#007AFF'} stroke={theme.surface} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })()}
        </svg>

        {/* Ficha (HTML, no SVG: así hereda tipografía y tema). Sigue al cursor, sin salirse de la caja. */}
        {activo && !mini && (
          <div style={{
            position: 'absolute',
            left: Math.max(6, Math.min((anchoCaja || 600) - 6, hover?.x ?? ((GEO.estados.find((g) => g.nombre === activo)?.cx ?? 500) / ANCHO_VB) * (anchoCaja || 600))),
            top: hover?.y ?? ((GEO.estados.find((g) => g.nombre === activo)?.cy ?? 300) / ALTO_VB) * alto,
            transform: 'translate(-50%, calc(-100% - 12px))', pointerEvents: 'none', zIndex: 2,
            background: theme.surfaceInverse || '#000', color: theme.textOnInverse || '#F5F5F7',
            borderRadius: 10, padding: '8px 11px', fontSize: 10.5, lineHeight: 1.5, maxWidth: 260,
            boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
          }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 11.5 }}>{capitalizarEstado(activo)}</div>
            {datoActivo ? (
              <>
                <div style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {fmtMoney(datoActivo.importe)} · {fmtPct(datoActivo.pct)} del total
                </div>
                <div style={{ opacity: 0.72, fontVariantNumeric: 'tabular-nums' }}>
                  {datoActivo.yoy == null ? 'sin comparativo' : `${fmtSigno(datoActivo.yoy)} vs el año pasado`}
                  {datoActivo.clientes ? ` · ${fmtInt(datoActivo.clientes)} clientes finales` : ''}
                  {datoActivo.vendedores ? ` · ${fmtInt(datoActivo.vendedores)} vendedores` : ''}
                </div>
                {/* mv_sellout_estado_mes no trae SKU ni marca: no hay "top SKU del estado".
                    Lo más cercano que sí existe es el reparto por cuenta. */}
                {ficha?.(activo, datoActivo)}
                {topSku?.(activo) && <div style={{ opacity: 0.72 }}>Top SKU: {topSku(activo)}</div>}
              </>
            ) : (
              <div style={{ opacity: 0.72 }}>{huecosSet?.has(activo) ? 'Hueco: nadie del grupo vende aquí' : 'Sin venta registrada este mes'}</div>
            )}
          </div>
        )}
      </div>

      {/* Leyenda de 3 marcas. */}
      {leyenda && (
        <Leyenda medida={medida} max={max} min={min} theme={theme} />
      )}

      {/* Sin estado: no es un estado del mapa, va como fila aparte. */}
      {!mini && sinEstado && sinEstado.importe > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          padding: '6px 10px', borderRadius: 9, border: `1px dashed ${theme.border}`, fontSize: 11 }}>
          <span style={{ color: theme.textMuted }}>Sin estado en la fuente</span>
          <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ fontFamily: TYPO.fontDisplay }}>{fmtMoney(sinEstado.importe)}</span>
            <Pill tone={sinEstado.pct > 25 ? 'orange' : 'gray'} size="xs">{fmtPct(sinEstado.pct)} del total</Pill>
          </span>
        </div>
      )}
    </div>
  );
}

/** Barra de color con tres marcas (mínimo · medio · máximo). */
function Leyenda({ medida, max, min, theme }) {
  const div = DIVERGENTE.has(medida);
  const tope = div ? Math.max(Math.abs(max || 0), Math.abs(min || 0)) : max;
  const marcas = div ? [-tope, 0, tope] : [0, (max || 0) / 2, max || 0];
  const grad = div
    ? `linear-gradient(90deg, ${colorDe(-tope, tope, -tope, medida, theme)}, ${colorDe(0, tope, -tope, medida, theme)}, ${colorDe(tope, tope, -tope, medida, theme)})`
    : `linear-gradient(90deg, ${colorDe(0, max, min, medida, theme)}, ${colorDe((max || 0) * 0.25, max, min, medida, theme)}, ${colorDe(max, max, min, medida, theme)})`;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
      <div style={{ flex: 1, minWidth: 0, height: 6, borderRadius: 999, background: grad, border: `1px solid ${theme.border}` }} />
      <div style={{ display: 'flex', gap: 10, fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
        {marcas.map((v, i) => <span key={i}>{fmtValor(v, medida)}</span>)}
      </div>
    </div>
  );
}
