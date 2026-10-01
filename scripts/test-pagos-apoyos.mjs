import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularApoyo, cuadreCon, conceptoApoyo, detalleApoyo, cuadreConvenio, apoyosVigentes } from '../src/modules/comercial/pagosv3/apoyos.js';
const P = [
  { sku: 'AC-933858', piezas: 40, precio_factura: 814.8, apoyo_pz: 70, inv_restante: 60 },
  { sku: 'BR-940726', piezas: 15, precio_factura: 1850, apoyo_pz: 140, inv_restante: 7 },
];
test('nuevo costo y monto por línea, total y piezas', () => {
  const c = calcularApoyo(P);
  assert.equal(c.lineas[0].nuevo_costo, 744.8); assert.equal(c.lineas[0].monto, 2800);
  assert.equal(c.lineas[1].monto, 2100); assert.equal(c.total, 4900); assert.equal(c.piezas, 55);
});
test('cuadre contra la bonificación del ERP (monto negativo en el ERP)', () => {
  assert.equal(cuadreCon(4900, { monto: -4900 }).estado, 'cuadra');
  assert.equal(cuadreCon(4900.5, { monto: -4900 }).estado, 'cuadra', 'tolerancia de $1');
  const d = cuadreCon(4000, { monto: -4900 }); assert.equal(d.estado, 'difiere'); assert.equal(d.diferencia, -900); assert.match(d.label, /faltan/);
  assert.equal(cuadreCon(4900, null).estado, 'sin_bonificacion');
});
test('concepto y detalle guardado', () => {
  assert.equal(conceptoApoyo(P, { concepto: 'PROMOCION GENERAL POR LENTO DESPLAZAMIENTO ACTECK' }), 'Promocion general por lento desplazamiento acteck · 2 productos');
  assert.equal(conceptoApoyo([P[0]]), 'Apoyo por producto · AC-933858');
  const d = detalleApoyo(P, { venta_id: 1298519, folio: '13872', fecha: '2026-09-07', concepto_codigo: 'BPRM-102', concepto: 'x', monto: -4900 });
  assert.equal(d.kind, 'apoyo_producto'); assert.equal(d.cuadre, 'cuadra'); assert.equal(d.bonificacion.monto, 4900); assert.equal(d.filas.length, 2); assert.equal(d.filas[0].monto, 2800);
});

test('historial de un SKU: varios apoyos al mismo producto, del más reciente al más viejo', async () => {
  const { historialSku } = await import('../src/modules/comercial/pagosv3/apoyos.js');
  const pagos = [
    { id: 1, cliente: 'digitalife', estado: 'pagado', detalle: { kind: 'apoyo_producto', bonificacion: { fecha: '2026-07-01', folio: '13600' }, productos: [{ sku: 'AC-1', piezas: 10, apoyo_pz: 50, monto: 500 }] } },
    { id: 2, cliente: 'digitalife', estado: 'calculado', periodo: '2026-09', detalle: { kind: 'apoyo_producto', bonificacion: null, productos: [{ sku: 'AC-1', piezas: 20, apoyo_pz: 40, monto: 800 }, { sku: 'AC-2', piezas: 1, apoyo_pz: 1, monto: 1 }] } },
    { id: 3, cliente: 'pcel', estado: 'pagado', detalle: { kind: 'apoyo_producto', productos: [{ sku: 'AC-1', piezas: 5, apoyo_pz: 5, monto: 25 }] } },
    { id: 4, cliente: 'digitalife', estado: 'cancelado', detalle: { kind: 'apoyo_producto', productos: [{ sku: 'AC-1', piezas: 5, apoyo_pz: 5, monto: 25 }] } },
  ];
  const h = historialSku(pagos, 'digitalife', 'AC-1');
  assert.equal(h.length, 2); assert.equal(h[0].pago_id, 2); assert.equal(h[1].folio, '13600'); assert.equal(h[0].monto + h[1].monto, 1300);
});

test('cuadre contra el costo convenio de la última foto', () => {
  const l = { sku: 'AC-933858', precio_factura: 814.8, apoyo_pz: 84.27 };
  assert.equal(cuadreConvenio(l, { costo_convenio: 730.53 }).estado, 'cuadra');
  assert.equal(cuadreConvenio(l, { costo_convenio: 814.8 }).estado, 'pendiente', 'el convenio sigue igual a la factura: Digitalife no lo ha aplicado');
  const d = cuadreConvenio(l, { costo_convenio: 700 }); assert.equal(d.estado, 'difiere'); assert.ok(d.diferencia < 0);
  assert.equal(cuadreConvenio(l, null).estado, 'sin_foto');
});
test('apoyos vigentes por convenio: apoyo = factura − convenio, registrados vs por registrar', () => {
  const filas = [
    { sku: 'A', apoyo_pz: 140, stock: 175, apoyo_inventario: 24500, vendidas_90d: 58 },
    { sku: 'B', apoyo_pz: 0, stock: 10, apoyo_inventario: 0, vendidas_90d: 3 },
    { sku: 'C', apoyo_pz: -50, stock: 4, apoyo_inventario: -200, vendidas_90d: 0 },
  ];
  const v = apoyosVigentes(filas, new Map([['A', { n: 1, monto: 24500, piezas: 175, folios: [] }]]));
  assert.equal(v.vigentes.length, 1); assert.equal(v.vigentes[0].registrado, true);
  assert.equal(v.apoyoInventario, 24500); assert.equal(v.pendientes, 0); assert.equal(v.compraronCaro, 1);
  assert.equal(apoyosVigentes(filas, null).pendientes, 1);
});
