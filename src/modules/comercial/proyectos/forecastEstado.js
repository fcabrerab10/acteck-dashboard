// Proyectos y forecast del celular · cálculo puro (sin red). Pruebas: scripts/test-sop-movil.mjs. 2026-10-05.
//
// Por cliente propio, para la ventana del CRM (6 meses desde el mes siguiente):
//   · lo que ya está en el CRM (forecast_crm_existente, copia del CRM)            → origen 'crm'
//   · lo capturado desde el dashboard (forecast_crm: borrador | exportado)        → origen 'borrador' | 'exportado'
//   · lo que el dashboard sugiere y nadie ha capturado (forecastCalc.js#sugerir)  → origen 'sugerido'
// Una fila por SKU con sus piezas por mes; el capturado manda sobre la copia del CRM y ambos sobre el sugerido.
// «Todos» suma los tres clientes por SKU y guarda el reparto por cliente. Nada de aquí escribe en la base.
const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
export const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const mesKey = (a, m) => `${a}-${String(m).padStart(2, '0')}`;
export const ORIGEN_LABEL = { crm: 'en el CRM', exportado: 'exportado', borrador: 'borrador', sugerido: 'sugerido' };
export const ORIGEN_TONE = { crm: 'green', exportado: 'green', borrador: 'orange', sugerido: 'gray' };
const PESO = { borrador: 3, exportado: 2, crm: 1 };

/** Días que faltan para el día 10 (fecha límite de captura del CRM). Negativo = ya pasó este mes (cuenta al siguiente). */
export function diasAlLimite(hoy = new Date(), dia = 10) {
  const d = hoy.getDate();
  if (d <= dia) return dia - d;
  const sig = new Date(hoy.getFullYear(), hoy.getMonth() + 1, dia);
  return Math.round((sig - new Date(hoy.getFullYear(), hoy.getMonth(), d)) / 86400000);
}

/** «nov 150 · dic 200 · ene 150» a partir de meses {key → pz} y la ventana. */
export function lineaMeses(meses = {}, ventana = [], { max = 6 } = {}) {
  const out = ventana.filter((m) => N(meses[m.key]) > 0).slice(0, max).map((m) => `${m.label.split(' ')[0].toLowerCase()} ${Math.round(N(meses[m.key])).toLocaleString('es-MX')}`);
  return out.length ? out.join(' · ') : 'sin piezas en la ventana';
}

/**
 * Estado del forecast de UN cliente.
 *   existente: [{ sku, mes:'YYYY-MM-DD', piezas, justificacion }]   (forecast_crm_existente)
 *   crm:       [{ sku, anio, mes, piezas, estado, justificacion, lote_id }]   (forecast_crm)
 *   sugerido:  [{ sku, descripcion, meses:{key→pz}, justificacion, origen }]  (sugerir().filas)
 *   proyectos: [{ sku, key, piezas, nombre, probabilidad }]
 *   lotes:     [{ id, clientes, filas, cargado_crm_at, created_at, archivo_nombre, mes_inicio, meses }]
 */
export function estadoCliente({ key, label, ventana = [], existente = [], crm = [], sugerido = [], proyectos = [], lotes = [], roadmap = new Map(), hoy = new Date() } = {}) {
  const keys = new Set(ventana.map((m) => m.key));
  const filas = new Map();
  const fila = (sku) => { let f = filas.get(sku); if (!f) { f = { sku, descripcion: roadmap.get(sku)?.descripcion || '', marca: roadmap.get(sku)?.marca || '', meses: {}, origen: null, peso: 0, justificacion: '', total: 0 }; filas.set(sku, f); } return f; };
  const poner = (sku, k, pz, origen, just) => {
    if (!sku || !keys.has(k) || !(N(pz) > 0)) return;
    const f = fila(sku);
    const w = PESO[origen] || 0;
    // Un origen de más peso sustituye los meses del de menos peso (lo capturado hoy manda sobre la copia del CRM).
    if (w > f.peso) { f.meses = {}; f.peso = w; f.origen = origen; f.justificacion = just || f.justificacion; }
    if (w === f.peso) { f.meses[k] = N(pz); if (!f.justificacion && just) f.justificacion = just; }
  };
  for (const r of existente) poner(r.sku, String(r.mes || '').slice(0, 7), r.piezas, 'crm', r.justificacion);
  for (const r of crm) poner(r.sku, mesKey(N(r.anio), N(r.mes)), r.piezas, r.estado === 'exportado' ? 'exportado' : 'borrador', r.justificacion);
  for (const s of sugerido) {
    if (filas.has(s.sku)) continue;
    const f = fila(s.sku);
    f.origen = 'sugerido'; f.descripcion = f.descripcion || s.descripcion || ''; f.marca = f.marca || s.marca || ''; f.justificacion = s.justificacion || '';
    for (const m of ventana) if (N(s.meses?.[m.key]) > 0) f.meses[m.key] = N(s.meses[m.key]);
  }
  const lista = [...filas.values()].map((f) => ({ ...f, total: Object.values(f.meses).reduce((s, v) => s + N(v), 0) })).filter((f) => f.total > 0).sort((a, b) => b.total - a.total);
  const de = (o) => lista.filter((f) => f.origen === o);
  const pz = (l) => l.reduce((s, f) => s + f.total, 0);
  const capturadas = lista.filter((f) => f.origen !== 'sugerido');
  const proyVentana = proyectos.filter((p) => keys.has(p.key) && N(p.piezas) > 0);
  const nombresProy = [...new Set(proyVentana.map((p) => p.nombre))];
  const misLotes = lotes.filter((l) => (l.clientes || []).includes(key));
  return {
    key, label, ventana, filas: lista,
    resumen: {
      capturados: { skus: capturadas.length, pz: pz(capturadas) },
      enCrm: { skus: de('crm').length + de('exportado').length, pz: pz(de('crm')) + pz(de('exportado')) },
      borrador: { skus: de('borrador').length, pz: pz(de('borrador')) },
      porCapturar: { skus: de('sugerido').length, pz: pz(de('sugerido')) },
      proyectos: { n: nombresProy.length, pz: proyVentana.reduce((s, p) => s + N(p.piezas), 0), confirmados: new Set(proyVentana.filter((p) => p.probabilidad === 'confirmado').map((p) => p.nombre)).size },
      lotes: { n: misLotes.length, sinCargar: misLotes.filter((l) => !l.cargado_crm_at).length, ultimo: misLotes[0] || null },
      diasLimite: diasAlLimite(hoy),
    },
  };
}

/** «Todos»: suma los estados por SKU y guarda el reparto por cliente. */
export function sumarClientes(estados = []) {
  const ventana = estados[0]?.ventana || [];
  const filas = new Map();
  for (const e of estados) for (const f of e.filas) {
    const x = filas.get(f.sku) || { sku: f.sku, descripcion: f.descripcion, marca: f.marca, meses: {}, total: 0, origen: f.origen, porCliente: [], justificacion: '' };
    for (const [k, v] of Object.entries(f.meses)) x.meses[k] = (x.meses[k] || 0) + N(v);
    x.total += f.total;
    x.porCliente.push({ key: e.key, label: e.label, pz: f.total, origen: f.origen });
    // Un SKU mezclado: si alguno sigue sugerido, pesa «por capturar» en el pill; si no, el más capturado.
    if (f.origen === 'sugerido' || x.origen === 'sugerido') x.origen = 'sugerido'; else if (f.origen === 'borrador' || x.origen === 'borrador') x.origen = 'borrador';
    if (!x.descripcion && f.descripcion) x.descripcion = f.descripcion;
    filas.set(f.sku, x);
  }
  const suma = (campo) => estados.reduce((a, e) => ({ skus: a.skus + e.resumen[campo].skus, pz: a.pz + e.resumen[campo].pz }), { skus: 0, pz: 0 });
  return {
    key: 'todos', label: 'Los tres', ventana,
    filas: [...filas.values()].sort((a, b) => b.total - a.total),
    resumen: {
      capturados: suma('capturados'), enCrm: suma('enCrm'), borrador: suma('borrador'), porCapturar: suma('porCapturar'),
      proyectos: estados.reduce((a, e) => ({ n: a.n + e.resumen.proyectos.n, pz: a.pz + e.resumen.proyectos.pz, confirmados: a.confirmados + e.resumen.proyectos.confirmados }), { n: 0, pz: 0, confirmados: 0 }),
      lotes: estados.reduce((a, e) => ({ n: a.n + e.resumen.lotes.n, sinCargar: a.sinCargar + e.resumen.lotes.sinCargar, ultimo: a.ultimo || e.resumen.lotes.ultimo }), { n: 0, sinCargar: 0, ultimo: null }),
      diasLimite: estados[0]?.resumen.diasLimite ?? diasAlLimite(),
      porCliente: estados.map((e) => ({ key: e.key, label: e.label, ...e.resumen.capturados, porCapturar: e.resumen.porCapturar.skus })),
    },
  };
}

export function fraseForecast(estado, { hoy = new Date() } = {}) {
  if (!estado) return '';
  const r = estado.resumen;
  const v = estado.ventana;
  const pz = (n) => `${Math.round(n).toLocaleString('es-MX')} pz`;
  const quien = estado.key === 'todos' ? 'Los tres clientes' : estado.label;
  const rango = v.length ? `${v[0].label.split(' ')[0].toLowerCase()} → ${v[v.length - 1].label.split(' ')[0].toLowerCase()}` : '';
  if (!r.capturados.skus && !r.porCapturar.skus) return `${quien}: sin forecast ni sugerido para ${rango}. Captura el primero desde el botón de abajo.`;
  const partes = [];
  if (r.capturados.skus) partes.push(`${quien} ${estado.key === 'todos' ? 'tienen' : 'tiene'} ${r.capturados.skus} SKU${r.capturados.skus === 1 ? '' : 's'} con forecast por ${pz(r.capturados.pz)} (${rango})`);
  else partes.push(`${quien} todavía no ${estado.key === 'todos' ? 'tienen' : 'tiene'} forecast para ${rango}`);
  if (r.borrador.skus) partes.push(`${r.borrador.skus} en borrador sin exportar`);
  if (r.porCapturar.skus) partes.push(`${r.porCapturar.skus} sugerido${r.porCapturar.skus === 1 ? '' : 's'} por capturar${r.diasLimite >= 0 && r.diasLimite <= 10 ? ` antes del día 10 (${r.diasLimite === 0 ? 'hoy' : `en ${r.diasLimite} d`})` : ''}`);
  let txt = `${partes.join('; ')}.`;
  if (r.proyectos.n) txt += ` ${r.proyectos.n} proyecto${r.proyectos.n === 1 ? '' : 's'} suma${r.proyectos.n === 1 ? '' : 'n'} ${pz(r.proyectos.pz)}${r.proyectos.confirmados ? ` (${r.proyectos.confirmados} confirmado${r.proyectos.confirmados === 1 ? '' : 's'})` : ''}.`;
  return txt;
}

/** Filas (de un cliente) → filas de la plantilla del CRM (plantillaCRM.construirLibro), sólo lo capturable. */
export function filasParaPlantilla(filas = [], { tipo = 'directa', clienteCodigo = '' } = {}, { soloBorrador = true } = {}) {
  return filas.filter((f) => (soloBorrador ? f.origen === 'borrador' : f.origen !== 'sugerido') && Object.values(f.meses || {}).some((v) => N(v) > 0))
    .map((f) => ({ tipo, cliente: clienteCodigo, sku: f.sku, justificacion: f.justificacion || '', meses: f.meses }));
}
