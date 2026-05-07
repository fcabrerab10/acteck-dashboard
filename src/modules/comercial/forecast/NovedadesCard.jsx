// NovedadesCard — productos por catalogar.
//
// 3 secciones:
//   🔔 Llegaron al CEDIS — recibidos sin catalogar
//   📅 Por venir — en tránsito sin catalogar
//   📋 Pendientes — con stock activo, sin roadmap
//
// Filtros compartidos: búsqueda libre, marca, familia.
// Cada SKU se puede agregar al roadmap (selector de rdmp) o descartar.
// Botón "Ver descartados" abre modal para recuperarlos.

import React, { useMemo, useState } from 'react';
import {
  Sparkles, Search, ChevronDown, ChevronRight, BellRing,
  Plus, Check, X, Trash2, Archive,
} from 'lucide-react';
import { ROADMAP_ORDER, roadmapStyle, roadmapInfo } from '../../../lib/roadmapColors';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const MES_NOMBRE = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];

const fmtFechaCorta = (d) => d ? `${d.getDate()} ${MES_NOMBRE[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : '—';

// Marca derivada del prefijo del SKU + fallback a metadata.
// Prefijos confirmados:
//   · AC-*, ES-*  → Acteck
//   · BR-*        → Balam Rush
//   · MG-*, ZM-*  → DXT Gaming
const MARCA_POR_PREFIJO = {
  AC: 'Acteck',
  ES: 'Acteck',
  BR: 'Balam Rush',
  MG: 'DXT Gaming',
  ZM: 'DXT Gaming',
};
function inferirMarca(sku, meta) {
  const prefix = (sku || '').split('-')[0]?.toUpperCase();
  return MARCA_POR_PREFIJO[prefix] || meta?.marca || '';
}

const llegoAlCedis = (arribos) =>
  arribos.some((a) => String(a.estatus || '').toLowerCase().includes('concluido'));

export default function NovedadesCard({
  roadmap,
  embarques,
  metaBySku,
  inventario,
  puedeEditar,
  onAgregarRoadmap,
  onDescartar,
  onRecuperar,
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroMarca, setFiltroMarca] = useState('todas');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [secAbierta, setSecAbierta] = useState({ llegados: true, porVenir: true, pendientes: false });
  const [expandido, setExpandido] = useState(null);
  const [skuModal, setSkuModal] = useState(null);
  const [verDescartados, setVerDescartados] = useState(false);

  // Indexamos roadmap (entradas con rdmp = catalogados; entradas con
  // descartado_en = excluidos manualmente)
  const { skusCatalogados, skusDescartados, descartadosArr } = useMemo(() => {
    const cat = new Set();
    const des = new Set();
    const desArr = [];
    (roadmap || []).forEach((r) => {
      const sku = (r.sku || '').trim();
      if (!sku) return;
      if (r.descartado_en) {
        des.add(sku);
        desArr.push({ sku, descripcion: r.descripcion || '', descartado_en: r.descartado_en });
      } else if (r.rdmp) {
        cat.add(sku);
      }
    });
    return { skusCatalogados: cat, skusDescartados: des, descartadosArr: desArr };
  }, [roadmap]);

  // SKUs con inventario activo (disponible > 0) — set
  const skusConInventario = useMemo(() => {
    const set = new Set();
    (inventario || []).forEach((r) => {
      const sku = (r.sku || r.articulo || '').trim();
      if (!sku) return;
      const disp = Number(r.disponible || 0);
      if (disp > 0) set.add(sku);
    });
    return set;
  }, [inventario]);

  // Agrupar arribos activos por SKU
  const arribosPorSku = useMemo(() => {
    const map = new Map();
    (embarques || []).forEach((e) => {
      const est = String(e.estatus || '').toLowerCase();
      if (est.includes('cancel') || est.includes('rechaz') || est.includes('perdid')) return;
      const sku = (e.codigo || '').trim();
      if (!sku) return;
      const piezas = Number(e.po_qty || 0);
      const etaStr = e.arribo_cedis || e.arribo_almacen || e.eta_puerto || e.eta;
      let eta = etaStr ? new Date(etaStr) : null;
      const yr = eta?.getFullYear();
      if (eta && (isNaN(eta) || yr < 2020 || yr > 2030)) eta = null;
      if (!map.has(sku)) {
        map.set(sku, { descripcion: e.descripcion || '', familia: e.familia || '', arribos: [] });
      }
      const m = map.get(sku);
      if (e.descripcion && !m.descripcion) m.descripcion = e.descripcion;
      if (e.familia && !m.familia) m.familia = e.familia;
      m.arribos.push({
        po: e.po,
        piezas,
        eta,
        supplier: e.supplier,
        estatus: e.estatus,
      });
    });
    map.forEach((v) => v.arribos.sort((a, b) => {
      if (!a.eta && !b.eta) return 0;
      if (!a.eta) return 1;
      if (!b.eta) return -1;
      return a.eta - b.eta;
    }));
    return map;
  }, [embarques]);

  // Construir filas con info común (SKU, marca, familia, descripción, ...)
  const buildFila = (sku, dataExtra = {}) => {
    const arribosData = arribosPorSku.get(sku);
    const arribos = arribosData?.arribos || [];
    const meta = metaBySku ? metaBySku[sku] : null;
    const descripcion = arribosData?.descripcion || meta?.descripcion || '';
    const familia = arribosData?.familia || meta?.familia || '';
    const marca = inferirMarca(sku, meta);
    const totalPzs = arribos.reduce((a, ar) => a + ar.piezas, 0);
    const proxArribo = arribos.find((a) => a.eta) || null;
    const inv = (inventario || []).reduce((acc, r) => {
      if ((r.sku || r.articulo) === sku) return acc + Number(r.disponible || 0);
      return acc;
    }, 0);
    return {
      sku,
      descripcion,
      marca,
      familia,
      totalPzs,
      proxArribo: proxArribo?.eta || null,
      proxArriboQty: proxArribo?.piezas || 0,
      arribos,
      inventarioActual: inv,
      ...dataExtra,
    };
  };

  // Categorizar SKUs en 3 secciones
  const { llegadosArr, porVenirArr, pendientesArr } = useMemo(() => {
    const lleg = [];
    const pv = [];
    const pen = [];

    // Sección 1 y 2: SKUs en tránsito sin catalogar y sin inventario activo
    arribosPorSku.forEach((data, sku) => {
      if (skusCatalogados.has(sku) || skusDescartados.has(sku)) return;
      // Si tiene inventario activo → no es nuevo, va a pendientes (lo manejamos abajo)
      if (skusConInventario.has(sku)) return;
      const fila = buildFila(sku);
      if (llegoAlCedis(data.arribos)) lleg.push(fila);
      else pv.push(fila);
    });

    // Sección 3: SKUs con inventario activo, sin roadmap
    skusConInventario.forEach((sku) => {
      if (skusCatalogados.has(sku) || skusDescartados.has(sku)) return;
      pen.push(buildFila(sku));
    });

    // Orden default: por fecha de próximo arribo asc; sin fecha al final
    const orderByEta = (a, b) => {
      if (!a.proxArribo && !b.proxArribo) return a.sku.localeCompare(b.sku);
      if (!a.proxArribo) return 1;
      if (!b.proxArribo) return -1;
      return a.proxArribo - b.proxArribo;
    };
    lleg.sort(orderByEta);
    pv.sort(orderByEta);
    pen.sort((a, b) => b.inventarioActual - a.inventarioActual); // pendientes por inventario desc

    return { llegadosArr: lleg, porVenirArr: pv, pendientesArr: pen };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arribosPorSku, skusCatalogados, skusDescartados, skusConInventario, metaBySku, inventario]);

  // Listas únicas para selectors
  const todos = [...llegadosArr, ...porVenirArr, ...pendientesArr];
  const marcasUnicas = useMemo(() => {
    const set = new Set();
    todos.forEach((r) => r.marca && set.add(r.marca));
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos.length]);
  const familiasUnicas = useMemo(() => {
    const set = new Set();
    todos.forEach((r) => r.familia && set.add(r.familia));
    return Array.from(set).sort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos.length]);

  // Aplicar filtros
  const aplicarFiltros = (lista) => {
    const q = busqueda.trim().toLowerCase();
    return lista.filter((r) => {
      if (q && !r.sku.toLowerCase().includes(q) && !r.descripcion.toLowerCase().includes(q)) return false;
      if (filtroMarca !== 'todas' && r.marca !== filtroMarca) return false;
      if (filtroFamilia !== 'todas' && r.familia !== filtroFamilia) return false;
      return true;
    });
  };
  const llegadosF = aplicarFiltros(llegadosArr);
  const porVenirF = aplicarFiltros(porVenirArr);
  const pendientesF = aplicarFiltros(pendientesArr);

  const totalNuevos = llegadosF.length + porVenirF.length;

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header con conteo grande */}
      <div className="px-4 py-3 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h3 className="font-semibold text-gray-800 text-sm">Lo nuevo y pendientes</h3>
          {skusDescartados.size > 0 && (
            <button
              type="button"
              onClick={() => setVerDescartados(true)}
              className="ml-auto inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-gray-500 hover:bg-gray-100"
              title="Ver SKUs descartados"
            >
              <Archive className="w-3 h-3" />
              {skusDescartados.size} descartados
            </button>
          )}
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-gray-600">
          <span><b>{totalNuevos}</b> nuevos</span>
          <span className="text-red-700">🔔 <b>{llegadosF.length}</b> ya llegaron</span>
          <span className="text-blue-700">📅 <b>{porVenirF.length}</b> por venir</span>
          <span className="text-amber-700">📋 <b>{pendientesF.length}</b> pendientes</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="px-3 py-2 border-b border-gray-100 bg-gray-50/40 flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-2 w-3 h-3 text-gray-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción…"
            className="w-full pl-7 pr-2 py-1 text-xs border border-gray-200 rounded bg-white"
          />
        </div>
        <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded bg-white">
          <option value="todas">Marca: todas</option>
          {marcasUnicas.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}
          className="px-2 py-1 text-xs border border-gray-200 rounded bg-white">
          <option value="todas">Familia: todas</option>
          {familiasUnicas.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </div>

      {/* 3 secciones */}
      <div className="max-h-[70vh] overflow-y-auto">
        <Seccion
          titulo="Llegaron al CEDIS"
          icono={<BellRing className="w-3.5 h-3.5" />}
          color="red"
          items={llegadosF}
          abierta={secAbierta.llegados}
          onToggle={() => setSecAbierta((s) => ({ ...s, llegados: !s.llegados }))}
          expandido={expandido}
          setExpandido={setExpandido}
          puedeEditar={puedeEditar}
          onAgregar={(sku) => setSkuModal(sku)}
          onDescartar={onDescartar}
          tipo="conArribos"
        />
        <Seccion
          titulo="Por venir"
          icono={<span>📅</span>}
          color="blue"
          items={porVenirF}
          abierta={secAbierta.porVenir}
          onToggle={() => setSecAbierta((s) => ({ ...s, porVenir: !s.porVenir }))}
          expandido={expandido}
          setExpandido={setExpandido}
          puedeEditar={puedeEditar}
          onAgregar={(sku) => setSkuModal(sku)}
          onDescartar={onDescartar}
          tipo="conArribos"
        />
        <Seccion
          titulo="Pendientes de catalogar (con stock)"
          icono={<span>📋</span>}
          color="amber"
          items={pendientesF}
          abierta={secAbierta.pendientes}
          onToggle={() => setSecAbierta((s) => ({ ...s, pendientes: !s.pendientes }))}
          expandido={expandido}
          setExpandido={setExpandido}
          puedeEditar={puedeEditar}
          onAgregar={(sku) => setSkuModal(sku)}
          onDescartar={onDescartar}
          tipo="conInventario"
        />

        {totalNuevos === 0 && pendientesF.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
            ✓ Todo el catálogo está organizado · sin productos por catalogar
          </div>
        )}
      </div>

      {/* Modal: Agregar al roadmap */}
      {skuModal && (
        <AgregarRoadmapModal
          sku={skuModal}
          onClose={() => setSkuModal(null)}
          onConfirmar={async (rdmp) => {
            await onAgregarRoadmap?.(skuModal.sku, rdmp, skuModal.descripcion || '');
            setSkuModal(null);
          }}
        />
      )}

      {/* Modal: Ver descartados */}
      {verDescartados && (
        <DescartadosModal
          items={descartadosArr}
          onClose={() => setVerDescartados(false)}
          onRecuperar={async (sku) => { await onRecuperar?.(sku); }}
          puedeEditar={puedeEditar}
        />
      )}
    </div>
  );
}

function Seccion({ titulo, icono, color, items, abierta, onToggle, expandido, setExpandido, puedeEditar, onAgregar, onDescartar, tipo }) {
  const COLOR = {
    red:   { bg: 'bg-red-50/50',    border: 'border-red-500',    text: 'text-red-700',    pill: 'bg-red-600' },
    blue:  { bg: 'bg-blue-50/40',   border: 'border-blue-400',   text: 'text-blue-700',   pill: 'bg-blue-600' },
    amber: { bg: 'bg-amber-50/40',  border: 'border-amber-400',  text: 'text-amber-700',  pill: 'bg-amber-600' },
  }[color];
  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <button
        type="button"
        onClick={onToggle}
        className={[
          'w-full px-4 py-2.5 flex items-center gap-2 hover:bg-gray-50 transition text-left border-l-4',
          COLOR.bg, COLOR.border,
        ].join(' ')}
      >
        {abierta
          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
        <span className={`text-sm shrink-0 ${COLOR.text}`}>{icono}</span>
        <span className={`font-bold text-sm flex-1 ${COLOR.text}`}>{titulo}</span>
        <span className={`text-[11px] text-white px-2 py-0.5 rounded-full font-bold tabular-nums ${COLOR.pill}`}>
          {items.length}
        </span>
      </button>
      {abierta && (
        items.length === 0 ? (
          <div className="px-4 py-3 text-[11px] text-gray-400 italic">Sin SKUs en esta sección</div>
        ) : (
          <SkusTabla
            items={items}
            tipo={tipo}
            expandido={expandido}
            setExpandido={setExpandido}
            puedeEditar={puedeEditar}
            onAgregar={onAgregar}
            onDescartar={onDescartar}
          />
        )
      )}
    </div>
  );
}

function SkusTabla({ items, tipo, expandido, setExpandido, puedeEditar, onAgregar, onDescartar }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
          <tr>
            <th className="w-4"></th>
            <th className="text-left px-2 py-1.5">SKU</th>
            <th className="text-left px-2 py-1.5">Marca</th>
            <th className="text-left px-2 py-1.5">Familia</th>
            <th className="text-left px-2 py-1.5 min-w-[180px]">Descripción</th>
            {tipo === 'conArribos' ? (
              <>
                <th className="text-right px-2 py-1.5">Próx arribo</th>
                <th className="text-right px-2 py-1.5">En camino</th>
              </>
            ) : (
              <th className="text-right px-2 py-1.5">Stock actual</th>
            )}
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {items.map((r) => (
            <FilaSku
              key={r.sku}
              r={r}
              tipo={tipo}
              expandido={expandido === r.sku}
              onToggle={() => setExpandido(expandido === r.sku ? null : r.sku)}
              puedeEditar={puedeEditar}
              onAgregar={onAgregar}
              onDescartar={onDescartar}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FilaSku({ r, tipo, expandido, onToggle, puedeEditar, onAgregar, onDescartar }) {
  return (
    <>
      <tr className="border-t border-gray-100 hover:bg-blue-50/30">
        <td className="pl-2 cursor-pointer" onClick={onToggle}>
          {expandido
            ? <ChevronDown className="w-3 h-3 text-gray-400" />
            : <ChevronRight className="w-3 h-3 text-gray-400" />}
        </td>
        <td className="px-2 py-1 font-mono font-semibold text-gray-800 cursor-pointer" onClick={onToggle}>{r.sku}</td>
        <td className="px-2 py-1 text-gray-600 cursor-pointer" onClick={onToggle}>{r.marca || <span className="text-gray-300">—</span>}</td>
        <td className="px-2 py-1 text-gray-600 cursor-pointer" onClick={onToggle}>{r.familia || <span className="text-gray-300">—</span>}</td>
        <td className="px-2 py-1 text-gray-700 truncate max-w-[260px] cursor-pointer" title={r.descripcion} onClick={onToggle}>
          {r.descripcion || <span className="italic text-gray-400">sin descripción</span>}
        </td>
        {tipo === 'conArribos' ? (
          <>
            <td className="px-2 py-1 text-right text-gray-600 cursor-pointer tabular-nums" onClick={onToggle}>
              {r.proxArribo
                ? <>
                    <div>{fmtFechaCorta(r.proxArribo)}</div>
                    <div className="text-[9px] text-gray-400">{FMT_N(r.proxArriboQty)} pzs</div>
                  </>
                : <span className="text-gray-300">—</span>}
            </td>
            <td className="px-2 py-1 text-right tabular-nums font-semibold cursor-pointer" onClick={onToggle}>
              {FMT_N(r.totalPzs)}
              {r.arribos.length > 1 && (
                <div className="text-[9px] text-gray-400 font-normal">{r.arribos.length} POs</div>
              )}
            </td>
          </>
        ) : (
          <td className="px-2 py-1 text-right tabular-nums font-semibold text-amber-700 cursor-pointer" onClick={onToggle}>
            {FMT_N(r.inventarioActual)}
          </td>
        )}
        <td className="px-2 py-1 text-center">
          {puedeEditar && (
            <div className="flex gap-1 justify-end">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onAgregar(r); }}
                className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-medium"
                title="Agregar al roadmap"
              >
                <Plus className="w-3 h-3" /> Roadmap
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (confirm(`¿Descartar ${r.sku}? No volverá a aparecer en esta tarjeta hasta que lo recuperes.`)) {
                    onDescartar?.(r.sku);
                  }
                }}
                className="inline-flex items-center justify-center w-5 h-5 rounded text-gray-400 hover:bg-red-50 hover:text-red-600"
                title="Descartar"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          )}
        </td>
      </tr>
      {expandido && (
        <tr className="border-t border-gray-100 bg-gray-50/40">
          <td colSpan={tipo === 'conArribos' ? 8 : 7} className="px-4 py-2 text-[11px]">
            {r.arribos.length > 0 ? (
              <>
                <div className="text-gray-500 uppercase text-[9px] tracking-wide mb-1">Arribos en tránsito</div>
                <div className="space-y-0.5">
                  {r.arribos.map((a, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="font-mono text-gray-500 w-20">PO-{a.po}</span>
                      <span className="font-semibold tabular-nums w-20 text-right">{FMT_N(a.piezas)}</span>
                      {a.eta && <span className="text-blue-700">→ {fmtFechaCorta(a.eta)}</span>}
                      <span className="text-gray-400 italic ml-auto">{a.estatus}</span>
                      {a.supplier && <span className="text-gray-500 text-[10px]">{a.supplier}</span>}
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-gray-500 italic">Sin tránsito programado</div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

// Modal: selector de rdmp para agregar al roadmap
function AgregarRoadmapModal({ sku, onClose, onConfirmar }) {
  const [rdmp, setRdmp] = useState('RMI');
  const [enviando, setEnviando] = useState(false);
  const confirm = async () => {
    if (!rdmp) return;
    setEnviando(true);
    try { await onConfirmar(rdmp); } finally { setEnviando(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <h2 className="font-semibold text-gray-800">Agregar al roadmap</h2>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100" disabled={enviando}>
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="px-5 py-3 bg-gray-50/50 border-b border-gray-100">
          <div className="flex items-baseline gap-2">
            <span className="font-mono font-bold text-gray-800 text-sm">{sku.sku}</span>
            <span className="text-xs text-gray-500 truncate flex-1" title={sku.descripcion}>{sku.descripcion || ''}</span>
          </div>
        </div>
        <div className="p-5 space-y-3">
          <div className="text-xs text-gray-600 mb-2">Elige el bloque del roadmap:</div>
          <div className="grid grid-cols-2 gap-2">
            {ROADMAP_ORDER.map((code) => {
              const s = roadmapStyle(code);
              const info = roadmapInfo(code);
              const sel = rdmp === code;
              return (
                <button key={code} type="button" onClick={() => setRdmp(code)}
                  className={['p-2 rounded-md border-2 text-left transition', sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'].join(' ')}>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold" style={{ backgroundColor: s.bg, color: s.color }}>{code}</span>
                    {sel && <Check className="w-3 h-3 text-blue-600 ml-auto" />}
                  </div>
                  <div className="text-[10px] text-gray-600 leading-tight">{info.descripcion || ''}</div>
                </button>
              );
            })}
          </div>
          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} disabled={enviando}
              className="flex-1 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50">
              Cancelar
            </button>
            <button type="button" onClick={confirm} disabled={enviando || !rdmp}
              className="flex-1 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50">
              {enviando ? 'Guardando…' : `Agregar como ${rdmp}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Modal: ver y recuperar descartados
function DescartadosModal({ items, onClose, onRecuperar, puedeEditar }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[70vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="px-5 py-3 border-b border-gray-200 flex items-center gap-2">
          <Archive className="w-4 h-4 text-gray-700" />
          <h2 className="font-semibold text-gray-800">SKUs descartados</h2>
          <span className="text-xs text-gray-500 ml-2">{items.length}</span>
          <button onClick={onClose} className="ml-auto p-1 rounded hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {items.length === 0 ? (
            <div className="text-xs text-gray-400 italic p-4 text-center">Sin descartados</div>
          ) : (
            items.map((r) => (
              <div key={r.sku} className="px-4 py-2 flex items-baseline gap-2">
                <span className="font-mono font-semibold text-gray-800 text-xs shrink-0">{r.sku}</span>
                <span className="text-xs text-gray-600 truncate flex-1" title={r.descripcion}>{r.descripcion || '—'}</span>
                <span className="text-[10px] text-gray-400 shrink-0">
                  {new Date(r.descartado_en).toLocaleDateString('es-MX')}
                </span>
                {puedeEditar && (
                  <button
                    type="button"
                    onClick={() => onRecuperar(r.sku)}
                    className="text-[10px] px-2 py-0.5 rounded bg-emerald-50 hover:bg-emerald-100 text-emerald-700"
                  >
                    Recuperar
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
