// Cliente propio en el celular (Resumen · Sell In · Sell Out) · cálculo puro. Pruebas: scripts/test-cliente-propio-movil.mjs.
// Regla fija (Fernando, 2026-10-05): estas pestañas las ven los clientes → NUNCA margen, costo ni utilidad; gráficas de
// línea (sólo el zoom diario en barras); en Sell Out el dinero en inventario es la cifra grande.
const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const idx = (a, m) => N(a) * 12 + (N(m) - 1);
const redondear5 = (v) => { const n = Math.max(0, Math.round(v)); return n >= 20 ? Math.round(n / 5) * 5 : n; };
export const compact = (n) => { const v = N(n); const a = Math.abs(v); if (a >= 1e6) return `$${(v / 1e6).toFixed(1)}M`; if (a >= 1e3) return `$${Math.round(v / 1e3)}K`; return `$${Math.round(v)}`; };

/** Tres meses cerrados antes de (anio, mes) → índices. */
export const cerradosAntes = (anio, mes, n = 3) => Array.from({ length: n }, (_, i) => idx(anio, mes) - 1 - i);

/**
 * Qué le falta: SKUs que el cliente SÍ vende (piezas en los 3 meses cerrados) y tiene agotados o con menos de una semana
 * en su piso. Propone piezas = 2 meses de su ritmo − lo que tiene, en múltiplos de 5, topado a lo que tenemos (si se sabe).
 *   skus: mv_sellout_cuenta_sku_mes de la cuenta · inv: v_sellout_inventario_cuenta_sku · nuestro: Map(sku → disponible)
 */
export function queLeFalta({ skus = [], inv = [], nuestro = null, anio, mes, roadmap = new Map(), top = 10 } = {}) {
  const cer = new Set(cerradosAntes(anio, mes));
  const ritmo = new Map();
  for (const r of skus) { if (!cer.has(idx(r.anio, r.mes))) continue; ritmo.set(r.sku, N(ritmo.get(r.sku)) + N(r.cantidad)); }
  const stock = new Map();
  for (const r of inv) if (r.sku) stock.set(r.sku, N(stock.get(r.sku)) + N(r.stock));
  const lista = [];
  ritmo.forEach((pz3, sku) => {
    const porMes = pz3 / 3;
    if (porMes <= 0) return;
    const st = N(stock.get(sku));
    const semanas = porMes > 0 ? st / (porMes / 4.33) : null;
    if (st > 0 && semanas >= 1) return;
    const tenemos = nuestro ? N(nuestro.get(sku)) : null;
    let piezas = redondear5(porMes * 2 - st);
    if (tenemos != null) piezas = Math.min(piezas, redondear5(tenemos));
    lista.push({ sku, descripcion: roadmap.get(sku)?.descripcion || '', ritmo: Math.round(porMes), stock: st, semanas: semanas == null ? null : Math.round(semanas * 10) / 10, tenemos, piezas, enRiesgo: Math.round(porMes), agotado: st <= 0 });
  });
  lista.sort((a, b) => b.ritmo - a.ritmo);
  return { lista: lista.slice(0, top), total: lista.length, agotados: lista.filter((x) => x.agotado).length, riesgoMes: lista.reduce((s, x) => s + x.enRiesgo, 0) };
}

/** Línea de «Qué le falta» para la Fila. */
export const lineaFalta = (x, nombre) => [x.agotado ? `agotado en ${nombre}` : `${x.semanas} sem en piso`, `vende ${x.ritmo} pz/mes`, x.tenemos != null ? (x.tenemos > 0 ? `tenemos ${Math.round(x.tenemos).toLocaleString('es-MX')}` : 'sin stock Acteck') : null].filter(Boolean).join(' · ');

/** Cobranza del último corte: cortes = estados_cuenta ordenados del más reciente al más viejo. */
export function resumenCobranza(cortes = [], detalle = [], hoy = new Date()) {
  const c = cortes[0];
  if (!c) return null;
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const porVencer = (detalle || []).filter((d) => N(d.saldo_actual) > 0 && d.vencimiento && d.vencimiento >= hoyIso).sort((a, b) => String(a.vencimiento).localeCompare(String(b.vencimiento)));
  const prox = porVencer[0] || null;
  const proxMonto = prox ? porVencer.filter((d) => d.vencimiento === prox.vencimiento).reduce((s, d) => s + N(d.saldo_actual), 0) : 0;
  return { saldo: N(c.saldo_actual), vencido: N(c.saldo_vencido), porVencer: N(c.saldo_a_vencer), dso: c.dso != null ? Math.round(N(c.dso)) : null, corte: c.fecha_corte || null, proximo: prox ? { fecha: prox.vencimiento, monto: proxMonto } : null, pctVencido: N(c.saldo_actual) > 0 ? (N(c.saldo_vencido) / N(c.saldo_actual)) * 100 : 0 };
}

/** Pagos y rebates del cliente: abiertos (en proceso) y los del mes, con etiqueta corta. */
export function pagosDelMes(pagos = [], anio, mes) {
  const per = `${anio}-${String(mes).padStart(2, '0')}`;
  const fechaDe = (p) => p.fecha_programada || p.fecha_limite || null;
  const abiertos = pagos.filter((p) => !['pagado', 'cancelado', 'rechazado'].includes(p.estado) && (p.estado !== 'calculado' || N(p.monto) > 0));
  const delMes = pagos.filter((p) => p.estado !== 'cancelado' && ((fechaDe(p) ? String(fechaDe(p)).slice(0, 7) === per : p.periodo === per)));
  const etiqueta = { calculado: 'por solicitar', solicitado: 'solicitado', autorizado: 'autorizado · falta folio', folio: 'con folio · por pagar', pagado: 'pagado', rechazado: 'rechazado' };
  const filas = abiertos.slice().sort((a, b) => String(fechaDe(a) || '9999').localeCompare(String(fechaDe(b) || '9999'))).slice(0, 5).map((p) => ({ id: p.id, titulo: p.concepto || p.descripcion || p.tipo || 'Pago', sub: [etiqueta[p.estado] || p.estado, fechaDe(p) ? `vence ${fechaCortaIso(fechaDe(p))}` : null].filter(Boolean).join(' · '), monto: N(p.monto), estado: p.estado, tone: p.estado === 'calculado' ? 'blue' : p.estado === 'pagado' ? 'green' : 'orange' }));
  return { filas, abiertos: abiertos.length, montoAbierto: abiertos.reduce((s, p) => s + N(p.monto), 0), delMes: delMes.length, montoMes: delMes.reduce((s, p) => s + N(p.monto), 0) };
}

export const fechaCortaIso = (iso) => { if (!iso) return ''; const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES[d.getMonth()].toLowerCase()}`; };

/** Acuerdos abiertos de la Agenda con #cliente (puntos de minuta y pendientes). */
export function acuerdosAbiertos(items = [], hoy = new Date(), { top = 4 } = {}) {
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const ab = items.filter((i) => i.estado === 'abierta').sort((a, b) => String(a.cuando || '9999').localeCompare(String(b.cuando || '9999')));
  return { filas: ab.slice(0, top).map((i) => ({ id: i.id, titulo: i.titulo, cuando: i.cuando || null, vencido: !!i.cuando && i.cuando < hoyIso, sub: i.cuando ? `${i.cuando < hoyIso ? 'venció' : 'vence'} ${fechaCortaIso(i.cuando)}` : 'sin fecha' })), total: ab.length, vencidos: ab.filter((i) => i.cuando && i.cuando < hoyIso).length };
}

/** Marketing del año: actividades, inversión y la próxima (fecha ≥ hoy, no archivada). */
export function marketingResumen(actividades = [], hoy = new Date()) {
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const vivas = actividades.filter((a) => a.estado !== 'archivada' && a.estado !== 'cancelada');
  const prox = vivas.filter((a) => a.fecha && a.fecha >= hoyIso).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)))[0] || null;
  return { total: vivas.length, inversion: vivas.reduce((s, a) => s + N(a.inversion), 0), activas: vivas.filter((a) => a.estado === 'activa' || (!a.completada && !a.estado)).length, proxima: prox ? { nombre: prox.nombre, fecha: prox.fecha, tipo: prox.tipo } : null };
}

/** Frase del hero del Resumen (sin margen). */
export function fraseResumen({ nombre, mes, pctCuota, soSi, invValor, semanas, vencido, agotados, enCurso = true } = {}) {
  const m = MESES_LARGO[mes - 1];
  const partes = [];
  if (pctCuota != null) partes.push(enCurso ? `Va al ${Math.round(pctCuota)} % de la cuota ideal de ${m}` : `${m[0].toUpperCase()}${m.slice(1)} cerró al ${Math.round(pctCuota)} % de la cuota ideal`);
  else partes.push(enCurso ? `${m[0].toUpperCase()}${m.slice(1)} va sin cuota cargada` : `${m[0].toUpperCase()}${m.slice(1)} cerró sin cuota cargada`);
  if (soSi != null) partes.push(`desplazó ${soSi.toFixed(1)} veces lo que le vendimos el mes pasado`);
  if (invValor != null) partes.push(`tiene ${compact(invValor)} en piso${semanas != null ? ` (${Math.round(semanas)} sem)` : ''}`);
  let txt = `${partes.join('; ')}.`;
  if (vencido != null) txt += vencido > 0 ? ` Cartera vencida ${compact(vencido)}.` : ' Cartera al corriente.';
  if (agotados) txt += ` ${agotados} SKU${agotados === 1 ? '' : 's'} que vende ${agotados === 1 ? 'está agotado' : 'están agotados'}.`;
  return txt;
}

/** Categorías como líneas de 12 meses (top n por importe del período) a partir de mv_sellout_cuenta_sku_mes o detalle de sell in. */
export function categoriasSerie({ filas = [], anio, mes, campoValor = 'importe', campoCat = 'categoria', roadmap = new Map(), top = 5 } = {}) {
  const fin = idx(anio, mes);
  const meses = Array.from({ length: 12 }, (_, i) => fin - 11 + i);
  const cat = (r) => String(r[campoCat] || roadmap.get(r.sku || r.articulo)?.categoria || 'Sin categoría').trim() || 'Sin categoría';
  const tot = new Map(), porMes = new Map();
  for (const r of filas) { const k = idx(r.anio, r.mes); if (k < meses[0] || k > fin) continue; const c = cat(r); tot.set(c, N(tot.get(c)) + N(r[campoValor])); const m = porMes.get(c) || new Map(); m.set(k, N(m.get(k)) + N(r[campoValor])); porMes.set(c, m); }
  const cats = [...tot.entries()].sort((a, b) => b[1] - a[1]).slice(0, top).map(([c]) => c);
  const datos = meses.map((k) => { const o = { label: `${MESES[k % 12]}${k % 12 === 0 ? ` ${String(Math.floor(k / 12)).slice(2)}` : ''}` }; cats.forEach((c, i) => { o[`c${i}`] = Math.round(N(porMes.get(c)?.get(k))); }); return o; });
  return { cats, datos, series: cats.map((c, i) => ({ key: `c${i}`, label: c })) };
}

/** SKUs sin movimiento (PCEL): con stock en su piso y sin venta en los 3 meses cerrados. */
export function sinMovimiento({ skus = [], inv = [], anio, mes, roadmap = new Map(), top = 10 } = {}) {
  const cer = new Set(cerradosAntes(anio, mes));
  const vendido = new Set();
  for (const r of skus) if (cer.has(idx(r.anio, r.mes)) && N(r.cantidad) > 0) vendido.add(r.sku);
  const lista = inv.filter((r) => r.sku && N(r.stock) > 0 && !vendido.has(r.sku)).map((r) => ({ sku: r.sku, descripcion: roadmap.get(r.sku)?.descripcion || r.titulo || '', stock: N(r.stock), valor: N(r.valor) })).sort((a, b) => b.valor - a.valor);
  return { lista: lista.slice(0, top), total: lista.length, valor: lista.reduce((s, x) => s + x.valor, 0), piezas: lista.reduce((s, x) => s + x.stock, 0) };
}

/** Filas de la tabla «Productos × 12 m · con su inventario»: últimos 2 meses, total 12 m, inventario $ y pz. */
export function filasSkuInv({ skus = [], inv = [], anio, mes, unidad = 'monto', roadmap = new Map() } = {}) {
  const fin = idx(anio, mes), ini = fin - 11;
  const campo = unidad === 'piezas' ? 'cantidad' : 'importe';
  const by = new Map();
  for (const r of skus) { const k = idx(r.anio, r.mes); if (k < ini || k > fin) continue; const o = by.get(r.sku) || { sku: r.sku, m1: 0, m2: 0, total: 0, pz3: 0 }; const v = N(r[campo]); o.total += v; if (k === fin) o.m2 += v; if (k === fin - 1) o.m1 += v; if (k >= fin - 3 && k < fin) o.pz3 += N(r.cantidad); by.set(r.sku, o); }
  const stock = new Map(), valor = new Map();
  for (const r of inv) if (r.sku) { stock.set(r.sku, N(stock.get(r.sku)) + N(r.stock)); valor.set(r.sku, N(valor.get(r.sku)) + N(r.valor)); if (!by.has(r.sku)) by.set(r.sku, { sku: r.sku, m1: 0, m2: 0, total: 0, pz3: 0 }); }
  return [...by.values()].map((o) => {
    const st = N(stock.get(o.sku)), ritmo = o.pz3 / 3;
    const sem = st > 0 && ritmo > 0 ? Math.round((st / (ritmo / 4.33)) * 10) / 10 : (st > 0 ? null : 0);
    const rd = roadmap.get(o.sku);
    return { sku: o.sku, label: o.sku, sub: rd?.descripcion || '', descripcion: rd?.descripcion || '', marca: rd?.marca || '', categoria: rd?.categoria || '', valores: [o.m1, o.m2, o.total, N(valor.get(o.sku)), st], semanas: sem, agotado: st <= 0 && o.pz3 > 0 };
  }).sort((a, b) => b.valores[1] - a.valores[1] || b.valores[2] - a.valores[2]);
}
export const colsSkuInv = (anio, mes) => { const fin = idx(anio, mes); const l = (k) => MESES[k % 12]; return [l(fin - 1), l(fin), 'Total 12 m', 'Inv $', 'Inv pz']; };
