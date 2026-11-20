// Tránsito por PO y próximo arribo (src/lib/transito.js): única implementación. Fija la regla común y las opciones con
// que cada pantalla conserva su comportamiento, y compara contra las copias literales anteriores a la fusión (2026-11-20).
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agruparTransitoPorPO, proximoEmbarque, embarquesPendientes, llegadasDe, mapaTransito, diasA, isoDia } from '../src/lib/transito.js';
import { agruparPorPO } from '../src/modules/comercial/inventario/arribos.js';
import { arribosPorPo, llegadasDe as llegadasSop } from '../src/modules/comercial/forecast/sopCalculo.js';

const HOY = new Date(2026, 9, 15); // 15-oct-2026
const filas = [
  { sku: 'AC-1', supplier: 'Prov A', cantidad: 300, eta_mas_cercana: '2026-10-01', embarques_detalle: [
    { po: 'PO-1', eta: '2026-10-20', etd: '2026-09-10', cantidad: 100, estatus: 'TRANSITO MARITIMO', cedis: 'GDL', contenedor: 'C1' },
    { po: 'PO-2', eta: '2026-10-01', etd: '2026-08-20', cantidad: 200, estatus: '', cedis: '', contenedor: '' },
    { po: 'PO-0', eta: '2026-11-05', cantidad: 0, estatus: 'EN PRODUCCION' },
  ] },
  { sku: 'AC-2', supplier: 'Prov B', cantidad: 80, embarques_detalle: [
    { po: 'PO-1', eta: '2026-10-18', etd: '2026-09-12', cantidad: 50, estatus: 'TRANSITO MARITIMO', cedis: 'GDL', contenedor: 'C1' },
    { po: 'PO-2', eta: '2026-10-03', cantidad: 30, estatus: 'EN RESGUARDO', cedis: 'CDMX', contenedor: 'C2' },
    { po: null, eta: '2026-12-01', cantidad: 40, estatus: 'EN PRODUCCION' },
    { po: 'PO-3', eta: null, cantidad: 25, estatus: 'EN PRODUCCION' },
    { po: 'PO-4', eta: '2026-10-18', cantidad: 500, estatus: 'PROXIMO A ZARPAR' },
  ] },
  { sku: 'AC-3', cantidad: 5, embarques_detalle: null },
];

test('agruparTransitoPorPO: regla común', () => {
  const pos = agruparTransitoPorPO(filas, { hoy: HOY });
  assert.deepEqual(pos.map((p) => p.po), ['PO-2', 'PO-4', 'PO-1', 'PO-3'], 'por ETA; misma ETA → más piezas; sin fecha al final');
  const po1 = pos.find((p) => p.po === 'PO-1'), po2 = pos.find((p) => p.po === 'PO-2'), po3 = pos.find((p) => p.po === 'PO-3');
  assert.equal(po1.eta, '2026-10-18', 'ETA de la PO = la más temprana'); assert.equal(po1.etd, '2026-09-10'); assert.equal(po1.piezas, 150);
  assert.equal(po1.skusDistintos, 2); assert.equal(po1.renglones, 2); assert.equal(po1.vencida, false); assert.equal(po1.dias, 3);
  assert.equal(po2.vencida, true); assert.equal(po2.dias, -14); assert.equal(po2.piezas, 230);
  assert.equal(po2.estatus, 'EN RESGUARDO', 'estatus del primer renglón que lo trae'); assert.equal(po2.cedis, 'CDMX'); assert.equal(po2.contenedor, 'C2');
  assert.equal(po3.vencida, false); assert.equal(po3.dias, null);
  assert.ok(!pos.some((p) => p.po === 'PO-0' || p.po === 'sin PO'), 'fuera: sin piezas y sin PO');
  // Una ETA igual a hoy no está vencida.
  assert.equal(agruparTransitoPorPO([{ sku: 'X', embarques_detalle: [{ po: 'P', eta: '2026-10-15', cantidad: 1 }] }], { hoy: HOY })[0].vencida, false);
  assert.equal(diasA('2026-10-15', isoDia(HOY)), 0); assert.equal(isoDia('2026-10-15T08:00:00'), '2026-10-15');
});

test('opciones que conservan cada pantalla', () => {
  // Inventario › Próximos arribos: estatus/CEDIS del primer renglón aunque venga vacío.
  const primera = agruparTransitoPorPO(filas, { hoy: HOY, cabecera: 'primera' }).find((p) => p.po === 'PO-2');
  assert.equal(primera.estatus, ''); assert.equal(primera.cedis, ''); assert.equal(primera.contenedor, 'C2', 'el contenedor sí se completa');
  // Inicio: cuenta renglones sin PO y sin piezas; misma ETA → orden de llegada.
  const inicio = agruparTransitoPorPO(filas, { hoy: HOY, exigirPo: false, exigirCantidad: false, cabecera: 'primera', desempate: null });
  assert.deepEqual(inicio.map((p) => p.po), ['PO-2', 'PO-1', 'PO-4', 'PO-0', 'sin PO', 'PO-3']);
  assert.equal(inicio.find((p) => p.po === 'sin PO').piezas, 40); assert.equal(inicio.find((p) => p.po === 'PO-0').piezas, 0);
});

test('Inicio: mismas POs que la copia anterior (literal)', () => {
  const N = (v) => Number(v) || 0;
  const costo = { 'AC-1': 10, 'AC-2': 2 };
  const pos = {};
  filas.forEach((r) => { const c = N(costo[r.sku]); (Array.isArray(r.embarques_detalle) ? r.embarques_detalle : []).forEach((e) => { const k = e.po || 'sin PO'; const o = pos[k] || (pos[k] = { po: k, eta: e.eta || null, piezas: 0, valor: 0, skus: new Set() }); o.piezas += N(e.cantidad); o.valor += N(e.cantidad) * c; o.skus.add(r.sku); if (e.eta && (!o.eta || e.eta < o.eta)) o.eta = e.eta; }); });
  const viejo = Object.values(pos).map((o) => ({ ...o, skus: o.skus.size })).sort((a, b) => String(a.eta || '9').localeCompare(String(b.eta || '9')));
  const nuevo = agruparTransitoPorPO(filas, { hoy: HOY, exigirPo: false, exigirCantidad: false, cabecera: 'primera', desempate: null, alCrear: () => ({ valor: 0 }), porRenglon: (o, { sku, piezas }) => { o.valor += piezas * N(costo[sku]); } })
    .map((o) => ({ po: o.po, eta: o.eta, piezas: o.piezas, valor: o.valor, skus: o.skusDistintos }));
  assert.deepEqual(nuevo, viejo);
});

test('Inventario y S&OP agrupan igual (misma PO, ETA, piezas, orden); sólo difiere de dónde sale el estatus', () => {
  const inv = agruparPorPO({ transito: mapaTransito(filas), hoy: HOY });
  const sop = arribosPorPo({ transito: filas, hoy: HOY });
  const base = (l) => l.map((p) => [p.po, p.eta, p.etd, p.piezas, p.nSkus, p.dias, p.contenedor]);
  assert.deepEqual(base(inv), base(sop));
  assert.deepEqual(sop.map((p) => p.vencida), [true, false, false, false]);
  assert.equal(sop.find((p) => p.po === 'PO-2').estatus, 'EN RESGUARDO');
  // En Inventario el Map viene ordenado por ETA dentro de cada SKU: el primer renglón de PO-2 es el de AC-1 (vacío).
  assert.equal(inv.find((p) => p.po === 'PO-2').estatus, '');
  assert.equal(inv.find((p) => p.po === 'PO-1').diasEnTransito, 35);
});

test('proximoEmbarque: ≥ hoy; si todo venció, el primero con fecha; null sin fechas', () => {
  const viejo = (detalle, hoy) => { const det = (Array.isArray(detalle) ? detalle : []).filter((e) => Number(e.cantidad) > 0).sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999'))); return det.find((e) => e.eta && e.eta >= hoy) || det.find((e) => e.eta) || null; };
  const viejoPropuestas = (detalle, hoy) => { const det = (Array.isArray(detalle) ? detalle : []).filter((d) => d?.eta).sort((a, b) => String(a.eta).localeCompare(String(b.eta))); return det.find((d) => String(d.eta) >= hoy) || det[0]; };
  for (const hoy of ['2026-09-01', '2026-10-02', '2026-10-15', '2026-10-19', '2026-11-01', '2026-11-06', '2027-01-01']) {
    for (const f of filas) {
      assert.deepEqual(proximoEmbarque(f.embarques_detalle, hoy), viejo(f.embarques_detalle, hoy), `${f.sku} ${hoy}`);
      assert.deepEqual(proximoEmbarque(f.embarques_detalle, hoy, { exigirCantidad: false }) || undefined, viejoPropuestas(f.embarques_detalle, hoy), `propuestas ${f.sku} ${hoy}`);
    }
  }
  assert.equal(proximoEmbarque(filas[0].embarques_detalle, HOY).po, 'PO-1');
  assert.equal(proximoEmbarque(filas[0].embarques_detalle, '2026-10-21').po, 'PO-2', 'todo vencido → el primero con fecha');
  // Diferencia conservada: Propuestas también cuenta el renglón sin piezas (PO-0, 5-nov).
  assert.equal(proximoEmbarque(filas[0].embarques_detalle, '2026-10-21', { exigirCantidad: false }).po, 'PO-0');
  assert.equal(proximoEmbarque([{ po: 'P', cantidad: 5 }], HOY), null); assert.equal(proximoEmbarque(null, HOY), null);
  assert.equal(embarquesPendientes(filas[1].embarques_detalle).length, 5);
});

test('llegadasDe y mapaTransito', () => {
  const ll = llegadasDe(filas);
  assert.equal(ll.length, 6, 'con PO y piezas > 0'); assert.deepEqual(ll[0], { sku: 'AC-1', po: 'PO-1', eta: '2026-10-20', cantidad: 100 });
  assert.equal(llegadasSop, llegadasDe, 'sopCalculo reexporta la misma función');
  const m = mapaTransito(filas);
  assert.equal(m.get('AC-1').cantidad, 300); assert.equal(m.get('AC-1').eta, '2026-10-01');
  assert.deepEqual(m.get('AC-1').pos.map((p) => p.po), ['PO-2', 'PO-1', 'PO-0'], 'por ETA');
  assert.equal(m.get('AC-3').pos.length, 0);
});

test('nadie vuelve a agrupar el tránsito a mano', () => {
  const leer = (p) => readFileSync(new URL(`../src/${p}`, import.meta.url), 'utf8');
  for (const p of ['modules/comercial/inventario/arribos.js', 'modules/comercial/forecast/sopCalculo.js', 'modules/general/inicio/calc.js', 'modules/comercial/forecast/sopDatos.js',
    'modules/comercial/forecast/MisClientesPanel.jsx', 'modules/comercial/inventario/useInventarioDatos.js', 'movil/pestanas/inventario/datos.js', 'movil/datos.js',
    'modules/comercial/sellin/DrillSku.jsx', 'modules/comercial/precios/calculo.js', 'modules/comercial/inventario/compartir.js', 'modules/comercial/propuestas/datos.js']) {
    const s = leer(p);
    assert.match(s, /lib\/transito\.js'/, `${p} usa src/lib/transito.js`);
    assert.doesNotMatch(s, /embarques_detalle : \[\]\)\.(filter|forEach)\(/, `${p} no recorre embarques_detalle a mano`);
    assert.doesNotMatch(s, /\.find\(\(e\) => e\.eta && e\.eta >= hoy\)/, `${p} no busca el próximo arribo a mano`);
  }
});
