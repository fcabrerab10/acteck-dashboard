// Acteck PCs · SSR de la vista pura (web y celular) con datos de ejemplo, sin red.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { ActeckPcsVista } = await vite.ssrLoadModule('/src/modules/comercial/pcs/ActeckPCs.jsx');
const pintar = (props) => renderToString(React.createElement(ThemeProvider, null, React.createElement(ActeckPcsVista, props))).replace(/<!-- -->/g, '');

const datos = {
  modelos: [{ sku: 'AC-817584', licencia: 'Windows Home', procesador: 'Ryzen 3', memoria: '8 GB', orden: 1 }, { sku: 'AC-817614', licencia: 'Windows Home', orden: 2 }],
  componentes: [{ sku_modelo: 'AC-817584', tipo: 'gabinete', descripcion: 'Gabinete Performance II', sku_propio: 'AC-935777', cantidad: 1 }],
  costos: [{ id: 'c1', sku_modelo: 'AC-817584', vigente_desde: '2026-10-01', costo: 4600, desglose: [], created_at: '1' }],
  ordenes: [{ id: 'o1', folio: 'OC 4471', fecha: '2026-11-09', cliente: 'CVA', estado: 'produccion' }, { id: 'o2', fecha: '2026-10-01', cliente: 'PCH', estado: 'entregada', factura_cliente: 'F9', factura_cliente_vence: '2026-11-01' }],
  lineas: [{ orden_id: 'o1', sku_modelo: 'AC-817584', equipos: 120, precio: 5263 }, { orden_id: 'o2', sku_modelo: 'AC-817584', equipos: 60, precio: 5263 }],
  ventas: [], precios: { 'AC-817584': 5263 }, inventario: { 'AC-935777': 1860 }, transito: {}, descripciones: {},
};

test('web con información sensible: pedidos, modelos, margen y componentes', () => {
  const html = pintar({ datos, hoy: '2026-11-11', sensible: true });
  for (const t of ['180 equipos vendidos en 2 pedidos', 'OC 4471', 'En producción', 'Vencido 10 d', 'Costo DECME', 'Utilidad del proyecto', '31 tarimas', 'sin precio', 'por capturar']) assert.ok(html.includes(t), t);
});

test('sin permiso sensible no aparece costo, margen ni utilidad', () => {
  const html = pintar({ datos, hoy: '2026-11-11', sensible: false });
  for (const t of ['Costo DECME', 'Margen', 'margen', 'Utilidad']) assert.ok(!html.includes(t), t);
});

test('celular: mismas cifras, listas en vez de tablas', () => {
  const html = pintar({ datos, hoy: '2026-11-11', sensible: false, movil: true });
  assert.ok(html.includes('180 equipos vendidos'));
  assert.ok(!html.includes('<table'));
  assert.ok(html.includes('configuración por capturar'));
});

test('vacío: invita a registrar el primer pedido', () => {
  const html = pintar({ datos: { ...datos, ordenes: [], lineas: [] }, hoy: '2026-11-11', sensible: true });
  assert.ok(html.includes('Todavía no hay pedidos'));
});
