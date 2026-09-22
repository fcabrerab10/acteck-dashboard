// Minuta por correo al cliente (2026-09-22). Arma asunto, HTML y texto plano a partir de la reunión y
// sus puntos; lo manda api/google-calendar.js?action=enviar-minuta. Sin dependencias para poder probarlo:
// node --test scripts/test-minuta-correo.mjs
const CLIENTES = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
const CATEGORIAS = { comercial: 'Comercial', marketing: 'Marketing', pagos: 'Pagos', administracion: 'Administración', logistico: 'Logístico' };
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export const nombreCliente = (k) => CLIENTES[k] || (k ? k.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Interno');
export function fechaCorta(iso) {
  if (!iso) return '';
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
const primerNombre = (n) => String(n || '').trim().split(/\s+/)[0] || '';

/** Valida y limpia una lista de correos; devuelve los válidos en minúsculas y sin repetir. */
export function limpiarCorreos(lista = []) {
  const out = [];
  for (const raw of Array.isArray(lista) ? lista : [lista]) {
    const e = String(raw || '').trim().toLowerCase();
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) && !out.includes(e)) out.push(e);
  }
  return out;
}

/**
 * armarCorreoMinuta({ reunion, puntos, personas, mensaje, remitente }) → { asunto, html, texto }
 *  reunion   fila de agenda_reuniones · puntos: agenda_items de esa reunión (orden asc)
 *  personas  [{ user_id, nombre }] para los responsables · mensaje: párrafo libre de quien envía
 *  remitente { nombre, email }
 */
export function armarCorreoMinuta({ reunion, puntos = [], personas = [], mensaje = '', remitente = {} }) {
  const cliente = nombreCliente(reunion.cliente_key);
  const f = new Date(reunion.fecha);
  const fecha = Number.isNaN(f.getTime()) ? '' : `${f.getDate()} de ${['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'][f.getMonth()]} de ${f.getFullYear()}`;
  const nombreDe = (uid) => primerNombre(personas.find((p) => p.user_id === uid)?.nombre);
  const asunto = `Minuta · ${cliente} · ${fechaCorta(reunion.fecha)}${reunion.titulo ? ` · ${reunion.titulo}` : ''}`;
  const orden = ['comercial', 'marketing', 'pagos', 'administracion', 'logistico', '__sin__'];
  const grupos = new Map();
  for (const p of puntos) { if (p.estado === 'cancelada') continue; const k = CATEGORIAS[p.categoria] ? p.categoria : '__sin__'; if (!grupos.has(k)) grupos.set(k, []); grupos.get(k).push(p); }
  const resueltos = puntos.filter((p) => p.estado === 'hecha').length;
  const abiertos = puntos.filter((p) => p.estado === 'abierta' || p.estado === 'arrastrada').length;
  const asistentes = (reunion.asistentes || []).map((a) => a.nombre || nombreDe(a.user_id)).filter(Boolean);

  const filaHtml = (p) => {
    const hecha = p.estado === 'hecha';
    const resp = (p.responsables || []).map(nombreDe).filter(Boolean).join(', ');
    const meta = [resp, p.fecha_limite ? `para el ${fechaCorta(p.fecha_limite)}` : ''].filter(Boolean).join(' · ');
    return `<tr>
      <td style="padding:7px 8px 7px 0;vertical-align:top;width:18px;font-size:14px;color:${hecha ? '#34C759' : '#8E8E93'}">${hecha ? '&#10003;' : '&#9675;'}</td>
      <td style="padding:7px 0;vertical-align:top;border-bottom:1px solid #EAEAEC">
        <div style="font-size:14px;color:#1D1D1F;${hecha ? 'text-decoration:line-through;color:#6E6E73' : ''}">${esc(p.titulo)}</div>
        ${meta ? `<div style="font-size:12px;color:#6E6E73;margin-top:2px">${esc(meta)}</div>` : ''}
        ${p.resolucion ? `<div style="font-size:12.5px;color:#1D1D1F;margin-top:3px"><span style="color:#6E6E73">Quedó:</span> ${esc(p.resolucion)}</div>` : ''}
      </td></tr>`;
  };
  const filaTxt = (p) => {
    const resp = (p.responsables || []).map(nombreDe).filter(Boolean).join(', ');
    const meta = [resp, p.fecha_limite ? `para el ${fechaCorta(p.fecha_limite)}` : ''].filter(Boolean).join(' · ');
    return `${p.estado === 'hecha' ? '[x]' : '[ ]'} ${p.titulo}${meta ? ` · ${meta}` : ''}${p.resolucion ? ` — quedó: ${p.resolucion}` : ''}`;
  };

  let secciones = '';
  const T = [];
  for (const k of orden) {
    const arr = grupos.get(k); if (!arr?.length) continue;
    const titulo = k === '__sin__' ? (grupos.size > 1 ? 'Otros puntos' : 'Puntos') : CATEGORIAS[k];
    secciones += `<div style="font:600 11px -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6E6E73;margin:18px 0 4px">${esc(titulo)}</div>
      <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;border-collapse:collapse">${arr.map(filaHtml).join('')}</table>`;
    T.push('', titulo.toUpperCase(), ...arr.map(filaTxt));
  }
  const notas = String(reunion.notas || '').trim();
  const firma = remitente.nombre ? `${remitente.nombre}${remitente.puesto ? ` · ${remitente.puesto}` : ''}` : 'Acteck';

  const html = `<!doctype html><html lang="es"><body style="margin:0;background:#F5F5F7;padding:24px 12px">
  <div style="max-width:640px;margin:0 auto;background:#FFFFFF;border-radius:14px;padding:26px 28px;font:14px/1.45 -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;color:#1D1D1F">
    <div style="font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#6E6E73">Minuta · ${esc(cliente)}</div>
    <div style="font-size:22px;font-weight:700;letter-spacing:-.02em;margin-top:4px">${esc(reunion.titulo || `Reunión con ${cliente}`)}</div>
    <div style="font-size:13px;color:#6E6E73;margin-top:4px">${esc(fecha)}${reunion.lugar ? ` · ${esc(reunion.lugar)}` : ''}${asistentes.length ? ` · ${esc(asistentes.join(', '))}` : ''}</div>
    ${mensaje ? `<p style="margin:18px 0 0;white-space:pre-wrap">${esc(mensaje)}</p>` : ''}
    ${secciones}
    ${notas ? `<div style="font:600 11px -apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:#6E6E73;margin:18px 0 4px">Notas</div><p style="margin:0;white-space:pre-wrap">${esc(notas)}</p>` : ''}
    <div style="margin-top:20px;padding-top:12px;border-top:1px solid #EAEAEC;font-size:12.5px;color:#6E6E73">${resueltos} resuelto${resueltos === 1 ? '' : 's'} · ${abiertos} pendiente${abiertos === 1 ? '' : 's'} de seguimiento</div>
    <div style="margin-top:16px;font-size:13px">${esc(firma)}<br><span style="color:#6E6E73">${esc(remitente.email || '')}</span></div>
  </div></body></html>`;

  const texto = [`MINUTA · ${cliente.toUpperCase()} · ${fecha}`, reunion.titulo || '', asistentes.length ? `Asistentes: ${asistentes.join(', ')}` : '', mensaje ? `\n${mensaje}` : '', ...T, notas ? `\nNOTAS\n${notas}` : '', '', `${resueltos} resueltos · ${abiertos} pendientes`, '', firma, remitente.email || ''].filter((l) => l !== null).join('\n');
  return { asunto, html, texto };
}
