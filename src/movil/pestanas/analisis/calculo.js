// Análisis por cliente en el celular · cálculo puro (2026-10-05). Sin React ni Supabase: lo prueba
// scripts/test-analisis-movil-ssr.mjs con datos de ejemplo. Reusa el motor de la web (analisis/calc.js:
// agregarClientes, mapaCuotas, cuotaPeriodo, alcanceCuota) y sólo añade lo que la pantalla del celular necesita:
// frase del hero, KPIs de la cartera, filas por canal con su trazo de 6 meses, ritmo de compras y la serie
// sell in vs sell out del año.
import { agregarClientes, mapaCuotas, cuotaPeriodo, alcanceCuota, idxMes, yoyDe, MESES } from '../../../modules/comercial/analisis/calc';
import { semanasInventario, sumaUltimosMeses, idxMes as idxSo } from '../../../modules/comercial/sellout/calculo';
import { moneyCompact } from '../../../lib/format';

export const N = (v) => Number(v) || 0;
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pctTxt = (v) => `${Math.round(Math.abs(v))} %`;

/** Chips de canal de la lista: id → canales del ERP que agrupa (mv_analisis_cliente_mes.canal). */
export const CANALES_CHIP = [
  { id: 'todos', label: 'Todos', canales: null },
  { id: 'mayoreo', label: 'Mayoreo', canales: ['MAYOREO'] },
  { id: 'distribuidor', label: 'Distribuidor', canales: ['DISTRIBUIDOR'] },
  { id: 'retail', label: 'Retail', canales: ['RETAIL PROPIOS', 'RETAIL REPRESENTADOS'] },
  { id: 'ecommerce', label: 'E-commerce', canales: ['E-COMMERCE'] },
  { id: 'mostrador', label: 'Mostrador', canales: ['MOSTRADOR'] },
];

/** Fracción del mes transcurrida (para prorratear el año anterior «a mismo día» en el mes en curso). */
export function fraccionMes(anio, mes, hoy = new Date()) {
  const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  if (!enCurso) return 1;
  return Math.min(1, Math.max(1, hoy.getDate()) / new Date(anio, mes, 0).getDate());
}

/**
 * Lista de clientes del período (mes o YTD) con hero, KPIs y filas agrupadas por canal.
 * @param {object} p
 * @param {Array}  p.rows        mv_analisis_cliente_mes (2 años) · cliente, cliente_nombre, cliente_key, canal, anio, mes, fact_neta
 * @param {Array}  p.cuotasRows  v_cuota_erp_mes del año · cliente_erp, anio, mes, cuota_venta
 * @param {number} p.anio · p.mes · {'mes'|'ytd'} p.modo
 * @param {Function} [p.etiqueta] (cliente) → nombre bonito
 * @param {Function} [p.filtro]   (cliente) → bool (externos: sólo su cliente)
 */
export function resumenLista({ rows = [], cuotasRows = [], anio, mes, modo = 'mes', hoy = new Date(), etiqueta = (c) => c.nombre, filtro = null }) {
  const { clientes: todos } = agregarClientes(rows, anio, mes, modo);
  const mapa = mapaCuotas(cuotasRows);
  const factor = fraccionMes(anio, mes, hoy);
  const iFin = idxMes(anio, mes), iPrevMes = iFin - 1, iPrevAnioMes = idxMes(anio - 1, mes);
  const clientes = todos.filter((c) => !filtro || filtro(c)).map((c) => {
    const cur = c.cur.fact_neta, prevBruto = c.prev.fact_neta;
    const prevMesCompleto = N(c.mensual.get(iPrevAnioMes)?.fact_neta);
    // A mismo día: en modo mes se prorratea el mes del año anterior; en YTD sólo el mes en curso.
    const prev = modo === 'mes' ? prevBruto * factor : prevBruto - prevMesCompleto * (1 - factor);
    const yoy = yoyDe(cur, prev);
    const ytd = c.ytd.fact_neta, ytdPrev = c.ytdPrev.fact_neta - prevMesCompleto * (1 - factor);
    const cuota = cuotaPeriodo(mapa, c.cliente, anio, mes, modo), cuotaYtd = cuotaPeriodo(mapa, c.cliente, anio, mes, 'ytd');
    let prevAnioTotal = 0;
    for (const [k, a] of c.mensual) if (Math.floor(k / 12) === anio - 1) prevAnioTotal += N(a.fact_neta);
    const trazo6 = Array.from({ length: 6 }, (_, i) => N(c.mensual.get(iFin - 5 + i)?.fact_neta));
    const comproMesAnterior = N(c.mensual.get(iPrevMes)?.fact_neta) > 0;
    const curMes = N(c.mensual.get(iFin)?.fact_neta);
    return {
      cliente: c.cliente, nombre: c.nombre, label: etiqueta(c), key: c.key, canal: c.canal, propio: c.propio,
      cur, prev, yoy, ytd, ytdPrev, yoyYtd: yoyDe(ytd, ytdPrev), curMes,
      cuota, pctCuota: alcanceCuota(cur, cuota), cuotaYtd, pctCuotaYtd: alcanceCuota(ytd, cuotaYtd),
      // Relevante = cliente de verdad (≥ $50K en el año o con cuota); los conteos del hero y las tarjetas sólo cuentan a éstos,
      // si no el ERP mete 1,700 clientes de mostrador y e-commerce de una sola compra (2026-10-05).
      relevante: ytd >= 50000 || (cuotaYtd != null && cuotaYtd > 0),
      trazo6, riesgo: prev > 0 && yoy != null && yoy < -30 && (ytd >= 50000 || (cuotaYtd != null && cuotaYtd > 0)), nuevo: ytd >= 50000 && prevAnioTotal <= 0,
      sinCompraMes: comproMesAnterior && curMes <= 0, mesesCompra12: c.mesesCompra12, ultimaCompra: c.ultimaCompra,
    };
  });

  const activos = clientes.filter((c) => c.cur > 0).length;
  const conVentaAnio = clientes.filter((c) => c.relevante).length;
  const riesgo = clientes.filter((c) => c.riesgo).length;
  const nuevos = clientes.filter((c) => c.nuevo);
  const conCuota = clientes.filter((c) => c.cuota != null && c.cuota > 0);
  const conCuotaYtd = clientes.filter((c) => c.cuotaYtd != null && c.cuotaYtd > 0);
  const cuotaTotal = conCuota.reduce((s, c) => s + c.cuota, 0), ventaConCuota = conCuota.reduce((s, c) => s + c.cur, 0);
  const cuotaYtdTotal = conCuotaYtd.reduce((s, c) => s + c.cuotaYtd, 0), ytdConCuota = conCuotaYtd.reduce((s, c) => s + c.ytd, 0);
  const total = clientes.reduce((s, c) => s + c.cur, 0), totalPrev = clientes.reduce((s, c) => s + c.prev, 0);
  const grandes = [...conCuota].sort((a, b) => b.ytd - a.ytd).slice(0, 12);
  const bajoCuota = grandes.filter((c) => c.pctCuota != null && c.pctCuota < 100).length;
  const sinCompra = clientes.filter((c) => c.sinCompraMes).length;
  const yoyTotal = yoyDe(total, totalPrev);
  const mesPrevLbl = MESES_LARGO[(mes + 10) % 12];
  const frase = modo === 'mes'
    ? `${activos} clientes compraron ${moneyCompact(total)} en ${MESES_LARGO[mes - 1]}${grandes.length ? `; ${bajoCuota} de los ${grandes.length} grandes van abajo de su cuota` : ''}${sinCompra ? ` y ${sinCompra} cliente${sinCompra === 1 ? '' : 's'} de ${mesPrevLbl} no ${sinCompra === 1 ? 'ha' : 'han'} comprado` : ''}.`
    : `${activos} clientes compraron ${moneyCompact(total)} en ${anio}${yoyTotal != null ? `, ${pctTxt(yoyTotal)} ${yoyTotal >= 0 ? 'arriba' : 'abajo'} de ${anio - 1}` : ''}${grandes.length ? `; ${bajoCuota} de los ${grandes.length} grandes van abajo de su cuota` : ''}${riesgo ? ` y ${riesgo} ${riesgo === 1 ? 'cae' : 'caen'} más de 30 %` : ''}.`;

  // Agrupado por canal (meta = YTD del canal y nº de clientes); dentro, por venta del período.
  const porCanal = new Map();
  for (const c of clientes) {
    const k = c.canal || 'otros';
    let g = porCanal.get(k);
    if (!g) { g = { id: k, ytd: 0, cur: 0, n: 0, clientes: [] }; porCanal.set(k, g); }
    g.ytd += c.ytd; g.cur += c.cur; g.n += 1; g.clientes.push(c);
  }
  const canales = [...porCanal.values()].map((g) => ({ ...g, clientes: g.clientes.sort((a, b) => (modo === 'mes' ? b.cur - a.cur || b.ytd - a.ytd : b.ytd - a.ytd || b.cur - a.cur)) })).sort((a, b) => b.ytd - a.ytd);

  return {
    clientes, canales,
    hero: { frase, total, totalPrev, yoy: yoyTotal, cuota: cuotaTotal || null, ventaConCuota },
    kpis: {
      activos, conVentaAnio, riesgo, nuevos: nuevos.length, nuevosMonto: nuevos.reduce((s, c) => s + c.ytd, 0),
      pctCuotaYtd: alcanceCuota(ytdConCuota, cuotaYtdTotal), conCuota: conCuotaYtd.length, logran: conCuotaYtd.filter((c) => c.pctCuotaYtd >= 100).length,
    },
  };
}

/** Filtra la lista por chip de canal y texto (cliente, canal). */
export function filtrarLista(canales, chip, q, canalLabel = (c) => c) {
  const def = CANALES_CHIP.find((c) => c.id === chip);
  const set = def?.canales ? new Set(def.canales) : null;
  const nq = String(q || '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const terms = nq.split(/\s+/).filter(Boolean);
  return canales
    .filter((g) => !set || set.has(g.id))
    .map((g) => ({ ...g, clientes: terms.length ? g.clientes.filter((c) => { const t = `${c.nombre} ${c.label} ${canalLabel(c.canal)}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, ''); return terms.every((w) => t.includes(w)); }) : g.clientes }))
    .filter((g) => g.clientes.length > 0);
}

/**
 * Ritmo de compras del cliente desde mv_sellin_cliente_dia (anio, mes, dia, fact_neta, facturas).
 * @returns { ultima: Date|null, diasDesde, cadaDias (promedio de días entre compras en 180 d), facturasMes, mesFacturas: {anio,mes} }
 */
export function ritmoCompras(diario = [], hoy = new Date()) {
  const fechas = [];
  for (const r of diario) {
    if (!(N(r.fact_neta) > 0 || N(r.facturas) > 0)) continue;
    const d = new Date(N(r.anio), N(r.mes) - 1, N(r.dia));
    if (d <= hoy) fechas.push(d);
  }
  fechas.sort((a, b) => a - b);
  const ultima = fechas.length ? fechas[fechas.length - 1] : null;
  const diasDesde = ultima ? Math.floor((hoy - ultima) / 86400000) : null;
  const desde = new Date(hoy.getTime() - 180 * 86400000);
  const recientes = fechas.filter((d) => d >= desde);
  let cadaDias = null;
  if (recientes.length >= 2) {
    let s = 0; for (let i = 1; i < recientes.length; i += 1) s += (recientes[i] - recientes[i - 1]) / 86400000;
    cadaDias = Math.round(s / (recientes.length - 1));
  }
  // Facturas del último mes con facturas (el mes en curso si ya tiene).
  let mesFacturas = null, facturasMes = 0;
  const porMes = new Map();
  for (const r of diario) { if (N(r.facturas) > 0) { const k = idxMes(r.anio, r.mes); porMes.set(k, N(porMes.get(k)) + N(r.facturas)); } }
  const ks = [...porMes.keys()].filter((k) => k <= idxMes(hoy.getFullYear(), hoy.getMonth() + 1)).sort((a, b) => b - a);
  if (ks.length) { mesFacturas = { anio: Math.floor(ks[0] / 12), mes: (ks[0] % 12) + 1 }; facturasMes = porMes.get(ks[0]); }
  return { ultima, diasDesde, cadaDias, facturasMes, mesFacturas };
}

/**
 * Sell out del mes de la cuenta ligada, desde v_sellout_cuenta_mes (sin detalle diario): importe, SO/SI,
 * YoY (prorrateado a mismo día si el mes está en curso), inventario y semanas al ritmo de 3 meses cerrados.
 */
export function sellOutMesCuenta(mensual = [], cuenta, anio, mes, hoy = new Date()) {
  if (!cuenta) return null;
  // Si el mes pedido todavía no tiene sell out (las cuentas reportan por semanas o al cierre), se usa el último mes con
  // sell out y se dice cuál es (mesUsado); así la tarjeta nunca pinta $0 por un mes que aún no llega (2026-10-05).
  let act = mensual.find((r) => r.cuenta === cuenta && N(r.anio) === anio && N(r.mes) === mes) || null;
  let anioU = anio, mesU = mes;
  if (!act || N(act.importe) <= 0) {
    const prevCon = mensual.filter((r) => r.cuenta === cuenta && N(r.importe) > 0 && idxSo(N(r.anio), N(r.mes)) < idxSo(anio, mes)).sort((a, b) => idxSo(N(b.anio), N(b.mes)) - idxSo(N(a.anio), N(a.mes)));
    if (prevCon[0]) { act = prevCon[0]; anioU = N(act.anio); mesU = N(act.mes); }
  }
  const prev = mensual.find((r) => r.cuenta === cuenta && N(r.anio) === anioU - 1 && N(r.mes) === mesU) || null;
  const factor = anioU === anio && mesU === mes ? fraccionMes(anio, mes, hoy) : 1;
  const importe = N(act?.importe), sellIn = act?.sell_in == null ? null : N(act.sell_in);
  // Último mes con foto de inventario (puede ser anterior al mes elegido).
  const conInv = mensual.filter((r) => r.cuenta === cuenta && r.inv_piezas != null && idxSo(N(r.anio), N(r.mes)) <= idxSo(anio, mes)).sort((a, b) => idxSo(N(b.anio), N(b.mes)) - idxSo(N(a.anio), N(a.mes)));
  const inv = conInv[0] || null;
  const pz3m = sumaUltimosMeses(mensual, cuenta, anio, mes, 3, 'cantidad', 1);
  return {
    cuenta, anioUsado: anioU, mesUsado: mesU, esOtroMes: anioU !== anio || mesU !== mes, importe, cantidad: N(act?.cantidad), sellIn, soSi: sellIn != null && sellIn > 0 ? (importe / sellIn) * 100 : null,
    yoy: yoyDe(importe, N(prev?.importe) * factor), importePrev: N(prev?.importe) * factor,
    invPiezas: inv ? N(inv.inv_piezas) : null, invValor: inv ? N(inv.inv_valor) : null, invMes: inv ? { anio: N(inv.anio), mes: N(inv.mes) } : null,
    semanas: inv ? semanasInventario(N(inv.inv_piezas), pz3m) : null,
    reporta: !!act || conInv.length > 0 || mensual.some((r) => r.cuenta === cuenta),
    nombre: act?.nombre || mensual.find((r) => r.cuenta === cuenta)?.nombre || null,
    propio: !!(act?.propio ?? mensual.find((r) => r.cuenta === cuenta)?.propio),
  };
}

/** Serie Ene…Dic del año: sell in (mv mes del cliente), sell out (cuenta ligada) y cuota; meses futuros en null. */
export function serieAnioSiSo({ mensual, soMensual = [], cuenta, mapa, codigo, anio, hoy = new Date() }) {
  const limite = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : anio < hoy.getFullYear() ? 12 : 0;
  return MESES.map((label, i) => {
    const m = i + 1, futuro = m > limite;
    const si = futuro ? null : N(mensual?.get?.(idxMes(anio, m))?.fact_neta);
    const soRow = cuenta ? soMensual.find((r) => r.cuenta === cuenta && N(r.anio) === anio && N(r.mes) === m) : null;
    const so = futuro || !cuenta ? null : N(soRow?.importe);
    const cuota = mapa ? cuotaPeriodo(mapa, codigo, anio, m, 'mes') : null;
    return { label, mes: m, si, so, cuota: cuota == null ? null : cuota, soSi: si && so != null && si > 0 ? so / si : null, enCurso: !futuro && m === limite && anio === hoy.getFullYear() };
  });
}

/** Frase del hero del cliente. */
export function fraseCliente({ nombre, anio, mes, mtd, pctCuota, yoy, soSi, semanas, enCurso }) {
  const mesL = MESES[mes - 1].toLowerCase();
  const p = [];
  if (pctCuota != null) p.push(`${nombre} va al ${Math.round(pctCuota)} % de su cuota de ${mesL}`);
  else if (mtd > 0) p.push(`${nombre} lleva ${moneyCompact(mtd)} en ${mesL}`);
  else p.push(`${nombre} no ha comprado en ${mesL}`);
  if (yoy != null && (mtd > 0 || pctCuota != null)) p.push(`, ${pctTxt(yoy)} ${yoy >= 0 ? 'arriba' : 'abajo'} de ${mesL} ${anio - 1}${enCurso ? ' a mismo día' : ''}`);
  if (soSi != null) p.push(`; su sell out desplaza ${(soSi / 100).toFixed(1)} veces lo que compra`);
  if (semanas != null) p.push(`${soSi != null ? ' y' : ';'} le quedan ${Math.round(semanas)} semanas de inventario`);
  return `${p.join('')}.`;
}

const ORDINAL = ['', '1ª', '2ª', '3ª', '4ª', '5ª', '6ª', '7ª', '8ª', '9ª', '10ª', '11ª', '12ª', '13ª', '14ª', '15ª', '16ª', '17ª'];
/** Frase del hero de «<Cuenta> frente al resto». */
export function fraseFrente({ nombre, pos, de, pct, canalLbl, soSi, soSiCanal, nOport }) {
  const p = [];
  p.push(pos ? `${nombre} es la ${ORDINAL[pos] || `${pos}ª`} cuenta de ${de} del equipo` : `${nombre} no reporta sell out este mes`);
  const det = [];
  if (pct != null) det.push(`${Math.round(pct)} % del sell out de ${canalLbl}`);
  if (soSi != null) det.push(`SO/SI ${(soSi / 100).toFixed(2)}${soSiCanal != null ? ` contra ${(soSiCanal / 100).toFixed(2)} del promedio` : ''}`);
  if (det.length) p.push(`: ${det.join(', ')}`);
  if (nOport > 0) p.push(`${det.length ? ', y' : ';'} le faltan ${nOport} SKU${nOport === 1 ? '' : 's'} que sus pares sí mueven`);
  return `${p.join('')}.`;
}

export { MESES, idxMes };
