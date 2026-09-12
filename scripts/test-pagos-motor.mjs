// Tests del motor de cálculo de Pagos V3 · node scripts/test-pagos-motor.mjs
// Los porcentajes son los de reglas.js (copia de lineamientos_cliente): si alguien los
// cambia sin querer, estos tests truenan.
import M from '../src/modules/comercial/pagosv3/motor.js';
import { REGLAS_DEFAULT, reglaDe } from '../src/modules/comercial/pagosv3/reglas.js';
import E from '../src/modules/comercial/pagosv3/estados.js';

let fallos = 0;
const ok = (cond, msg, got) => { if (cond) console.log('  ✓', msg); else { fallos++; console.log('  ✗', msg, '→', JSON.stringify(got)); } };
const casi = (a, b, tol = 0.01) => Math.abs(Number(a) - Number(b)) <= tol;
const grupo = (t) => console.log('\n' + t);

// ═══ Rebate mensual · Dicotech ═══
grupo('Rebate mensual · Dicotech (sell in del mes cerrado × % por nivel)');
{
  const regla = REGLAS_DEFAULT.dicotech.rebate;
  // Alcance 100 % → nivel "90% a 114.99%" → 2 %
  const a = M.rebateMensual({ anio: 2026, mes: 8, sellIn: 1000000, cuota: 1000000, regla });
  ok(a.aplica && casi(a.monto, 20000), 'alcance 100 % → 2 % = 20,000', a.monto);
  ok(a.detalle.nivel === '90% a 114.99%', 'nivel 90-114.99 %', a.detalle.nivel);
  // Alcance 160 % → regla especial de Fernando: > 150 % paga 3 %
  const b = M.rebateMensual({ anio: 2026, mes: 8, sellIn: 1600000, cuota: 1000000, regla });
  ok(b.aplica && casi(b.monto, 48000), 'alcance 160 % → 3 % = 48,000', b.monto);
  ok(b.detalle.pct === 0.03, '> 150 % sube el rebate a 3 %', b.detalle.pct);
  // Alcance 85 % → no llega al mínimo de 90 %
  const c = M.rebateMensual({ anio: 2026, mes: 8, sellIn: 850000, cuota: 1000000, regla });
  ok(!c.aplica && c.monto === 0, 'alcance 85 % → no aplica', c);
  ok(c.clave === 'rebate:dicotech:2026-08', 'clave idempotente', c.clave);
  ok(c.fecha_programada === '2026-09-15', 'se paga el 15 del mes siguiente', c.fecha_programada);
  // Frontera exacta 150 %
  const d = M.rebateMensual({ anio: 2026, mes: 8, sellIn: 1500000, cuota: 1000000, regla });
  ok(d.detalle.pct === 0.03, 'alcance exactamente 150 % → 3 %', d.detalle.pct);
}

// ═══ Rebate trimestral por niveles · PCEL ═══
grupo('Rebate trimestral · PCEL (niveles 1 % / 1.5 % / 2 %)');
{
  const regla = REGLAS_DEFAULT.pcel.rebate;
  const a = M.rebateTrimestralNiveles({ anio: 2026, q: 3, sellInQ: 10000000, cuotaQ: 10000000, regla });
  ok(casi(a.monto, 100000), 'alcance 100 % → 1 % = 100,000', a.monto);
  const b = M.rebateTrimestralNiveles({ anio: 2026, q: 3, sellInQ: 11000000, cuotaQ: 10000000, regla });
  ok(casi(b.monto, 165000) && b.detalle.pct === 0.015, 'alcance 110 % → 1.5 %', b.monto);
  const c = M.rebateTrimestralNiveles({ anio: 2026, q: 3, sellInQ: 13000000, cuotaQ: 10000000, regla });
  ok(casi(c.monto, 260000) && c.detalle.pct === 0.02, 'alcance 130 % → 2 %', c.monto);
  const d = M.rebateTrimestralNiveles({ anio: 2026, q: 3, sellInQ: 8000000, cuotaQ: 10000000, regla });
  ok(!d.aplica, 'alcance 80 % → no aplica (mínimo 90 %)', d.motivo);
  ok(c.periodo === '2026-Q3' && c.clave === 'rebate:pcel:2026-Q3', 'periodo y clave trimestrales', c.clave);
}

// ═══ Rebate trimestral por categoría · Digitalife ═══
grupo('Rebate trimestral · Digitalife (monitores 2 % · sillas 2 % · accesorios 3 %)');
{
  const regla = REGLAS_DEFAULT.digitalife.rebate;
  const r = M.rebateTrimestralCategorias({ anio: 2026, q: 3, porCategoria: { monitores: 1000000, sillas: 500000, accesorios: 2000000 }, regla });
  ok(casi(r.monto, 20000 + 10000 + 60000), 'total = 90,000', r.monto);
  ok(r.detalle.filas.length === 3, 'evidencia con una fila por categoría', r.detalle.filas.length);
  ok(r.fecha_programada === '2026-10-15', 'Q3 se paga el 15 de octubre', r.fecha_programada);
  const q4 = M.rebateTrimestralCategorias({ anio: 2026, q: 4, porCategoria: { monitores: 1000000 }, regla });
  ok(q4.fecha_programada === '2027-01-15', 'Q4 se paga el 15 de enero del año siguiente', q4.fecha_programada);
}

// ═══ SPIFF sell in ═══
grupo('SPIFF por sell in · PCEL (0.21 %) y Dicotech compradora (0.30 %)');
{
  const p = M.spiffSellIn({ cliente: 'pcel', anio: 2026, mes: 7, sellIn: 2000000, cuota: 2000000, regla: REGLAS_DEFAULT.pcel.spiff });
  ok(casi(p.monto, 4200), 'PCEL 2,000,000 × 0.21 % = 4,200', p.monto);
  const pBajo = M.spiffSellIn({ cliente: 'pcel', anio: 2026, mes: 7, sellIn: 800000, cuota: 1000000, regla: REGLAS_DEFAULT.pcel.spiff });
  ok(!pBajo.aplica, 'PCEL con alcance 80 % → no aplica (mínimo 90 %)', pBajo.motivo);
  const d = M.spiffSellIn({ cliente: 'dicotech', anio: 2026, mes: 7, sellIn: 1000000, cuota: 0, regla: REGLAS_DEFAULT.dicotech.spiff });
  ok(casi(d.monto, 3000) && d.aplica, 'Dicotech compradora 1,000,000 × 0.30 % = 3,000 (sin mínimo)', d.monto);
  ok(/SPIFF compradora/.test(d.concepto), 'concepto dice "SPIFF compradora"', d.concepto);
}

// ═══ SPIFF sell out · Digitalife ═══
grupo('SPIFF de sell out · Digitalife (cuota SO = 90 % de la cuota SI · paga al 100 % · 0.18 %)');
{
  const regla = REGLAS_DEFAULT.digitalife.spiff;
  // Cuota SI 3,900,000 → cuota SO 3,510,000. Sell out 3,600,000 la supera.
  const a = M.spiffSellOut({ anio: 2026, mes: 8, sellOut: 3600000, cuotaSellIn: 3900000, regla });
  ok(a.aplica && casi(a.monto, 6480), 'sell out 3.6 M ≥ cuota SO 3.51 M → 0.18 % = 6,480', a.monto);
  ok(casi(a.detalle.cuota_sell_out, 3510000), 'cuota de sell out = 90 % de la de sell in', a.detalle.cuota_sell_out);
  // El ejemplo del mockup: 2.41 M contra cuota SO 3.51 M = 69 % → no alcanza
  const b = M.spiffSellOut({ anio: 2026, mes: 8, sellOut: 2410000, cuotaSellIn: 3900000, regla });
  ok(!b.aplica && b.monto === 0, 'sell out 2.41 M (69 %) → sin pago', b.motivo);
  // Frontera: exactamente la cuota SO
  const c = M.spiffSellOut({ anio: 2026, mes: 8, sellOut: 3510000, cuotaSellIn: 3900000, regla });
  ok(c.aplica, 'exactamente la cuota SO → sí paga', c.motivo);
}

// ═══ Dinámica de vendedores · Dicotech ═══
grupo('Dinámica de vendedores · Dicotech (meta mensual sin IVA · ranking · 5 premios)');
{
  const vendedores = [
    { nombre: 'Jorge Peña', importe: 186400, sucursal: 'Puebla' },
    { nombre: 'Ana Luna', importe: 162900, sucursal: 'Veracruz' },
    { nombre: 'Carlos Ruiz', importe: 141200, sucursal: 'Puebla' },
    { nombre: 'Diana Mora', importe: 128750, sucursal: 'Oaxaca' },
    { nombre: 'Luis Ortiz', importe: 112300, sucursal: 'Puebla' },
    { nombre: 'Marta Gil', importe: 110000, sucursal: 'Puebla' },   // justo en la meta: participa
    { nombre: 'Raúl Sosa', importe: 90000, sucursal: 'Puebla' },    // debajo de la meta: fuera
  ];
  const premios = [
    { pos: 1, premio: 'Tarjeta Amazon $2,500', monto: 2500 },
    { pos: 2, premio: 'Tarjeta Amazon $1,500', monto: 1500 },
    { pos: 3, premio: 'Tarjeta Amazon $1,000', monto: 1000 },
    { pos: 4, premio: 'Tarjeta Amazon $500', monto: 500 },
    { pos: 5, premio: 'Power Bank', monto: 0 },
  ];
  const r = M.dinamicaVendedores({ anio: 2026, mes: 8, vendedores, meta: 110000, premios, regla: REGLAS_DEFAULT.dicotech.dinamica });
  ok(r.detalle.participantes === 6, '6 vendedores alcanzan la meta de 110,000 (el de 90,000 queda fuera)', r.detalle.participantes);
  ok(r.detalle.ganadores.length === 5, '5 premiados', r.detalle.ganadores.length);
  ok(r.detalle.ganadores[0].nombre === 'Jorge Peña', '1º por importe', r.detalle.ganadores[0]);
  ok(r.detalle.sin_premio === 1, '1 participante sin premio', r.detalle.sin_premio);
  ok(casi(r.monto, 5500), 'suma de premios con monto = 5,500', r.monto);
  ok(/Premios dinámica Agosto 2026/.test(r.concepto), 'concepto "Premios dinámica <mes>"', r.concepto);
  const sinMeta = M.dinamicaVendedores({ anio: 2026, mes: 9, vendedores, meta: 0, premios: [], regla: REGLAS_DEFAULT.dicotech.dinamica });
  ok(!sinMeta.aplica || sinMeta.monto === 0, 'sin meta capturada no genera pago con monto', sinMeta.monto);
}

// ═══ Marketing: fondo vs empresa ═══
grupo('Marketing · cargo a fondo vs paga la empresa');
{
  const actividades = [
    { id: 'a1', nombre: 'Campaña ADS', anio: 2026, mes: 9, inversion: 6000, cobro: 'empresa' },
    { id: 'a2', nombre: 'Exhibición Norte', anio: 2026, mes: 9, inversion: 18000, cobro: 'fondo' },
    { id: 'a3', nombre: 'Stand', anio: 2026, mes: 8, inversion: 5000, cobro: 'empresa' },
  ];
  const r = M.marketingDelMes({ cliente: 'dicotech', anio: 2026, mes: 9, actividades });
  ok(casi(r.pago.monto, 6000), 'sólo lo que paga la empresa entra al pago (6,000)', r.pago.monto);
  ok(r.cargosFondo.length === 1 && casi(r.cargosFondo[0].monto, 18000), 'lo de fondo se convierte en cargo al fondo', r.cargosFondo);
}

// ═══ Pagos fijos ═══
grupo('Pagos fijos');
{
  const f = M.pagosFijos({ cliente: 'digitalife', anio: 2026, mes: 9, regla: REGLAS_DEFAULT.digitalife.fijos });
  ok(f.length === 1 && casi(f[0].monto, 10000), 'Stand Sucursal Chapalita $10,000', f[0]?.monto);
  ok(f[0].fecha_programada === '2026-09-01', 'se programa el día 1 del mes', f[0]?.fecha_programada);
}

// ═══ Abonos de fondo ═══
grupo('Fondos · abono por regla');
{
  const fondo = REGLAS_DEFAULT.dicotech.fondo;
  const interno = M.abonoFondo({ cliente: 'dicotech', fondoKey: 'interno', anio: 2026, mes: 9, sellIn: 1000000, alcanceQ: 0.8, regla: fondo.fondos[1].regla });
  ok(casi(interno.monto, 10000), 'fondo interno = 1 % del sell in', interno?.monto);
  const cli = M.abonoFondo({ cliente: 'dicotech', fondoKey: 'mkt', anio: 2026, mes: 9, sellIn: 1000000, alcanceQ: 1.20, regla: fondo.fondos[0].regla });
  ok(casi(cli.monto, 10000) && cli.detalle.pct === 0.01, 'fondo cliente con alcance Q 120 % → 1 %', cli?.detalle);
  const bajo = M.abonoFondo({ cliente: 'dicotech', fondoKey: 'mkt', anio: 2026, mes: 9, sellIn: 1000000, alcanceQ: 0.5, regla: fondo.fondos[0].regla });
  ok(casi(bajo.monto, 7500), 'alcance Q bajo → 0.75 % de respaldo', bajo?.monto);
  const manual = M.abonoFondo({ cliente: 'digitalife', fondoKey: 'mkt', anio: 2026, mes: 9, sellIn: 1000000, alcanceQ: 1, regla: { tipo: 'manual' } });
  ok(manual === null, 'fondo manual no abona solo', manual);
}

// ═══ Protección de precio (apoyo manual) ═══
grupo('Protección de precio · apoyo (no crea pago)');
{
  const r = M.apoyoProteccionPrecio({
    inventario: [{ sku: 'CL215', piezas: 3012 }, { sku: 'XX1', piezas: 100 }],
    preciosAnteriores: { CL215: 1890, XX1: 500 },
    preciosNuevos: { CL215: 1848, XX1: 520 },
  });
  ok(r.filas.length === 1, 'sólo los SKU con baja de precio', r.filas.length);
  ok(casi(r.total, 3012 * 42), '3,012 pz × $42 = 126,504', r.total);
}

// ═══ Orquestador ═══
grupo('calcularPeriodo · agosto 2026 con los tres clientes');
{
  const datos = {
    sellInMes: { dicotech: { '2026-08': 1613300 }, pcel: { '2026-08': 2100000 }, digitalife: { '2026-08': 3000000 } },
    cuotaMes: { dicotech: { '2026-08': 1400000 }, pcel: { '2026-08': 2000000 }, digitalife: { '2026-08': 3900000 } },
    sellOutMes: { digitalife: { '2026-08': 3600000 } },
    vendedoresDicotech: { '2026-08': [{ nombre: 'Jorge Peña', importe: 186400 }] },
    dinamica: { '2026-08': { meta: 110000, premios: [{ pos: 1, premio: 'Amazon', monto: 2500 }] } },
    actividades: {},
  };
  const r = M.calcularPeriodo({ anio: 2026, mes: 8, reglasDB: [], datos });
  const claves = r.aplicables.map((p) => p.clave).sort();
  ok(claves.includes('rebate:dicotech:2026-08'), 'rebate mensual de Dicotech', claves);
  ok(claves.includes('spiff:pcel:2026-08'), 'SPIFF de PCEL', claves);
  ok(claves.includes('spiff:dicotech:2026-08'), 'SPIFF compradora de Dicotech', claves);
  ok(claves.includes('spiff:digitalife:2026-08'), 'SPIFF de sell out de Digitalife', claves);
  ok(claves.includes('dinamica:dicotech:2026-08'), 'dinámica de vendedores', claves);
  ok(claves.includes('fijo:digitalife:2026-08:stand-sucursal-chapalita'), 'pago fijo de Digitalife', claves);
  ok(!claves.some((k) => /^rebate:pcel/.test(k)), 'en agosto NO cierra el Q → sin rebate trimestral', claves);
  const sept = M.calcularPeriodo({ anio: 2026, mes: 9, reglasDB: [], datos: { ...datos, sellInMes: { pcel: { '2026-07': 2000000, '2026-08': 2000000, '2026-09': 2000000 } }, cuotaMes: { pcel: { '2026-07': 2000000, '2026-08': 2000000, '2026-09': 2000000 } } } });
  ok(sept.propuestas.some((p) => p.clave === 'rebate:pcel:2026-Q3'), 'septiembre cierra Q3 → rebate trimestral de PCEL', sept.propuestas.map((p) => p.clave));
  ok(new Set(r.propuestas.map((p) => p.clave)).size === r.propuestas.length, 'todas las claves son únicas', r.propuestas.length);
}

// ═══ Flujo ═══
grupo('Flujo de estados');
{
  ok(E.siguienteEstado('calculado') === 'solicitado', 'calculado → solicitado');
  ok(E.siguienteEstado('folio') === 'pagado', 'folio → pagado');
  ok(E.siguienteEstado('pagado') === null, 'pagado es el final');
  ok(E.transicionValida('solicitado', 'rechazado'), 'se puede rechazar lo solicitado');
  ok(!E.transicionValida('calculado', 'pagado'), 'no se salta del cálculo al pago');
  ok(E.faltaPara({ folio: '' }, 'folio') !== null, 'para pasar a "con folio" pide folio');
  ok(E.faltaPara({ nc_folio: '' }, 'pagado') !== null, 'para pagar pide la nota de crédito');
  ok(E.faltaPara({ nc_folio: 'B13719' }, 'pagado') === null, 'con NC ya puede pagarse');
  ok(E.diasParaPago({ fecha_programada: '2026-09-20' }, '2026-09-12') === 8, 'días para el pago');
  ok(E.estaVencido({ estado: 'calculado', fecha_programada: '2026-09-01' }, '2026-09-12'), 'vencido');
  ok(!E.estaVencido({ estado: 'pagado', fecha_programada: '2026-09-01' }, '2026-09-12'), 'lo pagado no vence');
  ok(E.venceEn({ estado: 'solicitado', fecha_programada: '2026-09-15' }, 7, '2026-09-12'), 'vence en 7 días');
  const flujo = E.resumenFlujo([{ estado: 'calculado', monto: 100 }, { estado: 'calculado', monto: 50 }, { estado: 'pagado', monto: 10 }]);
  ok(flujo[0].n === 2 && flujo[0].monto === 150, 'resumen del flujo por etapa', flujo[0]);
}

// ═══ Reglas: vigencia ═══
grupo('Reglas · vigencia por periodo');
{
  const db = [
    { cliente: 'dicotech', seccion: 'rebate', config: { tiers: [{ min_alcance: 0.9, pct: 0.01 }], frecuencia: 'mensual' }, vigente_desde: '2026-01-01', vigente_hasta: '2026-07-01' },
    { cliente: 'dicotech', seccion: 'rebate', config: { tiers: [{ min_alcance: 0.9, pct: 0.02 }], frecuencia: 'mensual' }, vigente_desde: '2026-07-01', vigente_hasta: null },
  ];
  ok(reglaDe(db, 'dicotech', 'rebate').tiers[0].pct === 0.02, 'reglaDe toma la vigente');
  const vieja = (await import('../src/modules/comercial/pagosv3/reglas.js')).reglaVigenteEn(db, 'dicotech', 'rebate', '2026-03-15');
  ok(vieja.tiers[0].pct === 0.01, 'reglaVigenteEn recalcula marzo con el % de entonces', vieja.tiers[0].pct);
}

console.log(fallos === 0 ? '\nOK · motor de Pagos V3' : `\n${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
