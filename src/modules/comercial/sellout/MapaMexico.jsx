// Mapa de México por estado · Sell Out consolidado.
//
// Geometría: `mexico-estados.json` — fronteras reales de los 32 estados, simplificadas
// (Douglas-Peucker) y ya proyectadas a un viewBox de 1000 de ancho, con los nombres en
// MAYÚSCULAS SIN ACENTOS iguales a los que devuelve normalizar_estado_mx() en Postgres.
// Origen y tamaño: ver el reporte de la migración 20260912_sellout_global_*.
//
// Interacción: color por la medida elegida (sell out · crecimiento · clientes · vendedores),
// hover con tooltip, clic que selecciona el estado (y filtra la tabla / el drill).
// "Sin estado" no es un estado del mapa: va como fila aparte con su porcentaje.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Segmented, Pill } from '../../../components/kit';
import { capitalizarEstado, fmtMoney, fmtInt, fmtPct, fmtSigno } from './textos';
import GEO from './mexico-estados.json';

export const MEDIDAS_MAPA = [
  { id: 'importe', label: 'Sell out' },
  { id: 'yoy', label: 'Crecimiento' },
  { id: 'clientes', label: 'Clientes' },
  { id: 'vendedores', label: 'Vendedores' },
];

const VB = GEO.viewBox.split(' ').map(Number);
const ALTO_VB = VB[3];

/** Escala de color: azul para magnitudes, rojo↔verde para crecimiento. Funciona en Midnight. */
function colorDe(valor, max, min, medida, theme) {
  const dark = theme.mode === 'dark';
  const vacio = dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.045)';
  if (valor == null || !Number.isFinite(valor)) return vacio;
  if (medida === 'yoy') {
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

const valorDe = (e, medida) => {
  if (!e) return null;
  if (medida === 'yoy') return e.yoy;
  if (medida === 'clientes') return e.clientes;
  if (medida === 'vendedores') return e.vendedores;
  return e.importe;
};
const fmtValor = (v, medida) => {
  if (v == null) return '—';
  if (medida === 'yoy') return fmtSigno(v);
  if (medida === 'importe') return fmtMoney(v);
  return fmtInt(v);
};

/**
 * @param {Array}  datos     salida de calculo.porEstado(): [{ estado, importe, importePrev, yoy, pct, clientes, vendedores }]
 * @param {string} seleccion estado seleccionado (o null)
 * @param {fn}     onSelect  (estado|null) → void
 * @param {string} medida    controlada desde fuera; si se omite, el mapa trae su propio Segmented
 */
export default function MapaMexico({ datos = [], seleccion = null, onSelect, medida: medidaProp, onMedida, alto = 380, compacto = false, topSku }) {
  const { theme } = useTheme();
  const [medidaInterna, setMedidaInterna] = useState('importe');
  const medida = medidaProp ?? medidaInterna;
  const setMedida = onMedida ?? setMedidaInterna;
  const [hover, setHover] = useState(null); // { nombre, x, y }

  const { porEstado, max, min, sinEstado, total } = useMemo(() => {
    const m = new Map();
    let sinEstado = null, total = 0;
    for (const d of datos) {
      total += Number(d.importe) || 0;
      if (d.estado === 'SIN ESTADO') { sinEstado = d; continue; }
      m.set(d.estado, d);
    }
    const vals = [...m.values()].map((e) => valorDe(e, medida)).filter((v) => v != null && Number.isFinite(v));
    return { porEstado: m, max: vals.length ? Math.max(...vals) : 0, min: vals.length ? Math.min(...vals) : 0, sinEstado, total };
  }, [datos, medida]);

  const activo = hover?.nombre || seleccion;
  const datoActivo = activo ? porEstado.get(activo) : null;
  const conDato = porEstado.size;

  const alturaSvg = alto;
  const anchoCaja = 1000;

  return (
    <div style={{ fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
      {!compacto && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Segmented options={MEDIDAS_MAPA} value={medida} onChange={setMedida} />
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

      <div style={{ position: 'relative', width: '100%', minWidth: 0 }} onMouseLeave={() => setHover(null)}>
        <svg viewBox={GEO.viewBox} role="img" aria-label="Mapa de México por estado"
          style={{ width: '100%', height: alturaSvg, display: 'block', overflow: 'visible' }}
          preserveAspectRatio="xMidYMid meet">
          {GEO.estados.map((g) => {
            const d = porEstado.get(g.nombre);
            const v = valorDe(d, medida);
            const sel = seleccion === g.nombre;
            const hov = hover?.nombre === g.nombre;
            return (
              <path key={g.nombre} d={g.d}
                fill={colorDe(v, max, min, medida, theme)}
                stroke={sel ? (theme.text) : hov ? (theme.accent || '#007AFF') : theme.border}
                strokeWidth={sel ? 2.2 : hov ? 1.8 : 0.6}
                vectorEffect="non-scaling-stroke"
                style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'fill 200ms, stroke 160ms' }}
                onMouseEnter={() => setHover({ nombre: g.nombre, x: g.cx, y: g.cy })}
                onClick={onSelect ? () => onSelect(sel ? null : g.nombre) : undefined}>
                <title>{`${capitalizarEstado(g.nombre)} · ${fmtValor(v, medida)}`}</title>
              </path>
            );
          })}
          {/* Etiqueta del estado activo, anclada a su centroide. */}
          {activo && GEO.estados.some((g) => g.nombre === activo) && (() => {
            const g = GEO.estados.find((x) => x.nombre === activo);
            return (
              <g pointerEvents="none">
                <circle cx={g.cx} cy={g.cy} r={4} fill={theme.accent || '#007AFF'} stroke={theme.surface} strokeWidth={1.5} vectorEffect="non-scaling-stroke" />
              </g>
            );
          })()}
        </svg>

        {/* Tooltip (HTML, no SVG: así hereda tipografía y tema). */}
        {activo && (
          <div style={{
            position: 'absolute', left: `${((hover?.x ?? GEO.estados.find((g) => g.nombre === activo)?.cx ?? 500) / anchoCaja) * 100}%`,
            top: `${((hover?.y ?? GEO.estados.find((g) => g.nombre === activo)?.cy ?? 300) / ALTO_VB) * 100}%`,
            transform: 'translate(-50%, -115%)', pointerEvents: 'none', zIndex: 2,
            background: theme.surfaceInverse || '#000', color: theme.textOnInverse || '#F5F5F7',
            borderRadius: 9, padding: '7px 10px', fontSize: 10.5, lineHeight: 1.45, whiteSpace: 'nowrap',
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
                  {datoActivo.clientes ? ` · ${fmtInt(datoActivo.clientes)} cuentas` : ''}
                  {datoActivo.vendedores ? ` · ${fmtInt(datoActivo.vendedores)} vendedores` : ''}
                </div>
                {topSku?.(activo) && <div style={{ opacity: 0.72 }}>Top SKU: {topSku(activo)}</div>}
              </>
            ) : (
              <div style={{ opacity: 0.72 }}>Sin venta registrada este mes</div>
            )}
          </div>
        )}
      </div>

      {/* Sin estado: no es un estado del mapa, va como fila aparte. */}
      {sinEstado && sinEstado.importe > 0 && (
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
