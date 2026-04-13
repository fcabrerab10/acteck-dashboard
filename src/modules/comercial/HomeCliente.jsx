import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { clientes } from '../../lib/constants';
import { formatMXN, formatFecha, calcularSalud, loadSheetJS } from '../../lib/utils';
import { Semaforo, TarjetaPendientes } from '../../components';

function ActualizarDatosExcel({ cliente, anio, onComplete }) {
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const fileRef = React.useRef(null);

  const procesarArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    setResultado(null);
    try {
      const XLSX = await loadSheetJS();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });

      if (!rows.length) throw new Error("El archivo no contiene datos");

      // Detectar columnas flexiblemente
      const colMap = detectarColumnas(Object.keys(rows[0]));
      if (!colMap.mes) throw new Error("No se encontr\u00F3 columna de Mes");
      if (!colMap.sellIn && !colMap.sellOut) throw new Error("No se encontr\u00F3 columna de Sell In o Sell Out");

      const registros = rows.map(r => {
        const mesVal = parseMes(r[colMap.mes]);
        if (!mesVal) return null;
        const reg = { cliente, mes: mesVal, anio: anio || 2026 };
        if (colMap.sellIn) reg.sell_in = parseNum(r[colMap.sellIn]);
        if (colMap.sellOut) reg.sell_out = parseNum(r[colMap.sellOut]);
        if (colMap.cuota) reg.cuota = parseNum(r[colMap.cuota]);
        if (colMap.invDias) reg.inventario_dias = parseNum(r[colMap.invDias]);
        if (colMap.invValor) reg.inventario_valor = parseNum(r[colMap.invValor]);
        return reg;
      }).filter(Boolean);

      if (!registros.length) throw new Error("No se pudieron parsear registros v\u00E1lidos");

      // Upsert a Supabase
      const { error } = await supabase
        .from("ventas_mensuales")
        .upsert(registros, { onConflict: "cliente,mes,anio" });

      if (error) throw error;
      setResultado({ ok: true, msg: registros.length + " meses actualizados" });
      if (onComplete) onComplete();
    } catch (err) {
      setResultado({ ok: false, msg: err.message || "Error al procesar" });
    } finally {
      setCargando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return React.createElement("div", { className: "inline-flex items-center gap-2" },
    React.createElement("input", {
      ref: fileRef, type: "file", accept: ".xlsx,.xls,.csv",
      onChange: procesarArchivo, className: "hidden", id: "excel-upload"
    }),
    React.createElement("label", {
      htmlFor: "excel-upload",
      className: "cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg " +
        (cargando ? "bg-gray-200 text-gray-400" : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200")
    }, cargando ? "\u23F3 Procesando..." : "\uD83D\uDCC2 Actualizar desde Excel"),
    resultado && React.createElement("span", {
      className: "text-xs " + (resultado.ok ? "text-green-600" : "text-red-500")
    }, resultado.ok ? "\u2705 " + resultado.msg : "\u274C " + resultado.msg)
  );
}

// Helpers para parseo de Excel
function detectarColumnas(headers) {
  const map = {};
  const lower = headers.map(h => ({ orig: h, lc: String(h).toLowerCase().trim() }));
  for (const { orig, lc } of lower) {
    if (/mes|month|periodo/i.test(lc)) map.mes = orig;
    else if (/sell.?in|venta.?in|compra/i.test(lc)) map.sellIn = orig;
    else if (/sell.?out|venta.?out|sellout/i.test(lc)) map.sellOut = orig;
    else if (/cuota|quota|objetivo|meta/i.test(lc)) map.cuota = orig;
    else if (/inv.*d[ií]a|days.*inv/i.test(lc)) map.invDias = orig;
    else if (/inv.*val|valor.*inv/i.test(lc)) map.invValor = orig;
  }
  return map;
}

function parseMes(val) {
  if (typeof val === "number" && val >= 1 && val <= 12) return val;
  const s = String(val).toLowerCase().trim();
  const meses = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  if (meses[s]) return meses[s];
  const n = parseInt(s);
  return (n >= 1 && n <= 12) ? n : null;
}

function parseNum(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  return parseFloat(String(val).replace(/[,$\s]/g, "")) || 0;
}


function TarjetaSellOutMarca({ sellOutMarca, totalMonto }) {
  const marcas = Object.entries(sellOutMarca || {}).sort((a, b) => b[1] - a[1]);
  const colores = { ACTECK: "#DC2626", "BALAM RUSH": "#2563EB", OTRO: "#6B7280" };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🏷️</span>
        <h3 className="font-semibold text-gray-800">Sell Out por Marca (ML)</h3>
      </div>
      <div className="space-y-3">
        {marcas.map(([marca, monto]) => {
          const pct = totalMonto > 0 ? ((monto / totalMonto) * 100) : 0;
          return (
            <div key={marca}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium" style={{ color: colores[marca] || "#6B7280" }}>{marca}</span>
                <span className="text-gray-600">{"$"}{Math.round(monto).toLocaleString("es-MX")}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="h-2.5 rounded-full" style={{ width: pct + "%", backgroundColor: colores[marca] || "#6B7280" }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(0)}% del total</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">
        Total sell-out ML <span className="font-semibold text-gray-800">{"$"}{Math.round(totalMonto).toLocaleString("es-MX")}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{Math.round(totalMonto) > 0 ? (marcas.length + " marcas · " + Math.round(totalMonto).toLocaleString("es-MX") + " total") : ""}</div>
    </div>
  );
}

function TarjetaTendenciaML({ sellOutPorMesMarca }) {
  const meses = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const data = Object.entries(sellOutPorMesMarca || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxTotal = Math.max(...data.map(([, v]) => (v.ACTECK || 0) + (v["BALAM RUSH"] || 0) + (v.OTRO || 0)), 1);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📈</span>
        <h3 className="font-semibold text-gray-800">Tendencia Sell Out ML por Mes</h3>
      </div>
      <div className="space-y-3">
        {data.map(([mes, vals]) => {
          const act = vals.ACTECK || 0; const br = vals["BALAM RUSH"] || 0; const otro = vals.OTRO || 0;
          const total = act + br + otro;
          return (
            <div key={mes}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{meses[Number(mes)]}</span>
                <span className="text-gray-600">{"$"}{Math.round(total).toLocaleString("es-MX")}</span>
              </div>
              <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
                <div style={{ width: ((act/maxTotal)*100)+"%", backgroundColor: "#DC2626" }}></div>
                <div style={{ width: ((br/maxTotal)*100)+"%", backgroundColor: "#2563EB" }}></div>
                <div style={{ width: ((otro/maxTotal)*100)+"%", backgroundColor: "#D1D5DB" }}></div>
              </div>
              <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                <span>Acteck: {"$"}{Math.round(act).toLocaleString("es-MX")}</span>
                <span>BR: {"$"}{Math.round(br).toLocaleString("es-MX")}</span>
                <span>Otro: {"$"}{Math.round(otro).toLocaleString("es-MX")}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span>Acteck</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span>Balam Rush</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300"></span>Otro</span>
      </div>
    </div>
  );
}

export default function HomeCliente({ cliente, clienteKey, onUploadComplete, isML }) {

  // ML-specific view
  if (isML) {
    const mesesNombres = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const mesesData = Object.keys(cliente.sellOutPorMesMarca || {}).sort((a,b) => Number(a) - Number(b));
    const lastMes = mesesData.length > 0 ? mesesData[mesesData.length - 1] : null;
    const mesLabel = lastMes ? mesesNombres[Number(lastMes)] : "---";
    const sellOutMes = lastMes && cliente.tendencia && cliente.tendencia.sellOut ? cliente.tendencia.sellOut[cliente.tendencia.sellOut.length - 1] || 0 : 0;
    const acumulado = cliente.totalMonto || 0;
    const ordenes = cliente.totalOrdenes || 0;
    const ticketProm = ordenes > 0 ? Math.round(acumulado / ordenes) : 0;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💰</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Sell Out {mesLabel}</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{"$"}{sellOutMes.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📈</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Acumulado 2026</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{"$"}{acumulado.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Total Ordenes 2026</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{ordenes.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🎯</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Ticket Promedio</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{"$"}{ticketProm.toLocaleString("es-MX")}</p>
          </div>
        </div>
        <TarjetaSellOutMarca sellOutMarca={cliente.sellOutMarca} totalMonto={cliente.totalMonto} />
        <TarjetaTendenciaML sellOutPorMesMarca={cliente.sellOutPorMesMarca} />
        {cliente.pendientes && cliente.pendientes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Pendientes</h3>
            <ul className="space-y-2">
              {cliente.pendientes.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-yellow-500 mt-0.5">⚠️</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  const [ventas, setVentas] = React.useState([]);
  const clienteCuota = (clientes[clienteKey] && clientes[clienteKey].cuotaAnual) || 30000000;
    const clienteCuotaMin = (clientes[clienteKey] && clientes[clienteKey].cuotaMinima) || Math.round(clienteCuota * 0.83);
  const [meta, setMeta] = React.useState({ meta_sell_in_min: clienteCuotaMin, meta_sell_in_optimista: clienteCuota });
  const [pendCom, setPendCom] = React.useState([]);
  const [pendMkt, setPendMkt] = React.useState([]);
  const [invMkt, setInvMkt] = React.useState([]);
  const [minutasList, setMinutasList] = React.useState([]);
  const [invCliente, setInvCliente] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editingMeta, setEditingMeta] = React.useState(false);
  const [metaForm, setMetaForm] = React.useState({ min: 25000000, opt: 30000000 });
  const [anioResumen, setAnioResumen] = React.useState(2026);
  const [sellInSku, setSellInSku] = React.useState([]);
  const [sellOutSku, setSellOutSku] = React.useState([]);
  const [periodoTipo, setPeriodoTipo] = React.useState('ytd');
  const [periodoMes, setPeriodoMes] = React.useState(new Date().getMonth() + 1);
  const [periodoRango, setPeriodoRango] = React.useState([1, 12]);
  const [cuotasMensuales, setCuotasMensuales] = React.useState([]);

  const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const ESTADOS = [
    { key: "pendiente", label: "Pendiente", color: "#F59E0B", bg: "#FEF3C7" },
    { key: "en_curso", label: "En curso", color: "#3B82F6", bg: "#DBEAFE" },
    { key: "esperando_info", label: "Esperando info", color: "#8B5CF6", bg: "#EDE9FE" },
    { key: "completado", label: "Completado", color: "#10B981", bg: "#D1FAE5" }
  ];

  // ─── FETCH ALL DATA ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    Promise.all([
      supabase.from("sell_in_sku").select("*").eq("cliente", clienteKey).eq("anio", anioResumen),
      supabase.from("sellout_sku").select("*").eq("cliente", clienteKey).eq("anio", anioResumen),
      supabase.from("metas_anuales").select("*").eq("cliente", clienteKey).eq("anio", anioResumen).maybeSingle(),
      supabase.from("pendientes").select("*").eq("cliente", clienteKey).eq("tipo", "comercial").order("created_at", { ascending: false }),
      supabase.from("pendientes").select("*").eq("cliente", clienteKey).eq("tipo", "marketing").order("created_at", { ascending: false }),
      supabase.from("inversion_marketing").select("*").eq("cliente", clienteKey).eq("anio", anioResumen).order("mes"),
      supabase.from("minutas").select("*").eq("cliente", clienteKey).order("fecha_reunion", { ascending: false }).limit(10),
      supabase.from("inventario_cliente").select("valor").eq("cliente", clienteKey),
      supabase.from("cuotas_mensuales").select("*").eq("cliente", clienteKey).eq("anio", anioResumen),
    ]).then(([siR, soR, mR, pcR, pmR, imR, minR, invCR, cuotasR]) => {
      setSellInSku(siR.data || []);
      setSellOutSku(soR.data || []);
      if (mR.data) { setMeta(mR.data); setMetaForm({ min: mR.data.meta_sell_in_min, opt: mR.data.meta_sell_in_optimista }); } else { const _cc = (clientes[clienteKey] && clientes[clienteKey].cuotaAnual) || 30000000; setMeta({ meta_sell_in_min: Math.round(_cc * 0.83), meta_sell_in_optimista: _cc }); setMetaForm({ min: Math.round(_cc * 0.83), opt: _cc }); }
      setPendCom(pcR.data || []);
      setPendMkt(pmR.data || []);
      setInvMkt(imR.data || []);
      setMinutasList(minR.data || []);
      setInvCliente(invCR.data || []);
      setCuotasMensuales(cuotasR?.data || []);
      setLoading(false);
    });
  }, [clienteKey, anioResumen]);

  // ─── DERIVED DATA ───────────────────────────────────────────────────────────
  // Aggregate sell_in_sku by month
  const ventasPorMes = React.useMemo(() => {
    const map = {};
    for (var m = 1; m <= 12; m++) map[m] = { mes: m, sell_in: 0, sell_out: 0 };
    sellInSku.forEach(function(r) {
      var m = parseInt(r.mes);
      if (map[m]) map[m].sell_in += Number(r.monto_pesos) || 0;
    });
    sellOutSku.forEach(function(r) {
      var m = parseInt(r.mes);
      if (map[m]) map[m].sell_out += Number(r.monto_pesos) || 0;
    });
    return map;
  }, [sellInSku, sellOutSku]);

  // ─── CUOTAS POR MES (from cuotas_mensuales table) ────────────────────────
  const cuotasPorMes = React.useMemo(() => {
    const map = {};
    if (cuotasMensuales.length > 0) {
      cuotasMensuales.forEach(c => { map[parseInt(c.mes)] = c; });
    } else {
      const cfg = clientes[clienteKey];
      if (cfg && cfg.cuotasMensuales) {
        for (let m = 1; m <= 12; m++) {
          map[m] = { mes: m, cuota_ideal: cfg.cuotasMensuales[m] || 0, cuota_min: cfg.cuotasMinimas ? (cfg.cuotasMinimas[m] || 0) : Math.round((cfg.cuotasMensuales[m] || 0) * 0.9) };
        }
      }
    }
    return map;
  }, [cuotasMensuales, clienteKey]);

  // ─── PERIOD FILTER ────────────────────────────────────────────────────────
  const mesesFiltrados = React.useMemo(() => {
    if (periodoTipo === 'ytd') return Array.from({length: 12}, (_, i) => i + 1);
    if (periodoTipo === 'mes') return [periodoMes];
    if (periodoTipo === 'trimestre') {
      const t = Math.ceil(periodoMes / 3);
      const start = (t - 1) * 3 + 1;
      return [start, start + 1, start + 2];
    }
    if (periodoTipo === 'rango') {
      const arr = [];
      for (let i = periodoRango[0]; i <= periodoRango[1]; i++) arr.push(i);
      return arr;
    }
    return Array.from({length: 12}, (_, i) => i + 1);
  }, [periodoTipo, periodoMes, periodoRango]);

  const ventasFiltradas = React.useMemo(() => {
    return mesesFiltrados.map(function(m) { return ventasPorMes[m] || { mes: m, sell_in: 0, sell_out: 0 }; });
  }, [ventasPorMes, mesesFiltrados]);

  const totalSellIn = ventasFiltradas.reduce(function(s, v) { return s + (Number(v.sell_in) || 0); }, 0);
  const totalSellOut = ventasFiltradas.reduce(function(s, v) { return s + (Number(v.sell_out) || 0); }, 0);
  const totalCuotaMin = mesesFiltrados.reduce((s, m) => s + (cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_min) || 0 : 0), 0);
  const totalCuotaIdeal = mesesFiltrados.reduce((s, m) => s + (cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_ideal) || 0 : 0), 0);
  const cumplimientoMin = totalCuotaMin > 0 ? (totalSellIn / totalCuotaMin * 100) : 0;
  const cumplimientoIdeal = totalCuotaIdeal > 0 ? (totalSellIn / totalCuotaIdeal * 100) : 0;
  const totalInvValor = invCliente.reduce(function(s, r) { return s + (Number(r.valor) || 0); }, 0);
  const avgInvValor = invCliente.length > 0 ? totalInvValor / invCliente.length : 0;
  const lastInvValor = totalInvValor;
  const totalInvCliente = invCliente.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const totalInversionMkt = invMkt.reduce((s, v) => s + (Number(v.monto) || 0), 0);
  const costoXPeso = totalSellOut > 0 ? totalInversionMkt / totalSellOut : 0;
  const roiMkt = totalInversionMkt > 0 ? totalSellOut / totalInversionMkt : 0;
  const cuotaAcumulada = Object.values(cuotasPorMes).reduce(function(s, c) { return s + (Number(c.cuota_ideal) || 0); }, 0);
  const ultimoMesConDatos = Object.values(ventasPorMes).filter(function(v) { return v.sell_out > 0; });
  const ultimoMesData = ultimoMesConDatos.length > 0 ? ultimoMesConDatos[ultimoMesConDatos.length - 1] : null;
  const diasInventario = ultimoMesData && Number(ultimoMesData.sell_out) > 0 ? Math.round((Number(ultimoMesData.inventario_valor) || 0) / (Number(ultimoMesData.sell_out) / 30)) : 0;
  const estadoSalud = calcularSalud({ cuotaAcumulada, sellInAcumulado: totalSellIn, diasInventario }, []);

  // ─── SVG LINE CHART ─────────────────────────────────────────────────────────
  function LineChartSellInOut() {
  const W = 780, H = 340, PAD = { t: 40, r: 70, b: 50, l: 75 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const data = [];
  for (let m = 1; m <= 12; m++) {
    const v = ventasPorMes[m];
    data.push({
      mes: m,
      sellIn: v ? Number(v.sell_in) || 0 : null,
      sellOut: v ? Number(v.sell_out) || 0 : null,
      cuota: cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_ideal) || 0 : (v ? Number(v.cuota) || 0 : null), cuotaMin: cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_min) || 0 : null,
      inventario: v ? Number(v.inventario_valor) || 0 : null
    });
  }
  const hasData = data.filter(d => d.sellIn !== null);
  if (hasData.length === 0) return React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#94A3B8" } }, "Sin datos de ventas a\u00fan");

  // Primary Y axis: money values (Sell In, Sell Out, Cuota, Inventario)
  const moneyVals = hasData.flatMap(d => [d.sellIn, d.sellOut, d.cuota, d.inventario].filter(v => v !== null && v > 0));
  const maxMoney = Math.max(...moneyVals, 1) * 1.12;
  const minMoney = 0;
  const rangeMoney = maxMoney - minMoney || 1;

  // Secondary Y axis: cumplimiento % (sell_in / cuota * 100)
  const cumpData = hasData.filter(d => d.cuota > 0).map(d => ({ mes: d.mes, pct: (d.sellIn / d.cuota) * 100 }));
  const maxPct = cumpData.length > 0 ? Math.max(...cumpData.map(d => d.pct), 100) * 1.1 : 120;
  const minPct = 0;
  const rangePct = maxPct - minPct || 1;

  const x = (m) => PAD.l + ((m - 1) / 11) * plotW;
  const yMoney = (val) => PAD.t + plotH - ((val - minMoney) / rangeMoney) * plotH;
  const yPct = (val) => PAD.t + plotH - ((val - minPct) / rangePct) * plotH;

  // Build polyline strings
  const lineSI = hasData.map(d => x(d.mes) + "," + yMoney(d.sellIn)).join(" ");
  const lineSO = hasData.map(d => x(d.mes) + "," + yMoney(d.sellOut)).join(" ");
  const lineCuota = hasData.filter(d => d.cuota > 0).map(d => x(d.mes) + "," + yMoney(d.cuota)).join(" ");
  const lineInv = hasData.filter(d => d.inventario > 0).map(d => x(d.mes) + "," + yMoney(d.inventario)).join(" ");
  const lineCump = cumpData.map(d => x(d.mes) + "," + yPct(d.pct)).join(" ");

  // Area fill paths (Sell In)
  const areaSI = "M" + hasData.map(d => x(d.mes) + "," + yMoney(d.sellIn)).join("L") + "L" + x(hasData[hasData.length-1].mes) + "," + yMoney(0) + "L" + x(hasData[0].mes) + "," + yMoney(0) + "Z";
  // Area fill (Sell Out)
  const areaSO = "M" + hasData.map(d => x(d.mes) + "," + yMoney(d.sellOut)).join("L") + "L" + x(hasData[hasData.length-1].mes) + "," + yMoney(0) + "L" + x(hasData[0].mes) + "," + yMoney(0) + "Z";

  const gridLines = 6;
  const gridVals = Array.from({ length: gridLines }, (_, i) => minMoney + (rangeMoney / (gridLines - 1)) * i);
  const pctGridVals = [0, 25, 50, 75, 100, maxPct > 100 ? Math.ceil(maxPct / 25) * 25 : null].filter(v => v !== null && v <= maxPct * 1.05);

  const [hover, setHover] = React.useState(null);
  const [activeLines, setActiveLines] = React.useState({ sellIn: true, sellOut: true, cuota: true, inventario: true, cumplimiento: true });

  const toggleLine = (key) => { setActiveLines(prev => Object.assign({}, prev, { [key]: !prev[key] })); };

  const series = [
    { key: "sellIn", label: "Sell In", color: "#3B82F6", dash: "" },
    { key: "sellOut", label: "Sell Out", color: "#10B981", dash: "" },
    { key: "cuota", label: "Cuota", color: "#F59E0B", dash: "8,4" },
    { key: "inventario", label: "Inventario", color: "#8B5CF6", dash: "4,4" },
    { key: "cumplimiento", label: "Cumplimiento %", color: "#EF4444", dash: "2,4" }
  ];

  return React.createElement("svg", { viewBox: "0 0 " + W + " " + H, style: { width: "100%", maxWidth: 820, fontFamily: "system-ui" } },
    // Defs for gradients
    React.createElement("defs", null,
      React.createElement("linearGradient", { id: "gradSI", x1: "0", y1: "0", x2: "0", y2: "1" },
        React.createElement("stop", { offset: "0%", stopColor: "#3B82F6", stopOpacity: 0.18 }),
        React.createElement("stop", { offset: "100%", stopColor: "#3B82F6", stopOpacity: 0.02 })
      ),
      React.createElement("linearGradient", { id: "gradSO", x1: "0", y1: "0", x2: "0", y2: "1" },
        React.createElement("stop", { offset: "0%", stopColor: "#10B981", stopOpacity: 0.15 }),
        React.createElement("stop", { offset: "100%", stopColor: "#10B981", stopOpacity: 0.02 })
      )
    ),
    // Background
    React.createElement("rect", { x: PAD.l, y: PAD.t, width: plotW, height: plotH, fill: "#FAFBFD", rx: 4 }),
    // Grid lines (horizontal)
    gridVals.map((v, i) => React.createElement("g", { key: "g" + i },
      React.createElement("line", { x1: PAD.l, y1: yMoney(v), x2: W - PAD.r, y2: yMoney(v), stroke: "#E2E8F0", strokeWidth: 0.8, strokeDasharray: i === 0 ? "" : "3,3" }),
      React.createElement("text", { x: PAD.l - 10, y: yMoney(v) + 4, textAnchor: "end", fontSize: 10, fill: "#94A3B8", fontWeight: 500 },
        v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + (v / 1e3).toFixed(0) + "K")
    )),
    // Right Y axis labels (%)
    pctGridVals.map((v, i) => React.createElement("g", { key: "p" + i },
      React.createElement("line", { x1: W - PAD.r, y1: yPct(v), x2: W - PAD.r + 5, y2: yPct(v), stroke: "#FCA5A5", strokeWidth: 0.8 }),
      React.createElement("text", { x: W - PAD.r + 10, y: yPct(v) + 4, textAnchor: "start", fontSize: 10, fill: "#EF4444", fontWeight: 500 }, v + "%")
    )),
    // 100% reference line
    React.createElement("line", { x1: PAD.l, y1: yPct(100), x2: W - PAD.r, y2: yPct(100), stroke: "#FCA5A5", strokeWidth: 0.8, strokeDasharray: "6,4", opacity: 0.6 }),
    // X axis labels
    MESES_CORTOS.map((m, i) => React.createElement("text", { key: "m" + i, x: x(i + 1), y: H - 12, textAnchor: "middle", fontSize: 11, fill: "#64748B", fontWeight: 500 }, m)),
    // Axis labels
    React.createElement("text", { x: 14, y: H / 2, textAnchor: "middle", fontSize: 10, fill: "#94A3B8", transform: "rotate(-90 14 " + H / 2 + ")" }, "Monto (MXN)"),
    React.createElement("text", { x: W - 8, y: H / 2, textAnchor: "middle", fontSize: 10, fill: "#EF4444", transform: "rotate(90 " + (W - 8) + " " + H / 2 + ")" }, "Cumplimiento %"),
    // Area fills
    activeLines.sellIn && React.createElement("path", { d: areaSI, fill: "url(#gradSI)" }),
    activeLines.sellOut && React.createElement("path", { d: areaSO, fill: "url(#gradSO)" }),
    // Lines
    activeLines.sellIn && React.createElement("polyline", { points: lineSI, fill: "none", stroke: "#3B82F6", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
    activeLines.sellOut && React.createElement("polyline", { points: lineSO, fill: "none", stroke: "#10B981", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
    activeLines.cuota && lineCuota && React.createElement("polyline", { points: lineCuota, fill: "none", stroke: "#F59E0B", strokeWidth: 2, strokeLinejoin: "round", strokeDasharray: "8,4" }),
    activeLines.inventario && lineInv && React.createElement("polyline", { points: lineInv, fill: "none", stroke: "#8B5CF6", strokeWidth: 2, strokeLinejoin: "round", strokeDasharray: "4,4" }),
    activeLines.cumplimiento && lineCump && React.createElement("polyline", { points: lineCump, fill: "none", stroke: "#EF4444", strokeWidth: 2, strokeLinejoin: "round", strokeDasharray: "2,4" }),
    // Data points Sell In
    activeLines.sellIn && hasData.map(d => React.createElement("circle", { key: "si" + d.mes, cx: x(d.mes), cy: yMoney(d.sellIn), r: 4.5, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2, style: { cursor: "pointer", filter: "drop-shadow(0 1px 2px rgba(59,130,246,0.3))" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Sell Out
    activeLines.sellOut && hasData.map(d => React.createElement("circle", { key: "so" + d.mes, cx: x(d.mes), cy: yMoney(d.sellOut), r: 4.5, fill: "#10B981", stroke: "#fff", strokeWidth: 2, style: { cursor: "pointer", filter: "drop-shadow(0 1px 2px rgba(16,185,129,0.3))" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Cuota
    activeLines.cuota && hasData.filter(d => d.cuota > 0).map(d => React.createElement("circle", { key: "cu" + d.mes, cx: x(d.mes), cy: yMoney(d.cuota), r: 3.5, fill: "#F59E0B", stroke: "#fff", strokeWidth: 1.5, style: { cursor: "pointer" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Inventario
    activeLines.inventario && hasData.filter(d => d.inventario > 0).map(d => React.createElement("circle", { key: "iv" + d.mes, cx: x(d.mes), cy: yMoney(d.inventario), r: 3.5, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 1.5, style: { cursor: "pointer" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Cumplimiento
    activeLines.cumplimiento && cumpData.map(d => React.createElement("circle", { key: "cp" + d.mes, cx: x(d.mes), cy: yPct(d.pct), r: 3.5, fill: "#EF4444", stroke: "#fff", strokeWidth: 1.5, style: { cursor: "pointer" } })),
    // Interactive Legend
    series.map((s, i) => React.createElement("g", { key: "lg" + i, style: { cursor: "pointer" }, onClick: () => toggleLine(s.key), opacity: activeLines[s.key] ? 1 : 0.35 },
      React.createElement("rect", { x: PAD.l + i * 130, y: 6, width: 120, height: 22, rx: 11, fill: activeLines[s.key] ? s.color + "15" : "#f1f5f9", stroke: activeLines[s.key] ? s.color + "40" : "#e2e8f0", strokeWidth: 1 }),
      React.createElement("circle", { cx: PAD.l + i * 130 + 14, cy: 17, r: 4, fill: s.color }),
      React.createElement("text", { x: PAD.l + i * 130 + 24, y: 21, fontSize: 10.5, fill: activeLines[s.key] ? "#334155" : "#94a3b8", fontWeight: 600 }, s.label)
    )),
    // Tooltip
    hover && React.createElement("g", null,
      React.createElement("line", { x1: x(hover.mes), y1: PAD.t, x2: x(hover.mes), y2: PAD.t + plotH, stroke: "#CBD5E1", strokeWidth: 1, strokeDasharray: "4,3" }),
      React.createElement("rect", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185), y: PAD.t + 6, width: 180, height: hover.cuota > 0 ? 96 : 56, rx: 8, fill: "#1E293B", opacity: 0.94, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }),
      React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 90, y: PAD.t + 24, textAnchor: "middle", fontSize: 11, fill: "#E2E8F0", fontWeight: 700 }, MESES_CORTOS[hover.mes - 1] + " 2026"),
      React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 40, fontSize: 10.5, fill: "#93C5FD" }, "\u25CF Sell In: " + formatMXN(hover.sellIn)),
      React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 54, fontSize: 10.5, fill: "#6EE7B7" }, "\u25CF Sell Out: " + formatMXN(hover.sellOut)),
      hover.cuota > 0 && React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 68, fontSize: 10.5, fill: "#FCD34D" }, "\u25CF Cuota: " + formatMXN(hover.cuota)),
      hover.cuota > 0 && React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 82, fontSize: 10.5, fill: "#FCA5A5" }, "\u25CF Cump: " + ((hover.sellIn / hover.cuota) * 100).toFixed(1) + "%"),
      hover.inventario > 0 && React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + (hover.cuota > 0 ? 96 : 68), fontSize: 10.5, fill: "#C4B5FD" }, "\u25CF Inv: " + formatMXN(hover.inventario))
    )
  );
}

  // ─── PROGRESS BAR ──────────────────────────────────────────────────────────
  function ProgresoAnual() {
    const cuotaIdealEff = totalCuotaIdeal > 0 ? totalCuotaIdeal : meta.meta_sell_in_optimista;
    const cuotaMinEff = totalCuotaMin > 0 ? totalCuotaMin : meta.meta_sell_in_min;
    const pctOpt = cuotaIdealEff > 0 ? (totalSellIn / cuotaIdealEff) * 100 : 0;
    const pctMin = cuotaMinEff > 0 ? (totalSellIn / cuotaMinEff) * 100 : 0;
    const minPctOfOpt = cuotaIdealEff > 0 ? (cuotaMinEff / cuotaIdealEff) * 100 : 0;

    const saveMeta = async () => {
      if (!DB_CONFIGURED) return;
      await supabase.from("metas_anuales").upsert({
        cliente: clienteKey, anio: 2026,
        meta_sell_in_min: Number(metaForm.min),
        meta_sell_in_optimista: Number(metaForm.opt)
      }, { onConflict: "cliente,anio" });
      setMeta(prev => ({ ...prev, meta_sell_in_min: Number(metaForm.min), meta_sell_in_optimista: Number(metaForm.opt) }));
      setEditingMeta(false);
    };

    return React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 12, padding: 20 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } }, "Progreso Anual Sell In"),
        React.createElement("button", {
          onClick: () => setEditingMeta(!editingMeta),
          style: { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#4472C4" }
        }, editingMeta ? "Cancelar" : "Editar meta")
      ),
      editingMeta && React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" } },
        React.createElement("label", { style: { fontSize: 12, color: "#64748B" } }, "Meta m\u00ednima:",
          React.createElement("input", {
            type: "number", value: metaForm.min,
            onChange: e => setMetaForm(p => ({ ...p, min: e.target.value })),
            style: { width: 120, marginLeft: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }
          })
        ),
        React.createElement("label", { style: { fontSize: 12, color: "#64748B" } }, "Meta optimista:",
          React.createElement("input", {
            type: "number", value: metaForm.opt,
            onChange: e => setMetaForm(p => ({ ...p, opt: e.target.value })),
            style: { width: 120, marginLeft: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }
          })
        ),
        React.createElement("button", { onClick: saveMeta, style: { padding: "4px 12px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" } }, "Guardar")
      ),
      // Big number
      React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: "#1E293B", marginBottom: 4 } }, formatMXN(totalSellIn)),
      React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginBottom: 12 } },
        pctOpt.toFixed(1) + "% de cuota ideal (" + formatMXN(cuotaIdealEff) + ")"),
      // Bar
      React.createElement("div", { style: { position: "relative", height: 24, background: "#E2E8F0", borderRadius: 12, overflow: "hidden" } },
        React.createElement("div", { style: {
          position: "absolute", left: 0, top: 0, height: "100%", width: Math.min(pctOpt, 100) + "%",
          background: pctOpt >= 100 ? "linear-gradient(90deg,#10B981,#059669)" : "linear-gradient(90deg,#4472C4,#60A5FA)",
          borderRadius: 12, transition: "width 0.6s ease"
        } }),
        // Min marker
        React.createElement("div", { style: {
          position: "absolute", left: Math.min(minPctOfOpt, 100) + "%", top: 0, height: "100%", width: 2, background: "#F59E0B", zIndex: 2
        } })
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#94A3B8" } },
        React.createElement("span", null, "0"),
        React.createElement("span", { style: { color: "#F59E0B" } }, "M\u00edn: " + formatMXN(cuotaMinEff)),
        React.createElement("span", null, formatMXN(cuotaIdealEff))
      ),
      // Sell Out mini
      React.createElement("div", { style: { marginTop: 16, paddingTop: 12, borderTop: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { fontSize: 12, color: "#64748B" } }, "Sell Out Acumulado"),
        React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#10B981" } }, formatMXN(totalSellOut))
      )
    );
  }

  // ─── INVENTARIO CARD ────────────────────────────────────────────────────────
  function InventarioCard() {
    return React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 12, padding: 20 } },
      React.createElement("h4", { style: { margin: "0 0 8px", fontSize: 14, color: "#334155" } }, "Valor de Inventario"),
      React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: "#1E293B" } }, formatMXN(totalInvCliente > 0 ? totalInvCliente : lastInvValor)),
      React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginTop: 4 } },
        totalInvCliente > 0 ? invCliente.length + " SKUs en inventario" : (ventas.length > 0 ? "Mes m\u00e1s reciente con datos" : "Sin datos"))
    );
  }

  // ─── PENDIENTES CARD (reusable) ─────────────────────────────────────────────
  function TarjetaPendientesEditable({ tipo, items, setItems }) {
    const [showForm, setShowForm] = React.useState(false);
    const [showHist, setShowHist] = React.useState(false);
    const [form, setForm] = React.useState({ titulo: "", descripcion: "", responsable: "", fecha_entrega: "" });

    const activos = items.filter(p => !p.archivado);
    const archivados = items.filter(p => p.archivado);

    const addPendiente = async () => {
      if (!form.titulo.trim()) return;
      const row = { cliente: clienteKey, tipo, titulo: form.titulo, descripcion: form.descripcion, responsable: form.responsable, fecha_entrega: form.fecha_entrega || null, estado: "pendiente", archivado: false };
      const { data } = await supabase.from("pendientes").insert(row).select();
      if (data) setItems(prev => [data[0], ...prev]);
      setForm({ titulo: "", descripcion: "", responsable: "", fecha_entrega: "" });
      setShowForm(false);
    };

    const updateEstado = async (id, estado) => {
      await supabase.from("pendientes").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
      setItems(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    };

    const archivar = async (id) => {
      await supabase.from("pendientes").update({ archivado: true, estado: "completado", updated_at: new Date().toISOString() }).eq("id", id);
      setItems(prev => prev.map(p => p.id === id ? { ...p, archivado: true, estado: "completado" } : p));
    };

    const estadoObj = (key) => ESTADOS.find(e => e.key === key) || ESTADOS[0];

    return React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" } },
      // Header
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #E2E8F0", background: tipo === "comercial" ? "#EFF6FF" : "#F0FDF4" } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } },
          (tipo === "comercial" ? "Pendientes Comerciales" : "Pendientes Marketing")),
        React.createElement("div", { style: { display: "flex", gap: 6 } },
          React.createElement("button", {
            onClick: () => setShowForm(!showForm),
            style: { padding: "4px 10px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
          }, showForm ? "Cancelar" : "+ Nuevo"),
          archivados.length > 0 && React.createElement("button", {
            onClick: () => setShowHist(!showHist),
            style: { padding: "4px 10px", background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, cursor: "pointer" }
          }, showHist ? "Ocultar historial" : "Historial (" + archivados.length + ")")
        )
      ),
      // Add form
      showForm && React.createElement("div", { style: { padding: 16, background: "#FAFBFC", borderBottom: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          React.createElement("input", { placeholder: "T\u00edtulo del pendiente *", value: form.titulo, onChange: e => setForm(p => ({ ...p, titulo: e.target.value })),
            style: { padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } }),
          React.createElement("input", { placeholder: "Descripci\u00f3n (opcional)", value: form.descripcion, onChange: e => setForm(p => ({ ...p, descripcion: e.target.value })),
            style: { padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } }),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { placeholder: "Responsable", value: form.responsable, onChange: e => setForm(p => ({ ...p, responsable: e.target.value })),
              style: { flex: 1, padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } }),
            React.createElement("input", { type: "date", value: form.fecha_entrega, onChange: e => setForm(p => ({ ...p, fecha_entrega: e.target.value })),
              style: { padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } })
          ),
          React.createElement("button", { onClick: addPendiente,
            style: { alignSelf: "flex-end", padding: "8px 20px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }
          }, "Agregar pendiente")
        )
      ),
      // Active items
      React.createElement("div", { style: { maxHeight: 340, overflowY: "auto" } },
        activos.length === 0 && React.createElement("div", { style: { padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 } }, "No hay pendientes activos"),
        activos.map(p => {
          const est = estadoObj(p.estado);
          return React.createElement("div", { key: p.id, style: { padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", gap: 10 } },
            // Check to archive
            React.createElement("button", {
              onClick: () => archivar(p.id),
              title: "Marcar como completado y archivar",
              style: { marginTop: 2, width: 20, height: 20, borderRadius: "50%", border: "2px solid " + est.color, background: p.estado === "completado" ? est.color : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }
            }, p.estado === "completado" ? "\u2713" : ""),
            // Content
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontWeight: 600, fontSize: 13, color: "#1E293B" } }, p.titulo),
              p.descripcion && React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginTop: 2 } }, p.descripcion),
              React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" } },
                p.responsable && React.createElement("span", { style: { fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: 10 } }, p.responsable),
                p.fecha_entrega && React.createElement("span", { style: { fontSize: 11, color: "#64748B" } }, "Entrega: " + formatFecha(p.fecha_entrega))
              )
            ),
            // Estado selector
            React.createElement("select", {
              value: p.estado,
              onChange: e => updateEstado(p.id, e.target.value),
              style: { padding: "4px 8px", borderRadius: 6, border: "1px solid " + est.color, background: est.bg, color: est.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }
            }, ESTADOS.map(e => React.createElement("option", { key: e.key, value: e.key }, e.label)))
          );
        })
      ),
      // Archived history
      showHist && archivados.length > 0 && React.createElement("div", { style: { borderTop: "2px solid #E2E8F0" } },
        React.createElement("div", { style: { padding: "10px 16px", background: "#F8FAFC", fontSize: 12, fontWeight: 600, color: "#64748B" } }, "Historial completado"),
        archivados.map(p => React.createElement("div", { key: p.id, style: { padding: "8px 16px", borderBottom: "1px solid #F1F5F9", opacity: 0.6, display: "flex", gap: 8, alignItems: "center" } },
          React.createElement("span", { style: { color: "#10B981", fontSize: 14 } }, "\u2713"),
          React.createElement("span", { style: { fontSize: 12, color: "#64748B", textDecoration: "line-through" } }, p.titulo),
          p.responsable && React.createElement("span", { style: { fontSize: 11, color: "#94A3B8" } }, "(" + p.responsable + ")"),
          p.fecha_entrega && React.createElement("span", { style: { fontSize: 11, color: "#94A3B8" } }, formatFecha(p.fecha_entrega))
        ))
      )
    );
  }

  // ─── MARKETING METRICS ──────────────────────────────────────────────────────
  function MetricasMarketing() {
    const [showAddInv, setShowAddInv] = React.useState(false);
    const [invForm, setInvForm] = React.useState({ mes: new Date().getMonth() + 1, monto: "", descripcion: "" });

    const addInversion = async () => {
      if (!invForm.monto) return;
      const row = { cliente: clienteKey, mes: Number(invForm.mes), anio: 2026, monto: Number(invForm.monto), descripcion: invForm.descripcion };
      const { data } = await supabase.from("inversion_marketing").upsert(row, { onConflict: "cliente,mes,anio" }).select();
      if (data) {
        setInvMkt(prev => {
          const filtered = prev.filter(i => !(i.mes === Number(invForm.mes) && i.anio === 2026));
          return [...filtered, data[0]].sort((a, b) => a.mes - b.mes);
        });
      }
      setInvForm({ mes: new Date().getMonth() + 1, monto: "", descripcion: "" });
      setShowAddInv(false);
    };

    return React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 12, padding: 20 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } }, "M\u00e9tricas de Marketing"),
        React.createElement("button", {
          onClick: () => setShowAddInv(!showAddInv),
          style: { padding: "4px 10px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
        }, showAddInv ? "Cancelar" : "+ Agregar inversi\u00f3n")
      ),
      showAddInv && React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" } },
        React.createElement("select", { value: invForm.mes, onChange: e => setInvForm(p => ({ ...p, mes: e.target.value })),
          style: { padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }
        }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m))),
        React.createElement("input", { type: "number", placeholder: "Monto $", value: invForm.monto,
          onChange: e => setInvForm(p => ({ ...p, monto: e.target.value })),
          style: { width: 120, padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 } }),
        React.createElement("input", { placeholder: "Descripci\u00f3n", value: invForm.descripcion,
          onChange: e => setInvForm(p => ({ ...p, descripcion: e.target.value })),
          style: { flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 } }),
        React.createElement("button", { onClick: addInversion,
          style: { padding: "6px 14px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
        }, "Guardar")
      ),
      // KPI row
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 } },
        React.createElement("div", { style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 4 } }, "Inversi\u00f3n Total"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#E67C73" } }, formatMXN(totalInversionMkt))
        ),
        React.createElement("div", { style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 4 } }, "Sell Out (Venta)"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#10B981" } }, formatMXN(totalSellOut))
        ),
        React.createElement("div", { style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 4 } }, "Costo x Peso Vendido"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#4472C4" } }, "$" + costoXPeso.toFixed(2))
        )
      ),
      totalInversionMkt > 0 && React.createElement("div", { style: { background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginBottom: 4 } }, "ROI Marketing: por cada $1 invertido genera " + formatMXN(roiMkt) + " en venta"),
        // Monthly breakdown
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 } },
          invMkt.map(i => React.createElement("span", { key: i.id, style: { fontSize: 11, background: "#EFF6FF", padding: "3px 8px", borderRadius: 6, color: "#334155" } },
            MESES_CORTOS[(i.mes || 1) - 1] + ": " + formatMXN(i.monto) + (i.descripcion ? " (" + i.descripcion + ")" : "")
          ))
        )
      )
    );
  }

  // ─── MINUTA CARD ────────────────────────────────────────────────────────────
  function MinutaPlaud() {
    const [showAdd, setShowAdd] = React.useState(false);
    const [minForm, setMinForm] = React.useState({ fecha: new Date().toISOString().split("T")[0], contenido: "" });
    const [expandedId, setExpandedId] = React.useState(null);

    const addMinuta = async () => {
      if (!minForm.contenido.trim()) return;
      const row = { cliente: clienteKey, fecha_reunion: minForm.fecha, contenido: minForm.contenido, fuente: "plaud" };
      const { data } = await supabase.from("minutas").insert(row).select();
      if (data) setMinutasList(prev => [data[0], ...prev]);
      setMinForm({ fecha: new Date().toISOString().split("T")[0], contenido: "" });
      setShowAdd(false);
    };

    return React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #E2E8F0", background: "#FFFBEB" } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } }, "Minutas de Reuni\u00f3n"),
        React.createElement("button", {
          onClick: () => setShowAdd(!showAdd),
          style: { padding: "4px 10px", background: "#F59E0B", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
        }, showAdd ? "Cancelar" : "+ Nueva minuta")
      ),
      showAdd && React.createElement("div", { style: { padding: 16, background: "#FAFBFC", borderBottom: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            React.createElement("label", { style: { fontSize: 12, color: "#64748B" } }, "Fecha reuni\u00f3n:"),
            React.createElement("input", { type: "date", value: minForm.fecha,
              onChange: e => setMinForm(p => ({ ...p, fecha: e.target.value })),
              style: { padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 } })
          ),
          React.createElement("textarea", {
            placeholder: "Pega aqu\u00ed el texto de Plaud o escribe la minuta...",
            value: minForm.contenido,
            onChange: e => setMinForm(p => ({ ...p, contenido: e.target.value })),
            rows: 8,
            style: { padding: 12, borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, resize: "vertical", fontFamily: "system-ui", lineHeight: 1.5 }
          }),
          React.createElement("button", { onClick: addMinuta,
            style: { alignSelf: "flex-end", padding: "8px 20px", background: "#F59E0B", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }
          }, "Guardar minuta")
        )
      ),
      React.createElement("div", { style: { maxHeight: 400, overflowY: "auto" } },
        minutasList.length === 0 && React.createElement("div", { style: { padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 } }, "No hay minutas registradas"),
        minutasList.map(m => React.createElement("div", { key: m.id, style: { padding: "12px 16px", borderBottom: "1px solid #F1F5F9" } },
          React.createElement("div", {
            onClick: () => setExpandedId(expandedId === m.id ? null : m.id),
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }
          },
            React.createElement("div", null,
              React.createElement("span", { style: { fontWeight: 600, fontSize: 13, color: "#1E293B" } }, "Reuni\u00f3n " + formatFecha(m.fecha_reunion)),
              React.createElement("span", { style: { fontSize: 11, color: "#94A3B8", marginLeft: 8 } }, m.fuente === "plaud" ? "via Plaud" : "Manual")
            ),
            React.createElement("span", { style: { color: "#94A3B8", fontSize: 16 } }, expandedId === m.id ? "\u25B2" : "\u25BC")
          ),
          expandedId === m.id && React.createElement("div", { style: { marginTop: 10, padding: 12, background: "#F8FAFC", borderRadius: 8, fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" } }, m.contenido)
        ))
      )
    );
  }

  // ─── MAIN RENDER ────────────────────────────────────────────────────────────
  if (loading) return React.createElement("div", { style: { display: "flex", justifyContent: "center", padding: 60 } },
    React.createElement("div", { style: { fontSize: 16, color: "#94A3B8" } }, "Cargando datos..."));

  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 20, padding: "0 4px" } },
    // Row 0: Header with Semaforo
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 20px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
        React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, color: "#1E293B", margin: 0 } }, (cliente && cliente.nombre ? cliente.nombre : clienteKey)),
        React.createElement("span", { style: { fontSize: 13, color: "#94A3B8" } }, cliente && cliente.marca ? cliente.marca : "Acteck / Balam Rush")
      ),
      React.createElement(Semaforo, { estado: estadoSalud })
    ),
    // Row 0.5a: Year selector
    React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8 } },
      React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#475569" } }, "Año:"),
      [2025, 2026].map(function(y) {
        return React.createElement("button", {
          key: y,
          onClick: function() { setAnioResumen(y); },
          style: {
            padding: "4px 16px", borderRadius: 8, border: "1px solid " + (anioResumen === y ? "#3B82F6" : "#E2E8F0"),
            background: anioResumen === y ? "#3B82F6" : "#fff",
            color: anioResumen === y ? "#fff" : "#475569",
            fontWeight: 600, fontSize: 13, cursor: "pointer"
          }
        }, String(y));
      })
    ),
    // Row 0.5: Period selector
    React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
      React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#334155" } }, "Periodo:"),
      ["ytd", "mes", "trimestre", "rango"].map(t => 
        React.createElement("button", {
          key: t,
          onClick: () => setPeriodoTipo(t),
          style: {
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: periodoTipo === t ? "2px solid #4472C4" : "1px solid #E2E8F0",
            background: periodoTipo === t ? "#EFF6FF" : "#fff",
            color: periodoTipo === t ? "#4472C4" : "#64748B"
          }
        }, t === "ytd" ? "Acumulado YTD" : t === "mes" ? "Mes" : t === "trimestre" ? "Trimestre" : "Rango")
      ),
      periodoTipo === "mes" && React.createElement("select", {
        value: periodoMes,
        onChange: e => setPeriodoMes(Number(e.target.value)),
        style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
      }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m))),
      periodoTipo === "trimestre" && React.createElement("select", {
        value: Math.ceil(periodoMes / 3),
        onChange: e => setPeriodoMes((Number(e.target.value) - 1) * 3 + 1),
        style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
      }, [1,2,3,4].map(q => React.createElement("option", { key: q, value: q }, "Q" + q))),
      periodoTipo === "rango" && React.createElement(React.Fragment, null,
        React.createElement("select", {
          value: periodoRango[0],
          onChange: e => setPeriodoRango([Number(e.target.value), periodoRango[1]]),
          style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
        }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m))),
        React.createElement("span", { style: { color: "#94A3B8" } }, "a"),
        React.createElement("select", {
          value: periodoRango[1],
          onChange: e => setPeriodoRango([periodoRango[0], Number(e.target.value)]),
          style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
        }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m)))
      ),
      // Cuota summary
      totalCuotaIdeal > 0 && React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 16, fontSize: 12 } },
        React.createElement("span", { style: { color: "#F59E0B", fontWeight: 600 } }, "Cuota Min: " + formatMXN(totalCuotaMin)),
        React.createElement("span", { style: { color: "#E67C73", fontWeight: 600 } }, "Cuota Ideal: " + formatMXN(totalCuotaIdeal)),
        React.createElement("span", { style: { color: cumplimientoMin >= 100 ? "#10B981" : cumplimientoMin >= 80 ? "#F59E0B" : "#EF4444", fontWeight: 700 } }, "Cump: " + cumplimientoMin.toFixed(1) + "%")
      )
    ),
    // Row 1: Line chart
    React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20 } },
      React.createElement("h3", { style: { margin: "0 0 12px", fontSize: 16, color: "#1E293B" } }, "Sell In vs Sell Out — " + (cliente?.nombre || clienteKey) + " 2026"),
      React.createElement(LineChartSellInOut, null)
    ),
    // Row 2: Progress + Inventario
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 } },
      React.createElement(ProgresoAnual, null),
      React.createElement(InventarioCard, null)
    ),
    // Row 3: Pendientes
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } },
      React.createElement(TarjetaPendientesEditable, { tipo: "comercial", items: pendCom, setItems: setPendCom }),
      React.createElement(TarjetaPendientesEditable, { tipo: "marketing", items: pendMkt, setItems: setPendMkt })
    ),
    // Row 4: Marketing metrics
    React.createElement(MetricasMarketing, null),
    // Row 5: Minuta
    React.createElement(MinutaPlaud, null)
  );
}

// ─── PÁGINA: CRÉDITO Y COBRANZA ──────────────────────────────────────────────

