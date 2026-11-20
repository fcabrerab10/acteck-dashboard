// Próximos arribos · agrupación pura de los embarques pendientes (v_transito_sku.embarques_detalle) por PO.
// La comparten la web (inventario/ProximosArribos.jsx) y el celular (movil/pestanas/inventario/InventarioM.jsx).
//   agruparPorPO({ transito, porSku, descripciones, navieraPor, hoy }) → [{ po, eta, etd, cedis, estatus, contenedor,
//     piezas, skus:[{ sku, descripcion, piezas, stock, coberturaDias, tieneStock, demandaMes, necesitado, riesgo, eta }],
//     nSkus, resuelve, dias, naviera, diasEnTransito }] ordenado por ETA y piezas.
import { agruparTransitoPorPO, isoDia } from '../../../lib/transito.js';

export function agruparPorPO({ transito, porSku = new Map(), descripciones = new Map(), navieraPor = new Map(), hoy = new Date() } = {}) {
  // Agrupado, ETA, piezas, vencida y orden: src/lib/transito.js (única implementación). Aquí sólo las líneas por SKU.
  // Particularidad de esta vista: estatus y CEDIS salen del primer renglón de la PO.
  const pos = agruparTransitoPorPO(transito || new Map(), {
    hoy, cabecera: 'primera',
    alCrear: () => ({ skus: [] }),
    porRenglon: (it, { e: p, sku }) => {
      const r = porSku.get(sku);
      const d = descripciones.get(sku) || {};
      const necesitado = !!r && (r.agotado || r.critico);
      it.skus.push({ sku, descripcion: r?.descripcion || d.descripcion || '', piezas: p.cantidad, stock: r?.totalPz ?? null, coberturaDias: r?.coberturaDias ?? null, tieneStock: !!r?.tieneStock, demandaMes: r?.demandaMes || 0, necesitado, riesgo: !!r?.riesgo, eta: p.eta || null });
    },
  });
  // diasEnTransito = días desde el ETD (lo que ya lleva navegando): sólo para lo que aún no llega.
  const hoyIso = isoDia(hoy);
  return pos.map((it) => ({
    ...it,
    nSkus: it.skus.length,
    resuelve: it.skus.filter((s) => s.necesitado).length,
    naviera: (it.contenedor && navieraPor.get(it.contenedor)) || null,
    diasEnTransito: it.etd && it.etd <= hoyIso ? Math.round((Date.parse(`${hoyIso}T00:00:00`) - Date.parse(`${it.etd}T00:00:00`)) / 86400000) : null,
  }));
}
