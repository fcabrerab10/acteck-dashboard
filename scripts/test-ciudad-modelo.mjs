// Acteck Ciudad · modelo puro. node --test scripts/test-ciudad-modelo.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { construirModelo, ciudadDeSucursal, CIUDADES, posDe } from '../src/modules/ciudad/modelo.js';

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
