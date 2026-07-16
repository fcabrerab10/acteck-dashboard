import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { usePerfil } from '../../lib/perfilContext';
import { Activity, ChevronDown, ChevronUp, Clock, User, TrendingUp, Layers, LogIn } from 'lucide-react';

// Enum inversos para mostrar en la UI
const CLIENTE_LABEL = { 1: 'Digitalife', 2: 'PCEL', 3: 'Dicotech', 4: 'Mercado Libre', 99: 'Global' };
const PAGINA_LABEL = {
  1: 'Home', 2: 'Análisis', 3: 'Sell In', 4: 'Sell Out', 5: 'Marketing', 6: 'Pagos', 7: 'Cartera', 8: 'Forecast',
  9: 'Sell Out global', 10: 'Inventario global', 11: 'Estrategia precios', 12: 'Tracking pedidos', 13: 'Análisis clientes',
  14: 'Uploads', 15: 'Telemetría', 16: 'Evaluaciones', 17: 'Settings',
};
const TIPO_LABEL = { 1: 'nav', 2: 'nav', 3: 'drill', 4: 'filter', 5: 'export', 6: 'upload', 7: 'action', 8: 'login', 9: 'logout', 10: 'hb' };
const TIPO_COLOR = {
  1: { bg: '#E0F2FE', fg: '#075985' }, 2: { bg: '#E0F2FE', fg: '#075985' },
  3: { bg: '#F5F3FF', fg: '#5B21B6' }, 4: { bg: '#FEF3C7', fg: '#78350F' },
  5: { bg: '#DCFCE7', fg: '#166534' }, 6: { bg: '#DCFCE7', fg: '#166534' },
  7: { bg: '#FEE2E2', fg: '#991B1B' }, 8: { bg: '#F3F4F6', fg: '#4B5563' }, 9: { bg: '#F3F4F6', fg: '#4B5563' },
};
const CLIENTE_COLOR = { 1: '#8B5CF6', 2: '#10B981', 3: '#0EA5E9', 4: '#F59E0B', 99: '#94A3B8' };

// Bono: fórmula = max($3,000, 0.04% × facturación_mes)
const BONO_BASE = 3000;
const BONO_PCT = 0.0004;
const CLIENTES_BONO = ['digitalife', 'pcel', 'dicotech'];
// Digitalife cuota anual acordada (no vive en cuotas_mensuales)
const DIGITALIFE_CUOTA_ANUAL = 25_000_000;

// Aplica evaluación mensual — hoy solo Karolina (interno, no super_admin)
const requiereEvaluacion = (u) => u.tipo === 'interno' && u.rol !== 'super_admin';

const RATINGS = [
  { key: 'rating_comunicacion',  label: 'Comunicación' },
  { key: 'rating_iniciativa',    label: 'Iniciativa' },
  { key: 'rating_calidad',       label: 'Calidad del trabajo' },
  { key: 'rating_cumplimiento',  label: 'Cumplimiento' },
  { key: 'rating_valor',         label: 'Aporte de valor' },
];

function fmtHm(mins) {
  if (!mins || mins < 1) return '0m';
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
function fmtFechaHora(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}
function fmtHace(iso) {
  if (!iso) return '—';
  const diff = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return 'hace segundos';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
  const dias = Math.floor(diff / 86400);
  return `hace ${dias}d`;
}
function iniciales(nombre) {
  if (!nombre) return '?';
  return nombre.split(' ').map((s) => s[0]).slice(0, 2).join('').toUpperCase();
}

// Rango de mes (1er día 00:00 al 1er día del siguiente mes 00:00)
function rangoMes(fecha) {
  const y = fecha.getFullYear(); const m = fecha.getMonth();
  const ini = new Date(y, m, 1);
  const fin = new Date(y, m + 1, 1);
  return { ini, fin, anio: y, mes: m + 1 };
}

export default function TelemetriaPanel() {
  const { perfil } = usePerfil();
  const esAdmin = perfil?.rol === 'super_admin';

  const [mesRef, setMesRef] = useState(() => new Date());
  const [usuarios, setUsuarios] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [facturacionMes, setFacturacionMes] = useState(0);
  const [cuotaMes, setCuotaMes] = useState(0);       // cuota total 3 clientes
  const [evaluaciones, setEvaluaciones] = useState([]); // evaluaciones del mes por user_id
  const [expanded, setExpanded] = useState(null);
  const [loading, setLoading] = useState(true);

  const { ini, fin, anio, mes } = rangoMes(mesRef);
  const diasEnMes = new Date(anio, mes, 0).getDate();

  const reload = React.useCallback(async () => {
    setLoading(true);
    const [perf, evs, fact, cuotas, evalMes] = await Promise.all([
      supabase.from('perfiles').select('user_id,nombre,email,rol,tipo,puesto').order('nombre'),
      supabase.from('eventos_usuario')
        .select('id,user_id,ts,tipo,cliente,pagina,detalle')
        .gte('ts', ini.toISOString()).lt('ts', fin.toISOString())
        .order('ts', { ascending: false }).limit(20000),
      supabase.from('facturacion_clientes')
        .select('monto,cliente_key')
        .in('cliente_key', CLIENTES_BONO)
        .eq('anio', anio).eq('mes', mes),
      supabase.from('cuotas_mensuales')
        .select('cliente,cuota_min')
        .in('cliente', ['pcel', 'dicotech'])
        .eq('anio', anio).eq('mes', mes),
      supabase.from('evaluaciones_mensuales')
        .select('*')
        .eq('anio', anio).eq('mes', mes),
    ]);
    setUsuarios(perf.data || []);
    setEventos(evs.data || []);
    const fT = (fact.data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0);
    setFacturacionMes(fT);
    // Cuota = PCEL + Dicotech (de cuotas_mensuales) + Digitalife (25M/12)
    const cPD = (cuotas.data || []).reduce((s, r) => s + (Number(r.cuota_min) || 0), 0);
    setCuotaMes(cPD + DIGITALIFE_CUOTA_ANUAL / 12);
    setEvaluaciones(evalMes.data || []);
    setLoading(false);
  }, [ini, fin, anio, mes]);

  useEffect(() => {
    let cancelled = false;
    (async () => { if (!cancelled) await reload(); })();
    return () => { cancelled = true; };
  }, [reload]);

  // evaluación del user_id del mes activo
  const evalPorUser = useMemo(() => {
    const m = new Map();
    for (const e of evaluaciones) m.set(e.user_id, e);
    return m;
  }, [evaluaciones]);

  // Índice: user_id → eventos del mes
  const eventosPorUser = useMemo(() => {
    const m = new Map();
    for (const e of eventos) {
      if (!m.has(e.user_id)) m.set(e.user_id, []);
      m.get(e.user_id).push(e);
    }
    return m;
  }, [eventos]);

  // KPIs por usuario
  const kpisPorUser = useMemo(() => {
    const m = new Map();
    for (const u of usuarios) {
      const evs = eventosPorUser.get(u.user_id) || [];
      const heartbeats = evs.filter((e) => e.tipo === 10).length;
      const acciones = evs.length - heartbeats;
      const dias = new Set(evs.map((e) => new Date(e.ts).toISOString().slice(0, 10)));
      const ultimo = evs[0]?.ts || null;
      // Distribución por cliente (heartbeats por cliente)
      const cliCount = {};
      for (const e of evs) if (e.tipo === 10 && e.cliente) cliCount[e.cliente] = (cliCount[e.cliente] || 0) + 1;
      let clienteTop = null; let maxCli = 0;
      for (const k of Object.keys(cliCount)) if (cliCount[k] > maxCli) { maxCli = cliCount[k]; clienteTop = Number(k); }
      const totalCli = Object.values(cliCount).reduce((s, v) => s + v, 0);
      const pctTop = totalCli > 0 ? (maxCli / totalCli * 100) : 0;
      // Bono estimado — sólo internos NO super_admin (Karolina)
      const aplicaBono = u.tipo === 'interno' && u.rol !== 'super_admin';
      const bonoEstimado = aplicaBono
        ? (dias.size > 0 ? Math.max(BONO_BASE, facturacionMes * BONO_PCT) : BONO_BASE)
        : null;
      m.set(u.user_id, {
        diasActivos: dias.size,
        minutos: heartbeats, // 1 heartbeat = 1 minuto
        acciones,
        ultimo,
        clienteTop, pctTop,
        cliCount, totalCli,
        bonoEstimado,
      });
    }
    return m;
  }, [usuarios, eventosPorUser, facturacionMes]);

  const bonoTeoricoMax = Math.max(BONO_BASE, facturacionMes * BONO_PCT);

  if (loading) return <div className="p-12 text-center text-sm text-gray-500">Cargando telemetría…</div>;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6" /> Telemetría de usuarios
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Actividad automática · {esAdmin ? 'Todos los usuarios' : 'Tu propia actividad'} · Bono = <strong>max($3,000, 0.07% × facturación mes)</strong>
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setMesRef(new Date(anio, mes - 2, 15))} className="w-7 h-7 bg-gray-100 rounded-md hover:bg-gray-200 text-gray-600">‹</button>
          <div className="text-sm font-semibold min-w-[140px] text-center">
            {mesRef.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </div>
          <button onClick={() => setMesRef(new Date(anio, mes, 15))} className="w-7 h-7 bg-gray-100 rounded-md hover:bg-gray-200 text-gray-600">›</button>
        </div>
      </div>

      {/* Facturación del mes + bono teórico max */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 flex justify-between items-center flex-wrap gap-3">
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Facturación del mes · Digitalife + PCEL + Dicotech</div>
          <div className="text-[22px] font-bold tabular-nums">{formatMXN(facturacionMes)}</div>
        </div>
        <div>
          <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500">Bono teórico (si viewer activo)</div>
          <div className="text-[22px] font-bold tabular-nums text-emerald-700">{formatMXN(bonoTeoricoMax)}</div>
          <div className="text-[10.5px] text-gray-500">
            = max($3,000, 0.07% × facturación)
            {facturacionMes < BONO_BASE / BONO_PCT && <span className="ml-1 text-amber-600">· piso $3,000 aplica</span>}
          </div>
        </div>
      </div>

      {/* Grid de usuarios — separado por tipo interno/externo */}
      {(() => {
        const internos = usuarios.filter((u) => u.tipo === 'interno');
        const externos = usuarios.filter((u) => u.tipo === 'externo');
        return (
          <>
            {internos.length > 0 && (
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-sky-500"></span>
                    Acteck · Equipo interno
                  </h3>
                  <span className="text-[11px] text-gray-500">{internos.length} usuarios · con bono aplicable a admin/viewer</span>
                </div>
                <SeccionUsuarios usuarios={internos} kpisPorUser={kpisPorUser} diasEnMes={diasEnMes} facturacionMes={facturacionMes} expanded={expanded} setExpanded={setExpanded} />
              </div>
            )}
            {externos.length > 0 && (
              <div className="mt-4">
                <div className="flex items-baseline justify-between mb-2">
                  <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                    <span className="inline-block w-2 h-2 rounded-full bg-amber-500"></span>
                    Externos · clientes y aliados
                  </h3>
                  <span className="text-[11px] text-gray-500">{externos.length} usuarios · sin bono, solo monitoreo</span>
                </div>
                <SeccionUsuarios usuarios={externos} kpisPorUser={kpisPorUser} diasEnMes={diasEnMes} facturacionMes={facturacionMes} expanded={expanded} setExpanded={setExpanded} />
              </div>
            )}
          </>
        );
      })()}


      {/* Detalle del usuario expandido */}
      {expanded && (() => {
        const u = usuarios.find((x) => x.user_id === expanded);
        const evs = eventosPorUser.get(expanded) || [];
        const k = kpisPorUser.get(expanded);
        if (!u) return null;

        // Timeline diaria (heartbeats por día)
        const porDia = new Map();
        for (const e of evs) {
          if (e.tipo !== 10) continue;
          const d = new Date(e.ts).toISOString().slice(0, 10);
          porDia.set(d, (porDia.get(d) || 0) + 1);
        }
        const maxDia = Math.max(1, ...Array.from(porDia.values()));

        // Distribución por página
        const pagCount = {};
        for (const e of evs) if (e.tipo === 10 && e.pagina) pagCount[e.pagina] = (pagCount[e.pagina] || 0) + 1;
        const totalPag = Object.values(pagCount).reduce((s, v) => s + v, 0);
        const pagOrden = Object.entries(pagCount).sort((a, b) => b[1] - a[1]).slice(0, 6);

        // Distribución cliente ordenada
        const cliOrden = Object.entries(k?.cliCount || {}).sort((a, b) => b[1] - a[1]);

        // Feed últimos 50 no-heartbeat
        const feed = evs.filter((e) => e.tipo !== 10).slice(0, 50);

        return (
          <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-800">
                Detalle · {u.nombre || u.email} · {mesRef.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
              </h3>
              <button onClick={() => setExpanded(null)} className="text-[11px] text-gray-500 hover:underline">Cerrar</button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Timeline días */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Timeline diaria · intensidad</div>
                <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${diasEnMes}, 1fr)` }}>
                  {Array.from({ length: diasEnMes }, (_, i) => {
                    const d = new Date(anio, mes - 1, i + 1).toISOString().slice(0, 10);
                    const cnt = porDia.get(d) || 0;
                    const intensidad = cnt / maxDia;
                    const bg = cnt === 0 ? '#F1F5F9'
                      : intensidad < 0.2 ? '#A7F3D0'
                      : intensidad < 0.4 ? '#6EE7B7'
                      : intensidad < 0.6 ? '#34D399'
                      : intensidad < 0.8 ? '#10B981' : '#059669';
                    return <div key={i} title={`${d}: ${cnt} min`} style={{ aspectRatio: '1', background: bg, borderRadius: 2 }} />;
                  })}
                </div>
                <div className="flex justify-between items-center text-[9px] text-gray-500 mt-2">
                  <span>Día 1</span>
                  <span>{k?.minutos || 0} min totales</span>
                  <span>Día {diasEnMes}</span>
                </div>
              </div>

              {/* Distribución cliente */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Atención por cliente</div>
                {cliOrden.length === 0 && <div className="text-[11px] text-gray-400">Sin datos</div>}
                {cliOrden.map(([cli, cnt]) => {
                  const pct = k.totalCli > 0 ? (cnt / k.totalCli * 100) : 0;
                  return (
                    <div key={cli} className="mb-1.5">
                      <div className="flex justify-between items-baseline text-[11.5px]">
                        <span className="font-semibold text-gray-700">{CLIENTE_LABEL[cli] || cli}</span>
                        <span className="tabular-nums text-gray-500">{pct.toFixed(0)}% · {cnt}m</span>
                      </div>
                      <div className="h-[6px] bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${pct}%`, background: CLIENTE_COLOR[cli] || '#94A3B8' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Distribución página */}
              <div className="bg-gray-50 rounded-lg p-3">
                <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Pestañas más visitadas</div>
                {pagOrden.length === 0 && <div className="text-[11px] text-gray-400">Sin datos</div>}
                {pagOrden.map(([pag, cnt]) => {
                  const pct = totalPag > 0 ? (cnt / totalPag * 100) : 0;
                  return (
                    <div key={pag} className="mb-1.5">
                      <div className="flex justify-between items-baseline text-[11.5px]">
                        <span className="font-semibold text-gray-700">{PAGINA_LABEL[pag] || `Pag ${pag}`}</span>
                        <span className="tabular-nums text-gray-500">{pct.toFixed(0)}% · {cnt}m</span>
                      </div>
                      <div className="h-[6px] bg-gray-200 rounded-full mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-indigo-500" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Feed de eventos */}
            <div className="mt-4">
              <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2">Últimas acciones ({feed.length})</div>
              <div className="max-h-[300px] overflow-y-auto flex flex-col gap-1 border border-gray-100 rounded-md p-2 bg-gray-50">
                {feed.length === 0 && <div className="text-[11px] text-gray-400 text-center py-4">Sin acciones registradas este mes</div>}
                {feed.map((e) => {
                  const c = TIPO_COLOR[e.tipo] || TIPO_COLOR[8];
                  return (
                    <div key={e.id} className="grid grid-cols-[90px_1fr_auto] gap-2 items-center bg-white border border-gray-100 rounded p-1.5 text-[11px]">
                      <span className="text-gray-500 tabular-nums text-[10px]">{fmtFechaHora(e.ts)}</span>
                      <span className="text-gray-800 truncate">
                        {PAGINA_LABEL[e.pagina] || '—'}
                        {e.cliente ? ` · ${CLIENTE_LABEL[e.cliente]}` : ''}
                        {e.detalle ? ` · ${e.detalle}` : ''}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
                        style={{ background: c.bg, color: c.fg }}>{TIPO_LABEL[e.tipo]}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bloque de EVALUACIÓN MENSUAL — sólo para usuarios internos con evaluación */}
            {requiereEvaluacion(u) && esAdmin && (
              <EvaluacionBloque
                user={u} anio={anio} mes={mes}
                facturacionMes={facturacionMes} cuotaMes={cuotaMes}
                evaluacion={evalPorUser.get(u.user_id) || null}
                onSaved={reload}
                perfilId={perfil?.user_id}
              />
            )}
          </div>
        );
      })()}
    </div>
  );
}

// ────────── SeccionUsuarios ──────────
// Grid de cards de usuarios (interno o externo). Cada card es click-to-expand.
function SeccionUsuarios({ usuarios, kpisPorUser, diasEnMes, facturacionMes, expanded, setExpanded }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {usuarios.map((u) => {
        const k = kpisPorUser.get(u.user_id);
        const isExp = expanded === u.user_id;
        const colorRol = u.rol === 'super_admin' ? '#0EA5E9'
                       : u.tipo === 'externo' ? '#F59E0B'
                       : '#EC4899';
        const tipoBadge = u.tipo === 'externo'
          ? { bg: '#FEF3C7', fg: '#78350F', label: 'externo' }
          : { bg: '#E0F2FE', fg: '#075985', label: 'interno' };
        return (
          <div key={u.user_id}
            onClick={() => setExpanded(isExp ? null : u.user_id)}
            className={`bg-white rounded-xl p-4 border cursor-pointer transition hover:shadow-md ${isExp ? 'border-gray-400 ring-2 ring-gray-200' : 'border-gray-200'}`}>
            <div className="flex items-start justify-between mb-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                  style={{ background: colorRol }}>{iniciales(u.nombre || u.email)}</div>
                <div className="min-w-0">
                  <div className="font-bold text-[13px] text-gray-800 truncate flex items-center gap-1.5">
                    {u.nombre || u.email?.split('@')[0]}
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider"
                      style={{ background: tipoBadge.bg, color: tipoBadge.fg }}>{tipoBadge.label}</span>
                  </div>
                  <div className="text-[10.5px] text-gray-500 truncate">
                    {u.puesto ? `${u.puesto} · ` : ''}{u.rol}
                  </div>
                  <div className="text-[10px] text-gray-400 truncate">{u.email}</div>
                </div>
              </div>
              <div className="text-gray-400">{isExp ? <ChevronUp className="w-4 h-4"/> : <ChevronDown className="w-4 h-4"/>}</div>
            </div>
            <div className="grid grid-cols-2 gap-2 text-[11.5px]">
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Días activos</div>
                <div className="text-[15px] font-bold tabular-nums">{k?.diasActivos || 0}/{diasEnMes}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Tiempo activo</div>
                <div className="text-[15px] font-bold tabular-nums">{fmtHm(k?.minutos || 0)}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Última sesión</div>
                <div className="text-[12px] font-semibold tabular-nums">{fmtHace(k?.ultimo)}</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-bold">Cliente top</div>
                <div className="text-[12px] font-semibold tabular-nums">
                  {k?.clienteTop ? `${CLIENTE_LABEL[k.clienteTop]} · ${k.pctTop.toFixed(0)}%` : '—'}
                </div>
              </div>
              {k?.bonoEstimado != null && (
                <div className="col-span-2 bg-emerald-50 rounded-md p-2 border border-emerald-100">
                  <div className="text-[9px] uppercase tracking-widest text-emerald-700 font-bold">Bono estimado del mes</div>
                  <div className="text-[15px] font-bold tabular-nums text-emerald-800">{formatMXN(k.bonoEstimado)}</div>
                  <div className="text-[9.5px] text-emerald-700">
                    {k.diasActivos === 0 ? 'Sin actividad · piso $3,000' : (k.bonoEstimado === BONO_BASE ? 'Piso $3,000 aplica' : `${(BONO_PCT * 100).toFixed(2)}% × ${formatMXN(facturacionMes)}`)}
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// EvaluacionBloque — sección de evaluación mensual del usuario
// Sub-secciones: Cuota, Ratings, Comentarios, Tareas, Ajustes, Bono
// Botones: Copiar texto resumen, Cerrar evaluación (inmutable)
// ═══════════════════════════════════════════════════════════════
function EvaluacionBloque({ user, anio, mes, facturacionMes, cuotaMes, evaluacion, onSaved, perfilId }) {
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmCerrar, setConfirmCerrar] = useState(false);

  const isCerrada = evaluacion?.cerrada === true;
  const cuotaPct = cuotaMes > 0 ? (facturacionMes / cuotaMes * 100) : 0;
  const bonoBase = Math.max(BONO_BASE, facturacionMes * BONO_PCT);
  const ajustesTotal = (evaluacion?.ajustes || []).reduce((s, a) => s + (Number(a.monto) || 0), 0);
  const bonoTotal = bonoBase + ajustesTotal;

  // Handler genérico para actualizar campo
  const updateField = async (patch) => {
    if (isCerrada) return;
    setSaving(true);
    if (evaluacion?.id) {
      await supabase.from('evaluaciones_mensuales').update(patch).eq('id', evaluacion.id);
    } else {
      await supabase.from('evaluaciones_mensuales').insert({
        user_id: user.user_id, anio, mes,
        facturacion: facturacionMes, cuota_total: cuotaMes, cuota_pct: cuotaPct,
        bono_base: bonoBase, bono_ajustes: 0, bono_total: bonoBase,
        ...patch,
      });
    }
    setSaving(false);
    if (onSaved) await onSaved();
  };

  const cerrarEvaluacion = async () => {
    if (isCerrada) return;
    setSaving(true);
    const patch = {
      facturacion: facturacionMes, cuota_total: cuotaMes, cuota_pct: cuotaPct,
      bono_base: bonoBase, bono_ajustes: ajustesTotal, bono_total: bonoTotal,
      cerrada: true, cerrada_ts: new Date().toISOString(), cerrada_por: perfilId,
    };
    if (evaluacion?.id) await supabase.from('evaluaciones_mensuales').update(patch).eq('id', evaluacion.id);
    else await supabase.from('evaluaciones_mensuales').insert({ user_id: user.user_id, anio, mes, ...patch });
    setSaving(false);
    setConfirmCerrar(false);
    if (onSaved) await onSaved();
  };

  const copiarTexto = () => {
    const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const ratings = RATINGS.map((r) => ({ label: r.label, val: evaluacion?.[r.key] || null }));
    const promRat = ratings.filter((r) => r.val).reduce((s, r) => s + r.val, 0) / Math.max(1, ratings.filter((r) => r.val).length);
    const tareas = evaluacion?.tareas || [];
    const cumplidas = tareas.filter((t) => t.cumplida).length;
    const ajustes = evaluacion?.ajustes || [];

    const sep = '═══════════════════════════════════════════════════════════';
    let txt = `Bono ${user.nombre} · ${MESES[mes-1]} ${anio} · ${fmtMoney(bonoTotal)} MXN\n\n`;
    txt += sep + '\nCUOTA ALCANZADA\n';
    txt += `Facturado: ${fmtMoney(facturacionMes)} | Cuota: ${fmtMoney(cuotaMes)}\n`;
    txt += `Alcance: ${cuotaPct.toFixed(1)}%${cuotaPct >= 100 ? ' (superó la cuota)' : ''}\n\n`;

    txt += sep + '\nEVALUACIÓN CUALITATIVA\n';
    for (const r of ratings) txt += `· ${r.label.padEnd(22, ' ')}: ${r.val ? `${r.val}/5` : '—'}\n`;
    if (promRat > 0) txt += `Promedio: ${promRat.toFixed(1)}/5\n`;
    if (evaluacion?.comentarios) txt += `\nFeedback:\n${evaluacion.comentarios}\n`;

    if (tareas.length > 0) {
      txt += '\n' + sep + `\nTAREAS DEL MES (${cumplidas} de ${tareas.length})\n`;
      for (const t of tareas) {
        txt += `${t.cumplida ? '✓' : '✗'} ${t.texto}\n`;
        if (t.nota) txt += `    → ${t.nota}\n`;
      }
    }

    if (ajustes.length > 0) {
      txt += '\n' + sep + `\nAJUSTES AL BONO (total: ${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)})\n`;
      for (const a of ajustes) {
        const signo = Number(a.monto) >= 0 ? '+' : '−';
        const monto = fmtMoney(Math.abs(Number(a.monto)));
        txt += `${a.fecha || ''}  ${signo}${monto}  ${a.descripcion || ''}\n`;
      }
    }

    txt += '\n' + sep + '\nCÁLCULO DEL BONO\n';
    const pctStr = (BONO_PCT * 100).toFixed(2);
    txt += `Base       = max(${fmtMoney(BONO_BASE)}, ${pctStr}% × ${fmtMoney(facturacionMes)}) = ${fmtMoney(bonoBase)}\n`;
    if (ajustesTotal !== 0) txt += `Ajustes    = ${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)}\n`;
    txt += `─────────────────────\nTotal a pagar: ${fmtMoney(bonoTotal)} MXN\n\n`;
    if (isCerrada) txt += `Evaluación cerrada el ${new Date(evaluacion.cerrada_ts).toLocaleDateString('es-MX')} · inmutable\n`;
    else txt += `(evaluación aún abierta — puede cambiar)\n`;

    navigator.clipboard.writeText(txt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <div className="flex justify-between items-baseline mb-3">
        <div>
          <div className="text-[13px] font-bold text-gray-800">
            Evaluación mensual · {['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'][mes-1]} {anio}
          </div>
          <div className="text-[11px] text-gray-500">
            {isCerrada
              ? <span className="text-emerald-700 font-semibold">✓ Cerrada · inmutable · pagada</span>
              : <span className="text-amber-700 font-semibold">Pendiente de cerrar</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={copiarTexto}
            className="text-[11px] px-3 py-1.5 bg-white border border-gray-300 rounded-md hover:bg-gray-50 font-semibold">
            {copied ? '✓ Copiado' : '📄 Copiar resumen'}
          </button>
          {!isCerrada && !confirmCerrar && (
            <button onClick={() => setConfirmCerrar(true)}
              className="text-[11px] px-3 py-1.5 bg-emerald-600 text-white rounded-md hover:bg-emerald-700 font-semibold">
              ✓ Cerrar y pagar
            </button>
          )}
          {confirmCerrar && (
            <>
              <button onClick={() => setConfirmCerrar(false)} className="text-[11px] px-3 py-1.5 bg-gray-100 rounded-md">Cancelar</button>
              <button onClick={cerrarEvaluacion} disabled={saving}
                className="text-[11px] px-3 py-1.5 bg-emerald-600 text-white rounded-md font-semibold">
                Confirmar (irreversible)
              </button>
            </>
          )}
        </div>
      </div>

      {/* Nota para junio 2026 (mes de arranque) */}
      {anio === 2026 && mes === 6 && (
        <div className="mb-3 p-2.5 bg-amber-50 border-l-3 border-amber-400 rounded text-[11px] text-amber-900">
          <strong>Nota:</strong> La telemetría se activó en julio 2026. Para junio se asume actividad al 100%. Desde julio en adelante cuenta la telemetría real.
        </div>
      )}

      {/* 1. Cuota alcanzada */}
      <SubBloque titulo="📊 Cuota alcanzada del mes">
        <div className="grid grid-cols-[1fr_auto] gap-3 items-center">
          <div>
            <div className="h-3 bg-gray-200 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600"
                style={{ width: `${Math.min(100, cuotaPct)}%` }} />
            </div>
            <div className="flex justify-between text-[10px] mt-1 text-gray-500">
              <span>Facturado <strong className="text-gray-800">{fmtMoney(facturacionMes)}</strong></span>
              <span>Cuota <strong className="text-gray-800">{fmtMoney(cuotaMes)}</strong></span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[22px] font-bold text-emerald-600 tabular-nums">{cuotaPct.toFixed(1)}%</div>
            <div className="text-[10px] text-gray-500">de la cuota</div>
          </div>
        </div>
      </SubBloque>

      {/* 2. Ratings */}
      <SubBloque titulo="⭐ Rating por categoría">
        {RATINGS.map((r) => (
          <div key={r.key} className="grid grid-cols-[140px_1fr_35px] gap-2 items-center py-1 border-b border-dashed border-gray-100 last:border-b-0">
            <div className="text-[11.5px] font-semibold text-gray-700">{r.label}</div>
            <div className="flex gap-1">
              {[1,2,3,4,5].map((n) => (
                <button key={n} disabled={isCerrada}
                  onClick={() => updateField({ [r.key]: n })}
                  className={`text-[16px] leading-none ${isCerrada ? 'cursor-default' : 'cursor-pointer hover:scale-110'} transition`}
                  style={{ color: (evaluacion?.[r.key] || 0) >= n ? '#F59E0B' : '#E5E7EB' }}>★</button>
              ))}
            </div>
            <div className="text-[11px] text-gray-500 tabular-nums">{evaluacion?.[r.key] ? `${evaluacion[r.key]}/5` : '—'}</div>
          </div>
        ))}
      </SubBloque>

      {/* 3. Comentarios */}
      <SubBloque titulo="💬 Comentarios / feedback">
        <textarea disabled={isCerrada} defaultValue={evaluacion?.comentarios || ''}
          onBlur={(e) => e.target.value !== (evaluacion?.comentarios || '') && updateField({ comentarios: e.target.value })}
          placeholder="Escribe el feedback narrativo del mes..."
          className="w-full min-h-[80px] p-2.5 text-[12px] border border-gray-200 rounded-md bg-white resize-y focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:bg-gray-50" />
      </SubBloque>

      {/* 4. Tareas */}
      <SubBloque titulo={`✓ Tareas del mes${evaluacion?.tareas?.length ? ` (${(evaluacion.tareas || []).filter((t) => t.cumplida).length} de ${evaluacion.tareas.length})` : ''}`}>
        <TareasLista tareas={evaluacion?.tareas || []} onChange={(nuevas) => updateField({ tareas: nuevas })} disabled={isCerrada} />
      </SubBloque>

      {/* 5. Ajustes al bono */}
      <SubBloque titulo={`💵 Ajustes al bono${ajustesTotal !== 0 ? ` (${ajustesTotal >= 0 ? '+' : ''}${fmtMoney(ajustesTotal)})` : ''}`}>
        <AjustesLista ajustes={evaluacion?.ajustes || []} onChange={(nuevos) => updateField({ ajustes: nuevos })} disabled={isCerrada} />
      </SubBloque>

      {/* 6. Bono final */}
      <div className="mt-3 rounded-lg p-4 border-2 border-emerald-500 bg-gradient-to-br from-emerald-50 to-green-50 grid grid-cols-[1fr_auto] gap-4 items-center">
        <div>
          <div className="text-[10.5px] uppercase tracking-widest font-bold text-emerald-800">Bono a pagar</div>
          <div className="text-[28px] font-bold text-emerald-900 tabular-nums">{fmtMoney(bonoTotal)}</div>
        </div>
        <div className="text-right text-[10.5px]">
          <div className="text-emerald-700 font-bold">Base</div>
          <div className="text-emerald-900 tabular-nums">
            max({fmtMoney(BONO_BASE)}, {(BONO_PCT * 100).toFixed(2)}% × {fmtMoney(facturacionMes)}) = {fmtMoney(bonoBase)}
          </div>
          {ajustesTotal !== 0 && (
            <>
              <div className="text-emerald-700 font-bold mt-1">+ Ajustes</div>
              <div className="text-emerald-900 tabular-nums">{ajustesTotal >= 0 ? '+' : ''}{fmtMoney(ajustesTotal)}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SubBloque({ titulo, children }) {
  return (
    <div className="bg-gray-50 border border-gray-100 rounded-lg p-3 mb-2">
      <div className="text-[10.5px] uppercase tracking-widest font-bold text-gray-500 mb-2">{titulo}</div>
      {children}
    </div>
  );
}

function TareasLista({ tareas, onChange, disabled }) {
  const [nuevaTexto, setNuevaTexto] = useState('');
  const add = () => {
    const t = nuevaTexto.trim();
    if (!t) return;
    onChange([...tareas, { id: Date.now(), texto: t, cumplida: false, nota: '' }]);
    setNuevaTexto('');
  };
  const toggle = (i) => onChange(tareas.map((t, k) => k === i ? { ...t, cumplida: !t.cumplida } : t));
  const remove = (i) => onChange(tareas.filter((_, k) => k !== i));
  const setNota = (i, nota) => onChange(tareas.map((t, k) => k === i ? { ...t, nota } : t));
  return (
    <div>
      {tareas.length === 0 && <div className="text-[11px] text-gray-400 italic py-1">Sin tareas aún — agrega la primera abajo</div>}
      {tareas.map((t, i) => (
        <div key={t.id || i} className="grid grid-cols-[22px_1fr_auto] gap-2 items-start py-1.5 border-b border-dashed border-gray-100 last:border-b-0">
          <button disabled={disabled} onClick={() => toggle(i)}
            className={`w-4 h-4 rounded border-2 mt-0.5 ${t.cumplida ? 'bg-emerald-500 border-emerald-500 text-white text-[10px] leading-none flex items-center justify-center' : 'border-gray-300'}`}>
            {t.cumplida ? '✓' : ''}
          </button>
          <div>
            <div className={`text-[12px] ${t.cumplida ? 'line-through text-gray-500' : 'text-gray-800'}`}>{t.texto}</div>
            {!disabled && (
              <input type="text" defaultValue={t.nota || ''}
                onBlur={(e) => e.target.value !== (t.nota || '') && setNota(i, e.target.value)}
                placeholder="+ nota"
                className="text-[10.5px] text-gray-600 bg-transparent border-none outline-none placeholder-gray-400 w-full mt-0.5" />
            )}
            {disabled && t.nota && <div className="text-[10.5px] text-gray-500 italic mt-0.5">→ {t.nota}</div>}
          </div>
          {!disabled && (
            <button onClick={() => remove(i)} className="text-gray-400 hover:text-rose-600 text-[13px]">×</button>
          )}
        </div>
      ))}
      {!disabled && (
        <div className="mt-2 flex gap-2">
          <input type="text" value={nuevaTexto} onChange={(e) => setNuevaTexto(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Nueva tarea..." className="flex-1 text-[11.5px] px-2 py-1 border border-gray-200 rounded-md" />
          <button onClick={add} className="text-[11px] px-3 py-1 bg-emerald-600 text-white rounded-md font-semibold">+ Agregar</button>
        </div>
      )}
    </div>
  );
}

function AjustesLista({ ajustes, onChange, disabled }) {
  const [nueva, setNueva] = useState({ fecha: new Date().toISOString().slice(0, 10), descripcion: '', monto: '' });
  const add = () => {
    const monto = Number(nueva.monto);
    if (!nueva.descripcion.trim() || !isFinite(monto) || monto === 0) return;
    onChange([...ajustes, { id: Date.now(), fecha: nueva.fecha, descripcion: nueva.descripcion.trim(), monto }]);
    setNueva({ fecha: nueva.fecha, descripcion: '', monto: '' });
  };
  const remove = (i) => onChange(ajustes.filter((_, k) => k !== i));
  return (
    <div>
      {ajustes.length === 0 && <div className="text-[11px] text-gray-400 italic py-1">Sin ajustes aún</div>}
      {ajustes.map((a, i) => (
        <div key={a.id || i} className="grid grid-cols-[70px_1fr_auto_auto] gap-2 items-baseline py-1.5 border-b border-dashed border-gray-100 last:border-b-0 text-[11.5px]">
          <div className="text-[10px] text-gray-500 tabular-nums">{a.fecha}</div>
          <div className="text-gray-800">{a.descripcion}</div>
          <div className={`font-bold tabular-nums ${Number(a.monto) >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {Number(a.monto) >= 0 ? '+' : '−'}{fmtMoney(Math.abs(Number(a.monto)))}
          </div>
          {!disabled && <button onClick={() => remove(i)} className="text-gray-400 hover:text-rose-600">×</button>}
        </div>
      ))}
      {!disabled && (
        <div className="mt-2 grid grid-cols-[110px_1fr_100px_auto] gap-2">
          <input type="date" value={nueva.fecha} onChange={(e) => setNueva({ ...nueva, fecha: e.target.value })}
            className="text-[11px] px-2 py-1 border border-gray-200 rounded-md" />
          <input type="text" value={nueva.descripcion} onChange={(e) => setNueva({ ...nueva, descripcion: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Descripción del ajuste..." className="text-[11.5px] px-2 py-1 border border-gray-200 rounded-md" />
          <input type="number" value={nueva.monto} onChange={(e) => setNueva({ ...nueva, monto: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="±$" step="50" className="text-[11.5px] px-2 py-1 border border-gray-200 rounded-md tabular-nums" />
          <button onClick={add} className="text-[11px] px-3 py-1 bg-emerald-600 text-white rounded-md font-semibold">+</button>
        </div>
      )}
    </div>
  );
}

function fmtMoney(n) {
  if (n == null || !isFinite(n)) return '$—';
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
}
