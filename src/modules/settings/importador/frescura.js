// Frescura de las fuentes manuales y latido del puente. Todo el cálculo vive aquí
// (sin React) para que la tabla, el hero y el anillo cuenten la misma historia.
import { HORARIO_PUENTE, ORIGEN_PUENTE } from './config';

const DIA = 86400000;
const inicioDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Última carga exitosa de una fuente: máximo entre sync_status, el último éxito de
 * sync_events y el updated_at de la propia tabla (/api/status?type=upload), que
 * cubre fuentes cargadas antes de que existiera el historial (Roadmap, P&L).
 */
export function ultimaCarga(statusKey, status, info) {
  const item = (status?.items || []).find((x) => x.fuente === statusKey);
  const evOk = (status?.historial?.[statusKey] || []).find((e) => e.status === 'success');
  // sync_status trae filas semilla (registros 0, abril 2026) que no son cargas reales.
  const a = item?.ultima_actualizacion && item.registros ? Date.parse(item.ultima_actualizacion) : 0;
  const b = evOk?.created_at ? Date.parse(evOk.created_at) : 0;
  const c = info?.updated_at ? Date.parse(info.updated_at) : 0;
  const t = Math.max(a, b, c) || null;
  return { t, ev: evOk, item };
}

/** Fecha de vencimiento más reciente (≤ hoy) y la siguiente, según la cadencia. */
export function ventana(cadencia, ahora = new Date()) {
  const hoy = inicioDia(ahora);
  if (cadencia.tipo === 'semanal') {
    const dow = hoy.getDay() || 7; // 1..7, lunes = 1
    const delta = (dow - cadencia.dia + 7) % 7;
    const vence = new Date(hoy.getTime() - delta * DIA);
    return { vence, siguiente: new Date(vence.getTime() + 7 * DIA), largoMs: 7 * DIA };
  }
  if (cadencia.tipo === 'mensual') {
    const y = hoy.getFullYear(), m = hoy.getMonth();
    let vence = new Date(y, m, cadencia.dia);
    if (vence > hoy) vence = new Date(y, m - 1, cadencia.dia);
    const siguiente = new Date(vence.getFullYear(), vence.getMonth() + 1, cadencia.dia);
    return { vence, siguiente, largoMs: siguiente - vence };
  }
  return null;
}

/**
 * Estado de una fuente manual:
 *   { estado: 'ok'|'pronto'|'atrasada'|'sin_datos'|'cambio', pct 0..1, dias, diasAtraso, tone, ultima }
 *   · pct   = fracción de la cadencia transcurrida desde la última carga (llena el anillo)
 *   · tone  = green (al día) · orange (≥ 80 % o hoy toca) · red (atrasada) · gray
 */
export function frescuraManual(fuente, status, ahora = new Date(), info = null) {
  const { t, ev, item } = ultimaCarga(fuente.statusKey, status, info);
  const base = { ultima: t, ev, item };
  if (fuente.cadencia.tipo === 'cambio') return { ...base, estado: 'cambio', pct: 0, dias: t ? Math.floor((ahora - t) / DIA) : null, diasAtraso: 0, tone: t ? 'green' : 'gray' };
  if (!t) return { ...base, estado: 'sin_datos', pct: 1, dias: null, diasAtraso: null, tone: 'red' };
  const { vence, largoMs } = ventana(fuente.cadencia, ahora);
  const dias = Math.floor((ahora - t) / DIA);
  const pct = Math.min(1, (ahora - t) / largoMs);
  if (t < vence.getTime()) {
    // El día que toca todavía no cuenta como atraso: "hoy toca" (naranja).
    if (inicioDia(ahora).getTime() === vence.getTime()) return { ...base, estado: 'pronto', pct, dias, diasAtraso: 0, tone: 'orange' };
    const diasAtraso = Math.max(1, Math.floor((inicioDia(ahora) - vence) / DIA));
    return { ...base, estado: 'atrasada', pct: 1, dias, diasAtraso, tone: 'red' };
  }
  return { ...base, estado: pct >= 0.8 ? 'pronto' : 'ok', pct, dias, diasAtraso: 0, tone: pct >= 0.8 ? 'orange' : 'green' };
}

/** Próxima corrida programada del puente (launchd) a partir de `ahora`. */
export function proximaCorrida(ahora = new Date()) {
  const { diario, intradia } = HORARIO_PUENTE;
  for (let d = 0; d < 8; d++) {
    const dia = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate() + d);
    const cands = [new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), diario.h, diario.m)];
    if (intradia.dias.includes(dia.getDay())) for (let h = intradia.desde; h <= intradia.hasta; h++) cands.push(new Date(dia.getFullYear(), dia.getMonth(), dia.getDate(), h, 0));
    const next = cands.filter((c) => c > ahora).sort((a, b) => a - b)[0];
    if (next) return next;
  }
  return null;
}

/** Latido del puente: sync_status.fuente = 'puente' (lo escribe cada corrida) o, si aún no existe, el último evento del puente. */
export function latidoPuente(status, ahora = Date.now()) {
  const row = (status?.items || []).find((x) => x.fuente === 'puente');
  const evPuente = (status?.puente || [])[0] || Object.values(status?.eventos || {}).filter((e) => e.user_nombre === ORIGEN_PUENTE).sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))[0];
  const t = row?.ultima_actualizacion ? Date.parse(row.ultima_actualizacion) : evPuente?.created_at ? Date.parse(evPuente.created_at) : null;
  const min = t ? (ahora - t) / 60000 : null;
  // Con latido cada 5 min, 20 min sin señal es sospechoso. Sin fila 'puente' (agentes viejos), toleramos hasta la siguiente corrida + 30 min.
  const limite = row ? HORARIO_PUENTE.latidoMin * 4 : 90;
  return { t, min, enLinea: min != null && min <= limite, conLatido: !!row, meta: row?.meta || null, proxima: proximaCorrida(new Date(ahora)) };
}

/** Estado de una carga automática (misma regla que la tarjeta anterior). */
export function estadoAutomatica(row, item, ev, ahora = new Date()) {
  const ultima = item?.ultima_actualizacion ? new Date(item.ultima_actualizacion) : null;
  const evFecha = ev?.created_at ? new Date(ev.created_at) : null;
  if (ev && ev.status === 'error' && (!ultima || evFecha >= ultima)) return { tone: 'red', texto: 'Error', detalle: ev.detalles?.mensaje || ev.detalles?.error || 'ver log del puente' };
  if (!ultima) return { tone: 'gray', texto: 'Sin carga', detalle: 'todavía no corre' };
  const horas = (ahora - ultima) / 3600000;
  const dia = ahora.getDay(), h = ahora.getHours();
  const enHorario = dia >= 1 && dia <= 6 && h >= 9 && h < 21;
  const limite = row.horaria && enHorario ? 3 : 27;
  if (horas > limite) return { tone: 'orange', texto: 'Atrasada', detalle: `última carga ${relTiempo(ultima)}` };
  return { tone: 'green', texto: 'OK', detalle: ev?.status === 'warning' ? 'con avisos' : 'al día' };
}

export function relTiempo(d, ahora = Date.now()) {
  const t = d instanceof Date ? d.getTime() : typeof d === 'number' ? d : Date.parse(d);
  if (!Number.isFinite(t)) return '—';
  const min = Math.floor((ahora - t) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  const dd = Math.floor(h / 24);
  return dd === 1 ? 'ayer' : `hace ${dd} d`;
}

export const fmtHora = (d) => (d ? d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '—');
export const fmtFechaHora = (d) => (d ? new Date(d).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');
