// Inventario global · agregación pura SKU × almacén → 1 fila por SKU (descripción, tránsito, lead time,
// demanda ERP, cobertura, estado, índice de búsqueda). La comparten la web (InventarioGlobal.jsx) y el celular
// (src/movil/pestanas/inventario/InventarioM.jsx): una sola regla de cobertura/agotado/sobre-stock.
// Sin React ni layout: se prueba en Node (scripts/test-movil-tracking-inventario-ssr.mjs).
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas';
import { estadoDe } from './filtros';
import { COBERTURA_CRITICA, COBERTURA_SOBRESTOCK, N, diasHasta, normalizar } from './constantes';

// SKU × almacén enriquecido (descripción, tránsito, lead time, demanda, cobertura, estado, índice de búsqueda)
export function agregarSkus(filas, { descripciones, transito, leadTime, demanda }) {
  const m = new Map();
  filas.forEach((r) => {
    const sku = r.articulo;
    if (!sku) return;
    if (!m.has(sku)) m.set(sku, { sku, byAlm: {}, totalPz: 0, totalDisp: 0, totalRes: 0, valorRes: 0, valor: 0, costoRef: 0, cedisSet: new Set() });
    const it = m.get(sku);
    const alm = Number(r.no_almacen);
    // res = apartado (inventario − disponible) · valorRes = su costo, exactamente como
    // v_inventario_apartado_sku (costoinventario − costodisponible), no una estimación.
    const pz = N(r.inventario), disp = N(r.disponible), res = Math.max(0, pz - disp), val = N(r.costoinventario);
    const valRes = Math.max(0, val - N(r.costodisponible));
    if (!it.byAlm[alm]) it.byAlm[alm] = { pz: 0, disp: 0, res: 0, valor: 0, valorRes: 0, cedis: r.cedis };
    it.byAlm[alm].pz += pz; it.byAlm[alm].disp += disp; it.byAlm[alm].res += res; it.byAlm[alm].valor += val; it.byAlm[alm].valorRes += valRes;
    it.totalPz += pz; it.totalDisp += disp; it.totalRes += res; it.valor += val; it.valorRes += valRes;
    it.costoRef = Math.max(it.costoRef, N(r.costopromedio));
    if (pz > 0 && r.cedis) it.cedisSet.add(r.cedis);
  });
  return Array.from(m.values()).map((it) => {
    const d = descripciones.get(it.sku) || {};
    const tr = transito.get(it.sku) || null;
    const lt = leadTime.get(it.sku) || null;
    const demandaMes = demanda.get(it.sku) || 0;
    const costo = it.totalPz > 0 ? it.valor / it.totalPz : it.costoRef;
    const transitoPz = tr ? tr.cantidad : 0;
    const coberturaDias = demandaMes > 0 ? it.totalPz / (demandaMes / 30) : null;
    const tieneStock = it.totalPz > 0;
    const diasEta = tr?.eta ? diasHasta(tr.eta) : null;
    const agotado = !tieneStock && demandaMes > 0;
    const critico = tieneStock && coberturaDias != null && coberturaDias < COBERTURA_CRITICA;
    const sobrestock = tieneStock && coberturaDias != null && coberturaDias > COBERTURA_SOBRESTOCK;
    // Se agota antes de que llegue su tránsito: hay embarque pendiente y la cobertura no alcanza a la ETA
    const riesgo = transitoPz > 0 && (agotado || (critico && diasEta != null && coberturaDias < Math.max(diasEta, 0)));
    const row = {
      ...it,
      // Si roadmap_sku aún no trae la marca (SKU nuevo: los AV-* de Audive llegan primero
      // en embarques_compras), se infiere del prefijo para que la faceta Marca la liste.
      descripcion: d.descripcion || '', marca: normalizarMarca(d.marca) || marcaDeSku(it.sku) || '', familia: d.familia || '', rdmp: d.rdmp || '', categoria: d.categoria || '',
      transito: tr, transitoPz, transitoPos: tr ? tr.pos.length : 0, transitoEta: tr?.eta || null, transitoValor: transitoPz * costo, costo,
      leadTime: lt, demandaMes, coberturaDias, agotado, critico, sobrestock, riesgo, tieneStock,
    };
    row.estado = estadoDe(row);
    // Índice de búsqueda: SKU + descripción + marca + familia + categoría, sin acentos ni mayúsculas
    row.indice = normalizar(`${row.sku} ${row.descripcion} ${row.marca} ${row.familia} ${row.categoria}`);
    return row;
  });
}

/**
 * Resumen para hero y KPIs (web y celular) sobre las filas de agregarSkus.
 * `medidas` = fila normalizada de v_medidas_inventario (inventarioDesdeVista) o null: si viene, Inv Actual y
 * Días de Inv son las cifras OFICIALES del director; si no, se cae a lo sumado en pantalla (sólo piezas/valor).
 */
export function resumenInventario(rows, medidas = null) {
  const conStock = rows.filter((r) => r.tieneStock);
  const agotados = rows.filter((r) => r.agotado);
  const criticos = rows.filter((r) => r.critico);
  const sobre = rows.filter((r) => r.sobrestock);
  const riesgo = rows.filter((r) => r.riesgo);
  const enTransito = rows.filter((r) => r.transitoPz > 0);
  const suma = (arr, k) => arr.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  let pzCob = 0, demDia = 0;
  rows.forEach((r) => { if (r.demandaMes > 0) { pzCob += r.totalPz; demDia += r.demandaMes / 30; } });
  const proximaEta = enTransito.map((r) => r.transitoEta).filter(Boolean).sort()[0] || null;
  const pos = new Set();
  enTransito.forEach((r) => (r.transito?.pos || []).forEach((p) => { if (p.po) pos.add(p.po); }));
  return {
    valor: medidas?.inv_actual ?? suma(rows, 'valor'),
    piezas: medidas?.inv_actual_piezas ?? suma(rows, 'totalPz'),
    diasInv: medidas?.dias_inv ?? null,
    coberturaPz: demDia > 0 ? pzCob / demDia : null,
    nSkus: rows.length, conStock: conStock.length,
    agotados: agotados.length, demandaPerdida: suma(agotados, 'demandaMes'),
    criticos: criticos.length, riesgo: riesgo.length,
    sobrestock: sobre.length, valorSobre: suma(sobre, 'valor'), piezasSobre: suma(sobre, 'totalPz'),
    transitoPz: suma(enTransito, 'transitoPz'), transitoSkus: enTransito.length, transitoPos: pos.size, proximaEta,
  };
}
