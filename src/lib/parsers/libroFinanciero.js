// Libro financiero mensual de los consultores · "REVKO LIBRO MM-MM-AA.xlsx" (2026-11-09).
// Un libro por mes. Lee las hojas de valor y las deja en formato largo en `libro_financiero`
// (anio, mes, hoja, clave, columna → valor). Las hojas que traen varios meses o años (gastos por mes,
// cartera, ventas/utilidad de 5 años, rotación de inventario, personal) se guardan con SU periodo, así que
// el libro más reciente actualiza también los meses anteriores (los consultores los re-expresan).
//   conso            CONSO GRAL · mes y acumulado del libro: real · ppto · alcance · pct (por periodo)
//                    + CONSO. COMP. AÑO ANTER. · lo mismo para el año anterior (anio − 1)
//   gastos           GTOS.GDL X MES · cuenta × mes · nivel (0 grupo · 1 cuenta · 2 subcuenta) y padre
//   gastos_acum      GTOS.GDL COMP. AÑO ANT. · acumulado al mes por cuenta, año actual y anterior
//   cartera          CART.X MES · antigüedad por mes (miles) · por_vencer · d1_30 … mas_180 · total · reserva · dias
//   ventas_utilidad  COMP.VTAS.UTIL. · ventas y utilidad por mes de 5 años (mes 0 = total del año)
//   inventario       COMP.ROTAC.INVENT. · inventario y rotación (días) por mes de 5 años
//   personal         REP EMPLEADOS · personas · venta_persona · utilidad_persona (años cerrados con mes 0)
//   balance          E.ORIGEN · saldo inicial (dic año anterior) · saldo · origen propios/ajenos · aplicación
//   roi              ROI · capital inicial · utilidad · roi · anualizado y sus presupuestos
import { XLSX, norm } from './_util';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const slug = (s) => norm(s).replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const texto = (v) => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim());
const mesDeNombre = (s) => { const n = norm(s).replace(/\./g, '').trim(); const i = MESES.findIndex((m) => n === m || n.startsWith(m.slice(0, 3))); return i >= 0 ? i + 1 : null; };
const fechaSerial = (v) => { if (typeof v !== 'number') return null; const d = new Date(Math.round((v - 25569) * 86400 * 1000)); return isNaN(d) ? null : { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1 }; };

function hoja(wb, ...nombres) {
  for (const n of nombres) { if (wb.Sheets[n]) return wb.Sheets[n]; }
  // tolerante a espacios finales y mayúsculas
  const k = Object.keys(wb.Sheets).find((s) => nombres.some((n) => norm(s) === norm(n)));
  return k ? wb.Sheets[k] : null;
}
const filas = (X, sh) => (sh ? X.utils.sheet_to_json(sh, { defval: null, header: 1, raw: true }) : []);

/** Periodo del libro: título de CONSO GRAL («INFORME CONSOLIDADO A SEPTIEMBRE 2026») o nombre del archivo MM-MM-AA. */
export function periodoDelLibro(arrConso, fileName = '') {
  for (const r of arrConso.slice(0, 4)) for (const v of r || []) {
    if (typeof v !== 'string') continue;
    const m = v.match(/\bA\s+([A-ZÁÉÍÓÚa-záéíóú]+)\s+(?:DE\s+)?(20\d{2})/i);
    if (m) { const mes = mesDeNombre(m[1]); if (mes) return { anio: Number(m[2]), mes, origen: 'título del libro' }; }
  }
  const f = String(fileName || '').match(/(\d{1,2})-(\d{1,2})-(\d{2,4})/);
  if (f) { const mes = Number(f[2]); const aa = Number(f[3]); if (mes >= 1 && mes <= 12) return { anio: aa < 100 ? 2000 + aa : aa, mes, origen: 'nombre del archivo' }; }
  throw new Error('No se detectó el mes del libro: la hoja CONSO GRAL debe decir «… A <MES> <AÑO>» o el archivo llamarse MM-MM-AA.xlsx');
}

// CONSO GRAL y CONSO. COMP. AÑO ANTER. comparten renglones: un concepto y debajo sus «Presupuesto», «% alcanzado»…
const CLAVES_CONSO = {
  ventas_netas: 'ventas', utilidad_bruta: 'utilidad_bruta', utilidad_bruta_pct: 'margen_bruto', gastos_de_operacion: 'gastos',
  gastos_financieros: 'gastos_financieros', perdida_cambiaria: 'perdida_cambiaria', utilidad_neta: 'utilidad_neta',
  ventas_netas_c_iva: 'ventas_con_iva', ventas_tasa_0: 'ventas_tasa_0', cobranza_neta_c_iva: 'cobranza', cobrado_pct: 'cobrado',
  dias_cartera: 'dias_cartera', cartera_120: 'cartera_mas_120', cartera_total: 'cartera_total', rot_inventario: 'rotacion', p_terminado_dias: 'dias_inventario',
  importe: 'inventario', pasivo_bancos: 'pasivo_bancos', pasivo_prov_y_otros: 'pasivo_proveedores', suma_a_terceros: 'pasivo_terceros',
  deuda_a_filiales: 'deuda_filiales', deuda_a_socios: 'deuda_socios', pasivo_total: 'pasivo_total',
};
const SUBFILAS_CONSO = new Set(['gastos_financieros', 'perdida_cambiaria']);
function claveConso(label) {
  let s = slug(label);
  if (/^%\s*utilidad bruta/i.test(label)) s = 'utilidad_bruta_pct';
  else if (/^%\s*cobrado/i.test(label)) s = 'cobrado_pct';
  else if (/^cartera\s*\+/i.test(label)) s = 'cartera_120';
  return CLAVES_CONSO[s] || s;
}
/** Lee un bloque de consolidado: [{ label, valores: [...] }] → filas largas con columnas real/ppto/alcance/pct por periodo. */
function leerConso(rowsLabelValores, periodos) {
  const out = [];
  let actual = null, orden = 0;
  for (const { label, valores } of rowsLabelValores) {
    const l = texto(label); if (!l) continue;
    const n = norm(l);
    let campo = null;
    if (/^presupuesto/.test(n)) campo = 'ppto';
    else if (/^%\s*alcanzado/.test(n)) campo = 'alcance';
    else if (/^%\s*presupuesto/.test(n)) campo = 'ppto';
    else if (/^%\s*gastado/.test(n) || (/^%\s*s\/\s*ventas/.test(n))) campo = 'pct';
    else if (n === '%') campo = 'pct';
    if (campo && actual) {
      periodos.forEach((p, i) => { const v = num(valores[i]); if (v != null) out.push({ clave: actual, columna: `${campo}_${p}`, valor: v, concepto: null, orden: null }); });
      continue;
    }
    const clave = claveConso(l);
    if (!clave) continue;
    // Gastos financieros y pérdida cambiaria van debajo de GASTOS DE OPERACION y el «Presupuesto» / «% gastado»
    // que les sigue es el de los gastos de operación: no cambian el concepto al que se cuelgan esas filas.
    if (!SUBFILAS_CONSO.has(clave)) actual = clave;
    orden++;
    periodos.forEach((p, i) => { const v = num(valores[i]); if (v != null) out.push({ clave, columna: `real_${p}`, valor: v, concepto: l, orden }); });
    if (!periodos.some((p, i) => num(valores[i]) != null)) out.push({ clave, columna: `real_${periodos[0]}`, valor: null, concepto: l, orden });
  }
  return out.filter((r) => r.valor != null);
}

/** Grupos de gastos: una fila es grupo si su acumulado = la suma de las k filas siguientes (k ≤ 14), con tolerancia. */
export function nivelesGastos(cuentas) {
  // cuentas: [{ label, acum }] en orden. Devuelve [{ nivel, padreIdx, hijos }].
  const n = cuentas.length;
  const res = cuentas.map(() => ({ nivel: 0, padreIdx: null, hijos: 0 }));
  const casi = (a, b) => Math.abs(a - b) <= Math.max(2, Math.abs(a) * 0.002);
  for (let i = 0; i < n; i++) {
    const a = cuentas[i].acum;
    if (a == null || a === 0) continue;
    let suma = 0;
    for (let k = 1; k <= 14 && i + k < n; k++) {
      const b = cuentas[i + k].acum;
      if (b == null) break;
      suma += b;
      if (casi(suma, a) && k >= 1) {
        // k hijos directos (sólo los que no están ya anidados bajo un hijo anterior)
        let j = i + 1;
        while (j <= i + k) {
          if (res[j].padreIdx == null) { res[j].padreIdx = i; res[j].nivel = 1; }
          j++;
        }
        res[i].hijos = k;
        break;
      }
    }
  }
  // niveles por cadena de padres
  const nivelDe = (idx, g = 0) => (res[idx].padreIdx == null || g > 6 ? 0 : 1 + nivelDe(res[idx].padreIdx, g + 1));
  return res.map((r, idx) => ({ nivel: nivelDe(idx), padreIdx: r.padreIdx, hijos: r.hijos }));
}

export default function libroFinanciero(wb, fileName = '') {
  const X = XLSX();
  const arrConso = filas(X, hoja(wb, 'CONSO GRAL'));
  if (!arrConso.length) throw new Error('No se encontró la hoja «CONSO GRAL»: ¿es el libro mensual de los consultores?');
  const { anio, mes, origen } = periodoDelLibro(arrConso, fileName);
  const rows = [];
  const push = (r) => rows.push({ anio: r.anio ?? anio, mes: r.mes ?? mes, hoja: r.hoja, clave: r.clave, columna: r.columna || 'valor', valor: r.valor, concepto: r.concepto ?? null, orden: r.orden ?? null, nivel: r.nivel ?? null, padre: r.padre ?? null, libro_anio: anio, libro_mes: mes });

  // ── conso (mes · acum) ──
  const hdr = arrConso.findIndex((r) => (r || []).some((v) => norm(v) === 'concepto'));
  const consoRows = arrConso.slice(hdr + 1).map((r) => ({ label: r?.[0], valores: [r?.[1], r?.[2]] }));
  leerConso(consoRows, ['mes', 'acum']).forEach((r) => push({ hoja: 'conso', ...r }));

  // ── comparativo con el año anterior → conso del año anterior ──
  const arrComp = filas(X, hoja(wb, 'CONSO. COMP. AÑO ANTER.', 'CONSO. COMP. AÑO ANTER'));
  if (arrComp.length) {
    const h = arrComp.findIndex((r) => (r || []).some((v) => norm(v) === 'concepto'));
    const head = arrComp[h] || [];
    // columnas: [MES año-1, MES año, ACUM año-1, ACUM año]; detecta por valor de encabezado
    const cols = {};
    head.forEach((v, c) => { if (num(v) === anio - 1) cols[cols.mes_ant == null ? 'mes_ant' : 'acum_ant'] = c; });
    if (cols.mes_ant != null && cols.acum_ant != null) {
      const compRows = arrComp.slice(h + 1).map((r) => ({ label: r?.[0], valores: [r?.[cols.mes_ant], r?.[cols.acum_ant]] }));
      leerConso(compRows, ['mes', 'acum']).forEach((r) => push({ hoja: 'conso', anio: anio - 1, mes, ...r }));
    }
  }

  // ── gastos por mes ──
  const arrG = filas(X, hoja(wb, 'GTOS.GDL X MES'));
  if (arrG.length) {
    const h = arrG.findIndex((r) => (r || []).filter((v) => mesDeNombre(v)).length >= 1);
    const head = arrG[h] || [];
    const colMes = {}; let colAcum = null;
    head.forEach((v, c) => { const m = mesDeNombre(v); if (m && typeof v === 'string' && MESES.includes(norm(v))) colMes[c] = m; });
    (arrG[h - 1] || []).forEach((v, c) => { if (norm(v) === 'acumulado') colAcum = c; });
    if (colAcum == null) colAcum = Math.max(...Object.keys(colMes).map(Number)) + 1;
    const cuentas = [];
    for (let r = h + 1; r < arrG.length; r++) {
      const row = arrG[r]; const label = texto(row?.[0]); if (!label) continue;
      const n = norm(label);
      if (/^suma total/.test(n) || /^%/.test(n) || n === 'ventas') continue;
      const acum = num(row[colAcum]) ?? Object.keys(colMes).reduce((s, c) => s + (num(row[c]) || 0), 0);
      cuentas.push({ label, acum, row });
    }
    const niveles = nivelesGastos(cuentas);
    const vistos = new Map();
    const claves = cuentas.map((c) => { let k = slug(c.label); const v = (vistos.get(k) || 0) + 1; vistos.set(k, v); return v > 1 ? `${k}_${v}` : k; });
    cuentas.forEach((c, i) => {
      const padre = niveles[i].padreIdx == null ? null : claves[niveles[i].padreIdx];
      for (const [col, m] of Object.entries(colMes)) {
        const v = num(c.row[col]);
        if (v == null) continue;
        push({ hoja: 'gastos', anio, mes: m, clave: claves[i], valor: v, concepto: c.label, orden: i + 1, nivel: niveles[i].nivel, padre });
      }
    });
    // ── gastos acumulados vs año anterior ──
    const arrGA = filas(X, hoja(wb, 'GTOS.GDL COMP. AÑO ANT.', 'GTOS.GDL COMP. AÑO ANT'));
    if (arrGA.length) {
      const hh = arrGA.findIndex((r) => (r || []).some((v) => num(v) === anio) && (r || []).some((v) => num(v) === anio - 1));
      const head2 = arrGA[hh] || [];
      let cAnt = null, cAct = null;
      head2.forEach((v, c) => { if (num(v) === anio - 1) cAnt = c; if (num(v) === anio) cAct = c; });
      const vistos2 = new Map();
      let o = 0;
      for (let r = hh + 1; r < arrGA.length; r++) {
        const row = arrGA[r]; const label = texto(row?.[0]); if (!label) continue;
        const n = norm(label); if (/^suma total/.test(n) || n === 'ventas') continue;
        let k = slug(label); const v = (vistos2.get(k) || 0) + 1; vistos2.set(k, v); if (v > 1) k = `${k}_${v}`;
        o++;
        const i = claves.indexOf(k);
        const nivel = i >= 0 ? niveles[i].nivel : null, padre = i >= 0 && niveles[i].padreIdx != null ? claves[niveles[i].padreIdx] : null;
        if (cAnt != null && num(row[cAnt]) != null) push({ hoja: 'gastos_acum', anio: anio - 1, mes, clave: k, valor: num(row[cAnt]), concepto: label, orden: o, nivel, padre });
        if (cAct != null && num(row[cAct]) != null) push({ hoja: 'gastos_acum', anio, mes, clave: k, valor: num(row[cAct]), concepto: label, orden: o, nivel, padre });
      }
    }
  }

  // ── cartera por mes (miles) ──
  const arrC = filas(X, hoja(wb, 'CART.X MES ', 'CART.X MES'));
  if (arrC.length) {
    const buckets = ['por_vencer', 'd1_30', 'd31_60', 'd61_90', 'd91_180', 'mas_180', 'total', 'reserva', 'dias'];
    for (const row of arrC) {
      const label = texto(row?.[0]); if (!label) continue;
      const n = norm(label);
      let a = anio, m = null;
      const md = n.match(/^dic\.?\s*(?:del\s*)?(20\d{2})/); if (md) { a = Number(md[1]); m = 12; }
      else m = mesDeNombre(label);
      if (!m || /^dif/.test(n)) continue;
      const vals = row.slice(1, 10);
      if (!vals.some((v) => num(v) != null)) continue;
      buckets.forEach((b, i) => { const v = num(vals[i]); if (v != null) push({ hoja: 'cartera', anio: a, mes: m, clave: b, valor: v, concepto: label, orden: i + 1 }); });
    }
  }

  // ── ventas y utilidad de 5 años · inventario y rotación de 5 años ──
  const porAnios = (arr, hojaNombre, campos) => {
    if (!arr.length) return;
    const hy = arr.findIndex((r) => (r || []).filter((v) => num(v) >= 2000 && num(v) <= 2100).length >= 2);
    if (hy < 0) return;
    const anios = []; (arr[hy] || []).forEach((v, c) => { if (num(v) >= 2000 && num(v) <= 2100) anios.push({ anio: num(v), col: c }); });
    for (let r = hy + 1; r < arr.length; r++) {
      const row = arr[r]; const label = texto(row?.[0]); if (!label) continue;
      const n = norm(label);
      let m = mesDeNombre(label), offsetAnio = 0;
      if (/^totales?$/.test(n)) m = 0;
      else if (/^dic/.test(n) && /anter/.test(n)) { m = 12; offsetAnio = -1; }
      if (m == null) continue;
      for (const { anio: a, col } of anios) campos.forEach((campo, i) => { const v = num(row[col + i]); if (v != null) push({ hoja: hojaNombre, anio: a + offsetAnio, mes: m, clave: campo, valor: v, concepto: label }); });
    }
  };
  porAnios(filas(X, hoja(wb, 'COMP.VTAS.UTIL.')), 'ventas_utilidad', ['ventas', 'utilidad']);
  porAnios(filas(X, hoja(wb, 'COMP.ROTAC.INVENT.')), 'inventario', ['inventario', 'rotacion']);

  // ── personal ──
  const arrP = filas(X, hoja(wb, 'REP EMPLEADOS'));
  if (arrP.length) {
    const hy = arrP.findIndex((r) => (r || []).filter((v) => num(v) >= 2000 && num(v) <= 2100).length >= 2);
    const hd = arrP.findIndex((r) => (r || []).filter((v) => num(v) > 40000 && num(v) < 60000).length >= 2);
    const cols = [];
    (arrP[hd] || []).forEach((v, c) => { const f = fechaSerial(v); if (f) cols.push({ col: c, ...f }); });
    // años cerrados (fin de diciembre) van con mes 0; los del año del libro con su mes
    const campos = [[/^ack|^personal|^colab/, 'personas'], [/^vtas?\s*\/\s*pers/, 'venta_persona'], [/^util\s*\/\s*pers/, 'utilidad_persona']];
    for (let r = Math.max(hy, hd) + 1; r < arrP.length; r++) {
      const row = arrP[r]; const label = texto(row?.[0]); if (!label) continue;
      const campo = campos.find(([re]) => re.test(norm(label)))?.[1]; if (!campo) continue;
      for (const { col, anio: a, mes: m } of cols) {
        const v = num(row[col]); if (v == null) continue;
        const cerrado = a < anio && m === 12;
        push({ hoja: 'personal', anio: a, mes: cerrado ? 0 : m, clave: campo, valor: v, concepto: label });
      }
    }
  }

  // ── balance y origen de recursos ──
  const arrB = filas(X, hoja(wb, 'E.ORIGEN'));
  if (arrB.length) {
    const hd = arrB.findIndex((r) => (r || []).filter((v) => num(v) > 40000 && num(v) < 60000).length >= 2);
    let seccion = null, o = 0;
    for (let r = hd + 1; r < arrB.length; r++) {
      const row = arrB[r]; if (!row) continue;
      const l0 = texto(row[0]), l1 = texto(row[1]);
      if (l0 && !l1) { const n = norm(l0); if (['activo', 'pasivo', 'capital'].includes(n)) { seccion = n; continue; } }
      const label = l1 || l0; if (!label) continue;
      const n = norm(label);
      if (/^suma /.test(n) || /^total/.test(n)) {
        const k = slug(label); o++;
        [['inicial', 2], ['saldo', 3], ['origen_propios', 4], ['origen_ajenos', 5], ['suma_origen', 6], ['aplicacion', 7]].forEach(([c, i]) => { const v = num(row[i]); if (v != null) push({ hoja: 'balance', clave: k, columna: c, valor: v, concepto: label, orden: o, nivel: 0, padre: null }); });
        continue;
      }
      if (!seccion) continue;
      const k = slug(label); o++;
      [['inicial', 2], ['saldo', 3], ['origen_propios', 4], ['origen_ajenos', 5], ['suma_origen', 6], ['aplicacion', 7]].forEach(([c, i]) => { const v = num(row[i]); if (v != null) push({ hoja: 'balance', clave: k, columna: c, valor: v, concepto: label, orden: o, nivel: 1, padre: seccion }); });
    }
  }

  // ── ROI ──
  const arrR = filas(X, hoja(wb, 'ROI ', 'ROI'));
  if (arrR.length) {
    const r = arrR.find((row) => mesDeNombre(row?.[0]) === mes) || arrR.find((row) => mesDeNombre(row?.[0]));
    if (r) ['capital_inicial', 'utilidad', 'roi', 'anualizado', 'ppto_utilidad', 'ppto_roi', 'ppto_anualizado', 'diferencia'].forEach((k, i) => { const v = num(r[i + 1]); if (v != null) push({ hoja: 'roi', clave: k, valor: v, concepto: texto(r[0]) }); });
  }

  // Una misma llave puede salir dos veces (p. ej. diciembre del año anterior aparece en la columna del año
  // anterior y como «DIC AÑO ANTER.» del actual): se queda la última, el upsert no admite repetidas.
  const unicos = new Map();
  for (const r of rows) unicos.set(`${r.anio}|${r.mes}|${r.hoja}|${r.clave}|${r.columna}`, r);
  const filasUnicas = [...unicos.values()];
  const hojas = [...new Set(filasUnicas.map((r) => r.hoja))];
  return {
    table: 'libro_financiero',
    onConflict: 'anio,mes,hoja,clave,columna',
    rows: filasUnicas,
    periodoLibro: { anio, mes, origen },   // no se llama `periodo`: el importador reservaría ese campo para confirmar semanas
    resumen: `Libro ${MESES_ABR[mes - 1]} ${anio} (${origen}) · ${filasUnicas.length} datos · hojas: ${hojas.join(', ')}`,
  };
}
