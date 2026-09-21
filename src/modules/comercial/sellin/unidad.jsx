// Unidad de la tabla "Detalle por SKU" (Sell In y Sell Out de clientes propios): piezas o monto sin IVA.
// Fernando (2026-09-21): switch Piezas · Monto arriba a la derecha de la tabla; la elección se recuerda
// como preferencia del usuario y la comparten las seis pantallas.
import React from 'react';
import { usePreferencias, setPreferencia } from '../../../lib/preferencias';
import { Segmented } from '../../../components/kit';
import { moneyCompact } from '../../../lib/format';

export const UNIDADES = [{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: 'Monto' }];

export function useUnidadDetalle() {
  const { prefs } = usePreferencias();
  const u = prefs?.detalleSku?.unidad;
  const unidad = u === 'monto' ? 'monto' : 'piezas';
  const setUnidad = (v) => setPreferencia('detalleSku.unidad', v === 'monto' ? 'monto' : 'piezas');
  return [unidad, setUnidad];
}

const int = (n) => Math.round(Number(n) || 0).toLocaleString('es-MX');
/** Formateador de celda según la unidad. */
export const fmtUnidad = (unidad) => (unidad === 'monto' ? (v) => moneyCompact(Number(v) || 0) : int);
export const etiquetaUnidad = (unidad) => (unidad === 'monto' ? 'monto sin IVA' : 'piezas');

export function SelectorUnidad({ unidad, onChange, size = 'sm' }) {
  return <Segmented size={size} options={UNIDADES} value={unidad} onChange={onChange} />;
}
