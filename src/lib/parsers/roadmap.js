// Roadmap.xlsx (Hoja1): Marca · Categoría · Familia · Artículo · Roadmap · Descripción 2.
// Replace completo de roadmap_sku — fuente única de marca/categoría/familia por SKU.
import { XLSX, objSnake, toStr, primeraHoja } from './_util';

export default function roadmap(wb) {
  const sh = primeraHoja(wb, 'Hoja1');
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null });
  const out = rows.map((r, i) => {
    const obj = objSnake(r);
    const sku = toStr(obj.articulo ?? obj.sku);
    if (!sku) return null;
    return {
      sku,
      marca: (toStr(obj.marca) || '').toUpperCase() || null,
      categoria: toStr(obj.categoria ?? obj.categoría),
      familia: toStr(obj.familia),
      rdmp: toStr(obj.roadmap ?? obj.rdmp),
      descripcion: toStr(obj.descripcion_2 ?? obj.descripcion ?? obj.descripcion_1),
      sort_order: i,
    };
  }).filter(Boolean);
  return { table: 'roadmap_sku', onConflict: 'sku', rows: out, replace: true, resumen: `${out.length} SKUs (replace completo)` };
}
