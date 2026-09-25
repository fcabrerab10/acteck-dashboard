// «Buscar o preguntar» · responde una intención con datos de las MISMAS vistas del dashboard.
// Nada sale a un servicio externo. Cada respuesta: { titulo, cifra, sub, lineas[], abrir, tambien[] }.
// Respeta permisos: cliente visible (puedeVerCliente), cifras de empresa y márgenes sólo con
// puedeVerSensible, agenda/pagos/inventario con su permiso global.
import { supabase, DB_CONFIGURED } from '../supabase';
import { cachedQuery, fetchAll } from '../queries';
import { puedeVerCliente, puedeVerSensible, puedeVerPaginaGlobal, puedeVerPestanaGlobal } from '../permisos';
import { money, moneyCompact, int, pct } from '../format';

const NOMBRE = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const N = (v) => (v == null || v === '' ? 0 : Number(v) || 0);
const isoDia = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const fmtCorta = (iso) => { if (!iso) return ''; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso); return Number.isNaN(d.getTime()) ? '' : `${d.getDate()} ${MESES_C[d.getMonth()]}`; };
const fmtHora = (ts) => { const d = new Date(ts); return Number.isNaN(d.getTime()) ? '' : `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
const sinPermiso = (que) => ({ titulo: 'Sin permiso', cifra: '—', sub: `No tienes acceso a ${que}.`, lineas: [], abrir: null, tambien: [] });
const ir = (label, pagina, clienteKey = null, extra = null) => ({ label, pagina, clienteKey, extra });
const q1 = async (b) => { const { data, error } = await cachedQuery(b); if (error) throw error; return data || []; };

function periodo(i, hoy) {
  const anio = i.anio || hoy.getFullYear();
  const mes = i.relativo === 'anio' ? null : (i.mes || hoy.getMonth() + 1);
  return { anio, mes, etiqueta: mes ? `${MESES[mes - 1]} ${anio}` : `${anio} acumulado` };
}
function tambienCliente(ck, perfil) {
  if (!ck) return [];
  return [ir(`Sell In ${NOMBRE[ck]}`, 'sellIn', ck), ir(`Sell Out ${NOMBRE[ck]}`, 'sellOut', ck), ir(`Resumen ${NOMBRE[ck]}`, 'home', ck), ...(puedeVerPaginaGlobal(perfil, 'agenda') ? [ir(`Agenda de ${NOMBRE[ck]}`, 'agenda', null, { clienteKey: ck })] : [])];
}

// ── Cuota / avance ──────────────────────────────────────────────────────────────
async function cuota(i, ctx) {
  const { perfil, hoy } = ctx;
  const { anio, mes, etiqueta } = periodo({ ...i, relativo: i.relativo === 'anio' ? 'anio' : null }, hoy);
  if (!i.cliente) {
    if (!puedeVerSensible(perfil)) return sinPermiso('las cifras de la empresa');
    const [fact, cuo] = await Promise.all([
      q1(supabase.from('v_facturacion_global_mensual').select('anio,mes,monto').eq('anio', anio)),
      q1(supabase.from('v_medidas_cuota_mes').select('anio,mes,cuota_venta,cuota_minima').eq('anio', anio)),
    ]);
    const f = fact.filter((r) => !mes || N(r.mes) === mes), c = cuo.filter((r) => !mes || N(r.mes) === mes);
    const venta = f.reduce((s, r) => s + N(r.monto), 0), meta = c.reduce((s, r) => s + N(r.cuota_venta), 0);
    return { titulo: `Empresa · cuota de ${etiqueta}`, cifra: meta > 0 ? pct(venta / meta * 100, 0) : '—', sub: `${moneyCompact(venta)} de ${moneyCompact(meta)}${meta > venta ? ` · faltan ${moneyCompact(meta - venta)}` : ' · cuota cumplida'}`, lineas: [], abrir: ir('Abrir Inicio', 'inicio'), tambien: [ir('Visión General', 'visionGeneral'), ir('Sell In consolidado', 'sellIn')] };
  }
  const ck = i.cliente;
  if (!puedeVerCliente(perfil, ck)) return sinPermiso(NOMBRE[ck]);
  const [fact, cuo] = await Promise.all([
    q1(supabase.from('v_fact_cliente_mes').select('anio,mes,monto,piezas').eq('cliente_key', ck).eq('anio', anio)),
    fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal', (qq) => qq.eq('cliente', ck).eq('anio', anio)),
  ]);
  const f = fact.filter((r) => !mes || N(r.mes) === mes), c = cuo.filter((r) => !mes || N(r.mes) === mes);
  const venta = f.reduce((s, r) => s + N(r.monto), 0);
  const min = c.reduce((s, r) => s + N(r.cuota_min), 0), ideal = c.reduce((s, r) => s + N(r.cuota_ideal), 0);
  const dosCuotas = ideal > 0 && Math.abs(ideal - min) > 1;
  const meta = ideal > 0 ? ideal : min;
  const lineas = [];
  if (dosCuotas) lineas.push(`Mínima ${moneyCompact(min)} (${min > 0 ? pct(venta / min * 100, 0) : '—'}) · ideal ${moneyCompact(ideal)} (${pct(venta / ideal * 100, 0)})`);
  if (mes && anio === hoy.getFullYear() && mes === hoy.getMonth() + 1) {
    const ultimo = new Date(anio, mes, 0).getDate(); const faltan = ultimo - hoy.getDate();
    lineas.push(`${faltan} día${faltan === 1 ? '' : 's'} para el cierre${meta > venta && faltan > 0 ? ` · ${moneyCompact((meta - venta) / faltan)} por día para llegar` : ''}`);
  }
  return { titulo: `${NOMBRE[ck]} · cuota de ${etiqueta}`, cifra: meta > 0 ? pct(venta / meta * 100, 0) : '—', sub: `${moneyCompact(venta)} de ${moneyCompact(meta)}${meta > venta ? ` · gap ${moneyCompact(meta - venta)}` : ' · cuota cumplida'}`, lineas, abrir: ir(`Abrir Sell In de ${NOMBRE[ck]}`, 'sellIn', ck), tambien: tambienCliente(ck, perfil).slice(1) };
}

// ── Ventas (sell in) ───────────────────────────────────────────────────────────
async function ventas(i, ctx) {
  const { perfil, hoy } = ctx;
  const { anio, mes, etiqueta } = periodo(i, hoy);
  const ck = i.cliente;
  if (ck && !puedeVerCliente(perfil, ck)) return sinPermiso(NOMBRE[ck]);
  if (!ck && !puedeVerSensible(perfil)) return sinPermiso('las ventas de la empresa');
  const filas = ck
    ? await q1(supabase.from('v_fact_cliente_mes').select('anio,mes,monto,piezas').eq('cliente_key', ck).in('anio', [anio, anio - 1]))
    : await q1(supabase.from('v_facturacion_global_mensual').select('anio,mes,monto,piezas').in('anio', [anio, anio - 1]));
  const suma = (a, campo) => filas.filter((r) => N(r.anio) === a && (!mes || N(r.mes) === mes) && (mes || a < anio || N(r.mes) <= hoy.getMonth() + 1)).reduce((s, r) => s + N(r[campo]), 0);
  const v = suma(anio, 'monto'), p = suma(anio, 'piezas'), vAA = suma(anio - 1, 'monto');
  const yoy = vAA > 0 ? (v - vAA) / vAA * 100 : null;
  return { titulo: `${ck ? NOMBRE[ck] : 'Empresa'} · Sell In ${etiqueta}`, cifra: moneyCompact(v), sub: `${int(p)} piezas${yoy != null ? ` · ${yoy >= 0 ? '+' : ''}${pct(yoy, 1)} vs ${anio - 1}` : ''}`, lineas: vAA > 0 ? [`${etiqueta.replace(String(anio), String(anio - 1))}: ${moneyCompact(vAA)}`] : [], abrir: ir(ck ? `Abrir Sell In de ${NOMBRE[ck]}` : 'Abrir Sell In consolidado', 'sellIn', ck), tambien: ck ? tambienCliente(ck, perfil).slice(1) : [ir('Visión General', 'visionGeneral'), ir('Inicio', 'inicio')] };
}

// ── Sell out / inventario del cliente ─────────────────────────────────────────
async function sellout(i, ctx) {
  const { perfil, hoy } = ctx;
  const ck = i.cliente;
  if (!ck) { if (!puedeVerPestanaGlobal(perfil, 'sell_out')) return sinPermiso('Sell Out'); }
  else if (!puedeVerCliente(perfil, ck)) return sinPermiso(NOMBRE[ck]);
  const { anio, mes } = periodo(i, hoy);
  const filas = await q1(supabase.from('v_sellout_cuenta_mes').select('cuenta,nombre,anio,mes,importe,cantidad,inv_valor,inv_piezas,inv_semana,propio').eq('anio', anio).eq('mes', mes || hoy.getMonth() + 1).eq('propio', true));
  const r = ck ? filas.find((x) => x.cuenta === ck) : null;
  const etiqueta = `${MESES[(mes || hoy.getMonth() + 1) - 1]} ${anio}`;
  if (ck) {
    if (!r) return { titulo: `${NOMBRE[ck]} · Sell Out ${etiqueta}`, cifra: '—', sub: 'Sin sell out cargado para ese mes', lineas: [], abrir: ir(`Abrir Sell Out de ${NOMBRE[ck]}`, 'sellOut', ck), tambien: [] };
    if (i.foco === 'inventario') return { titulo: `${NOMBRE[ck]} · inventario que reporta`, cifra: moneyCompact(N(r.inv_valor)), sub: `${int(N(r.inv_piezas))} piezas · semana ${r.inv_semana || '—'}`, lineas: [`Sell out de ${etiqueta}: ${moneyCompact(N(r.importe))}`], abrir: ir(`Abrir Sell Out de ${NOMBRE[ck]}`, 'sellOut', ck), tambien: tambienCliente(ck, perfil).filter((t) => t.pagina !== 'sellOut') };
    return { titulo: `${NOMBRE[ck]} · Sell Out ${etiqueta}`, cifra: moneyCompact(N(r.importe)), sub: `${int(N(r.cantidad))} piezas · inventario ${moneyCompact(N(r.inv_valor))} (${int(N(r.inv_piezas))} pz)`, lineas: [], abrir: ir(`Abrir Sell Out de ${NOMBRE[ck]}`, 'sellOut', ck), tambien: tambienCliente(ck, perfil).filter((t) => t.pagina !== 'sellOut') };
  }
  const tot = filas.reduce((s, x) => s + N(x.importe), 0);
  return { titulo: `Clientes propios · Sell Out ${etiqueta}`, cifra: moneyCompact(tot), sub: filas.map((x) => `${NOMBRE[x.cuenta] || x.cuenta} ${moneyCompact(N(x.importe))}`).join(' · '), lineas: [], abrir: ir('Abrir Sell Out consolidado', 'sellOut'), tambien: [] };
}

// ── Stock / tránsito de un SKU ────────────────────────────────────────────────
async function stock(i, ctx) {
  const { perfil } = ctx;
  if (!(perfil?.es_super_admin || puedeVerPestanaGlobal(perfil, 'inventario_global') || puedeVerPestanaGlobal(perfil, 'resumen_clientes'))) return sinPermiso('el inventario');
  const sku = i.sku;
  const [inv, tr, rm] = await Promise.all([
    q1(supabase.from('v_medidas_inventario_sku').select('articulo,inv_actual,inv_actual_piezas,inv_actual_disponible,costo_promedio').eq('articulo', sku).limit(1)),
    q1(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,embarques,embarques_detalle').eq('sku', sku).limit(1)),
    q1(supabase.from('roadmap_sku').select('sku,descripcion,marca').eq('sku', sku).limit(1)),
  ]);
  const r = inv[0], t = tr[0], d = rm[0];
  const desc = d?.descripcion ? `${d.descripcion}` : '';
  const lineas = [];
  if (r) lineas.push(`Disponible ${int(N(r.inv_actual_disponible))} pz · valor ${moneyCompact(N(r.inv_actual))} · costo prom. ${money(N(r.costo_promedio))}`);
  if (t) {
    const det = Array.isArray(t.embarques_detalle) ? t.embarques_detalle : [];
    lineas.push(`En camino ${int(N(t.cantidad))} pz · ${t.embarques} embarque${N(t.embarques) === 1 ? '' : 's'} · llega ${fmtCorta(t.eta_mas_cercana)}${det[0]?.po ? ` (${det[0].po}${det[0].estatus ? ` · ${String(det[0].estatus).toLowerCase()}` : ''})` : ''}`);
  } else lineas.push('Nada en camino');
  if (i.tipo === 'transito') {
    return { titulo: `${sku} · en camino`, cifra: t ? `${int(N(t.cantidad))} pz` : '0 pz', sub: t ? `llega ${fmtCorta(t.eta_mas_cercana)} · ${t.embarques} embarque${N(t.embarques) === 1 ? '' : 's'}` : 'No hay PO abierta para este SKU', lineas: [desc, r ? `Stock hoy ${int(N(r.inv_actual_piezas))} pz` : ''].filter(Boolean), abrir: ir('Abrir Inventario', 'inventarioGlobal', null, { sku }), tambien: [ir('Proyectos y forecast', 'forecastReservas'), ir('S&OP', 'forecastClientes')] };
  }
  return { titulo: `${sku} · stock`, cifra: r ? `${int(N(r.inv_actual_piezas))} pz` : '0 pz', sub: desc || (r ? '' : 'Sin inventario comercial'), lineas, abrir: ir('Abrir Inventario', 'inventarioGlobal', null, { sku }), tambien: [ir('Sell In consolidado', 'sellIn', null, { sku }), ir('Estrategia de Precios', 'estrategiaPrecios')] };
}

// ── Agenda: pendientes y reuniones ────────────────────────────────────────────
async function agendaDatos() {
  const { fetchAgenda } = await import('../../modules/agenda/datos');
  const { bandeja } = await import('../../modules/agenda/calculo');
  const ag = await fetchAgenda();
  return { ...ag, bandeja };
}
async function pendientes(i, ctx) {
  const { perfil, hoy, uid } = ctx;
  if (!puedeVerPaginaGlobal(perfil, 'agenda')) return sinPermiso('la Agenda');
  const { items, bandeja } = await agendaDatos();
  const mios = (it) => !uid || !(it.responsables || []).length || (it.responsables || []).includes(uid);
  const b = bandeja(items.filter((it) => it.tipo !== 'punto' || true), hoy);
  let lista, titulo;
  if (i.cuando === 'vencidos') { lista = b.vencidas; titulo = 'Vencidos'; }
  else if (i.cuando === 'semana') { lista = [...b.vencidas, ...b.hoy, ...b.proximos]; titulo = 'Esta semana'; }
  else if (i.cuando === 'manana') { const m = isoDia(new Date(hoy.getTime() + 864e5)); lista = b.abiertos.filter((it) => it.fecha_limite === m); titulo = 'Mañana'; }
  else { lista = [...b.vencidas, ...b.hoy]; titulo = 'Hoy'; }
  if (i.cliente) lista = lista.filter((it) => it.cliente_key === i.cliente);
  const propios = lista.filter(mios);
  const ver = (propios.length ? propios : lista).slice(0, 5);
  return { titulo: `${titulo} · ${lista.length} pendiente${lista.length === 1 ? '' : 's'}${i.cliente ? ` de ${NOMBRE[i.cliente]}` : ''}`, cifra: String(lista.length), sub: b.vencidas.length && i.cuando !== 'vencidos' ? `${b.vencidas.length} vencido${b.vencidas.length === 1 ? '' : 's'} incluido${b.vencidas.length === 1 ? '' : 's'}` : (lista.length ? '' : 'Nada pendiente'), lineas: ver.map((it) => `${it.fecha_limite && it.fecha_limite < isoDia(hoy) ? '⚠ ' : ''}${it.titulo}${it.cliente_key ? ` · ${NOMBRE[it.cliente_key] || it.cliente_key}` : ''}`), abrir: ir('Abrir Agenda', 'agenda', null, { vista: 'pendientes' }), tambien: [ir('Calendario', 'agenda', null, { vista: 'calendario' })], items: ver.map((it) => ({ label: it.titulo, pagina: 'agenda', clienteKey: null, extra: { itemId: it.id } })) };
}
async function reunion(i, ctx) {
  const { perfil, hoy } = ctx;
  if (!puedeVerPaginaGlobal(perfil, 'agenda')) return sinPermiso('la Agenda');
  const { items, reuniones } = await agendaDatos();
  const dia = (d) => isoDia(d);
  const h = dia(hoy), m = dia(new Date(hoy.getTime() + 864e5));
  let lista = reuniones.filter((r) => r.tipo !== 'viaje' && r.tipo !== 'evento' && r.estado !== 'cancelada');
  if (i.cliente) lista = lista.filter((r) => r.cliente_key === i.cliente);
  const f = (r) => String(r.fecha || '').slice(0, 10);
  let titulo;
  if (i.cuando === 'manana') { lista = lista.filter((r) => f(r) === m); titulo = 'Mañana'; }
  else if (i.cuando === 'hoy') { lista = lista.filter((r) => f(r) === h); titulo = 'Hoy'; }
  else if (i.cuando === 'semana') { const fin = dia(new Date(hoy.getTime() + 7 * 864e5)); lista = lista.filter((r) => f(r) >= h && f(r) <= fin); titulo = 'Esta semana'; }
  else { lista = lista.filter((r) => f(r) >= h).sort((a, b) => String(a.fecha).localeCompare(String(b.fecha))); titulo = 'Próxima reunión'; if (lista.length) lista = [lista[0]]; }
  lista.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
  if (!lista.length) return { titulo: `${titulo} · sin reuniones${i.cliente ? ` con ${NOMBRE[i.cliente]}` : ''}`, cifra: '0', sub: 'Nada agendado', lineas: [], abrir: ir('Abrir calendario', 'agenda', null, { vista: 'calendario' }), tambien: [] };
  const r = lista[0];
  const puntos = items.filter((it) => it.reunion_id === r.id);
  const abiertos = puntos.filter((it) => it.estado === 'abierta' || it.estado === 'arrastrada').length;
  return { titulo: `${titulo} · ${r.titulo}`, cifra: `${fmtCorta(f(r))} ${fmtHora(r.fecha)}`, sub: `${r.cliente_key ? NOMBRE[r.cliente_key] || r.cliente_key : 'Interna'}${r.lugar ? ` · ${r.lugar}` : ''} · ${puntos.length} punto${puntos.length === 1 ? '' : 's'}${abiertos ? ` (${abiertos} abierto${abiertos === 1 ? '' : 's'})` : ''}`, lineas: lista.slice(1, 4).map((x) => `${fmtCorta(f(x))} ${fmtHora(x.fecha)} · ${x.titulo}`), abrir: ir('Abrir minuta', 'agenda', null, { reunionId: r.id }), tambien: r.cliente_key ? tambienCliente(r.cliente_key, perfil).slice(0, 2) : [], directo: !!i.abrir };
}

// ── Pagos ──────────────────────────────────────────────────────────────────────
async function pagos(i, ctx) {
  const { perfil } = ctx;
  if (!puedeVerPaginaGlobal(perfil, 'pagos')) return sinPermiso('Pagos');
  let filas = await fetchAll('pagos', 'id,cliente,concepto,monto,estado,fecha_programada,solicitado_at', (qq) => qq.in('estado', ['solicitado', 'calculado']));
  if (i.cliente) filas = filas.filter((p) => p.cliente === i.cliente);
  const sol = filas.filter((p) => p.estado === 'solicitado'), cal = filas.filter((p) => p.estado === 'calculado');
  const suma = (l) => l.reduce((s, p) => s + N(p.monto), 0);
  return { titulo: `Pagos por autorizar${i.cliente ? ` · ${NOMBRE[i.cliente]}` : ''}`, cifra: String(sol.length), sub: sol.length ? `${moneyCompact(suma(sol))} solicitados` : 'Nada por autorizar', lineas: [...sol.slice(0, 4).map((p) => `${NOMBRE[p.cliente] || p.cliente} · ${p.concepto} · ${money(N(p.monto))}`), cal.length ? `${cal.length} calculado${cal.length === 1 ? '' : 's'} sin solicitar (${moneyCompact(suma(cal))})` : ''].filter(Boolean), abrir: ir('Abrir Pagos', 'pagos', null, i.cliente ? { cliente: i.cliente } : null), tambien: [] };
}

// ── Cobranza ───────────────────────────────────────────────────────────────────
async function cobranza(i, ctx) {
  const { perfil } = ctx;
  const filas = await q1(supabase.from('estados_cuenta').select('cliente,fecha_corte,saldo_actual,saldo_vencido,aging_mas90,dso').order('fecha_corte', { ascending: false }).limit(30));
  const ult = new Map();
  for (const r of filas) if (!ult.has(r.cliente) && puedeVerCliente(perfil, r.cliente)) ult.set(r.cliente, r);
  if (i.cliente) {
    if (!puedeVerCliente(perfil, i.cliente)) return sinPermiso(NOMBRE[i.cliente]);
    const r = ult.get(i.cliente);
    if (!r) return { titulo: `${NOMBRE[i.cliente]} · cobranza`, cifra: '—', sub: 'Sin estado de cuenta cargado', lineas: [], abrir: ir('Abrir Crédito y Cobranza', 'cartera', i.cliente), tambien: [] };
    return { titulo: `${NOMBRE[i.cliente]} · cartera vencida`, cifra: moneyCompact(N(r.saldo_vencido)), sub: `de ${moneyCompact(N(r.saldo_actual))} en cartera · corte ${fmtCorta(r.fecha_corte)}`, lineas: [N(r.aging_mas90) > 0 ? `${moneyCompact(N(r.aging_mas90))} con más de 90 días` : 'Nada a más de 90 días', r.dso != null ? `DSO ${int(N(r.dso))} días` : ''].filter(Boolean), abrir: ir(`Abrir Cobranza de ${NOMBRE[i.cliente]}`, 'cartera', i.cliente), tambien: tambienCliente(i.cliente, perfil).slice(0, 2) };
  }
  const lista = [...ult.values()];
  if (!lista.length) return sinPermiso('la cobranza');
  const venc = lista.reduce((s, r) => s + N(r.saldo_vencido), 0), tot = lista.reduce((s, r) => s + N(r.saldo_actual), 0);
  return { titulo: 'Cartera vencida · clientes propios', cifra: moneyCompact(venc), sub: `de ${moneyCompact(tot)} en cartera`, lineas: lista.map((r) => `${NOMBRE[r.cliente] || r.cliente} · vencido ${moneyCompact(N(r.saldo_vencido))} de ${moneyCompact(N(r.saldo_actual))}`), abrir: ir('Abrir Cobranza', puedeVerPaginaGlobal(perfil, 'cobranzaGlobal') ? 'cobranzaGlobal' : 'cartera', puedeVerPaginaGlobal(perfil, 'cobranzaGlobal') ? null : lista[0].cliente), tambien: [] };
}

// ── Margen (sensible) ──────────────────────────────────────────────────────────
async function margen(i, ctx) {
  const { perfil, hoy } = ctx;
  if (!puedeVerSensible(perfil)) return sinPermiso('márgenes y utilidad');
  const { anio, mes, etiqueta } = periodo(i, hoy);
  const ck = i.cliente;
  const filas = ck
    ? await q1(supabase.from('v_medidas_ventas_cliente_mes').select('anio,mes,fact_neta,contribucion,utilidad_comercial').eq('cliente_key', ck).eq('anio', anio))
    : await q1(supabase.from('v_erp_medidas_mes').select('anio,mes,fact_neta,contribucion,utilidad_comercial').eq('anio', anio));
  const f = filas.filter((r) => !mes || N(r.mes) === mes);
  const fn = f.reduce((s, r) => s + N(r.fact_neta), 0), c = f.reduce((s, r) => s + N(r.contribucion), 0), u = f.reduce((s, r) => s + N(r.utilidad_comercial), 0);
  return { titulo: `${ck ? NOMBRE[ck] : 'Empresa'} · margen ${etiqueta}`, cifra: fn > 0 ? pct(c / fn * 100, 1) : '—', sub: `contribución ${moneyCompact(c)} sobre ${moneyCompact(fn)} de Fact Neta`, lineas: [`Utilidad comercial ${moneyCompact(u)}${fn > 0 ? ` · MUC ${pct(u / fn * 100, 1)}` : ''}`], abrir: ir(ck ? `Abrir Sell In de ${NOMBRE[ck]}` : 'Abrir Visión General', ck ? 'sellIn' : 'visionGeneral', ck), tambien: ck ? [] : [ir('Estado de Resultados', 'estadoResultados')] };
}

// ── Inventario de la empresa ──────────────────────────────────────────────────
async function inventarioEmpresa(i, ctx) {
  const { perfil } = ctx;
  if (!(perfil?.es_super_admin || puedeVerPestanaGlobal(perfil, 'inventario_global'))) return sinPermiso('el inventario');
  const r = (await q1(supabase.from('v_medidas_inventario').select('inv_actual,inv_actual_piezas,inv_actual_disponible,dias_inv,skus_con_stock,piezas_pendientes')))[0];
  if (!r) return { titulo: 'Inventario comercial', cifra: '—', sub: 'Sin datos', lineas: [], abrir: ir('Abrir Inventario', 'inventarioGlobal'), tambien: [] };
  return { titulo: 'Inventario comercial (Inv Actual)', cifra: moneyCompact(N(r.inv_actual)), sub: `${int(N(r.inv_actual_piezas))} piezas · ${int(N(r.skus_con_stock))} SKUs con stock`, lineas: [r.dias_inv != null ? `${int(N(r.dias_inv))} días de inventario` : '', N(r.piezas_pendientes) ? `${int(N(r.piezas_pendientes))} piezas en camino` : ''].filter(Boolean), abrir: ir('Abrir Inventario', 'inventarioGlobal'), tambien: [ir('S&OP', 'forecastClientes'), ir('Proyectos y forecast', 'forecastReservas')] };
}

const MOTOR = { cuota, ventas, sellout, stock, transito: stock, pendientes, reunion, pagos, cobranza, margen, inventarioEmpresa };

/** responder(intencion, { perfil, uid, hoy }) → respuesta o null si no hay motor para esa intención. */
export async function responder(intencion, ctx) {
  if (!intencion || !DB_CONFIGURED) return null;
  const fn = MOTOR[intencion.tipo];
  if (!fn) return null;
  try { return await fn(intencion, { hoy: new Date(), ...ctx }); }
  catch (e) { return { titulo: 'No pude contestar', cifra: '—', sub: e.message, lineas: [], abrir: null, tambien: [], error: true }; }
}
