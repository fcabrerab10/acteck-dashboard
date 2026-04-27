import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaGlobal } from '../../lib/permisos';
import { toast } from '../../lib/toast';
import { formatMXN } from '../../lib/utils';
import {
  Search, X, Plus, ChevronDown, ChevronUp, ChevronRight, Trash2,
  Edit3, Package, Filter, FileText, Ship, ShoppingCart, ArrowUp, ArrowDown,
} from 'lucide-react';
import { roadmapStyle, roadmapInfo } from '../../lib/roadmapColors';

/**
 * ReporteSection — sección colapsable dentro de Resumen Clientes
 * Tabla maestra de SKUs en orden custom con inventario, precios y expand
 * de demanda + tránsito + sugerido de compra.
 */

// Almacenes comerciales (whitelist) en orden estable
const ALMACENES = [
  { id: 1,  nombre: 'Central GDL'   },
  { id: 2,  nombre: 'Colotlán'      },
  { id: 3,  nombre: 'Tultitlán'     },
  { id: 25, nombre: 'Propio'        },
  { id: 14, nombre: 'Retail 14'     },
  { id: 16, nombre: 'Retail 16'     },
  { id: 17, nombre: 'Retail 17'     },
  { id: 19, nombre: 'Retail 19'     },
  { id: 6,  nombre: 'Decme'         },
  { id: 44, nombre: 'Empaque dañado'},
];

// Colores oficiales del roadmap → vienen de src/lib/roadmapColors.js
// (fuente única de verdad, alineada con el Excel "Reporte 2026.xlsx")

const FMT_N = (n) => Math.round(Number(n) || 0).toLocaleString('es-MX');

function fmtFechaCorta(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.slice(0, 10).split('-');
  const meses = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${String(y).slice(2)}`;
}

export default function ReporteSection() {
  const perfil = usePerfil();
  const canEdit = perfil?.es_super_admin === true || perfil?.rol === 'super_admin';

  const [open, setOpen] = useState(false);
  const [data, setData] = useState({ loading: true, skus: [], inventario: [], metadata: [], precios: [], roadmap: [] });
  const [busqueda, setBusqueda] = useState('');
  const [filtroRoadmap, setFiltroRoadmap] = useState('todos');
  const [filtroMarca, setFiltroMarca] = useState('todas');
  const [soloConStock, setSoloConStock] = useState(false);
  const [verAlmacenes, setVerAlmacenes] = useState(false);  // toggle: mostrar columnas o solo total
  const [expandedSku, setExpandedSku] = useState(null);
  const [modal, setModal] = useState(null);

  useEffect(() => { if (open) cargar(); /* eslint-disable-next-line */ }, [open]);

  async function cargar() {
    setData((s) => ({ ...s, loading: true }));
    const [rsRes, invRes, metaRes, preRes, rmRes] = await Promise.all([
      supabase.from('reporte_skus').select('*').eq('activo', true).order('orden'),
      // Inventario del ERP Acteck (Vw_TablaH_Inventario.xlsx, cargado vía /uploads.html)
      // Mostramos `inventario` (total físico) y `disponible` (vendible) en tooltip.
      supabase.from('inventario_acteck')
        .select('articulo, no_almacen, disponible, inventario')
        .neq('articulo', '__TEST__'),
      supabase.from('v_sku_metadata').select('*'),
      supabase.from('precios_sku').select('sku, precio_aaa, descuento, precio_descuento'),
      supabase.from('roadmap_sku').select('sku, rdmp, descripcion'),
    ]);
    setData({
      loading: false,
      skus: rsRes.data || [],
      inventario: invRes.data || [],
      metadata: metaRes.data || [],
      precios: preRes.data || [],
      roadmap: rmRes.data || [],
    });
  }

  const rows = useMemo(() => {
    if (data.loading) return [];
    // Index inventario por sku → { almacen_id: { inv, disp, apartado } }
    // Usamos `inventario` (total físico) como valor principal, `disponible` para tooltip.
    const invBySku = {};
    data.inventario.forEach((r) => {
      if (!r.articulo) return;
      if (!invBySku[r.articulo]) invBySku[r.articulo] = {};
      const inv  = Number(r.inventario || 0);
      const disp = Number(r.disponible || 0);
      const cur  = invBySku[r.articulo][r.no_almacen] || { inv: 0, disp: 0, apartado: 0 };
      cur.inv      += inv;
      cur.disp     += disp;
      cur.apartado += Math.max(0, inv - disp);
      invBySku[r.articulo][r.no_almacen] = cur;
    });
    const metaBySku  = Object.fromEntries(data.metadata.map((r) => [r.sku, r]));
    const preBySku   = Object.fromEntries(data.precios.map((r) => [r.sku, r]));
    const rdmpBySku  = Object.fromEntries(data.roadmap.map((r) => [r.sku, r]));

    return data.skus.map((s) => {
      const inv = invBySku[s.sku] || {};
      const total      = ALMACENES.reduce((a, x) => a + (inv[x.id]?.inv      || 0), 0);
      const totalDisp  = ALMACENES.reduce((a, x) => a + (inv[x.id]?.disp     || 0), 0);
      const totalApart = ALMACENES.reduce((a, x) => a + (inv[x.id]?.apartado || 0), 0);
      const meta  = metaBySku[s.sku]  || {};
      const pre   = preBySku[s.sku]   || {};
      const rdmp  = rdmpBySku[s.sku]  || {};
      const roadmap = s.roadmap_manual || rdmp.rdmp || '';
      const desc    = s.descripcion_manual || rdmp.descripcion || meta.descripcion || '';
      const marca   = s.sku.startsWith('BR') ? 'Balam Rush' : s.sku.startsWith('AC') ? 'Acteck' : (s.sku.startsWith('SW') ? 'Swann' : 'Otra');
      // Precios: manual override > precios_sku > null
      const precioAaaBase = Number(pre.precio_aaa || 0) || null;
      const descuentoBase = Number(pre.descuento || 0) || null;
      const precioAaa  = s.precio_aaa_manual != null ? Number(s.precio_aaa_manual) : precioAaaBase;
      const descuento  = s.descuento_manual != null ? Number(s.descuento_manual) : descuentoBase;
      const precioDesc = (precioAaa != null && descuento != null)
        ? Math.round(precioAaa * (1 - descuento) * 100) / 100
        : (pre.precio_descuento === 'Consultar' ? null : (Number(pre.precio_descuento || 0) || null));
      return {
        id: s.id,
        sku: s.sku,
        orden: s.orden,
        roadmap, descripcion: desc, marca,
        inv, invTotal: total, invDisp: totalDisp, invApartado: totalApart,
        precio_aaa: precioAaa,
        descuento: descuento,
        precio_descuento: precioDesc,
        precio_es_manual: s.precio_aaa_manual != null,
        descuento_es_manual: s.descuento_manual != null,
        s_raw: s,
      };
    });
  }, [data]);

  const roadmapsUnicos = useMemo(() => {
    const set = new Set();
    rows.forEach((r) => r.roadmap && set.add(r.roadmap));
    return [...set].sort();
  }, [rows]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return rows.filter((r) => {
      if (q) {
        const txt = `${r.sku} ${r.descripcion} ${r.roadmap}`.toLowerCase();
        if (!txt.includes(q)) return false;
      }
      if (filtroRoadmap !== 'todos' && r.roadmap !== filtroRoadmap) return false;
      if (filtroMarca !== 'todas' && r.marca !== filtroMarca) return false;
      if (soloConStock && r.invTotal === 0) return false;
      return true;
    });
  }, [rows, busqueda, filtroRoadmap, filtroMarca, soloConStock]);

  async function eliminarSku(id) {
    if (!canEdit) return;
    if (!confirm('¿Quitar este SKU del reporte?')) return;
    await supabase.from('reporte_skus').delete().eq('id', id);
    toast.success('SKU removido del reporte');
    cargar();
  }

  // Guarda override de precio_aaa o descuento en reporte_skus
  async function actualizarPrecio(id, campo, valor) {
    if (!canEdit) return;
    const v = valor === '' || valor == null ? null : Number(valor);
    if (v != null && (isNaN(v) || v < 0)) { toast.error('Valor inválido'); return; }
    const { error } = await supabase.from('reporte_skus').update({ [campo]: v }).eq('id', id);
    if (error) { toast.error('Error: ' + error.message); return; }
    toast.success('Precio guardado');
    // Actualiza local sin re-fetchear todo
    setData(s => ({
      ...s,
      skus: s.skus.map(x => x.id === id ? { ...x, [campo]: v } : x),
    }));
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-5 py-3 flex items-center gap-3 hover:bg-gray-50"
      >
        <Package className="w-5 h-5 text-gray-600" />
        <h3 className="font-semibold text-gray-800 flex-1 text-left">
          Reporte
          <span className="text-xs text-gray-500 font-normal ml-2">
            · Lista maestra de SKUs en orden custom · Click en uno para ver demanda y tránsito
          </span>
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {data.loading ? (
            <div className="p-10 text-center text-gray-400 text-sm">Cargando…</div>
          ) : (
            <>
              {/* Filtros */}
              <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                  <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
                  <input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar SKU, descripción o roadmap…"
                    className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
                  />
                  {busqueda && <button onClick={() => setBusqueda('')} className="absolute right-2 top-2 text-gray-400"><X className="w-3.5 h-3.5"/></button>}
                </div>

                <select value={filtroRoadmap} onChange={(e) => setFiltroRoadmap(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                  <option value="todos">Roadmap: todos</option>
                  {roadmapsUnicos.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>

                <select value={filtroMarca} onChange={(e) => setFiltroMarca(e.target.value)}
                  className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white">
                  <option value="todas">Marca: todas</option>
                  <option value="Acteck">Acteck</option>
                  <option value="Balam Rush">Balam Rush</option>
                  <option value="Swann">Swann</option>
                </select>

                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={soloConStock} onChange={(e) => setSoloConStock(e.target.checked)}
                    className="rounded border-gray-300" />
                  Solo con stock
                </label>

                <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer">
                  <input type="checkbox" checked={verAlmacenes} onChange={(e) => setVerAlmacenes(e.target.checked)}
                    className="rounded border-gray-300" />
                  Ver detalle por almacén
                </label>

                <span className="text-xs text-gray-500 ml-auto">{filtrados.length} de {rows.length} SKUs</span>

                {canEdit && (
                  <button onClick={() => setModal({ tipo: 'agregar' })}
                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5">
                    <Plus className="w-4 h-4" /> Agregar SKU
                  </button>
                )}
              </div>

              {/* Tabla */}
              <div className="overflow-x-auto max-h-[700px]">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 sticky top-0 z-10">
                    <tr className="text-xs text-gray-600">
                      <th className="text-left px-3 py-2">SKU</th>
                      <th className="text-left px-3 py-2">Roadmap</th>
                      <th className="text-left px-3 py-2 min-w-[260px]">Descripción</th>
                      {verAlmacenes && ALMACENES.map((a) => (
                        <th key={a.id} className="text-right px-2 py-2 min-w-[55px] bg-slate-100" title={a.nombre}>{a.id}</th>
                      ))}
                      <th className="text-right px-2 py-2 bg-blue-100 text-blue-900">Total</th>
                      <th className="text-right px-2 py-2">AAA</th>
                      <th className="text-right px-2 py-2">Desc.</th>
                      <th className="text-right px-2 py-2">Precio C/Desc</th>
                      {canEdit && <th className="w-12"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((r) => (
                      <ReporteRow
                        key={r.id} r={r}
                        verAlmacenes={verAlmacenes}
                        canEdit={canEdit}
                        expanded={expandedSku === r.sku}
                        onToggleExpand={() => setExpandedSku(expandedSku === r.sku ? null : r.sku)}
                        onEditar={() => setModal({ tipo: 'editar', sku: r.s_raw })}
                        onEliminar={() => eliminarSku(r.id)}
                        onActualizarPrecio={actualizarPrecio}
                      />
                    ))}
                    {filtrados.length === 0 && (
                      <tr><td colSpan={20} className="text-center py-8 text-gray-400">Sin resultados</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Footer: explica origen de datos */}
              <div className="px-5 py-2 border-t border-gray-100 text-[11px] text-gray-500 italic space-y-0.5">
                <div>
                  <strong>Inventario:</strong> ERP Acteck (<code className="text-gray-600">inventario_acteck</code> · Vw_TablaH_Inventario.xlsx).
                  Mostrado: <strong>inventario total físico</strong>. Hover para ver disponible y apartado.
                  El asterisco amarillo (<span className="text-amber-600">*</span>) indica que hay piezas apartadas/comprometidas.
                </div>
                <div>
                  <strong>Precios:</strong> de tabla <code className="text-gray-600">precios_sku</code> (cargada desde "Roadmap y Precios").
                  Si editas aquí, override prevalece.
                  {canEdit && <span className="ml-1 text-blue-600">Click en el precio o descuento para editar.</span>}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {modal && (
        <ModalSku
          tipo={modal.tipo}
          sku={modal.sku}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); cargar(); }}
        />
      )}
    </div>
  );
}

// ────────── Fila de tabla con expand ──────────
function ReporteRow({ r, verAlmacenes, canEdit, expanded, onToggleExpand, onEditar, onEliminar, onActualizarPrecio }) {
  const rmStyle = roadmapStyle(r.roadmap);
  const rmInfo = roadmapInfo(r.roadmap);
  return (
    <>
      <tr className={["border-t border-gray-100 hover:bg-blue-50/30 cursor-pointer", expanded && "bg-blue-50/40"].filter(Boolean).join(" ")}
        onClick={onToggleExpand}>
        <td className="px-3 py-2 font-mono text-xs font-semibold text-gray-800">
          <div className="flex items-center gap-1">
            {expanded ? <ChevronDown className="w-3 h-3 text-blue-600"/> : <ChevronRight className="w-3 h-3 text-gray-400"/>}
            {r.sku}
          </div>
        </td>
        <td className="px-3 py-2">
          {r.roadmap && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded cursor-help"
              style={{ backgroundColor: rmStyle.bg, color: rmStyle.color }}
              title={rmInfo.descripcion || r.roadmap}>
              {r.roadmap}
            </span>
          )}
        </td>
        <td className="px-3 py-2 text-xs text-gray-700 truncate max-w-[280px]" title={r.descripcion}>{r.descripcion || '—'}</td>
        {verAlmacenes && ALMACENES.map((a) => {
          const cell = r.inv[a.id];
          const v = cell?.inv || 0;
          const disp = cell?.disp || 0;
          const apart = cell?.apartado || 0;
          const tooltip = v > 0
            ? `Inventario total: ${FMT_N(v)}\nDisponible: ${FMT_N(disp)}${apart > 0 ? `\nApartado/comprometido: ${FMT_N(apart)}` : ''}`
            : '';
          return (
            <td key={a.id} className={"text-right px-2 py-2 text-xs tabular-nums bg-slate-50 " + (v > 0 ? "text-gray-800" : "text-gray-300")}
              title={tooltip}>
              {v > 0 ? FMT_N(v) : '—'}
              {apart > 0 && <span className="text-amber-600 text-[9px] ml-0.5" title={tooltip}>*</span>}
            </td>
          );
        })}
        <td className="text-right px-2 py-2 tabular-nums font-bold bg-blue-50 text-blue-900"
          title={`Total: ${FMT_N(r.invTotal)}\nDisponible: ${FMT_N(r.invDisp)}${r.invApartado > 0 ? `\nApartado: ${FMT_N(r.invApartado)}` : ''}`}>
          {FMT_N(r.invTotal)}
        </td>
        <td className="text-right px-2 py-2 tabular-nums text-xs"
          onClick={(e) => e.stopPropagation()}>
          <PrecioCell
            valor={r.precio_aaa}
            esManual={r.precio_es_manual}
            canEdit={canEdit}
            tipo="moneda"
            onSave={(v) => onActualizarPrecio(r.id, 'precio_aaa_manual', v)}
            placeholder="—"
          />
        </td>
        <td className="text-right px-2 py-2 tabular-nums text-xs text-amber-700"
          onClick={(e) => e.stopPropagation()}>
          <PrecioCell
            valor={r.descuento}
            esManual={r.descuento_es_manual}
            canEdit={canEdit}
            tipo="porcentaje"
            onSave={(v) => onActualizarPrecio(r.id, 'descuento_manual', v)}
            placeholder="—"
          />
        </td>
        <td className="text-right px-2 py-2 tabular-nums font-semibold text-blue-700">
          {r.precio_descuento != null ? formatMXN(r.precio_descuento) : '—'}
        </td>
        {canEdit && (
          <td className="px-2 py-2">
            <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
              <button onClick={onEditar} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded" title="Editar">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onEliminar} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded" title="Quitar del reporte">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </td>
        )}
      </tr>
      {expanded && (
        <tr className="border-t border-gray-100 bg-blue-50/30">
          <td colSpan={20} className="p-4">
            <ExpandedDetail sku={r.sku} invTotal={r.invTotal} invDisp={r.invDisp} invApartado={r.invApartado} invPorAlmacen={r.inv} precioAaa={r.precio_aaa} />
          </td>
        </tr>
      )}
    </>
  );
}

// ────────── Celda editable inline para precio o descuento ──────────
function PrecioCell({ valor, esManual, canEdit, tipo, onSave, placeholder }) {
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState('');

  const display = valor == null ? null
    : tipo === 'porcentaje' ? `${Math.round(valor * 100)}%`
    : formatMXN(valor);

  const startEdit = () => {
    if (!canEdit) return;
    setVal(valor == null ? '' : tipo === 'porcentaje' ? Math.round(valor * 100) : valor);
    setEditing(true);
  };
  const commit = () => {
    if (val === '' || val == null) {
      onSave(null);
    } else {
      const n = Number(val);
      if (isNaN(n)) { setEditing(false); return; }
      const final = tipo === 'porcentaje' ? n / 100 : n;
      onSave(final);
    }
    setEditing(false);
  };

  if (editing) {
    return (
      <input
        autoFocus type="number" step={tipo === 'porcentaje' ? '1' : '0.01'}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEditing(false); }}
        className="w-20 px-1 py-0.5 text-xs text-right border border-blue-400 rounded bg-white"
      />
    );
  }
  return (
    <span
      onClick={canEdit ? startEdit : undefined}
      className={canEdit ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors" : ""}
      title={esManual ? "Override manual (click para editar)" : canEdit ? "De precios_sku — click para sobreescribir" : ""}
    >
      {display || placeholder}
      {esManual && <span className="ml-1 text-[8px] text-blue-600">●</span>}
    </span>
  );
}

// ────────── Detalle expandido ──────────
function ExpandedDetail({ sku, invTotal, invDisp, invApartado, invPorAlmacen, precioAaa }) {
  const [data, setData] = useState({ loading: true });

  useEffect(() => {
    (async () => {
      const hoy = new Date();
      const anioCorte = new Date(hoy.getFullYear(), hoy.getMonth() - 6, 1).getFullYear();
      const [demRes, traRes, ltRes, comRes] = await Promise.all([
        supabase.from('v_demanda_sku').select('cliente, anio, mes, piezas')
          .eq('sku', sku).gte('anio', anioCorte),
        supabase.from('v_transito_sku').select('*').eq('sku', sku).maybeSingle(),
        supabase.from('v_lead_time_sku').select('dias_promedio').eq('sku', sku).maybeSingle(),
        supabase.from('v_sku_compras_historico').select('*').eq('sku', sku).maybeSingle(),
      ]);
      setData({
        loading: false,
        demanda: demRes.data || [],
        transito: traRes.data,
        leadTime: ltRes.data?.dias_promedio,
        compras: comRes.data,
      });
    })();
  }, [sku]);

  if (data.loading) return <div className="text-xs text-gray-500">Cargando detalle…</div>;

  // Demanda mensual promedio últimos 3 meses por cliente
  const hoy = new Date();
  const mesesRef = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    mesesRef.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  const dem = { digitalife: [], pcel: [], mercadolibre: [] };
  data.demanda.forEach((d) => {
    if (mesesRef.some((m) => m.anio === d.anio && m.mes === Number(d.mes))) {
      if (dem[d.cliente]) dem[d.cliente].push(Number(d.piezas || 0));
    }
  });
  const promMes = (a) => a.length > 0 ? a.reduce((x, y) => x + y, 0) / 3 : 0;
  const demMes = {
    digitalife: promMes(dem.digitalife),
    pcel: promMes(dem.pcel),
    mercadolibre: promMes(dem.mercadolibre),
  };
  const demTotalMes = demMes.digitalife + demMes.pcel + demMes.mercadolibre;
  const dem3m = demTotalMes * 3;

  const traCant = Number(data.transito?.cantidad || 0);
  const traEta = data.transito?.eta_mas_cercana;
  const traEtaDias = traEta ? Math.round((new Date(traEta) - hoy) / 86400000) : null;

  // Sugerido compra: si demanda 3m > inv + tránsito → falta
  const brecha = Math.max(0, dem3m - invTotal - traCant);
  const buffer = demTotalMes; // 1 mes extra
  let sugerido = brecha > 0 ? Math.round(brecha + buffer) : 0;

  // Ajuste por contenedor (si hay datos históricos y no es consolidado)
  const com = data.compras;
  const piezasContenedor = com?.piezas_por_contenedor || 0;
  const esConsolidado = com?.es_consolidado === true;
  let contenedoresSugeridos = 0;
  if (sugerido > 0 && piezasContenedor > 0 && !esConsolidado) {
    contenedoresSugeridos = Math.ceil(sugerido / piezasContenedor);
    sugerido = contenedoresSugeridos * piezasContenedor;  // múltiplo del contenedor
  }

  const CLIENTES = [
    { key: 'digitalife',   label: 'Digitalife',    color: '#3B82F6' },
    { key: 'pcel',         label: 'PCEL',          color: '#EF4444' },
    { key: 'mercadolibre', label: 'Mercado Libre', color: '#F59E0B' },
  ];

  // ── Reservas: desglose por almacén ──
  const reservasPorAlmacen = ALMACENES
    .map((a) => {
      const cell = invPorAlmacen?.[a.id];
      return { id: a.id, nombre: a.nombre, apartado: cell?.apartado || 0, total: cell?.inv || 0 };
    })
    .filter((x) => x.apartado > 0);

  return (
    <div className="space-y-3 text-sm">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Demanda 3 clientes */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2">
            Demanda mensual prom (3m)
          </h4>
          <div className="space-y-1.5">
            {CLIENTES.map((c) => (
              <div key={c.key} className="flex items-center gap-2 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: c.color }} />
                <span className="flex-1 text-gray-700">{c.label}</span>
                <span className="font-semibold tabular-nums" style={{ color: demMes[c.key] > 0 ? c.color : '#CBD5E1' }}>
                  {FMT_N(demMes[c.key])}
                </span>
              </div>
            ))}
            <div className="border-t border-gray-100 pt-1.5 flex items-center gap-2 text-xs">
              <span className="flex-1 text-gray-500 font-medium">Total mes</span>
              <span className="font-bold tabular-nums">{FMT_N(demTotalMes)}</span>
            </div>
            <div className="text-[10px] text-gray-500 text-right">3m: {FMT_N(dem3m)} pzs</div>
          </div>
        </div>

        {/* Tránsito */}
        <div className="bg-white rounded-lg border border-gray-200 p-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2 flex items-center gap-1">
            <Ship className="w-3.5 h-3.5" /> Tránsito
          </h4>
          {traCant > 0 ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">Piezas:</span><span className="font-semibold tabular-nums">{FMT_N(traCant)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Próxima ETA:</span><span className="font-semibold">{fmtFechaCorta(traEta)}</span></div>
              {traEtaDias !== null && (
                <div className="flex justify-between"><span className="text-gray-600">En:</span>
                  <span className={"font-semibold " + (traEtaDias < 30 ? "text-emerald-700" : traEtaDias < 60 ? "text-amber-700" : "text-gray-700")}>
                    {traEtaDias < 0 ? `vencida (${-traEtaDias}d)` : `${traEtaDias} días`}
                  </span>
                </div>
              )}
              {data.leadTime && (
                <div className="flex justify-between text-gray-500"><span>Lead time prom:</span><span>{Math.round(data.leadTime)}d</span></div>
              )}
            </div>
          ) : (
            <div className="text-xs text-gray-400 italic">Sin tránsito programado</div>
          )}
        </div>

        {/* Reservas / Apartado */}
        <div className={[
          "rounded-lg p-3 border",
          invApartado > 0 ? "bg-amber-50 border-amber-200" : "bg-gray-50 border-gray-200",
        ].join(" ")}>
          <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-600 mb-2 flex items-center gap-1">
            <Package className="w-3.5 h-3.5" /> Reservado / Apartado
          </h4>
          {invApartado > 0 ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">Total apartado:</span><span className="font-semibold text-amber-700 tabular-nums">{FMT_N(invApartado)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Disponible real:</span><span className="font-semibold tabular-nums">{FMT_N(invDisp)}</span></div>
              <div className="flex justify-between text-gray-500"><span>Inventario total:</span><span className="tabular-nums">{FMT_N(invTotal)}</span></div>
              {reservasPorAlmacen.length > 0 && (
                <div className="border-t border-amber-200 pt-1.5 mt-1.5">
                  <div className="text-[10px] text-amber-800 font-semibold uppercase tracking-wide mb-1">Por almacén:</div>
                  <div className="space-y-0.5 max-h-24 overflow-y-auto">
                    {reservasPorAlmacen.map((x) => (
                      <div key={x.id} className="flex justify-between text-[11px]">
                        <span className="text-gray-600" title={x.nombre}>Almacén {x.id}</span>
                        <span className="font-semibold text-amber-700 tabular-nums">{FMT_N(x.apartado)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-[10px] text-gray-500 italic mt-1">
                Apartado = inv. total − disponible (no se sabe quién lo reservó hasta integrar el reporte del ERP)
              </div>
            </div>
          ) : (
            <div className="text-xs text-emerald-700">
              ✓ Sin piezas apartadas
              <div className="text-[10px] text-gray-500 mt-1">Todo el inventario ({FMT_N(invTotal)}) está disponible</div>
            </div>
          )}
        </div>

        {/* Sugerido de compra mejorado */}
        <div className={[
          "rounded-lg p-3 border",
          sugerido > 0 ? "bg-red-50 border-red-200" : "bg-emerald-50 border-emerald-200",
        ].join(" ")}>
          <h4 className="text-xs font-semibold uppercase tracking-wide mb-2 flex items-center gap-1"
            style={{ color: sugerido > 0 ? '#B91C1C' : '#065F46' }}>
            <ShoppingCart className="w-3.5 h-3.5" /> Sugerido de compra
          </h4>

          {/* Histórico de compras */}
          {com && (
            <div className="bg-white/60 rounded p-2 mb-2 space-y-0.5 text-[11px] border border-gray-200">
              <div className="flex justify-between"><span className="text-gray-600">Promedio histórico:</span><span className="font-semibold tabular-nums">{FMT_N(com.po_qty_promedio)} pzs ({com.num_compras} compras)</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Última compra:</span><span className="font-semibold tabular-nums">{FMT_N(com.ultima_po_qty)} ({com.ultima_po})</span></div>
              <div className="flex justify-between"><span className="text-gray-600">Último arribo:</span><span className="font-semibold">{fmtFechaCorta(com.ultima_fecha_arribo)}</span></div>
              {com.ultima_num_contenedores > 0 && piezasContenedor > 0 && (
                <div className="flex justify-between"><span className="text-gray-600">Por contenedor:</span><span className="font-semibold tabular-nums">{FMT_N(piezasContenedor)} pzs</span></div>
              )}
              {esConsolidado && (
                <div className="bg-purple-100 border border-purple-300 rounded px-1.5 py-1 mt-1 text-[10px] text-purple-800 font-semibold flex items-center gap-1">
                  📦 CONSOLIDADO {com.cbm_promedio && `· CBM ${Number(com.cbm_promedio).toFixed(2)}`}
                  <span className="text-purple-600 font-normal">(va con otros SKUs)</span>
                </div>
              )}
            </div>
          )}

          {sugerido > 0 ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between"><span className="text-gray-600">Brecha 3m:</span><span className="font-semibold text-red-700 tabular-nums">{FMT_N(brecha)}</span></div>
              <div className="flex justify-between"><span className="text-gray-600">+ buffer 1m:</span><span className="font-semibold tabular-nums">{FMT_N(buffer)}</span></div>
              {!esConsolidado && contenedoresSugeridos > 0 && (
                <div className="flex justify-between text-purple-700">
                  <span>Ajuste a contenedor:</span>
                  <span className="font-semibold">{contenedoresSugeridos} cont. × {FMT_N(piezasContenedor)}</span>
                </div>
              )}
              <div className="border-t border-red-200 pt-1 mt-1 flex justify-between font-bold">
                <span className="text-red-800">A comprar:</span>
                <span className="text-red-700 tabular-nums">{FMT_N(sugerido)} pzs</span>
              </div>
              {esConsolidado && com && (
                <div className="bg-purple-50 border border-purple-200 rounded px-1.5 py-1 text-[10px] text-purple-800 mt-1">
                  Como va consolidado, considera la <strong>cantidad de la última compra: {FMT_N(com.ultima_po_qty)} pzs</strong>
                </div>
              )}
              {precioAaa && (
                <div className="text-[10px] text-gray-600 mt-1">
                  ≈ {formatMXN(sugerido * precioAaa)} (a precio AAA)
                </div>
              )}
              <div className="text-[10px] text-gray-500 italic mt-1">
                Ver detalle completo en <strong>Forecast Clientes</strong>
              </div>
            </div>
          ) : (
            <div className="text-xs text-emerald-700">
              ✓ Inventario + tránsito cubre demanda 3m
              <div className="text-[10px] text-gray-500 mt-1">
                Inv {FMT_N(invTotal)} + Tránsito {FMT_N(traCant)} ≥ Demanda {FMT_N(dem3m)}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────── Modal agregar/editar SKU ──────────
function ModalSku({ tipo, sku, onClose, onSaved }) {
  const editar = tipo === 'editar';
  const [form, setForm] = useState(() => ({
    sku: sku?.sku || '',
    roadmap_manual: sku?.roadmap_manual || '',
    descripcion_manual: sku?.descripcion_manual || '',
    notas: sku?.notas || '',
    precio_aaa_manual: sku?.precio_aaa_manual || '',
    descuento_manual: sku?.descuento_manual || '',
  }));
  const [posicion, setPosicion] = useState({ tipo: 'final', referencia: null });
  const [skusExistentes, setSkusExistentes] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editar) {
      supabase.from('reporte_skus').select('id, sku, orden').eq('activo', true).order('orden')
        .then(({ data }) => setSkusExistentes(data || []));
    }
  }, [editar]);

  async function guardar() {
    if (!form.sku.trim()) { toast.error('SKU requerido'); return; }
    setSaving(true);

    if (editar) {
      const { error } = await supabase.from('reporte_skus').update({
        roadmap_manual: form.roadmap_manual || null,
        descripcion_manual: form.descripcion_manual || null,
        notas: form.notas || null,
        precio_aaa_manual: form.precio_aaa_manual ? Number(form.precio_aaa_manual) : null,
        descuento_manual: form.descuento_manual ? Number(form.descuento_manual) : null,
      }).eq('id', sku.id);
      if (error) { toast.error('Error: ' + error.message); setSaving(false); return; }
      toast.success('Actualizado');
      onSaved();
      return;
    }

    // Nuevo: calcular orden según posición
    let nuevoOrden;
    if (posicion.tipo === 'inicio') {
      nuevoOrden = 0.5;
    } else if (posicion.tipo === 'final') {
      const max = skusExistentes.length > 0 ? Math.max(...skusExistentes.map((s) => s.orden)) : 0;
      nuevoOrden = max + 1;
    } else if (posicion.tipo === 'despues' && posicion.referencia) {
      const ref = skusExistentes.find((s) => s.id === Number(posicion.referencia));
      const idx = skusExistentes.findIndex((s) => s.id === Number(posicion.referencia));
      const next = skusExistentes[idx + 1];
      nuevoOrden = next ? (ref.orden + next.orden) / 2 : ref.orden + 1;
    } else {
      nuevoOrden = skusExistentes.length + 1;
    }

    const perfil = (await supabase.auth.getUser()).data.user;
    const { error } = await supabase.from('reporte_skus').insert({
      sku: form.sku.trim(),
      orden: nuevoOrden,
      roadmap_manual: form.roadmap_manual || null,
      descripcion_manual: form.descripcion_manual || null,
      notas: form.notas || null,
      precio_aaa_manual: form.precio_aaa_manual ? Number(form.precio_aaa_manual) : null,
      descuento_manual: form.descuento_manual ? Number(form.descuento_manual) : null,
      created_by: perfil?.id || null,
    });
    if (error) { toast.error('Error: ' + error.message); setSaving(false); return; }
    toast.success('SKU agregado al reporte');
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2">
            <Package className="w-4 h-4" />
            {editar ? `Editar ${sku.sku}` : 'Nuevo SKU al reporte'}
          </h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="SKU">
            <input value={form.sku} disabled={editar}
              onChange={(e) => setForm({ ...form, sku: e.target.value.toUpperCase() })}
              placeholder="Ej. AC-944519"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono disabled:bg-gray-50" />
          </Field>
          <Field label="Roadmap (RMI, NVS, 2026, etc)">
            <input value={form.roadmap_manual}
              onChange={(e) => setForm({ ...form, roadmap_manual: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <Field label="Descripción">
            <textarea value={form.descripcion_manual} rows={3}
              onChange={(e) => setForm({ ...form, descripcion_manual: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio AAA (opcional, si no está en BD)">
              <input type="number" value={form.precio_aaa_manual}
                onChange={(e) => setForm({ ...form, precio_aaa_manual: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Descuento (0.10 = 10%)">
              <input type="number" step="0.01" value={form.descuento_manual}
                onChange={(e) => setForm({ ...form, descuento_manual: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
          </div>
          <Field label="Notas">
            <input value={form.notas}
              onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>

          {!editar && (
            <Field label="Posición en la lista">
              <div className="space-y-2">
                <select value={posicion.tipo}
                  onChange={(e) => setPosicion({ tipo: e.target.value, referencia: null })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                  <option value="final">Al final</option>
                  <option value="inicio">Al inicio</option>
                  <option value="despues">Después de…</option>
                </select>
                {posicion.tipo === 'despues' && (
                  <select value={posicion.referencia || ''}
                    onChange={(e) => setPosicion({ tipo: 'despues', referencia: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="">Selecciona SKU…</option>
                    {skusExistentes.map((s) => <option key={s.id} value={s.id}>#{s.orden} · {s.sku}</option>)}
                  </select>
                )}
              </div>
            </Field>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
            {saving ? 'Guardando…' : editar ? 'Guardar' : 'Agregar al reporte'}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
