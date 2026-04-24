import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { toast } from '../../lib/toast';
import { formatMXN } from '../../lib/utils';
import {
  Activity, AlertTriangle, Search, Download, Package, Ship, Target,
  ChevronDown, ChevronUp, Flame, X, Users,
  CheckCircle2, Clock, DollarSign,
} from 'lucide-react';

/**
 * Forecast Clientes v2 — Planeación de compras cross-cliente
 * ─────────────────────────────────────────────────────────────
 * - Demanda agregada de los 3 clientes por SKU (DGL, PCEL, ML)
 * - Cruce con inventario comercial (whitelist) y tránsito (master embarques)
 * - Brecha vs horizonte (default 3 meses)
 * - Detección de canibalización (PCEL y DGL compiten por el SKU)
 * - Preventa recomendada (déficit próximos 60 días)
 * - Sugeridos con lead time real del SKU
 * - Export Excel para junta de compras
 * - Sugeridos pendientes: desaparecen cuando aparecen en Master Embarques
 */

const CLIENTES = [
  { key: 'digitalife',   label: 'DGL',   full: 'Digitalife',    color: '#3B82F6' },
  { key: 'pcel',         label: 'PCEL',  full: 'PCEL',          color: '#EF4444' },
  { key: 'mercadolibre', label: 'ML',    full: 'Mercado Libre', color: '#F59E0B' },
];

const HORIZONTES = [
  { meses: 2, label: '2 meses' },
  { meses: 3, label: '3 meses' },
  { meses: 6, label: '6 meses' },
];

// Buffer de inventario de seguridad (meses de demanda)
const BUFFER_MESES = 1;

// ────────── Hook: data loader ──────────
function useForecastData() {
  const [state, setState] = useState({
    loading: true,
    inventario: [],
    transito: [],
    leadTimes: [],
    metadata: [],
    demanda: [],
    sugeridosPendientes: [],
  });

  const reload = async () => {
    setState(s => ({ ...s, loading: true }));
    const hoy = new Date();
    const anioCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getFullYear();

    const [invRes, traRes, ltRes, metaRes, demRes, sugRes] = await Promise.all([
      supabase.from('v_inventario_comercial').select('*'),
      supabase.from('v_transito_sku').select('*'),
      supabase.from('v_lead_time_sku').select('*'),
      supabase.from('v_sku_metadata').select('*'),
      supabase.from('v_demanda_sku').select('*').gte('anio', anioCorte),
      supabase.from('sugeridos_compra').select('*').in('estado', ['pendiente', 'exportado']).order('created_at', { ascending: false }),
    ]);

    setState({
      loading: false,
      inventario:   invRes.data || [],
      transito:     traRes.data || [],
      leadTimes:    ltRes.data  || [],
      metadata:     metaRes.data|| [],
      demanda:      demRes.data || [],
      sugeridosPendientes: sugRes.data || [],
    });
  };

  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);
  return { ...state, reload };
}

// ────────── Cálculo del forecast ──────────
function calcularForecast(data, horizonteMeses) {
  const { inventario, transito, leadTimes, metadata, demanda } = data;

  const invBySku  = Object.fromEntries(inventario.map(r => [r.sku, r]));
  const traBySku  = Object.fromEntries(transito.map(r => [r.sku, r]));
  const ltBySku   = Object.fromEntries(leadTimes.map(r => [r.sku, r]));
  const metaBySku = Object.fromEntries(metadata.map(r => [r.sku, r]));

  // Últimos 3 meses de referencia para promedio de demanda (excluyendo mes actual que puede estar incompleto)
  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const anioActual = hoy.getFullYear();
  const mesesRef = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(anioActual, mesActual - 1 - i, 1);
    mesesRef.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }

  // demandaBySku[sku].porCliente[c] = [piezas de cada mes de referencia]
  const demandaBySku = {};
  demanda.forEach(d => {
    if (!mesesRef.some(m => m.anio === d.anio && m.mes === d.mes)) return;
    if (!demandaBySku[d.sku]) demandaBySku[d.sku] = { porCliente: { digitalife: [], pcel: [], mercadolibre: [] } };
    if (!demandaBySku[d.sku].porCliente[d.cliente]) demandaBySku[d.sku].porCliente[d.cliente] = [];
    demandaBySku[d.sku].porCliente[d.cliente].push(Number(d.piezas || 0));
  });

  const skusUniverso = new Set([
    ...Object.keys(invBySku),
    ...Object.keys(traBySku),
    ...Object.keys(demandaBySku),
  ]);

  const rows = [];
  for (const sku of skusUniverso) {
    const acc = demandaBySku[sku]?.porCliente || { digitalife: [], pcel: [], mercadolibre: [] };
    // Normalizo dividiendo siempre entre 3 (aunque haya meses con 0, es un promedio más conservador)
    const promedioMes = (arr) => (arr || []).reduce((a, b) => a + b, 0) / 3;
    const demMes = {
      digitalife:   promedioMes(acc.digitalife),
      pcel:         promedioMes(acc.pcel),
      mercadolibre: promedioMes(acc.mercadolibre),
    };
    const demHor = {
      digitalife:   demMes.digitalife   * horizonteMeses,
      pcel:         demMes.pcel         * horizonteMeses,
      mercadolibre: demMes.mercadolibre * horizonteMeses,
    };
    const demandaTotalHor = demHor.digitalife + demHor.pcel + demHor.mercadolibre;
    const demandaMesTotal = demMes.digitalife + demMes.pcel + demMes.mercadolibre;

    const inv = Number(invBySku[sku]?.disponible || 0);
    const tra = traBySku[sku];
    const traCant = Number(tra?.cantidad || 0);
    const traEta  = tra?.eta_mas_cercana || null;

    // Tránsito que cae dentro del horizonte
    const horizonteLimite = new Date(hoy); horizonteLimite.setMonth(horizonteLimite.getMonth() + horizonteMeses);
    const embarques = Array.isArray(tra?.embarques_detalle) ? tra.embarques_detalle : [];
    const traDentroHor = embarques.reduce((a, e) => {
      const eta = e.eta ? new Date(e.eta) : null;
      if (!eta) return a;
      return eta <= horizonteLimite ? a + Number(e.cantidad || 0) : a;
    }, 0);
    const traDespuesHor = traCant - traDentroHor;

    // Brecha = demanda − (inventario + tránsito dentro del horizonte)
    const brecha = Math.max(0, demandaTotalHor - inv - traDentroHor);

    // Sugerido = brecha + buffer (1 mes de demanda) − tránsito que llega después del horizonte
    const bufferUnidades = demandaMesTotal * BUFFER_MESES;
    const sugerido = Math.max(0, brecha + bufferUnidades - traDespuesHor);

    // Canibalización: PCEL y Digitalife ambos tienen demanda
    const canibalizacion = demMes.digitalife > 0 && demMes.pcel > 0;

    // Preventa: PCEL+DGL en próximos 60d vs tránsito 60d + inventario
    const limite60 = new Date(hoy); limite60.setDate(limite60.getDate() + 60);
    const traDentro60 = embarques.reduce((a, e) => {
      const eta = e.eta ? new Date(e.eta) : null;
      if (!eta) return a;
      return eta <= limite60 ? a + Number(e.cantidad || 0) : a;
    }, 0);
    const demandaPcelDgl60 = (demMes.digitalife + demMes.pcel) * 2;
    const preventaDeficit = Math.max(0, demandaPcelDgl60 - traDentro60 - inv);

    // Prorrateo PCEL/DGL cuando inventario+tránsito no alcanza (ML excluido)
    const disponibleParaPcelDgl = inv + traDentro60;
    const demandaPcelDglHor = demHor.pcel + demHor.digitalife;
    let prorrateo = null;
    if (disponibleParaPcelDgl < demandaPcelDglHor && demandaPcelDglHor > 0) {
      const ratio = disponibleParaPcelDgl / demandaPcelDglHor;
      prorrateo = {
        digitalife: demHor.digitalife * ratio,
        pcel:       demHor.pcel       * ratio,
        faltante:   demandaPcelDglHor - disponibleParaPcelDgl,
      };
    }

    const meta = metaBySku[sku] || {};
    const lt = ltBySku[sku];

    rows.push({
      sku,
      descripcion: meta.descripcion || '',
      supplier:    meta.supplier || lt?.supplier_principal || '',
      familia:     meta.familia || lt?.familia || '',
      costoUnitMxn: Number(meta.costo_promedio_mxn || 0),
      costoUnitUsd: Number(meta.unit_price_usd_ultima || 0),
      demMes, demHor, demandaTotalHor, demandaMesTotal,
      inv,
      inventarioData: invBySku[sku] || null,
      traCant, traEta, traDentroHor, traDespuesHor,
      embarques,
      brecha, sugerido,
      sugeridoValorUsd: sugerido * Number(meta.unit_price_usd_ultima || 0),
      canibalizacion, preventaDeficit, prorrateo,
      ltDias:     lt?.dias_promedio || null,
      ltMuestras: lt?.muestras || 0,
    });
  }

  return rows.filter(r => r.demandaTotalHor > 0 || r.inv > 0 || r.traCant > 0);
}

// ────────── Helpers visuales ──────────
const FMT_N   = (n) => Math.round(n || 0).toLocaleString('es-MX');
const FMT_USD = (n) => `$${Math.round(n || 0).toLocaleString('es-MX')}`;

function fmtFechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${d} ${meses[m-1]} ${String(y).slice(2)}`;
}
function diasHasta(iso) {
  if (!iso) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((new Date(iso) - hoy) / 86400000);
}

// ────────── Componente principal ──────────
export default function ForecastClientesTab() {
  const perfil = usePerfil();
  const data = useForecastData();
  const [horizonte, setHorizonte] = useState(3);
  const [busqueda, setBusqueda] = useState('');
  const [filtroSupplier, setFiltroSupplier] = useState('todos');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [filtroCliente, setFiltroCliente] = useState('todos');
  const [filtroFlag, setFiltroFlag] = useState('todos');
  const [expandedSku, setExpandedSku] = useState(null);
  const [sugeridosOpen, setSugeridosOpen] = useState(false);
  const [sortCol, setSortCol] = useState('brecha');
  const [sortDir, setSortDir] = useState('desc');
  const [exportando, setExportando] = useState(false);

  const rowsAll = useMemo(() => {
    if (data.loading) return [];
    return calcularForecast(data, horizonte);
  }, [data, horizonte]);

  const rowsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rowsAll.filter(r => {
      if (q && !r.sku.toLowerCase().includes(q) && !r.descripcion.toLowerCase().includes(q)) return false;
      if (filtroSupplier !== 'todos' && r.supplier !== filtroSupplier) return false;
      if (filtroFamilia  !== 'todas' && r.familia  !== filtroFamilia)  return false;
      if (filtroCliente  !== 'todos' && (r.demMes[filtroCliente] || 0) <= 0) return false;
      if (filtroFlag === 'brecha'         && r.brecha <= 0) return false;
      if (filtroFlag === 'canibalizacion' && !r.canibalizacion) return false;
      if (filtroFlag === 'preventa'       && r.preventaDeficit <= 0) return false;
      return true;
    });
  }, [rowsAll, busqueda, filtroSupplier, filtroFamilia, filtroCliente, filtroFlag]);

  const rowsOrdenados = useMemo(() => {
    const arr = [...rowsFiltrados];
    const dir = sortDir === 'desc' ? -1 : 1;
    arr.sort((a, b) => {
      const va = a[sortCol] ?? 0;
      const vb = b[sortCol] ?? 0;
      if (typeof va === 'string') return dir * va.localeCompare(vb);
      return dir * (va - vb);
    });
    return arr;
  }, [rowsFiltrados, sortCol, sortDir]);

  const kpis = useMemo(() => {
    const conBrecha = rowsFiltrados.filter(r => r.brecha > 0);
    const enPreventa = rowsFiltrados.filter(r => r.preventaDeficit > 0);
    const enCanibalizacion = rowsFiltrados.filter(r => r.canibalizacion);
    const sobrestock = rowsAll.filter(r => r.inv > 0 && r.demandaMesTotal === 0);
    const valorSugeridoUsd = rowsFiltrados.reduce((a, r) => a + r.sugeridoValorUsd, 0);
    const ltValores = rowsFiltrados.filter(r => r.ltDias).map(r => r.ltDias);
    const ltPromedio = ltValores.length > 0 ? ltValores.reduce((a, b) => a + b, 0) / ltValores.length : 0;
    return {
      conBrecha: conBrecha.length,
      valorSugeridoUsd,
      enPreventa: enPreventa.length,
      enCanibalizacion: enCanibalizacion.length,
      sobrestock: sobrestock.length,
      ltPromedio,
    };
  }, [rowsFiltrados, rowsAll]);

  const suppliers = useMemo(() => {
    const set = new Set();
    rowsAll.forEach(r => r.supplier && set.add(r.supplier));
    return [...set].sort();
  }, [rowsAll]);
  const familias = useMemo(() => {
    const set = new Set();
    rowsAll.forEach(r => r.familia && set.add(r.familia));
    return [...set].sort();
  }, [rowsAll]);

  async function exportarAJunta() {
    if (data.loading || exportando) return;
    const conSugerido = rowsOrdenados.filter(r => r.sugerido > 0);
    if (conSugerido.length === 0) { toast.error('No hay sugeridos que exportar'); return; }
    setExportando(true);

    const juntaFecha = (() => {
      const d = new Date(); d.setDate(1);
      return d.toISOString().slice(0, 10);
    })();

    const payload = conSugerido.map(r => ({
      sku: r.sku,
      descripcion: r.descripcion,
      supplier: r.supplier || null,
      cantidad: Math.round(r.sugerido),
      costo_estimado: r.costoUnitUsd || null,
      horizonte_meses: horizonte,
      razon: `Demanda ${horizonte}m: ${FMT_N(r.demandaTotalHor)} | Inv: ${FMT_N(r.inv)} | Tránsito: ${FMT_N(r.traDentroHor)}`,
      junta_fecha: juntaFecha,
      estado: 'exportado',
      creado_por: perfil?.user_id || null,
    }));

    const { error } = await supabase.from('sugeridos_compra').insert(payload);
    if (error) { toast.error('Error guardando: ' + error.message); setExportando(false); return; }

    try {
      const XLSX = await import('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/+esm');
      const wb = XLSX.utils.book_new();
      const resumen = conSugerido.map(r => ({
        SKU: r.sku,
        'Descripción': r.descripcion,
        Proveedor: r.supplier || '',
        Familia: r.familia || '',
        'LT días': r.ltDias || '',
        'Demanda DGL': Math.round(r.demHor.digitalife),
        'Demanda PCEL': Math.round(r.demHor.pcel),
        'Demanda ML': Math.round(r.demHor.mercadolibre),
        'Demanda total': Math.round(r.demandaTotalHor),
        'Inv Comercial': Math.round(r.inv),
        'Tránsito horizonte': Math.round(r.traDentroHor),
        Brecha: Math.round(r.brecha),
        Sugerido: Math.round(r.sugerido),
        'Costo USD': r.costoUnitUsd || 0,
        'Total USD': Math.round(r.sugeridoValorUsd),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumen), 'Resumen');

      const porProv = {};
      conSugerido.forEach(r => {
        const prov = r.supplier || '(Sin proveedor)';
        if (!porProv[prov]) porProv[prov] = [];
        porProv[prov].push(r);
      });
      Object.entries(porProv).forEach(([prov, items]) => {
        const hoja = items.map(r => ({
          SKU: r.sku, Descripción: r.descripcion, Familia: r.familia || '',
          'Demanda total': Math.round(r.demandaTotalHor),
          Inv: Math.round(r.inv), Tránsito: Math.round(r.traDentroHor),
          Brecha: Math.round(r.brecha), Sugerido: Math.round(r.sugerido),
          'Costo USD': r.costoUnitUsd || 0, 'Total USD': Math.round(r.sugeridoValorUsd),
        }));
        const nombre = prov.slice(0, 31).replace(/[\\/?*[\]]/g, '');
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hoja), nombre);
      });

      XLSX.writeFile(wb, `Junta_Compras_${new Date().toISOString().slice(0, 10)}.xlsx`);
      toast.success(`${conSugerido.length} sugeridos exportados y guardados`);
    } catch (e) {
      console.error(e);
      toast.success(`${conSugerido.length} sugeridos guardados (Excel falló: ${e.message})`);
    }
    setExportando(false);
    data.reload();
  }

  if (data.loading) {
    return <div className="p-6 text-gray-400">Cargando forecast de clientes…</div>;
  }

  return (
    <div className="p-6 space-y-5">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Activity className="w-6 h-6 text-gray-700" />
            Forecast Clientes
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Planeación de compras agregada · Digitalife + PCEL + Mercado Libre
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {HORIZONTES.map(h => (
              <button key={h.meses} onClick={() => setHorizonte(h.meses)}
                className={[
                  'px-3 py-1.5 rounded-md text-sm font-medium transition',
                  horizonte === h.meses ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900',
                ].join(' ')}>
                {h.label}
              </button>
            ))}
          </div>
          <button
            onClick={exportarAJunta} disabled={exportando}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-1.5 disabled:opacity-50"
          >
            <Download className="w-4 h-4" /> {exportando ? 'Exportando…' : 'Exportar a junta'}
          </button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiCard icon={AlertTriangle} label="SKUs con brecha" value={kpis.conBrecha} color="#EF4444" />
        <KpiCard icon={DollarSign} label="Valor a comprar" value={FMT_USD(kpis.valorSugeridoUsd)} color="#10B981" small />
        <KpiCard icon={Users} label="Canibalización" value={kpis.enCanibalizacion} color="#F59E0B" />
        <KpiCard icon={Target} label="En preventa" value={kpis.enPreventa} color="#8B5CF6" />
        <KpiCard icon={Package} label="Sobrestock" value={kpis.sobrestock} color="#64748B" />
        <KpiCard icon={Clock} label="LT promedio" value={`${Math.round(kpis.ltPromedio)}d`} color="#3B82F6" small />
      </div>

      {/* SUGERIDOS PENDIENTES */}
      {data.sugeridosPendientes.length > 0 && (
        <SugeridosPendientes
          sugeridos={data.sugeridosPendientes}
          open={sugeridosOpen}
          onToggle={() => setSugeridosOpen(!sugeridosOpen)}
          onRefresh={data.reload}
        />
      )}

      {/* FILTROS */}
      <div className="bg-white rounded-xl border border-gray-200 p-3 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white" />
          {busqueda && (
            <button onClick={() => setBusqueda('')} className="absolute right-2 top-2 text-gray-400">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <select value={filtroSupplier} onChange={e => setFiltroSupplier(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white max-w-[200px]">
          <option value="todos">Todos los proveedores</option>
          {suppliers.map(s => <option key={s} value={s}>{s.slice(0, 40)}</option>)}
        </select>
        <select value={filtroFamilia} onChange={e => setFiltroFamilia(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="todas">Todas las familias</option>
          {familias.map(f => <option key={f} value={f}>{f}</option>)}
        </select>
        <select value={filtroCliente} onChange={e => setFiltroCliente(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
          <option value="todos">Todos los clientes</option>
          {CLIENTES.map(c => <option key={c.key} value={c.key}>{c.full}</option>)}
        </select>

        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[
            { id: 'todos',         label: 'Todos' },
            { id: 'brecha',        label: 'Con brecha' },
            { id: 'canibalizacion',label: 'Canibalización' },
            { id: 'preventa',      label: 'Preventa' },
          ].map(f => (
            <button key={f.id} onClick={() => setFiltroFlag(f.id)}
              className={[
                'px-2.5 py-1 rounded-md text-xs font-medium transition',
                filtroFlag === f.id ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900',
              ].join(' ')}>
              {f.label}
            </button>
          ))}
        </div>

        <span className="text-xs text-gray-500 ml-auto">
          {rowsOrdenados.length} de {rowsAll.length} SKUs
        </span>
      </div>

      {/* TABLA */}
      <ForecastTable
        rows={rowsOrdenados.slice(0, 400)}
        expandedSku={expandedSku}
        setExpandedSku={setExpandedSku}
        sortCol={sortCol} sortDir={sortDir}
        onSort={(c) => {
          if (sortCol === c) setSortDir(sortDir === 'desc' ? 'asc' : 'desc');
          else { setSortCol(c); setSortDir('desc'); }
        }}
      />
      {rowsOrdenados.length > 400 && (
        <div className="text-center text-xs text-gray-500">
          Mostrando 400 de {rowsOrdenados.length}. Usa filtros o búsqueda para refinar.
        </div>
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

// ────────── Tabla ──────────
function ForecastTable({ rows, expandedSku, setExpandedSku, sortCol, sortDir, onSort }) {
  const ArrowSort = ({ col }) => sortCol === col ? (
    <span className="text-blue-600">{sortDir === 'desc' ? '▼' : '▲'}</span>
  ) : <span className="text-gray-300">↕</span>;

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50/80 text-xs text-gray-600">
          <tr>
            <th className="w-4"></th>
            <th className="text-left px-3 py-2 cursor-pointer" onClick={() => onSort('sku')}>
              SKU <ArrowSort col="sku" />
            </th>
            <th className="text-left px-3 py-2 min-w-[200px]">Descripción</th>
            <th className="text-left px-2 py-2">Proveedor</th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('ltDias')}>LT <ArrowSort col="ltDias"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('demandaTotalHor')}>Demanda <ArrowSort col="demandaTotalHor"/></th>
            <th className="text-center px-2 py-2" colSpan={3}>Breakdown</th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('inv')}>Inv <ArrowSort col="inv"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('traCant')}>Tránsito <ArrowSort col="traCant"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('brecha')}>Brecha <ArrowSort col="brecha"/></th>
            <th className="text-right px-2 py-2 cursor-pointer" onClick={() => onSort('sugerido')}>Sugerido <ArrowSort col="sugerido"/></th>
            <th className="text-left px-2 py-2">Banderas</th>
          </tr>
          <tr className="text-[10px] text-gray-400">
            <th colSpan={6}></th>
            <th className="text-right px-1" style={{ color: '#3B82F6' }}>DGL</th>
            <th className="text-right px-1" style={{ color: '#EF4444' }}>PCEL</th>
            <th className="text-right px-1" style={{ color: '#F59E0B' }}>ML</th>
            <th colSpan={5}></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={13} className="text-center py-10 text-gray-400 text-sm">Sin resultados con los filtros actuales</td></tr>
          ) : rows.map(r => (
            <ForecastRow
              key={r.sku} r={r}
              expanded={expandedSku === r.sku}
              onToggle={() => setExpandedSku(expandedSku === r.sku ? null : r.sku)}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ForecastRow({ r, expanded, onToggle }) {
  const brechaColor = r.brecha > 0 ? 'text-red-600 font-semibold' : 'text-gray-400';
  const eta = r.traEta ? diasHasta(r.traEta) : null;
  const etaLabel = r.traEta ? `${fmtFechaCorta(r.traEta)}${eta != null ? ` (${eta}d)` : ''}` : '—';

  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-blue-50/40 cursor-pointer" onClick={onToggle}>
        <td className="pl-2">{expanded ? <ChevronUp className="w-3.5 h-3.5 text-gray-400"/> : <ChevronDown className="w-3.5 h-3.5 text-gray-400"/>}</td>
        <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-800">{r.sku}</td>
        <td className="px-3 py-2 text-xs text-gray-600 truncate max-w-[280px]" title={r.descripcion}>{r.descripcion || '—'}</td>
        <td className="px-2 py-2 text-xs text-gray-500 truncate max-w-[140px]" title={r.supplier}>{r.supplier ? r.supplier.slice(0, 20) : '—'}</td>
        <td className="text-right px-2 py-2 text-xs">
          {r.ltDias ? <span className="text-gray-700">{Math.round(r.ltDias)}d</span> : <span className="text-gray-300">?</span>}
        </td>
        <td className="text-right px-2 py-2 tabular-nums font-semibold text-gray-800">{FMT_N(r.demandaTotalHor)}</td>
        <td className="text-right px-1 tabular-nums text-xs" style={{ color: r.demHor.digitalife > 0 ? '#3B82F6' : '#CBD5E1' }}>{FMT_N(r.demHor.digitalife)}</td>
        <td className="text-right px-1 tabular-nums text-xs" style={{ color: r.demHor.pcel > 0 ? '#EF4444' : '#CBD5E1' }}>{FMT_N(r.demHor.pcel)}</td>
        <td className="text-right px-1 tabular-nums text-xs" style={{ color: r.demHor.mercadolibre > 0 ? '#F59E0B' : '#CBD5E1' }}>{FMT_N(r.demHor.mercadolibre)}</td>
        <td className="text-right px-2 py-2 tabular-nums text-gray-700">{FMT_N(r.inv)}</td>
        <td className="text-right px-2 py-2 tabular-nums text-xs text-gray-600" title={etaLabel}>
          {r.traCant > 0 ? (<>
            {FMT_N(r.traCant)}<div className="text-[9px] text-gray-400">{etaLabel}</div>
          </>) : '—'}
        </td>
        <td className={`text-right px-2 py-2 tabular-nums ${brechaColor}`}>{FMT_N(r.brecha)}</td>
        <td className="text-right px-2 py-2 tabular-nums font-semibold text-emerald-700">{FMT_N(r.sugerido)}</td>
        <td className="px-2 py-2">
          <div className="flex gap-1 flex-wrap">
            {r.canibalizacion && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-[10px] font-semibold" title="PCEL y Digitalife compiten por este SKU">
                <Users className="w-2.5 h-2.5"/>Canib
              </span>
            )}
            {r.preventaDeficit > 0 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 text-[10px] font-semibold" title={`Déficit ${FMT_N(r.preventaDeficit)} próximos 60d`}>
                <Target className="w-2.5 h-2.5"/>Preventa
              </span>
            )}
            {r.sugerido > 0 && r.ltDias && r.ltDias > 90 && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-red-100 text-red-700 text-[10px] font-semibold" title={`LT largo: ${Math.round(r.ltDias)} días`}>
                <Flame className="w-2.5 h-2.5"/>Urge
              </span>
            )}
          </div>
        </td>
      </tr>
      {expanded && (
        <tr className="border-t border-gray-100 bg-gray-50/60">
          <td colSpan={13} className="p-4">
            <ExpandedDetail r={r} />
          </td>
        </tr>
      )}
    </>
  );
}

function ExpandedDetail({ r }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 text-sm">
      {/* Demanda */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">Demanda mensual promedio</h4>
        <div className="space-y-1.5">
          {CLIENTES.map(c => (
            <div key={c.key} className="flex items-center gap-2 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
              <span className="flex-1 text-gray-700">{c.full}</span>
              <span className="font-semibold tabular-nums" style={{ color: r.demMes[c.key] > 0 ? c.color : '#CBD5E1' }}>
                {FMT_N(r.demMes[c.key])} / mes
              </span>
            </div>
          ))}
          <div className="border-t border-gray-100 pt-1.5 flex items-center gap-2 text-xs">
            <span className="flex-1 text-gray-500 font-medium">Total mensual</span>
            <span className="font-bold tabular-nums text-gray-800">{FMT_N(r.demandaMesTotal)}</span>
          </div>
        </div>
      </div>

      {/* Inventario */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">Inventario comercial</h4>
        {r.inventarioData?.por_almacen && Object.keys(r.inventarioData.por_almacen).length > 0 ? (
          <div className="space-y-1 text-xs">
            {Object.entries(r.inventarioData.por_almacen).sort((a,b) => Number(b[1])-Number(a[1])).map(([alm, cant]) => (
              <div key={alm} className="flex items-center justify-between">
                <span className="text-gray-600">Almacén {alm}</span>
                <span className="font-semibold tabular-nums">{FMT_N(cant)}</span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-1 flex items-center justify-between font-bold">
              <span className="text-gray-700">Total</span>
              <span className="tabular-nums text-emerald-700">{FMT_N(r.inv)}</span>
            </div>
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">Sin stock comercial</div>
        )}
      </div>

      {/* Tránsito */}
      <div className="bg-white rounded-lg p-3 border border-gray-200">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2 flex items-center gap-1">
          <Ship className="w-3.5 h-3.5" /> Tránsito próximos arribos
        </h4>
        {r.embarques.length > 0 ? (
          <div className="space-y-1.5 text-xs max-h-40 overflow-y-auto">
            {r.embarques.slice(0, 10).map((e, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className={[
                  'text-[9px] font-semibold px-1 py-0.5 rounded',
                  e.estatus === 'TRANSITO MARITIMO' ? 'bg-blue-100 text-blue-700' :
                  e.estatus === 'PROXIMO A ZARPAR'  ? 'bg-amber-100 text-amber-700' :
                  e.estatus === 'EN PRODUCCION'     ? 'bg-slate-100 text-slate-600' :
                                                      'bg-gray-100 text-gray-600',
                ].join(' ')}>
                  {(e.estatus || '').slice(0, 12)}
                </span>
                <span className="font-semibold tabular-nums">{FMT_N(e.cantidad)}</span>
                <span className="text-gray-500 flex-1">→ {fmtFechaCorta(e.eta)}</span>
                {e.directo_cliente && (
                  <span className="text-[9px] text-purple-700" title={`Directo a ${e.directo_cliente}`}>→{e.directo_cliente}</span>
                )}
              </div>
            ))}
            {r.embarques.length > 10 && (
              <div className="text-[10px] text-gray-400 italic">+{r.embarques.length - 10} embarques más</div>
            )}
          </div>
        ) : (
          <div className="text-xs text-gray-400 italic">Sin tránsito programado</div>
        )}
      </div>

      {/* Prorrateo */}
      {r.prorrateo && (
        <div className="bg-amber-50 rounded-lg p-3 border border-amber-200 lg:col-span-3">
          <h4 className="font-semibold text-amber-800 text-xs uppercase tracking-wide mb-1.5 flex items-center gap-1">
            <AlertTriangle className="w-3.5 h-3.5" /> Prorrateo sugerido (inventario + tránsito &lt; demanda PCEL+DGL)
          </h4>
          <div className="text-xs text-amber-900 grid grid-cols-3 gap-3">
            <div><span className="text-amber-700">Digitalife: </span><span className="font-bold">{FMT_N(r.prorrateo.digitalife)}</span> <span className="text-[10px]">de {FMT_N(r.demHor.digitalife)} solicitadas</span></div>
            <div><span className="text-amber-700">PCEL: </span><span className="font-bold">{FMT_N(r.prorrateo.pcel)}</span> <span className="text-[10px]">de {FMT_N(r.demHor.pcel)} solicitadas</span></div>
            <div><span className="text-amber-700">Faltante: </span><span className="font-bold text-red-700">{FMT_N(r.prorrateo.faltante)}</span></div>
          </div>
          <div className="text-[10px] text-amber-700 mt-1 italic">
            Mercado Libre se sirve solo con sobrante (prioridad baja). Considera negociar inventario con compañeros.
          </div>
        </div>
      )}

      {/* Info SKU */}
      <div className="bg-white rounded-lg p-3 border border-gray-200 lg:col-span-3">
        <h4 className="font-semibold text-gray-800 text-xs uppercase tracking-wide mb-2">Info del SKU</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div><div className="text-gray-500">Familia</div><div className="font-semibold">{r.familia || '—'}</div></div>
          <div><div className="text-gray-500">Costo unitario USD</div><div className="font-semibold">{r.costoUnitUsd ? `$${r.costoUnitUsd.toFixed(2)}` : '—'}</div></div>
          <div><div className="text-gray-500">Costo unitario MXN</div><div className="font-semibold">{r.costoUnitMxn ? formatMXN(r.costoUnitMxn) : '—'}</div></div>
          <div><div className="text-gray-500">Lead time (muestras)</div><div className="font-semibold">{r.ltDias ? `${Math.round(r.ltDias)} días (${r.ltMuestras})` : 'Sin historial'}</div></div>
        </div>
      </div>
    </div>
  );
}

// ────────── Sugeridos pendientes ──────────
function SugeridosPendientes({ sugeridos, open, onToggle, onRefresh }) {
  const totalSKUs = sugeridos.length;
  const totalValor = sugeridos.reduce((a, s) => a + (Number(s.costo_estimado || 0) * Number(s.cantidad || 0)), 0);

  async function cancelar(id) {
    if (!confirm('¿Cancelar este sugerido?')) return;
    const { error } = await supabase.from('sugeridos_compra').update({ estado: 'cancelado' }).eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Sugerido cancelado');
    onRefresh();
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-xl overflow-hidden">
      <button onClick={onToggle} className="w-full px-4 py-3 flex items-center justify-between hover:bg-blue-100/50">
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-blue-600" />
          <span className="font-semibold text-blue-900">Sugeridos exportados pendientes</span>
          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">{totalSKUs}</span>
          <span className="text-xs text-blue-700">· {FMT_USD(totalValor)}</span>
          <span className="text-xs text-blue-600 italic ml-2">desaparecen al aparecer en Master Embarques</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-blue-600" /> : <ChevronDown className="w-4 h-4 text-blue-600" />}
      </button>
      {open && (
        <div className="bg-white border-t border-blue-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">SKU</th>
                <th className="text-left px-3 py-2">Proveedor</th>
                <th className="text-right px-3 py-2">Cantidad</th>
                <th className="text-right px-3 py-2">Costo USD</th>
                <th className="text-right px-3 py-2">Valor</th>
                <th className="text-left px-3 py-2">Junta</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="w-10"></th>
              </tr>
            </thead>
            <tbody>
              {sugeridos.map(s => (
                <tr key={s.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs">{s.sku}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.supplier || '—'}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{FMT_N(s.cantidad)}</td>
                  <td className="text-right px-3 py-2 tabular-nums">{s.costo_estimado ? `$${Number(s.costo_estimado).toFixed(2)}` : '—'}</td>
                  <td className="text-right px-3 py-2 tabular-nums font-semibold">{FMT_USD(Number(s.costo_estimado || 0) * Number(s.cantidad || 0))}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{s.junta_fecha || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={[
                      'text-[10px] font-semibold px-1.5 py-0.5 rounded',
                      s.estado === 'exportado' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600',
                    ].join(' ')}>
                      {s.estado}
                    </span>
                  </td>
                  <td>
                    <button onClick={() => cancelar(s.id)} className="p-1 text-gray-400 hover:text-red-600" title="Cancelar">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
