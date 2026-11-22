// Acteck Ciudad · modelo puro. node --test scripts/test-ciudad-modelo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { comoLista, cuantos, construirModelo, ciudadDeSucursal, CIUDADES, posDe, capasVisibles, DETALLE, esChico, etiquetasSinEncimar, encuadre, campus, encimaDelCampus, juntarCapas, capaVisible, vistaMapa, EXTREMOS_MEXICO, ZOOM_MAX, ZOOM_MIN, zoomEnRango, pinCiudad, enLaBase, vistaCiudad, nivelVista, ciudadesTop, planoMini, leerVista, claveVista, tarjetaDe, resumenBanco, resumenTorre, racksPorMarca, acomodoRacks, demanda3Meses, ponerPosEnPuerto, listaCorta, reunionesDelDia, acomodoEscritorios, presenciaPersonas, topSkus, pesosCorto, recursosBarra, burbujasAtencion, misionesDelDia, capaCiudades, CAPA_TONOS, cuotasPorCuenta, bitacoraEventos, pensamientos, circuitoVendedor, tramoActual, rumboBarcos, repartoPorEstado, CIUDAD_POR_ESTADO, cadenaSuministro, cintasCadena, cuotaRitmo, celebraciones, momentosTiempo, datosEnFecha, eventosCalendario, camionesTemporada, ventanasOficina, formaArbol, rebote, saltito, RECORRIDO, recorridoVisto, capasSonido, gestoDosDedos, paseantesDistrito, nombreCiudad, cifraCorta, norm, PX, K, aPx, PX_ORIGEN, pxAEscena, ORIGEN, COLOR_CUENTA, hexCss, SEDE_POR_CUENTA, RECORRIDO_CLAVE, fechaHoy, sinNulos, fechaIso, plural, enMinutos, llegaBarco, numero, unirTexto, tituloCamion, vaA, nombrePersona, porcentaje, dsoTexto, piezasTexto, haceDias, diaLocal, piezasMes } from '../src/modules/ciudad/modelo.js';

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
  for (const x of ['A', 'LA', 'MEX']) assert.equal(ciudadDeSucursal(x).ciudad, null, `«${x}» es muy corto para adivinar la ciudad`);
  assert.equal(ciudadDeSucursal('JUAREZ').ciudad, 'CIUDAD JUAREZ', 'un nombre parcial largo sí empata');
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
  for (const mg of [NaN, -3, 'x', null, '']) assert.equal(encimaDelCampus(c, posDe(CIUDADES.LEON), 7, 4.5, cajaGDL, mg), true, `margen ${String(mg)} usa el de omisión`);
  assert.equal(encimaDelCampus(c, posDe(CIUDADES.MONTERREY), 7, 4.5, cajaGDL, '2'), false, 'margen en texto');
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
  assert.equal(pinCiudad({ ciudad: 'SAN LUIS POTOSI', tiendas: [] }).texto, 'San Luis Potosí · 🏬 0', 'sin camiones no se muestra el camión');
  assert.equal(pinCiudad(null, null).activas, 0, 'datos vacíos no rompen');
  assert.equal(pinCiudad({ ciudad: 'LEON', tiendas: 'x' }, [{ ciudad: ' León ' }]).texto, 'León · 🏬 0 · 🚚 1', 'tiendas no-lista no rompen; ciudad empata con norm');
  assert.equal(pinCiudad({ tiendas: [] }, [{}, { ciudad: null }]).llegando, 0, 'distrito sin ciudad no junta camiones sin ciudad');
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
  assert.equal(enLaBase({ cx: NaN, cz: 0, zoom: 10 }, b), true, 'centro inválido no salta a lejos'); assert.equal(enLaBase({ cx: 0, cz: 0, zoom: 10 }, { ...b, cx: undefined }), true, 'base sin centro no rompe');
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
  assert.deepEqual(ciudadesTop({ distritos: 'x' }), [], 'distritos no-lista no rompen');
  assert.deepEqual(ciudadesTop({ distritos: [{ ciudad: 'LEON', tiendas: {} }], camiones: [{ ciudad: 'LEON' }] }).map((c) => [c.ciudad, c.tiendas, c.actividad]), [['LEON', 0, 1]], 'tiendas no-lista cuentan 0');
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
  assert.doesNotThrow(() => resumenTorre(props, avisos, 'basura'), 'fecha inválida no rompe');
  assert.equal(resumenTorre([{ estatus: 'enviada', forecast_propuesta_lineas: [null, { confirmado: true }] }], [null], hoyIso).confirmadas, 1, 'líneas nulas se ignoran');
  assert.equal(resumenBanco([null, { vencido: 5 }], [], hoyIso).cuentasVencidas, 1, 'cartera con nulos no rompe');
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
  assert.deepEqual(acomodoRacks('basura'), []); assert.deepEqual(acomodoRacks([null, { marca: '  ' }]), [], 'marca vacía no cuenta');
  assert.ok(acomodoRacks(racks, { cols: 0 }).every((r) => Number.isFinite(r.x) && Number.isFinite(r.z)), 'cols 0 no da NaN');
  assert.deepEqual(acomodoRacks(racks, { ancho: 12, largo: 8, cols: 3.9 }).map((r) => [r.x, r.z]), [[-4, -2], [0, -2], [4, -2], [-4, 2]], 'cols decimal → 3');
  assert.ok(acomodoRacks(racks, { maxNiveles: NaN }).every((r) => r.niveles === 1), 'maxNiveles inválido → 1');
  assert.equal(acomodoRacks([{ marca: 'A', valor: 10 }, { marca: 'B', valor: -5 }])[1].niveles, 1, 'valor negativo = 1 nivel');
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
  const fs = [{ folio: 3, fecha: ' 2026-10-07T10:00:00' }, { folio: 4, fecha: new Date(2026, 9, 7, 9) }, { folio: 5, fecha: 'pendiente' }, null, { folio: 6, fecha: '2026-10-06' }];
  assert.equal(construirModelo({ ...d, facturas: fs }, h).cedis.salidasHoy, 2, '(4.7.20) espacios y Date cuentan; ilegible y nulo no');
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
  assert.equal(listaCorta(['PO-1', ' PO-1 ', '', null, 'PO-2']), 'PO-1, PO-2'); assert.equal(listaCorta(['a', 'b', 'a', 'c', 'd', undefined], 2), 'a, b +2'); assert.equal(listaCorta('PO-1'), '');
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
  assert.equal(acomodoEscritorios(3.7).length, 3); assert.deepEqual(acomodoEscritorios(3.7), acomodoEscritorios(3)); assert.deepEqual(acomodoEscritorios('abc'), []);
  assert.ok(acomodoEscritorios(4, { cols: 0 }).every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)), 'cols 0 no da NaN');
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
  { const b2 = recursosBarra({ cur: { fact_neta: '$800,000' }, cuotaPeriodo: ' 1,000,000 ', cartera: { vencido: '$5,000' } }); // 4.7.14
    assert.equal(b2[0].valor, 800000); assert.equal(b2[0].pct, 80); assert.equal(b2[0].tono, 'ambar'); assert.equal(b2[1].valor, 5000); assert.equal(b2[1].tono, 'rojo');
    for (const v of ['', '  ', 'x', true, null, [5], NaN, Infinity]) assert.equal(recursosBarra({ cartera: { vencido: v } })[0].tono, 'verde', `vencido ${String(v)}`); }
  for (const c of [NaN, Infinity, '', 'x']) assert.equal(recursosBarra({ inv: { valor: 1, cobertura: c } })[0].extra, null, `cobertura ${c}`);
  { const v = recursosBarra({ cur: { fact_neta: 12500 }, cuotaPeriodo: 1000 })[0]; assert.equal(v.pct, 1250); assert.equal(v.pctTexto, '1,250 %', '4.7.25'); // 4.7.25
    assert.equal(recursosBarra({ cur: { fact_neta: 1 }, cuotaPeriodo: 0 })[0].pctTexto, null); assert.equal(recursosBarra({ inv: { valor: 1, cobertura: 1200.4 } })[0].extra, '1,200 d'); }
  assert.equal(recursosBarra({ inv: { valor: 1, cobertura: 94.6 } })[0].extra, '95 d'); assert.equal(recursosBarra({ inv: { valor: 1, cobertura: 0 } })[0].extra, '0 d');
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
  // 4.7.10: conteo en texto o decimal ya no dice «1 pedidos …» / «1.4 pedidos»; muchos con miles es-MX
  assert.equal(burbujasAtencion({ ocDetenidas: '1' }, h)[0].texto, '1 pedido de cliente detenido');
  assert.equal(burbujasAtencion({ ocDetenidas: 1.4 }, h)[0].texto, '1 pedido de cliente detenido');
  assert.equal(burbujasAtencion({ ocDetenidas: 1200 }, h)[0].texto, '1,200 pedidos de cliente detenidos');
  assert.equal(burbujasAtencion({ puerto: { barcos: [{ llegaEnDias: 1 }, { llegaEnDias: 2 }] } }, h)[0].texto, '2 contenedores llegan en ≤ 3 días');
  assert.equal(burbujasAtencion({ puerto: { barcos: [{ llegaEnDias: -1 }, { llegaEnDias: -3 }] } }, h)[0].texto, '2 contenedores con ETA vencida');
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
  // 4.3.8: reuniones y tarimas nulas se saltan, sin hora de inicio no sale «en NaN min» (va tras las de hoy) y una ya pasada no dice «en -N min».
  const m2 = { oficina: { agenda: [null, { titulo: 'Sin hora', hora: '—', estado: 'próxima' }, { titulo: 'Pasada', hora: '10:30', ini: 10 * 60 + 30, estado: 'próxima' }] }, puerto: { tarimas: [null, { id: 'T1', piezas: 5 }] } };
  const ms2 = misionesDelDia(m2, h);
  assert.deepEqual(ms2.map((x) => x.texto), ['10:30 · Pasada', '— · Sin hora', 'Descargar T1 · 5 pz']);
  assert.ok(!ms2.some((x) => /NaN|en -/.test(x.texto)));
  // 4.7.35: tarima sin id ya no dice «Descargar undefined» / «Contenedor undefined»; con espacios se limpia; tarimas que no son lista no truenan.
  const ms3 = misionesDelDia({ puerto: { tarimas: [{ piezas: 1200 }, { id: ' MSKU9 ', piezas: '3' }] } }, h);
  assert.deepEqual(ms3.map((x) => x.texto), ['Descargar un contenedor · 1,200 pz', 'Descargar MSKU9 · 3 pz']);
  assert.deepEqual(ms3.map((x) => x.tarjeta.titulo), ['Contenedor', 'Contenedor MSKU9']);
  assert.ok(!ms3.some((x) => /undefined|null/.test(x.texto + x.id)));
  assert.deepEqual(misionesDelDia({ puerto: { tarimas: 'abc' } }, h), []);
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
  // renglones nulos (4.3.6): distritos, tiendas y cartera null se saltan sin lanzar error
  const conNulos = { ...m, distritos: [null, ...m.distritos.map((x) => ({ ...x, tiendas: [null, ...(x.tiendas || [])] })), { ciudad: null }], kpis: { ...m.kpis, cartera: [null, ...(m.kpis?.cartera || [])] } };
  for (const capa of ['ventas', 'cartera', 'cuota']) assert.deepEqual([...capaCiudades(conNulos, capa).porCiudad], [...capaCiudades(m, capa).porCiudad], `capa ${capa} con nulos`);
  assert.equal(cuotasPorCuenta(null, null).size, 0);
  assert.equal(cuotasPorCuenta([{ cliente_erp: ' 10 ', cuenta_sellout: 'a', cuota_venta: 5 }], [{ cliente: '10', fact_neta: 3 }, { cliente: 10, fact_neta: 'x' }]).get('a').venta, 3, 'cliente con espacios');
  // 4.7.16: montos en texto con «$», comas o espacios suman en cuota, ritmo, celebraciones y reparto por estado
  assert.deepEqual(cuotasPorCuenta([{ cliente_erp: 1, cuenta_sellout: 'a', cuota_venta: '$1,000' }], [{ cliente: 1, fact_neta: ' 2,500 ' }]).get('a'), { venta: 2500, cuota: 1000 }, 'cuota/venta en texto');
  { const mq = { hoyIso: '2026-11-15', cuotas: new Map([['a', { venta: '$1,000', cuota: '$2,000' }]]) };
    assert.equal(cuotaRitmo(mq, ['a'])?.pct, 50, 'cuotaRitmo con texto');
    assert.equal(celebraciones({ cuotas: new Map([['a', { venta: '$3,000', cuota: '2,000' }]]) }).cuota?.pct, 150, 'celebración con texto');
    const ce = celebraciones({ distritos: [{ ciudad: 'X', tiendas: [{ cuenta: 'a', sucursal: 's1', vendioMes: true, importe: '$500' }, { cuenta: 'a', sucursal: 's2', vendioMes: true, importe: '$1,200' }, { cuenta: 'a', sucursal: 's3', vendioMes: true, importe: 9, previo: '$5' }] }] });
    assert.deepEqual(ce.tiendas.map((t) => [t.sucursal, t.importe]), [['s2', 1200], ['s1', 500]], 'tiendas nuevas con texto'); }
  assert.deepEqual(repartoPorEstado('x', [{ cuenta: 'x', estado: 'NUEVO LEON', anio: 2026, mes: 10, importe: '$1,500' }], { anio: 2026, mes: 10, anioPrev: 2026, mesPrev: 9 }).map((o) => o.importe), [1500], 'reparto con texto');
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
  assert.deepEqual(circuitoVendedor('x'), []); assert.deepEqual(circuitoVendedor([null, ...ds], null).map((x) => x.cliente), ['A', 'C', 'D'], 'tieneRuta nulo = todas');
  assert.equal(circuitoVendedor(ds, undefined, 0).length, 3, 'max 0 → 3'); assert.equal(circuitoVendedor(ds, undefined, 2.8).length, 2, 'max decimal');
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
  // 4.3.10: ETA en texto cuenta, vacía o basura = sin ETA (antes «» atracaba)
  const t = rumboBarcos([{ llegaEnDias: '' }, { llegaEnDias: 'abc', progreso: .2 }, { llegaEnDias: '-1' }, { llegaEnDias: ' 4 ' }, { llegaEnDias: NaN }, null]);
  assert.deepEqual(t.map((x) => x.modo), ['navegando', 'navegando', 'atracado', 'llegando', 'navegando', 'navegando']);
  assert.equal(t[1].avance, .2); assert.equal(t[3].avance, .5); assert.deepEqual(rumboBarcos({ a: 1 }), []);
});

test('cuentas sin sucursal repartidas por estado', () => {
  const f = [{ cuenta: 'x', anio: 2026, mes: 10, estado: 'Nuevo León', importe: 100 }, { cuenta: 'x', anio: 2026, mes: 9, estado: 'NUEVO LEON', importe: 50 }, { cuenta: 'x', anio: 2026, mes: 10, estado: 'Jalisco', importe: 999 },
    { cuenta: 'x', anio: 2026, mes: 9, estado: 'Yucatán', importe: 30 }, { cuenta: 'x', anio: 2025, mes: 10, estado: 'Puebla', importe: 70 }, { cuenta: 'y', anio: 2026, mes: 10, estado: 'Puebla', importe: 70 }, { cuenta: 'x', anio: 2026, mes: 10, estado: 'SIN ESTADO', importe: 5 }];
  const opt = { anio: 2026, mes: 10, anioPrev: 2026, mesPrev: 9, sede: CIUDAD_POR_ESTADO.JALISCO };
  const r = repartoPorEstado('x', f, opt);
  assert.deepEqual(r.map((o) => [o.ciudad, o.importe, o.previo]), [[CIUDAD_POR_ESTADO['NUEVO LEON'], 100, 50], [CIUDAD_POR_ESTADO.YUCATAN, 0, 30]]);
  assert.equal(repartoPorEstado('x', f, { ...opt, max: 1 }).length, 1); assert.deepEqual(repartoPorEstado('z', f, opt), []); assert.deepEqual(repartoPorEstado('x', null, opt), []);
  // 4.3.7: cuenta con espacios o numérica y año/mes en texto empatan igual; cuenta vacía no junta nada.
  const g = [{ cuenta: ' 10 ', anio: '2026', mes: '10', estado: 'Nuevo León', importe: 40 }, { cuenta: 10, anio: 2026, mes: 9, estado: 'Nuevo León', importe: 15 }, null, { cuenta: null, anio: 2026, mes: 10, estado: 'Puebla', importe: 9 }];
  assert.deepEqual(repartoPorEstado(10, g, opt).map((o) => [o.ciudad, o.importe, o.previo]), [[CIUDAD_POR_ESTADO['NUEVO LEON'], 40, 15]]);
  assert.deepEqual(repartoPorEstado('10', g, { ...opt, anio: '2026', mes: '10', anioPrev: '2026', mesPrev: '9' }).map((o) => [o.importe, o.previo]), [[40, 15]]);
  assert.deepEqual(repartoPorEstado(null, g, opt), []); assert.deepEqual(repartoPorEstado('', g, opt), []);
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
  { const r = cuotaRitmo({ cuotas: new Map([['x', { cuota: 100 }]]), hoyIso: 'basura' }, ['x']); assert.equal(r.pct, 0); assert.equal(r.venta, 0); assert.ok(Number.isFinite(r.ritmo)); }
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
  const rn = datosEnFecha({ ...crudos, facturas: [null, ...crudos.facturas], envios: [null, ...crudos.envios], contenedores: [null, ...crudos.contenedores], sucursales: [null, ...crudos.sucursales], cuentaMes: [null] }, new Date(2026, 8, 30, 12));
  assert.deepEqual([rn.facturas.length, rn.envios.length, rn.contenedores.length, rn.sucursales.length, rn.cuentaMes.length], [1, 1, 1, 1, 0], 'nulos fuera (4.3.6)');
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

test('rebote al tocar', () => {
  assert.deepEqual(rebote(0), { y: 1, xz: 1, fin: false });
  assert.equal(rebote(.5).fin, true); assert.equal(rebote(.6).y, 1);
  const ys = Array.from({ length: 50 }, (_, k) => rebote(k / 100).y);
  assert.ok(Math.min(...ys) < .93 && Math.max(...ys) > 1.03); // aplasta y estira
  for (let k = 1; k < 50; k++) { const r = rebote(k / 100); assert.ok(Math.abs((r.y - 1) + 2 * (r.xz - 1)) < 1e-9); } // lo que baja en y se ensancha
  assert.equal(rebote(NaN).y, 1);
});

test('saltito de saludo', () => {
  assert.equal(saltito(0), 0); assert.equal(saltito(.7), 0); assert.equal(saltito(-1), 0); assert.equal(saltito(NaN), 0);
  assert.ok(Math.abs(saltito(.175) - .45) < 1e-9 && Math.abs(saltito(.525) - .45) < 1e-9); // dos saltos
  assert.ok(saltito(.35) < 1e-9); // aterriza entre uno y otro
});

test('recorrido de bienvenida', () => {
  assert.equal(RECORRIDO.length, 3);
  for (const p of RECORRIDO) assert.ok(p.icono && p.titulo && p.texto.length > 20);
  assert.equal(recorridoVisto('1'), true); assert.equal(recorridoVisto(null), false); assert.equal(recorridoVisto(undefined), false);
});

test('capas del sonido ambiente', () => {
  const dia = capasSonido({ esDia: true }); assert.ok(dia.pajaros > 0 && dia.grillos === 0 && dia.lluvia === 0 && dia.ruido > 0);
  const noche = capasSonido({ esDia: false }); assert.ok(noche.grillos > 0 && noche.pajaros === 0 && noche.ruido < dia.ruido);
  const lluvia = capasSonido({ esDia: true, lluvia: true }); assert.ok(lluvia.lluvia > 0 && lluvia.pajaros === 0);
  assert.deepEqual(capasSonido(), dia);
});

test('gesto de dos dedos', () => {
  const p = (x0, y0, x1, y1) => [{ x: x0, y: y0 }, { x: x1, y: y1 }];
  assert.equal(gestoDosDedos(p(0, 0, 100, 0), p(0, 0, 200, 0)).escala, .5); // separar = acercar
  assert.ok(Math.abs(gestoDosDedos(p(0, 0, 100, 0), p(0, 0, 0, 100)).giro - Math.PI / 2) < 1e-9);
  assert.ok(Math.abs(gestoDosDedos(p(0, 0, -100, 1), p(0, 0, -100, -1)).giro) < .1); // cruza ±π sin brincar
  assert.equal(gestoDosDedos(p(5, 5, 5, 5), p(0, 0, 10, 0)).escala, .1); // dedos encimados: sin dividir entre 0
});

test('paseantes por manzana (versión ligera)', () => {
  assert.equal(paseantesDistrito(2), 0); assert.equal(paseantesDistrito(3), 1); assert.equal(paseantesDistrito(9), 3); assert.equal(paseantesDistrito(40), 4);
  assert.equal(paseantesDistrito(40, true), 1); assert.equal(paseantesDistrito(2, true), 0);
});

test('pulido: aPx / pxAEscena con coordenadas ilegibles caen en el origen (4.3.25)', () => {
  for (const [a, b] of [[null, null], [undefined, undefined], ['x', NaN], [Infinity, -Infinity], ['', true], [{}, []]]) {
    const p = aPx(a, b); assert.deepEqual(p, PX_ORIGEN, `aPx(${String(a)}, ${String(b)})`);
    assert.deepEqual(pxAEscena(a, b), { x: 0, z: 0 }, `pxAEscena(${String(a)}, ${String(b)})`);
  }
  // número en texto se lee; sólo el eje ilegible cae en el origen
  assert.deepEqual(aPx('-103.35', null).X, aPx(-103.35, 0).X); assert.equal(aPx(-100, 'basura').Y, PX_ORIGEN.Y);
  const q = pxAEscena(PX_ORIGEN.X + 10, 'z'); assert.ok(Math.abs(q.x - 10 * K) < 1e-9 && q.z === 0);
  assert.deepEqual(pxAEscena(' ' + PX_ORIGEN.X + ' ', String(PX_ORIGEN.Y)), { x: 0, z: 0 });
});

test('pulido: proyección y catálogos coherentes', () => {
  // Guadalajara es el origen de la escena; norte = z negativa, oriente = x positiva.
  const o = pxAEscena(PX_ORIGEN.X, PX_ORIGEN.Y);
  assert.equal(o.x, 0); assert.equal(o.z, 0);
  assert.deepEqual(posDe(ORIGEN), { x: 0, z: 0 });
  const mty = posDe(CIUDADES.MONTERREY), mer = posDe(CIUDADES.MERIDA), tij = posDe(CIUDADES.TIJUANA);
  assert.ok(mty.x > 0 && mty.z < 0, 'Monterrey al noreste'); assert.ok(mer.x > mty.x, 'Mérida al oriente'); assert.ok(tij.x < 0 && tij.z < mty.z, 'Tijuana al noroeste');
  assert.ok(Math.abs(aPx(1, 0).X - aPx(0, 0).X - PX.a) < 1e-9 && Math.abs(K * PX.a - 11) < 1e-9);
  // Todas las ciudades del catálogo con coordenadas dentro de México.
  for (const [k, c] of Object.entries(CIUDADES)) {
    assert.ok(Number.isFinite(c.lon) && Number.isFinite(c.lat), k);
    assert.ok(c.lon > -118 && c.lon < -86 && c.lat > 14 && c.lat < 33, `${k} fuera de México`);
  }
  // Cada cuenta tiene color y sede, y la sede existe en el catálogo (si no, sus tiendas caerían en GDL sin avisar).
  for (const [cu, sede] of Object.entries(SEDE_POR_CUENTA)) { assert.ok(CIUDADES[sede], `sede de ${cu}`); assert.ok(COLOR_CUENTA[cu] != null, `color de ${cu}`); }
  for (const cu of Object.keys(COLOR_CUENTA)) assert.ok(SEDE_POR_CUENTA[cu], `sede de ${cu}`);
  for (const [edo, c] of Object.entries(CIUDAD_POR_ESTADO)) assert.ok(CIUDADES[c], `ciudad de ${edo}`);
  assert.equal(hexCss(0x0A84FF), '#0a84ff'); assert.equal(hexCss(0xFF), '#0000ff'); assert.equal(hexCss(0), '#000000');
  assert.equal(norm('  Mérida, Yucatán '), 'MERIDA, YUCATAN'); assert.equal(norm(null), ''); assert.equal(norm('Ñuño'), 'NUNO');
  assert.equal(RECORRIDO_CLAVE, 'acteck-ciudad-recorrido');
});

test('nombreCiudad: acentos, conectores y CDMX', () => {
  assert.equal(nombreCiudad('SAN LUIS POTOSI'), 'San Luis Potosí');
  assert.equal(nombreCiudad('CIUDAD DE MEXICO'), 'CDMX'); assert.equal(nombreCiudad('Ciudad de México'), 'CDMX');
  assert.equal(nombreCiudad('CIUDAD JUAREZ'), 'Ciudad Juárez'); assert.equal(nombreCiudad('TUXTLA GUTIERREZ'), 'Tuxtla Gutiérrez');
  assert.equal(nombreCiudad('LAGOS DE MORENO'), 'Lagos de Moreno'); assert.equal(nombreCiudad('LA PAZ'), 'La Paz', 'el primer conector sí va con mayúscula');
  assert.equal(nombreCiudad('  merida '), 'Mérida'); assert.equal(nombreCiudad(null), ''); assert.equal(nombreCiudad(''), '');
  for (const k of Object.keys(CIUDADES)) { const n = nombreCiudad(k); assert.ok(n.length > 0 && n.length <= 20, k); assert.equal(norm(n === 'CDMX' ? 'CIUDAD DE MEXICO' : n), k, `${k} ida y vuelta`); }
});

test('cifraCorta / pesosCorto: miles de millones en «B» y texto con $ / comas', () => {
  assert.equal(cifraCorta(1e12), '1000.0 B'); assert.equal(cifraCorta(1.24e9), '1.2 B'); assert.equal(cifraCorta(999.96e6), '1.0 B'); assert.equal(cifraCorta(999.9e6), '999.9 M');
  assert.equal(cifraCorta('$1,200'), '1 K'); assert.equal(cifraCorta(' 2,500 '), '3 K'); assert.equal(cifraCorta('-15,400'), '-15 K'); assert.equal(cifraCorta('1500'), '2 K');
  assert.equal(cifraCorta(true), '0'); assert.equal(cifraCorta([]), '0'); assert.equal(cifraCorta({}), '0'); assert.equal(cifraCorta('  '), '0'); assert.equal(cifraCorta('abc'), '0');
  assert.equal(pesosCorto(-2.5e9), '-$2.5 B'); assert.equal(pesosCorto('$3,400,000'), '$3.4 M');
});
test('cifraCorta / pesosCorto: redondeo en el borde K→M y negativos', () => {
  assert.equal(cifraCorta(999600), '1.0 M'); assert.equal(cifraCorta(999400), '999 K'); assert.equal(cifraCorta(999.6), '1 K');
  assert.equal(cifraCorta(1.25e6), '1.3 M'); assert.equal(cifraCorta(15400), '15 K'); assert.equal(cifraCorta(42.4), '42');
  assert.equal(cifraCorta(-15400), '-15 K'); assert.equal(cifraCorta(-0.2), '0'); assert.equal(cifraCorta(NaN), '0'); assert.equal(cifraCorta(undefined), '0');
  assert.equal(pesosCorto(999600), '$1.0 M'); assert.equal(pesosCorto(-2500), '-$3 K'); assert.equal(pesosCorto(15000), '$15 K');
});

test('racksPorMarca / demanda3Meses: SKU con espacios o minúsculas cuenta una vez y encuentra su demanda', () => {
  const h = new Date(2026, 4, 15);
  const dem = demanda3Meses([{ sku: ' ab1 ', anio: 2026, piezas: [0, 30, 30, 30] }], h);
  assert.equal(dem.get('AB1'), 90, 'el pivote con espacios empata');
  const filas = [{ articulo: 'AB1', inventario: 30, costoinventario: 300 }, { articulo: ' ab1', inventario: 15, costoinventario: 150 }];
  const r = racksPorMarca(filas, new Map([['AB1', 'Acteck']]), 8, dem);
  assert.deepEqual(r.map((g) => [g.marca, g.skus, g.piezas, g.dias]), [['ACTECK', 1, 45, 45]]);
  assert.equal(racksPorMarca([{ articulo: '  ', inventario: 5 }], null).length, 0, 'SKU en blanco no cuenta');
});

test('presenciaPersonas / reunionesDelDia aguantan persona nula y fecha inválida (3.111.1)', () => {
  const gente = [null, { id: 'u1' }, 'x'];
  const reu = [{ id: 'r1', titulo: 'Junta', fecha: new Date(Date.now() - 10 * 60000).toISOString(), duracion_min: 60, creado_por: 'u1' }];
  assert.doesNotThrow(() => presenciaPersonas(gente, reu, [], new Date('mal')));
  assert.equal(gente[1].presencia.estado, 'reunion', 'fecha inválida usa ahora');
  const ag = reunionesDelDia(reu, new Date('mal'));
  assert.equal(ag.length, 1); assert.equal(ag[0].estado, 'en curso');
});

test('fechaHoy: cualquier «hoy» malo cae en ahora y las capas con fecha ya no truenan', () => {
  const d = new Date(2026, 10, 18, 9);
  assert.equal(fechaHoy(d), d, 'Date válido tal cual');
  const t = fechaHoy('2026-11-18');
  assert.deepEqual([t.getFullYear(), t.getMonth(), t.getDate(), t.getHours()], [2026, 10, 18, 12], 'AAAA-MM-DD a mediodía local');
  for (const mal of [null, undefined, 'x', new Date('mal'), {}, NaN]) {
    const r = fechaHoy(mal);
    assert.ok(r instanceof Date && !Number.isNaN(r.getTime()), `«${String(mal)}» → ahora`);
  }
  const m = construirModelo({});
  for (const mal of [null, 'x', new Date('mal')]) {
    assert.doesNotThrow(() => { misionesDelDia(m, mal); bitacoraEventos(m, mal); burbujasAtencion(m, mal); camionesTemporada(m, mal); eventosCalendario(mal); momentosTiempo(mal); demanda3Meses([], mal); });
  }
  assert.doesNotThrow(() => construirModelo({}, 'x'));
  assert.deepEqual(eventosCalendario('2026-11-28'), eventosCalendario(new Date(2026, 10, 28, 12)), 'texto de fecha se lee como la fecha');
  assert.ok(eventosCalendario('2026-11-28').length > 0, 'fin de mes trae eventos');
});

test('cadena y circuito: renglones nulos y ciclos inválidos no truenan ni dan NaN', () => {
  for (const mal of [NaN, undefined, null, 'x', Infinity]) {
    const r = tramoActual(mal, 3); assert.deepEqual([r.i, r.q, r.tramos], [0, 0, 4], `ciclo ${String(mal)}`);
    assert.equal(tramoActual(.5, mal).tramos, 2, `paradas ${String(mal)}`);
  }
  assert.equal(tramoActual(.5, 2.7).tramos, 3, 'paradas fraccionarias se truncan');
  const m = { hoyIso: '2026-11-18', puerto: { barcos: [null, { llegaEnDias: -5, piezas: 10 }] }, cedis: { dias: 30 }, camiones: [null, { ciudad: 'guadalajara', envio: true, fecha: '2026-11-01', piezas: 5 }], distritos: [null, { ciudad: 'guadalajara', tiendas: [null, { vendio: true }] }] };
  let r; assert.doesNotThrow(() => { r = cadenaSuministro(m); });
  assert.equal(r.tramos.find((t) => t.clave === 'puerto').estado, 'rojo');
  assert.equal(r.tramos.find((t) => t.clave === 'tienda').volumen, '1 de 1 vendieron');
  assert.equal(r.tramos.find((t) => t.clave === 'camion').estado, 'ambar');
  let c; assert.doesNotThrow(() => { c = cintasCadena(m); });
  assert.equal(c.find((x) => x.a === 'guadalajara')?.tono, 'ambar');
});

test('pensamientos, celebraciones, burbujas y bitácora aguantan renglones nulos', () => {
  const h = new Date('2026-11-18T10:00:00');
  const m = { hoyIso: 'basura', kpis: { cartera: [null, { cuenta: 'a', vencido: 5 }] }, cuotas: new Map([['x', null], ['q', { venta: 120, cuota: 100 }]]),
    distritos: [null, { ciudad: 'GDL', tiendas: [null, { cuenta: 'a', sucursal: 'Centro', importe: 10, previo: 10 }, { cuenta: 'n', sucursal: 'Nueva', importe: 50, previo: 0, vendioMes: true }] }],
    puerto: { barcos: [null, { llegaEnDias: -1 }] }, oficina: { agenda: [null, { estado: 'próxima', ini: 610, hora: '10:10', titulo: 'Junta' }] } };
  let p; assert.doesNotThrow(() => { p = pensamientos(m); });
  assert.equal(p[0]?.texto, 'Tengo pagos vencidos');
  let c; assert.doesNotThrow(() => { c = celebraciones(m); });
  assert.equal(c.cuota?.pct, 120); assert.deepEqual(c.tiendas.map((t) => t.sucursal), ['Nueva']);
  let b; assert.doesNotThrow(() => { b = burbujasAtencion(m, h); });
  assert.deepEqual(b.map((x) => x.lugar), ['puerto', 'oficina']);
  assert.doesNotThrow(() => bitacoraEventos({ hoyIso: '2026-11-18', oficina: { agenda: [null] } }, h));
});

test('construirModelo, etiquetas y ventanas aguantan renglones nulos', () => {
  const listas = ['cuentas', 'envios', 'contenedores', 'facturas', 'sucursales', 'clientesFinales', 'vendedoresMayoristas', 'vendedoresErp', 'perfiles', 'reunionesHoy', 'cartera', 'agendaHoy', 'tiendas', 'pos', 'forecast'];
  for (const k of listas) assert.doesNotThrow(() => construirModelo({ [k]: [null, {}] }, new Date('2026-11-18T10:00:00')), k);
  assert.doesNotThrow(() => construirModelo(null));
  assert.deepEqual(sinNulos({ a: [null, 1, undefined, 0], b: 'x', c: null }), { a: [1, 0], b: 'x', c: null });
  assert.deepEqual(etiquetasSinEncimar([null, { x: 0, y: 0, w: 10, h: 10, prioridad: 1 }]), [false, true]);
  assert.deepEqual(etiquetasSinEncimar(null), []);
  assert.deepEqual(ventanasOficina([null, { presencia: { estado: 'viaje' } }], 4), [false, false, false, false]);
  assert.equal(ventanasOficina([null], 3).length, 3);
});

test('pin, ciudades top y POs del puerto aguantan renglones nulos', () => {
  assert.equal(pinCiudad({ ciudad: 'LEON', tiendas: [null, { vendio: true }, { vendio: true, virtual: true }] }).activas, 1, 'tienda nula se salta');
  const top = ciudadesTop({ distritos: [null, { ciudad: 'LEON', tiendas: [null, { vendio: true }] }], camiones: [null] });
  assert.deepEqual(top.map((c) => c.ciudad), ['LEON'], 'distrito nulo se salta');
  const pto = { barcos: [null, { id: ' C1 ' }], tarimas: [undefined] };
  ponerPosEnPuerto(pto, [{ contenedor: 'C1', po: 'PO-2' }, null, { contenedor: 'C1', po: 'PO-1' }]);
  assert.deepEqual(pto.barcos[1].listaPos, ['PO-1', 'PO-2'], 'barco/tarima nulos no rompen');
});

test('tarjeta del edificio: pesos cortos y renglones nulos (4.3.9)', () => {
  assert.equal(tarjetaDe({ tipo: 'cedis' }, { cedis: { valor: 999600, dias: 10 } }).numeros[0][1], '$1.0 M', 'ya no «$1000 K»');
  const mod = { oficina: { personas: [null, { pendientes: 2, hechas: 1 }], agenda: [null, { hora: '10:00', titulo: 'Junta', estado: 'en curso' }], reuniones: 1 },
    cedis: { racksMarca: [null, { marca: 'ACTECK', valor: 500, dias: 30, piezas: 3, skus: 1 }] },
    puerto: { barcos: [null, { id: 'C1', llegaEnDias: 2, piezas: 4 }], tarimas: [undefined], totalPiezas: 4 },
    distritos: [null, { ciudad: 'LEON', cuentas: [null], vendedores: [null], tiendas: [null, { cuenta: 'ct', nombreCuenta: 'CT', sucursal: 'Centro', importe: -5000, vendio: true, vendioMes: true }] }],
    camiones: [null, { folio: 'F1', cliente: 'X', monto: 1500 }], vendedoresRuta: [null, { nombre: 'Ana', totalMes: 1, destinos: [null, { cliente: 'Y' }] }] };
  assert.deepEqual(tarjetaDe({ tipo: 'oficina' }, mod).numeros.slice(0, 3), [['Personas', '1'], ['Reuniones hoy', '1 · en curso'], ['Pendientes', '2']]);
  assert.deepEqual(tarjetaDe({ tipo: 'sala' }, mod).numeros, [['10:00 · ahora', 'Junta']]);
  assert.equal(tarjetaDe({ tipo: 'rack', marca: 'ACTECK' }, mod).numeros[0][1], '$500 · 100 %');
  assert.equal(tarjetaDe({ tipo: 'barco', id: 'C1' }, mod).estado, 'verde');
  assert.deepEqual(tarjetaDe({ tipo: 'puerto' }, mod).numeros[3], ['Descargando', '0'], 'tarima nula no cuenta');
  const ci = tarjetaDe({ tipo: 'ciudad', ciudad: 'LEON' }, mod); assert.deepEqual(ci.numeros[0], ['Tiendas activas', '1 de 1']); assert.equal(ci.numeros[1][1], '-$5 K');
  assert.equal(tarjetaDe({ tipo: 'tienda', ciudad: 'LEON', cuenta: 'ct', titulo: 'CT · Centro' }, mod).numeros[0][1], '-$5 K');
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F1' }, mod).numeros[1][1], '$2 K');
  assert.equal(tarjetaDe({ tipo: 'vendedorErp', titulo: 'Ana' }, mod).numeros[3][1], 'Y');
});
test('encuadre, minimapa y top SKUs aguantan parámetros inválidos', () => {
  const pts = [{ x: 0, z: 0, r: 2 }, { x: 10, z: 4 }];
  const ok = (e) => e && [e.cx, e.cz, e.zoom].every(Number.isFinite);
  const base = encuadre(pts);
  for (const o of [{ ang: NaN }, { margen: 0 }, { margen: -1 }, { alto: NaN }, { min: NaN }, { max: 'x' }, { min: 50, max: 10 }]) assert.ok(ok(encuadre(pts, o)), `encuadre con ${JSON.stringify(o)}`);
  assert.deepEqual(encuadre(pts, { ang: NaN, margen: NaN, alto: NaN, min: NaN, max: NaN }), base, 'basura = valores de omisión');
  assert.equal(encuadre(pts, { min: 50, max: 10 }).zoom, 50, 'max < min usa min');
  assert.equal(encuadre({ x: 1, z: 1 }), null, 'algo que no es lista');
  assert.ok(ok(vistaCiudad({ x: 1, z: 2 }, { ang: NaN })), 'vista ciudad con ángulo inválido');
  const g = posDe(CIUDADES.GUADALAJARA);
  for (const o of [{ ancho: 0 }, { alto: NaN }, { margen: 999 }, { margen: -3 }, { ancho: 'x', alto: null }]) {
    const p = planoMini([{ ciudad: 'GUADALAJARA', pos: g }], o);
    assert.ok(p.contorno.split(/[ ,]/).map(Number).every(Number.isFinite), `contorno sin NaN con ${JSON.stringify(o)}`);
    assert.ok(Number.isFinite(p.puntos[0].u) && Number.isFinite(p.marco({ cx: g.x, cz: g.z, zoom: 5 }).r), 'punto y marco finitos');
  }
  assert.deepEqual(planoMini({ a: 1 }).puntos, [], 'distritos que no son lista');
  const f = [{ sku: 'A', importe: 3 }, { sku: 'B', importe: 2 }, { sku: 'C', importe: 1 }, { sku: 0, importe: 1 }];
  assert.equal(topSkus(f, NaN).length, 4, 'n inválido usa 5'); assert.equal(topSkus(f, '2').length, 2, 'n en texto'); assert.equal(topSkus(f, 1.7).length, 1, 'n decimal');
  assert.equal(topSkus(f, -1).length, 4, 'n negativo usa 5'); assert.deepEqual(topSkus({ sku: 'A' }), [], 'algo que no es lista');
  assert.ok(topSkus(f).some((r) => r.sku === '0'), 'SKU numérico 0 cuenta');
});
test('fechaIso y fechas malas en puerto y camiones (sin NaN)', () => {
  assert.equal(fechaIso('2026-10-05'), '2026-10-05'); assert.equal(fechaIso(' 2026-10-05T08:00:00Z'), '2026-10-05', 'con hora y espacios');
  assert.equal(fechaIso(new Date(2026, 1, 3, 9)), '2026-02-03', 'Date');
  for (const x of [null, undefined, '', 'pendiente', '2026-13-40', '2026-02-30', 20261005, new Date('x'), {}]) assert.equal(fechaIso(x), null, String(x));
  const m = construirModelo({ ...d,
    contenedores: [...d.contenedores, { contenedor: 'MALO', supplier: 'X', estatus: 'NAVEGANDO', piezas: 5, etd: 'pendiente', eta_puerto: 'sin fecha', arribo_cedis: '2026-99-99' }, { contenedor: 'MEDIO', estatus: 'NAVEGANDO', etd: 'x', fecha_emision: '2026-09-05', eta_puerto: '2026-10-05' }],
    envios: [...d.envios, { fecha_surtida: 'ayer', fecha_entregada: null, guia_rastreo: 'G-MALA', oc_clientes: { cliente_key: 'pcel' } }, { fecha_surtida: '2026-10-08', fecha_entregada: null, guia_rastreo: 'G-FUT', oc_clientes: { cliente_key: 'pcel' } }],
    facturas: [...d.facturas, { cliente_key: '01234', folio: 'F-FUT', fecha: '2026-10-07', piezas: 1, monto: 1 }] }, hoy);
  const malo = m.puerto.barcos.find((b) => b.id === 'MALO');
  assert.ok(malo, 'el barco con fechas malas sigue en el mar'); assert.equal(malo.progreso, 0.5); assert.equal(malo.llegaEnDias, null); assert.equal(malo.arribo, null);
  const medio = [...m.puerto.barcos, ...m.puerto.tarimas].find((b) => b.id === 'MEDIO');
  assert.ok(medio && Number.isFinite(medio.progreso) && medio.llegaEnDias === 0, 'etd malo usa fecha_emision');
  assert.ok(m.puerto.barcos.every((b) => Number.isFinite(b.progreso)), 'progreso siempre número');
  assert.ok(!m.camiones.some((c) => c.folio === 'guía G-MALA'), 'envío con salida ilegible no sale');
  assert.ok(m.camiones.every((c) => Number.isFinite(c.progreso) && c.progreso >= 0), 'progreso de camiones sin NaN ni negativo');
  const t = tarjetaDe({ tipo: 'camion', folio: 'F-1' }, { ...m, camiones: [{ folio: 'F-1', cliente: 'X', fecha: 'mala', monto: 1, piezas: 1 }] });
  assert.ok(t && !JSON.stringify(t.numeros).includes('NaN'), 'tarjeta del camión sin «hace NaN d»');
});

test('gestos, rebotes, sonido y ventanas aguantan entradas inválidas (sin NaN)', () => {
  const p = (x1, y1, x2, y2) => [{ x: x1, y: y1 }, { x: x2, y: y2 }];
  for (const [a, b] of [[null, p(0, 0, 1, 1)], [p(0, 0, 1, 1), undefined], [[{ x: 0, y: 0 }], p(0, 0, 1, 1)], [p(0, 0, NaN, 1), p(0, 0, 1, 1)], [p(0, 0, 1, 1), [null, { x: 1, y: 1 }]], ['x', 'y']])
    assert.deepEqual(gestoDosDedos(a, b), { escala: 1, giro: 0 });
  for (const dur of [0, -1, NaN, Infinity, 'x']) { const r = rebote(.1, dur); assert.ok(Number.isFinite(r.y) && Number.isFinite(r.xz), String(dur)); assert.ok(Number.isFinite(saltito(.1, dur)), String(dur)); }
  assert.equal(saltito(.175, .7, NaN), saltito(.175));
  assert.deepEqual(capasSonido(null), capasSonido()); assert.deepEqual(capasSonido({ esDia: null }), capasSonido());
  assert.equal(capasSonido({ esDia: false, lluvia: 1 }).lluvia, capasSonido({ esDia: false, lluvia: true }).lluvia);
  assert.equal(ventanasOficina([], NaN).length, 12); assert.equal(ventanasOficina([], -3).length, 12); assert.equal(ventanasOficina([], '6').length, 6); assert.equal(ventanasOficina([{ presencia: { estado: 'disponible' } }], 3.6).length, 4);
});

test('etiquetas y árboles aguantan margen, prioridad y posición inválidos', () => {
  const c = (x, y, prioridad) => ({ x, y, w: 40, h: 12, prioridad });
  for (const m of [NaN, -5, 'x', null]) assert.deepEqual(etiquetasSinEncimar([c(0, 0, 1), c(10, 0, 1)], m), [true, false], String(m));
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, 1), c(10, 0, 1)], '0'), [true, false]);
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, 'alta'), c(10, 0, '3')]), [false, true], 'prioridad en texto cuenta; basura = 0');
  assert.deepEqual(etiquetasSinEncimar([c(0, 0, NaN), c(10, 0, 2), c(300, 0, undefined)]), [false, true, true]);
  for (const [x, z] of [[NaN, 1], [1, Infinity], ['x', null], [undefined, undefined]]) {
    const f = formaArbol(x, z); assert.ok([0, 1].includes(f.tono), `${x},${z}`); assert.ok(['pino', 'redondo', 'palma', 'arbusto'].includes(f.forma));
  }
  assert.deepEqual(formaArbol('3.2', '-7.5'), formaArbol(3.2, -7.5));
});

test('barra de tiempo, temporada y vistas aguantan fechas ilegibles y opciones nulas', () => {
  const d = { facturas: [{ folio: 'A', fecha: 'pendiente' }, { folio: 'B', fecha: '2026-10-05' }, { folio: 'C', fecha: '2026-09-01' }],
    envios: [{ id: 1, fecha_envio_erp: '??', fecha_entrega_erp: 'sin dato' }], contenedores: [{ id: 1, fecha_emision: '2026-99-99', arribo_cedis: 'x', estatus: 'CONCLUIDO' }] };
  const r = datosEnFecha(d, new Date(2026, 8, 30, 12));
  assert.deepEqual(r.facturas.map((x) => x.folio), ['A', 'C'], 'la ilegible se queda (sin fecha), la futura se va');
  assert.equal(r.envios.length, 1); assert.equal(r.envios[0].fecha_entrega_erp, 'sin dato', 'entrega ilegible no se toca');
  assert.equal(r.contenedores.length, 1); assert.equal(r.contenedores[0].estatus, 'CONCLUIDO');
  const t = camionesTemporada({ camiones: [{ folio: 'X', fecha: 'pendiente' }, { folio: 'Y', fecha: null }, null, { folio: 'Z', fecha: ' 2026-11-30' }] }, new Date(2026, 10, 28, 12));
  assert.equal(t.has('X') || t.has('Y'), false, 'fecha ilegible no es de temporada'); assert.ok(t.has('Z'), 'fecha con espacios sí cuenta');
  for (const op of [null, 'x', 3]) {
    const m = vistaMapa(op); assert.ok(m && Number.isFinite(m.zoom), `vistaMapa(${op})`);
    const v = vistaCiudad({ x: 1, z: 2, ancho: 6, largo: 6 }, op); assert.ok(v && Number.isFinite(v.zoom), `vistaCiudad(${op})`);
    const p = planoMini([], op); assert.equal(p.ancho, 150); assert.ok(p.contorno && !p.contorno.includes('NaN'), `planoMini(${op})`);
  }
  assert.deepEqual(vistaMapa(null), vistaMapa());
});

test('navidad en singular y top de ciudades con n inválido', () => {
  assert.equal(eventosCalendario(new Date(2026, 11, 24)).find((e) => e.id === 'navidad').texto, 'Temporada navideña · falta 1 día');
  assert.equal(eventosCalendario(new Date(2026, 11, 23)).find((e) => e.id === 'navidad').texto, 'Temporada navideña · faltan 2 días');
  assert.equal(eventosCalendario(new Date(2026, 9, 30)).find((e) => e.id === 'cierre').texto, 'Mañana cierra el mes');
  assert.equal(eventosCalendario(new Date(2026, 9, 29)).find((e) => e.id === 'cierre').texto, 'Cierre de mes en 2 días');
  assert.equal(eventosCalendario(new Date(2026, 10, 12)).find((e) => e.id === 'buenfin').texto, 'Buen Fin empieza mañana (13–16 nov)');
  assert.equal(eventosCalendario(new Date(2026, 10, 11)).find((e) => e.id === 'buenfin').texto, 'Buen Fin en 2 días (13–16 nov)');
  assert.equal(eventosCalendario(new Date(2026, 10, 14)).find((e) => e.id === 'buenfin').texto, 'Buen Fin · hasta el lunes 16');
  assert.equal(eventosCalendario(new Date(2026, 10, 16)).find((e) => e.id === 'buenfin').texto, 'Buen Fin · hoy es el último día');
  const mod = { distritos: [{ ciudad: 'LEON', tiendas: [{ vendio: true }] }, { ciudad: 'QUERETARO', tiendas: [{ vendio: true }] }], camiones: [] };
  const base = ciudadesTop(mod).length;
  assert.equal(ciudadesTop(mod, '1').length, Math.min(1, base)); assert.equal(ciudadesTop(mod, 1.7).length, Math.min(1, base));
  assert.equal(ciudadesTop(mod, NaN).length, base); assert.equal(ciudadesTop(mod, 'x').length, base); assert.equal(ciudadesTop(mod, -2).length, 0);
});

test('listas que no son lista y opciones null no tumban la Ciudad (4.3.19)', () => {
  assert.deepEqual(comoLista(null), []); assert.deepEqual(comoLista('abc'), []); assert.deepEqual(comoLista(5), []); assert.deepEqual(comoLista({ a: 1 }), []);
  const l = [1, 2]; assert.equal(comoLista(l), l);
  assert.equal(cuotasPorCuenta(-1, 'x').size, 0);
  assert.equal(resumenBanco('x', 5).carteraVencida, 0); assert.equal(resumenTorre('x', 5).avisos?.length ?? 0, 0);
  assert.deepEqual(reunionesDelDia('x', hoy), []); assert.deepEqual(demanda3Meses(-1, hoy), demanda3Meses([], hoy));
  assert.deepEqual(racksPorMarca(-1), racksPorMarca([])); assert.equal(pinCiudad({ ciudad: 'LEON', tiendas: [] }, 'x').llegando, 0);
  assert.equal(cuotaRitmo({ hoyIso: '2026-10-05', cuotas: new Map() }, -1), null);
  assert.deepEqual(repartoPorEstado('10', 'x'), []); assert.deepEqual(repartoPorEstado('10', [], null), []);
  assert.deepEqual(acomodoEscritorios(3, null), acomodoEscritorios(3)); assert.deepEqual(acomodoRacks([{ marca: 'A', valor: 1 }], null), acomodoRacks([{ marca: 'A', valor: 1 }]));
  const pts = [{ x: 0, z: 0 }, { x: 10, z: 10 }]; assert.deepEqual(encuadre(pts, null), encuadre(pts));
});

test('cuántos mostrar con max/n inválido no vacía las listas (4.3.20)', () => {
  assert.equal(cuantos(3, 5), 3); assert.equal(cuantos('4', 5), 4); assert.equal(cuantos(3.7, 5), 3); assert.equal(cuantos(0, 5), 0);
  for (const x of [NaN, -1, null, undefined, '', 'x', Infinity, {}]) assert.equal(cuantos(x, 5), 5, `cuantos(${String(x)})`);
  const m = construirModelo(d, hoy);
  for (const x of ['x', NaN, -2, null]) {
    assert.deepEqual(misionesDelDia(m, hoy, x), misionesDelDia(m, hoy), `misiones max=${x}`);
    assert.deepEqual(bitacoraEventos(m, hoy, x), bitacoraEventos(m, hoy), `bitácora max=${x}`);
    assert.deepEqual(pensamientos(m, x), pensamientos(m), `pensamientos max=${x}`);
    assert.deepEqual(celebraciones(m, x), celebraciones(m), `celebraciones max=${x}`);
    assert.deepEqual(cintasCadena(m, x), cintasCadena(m), `cintas max=${x}`);
    assert.deepEqual(racksPorMarca(d.inventarioSku, d.marcasSku, x), racksPorMarca(d.inventarioSku, d.marcasSku), `racks n=${x}`);
  }
  assert.ok(misionesDelDia(m, hoy).length > 0, 'el fixture sí tiene misiones');
  assert.equal(listaCorta(['a', 'b', 'c', 'd'], 'x'), 'a, b, c +1'); assert.equal(listaCorta(['a', 'b', 'c'], '2'), 'a, b +1'); assert.equal(listaCorta(['a', 'b'], NaN), 'a, b');
  assert.equal(misionesDelDia(m, hoy, '1').length, Math.min(1, misionesDelDia(m, hoy).length));
});

test('posDe y hexCss aguantan entradas inválidas (4.3.21)', () => {
  for (const c of [undefined, null, {}, { lon: 'x', lat: 20 }, { lon: NaN, lat: NaN }, { lon: '', lat: '' }, { lon: null, lat: 20 }]) {
    const p = posDe(c); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z), `posDe(${JSON.stringify(c)}) sin NaN`); assert.deepEqual(p, { x: 0, z: 0 }, 'cae en el origen');
  }
  assert.deepEqual(posDe({ lon: String(CIUDADES.HERMOSILLO.lon), lat: String(CIUDADES.HERMOSILLO.lat) }), posDe(CIUDADES.HERMOSILLO), 'lon/lat en texto');
  assert.equal(hexCss(0xFF3B30), '#ff3b30'); assert.equal(hexCss(0), '#000000'); assert.equal(hexCss('255'), '#0000ff');
  for (const n of [undefined, null, 'x', '', NaN, -1, 0x1000000, Infinity, {}]) assert.equal(hexCss(n), '#8e8e93', `hexCss(${String(n)}) gris`);
  assert.equal(hexCss(CAPA_TONOS.noExiste), '#8e8e93', 'tono desconocido de la cadena');
});

test('datosEnFecha y camionesTemporada aguantan listas que no son lista (4.3.22)', () => {
  const malo = { facturas: 'error', envios: { a: 1 }, contenedores: 3, sucursales: 'x', cuentaMes: {}, clientesFinales: 7, vendedoresMayoristas: true, vendedoresErp: 'y', cartera: [1] };
  let r; assert.doesNotThrow(() => { r = datosEnFecha(malo, new Date(2026, 8, 30, 12)); }, 'datos crudos que no son lista no tumban la barra de tiempo');
  for (const k of ['facturas', 'envios', 'contenedores', 'sucursales', 'cuentaMes', 'clientesFinales', 'vendedoresMayoristas', 'vendedoresErp']) assert.deepEqual(r[k], [], `${k} no-lista → vacía`);
  assert.deepEqual(r.cartera, [1], 'la foto de hoy queda igual');
  for (const cam of ['x', 3, { folio: 1 }, true]) assert.equal(camionesTemporada({ camiones: cam }, new Date(2026, 10, 14)).size, 0, `camiones ${JSON.stringify(cam)}`);
});

test('Pulido: nivelVista sin centro de ciudad y POs en tránsito legibles en la barra', () => {
  const b = { cx: 0, cz: 0, zoom: 30 }, lejos = { cx: 500, cz: 500, zoom: 20 };
  for (const c of [{ zoom: 20 }, { cx: 'x', cz: 1, zoom: 20 }, { cx: NaN, cz: 0, zoom: 20 }]) assert.equal(nivelVista(lejos, b, c), 'lejos', `ciudad ${JSON.stringify(c)} no cuenta`);
  assert.equal(nivelVista(lejos, b, { cx: 500, cz: 500, zoom: 20 }), 'ciudad', 'ciudad válida sigue');
  const extra = (pos) => recursosBarra({ enCamino: { valor: 1, pos } })[0].extra;
  assert.equal(extra(3), '3 POs'); assert.equal(extra(1), '1 PO', 'singular'); assert.equal(extra(' 4 '), '4 POs'); assert.equal(extra(2.6), '3 POs');
  for (const p of [0, '0', NaN, 'x', null, undefined, '', -2, true, Infinity]) assert.equal(extra(p), null, `pos ${String(p)}`);
});

test('Pulido: cuota en texto y cuenta con espacios en la capa de cuota', () => {
  const m = { hoyIso: '2026-09-15', cuotas: new Map([['a', { venta: 100, cuota: '1000' }], ['b', { venta: 50, cuota: '500' }], ['c', { venta: 9, cuota: 'x' }]]) };
  const r = cuotaRitmo(m, ['a', 'b', 'c']);
  assert.equal(r.cuota, 1500, 'cuotas en texto se suman como número'); assert.equal(r.pct, 10); assert.equal(r.n, 2, 'cuota ilegible no cuenta');
  assert.equal(cuotaRitmo({ ...m, hoyIso: ' 2026-09-15 ' }, ['a']).ritmo, 50, 'hoyIso con espacios se lee');
  assert.equal(cuotaRitmo({ cuotas: new Map([['a', { venta: 1, cuota: 'x' }]]) }, ['a']), null);
  const q = cuotasPorCuenta([{ cliente_erp: 10, cuenta_sellout: ' a ', cuota_venta: 100 }, { cliente_erp: 11, cuenta_sellout: 'a', cuota_venta: 50 }, { cliente_erp: 12, cuenta_sellout: '  ', cuota_venta: 9 }], [{ cliente: 10, fact_neta: 30 }, { cliente: 12, fact_neta: 5 }]);
  assert.deepEqual([...q.keys()], ['a'], 'cuenta con espacios = la misma; vacía no cuenta'); assert.deepEqual(q.get('a'), { venta: 30, cuota: 150 });
});
test('Pulido: torre de pronóstico con fechas de arribo sucias (4.3.27)', () => {
  const hoyIso = '2026-10-07';
  const r = resumenTorre([{ estatus: 'activa', forecast_propuesta_lineas: { confirmado: true } }, { estatus: 'activa', forecast_propuesta_lineas: 'x' }],
    [{ fecha_arribo: ' 2026-10-08', piezas_a_reservar: '4' }, { fecha_arribo: 'pendiente', piezas_a_reservar: 9 }, { fecha_arribo: '2026-99-99', piezas_a_reservar: 9 }, { fecha_arribo: new Date(2026, 9, 6, 12), piezas_a_reservar: 1 }], hoyIso);
  assert.equal(r.lineas, 0, 'líneas que no son lista no cuentan');
  assert.equal(r.arribos7, 1, 'fecha con espacios es próxima, no atrasada'); assert.equal(r.atrasados, 1, 'un Date de ayer cuenta atrasado');
  assert.equal(r.piezas7, 5, 'fechas ilegibles no suman piezas');
  assert.deepEqual(resumenTorre([], [{ fecha_arribo: '2026-10-06' }], ' 2026-10-07 '), resumenTorre([], [{ fecha_arribo: '2026-10-06' }], hoyIso), 'hoy con espacios se lee');
  assert.equal(resumenTorre([], [{ fecha_arribo: '2026-10-06' }], new Date(2026, 9, 7, 12)).atrasados, 1, 'hoy como Date');
});
test('banco (4.3.28): fechas y estados sucios en pagos, hoy inválido y reglas que fallan', async () => {
  const reglas = await import('../src/modules/comercial/pagosv3/estados.js');
  const hoyIso = '2026-10-07';
  const pagos = [{ estado: ' autorizado', monto: 100, fecha_programada: ' 2026-10-09' }, { estado: 'Rechazado ', monto: 7, fecha_programada: '2026-10-08' }, { estado: ' pagado ', monto: 9, fecha_programada: '2026-10-01' },
    { estado: 'solicitado', monto: '50', fecha_programada: 'pendiente', fecha_compromiso: '2026-10-01' }, { estado: 'calculado', monto: 4, fecha_programada: new Date(2026, 9, 10, 12) }, 'basura', 5];
  const b = resumenBanco([], pagos, hoyIso, reglas);
  assert.equal(b.pagosSemana, 2, 'fecha con espacios y Date cuentan en la semana; rechazado con mayúsculas no');
  assert.equal(b.montoSemana, 104);
  assert.equal(b.pagosVencidos, 1, 'programada ilegible cae a la de compromiso; pagado con espacios ya no sale vencido'); assert.equal(b.montoVencido, 50);
  const sinHoy = resumenBanco([], [{ estado: 'autorizado', monto: 1, fecha_programada: '2000-01-01' }], 'nunca', reglas);
  assert.equal(sinHoy.pagosVencidos, 1, 'hoy inválido usa hoy (antes NaN: no contaba)');
  const rotas = { venceEn: () => { throw new Error('x'); }, estaVencido: () => true };
  assert.deepEqual(resumenBanco([], [{ estado: 'autorizado', monto: 3 }], hoyIso, rotas), { carteraVencida: 0, cuentasVencidas: 0, pagosSemana: 0, montoSemana: 0, pagosVencidos: 1, montoVencido: 3 }, 'una regla que lanza no tira el banco');
  assert.equal(resumenBanco([], pagos, hoyIso, { venceEn: 1, estaVencido: 'x' }).pagosSemana, 0, 'reglas que no son función no cuentan');
});

test('4.3.29 · días entre fechas aguantan espacios y Date (camiones y barcos)', () => {
  const facturas = [{ cliente_key: 'x', folio: 'E', fecha: ' 2026-10-03', monto: 5 }, { cliente_key: 'x', folio: 'D', fecha: new Date(2026, 9, 4, 9), monto: 4 }, { cliente_key: 'x', folio: 'B', fecha: 'pendiente', monto: 3 }, { cliente_key: 'x', folio: 'V', fecha: '2026-09-01', monto: 2 }];
  const m = construirModelo({ ...d, facturas }, hoy);
  const folios = m.camiones.map((c) => c.folio).filter((f) => typeof f === 'string' && f.length === 1);
  assert.deepEqual(folios.sort(), ['D', 'E'], 'fecha con espacios y Date salen como camión; ilegible y vieja no');
  assert.ok(m.camiones.every((c) => Number.isFinite(c.progreso)), 'progreso siempre numérico');
  const m2 = construirModelo({ ...d, contenedores: [{ contenedor: 'Z9', estatus: 'NAVEGANDO', piezas: 1, etd: ' 2026-09-10', eta_puerto: '2026-10-20 ', arribo_cedis: ' 2026-10-25' }] }, hoy);
  const todos = [...(m2.puerto?.barcos || []), ...(m2.puerto?.tarimas || [])];
  const z = todos.find((x) => JSON.stringify(x).includes('Z9'));
  assert.ok(z, 'el contenedor con fechas con espacios sigue en el puerto');
  if (z && 'progreso' in z) assert.ok(Number.isFinite(z.progreso), 'progreso del barco numérico');
});

test('bitácora y tarjeta del barco con fechas sucias (4.3.30)', () => {
  const h = new Date('2026-10-07T11:00:00');
  const m = { hoyIso: ' 2026-10-07 ',
    camiones: [{ folio: 'F1', cliente: 'A', ciudad: 'GDL', monto: 10, fecha: ' 2026-10-05' }, { folio: 'F2', cliente: 'B', ciudad: 'GDL', monto: 10, fecha: 'pendiente' }, { folio: 'F3', cliente: 'C', ciudad: 'GDL', monto: 10, fecha: new Date('2026-10-06T09:00:00') }],
    puerto: { barcos: [{ id: 'Z1', piezas: 5, arribo: ' 2026-10-06' }, { id: 'Z2', arribo: '2026-99-99' }], tarimas: [] } };
  const b = bitacoraEventos(m, h);
  assert.ok(!b.some((x) => /NaN/.test(x.cuando)), 'sin «hace NaN d»');
  assert.deepEqual(b.map((x) => x.texto.split(' ')[0] + ' ' + x.cuando).sort(), ['Factura ayer', 'Factura hace 2 d', 'Llegó ayer'].sort());
  assert.ok(Array.isArray(bitacoraEventos({ hoyIso: 'basura', camiones: [{ folio: 'X', fecha: '2026-10-01' }] }, h)));
  const t = tarjetaDe({ tipo: 'barco', id: 'Z2' }, { puerto: { barcos: [{ id: 'Z2', eta: 'pendiente', llegaEnDias: 3 }], tarimas: [] } });
  assert.ok(t && !JSON.stringify(t).includes('Invalid Date'), 'sin «Invalid Date» en la tarjeta');
});

test('4.3.31 · reuniones y presencia aguantan fechas nulas, solo-día y duraciones malas', () => {
  const h = new Date('2026-10-05T11:00:00');
  const ag = reunionesDelDia([{ titulo: 'Nula', fecha: null }, { titulo: 'Vacía', fecha: '  ' }, { titulo: 'Neg', fecha: ' 2026-10-05T10:30:00 ', duracion_min: -30 }, { titulo: 'Txt', fecha: '2026-10-05T10:45:00', duracion_min: 'x' }], h);
  assert.deepEqual(ag.map((x) => x.titulo), ['Neg', 'Txt'], 'nula/vacía ya no salen a las 18:00');
  assert.deepEqual(ag.map((x) => x.estado), ['en curso', 'en curso'], 'duración mala → 60 min');
  const gente = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  presenciaPersonas(gente, [{ id: 'r1', titulo: 'R', fecha: '2026-10-05T10:30:00', duracion_min: 0, asistentes: [{ user_id: 'c' }] }], [
    { id: 'v1', tipo: 'viaje', titulo: 'Último día', fecha: '2026-10-01', fecha_fin: '2026-10-05', creado_por: 'a' },
    { id: 'v2', tipo: 'viaje', titulo: 'Sin fecha', fecha: null, fecha_fin: '2026-10-09', creado_por: 'b' },
  ], h);
  assert.equal(gente[0].presencia.estado, 'viaje', 'fecha_fin solo-día cuenta el día completo');
  assert.equal(gente[1].presencia.estado, 'disponible', 'viaje sin fecha ya no cuenta');
  assert.equal(gente[2].presencia.estado, 'reunion', 'duración 0 → 60 min');
});

test('4.3.32 · la reunión en curso de la oficina aguanta fecha nula y duración mala', () => {
  const e = new Date(0), h = new Date(2026, 9, 5, e.getHours(), e.getMinutes() + 30); // a la hora en que «1970» caería
  const m1 = construirModelo({ reunionesHoy: [{ titulo: 'Nula', fecha: null }, { titulo: 'Vacía', fecha: ' ' }] }, h);
  assert.equal(m1.oficina.reunionEnCurso, null, 'fecha nula/vacía ya no es una reunión en curso');
  const h2 = new Date(2026, 9, 5, 11, 0), ini = new Date(2026, 9, 5, 10, 30).toISOString();
  const m2 = construirModelo({ reunionesHoy: [{ titulo: 'Neg', fecha: ` ${ini} `, duracion_min: -30 }] }, h2);
  assert.equal(m2.oficina.reunionEnCurso?.titulo, 'Neg', 'duración negativa → 60 min y fecha con espacios cuenta');
});

test('4.3.33 · bitácora: montos con pesosCorto y pagos con fecha sola, espacios o Date', () => {
  const h = new Date(2026, 10, 19, 10, 0);
  const m = { hoyIso: '2026-11-19', pagosHechos: [
    { id: 1, pagado_at: '2026-11-19', monto: 999600 },
    { id: 2, pagado_at: ' 2026-11-18T15:30:00 ', monto: -5000 },
    { id: 3, pagado_at: new Date(2026, 10, 19, 9, 5), monto: 100 },
    { id: 4, pagado_at: 'pendiente', monto: 1 }] };
  const b = bitacoraEventos(m, h), por = (id) => b.find((x) => x.id === `pago-${id}`);
  assert.equal(por(1)?.cuando, '00:00', 'fecha sola es hoy local (antes «ayer» por UTC)');
  assert.ok(por(1).texto.endsWith('$1.0 M'), por(1).texto);
  assert.equal(por(2)?.cuando, 'ayer'); assert.ok(por(2).texto.endsWith('-$5 K'), por(2).texto);
  assert.equal(por(3)?.cuando, '09:05', 'un Date cuenta');
  assert.equal(por(4), undefined, 'ilegible se salta');
});

test('plural(): singular con 1, plural con 0/varios y n ilegible; la cadena dice «1 barco» y «1 tienda»', () => {
  assert.equal(plural(1, 'barco'), '1 barco'); assert.equal(plural(0, 'barco'), '0 barcos'); assert.equal(plural(2, 'día'), '2 días');
  assert.equal(plural(1.2, 'día'), '1 día'); assert.equal(plural('abc', 'tienda'), '0 tiendas'); assert.equal(plural(-1, 'pago'), '-1 pago');
  assert.equal(plural(1, 'cliente'), '1 cliente'); assert.equal(plural(1, 'cajón', 'cajones'), '1 cajón'); assert.equal(plural(12, 'cajón', 'cajones'), '12 cajones'); assert.equal(plural(1, 'vendedor', 'vendedores'), '1 vendedor');
  assert.equal(plural(1500, 'pieza'), '1,500 piezas'); assert.equal(plural(3, 'mes', 'meses'), '3 meses');
  const r = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: [{ etaPuerto: '2026-10-20', piezas: 10 }] }, cedis: { dias: 1 }, camiones: [], distritos: [{ tiendas: [{ vendio: true }, { vendio: false }] }] });
  const vol = (k) => r.tramos.find((x) => x.clave === k);
  assert.match(vol('mar').volumen, /^1 barco ·/); assert.match(vol('cedis').volumen, /· 1 día$/); assert.equal(vol('tienda').motivo, '1 tienda sin venta este mes');
});
test('plural() con plurales irregulares de las etiquetas de edificios (andén, tráiler, reunión, vendedor)', () => {
  assert.equal(plural(1, 'andén', 'andenes'), '1 andén'); assert.equal(plural(4, 'andén', 'andenes'), '4 andenes');
  assert.equal(plural(1, 'reunión', 'reuniones'), '1 reunión'); assert.equal(plural(2, 'tráiler', 'tráileres'), '2 tráileres');
  assert.equal(plural(1, 'vendedor', 'vendedores'), '1 vendedor'); assert.equal(plural(NaN, 'día'), '0 días'); assert.equal(plural(1, 'SKU'), '1 SKU');
});
test('cadenaSuministro() en singular: «1 pz», «1 recién llegado», «1 barco con más de 3 días»; tarimas que no son lista no truenan', () => {
  const r = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: [{ llegaEnDias: -5, piezas: 1 }], tarimas: [{ id: 'T1' }, null] }, cedis: { dias: 10, piezas: 1 }, camiones: [{ piezas: 1 }], distritos: [] });
  const t = (k) => r.tramos.find((x) => x.clave === k);
  assert.equal(t('puerto').volumen, '1 con ETA vencida · 1 recién llegado'); assert.equal(t('puerto').motivo, '1 barco con más de 3 días de atraso');
  assert.equal(t('cedis').volumen, '1 pz · 10 días'); assert.equal(t('camion').volumen, '1 en ruta · 1 pz');
  const v = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: [], tarimas: 'x' }, cedis: { piezas: 1500 }, camiones: [], distritos: [] });
  assert.equal(v.tramos.find((x) => x.clave === 'puerto').volumen, '0 con ETA vencida · 0 recién llegados'); assert.match(v.tramos.find((x) => x.clave === 'cedis').volumen, /^1,500 pzs/);
});

test('enMinutos(): «empieza ya» en 0, minutos y horas; ilegible o negativa vacía; misión y burbuja de reunión', () => {
  assert.equal(enMinutos(0), 'empieza ya'); assert.equal(enMinutos(5), 'en 5 min'); assert.equal(enMinutos('12'), 'en 12 min');
  assert.equal(enMinutos(60), 'en 1 h'); assert.equal(enMinutos(65), 'en 1 h 5 min'); assert.equal(enMinutos(0.4), 'empieza ya');
  assert.equal(enMinutos(-3), ''); assert.equal(enMinutos('x'), ''); assert.equal(enMinutos(null), ''); assert.equal(enMinutos(Infinity), '');
  const hoy = new Date(2026, 9, 8, 10, 0);
  const m = { oficina: { agenda: [{ hora: '10:00', titulo: 'Junta', ini: 600, estado: 'próxima' }] } };
  const mi = misionesDelDia(m, hoy).find((x) => x.id.startsWith('reunion-'));
  assert.equal(mi.texto, '10:00 · Junta · empieza ya');
  const b = burbujasAtencion(m, hoy).find((x) => x.lugar === 'oficina');
  assert.equal(b.texto, 'Junta empieza ya');
});

test('tarjetaDe(barco): ETA en palabras (mañana, hoy, tarde)', () => {
  const m = { puerto: { barcos: [{ id: 'b1', eta: '2026-11-21', llegaEnDias: 1 }, { id: 'b2', eta: '2026-11-20', llegaEnDias: 0 }, { id: 'b3', eta: '2026-11-18', llegaEnDias: -2 }, { id: 'b4', llegaEnDias: null }], tarimas: [] } };
  const eta = (id) => tarjetaDe({ tipo: 'barco', id }, m).numeros.find((x) => x[0] === 'ETA puerto')[1];
  assert.match(eta('b1'), /· mañana$/); assert.match(eta('b2'), /· hoy$/); assert.match(eta('b3'), /· 2 d tarde$/); assert.equal(eta('b4'), 'sin ETA');
});
test('llegaBarco(): hoy, mañana, en N d, tarde y sin ETA', () => {
  assert.equal(llegaBarco(0), 'llega hoy'); assert.equal(llegaBarco(1), 'llega mañana'); assert.equal(llegaBarco(5), 'llega en 5 d'); assert.equal(llegaBarco(' 3 '), 'llega en 3 d');
  assert.equal(llegaBarco(-2), '2 d tarde'); assert.equal(llegaBarco(0.3), 'llega hoy');
  assert.equal(llegaBarco(1200), 'llega en 1,200 d'); assert.equal(llegaBarco('1,200'), 'llega en 1,200 d'); assert.equal(llegaBarco(-1500), '1,500 d tarde'); assert.equal(llegaBarco(true), 'sin ETA');
  assert.equal(enMinutos(60 * 1200), 'en 1,200 h'); assert.equal(enMinutos('1,500'), 'en 25 h'); assert.equal(enMinutos(true), '');
  assert.equal(llegaBarco(null), 'sin ETA'); assert.equal(llegaBarco(''), 'sin ETA'); assert.equal(llegaBarco('x'), 'sin ETA'); assert.equal(llegaBarco(Infinity), 'sin ETA');
});
test('burbujasAtencion() / capaCiudades(): montos con pesosCorto (sin «$1000 K»)', () => {
  assert.equal(burbujasAtencion({ banco: { carteraVencida: 999600 } }, new Date(2026, 10, 21, 12))[0].texto, 'Cartera vencida $1.0 M');
  assert.equal(burbujasAtencion({ banco: { carteraVencida: 2.5e9 } }, new Date(2026, 10, 21, 12))[0].texto, 'Cartera vencida $2.5 B');
  const c = capaCiudades({ distritos: [{ ciudad: 'GUADALAJARA', tiendas: [{ importe: 999600, previo: 0 }] }] }, 'ventas');
  assert.match(c.porCiudad.get('GUADALAJARA').texto, /^\$1\.0 M/);
});
test('burbujasAtencion(): pagos vencidos en singular aunque vengan en texto', () => {
  const h = new Date(2026, 10, 21, 12);
  assert.equal(burbujasAtencion({ banco: { pagosVencidos: '1' } }, h)[0].texto, '1 pago vencido');
  assert.equal(burbujasAtencion({ banco: { pagosVencidos: ' 3 ' } }, h)[0].texto, '3 pagos vencidos');
  assert.equal(burbujasAtencion({ banco: { pagosVencidos: 1 } }, h)[0].texto, '1 pago vencido');
});

test('numero() lee montos en texto (4.7.15)', () => {
  assert.equal(numero('$5,000'), 5000); assert.equal(numero(' 1,200 '), 1200); assert.equal(numero('-$500'), -500); assert.equal(numero(7.5), 7.5);
  for (const mal of [null, undefined, '', '   ', 'abc', true, false, {}, [], NaN, Infinity, '$']) assert.equal(numero(mal), 0, String(mal));
  const b = resumenBanco([{ vencido: '$5,000' }, { vencido: '1,500' }, { vencido: 'x' }], [], '2026-11-21');
  assert.equal(b.carteraVencida, 6500); assert.equal(b.cuentasVencidas, 2);
});

test('4.7.17 capa de ventas/cartera y pensamientos leen montos en texto', () => {
  const m = { hoyIso: '2026-11-15', kpis: { cartera: [{ cuenta: 'a', vencido: '$5,000' }, { cuenta: 'b', vencido: ' 0 ' }] }, cuotas: new Map(),
    distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', sucursal: 'S1', importe: '$1,200', previo: '1,000' }] }, { ciudad: 'LEON', tiendas: [{ cuenta: 'b', sucursal: 'S2', importe: '$800', previo: '$1,000' }] }] };
  const v = capaCiudades(m, 'ventas'); assert.equal(v.porCiudad.get('GDL').valor, 20); assert.equal(v.porCiudad.get('GDL').tono, 'verde'); assert.equal(v.porCiudad.get('LEON').valor, -20);
  const c = capaCiudades(m, 'cartera'); assert.equal(c.porCiudad.get('GDL').tono, 'rojo'); assert.equal(c.porCiudad.get('GDL').valor, 5000); assert.equal(c.porCiudad.get('LEON').tono, 'verde');
  const p = pensamientos(m); assert.ok(p.some((x) => x.texto === 'Tengo pagos vencidos' && x.cuenta === 'a'), JSON.stringify(p));
});

test('4.7.18 tarjetas, top SKUs y piezas leen montos en texto', () => {
  const m = { cedis: { valor: '$85,000', dias: ' 95 ', piezas: '1,200', skus: '30', racksMarca: [{ marca: 'A', valor: '$750', piezas: '10' }, { marca: 'B', valor: '$250' }] },
    puerto: { barcos: [{ id: 'C1', piezas: '1,200', llegaEnDias: 3 }], tarimas: [] }, distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', vendio: true, importe: '$1,200' }, { cuenta: 'a', importe: '800' }] }] };
  const ce = tarjetaDe({ tipo: 'cedis' }, m); assert.deepEqual(ce.numeros[1], ['Días de inventario', '95']); assert.deepEqual(ce.numeros[2], ['Piezas', '1,200']); assert.equal(ce.estado, 'ambar');
  assert.equal(tarjetaDe({ tipo: 'rack', marca: 'A' }, m).numeros[0][1].endsWith('· 75 %'), true);
  assert.deepEqual(tarjetaDe({ tipo: 'barco', id: 'C1' }, m).numeros[2], ['Piezas', '1,200']);
  assert.equal(tarjetaDe({ tipo: 'ciudad', ciudad: 'GDL' }, m).numeros[1][1], pesosCorto(2000));
  const t = topSkus([{ sku: 'x', importe: '$1,000', cantidad: '2' }, { sku: 'y', importe: '500' }]); assert.equal(t[0].importe, 1000); assert.equal(t[0].cantidad, 2); assert.equal(t[1].importe, 500);
});

test('4.7.19: burbujas y bitácora leen montos en texto con numero()', () => {
  const h = new Date('2026-10-07T11:00:00');
  assert.equal(burbujasAtencion({ banco: { carteraVencida: '$5,000' } }, h)[0].texto, `Cartera vencida ${pesosCorto(5000)}`);
  assert.equal(burbujasAtencion({ banco: { carteraVencida: '', pagosVencidos: ' 1 ' } }, h)[0].texto, '1 pago vencido');
  assert.deepEqual(burbujasAtencion({ banco: { carteraVencida: 'basura', pagosVencidos: '0' } }, h), []);
  assert.equal(burbujasAtencion({ ocDetenidas: '1,200' }, h)[0].texto, '1,200 pedidos de cliente detenidos');
  assert.deepEqual(burbujasAtencion({ ocDetenidas: 'nada' }, h), []);
  const m = { hoyIso: '2026-10-07', camiones: [{ folio: 'F1', cliente: 'A', ciudad: 'GDL', monto: '$750,000', fecha: '2026-10-06' }, { folio: 'F2', cliente: 'B', ciudad: 'GDL', monto: '1,000', fecha: '2026-10-06' }],
    pagosHechos: [{ id: 1, cliente: 'C', monto: ' 600,000 ', pagado_at: '2026-10-07T09:00:00' }] };
  const b = bitacoraEventos(m, h); const por = Object.fromEntries(b.map((x) => [x.id, x.grande]));
  assert.equal(por['factura-F1'], true); assert.equal(por['factura-F2'], false); assert.equal(por['pago-1'], true);
});
test('tituloCamion() / vaA(): sin folio ni cliente ya no dicen «Factura null» ni «va a null»', () => {
  assert.equal(tituloCamion({ folio: 'F1' }, 'Buen Fin'), 'Factura F1 · Buen Fin');
  assert.equal(tituloCamion({ folio: null }), 'Factura');
  assert.equal(tituloCamion({ folio: ' ', envio: true }), 'Envío');
  assert.equal(tituloCamion({ folio: 77, envio: true }), 'Envío · 77');
  assert.equal(tituloCamion(null, undefined), 'Factura');
  assert.equal(vaA({ cliente: 'Pcel', ciudad: 'GUADALAJARA' }), 'va a Pcel (Guadalajara)');
  assert.equal(vaA({ cliente: null, ciudad: 'LEON' }), 'va a León');
  assert.equal(vaA({ cliente: ' Pcel ' }), 'va a Pcel');
  assert.equal(vaA(null), '');
});
test('unirTexto(): une con « · » y salta vacíos, null, NaN y «undefined» (globo del contenedor y del camión)', () => {
  assert.equal(unirTexto('MSK', '1,200 pz', 'llega hoy'), 'MSK · 1,200 pz · llega hoy');
  assert.equal(unirTexto(null, '820 pz', undefined, ' ', 'en el puerto'), '820 pz · en el puerto');
  assert.equal(unirTexto('null', NaN, false, 'undefined', ' A '), 'A');
  assert.equal(unirTexto(['x', null], 3), 'x · 3');
  assert.equal(unirTexto(), '');
});
test('construirModelo(): una cuenta sin nombre usa su clave en la tienda (globo sin «null · Matriz»)', () => {
  const m = construirModelo({ ...d, cuentas: d.cuentas.map((c) => (c.cuenta === 'ct' ? { ...c, nombre: null } : c)) }, hoy);
  const ts = m.distritos.flatMap((x) => x.tiendas).filter((t) => t.cuenta === 'ct');
  assert.ok(ts.length); for (const t of ts) assert.equal(t.nombreCuenta, 'ct');
});
test('tarjetaDe(): torre, tienda, camión y vendedor leen texto/Date y dicen singular (4.7.23)', () => {
  const m = {
    hoyIso: '2026-10-09',
    torre: { abiertas: 1, confirmadas: 1, lineas: 2, compradas: 0, arribos7: '2', atrasados: '1' },
    distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'ct', nombreCuenta: 'CT', sucursal: 'Matriz', importe: 5, previo: 0, vendio: true, vendedores: '0', cartera: { vencido: '$5,000' } }] }],
    camiones: [{ folio: 'F1', fecha: new Date('2026-10-07T12:00:00'), cliente: 'X', monto: 1, piezas: 2 }, { folio: 'F2', fecha: 'pendiente', cliente: 'Y' }],
    vendedoresRuta: [{ nombre: 'Ana', totalMes: '$100', total: 0, clientes: 2, destinos: [{ cliente: null }, { cliente: ' B ' }] }],
  };
  const to = tarjetaDe({ tipo: 'torre' }, m); assert.equal(to.numeros[3][1], '2 · 1 atrasado'); assert.equal(to.estado, 'rojo');
  const ti = tarjetaDe({ tipo: 'tienda', ciudad: 'GDL', cuenta: 'ct', titulo: 'CT · Matriz' }, m);
  assert.ok(ti.numeros.some((x) => x[0] === 'Cartera vencida')); assert.ok(!ti.numeros.some((x) => x[0] === 'Vendedores')); assert.equal(ti.estado, 'rojo');
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F1' }, m).numeros[3][1], '2026-10-07 · hace 2 d');
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F2' }, m).numeros[3][1], '—');
  const v = tarjetaDe({ tipo: 'vendedorErp', titulo: 'Ana' }, m); assert.equal(v.numeros[3][1], 'B'); assert.equal(v.estado, 'verde');
  assert.equal(tarjetaDe({ tipo: 'ciudad', ciudad: 'GDL' }, m).numeros[0][1], '1 de 1');
});

test('porcentaje(): miles es-MX, signo opcional y «—» con lo ilegible; capa de ventas y pensamientos lo usan', () => {
  assert.equal(porcentaje(45), '45 %'); assert.equal(porcentaje(1250), '1,250 %'); assert.equal(porcentaje(12.6), '13 %');
  assert.equal(porcentaje(-0.4), '0 %'); assert.equal(porcentaje(-25), '-25 %'); assert.equal(porcentaje('80'), '80 %');
  assert.equal(porcentaje(30, { signo: true }), '+30 %'); assert.equal(porcentaje(0, { signo: true }), '0 %'); assert.equal(porcentaje(-5, { signo: true }), '-5 %');
  for (const x of [null, undefined, '', NaN, 'abc', Infinity, true, {}]) assert.equal(porcentaje(x), '—');
  const m = { distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', importe: 2350, previo: 100 }] }] };
  assert.match(capaCiudades(m, 'ventas').porCiudad.get('GDL').texto, /\+2,250 % vs mes anterior$/);
});

test('dsoTexto(): días redondeados en singular/plural y nada con 0 o ilegible', () => {
  assert.equal(dsoTexto(45.678), 'DSO 46 días'); assert.equal(dsoTexto(1), 'DSO 1 día'); assert.equal(dsoTexto('1,200'), 'DSO 1,200 días');
  assert.equal(dsoTexto(' 30 '), 'DSO 30 días'); assert.equal(dsoTexto(0.6), 'DSO 1 día');
  for (const x of [0, 0.4, -5, null, undefined, '', NaN, 'abc', Infinity, true, {}]) assert.equal(dsoTexto(x), '');
});
test('piezasTexto(): piezas enteras con miles es-MX y texto con comas; ilegible → 0 pz', () => {
  assert.equal(piezasTexto(1200.5), '1,201 pz'); assert.equal(piezasTexto('1,200'), '1,200 pz'); assert.equal(piezasTexto(' 95 '), '95 pz');
  assert.equal(piezasTexto(1), '1 pz'); assert.equal(piezasTexto(3400000), '3,400,000 pz');
  for (const x of [null, undefined, '', NaN, 'abc', Infinity, {}]) assert.equal(piezasTexto(x), '0 pz');
});
test('haceDias(): hoy/ayer/hace N d con miles es-MX y redondeo; ilegible → vacío', () => {
  assert.equal(haceDias(0), 'hoy'); assert.equal(haceDias(-3), 'hoy'); assert.equal(haceDias(1), 'ayer'); assert.equal(haceDias(0.6), 'ayer');
  assert.equal(haceDias(2.6), 'hace 3 d'); assert.equal(haceDias(1200), 'hace 1,200 d'); assert.equal(haceDias(' 5 '), 'hace 5 d');
  for (const x of [null, undefined, '', NaN, 'abc', Infinity, true, {}]) assert.equal(haceDias(x), '');
});
test('cadena con miles es-MX: puerto, camiones y tiendas («1,200 en ruta», «1,200 de 1,500 vendieron»)', () => {
  const barcos = Array.from({ length: 1200 }, () => ({ llegaEnDias: -1, piezas: 1 }));
  const camiones = Array.from({ length: 1200 }, () => ({ piezas: 1 }));
  const tiendas = Array.from({ length: 1500 }, (_, i) => ({ vendio: i < 1200 }));
  const r = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos }, cedis: { dias: 30 }, camiones, distritos: [{ tiendas }] });
  const t = Object.fromEntries(r.tramos.map((x) => [x.clave, x.volumen]));
  assert.match(t.puerto, /^1,200 con ETA vencida/); assert.match(t.camion, /^1,200 en ruta/); assert.equal(t.tienda, '1,200 de 1,500 vendieron');
});
test('bitácora sin «null»: cliente, folio, contenedor, concepto, estado o título vacíos', () => {
  const h = new Date('2026-10-07T11:00:00');
  const m = { hoyIso: '2026-10-07',
    camiones: [{ folio: null, cliente: null, monto: 1000, fecha: '2026-10-07' }, { envio: true, folio: ' E9 ', cliente: null, paqueteria: null, fecha: '2026-10-06' }, { envio: true, folio: null, cliente: 'pcel', paqueteria: 'DHL', fecha: '2026-10-05' }],
    puerto: { tarimas: [{ id: null, piezas: 1200, arribo: '2026-10-04' }] },
    pagosHechos: [{ id: 1, cliente: null, concepto: '  ', monto: 10, pagado_at: '2026-10-07T10:15:00' }],
    ultimaSync: { status: null, created_at: '2026-10-07T10:40:00' },
    oficina: { agenda: [{ ini: 600, hora: '10:00', titulo: null, estado: 'hecha' }] } };
  const tx = bitacoraEventos(m, h).map((x) => x.texto);
  assert.deepEqual(tx, ['Se actualizaron los datos', 'Pago registrado · $10', 'Fue una reunión', 'Factura · $1 K', 'Salió E9', 'Salió un envío a pcel · DHL', 'Llegó un contenedor al CEDIS · 1,200 pz']);
  for (const t of tx) assert.doesNotMatch(t, /null|undefined|NaN/);
});

test('diaLocal: «hoy» es el día local y su rango cubre ese día (4.7.32)', () => {
  const noche = new Date(2026, 10, 21, 22, 30); // 22:30 local: en UTC (México) ya es el 22
  const d = diaLocal(noche);
  assert.equal(d.iso, '2026-11-21');
  assert.equal(d.desde, new Date(2026, 10, 21).toISOString());
  assert.equal(d.hasta, new Date(2026, 10, 22).toISOString());
  assert.ok(Date.parse(d.desde) <= noche.getTime() && noche.getTime() < Date.parse(d.hasta));
  assert.equal(diaLocal(new Date(2026, 11, 31, 23, 59)).iso, '2026-12-31');
  assert.equal(diaLocal(new Date(2026, 11, 31, 23, 59)).hasta, new Date(2027, 0, 1).toISOString());
  assert.equal(diaLocal('2026-10-07').iso, '2026-10-07');
  for (const x of [null, 'basura', NaN, new Date('x')]) assert.match(diaLocal(x).iso, /^\d{4}-\d{2}-\d{2}$/);
  const m = construirModelo({}, new Date(2026, 10, 21, 22, 30));
  assert.equal(m.hoyIso, '2026-11-21');
});

test('demanda3Meses / piezasMes: piezas en texto (JSON o arreglo Postgres) se leen; basura, null y negativas no suman', () => {
  const h = new Date(2026, 4, 15);
  assert.equal(demanda3Meses([{ sku: 'A', anio: 2026, piezas: '[0,10,20,30]' }], h).get('A'), 60, 'JSON en texto');
  assert.equal(demanda3Meses([{ sku: 'A', anio: '2026', piezas: '{0,10,NULL,30}' }], h).get('A'), 40, 'arreglo Postgres con NULL');
  for (const p of ['1234', 'basura', null, { 1: 5 }, 42, '[mal']) assert.equal(demanda3Meses([{ sku: 'A', anio: 2026, piezas: p }], h).has('A'), false, `sin demanda: ${JSON.stringify(p)}`);
  assert.equal(demanda3Meses([{ sku: 'A', anio: 2026, piezas: [0, -50, 10, 10] }], h).get('A'), 20, 'negativa no resta');
  assert.deepEqual(piezasMes('[1,"2"]'), [1, '2']);
  assert.deepEqual(piezasMes('{"x":1}'), []);
  assert.deepEqual(piezasMes(' { 1 , 2 } '), ['1', '2']);
});

test('Pulido 4.7.34: barra de recursos lee conteos en texto con comas y usa miles es-MX', () => {
  const extra = (pos) => recursosBarra({ enCamino: { valor: 1, pos } })[0].extra;
  assert.equal(extra(1200), '1,200 POs', 'miles es-MX'); assert.equal(extra('1,200'), '1,200 POs', 'texto con coma'); assert.equal(extra(' 1 '), '1 PO');
  for (const p of [0.4, '-3', false, [2], {}]) assert.equal(extra(p), null, `pos ${String(p)}`);
  const cob = (c) => recursosBarra({ inv: { valor: 1, cobertura: c } })[0].extra;
  assert.equal(cob('1,200'), '1,200 d', 'cobertura en texto'); assert.equal(cob(' 45 '), '45 d'); assert.equal(cob(true), null, 'booleano no es día');
  assert.equal(recursosBarra({ cartera: { vencido: '$5,000' } })[0].valor, 5000, 'montos siguen con numero()');
});

test('títulos de reunión vacíos o nulos (4.7.36)', () => {
  const h = new Date('2026-10-05T11:00:00');
  const ag = [{ titulo: null, hora: '11:10', ini: 11 * 60 + 10, estado: 'próxima' }, { titulo: '   ', hora: '16:00', ini: 16 * 60, estado: 'próxima' }];
  const tx = misionesDelDia({ oficina: { agenda: ag } }, h).map((x) => x.texto);
  assert.deepEqual(tx, ['11:10 · Reunión · en 10 min', '16:00 · Reunión']);
  const b = burbujasAtencion({ oficina: { agenda: ag } }, h).find((x) => x.lugar === 'oficina');
  assert.equal(b.texto, 'Reunión en 10 min');
  const rs = reunionesDelDia([{ titulo: '  ', fecha: '2026-10-05T10:00:00' }, { titulo: ' Pcel ', fecha: '2026-10-05T12:00:00' }], h);
  assert.deepEqual(rs.map((r) => r.titulo), ['Reunión', 'Pcel']);
  const ps = [{ id: 'u1' }, { id: 'u2' }];
  presenciaPersonas(ps, [{ titulo: ' ', fecha: '2026-10-05T10:50:00', duracion_min: 60, creado_por: 'u1' }], [{ tipo: 'viaje', titulo: null, fecha: '2026-10-05', creado_por: 'u2' }], h);
  assert.equal(ps[0].presencia.titulo, 'Reunión'); assert.equal(ps[1].presencia.titulo, 'Viaje');
  const t = tarjetaDe({ tipo: 'persona', persona: { nombre: 'A', pendientes: 1, hechas: 0, presencia: { estado: 'viaje', titulo: null } } }, {});
  assert.equal(t.numeros[0][1], 'De viaje');
  const t2 = tarjetaDe({ tipo: 'persona', persona: { nombre: 'A', presencia: { estado: 'reunion', titulo: ' Pcel ' } } }, {});
  assert.equal(t2.numeros[0][1], 'En reunión · Pcel');
});

test('nombrePersona(): sin nombre usa el correo y sin nada dice «Persona» (antes null)', () => {
  assert.equal(nombrePersona({ nombre: ' Ana López ' }), 'Ana López');
  assert.equal(nombrePersona({ nombre: null, email: 'ana.lopez@x.com' }), 'ana.lopez');
  assert.equal(nombrePersona({ nombre: '  ', email: ' ' }), 'Persona');
  assert.equal(nombrePersona(null), 'Persona');
  const m = construirModelo({ perfiles: [{ user_id: 'u1', activo: true, nombre: null, email: null, puesto: null, rol: ' finanzas ' }] }, new Date(2026, 10, 20, 10));
  const per = m.oficina.personas[0];
  assert.equal(per.nombre, 'Persona');
  assert.equal(per.puesto, 'finanzas');
  assert.equal(per.rol, 'direccion');
});
