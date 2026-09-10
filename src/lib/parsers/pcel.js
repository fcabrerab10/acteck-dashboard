// PCEL · "venta-marca-ACTECK.xlsx" (hoja "Ventas por Fabricante"). Un solo archivo alimenta
// sellout_pcel (semana "Vta Semana N"), sellout_pcel_mensual (columnas vta_<mes>) y
// catalogo_sku_pcel (1 fila por SKU).
import { XLSX, objSnake, toStr, toNum, toInt, primeraHoja } from './_util';

const MES_NUM = { ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6, jul: 7, ago: 8, sep: 9, set: 9, oct: 10, nov: 11, dic: 12 };
const MES_NOMBRE = { 1: 'Ene', 2: 'Feb', 3: 'Mar', 4: 'Abr', 5: 'May', 6: 'Jun', 7: 'Jul', 8: 'Ago', 9: 'Sep', 10: 'Oct', 11: 'Nov', 12: 'Dic' };

function leer(wb) {
  const sh = primeraHoja(wb, 'Ventas por Fabricante');
  const rows = XLSX().utils.sheet_to_json(sh, { defval: null });
  let semana = null;
  for (const h of Object.keys(rows[0] || {})) { const m = String(h).match(/vta\s+semana\s+(\d+)/i); if (m) { semana = parseInt(m[1], 10); break; } }
  return { rows: rows.map(objSnake), semana };
}

// Columnas mensuales vta_abr, vta_mar… ordenadas de la más reciente a la más vieja.
// Si el mes es mayor al actual se asume que es del año anterior.
function columnasMes(obj) {
  const year = new Date().getFullYear(), currentMonth = new Date().getMonth() + 1;
  return Object.keys(obj).filter((k) => /^vta_[a-z]{3}$/.test(k)).map((k) => {
    const num = MES_NUM[k.slice(4)];
    if (!num) return null;
    const anio = num > currentMonth ? year - 1 : year;
    return { key: k, mes: num, anio, sortKey: anio * 100 + num, nombre: MES_NOMBRE[num] };
  }).filter(Boolean).sort((a, b) => b.sortKey - a.sortKey);
}

export default function pcelVentaMarca(wb) {
  const { rows, semana } = leer(wb);
  if (semana == null) throw new Error('No se encontró la columna "Vta Semana N" en el archivo.');
  const year = new Date().getFullYear();
  const hoy = new Date().toISOString().slice(0, 10);
  const semanal = [], mensual = [], catalogo = [];
  const vistos = new Set();
  for (const obj of rows) {
    const sku = toStr(obj.sku);
    if (!sku) continue;
    const vtaSemKey = Object.keys(obj).find((k) => /vta_semana_\d+/.test(k));
    const meses = columnasMes(obj);
    const [m0 = {}, m1 = {}, m2 = {}, m3 = {}] = meses;
    semanal.push({
      anio: year, semana, sku, pcel_sku: sku, marca: toStr(obj.marca), modelo: toStr(obj.modelo), producto: toStr(obj.producto ?? obj.modelo),
      familia: toStr(obj.familia), subfamilia: toStr(obj.subfamilia), inventario: toInt(obj.inventario), costo_promedio: toNum(obj.costo_promedio),
      antiguedad: toInt(obj.antiguedad), transito: toInt(obj.transito), back_order: toInt(obj.back_order),
      vta_semana: toInt(vtaSemKey ? obj[vtaSemKey] : null),
      vta_mes_actual: toInt(m0.key ? obj[m0.key] : null), vta_mes_actual_nombre: m0.nombre || null,
      vta_mes_1: toInt(m1.key ? obj[m1.key] : null), vta_mes_1_nombre: m1.nombre || null,
      vta_mes_2: toInt(m2.key ? obj[m2.key] : null), vta_mes_2_nombre: m2.nombre || null,
      vta_mes_3: toInt(m3.key ? obj[m3.key] : null), vta_mes_3_nombre: m3.nombre || null,
    });
    for (const mc of meses) {
      const piezas = toInt(obj[mc.key]);
      if (piezas === null) continue;
      mensual.push({ anio: mc.anio, mes: mc.mes, nombre_mes: mc.nombre, sku, piezas, ultima_semana_cargada: semana });
    }
    if (!vistos.has(sku)) {
      vistos.add(sku);
      catalogo.push({ sku, producto: toStr(obj.producto), marca: toStr(obj.marca), modelo: toStr(obj.modelo), familia: toStr(obj.familia), subfamilia: toStr(obj.subfamilia), primera_aparicion: hoy, ultima_aparicion: hoy, apariciones: 1 });
    }
  }
  return [
    { table: 'sellout_pcel', onConflict: 'anio,semana,sku', rows: semanal, resumen: `semana ${semana}/${year} · ${semanal.length} SKUs` },
    { table: 'sellout_pcel_mensual', onConflict: 'anio,mes,sku', rows: mensual, resumen: `${mensual.length} filas mensuales` },
    { table: 'catalogo_sku_pcel', onConflict: 'sku', rows: catalogo, resumen: `${catalogo.length} SKUs en catálogo` },
  ];
}
