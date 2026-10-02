// Forecast CRM · motor del sugerido (puro, sin red; pruebas en scripts/test-forecast-calc.mjs). 2026-10-01.
// Fernando: «quiero que tú me hagas el sugerido del producto que estaremos necesitando durante el forecast y ya sólo
// me aparezca el botón de exportar… y que no tomes en cuenta los SKUs que ya tienen forecast en el CRM».
//
// Por cliente y ventana de N meses (la del CRM: desde el mes siguiente, 6 meses), para cada SKU:
//   base          = promedio de piezas de los 3 meses cerrados (sell out si el cliente lo reporta; si no, sell in).
//   estacionalidad= piezas del mismo mes del año anterior ÷ promedio mensual del año anterior, acotada [0.6, 1.6];
//                   sólo si el año anterior tiene ≥ 6 meses con venta; si no, 1.
//   inventario    = el exceso de stock en casa del cliente (stock − 1 mes de base) se consume antes de pedir:
//                   se resta de los primeros meses hasta agotarlo.
//   proyectos     = las líneas de proyectos probables/confirmados del cliente en ese mes y SKU se SUMAN.
//   redondeo      = múltiplos de 5 a partir de 20 pz; nunca negativo.
//   excluidos     = SKUs que ya tienen forecast en el CRM para ese cliente (forecast_crm_existente) y SKUs fuera del roadmap.
// La justificación se arma con los datos que sostienen el número (el CRM la pide, ≥ 15 caracteres).
const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
export const mesKey = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
export const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

/** Ventana del CRM: N meses desde 'YYYY-MM' → [{ anio, mes, key, label }]. */
export function ventana(mesInicio, n = 6) {
  const [a, m] = String(mesInicio).split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(a, m - 1 + i, 1);
    const anio = d.getFullYear(), mes = d.getMonth() + 1;
    return { anio, mes, key: mesKey(anio, mes), label: `${MESES_ABR[mes - 1]} ${String(anio).slice(2)}` };
  });
}
export function mesSiguiente(hoy = new Date()) { const d = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1); return mesKey(d.getFullYear(), d.getMonth() + 1); }

/** Últimos n meses cerrados antes de `hoy` → keys. */
export function mesesCerrados(n, hoy = new Date()) {
  return Array.from({ length: n }, (_, i) => { const d = new Date(hoy.getFullYear(), hoy.getMonth() - (n - i), 1); return mesKey(d.getFullYear(), d.getMonth() + 1); });
}

export const redondear = (v) => { const n = Math.max(0, Math.round(N(v))); return n >= 20 ? Math.round(n / 5) * 5 : n; };

/** Factor de estacionalidad del mes `mes` con la serie del año anterior (Map key → pz). */
export function estacionalidad(serie, anio, mes) {
  const prev = anio - 1;
  const vals = Array.from({ length: 12 }, (_, i) => N(serie.get(mesKey(prev, i + 1))));
  const con = vals.filter((v) => v > 0);
  if (con.length < 6) return 1;
  const prom = con.reduce((s, v) => s + v, 0) / con.length;
  const v = vals[mes - 1];
  if (!prom || v <= 0) return 1;
  return Math.min(1.6, Math.max(0.6, v / prom));
}

/**
 * Sugerido para un cliente.
 *  series:    Map(sku → Map('YYYY-MM' → piezas))  ventas del cliente (sell out o sell in) de ≥ 2 años
 *  stock:     Map(sku → piezas en casa del cliente) (vacío si no reporta)
 *  proyectos: [{ sku, key:'YYYY-MM', piezas, nombre, probabilidad }]  (ya filtrados a probable/confirmado)
 *  excluir:   Set(sku) con forecast en el CRM
 *  roadmap:   Map(sku → { descripcion, marca, categoria }) · si viene, los SKUs fuera del roadmap se excluyen
 *  fuente:    'sellout' | 'sellin' (sólo para la justificación)
 */
export function sugerir({ ventanaMeses, series, stock = new Map(), proyectos = [], excluir = new Set(), roadmap = null, fuente = 'sellout', hoy = new Date() }) {
  const cerrados = mesesCerrados(3, hoy);
  const porSku = new Map();
  const proyPorSku = new Map();
  for (const p of proyectos) { if (!proyPorSku.has(p.sku)) proyPorSku.set(p.sku, []); proyPorSku.get(p.sku).push(p); }
  const skus = new Set([...series.keys(), ...proyPorSku.keys()]);
  const excluidos = [];
  for (const sku of skus) {
    if (excluir.has(sku)) { excluidos.push(sku); continue; }
    if (roadmap && roadmap.size && !roadmap.has(sku)) continue;
    const serie = series.get(sku) || new Map();
    const base = cerrados.reduce((s, k) => s + N(serie.get(k)), 0) / 3;
    const st = N(stock.get(sku));
    let exceso = Math.max(0, st - base);
    const meses = {};
    const detalle = [];
    let totalProy = 0;
    for (const m of ventanaMeses) {
      const f = estacionalidad(serie, m.anio, m.mes);
      let demanda = base * f;
      if (exceso > 0) { const usa = Math.min(exceso, demanda); demanda -= usa; exceso -= usa; }
      const proy = (proyPorSku.get(sku) || []).filter((p) => p.key === m.key).reduce((s, p) => s + N(p.piezas), 0);
      totalProy += proy;
      const v = redondear(demanda) + redondear(proy);
      meses[m.key] = v > 0 ? v : null;
      detalle.push({ key: m.key, base: demanda, factor: f, proyecto: proy });
    }
    const total = Object.values(meses).reduce((s, v) => s + N(v), 0);
    if (total <= 0) continue;
    const proys = proyPorSku.get(sku) || [];
    const origen = proys.length && base <= 0 ? 'proyecto' : proys.length ? 'mixto' : 'sugerido';
    porSku.set(sku, {
      sku, descripcion: roadmap?.get(sku)?.descripcion || '', marca: roadmap?.get(sku)?.marca || '',
      base: Math.round(base * 10) / 10, stock: st || null, semanas: base > 0 && st ? Math.round((st / (base / 4.33)) * 10) / 10 : null,
      meses, total, origen, proyectos: [...new Set(proys.map((p) => p.nombre))], detalle,
      justificacion: justificar({ base, stock: st, fuente, proyectos: proys, totalProy, ventanaMeses }),
    });
  }
  const filas = [...porSku.values()].sort((a, b) => b.total - a.total);
  return { filas, excluidos, totales: { skus: filas.length, piezas: filas.reduce((s, f) => s + f.total, 0), proyectos: filas.filter((f) => f.origen !== 'sugerido').length } };
}

/** Texto de justificación (≥ 15 caracteres) con lo que sostiene el número. */
export function justificar({ base, stock, fuente, proyectos = [], totalProy = 0, ventanaMeses = [] }) {
  const partes = [];
  if (base > 0) partes.push(`Ritmo de ${fuente === 'sellout' ? 'sell out' : 'compra'} de ${Math.round(base)} pz/mes en los últimos 3 meses cerrados`);
  if (stock > 0 && base > 0) partes.push(`inventario en el cliente de ${Math.round(stock)} pz (${(stock / (base / 4.33)).toFixed(1)} semanas) ya descontado`);
  else if (stock > 0) partes.push(`inventario en el cliente de ${Math.round(stock)} pz`);
  if (proyectos.length) {
    const nombres = [...new Set(proyectos.map((p) => p.nombre))].slice(0, 2).join(', ');
    partes.push(`proyecto${proyectos.length > 1 ? 's' : ''} ${nombres} (${proyectos[0].probabilidad || 'confirmado'}) por ${Math.round(totalProy)} pz`);
  }
  if (!partes.length) partes.push(`Demanda estimada para la ventana ${ventanaMeses[0]?.label || ''}–${ventanaMeses[ventanaMeses.length - 1]?.label || ''}`);
  let txt = partes.join(' · ');
  txt = txt.charAt(0).toUpperCase() + txt.slice(1);
  return txt.length >= 15 ? txt : `${txt} · forecast del dashboard`;
}

/** Filas → filas de la plantilla del CRM (plantillaCRM.construirLibro). */
export function filasPlantilla(filas, { tipo, clienteCodigo }) {
  return filas.filter((f) => Object.values(f.meses || {}).some((v) => N(v) > 0)).map((f) => ({ tipo, cliente: clienteCodigo, sku: f.sku, justificacion: f.justificacion, meses: f.meses }));
}

export const MIN_JUSTIFICACION = 15;
export function validar(filas) {
  const errores = [];
  for (const f of filas) {
    const total = Object.values(f.meses || {}).reduce((s, v) => s + N(v), 0);
    if (total <= 0) continue;
    if (String(f.justificacion || '').trim().length < MIN_JUSTIFICACION) errores.push({ sku: f.sku, error: `justificación < ${MIN_JUSTIFICACION} caracteres` });
  }
  return errores;
}
