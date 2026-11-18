// Congruencia web ↔ celular (2026-11-18): tres bloques que existían en la web y faltaban en el celular.
//   1) Pagos global: secciones Cálculo · Marketing · Reglas y «＋ Pago manual» (movil/pestanas/pagos/SeccionesM.jsx)
//   2) Agenda › Más: Semana · Ideas · Equipo (movil/pestanas/agenda5/MasVistasM.jsx)
//   3) Inicio en tarjetas que se eligen y acomodan (movil/pestanas/inicio/InicioTarjetasM.jsx)
// Motores compartidos (puros): pagosv3/calculoPanel.js, agenda5/vistas.js, general/inicio/tarjetas.js.
//   node --test scripts/test-congruencia-movil-3.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
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
// Todos los módulos se cargan ANTES del primer test (el corredor arranca en cuanto hay tests registrados).
const tj = await vite.ssrLoadModule('/src/modules/general/inicio/tarjetas.js');
const { TarjetasVista, CatalogoVista } = await vite.ssrLoadModule('/src/movil/pestanas/inicio/InicioTarjetasM.jsx');
const av = await vite.ssrLoadModule('/src/modules/agenda5/vistas.js');
const { SemanaVista, IdeasVista, EquipoVista } = await vite.ssrLoadModule('/src/movil/pestanas/agenda5/MasVistasM.jsx');
const cp = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/calculoPanel.js');
const { REGLAS_DEFAULT } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/reglas.js');
const pd = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/datos.js');
const { CalculoVista, MarketingVista, ReglasVista, PagoManualVista } = await vite.ssrLoadModule('/src/movil/pestanas/pagos/SeccionesM.jsx');

const qc = new QueryClient();
const nav = { modo: 'barra', perfil: { user_id: 'u-f', es_super_admin: true }, push() {}, pop() {}, navegar() {} };
const render = (C, props, themeKey = 'midnight') => renderToString(React.createElement(QueryClientProvider, { client: qc },
  React.createElement(ThemeContext.Provider, { value: { theme: getTheme(themeKey), setThemeKey() {} } },
    React.createElement(NavContext.Provider, { value: nav }, React.createElement(C, props))))).replace(/<!--.*?-->/g, '');
const sano = (s, donde) => assert.ok(!/NaN|undefined|\[object Object\]/.test(s), `${donde}: NaN/undefined/[object Object] en el HTML`);
const RAIZ = path.resolve(import.meta.dirname, '..');
const leer = (p) => fs.readFileSync(path.join(RAIZ, p), 'utf8');

// ───────────────────────── 3 · Inicio en tarjetas ─────────────────────────

const serie = Array.from({ length: 12 }, (_, i) => ({ fn: 40e6 + i * 1e6, mc: 18 + i * 0.2 }));
const R = (extra = {}) => ({
  modo: 'mes', sensible: true, yoy: -12, yoyLabel: 'vs nov 2025', pctCuota: 73, cuotaPeriodo: 60e6, dMc: 1.2, serie, pctOtro: 81,
  cur: { fact_neta: 43.8e6, mc: 19.1, contribucion: 8.4e6 }, otro: { fact_neta: 512e6 },
  sellOut: { total: 91e6, yoy: 150, soSi: 1.94, serie: serie.map((m) => ({ so: m.fn * 1.5 })) },
  inv: { valor: 143.3e6, cobertura: 141, piezas: 709653 },
  enCamino: { valor: 60e6, pos: 9, porMes: [{ key: '2026-11', label: 'Nov 2026', valor: 25.8e6, pos: 4 }], proximos: [{ eta: '2026-11-21' }], atrasados: { pos: 2 } },
  cartera: { saldo: 38e6, vencido: 4.1e6, pctVencido: 11, dso: 62 },
  decision: [{ titulo: 'Pago por autorizar hace 6 días', severidad: 'critica' }, { titulo: 'Fondo de PCEL en negativo', severidad: 'alta' }],
  agenda: [{ titulo: 'Arribo PO ABT278', fecha: '2026-11-20' }],
  ...extra,
});
const VE = { inventario: true, cobranza: true };

test('tarjetas · catálogo compartido: respeta permisos y el orden guardado', () => {
  const todas = tj.catalogo({ r: R(), ve: VE, anio: 2026, labelPeriodo: 'Nov 2026' });
  assert.deepEqual(todas.map((t) => t.id).sort(), [...tj.ORDEN_DEFAULT].sort());
  assert.equal(todas.find((t) => t.id === 'cuota').tam, 'g');
  // Sin permiso sensible no hay tarjeta de margen; sin inventario/cobranza tampoco las suyas.
  const sin = tj.catalogo({ r: R({ sensible: false }), ve: { inventario: false, cobranza: false }, anio: 2026, labelPeriodo: 'Nov 2026' }).map((t) => t.id);
  for (const id of ['margen', 'inventario', 'camino', 'cartera']) assert.ok(!sin.includes(id), `${id} no debe salir`);
  // Orden: default → guardado → local (arrastre); ids desconocidos o repetidos se descartan.
  assert.deepEqual(tj.idsVisibles(todas, null), tj.ORDEN_DEFAULT);
  assert.deepEqual(tj.idsVisibles(todas, ['sellout', 'viejo', 'cuota', 'sellout']), ['sellout', 'cuota']);
  assert.deepEqual(tj.idsVisibles(todas, ['sellout', 'cuota'], ['cuota', 'sellout']), ['cuota', 'sellout']);
  assert.deepEqual(tj.idsVisibles(todas, []), [], 'una selección vacía se respeta (no vuelve al default)');
  assert.deepEqual(tj.tarjetasFuera(todas, ['cuota']).map((t) => t.id).includes('cuota'), false);
  assert.equal(tj.tarjetasFuera(todas, ['cuota']).length, todas.length - 1);
});

test('tarjetas · moverTarjeta reordena como al arrastrar', () => {
  assert.deepEqual(tj.moverTarjeta(['a', 'b', 'c', 'd'], 'a', 'c'), ['b', 'c', 'a', 'd']);
  assert.deepEqual(tj.moverTarjeta(['a', 'b', 'c', 'd'], 'd', 'a'), ['d', 'a', 'b', 'c']);
  assert.deepEqual(tj.moverTarjeta(['a', 'b'], 'a', 'a'), ['a', 'b']);
  assert.deepEqual(tj.moverTarjeta(['a', 'b'], 'x', 'a'), ['a', 'b']);
});

test('tarjetas · SSR celular: rejilla de 2 columnas, modo edición con «−», Agregar y Restablecer', () => {
  const todas = tj.catalogo({ r: R(), ve: VE, anio: 2026, labelPeriodo: 'Nov 2026' });
  const ids = ['cuota', 'sellin', 'sellout', 'anio', 'decidir'];
  const visibles = ids.map((id) => todas.find((t) => t.id === id));
  const fuera = tj.tarjetasFuera(todas, ids);
  for (const tema of ['midnight', 'light']) {
    const html = render(TarjetasVista, { visibles, fuera, editando: false, hayGuardadas: true }, tema);
    sano(html, `tarjetas ${tema}`);
    assert.match(html, /repeat\(2, ?minmax\(0, ?1fr\)\)/);
    assert.match(html, /73 %/); assert.match(html, /Editar/); assert.match(html, /Ver página/);
    assert.ok(!/Quitar /.test(html), 'sin «−» fuera de edición');
    assert.equal((html.match(/data-tarjeta=/g) || []).length, 5);
  }
  const ed = render(TarjetasVista, { visibles, fuera, editando: true, hayGuardadas: true });
  sano(ed, 'tarjetas editando');
  assert.equal((ed.match(/aria-label="Quitar /g) || []).length, 5);
  assert.match(ed, /Listo/); assert.match(ed, /Agregar/); assert.match(ed, /Restablecer/); assert.match(ed, /tarjeta-tiembla/);
  assert.match(ed, /touch-action:none/);
  const vacio = render(TarjetasVista, { visibles: [], fuera: todas, editando: false });
  assert.match(vacio, /Sin tarjetas/);
  const cat = render(CatalogoVista, { fuera });
  sano(cat, 'catálogo');
  for (const t of fuera) assert.ok(cat.includes(t.label.replace(/&/g, '&amp;')), `catálogo lista ${t.label}`);
  assert.match(render(CatalogoVista, { fuera: [] }), /Ya están todas/);
});

test('tarjetas · el Inicio del celular carga el modo tarjetas con lazy y sigue la preferencia por dispositivo', () => {
  const src = leer('src/movil/pestanas/Inicio.jsx');
  assert.match(src, /lazy\(\(\) => import\('\.\/inicio\/InicioTarjetasM'\)\)/);
  assert.ok(!/from '\.\/inicio\/InicioTarjetasM'/.test(src), 'nunca import estático');
  assert.ok(!/inicio\/tarjetas'/.test(src), 'el catálogo no entra al chunk de Inicio');
  assert.match(src, /sensible && prefsDisp\.inicio === 'tarjetas'/);
  // La web y el celular leen el catálogo del mismo módulo.
  assert.match(leer('src/modules/general/inicio/InicioTarjetas.jsx'), /from '\.\/tarjetas'/);
});

// ───────────────────────── 2 · Agenda › Más ─────────────────────────

const HOY = new Date(2026, 10, 18, 12); // miércoles 18 nov 2026
const it = (o) => ({ estado: 'abierta', tipo: 'tarea', propietario: 'u-f', responsables: ['u-f'], bandeja: false, created_at: '2026-11-10T10:00:00', ...o });
const D = {
  items: [
    it({ id: 1, titulo: 'Llamar a CVA', cuando: '2026-11-18', duracion_min: 30 }),
    it({ id: 2, titulo: 'Cerrar propuesta Digitalife', cuando: '2026-11-18', estado: 'hecha', completado_en: '2026-11-18T11:00:00', min_real: 45, area_id: 'a1' }),
    it({ id: 3, titulo: 'Revisar cuotas', cuando: '2026-11-16', estado: 'hecha', completado_en: '2026-11-16T09:00:00', duracion_min: 20 }),
    it({ id: 4, titulo: 'Mandar forecast', cuando: '2026-11-20' }),
    it({ id: 5, titulo: 'Atrasado de la semana pasada', cuando: '2026-11-12' }),
    it({ id: 6, titulo: 'Tienda piloto en Monterrey', tipo: 'idea', created_at: '2026-11-15T10:00:00' }),
    it({ id: 7, titulo: 'Bundle gamer para Buen Fin', tipo: 'idea', cuando: null, created_at: '2026-11-17T10:00:00', cliente_key: 'pcel' }),
    it({ id: 8, titulo: 'Idea en bandeja', tipo: 'idea', bandeja: true }),
    it({ id: 9, titulo: 'Acuerdo vencido con PCEL', tipo: 'punto', fecha_limite: '2026-11-10' }),
    it({ id: 10, titulo: 'Cuadrar apoyos', cuando: '2026-11-18', propietario: 'u-k', responsables: ['u-k'] }),
    it({ id: 11, titulo: 'Solicitar pagos', cuando: '2026-11-14', propietario: 'u-k', responsables: ['u-k'] }),
  ],
  reuniones: [{ id: 'r1', titulo: 'Junta Digitalife', fecha: '2026-11-19', duracion_min: 60, tipo: 'reunion' }],
  google: [], cuentas: [],
  areas: [{ id: 'a1', nombre: 'Mis clientes' }],
  objetivos: [
    { id: 'o1', usuario: 'u-f', semana: '2026-11-16', texto: 'Cerrar Buen Fin con PCEL', cumplido: true, orden: 1 },
    { id: 'o2', usuario: 'u-f', semana: '2026-11-16', texto: 'Forecast de diciembre', cumplido: false, orden: 2 },
    { id: 'o3', usuario: 'u-f', semana: '2026-11-09', texto: 'De la semana pasada', cumplido: false },
    { id: 'o4', usuario: 'u-k', semana: '2026-11-16', texto: 'De Karolina', cumplido: false },
  ],
  checkins: [{ usuario: 'u-k', fecha: '2026-11-18', tipo: 'dia', respuesta: 'Cuadré apoyos de Digitalife' }],
};
const PERSONAS = [{ user_id: 'u-f', nombre: 'Fernando Cabrera', es_super_admin: true }, { user_id: 'u-k', nombre: 'Karolina Ruiz' }];

test('agenda · semanaDe: carga por día, objetivos de ESA semana y qué revisar', () => {
  const s = av.semanaDe(D, 'u-f', { hoy: HOY });
  assert.equal(s.semanaIso, '2026-11-16');
  assert.deepEqual(s.dias.map((x) => x.iso), ['2026-11-16', '2026-11-17', '2026-11-18', '2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22']);
  const mie = s.dias[2]; assert.ok(mie.esHoy); assert.equal(mie.hechas, 1); assert.equal(mie.abiertas, 1);
  assert.equal(s.dias[0].hechas, 1); assert.equal(s.dias[3].reuniones, 1); assert.equal(s.dias[4].abiertas, 1);
  assert.equal(s.totHechas, 2); assert.equal(s.totMin, 45);
  assert.deepEqual(s.objetivos.map((o) => o.id), ['o1', 'o2']); assert.equal(s.cumplidos, 1);
  assert.deepEqual(s.acuerdosVencidos.map((x) => x.id), [9]);
  assert.deepEqual(s.porArea, [['Mis clientes', 45], ['Sin área', 20]]);
  // Otra semana: sus propios objetivos.
  const ant = av.semanaDe(D, 'u-f', { hoy: HOY, ref: new Date(2026, 10, 11, 12) });
  assert.equal(ant.semanaIso, '2026-11-09'); assert.deepEqual(ant.objetivos.map((o) => o.id), ['o3']);
  assert.equal(av.lunesDe(new Date(2026, 10, 22, 12)).getDate(), 16, 'el domingo pertenece a la semana que empezó el lunes');
});

test('agenda · ideasDe y equipoDe', () => {
  assert.deepEqual(av.ideasDe(D.items, 'u-f').map((x) => x.id), [7, 6], 'la más nueva primero, sin las de bandeja');
  assert.deepEqual(av.parchePromoverIdea('2026-11-18'), { tipo: 'tarea', cuando: '2026-11-18', promovido_a: null });
  const eq = av.equipoDe(D, PERSONAS, HOY);
  const k = eq.find((x) => x.persona.user_id === 'u-k');
  assert.equal(k.abiertas, 1); assert.equal(k.atrasadas, 1); assert.equal(k.checkin.respuesta, 'Cuadré apoyos de Digitalife');
  assert.equal(eq.find((x) => x.persona.user_id === 'u-f').checkin, null);
});

test('agenda · SSR celular de Semana, Ideas y Equipo (con y sin permiso de edición)', () => {
  const sem = av.semanaDe(D, 'u-f', { hoy: HOY });
  const h = render(SemanaVista, { sem, puedeEditar: true, esSemanaActual: true, nuevo: '' });
  sano(h, 'Semana');
  for (const t of ['16 nov – 22 nov', 'Carga por día', 'Objetivos de la semana', 'Cerrar Buen Fin con PCEL', '1 de 2', 'Nuevo objetivo…', 'Acuerdo vencido con PCEL', 'Tiempo por área', 'Semana anterior']) assert.ok(h.includes(t), `Semana: falta «${t}»`);
  assert.equal((h.match(/aria-label="Quitar objetivo"/g) || []).length, 2);
  const lect = render(SemanaVista, { sem, puedeEditar: false });
  assert.ok(!lect.includes('Nuevo objetivo…') && !lect.includes('Quitar objetivo'), 'sólo lectura: sin captura ni quitar');

  const ideas = av.ideasDe(D.items, 'u-f');
  const hi = render(IdeasVista, { ideas, puedeEditar: true, texto: '' });
  sano(hi, 'Ideas');
  for (const t of ['Bundle gamer para Buen Fin', 'Tienda piloto en Monterrey', '→ Hoy', '→ Pendiente', 'Guardar']) assert.ok(hi.includes(t), `Ideas: falta «${t}»`);
  assert.ok(!hi.includes('Idea en bandeja'));
  const hil = render(IdeasVista, { ideas, puedeEditar: false });
  assert.ok(!hil.includes('→ Hoy') && !hil.includes('Guardar'));
  assert.match(render(IdeasVista, { ideas: [], puedeEditar: true }), /Sin ideas guardadas/);

  const he = render(EquipoVista, { equipo: av.equipoDe(D, PERSONAS, HOY), uid: 'u-f', miCheckin: '', puedeCheckin: true, onVerAgenda() {} });
  sano(he, 'Equipo');
  for (const t of ['Mi check-in de hoy', 'Karolina Ruiz', 'Cuadré apoyos de Digitalife', '1 atrasada', 'Ver agenda de Karolina', 'Fernando Cabrera (yo)', 'Sin check-in hoy.']) assert.ok(he.includes(t), `Equipo: falta «${t}»`);
  assert.ok(!he.includes('Ver agenda de Fernando'), 'no hay «ver agenda» de uno mismo');
});

test('agenda · AgendaM: Semana, Ideas y Equipo en «Más», perezosas, y Equipo sólo si ve a alguien más', () => {
  const src = leer('src/movil/pestanas/agenda5/AgendaM.jsx');
  for (const id of ['semana', 'ideas', 'equipo']) assert.match(src, new RegExp(`\\{ id: '${id}', label:`));
  assert.match(src, /const verEquipo = visibles\.length > 1/);
  assert.match(src, /vista === 'equipo' && verEquipo/);
  assert.ok(!/from '\.\/MasVistasM'/.test(src), 'MasVistasM sólo con lazy()');
  assert.match(src, /puedeVerPaginaGlobal\(perfil, 'agenda'\)/, 'mismo permiso de siempre');
  // La web usa el mismo motor.
  assert.match(leer('src/modules/agenda5/Agenda5.jsx'), /from '\.\/vistas'/);
});

// ───────────────────────── 1 · Pagos: Cálculo · Marketing · Reglas · Pago manual ─────────────────────────

const per = (m) => `2026-${String(m).padStart(2, '0')}`;
const DATOS_MOTOR = {
  sellInMes: { pcel: { [per(10)]: 4.2e6, [per(11)]: 3.9e6, [per(12)]: 0 }, dicotech: { [per(11)]: 1.5e6 } },
  cuotaMes: { pcel: { [per(10)]: 4e6, [per(11)]: 4e6, [per(12)]: 4e6 }, dicotech: { [per(11)]: 1.4e6 } },
  sellOutMes: {}, sellInQCategorias: {},
  vendedoresDicotech: { [per(11)]: [{ nombre: 'Ana', importe: 180000 }, { nombre: 'Luis', importe: 130000 }, { nombre: 'Beto', importe: 40000 }] },
};

test('pagos · bloquesCalculo usa el motor de la web (PCEL trimestral por niveles, Dicotech mensual)', () => {
  assert.deepEqual(cp.mesesCalculo(11), [9, 10, 11]); assert.deepEqual(cp.mesesCalculo(1), [1]);
  assert.equal(cp.factorProyeccion(2026, 11, new Date(2026, 10, 15)), 2);
  assert.equal(cp.factorProyeccion(2026, 10, new Date(2026, 10, 15)), 1, 'mes cerrado: sin proyección');
  const [pcel, dico] = cp.bloquesCalculo({ clientes: ['pcel', 'dicotech'], reglas: [], datosMotor: DATOS_MOTOR, anio: 2026, mes: 11 });
  assert.equal(pcel.q, 4); assert.equal(pcel.etiquetaRebate, 'Rebate Q4'); assert.equal(pcel.sellIn, 3.9e6);
  assert.ok(pcel.rebate && typeof pcel.rebate.clave === 'string' && pcel.rebate.detalle);
  assert.ok(pcel.spiff, 'PCEL tiene SPIFF en las reglas por defecto');
  assert.equal(dico.etiquetaRebate, 'Rebate Nov');
  assert.ok(dico.rebate, 'Dicotech tiene rebate mensual');
  const txt = cp.explicaPropuesta({ detalle: { base: 1000000, pct: 0.02, alcance: 1.04, nivel: 'Nivel 2' } }, { dinero: (n) => `$${n / 1e6}M`, pct: (v) => `${Math.round(v * 100)} %` });
  assert.equal(txt, 'Base $1M × 2.00 % · alcance 104 % · Nivel 2');
  const din = cp.calculoDinamica({ anio: 2026, mes: 11, reglas: [], datosMotor: DATOS_MOTOR, dinamica: [{ anio: 2026, mes: 11, meta: 110000, premios: [{ pos: 1, premio: 'Tarjeta', monto: 2500 }] }] });
  assert.equal(din.meta, 110000); assert.equal(din.calc.detalle.total_vendedores, 3); assert.equal(din.calc.detalle.participantes, 2);
  assert.equal(din.calc.detalle.ganadores[0].nombre, 'Ana');
});

const ACTS = [
  { id: 'm1', cliente: 'pcel', nombre: 'Banner Buen Fin', anio: 2026, mes: 11, inversion: 30000, cobro: 'empresa' },
  { id: 'm2', cliente: 'pcel', nombre: 'Demo en tienda', anio: 2026, fecha: '2026-11-22', inversion: 12000, cobro: 'fondo' },
  { id: 'm3', cliente: 'pcel', nombre: 'De octubre', anio: 2026, mes: 10, inversion: 5000 },
  { id: 'm4', cliente: 'digitalife', nombre: 'Otro cliente', anio: 2026, mes: 11, inversion: 9000 },
];

test('pagos · marketingDelPeriodo: actividades del mes del cliente y el pago que paga la empresa', () => {
  const m = cp.marketingDelPeriodo({ actividades: ACTS, clientes: ['pcel'], anio: 2026, mes: 11, pagos: [] });
  assert.deepEqual(m.delMes.map((a) => a.id), ['m1', 'm2']);
  assert.equal(m.porCliente.length, 1); assert.equal(m.porCliente[0].prop.monto, 30000); assert.equal(m.porCliente[0].fondo, 12000);
  assert.equal(m.porCliente[0].yaHay, false);
  const ya = cp.marketingDelPeriodo({ actividades: ACTS, clientes: ['pcel'], anio: 2026, mes: 11, pagos: [{ clave_calculo: m.porCliente[0].prop.clave }] });
  assert.equal(ya.porCliente[0].yaHay, true);
});

test('pagos · detallePagoManual arma el mismo detalle que la web', () => {
  assert.deepEqual(pd.detallePagoManual({ concepto: 'Bonificación', monto: '1500' }), { filas: [{ concepto: 'Bonificación', monto: 1500 }] });
  const d = pd.detallePagoManual({ concepto: 'PP', monto: 900, apoyo: { total: 900, filas: [{ sku: 'AC-935777', piezas: 30, diferencia: 30, monto: 900 }] } });
  assert.deepEqual(d, { filas: [{ concepto: '30 pz AC-935777 × $30', base: 30, monto: 900 }], total_apoyo: 900 });
  assert.equal(typeof pd.crearPagoManual, 'function'); assert.equal(typeof pd.cambiarCobroActividad, 'function'); assert.equal(typeof pd.traerApoyoProteccion, 'function');
});

test('pagos · SSR celular de Cálculo, Marketing, Reglas y Pago manual', () => {
  const bloques = cp.bloquesCalculo({ clientes: ['dicotech'], reglas: [], datosMotor: DATOS_MOTOR, anio: 2026, mes: 11 });
  const dinamica = cp.calculoDinamica({ anio: 2026, mes: 11, reglas: [], datosMotor: DATOS_MOTOR, dinamica: [{ anio: 2026, mes: 11, meta: 110000, premios: [{ pos: 1, premio: 'Tarjeta', monto: 2500 }] }] });
  const hc = render(CalculoVista, { bloques, dinamica, anio: 2026, mes: 11, meses: [9, 10, 11], factor: 2, yaExiste: () => false, puedeEditar: () => true });
  sano(hc, 'Cálculo');
  for (const t of ['Dicotech', 'Rebate Nov', 'Dinámica de vendedores', 'Ana', 'Sep', 'Nov']) assert.ok(hc.includes(t), `Cálculo: falta «${t}»`);
  const hcl = render(CalculoVista, { bloques, dinamica, anio: 2026, mes: 11, meses: [11], yaExiste: () => true, puedeEditar: () => false });
  assert.ok(!/Crear pago( de premios)?<\/button>/.test(hcl), 'con el pago creado o sin permiso no hay botón');
  assert.match(hc, /Crear pago<\/button>/);
  assert.match(hcl, /Pago ya creado/);

  const m = cp.marketingDelPeriodo({ actividades: ACTS, clientes: ['pcel'], anio: 2026, mes: 11, pagos: [] });
  const hm = render(MarketingVista, { ...m, mesLabel: 'noviembre 2026', puedeEditar: () => true });
  sano(hm, 'Marketing');
  for (const t of ['Banner Buen Fin', 'Demo en tienda', 'Paga la empresa', 'Cargo a fondo', 'Crear pago de marketing', '$30,000']) assert.ok(hm.includes(t), `Marketing: falta «${t}»`);
  const hml = render(MarketingVista, { ...m, mesLabel: 'noviembre 2026', puedeEditar: () => false });
  assert.ok(!hml.includes('Crear pago de marketing'));
  assert.match(render(MarketingVista, { delMes: [], porCliente: [], mesLabel: 'noviembre 2026' }), /Sin actividades de marketing/);

  for (const ck of Object.keys(REGLAS_DEFAULT).filter((k) => ['digitalife', 'pcel', 'dicotech'].includes(k))) {
    const hr = render(ReglasVista, { cliente: ck, reglas: [], puedeEditar: true });
    sano(hr, `Reglas ${ck}`);
    assert.match(hr, /Editar rebate y SPIFF/);
  }
  assert.match(render(ReglasVista, { cliente: 'pcel', reglas: [], puedeEditar: false }), /Ver porcentajes/);

  const f = { cliente: 'pcel', tipo: 'proteccion_precio', concepto: '', monto: '', periodo: '2026-11', fecha_programada: '', notas: '' };
  const hp = render(PagoManualVista, { f, clientes: ['digitalife', 'pcel'], onCampo() {}, apoyo: { inventario: 12, total: 900, filas: [{ sku: 'AC-935777', piezas: 30, precio_anterior: 230, precio_nuevo: 200, monto: 900 }] } });
  sano(hp, 'Pago manual');
  for (const t of ['Cliente', 'Categoría', 'Concepto', 'Monto', 'Periodo', 'Fecha de pago', 'Notas', 'Apoyo de cálculo', 'AC-935777', 'Crear pago']) assert.ok(hp.includes(t), `Pago manual: falta «${t}»`);
  assert.match(hp, /<button[^>]*disabled=""[^>]*>(<svg.*?<\/svg>)?Crear pago<\/button>/, 'sin concepto ni monto el botón sale apagado');
  const ho = render(PagoManualVista, { f: { ...f, tipo: 'bonificacion' }, clientes: ['pcel'], onCampo() {} });
  assert.ok(!ho.includes('Apoyo de cálculo') && !ho.includes('>Cliente<'), 'el apoyo sólo en protección de precio; con un cliente no hay selector');
});

test('pagos · la pantalla global del celular tiene las secciones y el pago manual sólo con permiso de edición', () => {
  const src = leer('src/movil/pestanas/pagos/Pagos.jsx');
  for (const id of ['calculo', 'marketing', 'fondos', 'reglas', 'historial']) assert.match(src, new RegExp(`\\{ id: '${id}', label:`));
  assert.match(src, /editables\.length > 0 && vista === 'hoy'/);
  assert.match(src, /const editables = visibles\.filter\(\(k\) => puedeEditarPagos\(perfil, k\)\)/);
  assert.ok(!/from '\.\/SeccionesM'/.test(src), 'SeccionesM sólo con lazy()');
  // La web usa los mismos motores y escrituras.
  assert.match(leer('src/modules/comercial/pagosv3/PanelCalculo.jsx'), /bloquesCalculo/);
  assert.match(leer('src/modules/comercial/pagosv3/PanelMarketing.jsx'), /cambiarCobroActividad/);
  assert.match(leer('src/modules/comercial/pagosv3/FormPagoManual.jsx'), /traerApoyoProteccion/);
});
