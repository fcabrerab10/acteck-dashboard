// Buzón de salida · lo que se captura sin señal NO se pierde (2026-09-22).
//
// Fernando visita clientes donde el internet es malo o no hay. Regla: toda escritura que
// la app hace "de campo" (agenda, proyectos, marketing, estado de un pago) pasa por aquí:
//
//   1. se intenta contra la red con un tope de 6 s;
//   2. si falla (o `navigator.onLine === false`) la fila se guarda en IndexedDB y la
//      pantalla sigue como si hubiera guardado (optimista, con un id temporal `tmp_…`);
//   3. al volver la señal — evento `online`, foco de la app o cada 60 s — se aplica la
//      cola en ORDEN DE LLEGADA (FIFO) y los ids temporales se sustituyen por los reales.
//
// Reglas de la casa que se respetan aquí:
//   · las tablas que la app escribe no se cachean (CLAUDE.md § Rendimiento); tras sincronizar
//     se llama `invalidateDataCache()` desde el consumidor (o `onSincronizado`).
//   · nada de `alert()`: los avisos van por `toast` del kit.
//
// Este módulo es PURO de navegador-opcional: no importa supabase ni idb-keyval de forma
// estática, así que `node --test scripts/test-buzon.mjs` puede cargarlo y meterle un
// almacén falso (un Map) y un aplicador falso.
//
//   import { escribir, sincronizar, useBuzon } from '../../lib/buzon';
//   const fila = await escribir({ tabla: 'agenda_items', op: 'insert', filas: row, origen: 'agenda' });
//
import { useEffect, useState } from 'react';

export const CLAVE_BUZON = 'acteck-buzon-v1';
export const TIMEOUT_RED_MS = 6000;
export const INTERVALO_SYNC_MS = 60 * 1000;
export const MAX_INTENTOS = 5;
export const EV_BUZON = 'acteck:buzon';

export const MENSAJE_GUARDADO = 'Guardado en el dispositivo · se sincroniza al volver la señal';

// Aviso al usuario cuando algo se queda en el buzón. Lo registra App.jsx con el toast del kit;
// así este módulo no importa JSX y se puede cargar en Node para las pruebas.
let avisoLocal = null;
export function configurarAviso(fn) { avisoLocal = typeof fn === 'function' ? fn : null; }
export function avisarLocal(msg = MENSAJE_GUARDADO) { try { avisoLocal?.(msg); } catch { /* noop */ } }

// ─────────────────────────── Almacén (IndexedDB o inyectado) ───────────────────────────
// Por defecto idb-keyval (el mismo que ya usa el persister de React Query). Se importa
// en perezoso para que este módulo cargue en Node sin IndexedDB.
let almacen = null;

/** Inyecta el almacén (pruebas): { leer(): Promise<array>, escribir(array): Promise<void> }. */
export function configurarAlmacen(a) { almacen = a || null; }

function almacenIDB() {
  let cache = null;
  const idb = async () => (cache ||= await import('idb-keyval'));
  return {
    async leer() {
      try { const { get } = await idb(); const v = await get(CLAVE_BUZON); return Array.isArray(v) ? v : []; }
      catch { return []; }
    },
    async escribir(cola) {
      try { const { set, del } = await idb(); if (!cola.length) await del(CLAVE_BUZON); else await set(CLAVE_BUZON, cola); }
      catch { /* modo privado o sin cuota: se pierde la cola, no la app */ }
    },
  };
}

const alm = () => (almacen ||= almacenIDB());

export const leerCola = () => alm().leer();
const guardarCola = (cola) => alm().escribir(cola);

// ─────────────────────────── Helpers puros ───────────────────────────
let seq = 0;
export function nuevoId(prefijo = 'buz') {
  seq += 1;
  const r = Math.random().toString(36).slice(2, 8);
  return `${prefijo}_${Date.now().toString(36)}${seq.toString(36)}${r}`;
}

/** Id temporal que todavía no existe en Postgres. */
export const esTemp = (v) => typeof v === 'string' && v.startsWith('tmp_');

/** Sustituye recursivamente los ids temporales ya resueltos. Devuelve una copia. */
export function resolverTemps(valor, mapa) {
  if (esTemp(valor)) return mapa.has(valor) ? mapa.get(valor) : valor;
  if (Array.isArray(valor)) return valor.map((v) => resolverTemps(v, mapa));
  if (valor && typeof valor === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(valor)) out[k] = resolverTemps(v, mapa);
    return out;
  }
  return valor;
}

/** ¿Quedan ids temporales sin resolver dentro de esto? (la fila depende de otra que no ha subido) */
export function quedanTemps(valor) {
  if (esTemp(valor)) return true;
  if (Array.isArray(valor)) return valor.some(quedanTemps);
  if (valor && typeof valor === 'object') return Object.values(valor).some(quedanTemps);
  return false;
}

/** Texto corto para la hoja de pendientes ("Agenda · nueva tarea"). */
export function describir(item) {
  const verbo = { insert: 'alta', update: 'cambio', upsert: 'guardado', delete: 'baja' }[item.op] || item.op;
  const etiqueta = ETIQUETAS[item.tabla] || item.tabla;
  const titulo = item.titulo
    || (Array.isArray(item.filas) ? item.filas[0]?.titulo || item.filas[0]?.nombre : item.filas?.titulo || item.filas?.nombre)
    || null;
  return `${etiqueta} · ${verbo}${titulo ? ` "${String(titulo).slice(0, 48)}"` : ''}`;
}

const ETIQUETAS = {
  agenda_items: 'Agenda', agenda_reuniones: 'Reunión', agenda_subtareas: 'Subtarea',
  agenda_item_comentarios: 'Comentario', cuentas_seguimiento: 'Cuenta', cuentas_seguimiento_notas: 'Bitácora',
  proyectos: 'Proyecto', proyecto_lineas: 'Línea de proyecto',
  marketing_actividades: 'Marketing', pagos: 'Pago', pagos_bitacora: 'Bitácora de pago',
};

// ─────────────────────────── Estado observable ───────────────────────────
let estado = { pendientes: 0, sincronizando: false, ultimoError: null, items: [] };
const oyentes = new Set();

function publicar(parche) {
  estado = { ...estado, ...parche };
  oyentes.forEach((f) => { try { f(estado); } catch { /* un oyente roto no tumba al resto */ } });
  if (typeof window !== 'undefined' && window.dispatchEvent) {
    try { window.dispatchEvent(new CustomEvent(EV_BUZON, { detail: estado })); } catch { /* sin CustomEvent */ }
  }
}

export const estadoBuzon = () => estado;
export function suscribir(f) { oyentes.add(f); return () => oyentes.delete(f); }

async function refrescarEstado(extra = {}) {
  const cola = await leerCola();
  publicar({ pendientes: cola.length, items: cola, ...extra });
  return cola;
}

// ─────────────────────────── Red ───────────────────────────
export const sinSenal = () => (typeof navigator !== 'undefined' && navigator.onLine === false);

function conTope(promesa, ms = TIMEOUT_RED_MS) {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    Promise.resolve(promesa).then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}

/**
 * Aplica un elemento de la cola contra Supabase. Import perezoso a propósito:
 * así este módulo se puede cargar en Node (pruebas) sin `import.meta.env`.
 * Devuelve la fila (o la primera fila) que respondió Postgres, o null.
 */
export async function aplicarEnRed(item) {
  const { supabase } = await import('./supabase');
  if (item.op === 'rpc') {
    const r = await supabase.rpc(item.tabla, item.filas || {});
    if (r?.error) throw new Error(r.error.message || String(r.error));
    return r?.data ?? null;
  }
  const t = supabase.from(item.tabla);
  let q;
  if (item.op === 'insert') q = t.insert(item.filas).select('*');
  else if (item.op === 'upsert') q = t.upsert(item.filas, item.onConflict ? { onConflict: item.onConflict } : undefined).select('*');
  else if (item.op === 'update') q = aplicarFiltro(t.update(item.filas), item.match).select('*');
  else if (item.op === 'delete') q = aplicarFiltro(t.delete(), item.match);
  else throw new Error(`Operación desconocida: ${item.op}`);
  const r = await q;
  if (r?.error) throw new Error(r.error.message || String(r.error));
  const data = r?.data;
  return Array.isArray(data) ? (data[0] ?? null) : (data ?? null);
}

/** `match` = { col: valor } (igualdad) o { col: { in: [...] } }. */
function aplicarFiltro(q, match) {
  for (const [col, val] of Object.entries(match || {})) {
    if (val && typeof val === 'object' && Array.isArray(val.in)) q = q.in(col, val.in);
    else q = q.eq(col, val);
  }
  return q;
}

// ─────────────────────────── Encolar ───────────────────────────
/** Mete un elemento al final de la cola. Devuelve el elemento guardado. */
export async function encolar({ tabla, op, filas = null, match = null, origen = null, onConflict = null, titulo = null, tempId = null }) {
  const item = { id: nuevoId(), ts: Date.now(), tabla, op, filas, match, origen, onConflict, titulo, tempId, intentos: 0, error: null };
  const cola = await leerCola();
  cola.push(item);
  await guardarCola(cola);
  await refrescarEstado();
  return item;
}

export async function descartar(id) {
  const cola = (await leerCola()).filter((x) => x.id !== id);
  await guardarCola(cola);
  await refrescarEstado({ ultimoError: cola.some((x) => x.error) ? estado.ultimoError : null });
  return cola;
}

export async function vaciar() {
  await guardarCola([]);
  await refrescarEstado({ ultimoError: null });
}

// ─────────────────────────── Escribir (el punto de entrada) ───────────────────────────
/**
 * Escribe contra la red con tope de 6 s; si no se puede, encola y resuelve optimista.
 *
 *   await escribir({ tabla, op, filas, match, origen, onConflict, select })
 *     → { data, offline, item }
 *
 * En `insert` sin señal devuelve la fila con un id temporal `tmp_…` para que la pantalla
 * la pinte y la pueda seguir editando; `sincronizar()` cambia ese id por el real en los
 * elementos posteriores de la cola que lo referencien.
 */
export async function escribir({ tabla, op, filas = null, match = null, origen = null, onConflict = null, titulo = null, aplicar = aplicarEnRed, tope = TIMEOUT_RED_MS }) {
  const base = { tabla, op, filas, match, origen, onConflict, titulo };
  if (!sinSenal()) {
    try {
      const data = await conTope(aplicar({ ...base, id: nuevoId(), intentos: 0 }), tope);
      return { data, offline: false, item: null };
    } catch (e) {
      // Un error de datos (RLS, constraint) NO se encola: se propaga para que la pantalla
      // lo enseñe. Sólo se encola lo que huele a red.
      if (!esErrorDeRed(e)) throw e;
    }
  }
  const tempId = op === 'insert' ? nuevoId('tmp') : null;
  const item = await encolar({ ...base, tempId });
  avisarLocal();
  const fila = Array.isArray(filas) ? filas[0] : filas;
  const data = op === 'insert' ? { ...(fila || {}), id: tempId, _pendiente: true } : { ...(fila || {}), _pendiente: true };
  return { data, offline: true, item };
}

/** ¿El fallo es de red (encolable) o de datos (hay que enseñarlo)? */
export function esErrorDeRed(e) {
  const m = String(e?.message || e || '').toLowerCase();
  if (!m) return true;
  return /timeout|failed to fetch|networkerror|network request failed|load failed|fetch failed|offline|econn|socket|abort|gateway|service unavailable|internal server error|502|503|504/.test(m);
}

// ─────────────────────────── Sincronizar ───────────────────────────
let sincronizando = false;
const mapaTemp = new Map();   // tmp_… → id real (vive lo que viva la pestaña)

export const idReal = (id) => (mapaTemp.get(id) ?? id);

/**
 * Aplica la cola en orden. Para en el primer fallo: así no se reordena el historial
 * (una edición no puede subir antes que el alta que la creó).
 *   → { subidos, restantes, error }
 */
export async function sincronizar({ aplicar = aplicarEnRed, tope = TIMEOUT_RED_MS, onSincronizado = null } = {}) {
  if (sincronizando) return { subidos: 0, restantes: estado.pendientes, error: null, ocupado: true };
  let cola = await leerCola();
  if (!cola.length) { publicar({ pendientes: 0, items: [], ultimoError: null }); return { subidos: 0, restantes: 0, error: null }; }
  if (sinSenal()) return { subidos: 0, restantes: cola.length, error: null };

  sincronizando = true;
  publicar({ sincronizando: true });
  let subidos = 0;
  let error = null;
  try {
    for (;;) {
      cola = await leerCola();
      const it = cola[0];
      if (!it) break;
      const item = { ...it, filas: resolverTemps(it.filas, mapaTemp), match: resolverTemps(it.match, mapaTemp) };
      if (quedanTemps(item.filas) || quedanTemps(item.match)) {
        // Depende de un alta que nunca subió (se descartó): no se puede aplicar.
        error = `No se pudo sincronizar "${describir(item)}": depende de algo que ya no existe.`;
        cola[0] = { ...it, error, intentos: (it.intentos || 0) + 1 };
        await guardarCola(cola);
        break;
      }
      try {
        const data = await conTope(aplicar(item), tope);
        if (it.tempId) mapaTemp.set(it.tempId, data?.id ?? it.tempId);
        await guardarCola(cola.slice(1));
        subidos += 1;
      } catch (e) {
        const intentos = (it.intentos || 0) + 1;
        error = `${describir(it)}: ${String(e?.message || e)}`;
        cola[0] = { ...it, intentos, error };
        await guardarCola(cola);
        break;
      }
    }
  } catch (e) {
    error = String(e?.message || e);
  }
  sincronizando = false;
  const fin = await refrescarEstado({ sincronizando: false, ultimoError: error });
  if (subidos > 0 && onSincronizado) { try { await onSincronizado(subidos); } catch { /* noop */ } }
  return { subidos, restantes: fin.length, error };
}

/** Reintenta ya mismo el primero de la cola (botón "Reintentar" de la hoja). */
export async function reintentar(opts = {}) {
  const cola = await leerCola();
  if (cola.length) { cola[0] = { ...cola[0], error: null }; await guardarCola(cola); }
  return sincronizar(opts);
}

// ─────────────────────────── Arranque automático ───────────────────────────
let arrancado = false;

/**
 * Engancha la sincronización a `online`, al foco de la app y a un latido de 60 s.
 * Se llama una vez desde App.jsx (y desde MovilApp por si la web no se monta).
 */
export function arrancarBuzon({ onSincronizado = null } = {}) {
  if (arrancado || typeof window === 'undefined') return () => {};
  arrancado = true;
  const corre = () => { sincronizar({ onSincronizado }).catch(() => {}); };
  const alFoco = () => { if (!document.hidden) corre(); };
  window.addEventListener('online', corre);
  window.addEventListener('focus', alFoco);
  document.addEventListener('visibilitychange', alFoco);
  const t = setInterval(corre, INTERVALO_SYNC_MS);
  refrescarEstado().then(() => corre());
  return () => {
    arrancado = false;
    window.removeEventListener('online', corre);
    window.removeEventListener('focus', alFoco);
    document.removeEventListener('visibilitychange', alFoco);
    clearInterval(t);
  };
}

// ─────────────────────────── Hook ───────────────────────────
/** { pendientes, sincronizando, ultimoError, items, online, sincronizar, reintentar, descartar } */
export function useBuzon() {
  const [st, setSt] = useState(estado);
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));
  useEffect(() => {
    const off = suscribir(setSt);
    refrescarEstado().catch(() => {});
    const on = () => setOnline(true);
    const no = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', no);
    return () => { off(); window.removeEventListener('online', on); window.removeEventListener('offline', no); };
  }, []);
  return { ...st, online, sincronizar, reintentar, descartar };
}

export default { escribir, encolar, sincronizar, reintentar, descartar, vaciar, useBuzon, arrancarBuzon, leerCola, estadoBuzon };
