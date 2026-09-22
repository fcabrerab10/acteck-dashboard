import test from 'node:test';
import assert from 'node:assert/strict';
import { armarCorreoMinuta, limpiarCorreos } from '../api/_minuta.js';

const reunion = { titulo: 'Reunión Digitalife · puntos del martes', cliente_key: 'digitalife', fecha: '2026-09-22T16:00:00Z', asistentes: [{ user_id: 'u1' }, { nombre: 'Karolina' }], notas: 'Próxima revisión en octubre.' };
const personas = [{ user_id: 'u1', nombre: 'Fernando Cabrera' }];
const puntos = [
  { titulo: 'Alcance de compra Q3', estado: 'hecha', categoria: 'comercial', responsables: ['u1'], fecha_limite: '2026-09-30', resolucion: 'Se cumple con la PO de bocinas' },
  { titulo: 'Camisas <personal>', estado: 'abierta', categoria: null, responsables: [] },
  { titulo: 'Punto cancelado', estado: 'cancelada' },
];

test('el correo trae cliente, título, puntos por sección y resumen', () => {
  const { asunto, html, texto } = armarCorreoMinuta({ reunion, puntos, personas, mensaje: 'Hola, les comparto la minuta.', remitente: { nombre: 'Fernando Cabrera', email: 'fernando.cabrera@acteck.com' } });
  assert.equal(asunto, 'Minuta · Digitalife · 22 sep · Reunión Digitalife · puntos del martes');
  assert.ok(html.includes('Comercial') && html.includes('Otros puntos'), 'secciones por categoría');
  assert.ok(html.includes('Alcance de compra Q3') && html.includes('Quedó:</span> Se cumple'), 'punto con resolución');
  assert.ok(html.includes('Camisas &lt;personal&gt;'), 'escapa HTML');
  assert.ok(!html.includes('Punto cancelado'), 'los cancelados no van');
  assert.ok(html.includes('1 resuelto · 1 pendiente'), 'resumen');
  assert.ok(html.includes('Fernando, Karolina'), 'asistentes por id y por nombre');
  assert.ok(texto.includes('[x] Alcance de compra Q3 · Fernando · para el 30 sep — quedó: Se cumple con la PO de bocinas'));
});

test('limpiarCorreos valida, baja a minúsculas y quita repetidos', () => {
  assert.deepEqual(limpiarCorreos(['Compras@Digitalife.mx ', 'malo', 'compras@digitalife.mx', 'ana@x.com']), ['compras@digitalife.mx', 'ana@x.com']);
});
