// «Mi ritmo» (2026-10-05, Fernando: «que cada usuario pueda configurar su agenda a su gusto: a qué hora empieza,
// a qué hora acaba, qué va a hacer en el día»). Puro. Las horas viven en perfiles.preferencias.agenda.horas.
import { HORAS_DEFAULT } from './proponer';

const min = (hhmm) => { const [h, m] = String(hhmm || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export const PASOS_RITMO = [
  { id: 'armar', pregunta: '¿A qué hora empiezas a trabajar?', ayuda: 'A esa hora la Agenda te arma el día.' },
  { id: 'pausa', pregunta: '¿Haces una pausa larga?', ayuda: 'Comida, gimnasio, escuela… La Agenda no te cuenta ese tiempo.' },
  { id: 'cierre', pregunta: '¿A qué hora cierras el día?', ayuda: 'A esa hora te pide cerrar: qué se hizo y qué se va a mañana.' },
  { id: 'hoy', pregunta: '¿Qué vas a hacer hoy?', ayuda: 'Una cosa por renglón. Entiende fechas, horas, #cliente y @persona.' },
];

/** Normaliza y valida; devuelve { horas, error }. sinPausa = true deja pausa y retomar iguales. */
export function normalizarRitmo({ armar, pausa, retomar, cierre, sinPausa = false } = {}) {
  const a = min(armar), c = min(cierre);
  if (a == null || c == null) return { horas: null, error: 'Falta la hora de inicio o de cierre.' };
  if (c <= a) return { horas: null, error: 'El cierre tiene que ser después del inicio.' };
  let p = sinPausa ? null : min(pausa), r = sinPausa ? null : min(retomar);
  if (sinPausa || p == null || r == null) { p = c; r = c; }
  if (p < a || r > c || r < p) return { horas: null, error: 'La pausa tiene que caer dentro de la jornada.' };
  return { horas: { armar: hhmm(a), pausa: hhmm(p), retomar: hhmm(r), cierre: hhmm(c) }, error: null };
}

export const tienePausa = (h) => !!h && h.pausa !== h.retomar;
export const jornadaMin = (h = HORAS_DEFAULT) => (min(h.pausa) - min(h.armar)) + (min(h.cierre) - min(h.retomar));
export function resumenRitmo(h) {
  if (!h) return 'sin configurar';
  const j = jornadaMin(h); const hs = Math.floor(j / 60), ms = j % 60;
  return `${tienePausa(h) ? `${h.armar}–${h.pausa} y ${h.retomar}–${h.cierre}` : `${h.armar}–${h.cierre}`} · ${hs} h${ms ? ` ${ms} min` : ''}`;
}
/** Renglones de «qué vas a hacer hoy» → textos limpios para crearDesdeCaptura. */
export const renglonesHoy = (texto) => String(texto || '').split('\n').map((l) => l.replace(/^[-•*\d.)\s]+/, '').trim()).filter(Boolean);
