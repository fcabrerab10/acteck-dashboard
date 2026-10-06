// «Detalle por SKU × 12 meses» de la empresa (celular, 2026-10-05). Lo comparten Sell Out global y Sell In global.
//   Segmented Piezas · $ (cambia fmt y valores) → buscador «que entiende» (src/lib/buscarSku.js: SKU, marca,
//   categoría del roadmap, pulgadas, palabras) con chips de lo entendido debajo, cada uno con × → TablaAnual
//   ordenable (mes · Total · Δ) con columna Δ frente a los mismos 12 meses del año anterior → top 80 y «Mostrar más».
//   Tocar una fila → onSku(sku). Primera columna fija; el scroll horizontal vive SÓLO dentro de la tabla.
// Vista pura: la prueba scripts/test-sellout-sellin-movil-ssr.mjs. Todo va dentro de padding 0 16px.
import React, { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { interpretarBusqueda, coincideSku, indiceSku, quitarChip } from '../../../lib/buscarSku';
import { CampoBusqueda, Segmented, TituloSeccionM, Skeleton } from '../../piezas';
import { moneyCompact, N } from '../../util';
import TablaAnual from './TablaAnual';

const TOPE = 80;
const SEG_UNIDAD = [{ id: 'monto', label: '$' }, { id: 'piezas', label: 'Piezas' }];
const fmtPz = (n) => Math.round(N(n)).toLocaleString('es-MX');

/** Chips de lo que el buscador entendió, cada uno con su ×. */
export function ChipsEntendido({ chips = [], onQuitar }) {
  const { theme } = useTheme();
  if (!chips.length) return null;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 16px 0' }}>
      {chips.map((c, i) => (
        <button key={`${c.tipo}-${c.valor}-${i}`} type="button" onClick={() => onQuitar?.(c)} aria-label={`Quitar ${c.label}`}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5, border: 0, borderRadius: 999, padding: '4px 8px 4px 10px', background: `${theme.accent}1A`, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, cursor: 'pointer', maxWidth: '100%' }}>
          <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
          <X size={12} strokeWidth={2.6} style={{ flexShrink: 0 }} />
        </button>
      ))}
    </div>
  );
}

/**
 * @param {object} p
 * @param {Array}  p.filas        de skuAnual.js#filasSkuAnual
 * @param {Array}  p.columnas     etiquetas de los 12 meses (skuAnual.js#columnasVentana)
 * @param {Array}  p.categorias   categorías del roadmap para el buscador
 * @param {Function} p.onSku      (sku) → abre la ficha
 * @param {string} p.unidad / p.onUnidad  controlado desde fuera (opcional); si no, estado propio
 */
// 2026-10-05 (Inventario): `conTotalCol={false}` para series de saldo (stock al cierre: sumar los meses no significa
// nada), `vacio` para el texto cuando no hay filas y `soloPiezas` (sin permiso sensible: ni Segmented ni $); los demás
// usos no cambian.
export default function DetalleSkuAnual({ titulo = 'Detalle por SKU', filas = [], columnas = [], categorias = [], onSku, pie, cargando = false, unidad: unidadProp, onUnidad, meta, conTotalCol = true, vacio = 'Sin movimiento en los últimos 12 meses.', soloPiezas = false }) {
  const { theme } = useTheme();
  const [unidadLocal, setUnidadLocal] = useState('monto');
  const unidad = soloPiezas ? 'piezas' : (unidadProp || unidadLocal);
  const setUnidad = onUnidad || setUnidadLocal;
  const [q, setQ] = useState('');
  const [todas, setTodas] = useState(false);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const indices = useMemo(() => new Map(filas.map((f) => [f.sku, indiceSku(f)])), [filas]);
  const visibles = useMemo(() => (interp.vacio ? filas : filas.filter((f) => coincideSku(f, interp, indices.get(f.sku)))), [filas, interp, indices]);
  const recorte = !todas && visibles.length > TOPE;
  const mostradas = recorte ? visibles.slice(0, TOPE) : visibles;
  const fmt = unidad === 'piezas' ? fmtPz : moneyCompact;
  const filasTabla = useMemo(() => mostradas.map((f) => ({
    key: f.sku, label: f.sku, sub: f.descripcion || [f.marca, f.categoria].filter(Boolean).join(' · ') || undefined,
    valores: unidad === 'piezas' ? f.piezas : f.monto,
    prev: unidad === 'piezas' ? f.piezasPrev : f.montoPrev,
    onClick: onSku ? () => onSku(f.sku) : undefined,
  })), [mostradas, unidad, onSku]);

  return (
    <>
      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta={meta || `${filas.length} SKUs · 12 meses`}
        accion={soloPiezas ? null : <Segmented value={unidad} onChange={setUnidad} options={SEG_UNIDAD} size="xs" />}>{titulo}</TituloSeccionM>
      <div style={{ padding: '0 16px' }}><CampoBusqueda value={q} onChange={(v) => { setQ(v); setTodas(false); }} placeholder="SKU, descripción, marca o categoría" /></div>
      <ChipsEntendido chips={interp.chips} onQuitar={(c) => setQ(quitarChip(q, c, { categorias }))} />
      <div style={{ padding: '8px 16px 0' }}>
        {cargando ? <Skeleton h={200} r={12} /> : (
          <TablaAnual columnas={columnas} filas={filasTabla} fmt={fmt} ordenable conDelta conProm={false} conTotalCol={conTotalCol}
            etiquetaFilas={recorte ? `top ${TOPE}` : `${visibles.length} SKUs`} totalLabel="Total"
            vacio={interp.vacio ? vacio : 'Ningún SKU coincide con lo que buscas.'} />
        )}
        {recorte && (
          <button type="button" onClick={() => setTodas(true)}
            style={{ display: 'block', width: '100%', marginTop: 8, padding: '10px 0', border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13.5, fontWeight: 600, cursor: 'pointer' }}>
            Mostrar más · {visibles.length - TOPE} SKUs más
          </button>
        )}
        {pie && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>{pie}</div>}
      </div>
    </>
  );
}
