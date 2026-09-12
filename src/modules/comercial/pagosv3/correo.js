// Texto del correo de solicitud · Pagos V3 (2026-09-12) · PURO
//
// El dashboard NO envía correos: genera asunto + cuerpo para copiar y pegar.
// Las plantillas siguen los correos reales de Fernando y Karolina:
//   1) "Spiff Julio PCEL 2026"        → dispersión de SPIFF (Lucy) · tabla Mes · Objetivo Sell In · Facturación · Spiff
//   2) "Rebates Dicotech Julio y Agosto 2026" → tabla Mes · Alcance · Rebate Pagado · Rebate Correcto · Diferencia
//   3) Marketing (Karolina)           → "Me apoyas a realizar el pago correspondiente a … por nota de crédito"
// La firma sale del perfil que solicita; los destinatarios, de pagos_reglas('_global','destinatarios').

import { CLIENTE_LABEL, REGLAS_DEFAULT } from './reglas.js';
import { MESES_LARGOS } from './motor.js';

const mxn = (n) => {
  const v = Math.round(Number(n) || 0);
  return '$' + v.toLocaleString('es-MX');
};
const mxn2 = (n) => '$' + (Number(n) || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (n) => (Number(n) || 0) * 100 < 0.01 ? '0 %' : `${((Number(n) || 0) * 100).toFixed(0)} %`;

/** Tabla de texto plano alineada (se pega tal cual en el correo). */
export function tablaTexto(encabezados, filas) {
  const cols = encabezados.length;
  const todo = [encabezados, ...filas.map((f) => f.map((c) => (c == null ? '' : String(c))))];
  const anchos = Array.from({ length: cols }, (_, i) => Math.max(...todo.map((f) => (f[i] || '').length)));
  const linea = (f) => f.map((c, i) => String(c || '').padEnd(anchos[i])).join('   ').trimEnd();
  return [linea(encabezados), anchos.map((a) => '─'.repeat(a)).join('   '), ...filas.map(linea)].join('\n');
}

function mesDePeriodo(periodo) {
  const s = String(periodo || '');
  if (/^\d{4}-Q\d$/.test(s)) return `Q${s.slice(-1)} ${s.slice(0, 4)}`;
  const m = Number(s.slice(5, 7));
  return m >= 1 && m <= 12 ? `${MESES_LARGOS[m - 1]} ${s.slice(0, 4)}` : s;
}

function destinatarios(reglaDest, tipo) {
  const cfg = reglaDest || REGLAS_DEFAULT._global.destinatarios;
  const t = cfg.por_tipo?.[tipo] || cfg.por_tipo?.default || {};
  const nombra = (p) => (p.correo ? `${p.nombre} <${p.correo}>` : p.nombre);
  return {
    saludo: t.saludo || 'Buen día',
    para: (t.para || []).map(nombra),
    cc: (cfg.copia_siempre || []).map(nombra),
  };
}

function firmaDe(perfil, reglaDest) {
  if (perfil?.nombre) return String(perfil.nombre).split(' ')[0];
  const cfg = reglaDest || REGLAS_DEFAULT._global.destinatarios;
  return cfg.firmas?.fernando?.nombre || 'Fernando';
}

/**
 * Genera el correo de solicitud de un pago.
 * @returns { asunto, cuerpo, para, cc, texto }  — `texto` = asunto + cuerpo listo para copiar.
 */
export function correoSolicitud({ pago, perfil, reglaDestinatarios, pagosRelacionados = [] }) {
  const cliente = CLIENTE_LABEL[pago.cliente] || pago.cliente || '';
  const tipo = pago.tipo || 'otro';
  const d = destinatarios(reglaDestinatarios, tipo);
  const firma = firmaDe(perfil, reglaDestinatarios);
  const periodoTxt = mesDePeriodo(pago.periodo);
  const det = pago.detalle || {};
  let asunto = '';
  let cuerpo = '';

  if (tipo === 'spiff' || tipo === 'dinamica') {
    // Plantilla 1 · dispersión de SPIFF (correo real "Spiff Julio PCEL 2026")
    asunto = tipo === 'dinamica'
      ? `Premios dinámica ${periodoTxt} ${cliente}`
      : `Spiff ${periodoTxt} ${cliente}`;
    const lineasPersona = (det.ganadores || det.personas || [])
      .map((g) => `${g.nombre} ${mxn(g.monto || g.importe)}`);
    const cuerpoPersonas = lineasPersona.length ? `\n\n${lineasPersona.join('\n')}` : '';
    const tabla = tipo === 'dinamica'
      ? tablaTexto(['#', 'Vendedor', 'Venta sin IVA', 'Premio'],
          (det.ganadores || []).map((g) => [g.posicion, g.nombre, mxn(g.importe), g.premio || '—']))
      : tablaTexto(['Mes', 'Objetivo Sell In', 'Facturación', 'Spiff'],
          [[periodoTxt, mxn(det.cuota), mxn(det.base), mxn(pago.monto)]]);
    cuerpo = `${d.saludo}, solicito tu apoyo para hacer la dispersión de los ${tipo === 'dinamica' ? 'premios de la dinámica' : 'Spiff'} generados en ${periodoTxt} para el equipo de ${cliente}.${cuerpoPersonas}\n\n${tabla}\n\nTotal: ${mxn2(pago.monto)}\n\nQuedo al pendiente de tus comentarios\n\n${firma}`;

  } else if (tipo === 'rebate') {
    // Plantilla 2 · rebates (correo real "Rebates Dicotech Julio y Agosto 2026")
    const lote = pagosRelacionados.length ? pagosRelacionados : [pago];
    const periodos = lote.map((p) => mesDePeriodo(p.periodo));
    asunto = `Rebates ${cliente} ${periodos.join(' y ')}`;
    const filas = lote.map((p) => {
      const dd = p.detalle || {};
      const pagado = Number(dd.rebate_pagado || 0);
      const correcto = Number(p.monto || 0);
      return [mesDePeriodo(p.periodo), pct(dd.alcance), mxn(pagado), mxn(correcto), mxn(correcto - pagado)];
    });
    const total = lote.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    cuerpo = `${d.saludo},\n\nEnvío el cálculo del rebate de ${cliente} correspondiente a ${periodos.join(' y ')}, sobre el sell in del mes cerrado (sin IVA) y el porcentaje vigente por nivel de alcance. Solicito su apoyo para autorizar la aplicación vía nota de crédito.\n\n${tablaTexto(['Mes', 'Alcance', 'Rebate Pagado', 'Rebate Correcto', 'Diferencia'], filas)}\n\nTotal a aplicar: ${mxn2(total)}\n\nQuedo al pendiente de cualquier duda o comentario\n\n${firma}`;

  } else if (tipo === 'marketing') {
    // Plantilla 3 · marketing (correo real de Karolina)
    asunto = `Pago de marketing ${cliente} · ${periodoTxt}`;
    const filas = (det.filas || []).map((f) => [f.concepto, mxn2(f.monto), periodoTxt]);
    const tabla = filas.length ? `\n\n${tablaTexto(['Actividad', 'Total', 'Mes'], filas)}` : '';
    cuerpo = `${d.saludo}. Me apoyas a realizar el pago correspondiente a ${cliente} sobre las campañas de este mes, por favor. Este mes sería de ${mxn2(pago.monto)} y será por nota de crédito.${tabla}\n\nQuedo al pendiente de cualquier duda o comentario\n\n${firma}`;

  } else {
    // Plantilla genérica (protección de precio, bonificaciones, fijos, ajustes)
    asunto = `Solicitud de pago · ${pago.concepto}`;
    const filas = (det.filas || []).map((f) => [f.concepto, f.base != null ? mxn(f.base) : '—', f.pct != null ? `${(f.pct * 100).toFixed(2)} %` : '—', mxn2(f.monto)]);
    const tabla = filas.length ? `\n\n${tablaTexto(['Concepto', 'Base', '%', 'Monto'], filas)}` : '';
    cuerpo = `${d.saludo}, solicito autorización del pago "${pago.concepto}" para ${cliente} por ${mxn2(pago.monto)}${pago.periodo ? `, correspondiente a ${periodoTxt}` : ''}. Se aplicará vía nota de crédito.${tabla}\n\nFecha programada de pago: ${pago.fecha_programada || '—'}.\n\nQuedo al pendiente de cualquier duda o comentario\n\n${firma}`;
  }

  const cabecera = `Para: ${d.para.join(', ') || '—'}\nCC: ${d.cc.join(', ') || '—'}\nAsunto: ${asunto}\n\n`;
  return { asunto, cuerpo, para: d.para, cc: d.cc, texto: cabecera + cuerpo };
}

/** Correo de un lote (varios pagos del mismo cliente y tipo) — "Solicitar los calculados". */
export function correoLote({ pagos = [], perfil, reglaDestinatarios }) {
  if (pagos.length === 0) return null;
  if (pagos.length === 1) return correoSolicitud({ pago: pagos[0], perfil, reglaDestinatarios });
  const porTipo = pagos.every((p) => p.tipo === pagos[0].tipo) && pagos.every((p) => p.cliente === pagos[0].cliente);
  if (porTipo && pagos[0].tipo === 'rebate') {
    return correoSolicitud({ pago: pagos[0], perfil, reglaDestinatarios, pagosRelacionados: pagos });
  }
  const d = destinatarios(reglaDestinatarios, 'default');
  const firma = firmaDe(perfil, reglaDestinatarios);
  const total = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const filas = pagos.map((p) => [CLIENTE_LABEL[p.cliente] || p.cliente, p.concepto, mesDePeriodo(p.periodo), mxn2(p.monto), p.fecha_programada || '—']);
  const asunto = `Solicitud de pagos · ${pagos.length} conceptos · ${mesDePeriodo(pagos[0].periodo)}`;
  const cuerpo = `${d.saludo}, solicito autorización de los siguientes pagos. Todos se aplicarán vía nota de crédito.\n\n${tablaTexto(['Cliente', 'Concepto', 'Periodo', 'Monto', 'Fecha de pago'], filas)}\n\nTotal: ${mxn2(total)}\n\nQuedo al pendiente de cualquier duda o comentario\n\n${firma}`;
  return { asunto, cuerpo, para: d.para, cc: d.cc, texto: `Para: ${d.para.join(', ') || '—'}\nCC: ${d.cc.join(', ') || '—'}\nAsunto: ${asunto}\n\n${cuerpo}` };
}

/** mailto: con asunto y cuerpo ya codificados (por si Fernando prefiere abrir el cliente de correo). */
export function mailto(correo) {
  const dir = (correo.para || []).map((p) => (p.match(/<(.+)>/) || [])[1]).filter(Boolean).join(',');
  const cc = (correo.cc || []).map((p) => (p.match(/<(.+)>/) || [])[1]).filter(Boolean).join(',');
  const q = [`subject=${encodeURIComponent(correo.asunto)}`, `body=${encodeURIComponent(correo.cuerpo)}`];
  if (cc) q.push(`cc=${encodeURIComponent(cc)}`);
  return `mailto:${dir}?${q.join('&')}`;
}

export default { correoSolicitud, correoLote, mailto, tablaTexto };
