// Análisis por cliente en el celular (3.79.0 · 2026-10-05): SSR de las 5 vistas puras con datos de ejemplo (sin red)
// + el cálculo puro de analisis/calculo.js (resumenLista, ritmoCompras, sellOutMesCuenta, serieAnioSiSo, frases) + rutas.
//   node --test scripts/test-analisis-movil-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

globalThis.window ??= globalThis;
globalThis.navigator ??= { userAgent: 'node', language: 'es-MX', onLine: true };
globalThis.localStorage ??= { getItem: () => null, setItem() {}, removeItem() {}, clear() {} };
globalThis.sessionStorage ??= globalThis.localStorage;
globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
globalThis.requestAnimationFrame ??= (f) => setTimeout(f, 0);
globalThis.addEventListener ??= () => {};
globalThis.removeEventListener ??= () => {};

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });

const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
const { NavContext } = await vite.ssrLoadModule('/src/movil/nav.jsx');
const { ListaVista } = await vite.ssrLoadModule('/src/movil/pestanas/AnalisisClientes.jsx');
const { ResumenVista } = await vite.ssrLoadModule('/src/movil/pestanas/AnalisisFicha.jsx');
const { SellInVista, SellOutVista } = await vite.ssrLoadModule('/src/movil/pestanas/analisis/Pestanas.jsx');
const { FrenteVista } = await vite.ssrLoadModule('/src/movil/pestanas/analisis/CuentaFrenteAlResto.jsx');
const calc = await vite.ssrLoadModule('/src/movil/pestanas/analisis/calculo.js');
const { movimientos } = await vite.ssrLoadModule('/src/modules/comercial/analisis/movimiento.js');
const { construirFilas } = await vite.ssrLoadModule('/src/modules/comercial/sellout/calculo.js');
const { bloquesDe } = await vite.ssrLoadModule('/src/modules/comercial/sellout/BloquesCuenta.jsx');
const { ranking, pesoEnCanal, oportunidades, paresDe, clientesNuevosPerdidos } = await vite.ssrLoadModule('/src/modules/comercial/sellout/oportunidades.js');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');
const GraficaScrubInicio = (await vite.ssrLoadModule('/src/movil/pestanas/inicio/GraficaScrub.jsx')).default;
const PayMix = (await vite.ssrLoadModule('/src/movil/pestanas/inicio/PayMix.jsx')).default;

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); };

const HOY = new Date(2026, 9, 9, 12); // 9 oct 2026
const ANIO = 2026, MES = 10;

// ── Lista · mv_analisis_cliente_mes (cliente × mes, 2 años) + cuotas ──
const fila = (cliente, nombre, canal, anio, mes, fact, key = null) => ({ cliente, cliente_nombre: nombre, cliente_key: key || 'mayoreo', canal, anio, mes, fact_neta: fact });
const ROWS = [];
const mensualDe = (cliente, nombre, canal, base, key, { desde2026 = 1, sinOct = false, caida = 1 } = {}) => {
  for (let m = 1; m <= 12; m += 1) ROWS.push(fila(cliente, nombre, canal, 2025, m, base * 0.9, key));
  for (let m = desde2026; m <= 10; m += 1) { if (sinOct && m === 10) continue; ROWS.push(fila(cliente, nombre, canal, 2026, m, (m === 10 ? base * 0.3 : base) * caida, key)); }
};
mensualDe('00417', 'COMERCIALIZADORA DE VALOR AGREGADO', 'MAYOREO', 4_000_000, null);
mensualDe('00183', 'CT INTERNACIONAL DEL NOROESTE', 'MAYOREO', 5_000_000, null, { caida: 0.5 });   // en riesgo
mensualDe('00764', 'API GLOBAL', 'DISTRIBUIDOR', 1_500_000, 'digitalife');
mensualDe('00999', 'NUEVO CLIENTE SA', 'DISTRIBUIDOR', 300_000, null, { desde2026: 6 });            // nuevo
ROWS.splice(ROWS.findIndex((r) => r.cliente === '00999' && r.anio === 2025), 12);                 // sin 2025
mensualDe('00555', 'TIENDA MOSTRADOR', 'MOSTRADOR', 200_000, null, { sinOct: true });              // compró sep, no oct
const CUOTAS = [];
for (let m = 1; m <= 12; m += 1) { CUOTAS.push({ cliente_erp: '00417', anio: 2026, mes: m, cuota_venta: 4_400_000 }); CUOTAS.push({ cliente_erp: '00183', anio: 2026, mes: m, cuota_venta: 4_000_000 }); CUOTAS.push({ cliente_erp: '00764', anio: 2026, mes: m, cuota_venta: 1_000_000 }); }

test('calculo · resumenLista: activos, riesgo, nuevos, cuota, frase y canales', () => {
  const r = calc.resumenLista({ rows: ROWS, cuotasRows: CUOTAS, anio: ANIO, mes: MES, modo: 'mes', hoy: HOY });
  assert.equal(r.kpis.activos, 4, 'cuatro con venta en octubre');
  assert.equal(r.kpis.conVentaAnio, 5);
  assert.equal(r.kpis.riesgo, 2, 'CT baja 50 % y el mostrador no compró en octubre (−100 %)');
  assert.equal(r.kpis.nuevos, 1, 'el cliente sin 2025');
  assert.equal(r.kpis.conCuota, 3);
  assert.ok(r.kpis.pctCuotaYtd > 0);
  assert.match(r.hero.frase, /^4 clientes compraron \$[\d.]+[MK] en octubre; \d de los 3 grandes van abajo de su cuota y 1 cliente de septiembre no ha comprado\.$/);
  assert.equal(r.hero.cuota, 9_400_000, 'cuota del mes de los tres con cuota');
  assert.deepEqual(r.canales.map((g) => g.id), ['MAYOREO', 'DISTRIBUIDOR', 'MOSTRADOR']);
  const cva = r.clientes.find((c) => c.cliente === '00417');
  assert.equal(cva.trazo6.length, 6);
  assert.ok(cva.pctCuota != null && cva.pctCuota < 100);
  // A mismo día: oct 2025 completo (3.6M) × 9/31 → yoy de 1.2M contra 1.045M ≈ +15 %
  assert.ok(cva.yoy > 10 && cva.yoy < 20, `yoy a mismo día: ${cva.yoy}`);
  const nuevo = r.clientes.find((c) => c.cliente === '00999');
  assert.ok(nuevo.nuevo && nuevo.yoy == null);
  const ytd = calc.resumenLista({ rows: ROWS, cuotasRows: CUOTAS, anio: ANIO, mes: MES, modo: 'ytd', hoy: HOY });
  assert.match(ytd.hero.frase, /en 2026, \d+ % (arriba|abajo) de 2025/);
  // Externo: sólo su cliente
  const ext = calc.resumenLista({ rows: ROWS, cuotasRows: CUOTAS, anio: ANIO, mes: MES, modo: 'mes', hoy: HOY, filtro: (c) => c.key === 'digitalife' });
  assert.equal(ext.clientes.length, 1);
  // filtrarLista por chip y texto
  assert.equal(calc.filtrarLista(r.canales, 'mayoreo', '').length, 1);
  assert.equal(calc.filtrarLista(r.canales, 'todos', 'nuevo')[0].clientes[0].cliente, '00999');
  assert.equal(calc.filtrarLista(r.canales, 'retail', '').length, 0);
});

test('vista · ListaVista renderiza hero, KPIs, chips y filas por canal', () => {
  const r = calc.resumenLista({ rows: ROWS, cuotasRows: CUOTAS, anio: ANIO, mes: MES, modo: 'mes', hoy: HOY, etiqueta: (c) => c.nombre });
  const s = render(ListaVista, { r, anio: ANIO, mes: MES, modo: 'mes', chip: 'todos', q: '', onChip() {}, onQ() {}, onAbrir() {}, periodoLbl: 'Oct 2026' });
  sano(s, 'ListaVista');
  assert.match(s, /Dirección comercial/); assert.match(s, /clientes compraron/);
  assert.match(s, /En riesgo/); assert.match(s, /Nuevos 2026/); assert.match(s, /Cuota de clientes/);
  assert.match(s, /Mayoreo/); assert.match(s, /Distribuidor/); assert.match(s, /Mostrador/);
  assert.match(s, /COMERCIALIZADORA DE VALOR AGREGADO/); assert.match(s, /% cuota/); assert.match(s, /NUEVO/);
  assert.match(s, /<svg width="56"/, 'mini trazo');
  const s2 = render(ListaVista, { r, anio: ANIO, mes: MES, modo: 'ytd', chip: 'mostrador', q: 'zzz', onChip() {}, onQ() {}, onAbrir() {}, periodoLbl: '2026' }, 'claro');
  sano(s2, 'ListaVista filtrada'); assert.match(s2, /Sin coincidencias/);
});

// ── Ficha · mensual del cliente, diario, sell out de la cuenta ──
const mensual = new Map();
for (let m = 1; m <= 12; m += 1) mensual.set(2025 * 12 + m - 1, { fact_neta: 3_800_000, contribucion: 600_000, piezas: 4000, fact_bruta: 3_900_000, devoluciones: -100_000, rmas: 0, bonificaciones: 0 });
for (let m = 1; m <= 10; m += 1) mensual.set(2026 * 12 + m - 1, { fact_neta: m === 10 ? 480_000 : 4_100_000, contribucion: m === 10 ? 70_000 : 650_000, piezas: m === 10 ? 500 : 4200, fact_bruta: 4_200_000, devoluciones: -100_000, rmas: 0, bonificaciones: 0 });
const DIARIO = [
  { anio: 2026, mes: 9, dia: 2, fact_neta: 400_000, piezas: 400, facturas: 3 }, { anio: 2026, mes: 9, dia: 11, fact_neta: 1_500_000, piezas: 1500, facturas: 4 },
  { anio: 2026, mes: 9, dia: 20, fact_neta: 2_200_000, piezas: 2300, facturas: 4 }, { anio: 2026, mes: 9, dia: 29, fact_neta: 0, piezas: 0, facturas: 0 },
  { anio: 2026, mes: 10, dia: 6, fact_neta: 480_000, piezas: 500, facturas: 2 }, { anio: 2025, mes: 10, dia: 7, fact_neta: 410_000, piezas: 420, facturas: 2 },
];
const SO_MENSUAL = [];
for (let m = 1; m <= 12; m += 1) SO_MENSUAL.push({ cuenta: 'cva', nombre: 'COMERCIALIZADORA DE VALOR AGREGADO', canal_sellout: 'mayoreo', propio: false, granularidad: 'dia', anio: 2025, mes: m, importe: 3_600_000, cantidad: 3900, sell_in: 3_800_000, sucursales: 20, clientes_finales: 700, estados: 10, inv_piezas: null, inv_valor: null });
for (let m = 1; m <= 10; m += 1) SO_MENSUAL.push({ cuenta: 'cva', nombre: 'COMERCIALIZADORA DE VALOR AGREGADO', canal_sellout: 'mayoreo', propio: false, granularidad: 'dia', anio: 2026, mes: m, importe: m === 10 ? 620_000 : 4_300_000, cantidad: m === 10 ? 640 : 4400, sell_in: m === 10 ? 480_000 : 4_100_000, sucursales: 21, clientes_finales: 812, estados: 12, inv_piezas: 9840, inv_valor: 2_100_000 });

test('calculo · ritmoCompras, sellOutMesCuenta, serieAnioSiSo y frases', () => {
  const r = calc.ritmoCompras(DIARIO, HOY);
  assert.equal(r.diasDesde, 3, 'última compra el 6 de octubre');
  assert.equal(r.cadaDias, 11, 'promedio de días entre compras en 180 d');
  assert.deepEqual(r.mesFacturas, { anio: 2026, mes: 10 }); assert.equal(r.facturasMes, 2);
  assert.equal(calc.ritmoCompras([], HOY).diasDesde, null);
  const so = calc.sellOutMesCuenta(SO_MENSUAL, 'cva', 2026, 10, HOY);
  assert.equal(so.importe, 620_000); assert.ok(so.reporta);
  assert.equal(Math.round(so.soSi), 129);
  assert.equal(so.invPiezas, 9840); assert.ok(so.semanas > 9 && so.semanas < 10.5, `9,840 pz a 4,400 pz/mes de jul–sep ≈ 9.7 semanas: ${so.semanas}`);
  assert.equal(Math.round(so.importePrev), Math.round(3_600_000 * 9 / 31), 'oct 2025 prorrateado a 9 días');
  assert.ok(so.yoy != null && so.yoy < 0);
  assert.equal(calc.sellOutMesCuenta(SO_MENSUAL, null, 2026, 10, HOY), null);
  const mapa = new Map([['00417|2026|10', 4_400_000], ['00417|2026|7', 4_500_000]]);
  const serie = calc.serieAnioSiSo({ mensual, soMensual: SO_MENSUAL, cuenta: 'cva', mapa, codigo: '00417', anio: 2026, hoy: HOY });
  assert.equal(serie.length, 12);
  assert.equal(serie[9].si, 480_000); assert.equal(serie[9].so, 620_000); assert.equal(serie[9].cuota, 4_400_000); assert.ok(serie[9].enCurso);
  assert.equal(serie[10].si, null, 'noviembre no existe aún'); assert.equal(serie[11].so, null);
  assert.equal(Math.round(serie[6].soSi * 100), 105);
  const f = calc.fraseCliente({ nombre: 'CVA', anio: 2026, mes: 10, mtd: 480_000, pctCuota: 10.9, yoy: 18, soSi: 129, semanas: 6.2, enCurso: true });
  assert.equal(f, 'CVA va al 11 % de su cuota de oct, 18 % arriba de oct 2025 a mismo día; su sell out desplaza 1.3 veces lo que compra y le quedan 6 semanas de inventario.');
  assert.equal(calc.fraseCliente({ nombre: 'X', anio: 2026, mes: 3, mtd: 0, pctCuota: null, yoy: null, soSi: null, semanas: null }), 'X no ha comprado en mar.');
  assert.equal(calc.fraseFrente({ nombre: 'CVA', pos: 2, de: 17, pct: 23, canalLbl: 'mayoreo', soSi: 129, soSiCanal: 94, nOport: 14 }), 'CVA es la 2ª cuenta de 17 del equipo: 23 % del sell out de mayoreo, SO/SI 1.29 contra 0.94 del promedio, y le faltan 14 SKUs que sus pares sí mueven.');
  assert.equal(calc.fraseFrente({ nombre: 'X', pos: null, de: 17, pct: null, canalLbl: 'mayoreo', nOport: 0 }), 'X no reporta sell out este mes.');
});

const DETALLE = [
  { anio: 2026, mes: 10, articulo: 'AC-943154', marca: 'ACTECK', categoria: 'Monitores', fact_neta: 186_000, piezas_venta_neta: 150, contribucion: 30_000 },
  { anio: 2026, mes: 9, articulo: 'AC-944526', marca: 'ACTECK', categoria: 'Monitores', fact_neta: 58_000, piezas_venta_neta: 40, contribucion: 9_000 },
  { anio: 2026, mes: 9, articulo: 'BR-937658', marca: 'BALAM RUSH', categoria: 'Fuentes', fact_neta: 35_000, piezas_venta_neta: 50, contribucion: 5_000 },
  { anio: 2026, mes: 10, articulo: 'BR-937658', marca: 'BALAM RUSH', categoria: 'Fuentes', fact_neta: 71_000, piezas_venta_neta: 100, contribucion: 11_000 },
  { anio: 2025, mes: 10, articulo: 'BR-937658', marca: 'BALAM RUSH', categoria: 'Fuentes', fact_neta: 30_000, piezas_venta_neta: 42, contribucion: 4_000 },
];
const RD = new Map([['AC-943154', { descripcion: 'Monitor Vivid 27', categoria: 'Monitores' }], ['AC-944526', { descripcion: 'Monitor Brite 18.5', categoria: 'Monitores' }]]);

test('vista · ResumenVista renderiza hero, 4 KPIs, gráfica, movimiento, categorías y cuotas por Q', () => {
  const so = calc.sellOutMesCuenta(SO_MENSUAL, 'cva', 2026, 10, HOY);
  const serie = calc.serieAnioSiSo({ mensual, soMensual: SO_MENSUAL, cuenta: 'cva', mapa: null, codigo: '00417', anio: 2026, hoy: HOY });
  const movs = movimientos({ grupos: [{ tipo: 'SKU', filas: DETALLE, clave: 'articulo', valor: 'fact_neta', piezas: 'piezas_venta_neta', etiqueta: (k) => RD.get(k)?.descripcion || '' }], anio: 2026, mes: 10 });
  const s = render(ResumenVista, { nombre: 'CVA', anio: 2026, mes: 10, enCurso: true, mtd: 480_000, yoyMes: 18, cuotaMes: 4_400_000, so, ritmo: calc.ritmoCompras(DIARIO, HOY), serie, movs,
    catSi: [{ label: 'Monitores', v: 14_200_000 }, { label: 'Fuentes', v: 6_100_000 }], catSo: [{ label: 'Monitores', v: 10_000_000 }], mensual, cuotasRows: CUOTAS, codigo: '00417', onCompartir() {} });
  sano(s, 'ResumenVista');
  assert.match(s, /CVA va al 11 % de su cuota/); assert.match(s, /a mismo día/);
  assert.match(s, /Sell in · oct/); assert.match(s, /Sell out · oct/); assert.match(s, /SO\/SI 1\.29/); assert.match(s, /Inventario en CVA/); assert.match(s, /hace 3 d/); assert.match(s, /cada 11 días/);
  assert.match(s, /Sell in vs sell out · 2026/); assert.match(s, /Dónde está el movimiento/);
  assert.match(s, /Monitor Vivid 27 \(AC-943154\)/); assert.match(s, /150 pz · por primera vez/); assert.match(s, /en sep \$58K · en oct nada/);
  assert.match(s, /Categorías/); assert.match(s, /Monitores/); assert.match(s, /Cuotas por trimestre/); assert.match(s, /Q4 · en curso/);
  assert.match(s, /Compartir ficha/);
  assert.ok(!/Top 10/.test(s), 'los top 10 SKUs ya no están');
  // Cliente sin sell out
  const s2 = render(ResumenVista, { nombre: 'Otro', anio: 2026, mes: 10, enCurso: true, mtd: 0, yoyMes: null, cuotaMes: null, so: null, ritmo: calc.ritmoCompras([], HOY), serie: calc.serieAnioSiSo({ mensual: new Map(), cuenta: null, mapa: null, codigo: 'X', anio: 2026, hoy: HOY }), movs: movimientos({ grupos: [], anio: 2026, mes: 10 }), catSi: [], catSo: [], mensual: new Map(), cuotasRows: [], codigo: 'X' }, 'claro');
  sano(s2, 'ResumenVista vacío'); assert.match(s2, /no reporta sell out/); assert.match(s2, /no reporta inventario/); assert.match(s2, /Sin movimientos relevantes/);
});

test('vista · SellInVista: Piezas · \$, KPIs, zoom, cuotas por Q, evolución y productos × 12 m (sensible y no)', () => {
  const s = render(SellInVista, { codigo: '00417', mensual, detalle: DETALLE, diario: DIARIO, cuotasRows: CUOTAS, anio: 2026, mes: 10, sensible: true, rd: RD, onSku() {}, hoy: HOY });
  sano(s, 'SellInVista');
  assert.match(s, /Todo el bloque en/); assert.match(s, /Piezas/); assert.match(s, /Oct a mismo día/); assert.match(s, /YTD 2026/); assert.match(s, /MC % · YTD/);
  assert.match(s, /Sell in por día/); assert.match(s, /Cuotas por trimestre/); assert.match(s, /Evolución · 12 meses/); assert.match(s, /Productos · 12 meses/);
  assert.match(s, /AC-943154/); assert.match(s, /Monitor Vivid 27/);
  const s2 = render(SellInVista, { codigo: '00417', mensual, detalle: [], diario: [], cuotasRows: [], anio: 2026, mes: 10, sensible: false, rd: RD, hoy: HOY }, 'claro');
  sano(s2, 'SellInVista no sensible'); assert.ok(!/MC %/.test(s2), 'sin permiso sensible no hay margen'); assert.match(s2, /Sin movimiento en los últimos 12 meses/);
});

// ── Sell Out · CVA (receta rica) y Arroba (sólo sucursal) ──
const CUENTAS_SO = [
  { cuenta: 'cva', nombre: 'COMERCIALIZADORA DE VALOR AGREGADO', canal_sellout: 'mayoreo', erp_cliente: '00417', propio: false, granularidad: 'dia', tiene_sellout: true },
  { cuenta: 'ct', nombre: 'CT INTERNACIONAL DEL NOROESTE', canal_sellout: 'mayoreo', erp_cliente: '00183', propio: false, granularidad: 'dia', tiene_sellout: true },
  { cuenta: 'arroba', nombre: 'ARROBA COMPUTERS DISTRIBUCION', canal_sellout: 'mayoreo', erp_cliente: '01145', propio: false, granularidad: 'dia', tiene_sellout: true },
];
const DIAS = [
  { cuenta: 'cva', anio: 2026, mes: 10, dia: 2, importe: 200_000, cantidad: 200 }, { cuenta: 'cva', anio: 2026, mes: 10, dia: 7, importe: 420_000, cantidad: 440 },
  { cuenta: 'cva', anio: 2025, mes: 10, dia: 3, importe: 300_000, cantidad: 300 }, { cuenta: 'cva', anio: 2025, mes: 10, dia: 20, importe: 900_000, cantidad: 900 },
  { cuenta: 'ct', anio: 2026, mes: 10, dia: 5, importe: 900_000, cantidad: 900 }, { cuenta: 'ct', anio: 2026, mes: 9, dia: 5, importe: 3_000_000, cantidad: 3000 },
  { cuenta: 'arroba', anio: 2026, mes: 10, dia: 4, importe: 118_000, cantidad: 120 }, { cuenta: 'arroba', anio: 2025, mes: 10, dia: 4, importe: 130_000, cantidad: 130 },
  { cuenta: 'cva', anio: 2026, mes: 9, dia: 15, importe: 4_300_000, cantidad: 4400 },
];
const MENSUAL_SO = [...SO_MENSUAL,
  { cuenta: 'ct', nombre: 'CT INTERNACIONAL DEL NOROESTE', canal_sellout: 'mayoreo', propio: false, granularidad: 'dia', anio: 2026, mes: 10, importe: 900_000, cantidad: 900, sell_in: 1_000_000, sucursales: 56, vendedores: 120 },
  { cuenta: 'ct', nombre: 'CT INTERNACIONAL DEL NOROESTE', canal_sellout: 'mayoreo', propio: false, granularidad: 'dia', anio: 2026, mes: 9, importe: 3_000_000, cantidad: 3000, sell_in: 3_200_000, sucursales: 56, vendedores: 120 },
  { cuenta: 'arroba', nombre: 'ARROBA COMPUTERS DISTRIBUCION', canal_sellout: 'mayoreo', propio: false, granularidad: 'dia', anio: 2026, mes: 10, importe: 118_000, cantidad: 120, sell_in: 140_000, sucursales: 6 },
  { cuenta: 'arroba', nombre: 'ARROBA COMPUTERS DISTRIBUCION', canal_sellout: 'mayoreo', propio: false, granularidad: 'dia', anio: 2025, mes: 10, importe: 130_000, cantidad: 130, sell_in: 120_000, sucursales: 6 },
];
const filasSo = construirFilas({ cuentas: CUENTAS_SO, mensual: MENSUAL_SO, dias: DIAS, anio: 2026, mes: 10, corteDia: 9 });
const SKUS_SO = [
  { anio: 2026, mes: 10, sku: 'AC-943154', marca: 'ACTECK', categoria: 'Monitores', importe: 186_000, cantidad: 150 },
  { anio: 2026, mes: 9, sku: 'AC-944526', marca: 'ACTECK', categoria: 'Monitores', importe: 48_000, cantidad: 40 },
  { anio: 2026, mes: 9, sku: 'BR-937658', marca: 'BALAM RUSH', categoria: 'Fuentes', importe: 35_000, cantidad: 50 },
  { anio: 2026, mes: 10, sku: 'BR-937658', marca: 'BALAM RUSH', categoria: 'Fuentes', importe: 71_000, cantidad: 100 },
];
const SUC = [
  { anio: 2026, mes: 10, sucursal: 'GUADALAJARA', importe: 186_000, cantidad: 190, vendedores: 4, clientes: 40, top_vendedor: 'JUAN' }, { anio: 2025, mes: 10, sucursal: 'GUADALAJARA', importe: 166_000, cantidad: 170, vendedores: 4 },
  { anio: 2026, mes: 9, sucursal: 'GUADALAJARA', importe: 1_400_000, cantidad: 1400 }, { anio: 2026, mes: 10, sucursal: 'PUEBLA', importe: 52_000, cantidad: 50 }, { anio: 2026, mes: 9, sucursal: 'PUEBLA', importe: 74_000, cantidad: 70 },
];
const CF = [
  { anio: 2026, mes: 10, cliente_final: 'SOLUCIONES TEC SA', importe: 41_000, cantidad: 40, facturas: 3, estado: 'JALISCO' }, { anio: 2026, mes: 10, cliente_final: 'PC MART', importe: 29_000, cantidad: 30, facturas: 2 },
  { anio: 2026, mes: 9, cliente_final: 'PC MART', importe: 20_000, cantidad: 20, facturas: 2 }, { anio: 2026, mes: 9, cliente_final: 'PERDIDO SA', importe: 12_000, cantidad: 10, facturas: 1 },
];
const EDO = [
  { cuenta: 'cva', anio: 2026, mes: 10, estado: 'JALISCO', importe: 235_000, cantidad: 240 }, { cuenta: 'cva', anio: 2025, mes: 10, estado: 'JALISCO', importe: 200_000, cantidad: 200 },
  { cuenta: 'cva', anio: 2026, mes: 10, estado: 'CIUDAD DE MEXICO', importe: 136_000, cantidad: 140 }, { cuenta: 'cva', anio: 2026, mes: 10, estado: 'SIN ESTADO', importe: 10_000, cantidad: 10 },
];

test('vista · SellOutVista: CVA (receta rica) pinta todos los bloques; Arroba sólo sucursales y su nota', () => {
  const filaCva = { ...filasSo.find((f) => f.cuenta === 'cva'), sucursales: 21, clientesFinales: 812, estados: 12, vendedores: null };
  const { bloques, nota } = bloquesDe('cva', filaCva);
  assert.deepEqual(bloques, ['resumen', 'cambios', 'mapa', 'sucursales', 'clientes', 'skus']);
  assert.equal(nota, null);
  const s = render(SellOutVista, { cuenta: 'cva', nombre: 'CVA', fila: filaCva, bloques, nota, anio: 2026, mes: 10, dias: DIAS.filter((d) => d.cuenta === 'cva'), mensualCuenta: MENSUAL_SO.filter((r) => r.cuenta === 'cva'), skus: SKUS_SO, suc: SUC, cf: CF, edo: EDO, rd: RD, onSku() {}, onDimension() {}, onCompleto() {}, hoy: HOY });
  sano(s, 'SellOutVista CVA');
  assert.match(s, /Sell out · oct/); assert.match(s, /\$620K/); assert.match(s, /SO\/SI 1\.29/); assert.match(s, /Inventario en CVA/); assert.match(s, /9,840 pz/);
  assert.match(s, /Sell out por día/); assert.match(s, /Evolución · 12 meses/);
  assert.match(s, /Dónde está el movimiento/); assert.match(s, /SKU · sucursal · cliente final/); assert.match(s, /Sucursal<\/span>/); assert.match(s, /GUADALAJARA/);
  assert.match(s, /Dónde vende/); assert.match(s, /Jalisco/); assert.match(s, /Ciudad de México/); assert.ok(!/Sin estado/.test(s));
  assert.match(s, /Sucursales/); assert.match(s, /PUEBLA/); assert.match(s, /4 vendedores · JUAN/);
  assert.match(s, /Clientes finales/); assert.match(s, /SOLUCIONES TEC SA/); assert.match(s, />nuevo</); assert.match(s, /1 perdidos/);
  assert.match(s, /Detalle por SKU · 12 m/); assert.match(s, /AC-943154/);
  assert.match(s, /Abrir sell out completo/);
  assert.ok(!/Vendedores</.test(s), 'CVA no manda vendedor: ese bloque no se pinta');

  const filaArroba = { ...filasSo.find((f) => f.cuenta === 'arroba'), sucursales: 6, vendedores: null, clientesFinales: null, estados: 0 };
  const recA = bloquesDe('arroba', filaArroba);
  assert.deepEqual(recA.bloques, ['resumen', 'cambios', 'sucursales', 'skus']);
  const s2 = render(SellOutVista, { cuenta: 'arroba', nombre: 'Arroba Computers', fila: filaArroba, bloques: recA.bloques, nota: recA.nota, anio: 2026, mes: 10, dias: DIAS.filter((d) => d.cuenta === 'arroba'), mensualCuenta: MENSUAL_SO.filter((r) => r.cuenta === 'arroba'), skus: [], suc: [], rd: RD, hoy: HOY }, 'claro');
  sano(s2, 'SellOutVista Arroba');
  assert.match(s2, /Arroba sólo reporta sucursal/); assert.match(s2, /no reporta inventario/); assert.match(s2, /Esta cuenta no reporta sucursales/);
  assert.ok(!/Dónde vende/.test(s2)); assert.ok(!/Clientes finales/.test(s2)); assert.ok(!/Vendedores</.test(s2));
});

test('vista · FrenteVista: ranking, peso, SO/SI, oportunidades, inventario y clientes finales', () => {
  const rank = ranking(filasSo, 'cva'), peso = pesoEnCanal(filasSo, 'cva');
  assert.deepEqual(rank, { pos: 2, de: 3 });
  const pares = paresDe(CUENTAS_SO, 'cva');
  const skuPares = [
    { cuenta: 'ct', anio: 2026, mes: 9, sku: 'BR-942539', marca: 'BALAM RUSH', categoria: 'Monitores', importe: 900_000, cantidad: 300 }, { cuenta: 'arroba', anio: 2026, mes: 8, sku: 'BR-942539', marca: 'BALAM RUSH', categoria: 'Monitores', importe: 36_000, cantidad: 12 },
    { cuenta: 'cva', anio: 2026, mes: 9, sku: 'AC-943154', importe: 1, cantidad: 1 },
  ];
  const oport = oportunidades({ skuMes: skuPares, cuenta: 'cva', pares, meses: [{ anio: 2026, mes: 7 }, { anio: 2026, mes: 8 }, { anio: 2026, mes: 9 }] });
  assert.equal(oport.total, 1);
  const cf = clientesNuevosPerdidos(CF, 2026, 10, 6);
  const inv = [{ sku: 'AC-943154', descripcion: 'Monitor Vivid 27', stock: 620, semanas: 3.2, mesActual: 150 }, { sku: 'AC-944526', descripcion: 'Monitor Brite', stock: 0, semanas: null, mesActual: 40 }, { sku: 'BR-937658', stock: 1240, semanas: 9, mesActual: 100 }];
  const s = render(FrenteVista, { nombre: 'CVA', anio: 2026, mes: 10, rank, rankPrev: { pos: 2, de: 3 }, peso, oport: { ...oport, lista: oport.lista.map((o) => ({ ...o, descripcion: 'Monitor Earth 27' })) }, inv, reportaInv: true, cf, pares, paresNombre: ['CT', 'Arroba'], propio: true, onPropuesta() {}, onSku() {} });
  sano(s, 'FrenteVista');
  assert.match(s, /CVA es la 2ª cuenta de 3 del equipo/); assert.match(s, /2 de 3/); assert.match(s, /igual que en sep/);
  assert.match(s, /Peso en mayoreo/); assert.match(s, /SO\/SI vs promedio/); assert.match(s, /1\.29/);
  assert.match(s, /Oportunidades/); assert.match(s, /Monitor Earth 27 \(BR-942539\)/); assert.match(s, /en 2 de 2 pares/); assert.match(s, /104 pz\/mes/);
  assert.match(s, /Armar propuesta con estos SKUs/);
  assert.match(s, /Inventario en CVA/); assert.match(s, /620 pz/); assert.match(s, /agotado/); assert.match(s, /9 sem/);
  assert.match(s, /Clientes finales/); assert.match(s, /Nuevos/); assert.match(s, /Perdidos/); assert.match(s, /PERDIDO SA/);
  // No propio: sin botón de propuesta; sin inventario ni clientes: esos bloques no se pintan.
  const s2 = render(FrenteVista, { nombre: 'CT', anio: 2026, mes: 10, rank: ranking(filasSo, 'ct'), rankPrev: null, peso: pesoEnCanal(filasSo, 'ct'), oport: { lista: [], total: 0, importeMes: 0 }, inv: [], reportaInv: false, cf: null, pares: [], paresNombre: [], propio: false, onPropuesta() {} }, 'claro');
  sano(s2, 'FrenteVista CT');
  assert.ok(!/Armar propuesta/.test(s2)); assert.ok(!/Inventario en CT/.test(s2)); assert.ok(!/Clientes finales/.test(s2)); assert.match(s2, /Sin oportunidades/);
});

test('piezas · GraficaScrub de Inicio y PayMix siguen pintando igual sobre las piezas genéricas', () => {
  const meses = Array.from({ length: 12 }, (_, i) => ({ label: ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][i], fn: i < 10 ? 50 + i : null, prev: 45 + i, cuota: 55, pct: 90, yoy: 5, enCurso: i === 9 }));
  const s = render(GraficaScrubInicio, { meses, anio: 2026, formato: (n) => `$${n}`, mesActivo: 9, onMes() {} });
  sano(s, 'GraficaScrub Inicio'); assert.match(s, /stroke-dasharray="4 4"/); assert.match(s, /<circle/); assert.match(s, />E</);
  const s2 = render(PayMix, { mixes: { canal: [{ key: 'MAYOREO', cur: 100 }, { key: 'DISTRIBUIDOR', cur: 50 }, { key: 'a', cur: 1 }, { key: 'b', cur: 1 }, { key: 'c', cur: 1 }, { key: 'd', cur: 1 }] }, formato: (n) => `$${n}`, titulo: 'Mix' });
  sano(s2, 'PayMix'); assert.match(s2, /Mayoreo/); assert.match(s2, /Otros/); assert.match(s2, /Canal/); assert.match(s2, /Categoría/);
});

test('rutas · analisisClientes es push y propuestas acepta extra.skus', () => {
  assert.equal(destino({ pagina: 'analisisClientes' }).key, 'analisis');
  const p = destino({ pagina: 'propuestas', extra: { skus: ['BR-942539'], clienteKey: 'digitalife' } });
  assert.equal(p.tipo, 'push'); assert.deepEqual(p.el.props.inicial, { skus: ['BR-942539'], clienteKey: 'digitalife' });
  assert.equal(destino({ pagina: 'propuestas' }).el.props.inicial, null);
});
