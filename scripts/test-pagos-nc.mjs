// Test del lector de notas de crédito (PDF) · node scripts/test-pagos-nc.mjs
// Usa el PDF real de docs/ejemplos/nota-credito-ejemplo.pdf (Revko → Dicotech, B13719).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { leerNotaCredito } from '../src/modules/comercial/pagosv3/leerNotaCredito.js';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
let fallos = 0;
const ok = (cond, msg, got) => { if (cond) console.log('  ✓', msg); else { fallos++; console.log('  ✗', msg, '→', JSON.stringify(got)); } };

const pdf = readFileSync(join(raiz, 'docs/ejemplos/nota-credito-ejemplo.pdf'));
const r = await leerNotaCredito(new Uint8Array(pdf));

console.log('Nota de crédito · docs/ejemplos/nota-credito-ejemplo.pdf');
ok(r.ok, 'se leyó el PDF', r.motivo);
const c = r.campos;
ok(c.nc_folio === 'B13719', 'folio NC = B13719', c.nc_folio);
ok(c.nc_fecha === '2026-09-09', 'fecha = 2026-09-09', c.nc_fecha);
ok(c.nc_uuid === '17FC0B3A-8237-40B4-A477-E5A4D1A95087', 'UUID del CFDI', c.nc_uuid);
ok(c.nc_rfc === 'DMT0911105L5', 'RFC receptor = DMT0911105L5', c.nc_rfc);
ok(/DICOTECH MAYORISTA DE TECNOLOGIA/.test(c.nc_razon_social || ''), 'razón social = DICOTECH MAYORISTA DE TECNOLOGIA', c.nc_razon_social);
ok(c.emisor_rfc === 'AME011127HC5', 'RFC emisor = AME011127HC5', c.emisor_rfc);
ok(c.nc_factura === 'A10379702', 'factura aplicada = A10379702', c.nc_factura);
ok(c.nc_importe === 6000, 'importe = 6000', c.nc_importe);
ok(c.nc_iva === 960, 'IVA = 960', c.nc_iva);
ok(c.nc_total === 6960, 'total = 6960', c.nc_total);
ok(/Bonificaci/.test(c.nc_concepto || '') && /CAMPAÑA ADS 2026/.test(c.nc_concepto || ''), 'concepto con "Bonificación · Nota Credito 13890 · CAMPAÑA ADS 2026 (1/4)"', c.nc_concepto);

console.log(fallos === 0 ? '\nOK · lector de NC' : `\n${fallos} fallo(s)`);
process.exit(fallos ? 1 : 0);
