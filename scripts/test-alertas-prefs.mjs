// Preferencias de alertas por tipo (2026-10-01): catálogo, herencia área → tipo, tipos apagados para todos,
// y SSR de la pantalla de preferencias. Corre con vite en modo SSR para resolver import.meta.env.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import React from 'react';
import { renderToString } from 'react-dom/server';

const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });
const A = await vite.ssrLoadModule('/src/lib/alertas.js');
test.after(() => vite.close());

test('normalizar: tipos heredan del área y los apagados siempre off', () => {
  const p = A.normalizarPrefsNotif({ areas: { pagos: 'silencio' }, tipos: { rebate_por_generar: 'inmediato' } });
  assert.equal(p.tipos.rebate_por_generar, 'inmediato', 'lo guardado gana');
  assert.equal(p.tipos.pago_sin_folio, 'off', 'área en silencio → tipo apagado');
  assert.equal(p.tipos.stock_vs_transito, 'off', 'apagado para todos aunque el área esté en resumen');
  assert.equal(p.tipos.agenda_vencida, 'inmediato', 'default del catálogo');
  assert.equal(A.normalizarPrefsNotif(null).tipos.datos_sin_actualizar, 'resumen');
});

test('modoDe: catálogo, preferencias de Fernando y Karolina', () => {
  const f = A.normalizarPrefsNotif({ tipos: { pago_por_solicitar: 'off' } });
  const k = A.normalizarPrefsNotif({ tipos: { pago_por_solicitar: 'inmediato' } });
  const a = { tipo: 'pago_por_solicitar', area: 'pagos' };
  assert.equal(A.modoDe(a, f), 'off');
  assert.equal(A.modoDe(a, k), 'inmediato');
  assert.equal(A.modoDe({ tipo: 'stock_vs_transito', area: 'inventario' }, k), 'off');
  assert.equal(A.modoDe({ tipo: 'cuenta_seguimiento', area: 'agenda' }, f), 'inmediato');
  assert.ok(A.TIPOS_DESACTIVADOS.has('equipo_inactivo') && A.TIPOS_DESACTIVADOS.has('factura_sin_oc') && A.TIPOS_DESACTIVADOS.has('cuota_en_riesgo'));
  assert.ok(!A.TIPOS_DESACTIVADOS.has('rebate_por_generar') && !A.TIPOS_DESACTIVADOS.has('datos_sin_actualizar') && !A.TIPOS_DESACTIVADOS.has('agenda_vencida'));
});

test('espejo con api/cron.js (tipos apagados y defaults)', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../api/cron.js', import.meta.url), 'utf8');
  const m = src.match(/const TIPOS_DESACTIVADOS = new Set\(\[([^\]]+)\]\)/);
  const cron = new Set(m[1].split(',').map((s) => s.trim().replace(/'/g, '')));
  assert.deepEqual([...cron].sort(), [...A.TIPOS_DESACTIVADOS].sort());
  const d = src.match(/const TIPO_DEF = \{([^}]+)\}/)[1];
  for (const t of A.TIPOS_ALERTA.filter((x) => x.def !== 'off')) assert.ok(d.includes(`${t.tipo}: '${t.def}'`), `cron TIPO_DEF ${t.tipo} = ${t.def}`);
});

test('SSR de PreferenciasNotificaciones (controlado)', async () => {
  const { default: Pref } = await vite.ssrLoadModule('/src/components/notificaciones/PreferenciasNotificaciones.jsx');
  const { ThemeProvider } = await vite.ssrLoadModule('/src/lib/themeContext.jsx').catch(() => vite.ssrLoadModule('/src/lib/themeContext.js'));
  const html = renderToString(React.createElement(ThemeProvider, null, React.createElement(Pref, { valor: { tipos: { pago_por_solicitar: 'off' } }, onGuardar: () => {} })));
  assert.match(html, /Pago calculado sin solicitar/);
  assert.match(html, /Cuenta sin seguimiento/);
  assert.match(html, /Apagadas para todos/);
  assert.match(html.replace(/<!-- -->/g, ""), new RegExp(`${A.TIPOS_ALERTA.filter((t) => t.def !== "off").length - 1} de ${A.TIPOS_ALERTA.filter((t) => t.def !== "off").length} encendidas`));
  assert.doesNotMatch(html, /Por área/);
});
