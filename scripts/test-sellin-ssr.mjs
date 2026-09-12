// Smoke SSR de Sell In (consolidado y por cliente) + lo nuevo de 2026-09-12: el panel de
// apoyo comercial (bonificaciones por concepto) y el de equipo comercial (vendedor), en web
// y en celular. Carga cada módulo con el pipeline de Vite para atrapar imports rotos, ciclos
// y JSX inválido antes de abrir el navegador, y prueba el cálculo puro de apoyo.js.
//   node --test scripts/test-sellin-ssr.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });

test.after(() => vite.close());

test('los módulos de Sell In cargan y exportan default', async () => {
  for (const m of [
    '/src/modules/comercial/SellInCliente.jsx',
    '/src/modules/comercial/SellInClienteV2.jsx',
    '/src/modules/comercial/SellInDicotech.jsx',
    '/src/modules/comercial/SellInPcel.jsx',
    '/src/modules/comercial/sellin/ApoyoComercial.jsx',
    '/src/modules/comercial/sellin/EquipoComercial.jsx',
    '/src/modules/comercial/analisis/DrillCliente.jsx',
    '/src/movil/pestanas/sellin/SellInGlobal.jsx',
    '/src/movil/pestanas/sellin/ApoyoM.jsx',
    '/src/movil/pestanas/sellin/EquipoM.jsx',
    '/src/movil/pestanas/SellInCliente.jsx',
  ]) {
    const mod = await vite.ssrLoadModule(m);
    assert.equal(typeof mod.default, 'function', `${m} debe exportar default`);
  }
});

test('los hooks de datos existen', async () => {
  const datos = await vite.ssrLoadModule('/src/modules/comercial/sellin/datos.js');
  for (const h of ['useApoyoComercial', 'useApoyoCliente', 'useVendedores', 'useVendedorClientes']) {
    assert.equal(typeof datos[h], 'function', `datos.js debe exportar ${h}`);
  }
});

test('agruparApoyo: positivos, YTD, mes, YoY y drill', async () => {
  const { agruparApoyo, totalesApoyo, factBruta, factBrutaPorCliente, pctSobre } = await vite.ssrLoadModule('/src/modules/comercial/sellin/apoyo.js');
  const filas = [
    { anio: 2026, mes: 1, cliente: '00764', cliente_nombre: 'API GLOBAL', canal: 'DISTRIBUIDOR', concepto_codigo: 'BPRM-101', concepto: 'PROMOCION GENERAL', monto: -1000, renglones: 2 },
    { anio: 2026, mes: 2, cliente: '00764', cliente_nombre: 'API GLOBAL', canal: 'DISTRIBUIDOR', concepto_codigo: 'BPRM-101', concepto: 'PROMOCION GENERAL', monto: -500, renglones: 1 },
    { anio: 2026, mes: 2, cliente: '00226', cliente_nombre: 'INGRAM', canal: 'MAYOREO', concepto_codigo: 'BVND-201', concepto: 'REBATE', monto: -300, renglones: 1 },
    { anio: 2026, mes: 5, cliente: '00226', cliente_nombre: 'INGRAM', canal: 'MAYOREO', concepto_codigo: 'BVND-201', concepto: 'REBATE', monto: -9999, renglones: 1 }, // fuera del mes elegido
    { anio: 2025, mes: 1, cliente: '00764', cliente_nombre: 'API GLOBAL', canal: 'DISTRIBUIDOR', concepto_codigo: 'BPRM-101', concepto: 'PROMOCION GENERAL', monto: -750, renglones: 1 },
  ];
  const opts = { anio: 2026, anioPrev: 2025, mes: 2 };

  const porConcepto = agruparApoyo(filas, { ...opts, por: 'concepto', hijo: 'cliente' });
  assert.equal(porConcepto.length, 2);
  assert.equal(porConcepto[0].key, 'BPRM-101');
  assert.equal(porConcepto[0].ytd, 1500, 'el YTD va en positivo');
  assert.equal(porConcepto[0].mes, 500, 'el mes es sólo febrero');
  assert.equal(porConcepto[0].ytdPrev, 750);
  assert.equal(Math.round(porConcepto[0].delta), 100, 'YoY = +100 %');
  assert.equal(porConcepto[0].hijos[0].label, 'API GLOBAL');
  assert.equal(porConcepto[1].ytd, 300, 'mayo no entra en el YTD de febrero');

  const porCliente = agruparApoyo(filas, { ...opts, por: 'cliente', hijo: 'concepto' });
  assert.equal(porCliente[0].key, '00764', 'la clave del cliente es el código, no el nombre');
  assert.equal(porCliente[0].hijos[0].key, 'BPRM-101');

  const mesADia = agruparApoyo(filas, { ...opts, por: 'concepto', hijo: 'mes' });
  assert.deepEqual(mesADia[0].meses.slice(0, 3), [1000, 500, 0]);

  const tot = totalesApoyo(filas, opts);
  assert.equal(tot.ytd, 1800);
  assert.equal(tot.mes, 800);
  assert.equal(tot.conceptos, 2);

  const fb = factBruta([{ anio: 2026, mes: 1, fact_bruta: 10000 }, { anio: 2026, mes: 2, fact_bruta: 8000 }, { anio: 2026, mes: 5, fact_bruta: 9 }], { anio: 2026, mes: 2 });
  assert.equal(fb.ytd, 18000);
  assert.equal(fb.mes, 8000);
  assert.equal(Math.round(pctSobre(tot.ytd, fb.ytd) * 100) / 100, 10);
  assert.equal(pctSobre(100, 0), null, 'denominador 0 → null, nunca 0');

  const porCli = factBrutaPorCliente([{ cliente: '00764', anio: 2026, mes: 1, fact_bruta: 500 }, { cliente: '00764', anio: 2026, mes: 9, fact_bruta: 1 }], { anio: 2026, mes: 2 });
  assert.equal(porCli.get('00764'), 500);
});
