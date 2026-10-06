// Inicio móvil · mix de sell in como gráfica de pay (dona) con leyenda a la derecha (2026-10-05, pedido de Fernando).
// Desde el mismo día pinta con la pieza genérica `piezas/PayM` (hasta 5 rebanadas + «Otros»); aquí sólo queda el
// Segmented Canal · Marca · Categoría y la traducción de `mixes` a filas.
import React, { useMemo, useState } from 'react';
import { canalLabel } from '../../../modules/general/inicio/config';
import { PayM, ChipsPay } from '../../piezas';

const DIMS = [['canal', 'Canal'], ['marca', 'Marca'], ['categoria', 'Categoría']];

export default function PayMix({ mixes, formato, titulo, style }) {
  const [dim, setDim] = useState('canal');
  const filas = useMemo(() => (mixes?.[dim] || []).filter((x) => x.cur > 0).map((x) => ({ key: x.key, label: dim === 'canal' ? canalLabel(x.key) : x.key, v: x.cur })), [mixes, dim]);
  return <PayM titulo={titulo} filas={filas} formato={formato} vacio="Sin sell in en el período." acciones={<ChipsPay opciones={DIMS} value={dim} onChange={setDim} />} style={style} />;
}
