import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaGlobal } from '../../lib/permisos';
import { toast } from '../../lib/toast';
import { formatMXN } from '../../lib/utils';
import {
  FileCheck, Plus, Upload, Search, X, ChevronDown, ChevronUp, Edit3, Trash2,
  RefreshCw, AlertTriangle, CheckCircle2, Clock, FileText, FileSpreadsheet,
  Package, DollarSign,
} from 'lucide-react';
import { parseDigitalifeExcel, parsePCELPdf } from './parsersOC';

/**
 * Órdenes de Compra — Sprint 3
 * ─────────────────────────────
 * - Carga OCs de PCEL (PDF) y Digitalife (Excel con colores = facturas)
 * - Cruce automático con ventas_erp por referencia de OC
 * - Fill rate: verde ≥90%, amarillo 70-89%, rojo <70%
 * - Auto-cierre: 15 días + ≥95% surtido = completa (trigger SQL)
 */

const CLIENTES_OC = [
  { key: 'digitalife', full: 'Digitalife', color: '#3B82F6' },
  { key: 'pcel',       full: 'PCEL',       color: '#EF4444' },
];

const ESTADOS = {
  abierta:   { label: 'Abierta',   bg: 'bg-gray-100',  text: 'text-gray-700',  dot: '#6B7280' },
  parcial:   { label: 'Parcial',   bg: 'bg-amber-100', text: 'text-amber-700', dot: '#F59E0B' },
  completa:  { label: 'Completa',  bg: 'bg-green-100', text: 'text-green-700', dot: '#10B981' },
  vencida:   { label: 'Vencida',   bg: 'bg-red-100',   text: 'text-red-700',   dot: '#DC2626' },
  cancelada: { label: 'Cancelada', bg: 'bg-slate-100', text: 'text-slate-500', dot: '#64748B' },
};

const colorFillRate = (pct) => {
  if (pct == null) return '#94A3B8';
  if (pct >= 90) return '#10B981';
  if (pct >= 70) return '#F59E0B';
  return '#EF4444';
};

// ────────── Hook ──────────
function useOCData() {
  const [state, setState] = useState({ loading: true, ocs: [], detalles: [] });

  const reload = async () => {
    setState(s => ({ ...s, loading: true }));
    const [ocRes, detRes] = await Promise.all([
      supabase.from('ordenes_compra').select('*').order('fecha_oc', { ascending: false }),
      supabase.from('ordenes_compra_detalle').select('*'),
    ]);
    setState({
      loading: false,
      ocs: ocRes.data || [],
      detalles: detRes.data || [],
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload };
}

// ────────── Helpers ──────────
const FMT_N   = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_MXN = (n) => formatMXN(n || 0);
function fmtFecha(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${y}`;
}
function diasDesde(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return Math.floor((new Date() - d) / 86400000);
}

// ────────── Componente principal ──────────
export default function OrdenesCompraTab() {
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaGlobal(perfil, 'ordenes_compra');
  const data = useOCData();

  const [busqueda, setBusqueda] = useState('');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroEstado, setFiltroEstado] = useState('activas'); // activas | todas | completa | vencida
  const [expandedOcId, setExpandedOcId] = useState(null);
  const [modal, setModal] = useState(null);  // {tipo: 'manual'|'digitalife'|'pcel'} o {edit: oc}
  const [refreshing, setRefreshing] = useState(false);

  // Detalle indexado
  const detallesPorOc = useMemo(() => {
    const m = {};
    data.detalles.forEach(d => {
      if (!m[d.oc_id]) m[d.oc_id] = [];
      m[d.oc_id].push(d);
    });
    return m;
  }, [data.detalles]);

  const ocsFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return data.ocs.filter(o => {
      if (q) {
        const txt = `${o.oc_numero} ${o.proveedor || ''} ${o.notas || ''}`.toLowerCase();
        const detTxt = (detallesPorOc[o.id] || []).map(d => `${d.sku} ${d.descripcion||''}`).join(' ').toLowerCase();
        if (!txt.includes(q) && !detTxt.includes(q)) return false;
      }
      if (filtroCliente !== 'todos' && o.cliente !== filtroCliente) return false;
      if (filtroEstado === 'activas' && ['completa','cancelada'].includes(o.estado)) return false;
      if (filtroEstado !== 'todas' && filtroEstado !== 'activas' && o.estado !== filtroEstado) return false;
      return true;
    });
  }, [data.ocs, detallesPorOc, busqueda, filtroCliente, filtroEstado]);

  // KPIs
  const kpis = useMemo(() => {
    const abiertas = data.ocs.filter(o => ['abierta','parcial'].includes(o.estado));
    const vencidas = data.ocs.filter(o => o.estado === 'vencida');
    const parciales = data.ocs.filter(o => o.estado === 'parcial');

    const valorAbierto = abiertas.reduce((a, o) => {
      const dets = detallesPorOc[o.id] || [];
      return a + dets.reduce((b, d) => b + Number(d.cantidad - d.cantidad_surtida) * Number(d.costo_unitario || 0), 0);
    }, 0);

    // Fill rate global: facturado total / OC total × 100 (últimos 60 días)
    const hace60 = new Date(); hace60.setDate(hace60.getDate() - 60);
    const ocsRecientes = data.ocs.filter(o => new Date(o.fecha_oc) >= hace60 && o.estado !== 'cancelada');
    let sumaOC = 0, sumaFacturado = 0;
    ocsRecientes.forEach(o => {
      (detallesPorOc[o.id] || []).forEach(d => {
        sumaOC += Number(d.cantidad || 0);
        sumaFacturado += Number(d.cantidad_surtida || 0);
      });
    });
    const fillRateGlobal = sumaOC > 0 ? (sumaFacturado / sumaOC) * 100 : null;

    return {
      totalAbiertas: abiertas.length,
      vencidas: vencidas.length,
      parciales: parciales.length,
      valorAbierto,
      fillRateGlobal,
    };
  }, [data.ocs, detallesPorOc]);

  async function actualizarFillRates() {
    if (!canEdit || refreshing) return;
    setRefreshing(true);
    const { data: rpcData, error } = await supabase.rpc('actualizar_fill_rate_todas');
    setRefreshing(false);
    if (error) { toast.error('Error: ' + error.message); return; }
    const n = (rpcData || []).reduce((a, r) => a + (r.skus_actualizados || 0), 0);
    toast.success(`${n} líneas actualizadas contra ventas ERP`);
    data.reload();
  }

  async function borrarOC(id) {
    if (!canEdit) return;
    if (!confirm('¿Eliminar esta OC? El detalle también se borra.')) return;
    const { error } = await supabase.from('ordenes_compra').delete().eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('OC eliminada');
    data.reload();
  }

  if (data.loading) return <div className="p-6 text-gray-400">Cargando órdenes de compra…</div>;

  return (
    <div className="p-6 space-y-5">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <FileCheck className="w-6 h-6 text-gray-700" />
            Órdenes de Compra
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            OCs recibidas de clientes · Cruce con ERP · Fill rate
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={actualizarFillRates}
                disabled={refreshing}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-1.5 disabled:opacity-50"
                title="Cruzar con ventas_erp y actualizar cantidades surtidas"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                {refreshing ? 'Cruzando…' : 'Cruzar con ERP'}
              </button>
              <NuevaOCDropdown onSelect={(tipo) => setModal({ tipo })} />
            </>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiCard icon={FileCheck} label="OCs abiertas" value={kpis.totalAbiertas} color="#3B82F6" />
        <KpiCard
          icon={CheckCircle2}
          label="Fill rate 60d"
          value={kpis.fillRateGlobal != null ? `${kpis.fillRateGlobal.toFixed(0)}%` : '—'}
          color={colorFillRate(kpis.fillRateGlobal)}
        />
        <KpiCard icon={DollarSign} label="Valor abierto" value={FMT_MXN(kpis.valorAbierto)} color="#10B981" small />
        <KpiCard icon={Clock} label="Parciales" value={kpis.parciales} color="#F59E0B" />
        <KpiCard icon={AlertTriangle} label="Vencidas" value={kpis.vencidas} color="#EF4444" />
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar OC, SKU o proveedor…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white" />
          {busqueda && <button onClick={() => setBusqueda('')} className="absolute right-2 top-2 text-gray-400"><X className="w-3.5 h-3.5"/></button>}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{id:'todos',label:'Todos'}, ...CLIENTES_OC.map(c => ({id:c.key, label:c.full}))].map(c => (
            <button key={c.id} onClick={() => setFiltroCliente(c.id)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition',
                filtroCliente === c.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'activas',   label: 'Activas' },
            { id: 'parcial',   label: 'Parciales' },
            { id: 'vencida',   label: 'Vencidas' },
            { id: 'completa',  label: 'Completas' },
            { id: 'todas',     label: 'Todas' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroEstado(f.id)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition',
                filtroEstado === f.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}>
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">{ocsFiltradas.length} OCs</span>
      </div>

      {/* LISTA DE OCs */}
      {ocsFiltradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <FileCheck className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin órdenes de compra con los filtros actuales</p>
          {canEdit && data.ocs.length === 0 && (
            <p className="text-xs text-gray-400 mt-2">
              Agrega tu primera OC usando el botón "Nueva OC"
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {ocsFiltradas.map(oc => (
            <OCCard
              key={oc.id}
              oc={oc}
              detalles={detallesPorOc[oc.id] || []}
              expanded={expandedOcId === oc.id}
              onToggle={() => setExpandedOcId(expandedOcId === oc.id ? null : oc.id)}
              onEditar={canEdit ? () => setModal({ edit: oc }) : null}
              onBorrar={canEdit ? () => borrarOC(oc.id) : null}
            />
          ))}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <ModalOC
          data={modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); data.reload(); }}
        />
      )}
    </div>
  );
}

// ────────── KPI Card ──────────
function KpiCard({ icon: Icon, label, value, color, small }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${color}22`, color }}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <div className="text-[11px] text-gray-500 truncate">{label}</div>
        <div className={small ? 'font-bold text-gray-800 text-sm truncate' : 'font-bold text-gray-800 text-lg'}>{value}</div>
      </div>
    </div>
  );
}

// ────────── Nueva OC dropdown ──────────
function NuevaOCDropdown({ onSelect }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Nueva OC <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-40 bg-white rounded-xl shadow-lg border border-gray-200 w-56 py-1">
            <button onClick={() => { onSelect('pcel'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-sm">
              <FileText className="w-4 h-4 text-red-500" />
              <div>
                <div className="font-medium">PCEL (PDF)</div>
                <div className="text-[11px] text-gray-500">Relación de OCs</div>
              </div>
            </button>
            <button onClick={() => { onSelect('digitalife'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-sm">
              <FileSpreadsheet className="w-4 h-4 text-blue-500" />
              <div>
                <div className="font-medium">Digitalife (Excel)</div>
                <div className="text-[11px] text-gray-500">Pedido con facturación por fechas</div>
              </div>
            </button>
            <div className="border-t border-gray-100 my-1"/>
            <button onClick={() => { onSelect('manual'); setOpen(false); }}
              className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-center gap-2 text-sm">
              <Edit3 className="w-4 h-4 text-gray-500" />
              <div>
                <div className="font-medium">Manual</div>
                <div className="text-[11px] text-gray-500">Capturar línea por línea</div>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ────────── OC Card ──────────
function OCCard({ oc, detalles, expanded, onToggle, onEditar, onBorrar }) {
  const cliente = CLIENTES_OC.find(c => c.key === oc.cliente);
  const estado = ESTADOS[oc.estado] || ESTADOS.abierta;

  const totCant = detalles.reduce((a, d) => a + Number(d.cantidad || 0), 0);
  const totSurt = detalles.reduce((a, d) => a + Number(d.cantidad_surtida || 0), 0);
  const fillRate = totCant > 0 ? (totSurt / totCant) * 100 : 0;

  return (
    <div
      className="bg-white rounded-xl border border-gray-200 overflow-hidden"
      style={{ borderLeft: `4px solid ${cliente?.color || '#94A3B8'}` }}
    >
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-gray-800">OC #{oc.oc_numero}</span>
            <span className="text-xs font-semibold px-1.5 py-0.5 rounded uppercase"
              style={{ backgroundColor: `${cliente?.color}22`, color: cliente?.color }}>
              {cliente?.full || oc.cliente}
            </span>
            <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${estado.bg} ${estado.text}`}>
              {estado.label}
            </span>
            {oc.proveedor && (
              <span className="text-xs text-gray-500">· {oc.proveedor}</span>
            )}
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
            <span>{fmtFecha(oc.fecha_oc)}</span>
            {oc.fecha_esperada && <span>ETA {fmtFecha(oc.fecha_esperada)}</span>}
            <span>{detalles.length} SKU{detalles.length !== 1 ? 's' : ''} · {FMT_N(totCant)} piezas</span>
            <span className="font-semibold">{FMT_MXN(oc.total_importe)}</span>
          </div>
        </div>

        {/* Fill rate bar */}
        <div className="w-32 shrink-0">
          <div className="text-[10px] text-gray-500 mb-0.5 flex justify-between">
            <span>Fill rate</span>
            <span className="font-semibold" style={{ color: colorFillRate(fillRate) }}>
              {fillRate.toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full transition-all" style={{ width: `${Math.min(100, fillRate)}%`, backgroundColor: colorFillRate(fillRate) }} />
          </div>
        </div>

        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400"/> : <ChevronDown className="w-4 h-4 text-gray-400"/>}
      </button>

      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/30 p-4 space-y-3">
          {/* Info header */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            <Info label="OC #" value={oc.oc_numero} />
            <Info label="Fecha OC" value={fmtFecha(oc.fecha_oc)} />
            <Info label="Fecha esperada" value={fmtFecha(oc.fecha_esperada)} />
            <Info label="Autorizada" value={oc.autorizada ? 'Sí' : 'No'} />
            <Info label="Plazo" value={oc.plazo_dias ? `${oc.plazo_dias} días` : '—'} />
            <Info label="Moneda" value={oc.moneda} />
            <Info label="Tipo cambio" value={oc.tipo_cambio} />
            <Info label="Fuente" value={oc.fuente || 'manual'} />
            <Info label="Lugar entrega" value={oc.lugar_entrega || '—'} cols={2} />
          </div>

          {/* Tabla detalle */}
          <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left px-3 py-2">SKU</th>
                  <th className="text-left px-3 py-2 min-w-[180px]">Descripción</th>
                  <th className="text-right px-2 py-2">Cant OC</th>
                  <th className="text-right px-2 py-2">Surtido</th>
                  <th className="text-right px-2 py-2">Fill Rate</th>
                  <th className="text-right px-2 py-2">Costo</th>
                  <th className="text-right px-2 py-2">Total</th>
                  <th className="text-left px-2 py-2">Facturación esperada</th>
                </tr>
              </thead>
              <tbody>
                {detalles.map(d => {
                  const fr = Number(d.fill_rate || 0);
                  const pendiente = Math.max(0, Number(d.cantidad) - Number(d.cantidad_surtida));
                  return (
                    <tr key={d.id} className="border-t border-gray-100">
                      <td className="px-3 py-2 font-mono text-xs font-semibold">{d.sku}</td>
                      <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[250px]" title={d.descripcion}>{d.descripcion || '—'}</td>
                      <td className="text-right px-2 py-2 tabular-nums">{FMT_N(d.cantidad)}</td>
                      <td className="text-right px-2 py-2 tabular-nums">
                        {FMT_N(d.cantidad_surtida)}
                        {pendiente > 0 && <div className="text-[9px] text-gray-400">faltan {FMT_N(pendiente)}</div>}
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums font-semibold" style={{ color: colorFillRate(fr) }}>
                        {fr.toFixed(0)}%
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums text-xs text-gray-600">
                        {d.costo_unitario ? FMT_MXN(Number(d.costo_unitario)) : '—'}
                      </td>
                      <td className="text-right px-2 py-2 tabular-nums font-semibold">
                        {FMT_MXN(d.total || Number(d.cantidad) * Number(d.costo_unitario || 0))}
                      </td>
                      <td className="px-2 py-2 text-[10px] text-gray-500">
                        {Array.isArray(d.facturacion_esperada) && d.facturacion_esperada.length > 0 ? (
                          <div className="space-y-0.5">
                            {d.facturacion_esperada.map((f, i) => (
                              <div key={i} className="flex items-center gap-1">
                                {f.color && <span className="w-2 h-2 rounded-sm" style={{ backgroundColor: f.color }}/>}
                                <span>{f.fecha}: {FMT_N(f.cantidad)}</span>
                              </div>
                            ))}
                          </div>
                        ) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Acciones */}
          {(onEditar || onBorrar) && (
            <div className="flex items-center gap-2">
              {onEditar && (
                <button onClick={onEditar} className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50">
                  <Edit3 className="w-3 h-3" /> Editar
                </button>
              )}
              {onBorrar && (
                <button onClick={onBorrar} className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50">
                  <Trash2 className="w-3 h-3" /> Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Info({ label, value, cols = 1 }) {
  return (
    <div className={cols === 2 ? 'col-span-2' : ''}>
      <div className="text-[10px] uppercase text-gray-500 tracking-wide">{label}</div>
      <div className="font-medium text-gray-800 text-xs">{value || '—'}</div>
    </div>
  );
}

// ────────── Modal de upload / edición ──────────
function ModalOC({ data, onClose, onSaved }) {
  const perfil = usePerfil();
  const editing = data.edit;
  const tipo = data.tipo || (editing ? 'manual' : 'manual');

  const [header, setHeader] = useState(() => editing ? {
    cliente: editing.cliente,
    oc_numero: editing.oc_numero,
    fecha_oc: editing.fecha_oc?.slice(0, 10) || '',
    fecha_esperada: editing.fecha_esperada?.slice(0, 10) || '',
    proveedor: editing.proveedor || '',
    moneda: editing.moneda || 'MXN',
    tipo_cambio: editing.tipo_cambio || 1,
    iva_pct: editing.iva_pct || 16,
    plazo_dias: editing.plazo_dias || 0,
    autorizada: editing.autorizada ?? true,
    lugar_entrega: editing.lugar_entrega || '',
    notas: editing.notas || '',
  } : {
    cliente: tipo === 'pcel' ? 'pcel' : tipo === 'digitalife' ? 'digitalife' : 'pcel',
    oc_numero: '',
    fecha_oc: new Date().toISOString().slice(0, 10),
    fecha_esperada: '',
    proveedor: '',
    moneda: 'MXN',
    tipo_cambio: 1,
    iva_pct: 16,
    plazo_dias: 0,
    autorizada: true,
    lugar_entrega: '',
    notas: '',
  });

  const [lineas, setLineas] = useState([]);
  const [cargandoDetalle, setCargandoDetalle] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [archivo, setArchivo] = useState(null);
  const [preview, setPreview] = useState(null);   // { header, lineas, warnings }
  const [parseError, setParseError] = useState(null);

  // Cargar detalle si editing
  useEffect(() => {
    if (!editing) return;
    setCargandoDetalle(true);
    supabase.from('ordenes_compra_detalle')
      .select('*').eq('oc_id', editing.id)
      .then(({ data: d }) => {
        setLineas((d || []).map(r => ({
          _temp: `e_${r.id}`,
          id: r.id,
          sku: r.sku,
          descripcion: r.descripcion || '',
          cantidad: r.cantidad,
          cantidad_surtida: r.cantidad_surtida || 0,
          costo_unitario: r.costo_unitario || 0,
          facturacion_esperada: r.facturacion_esperada || [],
        })));
        setCargandoDetalle(false);
      });
  }, [editing]);

  async function manejarArchivo(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    setArchivo(f);
    setParseError(null);
    try {
      const buf = await f.arrayBuffer();
      let parsed;
      if (tipo === 'pcel') {
        parsed = await parsePCELPdf(buf);
      } else if (tipo === 'digitalife') {
        parsed = await parseDigitalifeExcel(buf);
      }
      if (!parsed || !parsed.lineas || parsed.lineas.length === 0) {
        setParseError('No se pudieron extraer líneas del archivo. Revisa que el formato sea correcto.');
        return;
      }
      setPreview(parsed);
      // Merge en el header
      setHeader(h => ({ ...h, ...parsed.header }));
      setLineas(parsed.lineas.map((l, i) => ({ _temp: `p_${i}`, ...l, cantidad_surtida: 0 })));
    } catch (err) {
      console.error(err);
      setParseError('Error al parsear: ' + err.message);
    }
  }

  const agregarLinea = () => {
    setLineas(prev => [...prev, {
      _temp: `n_${Math.random().toString(36).slice(2, 10)}`,
      sku: '', descripcion: '', cantidad: 0, cantidad_surtida: 0, costo_unitario: 0,
      facturacion_esperada: [],
    }]);
  };
  const actualizarLinea = (tempId, patch) => {
    setLineas(prev => prev.map(l => l._temp === tempId ? { ...l, ...patch } : l));
  };
  const quitarLinea = (tempId) => setLineas(prev => prev.filter(l => l._temp !== tempId));

  async function guardar() {
    if (!header.oc_numero.trim()) return toast.error('Falta número de OC');
    if (!header.fecha_oc) return toast.error('Falta fecha');
    const lineasValidas = lineas.filter(l => l.sku && Number(l.cantidad) > 0);
    if (lineasValidas.length === 0) return toast.error('Agrega al menos una línea con SKU y cantidad');

    setGuardando(true);
    const totCant = lineasValidas.reduce((a, l) => a + Number(l.cantidad || 0), 0);
    const totImp  = lineasValidas.reduce((a, l) => a + Number(l.cantidad) * Number(l.costo_unitario || 0), 0);

    const payload = {
      cliente: header.cliente,
      oc_numero: header.oc_numero.trim(),
      fecha_oc: header.fecha_oc,
      fecha_esperada: header.fecha_esperada || null,
      proveedor: header.proveedor.trim() || null,
      moneda: header.moneda,
      tipo_cambio: Number(header.tipo_cambio) || 1,
      iva_pct: Number(header.iva_pct) || null,
      plazo_dias: Number(header.plazo_dias) || null,
      autorizada: header.autorizada,
      lugar_entrega: header.lugar_entrega.trim() || null,
      fuente: tipo === 'manual' ? 'manual' : `${tipo}_${archivo ? archivo.name.split('.').pop() : ''}`,
      notas: header.notas.trim() || null,
      total_cantidad: totCant,
      total_importe: totImp,
    };

    let ocId = editing?.id;
    if (editing) {
      const { error } = await supabase.from('ordenes_compra').update(payload).eq('id', ocId);
      if (error) { setGuardando(false); return toast.error('Error: ' + error.message); }
    } else {
      payload.creado_por = perfil?.user_id || null;
      const { data: ins, error } = await supabase.from('ordenes_compra').insert(payload).select().single();
      if (error) { setGuardando(false); return toast.error('Error: ' + error.message); }
      ocId = ins.id;
    }

    // Detalle: borro existentes y reinserto (simple)
    if (editing) {
      await supabase.from('ordenes_compra_detalle').delete().eq('oc_id', ocId);
    }
    const rows = lineasValidas.map(l => ({
      oc_id: ocId,
      sku: String(l.sku).trim(),
      descripcion: l.descripcion || null,
      cantidad: Number(l.cantidad) || 0,
      cantidad_surtida: Number(l.cantidad_surtida) || 0,
      costo_unitario: Number(l.costo_unitario) || null,
      total: Number(l.cantidad) * Number(l.costo_unitario || 0) || null,
      facturacion_esperada: Array.isArray(l.facturacion_esperada) ? l.facturacion_esperada : [],
    }));
    const { error: errDet } = await supabase.from('ordenes_compra_detalle').insert(rows);
    if (errDet) { setGuardando(false); return toast.error('Error en detalle: ' + errDet.message); }

    // Auto-cruzar con ERP al crear
    if (!editing) {
      try { await supabase.rpc('actualizar_fill_rate_oc', { p_oc_id: ocId }); } catch {}
    }

    setGuardando(false);
    toast.success(editing ? 'OC actualizada' : 'OC creada y cruzada con ERP');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
        {/* Header modal */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileCheck className="w-4 h-4" />
            {editing ? `Editar OC #${editing.oc_numero}` :
              tipo === 'pcel'       ? 'Nueva OC PCEL (PDF)' :
              tipo === 'digitalife' ? 'Nueva OC Digitalife (Excel)' :
                                      'Nueva OC manual'}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Upload file para PCEL/Digitalife */}
          {!editing && (tipo === 'pcel' || tipo === 'digitalife') && (
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
              <label className="cursor-pointer block">
                <div className="flex items-center gap-3">
                  <Upload className="w-5 h-5 text-blue-600 shrink-0"/>
                  <div className="flex-1 text-sm">
                    <div className="font-medium text-blue-900">
                      {tipo === 'pcel' ? 'Subir PDF de OC PCEL' : 'Subir Excel de OC Digitalife'}
                    </div>
                    <div className="text-xs text-blue-700">
                      {archivo ? archivo.name : 'Click para seleccionar archivo'}
                    </div>
                  </div>
                </div>
                <input type="file"
                  accept={tipo === 'pcel' ? '.pdf' : '.xlsx,.xls'}
                  onChange={manejarArchivo}
                  className="hidden" />
              </label>
              {parseError && (
                <div className="mt-2 text-xs text-red-700 bg-red-100 rounded px-2 py-1">
                  ⚠ {parseError}
                </div>
              )}
              {preview && preview.warnings?.length > 0 && (
                <div className="mt-2 text-xs text-amber-700 bg-amber-100 rounded px-2 py-1">
                  {preview.warnings.map((w, i) => <div key={i}>⚠ {w}</div>)}
                </div>
              )}
            </div>
          )}

          {/* Header form */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Field label="Cliente">
              <select value={header.cliente} onChange={e => setHeader({...header, cliente: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {CLIENTES_OC.map(c => <option key={c.key} value={c.key}>{c.full}</option>)}
              </select>
            </Field>
            <Field label="Número OC">
              <input value={header.oc_numero} onChange={e => setHeader({...header, oc_numero: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Proveedor">
              <input value={header.proveedor} onChange={e => setHeader({...header, proveedor: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Fecha OC">
              <input type="date" value={header.fecha_oc} onChange={e => setHeader({...header, fecha_oc: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Fecha esperada">
              <input type="date" value={header.fecha_esperada} onChange={e => setHeader({...header, fecha_esperada: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Plazo (días)">
              <input type="number" value={header.plazo_dias} onChange={e => setHeader({...header, plazo_dias: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Moneda">
              <select value={header.moneda} onChange={e => setHeader({...header, moneda: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                <option value="MXN">MXN</option><option value="USD">USD</option>
              </select>
            </Field>
            <Field label="Tipo cambio">
              <input type="number" step="0.0001" value={header.tipo_cambio} onChange={e => setHeader({...header, tipo_cambio: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="IVA %">
              <input type="number" value={header.iva_pct} onChange={e => setHeader({...header, iva_pct: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Lugar de entrega" cols={3}>
              <input value={header.lugar_entrega} onChange={e => setHeader({...header, lugar_entrega: e.target.value})}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Notas" cols={3}>
              <textarea value={header.notas} onChange={e => setHeader({...header, notas: e.target.value})}
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
          </div>

          {/* Tabla de líneas editables */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                Líneas ({lineas.length})
              </h4>
              <button onClick={agregarLinea}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1">
                <Plus className="w-3 h-3" /> Agregar línea
              </button>
            </div>

            {cargandoDetalle ? (
              <div className="text-center py-6 text-gray-400 text-sm">Cargando detalle…</div>
            ) : lineas.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm border border-dashed border-gray-200 rounded-lg">
                Sin líneas. {tipo !== 'manual' && 'Sube un archivo o '} Haz click en "Agregar línea"
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-600">
                    <tr>
                      <th className="text-left px-2 py-1.5">SKU</th>
                      <th className="text-left px-2 py-1.5 min-w-[200px]">Descripción</th>
                      <th className="text-right px-2 py-1.5">Cantidad</th>
                      <th className="text-right px-2 py-1.5">Surtido</th>
                      <th className="text-right px-2 py-1.5">Costo</th>
                      <th className="text-right px-2 py-1.5">Total</th>
                      <th className="text-center px-2 py-1.5">Facturación</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {lineas.map(l => {
                      const total = Number(l.cantidad || 0) * Number(l.costo_unitario || 0);
                      const fact = Array.isArray(l.facturacion_esperada) ? l.facturacion_esperada : [];
                      return (
                        <tr key={l._temp} className="border-t border-gray-100">
                          <td className="px-2 py-1">
                            <input value={l.sku} onChange={e => actualizarLinea(l._temp, { sku: e.target.value })}
                              className="w-full px-1.5 py-1 rounded border border-gray-200 text-xs font-mono" />
                          </td>
                          <td className="px-2 py-1">
                            <input value={l.descripcion || ''} onChange={e => actualizarLinea(l._temp, { descripcion: e.target.value })}
                              className="w-full px-1.5 py-1 rounded border border-gray-200 text-xs" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" value={l.cantidad} onChange={e => actualizarLinea(l._temp, { cantidad: e.target.value })}
                              className="w-20 px-1.5 py-1 rounded border border-gray-200 text-xs text-right" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" value={l.cantidad_surtida} onChange={e => actualizarLinea(l._temp, { cantidad_surtida: e.target.value })}
                              className="w-20 px-1.5 py-1 rounded border border-gray-200 text-xs text-right" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="number" step="0.01" value={l.costo_unitario} onChange={e => actualizarLinea(l._temp, { costo_unitario: e.target.value })}
                              className="w-20 px-1.5 py-1 rounded border border-gray-200 text-xs text-right" />
                          </td>
                          <td className="px-2 py-1 text-right tabular-nums font-semibold">
                            {FMT_MXN(total)}
                          </td>
                          <td className="px-2 py-1 text-[10px] text-gray-500 text-center">
                            {fact.length > 0 ? (
                              <span title={fact.map(f => `${f.fecha}: ${f.cantidad}`).join('\n')}>
                                {fact.length} {fact.length === 1 ? 'factura' : 'facturas'}
                              </span>
                            ) : '—'}
                          </td>
                          <td>
                            <button onClick={() => quitarLinea(l._temp)}
                              className="p-1 text-gray-400 hover:text-red-600">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-gray-50">
                    <tr>
                      <td colSpan={2} className="px-2 py-1.5 text-xs font-semibold text-gray-600 text-right">Totales:</td>
                      <td className="text-right px-2 py-1.5 tabular-nums font-bold">
                        {FMT_N(lineas.reduce((a, l) => a + Number(l.cantidad || 0), 0))}
                      </td>
                      <td className="text-right px-2 py-1.5 tabular-nums">
                        {FMT_N(lineas.reduce((a, l) => a + Number(l.cantidad_surtida || 0), 0))}
                      </td>
                      <td></td>
                      <td className="text-right px-2 py-1.5 tabular-nums font-bold">
                        {FMT_MXN(lineas.reduce((a, l) => a + Number(l.cantidad || 0) * Number(l.costo_unitario || 0), 0))}
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
            {guardando ? 'Guardando…' : (editing ? 'Guardar cambios' : 'Crear OC')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, cols = 1 }) {
  return (
    <div className={cols === 3 ? 'col-span-3' : cols === 2 ? 'col-span-2' : ''}>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
