// Acteck Ciudad · modelo puro. node --test scripts/test-ciudad-modelo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirModelo, ciudadDeSucursal, CIUDADES, posDe, capasVisibles, DETALLE, esChico, etiquetasSinEncimar, encuadre, campus, encimaDelCampus, juntarCapas, capaVisible, vistaMapa, EXTREMOS_MEXICO, ZOOM_MAX, ZOOM_MIN, zoomEnRango, pinCiudad, enLaBase, vistaCiudad, nivelVista, ciudadesTop, planoMini, leerVista, claveVista, tarjetaDe } from '../src/modules/ciudad/modelo.js';

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
