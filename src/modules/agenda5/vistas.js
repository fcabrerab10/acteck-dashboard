// Agenda · vistas Semana, Ideas y Equipo: cálculo puro (sin React ni red). Lo comparten la web (Agenda5.jsx) y el
// celular (movil/pestanas/agenda5/MasVistasM.jsx). Extraído de Agenda5.jsx el 2026-11-18 (congruencia web ↔ celular).
import { cuentasPendientes } from './base/calculo';
import { hoyDe, isoDia, sumarDias, esDe, abierto } from './calculo';

export const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const N = (v) => Number(v) || 0;
const mediodia = (iso) => new Date(`${iso}T12:00:00`);

/** Lunes (Date) de la semana de `fecha`. */
export function lunesDe(fecha = new Date()) {
  const x = new Date(fecha);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}

/**
 * La semana de `ref` (default hoy) para una persona: carga por día, objetivos, tiempo por área y qué revisar.
 * `d` = lo que devuelve useAgenda5 (items, reuniones, google, areas, objetivos, cuentas).
 */
export function semanaDe(d, propietario, { hoy = new Date(), ref = hoy, uid = propietario } = {}) {
  const lunes = lunesDe(ref);
  const semanaIso = isoDia(lunes);
  const hoyIso = isoDia(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => {
    const iso = isoDia(sumarDias(lunes, i));
    const h = hoyDe(d.items || [], propietario, mediodia(iso), { reuniones: d.reuniones || [], google: d.google || [] });
    return {
      iso, label: DIAS_CORTOS[i], esHoy: iso === hoyIso, h,
      hechas: h.hechasHoy.length, abiertas: h.deHoy.length, reuniones: h.reunionesHoy.length + h.googleHoy.length,
      minPlan: h.minTareas + h.minReuniones, minReal: h.minReales,
    };
  });
  const totHechas = dias.reduce((s, x) => s + x.hechas, 0);
  const totAbiertas = dias.reduce((s, x) => s + x.abiertas, 0);
  const totMin = dias.reduce((s, x) => s + x.minReal, 0);
  const area = new Map();
  for (const x of dias) for (const it of x.h.hechasHoy) {
    const a = (d.areas || []).find((z) => z.id === it.area_id);
    const k = a?.nombre || 'Sin área';
    area.set(k, (area.get(k) || 0) + (N(it.min_real) || N(it.duracion_min)));
  }
  const objetivos = (d.objetivos || []).filter((o) => o.usuario === propietario && o.semana === semanaIso)
    .sort((a, b) => N(a.orden) - N(b.orden) || String(a.created_at).localeCompare(String(b.created_at)));
  const acuerdosVencidos = (d.items || []).filter((it) => it.tipo === 'punto' && abierto(it) && it.fecha_limite && it.fecha_limite < hoyIso && (it.responsables || []).includes(propietario));
  return {
    lunes, semanaIso, hoyIso, dias, totHechas, totAbiertas, totMin,
    cargaMax: Math.max(1, ...dias.map((x) => x.hechas + x.abiertas + x.reuniones)),
    porArea: [...area.entries()].sort((a, b) => b[1] - a[1]),
    objetivos, cumplidos: objetivos.filter((o) => o.cumplido).length,
    sinContacto: propietario === uid ? cuentasPendientes(d.cuentas || [], hoy) : [],
    acuerdosVencidos,
  };
}

/** Ideas y notas abiertas de una persona (fuera de la bandeja), la más nueva primero. */
export function ideasDe(items = [], propietario) {
  return items.filter((it) => esDe(it, propietario) && abierto(it) && (it.tipo === 'idea' || it.tipo === 'nota') && !it.bandeja)
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
}

/** Parche que convierte una idea en pendiente: `cuando` = fecha ISO (hoy) o null (cuando sea). */
export const parchePromoverIdea = (cuando = null) => ({ tipo: 'tarea', cuando, promovido_a: null });

/** Check-in del día de una persona (o null). */
export const checkinDe = (checkins = [], usuario, hoyIso, tipo = 'dia') => checkins.find((c) => c.usuario === usuario && c.fecha === hoyIso && c.tipo === tipo) || null;

/** Lo que trae cada persona hoy + su check-in. */
export function equipoDe(d, personas = [], hoy = new Date()) {
  const hoyIso = isoDia(hoy);
  return personas.map((p) => {
    const h = hoyDe(d.items || [], p.user_id, hoy, { reuniones: d.reuniones || [] });
    return { persona: p, h, hechas: h.hechasHoy.length, abiertas: h.deHoy.length, atrasadas: h.deAyer.length, deHoy: h.deHoy, checkin: checkinDe(d.checkins || [], p.user_id, hoyIso) };
  });
}
