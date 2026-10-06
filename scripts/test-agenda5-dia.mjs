import test from 'node:test';
import assert from 'node:assert/strict';
import { proponer, momentoDe, hiloDe, cargaDia, porHilo, HILOS } from '../src/modules/agenda5/dia/proponer.js';

const hoy = '2026-10-05';
test('momento del día con las horas de Fernando', () => {
  const h = { armar: '09:00', pausa: '15:00', retomar: '17:00', cierre: '22:00' };
  assert.equal(momentoDe(new Date('2026-10-05T08:30:00'), h), 'antes');
  assert.equal(momentoDe(new Date('2026-10-05T09:00:00'), h), 'trabajar');
  assert.equal(momentoDe(new Date('2026-10-05T15:30:00'), h), 'pausa');
  assert.equal(momentoDe(new Date('2026-10-05T17:00:00'), h), 'trabajar');
  assert.equal(momentoDe(new Date('2026-10-05T22:05:00'), h), 'cierre');
});
test('propone desde las fuentes y respeta decisiones', () => {
  const p = proponer({ hoyIso: hoy,
    pagos: [{ id: 'p1', estado: 'solicitado', cliente: 'digitalife', concepto: 'Rebate Q3', monto: 133675, created_at: '2026-10-02' }, { id: 'p2', estado: 'pagado', cliente: 'pcel', monto: 1 }, { id: 'p3', estado: 'calculado', cliente: 'pcel', periodo: '2026-09', monto: 10 }, { id: 'p4', estado: 'calculado', cliente: 'pcel', periodo: '2026-12', monto: 10 }],
    cuentas: [{ id: 'c1', nombre: 'Eduardo Macías', empresa: 'Compu Lan', proximo_seguimiento: '2026-09-25', estado: 'activa', telefono: '33' }, { id: 'c2', nombre: 'X', proximo_seguimiento: '2026-10-20', estado: 'activa' }],
    propuestas: [{ id: 'pr1', estado: 'enviada', enviada_at: '2026-09-28', cliente_key: 'pcel', nombre: 'Productos por colocar', resumen: { skus: 18, total: 1694443 } }, { id: 'pr2', estado: 'enviada', enviada_at: '2026-10-03', cliente_key: 'pcel' }],
    frescura: [{ fuente: 'guias_erp', etiqueta: 'Guías ERP', estado: 'atrasada', dias: 56, umbral_dias: 7 }, { fuente: 'erp_ventas', estado: 'atrasada', dias: 9, umbral_dias: 7 }],
    forecastLotes: [], viajes: [{ id: 'v1', titulo: 'Viaje', fecha: '2026-10-10' }],
    decisiones: [{ fuente: 'cuenta', ref: 'c1', decision: 'descartada', hasta: '2026-10-19' }] });
  const ids = p.map((x) => x.id);
  assert.ok(ids.includes('pagos:p1') && !ids.includes('pagos:p2'), 'solicitado uno por uno');
  assert.ok(ids.includes('pagos:pendientes-2026-10') && !ids.includes('pagos:p3') && !ids.includes('pagos:p4'), 'calculados del período agrupados; futuros fuera');
  assert.ok(!ids.includes('cuenta:c1'), 'descartada hasta el 19 no vuelve');
  assert.ok(!ids.includes('cuenta:c2'), 'seguimiento futuro no se propone');
  assert.ok(ids.includes('propuesta:pr1') && !ids.includes('propuesta:pr2'), 'propuesta con 5+ días');
  assert.ok(ids.includes('carga:guias_erp') && !ids.includes('carga:erp_ventas'), 'sólo fuentes manuales atrasadas');
  assert.ok(ids.includes('forecast:2026-11'), 'forecast del mes siguiente antes del día 10');
  assert.ok(ids.includes('viaje:v1'), 'viaje en 5 días');
  assert.equal(p[0].hilo, 'clientes');
  assert.ok(p.every((x) => x.min > 0 && x.porque && x.accion?.label));
});
test('hilo del ítem y carga del día', () => {
  const areas = new Map([['a1', { hilo: 'ventas' }]]);
  assert.equal(hiloDe({ area_id: 'a1' }, areas), 'ventas');
  assert.equal(hiloDe({ cliente_key: 'pcel' }, areas), 'clientes');
  assert.equal(hiloDe({ origen: { hilo: 'personales' } }, areas), 'personales');
  assert.equal(hiloDe({}, areas), 'internos');
  const c = cargaDia({ itemsHoy: [{ duracion_min: 30 }, {}], propuestasAceptadas: [{ min: 40 }], reunionesMin: 90, horas: { armar: '09:00', pausa: '15:00', retomar: '17:00', cierre: '22:00' } });
  assert.equal(c.jornada, 11 * 60);
  assert.equal(c.total, 30 + 15 + 40 + 90);
  assert.equal(porHilo([{ cliente_key: 'pcel' }, { origen: { hilo: 'personales' } }], areas).map((h) => h.id).join(','), 'clientes,personales');
  assert.equal(HILOS.length, 4);
});
