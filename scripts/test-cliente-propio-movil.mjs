// Cliente propio en el celular (3.84.0 · 2026-10-06): cálculo puro (qué le falta, cobranza, pagos, acuerdos, marketing,
// frase, categorías como líneas, sin movimiento, tabla con inventario) + SSR de Resumen y Sell Out con datos de ejemplo.
// Regla: sin margen ni costo en el HTML; gráficas de línea.
//   node --test scripts/test-cliente-propio-movil.mjs
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
const calc = await vite.ssrLoadModule('/src/movil/pestanas/cliente/calculo.js');
const { ResumenPropioVista } = await vite.ssrLoadModule('/src/movil/pestanas/cliente/ClientePropioM.jsx');
const { SellOutPropioVista, textoSellOut } = await vite.ssrLoadModule('/src/movil/pestanas/cliente/SellOutPropio.jsx');
const { destino } = await vite.ssrLoadModule('/src/movil/rutas.js');
const pc = await vite.ssrLoadModule('/src/movil/pestanas/cliente/pagosCalc.js');
const { PagosPropioVista } = await vite.ssrLoadModule('/src/movil/pestanas/cliente/PagosPropio.jsx');
const { REGLAS_DEFAULT } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/reglas.js');
const { CobranzaGlobalVista, textoCobranza } = await vite.ssrLoadModule('/src/movil/pestanas/cobranza/CobranzaGlobalM.jsx');
const cob = await vite.ssrLoadModule('/src/modules/comercial/cobranza/calculo.js');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {}, agregarSku() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => { assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`); assert.ok(!/margen|contribuci|utilidad|costo promedio/i.test(s), `${donde}: habla de margen/costo y lo ven los clientes`); };

const HOY = new Date(2026, 9, 6, 12);
const skus = [
  ...[7, 8, 9].flatMap((m) => [{ anio: 2026, mes: m, sku: 'AC-943154', categoria: 'Monitores', importe: 360000, cantidad: 150 }, { anio: 2026, mes: m, sku: 'BR-937658', categoria: 'Fuentes', importe: 52000, cantidad: 90 }, { anio: 2026, mes: m, sku: 'AC-935845', categoria: 'Monitores', importe: 88000, cantidad: 40 }]),
  { anio: 2026, mes: 8, sku: 'AC-944526', categoria: 'Monitores', importe: 60000, cantidad: 30 },
  { anio: 2025, mes: 9, sku: 'AC-943154', categoria: 'Monitores', importe: 300000, cantidad: 120 },
];
const inv = [{ sku: 'AC-943154', stock: 0, valor: 0 }, { sku: 'BR-937658', stock: 20, valor: 9000 }, { sku: 'AC-935845', stock: 830, valor: 1100000 }, { sku: 'BR-945820', stock: 410, valor: 410000, titulo: 'Teclado Balrak' }];
const rd = new Map([['AC-943154', { descripcion: 'Monitor Vivid 27', categoria: 'Monitores' }], ['BR-937658', { descripcion: 'Fuente GR Burst 650', categoria: 'Fuentes' }]]);

test('queLeFalta: agotados y con menos de una semana, piezas topadas a lo que tenemos', () => {
  const f = calc.queLeFalta({ skus, inv, nuestro: new Map([['AC-943154', 120], ['BR-937658', 1240]]), anio: 2026, mes: 10, roadmap: rd });
  assert.deepEqual(f.lista.map((x) => x.sku), ['AC-943154', 'BR-937658', 'AC-944526']); // AC-935845 tiene 830 pz (muchas semanas); AC-944526 vendió en ago y no tiene stock
  assert.equal(f.agotados, 2); assert.equal(f.lista[0].ritmo, 150); assert.equal(f.lista[0].piezas, 120); // 300 − 0 = 300, topado a 120
  assert.equal(f.lista[1].semanas, 1); assert.equal(f.lista[1].piezas, 160); // 180 − 20 = 160
  assert.equal(calc.lineaFalta(f.lista[0], 'Digitalife'), 'agotado en Digitalife · vende 150 pz/mes · tenemos 120');
  assert.equal(f.riesgoMes, 250);
});

test('cobranza, pagos, acuerdos, marketing', () => {
  const c = calc.resumenCobranza([{ saldo_actual: 3800000, saldo_vencido: 0, saldo_a_vencer: 3800000, dso: 38.4, fecha_corte: '2026-10-03' }], [{ vencimiento: '2026-10-15', saldo_actual: 640000 }, { vencimiento: '2026-10-15', saldo_actual: 460000 }, { vencimiento: '2026-10-02', saldo_actual: 10 }], HOY);
  assert.equal(c.vencido, 0); assert.equal(c.dso, 38); assert.deepEqual(c.proximo, { fecha: '2026-10-15', monto: 1100000 });
  const p = calc.pagosDelMes([{ id: 1, concepto: 'Rebate Q3', monto: 412000, estado: 'calculado', fecha_programada: '2026-10-20' }, { id: 2, concepto: 'Apoyo BPRM-102', monto: 86000, estado: 'solicitado', fecha_programada: '2026-10-12' }, { id: 3, concepto: 'Viejo', monto: 5, estado: 'pagado', fecha_programada: '2026-09-01' }, { id: 4, concepto: 'Nada', monto: 0, estado: 'calculado' }], 2026, 10);
  assert.equal(p.abiertos, 2); assert.equal(p.montoAbierto, 498000); assert.equal(p.filas[0].titulo, 'Apoyo BPRM-102'); assert.equal(p.filas[0].sub, 'solicitado · vence 12 oct'); assert.equal(p.delMes, 2);
  const a = calc.acuerdosAbiertos([{ id: 'a', titulo: 'Cotizar bocinas', estado: 'abierta', cuando: '2026-10-02' }, { id: 'b', titulo: 'Exhibición', estado: 'abierta', cuando: '2026-10-15' }, { id: 'c', titulo: 'Hecho', estado: 'hecha' }], HOY);
  assert.equal(a.total, 2); assert.equal(a.vencidos, 1); assert.equal(a.filas[0].sub, 'venció 2 oct');
  const m = calc.marketingResumen([{ nombre: 'Exhibición Buen Fin', fecha: '2026-10-20', inversion: 60000, estado: 'activa' }, { nombre: 'Mailing', fecha: '2026-10-01', inversion: 8000, completada: true }, { nombre: 'Archivada', fecha: '2026-11-01', inversion: 1, estado: 'archivada' }], HOY);
  assert.equal(m.total, 2); assert.equal(m.inversion, 68000); assert.equal(m.proxima.nombre, 'Exhibición Buen Fin');
});

test('frase del Resumen sin margen · categorías como líneas · sin movimiento · tabla con inventario', () => {
  const f = calc.fraseResumen({ nombre: 'Digitalife', mes: 10, pctCuota: 31, soSi: 1.4, invValor: 2100000, semanas: 6, vencido: 0, agotados: 1 });
  assert.equal(f, 'Va al 31 % de la cuota ideal de octubre; desplazó 1.4 veces lo que le vendimos el mes pasado; tiene $2.1M en piso (6 sem). Cartera al corriente. 1 SKU que vende está agotado.');
  const cs = calc.categoriasSerie({ filas: skus, anio: 2026, mes: 9, roadmap: rd });
  assert.deepEqual(cs.cats, ['Monitores', 'Fuentes']); assert.equal(cs.datos.length, 12); assert.equal(cs.datos[11].c0, 448000); assert.equal(cs.datos[11].label, 'Sep');
  const sm = calc.sinMovimiento({ skus, inv, anio: 2026, mes: 10, roadmap: rd });
  assert.deepEqual(sm.lista.map((x) => x.sku), ['BR-945820']); assert.equal(sm.valor, 410000);
  const t = calc.filasSkuInv({ skus, inv, anio: 2026, mes: 9, unidad: 'monto', roadmap: rd });
  assert.equal(t[0].sku, 'AC-943154'); assert.deepEqual(t[0].valores, [360000, 360000, 1080000, 0, 0]); assert.equal(t[0].agotado, true); // la ventana de 12 m va de oct 25 a sep 26: sep 25 queda fuera
  const b = t.find((x) => x.sku === 'BR-937658'); assert.equal(b.valores[4], 20); assert.equal(b.semanas, 1.4); // ritmo de jun-ago (180 pz) = 60/mes
  assert.deepEqual(calc.colsSkuInv(2026, 9), ['Ago', 'Sep', 'Total 12 m', 'Inv $', 'Inv pz']);
});

test('SSR · Resumen del cliente propio', () => {
  const serie = Array.from({ length: 12 }, (_, i) => ({ label: calc.MESES[i], mes: i + 1, si: i < 10 ? 3000000 : null, so: i < 9 ? 4000000 : null, cuota: 3300000, soSi: i < 9 ? 1.3 : null, enCurso: i === 9 }));
  const falta = calc.queLeFalta({ skus, inv, nuestro: new Map([['AC-943154', 120]]), anio: 2026, mes: 10, roadmap: rd });
  const html = render(ResumenPropioVista, { nombre: 'Digitalife', anio: 2026, mes: 10, enCurso: true, mtd: 1020000, cuotaMes: 3300000, yoyMes: 8, so: { reporta: true, importe: 4900000, yoy: 12, soSi: 140, invValor: 2100000, semanas: 6, mesUsado: 9 }, serie, falta,
    cobranza: calc.resumenCobranza([{ saldo_actual: 3800000, saldo_vencido: 0, saldo_a_vencer: 3800000, dso: 38 }], [{ vencimiento: '2026-10-15', saldo_actual: 1100000 }], HOY),
    catSi: [{ label: 'Monitores', v: 1400000 }, { label: 'Gabinetes', v: 800000 }], catSo: [{ label: 'Monitores', v: 2200000 }],
    acuerdos: calc.acuerdosAbiertos([{ id: 'a', titulo: 'Cotizar bocinas Dynamic', estado: 'abierta', cuando: '2026-10-08' }], HOY),
    marketing: calc.marketingResumen([{ nombre: 'Exhibición Buen Fin', fecha: '2026-10-20', inversion: 60000, estado: 'activa' }], HOY), onProponer() {}, onAgenda() {}, onMarketing() {}, onCobranza() {}, onSellOut() {}, onCompartir() {} });
  sano(html, 'resumen');
  assert.match(html, /Va al 31 % de la cuota ideal de octubre/); assert.match(html, /Cuota del mes/); assert.match(html, /Sell out · sep/); assert.match(html, /Inventario en Digitalife/); assert.match(html, /\$2\.1M/); assert.match(html, /Cobranza/);
  assert.match(html, /Sell in vs sell out · 2026/); assert.match(html, /Qué le falta/); assert.match(html, /Armar propuesta/); assert.match(html, /AC-943154 Monitor Vivid 27/); assert.match(html, /agotado en Digitalife/);
  assert.doesNotMatch(html, /Pagos y rebates/); assert.match(html, /Categorías/); assert.match(html, /Monitores/); assert.match(html, /Acuerdos abiertos/); assert.match(html, /Cotizar bocinas Dynamic/); assert.match(html, /Exhibición Buen Fin/); assert.match(html, /Compartir ficha/);
});

test('SSR · Sell Out del cliente propio (Digitalife, PCEL y Dicotech)', () => {
  const fila = { cuenta: 'digitalife', importe: 4900000, cantidad: 12400, yoy: 12, soSi: 140, invValor: 2100000, invPiezas: 6200, invSemanas: 6 };
  const dias = [{ cuenta: 'digitalife', anio: 2026, mes: 9, dia: 5, importe: 300000, cantidad: 800 }];
  const mensual = [7, 8, 9].map((m) => ({ cuenta: 'digitalife', anio: 2026, mes: m, importe: 4500000, cantidad: 11000 }));
  const base = { nombre: 'Digitalife', fila, bloques: ['cambios', 'skus'], anio: 2026, mes: 9, dias, mensualCuenta: mensual, skus, inv, rd, hoy: HOY, onSku() {}, onProponer() {}, onCompartir() {} };
  const d = render(SellOutPropioVista, { ...base, ck: 'digitalife', ensambles: [{ ensamble: 'Gamer X', sku: 'AC-943154', descripcion: 'Monitor', piezas: 89, ensambles: 53, monto: 35000 }] });
  sano(d, 'sell out digitalife');
  assert.match(d, /Desplazó \$4\.9M en septiembre, 12 % más que en septiembre 2025 y 1\.4 veces lo que le vendimos; tiene \$2\.1M en piso y 2 SKUs que vende están agotados\./);
  assert.match(d, /Inventario en Digitalife/); assert.match(d, /Agotados que vende/); assert.match(d, /Ensambles · 2026/); assert.match(d, /53 PCs/); assert.match(d, /Sell out por día/); assert.match(d, /Sell out · 12 meses/); assert.match(d, /Categorías/); assert.match(d, /Monitores/); assert.match(d, /Productos × 12 m · con su inventario/); assert.match(d, /Inv \$/); assert.match(d, /Ensambles por modelo/); assert.match(d, /Armar propuesta con lo agotado · 2/); // con mes = sep los cerrados son jun-ago: BR-937658 tiene 1.4 sem y no entra
  const p = render(SellOutPropioVista, { ...base, ck: 'pcel', nombre: 'PCEL', fila: { ...fila, cuenta: 'pcel' } });
  sano(p, 'sell out pcel');
  assert.match(p, /valuado a lista/); assert.match(p, /SKUs sin movimiento/); assert.match(p, /BR-945820/); assert.doesNotMatch(p, /Ensambles/);
  const dc = render(SellOutPropioVista, { ...base, ck: 'dicotech', nombre: 'Dicotech', fila: { ...fila, cuenta: 'dicotech' }, bloques: ['cambios', 'skus', 'sucursales', 'vendedores', 'clientes'], suc: [{ anio: 2026, mes: 9, sucursal: 'ARBOLEDAS', importe: 192000, cantidad: 600 }, { anio: 2026, mes: 8, sucursal: 'ARBOLEDAS', importe: 230000, cantidad: 700 }], ven: [{ anio: 2026, mes: 9, vendedor: 'Luis Hernández', importe: 98000, cantidad: 300 }], cf: [{ anio: 2026, mes: 9, cliente_final: 'Cómputo del Bajío', importe: 9000, cantidad: 3, facturas: 2 }] });
  sano(dc, 'sell out dicotech');
  assert.match(dc, /Clientes activos · sep/); assert.match(dc, /Sucursales/); assert.match(dc, /Arboledas|ARBOLEDAS/); assert.match(dc, /Vendedores/); assert.match(dc, /Clientes finales/);
  assert.match(textoSellOut({ nombre: 'Digitalife', mes: 9, anio: 2026, fila, invValor: 2100000, agotados: 1 }), /Sell out \$4\.9M · 12,400 pz · \+12% vs 2025/);
});

test('rutas: Sell In y Sell Out de los propios abren la ficha nueva', () => {
  assert.equal(destino({ pagina: 'sellIn', clienteKey: 'digitalife' }).key, 'cliente-digitalife');
  assert.equal(destino({ pagina: 'sellOut', clienteKey: 'pcel' }).key, 'cliente-pcel');
  assert.equal(destino({ pagina: 'estrategia', clienteKey: 'dicotech' }).key, 'cliente-dicotech');
  assert.equal(destino({ pagina: 'marketing', clienteKey: 'digitalife' }).key, 'cliente-digitalife');
  assert.equal(destino({ pagina: 'cartera', clienteKey: 'pcel' }).key, 'cliente-pcel');
});

test('Pagos del cliente propio: resumen, rebate por regla, apoyos y SSR (uso interno)', () => {
  const pagos = [
    { id: 1, cliente: 'digitalife', tipo: 'rebate', concepto: 'Rebate Q3 2026', monto: 412000, estado: 'calculado', fecha_programada: '2026-10-15' },
    { id: 2, cliente: 'digitalife', tipo: 'apoyo_producto', concepto: 'Apoyo BPRM-102', monto: 86000, estado: 'solicitado', fecha_programada: '2026-10-02' },
    { id: 3, cliente: 'digitalife', tipo: 'marketing', concepto: 'Marketing sep', monto: 45000, estado: 'autorizado', fecha_programada: '2026-10-20' },
    { id: 4, cliente: 'digitalife', tipo: 'spiff', concepto: 'SPIFF ago', monto: 4000, estado: 'pagado', fecha_programada: '2026-09-15' },
    { id: 5, cliente: 'digitalife', tipo: 'rebate', concepto: 'Vacío', monto: 0, estado: 'calculado' },
  ];
  const r = pc.resumenPagos({ pagos, anio: 2026, mes: 10, hoy: HOY });
  assert.equal(r.nPorPagar, 3); assert.equal(r.porPagar, 543000); assert.equal(r.vencidos, 1); assert.equal(r.montoVencido, 86000); assert.equal(r.abiertos, 3);
  assert.deepEqual(r.flujo.map((f) => f.n), [1, 1, 1, 0, 0]); assert.equal(r.pagadoAnio, 4000); assert.equal(r.lista[0].id, 2);
  // Rebate por niveles (PCEL, trimestral): Q4 con oct → alcance vs cuota_min
  const pcel = pc.rebateProgreso({ fact: [{ anio: 2026, mes: 10, monto: 3200000 }], cuotas: [{ anio: 2026, mes: 10, cuota_min: 3000000 }, { anio: 2026, mes: 11, cuota_min: 0 }], regla: REGLAS_DEFAULT.pcel.rebate, anio: 2026, mes: 10 });
  assert.equal(pcel.periodo, 'Q4'); assert.equal(Math.round(pcel.alcance * 100), 107); assert.equal(pcel.pct, 0.015); assert.equal(pcel.monto, 48000); assert.equal(pcel.nivel, '106-119.99%');
  const dct = pc.rebateProgreso({ fact: [{ anio: 2026, mes: 10, monto: 800000 }], cuotas: [{ anio: 2026, mes: 10, cuota_min: 1000000 }], regla: REGLAS_DEFAULT.dicotech.rebate, anio: 2026, mes: 10 });
  assert.equal(dct.modo, 'mensual'); assert.equal(dct.pct, 0); assert.equal(dct.monto, 0);
  const dgl = pc.rebateProgreso({ fact: [{ anio: 2026, mes: 10, monto: 1000000 }], cuotas: [], regla: REGLAS_DEFAULT.digitalife.rebate, anio: 2026, mes: 10 });
  assert.equal(dgl.modo, 'por_categoria'); assert.match(dgl.nivel, /monitores 2 %/);
  const ap = pc.resumenApoyos([{ sku: 'AC-1', stock: 420, apoyo_pz: 360, apoyo_inventario: 151200, costo_convenio: 3540, precio_factura: 3900 }, { sku: 'BR-2', stock: 0, apoyo_pz: 30, apoyo_inventario: 0 }], new Map([['AC-9', {}]]));
  assert.equal(ap.skus, 1); assert.equal(ap.porRegistrar, 1); assert.equal(ap.enPiso, 151200);
  assert.match(pc.frasePagos({ nombre: 'PCEL', mes: 10, r, rebate: pcel, apoyos: ap }), /Le debemos \$543K en octubre: \$412K de rebate, \$86K de apoyos, \$45K de marketing; el rebate de Q4 va al 107 % y generaría \$48K; 1 apoyo por producto sin registrar\. 1 pago vencido \(\$86K\)\./);
  assert.equal(pc.pctIn(0.015), '1.5'); assert.equal(pc.pctOut('1.5'), 0.015);
  const html = render(PagosPropioVista, { nombre: 'PCEL', anio: 2026, mes: 10, r, rebate: pcel, apoyos: ap, fondo: 120000, serie: pc.serieMensualPagos(pagos, 2026), puedeEditar: true, hoy: HOY, onPago() {}, onNuevoApoyo() {}, onRegistrarApoyo() {}, onReglas() {} });
  assert.ok(!/NaN|undefined|\[object Object\]/.test(html));
  assert.match(html, /Por pagar · oct/); assert.match(html, /Rebate · Q4/); assert.match(html, /Apoyos por producto/); assert.match(html, /Fondo/); assert.match(html, /Flujo del mes/); assert.match(html, /Solicitado/);
  assert.match(html, /Rebate Q3 2026/); assert.match(html, /Solicitar/); assert.match(html, /＋ Apoyo por producto/); assert.match(html, /Apoyos por SKU · costo convenio/); assert.match(html, /Registrar/); assert.match(html, /Reglas de pago/); assert.match(html, /Pagado por mes/);
  assert.equal(destino({ pagina: 'pagos', clienteKey: 'digitalife' }).key, 'cliente-digitalife');
});

test('Cobranza general (celular): consolidado de los tres con el formato estándar', () => {
  const cortes = (k, s0, v0) => [{ id: `${k}-2`, fecha_corte: '2026-10-11', saldo_actual: s0, saldo_vencido: v0, dso: 48, tipo_cambio: 17 }, { id: `${k}-1`, fecha_corte: '2026-10-04', saldo_actual: s0 * 0.9, saldo_vencido: v0 + 10000, dso: 50 }];
  const det = [{ referencia: 'F-1', fecha_emision: '2026-08-01', vencimiento: '2026-09-01', saldo_actual: 140000 }, { referencia: 'F-2', fecha_emision: '2026-09-20', vencimiento: '2026-10-15', saldo_actual: 640000 }];
  const cls = [cob.resumirCliente('digitalife', cortes('d', 5000000, 140000), det, { plazo_dias_credito: 90, linea_credito_mxn_pagare: 9000000 }), cob.resumirCliente('pcel', cortes('p', 5100000, 210000), det, null), cob.resumirCliente('dicotech', [], [], null)];
  const t = cob.consolidar(cls);
  const html = render(CobranzaGlobalVista, { t, cls, onCliente() {}, onCompartir() {} });
  assert.ok(!/NaN|undefined|\[object Object\]/.test(html));
  assert.match(html, /Corte 11 oct · 2 clientes/); assert.match(html, /Saldo/); assert.match(html, /Vencido/); assert.match(html, /DSO/); assert.match(html, /Vence esta semana/);
  assert.match(html, /Aging del vencido/); assert.match(html, /\+90 d/); assert.match(html, /Saldo y vencido por corte/); assert.match(html, /Quién debe/); assert.match(html, /Digitalife/); assert.match(html, /sin estado de cuenta/);
  assert.match(html, /Facturas vencidas/); assert.match(html, /F-1/); assert.match(html, /Compartir resumen/);
  assert.match(textoCobranza(t, cls), /Cartera \$10\.1M · vencido \$350K/);
});
