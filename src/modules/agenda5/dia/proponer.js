// Agenda «que te lleva» · motor puro (2026-10-05, propuesta A aprobada por Fernando: «que no se me pase nada y no me
// tenga que estar acordando»). La Agenda arma el día sola: lee lo que el negocio sabe y lo convierte en propuestas
// con hilo, duración, porqué y acción. Nada de red aquí: pruebas en scripts/test-agenda5-dia.mjs.
//
// Hilos (orden fijo pedido por Fernando): Mis clientes · Área de ventas · Internos · Personales.
// Momentos del día (horas en perfiles.preferencias.agenda.horas): armar 9:00 · pausa 15:00 · retomar 17:00 · cierre 22:00.

export const HILOS = [
  { id: 'clientes', label: 'Mis clientes', color: '#0A84FF', desc: 'ventas a Digitalife, PCEL y Dicotech' },
  { id: 'ventas', label: 'Área de ventas', color: '#FF9F0A', desc: 'seguimiento a cuentas, mayoristas y al equipo' },
  { id: 'internos', label: 'Internos', color: '#BF5AF2', desc: 'mejora de la empresa, finanzas, operaciones' },
  { id: 'personales', label: 'Personales', color: '#8E8E93', desc: '' },
];
export const HORAS_DEFAULT = { armar: '09:00', pausa: '15:00', retomar: '17:00', cierre: '22:00' };
export const PROPIOS = new Set(['digitalife', 'pcel', 'dicotech']);
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const FUENTES_MANUALES = { estados_resultados: 'actualizacion', roadmap_sku: 'actualizacion', guias_erp: 'actualizacion', compras_oc: 'actualizacion', sellout_ensambles: 'actualizacion', sellout_detalle_digitalife: 'actualizacion', sellout_detalle_dicotech: 'actualizacion', sellout_pcel: 'actualizacion', inventario_cliente: 'actualizacion', estados_cuenta: 'actualizacion' };

const N = (v) => Number(v) || 0;
const minutos = (hhmm) => { const [h, m] = String(hhmm || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); };
export const isoDe = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const diasEntre = (a, b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`)) / 86400000);
export const sumarDiasIso = (iso, n) => { const d = new Date(`${iso}T12:00:00`); d.setDate(d.getDate() + n); return isoDe(d); };

/** Momento del día según las horas de la persona. */
export function momentoDe(ahora, horas = HORAS_DEFAULT) {
  const h = { ...HORAS_DEFAULT, ...(horas || {}) };
  const m = ahora.getHours() * 60 + ahora.getMinutes();
  if (m < minutos(h.armar)) return 'antes';
  if (m >= minutos(h.cierre)) return 'cierre';
  if (m >= minutos(h.pausa) && m < minutos(h.retomar)) return 'pausa';
  return 'trabajar';
}

/** Hilo de un ítem: por área (agenda_areas.hilo), si no por cliente propio, si no por origen, si no «internos». */
export function hiloDe(it, areasPorId = new Map()) {
  const a = it.area_id ? areasPorId.get(it.area_id) : null;
  if (a?.hilo) return a.hilo;
  if (it.origen?.hilo) return it.origen.hilo;
  if (it.cliente_key && PROPIOS.has(it.cliente_key)) return 'clientes';
  if (it.categoria === 'personal') return 'personales';
  return 'internos';
}

/** Propuestas del día a partir de las fuentes del negocio. Todas llevan { id, fuente, ref, hilo, titulo, sub, porque, min, accion }. */
export function proponer({ hoyIso, pagos = [], cuentas = [], propuestas = [], frescura = [], acuerdos = [], viajes = [], forecastLotes = [], decisiones = [], nombres = {} } = {}) {
  const out = [];
  const push = (p) => out.push({ id: `${p.fuente}:${p.ref}`, prioridad: 1, ...p });
  const nombre = (ck) => nombres[ck] || ({ digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' })[ck] || ck;

  // Pagos: los «solicitados» (Karolina pide autorización) van uno por uno; los «calculados» del período en curso o
  // anterior se agrupan en una sola propuesta para no inundar el día (los fijos y spiffs futuros se quedan fuera).
  const mesActual = hoyIso.slice(0, 7);
  const solicitados = pagos.filter((p) => p.estado === 'solicitado');
  const calculados = pagos.filter((p) => p.estado === 'calculado' && String(p.periodo || '').slice(0, 7) <= mesActual);
  for (const p of solicitados.slice(0, 3)) {
    const dias = p.created_at ? diasEntre(String(p.created_at).slice(0, 10), hoyIso) : 0;
    push({ fuente: 'pagos', ref: p.id, hilo: 'clientes', prioridad: 0, min: 10,
      titulo: `Autorizar ${p.concepto || p.tipo || 'pago'} · ${nombre(p.cliente)}`,
      sub: `$${Math.round(N(p.monto)).toLocaleString('es-MX')}${p.periodo ? ` · ${p.periodo}` : ''}${dias > 0 ? ` · solicitado hace ${dias} día${dias === 1 ? '' : 's'}` : ''}`,
      porque: 'Pagos: Karolina lo solicitó y espera tu autorización.', accion: { label: 'Abrir en Pagos', pagina: 'pagos', clienteKey: p.cliente } });
  }
  const resto = [...solicitados.slice(3), ...calculados];
  if (resto.length) {
    const total = resto.reduce((s, p) => s + N(p.monto), 0);
    const clientes = [...new Set(resto.map((p) => nombre(p.cliente)))];
    push({ fuente: 'pagos', ref: `pendientes-${mesActual}`, hilo: 'clientes', prioridad: 1, min: 15,
      titulo: `Revisar ${resto.length} pago${resto.length === 1 ? '' : 's'} pendiente${resto.length === 1 ? '' : 's'} de ${clientes.join(', ')}`,
      sub: `$${Math.round(total).toLocaleString('es-MX')} entre calculados y solicitados`,
      porque: 'Pagos: están calculados o solicitados y no se han autorizado.', accion: { label: 'Abrir Pagos', pagina: 'pagos', clienteKey: resto[0].cliente } });
  }
  // Cuentas de seguimiento vencidas (convención CVA, mayoristas…).
  for (const c of cuentas) {
    if (c.estado && c.estado !== 'activa') continue;
    if (!c.proximo_seguimiento || c.proximo_seguimiento > hoyIso) continue;
    const dias = diasEntre(c.proximo_seguimiento, hoyIso);
    push({ fuente: 'cuenta', ref: c.id, hilo: 'ventas', prioridad: dias > 7 ? 0 : 1, min: 15,
      titulo: `Contactar a ${c.nombre}${c.empresa ? ` · ${c.empresa}` : ''}`,
      sub: `${c.ultimo_contacto ? `último contacto ${c.ultimo_contacto}` : 'sin contacto desde el alta'} · vencido hace ${dias} día${dias === 1 ? '' : 's'}`,
      porque: `Cuentas de seguimiento: tocaba el ${c.proximo_seguimiento}${c.recordar_cada_dias ? `, cada ${c.recordar_cada_dias} días` : ''}.`,
      accion: c.telefono ? { label: 'Llamar', tel: c.telefono } : { label: 'Ver cuenta', pagina: 'agenda', extra: { vista: 'pendientes', cuenta: c.id } } });
  }
  // Propuestas enviadas sin factura después de 5 días.
  for (const pr of propuestas) {
    if (pr.estado !== 'enviada' || !pr.enviada_at) continue;
    const dias = diasEntre(String(pr.enviada_at).slice(0, 10), hoyIso);
    if (dias < 5) continue;
    const r = pr.resumen || {};
    push({ fuente: 'propuesta', ref: pr.id, hilo: 'clientes', min: 10,
      titulo: `Preguntar a ${nombre(pr.cliente_key)} por «${pr.nombre || 'la propuesta'}»`,
      sub: `enviada hace ${dias} días${r.skus ? ` · ${r.skus} SKUs` : ''}${r.total ? ` · $${Math.round(N(r.total)).toLocaleString('es-MX')}` : ''}`,
      porque: 'Propuestas: sigue «enviada» sin ningún SKU facturado.', accion: { label: 'Ver propuesta', pagina: 'propuestas', clienteKey: pr.cliente_key, extra: { propuestaId: pr.id } } });
  }
  // Acuerdos abiertos de minutas (tipo punto, con reunión).
  for (const a of acuerdos) {
    const propio = a.cliente_key && PROPIOS.has(a.cliente_key);
    push({ fuente: 'acuerdo', ref: a.id, hilo: propio ? 'clientes' : 'ventas', min: N(a.duracion_min) || 20,
      titulo: a.titulo, sub: `acuerdo de la reunión${a.reunionTitulo ? ` «${a.reunionTitulo}»` : ''}${a.reunionFecha ? ` del ${a.reunionFecha}` : ''}`,
      porque: 'Minutas: quedó abierto y no tiene fecha.', accion: { label: 'Ver minuta', pagina: 'agenda', extra: { reunionId: a.reunion_id } } });
  }
  // Fuentes manuales atrasadas.
  for (const f of frescura) {
    if (f.estado !== 'atrasada' || !FUENTES_MANUALES[f.fuente]) continue;
    push({ fuente: 'carga', ref: f.fuente, hilo: 'internos', min: 10, prioridad: 2,
      titulo: `Subir ${f.etiqueta}`, sub: `lleva ${f.dias} días sin cargar · umbral ${f.umbral_dias}`,
      porque: 'Importador: la fuente está atrasada y las pantallas que la usan se quedan viejas.', accion: { label: 'Abrir importador', pagina: FUENTES_MANUALES[f.fuente] } });
  }
  // Forecast del CRM: del 1 al 10 de cada mes, si no hay lote del mes siguiente.
  const d = new Date(`${hoyIso}T12:00:00`);
  if (d.getDate() <= 10) {
    const sig = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    const key = `${sig.getFullYear()}-${String(sig.getMonth() + 1).padStart(2, '0')}`;
    if (!forecastLotes.some((l) => String(l.mes_inicio || '').startsWith(key))) {
      push({ fuente: 'forecast', ref: key, hilo: 'clientes', min: 40, titulo: `Capturar el forecast de ${MESES[sig.getMonth()]} en el CRM`,
        sub: 'el sugerido del dashboard ya está listo para los tres propios', porque: 'Forecast CRM: la ventana se captura antes del día 10.', accion: { label: 'Abrir Forecast', pagina: 'forecastReservas' } });
    }
  }
  // Viajes en los próximos 5 días.
  for (const v of viajes) {
    const ini = String(v.fecha || '').slice(0, 10); if (!ini) continue;
    const faltan = diasEntre(hoyIso, ini);
    if (faltan < 0 || faltan > 5) continue;
    push({ fuente: 'viaje', ref: v.id, hilo: 'personales', min: 30, titulo: `Preparar el viaje: ${v.titulo || 'viaje'}`,
      sub: faltan === 0 ? 'es hoy' : `en ${faltan} día${faltan === 1 ? '' : 's'}`, porque: 'Agenda: viaje registrado.', accion: { label: 'Ver viaje', pagina: 'agenda', extra: { vista: 'reuniones' } } });
  }

  // Decisiones previas: descartada (hasta) o aceptada hoy → fuera; «mañana» → fuera hasta mañana.
  const fuera = new Set();
  for (const dec of decisiones) {
    const k = `${dec.fuente}:${dec.ref}`;
    if (dec.decision === 'descartada' && (!dec.hasta || dec.hasta >= hoyIso)) fuera.add(k);
    if (dec.decision === 'aceptada' && dec.fecha === hoyIso) fuera.add(k);
    if (dec.decision === 'manana' && dec.hasta && dec.hasta > hoyIso) fuera.add(k);
  }
  const ORDEN = { clientes: 0, ventas: 1, internos: 2, personales: 3 };
  return out.filter((p) => !fuera.has(p.id)).sort((a, b) => a.prioridad - b.prioridad || ORDEN[a.hilo] - ORDEN[b.hilo] || a.titulo.localeCompare(b.titulo));
}

/** Carga del día: minutos de lo planeado (ítems de hoy + propuestas aceptadas) + reuniones, contra la jornada. */
export function cargaDia({ itemsHoy = [], propuestasAceptadas = [], reunionesMin = 0, horas = HORAS_DEFAULT }) {
  const h = { ...HORAS_DEFAULT, ...(horas || {}) };
  const jornada = (minutos(h.pausa) - minutos(h.armar)) + (minutos(h.cierre) - minutos(h.retomar));
  const tareas = itemsHoy.reduce((s, it) => s + (N(it.duracion_min) || 15), 0) + propuestasAceptadas.reduce((s, p) => s + N(p.min), 0);
  const total = tareas + reunionesMin;
  return { jornada, tareas, reuniones: reunionesMin, total, libre: jornada - total, exceso: Math.max(0, total - jornada) };
}

/** Agrupa ítems por hilo en el orden fijo. */
export function porHilo(items, areasPorId) {
  const g = Object.fromEntries(HILOS.map((h) => [h.id, []]));
  for (const it of items) (g[hiloDe(it, areasPorId)] || g.internos).push(it);
  return HILOS.map((h) => ({ ...h, items: g[h.id] })).filter((h) => h.items.length);
}

export const fmtMin = (m) => { m = Math.round(N(m)); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
