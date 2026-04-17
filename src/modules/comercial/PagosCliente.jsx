import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { PCEL_REAL, PAGOS_DIGITALIFE_2026 } from '../../lib/constants';
import { formatMXN, formatFecha } from '../../lib/utils';
import { CardHeader } from '../../components';

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const CATEGORIA_META = {
  promociones: { label: "Promociones", color: "#f59e0b" },
  marketing: { label: "Marketing", color: "#8b5cf6" },
  pagosFijos: { label: "Pagos Fijos", color: "#3b82f6" },
  pagosVariables: { label: "Pagos Variables", color: "#10b981" },
  rebate: { label: "Rebate", color: "#ef4444" },
  spiff: { label: "SPIFF", color: "#9333ea" }
};

const ESTATUS_OPT = [
  { value: "pendiente",  label: "💡 Pendiente",  color: "#f59e0b" },
  { value: "en_proceso", label: "⏳ En Proceso", color: "#3b82f6" },
  { value: "pagado",     label: "✓ Pagado",      color: "#10b981" },
  { value: "vencido",    label: "⚠ Vencido",     color: "#ef4444" },
  { value: "cancelado",  label: "✕ Cancelado",   color: "#94a3b8" },
];

export default function PagosCliente({ cliente, clienteKey }) {
  const c = cliente;

  // ── State ──
  const [registros, setRegistros]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [catActiva, setCatActiva]     = useState("todas");
  const [expandedMonth, setExpandedMonth] = useState(null);
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [expandedFijos, setExpandedFijos] = useState({});  // { conceptoKey: true }
  const [showAddFijo, setShowAddFijo] = useState(false);
  const [newFijo, setNewFijo] = useState({ concepto: "", monto: "", responsable: "", meses: [], existente: "" });
  const [newRow, setNewRow]           = useState({
    folio: "", concepto: "", categoria: "promociones", monto: "",
    estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
    responsable: "", notas: "",
  });

  const MESES_ARR = [
    { key: "01", short: "Ene", full: "Enero" },
    { key: "02", short: "Feb", full: "Febrero" },
    { key: "03", short: "Mar", full: "Marzo" },
    { key: "04", short: "Abr", full: "Abril" },
    { key: "05", short: "May", full: "Mayo" },
    { key: "06", short: "Jun", full: "Junio" },
    { key: "07", short: "Jul", full: "Julio" },
    { key: "08", short: "Ago", full: "Agosto" },
    { key: "09", short: "Sep", full: "Septiembre" },
    { key: "10", short: "Oct", full: "Octubre" },
    { key: "11", short: "Nov", full: "Noviembre" },
    { key: "12", short: "Dic", full: "Diciembre" },
  ];

  

  // ── Rebate Calculator (solo Digitalife) ──
  const [rebateData, setRebateData] = useState({ monitores: 0, sillas: 0, accesorios: 0 });
  const [rebateLoading, setRebateLoading] = useState(false);
  const [rebateQ, setRebateQ] = useState(() => {
    const m = new Date().getMonth();
    return m < 3 ? 1 : m < 6 ? 2 : m < 9 ? 3 : 4;
  });
  const REBATE_PCT = { monitores: 0.02, sillas: 0.02, accesorios: 0.03 };
  const Q_MESES = { 1: [1,2,3], 2: [4,5,6], 3: [7,8,9], 4: [10,11,12] };
  const Q_FECHA_PAGO = { 1: "-04-15", 2: "-07-15", 3: "-10-15", 4: "-01-15" };
  const [rebateAllQ, setRebateAllQ] = useState({ 1: 0, 2: 0, 3: 0, 4: 0 });
  const [rebateSynced, setRebateSynced] = useState({});

  // ── SPIFF Digitalife: por crecimiento de Sellout ──
  // Cuota anual SO = $23M, con 40% asignado a H1 (Ene-Jun) y 60% a H2 (Jul-Dic)
  // para cargar más al segundo semestre (temporada alta).
  // Dentro de cada semestre, la distribución mantiene la temporalidad Cuota SI.
  // Tiers: 90-100% → 0.10% · 100-120% → 0.16% · 120%+ → 0.18% · Tope $4,000
  // Ajustes manuales: meses cuya cuota se fija a mano; el faltante se redistribuye
  // en meses de temporada alta (Jul-Dic) proporcional a su Cuota SI.
  const SPIFF_CUOTA_ANUAL = 23000000;
  const SPIFF_H1_PCT = 0.40; // % del total anual asignado a Ene-Jun (H2 = 60%)
  const SPIFF_CUOTA_OVERRIDES = {
    2: 1533103, // Feb: cuota ajustada para que SO real ($1,379,793) = 90% → Básico mínimo
  };
  const SPIFF_REDISTRIBUIR_EN = [7, 8, 9, 10, 11, 12]; // Jul-Dic absorben el faltante
  const SPIFF_TIERS = [
    { key: "alto",    umbral: 1.20, pct: 0.0018, icon: "🥇", label: "Alto" },
    { key: "medio",   umbral: 1.00, pct: 0.0016, icon: "🥈", label: "Medio" },
    { key: "basico",  umbral: 0.90, pct: 0.0010, icon: "🥉", label: "Básico" },
  ];
  const SPIFF_TOPE = 4000;
  const [digiSellOut26, setDigiSellOut26] = useState({});
  const [digiCuotas, setDigiCuotas] = useState([]);
  const [spiffPagos, setSpiffPagos] = useState({});  // { "2026-01": pagoRow, ... }
  const [spiffLoading, setSpiffLoading] = useState(false);

  useEffect(() => {
    if (clienteKey !== "digitalife" || !DB_CONFIGURED) return;
    setSpiffLoading(true);
    (async () => {
      const anio = new Date().getFullYear();
      // Paginación para sellout_sku
      const fetchAll = async (qs) => {
        let all = [], from = 0, PAGE = 1000;
        while (true) {
          const { data } = await supabase.from("sellout_sku").select(qs).eq("cliente", "digitalife").eq("anio", anio).range(from, from + PAGE - 1);
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };
      const [soData, cuotasData, existingSpiffPagos] = await Promise.all([
        fetchAll("mes,monto_pesos"),
        supabase.from("cuotas_mensuales").select("mes,cuota_min,cuota_ideal").eq("cliente", "digitalife").eq("anio", anio).order("mes"),
        supabase.from("pagos").select("*").eq("cliente", "digitalife").eq("categoria", "spiff"),
      ]);
      const byMes = {};
      soData.forEach(r => { const m = Number(r.mes); byMes[m] = (byMes[m] || 0) + (Number(r.monto_pesos) || 0); });
      setDigiSellOut26(byMes);
      setDigiCuotas(cuotasData.data || []);
      // Mapear pagos spiff por mes
      const spMap = {};
      (existingSpiffPagos.data || []).forEach(p => {
        const match = p.concepto && p.concepto.match(/SPIFF (\w+) (\d{4})/);
        if (match) {
          const mesNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
          const mesIdx = mesNames.indexOf(match[1]);
          if (mesIdx >= 0) spMap[`${match[2]}-${String(mesIdx + 1).padStart(2, "0")}`] = p;
        }
      });
      setSpiffPagos(spMap);
      setSpiffLoading(false);
    })();
  }, [clienteKey, registros.length]);

  // Cálculo del SPIFF por mes
  const spiffCalc = React.useMemo(() => {
    if (clienteKey !== "digitalife" || digiCuotas.length === 0) return null;
    const totalSI = digiCuotas.reduce((s, c) => s + (Number(c.cuota_min) || 0), 0);
    const anio = new Date().getFullYear();

    // Paso 1: cuota base con tilt H1/H2 (40/60) y temporalidad SI dentro de cada semestre
    const sumSI_H1 = digiCuotas.filter(x => Number(x.mes) <= 6).reduce((s, c) => s + (Number(c.cuota_min) || 0), 0);
    const sumSI_H2 = totalSI - sumSI_H1;
    const cuotaH1 = SPIFF_CUOTA_ANUAL * SPIFF_H1_PCT;
    const cuotaH2 = SPIFF_CUOTA_ANUAL * (1 - SPIFF_H1_PCT);
    const baseCuotaSO = {};
    for (let m = 1; m <= 12; m++) {
      const cRow = digiCuotas.find(x => Number(x.mes) === m);
      const cuotaSI = cRow ? Number(cRow.cuota_min) || 0 : 0;
      if (m <= 6) {
        baseCuotaSO[m] = sumSI_H1 > 0 ? (cuotaSI / sumSI_H1) * cuotaH1 : 0;
      } else {
        baseCuotaSO[m] = sumSI_H2 > 0 ? (cuotaSI / sumSI_H2) * cuotaH2 : 0;
      }
    }

    // Paso 2: aplicar overrides y calcular faltante liberado
    let faltante = 0;
    for (const [mStr, val] of Object.entries(SPIFF_CUOTA_OVERRIDES)) {
      const m = Number(mStr);
      faltante += baseCuotaSO[m] - val;
      baseCuotaSO[m] = val;
    }

    // Paso 3: redistribuir faltante en meses de temporada alta (proporcional a SI)
    const mesesRedist = SPIFF_REDISTRIBUIR_EN.filter(m => SPIFF_CUOTA_OVERRIDES[m] === undefined);
    const siRedist = mesesRedist.reduce((s, m) => {
      const cRow = digiCuotas.find(x => Number(x.mes) === m);
      return s + (cRow ? Number(cRow.cuota_min) || 0 : 0);
    }, 0);
    if (siRedist > 0 && faltante !== 0) {
      for (const m of mesesRedist) {
        const cRow = digiCuotas.find(x => Number(x.mes) === m);
        const cuotaSI = cRow ? Number(cRow.cuota_min) || 0 : 0;
        baseCuotaSO[m] += (cuotaSI / siRedist) * faltante;
      }
    }

    // Paso 4: calcular tier y comisión
    const results = [];
    for (let m = 1; m <= 12; m++) {
      const cRow = digiCuotas.find(x => Number(x.mes) === m);
      const cuotaSI = cRow ? Number(cRow.cuota_min) || 0 : 0;
      const cuotaSOMin = baseCuotaSO[m];
      const soActual = digiSellOut26[m] || 0;
      const alcance = cuotaSOMin > 0 ? soActual / cuotaSOMin : 0;
      const tier = SPIFF_TIERS.find(t => alcance >= t.umbral);
      const comisionRaw = tier ? soActual * tier.pct : 0;
      const comision = Math.min(comisionRaw, SPIFF_TOPE);
      const capped = comisionRaw > SPIFF_TOPE;
      const ajustado = SPIFF_CUOTA_OVERRIDES[m] !== undefined;
      const key = `${anio}-${String(m).padStart(2, "0")}`;
      results.push({ mes: m, cuotaSI, cuotaSOMin, soActual, alcance, tier, comisionRaw, comision, capped, ajustado, pagoExistente: spiffPagos[key] });
    }
    return results;
  }, [clienteKey, digiCuotas, digiSellOut26, spiffPagos]);

  const spiffTotalYTD = React.useMemo(() => {
    if (!spiffCalc) return 0;
    return spiffCalc.reduce((s, c) => {
      const p = c.pagoExistente;
      if (p && p.estatus === "cancelado") return s;   // No aplica = 0
      if (p) return s + (Number(p.monto) || 0);       // Pago ya creado usa su monto
      return s + c.comision;                          // Calculado (aún no creado)
    }, 0);
  }, [spiffCalc]);

  const crearSpiffPago = async (calc) => {
    const mesLabel = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][calc.mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = calc.mes === 12 ? 1 : calc.mes + 1;
    const nextAnio = calc.mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    const row = {
      cliente: "digitalife", categoria: "spiff", folio: null,
      concepto: `SPIFF ${mesLabel} ${anio} — ${calc.tier?.label || "Sin tier"}`,
      monto: calc.comision,
      estatus: "pendiente", fecha_compromiso: fechaCompromiso,
      responsable: "PM Digitalife",
      notas: `Sell Out: ${formatMXN(calc.soActual)} · Cuota SO Mín: ${formatMXN(calc.cuotaSOMin)} · Alcance ${(calc.alcance*100).toFixed(0)}%${calc.capped ? " · Capeado a " + formatMXN(SPIFF_TOPE) : ""}`,
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) {
      console.error("crearSpiffPago error:", error, "row:", row);
      alert("Error creando pago: " + (error.message || JSON.stringify(error)));
      return;
    }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(calc.mes).padStart(2, "0")}`]: data }));
    flash("✓ Pago SPIFF generado");
  };

  const marcarSpiffNoAplica = async (mes) => {
    const mesLabel = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = mes === 12 ? 1 : mes + 1;
    const nextAnio = mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    const row = {
      cliente: "digitalife", categoria: "spiff", folio: null,
      concepto: `SPIFF ${mesLabel} ${anio} — No aplica`,
      monto: 0, estatus: "cancelado",
      fecha_compromiso: fechaCompromiso,
      responsable: "Fernando Cabrera",
      notas: "Marcado como No aplica manualmente",
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) {
      console.error("marcarSpiffNoAplica error:", error, "row:", row);
      alert("Error: " + (error.message || JSON.stringify(error)));
      return;
    }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(mes).padStart(2, "0")}`]: data }));
    flash("✓ Marcado como No aplica");
  };

  const revertirSpiff = async (pagoId) => {
    if (!window.confirm("¿Eliminar este registro de SPIFF?")) return;
    const { error } = await supabase.from("pagos").delete().eq("id", pagoId);
    if (error) { alert("Error: " + error.message); return; }
    setSpiffPagos(p => {
      const copy = { ...p };
      Object.keys(copy).forEach(k => { if (copy[k] && copy[k].id === pagoId) delete copy[k]; });
      return copy;
    });
    flash("✓ Revertido");
  };

  useEffect(() => {
    if (clienteKey !== "digitalife" || !DB_CONFIGURED) return;
    setRebateLoading(true);
    (async () => {
      const anio = new Date().getFullYear();
      const [siRes, prodRes] = await Promise.all([
        supabase.from("sell_in_sku").select("sku,mes,monto_pesos").eq("cliente", "digitalife").eq("anio", anio),
        supabase.from("productos_cliente").select("sku,categoria").eq("cliente", "digitalife")
      ]);
      const catMap = {};
      (prodRes.data || []).forEach(p => { catMap[p.sku] = (p.categoria || "").toLowerCase(); });
      // Compute per-quarter totals
      const qTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
      const qData = { 1: { m: 0, s: 0, a: 0 }, 2: { m: 0, s: 0, a: 0 }, 3: { m: 0, s: 0, a: 0 }, 4: { m: 0, s: 0, a: 0 } };
      (siRes.data || []).forEach(r => {
        const cat = catMap[r.sku] || "";
        const monto = r.monto_pesos || 0;
        const mes = Number(r.mes);
        const q = mes <= 3 ? 1 : mes <= 6 ? 2 : mes <= 9 ? 3 : 4;
        if (cat.includes("monitor")) { qData[q].m += monto; qTotals[q] += monto * 0.02; }
        else if (cat.includes("silla")) { qData[q].s += monto; qTotals[q] += monto * 0.02; }
        else { qData[q].a += monto; qTotals[q] += monto * 0.03; }
      });
      setRebateAllQ(qTotals);
      const sel = qData[rebateQ];
      setRebateData({ monitores: sel.m, sillas: sel.s, accesorios: sel.a });
      // Check which Qs already have rebate pagos
      const synced = {};
      registros.filter(r => r.categoria === "rebate").forEach(r => {
        const m = r.concepto?.match(/Q(\d)/);
        if (m) synced[Number(m[1])] = r.id;
      });
      setRebateSynced(synced);
      setRebateLoading(false);
    })();
  }, [clienteKey, rebateQ, registros.length]);

  // ── PCEL Condiciones Comerciales (Rebate + Fondo MKT + SPIFF) ──
  const [pcelSellIn, setPcelSellIn] = useState({});
  const SPIFF_PCT = 0.0021;
  const [pcelOverrideRebate, setPcelOverrideRebate] = useState({1:"",2:"",3:"",4:""});
  const [pcelOverrideSpiff, setPcelOverrideSpiff] = useState({});
  const [pcelPagosReg, setPcelPagosReg] = useState([]);
  const [showPagoForm, setShowPagoForm] = useState(null);
  const [pagoFormData, setPagoFormData] = useState({ fecha_compromiso: "", responsable: "Fernando Cabrera", notas: "" });
  const [pcelCuotasSupa, setPcelCuotasSupa] = useState(null);
  
  useEffect(() => {
    if (clienteKey !== "pcel" || !DB_CONFIGURED) return;
    const anio = new Date().getFullYear();
    (async () => {
      const { data } = await supabase.from("sell_in_sku").select("mes,monto_pesos").eq("cliente", "pcel").eq("anio", anio);
      const byMonth = {};
      (data || []).forEach(r => {
        const m = parseInt(r.mes);
        byMonth[m] = (byMonth[m] || 0) + (Number(r.monto_pesos) || 0);
      });
      setPcelSellIn(byMonth);
    })();
  }, [clienteKey]);
  
  // ── Fetch cuotas mensuales from Supabase (fallback to PCEL_REAL) ──
  useEffect(() => {
    if (clienteKey !== "pcel" || !DB_CONFIGURED) return;
    const anio = new Date().getFullYear();
    (async () => {
      const { data } = await supabase.from("cuotas_mensuales").select("mes,monto").eq("cliente", "pcel").eq("anio", anio);
      if (data && data.length > 0) {
        const byMonth = {};
        data.forEach(r => { byMonth[parseInt(r.mes)] = Number(r.monto) || 0; });
        setPcelCuotasSupa(byMonth);
      }
    })();
  }, [clienteKey]);
  
  // ── Fetch PCEL payment records (rebate/spiff) ──
  useEffect(() => {
    if (clienteKey !== "pcel" || !DB_CONFIGURED) return;
    (async () => {
      const { data } = await supabase.from("pagos").select("*").eq("cliente", "pcel").in("categoria", ["rebate","spiff"]);
      if (data) setPcelPagosReg(data);
    })();
  }, [clienteKey]);
  
  const guardarPagoPcel = async (tipo, periodo, montoCalc) => {
    if (!DB_CONFIGURED) return;
    const row = {
      cliente: "pcel",
      categoria: tipo,
      folio: tipo.toUpperCase() + "-" + periodo + "-" + new Date().getFullYear(),
      concepto: (tipo === "rebate" ? "Rebate " : "SPIFF ") + periodo + " " + new Date().getFullYear(),
      monto: montoCalc,
      estatus: "pendiente",
      fecha_compromiso: pagoFormData.fecha_compromiso || null,
      responsable: pagoFormData.responsable || "Fernando Cabrera",
      notas: pagoFormData.notas || "",
    };
    const { data, error } = await supabase.from("pagos").insert([row]).select();
    if (data) {
      setPcelPagosReg(prev => [...prev, ...data]);
      setShowPagoForm(null);
      setPagoFormData({ fecha_compromiso: "", responsable: "Fernando Cabrera", notas: "" });
    }
  };

  const pcelCalc = React.useMemo(() => {
    if (clienteKey !== "pcel") return null;
    const cuotas = pcelCuotasSupa || PCEL_REAL.cuota50M;
    const QUARTERS = [[1,2,3],[4,5,6],[7,8,9],[10,11,12]];
    const qLabels = ["Q1 (Ene-Mar)","Q2 (Abr-Jun)","Q3 (Jul-Sep)","Q4 (Oct-Dic)"];
    
    // Monthly breakdown
    const monthly = [];
    for (let m = 1; m <= 12; m++) {
      const si = pcelSellIn[m] || 0;
      const cuota = cuotas[m] || 0;
      const alc = cuota > 0 ? si / cuota : 0;
      monthly.push({ mes: m, sellIn: si, cuota, alcance: alc, spiff: si * SPIFF_PCT });
    }
    
    // Quarterly rebate
    const quarterly = QUARTERS.map((meses, qi) => {
      const qSellIn = meses.reduce((s, m) => s + (pcelSellIn[m] || 0), 0);
      const qCuota = meses.reduce((s, m) => s + (cuotas[m] || 0), 0);
      const qAlcance = qCuota > 0 ? qSellIn / qCuota : 0;
      let rebatePct = 0, rebateLabel = "< 90%";
      for (const t of PCEL_REAL.rebateTiers) {
        if (qAlcance >= t.min) { rebatePct = t.pct; rebateLabel = t.label; }
      }
      let fondoPct = 0, fondoLabel = "< 100%";
      for (const t of PCEL_REAL.fondoMktTiers) {
        if (qAlcance <= t.maxAlcance) { fondoPct = t.pct; fondoLabel = t.label; break; }
      }
      const overrideR = pcelOverrideRebate[qi+1];
      const overrideRVal = overrideR !== "" && overrideR !== undefined ? parseFloat(overrideR) : null;
      const rebateAmount = overrideRVal !== null ? overrideRVal : qSellIn * rebatePct;
      const fondoAmount = qSellIn * fondoPct;
      return { q: qi+1, label: qLabels[qi], meses, sellIn: qSellIn, cuota: qCuota, alcance: qAlcance, rebatePct, rebateLabel, rebateAmount, fondoPct, fondoLabel, fondoAmount, overrideActive: overrideRVal !== null };
    });
    
    const totalRebate = quarterly.reduce((s, q) => s + q.rebateAmount, 0);
    const totalFondo = quarterly.reduce((s, q) => s + q.fondoAmount, 0);
    
    // SPIFF by month (monthly)
    const spiffByMonth = {};
    let totalSpiff = 0;
    for (const [m, val] of Object.entries(pcelSellIn)) {
      const overrideS = pcelOverrideSpiff[m];
      const overrideSVal = overrideS !== "" && overrideS !== undefined ? parseFloat(overrideS) : null;
      const spiffAmt = overrideSVal !== null ? overrideSVal : val * SPIFF_PCT;
      spiffByMonth[m] = { amount: spiffAmt, overrideActive: overrideSVal !== null };
      totalSpiff += spiffAmt;
    }
    
    const totalSellIn = Object.values(pcelSellIn).reduce((a,b) => a + b, 0);
    const totalCuota = Object.entries(cuotas).filter(([m]) => monthly.some(r => r.sellIn > 0 && r.mes === Number(m))).reduce((a,[,v]) => a + v, 0);
    const alcance = totalCuota > 0 ? totalSellIn / totalCuota : 0;
    
    return { totalSellIn, totalCuota, alcance, quarterly, totalRebate, totalFondo, totalSpiff, spiffByMonth, monthly };
  }, [clienteKey, pcelSellIn, pcelCuotasSupa, pcelOverrideRebate, pcelOverrideSpiff]);


// ── Data loading ──
  useEffect(() => {
    if (!DB_CONFIGURED) {
      const seed = Object.entries(PAGOS_DIGITALIFE_2026.categorias).flatMap(([key, cat]) =>
        cat.items.map(item => ({ ...item, id: item.folio, categoria: key }))
      );
      setRegistros(seed);
      setLoading(false);
      return;
    }
    fetchData();
    const channel = supabase
      .channel("pagos-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from("pagos").select("*").order("created_at");
    setRegistros(data || []);
    setLoading(false);
  };

  // ── Toast ──
  const flash = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Inline edit helpers ──
  const startEdit = (id, field, value) => {
    if (!DB_CONFIGURED) return;
    setEditingCell({ id, field });
    setEditValue(value ?? "");
  };
  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };
  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const value = field === "monto" ? (parseFloat(editValue) || 0) : (editValue || null);
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, [field]: value, ...(field === "fecha_pago_real" && value ? { estatus: "pagado" } : {}) } : r));
    cancelEdit();
    setSaving(true);
    const { error } = await supabase.from("pagos")
      .update({ [field]: value, updated_at: new Date().toISOString(), ...(field === "fecha_pago_real" && value ? { estatus: "pagado" } : {}) })
      .eq("id", id);
    setSaving(false);
    if (error) { flash("Error al guardar â", "err"); fetchData(); }
    else flash("Guardado â");
  };

  // ── Add record (non-fijos) ──
  const handleAdd = async () => {
    if (!newRow.concepto.trim()) return;
    const record = {
      ...newRow,
      cliente: clienteKey,
      folio: newRow.folio.trim() || "",
      monto: parseFloat(newRow.monto) || 0,
      fecha_compromiso: newRow.fecha_compromiso || null,
      fecha_pago_real: newRow.fecha_pago_real || null,
    };
    const { data, error } = await supabase.from("pagos").insert(record).select().single();
    if (error) {
      console.error("handleAdd error:", error, "record:", record);
      alert("Error al agregar: " + (error.message || JSON.stringify(error)));
      return;
    }
    setRegistros(prev => [...prev, data]);
    setNewRow({ folio: "", concepto: "", categoria: "promociones", monto: "",
                estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
                responsable: "", notas: "" });
    setShowAdd(false);
    flash("Registro agregado ✓");
  };

  // ── Add Pago Fijo (creates 12 monthly records) ──
  const handleAddFijo = async () => {
    const isExisting = newFijo.existente && newFijo.existente !== "__nuevo__";
    const concepto = isExisting ? newFijo.existente : newFijo.concepto.trim();
    if (!concepto) return;
    const selectedMeses = newFijo.meses.length > 0 ? newFijo.meses : MESES_ARR.map(m => m.key);
    const existingMeses = isExisting && fijoGroups[concepto] ? fijoGroups[concepto].map(r => r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : null).filter(Boolean) : [];
    const baseMonto = isExisting && fijoGroups[concepto] && fijoGroups[concepto][0] ? (fijoGroups[concepto][0].monto || 0) : (parseFloat(newFijo.monto) || 0);
    const baseResp = isExisting && fijoGroups[concepto] && fijoGroups[concepto][0] ? (fijoGroups[concepto][0].responsable || null) : (newFijo.responsable.trim() || null);
    const newMeses = selectedMeses.filter(m => !existingMeses.includes(m));
    if (newMeses.length === 0) { flash("Todos los meses seleccionados ya existen", "err"); return; }
    const records = newMeses.map(mKey => ({
      folio: "",
      concepto,
      categoria: "pagosFijos",
      monto: isExisting ? baseMonto : (parseFloat(newFijo.monto) || 0),
      estatus: "pendiente",
      fecha_compromiso: `2026-${mKey}-01`,
      fecha_pago_real: null,
      responsable: isExisting ? baseResp : (newFijo.responsable.trim() || null),
      notas: null,
    }));
    setSaving(true);
    const { data, error } = await supabase.from("pagos").insert(records).select();
    setSaving(false);
    if (error) { flash("Error al crear pagos fijos", "err"); return; }
    setRegistros(prev => [...prev, ...data]);
    setNewFijo({ concepto: "", monto: "", responsable: "", meses: [], existente: "" });
    setShowAddFijo(false);
    flash(`${newMeses.length} mes(es) de "${concepto}" creados`);
  };

  // ── Delete record ──
  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setRegistros(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { flash("Error al eliminar â", "err"); fetchData(); }
    else flash("Eliminado â");
  };

  // ── Delete all months of a fijo concept ──
  const handleDeleteFijo = async (conceptoKey, ids) => {
    if (!window.confirm(`¿Eliminar todos los meses de "${conceptoKey}"? Esta acción no se puede deshacer.`)) return;
    setRegistros(prev => prev.filter(r => !ids.includes(r.id)));
    for (const id of ids) {
      await supabase.from("pagos").delete().eq("id", id);
    }
    flash(`"${conceptoKey}" eliminado â`);
  };

  // ── Toggle expand fijo ──
  const toggleFijo = (key) => {
    setExpandedFijos(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Computed ──
  const fijoRecords = registros.filter(r => r.categoria === "pagosFijos");
  const nonFijoRecords = registros.filter(r => r.categoria !== "pagosFijos");
  const filtered = catActiva === "todas"
    ? registros.filter(r => r.estatus !== "pagado")
    : catActiva === "pagosFijos"
      ? fijoRecords
      : registros.filter(r => r.categoria === catActiva);

  const showFijosSection = clienteKey !== "pcel" && (catActiva === "todas" || catActiva === "pagosFijos");
  const showRegularTable = true;

  // Group fijos by concepto
  const fijoGroups = {};
  fijoRecords.forEach(r => {
    const key = r.concepto || "Sin nombre";
    if (!fijoGroups[key]) fijoGroups[key] = [];
    fijoGroups[key].push(r);
  });

  // KPIs
  const totalPagado   = registros.filter(r => r.estatus === "pagado").reduce((s, r) => s + (r.monto || 0), 0);
  const totalPorPagar = registros.filter(r => ["pendiente","en proceso"].includes(r.estatus)).reduce((s, r) => s + (r.monto || 0), 0);
  const totalVencido  = registros.filter(r => r.estatus === "vencido").reduce((s, r) => s + (r.monto || 0), 0);
  const totalAnio     = registros.reduce((s, r) => s + (r.monto || 0), 0);

  // Monthly breakdown
  const monthlyBreakdown = () => {
    const months = {};
    registros.forEach(r => {
      const d = r.fecha_compromiso;
      if (!d) return;
      const m = typeof d === "string" ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7);
      if (!months[m]) months[m] = { mes: m, total: 0, promociones: 0, marketing: 0, pagosFijos: 0, pagosVariables: 0, rebate: 0, records: [] };
      months[m].total += (r.monto || 0);
      months[m].records.push(r);
      if (CATEGORIA_META[r.categoria]) months[m][r.categoria] = (months[m][r.categoria] || 0) + (r.monto || 0);
    });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  };

  // ── Inline cell renderer ──
  const renderCell = (row, field, type = "text") => {
    const isEditing = editingCell?.id === row.id && editingCell?.field === field;
    const inputCls = "w-full border border-blue-400 rounded px-2 py-1 text-sm outline-none bg-blue-50 focus:ring-1 focus:ring-blue-400";

    if (isEditing) {
      if (type === "sel-estatus") {
        return (
          <select autoFocus value={editValue} className={inputCls}
            onChange={e => setEditValue(e.target.value)} onBlur={saveEdit}
            onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }}>
            {ESTATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      if (type === "sel-cat") {
        return (
          <select autoFocus value={editValue} className={inputCls}
            onChange={e => setEditValue(e.target.value)} onBlur={saveEdit}
            onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }}>
            {Object.entries(CATEGORIA_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        );
      }
      return (
        <input autoFocus type={type} value={editValue} className={inputCls}
          onChange={e => setEditValue(e.target.value)} onBlur={saveEdit}
          onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }} />
      );
    }

    const handleClick = () => {
      if (field === "monto") startEdit(row.id, field, row.monto ?? "");
      else startEdit(row.id, field, row[field] ?? "");
    };

    if (field === "estatus") {
      const s = ESTATUS_OPT.find(o => o.value === (row.estatus || "pendiente")) || ESTATUS_OPT[0];
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>{s.label}
          </span>
        </div>
      );
    }
    if (field === "categoria") {
      const m = CATEGORIA_META[row.categoria] || CATEGORIA_META.promociones;
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-semibold whitespace-nowrap"
                style={{ backgroundColor: m.color }}>{m.icono} {m.label}</span>
        </div>
      );
    }
    if (field === "monto") {
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          {(row.monto || 0) > 0
            ? <span className="font-bold text-gray-800">{formatMXN(row.monto)}</span>
            : <span className="text-gray-400 text-xs italic">Por definir</span>}
        </div>
      );
    }
    if (field === "fecha_compromiso" || field === "fecha_pago_real") {
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors whitespace-nowrap" : "whitespace-nowrap"} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          {row[field] ? <span className="text-gray-600">{formatFecha(row[field])}</span> : <span className="text-gray-300">—</span>}
        </div>
      );
    }
    return (
      <div className={DB_CONFIGURED ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
        {row[field] ? <span className="text-gray-700">{row[field]}</span> : <span className="text-gray-300">—</span>}
      </div>
    );
  };

  // ────────────────────────── RENDER ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold transition-all ${toast.type === "err" ? "bg-red-500 text-white" : "bg-green-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}>💰</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{c.nombre} — Pagos y Compromisos</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {" · "}Promociones · Marketing{clienteKey !== "pcel" && " · Pagos Fijos"} · Variables
                {saving && <span className="ml-2 text-blue-400 animate-pulse">â Guardando...</span>}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">
              Actualizado: {formatFecha(c.cartera?.ultimaActualizacion || "2026-04-07")}
              {c.cartera?.horaActualizacion ? ` · ${c.cartera.horaActualizacion} hrs` : ""}
            </span>
            {c.cartera?.tipoCambio && (
              <span className="text-xs text-gray-400">TC: ${c.cartera.tipoCambio.toFixed(2)} MXN/USD</span>
            )}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${DB_CONFIGURED ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {DB_CONFIGURED ? "â Sincronizado" : "â ️ Solo lectura"}
            </span>
          </div>
        </div>
      </div>

      {/* Banner de configuración pendiente */}
      {!DB_CONFIGURED && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <span className="text-2xl">â️</span>
          <div>
            <p className="font-semibold text-orange-800 mb-1">Configuración requerida para guardar cambios</p>
            <p className="text-sm text-orange-700 mb-2">
              Para que todos los cambios se guarden y sean visibles para el equipo, configura las variables en Vercel y la tabla en Supabase.
            </p>
            <code className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded block w-fit">
              VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
            </code>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
          <span className="text-gray-500">Cargando datos...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Resumen de Pagos 2026</h3>
                <span className="text-xs text-gray-400">{registros.length} registros</span>
              </div>
              <div className={"grid grid-cols-2 gap-x-6 gap-y-5 " + (clienteKey === "pcel" && pcelCalc ? "md:grid-cols-5" : "md:grid-cols-4")}>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-600">{totalPagado > 0 ? formatMXN(totalPagado) : "$0"}</p>
                  <p className="text-xs text-gray-400 mt-1">{registros.filter(r => r.estatus === "pagado").length} conceptos</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Por Pagar</p>
                  <p className="text-2xl font-bold text-yellow-600">{totalPorPagar > 0 ? formatMXN(totalPorPagar) : "$0"}</p>
                  <p className="text-xs text-gray-400 mt-1">{registros.filter(r => ["pendiente","en proceso"].includes(r.estatus)).length} conceptos</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total 2026</p>
                  <p className="text-2xl font-bold text-gray-800">{totalAnio > 0 ? formatMXN(totalAnio) : "$0"}</p>
                  <p className="text-xs text-gray-400 mt-1">{registros.length} conceptos registrados</p>
                </div>
                {clienteKey === "digitalife" && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Rebate Acum.</p>
                    <p className="text-2xl font-bold text-red-600">{(() => { const total = Math.round(Object.values(rebateAllQ).reduce((s, v) => s + v, 0)); return total > 0 ? formatMXN(total) : "$0"; })()}</p>
                    <p className="text-xs text-gray-400 mt-1">{Object.values(rebateSynced).filter(Boolean).length} de 4 Qs registrados</p>
                  </div>
                )}
                {clienteKey === "pcel" && pcelCalc && (<>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Rebate Trimestral</p>
                    <p className="text-2xl font-bold text-blue-600">{pcelCalc.totalRebate > 0 ? "$" + Math.round(pcelCalc.totalRebate).toLocaleString("es-MX") : "$0"}</p>
                    <p className="text-xs text-gray-400 mt-1">Acumulado {pcelCalc.quarterly.filter(q => q.sellIn > 0).length} trimestre(s)</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Fondo MKT</p>
                    <p className="text-2xl font-bold text-emerald-600">{pcelCalc.totalFondo > 0 ? "$" + Math.round(pcelCalc.totalFondo).toLocaleString("es-MX") : "$0"}</p>
                    <p className="text-xs text-gray-400 mt-1">Acumulado sobre Sell In</p>
                  </div>
                </>)}
              </div>
            </div>

          {/* Calendario mensual de pagos 2026 */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700">📅 Calendario de Pagos 2026</h3>
              <span className="text-xs text-gray-400">Agrupado por fecha de pago real (o compromiso si está pendiente)</span>
            </div>
            {(() => {
              const regs = registros.filter(r => r.cliente === clienteKey);
              // Agrupar por mes: fecha_pago_real si existe, si no fecha_compromiso
              const porMes = {};
              for (let m = 1; m <= 12; m++) {
                porMes[m] = { total: 0, pagado: 0, pendiente: 0, porCat: {}, nPend: 0, nPag: 0, vencidos: 0 };
              }
              const hoy = new Date();
              regs.forEach(r => {
                const fechaStr = r.fecha_pago_real || r.fecha_compromiso;
                if (!fechaStr) return;
                const parts = String(fechaStr).slice(0, 10).split("-").map(n => parseInt(n, 10));
                if (parts.length !== 3 || parts[0] !== 2026) return;
                const m = parts[1];
                if (m < 1 || m > 12) return;
                const monto = Number(r.monto) || 0;
                const isPagado = !!r.fecha_pago_real || r.estatus === "pagado";
                porMes[m].total += monto;
                if (isPagado) { porMes[m].pagado += monto; porMes[m].nPag++; }
                else {
                  porMes[m].pendiente += monto;
                  porMes[m].nPend++;
                  // Vencido: fecha de compromiso pasada y no pagado
                  if (r.fecha_compromiso) {
                    const pp = String(r.fecha_compromiso).slice(0, 10).split("-").map(n => parseInt(n, 10));
                    if (pp.length === 3) {
                      const fc = new Date(pp[0], pp[1] - 1, pp[2]);
                      if (fc < hoy) porMes[m].vencidos++;
                    }
                  }
                }
                const cat = r.categoria || "otros";
                porMes[m].porCat[cat] = (porMes[m].porCat[cat] || 0) + monto;
              });
              return React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 } },
                [1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
                  const data = porMes[m];
                  const hasData = data.total > 0;
                  const pct = data.total > 0 ? (data.pagado / data.total * 100) : 0;
                  const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                  return React.createElement("div", {
                    key: m,
                    style: {
                      background: data.vencidos > 0 ? "#FEF2F2" : "#FAFBFC",
                      border: data.vencidos > 0 ? "2px solid #FCA5A5" : "1px solid #E2E8F0",
                      borderRadius: 10, padding: "12px 14px",
                      display: "flex", flexDirection: "column", gap: 8,
                      opacity: hasData ? 1 : 0.5,
                    }
                  },
                    // Header mes
                    React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center" } },
                      React.createElement("span", { style: { fontWeight: 700, color: "#1E293B", fontSize: 14 } }, MESES_FULL[m - 1]),
                      data.vencidos > 0 && React.createElement("span", { style: { fontSize: 10, background: "#FEE2E2", color: "#991B1B", padding: "2px 8px", borderRadius: 10, fontWeight: 700 } },
                        "⚠ " + data.vencidos + " venc" + (data.vencidos === 1 ? "ido" : "idos")
                      )
                    ),
                    // Totales
                    hasData ? React.createElement(React.Fragment, null,
                      React.createElement("div", null,
                        React.createElement("div", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", fontWeight: 600 } }, "Compromiso"),
                        React.createElement("div", { style: { fontSize: 16, fontWeight: 700, color: "#1E293B" } }, formatMXN(data.total))
                      ),
                      // Progreso
                      React.createElement("div", null,
                        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 } },
                          React.createElement("span", { style: { color: "#10B981", fontWeight: 600 } }, "Pagado " + formatMXN(data.pagado)),
                          React.createElement("span", { style: { color: "#475569", fontWeight: 600 } }, pct.toFixed(0) + "%")
                        ),
                        React.createElement("div", { style: { height: 6, background: "#E2E8F0", borderRadius: 3, overflow: "hidden" } },
                          React.createElement("div", { style: { height: "100%", width: Math.min(pct, 100) + "%", background: pct >= 100 ? "#10B981" : pct >= 50 ? "#3B82F6" : "#F59E0B", borderRadius: 3, transition: "width .5s" } })
                        )
                      ),
                      // Desglose por categoría
                      Object.keys(data.porCat).length > 0 && React.createElement("div", { style: { display: "flex", flexWrap: "wrap", gap: 4 } },
                        Object.entries(data.porCat).map(([cat, monto]) => {
                          const meta = CATEGORIA_META[cat] || { label: cat, color: "#64748B" };
                          return React.createElement("span", {
                            key: cat,
                            title: meta.label + ": " + formatMXN(monto),
                            style: { fontSize: 10, padding: "1px 6px", borderRadius: 6, background: meta.color + "22", color: meta.color, fontWeight: 600 }
                          }, meta.label + " " + formatMXN(monto));
                        })
                      ),
                      // Contadores
                      React.createElement("div", { style: { fontSize: 10, color: "#94A3B8", display: "flex", gap: 10, paddingTop: 4, borderTop: "1px dashed #E2E8F0" } },
                        React.createElement("span", null, "✓ " + data.nPag + " pagados"),
                        React.createElement("span", null, "○ " + data.nPend + " pendientes")
                      )
                    ) : React.createElement("div", { style: { fontSize: 11, color: "#CBD5E1", fontStyle: "italic" } }, "Sin pagos")
                  );
                })
              );
            })()}
          </div>

          {/* Monthly summary table */}
          {(() => {
            const mb = monthlyBreakdown();
            if (mb.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <CardHeader titulo="Resumen General por Mes y Categoría" icono="📅" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-400 uppercase pb-3 pr-4">Mes</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.promociones.color }}>Promociones</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.marketing.color }}>Marketing</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.pagosFijos.color }}>Pagos Fijos</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.pagosVariables.color }}>P. Variables</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.rebate.color }}>Rebate</th>
                        <th className="text-right text-xs text-gray-700 uppercase font-bold pb-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mb.map(m => {
                        const [yr, mo] = m.mes.split("-");
                        return (<React.Fragment key={m.mes}>
                          <tr className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => setExpandedMonth(expandedMonth === m.mes ? null : m.mes)}>
                            <td className="py-2.5 pr-4 font-semibold text-gray-700">{MESES_CORTOS[parseInt(mo, 10) - 1]} {yr}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.promociones    > 0 ? formatMXN(m.promociones)    : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.marketing      > 0 ? formatMXN(m.marketing)      : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.pagosFijos    > 0 ? formatMXN(m.pagosFijos)    : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.pagosVariables> 0 ? formatMXN(m.pagosVariables): <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.rebate         > 0 ? formatMXN(m.rebate)         : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 text-right font-bold text-gray-800">{formatMXN(m.total)}</td>
                          </tr>
                          {expandedMonth === m.mes && (
                            <tr>
                              <td colSpan="8" className="p-0">
                                <div className="bg-blue-50 px-6 py-3">
                                  <table className="w-full text-sm">
                                    <thead>
                                      <tr className="text-gray-500">
                                        <th className="text-left pb-1 font-medium">Concepto</th>
                                        <th className="text-left pb-1 font-medium">Categor\u00eda</th>
                                        <th className="text-right pb-1 font-medium">Monto</th>
                                        <th className="text-left pb-1 font-medium">Estatus</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {m.records.map((r, ri) => (
                                        <tr key={ri} className="border-t border-blue-100">
                                          <td className="py-1 text-gray-700">{r.concepto}</td>
                                          <td className="py-1 text-gray-600">{CATEGORIA_META[r.categoria]?.label || r.categoria}</td>
                                          <td className="py-1 text-right text-gray-700">{formatMXN(r.monto || 0)}</td>
                                          <td className="py-1"><span className={`px-2 py-0.5 rounded-full text-xs ${r.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{r.estatus}</span></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>);
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td className="pt-3 font-bold text-gray-700 text-sm">TOTAL ANUAL</td>
                        {["promociones","marketing","pagosFijos","pagosVariables","rebate"].map(cat => (
                          <td key={cat} className="pt-3 pr-4 text-right font-bold text-gray-700">
                            {formatMXN(registros.filter(r => r.categoria === cat).reduce((s, r) => s + (r.monto || 0), 0))}
                          </td>
                        ))}
                        <td className="pt-3 text-right font-bold text-blue-700">{formatMXN(totalAnio)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}

          {/* ═══════════════ REGULAR TABLE (non-fijos) ═══════════════ */}
          {showRegularTable && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">

              {/* Filter tabs + Add button */}
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <button onClick={() => setCatActiva("todas")}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${catActiva === "todas" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  Todas
                </button>
                {Object.entries(CATEGORIA_META).filter(([key]) => !(clienteKey === "pcel" && key === "pagosFijos")).map(([key, meta]) => (
                  <button key={key} onClick={() => setCatActiva(catActiva === key ? "todas" : key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${catActiva === key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    style={catActiva === key ? { backgroundColor: meta.color } : {}}>
                    <span>{meta.icono}</span>{meta.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                {DB_CONFIGURED && (
                  <button onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                    + Agregar
                  </button>
                )}
              </div>

              {/* Add form */}
              {showAdd && DB_CONFIGURED && (
                <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800 mb-3">Nuevo registro</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Categoría *", key: "categoria", type: "select-cat" },
                      { label: "Concepto *",  key: "concepto",  type: "text" },
                      { label: "Monto (MXN)", key: "monto",     type: "number" },
                      { label: "Estatus",     key: "estatus",   type: "select-est" },
                      { label: "F. Compromiso", key: "fecha_compromiso", type: "date" },
                      { label: "F. Pago Real",  key: "fecha_pago_real",  type: "date" },
                      { label: "Responsable",   key: "responsable",      type: "text" },
                      { label: "Folio (del cliente)", key: "folio", type: "text" },
                      { label: "Notas",         key: "notas",            type: "text" },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-500 block mb-1">{label}</label>
                        {type === "select-cat" ? (
                          <select value={newRow.categoria} onChange={e => setNewRow(p => ({ ...p, categoria: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                            {Object.entries(CATEGORIA_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        ) : type === "select-est" ? (
                          <select value={newRow.estatus} onChange={e => setNewRow(p => ({ ...p, estatus: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                            {ESTATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input type={type} value={newRow[key] || ""} placeholder={key === "monto" ? "0" : key === "folio" ? "Folio del cliente" : ""}
                            onChange={e => setNewRow(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                      Guardar registro
                    </button>
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* ═══════════ PAGOS FIJOS VIEW ═══════════ */}
              {catActiva === "pagosFijos" && (
                <div>
                  {DB_CONFIGURED && (
                    <div className="mb-5">
                      {!showAddFijo ? (
                        <button onClick={() => setShowAddFijo(true)}
                          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
                          + Nuevo Pago Fijo
                        </button>
                      ) : (
                        <div className="p-4 bg-indigo-50 rounded-xl border border-indigo-200">
                          <p className="text-sm font-semibold text-indigo-800 mb-3">Agregar Pago Fijo</p>
                          <div className="mb-3">
                            <label className="text-xs text-gray-500 block mb-1">¿A qué concepto?</label>
                            <select value={newFijo.existente} onChange={e => {
                              const v = e.target.value;
                              setNewFijo(p => ({...p, existente: v, concepto: v === "__nuevo__" ? "" : v}));
                            }} className="w-full border rounded-lg px-3 py-1.5 text-sm bg-white">
                              <option value="">— Selecciona —</option>
                              <option value="__nuevo__">+ Crear nuevo concepto</option>
                              {Object.keys(fijoGroups).map(k => <option key={k} value={k}>{k}</option>)}
                            </select>
                          </div>
                          {(newFijo.existente === "__nuevo__") && (
                            <div className="grid grid-cols-3 gap-3 mb-3">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Concepto *</label>
                                <input type="text" value={newFijo.concepto} onChange={e => setNewFijo(p => ({...p, concepto: e.target.value}))}
                                  placeholder="Ej: Renta oficina" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Monto mensual (MXN)</label>
                                <input type="number" value={newFijo.monto} onChange={e => setNewFijo(p => ({...p, monto: e.target.value}))}
                                  placeholder="0" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                              </div>
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Responsable</label>
                                <input type="text" value={newFijo.responsable} onChange={e => setNewFijo(p => ({...p, responsable: e.target.value}))}
                                  placeholder="Responsable" className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                              </div>
                            </div>
                          )}
                          {newFijo.existente && (
                            <div className="mb-3">
                              <label className="text-xs text-gray-500 block mb-2">Selecciona los meses</label>
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => {
                                  const allKeys = MESES_ARR.map(m => m.key);
                                  setNewFijo(p => ({...p, meses: p.meses.length === 12 ? [] : allKeys}));
                                }} className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${newFijo.meses.length === 12 ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                                  Todos
                                </button>
                                {MESES_ARR.map(m => {
                                  const sel = newFijo.meses.includes(m.key);
                                  const existingGroup = newFijo.existente !== "__nuevo__" && fijoGroups[newFijo.existente];
                                  const alreadyExists = existingGroup ? existingGroup.some(r => r.fecha_compromiso && r.fecha_compromiso.slice(5, 7) === m.key) : false;
                                  return (
                                    <button key={m.key} type="button" disabled={alreadyExists}
                                      onClick={() => setNewFijo(p => ({...p, meses: sel ? p.meses.filter(x => x !== m.key) : [...p.meses, m.key]}))}
                                      className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-colors ${alreadyExists ? "bg-gray-100 text-gray-300 border-gray-200 cursor-not-allowed" : sel ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"}`}>
                                      {m.short}{alreadyExists ? " ✓" : ""}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                          <div className="flex gap-2 mt-3">
                            <button onClick={handleAddFijo} disabled={!newFijo.existente || (newFijo.existente === "__nuevo__" && !newFijo.concepto.trim()) || newFijo.meses.length === 0}
                              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors ${(!newFijo.existente || (newFijo.existente === "__nuevo__" && !newFijo.concepto.trim()) || newFijo.meses.length === 0) ? "bg-gray-300 text-gray-500 cursor-not-allowed" : "bg-indigo-600 text-white hover:bg-indigo-700"}`}>
                              Crear {newFijo.meses.length > 0 ? `${newFijo.meses.length} mes(es)` : "Pago Fijo"}
                            </button>
                            <button onClick={() => { setShowAddFijo(false); setNewFijo({ concepto: "", monto: "", responsable: "", meses: [], existente: "" }); }} className="px-4 py-1.5 bg-gray-100 text-gray-600 rounded-lg text-sm hover:bg-gray-200">Cancelar</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {Object.keys(fijoGroups).length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <p className="text-3xl mb-2">📋</p>
                      <p className="text-sm">No hay pagos fijos registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(fijoGroups).map(([conceptoKey, records]) => {
                        const isExp = expandedFijos[conceptoKey];
                        const totalAnual = records.reduce((s, r) => s + (r.monto || 0), 0);
                        const pagados = records.filter(r => r.estatus === "pagado").length;
                        const montoMes = records[0] ? (records[0].monto || 0) : 0;
                        const sorted = [...records].sort((a, b) => (a.fecha_compromiso || "").localeCompare(b.fecha_compromiso || ""));
                        return (
                          <div key={conceptoKey} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleFijo(conceptoKey)}>
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{isExp ? "▾" : "▸"}</span>
                                <div>
                                  <p className="font-semibold text-gray-800">{conceptoKey}</p>
                                  <p className="text-xs text-gray-500">{formatMXN(montoMes)}/mes · {records.length} meses · {pagados} pagados</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="font-bold text-gray-800">{formatMXN(totalAnual)}</p>
                                <p className="text-xs text-gray-400">Total anual</p>
                              </div>
                            </div>
                            {isExp && (
                              <div className="px-4 py-3 bg-white">
                                <table className="w-full text-sm">
                                  <thead>
                                    <tr className="border-b border-gray-100">
                                      <th className="text-left text-xs text-gray-400 uppercase pb-2 pr-3">Mes</th>
                                      <th className="text-right text-xs text-gray-400 uppercase pb-2 pr-3">Monto</th>
                                      <th className="text-center text-xs text-gray-400 uppercase pb-2 pr-3">Estatus</th>
                                      <th className="text-left text-xs text-gray-400 uppercase pb-2 pr-3">F. Compromiso</th>
                                      <th className="text-left text-xs text-gray-400 uppercase pb-2 pr-3">F. Pago Real</th>
                                      <th className="text-left text-xs text-gray-400 uppercase pb-2">Folio</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {sorted.map((r) => {
                                      const mk = r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : "??";
                                      const mi = MESES_ARR.find(m => m.key === mk);
                                      return (
                                        <tr key={r.id} className="border-b border-gray-50 hover:bg-blue-50/40">
                                          <td className="py-2 pr-3 font-medium text-gray-700">{mi ? mi.full : mk}</td>
                                          <td className="py-2 pr-3 text-right">{renderCell(r, "monto", "number")}</td>
                                          <td className="py-2 pr-3 text-center">{renderCell(r, "estatus", "sel-estatus")}</td>
                                          <td className="py-2 pr-3">{renderCell(r, "fecha_compromiso", "date")}</td>
                                          <td className="py-2 pr-3">{renderCell(r, "fecha_pago_real", "date")}</td>
                                          <td className="py-2">{renderCell(r, "folio")}</td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Table */}
              {catActiva !== "pagosFijos" && (<div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 min-w-36">Concepto {DB_CONFIGURED && <span className="text-blue-300 normal-case font-normal">(click p/editar)</span>}</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Categoría</th>
                      <th className="text-right text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Monto</th>
                      <th className="text-center text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Estatus</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">F. Compromiso</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">F. Pago Real</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Responsable</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Folio</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3">Notas</th>
                      {DB_CONFIGURED && <th className="pb-3 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                        <td className="py-2.5 pr-3 min-w-36">{renderCell(row, "concepto")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "categoria", "sel-cat")}</td>
                        <td className="py-2.5 pr-3 text-right">{renderCell(row, "monto", "number")}</td>
                        <td className="py-2.5 pr-3 text-center">{renderCell(row, "estatus", "sel-estatus")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "fecha_compromiso", "date")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "fecha_pago_real", "date")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "responsable")}</td>
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                            {renderCell(row, "folio")}
                          </span>
                        </td>
                        <td className="py-2.5">{renderCell(row, "notas")}</td>
                        {DB_CONFIGURED && (
                          <td className="py-2.5 pl-1">
                            <button onClick={() => handleDelete(row.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors text-base" title="Eliminar registro">🗑</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm">No hay registros{catActiva !== "todas" ? " en esta categoría" : ""}</p>
                  </div>
                )}
              </div>)}
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {DB_CONFIGURED ? "â Cambios guardados y sincronizados para todo el equipo." : "â ️ Modo lectura — configura Supabase para habilitar la edición."}
                  {" "}💡 <strong className="text-gray-600">Pendiente</strong> · <strong className="text-gray-600">En Proceso</strong> · <strong className="text-gray-600">Pagado</strong> · <strong className="text-gray-600">Vencido</strong>
                </p>
              </div>
            </div>
          )}


          {/* Calculadora de Rebate Trimestral */}
          {clienteKey === "digitalife" && catActiva === "rebate" && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <h3 className="text-lg font-bold text-gray-800">Calculadora Rebate Q{rebateQ} {new Date().getFullYear()}</h3>
                </div>
                <div className="flex gap-1">
                  {[1,2,3,4].map(q => (
                    <button key={q} onClick={() => setRebateQ(q)}
                      className={"px-3 py-1 rounded-full text-xs font-bold transition-all " + (rebateQ === q ? "bg-red-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>
                      Q{q}
                    </button>
                  ))}
                </div>
              </div>
              {rebateLoading ? (
                <div className="text-center py-6 text-gray-400">Cargando datos de Sell In...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b-2 border-gray-200">
                        <th className="text-left py-2 px-3 font-bold text-gray-700">Categoria</th>
                        <th className="text-right py-2 px-3 font-bold text-gray-700">Sell In</th>
                        <th className="text-right py-2 px-3 font-bold text-gray-700">Rebate (%)</th>
                        <th className="text-right py-2 px-3 font-bold text-red-600">Rebate ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { label: "Monitores", key: "monitores" },
                        { label: "Sillas", key: "sillas" },
                        { label: "Accesorios", key: "accesorios" }
                      ].map(row => {
                        const si = rebateData[row.key] || 0;
                        const pct = REBATE_PCT[row.key];
                        const reb = Math.round(si * pct);
                        return (
                          <tr key={row.key} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="py-2 px-3 font-semibold text-gray-700">{row.label}</td>
                            <td className="py-2 px-3 text-right text-gray-600">{si > 0 ? "$" + si.toLocaleString("es-MX") : "—"}</td>
                            <td className="py-2 px-3 text-right text-gray-500">{(pct * 100).toFixed(0)}%</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: reb > 0 ? "#ef4444" : "#9ca3af" }}>{reb > 0 ? "$" + reb.toLocaleString("es-MX") : "—"}</td>
                          </tr>
                        );
                      })}
                      <tr className="border-t-2 border-gray-300 bg-gray-50">
                        <td className="py-2 px-3 font-bold text-gray-800">Total</td>
                        <td className="py-2 px-3 text-right font-bold text-gray-800">{"$" + (rebateData.monitores + rebateData.sillas + rebateData.accesorios).toLocaleString("es-MX")}</td>
                        <td className="py-2 px-3"></td>
                        <td className="py-2 px-3 text-right font-bold text-red-600">{"$" + Math.round(rebateData.monitores * REBATE_PCT.monitores + rebateData.sillas * REBATE_PCT.sillas + rebateData.accesorios * REBATE_PCT.accesorios).toLocaleString("es-MX")}</td>
                      </tr>
                    </tbody>
                  </table>
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-xs text-gray-400">* Rebate basado en Sell In del trimestre. Se paga al cierre de Q{rebateQ}. Monitores y Sillas: 2%, Accesorios (todo lo demas): 3%.</p>
                    {(() => {
                      const totalReb = Math.round(rebateData.monitores * REBATE_PCT.monitores + rebateData.sillas * REBATE_PCT.sillas + rebateData.accesorios * REBATE_PCT.accesorios);
                      if (totalReb <= 0) return null;
                      if (rebateSynced[rebateQ]) return <span className="text-xs text-green-600 font-semibold ml-2">Pago registrado</span>;
                      return <button onClick={async () => {
                        const anio = new Date().getFullYear();
                        const fechaQ = rebateQ === 4 ? (anio + 1) + Q_FECHA_PAGO[4] : anio + Q_FECHA_PAGO[rebateQ];
                        const record = {
                          concepto: "Rebate Q" + rebateQ + " " + anio,
                          categoria: "rebate",
                          monto: totalReb,
                          estatus: "pendiente",
                          fecha_compromiso: fechaQ,
                          responsable: "Acteck",
                          notas: "Monitores: $" + Math.round(rebateData.monitores).toLocaleString("es-MX") + " (2%), Sillas: $" + Math.round(rebateData.sillas).toLocaleString("es-MX") + " (2%), Accesorios: $" + Math.round(rebateData.accesorios).toLocaleString("es-MX") + " (3%)",
                          cliente: "digitalife"
                        };
                        const { data, error } = await supabase.from("pagos").insert(record).select().single();
                        if (!error && data) {
                          setRegistros(prev => [...prev, data]);
                          flash("Pago de Rebate Q" + rebateQ + " registrado", "ok");
                        } else {
                          flash("Error al registrar rebate", "err");
                        }
                      }} className="px-4 py-1.5 bg-red-500 text-white text-xs font-bold rounded-lg hover:bg-red-600 transition-colors ml-2">
                        Registrar Pago Q{rebateQ}
                      </button>;
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Calculadora SPIFF Digitalife — por crecimiento de Sellout */}
          {clienteKey === "digitalife" && catActiva === "spiff" && spiffCalc && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚀</span>
                    <h3 className="text-lg font-bold text-gray-800">SPIFF por Crecimiento — Digitalife {new Date().getFullYear()}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Cuota anual SO: {formatMXN(SPIFF_CUOTA_ANUAL)} · {(SPIFF_H1_PCT*100).toFixed(0)}% H1 / {((1-SPIFF_H1_PCT)*100).toFixed(0)}% H2 · Temporalidad SI intra-semestre · Tope {formatMXN(SPIFF_TOPE)}/mes
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-400 uppercase">Acumulado YTD</p>
                  <p className="text-2xl font-bold text-purple-600">{formatMXN(spiffTotalYTD)}</p>
                </div>
              </div>

              {/* Tiers info */}
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {[...SPIFF_TIERS].reverse().map(t => (
                  <span key={t.key} className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-700">
                    {t.icon} <strong>{t.label}</strong> · {(t.umbral * 100).toFixed(0)}%+ alcance · {(t.pct * 100).toFixed(2)}%
                  </span>
                ))}
                <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-400">
                  &lt;90% → Sin SPIFF
                </span>
              </div>

              {/* Tabla mensual */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Mes</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Cuota SI Mín</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Cuota SO Mín</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Sell Out Real</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Alcance</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-600">Tier</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Comisión</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {spiffCalc.map(c => {
                      const MESES_F = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                      const p = c.pagoExistente;
                      const isNoAplica = p && p.estatus === "cancelado";
                      const isGenerado = p && p.estatus !== "cancelado";
                      const alcancePct = (c.alcance * 100).toFixed(0);
                      let alcanceColor = "#94a3b8";
                      if (c.alcance >= 1.20) alcanceColor = "#10b981";
                      else if (c.alcance >= 1.00) alcanceColor = "#3b82f6";
                      else if (c.alcance >= 0.90) alcanceColor = "#f59e0b";
                      else if (c.soActual > 0) alcanceColor = "#ef4444";
                      return (
                        <tr key={c.mes} className={`border-b border-gray-100 ${isNoAplica ? "opacity-50" : ""}`}>
                          <td className="py-2 px-3 font-medium text-gray-800">{MESES_F[c.mes - 1]}</td>
                          <td className="py-2 px-3 text-right text-gray-500 text-xs">{formatMXN(c.cuotaSI)}</td>
                          <td className="py-2 px-3 text-right text-gray-700">
                            {formatMXN(c.cuotaSOMin)}
                            {c.ajustado && <span className="ml-1 text-[10px] text-blue-600" title="Cuota ajustada manualmente">⚙</span>}
                          </td>
                          <td className="py-2 px-3 text-right text-gray-700 font-medium">{c.soActual > 0 ? formatMXN(c.soActual) : "—"}</td>
                          <td className="py-2 px-3 text-right font-bold" style={{ color: alcanceColor }}>
                            {c.soActual > 0 ? alcancePct + "%" : "—"}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {c.tier ? <span className="text-lg" title={c.tier.label}>{c.tier.icon}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-purple-700">
                            {isNoAplica ? <span className="text-gray-400">—</span> : c.comision > 0 ? formatMXN(c.comision) : <span className="text-gray-300">—</span>}
                            {c.capped && !isNoAplica && <div className="text-xs text-gray-400">cap</div>}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isNoAplica ? (
                              <button
                                onClick={() => revertirSpiff(p.id)}
                                className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1"
                                title="Revertir 'No aplica'"
                              >↺ Revertir</button>
                            ) : isGenerado ? (
                              <div className="flex items-center gap-1 justify-center">
                                <span className={`text-xs px-2 py-1 rounded ${p.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                  {p.estatus === "pagado" ? "✓ Pagado" : "⏳ Pendiente"}
                                </span>
                                <button
                                  onClick={() => revertirSpiff(p.id)}
                                  className="text-xs text-red-500 hover:text-red-700"
                                  title="Eliminar pago"
                                >🗑</button>
                              </div>
                            ) : c.tier && c.comision > 0 ? (
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button
                                  onClick={() => crearSpiffPago(c)}
                                  className="text-xs bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700"
                                >💰 Generar pago</button>
                                <button
                                  onClick={() => marcarSpiffNoAplica(c.mes)}
                                  className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200"
                                >No aplica</button>
                              </div>
                            ) : c.soActual > 0 ? (
                              <button
                                onClick={() => marcarSpiffNoAplica(c.mes)}
                                className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-1 hover:bg-gray-200"
                              >No aplica</button>
                            ) : (
                              <span className="text-xs text-gray-300">Sin datos</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500">
                💡 <strong>Fecha de pago automática:</strong> día 15 del mes siguiente · <strong>Responsable:</strong> PM Digitalife
              </div>
            </div>
          )}

          {/* {/* ═══ Calculadora REBATE Trimestral PCEL ═══ */}
          {clienteKey === "pcel" && catActiva === "rebate" && pcelCalc && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">📊</span>
                  <h3 className="text-lg font-bold text-gray-800">Calculadora Rebate Trimestral {new Date().getFullYear()}</h3>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 px-3 font-bold text-gray-700">Trimestre</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Sell In</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Cuota</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Alcance</th>
                      <th className="text-right py-2 px-3 font-bold text-blue-600">Rebate</th>
                      <th className="text-right py-2 px-3 font-bold text-emerald-600">Fondo MKT</th>
                      <th className="text-center py-2 px-3 font-bold text-gray-600">Pagar</th>
                      <th className="text-center py-2 px-3 font-bold text-gray-600">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcelCalc.quarterly.map((q, i) => {
                      const isApproved = pcelOverrideRebate[q.q] === "approved";
                      const meetsQuota = q.alcance >= 0.9;
                      const shouldPay = q.sellIn > 0 && (meetsQuota || isApproved);
                      const rebateAmt = shouldPay ? q.sellIn * q.rebatePct : 0;
                      const fondoAmt = shouldPay ? q.fondoAmount : 0;
                      const pagoReg = pcelPagosReg.find(p => p.categoria === "rebate" && p.folio && p.folio.includes("Q" + q.q));
                      return (<React.Fragment key={i}>
                        <tr className={"border-b border-gray-100 " + (q.sellIn > 0 ? "hover:bg-gray-50" : "text-gray-300")}>
                          <td className="py-2 px-3 font-semibold text-gray-700">{q.label}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{q.sellIn > 0 ? "$" + Math.round(q.sellIn).toLocaleString("es-MX") : "—"}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{q.cuota > 0 ? "$" + Math.round(q.cuota).toLocaleString("es-MX") : "—"}</td>
                          <td className="py-2 px-3 text-right">{q.sellIn > 0 ? <span className={"font-semibold " + (q.alcance >= 1.2 ? "text-green-600" : q.alcance >= 0.9 ? "text-blue-600" : "text-red-500")}>{(q.alcance * 100).toFixed(1)}%</span> : <span>—</span>}</td>
                          <td className="py-2 px-3 text-right"><span className={"font-bold " + (shouldPay ? (isApproved && !meetsQuota ? "text-orange-600" : "text-blue-600") : "text-gray-300")}>{shouldPay ? "$" + Math.round(rebateAmt).toLocaleString("es-MX") + (!meetsQuota && isApproved ? " *" : "") : q.sellIn > 0 ? "$0" : "—"}</span></td>
                          <td className="py-2 px-3 text-right text-emerald-600 font-bold">{shouldPay ? "$" + Math.round(fondoAmt).toLocaleString("es-MX") : q.sellIn > 0 ? "$0" : "—"}</td>
                          <td className="py-1 px-2 text-center">{q.sellIn > 0 && !meetsQuota ? (
                            <button onClick={() => setPcelOverrideRebate(prev => ({...prev, [q.q]: prev[q.q] === "approved" ? "" : "approved"}))} className={"px-3 py-1 rounded-full text-xs font-bold transition-all " + (isApproved ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600")}>{isApproved ? "Aprobado" : "Pagar"}</button>
                          ) : q.sellIn > 0 && meetsQuota ? (
                            <span className="text-xs text-green-500 font-semibold">✅</span>
                          ) : null}</td>
                          <td className="py-1 px-2 text-center">{shouldPay && !pagoReg ? (
                            <button onClick={() => setShowPagoForm(showPagoForm === "rebate-Q"+q.q ? null : "rebate-Q"+q.q)} className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 transition-all">+ Registrar</button>
                          ) : pagoReg ? (
                            <span className={"text-xs font-semibold px-2 py-0.5 rounded-full " + (pagoReg.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{pagoReg.estatus === "pagado" ? "Pagado" : "Pendiente"}</span>
                          ) : null}</td>
                        </tr>
                        {showPagoForm === "rebate-Q"+q.q && (
                          <tr><td colSpan="8" className="p-3 bg-blue-50 border-b">
                            <div className="flex items-center gap-3 flex-wrap">
                              <label className="text-xs text-gray-600">Compromiso: <input type="date" className="ml-1 px-2 py-1 border rounded text-xs" value={pagoFormData.fecha_compromiso} onChange={e => setPagoFormData(p => ({...p, fecha_compromiso: e.target.value}))} /></label>
                              <label className="text-xs text-gray-600">Responsable: <input type="text" className="ml-1 px-2 py-1 border rounded text-xs w-32" value={pagoFormData.responsable} onChange={e => setPagoFormData(p => ({...p, responsable: e.target.value}))} /></label>
                              <label className="text-xs text-gray-600">Notas: <input type="text" className="ml-1 px-2 py-1 border rounded text-xs w-40" value={pagoFormData.notas} onChange={e => setPagoFormData(p => ({...p, notas: e.target.value}))} /></label>
                              <button onClick={() => guardarPagoPcel("rebate", "Q"+q.q, rebateAmt)} className="px-3 py-1 rounded-lg text-xs font-bold bg-blue-600 text-white hover:bg-blue-700">Guardar</button>
                              <button onClick={() => setShowPagoForm(null)} className="px-3 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>);
                    })}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-2 px-3 font-bold text-gray-800">Total</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-800">{"$" + Math.round(pcelCalc.totalSellIn).toLocaleString("es-MX")}</td>
                      <td className="py-2 px-3"></td><td className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-right font-bold text-blue-600">{"$" + Math.round(pcelCalc.quarterly.reduce((s,q) => { const ok = q.alcance >= 0.9 || pcelOverrideRebate[q.q] === "approved"; return s + (q.sellIn > 0 && ok ? q.sellIn * q.rebatePct : 0); }, 0)).toLocaleString("es-MX")}</td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-600">{"$" + Math.round(pcelCalc.quarterly.reduce((s,q) => { const ok = q.alcance >= 0.9 || pcelOverrideRebate[q.q] === "approved"; return s + (q.sellIn > 0 && ok ? q.fondoAmount : 0); }, 0)).toLocaleString("es-MX")}</td>
                      <td></td><td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">* Tiers: {PCEL_REAL.rebateTiers.map(t => t.label + "=" + (t.pct*100) + "%").join(", ")}</p>
            </div>
          )}
          {/* ═══ Calculadora SPIFF Mensual PCEL ═══ */}
          {clienteKey === "pcel" && catActiva === "spiff" && pcelCalc && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-xl">💰</span>
                  <h3 className="text-lg font-bold text-gray-800">Calculadora SPIFF Mensual {new Date().getFullYear()}</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-700">{(SPIFF_PCT * 100).toFixed(2)}% sobre Sell In</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b-2 border-gray-200">
                      <th className="text-left py-2 px-3 font-bold text-gray-700">Mes</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Sell In</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Cuota</th>
                      <th className="text-right py-2 px-3 font-bold text-gray-700">Alcance</th>
                      <th className="text-right py-2 px-3 font-bold text-purple-600">SPIFF</th>
                      <th className="text-center py-2 px-3 font-bold text-gray-600">Pagar</th>
                      <th className="text-center py-2 px-3 font-bold text-gray-600">Registro</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pcelCalc.monthly.map((r, i) => {
                      const mName = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][r.mes - 1];
                      const isApproved = pcelOverrideSpiff[r.mes] === "approved";
                      const meetsQuota = r.alcance >= 0.9;
                      const shouldPay = r.sellIn > 0 && (meetsQuota || isApproved);
                      const spiffAmt = shouldPay ? r.sellIn * SPIFF_PCT : 0;
                      const pagoReg = pcelPagosReg.find(p => p.categoria === "spiff" && p.folio && p.folio.includes("M" + r.mes + "-"));
                      return (<React.Fragment key={i}>
                        <tr className={"border-b border-gray-100 " + (r.sellIn > 0 ? "hover:bg-gray-50" : "text-gray-300")}>
                          <td className="py-2 px-3 font-semibold text-gray-700">{mName}</td>
                          <td className="py-2 px-3 text-right text-gray-600">{r.sellIn > 0 ? "$" + Math.round(r.sellIn).toLocaleString("es-MX") : "—"}</td>
                          <td className="py-2 px-3 text-right text-gray-500">{r.cuota > 0 ? "$" + Math.round(r.cuota).toLocaleString("es-MX") : "—"}</td>
                          <td className="py-2 px-3 text-right">{r.sellIn > 0 ? <span className={"font-semibold " + (r.alcance >= 1.2 ? "text-green-600" : r.alcance >= 0.9 ? "text-blue-600" : "text-red-500")}>{(r.alcance * 100).toFixed(1)}%</span> : <span>—</span>}</td>
                          <td className="py-2 px-3 text-right"><span className={"font-bold " + (shouldPay ? (isApproved && !meetsQuota ? "text-orange-600" : "text-purple-600") : "text-gray-300")}>{shouldPay ? "$" + Math.round(spiffAmt).toLocaleString("es-MX") + (!meetsQuota && isApproved ? " *" : "") : r.sellIn > 0 ? "$0" : "—"}</span></td>
                          <td className="py-1 px-2 text-center">{r.sellIn > 0 && !meetsQuota ? (
                            <button onClick={() => setPcelOverrideSpiff(prev => ({...prev, [r.mes]: prev[r.mes] === "approved" ? "" : "approved"}))} className={"px-3 py-1 rounded-full text-xs font-bold transition-all " + (isApproved ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-500 hover:bg-orange-100 hover:text-orange-600")}>{isApproved ? "Aprobado" : "Pagar"}</button>
                          ) : r.sellIn > 0 && meetsQuota ? (
                            <span className="text-xs text-green-500 font-semibold">✅</span>
                          ) : null}</td>
                          <td className="py-1 px-2 text-center">{shouldPay && !pagoReg ? (
                            <button onClick={() => setShowPagoForm(showPagoForm === "spiff-M"+r.mes ? null : "spiff-M"+r.mes)} className="px-2 py-1 rounded-lg text-xs font-bold bg-purple-50 text-purple-600 hover:bg-purple-100 transition-all">+ Registrar</button>
                          ) : pagoReg ? (
                            <span className={"text-xs font-semibold px-2 py-0.5 rounded-full " + (pagoReg.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700")}>{pagoReg.estatus === "pagado" ? "Pagado" : "Pendiente"}</span>
                          ) : null}</td>
                        </tr>
                        {showPagoForm === "spiff-M"+r.mes && (
                          <tr><td colSpan="7" className="p-3 bg-purple-50 border-b">
                            <div className="flex items-center gap-3 flex-wrap">
                              <label className="text-xs text-gray-600">Compromiso: <input type="date" className="ml-1 px-2 py-1 border rounded text-xs" value={pagoFormData.fecha_compromiso} onChange={e => setPagoFormData(p => ({...p, fecha_compromiso: e.target.value}))} /></label>
                              <label className="text-xs text-gray-600">Responsable: <input type="text" className="ml-1 px-2 py-1 border rounded text-xs w-32" value={pagoFormData.responsable} onChange={e => setPagoFormData(p => ({...p, responsable: e.target.value}))} /></label>
                              <label className="text-xs text-gray-600">Notas: <input type="text" className="ml-1 px-2 py-1 border rounded text-xs w-40" value={pagoFormData.notas} onChange={e => setPagoFormData(p => ({...p, notas: e.target.value}))} /></label>
                              <button onClick={() => guardarPagoPcel("spiff", "M"+r.mes, spiffAmt)} className="px-3 py-1 rounded-lg text-xs font-bold bg-purple-600 text-white hover:bg-purple-700">Guardar</button>
                              <button onClick={() => setShowPagoForm(null)} className="px-3 py-1 rounded-lg text-xs text-gray-500 hover:text-gray-700">Cancelar</button>
                            </div>
                          </td></tr>
                        )}
                      </React.Fragment>);
                    })}
                    <tr className="border-t-2 border-gray-300 bg-gray-50">
                      <td className="py-2 px-3 font-bold text-gray-800">Total</td>
                      <td className="py-2 px-3 text-right font-bold text-gray-800">{"$" + Math.round(pcelCalc.totalSellIn).toLocaleString("es-MX")}</td>
                      <td className="py-2 px-3"></td><td className="py-2 px-3"></td>
                      <td className="py-2 px-3 text-right font-bold text-purple-600">{"$" + Math.round(pcelCalc.monthly.reduce((s,r) => { const ok = r.alcance >= 0.9 || pcelOverrideSpiff[r.mes] === "approved"; return s + (r.sellIn > 0 && ok ? r.sellIn * SPIFF_PCT : 0); }, 0)).toLocaleString("es-MX")}</td>
                      <td></td><td></td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-400 mt-3">* SPIFF: {(SPIFF_PCT * 100).toFixed(2)}% mensual sobre Sell In</p>
            </div>
          )}

          
        </>
      )}

    </div>
  );
}

// ─── ESTRATEGIA DE PRODUCTO ─── CONSTANTS ───────────────────────────────────────────────────────────────
const ROADMAP_CODES = {
  RMI:   { label: "RunRate",           color: "bg-green-100",  text: "text-green-700" },
  NVS:   { label: "Nuevo",             color: "bg-blue-100",   text: "text-blue-700" },
  "2025": { label: "Lanzamiento 2025", color: "bg-purple-100", text: "text-purple-700" },
  "2026": { label: "Lanzamiento 2026", color: "bg-orange-100", text: "text-orange-700" },
  EXMAY: { label: "Mayoreo",           color: "bg-amber-100",  text: "text-amber-700" },
  RML:   { label: "Liquidación",       color: "bg-red-100",    text: "text-red-700" },
  PEM:   { label: "Marketplace",       color: "bg-teal-100",   text: "text-teal-700" },
  DECME: { label: "DECME",             color: "bg-gray-100",   text: "text-gray-700" },
};

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_KEYS_2025 = ["ene_2025", "feb_2025", "mar_2025", "abr_2025", "may_2025", "jun_2025", "jul_2025", "ago_2025", "sep_2025", "oct_2025", "nov_2025", "dic_2025"];
const MONTH_KEYS_2026 = ["ene_2026", "feb_2026", "mar_2026", "abr_2026", "may_2026", "jun_2026", "jul_2026", "ago_2026", "sep_2026", "oct_2026", "nov_2026", "dic_2026"];
const MONTH_VAL_2025 = ["ene_2025_val", "feb_2025_val", "mar_2025_val", "abr_2025_val", "may_2025_val", "jun_2025_val", "jul_2025_val", "ago_2025_val", "sep_2025_val", "oct_2025_val", "nov_2025_val", "dic_2025_val"];
const MONTH_VAL_2026 = ["ene_2026_val", "feb_2026_val", "mar_2026_val", "abr_2026_val", "may_2026_val", "jun_2026_val", "jul_2026_val", "ago_2026_val", "sep_2026_val", "oct_2026_val", "nov_2026_val", "dic_2026_val"];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function summonthlyValues(producto, monthKeys) {
  return monthKeys.reduce((sum, key) => sum + (producto[key] || 0), 0);
}

function filterProductos(productos, yearFilter, marcaFilter, categoriaFilter, roadmapFilter, searchTerm) {
  return productos.filter(p => {
    if (marcaFilter !== "todas" && (!p.marca || !p.marca.toUpperCase().includes(marcaFilter.toUpperCase()))) {
      return false;
    }
    if (categoriaFilter !== "todas" && p.categoria !== categoriaFilter) {
      return false;
    }
    if (roadmapFilter !== "todos" && p.roadmap !== roadmapFilter) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(term))
      );
    }
    return true;
  });
}

// ——— ESTRATEGIA DE PRODUCTO (Excel Upload + Data Display) ———

