// Sell Out por cuenta · «Sucursales que suben, bajan y dejaron de vender» (2026-10-26). node --test scripts/test-sellout-sucursales.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { movimientoSucursales } from '../src/modules/comercial/sellout/sucursales.js';

const f = (sucursal, mes, importe, anio = 2026) => ({ anio, mes, sucursal, importe, cantidad: 1 });
const filas = [
  f('GDL', 8, 0.9e6), f('GDL', 9, 2.1e6),            // sube 1.2M
  f('MTY', 8, 1.5e6), f('MTY', 9, 1.0e6),            // baja 0.5M
  f('CDMX', 8, 1.0e6), f('CDMX', 9, 1.03e6),         // +30K: bajo el umbral
  f('PUE', 6, 300e3), f('PUE', 7, 300e3), f('PUE', 8, 300e3), // sin venta en sep: vendía $300K/mes
  f('QRO', 9, 200e3),                                // nueva: sube 200K (en ago nada)
  f('LEON', 5, 9e6),                                 // fuera de la ventana: no cuenta
  f('GDL', 9, 5e6, 2025),                            // otro año: no cuenta
];

test('movimientoSucursales: suben, bajan, sin venta y frases', () => {
  const m = movimientoSucursales(filas, { anio: 2026, mes: 9 });
  assert.equal(m.mesLbl, 'sep'); assert.equal(m.mesPrevLbl, 'ago');
  assert.deepEqual(m.suben.map((x) => x.sucursal), ['GDL', 'QRO']);
  assert.equal(m.suben[0].frase, '$2.1M en sep · $900K en ago');
  assert.equal(m.suben[1].frase, '$200K en sep · $0 en ago');
  assert.deepEqual(m.bajan.map((x) => x.sucursal), ['MTY']);
  assert.equal(m.bajan[0].delta, -0.5e6);
  assert.deepEqual(m.sinVenta.map((x) => x.sucursal), ['PUE']);
  assert.equal(m.sinVenta[0].frase, 'vendía $300K/mes · $300K en ago');
  assert.equal(m.total, 5); // GDL, MTY, CDMX, PUE, QRO (LEON fuera de ventana)
});

test('movimientoSucursales: umbral, top y enero contra diciembre', () => {
  const m = movimientoSucursales(filas, { anio: 2026, mes: 9, umbral: 10e3, top: 1 });
  assert.deepEqual(m.suben.map((x) => x.sucursal), ['GDL']);
  assert.deepEqual(m.bajan.map((x) => x.sucursal), ['MTY']);
  const ene = movimientoSucursales([f('A', 12, 500e3, 2025), f('A', 1, 1e6)], { anio: 2026, mes: 1 });
  assert.equal(ene.mesPrevLbl, 'dic'); assert.equal(ene.suben[0].frase, '$1.0M en ene · $500K en dic');
  assert.deepEqual(movimientoSucursales([], { anio: 2026, mes: 1 }), { suben: [], bajan: [], sinVenta: [], mesLbl: 'ene', mesPrevLbl: 'dic', total: 0 });
});
