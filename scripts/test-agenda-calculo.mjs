// Pruebas del cálculo puro de Agenda (bandeja, conteos, tablero, avisos, calendario, reuniones).
//   node scripts/test-agenda-calculo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  bandeja, segmento, conteos, equipo, cumplimiento, vecesArrastrado, resumenReunion, ordenarReuniones, proximaReunion,
  avisosSistema, columnasTablero, cambioAlSoltar, eventosCalendario, fraseHero, pasaFiltros, FILTROS_VACIOS, cuando, isoDia, diasEntre,
} from '../src/modules/agenda/calculo.js';
import { textoMinuta, textoBandeja, subReunion } from '../src/modules/agenda/textos.js';

const HOY = new Date(2026, 8, 10, 11); // jueves 10 sep 2026
const P = [{ user_id: 'u-fer', nombre: 'Fernando Cabrera', handle: 'fernando' }, { user_id: 'u-kar', nombre: 'Karolina Veliz', handle: 'karolina' }];
const PP = new Map(P.map((p) => [p.user_id, p]));
const it = (o) => ({ id: o.id, tipo: 'tarea', estado: 'abierta', prioridad: 'media', responsables: [], cliente_key: 'pcel', categoria: null, created_at: '2026-09-01', ...o });
const ITEMS = [
  it({ id: 'a', titulo: 'Enviar estado de cuenta', fecha_limite: '2026-09-09', responsables: ['u-kar'], categoria: 'pagos' }),
  it({ id: 'b', titulo: 'Confirmar rebate Q3', fecha_limite: '2026-09-08', responsables: ['u-fer'], cliente_key: 'digitalife', categoria: 'comercial', prioridad: 'alta' }),
  it({ id: 'c', titulo: 'Subir P&L', fecha_limite: '2026-09-10', responsables: ['u-fer'], cliente_key: 'interno', estado: 'hecha', completado_en: '2026-09-10T08:00:00' }),
  it({ id: 'd', titulo: 'Llamar a PCEL', fecha_limite: '2026-09-10', responsables: ['u-fer'] }),
  it({ id: 'e', titulo: 'Material POP', fecha_limite: '2026-09-15', cliente_key: 'dicotech', categoria: 'marketing' }),
  it({ id: 'f', titulo: 'Idea suelta', fecha_limite: null, responsables: ['u-kar'] }),
  it({ id: 'g', titulo: 'Viejo hecho tarde', fecha_limite: '2026-08-20', estado: 'hecha', completado_en: '2026-08-25T10:00:00' }),
  it({ id: 'h', titulo: 'Lejano', fecha_limite: '2026-10-30' }),
];

test('fechas: cuando / diasEntre', () => {
  assert.equal(cuando('2026-09-10', HOY), 'hoy');
  assert.equal(cuando('2026-09-09', HOY), 'ayer');
  assert.equal(cuando('2026-09-11', HOY), 'mañana');
  assert.equal(cuando('2026-09-07', HOY), 'hace 3 d');
  assert.equal(cuando('2026-09-12', HOY), 'sáb');
  assert.equal(cuando('2026-10-30', HOY), '30 oct');
  assert.equal(diasEntre(HOY, '2026-09-08'), -2);
  assert.equal(isoDia(HOY), '2026-09-10');
});

test('bandeja: vencidas / hoy / próximos / sin fecha, sólo abiertos, orden por fecha y prioridad', () => {
  const b = bandeja(ITEMS, HOY);
  assert.deepEqual(b.vencidas.map((x) => x.id), ['b', 'a']);
  assert.deepEqual(b.hoy.map((x) => x.id), ['d']);
  assert.deepEqual(b.proximos.map((x) => x.id), ['e']);
  assert.deepEqual(b.sinFecha.map((x) => x.id), ['f']);
  assert.equal(b.abiertos.length, 6);
  assert.deepEqual(segmento(ITEMS, 'hoy', HOY).map((x) => x.id), ['a', 'b', 'd']);
  assert.equal(segmento(ITEMS, 'semana', HOY).length, 4); // a b d f (e es 15 sep, fuera de la semana del 7-13)
  assert.equal(segmento(ITEMS, 'todo', HOY).length, 6);
});

test('conteos, equipo y cumplimiento', () => {
  const c = conteos(ITEMS, HOY);
  assert.equal(c.vencidas, 2);
  assert.equal(c.personas.get('u-fer'), 2);
  assert.equal(c.personas.get('u-kar'), 2);
  assert.equal(c.clientes.get('pcel'), 4);
  assert.equal(c.categorias.get('__sin__'), 3);
  assert.equal(c.sinResponsable, 2);
  const e = equipo(ITEMS, P, HOY);
  assert.equal(e[0].total, 2);
  assert.equal(e.find((x) => x.user_id === 'u-fer').vencidas, 1);
  assert.equal(e.find((x) => x.user_id === 'u-fer').hoy, 1);
  assert.equal(cumplimiento(ITEMS, HOY, 30), 50); // c a tiempo, g tarde
  assert.equal(cumplimiento([], HOY), null);
});

test('filtros: persona, cliente, categoría, vencidas, búsqueda sin acentos', () => {
  const f = FILTROS_VACIOS(); f.personas.add('u-kar');
  assert.deepEqual(ITEMS.filter((x) => pasaFiltros(x, f, HOY, PP)).map((x) => x.id), ['a', 'f']);
  const f2 = FILTROS_VACIOS(); f2.q = 'ESTADO cuenta';
  assert.deepEqual(ITEMS.filter((x) => pasaFiltros(x, f2, HOY, PP)).map((x) => x.id), ['a']);
  const f3 = FILTROS_VACIOS(); f3.q = 'karolina';
  assert.equal(ITEMS.filter((x) => pasaFiltros(x, f3, HOY, PP)).length, 2);
  const f4 = FILTROS_VACIOS(); f4.vencidas = true; f4.clientes.add('digitalife');
  assert.deepEqual(ITEMS.filter((x) => pasaFiltros(x, f4, HOY, PP)).map((x) => x.id), ['b']);
});

test('reuniones: arrastre encadenado, resumen y próxima', () => {
  const R = [
    { id: 'r1', tipo: 'reunion', titulo: 'Cierre agosto', cliente_key: 'pcel', fecha: '2026-09-01T17:00:00Z', estado: 'cerrada' },
    { id: 'r2', tipo: 'reunion', titulo: 'Sell-out y promos', cliente_key: 'pcel', fecha: '2026-09-10T17:00:00Z', estado: 'programada', duracion_min: 45, lugar: 'Meet' },
    { id: 'r3', tipo: 'reunion', titulo: 'Digitalife', cliente_key: 'digitalife', fecha: '2026-09-11T15:30:00Z', estado: 'programada' },
    { id: 'r0', tipo: 'reunion', titulo: 'Plan sep', cliente_key: 'pcel', fecha: '2026-08-18T17:00:00Z', estado: 'cerrada' },
  ];
  const puntos = [
    it({ id: 'p0', tipo: 'punto', reunion_id: 'r0', titulo: 'Edo. cuenta con NC', estado: 'arrastrada', categoria: 'pagos' }),
    it({ id: 'p1', tipo: 'punto', reunion_id: 'r1', titulo: 'Edo. cuenta con NC', estado: 'arrastrada', arrastrado_desde: 'p0', categoria: 'pagos' }),
    it({ id: 'p2', tipo: 'punto', reunion_id: 'r2', titulo: 'Edo. cuenta con NC', estado: 'abierta', arrastrado_desde: 'p1', categoria: 'pagos', responsables: ['u-kar'] }),
    it({ id: 'p3', tipo: 'punto', reunion_id: 'r2', titulo: 'Promo Buen Fin', estado: 'abierta', categoria: 'comercial', responsables: ['u-fer'], fecha_limite: '2026-09-15' }),
    it({ id: 'p4', tipo: 'punto', reunion_id: 'r1', titulo: 'Cuota 34 %', estado: 'hecha', categoria: 'comercial', resolucion: 'plan de recuperación' }),
  ];
  const porId = new Map(puntos.map((p) => [p.id, p]));
  assert.equal(vecesArrastrado(puntos[2], porId), 2);
  assert.equal(vecesArrastrado(puntos[3], porId), 0);
  const res = resumenReunion(R[1], puntos, porId);
  assert.equal(res.abiertos.length, 2);
  assert.equal(res.arrastradosAqui.length, 1);
  assert.equal(res.porCategoria.get('pagos'), 1);
  assert.equal(res.masArrastrado, 2);
  const res1 = resumenReunion(R[0], puntos, porId);
  assert.equal(res1.resueltos.length, 1); assert.equal(res1.arrastradosFuera.length, 1);
  assert.deepEqual(ordenarReuniones(R, HOY).map((r) => r.id), ['r2', 'r3', 'r1', 'r0']);
  assert.equal(proximaReunion(R, 'pcel', HOY).id, 'r2');
  assert.equal(proximaReunion(R, 'dicotech', HOY), null);
  const txt = textoMinuta(R[1], res.puntos, { personasPorId: PP, porId });
  assert.match(txt, /^\*Minuta · PCEL · 10 sep 11:00\*/);
  assert.match(txt, /☐ Edo\. cuenta con NC · @Karolina · 3ª vez/);
  assert.match(txt, /☐ Promo Buen Fin · @Fernando · 15 sep/);
  assert.match(txt, /2 puntos abiertos/);
  const txt1 = textoMinuta(R[0], res1.puntos, { personasPorId: PP, porId });
  assert.match(txt1, /☑ Cuota 34 % — quedó: plan de recuperación/);
  assert.equal(subReunion(R[1], HOY), 'PCEL · Meet · hoy 11:00 · 45 min');
});

test('avisos del sistema: alertas, PO hoy/mañana, cargas, tracking, cierre de mes', () => {
  const av = avisosSistema({
    alertas: [{ id: 1, tipo: 'cuota_en_riesgo', titulo: 'PCEL al 34 %', severidad: 'alta', cliente_key: 'pcel', accion: { tipo: 'navegar', pagina: 'sellIn', clienteKey: 'pcel' } }, { id: 2, tipo: 'agenda_vencida', titulo: 'x', area: 'agenda' }],
    transito: [{ sku: 'A', cantidad: 2000, embarques_detalle: [{ po: '7712', eta: '2026-09-10', cantidad: 1500 }, { po: '7712', eta: '2026-09-10', cantidad: 500 }, { po: '7800', eta: '2026-09-21', cantidad: 9 }] }],
    fuentesManuales: [{ id: 'pcel-vm', titulo: 'PCEL venta-marca', grupo: 'pcel', estado: { estado: 'por_vencer', vence: new Date(2026, 8, 7), diasParaLimite: 1 } }, { id: 'roadmap', titulo: 'Roadmap', estado: { cambio: true, estado: 'al_dia' } }],
    tracking: [{ id: 'cot:1', esCotizacion: true, abierta: true, diasEnEtapa: 6, numero_oc_cliente: 'DT-0931', cliente_key: 'dicotech', pedido: 120 }, { id: 'oc1', esCotizacion: false, detenida: true, diasEnEtapa: 4, etapa: 'recibida', numero_oc_cliente: '4500218', cliente_key: 'pcel', pedido: 420, facturado: 300 }],
    hoy: new Date(2026, 8, 29, 10),
  });
  const ids = av.map((a) => a.id);
  assert.ok(ids.includes('alerta:1') && !ids.includes('alerta:2'));
  assert.ok(ids.includes('carga:pcel-vm') && !ids.includes('carga:roadmap'));
  assert.ok(ids.includes('cot:cot:1') && ids.includes('oc:oc1'));
  assert.ok(ids.includes('cierre:2026-9'));
  // PO: hoy es 29 sep en esta prueba → la PO del 10 no aparece
  assert.ok(!ids.some((x) => x.startsWith('po:')));
  const av2 = avisosSistema({ transito: [{ sku: 'A', cantidad: 2000, embarques_detalle: [{ po: '7712', eta: '2026-09-11', cantidad: 2000 }] }], hoy: HOY });
  assert.equal(av2.length, 1); assert.match(av2[0].titulo, /PO 7712 · 2,000 pz/); assert.equal(av2[0].fecha, '2026-09-11');
});

test('tablero: columnas por cliente / persona / estado y cambio al soltar', () => {
  const tarjetas = ITEMS.filter((x) => x.estado === 'abierta').map((x) => ({ ...x, clave: 'item' }));
  const cols = columnasTablero(tarjetas, 'cliente', P, HOY);
  assert.equal(cols[0].id, 'pcel'); assert.equal(cols[0].tarjetas.length, 4);
  assert.equal(cols.at(-1).id, '__hecho__');
  const colsP = columnasTablero(tarjetas, 'persona', P, HOY);
  assert.equal(colsP.find((c) => c.id === '__sin__').tarjetas.length, 2);
  const colsE = columnasTablero(tarjetas, 'estado', P, HOY);
  assert.deepEqual(colsE.map((c) => [c.id, c.tarjetas.length]), [['vencida', 2], ['hoy', 1], ['proximo', 2], ['sinfecha', 1], ['hecha', 0]]);
  assert.deepEqual(cambioAlSoltar('cliente', 'digitalife', tarjetas[0]), { cliente_key: 'digitalife' });
  assert.deepEqual(cambioAlSoltar('persona', 'u-kar', tarjetas[0]), { responsables: ['u-kar'] });
  assert.equal(cambioAlSoltar('cliente', '__hecho__', tarjetas[0]).estado, 'hecha');
  assert.equal(cambioAlSoltar('cliente', 'pcel', { clave: 'reunion' }), null);
  assert.equal(cambioAlSoltar('estado', 'vencida', tarjetas[0]), null);
});

test('calendario: eventos por día con toggles', () => {
  const R = [{ id: 'r2', tipo: 'reunion', titulo: 'PCEL', cliente_key: 'pcel', fecha: '2026-09-10T17:00:00Z', estado: 'programada', duracion_min: 45 }, { id: 'ev', tipo: 'evento', titulo: 'Feria', cliente_key: 'interno', fecha: '2026-09-08T15:00:00Z', fecha_fin: '2026-09-09T23:00:00Z', estado: 'programada' }];
  const google = [{ id: 'g1', summary: 'Dirección', start: { dateTime: '2026-09-08T15:00:00Z' }, end: { dateTime: '2026-09-08T16:00:00Z' } }, { id: 'g2', summary: 'Todo el día', start: { date: '2026-09-11' }, end: { date: '2026-09-12' } }];
  const m = eventosCalendario({ reuniones: R, items: ITEMS, google }, '2026-09-07', '2026-09-13');
  assert.equal(m.get('2026-09-08').length, 3); // feria, google, tarea b
  assert.equal(m.get('2026-09-09').length, 2); // feria (día 2), tarea a
  assert.equal(m.get('2026-09-11').length, 1); // google todo el día (end exclusivo)
  assert.equal(m.get('2026-09-10').length, 2); // reunión + tarea d (c está hecha)
  assert.equal(m.get('2026-09-10')[0].fuente, 'reuniones'); // con hora primero; la tarea sin hora va al final
  const soloG = eventosCalendario({ reuniones: R, items: ITEMS, google }, '2026-09-07', '2026-09-13', new Set(['google']));
  assert.equal([...soloG.values()].flat().length, 2);
});

test('hero y texto de bandeja', () => {
  const b = bandeja(ITEMS, HOY);
  const h = fraseHero({ b, reunionesHoy: [{ cliente_key: 'pcel', fecha: '2026-09-10T17:00:00Z' }], equipoRes: equipo(ITEMS, P, HOY), hoy: HOY });
  assert.equal(h.titulo, 'Tienes 1 cosa para hoy, 2 vencidas y una reunión con PCEL a las 11:00');
  assert.match(h.sub, /Fernando lleva 2 pendientes, Karolina lleva 2 pendientes/);
  const t = textoBandeja(b, { personasPorId: PP, hoy: HOY });
  assert.match(t, /\*Vencidas\* \(2\)/);
  assert.match(t, /☐ Confirmar rebate Q3 · @Fernando · 8 sep/);
});

// ═══════════════════ V4 · 2026-09-21 ═══════════════════════════════════════════
import {
  HORIZONTES, horizonteDe, porHorizonte, archivados, progresoSubtareas, progresoPorItem, subtareasDe,
  estadoSeguimiento, cuentasOrdenadas, cuentasPendientes, registrarContacto, enlacesContacto, fraseAgenda,
} from '../src/modules/agenda/calculo.js';
import { asignables, CORREOS_SIN_AGENDA, buscarCliente } from '../src/modules/agenda/etiquetas.js';

test('V4 · horizonteDe: vencido / hoy / esta semana / más adelante / sin fecha', () => {
  // HOY = jueves 10 sep 2026 → la semana corre lun 7 … dom 13.
  assert.equal(horizonteDe({ fecha_limite: '2026-09-08' }, HOY), 'vencidos');
  assert.equal(horizonteDe({ fecha_limite: '2026-09-10' }, HOY), 'hoy');
  assert.equal(horizonteDe({ fecha_limite: '2026-09-11' }, HOY), 'semana');
  assert.equal(horizonteDe({ fecha_limite: '2026-09-13' }, HOY), 'semana');  // domingo, último día
  assert.equal(horizonteDe({ fecha_limite: '2026-09-14' }, HOY), 'adelante'); // lunes siguiente
  assert.equal(horizonteDe({ fecha_limite: null }, HOY), 'sinfecha');
});

test('V4 · porHorizonte agrupa sólo lo abierto y mantiene "Hoy" aunque esté vacío', () => {
  const b = porHorizonte(ITEMS, HOY);
  const por = Object.fromEntries(b.map((x) => [x.id, x.items.map((i) => i.id)]));
  assert.deepEqual(por.vencidos, ['b', 'a']);       // 8 sep (alta) antes que 9 sep
  assert.deepEqual(por.hoy, ['d']);                  // 'c' está hecha: no entra
  // No hay nada entre el 11 y el domingo 13 → el bloque "Esta semana" ni siquiera aparece.
  assert.equal(por.semana, undefined);
  assert.deepEqual(por.adelante, ['e', 'h']);        // 15 sep (ya es semana siguiente) y 30 oct
  assert.deepEqual(por.sinfecha, ['f']);
  assert.equal(b.every((x) => HORIZONTES.some((h) => h.id === x.id)), true);
  // Sin nada abierto, el bloque "Hoy" sigue presente (para poder decir "nada con fecha de hoy").
  const vacio = porHorizonte([], HOY);
  assert.deepEqual(vacio.map((x) => x.id), ['hoy']);
});

test('V4 · archivados: hechos y cancelados, más recientes primero, con búsqueda', () => {
  const a = archivados(ITEMS);
  assert.deepEqual(a.map((x) => x.id), ['c', 'g']);   // c cerró el 10 sep, g el 25 ago
  assert.deepEqual(archivados(ITEMS, { q: 'p&l' }).map((x) => x.id), ['c']);
  assert.deepEqual(archivados(ITEMS, { q: 'no existe' }), []);
  // Un ítem abierto nunca está archivado.
  assert.equal(a.some((x) => x.estado === 'abierta'), false);
});

test('V4 · subtareas: progreso, agrupación por ítem y orden', () => {
  const S = [
    { id: 's3', item_id: 'a', titulo: 'tercera', hecha: false, orden: 2, created_at: '2026-09-03' },
    { id: 's1', item_id: 'a', titulo: 'primera', hecha: true, orden: 0, created_at: '2026-09-01' },
    { id: 's2', item_id: 'a', titulo: 'segunda', hecha: true, orden: 1, created_at: '2026-09-02' },
    { id: 's4', item_id: 'b', titulo: 'única', hecha: true, orden: 0, created_at: '2026-09-01' },
  ];
  assert.deepEqual(subtareasDe(S, 'a').map((x) => x.id), ['s1', 's2', 's3']);
  assert.deepEqual(progresoSubtareas(subtareasDe(S, 'a')), { total: 3, hechas: 2, pct: 67, completo: false });
  assert.deepEqual(progresoSubtareas(subtareasDe(S, 'b')), { total: 1, hechas: 1, pct: 100, completo: true });
  assert.deepEqual(progresoSubtareas([]), { total: 0, hechas: 0, pct: 0, completo: false });
  const m = progresoPorItem(S);
  assert.equal(m.get('a').hechas, 2);
  assert.equal(m.get('b').completo, true);
  assert.equal(m.get('zzz'), undefined);
});

test('V4 · cuentas: semáforo del próximo seguimiento y orden por urgencia', () => {
  const c = (o) => ({ id: o.id, nombre: o.id, estado: 'activa', recordar_cada_dias: 14, ...o });
  const CUENTAS = [
    c({ id: 'tarde', proximo_seguimiento: '2026-10-30' }),
    c({ id: 'vencida', proximo_seguimiento: '2026-09-05' }),
    c({ id: 'hoy', proximo_seguimiento: '2026-09-10' }),
    c({ id: 'semana', proximo_seguimiento: '2026-09-12' }),
    c({ id: 'sinfecha', proximo_seguimiento: null }),
    c({ id: 'pausada', proximo_seguimiento: '2026-09-01', estado: 'pausada' }),
  ];
  assert.equal(estadoSeguimiento(CUENTAS[1], HOY).nivel, 'vencido');
  assert.equal(estadoSeguimiento(CUENTAS[1], HOY).tone, 'red');
  assert.equal(estadoSeguimiento(CUENTAS[2], HOY).nivel, 'vencido');   // hoy ya toca
  assert.equal(estadoSeguimiento(CUENTAS[3], HOY).nivel, 'semana');
  assert.equal(estadoSeguimiento(CUENTAS[3], HOY).tone, 'orange');
  assert.equal(estadoSeguimiento(CUENTAS[0], HOY).nivel, 'despues');
  assert.equal(estadoSeguimiento(CUENTAS[4], HOY).nivel, 'sinfecha');
  assert.equal(estadoSeguimiento(CUENTAS[5], HOY).label, 'pausada');   // pausada nunca urge

  assert.deepEqual(cuentasOrdenadas(CUENTAS, { hoy: HOY }).map((x) => x.id), ['vencida', 'hoy', 'semana', 'tarde', 'sinfecha']);
  assert.deepEqual(cuentasOrdenadas(CUENTAS, { hoy: HOY, estado: 'pausada' }).map((x) => x.id), ['pausada']);
  assert.deepEqual(cuentasPendientes(CUENTAS, HOY).map((x) => x.id), ['vencida', 'hoy']);
});

test('V4 · cuentas: registrar contacto mueve las fechas y los enlaces normalizan el teléfono', () => {
  assert.deepEqual(registrarContacto({ recordar_cada_dias: 14 }, HOY), { ultimo_contacto: '2026-09-10', proximo_seguimiento: '2026-09-24' });
  assert.deepEqual(registrarContacto({ recordar_cada_dias: 0 }, HOY).proximo_seguimiento, '2026-09-24'); // 0 → default 14
  const e = enlacesContacto('+52 55 1053 6205');
  assert.equal(e.whatsapp, 'https://wa.me/525510536205');
  assert.equal(e.tel, 'tel:+525510536205');
  assert.equal(enlacesContacto('5510536205').e164, '+525510536205');   // sin lada → se añade 52
  assert.deepEqual(enlacesContacto(''), { tel: null, whatsapp: null, e164: null });
});

test('V4 · fraseAgenda no habla de alertas de SKUs y prioriza lo vencido', () => {
  const b = porHorizonte(ITEMS, HOY);
  const h = fraseAgenda({ bloques: b, reunionesHoy: [{ cliente_key: 'pcel', fecha: '2026-09-10T17:00:00Z' }], cuentasHoy: [{ id: 1 }], hoy: HOY, quien: 'Fernando' });
  assert.match(h.titulo, /^Fernando, tienes 2 vencidos, 1 para hoy, 1 cuenta por contactar y una reunión con PCEL/);
  assert.match(h.sub, /Lo vencido primero/);
  assert.equal(h.venc, 2);
  const limpio = fraseAgenda({ bloques: porHorizonte([], HOY), hoy: HOY });
  assert.match(limpio.titulo, /Nada pendiente para hoy/);
});

test('V4 · David Millán no es asignable y #cliente acepta las cuentas del ERP', () => {
  const equipo = [{ user_id: 'u-fer', nombre: 'Fernando Cabrera', email: 'fernando.cabrera@acteck.com' },
    { user_id: 'u-kar', nombre: 'Karolina Veliz', email: 'karolina.veliz@acteck.com' },
    { user_id: 'u-dav', nombre: 'David Millan', email: 'dmillan@acteck.com' }];
  assert.deepEqual(asignables(equipo).map((p) => p.user_id), ['u-fer', 'u-kar']);
  assert.ok(CORREOS_SIN_AGENDA.includes('dmillan@acteck.com'));
  assert.equal(buscarCliente('ct'), 'ct');
  assert.equal(buscarCliente('CVA'), 'cva');
  assert.equal(buscarCliente('meli'), 'mercadolibre');
  assert.equal(buscarCliente('pcel'), 'pcel');
});

// ── Seguimiento por punto (2026-09-21) ────────────────────────────────────────
test('el hilo de un punto no se pierde al arrastrarlo a la siguiente reunión', async () => {
  const { hiloComentarios, comentariosPorItem, cadenaItem, pendientesDePunto } =
    await import('../src/modules/agenda/calculo.js');
  // p1 (reunión r1) se arrastró a p2 (r2) y p2 a p3 (r3).
  const p1 = { id: 'p1', tipo: 'punto', reunion_id: 'r1', estado: 'arrastrada', titulo: 'Camisas' };
  const p2 = { id: 'p2', tipo: 'punto', reunion_id: 'r2', estado: 'arrastrada', titulo: 'Camisas', arrastrado_desde: 'p1' };
  const p3 = { id: 'p3', tipo: 'punto', reunion_id: 'r3', estado: 'abierta', titulo: 'Camisas', origen: { item_anterior: 'p2' } };
  const porId = new Map([p1, p2, p3].map((p) => [p.id, p]));
  assert.deepEqual(cadenaItem(p3, porId), ['p3', 'p2', 'p1']);

  const comentarios = [
    { id: 'c1', item_id: 'p1', reunion_id: 'r1', tipo: 'seguimiento', texto: 'Se pidió cotización', created_at: '2026-08-11T10:00:00Z' },
    { id: 'c3', item_id: 'p3', reunion_id: 'r3', tipo: 'mejora', texto: 'Mejor con logo bordado', created_at: '2026-09-21T10:00:00Z' },
    { id: 'c2', item_id: 'p2', reunion_id: 'r2', tipo: 'seguimiento', texto: 'Siguen sin mandar tallas', created_at: '2026-09-01T10:00:00Z' },
  ];
  const hilo = hiloComentarios(comentarios, p3, porId);
  assert.deepEqual(hilo.map((c) => c.id), ['c1', 'c2', 'c3'], 'orden cronológico, aunque lleguen desordenados');
  assert.deepEqual(hilo.map((c) => c.deOtroPunto), [true, true, false]);
  assert.deepEqual(hilo.map((c) => c.deOtraReunion), [true, true, false]);
  // El mapa precalculado da el mismo resultado (es el que usan las pantallas).
  const porItem = comentariosPorItem(comentarios);
  assert.deepEqual(hiloComentarios([], p3, porId, { porItem }).map((c) => c.id), ['c1', 'c2', 'c3']);
  // Un punto sin arrastres sólo ve lo suyo.
  assert.deepEqual(hiloComentarios(comentarios, p1, porId).map((c) => c.id), ['c1']);
  assert.deepEqual(hiloComentarios(comentarios, null, porId), []);

  // Pendientes ligados al punto (origen.punto_id) → pastilla «N pendientes».
  const tareas = [{ id: 't1', origen: { fuente: 'reparto', punto_id: 'p3' } }, { id: 't2', origen: { fuente: 'reparto' } }];
  assert.deepEqual(pendientesDePunto(tareas, 'p3').map((t) => t.id), ['t1']);
  assert.deepEqual(pendientesDePunto([], 'p3'), []);
});

test('reunionAnterior encuentra la previa del mismo cliente y sólo reuniones', async () => {
  const { reunionAnterior, reunionesDeCliente } = await import('../src/modules/agenda/calculo.js');
  const R = [
    { id: 'r1', tipo: 'reunion', cliente_key: 'digitalife', fecha: '2026-08-11T16:00:00Z', estado: 'cerrada' },
    { id: 'r2', tipo: 'reunion', cliente_key: 'digitalife', fecha: '2026-09-01T16:00:00Z', estado: 'cerrada' },
    { id: 'r3', tipo: 'reunion', cliente_key: 'digitalife', fecha: '2026-09-22T16:00:00Z', estado: 'programada' },
    { id: 'r4', tipo: 'reunion', cliente_key: 'pcel',       fecha: '2026-09-15T16:00:00Z', estado: 'cerrada' },
    { id: 'v1', tipo: 'viaje',   cliente_key: 'digitalife', fecha: '2026-09-10T16:00:00Z', estado: 'programada' },
  ];
  assert.equal(reunionAnterior(R, R[2]).id, 'r2', 'la más reciente anterior del mismo cliente');
  assert.equal(reunionAnterior(R, R[1]).id, 'r1');
  assert.equal(reunionAnterior(R, R[0]), null, 'la primera no tiene anterior');
  assert.equal(reunionAnterior(R, R[3]), null, 'PCEL no hereda las de Digitalife');
  assert.equal(reunionAnterior([], null), null);
  assert.deepEqual(reunionesDeCliente(R, 'digitalife').map((r) => r.id), ['r3', 'r2', 'r1'], 'sin viajes, de la más nueva a la más vieja');
});
