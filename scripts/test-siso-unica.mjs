// Serie «sell in vs sell out del año»: una sola (analisis/siso.js#serieSiSoAnio). El celular (calculoLista.js#serieAnioSiSo)
// es un envoltorio. Compara contra la copia literal del celular anterior a la fusión (2026-11-20).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'vite';
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
test.after(async () => { await vite.close(); setTimeout(() => process.exit(process.exitCode || 0), 200).unref(); });
const { serieSiSoAnio } = await vite.ssrLoadModule('/src/modules/comercial/analisis/siso.js');
const { serieAnioSiSo } = await vite.ssrLoadModule('/src/modules/comercial/analisis/calculoLista.js');
const { idxMes, mapaCuotas, cuotaPeriodo, MESES } = await vite.ssrLoadModule('/src/modules/comercial/analisis/calc.js');

const N = (v) => Number(v) || 0;
const mensual = new Map();
for (let m = 1; m <= 10; m += 1) mensual.set(idxMes(2026, m), { fact_neta: m * 1e6 });
for (let m = 1; m <= 12; m += 1) mensual.set(idxMes(2025, m), { fact_neta: 5e5 * m });
const so = [
  ...Array.from({ length: 10 }, (_, i) => ({ cuenta: 'cva', anio: 2026, mes: i + 1, importe: 2e6 + i })),
  { cuenta: 'cva', anio: 2026, mes: 3, importe: 7e5 },   // fila repetida en marzo
  { cuenta: 'otra', anio: 2026, mes: 3, importe: 9e9 },
];
const mapa = mapaCuotas(Array.from({ length: 12 }, (_, i) => ({ cliente_erp: '00417', anio: 2026, mes: i + 1, cuota_venta: i === 4 ? 0 : 3e6 })));

function viejoCelular({ mensual, soMensual = [], cuenta, mapa, codigo, anio, hoy }) {
  const limite = anio === hoy.getFullYear() ? hoy.getMonth() + 1 : anio < hoy.getFullYear() ? 12 : 0;
  return MESES.map((label, i) => {
    const m = i + 1, futuro = m > limite;
    const si = futuro ? null : N(mensual?.get?.(idxMes(anio, m))?.fact_neta);
    const soRow = cuenta ? soMensual.find((r) => r.cuenta === cuenta && N(r.anio) === anio && N(r.mes) === m) : null;
    const so = futuro || !cuenta ? null : N(soRow?.importe);
    const cuota = mapa ? cuotaPeriodo(mapa, codigo, anio, m, 'mes') : null;
    return { label, mes: m, si, so, cuota: cuota == null ? null : cuota, soSi: si && so != null && si > 0 ? so / si : null, enCurso: !futuro && m === limite && anio === hoy.getFullYear() };
  });
}

test('el celular da exactamente lo de antes (año en curso, cerrado, futuro, sin cuenta, sin cuotas)', () => {
  for (const hoy of [new Date(2026, 9, 6), new Date(2026, 0, 2), new Date(2027, 2, 1), new Date(2025, 5, 1)]) {
    for (const [cuenta, m, codigo] of [['cva', mapa, '00417'], [null, mapa, '00417'], ['cva', null, '00417'], ['nadie', mapa, null], ['cva', mapa, '99999']]) {
      const args = { mensual, soMensual: so, cuenta, mapa: m, codigo, anio: 2026, hoy };
      assert.deepEqual(serieAnioSiSo(args), viejoCelular(args), `${hoy.toISOString().slice(0, 10)} ${cuenta} ${codigo}`);
    }
  }
});

test('web y celular: mismas cifras mes a mes; sólo difieren en la fila repetida (web suma, celular toma la primera)', () => {
  const web = serieSiSoAnio({ mensual, mensualSO: so, cuenta: 'cva', cuotas: mapa, cliente: '00417', anio: 2026, hastaMes: 10 });
  const cel = serieAnioSiSo({ mensual, soMensual: so, cuenta: 'cva', mapa, codigo: '00417', anio: 2026, hoy: new Date(2026, 9, 6) });
  for (let i = 0; i < 12; i += 1) {
    assert.equal(cel[i].si, web[i].sellIn); assert.equal(cel[i].cuota, web[i].cuota); assert.equal(cel[i].label, web[i].x);
    if (i !== 2) assert.equal(cel[i].so, web[i].sellOut);
  }
  assert.equal(web[2].sellOut, 2e6 + 2 + 7e5); assert.equal(cel[2].so, 2e6 + 2);
  assert.equal(web[10].sellIn, null); assert.equal(web[11].anterior, 6e6); assert.equal(web[4].cuota, 0);
});

test('el celular ya no arma la serie por su cuenta', () => {
  const s = readFileSync(new URL('../src/modules/comercial/analisis/calculoLista.js', import.meta.url), 'utf8');
  assert.match(s, /return serieSiSoAnio\(/);
});
