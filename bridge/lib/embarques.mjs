// Carga de embarques_compras (histórico del Master Embarques).
//
// La tabla tiene DOS uniques: (po, codigo, contenedor) —la llave de negocio,
// migración 2026-08-03— y (po, codigo, arribo_cedis, shp_qty) —creada a mano
// en Supabase como embarques_compras_uniq_recibo; es el on_conflict de
// api/import-central.js—. Ningún upsert incremental funciona con las dos:
//   · por la de 4, una fila existente cuyo arribo/cantidad cambió (o con
//     arribo_cedis NULL, que Postgres trata como distinto) se reinserta y
//     choca con la de 3;
//   · por la de 3, dos contenedores del mismo PO/SKU que ahora comparten
//     cantidad y arribo chocan con la de 4 (comprobado con el Sheet real).
// Por eso el histórico se REEMPLAZA completo en cada corrida (igual que
// inventario y precios): se borra la tabla y se inserta el Sheet deduplicado
// por ambas llaves, que es exactamente lo que deja la carga web. Ventaja
// extra: las filas borradas del Sheet desaparecen también de la BD.
import { upsertRows, DIRECTO } from './api.mjs';

const K3 = (r) => `${r.po}||${r.codigo}||${r.contenedor}`;
const K4 = (r, i) => (r.arribo_cedis == null || r.shp_qty == null ? `#${i}` : `${r.po}||${r.codigo}||${r.arribo_cedis}||${r.shp_qty}`);

/** Dedupe como uploads.html/import-central: por (po,codigo,contenedor) y luego por la llave de 4 (NULL = distinto, como en la BD). */
export function dedupeEmbarques(rows) {
  const s3 = new Map(); for (const r of rows) s3.set(K3(r), r);
  const s4 = new Map(); [...s3.values()].forEach((r, i) => s4.set(K4(r, i), r));
  return [...s4.values()];
}

// Protección: si el Sheet viene muy chico (pestaña rota, descarga parcial),
// no se borra nada.
const MINIMO_FILAS = 1000;

export async function upsertEmbarquesCompras(rows, { dryRun = false } = {}) {
  rows = dedupeEmbarques(rows);
  if (rows.length < MINIMO_FILAS) throw new Error(`embarques_compras: sólo ${rows.length} filas válidas (< ${MINIMO_FILAS}); no se reemplaza la tabla`);
  if (!DIRECTO) { await upsertRows('embarques_compras', 'po,codigo,arribo_cedis,shp_qty', rows, { dryRun }); return rows.length; }
  await upsertRows('embarques_compras', 'po,codigo,contenedor', rows, { deleteAll: true, dryRun });
  return rows.length;
}
