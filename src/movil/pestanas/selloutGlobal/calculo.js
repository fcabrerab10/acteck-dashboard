// Sell Out de la empresa en el celular (3.80.0 · 2026-10-05) · cálculo puro, sin React ni red.
// Entrada: las MISMAS filas que la web (v_sellout_cuentas, v_sellout_cuenta_mes, mv_sellout_cuenta_dia) + sku × año
// pivotado (v_sellout_sku_anio) + roadmap. El motor es el de src/modules/comercial/sellout/calculo.js
// (construirFilas · totalesDeFilas · porCanal · semanasInventario); aquí sólo se decide el período y se arma lo que
// pinta la pantalla: hero, 4 KPIs, serie de 12 meses, mixes y la tabla por SKU. Pruebas en
// scripts/test-sellout-sellin-movil-ssr.mjs.
import {
  construirFilas, totalesDeFilas, ultimoDiaConVenta, sumaUltimosMeses, semanasInventario, idxMes, yoy as yoyDe, MESES, MESES_LARGO, canalLabel,
} from '../../../modules/comercial/sellout/calculo.js';
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas.js';
import { filasSkuAnual, columnasVentana, sumaMeses } from '../sellout/skuAnual.js';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const money = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n), a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)} M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)} K`;
  return `${s}$${Math.round(a)}`;
};
const corto = (nombre) => String(nombre || '').split(' (')[0].trim();

/**
 * Mes que se usa de verdad: el elegido si ya tiene sell out; si no (las cuentas reportan por semanas y el mes en curso
 * puede venir vacío), el ÚLTIMO mes anterior con sell out, y se dice («sep · último»). Nunca $0 por un mes que no llegó.
 */
export function mesUsado(mensual = [], anio, mes) {
  const total = (a, m) => mensual.reduce((s, r) => (N(r.anio) === a && N(r.mes) === m ? s + N(r.importe) : s), 0);
  if (total(anio, mes) > 0) return { anio, mes, esOtroMes: false };
  const con = new Set();
  for (const r of mensual) if (N(r.importe) > 0) con.add(idxMes(N(r.anio), N(r.mes)));
  let mejor = null;
  for (const i of con) if (i < idxMes(anio, mes) && (mejor == null || i > mejor)) mejor = i;
  if (mejor == null) return { anio, mes, esOtroMes: false, vacio: true };
  return { anio: Math.floor(mejor / 12), mes: (mejor % 12) + 1, esOtroMes: true };
}

/** Frase del hero: «El canal desplazó $91.3 M en septiembre, 2.5 veces lo de sep 25; SO/SI 1.94 y 7 semanas de inventario en cuentas.» */
export function fraseSellOut({ importe, yoy, soSi, semanas, anio, mes, modo, enCurso }) {
  const cuando = modo === 'mes' ? `en ${MESES_LARGO[mes - 1]}` : `de enero a ${MESES_LARGO[mes - 1]}`;
  let comp = '';
  const ref = modo === 'mes' ? `${MESES[mes - 1].toLowerCase()} ${String(anio - 1).slice(2)}` : String(anio - 1);
  if (yoy == null) comp = ', sin comparativo contra el año pasado';
  else if (yoy >= 100) comp = `, ${((yoy + 100) / 100).toFixed(1)} veces lo de ${ref}`;
  else comp = `, ${Math.abs(yoy).toFixed(0)} % ${yoy >= 0 ? 'arriba' : 'abajo'} de ${ref}${enCurso ? ' a mismo día' : ''}`;
  const cola = [];
  if (soSi != null) cola.push(`SO/SI ${(soSi / 100).toFixed(2)}`);
  if (semanas != null) cola.push(`${Math.round(semanas)} semanas de inventario en cuentas`);
  return `El canal desplazó ${money(importe)} ${cuando}${comp}${cola.length ? `; ${cola.join(' y ')}` : ''}.`;
}

/**
 * @param {object} p
 * @param {Array}  p.cuentas · p.mensual · p.dias   lo de sellout/datos.js (dos años)
 * @param {Array}  p.skuAnio                        useSkuAnio (tres años, normalizado)
 * @param {Array}  p.roadmap                        roadmap_sku
 * @param {number} p.anio · p.mes                   período elegido · p.modo 'mes' | 'ytd'
 */
export function resumenSellOut({ cuentas = [], mensual = [], dias = [], skuAnio = [], roadmap = [], anio, mes, modo = 'mes', hoy = new Date() }) {
  const u = mesUsado(mensual, anio, mes);
  const anioU = u.anio, mesU = u.mes;
  const enCurso = anioU === hoy.getFullYear() && mesU === hoy.getMonth() + 1;
  const corteDia = ultimoDiaConVenta(dias, anioU, mesU) || 31;
  const filas = construirFilas({ cuentas, mensual, dias, anio: anioU, mes: mesU, corteDia });
  const tot = totalesDeFilas(filas);
  const mesesPeriodo = modo === 'mes' ? [mesU] : Array.from({ length: mesU }, (_, i) => i + 1);
  const conFuente = filas.filter((f) => !f.sinFuente);

  // Cifras del período (mes = MTD a mismo día · ytd = YTD a mismo día), siempre del motor de la web.
  const importe = modo === 'mes' ? tot.importe : tot.ytd;
  const importePrev = modo === 'mes' ? tot.importePrev : tot.ytdPrev;
  const yoy = modo === 'mes' ? tot.yoy : tot.yoyYtd;
  const enMes = (r) => N(r.anio) === anioU && mesesPeriodo.includes(N(r.mes));
  const sinFuente = new Set(filas.filter((f) => f.sinFuente).map((f) => f.cuenta));
  const sellIn = mensual.reduce((s, r) => (enMes(r) && !sinFuente.has(r.cuenta) ? s + N(r.sell_in) : s), 0);
  const cantidad = modo === 'mes' ? tot.cantidad : mensual.reduce((s, r) => (enMes(r) ? s + N(r.cantidad) : s), 0);
  const soSi = sellIn > 0 ? (importe / sellIn) * 100 : null;
  const cuentasConSellOut = conFuente.filter((f) => (modo === 'mes' ? f.importe : f.ytd) > 0).length;

  // Inventario en cuentas: última foto (construirFilas ya la trae) y semanas al ritmo de los 3 meses cerrados.
  const conInv = filas.filter((f) => f.invPiezas != null);
  const pz3m = conInv.reduce((s, f) => s + sumaUltimosMeses(mensual, f.cuenta, anioU, mesU, 3, 'cantidad', 1), 0);
  const invPiezas = conInv.reduce((s, f) => s + N(f.invPiezas), 0);
  const semanas = semanasInventario(invPiezas, pz3m);

  // Reparto de las 5 cuentas mayores del período.
  const ordenadas = [...conFuente].map((f) => ({ cuenta: f.cuenta, nombre: corto(f.nombre), importe: modo === 'mes' ? f.importe : f.ytd })).filter((f) => f.importe > 0).sort((a, b) => b.importe - a.importe);
  const top5 = ordenadas.slice(0, 5).map((f) => ({ ...f, pct: importe ? (f.importe / importe) * 100 : 0 }));
  const reparto = top5.map((f) => `${f.nombre} ${Math.round(f.pct)} %`).join(' · ');

  // Serie: los 12 meses naturales de anioU frente a anioU-1 (null = mes que aún no llega).
  const porMes = (a, m) => mensual.reduce((s, r) => (N(r.anio) === a && N(r.mes) === m ? s + N(r.importe) : s), 0);
  const ultimoCon = mensual.reduce((u2, r) => (N(r.anio) === anioU && N(r.importe) > 0 ? Math.max(u2, N(r.mes)) : u2), 0);
  const serie = MESES.map((label, i) => {
    const m = i + 1, cur = m <= ultimoCon ? porMes(anioU, m) : null, prev = porMes(anioU - 1, m);
    return { label, mes: m, cur, prev: prev || null, yoy: cur != null && prev ? yoyDe(cur, prev) : null };
  });

  // Mixes del período: canal (por cuenta) · marca · categoría (sku × año del año usado).
  const canalMap = new Map();
  for (const f of conFuente) {
    const v = modo === 'mes' ? f.importe : f.ytd; if (!(v > 0)) continue;
    canalMap.set(f.canal, (canalMap.get(f.canal) || 0) + v);
  }
  const rd = new Map(roadmap.map((r) => [String(r.sku || '').toUpperCase(), r]));
  const marcaMap = new Map(), catMap = new Map();
  const activos = new Set();
  for (const r of skuAnio) {
    if (N(r.anio) !== anioU) continue;
    const v = sumaMeses(r.monto, mesesPeriodo), pz = sumaMeses(r.piezas, mesesPeriodo);
    if (!(v > 0) && !(pz > 0)) continue;
    const k = String(r.sku || '').toUpperCase();
    activos.add(k);
    const rr = rd.get(k);
    const marca = normalizarMarca(rr?.marca || r.marca) || marcaDeSku(k) || 'Otras';
    const cat = rr?.categoria || r.categoria || 'Sin categoría';
    if (v > 0) { marcaMap.set(marca, (marcaMap.get(marca) || 0) + v); catMap.set(cat, (catMap.get(cat) || 0) + v); }
  }
  const aFilas = (m, etiqueta = (k) => k) => [...m.entries()].map(([k, v]) => ({ key: k, label: etiqueta(k), v })).sort((a, b) => b.v - a.v);
  const mixes = { canal: aFilas(canalMap, canalLabel), marca: aFilas(marcaMap), categoria: aFilas(catMap) };

  // SKUs activos frente al roadmap.
  const skusRoadmap = new Set(roadmap.map((r) => String(r.sku || '').toUpperCase()).filter(Boolean));
  const sinMovimiento = [...skusRoadmap].filter((s) => !activos.has(s)).length;

  // Tabla por SKU × 12 meses (ventana que termina en el mes usado).
  const tabla = filasSkuAnual({ rows: skuAnio, anio: anioU, mes: mesU, roadmap });
  const columnas = columnasVentana(anioU, mesU);

  const periodoLbl = modo === 'mes' ? `${MESES[mesU - 1]} ${anioU}` : `${anioU} a ${MESES[mesU - 1].toLowerCase()}`;
  const frase = u.vacio ? 'Todavía no hay sell out cargado en este período.' : fraseSellOut({ importe, yoy, soSi, semanas, anio: anioU, mes: mesU, modo, enCurso });

  return {
    anio: anioU, mes: mesU, esOtroMes: u.esOtroMes, vacio: !!u.vacio, enCurso, corteDia, modo, periodoLbl,
    importe, importePrev, yoy, cantidad, sellIn, soSi, cuentasConSellOut, cuentasConFuente: conFuente.length,
    inv: { valor: tot.invValor, piezas: invPiezas, cuentas: conInv.length, semanas },
    skus: { activos: activos.size, roadmap: skusRoadmap.size, sinMovimiento },
    top5, reparto, frase, serie, mixes, tabla, columnas, filas,
  };
}
