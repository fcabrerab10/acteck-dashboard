// Agenda · cálculo puro (sin React, sin Supabase). Se prueba en Node: node scripts/test-agenda-calculo.mjs
//
// Entrada: filas de agenda_items / agenda_reuniones tal cual + fuentes del sistema (alertas,
// v_transito_sku, frescura de fuentes manuales, filas del Tracking, eventos de Google).
// Salida: bandeja (vencidas / hoy / próximos), avisos del sistema, conteos por etiqueta,
// columnas del tablero, eventos de calendario por día y textos del hero.
// La app móvil (src/movil) reutiliza estas funciones tal cual.

import { normalizar, coincide, CATEGORIAS, nombreClienteAgenda } from './etiquetas.js';

export const DIA_MS = 86400000;
export const PROXIMOS_DIAS = 7;
export const DIAS_CIERRE_MES = 3;
export const DIAS_COTIZACION_VENCE = 7;
const MESES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS_CORTO = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];

// ── Fechas (sin corrimiento de zona: todo en local) ──
export const isoDia = (d) => {
  if (!d) return null;
  if (typeof d === 'string') return d.slice(0, 10);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const parseISO = (s) => {
  if (!s) return null;
  if (s instanceof Date) return s;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) { const d = new Date(s); return Number.isNaN(d.getTime()) ? null : d; }
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
export const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const sumarDias = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
export const diasEntre = (a, b) => Math.round((inicioDia(parseISO(b)) - inicioDia(parseISO(a))) / DIA_MS);
export const inicioSemana = (d) => { const x = inicioDia(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return x; };
export const fmtCorta = (iso) => { const d = parseISO(iso); return d ? `${d.getDate()} ${MESES_CORTO[d.getMonth()]}` : '—'; };
export const fmtDiaSemana = (iso) => { const d = parseISO(iso); return d ? DIAS_CORTO[d.getDay()] : ''; };
export const fmtHora = (ts) => { const d = ts instanceof Date ? ts : new Date(ts); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };

/** 'hoy' · 'ayer' · 'mañana' · '8 sep' · 'hace 3 d' (para vencidas). */
export function cuando(iso, hoy = new Date()) {
  if (!iso) return 'sin fecha';
  const n = diasEntre(hoy, iso);
  if (n === 0) return 'hoy';
  if (n === -1) return 'ayer';
  if (n === 1) return 'mañana';
  if (n < -1 && n >= -6) return `hace ${-n} d`;
  if (n > 1 && n <= 6) return fmtDiaSemana(iso);
  return fmtCorta(iso);
}

// ── Clasificación de ítems ──
export const abierto = (it) => it.estado === 'abierta';
export const vencido = (it, hoy = new Date()) => abierto(it) && !!it.fecha_limite && diasEntre(hoy, it.fecha_limite) < 0;
export const deHoy = (it, hoy = new Date()) => abierto(it) && !!it.fecha_limite && diasEntre(hoy, it.fecha_limite) === 0;
export const proximo = (it, hoy = new Date(), dias = PROXIMOS_DIAS) => abierto(it) && !!it.fecha_limite && diasEntre(hoy, it.fecha_limite) > 0 && diasEntre(hoy, it.fecha_limite) <= dias;

/** Bandeja: secciones Vencidas / Hoy / Próximos / Sin fecha (sólo abiertos), ordenadas por fecha, prioridad. */
export function bandeja(items, hoy = new Date(), { dias = PROXIMOS_DIAS } = {}) {
  const abiertos = (items || []).filter(abierto);
  const orden = (a, b) => String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999')) || prioridadN(b) - prioridadN(a) || String(a.created_at || '').localeCompare(String(b.created_at || ''));
  return {
    vencidas: abiertos.filter((it) => vencido(it, hoy)).sort(orden),
    hoy: abiertos.filter((it) => deHoy(it, hoy)).sort(orden),
    proximos: abiertos.filter((it) => proximo(it, hoy, dias)).sort(orden),
    sinFecha: abiertos.filter((it) => !it.fecha_limite).sort(orden),
    abiertos,
  };
}
const prioridadN = (it) => ({ alta: 2, media: 1, baja: 0 }[it.prioridad] ?? 1);

/** Ítems según el segmento Hoy · Semana · Todo (abiertos; Hoy = vencidas + hoy + avisos de hoy). */
export function segmento(items, seg, hoy = new Date()) {
  const abiertos = (items || []).filter(abierto);
  if (seg === 'todo') return abiertos;
  if (seg === 'semana') { const fin = sumarDias(inicioSemana(hoy), 6); return abiertos.filter((it) => !it.fecha_limite || parseISO(it.fecha_limite) <= fin); }
  return abiertos.filter((it) => vencido(it, hoy) || deHoy(it, hoy) || (!it.fecha_limite && it.tipo === 'punto'));
}

/** Búsqueda sin acentos sobre título, notas, cliente, categoría y nombres de responsables. */
export function textoBusqueda(it, personasPorId = new Map()) {
  return normalizar([it.titulo, it.notas, it.cliente_key, nombreClienteAgenda(it.cliente_key), it.categoria, ...(it.responsables || []).map((u) => personasPorId.get(u)?.nombre || '')].filter(Boolean).join(' '));
}

export const FILTROS_VACIOS = () => ({ q: '', personas: new Set(), clientes: new Set(), categorias: new Set(), vencidas: false, tipo: null });

export function pasaFiltros(it, f, hoy = new Date(), personasPorId) {
  if (!f) return true;
  if (f.personas?.size && !(it.responsables || []).some((u) => f.personas.has(u)) && !(f.personas.has('__sin__') && !(it.responsables || []).length)) return false;
  if (f.clientes?.size && !f.clientes.has(it.cliente_key || 'interno')) return false;
  if (f.categorias?.size && !f.categorias.has(it.categoria || '__sin__')) return false;
  if (f.vencidas && !vencido(it, hoy)) return false;
  if (f.tipo && it.tipo !== f.tipo && !(f.tipo === 'sistema' && it.fuente)) return false;
  if (f.q && !coincide(textoBusqueda(it, personasPorId), f.q)) return false;
  return true;
}

/** Conteos por persona / cliente / categoría / vencidas sobre ítems abiertos (para las pills de filtro). */
export function conteos(items, hoy = new Date()) {
  const personas = new Map(), clientes = new Map(), categorias = new Map();
  let vencidas = 0, sinResponsable = 0;
  for (const it of (items || []).filter(abierto)) {
    if (vencido(it, hoy)) vencidas += 1;
    const resp = it.responsables || [];
    if (!resp.length) sinResponsable += 1;
    for (const u of resp) personas.set(u, (personas.get(u) || 0) + 1);
    const ck = it.cliente_key || 'interno';
    clientes.set(ck, (clientes.get(ck) || 0) + 1);
    const cat = it.categoria || '__sin__';
    categorias.set(cat, (categorias.get(cat) || 0) + 1);
  }
  return { personas, clientes, categorias, vencidas, sinResponsable };
}

/** Pendientes por persona: { user_id, total, vencidas, hoy, puntos, pct } (pct = al día). */
export function equipo(items, personas, hoy = new Date()) {
  return (personas || []).map((p) => {
    const mios = (items || []).filter((it) => abierto(it) && (it.responsables || []).includes(p.user_id));
    const venc = mios.filter((it) => vencido(it, hoy)).length;
    return {
      user_id: p.user_id, nombre: p.nombre, handle: p.handle,
      total: mios.length, vencidas: venc, hoy: mios.filter((it) => deHoy(it, hoy)).length,
      puntos: mios.filter((it) => it.tipo === 'punto').length,
      pct: mios.length ? Math.round(((mios.length - venc) / mios.length) * 100) : 100,
    };
  }).sort((a, b) => b.total - a.total);
}

/** % de tareas cerradas a tiempo en los últimos `dias` días (completado_en ≤ fecha_limite). */
export function cumplimiento(items, hoy = new Date(), dias = 30) {
  const desde = sumarDias(hoy, -dias);
  const cerradas = (items || []).filter((it) => it.estado === 'hecha' && it.completado_en && new Date(it.completado_en) >= desde);
  if (!cerradas.length) return null;
  const aTiempo = cerradas.filter((it) => !it.fecha_limite || isoDia(new Date(it.completado_en)) <= it.fecha_limite).length;
  return Math.round((aTiempo / cerradas.length) * 100);
}

// ── Reuniones ──
/** Veces que un punto se ha arrastrado (largo de la cadena arrastrado_desde). */
export function vecesArrastrado(item, porId) {
  let n = 0, cur = item;
  const vistos = new Set();
  while (cur?.arrastrado_desde && !vistos.has(cur.arrastrado_desde)) { vistos.add(cur.arrastrado_desde); n += 1; cur = porId?.get(cur.arrastrado_desde); if (!cur) break; }
  return n || Number(item?.origen?.arrastres) || 0;
}
export const ordinal = (n) => (n <= 0 ? '' : `${n + 1}ª vez`);

/** Resumen de una reunión con sus puntos. */
export function resumenReunion(reunion, items, porId) {
  const puntos = (items || []).filter((it) => it.tipo === 'punto' && it.reunion_id === reunion.id).sort((a, b) => a.orden - b.orden || String(a.created_at || '').localeCompare(String(b.created_at || '')));
  const abiertos = puntos.filter(abierto);
  const resueltos = puntos.filter((it) => it.estado === 'hecha');
  const arrastradosFuera = puntos.filter((it) => it.estado === 'arrastrada');
  const arrastradosAqui = puntos.filter((it) => !!it.arrastrado_desde);
  const porCategoria = new Map();
  for (const p of puntos) { const k = p.categoria || '__sin__'; porCategoria.set(k, (porCategoria.get(k) || 0) + 1); }
  const sinResponsable = abiertos.filter((it) => !(it.responsables || []).length).length;
  const masArrastrado = abiertos.reduce((m, it) => Math.max(m, vecesArrastrado(it, porId)), 0);
  return { puntos, abiertos, resueltos, arrastradosFuera, arrastradosAqui, porCategoria, sinResponsable, masArrastrado };
}

/** Reuniones ordenadas: futuras/en curso primero (asc), luego pasadas (desc). */
export function ordenarReuniones(reuniones, hoy = new Date()) {
  const ahora = hoy.getTime();
  const fut = (reuniones || []).filter((r) => r.estado !== 'cerrada' && new Date(r.fecha).getTime() >= ahora - 12 * 3600000).sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
  const ids = new Set(fut.map((r) => r.id));
  const pas = (reuniones || []).filter((r) => !ids.has(r.id)).sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
  return [...fut, ...pas];
}

/** Próxima reunión (no cerrada) de un cliente. */
export function proximaReunion(reuniones, clienteKey, hoy = new Date()) {
  return (reuniones || []).filter((r) => r.tipo === 'reunion' && r.estado !== 'cerrada' && (r.cliente_key || 'interno') === (clienteKey || 'interno') && new Date(r.fecha) >= inicioDia(hoy)).sort((a, b) => new Date(a.fecha) - new Date(b.fecha))[0] || null;
}

// ── Avisos del sistema ──
// Cada aviso: { id, tipo:'sistema', fuente, titulo, sub, cliente_key, fecha (iso día), severidad, accion:{ clienteKey, pagina, label } }
export function avisosSistema({ alertas = [], transito = [], fuentesManuales = [], tracking = [], hoy = new Date() } = {}) {
  const out = [];
  const hoyIso = isoDia(hoy), maniana = isoDia(sumarDias(hoy, 1));
  // 1. Alertas de la central (sin las de agenda: ésas ya son tareas)
  for (const a of alertas) {
    if (a.area === 'agenda' || String(a.tipo || '').startsWith('agenda_')) continue;
    out.push({ id: `alerta:${a.id}`, tipo: 'sistema', fuente: 'Alertas', titulo: a.titulo, sub: a.detalle || '', cliente_key: a.cliente_key || null, fecha: hoyIso, severidad: a.severidad, alerta: a,
      accion: a.accion && a.accion.tipo === 'navegar' ? { clienteKey: a.accion.clienteKey ?? null, pagina: a.accion.pagina, label: a.accion.label || 'Ver' } : null });
  }
  // 2. Arribos de PO hoy / mañana (v_transito_sku.embarques_detalle: [{ po, eta, cantidad }])
  const porPo = new Map();
  for (const t of transito) {
    for (const e of Array.isArray(t.embarques_detalle) ? t.embarques_detalle : []) {
      const eta = isoDia(e.eta);
      if (eta !== hoyIso && eta !== maniana) continue;
      const k = `${e.po}|${eta}`;
      if (!porPo.has(k)) porPo.set(k, { po: e.po, eta, skus: 0, piezas: 0 });
      const p = porPo.get(k); p.skus += 1; p.piezas += Number(e.cantidad ?? e.qty ?? t.cantidad) || 0;
    }
  }
  for (const p of porPo.values()) {
    out.push({ id: `po:${p.po}:${p.eta}`, tipo: 'sistema', fuente: 'Tracking', titulo: `Llega PO ${p.po} · ${fmtN(p.piezas)} pz · ${p.skus} SKU${p.skus === 1 ? '' : 's'}`, sub: p.eta === hoyIso ? 'arribo a CEDIS hoy' : 'arribo a CEDIS mañana', cliente_key: null, fecha: p.eta, severidad: 'info',
      accion: { clienteKey: null, pagina: 'inventarioGlobal', label: 'Ver inventario' } });
  }
  // 3. Cargas manuales del importador que tocan hoy (estadoManual de importador/frescura.js)
  for (const f of fuentesManuales) {
    const est = f.estado; if (!est || est.cambio) continue;
    const venceIso = est.vence ? isoDia(est.vence) : null;
    if (est.estado === 'atrasada') out.push({ id: `carga:${f.id}`, tipo: 'sistema', fuente: 'Importador', titulo: `Carga ${f.titulo} atrasada${est.diasAtraso ? ` · ${est.diasAtraso} d` : ''}`, sub: f.grupoLabel || '', cliente_key: f.grupo && ['digitalife', 'pcel', 'dicotech'].includes(f.grupo) ? f.grupo : null, fecha: venceIso || hoyIso, severidad: 'alta', accion: { clienteKey: null, pagina: 'actualizacion', label: 'Ir al importador' } });
    else if (est.estado === 'por_vencer' || venceIso === hoyIso) out.push({ id: `carga:${f.id}`, tipo: 'sistema', fuente: 'Importador', titulo: `Carga ${f.titulo} pendiente${est.diasParaLimite != null ? ` · ${est.diasParaLimite} d para el límite` : ''}`, sub: f.grupoLabel || '', cliente_key: f.grupo && ['digitalife', 'pcel', 'dicotech'].includes(f.grupo) ? f.grupo : null, fecha: hoyIso, severidad: 'media', accion: { clienteKey: null, pagina: 'actualizacion', label: 'Ir al importador' } });
  }
  // 4. Tracking: cotizaciones por vencer (> DIAS_COTIZACION_VENCE sin respuesta) y OCs detenidas
  for (const o of tracking) {
    if (o.esCotizacion && o.abierta && o.diasEnEtapa != null && o.diasEnEtapa >= DIAS_COTIZACION_VENCE - 2) {
      out.push({ id: `cot:${o.id}`, tipo: 'sistema', fuente: 'Tracking', titulo: `Cotización ${o.numero_oc_cliente} lleva ${Math.floor(o.diasEnEtapa)} d sin respuesta`, sub: `${nombreClienteAgenda(o.cliente_key)} · ${fmtN(o.pedido)} pz`, cliente_key: o.cliente_key, fecha: hoyIso, severidad: o.diasEnEtapa > DIAS_COTIZACION_VENCE ? 'alta' : 'media', accion: { clienteKey: null, pagina: 'ordenesCompra', label: 'Ver cotización' } });
    } else if (!o.esCotizacion && o.detenida) {
      out.push({ id: `oc:${o.id}`, tipo: 'sistema', fuente: 'Tracking', titulo: `OC ${o.numero_oc_cliente} detenida ${Math.floor(o.diasEnEtapa || 0)} d en ${o.etapa}`, sub: `${nombreClienteAgenda(o.cliente_key)} · ${fmtN(o.pedido)} pz · ${fmtN(o.facturado)} facturadas`, cliente_key: o.cliente_key, fecha: hoyIso, severidad: 'media', accion: { clienteKey: null, pagina: 'ordenesCompra', label: 'Ver OC' } });
    }
  }
  // 5. Cierre de mes (últimos DIAS_CIERRE_MES días)
  const ultimo = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0).getDate();
  const faltan = ultimo - hoy.getDate();
  if (faltan < DIAS_CIERRE_MES) out.push({ id: `cierre:${hoy.getFullYear()}-${hoy.getMonth() + 1}`, tipo: 'sistema', fuente: 'Calendario', titulo: faltan === 0 ? 'Hoy cierra el mes' : `Cierre de mes en ${faltan} día${faltan === 1 ? '' : 's'}`, sub: 'revisar cuota, cortes y P&L el día 10', cliente_key: null, fecha: hoyIso, severidad: 'media', accion: { clienteKey: null, pagina: 'visionGeneral', label: 'Ver Visión General' } });
  return out;
}
const fmtN = (n) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(n) || 0);

// ── Tablero ──
export const MODOS_TABLERO = [
  { id: 'cliente', label: 'Cliente' }, { id: 'persona', label: 'Persona' }, { id: 'categoria', label: 'Categoría' }, { id: 'estado', label: 'Estado' },
];
const CLIENTES_ORDEN = ['pcel', 'digitalife', 'dicotech', 'interno'];

/**
 * Columnas del tablero según el modo. `tarjetas` = ítems abiertos (+ hechos hoy) + reuniones + avisos, cada uno con
 * { clave: 'item'|'reunion'|'sistema', … }. Devuelve [{ id, label, tag, tarjetas }] con "Hecho" al final en modo estado.
 */
export function columnasTablero(tarjetas, modo, personas = [], hoy = new Date()) {
  const cols = new Map();
  const asegurar = (id, label, tag) => { if (!cols.has(id)) cols.set(id, { id, label, tag, tarjetas: [] }); return cols.get(id); };
  if (modo === 'cliente') for (const k of CLIENTES_ORDEN) asegurar(k, nombreClienteAgenda(k), `#${k}`);
  if (modo === 'persona') { for (const p of personas) asegurar(p.user_id, p.nombre, `@${p.handle || ''}`); asegurar('__sin__', 'Sin responsable', ''); }
  if (modo === 'categoria') { for (const c of CATEGORIAS) asegurar(c.id, c.label, `/${c.id}`); asegurar('__sin__', 'Sin categoría', ''); }
  if (modo === 'estado') { asegurar('vencida', 'Vencidas', ''); asegurar('hoy', 'Hoy', ''); asegurar('proximo', 'Próximos', ''); asegurar('sinfecha', 'Sin fecha', ''); asegurar('hecha', 'Hecho', ''); }
  for (const t of tarjetas) {
    if (modo === 'cliente') { const k = t.cliente_key || 'interno'; asegurar(k, nombreClienteAgenda(k), `#${k}`).tarjetas.push(t); }
    else if (modo === 'persona') {
      const resp = t.responsables || [];
      if (!resp.length) asegurar('__sin__', 'Sin responsable', '').tarjetas.push(t);
      for (const u of resp) asegurar(u, personas.find((p) => p.user_id === u)?.nombre || '…', '').tarjetas.push(t);
    } else if (modo === 'categoria') { const k = t.categoria || '__sin__'; asegurar(k, k === '__sin__' ? 'Sin categoría' : (CATEGORIAS.find((c) => c.id === k)?.label || k), k === '__sin__' ? '' : `/${k}`).tarjetas.push(t); }
    else {
      const id = t.clave !== 'item' ? (t.fecha && diasEntre(hoy, t.fecha) === 0 ? 'hoy' : t.fecha && diasEntre(hoy, t.fecha) < 0 ? 'vencida' : 'proximo')
        : t.estado === 'hecha' ? 'hecha' : vencido(t, hoy) ? 'vencida' : deHoy(t, hoy) ? 'hoy' : t.fecha_limite ? 'proximo' : 'sinfecha';
      cols.get(id).tarjetas.push(t);
    }
  }
  const lista = [...cols.values()];
  if (modo === 'estado') return lista;
  const hecho = { id: '__hecho__', label: 'Hecho', tag: '', tarjetas: [], zona: true };
  return [...lista.filter((c) => c.tarjetas.length || CLIENTES_ORDEN.includes(c.id) || modo !== 'cliente').sort((a, b) => b.tarjetas.length - a.tarjetas.length), hecho];
}

/** Qué cambia en un ítem al soltarlo en la columna `colId` del modo `modo`. null = no aplica (p. ej. reuniones). */
export function cambioAlSoltar(modo, colId, item) {
  if (!item || item.clave !== 'item') return null;
  if (colId === '__hecho__' || (modo === 'estado' && colId === 'hecha')) return { estado: 'hecha', completado_en: new Date().toISOString() };
  if (modo === 'cliente') return { cliente_key: colId };
  if (modo === 'persona') return { responsables: colId === '__sin__' ? [] : [colId] };
  if (modo === 'categoria') return { categoria: colId === '__sin__' ? null : colId };
  if (modo === 'estado') {
    const hoy = new Date();
    if (colId === 'hoy') return { estado: 'abierta', fecha_limite: isoDia(hoy), completado_en: null };
    if (colId === 'proximo') return { estado: 'abierta', fecha_limite: isoDia(sumarDias(hoy, 1)), completado_en: null };
    if (colId === 'sinfecha') return { estado: 'abierta', fecha_limite: null, completado_en: null };
    if (colId === 'vencida') return null;
  }
  return null;
}

// ── Calendario ──
export const FUENTES_CALENDARIO = [
  { id: 'google',     label: 'Google',      tone: 'blue' },
  { id: 'reuniones',  label: 'Reuniones',   tone: 'purple' },
  { id: 'tareas',     label: 'Tareas',      tone: 'green' },
  { id: 'arribos',    label: 'Arribos PO',  tone: 'orange' },
  { id: 'cargas',     label: 'Cargas',      tone: 'yellow' },
  { id: 'cotizaciones', label: 'Cotizaciones', tone: 'red' },
];

/**
 * Eventos por día para Semana / Mes. Devuelve Map(isoDia → [{ id, fuente, titulo, hora, todoElDia, cliente_key, ref }]).
 * `desde`/`hasta` acotan; `toggles` = Set de fuentes activas.
 */
export function eventosCalendario({ reuniones = [], items = [], google = [], transito = [], fuentesManuales = [], tracking = [] }, desde, hasta, toggles) {
  const on = (f) => !toggles || toggles.has(f);
  const d0 = inicioDia(parseISO(desde)), d1 = inicioDia(parseISO(hasta));
  const dentro = (iso) => { const d = parseISO(iso); return d && d >= d0 && d <= d1; };
  const mapa = new Map();
  const push = (iso, ev) => { if (!dentro(iso)) return; if (!mapa.has(iso)) mapa.set(iso, []); mapa.get(iso).push(ev); };
  if (on('reuniones')) for (const r of reuniones) {
    const f = new Date(r.fecha); const fin = r.fecha_fin ? new Date(r.fecha_fin) : f;
    for (let d = inicioDia(f); d <= fin; d = sumarDias(d, 1)) push(isoDia(d), { id: `r:${r.id}`, fuente: 'reuniones', titulo: r.titulo, hora: r.tipo === 'evento' && r.fecha_fin ? null : fmtHora(f), todoElDia: r.tipo === 'evento' && !!r.fecha_fin, cliente_key: r.cliente_key, ref: r, minutos: r.duracion_min, orden: f.getHours() * 60 + f.getMinutes() });
  }
  if (on('tareas')) for (const it of items) if (abierto(it) && it.fecha_limite) push(it.fecha_limite, { id: `i:${it.id}`, fuente: 'tareas', titulo: it.titulo, hora: it.hora ? String(it.hora).slice(0, 5) : null, todoElDia: !it.hora, cliente_key: it.cliente_key, ref: it, orden: it.hora ? Number(String(it.hora).slice(0, 2)) * 60 + Number(String(it.hora).slice(3, 5)) : 9999 });
  if (on('google')) for (const g of google) {
    const ini = g.start?.dateTime || g.start?.date, fin = g.end?.dateTime || g.end?.date;
    if (!ini) continue;
    const todoElDia = !g.start?.dateTime;
    const a = parseISO(ini) || new Date(ini);
    const b = todoElDia && fin ? sumarDias(parseISO(fin), -1) : (fin ? new Date(fin) : a);
    for (let d = inicioDia(a); d <= inicioDia(b); d = sumarDias(d, 1)) push(isoDia(d), { id: `g:${g.id}`, fuente: 'google', titulo: g.summary || '(sin título)', hora: todoElDia ? null : fmtHora(new Date(ini)), todoElDia, cliente_key: null, ref: g, url: g.htmlLink, orden: todoElDia ? -1 : new Date(ini).getHours() * 60 + new Date(ini).getMinutes() });
  }
  if (on('arribos')) {
    const porPo = new Map();
    for (const t of transito) for (const e of Array.isArray(t.embarques_detalle) ? t.embarques_detalle : []) { const eta = isoDia(e.eta); if (!eta || !dentro(eta)) continue; const k = `${e.po}|${eta}`; if (!porPo.has(k)) porPo.set(k, { po: e.po, eta, piezas: 0 }); porPo.get(k).piezas += Number(e.cantidad ?? e.qty ?? t.cantidad) || 0; }
    for (const p of porPo.values()) push(p.eta, { id: `po:${p.po}:${p.eta}`, fuente: 'arribos', titulo: `PO ${p.po} · ${fmtN(p.piezas)} pz`, hora: null, todoElDia: true, cliente_key: null, ref: p, orden: -2 });
  }
  if (on('cargas')) for (const f of fuentesManuales) {
    const est = f.estado; if (!est || est.cambio) continue;
    for (const v of [est.vence, est.siguiente]) if (v) push(isoDia(v), { id: `carga:${f.id}:${isoDia(v)}`, fuente: 'cargas', titulo: `Carga ${f.titulo}`, hora: null, todoElDia: true, cliente_key: null, ref: f, orden: -3 });
  }
  if (on('cotizaciones')) for (const o of tracking) if (o.esCotizacion && o.abierta && o.fechaEtapa) {
    const vence = sumarDias(o.fechaEtapa, DIAS_COTIZACION_VENCE);
    push(isoDia(vence), { id: `cot:${o.id}`, fuente: 'cotizaciones', titulo: `Vence cot. ${o.numero_oc_cliente}`, hora: null, todoElDia: true, cliente_key: o.cliente_key, ref: o, orden: -1 });
  }
  for (const arr of mapa.values()) arr.sort((a, b) => (a.orden ?? 0) - (b.orden ?? 0));
  return mapa;
}

// ── Hero ──
export function fraseHero({ b, avisos = [], reunionesHoy = [], equipoRes = [], personasPorId = new Map(), reuniones = [], porId, hoy = new Date() }) {
  const nHoy = b.hoy.length + avisos.filter((a) => a.fecha === isoDia(hoy)).length;
  const nVenc = b.vencidas.length;
  const partes = [`Tienes ${nHoy} cosa${nHoy === 1 ? '' : 's'} para hoy`];
  if (nVenc) partes.push(`${nVenc} vencida${nVenc === 1 ? '' : 's'}`);
  const r = reunionesHoy[0];
  const titulo = r ? `${partes.join(', ')} y ${reunionesHoy.length === 1 ? 'una reunión' : `${reunionesHoy.length} reuniones`}${r.cliente_key ? ` con ${nombreClienteAgenda(r.cliente_key)}` : ''} a las ${fmtHora(new Date(r.fecha))}` : partes.join(', ');
  const top = equipoRes.filter((e) => e.total > 0).slice(0, 2).map((e) => `${(e.nombre || '').split(' ')[0]} lleva ${e.total} pendiente${e.total === 1 ? '' : 's'}`);
  const arrastrado = b.abiertos.filter((it) => it.tipo === 'punto').map((it) => ({ it, n: vecesArrastrado(it, porId) })).sort((a, b2) => b2.n - a.n)[0];
  const sub = [top.join(', '), arrastrado?.n >= 2 ? `«${arrastrado.it.titulo.slice(0, 48)}» lleva ${arrastrado.n + 1} reuniones sin cerrarse.` : null].filter(Boolean).join('. ');
  return { titulo, sub, nHoy, nVenc };
}
