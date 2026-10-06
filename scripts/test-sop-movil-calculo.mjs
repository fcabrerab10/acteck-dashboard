// S&OP y Proyectos y forecast del celular (2026-10-05): motores puros, sin red ni Vite.
//   node --test scripts/test-sop-movil-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { cedisCorto as sop_cedis, mesesDesde, arribosPorPo, resumenEmpresa, serieDemanda, comprarAhora, filasDetalle, calcularMisClientes, fraseMisClientes, diasCobertura } from '../src/movil/pestanas/sop/calculo.js';
import { estadoCliente, sumarClientes, fraseForecast, diasAlLimite, lineaMeses, filasParaPlantilla } from '../src/movil/pestanas/forecast/calculo.js';

const HOY = new Date(2026, 9, 5, 12); // 5 oct 2026
const rows = [
  { sku: 'AC-1', descripcion: 'Monitor', marca: 'Acteck', familia: 'Monitores', inv: 700, demMes: 2310, coberturaDiasErp: 8, brecha: 2870, sugerido: 3000, ultimoCostoUsd: 82, traCant: 3360, ltDias: 105, embarques: [{ eta: '2026-11-10', cantidad: 3360 }] },
  { sku: 'BR-2', descripcion: 'Earth 27', marca: 'Balam Rush', familia: 'Monitores', inv: 340, demMes: 480, coberturaDiasErp: 21, brecha: 1100, sugerido: 1200, ultimoCostoUsd: 98, traCant: 0, ltDias: 113, embarques: [] },
  { sku: 'AC-3', descripcion: 'Teclado', marca: 'Acteck', familia: 'Periféricos', inv: 0, demMes: 200, coberturaDiasErp: 0, brecha: 600, sugerido: 800, ultimoCostoUsd: 8.2, traCant: 0, ltDias: 98, embarques: [] },
  { sku: 'AC-4', descripcion: 'Gabinete', marca: 'Acteck', familia: 'Gabinetes', inv: 5000, demMes: 100, coberturaDiasErp: 1500, brecha: 0, sugerido: 0, ultimoCostoUsd: 30, traCant: 0, ltDias: null, embarques: [] },
];
const transito = [
  { sku: 'AC-1', supplier: 'SHENZHEN', cantidad: 3360, embarques_detalle: [{ po: 'ABT338', cantidad: 3360, eta: '2026-11-10', etd: '2026-09-20', cedis: 'ALMACENES ZAPOPAN', estatus: 'EN PRODUCCION', contenedor: 'C1' }] },
  { sku: 'AC-9', supplier: 'SHENZHEN', cantidad: 1200, embarques_detalle: [{ po: 'ABT280', cantidad: 1200, eta: '2026-10-09', etd: '2026-09-02', cedis: 'ALMACENES ZAPOPAN', estatus: 'TRANSITO MARITIMO', contenedor: 'CAAU5936368' }, { po: 'ABT262', cantidad: 100, eta: '2026-10-01', etd: '2026-08-20', cedis: '', estatus: 'EN PUERTO', contenedor: 'C3' }] },
];
const porSku = new Map(rows.map((r) => [r.sku, r]));

test('arribosPorPo agrupa por PO, pone naviera, vencidas y urgencia', () => {
  const a = arribosPorPo({ transito, porSku, navieraPor: new Map([['CAAU5936368', 'MSK']]), hoy: HOY });
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((p) => p.po), ['ABT262', 'ABT280', 'ABT338']); // por ETA
  const p262 = a[0]; assert.equal(p262.vencida, true); assert.equal(p262.dias, -4);
  const p280 = a[1]; assert.equal(p280.naviera, 'MSK'); assert.equal(p280.piezas, 1200); assert.equal(p280.dias, 4); assert.equal(p280.skus[0].tono, 'gray'); // AC-9 no está en el motor
  const p338 = a[2]; assert.equal(p338.usd, 3360 * 82); assert.equal(p338.skus[0].tono, 'red'); assert.equal(p338.urgen, 1);
});

test('resumenEmpresa: llega este mes / siguiente / siguiente arribo / total y frase', () => {
  const arribos = arribosPorPo({ transito, porSku, hoy: HOY });
  const r = resumenEmpresa({ rows, arribos, hoy: HOY, sensible: true });
  assert.equal(r.mesActual.pos, 2); assert.equal(r.mesActual.pz, 1300);
  assert.equal(r.mesSiguiente.pos, 1); assert.equal(r.mesSiguiente.usd, 3360 * 82);
  assert.equal(r.siguiente.po, 'ABT280'); // la vencida no cuenta como «siguiente»
  assert.equal(r.total.vencidas, 1); assert.equal(r.conBrecha, 3); assert.equal(r.agotados, 1);
  assert.match(r.frase, /octubre/); assert.match(r.frase, /ABT280/); assert.match(r.frase, /9 de octubre/); assert.match(r.frase, /Zapopan/);
  const sinS = resumenEmpresa({ rows, arribos, hoy: HOY, sensible: false });
  assert.match(sinS.frase, /pz en octubre/); assert.doesNotMatch(sinS.frase, /USD/);
});

test('serieDemanda: FIFO por SKU, lo vencido cuenta este mes, faltante en piezas', () => {
  const s = serieDemanda({ rows: [rows[0], rows[2]], llegadas: [{ sku: 'AC-1', eta: '2026-11-10', cantidad: 3360 }, { sku: 'AC-3', eta: '2026-10-01', cantidad: 100 }], hoy: HOY, meses: 3 });
  assert.equal(s.length, 3); assert.equal(s[0].key, '2026-10');
  // Oct: AC-1 700 vs 2310 → falta 1610 · AC-3 0+100 vs 200 → falta 100
  assert.equal(s[0].demanda, 2510); assert.equal(s[0].falta, 1710); assert.equal(s[0].llega, 100);
  // Nov: AC-1 llega 3360 → cubre 2310, sobra 1050 · AC-3 falta 200
  assert.equal(s[1].falta, 200); assert.equal(s[1].llega, 3360);
  // Dic: AC-1 1050 vs 2310 → falta 1260 · AC-3 200
  assert.equal(s[2].falta, 1460);
});

test('comprarAhora ordena agotado → menos cobertura → USD, con línea legible', () => {
  const c = comprarAhora(rows);
  assert.equal(c.total, 3); assert.deepEqual(c.lista.map((x) => x.sku), ['AC-3', 'AC-1', 'BR-2']);
  assert.equal(c.lista[0].linea, 'agotado · LT 98 d · sin PO');
  assert.equal(sop_cedis('ALMACENES 1 ZAPOPAN'), 'Zapopan');
  assert.equal(c.lista[1].linea, 'cobertura 1.1 sem · LT 105 d · llega 10 nov');
  assert.equal(c.piezas, 5000); assert.equal(Math.round(c.usd), 3000 * 82 + 1200 * 98 + 800 * 8.2);
});

test('filasDetalle: filtros críticos / sin PO / marca y valores en orden', () => {
  assert.deepEqual(filasDetalle(rows).map((f) => f.sku), ['AC-3', 'AC-1', 'BR-2', 'AC-4']); // agotado con demanda → menos días
  assert.deepEqual(filasDetalle(rows, { filtro: 'criticos' }).map((f) => f.sku), ['AC-3', 'AC-1', 'BR-2']);
  assert.equal(filasDetalle([{ sku: 'X', inv: 0, demMes: 0 }])[0].dias, null); // sin stock ni demanda: no hay qué medir
  assert.deepEqual(filasDetalle(rows, { filtro: 'sinPo' }).map((f) => f.sku), ['AC-3', 'BR-2']);
  assert.deepEqual(filasDetalle(rows, { filtro: 'balam rush' }).map((f) => f.sku), ['BR-2']);
  assert.deepEqual(filasDetalle(rows)[1].valores, [8, 2310, 700, 3360, 3000]);
  assert.equal(diasCobertura({ coberturaDias: 12 }), 12);
});

test('calcularMisClientes: inventario del cliente primero, FIFO nuestro + tránsito, reparto proporcional', () => {
  const ventana = mesesDesde(HOY, 3, 1); // nov · dic · ene
  const res = calcularMisClientes({
    clientes: [
      { key: 'digitalife', label: 'Digitalife', forecast: [{ sku: 'AC-1', key: '2026-11', piezas: 150 }, { sku: 'AC-1', key: '2026-12', piezas: 200 }, { sku: 'AC-1', key: '2027-01', piezas: 150 }], stock: new Map([['AC-1', 100]]) },
      { key: 'pcel', label: 'PCEL', forecast: [{ sku: 'AC-1', key: '2026-12', piezas: 200 }], stock: new Map() },
      { key: 'dicotech', label: 'Dicotech', forecast: [], stock: new Map() },
    ],
    inventario: new Map([['AC-1', 120]]), llegadas: [{ sku: 'AC-1', eta: '2026-12-15', cantidad: 100 }], ventana, costos: new Map([['AC-1', 82]]), hoy: HOY,
  });
  // Digitalife neto: nov 50 (150−100 de su piso) · dic 200 · ene 150. PCEL dic 200.
  // Nov: necesidad 50, stock 120 → cubre 50 (queda 70). Dic: llega 100 → 170 vs 400 → falta 230 (dgl 115 · pcel 115). Ene: 0 vs 150 → falta 150.
  const dgl = res.porCliente.find((c) => c.key === 'digitalife');
  assert.equal(dgl.forecastPz, 500); assert.equal(dgl.netoPz, 400); assert.equal(dgl.falta, 265); assert.equal(dgl.primerHuecoLabel, 'diciembre');
  const pcel = res.porCliente.find((c) => c.key === 'pcel');
  assert.equal(pcel.falta, 115); assert.equal(pcel.usd, 115 * 82);
  assert.equal(res.comprar.length, 1); assert.equal(res.comprar[0].piezas, 380); assert.equal(res.comprar[0].desde, '2026-12'); assert.equal(res.comprar[0].tienePo, true);
  assert.deepEqual(res.comprar[0].clientes.map((c) => c.key), ['digitalife', 'pcel']);
  assert.equal(res.totales.falta, 380); assert.equal(res.totales.usd, 380 * 82);
  assert.match(fraseMisClientes(res), /Faltan 380 pz \(\$31K USD\) y el primer hueco es en diciembre/);
  assert.match(fraseMisClientes(res, { sensible: false }), /Faltan 380 pz y el primer hueco/);
  const vacio = calcularMisClientes({ clientes: [{ key: 'pcel', label: 'PCEL', forecast: [], stock: new Map() }], ventana, hoy: HOY });
  assert.match(fraseMisClientes(vacio), /Todavía no hay forecast/);
});

// ─── Proyectos y forecast ───
const ventana = mesesDesde(HOY, 6, 1);
const roadmap = new Map([['AC-1', { descripcion: 'Monitor Vivid 27', marca: 'Acteck' }], ['BR-2', { descripcion: 'Fuente', marca: 'Balam Rush' }]]);

test('estadoCliente: capturado manda sobre la copia del CRM y ambos sobre el sugerido', () => {
  const e = estadoCliente({ key: 'digitalife', label: 'Digitalife', ventana, roadmap, hoy: HOY,
    existente: [{ sku: 'AC-1', mes: '2026-11-01', piezas: 100 }, { sku: 'AC-1', mes: '2026-12-01', piezas: 100 }, { sku: 'AC-5', mes: '2026-11-01', piezas: 30 }, { sku: 'AC-5', mes: '2026-05-01', piezas: 999 }],
    crm: [{ sku: 'AC-1', anio: 2026, mes: 11, piezas: 150, estado: 'borrador', justificacion: 'Temporada Buen Fin y reposición' }, { sku: 'BR-2', anio: 2026, mes: 12, piezas: 60, estado: 'exportado' }],
    sugerido: [{ sku: 'AC-1', meses: { '2026-11': 999 } }, { sku: 'AC-7', descripcion: 'Gabinete', meses: { '2026-11': 70, '2026-12': 80 }, justificacion: 'Ritmo' }],
    proyectos: [{ sku: 'AC-1', key: '2026-11', piezas: 1000, nombre: 'Bocinas', probabilidad: 'confirmado' }, { sku: 'AC-1', key: '2026-03', piezas: 5, nombre: 'Viejo', probabilidad: 'confirmado' }],
    lotes: [{ id: 1, clientes: ['digitalife'], cargado_crm_at: null }, { id: 2, clientes: ['pcel'], cargado_crm_at: 'x' }] });
  const ac1 = e.filas.find((f) => f.sku === 'AC-1');
  assert.equal(ac1.origen, 'borrador'); assert.deepEqual(ac1.meses, { '2026-11': 150 }); assert.equal(ac1.descripcion, 'Monitor Vivid 27'); assert.match(ac1.justificacion, /Buen Fin/);
  assert.equal(e.filas.find((f) => f.sku === 'AC-5').total, 30); // fuera de ventana no cuenta
  assert.equal(e.filas.find((f) => f.sku === 'BR-2').origen, 'exportado');
  assert.equal(e.filas.find((f) => f.sku === 'AC-7').origen, 'sugerido');
  const r = e.resumen;
  assert.deepEqual(r.capturados, { skus: 3, pz: 240 }); assert.deepEqual(r.enCrm, { skus: 2, pz: 90 }); assert.deepEqual(r.borrador, { skus: 1, pz: 150 }); assert.deepEqual(r.porCapturar, { skus: 1, pz: 150 });
  assert.deepEqual(r.proyectos, { n: 1, pz: 1000, confirmados: 1 });
  assert.deepEqual({ n: r.lotes.n, sinCargar: r.lotes.sinCargar }, { n: 1, sinCargar: 1 });
  assert.equal(r.diasLimite, 5);
  assert.match(fraseForecast(e, { hoy: HOY }), /Digitalife tiene 3 SKUs con forecast por 240 pz \(nov → abr\); 1 en borrador sin exportar; 1 sugerido por capturar antes del día 10 \(en 5 d\)\. 1 proyecto suma 1,000 pz \(1 confirmado\)\./);
  assert.equal(lineaMeses(ac1.meses, ventana), 'nov 150');
  assert.equal(filasParaPlantilla(e.filas, { tipo: 'directa', clienteCodigo: '00764' }).length, 1);
  assert.equal(filasParaPlantilla(e.filas, { tipo: 'directa', clienteCodigo: '00764' }, { soloBorrador: false }).length, 3);
});

test('sumarClientes suma por SKU con reparto por cliente', () => {
  const a = estadoCliente({ key: 'digitalife', label: 'Digitalife', ventana, hoy: HOY, crm: [{ sku: 'AC-1', anio: 2026, mes: 11, piezas: 150, estado: 'exportado' }] });
  const b = estadoCliente({ key: 'pcel', label: 'PCEL', ventana, hoy: HOY, sugerido: [{ sku: 'AC-1', meses: { '2026-11': 50 } }, { sku: 'BR-2', meses: { '2026-12': 20 } }] });
  const t = sumarClientes([a, b]);
  assert.equal(t.filas.length, 2); const ac1 = t.filas[0];
  assert.equal(ac1.total, 200); assert.equal(ac1.origen, 'sugerido'); assert.equal(ac1.porCliente.length, 2);
  assert.deepEqual(t.resumen.capturados, { skus: 1, pz: 150 }); assert.deepEqual(t.resumen.porCapturar, { skus: 2, pz: 70 });
  assert.match(fraseForecast(t, { hoy: HOY }), /Los tres clientes tienen 1 SKU con forecast/);
  assert.equal(diasAlLimite(new Date(2026, 9, 20)), 21); assert.equal(diasAlLimite(new Date(2026, 9, 10)), 0);
  const vacio = estadoCliente({ key: 'dicotech', label: 'Dicotech', ventana, hoy: HOY });
  assert.match(fraseForecast(vacio), /sin forecast ni sugerido/);
});
