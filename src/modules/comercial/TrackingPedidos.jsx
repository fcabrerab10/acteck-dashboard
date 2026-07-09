import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import {
  Target, Plus, Search, X, ChevronRight, Trash2, Edit2, Truck, Package,
} from 'lucide-react';

const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife' },
  { key: 'pcel',       nombre: 'PCEL' },
  { key: 'dicotech',   nombre: 'Dicotech' },
];
const NOMBRE_CLIENTE = Object.fromEntries(CLIENTES.map((c) => [c.key, c.nombre]));

const ETAPAS = ['recibida', 'procesada', 'surtida', 'entregada'];
const ETAPA_LABEL = { recibida: 'Recibida', procesada: 'Procesada', surtida: 'Surtida', entregada: 'Entregada' };
const ETAPA_TONE = {
  recibida:  { bg: '#F1F5F9', text: '#334155' },
  procesada: { bg: '#EEF2FF', text: '#3730A3' },
  surtida:   { bg: '#FEF3C7', text: '#92400E' },
  entregada: { bg: '#D1FAE5', text: '#065F46' },
};

const ALMACENES = ['GDL', 'CDMX'];
const ALM_TONE = {
  GDL:  { bg: '#FCE7F3', text: '#9D174D' },
  CDMX: { bg: '#CFFAFE', text: '#155E75' },
};

const PAQUETERIAS = ['DHL', 'Estafeta', 'Fedex', 'Redpack', 'Paquetexpress', 'Otra'];
const UMBRAL_DIAS_ALERTA = 3;

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};
const fmtDateFull = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};
const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const dias = (from, to) => {
  if (!from || !to) return null;
  return (new Date(to).getTime() - new Date(from).getTime()) / (86400000);
};
const nowIso = () => new Date().toISOString();
const todayLocalIso = () => new Date().toISOString().slice(0, 16);
const toIso = (v) => (v ? new Date(v).toISOString() : null);

// Etapa derivada a nivel OC
function etapaDeOc(oc, envios, fillRate) {
  if (!oc.fecha_recibida) return null;
  if (!oc.fecha_procesada) return 'recibida';
  const algunSurtido = envios.some((e) => e.fecha_surtida);
  if (!algunSurtido) return 'procesada';
  const todosEntregados = envios.length > 0 && envios.every((e) => e.fecha_entregada);
  if (todosEntregados && fillRate >= 100) return 'entregada';
  return 'surtida';
}
function fechaEtapaOc(oc, envios, etapa) {
  if (etapa === 'recibida') return oc.fecha_recibida;
  if (etapa === 'procesada') return oc.fecha_procesada;
  if (etapa === 'surtida') {
    const fechas = envios.map((e) => e.fecha_surtida).filter(Boolean).sort();
    return fechas[0] || null;
  }
  if (etapa === 'entregada') {
    const fechas = envios.map((e) => e.fecha_entregada).filter(Boolean).sort();
    return fechas[fechas.length - 1] || null;
  }
  return null;
}
function ultimaFechaOc(oc, envios) {
  const todas = [
    oc.fecha_recibida, oc.fecha_procesada,
    ...envios.flatMap((e) => [e.fecha_surtida, e.fecha_entregada]),
  ].filter(Boolean).sort();
  return todas[todas.length - 1];
}

export default function TrackingPedidos() {
  const [loading, setLoading] = useState(true);
  const [ocs, setOcs] = useState([]);
  const [skusPorOc, setSkusPorOc] = useState({});
  const [enviosPorOc, setEnviosPorOc] = useState({});
  const [envioSkusPorEnvio, setEnvioSkusPorEnvio] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('TODOS');
  const [estatusFiltro, setEstatusFiltro] = useState('abiertas');
  const [ocAbierta, setOcAbierta] = useState(null);
  const [envioAbierto, setEnvioAbierto] = useState(null);
  const [showNuevaOC, setShowNuevaOC] = useState(false);
  const [editOc, setEditOc] = useState(null);
  const [envioModal, setEnvioModal] = useState(null); // { ocId, envio (nullable si nuevo) }

  const cargar = async () => {
    setLoading(true);
    const [ocsRes, skusRes, enviosRes, envioSkusRes] = await Promise.all([
      supabase.from('oc_clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('oc_clientes_skus').select('*'),
      supabase.from('oc_envios').select('*').order('numero_envio'),
      supabase.from('oc_envio_skus').select('*'),
    ]);
    const skus = {}; for (const s of (skusRes.data || [])) { (skus[s.oc_id] ||= []).push(s); }
    const envios = {}; for (const e of (enviosRes.data || [])) { (envios[e.oc_id] ||= []).push(e); }
    const esk = {}; for (const x of (envioSkusRes.data || [])) { (esk[x.envio_id] ||= []).push(x); }
    setOcs(ocsRes.data || []);
    setSkusPorOc(skus);
    setEnviosPorOc(envios);
    setEnvioSkusPorEnvio(esk);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const enriquecidas = useMemo(() => ocs.map((oc) => {
    const skus = skusPorOc[oc.id] || [];
    const envios = enviosPorOc[oc.id] || [];
    const piezasOrd = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
    const monto = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0) * (Number(x.precio_unitario) || 0), 0);
    // Suma cantidades surtidas de todos los envío_skus asociados a los envíos de esta OC
    const surtidoPorSku = {};
    for (const e of envios) {
      const es = envioSkusPorEnvio[e.id] || [];
      for (const x of es) {
        surtidoPorSku[x.oc_sku_id] = (surtidoPorSku[x.oc_sku_id] || 0) + (Number(x.cantidad_surtida) || 0);
      }
    }
    const piezasSur = Object.values(surtidoPorSku).reduce((s, v) => s + v, 0);
    const fillRate = piezasOrd > 0 ? (piezasSur / piezasOrd * 100) : 0;
    const etapa = etapaDeOc(oc, envios, fillRate);
    const ultimaFecha = ultimaFechaOc(oc, envios);
    const diasSinAvance = ultimaFecha ? dias(ultimaFecha, nowIso()) : null;
    return {
      ...oc,
      skus,
      envios,
      surtidoPorSku,
      piezasOrd,
      piezasSur,
      monto,
      fillRate,
      etapa,
      ultimaFecha,
      diasSinAvance,
      atrasada: etapa && etapa !== 'entregada' && diasSinAvance != null && diasSinAvance > UMBRAL_DIAS_ALERTA,
    };
  }), [ocs, skusPorOc, enviosPorOc, envioSkusPorEnvio]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enriquecidas.filter((oc) => {
      if (clienteFiltro !== 'TODOS' && oc.cliente_key !== clienteFiltro) return false;
      if (estatusFiltro === 'abiertas' && oc.etapa === 'entregada') return false;
      if (estatusFiltro === 'entregadas' && oc.etapa !== 'entregada') return false;
      if (q) {
        const hay = `${oc.numero_oc_cliente} ${(oc.skus || []).map((s) => s.sku).join(' ')} ${(oc.envios || []).map((e) => `${e.numero_factura || ''} ${e.guia_rastreo || ''}`).join(' ')}`.toLowerCase();
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

    // OCs con algún envío surtido este mes
    const conEnvioMes = enriquecidas.filter((oc) => oc.envios.some((e) => {
      if (!e.fecha_surtida) return false;
      const d = new Date(e.fecha_surtida);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }));
    const piezasOrdMes = conEnvioMes.reduce((s, oc) => s + oc.piezasOrd, 0);
    const piezasSurMes = conEnvioMes.reduce((s, oc) => s + oc.piezasSur, 0);
    const fillMes = piezasOrdMes > 0 ? (piezasSurMes / piezasOrdMes * 100) : null;

    // Tiempo Recibida→Entregada de OCs entregadas
    const entregadas = enriquecidas.filter((oc) => oc.etapa === 'entregada' && oc.fecha_recibida);
    const promedios = entregadas.map((oc) => {
      const fEnt = fechaEtapaOc(oc, oc.envios, 'entregada');
      return dias(oc.fecha_recibida, fEnt);
    }).filter((n) => n != null);
    const tiempoPromedio = promedios.length ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null;

    return {
      abiertas: abiertas.length,
      abiertasMonto: abiertas.reduce((s, x) => s + x.monto, 0),
      abiertasPiezas: abiertas.reduce((s, x) => s + x.piezasOrd, 0),
      atrasadas: atrasadas.length,
      atrasadasDetalle: atrasadas.slice(0, 5),
      conEnvioMes: conEnvioMes.length,
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
    const acc = {};
    for (const c of CLIENTES) acc[c.key] = { rp: [], ps: [], se: [] };
    for (const oc of enriquecidas) {
      if (oc.etapa !== 'entregada') continue;
      const fSur = fechaEtapaOc(oc, oc.envios, 'surtida');
      const fEnt = fechaEtapaOc(oc, oc.envios, 'entregada');
      const rp = dias(oc.fecha_recibida, oc.fecha_procesada);
      const ps = dias(oc.fecha_procesada, fSur);
      const se = dias(fSur, fEnt);
      const b = acc[oc.cliente_key];
      if (!b) continue;
      if (rp != null) b.rp.push(rp);
      if (ps != null) b.ps.push(ps);
      if (se != null) b.se.push(se);
    }
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return CLIENTES.map((c) => {
      const b = acc[c.key];
      const rp = avg(b.rp), ps = avg(b.ps), se = avg(b.se);
      const total = [rp, ps, se].filter((n) => n != null).reduce((a, b) => a + b, 0);
      const n = Math.max(b.rp.length, b.ps.length, b.se.length);
      return { cliente: c.nombre, rp, ps, se, total, n };
    });
  }, [enriquecidas]);

  const eliminarOC = async (oc) => {
    if (!confirm(`¿Eliminar OC ${oc.numero_oc_cliente}? Esto borra también sus SKUs y envíos.`)) return;
    const { error } = await supabase.from('oc_clientes').delete().eq('id', oc.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };

  const eliminarEnvio = async (envio) => {
    if (!confirm(`¿Eliminar envío #${envio.numero_envio}?`)) return;
    const { error } = await supabase.from('oc_envios').delete().eq('id', envio.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };

  const avanzarOc = async (oc, campo) => {
    const { error } = await supabase.from('oc_clientes')
      .update({ [campo]: nowIso(), updated_at: nowIso() }).eq('id', oc.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };

  if (loading) return <div className="p-12 text-center text-gray-400">Cargando pedidos…</div>;

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
            Ciclo de OCs con envíos parciales · {ocs.length} OCs en el sistema
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
          label="OCs con envíos surtidos en el mes"
          badge={kpis.fillMes != null ? `Fill ${kpis.fillMes.toFixed(1)}%` : null}
          badgeTone={kpis.fillMes == null ? 'neutral' : kpis.fillMes >= 95 ? 'good' : kpis.fillMes >= 85 ? 'warn' : 'bad'}
          value={fmtInt(kpis.conEnvioMes)}
          sub={<span className="tabular-nums">{fmtInt(kpis.piezasSurMes)} / {fmtInt(kpis.piezasOrdMes)} pz</span>}
        />
        <KPICard
          label="Tiempo prom. Recibida → Entregada"
          badge={null}
          value={<>{kpis.tiempoPromedio != null ? kpis.tiempoPromedio.toFixed(1) : '—'} <span className="text-sm font-medium text-gray-400">días</span></>}
          sub={<>
            <span>Meta interna: 5 días</span>
            <span className="tabular-nums">n = {kpis.nEntregadas} OCs</span>
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
                <span className="font-mono">#{oc.numero_oc_cliente}</span> ({NOMBRE_CLIENTE[oc.cliente_key]}, {oc.diasSinAvance.toFixed(0)}d en {ETAPA_LABEL[oc.etapa] || 'sin captura'})
              </span>
            ))}
          </span>
        </div>
      )}

      {/* Chart */}
      {tiemposPorCliente.some((t) => t.total > 0) && (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Tiempo promedio por etapa</h3>
            <div className="flex gap-3 text-[11px] text-gray-500">
              <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-slate-500" />Recibida→Procesada</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-indigo-500" />Procesada→1er envío</span>
              <span className="inline-flex items-center gap-1"><span className="inline-block w-2 h-2 rounded-sm bg-amber-500" />Envío→Entrega final</span>
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
                placeholder="Buscar por No. OC, SKU, factura o guía…"
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
                  { l: 'Envíos', a: 'center' },
                  { l: 'Recibida' },
                  { l: 'Piezas', a: 'right' },
                  { l: 'Monto', a: 'right' },
                  { l: 'Fill', a: 'right' },
                  { l: 'Progreso', w: 220 },
                  { l: 'Estatus' },
                ].map((h, i) => (
                  <th key={i} className="py-2 px-2.5 font-medium uppercase tracking-wider text-[10px] text-gray-500 border-b border-gray-200 bg-gray-50"
                    style={{ textAlign: h.a || 'left', width: h.w, whiteSpace: 'nowrap' }}>
                    {h.l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={10} className="py-12 text-center text-gray-400 text-sm">Sin OCs. Da click en "Nueva OC" para capturar la primera.</td></tr>
              )}
              {filas.map((oc) => {
                const abierta = ocAbierta === oc.id;
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
                      <td className="py-2 px-2.5 text-center">
                        {oc.envios.length > 0
                          ? <span className="inline-block text-[10px] px-1.5 py-0.5 rounded font-semibold bg-sky-100 text-sky-800 tabular-nums">{oc.envios.length}</span>
                          : <span className="text-gray-400 text-[10.5px]">—</span>}
                      </td>
                      <td className="py-2 px-2.5 tabular-nums text-gray-700">{fmtDate(oc.fecha_recibida)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{fmtInt(oc.piezasOrd)}</td>
                      <td className="py-2 px-2.5 text-right tabular-nums">{formatMXN(oc.monto)}</td>
                      <td className="py-2 px-2.5 text-right"><FillCell oc={oc} /></td>
                      <td className="py-2 px-2.5"><ProgresoEtapas oc={oc} /></td>
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
                        <td colSpan={10} style={{ padding: 0, background: '#FCFCFD', borderBottom: '1px solid #E5E7EB' }}>
                          <DetalleOC
                            oc={oc}
                            envioAbierto={envioAbierto}
                            setEnvioAbierto={setEnvioAbierto}
                            envioSkusPorEnvio={envioSkusPorEnvio}
                            onEditarOc={() => setEditOc(oc)}
                            onEliminarOc={() => eliminarOC(oc)}
                            onNuevoEnvio={() => setEnvioModal({ ocId: oc.id, envio: null, ocContext: oc })}
                            onEditarEnvio={(env) => setEnvioModal({ ocId: oc.id, envio: env, ocContext: oc })}
                            onEliminarEnvio={eliminarEnvio}
                            onAvanzarOc={(campo) => avanzarOc(oc, campo)}
                          />
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
      {envioModal && (
        <ModalEnvio
          ocContext={envioModal.ocContext}
          envio={envioModal.envio}
          envioSkusPorEnvio={envioSkusPorEnvio}
          onClose={() => setEnvioModal(null)}
          onSaved={() => { setEnvioModal(null); cargar(); }}
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
  if (oc.piezasSur === 0) return <div className="text-[10.5px] text-gray-400 italic">Sin surtir</div>;
  const tone = oc.fillRate >= 100 ? 'text-emerald-700' : oc.fillRate >= 60 ? 'text-amber-700' : 'text-rose-700';
  return (
    <div className="flex flex-col items-end">
      <span className={`text-[13px] font-semibold tabular-nums ${tone}`}>{oc.fillRate.toFixed(1)}%</span>
      <span className="text-[10px] text-gray-500 tabular-nums">{fmtInt(oc.piezasSur)} / {fmtInt(oc.piezasOrd)} pz</span>
    </div>
  );
}

function ProgresoEtapas({ oc }) {
  const idx = oc.etapa ? ETAPAS.indexOf(oc.etapa) : -1;
  const stepColor = (i) => (idx === -1 ? '#E5E7EB' : i < idx ? '#10B981' : i === idx ? '#38BDF8' : '#E5E7EB');
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
    </div>
  );
}

// ── Detalle de OC (drill-down) ─────────────────────────────────────────────
function DetalleOC({ oc, envioAbierto, setEnvioAbierto, envioSkusPorEnvio,
  onEditarOc, onEliminarOc, onNuevoEnvio, onEditarEnvio, onEliminarEnvio, onAvanzarOc }) {

  const skus = oc.skus || [];
  const envios = oc.envios || [];
  const totalOrd = skus.reduce((s, x) => s + Number(x.cantidad_ordenada || 0), 0);
  const totalMonto = skus.reduce((s, x) => s + Number(x.cantidad_ordenada || 0) * Number(x.precio_unitario || 0), 0);
  const totalSur = oc.piezasSur;

  const puedeMarcarProcesada = oc.fecha_recibida && !oc.fecha_procesada;

  return (
    <div className="p-5 space-y-4">
      {/* Header + acciones OC */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-0.5">
            OC {oc.numero_oc_cliente} · {NOMBRE_CLIENTE[oc.cliente_key]}
          </div>
          {oc.notas && <div className="text-[12px] text-gray-600 italic">"{oc.notas}"</div>}
        </div>
        <div className="flex gap-1.5">
          <button onClick={onEditarOc} className="h-7 px-2.5 text-[11px] border border-gray-200 rounded-md bg-white hover:bg-gray-50 inline-flex items-center gap-1">
            <Edit2 className="w-3 h-3" /> Editar OC
          </button>
          <button onClick={onEliminarOc} className="h-7 px-2.5 text-[11px] border border-rose-200 rounded-md bg-white hover:bg-rose-50 text-rose-700 inline-flex items-center gap-1">
            <Trash2 className="w-3 h-3" /> Eliminar OC
          </button>
          {puedeMarcarProcesada && (
            <button onClick={() => onAvanzarOc('fecha_procesada')} className="h-7 px-3 text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 text-white rounded-md">
              Marcar como Procesada →
            </button>
          )}
        </div>
      </div>

      {/* Timeline OC (Recibida, Procesada, Surtida, Entregada — las 2 últimas derivadas de envíos) */}
      <div className="grid grid-cols-4 gap-3 pt-3 border-t border-gray-200">
        <TimelineEtapa label="Recibida" iso={oc.fecha_recibida} />
        <TimelineEtapa label="Procesada" iso={oc.fecha_procesada} />
        <TimelineEtapa label="Surtida" iso={fechaEtapaOc(oc, envios, 'surtida')}
          nota={envios.length > 0 && oc.fillRate < 100 ? `${oc.fillRate.toFixed(1)}% surtido` : null} />
        <TimelineEtapa label="Entregada" iso={fechaEtapaOc(oc, envios, 'entregada')}
          nota={envios.length > 0 && !envios.every((e) => e.fecha_entregada) ? 'Falta último envío' : null} />
      </div>

      {/* SKUs agregado */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">SKUs de la OC · agregado</span>
        </div>
        {skus.length > 0 ? (
          <table className="w-full text-[11.5px] bg-white border border-gray-200 rounded-md overflow-hidden">
            <thead className="bg-gray-50">
              <tr className="text-[9.5px] uppercase tracking-widest text-gray-500">
                <th className="py-1.5 px-2.5 text-left">SKU</th>
                <th className="py-1.5 px-2.5 text-right">Cant. ordenada</th>
                <th className="py-1.5 px-2.5 text-right">Surtida (Σ envíos)</th>
                <th className="py-1.5 px-2.5 text-right">Fill rate</th>
                <th className="py-1.5 px-2.5 text-right">Precio</th>
                <th className="py-1.5 px-2.5 text-right">Subtotal ordenado</th>
              </tr>
            </thead>
            <tbody>
              {skus.map((s) => {
                const surt = oc.surtidoPorSku[s.id] || 0;
                const fill = s.cantidad_ordenada > 0 ? (surt / Number(s.cantidad_ordenada) * 100) : 0;
                const tone = fill >= 100 ? 'text-emerald-700' : fill >= 50 ? 'text-amber-700' : fill > 0 ? 'text-rose-700' : 'text-gray-400';
                return (
                  <tr key={s.id} className="border-t border-gray-100">
                    <td className="py-1.5 px-2.5 font-mono text-gray-700">{s.sku}</td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(s.cantidad_ordenada)}</td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(surt)}</td>
                    <td className={`py-1.5 px-2.5 text-right tabular-nums font-semibold ${tone}`}>{fill.toFixed(1)}%</td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums">{formatMXN(Number(s.precio_unitario))}</td>
                    <td className="py-1.5 px-2.5 text-right tabular-nums">{formatMXN(Number(s.cantidad_ordenada) * Number(s.precio_unitario))}</td>
                  </tr>
                );
              })}
              <tr className="bg-gray-50 font-semibold">
                <td className="py-1.5 px-2.5 text-[10px] uppercase tracking-wider text-gray-600">{skus.length} SKUs</td>
                <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(totalOrd)}</td>
                <td className="py-1.5 px-2.5 text-right tabular-nums">{fmtInt(totalSur)}</td>
                <td className="py-1.5 px-2.5 text-right tabular-nums">{totalOrd > 0 ? `${(totalSur / totalOrd * 100).toFixed(1)}%` : '—'}</td>
                <td></td>
                <td className="py-1.5 px-2.5 text-right tabular-nums">{formatMXN(totalMonto)}</td>
              </tr>
            </tbody>
          </table>
        ) : (
          <div className="text-xs text-gray-400 italic">Sin SKUs capturados.</div>
        )}
      </div>

      {/* Envíos */}
      <div>
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Envíos · {envios.length} registrado{envios.length !== 1 ? 's' : ''}</span>
          <button onClick={onNuevoEnvio} disabled={skus.length === 0}
            className="h-7 px-3 text-[11px] font-semibold bg-sky-500 hover:bg-sky-600 disabled:opacity-40 text-white rounded-md inline-flex items-center gap-1">
            <Plus className="w-3 h-3" /> Nuevo envío
          </button>
        </div>
        {envios.length === 0 ? (
          <div className="text-xs text-gray-400 italic py-4 text-center bg-gray-50 rounded border border-dashed border-gray-200">
            No hay envíos registrados. {skus.length === 0 ? 'Captura primero los SKUs de la OC.' : 'Da click en "+ Nuevo envío" para agregar el primero.'}
          </div>
        ) : (
          <table className="w-full text-[11.5px] bg-white border border-gray-200 rounded-md overflow-hidden">
            <thead className="bg-gray-50">
              <tr className="text-[9.5px] uppercase tracking-widest text-gray-500">
                <th className="py-1.5 px-2 text-left" style={{ width: 24 }}></th>
                <th className="py-1.5 px-2 text-left">#</th>
                <th className="py-1.5 px-2 text-left">Almacén</th>
                <th className="py-1.5 px-2 text-left">Surtido</th>
                <th className="py-1.5 px-2 text-left">Entregado</th>
                <th className="py-1.5 px-2 text-left">Método</th>
                <th className="py-1.5 px-2 text-left">Factura</th>
                <th className="py-1.5 px-2 text-left">Guía</th>
                <th className="py-1.5 px-2 text-right">Piezas</th>
                <th className="py-1.5 px-2 text-left">Cita</th>
                <th className="py-1.5 px-2 text-left">Estatus</th>
                <th className="py-1.5 px-2 text-right"></th>
              </tr>
            </thead>
            <tbody>
              {envios.map((e) => {
                const abiertoE = envioAbierto === e.id;
                const eskus = envioSkusPorEnvio[e.id] || [];
                const pzs = eskus.reduce((s, x) => s + Number(x.cantidad_surtida || 0), 0);
                const alm = ALM_TONE[e.almacen_origen] || { bg: '#F3F4F6', text: '#6B7280' };
                const entregado = !!e.fecha_entregada;
                return (
                  <React.Fragment key={e.id}>
                    <tr className={`border-t border-gray-100 ${abiertoE ? 'bg-sky-50/60' : 'hover:bg-gray-50'}`}>
                      <td className="py-1.5 px-2 cursor-pointer" onClick={() => setEnvioAbierto(abiertoE ? null : e.id)}>
                        <ChevronRight className="w-3 h-3 text-sky-500 transition-transform"
                          style={{ transform: abiertoE ? 'rotate(90deg)' : 'none' }} />
                      </td>
                      <td className="py-1.5 px-2 tabular-nums font-semibold">{e.numero_envio}</td>
                      <td className="py-1.5 px-2">
                        <span className="inline-block text-[9px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: alm.bg, color: alm.text }}>{e.almacen_origen}</span>
                      </td>
                      <td className="py-1.5 px-2 tabular-nums text-gray-700">{fmtDate(e.fecha_surtida)}</td>
                      <td className="py-1.5 px-2 tabular-nums text-gray-700">{e.fecha_entregada ? fmtDate(e.fecha_entregada) : <span className="text-gray-400 italic">Pendiente</span>}</td>
                      <td className="py-1.5 px-2">
                        {e.metodo_envio === 'unidad_propia' && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-sky-800"><Truck className="w-3 h-3" /> Unidad propia{e.unidad_envio ? ` · ${e.unidad_envio}` : ''}</span>
                        )}
                        {e.metodo_envio === 'paqueteria' && (
                          <span className="inline-flex items-center gap-1 text-[10.5px] text-purple-800"><Package className="w-3 h-3" /> {e.paqueteria || 'Paquetería'}</span>
                        )}
                        {!e.metodo_envio && <span className="text-gray-400 italic">—</span>}
                      </td>
                      <td className="py-1.5 px-2 font-mono text-[10.5px] text-gray-700">{e.numero_factura || <span className="text-gray-400 italic font-sans">—</span>}</td>
                      <td className="py-1.5 px-2 font-mono text-[10.5px] text-gray-700">{e.guia_rastreo || <span className="text-gray-400 italic font-sans">—</span>}</td>
                      <td className="py-1.5 px-2 text-right tabular-nums">{fmtInt(pzs)}</td>
                      <td className="py-1.5 px-2">
                        {e.requiere_cita ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Con cita{e.fecha_cita ? ` · ${fmtDate(e.fecha_cita)}` : ''}</span>
                        ) : (
                          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Sin cita</span>
                        )}
                      </td>
                      <td className="py-1.5 px-2">
                        {entregado
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800">Entregado</span>
                          : e.fecha_surtida
                          ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">En tránsito</span>
                          : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">Programado</span>}
                      </td>
                      <td className="py-1.5 px-2 text-right whitespace-nowrap">
                        <button onClick={() => onEditarEnvio(e)} className="p-1 text-gray-500 hover:text-sky-600" title="Editar envío"><Edit2 className="w-3 h-3" /></button>
                        <button onClick={() => onEliminarEnvio(e)} className="p-1 text-gray-500 hover:text-rose-600" title="Eliminar envío"><Trash2 className="w-3 h-3" /></button>
                      </td>
                    </tr>
                    {abiertoE && (
                      <tr>
                        <td colSpan={12} style={{ background: '#F9FAFB', padding: '10px 14px', borderTop: '1px solid #E5E7EB' }}>
                          <div className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500 mb-1.5">SKUs de este envío</div>
                          {eskus.length === 0 ? (
                            <div className="text-xs text-gray-400 italic">Sin SKUs capturados en este envío.</div>
                          ) : (
                            <table className="w-full text-[11px] bg-white border border-gray-200 rounded">
                              <thead>
                                <tr className="text-[9px] uppercase tracking-widest text-gray-500 bg-gray-50">
                                  <th className="py-1 px-2.5 text-left">SKU</th>
                                  <th className="py-1 px-2.5 text-right">Cant. surtida</th>
                                </tr>
                              </thead>
                              <tbody>
                                {eskus.map((es) => {
                                  const skuInfo = skus.find((s) => s.id === es.oc_sku_id);
                                  return (
                                    <tr key={es.id} className="border-t border-gray-100">
                                      <td className="py-1 px-2.5 font-mono text-gray-700">{skuInfo?.sku || es.oc_sku_id}</td>
                                      <td className="py-1 px-2.5 text-right tabular-nums font-semibold">{fmtInt(es.cantidad_surtida)}</td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          {e.notas && <div className="text-[11px] text-gray-600 italic mt-2">"{e.notas}"</div>}
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function TimelineEtapa({ label, iso, nota }) {
  return (
    <div>
      <div className="text-[9.5px] uppercase tracking-widest text-gray-500">{label}</div>
      <div className={`text-[13px] font-semibold tabular-nums ${iso ? 'text-gray-800' : 'text-gray-400 font-normal'}`}>
        {iso ? fmtDateFull(iso) : 'Pendiente'}
      </div>
      {nota && <div className="text-[10px] text-amber-700 font-semibold mt-0.5">{nota}</div>}
    </div>
  );
}

// ── Modal Nueva/Editar OC ──────────────────────────────────────────────────
function ModalOC({ ocInicial, onClose, onSaved }) {
  const es = !!ocInicial;
  const [numero, setNumero] = useState(ocInicial?.numero_oc_cliente || '');
  const [cliente, setCliente] = useState(ocInicial?.cliente_key || 'digitalife');
  const [fechaRecibida, setFechaRecibida] = useState(ocInicial?.fecha_recibida ? ocInicial.fecha_recibida.slice(0, 16) : todayLocalIso());
  const [fechaProcesada, setFechaProcesada] = useState(ocInicial?.fecha_procesada ? ocInicial.fecha_procesada.slice(0, 16) : '');
  const [notas, setNotas] = useState(ocInicial?.notas || '');
  const [skus, setSkus] = useState(() => {
    if (ocInicial?.skus?.length) {
      return ocInicial.skus.map((s) => ({
        id: s.id, sku: s.sku, cantidad_ordenada: s.cantidad_ordenada, precio_unitario: s.precio_unitario,
      }));
    }
    return [{ sku: '', cantidad_ordenada: '', precio_unitario: '' }];
  });
  const [saving, setSaving] = useState(false);

  const addSku = () => setSkus([...skus, { sku: '', cantidad_ordenada: '', precio_unitario: '' }]);
  const removeSku = (i) => setSkus(skus.filter((_, j) => j !== i));
  const updateSku = (i, field, val) => setSkus(skus.map((s, j) => j === i ? { ...s, [field]: val } : s));

  const guardar = async () => {
    if (!numero.trim()) return alert('Falta el número de OC');
    if (!cliente) return alert('Falta el cliente');
    setSaving(true);
    const payload = {
      numero_oc_cliente: numero.trim(),
      cliente_key: cliente,
      fecha_recibida: toIso(fechaRecibida),
      fecha_procesada: toIso(fechaProcesada),
      notas: notas.trim() || null,
      updated_at: nowIso(),
    };

    let ocId;
    if (es) {
      const { error } = await supabase.from('oc_clientes').update(payload).eq('id', ocInicial.id);
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      ocId = ocInicial.id;
      // No borro sus SKUs si no cambiaron. Simplifico: si es edición, borro todos los que no estén en el nuevo listado.
      const nuevosIds = new Set(skus.filter((s) => s.id).map((s) => s.id));
      const originales = (ocInicial.skus || []).map((s) => s.id);
      const aBorrar = originales.filter((id) => !nuevosIds.has(id));
      if (aBorrar.length > 0) {
        await supabase.from('oc_clientes_skus').delete().in('id', aBorrar);
      }
    } else {
      const { data, error } = await supabase.from('oc_clientes').insert(payload).select('id').single();
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      ocId = data.id;
    }

    // Upsert/insert SKUs
    for (const s of skus) {
      if (!s.sku || !s.sku.trim()) continue;
      const row = {
        oc_id: ocId,
        sku: s.sku.trim(),
        cantidad_ordenada: Number(s.cantidad_ordenada) || 0,
        precio_unitario: Number(s.precio_unitario) || 0,
      };
      if (s.id) {
        await supabase.from('oc_clientes_skus').update(row).eq('id', s.id);
      } else {
        await supabase.from('oc_clientes_skus').insert(row);
      }
    }
    setSaving(false);
    onSaved();
  };

  return (
    <ModalShell title={es ? 'Editar OC' : 'Nueva OC de cliente'} onClose={onClose} onGuardar={guardar} saving={saving} ctaLabel={es ? 'Actualizar OC' : 'Crear OC'}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Número de OC del cliente *">
          <input value={numero} onChange={(e) => setNumero(e.target.value)} placeholder="ej. OC-24891" className="input" />
        </Field>
        <Field label="Cliente *">
          <select value={cliente} onChange={(e) => setCliente(e.target.value)} className="input">
            {CLIENTES.map((c) => <option key={c.key} value={c.key}>{c.nombre}</option>)}
          </select>
        </Field>
        <Field label="Fecha recibida">
          <input type="datetime-local" value={fechaRecibida} onChange={(e) => setFechaRecibida(e.target.value)} className="input" />
        </Field>
        <Field label="Fecha procesada">
          <input type="datetime-local" value={fechaProcesada} onChange={(e) => setFechaProcesada(e.target.value)} className="input" />
        </Field>
        <Field label="Notas" className="col-span-2">
          <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones internas…" className="input" />
        </Field>
      </div>

      <div className="border border-gray-200 rounded-lg p-3 space-y-2 mt-4">
        <div className="flex items-center justify-between">
          <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">SKUs de la OC (lo que pidió el cliente)</div>
          <button onClick={addSku} className="text-[11px] text-sky-600 font-semibold">+ Agregar SKU</button>
        </div>
        <div className="grid grid-cols-[1.4fr_0.8fr_0.8fr_28px] gap-2 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
          <span>SKU</span>
          <span className="text-right">Cant. ordenada</span>
          <span className="text-right">Precio unitario</span>
          <span></span>
        </div>
        {skus.map((s, i) => (
          <div key={i} className="grid grid-cols-[1.4fr_0.8fr_0.8fr_28px] gap-2 items-center">
            <input value={s.sku} onChange={(e) => updateSku(i, 'sku', e.target.value)} placeholder="ej. AC-935845" className="input" />
            <input type="number" value={s.cantidad_ordenada} onChange={(e) => updateSku(i, 'cantidad_ordenada', e.target.value)} className="input text-right" />
            <input type="number" step="0.01" value={s.precio_unitario} onChange={(e) => updateSku(i, 'precio_unitario', e.target.value)} className="input text-right" />
            <button onClick={() => removeSku(i)} className="text-rose-500 hover:text-rose-700"><X className="w-4 h-4" /></button>
          </div>
        ))}
      </div>
    </ModalShell>
  );
}

// ── Modal Nuevo/Editar Envío ───────────────────────────────────────────────
function ModalEnvio({ ocContext, envio, envioSkusPorEnvio, onClose, onSaved }) {
  const es = !!envio;
  const skus = ocContext.skus || [];
  const [almacen, setAlmacen] = useState(envio?.almacen_origen || 'GDL');
  const [fechaSurtida, setFechaSurtida] = useState(envio?.fecha_surtida ? envio.fecha_surtida.slice(0, 16) : todayLocalIso());
  const [fechaEntregada, setFechaEntregada] = useState(envio?.fecha_entregada ? envio.fecha_entregada.slice(0, 16) : '');
  const [metodoEnvio, setMetodoEnvio] = useState(envio?.metodo_envio || 'unidad_propia');
  const [paqueteria, setPaqueteria] = useState(envio?.paqueteria || '');
  const [unidadEnvio, setUnidadEnvio] = useState(envio?.unidad_envio || '');
  const [numFactura, setNumFactura] = useState(envio?.numero_factura || '');
  const [guia, setGuia] = useState(envio?.guia_rastreo || '');
  const [requiereCita, setRequiereCita] = useState(!!envio?.requiere_cita);
  const [fechaCita, setFechaCita] = useState(envio?.fecha_cita ? envio.fecha_cita.slice(0, 16) : '');
  const [notas, setNotas] = useState(envio?.notas || '');

  // Cantidades surtidas por SKU (inicializado desde envio_skus si existe)
  const [cantidades, setCantidades] = useState(() => {
    const map = {};
    if (es) {
      const es_ = envioSkusPorEnvio[envio.id] || [];
      for (const x of es_) map[x.oc_sku_id] = x.cantidad_surtida;
    }
    return map;
  });
  const setCant = (skuId, val) => setCantidades((c) => ({ ...c, [skuId]: val }));

  const [saving, setSaving] = useState(false);

  // Restante por SKU (ya surtido en OTROS envíos)
  const surtidoOtrosEnvios = useMemo(() => {
    const acc = {};
    for (const otroEnvio of (ocContext.envios || [])) {
      if (es && otroEnvio.id === envio.id) continue;
      const eskus = envioSkusPorEnvio[otroEnvio.id] || [];
      for (const x of eskus) {
        acc[x.oc_sku_id] = (acc[x.oc_sku_id] || 0) + Number(x.cantidad_surtida || 0);
      }
    }
    return acc;
  }, [ocContext.envios, envioSkusPorEnvio, envio, es]);

  const guardar = async () => {
    if (!almacen) return alert('Falta almacén de origen');
    setSaving(true);

    let envioId;
    if (es) {
      const { error } = await supabase.from('oc_envios').update({
        almacen_origen: almacen,
        fecha_surtida: toIso(fechaSurtida),
        fecha_entregada: toIso(fechaEntregada),
        metodo_envio: metodoEnvio,
        paqueteria: metodoEnvio === 'paqueteria' ? (paqueteria || null) : null,
        unidad_envio: metodoEnvio === 'unidad_propia' ? (unidadEnvio.trim() || null) : null,
        numero_factura: numFactura.trim() || null,
        guia_rastreo: guia.trim() || null,
        requiere_cita: requiereCita,
        fecha_cita: requiereCita ? toIso(fechaCita) : null,
        notas: notas.trim() || null,
        updated_at: nowIso(),
      }).eq('id', envio.id);
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      envioId = envio.id;
      // Borro los envío_skus previos y reinserto
      await supabase.from('oc_envio_skus').delete().eq('envio_id', envioId);
    } else {
      // Calcular próximo numero_envio
      const nextNum = ((ocContext.envios || []).reduce((m, e) => Math.max(m, e.numero_envio || 0), 0)) + 1;
      const { data, error } = await supabase.from('oc_envios').insert({
        oc_id: ocContext.id,
        numero_envio: nextNum,
        almacen_origen: almacen,
        fecha_surtida: toIso(fechaSurtida),
        fecha_entregada: toIso(fechaEntregada),
        metodo_envio: metodoEnvio,
        paqueteria: metodoEnvio === 'paqueteria' ? (paqueteria || null) : null,
        unidad_envio: metodoEnvio === 'unidad_propia' ? (unidadEnvio.trim() || null) : null,
        numero_factura: numFactura.trim() || null,
        guia_rastreo: guia.trim() || null,
        requiere_cita: requiereCita,
        fecha_cita: requiereCita ? toIso(fechaCita) : null,
        notas: notas.trim() || null,
      }).select('id').single();
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      envioId = data.id;
    }

    // Insertar cantidades > 0
    const rows = Object.entries(cantidades)
      .map(([oc_sku_id, cant]) => ({ envio_id: envioId, oc_sku_id, cantidad_surtida: Number(cant) || 0 }))
      .filter((r) => r.cantidad_surtida > 0);
    if (rows.length > 0) {
      const { error } = await supabase.from('oc_envio_skus').insert(rows);
      if (error) { setSaving(false); return alert('Error SKUs envío: ' + error.message); }
    }

    setSaving(false);
    onSaved();
  };

  return (
    <ModalShell title={es ? `Editar envío #${envio.numero_envio}` : 'Nuevo envío'} onClose={onClose} onGuardar={guardar} saving={saving} ctaLabel={es ? 'Actualizar envío' : 'Crear envío'}>
      {/* Almacén */}
      <Field label="Almacén de origen *">
        <div className="flex gap-2">
          {ALMACENES.map((a) => (
            <button key={a} onClick={() => setAlmacen(a)}
              className={`h-9 px-4 rounded-lg text-sm font-semibold border ${almacen === a
                ? 'bg-sky-500 border-sky-500 text-white'
                : 'bg-white border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
              {a}
            </button>
          ))}
        </div>
      </Field>

      {/* Fechas */}
      <div className="grid grid-cols-2 gap-3 mt-4">
        <Field label="Fecha surtida">
          <input type="datetime-local" value={fechaSurtida} onChange={(e) => setFechaSurtida(e.target.value)} className="input" />
        </Field>
        <Field label="Fecha entregada">
          <input type="datetime-local" value={fechaEntregada} onChange={(e) => setFechaEntregada(e.target.value)} className="input" />
        </Field>
      </div>

      {/* Envío */}
      <div className="border border-gray-200 rounded-lg p-3 space-y-3 mt-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500">Método de envío</div>
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
            <input value={unidadEnvio} onChange={(e) => setUnidadEnvio(e.target.value)} placeholder="ej. Camión Acteck #4" className="input" />
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
        <div className="grid grid-cols-2 gap-3">
          <Field label="Número de factura">
            <input value={numFactura} onChange={(e) => setNumFactura(e.target.value)} placeholder="ej. FA-08421" className="input" />
          </Field>
          <Field label="Guía / rastreo (paquetería)">
            <input value={guia} onChange={(e) => setGuia(e.target.value)} placeholder="ej. 1Z9877W..." className="input" />
          </Field>
        </div>
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

      {/* Cantidades por SKU */}
      <div className="border border-gray-200 rounded-lg p-3 mt-3">
        <div className="text-[10px] uppercase tracking-widest font-semibold text-gray-500 mb-2">Cantidades surtidas en este envío</div>
        {skus.length === 0 ? (
          <div className="text-xs text-gray-400 italic">La OC no tiene SKUs capturados.</div>
        ) : (
          <div className="space-y-1.5">
            <div className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.7fr] gap-2 text-[10px] uppercase tracking-widest text-gray-400 font-semibold">
              <span>SKU</span>
              <span className="text-right">Ordenada</span>
              <span className="text-right">Ya en otros envíos</span>
              <span className="text-right">Este envío</span>
            </div>
            {skus.map((s) => {
              const otros = surtidoOtrosEnvios[s.id] || 0;
              const restante = Math.max(0, Number(s.cantidad_ordenada || 0) - otros);
              return (
                <div key={s.id} className="grid grid-cols-[1.4fr_0.6fr_0.6fr_0.7fr] gap-2 items-center">
                  <span className="font-mono text-[11.5px] text-gray-700">{s.sku}</span>
                  <span className="text-right tabular-nums text-[11.5px]">{fmtInt(s.cantidad_ordenada)}</span>
                  <span className="text-right tabular-nums text-[11.5px] text-gray-500">{fmtInt(otros)} <span className="text-gray-400 text-[10px]">(quedan {fmtInt(restante)})</span></span>
                  <input type="number" min="0" value={cantidades[s.id] ?? ''}
                    onChange={(e) => setCant(s.id, e.target.value)}
                    className="input text-right" placeholder="0" />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Notas */}
      <Field label="Notas del envío" className="mt-3">
        <input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones del envío…" className="input" />
      </Field>
    </ModalShell>
  );
}

// ── Modal shell y Field ────────────────────────────────────────────────────
function ModalShell({ title, onClose, onGuardar, saving, ctaLabel, children }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded"><X className="w-5 h-5 text-gray-500" /></button>
        </div>
        <div className="overflow-auto p-5 space-y-3">{children}</div>
        <div className="flex justify-end gap-2 p-4 border-t border-gray-200">
          <button onClick={onClose} className="h-9 px-4 border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-sm">Cancelar</button>
          <button onClick={onGuardar} disabled={saving}
            className="h-9 px-5 bg-sky-500 hover:bg-sky-600 disabled:opacity-50 text-white rounded-lg text-sm font-semibold">
            {saving ? 'Guardando…' : ctaLabel}
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
