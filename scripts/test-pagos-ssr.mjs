// Smoke SSR de las piezas de Pagos V3 · node scripts/test-pagos-ssr.mjs
// Renderiza los paneles con datos de ejemplo (sin red) y comprueba que el HTML
// trae lo que debe: etapas del flujo, calendario, evidencia del cálculo, fondos y reglas.
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

let fallos = 0;
const ok = (cond, msg, extra) => { if (cond) console.log('  ✓', msg); else { fallos++; console.log('  ✗', msg, extra ? `→ ${String(extra).slice(0, 200)}` : ''); } };

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PerfilContext } = await vite.ssrLoadModule('/src/lib/perfilContext.js');
  const { ThemeContext } = await vite.ssrLoadModule('/src/lib/themeContext.jsx');
  const { getTheme } = await vite.ssrLoadModule('/src/lib/themeTokens.js');
  const { default: Calendario } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/Calendario.jsx');
  const { default: PanelCalculo } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/PanelCalculo.jsx');
  const { default: PanelFondos } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/PanelFondos.jsx');
  const { default: PanelReglas } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/PanelReglas.jsx');
  const { default: DrillPago } = await vite.ssrLoadModule('/src/modules/comercial/pagosv3/DrillPago.jsx');
  const { default: PagosUnificados } = await vite.ssrLoadModule('/src/modules/comercial/PagosUnificados.jsx');
  const { default: PagosMovil } = await vite.ssrLoadModule('/src/movil/pestanas/pagos/Pagos.jsx');
  const { default: CalendarioM } = await vite.ssrLoadModule('/src/movil/pestanas/pagos/CalendarioM.jsx');
  const { HojaCorreo } = await vite.ssrLoadModule('/src/movil/pestanas/pagos/hojas.jsx');
  const { QueryClient, QueryClientProvider } = await import('@tanstack/react-query');

  const theme = getTheme('claro');
  const perfil = { es_super_admin: true, nombre: 'Fernando Cabrera' };
  const wrap = (el, p = perfil) => React.createElement(ThemeContext.Provider, { value: { theme, setThemeKey() {} } },
    React.createElement(PerfilContext.Provider, { value: p }, el));
  const h = (C, props, p) => renderToString(wrap(React.createElement(C, props), p));

  const pagos = [
    { id: 'p1', cliente: 'dicotech', concepto: 'Rebate agosto', tipo: 'rebate', origen: 'auto', estado: 'solicitado', monto: 96800, periodo: '2026-08', fecha_programada: '2026-09-15', solicitado_at: '2026-09-03T10:00:00Z', solicitado_por: 'Fernando', created_at: '2026-09-02T08:00:00Z', detalle: { base: 1613300, pct: 0.06, alcance: 1.12, nivel: '90% a 114.99%', filas: [{ concepto: 'Sell in ago', base: 1613300, pct: 0.06, monto: 96798 }] } },
    { id: 'p2', cliente: 'digitalife', concepto: 'Protección de precio · lista sep', tipo: 'proteccion_precio', origen: 'manual', estado: 'calculado', monto: 128150, periodo: '2026-09', fecha_programada: '2026-09-12', created_at: '2026-09-10T08:00:00Z', detalle: { filas: [{ concepto: '3,012 pz CL215 × $42', base: 3012, monto: 126504 }] } },
    { id: 'p3', cliente: 'pcel', concepto: 'Apoyo evento Buen Fin', tipo: 'promocion', origen: 'manual', estado: 'pagado', monto: 85000, periodo: '2026-09', fecha_programada: '2026-09-04', pagado_at: '2026-09-04T00:00:00Z', nc_folio: 'B4462', nc_factura: 'F-118011', detalle: {} },
  ];

  console.log('Calendario');
  const cal = h(Calendario, { pagos, anio: 2026, mes: 9, hoyISO: '2026-09-12', onMes() {}, onPago() {} });
  ok(cal.includes('Septiembre 2026'), 'encabezado del mes');
  ok(cal.includes('Rebate agosto'), 'pinta el pago en su día');
  ok(cal.includes('Protección'), 'leyenda por tipo');
  ok((cal.match(/lun|mar|mié/g) || []).length >= 3, 'días de la semana');

  console.log('\nDrill de un pago');
  const drill = h(DrillPago, { pago: pagos[0], perfil, puedeEditar: true, reglaDestinatarios: null, onAccion() {}, onRegistrarPago() {}, onBorrar() {} });
  ok(drill.includes('Cálculo y evidencia'), 'bloque de evidencia');
  ok(drill.includes('Sell in ago'), 'fila del cálculo');
  ok(/Alcance 112 %/.test(drill), 'alcance en la nota', drill.match(/Alcance[^<]*/)?.[0]);
  ok(drill.includes('Nota de crédito'), 'bloque de NC');
  ok(drill.includes('Autorizar'), 'acción de la etapa (solicitado → autorizar)');
  ok(drill.includes('Copiar correo'), 'botón de copiar correo');
  ok(drill.includes('Bitácora'), 'botón de bitácora');

  console.log('\nPanel de cálculo');
  const datosMotor = {
    sellInMes: { dicotech: { '2026-08': 1613300, '2026-09': 900000 }, pcel: { '2026-09': 2100000 }, digitalife: { '2026-09': 3000000 } },
    cuotaMes: { dicotech: { '2026-08': 1400000, '2026-09': 1000000 }, pcel: { '2026-09': 2000000 }, digitalife: { '2026-09': 3900000 } },
    sellOutMes: { digitalife: { '2026-09': 3600000 } },
    vendedoresDicotech: { '2026-09': [{ nombre: 'Jorge Peña', importe: 186400 }, { nombre: 'Ana Luna', importe: 162900 }] },
    alcanceQ: {},
  };
  const calc = h(PanelCalculo, {
    clientes: ['digitalife', 'pcel', 'dicotech'], reglas: [], datosMotor, anio: 2026, mes: 9,
    dinamica: [{ id: 1, cliente: 'dicotech', anio: 2026, mes: 9, meta: 110000, premios: [{ pos: 1, premio: 'Amazon $2,500', monto: 2500 }] }],
    pagos, puedeEditar: () => true, onCrearPago() {}, onGuardarDinamica() {},
  });
  ok(calc.includes('Fondo para Generación Sell Out'), 'nombre oficial del rebate de Dicotech');
  ok(calc.includes('Dinámica de vendedores'), 'bloque de la dinámica');
  ok(calc.includes('Jorge Peña'), 'ranking de vendedores');
  ok(calc.includes('Crear pago de premios'), 'botón de crear el pago de premios');
  ok(calc.includes('SPIFF sell out') || calc.includes('SPIFF'), 'SPIFF por cliente');
  ok(calc.includes('Compartir ranking'), 'compartir ranking');

  console.log('\nPanel de fondos');
  const fondos = [
    { fondo_id: 1, cliente: 'pcel', fondo_key: 'mkt', nombre: 'Marketing', abonos_ytd: 120000, cargos_ytd: 135000, saldo: -15000, activo: true, regla: { tipo: 'pct_sell_in', pct: 0.01 } },
    { fondo_id: 2, cliente: 'dicotech', fondo_key: 'mkt', nombre: 'Marketing (cliente)', abonos_ytd: 60000, cargos_ytd: 22400, saldo: 37600, activo: true, regla: { tipo: 'pct_sell_in_tiers', pct_fallback_q_bajo: 0.0075 } },
  ];
  const fon = h(PanelFondos, { fondos, movimientos: [], clientes: ['pcel', 'dicotech'], puedeEditar: () => true, onMovimiento() {} });
  ok(fon.includes('Fondos por cliente'), 'título');
  ok(/en negativo/.test(fon), 'avisa del fondo en negativo');
  ok(fon.includes('$37,600'), 'saldo del fondo de Dicotech', fon.match(/\$[\d,]+/g)?.slice(0, 6));

  console.log('\nPanel de reglas (candado)');
  const reg = h(PanelReglas, { clientes: ['digitalife', 'pcel', 'dicotech'], reglas: [], puedeEditar: () => true, onGuardar() {} });
  ok(reg.includes('Reglas por cliente'), 'título');
  ok(reg.includes('Desbloquear para editar'), 'botón del candado');

  console.log('\nPantalla completa');
  const pant = h(PagosUnificados, {});
  ok(/aria-busy="true"|Cargando/.test(pant), 'primer render muestra el loader con la silueta de Pagos');
  const sinAcceso = h(PagosUnificados, {}, { es_super_admin: false, permisos: {} });
  ok(/Sin acceso|No tienes acceso/.test(sinAcceso), 'sin permisos → Sin acceso');

  console.log('\nMóvil · bandeja por acción (mockup A)');
  const hMovil = (el, p = perfil, qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })) =>
    renderToString(React.createElement(QueryClientProvider, { client: qc }, wrap(el, p)));
  ok(/aria-busy="true"/.test(hMovil(React.createElement(PagosMovil, {}))), 'primer render = silueta móvil de Pagos');
  const sinAccesoM = hMovil(React.createElement(PagosMovil, {}), { es_super_admin: false, permisos: {} });
  ok(/Sin acceso/.test(sinAccesoM), 'sin permisos → Sin acceso');

  // Con la consulta ya en cache se pinta la bandeja completa (grupos, chips y hero).
  // Fechas lejanas para que no caigan en "Vence en 7 días" y se vea cada grupo por etapa.
  const lejos = new Date(Date.now() + 60 * 86400000).toISOString().slice(0, 10);
  const pagosMovil = [
    ...pagos,
    { id: 'm1', cliente: 'pcel', concepto: 'Rebate Q3 lejano', tipo: 'rebate', origen: 'auto', estado: 'calculado', monto: 410000, fecha_programada: lejos, detalle: {} },
    { id: 'm2', cliente: 'digitalife', concepto: 'SPIFF sell in lejano', tipo: 'spiff', origen: 'auto', estado: 'solicitado', monto: 42000, fecha_programada: lejos, solicitado_at: '2026-09-03T10:00:00Z', detalle: {} },
    { id: 'm3', cliente: 'dicotech', concepto: 'Apoyo sin folio', tipo: 'marketing', origen: 'manual', estado: 'autorizado', monto: 84300, folio: '', fecha_programada: lejos, detalle: {} },
    { id: 'm4', cliente: 'pcel', concepto: 'Campaña con folio', tipo: 'marketing', origen: 'manual', estado: 'folio', monto: 6960, folio: 'F-4462', fecha_programada: lejos, detalle: {} },
  ];
  const qcCargado = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  qcCargado.setQueryData(['movil', 'pagos', 'digitalife,pcel,dicotech'], { pagos: pagosMovil, fondos, reglas: [] });
  const mov = hMovil(React.createElement(PagosMovil, {}), perfil, qcCargado);
  ok(mov.includes('Pagos'), 'título de la pantalla');
  ok(['Hoy', 'Calendario', 'Fondos', 'Historial'].every((t) => mov.includes(t)), 'Segmented Hoy · Calendario · Fondos · Historial');
  ok(/comprometid/i.test(mov), 'hero con el comprometido del mes');
  ok(['Por solicitar', 'Por autorizar', 'Sin folio', 'Por registrar (folio sin pago)', 'Vence en 7 días'].every((g) => mov.includes(g)),
    'los grupos por acción de la bandeja');
  ok(mov.includes('Digitalife') && mov.includes('PCEL') && mov.includes('Dicotech'), 'chips de cliente');
  ok(mov.includes('Rebate agosto') && mov.includes('Protección de precio'), 'las filas de la bandeja');

  console.log('\nMóvil · calendario');
  const calM = renderToString(wrap(React.createElement(CalendarioM, {
    pagos, anio: 2026, mes: 9, hoy: '2026-09-12', dia: '2026-09-15', onDia() {}, onMes() {}, onPago() {},
  })));
  ok(/septiembre/i.test(calM) && calM.includes('2026'), 'encabezado del mes');
  ok(calM.includes('Rebate agosto'), 'lista los pagos del día elegido');
  ok((calM.match(/aria-pressed/g) || []).length >= 28, 'una celda por día del mes', (calM.match(/aria-pressed/g) || []).length);

  console.log('\nMóvil · hoja de Copiar correo');
  const corr = renderToString(wrap(React.createElement(HojaCorreo, {
    pago: pagos[1], abierto: true, onCerrar() {}, perfil, reglas: [], puedeEditar: true, onSolicitado() {},
  })));
  ok(corr.includes('Copiar correo'), 'título de la hoja');
  ok(/Copiar y marcar solicitado/.test(corr), 'el calculado copia Y marca solicitado');
  const corrReenvio = renderToString(wrap(React.createElement(HojaCorreo, {
    pago: pagos[0], abierto: true, onCerrar() {}, perfil, reglas: [], puedeEditar: true, onSolicitado() {},
  })));
  ok(!/Copiar y marcar solicitado/.test(corrReenvio) && corrReenvio.includes('Copiar correo'), 'el ya solicitado sólo copia (reenvío)');
} finally {
  await vite.close();
}

console.log(fallos === 0 ? '\nOK · SSR de Pagos V3' : `\n${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
