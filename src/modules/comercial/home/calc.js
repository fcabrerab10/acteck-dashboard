// Cálculos puros del Home V3 · sin React, sin red. Entradas: data de useHomeData + config.
import { MESES, META_INV_DIAS, Q_MESES } from './config';

const num = (v) => Number(v) || 0;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const sum = (arr, f = (x) => x) => arr.reduce((s, x) => s + num(f(x)), 0);
const pctDe = (a, b) => (b > 0 ? (a / b) * 100 : null);
const delta = (a, b) => (b > 0 ? ((a - b) / b) * 100 : null);

// Σ por mes de un año → Map(mes → valor)
function porMes(rows, anio, campo) {
  const m = new Map();
  rows.forEach((r) => { if (num(r.anio) === anio) m.set(num(r.mes), (m.get(num(r.mes)) || 0) + num(r[campo])); });
  return m;
}
const sumMeses = (map, meses) => meses.reduce((s, m) => s + (map.get(m) || 0), 0);

export const normMarca = (m) => {
  const s = String(m || '').trim().toUpperCase();
  if (!s) return 'Sin marca';
  if (s === 'BALAM RUSH' || s === 'BALAM') return 'Balam Rush';
  if (s === 'ACTECK' || s === 'REVKO') return 'Acteck';
  return s.charAt(0) + s.slice(1).toLowerCase();
};

// ── Cartera: aging de la última semana (buckets sólo vencidos)
function aging(detalle) {
  const b = { d1_30: [], d31_60: [], d61_90: [], mas90: [] };
  let total = 0, vencido = 0, alDia = 0;
  const now = Date.now();
  detalle.forEach((f) => {
    const saldo = num(f.saldo_actual); if (saldo <= 0) return;
    total += saldo;
    const dias = f.vencimiento ? Math.floor((now - new Date(f.vencimiento + 'T00:00:00').getTime()) / 86400000) : 0;
    if (dias <= 0) { alDia += saldo; return; }
    vencido += saldo;
    (dias <= 30 ? b.d1_30 : dias <= 60 ? b.d31_60 : dias <= 90 ? b.d61_90 : b.mas90).push({ folio: f.movimiento || f.referencia || 'Factura', dias, saldo });
  });
  Object.values(b).forEach((arr) => arr.sort((x, y) => y.saldo - x.saldo));
  return { total, vencido, alDia, buckets: b };
}

// ── Resumen principal: KPIs, hero, cartera, inventario, pagos, marketing, proyección, sugerido, recos
export function calcular(d, cfg, anio, mesActual) {
  const siCur = porMes(d.facturacion, anio, 'monto'), siPrev = porMes(d.facturacion, anio - 1, 'monto');
  const soCur = porMes(d.so.mes, anio, 'monto'), soPrev = porMes(d.so.mes, anio - 1, 'monto');
  const soPzCur = porMes(d.so.mes, anio, 'piezas');
  const cuotaDe = (m) => { const c = d.cuotas.find((x) => num(x.mes) === m); return { ideal: num(c?.cuota_ideal), min: num(c?.cuota_min) }; };
  const hasta = Q_MESES.anio.filter((m) => m <= mesActual);

  // Sell-in del mes y YTD vs cuota
  const siMes = siCur.get(mesActual) || 0, cuota = cuotaDe(mesActual);
  const pctCuota = pctDe(siMes, cuota.ideal), pctMin = pctDe(siMes, cuota.min);
  const ytd = sumMeses(siCur, hasta), ytdPrev = sumMeses(siPrev, hasta);
  const cuotaYtd = sum(hasta, (m) => cuotaDe(m).ideal), cuotaMinYtd = sum(hasta, (m) => cuotaDe(m).min);
  const pctYtd = pctDe(ytd, cuotaYtd), yoyYtd = delta(ytd, ytdPrev);
  const mesSiUlt = Math.max(0, ...[...siCur.entries()].filter(([, v]) => v > 0).map(([m]) => m));

  // Sell-out: último mes cerrado con datos (≤ mes anterior) + MTD
  const mesCerrado = Math.max(0, ...[...soCur.entries()].filter(([m, v]) => m < mesActual && v > 0).map(([m]) => m)) || null;
  const soCerrado = mesCerrado ? { mes: mesCerrado, monto: soCur.get(mesCerrado), yoy: delta(soCur.get(mesCerrado), soPrev.get(mesCerrado) || 0) } : null;
  const soMtd = soCur.get(mesActual) || 0, soMtdPrev = soPrev.get(mesActual) || 0;
  const soYtd = sumMeses(soCur, hasta), soYtdPrev = sumMeses(soPrev, hasta);
  const ratio = pctDe(soYtd, ytd), ratioPrev = pctDe(soYtdPrev, ytdPrev);
  const mesSoUlt = Math.max(0, ...[...soCur.entries()].filter(([, v]) => v > 0).map(([m]) => m));

  // Inventario del cliente (snapshot última semana) + días de inventario
  const inv = { stock: sum(d.inv.filas, (r) => r.stock), valor: sum(d.inv.filas, (r) => r.valor), skus: d.inv.filas.filter((r) => r.stock > 0).length, transito: sum(d.inv.filas, (r) => r.transito), anio: d.inv.anio, semana: d.inv.semana };
  let demandaDiaria = 0;
  if (cfg.diasInventario === 'diario90' && d.so.diario90) demandaDiaria = sum(d.so.diario90, (r) => r.cantidad) / 90;
  else { const ms = [1, 2, 3].map((o) => mesActual - o).filter((m) => m >= 1 && (soPzCur.get(m) || 0) > 0); demandaDiaria = ms.length ? sumMeses(soPzCur, ms) / (ms.length * 30) : 0; }
  const diasInv = demandaDiaria > 0 && inv.stock > 0 ? Math.round(inv.stock / demandaDiaria) : null;

  // Cartera
  const ec = d.estados[d.estados.length - 1] || null;
  const cartera = { ...aging(d.detalle), saldo: num(ec?.saldo_actual), vencidoEc: num(ec?.saldo_vencido), aVencer: num(ec?.saldo_a_vencer), notasCredito: num(ec?.notas_credito), dso: ec?.dso ?? null, corte: ec?.fecha_corte || null, semana: ec?.semana };
  // Cobranza estimada del mes = facturación del mes + saldo(mes-1) − saldo(mes)  (misma regla de los Home V2)
  const ultCorteMes = (m) => d.estados.filter((c) => c.fecha_corte && new Date(c.fecha_corte + 'T00:00:00').getFullYear() === anio && new Date(c.fecha_corte + 'T00:00:00').getMonth() + 1 === m).slice(-1)[0];
  const cM = ultCorteMes(mesActual), cP = ultCorteMes(mesActual - 1);
  cartera.cobranzaMes = cM ? Math.max(0, siMes + (cP ? num(cP.saldo_actual) : num(cM.saldo_actual)) - num(cM.saldo_actual)) : null;

  // Pagos próximos (pendiente / en_proceso)
  const hoy = hoyISO();
  const pagosOrd = [...d.pagos].sort((a, b) => String(a.fecha_compromiso || '9') .localeCompare(String(b.fecha_compromiso || '9')));
  const pagos = { total: sum(d.pagos, (p) => p.monto), n: d.pagos.length, vencidos: d.pagos.filter((p) => p.fecha_compromiso && p.fecha_compromiso < hoy), proximo: pagosOrd.find((p) => p.fecha_compromiso && p.fecha_compromiso >= hoy) || null, lista: pagosOrd.slice(0, 5) };

  // Marketing: próximas actividades (fecha ≥ hoy o activas) + inversión del año
  const mktOrd = [...d.marketing].filter((a) => a.estatus !== 'archivado').sort((a, b) => String(a.fecha || `${anio}-${String(a.mes).padStart(2, '0')}-01`).localeCompare(String(b.fecha || `${anio}-${String(b.mes).padStart(2, '0')}-01`)));
  const marketing = { proximas: mktOrd.filter((a) => (a.fecha && a.fecha >= hoy) || a.estatus === 'activo').slice(0, 6), inversion: sum(d.marketing, (a) => a.inversion), activas: d.marketing.filter((a) => a.estatus === 'activo').length, total: d.marketing.length };

  // Proyección de cierre anual (estacional: año anterior × crecimiento YTD; fallback ritmo mixto 40/60)
  const cuotaAnual = sum(Q_MESES.anio, (m) => cuotaDe(m).ideal);
  const growth = ytdPrev > 0 ? ytd / ytdPrev : null;
  const ult3 = hasta.slice(-3).map((m) => siCur.get(m) || 0).filter((v) => v > 0);
  const ritmo = (ytd / Math.max(1, mesActual)) * 0.4 + (ult3.length ? sum(ult3) / ult3.length : 0) * 0.6;
  const futuros = Q_MESES.anio.filter((m) => m > mesActual);
  const estacional = growth != null && futuros.some((m) => (siPrev.get(m) || 0) > 0);
  const proyAnual = ytd + sum(futuros, (m) => (estacional && (siPrev.get(m) || 0) > 0 ? siPrev.get(m) * growth : ritmo));
  const proyeccion = { cuotaAnual, ytd, proyAnual, pct: pctDe(proyAnual, cuotaAnual), brecha: proyAnual - cuotaAnual, ritmoNecesario: futuros.length ? (cuotaAnual - ytd) / futuros.length : 0, estacional, growth, mesesRestantes: futuros.length };

  // Rotación 3 meses por SKU (piezas/mes) → SKUs críticos + sugerido de reposición (regla de HomeCliente)
  const ultMesSo = mesSoUlt || mesActual, desde = Math.max(1, ultMesSo - 2);
  const rot = {};
  d.so.sku.forEach((r) => { if (r.mes < desde || r.mes > ultMesSo) return; const o = rot[r.sku] || (rot[r.sku] = { pz: 0, meses: new Set() }); o.pz += r.piezas; o.meses.add(r.mes); });
  const stockBy = {}; d.inv.filas.forEach((r) => { stockBy[r.sku] = r; });
  const actBy = {}; d.invActeck.forEach((r) => { actBy[r.sku] = num(r.inventario); });
  const criticos = [], sug = { piezas: 0, monto: 0, skus: 0 };
  Object.entries(rot).forEach(([sku, o]) => {
    const prom = o.pz / Math.max(1, o.meses.size); if (prom <= 0) return;
    const stock = stockBy[sku]?.stock || 0, dias = Math.round((stock / prom) * 30);
    if (dias < 30) criticos.push({ sku, titulo: stockBy[sku]?.titulo || sku, prom: Math.round(prom), stock, dias });
    let s = Math.max(0, Math.round(prom * 3 - stock));
    if (cfg.sugeridoMinimo && stock < prom && s > 0 && s < cfg.sugeridoMinimo) s = cfg.sugeridoMinimo;
    s = Math.min(s, actBy[sku] || 0);
    if (s > 0) { sug.piezas += s; sug.monto += s * (d.marcas[sku]?.precio || stockBy[sku]?.costo || 0); sug.skus++; }
  });
  criticos.sort((a, b) => a.dias - b.dias);
  const sinMovimiento = d.inv.filas.filter((r) => r.stock > 0 && !rot[r.sku]).length;

  // Recomendaciones / insights → pills en el Hero
  const recos = [];
  const fm = (n) => `$${(n / 1e6).toFixed(n >= 1e7 ? 1 : 2)}M`;
  if (diasInv != null && diasInv > META_INV_DIAS + 15) recos.push({ tone: 'orange', t: `Inventario alto · ${diasInv}d`, s: `Meta ${META_INV_DIAS}d · valor ${fm(inv.valor)}. Cabe una promo para rotar.` });
  if (cartera.vencido > 0) { const riesgo = sum(cartera.buckets.d61_90, (f) => f.saldo) + sum(cartera.buckets.mas90, (f) => f.saldo); recos.push({ tone: cartera.vencido > cartera.total * 0.15 ? 'red' : 'orange', t: `${fm(cartera.vencido)} vencido en cartera`, s: riesgo > 0 ? `${fm(riesgo)} > 60d en riesgo` : 'Revisa antes de que envejezca' }); }
  if (pctCuota != null && pctCuota >= 100) recos.push({ tone: 'green', t: `${(pctCuota - 100).toFixed(1)}% arriba de cuota`, s: 'Sube meta trimestral para mantener incentivo' });
  else if (pctCuota != null && pctCuota < 85 && siMes > 0) recos.push({ tone: 'orange', t: `Sell In al ${Math.round(pctCuota)}% de cuota`, s: `Faltan ${fm(cuota.ideal - siMes)} para la ideal` });
  if (ratio != null && ratio < 50) recos.push({ tone: 'orange', t: `Eficiencia SO/SI ${Math.round(ratio)}%`, s: 'Posible sobreinventario' });
  if (proyeccion.pct != null && proyeccion.pct < 90) recos.push({ tone: 'red', t: `Proyección anual ${Math.round(proyeccion.pct)}%`, s: `Necesitas ${fm(proyeccion.ritmoNecesario)}/mes el resto del año` });
  if (pagos.vencidos.length) recos.push({ tone: 'red', t: `${pagos.vencidos.length} pago${pagos.vencidos.length > 1 ? 's' : ''} vencido${pagos.vencidos.length > 1 ? 's' : ''}`, s: `${fm(sum(pagos.vencidos, (p) => p.monto))} con fecha compromiso pasada` });
  if (sinMovimiento > 0) recos.push({ tone: 'gray', t: `${sinMovimiento} SKUs sin sell-out`, s: 'Con inventario y sin venta en 3 meses' });

  // Hero: frase por reglas
  const titulo = !siMes ? 'Aún sin datos de sell in para este mes' : pctCuota == null ? `Sell In ${fm(siMes)} · sin cuota cargada` : pctCuota >= 100 ? `Vamos ${(pctCuota - 100).toFixed(1)}% arriba de la cuota mensual` : pctCuota >= 85 ? `Vamos al ${Math.round(pctCuota)}% de la cuota mensual` : 'Falta un empujón para la cuota del mes';
  const sub = [pctYtd != null ? `YTD al ${Math.round(pctYtd)}% de cuota` : null, yoyYtd != null ? `${yoyYtd >= 0 ? '+' : ''}${yoyYtd.toFixed(1)}% vs ${anio - 1}` : null, recos[0]?.t].filter(Boolean).join(' · ');

  return {
    siCur, siPrev, soCur, soPrev, cuotaDe, siMes, cuota, pctCuota, pctMin, ytd, ytdPrev, cuotaYtd, cuotaMinYtd, pctYtd, yoyYtd, mesSiUlt, mesSoUlt,
    soCerrado, soMtd, soMtdPrev, soYtd, soYtdPrev, ratio, ratioPrev, inv, diasInv, cartera, pagos, marketing, proyeccion, criticos: criticos.slice(0, 6), sugerido: sug, recos, titulo, sub,
    ultimaFechaSo: d.so.ultimaFecha,
  };
}

// ── Serie mensual para la gráfica + sumas del rango (Q1..Q4 / año)
export function serieMensual(r, meses, mesActual) {
  const data = meses.map((m) => { const c = r.cuotaDe(m); return { m, mes: MESES[m - 1], si: m > mesActual ? null : r.siCur.get(m) || 0, siPrev: r.siPrev.get(m) || 0, so: m > mesActual ? null : r.soCur.get(m) || 0, cuota: c.ideal || null, cuotaMin: c.min || null }; });
  const cerr = meses.filter((m) => m <= mesActual);
  const si = sumMeses(r.siCur, cerr), siPrev = sumMeses(r.siPrev, cerr), so = sumMeses(r.soCur, cerr), soPrev = sumMeses(r.soPrev, cerr);
  const cuota = sum(meses, (m) => r.cuotaDe(m).ideal), cuotaMin = sum(meses, (m) => r.cuotaDe(m).min);
  return { data, sums: { si, siPrev, so, cuota, cuotaMin, yoy: delta(si, siPrev), vsMin: delta(si, cuotaMin), vsIdeal: delta(si, cuota), ratio: pctDe(so, si), ratioPrev: pctDe(soPrev, siPrev) } };
}

// ── Split sell-in vs sell-out por marca (o por sucursal, con SI proporcional al peso de cada sucursal)
export function splitPor(d, cfg, r, meses, anio) {
  if (cfg.split === 'sucursal') {
    const siTotal = sumMeses(r.siCur, meses), soBy = {};
    (d.so.sucursalMes || []).forEach((x) => { if (num(x.anio) === anio && meses.includes(num(x.mes))) soBy[x.sucursal || '(sin sucursal)'] = (soBy[x.sucursal || '(sin sucursal)'] || 0) + num(x.monto); });
    const soTot = sum(Object.values(soBy));
    return Object.entries(soBy).map(([k, so]) => { const meta = cfg.sucursalMeta?.[k] || { label: k, tipo: 'virtual' }; const si = soTot > 0 ? siTotal * (so / soTot) : 0; return { key: k, label: meta.label, tipo: meta.tipo, si, so, ratio: pctDe(so, si) }; }).sort((a, b) => b.so - a.so);
  }
  const siBy = {}, soBy = {};
  d.facturacion.forEach((x) => { if (num(x.anio) === anio && meses.includes(num(x.mes))) { const k = normMarca(d.marcas[String(x.sku)]?.marca); siBy[k] = (siBy[k] || 0) + num(x.monto); } });
  (d.so.marcaMes || []).forEach((x) => { if (num(x.anio) === anio && meses.includes(num(x.mes))) { const k = normMarca(x.marca); soBy[k] = (soBy[k] || 0) + num(x.monto); } });
  return [...new Set([...Object.keys(siBy), ...Object.keys(soBy)])].map((k) => ({ key: k, label: k, si: siBy[k] || 0, so: soBy[k] || 0, ratio: pctDe(soBy[k] || 0, siBy[k] || 0) })).sort((a, b) => b.si + b.so - a.si - a.so).slice(0, 6);
}

// ── Top SKUs por sell-out (piezas) en los últimos 4 meses con datos
export function topSkus(d, r, n = 8) {
  const ult = r.mesSoUlt || 1, meses = [3, 2, 1, 0].map((o) => ult - o).filter((m) => m >= 1);
  const by = {};
  d.so.sku.forEach((x) => { if (!meses.includes(x.mes)) return; const o = by[x.sku] || (by[x.sku] = { sku: x.sku, marca: normMarca(x.marca || d.marcas[String(x.sku)]?.marca), total: 0, monto: 0 }); o[`m${x.mes}`] = (o[`m${x.mes}`] || 0) + x.piezas; o.total += x.piezas; o.monto += x.monto; });
  return { meses, filas: Object.values(by).sort((a, b) => b.total - a.total).slice(0, n) };
}
