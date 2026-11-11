// Acteck PCs · motor puro (2026-11-11). Sin React ni red: lo usan la pantalla (web y celular) y las pruebas.
// Reglas del anexo «Computadoras de escritorio ensambladas»: tarima completa de 60 equipos; pedido combinado
// hasta 2 modelos por tarima con mínimo 2 tarimas; producción desde el día hábil siguiente, hasta 100 equipos
// por día; envío 2–3 días. Los % se recalculan sobre totales, nunca se promedian.

export const TARIMA = 60;
export const CAPACIDAD_DIA = 100;
export const DIAS_ENVIO = 3;

export const ESTADOS = [
  { id: 'recibida', label: 'Orden recibida', tone: 'gray' },
  { id: 'produccion', label: 'En producción', tone: 'blue' },
  { id: 'enviada', label: 'Enviado', tone: 'purple' },
  { id: 'entregada', label: 'Entregado', tone: 'orange' },
];
// Etapas del embudo: las 4 de arriba + dos que salen de la factura y el cobro.
export const ETAPAS = [...ESTADOS, { id: 'facturada', label: 'Facturado', tone: 'orange' }, { id: 'cobrada', label: 'Cobrado', tone: 'green' }];

export const TIPOS_COMPONENTE = [
  'procesador', 'tarjeta madre', 'memoria', 'almacenamiento', 'gabinete', 'fuente', 'enfriamiento', 'gráficos', 'licencia', 'accesorio', 'otro',
];
// Lo que ponen nuestras marcas (se lo vendemos a DECME).
export const TIPOS_PROPIOS = new Set(['gabinete', 'fuente', 'enfriamiento']);

const num = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? null : Number(v));
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const deISO = (s) => { const [a, m, d] = String(s).slice(0, 10).split('-').map(Number); return new Date(a, m - 1, d); };
const esHabil = (d) => d.getDay() !== 0 && d.getDay() !== 6;

export function sumarHabiles(fechaISO, dias) {
  const d = deISO(fechaISO);
  let faltan = dias;
  while (faltan > 0) { d.setDate(d.getDate() + 1); if (esHabil(d)) faltan -= 1; }
  return iso(d);
}

/** Entrega estimada: producción desde el día hábil siguiente (100 por día) + 3 días hábiles de envío. */
export function entregaEstimada(fechaISO, equipos) {
  if (!fechaISO || !(equipos > 0)) return null;
  const diasProd = Math.ceil(equipos / CAPACIDAD_DIA);
  const finProd = sumarHabiles(fechaISO, diasProd);
  return { diasProduccion: diasProd, finProduccion: finProd, entrega: sumarHabiles(finProd, DIAS_ENVIO) };
}

/** Avisos de las reglas de tarima (no bloquean: Dirección puede autorizar un precio o pedido especial). */
export function avisosTarima(lineas) {
  const ls = (lineas || []).filter((l) => l.sku_modelo && Number(l.equipos) > 0);
  if (!ls.length) return [];
  const total = ls.reduce((s, l) => s + Number(l.equipos), 0);
  const modelos = new Set(ls.map((l) => l.sku_modelo)).size;
  const out = [];
  if (total % TARIMA !== 0) out.push(`${total} equipos no son tarimas completas de ${TARIMA}.`);
  const tarimas = Math.ceil(total / TARIMA);
  if (modelos > 1 && total < TARIMA * 2) out.push('Un pedido combinado pide al menos 2 tarimas (120 equipos).');
  if (modelos > tarimas * 2) out.push(`Son ${modelos} modelos en ${tarimas} tarima${tarimas === 1 ? '' : 's'}: máximo 2 por tarima.`);
  return out;
}

/** Costo vigente de un modelo a una fecha (la fila más reciente con vigente_desde ≤ fecha). */
export function costoVigente(costos, sku, fechaISO) {
  let mejor = null;
  for (const c of costos || []) {
    if (c.sku_modelo !== sku) continue;
    if (fechaISO && String(c.vigente_desde) > fechaISO) continue;
    if (!mejor || String(c.vigente_desde) > String(mejor.vigente_desde) || (String(c.vigente_desde) === String(mejor.vigente_desde) && String(c.created_at) > String(mejor.created_at))) mejor = c;
  }
  return mejor;
}

/** Historial de un modelo, del más nuevo al más viejo, con el cambio contra la versión anterior y por componente. */
export function historialCostos(costos, sku) {
  const filas = (costos || []).filter((c) => c.sku_modelo === sku)
    .sort((a, b) => String(b.vigente_desde).localeCompare(String(a.vigente_desde)) || String(b.created_at).localeCompare(String(a.created_at)));
  return filas.map((c, i) => {
    const ant = filas[i + 1];
    const delta = ant ? Number(c.costo) - Number(ant.costo) : null;
    const antes = new Map((ant?.desglose || []).map((d) => [String(d.descripcion || d.tipo).toLowerCase(), num(d.costo)]));
    const desglose = (c.desglose || []).map((d) => {
      const previo = antes.get(String(d.descripcion || d.tipo).toLowerCase());
      return { ...d, costo: num(d.costo), delta: previo != null && num(d.costo) != null ? num(d.costo) - previo : null };
    });
    return { ...c, costo: Number(c.costo), delta, deltaPct: ant && Number(ant.costo) ? (delta / Number(ant.costo)) * 100 : null, desglose };
  });
}

/** Etapa de un pedido para el embudo. */
export function etapaDe(o) {
  if (o.estado === 'cancelada') return 'cancelada';
  if (o.cobrado_at) return 'cobrada';
  if (o.factura_cliente) return 'facturada';
  return o.estado || 'recibida';
}

const diasEntre = (a, b) => Math.round((deISO(b) - deISO(a)) / 86400000);

/** Pedidos con totales (equipos, monto, costo), etapa, entrega estimada y vencimientos. */
export function pedidos({ ordenes = [], lineas = [], costos = [] }, hoyISO) {
  const porOrden = new Map();
  for (const l of lineas) { if (!porOrden.has(l.orden_id)) porOrden.set(l.orden_id, []); porOrden.get(l.orden_id).push(l); }
  return ordenes.map((o) => {
    const ls = (porOrden.get(o.id) || []).map((l) => {
      const costo = num(l.costo) ?? num(costoVigente(costos, l.sku_modelo, o.fecha)?.costo);
      return { ...l, equipos: Number(l.equipos) || 0, precio: num(l.precio), costo };
    });
    const equipos = ls.reduce((s, l) => s + l.equipos, 0);
    const monto = ls.reduce((s, l) => s + l.equipos * (l.precio || 0), 0);
    const sinCosto = ls.some((l) => l.costo == null);
    const costo = ls.reduce((s, l) => s + l.equipos * (l.costo || 0), 0);
    const etapa = etapaDe(o);
    const est = entregaEstimada(o.fecha, equipos);
    const cobroVencido = etapa === 'facturada' && o.factura_cliente_vence && hoyISO && o.factura_cliente_vence < hoyISO ? diasEntre(o.factura_cliente_vence, hoyISO) : 0;
    const pagoPendiente = etapa !== 'cancelada' && !o.pagado_decme_at ? (num(o.factura_decme_monto) ?? (o.factura_decme ? costo : 0)) : 0;
    const entregaTarde = ['recibida', 'produccion', 'enviada'].includes(etapa) && (o.fecha_entrega || est?.entrega) && hoyISO && (o.fecha_entrega || est.entrega) < hoyISO;
    return { ...o, lineas: ls, equipos, monto, costo, sinCosto, utilidad: sinCosto ? null : monto - costo, etapa, entrega: o.fecha_entrega || est?.entrega || null, entregaEstimada: !o.fecha_entrega, cobroVencido, pagoPendiente, entregaTarde: !!entregaTarde };
  }).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
}

/** Resumen del proyecto a partir de los pedidos (los cancelados no cuentan). */
export function resumen(peds, hoyISO) {
  const vivos = peds.filter((p) => p.etapa !== 'cancelada');
  const s = (f) => vivos.reduce((a, p) => a + (f(p) || 0), 0);
  const equipos = s((p) => p.equipos), venta = s((p) => p.monto);
  const conCosto = vivos.filter((p) => !p.sinCosto);
  const ventaConCosto = conCosto.reduce((a, p) => a + p.monto, 0);
  const utilidad = conCosto.reduce((a, p) => a + p.utilidad, 0);
  const facturados = vivos.filter((p) => p.etapa === 'facturada');
  const etapas = Object.fromEntries(ETAPAS.map((e) => [e.id, vivos.filter((p) => p.etapa === e.id).length]));
  const abiertos = vivos.filter((p) => ['recibida', 'produccion', 'enviada'].includes(p.etapa));
  const siguiente = abiertos.filter((p) => p.entrega).sort((a, b) => String(a.entrega).localeCompare(String(b.entrega)))[0] || null;
  const primera = vivos.map((p) => p.fecha).sort()[0] || null;
  return {
    pedidos: vivos.length, equipos, tarimas: equipos / TARIMA, venta,
    clientes: new Set(vivos.map((p) => p.cliente)).size,
    ticket: equipos ? venta / equipos : null,
    cobrado: s((p) => (p.etapa === 'cobrada' ? p.monto : 0)),
    porCobrar: facturados.reduce((a, p) => a + p.monto, 0),
    vencido: facturados.reduce((a, p) => a + (p.cobroVencido ? p.monto : 0), 0),
    sinFacturar: s((p) => (['recibida', 'produccion', 'enviada', 'entregada'].includes(p.etapa) ? p.monto : 0)),
    porPagar: s((p) => p.pagoPendiente),
    pagado: s((p) => (p.pagado_decme_at ? (num(p.factura_decme_monto) ?? p.costo) : 0)),
    utilidad: conCosto.length ? utilidad : null,
    margen: ventaConCosto ? (utilidad / ventaConCosto) * 100 : null,
    enProduccion: s((p) => (p.etapa === 'produccion' ? p.equipos : 0)),
    etapas, siguiente, primera,
    diasPiloto: primera && hoyISO ? diasEntre(primera, hoyISO) + 1 : null,
  };
}

/** Frase del hero. */
export function frase(r) {
  if (!r.pedidos) return 'Todavía no hay pedidos de Acteck PCs. Registra el primero para empezar a medir el proyecto.';
  const partes = [`${r.equipos.toLocaleString('es-MX')} equipos vendidos en ${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'}`];
  if (r.enProduccion) partes.push(`${r.enProduccion.toLocaleString('es-MX')} en producción`);
  if (r.porCobrar) partes.push(r.vencido ? 'hay cobranza vencida' : 'con cobranza al corriente');
  return `${partes.join('; ')}.`;
}

/** Tabla de modelos: precio de lista, costo vigente, margen, pedidos y ventas reales del ERP. */
export function filasModelos({ modelos = [], costos = [], componentes = [], precios = {}, ventas = [] }, peds, hoyISO) {
  const pedidos = new Map(), vendidos = new Map();
  for (const p of peds) { if (p.etapa === 'cancelada') continue; for (const l of p.lineas) pedidos.set(l.sku_modelo, (pedidos.get(l.sku_modelo) || 0) + l.equipos); }
  for (const v of ventas) { const a = vendidos.get(v.sku) || { piezas: 0, monto: 0 }; a.piezas += Number(v.piezas) || 0; a.monto += Number(v.monto) || 0; vendidos.set(v.sku, a); }
  const comp = new Map();
  for (const c of componentes) comp.set(c.sku_modelo, (comp.get(c.sku_modelo) || 0) + 1);
  return [...modelos].sort((a, b) => (a.orden || 0) - (b.orden || 0) || String(a.sku).localeCompare(String(b.sku))).map((m) => {
    const cv = costoVigente(costos, m.sku, hoyISO);
    const hist = historialCostos(costos, m.sku);
    const precio = num(precios[m.sku]);
    const costo = num(cv?.costo);
    const config = [m.procesador, m.memoria, m.almacenamiento].filter(Boolean).join(' · ');
    return {
      ...m, config, precio, costo, costoDesde: cv?.vigente_desde || null, deltaCosto: hist[0]?.delta ?? null,
      margen: precio && costo != null ? ((precio - costo) / precio) * 100 : null,
      pedidos: pedidos.get(m.sku) || 0, facturados: vendidos.get(m.sku)?.piezas || 0, facturadoMonto: vendidos.get(m.sku)?.monto || 0,
      componentes: comp.get(m.sku) || 0,
    };
  });
}

/** Componentes propios: cuántos se han usado, cuántos tenemos y para cuántas tarimas alcanza. */
export function capacidad({ componentes = [], inventario = {}, transito = {}, descripciones = {} }, peds) {
  const equiposPorModelo = new Map();
  for (const p of peds) { if (p.etapa === 'cancelada') continue; for (const l of p.lineas) equiposPorModelo.set(l.sku_modelo, (equiposPorModelo.get(l.sku_modelo) || 0) + l.equipos); }
  const por = new Map();
  for (const c of componentes) {
    if (!c.sku_propio) continue;
    const k = c.sku_propio;
    const a = por.get(k) || { sku: k, descripcion: descripciones[k] || c.descripcion, tipo: c.tipo, usados: 0, modelos: new Set(), porEquipo: 0 };
    a.usados += (equiposPorModelo.get(c.sku_modelo) || 0) * (Number(c.cantidad) || 1);
    a.modelos.add(c.sku_modelo);
    a.porEquipo = Math.max(a.porEquipo, Number(c.cantidad) || 1);
    por.set(k, a);
  }
  return [...por.values()].map((a) => {
    const disponible = Number(inventario[a.sku]) || 0;
    const t = transito[a.sku] || null;
    const tarimas = Math.floor(disponible / (TARIMA * a.porEquipo));
    return { ...a, modelos: a.modelos.size, disponible, tarimas, tono: tarimas >= 10 ? 'green' : tarimas >= 3 ? 'orange' : 'red', llega: t?.eta || null, llegaPiezas: t?.cantidad || 0 };
  }).sort((a, b) => a.tarimas - b.tarimas);
}
