import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import {
  Target, Plus, Search, X, ChevronRight, Trash2, Edit2, ChevronDown, Check, Truck, Package,
} from 'lucide-react';

const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife' },
  { key: 'pcel',       nombre: 'PCEL' },
  { key: 'dicotech',   nombre: 'Dicotech' },
];
const NOMBRE_CLIENTE = Object.fromEntries(CLIENTES.map((c) => [c.key, c.nombre]));

const ETAPAS = ['recibida', 'procesada', 'surtida', 'entregada'];
const ETAPA_LABEL = { recibida: 'Recibida', procesada: 'Procesada', surtida: 'Surtida', entregada: 'Entregada' };
const ETAPA_CAMPO = {
  recibida: 'fecha_recibida', procesada: 'fecha_procesada',
  surtida: 'fecha_surtida', entregada: 'fecha_entregada',
};
const ETAPA_TONE = {
  recibida:  { bg: '#F1F5F9', text: '#334155' },
  procesada: { bg: '#EEF2FF', text: '#3730A3' },
  surtida:   { bg: '#FEF3C7', text: '#92400E' },
  entregada: { bg: '#D1FAE5', text: '#065F46' },
};

const PAQUETERIAS = ['DHL', 'Estafeta', 'Fedex', 'Redpack', 'Paquetexpress', 'Otra'];
const UMBRAL_DIAS_ALERTA = 3;

const fmtDate = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  } catch { return '—'; }
};
const fmtDateFull = (iso) => {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return '—'; }
};
const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const dias = (from, to) => {
  if (!from || !to) return null;
  const ms = new Date(to).getTime() - new Date(from).getTime();
  return ms / (1000 * 60 * 60 * 24);
};
const nowIso = () => new Date().toISOString();
const todayLocalIso = () => new Date().toISOString().slice(0, 16);

function etapaActualDe(oc) {
  if (oc.fecha_entregada) return 'entregada';
  if (oc.fecha_surtida)   return 'surtida';
  if (oc.fecha_procesada) return 'procesada';
  if (oc.fecha_recibida)  return 'recibida';
  return null;
}
function ultimaFechaOc(oc) {
  return oc.fecha_entregada || oc.fecha_surtida || oc.fecha_procesada || oc.fecha_recibida;
}
function diasEnEtapaActual(oc, refIso = nowIso()) {
  const f = ultimaFechaOc(oc);
  if (!f) return null;
  return dias(f, refIso);
}
function siguienteEtapa(oc) {
  if (!oc.fecha_recibida) return 'recibida';
  if (!oc.fecha_procesada) return 'procesada';
  if (!oc.fecha_surtida) return 'surtida';
  if (!oc.fecha_entregada) return 'entregada';
  return null;
}

export default function TrackingPedidos() {
  const [loading, setLoading] = useState(true);
  const [ocs, setOcs] = useState([]);
  const [skusPorOc, setSkusPorOc] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('TODOS');
  const [estatusFiltro, setEstatusFiltro] = useState('abiertas');
  const [ocAbierta, setOcAbierta] = useState(null);
  const [showNuevaOC, setShowNuevaOC] = useState(false);
  const [editOc, setEditOc] = useState(null);

  const cargar = async () => {
    setLoading(true);
    const { data: ocsData } = await supabase
      .from('oc_clientes').select('*').order('created_at', { ascending: false });
    const { data: skusData } = await supabase
      .from('oc_clientes_skus').select('*');
    const skusMap = {};
    for (const s of (skusData || [])) {
      if (!skusMap[s.oc_id]) skusMap[s.oc_id] = [];
      skusMap[s.oc_id].push(s);
    }
    setOcs(ocsData || []);
    setSkusPorOc(skusMap);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const enriquecidas = useMemo(() => ocs.map((oc) => {
    const skus = skusPorOc[oc.id] || [];
    const piezasOrd = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
    const piezasSur = skus.reduce((s, x) => s + (Number(x.cantidad_surtida) || 0), 0);
    const monto = skus.reduce((s, x) => s + ((Number(x.cantidad_ordenada) || 0) * (Number(x.precio_unitario) || 0)), 0);
    const fillRate = piezasOrd > 0 && oc.fecha_surtida ? (piezasSur / piezasOrd * 100) : null;
    const etapa = etapaActualDe(oc);
    const diasEnEtapa = diasEnEtapaActual(oc);
    return {
      ...oc,
      skus,
      piezasOrd,
      piezasSur,
      monto,
      fillRate,
      etapa,
      diasEnEtapa,
      atrasada: etapa && etapa !== 'entregada' && diasEnEtapa != null && diasEnEtapa > UMBRAL_DIAS_ALERTA,
    };
  }), [ocs, skusPorOc]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enriquecidas.filter((oc) => {
      if (clienteFiltro !== 'TODOS' && oc.cliente_key !== clienteFiltro) return false;
      if (estatusFiltro === 'abiertas' && oc.etapa === 'entregada') return false;
      if (estatusFiltro === 'entregadas' && oc.etapa !== 'entregada') return false;
      if (q) {
        const hay = `${oc.numero_oc_cliente} ${oc.numero_factura || ''} ${(oc.skus || []).map((s) => s.sku).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriquecidas, busqueda, clienteFiltro, estatusFiltro]);

  const kpis = useMemo(() => {
    const abiertas = enriquecidas.filter((oc) => oc.etapa !== 'entregada');
    const atrasadas = abiertas.filter((oc) => oc.atrasada);
    const mesActual = new Date().getMonth();
    const anioActual = new Date().getFullYear();
    const surtidasMes = enriquecidas.filter((oc) => {
      if (!oc.fecha_surtida) return false;
      const d = new Date(oc.fecha_surtida);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    });
    const entregadas = enriquecidas.filter((oc) => oc.etapa === 'entregada' && oc.fecha_recibida && oc.fecha_entregada);
    const promedios = entregadas.map((oc) => dias(oc.fecha_recibida, oc.fecha_entregada)).filter((n) => n != null);
    const tiempoPromedio = promedios.length ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null;
    const piezasOrdMes = surtidasMes.reduce((s, oc) => s + oc.piezasOrd, 0);
    const piezasSurMes = surtidasMes.reduce((s, oc) => s + oc.piezasSur, 0);
    const fillMes = piezasOrdMes > 0 ? (piezasSurMes / piezasOrdMes * 100) : null;
    return {
      abiertas: abiertas.length,
      abiertasMonto: abiertas.reduce((s, x) => s + x.monto, 0),
      abiertasPiezas: abiertas.reduce((s, x) => s + x.piezasOrd, 0),
      atrasadas: atrasadas.length,
      atrasadasDetalle: atrasadas.slice(0, 5),
      surtidasMes: surtidasMes.length,
      fillMes,
      piezasOrdMes,
      piezasSurMes,
      tiempoPromedio,
      nEntregadas: entregadas.length,
      porCliente: CLIENTES.map((c) => ({
        cliente: c.nombre,
        n: abiertas.filter((oc) => oc.cliente_key === c.key).length,
      })),
    };
  }, [enriquecidas]);

  const tiemposPorCliente = useMemo(() => {
    const map = {};
    for (const c of CLIENTES) map[c.key] = { rp: [], ps: [], se: [] };
    for (const oc of enriquecidas) {
      if (oc.etapa !== 'entregada') continue;
      const rp = dias(oc.fecha_recibida, oc.fecha_procesada);
      const ps = dias(oc.fecha_procesada, oc.fecha_surtida);
      const se = dias(oc.fecha_surtida, oc.fecha_entregada);
      const b = map[oc.cliente_key];
      if (!b) continue;
      if (rp != null) b.rp.push(rp);
      if (ps != null) b.ps.push(ps);
      if (se != null) b.se.push(se);
    }
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return CLIENTES.map((c) => {
      const b = map[c.key];
      const rp = avg(b.rp);
      const ps = avg(b.ps);
      const se = avg(b.se);
      const total = [rp, ps, se].filter((n) => n != null).reduce((a, b) => a + b, 0);
      const n = Math.max(b.rp.length, b.ps.length, b.se.length);
      return { cliente: c.nombre, rp, ps, se, total, n };
    });
  }, [enriquecidas]);

  const avanzarEtapa = async (oc, etapa) => {
    const campo = ETAPA_CAMPO[etapa];
    const { error } = await supabase.from('oc_clientes')
      .update({ [campo]: nowIso(), updated_at: nowIso() }).eq('id', oc.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };

  const eliminarOC = async (oc) => {
    if (!confirm(`¿Eliminar OC ${oc.numero_oc_cliente}? Esto borra también sus SKUs.`)) return;
    const { error } = await supabase.from('oc_clientes').delete().eq('id', oc.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400">Cargando pedidos…</div>;
  }

  return (
    <div className="max-w-none mx-auto p-4 space-y-3">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[11px] font-semibold mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
            Dirección Comercial · Operación
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <Target className="w-6 h-6 text-gray-700" /> Tracking Pedidos
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ciclo de OCs desde recepción hasta entrega · {ocs.length} OCs en el sistema
          </p>
        </div>
        <button onClick={() => setShowNuevaOC(true)}
          className="h-9 px-4 bg-sky-500 hover:bg-sky-600 text-white rounded-lg text-sm font-semibold inline-flex items-center gap-1.5">
          <Plus className="w-4 h-4" /> Nueva OC
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPICard
          label="OCs abiertas"
          badge={kpis.atrasadas > 0 ? `${kpis.atrasadas} atrasadas` : null}
          badgeTone={kpis.atrasadas > 0 ? 'warn' : 'good'}
          value={fmtInt(kpis.abiertas)}
          sub={<>
            <span className="tabular-nums">{formatMXN(kpis.abiertasMonto)} · {fmtInt(kpis.abiertasPiezas)} pz</span>
            <span>{kpis.porCliente.map((c) => `${c.cliente} ${c.n}`).join(' · ')}</span>
          </>}
        />
        <KPICard
          label="OCs surtidas mes"
          badge={kpis.fillMes != null ? `Fill ${kpis.fillMes.toFixed(1)}%` : null}
          badgeTone={kpis.fillMes == null ? 'neutral' : kpis.fillMes >= 95 ? 'good' : kpis.fillMes >= 85 ? 'warn' : 'bad'}
          value={fmtInt(kpis.surtidasMes)}
          sub={<>
            <span className="tabular-nums">{fmtInt(kpis.piezasSurMes)} / {fmtInt(kpis.piezasOrdMes)} pz</span>
          </>}
        />
        <KPICard
          label="Tiempo prom. Recibida → Entregada"
          badge={null}
          value={<>{kpis.tiempoPromedio != null ? kpis.tiempoPromedio.toFixed(1) : '—'} <span className="text-sm font-medium text-gray-400">días</span></>}
          sub={<>
            <span>Meta interna: 5 días</span>
            <span className="tabular-nums">n = {kpis.nEntregadas} OCs entregadas</span>
          </>}
        />
      </div>

      {/* Alertas */}
      {kpis.atrasadas > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-rose-50 border-l-4 border-rose-500 rounded text-[12px] text-rose-800">
          <span>⚠︎</span>
          <span>
            <strong className="font-semibold">{kpis.atrasadas} OC{kpis.atrasadas !== 1 ? 's' : ''} con más de {UMBRAL_DIAS_ALERTA} días sin avance:</strong>{' '}
            {kpis.atrasadasDetalle.map((oc, i) => (
              <span key={oc.id}>
                {i > 0 && ' · '}
                <span className="font-mono">#{oc.numero_oc_cliente}</span> ({NOMBRE_CLIENTE[oc.cliente_key]}, {oc.diasEnEtapa.toFixed(0)}d en {ETAPA_LABEL[oc.etapa]})
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Gráfica tiempos promedio */}
      {tiemposPorCliente.some((t) => t.total > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Tiempo promedio por etapa</h3>
            <div className="flex gap-3 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-slate-500" />Recibida→Procesada</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-500" />Procesada→Surtida</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-500" />Surtida→Entregada</span>
            </div>
          </div>
          <div className="space-y-2">
            {tiemposPorCliente.map((t) => (
              <BarTiempos key={t.cliente} data={t} maxTotal={Math.max(1, ...tiemposPorCliente.map((x) => x.total))} />
            ))}
          </div>
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-gray-200 bg-gray-50/60">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 px-2 bg-white border border-gray-200 rounded-lg h-8 flex-1 min-w-0 max-w-xs">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por No. OC, factura o SKU…"
                className="flex-1 outline-none text-xs bg-transparent min-w-0" />
            </div>
            <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}
              className="h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white">
              <option value="TODOS">Todos los clientes</option>
              {CLIENTES.map((c) => <option key={c.key} value={c.key}>{c.nombre}</option>)}
            </select>
            <select value={estatusFiltro} onChange={(e) => setEstatusFiltro(e.target.value)}
              className="h-8 px-2 border border-gray-200 rounded-lg text-xs bg-white">
              <option value="abiertas">Abiertas</option>
              <option value="entregadas">Entregadas</option>
              <option value="todas">Todas</option>
            </select>
          </div>
          <span className="text-[11px] text-gray-500">{filas.length} OCs</span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr>
                {[
                  { l: '', w: 32 },
                  { l: 'Cliente' },
                  { l: 'No. OC' },
                  { l: 'No. Factura' },
                  { l: 'Recibida' },
                  { l: 'Piezas', a: 'right' },
                  { l: 'Monto', a: 'right' },
                  { l: 'Fill', a: 'right' },
                  { l: 'Progreso · días por etapa', w: 240 },
                  { l: 'Envío' },
                  { l: 'Estatus' },
                ].map((h, i) => (
                  <th key={i} className="py-2 px-2.5 text-left font-medium uppercase tracking-wider text-[10px] text-gray-500 border-b border-gray-200 bg-gray-50"
                    style={{ textAlign: h.a || 'left', width: h.w, whiteSpace: 'nowrap' }}>
                    {h.l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={11} className="py-12 text-center text-gray-400 text-sm">Sin OCs. Da click en "Nueva OC" para capturar la primera.</td></tr>
              )}
              {filas.map((oc) => {
                const abierta = ocAbierta === oc.id;
                const next = siguienteEtapa(oc);
                return (
                  <React.Fragment key={oc.id}>
                    <tr onClick={() => setOcAbierta(abierta ? null : oc.id)}
                      className={`border-b border-gray-100 cursor-pointer ${abierta ? 'bg-sky-50/70' : 'hover:bg-gray-50'}`}>
                      <td className="py-2 px-2.5">
                        <ChevronRight className="w-3.5 h-3.5 text-sky-500 transition-transform"
                          style={{ transform: abierta ? 'rotate(90deg)' : 'none' }} />
                      </td>
                      <td className="py-2 px-2.5 text-gray-800">{NOMBRE_CLIENTE[oc.cliente_key] || oc.cliente_key}</td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-gray-700">{oc.numero_oc_cliente}</td>
                      <td className="py-2 px-2.5 font-mono text-[11px] text-gray-700">{oc.numero_factura || '—'}</td>
                      <td className="py-2 px-2.5 tabular-nums text-gray-700">{fmtDate(oc.fecha_recibida)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{fmtInt(oc.piezasOrd)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{formatMXN(oc.monto)}</td>
                      <td className="py-2 px-2.5 text-right">
                        <FillCell oc={oc} />
                      </td>
                      <td className="py-2 px-2.5">
                        <ProgresoEtapas oc={oc} />
                      </td>
                      <td className="py-2 px-2.5"><EnvioCell oc={oc} /></td>
                      <td className="py-2 px-2.5">
                        {oc.etapa && (
                          <span className="inline-block text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
                            style={{ background: ETAPA_TONE[oc.etapa].bg, color: ETAPA_TONE[oc.etapa].text }}>
                            {ETAPA_LABEL[oc.etapa]}
                          </span>
                        )}
                      </td>
                    </tr>
                    {abierta && (
                      <tr>
                        <td colSpan={11} style={{ padding: 0, background: '#FCFCFD', borderBottom: '1px solid #E5E7EB' }}>
                          <DetalleOC oc={oc}
                            onEditar={() => setEditOc(oc)}
                            onAvanzar={next ? () => avanzarEtapa(oc, next) : null}
                            onEliminar={() => eliminarOC(oc)}
                            siguienteEtapa={next} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {(showNuevaOC || editOc) && (
        <ModalOC
          ocInicial={editOc}
          onClose={() => { setShowNuevaOC(false); setEditOc(null); }}
          onSaved={() => { setShowNuevaOC(false); setEditOc(null); cargar(); }}
        />
      )}
    </div>
  );
}

function KPICard({ label, badge, badgeTone, value, sub }) {
  const tones = {
    good: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-rose-50 text-rose-700',
    neutral: 'bg-gray-100 text-gray-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium mb-2">
        <span>{label}</span>
        {badge && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[badgeTone] || tones.neutral}`}>{badge}</span>}
      </div>
      <div className="text-[26px] font-semibold text-gray-800 tabular-nums leading-tight">{value}</div>
      {sub && <div className="mt-2 text-[11px] text-gray-500 flex justify-between items-center">{sub}</div>}
    </div>
  );
}

function BarTiempos({ data, maxTotal }) {
  const pct = (v) => (v != null ? (v / maxTotal * 100) : 0);
  return (
    <div className="grid grid-cols-[100px_1fr_60px] gap-3 items-center">
      <span className="text-xs font-medium text-gray-700">{data.cliente}</span>
      <div className="h-5 bg-gray-100 rounded overflow-hidden flex text-white text-[9px] font-semibold">
        {data.rp != null && <span className="bg-slate-500 flex items-center justify-center" style={{ width: `${pct(data.rp)}%` }}>{data.rp > 0.4 ? `${data.rp.toFixed(1)}d` : ''}</span>}
        {data.ps != null && <span className="bg-indigo-500 flex items-center justify-center" style={{ width: `${pct(data.ps)}%` }}>{data.ps > 0.4 ? `${data.ps.toFixed(1)}d` : ''}</span>}
        {data.se != null && <span className="bg-amber-500 flex items-center justify-center text-amber-900" style={{ width: `${pct(data.se)}%` }}>{data.se > 0.4 ? `${data.se.toFixed(1)}d` : ''}</span>}
      </div>
      <span className="text-xs font-semibold text-gray-800 tabular-nums text-right">{data.total > 0 ? `${data.total.toFixed(1)}d` : '—'}<span className="text-gray-400 font-normal"> ·n{data.n}</span></span>
    </div>
  );
}

function FillCell({ oc }) {
  if (!oc.fecha_surtida) {
    return <div className="text-[10.5px] text-gray-400 italic">Sin surtir</div>;
  }
  const tone = oc.fillRate >= 98 ? 'text-emerald-700' : oc.fillRate >= 90 ? 'text-amber-700' : 'text-rose-700';
  return (
    <div className="flex flex-col items-end">
      <span className={`text-[13px] font-semibold tabular-nums ${tone}`}>{oc.fillRate.toFixed(1)}%</span>
      <span className="text-[10px] text-gray-500 tabular-nums">{fmtInt(oc.piezasSur)} / {fmtInt(oc.piezasOrd)} pz</span>
    </div>
  );
}

function ProgresoEtapas({ oc }) {
  const step = { pending: '#E5E7EB', done: '#10B981', active: '#38BDF8' };
  const etapa = oc.etapa;
  const idx = etapa ? ETAPAS.indexOf(etapa) : -1;
  const stepColor = (i) => {
    if (idx === -1) return step.pending;
    if (i < idx) return step.done;
    if (i === idx) return step.active;
    return step.pending;
  };
  const durations = [
    dias(oc.fecha_recibida, oc.fecha_procesada),
    dias(oc.fecha_procesada, oc.fecha_surtida),
    dias(oc.fecha_surtida, oc.fecha_entregada),
  ];
  return (
    <div style={{ maxWidth: 220 }}>
      <div className="grid grid-cols-4 gap-0.5">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="h-1 rounded-full" style={{ background: stepColor(i) }} />
        ))}
      </div>
      <div className="grid grid-cols-4 gap-0.5 mt-1 text-[9px] text-gray-400 uppercase tracking-wider text-center">
        {ETAPAS.map((e, i) => (
          <span key={e} className={i <= idx ? 'text-gray-600 font-semibold' : ''}>{ETAPA_LABEL[e]}</span>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-0.5 mt-0.5 text-[9px] tabular-nums text-center">
        <span>—</span>
        {[0, 1, 2].map((i) => {
          const d = durations[i];
          const esActual = etapa && ETAPAS.indexOf(etapa) === i + 1;
          const enCurso = etapa && ETAPAS.indexOf(etapa) === i && !oc.fecha_entregada;
          if (d != null) return <span key={i} className="text-emerald-700 font-semibold">{d.toFixed(1)}d</span>;
          if (enCurso && oc.diasEnEtapa != null) return <span key={i} className={oc.diasEnEtapa > UMBRAL_DIAS_ALERTA ? 'text-rose-700 font-semibold' : 'text-sky-600 font-semibold'}>{oc.diasEnEtapa.toFixed(1)}d</span>;
          return <span key={i} className="text-gray-300">—</span>;
        })}
      </div>
    </div>
  );
}

function EnvioCell({ oc }) {
  if (!oc.metodo_envio) return <span className="text-[11px] text-gray-400">—</span>;
  const propio = oc.metodo_envio === 'unidad_propia';
  return (
    <div className="flex flex-col gap-1 items-start">
      <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded ${propio ? 'bg-sky-100 text-sky-800' : 'bg-purple-100 text-purple-800'}`}>
        {propio ? <Truck className="w-3 h-3" /> : <Package className="w-3 h-3" />}
        {propio ? 'Unidad propia' : (oc.paqueteria || 'Paquetería')}
      </span>
      {oc.requiere_cita ? (
        <span className="inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">
          Con cita{oc.fecha_cita ? ` · ${fmtDate(oc.fecha_cita)}` : ''}
        </span>
      ) : (
        <span className="inline-block text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Sin cita</span>
      )}
    </div>
  );
}

function DetalleOC({ oc, onEditar, onAvanzar, onEliminar, siguienteEtapa: sigEtapa }) {
  const skus = oc.skus || [];
  const totalOrd = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
  const totalSur = skus.reduce((s, x) => s + (Number(x.cantidad_surtida) || 0), 0);
  const totalMonto = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0) * (Number(x.precio_unitario) || 0), 0);

  return (
    <div className="p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-0.5">
            Detalle · OC {oc.numero_oc_cliente} · {NOMBRE_CLIENTE[oc.cliente_key]}
          </div>
          {oc.notas && <div className="text-[12px] text-gray-600 italic">"{oc.notas}"</div>}
        </div>
        <div className="flex gap-1.5">
          <button onClick={onEditar} className="h-7 px-2.5 text-[11px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 inline-flex items-center gap-1">
            <Edit2 className="w-3 h-3" /> Editar
          </button>
          <button onClick={onEliminar} className="h-7 px-2.5 text-[11px] border border-rose-200 rounded-md bg-white hover:bg-rose-50 text-rose-700 inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Eliminar
          </button>
          {onAvanzar && sigEtapa && (
            <button onClick={onAvanzar} className="h-7 px-3 text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 text-white rounded-md">
              Marcar como {ETAPA_LABEL[sigEtapa]} →
            </button>
          )}
        </div>
      </div>

      {skus.length > 0 ? (
        <table className="w-full text-[11.5px] bg-white border border-gray-200 rounded-md overflow-hidden">
          <thead className="bg-gray-50">
            <tr className="text-[9.5px] uppercase tracking-widest text-gray-500">
              <th className="py-1.5 px-2.5 text-left">SKU</th>
              <th className="py-1.5 px-2.5 text-right">Cant. ordenada</th>
              <th className="py-1.5 px-2.5 text-right">Cant. surtida</th>
              <th className="py-1.5 px-2.5 text-right">Fill rate</th>
              <th className="py-1.5 px-2.5 text-right">Precio</th>
              <th className="py-1.5 px-2.5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {skus.map((s, i) => {
              const fill = s.cantidad_surtida != null && s.cantidad_ordenada > 0 ? (Number(s.cantidad_surtida) / Number(s.cantidad_ordenada) * 100) : null;
              return (
                <tr key={s.id} className="border-t border-gray-100">
                  <td className="py-1.5 px-2.5 font-mono text-gray-700">{s.sku}</td>
                  <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(s.cantidad_ordenada)}</td>
                  <td className="py-1.5 px-2.5 text-right tabular-nums">{s.cantidad_surtida != null ? fmtInt(s.cantidad_surtida) : <span className="text-gray-400">—</span>}</td>
                  <td className="py-1.5 px-2.5 text-right tabular-nums">{fill != null ? `${fill.toFixed(1)}%` : <span className="text-gray-400">—</span>}</td>
                  <td className="py-1.5 px-2.5 text-right tabular-nums">{formatMXN(Number(s.precio_unitario))}</td>
                  <td className="py-1.5 px-2.5 text-right tabular-nums">{formatMXN(Number(s.cantidad_ordenada) * Number(s.precio_unitario))}</td>
                </tr>
              );
            })}
            <tr className="bg-gray-50 font-semibold">
              <td className="py-1.5 px-2.5 text-[10px] uppercase tracking-wider text-gray-600">{skus.length} SKUs</td>
              <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(totalOrd)}</td>
              <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(totalSur)}</td>
              <td className="py-1.5 px-2.5 text-right tabular-nums">{totalOrd > 0 && oc.fecha_surtida ? `${(totalSur / totalOrd * 100).toFixed(1)}%` : '—'}</td>
              <td></td>
              <td className="py-1.5 px-2.5 text-right tabular-nums">{formatMXN(totalMonto)}</td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="text-xs text-gray-400 italic">Sin SKUs capturados.</div>
      )}

      {/* Timeline */}
      <div className="grid grid-cols-4 gap-3 border-t border-gray-200 pt-3">
        {ETAPAS.map((e) => {
          const iso = oc[ETAPA_CAMPO[e]];
          return (
            <div key={e}>
              <div className="text-[9.5px] uppercase tracking-widest text-gray-500">{ETAPA_LABEL[e]}</div>
              <div className={`text-[13px] font-semibold tabular-nums ${iso ? 'text-gray-800' : 'text-gray-400 font-normal'}`}>
                {iso ? fmtDateFull(iso) : 'Pendiente'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Envío */}
      {(oc.metodo_envio || oc.requiere_cita) && (
        <div className="grid grid-cols-4 gap-3 border-t border-gray-200 pt-3">
          <div>
            <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Método de envío</div>
            <div className="text-[13px] font-semibold text-gray-800">
              {oc.metodo_envio === 'unidad_propia' ? '🚚 Unidad propia' : oc.metodo_envio === 'paqueteria' ? '📦 Paquetería' : '—'}
              {oc.unidad_envio && <span className="text-[11px] font-medium text-gray-500 ml-1">{oc.unidad_envio}</span>}
            </div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Paquetería</div>
            <div className={`text-[13px] font-semibold ${oc.paqueteria ? 'text-gray-800' : 'text-gray-400 font-normal'}`}>
              {oc.paqueteria || '—'}
            </div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Cita de entrega</div>
            <div className="text-[13px] font-semibold text-gray-800">{oc.requiere_cita ? 'Sí' : 'No'}</div>
          </div>
          <div>
            <div className="text-[9.5px] uppercase tracking-widest text-gray-500">Fecha de cita</div>
            <div className={`text-[13px] font-semibold tabular-nums ${oc.fecha_cita ? 'text-gray-800' : 'text-gray-400 font-normal'}`}>
              {oc.fecha_cita ? fmtDateFull(oc.fecha_cita) : '—'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal captura / edición ────────────────────────────────────────────────
function ModalOC({ ocInicial, onClose, onSaved }) {
  const es = !!ocInicial;
  const [numero, setNumero] = useState(ocInicial?.numero_oc_cliente || '');
  const [cliente, setCliente] = useState(ocInicial?.cliente_key || 'digitalife');
  const [fechaRecibida, setFechaRecibida] = useState(ocInicial?.fecha_recibida ? ocInicial.fecha_recibida.slice(0, 16) : todayLocalIso());
  const [fechaProcesada, setFechaProcesada] = useState(ocInicial?.fecha_procesada ? ocInicial.fecha_procesada.slice(0, 16) : '');
  const [fechaSurtida, setFechaSurtida] = useState(ocInicial?.fecha_surtida ? ocInicial.fecha_surtida.slice(0, 16) : '');
  const [fechaEntregada, setFechaEntregada] = useState(ocInicial?.fecha_entregada ? ocInicial.fecha_entregada.slice(0, 16) : '');
  const [numFactura, setNumFactura] = useState(ocInicial?.numero_factura || '');
  const [metodoEnvio, setMetodoEnvio] = useState(ocInicial?.metodo_envio || 'unidad_propia');
  const [paqueteria, setPaqueteria] = useState(ocInicial?.paqueteria || '');
  const [unidadEnvio, setUnidadEnvio] = useState(ocInicial?.unidad_envio || '');
  const [requiereCita, setRequiereCita] = useState(!!ocInicial?.requiere_cita);
  const [fechaCita, setFechaCita] = useState(ocInicial?.fecha_cita ? ocInicial.fecha_cita.slice(0, 16) : '');
  const [notas, setNotas] = useState(ocInicial?.notas || '');
  const [skus, setSkus] = useState(() => {
    if (ocInicial && ocInicial.skus?.length) {
      return ocInicial.skus.map((s) => ({
        id: s.id, sku: s.sku, cantidad_ordenada: s.cantidad_ordenada, cantidad_surtida: s.cantidad_surtida ?? '', precio_unitario: s.precio_unitario,
      }));
    }
    return [{ sku: '', cantidad_ordenada: '', cantidad_surtida: '', precio_unitario: '' }];
  });
  const [saving, setSaving] = useState(false);

  const addSku = () => setSkus([...skus, { sku: '', cantidad_ordenada: '', cantidad_surtida: '', precio_unitario: '' }]);
  const removeSku = (i) => setSkus(skus.filter((_, j) => j !== i));
  const updateSku = (i, field, val) => setSkus(skus.map((s, j) => j === i ? { ...s, [field]: val } : s));

  const guardar = async () => {
    if (!numero.trim()) return alert('Falta el número de OC');
    if (!cliente) return alert('Falta el cliente');
    setSaving(true);
    const toIso = (v) => v ? new Date(v).toISOString() : null;
    const payload = {
      numero_oc_cliente: numero.trim(),
      cliente_key: cliente,
      fecha_recibida: toIso(fechaRecibida),
      fecha_procesada: toIso(fechaProcesada),
      fecha_surtida: toIso(fechaSurtida),
      fecha_entregada: toIso(fechaEntregada),
      numero_factura: numFactura.trim() || null,
      metodo_envio: metodoEnvio,
      paqueteria: metodoEnvio === 'paqueteria' ? (paqueteria || null) : null,
      unidad_envio: metodoEnvio === 'unidad_propia' ? (unidadEnvio.trim() || null) : null,
      requiere_cita: requiereCita,
      fecha_cita: requiereCita ? toIso(fechaCita) : null,
      notas: notas.trim() || null,
      updated_at: nowIso(),
    };

    let ocId;
    if (es) {
      const { error } = await supabase.from('oc_clientes').update(payload).eq('id', ocInicial.id);
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      ocId = ocInicial.id;
      await supabase.from('oc_clientes_skus').delete().eq('oc_id', ocId);
    } else {
      const { data, error } = await supabase.from('oc_clientes').insert(payload).select('id').single();
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      ocId = data.id;
    }

    const skusPayload = skus
      .filter((s) => s.sku && s.sku.trim())
      .map((s) => ({
        oc_id: ocId,
        sku: s.sku.trim(),
        cantidad_ordenada: Number(s.cantidad_ordenada) || 0,
        cantidad_surtida: s.cantidad_surtida === '' || s.cantidad_surtida == null ? null : Number(s.cantidad_surtida),
        precio_unitario: Number(s.precio_unitario) || 0,
      }));
    if (skusPayload.length > 0) {
      const { error } = await supabase.from('oc_clientes_skus').insert(skusPayload);
      if (error) { setSaving(false); return alert('Error SKUs: ' + error.message); }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{es ? 'Editar OC' : 'Nueva OC de cliente'}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>

        <div className="overflow-auto p-5 space-y-4">
          {/* Datos generales */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Número de OC del cliente *">
              <input value={numero} onChange={(e) => setNumero(e.target.value)}
                placeholder="ej. OC-24891" className="input" />
            </Field>
            <Field label="Cliente *">
              <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="input">
                {CLIENTES.map((c) => <option key={c.key} value={c.key}>{c.nombre}</option>)}
              </select>
            </Field>
            <Field label="Número de factura (una vez surtida)">
              <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)}
                placeholder="ej. FA-08421" className="input" />
            </Field>
            <Field label="Notas">
              <input value={notas} onChange={(e) => setNotas(e.target.value)}
                placeholder="Observaciones internas…" className="input" />
            </Field>
          </div>

          {/* Fechas */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Etapas</div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Recibida">
                <input type="datetime-local" value={fechaRecibida} onChange={(e) => setFechaRecibida(e.target.value)} className="input" />
              </Field>
              <Field label="Procesada">
                <input type="datetime-local" value={fechaProcesada} onChange={(e) => setFechaProcesada(e.target.value)} className="input" />
              </Field>
              <Field label="Surtida">
                <input type="datetime-local" value={fechaSurtida} onChange={(e) => setFechaSurtida(e.target.value)} className="input" />
              </Field>
              <Field label="Entregada">
                <input type="datetime-local" value={fechaEntregada} onChange={(e) => setFechaEntregada(e.target.value)} className="input" />
              </Field>
            </div>
          </div>

          {/* Envío */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-3">
            <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Envío</div>
            <div className="flex gap-4 text-sm">
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="radio" name="metodo" checked={metodoEnvio === 'unidad_propia'} onChange={() => setMetodoEnvio('unidad_propia')} />
                <span>🚚 Unidad propia</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer">
                <input type="radio" name="metodo" checked={metodoEnvio === 'paqueteria'} onChange={() => setMetodoEnvio('paqueteria')} />
                <span>📦 Paquetería</span>
              </label>
            </div>
            {metodoEnvio === 'unidad_propia' && (
              <Field label="Unidad (opcional)">
                <input value={unidadEnvio} onChange={(e) => setUnidadEnvio(e.target.value)}
                  placeholder="ej. Camión Acteck #4" className="input" />
              </Field>
            )}
            {metodoEnvio === 'paqueteria' && (
              <Field label="Paquetería">
                <select value={paqueteria} onChange={(e) => setPaqueteria(e.target.value)} className="input">
                  <option value="">Seleccionar…</option>
                  {PAQUETERIAS.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
            )}
            <div className="pt-2 border-t border-gray-100">
              <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={requiereCita} onChange={(e) => setRequiereCita(e.target.checked)} />
                <span>Requiere cita de entrega</span>
              </label>
              {requiereCita && (
                <Field label="Fecha y hora de cita" className="mt-2">
                  <input type="datetime-local" value={fechaCita} onChange={(e) => setFechaCita(e.target.value)} className="input" />
                </Field>
              )}
            </div>
          </div>

          {/* SKUs */}
          <div className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">SKUs de la OC</div>
              <button onClick={addSku} className="text-[11px] text-sky-600 font-semibold">+ Agregar SKU</button>
            </div>
            <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_28px] gap-2 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              <span>SKU</span>
              <span className="text-right">Cant. ordenada</span>
              <span className="text-right">Cant. surtida</span>
              <span className="text-right">Precio</span>
              <span></span>
            </div>
            {skus.map((s, i) => (
              <div key={i} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_0.8fr_28px] gap-2 items-center">
                <input value={s.sku} onChange={(e) => updateSku(i, 'sku', e.target.value)} placeholder="ej. AC-935845" className="input" />
                <input type="number" value={s.cantidad_ordenada} onChange={(e) => updateSku(i, 'cantidad_ordenada', e.target.value)} className="input text-right" />
                <input type="number" value={s.cantidad_surtida} onChange={(e) => updateSku(i, 'cantidad_surtida', e.target.value)} className="input text-right" placeholder="—" />
                <input type="number" step="0.01" value={s.precio_unitario} onChange={(e) => updateSku(i, 'precio_unitario', e.target.value)} className="input text-right" />
                <button onClick={() => removeSku(i)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button onClick={onClose} className="h-9 px-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-sm">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="h-9 px-5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? 'Guardando…' : (es ? 'Actualizar OC' : 'Crear OC')}
          </button>
        </div>
      </div>
      <style>{`
        .input { width: 100%; height: 34px; padding: 0 10px; border: 1px solid #E5E7EB; border-radius: 6px; font-size: 12.5px; background: white; }
        .input:focus { outline: none; border-color: #0EA5E9; box-shadow: 0 0 0 3px rgba(14,165,233,0.1); }
      `}</style>
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <div className="text-[10.5px] font-medium text-gray-600 mb-1">{label}</div>
      {children}
    </div>
  );
}
