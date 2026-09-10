// Frescura de las fuentes manuales y latido del puente. Todo el cálculo vive aquí
// (sin React) para que la tabla, el hero y el anillo cuenten la misma historia.
import { HORARIO_PUENTE, ORIGEN_PUENTE, normalizarCadencia } from './config';

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

/** Fecha esperada más reciente (≤ hoy), la siguiente y el largo del periodo, según la cadencia. */
export function ventana(cadencia, ahora = new Date()) {
  const c = normalizarCadencia(cadencia);
  const hoy = inicioDia(ahora);
  if (c.tipo === 'semanal') {
    const dow = hoy.getDay() || 7; // 1..7, lunes = 1
    const delta = (dow - c.dia + 7) % 7;
    const vence = new Date(hoy.getTime() - delta * DIA);
    return { vence, siguiente: new Date(vence.getTime() + 7 * DIA), largoMs: 7 * DIA };
  }
  if (c.tipo === 'mensual') {
    const y = hoy.getFullYear(), m = hoy.getMonth();
    let vence = new Date(y, m, c.dia);
    if (vence > hoy) vence = new Date(y, m - 1, c.dia);
    const siguiente = new Date(vence.getFullYear(), vence.getMonth() + 1, c.dia);
    return { vence, siguiente, largoMs: siguiente - vence };
  }
  return null;
}

/**
 * Estado de una fuente manual a partir de su cadencia y su última carga (función pura, sin React ni
 * status del API; la usan la tabla del importador, el hero y la pestaña Datos del avatar).
 *
 *   estadoManual(fuente, ultimaCarga, ahora) → {
 *     estado: 'al_dia' | 'por_vencer' | 'atrasada',
 *     tone:   'green'  | 'orange'     | 'red' (gray si es "cuando cambie" y nunca se cargó),
 *     pct:    fracción de la cadencia transcurrida desde la última carga (llena el anillo),
 *     dias:   días desde la última carga (null si nunca),
 *     diasAtraso:  días después del límite (0 si no está atrasada),
 *     diasParaLimite: días que faltan para el límite (sólo por_vencer),
 *     vence / limite / siguiente: fechas del periodo vigente (null para "cuando cambie"),
 *     cambio: true si la cadencia es "cuando cambie", sinDatos: true si nunca se cargó,
 *   }
 *   · al_dia     → hay carga dentro del periodo vigente (≥ fecha esperada) o aún no toca.
 *   · por_vencer → ya pasó la fecha esperada, no hay carga y no llegamos al límite (esperada + tolerancia).
 *   · atrasada   → pasó el límite sin carga (o nunca se cargó).
 */
export function estadoManual(fuente, ultima, ahora = new Date()) {
  const c = normalizarCadencia(fuente?.cadencia);
  const t = ultima instanceof Date ? ultima.getTime() : typeof ultima === 'number' ? ultima : ultima ? Date.parse(ultima) : null;
  const dias = t ? Math.floor((ahora - t) / DIA) : null;
  if (c.tipo === 'cambio') {
    return { estado: 'al_dia', tone: t ? 'green' : 'gray', pct: 0, dias, diasAtraso: 0, diasParaLimite: null, vence: null, limite: null, siguiente: null, cambio: true, sinDatos: !t, cadencia: c };
  }
  const { vence, siguiente, largoMs } = ventana(c, ahora);
  const limite = new Date(vence.getTime() + c.tolerancia * DIA);
  const hoy = inicioDia(ahora);
  const base = { dias, vence, limite, siguiente, cambio: false, sinDatos: !t, cadencia: c };
  const atrasada = (desde) => ({ ...base, estado: 'atrasada', tone: 'red', pct: 1, diasAtraso: Math.max(1, Math.floor((hoy - desde) / DIA) + 1), diasParaLimite: null });
  if (!t) return atrasada(limite);
  const pct = Math.min(1, (ahora - t) / largoMs);
  if (t >= vence.getTime()) return { ...base, estado: 'al_dia', tone: 'green', pct, diasAtraso: 0, diasParaLimite: null };
  // Primer periodo esperado que quedó sin carga: si es anterior al vigente, ya se saltó uno completo → atrasada
  // aunque hoy sea "día de carga" otra vez (el atraso se cuenta desde el límite de ese primer periodo).
  const primeraFaltante = primeraEsperadaDespues(t, vence, c);
  if (primeraFaltante.getTime() < vence.getTime()) return atrasada(new Date(primeraFaltante.getTime() + c.tolerancia * DIA));
  if (hoy < limite) return { ...base, estado: 'por_vencer', tone: 'orange', pct, diasAtraso: 0, diasParaLimite: Math.max(0, Math.round((limite - hoy) / DIA)) };
  return atrasada(limite);
}

/** Retrocede desde `vence` periodo a periodo hasta la primera fecha esperada posterior a `t`. */
function primeraEsperadaDespues(t, vence, c) {
  let f = vence;
  for (let i = 0; i < 60; i++) {
    const prev = c.tipo === 'semanal' ? new Date(f.getTime() - 7 * DIA) : new Date(f.getFullYear(), f.getMonth() - 1, c.dia);
    if (prev.getTime() <= t) break;
    f = prev;
  }
  return f;
}

/**
 * Estado de una fuente manual leyendo su última carga del status del API (sync_status + sync_events +
 * updated_at). Devuelve lo de estadoManual() más { ultima, ev, item }.
 */
export function frescuraManual(fuente, status, ahora = new Date(), info = null) {
  const { t, ev, item } = ultimaCarga(fuente.statusKey, status, info);
  return { ultima: t, ev, item, ...estadoManual(fuente, t, ahora) };
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
