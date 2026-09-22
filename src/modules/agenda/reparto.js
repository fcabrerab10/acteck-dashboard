// Agenda · "Anota y reparte al cerrar" (lógica pura, sin React ni Supabase).
// Se prueba en Node: node --test scripts/test-agenda-reparto.mjs
//
// En la minuta se escribe a mano alzada; al tocar «Repartir» estas funciones leen el texto y
// proponen un pendiente por línea. Una línea es ACUERDO si:
//   · empieza con viñeta  -  •  *  ·  –  —  o "1." / "1)"
//   · menciona a alguien  @karolina
//   · menciona un cliente #pcel
//   · trae una fecha en lenguaje natural (hoy, mañana, el viernes, 15 sep, 24/09, la próxima semana…)
// Todo lo demás es contexto y NO se reparte.
//
//   detectarAcuerdos(texto, { clienteKey:'pcel', personas, hoy, yo:'u-fer', existentes: puntos })
//     → [{ id, linea, titulo, persona, fecha, clienteKey, categoria, incluir, yaExiste }]
//
// Los parsers son los de etiquetas.js (mismos que la captura en una línea): si ahí cambia la
// gramática, aquí se hereda sola.

import { parsearEtiquetas, fechaNatural, normalizar } from './etiquetas.js';
import { isoDia, sumarDias } from './calculo.js';

/** Viñeta al inicio de la línea: "- ", "• ", "* ", "· ", "– ", "1. ", "2) ". */
export const RE_VINETA = /^\s*(?:[-–—•*·]+|\d{1,2}[.)])\s+/;
const RE_PERSONA = /(^|\s)@[^\s#@/]+/;
const RE_CLIENTE = /(^|\s)#[^\s#@/]+/;

const limpiarLinea = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** ¿Esta línea suelta parece un acuerdo? (viñeta · @persona · #cliente · fecha relativa) */
export function esAcuerdo(linea, { hoy = new Date() } = {}) {
  const s = String(linea ?? '');
  if (!s.trim()) return false;
  if (RE_VINETA.test(s)) return true;
  if (RE_PERSONA.test(s) || RE_CLIENTE.test(s)) return true;
  return !!fechaNatural(s, hoy).fecha;
}

/**
 * Analiza UNA línea ya reconocida como acuerdo y devuelve la propuesta de pendiente.
 * `yo` es el user_id de quien captura: es el responsable por omisión (Fernando en el celular).
 */
export function analizarLinea(linea, { clienteKey = null, personas = [], hoy = new Date(), yo = null } = {}) {
  const sinVineta = String(linea ?? '').replace(RE_VINETA, '');
  const nat = fechaNatural(sinVineta, hoy);
  const p = parsearEtiquetas(nat.texto, personas);
  const titulo = limpiarLinea(p.titulo);
  return {
    linea: limpiarLinea(linea),
    titulo,
    persona: p.responsables[0] || yo || null,
    fecha: nat.fecha || null,
    hora: nat.hora || null,
    clienteKey: p.cliente_key || clienteKey || null,
    categoria: p.categoria || null,
  };
}

/** Títulos ya creados en la reunión (filas de agenda_items o strings) → Set normalizado. */
export const clavesExistentes = (existentes = []) =>
  new Set((existentes || []).map((x) => normalizar(typeof x === 'string' ? x : x?.titulo)).filter(Boolean));

/**
 * Lee el texto completo de la minuta y devuelve las filas del reparto (en el orden del texto).
 * Quita líneas vacías, líneas sin título y repetidas; las que ya existen como punto de la reunión
 * llegan marcadas `yaExiste` y con `incluir: false` (dedupe por título dentro de la reunión).
 */
export function detectarAcuerdos(texto, { clienteKey = null, personas = [], hoy = new Date(), yo = null, existentes = [] } = {}) {
  const ya = clavesExistentes(existentes);
  const vistos = new Set();
  const out = [];
  const lineas = String(texto ?? '').split(/\r?\n/);
  for (let i = 0; i < lineas.length; i += 1) {
    const cruda = lineas[i];
    if (!cruda.trim() || !esAcuerdo(cruda, { hoy })) continue;
    const a = analizarLinea(cruda, { clienteKey, personas, hoy, yo });
    if (!a.titulo) continue;
    const clave = normalizar(a.titulo);
    if (vistos.has(clave)) continue;
    vistos.add(clave);
    const yaExiste = ya.has(clave);
    out.push({ id: `l${i}`, indice: i, ...a, yaExiste, incluir: !yaExiste });
  }
  return out;
}

/** Cuántos acuerdos ve el contador de la minuta ("N acuerdos detectados"). */
export const contarAcuerdos = (texto, opciones) => detectarAcuerdos(texto, opciones).length;

/** Todas las líneas con la marca de acuerdo — para pintar el resaltado sobre el texto. */
export function lineasMarcadas(texto, { hoy = new Date() } = {}) {
  return String(texto ?? '').split(/\r?\n/).map((t, i) => ({ i, texto: t, acuerdo: esAcuerdo(t, { hoy }) }));
}

/** Chips de fecha de cada fila: hoy · mañana · viernes · próxima semana (+ "sin fecha"). */
export function opcionesFecha(hoy = new Date()) {
  const viernes = sumarDias(hoy, ((5 - hoy.getDay() + 7) % 7) || 7);
  return [
    { id: 'hoy', label: 'Hoy', fecha: isoDia(hoy) },
    { id: 'manana', label: 'Mañana', fecha: isoDia(sumarDias(hoy, 1)) },
    { id: 'viernes', label: 'Viernes', fecha: isoDia(viernes) },
    { id: 'proxima', label: 'Próxima semana', fecha: isoDia(sumarDias(hoy, ((8 - hoy.getDay()) % 7) || 7)) },
    { id: 'sin', label: 'Sin fecha', fecha: null },
  ];
}

/** Filas listas para `crearItem` (una por acuerdo incluido). `reunion` da reunion_id y cliente. */
export function filasAItems(filas, reunion, { orden0 = 0 } = {}) {
  return (filas || []).filter((f) => f.incluir).map((f, k) => ({
    tipo: 'punto',
    titulo: f.titulo,
    reunion_id: reunion?.id || null,
    cliente_key: f.clienteKey || reunion?.cliente_key || null,
    responsables: f.persona ? [f.persona] : [],
    fecha_limite: f.fecha || null,
    hora: f.hora || null,
    categoria: f.categoria || null,
    orden: orden0 + k,
    origen: { fuente: 'reparto', reunion_id: reunion?.id || null },
  }));
}

/** "3 pendientes · minuta cerrada" / "1 pendiente creado". */
export function textoReparto(n, { cerrada = true } = {}) {
  const base = `${n} pendiente${n === 1 ? '' : 's'} ${n === 1 ? 'creado' : 'creados'}`;
  return cerrada ? `${base} · minuta cerrada` : base;
}
