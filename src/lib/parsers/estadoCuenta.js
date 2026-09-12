// Estados de cuenta semanales (00764 Digitalife · 00473 PCEL · 00708 Dicotech/REVKO).
// Dos formatos: A) "Estado de cuenta de la Semana N Del … al …" con resumen + detalle;
// B) "Antigüedad de Saldos" (sin semana: se calcula ISO desde la fecha del pie).
// No va por import-central: devuelve { endpoint: '/api/upload-estado-cuenta', body }
// (upsert de estados_cuenta por cliente/anio/semana + detalle + tipo de cambio).
import { XLSX, objSnake, toStr, toNum, toInt, toISODate, isoWeek, anioSemanaISO } from './_util';

const MESES_ES = {
  ene: 1, enero: 1, feb: 2, febrero: 2, mar: 3, marzo: 3, abr: 4, abril: 4, may: 5, mayo: 5, jun: 6, junio: 6,
  jul: 7, julio: 7, ago: 8, agosto: 8, sep: 9, sept: 9, septiembre: 9, oct: 10, octubre: 10, nov: 11, noviembre: 11, dic: 12, diciembre: 12,
};
const mesES = (s) => MESES_ES[String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')];
const RAZON = { pcel: 'PC ONLINE', dicotech: 'REVKO TECHNOLOGY SA DE CV', digitalife: 'API GLOBAL' };

const dso = (detalle, base) => {
  let sumDays = 0, sumSaldo = 0;
  for (const d of detalle) {
    if (d.saldo_actual > 0 && d.fecha_emision) {
      const days = Math.max(0, Math.floor((base - new Date(d.fecha_emision + 'T00:00:00')) / 86400000));
      sumDays += days * d.saldo_actual; sumSaldo += d.saldo_actual;
    }
  }
  return sumSaldo > 0 ? Math.round(sumDays / sumSaldo) : null;
};
const vencimientos = (detalle, base) => {
  const map = {};
  for (const d of detalle) if (d.vencimiento && d.saldo_actual > 0) { const k = d.vencimiento.slice(0, 7); map[k] = (map[k] || 0) + d.saldo_actual; }
  const key = (off) => { const d = new Date(base.getFullYear(), base.getMonth() + off, 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
  return { venc_mes_1: map[key(0)] || 0, venc_mes_2: map[key(1)] || 0, venc_mes_3: map[key(2)] || 0 };
};

function formatoSemanal(sh, cliente, fileName) {
  const X = XLSX();
  const scan = X.utils.sheet_to_json(sh, { header: 1, defval: null, range: 0 }).slice(0, 20);
  let rowEncabezado = -1, rowSaldoHead = -1, rowMovHead = -1;
  for (let i = 0; i < scan.length; i++) {
    const joined = (scan[i] || []).map((c) => String(c || '')).join('|').toLowerCase();
    if (rowEncabezado < 0 && joined.includes('estado de cuenta de la semana')) rowEncabezado = i;
    if (rowSaldoHead < 0 && joined.includes('saldo actual') && joined.includes('saldo vencido')) rowSaldoHead = i;
    if (rowMovHead < 0 && (joined.startsWith('movimientos|') || joined.includes('|movimiento|') || joined.includes('|movimientos|'))) rowMovHead = i;
  }
  const rowSaldoVals = rowSaldoHead >= 0 ? rowSaldoHead + 1 : -1;

  let semana = null, fecha_corte = null, year = new Date().getFullYear();
  const encabezado = rowEncabezado >= 0 ? scan[rowEncabezado].map((c) => String(c || '')).join(' ') : '';
  const mm = encabezado.match(/Semana\s+(\d+)\s+Del\s+(\d{2}\/\d{2}\/\d{4})\s+al\s+(\d{2}\/\d{2}\/\d{4})/i);
  if (mm) {
    semana = parseInt(mm[1], 10);
    const p = mm[3].split('/'); fecha_corte = `${p[2]}-${p[1]}-${p[0]}`; year = parseInt(p[2], 10);
  } else {
    const m2 = String(fileName || '').match(/Semana\s*(\d+)/i);
    if (m2) semana = parseInt(m2[1], 10);
    fecha_corte = new Date().toISOString().slice(0, 10);
  }

  let razon_social = null;
  if (rowSaldoVals >= 0) {
    for (const c of scan[rowSaldoVals] || []) { const v = toStr(c); if (v && v.length > 4 && !/^\d+([.,]\d+)?$/.test(v)) { razon_social = v; break; } }
  }
  if (!razon_social) razon_social = RAZON[cliente] || RAZON.digitalife;

  let saldo_actual = 0, saldo_vencido = 0, notas_credito = 0, saldo_a_vencer = 0;
  if (rowSaldoHead >= 0) {
    const heads = (scan[rowSaldoHead] || []).map((c) => String(c || '').toLowerCase());
    const vals = scan[rowSaldoVals] || [];
    const at = (pred) => { const i = heads.findIndex(pred); return i >= 0 ? (toNum(vals[i]) || 0) : 0; };
    saldo_actual = at((h) => h.includes('saldo actual'));
    saldo_vencido = at((h) => h.includes('saldo vencido'));
    notas_credito = at((h) => h.includes('notas credito') || h.includes('notas crédito'));
    saldo_a_vencer = at((h) => h.includes('saldo a vencer'));
  }

  const rows = X.utils.sheet_to_json(sh, { defval: null, range: rowMovHead >= 0 ? rowMovHead : 9 });
  const detalle = [];
  let aging_d0_30 = 0, aging_d31_60 = 0, aging_d61_90 = 0, aging_mas90 = 0;
  for (const r of rows) {
    const obj = objSnake(r);
    const importe = toNum(obj.importe_factura ?? obj.importe);
    const saldo = toNum(obj.saldo_actual ?? obj.saldo) || 0;
    if (!obj.movimientos && !importe && !saldo) continue;
    const movStr = String(obj.movimientos || obj.movimiento || '').trim();
    if (!movStr && (importe || saldo)) continue; // SUBTOTAL / TOTAL sin folio
    const ag_corr = toNum(obj.corriente) || 0;
    const ag_01_30 = toNum(obj['01_30_dias'] ?? obj._01_30_dias) || 0;
    const ag_31_60 = toNum(obj['31_60_dias'] ?? obj._31_60_dias) || 0;
    const ag_61_90 = toNum(obj['61_90_dias'] ?? obj._61_90_dias) || 0;
    const ag_91_180 = toNum(obj['91_180_dias'] ?? obj._91_180_dias) || 0;
    const ag_181 = toNum(obj.mas_de_181_dias ?? obj._mas_de_181_dias) || 0;
    aging_d0_30 += ag_01_30; aging_d31_60 += ag_31_60; aging_d61_90 += ag_61_90; aging_mas90 += ag_91_180 + ag_181;
    detalle.push({
      movimiento: toStr(obj.movimientos ?? obj.movimiento), condicion: toStr(obj.condicion), referencia: toStr(obj.referencia),
      fecha_emision: toISODate(obj.fecha_emision), vencimiento: toISODate(obj.vencimiento), importe_factura: importe,
      dias_moratorios: toInt(obj.dias_moratorios), saldo_actual: saldo,
      aging_corriente: ag_corr, aging_01_30: ag_01_30, aging_31_60: ag_31_60, aging_61_90: ag_61_90, aging_91_180: ag_91_180, aging_181_mas: ag_181,
    });
  }
  const base = fecha_corte ? new Date(fecha_corte + 'T00:00:00') : new Date();
  return {
    resumen: {
      cliente, anio: year, semana, fecha_corte, saldo_actual, saldo_vencido, notas_credito, saldo_a_vencer, razon_social,
      aging_d0_30, aging_d31_60, aging_d61_90, aging_mas90, ...vencimientos(detalle, base), dso: dso(detalle, new Date()),
    },
    detalle,
  };
}

function formatoAntiguedad(sh, cliente) {
  const X = XLSX();
  const arr = X.utils.sheet_to_json(sh, { defval: null, header: 1 });
  const parseFechaES = (raw) => {
    if (raw == null || raw === '') return null;
    if (typeof raw === 'number') { const d = new Date((raw - 25569) * 86400 * 1000); return isNaN(d) ? null : d.toISOString().slice(0, 10); }
    const s = String(raw).trim().replace(/\./g, '');
    const m = s.match(/^(\d{1,2})\/([a-záéíóú]+)\/(\d{4})/i);
    if (m) { const mes = mesES(m[2]); return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}` : null; }
    return toISODate(raw);
  };
  let headerRow = -1;
  for (let i = 0; i < Math.min(arr.length, 10); i++) {
    const txt = (arr[i] || []).map((x) => String(x || '').toLowerCase()).join('|');
    if (txt.includes('movimiento') && (txt.includes('al corriente') || txt.includes('vencimiento'))) { headerRow = i; break; }
  }
  if (headerRow < 0) {
    // Variante simple: Fecha Expedicion · Factura · … · Importe · Días Vencido (sin cubetas).
    for (let i = 0; i < Math.min(arr.length, 10); i++) {
      const txt = (arr[i] || []).map((x) => String(x || '').toLowerCase()).join('|');
      if (txt.includes('factura') && txt.includes('importe') && txt.includes('vencid')) {
        return formatoAntiguedadSimple(sh, cliente, i, arr, parseFechaES);
      }
    }
  }
  if (headerRow < 0) headerRow = 1;
  const headers = (arr[headerRow] || []).map((h) => String(h || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim());
  const colIdx = (substr) => headers.findIndex((h) => h.includes(substr));
  const idx = {
    cliente: colIdx('cliente'), movimiento: colIdx('movimiento'), referencia: colIdx('referencia'), emision: colIdx('emision'),
    vencimiento: colIdx('vencimiento'), dias: colIdx('dias'), corriente: colIdx('al corriente'),
    d1_30: headers.findIndex((h) => /1 a 30/.test(h)), d31_60: headers.findIndex((h) => /31 a 60/.test(h)), d61_90: headers.findIndex((h) => /61 a 90/.test(h)),
    d91_180: headers.findIndex((h) => /91 a 180/.test(h)), d181_360: headers.findIndex((h) => /181 a 360/.test(h)), d361_999: headers.findIndex((h) => /361 a 999/.test(h)),
    d999plus: headers.findIndex((h) => /mas de 999/.test(h) || /999 dias/.test(h)),
  };
  const razon_social = cliente === 'pcel' ? 'PC ONLINE' : 'API GLOBAL';
  const detalle = [];
  const tot = { corr: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181_360: 0, d361_999: 0, d999: 0 };
  let notas_credito = 0;
  for (let i = headerRow + 1; i < arr.length; i++) {
    const r = arr[i] || [];
    const movimiento = r[idx.movimiento];
    if (!movimiento) continue;
    const movStr = String(movimiento).trim().toLowerCase();
    if (movStr === '' || /^total/i.test(movStr) || /^subtotal/i.test(movStr)) continue;
    if (/^(lunes|martes|miercoles|miércoles|jueves|viernes|sabado|sábado|domingo)/i.test(movStr)) continue;
    if (r[idx.cliente] && /^\d{5,}$/.test(String(r[idx.cliente]).trim())) continue;
    const v = (k) => toNum(r[idx[k]]) || 0;
    const ag = { corr: v('corriente'), d1_30: v('d1_30'), d31_60: v('d31_60'), d61_90: v('d61_90'), d91_180: v('d91_180'), d181_360: v('d181_360'), d361_999: v('d361_999'), d999: v('d999plus') };
    const importe = Object.values(ag).reduce((a, b) => a + b, 0);
    if (importe < 0) notas_credito += importe;
    for (const k of Object.keys(tot)) tot[k] += ag[k];
    detalle.push({
      movimiento: toStr(movimiento), condicion: null, referencia: toStr(r[idx.referencia]),
      fecha_emision: parseFechaES(r[idx.emision]), vencimiento: parseFechaES(r[idx.vencimiento]),
      importe_factura: importe, dias_moratorios: toInt(r[idx.dias]), saldo_actual: importe,
      aging_corriente: ag.corr, aging_01_30: ag.d1_30, aging_31_60: ag.d31_60, aging_61_90: ag.d61_90, aging_91_180: ag.d91_180,
      aging_181_mas: ag.d181_360 + ag.d361_999 + ag.d999,
    });
  }
  let fecha_corte = null;
  for (let i = arr.length - 1; i >= Math.max(0, arr.length - 5) && !fecha_corte; i--) {
    const m = String((arr[i] || [])[0] || '').trim().match(/(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(\d{4})/i);
    if (m) { const mes = mesES(m[2]); if (mes) fecha_corte = `${m[3]}-${String(mes).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`; }
  }
  if (!fecha_corte) { const f = detalle.map((d) => d.fecha_emision).filter(Boolean).sort(); fecha_corte = f.length ? f[f.length - 1] : new Date().toISOString().slice(0, 10); }
  const corte = new Date(fecha_corte + 'T00:00:00');
  const saldo_a_vencer = tot.corr;
  const saldo_vencido = tot.d1_30 + tot.d31_60 + tot.d61_90 + tot.d91_180 + tot.d181_360 + tot.d361_999 + tot.d999;
  return {
    resumen: {
      cliente, anio: corte.getFullYear(), semana: isoWeek(corte), fecha_corte,
      saldo_actual: saldo_a_vencer + saldo_vencido, saldo_vencido, notas_credito, saldo_a_vencer, razon_social,
      aging_d0_30: tot.d1_30, aging_d31_60: tot.d31_60, aging_d61_90: tot.d61_90, aging_mas90: tot.d91_180 + tot.d181_360 + tot.d361_999 + tot.d999,
      ...vencimientos(detalle, corte), dso: dso(detalle, corte),
    },
    detalle,
  };
}

// Formato C · "Antigüedad de Saldos" SIMPLE (sin cubetas de aging):
//   Fecha Expedicion · Factura · Condicion · Fecha Vencimiento · Importe · Moneda · Referencia · Días Vencido
// Lo manda crédito para algunos cortes de PCEL. El aging se reconstruye con "Días Vencido".
function formatoAntiguedadSimple(sh, cliente, headerRow, arr, parseFechaES) {
  const headers = (arr[headerRow] || []).map((h) => String(h || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim());
  const col = (...subs) => headers.findIndex((h) => subs.some((x) => h.includes(x)));
  const idx = { emision: col('expedicion', 'emision'), factura: col('factura'), condicion: col('condicion'), vencimiento: col('vencimiento'), importe: col('importe'), referencia: col('referencia'), dias: col('dias') };
  const detalle = [];
  const tot = { corr: 0, d1_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181: 0 };
  let notas_credito = 0;
  for (let i = headerRow + 1; i < arr.length; i++) {
    const r = arr[i] || [];
    const factura = toStr(r[idx.factura]);
    if (!factura || /^(sub)?total/i.test(factura)) continue;
    const importe = toNum(r[idx.importe]);
    if (importe == null) continue;
    if (importe < 0) notas_credito += importe;
    const dias = toInt(r[idx.dias]) ?? 0;
    const ag = { corriente: 0, d01_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, d181: 0 };
    if (dias <= 0) { ag.corriente = importe; tot.corr += importe; }
    else if (dias <= 30) { ag.d01_30 = importe; tot.d1_30 += importe; }
    else if (dias <= 60) { ag.d31_60 = importe; tot.d31_60 += importe; }
    else if (dias <= 90) { ag.d61_90 = importe; tot.d61_90 += importe; }
    else if (dias <= 180) { ag.d91_180 = importe; tot.d91_180 += importe; }
    else { ag.d181 = importe; tot.d181 += importe; }
    detalle.push({
      movimiento: factura, condicion: toStr(r[idx.condicion]), referencia: toStr(r[idx.referencia]),
      fecha_emision: parseFechaES(r[idx.emision]), vencimiento: parseFechaES(r[idx.vencimiento]),
      importe_factura: importe, dias_moratorios: dias, saldo_actual: importe,
      aging_corriente: ag.corriente, aging_01_30: ag.d01_30, aging_31_60: ag.d31_60, aging_61_90: ag.d61_90, aging_91_180: ag.d91_180, aging_181_mas: ag.d181,
    });
  }
  const fechas = detalle.map((d) => d.fecha_emision).filter(Boolean).sort();
  const fecha_corte = fechas.length ? fechas[fechas.length - 1] : new Date().toISOString().slice(0, 10);
  const corte = new Date(fecha_corte + 'T00:00:00');
  const saldo_vencido = tot.d1_30 + tot.d31_60 + tot.d61_90 + tot.d91_180 + tot.d181;
  return {
    resumen: {
      cliente, anio: corte.getFullYear(), semana: isoWeek(corte), fecha_corte,
      saldo_actual: tot.corr + saldo_vencido, saldo_vencido, notas_credito, saldo_a_vencer: tot.corr,
      razon_social: RAZON[cliente] || RAZON.digitalife,
      aging_d0_30: tot.d1_30, aging_d31_60: tot.d31_60, aging_d61_90: tot.d61_90, aging_mas90: tot.d91_180 + tot.d181,
      ...vencimientos(detalle, corte), dso: dso(detalle, corte),
    },
    detalle,
  };
}

export default function estadoCuenta(wb, fileName, opts = {}) {
  const cliente = opts.cliente;
  if (!cliente) throw new Error('estadoCuenta: falta opts.cliente');
  const sh = wb.Sheets[wb.SheetNames[0]];
  const a1 = String((sh['A1'] && sh['A1'].v) || '').toLowerCase();
  const data = a1.includes('antig') && a1.includes('saldos') ? formatoAntiguedad(sh, cliente) : formatoSemanal(sh, cliente, fileName);
  const r = data.resumen;
  // El corte manda sobre lo que traiga el archivo: si el usuario eligió la fecha/semana
  // en el importador, esa gana (permite cargar histórico sin pisar la semana vigente).
  if (opts.anio && opts.semana) { r.anio = Number(opts.anio); r.semana = Number(opts.semana); }
  else if (opts.fechaCorte) {
    const d = new Date(opts.fechaCorte);
    if (!isNaN(d)) { const { anio, semana } = anioSemanaISO(d); r.anio = anio; r.semana = semana; r.fecha_corte = d.toISOString().slice(0, 10); }
  }
  if (!r.semana) throw new Error('El archivo no trae la semana ni la fecha de corte: elígela en el importador antes de subir.');
  const $ = (n) => Math.round(n || 0).toLocaleString('es-MX');
  return {
    endpoint: '/api/upload-estado-cuenta', body: data, filas: data.detalle.length, periodo: { anio: r.anio, semana: r.semana },
    resumen: `sem ${r.semana}/${r.anio} · saldo ${$(r.saldo_actual)} · vencido ${$(r.saldo_vencido)} · DSO ${r.dso ?? '—'}d · ${data.detalle.length} facturas`,
  };
}
