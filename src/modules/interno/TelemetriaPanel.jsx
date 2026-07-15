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

// Bono: fórmula = max($3,000, 0.07% × facturación_mes)
const BONO_BASE = 3000;
const BONO_PCT = 0.0007;
const CLIENTES_BONO = ['digitalife', 'pcel', 'dicotech'];

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
  const [usuarios, setUsuarios] = useState([]);      // perfiles con id
  const [eventos, setEventos] = useState([]);        // eventos raw del mes
  const [facturacionMes, setFacturacionMes] = useState(0); // total de los 3 clientes
  const [expanded, setExpanded] = useState(null);    // user_id expandido
  const [loading, setLoading] = useState(true);

  const { ini, fin, anio, mes } = rangoMes(mesRef);
  const diasEnMes = new Date(anio, mes, 0).getDate();

  // Fetch usuarios + eventos del mes + facturación
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      const [perf, evs, fact] = await Promise.all([
        supabase.from('perfiles').select('user_id,nombre,email,rol').order('nombre'),
        supabase.from('eventos_usuario')
          .select('id,user_id,ts,tipo,cliente,pagina,detalle')
          .gte('ts', ini.toISOString())
          .lt('ts', fin.toISOString())
          .order('ts', { ascending: false })
          .limit(20000),
        supabase.from('facturacion_clientes')
          .select('monto,cliente_key')
          .in('cliente_key', CLIENTES_BONO)
          .eq('anio', anio).eq('mes', mes),
      ]);
      if (cancelled) return;
      setUsuarios(perf.data || []);
      setEventos(evs.data || []);
      setFacturacionMes((fact.data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [ini.getTime(), fin.getTime(), anio, mes]);

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
      // Bono estimado (aplica sólo a viewer con al menos 1 día activo)
      const esViewer = u.rol === 'viewer';
      const bonoEstimado = esViewer
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

      {/* Grid de usuarios */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {usuarios.map((u) => {
          const k = kpisPorUser.get(u.user_id);
          const isExp = expanded === u.user_id;
          const colorRol = u.rol === 'super_admin' ? '#0EA5E9' : '#EC4899';
          return (
            <div key={u.user_id}
              onClick={() => setExpanded(isExp ? null : u.user_id)}
              className={`bg-white rounded-xl p-4 border cursor-pointer transition hover:shadow-md ${isExp ? 'border-gray-400 ring-2 ring-gray-200' : 'border-gray-200'}`}>
              <div className="flex items-start justify-between mb-3 gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
                    style={{ background: colorRol }}>{iniciales(u.nombre || u.email)}</div>
                  <div className="min-w-0">
                    <div className="font-bold text-[13px] text-gray-800 truncate">{u.nombre || u.email?.split('@')[0]}</div>
                    <div className="text-[10.5px] text-gray-500 truncate">{u.rol} · {u.email}</div>
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
          </div>
        );
      })()}
    </div>
  );
}
