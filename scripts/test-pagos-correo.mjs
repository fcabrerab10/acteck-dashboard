// Tests de los textos de correo · node scripts/test-pagos-correo.mjs
// Verifica que las tres plantillas reales (SPIFF · Rebates · Marketing) salgan con
// el saludo, la tabla y el cierre que usan Fernando y Karolina.
import { correoSolicitud, correoLote } from '../src/modules/comercial/pagosv3/correo.js';

let fallos = 0;
const ok = (cond, msg, got) => { if (cond) console.log('  ✓', msg); else { fallos++; console.log('  ✗', msg, '→', JSON.stringify(got)?.slice(0, 300)); } };
const ver = process.argv.includes('--ver');

console.log('1 · SPIFF PCEL (dispersión · Lucy)');
const spiff = correoSolicitud({
  perfil: { nombre: 'Fernando Cabrera' },
  pago: {
    cliente: 'pcel', tipo: 'spiff', periodo: '2026-07', monto: 6177, concepto: 'SPIFF Julio 2026 · PCEL',
    detalle: { base: 2941000, cuota: 2800000, personas: [{ nombre: 'Geraldo Roman', monto: 6177 }] },
  },
});
ok(spiff.asunto === 'Spiff Julio 2026 PCEL', 'asunto "Spiff Julio 2026 PCEL"', spiff.asunto);
ok(/Hola Lucy buenos días/.test(spiff.cuerpo), 'saludo a Lucy', spiff.cuerpo.slice(0, 60));
ok(/dispersión de los Spiff generados en Julio 2026 para el equipo de PCEL/.test(spiff.cuerpo), 'frase de dispersión', spiff.cuerpo.slice(0, 200));
ok(/Geraldo Roman \$6,177/.test(spiff.cuerpo), 'línea por persona "Geraldo Roman $6,177"', spiff.cuerpo);
ok(/Mes\s+Objetivo Sell In\s+Facturación\s+Spiff/.test(spiff.cuerpo), 'tabla Mes · Objetivo Sell In · Facturación · Spiff', spiff.cuerpo);
ok(/Quedo al pendiente de tus comentarios/.test(spiff.cuerpo), 'cierre "Quedo al pendiente de tus comentarios"');
ok(/\nFernando$/.test(spiff.cuerpo), 'firma Fernando', spiff.cuerpo.slice(-40));
ok(spiff.para.some((p) => /Lucía/.test(p)), 'destinatario Lucía', spiff.para);
ok(spiff.cc.some((p) => /David Millán/.test(p)), 'copia a David', spiff.cc);
if (ver) console.log('\n' + spiff.texto + '\n');

console.log('\n2 · Rebates Dicotech (lote de dos meses)');
const rebates = correoLote({
  perfil: { nombre: 'Fernando Cabrera' },
  pagos: [
    { cliente: 'dicotech', tipo: 'rebate', periodo: '2026-07', monto: 88000, concepto: 'Rebate Julio', detalle: { alcance: 1.12, rebate_pagado: 80000 } },
    { cliente: 'dicotech', tipo: 'rebate', periodo: '2026-08', monto: 96800, concepto: 'Rebate Agosto', detalle: { alcance: 1.55, rebate_pagado: 64000 } },
  ],
});
ok(rebates.asunto === 'Rebates Dicotech Julio 2026 y Agosto 2026', 'asunto con los dos meses', rebates.asunto);
ok(/Hola equipo buenos días,/.test(rebates.cuerpo), 'saludo "Hola equipo buenos días,"');
ok(/Mes\s+Alcance\s+Rebate Pagado\s+Rebate Correcto\s+Diferencia/.test(rebates.cuerpo), 'tabla Mes · Alcance · Rebate Pagado · Rebate Correcto · Diferencia', rebates.cuerpo);
ok(/\$8,000/.test(rebates.cuerpo) && /\$32,800/.test(rebates.cuerpo), 'diferencias calculadas (8,000 y 32,800)', rebates.cuerpo);
ok(/Quedo al pendiente de cualquier duda o comentario/.test(rebates.cuerpo), 'cierre de rebates');
ok(rebates.para.some((p) => /credito\.cobranza@acteck\.com/.test(p)), 'va a crédito y cobranza', rebates.para);
if (ver) console.log('\n' + rebates.texto + '\n');

console.log('\n3 · Marketing (Karolina · nota de crédito)');
const mkt = correoSolicitud({
  perfil: { nombre: 'Karolina' },
  pago: {
    cliente: 'dicotech', tipo: 'marketing', periodo: '2026-09', monto: 6000, concepto: 'Marketing septiembre',
    detalle: { filas: [{ concepto: 'CAMPAÑA ADS 2026', monto: 6000 }] },
  },
});
ok(/Hola Luis Fer, buen día/.test(mkt.cuerpo), 'saludo a Luis Fer', mkt.cuerpo.slice(0, 60));
ok(/Me apoyas a realizar el pago correspondiente a Dicotech/.test(mkt.cuerpo), 'frase de Karolina');
ok(/\$6,000\.00 y será por nota de crédito/.test(mkt.cuerpo), 'monto y "por nota de crédito"', mkt.cuerpo);
ok(/Actividad\s+Total\s+Mes/.test(mkt.cuerpo), 'tabla Actividad · Total · Mes', mkt.cuerpo);
ok(/\nKarolina$/.test(mkt.cuerpo), 'firma Karolina (quien solicita)', mkt.cuerpo.slice(-40));
if (ver) console.log('\n' + mkt.texto + '\n');

console.log('\n4 · Genérico (protección de precio)');
const gen = correoSolicitud({
  perfil: { nombre: 'Fernando Cabrera' },
  pago: {
    cliente: 'digitalife', tipo: 'proteccion_precio', periodo: '2026-09', monto: 128150,
    concepto: 'Protección de precio · lista septiembre', fecha_programada: '2026-09-12',
    detalle: { filas: [{ concepto: '3,012 pz CL215 × $42', base: 3012, monto: 126504 }] },
  },
});
ok(/Solicitud de pago · Protección de precio/.test(gen.asunto), 'asunto genérico', gen.asunto);
ok(/se aplicará vía nota de crédito/i.test(gen.cuerpo), 'menciona la nota de crédito');
ok(/Fecha programada de pago: 2026-09-12/.test(gen.cuerpo), 'fecha programada', gen.cuerpo);
if (ver) console.log('\n' + gen.texto + '\n');

console.log(fallos === 0 ? '\nOK · correos de Pagos V3' : `\n${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
