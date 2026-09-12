// Sell Out consolidado · textos (frases del hero y mensajes para compartir).
// NO se toca src/lib/whatsapp.js: los textos nuevos viven aquí.
// Regla: nada sensible (ni costo, ni margen, ni contribución). Sólo venta, piezas,
// inventario en el cliente, cuentas y cobertura.

import { MESES, MESES_LARGO, canalLabel, N } from './calculo.js';

const money = (n) => {
  if (n == null || !Number.isFinite(Number(n))) return '—';
  const v = Number(n), a = Math.abs(v), s = v < 0 ? '-' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e8 ? 0 : 1)} M`;
  if (a >= 1e3) return `${s}$${(a / 1e3).toFixed(0)} K`;
  return `${s}$${Math.round(a)}`;
};
const int = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : Math.round(Number(n)).toLocaleString('es-MX'));
const pct = (n, d = 0) => (n == null || !Number.isFinite(Number(n)) ? '—' : `${Number(n).toFixed(d)} %`);
const signo = (n, d = 0) => (n == null || !Number.isFinite(Number(n)) ? 'sin comparativo' : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(d)} %`);
const arribaAbajo = (n) => (n == null ? 'sin comparativo' : n >= 0 ? `${Math.abs(n).toFixed(0)} % arriba de` : `${Math.abs(n).toFixed(0)} % abajo de`);

export const etiquetaMes = (anio, mes) => `${MESES_LARGO[mes - 1]} ${anio}`;
export const etiquetaMesCorta = (anio, mes) => `${MESES[mes - 1].toLowerCase()} ${String(anio).slice(2)}`;

/** Frase del Hero: "El equipo desplazó $18.4 M, 12 % arriba de sep 2025; es el 47 % del sell in del mes". */
export function fraseHero(tot, anio, mes, cuentasActivas, cuentasTotal) {
  const partes = [`El equipo desplazó ${money(tot.importe)}`];
  partes.push(tot.yoy == null ? 'sin comparativo contra el año pasado' : `${arribaAbajo(tot.yoy)} ${etiquetaMesCorta(anio - 1, mes)} a mismo día`);
  const frase = `${partes.join(', ')}${tot.soSi != null ? `; es el ${pct(tot.soSi)} del sell in del mes` : ''}.`;
  return frase;
}

/** Sub del Hero: reparto por canal + cuentas activas + inventario en clientes. */
export function subHero(canales, tot, cuentasActivas, cuentasTotal, cuentasCaen, clientesConInv) {
  const reparto = canales.filter((c) => c.importe > 0).map((c) => `${c.label} ${money(c.importe)}`).join(' · ');
  const partes = [];
  if (reparto) partes.push(reparto + '.');
  partes.push(`${int(cuentasActivas)} de ${int(cuentasTotal)} cuentas activas${cuentasCaen ? `; ${int(cuentasCaen)} caen vs el año pasado` : ''}.`);
  if (tot.conInventario > 0) partes.push(`Inventario en clientes: ${money(tot.invValor)} (${clientesConInv.join(', ')}).`);
  return partes.join(' ');
}

/** Texto de "Compartir resumen del mes" (sin nada sensible). */
export function textoResumenMes({ anio, mes, tot, canales, top = [], corteDia, cuentasActivas, cuentasTotal, cuotas = [] }) {
  const L = [];
  L.push(`SELL OUT · ${etiquetaMes(anio, mes).toUpperCase()}`);
  L.push(corteDia ? `Al día ${corteDia} · montos sin IVA` : 'Montos sin IVA');
  L.push('');
  L.push(`Sell out del mes: ${money(tot.importe)} (${signo(tot.yoy)} vs ${etiquetaMesCorta(anio - 1, mes)})`);
  L.push(`Piezas: ${int(tot.cantidad)}`);
  L.push(`YTD ${anio}: ${money(tot.ytd)} (${signo(tot.yoyYtd)})`);
  if (tot.soSi != null) L.push(`Sell out / sell in del mes: ${pct(tot.soSi)}`);
  if (tot.pctCuota != null) L.push(`Cuota de sell in: ${pct(tot.pctCuota)} (${money(tot.sellInConCuota)} de ${money(tot.cuota)}) · ${int(tot.enCuota)} de ${int(tot.conCuota)} cuentas en cuota`);
  if (tot.conInventario > 0) L.push(`Inventario en clientes: ${money(tot.invValor)} · ${int(tot.invPiezas)} pz`);
  L.push('');
  L.push('POR CANAL');
  canales.filter((c) => c.importe > 0).forEach((c) => L.push(`· ${c.label}: ${money(c.importe)} (${pct(c.pct)})`));
  if (top.length) {
    L.push('');
    L.push('TOP CUENTAS');
    top.slice(0, 8).forEach((f, i) => L.push(`${i + 1}. ${f.nombre} — ${money(f.importe)} (${signo(f.yoy)})`));
  }
  if (cuotas.length) {
    L.push('');
    L.push('CUOTA DE SELL IN');
    cuotas.slice(0, 8).forEach((f) => L.push(`· ${f.nombre}: ${pct(f.pctCuota)} de ${money(f.cuota)}`));
  }
  L.push('');
  L.push(`${int(cuentasActivas)} de ${int(cuentasTotal)} cuentas con venta en el mes.`);
  return L.join('\n');
}

/** Texto de "Compartir estatus" de una cuenta (drill). Tampoco lleva nada sensible. */
export function textoEstatusCuenta({ fila, anio, mes, corteDia, topSkus = [], alertas = null, estados = [] }) {
  const L = [];
  L.push(`${fila.nombre.toUpperCase()} · SELL OUT ${etiquetaMes(anio, mes).toUpperCase()}`);
  L.push(corteDia ? `Al día ${corteDia} · sin IVA` : 'Sin IVA');
  L.push('');
  L.push(`Sell out del mes: ${money(fila.importe)} · ${int(fila.cantidad)} pz (${signo(fila.yoy)} vs ${etiquetaMesCorta(anio - 1, mes)})`);
  L.push(`YTD ${anio}: ${money(fila.ytd)} (${signo(fila.yoyYtd)})`);
  if (fila.sellIn != null) L.push(`Sell in del mes: ${money(fila.sellIn)} · sell out / sell in ${pct(fila.soSi)}`);
  if (fila.pctCuota != null) {
    L.push(`Cuota de sell in: ${money(fila.cuota)} · cuota ${pct(fila.pctCuota)}${fila.faltaCuota > 0 ? ` · faltan ${money(fila.faltaCuota)}` : ''}`);
  }
  if (fila.invValor != null) {
    L.push(`Inventario en su almacén: ${money(fila.invValor)} · ${int(fila.invPiezas)} pz · ${int(fila.invSkus)} SKUs`);
    if (fila.invSemanas != null) L.push(`Cobertura: ${fila.invSemanas.toFixed(1)} semanas al ritmo de los últimos 3 meses`);
  }
  if (fila.clientesFinales != null) {
    L.push(`Clientes finales: ${int(fila.clientesFinales)}${fila.cfNuevos != null ? ` (+${int(fila.cfNuevos)} nuevos, ${int(fila.cfPerdidos)} perdidos)` : ''}`);
  }
  if (fila.vendedores != null) L.push(`Vendedores con venta: ${int(fila.vendedores)}`);
  if (fila.sucursales != null) L.push(`Sucursales: ${int(fila.sucursales)}`);
  if (topSkus.length) {
    L.push('');
    L.push('TOP SKUs DEL MES');
    topSkus.slice(0, 8).forEach((s, i) => {
      const stock = s.stock == null ? '' : ` · stock ${int(s.stock)}${s.semanas != null ? ` (${s.semanas.toFixed(1)} sem)` : ''}`;
      L.push(`${i + 1}. ${s.sku} — ${int(s.mesActual)}${stock}`);
    });
  }
  if (estados.length) {
    L.push('');
    L.push('DÓNDE VENDE');
    estados.slice(0, 5).forEach((e) => L.push(`· ${capitalizarEstado(e.estado)}: ${pct(e.pct)}`));
  }
  if (alertas && (alertas.sinStockConVenta || alertas.sinVenta30)) {
    L.push('');
    L.push('PENDIENTES');
    if (alertas.sinStockConVenta) L.push(`· ${int(alertas.sinStockConVenta)} SKUs con venta y sin stock`);
    if (alertas.sinVenta30) L.push(`· ${int(alertas.sinVenta30)} SKUs con stock y sin venta 30+ días`);
  }
  return L.join('\n');
}

/** 'CIUDAD DE MEXICO' → 'Ciudad de México' (sólo para pantalla y textos). */
const ACENTOS = {
  'CIUDAD DE MEXICO': 'Ciudad de México', 'ESTADO DE MEXICO': 'Estado de México', MICHOACAN: 'Michoacán',
  'NUEVO LEON': 'Nuevo León', QUERETARO: 'Querétaro', 'SAN LUIS POTOSI': 'San Luis Potosí', YUCATAN: 'Yucatán',
  'SIN ESTADO': 'Sin estado',
};
export function capitalizarEstado(e) {
  const k = String(e || '').toUpperCase();
  if (ACENTOS[k]) return ACENTOS[k];
  return k.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase()).replace(/\bDe\b/g, 'de');
}

/** Frase del resumen del drill: qué pasó con esta cuenta este mes. */
export function fraseCuenta(fila, anio, mes, alertas) {
  const p = [];
  p.push(`${fila.nombre} desplazó ${money(fila.importe)}`);
  if (fila.yoy != null) p.push(`, ${arribaAbajo(fila.yoy)} ${etiquetaMesCorta(anio - 1, mes)}`);
  if (fila.invSemanas != null) p.push(`; tiene ${fila.invSemanas.toFixed(1)} semanas de inventario`);
  if (alertas?.sinStockConVenta) p.push(` y ${int(alertas.sinStockConVenta)} SKU${alertas.sinStockConVenta === 1 ? '' : 's'} con venta sin stock`);
  return `${p.join('')}.`;
}

export { money as fmtMoney, int as fmtInt, pct as fmtPct, signo as fmtSigno, canalLabel, N };
