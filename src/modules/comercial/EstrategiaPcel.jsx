import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { formatMXN } from "../../lib/utils";
import { fetchHistoricoComprasPcel, fetchSnapshotPcel } from "../../lib/pcelAdapter";
import {
  Package, Search, Download, ChevronDown, ChevronRight,
  TrendingUp, AlertTriangle, Truck, Warehouse,
} from "lucide-react";

/**
 * Estrategia de Producto — PCEL
 * ──────────────────────────────
 * PCEL = cliente de volumen y ticket alto, pocos SKUs, compras grandes
 * divididas en 2-3 splits.
 *
 * Fórmula del sugerido:
 *   promedio_historico  = piezas/compra en los últimos X meses (3/6/12)
 *   sellout_reciente    = (vta_mes_actual + vta_mes_1 + vta_mes_2) / 3
 *   ratio               = sellout_reciente / promedio_historico
 *
 *   if ratio > 1                → sugerido_base = promedio * ratio
 *   elif cobertura > 4 meses    → sugerido_base = 0
 *   else                        → sugerido_base = promedio
 *
 *   sugerido_ideal = max(0, sugerido_base − inv_PCEL − transito_PCEL) + back_order
 *   sugerido_disponible = min(sugerido_ideal, inv_Acteck + transito_Acteck)
 */

const ACTECK_ALMACENES = [1, 2, 3, 4, 14, 16, 17, 25, 44];

// Formato int
const fmtInt = (n) => {
  if (n === null || n === undefined || isNaN(n)) return "—";
  return Math.round(Number(n)).toLocaleString("es-MX");
};

// Semáforo de cobertura
function coberturaColor(meses) {
  if (meses === null || meses === undefined || !isFinite(meses)) return "text-gray-400";
  if (meses < 2) return "text-emerald-600 font-semibold";
  if (meses <= 4) return "text-amber-600 font-semibold";
  return "text-red-600 font-semibold";
}

export default function EstrategiaPcel() {
  const [periodoMeses, setPeriodoMeses] = useState(() => {
    try { return parseInt(localStorage.getItem("pcel_estrategia_meses")) || 6; } catch { return 6; }
  });
  useEffect(() => {
    try { localStorage.setItem("pcel_estrategia_meses", String(periodoMeses)); } catch {}
  }, [periodoMeses]);

  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot]     = useState([]);  // sellout_pcel última semana
  const [historico, setHistorico]   = useState({});  // { sku: { piezas, facturas, promedio } }
  const [invActeck, setInvActeck]   = useState({});  // { sku: piezas }
  const [transitoActeck, setTransitoActeck] = useState({}); // { sku: { piezas, fecha } }
  const [busqueda, setBusqueda]     = useState("");
  const [filtroFamilia, setFiltroFamilia] = useState("todas");
  const [expandirVentas, setExpandirVentas] = useState(false);
  const [soloConSugerido, setSoloConSugerido] = useState(false);

  useEffect(() => {
    cargar();
    // eslint-disable-next-line
  }, [periodoMeses]);

  async function cargar() {
    setLoading(true);
    try {
      const [snap, hist, invAct, transAct] = await Promise.all([
        fetchSnapshotPcel(),
        fetchHistoricoComprasPcel(periodoMeses),
        supabase
          .from("inventario_acteck")
          .select("articulo, no_almacen, disponible")
          .in("no_almacen", ACTECK_ALMACENES)
          .then((r) => r.data || []),
        supabase
          .from("transito_sku")
          .select("sku, inventario_transito, siguiente_arribo")
          .then((r) => r.data || []),
      ]);
      setSnapshot(snap);
      setHistorico(hist);

      // Acumular inv_acteck por SKU (sum across almacenes)
      const inv = {};
      (invAct || []).forEach((r) => {
        if (!r.articulo) return;
        inv[r.articulo] = (inv[r.articulo] || 0) + (Number(r.disponible) || 0);
      });
      setInvActeck(inv);

      const trans = {};
      (transAct || []).forEach((r) => {
        if (!r.sku) return;
        trans[r.sku] = {
          piezas: Number(r.inventario_transito) || 0,
          fecha: r.siguiente_arribo || null,
        };
      });
      setTransitoActeck(trans);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }

  // Construir filas enriquecidas con cálculos
  const filas = useMemo(() => {
    return snapshot.map((r) => {
      const sku = r.sku;
      const hist = historico[sku] || { piezas: 0, facturas: 0, promedio: 0 };
      const invA = invActeck[sku] || 0;
      const transA = transitoActeck[sku] || { piezas: 0, fecha: null };

      const invPcel    = Number(r.inventario) || 0;
      const transPcel  = Number(r.transito) || 0;
      const backOrder  = Number(r.back_order) || 0;

      const vmAct = Number(r.vta_mes_actual) || 0;
      const vm1   = Number(r.vta_mes_1) || 0;
      const vm2   = Number(r.vta_mes_2) || 0;
      const vm3   = Number(r.vta_mes_3) || 0;
      const ventasMeses = [vmAct, vm1, vm2].filter((v) => v > 0);
      const selloutReciente = ventasMeses.length > 0
        ? ventasMeses.reduce((a, b) => a + b, 0) / ventasMeses.length
        : Number(r.vta_semana || 0) * 4.33; // fallback si no hay vta_mes_*

      const promedio = hist.promedio;

      // Cobertura en meses
      const cobertura = selloutReciente > 0
        ? (invPcel + transPcel) / selloutReciente
        : null;

      // Cálculo del sugerido base
      let sugeridoBase;
      if (promedio > 0 && selloutReciente > 0) {
        const ratio = selloutReciente / promedio;
        if (ratio > 1) {
          sugeridoBase = promedio * ratio;
        } else if (cobertura !== null && cobertura > 4) {
          sugeridoBase = 0;
        } else {
          sugeridoBase = promedio;
        }
      } else {
        sugeridoBase = promedio; // sin sellout reciente, proponer el promedio histórico
      }

      const sugeridoIdeal = Math.max(0, sugeridoBase - invPcel - transPcel) + backOrder;
      const disponibilidadActeck = invA + transA.piezas;
      const sugeridoDisponible = Math.min(sugeridoIdeal, disponibilidadActeck);
      const gap = Math.max(0, sugeridoIdeal - sugeridoDisponible);

      return {
        sku, producto: r.producto, marca: r.marca, familia: r.familia, subfamilia: r.subfamilia,
        invPcel, transPcel, backOrder,
        vmAct, vm1, vm2, vm3, vtaSemana: Number(r.vta_semana) || 0,
        selloutReciente,
        cobertura,
        promedio, facturas: hist.facturas, piezasHist: hist.piezas,
        invActeck: invA, transitoActeck: transA.piezas, fechaArribo: transA.fecha,
        sugeridoBase, sugeridoIdeal, sugeridoDisponible, gap,
        costo: Number(r.costo_promedio) || 0,
        antiguedad: Number(r.antiguedad) || 0,
      };
    });
  }, [snapshot, historico, invActeck, transitoActeck]);

  // Filtros
  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filas.filter((f) => {
      if (soloConSugerido && f.sugeridoIdeal <= 0) return false;
      if (filtroFamilia !== "todas" && (f.familia || "") !== filtroFamilia) return false;
      if (q) {
        const hit = (f.sku || "").toLowerCase().includes(q)
          || (f.producto || "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return true;
    }).sort((a, b) => b.sugeridoIdeal - a.sugeridoIdeal);
  }, [filas, busqueda, filtroFamilia, soloConSugerido]);

  // Familias únicas
  const familias = useMemo(() => {
    const s = new Set(filas.map((f) => f.familia).filter(Boolean));
    return Array.from(s).sort();
  }, [filas]);

  // Totales del footer
  const totales = useMemo(() => {
    const res = filasFiltradas.reduce(
      (acc, f) => {
        acc.sugeridoIdeal     += f.sugeridoIdeal || 0;
        acc.sugeridoDisponible += f.sugeridoDisponible || 0;
        acc.gap                += f.gap || 0;
        acc.backOrder          += f.backOrder || 0;
        acc.montoSugerido      += (f.sugeridoIdeal || 0) * (f.costo || 0);
        return acc;
      },
      { sugeridoIdeal: 0, sugeridoDisponible: 0, gap: 0, backOrder: 0, montoSugerido: 0 }
    );
    return res;
  }, [filasFiltradas]);

  // Export CSV
  function exportarCSV() {
    const headers = [
      "SKU", "Producto", "Marca", "Familia",
      "Inv PCEL", "Tránsito PCEL", "Back order",
      "Venta mes actual", "Venta mes -1", "Venta mes -2", "Venta mes -3",
      "Venta prom (3m)", "Cobertura (meses)",
      "Prom compra", "Facturas", "Piezas hist",
      "Inv Acteck", "Tránsito Acteck", "Fecha arribo",
      "Sugerido ideal", "Sugerido disponible", "Gap",
      "Costo unit", "Monto sugerido",
    ];
    const rows = filasFiltradas.map((f) => [
      f.sku, f.producto || "", f.marca || "", f.familia || "",
      f.invPcel, f.transPcel, f.backOrder,
      f.vmAct, f.vm1, f.vm2, f.vm3,
      Math.round(f.selloutReciente),
      f.cobertura !== null ? f.cobertura.toFixed(1) : "",
      Math.round(f.promedio), f.facturas, f.piezasHist,
      f.invActeck, f.transitoActeck, f.fechaArribo || "",
      Math.round(f.sugeridoIdeal), Math.round(f.sugeridoDisponible), Math.round(f.gap),
      f.costo.toFixed(2), Math.round(f.sugeridoIdeal * f.costo),
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((c) => {
        const s = String(c ?? "");
        return s.includes(",") || s.includes("\"") ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(","))
      .join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `estrategia-pcel-${periodoMeses}m-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-gray-700" />
            Estrategia de Producto — PCEL
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Sugerido de próximo pedido por SKU basado en sell-in, sellout e inventario.
          </p>
        </div>
        <button
          onClick={exportarCSV}
          className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-1.5"
        >
          <Download className="w-4 h-4" />
          Exportar CSV
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard
          label="SKUs con sugerido"
          value={filasFiltradas.filter((f) => f.sugeridoIdeal > 0).length}
          suffix={`de ${filasFiltradas.length}`}
          icon={TrendingUp}
          color="blue"
        />
        <KpiCard
          label="Piezas sugeridas (ideal)"
          value={fmtInt(totales.sugeridoIdeal)}
          suffix={totales.gap > 0 ? `${fmtInt(totales.gap)} sin stock` : null}
          suffixColor={totales.gap > 0 ? "text-red-600" : ""}
          icon={Package}
          color="emerald"
        />
        <KpiCard
          label="Back orders pendientes"
          value={fmtInt(totales.backOrder)}
          icon={AlertTriangle}
          color={totales.backOrder > 0 ? "red" : "gray"}
        />
        <KpiCard
          label="Monto sugerido (costo)"
          value={formatMXN(Math.round(totales.montoSugerido))}
          icon={Warehouse}
          color="purple"
        />
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-2 flex-wrap">
        {/* Buscador */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o producto…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 text-sm"
          />
        </div>
        {/* Familia */}
        <select
          value={filtroFamilia}
          onChange={(e) => setFiltroFamilia(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="todas">Todas las familias</option>
          {familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        {/* Periodo histórico */}
        <div className="flex items-center gap-1.5 bg-gray-50 rounded-lg border border-gray-200 px-2 py-1">
          <span className="text-xs text-gray-500">Histórico:</span>
          {[3, 6, 12].map((m) => (
            <button
              key={m}
              onClick={() => setPeriodoMeses(m)}
              className={[
                "text-xs px-2 py-0.5 rounded-md font-semibold transition",
                periodoMeses === m ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-200",
              ].join(" ")}
            >
              {m}m
            </button>
          ))}
        </div>
        {/* Solo con sugerido */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={soloConSugerido}
            onChange={(e) => setSoloConSugerido(e.target.checked)}
            className="rounded border-gray-300"
          />
          Solo con sugerido
        </label>
        {/* Expandir ventas mes */}
        <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={expandirVentas}
            onChange={(e) => setExpandirVentas(e.target.checked)}
            className="rounded border-gray-300"
          />
          Ver meses de sellout
        </label>

        <span className="ml-auto text-xs text-gray-400">
          {filasFiltradas.length} de {filas.length} SKUs
        </span>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-x-auto">
        {loading ? (
          <p className="p-8 text-center text-gray-400">Cargando datos de PCEL…</p>
        ) : filas.length === 0 ? (
          <p className="p-8 text-center text-gray-400">
            No hay datos de sellout_pcel cargados aún.
          </p>
        ) : (
          <table className="w-full text-[13px] min-w-[1200px]">
            <thead>
              <tr className="border-b-2 border-gray-200 text-[11px] uppercase text-gray-500">
                <th className="text-left px-3 py-2 sticky left-0 bg-white z-10">SKU / Producto</th>
                <th className="text-center px-2 py-2 bg-blue-50">Inv PCEL</th>
                <th className="text-center px-2 py-2 bg-blue-50">Tránsito PCEL</th>
                <th className="text-center px-2 py-2 bg-red-50">Back order</th>
                {expandirVentas && (
                  <>
                    <th className="text-center px-2 py-2 bg-gray-50" title="Venta mes actual">VM act</th>
                    <th className="text-center px-2 py-2 bg-gray-50" title="Venta mes -1">VM -1</th>
                    <th className="text-center px-2 py-2 bg-gray-50" title="Venta mes -2">VM -2</th>
                    <th className="text-center px-2 py-2 bg-gray-50" title="Venta mes -3">VM -3</th>
                  </>
                )}
                <th className="text-center px-2 py-2 bg-gray-50">Prom 3m</th>
                <th className="text-center px-2 py-2 bg-gray-50">Cobertura</th>
                <th className="text-center px-2 py-2 bg-amber-50" title={`Prom piezas/compra últimos ${periodoMeses} meses`}>
                  Prom compra
                </th>
                <th className="text-center px-2 py-2 bg-emerald-50">Inv Acteck</th>
                <th className="text-center px-2 py-2 bg-emerald-50">Tránsito Acteck</th>
                <th className="text-center px-2 py-2 bg-indigo-50 font-bold">Sugerido ideal</th>
                <th className="text-center px-2 py-2 bg-indigo-50 font-bold">Sugerido disp.</th>
                <th className="text-center px-2 py-2">$ Costo</th>
              </tr>
            </thead>
            <tbody>
              {filasFiltradas.map((f) => {
                const hayGap = f.gap > 0;
                const hayBO = f.backOrder > 0;
                return (
                  <tr key={f.sku} className="border-b border-gray-50 hover:bg-blue-50/30">
                    {/* SKU + Producto */}
                    <td className="px-3 py-2 sticky left-0 bg-white z-10">
                      <div className="font-mono text-xs text-gray-600">{f.sku}</div>
                      <div className="text-[12px] text-gray-800 max-w-[260px] truncate" title={f.producto}>
                        {f.producto || "—"}
                      </div>
                      <div className="text-[10px] text-gray-400">
                        {f.marca} · {f.familia}
                      </div>
                    </td>
                    <td className="text-center px-2 py-2 bg-blue-50/40">{fmtInt(f.invPcel)}</td>
                    <td className="text-center px-2 py-2 bg-blue-50/40 text-gray-600">{fmtInt(f.transPcel)}</td>
                    <td className={`text-center px-2 py-2 ${hayBO ? "bg-red-100 text-red-700 font-bold" : "bg-red-50/40 text-gray-400"}`}>
                      {fmtInt(f.backOrder)}
                    </td>
                    {expandirVentas && (
                      <>
                        <td className="text-center px-2 py-2 text-gray-600">{fmtInt(f.vmAct)}</td>
                        <td className="text-center px-2 py-2 text-gray-600">{fmtInt(f.vm1)}</td>
                        <td className="text-center px-2 py-2 text-gray-600">{fmtInt(f.vm2)}</td>
                        <td className="text-center px-2 py-2 text-gray-600">{fmtInt(f.vm3)}</td>
                      </>
                    )}
                    <td className="text-center px-2 py-2 font-medium">{fmtInt(f.selloutReciente)}</td>
                    <td className={`text-center px-2 py-2 ${coberturaColor(f.cobertura)}`}>
                      {f.cobertura !== null && isFinite(f.cobertura) ? `${f.cobertura.toFixed(1)}m` : "—"}
                    </td>
                    <td className="text-center px-2 py-2 bg-amber-50/30">
                      <div className="font-semibold">{fmtInt(f.promedio)}</div>
                      <div className="text-[10px] text-gray-400">{f.facturas} compras</div>
                    </td>
                    <td className="text-center px-2 py-2 bg-emerald-50/30">{fmtInt(f.invActeck)}</td>
                    <td className="text-center px-2 py-2 bg-emerald-50/30">
                      {fmtInt(f.transitoActeck)}
                      {f.transitoActeck > 0 && f.fechaArribo && (
                        <div className="text-[10px] text-gray-400 flex items-center justify-center gap-0.5">
                          <Truck className="w-2.5 h-2.5" />
                          {f.fechaArribo}
                        </div>
                      )}
                    </td>
                    <td className="text-center px-2 py-2 bg-indigo-50/60 font-bold text-indigo-800">
                      {fmtInt(f.sugeridoIdeal)}
                    </td>
                    <td className={`text-center px-2 py-2 bg-indigo-50/60 font-bold ${hayGap ? "text-red-700" : "text-indigo-800"}`}>
                      {fmtInt(f.sugeridoDisponible)}
                      {hayGap && (
                        <div className="text-[10px] text-red-500 font-normal">
                          −{fmtInt(f.gap)} sin stock
                        </div>
                      )}
                    </td>
                    <td className="text-center px-2 py-2 text-gray-600">
                      {f.costo > 0 ? formatMXN(Math.round(f.costo)) : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            {/* Totales */}
            <tfoot>
              <tr className="border-t-2 border-gray-200 font-bold bg-gray-50/80 text-[13px]">
                <td className="px-3 py-2 sticky left-0 bg-gray-50 z-10">
                  Totales ({filasFiltradas.length} SKUs)
                </td>
                <td colSpan={expandirVentas ? 10 : 6}></td>
                <td className="text-center px-2 py-2 bg-red-50">{fmtInt(totales.backOrder)}</td>
                <td colSpan={2}></td>
                <td className="text-center px-2 py-2 bg-indigo-100 text-indigo-800">
                  {fmtInt(totales.sugeridoIdeal)}
                </td>
                <td className="text-center px-2 py-2 bg-indigo-100 text-indigo-800">
                  {fmtInt(totales.sugeridoDisponible)}
                </td>
                <td className="text-center px-2 py-2 text-gray-700">
                  {formatMXN(Math.round(totales.montoSugerido))}
                </td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      {/* Leyenda */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-lg px-3 py-2 space-y-1">
        <p>
          <strong>Fórmula:</strong> Si sellout reciente ({">"}) promedio histórico →
          aumenta proporcional. Si cobertura {">"} 4 meses → sugerido = 0. Cap al
          inventario disponible (Acteck + tránsito).
        </p>
        <p>
          <span className="inline-block w-3 h-3 bg-emerald-100 border border-emerald-300 rounded mr-1"></span>
          Cobertura {"<"} 2m (saludable) ·
          <span className="inline-block w-3 h-3 bg-amber-100 border border-amber-300 rounded mx-1"></span>
          2-4m (OK) ·
          <span className="inline-block w-3 h-3 bg-red-100 border border-red-300 rounded mx-1"></span>
          {">"} 4m (sobre-inventariado)
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
function KpiCard({ label, value, suffix, suffixColor, icon: Icon, color }) {
  const colorMap = {
    blue:    "bg-blue-50 text-blue-700 border-blue-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    amber:   "bg-amber-50 text-amber-700 border-amber-100",
    red:     "bg-red-50 text-red-700 border-red-100",
    purple:  "bg-purple-50 text-purple-700 border-purple-100",
    gray:    "bg-gray-50 text-gray-700 border-gray-100",
  }[color] || "bg-gray-50 text-gray-700 border-gray-100";
  return (
    <div className={`rounded-xl p-3 border ${colorMap}`}>
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide opacity-80">
        {Icon && <Icon className="w-3.5 h-3.5" />}
        {label}
      </div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
      {suffix && (
        <div className={`text-[11px] mt-0.5 ${suffixColor || "opacity-60"}`}>{suffix}</div>
      )}
    </div>
  );
}
