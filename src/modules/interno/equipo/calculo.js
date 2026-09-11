// Actividad del equipo · cálculo puro (sin React, sin Supabase). Pruebas: scripts/test-equipo-calculo.mjs
//
// Entradas crudas:
//   eventos   = filas de eventos_usuario { user_id, ts, tipo, cliente, pagina, detalle }  (tipo 10 = heartbeat ≈ 1 min)
//   auditoria = filas de auditoria_cambios { tabla, operacion, usuario_id, cambios, creado_at, cliente_key }
//   agenda    = filas de agenda_items { tipo, estado, fecha_limite, responsables[], completado_en, reunion_id }
// Todas las fechas se comparan en hora local del navegador (CDMX).
import { traducirAccion } from './textos.js';

export const TIPO_HEARTBEAT = 10;
export const BONO_BASE = 3000;
export const BONO_PCT = 0.0004;
export const DIGITALIFE_CUOTA_ANUAL = 25_000_000;
export const CLIENTES_BONO = ['digitalife', 'pcel', 'dicotech'];
export const UMBRAL_INACTIVIDAD_DEFAULT = 3;   // días hábiles
export const UMBRALES_INACTIVIDAD = [2, 3, 5];
export const GAP_SESION_MIN = 30;              // minutos sin eventos = nueva sesión
export const ESTADOS_ABIERTOS = new Set(['abierta', 'arrastrada']);

const MS_DIA = 86400000;
const pad = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en hora local. */
export function isoDia(d) {
  const x = d instanceof Date ? d : new Date(d);
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}
export function diaLocal(iso) { return new Date(`${String(iso).slice(0, 10)}T12:00:00`); }
export function sumarDias(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
/** Lunes de la semana de `d` (00:00 local). */
export function inicioSemana(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  const dow = x.getDay();
  return sumarDias(x, dow === 0 ? -6 : 1 - dow);
}
export const esHabil = (d) => { const w = new Date(d).getDay(); return w !== 0 && w !== 6; };

/** Días hábiles (L-V) transcurridos DESPUÉS de `desde` hasta `hasta` inclusive, por día calendario. */
export function diasHabilesEntre(desde, hasta) {
  if (!desde) return null;
  let cur = diaLocal(isoDia(desde));
  const fin = diaLocal(isoDia(hasta));
  let n = 0;
  while (cur < fin) { cur = sumarDias(cur, 1); if (esHabil(cur)) n += 1; }
  return n;
}

// ─── Telemetría ───

/** Sesiones por huecos > gapMin entre eventos consecutivos. eventos de UN usuario, cualquier orden. */
export function sesiones(eventos, gapMin = GAP_SESION_MIN) {
  const evs = (eventos || []).slice().sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  const out = [];
  let cur = null;
  for (const e of evs) {
    const t = new Date(e.ts).getTime();
    if (!cur || t - cur._ultimoMs > gapMin * 60000) {
      cur = { inicio: e.ts, fin: e.ts, minutos: 0, paginas: {}, clientes: {}, acciones: 0, _ultimoMs: t };
      out.push(cur);
    }
    cur.fin = e.ts; cur._ultimoMs = t;
    if (e.tipo === TIPO_HEARTBEAT) {
      cur.minutos += 1;
      if (e.pagina) cur.paginas[e.pagina] = (cur.paginas[e.pagina] || 0) + 1;
      if (e.cliente) cur.clientes[e.cliente] = (cur.clientes[e.cliente] || 0) + 1;
    } else if (e.tipo >= 3 && e.tipo <= 7) cur.acciones += 1;
  }
  for (const s of out) { delete s._ultimoMs; s.dia = isoDia(s.inicio); }
  return out;
}

const top = (obj, n = 3) => Object.entries(obj || {}).map(([k, v]) => [Number(k), v]).sort((a, b) => b[1] - a[1]).slice(0, n);

/** Resumen de telemetría de un usuario en el rango. `desdeSemana` = lunes de esta semana. */
export function resumenTelemetria(eventos, { hoy, desdeSemana } = {}) {
  hoy = hoy || new Date();
  desdeSemana = desdeSemana || inicioSemana(hoy);
  const evs = eventos || [];
  const hoyIso = isoDia(hoy);
  const semIso = isoDia(desdeSemana);
  let ultimo = null;
  const dias = new Set();
  const diasSemana = new Set();
  let minutos = 0, minutosSemana = 0;
  const paginas = {}, clientes = {};
  for (const e of evs) {
    const d = isoDia(e.ts);
    if (!ultimo || String(e.ts) > String(ultimo)) ultimo = e.ts;
    dias.add(d);
    if (d >= semIso) diasSemana.add(d);
    if (e.tipo === TIPO_HEARTBEAT) {
      minutos += 1;
      if (d >= semIso) {
        minutosSemana += 1;
        if (e.pagina) paginas[e.pagina] = (paginas[e.pagina] || 0) + 1;
        if (e.cliente) clientes[e.cliente] = (clientes[e.cliente] || 0) + 1;
      }
    }
  }
  const ses = sesiones(evs);
  const sesionesSemana = ses.filter((s) => s.dia >= semIso);
  const totalCli = Object.values(clientes).reduce((s, v) => s + v, 0);
  const cliTop = top(clientes, 1)[0] || null;
  return {
    ultimo, activoHoy: dias.has(hoyIso),
    diasActivos: dias.size, diasActivosSemana: diasSemana.size,
    minutos, minutosSemana,
    sesiones: ses, sesionesSemana: sesionesSemana.length,
    paginasTop: top(paginas, 3), clienteTop: cliTop ? cliTop[0] : null, pctClienteTop: cliTop && totalCli ? Math.round(cliTop[1] / totalCli * 100) : 0,
  };
}

// ─── Auditoría ───

/** Traduce y ordena (desc) filas de auditoría de un usuario; descarta el ruido (traducirAccion → null). */
export function acciones(filas) {
  const out = [];
  for (const f of filas || []) {
    const t = traducirAccion(f);
    if (!t) continue;
    out.push({ ts: f.creado_at, dia: isoDia(f.creado_at), label: t.label, area: t.area, tabla: f.tabla, operacion: f.operacion, cliente_key: f.cliente_key || null, registro_id: f.registro_id ?? null });
  }
  return out.sort((a, b) => String(b.ts).localeCompare(String(a.ts)));
}

/** Top N por etiqueta. */
export function principales(lista, n = 3) {
  const m = new Map();
  for (const a of lista || []) m.set(a.label, (m.get(a.label) || 0) + 1);
  return [...m].map(([label, cnt]) => ({ label, n: cnt })).sort((a, b) => b.n - a.n || a.label.localeCompare(b.label)).slice(0, n);
}

/** Resumen de acciones: esta semana (conteo + 3 principales), por día (desc) y por semana (4 semanas, desc). */
export function resumenAcciones(filas, { hoy } = {}) {
  hoy = hoy || new Date();
  const lista = acciones(filas);
  const semIso = isoDia(inicioSemana(hoy));
  const semana = lista.filter((a) => a.dia >= semIso);
  const porDia = new Map();
  for (const a of lista) { if (!porDia.has(a.dia)) porDia.set(a.dia, []); porDia.get(a.dia).push(a); }
  const semanas = [];
  for (let i = 0; i < 4; i++) {
    const ini = sumarDias(inicioSemana(hoy), -7 * i);
    const fin = sumarDias(ini, 6);
    const a = isoDia(ini), b = isoDia(fin);
    const items = lista.filter((x) => x.dia >= a && x.dia <= b);
    semanas.push({ inicio: a, fin: b, total: items.length, principales: principales(items, 3) });
  }
  return { total: lista.length, semana: semana.length, principales: principales(semana, 3), porDia: [...porDia].map(([dia, items]) => ({ dia, items })), semanas, lista };
}

// ─── Agenda ───

const esResponsable = (item, userId) => Array.isArray(item?.responsables) && item.responsables.includes(userId);

/** Cumplimiento de pendientes de un responsable en los últimos `dias` días. */
export function cumplimientoAgenda(items, userId, { hoy, dias = 30 } = {}) {
  hoy = hoy || new Date();
  const hoyIso = isoDia(hoy);
  const desdeIso = isoDia(sumarDias(hoy, -dias));
  const mios = (items || []).filter((i) => esResponsable(i, userId));
  const abiertos = mios.filter((i) => ESTADOS_ABIERTOS.has(i.estado));
  const vencidos = abiertos.filter((i) => i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso);
  const cerrados = mios.filter((i) => i.estado === 'hecha' && i.completado_en && isoDia(i.completado_en) >= desdeIso);
  const aTiempo = cerrados.filter((i) => !i.fecha_limite || isoDia(i.completado_en) <= String(i.fecha_limite).slice(0, 10));
  const puntosCerrados = cerrados.filter((i) => i.tipo === 'punto').length;
  let ultimoCierre = null;
  for (const i of mios) if (i.completado_en && (!ultimoCierre || String(i.completado_en) > String(ultimoCierre))) ultimoCierre = i.completado_en;
  return {
    abiertos: abiertos.length, vencidos: vencidos.length, cerrados: cerrados.length, aTiempo: aTiempo.length,
    pctATiempo: cerrados.length ? Math.round(aTiempo.length / cerrados.length * 100) : null,
    puntosCerrados, ultimoCierre,
    listaAbiertos: abiertos.slice().sort((a, b) => String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'))),
  };
}

/** Pendientes vencidos de todo el equipo (abiertos con fecha límite pasada). */
export function vencidosEquipo(items, { hoy } = {}) {
  const hoyIso = isoDia(hoy || new Date());
  return (items || []).filter((i) => ESTADOS_ABIERTOS.has(i.estado) && i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso).length;
}

// ─── Inactividad ───

/** null si está al día; si no { sinEntrar, diasSinEntrar, sinCerrar, diasSinCerrar }. `umbral` en días hábiles. */
export function inactividad({ ultimoEvento, agenda, hoy, umbral = UMBRAL_INACTIVIDAD_DEFAULT }) {
  hoy = hoy || new Date();
  const diasSinEntrar = ultimoEvento ? diasHabilesEntre(ultimoEvento, hoy) : null;
  const sinEntrar = diasSinEntrar == null || diasSinEntrar >= umbral;
  let sinCerrar = false, diasSinCerrar = null;
  if (agenda && agenda.abiertos > 0) {
    diasSinCerrar = agenda.ultimoCierre ? diasHabilesEntre(agenda.ultimoCierre, hoy) : null;
    sinCerrar = diasSinCerrar == null || diasSinCerrar >= umbral;
  }
  if (!sinEntrar && !sinCerrar) return null;
  return { sinEntrar, diasSinEntrar: diasSinEntrar ?? umbral, sinCerrar, diasSinCerrar: diasSinCerrar ?? umbral };
}

// ─── Evaluación / bono ───

export const bonoEstimado = (facturacion) => BONO_BASE + (Number(facturacion) || 0) * BONO_PCT;
export const cuotaTotal = (cuotas) => (cuotas || []).reduce((s, r) => s + (Number(r.cuota_min) || 0), 0) + DIGITALIFE_CUOTA_ANUAL / 12;
export const facturadoTotal = (fact) => (fact || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
export function mesAnterior(anio, mes) { return mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }; }

/** ¿Falta cerrar la evaluación del mes anterior? (sólo usuarios con se_evalua) */
export function evaluacionPendiente(usuario, evaluaciones, { hoy } = {}) {
  if (!usuario?.se_evalua) return null;
  hoy = hoy || new Date();
  const { anio, mes } = mesAnterior(hoy.getFullYear(), hoy.getMonth() + 1);
  const e = (evaluaciones || []).find((x) => x.user_id === usuario.user_id && x.anio === anio && x.mes === mes);
  if (e?.cerrada) return null;
  return { anio, mes, existe: !!e, vencida: hoy.getDate() > 3 };
}

/** Serie de 12 meses (más antiguo → actual) para el LineChart del bono. */
export function serieBonos(evaluaciones, userId, { hoy, meses = 12 } = {}) {
  hoy = hoy || new Date();
  const idx = new Map((evaluaciones || []).filter((e) => e.user_id === userId).map((e) => [`${e.anio}-${e.mes}`, e]));
  const out = [];
  let a = hoy.getFullYear(), m = hoy.getMonth() + 1;
  for (let i = 0; i < meses; i++) {
    const e = idx.get(`${a}-${m}`);
    out.unshift({ anio: a, mes: m, bono: e ? Number(e.bono_total) || 0 : null, cuotaPct: e ? Number(e.cuota_pct) || 0 : null, cerrada: !!e?.cerrada });
    ({ anio: a, mes: m } = mesAnterior(a, m));
  }
  return out;
}

// ─── Pulso del equipo (hero + KPIs) ───

/**
 * usuarios: perfiles internos activos; porUsuario: Map user_id → { tele, acc, agenda, inact }.
 */
export function pulsoEquipo(usuarios, porUsuario, { agendaItems, hoy } = {}) {
  hoy = hoy || new Date();
  let activosHoy = 0, sesionesSemana = 0, accionesSemana = 0, minutosSemana = 0, inactivos = 0, cerrados = 0, aTiempo = 0;
  for (const u of usuarios || []) {
    const p = porUsuario?.get?.(u.user_id) || {};
    if (p.tele?.activoHoy) activosHoy += 1;
    sesionesSemana += p.tele?.sesionesSemana || 0;
    minutosSemana += p.tele?.minutosSemana || 0;
    accionesSemana += p.acc?.semana || 0;
    if (p.inact) inactivos += 1;
    cerrados += p.agenda?.cerrados || 0;
    aTiempo += p.agenda?.aTiempo || 0;
  }
  return {
    activosHoy, sesionesSemana, accionesSemana, minutosSemana, inactivos,
    vencidosEquipo: agendaItems ? vencidosEquipo(agendaItems, { hoy }) : null,
    pctATiempo: cerrados ? Math.round(aTiempo / cerrados * 100) : null,
  };
}

/** Orden de tarjetas: inactivos primero, luego quien se evalúa, luego por nombre. */
export function ordenarPersonas(usuarios, porUsuario) {
  return (usuarios || []).slice().sort((a, b) => {
    const ia = porUsuario?.get?.(a.user_id)?.inact ? 1 : 0, ib = porUsuario?.get?.(b.user_id)?.inact ? 1 : 0;
    if (ia !== ib) return ib - ia;
    if (!!a.se_evalua !== !!b.se_evalua) return a.se_evalua ? -1 : 1;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''));
  });
}
