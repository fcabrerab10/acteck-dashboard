// Pruebas del reparto de la minuta ("Anota y reparte al cerrar").
//   node --test scripts/test-agenda-reparto.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { detectarAcuerdos, esAcuerdo, analizarLinea, contarAcuerdos, lineasMarcadas, opcionesFecha, filasAItems, textoReparto } from '../src/modules/agenda/reparto.js';

const P = [
  { user_id: 'u-fer', nombre: 'Fernando Cabrera', email: 'fernando.cabrera@acteck.com' },
  { user_id: 'u-kar', nombre: 'Karolina Veliz', email: 'karolina.veliz@acteck.com' },
];
const HOY = new Date(2026, 8, 21, 11);            // lunes 21 sep 2026
const OPC = { clienteKey: 'pcel', personas: P, hoy: HOY, yo: 'u-fer' };

test('las viñetas son acuerdos y el resto es contexto', () => {
  const texto = [
    'Vino Karolina y revisamos el avance del trimestre.',
    '- Mandar la cotización actualizada',
    '• Pedir el rebate del Q3',
    '* Confirmar el POP',
    '1. Cerrar el convenio',
    'Quedaron contentos con el portafolio.',
  ].join('\n');
  const r = detectarAcuerdos(texto, OPC);
  assert.equal(r.length, 4);
  assert.deepEqual(r.map((x) => x.titulo), ['Mandar la cotización actualizada', 'Pedir el rebate del Q3', 'Confirmar el POP', 'Cerrar el convenio']);
  assert.ok(r.every((x) => x.incluir));
});

test('una línea sin marcadores NO es acuerdo', () => {
  assert.equal(esAcuerdo('Se comentó el tema del inventario', { hoy: HOY }), false);
  assert.equal(detectarAcuerdos('Se comentó el tema del inventario', OPC).length, 0);
  assert.equal(contarAcuerdos('Nada que repartir aquí', OPC), 0);
});

test('@persona asigna responsable; sin @ queda quien captura', () => {
  const r = detectarAcuerdos('- Subir el P&L\nMandar muestras @karolina', OPC);
  assert.equal(r.length, 2);
  assert.equal(r[0].persona, 'u-fer', 'sin @ el responsable es quien anota');
  assert.equal(r[1].persona, 'u-kar');
  assert.equal(r[1].titulo, 'Mandar muestras', 'la etiqueta @ sale del título');
});

test('#cliente gana sobre el cliente de la reunión; sin # se hereda', () => {
  const r = detectarAcuerdos('- Revisar precios\nLlamar a Dicotech #dicotech', OPC);
  assert.equal(r[0].clienteKey, 'pcel');
  assert.equal(r[1].clienteKey, 'dicotech');
  assert.equal(r[1].titulo, 'Llamar a Dicotech');
});

test('fecha relativa: hoy · mañana · el viernes · 24/09 · la próxima semana', () => {
  const texto = ['Cerrar el pedido hoy', 'Mandar la propuesta mañana', 'Visitar el viernes', 'Enviar la factura 24/09', 'Revisar la próxima semana'].join('\n');
  const r = detectarAcuerdos(texto, OPC);
  assert.deepEqual(r.map((x) => x.fecha), ['2026-09-21', '2026-09-22', '2026-09-25', '2026-09-24', '2026-09-28']);
  assert.deepEqual(r.map((x) => x.titulo), ['Cerrar el pedido', 'Mandar la propuesta', 'Visitar', 'Enviar la factura', 'Revisar']);
});

test('líneas vacías y viñetas sin texto se ignoran', () => {
  const r = detectarAcuerdos('\n\n-   \n- Pedir el POP\n\n   \n', OPC);
  assert.equal(r.length, 1);
  assert.equal(r[0].titulo, 'Pedir el POP');
});

test('acentos y mayúsculas: el dedupe no los distingue', () => {
  const r = detectarAcuerdos('- Revisión de márgenes\n- REVISION DE MARGENES\n- Revisión de márgenes', OPC);
  assert.equal(r.length, 1, 'la misma frase con y sin acentos es un solo acuerdo');
  assert.equal(r[0].titulo, 'Revisión de márgenes', 'se conserva el texto tal cual se escribió');
});

test('lo que ya existe como punto de la reunión llega marcado y sin palomita', () => {
  const existentes = [{ titulo: 'Pedir el rebate del Q3' }, { titulo: 'Otro punto' }];
  const r = detectarAcuerdos('- Pedir el rebate del Q3\n- Mandar la cotización', { ...OPC, existentes });
  assert.equal(r.length, 2);
  assert.equal(r[0].yaExiste, true);
  assert.equal(r[0].incluir, false);
  assert.equal(r[1].incluir, true);
  assert.equal(filasAItems(r, { id: 'r1', cliente_key: 'pcel' }).length, 1, 'sólo se crea lo que no existía');
});

test('analizarLinea junta viñeta + fecha + @ + # en una sola pasada', () => {
  const a = analizarLinea('- Mandar el estado de cuenta @karolina #dicotech el viernes /pagos', OPC);
  assert.equal(a.titulo, 'Mandar el estado de cuenta');
  assert.equal(a.persona, 'u-kar');
  assert.equal(a.clienteKey, 'dicotech');
  assert.equal(a.fecha, '2026-09-25');
  assert.equal(a.categoria, 'pagos');
});

test('filasAItems arma lo que espera crearItem', () => {
  const r = detectarAcuerdos('- Mandar muestras @karolina mañana', OPC);
  const [row] = filasAItems(r, { id: 'r1', cliente_key: 'pcel' }, { orden0: 3 });
  assert.equal(row.tipo, 'punto');
  assert.equal(row.reunion_id, 'r1');
  assert.deepEqual(row.responsables, ['u-kar']);
  assert.equal(row.fecha_limite, '2026-09-22');
  assert.equal(row.cliente_key, 'pcel');
  assert.equal(row.orden, 3);
  assert.equal(row.origen.fuente, 'reparto');
});

test('lineasMarcadas devuelve todas las líneas con su marca (resaltado)', () => {
  const m = lineasMarcadas('Contexto\n- Acuerdo\n', { hoy: HOY });
  assert.deepEqual(m.map((x) => x.acuerdo), [false, true, false]);
  assert.equal(m.length, 3, 'las líneas vacías cuentan para alinear el resaltado');
});

test('opcionesFecha y el texto del toast', () => {
  const o = opcionesFecha(HOY);
  assert.deepEqual(o.map((x) => x.fecha), ['2026-09-21', '2026-09-22', '2026-09-25', '2026-09-28', null]);
  assert.equal(textoReparto(4), '4 pendientes creados · minuta cerrada');
  assert.equal(textoReparto(1, { cerrada: false }), '1 pendiente creado');
});
