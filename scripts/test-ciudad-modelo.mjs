// Acteck Ciudad · modelo puro. node --test scripts/test-ciudad-modelo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirModelo, ciudadDeSucursal, CIUDADES, posDe, capasVisibles, DETALLE, esChico, etiquetasSinEncimar, encuadre, campus, encimaDelCampus, juntarCapas, capaVisible, vistaMapa, EXTREMOS_MEXICO, ZOOM_MAX, ZOOM_MIN, zoomEnRango, pinCiudad, enLaBase, vistaCiudad, nivelVista, ciudadesTop, planoMini, leerVista, claveVista, tarjetaDe, resumenBanco, resumenTorre, racksPorMarca, acomodoRacks, demanda3Meses, ponerPosEnPuerto, listaCorta, reunionesDelDia, acomodoEscritorios, presenciaPersonas, topSkus, pesosCorto, recursosBarra, burbujasAtencion, misionesDelDia, capaCiudades, CAPA_TONOS, cuotasPorCuenta, bitacoraEventos, pensamientos, circuitoVendedor, tramoActual, rumboBarcos, repartoPorEstado, CIUDAD_POR_ESTADO, cadenaSuministro, cintasCadena, cuotaRitmo, celebraciones, momentosTiempo, datosEnFecha, eventosCalendario, camionesTemporada, ventanasOficina, formaArbol } from '../src/modules/ciudad/modelo.js';

const hoy = new Date(2026, 9, 5, 11, 0);
const d = {
  perfiles: [{ user_id: 'f', nombre: 'Fernando Cabrera', activo: true, tipo: 'interno', puesto: 'Dirección' }, { user_id: 'k', nombre: 'Karolina Veliz', activo: true, tipo: 'interno' }, { user_id: 'x', nombre: 'Ferru Prueba', activo: false }, { user_id: 'c', nombre: 'Camilo', activo: true, tipo: 'externo' }],
  inventario: [{ inv_actual: 133600000, inv_actual_piezas: 709653, dias_inv: 128, skus_con_stock: 2600 }],
  contenedores: [
    { contenedor: 'A1', supplier: 'SAITAKE', naviera: 'MSK', estatus: 'NAVEGANDO', piezas: 820, fob_usd: 15000, etd: '2026-09-10', eta_puerto: '2026-10-20', arribo_cedis: '2026-10-25' },
    { contenedor: 'B2', supplier: 'ACTECK', naviera: 'MSK', estatus: 'PENDIENTE MODULAR', piezas: 558, fob_usd: 30000, etd: '2026-09-01', eta_puerto: '2026-09-29', arribo_cedis: '2026-10-04' },
    { contenedor: 'VIEJO', supplier: 'X', estatus: 'CONCLUIDO', piezas: 2000, fob_usd: 1, eta_puerto: '2024-04-29', arribo_cedis: null },
  ],
  sucursales: [
    { cuenta: 'ct', anio: 2026, mes: 10, sucursal: 'HERMOSILLO', importe: 500000, vendedores: 4 }, { cuenta: 'ct', anio: 2026, mes: 9, sucursal: 'HERMOSILLO', importe: 800000, vendedores: 4 },
    { cuenta: 'ct', anio: 2026, mes: 9, sucursal: 'CIUDAD JUAREZ', importe: 300000, vendedores: 2 }, { cuenta: 'cva', anio: 2026, mes: 10, sucursal: 'AMAZON', importe: 100000 },
    { cuenta: 'cva', anio: 2026, mes: 10, sucursal: 'GUADALAJARA', importe: 900000, vendedores: 5 }, { cuenta: 'pch', anio: 2026, mes: 9, sucursal: 'CEYLAN', importe: 50000 },
  ],
  vendedoresMayoristas: [{ cuenta: 'ct', anio: 2026, mes: 10, vendedor: 'MARIA JUDITH GALVEZ GUTIERREZ', importe: 90000, sucursal: 'HERMOSILLO' }, { cuenta: 'cva', anio: 2026, mes: 8, vendedor: 'JOSE MIGUEL ONTIVEROS PACHECO', importe: 40000, sucursal: null }],
  vendedoresErp: [{ anio: 2026, vendedor: 'JHORDY EMMANUEL SANCHEZ SELVAS', cliente_key: '01234', cliente_nombre: 'CT INTERNACIONAL', fact_neta: 4000000 }, { anio: 2026, vendedor: 'JHORDY EMMANUEL SANCHEZ SELVAS', cliente_key: 'pcel', cliente_nombre: 'PC ONLINE', fact_neta: 100 }],
  cuentas: [{ cuenta: 'ct', nombre: 'CT Internacional', erp_cliente: '01234', propio: false, tiene_sellout: true }, { cuenta: 'cva', nombre: 'Grupo CVA', erp_cliente: '00001', tiene_sellout: true }, { cuenta: 'pch', nombre: 'PCH', tiene_sellout: true }, { cuenta: 'kabik', nombre: 'Kabik', tiene_sellout: true }, { cuenta: 'pcel', nombre: 'PCEL', erp_cliente: 'pcel', propio: true, tiene_sellout: true }],
  facturas: [{ cliente_key: '01234', folio: 'F-1', fecha: '2026-10-03', piezas: 120, monto: 250000 }, { cliente_key: 'zzz', folio: 'F-2', fecha: '2026-09-01', piezas: 1, monto: 1 }],
  agendaHoy: [{ propietario: 'f', estado: 'abierta', titulo: 'Revisar S&OP', cuando: '2026-10-05', inicio_real: '2026-10-05T10:00:00' }, { propietario: 'k', estado: 'hecha', titulo: 'X', cuando: '2026-10-05' }],
  reunionesHoy: [{ titulo: 'Digitalife semanal', fecha: '2026-10-05T10:30:00', duracion_min: 60, tipo: 'reunion', cliente_key: 'digitalife' }],
  cuentaMes: [{ cuenta: 'kabik', anio: 2026, mes: 10, importe: 12000 }],
  clientesFinales: [{ cuenta: 'cva', anio: 2026, mes: 10, estado: 'JALISCO', importe: 1000 }, { cuenta: 'cva', anio: 2026, mes: 9, estado: 'NUEVO LEON', importe: 500 }, { cuenta: 'guc', anio: 2026, mes: 9, estado: 'SIN ESTADO', importe: 9 }],
  cartera: [{ cliente: 'pcel', saldo_vencido: 0, saldo_actual: 100 }, { cliente: 'digitalife', saldo_vencido: 351076, saldo_actual: 4953338, dso: 54 }],
  envios: [{ fecha_surtida: '2026-10-01', fecha_entregada: null, guia_rastreo: 'G-1', paqueteria: 'Estafeta', oc_clientes: { cliente_key: 'pcel', numero_oc: 'OC-9' } }, { fecha_surtida: '2026-09-20', fecha_entregada: '2026-09-25', oc_clientes: { cliente_key: 'pcel' } }],
};
test('sucursales → ciudad', () => {
  assert.equal(ciudadDeSucursal('CIUDAD JUAREZ').ciudad, 'CIUDAD JUAREZ');
  assert.equal(ciudadDeSucursal('Facturacion Aeropuerto').ciudad, 'CIUDAD DE MEXICO');
  assert.equal(ciudadDeSucursal('AMAZON').virtual, true);
  assert.equal(ciudadDeSucursal('BAJA CALIFORNIA NORTE').ciudad, 'TIJUANA');
  assert.equal(ciudadDeSucursal('XALAPA').ciudad, 'XALAPA');
  const g = posDe(CIUDADES.GUADALAJARA); assert.equal(Math.abs(g.x), 0); assert.equal(Math.abs(g.z), 0);
  assert.ok(posDe(CIUDADES.HERMOSILLO).z < 0 && posDe(CIUDADES.HERMOSILLO).x < 0, 'Hermosillo al noroeste');
});
test('modelo completo', () => {
  const m = construirModelo(d, hoy);
  assert.equal(m.oficina.personas.length, 2, 'sin prueba ni externos');
  assert.equal(m.oficina.personas[0].actividad, 'Revisar S&OP');
  assert.ok(m.oficina.reunionEnCurso, 'reunión en curso a las 11:00');
  assert.equal(m.cedis.dias, 128); assert.ok(m.cedis.racks >= 3);
  assert.equal(m.puerto.barcos.length, 1); assert.equal(m.puerto.tarimas.length, 1); assert.equal(m.puerto.barcos[0].id, 'A1');
  const her = m.distritos.find((x) => x.ciudad === 'HERMOSILLO'); assert.ok(her); assert.equal(her.tiendas[0].vendio, true); assert.equal(her.vendedores[0].nombre, 'Maria Galvez');
  const gdl = m.distritos.find((x) => x.ciudad === 'GUADALAJARA'); assert.ok(gdl.tiendas.some((t) => /en línea/.test(t.sucursal)), 'Amazon va a la sede como en línea');
  const mer = m.distritos.find((x) => x.ciudad === 'MERIDA'); assert.ok(mer && mer.tiendas[0].sucursal === 'Matriz' && mer.tiendas[0].vendio, 'Kabik sin sucursales → Matriz en Mérida con su venta del mes');
  assert.equal(m.camiones.length, 2); assert.equal(m.camiones[0].ciudad, 'HERMOSILLO'); assert.equal(m.camiones[1].envio, true); assert.equal(m.camiones[1].ciudad, 'MONTERREY');
  assert.equal(m.kpis.clientesFinales, 2); assert.equal(gdl.clientesFinales.n, 1); assert.ok(gdl.casas >= 1);
  assert.equal(m.kpis.cartera.find((c) => c.cuenta === 'digitalife').vencido, 351076);
  assert.equal(m.vendedoresRuta.length, 1); assert.equal(m.vendedoresRuta[0].destinos[0].ciudad, 'HERMOSILLO');
  assert.ok(m.kpis.tiendas >= 5);
  assert.ok(!JSON.stringify(m).includes('NaN'));
});

test('nivel de detalle por zoom: lejos sólo volúmenes', () => {
  assert.deepEqual(capasVisibles(18), { gente: true, fino: true, mapa: false, cerca: true }, 'irA acerca a 18: todo visible');
  assert.deepEqual(capasVisibles(70), { gente: false, fino: false, mapa: true, cerca: true }, 'vista inicial (70): sin gente ni ventanas');
  assert.deepEqual(capasVisibles((DETALLE.gente + DETALLE.fino) / 2), { gente: false, fino: true, mapa: true, cerca: true }, 'intermedio: ventanas sí, gente no');
  assert.deepEqual(capasVisibles(DETALLE.gente), { gente: true, fino: true, mapa: true, cerca: true }, 'el umbral cuenta como cerca');
  assert.equal(esChico(.8), true, 'árbol .8 es chico (capa fina)'); assert.equal(esChico(1), false, 'escala 1 no es chico'); assert.equal(esChico(1.2), false); assert.equal(esChico(undefined), false, 'sin escala no es chico');
  assert.deepEqual(capasVisibles(NaN), { gente: true, fino: true, mapa: true, cerca: true }, 'zoom inválido no esconde nada');
});

test('etiquetas por prioridad: no se enciman', () => {
  const c = (x, y, prioridad) => ({ x, y, w: 100, h: 20, prioridad });
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, 1), c(50, 5, 3), c(300, 0, 1)]), [false, true, true], 'gana la de más prioridad; la lejana sigue');
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, 2), c(10, 0, 2)]), [true, false], 'empate: la primera');
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, 1), c(0, 30, 1)]), [true, true], 'una arriba de otra con aire');
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, 1), { x: NaN, y: 0, w: 1, h: 1 }]), [true, false], 'caja inválida se esconde sin tirar nada');
  assert.deepEqual(etiquetasSinEncimar([]), []);
});

test('vista base: encuadre de oficina, CEDIS y puerto', () => {
  const pts = [{ x: -7, z: 2, r: 7 }, { x: 9, z: -2, r: 7 }, { x: -10.7, z: 18.5, r: 9 }];
  const e = encuadre(pts, { aspecto: 1.6 });
  assert.ok(e.zoom > 8 && e.zoom < 50, `cerca, con gente visible (zoom ${e.zoom.toFixed(1)})`);
  assert.deepEqual(capasVisibles(e.zoom), { gente: true, fino: true, mapa: false, cerca: true }, 'la base se ve con detalle y sin los distritos encimados');
  assert.ok(e.cx > -11 && e.cx < 9 && e.cz > -2 && e.cz < 18.5, 'el centro cae entre los tres');
  const uno = encuadre([{ x: 5, z: -3 }]); assert.ok(Math.abs(uno.cx - 5) < 1e-9 && Math.abs(uno.cz + 3) < 1e-9, 'un punto: centrado en él'); assert.equal(uno.zoom, 8, 'un punto sin radio: zoom mínimo');
  assert.ok(encuadre(pts, { aspecto: .6 }).zoom > e.zoom, 'pantalla angosta (iPad vertical) aleja la cámara');
  assert.equal(encuadre([{ x: 0, z: 0, r: 1000 }]).zoom, 120, 'tope de zoom');
  assert.equal(encuadre([]), null); assert.equal(encuadre(null), null); assert.equal(encuadre([{ x: NaN, z: 0 }]), null, 'puntos inválidos no tiran nada');
  assert.ok(Number.isFinite(encuadre(pts, { aspecto: 0 }).zoom), 'aspecto inválido usa el de omisión');
});

test('campus de la base: nada se encima y el distrito GDL queda lejos del puerto', () => {
  const c = campus({ x: 0, z: 0 }); const puerto = { x: -10.7, z: 18.5 };
  const caja = (p, w, l) => ({ x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - l / 2, z1: p.z + l / 2 });
  const choca = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
  const ofi = caja(c.oficina, 14, 14), ced = caja(c.cedis, 22, 16), pat = caja(c.patio, c.patio.ancho, c.patio.largo);
  assert.ok(!choca(ofi, ced) && !choca(ced, pat) && !choca(ofi, pat), 'oficina, CEDIS y patio no se enciman');
  const interior = c.calles.find((k) => k.nombre === 'interior'); assert.ok(interior.a.x - interior.ancho / 2 >= ofi.x1 && interior.a.x + interior.ancho / 2 <= ced.x0, 'la calle interior corre entre oficina y CEDIS');
  const av = c.calles.find((k) => k.nombre === 'avenida'); assert.ok(av.a.z - av.ancho / 2 >= Math.max(ofi.z1, ced.z1, pat.z1), 'la avenida va al frente de todo');
  for (const [w, l] of [[7, 4.5], [15, 19], [15, 40]]) {
    const g = c.distritoGDL(w, l); const d = { ...caja(g, w, l), x0: g.x - w / 2 - 2.8 }; // incluye las casitas a la izquierda
    assert.ok(!choca(d, ofi) && !choca(d, ced) && !choca(d, pat), `distrito ${w}×${l} no se encima con el campus`);
    assert.ok(g.z - l / 2 >= av.a.z + av.ancho / 2, 'el distrito queda abajo de la avenida');
    assert.ok(g.x - w / 2 - 2.8 > puerto.x + 5 + 2, `distrito ${w}×${l} lejos del muelle`);
  }
  const o = campus({ x: 3, z: -2 }); assert.equal(o.oficina.x, -6); assert.equal(o.cedis.z, -4);
  assert.ok(Number.isFinite(campus(null).cedis.x) && Number.isFinite(campus({ x: NaN }).oficina.x), 'origen inválido usa 0');
  assert.ok(Number.isFinite(c.distritoGDL(undefined, 'x').x));
});

test('campus de la base: estacionamiento, bardas, jardín y faroles en su lugar', () => {
  const c = campus({ x: 0, z: 0 });
  const caja = (p, w, l) => ({ x0: p.x - w / 2, x1: p.x + w / 2, z0: p.z - l / 2, z1: p.z + l / 2 });
  const choca = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
  const ofi = caja(c.oficina, 14, 14), ced = caja(c.cedis, 22, 16), pat = caja(c.patio, c.patio.ancho, c.patio.largo);
  const est = caja(c.estacionamiento, c.estacionamiento.ancho, c.estacionamiento.largo), jar = caja(c.jardin, c.jardin.ancho, c.jardin.largo);
  for (const [n, b] of [['estacionamiento', est], ['jardín', jar]]) for (const o of [ofi, ced, pat]) assert.ok(!choca(b, o), `${n} no se encima con los edificios`);
  const interior = c.calles.find((k) => k.nombre === 'interior'); assert.ok(est.x1 <= interior.a.x - interior.ancho / 2 && est.z0 < interior.a.z + 4, 'el estacionamiento da a la calle interior');
  assert.ok(c.estacionamiento.cajones > 0 && c.estacionamiento.cajones % 2 === 0, 'cajones en dos filas');
  const av = c.calles.find((k) => k.nombre === 'avenida');
  assert.ok(c.faroles.length >= 6 && c.faroles.every((f) => f.x > av.a.x && f.x < av.b.x && Math.abs(f.z - av.a.z) > av.ancho / 2 && Math.abs(f.z - av.a.z) < av.ancho / 2 + 1), 'faroles sobre la banqueta de la avenida');
  assert.ok(c.faroles.every((f) => Math.abs(f.x - interior.a.x) > 1.5), 'ningún farol en el cruce con la calle interior');
  assert.ok(c.faroles.every((f) => f.z >= Math.max(ofi.z1, ced.z1, pat.z1) + 2 && f.z < c.distritoGDL(10, 10).z - 5), 'faroles entre el campus y el distrito GDL, sin tocar edificios');
  for (const b of c.bardas) { const bx = { x0: Math.min(b.a.x, b.b.x) + .01, x1: Math.max(b.a.x, b.b.x) - .01, z0: Math.min(b.a.z, b.b.z), z1: Math.max(b.a.z, b.b.z) }; assert.ok(!choca(bx, ced) && !choca(bx, pat), 'la barda rodea, no cruza, CEDIS y patio'); }
});

test('distritos reales encima del campus: capa mapa, sólo de lejos (3.90.12)', () => {
  const c = campus(posDe(CIUDADES.GUADALAJARA)); const gdl = { ...c.distritoGDL(15, 10), w: 15, l: 10 };
  const cajaGDL = { x0: gdl.x - 7.5 - 2.8, x1: gdl.x + 7.5, z0: gdl.z - 5, z1: gdl.z + 9 };
  for (const k of ['LEON', 'QUERETARO', 'MORELIA']) assert.equal(encimaDelCampus(c, posDe(CIUDADES[k]), 7, 4.5, cajaGDL), true, `${k} cae sobre la base`);
  for (const k of ['MONTERREY', 'CIUDAD DE MEXICO', 'MANZANILLO', 'TOLUCA']) assert.equal(encimaDelCampus(c, posDe(CIUDADES[k]), 7, 4.5, cajaGDL), false, `${k} no toca la base`);
  assert.deepEqual([CIUDADES.LEON, CIUDADES.QUERETARO].map((x) => posDe(x)), [posDe(CIUDADES.LEON), posDe(CIUDADES.QUERETARO)], 'su posición en el mapa no cambia');
  assert.equal(encimaDelCampus(null, { x: 0, z: 0 }), false); assert.equal(encimaDelCampus(c, { x: NaN, z: 0 }), false, 'datos inválidos no esconden nada');
  assert.equal(juntarCapas('fino', 'mapa'), 'fino+mapa'); assert.equal(juntarCapas('mapa+fino', 'mapa'), 'fino+mapa', 'sin repetir');
  assert.equal(juntarCapas(undefined, false, ''), undefined); assert.equal(juntarCapas(false, 'mapa'), 'mapa');
  const cerca = capasVisibles(30), lejos = capasVisibles(DETALLE.mapa + 1);
  assert.equal(capaVisible(cerca, 'mapa'), false, 'de cerca no se ve'); assert.equal(capaVisible(lejos, 'mapa'), true, 'de lejos sí');
  assert.equal(capaVisible(lejos, 'fino+mapa'), true); assert.equal(capaVisible(capasVisibles(70), 'fino+mapa'), false, 'muy lejos lo fino se va');
  assert.equal(capaVisible(cerca, undefined), true, 'sin capa siempre se ve');
  assert.ok(DETALLE.mapa < DETALLE.gente, 'hay un tramo donde se ven los distritos y todavía la gente');
  const mapa = capasVisibles(DETALLE.pin + 1);
  assert.deepEqual(mapa, { gente: false, fino: false, mapa: true, cerca: false }, 'Vista Mapa: se va la capa cerca');
  assert.equal(capasVisibles(DETALLE.pin).cerca, true, 'el umbral del pin todavía cuenta como cerca');
  assert.equal(capaVisible(mapa, 'cerca+mapa'), false, 'casitas de un distrito sobre el campus: tampoco en el mapa');
  assert.equal(capaVisible(lejos, 'cerca+mapa'), true, 'y sí entre DETALLE.mapa y DETALLE.pin');
  assert.ok(DETALLE.fino < DETALLE.pin, 'lo cerca se va después de lo fino');
});

test('Vista Mapa: México completo cabe en pantalla con cualquier giro y lienzo', () => {
  const der = (a) => ({ x: Math.sin(a), z: -Math.cos(a) }); const fondo = (a) => ({ x: -Math.cos(a), z: -Math.sin(a) });
  for (const ang of [Math.PI / 4, 0, Math.PI / 2, 1.2, -2]) for (const aspecto of [2.2, 1.6, 1, .6]) {
    const m = vistaMapa({ ang, aspecto }); assert.ok(m && m.zoom >= ZOOM_MIN && m.zoom <= ZOOM_MAX, 'zoom dentro de rango');
    const extremos = [...EXTREMOS_MEXICO, CIUDADES.GUADALAJARA, CIUDADES.MERIDA, CIUDADES.TIJUANA].map((c) => posDe(c));
    if (m.zoom < ZOOM_MAX) for (const p of extremos) {
      const h = (p.x - m.cx) * der(ang).x + (p.z - m.cz) * der(ang).z, v = ((p.x - m.cx) * fondo(ang).x + (p.z - m.cz) * fondo(ang).z) * Math.sin(Math.atan2(240, 300));
      assert.ok(Math.abs(h) <= m.zoom * aspecto + 1e-6 && Math.abs(v) <= m.zoom + 1e-6, `punto visible (ang ${ang}, aspecto ${aspecto})`);
    }
  }
  assert.ok(vistaMapa().zoom > encuadre([{ ...posDe(CIUDADES.GUADALAJARA), r: 9 }]).zoom, 'el mapa se ve más lejos que la base');
  assert.ok(vistaMapa({ aspecto: 1.6 }).zoom < ZOOM_MAX, 'en pantalla normal no topa con el máximo');
  assert.equal(zoomEnRango(500), ZOOM_MAX); assert.equal(zoomEnRango(2), ZOOM_MIN); assert.equal(zoomEnRango(50), 50); assert.equal(zoomEnRango(NaN), ZOOM_MAX);
  assert.ok(vistaMapa({ aspecto: 0 }), 'aspecto inválido no rompe');
});

test('pin de ciudad en la Vista Mapa: tiendas activas físicas y camiones llegando', () => {
  const dist = { ciudad: 'CIUDAD DE MEXICO', tiendas: [{ vendio: true }, { vendio: true, virtual: true }, { vendio: false }, { vendio: true }] };
  const p = pinCiudad(dist, [{ ciudad: 'CIUDAD DE MEXICO' }, { ciudad: 'MONTERREY' }, null, { ciudad: 'CIUDAD DE MEXICO' }]);
  assert.deepEqual([p.activas, p.llegando], [2, 2]); assert.equal(p.texto, 'CDMX · 🏬 2 · 🚚 2');
  assert.equal(pinCiudad({ ciudad: 'SAN LUIS POTOSI', tiendas: [] }).texto, 'San Luis Potosi · 🏬 0', 'sin camiones no se muestra el camión');
  assert.equal(pinCiudad(null, null).activas, 0, 'datos vacíos no rompen');
  const m = construirModelo(d, hoy); for (const x of m.distritos) assert.ok(pinCiudad(x, m.camiones).texto.length > 0);
  assert.equal(m.distritos.reduce((s, x) => s + pinCiudad(x, m.camiones).llegando, 0), m.camiones.filter((c) => m.distritos.some((x) => x.ciudad === c.ciudad)).length, 'cada camión cuenta en una sola ciudad');
  assert.ok(DETALLE.pin > DETALLE.fino && DETALLE.pin < ZOOM_MAX && vistaMapa().zoom > DETALLE.pin, 'en la Vista Mapa se ven los pines');
});

test('enLaBase: un solo botón Base/Mapa según dónde está la cámara', () => {
  const b = { cx: 0, cz: 0, zoom: 30 };
  assert.equal(enLaBase(b, b), true, 'recién llegado a la base');
  assert.equal(enLaBase({ cx: 5, cz: 0, zoom: 20 }, b), true, 'acercarse dentro del campus sigue siendo base');
  assert.equal(enLaBase({ cx: 0, cz: 0, zoom: 160 }, b), false, 'alejarse al mapa');
  assert.equal(enLaBase({ cx: 200, cz: 40, zoom: 18 }, b), false, 'de cerca pero en otra ciudad');
  assert.equal(enLaBase(null, b), true, 'sin datos no rompe');
  assert.equal(enLaBase(vistaMapa(), b), false, 'la Vista Mapa cuenta como lejos');
});

test('Viajar: vistaCiudad encuadra el distrito de cerca y nivelVista distingue base/ciudad/lejos', () => {
  const caja = { x: 120, z: -40, ancho: 14, largo: 10 };
  const c = vistaCiudad(caja, { ang: Math.PI / 4, aspecto: 1.6 });
  assert.ok(c && Math.hypot(c.cx - 120, c.cz - (-40 + 1)) < 6, 'centrada en el distrito');
  assert.ok(c.zoom >= 14 && c.zoom <= DETALLE.gente, 'de cerca: se ven gente y tiendas');
  assert.ok(vistaCiudad({ ...caja, ancho: 60, largo: 60 }).zoom >= c.zoom, 'distrito más grande, encuadre más abierto');
  for (const aspecto of [0.5, 1, 2.4]) assert.ok(vistaCiudad(caja, { aspecto }).zoom <= DETALLE.gente, `aspecto ${aspecto} dentro del tope`);
  assert.equal(vistaCiudad(null), null, 'sin distrito no rompe'); assert.equal(vistaCiudad({ x: NaN, z: 0 }), null);
  assert.ok(vistaCiudad({ x: 0, z: 0 }), 'sin medidas usa un tamaño por omisión');
  const b = { cx: 0, cz: 0, zoom: 30 };
  assert.equal(nivelVista({ cx: 0, cz: 0, zoom: 30 }, b, c), 'base');
  assert.equal(nivelVista({ cx: c.cx, cz: c.cz, zoom: c.zoom }, b, c), 'ciudad', 'recién llegado a la ciudad');
  assert.equal(nivelVista(vistaMapa(), b, c), 'lejos', 'el mapa es lejos');
  assert.equal(nivelVista({ cx: c.cx, cz: c.cz, zoom: c.zoom }, b, null), 'lejos', 'sin viaje no hay nivel ciudad');
  assert.equal(nivelVista({ cx: c.cx, cz: c.cz, zoom: c.zoom }, b, { cx: 1, cz: 1 }), 'lejos', 'ciudad sin zoom no cuenta');
});

test('acceso rápido: 5 ciudades con más actividad', () => {
  const mod = { distritos: [{ ciudad: 'LEON', tiendas: [{ vendio: true }] }, { ciudad: 'CIUDAD DE MEXICO', tiendas: [{ vendio: true }, { vendio: true }] }, { ciudad: 'MORELIA', tiendas: [{ vendio: false }] }, { ciudad: 'QUERETARO', tiendas: [{ vendio: true }, { vendio: false }] }], camiones: [{ ciudad: 'LEON' }, { ciudad: 'LEON' }] };
  assert.deepEqual(ciudadesTop(mod).map((c) => c.ciudad), ['LEON', 'CIUDAD DE MEXICO', 'QUERETARO'], 'por actividad, empate por tiendas, sin actividad fuera');
  assert.equal(ciudadesTop(mod)[1].nombre, 'CDMX'); assert.equal(ciudadesTop(mod, 1).length, 1);
  assert.deepEqual(ciudadesTop(null), [], 'datos vacíos no rompen');
  const m = construirModelo(d, hoy); const top = ciudadesTop(m); assert.ok(top.length <= 5 && top.every((c) => m.distritos.some((x) => x.ciudad === c.ciudad)));
});
test('minimapa: plano chico con contorno, ciudades y marcador de la cámara', () => {
  const ds = [{ ciudad: 'GUADALAJARA', pos: posDe(CIUDADES.GUADALAJARA) }, { ciudad: 'MONTERREY', pos: posDe(CIUDADES.MONTERREY) }, { ciudad: 'X' }];
  const p = planoMini(ds, { ancho: 150, alto: 96 });
  assert.equal(p.contorno.split(' ').length, EXTREMOS_MEXICO.length);
  assert.equal(p.puntos.length, 2, 'sin posición no se dibuja');
  for (const q of [...p.contorno.split(' ').map((s) => s.split(',').map(Number)).map(([u, v]) => ({ u, v })), ...p.puntos]) assert.ok(q.u >= 0 && q.u <= 150 && q.v >= 0 && q.v <= 96, 'todo dentro del plano');
  const mty = p.puntos.find((q) => q.ciudad === 'MONTERREY'), gdl = p.puntos.find((q) => q.ciudad === 'GUADALAJARA');
  assert.ok(mty.v < gdl.v && mty.u > gdl.u, 'norte arriba, oriente a la derecha');
  const e = p.aEscena(gdl.u, gdl.v); const g = posDe(CIUDADES.GUADALAJARA); assert.ok(Math.hypot(e.x - g.x, e.z - g.z) < 1, 'ida y vuelta');
  assert.equal(p.cercana(gdl.u + 2, gdl.v), 'GUADALAJARA'); assert.equal(p.cercana(0, 0), null);
  const mk = p.marco({ cx: g.x, cz: g.z, zoom: 1 }); assert.ok(Math.abs(mk.u - gdl.u) < .2 && mk.r === 3, 'marcador mínimo 3 px');
  assert.ok(p.marco({ cx: 9e9, cz: 0, zoom: 9e9 }).u <= 150 && p.marco({ cx: 0, cz: 0, zoom: 9e9 }).r <= 48, 'marcador acotado');
  assert.equal(p.marco(null), null); assert.deepEqual(planoMini(null).puntos, [], 'datos vacíos no rompen');
});
test('última vista: lectura tolerante desde localStorage', () => {
  const g = posDe(CIUDADES.GUADALAJARA);
  assert.deepEqual(leerVista(JSON.stringify({ cx: g.x, cz: g.z, zoom: 30 })), { cx: g.x, cz: g.z, zoom: 30 });
  assert.equal(leerVista(JSON.stringify({ cx: g.x, cz: g.z, zoom: 9999 })).zoom, ZOOM_MAX, 'zoom acotado');
  assert.equal(leerVista(JSON.stringify({ cx: g.x, cz: g.z, zoom: 1 })).zoom, ZOOM_MIN);
  for (const t of [null, '', 'no-json', '{}', '{"cx":"a","cz":0,"zoom":10}', JSON.stringify({ cx: 1e6, cz: 0, zoom: 20 }), JSON.stringify({ cx: 0, cz: -1e6, zoom: 20 })]) assert.equal(leerVista(t), null, String(t));
  assert.equal(claveVista('u1'), 'acteck.ciudad.vista.u1'); assert.equal(claveVista(null), 'acteck.ciudad.vista.anon');
});
test('tarjeta del edificio: una plantilla con estado y hasta 4 números', () => {
  const mod = { oficina: { personas: [{ pendientes: 3, hechas: 1 }], genericos: 2, reuniones: 1, reunionEnCurso: null }, cedis: { valor: 12.5e6, dias: 95, piezas: 1000, skus: 40 }, puerto: { barcos: [{ piezas: 10, llegaEnDias: 3 }, { piezas: 5, llegaEnDias: null }], tarimas: [], totalPiezas: 15 },
    distritos: [{ ciudad: 'LEON', cuentas: ['ct'], vendedores: [], tiendas: [{ cuenta: 'ct', nombreCuenta: 'CT', sucursal: 'León', importe: 250000, previo: 1e5, vendio: true, vendioMes: true }, { cuenta: 'ct', nombreCuenta: 'CT', sucursal: 'Centro', importe: 0, previo: 0, vendio: false, cartera: { vencido: 5000 } }] }] };
  const of = tarjetaDe({ tipo: 'oficina', titulo: 'Oficina', pagina: 'agenda' }, mod);
  assert.deepEqual(of.numeros[0], ['Personas', '3']); assert.equal(of.estado, 'verde'); assert.equal(of.pagina, 'agenda');
  const ce = tarjetaDe({ tipo: 'cedis' }, mod); assert.equal(ce.numeros[0][1], '$12.5 M'); assert.equal(ce.estado, 'ambar', '95 días → ámbar');
  assert.equal(tarjetaDe({ tipo: 'puerto' }, mod).estado, 'ambar', 'un barco sin ETA');
  const ci = tarjetaDe({ tipo: 'ciudad', ciudad: 'LEON' }, mod); assert.deepEqual(ci.numeros[0], ['Tiendas activas', '1 de 2']); assert.equal(ci.estado, 'ambar');
  const ti = tarjetaDe({ tipo: 'tienda', ciudad: 'LEON', cuenta: 'ct', titulo: 'CT · Centro' }, mod); assert.equal(ti.estado, 'rojo'); assert.ok(ti.numeros.some(([l]) => l === 'Cartera vencida'));
  assert.equal(tarjetaDe({ tipo: 'tienda', ciudad: 'LEON', cuenta: 'ct', titulo: 'CT · León' }, mod).estado, 'verde');
  const cam = tarjetaDe({ tipo: 'camion', titulo: 'Factura 1', sub: 'x' }, mod); assert.equal(cam.estado, null); assert.deepEqual(cam.numeros, []); assert.equal(cam.sub, 'x');
  assert.equal(tarjetaDe(null, mod), null); assert.ok(tarjetaDe({ tipo: 'cedis' }, null).numeros.length === 0, 'sin modelo no rompe');
  const m = construirModelo(d, hoy); for (const tipo of ['oficina', 'cedis', 'puerto']) assert.ok(tarjetaDe({ tipo }, m).numeros.length <= 4);
});
test('banco: cartera vencida y pagos de la semana con las reglas de Pagos V3', async () => {
  const reglas = await import('../src/modules/comercial/pagosv3/estados.js');
  const hoyIso = '2026-10-07';
  const pagos = [{ estado: 'autorizado', monto: 100, fecha_programada: '2026-10-09' }, { estado: 'solicitado', monto: 50, fecha_programada: '2026-10-01' }, { estado: 'pagado', monto: 999, fecha_programada: '2026-10-08' }, { estado: 'rechazado', monto: 7, fecha_programada: '2026-10-08' }, { estado: 'calculado', monto: 3, fecha_programada: '2026-11-30' }, { estado: 'calculado', monto: 1 }];
  const b = resumenBanco([{ cuenta: 'ct', vencido: 2e6 }, { cuenta: 'cva', vencido: 0 }], pagos, hoyIso, reglas);
  assert.equal(resumenBanco([], pagos, hoyIso).pagosSemana, 0, 'sin reglas no cuenta pagos');
  assert.deepEqual(b, { carteraVencida: 2e6, cuentasVencidas: 1, pagosSemana: 1, montoSemana: 100, pagosVencidos: 1, montoVencido: 50 });
  assert.deepEqual(resumenBanco(null, null, hoyIso), { carteraVencida: 0, cuentasVencidas: 0, pagosSemana: 0, montoSemana: 0, pagosVencidos: 0, montoVencido: 0 }, 'sin datos no rompe');
  assert.equal(tarjetaDe({ tipo: 'banco' }, { banco: b }).estado, 'rojo');
  assert.equal(tarjetaDe({ tipo: 'banco' }, { banco: { ...resumenBanco([], [pagos[0]], hoyIso, reglas) } }).estado, 'ambar');
  const c = campus({ x: 0, z: 0 }); const bk = c.banco; const est = c.estacionamiento;
  assert.ok(bk.z + bk.largo / 2 <= est.z - est.largo / 2, 'el banco queda al norte del estacionamiento sin encimarse');
  assert.ok(bk.z - bk.largo / 2 >= c.caja.z0 && bk.x - bk.ancho / 2 >= c.caja.x0, 'el banco está dentro del terreno del campus');
  assert.ok(construirModelo(d, hoy).banco, 'el modelo trae el banco');
});
test('torre de pronóstico: propuestas, líneas y avisos de arribo', () => {
  const hoyIso = '2026-10-07';
  const props = [{ estatus: 'activa', cerrado_at: null, forecast_propuesta_lineas: [{ confirmado: true, comprado_at: '2026-10-01' }, { confirmado: false }] }, { estatus: 'cerrada', cerrado_at: '2026-09-30', forecast_propuesta_lineas: [{ confirmado: true }] }, { estatus: 'borrador', forecast_propuesta_lineas: [{ confirmado: true }] }];
  const avisos = [{ fecha_arribo: '2026-10-06', piezas_a_reservar: 5 }, { fecha_arribo: '2026-10-10', piezas_a_reservar: 10 }, { fecha_arribo: '2026-10-30', piezas_a_reservar: 99 }, { fecha_arribo: null }];
  const r = resumenTorre(props, avisos, hoyIso);
  assert.deepEqual(r, { abiertas: 1, lineas: 3, confirmadas: 2, compradas: 1, arribos7: 1, piezas7: 15, atrasados: 1 }, 'sin borradores; arribos hasta 7 días; ayer = atrasado');
  assert.equal(tarjetaDe({ tipo: 'torre' }, { torre: r }).estado, 'rojo');
  assert.equal(tarjetaDe({ tipo: 'torre' }, { torre: resumenTorre(props, [avisos[1]], hoyIso) }).estado, 'ambar');
  assert.equal(tarjetaDe({ tipo: 'torre' }, { torre: resumenTorre(null, null, hoyIso) }).estado, 'verde', 'sin datos no rompe');
  const c = campus({ x: 0, z: 0 }); const caja = (p) => ({ x0: p.x - p.ancho / 2, x1: p.x + p.ancho / 2, z0: p.z - p.largo / 2, z1: p.z + p.largo / 2 });
  const choca = (a, b) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1; const t = caja(c.torre);
  assert.ok(!choca(t, caja(c.banco)) && !choca(t, caja(c.estacionamiento)) && t.z1 <= c.bardas[0].a.z, 'la torre no se encima y queda al norte de la barda');
  assert.ok(t.z0 >= c.caja.z0, 'dentro del terreno del campus'); assert.ok(construirModelo(d, hoy).torre);
});

test('racks del CEDIS por marca: valor, piezas y SKUs, top n + «otras»', () => {
  const filas = [
    { articulo: 'AC-1', inventario: 10, costoinventario: 1000 }, { articulo: 'AC-1', inventario: 5, costoinventario: 500 }, { articulo: 'AC-2', inventario: 2, costoinventario: 300 },
    { articulo: 'BR-1', inventario: 4, costoinventario: 900 }, { articulo: 'GM-1', inventario: 1, costoinventario: 50 }, { articulo: 'XX-9', inventario: 3, costoinventario: 10 },
    { articulo: 'CERO', inventario: 0, costoinventario: 999 }, null, { inventario: 5 },
  ];
  const marcas = new Map([['AC-1', 'Acteck'], ['AC-2', ' acteck '], ['BR-1', 'Balam Rush'], ['GM-1', 'Game Factor'], ['CERO', 'Acteck']]);
  const r = racksPorMarca(filas, marcas);
  assert.deepEqual(r.map((g) => [g.marca, g.valor, g.piezas, g.skus]), [['ACTECK', 1800, 17, 2], ['BALAM RUSH', 900, 4, 1], ['GAME FACTOR', 50, 1, 1], ['SIN MARCA', 10, 3, 1]], 'suma por marca normalizada; SKU × almacén cuenta una vez; sin existencia no cuenta');
  const r2 = racksPorMarca(filas, Object.fromEntries(marcas), 2);
  assert.equal(r2.length, 3); assert.deepEqual(r2[2], { marca: 'OTRAS', valor: 60, piezas: 4, skus: 2, marcas: 2, demanda3: 0, dias: null }, 'el resto va junto en «otras»');
  assert.deepEqual(racksPorMarca(null, null), [], 'sin datos no rompe');
  const m = construirModelo(d, hoy); assert.deepEqual(m.cedis.racksMarca, [], 'sin capa de SKU el CEDIS sigue');
  assert.equal(construirModelo({ ...d, inventarioSku: filas, marcasSku: marcas }, hoy).cedis.racksMarca[0].marca, 'ACTECK');
});

test('interior del CEDIS: acomodo de racks y tarjeta del rack', () => {
  const racks = [{ marca: 'ACTECK', valor: 1000, piezas: 10, skus: 3 }, { marca: 'BALAM RUSH', valor: 500, piezas: 4, skus: 1 }, { marca: 'GAME FACTOR', valor: 1, piezas: 1, skus: 1 }, { marca: 'OTRAS', valor: 0, piezas: 2, skus: 2, marcas: 4 }];
  const a = acomodoRacks(racks, { ancho: 12, largo: 8, cols: 3, maxNiveles: 5 });
  assert.deepEqual(a.map((r) => r.niveles), [5, 3, 1, 1], 'niveles por valor frente a la mayor, mínimo 1');
  assert.deepEqual(a.map((r) => [r.x, r.z]), [[-4, -2], [0, -2], [4, -2], [-4, 2]], 'rejilla centrada en la nave');
  assert.ok(a.every((r) => Math.abs(r.x) < 6 && Math.abs(r.z) < 4), 'todos dentro de la nave');
  assert.deepEqual(acomodoRacks(null), []); assert.equal(acomodoRacks([{ marca: 'X', valor: 0 }])[0].niveles, 1, 'sin valor no rompe');
  const m = { cedis: { racksMarca: racks } };
  const t = tarjetaDe({ tipo: 'rack', marca: 'ACTECK', titulo: 'ACTECK', pagina: 'inventarioGlobal' }, m);
  assert.deepEqual(t.numeros, [['Inventario', '$1 K · 67 %'], ['Días de inventario', 'sin demanda'], ['Piezas', '10'], ['SKUs con stock', '3']]); assert.equal(t.estado, null);
  assert.equal(tarjetaDe({ tipo: 'rack', marca: 'OTRAS' }, m).numeros[3][0], 'SKUs · 4 marcas');
  assert.deepEqual(tarjetaDe({ tipo: 'rack', marca: 'NADA' }, m).numeros, [], 'marca que ya no está no rompe');
});

test('días de inventario por marca y salidas de hoy del CEDIS', () => {
  const h = new Date(2026, 9, 7, 22, 40); // de noche: en UTC ya es 8 de octubre
  const piv = [{ sku: 'ac-1', anio: 2026, piezas: [0, 0, 0, 0, 0, 0, 30, 30, 30, 999, 0, 0] }, { sku: 'BR-1', anio: 2026, piezas: [0, 0, 0, 0, 0, 0, 0, 0, 4, 0, 0, 0] }, { sku: 'AC-1', anio: 2025, piezas: Array(12).fill(5) }];
  const dem = demanda3Meses(piv, h);
  assert.deepEqual([...dem.entries()], [['AC-1', 90], ['BR-1', 4]], 'jul–sep cerrados; octubre (en curso) no cuenta');
  const enero = demanda3Meses([{ sku: 'X', anio: 2025, piezas: [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 2, 3] }, { sku: 'X', anio: 2026, piezas: [100] }], new Date(2026, 0, 15));
  assert.equal(enero.get('X'), 6, 'cruza de año');
  const filas = [{ articulo: 'AC-1', inventario: 45, costoinventario: 900 }, { articulo: 'BR-1', inventario: 40, costoinventario: 100 }, { articulo: 'GM-1', inventario: 5, costoinventario: 50 }];
  const marcas = { 'AC-1': 'Acteck', 'BR-1': 'Balam', 'GM-1': 'Game' };
  const r = racksPorMarca(filas, marcas, 8, dem);
  assert.deepEqual(r.map((g) => [g.marca, g.dias]), [['ACTECK', 45], ['BALAM', 900], ['GAME', null]], 'piezas / demanda 3 m × 90; sin demanda → null');
  assert.deepEqual(racksPorMarca(filas, marcas, 1, dem).map((g) => [g.marca, g.dias, g.demanda3]), [['ACTECK', 45, 90], ['OTRAS', 1013, 4]], '«otras» junta la demanda');
  assert.equal(tarjetaDe({ tipo: 'rack', marca: 'BALAM' }, { cedis: { racksMarca: r } }).estado, 'rojo');
  assert.equal(tarjetaDe({ tipo: 'rack', marca: 'ACTECK' }, { cedis: { racksMarca: r } }).estado, 'verde');
  assert.equal(racksPorMarca(filas, marcas)[0].dias, null, 'sin capa de demanda no rompe');
  const m = construirModelo({ ...d, facturas: [{ cliente_key: 'x', folio: 1, fecha: '2026-10-07' }, { cliente_key: 'x', folio: 2, fecha: '2026-10-06' }], inventarioSku: filas, marcasSku: marcas, demandaSku: piv }, h);
  assert.equal(m.cedis.salidasHoy, 1, 'salidas de hoy en hora local'); assert.equal(m.cedis.racksMarca[0].dias, 45);
  assert.equal(construirModelo(d, hoy).cedis.salidasHoy >= 0, true);
});

test('tarjeta del contenedor en el mar: proveedor, ETA, piezas y POs', () => {
  const m = construirModelo({ ...d, contenedores: d.contenedores.map((c) => ({ ...c, pos: c.contenedor === 'A1' ? 3 : 0 })) }, hoy);
  const t = tarjetaDe({ tipo: 'barco', id: 'A1', titulo: 'Contenedor A1' }, m);
  assert.deepEqual(t.numeros.map(([l]) => l), ['Proveedor', 'Arribo CEDIS', 'Piezas', 'POs']);
  assert.equal(t.numeros[0][1], 'SAITAKE'); assert.equal(t.numeros[2][1], '820'); assert.equal(t.numeros[3][1], '3');
  assert.match(t.numeros[1][1], /en 20 d$/); assert.equal(t.estado, 'verde');
  const tarde = { puerto: { barcos: [{ id: 'Z', supplier: '', piezas: 5, eta: '2026-10-01', arribo: null, llegaEnDias: -4 }], tarimas: [] } };
  const tz = tarjetaDe({ tipo: 'barco', id: 'Z' }, tarde); assert.equal(tz.estado, 'rojo'); assert.match(tz.numeros[1][1], /4 d tarde$/); assert.equal(tz.numeros[0][1], '—'); assert.equal(tz.numeros[3][1], '—');
  assert.equal(tarjetaDe({ tipo: 'barco', id: 'Z' }, { puerto: { barcos: [{ id: 'Z', llegaEnDias: null }] } }).estado, 'ambar', 'sin ETA');
  assert.deepEqual(tarjetaDe({ tipo: 'barco', id: 'NO' }, m).numeros, [], 'contenedor que ya no está no rompe');
});

test('números de PO de cada contenedor en la tarjeta', () => {
  const puerto = { barcos: [{ id: 'A1', supplier: 'X', piezas: 10, llegaEnDias: 3, eta: '2026-10-10', pos: 4 }, { id: 'B2', piezas: 1, llegaEnDias: 1, pos: 2 }], tarimas: [{ id: 'T9', piezas: 2, llegaEnDias: 0, arribo: '2026-10-07' }] };
  ponerPosEnPuerto(puerto, [{ contenedor: 'A1', po: 'PO-10' }, { contenedor: 'A1 ', po: 'PO-9' }, { contenedor: 'A1', po: 'PO-10' }, { contenedor: 'A1', po: 'PO-2' }, { contenedor: 'A1', po: 'PO-11' }, { contenedor: 'T9', po: 77 }, { contenedor: 'ZZ', po: 'X' }, { contenedor: null, po: 'Y' }, { contenedor: 'B2', po: '' }]);
  assert.deepEqual(puerto.barcos[0].listaPos, ['PO-2', 'PO-9', 'PO-10', 'PO-11'], 'únicas y en orden numérico');
  assert.equal(puerto.barcos[1].listaPos, undefined); assert.deepEqual(puerto.tarimas[0].listaPos, ['77']);
  assert.equal(listaCorta(puerto.barcos[0].listaPos), 'PO-2, PO-9, PO-10 +1'); assert.equal(listaCorta([]), ''); assert.equal(listaCorta(null), '');
  const m = { puerto };
  assert.equal(tarjetaDe({ tipo: 'barco', id: 'A1' }, m).numeros[3][1], 'PO-2, PO-9, PO-10 +1');
  assert.equal(tarjetaDe({ tipo: 'barco', id: 'B2' }, m).numeros[3][1], '2', 'sin lista queda el conteo');
  assert.equal(tarjetaDe({ tipo: 'barco', id: 'T9' }, m).numeros[3][1], '77');
  assert.equal(ponerPosEnPuerto(null, []), null); assert.doesNotThrow(() => ponerPosEnPuerto({}, null));
});

test('reuniones del día en la oficina', () => {
  const h = new Date('2026-10-05T11:00:00');
  const ag = reunionesDelDia([{ titulo: 'Tarde', fecha: '2026-10-05T16:00:00' }, { titulo: 'Temprano', fecha: '2026-10-05T09:00:00', duracion_min: 30 }, { titulo: 'Ahora', fecha: '2026-10-05T10:30:00', duracion_min: 60, cliente_key: 'digitalife' }, { fecha: 'mal' }, null], h);
  assert.deepEqual(ag.map((r) => [r.titulo, r.hora, r.estado]), [['Temprano', '09:00', 'hecha'], ['Ahora', '10:30', 'en curso'], ['Tarde', '16:00', 'próxima']]);
  assert.equal(ag[1].cliente_key, 'digitalife'); assert.deepEqual(reunionesDelDia(null, h), []);
  const m = construirModelo(d, hoy); assert.equal(m.oficina.agenda.length, m.oficina.reuniones);
  const of = (agenda) => tarjetaDe({ tipo: 'oficina' }, { oficina: { personas: [], genericos: 0, reuniones: agenda.length, agenda } }).numeros[1][1];
  assert.equal(of(ag), '3 · en curso'); assert.equal(of(ag.filter((r) => r.estado !== 'en curso')), '2 · próxima 16:00'); assert.equal(of([ag[0]]), '1'); assert.equal(of([]), '0');
});

test('interior de la oficina: escritorios y sala de juntas', () => {
  assert.deepEqual(acomodoEscritorios(0), []); assert.deepEqual(acomodoEscritorios(1), [{ x: 0, z: 0 }]);
  const e = acomodoEscritorios(6); assert.equal(e.length, 6); assert.deepEqual(e[0], { x: -3.5, z: -2.6 }); assert.deepEqual(e[3], { x: 3.5, z: -2.6 }); assert.ok(Math.abs(e[5].x + 7 / 6) < 1e-9 && e[5].z === 2.6);
  assert.equal(acomodoEscritorios(40).length, 12, 'tope'); assert.ok(acomodoEscritorios(12).every((p) => Math.abs(p.x) <= 3.5 && Math.abs(p.z) <= 2.6));
  const ag = reunionesDelDia([{ titulo: 'A', fecha: '2026-10-05T09:00:00' }, { titulo: 'B', fecha: '2026-10-05T10:30:00' }, { titulo: 'C', fecha: '2026-10-05T16:00:00' }], new Date('2026-10-05T11:00:00'));
  const t = tarjetaDe({ tipo: 'sala' }, { oficina: { agenda: ag } });
  assert.deepEqual(t.numeros, [['09:00 · ✓', 'A'], ['10:30 · ahora', 'B'], ['16:00', 'C']]); assert.equal(t.estado, 'ambar');
  assert.deepEqual(tarjetaDe({ tipo: 'sala' }, { oficina: {} }).numeros, [['Reuniones hoy', 'ninguna']]);
});

test('presencia en la oficina: en reunión, de viaje o disponible', () => {
  const h = new Date('2026-10-05T11:00:00');
  const gente = [{ id: 'f' }, { id: 'k' }, { id: 'm' }, { id: 'z' }];
  const reu = [{ id: 1, titulo: 'Digitalife', fecha: '2026-10-05T10:30:00', duracion_min: 60, asistentes: [{ user_id: 'k', nombre: 'K' }] },
    { id: 2, titulo: 'Más tarde', fecha: '2026-10-05T16:00:00', asistentes: [{ user_id: 'm' }] },
    { id: 3, titulo: 'Junta f', fecha: '2026-10-05T10:45:00', creado_por: 'f' }];
  const via = [{ id: 9, tipo: 'viaje', titulo: 'CDMX', fecha: '2026-10-03T08:00:00', fecha_fin: '2026-10-06T20:00:00', asistentes: [{ user_id: 'f' }] },
    { id: 8, tipo: 'viaje', titulo: 'Ya pasó', fecha: '2026-10-01T08:00:00', fecha_fin: '2026-10-02T20:00:00', creado_por: 'z' }];
  presenciaPersonas(gente, reu, via, h);
  assert.deepEqual(gente.map((p) => p.presencia.estado), ['viaje', 'reunion', 'disponible', 'disponible']);
  assert.equal(gente[0].presencia.titulo, 'CDMX', 'el viaje gana a la reunión'); assert.equal(gente[1].presencia.titulo, 'Digitalife');
  presenciaPersonas(gente, [{ id: 7, tipo: 'viaje', titulo: 'Hoy', fecha: '2026-10-05T06:00:00', creado_por: 'm' }], [{ id: 7, tipo: 'viaje', titulo: 'Hoy', fecha: '2026-10-05T06:00:00', creado_por: 'm' }], h);
  assert.equal(gente[2].presencia.estado, 'viaje', 'viaje de un día sin fecha_fin (sin duplicar)');
  assert.doesNotThrow(() => presenciaPersonas([{ id: 'a' }], null, null, h));
  const t = tarjetaDe({ tipo: 'persona', persona: { pendientes: 1, hechas: 0, presencia: { estado: 'reunion', titulo: 'Digitalife' } } }, {});
  assert.deepEqual(t.numeros[0], ['Ahora', 'En reunión · Digitalife']);
  const m = construirModelo(d, hoy); assert.ok(m.oficina.personas.every((p) => p.presencia));
});

test('tienda visitable: top 5 SKUs de la sucursal', () => {
  const f = [{ sku: 'ac-1', importe: 100, cantidad: 2 }, { sku: 'AC-1 ', importe: 50, cantidad: 1 }, { sku: 'B', importe: 300, cantidad: 1 }, { sku: 'C', importe: 10 }, { sku: 'D', importe: 5 }, { sku: 'E', importe: 4 }, { sku: 'F', importe: 3 }, { sku: '', importe: 999 }, { sku: 'Z', importe: 0, cantidad: 0 }, null];
  const t = topSkus(f);
  assert.deepEqual(t.map((r) => r.sku), ['B', 'AC-1', 'C', 'D', 'E']); assert.deepEqual(t[1], { sku: 'AC-1', importe: 150, cantidad: 3 });
  assert.deepEqual(topSkus(null), []); assert.equal(topSkus(f, 2).length, 2);
  assert.equal(pesosCorto(1.25e6), '$1.3 M'); assert.equal(pesosCorto(15400), '$15 K'); assert.equal(pesosCorto(null), '$0');
});

test('barra superior de recursos con los números de Inicio', () => {
  const r = { cur: { fact_neta: 8.5e6 }, cuotaPeriodo: 10e6, inv: { valor: 40e6, cobertura: 95 }, cartera: { vencido: 1.2e6 }, enCamino: { valor: 3e6, pos: 7 } };
  const b = recursosBarra(r);
  assert.deepEqual(b.map((x) => [x.clave, x.ir.tipo]), [['ventas', 'oficina'], ['inventario', 'cedis'], ['cartera', 'banco'], ['embarques', 'puerto']]);
  assert.equal(b[0].pct, 85); assert.equal(b[0].tono, 'ambar'); assert.equal(b[1].extra, '95 d'); assert.equal(b[2].tono, 'rojo'); assert.equal(b[3].extra, '7 POs');
  assert.equal(recursosBarra({ cur: { fact_neta: 1 }, cuotaPeriodo: 0 })[0].pct, null, 'sin cuota');
  assert.equal(recursosBarra({ cartera: { vencido: 0 } })[0].tono, 'verde');
  assert.deepEqual(recursosBarra(null), []);
});

test('burbujas de atención sobre edificios', () => {
  const h = new Date('2026-10-05T11:00:00');
  const m = { banco: { carteraVencida: 0, pagosVencidos: 0 }, puerto: { barcos: [{ llegaEnDias: 2 }, { llegaEnDias: 9 }, { llegaEnDias: -1, arribo: '2026-10-04' }] }, oficina: { agenda: [{ titulo: 'Pcel', estado: 'próxima', ini: 11 * 60 + 10 }, { titulo: 'Tarde', estado: 'próxima', ini: 16 * 60 }] } };
  let b = burbujasAtencion(m, h);
  assert.deepEqual(b.map((x) => [x.lugar, x.nivel, x.texto]), [['puerto', 'ambar', '1 contenedor llega en ≤ 3 días'], ['oficina', 'ambar', 'Pcel en 10 min']]);
  assert.deepEqual(b[0].tag, { tipo: 'puerto' });
  b = burbujasAtencion({ ...m, banco: { carteraVencida: 1.5e6 }, puerto: { barcos: [{ llegaEnDias: -2 }, { llegaEnDias: 1 }] } }, h);
  assert.deepEqual(b.map((x) => [x.lugar, x.nivel, x.texto]), [['banco', 'rojo', 'Cartera vencida $1.5 M'], ['puerto', 'rojo', '1 contenedor con ETA vencida'], ['oficina', 'ambar', 'Pcel en 10 min']]);
  assert.equal(burbujasAtencion({ banco: { pagosVencidos: 2 } }, h)[0].texto, '2 pagos vencidos');
  assert.deepEqual(burbujasAtencion(null), []); assert.deepEqual(burbujasAtencion({}, h), []);
  assert.ok(Array.isArray(burbujasAtencion(construirModelo(d, hoy), hoy)));
});

test('burbuja del CEDIS por pedidos de cliente detenidos', () => {
  const h = new Date('2026-10-05T11:00:00');
  assert.deepEqual(burbujasAtencion({ ocDetenidas: 2 }, h).map((x) => [x.lugar, x.nivel, x.texto]), [['cedis', 'rojo', '2 pedidos de cliente detenidos']]);
  assert.equal(burbujasAtencion({ ocDetenidas: 1 }, h)[0].texto, '1 pedido de cliente detenido');
  assert.equal(construirModelo({ ...d, alertasOc: [{ tipo: 'oc_detenida' }, { tipo: 'oc_detenida' }] }, hoy).ocDetenidas, 2);
  assert.equal(construirModelo(d, hoy).ocDetenidas, 0);
});

test('misiones del día («Hoy en Acteck»)', () => {
  const h = new Date('2026-10-05T11:00:00');
  const m = { banco: { carteraVencida: 2e6 }, ocDetenidas: 1, puerto: { barcos: [{ llegaEnDias: 1 }], tarimas: [{ id: 'MSKU1', piezas: 1200 }] },
    oficina: { agenda: [{ titulo: 'Junta', hora: '09:00', ini: 9 * 60, estado: 'hecha' }, { titulo: 'Pcel', hora: '11:10', ini: 11 * 60 + 10, estado: 'próxima' }, { titulo: 'Tarde', hora: '16:00', ini: 16 * 60, estado: 'próxima' }] } };
  const ms = misionesDelDia(m, h);
  assert.deepEqual(ms.map((x) => x.texto), ['Cartera vencida $2.0 M', '1 pedido de cliente detenido', '1 contenedor llega en ≤ 3 días', '11:10 · Pcel · en 10 min', '16:00 · Tarde', 'Descargar MSKU1 · 1,200 pz', '09:00 · Junta']);
  assert.deepEqual(ms[0].ir, { tipo: 'banco' }); assert.equal(ms[5].tarjeta.tipo, 'barco'); assert.equal(ms[5].ir.tipo, 'cedis');
  assert.equal(ms[6].hecha, true); assert.equal(ms[0].hecha, false); assert.equal(ms.find((x) => x.texto.startsWith('11:10')).nivel, 'ambar');
  assert.ok(!ms.some((x) => 'orden' in x)); assert.equal(new Set(ms.map((x) => x.id)).size, ms.length);
  assert.equal(misionesDelDia(m, h, 2).length, 2);
  assert.deepEqual(misionesDelDia(null), []); assert.deepEqual(misionesDelDia({}, h), []);
  assert.ok(Array.isArray(misionesDelDia(construirModelo(d, hoy), hoy)));
});

test('capas de información por ciudad (ventas y cartera)', () => {
  const m = { distritos: [
    { ciudad: 'GDL', tiendas: [{ cuenta: 'a', importe: 120, previo: 100 }, { cuenta: 'b', importe: 0, previo: 0 }] },
    { ciudad: 'MTY', tiendas: [{ cuenta: 'b', importe: 90, previo: 100 }] },
    { ciudad: 'CDMX', tiendas: [{ cuenta: 'c', importe: 50, previo: 100 }] },
    { ciudad: 'PUE', tiendas: [{ cuenta: 'd', importe: 0, previo: 0 }] },
    { ciudad: 'QRO', tiendas: [{ cuenta: 'd', importe: 30, previo: 0 }] },
  ], kpis: { cartera: [{ cuenta: 'b', vencido: 2.5e6 }, { cuenta: 'c', vencido: 0 }] } };
  const v = capaCiudades(m, 'ventas');
  assert.deepEqual(['GDL', 'MTY', 'CDMX', 'PUE', 'QRO'].map((c) => v.porCiudad.get(c).tono), ['verde', 'ambar', 'rojo', 'gris', 'verde']);
  assert.equal(v.porCiudad.get('GDL').valor, 20); assert.equal(v.porCiudad.get('GDL').texto, '$120 · +20 % vs mes anterior');
  assert.equal(v.porCiudad.get('QRO').valor, null); assert.equal(v.leyenda.length, 4);
  const c = capaCiudades(m, 'cartera');
  assert.deepEqual(['GDL', 'MTY', 'CDMX'].map((x) => c.porCiudad.get(x).tono), ['rojo', 'rojo', 'verde']);
  assert.equal(c.porCiudad.get('GDL').texto, '1 cuenta con vencido · $2.5 M'); assert.equal(c.porCiudad.get('CDMX').texto, 'Sin cartera vencida');
  for (const l of [...v.leyenda, ...c.leyenda]) assert.ok(CAPA_TONOS[l.tono] != null);
  assert.equal(capaCiudades(m, 'inventario'), null); assert.equal(capaCiudades(null, 'ventas'), null);
  assert.equal(capaCiudades({}, 'ventas').porCiudad.size, 0);
  assert.ok(capaCiudades(construirModelo(d, hoy), 'cartera').porCiudad instanceof Map);
});

test('capa de cuota por ciudad', () => {
  const q = cuotasPorCuenta([{ cliente_erp: 10, cuenta_sellout: 'a', cuota_venta: 100 }, { cliente_erp: 11, cuenta_sellout: 'a', cuota_venta: 100 }, { cliente_erp: 20, cuenta_sellout: 'b', cuota_venta: 400 }, { cliente_erp: 30, cuenta_sellout: null, cuota_venta: 50 }],
    [{ cliente: '10', fact_neta: 80 }, { cliente: 11, fact_neta: 40 }, { cliente: 20, fact_neta: 100 }, { cliente: 99, fact_neta: 1e6 }]);
  assert.deepEqual(q.get('a'), { venta: 120, cuota: 200 }); assert.deepEqual(q.get('b'), { venta: 100, cuota: 400 }); assert.equal(q.size, 2);
  const m = { hoyIso: '2026-10-15', cuotas: q, distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a' }] }, { ciudad: 'MTY', tiendas: [{ cuenta: 'b' }] }, { ciudad: 'PUE', tiendas: [{ cuenta: 'z' }] }, { ciudad: 'CDMX', tiendas: [{ cuenta: 'a' }, { cuenta: 'b' }] }] };
  const c = capaCiudades(m, 'cuota'); // ritmo al 15 de octubre = 15/31 ≈ 48 %
  assert.deepEqual(['GDL', 'MTY', 'PUE', 'CDMX'].map((x) => c.porCiudad.get(x).tono), ['verde', 'rojo', 'gris', 'rojo']);
  assert.equal(capaCiudades({ ...m, cuotas: new Map([['a', { venta: 85, cuota: 200 }]]) }, 'cuota').porCiudad.get('GDL').tono, 'ambar'); // 43 % vs ritmo 48 %
  assert.equal(c.porCiudad.get('GDL').valor, 60); assert.equal(c.porCiudad.get('CDMX').valor, 37);
  assert.equal(c.porCiudad.get('GDL').texto, '60 % de la cuota del mes (1 cuenta) · ritmo 48 %');
  assert.equal(capaCiudades({ distritos: m.distritos }, 'cuota').porCiudad.get('GDL').tono, 'gris'); // sin datos de cuota: falla sola
  assert.equal(cuotasPorCuenta(null, null).size, 0);
});

test('bitácora en vivo: eventos recientes', () => {
  const h = new Date('2026-10-07T11:00:00');
  const m = { hoyIso: '2026-10-07',
    camiones: [{ folio: 'F1', cliente: 'Digitalife', ciudad: 'GDL', monto: 750000, fecha: '2026-10-05' }, { folio: 'guía 9', cliente: 'PCEL', ciudad: 'MTY', fecha: '2026-10-07', envio: true, paqueteria: 'DHL' }, { folio: 'F2', cliente: 'X', ciudad: 'GDL', monto: 1, fecha: '2026-10-09' }],
    puerto: { tarimas: [{ id: 'MSKU1', piezas: 1200, arribo: '2026-10-06' }], barcos: [{ id: 'B2', arribo: null }, { id: 'MSKU1', piezas: 1200, arribo: '2026-10-06' }] },
    oficina: { agenda: [{ titulo: 'Junta', hora: '09:00', ini: 540, estado: 'hecha' }, { titulo: 'Pcel', hora: '10:30', ini: 630, estado: 'en curso' }, { titulo: 'Tarde', hora: '16:00', ini: 960, estado: 'próxima' }] } };
  const b = bitacoraEventos(m, h);
  assert.deepEqual(b.map((x) => [x.cuando, x.texto]), [['10:30', 'Empezó Pcel'], ['09:00', 'Fue Junta'], ['hoy', 'Salió guía 9 a PCEL · DHL'], ['ayer', 'Llegó MSKU1 al CEDIS · 1,200 pz'], ['hace 2 d', 'Factura F1 · Digitalife · $750 K']]);
  assert.equal(b[4].grande, true); assert.equal(b[2].grande, false); assert.deepEqual(b[2].ir, { tipo: 'ciudad', ciudad: 'MTY' });
  assert.equal(b[3].tarjeta.tipo, 'barco'); assert.equal(b[2].tarjeta, null); assert.ok(!b.some((x) => 'clave' in x));
  assert.equal(bitacoraEventos(m, h, 2).length, 2);
  assert.deepEqual(bitacoraEventos(null), []); assert.deepEqual(bitacoraEventos({}, h), []);
  assert.ok(Array.isArray(bitacoraEventos(construirModelo(d, hoy), hoy)));
});

test('bitácora: pagos registrados y última sincronización', () => {
  const h = new Date('2026-10-07T11:00:00');
  const m = { hoyIso: '2026-10-07', camiones: [{ folio: 'F1', cliente: 'Digitalife', ciudad: 'GDL', monto: 1000, fecha: '2026-10-07' }],
    pagosHechos: [{ id: 7, cliente: 'pcel', concepto: 'Rebate', monto: 600000, pagado_at: '2026-10-07T10:15:00' }, { id: 8, cliente: 'x', monto: 10, pagado_at: '2026-10-05T09:00:00' }, { id: 9, monto: 1, pagado_at: 'mal' }],
    ultimaSync: { status: 'ok', created_at: '2026-10-07T10:40:00' } };
  const b = bitacoraEventos(m, h);
  assert.deepEqual(b.map((x) => [x.cuando, x.texto]), [['10:40', 'Se actualizaron los datos · ok'], ['10:15', 'Pago registrado · pcel · Rebate · $600 K'], ['hoy', 'Factura F1 · Digitalife · $1 K'], ['hace 2 d', 'Pago registrado · x · $10']]);
  assert.equal(b[0].ir, null); assert.deepEqual(b[1].ir, { tipo: 'banco' }); assert.equal(b[1].grande, true);
  assert.deepEqual(bitacoraEventos({ hoyIso: '2026-10-07', ultimaSync: { created_at: null } }, h), []);
});

test('pensamientos de tiendas', () => {
  const T = (cuenta, sucursal, importe, previo) => ({ cuenta, nombreCuenta: cuenta.toUpperCase(), sucursal, importe, previo });
  const m = { hoyIso: '2026-10-15', kpis: { cartera: [{ cuenta: 'mala', vencido: 10 }] }, cuotas: new Map([['q', { venta: 60, cuota: 100 }]]),
    distritos: [
      { ciudad: 'GDL', tiendas: [T('a', 'Centro', 200, 100), T('mala', 'Sur', 50, 50)] },
      { ciudad: 'MTY', tiendas: [T('b', 'Valle', 0, 80)] },
      { ciudad: 'CDMX', tiendas: [T('c', 'Polanco', 50, 100), T('d', 'Roma', 100, 100)] },
      { ciudad: 'PUE', tiendas: [T('q', 'Angelópolis', 100, 100)] },
      { ciudad: 'QRO', tiendas: [T('e', 'Juriquilla', 100, 100)] },
      { ciudad: 'LEO', tiendas: [T('f', 'Plaza', 150, 100)] },
    ] };
  const p = pensamientos(m, 10);
  assert.deepEqual(p.map((x) => [x.ciudad, x.tono, x.texto]), [['GDL', 'rojo', 'Tengo pagos vencidos'], ['MTY', 'rojo', 'Este mes no he vendido nada'], ['CDMX', 'ambar', 'Vendo 50 % menos que el mes pasado'], ['LEO', 'verde', '¡Voy 50 % arriba del mes pasado!'], ['PUE', 'verde', 'Voy arriba de mi cuota']]);
  assert.equal(p[0].nombre, 'MALA · Sur'); assert.equal(p[0].sucursal, 'Sur'); assert.ok(!p.some((x) => 'peso' in x));
  assert.equal(pensamientos(m).length, 5); assert.equal(pensamientos(m, 2).length, 2);
  assert.deepEqual(pensamientos(null), []); assert.deepEqual(pensamientos({}), []);
  assert.ok(Array.isArray(pensamientos(construirModelo(d, hoy))));
});

test('vendedores: circuito por las sedes de sus clientes y tarjeta con ventas del mes', () => {
  const ds = [{ cliente: 'A', ciudad: 'GDL' }, { cliente: 'B', ciudad: 'GDL' }, { cliente: 'C', ciudad: 'MTY' }, { cliente: 'D', ciudad: 'XXX' }, { cliente: 'E', ciudad: 'CDMX' }, { cliente: 'F', ciudad: 'PUE' }];
  assert.deepEqual(circuitoVendedor(ds, (c) => c !== 'XXX').map((x) => x.cliente), ['A', 'C', 'E']);
  assert.deepEqual(circuitoVendedor(ds, () => false), []); assert.deepEqual(circuitoVendedor(null), []);
  assert.deepEqual(tramoActual(0, 3), { i: 0, q: 0, tramos: 4 }); assert.deepEqual(tramoActual(.5, 3), { i: 2, q: 0, tramos: 4 });
  assert.equal(tramoActual(.99, 3).i, 3); assert.equal(tramoActual(1.25, 1).i, 0); assert.equal(tramoActual(-.25, 3).i, 3);
  assert.ok(Math.abs(tramoActual(.3, 1).q - .6) < 1e-9);
  const dd = { ...d, vendedoresErp: [{ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1, vendedor: 'JUAN PEREZ', cliente_key: '1', cliente_nombre: 'Uno', fact_neta: 100 }, { anio: hoy.getFullYear(), mes: hoy.getMonth() === 0 ? 2 : hoy.getMonth(), vendedor: 'JUAN PEREZ', cliente_key: '1', cliente_nombre: 'Uno', fact_neta: 50 }] };
  const m = construirModelo(dd, hoy); const v = m.vendedoresRuta[0];
  assert.equal(v.totalMes, 100); assert.equal(v.total, 150);
  const tj = tarjetaDe({ tipo: 'vendedorErp', titulo: v.nombre }, m);
  assert.deepEqual(tj.numeros.slice(0, 3).map((x) => x[0]), ['Ventas del mes', 'Ventas del año', 'Clientes']); assert.equal(tj.numeros[0][1], '$100'); assert.equal(tj.estado, 'verde');
});

test('tarjeta del camión: factura o envío', () => {
  const m = { hoyIso: '2026-10-07', camiones: [{ folio: 'F1', cliente: 'Digitalife', ciudad: 'SAN LUIS POTOSI', monto: 1.25e6, piezas: 1200, fecha: '2026-10-06' }, { folio: 'guía 9', cliente: 'PCEL', ciudad: 'MONTERREY', fecha: '2026-09-30', envio: true, paqueteria: 'DHL', monto: 0, piezas: 0 }] };
  let tj = tarjetaDe({ tipo: 'camion', folio: 'F1', titulo: 'Factura F1' }, m);
  assert.deepEqual(tj.numeros, [['Cliente', 'Digitalife'], ['Factura', '$1.3 M'], ['Piezas', '1,200'], ['Salió', '2026-10-06 · ayer']]); assert.equal(tj.estado, 'verde');
  tj = tarjetaDe({ tipo: 'camion', folio: 'guía 9' }, m);
  assert.deepEqual(tj.numeros, [['Cliente', 'PCEL'], ['Paquetería', 'DHL'], ['Salió', '2026-09-30 · hace 7 d'], ['Destino', 'Monterrey']]); assert.equal(tj.estado, 'ambar');
  assert.deepEqual(tarjetaDe({ tipo: 'camion', folio: 'nada', titulo: 'X' }, m).numeros, []);
});

test('barcos por ETA real: atracado, en fila, llegando, mar abierto', () => {
  const r = rumboBarcos([{ llegaEnDias: 0 }, { llegaEnDias: -3 }, { llegaEnDias: 4 }, { llegaEnDias: 20, progreso: .9 }, { llegaEnDias: null, progreso: .3 }, { llegaEnDias: -5, arribo: '2026-10-01', progreso: .2 }, { llegaEnDias: 8, progreso: -1 }]);
  assert.deepEqual(r.map((x) => [x.modo, x.muelle]), [['esperando', 1], ['atracado', 0], ['llegando', null], ['navegando', null], ['navegando', null], ['navegando', null], ['navegando', null]]);
  assert.equal(r[2].avance, .5); assert.equal(r[3].avance, .6); assert.equal(r[4].avance, .3); assert.equal(r[6].avance, 0);
  assert.deepEqual(rumboBarcos(null), []);
});

test('cuentas sin sucursal repartidas por estado', () => {
  const f = [{ cuenta: 'x', anio: 2026, mes: 10, estado: 'Nuevo León', importe: 100 }, { cuenta: 'x', anio: 2026, mes: 9, estado: 'NUEVO LEON', importe: 50 }, { cuenta: 'x', anio: 2026, mes: 10, estado: 'Jalisco', importe: 999 },
    { cuenta: 'x', anio: 2026, mes: 9, estado: 'Yucatán', importe: 30 }, { cuenta: 'x', anio: 2025, mes: 10, estado: 'Puebla', importe: 70 }, { cuenta: 'y', anio: 2026, mes: 10, estado: 'Puebla', importe: 70 }, { cuenta: 'x', anio: 2026, mes: 10, estado: 'SIN ESTADO', importe: 5 }];
  const opt = { anio: 2026, mes: 10, anioPrev: 2026, mesPrev: 9, sede: CIUDAD_POR_ESTADO.JALISCO };
  const r = repartoPorEstado('x', f, opt);
  assert.deepEqual(r.map((o) => [o.ciudad, o.importe, o.previo]), [[CIUDAD_POR_ESTADO['NUEVO LEON'], 100, 50], [CIUDAD_POR_ESTADO.YUCATAN, 0, 30]]);
  assert.equal(repartoPorEstado('x', f, { ...opt, max: 1 }).length, 1); assert.deepEqual(repartoPorEstado('z', f, opt), []); assert.deepEqual(repartoPorEstado('x', null, opt), []);
});

test('cadena de punta a punta: volumen por tramo y dónde se atora', () => {
  const m = { hoyIso: '2026-10-08', puerto: { barcos: [{ llegaEnDias: 6, piezas: 1000 }, { llegaEnDias: null, piezas: 500 }, { llegaEnDias: -5, piezas: 80 }, { llegaEnDias: 0, piezas: 20 }], tarimas: [{}] },
    cedis: { piezas: 50000, dias: 95 }, camiones: [{ piezas: 300, fecha: '2026-10-07' }, { envio: true, fecha: '2026-10-01', piezas: 0 }],
    distritos: [{ tiendas: [{ vendio: true }, { vendio: false }, { vendio: true, reparto: true }], clientesFinales: { n: 120, importe: 2.5e6 } }, { tiendas: [{ vendio: true }] }] };
  const r = cadenaSuministro(m);
  assert.deepEqual(r.tramos.map((t) => [t.clave, t.estado]), [['mar', 'verde'], ['puerto', 'rojo'], ['cedis', 'ambar'], ['camion', 'ambar'], ['tienda', 'ambar'], ['cliente', 'verde']]);
  assert.equal(r.tramos[0].volumen, '2 barcos · 1,500 pzs'); assert.equal(r.tramos[1].motivo, '1 barco con más de 3 días de atraso');
  assert.equal(r.tramos[4].volumen, '2 de 3 vendieron'); assert.equal(r.tramos[5].volumen, '120 · $2.5 M'); assert.equal(r.atasco.clave, 'puerto');
  const v = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: [] }, cedis: { dias: 30 }, camiones: [], distritos: [] });
  assert.deepEqual(v.tramos.map((t) => t.estado), ['gris', 'verde', 'verde', 'gris', 'gris', 'gris']); assert.equal(v.atasco, null);
  assert.deepEqual(cadenaSuministro(null), { tramos: [], atasco: null });
});

test('cintas de la cadena: mar, puerto y ciudades con grosor y tono', () => {
  const m = { hoyIso: '2026-10-08', puerto: { barcos: [{ llegaEnDias: -5 }, { llegaEnDias: 3 }], tarimas: [] }, cedis: { dias: 30 },
    camiones: [{ ciudad: 'MONTERREY', fecha: '2026-10-07' }, { ciudad: 'MONTERREY', fecha: '2026-10-07' }, { ciudad: 'PUEBLA', envio: true, fecha: '2026-09-30' }],
    distritos: [{ ciudad: 'MONTERREY', tiendas: [{ vendio: true }] }, { ciudad: 'PUEBLA', tiendas: [{ vendio: true }] }, { ciudad: 'LEON', tiendas: [{ vendio: false }, { vendio: false }] }, { ciudad: 'MERIDA', tiendas: [{ reparto: true, vendio: true }] }] };
  const c = cintasCadena(m);
  assert.deepEqual(c.map((x) => [x.de, x.a, x.tono, x.peso]), [['mar', 'puerto', 'rojo', 2], ['puerto', 'cedis', 'rojo', 2], ['cedis', 'MONTERREY', 'verde', 4], ['cedis', 'PUEBLA', 'ambar', 3], ['cedis', 'LEON', 'rojo', 1]]);
  assert.equal(cintasCadena(m, 1).length, 3); assert.deepEqual(cintasCadena(null), []);
});

test('cuota vs ritmo en tarjetas de ciudad y tienda', () => {
  const m = { hoyIso: '2026-10-15', cuotas: new Map([['a', { venta: 100, cuota: 200 }], ['b', { venta: 10, cuota: 100 }]]),
    distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', nombreCuenta: 'A', sucursal: 'S1', importe: 5, previo: 1, vendio: true, vendioMes: true }, { cuenta: 'b', nombreCuenta: 'B', sucursal: 'S2', importe: 0, previo: 0, vendio: false }, { cuenta: 'c', nombreCuenta: 'C', sucursal: 'S3', importe: 1, previo: 0, vendio: true }] }] };
  assert.deepEqual(cuotaRitmo(m, ['a', 'a', 'c']), { tono: 'verde', pct: 50, ritmo: 48, n: 1, venta: 100, cuota: 200 });
  assert.equal(cuotaRitmo(m, ['a', 'b']).pct, 37); assert.equal(cuotaRitmo(m, ['a', 'b']).tono, 'rojo'); assert.equal(cuotaRitmo({ ...m, hoyIso: '2026-10-13' }, ['a', 'b']).tono, 'ambar'); assert.equal(cuotaRitmo(m, ['b']).tono, 'rojo');
  assert.equal(cuotaRitmo(m, ['c']), null); assert.equal(cuotaRitmo({}, ['a']), null);
  let tj = tarjetaDe({ tipo: 'ciudad', ciudad: 'GDL', titulo: 'GDL' }, m);
  assert.deepEqual(tj.numeros[2], ['Cuota del mes', '37 % · ritmo 48 %']); assert.equal(tj.cuota, 'rojo');
  tj = tarjetaDe({ tipo: 'tienda', ciudad: 'GDL', cuenta: 'a', titulo: 'A · S1' }, m);
  assert.deepEqual(tj.numeros[2], ['Cuota de la cuenta', '50 % · ritmo 48 %']); assert.equal(tj.cuota, 'verde');
  tj = tarjetaDe({ tipo: 'tienda', ciudad: 'GDL', cuenta: 'c', titulo: 'C · S3' }, m);
  assert.ok(!tj.numeros.some((x) => /Cuota/.test(x[0]))); assert.equal(tj.cuota, undefined);
});

test('celebraciones: cuota cruzada y tiendas que vuelven a vender', () => {
  const ds = [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', sucursal: 'S1', vendioMes: true, previo: 0, importe: 5 }, { cuenta: 'b', sucursal: 'S2', vendioMes: true, previo: 10, importe: 9 }, { cuenta: 'c', sucursal: 'S3', vendioMes: false, previo: 0, importe: 0 }] },
    { ciudad: 'MTY', tiendas: [{ cuenta: 'd', sucursal: 'S4', vendioMes: true, importe: 20 }, { cuenta: 'e', sucursal: 'Clientes en X', vendioMes: true, previo: 0, importe: 50, reparto: true }] }];
  let r = celebraciones({ cuotas: new Map([['a', { venta: 60, cuota: 100 }], ['b', { venta: 50, cuota: 0 }]]), distritos: ds });
  assert.deepEqual(r.cuota, { pct: 110 }); assert.deepEqual(r.tiendas.map((t) => [t.ciudad, t.sucursal]), [['MTY', 'S4'], ['GDL', 'S1']]);
  r = celebraciones({ cuotas: new Map([['a', { venta: 99, cuota: 100 }]]), distritos: ds }, 1);
  assert.equal(r.cuota, null); assert.equal(r.tiendas.length, 1);
  assert.deepEqual(celebraciones(null), { cuota: null, tiendas: [] });
});

test('momentosTiempo: hoy, ayer, hace 7 días e inicio de mes sin repetir día', () => {
  let r = momentosTiempo(new Date(2026, 9, 8, 0, 30));
  assert.deepEqual(r.map((m) => [m.id, m.iso]), [['hoy', '2026-10-08'], ['ayer', '2026-10-07'], ['semana', '2026-10-01']]);
  assert.equal(r[1].fecha.getHours(), 0);
  r = momentosTiempo(new Date(2026, 9, 20, 9));
  assert.deepEqual(r.map((m) => m.iso), ['2026-10-20', '2026-10-19', '2026-10-13', '2026-10-01']);
  assert.deepEqual(momentosTiempo(new Date(2026, 9, 1, 9)).map((m) => m.id), ['hoy', 'ayer', 'semana']);
});

test('datosEnFecha: regresa facturas, envíos, contenedores y ventas a esa fecha', () => {
  const crudos = { facturas: [{ folio: 1, fecha: '2026-09-28' }, { folio: 2, fecha: '2026-10-03' }],
    envios: [{ fecha_surtida: '2026-09-29', fecha_entregada: '2026-10-02' }, { fecha_surtida: '2026-10-04' }],
    contenedores: [{ contenedor: 'A', fecha_emision: '2026-08-01', arribo_cedis: '2026-10-05', estatus: 'CONCLUIDO' }, { contenedor: 'B', fecha_emision: '2026-10-02' }],
    sucursales: [{ anio: 2026, mes: 9, importe: 1 }, { anio: 2026, mes: 10, importe: 2 }], agendaHoy: [{ id: 1 }], inventario: [{ inv_actual: 5 }] };
  const r = datosEnFecha(crudos, new Date(2026, 8, 30, 12));
  assert.deepEqual(r.facturas.map((x) => x.folio), [1]);
  assert.equal(r.envios.length, 1); assert.equal(r.envios[0].fecha_entregada, null);
  assert.deepEqual(r.contenedores.map((c) => [c.contenedor, c.arribo_cedis, c.estatus]), [['A', null, 'EN TRANSITO']]);
  assert.deepEqual(r.sucursales.map((x) => x.mes), [9]); assert.deepEqual(r.agendaHoy, []); assert.equal(r.inventario, crudos.inventario);
  assert.ok(r._aprox.includes('inventario'));
  assert.equal(datosEnFecha(crudos, null), crudos);
  // reconstruida: ya no hay camión de la factura 2 y el contenedor A sigue en camino
  const m = construirModelo({ ...d, ...datosEnFecha({ ...d, facturas: crudos.facturas, contenedores: crudos.contenedores }, new Date(2026, 8, 30, 12)) }, new Date(2026, 8, 30, 12));
  assert.equal(m.hoyIso, '2026-09-30'); assert.ok(!m.camiones.some((c) => c.folio === 2)); assert.ok(m.puerto.barcos.some((b) => b.id === 'A'));
});

test('eventosCalendario: cierre de mes, Buen Fin, regreso a clases y Navidad', () => {
  const ids = (t) => eventosCalendario(t).map((e) => `${e.id}:${e.dias}`);
  assert.deepEqual(ids(new Date(2026, 9, 8)), []);
  assert.deepEqual(ids(new Date(2026, 9, 29, 23)), ['cierre:2']);
  assert.equal(eventosCalendario(new Date(2026, 9, 31)).find((e) => e.id === 'cierre').texto, 'Hoy cierra el mes');
  // 2026: 3.er lunes de noviembre = 16 → Buen Fin 13–16 nov
  assert.deepEqual(ids(new Date(2026, 10, 1)), ['buenfin:12']); assert.match(eventosCalendario(new Date(2026, 10, 1))[0].texto, /13–16 nov/);
  assert.deepEqual(ids(new Date(2026, 10, 14)), ['buenfin:0']); assert.deepEqual(ids(new Date(2026, 10, 17)), []);
  assert.deepEqual(ids(new Date(2025, 10, 14)), ['buenfin:0']); // 2025: 14–17 nov
  assert.deepEqual(ids(new Date(2026, 7, 10)), ['clases:0']); assert.deepEqual(ids(new Date(2026, 6, 14)), []);
  assert.deepEqual(ids(new Date(2026, 11, 26)), ['cierre:5']); assert.deepEqual(ids(new Date(2026, 11, 20)), ['navidad:5']);
});

test('camionesTemporada: facturas de Buen Fin y de la semana del cierre', () => {
  const cam = [{ folio: 1, fecha: '2026-11-13' }, { folio: 2, fecha: '2026-11-10' }, { folio: 3, fecha: '2026-11-14', envio: true }, { folio: 4, fecha: '2026-11-27T10:00' }, { folio: 5 }];
  assert.deepEqual([...camionesTemporada({ camiones: cam }, new Date(2026, 10, 14))].map(([f, e]) => [f, e.id]), [[1, 'buenfin']]);
  assert.deepEqual([...camionesTemporada({ camiones: cam }, new Date(2026, 10, 10))].map(([f]) => f), []); // Buen Fin aún no empieza
  assert.deepEqual([...camionesTemporada({ camiones: cam }, new Date(2026, 10, 28))].map(([f, e]) => [f, e.texto]), [[4, 'Cierre de mes']]);
  assert.equal(camionesTemporada(null).size, 0);
  assert.equal(eventosCalendario(new Date(2026, 9, 29))[0].desde, '2026-10-25');
});

test('ventanas de la oficina según presencia', () => {
  const cuenta = (a) => a.filter(Boolean).length;
  assert.equal(cuenta(ventanasOficina([])), 8);
  const ps = (...e) => e.map((estado) => ({ presencia: { estado } }));
  assert.equal(cuenta(ventanasOficina(ps('disponible', 'reunion', 'viaje', 'viaje'))), 6);
  assert.equal(cuenta(ventanasOficina(ps('viaje', 'viaje'))), 0);
  assert.equal(cuenta(ventanasOficina(ps('disponible'))), 12);
  assert.deepEqual(ventanasOficina(ps('disponible', 'viaje'), 4), [false, true, false, true]); // repartidas, no amontonadas
});

test('forma de árbol estable y variada', () => {
  assert.deepEqual(formaArbol(3.2, -7.5), formaArbol(3.2, -7.5));
  const cuenta = {}; for (let i = 0; i < 400; i++) { const f = formaArbol(i * 1.7, i * -2.3).forma; cuenta[f] = (cuenta[f] || 0) + 1; }
  assert.deepEqual(Object.keys(cuenta).sort(), ['arbusto', 'palma', 'pino', 'redondo']);
  assert.ok(cuenta.pino > cuenta.palma && cuenta.redondo > cuenta.arbusto);
  assert.ok([0, 1].includes(formaArbol().tono));
});
