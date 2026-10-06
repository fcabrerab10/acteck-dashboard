import test from 'node:test';
import assert from 'node:assert/strict';
import { quienLoDesplaza, quienLoCompra, serieSiSo, mesesCerrados, semanasDe } from '../src/modules/comercial/producto360/calculo.js';

test('meses cerrados', () => { assert.deepEqual(mesesCerrados(2026, 1, 3), ['2025-12', '2025-11', '2025-10']); });
test('quién lo desplaza: ranking, delta, share e inventario en semanas', () => {
  const filas = [
    { cuenta: 'cva', anio: 2026, mes: 9, piezas: 1020, importe: 1.4e6 }, { cuenta: 'cva', anio: 2026, mes: 8, piezas: 836, importe: 1.1e6 }, { cuenta: 'cva', anio: 2026, mes: 7, piezas: 700, importe: 1e6 }, { cuenta: 'cva', anio: 2026, mes: 6, piezas: 600, importe: 9e5 },
    { cuenta: 'ct', anio: 2026, mes: 9, piezas: 800, importe: 1.1e6 }, { cuenta: 'ct', anio: 2026, mes: 8, piezas: 900, importe: 1.2e6 },
    { cuenta: 'guc', anio: 2026, mes: 8, piezas: 300, importe: 4e5 },
  ];
  const r = quienLoDesplaza(filas, { anio: 2026, mes: 9, inventario: [{ cuenta: 'cva', piezas: 1500, valor: 2e6 }, { cuenta: 'guc', piezas: 0, valor: 0 }], nombres: { cva: 'Grupo CVA' } });
  assert.equal(r[0].cuenta, 'cva'); assert.equal(r[0].nombre, 'Grupo CVA');
  assert.equal(Math.round(r[0].deltaPz), 22);
  assert.equal(Math.round(r[0].share), 56);
  assert.equal(r[0].inv.estado, 'sano'); assert.ok(r[0].inv.semanas > 5 && r[0].inv.semanas < 12);
  assert.equal(r[1].cuenta, 'ct'); assert.equal(Math.round(r[1].deltaPz), -11); assert.equal(r[1].inv, null);
  const guc = r.find((x) => x.cuenta === 'guc'); assert.equal(guc.piezas, 0); assert.equal(guc.inv.estado, 'agotado');
});
test('quién lo compra y quiénes dejaron de comprarlo', () => {
  const filas = [
    { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 9, piezas: 1020, monto: 1.3e6 }, { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 8, piezas: 836, monto: 1e6 }, { cliente: '00002', cliente_nombre: 'GRUPO CVA', anio: 2026, mes: 7, piezas: 500, monto: 6e5 },
    { cliente: '00015', cliente_nombre: 'EXEL', anio: 2026, mes: 2, piezas: 180, monto: 2e5 }, { cliente: '00015', cliente_nombre: 'EXEL', anio: 2025, mes: 11, piezas: 90, monto: 1e5 },
    { cliente: '00016', cliente_nombre: 'TECHSMART', anio: 2026, mes: 6, piezas: 40, monto: 5e4 },
  ];
  const r = quienLoCompra(filas, { anio: 2026, mes: 9, ventana: 6 });
  assert.equal(r.compran.length, 1); assert.equal(r.compran[0].nombre, 'GRUPO CVA'); assert.equal(r.compran[0].mesesSeguidos, 3); assert.equal(r.compran[0].ultimaCompra, '2026-09');
  assert.deepEqual(r.dejaron.map((x) => x.nombre), ['EXEL']);
  assert.equal(r.dejaron[0].ultimaCompra, '2026-02'); assert.equal(r.dejaron[0].piezas12m, 270);
});
test('serie sell in vs sell out y semanas', () => {
  const s = serieSiSo([{ anio: 2026, mes: 9, piezas: 2310 }], [{ anio: 2026, mes: 9, piezas: 2980 }, { anio: 2026, mes: 8, piezas: 2600 }], { anio: 2026, mes: 9 });
  assert.equal(s.length, 12); assert.equal(s[11].key, '2026-09'); assert.equal(s[11].si, 2310); assert.equal(s[11].so, 2980); assert.equal(s[10].so, 2600); assert.equal(s[0].key, '2025-10');
  assert.equal(semanasDe(700, 2310), 1.3);
});
