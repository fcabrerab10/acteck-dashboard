// Cálculos puros de Inicio · sin React, sin red. Entrada: data de useInicioData + alertas + modo ('mes' | 'anio').
// Los % (MC, MUC, lost profit) se calculan SIEMPRE al agregar, nunca se suman ni se promedian.
import { MESES, MESES_LARGO, CLIENTES, DIAS_AGENDA } from './config';
import { SEV_ORDEN } from '../../../lib/alertas';

const N = (v) => Number(v) || 0;
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + N(f(x)), 0);
const pctDe = (a, b) => (b > 0 ? (a / b) * 100 : null);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const iso = (d) => d.toISOString().slice(0, 10);

// ── Agregado de medidas del director sobre un conjunto de filas (cualquier grano)
export function agg(rows) {
  const t = { fact_bruta: 0, devoluciones: 0, rmas: 0, bonificaciones: 0, fact_neta: 0, venta_neta: 0, costo_venta_neta: 0, contribucion: 0, utilidad_comercial: 0, piezas: 0, n: 0 };
  rows.forEach((r) => {
    t.fact_bruta += N(r.fact_bruta); t.devoluciones += N(r.devoluciones); t.rmas += N(r.rmas); t.bonificaciones += N(r.bonificaciones);
    t.fact_neta += N(r.fact_neta); t.venta_neta += N(r.venta_neta); t.costo_venta_neta += N(r.costo_venta_neta);
    t.contribucion += N(r.contribucion); t.utilidad_comercial += N(r.utilidad_comercial); t.piezas += N(r.piezas_venta_neta); t.n++;
  });
  t.mc = t.fact_neta ? (t.contribucion / t.fact_neta) * 100 : null;
  t.muc = t.venta_neta ? (t.utilidad_comercial / t.venta_neta) * 100 : null;
  t.lost = t.devoluciones + t.rmas + t.bonificaciones; // negativo
  t.lostPct = t.fact_bruta ? (Math.abs(t.lost) / t.fact_bruta) * 100 : null;
  t.ticket = t.piezas > 0 ? t.venta_neta / t.piezas : null;
  return t;
}

// Filtro de periodo: modo 'mes' → sólo mesActual · modo 'anio' → YTD (1..mesActual)
const enPeriodo = (modo, mesActual) => (r) => (modo === 'mes' ? N(r.mes) === mesActual : N(r.mes) <= mesActual);
const mesesDe = (modo, mesActual) => (modo === 'mes' ? [mesActual] : Array.from({ length: mesActual }, (_, i) => i + 1));

// ── Cuotas: cuotas_canales (TOTAL / canal, anual) con fallback a Σ cuotas_mensuales (todos los clientes)
function cuotas(d, anio, mesActual) {
  const total = d.cuotasCanales.find((c) => String(c.dimension_tipo).toUpperCase() === 'TOTAL');
  const anual = total ? N(total.meta_facturacion) : sum(d.cuotasMensuales, (c) => c.cuota_ideal);
  const fuente = total ? 'cuotas_canales' : d.cuotasMensuales.length ? 'cuotas_mensuales' : null;
  const mes = (m) => (total ? anual / 12 : sum(d.cuotasMensuales.filter((c) => N(c.mes) === m), (c) => c.cuota_ideal));
  const ytd = sum(mesesDe('anio', mesActual), mes);
  const porCanal = {};
  d.cuotasCanales.forEach((c) => { if (String(c.dimension_tipo).toLowerCase() === 'canal') porCanal[String(c.dimension_valor).toUpperCase()] = { anual: N(c.meta_facturacion), margen: c.meta_margen_pct != null ? N(c.meta_margen_pct) : null }; });
  return { anual, mes, ytd, fuente, porCanal, margenObjetivo: total?.meta_margen_pct != null ? N(total.meta_margen_pct) : null };
}

// ── Cartera: último corte por cliente
function cartera(estados) {
  const ult = {};
  estados.forEach((e) => { if (!ult[e.cliente] || e.fecha_corte > ult[e.cliente].fecha_corte) ult[e.cliente] = e; });
  const filas = Object.values(ult).map((e) => ({ cliente: e.cliente, corte: e.fecha_corte, saldo: N(e.saldo_actual), vencido: N(e.saldo_vencido), mas90: N(e.aging_mas90), dso: e.dso != null ? N(e.dso) : null }));
  const saldo = sum(filas, (f) => f.saldo), vencido = sum(filas, (f) => f.vencido), mas90 = sum(filas, (f) => f.mas90);
  const conDso = filas.filter((f) => f.dso != null && f.saldo > 0);
  const dso = conDso.length ? Math.round(sum(conDso, (f) => f.dso * f.saldo) / sum(conDso, (f) => f.saldo)) : null;
  const corte = filas.reduce((m, f) => (f.corte > m ? f.corte : m), '') || null;
  return { filas: filas.sort((a, b) => b.vencido - a.vencido), saldo, vencido, mas90, dso, corte, pctVencido: pctDe(vencido, saldo) };
}

// ── Inventario comercial + tránsito (agrupado por PO) + arribos ≤ 7 días
function inventario(d, cv3, hoyISO, limiteISO) {
  const costo = {};
  let valor = 0, piezas = 0, skus = 0;
  d.inv.forEach((r) => { const c = N(r.costo_promedio), q = N(r.inventario); costo[r.sku] = c; valor += q * c; piezas += q; if (q > 0) skus++; });
  const diario = cv3 > 0 ? cv3 / 90 : 0;
  const cobertura = diario > 0 && valor > 0 ? Math.round(valor / diario) : null;

  const pos = {};
  let transitoPzs = 0, transitoValor = 0;
  d.transito.forEach((r) => {
    transitoPzs += N(r.cantidad); transitoValor += N(r.cantidad) * (costo[r.sku] || 0);
    const det = Array.isArray(r.embarques_detalle) ? r.embarques_detalle : [];
    det.forEach((e) => {
      const k = e.po || 'sin PO';
      const o = pos[k] || (pos[k] = { po: k, eta: e.eta || null, piezas: 0, skus: new Set(), estatus: e.estatus, cedis: e.cedis, valor: 0 });
      o.piezas += N(e.cantidad); o.valor += N(e.cantidad) * (costo[r.sku] || 0); o.skus.add(r.sku);
      if (e.eta && (!o.eta || e.eta < o.eta)) o.eta = e.eta;
    });
  });
  const porPo = Object.values(pos).map((o) => ({ ...o, skus: o.skus.size })).sort((a, b) => String(a.eta || '9').localeCompare(String(b.eta || '9')));
  const arribos = porPo.filter((o) => o.eta && o.eta >= hoyISO && o.eta <= limiteISO);
  return { valor, piezas, skus, cobertura, transitoPzs, transitoValor, pos: porPo.length, arribos };
}

// ── Sell-out del cliente: último mes cerrado con datos (< mesActual) + YoY
function selloutCerrado(rows, anio, mesActual) {
  const de = (a, m) => sum(rows.filter((r) => N(r.anio) === a && N(r.mes) === m), (r) => r.monto);
  let mes = null;
  for (let m = mesActual - 1; m >= 1; m--) if (de(anio, m) > 0) { mes = m; break; }
  if (!mes) return null;
  const monto = de(anio, mes), prev = de(anio - 1, mes);
  return { mes, monto, yoy: delta(monto, prev) };
}

// ── Agenda de los próximos 7 días (pagos, arribos, marketing, eventos) ordenada por fecha
function agenda(d, inv) {
  const items = [];
  d.pagos.forEach((p) => items.push({ id: `p${p.id}`, fecha: p.fecha_compromiso, tipo: 'Pago', tone: 'orange', titulo: p.concepto || p.categoria || 'Pago', sub: p.cliente, monto: N(p.monto), clienteKey: p.cliente, pagina: 'pagos' }));
  inv.arribos.forEach((a) => items.push({ id: `a${a.po}`, fecha: a.eta, tipo: 'Arribo', tone: 'blue', titulo: `PO ${a.po}`, sub: `${Math.round(a.piezas).toLocaleString('es-MX')} pzs · ${a.skus} SKUs${a.cedis ? ` · ${a.cedis}` : ''}`, monto: a.valor, pagina: 'inventarioGlobal' }));
  d.marketing.forEach((m) => items.push({ id: `m${m.id}`, fecha: m.fecha, tipo: 'Marketing', tone: 'purple', titulo: m.nombre, sub: [m.cliente, m.tipo].filter(Boolean).join(' · '), monto: N(m.inversion) || null, clienteKey: m.cliente, pagina: 'marketing' }));
  d.eventosEquipo.forEach((e) => items.push({ id: `e${e.id}`, fecha: e.fecha_ini, tipo: 'Evento', tone: 'gray', titulo: e.titulo, sub: e.tipo, monto: null }));
  d.eventosCliente.forEach((e) => items.push({ id: `c${e.id}`, fecha: e.fecha, tipo: 'Evento', tone: 'gray', titulo: e.descripcion || 'Evento con cliente', sub: [e.cliente, e.lugar].filter(Boolean).join(' · '), monto: null, clienteKey: e.cliente, pagina: 'home' }));
  return items.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

const fmtM = (n) => `$${(Math.abs(n) / 1e6).toFixed(Math.abs(n) >= 1e7 ? 1 : 2)}M`;

// ── Resumen principal
export function calcular(d, alertas, { anio, mesActual, hoy, modo }) {
  const hoyISO = iso(hoy), limiteISO = iso(new Date(hoy.getTime() + DIAS_AGENDA * 86400000));
  const filtro = enPeriodo(modo, mesActual), otroModo = modo === 'mes' ? 'anio' : 'mes', filtroOtro = enPeriodo(otroModo, mesActual);
  const cur = agg(d.medidas.filter((r) => N(r.anio) === anio && filtro(r)));
  const prev = agg(d.medidas.filter((r) => N(r.anio) === anio - 1 && filtro(r)));
  const otro = agg(d.medidas.filter((r) => N(r.anio) === anio && filtroOtro(r)));
  const otroPrev = agg(d.medidas.filter((r) => N(r.anio) === anio - 1 && filtroOtro(r)));
  const q = cuotas(d, anio, mesActual);
  const cuotaPeriodo = modo === 'mes' ? q.mes(mesActual) : q.ytd;
  const cuotaOtro = modo === 'mes' ? q.ytd : q.mes(mesActual);
  const pctCuota = pctDe(cur.fact_neta, cuotaPeriodo), pctOtro = pctDe(otro.fact_neta, cuotaOtro), pctAnual = pctDe(agg(d.medidas.filter((r) => N(r.anio) === anio)).fact_neta, q.anual);

  // Mes en curso: el año anterior se prorratea al mismo día del mes (MTD vs MTD), si no el YoY
  // compararía 9 días contra 30. En YTD no hace falta (meses completos hasta el actual).
  const diasMes = new Date(anio, mesActual, 0).getDate(), diaHoy = Math.max(1, hoy.getDate());
  const factorMes = Math.min(1, diaHoy / diasMes);
  const proMes = (v) => v * factorMes;
  const pro = modo === 'mes' ? proMes : (v) => v, proOtro = otroModo === 'mes' ? proMes : (v) => v;
  const yoy = delta(cur.fact_neta, pro(prev.fact_neta)), yoyOtro = delta(otro.fact_neta, proOtro(otroPrev.fact_neta));
  const yoyUtilidad = delta(cur.utilidad_comercial, pro(prev.utilidad_comercial));
  const dMc = cur.mc != null && prev.mc != null ? cur.mc - prev.mc : null;
  const yoyLabel = modo === 'mes' ? 'YoY a mismo día' : 'YoY';

  // Run-rate del mes en curso vs mismo mes del año anterior (siempre del mes actual)
  const mesRow = agg(d.medidas.filter((r) => N(r.anio) === anio && N(r.mes) === mesActual));
  const mesPrev = agg(d.medidas.filter((r) => N(r.anio) === anio - 1 && N(r.mes) === mesActual));
  const runRate = mesRow.fact_neta > 0 ? (mesRow.fact_neta / diaHoy) * diasMes : 0;
  const runRateYoy = delta(runRate, mesPrev.fact_neta);

  const cart = cartera(d.estados);
  const cv3 = N(d.medidas.find((r) => N(r.anio) === anio && N(r.mes) === mesActual)?.cv_ultimos_3_meses);
  const inv = inventario(d, cv3, hoyISO, limiteISO);
  const activas = alertas || [];
  const decision = activas.filter((a) => a.severidad === 'critica' || a.severidad === 'alta');
  inv.skusRiesgo = activas.filter((a) => a.tipo === 'stock_vs_transito').length;

  // Clientes con pestaña
  const meses = mesesDe(modo, mesActual);
  const clientes = CLIENTES.map((c) => {
    const fact = sum(d.factCli.filter((r) => r.cliente_key === c.key && N(r.anio) === anio && meses.includes(N(r.mes))), (r) => r.monto);
    const factPrev = sum(d.factCli.filter((r) => r.cliente_key === c.key && N(r.anio) === anio - 1 && meses.includes(N(r.mes))), (r) => r.monto);
    const cuota = sum(d.cuotasMensuales.filter((x) => x.cliente === c.key && meses.includes(N(x.mes))), (x) => x.cuota_ideal);
    const med = agg(d.medidasCli.filter((r) => r.cliente_key === c.key && N(r.anio) === anio && filtro(r)));
    const medPrev = agg(d.medidasCli.filter((r) => r.cliente_key === c.key && N(r.anio) === anio - 1 && filtro(r)));
    const alerta = activas.filter((a) => a.cliente_key === c.key).sort((a, b) => (SEV_ORDEN[a.severidad] ?? 9) - (SEV_ORDEN[b.severidad] ?? 9))[0] || null;
    return { ...c, fact, factPrev, yoy: delta(fact, pro(factPrev)), cuota, pct: pctDe(fact, cuota), mc: med.mc, dMc: med.mc != null && medPrev.mc != null ? med.mc - medPrev.mc : null, sellout: selloutCerrado(d.sellout[c.key] || [], anio, mesActual), alerta, nAlertas: activas.filter((a) => a.cliente_key === c.key).length };
  });

  // Canales
  const factorCuota = modo === 'mes' ? 1 / 12 : mesActual / 12; // cuotas_canales es anual
  const porCanal = {};
  d.medidasCanal.forEach((r) => { if (!filtro(r)) return; const k = r.canal || 'otros'; (porCanal[k] || (porCanal[k] = { cur: [], prev: [] }))[N(r.anio) === anio ? 'cur' : 'prev'].push(r); });
  const canales = Object.entries(porCanal).map(([canal, g]) => {
    const a = agg(g.cur), p = agg(g.prev), qc = q.porCanal[canal.toUpperCase()];
    const cuota = qc ? qc.anual * factorCuota : null;
    return { canal, fact: a.fact_neta, prev: p.fact_neta, yoy: delta(a.fact_neta, pro(p.fact_neta)), cuota, pct: cuota ? pctDe(a.fact_neta, cuota) : null, mc: a.mc, dMc: a.mc != null && p.mc != null ? a.mc - p.mc : null, margenObjetivo: qc?.margen ?? null, piezas: a.piezas };
  }).filter((c) => c.fact !== 0 || c.prev !== 0).sort((a, b) => b.fact - a.fact);
  const totalCanales = sum(canales, (c) => c.fact);

  // Serie últimos 12 meses (termina en el mes actual)
  const by = new Map(d.medidas.map((r) => [`${r.anio}-${r.mes}`, r]));
  const serie = Array.from({ length: 12 }, (_, i) => {
    let m = mesActual - 11 + i, a = anio; if (m <= 0) { m += 12; a -= 1; }
    const r = by.get(`${a}-${m}`) || {}; const fn = N(r.fact_neta), c = N(r.contribucion);
    return { key: `${a}-${m}`, label: `${MESES[m - 1]}${m === 1 || i === 0 ? ` ${String(a).slice(2)}` : ''}`, fn, c, mc: fn ? (c / fn) * 100 : null, actual: a === anio && m === mesActual };
  });

  // Hero: título y sub por reglas
  const nDec = decision.length;
  const mesL = MESES_LARGO[mesActual - 1];
  const fraseDec = nDec === 0 ? 'Sin asuntos críticos pendientes.' : nDec === 1 ? 'Un asunto requiere decisión hoy.' : `${['Dos', 'Tres', 'Cuatro', 'Cinco'][nDec - 2] || nDec} asuntos requieren decisión hoy.`;
  let titulo;
  if (modo === 'mes') {
    titulo = !cur.fact_neta ? `${mesL} aún sin ventas registradas en el ERP. ${fraseDec}`
      : pctCuota == null ? `${mesL} lleva ${fmtM(cur.fact_neta)} con margen del ${cur.mc?.toFixed(1)} %. ${fraseDec}`
      : `${mesL} va al ${Math.round(pctCuota)} % de cuota con margen del ${cur.mc != null ? cur.mc.toFixed(1) : '—'} %. ${fraseDec}`;
  } else {
    const yoyTxt = yoy == null ? '' : `, ${Math.abs(yoy).toFixed(0)} % ${yoy >= 0 ? 'arriba' : 'abajo'} de ${anio - 1}`;
    titulo = pctCuota == null ? `${anio} lleva ${fmtM(cur.fact_neta)}${yoyTxt}.` : `${anio} va al ${Math.round(pctCuota)} % de la cuota anual${yoyTxt}.`;
  }
  const sub = [
    cuotaPeriodo > 0 ? `Fact Neta ${fmtM(cur.fact_neta)} de ${fmtM(cuotaPeriodo)} de cuota` : `Fact Neta ${fmtM(cur.fact_neta)} · sin cuota cargada`,
    runRate > 0 ? `run-rate ${mesL.slice(0, 3)} ${fmtM(runRate)}${runRateYoy != null ? ` (${runRateYoy >= 0 ? '+' : ''}${runRateYoy.toFixed(0)} % vs ${mesL.slice(0, 3)} ${anio - 1})` : ''}` : null,
    `utilidad comercial ${fmtM(cur.utilidad_comercial)}`,
    cart.vencido > 0 ? `cartera vencida ${fmtM(cart.vencido)}` : 'cartera sin vencidos',
  ].filter(Boolean).join(' · ');

  return {
    modo, otroModo, anio, mesActual, mesL, cur, prev, otro, otroPrev, cuota: q, cuotaPeriodo, cuotaOtro, pctCuota, pctOtro, pctAnual, yoy, yoyOtro, yoyUtilidad, yoyLabel, dMc,
    runRate, runRateYoy, mesRow, mesPrev, cartera: cart, inv, alertas: activas, decision, clientes, canales, totalCanales, serie, titulo, sub,
    agenda: agenda(d, inv), auditoria: d.auditoria, hayDatos: d.medidas.length > 0,
  };
}
