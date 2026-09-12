// "Recordar pendientes" desde el celular · la app NUNCA inserta en `alertas`.
//
// Mecanismo (el mismo que usa la Agenda al asignar una tarea): se marcan los ítems VENCIDOS de esa
// persona en `agenda_items` con `notificar_a = [userId]` y `notificar_motivo = 'recordatorio'`.
// El cron (`api/cron.js` · reglaAgendaAsignado, tarea `generar-alertas`) recoge todo ítem con
// `notificar_a` no vacío, crea una alerta `agenda_asignado` DIRIGIDA a esa persona
// (clave `agenda_asignado|item|usuario|minuto`, caduca a 7 días, acción "Abrir Agenda") y limpia
// `notificar_a`. Hoy el cron sólo distingue el motivo 'cierre'; con 'recordatorio' el texto sale como
// «… te asignó: <título>». Si se quiere un texto propio ("Recordatorio: pendiente vencido"), basta
// añadir una rama por `notificar_motivo === 'recordatorio'` en esa función (no se tocó aquí).
//
// Antirrepetición: se guarda en localStorage el día en que se recordó a cada persona (una vez al día).
import { supabase } from '../../../lib/supabase';
import { leerLS, guardarLS, hoyISO } from '../../util';

const LS = 'movil_equipo_recordatorios_v1';
export const MOTIVO = 'recordatorio';

const mapa = () => { const m = leerLS(LS, {}); return m && typeof m === 'object' && !Array.isArray(m) ? m : {}; };

/** ¿Ya se le mandó recordatorio hoy a esta persona (desde este dispositivo)? */
export const yaRecordadoHoy = (userId) => mapa()[userId] === hoyISO();

/** Marca los ítems vencidos para que el cron genere la alerta. Devuelve cuántos. */
export async function recordarPendientes(userId, vencidos) {
  const ids = [...new Set((vencidos || []).map((i) => i.id).filter(Boolean))];
  if (!userId || !ids.length) return 0;
  const { error } = await supabase.from('agenda_items')
    .update({ notificar_a: [userId], notificar_motivo: MOTIVO })
    .in('id', ids);
  if (error) throw error;
  const m = mapa(); m[userId] = hoyISO(); guardarLS(LS, m);
  return ids.length;
}
