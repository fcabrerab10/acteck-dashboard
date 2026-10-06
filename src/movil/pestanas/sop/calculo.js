// S&OP del celular · cálculo puro (sin red, sin React). Pruebas: scripts/test-sop-movil.mjs. 2026-10-05.
//
//   Empresa   → las filas del MISMO motor que la computadora (forecast/calculo.js#calcularForecast) se leen aquí para
//               el hero («lo que viene»), las 4 tarjetas, la gráfica demanda vs lo que tendremos, «Comprar ahora» y la
//               tabla por SKU. Lo que llega se agrupa por PO desde v_transito_sku.embarques_detalle (arribosPorPo).
//   Mis clientes → forecast capturado (Proyectos y forecast) − inventario del cliente − nuestro stock − tránsito
//               = lo que hay que pedirle a Compras, por SKU y por cliente (calcularMisClientes). Aquí NO se captura nada.
const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const mesKey = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
export const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const keyDeIso = (iso) => (iso ? String(iso).slice(0, 7) : null);
export const usdCompact = (n) => { const v = N(n); const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };
export const costoDe = (r) => N(r?.ultimoCostoUsd || r?.costoPromedioUsd || r?.costoUnitUsd);
export const ESTATUS_CORTO = { 'TRANSITO MARITIMO': 'en el mar', 'PROXIMO A ZARPAR': 'por zarpar', 'EN PRODUCCION': 'en producción', 'EN ESPERA DE CONSOLIDAR': 'por consolidar', 'EN RESGUARDO': 'en resguardo', 'Pendiente modular': 'pendiente', 'EN PUERTO': 'en puerto' };
export const estatusCorto = (s) => (s ? ESTATUS_CORTO[s] || String(s).toLowerCase() : '');

/** N meses desde el mes de `hoy` → [{ anio, mes, key, label, largo }]. */
export function mesesDesde(hoy = new Date(), n = 6, desde = 0) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() + desde + i, 1);
    const anio = d.getFullYear(), mes = d.getMonth() + 1;
    return { anio, mes, key: mesKey(anio, mes), label: `${MESES[mes - 1]} ${String(anio).slice(2)}`, largo: MESES_LARGO[mes - 1] };
  });
}

/** Cobertura en días de una fila del motor: la del ERP (3 meses reales) y si no la del horizonte. */
export const diasCobertura = (r) => (r?.coberturaDiasErp != null ? N(r.coberturaDiasErp) : r?.coberturaDias != null ? N(r.coberturaDias) : null);
export const tonoCobertura = (dias, inv = 0) => (inv <= 0 || dias === 0 ? 'red' : dias == null ? 'gray' : dias < 30 ? 'red' : dias < 60 ? 'orange' : 'green');

/**
 * Arribos por PO desde v_transito_sku (`transito` = filas con embarques_detalle) · mismo criterio que el S&OP web:
 * sólo embarques con cantidad > 0. `porSku` = Map(sku → fila del motor) para costo USD, cobertura y descripción.
 * `navieraPor` = Map(contenedor → naviera) de v_embarques_contenedor.
 */
export function arribosPorPo({ transito = [], porSku = new Map(), descripciones = new Map(), navieraPor = new Map(), hoy = new Date() } = {}) {
  const hoyIso = isoDia(hoy);
  const m = new Map();
  for (const t of transito || []) {
    const det = Array.isArray(t.embarques_detalle) ? t.embarques_detalle : [];
    for (const e of det) {
      if (!e?.po || !(N(e.cantidad) > 0)) continue;
      const o = m.get(e.po) || { po: e.po, eta: null, etd: null, cedis: '', estatus: '', contenedor: '', supplier: t.supplier || '', piezas: 0, usd: 0, sinCosto: 0, skus: [] };
      if (e.eta && (!o.eta || e.eta < o.eta)) o.eta = e.eta;
      if (e.etd && (!o.etd || e.etd < o.etd)) o.etd = e.etd;
      if (!o.cedis && e.cedis) o.cedis = e.cedis;
      if (!o.estatus && e.estatus) o.estatus = e.estatus;
      if (!o.contenedor && e.contenedor) o.contenedor = e.contenedor;
      const r = porSku.get(t.sku);
      const costo = costoDe(r);
      const pz = N(e.cantidad);
      o.piezas += pz;
      if (costo > 0) o.usd += pz * costo; else o.sinCosto += pz;
      const dias = diasCobertura(r);
      const inv = N(r?.inv);
      o.skus.push({ sku: t.sku, descripcion: r?.descripcion || descripciones.get(t.sku) || '', piezas: pz, inv, dias, tono: r ? tonoCobertura(dias, inv) : 'gray', eta: e.eta || null, estatus: e.estatus || '' });
      m.set(e.po, o);
    }
  }
  return [...m.values()].map((o) => ({
    ...o,
    naviera: (o.contenedor && navieraPor.get(o.contenedor)) || null,
    nSkus: o.skus.length,
    urgen: o.skus.filter((s) => s.tono === 'red').length,
    vencida: !!o.eta && o.eta < hoyIso,
    dias: o.eta ? Math.round((Date.parse(`${o.eta}T12:00:00`) - Date.parse(`${hoyIso}T12:00:00`)) / 86400000) : null,
    skus: o.skus.sort((a, b) => (a.tono === 'red' ? 0 : 1) - (b.tono === 'red' ? 0 : 1) || b.piezas - a.piezas),
  })).sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')) || b.piezas - a.piezas);
}

/** Hero y tarjetas de Empresa. */
export function resumenEmpresa({ rows = [], arribos = [], hoy = new Date(), sensible = true } = {}) {
  const [mAct, mSig] = mesesDesde(hoy, 2);
  const hoyIso = isoDia(hoy);
  const suma = (lista) => lista.reduce((a, p) => ({ usd: a.usd + p.usd, pz: a.pz + p.piezas, pos: a.pos + 1 }), { usd: 0, pz: 0, pos: 0 });
  const mesActual = { ...mAct, ...suma(arribos.filter((p) => keyDeIso(p.eta) === mAct.key)) };
  const mesSiguiente = { ...mSig, ...suma(arribos.filter((p) => keyDeIso(p.eta) === mSig.key)) };
  const total = { ...suma(arribos), vencidas: arribos.filter((p) => p.vencida).length };
  const siguiente = arribos.find((p) => p.eta && p.eta >= hoyIso) || null;
  const conBrecha = rows.filter((r) => N(r.brecha) > 0).length;
  const agotados = rows.filter((r) => N(r.inv) <= 0 && N(r.demMes) > 0).length;
  const sugeridoPz = rows.reduce((s, r) => s + N(r.sugerido), 0);
  const sugeridoUsd = rows.reduce((s, r) => s + N(r.sugerido) * costoDe(r), 0);
  const $ = (n) => `${usdCompact(n)} USD`;
  const pzTxt = (n) => `${Math.round(n).toLocaleString('es-MX')} pz`;
  const q = (x) => (sensible ? $(x.usd) : pzTxt(x.pz));
  let frase;
  if (!arribos.length) frase = `No hay nada en camino; ${conBrecha} SKU${conBrecha === 1 ? '' : 's'} con brecha a 3 meses.`;
  else {
    const partes = [`Llegan ${q(mesActual)} en ${mesActual.largo}`];
    if (mesSiguiente.pos) partes[0] += ` y ${q(mesSiguiente)} en ${mesSiguiente.largo}`;
    if (siguiente) partes.push(`el siguiente arribo es la PO ${siguiente.po}${siguiente.contenedor ? ` (${siguiente.contenedor})` : ''} el ${fechaLarga(siguiente.eta)}${siguiente.cedis ? ` a ${cedisCorto(siguiente.cedis)}` : ''} con ${siguiente.nSkus} SKU${siguiente.nSkus === 1 ? '' : 's'} y ${pzTxt(siguiente.piezas)}`);
    frase = `${partes.join('; ')}.`;
  }
  const sub = [`${q(total)} en camino en ${total.pos} PO`, total.vencidas ? `${total.vencidas} con ETA vencida` : null, `${conBrecha} SKU${conBrecha === 1 ? '' : 's'} con brecha a 3 meses`].filter(Boolean).join(' · ');
  return { mesActual, mesSiguiente, siguiente, total, conBrecha, agotados, sugeridoPz, sugeridoUsd, frase, sub };
}

export const fechaLarga = (iso) => { if (!iso) return '—'; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} de ${MESES_LARGO[d.getMonth()]}`; };
export const fechaCorta = (iso) => { if (!iso) return '—'; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()].toLowerCase()}`; };
export const cedisCorto = (c) => (c ? String(c).replace(/^ALMACENES\s+/i, '').replace(/^CEDIS\s+/i, '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()) : '');

/**
 * Demanda contra lo que tendremos, mes a mes (6 meses). Por SKU: stock de hoy + lo que llega en el mes (por ETA) cubre la
 * demanda del mes (demMes del motor); lo que no alcanza es «se queda corto». Se suma en piezas sobre todos los SKUs.
 *   llegadas: [{ sku, eta, cantidad }] (de v_transito_sku.embarques_detalle).
 */
export function serieDemanda({ rows = [], llegadas = [], hoy = new Date(), meses = 6 } = {}) {
  const ventana = mesesDesde(hoy, meses);
  const llegaPor = new Map();
  for (const l of llegadas) { const k = keyDeIso(l.eta); if (!k || !l.sku || !(N(l.cantidad) > 0)) continue; const m = llegaPor.get(l.sku) || new Map(); m.set(k, (m.get(k) || 0) + N(l.cantidad)); llegaPor.set(l.sku, m); }
  const out = ventana.map((m) => ({ ...m, demanda: 0, tendremos: 0, llega: 0, falta: 0 }));
  const hoyKey = mesKey(hoy.getFullYear(), hoy.getMonth() + 1);
  for (const r of rows) {
    const dem = Math.max(0, N(r.demMes));
    if (dem <= 0 && N(r.inv) <= 0) continue;
    let stock = Math.max(0, N(r.inv));
    const lm = llegaPor.get(r.sku) || new Map();
    // Lo vencido (ETA antes del mes en curso) se cuenta como si llegara este mes.
    let atrasado = 0; lm.forEach((v, k) => { if (k < hoyKey) atrasado += v; });
    out.forEach((o, i) => {
      const llega = N(lm.get(o.key)) + (i === 0 ? atrasado : 0);
      stock += llega;
      const cubierto = Math.min(stock, dem);
      o.demanda += dem; o.llega += llega; o.tendremos += stock; o.falta += dem - cubierto;
      stock -= cubierto;
    });
  }
  return out.map((o) => ({ ...o, demanda: Math.round(o.demanda), tendremos: Math.round(o.tendremos), llega: Math.round(o.llega), falta: Math.round(o.falta) }));
}

/** Filas con sugerido > 0, las más urgentes primero (agotado → menos cobertura → más USD). */
export function comprarAhora(rows = [], { top = 8 } = {}) {
  const lista = rows.filter((r) => N(r.sugerido) > 0).map((r) => {
    const dias = diasCobertura(r);
    const inv = N(r.inv);
    const semanas = dias != null ? Math.round(dias / 7 * 10) / 10 : null;
    const prox = (Array.isArray(r.embarques) ? r.embarques : []).filter((e) => e?.eta && N(e.cantidad) > 0).sort((a, b) => String(a.eta).localeCompare(String(b.eta)))[0] || null;
    const linea = [inv <= 0 ? 'agotado' : semanas != null ? `cobertura ${semanas} sem` : `${Math.round(inv).toLocaleString('es-MX')} pz`, r.ltDias ? `LT ${Math.round(r.ltDias)} d` : null, prox ? `llega ${fechaCorta(prox.eta)}` : 'sin PO'].filter(Boolean).join(' · ');
    return { sku: r.sku, descripcion: r.descripcion || '', marca: r.marca || '', piezas: N(r.sugerido), usd: N(r.sugerido) * costoDe(r), dias, inv, linea, urgencia: inv <= 0 ? 0 : dias == null ? 999 : dias, row: r };
  }).sort((a, b) => a.urgencia - b.urgencia || b.usd - a.usd);
  return { lista: lista.slice(0, top), total: lista.length, piezas: lista.reduce((s, x) => s + x.piezas, 0), usd: lista.reduce((s, x) => s + x.usd, 0), todos: lista };
}

/** Filas para la tabla por SKU (TablaAnual ordenable): Días · Venta/mes · Stock · Llega · Sugerido. */
export const COLS_DETALLE = ['Días', 'Venta/mes', 'Stock', 'Llega', 'Sug.'];
export function filasDetalle(rows = [], { filtro = 'todos' } = {}) {
  const f = rows.filter((r) => {
    if (filtro === 'criticos') return N(r.inv) <= 0 ? N(r.demMes) > 0 : (diasCobertura(r) != null && diasCobertura(r) < 30);
    if (filtro === 'sinPo') return N(r.traCant) <= 0 && N(r.sugerido) > 0;
    if (filtro && filtro !== 'todos') return String(r.marca || '').toLowerCase() === filtro;
    return true;
  });
  return f.map((r) => ({ sku: r.sku, label: r.sku, sub: r.descripcion || r.marca || '', descripcion: r.descripcion || '', marca: r.marca || '', categoria: r.familia || '', valores: [diasCobertura(r) ?? 0, Math.round(N(r.demMes)), Math.round(N(r.inv)), Math.round(N(r.traCant)), Math.round(N(r.sugerido))], dias: diasCobertura(r) }));
}

// ─── Mis clientes ──────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Lo que exige el forecast de los clientes propios frente a lo que tenemos y viene.
 *   clientes: [{ key, label, forecast: [{ sku, key:'YYYY-MM', piezas }], stock: Map(sku → pz en su piso) }]
 *   inventario: Map(sku → disponible nuestro) · llegadas: [{ sku, eta, cantidad, po }] · ventana: [{ key, label, largo }]
 *   costos: Map(sku → USD) (opcional, sólo con permiso sensible) · descripciones: Map(sku → texto)
 * Reglas: el inventario del cliente consume primero su propio forecast (meses en orden); después, por SKU y mes, la
 * necesidad de los tres se cubre en orden FIFO con nuestro stock de hoy + lo que llega hasta ese mes; lo que no alcanza
 * se reparte entre los clientes en proporción a lo que pedían ese mes. Nada se captura aquí.
 */
export function calcularMisClientes({ clientes = [], inventario = new Map(), llegadas = [], ventana = [], costos = new Map(), descripciones = new Map(), hoy = new Date() } = {}) {
  const keys = ventana.map((m) => m.key);
  const idx = new Map(keys.map((k, i) => [k, i]));
  const hoyKey = mesKey(hoy.getFullYear(), hoy.getMonth() + 1);
  // necesidad[sku][cliente] = [pz por mes de la ventana] ya neta del inventario del cliente
  const nec = new Map();
  const porCliente = new Map(clientes.map((c) => [c.key, { key: c.key, label: c.label, forecastPz: 0, netoPz: 0, cubierto: 0, falta: 0, usd: 0, primerHueco: null, skusFalta: new Set(), skus: new Set() }]));
  for (const c of clientes) {
    const porSku = new Map();
    for (const f of c.forecast || []) { if (!f.sku || !idx.has(f.key) || !(N(f.piezas) > 0)) continue; const arr = porSku.get(f.sku) || keys.map(() => 0); arr[idx.get(f.key)] += N(f.piezas); porSku.set(f.sku, arr); }
    const pc = porCliente.get(c.key);
    porSku.forEach((arr, sku) => {
      pc.skus.add(sku);
      pc.forecastPz += arr.reduce((s, v) => s + v, 0);
      let stock = Math.max(0, N(c.stock?.get(sku)));
      const neto = arr.map((v) => { const usa = Math.min(stock, v); stock -= usa; return v - usa; });
      pc.netoPz += neto.reduce((s, v) => s + v, 0);
      if (!nec.has(sku)) nec.set(sku, new Map());
      nec.get(sku).set(c.key, neto);
    });
  }
  const llegaPor = new Map();
  for (const l of llegadas) { const k = keyDeIso(l.eta); if (!k || !l.sku || !(N(l.cantidad) > 0)) continue; const m = llegaPor.get(l.sku) || new Map(); m.set(k < hoyKey ? keys[0] : k, (m.get(k < hoyKey ? keys[0] : k) || 0) + N(l.cantidad)); llegaPor.set(l.sku, m); }
  const comprar = [];
  nec.forEach((porCli, sku) => {
    let stock = Math.max(0, N(inventario.get(sku)));
    const lm = llegaPor.get(sku) || new Map();
    const faltaMes = keys.map(() => 0);
    const faltaCli = new Map();
    keys.forEach((k, i) => {
      stock += N(lm.get(k));
      let total = 0; porCli.forEach((arr) => { total += arr[i]; });
      if (total <= 0) return;
      const cubierto = Math.min(stock, total);
      const falta = total - cubierto;
      stock -= cubierto;
      faltaMes[i] = falta;
      porCli.forEach((arr, ck) => {
        const parte = arr[i] / total;
        const pc = porCliente.get(ck);
        pc.cubierto += cubierto * parte; pc.falta += falta * parte;
        if (falta > 0 && arr[i] > 0) { pc.skusFalta.add(sku); if (!pc.primerHueco || k < pc.primerHueco) pc.primerHueco = k; faltaCli.set(ck, (faltaCli.get(ck) || 0) + falta * parte); }
      });
    });
    const falta = faltaMes.reduce((s, v) => s + v, 0);
    if (falta <= 0) return;
    const desde = keys[faltaMes.findIndex((v) => v > 0)];
    const costo = N(costos.get(sku));
    const tienePo = [...lm.values()].some((v) => v > 0);
    comprar.push({ sku, descripcion: descripciones.get(sku) || '', piezas: Math.round(falta), usd: Math.round(falta) * costo, desde, desdeLabel: ventana.find((m) => m.key === desde)?.largo || desde, clientes: [...faltaCli.entries()].sort((a, b) => b[1] - a[1]).map(([ck, pz]) => ({ key: ck, label: porCliente.get(ck)?.label || ck, piezas: Math.round(pz) })), tienePo, stock: Math.max(0, N(inventario.get(sku))) });
  });
  comprar.sort((a, b) => String(a.desde).localeCompare(String(b.desde)) || b.usd - a.usd || b.piezas - a.piezas);
  const lista = [...porCliente.values()].map((pc) => ({ ...pc, forecastPz: Math.round(pc.forecastPz), netoPz: Math.round(pc.netoPz), cubierto: Math.round(pc.cubierto), falta: Math.round(pc.falta), skus: pc.skus.size, skusFalta: pc.skusFalta.size, usd: comprar.reduce((s, c) => s + N(c.clientes.find((x) => x.key === pc.key)?.piezas) * N(costos.get(c.sku)), 0), primerHuecoLabel: pc.primerHueco ? ventana.find((m) => m.key === pc.primerHueco)?.largo || pc.primerHueco : null }));
  const tot = { forecastPz: lista.reduce((s, c) => s + c.forecastPz, 0), cubierto: lista.reduce((s, c) => s + c.cubierto, 0), falta: comprar.reduce((s, c) => s + c.piezas, 0), usd: comprar.reduce((s, c) => s + c.usd, 0), skus: comprar.length, primerHueco: comprar[0]?.desdeLabel || null };
  return { porCliente: lista, comprar, totales: tot, ventana };
}

export function fraseMisClientes(res, { sensible = true } = {}) {
  if (!res) return '';
  const t = res.totales;
  const pz = (n) => `${Math.round(n).toLocaleString('es-MX')} pz`;
  const conFc = res.porCliente.filter((c) => c.forecastPz > 0);
  if (!conFc.length) return 'Todavía no hay forecast capturado para tus clientes: captúralo en Proyectos y forecast y aquí sale qué comprar.';
  const quien = conFc.length === res.porCliente.length ? `de los ${conFc.length}` : `de ${conFc.map((c) => c.label).join(', ')}`;
  const n = res.ventana.length;
  const base = `El forecast ${quien} suma ${pz(t.forecastPz)} a ${n} meses; con lo que tienen, tenemos y viene se cubren ${pz(t.cubierto)}.`;
  if (t.falta <= 0) return `${base} No hace falta comprar nada.`;
  return `${base} Faltan ${pz(t.falta)}${sensible && t.usd > 0 ? ` (${usdCompact(t.usd)} USD)` : ''} y el primer hueco es en ${t.primerHueco}.`;
}
