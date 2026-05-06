// NovedadesCard — productos REALMENTE nuevos: SKUs en tránsito que aún
// NO están en roadmap_sku.
//
// Estructura:
//   1. "Llegaron al CEDIS — agregar al roadmap" (destacado): productos
//      ya recibidos físicamente que aún no se han catalogado. Cada uno
//      con botón "+ Agregar al roadmap" que abre selector de rdmp.
//   2. Por mes de primer arribo: productos por venir, para que Fernando
//      pueda comenzar preventa y ofrecerlos a clientes.
//
// Cuando se agrega al roadmap, el SKU desaparece de esta tarjeta (se
// vuelve un producto regular del catálogo).

import React, { useMemo, useState } from 'react';
import { Sparkles, ChevronDown, ChevronUp, AlertCircle, BellRing, Plus, Check, X } from 'lucide-react';
import { ROADMAP_ORDER, roadmapStyle, roadmapInfo } from '../../../lib/roadmapColors';

const FMT_N = (n) => Math.round(n || 0).toLocaleString('es-MX');
const MES_NOMBRE = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];

function fmtFechaCorta(d) {
  if (!d) return '—';
  return `${d.getDate()} ${MES_NOMBRE[d.getMonth()].toLowerCase()}`;
}

function llegoAlCedis(arribos) {
  // Si tiene al menos un arribo con estatus CONCLUIDO → ya se recibió.
  return arribos.some((a) => String(a.estatus || '').toLowerCase().includes('concluido'));
}

export default function NovedadesCard({ roadmap, embarques, puedeEditar, onAgregarRoadmap }) {
  const [mesAbierto, setMesAbierto] = useState(null);
  const [pendientesAbierto, setPendientesAbierto] = useState(true);
  const [llegadosAbierto, setLlegadosAbierto] = useState(true);
  const [skuModal, setSkuModal] = useState(null);

  // SKUs ya catalogados en el roadmap → set para excluir
  const skusEnRoadmap = useMemo(() =>
    new Set((roadmap || []).map((r) => (r.sku || '').trim()).filter(Boolean))
  , [roadmap]);

  // Agrupar arribos por SKU (excluye canceladas/rechazadas)
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

  // SKUs nuevos = en arribosPorSku PERO NO en roadmap
  const skusNuevos = useMemo(() => {
    const out = [];
    arribosPorSku.forEach((data, sku) => {
      if (skusEnRoadmap.has(sku)) return;
      out.push({ sku, ...data });
    });
    return out;
  }, [arribosPorSku, skusEnRoadmap]);

  // Separar: ya llegaron al CEDIS vs por venir
  const { llegados, porMes } = useMemo(() => {
    const ya = [];
    const meses = new Map();
    skusNuevos.forEach((r) => {
      if (llegoAlCedis(r.arribos)) {
        ya.push(r);
        return;
      }
      const primero = r.arribos.find((a) => a.eta) || r.arribos[0];
      if (!primero || !primero.eta) {
        // Sin ETA — caen en "por venir sin fecha"
        const k = 'sinfecha';
        if (!meses.has(k)) meses.set(k, { key: k, anio: 0, mes: 0, items: [], sinFecha: true });
        meses.get(k).items.push(r);
        return;
      }
      const k = `${primero.eta.getFullYear()}-${String(primero.eta.getMonth() + 1).padStart(2, '0')}`;
      if (!meses.has(k)) {
        meses.set(k, {
          key: k,
          anio: primero.eta.getFullYear(),
          mes: primero.eta.getMonth() + 1,
          items: [],
          sinFecha: false,
        });
      }
      meses.get(k).items.push(r);
    });
    const lista = Array.from(meses.values()).sort((a, b) => {
      if (a.sinFecha) return 1;
      if (b.sinFecha) return -1;
      return a.key.localeCompare(b.key);
    });
    return { llegados: ya, porMes: lista };
  }, [skusNuevos]);

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-500" />
        <h3 className="font-semibold text-gray-800 text-sm">Lo nuevo que viene</h3>
        <span className="text-[10px] text-gray-400 ml-auto">
          {skusNuevos.length} SKU{skusNuevos.length !== 1 ? 's' : ''} sin catalogar
        </span>
      </div>

      <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
        {skusNuevos.length === 0 && (
          <div className="px-4 py-8 text-center text-xs text-gray-400 italic">
            No hay productos nuevos en tránsito · todo está en el roadmap.
          </div>
        )}

        {/* Llegaron al CEDIS — destacado en rojo */}
        {llegados.length > 0 && (
          <div>
            <button
              type="button"
              onClick={() => setLlegadosAbierto(!llegadosAbierto)}
              className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-red-50/40 transition text-left bg-red-50/30 border-l-4 border-red-500"
            >
              {llegadosAbierto
                ? <ChevronUp className="w-4 h-4 text-red-600" />
                : <ChevronDown className="w-4 h-4 text-red-600" />}
              <BellRing className="w-3.5 h-3.5 text-red-600" />
              <span className="font-bold text-red-700 text-sm flex-1">
                Llegaron al CEDIS — agregar al roadmap
              </span>
              <span className="text-xs text-white bg-red-600 px-2 py-0.5 rounded-full font-bold tabular-nums">
                {llegados.length}
              </span>
            </button>
            {llegadosAbierto && (
              <SkusList
                items={llegados}
                puedeEditar={puedeEditar}
                onAgregar={(sku) => setSkuModal(sku)}
                accent="red"
              />
            )}
          </div>
        )}

        {/* Por venir — agrupado por mes */}
        {porMes.map((mes) => {
          const titulo = mes.sinFecha
            ? 'SIN FECHA DE ARRIBO'
            : `${MES_NOMBRE[mes.mes - 1]} ${mes.anio}`;
          const totalPzs = mes.items.reduce((a, it) =>
            a + it.arribos.reduce((s, ar) => s + ar.piezas, 0), 0);
          const expandido = mesAbierto === mes.key;
          return (
            <div key={mes.key}>
              <button
                type="button"
                onClick={() => setMesAbierto(expandido ? null : mes.key)}
                className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-blue-50/40 transition text-left"
              >
                {expandido
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />}
                <span className="font-semibold text-gray-700 text-sm w-32">{titulo}</span>
                <span className="text-xs text-gray-500 flex-1">
                  {mes.items.length} SKU{mes.items.length !== 1 ? 's' : ''} · prevender / ofrecer
                </span>
                <span className="font-bold text-blue-700 tabular-nums text-sm">
                  {FMT_N(totalPzs)} pzs
                </span>
              </button>
              {expandido && (
                <SkusList
                  items={mes.items}
                  puedeEditar={puedeEditar}
                  onAgregar={(sku) => setSkuModal(sku)}
                  accent="blue"
                />
              )}
            </div>
          );
        })}
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
    </div>
  );
}

function SkusList({ items, puedeEditar, onAgregar, accent = 'blue' }) {
  return (
    <ul className="bg-gray-50/40 divide-y divide-gray-100">
      {items.map((r) => {
        const totalPzs = r.arribos.reduce((a, ar) => a + ar.piezas, 0);
        const proximo = r.arribos.find((a) => a.eta) || r.arribos[0];
        return (
          <li key={r.sku} className="px-4 py-2">
            <div className="flex items-baseline gap-2">
              <span className="font-mono font-semibold text-gray-800 text-xs shrink-0">{r.sku}</span>
              <span className="flex-1 text-xs text-gray-700 truncate" title={r.descripcion}>
                {r.descripcion || <span className="italic text-gray-400">sin descripción</span>}
              </span>
              <span className={[
                'text-[10px] font-bold tabular-nums shrink-0',
                accent === 'red' ? 'text-red-700' : 'text-blue-700',
              ].join(' ')}>
                {FMT_N(totalPzs)} pzs
                {proximo?.eta && ` · ${fmtFechaCorta(proximo.eta)}`}
              </span>
              {puedeEditar && (
                <button
                  type="button"
                  onClick={() => onAgregar(r)}
                  className={[
                    'inline-flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-medium shrink-0',
                    accent === 'red'
                      ? 'bg-red-600 hover:bg-red-700 text-white'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white',
                  ].join(' ')}
                  title="Agregar al roadmap"
                >
                  <Plus className="w-3 h-3" /> Roadmap
                </button>
              )}
            </div>
            {/* Detalle de arribos */}
            {r.arribos.length > 0 && (
              <div className="ml-2 mt-1 flex flex-wrap gap-1.5 text-[10px]">
                {r.arribos.slice(0, 3).map((a, i) => (
                  <span key={i} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-700">
                    <span className="font-mono text-gray-500">PO-{a.po}</span>
                    <span className="tabular-nums">{FMT_N(a.piezas)}</span>
                    {a.eta && <span className="text-blue-600">→ {fmtFechaCorta(a.eta)}</span>}
                    <span className="text-[9px] text-gray-400 italic">{a.estatus}</span>
                  </span>
                ))}
                {r.arribos.length > 3 && (
                  <span className="text-gray-400">+{r.arribos.length - 3}</span>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// Modal: selector de rdmp para agregar al roadmap
function AgregarRoadmapModal({ sku, onClose, onConfirmar }) {
  const [rdmp, setRdmp] = useState('RMI');
  const [enviando, setEnviando] = useState(false);

  const confirm = async () => {
    if (!rdmp) return;
    setEnviando(true);
    try {
      await onConfirmar(rdmp);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
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
            <span className="text-xs text-gray-500 truncate flex-1" title={sku.descripcion}>
              {sku.descripcion || ''}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="text-xs text-gray-600 mb-2">
            Elige el bloque del roadmap donde quieres acomodar este producto:
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ROADMAP_ORDER.map((code) => {
              const s = roadmapStyle(code);
              const info = roadmapInfo(code);
              const sel = rdmp === code;
              return (
                <button
                  key={code}
                  type="button"
                  onClick={() => setRdmp(code)}
                  className={[
                    'p-2 rounded-md border-2 text-left transition',
                    sel ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span
                      className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                      style={{ backgroundColor: s.bg, color: s.color }}
                    >
                      {code}
                    </span>
                    {sel && <Check className="w-3 h-3 text-blue-600 ml-auto" />}
                  </div>
                  <div className="text-[10px] text-gray-600 leading-tight">
                    {info.descripcion || ''}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={enviando}
              className="flex-1 px-3 py-2 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-700 text-sm font-medium disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirm}
              disabled={enviando || !rdmp}
              className="flex-1 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50"
            >
              {enviando ? 'Guardando…' : `Agregar como ${rdmp}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
