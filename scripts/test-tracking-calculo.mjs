// Pruebas de la lógica pura del Tracking Pedidos V3 (etapas, fill rate, backorder, desfase, agregados).
//   node scripts/test-tracking-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularOC, calcularTodo, fechasEnvio, embudo, resumen, backorderPorSku, surtirHoy, tiemposPorCliente, facturasSinOC, candidatasParaFactura, facetas, pasaFiltros, FILTROS_VACIOS, ordenar } from '../src/modules/comercial/tracking/calculo.js';
import { textoEstatusOC, textoListaSurtir, textoExplicativo, normOC } from '../src/modules/comercial/tracking/textos.js';

const HOY = new Date(2026, 8, 10, 12); // 10 sep 2026
const oc = (over = {}) => ({ id: 'oc1', cliente_key: 'pcel', numero_oc_cliente: '4500218', fecha_recibida: '2026-09-04T10:00:00Z', facturas: [], fuente: 'manual', updated_at: '2026-09-06T00:00:00Z', ...over });
const skus = [{ id: 's1', oc_id: 'oc1', sku: 'AC-943178', cantidad_ordenada: 200, precio_unitario: 100 }, { id: 's2', oc_id: 'oc1', sku: 'AC-943253', cantidad_ordenada: 150, precio_unitario: 200 }, { id: 's3', oc_id: 'oc1', sku: 'AC-939409', cantidad_ordenada: 70, precio_unitario: 50 }];
const factura = { id: 'f1', oc_id: 'oc1', folio: 'A10381203', fecha: '2026-09-06', piezas: 300, monto: 40000, fuente: 'erp', ligada_por: 'referencia' };
const facturaSkus = new Map([['f1', [{ factura_id: 'f1', sku: 'AC-943178', piezas: 200 }, { factura_id: 'f1', sku: 'AC-943253', piezas: 70 }, { factura_id: 'f1', sku: 'AC-939409', piezas: 30 }]]]);
const transito = new Map([['AC-943253', { cantidad: 2000, eta: '2026-09-21', po: '7712' }], ['AC-939409', { cantidad: 500, eta: '2026-09-21', po: '7712' }]]);
const stock = new Map([['AC-943253', { disponible: 0 }], ['AC-939409', { disponible: 12 }]]);

test('OC sólo recibida: etapa recibida, fill 0, detenida si > 3 días', () => {
  const r = calcularOC({ oc: oc(), skus, hoy: HOY });
  assert.equal(r.etapa, 'recibida');
  assert.equal(r.pedido, 420);
  assert.equal(r.fill, 0);
  assert.equal(r.monto, 200 * 100 + 150 * 200 + 70 * 50);
  assert.ok(r.diasEnEtapa > 5 && r.detenida);
  assert.equal(r.timeline.length, 4); // sin cotización
  assert.equal(r.timeline[1].estado, 'pendiente');
});

test('factura parcial del ERP: fill 71 %, backorder por SKU con PO que lo cubre', () => {
  const r = calcularOC({ oc: oc(), skus, facturas: [factura], facturaSkus, transito, stock, hoy: HOY });
  assert.equal(r.etapa, 'facturada');
  assert.equal(r.facturado, 300);
  assert.equal(r.backorder, 120);
  assert.ok(Math.abs(r.fill - 71.43) < 0.1);
  assert.equal(r.fuenteFacturado, 'erp');
  const bo = Object.fromEntries(r.backorderSkus.map((s) => [s.sku, s]));
  assert.equal(bo['AC-943253'].backorder, 80);
  assert.equal(bo['AC-943253'].cubre.po, '7712');
  assert.equal(bo['AC-939409'].backorder, 40);
  assert.equal(r.surtibleHoy, false); // stock 0 y 12 < backorder
  assert.equal(r.timeline.find((t) => t.etapa === 'facturada').estado, 'parcial');
  assert.ok(r.detenida, 'facturada hace 4 d sin envío → detenida');
  assert.match(textoExplicativo(r), /A10381203/);
  assert.match(textoExplicativo(r), /PO 7712/);
});

test('surtible hoy: stock completo para el backorder', () => {
  const st = new Map([['AC-943253', { disponible: 100, porAlmacen: { GDL: 100 } }], ['AC-939409', { disponible: 50, porAlmacen: { CDMX: 50 } }]]);
  const r = calcularOC({ oc: oc(), skus, facturas: [factura], facturaSkus, stock: st, hoy: HOY });
  assert.equal(r.surtibleHoy, true);
  assert.equal(r.almacenSurtir, 'GDL');
});

test('fill ≥ 100 y envío entregado → entregada; tiempos por etapa', () => {
  const fsk = new Map([['f1', [{ sku: 'AC-943178', piezas: 200 }, { sku: 'AC-943253', piezas: 150 }, { sku: 'AC-939409', piezas: 70 }]]]);
  const envios = [{ id: 'e1', oc_id: 'oc1', numero_envio: 1, fuente: 'manual', fecha_surtida: '2026-09-07T10:00:00Z', fecha_entregada: '2026-09-09T10:00:00Z', paqueteria: 'Estafeta', guia_rastreo: 'G1' }];
  const r = calcularOC({ oc: oc(), skus, facturas: [{ ...factura, piezas: 420 }], facturaSkus: fsk, envios, hoy: HOY });
  assert.equal(r.etapa, 'entregada');
  assert.equal(r.abierta, false);
  assert.equal(r.fill, 100);
  assert.ok(r.tiempos.factura > 1.4 && r.tiempos.factura < 2.1, `factura ${r.tiempos.factura}`); // 4 sep 10:00Z → 6 sep local
  assert.ok(Math.abs(r.tiempos.total - 5) < 0.01);
  assert.equal(r.detenida, false);
});

test('fill < 100 con envío entregado se queda en enviada (no entregada)', () => {
  const envios = [{ id: 'e1', oc_id: 'oc1', numero_envio: 1, fuente: 'manual', fecha_surtida: '2026-09-07', fecha_entregada: '2026-09-09' }];
  const r = calcularOC({ oc: oc(), skus, facturas: [factura], facturaSkus, envios, hoy: HOY });
  assert.equal(r.etapa, 'enviada');
  assert.equal(r.detenida, false, 'enviada no cuenta como detenida');
});

test('legacy sin factura: surtido manual de oc_envio_skus cuenta como facturado manual', () => {
  const envios = [{ id: 'e1', oc_id: 'oc1', numero_envio: 1, fuente: 'manual', fecha_surtida: '2026-09-07' }];
  const envioSkus = new Map([['e1', [{ oc_sku_id: 's1', cantidad_surtida: 200 }]]]);
  const r = calcularOC({ oc: oc(), skus, envios, envioSkus, hoy: HOY });
  assert.equal(r.fuenteFacturado, 'manual');
  assert.equal(r.facturado, 200);
  assert.equal(r.etapa, 'enviada');
  assert.equal(r.fechas.facturada.getDate(), 7);
});

test('desfase: manual gana, ERP difiere > 2 d → conDesfase; elegir erp cambia la fecha efectiva', () => {
  const e = { id: 'e1', fuente: 'manual', fecha_surtida: '2026-09-02', fecha_envio_erp: '2026-09-06T00:00:00', guia_erp_id: 9, fecha_elegida: null };
  const a = fechasEnvio(e);
  assert.equal(a.fuenteEnvio, 'manual');
  assert.equal(a.fechaEnvio, '2026-09-02');
  assert.ok(a.desfase >= 3.9 && a.conDesfase);
  const b = fechasEnvio({ ...e, fecha_elegida: 'erp' });
  assert.equal(b.fuenteEnvio, 'erp');
  assert.equal(b.conDesfase, false);
  const c = fechasEnvio({ ...e, fecha_elegida: 'manual' });
  assert.equal(c.conDesfase, false);
  assert.equal(c.fechaEnvio, '2026-09-02');
  const d = fechasEnvio({ id: 'e2', fuente: 'manual', fecha_surtida: null, fecha_envio_erp: '2026-09-06' });
  assert.equal(d.fuenteEnvio, 'erp', 'sin fecha manual toma la del ERP');
});

test('cotización previa aparece en el timeline; folios capturados sin ERP quedan pendientes', () => {
  const cot = { id: 'c1', folio: 'COT-1', estado: 'aceptada', fecha_solicitada: '2026-09-01', fecha_enviada: '2026-09-02' };
  const r = calcularOC({ oc: oc({ facturas: ['A999'] }), skus, cotizacion: cot, hoy: HOY });
  assert.equal(r.timeline[0].etapa, 'cotizacion');
  assert.equal(r.timeline[0].estado, 'hecho');
  assert.equal(r.etapa, 'recibida');
  assert.deepEqual(r.folioPendientes, ['A999']);
  assert.match(textoExplicativo(r), /A999/);
});

test('calcularTodo + agregados: embudo, resumen, backorder global, surtir hoy, tiempos, filtros', () => {
  const datos = {
    ocs: [oc(), oc({ id: 'oc2', cliente_key: 'digitalife', numero_oc_cliente: 'OC-48211', fecha_recibida: '2026-09-08' })],
    ocSkus: [...skus, { id: 's4', oc_id: 'oc2', sku: 'BR-943918', cantidad_ordenada: 28, precio_unitario: 10 }],
    facturas: [factura], facturaSkus: [...facturaSkus.get('f1')],
    envios: [], envioSkus: [],
    cotizaciones: [{ id: 'c9', cliente_key: 'dicotech', folio: 'COT-2609-04', estado: 'enviada', fecha_solicitada: '2026-09-06', fecha_enviada: '2026-09-06', piezas: 1200, monto: 1.4e6 }, { id: 'c8', cliente_key: 'dicotech', folio: 'COT-2608-11', estado: 'perdida', fecha_solicitada: '2026-08-20', motivo_perdida: 'Precio' }],
    transito, stock: new Map([['BR-943918', { disponible: 50, porAlmacen: { CDMX: 50 } }]]), roadmap: new Map([['BR-943918', { descripcion: 'Gabinete Nitrox' }]]),
  };
  const filas = calcularTodo(datos, HOY);
  assert.equal(filas.length, 4);
  const cots = filas.filter((f) => f.esCotizacion);
  assert.equal(cots.length, 2);
  assert.equal(cots.find((c) => c.cotizacion.id === 'c8').etapa, 'perdida');
  assert.equal(cots.find((c) => c.cotizacion.id === 'c8').abierta, false);

  const res = resumen(filas, HOY);
  assert.equal(res.abiertas, 2);
  assert.equal(res.surtibles, 1);           // oc2 tiene stock completo
  assert.equal(res.surtiblesPz, 28);
  assert.equal(res.backorderSkus, 3);
  assert.equal(res.backorderPz, 148);
  assert.equal(res.backorderConArribo, 2);
  assert.equal(res.backorderSinPo, 0);       // BR-943918 no tiene PO pero el stock lo cubre
  assert.equal(res.backorderConStock, 1);
  assert.equal(res.cotizacionesAbiertas, 1);

  const bo = backorderPorSku(filas);
  assert.equal(bo[0].sku, 'AC-943253');
  assert.deepEqual(bo[0].clientes, ['pcel']);
  assert.equal(bo.find((b) => b.sku === 'BR-943918').descripcion, 'Gabinete Nitrox');

  const sh = surtirHoy(filas);
  assert.equal(sh.length, 1);
  assert.equal(sh[0].numero_oc_cliente, 'OC-48211');
  assert.match(textoListaSurtir(sh, { fecha: HOY }), /OC-48211: 28 pz · CDMX/);

  const em = embudo(filas, datos.cotizaciones, 'trimestre', HOY);
  assert.equal(em.etapas[0].n, 2);
  assert.equal(em.etapas[1].n, 2);
  assert.equal(em.etapas[2].n, 1);
  assert.equal(em.etapas[4].n, 0);
  assert.equal(embudo(filas, datos.cotizaciones, 'mes', HOY).etapas[0].n, 1);

  const tp = tiemposPorCliente(filas, HOY);
  assert.equal(tp.find((t) => t.cliente_key === 'pcel').n, 1);
  assert.equal(tp.find((t) => t.cliente_key === 'pcel').estado, 'sin datos');

  const f = FILTROS_VACIOS();
  const fc = facetas(filas, f);
  assert.equal(fc.cliente.get('pcel'), 1);
  assert.equal(fc.etapa.get('cotizacion'), 1);
  assert.equal(fc.segmento.todos, 4);
  assert.equal(fc.segmento.abiertos, 3);
  f.q = 'ac-943253';
  assert.deepEqual(filas.filter((r) => pasaFiltros(r, f)).map((r) => r.id), ['oc1']);
  f.q = 'a10381203';
  assert.deepEqual(filas.filter((r) => pasaFiltros(r, f)).map((r) => r.id), ['oc1']);
  f.q = ''; f.detenida = true;
  assert.ok(filas.filter((r) => pasaFiltros(r, f)).every((r) => r.detenida));
  const ord = ordenar(filas.filter((r) => pasaFiltros(r, FILTROS_VACIOS())));
  assert.equal(ord[0].detenida, true);
});

test('facturas sin OC y candidatas por referencia', () => {
  const erp = [
    { folio: 'A1', cliente_key: 'pcel', referencia: 'MTY 4500218', fecha: '2026-09-09', piezas: 10, monto: 100, partidas: [] },
    { folio: 'A2', cliente_key: 'pcel', referencia: 'SIN ORDEN', fecha: '2026-09-09', piezas: 5, monto: 50, partidas: [] },
    { folio: 'A3', cliente_key: 'pcel', referencia: 'X', fecha: '2026-06-01', piezas: 5, monto: 50, partidas: [] },
  ];
  const sin = facturasSinOC(erp, [{ folio: 'A2' }], HOY);
  assert.deepEqual(sin.map((f) => f.folio), ['A1']);
  const filas = calcularTodo({ ocs: [oc()], ocSkus: skus, facturas: [], facturaSkus: [], envios: [], envioSkus: [], cotizaciones: [] }, HOY);
  const cand = candidatasParaFactura(sin[0], filas);
  assert.equal(cand[0].parecido, true);
  assert.equal(normOC('MTY 0045-00218'), 'MTY004500218');
  assert.equal(normOC('0048211'), '48211');
});

test('texto de estatus para WhatsApp (sin montos ni costos)', () => {
  const r = calcularOC({ oc: oc(), skus, facturas: [factura], facturaSkus, transito, hoy: HOY });
  const t = textoEstatusOC(r, { fecha: HOY });
  assert.match(t, /PCEL · OC 4500218/);
  assert.match(t, /Facturada parcial/);
  assert.match(t, /300 de 420 facturadas · pendientes 120/);
  assert.match(t, /AC-943253/);
  assert.doesNotMatch(t, /\$/);
});
