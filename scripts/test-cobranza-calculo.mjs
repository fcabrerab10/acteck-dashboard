import test from 'node:test';
import assert from 'node:assert/strict';
import { resumirCliente, consolidar, fraseCobranza, dsoDe } from '../src/modules/comercial/cobranza/calculo.js';

const cortes = [
  { id: 2, fecha_corte: '2026-09-27', saldo_actual: 1000, saldo_vencido: 300, tipo_cambio: 18, linea_credito_usd: 100 },
  { id: 1, fecha_corte: '2026-09-20', saldo_actual: 900, saldo_vencido: 100 },
];
const det = [
  { estado_cuenta_id: 2, referencia: 'F1', fecha_emision: '2026-06-01', vencimiento: '2026-08-01', saldo_actual: 200 },  // 57 d vencida
  { estado_cuenta_id: 2, referencia: 'F2', fecha_emision: '2026-05-01', vencimiento: '2026-05-20', saldo_actual: 100 },  // 130 d
  { estado_cuenta_id: 2, referencia: 'F3', fecha_emision: '2026-09-01', vencimiento: '2026-10-02', saldo_actual: 700 },  // vence en 5 d
  { estado_cuenta_id: 2, referencia: 'F0', fecha_emision: '2026-09-01', vencimiento: '2026-10-02', saldo_actual: 0 },
];
test('resumirCliente: aging, dso, línea, por vencer, deltas', () => {
  const c = resumirCliente('digitalife', cortes, det, { plazo_dias_credito: 60 });
  assert.equal(c.saldo, 1000); assert.equal(c.vencido, 300); assert.equal(c.pctVencido, 30);
  assert.equal(c.aging.d31_60.monto, 200); assert.equal(c.aging.mas90.monto, 100); assert.equal(c.aging.d0_30.monto, 0);
  assert.equal(c.nVencidas, 2); assert.equal(c.nFacturas, 3);
  assert.equal(c.porVencer7, 700); assert.equal(c.porVencer30, 700);
  assert.equal(c.lineaMxn, 1800); assert.ok(Math.abs(c.usoLinea - 55.56) < 0.1);
  assert.equal(c.dSaldo, 100); assert.equal(c.dVencido, 200); assert.equal(c.plazo, 60);
  assert.equal(c.facturas[0].referencia, 'F2', 'ordena por días de atraso');
  assert.equal(dsoDe(det.filter((d) => d.saldo_actual > 0), new Date('2026-09-27T00:00:00').getTime()), Math.round((200 * 118 + 100 * 149 + 700 * 26) / 1000));
});
test('consolidar y frase', () => {
  const a = resumirCliente('digitalife', cortes, det, null);
  const b = resumirCliente('pcel', [{ id: 9, fecha_corte: '2026-09-27', saldo_actual: 500, saldo_vencido: 0 }], [], null);
  const c = resumirCliente('dicotech', [], [], null);
  const t = consolidar([a, b, c]);
  assert.equal(t.saldo, 1500); assert.equal(t.vencido, 300); assert.equal(t.nVencidas, 2); assert.equal(t.peor.key, 'digitalife');
  assert.equal(t.serie.length, 1, 'sólo cortes que tienen los clientes con datos');
  assert.equal(t.corte, '2026-09-27'); assert.equal(t.porVencer7, 700);
  assert.match(fraseCobranza(t, (n) => `$${n}`), /\$300 vencidos \(20 % de \$1500\) · Digitalife concentra \$300/);
});
