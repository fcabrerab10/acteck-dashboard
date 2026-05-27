import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { PCEL_REAL, PAGOS_DIGITALIFE_2026 } from '../../lib/constants';
import { formatMXN, formatFecha, loadSheetJS } from '../../lib/utils';
import { CardHeader } from '../../components';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente } from '../../lib/permisos';
import { Wallet, CalendarDays, BarChart3, ClipboardList } from 'lucide-react';
import { NuevaPromocionButton, ListaPromociones } from './PagosPromociones';
import LineamientosCliente from './LineamientosCliente';

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

const CATEGORIA_META = {
  promociones: { label: "Promociones", color: "#f59e0b" },
  marketing: { label: "Marketing", color: "#8b5cf6" },
  pagosFijos: { label: "Pagos Fijos", color: "#3b82f6" },
  pagosVariables: { label: "Pagos Variables", color: "#10b981" },
  rebate: { label: "Rebate", color: "#ef4444" },
  spiff: { label: "SPIFF", color: "#9333ea" },
  // Solo aplica a Dicotech por ahora (interno, no visible para el cliente).
  fondoMkt: { label: "Fondo MKT", color: "#7C3AED", soloPara: ["dicotech"] },
};

const ESTATUS_OPT = [
  { value: "pendiente",  label: "💡 Pendiente",  color: "#f59e0b" },
  { value: "en_proceso", label: "⏳ En Proceso", color: "#3b82f6" },
  { value: "pagado",     label: "✓ Pagado",      color: "#10b981" },
  { value: "vencido",    label: "⚠ Vencido",     color: "#ef4444" },
  { value: "no_aplica",  label: "➖ No aplica",  color: "#9ca3af" },
  { value: "cancelado",  label: "✕ Cancelado",   color: "#94a3b8" },
];

// Helper: ¿el mes de la fecha es posterior al mes actual? (no se cuenta como pendiente todavía)
function esMesFuturo(fechaStr) {
  if (!fechaStr) return false;
  const s = String(fechaStr).slice(0, 10);
  const [y, m] = s.split("-").map((n) => parseInt(n, 10));
  if (!y || !m) return false;
  const hoy = new Date();
  const hy = hoy.getFullYear();
  const hm = hoy.getMonth() + 1; // 1-12
  return y > hy || (y === hy && m > hm);
}

export default function PagosCliente({ cliente, clienteKey }) {
  const c = cliente;
  const perfil = usePerfil();
  // Permiso granular por (clienteKey, 'pagos').
  const canEdit = puedeEditarPestanaCliente(perfil, clienteKey, 'pagos');

  // ── State ──
  const [registros, setRegistros]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [catActiva, setCatActiva]     = useState("todas");
  const [promosVer, setPromosVer]     = useState(0);
  const [mostrarFuturos, setMostrarFuturos] = useState(() => {
    try { return localStorage.getItem("pagos_mostrar_futuros") === "true"; } catch { return false; }
  });
  useEffect(() => {
    try { localStorage.setItem("pagos_mostrar_futuros", String(mostrarFuturos)); } catch {}
  }, [mostrarFuturos]);
  const [expandedMonth, setExpandedMonth] = useState(null);
  // Colapsable del Resumen General por Mes (default colapsado para no saturar)
  const [resumenMensualAbierto, setResumenMensualAbierto] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMeses, setExportMeses] = useState([]); // ["YYYY-MM", ...] multi-select
  const [historialPago, setHistorialPago] = useState(null); // { pago, entries }
  const [expandedPagoId, setExpandedPagoId] = useState(null); // pago marketing expandido
  const [actividadesPorPago, setActividadesPorPago] = useState({}); // cache pago_id → [actividades]
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
    responsable: "", notas: "", fuente: "", tipo_actividad: "",
  });

  // Tipos de actividad de Marketing (selectables cuando categoria='marketing')
  const TIPOS_ACTIVIDAD_MKT = [
    { value: "stand", label: "Stand / Punto de venta" },
    { value: "anuncios", label: "Anuncios pagados" },
    { value: "evento", label: "Evento / Convención" },
    { value: "redes_sociales", label: "Redes sociales" },
    { value: "dem", label: "DEM (email mkt)" },
    { value: "capacitacion", label: "Capacitación / Entrenamiento" },
    { value: "material_pop", label: "Material POP / Display" },
    { value: "promocion", label: "Promoción al consumidor" },
    { value: "otro", label: "Otro" },
  ];

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
  // ── Lineamientos del cliente (lee desde lineamientos_cliente, fallback a hardcodes) ──
  const [lineamientos, setLineamientos] = useState({});
  useEffect(() => {
    if (!DB_CONFIGURED || !clienteKey) return;
    (async () => {
      const { data } = await supabase
        .from('lineamientos_cliente')
        .select('tipo, config')
        .eq('cliente', clienteKey);
      const map = {};
      (data || []).forEach(l => { map[l.tipo] = l.config || {}; });
      setLineamientos(map);
    })();
  }, [clienteKey]);

  // REBATE_PCT (Digitalife): lee de lineamientos.rebate.por_categoria con fallback a hardcoded
  const REBATE_PCT = React.useMemo(() => {
    const cfg = lineamientos?.rebate?.por_categoria;
    if (cfg && typeof cfg === 'object') {
      return {
        monitores:  Number(cfg.monitores)  || 0.02,
        sillas:     Number(cfg.sillas)     || 0.02,
        accesorios: Number(cfg.accesorios) || 0.03,
      };
    }
    return { monitores: 0.02, sillas: 0.02, accesorios: 0.03 };
  }, [lineamientos]);
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
  // SPIFF Digitalife — lee de lineamientos.spiff con fallback a hardcodes
  const SPIFF_CUOTA_ANUAL = React.useMemo(() =>
    Number(lineamientos?.spiff?.cuota_anual) || 23000000,
    [lineamientos]
  );
  const SPIFF_H1_PCT = React.useMemo(() =>
    Number(lineamientos?.spiff?.split_h1_h2?.[0]) || 0.40,
    [lineamientos]
  );
  const SPIFF_CUOTA_OVERRIDES = React.useMemo(() =>
    lineamientos?.spiff?.cuota_overrides || { 2: 1533103 },
    [lineamientos]
  );
  const SPIFF_REDISTRIBUIR_EN = React.useMemo(() =>
    lineamientos?.spiff?.redistribuir_en || [7, 8, 9, 10, 11, 12],
    [lineamientos]
  );
  const SPIFF_TIERS = React.useMemo(() => {
    const tiers = lineamientos?.spiff?.tiers;
    if (Array.isArray(tiers) && tiers.length > 0) {
      // Mapear formato lineamientos {min_alcance, pct} → formato calculadora {umbral, pct, key, icon, label}
      return tiers.map(t => ({
        umbral: Number(t.min_alcance ?? t.umbral) || 0,
        pct: Number(t.pct) || 0,
        key: t.key || (Number(t.min_alcance ?? t.umbral) >= 1.20 ? 'alto' : Number(t.min_alcance ?? t.umbral) >= 1.00 ? 'medio' : 'basico'),
        icon: t.icon || (Number(t.min_alcance ?? t.umbral) >= 1.20 ? '🥇' : Number(t.min_alcance ?? t.umbral) >= 1.00 ? '🥈' : '🥉'),
        label: t.label || (Number(t.min_alcance ?? t.umbral) >= 1.20 ? 'Alto' : Number(t.min_alcance ?? t.umbral) >= 1.00 ? 'Medio' : 'Básico'),
      })).sort((a, b) => b.umbral - a.umbral);
    }
    return [
      { key: "alto",    umbral: 1.20, pct: 0.0018, icon: "🥇", label: "Alto" },
      { key: "medio",   umbral: 1.00, pct: 0.0016, icon: "🥈", label: "Medio" },
      { key: "basico",  umbral: 0.90, pct: 0.0010, icon: "🥉", label: "Básico" },
    ];
  }, [lineamientos]);
  const SPIFF_TOPE = React.useMemo(() =>
    Number(lineamientos?.spiff?.tope_mensual) || 4000,
    [lineamientos]
  );
  const [digiSellOut26, setDigiSellOut26] = useState({});
  const [digiCuotas, setDigiCuotas] = useState([]);
  const [dicoSellIn, setDicoSellIn] = useState({});      // Dicotech: sell-in mensual $
  const [spiffPagos, setSpiffPagos] = useState({});  // Digitalife: { "2026-01": pagoRow } | Dicotech: { "2026-01-SI": ..., "2026-01-SO": ... }
  const [spiffLoading, setSpiffLoading] = useState(false);

  useEffect(() => {
    if ((clienteKey !== "digitalife" && clienteKey !== "dicotech") || !DB_CONFIGURED) return;
    setSpiffLoading(true);
    (async () => {
      const anio = new Date().getFullYear();
      // Paginación para sellout_sku
      const fetchAll = async (qs) => {
        let all = [], from = 0, PAGE = 1000;
        while (true) {
          const { data } = await supabase.from("sellout_sku").select(qs).eq("cliente", clienteKey).eq("anio", anio).range(from, from + PAGE - 1);
          if (!data || data.length === 0) break;
          all = all.concat(data);
          if (data.length < PAGE) break;
          from += PAGE;
        }
        return all;
      };
      // Sell-In sólo lo cargamos para Dicotech (lo usa la calculadora SPIFF SI).
      const siProm = clienteKey === "dicotech"
        ? supabase.from("sell_in_sku").select("mes,monto_pesos").eq("cliente", clienteKey).eq("anio", anio)
        : Promise.resolve({ data: [] });
      const [soData, cuotasData, existingSpiffPagos, siRes] = await Promise.all([
        fetchAll("mes,monto_pesos"),
        supabase.from("cuotas_mensuales").select("mes,cuota_min,cuota_ideal").eq("cliente", clienteKey).eq("anio", anio).order("mes"),
        supabase.from("pagos").select("*").eq("cliente", clienteKey).eq("categoria", "spiff"),
        siProm,
      ]);
      const byMes = {};
      soData.forEach(r => { const m = Number(r.mes); byMes[m] = (byMes[m] || 0) + (Number(r.monto_pesos) || 0); });
      setDigiSellOut26(byMes);
      setDigiCuotas(cuotasData.data || []);
      // Sell-In Dicotech
      const siByMes = {};
      (siRes.data || []).forEach(r => { const m = Number(r.mes); siByMes[m] = (siByMes[m] || 0) + (Number(r.monto_pesos) || 0); });
      setDicoSellIn(siByMes);
      // Mapear pagos spiff por mes. Para Dicotech soporta sufijo SI/SO.
      const spMap = {};
      const mesNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
      (existingSpiffPagos.data || []).forEach(p => {
        if (!p.concepto) return;
        // Dicotech: "SPIFF-SI Enero 2026 — …" o "SPIFF-SO Enero 2026 — …"
        const dual = p.concepto.match(/SPIFF-(SI|SO) (\w+) (\d{4})/);
        if (dual) {
          const mesIdx = mesNames.indexOf(dual[2]);
          if (mesIdx >= 0) spMap[`${dual[3]}-${String(mesIdx + 1).padStart(2, "0")}-${dual[1]}`] = p;
          return;
        }
        // Digitalife (legacy): "SPIFF Enero 2026 — …"
        const single = p.concepto.match(/SPIFF (\w+) (\d{4})/);
        if (single) {
          const mesIdx = mesNames.indexOf(single[1]);
          if (mesIdx >= 0) spMap[`${single[2]}-${String(mesIdx + 1).padStart(2, "0")}`] = p;
        }
      });
      setSpiffPagos(spMap);
      setSpiffLoading(false);
    })();
  }, [clienteKey, registros.length]);

  // Cálculo del SPIFF por mes
  const spiffCalc = React.useMemo(() => {
    if ((clienteKey !== "digitalife" && clienteKey !== "dicotech") || digiCuotas.length === 0) return null;
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

  // ── SPIFF Dual de Dicotech ──
  // (1) Sell-In tiered mensual: 131%+=0.15%, 115-130%=0.12%, 95-114.99%=0.09%
  // (2) Sell-Out flat mensual: 95%+=0.06%
  // Cuota SO = cuota_min Sell-In × 1.06 (cuota_factor)
  // Lee config desde lineamientos.spiff (modo:"dual")
  const spiffDicotechCalc = React.useMemo(() => {
    if (clienteKey !== "dicotech" || digiCuotas.length === 0) return null;
    const cfg = lineamientos?.spiff || {};
    if (cfg.modo !== "dual") return null;
    const siTiers = ((cfg.sell_in?.tiers) || []).map(t => ({
      umbral: Number(t.min_alcance) || 0,
      pct: Number(t.pct) || 0,
      label: t.label || "",
    })).sort((a, b) => b.umbral - a.umbral);
    const soPctFijo = Number(cfg.sell_out?.pct_fijo) || 0;
    const soMinAlcance = Number(cfg.sell_out?.min_alcance) || 0.95;
    const soCuotaFactorDefault = Number(cfg.sell_out?.cuota_factor) || 1.06;
    // Overrides por mes (AAAA-MM → factor). Permite manejar el cambio
    // histórico (Ene-May 2026 = 1.05, Jun+ = 1.06) sin tocar código.
    const soFactorOverrides = cfg.sell_out?.cuota_factor_override_meses || {};

    const anio = new Date().getFullYear();
    const results = [];
    for (let m = 1; m <= 12; m++) {
      const cRow = digiCuotas.find(x => Number(x.mes) === m);
      const cuotaSI = cRow ? Number(cRow.cuota_min) || 0 : 0;
      const ymKey = `${anio}-${String(m).padStart(2,"0")}`;
      const soCuotaFactor = soFactorOverrides[ymKey] != null
        ? Number(soFactorOverrides[ymKey])
        : soCuotaFactorDefault;
      const cuotaSO = cuotaSI * soCuotaFactor;
      const siActual = Number(dicoSellIn[m]) || 0;
      const soActual = Number(digiSellOut26[m]) || 0;
      const alcanceSI = cuotaSI > 0 ? siActual / cuotaSI : 0;
      const alcanceSO = cuotaSO > 0 ? soActual / cuotaSO : 0;
      const tierSI = siTiers.find(t => alcanceSI >= t.umbral) || null;
      const comisionSI = tierSI ? siActual * tierSI.pct : 0;
      const aplicaSO = alcanceSO >= soMinAlcance;
      const comisionSO = aplicaSO ? soActual * soPctFijo : 0;
      const keyMes = `${anio}-${String(m).padStart(2, "0")}`;
      results.push({
        mes: m, cuotaSI, cuotaSO, siActual, soActual,
        alcanceSI, alcanceSO, tierSI, comisionSI, comisionSO,
        soPctFijo, soMinAlcance, aplicaSO,
        pagoSI: spiffPagos[`${keyMes}-SI`],
        pagoSO: spiffPagos[`${keyMes}-SO`],
      });
    }
    return results;
  }, [clienteKey, digiCuotas, dicoSellIn, digiSellOut26, spiffPagos, lineamientos]);

  const spiffDicotechTotalYTD = React.useMemo(() => {
    if (!spiffDicotechCalc) return { si: 0, so: 0, total: 0 };
    let si = 0, so = 0;
    for (const c of spiffDicotechCalc) {
      const sumar = (pago, calcAmt) => {
        if (pago && pago.estatus === "cancelado") return 0;
        if (pago) return Number(pago.monto) || 0;
        return calcAmt;
      };
      si += sumar(c.pagoSI, c.comisionSI);
      so += sumar(c.pagoSO, c.comisionSO);
    }
    return { si, so, total: si + so };
  }, [spiffDicotechCalc]);

  // Crear pago SPIFF dual (Dicotech). tipo = "SI" | "SO"
  // forzado=true permite generar el pago aunque no alcance la cuota mínima
  // (botón "pagar manual" pedido por el user).
  const crearSpiffDicotechPago = async (calc, tipo, forzado = false) => {
    if (!canEdit) return;
    const mesNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const mesLabel = mesNames[calc.mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = calc.mes === 12 ? 1 : calc.mes + 1;
    const nextAnio = calc.mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    let montoAuto = 0;
    let detalle = "";
    if (tipo === "SI") {
      montoAuto = calc.comisionSI;
      detalle = `Sell-In: ${formatMXN(calc.siActual)} · Cuota SI: ${formatMXN(calc.cuotaSI)} · Alcance ${(calc.alcanceSI*100).toFixed(0)}% · Tier ${calc.tierSI?.label || "Sin tier"}`;
    } else {
      montoAuto = calc.comisionSO;
      detalle = `Sell-Out: ${formatMXN(calc.soActual)} · Cuota SO: ${formatMXN(calc.cuotaSO)} · Alcance ${(calc.alcanceSO*100).toFixed(0)}% · ${(calc.soPctFijo*100).toFixed(2)}%`;
    }
    // Si fue forzado y el monto auto es 0, pedimos un monto manual al usuario
    let monto = montoAuto;
    if (forzado && montoAuto === 0) {
      const input = window.prompt(`SPIFF ${tipo} ${mesLabel} — pago manual (no llegó a la cuota mínima).\n\nIngresa el monto en MXN a pagar:`, "0");
      if (input == null) return;
      monto = Number(input.replace(/[^0-9.-]/g, "")) || 0;
      if (monto <= 0) { alert("Monto inválido."); return; }
    }
    const row = {
      cliente: clienteKey, categoria: "spiff", folio: null,
      concepto: `SPIFF-${tipo} ${mesLabel} ${anio}${forzado ? " — manual" : ""}`,
      monto,
      estatus: "pendiente", fecha_compromiso: fechaCompromiso,
      responsable: "Fernando Cabrera",
      notas: `${detalle}${forzado ? " · Pago manual forzado" : ""}`,
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) { alert("Error creando pago: " + (error.message || JSON.stringify(error))); return; }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(calc.mes).padStart(2, "0")}-${tipo}`]: data }));
    flash(`✓ SPIFF ${tipo} ${mesLabel} generado`);
  };

  // ── Fondo MKT Dual mensual de Dicotech (NUEVO modelo) ──
  // Dos fondos paralelos por mes:
  //   1) Fondo Interno: 1% del sell-in mes SIEMPRE (no visible al cliente)
  //   2) Fondo MKT Cliente: tier % según alcance Q acumulado al cierre del mes
  //      (0.75% si Q<90%, 0.75/1.00/1.25% según tier). Visible al cliente.
  // Plan MKT contratado ($14,007.14 mensual fijo) sale del fondo cliente
  // primero y del interno si no alcanza.
  const [dicoFondoMovs, setDicoFondoMovs] = useState([]);
  useEffect(() => {
    if (clienteKey !== "dicotech" || !DB_CONFIGURED) return;
    (async () => {
      const anio = new Date().getFullYear();
      const { data } = await supabase.from("fondos_mkt_movimientos")
        .select("*").eq("cliente","dicotech").eq("anio",anio)
        .order("mes").order("tipo_fondo").order("tipo_movimiento");
      setDicoFondoMovs(data || []);
    })();
  }, [clienteKey, registros.length]);

  const dicoFondoTablaMensual = React.useMemo(() => {
    if (clienteKey !== "dicotech") return null;
    const cfg = lineamientos?.fondo_mkt || {};
    const planMonto = Number(cfg.plan_mkt_contratado?.monto_mensual) || 0;
    // Construir tabla mensual con saldo acumulado para cada fondo
    const filas = [];
    let saldoIntPrev = 0, saldoCliPrev = 0;
    for (let m = 1; m <= 12; m++) {
      const movsMes = dicoFondoMovs.filter(x => x.mes === m);
      const genInt = movsMes.filter(x => x.tipo_fondo === "interno" && x.tipo_movimiento === "generacion").reduce((s,x) => s + Number(x.monto), 0);
      const genCli = movsMes.filter(x => x.tipo_fondo === "mkt_cliente" && x.tipo_movimiento === "generacion").reduce((s,x) => s + Number(x.monto), 0);
      const apliInt = movsMes.filter(x => x.tipo_fondo === "interno" && x.tipo_movimiento === "aplicacion").reduce((s,x) => s + Number(x.monto), 0);
      const apliCli = movsMes.filter(x => x.tipo_fondo === "mkt_cliente" && x.tipo_movimiento === "aplicacion").reduce((s,x) => s + Number(x.monto), 0);
      const saldoIntFinal = saldoIntPrev + genInt - apliInt;
      const saldoCliFinal = saldoCliPrev + genCli - apliCli;
      filas.push({
        mes: m,
        saldoIntInicio: saldoIntPrev, genInt, apliInt, saldoIntFinal,
        saldoCliInicio: saldoCliPrev, genCli, apliCli, saldoCliFinal,
        aplicaciones: movsMes.filter(x => x.tipo_movimiento === "aplicacion"),
      });
      saldoIntPrev = saldoIntFinal;
      saldoCliPrev = saldoCliFinal;
    }
    return { filas, planMonto, saldoIntActual: saldoIntPrev, saldoCliActual: saldoCliPrev };
  }, [clienteKey, dicoFondoMovs, lineamientos]);

  // Aplicar un pago al fondo (típicamente el plan MKT mensual de $14K).
  // El usuario elige de qué fondo sale ("mkt_cliente" | "interno"). Si elige
  // "mkt_cliente" y el saldo no alcanza, automáticamente se hace split:
  // toma lo que pueda del cliente y el resto del interno.
  const aplicarPagoFondoDicotech = async (mes, montoTotal, fondoOrigen, concepto) => {
    if (!canEdit) return;
    const cfg = lineamientos?.fondo_mkt || {};
    const orden = cfg.plan_mkt_contratado?.orden_descuento || ["mkt_cliente","interno"];
    const fila = dicoFondoTablaMensual?.filas.find(f => f.mes === mes);
    if (!fila) return;
    const saldoCli = fila.saldoCliInicio + fila.genCli - fila.apliCli;
    const saldoInt = fila.saldoIntInicio + fila.genInt - fila.apliInt;
    let movsToInsert = [];
    const anio = new Date().getFullYear();
    let restante = montoTotal;
    if (fondoOrigen === "mkt_cliente" || fondoOrigen === "auto") {
      const disponible = saldoCli > 0 ? saldoCli : 0;
      const toma = Math.min(restante, disponible);
      if (toma > 0) {
        movsToInsert.push({
          cliente: "dicotech", anio, mes, tipo_fondo: "mkt_cliente",
          tipo_movimiento: "aplicacion", monto: toma,
          notas: concepto + (toma < montoTotal ? " (parcial — saldo insuficiente)" : "")
        });
        restante -= toma;
      }
      if (restante > 0) {
        // Tomar del interno (saldo puede ir negativo, OK)
        movsToInsert.push({
          cliente: "dicotech", anio, mes, tipo_fondo: "interno",
          tipo_movimiento: "aplicacion", monto: restante,
          notas: concepto + " (complemento desde Fondo Interno)"
        });
        restante = 0;
      }
    } else {
      // fondoOrigen === "interno": todo del interno
      movsToInsert.push({
        cliente: "dicotech", anio, mes, tipo_fondo: "interno",
        tipo_movimiento: "aplicacion", monto: montoTotal,
        notas: concepto
      });
    }
    const { data, error } = await supabase.from("fondos_mkt_movimientos").insert(movsToInsert).select();
    if (error) { alert("Error: " + error.message); return; }
    setDicoFondoMovs(prev => [...prev, ...data].sort((a,b) => a.mes - b.mes));
    flash(`✓ Pago aplicado al mes ${mes}: ${formatMXN(montoTotal)}`);
  };

  const revertirMovimientoFondo = async (movId) => {
    if (!canEdit) return;
    if (!window.confirm("¿Eliminar este movimiento del fondo?")) return;
    const { error } = await supabase.from("fondos_mkt_movimientos").delete().eq("id", movId);
    if (error) { alert("Error: " + error.message); return; }
    setDicoFondoMovs(prev => prev.filter(m => m.id !== movId));
    flash("✓ Movimiento revertido");
  };

  // ── Rebate trimestral Dicotech ──
  // 2% del sell-in del Q si el alcance es ≥ 90%. Pago al cierre del Q.
  // Si no llega, botón ámbar permite pagar manual con monto a discreción.
  // Lee config desde lineamientos.rebate (tiers, alcance_minimo_pago).
  const dicoRebateCalc = React.useMemo(() => {
    if (clienteKey !== "dicotech" || digiCuotas.length === 0) return null;
    const cfg = lineamientos?.rebate || {};
    const tiers = (cfg.tiers || []).slice().sort((a, b) => Number(b.min_alcance) - Number(a.min_alcance));
    const alcanceMin = Number(cfg.alcance_minimo_pago) || 0.90;
    const QUARTERS = [[1,2,3], [4,5,6], [7,8,9], [10,11,12]];
    const labels = ["Q1 (Ene-Mar)", "Q2 (Abr-Jun)", "Q3 (Jul-Sep)", "Q4 (Oct-Dic)"];
    return QUARTERS.map((meses, qi) => {
      const cuotaQ = meses.reduce((s, m) => {
        const r = digiCuotas.find(x => Number(x.mes) === m);
        return s + (r ? Number(r.cuota_min) || 0 : 0);
      }, 0);
      const sellInQ = meses.reduce((s, m) => s + (Number(dicoSellIn[m]) || 0), 0);
      const alcance = cuotaQ > 0 ? sellInQ / cuotaQ : 0;
      const tier = tiers.find(t => alcance >= Number(t.min_alcance)) || null;
      const cumple = alcance >= alcanceMin;
      const rebateAuto = cumple && tier ? sellInQ * Number(tier.pct) : 0;
      // Pago existente (categoría='rebate' con concepto que matchee el Q)
      const pagoExistente = registros.find(r => {
        if (r.categoria !== "rebate" || r.cliente !== clienteKey) return false;
        const mm = r.concepto?.match(/Q(\d)/);
        return mm && Number(mm[1]) === qi + 1;
      });
      return {
        q: qi + 1, label: labels[qi], meses, cuotaQ, sellInQ, alcance,
        tier, cumple, alcanceMin, rebateAuto,
        pagoExistente,
      };
    });
  }, [clienteKey, digiCuotas, dicoSellIn, lineamientos, registros]);

  const dicoRebateTotalYTD = React.useMemo(() => {
    if (!dicoRebateCalc) return 0;
    return dicoRebateCalc.reduce((s, q) => {
      const p = q.pagoExistente;
      if (p && p.estatus === "cancelado") return s;
      if (p) return s + (Number(p.monto) || 0);
      return s + q.rebateAuto;
    }, 0);
  }, [dicoRebateCalc]);

  const generarRebateDicotech = async (q, forzado = false) => {
    if (!canEdit) return;
    const anio = new Date().getFullYear();
    // Fecha de pago = día 15 del mes después del cierre del Q
    const mesCierre = q.q * 3;
    const fechaCompromiso = `${anio}-${String(mesCierre + 1).padStart(2, "0")}-15`;
    let monto = q.rebateAuto;
    if (forzado) {
      const tiers = lineamientos?.rebate?.tiers || [];
      const pctSugerido = tiers[tiers.length - 1]?.pct || 0.02;
      const sugerido = q.sellInQ * Number(pctSugerido);
      const input = window.prompt(
        `Rebate manual ${q.label} ${anio}\n\n` +
        `Cuota del Q: ${formatMXN(q.cuotaQ)}\n` +
        `Sell-In del Q: ${formatMXN(q.sellInQ)}\n` +
        `Alcance: ${(q.alcance*100).toFixed(0)}% (no alcanzó ${(q.alcanceMin*100).toFixed(0)}%)\n\n` +
        `Sugerido (${(pctSugerido*100).toFixed(2)}% del sell-in): ${formatMXN(sugerido)}\n\n` +
        `Ingresa el monto a pagar (MXN):`,
        sugerido.toFixed(0)
      );
      if (input == null) return;
      monto = Number(String(input).replace(/[^0-9.-]/g, "")) || 0;
      if (monto <= 0) { alert("Monto inválido."); return; }
    }
    const row = {
      cliente: clienteKey,
      categoria: "rebate",
      folio: null,
      concepto: `Rebate Q${q.q} ${anio}${forzado ? " — manual" : ""}`,
      monto,
      estatus: "pendiente",
      fecha_compromiso: fechaCompromiso,
      responsable: "Acteck",
      notas: forzado
        ? `Pago manual: alcance ${(q.alcance*100).toFixed(0)}% (no llegó al ${(q.alcanceMin*100).toFixed(0)}%) · Sell-In Q: ${formatMXN(q.sellInQ)}`
        : `${(Number(q.tier?.pct || 0.02)*100).toFixed(2)}% × ${formatMXN(q.sellInQ)} · alcance ${(q.alcance*100).toFixed(0)}% · ${q.tier?.label || ""}`,
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) { alert("Error: " + error.message); return; }
    setRegistros(prev => [...prev, data]);
    flash(`✓ Rebate ${q.label} generado: ${formatMXN(monto)}`);
  };

  const marcarRebateDicotechNoAplica = async (q) => {
    if (!canEdit) return;
    const anio = new Date().getFullYear();
    const mesCierre = q.q * 3;
    const fechaCompromiso = `${anio}-${String(mesCierre + 1).padStart(2, "0")}-15`;
    const row = {
      cliente: clienteKey, categoria: "rebate", folio: null,
      concepto: `Rebate Q${q.q} ${anio} — No aplica`,
      monto: 0, estatus: "cancelado",
      fecha_compromiso: fechaCompromiso,
      responsable: "Fernando Cabrera",
      notas: "Marcado como No aplica manualmente",
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) { alert("Error: " + error.message); return; }
    setRegistros(prev => [...prev, data]);
    flash(`✓ Rebate ${q.label} marcado No aplica`);
  };

  const marcarSpiffDicotechNoAplica = async (mes, tipo) => {
    if (!canEdit) return;
    const mesNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const mesLabel = mesNames[mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = mes === 12 ? 1 : mes + 1;
    const nextAnio = mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    const row = {
      cliente: clienteKey, categoria: "spiff", folio: null,
      concepto: `SPIFF-${tipo} ${mesLabel} ${anio} — No aplica`,
      monto: 0, estatus: "cancelado",
      fecha_compromiso: fechaCompromiso,
      responsable: "Fernando Cabrera",
      notas: "Marcado como No aplica manualmente",
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) { alert("Error: " + (error.message || JSON.stringify(error))); return; }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(mes).padStart(2, "0")}-${tipo}`]: data }));
    flash(`✓ SPIFF ${tipo} ${mesLabel} marcado como No aplica`);
  };

  const crearSpiffPago = async (calc) => {
    if (!canEdit) return;
    const mesLabel = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][calc.mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = calc.mes === 12 ? 1 : calc.mes + 1;
    const nextAnio = calc.mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    const row = {
      cliente: clienteKey, categoria: "spiff", folio: null,
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
    if (!canEdit) return;
    const mesLabel = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = mes === 12 ? 1 : mes + 1;
    const nextAnio = mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    const row = {
      cliente: clienteKey, categoria: "spiff", folio: null,
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

  // Cálculo de rebate extraído en función reusable (para poder disparar
  // actualizaciones manuales desde el botón "Actualizar").
  const calcularRebate = React.useCallback(async () => {
    if ((clienteKey !== "digitalife" && clienteKey !== "dicotech") || !DB_CONFIGURED) return;
    setRebateLoading(true);
    const anio = new Date().getFullYear();
    const [siRes, prodRes] = await Promise.all([
      supabase.from("sell_in_sku").select("sku,mes,monto_pesos").eq("cliente", clienteKey).eq("anio", anio),
      supabase.from("productos_cliente").select("sku,categoria").eq("cliente", clienteKey)
    ]);
    const catMap = {};
    (prodRes.data || []).forEach(p => { catMap[p.sku] = (p.categoria || "").trim().toLowerCase(); });
    const qTotals = { 1: 0, 2: 0, 3: 0, 4: 0 };
    const qData = { 1: { m: 0, s: 0, a: 0 }, 2: { m: 0, s: 0, a: 0 }, 3: { m: 0, s: 0, a: 0 }, 4: { m: 0, s: 0, a: 0 } };
    (siRes.data || []).forEach(r => {
      const cat = catMap[r.sku] || "";
      const monto = r.monto_pesos || 0;
      const mes = Number(r.mes);
      const q = mes <= 3 ? 1 : mes <= 6 ? 2 : mes <= 9 ? 3 : 4;
      // Match estricto: 'monitores' = solo la categoría exacta (no "soportes
      // para monitor" ni "accesorios para monitor" — esos van a Accesorios).
      if (cat === "monitores") { qData[q].m += monto; qTotals[q] += monto * 0.02; }
      else if (cat === "sillas") { qData[q].s += monto; qTotals[q] += monto * 0.02; }
      else { qData[q].a += monto; qTotals[q] += monto * 0.03; }
    });
    setRebateAllQ(qTotals);
    const sel = qData[rebateQ];
    setRebateData({ monitores: sel.m, sillas: sel.s, accesorios: sel.a });
    const synced = {};
    registros.filter(r => r.categoria === "rebate").forEach(r => {
      const m = r.concepto?.match(/Q(\d)/);
      if (m) synced[Number(m[1])] = r.id;
    });
    setRebateSynced(synced);
    setRebateLoading(false);
  }, [clienteKey, rebateQ, registros]);

  useEffect(() => { calcularRebate(); }, [calcularRebate]);

  // Borrar y actualizar el pago de rebate del Q actual
  const borrarRebatePago = async () => {
    if (!canEdit) return;
    const pagoId = rebateSynced[rebateQ];
    if (!pagoId) return;
    if (!window.confirm(`¿Eliminar el pago registrado de Rebate Q${rebateQ}? Después podrás recalcular y registrarlo de nuevo.`)) return;
    const { error } = await supabase.from("pagos").delete().eq("id", pagoId);
    if (error) { flash("Error al eliminar: " + error.message, "err"); return; }
    setRegistros(prev => prev.filter(r => r.id !== pagoId));
    setRebateSynced(p => { const n = { ...p }; delete n[rebateQ]; return n; });
    flash(`✓ Rebate Q${rebateQ} eliminado`);
  };
  const actualizarRebatePago = async () => {
    if (!canEdit) return;
    const pagoId = rebateSynced[rebateQ];
    if (!pagoId) return;
    // Recalcula con datos frescos y actualiza el registro
    await calcularRebate();
    const m = rebateData.monitores, s = rebateData.sillas, a = rebateData.accesorios;
    const totalReb = Math.round(m * REBATE_PCT.monitores + s * REBATE_PCT.sillas + a * REBATE_PCT.accesorios);
    const updates = {
      monto: totalReb,
      notas: `Monitores: $${Math.round(m).toLocaleString("es-MX")} (2%), Sillas: $${Math.round(s).toLocaleString("es-MX")} (2%), Accesorios: $${Math.round(a).toLocaleString("es-MX")} (3%) — Actualizado ${new Date().toLocaleDateString("es-MX")}`,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("pagos").update(updates).eq("id", pagoId);
    if (error) { flash("Error al actualizar: " + error.message, "err"); return; }
    setRegistros(prev => prev.map(r => r.id === pagoId ? { ...r, ...updates } : r));
    flash(`✓ Rebate Q${rebateQ} actualizado a ${formatMXN(totalReb)}`);
  };

  // ── PCEL Condiciones Comerciales (Rebate + Fondo MKT + SPIFF) ──
  const [pcelSellIn, setPcelSellIn] = useState({});
  // SPIFF PCEL: % fijo del sell-in. Lee de lineamientos.spiff.pct_fijo con fallback.
  const SPIFF_PCT = React.useMemo(() =>
    Number(lineamientos?.spiff?.pct_fijo) || 0.0021,
    [lineamientos]
  );
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

  // ── Fondo PCEL (MKT + Directo) — ledger de movimientos ──
  const [fondoMov, setFondoMov] = useState([]);
  const [fondoLoading, setFondoLoading] = useState(false);
  const [showFondoForm, setShowFondoForm] = useState(false);
  const [mostrarFondo, setMostrarFondo] = useState(false);  // toggle del ledger en pestaña Pagos
  const [fondoForm, setFondoForm] = useState({
    tipo_fondo: "mkt",
    tipo_mov: "gasto",
    fecha: new Date().toISOString().slice(0, 10),
    concepto: "",
    monto: "",
    folio: "",
    notas: "",
  });

  const fetchFondoMov = React.useCallback(async () => {
    if (clienteKey !== "pcel" || !DB_CONFIGURED) return;
    setFondoLoading(true);
    const { data } = await supabase
      .from("fondo_pcel_movimientos")
      .select("*")
      .order("fecha", { ascending: true })
      .order("id", { ascending: true });
    setFondoMov(data || []);
    setFondoLoading(false);
  }, [clienteKey]);

  useEffect(() => { fetchFondoMov(); }, [fetchFondoMov]);

  // Cálculo de saldos + ledger con saldo running por tipo de fondo
  const fondoResumen = React.useMemo(() => {
    const ledger = { mkt: [], directo: [] };
    const saldo = { mkt: 0, directo: 0 };
    const entradas = { mkt: 0, directo: 0 };
    const gastos = { mkt: 0, directo: 0 };
    const aporteAnioActual = { mkt: 0, directo: 0 };
    const gastoAnioActual = { mkt: 0, directo: 0 };
    const anio = new Date().getFullYear();

    for (const m of fondoMov) {
      const t = m.tipo_fondo;
      const monto = Number(m.monto) || 0;
      if (m.tipo_mov === "gasto") {
        saldo[t] -= monto;
        gastos[t] += monto;
        if (m.anio === anio) gastoAnioActual[t] += monto;
      } else {
        saldo[t] += monto;
        entradas[t] += monto;
        if (m.anio === anio && m.tipo_mov === "aporte") aporteAnioActual[t] += monto;
      }
      ledger[t].push({ ...m, saldo_running: saldo[t] });
    }
    return {
      saldoMkt: saldo.mkt, saldoDirecto: saldo.directo,
      entradasMkt: entradas.mkt, entradasDirecto: entradas.directo,
      gastosMkt: gastos.mkt, gastosDirecto: gastos.directo,
      aporteMktAnio: aporteAnioActual.mkt, aporteDirectoAnio: aporteAnioActual.directo,
      gastoMktAnio: gastoAnioActual.mkt, gastoDirectoAnio: gastoAnioActual.directo,
      ledger,
    };
  }, [fondoMov]);

  const crearMovimientoFondo = async () => {
    if (!fondoForm.concepto || !fondoForm.monto) {
      flash("⚠ Concepto y monto requeridos");
      return;
    }
    const monto = parseFloat(fondoForm.monto);
    if (isNaN(monto) || monto <= 0) {
      flash("⚠ Monto inválido");
      return;
    }
    const fecha = fondoForm.fecha;
    const d = new Date(fecha + "T00:00:00");
    const mes = d.getMonth() + 1;
    const trimestre = Math.ceil(mes / 3);
    const row = {
      tipo_fondo: fondoForm.tipo_fondo,
      tipo_mov: fondoForm.tipo_mov,
      fecha,
      anio: d.getFullYear(),
      trimestre,
      concepto: fondoForm.concepto.trim(),
      monto,
      folio: fondoForm.folio.trim() || null,
      notas: fondoForm.notas.trim() || null,
    };
    const { data, error } = await supabase.from("fondo_pcel_movimientos").insert([row]).select();
    if (error) {
      console.error("crearMovimientoFondo error:", error);
      flash("⚠ Error al guardar movimiento");
      return;
    }
    setFondoMov(prev => [...prev, ...(data || [])].sort((a, b) => {
      if (a.fecha === b.fecha) return a.id - b.id;
      return a.fecha < b.fecha ? -1 : 1;
    }));
    setShowFondoForm(false);
    setFondoForm({ tipo_fondo: "mkt", tipo_mov: "gasto", fecha: new Date().toISOString().slice(0, 10), concepto: "", monto: "", folio: "", notas: "" });
    flash("✓ Movimiento registrado");
  };

  // Crear movimiento de fondo a partir de un pago/promo (auto-link por pago_id)
  const crearMovimientoDesdePago = async (pago) => {
    const tipo_fondo = "mkt";  // solo MKT por ahora (Fondo Directo no se gestiona)
    const fecha = pago.fecha_pago_real || pago.fecha_compromiso || new Date().toISOString().slice(0, 10);
    const d = new Date(fecha + "T00:00:00");
    const mes = d.getMonth() + 1;
    const row = {
      tipo_fondo,
      tipo_mov: "gasto",
      fecha,
      anio: d.getFullYear(),
      trimestre: Math.ceil(mes / 3),
      concepto: pago.concepto || "(Sin concepto)",
      monto: Number(pago.monto) || 0,
      folio: pago.folio || null,
      pago_id: pago.id,
      notas: `Generado automáticamente desde Pago ${pago.categoria} · fuente=${pago.fuente}`,
    };
    const { data, error } = await supabase.from("fondo_pcel_movimientos").insert([row]).select();
    if (error) {
      console.error("crearMovimientoDesdePago error:", error);
      flash("⚠ Pago guardado pero no se pudo vincular al fondo");
      return;
    }
    setFondoMov(prev => [...prev, ...(data || [])].sort((a, b) => {
      if (a.fecha === b.fecha) return a.id - b.id;
      return a.fecha < b.fecha ? -1 : 1;
    }));
    flash(`✓ Pago vinculado al Fondo ${tipo_fondo === "mkt" ? "MKT" : "Directo"}`);
  };

  const eliminarMovimientoFondo = async (id) => {
    if (!window.confirm("¿Eliminar este movimiento? El saldo se recalculará.")) return;
    const { error } = await supabase.from("fondo_pcel_movimientos").delete().eq("id", id);
    if (error) {
      console.error("eliminarMovimientoFondo error:", error);
      flash("⚠ Error al eliminar");
      return;
    }
    setFondoMov(prev => prev.filter(m => m.id !== id));
    flash("✓ Movimiento eliminado");
  };
  
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

  // PCEL Rebate tiers — lee de lineamientos.rebate.tiers con fallback a PCEL_REAL.rebateTiers
  const pcelRebateTiers = React.useMemo(() => {
    const t = lineamientos?.rebate?.tiers;
    if (Array.isArray(t) && t.length > 0) {
      return t.map(x => ({
        min: Number(x.min_alcance ?? x.min) || 0,
        pct: Number(x.pct) || 0,
        label: x.label || (Number(x.min_alcance ?? x.min) * 100).toFixed(0) + '%+',
      })).sort((a, b) => a.min - b.min);
    }
    return PCEL_REAL.rebateTiers;
  }, [lineamientos]);

  // PCEL Fondo MKT — lee de lineamientos.fondo_mkt.tiers (si existe) o cae a PCEL_REAL.fondoMktTiers
  const pcelFondoMktTiers = React.useMemo(() => {
    const t = lineamientos?.fondo_mkt?.tiers;
    if (Array.isArray(t) && t.length > 0) {
      return t.map(x => ({
        maxAlcance: Number(x.max_alcance ?? x.maxAlcance) || Infinity,
        pct: Number(x.pct) || 0,
        label: x.label || '',
      })).sort((a, b) => a.maxAlcance - b.maxAlcance);
    }
    // Si solo hay aporte_pct simple en lineamientos, construir un tier único
    const aportePctSimple = Number(lineamientos?.fondo_mkt?.aporte_pct);
    const alcanceMin = Number(lineamientos?.fondo_mkt?.alcance_minimo_pct) || 100;
    if (aportePctSimple > 0) {
      return [
        { maxAlcance: alcanceMin / 100 - 0.0001, pct: 0, label: `< ${alcanceMin}%` },
        { maxAlcance: Infinity, pct: aportePctSimple, label: `≥ ${alcanceMin}%` },
      ];
    }
    return PCEL_REAL.fondoMktTiers;
  }, [lineamientos]);

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
      for (const t of pcelRebateTiers) {
        if (qAlcance >= t.min) { rebatePct = t.pct; rebateLabel = t.label; }
      }
      let fondoPct = 0, fondoLabel = "< 100%";
      for (const t of pcelFondoMktTiers) {
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
  }, [clienteKey, pcelSellIn, pcelCuotasSupa, pcelOverrideRebate, pcelOverrideSpiff, pcelRebateTiers, pcelFondoMktTiers]);


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
      .channel(`pagos-sync-${clienteKey}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [clienteKey]);

  const fetchData = async () => {
    // Filtrar por cliente activo (incluye registros legados sin cliente=NULL solo para digitalife,
    // ya que la columna cliente se agregó después y los registros viejos son de Digitalife)
    let query = supabase.from("pagos").select("*").order("created_at");
    if ((clienteKey === "digitalife" || clienteKey === "dicotech")) {
      query = query.or(`cliente.eq.${clienteKey},cliente.is.null`);
    } else {
      query = query.eq("cliente", clienteKey);
    }
    const { data } = await query;
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
    if (!canEdit) return; // Bloqueo por permisos
    setEditingCell({ id, field });
    setEditValue(value ?? "");
  };
  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };
  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const value = field === "monto" ? (parseFloat(editValue) || 0) : (editValue || null);

    // Efectos cruzados:
    //   - Si se marca fecha_pago_real → estatus='pagado'
    //   - Si estatus pasa a 'pagado' y no hay fecha_pago_real aún → autocompletar con hoy
    const hoyISO = new Date().toISOString().slice(0, 10);
    const reg = registros.find(r => r.id === id);
    const extra = {};
    if (field === "fecha_pago_real" && value) extra.estatus = "pagado";
    if (field === "estatus" && value === "pagado" && (!reg || !reg.fecha_pago_real)) {
      extra.fecha_pago_real = hoyISO;
    }

    setRegistros(prev => prev.map(r => r.id === id ? { ...r, [field]: value, ...extra } : r));
    cancelEdit();
    setSaving(true);
    const { error } = await supabase.from("pagos")
      .update({ [field]: value, updated_at: new Date().toISOString(), ...extra })
      .eq("id", id);
    setSaving(false);
    if (error) { flash("Error al guardar ✗", "err"); fetchData(); }
    else flash("Guardado ✓");
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
      fuente: newRow.fuente || null,
    };
    const { data, error } = await supabase.from("pagos").insert(record).select().single();
    if (error) {
      console.error("handleAdd error:", error, "record:", record);
      alert("Error al agregar: " + (error.message || JSON.stringify(error)));
      return;
    }
    setRegistros(prev => [...prev, data]);
    // Si la fuente es fondo_mkt (solo PCEL por ahora),
    // crear el movimiento automáticamente en el ledger del fondo.
    if (clienteKey === "pcel" && data.fuente === "fondo_mkt" && data.monto > 0) {
      await crearMovimientoDesdePago(data);
    }
    setNewRow({ folio: "", concepto: "", categoria: "promociones", monto: "",
                estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
                responsable: "", notas: "", fuente: "", tipo_actividad: "" });
    setShowAdd(false);
    flash("Registro agregado ✓");
  };

  // ── Add Pago Fijo (creates 12 monthly records) ──
  const handleAddFijo = async () => {
    const isExisting = newFijo.existente && newFijo.existente !== "__nuevo__";
    const concepto = isExisting ? newFijo.existente : newFijo.concepto.trim();
    if (!concepto) return;
    const selectedMeses = newFijo.meses.length > 0 ? newFijo.meses : MESES_ARR.map(m => m.key);
    // Preferir mes_fijo; caer a fecha_compromiso.slice(5,7) para registros legacy.
    const mesKeyDe = (r) => r.mes_fijo ? String(r.mes_fijo).padStart(2, "0")
                         : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : null);
    const existingMeses = isExisting && fijoGroups[concepto]
      ? fijoGroups[concepto].map(mesKeyDe).filter(Boolean)
      : [];
    const baseMonto = isExisting && fijoGroups[concepto] && fijoGroups[concepto][0] ? (fijoGroups[concepto][0].monto || 0) : (parseFloat(newFijo.monto) || 0);
    const baseResp = isExisting && fijoGroups[concepto] && fijoGroups[concepto][0] ? (fijoGroups[concepto][0].responsable || null) : (newFijo.responsable.trim() || null);
    const newMeses = selectedMeses.filter(m => !existingMeses.includes(m));
    if (newMeses.length === 0) { flash("Todos los meses seleccionados ya existen", "err"); return; }
    const anioActual = new Date().getFullYear();
    const records = newMeses.map(mKey => ({
      folio: "",
      concepto,
      categoria: "pagosFijos",
      cliente: clienteKey,
      monto: isExisting ? baseMonto : (parseFloat(newFijo.monto) || 0),
      estatus: "pendiente",
      fecha_compromiso: `${anioActual}-${mKey}-01`,
      fecha_pago_real: null,
      responsable: isExisting ? baseResp : (newFijo.responsable.trim() || null),
      notas: null,
      // Mes fijo independiente de fecha_compromiso (si cambias la fecha,
      // el pago sigue perteneciendo al mismo mes que lo creaste).
      mes_fijo: Number(mKey),
      anio_fijo: anioActual,
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
    // Si el pago tenía un movimiento de fondo vinculado, borrarlo también.
    await supabase.from("fondo_pcel_movimientos").delete().eq("pago_id", id);
    setFondoMov(prev => prev.filter(m => m.pago_id !== id));
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { flash("Error al eliminar: " + error.message, "err"); fetchData(); }
    else flash("Eliminado ✓");
  };

  // ──────────── Desglose de pago de marketing ────────────
  const togglePagoExpand = async (pagoId) => {
    if (expandedPagoId === pagoId) {
      setExpandedPagoId(null);
      return;
    }
    setExpandedPagoId(pagoId);
    if (actividadesPorPago[pagoId]) return; // ya cacheado
    const { data } = await supabase.from("marketing_actividades")
      .select("id, nombre, tipo, fecha, inversion, responsable, estatus, pago_id")
      .eq("pago_id", pagoId)
      .order("fecha");
    setActividadesPorPago(prev => ({ ...prev, [pagoId]: data || [] }));
  };

  // Excluir actividad: la deslinea del pago y recalcula el monto
  const excluirActividadDePago = async (pagoId, actividadId) => {
    if (!canEdit) return;
    if (!window.confirm("¿Excluir esta actividad del pago? Volverá a aparecer en Marketing como pendiente de pagar.")) return;
    // Desligar
    const { error: errAct } = await supabase.from("marketing_actividades")
      .update({ pago_id: null }).eq("id", actividadId);
    if (errAct) { flash("Error: " + errAct.message, "err"); return; }
    // Recalcular monto del pago = suma de inversiones restantes
    const { data: rest } = await supabase.from("marketing_actividades")
      .select("inversion").eq("pago_id", pagoId);
    const nuevoMonto = (rest || []).reduce((a, r) => a + (Number(r.inversion) || 0), 0);
    if (nuevoMonto === 0) {
      // No queda nada — preguntar si eliminar el pago
      if (window.confirm("Era la última actividad del pago. ¿Eliminar el pago completo?")) {
        await supabase.from("pagos").delete().eq("id", pagoId);
        flash("Actividad excluida y pago eliminado ✓");
        setExpandedPagoId(null);
        fetchData();
        return;
      }
    }
    await supabase.from("pagos").update({ monto: nuevoMonto }).eq("id", pagoId);
    // Refrescar local
    setActividadesPorPago(prev => ({ ...prev, [pagoId]: (prev[pagoId] || []).filter(a => a.id !== actividadId) }));
    setRegistros(prev => prev.map(r => r.id === pagoId ? { ...r, monto: nuevoMonto } : r));
    flash("Actividad excluida del pago ✓");
  };

  // Duplicar un pago — crea uno nuevo con los mismos datos, fecha_compromiso
  // avanzada un mes, estatus pendiente, folio vacío.
  const handleDuplicate = async (row) => {
    if (!canEdit) return;
    const nextFecha = (() => {
      if (!row.fecha_compromiso) return null;
      const d = new Date(row.fecha_compromiso + "T00:00:00");
      d.setMonth(d.getMonth() + 1);
      return d.toISOString().slice(0, 10);
    })();
    const copia = {
      cliente: row.cliente || clienteKey,
      folio: "",
      concepto: row.concepto,
      categoria: row.categoria,
      monto: row.monto,
      estatus: "pendiente",
      fecha_compromiso: nextFecha,
      fecha_pago_real: null,
      responsable: row.responsable,
      notas: row.notas,
    };
    const { data, error } = await supabase.from("pagos").insert(copia).select().single();
    if (error) { flash("Error al duplicar: " + error.message, "err"); return; }
    setRegistros(prev => [...prev, data]);
    flash("Duplicado ✓ — ajusta monto/fecha si hace falta");
  };

  // Toggle rápido: marcar como pagado con fecha de hoy (o des-marcar)
  const togglePagado = async (row) => {
    if (!canEdit) return;
    const hoyISO = new Date().toISOString().slice(0, 10);
    const yaPagado = row.estatus === "pagado";
    const updates = yaPagado
      ? { estatus: "pendiente", fecha_pago_real: null }
      : { estatus: "pagado",    fecha_pago_real: hoyISO };
    setRegistros(prev => prev.map(r => r.id === row.id ? { ...r, ...updates } : r));
    const { error } = await supabase.from("pagos")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", row.id);
    if (error) { flash("Error: " + error.message, "err"); fetchData(); }
    else flash(yaPagado ? "Marcado como pendiente" : `Pagado el ${hoyISO} ✓`);
  };

  // Ver historial de cambios (bitácora) de un pago
  const verHistorial = async (row) => {
    const { data, error } = await supabase.from("pagos_audit")
      .select("*").eq("pago_id", row.id)
      .order("changed_at", { ascending: false });
    if (error) { alert("Error: " + error.message); return; }
    setHistorialPago({ pago: row, entries: data || [] });
  };

  // ── Delete all months of a fijo concept ──
  const handleDeleteFijo = async (conceptoKey, ids) => {
    if (!window.confirm(`¿Eliminar todos los meses de "${conceptoKey}"? Esta acción no se puede deshacer.`)) return;
    setRegistros(prev => prev.filter(r => !ids.includes(r.id)));
    for (const id of ids) {
      await supabase.from("pagos").delete().eq("id", id);
    }
    flash(`"${conceptoKey}" eliminado ✓`);
  };

  // ── Toggle expand fijo ──
  const toggleFijo = (key) => {
    setExpandedFijos(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Computed ──
  const fijoRecords = registros.filter(r => r.categoria === "pagosFijos");
  const nonFijoRecords = registros.filter(r => r.categoria !== "pagosFijos");
  // Activos = lo que requiere atención: no pagado, no futuro, no cancelado/no-aplica
  const esActivo = (r) =>
    r.estatus !== "pagado" &&
    r.estatus !== "cancelado" &&
    r.estatus !== "no_aplica" &&
    !esMesFuturo(r.fecha_compromiso);

  // En "Todas": mostrar SOLO los pendientes (no pagados, no cancelados,
  //   no de meses futuros). Los pagados se van al menú "Pagos Completados"
  //   para no saturar la tabla principal.
  const visibleEnTodas = (r) =>
    r.estatus !== "pagado" &&
    r.estatus !== "cancelado" &&
    r.estatus !== "no_aplica" &&
    !esMesFuturo(r.fecha_compromiso);

  const filtered = catActiva === "todas"
    ? registros.filter(visibleEnTodas)
    : catActiva === "pagosFijos"
      ? fijoRecords
      : registros.filter(r => r.categoria === catActiva && esActivo(r));

  // Historial de pagos COMPLETADOS (estatus=pagado) agrupado por mes
  // Filtrado por la categoría activa (o todos si catActiva='todas')
  const pagadosDeCategoria = catActiva === "todas"
    ? registros.filter(r => r.estatus === "pagado")
    : registros.filter(r => r.categoria === catActiva && r.estatus === "pagado");

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
  const totalPorPagar = registros.filter(r => ["pendiente","en_proceso"].includes(r.estatus)).reduce((s, r) => s + (r.monto || 0), 0);
  const totalVencido  = registros.filter(r => r.estatus === "vencido").reduce((s, r) => s + (r.monto || 0), 0);
  const totalAnio     = registros.reduce((s, r) => s + (r.monto || 0), 0);

  // Monthly breakdown
  // Muestra los 12 meses del año actual siempre (aunque estén vacíos)
  // + cualquier mes de años anteriores/futuros donde haya registros.
  // Así no se "salta" meses y ves el calendario completo del año.
  const monthlyBreakdown = () => {
    const months = {};
    const ensureMonth = (k) => {
      if (!months[k]) months[k] = { mes: k, total: 0, promociones: 0, marketing: 0, pagosFijos: 0, pagosVariables: 0, rebate: 0, spiff: 0, records: [] };
    };
    // Pre-poblar los 12 meses del año en curso
    const anioActual = new Date().getFullYear();
    for (let m = 1; m <= 12; m++) {
      ensureMonth(`${anioActual}-${String(m).padStart(2, "0")}`);
    }
    // Agregar registros (agrega meses fuera del año actual si aplican)
    registros.forEach(r => {
      const d = r.fecha_compromiso;
      if (!d) return;
      const k = typeof d === "string" ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7);
      ensureMonth(k);
      months[k].total += (r.monto || 0);
      months[k].records.push(r);
      if (CATEGORIA_META[r.categoria]) months[k][r.categoria] = (months[k][r.categoria] || 0) + (r.monto || 0);
    });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  };

  // Export multi-mes — "lo que se tiene que pagar"
  // Una sola hoja con todos los meses seleccionados, con headers y subtotales
  // por mes. Incluye estatus: pendiente, en_proceso, vencido (no pagado
  // ni cancelado/no_aplica).
  const MESES_LARGOS_ARR = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  const nombreArchivoParaMeses = (mesesOrdenados) => {
    // mesesOrdenados: ["YYYY-MM", ...] ya ordenados asc
    const clienteLabel = (cliente?.nombre || clienteKey).split(" ")[0];
    if (mesesOrdenados.length === 1) {
      const [a, m] = mesesOrdenados[0].split("-");
      return `Pagos ${clienteLabel} ${MESES_LARGOS_ARR[Number(m) - 1]} ${a}.xlsx`;
    }
    // Mismo año?
    const anios = new Set(mesesOrdenados.map(k => k.split("-")[0]));
    if (anios.size === 1) {
      const anio = [...anios][0];
      // Consecutivos?
      const nums = mesesOrdenados.map(k => Number(k.split("-")[1])).sort((a, b) => a - b);
      const esConsec = nums.every((n, i) => i === 0 || n === nums[i - 1] + 1);
      if (esConsec) {
        const abrev = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
        return `Pagos ${clienteLabel} ${abrev[nums[0] - 1]}-${abrev[nums[nums.length - 1] - 1]} ${anio}.xlsx`;
      }
      return `Pagos ${clienteLabel} ${mesesOrdenados.length} meses ${anio}.xlsx`;
    }
    return `Pagos ${clienteLabel} ${mesesOrdenados.length} meses.xlsx`;
  };

  const exportarMeses = async () => {
    if (exportMeses.length === 0) return alert("Selecciona al menos un mes");
    const XLSX = await loadSheetJS();
    if (!XLSX) return alert("Error cargando librería Excel");

    const mesesOrden = [...exportMeses].sort(); // YYYY-MM ordena bien alfabéticamente
    const ordenCat = ["promociones","marketing","pagosFijos","pagosVariables","rebate","spiff"];

    // AoA (array of arrays) — manual porque necesitamos headers de mes embebidos
    const aoa = [["Concepto", "Categoría", "Monto", "Notas"]];
    const moneyRows = []; // índices de filas con monto numérico
    const headerRows = []; // índices de filas que son título de mes
    const subtotalRows = []; // índices de filas de subtotal
    let grandTotal = 0;
    let totalPagos = 0;

    for (const mesKey of mesesOrden) {
      const [a, m] = mesKey.split("-");
      const mesLabel = `${MESES_LARGOS_ARR[Number(m) - 1]} ${a}`;

      const delMes = registros.filter(r => {
        if (!r.fecha_compromiso) return false;
        if (String(r.fecha_compromiso).slice(0, 7) !== mesKey) return false;
        return ["pendiente", "en_proceso", "vencido"].includes(r.estatus);
      });
      delMes.sort((a, b) => {
        const ca = ordenCat.indexOf(a.categoria); const cb = ordenCat.indexOf(b.categoria);
        return (ca === -1 ? 99 : ca) - (cb === -1 ? 99 : cb);
      });

      if (delMes.length === 0) {
        headerRows.push(aoa.length);
        aoa.push([`${mesLabel}  (sin pagos por pagar)`, "", "", ""]);
        aoa.push(["", "", "", ""]);
        continue;
      }

      headerRows.push(aoa.length);
      aoa.push([mesLabel, "", "", ""]);
      let subtotal = 0;
      delMes.forEach(r => {
        const monto = Number(r.monto) || 0;
        moneyRows.push(aoa.length);
        aoa.push([
          r.concepto || "",
          CATEGORIA_META[r.categoria]?.label || r.categoria || "",
          monto,
          r.notas || "",
        ]);
        subtotal += monto;
      });
      subtotalRows.push(aoa.length);
      moneyRows.push(aoa.length);
      aoa.push(["Subtotal " + mesLabel, "", subtotal, ""]);
      aoa.push(["", "", "", ""]); // separador
      grandTotal += subtotal;
      totalPagos += delMes.length;
    }

    if (totalPagos === 0) {
      return alert("No hay pagos por pagar en los meses seleccionados.");
    }

    // Gran total al final
    subtotalRows.push(aoa.length);
    moneyRows.push(aoa.length);
    aoa.push(["TOTAL", "", grandTotal, ""]);

    const ws = XLSX.utils.aoa_to_sheet(aoa);
    // Formato moneda para filas con monto
    moneyRows.forEach(R => {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: 2 })];
      if (cell && typeof cell.v === "number") cell.z = '"$"#,##0';
    });
    // Merges para cabeceras de mes (col A-D)
    ws["!merges"] = headerRows.map(R => ({ s: { r: R, c: 0 }, e: { r: R, c: 3 } }));
    // Anchos
    ws["!cols"] = [{ wch: 50 }, { wch: 18 }, { wch: 14 }, { wch: 60 }];
    // Freeze header row
    ws["!freeze"] = { xSplit: 0, ySplit: 1 };

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagos por pagar");
    XLSX.writeFile(wb, nombreArchivoParaMeses(mesesOrden));
    setExportModalOpen(false);
    setExportMeses([]);
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
      // Etiqueta auxiliar para marketing con fuente o tipo_actividad
      const esMkt = row.categoria === "marketing";
      const fuenteTag = esMkt && row.fuente === "empresa" ? { label: "Empresa", color: "#059669", bg: "#D1FAE5" }
                     : esMkt && row.fuente === "fondo_mkt" ? { label: "Fondo MKT", color: "#7C3AED", bg: "#F3E8FF" }
                     : esMkt && row.fuente === "vendor" ? { label: "Vendor", color: "#475569", bg: "#F1F5F9" }
                     : null;
      const tipoActividadLabel = esMkt && row.tipo_actividad
        ? (TIPOS_ACTIVIDAD_MKT.find(t => t.value === row.tipo_actividad)?.label || row.tipo_actividad)
        : null;
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          <div className="flex flex-col gap-0.5">
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-semibold whitespace-nowrap w-fit"
                  style={{ backgroundColor: m.color }}>{m.icono} {m.label}</span>
            {(fuenteTag || tipoActividadLabel) && (
              <div className="flex gap-1 flex-wrap">
                {fuenteTag && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold"
                        style={{ color: fuenteTag.color, backgroundColor: fuenteTag.bg }}>{fuenteTag.label}</span>
                )}
                {tipoActividadLabel && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium text-gray-600 bg-gray-100">{tipoActividadLabel}</span>
                )}
              </div>
            )}
          </div>
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
                 style={{ backgroundColor: c.color }}><Wallet className="w-4 h-4 text-white" /></div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{c.nombre} — Pagos y Compromisos</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {" · "}Promociones · Marketing{clienteKey !== "pcel" && " · Pagos Fijos"} · Variables
                {saving && <span className="ml-2 text-blue-400 animate-pulse">● Guardando...</span>}
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
              {DB_CONFIGURED ? "✅ Sincronizado" : "⚠️ Solo lectura"}
            </span>
          </div>
        </div>
      </div>

      {/* Banner de configuración pendiente */}
      {!DB_CONFIGURED && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <span className="text-2xl">⚙️</span>
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
              <div className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Pagado</p>
                  <p className="text-2xl font-bold text-green-600">{totalPagado > 0 ? formatMXN(totalPagado) : "$0"}</p>
                  <p className="text-xs text-gray-400 mt-1">{registros.filter(r => r.estatus === "pagado").length} conceptos</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Por Pagar</p>
                  <p className="text-2xl font-bold text-yellow-600">{totalPorPagar > 0 ? formatMXN(totalPorPagar) : "$0"}</p>
                  <p className="text-xs text-gray-400 mt-1">{registros.filter(r => ["pendiente","en_proceso"].includes(r.estatus)).length} conceptos</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total {new Date().getFullYear()}</p>
                  <p className="text-2xl font-bold text-gray-800">{totalAnio > 0 ? formatMXN(totalAnio) : "$0"}</p>
                  <p className="text-xs text-gray-400 mt-1">{registros.length} conceptos registrados</p>
                  {/* Desglose por categoría — mini lista horizontal */}
                  {totalAnio > 0 && (
                    <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
                      {Object.entries(CATEGORIA_META)
                        .map(([k, meta]) => ({ k, meta, total: registros.filter(r => r.categoria === k).reduce((s, r) => s + (r.monto || 0), 0) }))
                        .filter(x => x.total > 0)
                        .sort((a, b) => b.total - a.total)
                        .map(({ k, meta, total }) => (
                          <span key={k} className="text-[10px] text-gray-500 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full inline-block mr-1 align-middle" style={{ backgroundColor: meta.color }} />
                            <strong>{meta.label}:</strong> {formatMXN(total)}
                          </span>
                        ))}
                    </div>
                  )}
                </div>
                {(clienteKey === "digitalife" || clienteKey === "dicotech") && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Rebate Acum.</p>
                    <p className="text-2xl font-bold text-red-600">{(() => { const total = Math.round(Object.values(rebateAllQ).reduce((s, v) => s + v, 0)); return total > 0 ? formatMXN(total) : "$0"; })()}</p>
                    <p className="text-xs text-gray-400 mt-1">{Object.values(rebateSynced).filter(Boolean).length} de 4 Qs registrados</p>
                  </div>
                )}
                {clienteKey === "pcel" && (
                  <div className="cursor-pointer hover:bg-violet-50 rounded-lg p-2 -m-2 transition-colors" onClick={() => setMostrarFondo(v => !v)} title="Click para ver ledger del fondo">
                    <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo Fondo MKT</p>
                    <p className="text-2xl font-bold text-violet-600">{formatMXN(fondoResumen.saldoMkt)}</p>
                    <p className="text-xs text-gray-400 mt-1">{new Date().getFullYear()}: +{formatMXN(fondoResumen.aporteMktAnio)} · −{formatMXN(fondoResumen.gastoMktAnio)}</p>
                  </div>
                )}
              </div>
            </div>

          {/* Calendario mensual de pagos 2026 */}
          <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-gray-600" />
                Calendario de Pagos 2026
              </h3>
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
                <div className="flex items-center justify-between mb-3">
                  <button
                    onClick={() => setResumenMensualAbierto(v => !v)}
                    className="flex items-center gap-2 text-left flex-1 hover:opacity-80 transition-opacity"
                    title={resumenMensualAbierto ? "Colapsar" : "Expandir"}
                  >
                    <CardHeader titulo="Resumen General por Mes y Categoría" icon={CalendarDays} />
                    <span className="text-gray-400 text-sm ml-1">{resumenMensualAbierto ? "▾" : "▸"}</span>
                    <span className="text-xs text-gray-400 ml-2">({mb.length} meses)</span>
                  </button>
                  <button
                    onClick={() => {
                      // preselecciona el mes anterior como default útil
                      const hoy = new Date();
                      const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
                      const def = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
                      setExportMeses(mb.some(m => m.mes === def) ? [def] : []);
                      setExportModalOpen(true);
                    }}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold inline-flex items-center gap-1.5"
                    title="Exporta a Excel los pagos por pagar de uno o varios meses"
                  >
                    📥 Exportar Excel
                  </button>
                </div>
                {resumenMensualAbierto && (
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
                )}
                {!resumenMensualAbierto && (
                  <div className="text-xs text-gray-500 italic py-2">
                    Click en el título para ver el desglose mensual · Total anual: <strong className="text-blue-700">{formatMXN(totalAnio)}</strong>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Modal para exportar Excel — selección múltiple de meses */}
          {exportModalOpen && (() => {
            const mbList = monthlyBreakdown();
            const porPagarMes = (mesKey) => registros.filter(r =>
              r.fecha_compromiso && String(r.fecha_compromiso).slice(0, 7) === mesKey
              && ["pendiente","en_proceso","vencido"].includes(r.estatus)
            );
            const toggleMes = (k) => setExportMeses(prev => prev.includes(k) ? prev.filter(x => x !== k) : [...prev, k]);
            const selectedSum = exportMeses.reduce((s, k) => s + porPagarMes(k).reduce((a, r) => a + (Number(r.monto) || 0), 0), 0);
            const selectedCount = exportMeses.reduce((s, k) => s + porPagarMes(k).length, 0);
            // Todos los meses con al menos 1 pago por pagar
            const mesesConPendientes = mbList.filter(m => porPagarMes(m.mes).length > 0);
            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
                  <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                    <h3 className="font-bold text-gray-800">Exportar pagos por pagar</h3>
                    <button onClick={() => setExportModalOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-lg">✕</button>
                  </div>
                  <div className="p-5 space-y-4 overflow-y-auto">
                    <p className="text-xs text-gray-500">
                      Selecciona uno o varios meses. El Excel incluirá los pagos <strong>pendientes / en proceso / vencidos</strong> de
                      todos los meses elegidos, agrupados en una sola hoja con subtotales.
                    </p>
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-semibold text-gray-600 uppercase">Meses</label>
                      <div className="flex gap-2">
                        <button type="button"
                                onClick={() => setExportMeses(mesesConPendientes.map(m => m.mes))}
                                className="text-[11px] text-blue-600 hover:underline">
                          Seleccionar todos
                        </button>
                        <button type="button"
                                onClick={() => setExportMeses([])}
                                className="text-[11px] text-gray-500 hover:underline">
                          Limpiar
                        </button>
                      </div>
                    </div>
                    <div className="border border-gray-200 rounded-lg divide-y divide-gray-100 max-h-64 overflow-y-auto">
                      {mbList.length === 0 && (
                        <div className="px-3 py-6 text-center text-xs text-gray-400 italic">
                          No hay meses con registros de pago
                        </div>
                      )}
                      {mbList.map(m => {
                        const [a, mm] = m.mes.split("-");
                        const cnt = porPagarMes(m.mes).length;
                        const checked = exportMeses.includes(m.mes);
                        const disabled = cnt === 0;
                        return (
                          <label key={m.mes}
                                 className={`flex items-center justify-between px-3 py-2 cursor-pointer transition-colors ${disabled ? "opacity-50 cursor-not-allowed" : checked ? "bg-emerald-50" : "hover:bg-gray-50"}`}
                                 title={disabled ? "Sin pagos por pagar en este mes" : ""}>
                            <div className="flex items-center gap-2">
                              <input type="checkbox"
                                     checked={checked}
                                     disabled={disabled}
                                     onChange={() => !disabled && toggleMes(m.mes)}
                                     className="rounded" />
                              <span className="text-sm text-gray-700">
                                {MESES_LARGOS_ARR[Number(mm) - 1]} {a}
                              </span>
                            </div>
                            <span className={`text-xs ${cnt > 0 ? "text-gray-500" : "text-gray-300"}`}>
                              {cnt} pago{cnt !== 1 ? "s" : ""}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    {exportMeses.length > 0 && (
                      <div className="rounded-lg p-3 text-sm bg-emerald-50 text-emerald-800">
                        {selectedCount > 0
                          ? <>Se exportarán <strong>{selectedCount} pagos</strong> de <strong>{exportMeses.length} mes{exportMeses.length !== 1 ? "es" : ""}</strong> por un total de <strong>{formatMXN(selectedSum)}</strong>.</>
                          : <>Los meses seleccionados no tienen pagos por pagar.</>
                        }
                      </div>
                    )}
                  </div>
                  <div className="flex justify-end gap-2 px-5 py-4 border-t border-gray-100 bg-gray-50">
                    <button onClick={() => setExportModalOpen(false)}
                            className="px-4 py-2 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-sm font-semibold border border-gray-300">
                      Cancelar
                    </button>
                    <button
                      onClick={exportarMeses}
                      disabled={exportMeses.length === 0 || selectedCount === 0}
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-semibold"
                    >
                      📥 Descargar Excel
                    </button>
                  </div>
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
                {Object.entries(CATEGORIA_META)
                  .filter(([key, meta]) => !(clienteKey === "pcel" && key === "pagosFijos"))
                  .filter(([key, meta]) => !meta.soloPara || meta.soloPara.includes(clienteKey))
                  .map(([key, meta]) => (
                  <button key={key} onClick={() => setCatActiva(catActiva === key ? "todas" : key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${catActiva === key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    style={catActiva === key ? { backgroundColor: meta.color } : {}}>
                    <span>{meta.icono}</span>{meta.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                {/* Botón especializado por categoría */}
                {DB_CONFIGURED && canEdit && catActiva === "promociones" && (
                  <NuevaPromocionButton clienteKey={clienteKey} onCreated={() => setPromosVer(v => v + 1)} />
                )}
                {/* Botón genérico (legacy) — solo cuando NO estás en una categoría especializada */}
                {DB_CONFIGURED && canEdit && catActiva !== "promociones" && (
                  <button onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                    + Agregar
                  </button>
                )}
                {!canEdit && (
                  <span className="text-xs text-gray-400 italic flex items-center gap-1">🔒 Modo lectura</span>
                )}
              </div>

              {/* Lista de promociones cuando estás en la categoría */}
              {catActiva === "promociones" && (
                <div className="mb-5">
                  <ListaPromociones clienteKey={clienteKey} refreshKey={promosVer} />
                </div>
              )}

              {/* Add form */}
              {showAdd && DB_CONFIGURED && (
                <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800 mb-3">Nuevo registro</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Categoría *", key: "categoria", type: "select-cat" },
                      { label: "Concepto *",  key: "concepto",  type: "text" },
                      { label: "Monto (MXN)", key: "monto",     type: "number" },
                      { label: "Fuente de pago", key: "fuente", type: "select-fuente" },
                      ...(newRow.categoria === "marketing" ? [{ label: "Tipo de actividad", key: "tipo_actividad", type: "select-tipo-act" }] : []),
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
                        ) : type === "select-fuente" ? (
                          <select value={newRow.fuente} onChange={e => setNewRow(p => ({ ...p, fuente: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                            <option value="">— Sin asignar —</option>
                            {/* Fondo MKT solo aplica para PCEL (Digitalife no tiene fondo) */}
                            {clienteKey === "pcel" && <option value="fondo_mkt">Fondo MKT</option>}
                            <option value="vendor">Vendor (convenio cliente)</option>
                            <option value="empresa">Empresa (Revko)</option>
                          </select>
                        ) : type === "select-tipo-act" ? (
                          <select value={newRow.tipo_actividad || ""} onChange={e => setNewRow(p => ({ ...p, tipo_actividad: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                            <option value="">— Sin tipo —</option>
                            {TIPOS_ACTIVIDAD_MKT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
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
                                  const alreadyExists = existingGroup ? existingGroup.some(r => (r.mes_fijo ? String(r.mes_fijo).padStart(2,"0") : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : null)) === m.key) : false;
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
                      <p className="mb-2"><ClipboardList className="w-8 h-8 text-gray-400 mx-auto" /></p>
                      <p className="text-sm">No hay pagos fijos registrados</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(fijoGroups).map(([conceptoKey, records]) => {
                        const isExp = expandedFijos[conceptoKey];
                        const totalAnual = records.reduce((s, r) => s + (r.monto || 0), 0);
                        const pagadosN  = records.filter(r => r.estatus === "pagado").length;
                        const porPagar  = records.filter(r => r.estatus === "pendiente" && !esMesFuturo(r.fecha_compromiso)).length;
                        const futurosN  = records.filter(r => r.estatus === "pendiente" && esMesFuturo(r.fecha_compromiso)).length;
                        const vencidosN = records.filter(r => r.estatus === "vencido").length;
                        const inactivosN = records.filter(r => r.estatus === "no_aplica" || r.estatus === "cancelado").length;
                        const montoMes = records[0] ? (records[0].monto || 0) : 0;
                        // Ordenar por mes_fijo (independiente de fecha_compromiso);
                        // fallback a fecha_compromiso para registros legacy sin mes_fijo.
                        const mesKeyDeFijo = (r) => r.mes_fijo
                          ? String(r.mes_fijo).padStart(2, "0")
                          : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : "99");
                        const sorted = [...records].sort((a, b) => mesKeyDeFijo(a).localeCompare(mesKeyDeFijo(b)));

                        // Clasificar filas
                        const filasActivas   = sorted.filter(r =>
                          (r.estatus === "pendiente" && !esMesFuturo(r.fecha_compromiso))
                          || r.estatus === "en_proceso"
                          || r.estatus === "vencido"
                        );
                        const filasPagados   = sorted.filter(r => r.estatus === "pagado");
                        const filasFuturos   = sorted.filter(r => r.estatus === "pendiente" && esMesFuturo(r.fecha_compromiso));
                        const filasInactivos = sorted.filter(r => r.estatus === "no_aplica" || r.estatus === "cancelado");
                        const keyP  = `${conceptoKey}::pagados`;
                        const keyF  = `${conceptoKey}::futuros`;
                        const keyI  = `${conceptoKey}::inactivos`;
                        return (
                          <div key={conceptoKey} className="border border-gray-200 rounded-xl overflow-hidden">
                            <div className="flex items-center justify-between px-5 py-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => toggleFijo(conceptoKey)}>
                              <div className="flex items-center gap-3">
                                <span className="text-lg">{isExp ? "▾" : "▸"}</span>
                                <div>
                                  <p className="font-semibold text-gray-800">{conceptoKey}</p>
                                  <p className="text-xs text-gray-500">
                                    {formatMXN(montoMes)}/mes · {records.length} meses ·{" "}
                                    <span className="text-emerald-600 font-semibold">{pagadosN} pagados</span>
                                    {porPagar > 0 && <>{" · "}<span className="text-amber-600 font-semibold">{porPagar} por pagar</span></>}
                                    {vencidosN > 0 && <>{" · "}<span className="text-red-600 font-semibold">{vencidosN} vencidos</span></>}
                                    {futurosN > 0 && <>{" · "}<span className="text-gray-400">{futurosN} futuros</span></>}
                                    {inactivosN > 0 && <>{" · "}<span className="text-gray-400">{inactivosN} no aplica</span></>}
                                  </p>
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
                                      <th className="text-left text-xs text-gray-400 uppercase pb-2 pr-3">Folio</th>
                                      {canEdit && <th className="text-center text-xs text-gray-400 uppercase pb-2 w-10" title="Marca/desmarca como pagado con la fecha de hoy">Pagado</th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {/* Meses faltantes del año en curso (placeholder con botón + Crear) */}
                                    {(() => {
                                      if (!canEdit) return null;
                                      const anioAct = new Date().getFullYear();
                                      const mesKeysExistentes = new Set(sorted.map(r => r.mes_fijo ? String(r.mes_fijo).padStart(2,"0") : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : null)).filter(Boolean));
                                      const faltantes = MESES_ARR.filter(m => !mesKeysExistentes.has(m.key));
                                      if (faltantes.length === 0) return null;
                                      const baseMontoExist = records[0]?.monto || 0;
                                      const baseRespExist = records[0]?.responsable || null;
                                      const crearMes = async (mKey) => {
                                        const record = {
                                          folio: "",
                                          concepto: conceptoKey,
                                          categoria: "pagosFijos",
                                          cliente: clienteKey,
                                          monto: baseMontoExist,
                                          estatus: "pendiente",
                                          fecha_compromiso: `${anioAct}-${mKey}-01`,
                                          fecha_pago_real: null,
                                          responsable: baseRespExist,
                                          notas: null,
                                          mes_fijo: Number(mKey),
                                          anio_fijo: anioAct,
                                        };
                                        const { data, error } = await supabase.from("pagos").insert(record).select().single();
                                        if (error) { flash("Error: " + error.message, "err"); return; }
                                        setRegistros(prev => [...prev, data]);
                                      };
                                      return faltantes.map(m => (
                                        <tr key={`faltante-${m.key}`} className="border-b border-gray-50 bg-gray-50/50">
                                          <td className="py-1.5 pr-3 text-gray-400 italic">{m.full}</td>
                                          <td className="py-1.5 pr-3 text-right text-gray-300 italic">{formatMXN(baseMontoExist)}</td>
                                          <td className="py-1.5 pr-3 text-center">
                                            <span className="text-[10px] text-gray-400 italic">sin registrar</span>
                                          </td>
                                          <td className="py-1.5 pr-3 text-gray-300 italic">—</td>
                                          <td className="py-1.5 pr-3 text-gray-300 italic">—</td>
                                          <td className="py-1.5">
                                            <button onClick={() => crearMes(m.key)}
                                                    className="text-[11px] px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded font-semibold">
                                              + Crear
                                            </button>
                                          </td>
                                          {canEdit && <td></td>}
                                        </tr>
                                      ));
                                    })()}

                                    {/* Activas: lo que sí requiere atención */}
                                    {filasActivas.length === 0 ? (
                                      <tr>
                                        <td colSpan={canEdit ? 7 : 6} className="py-4 text-center text-xs text-emerald-600 italic bg-emerald-50/40">
                                          ✓ No hay pagos pendientes en este concepto
                                        </td>
                                      </tr>
                                    ) : (
                                      filasActivas.map((r) => {
                                        const mk = r.mes_fijo ? String(r.mes_fijo).padStart(2,"0") : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : "??");
                                        const mi = MESES_ARR.find(m => m.key === mk);
                                        return (
                                          <tr key={r.id} className="border-b border-gray-50 hover:bg-amber-50/40">
                                            <td className="py-2 pr-3 font-medium">{mi ? mi.full : mk}</td>
                                            <td className="py-2 pr-3 text-right">{renderCell(r, "monto", "number")}</td>
                                            <td className="py-2 pr-3 text-center">{renderCell(r, "estatus", "sel-estatus")}</td>
                                            <td className="py-2 pr-3">{renderCell(r, "fecha_compromiso", "date")}</td>
                                            <td className="py-2 pr-3">{renderCell(r, "fecha_pago_real", "date")}</td>
                                            <td className="py-2">{renderCell(r, "folio")}</td>
                                            {canEdit && (
                                              <td className="py-2 text-center">
                                                <input type="checkbox"
                                                  checked={r.estatus === "pagado"}
                                                  onChange={() => togglePagado(r)}
                                                  className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                                  title="Marcar como pagado con la fecha de hoy" />
                                              </td>
                                            )}
                                          </tr>
                                        );
                                      })
                                    )}

                                    {/* ═══ PAGADOS (carpeta desplegable) ═══ */}
                                    {filasPagados.length > 0 && (
                                      <>
                                        <tr className="bg-emerald-50/40 hover:bg-emerald-50/70 cursor-pointer"
                                            onClick={() => toggleFijo(keyP)}>
                                          <td colSpan={canEdit ? 7 : 6} className="py-2 px-2 text-xs font-semibold text-emerald-700">
                                            {expandedFijos[keyP] ? "▾" : "▸"} ✓ {filasPagados.length} pago{filasPagados.length !== 1 ? "s" : ""} completado{filasPagados.length !== 1 ? "s" : ""}
                                            <span className="ml-2 text-emerald-600 font-normal">
                                              ({formatMXN(filasPagados.reduce((s, r) => s + (r.monto || 0), 0))})
                                            </span>
                                          </td>
                                        </tr>
                                        {expandedFijos[keyP] && filasPagados.map((r) => {
                                          const mk = r.mes_fijo ? String(r.mes_fijo).padStart(2,"0") : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : "??");
                                          const mi = MESES_ARR.find(m => m.key === mk);
                                          return (
                                            <tr key={r.id} className="border-b border-gray-50 bg-emerald-50/20 text-gray-500">
                                              <td className="py-2 pr-3 pl-6 font-medium">{mi ? mi.full : mk}</td>
                                              <td className="py-2 pr-3 text-right">{renderCell(r, "monto", "number")}</td>
                                              <td className="py-2 pr-3 text-center">{renderCell(r, "estatus", "sel-estatus")}</td>
                                              <td className="py-2 pr-3">{renderCell(r, "fecha_compromiso", "date")}</td>
                                              <td className="py-2 pr-3">{renderCell(r, "fecha_pago_real", "date")}</td>
                                              <td className="py-2">{renderCell(r, "folio")}</td>
                                              {canEdit && (
                                                <td className="py-2 text-center">
                                                  <input type="checkbox" checked
                                                    onChange={() => togglePagado(r)}
                                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 cursor-pointer"
                                                    title={`Pagado el ${r.fecha_pago_real || "—"}. Click para desmarcar.`} />
                                                </td>
                                              )}
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}

                                    {/* ═══ FUTUROS (carpeta desplegable) ═══ */}
                                    {filasFuturos.length > 0 && (
                                      <>
                                        <tr className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => toggleFijo(keyF)}>
                                          <td colSpan={canEdit ? 7 : 6} className="py-2 px-2 text-xs font-semibold text-gray-600">
                                            {expandedFijos[keyF] ? "▾" : "▸"} ⏭ {filasFuturos.length} mes{filasFuturos.length !== 1 ? "es" : ""} futuro{filasFuturos.length !== 1 ? "s" : ""} (programados)
                                          </td>
                                        </tr>
                                        {expandedFijos[keyF] && filasFuturos.map((r) => {
                                          const mk = r.mes_fijo ? String(r.mes_fijo).padStart(2,"0") : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : "??");
                                          const mi = MESES_ARR.find(m => m.key === mk);
                                          return (
                                            <tr key={r.id} className="border-b border-gray-50 bg-gray-50/40 text-gray-400">
                                              <td className="py-2 pr-3 pl-6 font-medium">{mi ? mi.full : mk}</td>
                                              <td className="py-2 pr-3 text-right">{renderCell(r, "monto", "number")}</td>
                                              <td className="py-2 pr-3 text-center">
                                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] bg-gray-100 text-gray-500 font-medium">Programado</span>
                                              </td>
                                              <td className="py-2 pr-3">{renderCell(r, "fecha_compromiso", "date")}</td>
                                              <td className="py-2 pr-3">{renderCell(r, "fecha_pago_real", "date")}</td>
                                              <td className="py-2">{renderCell(r, "folio")}</td>
                                              {canEdit && <td></td>}
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}

                                    {/* ═══ NO APLICA / CANCELADOS (carpeta desplegable) ═══ */}
                                    {filasInactivos.length > 0 && (
                                      <>
                                        <tr className="bg-gray-50 hover:bg-gray-100 cursor-pointer"
                                            onClick={() => toggleFijo(keyI)}>
                                          <td colSpan={canEdit ? 7 : 6} className="py-2 px-2 text-xs font-semibold text-gray-500">
                                            {expandedFijos[keyI] ? "▾" : "▸"} ➖ {filasInactivos.length} no aplica{filasInactivos.length !== 1 ? "n" : ""} / cancelado{filasInactivos.length !== 1 ? "s" : ""}
                                          </td>
                                        </tr>
                                        {expandedFijos[keyI] && filasInactivos.map((r) => {
                                          const mk = r.mes_fijo ? String(r.mes_fijo).padStart(2,"0") : (r.fecha_compromiso ? r.fecha_compromiso.slice(5, 7) : "??");
                                          const mi = MESES_ARR.find(m => m.key === mk);
                                          return (
                                            <tr key={r.id} className="border-b border-gray-50 bg-gray-50/40 text-gray-400">
                                              <td className="py-2 pr-3 pl-6 font-medium line-through">{mi ? mi.full : mk}</td>
                                              <td className="py-2 pr-3 text-right">{renderCell(r, "monto", "number")}</td>
                                              <td className="py-2 pr-3 text-center">{renderCell(r, "estatus", "sel-estatus")}</td>
                                              <td className="py-2 pr-3">{renderCell(r, "fecha_compromiso", "date")}</td>
                                              <td className="py-2 pr-3">{renderCell(r, "fecha_pago_real", "date")}</td>
                                              <td className="py-2">{renderCell(r, "folio")}</td>
                                              {canEdit && <td></td>}
                                            </tr>
                                          );
                                        })}
                                      </>
                                    )}
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
                      {canEdit && <th className="text-center text-xs text-gray-400 uppercase tracking-wide pb-3 w-10" title="Marca/desmarca como pagado con la fecha de hoy">Pagado</th>}
                      {DB_CONFIGURED && <th className="pb-3 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => {
                      const esMktConsolidado = row.categoria === "marketing";
                      const expanded = expandedPagoId === row.id;
                      const acts = actividadesPorPago[row.id] || [];
                      return (
                      <React.Fragment key={row.id}>
                      <tr className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                        <td className="py-2.5 pr-3 min-w-36">
                          {esMktConsolidado && (
                            <button
                              onClick={() => togglePagoExpand(row.id)}
                              className="inline-flex items-center justify-center w-5 h-5 mr-1.5 rounded hover:bg-blue-100 text-gray-400 hover:text-blue-600 align-middle"
                              title={expanded ? "Ocultar actividades" : "Ver actividades"}
                            >
                              <span className="text-xs">{expanded ? "▼" : "▶"}</span>
                            </button>
                          )}
                          {renderCell(row, "concepto")}
                        </td>
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
                        {canEdit && (
                          <td className="py-2.5 text-center">
                            <input
                              type="checkbox"
                              checked={row.estatus === "pagado"}
                              onChange={() => togglePagado(row)}
                              className="w-4 h-4 rounded border-gray-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                              title={row.estatus === "pagado"
                                ? `Pagado el ${row.fecha_pago_real || "—"}. Click para desmarcar.`
                                : "Marcar como pagado con la fecha de hoy"}
                            />
                          </td>
                        )}
                        {DB_CONFIGURED && (
                          <td className="py-2.5 pl-1">
                            <div className="flex items-center gap-0.5">
                              <button onClick={() => verHistorial(row)}
                                className="text-gray-300 hover:text-indigo-600 transition-colors text-xs p-1" title="Ver bitácora de cambios">📜</button>
                              {canEdit && (
                                <button onClick={() => handleDuplicate(row)}
                                  className="text-gray-300 hover:text-blue-600 transition-colors text-xs p-1" title="Duplicar al siguiente mes">⎘</button>
                              )}
                              <button onClick={() => handleDelete(row.id)}
                                className="text-gray-300 hover:text-red-500 transition-colors text-sm p-1" title="Eliminar registro">🗑</button>
                            </div>
                          </td>
                        )}
                      </tr>

                      {/* Fila expandida con desglose de actividades de marketing */}
                      {esMktConsolidado && expanded && (
                        <tr className="bg-blue-50/40 border-b border-gray-100">
                          <td colSpan={11} className="py-3 px-6">
                            <div className="text-xs font-semibold text-gray-700 mb-2">
                              📋 Actividades incluidas en este pago ({acts.length})
                              {acts.length === 0 && <span className="text-gray-400 font-normal ml-2">— sin actividades</span>}
                            </div>
                            {acts.length > 0 && (
                              <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                                <table className="w-full text-xs">
                                  <thead className="bg-gray-50 text-gray-500 uppercase">
                                    <tr>
                                      <th className="text-left px-3 py-1.5">Actividad</th>
                                      <th className="text-left px-3 py-1.5">Tipo</th>
                                      <th className="text-left px-3 py-1.5">Fecha</th>
                                      <th className="text-left px-3 py-1.5">Responsable</th>
                                      <th className="text-right px-3 py-1.5">Inversión</th>
                                      {canEdit && <th className="text-center px-2 py-1.5 w-10"></th>}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {acts.map(a => (
                                      <tr key={a.id} className="border-t border-gray-100">
                                        <td className="px-3 py-2">{a.nombre || "—"}</td>
                                        <td className="px-3 py-2 text-gray-600">{a.tipo || "—"}</td>
                                        <td className="px-3 py-2 text-gray-600">{a.fecha || "—"}</td>
                                        <td className="px-3 py-2 text-gray-600">{a.responsable || "—"}</td>
                                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{formatMXN(a.inversion || 0)}</td>
                                        {canEdit && (
                                          <td className="px-2 py-2 text-center">
                                            <button
                                              onClick={() => excluirActividadDePago(row.id, a.id)}
                                              className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50"
                                              title="Excluir esta actividad del pago (volverá a Marketing)"
                                            >
                                              ⊘
                                            </button>
                                          </td>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                  <tfoot className="bg-gray-50">
                                    <tr>
                                      <td colSpan={4} className="px-3 py-1.5 text-right font-semibold text-gray-600">Total:</td>
                                      <td className="px-3 py-1.5 text-right tabular-nums font-bold">
                                        {formatMXN(acts.reduce((a, x) => a + (Number(x.inversion) || 0), 0))}
                                      </td>
                                      {canEdit && <td></td>}
                                    </tr>
                                  </tfoot>
                                </table>
                              </div>
                            )}
                            <div className="text-[11px] text-gray-500 mt-2 italic">
                              Excluir una actividad la deja como "pendiente" en Marketing y resta su inversión del pago.
                              Si excluyes la última, el pago se elimina y el botón "Cerrar mes" reaparece.
                            </div>
                          </td>
                        </tr>
                      )}
                      </React.Fragment>
                      );
                    })}
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
                  {DB_CONFIGURED ? "✅ Cambios guardados y sincronizados para todo el equipo." : "⚠️ Modo lectura — configura Supabase para habilitar la edición."}
                  {" "}💡 <strong className="text-gray-600">Pendiente</strong> · <strong className="text-gray-600">En Proceso</strong> · <strong className="text-gray-600">Pagado</strong> · <strong className="text-gray-600">Vencido</strong>
                </p>
              </div>
            </div>
          )}

          {/* Historial de pagos completados (colapsable, agrupado por mes) */}
          <HistorialPagadosPorMes
            pagados={pagadosDeCategoria}
            catActiva={catActiva}
            CATEGORIA_META={CATEGORIA_META}
            canEdit={canEdit}
            onTogglePagado={togglePagado}
          />

          {/* Lineamientos editables (Fondo MKT, Rebate, SPIFF) */}
          {(catActiva === "rebate" || catActiva === "spiff" || catActiva === "marketing" || catActiva === "todas") && (
            <div className="mb-6">
              <LineamientosCliente
                clienteKey={clienteKey}
                tipos={
                  catActiva === "rebate" ? ["rebate"]
                  : catActiva === "spiff" ? ["spiff"]
                  : catActiva === "marketing" ? ["fondo_mkt"]
                  : ["fondo_mkt", "rebate", "spiff"]
                }
              />
            </div>
          )}

          {/* Calculadora de Rebate Trimestral */}
          {clienteKey === "digitalife" && catActiva === "rebate" && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-gray-700" />
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
                      if (rebateSynced[rebateQ]) return (
                        <div className="flex items-center gap-2 ml-2">
                          <span className="text-xs text-green-600 font-semibold">✓ Pago Q{rebateQ} registrado</span>
                          {canEdit && (
                            <>
                              <button onClick={actualizarRebatePago}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold rounded-lg"
                                title="Recalcular con Sell In actualizado y actualizar el monto del pago registrado">
                                🔄 Actualizar
                              </button>
                              <button onClick={borrarRebatePago}
                                className="px-3 py-1 bg-white hover:bg-red-50 text-red-600 border border-red-300 text-xs font-semibold rounded-lg"
                                title="Eliminar el pago registrado (podrás registrarlo de nuevo después)">
                                🗑️ Borrar
                              </button>
                            </>
                          )}
                        </div>
                      );
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
                          cliente: clienteKey
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
                                ><Wallet className="w-3.5 h-3.5 inline mr-1" />Generar pago</button>
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

          {/* ═══ Calculadora SPIFF DUAL Dicotech (Sell-In tiered + Sell-Out flat) ═══ */}
          {clienteKey === "dicotech" && catActiva === "spiff" && spiffDicotechCalc && (
            <div className="space-y-6 mb-6">
              {/* Header con totales YTD */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xl">🚀</span>
                      <h3 className="text-lg font-bold text-gray-800">SPIFF Dicotech {new Date().getFullYear()}</h3>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Calculadora dual: SPIFF Sell-In con tiers de cumplimiento + SPIFF Sell-Out flat. Cuota SO = Cuota Sell-In × factor (varía por mes: revisa Lineamientos para el detalle).
                    </p>
                  </div>
                  <div className="flex gap-6">
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase">SPIFF SI YTD</p>
                      <p className="text-xl font-bold text-indigo-600">{formatMXN(spiffDicotechTotalYTD.si)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] text-gray-400 uppercase">SPIFF SO YTD</p>
                      <p className="text-xl font-bold text-emerald-600">{formatMXN(spiffDicotechTotalYTD.so)}</p>
                    </div>
                    <div className="text-right border-l border-gray-200 pl-6">
                      <p className="text-[10px] text-gray-400 uppercase">Total YTD</p>
                      <p className="text-2xl font-bold text-purple-700">{formatMXN(spiffDicotechTotalYTD.total)}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* SPIFF Sell-In */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h4 className="font-bold text-indigo-700 inline-flex items-center gap-2">📥 SPIFF Sell-In (tiers de cumplimiento)</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    {(lineamientos?.spiff?.sell_in?.tiers || []).slice().sort((a,b)=>(b.min_alcance||0)-(a.min_alcance||0)).map((t,i) => (
                      <span key={i} className="px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-700">
                        <strong>{t.label || ((t.min_alcance*100).toFixed(0)+"%+")}</strong> · {((t.pct||0)*100).toFixed(2)}%
                      </span>
                    ))}
                    <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-400">&lt;95% → Sin SPIFF</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Mes</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Cuota SI</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Sell-In Real</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Alcance</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Tier</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Comisión</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spiffDicotechCalc.map(c => {
                        const MESES_F = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                        const p = c.pagoSI;
                        const isNoAplica = p && p.estatus === "cancelado";
                        const isGenerado = p && p.estatus !== "cancelado";
                        const alcancePct = (c.alcanceSI * 100).toFixed(0);
                        let alcanceColor = "#94a3b8";
                        if (c.alcanceSI >= 1.31) alcanceColor = "#10b981";
                        else if (c.alcanceSI >= 1.15) alcanceColor = "#3b82f6";
                        else if (c.alcanceSI >= 0.95) alcanceColor = "#6366f1";
                        else if (c.siActual > 0) alcanceColor = "#ef4444";
                        return (
                          <tr key={`si-${c.mes}`} className={`border-b border-gray-100 ${isNoAplica ? "opacity-50" : ""}`}>
                            <td className="py-2 px-3 font-medium text-gray-800">{MESES_F[c.mes - 1]}</td>
                            <td className="py-2 px-3 text-right text-gray-500 text-xs">{formatMXN(c.cuotaSI)}</td>
                            <td className="py-2 px-3 text-right text-gray-700 font-medium">{c.siActual > 0 ? formatMXN(c.siActual) : "—"}</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: alcanceColor }}>{c.siActual > 0 ? alcancePct + "%" : "—"}</td>
                            <td className="py-2 px-3 text-center">{c.tierSI ? <span className="text-xs px-2 py-0.5 rounded bg-indigo-100 text-indigo-700 font-semibold">{c.tierSI.label}</span> : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2 px-3 text-right font-bold text-indigo-700">{isNoAplica ? <span className="text-gray-400">—</span> : c.comisionSI > 0 ? formatMXN(c.comisionSI) : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2 px-3 text-center">
                              {isNoAplica ? (
                                <button onClick={() => revertirSpiff(p.id)} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1">↺ Revertir</button>
                              ) : isGenerado ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <span className={`text-xs px-2 py-1 rounded ${p.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.estatus === "pagado" ? "✓ Pagado" : "⏳ Pendiente"}</span>
                                  <button onClick={() => revertirSpiff(p.id)} className="text-xs text-red-500 hover:text-red-700">🗑</button>
                                </div>
                              ) : c.tierSI && c.comisionSI > 0 ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <button onClick={() => crearSpiffDicotechPago(c, "SI", false)} className="text-xs bg-indigo-600 text-white rounded px-2 py-1 hover:bg-indigo-700">Generar</button>
                                  <button onClick={() => marcarSpiffDicotechNoAplica(c.mes, "SI")} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200">No aplica</button>
                                </div>
                              ) : c.siActual > 0 ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <button onClick={() => crearSpiffDicotechPago(c, "SI", true)} className="text-xs bg-amber-500 text-white rounded px-2 py-1 hover:bg-amber-600" title="Pagar aunque no llegue a cuota mínima">💸 Pagar manual</button>
                                  <button onClick={() => marcarSpiffDicotechNoAplica(c.mes, "SI")} className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-1 hover:bg-gray-200">No aplica</button>
                                </div>
                              ) : <span className="text-xs text-gray-300">Sin datos</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* SPIFF Sell-Out */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h4 className="font-bold text-emerald-700 inline-flex items-center gap-2">📤 SPIFF Sell-Out (flat {((lineamientos?.spiff?.sell_out?.pct_fijo || 0)*100).toFixed(2)}%)</h4>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-100 text-emerald-700">
                      <strong>≥{((lineamientos?.spiff?.sell_out?.min_alcance || 0.95)*100).toFixed(0)}%</strong> alcance → {((lineamientos?.spiff?.sell_out?.pct_fijo || 0)*100).toFixed(2)}%
                    </span>
                    <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-400">&lt;{((lineamientos?.spiff?.sell_out?.min_alcance || 0.95)*100).toFixed(0)}% → Sin SPIFF</span>
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-left py-2 px-3 font-semibold text-gray-600">Mes</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Cuota SO</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Sell-Out Real</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Alcance</th>
                        <th className="text-right py-2 px-3 font-semibold text-gray-600">Comisión</th>
                        <th className="text-center py-2 px-3 font-semibold text-gray-600">Acción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {spiffDicotechCalc.map(c => {
                        const MESES_F = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                        const p = c.pagoSO;
                        const isNoAplica = p && p.estatus === "cancelado";
                        const isGenerado = p && p.estatus !== "cancelado";
                        const alcancePct = (c.alcanceSO * 100).toFixed(0);
                        let alcanceColor = "#94a3b8";
                        if (c.alcanceSO >= 1.20) alcanceColor = "#10b981";
                        else if (c.alcanceSO >= 0.95) alcanceColor = "#059669";
                        else if (c.soActual > 0) alcanceColor = "#ef4444";
                        return (
                          <tr key={`so-${c.mes}`} className={`border-b border-gray-100 ${isNoAplica ? "opacity-50" : ""}`}>
                            <td className="py-2 px-3 font-medium text-gray-800">{MESES_F[c.mes - 1]}</td>
                            <td className="py-2 px-3 text-right text-gray-500 text-xs">{formatMXN(c.cuotaSO)}</td>
                            <td className="py-2 px-3 text-right text-gray-700 font-medium">{c.soActual > 0 ? formatMXN(c.soActual) : "—"}</td>
                            <td className="py-2 px-3 text-right font-bold" style={{ color: alcanceColor }}>{c.soActual > 0 ? alcancePct + "%" : "—"}</td>
                            <td className="py-2 px-3 text-right font-bold text-emerald-700">{isNoAplica ? <span className="text-gray-400">—</span> : c.comisionSO > 0 ? formatMXN(c.comisionSO) : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2 px-3 text-center">
                              {isNoAplica ? (
                                <button onClick={() => revertirSpiff(p.id)} className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1">↺ Revertir</button>
                              ) : isGenerado ? (
                                <div className="flex items-center gap-1 justify-center">
                                  <span className={`text-xs px-2 py-1 rounded ${p.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>{p.estatus === "pagado" ? "✓ Pagado" : "⏳ Pendiente"}</span>
                                  <button onClick={() => revertirSpiff(p.id)} className="text-xs text-red-500 hover:text-red-700">🗑</button>
                                </div>
                              ) : c.aplicaSO && c.comisionSO > 0 ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <button onClick={() => crearSpiffDicotechPago(c, "SO", false)} className="text-xs bg-emerald-600 text-white rounded px-2 py-1 hover:bg-emerald-700">Generar</button>
                                  <button onClick={() => marcarSpiffDicotechNoAplica(c.mes, "SO")} className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200">No aplica</button>
                                </div>
                              ) : c.soActual > 0 ? (
                                <div className="flex gap-1 justify-center flex-wrap">
                                  <button onClick={() => crearSpiffDicotechPago(c, "SO", true)} className="text-xs bg-amber-500 text-white rounded px-2 py-1 hover:bg-amber-600" title="Pagar aunque no llegue a cuota mínima">💸 Pagar manual</button>
                                  <button onClick={() => marcarSpiffDicotechNoAplica(c.mes, "SO")} className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-1 hover:bg-gray-200">No aplica</button>
                                </div>
                              ) : <span className="text-xs text-gray-300">Sin datos</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  💡 <strong>Pagar manual:</strong> el botón ámbar aparece cuando hay datos pero no se llegó a la cuota mínima. Te permite pagar de todos modos con el monto que decidas.
                </div>
              </div>
            </div>
          )}

          {/* ═══ Fondo MKT Trimestral Interno Dicotech ═══ */}
          {clienteKey === "dicotech" && catActiva === "fondoMkt" && dicoFondoTablaMensual && (
            <div className="space-y-6 mb-6">
              {/* Header con saldos actuales */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">💰</span>
                    <h3 className="text-lg font-bold text-gray-800">Fondos MKT Dicotech {new Date().getFullYear()}</h3>
                  </div>
                  <div className="text-xs text-gray-500">
                    Plan MKT contratado: <strong>{formatMXN(dicoFondoTablaMensual.planMonto)}/mes</strong>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-emerald-700 font-semibold">Fondo MKT Cliente</span>
                      <span className="text-[10px] text-emerald-600">visible al cliente</span>
                    </div>
                    <p className={`text-2xl font-bold mt-1 ${dicoFondoTablaMensual.saldoCliActual < 0 ? "text-red-600" : "text-emerald-900"}`}>{formatMXN(dicoFondoTablaMensual.saldoCliActual)}</p>
                    <p className="text-[10px] text-emerald-700 mt-0.5">Saldo final del año (con generaciones y aplicaciones)</p>
                  </div>
                  <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] uppercase tracking-wide text-purple-700 font-semibold">Fondo Interno (Acteck)</span>
                      <span className="text-[10px] text-purple-600">🔒 interno</span>
                    </div>
                    <p className={`text-2xl font-bold mt-1 ${dicoFondoTablaMensual.saldoIntActual < 0 ? "text-red-600" : "text-purple-900"}`}>{formatMXN(dicoFondoTablaMensual.saldoIntActual)}</p>
                    <p className="text-[10px] text-purple-700 mt-0.5">1% del sell-in mensual SIEMPRE · no visible al cliente</p>
                  </div>
                </div>
                <div className="mt-3 text-xs text-gray-500">
                  💡 Reglas: <strong>Fondo Interno</strong> = 1% × sell-in mes (siempre). <strong>Fondo MKT Cliente</strong> = tier % según alcance Q acumulado (0.75% si Q&lt;90%, 0.75/1.00/1.25% según tier). El plan MKT mensual se descuenta del fondo cliente primero, del interno si no alcanza.
                </div>
              </div>

              {/* Tabla mensual estilo Excel del cliente */}
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b-2 border-gray-200 bg-emerald-50">
                        <th rowSpan={2} className="text-left py-2 px-2 font-semibold text-gray-700 align-bottom">Mes</th>
                        <th colSpan={4} className="text-center py-1 px-2 font-bold text-emerald-700 border-b border-emerald-200">FONDO MKT CLIENTE</th>
                        <th colSpan={4} className="text-center py-1 px-2 font-bold text-purple-700 border-b border-purple-200 border-l-2 border-l-gray-300">FONDO INTERNO</th>
                        <th rowSpan={2} className="text-center py-2 px-2 font-semibold text-gray-700 align-bottom border-l-2 border-l-gray-300">Aplicar pago</th>
                      </tr>
                      <tr className="border-b border-gray-200 bg-gray-50">
                        <th className="text-right py-2 px-2 font-semibold text-emerald-700">Saldo inicio</th>
                        <th className="text-right py-2 px-2 font-semibold text-emerald-700">Generación</th>
                        <th className="text-right py-2 px-2 font-semibold text-emerald-700">Aplicación</th>
                        <th className="text-right py-2 px-2 font-semibold text-emerald-700 border-r-2 border-r-gray-300">Saldo final</th>
                        <th className="text-right py-2 px-2 font-semibold text-purple-700">Saldo inicio</th>
                        <th className="text-right py-2 px-2 font-semibold text-purple-700">Generación</th>
                        <th className="text-right py-2 px-2 font-semibold text-purple-700">Aplicación</th>
                        <th className="text-right py-2 px-2 font-semibold text-purple-700 border-r-2 border-r-gray-300">Saldo final</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dicoFondoTablaMensual.filas.map(f => {
                        const MESES_F = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
                        const yaPagado = f.aplicaciones.length > 0;
                        const mesActual = new Date().getMonth() + 1;
                        const esFuturo = f.mes > mesActual;
                        const fmtSaldo = (n) => {
                          const s = formatMXN(n);
                          return n < 0 ? <span className="text-red-600">-{s.replace("$-","$")}</span> : s;
                        };
                        return (
                          <tr key={f.mes} className={`border-b border-gray-100 ${esFuturo ? "opacity-40" : ""}`}>
                            <td className="py-2 px-2 font-medium text-gray-800">{MESES_F[f.mes-1]}</td>
                            {/* Fondo MKT Cliente */}
                            <td className="py-2 px-2 text-right text-gray-500">{fmtSaldo(f.saldoCliInicio)}</td>
                            <td className="py-2 px-2 text-right text-emerald-700 font-semibold">{f.genCli > 0 ? formatMXN(f.genCli) : "—"}</td>
                            <td className="py-2 px-2 text-right text-red-600">{f.apliCli > 0 ? "-" + formatMXN(f.apliCli) : "—"}</td>
                            <td className={`py-2 px-2 text-right font-bold border-r-2 border-r-gray-300 ${f.saldoCliFinal < 0 ? "text-red-600" : "text-gray-800"}`}>{fmtSaldo(f.saldoCliFinal)}</td>
                            {/* Fondo Interno */}
                            <td className="py-2 px-2 text-right text-gray-500">{fmtSaldo(f.saldoIntInicio)}</td>
                            <td className="py-2 px-2 text-right text-purple-700 font-semibold">{f.genInt > 0 ? formatMXN(f.genInt) : "—"}</td>
                            <td className="py-2 px-2 text-right text-red-600">{f.apliInt > 0 ? "-" + formatMXN(f.apliInt) : "—"}</td>
                            <td className={`py-2 px-2 text-right font-bold border-r-2 border-r-gray-300 ${f.saldoIntFinal < 0 ? "text-red-600" : "text-gray-800"}`}>{fmtSaldo(f.saldoIntFinal)}</td>
                            {/* Acción */}
                            <td className="py-2 px-2 text-center">
                              {esFuturo ? (
                                <span className="text-[10px] text-gray-300">Futuro</span>
                              ) : yaPagado ? (
                                <div className="flex flex-col items-center gap-0.5">
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-green-100 text-green-700">✓ Aplicado</span>
                                  {f.aplicaciones.map(a => (
                                    <button key={a.id} onClick={() => revertirMovimientoFondo(a.id)}
                                            className="text-[10px] text-red-500 hover:text-red-700"
                                            title={`Revertir ${a.tipo_fondo}: ${formatMXN(Number(a.monto))}`}>🗑 {a.tipo_fondo === "interno" ? "I" : "C"}</button>
                                  ))}
                                </div>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <button onClick={() => aplicarPagoFondoDicotech(f.mes, dicoFondoTablaMensual.planMonto, "auto", `Plan MKT ${MESES_F[f.mes-1]}`)}
                                          className="text-[10px] bg-emerald-600 text-white rounded px-2 py-1 hover:bg-emerald-700"
                                          title="Toma del fondo cliente primero, del interno si no alcanza">
                                    Auto split
                                  </button>
                                  <button onClick={() => aplicarPagoFondoDicotech(f.mes, dicoFondoTablaMensual.planMonto, "interno", `Plan MKT ${MESES_F[f.mes-1]} (manual interno)`)}
                                          className="text-[10px] bg-purple-600 text-white rounded px-2 py-1 hover:bg-purple-700"
                                          title="Tomar todo del fondo interno">
                                    Solo Interno
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                  💡 <strong>Auto split:</strong> usa el Fondo MKT Cliente primero y completa con el Fondo Interno si no alcanza. <strong>Solo Interno:</strong> descuenta todo del fondo interno (saldo puede ir negativo). El monto del plan MKT mensual se edita desde el panel de Lineamientos → fondo_mkt → plan_mkt_contratado.monto_mensual.
                </div>
              </div>
            </div>
          )}

          {/* ═══ Rebate Trimestral Dicotech (Fondo para Generación Sell Out) ═══ */}
          {clienteKey === "dicotech" && catActiva === "rebate" && dicoRebateCalc && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🎁</span>
                    <h3 className="text-lg font-bold text-gray-800">Rebate Dicotech {new Date().getFullYear()}</h3>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {lineamientos?.rebate?.nombre_oficial || "Fondo para Generación Sell Out"} · Trimestral · {((lineamientos?.rebate?.tiers?.[0]?.pct || 0.02)*100).toFixed(2)}% sobre Sell-In del Q si alcance ≥ {((lineamientos?.rebate?.alcance_minimo_pago || 0.90)*100).toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-gray-400 uppercase">Acumulado YTD</p>
                  <p className="text-2xl font-bold text-red-600">{formatMXN(dicoRebateTotalYTD)}</p>
                </div>
              </div>

              {/* Tiers info */}
              <div className="flex flex-wrap gap-2 mb-4 text-xs">
                {(lineamientos?.rebate?.tiers || []).slice().sort((a,b) => Number(b.min_alcance) - Number(a.min_alcance)).map((t, i) => (
                  <span key={i} className="px-3 py-1 rounded-full bg-red-50 border border-red-100 text-red-700">
                    <strong>{t.label}</strong> · {(Number(t.pct)*100).toFixed(2)}%
                  </span>
                ))}
                <span className="px-3 py-1 rounded-full bg-gray-50 border border-gray-200 text-gray-400">
                  &lt; 90% → Sin rebate auto
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50">
                      <th className="text-left py-2 px-3 font-semibold text-gray-600">Trimestre</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Cuota Q</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Sell-In Q</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Alcance</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-600">Tier</th>
                      <th className="text-right py-2 px-3 font-semibold text-gray-600">Rebate</th>
                      <th className="text-center py-2 px-3 font-semibold text-gray-600">Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dicoRebateCalc.map(q => {
                      const p = q.pagoExistente;
                      const isNoAplica = p && p.estatus === "cancelado";
                      const isGenerado = p && p.estatus !== "cancelado";
                      const alcancePct = (q.alcance * 100).toFixed(0);
                      let alcanceColor = "#94a3b8";
                      if (q.alcance >= 1.30) alcanceColor = "#10b981";
                      else if (q.alcance >= 1.15) alcanceColor = "#3b82f6";
                      else if (q.alcance >= 0.90) alcanceColor = "#dc2626";
                      else if (q.sellInQ > 0) alcanceColor = "#ef4444";
                      return (
                        <tr key={q.q} className={`border-b border-gray-100 ${isNoAplica ? "opacity-50" : ""}`}>
                          <td className="py-2 px-3 font-medium text-gray-800">{q.label}</td>
                          <td className="py-2 px-3 text-right text-gray-500 text-xs">{formatMXN(q.cuotaQ)}</td>
                          <td className="py-2 px-3 text-right text-gray-700 font-medium">{q.sellInQ > 0 ? formatMXN(q.sellInQ) : "—"}</td>
                          <td className="py-2 px-3 text-right font-bold" style={{ color: alcanceColor }}>{q.sellInQ > 0 ? alcancePct + "%" : "—"}</td>
                          <td className="py-2 px-3 text-center text-xs">
                            {q.tier ? <span className="px-2 py-0.5 rounded bg-red-100 text-red-700 font-semibold">{q.tier.label}</span> : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-3 text-right font-bold text-red-700">
                            {isNoAplica ? <span className="text-gray-400">—</span> : q.rebateAuto > 0 ? formatMXN(q.rebateAuto) : <span className="text-gray-300">—</span>}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {isNoAplica ? (
                              <button onClick={() => revertirSpiff(p.id)}
                                      className="text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded px-2 py-1">↺ Revertir</button>
                            ) : isGenerado ? (
                              <div className="flex items-center gap-1 justify-center">
                                <span className={`text-xs px-2 py-1 rounded ${p.estatus === "pagado" ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"}`}>
                                  {p.estatus === "pagado" ? "✓ Pagado" : "⏳ Pendiente"}
                                </span>
                                <button onClick={() => revertirSpiff(p.id)}
                                        className="text-xs text-red-500 hover:text-red-700"
                                        title="Eliminar pago">🗑</button>
                              </div>
                            ) : q.cumple && q.rebateAuto > 0 ? (
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button onClick={() => generarRebateDicotech(q, false)}
                                        className="text-xs bg-red-600 text-white rounded px-2 py-1 hover:bg-red-700">
                                  Generar
                                </button>
                                <button onClick={() => marcarRebateDicotechNoAplica(q)}
                                        className="text-xs bg-gray-100 text-gray-600 rounded px-2 py-1 hover:bg-gray-200">No aplica</button>
                              </div>
                            ) : q.sellInQ > 0 ? (
                              <div className="flex gap-1 justify-center flex-wrap">
                                <button onClick={() => generarRebateDicotech(q, true)}
                                        className="text-xs bg-amber-500 text-white rounded px-2 py-1 hover:bg-amber-600"
                                        title="Pagar aunque no llegue a 90%">
                                  💸 Pagar manual
                                </button>
                                <button onClick={() => marcarRebateDicotechNoAplica(q)}
                                        className="text-xs bg-gray-100 text-gray-500 rounded px-2 py-1 hover:bg-gray-200">No aplica</button>
                              </div>
                            ) : <span className="text-xs text-gray-300">Sin datos</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                💡 <strong>Fecha de pago automática:</strong> día 15 del mes posterior al cierre del Q (ej. Q1 → 15 Abril) · El rebate es 2% para todos los tiers ≥ 90% — los tiers se conservan para mostrar el alcance real del Q.
              </div>
            </div>
          )}

          {/* {/* ═══ Calculadora REBATE Trimestral PCEL ═══ */}
          {clienteKey === "pcel" && catActiva === "rebate" && pcelCalc && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-gray-700" />
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
              <p className="text-xs text-gray-400 mt-3">* Tiers: {pcelRebateTiers.map(t => t.label + "=" + (t.pct*100) + "%").join(", ")}</p>
            </div>
          )}
          {/* ═══ Calculadora SPIFF Mensual PCEL ═══ */}
          {clienteKey === "pcel" && catActiva === "spiff" && pcelCalc && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <Wallet className="w-5 h-5 text-gray-700" />
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

          {/* ═══ Fondo PCEL: ledger (toggle desde KPI cards) ═══ */}
          {clienteKey === "pcel" && mostrarFondo && (
            <div className="space-y-4 mb-6">
              <div className="bg-violet-50 border border-violet-200 rounded-xl p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-violet-600" />
                  <p className="text-sm text-violet-900"><strong>Fondos PCEL</strong> — total aportado {formatMXN(fondoResumen.entradasMkt + fondoResumen.entradasDirecto)} · total gastado {formatMXN(fondoResumen.gastosMkt + fondoResumen.gastosDirecto)}</p>
                </div>
                <button onClick={() => setMostrarFondo(false)} className="text-xs text-violet-600 hover:text-violet-800 font-semibold">Cerrar ▲</button>
              </div>

              {/* Ledger por tipo de fondo */}
              {["mkt", "directo"].map(tipo => {
                const filas = [...fondoResumen.ledger[tipo]].reverse(); // newest first
                const titulo = tipo === "mkt" ? "Fondo de Marketing" : "Fondo Directo (Generación Sell Out)";
                const color = tipo === "mkt" ? "violet" : "blue";
                return (
                  <div key={tipo} className="bg-white rounded-2xl shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between p-5 border-b border-gray-100">
                      <div>
                        <h3 className={`text-lg font-bold text-${color}-600`}>{titulo}</h3>
                        <p className="text-xs text-gray-400 mt-0.5">{filas.length} movimientos · Saldo actual {formatMXN(tipo === "mkt" ? fondoResumen.saldoMkt : fondoResumen.saldoDirecto)}</p>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setFondoForm(f => ({ ...f, tipo_fondo: tipo, tipo_mov: "aporte", fecha: new Date().toISOString().slice(0, 10), concepto: "", monto: "", folio: "", notas: "" })); setShowFondoForm(true); }}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                          title="Agregar dinero al fondo (incluso si no se cumplió cuota)"
                        >
                          💰 Aportar
                        </button>
                        <button
                          onClick={() => { setFondoForm(f => ({ ...f, tipo_fondo: tipo, tipo_mov: "gasto", fecha: new Date().toISOString().slice(0, 10), concepto: "", monto: "", folio: "", notas: "" })); setShowFondoForm(true); }}
                          className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white"
                          title="Registrar gasto / salida del fondo"
                        >
                          💸 Gasto
                        </button>
                      </div>
                    </div>
                    {filas.length === 0 ? (
                      <p className="text-sm text-gray-400 italic text-center py-8">Sin movimientos.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Fecha</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Tipo</th>
                              <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Concepto</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Q</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-emerald-600 uppercase">Entrada</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-rose-600 uppercase">Salida</th>
                              <th className="text-right py-2 px-3 text-xs font-semibold text-gray-600 uppercase">Saldo</th>
                              <th className="text-center py-2 px-3 text-xs font-semibold text-gray-500 uppercase">Folio</th>
                              <th className="w-10"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {filas.map(m => (
                              <tr key={m.id} className="border-b border-gray-50 hover:bg-gray-50">
                                <td className="py-2 px-3 text-gray-600 whitespace-nowrap">{new Date(m.fecha + "T00:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "2-digit" })}</td>
                                <td className="py-2 px-3">
                                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase ${
                                    m.tipo_mov === "inicial" ? "bg-gray-100 text-gray-600" :
                                    m.tipo_mov === "aporte" ? "bg-emerald-100 text-emerald-700" :
                                    "bg-rose-100 text-rose-700"
                                  }`}>{m.tipo_mov}</span>
                                </td>
                                <td className="py-2 px-3 text-gray-800">{m.concepto}{m.notas && <span className="block text-xs text-gray-400">{m.notas}</span>}</td>
                                <td className="py-2 px-3 text-center text-gray-500 text-xs">{m.trimestre ? `Q${m.trimestre} ${m.anio}` : "—"}</td>
                                <td className="py-2 px-3 text-right text-emerald-600 font-semibold">{m.tipo_mov !== "gasto" ? formatMXN(Number(m.monto)) : "—"}</td>
                                <td className="py-2 px-3 text-right text-rose-600 font-semibold">{m.tipo_mov === "gasto" ? formatMXN(Number(m.monto)) : "—"}</td>
                                <td className="py-2 px-3 text-right text-gray-800 font-bold">{formatMXN(m.saldo_running)}</td>
                                <td className="py-2 px-3 text-center text-gray-400 text-xs">{m.folio || "—"}</td>
                                <td className="py-2 px-3 text-center">
                                  {m.tipo_mov !== "inicial" && canEdit && (
                                    <button onClick={() => eliminarMovimientoFondo(m.id)} className="text-gray-300 hover:text-rose-500 text-xs" title="Eliminar movimiento">✕</button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Modal: nuevo movimiento (UX diferenciada según aporte/gasto) */}
              {showFondoForm && (() => {
                const esAporte = fondoForm.tipo_mov === "aporte";
                const tituloModal = esAporte ? "💰 Agregar aporte al fondo" : "💸 Registrar gasto del fondo";
                const subtituloModal = esAporte
                  ? "Suma dinero al fondo. Útil para aportes manuales cuando no se cumplió cuota pero decides aportar de todas formas."
                  : "Registra una salida del fondo (evento, promoción, material, etc.)";
                const conceptoPlaceholder = esAporte
                  ? "Ej. Aporte discrecional Q2, Generación extra de marketing"
                  : "Ej. Hot Sale, Promociones Mar 26, Rebate Q1";
                const colorBtn = esAporte ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-500 hover:bg-rose-600";
                const colorBg = esAporte ? "bg-emerald-50" : "bg-rose-50";
                return (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
                  <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                    <div className={`flex items-center justify-between px-5 py-4 border-b border-gray-100 ${colorBg}`}>
                      <div>
                        <h3 className="font-bold text-gray-800">{tituloModal}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">{subtituloModal}</p>
                      </div>
                      <button onClick={() => setShowFondoForm(false)} className="p-1 rounded hover:bg-white/50 text-gray-500 text-lg">✕</button>
                    </div>
                    <div className="p-5 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs text-gray-500 font-semibold">Fondo</span>
                          <select value={fondoForm.tipo_fondo} onChange={e => setFondoForm(f => ({ ...f, tipo_fondo: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="mkt">Fondo MKT</option>
                            <option value="directo">Fondo Directo</option>
                          </select>
                        </label>
                        <label className="block">
                          <span className="text-xs text-gray-500 font-semibold">Tipo de movimiento</span>
                          <select value={fondoForm.tipo_mov} onChange={e => setFondoForm(f => ({ ...f, tipo_mov: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm">
                            <option value="aporte">💰 Aporte (entrada)</option>
                            <option value="gasto">💸 Gasto (salida)</option>
                          </select>
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs text-gray-500 font-semibold">Fecha</span>
                        <input type="date" value={fondoForm.fecha} onChange={e => setFondoForm(f => ({ ...f, fecha: e.target.value }))} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                      </label>
                      <label className="block">
                        <span className="text-xs text-gray-500 font-semibold">Concepto *</span>
                        <input type="text" value={fondoForm.concepto} onChange={e => setFondoForm(f => ({ ...f, concepto: e.target.value }))} placeholder={conceptoPlaceholder} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <span className="text-xs text-gray-500 font-semibold">Monto *</span>
                          <input type="number" value={fondoForm.monto} onChange={e => setFondoForm(f => ({ ...f, monto: e.target.value }))} placeholder="0.00" className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                        </label>
                        <label className="block">
                          <span className="text-xs text-gray-500 font-semibold">Folio</span>
                          <input type="text" value={fondoForm.folio} onChange={e => setFondoForm(f => ({ ...f, folio: e.target.value }))} placeholder="—" className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                        </label>
                      </div>
                      <label className="block">
                        <span className="text-xs text-gray-500 font-semibold">Notas / motivo</span>
                        <input type="text" value={fondoForm.notas} onChange={e => setFondoForm(f => ({ ...f, notas: e.target.value }))} placeholder={esAporte ? "Ej. Aporte autorizado por dirección" : ""} className="mt-1 w-full px-3 py-2 border rounded-lg text-sm" />
                      </label>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100">
                      <button onClick={() => setShowFondoForm(false)} className="px-4 py-2 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-100">Cancelar</button>
                      <button onClick={crearMovimientoFondo} className={`px-4 py-2 rounded-lg text-sm font-semibold text-white ${colorBtn}`}>
                        {esAporte ? "💰 Guardar aporte" : "💸 Guardar gasto"}
                      </button>
                    </div>
                  </div>
                </div>
                );
              })()}
            </div>
          )}

        </>
      )}

      {/* Modal: bitácora de cambios de un pago */}
      {historialPago && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h3 className="font-bold text-gray-800">Bitácora de cambios</h3>
                <p className="text-xs text-gray-500 mt-0.5">{historialPago.pago.concepto}</p>
              </div>
              <button onClick={() => setHistorialPago(null)} className="p-1 rounded hover:bg-gray-100 text-gray-500 text-lg">✕</button>
            </div>
            <div className="overflow-y-auto p-5">
              {historialPago.entries.length === 0 ? (
                <p className="text-sm text-gray-400 italic text-center py-6">Sin cambios registrados (este pago fue creado antes del audit, o no ha sido editado).</p>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left py-2 px-2 text-gray-500 font-semibold uppercase">Fecha</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-semibold uppercase">Usuario</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-semibold uppercase">Campo</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-semibold uppercase">De</th>
                      <th className="text-left py-2 px-2 text-gray-500 font-semibold uppercase">A</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialPago.entries.map((e) => (
                      <tr key={e.id} className="border-t border-gray-100">
                        <td className="py-1.5 px-2 text-gray-500 whitespace-nowrap">
                          {new Date(e.changed_at).toLocaleString("es-MX", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                        </td>
                        <td className="py-1.5 px-2 text-gray-700">{e.user_name || e.user_email || "—"}</td>
                        <td className="py-1.5 px-2">
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                            e.accion === "insert" ? "bg-emerald-100 text-emerald-700"
                            : e.accion === "delete" ? "bg-red-100 text-red-700"
                            : "bg-blue-100 text-blue-700"
                          }`}>
                            {e.accion === "update" ? e.field_name : e.accion}
                          </span>
                        </td>
                        <td className="py-1.5 px-2 text-gray-600">{e.accion === "update" ? (e.old_value || "∅") : ""}</td>
                        <td className="py-1.5 px-2 text-gray-800 font-medium">{e.accion === "update" ? (e.new_value || "∅") : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 text-right">
              <button onClick={() => setHistorialPago(null)} className="px-4 py-1.5 bg-white hover:bg-gray-100 text-gray-700 rounded-lg text-xs font-semibold border border-gray-300">Cerrar</button>
            </div>
          </div>
        </div>
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


// ═══════════════════════════════════════════════════════════════════════
// HistorialPagadosPorMes — menú desplegable con pagos ya completados,
// agrupados por mes (YYYY-MM desc). Aparece en todas las sub-pestañas
// (promociones, marketing, pagos fijos, pagos variables, rebate, spiff, todas)
// filtrando según la categoría activa.
// ═══════════════════════════════════════════════════════════════════════
function HistorialPagadosPorMes({ pagados, catActiva, CATEGORIA_META, onTogglePagado, canEdit }) {
  const [abierto, setAbierto] = React.useState(false);
  const [mesesExpandidos, setMesesExpandidos] = React.useState({});
  const [rango, setRango] = React.useState("6m"); // '3m' | '6m' | 'anio' | 'todo'

  // Filtrar por rango antes de cualquier otro procesamiento
  const pagadosFiltrados = React.useMemo(() => {
    if (!pagados || pagados.length === 0) return [];
    if (rango === "todo") return pagados;
    const hoy = new Date();
    let desde;
    if (rango === "3m") { desde = new Date(hoy); desde.setMonth(hoy.getMonth() - 3); }
    else if (rango === "6m") { desde = new Date(hoy); desde.setMonth(hoy.getMonth() - 6); }
    else if (rango === "anio") { desde = new Date(hoy.getFullYear(), 0, 1); }
    const desdeISO = desde.toISOString().slice(0, 10);
    return pagados.filter(r => {
      const f = r.fecha_pago_real || r.fecha_compromiso;
      return f && String(f).slice(0, 10) >= desdeISO;
    });
  }, [pagados, rango]);

  if (!pagados || pagados.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm p-4 mb-6">
        <div className="flex items-center gap-2 text-gray-400">
          <span>✓</span>
          <h3 className="text-sm font-semibold">Pagos completados</h3>
          <span className="text-xs italic">— aún no hay pagos completados{catActiva !== "todas" ? " en esta categoría" : ""}</span>
        </div>
      </div>
    );
  }

  // Agrupar por YYYY-MM (por fecha_pago_real si existe, si no fecha_compromiso)
  const MESES_LARGOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const getFechaMes = (r) => {
    const f = r.fecha_pago_real || r.fecha_compromiso;
    return f ? String(f).slice(0, 7) : "sin-fecha";
  };
  const grupos = {};
  pagadosFiltrados.forEach((r) => {
    const k = getFechaMes(r);
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(r);
  });
  const mesesOrdenados = Object.keys(grupos).sort((a, b) => b.localeCompare(a)); // desc
  const totalPagados = pagadosFiltrados.reduce((s, r) => s + (Number(r.monto) || 0), 0);

  return (
    <div className="bg-white rounded-2xl shadow-sm mb-6 overflow-hidden">
      <button
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{abierto ? "▾" : "▸"}</span>
          <span className="w-2 h-2 rounded-full bg-emerald-500" />
          <h3 className="text-sm font-semibold text-gray-700">Pagos completados</h3>
          <span className="text-xs text-gray-400">
            ({pagadosFiltrados.length} pago{pagadosFiltrados.length !== 1 ? "s" : ""} · {mesesOrdenados.length} mes{mesesOrdenados.length !== 1 ? "es" : ""})
          </span>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-emerald-600">{formatMXN(totalPagados)}</p>
          <p className="text-[10px] text-gray-400 uppercase tracking-wider">Total pagado</p>
        </div>
      </button>

      {abierto && (
        <div className="border-t border-gray-100 divide-y divide-gray-100">
          <div className="px-5 py-2 bg-gray-50 flex items-center gap-2 text-xs">
            <span className="text-gray-500">Mostrar:</span>
            {[
              { k: "3m", label: "Últimos 3 meses" },
              { k: "6m", label: "Últimos 6 meses" },
              { k: "anio", label: "Este año" },
              { k: "todo", label: "Todo" },
            ].map(o => (
              <button
                key={o.k}
                onClick={() => setRango(o.k)}
                className={`px-2.5 py-0.5 rounded-full font-semibold transition-colors ${
                  rango === o.k ? "bg-emerald-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-100"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {mesesOrdenados.map((mesKey) => {
            const items = grupos[mesKey];
            const totalMes = items.reduce((s, r) => s + (Number(r.monto) || 0), 0);
            const [anio, mm] = mesKey.split("-");
            const nombreMes = mm && !isNaN(Number(mm))
              ? `${MESES_LARGOS[Number(mm) - 1]} ${anio}`
              : "Sin fecha";
            const expandido = !!mesesExpandidos[mesKey];
            return (
              <div key={mesKey}>
                <button
                  onClick={() => setMesesExpandidos((p) => ({ ...p, [mesKey]: !expandido }))}
                  className="w-full flex items-center justify-between px-5 py-2.5 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-gray-400">{expandido ? "▾" : "▸"}</span>
                    <span className="text-sm font-medium text-gray-700">{nombreMes}</span>
                    <span className="text-xs text-gray-400">
                      · {items.length} pago{items.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{formatMXN(totalMes)}</span>
                </button>
                {expandido && (
                  <div className="px-5 pb-3 bg-gray-50/40">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-gray-400 uppercase tracking-wider">
                          <th className="text-left py-1.5 pr-3 font-semibold">Concepto</th>
                          <th className="text-left py-1.5 pr-3 font-semibold">Categoría</th>
                          <th className="text-right py-1.5 pr-3 font-semibold">Monto</th>
                          <th className="text-left py-1.5 pr-3 font-semibold">F. Pago</th>
                          <th className="text-left py-1.5 pr-3 font-semibold">Folio</th>
                          <th className="text-left py-1.5 pr-3 font-semibold">Responsable</th>
                          {canEdit && onTogglePagado && <th className="text-center py-1.5 font-semibold" title="Click para desmarcar">Pagado</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((r) => {
                          const meta = CATEGORIA_META[r.categoria];
                          return (
                            <tr key={r.id} className="border-t border-gray-100">
                              <td className="py-1.5 pr-3 text-gray-700">{r.concepto}</td>
                              <td className="py-1.5 pr-3">
                                {meta ? (
                                  <span className="inline-block px-2 py-0.5 rounded text-[10px] font-semibold text-white"
                                        style={{ backgroundColor: meta.color }}>
                                    {meta.label}
                                  </span>
                                ) : (
                                  <span className="text-gray-400 text-[10px]">{r.categoria}</span>
                                )}
                              </td>
                              <td className="py-1.5 pr-3 text-right font-semibold text-emerald-600">{formatMXN(r.monto)}</td>
                              <td className="py-1.5 pr-3 text-gray-600">{r.fecha_pago_real ? formatFecha(r.fecha_pago_real) : <span className="italic text-gray-400">—</span>}</td>
                              <td className="py-1.5 pr-3 font-mono text-[11px] text-gray-500">{r.folio || "—"}</td>
                              <td className="py-1.5 pr-3 text-gray-500">{r.responsable || "—"}</td>
                              {canEdit && onTogglePagado && (
                                <td className="py-1.5 text-center">
                                  <input type="checkbox" checked
                                    onChange={() => onTogglePagado(r)}
                                    className="w-4 h-4 rounded border-gray-300 text-emerald-600 cursor-pointer"
                                    title="Click para desmarcar y volver a pendiente" />
                                </td>
                              )}
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
  );
}
