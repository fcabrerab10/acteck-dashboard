// Próximos arribos · agrupación pura de los embarques pendientes (v_transito_sku.embarques_detalle) por PO.
// La comparten la web (inventario/ProximosArribos.jsx) y el celular (movil/pestanas/inventario/InventarioM.jsx).
//   agruparPorPO({ transito, porSku, descripciones, navieraPor, hoy }) → [{ po, eta, etd, cedis, estatus, contenedor,
//     piezas, skus:[{ sku, descripcion, piezas, stock, coberturaDias, tieneStock, demandaMes, necesitado, riesgo, eta }],
//     nSkus, resuelve, dias, naviera, diasEnTransito }] ordenado por ETA y piezas.
import { diasHasta } from './constantes';

const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function agruparPorPO({ transito, porSku = new Map(), descripciones = new Map(), navieraPor = new Map(), hoy = new Date() } = {}) {
  const m = new Map();
  (transito || new Map()).forEach((t, sku) => {
    (t.pos || []).forEach((p) => {
      if (!p.po || !(p.cantidad > 0)) return;
      if (!m.has(p.po)) m.set(p.po, { po: p.po, eta: p.eta || null, etd: p.etd || null, cedis: p.cedis || '', estatus: p.estatus || '', contenedor: p.contenedor || '', piezas: 0, skus: [] });
      const it = m.get(p.po);
      if (p.eta && (!it.eta || p.eta < it.eta)) it.eta = p.eta;
      it.piezas += p.cantidad;
      if (!it.contenedor && p.contenedor) it.contenedor = p.contenedor;
      if (p.etd && (!it.etd || p.etd < it.etd)) it.etd = p.etd;
      const r = porSku.get(sku);
      const d = descripciones.get(sku) || {};
      const necesitado = !!r && (r.agotado || r.critico);
      it.skus.push({ sku, descripcion: r?.descripcion || d.descripcion || '', piezas: p.cantidad, stock: r?.totalPz ?? null, coberturaDias: r?.coberturaDias ?? null, tieneStock: !!r?.tieneStock, demandaMes: r?.demandaMes || 0, necesitado, riesgo: !!r?.riesgo, eta: p.eta || null });
    });
  });
  // diasEnTransito = días desde el ETD (lo que ya lleva navegando): sólo para lo que aún no llega.
  const hoyIso = isoDia(hoy);
  return [...m.values()].map((it) => ({
    ...it,
    nSkus: it.skus.length,
    resuelve: it.skus.filter((s) => s.necesitado).length,
    dias: diasHasta(it.eta),
    naviera: (it.contenedor && navieraPor.get(it.contenedor)) || null,
    diasEnTransito: it.etd && it.etd <= hoyIso ? Math.round((Date.parse(`${hoyIso}T00:00:00`) - Date.parse(`${it.etd}T00:00:00`)) / 86400000) : null,
  }))
    .sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')) || b.piezas - a.piezas);
}
