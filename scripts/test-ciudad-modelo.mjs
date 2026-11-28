// Acteck Ciudad · modelo puro. node --test scripts/test-ciudad-modelo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { colorCuenta, sedeDeCuenta, nombreSucursal, estatusBarco, comoLista, diasCedis, diasTexto, tonoDias, estadoDias, motivoDias, cuantos, construirModelo, ciudadDeSucursal, CIUDADES, posDe, capasVisibles, DETALLE, esChico, etiquetasSinEncimar, encuadre, campus, encimaDelCampus, juntarCapas, capaVisible, vistaMapa, EXTREMOS_MEXICO, ZOOM_MAX, ZOOM_MIN, zoomEnRango, pinCiudad, enLaBase, vistaCiudad, nivelVista, ciudadesTop, planoMini, leerVista, claveVista, tarjetaDe, resumenBanco, resumenTorre, racksPorMarca, acomodoRacks, demanda3Meses, ponerPosEnPuerto, listaCorta, reunionesDelDia, acomodoEscritorios, presenciaPersonas, topSkus, pesosCorto, recursosBarra, burbujasAtencion, misionesDelDia, capaCiudades, CAPA_TONOS, cuotasPorCuenta, bitacoraEventos, pensamientos, circuitoVendedor, tramoActual, rumboBarcos, repartoPorEstado, CIUDAD_POR_ESTADO, cadenaSuministro, cintasCadena, cuotaRitmo, celebraciones, momentosTiempo, datosEnFecha, eventosCalendario, camionesTemporada, ventanasOficina, formaArbol, rebote, saltito, RECORRIDO, recorridoVisto, capasSonido, gestoDosDedos, paseantesDistrito, nombreCiudad, cifraCorta, norm, PX, K, aPx, PX_ORIGEN, pxAEscena, ORIGEN, COLOR_CUENTA, hexCss, SEDE_POR_CUENTA, RECORRIDO_CLAVE, fechaHoy, sinNulos, listasDatos, LISTAS_DATOS, fechaIso, plural, pluralEs, enMinutos, llegaBarco, numero, unirTexto, tituloCamion, vaA, nombrePersona, nombreTienda, leyendaCuentas, porcentaje, dsoTexto, temperaturaTexto, pendientesTexto, piezasTexto, haceDias, faltanDias, diaLocal, piezasMes, fechaCorta, carteraPorCuenta, tonoCartera, tonoCarteraCuenta, tonoBanco, tonoCuota, tonoActivas, textoSync, fuenteSync, claveSku, claveTexto , esClase, piezasSiHay, contenedorCerrado } from '../src/modules/ciudad/modelo.js';

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
  // 4.12.5: conurbados y abreviaturas
  for (const [n, c] of [['San Pedro Garza García', 'MONTERREY'], ['Sta. Catarina', 'MONTERREY'], ['Tonalá', 'GUADALAJARA'], ['Metepec', 'TOLUCA'], ['Ecatepec', 'CIUDAD DE MEXICO'], ['Plaza Cuautitlán Izcalli', 'CIUDAD DE MEXICO'], ['Gómez Palacio', 'TORREON'], ['San Andrés Cholula', 'PUEBLA'], ['QRO', 'QUERETARO'], ['Ags 2', 'AGUASCALIENTES'], ['San Pedro Tlaquepaque', 'GUADALAJARA']]) assert.equal(ciudadDeSucursal(n).ciudad, c, n);
  assert.equal(ciudadDeSucursal('San Pedro').ciudad, null); // ambiguo: no se adivina
  // 4.12.6: más conurbados; calles homónimas no adivinan
  for (const [n, c] of [['Coyoacán', 'CIUDAD DE MEXICO'], ['Gustavo A. Madero', 'CIUDAD DE MEXICO'], ['Ixtapaluca', 'CIUDAD DE MEXICO'], ['Plaza Boca del Río', 'VERACRUZ'], ['Cd. Madero', 'TAMPICO'], ['Altamira', 'TAMPICO'], ['El Marqués', 'QUERETARO'], ['Ramos Arizpe', 'SALTILLO'], ['Rosarito', 'TIJUANA'], ['Soledad de Graciano Sánchez', 'SAN LUIS POTOSI'], ['Mineral de la Reforma', 'PACHUCA'], ['Jiutepec', 'CUERNAVACA'], ['Villa de Álvarez', 'COLIMA'], ['Zinacantepec', 'TOLUCA']]) assert.equal(ciudadDeSucursal(n).ciudad, c, n);
  for (const x of ['Av. Madero', 'Corregidora']) assert.equal(ciudadDeSucursal(x).ciudad, null, `«${x}» no se adivina`);
  assert.equal(ciudadDeSucursal('XALAPA').ciudad, 'XALAPA');
  for (const x of ['A', 'LA', 'MEX']) assert.equal(ciudadDeSucursal(x).ciudad, null, `«${x}» es muy corto para adivinar la ciudad`);
  assert.equal(ciudadDeSucursal('JUAREZ').ciudad, 'CIUDAD JUAREZ', 'un nombre parcial largo sí empata');
  // 4.7.53: palabras completas y el alias más largo gana
  for (const x of ['NAPOLEON', 'MONTE', 'PANTEON', 'COLIMAN']) assert.equal(ciudadDeSucursal(x).ciudad, null, `«${x}» no es una ciudad`);
  assert.equal(ciudadDeSucursal('SUC ESTADO DE MEXICO').ciudad, 'TOLUCA');
  assert.equal(ciudadDeSucursal('Baja California Sur Los Cabos').ciudad, 'LA PAZ');
  assert.equal(ciudadDeSucursal('Galerías León').ciudad, 'LEON');
  assert.equal(ciudadDeSucursal('GDL1').ciudad, 'GUADALAJARA');
  assert.equal(ciudadDeSucursal('MTY-SUR').ciudad, 'MONTERREY');
  assert.equal(ciudadDeSucursal('CD. JUAREZ').ciudad, 'CIUDAD JUAREZ');
  assert.equal(ciudadDeSucursal('Torreón Centro').ciudad, 'TORREON');
  // 4.12.10: ciudades nuevas del catálogo, sin cambiar la representativa del estado
  for (const [n, c] of [['Playa del Carmen', 'PLAYA DEL CARMEN'], ['Plaza Chetumal', 'CHETUMAL'], ['Cabo San Lucas', 'LOS CABOS'], ['San José del Cabo', 'LOS CABOS'], ['Nvo. Laredo', 'NUEVO LAREDO'], ['Matamoros', 'MATAMOROS'], ['Monclova Centro', 'MONCLOVA'], ['Cd. Obregón', 'CIUDAD OBREGON'], ['Cd. del Carmen', 'CIUDAD DEL CARMEN']]) assert.equal(ciudadDeSucursal(n).ciudad, c, n);
  assert.equal(ciudadDeSucursal('Plaza Álvaro Obregón').ciudad, 'CIUDAD DE MEXICO', 'alcaldía, no Cd. Obregón');
  assert.equal(ciudadDeSucursal('Cancún').ciudad, 'CANCUN');
  for (const [e, c] of [['QUINTANA ROO', 'CANCUN'], ['BAJA CALIFORNIA SUR', 'LA PAZ'], ['TAMAULIPAS', 'TAMPICO'], ['COAHUILA', 'SALTILLO'], ['SONORA', 'HERMOSILLO'], ['CAMPECHE', 'CAMPECHE']]) assert.equal(CIUDAD_POR_ESTADO[e], c, e);
  assert.equal(nombreCiudad('CIUDAD OBREGON'), 'Ciudad Obregón'); assert.equal(nombreCiudad('PLAYA DEL CARMEN'), 'Playa del Carmen');
  assert.equal(ciudadDeSucursal('AGUASCAL').ciudad, 'AGUASCALIENTES', 'palabra cortada de ≥ 6 letras');
  assert.equal(ciudadDeSucursal('Plaza La Paz').ciudad, 'LA PAZ');
  assert.equal(ciudadDeSucursal('San Nicolás de los Garza').ciudad, 'MONTERREY');
  // 4.12.69: más conurbados; «Satélite» solo no adivina y «Los Reyes La Paz» no es La Paz
  for (const [n, c] of [['Texcoco', 'CIUDAD DE MEXICO'], ['Plaza Valle de Chalco', 'CIUDAD DE MEXICO'], ['Plaza Satélite', 'CIUDAD DE MEXICO'], ['Interlomas', 'CIUDAD DE MEXICO'], ['Cd. Neza', 'CIUDAD DE MEXICO'], ['Los Reyes La Paz', 'CIUDAD DE MEXICO'], ['Temixco', 'CUERNAVACA'], ['Kanasín', 'MERIDA'], ['Tarímbaro', 'MORELIA'], ['Cuautlancingo', 'PUEBLA'], ['San Mateo Atenco', 'TOLUCA']]) assert.equal(ciudadDeSucursal(n).ciudad, c, n);
  assert.equal(ciudadDeSucursal('Satélite').ciudad, null); assert.equal(ciudadDeSucursal('Plaza La Paz').ciudad, 'LA PAZ');
  // 4.7.54: virtual por palabra completa
  assert.deepEqual(ciudadDeSucursal('General Escobedo'), { ciudad: 'MONTERREY', virtual: false });
  assert.deepEqual(ciudadDeSucursal('WEBER PUEBLA'), { ciudad: 'PUEBLA', virtual: false });
  for (const x of ['SUCURSAL GENERAL', 'E-COMMERCE', 'ECOMMERCE', 'Tienda en línea', 'CEDIS GDL', 'MercadoLibre', 'WEB']) assert.equal(ciudadDeSucursal(x).virtual, true, `«${x}» es virtual`);
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
  assert.equal(esChico(.8), true, 'árbol .8 es chico (capa fina)'); assert.equal(esChico(1), false, 'escala 1 no es chico'); assert.equal(esChico(1.2), false); assert.equal(esChico(undefined), false, 'sin escala no es chico'); assert.equal(esChico('0.8'), true, 'escala en texto se lee'); assert.equal(esChico(' 1.5 '), false); for (const v of [null, '', 'abc', false, true, NaN, -Infinity, []]) assert.equal(esChico(v), false, `escala ilegible ${JSON.stringify(v)} no es chico`);
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
  { const base = encimaDelCampus(c, posDe(CIUDADES.LEON), 0, 0, cajaGDL);
    for (const v of [-7, Infinity, NaN, 'x', {}, [], '']) assert.equal(encimaDelCampus(c, posDe(CIUDADES.LEON), v, v, cajaGDL), base, `medida ${String(v)} cuenta como 0`);
    assert.equal(encimaDelCampus(c, posDe(CIUDADES.MONTERREY), '7', ' 4.5 ', cajaGDL), false, 'medidas en texto se leen');
    const g0 = c.distritoGDL(0, 0); for (const v of [-10, Infinity, 'x', {}, null]) assert.deepEqual(c.distritoGDL(v, v), g0, `distritoGDL ${String(v)} = sin medida`);
    assert.deepEqual(c.distritoGDL('15', '10'), c.distritoGDL(15, 10), 'distritoGDL lee texto'); }
  assert.equal(encimaDelCampus(null, { x: 0, z: 0 }), false); assert.equal(encimaDelCampus(c, { x: NaN, z: 0 }), false, 'datos inválidos no esconden nada');
  assert.equal(juntarCapas('fino', 'mapa'), 'fino+mapa'); assert.equal(juntarCapas('mapa+fino', 'mapa'), 'fino+mapa', 'sin repetir');
  assert.equal(juntarCapas(undefined, false, ''), undefined); assert.equal(juntarCapas(false, 'mapa'), 'mapa');
  const cerca = capasVisibles(30), lejos = capasVisibles(DETALLE.mapa + 1);
  assert.equal(capaVisible(cerca, 'mapa'), false, 'de cerca no se ve'); assert.equal(capaVisible(lejos, 'mapa'), true, 'de lejos sí');
  assert.equal(capaVisible(lejos, 'fino+mapa'), true); assert.equal(capaVisible(capasVisibles(70), 'fino+mapa'), false, 'muy lejos lo fino se va');
  assert.equal(capaVisible(cerca, undefined), true, 'sin capa siempre se ve');
  assert.equal(juntarCapas({}, 'mapa'), 'mapa', 'un objeto no es capa'); assert.equal(juntarCapas(5, true, [], null), undefined);
  assert.equal(juntarCapas(' mapa ', 'mapa'), 'mapa', 'con espacios no se repite'); assert.equal(juntarCapas(' fino + mapa '), 'fino+mapa');
  assert.equal(capaVisible(cerca, ' mapa '), false, 'con espacios también se esconde de cerca'); assert.equal(capaVisible(cerca, {}), true, 'objeto = sin capa');
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
  assert.equal(zoomEnRango(500), ZOOM_MAX); assert.equal(zoomEnRango(2), ZOOM_MIN); assert.equal(zoomEnRango(50), 50); assert.equal(zoomEnRango(NaN), ZOOM_MAX); assert.equal(zoomEnRango('50'), 50, 'zoom en texto se lee'); assert.equal(zoomEnRango(' 500 '), ZOOM_MAX); assert.equal(zoomEnRango(-Infinity), ZOOM_MIN, '-Infinity al mínimo'); assert.equal(zoomEnRango(Infinity), ZOOM_MAX); for (const v of [null, undefined, '', 'abc', true, {}, []]) assert.equal(zoomEnRango(v), ZOOM_MAX, `zoom ilegible ${JSON.stringify(v)} → máximo`);
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
  { const t = ciudadesTop({ distritos: [{ ciudad: 'LEON', tiendas: Array.from({ length: 1200 }, () => ({ vendio: true })) }], camiones: [{ ciudad: 'LEON' }] })[0];
    assert.equal(t.cifra, '1,201', 'actividad con miles es-MX'); assert.equal(t.titulo, 'Ir a León: 1,200 tiendas activas · 1 camión llegando', 'título con plural y miles');
    const u = ciudadesTop({ distritos: [{ ciudad: 'LEON', tiendas: [{ vendio: true }] }] })[0]; assert.equal(u.titulo, 'Ir a León: 1 tienda activa', 'singular sin camiones'); }
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
  { // 4.12.9: aEscena acotada a las puntas de México y null con toque ilegible
    const pts = EXTREMOS_MEXICO.map(posDe), xs = pts.map((q) => q.x), zs = pts.map((q) => q.z);
    for (const [u, v] of [[0, 0], [150, 96], [-50, 500], [75, 0]]) { const e2 = p.aEscena(u, v); assert.ok(e2.x >= Math.min(...xs) - 1e-9 && e2.x <= Math.max(...xs) + 1e-9 && e2.z >= Math.min(...zs) - 1e-9 && e2.z <= Math.max(...zs) + 1e-9, `aEscena(${u},${v}) dentro de México`); }
    assert.equal(p.aEscena(NaN, 5), null); assert.equal(p.aEscena(5, 'x'), null); assert.equal(p.aEscena(), null);
    const e3 = p.aEscena(String(gdl.u), String(gdl.v)); assert.ok(Math.hypot(e3.x - g.x, e3.z - g.z) < 1, 'u/v en texto se leen');
  }
});
test('última vista: lectura tolerante desde localStorage', () => {
  const g = posDe(CIUDADES.GUADALAJARA);
  assert.deepEqual(leerVista(JSON.stringify({ cx: g.x, cz: g.z, zoom: 30 })), { cx: g.x, cz: g.z, zoom: 30 });
  assert.equal(leerVista(JSON.stringify({ cx: g.x, cz: g.z, zoom: 9999 })).zoom, ZOOM_MAX, 'zoom acotado');
  assert.equal(leerVista(JSON.stringify({ cx: g.x, cz: g.z, zoom: 1 })).zoom, ZOOM_MIN);
  for (const t of [null, '', 'no-json', '{}', '{"cx":"a","cz":0,"zoom":10}', JSON.stringify({ cx: 1e6, cz: 0, zoom: 20 }), JSON.stringify({ cx: 0, cz: -1e6, zoom: 20 })]) assert.equal(leerVista(t), null, String(t));
  assert.equal(claveVista('u1'), 'acteck.ciudad.vista.u1'); assert.equal(claveVista(null), 'acteck.ciudad.vista.anon');
  assert.equal(claveVista(' u1 '), 'acteck.ciudad.vista.u1', 'id con espacios'); assert.equal(claveVista(7), 'acteck.ciudad.vista.7');
  for (const raro of [{}, [], true, NaN, '  ']) assert.equal(claveVista(raro), 'acteck.ciudad.vista.anon', 'id raro → anon');
});
test('tarjeta del edificio: una plantilla con estado y hasta 4 números', () => {
  const mod = { oficina: { personas: [{ pendientes: 3, hechas: 1 }], genericos: 2, reuniones: 1, reunionEnCurso: null }, cedis: { valor: 12.5e6, dias: 95, piezas: 1000, skus: 40 }, puerto: { barcos: [{ piezas: 10, llegaEnDias: 3 }, { piezas: 5, llegaEnDias: null }], tarimas: [], totalPiezas: 15 },
    distritos: [{ ciudad: 'LEON', cuentas: ['ct'], vendedores: [], tiendas: [{ cuenta: 'ct', nombreCuenta: 'CT', sucursal: 'León', importe: 250000, previo: 1e5, vendio: true, vendioMes: true }, { cuenta: 'ct', nombreCuenta: 'CT', sucursal: 'Centro', importe: 0, previo: 0, vendio: false, cartera: { vencido: 5000 } }] }] };
  const of = tarjetaDe({ tipo: 'oficina', titulo: 'Oficina', pagina: 'agenda' }, mod);
  assert.deepEqual(of.numeros[0], ['Personas', '3']); assert.equal(of.estado, 'verde'); assert.equal(of.pagina, 'agenda');
  { // 4.12.1: pendientes/hechas/genéricos en texto o negativos no se concatenan ni restan
    const of2 = tarjetaDe({ tipo: 'oficina' }, { oficina: { personas: [{ pendientes: '2', hechas: '1' }, { pendientes: 3, hechas: -4 }, null], genericos: '3', agenda: [], reuniones: 0 } });
    const v = Object.fromEntries(of2.numeros); assert.equal(v.Pendientes, '5'); assert.equal(v.Hechas, '1'); assert.equal(v.Personas, '5');
  }
  { // 4.12.48: conteos con decimales o «1,200» en texto salen enteros en la tarjeta
    const v = Object.fromEntries(tarjetaDe({ tipo: 'oficina' }, { oficina: { personas: [{ pendientes: '2.6', hechas: 1.4 }, { pendientes: '1,200', hechas: -0.4 }], genericos: 0.5, agenda: [], reuniones: '3' } }).numeros);
    assert.equal(v.Personas, '3'); assert.equal(v.Pendientes, '1,203'); assert.equal(v.Hechas, '1'); assert.equal(v['Reuniones hoy'], '3');
  }
  const ce = tarjetaDe({ tipo: 'cedis' }, mod); assert.equal(ce.numeros[0][1], '$12.5 M'); assert.equal(ce.estado, 'verde', '95 días → sano como Inicio (4.12.13)');
  assert.equal(tarjetaDe({ tipo: 'puerto' }, mod).estado, 'ambar', 'un barco sin ETA');
  { // 4.12.20: la tarjeta del puerto coincide con su globo «con ETA vencida»
    const pu = { puerto: { totalPiezas: 900, tarimas: [], barcos: [{ id: 'T', llegaEnDias: -2 }, { id: 'P', llegaEnDias: 3 }, { id: 'R', llegaEnDias: -1, arribo: '2026-11-20' }, null] } };
    const tp = tarjetaDe({ tipo: 'puerto' }, pu), vp = Object.fromEntries(tp.numeros);
    assert.equal(tp.estado, 'rojo'); assert.equal(vp['ETA vencida'], '1'); assert.equal(vp['Llegan en 7 días'], '1', 'el atrasado ya no cuenta como «llega en 7 días»');
    assert.equal(burbujasAtencion({ puerto: pu.puerto }).find((x) => x.lugar === 'puerto')?.nivel, 'rojo');
    const ok = tarjetaDe({ tipo: 'puerto' }, { puerto: { totalPiezas: 900, barcos: [{ llegaEnDias: 5 }] } });
    assert.equal(ok.estado, 'verde'); assert.equal(Object.fromEntries(ok.numeros)['Piezas en el mar'], '900');
    assert.equal(tarjetaDe({ tipo: 'barco', barco: { llegaEnDias: -3 } }, {}).estado, 'rojo', 'barco atrasado tocado sin id');
    assert.equal(tarjetaDe({ tipo: 'barco', barco: { llegaEnDias: -3, arribo: '2026-11-20' } }, {}).estado, 'verde');
  }
  const ci = tarjetaDe({ tipo: 'ciudad', ciudad: 'LEON' }, mod); assert.deepEqual(ci.numeros[0], ['Tiendas activas', '1 de 2']); assert.equal(ci.estado, 'ambar');
  const ti = tarjetaDe({ tipo: 'tienda', ciudad: 'LEON', cuenta: 'ct', titulo: 'CT · Centro' }, mod); assert.equal(ti.estado, 'rojo'); assert.ok(ti.numeros.some(([l]) => l === 'Cartera vencida'));
  assert.equal(tarjetaDe({ tipo: 'tienda', ciudad: 'LEON', cuenta: 'ct', titulo: 'CT · León' }, mod).estado, 'verde');
  { // 4.12.23: tarjeta de la tienda con el semáforo de cartera de Inicio (≤ 15 % del saldo ámbar) y el % del saldo
    const tm = (cartera, vendioMes = true) => tarjetaDe({ tipo: 'tienda', ciudad: 'X', cuenta: 'k', titulo: nombreTienda({ cuenta: 'k', sucursal: 'S' }) }, { distritos: [{ ciudad: 'X', tiendas: [{ cuenta: 'k', sucursal: 'S', importe: 10, vendioMes, vendio: true, cartera }] }] });
    let r = tm({ vencido: 100, saldo: 1000 }); assert.equal(r.estado, 'ambar', '10 % del saldo'); assert.ok(r.numeros.some(([l, v]) => l === 'Cartera vencida' && /10 % del saldo/.test(v)), JSON.stringify(r.numeros));
    assert.equal(tm({ vencido: 300, saldo: 1000 }).estado, 'rojo', '30 % del saldo'); assert.equal(tm({ vencido: 100 }).estado, 'rojo', 'sin saldo legible');
    assert.equal(tm({ vencido: 0, saldo: 1000 }).estado, 'verde'); assert.equal(tm({ vencido: 100, saldo: 1000 }, false).estado, 'ambar', 'vendió el mes pasado');
  }
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
  assert.deepEqual(b, { saldo: 0, pctVencido: null, dso: null, mas90: 0, carteraVencida: 2e6, cuentasVencidas: 1, pagosSemana: 1, montoSemana: 100, pagosVencidos: 1, montoVencido: 50 });
  assert.deepEqual(resumenBanco(null, null, hoyIso), { saldo: 0, pctVencido: null, dso: null, mas90: 0, carteraVencida: 0, cuentasVencidas: 0, pagosSemana: 0, montoSemana: 0, pagosVencidos: 0, montoVencido: 0 }, 'sin datos no rompe');
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
  assert.deepEqual(acomodoRacks([{ marca: {}, valor: 5 }, { marca: true }, { marca: NaN }, { marca: [] }, 7, { marca: ' ACTECK ', valor: 2 }]).map((r) => r.marca), ['ACTECK'], 'marca no texto se salta y sale limpia');
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
  // 4.12.15: el rack usa el semáforo del CEDIS / Inicio (< 30 rojo, > 120 ámbar), no los umbrales viejos (> 120 rojo).
  assert.equal(tarjetaDe({ tipo: 'rack', marca: 'BALAM' }, { cedis: { racksMarca: r } }).estado, 'ambar', '900 días = alto (ámbar), como el CEDIS');
  const tonoRack = (dias) => tarjetaDe({ tipo: 'rack', marca: 'X' }, { cedis: { racksMarca: [{ marca: 'X', valor: 1, piezas: 1, skus: 1, dias }] } }).estado;
  assert.deepEqual([10, 29, 30, 100, 120, 121, null].map(tonoRack), ['rojo', 'rojo', 'verde', 'verde', 'verde', 'ambar', null], 'mismo corte que tonoDias()');
  assert.equal(tonoRack(10), tonoDias(10)); assert.equal(tonoRack(500), tonoDias(500));
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
  assert.equal(b[0].pct, 85); assert.equal(b[0].tono, null); assert.equal(b[1].extra, '95 d'); assert.equal(b[2].tono, 'rojo'); assert.equal(b[3].extra, '7 POs');
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
  // 4.7.59: negativo no da burbuja; barcos/agenda que no son lista no truenan
  assert.deepEqual(burbujasAtencion({ ocDetenidas: -3 }, h), []);
  assert.deepEqual(burbujasAtencion({ ocDetenidas: '-1,200' }, h), []);
  assert.deepEqual(burbujasAtencion({ puerto: { barcos: 'x' }, oficina: { agenda: { a: 1 } } }, h), []);
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
  // 4.12.39: cuenta con espacios/mayúsculas empata y dos renglones suman; cartera que no es lista no lanza error.
  const mc = { distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: ' PCEL ' }] }], kpis: { cartera: [{ cuenta: 'pcel', vencido: 10, saldo: 100 }, { cuenta: 'PCEL', vencido: 5, saldo: 100 }, null] } };
  const cc = capaCiudades(mc, 'cartera').porCiudad.get('GDL');
  assert.equal(cc.valor, 15); assert.equal(cc.tono, 'ambar'); assert.equal(cc.texto, '1 cuenta con vencido · $15 · 8 % del saldo');
  assert.equal(capaCiudades({ distritos: mc.distritos, kpis: { cartera: 'x' } }, 'cartera').porCiudad.get('GDL').tono, 'verde');
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
  assert.deepEqual(b.map((x) => [x.cuando, x.texto]), [['10:40', 'Se actualizaron los datos'], ['10:15', 'Pago registrado · pcel · Rebate · $600 K'], ['hoy', 'Factura F1 · Digitalife · $1 K'], ['hace 2 d', 'Pago registrado · x · $10']]);
  assert.equal(b[0].ir, null); assert.deepEqual(b[1].ir, { tipo: 'banco' }); assert.equal(b[1].grande, true);
  assert.deepEqual(bitacoraEventos({ hoyIso: '2026-10-07', ultimaSync: { created_at: null } }, h), []);
});

test('pensamientos de tiendas', () => {
  const T = (cuenta, sucursal, importe, previo) => ({ cuenta, nombreCuenta: cuenta.toUpperCase(), sucursal, importe, previo });
  const m = { hoyIso: '2026-10-31', kpis: { cartera: [{ cuenta: 'mala', vencido: 10 }] }, cuotas: new Map([['q', { venta: 100, cuota: 100 }]]),
    distritos: [
      { ciudad: 'GDL', tiendas: [T('a', 'Centro', 200, 100), T('mala', 'Sur', 50, 50)] },
      { ciudad: 'MTY', tiendas: [T('b', 'Valle', 0, 80)] },
      { ciudad: 'CDMX', tiendas: [T('c', 'Polanco', 50, 100), T('d', 'Roma', 100, 100)] },
      { ciudad: 'PUE', tiendas: [T('q', 'Angelópolis', 100, 100)] },
      { ciudad: 'QRO', tiendas: [T('e', 'Juriquilla', 100, 100)] },
      { ciudad: 'LEO', tiendas: [T('f', 'Plaza', 150, 100)] },
    ] };
  const p = pensamientos(m, 10);
  assert.deepEqual(p.map((x) => [x.ciudad, x.tono, x.texto]), [['GDL', 'rojo', 'Tengo pagos vencidos'], ['MTY', 'rojo', 'Este mes no he vendido nada'], ['CDMX', 'ambar', 'Voy 50 % abajo del ritmo del mes pasado'], ['LEO', 'verde', '¡Voy 50 % arriba del ritmo del mes pasado!'], ['PUE', 'verde', '¡Ya llegué a mi cuota!']]);
  assert.equal(p[0].nombre, 'MALA · Sur'); assert.equal(p[0].sucursal, 'Sur'); assert.ok(!p.some((x) => 'peso' in x));
  assert.equal(pensamientos(m).length, 5); assert.equal(pensamientos(m, 2).length, 2);
  assert.deepEqual(pensamientos(null), []); assert.deepEqual(pensamientos({}), []);
  { // 4.12.24: cartera con el semáforo de Inicio — ≤ 15 % del saldo ámbar (tras «no he vendido»), > 15 % o sin saldo rojo
    const pc = (cartera, t = T('k', 'S', 100, 100)) => pensamientos({ hoyIso: '2026-10-31', kpis: { cartera }, distritos: [{ ciudad: 'X', tiendas: [t] }] })[0];
    assert.deepEqual([pc([{ cuenta: 'k', vencido: 100, saldo: 1000 }])?.tono, pc([{ cuenta: 'k', vencido: 100, saldo: 1000 }])?.texto], ['ambar', 'Tengo algo de cartera vencida']);
    assert.equal(pc([{ cuenta: 'k', vencido: 300, saldo: 1000 }]).tono, 'rojo'); assert.equal(pc([{ cuenta: 'k', vencido: 100 }]).tono, 'rojo', 'sin saldo');
    assert.equal(pc([{ cuenta: ' k ', vencido: 100, saldo: 1000 }, { cuenta: 'k', vencido: 500, saldo: 1000 }]).tono, 'rojo', 'gana el peor');
    assert.equal(pc([{ cuenta: 'k', vencido: 0, saldo: 1000 }]), undefined, 'al corriente sin pensamiento');
    assert.equal(pc([{ cuenta: 'k', vencido: 100, saldo: 1000 }], T('k', 'S', 0, 100)).texto, 'Este mes no he vendido nada', 'no vender pesa más que ámbar');
  }
  assert.ok(Array.isArray(pensamientos(construirModelo(d, hoy))));
  // 4.12.25: tonos de las banderas de tienda y banco
  assert.equal(tonoCarteraCuenta({ vencido: 100, saldo: 1000 }), 'ambar'); assert.equal(tonoCarteraCuenta({ vencido: '$300', saldo: 1000 }), 'rojo');
  assert.equal(tonoCarteraCuenta({ vencido: 100 }), 'rojo'); assert.equal(tonoCarteraCuenta(null), 'verde'); assert.equal(tonoCarteraCuenta({ vencido: 0, saldo: 5 }), 'verde');
  assert.equal(tonoBanco({ carteraVencida: 100, pctVencido: 10 }), 'ambar'); assert.equal(tonoBanco({ carteraVencida: 100, pctVencido: 10, pagosVencidos: '1' }), 'rojo');
  assert.equal(tonoBanco({ carteraVencida: 100, pctVencido: 20 }), 'rojo'); assert.equal(tonoBanco(null), 'verde'); assert.equal(tonoBanco({}), 'verde');
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
  assert.deepEqual(tj.numeros, [['Cliente', 'Digitalife'], ['Factura', '$1.3 M'], ['Piezas', '1,200'], ['Salió', `${fechaCorta('2026-10-06')} · ayer`]]); assert.equal(tj.estado, 'verde');
  tj = tarjetaDe({ tipo: 'camion', folio: 'guía 9' }, m);
  assert.deepEqual(tj.numeros, [['Cliente', 'PCEL'], ['Paquetería', 'DHL'], ['Salió', `${fechaCorta('2026-09-30')} · hace 7 d`], ['Destino', 'Monterrey']]); assert.equal(tj.estado, 'ambar');
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
  // 4.12.97: ETA con unidad, como llegaBarco()
  assert.deepEqual(rumboBarcos([{ llegaEnDias: '4 días' }, { llegaEnDias: '0 d' }, { llegaEnDias: '20 días' }, { llegaEnDias: true }]).map((x) => x.modo), ['llegando', 'atracado', 'navegando', 'navegando']);
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
  assert.deepEqual(r.tramos.map((t) => [t.clave, t.estado]), [['mar', 'verde'], ['puerto', 'rojo'], ['cedis', 'verde'], ['camion', 'ambar'], ['tienda', 'ambar'], ['cliente', 'verde']]);
  assert.equal(r.tramos[0].volumen, '2 barcos · 1,500 pz'); assert.equal(r.tramos[1].volumen, '1 con ETA vencida · 1 llega hoy · 1 recién llegado'); assert.equal(r.tramos[1].motivo, '1 barco con más de 3 días de atraso');
  assert.equal(r.tramos[4].volumen, '2 de 3 vendieron'); assert.equal(r.tramos[5].volumen, '120 clientes · $2.5 M'); assert.equal(r.atasco.clave, 'puerto');
  const v = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: [] }, cedis: { dias: 30 }, camiones: [], distritos: [] });
  assert.deepEqual(v.tramos.map((t) => t.estado), ['gris', 'verde', 'verde', 'gris', 'gris', 'gris']); assert.equal(v.atasco, null);
  assert.deepEqual(cadenaSuministro(null), { tramos: [], atasco: null });
  // 4.12.31: barcos que llegan hoy (ETA 0) no son «ETA vencida» ni pintan ámbar; uno vencido sí.
  const hoyB = (b) => cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: b }, cedis: { dias: 30 }, camiones: [], distritos: [] }).tramos[1];
  assert.deepEqual([hoyB([{ llegaEnDias: 0 }, { llegaEnDias: '0' }]).volumen, hoyB([{ llegaEnDias: 0 }]).estado], ['2 llegan hoy', 'verde']);
  assert.deepEqual([hoyB([{ llegaEnDias: -1 }]).estado, hoyB([{ llegaEnDias: -1 }]).motivo, hoyB([{ llegaEnDias: -4 }]).estado], ['ambar', '1 barco esperando muelle', 'rojo']);
  assert.equal(hoyB([{ llegaEnDias: -1 }, { llegaEnDias: -2 }, { llegaEnDias: 0 }]).motivo, '2 barcos esperando muelle');
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
  { const fin = (venta) => cuotaRitmo({ hoyIso: '2026-10-31', cuotas: new Map([['a', { venta, cuota: 1000 }]]) }, ['a']); // ritmo 100 %
    assert.equal(fin(996).pct, 100); assert.equal(fin(996).tono, 'ambar', '99.6 % no es verde aunque redondee a 100');
    assert.equal(fin(796).pct, 80); assert.equal(fin(796).tono, 'rojo', '79.6 % es rojo aunque redondee a 80'); assert.equal(fin(1000).tono, 'verde'); assert.equal(fin(800).tono, 'ambar'); }
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

test('eventosCalendario/camionesTemporada: la última semana de diciembre es «cierre de año»', () => {
  const ev = (d) => eventosCalendario(d).find((e) => e.id === 'cierre')?.texto;
  assert.equal(ev(new Date(2026, 11, 31)), 'Hoy cierra el año'); assert.equal(ev(new Date(2026, 11, 30)), 'Mañana cierra el año');
  assert.equal(ev(new Date(2026, 11, 27)), 'Cierre de año en 4 días'); assert.equal(ev(new Date(2026, 11, 20)), undefined);
  assert.equal(ev(new Date(2026, 10, 30)), 'Hoy cierra el mes');
  const cam = [{ folio: 7, fecha: '2026-12-28' }, { folio: 8, fecha: '2026-12-20' }];
  assert.deepEqual([...camionesTemporada({ camiones: cam }, new Date(2026, 11, 29))].map(([f, e]) => [f, e.texto]), [[7, 'Cierre de año']]);
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
  assert.equal(rebote(NaN).fin, true); assert.equal(rebote(-.1).fin, false); assert.equal(rebote(Infinity).fin, true); // 4.7.60
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
  assert.deepEqual(gestoDosDedos(p(5, 5, 5, 5), p(0, 0, 10, 0)), { escala: 1, giro: 0 }); // 4.12.58: empezar encimados no brinca el zoom
  assert.deepEqual(gestoDosDedos(p(0, 0, 100, 0), p(3, 3, 3.5, 3)), { escala: 1, giro: 0 }); // juntarlos (< 1 px) tampoco
  assert.equal(gestoDosDedos(p(0, 0, 1, 0), p(0, 0, 2, 0)).escala, .5); // 1 px ya cuenta
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

test('nombreCiudad: abreviaturas del ERP completas (4.12.83)', () => {
  assert.equal(nombreCiudad('CD. JUAREZ'), 'Ciudad Juárez'); assert.equal(nombreCiudad('CD JUAREZ'), 'Ciudad Juárez');
  assert.equal(nombreCiudad('Cd.Obregón'), 'Ciudad Obregón'); assert.equal(nombreCiudad('GRAL. ESCOBEDO'), 'General Escobedo');
  assert.equal(nombreCiudad('STA. CATARINA'), 'Santa Catarina'); assert.equal(nombreCiudad('SN PEDRO GARZA GARCIA'), 'San Pedro Garza García');
  assert.equal(nombreCiudad('CD. DE MEXICO'), 'CDMX'); assert.equal(nombreCiudad('CDMX'), 'CDMX');
  assert.equal(nombreCiudad('VILLA DE STO. DOMINGO'), 'Villa de Santo Domingo'); assert.equal(nombreCiudad('STAR CITY'), 'Star City');
});

test('nombreCiudad / nombreSucursal: municipios con acento o eñe (4.12.71)', () => {
  assert.equal(nombreCiudad('TLAJOMULCO DE ZUÑIGA'), 'Tlajomulco de Zúñiga'); assert.equal(nombreCiudad('TLAJOMULCO DE ZUNIGA'), 'Tlajomulco de Zúñiga');
  assert.equal(nombreCiudad('CIUDAD GUZMAN'), 'Ciudad Guzmán'); assert.equal(nombreCiudad('CIUDAD LOPEZ MATEOS'), 'Ciudad López Mateos');
  assert.equal(nombreCiudad('CHIMALHUACAN'), 'Chimalhuacán'); assert.equal(nombreCiudad('JESUS MARIA'), 'Jesús María');
  assert.equal(nombreCiudad('BAHIA DE BANDERAS'), 'Bahía de Banderas'); assert.equal(nombreCiudad('CIENEGA DE FLORES'), 'Ciénega de Flores');
  assert.equal(nombreCiudad('Teotihuacán'), 'Teotihuacán'); assert.equal(nombreSucursal('PLAZA SANTA MARIA'), 'Plaza Santa María');
});
test('nombreCiudad / nombreSucursal: más acentos y eñes (4.12.51)', () => {
  assert.equal(nombreCiudad('SAN NICOLAS DE LOS GARZA'), 'San Nicolás de los Garza');
  assert.equal(nombreCiudad('SAN PEDRO GARZA GARCIA'), 'San Pedro Garza García');
  assert.equal(nombreCiudad('CIUDAD ACUÑA'), 'Ciudad Acuña'); assert.equal(nombreCiudad('CIUDAD ACUNA'), 'Ciudad Acuña');
  assert.equal(nombreCiudad('SAN JOSE DEL CABO'), 'San José del Cabo'); assert.equal(nombreCiudad('SAN JUAN DEL RIO'), 'San Juan del Río');
  assert.equal(nombreCiudad('GOMEZ PALACIO'), 'Gómez Palacio'); assert.equal(nombreCiudad('MICHOACAN'), 'Michoacán');
  assert.equal(nombreCiudad('Tepatitlán'), 'Tepatitlán'); assert.equal(nombreCiudad('LAGOS DE MORENO'), 'Lagos de Moreno');
  assert.equal(nombreSucursal('PLAZA RIO'), 'Plaza Río'); assert.equal(nombreSucursal('Galerías GDL'), 'Galerías GDL');
});
test('nombreCiudad: CDMX en sus formas y sin letras no es ciudad (4.12.2)', () => {
  for (const c of ['CDMX', 'cdmx', ' Cd. de México ', 'CD DE MEXICO', 'D.F.', 'DF']) assert.equal(nombreCiudad(c), 'CDMX', c);
  for (const c of ['123', '-', 5, ' . ', {}]) assert.equal(nombreCiudad(c), '', String(c));
  assert.equal(vaA({ cliente: 'Pcel', ciudad: 5 }), 'va a Pcel');
  assert.equal(nombreCiudad('Cd. Juárez'), 'Ciudad Juárez'); // 4.12.83: no es CDMX y la abreviatura se completa
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
  assert.equal(cifraCorta(1e12), '1,000.0 B'); assert.equal(cifraCorta(1e15), '1,000,000.0 B'); assert.equal(pesosCorto(-2.5e12), '-$2,500.0 B'); assert.equal(cifraCorta(999.94e9), '999.9 B'); assert.equal(cifraCorta(1.24e9), '1.2 B'); assert.equal(cifraCorta(999.96e6), '1.0 B'); assert.equal(cifraCorta(999.9e6), '999.9 M');
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

test('fechaHoy: fecha imposible cae en ahora y lee los formatos de fechaIso (4.12.86)', () => {
  const dia = (x) => { const t = fechaHoy(x); return [t.getFullYear(), t.getMonth() + 1, t.getDate(), t.getHours()]; };
  for (const x of ['26/11/2026', '26 nov 2026', '20261126', ' 2026-11-26 ', '26-Nov-2026']) assert.deepEqual(dia(x), [2026, 11, 26, 12], x);
  const ahora = new Date();
  for (const x of ['2026-02-30', '2026-13-01', '2026-00-10', '   ']) {
    const t = fechaHoy(x);
    assert.ok(Math.abs(t - ahora) < 5000, `«${x}» → ahora`);
  }
  const conHora = fechaHoy('2026-11-26T10:30:00');
  assert.deepEqual([conHora.getDate(), conHora.getHours(), conHora.getMinutes()], [26, 10, 30], 'con hora se queda la hora');
  assert.equal(diaLocal('2026-02-30').iso, diaLocal().iso);
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
  // 4.12.57: entradas raras de sinNulos: no-objeto → {}, sólo quita null/undefined (0, '', false y NaN se quedan),
  // no toca listas anidadas ni muta el original (los datos crudos siguen para la barra de tiempo).
  for (const v of [null, undefined, 'x', 5, true]) assert.deepEqual(sinNulos(v), {}, String(v));
  { const crudo = { a: [null, 0, '', false, NaN, [null]] }, o = sinNulos(crudo);
    assert.equal(o.a.length, 5); assert.ok(Number.isNaN(o.a[3])); assert.deepEqual(o.a[4], [null]);
    assert.equal(crudo.a.length, 6); assert.notEqual(o.a, crudo.a); assert.notEqual(o, crudo); }
  // 4.7.79: una lista que llega como objeto/texto/número se toma vacía; reglasPagos (objeto) y marcasSku (Map) se respetan.
  for (const k of LISTAS_DATOS) for (const v of [{}, 'x', 5, { a: 1 }]) assert.doesNotThrow(() => construirModelo({ [k]: v }, new Date('2026-11-18T10:00:00')), `${k}=${JSON.stringify(v)}`);
  for (const k of LISTAS_DATOS) assert.doesNotThrow(() => construirModelo({ [k]: [{}, 'texto', 7] }, new Date('2026-11-18T10:00:00')), `${k} filas raras`);
  { const mp = new Map([['a', 'b']]), rp = { venceEn: 7 }, o = listasDatos({ cuentas: {}, envios: 'x', facturas: [null, 1], reglasPagos: rp, marcasSku: mp, clima: 'sol', cartera: null });
    assert.deepEqual(o.cuentas, []); assert.deepEqual(o.envios, []); assert.deepEqual(o.facturas, [1]);
    assert.equal(o.reglasPagos, rp); assert.equal(o.marcasSku, mp); assert.equal(o.clima, 'sol'); assert.equal(o.cartera, null); }
  assert.deepEqual(listasDatos(null), {});
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
  // 4.12.70: día/mes/año como en México y Sheets
  assert.equal(fechaIso('26/11/2026'), '2026-11-26'); assert.equal(fechaIso(' 5/1/2027 10:30 '), '2027-01-05', 'sin ceros y con hora');
  for (const x of ['31/02/2026', '26/13/2026', '26/11/2026x']) assert.equal(fechaIso(x), null, x);
  // 4.12.73: día/mes/año con guiones o puntos
  assert.equal(fechaIso('26-11-2026'), '2026-11-26'); assert.equal(fechaIso(' 5.1.2027 08:00 '), '2027-01-05', 'puntos y hora');
  for (const x of ['26-11/2026', '31-02-2026', '26.13.2026', '26-11-2026x']) assert.equal(fechaIso(x), null, x);
  // 4.12.123: pesos con «M.N.» / «MN» / «MX$»; USD y la unidad sola siguen fuera
  for (const x of ['$1,200.00 M.N.', '1,200 MN', '$1,200 m.n.', 'MX$1,200', '1,200 pesos M.N.', 'M.N. 1,200', '1,200 MXN M.N.', ' $ 1,200 mn ']) assert.equal(numero(x), 1200, x);
  assert.equal(numero('$(1,200) M.N.'), -1200, 'negativo contable');
  for (const x of ['M.N.', 'MN', 'USD 1,200', 'mx 1200', '1,200 mnx']) assert.equal(numero(x), 0, x);
  // 4.12.130: año de dos dígitos (Excel/Sheets en México) = 20AA; fecha imposible, 3 dígitos o 1 dígito siguen null
  for (const x of ['26/11/26', '26-11-26', '26.11.26', '26-nov-26', '26 nov 26', '26 de noviembre de 26', ' 26/11/26 10:30 ']) assert.equal(fechaIso(x), '2026-11-26', x);
  assert.equal(fechaIso('5/1/27'), '2027-01-05', 'sin ceros');
  for (const x of ['31/02/26', '26/13/26', '26/11/262', '26/11/6', '26-11/26', '26 nov 10:30', '26 xyz 26']) assert.equal(fechaIso(x), null, x);
  // 4.12.131: mes/día de EE. UU. con diagonal sólo si el día pasa de 12; lo ambiguo sigue día/mes
  for (const x of ['11/26/2026', '11/26/26', ' 11/26/2026 10:30 ', '11/26/2026T10:30']) assert.equal(fechaIso(x), '2026-11-26', x);
  assert.equal(fechaIso('1/31/27'), '2027-01-31', 'sin ceros'); assert.equal(fechaIso('5/1/2026'), '2026-01-05', 'ambigua = día/mes');
  assert.equal(fechaIso('12/13/2026'), '2026-12-13', 'mes 12');
  for (const x of ['2/30/2026', '13/26/2026', '11-26-2026', '11.26.2026', '0/26/2026', '11/32/2026']) assert.equal(fechaIso(x), null, x);
  // 4.12.122: «del» antes del año, coma tras el mes y mes primero en español
  for (const x of ['26 de noviembre del 2026', '26 de Noviembre, 2026', 'noviembre 26 de 2026', 'Nov 26 del 2026', ' 26 DE NOVIEMBRE DEL 2026 10:30 ']) assert.equal(fechaIso(x), '2026-11-26', x);
  for (const x of ['31 de febrero del 2026', '26 de nada del 2026', 'noviembre 26 dela 2026', '26 del noviembre 2026']) assert.equal(fechaIso(x), null, x);
  assert.equal(fechaCorta('26/11/2026', new Date(2026, 10, 26)), '26 nov', 'tarjetas');
  // 4.12.72: año primero sin ceros o con diagonales
  // 4.12.74: mes en letra (español o inglés, abreviado o completo, con «de»).
  assert.equal(fechaIso('26 nov 2026'), '2026-11-26'); assert.equal(fechaIso('26-Nov-2026'), '2026-11-26'); assert.equal(fechaIso(' 5 de enero de 2027 '), '2027-01-05');
  assert.equal(fechaIso('3/Ago/2026 10:30'), '2026-08-03'); assert.equal(fechaIso('1 Sept. 2026'), '2026-09-01'); assert.equal(fechaIso('15 march 2026'), '2026-03-15');
  assert.equal(fechaIso('9 DIC 2026'), '2026-12-09'); assert.equal(fechaIso('2 may 2026'), '2026-05-02'); assert.equal(fechaIso('30 Septiembre 2026'), '2026-09-30');
  for (const x of ['31 feb 2026', '26 xyz 2026', '26 no 2026', '26 nov 2026x', 'nov 2026']) assert.equal(fechaIso(x), null, x);
  assert.equal(fechaIso('2026-1-5'), '2026-01-05'); assert.equal(fechaIso(' 2026/01/05 10:30 '), '2026-01-05', 'diagonales y hora');
  assert.equal(fechaIso('2026/11/26'), '2026-11-26'); assert.equal(fechaIso('2026-01-05T08:00:00'), '2026-01-05', 'ISO normal igual');
  for (const x of ['2026/02/30', '2026-13-1', '2026/1-5', '2026/01/05x', '2026-1-5-']) assert.equal(fechaIso(x), null, x);
  assert.equal(fechaCorta('2026/11/26', new Date(2026, 10, 26)), '26 nov', 'tarjetas con diagonales');
  // 4.12.136: año primero con puntos.
  assert.equal(fechaIso('2026.11.26'), '2026-11-26'); assert.equal(fechaIso(' 2026.1.5 10:30 '), '2026-01-05', 'puntos y hora');
  for (const x of ['2026.02.30', '2026.13.1', '2026.1-5', '2026/1.5', '2026.11.26x']) assert.equal(fechaIso(x), null, x);
  // 4.12.138: año primero con el mes en letra.
  for (const x of ['2026-Nov-26', '2026/nov/26', '2026 noviembre 26', ' 2026-NOV-26 10:30 ', '2026.nov.26', '2026-Nov.-26']) assert.equal(fechaIso(x), '2026-11-26', x);
  // 4.12.140: hora pegada al año con dos puntos (logs Apache/Nginx/CDN)
  for (const x of ['26/Nov/2026:10:30:00 -0600', '26/nov/2026:04:05', '26-Nov-2026:10:30:00 +0000']) assert.equal(fechaIso(x), '2026-11-26', x);
  for (const x of ['26/Nov/2026:', '26/Nov/2026:xx', '26/Nov/2026:10', '31/Feb/2026:10:30:00']) assert.equal(fechaIso(x), null, x);
  assert.equal(fechaIso('2027-ene-5'), '2027-01-05');
  for (const x of ['2026-feb-31', '2026-xyz-26', '2026-no-26', '2026-nov-26x', '2026-nov', '2026-nov-123']) assert.equal(fechaIso(x), null, x);
  // 4.12.77: mes primero, al estilo inglés.
  assert.equal(fechaIso('Nov 26, 2026'), '2026-11-26'); assert.equal(fechaIso(' November 5 2027 '), '2027-11-05'); assert.equal(fechaIso('nov. 26, 2026 10:30'), '2026-11-26', 'con hora');
  assert.equal(fechaIso('Sept 1, 2026'), '2026-09-01'); assert.equal(fechaIso('DIC 9 2026'), '2026-12-09'); assert.equal(fechaIso('may 2, 2026'), '2026-05-02');
  for (const x of ['feb 31, 2026', 'xyz 26, 2026', 'no 26, 2026', 'nov 26, 26', 'nov 26, 2026x', 'nov, 2026', 'nov 2026']) assert.equal(fechaIso(x), null, x);
  assert.equal(fechaCorta('Nov 26, 2026', new Date(2026, 10, 26)), '26 nov', 'tarjetas con mes primero');
  // 4.12.78: con el día de la semana adelante.
  assert.equal(fechaIso('Thu Nov 26 2026 03:54:17 GMT-0600 (hora estándar central)'), '2026-11-26', 'Date.toString()');
  assert.equal(fechaIso('Thu, 26 Nov 2026 10:30:00 GMT'), '2026-11-26', 'correo'); assert.equal(fechaIso('jue 26 nov 2026'), '2026-11-26');
  assert.equal(fechaIso('Miércoles, 5 de enero de 2027'), '2027-01-05'); assert.equal(fechaIso('vie. 27/11/2026'), '2026-11-27'); assert.equal(fechaIso('Sat 2026-11-28'), '2026-11-28');
  assert.equal(fechaIso('mar 26, 2026'), '2026-03-26', 'mar = marzo, no martes'); assert.equal(fechaIso('mar 24 nov 2026'), '2026-11-24', 'mar = martes');
  for (const x of ['jue', 'jue 31 feb 2026', 'Thu, 2026', 'jue hoy', 'xyz 26 nov 2026', 'ju 26 nov 2026']) assert.equal(fechaIso(x), null, x);
  // 4.12.76: compacta AAAAMMDD (SAP y otros ERP), sólo en texto.
  assert.equal(fechaIso('20261126'), '2026-11-26'); assert.equal(fechaIso(' 20270105 10:30 '), '2027-01-05', 'con hora'); assert.equal(fechaIso('20261126T083000'), '2026-11-26', 'con T');
  for (const x of ['Nov 26th, 2026', '26th Nov 2026', 'Thu, Nov 26th 2026', '26TH-NOV-2026', 'noviembre 26vo de 2026'.replace('vo', 'º')]) assert.equal(fechaIso(x), '2026-11-26', x);
  for (const x of ['1º de enero de 2027', '1ro de enero de 2027', '1er de enero de 2027', '1° de enero de 2027', '1st/Jan/2027', 'Jan 1st 2027']) assert.equal(fechaIso(x), '2027-01-01', x);
  for (const x of ['31st feb 2026', '26th', '2026th', 'nov 26th', '26xx nov 2026']) assert.equal(fechaIso(x), null, x);
  for (const x of ['20260230', '20261326', '2026112', '202611260', '18001126', '20261126x', '20261126 x', 20261126]) assert.equal(fechaIso(x), null, String(x));
  assert.equal(fechaCorta('20261126', new Date(2026, 10, 26)), '26 nov', 'tarjetas con fecha compacta');
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
  const m2 = construirModelo({ ...d, envios: [{ fecha_envio_erp: 'pendiente', fecha_surtida: '2026-10-03', fecha_entrega_erp: '  ', guia_rastreo: 'G-SURT', oc_clientes: { cliente_key: 'pcel' } }, { fecha_surtida: '2026-10-03', fecha_entregada: '2026-10-04', guia_rastreo: 'G-ENT', oc_clientes: { cliente_key: 'pcel' } }] }, hoy);
  const gs = m2.camiones.find((c) => c.folio === 'guía G-SURT');
  assert.ok(gs && gs.fecha === '2026-10-03' && Number.isFinite(gs.progreso), 'envío ERP ilegible usa la surtida; entrega en blanco no es entregado');
  assert.ok(!m2.camiones.some((c) => c.folio === 'guía G-ENT'), 'entregado no sale');
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
  // 4.7.73: objetos, listas, booleanos y números no finitos no se cuelan como «[object Object]» / «TRUE»
  assert.equal(listaCorta([{}, 'PO-1', true, NaN, ['x'], 7]), 'PO-1, 7'); assert.equal(listaCorta([{ po: 'PO-1' }]), '');
  assert.equal(norm({}), ''); assert.equal(norm(['leon']), ''); assert.equal(norm(true), ''); assert.equal(norm(Infinity), ''); assert.equal(norm(' león '), 'LEON'); assert.equal(norm(10), '10');
  assert.equal(nombreCiudad({}), ''); assert.equal(nombreCiudad(['LEON']), ''); assert.equal(pinCiudad({ ciudad: {} }).nombre, '');
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
  for (const n of [-0.4, 255.7, ' 12.5 ', 0.5]) assert.equal(hexCss(n), '#8e8e93', `hexCss(${n}) decimal gris (4.7.78)`);
  assert.equal(hexCss(' 255 '), '#0000ff'); assert.equal(hexCss(-0), '#000000');
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
test('Pulido: cuota por cuenta como Análisis (4.7.85)', () => {
  // cliente 11 con cuota 0 (o negativa): su venta ya no infla el % de la cuenta; renglón sin cliente ERP no suma cuota
  const q = cuotasPorCuenta([{ cliente_erp: 10, cuenta_sellout: 'a', cuota_venta: 100 }, { cliente_erp: 11, cuenta_sellout: 'a', cuota_venta: 0 }, { cliente_erp: 12, cuenta_sellout: 'a', cuota_venta: -5 }, { cliente_erp: null, cuenta_sellout: 'a', cuota_venta: 70 }, { cliente_erp: 20, cuenta_sellout: 'b', cuota_venta: 0 }],
    [{ cliente: 10, fact_neta: 50 }, { cliente: 11, fact_neta: 900 }, { cliente: 12, fact_neta: 40 }, { cliente: 20, fact_neta: 10 }]);
  assert.deepEqual(q.get('a'), { venta: 50, cuota: 100 }); assert.deepEqual(q.get('b'), { venta: 0, cuota: 0 });
  assert.equal(cuotaRitmo({ hoyIso: '2026-11-15', cuotas: q }, ['a', 'b']).pct, 50); assert.equal(cuotaRitmo({ cuotas: q }, ['b']), null);
  // el mismo cliente en dos renglones: la cuota se suma antes de decidir (-10 + 30 = 20 > 0 → su venta cuenta)
  assert.deepEqual(cuotasPorCuenta([{ cliente_erp: 1, cuenta_sellout: 'a', cuota_venta: -10 }, { cliente_erp: ' 1 ', cuenta_sellout: 'a', cuota_venta: 30 }], [{ cliente: 1, fact_neta: 5 }]).get('a'), { venta: 5, cuota: 20 });
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
  assert.deepEqual(resumenBanco([], [{ estado: 'autorizado', monto: 3 }], hoyIso, rotas), { saldo: 0, pctVencido: null, dso: null, mas90: 0, carteraVencida: 0, cuentasVencidas: 0, pagosSemana: 0, montoSemana: 0, pagosVencidos: 1, montoVencido: 3 }, 'una regla que lanza no tira el banco');
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
  assert.equal(plural('1,200', 'pedido'), '1,200 pedidos'); assert.equal(plural(' 1 ', 'barco'), '1 barco'); assert.equal(plural(true, 'barco'), '0 barcos'); assert.equal(plural('  ', 'día'), '0 días'); assert.equal(plural(Infinity, 'día'), '0 días'); assert.equal(plural(null, 'PO'), '0 POs');
  assert.equal(plural(1500, 'pieza'), '1,500 piezas'); assert.equal(plural(3, 'mes', 'meses'), '3 meses');
  // 4.12.121: plural en español sin `varios` (antes «2 mess», «2 camións», «2 lápizs», «2 pzs»)
  for (const [u, v] of [['mes', 'meses'], ['camión', 'camiones'], ['andén', 'andenes'], ['lápiz', 'lápices'], ['reloj', 'relojes'], ['vendedor', 'vendedores'], ['autobús', 'autobuses'], ['país', 'países'], ['lunes', 'lunes'], ['SKU', 'SKUs'], ['pz', 'pz'], ['día', 'días'], ['propuesta abierta', 'propuestas abiertas'], ['pedido de cliente detenido', 'pedidos de cliente detenidos'], ['recién llegado', 'recién llegados']]) assert.equal(pluralEs(u), v, u);
  for (const [u, v] of [['rack', 'racks'], ['ticket', 'tickets'], ['chat', 'chats'], ['robot', 'robots'], ['clic', 'clics'], ['bloc', 'blocs'], ['tráiler', 'tráileres'], ['red', 'redes'], ['rey', 'reyes'], ['sándwich', 'sándwiches'], ['rack de piso', 'racks de piso']]) assert.equal(pluralEs(u), v, `4.12.134 ${u}`);
  assert.equal(pluralEs(null), ''); assert.equal(pluralEs('  '), ''); assert.equal(plural(2, 'mes'), '2 meses'); assert.equal(plural(1, 'camión'), '1 camión'); assert.equal(plural(3, 'reunión', 'juntas'), '3 juntas', 'varios manda');
  // 4.12.65: panel «En la ciudad»: «1 de 1 tienda activa» (antes «1 tienda activas»).
  assert.equal(plural(1, 'tienda activa', 'tiendas activas'), '1 tienda activa'); assert.equal(plural(1200, 'tienda activa', 'tiendas activas'), '1,200 tiendas activas');
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
  assert.equal(v.tramos.find((x) => x.clave === 'puerto').volumen, 'Sin movimiento'); assert.match(v.tramos.find((x) => x.clave === 'cedis').volumen, /^1,500 pz ·/);
});

test('enMinutos(): «empieza ya» en 0, minutos y horas; ilegible o negativa vacía; misión y burbuja de reunión', () => {
  assert.equal(enMinutos(0), 'empieza ya'); assert.equal(enMinutos(5), 'en 5 min'); assert.equal(enMinutos('12'), 'en 12 min');
  assert.equal(enMinutos(60), 'en 1 h'); assert.equal(enMinutos(65), 'en 1 h 5 min'); assert.equal(enMinutos(0.4), 'empieza ya');
  assert.equal(enMinutos('2 días'), 'en 2 d'); assert.equal(enMinutos('1 d'), 'en 1 d'); assert.equal(enMinutos('1.5 dias'), 'en 2 d'); assert.equal(enMinutos('2 semanas'), 'en 14 d'); assert.equal(enMinutos('1 sem.'), 'en 7 d'); assert.equal(enMinutos('3 dientes'), '');
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
  // 4.12.104: semanas = ×7
  assert.equal(llegaBarco('2 semanas'), 'llega en 14 d'); assert.equal(llegaBarco('1 sem'), 'llega en 7 d'); assert.equal(llegaBarco('-1 semana'), '7 d tarde'); assert.equal(llegaBarco('12 semanas'), 'llega en 3 meses');
  assert.equal(haceDias('1,5 semanas'), 'hace 11 d'); assert.equal(faltanDias('3 semanas'), 'en 21 d'); assert.equal(llegaBarco('semanas'), 'sin ETA');
  // 4.12.110: meses (× 30.4) y años (× 365)
  assert.equal(haceDias('2 meses'), 'hace 2 meses'); assert.equal(faltanDias('1 año'), 'en 1 año'); assert.equal(haceDias('1 mes'), 'hace 30 d');
  assert.equal(faltanDias('1,5 años'), 'en 1 año'); assert.equal(haceDias('3 AÑOS'), 'hace 3 años'); assert.equal(llegaBarco('2 meses'), 'llega en 2 meses');
  assert.equal(haceDias('meses'), ''); assert.equal(faltanDias('-1 mes'), 'hoy');
  assert.deepEqual(rumboBarcos([{ llegaEnDias: '1 semana' }, { llegaEnDias: '0 sem' }]).map((x) => x.modo), ['llegando', 'atracado']);
  assert.equal(llegaBarco(1200), 'llega en 3 años'); assert.equal(llegaBarco('1,200'), 'llega en 3 años'); assert.equal(llegaBarco(-1500), '4 años tarde'); assert.equal(llegaBarco(true), 'sin ETA');
  assert.equal(enMinutos(60 * 1200), 'en 50 d'); assert.equal(enMinutos('1,500'), 'en 1 d'); assert.equal(enMinutos(true), '');
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
  const ce = tarjetaDe({ tipo: 'cedis' }, m); assert.deepEqual(ce.numeros[1], ['Días de inventario', '95']); assert.deepEqual(ce.numeros[2], ['Piezas', '1,200']); assert.equal(ce.estado, 'verde');
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
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F1' }, m).numeros[3][1], `${fechaCorta('2026-10-07')} · hace 2 d`);
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F2' }, m).numeros[3][1], '—');
  const v = tarjetaDe({ tipo: 'vendedorErp', titulo: 'Ana' }, m); assert.equal(v.numeros[3][1], 'B'); assert.equal(v.estado, 'verde');
  assert.equal(tarjetaDe({ tipo: 'ciudad', ciudad: 'GDL' }, m).numeros[0][1], '1 de 1');
});

test('porcentaje(): miles es-MX, signo opcional y «—» con lo ilegible; capa de ventas y pensamientos lo usan', () => {
  assert.equal(porcentaje(45), '45 %'); assert.equal(porcentaje(1250), '1,250 %'); assert.equal(porcentaje(12.6), '13 %');
  assert.equal(porcentaje(-0.4), '0 %'); assert.equal(porcentaje(-25), '-25 %'); assert.equal(porcentaje('80'), '80 %');
  assert.equal(porcentaje(30, { signo: true }), '+30 %'); assert.equal(porcentaje(0, { signo: true }), '0 %'); assert.equal(porcentaje(-5, { signo: true }), '-5 %');
  for (const x of [null, undefined, '', NaN, 'abc', Infinity, true, {}]) assert.equal(porcentaje(x), '—');
  assert.equal(porcentaje('1,250'), '1,250 %'); assert.equal(porcentaje(' 45 % '), '45 %'); assert.equal(porcentaje('+30', { signo: true }), '+30 %'); assert.equal(porcentaje('  '), '—');
  const m = { distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', importe: 2350, previo: 100 }] }] };
  assert.match(capaCiudades(m, 'ventas').porCiudad.get('GDL').texto, /\+2,250 % vs mes anterior$/);
});

test('dsoTexto(): días redondeados en singular/plural y nada con 0 o ilegible', () => {
  assert.equal(dsoTexto(45.678), 'DSO 46 días'); assert.equal(dsoTexto(1), 'DSO 1 día'); assert.equal(dsoTexto('1,200'), 'DSO 1,200 días');
  assert.equal(dsoTexto(' 30 '), 'DSO 30 días'); assert.equal(dsoTexto(0.6), 'DSO 1 día');
  for (const x of [0, 0.4, -5, null, undefined, '', NaN, 'abc', Infinity, true, {}]) assert.equal(dsoTexto(x), '');
});
test('pendientesTexto(): singular/plural con miles es-MX; nulo o ilegible cuenta 0', () => {
  assert.equal(pendientesTexto(1, 1), '1 pendiente hoy · 1 hecha'); assert.equal(pendientesTexto(3, 0), '3 pendientes hoy · 0 hechas');
  assert.equal(pendientesTexto('1,200', 2), '1,200 pendientes hoy · 2 hechas');
  assert.equal(pendientesTexto(-3, -2), '0 pendientes hoy · 0 hechas'); assert.equal(pendientesTexto(Infinity, '-1'), '0 pendientes hoy · 0 hechas');
  assert.equal(pendientesTexto(undefined, null), '0 pendientes hoy · 0 hechas'); assert.equal(pendientesTexto('abc', NaN), '0 pendientes hoy · 0 hechas');
});
test('temperaturaTexto(): grados redondeados, 0 y negativos valen; sin dato → vacío', () => {
  assert.equal(temperaturaTexto(23.6), '24°'); assert.equal(temperaturaTexto(' 18 '), '18°'); assert.equal(temperaturaTexto(-2.6), '-3°');
  assert.equal(temperaturaTexto(0), '0°'); assert.equal(temperaturaTexto(-0.2), '0°');
  for (const x of [null, undefined, '', '  ', NaN, 'abc', Infinity, true, {}]) assert.equal(temperaturaTexto(x), '');
  // 4.12.108: escala en texto con «º» ordinal, sin signo o en palabra; Fahrenheit se pasa a Celsius.
  for (const x of ['24 C', '24ºC', '24 °c', '24 grados', '24 grados C', '24 celsius', '24˚']) assert.equal(temperaturaTexto(x), '24°', x);
  for (const x of ['75°F', '75 F', '75 ºF', '75 grados F', '75 fahrenheit']) assert.equal(temperaturaTexto(x), '24°', x);
  assert.equal(temperaturaTexto('32 °f'), '0°'); assert.equal(temperaturaTexto('14 °F'), '-10°');
  for (const x of ['F', '°C', 'grados', 'C 24x']) assert.equal(temperaturaTexto(x), '', x);
});
test('piezasTexto(): piezas enteras con miles es-MX y texto con comas; ilegible → 0 pz', () => {
  assert.equal(piezasTexto(1200.5), '1,201 pz'); assert.equal(piezasTexto('1,200'), '1,200 pz'); assert.equal(piezasTexto(' 95 '), '95 pz');
  assert.equal(piezasTexto(1), '1 pz'); assert.equal(piezasTexto(3400000), '3,400,000 pz');
  for (const x of [null, undefined, '', NaN, 'abc', Infinity, {}]) assert.equal(piezasTexto(x), '0 pz');
});
test('haceDias(): hoy/ayer/hace N d con miles es-MX y redondeo; ilegible → vacío', () => {
  assert.equal(haceDias(0), 'hoy'); assert.equal(haceDias(-3), 'hoy'); assert.equal(haceDias(1), 'ayer'); assert.equal(haceDias(0.6), 'ayer');
  assert.equal(haceDias(2.6), 'hace 3 d'); assert.equal(haceDias(1200), 'hace 3 años'); assert.equal(haceDias(' 5 '), 'hace 5 d');
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
  assert.equal(cob(-0.4), '0 d', '4.7.58 sin -0'); assert.equal(cob('-0.3'), '0 d'); assert.equal(cob(-5), null, 'negativa sin días'); assert.equal(cob(-0.6), null);
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
  assert.equal(nombrePersona({ nombre: null, email: 'ana.lopez@x.com' }), 'Ana Lopez');
  assert.equal(nombrePersona({ nombre: '', email: ' JUAN_perez-ruiz@x.com ' }), 'Juan Perez Ruiz');
  assert.equal(nombrePersona({ email: 'maría+ventas@x.com' }), 'María Ventas');
  assert.equal(nombrePersona({ email: '123.@x.com' }), 'Persona');
  assert.equal(nombrePersona({ email: 'ana2@x.com' }), 'Ana2');
  assert.equal(nombrePersona({ nombre: '  ', email: ' ' }), 'Persona');
  assert.equal(nombrePersona(null), 'Persona');
  assert.equal(nombrePersona({ nombre: "ANA-MARÍA O'NEIL DE LA CRUZ" }), "Ana-María O'Neil de la Cruz");
  assert.equal(nombrePersona({ nombre: 'josé-luis pérez' }), 'José-Luis Pérez');
  assert.equal(nombrePersona({ nombre: 'Ana-maría McGregor' }), 'Ana-maría McGregor');
  // 4.12.34: todo en mayúsculas o minúsculas sale legible; mezcla se respeta.
  assert.equal(nombrePersona({ nombre: 'ANA LÓPEZ DE LA CRUZ' }), 'Ana López de la Cruz');
  assert.equal(nombrePersona({ nombre: ' juan   pérez ' }), 'Juan Pérez');
  assert.equal(nombrePersona({ nombre: 'DE LA ROSA' }), 'De la Rosa');
  assert.equal(nombrePersona({ nombre: 'Ana McGregor' }), 'Ana McGregor');
  assert.equal(nombrePersona({ nombre: '123' }), '123');
  const m = construirModelo({ perfiles: [{ user_id: 'u1', activo: true, nombre: null, email: null, puesto: null, rol: ' finanzas ' }] }, new Date(2026, 10, 20, 10));
  const per = m.oficina.personas[0];
  assert.equal(per.nombre, 'Persona');
  assert.equal(per.puesto, 'finanzas');
  assert.equal(per.rol, 'direccion');
});

test('nombreTienda(): sin sucursal o sin nombre de cuenta ya no dice «null» y la tarjeta la encuentra', () => {
  assert.equal(nombreTienda({ nombreCuenta: 'Pcel', cuenta: '10', sucursal: ' Centro ' }), 'Pcel · Centro');
  assert.equal(nombreTienda({ nombreCuenta: null, cuenta: '10', sucursal: 'Centro' }), '10 · Centro');
  assert.equal(nombreTienda({ nombreCuenta: '  ', cuenta: '10', sucursal: null }), '10');
  assert.equal(nombreTienda({}), 'Tienda');
  assert.equal(nombreTienda(null), 'Tienda');
  const m = { distritos: [{ ciudad: 'GUADALAJARA', tiendas: [{ cuenta: '10', nombreCuenta: 'Pcel', sucursal: null, importe: 5000, previo: 1000 }] }] };
  const t = tarjetaDe({ tipo: 'tienda', titulo: 'Pcel', cuenta: '10', ciudad: 'GUADALAJARA' }, m);
  assert.equal(t.numeros[0][0], 'Este mes');
});

test('leyendaCuentas(): una entrada por cuenta, sin «null» ni nombres partidos', () => {
  const ds = [null, { tiendas: [{ cuenta: '10', nombreCuenta: 'Pcel' }, { cuenta: ' 10 ', nombreCuenta: ' Pcel ' }, null, { cuenta: null, nombreCuenta: 'X' }] },
    { tiendas: [{ cuenta: '20', nombreCuenta: 'A|B' }, { cuenta: 30, nombreCuenta: null }] }, { tiendas: 'basura' }];
  assert.deepEqual(leyendaCuentas(ds), [{ cuenta: '10', nombre: 'Pcel' }, { cuenta: '20', nombre: 'A|B' }, { cuenta: '30', nombre: '30' }]);
  assert.deepEqual(leyendaCuentas(null), []);
});
test('4.12.52 leyendaCuentas(): una sola entrada aunque la cuenta cambie de mayúsculas y toma el nombre que sí venga', () => {
  const ds = [{ tiendas: [{ cuenta: 'PCEL', nombreCuenta: null }, { cuenta: ' pcel ', nombreCuenta: 'Pcel' }, { cuenta: 'Pcel', nombreCuenta: 'Otro' }] },
    { tiendas: [{ cuenta: 'CT', nombreCuenta: 'CT Internacional' }, { cuenta: 'ct', nombreCuenta: null }] }];
  assert.deepEqual(leyendaCuentas(ds), [{ cuenta: 'PCEL', nombre: 'Pcel' }, { cuenta: 'CT', nombre: 'CT Internacional' }]);
});

test('tarjeta del camión: destino con acentos y sin «null» (4.7.41)', () => {
  const m = { hoyIso: '2026-10-08', camiones: [{ folio: 'E1', envio: true, cliente: ' null ', paqueteria: '  ', ciudad: 'SAN LUIS POTOSI', fecha: '2026-10-07' }, { folio: 'F1', cliente: ' CT ', monto: 1000, piezas: 3, fecha: '2026-10-07', ciudad: null }] };
  const e = tarjetaDe({ tipo: 'camion', folio: 'E1' }, m);
  assert.deepEqual(e.numeros.map(([, v]) => v).filter((v, i) => i !== 2), ['—', '—', 'San Luis Potosí']);
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F1' }, m).numeros[0][1], 'CT');
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'E1' }, { ...m, camiones: [{ ...m.camiones[0], ciudad: '' }] }).numeros[3][1], '—');
  const b = tarjetaDe({ tipo: 'barco', barco: { piezas: 1, estatus: '  ' } }, m); assert.equal(b.numeros.length, 3);
  assert.deepEqual(tarjetaDe({ tipo: 'barco', barco: { piezas: 1, estatus: ' EN TRANSITO ' } }, m).numeros[3], ['Estatus', 'En tránsito']);
});

test('fechaCorta() y tarjetas del contenedor con fecha corta (4.7.42)', () => {
  const nov = fechaCorta('2026-11-23'); assert.match(nov, /^23 nov/); assert.ok(!nov.endsWith('.'));
  assert.equal(fechaCorta(' 2026-11-23 '), nov); assert.equal(fechaCorta(new Date(2026, 10, 23, 9)), nov);
  for (const x of [null, '', 'pendiente', '2026-99-99', 5, {}]) assert.equal(fechaCorta(x), '');
  const b = tarjetaDe({ tipo: 'barco', barco: { piezas: 1, eta: '2026-11-23', arribo: 'pendiente' } }, {});
  assert.deepEqual(b.numeros.slice(1, 3), [['ETA puerto', nov], ['Llega a CEDIS', '—']]);
  const m = { puerto: { barcos: [{ id: 'C1', supplier: '  ', eta: '2026-11-23', llegaEnDias: 1, piezas: 1 }], tarimas: [] } };
  const c = tarjetaDe({ tipo: 'barco', id: 'C1' }, m); assert.equal(c.numeros[0][1], '—'); assert.match(c.numeros[1][1], /^23 nov · /);
});

test('Tarjeta del camión: «Salió» con fecha corta (4.7.43)', () => {
  const m = { hoyIso: '2026-10-07', camiones: [{ folio: 'F1', fecha: '2026-10-06', cliente: 'A', monto: 1, piezas: 1 }, { folio: 'F2', fecha: 'pendiente', cliente: 'A' }] };
  const a = tarjetaDe({ tipo: 'camion', folio: 'F1' }, m).numeros.find((x) => x[0] === 'Salió')[1];
  assert.match(a, /^6 oct · ayer$/); assert.ok(!a.includes('2026'));
  assert.equal(tarjetaDe({ tipo: 'camion', folio: 'F2' }, m).numeros.find((x) => x[0] === 'Salió')[1], '—');
  { // 4.12.12: fecha futura → «Sale · mañana / en N d» (antes «Salió · hoy»)
    const mf = { hoyIso: '2026-10-07', camiones: [{ folio: 'F3', fecha: '2026-10-08', cliente: 'A' }, { folio: 'E1', envio: true, fecha: '2026-10-10', cliente: 'B' }, { folio: 'F4', fecha: '2026-10-07', cliente: 'A' }] };
    const r = (f) => tarjetaDe({ tipo: 'camion', folio: f }, mf).numeros.find((x) => x[0] === 'Sale' || x[0] === 'Salió');
    assert.deepEqual(r('F3'), ['Sale', '8 oct · mañana']); assert.deepEqual(r('E1'), ['Sale', '10 oct · en 3 d']); assert.deepEqual(r('F4'), ['Salió', '7 oct · hoy']);
    assert.equal(tarjetaDe({ tipo: 'camion', folio: 'E1' }, mf).estado, 'verde');
  }
});

test('Vendedores del ERP: se juntan por nombre normalizado (4.7.44)', () => {
  const hoy = new Date(2026, 9, 7, 12);
  const fila = (vendedor, fact) => ({ anio: 2026, mes: 10, vendedor, cliente_key: '1', cliente_nombre: 'Cliente', fact_neta: fact });
  const m = construirModelo({ vendedoresErp: [fila('JUAN PEREZ', 100), fila(' Juan  Perez ', 50), fila('   ', 999), fila(null, 999)] }, hoy);
  assert.equal(m.vendedoresRuta.length, 1); const v = m.vendedoresRuta[0];
  assert.equal(v.total, 150); assert.equal(v.totalMes, 150); assert.equal(v.clientes, 1); assert.equal(v.nombre, 'Juan Perez');
  const t = tarjetaDe({ tipo: 'vendedorErp', titulo: v.nombre }, m); assert.ok(t.numeros.length > 0);
});

test('Sucursales: se juntan por cuenta y nombre normalizado (4.7.47)', () => {
  const hoy = new Date(2026, 9, 20, 12);
  const fila = (cuenta, sucursal, importe) => ({ cuenta, anio: 2026, mes: 10, sucursal, importe, vendedores: 2 });
  const m = construirModelo({ sucursales: [fila('ct', 'HERMOSILLO', 100), fila(' ct ', ' hermosillo ', 50), fila('ct', 'Hermosillo  ', 25)] }, hoy);
  const her = m.distritos.find((x) => x.ciudad === 'HERMOSILLO'); assert.ok(her, 'Hermosillo existe');
  const ts = her.tiendas.filter((t) => t.cuenta === 'ct');
  assert.equal(ts.length, 1); assert.equal(ts[0].importe, 175); assert.equal(ts[0].sucursal, 'HERMOSILLO');
});

test('Vendedores de mayoristas: se juntan por cuenta y nombre normalizado (4.7.48)', () => {
  const hoy = new Date(2026, 9, 20, 12);
  const fila = (cuenta, vendedor, importe) => ({ cuenta, anio: 2026, mes: 10, vendedor, importe, sucursal: null });
  const m = construirModelo({ vendedoresMayoristas: [fila('ct', 'JUAN PEREZ', 100), fila(' ct ', ' juan  perez ', 50), fila('ct', null, 30), fila('ct', '   ', 20)] }, hoy);
  const vs = m.distritos.flatMap((x) => x.vendedores).filter((v) => v.cuenta === 'ct');
  assert.equal(vs.length, 1); assert.equal(vs[0].importe, 150); assert.equal(vs[0].nombreCompleto, 'JUAN PEREZ');
});

test('Cartera y clientes finales: la cuenta con espacios empata (4.7.49)', () => {
  const hoy = new Date(2026, 9, 20, 12);
  const m = construirModelo({
    cartera: [{ cliente: ' digitalife ', saldo_vencido: '5000', saldo_actual: 9000 }, { cliente: '  ', saldo_vencido: 1 }, { cliente: null, saldo_vencido: 2 }],
    clientesFinales: [{ cuenta: 'cva', anio: 2026, mes: 10, estado: 'JALISCO', importe: 10 }, { cuenta: ' cva ', anio: 2026, mes: 10, estado: 'JALISCO', importe: 5 }, { cuenta: '', anio: 2026, mes: 10, estado: 'JALISCO', importe: 1 }],
  }, hoy);
  assert.deepEqual(m.kpis.cartera.map((c) => c.cuenta), ['digitalife']); assert.equal(m.kpis.cartera[0].vencido, 5000);
  const gdl = m.distritos.find((x) => x.ciudad === 'GUADALAJARA');
  assert.equal(gdl.clientesFinales.n, 3); assert.deepEqual(gdl.clientesFinales.cuentas, ['cva'], '«vía 1 mayorista», no 2');
});

test('Cuentas sin sucursal: la cuenta con espacios empata sus ventas (4.7.50)', () => {
  const hoy = new Date(2026, 9, 20, 12);
  const m = construirModelo({
    cuentas: [{ cuenta: ' pcel ', nombre: 'PCEL', tiene_sellout: true }, { cuenta: ' ct ', nombre: 'CT', tiene_sellout: true }, { cuenta: '  ', tiene_sellout: true }, { cuenta: null, propio: true }],
    cuentaMes: [{ cuenta: 'pcel', anio: 2026, mes: 10, importe: 100 }, { cuenta: ' pcel ', anio: 2026, mes: 10, importe: '50' }],
    sucursales: [{ cuenta: 'ct', anio: 2026, mes: 10, sucursal: 'HERMOSILLO', importe: 10, vendedores: 1 }],
  }, hoy);
  const ts = m.distritos.flatMap((x) => x.tiendas);
  const pcel = ts.filter((t) => t.cuenta === 'pcel');
  assert.equal(pcel.length, 1); assert.equal(pcel[0].importe, 150); assert.equal(pcel[0].vendioMes, true); assert.equal(pcel[0].nombreCuenta, 'PCEL');
  assert.equal(ts.filter((t) => t.cuenta === 'ct' && t.sucursal === 'Matriz').length, 0, 'ct ya tiene sucursal: sin Matriz doble');
  assert.equal(ts.find((t) => t.cuenta === 'ct')?.nombreCuenta, 'CT');
  assert.equal(ts.filter((t) => !String(t.cuenta ?? '').trim()).length, 0, 'cuenta vacía se salta');
});
test('(4.7.51) clave ERP con espacios: facturas, envíos y destinos de vendedores empatan su cuenta', () => {
  const cuentasSp = d.cuentas.map((c) => (c.cuenta === 'ct' ? { ...c, cuenta: ' ct ', erp_cliente: ' 01234 ' } : c));
  const m = construirModelo({ ...d, cuentas: cuentasSp,
    facturas: [{ cliente_key: '01234 ', folio: 'F-1', fecha: '2026-10-03', piezas: 1, monto: 250000 }],
    envios: [{ fecha_surtida: '2026-10-01', fecha_entregada: null, guia_rastreo: 'G-1', oc_clientes: { cliente_key: ' pcel ', numero_oc: 'OC-9' } }],
    vendedoresErp: d.vendedoresErp.map((r) => ({ ...r, cliente_key: ` ${r.cliente_key} ` })) }, hoy);
  const f = m.camiones.find((c) => !c.envio); assert.equal(f.ciudad, 'HERMOSILLO', 'factura llega a la sede de ct'); assert.equal(f.cliente, 'CT Internacional');
  const e = m.camiones.find((c) => c.envio); assert.equal(e.ciudad, 'MONTERREY', 'envío « pcel » va a la sede de pcel'); assert.equal(e.cliente, 'PCEL');
  assert.equal(m.vendedoresRuta[0].destinos[0].ciudad, 'HERMOSILLO', 'destino del vendedor con clave limpia');
  const z = construirModelo({ ...d, facturas: [{ cliente_key: ' zzz ', folio: 'F-9', fecha: '2026-10-03', monto: 1 }] }, hoy).camiones.find((c) => !c.envio);
  assert.equal(z.cliente, 'zzz', 'sin cuenta: la clave sale limpia');
});

test('(4.7.52) carteraPorCuenta(): con la misma cuenta dos veces gana el corte más reciente', () => {
  const m = carteraPorCuenta([{ cliente: 'digitalife', fecha_corte: '2026-11-20', saldo_vencido: '$5,000', saldo_actual: 9000, dso: 40 }, { cliente: ' digitalife ', fecha_corte: '2026-10-01', saldo_vencido: 1, saldo_actual: 1, dso: 1 }, null, { cliente: '  ' }]);
  assert.equal(m.size, 1); assert.deepEqual(m.get('digitalife'), { vencido: 5000, saldo: 9000, mas90: 0, dso: 40, corte: '2026-11-20' });
  const n = carteraPorCuenta([{ cliente: 'pcel', fecha_corte: '2026-10-01', saldo_vencido: 1 }, { cliente: 'pcel ', fecha_corte: ' 2026-11-01', saldo_vencido: 2 }]);
  assert.equal(n.get('pcel').vencido, 2, 'el más nuevo llega después');
  assert.equal(carteraPorCuenta([{ cliente: 'x', fecha_corte: '2026-11-01', saldo_vencido: 3 }, { cliente: 'x', fecha_corte: 'pendiente', saldo_vencido: 4 }]).get('x').vencido, 3, 'ilegible pierde');
  assert.equal(carteraPorCuenta([{ cliente: 'x', fecha_corte: null, saldo_vencido: 3 }, { cliente: 'x', fecha_corte: '2026-11-01', saldo_vencido: 4 }]).get('x').vencido, 4, 'legible gana a ilegible');
  assert.equal(carteraPorCuenta([{ cliente: 'x', saldo_vencido: 3 }, { cliente: 'x', saldo_vencido: 4 }]).get('x').vencido, 4, 'sin fechas: el último');
  assert.equal(carteraPorCuenta('basura').size, 0); assert.equal(carteraPorCuenta(null).size, 0);
});

test('4.7.74: carteraPorCuenta() empata la cuenta en mayúsculas y salta clientes que no son texto', () => {
  const m = carteraPorCuenta([{ cliente: 'PCEL', fecha_corte: '2026-10-01', saldo_vencido: 1 }, { cliente: ' pcel ', fecha_corte: '2026-11-01', saldo_vencido: 2 }, { cliente: { a: 1 }, saldo_vencido: 9 }, { cliente: true, saldo_vencido: 9 }, { cliente: ['x'], saldo_vencido: 9 }, { cliente: 10, saldo_vencido: 3 }]);
  assert.deepEqual([...m.keys()].sort(), ['10', 'pcel']); assert.equal(m.get('pcel').vencido, 2);
  const mod = construirModelo({ ...d, cartera: [{ cliente: 'DIGITALIFE', fecha_corte: '2026-10-01', saldo_vencido: 7777, saldo_actual: 9000, dso: 40 }] }, hoy);
  assert.ok(mod.kpis.cartera.some((c) => c.cuenta === 'digitalife' && c.vencido === 7777));
});

test('4.7.56: plural(), piezasTexto() sin «-0» y listaCorta() con n = 0 sin espacio al inicio', () => {
  assert.equal(plural(-0.4, 'día'), '0 días'); assert.equal(plural('-0.2', 'día'), '0 días'); assert.equal(plural(-1, 'día'), '-1 día'); assert.equal(plural(-2.6, 'día'), '-3 días');
  assert.equal(piezasTexto(-0.4), '0 pz'); assert.equal(piezasTexto('-0.3'), '0 pz'); assert.equal(piezasTexto(-5), '-5 pz');
  assert.equal(listaCorta(['a', 'b', 'c'], 0), '+3'); assert.equal(listaCorta(['a', 'b', 'c'], 2), 'a, b +1'); assert.equal(listaCorta(['a', 'b'], 2), 'a, b'); assert.equal(listaCorta([], 0), '');
});

test('fechaIso con hora y zona cuenta el día local (4.7.57)', () => {
  const loc = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  const u = new Date(Date.UTC(2026, 10, 23, 3, 0, 0));
  for (const s of ['2026-11-23T03:00:00Z', '2026-11-23T03:00:00.000Z', '2026-11-23 03:00:00+00', '2026-11-23T03:00:00+00:00', ' 2026-11-23T03:00+0000 '])
    assert.equal(fechaIso(s), loc(u), s);
  assert.equal(fechaIso('2026-11-22T21:00:00-06:00'), loc(new Date(Date.UTC(2026, 10, 23, 3))), 'offset -06:00');
  assert.equal(fechaIso('2026-11-23T03:00:00'), '2026-11-23', 'sin zona = hora local, se queda el día');
  assert.equal(fechaIso('2026-11-23 basura'), '2026-11-23', 'cola ilegible: se queda la fecha');
  assert.equal(fechaIso('2026-02-30T03:00:00Z'), null, 'día imposible sigue siendo null');
  // 4.12.79: «UTC» / «GMT» en letra cuentan como zona.
  for (const s of ['2026-11-23 03:00:00 UTC', '2026-11-23T03:00:00 GMT', '2026-11-23 03:00 utc', '2026-11-23 03:00:00 UTC+00:00', '2026-11-23T03:00:00GMT+0000'])
    assert.equal(fechaIso(s), loc(u), s);
  assert.equal(fechaIso('2026-11-22 21:00:00 GMT-0600'), loc(u), 'GMT-0600');
  assert.equal(fechaIso('2026-11-23 03:00:00 UTCX'), '2026-11-23', 'zona ilegible: se queda la fecha');
  // 4.12.80: formato de `date` / asctime (hora entre el día y el año).
  assert.equal(fechaIso('Thu Nov 26 04:34:17 CST 2026'), '2026-11-26', 'date de Unix');
  assert.equal(fechaIso('Thu Nov  5 04:34:17 2026'), '2026-11-05', 'asctime');
  assert.equal(fechaIso('jue nov 26 04:34 2026'), '2026-11-26', 'en español sin segundos');
  for (const x of ['Feb 31 04:34:17 CST 2026', 'Xyz 26 04:34:17 2026', 'Nov 26 04:34:17 CST', 'Nov 26 04:34:17 CST 2026 basura']) assert.equal(fechaIso(x), null, x);
  // 4.12.133: milisegundos como número (día local); folios, importes, segundos, decimales y NaN siguen null.
  const ms = new Date(2026, 10, 26, 23, 30).getTime();
  assert.equal(fechaIso(ms), '2026-11-26', 'Date.now() de noche se queda en el día local');
  assert.equal(fechaIso(new Date(2000, 0, 2).getTime()), '2000-01-02', 'año 2000');
  for (const x of [0, 12345, 1200000, 1764140400, ms + 0.5, NaN, Infinity, -ms, 4102444800000]) assert.equal(fechaIso(x), null, String(x));
  // 4.12.137: fecha JSON de .NET («/Date(ms)/», con zona o con diagonales escapadas); fuera de rango o basura siguen null.
  assert.equal(fechaIso(`/Date(${ms})/`), '2026-11-26', '/Date(ms)/');
  assert.equal(fechaIso(` /Date(${ms}-0600)/ `), '2026-11-26', 'con zona');
  assert.equal(fechaIso(`\\/Date(${ms})\\/`), '2026-11-26', 'diagonales escapadas');
  for (const x of ['/Date(12345)/', '/Date(4102444800000)/', '/Date()/', `/Date(${ms})/ x`, `Date(${ms})`, '/Date(-1)/']) assert.equal(fechaIso(x), null, x);
  // 4.12.141: número de serie de Excel / Sheets (días desde 1899-12-30), como número o texto, con o sin hora; fuera de 2000–2099 null.
  assert.equal(fechaIso(46352), '2026-11-26', 'serial Excel');
  assert.equal(fechaIso(46352.9999), '2026-11-26', 'serial con hora de noche');
  assert.equal(fechaIso(' 46352.4375 '), '2026-11-26', 'serial en texto');
  assert.equal(fechaIso(36526), '2000-01-01', 'serial 2000');
  assert.equal(fechaIso(46082), '2026-03-01', 'serial tras febrero');
  for (const x of [36525, 73051, '12345', '463520', '46352x', '4635.2', -46352]) assert.equal(fechaIso(x), null, String(x));
});

test('4.7.61 · bitácora: renglones sin folio/id no se pierden ni dicen «null»', () => {
  const h = new Date(2026, 10, 22, 12, 0);
  const m = { hoyIso: '2026-11-22', camiones: [
    { folio: null, fecha: '2026-11-20', monto: 1000 }, { folio: '', fecha: '2026-11-21', monto: 2000 },
    { folio: 'F1', fecha: '2026-11-21', monto: 3000 }, { folio: ' F1 ', fecha: '2026-11-21', monto: 3000 },
    { envio: true, folio: null, fecha: '2026-11-20' }, { envio: true, folio: undefined, fecha: '2026-11-21' },
  ], puerto: { tarimas: [{ id: null, arribo: '2026-11-21', piezas: 10 }], barcos: [{ id: null, arribo: '2026-11-20', piezas: 5 }] } };
  const b = bitacoraEventos(m, h, 50);
  assert.equal(b.filter((x) => x.icono === '🧾').length, 3, 'dos facturas sin folio + F1 una vez');
  assert.equal(b.filter((x) => x.icono === '🚚').length, 2, 'dos envíos sin folio');
  assert.equal(b.filter((x) => x.icono === '📦').length, 2, 'dos arribos sin id');
  assert.equal(new Set(b.map((x) => x.id)).size, b.length, 'ids únicos');
  assert.ok(!JSON.stringify(b).includes('null"'), 'sin «null» en textos/ids');
  assert.equal(b.find((x) => x.icono === '📦').tarjeta.titulo, 'Contenedor');
  const c = bitacoraEventos({ ...m, puerto: { barcos: [{ id: ' C9 ', arribo: '2026-11-20' }] } }, h, 50).find((x) => x.icono === '📦');
  assert.equal(c.tarjeta.titulo, 'Contenedor C9'); assert.equal(c.id, 'arribo-C9');
});

test('4.7.62: porcentaje() con opciones null y plural() sin palabra', () => {
  assert.equal(porcentaje(45, null), '45 %'); assert.equal(porcentaje(45, 'x'), '45 %'); assert.equal(porcentaje(45, { signo: true }), '+45 %'); assert.equal(porcentaje(null, null), '—');
  assert.equal(porcentaje([]), '—'); assert.equal(porcentaje({}), '—'); assert.equal(porcentaje([5]), '—'); assert.equal(porcentaje('12%'), '12 %'); // 4.7.72
  assert.equal(numero('12%'), 12); assert.equal(numero(' 45 % '), 45); assert.equal(numero('$1,234.50'), 1234.5); assert.equal(numero('abc%'), 0); // 4.7.72
  assert.equal(plural(3), '3'); assert.equal(plural(1, null), '1'); assert.equal(plural(2, ''), '2'); assert.equal(plural('1,200', 5), '1,200');
  assert.equal(plural(2, 'día', null), '2 días'); assert.equal(plural(1, 'día', null), '1 día'); assert.equal(plural(2, 'mes', 'meses'), '2 meses'); assert.equal(plural(1, 'mes', 'meses'), '1 mes');
});

test('4.7.63: pin con miles es-MX y acceso rápido sin ciudad en blanco', () => {
  const ts = Array.from({ length: 1200 }, () => ({ vendio: true }));
  assert.equal(pinCiudad({ ciudad: 'LEON', tiendas: ts }).texto, 'León · 🏬 1,200');
  assert.equal(pinCiudad({ ciudad: 'LEON', tiendas: [] }).nombre, 'León'); assert.equal(pinCiudad({ ciudad: '  ', tiendas: [] }).nombre, '');
  const top = ciudadesTop({ distritos: [{ ciudad: '  ', tiendas: [{ vendio: true }] }, { ciudad: 'LEON', tiendas: [{ vendio: true }] }], camiones: [] });
  assert.deepEqual(top.map((c) => [c.ciudad, c.nombre]), [['LEON', 'León']], 'ciudad en blanco no sale como «🏬 1»');
});

test('camionesTemporada: factura sin folio no pinta de promoción a los demás camiones sin folio (4.7.65)', () => {
  const cam = [{ folio: null, fecha: '2026-11-30' }, { folio: '  ', fecha: '2026-11-29' }, { folio: 'F9', fecha: '2026-11-30' }, { folio: 0, fecha: '2026-11-30' }];
  const t = camionesTemporada({ camiones: cam }, new Date(2026, 10, 28, 12));
  assert.equal(t.has(null) || t.has('  ') || t.has(undefined), false, 'sin folio no entra');
  assert.ok(t.has('F9')); assert.ok(t.has(0), 'folio numérico 0 sí cuenta');
});

test('reuniones de la oficina: repetidas una vez y conteo = agenda (4.7.66)', () => {
  const h = new Date('2026-10-05T11:00:00');
  const reu = [{ id: 7, titulo: 'Junta', fecha: '2026-10-05T10:30:00' }, { id: 7, titulo: 'Junta', fecha: '2026-10-05T10:30:00' },
    { titulo: ' junta pcel ', fecha: '2026-10-05T16:00:00' }, { titulo: 'Junta Pcel', fecha: '2026-10-05T16:00:00' },
    { titulo: 'Junta Pcel', fecha: '2026-10-05T17:00:00' }, { titulo: 'Mala', fecha: 'pendiente' }, { titulo: null, fecha: '2026-10-05T10:45:00' }];
  const ag = reunionesDelDia(reu, h);
  assert.equal(ag.length, 4, 'id repetido y mismo título+hora salen una vez; otra hora sí cuenta');
  const m = construirModelo({ reunionesHoy: reu }, h);
  assert.equal(m.oficina.reuniones, 4, 'la fecha ilegible y las repetidas ya no suman');
  assert.equal(m.oficina.agenda.length, m.oficina.reuniones);
  assert.equal(m.oficina.reunionEnCurso.titulo, 'Junta');
  const s = construirModelo({ reunionesHoy: [{ titulo: null, fecha: '2026-10-05T10:45:00' }] }, h);
  assert.equal(s.oficina.reunionEnCurso.titulo, 'Reunión', 'sin título ya no es null');
  assert.equal(construirModelo({ reunionesHoy: [{ titulo: 'X', fecha: 'mal' }] }, h).oficina.reunionEnCurso, null);
});

test('cadenaSuministro(): listas que no son lista no truenan, ETA en texto cuenta y vacía sigue en el mar, «1 cliente»', () => {
  let r; assert.doesNotThrow(() => { r = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: 'x' }, cedis: {}, camiones: 5, distritos: [{ tiendas: 'x', clientesFinales: { n: 1, importe: 5000 } }] }); });
  assert.equal(r.tramos.find((t) => t.clave === 'cliente').volumen, '1 cliente · $5 K');
  const v = cadenaSuministro({ hoyIso: '2026-10-08', puerto: { barcos: [{ llegaEnDias: '' }, { llegaEnDias: ' -5 ' }, { llegaEnDias: 'pendiente' }] }, cedis: {}, camiones: [], distritos: [] });
  const t = (k) => v.tramos.find((x) => x.clave === k);
  assert.match(t('mar').volumen, /^2 barcos/, 'vacía y basura = sin ETA, en el mar');
  assert.match(t('puerto').volumen, /^1 con ETA vencida/); assert.equal(t('puerto').estado, 'rojo');
});

test('cuotaRitmo() empata cuentas con espacios o numéricas sin contar doble; celebraciones() aguanta listas que no son lista', () => {
  const m = { hoyIso: '2026-10-15', cuotas: new Map([['10', { venta: 50, cuota: 100 }], ['ct', { venta: 30, cuota: 100 }]]) };
  assert.equal(cuotaRitmo(m, [10])?.pct, 50, 'cuenta numérica');
  assert.equal(cuotaRitmo(m, [' ct '])?.pct, 30, 'cuenta con espacios');
  const r = cuotaRitmo(m, ['10', 10, ' 10 ', 'ct', null, '']); assert.equal(r.n, 2); assert.equal(r.venta, 80); assert.equal(r.cuota, 200);
  let c; assert.doesNotThrow(() => { c = celebraciones({ distritos: 'x' }); }); assert.deepEqual(c.tiendas, []);
  assert.doesNotThrow(() => { c = celebraciones({ distritos: [{ ciudad: 'X', tiendas: 5 }, { ciudad: 'Y', tiendas: [{ cuenta: 'a', sucursal: 's', vendioMes: true, importe: 10 }] }] }); });
  assert.equal(c.tiendas.length, 1); assert.equal(c.tiendas[0].ciudad, 'Y');
});

test('cintasCadena() aguanta listas que no son lista y empata la ciudad del camión con norm()', () => {
  const base = { hoyIso: '2026-10-08', cedis: { dias: 30 }, distritos: [{ ciudad: 'MONTERREY', tiendas: [{ vendio: true }] }] };
  let c; assert.doesNotThrow(() => { c = cintasCadena({ ...base, camiones: 'x', puerto: { barcos: 5, tarimas: 'x' } }); });
  assert.ok(c.every((x) => Number.isFinite(x.peso)));
  assert.doesNotThrow(() => cintasCadena({ ...base, distritos: 'x', camiones: [null] }));
  assert.doesNotThrow(() => cintasCadena({ ...base, distritos: [null, { ciudad: 'PUEBLA', tiendas: 7 }] }));
  c = cintasCadena({ ...base, camiones: [{ ciudad: ' monterrey ' }, { ciudad: 'Monterrey' }, { ciudad: null }, { ciudad: '' }] });
  const mty = c.find((x) => x.a === 'MONTERREY'); assert.equal(mty.peso, 4, 'los dos camiones de Monterrey cuentan');
  c = cintasCadena({ ...base, distritos: [...base.distritos, { ciudad: '', tiendas: [{ vendio: true }] }, { tiendas: [{ vendio: true }] }] });
  assert.ok(c.every((x) => x.a), 'sin cinta hacia una ciudad vacía');
});

test('4.12.64 pensamiento de cuota: al ritmo no es «arriba de mi cuota»', () => {
  const pc = (venta, cuota, hoyIso = '2026-10-15') => pensamientos({ hoyIso, cuotas: new Map([['ct', { cuota, venta }]]), distritos: [{ ciudad: 'LEON', tiendas: [{ cuenta: 'ct', importe: 10, previo: 21 }] }] })[0]?.texto ?? null;
  assert.equal(pc(600, 1000), 'Voy a buen ritmo con mi cuota (60 %)');
  assert.equal(pc(999, 1000), 'Voy a buen ritmo con mi cuota (99 %)', '99.9 % no se redondea a 100 %');
  assert.equal(pc(1000, 1000), '¡Ya llegué a mi cuota!'); assert.equal(pc(1500, 1000), '¡Ya llegué a mi cuota!');
  assert.equal(pc(400, 1000), null, 'abajo del ritmo no presume');
});
test('4.7.71 pensamientos y misiones con listas raras', () => {
  for (const x of ['texto', 5, { a: 1 }, null]) {
    assert.deepEqual(pensamientos({ distritos: x, kpis: { cartera: x } }), []);
    assert.deepEqual(pensamientos({ distritos: [{ ciudad: 'LEON', tiendas: x }] }), []);
    assert.ok(Array.isArray(misionesDelDia({ oficina: { agenda: x } })));
  }
  const p = pensamientos({ hoyIso: '2026-10-15', kpis: { cartera: [{ cuenta: ' pcel ', vencido: '$5,000' }] }, distritos: [{ ciudad: 'LEON', tiendas: [{ cuenta: 'pcel', sucursal: 'Centro', importe: 10, previo: 10 }] }] });
  assert.equal(p[0]?.texto, 'Tengo pagos vencidos', 'cuenta con espacios empata la cartera vencida');
  const q = pensamientos({ hoyIso: '2026-10-15', cuotas: new Map([['ct', { cuota: '1,000', venta: '$900' }]]), distritos: [{ ciudad: 'LEON', tiendas: [{ cuenta: 'ct', importe: 10, previo: 21 }] }] });
  assert.equal(q[0]?.texto, 'Voy a buen ritmo con mi cuota (90 %)', 'cuota y venta en texto cuentan');
});

test('4.7.77 llegaBarco/enMinutos/haceDias sólo leen número o texto', () => {
  for (const x of [[], [5], {}, () => 1]) { assert.equal(llegaBarco(x), 'sin ETA'); assert.equal(enMinutos(x), ''); assert.equal(haceDias(x), ''); }
  assert.equal(haceDias(' '), ''); assert.equal(haceDias('$5'), 'hace 5 d'); assert.equal(haceDias('1,200'), 'hace 3 años'); assert.equal(haceDias(-0.4), 'hoy');
  assert.equal(llegaBarco(' 2 '), 'llega en 2 d'); assert.equal(enMinutos(' 5 '), 'en 5 min');
});

test('4.7.80 bitacoraEventos/ponerPosEnPuerto aguantan listas que no son lista', () => {
  for (const x of [{}, 7, true, 'abc']) {
    assert.deepEqual(bitacoraEventos({ hoyIso: '2026-10-15', camiones: x, puerto: { barcos: x, tarimas: x }, pagosHechos: x, oficina: { agenda: x } }, new Date(2026, 9, 15, 12)), []);
    const pto = { barcos: x, tarimas: [{ id: 'T1' }] };
    assert.equal(ponerPosEnPuerto(pto, [{ contenedor: 'T1', po: 'PO-1' }]), pto);
    assert.deepEqual(pto.tarimas[0].listaPos, ['PO-1'], 'la tarima sí recibe sus POs aunque barcos venga roto');
  }
  assert.equal(ponerPosEnPuerto('abc', []), 'abc');
  const ev = bitacoraEventos({ hoyIso: '2026-10-15', camiones: {}, puerto: { barcos: [{ id: 'C1', arribo: '2026-10-15', piezas: 10 }], tarimas: 5 } }, new Date(2026, 9, 15, 12));
  assert.equal(ev.length, 1); assert.match(ev[0].texto, /Llegó C1 al CEDIS/);
});

test('resumenBanco(): saldo, % vencido y DSO ponderado como la cartera de Inicio (4.7.81)', () => {
  const b = resumenBanco([{ cuenta: 'a', saldo: 1000, vencido: 200, dso: 30 }, { cuenta: 'b', saldo: 3000, vencido: 0, dso: 60 }, { cuenta: 'c', saldo: 0, vencido: 0, dso: 900 }, { cuenta: 'd', saldo: '$1,000', vencido: '300', dso: null }], [], '2026-11-23');
  assert.equal(b.saldo, 5000); assert.equal(Math.round(b.pctVencido), 10, '500 de 5000');
  assert.equal(b.dso, 53, '(30·1000 + 60·3000) / 4000 = 52.5 → 53; sin saldo o sin DSO no cuentan');
  const vacio = resumenBanco([{ saldo: 0, vencido: 0, dso: 40 }], [], '2026-11-23'); assert.equal(vacio.dso, null); assert.equal(vacio.pctVencido, null);
  const raro = resumenBanco([{ saldo: 100, dso: 'abc' }, { saldo: 100, dso: {} }, 'x', null], [], '2026-11-23'); assert.equal(raro.dso, null); assert.equal(raro.saldo, 200);
  const t = tarjetaDe({ tipo: 'banco' }, { banco: b }).numeros;
  assert.equal(t.length, 4, 'la tarjeta sigue en 4 renglones');
  assert.deepEqual(t[0], ['Cartera vencida', `${pesosCorto(500)} · 10 % del saldo`]);
  assert.deepEqual(t[1], ['Cuentas con vencido', '2 · DSO 53 días']);
  const t0 = tarjetaDe({ tipo: 'banco' }, { banco: vacio }).numeros; assert.deepEqual(t0.slice(0, 2), [['Cartera vencida', pesosCorto(0)], ['Cuentas con vencido', '0']], 'sin saldo ni DSO no se agregan');
  assert.equal(carteraPorCuenta([{ cliente: 'x', saldo_actual: 5, dso: null }]).get('x').dso, null, 'DSO vacío queda null');
  assert.equal(carteraPorCuenta([{ cliente: 'x', dso: ' ' }]).get('x').dso, null); assert.equal(carteraPorCuenta([{ cliente: 'x', dso: '45' }]).get('x').dso, 45);
});

test('resumenTorre(): estatus, cierre, confirmado y piezas raros (4.7.82)', () => {
  const hoyIso = '2026-11-23';
  const r = resumenTorre([
    { estatus: ' Borrador ', forecast_propuesta_lineas: [{ confirmado: true }] },
    { estatus: 'activa', cerrado_at: ' ', forecast_propuesta_lineas: [{ confirmado: 'false', comprado_at: ' ' }, { confirmado: 'true', comprado_at: '2026-11-01' }, { confirmado: 0 }, 'x', [1]] },
    { estatus: 'cerrada', cerrado_at: '2026-11-01', forecast_propuesta_lineas: [{ confirmado: 1 }] }, 'x', [{ estatus: 'activa' }],
  ], [{ fecha_arribo: '2026-11-24', piezas_a_reservar: -5 }, { fecha_arribo: '2026-11-25', piezas_a_reservar: '3' }, '2026-11-24', [{ fecha_arribo: '2026-11-24' }]], hoyIso);
  assert.deepEqual(r, { abiertas: 1, lineas: 4, confirmadas: 2, compradas: 1, arribos7: 2, piezas7: 3, atrasados: 0 }, '« Borrador » fuera; cierre en blanco = abierta; «false» no confirma; -5 no resta');
});

test('diasCedis() / diasTexto(): CEDIS sin medida de días como Inventario (4.7.83)', () => {
  assert.equal(diasCedis(null), null); assert.equal(diasCedis(' '), null); assert.equal(diasCedis('abc'), null); assert.equal(diasCedis({}), null); assert.equal(diasCedis(-3), null); assert.equal(diasCedis(Infinity), null);
  assert.equal(diasCedis(95.6), 96); assert.equal(diasCedis('1,200'), 1200); assert.equal(diasCedis(0), 0); assert.equal(diasCedis(-0.2), null);
  assert.equal(diasTexto(null), 'sin medida de días'); assert.equal(diasTexto(1), '1 día'); assert.equal(diasTexto('1,200.4'), '1,200 días');
  assert.equal(tonoDias(null), null); assert.equal(tonoDias(130), 'ambar'); assert.equal(tonoDias(100), 'verde'); assert.equal(tonoDias(40), 'verde');
  // 4.12.13: mismo semáforo que «Días de Inv» de Inicio (PERFILES.direccion: < 30 rojo, > 120 naranja).
  assert.equal(tonoDias(10), 'rojo'); assert.equal(tonoDias(0), 'rojo'); assert.equal(tonoDias(29.6), 'verde'); assert.equal(tonoDias(30), 'verde'); assert.equal(tonoDias(120), 'verde'); assert.equal(tonoDias('121'), 'ambar');
  assert.equal(estadoDias(10), 'critico'); assert.equal(estadoDias(200), 'sobre'); assert.equal(estadoDias(60), 'sano'); assert.equal(estadoDias(null), null);
  assert.equal(motivoDias(1), 'Sólo 1 día de inventario'); assert.equal(motivoDias(1200), '1,200 días de inventario (alto)'); assert.equal(motivoDias(100), null); assert.equal(motivoDias(null), null);
  const cad = (dias) => cadenaSuministro(construirModelo({ inventario: [{ inv_actual: 1000, inv_actual_piezas: 10, dias_inv: dias, skus_con_stock: 2 }] })).tramos.find((x) => x.clave === 'cedis');
  assert.equal(cad(12).estado, 'rojo'); assert.equal(cad(12).motivo, 'Sólo 12 días de inventario'); assert.equal(cad(100).estado, 'verde'); assert.equal(cad(100).motivo, null); assert.equal(cad(150).estado, 'ambar'); assert.equal(cad(null).estado, 'gris');
  const m = construirModelo({ inventario: [{ inv_actual: 1000, inv_actual_piezas: 10, dias_inv: null, skus_con_stock: 2 }] });
  assert.equal(m.cedis.dias, null, 'dias_inv null ya no es 0');
  const t = tarjetaDe({ tipo: 'cedis' }, m); assert.deepEqual(t.numeros[1], ['Días de inventario', 'sin medida']); assert.equal(t.estado, null, 'sin medida no sale en verde');
  const c = cadenaSuministro(m).tramos.find((x) => x.clave === 'cedis'); assert.match(c.volumen, /sin medida de días$/); assert.equal(c.estado, 'gris'); assert.equal(c.motivo, null);
  const m2 = construirModelo({ inventario: [{ inv_actual: 1000, dias_inv: '130' }] });
  assert.equal(m2.cedis.dias, 130); assert.equal(tarjetaDe({ tipo: 'cedis' }, m2).estado, 'ambar');
});

test('nombreCiudad(): México D.F. y Ciudad de México con sigla son CDMX (4.12.144)', () => {
  for (const s of ['MEXICO D.F.', 'MÉXICO, D.F.', 'MEXICO DF', 'mexico, d. f.', 'CIUDAD DE MEXICO, CDMX', 'CD. DE MEXICO D.F.', 'Ciudad de México, DF', 'D. F.', 'MEXICO CDMX']) assert.equal(nombreCiudad(s), 'CDMX', s);
  assert.equal(nombreCiudad('EDO. DE MEXICO'), 'Estado de México'); assert.equal(nombreCiudad('NUEVO MEXICO'), 'Nuevo México'); assert.equal(nombreCiudad('MEXICALI'), 'Mexicali');
});
test('nombreCiudad(): Puerto/Estado, siglas con punto y acento antes de la coma (4.12.99)', () => {
  assert.equal(nombreCiudad('PTO. VALLARTA'), 'Puerto Vallarta'); assert.equal(nombreCiudad('PTO VALLARTA'), 'Puerto Vallarta'); assert.equal(nombreCiudad('PTO.VALLARTA'), 'Puerto Vallarta');
  assert.equal(nombreCiudad('EDO. DE MEXICO'), 'Estado de México');
  assert.equal(nombreCiudad('SAN LUIS POTOSI, S.L.P.'), 'San Luis Potosí, S.L.P.'); assert.equal(nombreCiudad('STA. CATARINA N.L.'), 'Santa Catarina, N.L.'); // 4.12.145: con coma, como «MONTERREY NL»
  assert.equal(nombreCiudad('MERIDA, YUC.'), 'Mérida, Yuc.'); assert.equal(nombreCiudad('ZAPOPAN, JAL.'), 'Zapopan, Jal.'); assert.equal(nombreCiudad('LAGOS DE MORENO'), 'Lagos de Moreno');
  assert.equal(nombreCiudad('MEXICO D.F.'), 'CDMX'); assert.equal(nombreCiudad('D.F.'), 'CDMX');
  assert.equal(nombreSucursal('PCEL PTO. VALLARTA'), 'Pcel Puerto Vallarta'); assert.equal(nombreSucursal('PLAZA PTO.VALLARTA'), 'Plaza Puerto Vallarta');
});
test('estatusBarco(): acentos y guiones en estatus desconocidos (4.12.98)', () => {
  assert.equal(estatusBarco('EN TRANSITO'), 'En tránsito'); assert.equal(estatusBarco('en_transito'), 'En tránsito');
  assert.equal(estatusBarco('EN REVISION DE ADUANA'), 'En revisión de aduana'); assert.equal(estatusBarco('LLEGO A ALMACEN'), 'Llegó a almacén');
  assert.equal(estatusBarco('TRANSITO_MARITIMO'), 'En el mar', 'con guion bajo también empata la tabla'); assert.equal(estatusBarco('en-puerto'), 'En puerto');
  assert.equal(estatusBarco('En tránsito'), 'En tránsito', 'el que ya trae acento no cambia'); assert.equal(estatusBarco('TRANSITORIO'), 'Transitorio', 'sólo palabras completas');
  assert.equal(estatusBarco('ETA 2026-11-30'), 'Eta 2026-11-30', 'guion entre números se queda');
});
test('estatusBarco(): nombres cortos del Plan de compras (4.7.84)', () => {
  assert.equal(estatusBarco('TRANSITO MARITIMO'), 'En el mar'); assert.equal(estatusBarco(' Tránsito  marítimo '), 'En el mar');
  assert.equal(estatusBarco('PROXIMO A ZARPAR'), 'Por zarpar'); assert.equal(estatusBarco('Pendiente modular'), 'Pendiente'); assert.equal(estatusBarco('EN PRODUCCION'), 'En producción');
  assert.equal(estatusBarco('NAVEGANDO'), 'Navegando', 'desconocido en minúsculas como el dashboard');
  assert.equal(estatusBarco(null), ''); assert.equal(estatusBarco(' '), ''); assert.equal(estatusBarco({}), ''); assert.equal(estatusBarco('null'), '');
  assert.deepEqual(tarjetaDe({ tipo: 'barco', barco: { piezas: 1, estatus: 'EN PUERTO' } }, {}).numeros[3], ['Estatus', 'En puerto']);
  const m = { puerto: { barcos: [{ id: 'C1', supplier: 'S', piezas: 5, estatus: 'PROXIMO A ZARPAR', llegaEnDias: null }, { id: 'C2', supplier: 'S', piezas: 5, estatus: 'TRANSITO MARITIMO', eta: '2026-11-25', llegaEnDias: 2 }, { id: 'C3', llegaEnDias: null }], tarimas: [] } };
  const t1 = tarjetaDe({ tipo: 'barco', id: 'C1', sub: 'MSK · 5 pz' }, m);
  assert.deepEqual(t1.numeros[1], ['ETA puerto', 'sin ETA · por zarpar']); assert.equal(t1.sub, 'MSK · 5 pz · Por zarpar');
  assert.equal(tarjetaDe({ tipo: 'barco', id: 'C2', sub: 'MSK' }, m).sub, 'MSK · En el mar');
  const t3 = tarjetaDe({ tipo: 'barco', id: 'C3', sub: 'x' }, m); assert.deepEqual(t3.numeros[1], ['ETA puerto', 'sin ETA']); assert.equal(t3.sub, 'x');
});

test('fechaCorta() lleva el año fuera del año de hoy (4.12.3)', () => {
  const nov = fechaCorta('2025-11-23', '2026-01-05'); assert.match(nov, /^23 nov 2025$/);
  assert.equal(fechaCorta('2026-11-23', '2026-01-05'), fechaCorta('2026-11-23', new Date(2026, 0, 5)));
  assert.ok(!/2026/.test(fechaCorta('2026-11-23', '2026-01-05')));
  assert.match(fechaCorta('2027-01-02', '2026-12-30'), / 2027$/);
  assert.equal(fechaCorta('2026-11-23', 'basura'), fechaCorta('2026-11-23')); // hoy ilegible = ahora
  assert.equal(fechaCorta(null, '2026-01-05'), '');
  const b = tarjetaDe({ tipo: 'barco', barco: { piezas: 1, eta: '2025-12-30', arribo: '2026-01-04' } }, { hoyIso: '2026-01-02' });
  assert.match(b.numeros[1][1], /^30 dic 2025$/); assert.ok(!/2026/.test(b.numeros[2][1]));
});

test('4.12.4: claves de cuenta/cliente NaN, objeto o lista no salen «NaN» ni «[object Object]»', () => {
  const hoy = new Date('2026-11-23T12:00:00');
  const d = {
    cuentas: [{ cuenta: NaN, nombre: 'Rota' }, { cuenta: {}, nombre: 'Rota 2' }, { cuenta: ' ct ', nombre: 'CT Internacional', erp_cliente: ' 01234 ' }],
    facturas: [{ cliente_key: NaN, folio: 'F1', fecha: '2026-11-22', monto: 100 }, { cliente_key: {}, folio: 'F2', fecha: '2026-11-22', monto: 90 }, { cliente_key: '01234', folio: 'F3', fecha: '2026-11-22', monto: 80 }],
    envios: [{ fecha_envio_erp: '2026-11-22', guia_rastreo: {}, oc_clientes: { cliente_key: [], numero_oc: NaN } }, { fecha_envio_erp: '2026-11-22', guia_rastreo: ' G9 ', oc_clientes: null }],
    clientesFinales: [{ cuenta: NaN, estado: 'JALISCO', importe: 5 }, { cuenta: ' ct ', estado: 'JALISCO', importe: 5 }],
  };
  const m = construirModelo(d, hoy);
  const s = JSON.stringify({ camiones: m.camiones, distritos: m.distritos });
  assert.ok(!/NaN|\[object/.test(s), s.slice(0, 300));
  const cam = Object.fromEntries(m.camiones.map((c) => [c.folio, c]));
  assert.equal(cam.F1.cliente, null); assert.equal(cam.F2.cliente, null);
  assert.equal(cam.F3.cliente, 'CT Internacional'); // la clave ERP con espacios sigue empatando
  assert.ok(cam['envío OC'], 'envío sin guía ni OC legibles dice «envío OC»');
  assert.equal(cam['guía G9']?.envio, true);
  const gdl = m.distritos.find((x) => x.ciudad === 'GUADALAJARA');
  if (gdl?.clientesFinales) assert.deepEqual(gdl.clientesFinales.cuentas, ['ct']);
});

test('4.12.8 · contenedor con id sucio: se limpia y la tarjeta lo encuentra (sin «Contenedor NaN»)', () => {
  const hoy = new Date(2026, 10, 23, 12);
  const m = construirModelo({ contenedores: [{ contenedor: ' MSKU1 ', eta_puerto: '2026-11-30', piezas: 10 }, { contenedor: NaN, eta_puerto: '2026-12-01' }, { contenedor: { x: 1 }, eta_puerto: '2026-12-02' }, { contenedor: 77, eta_puerto: '2026-12-03' }] }, hoy);
  const ids = m.puerto.barcos.map((b) => b.id).sort((a, b) => String(a).localeCompare(String(b)));
  assert.deepEqual(ids, ['77', 'MSKU1', null, null]);
  const t = tarjetaDe({ tipo: 'barco', id: 'MSKU1', titulo: 'Contenedor MSKU1' }, m);
  assert.equal(t.numeros.find((n) => n[0] === 'Piezas')?.[1], '10');
  assert.ok(!JSON.stringify(m.puerto).includes('NaN'));
});
test('4.12.11: nombre de cuenta y título de pendiente en objeto no llegan como texto raro', () => {
  const d2 = structuredClone(d); d2.cuentas = d2.cuentas.map((c) => ({ ...c, nombre: {} })); d2.agendaHoy = (d2.agendaHoy || []).map((x) => ({ ...x, titulo: { a: 1 } }));
  const m = construirModelo(d2, hoy);
  for (const x of m.distritos) for (const t of x.tiendas) { assert.equal(typeof t.nombreCuenta, 'string'); assert.ok(!t.nombreCuenta.includes('[object'), t.nombreCuenta); }
  for (const x of m.distritos) for (const v of x.vendedores || []) assert.ok(!String(v.nombreCuenta).includes('[object'));
  for (const p of m.oficina.personas) assert.ok(p.actividad === null || typeof p.actividad === 'string', 'actividad es texto o null');
  const d3 = structuredClone(d); d3.cuentas = d3.cuentas.map((c) => ({ ...c, nombre: '  Grupo X  ' }));
  assert.ok(construirModelo(d3, hoy).distritos.some((x) => x.tiendas.some((t) => t.nombreCuenta === 'Grupo X')), 'nombre limpio sin espacios');
});

test('4.12.14 pensamientos comparan contra el ritmo del mes pasado', () => {
  const T = (importe, previo) => ({ distritos: [{ ciudad: 'GDL', tiendas: [{ cuenta: 'a', sucursal: 'Centro', importe, previo }] }] });
  const txt = (hoyIso, i, p) => pensamientos({ ...T(i, p), hoyIso })[0]?.texto ?? null;
  assert.equal(txt('2026-11-15', 50, 100), null, 'a medio mes 50 de 100 va al ritmo');
  assert.equal(txt('2026-11-03', 10, 100), null, 'día 3: 10 de 100 va al ritmo (antes «Vendo 90 % menos»)');
  assert.equal(txt('2026-11-15', 20, 100), 'Voy 60 % abajo del ritmo del mes pasado');
  assert.equal(txt('2026-11-15', 100, 100), '¡Voy 100 % arriba del ritmo del mes pasado!');
  assert.equal(txt('2026-11-30', 100, 100), null, 'fin de mes = mes completo');
  assert.equal(txt('2026-11-01', 0, 100), null, 'día 1 sin venta no es alarma');
  assert.equal(txt('2026-11-10', 0, 100), null);
  assert.equal(txt('2026-11-11', 0, 100), 'Este mes no he vendido nada');
  assert.equal(txt('2026-11-15', 50, 0), null, 'sin mes anterior no compara');
});

test('4.12.16 días de inventario de la barra con el semáforo de Inicio', () => {
  const t = (cobertura) => recursosBarra({ inv: { valor: 1000, cobertura } })[0].tono;
  assert.equal(t(10), 'rojo', '< 30 días');
  assert.equal(t(60), 'verde');
  assert.equal(t('150'), 'ambar', '> 120 días (texto)');
  assert.equal(t(null), null, 'sin medida');
  assert.equal(t(NaN), null);
  assert.equal(t(-5), null, 'negativo');
  assert.equal(recursosBarra({ inv: { valor: 1, cobertura: 10 } })[0].extra, '10 d');
});

test('4.12.17: cartera vencida con el semáforo de Inicio (rojo > 15 % del saldo, si no ámbar)', () => {
  assert.equal(tonoCartera(0, 50), 'verde'); assert.equal(tonoCartera(null, null), 'verde'); assert.equal(tonoCartera('x', 3), 'verde');
  assert.equal(tonoCartera(100, 10), 'ambar'); assert.equal(tonoCartera('$5,000', '15'), 'ambar'); assert.equal(tonoCartera(100, 15.1), 'rojo');
  for (const p of [null, undefined, NaN, '', 'x', [5], {}]) assert.equal(tonoCartera(100, p), 'rojo', `pct ${String(p)}`);
  assert.equal(recursosBarra({ cartera: { vencido: 1e6, pctVencido: 8 } })[0].tono, 'ambar');
  assert.equal(recursosBarra({ cartera: { vencido: 1e6, pctVencido: 30 } })[0].tono, 'rojo');
  const h = new Date(2026, 10, 24, 12);
  assert.deepEqual(burbujasAtencion({ banco: { carteraVencida: 1e6, pctVencido: 8 } }, h).map((x) => [x.lugar, x.nivel]), [['banco', 'ambar']]);
  assert.deepEqual(burbujasAtencion({ banco: { carteraVencida: 1e6, pctVencido: 8, pagosVencidos: 1 } }, h).map((x) => [x.nivel, x.texto]), [['rojo', '1 pago vencido']]);
  assert.equal(burbujasAtencion({ banco: { carteraVencida: 1e6, pctVencido: 40 } }, h)[0].nivel, 'rojo');
  const t = (b) => tarjetaDe({ tipo: 'banco' }, { banco: { pagosSemana: 0, pagosVencidos: 0, ...b } }).estado;
  assert.equal(t({ carteraVencida: 1e6, saldo: 1e7, pctVencido: 10 }), 'ambar'); assert.equal(t({ carteraVencida: 1e6, saldo: 2e6, pctVencido: 50 }), 'rojo');
  assert.equal(t({ carteraVencida: 0 }), 'verde'); assert.equal(t({ carteraVencida: 1e6, pctVencido: 10, pagosVencidos: 2 }), 'rojo');
});

test('semáforo de ventas del mes como la barra de cuota de Inicio (4.12.18)', () => {
  { const v = recursosBarra({ cur: { fact_neta: 996 }, cuotaPeriodo: 1000 })[0]; assert.equal(v.pct, 100); assert.equal(v.tono, null, '4.12.35: 99.6 % no es verde'); // 4.12.35
    assert.equal(recursosBarra({ cur: { fact_neta: 846 }, cuotaPeriodo: 1000 })[0].tono, 'ambar', '84.6 % ámbar'); assert.equal(recursosBarra({ cur: { fact_neta: 1000 }, cuotaPeriodo: 1000 })[0].tono, 'verde'); }
  assert.equal(tonoCuota(100), 'verde'); assert.equal(tonoCuota(130), 'verde'); assert.equal(tonoCuota(99), null); assert.equal(tonoCuota(85), null);
  assert.equal(tonoCuota(84), 'ambar'); assert.equal(tonoCuota(60), 'ambar'); assert.equal(tonoCuota(59), 'rojo'); assert.equal(tonoCuota(0), 'rojo'); assert.equal(tonoCuota('70'), 'ambar');
  for (const p of [null, undefined, NaN, Infinity, '', 'x', [5], {}]) assert.equal(tonoCuota(p), null, `pct ${String(p)}`);
  assert.equal(recursosBarra({ cur: { fact_neta: 7e6 }, cuotaPeriodo: 10e6 })[0].tono, 'ambar', '70 % ya no es rojo');
  assert.equal(recursosBarra({ cur: { fact_neta: 5e6 }, cuotaPeriodo: 10e6 })[0].tono, 'rojo');
});

test('un solo semáforo de tiendas activas: cadena, cintas y tarjeta de la ciudad (4.12.19)', () => {
  assert.equal(tonoActivas(3, 10), 'rojo'); assert.equal(tonoActivas(4, 10), 'ambar'); assert.equal(tonoActivas(6, 10), 'ambar'); assert.equal(tonoActivas(7, 10), 'verde');
  assert.equal(tonoActivas('5', ' 10 '), 'ambar'); assert.equal(tonoActivas(-2, 10), 'rojo');
  for (const [a, t] of [[0, 0], [1, null], [1, 'x'], [null, 5], [1, -3]]) assert.equal(tonoActivas(a, t), null, `${a}/${t}`);
  const ts = [{ vendio: true, cuenta: 'a' }, { vendio: false, cuenta: 'a' }];
  const card = tarjetaDe({ tipo: 'ciudad', ciudad: 'X' }, { distritos: [{ ciudad: 'X', tiendas: ts }] });
  assert.equal(card.estado, 'ambar', '50 % ya no sale verde en la tarjeta');
  const cad = cadenaSuministro({ distritos: [{ ciudad: 'X', tiendas: ts }] });
  assert.equal(cad.tramos.find((x) => x.clave === 'tienda').estado, card.estado, 'misma señal en la cadena');
  assert.equal(tarjetaDe({ tipo: 'ciudad', ciudad: 'X' }, { distritos: [{ ciudad: 'X', tiendas: [] }] }).estado, null);
});

test('4.12.21 capa de cartera con el semáforo de Inicio (ámbar ≤ 15 % del saldo)', () => {
  const m = { distritos: [
    { ciudad: 'GDL', tiendas: [{ cuenta: 'a' }, { cuenta: 'b' }] },
    { ciudad: 'MTY', tiendas: [{ cuenta: 'c' }] },
    { ciudad: 'PUE', tiendas: [{ cuenta: 'd' }] },
    { ciudad: 'QRO', tiendas: [{ cuenta: 'e' }] },
  ], kpis: { cartera: [{ cuenta: 'a', vencido: 10, saldo: 100 }, { cuenta: 'b', vencido: 0, saldo: '$900' }, { cuenta: 'c', vencido: 50, saldo: 100 }, { cuenta: 'd', vencido: 5 }, { cuenta: 'e', vencido: 0, saldo: 100 }] } };
  const c = capaCiudades(m, 'cartera');
  assert.deepEqual(['GDL', 'MTY', 'PUE', 'QRO'].map((x) => c.porCiudad.get(x).tono), ['ambar', 'rojo', 'rojo', 'verde']); // GDL 10/1000 = 1 %; PUE sin saldo → rojo
  assert.equal(c.porCiudad.get('GDL').texto, '1 cuenta con vencido · $10 · 1 % del saldo');
  assert.equal(c.porCiudad.get('PUE').texto, '1 cuenta con vencido · $5');
  assert.equal(tonoCartera(10, 1), c.porCiudad.get('GDL').tono, 'mismo semáforo que el banco');
  for (const l of c.leyenda) assert.ok(CAPA_TONOS[l.tono] != null);
});

test('textoSync: estado del puente con las palabras del importador (4.12.26)', () => {
  assert.deepEqual(textoSync('success'), { icono: '🔄', texto: 'Se actualizaron los datos' });
  assert.deepEqual(textoSync(' OK '), { icono: '🔄', texto: 'Se actualizaron los datos' });
  assert.deepEqual(textoSync(null), { icono: '🔄', texto: 'Se actualizaron los datos' });
  assert.deepEqual(textoSync('warning'), { icono: '🔄', texto: 'Se actualizaron los datos · con avisos' });
  assert.deepEqual(textoSync('Error'), { icono: '⚠️', texto: 'Falló una actualización de datos' });
  assert.equal(textoSync('parcial').texto, 'Se actualizaron los datos · con avisos');
  assert.equal(textoSync('otra cosa').texto, 'Se actualizaron los datos · otra cosa');
});

test('textoSync: más palabras de fallo, avisos y en curso (4.12.84)', () => {
  for (const e of ['FAILURE', ' errored ', 'Fallido']) assert.deepEqual(textoSync(e), { icono: '⚠️', texto: 'Falló una actualización de datos' });
  for (const w of ['warn', 'WARNINGS', 'Avisos', 'partial']) assert.equal(textoSync(w).texto, 'Se actualizaron los datos · con avisos');
  for (const r of ['running', 'EN_CURSO', 'en-proceso', ' in  progress ', 'pending']) assert.deepEqual(textoSync(r), { icono: '🔄', texto: 'Actualizando los datos' });
  assert.equal(textoSync('running', 'Inventario ERP').texto, 'Actualizando los datos · Inventario ERP');
  assert.equal(textoSync(500).texto, 'Se actualizaron los datos · 500');
  const h = new Date('2026-10-07T11:00:00');
  const b = bitacoraEventos({ hoyIso: '2026-10-07', ultimaSync: { status: 'error', created_at: '2026-10-07T10:40:00' } }, h);
  assert.deepEqual(b.map((x) => [x.icono, x.cuando, x.texto]), [['⚠️', '10:40', 'Falló una actualización de datos']]);
});

test('textoSync: sinónimos de éxito y de fallo (4.12.101)', () => {
  for (const e of ['COMPLETED', ' done ', 'Terminado', 'finished', 'succeeded', 'Listo', 'completada']) assert.deepEqual(textoSync(e), { icono: '🔄', texto: 'Se actualizaron los datos' });
  for (const f of ['timeout', 'TIMED_OUT', 'timed-out', 'Aborted']) assert.deepEqual(textoSync(f), { icono: '⚠️', texto: 'Falló una actualización de datos' });
  assert.equal(textoSync('done', 'Precios ERP').texto, 'Se actualizaron los datos · Precios ERP');
  assert.equal(textoSync('otra cosa').texto, 'Se actualizaron los datos · otra cosa');
});

test('Banco: cartera a más de 90 días como la frase de cartera de Inicio (4.12.27)', () => {
  const cp = carteraPorCuenta([{ cliente: 'a', saldo_actual: 1000, saldo_vencido: 400, aging_mas90: '$250' }, { cliente: 'b', saldo_actual: 500, saldo_vencido: 100, aging_mas90: null }]);
  assert.equal(cp.get('a').mas90, 250); assert.equal(cp.get('b').mas90, 0);
  const filas = [...cp.entries()].map(([k, c]) => ({ cuenta: k, ...c }));
  const b = resumenBanco([...filas, { cuenta: 'c', saldo: 100, vencido: 0, mas90: -50 }, null, 'x'], [], '2026-11-24');
  assert.equal(b.mas90, 250, 'suma +90; negativos, nulos y basura no restan');
  const t = tarjetaDe({ tipo: 'banco' }, { banco: b }).numeros;
  assert.equal(t.length, 4);
  assert.deepEqual(t[0], ['Cartera vencida', `${pesosCorto(500)} · 31 % del saldo · ${pesosCorto(250)} a +90 días`]);
  const sin = tarjetaDe({ tipo: 'banco' }, { banco: resumenBanco(filas.slice(1), [], '2026-11-24') }).numeros;
  assert.ok(!sin[0][1].includes('+90'), 'sin +90 no se agrega');
});

test('claveSku: SKU limpio y sin «[OBJECT OBJECT]» (4.12.29)', () => {
  assert.equal(claveSku(' ac-1 '), 'AC-1'); assert.equal(claveSku(1234), '1234'); assert.equal(claveSku(0), '0');
  for (const v of [null, undefined, {}, [], ['A'], true, NaN, Infinity, '  ']) assert.equal(claveSku(v), '', String(v));
  assert.deepEqual(topSkus([{ sku: {}, importe: 9 }, { sku: [], importe: 8 }, { sku: true, importe: 7 }, { sku: 55, importe: 1 }]).map((r) => r.sku), ['55']);
  const dem = demanda3Meses([{ sku: {}, anio: 2026, piezas: [5, 5, 5] }, { sku: NaN, anio: 2026, piezas: [1, 1, 1] }, { sku: 77, anio: 2026, piezas: [1, 2, 3] }], new Date(2026, 3, 10));
  assert.deepEqual([...dem.entries()], [['77', 6]]);
  const r = racksPorMarca([{ articulo: {}, inventario: 5, costoinventario: 100 }, { articulo: ' ab ', inventario: 2, costoinventario: 10 }], { AB: 'acteck' });
  assert.deepEqual(r.map((g) => [g.marca, g.skus, g.valor]), [['ACTECK', 1, 10]]);
});

test('4.12.30 ponerPosEnPuerto salta contenedor/PO/id que no son texto ni número', () => {
  const pto = { barcos: [{ id: ' C1 ' }, { id: {} }, { id: NaN }], tarimas: [{ id: 'T1' }] };
  ponerPosEnPuerto(pto, [{ contenedor: 'C1', po: {} }, { contenedor: 'C1', po: NaN }, { contenedor: 'C1', po: true }, { contenedor: 'C1', po: ['PO-3'] }, { contenedor: 'C1', po: ' PO-1 ' }, { contenedor: {}, po: 'PO-X' }, { contenedor: NaN, po: 'PO-Y' }, { contenedor: 'T1', po: 12 }]);
  assert.deepEqual(pto.barcos[0].listaPos, ['PO-1']);
  assert.equal(pto.barcos[1].listaPos, undefined); assert.equal(pto.barcos[2].listaPos, undefined);
  assert.deepEqual(pto.tarimas[0].listaPos, ['12']);
});

test('reunionesDelDia ignora id/cliente_key que no son texto ni número (4.12.32)', () => {
  const h = new Date('2026-10-05T08:00:00');
  const ag = reunionesDelDia([{ id: {}, titulo: 'A', fecha: '2026-10-05T09:00:00', cliente_key: {} }, { id: {}, titulo: 'B', fecha: '2026-10-05T10:00:00' }, { id: NaN, titulo: 'C', fecha: '2026-10-05T11:00:00', cliente_key: ' acteck ' }, { id: true, titulo: 'D', fecha: '2026-10-05T12:00:00' }, { id: 7, titulo: 'E', fecha: '2026-10-05T13:00:00' }, { id: ' 7 ', titulo: 'E2', fecha: '2026-10-05T14:00:00' }], h);
  assert.deepEqual(ag.map((r) => r.titulo), ['A', 'B', 'C', 'D', 'E']);
  assert.equal(ag[0].cliente_key, null); assert.equal(ag[2].cliente_key, 'acteck');
});
test('nombreSucursal(): la sucursal en mayúsculas sale legible y las siglas se respetan (4.12.33)', () => {
  for (const [s, r] of [['CIUDAD JUAREZ', 'Ciudad Juárez'], ['PLAZA DEL SOL', 'Plaza del Sol'], ['CT GDL SUR', 'CT GDL Sur'], ['GDL1', 'GDL1'], ['MTY-SUR', 'MTY-Sur'], ['Galerías GDL', 'Galerías GDL'], ['CIUDAD DE MEXICO', 'CDMX'], ['LEON  NORTE', 'León Norte'], ['S.A. DE C.V.', 'S.A. de C.V.'], [' ', ''], [null, ''], [{}, ''], [123, '123']]) assert.equal(nombreSucursal(s), r, String(s));
  assert.equal(nombreTienda({ nombreCuenta: 'CT Internacional', sucursal: 'HERMOSILLO' }), 'CT Internacional · Hermosillo');
  const m = construirModelo(d, hoy); const p = pensamientos(m).find((x) => x.sucursal === 'HERMOSILLO');
  if (p) assert.equal(p.nombre, 'CT Internacional · Hermosillo');
  const t = m.distritos.flatMap((x) => x.tiendas.map((y) => ({ x, y }))).find(({ y }) => y.sucursal === 'HERMOSILLO');
  assert.ok(tarjetaDe({ tipo: 'tienda', ciudad: t.x.ciudad, cuenta: t.y.cuenta, titulo: nombreTienda(t.y) }, m).numeros.length > 0, 'la tarjeta encuentra la tienda con el nombre legible');
});

test('claveTexto: cuentas y clientes que no son texto ni número se saltan (4.12.37)', () => {
  assert.deepEqual([' ct ', 10, 1.5, '', '  ', null, undefined, {}, [], true, NaN, Infinity].map(claveTexto), ['ct', '10', '1.5', '', '', '', '', '', '', '', '', '']);
  const q = cuotasPorCuenta([{ cliente_erp: 1, cuenta_sellout: 'a', cuota_venta: 100 }, { cliente_erp: 2, cuenta_sellout: {}, cuota_venta: 50 }, { cliente_erp: 3, cuenta_sellout: true, cuota_venta: 50 }, { cliente_erp: {}, cuenta_sellout: 'b', cuota_venta: 70 }, { cliente_erp: [], cuenta_sellout: 'b', cuota_venta: 30 }],
    [{ cliente: 1, fact_neta: 40 }, { cliente: {}, fact_neta: 999 }, { cliente: 2, fact_neta: 5 }]);
  assert.deepEqual([...q.keys()], ['a']); assert.deepEqual(q.get('a'), { venta: 40, cuota: 100 });
  const opt = { anio: 2026, mes: 10, anioPrev: 2026, mesPrev: 9 };
  assert.deepEqual(repartoPorEstado({}, [{ cuenta: {}, estado: 'NUEVO LEON', anio: 2026, mes: 10, importe: 10 }], opt), []);
  assert.deepEqual(repartoPorEstado(true, [{ cuenta: true, estado: 'NUEVO LEON', anio: 2026, mes: 10, importe: 10 }], opt), []);
  assert.equal(repartoPorEstado(7, [{ cuenta: ' 7 ', estado: 'NUEVO LEON', anio: 2026, mes: 10, importe: 10 }, { cuenta: {}, estado: 'NUEVO LEON', anio: 2026, mes: 10, importe: 99 }], opt)[0]?.importe, 10);
});

test('capa ventas: semáforo con el % sin redondear (4.12.38)', () => {
  const m = { distritos: [
    { ciudad: 'A', tiendas: [{ importe: 996, previo: 1000 }] },
    { ciudad: 'B', tiendas: [{ importe: 796, previo: 1000 }] },
    { ciudad: 'C', tiendas: [{ importe: 1000, previo: 1000 }] },
    { ciudad: 'D', tiendas: [{ importe: 800, previo: 1000 }] },
  ] };
  const v = capaCiudades(m, 'ventas').porCiudad;
  assert.equal(v.get('A').tono, 'ambar'); assert.equal(v.get('A').valor, 0); assert.ok(!Object.is(v.get('A').valor, -0));
  assert.equal(v.get('B').tono, 'rojo'); assert.equal(v.get('B').valor, -20);
  assert.equal(v.get('C').tono, 'verde'); assert.equal(v.get('D').tono, 'ambar');
});

test('(4.12.40) destino del vendedor con el nombre de la cuenta del dashboard (como el camión); sin cuenta, el del ERP', () => {
  const erp = [{ anio: 2026, vendedor: 'ANA', cliente_key: '01234', cliente_nombre: 'CT INTERNACIONAL DEL NOROESTE SA DE CV', fact_neta: 500 },
    { anio: 2026, vendedor: 'ANA', cliente_key: '777', cliente_nombre: ' DISTRIBUIDORA X ', fact_neta: 300 },
    { anio: 2026, vendedor: 'ANA', cliente_key: '888', cliente_nombre: null, fact_neta: 100 }];
  const ds = construirModelo({ ...d, vendedoresErp: erp }, hoy).vendedoresRuta[0].destinos;
  assert.equal(ds[0].cliente, 'CT Internacional'); assert.equal(vaA(ds[0]), 'va a CT Internacional (Hermosillo)');
  assert.equal(ds[1].cliente, 'DISTRIBUIDORA X', 'sin cuenta: nombre del ERP sin espacios');
  assert.equal(ds[2].cliente, '888', 'sin nombre: la clave');
});

test('(4.12.41) sedeDeCuenta() sin espacios ni mayúsculas; la cartera encuentra su tienda aunque la cuenta venga en MAYÚSCULAS', () => {
  assert.equal(sedeDeCuenta(' PCEL '), 'MONTERREY'); assert.equal(sedeDeCuenta('Kabik'), 'MERIDA');
  assert.equal(sedeDeCuenta(''), 'GUADALAJARA'); assert.equal(sedeDeCuenta({}), 'GUADALAJARA'); assert.equal(sedeDeCuenta(NaN, 'X'), 'X');
  assert.equal(sedeDeCuenta('toString'), 'GUADALAJARA', 'sin heredar del prototipo'); assert.equal(sedeDeCuenta('nadie', 'CIUDAD DE MEXICO'), 'CIUDAD DE MEXICO');
  const m = construirModelo({ ...d, sucursales: [], clientesFinales: [], cuentas: [{ cuenta: ' PCEL ', nombre: 'PCEL', tiene_sellout: true }],
    cuentaMes: [{ cuenta: 'PCEL', anio: 2026, mes: 10, importe: 100 }], cartera: [{ cliente: 'pcel', saldo_vencido: 50, saldo_actual: 1000, fecha_corte: '2026-10-01' }] }, hoy);
  const mty = m.distritos.find((x) => x.ciudad === 'MONTERREY'); assert.ok(mty, 'PCEL va a Monterrey');
  const t = mty.tiendas.find((x) => x.cuenta === 'PCEL'); assert.ok(t); assert.equal(t.cartera?.vencido, 50);
});

test('(4.12.42) colorCuenta() sin espacios ni mayúsculas; desconocida o basura → gris', () => {
  assert.equal(colorCuenta(' PCEL '), COLOR_CUENTA.pcel); assert.equal(colorCuenta('Kabik'), COLOR_CUENTA.kabik); assert.equal(colorCuenta('ct'), COLOR_CUENTA.ct);
  assert.equal(colorCuenta(''), 0x8E8E93); assert.equal(colorCuenta({}), 0x8E8E93); assert.equal(colorCuenta(NaN, 1), 1); assert.equal(colorCuenta('toString'), 0x8E8E93); assert.equal(colorCuenta('otra', 7), 7);
});

test('(4.12.43) nombre de la cuenta y Matriz sin duplicar aunque sell out y catálogo difieran en mayúsculas', () => {
  const m = construirModelo({ ...d, clientesFinales: [], vendedoresMayoristas: [], cuentas: [{ cuenta: 'pcel', nombre: 'PC Electrónica', tiene_sellout: true }, { cuenta: 'Kabik', nombre: 'Kabik SA', tiene_sellout: true }],
    sucursales: [{ cuenta: 'PCEL', sucursal: 'MONTERREY CENTRO', anio: 2026, mes: 10, importe: 500 }],
    cuentaMes: [{ cuenta: 'KABIK', anio: 2026, mes: 10, importe: 300 }] }, hoy);
  const ts = m.distritos.flatMap((x) => x.tiendas);
  const pc = ts.filter((x) => x.cuenta.toLowerCase() === 'pcel'); assert.equal(pc.length, 1, 'sin Matriz duplicada'); assert.equal(pc[0].nombreCuenta, 'PC Electrónica');
  const kb = ts.find((x) => x.cuenta === 'Kabik' && x.sucursal === 'Matriz'); assert.ok(kb); assert.equal(kb.importe, 300, 'cuentaMes en MAYÚSCULAS suma');
});

test('(4.12.44) reuniones y presencia leen fechas de Postgres con zona corta, espacio y microsegundos', () => {
  const h = new Date('2026-11-25T11:00:00');
  const u = (s) => { const t = new Date(s); return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  const ag = reunionesDelDia([{ id: 1, titulo: 'A', fecha: '2026-11-25T16:00:00+00' }, { id: 2, titulo: 'B', fecha: '2026-11-25 10:30:00' }, { id: 3, titulo: 'C', fecha: '2026-11-25 09:00:00.123456+0000' }, { id: 4, titulo: 'D', fecha: '2026-11-25T08:00Z' }], h);
  assert.equal(ag.length, 4, 'ninguna se pierde');
  const por = Object.fromEntries(ag.map((r) => [r.titulo, r.hora]));
  assert.equal(por.A, u('2026-11-25T16:00:00Z')); assert.equal(por.B, '10:30'); assert.equal(por.C, u('2026-11-25T09:00:00.123Z')); assert.equal(por.D, u('2026-11-25T08:00:00Z'));
  assert.equal(ag.find((r) => r.titulo === 'B').estado, 'en curso');
  const ps = presenciaPersonas([{ id: 'u1' }], [{ id: 9, titulo: 'Junta', fecha: '2026-11-25 10:30:00', duracion_min: 60, creado_por: 'u1' }], [], h);
  assert.equal(ps[0].presencia.estado, 'reunion');
  assert.deepEqual(reunionesDelDia([{ fecha: '2026-11-25 25:99' }, { fecha: '2026-11-25T10:00:00+99' }], h), []);
});

test('(4.12.46) tonoCartera y tonoCuota leen el porcentaje en texto con «%»', () => {
  assert.equal(tonoCartera(100, '12 %'), 'ambar'); assert.equal(tonoCartera(100, '12%'), 'ambar'); assert.equal(tonoCartera(100, '40 %'), 'rojo');
  assert.equal(tonoCartera(100, '%'), 'rojo'); assert.equal(tonoCartera(0, '40 %'), 'verde');
  assert.equal(tonoCuota('70%'), 'ambar'); assert.equal(tonoCuota('120 %'), 'verde'); assert.equal(tonoCuota('90%'), null); assert.equal(tonoCuota('%'), null);
});

test('(4.12.47) la bitácora dice qué fuente se actualizó', () => {
  const cat = [{ key: 'erp_inventario', titulo: 'Inventario ERP' }, { key: 'erp_sell_in', titulo: 'Ventas ERP (facturación)' }, null];
  assert.equal(fuenteSync({ status_key: 'erp_inventario' }, cat), 'Inventario ERP');
  assert.equal(fuenteSync({ status_key: ' ERP_SELL_IN ' }, cat), 'Ventas ERP (facturación)');
  assert.equal(fuenteSync({ status_key: 'otra' }, cat), ''); assert.equal(fuenteSync({ status_key: {} }, cat), '');
  assert.equal(fuenteSync(null, cat), ''); assert.equal(fuenteSync({ status_key: 'erp_inventario' }, 'x'), '');
  assert.equal(fuenteSync({ status_key: 'roadmap' }, [{ statusKey: 'roadmap', titulo: 'Roadmap' }]), 'Roadmap');
  assert.deepEqual(textoSync('success', 'Inventario ERP'), { icono: '🔄', texto: 'Se actualizaron los datos · Inventario ERP' });
  assert.deepEqual(textoSync('warning', 'Inventario ERP'), { icono: '🔄', texto: 'Se actualizaron los datos · Inventario ERP · con avisos' });
  assert.deepEqual(textoSync('error', ' Precios ERP '), { icono: '⚠️', texto: 'Falló una actualización de datos · Precios ERP' });
  assert.equal(textoSync('success', {}).texto, 'Se actualizaron los datos');
  // 4.12.106: cancelada / omitida no es actualización; en cola cuenta como en curso.
  assert.deepEqual(textoSync('cancelled', 'Inventario ERP'), { icono: '⏸️', texto: 'Se canceló una actualización de datos · Inventario ERP' });
  for (const s of ['CANCELED', ' Cancelado ', 'skipped', 'omitida', 'stopped']) assert.equal(textoSync(s).texto, 'Se canceló una actualización de datos', s);
  for (const s of ['queued', 'En cola', 'esperando', 'PENDIENTE']) assert.equal(textoSync(s).texto, 'Actualizando los datos', s);
  const ev = bitacoraEventos({ ultimaSync: { status: 'error', fuente: 'Precios ERP', created_at: '2026-10-08T10:00:00' } }, new Date('2026-10-08T12:00:00'));
  assert.ok(comoLista(ev).some((e) => e.id === 'sync' && e.texto === 'Falló una actualización de datos · Precios ERP'));
});

test('cadenaSuministro(): el puerto sólo dice lo que hay (sin «0 con ETA vencida»)', () => {
  const v = (barcos, tarimas) => cadenaSuministro({ puerto: { barcos, tarimas } }, '2026-11-25').tramos.find((x) => x.clave === 'puerto').volumen;
  assert.equal(v([], [{}]), '1 recién llegado');
  assert.equal(v([{ llegaEnDias: -1 }], []), '1 con ETA vencida');
  assert.equal(v([{ llegaEnDias: 0 }], [{}, {}]), '1 llega hoy · 2 recién llegados');
  assert.equal(v([], []), 'Sin movimiento');
});

test('numero / cifraCorta / pesosCorto: negativos contables entre paréntesis (4.12.53)', () => {
  assert.equal(numero('(1,500)'), -1500); assert.equal(numero(' $(2,000.5) '), -2000.5); assert.equal(numero('( 300 )'), -300);
  assert.equal(numero('()'), 0); assert.equal(numero('(-5)'), 0); assert.equal(numero('(abc)'), 0); assert.equal(numero('1,200'), 1200);
  assert.equal(cifraCorta('(15,400)'), '-15 K'); assert.equal(pesosCorto('$(1,250,000)'), '-$1.3 M'); assert.equal(cifraCorta('()'), '0');
});

test('esClase / oficina: tipo y estado sin importar mayúsculas, acentos ni espacios (4.12.54)', () => {
  assert.equal(esClase(' Viaje ', 'viaje'), true); assert.equal(esClase('HECHA', 'abierta', 'hecha'), true); assert.equal(esClase('', ''), false);
  assert.equal(esClase(null, 'viaje'), false); assert.equal(esClase('reunión', 'reunion'), true); assert.equal(esClase('viajes', 'viaje'), false);
  const base = construirModelo(d, hoy).oficina;
  const d2 = { ...d, perfiles: d.perfiles.map((p) => ({ ...p, tipo: p.tipo === 'externo' ? ' EXTERNO ' : p.tipo })),
    agendaHoy: d.agendaHoy.map((it) => ({ ...it, estado: ` ${it.estado.toUpperCase()} ` })), reunionesHoy: [...d.reunionesHoy, { id: 'v', titulo: 'Viaje MTY', fecha: '2026-10-05T08:00:00', tipo: 'Viaje' }] };
  const o = construirModelo(d2, hoy).oficina;
  assert.equal(o.personas.length, base.personas.length, '« EXTERNO » sigue fuera');
  assert.deepEqual(o.personas.map((p) => [p.pendientes, p.hechas]), base.personas.map((p) => [p.pendientes, p.hechas]));
  assert.equal(o.reuniones, base.reuniones, 'el viaje en «Viaje» no cuenta como reunión');
});

test('tarjetaDe: persona con conteos negativos cuenta 0, como su globo (4.12.55)', () => {
  const t = tarjetaDe({ tipo: 'persona', persona: { nombre: 'A', pendientes: '-3', hechas: -2 } }, {});
  assert.deepEqual(t.numeros, [['Pendientes hoy', '0'], ['Hechas', '0']]);
  assert.equal(t.estado, 'verde');
  const t2 = tarjetaDe({ tipo: 'persona', persona: { nombre: 'A', pendientes: 2, hechas: -5 } }, {});
  assert.deepEqual(t2.numeros, [['Pendientes hoy', '2'], ['Hechas', '0']]);
  assert.equal(t2.estado, 'ambar');
});

test('claveTexto(): texto sin espacios, números finitos como texto y lo demás vacío (4.12.56)', () => {
  assert.equal(claveTexto(' ct '), 'ct'); assert.equal(claveTexto('CT'), 'CT', 'no cambia mayúsculas (eso es claveSku)');
  assert.equal(claveTexto(10), '10'); assert.equal(claveTexto(0), '0'); assert.equal(claveTexto(-0), '0'); assert.equal(claveTexto(1.5), '1.5');
  for (const x of [null, undefined, '', '   ', NaN, Infinity, -Infinity, true, false, {}, [], ['ct']]) assert.equal(claveTexto(x), '', JSON.stringify(x));
});

test('Días de inventario: bordes del semáforo «Días de Inv» de Inicio (< 30 rojo, > 120 ámbar) con días redondeados (4.12.56)', () => {
  const caso = (v, estado, tono, motivo) => { assert.equal(estadoDias(v), estado, `estado ${v}`); assert.equal(tonoDias(v), tono, `tono ${v}`); assert.equal(motivoDias(v), motivo, `motivo ${v}`); };
  caso(0, 'critico', 'rojo', 'Sólo 0 días de inventario');
  caso(29, 'critico', 'rojo', 'Sólo 29 días de inventario');
  caso(29.6, 'sano', 'verde', null); // se redondea a 30 antes del semáforo, igual que el texto «30 días»
  caso(30, 'sano', 'verde', null); caso(120, 'sano', 'verde', null); caso(120.4, 'sano', 'verde', null);
  caso(121, 'sobre', 'ambar', '121 días de inventario (alto)');
  caso(' 200 ', 'sobre', 'ambar', '200 días de inventario (alto)'); caso('1,200', 'sobre', 'ambar', '1,200 días de inventario (alto)');
  assert.equal(diasTexto(29.6), '30 días'); assert.equal(diasTexto(1), '1 día');
  for (const x of [-5, null, undefined, '', '  ', NaN, 'abc', true, {}, []]) { caso(x, null, null, null); assert.equal(diasTexto(x), 'sin medida de días', JSON.stringify(x)); }
});

test('4.12.59 haceDias(): desde 60 d en meses y desde 365 en años', () => {
  assert.equal(haceDias(59), 'hace 59 d'); assert.equal(haceDias(60), 'hace 2 meses');
  assert.equal(haceDias(91), 'hace 3 meses'); assert.equal(haceDias(350), 'hace 11 meses'); assert.equal(haceDias(364), 'hace 11 meses');
  assert.equal(haceDias(365), 'hace 1 año'); assert.equal(haceDias(800), 'hace 2 años'); assert.equal(haceDias(365000), 'hace 1,000 años');
});

test('4.12.60 unirTexto(): «NULL», «Null», «nan», «#N/A» del ERP/hojas no salen en el globo', () => {
  assert.equal(unirTexto('NULL', '820 pz', 'Null', 'nan', 'Infinity', '#N/A', 'None', 'llega hoy'), '820 pz · llega hoy');
  assert.equal(unirTexto('Nullo', 'NaNa'), 'Nullo · NaNa');
});

test('4.12.61 faltanDias(): mañana / en N d / en N meses / en N años; pasado = hoy; ilegible → vacío', () => {
  assert.equal(faltanDias(0), 'hoy'); assert.equal(faltanDias(-4), 'hoy'); assert.equal(faltanDias(1), 'mañana'); assert.equal(faltanDias(3), 'en 3 d');
  assert.equal(faltanDias(59), 'en 59 d'); assert.equal(faltanDias(60), 'en 2 meses'); assert.equal(faltanDias(364), 'en 11 meses');
  assert.equal(faltanDias(400), 'en 1 año'); assert.equal(faltanDias('1,200'), 'en 3 años');
  for (const x of [null, undefined, '', ' ', NaN, 'abc', Infinity, true, {}, []]) assert.equal(faltanDias(x), '');
});

test('4.12.62 llegaBarco(): meses y años desde 60 días, adelante y tarde', () => {
  assert.equal(llegaBarco(59), 'llega en 59 d'); assert.equal(llegaBarco(60), 'llega en 2 meses'); assert.equal(llegaBarco(200), 'llega en 7 meses');
  assert.equal(llegaBarco(365), 'llega en 1 año'); assert.equal(llegaBarco(-59), '59 d tarde'); assert.equal(llegaBarco(-90), '3 meses tarde');
  assert.equal(llegaBarco(-400), '1 año tarde'); assert.equal(llegaBarco(-800), '2 años tarde'); assert.equal(llegaBarco(-1), '1 d tarde');
});

test('4.12.63 enMinutos(): desde 24 h en días y desde 60 días en meses/años', () => {
  assert.equal(enMinutos(1439), 'en 23 h 59 min'); assert.equal(enMinutos(1440), 'en 1 d'); assert.equal(enMinutos(60 * 48), 'en 2 d');
  assert.equal(enMinutos(1440 * 59), 'en 59 d'); assert.equal(enMinutos(1440 * 90), 'en 3 meses'); assert.equal(enMinutos(1440 * 400), 'en 1 año');
});

test('4.12.66 cadenaSuministro(): tramos vacíos dicen «Sin …» en vez de ceros', () => {
  const t = Object.fromEntries(cadenaSuministro({ puerto: { barcos: [] }, cedis: { dias: 10 }, camiones: [], distritos: [] }, '2026-11-25').tramos.map((x) => [x.clave, x.volumen]));
  assert.equal(t.mar, 'Sin barcos en el mar'); assert.equal(t.camion, 'Sin camiones en ruta'); assert.equal(t.tienda, 'Sin tiendas'); assert.equal(t.cliente, 'Sin clientes finales');
  const u = Object.fromEntries(cadenaSuministro({ distritos: [{ tiendas: [{ vendio: false }] }] }, '2026-11-25').tramos.map((x) => [x.clave, x.volumen]));
  assert.equal(u.tienda, '0 de 1 vendieron');
});

test('4.12.67: misión «Descargar» y arribo de la bitácora sin «· 0 pz»; reunión sin hora no entra a la bitácora', () => {
  assert.equal(piezasSiHay(1200), '1,200 pz'); assert.equal(piezasSiHay(' 5 '), '5 pz');
  for (const x of [0, 0.4, -3, null, '', 'abc', NaN]) assert.equal(piezasSiHay(x), '');
  const h = new Date('2026-11-26T11:00:00');
  const mis = misionesDelDia({ puerto: { tarimas: [{ id: 'C1' }, { id: 'C2', piezas: 40 }] } }, h).map((x) => x.texto);
  assert.deepEqual(mis, ['Descargar C1', 'Descargar C2 · 40 pz']);
  const b = bitacoraEventos({ hoyIso: '2026-11-26', puerto: { barcos: [{ id: 'B1', arribo: '2026-11-25' }] },
    oficina: { agenda: [{ titulo: 'Sin hora', hora: '', ini: null, estado: 'próxima' }, { titulo: 'Junta', hora: '09:00', ini: 540, estado: 'hecha' }] } }, h).map((x) => x.texto);
  assert.deepEqual(b, ['Fue Junta', 'Llegó B1 al CEDIS']);
});

test('4.12.81 duración de reunión en texto con unidad y viaje con fechas al revés', () => {
  const fin = (d) => reunionesDelDia([{ titulo: 'J', fecha: '2026-11-26T09:00:00', duracion_min: d }], new Date(2026, 10, 26, 8, 0))[0].fin - 540;
  assert.equal(fin(45), 45); assert.equal(fin(' 45 '), 45); assert.equal(fin('90 min'), 90); assert.equal(fin('90min'), 90); assert.equal(fin('1 h'), 60);
  assert.equal(fin('1.5 h'), 90); assert.equal(fin('1,5 horas'), 90); assert.equal(fin('1:30'), 90); assert.equal(fin('2 hrs'), 120);
  for (const x of [null, '', 'abc', -30, 0, '0 min', '-5', {}, [], NaN]) assert.equal(fin(x), 60);
  const h = new Date(2026, 10, 26, 10, 0);
  const est = (v) => presenciaPersonas([{ id: 'a' }], [], [{ tipo: 'viaje', creado_por: 'a', ...v }], h)[0].presencia.estado;
  assert.equal(est({ fecha: '2026-11-28', fecha_fin: '2026-11-24' }), 'viaje');
  assert.equal(est({ fecha: '2026-11-24', fecha_fin: '2026-11-28' }), 'viaje');
  assert.equal(est({ fecha: '2026-11-28', fecha_fin: '2026-11-27' }), 'disponible');
  assert.equal(est({ fecha: '2026-11-26', fecha_fin: 'basura' }), 'viaje');
  assert.equal(est({ fecha: null, fecha_fin: '2026-11-26' }), 'disponible');
  assert.equal(presenciaPersonas([{ id: 'a' }], [{ fecha: '2026-11-26T09:00:00', duracion_min: '90 min', creado_por: 'a' }], [], new Date(2026, 10, 26, 10, 15))[0].presencia.estado, 'reunion');
});

test('4.12.82: cifras con unidad al final en texto', async () => {
  const M = await import('../src/modules/ciudad/modelo.js');
  assert.equal(M.numero('3 días'), 3); assert.equal(M.numero('45 d'), 45); assert.equal(M.numero('1 200 pz'), 1200); assert.equal(M.numero('$5,000 MXN'), 5000);
  assert.equal(M.numero('(1,500) pesos'), -1500); assert.equal(M.numero('12 Piezas.'), 12); assert.equal(M.numero('1 día'), 1);
  for (const mal of ['días', 'pz', 'd', '°C', 'abc d', '3 dólares']) assert.equal(M.numero(mal), 0, mal);
  assert.equal(M.dsoTexto('45 días'), 'DSO 45 días'); assert.equal(M.temperaturaTexto('24 °C'), '24°'); assert.equal(M.temperaturaTexto('-3°'), '-3°');
  assert.equal(M.piezasTexto('1,200 pz'), '1,200 pz'); assert.equal(M.cifraCorta('1,500,000 pz'), '1.5 M');
  assert.equal(M.llegaBarco('3 días'), 'llega en 3 d'); assert.equal(M.llegaBarco(' 1 d '), 'llega mañana'); assert.equal(M.llegaBarco('1,200'), 'llega en 3 años');
  assert.equal(M.llegaBarco('días'), 'sin ETA'); assert.equal(M.llegaBarco('-2 d'), '2 d tarde');
});

test('nombreSucursal: abreviaturas del ERP (4.12.85)', () => {
  assert.equal(nombreSucursal('PLAZA CD. JUAREZ'), 'Plaza Ciudad Juárez');
  assert.equal(nombreSucursal('PLAZA GRAL.ESCOBEDO'), 'Plaza General Escobedo');
  assert.equal(nombreSucursal('SN PEDRO'), 'San Pedro');
  assert.equal(nombreSucursal('STA. CATARINA CENTRO'), 'Santa Catarina Centro');
  assert.equal(nombreSucursal('CEDIS CD'), 'Cedis CD');
  assert.equal(nombreSucursal('GDL CD'), 'GDL CD');
  assert.equal(nombreSucursal('Cd. Juárez'), 'Cd. Juárez');
});

test('4.12.87 enMinutos() lee la unidad de minutos y texto con miles', () => {
  assert.equal(enMinutos('15 min'), 'en 15 min'); assert.equal(enMinutos('90 minutos'), 'en 1 h 30 min'); assert.equal(enMinutos(' 5 mins. '), 'en 5 min');
  assert.equal(enMinutos('1 minuto'), 'en 1 min'); assert.equal(enMinutos('0 min'), 'empieza ya'); assert.equal(enMinutos('1,500'), 'en 1 d');
  for (const x of ['min', '-3 min', 'x min', '  ', true, false]) assert.equal(enMinutos(x), '');
  assert.equal(enMinutos('15 h'), 'en 15 h'); // 4.12.91: las horas ya se leen
});

test('4.12.88 nombreSucursal(): abreviaturas de domicilio en minúscula', () => {
  assert.equal(nombreSucursal('PCEL SUC. GUADALAJARA CENTRO'), 'Pcel Suc. Guadalajara Centro'); assert.equal(nombreSucursal('PCEL SUC ZAPOPAN'), 'Pcel Suc Zapopan');
  assert.equal(nombreSucursal('OFFICE DEPOT AV. VALLARTA NO. 123'), 'Office Depot Av. Vallarta No. 123'); assert.equal(nombreSucursal('BLVD AGUA CALIENTE KM 5'), 'Blvd Agua Caliente km 5');
  assert.equal(nombreSucursal('SUC.CENTRO'), 'Suc. Centro'); assert.equal(nombreSucursal('COL. CENTRO CDMX'), 'Col. Centro CDMX');
  assert.equal(nombreSucursal('NO HAY'), 'No Hay'); assert.equal(nombreSucursal('PLAZA CD. JUAREZ'), 'Plaza Ciudad Juárez'); assert.equal(nombreSucursal('S.A. DE C.V.'), 'S.A. de C.V.');
  assert.equal(nombreSucursal('Pcel SUC. Centro'), 'Pcel SUC. Centro'); // con minúsculas se respeta tal cual
});

test('porcentaje(): negativo contable entre paréntesis (4.12.90)', () => {
  assert.equal(porcentaje('(12 %)'), '-12 %'); assert.equal(porcentaje('(3.6)'), '-4 %'); assert.equal(porcentaje(' (1,250%) '), '-1,250 %');
  assert.equal(porcentaje('(12 %)', { signo: true }), '-12 %'); assert.equal(porcentaje('()'), '—'); assert.equal(porcentaje('(-5)'), '—'); assert.equal(porcentaje('(abc)'), '—');
  assert.equal(porcentaje('12 %'), '12 %'); assert.equal(porcentaje('-0.4'), '0 %'); assert.equal(porcentaje('  '), '—');
});

test('enMinutos(): horas en texto (4.12.91)', () => {
  assert.equal(enMinutos('2 h'), 'en 2 h'); assert.equal(enMinutos('1.5 horas'), 'en 1 h 30 min'); assert.equal(enMinutos('2 hrs.'), 'en 2 h');
  assert.equal(enMinutos('1 hora'), 'en 1 h'); assert.equal(enMinutos('1 h 30 min'), 'en 1 h 30 min'); assert.equal(enMinutos('1 hora y 5 minutos'), 'en 1 h 5 min');
  assert.equal(enMinutos('1:30'), 'en 1 h 30 min'); assert.equal(enMinutos('0:00'), 'empieza ya'); assert.equal(enMinutos('1:75'), ''); assert.equal(enMinutos('h'), '');
  assert.equal(enMinutos('15 min'), 'en 15 min'); assert.equal(enMinutos('1,500'), 'en 1 d'); assert.equal(enMinutos('48 h'), 'en 2 d');
});

test('4.12.92 enMinutos(): formas compactas «1h30», «1:30 h» y «90 m»', () => {
  assert.equal(enMinutos('1h30'), 'en 1 h 30 min'); assert.equal(enMinutos('1h30m'), 'en 1 h 30 min'); assert.equal(enMinutos('2 h 5 m'), 'en 2 h 5 min');
  assert.equal(enMinutos('1:30 h'), 'en 1 h 30 min'); assert.equal(enMinutos('1:30 hrs'), 'en 1 h 30 min'); assert.equal(enMinutos('90 m'), 'en 1 h 30 min');
  assert.equal(enMinutos('45m'), 'en 45 min'); assert.equal(enMinutos('1h75'), ''); assert.equal(enMinutos('m'), ''); assert.equal(enMinutos('1 h 30 min'), 'en 1 h 30 min');
  assert.equal(enMinutos('1,5 h'), 'en 1 h 30 min'); assert.equal(enMinutos('1,5 horas'), 'en 1 h 30 min'); assert.equal(enMinutos('media hora'), 'en 30 min');
  assert.equal(enMinutos('1 hora y media'), 'en 1 h 30 min'); assert.equal(enMinutos('2 horas y cuarto'), 'en 2 h 15 min'); assert.equal(enMinutos('1 h y tres cuartos'), 'en 1 h 45 min');
  assert.equal(enMinutos('01:30:00'), 'en 1 h 30 min'); assert.equal(enMinutos('00:45:40'), 'en 46 min'); assert.equal(enMinutos('1:75:00'), ''); assert.equal(enMinutos('y media'), '');
  assert.equal(enMinutos('en 15 minutos'), 'en 15 min'); assert.equal(enMinutos('dentro de una hora'), 'en 1 h'); assert.equal(enMinutos('faltan dos horas y media'), 'en 2 h 30 min');
  assert.equal(enMinutos('aprox. 20 min'), 'en 20 min'); assert.equal(enMinutos('un cuarto de hora'), 'en 15 min'); assert.equal(enMinutos('tres cuartos de hora'), 'en 45 min');
  assert.equal(enMinutos('empieza en 5 min'), 'en 5 min'); assert.equal(enMinutos('media hora'), 'en 30 min'); assert.equal(enMinutos('una'), ''); assert.equal(enMinutos('en'), '');
});
test('4.12.94: coma decimal en texto', async () => {
  const M = await import('../src/modules/ciudad/modelo.js');
  assert.equal(M.numero('24,5'), 24.5); assert.equal(M.numero('-3,2'), -3.2); assert.equal(M.numero('$1,50'), 1.5); assert.equal(M.numero('(1,5)'), -1.5);
  assert.equal(M.numero('12,5%'), 12.5); assert.equal(M.numero('45,5 días'), 45.5); assert.equal(M.numero('0,45'), 0.45);
  assert.equal(M.numero('1,200'), 1200, 'miles siguen'); assert.equal(M.numero('1,234,567'), 1234567); assert.equal(M.numero('$5,000 MXN'), 5000);
  assert.equal(M.temperaturaTexto('24,5'), '25°'); assert.equal(M.temperaturaTexto('-3,2'), '-3°'); assert.equal(M.dsoTexto('45,5'), 'DSO 46 días');
});

test('numero / cifraCorta: montos abreviados «1.2M», «2.5K», «3 mil», «1.5 millones», «MXN 5,000» (4.12.95)', () => {
  assert.equal(numero('1.2M'), 1200000); assert.equal(numero('$1.5 M'), 1500000); assert.equal(numero('2.5K'), 2500); assert.equal(numero('-2.5k'), -2500);
  assert.equal(numero('3 mil'), 3000); assert.equal(numero('1.5 millones'), 1500000); assert.equal(numero('1 millón'), 1000000); assert.equal(numero('4 MDP'), 4000000);
  assert.equal(numero('4.35MM'), 4350000, 'sin error de punto flotante'); assert.equal(numero('(1,5 M)'), -1500000); assert.equal(numero('MXN 5,000'), 5000);
  assert.equal(numero('90 m'), 0, 'm minúscula sola no es millón'); assert.equal(numero('M'), 0); assert.equal(numero('k'), 0); assert.equal(numero('1e6'), 1000000);
  assert.equal(cifraCorta('1.2M'), '1.2 M'); assert.equal(pesosCorto('$2.5K'), '$3 K'); assert.equal(numero('1,200'), 1200, 'miles siguen');
});

test('4.12.96: plural() lee el número en texto con unidad, «$» y «K»', () => {
  assert.equal(plural('3 días', 'día'), '3 días'); assert.equal(plural('12 pz', 'pieza'), '12 piezas'); assert.equal(plural('1.2 K', 'pedido'), '1,200 pedidos');
  assert.equal(plural('$1,200', 'peso'), '1,200 pesos'); assert.equal(plural('1 día', 'día'), '1 día'); assert.equal(plural('abc', 'tienda'), '0 tiendas');
  assert.equal(plural('  ', 'día'), '0 días'); assert.equal(plural('1,200', 'pedido'), '1,200 pedidos'); assert.equal(plural('-0.2', 'día'), '0 días');
});
test('4.12.100: contenedorCerrado() reconoce concluido/cancelado/cerrado en femenino, acentos y guiones', () => {
  for (const s of ['CONCLUIDO', 'Concluida', 'cancelado', 'CANCELADA', 'Cerrado', 'cerrada', ' CANCELADO ', 'PO_CANCELADA', 'Concluídos']) assert.equal(contenedorCerrado(s), true, s);
  for (const s of ['TRANSITO MARITIMO', 'EN PUERTO', '', null, undefined, 42, 'PROXIMO A ZARPAR', 'CERRADURA', 'INCONCLUIDO']) assert.equal(contenedorCerrado(s), false, String(s));
  const m = construirModelo({ contenedores: [
    { contenedor: 'A1', estatus: 'Cancelada', eta_puerto: '2026-12-05' },
    { contenedor: 'B2', estatus: 'Concluida', eta_puerto: '2026-12-05' },
    { contenedor: 'C3', estatus: 'TRANSITO MARITIMO', eta_puerto: '2026-12-05' },
  ] }, new Date('2026-11-27T12:00:00'));
  assert.deepEqual(m.puerto.barcos.map((b) => b.id), ['C3']);
});

test('4.12.102: nombreSucursal()/nombreCiudad() capitalizan tras paréntesis, comillas, «_» y «/»', () => {
  assert.equal(nombreSucursal('LIVERPOOL (PERISUR)'), 'Liverpool (Perisur)'); assert.equal(nombreCiudad('LIVERPOOL (PERISUR)'), 'Liverpool (Perisur)');
  assert.equal(nombreSucursal('(GDL) PLAZA'), '(GDL) Plaza'); assert.equal(nombreSucursal('"LA GRAN PLAZA"'), '"La Gran Plaza"');
  assert.equal(nombreSucursal('CYBERPUERTA_GDL'), 'Cyberpuerta_GDL'); assert.equal(nombreSucursal('PLAZA DEL SOL / GDL'), 'Plaza del Sol / GDL');
  assert.equal(nombreSucursal('MERIDA, YUC.'), 'Mérida, YUC.'); assert.equal(nombreSucursal('OFFICE DEPOT (S.A. DE C.V.)'), 'Office Depot (S.A. de C.V.)');
  assert.equal(nombreCiudad('OFFICE DEPOT (S.A. DE C.V.)'), 'Office Depot (S.A. de C.V.)'); assert.equal(nombreCiudad('MERIDA, YUC.'), 'Mérida, Yuc.');
  assert.equal(nombreCiudad('SAN LUIS POTOSI, S.L.P.'), 'San Luis Potosí, S.L.P.'); assert.equal(nombreSucursal('SAMS CLUB - LEON GTO'), 'Sams Club - León Gto');
});

test('nombreCiudad: conserva la eñe y los acentos del original (4.12.103)', () => {
  assert.equal(nombreCiudad('CAÑADA'), 'Cañada'); assert.equal(nombreCiudad('LA MONTAÑA'), 'La Montaña');
  assert.equal(nombreCiudad('PEÑA DE BERNAL'), 'Peña de Bernal'); assert.equal(nombreCiudad('peñón de los baños'), 'Peñón de los Baños');
  assert.equal(nombreCiudad('CANADA'), 'Canada'); // sin ñ en el original no se adivina
  assert.equal(nombreCiudad('MÉRIDA'), 'Mérida'); assert.equal(nombreCiudad('CD. JUÁREZ'), 'Ciudad Juárez');
  assert.equal(nombreCiudad('Ciudad de México'), 'CDMX'); assert.equal(nombreCiudad('CD.OBREGÓN'), 'Ciudad Obregón');
  assert.equal(nombreCiudad('San Luis Potosí, S.L.P.'), 'San Luis Potosí, S.L.P.');
  assert.equal(nombreCiudad('CAN\u0303ADA'), 'Cañada'); // ñ descompuesta (NFD)
  assert.equal(nombreCiudad(123), ''); assert.equal(nombreCiudad(null), '');
});
test('nombreCiudad / nombreSucursal: plazas comunes con acento (4.12.103)', () => {
  assert.equal(nombreCiudad('GALERIAS GUADALAJARA'), 'Galerías Guadalajara'); assert.equal(nombreCiudad('PLAZA SATELITE'), 'Plaza Satélite');
  assert.equal(nombreSucursal('MULTIPLAZA ARAGON'), 'Multiplaza Aragón'); assert.equal(nombreSucursal('CANCUN MALECON'), 'Cancún Malecón');
  assert.equal(nombreSucursal('ALMACEN GENERAL'), 'Almacén General'); assert.equal(nombreSucursal('PLAZA JARDIN'), 'Plaza Jardín');
  assert.equal(nombreSucursal('Galerias GDL'), 'Galerias GDL'); // mixta se respeta
});
test('nombreCiudad / nombreSucursal: más municipios con acento (4.12.105)', () => {
  for (const [s, r] of [['EL MARQUES', 'El Marqués'], ['PARAISO', 'Paraíso'], ['MOROLEON', 'Moroleón'], ['TIZIMIN', 'Tizimín'],
    ['CUATRO CIENEGAS', 'Cuatro Ciénegas'], ['CIENEGA DE FLORES', 'Ciénega de Flores'], ['VILLA DE ALVAREZ', 'Villa de Álvarez'],
    ['EBANO', 'Ébano'], ['IZUCAR DE MATAMOROS', 'Izúcar de Matamoros'], ['ESCARCEGA', 'Escárcega'], ['EL MARQUÉS', 'El Marqués']]) assert.equal(nombreCiudad(s), r);
  assert.equal(nombreSucursal('PLAZA PASEO CHAMPOTON'), 'Plaza Paseo Champotón');
});

test('nombrePersona(): signos al inicio y siglas entre paréntesis (4.12.107)', () => {
  assert.equal(nombrePersona({ nombre: 'JUAN PÉREZ (JP)' }), 'Juan Pérez (JP)');
  assert.equal(nombrePersona({ nombre: 'ANA "LA JEFA" LÓPEZ' }), 'Ana "La Jefa" López');
  assert.equal(nombrePersona({ nombre: 'luis.garcía' }), 'Luis.García');
  assert.equal(nombrePersona({ nombre: 'MARÍA (VENTAS)' }), 'María (Ventas)');
  assert.equal(nombrePersona({ nombre: 'JOSÉ DE LA CRUZ' }), 'José de la Cruz');
  assert.equal(nombrePersona({ nombre: "ANA-MARÍA O'NEIL" }), "Ana-María O'Neil");
});

test('4.12.109: más unidades de conteo al final', async () => {
  const M = await import('../src/modules/ciudad/modelo.js');
  assert.equal(M.numero('1,500 pzs'), 1500); assert.equal(M.numero('1500 pcs'), 1500); assert.equal(M.numero('1500 pzs.'), 1500);
  assert.equal(M.numero('12 tiendas'), 12); assert.equal(M.numero('3 sucursales'), 3); assert.equal(M.numero('1 sucursal'), 1);
  assert.equal(M.numero('4 clientes'), 4); assert.equal(M.numero('5 cajas'), 5); assert.equal(M.numero('6 tarimas'), 6);
  assert.equal(M.numero('8 contenedores'), 8); assert.equal(M.numero('2 personas'), 2); assert.equal(M.numero('7 SKUs'), 7);
  assert.equal(M.numero('10 u'), 10); assert.equal(M.numero('5 días hábiles'), 5); assert.equal(M.numero('30 dias naturales'), 30);
  assert.equal(M.piezasTexto('1,500 pzs'), '1,500 pz'); assert.equal(M.plural('3 tiendas', 'tienda'), '3 tiendas');
  assert.equal(M.numero('tiendas'), 0); assert.equal(M.numero('pzs'), 0); assert.equal(M.numero('1.5 M'), 1500000); assert.equal(M.numero('3 mil'), 3000);
});

test('4.12.111: leeDias() con cantidades en palabras', () => {
  assert.equal(llegaBarco('una semana'), 'llega en 7 d'); assert.equal(llegaBarco('UNA SEMANA'), 'llega en 7 d'); assert.equal(haceDias('Un mes'), 'hace 30 d');
  assert.equal(faltanDias('medio año'), 'en 6 meses'); assert.equal(llegaBarco('dos semanas'), 'llega en 14 d'); assert.equal(haceDias('tres días'), 'hace 3 d');
  assert.equal(llegaBarco('un día'), 'llega mañana'); assert.equal(faltanDias('doce meses'), 'en 1 año'); assert.equal(llegaBarco('media semana'), 'llega en 4 d');
  assert.equal(llegaBarco('una'), 'sin ETA'); assert.equal(haceDias('uno'), ''); assert.equal(llegaBarco('unas semanas'), 'sin ETA');
});

test('4.12.112: leeDias() con «y medio/a»', () => {
  assert.equal(llegaBarco('2 semanas y media'), 'llega en 18 d'); assert.equal(haceDias('una semana y media'), 'hace 11 d');
  assert.equal(faltanDias('3 días y medio'), 'en 4 d'); assert.equal(llegaBarco('un año y medio'), 'llega en 1 año'); assert.equal(haceDias('dos meses y medio'), 'hace 3 meses');
  assert.equal(llegaBarco('y medio'), 'sin ETA'); assert.equal(llegaBarco('1 y medio'), 'sin ETA');
});

test('4.12.113: leeDias() con rangos y horas', () => {
  assert.equal(llegaBarco('3-5 días'), 'llega en 5 d'); assert.equal(llegaBarco('15–20 dias'), 'llega en 20 d'); assert.equal(llegaBarco('3 a 5 semanas'), 'llega en 35 d');
  assert.equal(haceDias('5-3 días'), 'hace 5 d'); assert.equal(llegaBarco('48 horas'), 'llega en 2 d'); assert.equal(llegaBarco('24 h'), 'llega mañana');
  assert.equal(haceDias('72 hrs'), 'hace 3 d'); assert.equal(llegaBarco('1-2'), 'llega en 2 d'); assert.equal(llegaBarco('-3'), '3 d tarde');
  assert.equal(llegaBarco('horas'), 'sin ETA'); assert.equal(llegaBarco('3 - '), 'sin ETA');
});

test('4.12.114: leeDias() con aproximaciones', () => {
  assert.equal(llegaBarco('~5 días'), 'llega en 5 d'); assert.equal(llegaBarco('aprox. 10 días'), 'llega en 10 d'); assert.equal(haceDias('aprox 10 dias'), 'hace 10 d');
  assert.equal(llegaBarco('≈ 3 semanas'), 'llega en 21 d'); assert.equal(llegaBarco('unos 5 días'), 'llega en 5 d'); assert.equal(haceDias('cerca de 4 días'), 'hace 4 d');
  assert.equal(llegaBarco('5 días aprox.'), 'llega en 5 d'); assert.equal(llegaBarco('aproximadamente una semana'), 'llega en 7 d'); assert.equal(llegaBarco('unas semanas'), 'sin ETA');
  assert.equal(llegaBarco('aprox.'), 'sin ETA'); assert.equal(llegaBarco('~'), 'sin ETA');
});

test('4.12.115: leeDias() con «en», «dentro de», «faltan»', () => {
  assert.equal(llegaBarco('en 5 días'), 'llega en 5 d'); assert.equal(llegaBarco('dentro de 2 semanas'), 'llega en 14 d'); assert.equal(llegaBarco('faltan 3 días'), 'llega en 3 d');
  assert.equal(llegaBarco('llega en una semana'), 'llega en 7 d'); assert.equal(llegaBarco('en aprox. 10 días'), 'llega en 10 d'); assert.equal(llegaBarco('Falta 1 día'), 'llega mañana');
  assert.equal(llegaBarco('en'), 'sin ETA'); assert.equal(llegaBarco('en camino'), 'sin ETA'); assert.equal(llegaBarco('dentro de'), 'sin ETA');
});
test('4.12.118: signo menos tipográfico (−, –, —, －) en números de texto', () => {
  assert.equal(numero('−12'), -12); assert.equal(numero('–5'), -5); assert.equal(numero('— 3,5'), -3.5); assert.equal(numero('－7'), -7);
  assert.equal(porcentaje('−12 %'), '-12 %'); assert.equal(porcentaje('−8', { signo: true }), '-8 %'); assert.equal(cifraCorta('−1.5 M'), '-1.5 M');
  assert.equal(temperaturaTexto('−3 °C'), '-3°'); assert.equal(numero('5–10'), 0); assert.equal(numero('1,200'), 1200);
});
test('4.12.119: haceDias() con «hace», «atrás», «de antigüedad»', () => {
  assert.equal(haceDias('hace 3 días'), 'hace 3 d'); assert.equal(haceDias('3 días atrás'), 'hace 3 d'); assert.equal(haceDias('Desde hace 2 semanas'), 'hace 14 d');
  assert.equal(haceDias('hace una semana'), 'hace 7 d'); assert.equal(haceDias('2 meses de antiguedad'), 'hace 2 meses'); assert.equal(haceDias('hace 1 día'), 'ayer');
  assert.equal(haceDias('hace'), ''); assert.equal(haceDias('atrás'), ''); assert.equal(haceDias('hace mucho'), ''); assert.equal(faltanDias('en 2 semanas'), 'en 14 d');
});

test('4.12.120 días relativos, quincenas y números en palabras hasta sesenta', () => {
  assert.equal(haceDias('ayer'), 'ayer'); assert.equal(haceDias('Antier'), 'hace 2 d'); assert.equal(haceDias('anteayer.'), 'hace 2 d');
  assert.equal(haceDias('antes de ayer'), 'hace 2 d'); assert.equal(haceDias('hoy'), 'hoy'); assert.equal(haceDias('mañana'), 'hoy');
  assert.equal(faltanDias('hoy'), 'hoy'); assert.equal(faltanDias('Mañana'), 'mañana'); assert.equal(faltanDias('pasado mañana'), 'en 2 d');
  assert.equal(llegaBarco('mañana'), 'llega mañana'); assert.equal(llegaBarco('HOY'), 'llega hoy'); assert.equal(llegaBarco('manana'), 'llega mañana');
  assert.equal(faltanDias('ayer'), ''); assert.equal(llegaBarco('antier'), 'sin ETA');
  assert.equal(faltanDias('una quincena'), 'en 15 d'); assert.equal(haceDias('2 quincenas'), 'hace 30 d'); assert.equal(llegaBarco('quincena'), 'sin ETA');
  assert.equal(faltanDias('quince días'), 'en 15 d'); assert.equal(haceDias('hace treinta días'), 'hace 30 d'); assert.equal(llegaBarco('en veinte días'), 'llega en 20 d');
  assert.equal(faltanDias('sesenta días'), 'en 2 meses');
  assert.equal(enMinutos('quince minutos'), enMinutos('15 min')); assert.equal(enMinutos('veinte min'), enMinutos(20));
});

test('4.12.124 apóstrofo y guion bajo como separador de miles', () => {
  assert.equal(numero("1'200,000"), 1200000); assert.equal(numero('1’200.50'), 1200.5); assert.equal(numero('1_200_000'), 1200000);
  assert.equal(numero("1'234'567"), 1234567); assert.equal(numero("$1'500"), 1500); assert.equal(cifraCorta("1'200,000"), '1.2 M');
  assert.equal(numero("12'3456"), 0); assert.equal(numero("5'"), 0);
});

test('4.12.125 temperaturaTexto() pasa Kelvin a Celsius', () => {
  assert.equal(temperaturaTexto('297.15 K'), '24°'); assert.equal(temperaturaTexto('297K'), '24°'); assert.equal(temperaturaTexto('273.15 kelvin'), '0°');
  assert.equal(temperaturaTexto('-5 K'), ''); assert.equal(temperaturaTexto('24 °C'), '24°'); assert.equal(temperaturaTexto('75 °F'), '24°');
});

test('4.12.126 porcentaje() con «por ciento» y «pct»', () => {
  assert.equal(porcentaje('12 por ciento'), '12 %'); assert.equal(porcentaje('12 porciento'), '12 %'); assert.equal(porcentaje('12.5 pct'), '13 %');
  assert.equal(porcentaje('(3 por ciento)'), '-3 %'); assert.equal(porcentaje('por ciento'), '—'); assert.equal(porcentaje('8 pct', { signo: true }), '+8 %');
});

test('4.12.128 numero() con «mil millones» y moneda tras el múltiplo', () => {
  assert.equal(numero('3 mil millones'), 3e9); assert.equal(numero('1.2 mil millones'), 1.2e9); assert.equal(numero('2 millones de pesos'), 2e6);
  assert.equal(numero('5 mil pesos'), 5000); assert.equal(numero('1.5 M de MXN'), 1.5e6); assert.equal(numero('(2 mil millones)'), -2e9);
  assert.equal(numero('5 mdd'), 0); assert.equal(numero('2 mil'), 2000); assert.equal(numero('1.5 millones'), 1.5e6); assert.equal(cifraCorta('2 millones de pesos'), '2.0 M');
});
test('4.12.127 numero() con miles en punto y coma decimal (formato europeo)', () => {
  assert.equal(numero('1.200,50'), 1200.5); assert.equal(numero('$1.234.567,89'), 1234567.89); assert.equal(numero('1.200.000'), 1200000);
  assert.equal(numero('(1.200,50)'), -1200.5); assert.equal(numero('1 200,5'), 1200.5); assert.equal(numero('1.234.567,89 MXN'), 1234567.89);
  assert.equal(numero('1.200'), 1.2); assert.equal(numero('1,200.50'), 1200.5); assert.equal(numero('1.2.3'), 0); assert.equal(cifraCorta('1.200.000'), '1.2 M');
});

test('4.12.129 porcentaje() con «percent», «per cent», «por cien» y «porc.»', () => {
  assert.equal(porcentaje('12 percent'), '12 %'); assert.equal(porcentaje('12.5 Per Cent'), '13 %'); assert.equal(porcentaje('12 por cien'), '12 %');
  assert.equal(porcentaje('12 porc.'), '12 %'); assert.equal(porcentaje('(3 percent)'), '-3 %'); assert.equal(porcentaje('percent'), '—');
  assert.equal(porcentaje('4 percent', { signo: true }), '+4 %'); assert.equal(porcentaje('12 por ciento'), '12 %');
});

test('4.12.135 numero() / porcentaje() / cifraCorta() con el negativo al final (SAP/ERP)', () => {
  assert.equal(numero('1,200-'), -1200); assert.equal(numero('$1,200.50-'), -1200.5); assert.equal(numero('1.200,50-'), -1200.5);
  assert.equal(numero('1,200 MXN-'), -1200); assert.equal(numero(' 350- '), -350); assert.equal(numero('350 -'), 0); assert.equal(numero('1,200−'), -1200);
  assert.equal(numero('-5-'), 0); assert.equal(numero('1-2'), 0); assert.equal(numero('-'), 0); assert.equal(numero('1,200'), 1200);
  assert.equal(porcentaje('12 %-'), '-12 %'); assert.equal(porcentaje('3-'), '-3 %'); assert.equal(cifraCorta('1,500,000-'), '-1.5 M');
});
test('nombreCiudad: estado abreviado al final sin coma (4.12.139)', () => {
  for (const [s, r] of [['LEON GTO', 'León, Gto.'], ['MONTERREY NL', 'Monterrey, N.L.'], ['CANCUN QROO', 'Cancún, Q. Roo'], ['QUERETARO QRO.', 'Querétaro, Qro.'],
    ['SAN LUIS POTOSI SLP', 'San Luis Potosí, S.L.P.'], ['TIJUANA BC', 'Tijuana, B.C.'], ['CD. JUAREZ CHIH', 'Ciudad Juárez, Chih.'], ['LEON, GTO.', 'León, Gto.'],
    ['EDO DE MEX', 'Estado de México'], ['GTO', 'Gto.'], ['GUADALAJARA', 'Guadalajara'], ['EDO. DE MEXICO', 'Estado de México']]) assert.equal(nombreCiudad(s), r);
});

test('nombreCiudad: siglas de ciudad y estado sueltas, «DE MEX» (4.12.142)', () => {
  for (const [s, r] of [['GDL', 'Guadalajara'], ['Gdl', 'Guadalajara'], ['MTY.', 'Monterrey'], ['EDOMEX', 'Estado de México'], ['SLP', 'S.L.P.'], ['NL', 'N.L.'],
    ['QRO', 'Qro.'], ['QROO', 'Q. Roo'], ['BCS', 'B.C.S.'], ['EDO. DE MEX', 'Estado de México'], ['ESTADO DE MEX.', 'Estado de México'],
    ['NAUCALPAN, EDO. DE MEX.', 'Naucalpan, Estado de México'], ['TOLUCA, EDO DE MEX', 'Toluca, Estado de México'], ['MEXICALI', 'Mexicali'],
    ['GDL CENTRO', 'Gdl Centro'], ['CDMX', 'CDMX'], ['SAN LUIS POTOSI, S.L.P.', 'San Luis Potosí, S.L.P.']]) assert.equal(nombreCiudad(s), r, s);
});

test('nombreCiudad: coma pegada, sigla tras coma y «EDO MEX» (4.12.143)', () => {
  for (const [s, r] of [['MONTERREY,NL', 'Monterrey, N.L.'], ['LEON,GTO.', 'León, Gto.'], ['MONTERREY, NL', 'Monterrey, N.L.'], ['TIJUANA , BC', 'Tijuana, B.C.'],
    ['EDO MEX', 'Estado de México'], ['EDO. MEX.', 'Estado de México'], ['NAUCALPAN, EDO MEX', 'Naucalpan, Estado de México'], ['NAUCALPAN,EDO. MEX.', 'Naucalpan, Estado de México'],
    ['GUADALAJARA, JALISCO', 'Guadalajara, Jalisco'], ['GUADALAJARA, JAL., MEXICO', 'Guadalajara, Jal., México'], ['MEXICO, D.F.', 'CDMX'],
    ['SAN LUIS POTOSI, S.L.P.', 'San Luis Potosí, S.L.P.'], ['1,200', '']]) assert.equal(nombreCiudad(s), r, s);
});
test('nombreCiudad: sigla con puntos sin coma, Morelos y Sinaloa (4.12.145)', () => {
  for (const [s, r] of [['ENSENADA B.C.', 'Ensenada, B.C.'], ['APODACA, N. L.', 'Apodaca, N.L.'], ['CHETUMAL Q.ROO', 'Chetumal, Q. Roo'],
    ['CUERNAVACA MOR', 'Cuernavaca, Mor.'], ['CULIACAN, SIN.', 'Culiacán, Sin.'], ['STA. ROSALIA', 'Santa Rosalía'], ['LA PAZ, B. C. S.', 'La Paz, B.C.S.'],
    ['SAN LUIS POTOSI S.L.P.', 'San Luis Potosí, S.L.P.'], ['MERIDA, YUC.', 'Mérida, Yuc.'], ['EDO DE MEX', 'Estado de México'], ['MOR', 'Mor.'],
    ['CD. JUAREZ', 'Ciudad Juárez'], ['PTO. VALLARTA', 'Puerto Vallarta'], ['LAGOS DE MORENO', 'Lagos de Moreno']]) assert.equal(nombreCiudad(s), r, s);
});
test('nombreCiudad: estado completo al final sin coma y «GTZ» (4.12.146)', () => {
  for (const [s, r] of [['ZAPOPAN JALISCO', 'Zapopan, Jalisco'], ['LEON GUANAJUATO', 'León, Guanajuato'], ['SAN NICOLAS NUEVO LEON', 'San Nicolás, Nuevo León'],
    ['LA PAZ BAJA CALIFORNIA SUR', 'La Paz, Baja California Sur'], ['TIJUANA BAJA CALIFORNIA', 'Tijuana, Baja California'], ['CANCUN QUINTANA ROO', 'Cancún, Quintana Roo'],
    ['CD VALLES SAN LUIS POTOSI', 'Ciudad Valles, San Luis Potosí'], ['TUXTLA GTZ', 'Tuxtla Gutiérrez'], ['MORELIA MICHOACAN', 'Morelia, Michoacán'],
    // sin cambio: conector, prefijo de lugar, municipios con nombre de estado, el estado solo y la coma ya puesta
    ['VICTORIA DE DURANGO', 'Victoria de Durango'], ['CIUDAD HIDALGO', 'Ciudad Hidalgo'], ['PUERTO MORELOS', 'Puerto Morelos'], ['DOLORES HIDALGO', 'Dolores Hidalgo'],
    ['VICENTE GUERRERO', 'Vicente Guerrero'], ['SAN LUIS POTOSI', 'San Luis Potosí'], ['NUEVO LEON', 'Nuevo León'], ['JALISCO', 'Jalisco'], ['ZAPOPAN, JALISCO', 'Zapopan, Jalisco'],
    ['SANTIAGO DE QUERETARO', 'Santiago de Querétaro'], ['CD. JUAREZ', 'Ciudad Juárez'], ['LEON GTO', 'León, Gto.']]) assert.equal(nombreCiudad(s), r, s);
});
