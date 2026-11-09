// Estado de Resultados · motor puro sobre `libro_financiero` (libro mensual de los consultores, 2026-11-09).
// Todo recibe el índice de `indexar(rows)` y devuelve números listos para pintar; nada de red ni de React.
// Convenciones: los montos del libro vienen en pesos (cartera en miles); los gastos y el costo se devuelven
// POSITIVOS y la pantalla los pinta entre paréntesis; `alcance` = real ÷ presupuesto (gastos al revés en el tono).
export const MESES_LBL = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_FULL = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

const n = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
export const div = (a, b) => (a == null || b == null || Number(b) === 0 ? null : Number(a) / Number(b));
const resta = (a, b) => (a == null && b == null ? null : (a || 0) - (b || 0));

/** Índice: get(hoja, anio, mes, clave, columna). También guarda metadatos (concepto, orden, nivel, padre) por hoja+clave. */
export function indexar(rows) {
  const m = new Map();
  const meta = new Map();
  const periodos = new Map(); // hoja → Set('anio-mes')
  for (const r of rows || []) {
    const k = `${r.hoja}|${r.anio}|${r.mes}|${r.clave}|${r.columna || 'valor'}`;
    m.set(k, n(r.valor));
    const mk = `${r.hoja}|${r.clave}`;
    if (!meta.has(mk) || (r.orden != null && meta.get(mk).orden == null)) meta.set(mk, { concepto: r.concepto, orden: r.orden, nivel: r.nivel, padre: r.padre });
    if (!periodos.has(r.hoja)) periodos.set(r.hoja, new Set());
    periodos.get(r.hoja).add(`${r.anio}-${r.mes}`);
  }
  const get = (hoja, anio, mes, clave, columna = 'valor') => { const v = m.get(`${hoja}|${anio}|${mes}|${clave}|${columna}`); return v === undefined ? null : v; };
  const claves = (hoja) => [...meta.keys()].filter((k) => k.startsWith(`${hoja}|`)).map((k) => ({ clave: k.slice(hoja.length + 1), ...meta.get(k) })).sort((a, b) => (a.orden ?? 1e9) - (b.orden ?? 1e9));
  const libros = () => [...(periodos.get('roi') || periodos.get('conso') || [])].map((s) => s.split('-').map(Number)).map(([anio, mes]) => ({ anio, mes }));
  return { get, claves, libros, periodos, size: m.size };
}

/** Meses con libro cargado en un año (hay ROI por libro; si no, consolidado). */
export function mesesConLibro(idx, anio) {
  const out = new Set();
  for (const p of idx.periodos.get('roi') || []) { const [a, mes] = p.split('-').map(Number); if (a === anio) out.add(mes); }
  if (!out.size) for (const p of idx.periodos.get('conso') || []) { const [a, mes] = p.split('-').map(Number); if (a === anio && idx.get('conso', a, mes, 'ventas', 'real_mes') != null) out.add(mes); }
  return [...out].sort((a, b) => a - b);
}
export const aniosConLibro = (idx) => [...new Set(idx.libros().map((l) => l.anio))].sort((a, b) => b - a);

/** Una celda del consolidado: real/ppto/alcance de un concepto en un periodo ('mes' | 'acum'). */
const celda = (idx, anio, mes, clave, periodo) => ({
  real: idx.get('conso', anio, mes, clave, `real_${periodo}`),
  ppto: idx.get('conso', anio, mes, clave, `ppto_${periodo}`),
});

/** Gastos por grupo (nivel 0) del año, del mes o acumulados hasta el mes, desde la hoja `gastos`. */
export function gastosPorGrupo(idx, anio, hastaMes, { acumulado = true, anioAnt = null, mesAnt = null } = {}) {
  const claves = idx.claves('gastos');
  const suma = (clave, a, m1, m2) => { let s = null; for (let m = m1; m <= m2; m++) { const v = idx.get('gastos', a, m, clave); if (v != null) s = (s || 0) + v; } return s; };
  const valor = (clave) => (acumulado ? suma(clave, anio, 1, hastaMes) : suma(clave, anio, hastaMes, hastaMes));
  const ant = (clave) => {
    if (anioAnt == null) return null;
    // año anterior: sólo hay acumulado por cuenta (hoja gastos_acum del libro de ese mes) o gastos por mes si se cargó ese año
    if (acumulado) { const v = idx.get('gastos_acum', anioAnt, mesAnt ?? hastaMes, clave); if (v != null) return v; return suma(clave, anioAnt, 1, hastaMes); }
    return suma(clave, anioAnt, hastaMes, hastaMes);
  };
  const nodos = claves.map((c) => ({ ...c, valor: valor(c.clave), ant: ant(c.clave) }));
  const porClave = new Map(nodos.map((x) => [x.clave, x]));
  const hijosDe = (clave) => nodos.filter((x) => x.padre === clave).map((x) => ({ ...x, hijos: hijosDe(x.clave) }));
  const grupos = nodos.filter((x) => (x.nivel ?? 0) === 0).map((x) => ({ ...x, hijos: hijosDe(x.clave) }));
  const total = grupos.reduce((s, g) => s + (g.valor || 0), 0);
  const totalAnt = grupos.some((g) => g.ant != null) ? grupos.reduce((s, g) => s + (g.ant || 0), 0) : null;
  return { grupos: grupos.sort((a, b) => Math.abs(b.valor || 0) - Math.abs(a.valor || 0)), total, totalAnt, porClave };
}

/**
 * Estado de resultados de un periodo: filas en orden con real · pctVenta · ppto · alcance · ant · delta.
 * `periodo`: 'acum' (enero a `mes`) o 'mes' (sólo `mes`). El año anterior sale del comparativo del libro.
 */
export function estado(idx, anio, mes, periodo = 'acum') {
  const ant = anio - 1;
  const v = celda(idx, anio, mes, 'ventas', periodo), vA = celda(idx, ant, mes, 'ventas', periodo);
  const ub = celda(idx, anio, mes, 'utilidad_bruta', periodo), ubA = celda(idx, ant, mes, 'utilidad_bruta', periodo);
  const g = celda(idx, anio, mes, 'gastos', periodo), gA = celda(idx, ant, mes, 'gastos', periodo);
  const gf = celda(idx, anio, mes, 'gastos_financieros', periodo), gfA = celda(idx, ant, mes, 'gastos_financieros', periodo);
  const pc = celda(idx, anio, mes, 'perdida_cambiaria', periodo), pcA = celda(idx, ant, mes, 'perdida_cambiaria', periodo);
  const un = celda(idx, anio, mes, 'utilidad_neta', periodo), unA = celda(idx, ant, mes, 'utilidad_neta', periodo);
  const costo = resta(v.real, ub.real), costoP = resta(v.ppto, ub.ppto), costoA = resta(vA.real, ubA.real);
  const camb = pc.real == null ? null : -pc.real, cambA = pcA.real == null ? null : -pcA.real;
  // lo que el libro no desglosa: utilidad neta − (bruta − gastos − financieros + cambiario)
  const otros = un.real == null || ub.real == null ? null : un.real - ((ub.real || 0) - (g.real || 0) - (gf.real || 0) + (camb || 0));
  const otrosA = unA.real == null || ubA.real == null ? null : unA.real - ((ubA.real || 0) - (gA.real || 0) - (gfA.real || 0) + (cambA || 0));
  const gastos = gastosPorGrupo(idx, anio, mes, { acumulado: periodo === 'acum', anioAnt: ant, mesAnt: mes });
  const fila = (id, label, real, ppto, antV, { tipo = 'linea', negativo = false, gastoLike = false, pct = true } = {}) => ({
    id, label, real, ppto, ant: antV, negativo, tipo,
    pctVenta: pct ? div(real, v.real) : null,
    alcance: div(real, ppto),
    delta: div(resta(real, antV), antV == null ? null : Math.abs(antV)),
    tono: tonoAlcance(div(real, ppto), gastoLike),
  });
  const filas = [
    fila('ventas', 'Ventas netas', v.real, v.ppto, vA.real),
    fila('costo', 'Costo de ventas', costo, costoP, costoA, { negativo: true, gastoLike: true }),
    fila('utilidad_bruta', 'Utilidad bruta', ub.real, ub.ppto, ubA.real, { tipo: 'subtotal' }),
    { id: 'margen_bruto', label: 'margen bruto', tipo: 'pct', real: div(ub.real, v.real), ppto: div(ub.ppto, v.ppto), ant: div(ubA.real, vA.real) },
    fila('gastos', 'Gastos de operación', g.real, g.ppto, gA.real, { negativo: true, gastoLike: true }),
    ...gastos.grupos.map((gr) => ({ id: `g:${gr.clave}`, label: gr.concepto, tipo: 'hijo', real: gr.valor, ppto: null, ant: gr.ant, negativo: true, pctVenta: div(gr.valor, v.real), alcance: null, delta: div(resta(gr.valor, gr.ant), gr.ant == null ? null : Math.abs(gr.ant)), hijos: gr.hijos, tono: null })),
    fila('gastos_financieros', 'Gastos financieros', gf.real, null, gfA.real, { negativo: true, gastoLike: true }),
    fila('cambiario', 'Resultado cambiario', camb, null, cambA),
    fila('otros', 'Otros ingresos, neto', otros, null, otrosA),
    fila('utilidad_neta', 'Utilidad neta', un.real, un.ppto, unA.real, { tipo: 'subtotal' }),
    { id: 'margen_neto', label: 'margen neto', tipo: 'pct', real: div(un.real, v.real), ppto: div(un.ppto, v.ppto), ant: div(unA.real, vA.real) },
  ].map((f) => (f.tipo === 'pct' ? { ...f, delta: f.real == null || f.ant == null ? null : f.real - f.ant, alcance: f.real == null || f.ppto == null ? null : f.real - f.ppto } : f));
  return { anio, mes, periodo, filas, ventas: v.real, utilidadNeta: un.real, gastos };
}

/** Tono del alcance: verde ≥ 100 %, naranja 85–99 %, rojo < 85 %. En gastos (gastoLike) al revés: verde ≤ 100 %. */
export function tonoAlcance(alcance, gastoLike = false) {
  if (alcance == null) return null;
  if (gastoLike) return alcance <= 1 ? 'ok' : alcance <= 1.1 ? 'casi' : 'mal';
  return alcance >= 1 ? 'ok' : alcance >= 0.85 ? 'casi' : 'mal';
}

/** Mes a mes del año: una columna por mes con libro + acumulado al último. */
export function mesAMes(idx, anio) {
  const meses = mesesConLibro(idx, anio);
  const ant = anio - 1;
  const col = (m, periodo = 'mes') => {
    const v = celda(idx, anio, m, 'ventas', periodo), ub = celda(idx, anio, m, 'utilidad_bruta', periodo), g = celda(idx, anio, m, 'gastos', periodo);
    const gf = celda(idx, anio, m, 'gastos_financieros', periodo), pc = celda(idx, anio, m, 'perdida_cambiaria', periodo), un = celda(idx, anio, m, 'utilidad_neta', periodo);
    const vA = celda(idx, ant, m, 'ventas', periodo);
    return {
      mes: m, label: periodo === 'acum' ? 'Acum' : MESES_LBL[m - 1],
      ventas: v.real, ventasPpto: v.ppto, ventasAlcance: div(v.real, v.ppto), ventasAnt: vA.real,
      utilidadBruta: ub.real, margenBruto: div(ub.real, v.real),
      gastos: g.real, gastosPct: div(g.real, v.real), gastosPpto: g.ppto,
      gastosFinancieros: gf.real, cambiario: pc.real == null ? null : -pc.real,
      utilidadNeta: un.real, utilidadPpto: un.ppto, utilidadAlcance: div(un.real, un.ppto), margenNeto: div(un.real, v.real),
    };
  };
  const columnas = meses.map((m) => col(m, 'mes'));
  const ultimo = meses[meses.length - 1];
  const acum = ultimo ? col(ultimo, 'acum') : null;
  return { meses, columnas, acum };
}

/** Indicadores al cierre del mes: cartera, inventario, deuda, ROI, personal. */
export function indicadores(idx, anio, mes) {
  const ant = anio - 1;
  const c = (clave, a = anio, col = 'real_acum') => idx.get('conso', a, mes, clave, col);
  const diasCartera = c('dias_cartera'), diasCarteraAnt = c('dias_cartera', ant);
  const metaCartera = c('dias_cartera', anio, 'ppto_acum') ?? 90;
  const carteraTotal = c('cartera_total'), carteraMas = c('cartera_mas_120');
  const diasInv = c('dias_inventario'), diasInvAnt = c('dias_inventario', ant);
  const inv = c('inventario'), invAnt = c('inventario', ant);
  const pasivo = c('pasivo_terceros'), pasivoAnt = c('pasivo_terceros', ant);
  const bancos = c('pasivo_bancos'), prov = c('pasivo_proveedores');
  const roi = idx.get('roi', anio, mes, 'roi'), roiPpto = idx.get('roi', anio, mes, 'ppto_roi'), roiAnual = idx.get('roi', anio, mes, 'anualizado');
  const personas = idx.get('personal', anio, mes, 'personas'), personasAnt = idx.get('personal', ant, 0, 'personas');
  const ventaPersona = idx.get('personal', anio, mes, 'venta_persona'), ventaPersonaAnt = idx.get('personal', ant, 0, 'venta_persona');
  // pico de días de inventario en el año (desde la hoja de rotación)
  let picoInv = null;
  for (let m = 1; m <= 12; m++) { const v = idx.get('inventario', anio, m, 'rotacion'); if (v != null && (picoInv == null || v > picoInv.valor)) picoInv = { mes: m, valor: v }; }
  const dic = idx.get('balance', anio, mes, 'suma_pasivo', 'inicial');
  return [
    { id: 'cartera', label: 'Días de cartera', real: diasCartera, meta: metaCartera, alcance: div(diasCartera, metaCartera), ant: diasCarteraAnt, delta: resta(diasCartera, diasCarteraAnt), unidad: 'd', tono: diasCartera == null || metaCartera == null ? null : diasCartera <= metaCartera ? 'ok' : diasCartera <= metaCartera * 1.15 ? 'casi' : 'mal',
      nota: carteraTotal != null ? `cartera $${fmtM(carteraTotal * 1000)}${carteraMas != null ? ` · $${fmtM(carteraMas * 1000)} a más de 120 días` : ''}` : null },
    { id: 'inventario', label: 'Días de inventario', real: diasInv, meta: null, ant: diasInvAnt, delta: resta(diasInv, diasInvAnt), unidad: 'd', tono: diasInv == null || diasInvAnt == null ? null : diasInv <= diasInvAnt ? 'ok' : 'mal',
      nota: inv != null ? `$${fmtM(inv)}${picoInv && picoInv.mes !== mes ? ` · pico ${picoInv.valor.toFixed(0)} d en ${MESES_FULL[picoInv.mes - 1]}` : ''}` : null },
    { id: 'deuda', label: 'Deuda con terceros', real: pasivo, meta: null, ant: pasivoAnt, delta: div(resta(pasivo, pasivoAnt), pasivoAnt), unidad: '$', tono: pasivo == null || pasivoAnt == null ? null : pasivo <= pasivoAnt ? 'ok' : 'mal',
      nota: bancos != null ? `bancos $${fmtM(bancos)} · proveedores y otros $${fmtM(prov)}${dic != null ? ` · diciembre $${fmtM(dic)}` : ''}` : null },
    { id: 'roi', label: 'Retorno sobre capital (ROI)', real: roi == null ? null : roi / 100, meta: roiPpto == null ? null : roiPpto / 100, alcance: div(roi, roiPpto), ant: null, delta: null, unidad: '%', tono: tonoAlcance(div(roi, roiPpto)),
      nota: roiAnual != null ? `${(roiAnual * 100).toFixed(0)} % anualizado` : null },
    { id: 'personal', label: 'Personal · venta por persona', real: personas, real2: ventaPersona, meta: null, ant: personasAnt, ant2: ventaPersonaAnt, delta: div(resta(ventaPersona, ventaPersonaAnt), ventaPersonaAnt), unidad: 'pers', tono: null,
      nota: 'venta del mes por persona · el año anterior es el cierre de diciembre' },
  ];
}

/** Cinco años: enero a `mes` por año (ventas y utilidad de la hoja de 5 años) y el total de cada año cerrado. */
export function cincoAnios(idx, anio, mes) {
  const anios = new Set();
  for (const p of idx.periodos.get('ventas_utilidad') || []) anios.add(Number(p.split('-')[0]));
  return [...anios].sort((a, b) => a - b).map((a) => {
    let ventas = null, utilidad = null, meses = 0;
    for (let m = 1; m <= mes; m++) {
      const v = idx.get('ventas_utilidad', a, m, 'ventas'), u = idx.get('ventas_utilidad', a, m, 'utilidad');
      if (v != null) { ventas = (ventas || 0) + v; meses++; }
      if (u != null) utilidad = (utilidad || 0) + u;
    }
    const totalV = idx.get('ventas_utilidad', a, 0, 'ventas'), totalU = idx.get('ventas_utilidad', a, 0, 'utilidad');
    return { anio: a, ventas, utilidad, margen: div(utilidad, ventas), meses, totalVentas: totalV, totalUtilidad: totalU, margenTotal: div(totalU, totalV) };
  }).filter((x) => x.ventas != null);
}

/** Antigüedad de cartera por mes (miles de pesos), del año y diciembre anterior. */
export function carteraPorMes(idx, anio) {
  const out = [];
  const b = ['por_vencer', 'd1_30', 'd31_60', 'd61_90', 'd91_180', 'mas_180', 'total', 'reserva', 'dias'];
  const fila = (a, m) => { const o = { anio: a, mes: m, label: a === anio ? MESES_LBL[m - 1] : `Dic ${a}` }; let hay = false; b.forEach((k) => { const v = idx.get('cartera', a, m, k); if (v != null) hay = true; o[k] = v; }); return hay ? o : null; };
  const d = fila(anio - 1, 12); if (d) out.push(d);
  for (let m = 1; m <= 12; m++) { const f = fila(anio, m); if (f) out.push(f); }
  return out;
}

/** Balance al cierre del mes: secciones activo · pasivo · capital con saldo inicial (diciembre) y saldo. */
export function balance(idx, anio, mes) {
  const claves = idx.claves('balance');
  const linea = (c) => ({ ...c, inicial: idx.get('balance', anio, mes, c.clave, 'inicial'), saldo: idx.get('balance', anio, mes, c.clave, 'saldo'), origen: (idx.get('balance', anio, mes, c.clave, 'origen_propios') || 0) + (idx.get('balance', anio, mes, c.clave, 'origen_ajenos') || 0), aplicacion: idx.get('balance', anio, mes, c.clave, 'aplicacion') });
  const lineas = claves.map(linea).filter((l) => l.saldo != null || l.inicial != null);
  const secciones = ['activo', 'pasivo', 'capital'].map((s) => ({ id: s, label: s[0].toUpperCase() + s.slice(1), lineas: lineas.filter((l) => l.padre === s && (l.saldo || l.inicial)), suma: lineas.find((l) => l.clave === `suma_${s}`) || null }));
  return secciones;
}

/** Gastos por cuenta × mes (para el panel plegado): árbol con los meses del año. */
export function gastosPorCuentaMes(idx, anio, meses) {
  const claves = idx.claves('gastos');
  const nodo = (c) => ({ ...c, meses: meses.map((m) => idx.get('gastos', anio, m, c.clave)), total: meses.reduce((s, m) => s + (idx.get('gastos', anio, m, c.clave) || 0), 0) });
  const nodos = claves.map(nodo);
  const hijosDe = (clave) => nodos.filter((x) => x.padre === clave).map((x) => ({ ...x, hijos: hijosDe(x.clave) }));
  return nodos.filter((x) => (x.nivel ?? 0) === 0).map((x) => ({ ...x, hijos: hijosDe(x.clave) }));
}

// ─── formato corto para notas (la pantalla usa src/lib/format para lo demás) ───
export function fmtM(v) {
  if (v == null) return '—';
  const a = Math.abs(v);
  if (a >= 1e6) return `${(v / 1e6).toFixed(a >= 1e8 ? 0 : 1)}M`;
  if (a >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return `${Math.round(v)}`;
}
/** Miles de pesos con separador, negativos entre paréntesis (estilo estado financiero). */
export function miles(v, { paren = false } = {}) {
  if (v == null) return '—';
  const k = Math.round(v / 1000);
  const s = Math.abs(k).toLocaleString('es-MX');
  if (paren) return `(${s})`;
  return k < 0 ? `(${s})` : s;
}
