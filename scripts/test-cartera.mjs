// Cartera · aging y DSO (src/lib/cartera.js): la única implementación que usan Cobranza general, Crédito y Cobranza del
// cliente (web y celular), el Home del cliente, Inicio y el Resumen de clientes. Cubre los casos de cada copia fusionada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAMOS, tramosCon, tramoDe, diasAtraso, diasParaVencer, dsoDe, dsoPonderado, agingDe, msDia, msUtc } from '../src/lib/cartera.js';

const ref = msDia('2026-09-27');
const det = [
  { referencia: 'F1', fecha_emision: '2026-06-01', vencimiento: '2026-08-01', saldo_actual: 200 },  // 57 d vencida
  { referencia: 'F2', fecha_emision: '2026-05-01', vencimiento: '2026-05-20', saldo_actual: 100 },  // 130 d
  { referencia: 'F3', fecha_emision: '2026-09-01', vencimiento: '2026-10-02', saldo_actual: 700 },  // vence en 5 d
  { referencia: 'F0', fecha_emision: '2026-09-01', vencimiento: '2026-10-02', saldo_actual: 0 },
];

test('tramoDe: fronteras 1–30 · 31–60 · 61–90 · +90', () => {
  assert.equal(tramoDe(0), null); assert.equal(tramoDe(-3), null); assert.equal(tramoDe(null), null);
  assert.equal(tramoDe(1), 'd0_30'); assert.equal(tramoDe(30), 'd0_30');
  assert.equal(tramoDe(31), 'd31_60'); assert.equal(tramoDe(60), 'd31_60');
  assert.equal(tramoDe(61), 'd61_90'); assert.equal(tramoDe(90), 'd61_90');
  assert.equal(tramoDe(91), 'mas90'); assert.equal(tramoDe(5000), 'mas90');
});

test('tramosCon: mismos límites y tonos con los ids y rótulos de cada pantalla', () => {
  const cliente = tramosCon({ ids: ['0_30', '31_60', '61_90', 'mas90'], labels: ['0–30 días', '31–60 días', '61–90 días', '+90 días'] });
  assert.deepEqual(cliente.map((t) => [t.min, t.max, t.tone]), TRAMOS.map((t) => [t.min, t.max, t.tone]));
  assert.equal(tramoDe(15, cliente), '0_30'); assert.equal(cliente[0].label, '0–30 días');
  const home = tramosCon({ ids: ['d1_30', 'd31_60', 'd61_90', 'mas90'] });
  assert.equal(tramoDe(30, home), 'd1_30'); assert.equal(tramoDe(31, home), 'd31_60');
  // Vista vieja de crédito: 5 tramos propios.
  const v1 = [{ id: 'a', min: 1, max: 90 }, { id: 'd91_180', min: 91, max: 180 }, { id: 'mas180', min: 181, max: Infinity }];
  assert.equal(tramoDe(180, v1), 'd91_180'); assert.equal(tramoDe(181, v1), 'mas180');
});

test('diasAtraso y diasParaVencer', () => {
  assert.equal(diasAtraso(det[0], ref), 57); assert.equal(diasAtraso(det[1], ref), 130);
  assert.equal(diasAtraso(det[2], ref), 0, 'no vencida = 0, nunca negativo');
  assert.equal(diasAtraso({ saldo_actual: 5 }, ref), 0, 'sin vencimiento = 0');
  assert.equal(diasParaVencer(det[2], ref), 5); assert.equal(diasParaVencer(det[0], ref), -57); assert.equal(diasParaVencer({}, ref), null);
  // Con hora del día en la referencia (Crédito y Cobranza usa «ahora»): sigue contando días completos.
  assert.equal(diasAtraso({ vencimiento: '2026-09-26' }, ref + 15 * 3600000), 1);
  assert.equal(diasAtraso({ vencimiento: '2026-09-27' }, ref + 15 * 3600000), 0);
});

test('agingDe: montos, número de facturas, peor atraso y totales', () => {
  const a = agingDe(det, ref);
  assert.equal(a.aging.d31_60.monto, 200); assert.equal(a.aging.mas90.monto, 100); assert.equal(a.aging.d0_30.monto, 0);
  assert.equal(a.aging.d31_60.n, 1); assert.equal(a.aging.mas90.maxDias, 130);
  assert.equal(a.total, 1000); assert.equal(a.vencido, 300); assert.equal(a.alDia, 700);
  assert.deepEqual(a.porTramo.mas90.map((f) => [f.referencia, f.dias, f.saldo]), [['F2', 130, 100]]);
  assert.deepEqual(agingDe([], ref).aging.mas90, { monto: 0, n: 0, maxDias: 0 });
});

test('dsoDe: edad ponderada por saldo (regla de Cobranza)', () => {
  assert.equal(dsoDe(det, ref), Math.round((200 * 118 + 100 * 149 + 700 * 26) / 1000));
  assert.equal(dsoDe([], ref), null);
  assert.equal(dsoDe([{ saldo_actual: 100 }], ref), null, 'sin fecha de emisión no cuenta');
  // Factura emitida después de la referencia: Cobranza la omite; el Resumen de clientes la cuenta con 0 días.
  const futura = [{ fecha_emision: '2026-09-17', saldo_actual: 100 }, { fecha_emision: '2026-10-05', saldo_actual: 100 }];
  assert.equal(dsoDe(futura, ref), 10);
  assert.equal(dsoDe(futura, ref, { futuras: 'cero' }), 5);
});

test('dsoDe con las opciones del Resumen de clientes (fechas en UTC, días redondeados, futuras en cero)', () => {
  const corte = '2026-09-27';
  const viejo = (rows) => { // copia literal de resumen/calculo.js antes de la fusión
    const t = new Date(corte).getTime(); let num = 0, den = 0;
    for (const r of rows) { if (!r.fecha_emision) continue; const d = Math.max(0, Math.round((t - new Date(r.fecha_emision).getTime()) / 86400000)); num += r.saldo_actual * d; den += r.saldo_actual; }
    return den > 0 ? Math.round(num / den) : null;
  };
  const rows = det.filter((r) => r.saldo_actual > 0).concat([{ fecha_emision: '2026-10-05', saldo_actual: 50 }]);
  assert.equal(dsoDe(rows, msUtc(corte), { leer: msUtc, redondeo: 'round', futuras: 'cero' }), viejo(rows));
});

test('dsoPonderado: Cobranza general e Inicio', () => {
  assert.equal(dsoPonderado([{ dso: 60, saldo: 100 }, { dso: 30, saldo: 300 }, { dso: null, saldo: 900 }]), 38);
  assert.equal(dsoPonderado([{ dso: null, saldo: 10 }]), null);
  assert.equal(dsoPonderado([{ dso: 50, saldo: 0 }, { dso: 20, saldo: 10 }], { soloConSaldo: true }), 20);
});

test('ninguna pantalla vuelve a escribir su propio aging o DSO', () => {
  const raiz = new URL('../src/', import.meta.url);
  const leer = (p) => readFileSync(new URL(p, raiz), 'utf8');
  for (const p of ['modules/comercial/cobranza/calculo.js', 'modules/comercial/CreditoCobranzaV2.jsx', 'modules/comercial/CreditoCobranza.jsx',
    'movil/pestanas/CobranzaCliente.jsx', 'modules/comercial/home/calc.js', 'modules/comercial/resumen/calculo.js', 'modules/general/inicio/calc.js']) {
    const s = leer(p);
    assert.match(s, /lib\/cartera\.js'/, `${p} importa src/lib/cartera.js`);
    assert.doesNotMatch(s, /num \+= .*\* ?d(ias)?\b.*den \+=/, `${p} no recalcula el DSO a mano`);
    assert.doesNotMatch(s, /<= 30 \?.*<= 60 \?.*<= 90/, `${p} no reparte tramos a mano`);
  }
});
