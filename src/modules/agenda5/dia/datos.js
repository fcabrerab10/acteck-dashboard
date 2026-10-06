// Agenda «que te lleva» · datos: lo que el negocio sabe de la persona (fuentes chicas, sólo con la Agenda montada) y
// las decisiones del día. Las propuestas no se guardan: se recalculan con proponer(); sólo se guarda lo decidido.
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { queryClient } from '../../../lib/queryClient';
import { escribir } from '../../../lib/buzon';
import { actualizarItem, recargarAgenda, KEY_AGENDA } from '../base/datos';
import { isoDia } from '../calculo';
import { proponer, sumarDiasIso, HORAS_DEFAULT } from './proponer';

const KEY = (uid, hoy) => ['agenda', 'dia', uid, hoy];
const seg = (p, nombre) => Promise.resolve(p).then((r) => { if (r?.error) throw r.error; return r?.data || r || []; }).catch((e) => { console.warn(`[agenda dia] ${nombre}:`, e?.message || e); return []; });

/** Fuentes del día para `uid` (dueño de la agenda que se ve). `items`/`reuniones` vienen de useAgenda5. */
export function useFuentesDia({ uid, enabled = true, hoy = new Date() }) {
  const hoyIso = isoDia(hoy);
  return useQuery({
    queryKey: KEY(uid, hoyIso), enabled: !!uid && enabled, staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const [pagos, cuentas, propuestas, frescura, forecastLotes, decisiones] = await Promise.all([
        seg(supabase.from('pagos').select('id,cliente,tipo,estado,monto,concepto,periodo,created_at').in('estado', ['calculado', 'solicitado']).order('created_at', { ascending: false }).limit(50), 'pagos'),
        seg(supabase.from('cuentas_seguimiento').select('id,nombre,empresa,telefono,proximo_seguimiento,ultimo_contacto,recordar_cada_dias,estado').eq('estado', 'activa').lte('proximo_seguimiento', hoyIso).limit(100), 'cuentas'),
        seg(supabase.from('propuestas_borradores').select('id,nombre,cliente_key,estado,enviada_at,resumen').eq('estado', 'enviada').limit(50), 'propuestas'),
        seg(supabase.from('v_fuentes_frescura').select('fuente,etiqueta,estado,dias,umbral_dias'), 'frescura'),
        seg(supabase.from('forecast_crm_lotes').select('id,mes_inicio,created_at').order('created_at', { ascending: false }).limit(5), 'forecast'),
        seg(supabase.from('agenda_dia_decisiones').select('fuente,ref,decision,fecha,hasta,item_id').eq('usuario', uid).or(`fecha.eq.${hoyIso},hasta.gte.${hoyIso}`), 'decisiones'),
      ]);
      return { pagos, cuentas, propuestas, frescura, forecastLotes, decisiones, hoyIso };
    },
  });
}

/** Arma las propuestas con las fuentes + lo que ya está en la agenda (acuerdos abiertos de minutas, viajes). */
export function propuestasDe(f, { items = [], reuniones = [], hoyIso, horas } = {}) {
  if (!f) return [];
  const reunionesPorId = new Map(reuniones.map((r) => [r.id, r]));
  const acuerdos = items.filter((it) => it.tipo === 'punto' && it.estado === 'abierta' && it.reunion_id && !it.cuando && !it.fecha_limite)
    .map((it) => { const r = reunionesPorId.get(it.reunion_id); return { ...it, reunionTitulo: r?.titulo, reunionFecha: r ? String(r.fecha).slice(0, 10) : null }; });
  const viajes = reuniones.filter((r) => r.tipo === 'viaje');
  return proponer({ hoyIso: hoyIso || f.hoyIso, pagos: f.pagos, cuentas: f.cuentas, propuestas: f.propuestas, frescura: f.frescura, forecastLotes: f.forecastLotes, acuerdos, viajes, decisiones: f.decisiones, horas });
}

export const invalidarDia = (uid, hoyIso) => queryClient.invalidateQueries({ queryKey: KEY(uid, hoyIso) });

/** Decide una propuesta: aceptada (crea el ítem de hoy), mañana o descartada (no vuelve en 14 días). */
export async function decidir(uid, hoyIso, p, decision, { propietario = null } = {}) {
  let item_id = null;
  if (decision === 'aceptada') {
    const row = { tipo: 'tarea', titulo: p.titulo, notas: p.sub || null, estado: 'abierta', prioridad: p.prioridad === 0 ? 'alta' : 'media', cuando: hoyIso, duracion_min: p.min || 15,
      cliente_key: p.accion?.clienteKey || 'interno', responsables: [propietario || uid], propietario: propietario || uid, creado_por: uid, bandeja: false,
      origen: { fuente: p.fuente, ref: p.ref, hilo: p.hilo, porque: p.porque, accion: p.accion || null } };
    const { data } = await escribir({ tabla: 'agenda_items', op: 'insert', filas: row, origen: 'Agenda', titulo: row.titulo });
    item_id = data?.id || null;
    queryClient.setQueryData(KEY_AGENDA, (prev) => (prev && data ? { ...prev, items: [...prev.items, data] } : prev));
  }
  const hasta = decision === 'manana' ? sumarDiasIso(hoyIso, 1) : decision === 'descartada' ? sumarDiasIso(hoyIso, 14) : null;
  const { error } = await supabase.from('agenda_dia_decisiones').upsert({ usuario: uid, fecha: hoyIso, fuente: p.fuente, ref: String(p.ref), decision, item_id, hasta }, { onConflict: 'usuario,fecha,fuente,ref' });
  if (error) throw error;
  await invalidarDia(uid, hoyIso);
  if (decision === 'aceptada') await recargarAgenda();
  return item_id;
}

/** Cierre del día: guarda el registro y arrastra lo abierto de hoy a mañana. */
export async function cerrarDia(uid, hoyIso, { resumen = '', reflexion = '', energia = null, manana_empiezo = '', min_planeados = 0, min_reales = 0 } = {}, abiertosHoy = []) {
  const { error } = await supabase.from('agenda_registro_dia').upsert({ usuario: uid, fecha: hoyIso, resumen, reflexion, energia, manana_empiezo, min_planeados, min_reales, cerrado_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: 'usuario,fecha' });
  if (error) throw error;
  const man = sumarDiasIso(hoyIso, 1);
  for (const it of abiertosHoy) await actualizarItem(it.id, { cuando: man, estado: 'abierta' });
  await recargarAgenda();
}

export const horasDe = (perfil) => ({ ...HORAS_DEFAULT, ...(perfil?.preferencias?.agenda?.horas || {}) });
export const navegar = (accion) => {
  if (!accion) return;
  if (accion.tel) { window.location.href = `tel:${accion.tel}`; return; }
  window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina: accion.pagina, clienteKey: accion.clienteKey || null, extra: accion.extra || null } }));
};
