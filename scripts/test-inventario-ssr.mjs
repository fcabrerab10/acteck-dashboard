// Smoke SSR de Inventario global: carga con el pipeline de Vite todos los módulos que se
// tocaron (pantalla, paneles nuevos, drill) y prueba la lógica pura del apartado y del
// inventario fuera de venta. También vigila la "regla de ancho": ninguna tabla de la
// pantalla puede pasar de 10 columnas visibles.
//   node --test scripts/test-inventario-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(() => vite.close());

test('los módulos de la pantalla cargan', async () => {
  for (const m of [
    '/src/modules/comercial/InventarioGlobal.jsx',
    '/src/modules/comercial/inventario/SkuDrillDown.jsx',
    '/src/modules/comercial/inventario/ApartadoPanel.jsx',
    '/src/modules/comercial/inventario/FueraDeVenta.jsx',
    '/src/modules/comercial/inventario/ProximosArribos.jsx',
    '/src/modules/comercial/inventario/ResumenSecundario.jsx',
    '/src/movil/FichaProducto.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
  const ap = await vite.ssrLoadModule('/src/modules/comercial/inventario/apartado.js');
  for (const f of ['motivoDeAlmacen', 'totalFuera', 'topSkusDeAlmacen', 'topApartado', 'useFueraDeVenta']) {
    assert.equal(typeof ap[f], 'function', `apartado.js debe exportar ${f}`);
  }
});

test('motivoDeAlmacen traduce igual que el CASE de v_inventario_fuera_venta', async () => {
  const { motivoDeAlmacen } = await vite.ssrLoadModule('/src/modules/comercial/inventario/apartado.js');
  const casos = [
    ['NO COMERCIAL DESTRUCCION AUDITADO GDL', 'Destrucción'],
    ['NO COMERCIAL PAQUETERIAS GUADALAJARA', 'Paqueterías'],
    ['REPARACIONES GDL', 'Reparaciones'],
    ['NO COMERCIAL CENTRO DE SERVICIO GDL', 'Centro de servicio'],
    ['PRODUCCION MATERIA PRIMA', 'Producción'],
    ['NO COMERCIAL DIFERENCIAS DE INVENTARIO', 'Diferencias de inventario'],
    ['REFACTURACION', 'Refacturación'],
    ['ROBO KENWORTH 24 NOV 2023', 'Robo'],
    ['ALMACEN DE REMISIONES', 'Remisiones'],
    ['ALMACEN MUESTRAS', 'Muestras'],
    ['DEVOLUCIONES QUE SE VUELVEN A CONSIGNAR MERCADOLIBRE', 'Devoluciones'],
    ['STOCK ROTATION TEMPORAL', 'Stock rotation'],
    ['ALGO RARO', 'Otro'],
    [null, 'Otro'],
  ];
  for (const [nombre, esperado] of casos) assert.equal(motivoDeAlmacen(nombre), esperado, `${nombre}`);
});

test('totalFuera y topSkusDeAlmacen suman lo que deben', async () => {
  const { totalFuera, topSkusDeAlmacen } = await vite.ssrLoadModule('/src/modules/comercial/inventario/apartado.js');
  assert.deepEqual(totalFuera([]), { piezas: 0, valor: 0, almacenes: 0 });
  assert.deepEqual(totalFuera([{ piezas: 10, valor: 100 }, { piezas: 5, valor: 50 }]), { piezas: 15, valor: 150, almacenes: 2 });

  const filas = [
    { articulo: 'A', no_almacen: 41, inventario: 10, costoinventario: 1000 },
    { articulo: 'A', no_almacen: 41, inventario: 5, costoinventario: 500 },
    { articulo: 'B', no_almacen: 41, inventario: 100, costoinventario: 200 },
    { articulo: 'C', no_almacen: 13, inventario: 7, costoinventario: 9999 }, // otro almacén
    { articulo: 'D', no_almacen: 41, inventario: 0, costoinventario: 0 },    // sin nada: fuera
  ];
  const desc = new Map([['A', { descripcion: 'Mouse', marca: 'ACTECK' }]]);
  const top = topSkusDeAlmacen(filas, 41, desc);
  assert.deepEqual(top.map((r) => r.sku), ['A', 'B'], 'ordena por valor y deja fuera otros almacenes');
  assert.equal(top[0].piezas, 15);
  assert.equal(top[0].valor, 1500);
  assert.equal(top[0].descripcion, 'Mouse');
  assert.equal(top[1].descripcion, '', 'SKU sin descripción no revienta');
  assert.equal(topSkusDeAlmacen(filas, 41, desc, 1).length, 1, 'respeta el límite');
});

test('topApartado ordena por valor y sólo trae lo comprometido', async () => {
  const { topApartado } = await vite.ssrLoadModule('/src/modules/comercial/inventario/apartado.js');
  const skuRows = [
    { sku: 'A', descripcion: 'a', marca: 'ACTECK', totalPz: 100, totalDisp: 20, totalRes: 80, valorRes: 800 },
    { sku: 'B', descripcion: 'b', marca: '', totalPz: 50, totalDisp: 50, totalRes: 0, valorRes: 0 },
    { sku: 'C', descripcion: 'c', marca: '', totalPz: 10, totalDisp: 0, totalRes: 10, valorRes: 5000 },
  ];
  const top = topApartado(skuRows);
  assert.deepEqual(top.map((r) => r.sku), ['C', 'A'], 'B no tiene apartado');
  assert.equal(top[1].pct, 80);
  assert.equal(top[0].valor, 5000);
  assert.equal(topApartado([]).length, 0);
  assert.equal(topApartado(null).length, 0);
});

test('regla de ancho: ninguna tabla de Inventario pasa de 10 columnas', () => {
  // Las columnas se declaran como literales `{ key: … }`; contarlos en el fuente es
  // suficiente para atrapar una regresión (una columna nueva por almacén, por ejemplo).
  const cuenta = (src, nombre) => (src.match(new RegExp(`(?<=${nombre}\\s*=\\s*\\[)[\\s\\S]*?(?=\\n\\s*\\];)`))?.[0].match(/\bkey: '/g) || []).length;
  const casos = [
    ['src/modules/comercial/InventarioGlobal.jsx', 'columnas', 9],
    ['src/modules/comercial/inventario/ProximosArribos.jsx', 'columnas', 9],
    ['src/modules/comercial/inventario/ProximosArribos.jsx', 'colsSku', 5],
    ['src/modules/comercial/inventario/ApartadoPanel.jsx', 'columnas', 6],
    ['src/modules/comercial/inventario/FueraDeVenta.jsx', 'columnas', 6],
    ['src/modules/comercial/inventario/FueraDeVenta.jsx', 'colsSku', 4],
    ['src/modules/comercial/inventario/SkuDrillDown.jsx', 'colsPo', 7],
    ['src/modules/comercial/inventario/SkuDrillDown.jsx', 'colsCompra', 6],
    ['src/modules/comercial/inventario/ResumenSecundario.jsx', 'colsTipo', 5],
  ];
  for (const [archivo, nombre, esperadas] of casos) {
    const n = cuenta(readFileSync(new URL(`../${archivo}`, import.meta.url), 'utf8'), nombre);
    assert.equal(n, esperadas, `${archivo} · ${nombre} declara ${n} columnas (esperadas ${esperadas})`);
    assert.ok(n <= 10, `${archivo} · ${nombre} se pasa de 10 columnas`);
  }
});

test('el drill por SKU nunca pinta más de 10 columnas', async () => {
  // 12 almacenes con piezas → 7 principales + OTROS + NO COM. + la columna de métrica.
  const src = readFileSync(new URL('../src/modules/comercial/inventario/SkuDrillDown.jsx', import.meta.url), 'utf8');
  assert.match(src, /comerciales\.slice\(0, 7\)/, 'el drill corta en 7 almacenes principales');
  assert.match(src, /comerciales\.slice\(7\)/, 'el resto se funde en "Otros"');
});
