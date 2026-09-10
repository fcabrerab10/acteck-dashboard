// PagosCliente · V3 (2026-09-10)
// Toda la lógica de datos, cálculos y escrituras a Supabase vive aquí; el render
// se arma con el kit (Hero · KpiCard · Segmented · TablaCompacta · Panel · Pill · Boton)
// y sub-vistas en ./pagos/*.jsx.
import React, { useState, useEffect, useRef } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { PCEL_REAL, PAGOS_DIGITALIFE_2026 } from '../../lib/constants';
import { formatMXN, formatFecha, loadSheetJS } from '../../lib/utils';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente, puedeVerPestanaCliente } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import { Download, History, Plus } from 'lucide-react';
import { NuevaPromocionButton, ListaPromociones } from './PagosPromociones';
import LineamientosCliente from './LineamientosCliente';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { cachedQuery } from '../../lib/queries';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Pill, Segmented, Panel, Boton, SkeletonPantalla, toast } from '../../components/kit';
import { CATEGORIA_META, MESES_CORTOS, MESES_LARGOS, esMesFuturo, Nota } from './pagos/pagosUI';
import TablaPendientes from './pagos/TablaPendientes';
import FormNuevoPago from './pagos/FormNuevoPago';
import PagosFijos, { MESES_ARR } from './pagos/PagosFijos';
import HistorialPagados from './pagos/HistorialPagados';
import ResumenMensual, { ExportModal } from './pagos/ResumenMensual';
import BitacoraModal from './pagos/BitacoraModal';
import { RebateDigitalife, RebateDicotech, RebatePcel } from './pagos/RebatePanels';
import { SpiffDigitalife, SpiffDicotech, SpiffPcel } from './pagos/SpiffPanels';
import { FondosDicotech, FondosPcel, FondoPcelModal } from './pagos/FondosPanels';

export default function PagosCliente({ cliente, clienteKey }) {
  const c = cliente;
  const perfil = usePerfil();
  // Self-gating (belt-and-suspenders). App.jsx ya bloquea antes, pero si
  // alguien monta este componente directo o cambia navegación, protegemos.
  if (!puedeVerPestanaCliente(perfil, clienteKey, 'pagos')) {
    return <SinAcceso motivo={`No tienes acceso a Pagos de ${clienteKey || 'este cliente'}.`} />;
  }
  const { theme } = useTheme();
  const rootRef = useRef(null); // raíz para exportar PDF
  const isDark = theme.mode === 'dark';
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
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportMeses, setExportMeses] = useState([]); // ["YYYY-MM", ...] multi-select
  const [historialPago, setHistorialPago] = useState(null); // { pago, entries }
  const [expandedPagoId, setExpandedPagoId] = useState(null); // pago marketing expandido
  const [actividadesPorPago, setActividadesPorPago] = useState({}); // cache pago_id → [actividades]
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [showAdd, setShowAdd]         = useState(false);
  const [expandedFijos, setExpandedFijos] = useState({});  // { conceptoKey: true }
  const [showAddFijo, setShowAddFijo] = useState(false);
  const [newFijo, setNewFijo] = useState({ concepto: "", monto: "", responsable: "", meses: [], existente: "" });
  const [newRow, setNewRow]           = useState({
    folio: "", concepto: "", categoria: "promociones", monto: "",
    estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
    responsable: "", notas: "", fuente: "", tipo_actividad: "",
    // Split de fondos (solo Dicotech): cuánto sale de cada fondo.
    // Si suman menos que el monto total, el resto se considera "externo"
    // (lo paga Acteck directo, sin tocar fondos).
    monto_fondo_mkt_cliente: "", monto_fondo_interno: "",
  });

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
  // % único (modo flat_v2). Reemplaza los tiers y el tope. Fallback: 0.16%.
  const SPIFF_FLAT_PCT = React.useMemo(() =>
    Number(lineamientos?.spiff?.flat_pct) || 0.0016,
    [lineamientos]
  );
  // Cuota SO = cuota SI × factor (default 90%). Editable.
  const SPIFF_CUOTA_SO_FACTOR = React.useMemo(() =>
    Number(lineamientos?.spiff?.cuota_so_factor) || 0.90,
    [lineamientos]
  );
  // SPIFF paga sólo si alcance SO ≥ umbral (default 90%). Editable.
  const SPIFF_MIN_ALCANCE = React.useMemo(() =>
    Number(lineamientos?.spiff?.min_alcance) || 0.90,
    [lineamientos]
  );
  const [digiSellOut26, setDigiSellOut26] = useState({});
  const [digiCuotas, setDigiCuotas] = useState([]);
  const [dicoSellIn, setDicoSellIn] = useState({});      // Dicotech: sell-in mensual $
  const [pctPorMes, setPctPorMes] = useState({});  // { [mes]: pct override elegido en la fila }
  const [dicoVendedoresPorMes, setDicoVendedoresPorMes] = useState({}); // { "2026-08": [{nombre, monto}, ...] } ordenado desc
  const [spiffPagos, setSpiffPagos] = useState({});  // Digitalife: { "2026-01": pagoRow } | Dicotech: { "2026-01-SI": ..., "2026-01-SO": ... }
  const [spiffPctUnlocked, setSpiffPctUnlocked] = useState(false); // Candado del % compradora — evita edits accidentales.
  const spiffPctInputRef = React.useRef(null);
  const [spiffDigiTiersUnlocked, setSpiffDigiTiersUnlocked] = useState(false); // Candado global de los % de tiers Digitalife.
  const [spiffLoading, setSpiffLoading] = useState(false);

  useEffect(() => {
    if ((clienteKey !== "digitalife" && clienteKey !== "dicotech") || !DB_CONFIGURED) return;
    setSpiffLoading(true);
    (async () => {
      const anio = new Date().getFullYear();
      // Paginación para sellout_sku
      // Delegado al motor paginado PARALELO + cache central (lib/queries.js).
      const fetchAll = async (qs) => {
        const { fetchAllQ, orderColFromSelect } = await import('../../lib/queries');
        return fetchAllQ(
          () => supabase.from("sellout_sku").select(qs).eq("cliente", clienteKey).eq("anio", anio),
          { pageSize: 1000, orderCol: orderColFromSelect(qs), label: 'sellout_sku' },
        );
      };
      // Sell-In sólo lo cargamos para Dicotech (lo usa la calculadora SPIFF SI).
      const siProm = clienteKey === "dicotech"
        ? supabase.from("sell_in_sku").select("mes,monto_pesos").eq("cliente", clienteKey).eq("anio", anio)
        : Promise.resolve({ data: [] });
      // Vendedores Dicotech: sellout_general del año, agregado por (mes, vendedor).
      // Se usa para el ranking de SPIFF vendedores (top 5 por mes).
      const vendedoresProm = clienteKey === "dicotech"
        ? (async () => {
            // Vista agregada en Postgres (v_sellout_general_vendedor_mes): ~225
            // filas en vez de ~20K crudas. El consumidor suma por mes+vendedor,
            // así que recibir ya agregado es idempotente.
            const { fetchAllQ } = await import('../../lib/queries');
            const all = await fetchAllQ(
              () => supabase.from("v_sellout_general_vendedor_mes").select("mes,vendedor_nombre,importe").ilike("mayorista", "%dicotech%").eq("anio", anio).order("mes", { ascending: true }),
              { pageSize: 1000, label: 'vendedor_mes' },
            );
            return { data: all };
          })()
        : Promise.resolve({ data: [] });
      const [soData, cuotasData, existingSpiffPagos, siRes, vendRes] = await Promise.all([
        fetchAll("mes,monto_pesos"),
        supabase.from("cuotas_mensuales").select("mes,cuota_min,cuota_ideal,cuota_minima_interna").eq("cliente", clienteKey).eq("anio", anio).order("mes"),
        supabase.from("pagos").select("*").eq("cliente", clienteKey).eq("categoria", "spiff"),
        siProm,
        vendedoresProm,
      ]);
      // Agregar vendedores por mes → ordenados desc
      const vendByMes = {}; // { "2026-08": Map<vendedor,monto> }
      (vendRes.data || []).forEach(r => {
        const m = Number(r.mes);
        if (!(m >= 1 && m <= 12)) return;
        const nombre = (r.vendedor_nombre || "").trim() || "(sin vendedor)";
        const importe = Number(r.importe) || 0;
        const key = `${anio}-${String(m).padStart(2, "0")}`;
        if (!vendByMes[key]) vendByMes[key] = new Map();
        vendByMes[key].set(nombre, (vendByMes[key].get(nombre) || 0) + importe);
      });
      const vendFinal = {};
      Object.entries(vendByMes).forEach(([k, mp]) => {
        vendFinal[k] = Array.from(mp.entries())
          .map(([nombre, monto]) => ({ nombre, monto }))
          .sort((a, b) => b.monto - a.monto);
      });
      setDicoVendedoresPorMes(vendFinal);
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

  // Cálculo del SPIFF por mes (modelo flat_v2 con umbral).
  //   cuotaSO = cuotaSI × cuota_so_factor    (ej. 90% de la cuota SI)
  //   alcance  = soReal / cuotaSO
  //   comisión = soReal × flat_pct   si alcance ≥ min_alcance  (ej. 90%)
  //             0                    si no llega al umbral
  const spiffCalc = React.useMemo(() => {
    if ((clienteKey !== "digitalife" && clienteKey !== "dicotech") || digiCuotas.length === 0) return null;
    const anio = new Date().getFullYear();
    const results = [];
    for (let m = 1; m <= 12; m++) {
      const cRow = digiCuotas.find(x => Number(x.mes) === m);
      const cuotaSI = cRow ? Number(cRow.cuota_min) || 0 : 0;
      const cuotaSOMin = cuotaSI * SPIFF_CUOTA_SO_FACTOR;
      const soActual = digiSellOut26[m] || 0;
      const alcance = cuotaSOMin > 0 ? soActual / cuotaSOMin : 0;
      const aplica = alcance >= SPIFF_MIN_ALCANCE;
      const comision = aplica ? soActual * SPIFF_FLAT_PCT : 0;
      const key = `${anio}-${String(m).padStart(2, "0")}`;
      results.push({
        mes: m, cuotaSI, cuotaSOMin, soActual, alcance,
        tier: null, comisionRaw: comision, comision, capped: false,
        aplica, ajustado: false,
        pagoExistente: spiffPagos[key],
      });
    }
    return results;
  }, [clienteKey, digiCuotas, digiSellOut26, spiffPagos, SPIFF_FLAT_PCT, SPIFF_CUOTA_SO_FACTOR, SPIFF_MIN_ALCANCE]);

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
  // ═══ SPIFF Dicotech v2 (flat_v2) ═══
  // (1) Compradora: pct fijo × sell-in mensual (facturacion_clientes).
  // (2) Vendedores: top 5 por sell-out del mes (sellout_general/vendedor_nombre)
  //     que superen cuota_min_vendedor. Premios de texto libre configurables por mes.
  const spiffDicoCompradoraPct = Number(lineamientos?.spiff?.compradora_pct) || 0.0037;
  const spiffDicoVendedoresMeses = lineamientos?.spiff?.vendedores_meses || {};

  const spiffDicotechCalc = React.useMemo(() => {
    if (clienteKey !== "dicotech") return null;
    const anio = new Date().getFullYear();
    const results = [];
    for (let m = 1; m <= 12; m++) {
      const keyMes = `${anio}-${String(m).padStart(2, "0")}`;
      const siActual = Number(dicoSellIn[m]) || 0;
      const comisionSI = siActual * spiffDicoCompradoraPct;
      const vendedoresMes = dicoVendedoresPorMes[keyMes] || [];
      const cfgMes = spiffDicoVendedoresMeses[keyMes] || {};
      const cuotaMin = Number(cfgMes.cuota_min) || 0;
      const premios = Array.isArray(cfgMes.premios) ? cfgMes.premios : ["", "", "", "", ""];
      // Top 5 que superen cuota mínima (si cuotaMin=0, todos califican)
      const ganadores = vendedoresMes
        .filter(v => v.monto >= cuotaMin)
        .slice(0, 5)
        .map((v, i) => ({ ...v, posicion: i + 1, premio: premios[i] || "" }));
      results.push({
        mes: m,
        siActual,
        comisionSI,
        vendedoresMes,       // lista completa para debug/tooltip
        ganadores,           // top 5 con cuota mínima aplicada
        cuotaMin,
        premios,             // 5 slots
        pagoSI: spiffPagos[`${keyMes}-SI`],
        // No hay pagoSO $ porque los premios son texto libre — se paga fuera del sistema.
      });
    }
    return results;
  }, [clienteKey, dicoSellIn, dicoVendedoresPorMes, spiffPagos, spiffDicoCompradoraPct, spiffDicoVendedoresMeses]);

  const spiffDicotechTotalYTD = React.useMemo(() => {
    if (!spiffDicotechCalc) return { si: 0, so: 0, total: 0 };
    let si = 0;
    for (const c of spiffDicotechCalc) {
      const sumar = (pago, calcAmt) => {
        if (pago && pago.estatus === "cancelado") return 0;
        if (pago) return Number(pago.monto) || 0;
        return calcAmt;
      };
      si += sumar(c.pagoSI, c.comisionSI);
    }
    return { si, so: 0, total: si };
  }, [spiffDicotechCalc]);

  // Guardar config de SPIFF Dicotech (compradora_pct global, o cuota/premios por mes)
  const guardarSpiffDicoConfig = React.useCallback(async (patch) => {
    const configPrev = lineamientos?.spiff || { modo: "flat_v2", compradora_pct: 0.0037, vendedores_meses: {} };
    const configNueva = {
      modo: "flat_v2",
      compradora_pct: patch.compradora_pct != null ? Number(patch.compradora_pct) : (Number(configPrev.compradora_pct) || 0.0037),
      vendedores_meses: { ...(configPrev.vendedores_meses || {}) },
    };
    if (patch.mesKey) {
      const prevMes = configNueva.vendedores_meses[patch.mesKey] || { cuota_min: 0, premios: ["","","","",""] };
      configNueva.vendedores_meses[patch.mesKey] = {
        cuota_min: patch.cuota_min != null ? Number(patch.cuota_min) : Number(prevMes.cuota_min) || 0,
        premios: patch.premios != null ? patch.premios : (prevMes.premios || ["","","","",""]),
      };
    }
    const { error } = await supabase.from("lineamientos_cliente")
      .upsert({ cliente: "dicotech", tipo: "spiff", config: configNueva }, { onConflict: "cliente,tipo" });
    if (error) { toast.error("Error guardando SPIFF config: " + error.message); return; }
    setLineamientos(prev => ({ ...prev, spiff: configNueva }));
  }, [lineamientos]);

  // Guarda una de las 3 palancas del SPIFF Digitalife: flat_pct, cuota_so_factor
  // o min_alcance. Preserva el resto de la config existente (tiers viejos, tope,
  // etc.) para no romper si algún día se quisiera revertir.
  const guardarSpiffDigiConfig = React.useCallback(async (patch) => {
    const cfg = lineamientos?.spiff || {};
    const configNueva = { ...cfg };
    if (patch.flat_pct != null) configNueva.flat_pct = Number(patch.flat_pct);
    if (patch.cuota_so_factor != null) configNueva.cuota_so_factor = Number(patch.cuota_so_factor);
    if (patch.min_alcance != null) configNueva.min_alcance = Number(patch.min_alcance);
    const { error } = await supabase.from("lineamientos_cliente")
      .upsert({ cliente: "digitalife", tipo: "spiff", config: configNueva }, { onConflict: "cliente,tipo" });
    if (error) { toast.error("Error guardando SPIFF Digitalife: " + error.message); return; }
    setLineamientos(prev => ({ ...prev, spiff: configNueva }));
  }, [lineamientos]);

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
      if (monto <= 0) { toast.error("Monto inválido."); return; }
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
    if (error) { toast.error("Error creando pago: " + (error.message || JSON.stringify(error))); return; }
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
    if (error) { toast.error("Error: " + error.message); return; }
    setDicoFondoMovs(prev => [...prev, ...data].sort((a,b) => a.mes - b.mes));
    flash(`✓ Pago aplicado al mes ${mes}: ${formatMXN(montoTotal)}`);
  };

  const revertirMovimientoFondo = async (movId) => {
    if (!canEdit) return;
    if (!window.confirm("¿Eliminar este movimiento del fondo?")) return;
    const { error } = await supabase.from("fondos_mkt_movimientos").delete().eq("id", movId);
    if (error) { toast.error("Error: " + error.message); return; }
    setDicoFondoMovs(prev => prev.filter(m => m.id !== movId));
    flash("✓ Movimiento revertido");
  };

  // ── Rebate MENSUAL Dicotech ──
  // % del sell-in del mes según tier (≥90%, ≥115%, ≥130%, ≥150%).
  // Pago al día 15 del mes siguiente. Si no llega al mínimo, botón ámbar
  // permite pagar manual. Lee config desde lineamientos.rebate.
  const dicoRebateCalc = React.useMemo(() => {
    if (clienteKey !== "dicotech" || digiCuotas.length === 0) return null;
    const cfg = lineamientos?.rebate || {};
    const tiers = (cfg.tiers || []).slice().sort((a, b) => Number(b.min_alcance) - Number(a.min_alcance));
    const alcanceMin = Number(cfg.alcance_minimo_pago) || 0.90;
    const MESES_LABEL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    return Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1;
      const cuotaRow = digiCuotas.find(x => Number(x.mes) === mes);
      const cuota = cuotaRow ? Number(cuotaRow.cuota_min) || 0 : 0;
      const sellIn = Number(dicoSellIn[mes]) || 0;
      const alcance = cuota > 0 ? sellIn / cuota : 0;
      const tier = tiers.find(t => alcance >= Number(t.min_alcance)) || null;
      const cumple = alcance >= alcanceMin;
      const rebateAuto = cumple && tier ? sellIn * Number(tier.pct) : 0;
      // Pago existente por mes (concepto "Rebate <mes> <anio>")
      const pagoExistente = registros.find(r => {
        if (r.categoria !== "rebate" || r.cliente !== clienteKey) return false;
        const mm = r.concepto?.match(/Rebate\s+(\d{1,2})/);
        return mm && Number(mm[1]) === mes;
      });
      return {
        mes, label: MESES_LABEL[i], cuota, sellIn, alcance,
        tier, cumple, alcanceMin, rebateAuto,
        pagoExistente,
        // aliases para compat con código viejo si algo los usa
        q: mes, cuotaQ: cuota, sellInQ: sellIn,
      };
    });
  }, [clienteKey, digiCuotas, dicoSellIn, lineamientos, registros]);

  const dicoRebateTotalYTD = React.useMemo(() => {
    if (!dicoRebateCalc) return 0;
    return dicoRebateCalc.reduce((s, m) => {
      const p = m.pagoExistente;
      if (p && p.estatus === "cancelado") return s;
      if (p) return s + (Number(p.monto) || 0);
      return s + m.rebateAuto;
    }, 0);
  }, [dicoRebateCalc]);

  const generarRebateDicotech = async (m, pctOverride = null) => {
    if (!canEdit) return;
    const anio = new Date().getFullYear();
    // Fecha de pago = día 15 del mes SIGUIENTE al mes del rebate
    const nextMes = m.mes === 12 ? 1 : m.mes + 1;
    const nextAnio = m.mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    // pctOverride: null → usa el rebateAuto (tier automático); número → aplica ese %
    const tiers = (lineamientos?.rebate?.tiers || []).slice().sort((a, b) => Number(b.min_alcance) - Number(a.min_alcance));
    const pctAplicado = pctOverride != null ? Number(pctOverride) : Number(m.tier?.pct || 0);
    const tierAplicado = pctOverride != null ? tiers.find(t => Number(t.pct) === Number(pctOverride)) : m.tier;
    const monto = Math.round(m.sellIn * pctAplicado);
    if (monto <= 0) { toast.error("Monto inválido."); return; }
    const esManual = pctOverride != null && pctOverride !== Number(m.tier?.pct || 0);
    const row = {
      cliente: clienteKey,
      categoria: "rebate",
      folio: null,
      concepto: `Rebate ${String(m.mes).padStart(2, "0")} ${m.label} ${anio}${esManual ? " — override" : ""}`,
      monto,
      estatus: "pendiente",
      fecha_compromiso: fechaCompromiso,
      responsable: "Acteck",
      notas: `${(pctAplicado*100).toFixed(2)}% × ${formatMXN(m.sellIn)} · alcance ${(m.alcance*100).toFixed(0)}% · ${tierAplicado?.label || "manual"}${esManual ? ` · tier auto: ${m.tier?.label || "sin tier"}` : ""}`,
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) { toast.error("Error: " + error.message); return; }
    setRegistros(prev => [...prev, data]);
    flash(`✓ Rebate ${m.label} generado: ${formatMXN(monto)}`);
  };

  const marcarRebateDicotechNoAplica = async (m) => {
    if (!canEdit) return;
    const anio = new Date().getFullYear();
    const nextMes = m.mes === 12 ? 1 : m.mes + 1;
    const nextAnio = m.mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    const row = {
      cliente: clienteKey, categoria: "rebate", folio: null,
      concepto: `Rebate ${String(m.mes).padStart(2, "0")} ${m.label} ${anio} — No aplica`,
      monto: 0, estatus: "cancelado",
      fecha_compromiso: fechaCompromiso,
      responsable: "Fernando Cabrera",
      notas: "Marcado como No aplica manualmente",
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) { toast.error("Error: " + error.message); return; }
    setRegistros(prev => [...prev, data]);
    flash(`✓ Rebate ${m.label} marcado No aplica`);
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
    if (error) { toast.error("Error: " + (error.message || JSON.stringify(error))); return; }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(mes).padStart(2, "0")}-${tipo}`]: data }));
    flash(`✓ SPIFF ${tipo} ${mesLabel} marcado como No aplica`);
  };

  // forzado=true: calcula comisión con SO × flat_pct aunque no cumpla el
  // umbral. Se usa para el botón "Pagar manual" cuando Fernando decide
  // recompensar aunque el mes no haya llegado a la cuota SO.
  const crearSpiffPago = async (calc, forzado = false) => {
    if (!canEdit) return;
    const mesLabel = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][calc.mes - 1];
    const anio = new Date().getFullYear();
    const nextMes = calc.mes === 12 ? 1 : calc.mes + 1;
    const nextAnio = calc.mes === 12 ? anio + 1 : anio;
    const fechaCompromiso = `${nextAnio}-${String(nextMes).padStart(2, "0")}-15`;
    // Cuando es forzado, calcula el monto que le tocaría si aplicara.
    const montoForzado = calc.soActual * (Number(lineamientos?.spiff?.flat_pct) || 0.0016);
    const montoFinal = forzado ? montoForzado : calc.comision;
    if (!(montoFinal > 0)) {
      toast.error('El monto calculado es cero, no se puede generar el pago.');
      return;
    }
    if (forzado) {
      const okMsg = `¿Pagar SPIFF de ${mesLabel} aunque no cumpla el umbral?\n\nMonto: ${formatMXN(montoFinal)}\nAlcance real: ${(calc.alcance*100).toFixed(0)}% (umbral ${(SPIFF_MIN_ALCANCE*100).toFixed(0)}%)`;
      if (!confirm(okMsg)) return;
    }
    const notasBase = `Sell Out: ${formatMXN(calc.soActual)} · Cuota SO Mín: ${formatMXN(calc.cuotaSOMin)} · Alcance ${(calc.alcance*100).toFixed(0)}%`;
    const row = {
      cliente: clienteKey, categoria: "spiff", folio: null,
      concepto: `SPIFF ${mesLabel} ${anio}${forzado ? ' — pago manual (no cumplió umbral)' : (calc.tier?.label ? ` — ${calc.tier.label}` : '')}`,
      monto: montoFinal,
      estatus: "pendiente", fecha_compromiso: fechaCompromiso,
      responsable: "PM Digitalife",
      notas: notasBase + (forzado ? ' · pago FORZADO (bajo umbral)' : (calc.capped ? ` · Capeado a ${formatMXN(SPIFF_TOPE)}` : '')),
    };
    const { data, error } = await supabase.from("pagos").insert(row).select().single();
    if (error) {
      console.error("crearSpiffPago error:", error, "row:", row);
      toast.error("Error creando pago: " + (error.message || JSON.stringify(error)));
      return;
    }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(calc.mes).padStart(2, "0")}`]: data }));
    flash(forzado ? "✓ Pago SPIFF forzado (no cumplió umbral)" : "✓ Pago SPIFF generado");
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
      toast.error("Error: " + (error.message || JSON.stringify(error)));
      return;
    }
    setSpiffPagos(p => ({ ...p, [`${anio}-${String(mes).padStart(2, "0")}`]: data }));
    flash("✓ Marcado como No aplica");
  };

  const revertirSpiff = async (pagoId) => {
    if (!window.confirm("¿Eliminar este registro de SPIFF?")) return;
    const { error } = await supabase.from("pagos").delete().eq("id", pagoId);
    if (error) { toast.error("Error: " + error.message); return; }
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
      cachedQuery(supabase.from("sell_in_sku").select("sku,mes,monto_pesos").eq("cliente", clienteKey).eq("anio", anio)),
      cachedQuery(supabase.from("productos_cliente").select("sku,categoria").eq("cliente", clienteKey))
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
  // Override independiente del Fondo MKT (igual que Rebate, para decidir
  // si se le paga al cliente aunque no alcance la cuota del Q).
  const [pcelOverrideFondo, setPcelOverrideFondo] = useState({1:"",2:"",3:"",4:""});
  const [pcelOverrideSpiff, setPcelOverrideSpiff] = useState({});
  const [pcelPagosReg, setPcelPagosReg] = useState([]);
  const [showPagoForm, setShowPagoForm] = useState(null);
  const [pagoFormData, setPagoFormData] = useState({ fecha_compromiso: "", responsable: "Fernando Cabrera", notas: "" });
  const [pcelCuotasSupa, setPcelCuotasSupa] = useState(null);
  
  useEffect(() => {
    if (clienteKey !== "pcel" || !DB_CONFIGURED) return;
    const anio = new Date().getFullYear();
    (async () => {
      const { data } = await cachedQuery(supabase.from("sell_in_sku").select("mes,monto_pesos").eq("cliente", "pcel").eq("anio", anio));
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

  // ── Toast (kit) · conserva la firma flash(msg, type) de los handlers ──
  const flash = (msg, type = "ok") => {
    const limpio = String(msg).replace(/^[✓⚠✗]\s*/, "").replace(/\s*[✓✗]$/, "").trim();
    if (type === "err" || /^⚠/.test(String(msg))) toast.error(limpio);
    else toast.ok(limpio);
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
    const montoTotal = parseFloat(newRow.monto) || 0;
    const montoFC = parseFloat(newRow.monto_fondo_mkt_cliente) || 0;
    const montoFI = parseFloat(newRow.monto_fondo_interno) || 0;

    // Validar que el split no exceda el monto total
    if (clienteKey === "dicotech" && (montoFC + montoFI) > montoTotal + 0.01) {
      toast.error(`El split de fondos ($${(montoFC+montoFI).toFixed(2)}) supera el monto total del pago ($${montoTotal.toFixed(2)}).`);
      return;
    }

    const record = {
      cliente: clienteKey,
      folio: newRow.folio.trim() || "",
      concepto: newRow.concepto,
      categoria: newRow.categoria,
      monto: montoTotal,
      estatus: newRow.estatus,
      fecha_compromiso: newRow.fecha_compromiso || null,
      fecha_pago_real: newRow.fecha_pago_real || null,
      responsable: newRow.responsable,
      notas: newRow.notas,
      fuente: newRow.fuente || null,
      tipo_actividad: newRow.tipo_actividad || null,
    };
    const { data, error } = await supabase.from("pagos").insert(record).select().single();
    if (error) {
      console.error("handleAdd error:", error, "record:", record);
      toast.error("Error al agregar: " + (error.message || JSON.stringify(error)));
      return;
    }
    setRegistros(prev => [...prev, data]);

    // Si la fuente es fondo_mkt (solo PCEL por ahora),
    // crear el movimiento automáticamente en el ledger del fondo.
    if (clienteKey === "pcel" && data.fuente === "fondo_mkt" && data.monto > 0) {
      await crearMovimientoDesdePago(data);
    }

    // Dicotech: aplicar el split de fondos como movimientos en fondos_mkt_movimientos.
    // Si el usuario marcó monto_fondo_mkt_cliente y/o monto_fondo_interno, se crean
    // las aplicaciones correspondientes para que los saldos del fondo bajen.
    if (clienteKey === "dicotech" && (montoFC > 0 || montoFI > 0)) {
      const fecha = newRow.fecha_compromiso || newRow.fecha_pago_real || new Date().toISOString().slice(0,10);
      const mes = Number(fecha.slice(5,7));
      const anio = Number(fecha.slice(0,4));
      const movs = [];
      if (montoFC > 0) {
        movs.push({
          cliente: "dicotech", anio, mes,
          tipo_fondo: "mkt_cliente", tipo_movimiento: "aplicacion",
          monto: montoFC, pago_id: data.id,
          notas: `Aplicación del pago "${data.concepto}" (${data.categoria})`
        });
      }
      if (montoFI > 0) {
        movs.push({
          cliente: "dicotech", anio, mes,
          tipo_fondo: "interno", tipo_movimiento: "aplicacion",
          monto: montoFI, pago_id: data.id,
          notas: `Aplicación del pago "${data.concepto}" (${data.categoria})`
        });
      }
      if (movs.length > 0) {
        const { data: movsData, error: emErr } = await supabase
          .from("fondos_mkt_movimientos").insert(movs).select();
        if (emErr) {
          toast.error("Pago creado, pero falló registrar aplicación al fondo: " + emErr.message);
        } else {
          setDicoFondoMovs(prev => [...prev, ...movsData].sort((a,b) => a.mes - b.mes));
        }
      }
    }

    setNewRow({ folio: "", concepto: "", categoria: "promociones", monto: "",
                estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
                responsable: "", notas: "", fuente: "", tipo_actividad: "",
                monto_fondo_mkt_cliente: "", monto_fondo_interno: "" });
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
    // PCEL legacy:
    await supabase.from("fondo_pcel_movimientos").delete().eq("pago_id", id);
    setFondoMov(prev => prev.filter(m => m.pago_id !== id));
    // Dicotech: revertir aplicaciones en fondos_mkt_movimientos
    await supabase.from("fondos_mkt_movimientos").delete().eq("pago_id", id);
    setDicoFondoMovs(prev => prev.filter(m => m.pago_id !== id));
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
    if (error) { toast.error("Error: " + error.message); return; }
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
    if (exportMeses.length === 0) return toast.error("Selecciona al menos un mes");
    const XLSX = await loadSheetJS();
    if (!XLSX) return toast.error("Error cargando librería Excel");

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
      return toast.error("No hay pagos por pagar en los meses seleccionados.");
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


  // ── Bitácora global (últimos cambios de todos los pagos del cliente) ──
  const verBitacoraGlobal = async () => {
    const ids = registros.map((r) => r.id).filter(Boolean);
    if (ids.length === 0) { setHistorialPago({ pago: null, entries: [] }); return; }
    const { data, error } = await supabase.from("pagos_audit")
      .select("*").in("pago_id", ids)
      .order("changed_at", { ascending: false }).limit(200);
    if (error) { toast.error("Error: " + error.message); return; }
    const conceptoDe = (id) => registros.find((r) => r.id === id)?.concepto || String(id);
    setHistorialPago({ pago: null, entries: data || [], conceptoDe });
  };

  // ── Registrar pago de Rebate trimestral (Digitalife) ──
  const registrarRebateQ = async (totalReb) => {
    if (!canEdit) return;
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
  };

  // ── Crear un mes faltante de un pago fijo existente ──
  const crearMesFijo = async (conceptoKey, mKey, records) => {
    if (!canEdit) return;
    const anioAct = new Date().getFullYear();
    const record = {
      folio: "",
      concepto: conceptoKey,
      categoria: "pagosFijos",
      cliente: clienteKey,
      monto: records[0]?.monto || 0,
      estatus: "pendiente",
      fecha_compromiso: `${anioAct}-${mKey}-01`,
      fecha_pago_real: null,
      responsable: records[0]?.responsable || null,
      notas: null,
      mes_fijo: Number(mKey),
      anio_fijo: anioAct,
    };
    const { data, error } = await supabase.from("pagos").insert(record).select().single();
    if (error) { flash("Error: " + error.message, "err"); return; }
    setRegistros(prev => [...prev, data]);
    flash(`${conceptoKey} · mes ${mKey} creado ✓`);
  };

  // ────────────────────────── RENDER ──────────────────────────────────────────
  const [vista, setVista] = useState("pendientes"); // pendientes · pagados · rebate · spiff · fondos
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const mesActualNum = hoy.getMonth() + 1;
  const nombreMesActual = MESES_LARGOS[hoy.getMonth()];
  const hoyISO = hoy.toISOString().slice(0, 10);
  const rebateTotalAcum = Math.round(Object.values(rebateAllQ).reduce((s, v) => s + v, 0));
  const tieneFondos = clienteKey === "dicotech" || clienteKey === "pcel";
  const edit = { editingCell, editValue, setEditValue, saveEdit, cancelEdit, startEdit };
  const mb = monthlyBreakdown();

  // Pendientes reales (no pagados / cancelados / futuros)
  const pendientesActivos = registros.filter(visibleEnTodas);
  const nPendientes = pendientesActivos.length;
  const vencidos = registros.filter(r => r.estatus === "vencido" || (["pendiente", "en_proceso"].includes(r.estatus) && r.fecha_compromiso && String(r.fecha_compromiso).slice(0, 10) < hoyISO));
  const en7 = (() => { const d = new Date(hoy); d.setDate(d.getDate() + 7); return d.toISOString().slice(0, 10); })();
  const vencenSemana = pendientesActivos.filter(r => r.fecha_compromiso && String(r.fecha_compromiso).slice(0, 10) >= hoyISO && String(r.fecha_compromiso).slice(0, 10) <= en7);
  const proximoVenc = pendientesActivos.map(r => r.fecha_compromiso && String(r.fecha_compromiso).slice(0, 10)).filter(f => f && f >= hoyISO).sort()[0] || null;
  const pagadosAnio = registros.filter(r => r.estatus === "pagado" && String(r.fecha_pago_real || r.fecha_compromiso || "").slice(0, 4) === String(anioActual));
  const pagadoYTD = pagadosAnio.reduce((s, r) => s + (r.monto || 0), 0);
  const enProceso = registros.filter(r => r.estatus === "en_proceso").reduce((s, r) => s + (r.monto || 0), 0);

  // Rebate / SPIFF del mes por cliente (para KPIs y narrativa)
  const qActual = mesActualNum <= 3 ? 1 : mesActualNum <= 6 ? 2 : mesActualNum <= 9 ? 3 : 4;
  const mesPrev = mesActualNum === 1 ? 12 : mesActualNum - 1;
  let rebateKpi = null, spiffKpi = null, rebatePendienteMes = null;
  if (clienteKey === "digitalife") {
    const sug = Math.round(rebateAllQ[qActual] || 0);
    rebateKpi = { titulo: `Rebate Q${qActual}`, big: formatMXN(sug), badge: rebateSynced[qActual] ? { l: "Registrado", tone: "green" } : sug > 0 ? { l: "Sugerido", tone: "blue" } : null, sub: `Monitores y sillas ${(REBATE_PCT.monitores * 100).toFixed(0)}% · accesorios ${(REBATE_PCT.accesorios * 100).toFixed(0)}% · acumulado ${formatMXN(rebateTotalAcum)}` };
    const c = spiffCalc?.find(x => x.mes === mesActualNum);
    if (c) spiffKpi = { titulo: `SPIFF ${MESES_CORTOS[mesActualNum - 1]}`, big: formatMXN(c.comision), badge: c.pagoExistente ? { l: c.pagoExistente.estatus === "pagado" ? "Pagado" : "Generado", tone: "green" } : c.aplica ? { l: "Cumple", tone: "green" } : c.soActual > 0 ? { l: "No cumple", tone: "red" } : null, sub: `SO ${formatMXN(c.soActual)} · alcance ${c.cuotaSOMin > 0 ? (c.alcance * 100).toFixed(0) : "—"}% · YTD ${formatMXN(spiffTotalYTD)}`, progress: c.cuotaSOMin > 0 ? c.alcance * 100 : null };
  } else if (clienteKey === "dicotech") {
    const m = dicoRebateCalc?.find(x => x.mes === mesActualNum);
    if (m) rebateKpi = { titulo: `Rebate ${MESES_CORTOS[mesActualNum - 1]}`, big: formatMXN(m.rebateAuto), badge: m.tier ? { l: `${(Number(m.tier.pct) * 100).toFixed(2)}%`, tone: m.cumple ? "green" : "orange" } : null, sub: `Alcance ${m.cuota > 0 ? (m.alcance * 100).toFixed(0) : "—"}% de ${formatMXN(m.cuota)} · YTD ${formatMXN(dicoRebateTotalYTD)}`, progress: m.cuota > 0 ? m.alcance * 100 : null };
    const prev = dicoRebateCalc?.find(x => x.mes === mesPrev);
    if (prev && prev.sellIn > 0 && !prev.pagoExistente && prev.rebateAuto > 0) rebatePendienteMes = prev.label;
    const c = spiffDicotechCalc?.find(x => x.mes === mesActualNum);
    if (c) spiffKpi = { titulo: `SPIFF ${MESES_CORTOS[mesActualNum - 1]}`, big: formatMXN(c.comisionSI), badge: c.pagoSI ? { l: c.pagoSI.estatus === "pagado" ? "Pagado" : "Generado", tone: "green" } : null, sub: `Compradora ${(spiffDicoCompradoraPct * 100).toFixed(3)}% · ${c.ganadores.length} vendedores califican · YTD ${formatMXN(spiffDicotechTotalYTD.si)}` };
  } else if (clienteKey === "pcel" && pcelCalc) {
    const q = pcelCalc.quarterly[qActual - 1];
    if (q) rebateKpi = { titulo: `Rebate Q${qActual}`, big: formatMXN(q.rebateAmount), badge: q.rebatePct > 0 ? { l: `${(q.rebatePct * 100).toFixed(2)}%`, tone: "green" } : { l: q.rebateLabel, tone: "orange" }, sub: `Alcance ${q.cuota > 0 ? (q.alcance * 100).toFixed(0) : "—"}% de ${formatMXN(q.cuota)} · fondo MKT ${formatMXN(q.fondoAmount)}`, progress: q.cuota > 0 ? q.alcance * 100 : null };
    const r = pcelCalc.monthly[mesActualNum - 1];
    if (r) spiffKpi = { titulo: `SPIFF ${MESES_CORTOS[mesActualNum - 1]}`, big: formatMXN(r.spiff), badge: { l: `${(SPIFF_PCT * 100).toFixed(2)}%`, tone: "purple" }, sub: `Sell In ${formatMXN(r.sellIn)} · alcance ${r.cuota > 0 ? (r.alcance * 100).toFixed(0) : "—"}% · total ${formatMXN(pcelCalc.totalSpiff)}`, progress: r.cuota > 0 ? r.alcance * 100 : null };
  }

  // Fondos por cliente
  let fondoCli = null, fondoInt = null;
  if (clienteKey === "dicotech" && dicoFondoTablaMensual) {
    const genCli = dicoFondoTablaMensual.filas.reduce((s, f) => s + f.genCli, 0);
    const apliCli = dicoFondoTablaMensual.filas.reduce((s, f) => s + f.apliCli, 0);
    const ultInt = [...dicoFondoMovs].filter(x => x.tipo_fondo === "interno").sort((a, b) => b.mes - a.mes)[0];
    fondoCli = { titulo: "Fondo MKT cliente", saldo: dicoFondoTablaMensual.saldoCliActual, usado: genCli > 0 ? (apliCli / genCli) * 100 : null, sub: `${formatMXN(apliCli)} aplicado de ${formatMXN(genCli)} generado` };
    fondoInt = { titulo: "Fondo interno", saldo: dicoFondoTablaMensual.saldoIntActual, sub: ultInt ? `Último mov.: ${ultInt.tipo_movimiento} ${formatMXN(Number(ultInt.monto))} · ${MESES_CORTOS[ultInt.mes - 1]}` : "Sin movimientos" };
  } else if (clienteKey === "pcel") {
    const ultDir = [...fondoResumen.ledger.directo].slice(-1)[0];
    fondoCli = { titulo: "Fondo MKT PCEL", saldo: fondoResumen.saldoMkt, usado: fondoResumen.entradasMkt > 0 ? (fondoResumen.gastosMkt / fondoResumen.entradasMkt) * 100 : null, sub: `+${formatMXN(fondoResumen.aporteMktAnio)} · −${formatMXN(fondoResumen.gastoMktAnio)} este año` };
    fondoInt = { titulo: "Fondo Directo", saldo: fondoResumen.saldoDirecto, sub: ultDir ? `Último mov.: ${ultDir.tipo_mov} ${formatMXN(Number(ultDir.monto))} · ${formatFecha(ultDir.fecha)}` : "Sin movimientos" };
  }
  const fondoSinComprobar = registros.filter(r => r.estatus === "en_proceso" && (r.fuente === "fondo_mkt" || r.categoria === "fondoMkt")).reduce((s, r) => s + (r.monto || 0), 0);

  // Frase narrativa por reglas
  const fraseHero = vencidos.length > 0
    ? `${vencidos.length} pago${vencidos.length !== 1 ? "s" : ""} vencido${vencidos.length !== 1 ? "s" : ""} por ${formatMXN(vencidos.reduce((s, r) => s + (r.monto || 0), 0))}.`
    : vencenSemana.length > 0
      ? `${vencenSemana.length} pago${vencenSemana.length !== 1 ? "s" : ""} vence${vencenSemana.length !== 1 ? "n" : ""} esta semana.`
      : rebatePendienteMes
        ? `Rebate de ${rebatePendienteMes} pendiente de generar.`
        : nPendientes > 0
          ? `${nPendientes} concepto${nPendientes !== 1 ? "s" : ""} por liberar este mes.`
          : "Todo al corriente.";
  const subHero = [
    `${formatMXN(totalPorPagar)} por liberar`,
    rebateKpi ? `${rebateKpi.titulo.toLowerCase()} sugerido ${rebateKpi.big}${rebateKpi.progress != null ? ` (${rebateKpi.progress.toFixed(0)}% de alcance)` : ""}` : null,
    fondoSinComprobar > 0 ? `${formatMXN(fondoSinComprobar)} de fondo sin comprobar` : enProceso > 0 ? `${formatMXN(enProceso)} en proceso` : null,
  ].filter(Boolean).join(" · ") + ".";

  const heroStats = [
    { k: "Por pagar", v: formatMXN(totalPorPagar), sub: `${registros.filter(r => ["pendiente", "en_proceso"].includes(r.estatus)).length} conceptos${proximoVenc ? ` · próx. ${formatFecha(proximoVenc)}` : ""}`, color: vencidos.length > 0 ? theme.red : theme.orange },
    { k: `Pagado ${anioActual}`, v: formatMXN(pagadoYTD), sub: `${pagadosAnio.length} pagos`, color: theme.green },
    fondoCli
      ? { k: fondoCli.titulo, v: formatMXN(fondoCli.saldo), sub: fondoSinComprobar > 0 ? `${formatMXN(fondoSinComprobar)} sin comprobar` : fondoCli.sub, color: fondoSinComprobar > 0 || fondoCli.saldo < 0 ? theme.orange : undefined }
      : { k: "Rebate acum.", v: formatMXN(rebateTotalAcum), sub: `${Object.values(rebateSynced).filter(Boolean).length} de 4 Qs registrados` },
  ];

  const kpis = [
    rebateKpi && { eyebrow: "Rebate del mes", ...rebateKpi, progressColor: theme.red, onClick: () => irA("rebate") },
    spiffKpi && { eyebrow: "SPIFF del mes", ...spiffKpi, progressColor: theme.purple, onClick: () => irA("spiff") },
    fondoCli && { eyebrow: fondoCli.titulo, big: formatMXN(fondoCli.saldo), bigColor: fondoCli.saldo < 0 ? theme.red : undefined, sub: fondoCli.usado != null ? `${fondoCli.usado.toFixed(0)}% usado · ${fondoCli.sub}` : fondoCli.sub, progress: fondoCli.usado, progressColor: theme.orange, onClick: () => irA("fondos") },
    fondoInt && { eyebrow: fondoInt.titulo, big: formatMXN(fondoInt.saldo), bigColor: fondoInt.saldo < 0 ? theme.red : undefined, sub: fondoInt.sub, onClick: () => irA("fondos") },
  ].filter(Boolean);

  function irA(v) {
    setVista(v);
    setTimeout(() => document.getElementById("pagos-detalle")?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  }

  const segOpts = [
    { id: "pendientes", label: "Pendientes", badge: nPendientes },
    { id: "pagados", label: "Pagados", badge: registros.filter(r => r.estatus === "pagado").length || undefined },
    { id: "rebate", label: "Rebate" },
    { id: "spiff", label: "SPIFF" },
    ...(tieneFondos ? [{ id: "fondos", label: "Fondos" }] : []),
  ];
  const catsFiltro = Object.entries(CATEGORIA_META)
    .filter(([key]) => !(clienteKey === "pcel" && key === "pagosFijos"))
    .filter(([, meta]) => !meta.soloPara || meta.soloPara.includes(clienteKey));

  const abrirExport = () => {
    const prev = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    const def = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
    setExportMeses(mb.some(m => m.mes === def) ? [def] : []);
    setExportModalOpen(true);
  };

  const lineamientosTipos = vista === "rebate" ? ["rebate"] : vista === "spiff" ? ["spiff"] : vista === "fondos" ? ["fondo_mkt"] : null;

  return (
    <div ref={rootRef} style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, padding: '10px 6px' }}>
      {loading ? <SkeletonPantalla pantalla="pagos" /> : (
        <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* 1 · Hero narrativo */}
          <Hero
            eyebrow={`Pagos · ${c.nombre} · ${nombreMesActual} ${anioActual}`}
            titulo={fraseHero}
            sub={subHero}
            stats={heroStats}
          >
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <Pill tone={DB_CONFIGURED ? 'green' : 'orange'} size="xs" dot>{DB_CONFIGURED ? 'Sincronizado' : 'Solo lectura'}</Pill>
              {!canEdit && <Pill tone="gray" size="xs">Modo lectura</Pill>}
              {saving && <Pill tone="blue" size="xs" dot>Guardando…</Pill>}
              {c.cartera?.ultimaActualizacion && <Pill tone="inverse" size="xs" style={{ background: 'transparent', color: theme.mode === 'dark' ? 'rgba(29,29,31,0.66)' : 'rgba(245,245,247,0.66)' }}>Actualizado {formatFecha(c.cartera.ultimaActualizacion)}{c.cartera?.tipoCambio ? ` · TC $${c.cartera.tipoCambio.toFixed(2)}` : ''}</Pill>}
            </div>
          </Hero>

          {/* 2 · KPIs del mes */}
          {kpis.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
              {kpis.map((k, i) => <KpiCard key={i} {...k} />)}
            </div>
          )}

          {!DB_CONFIGURED && (
            <Panel titulo="Configuración requerida para guardar cambios" meta="VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY">
              <Nota>Para que los cambios se guarden y sean visibles para el equipo, configura las variables en Vercel y la tabla en Supabase.</Nota>
            </Panel>
          )}

          {/* 3 · Barra de vistas + acciones */}
          <div id="pagos-detalle" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', scrollMarginTop: 12 }}>
            <Segmented value={vista} onChange={setVista} options={segOpts} />
            <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
              <ExportMenu
                titulo="Pagos"
                subtitulo={`${cliente?.nombre || clienteKey || ''} · resumen por mes y categoría`}
                pdf={{ ref: rootRef }}
                excel={() => ({
                  titulo: `Pagos ${cliente?.nombre || clienteKey || ''} · Resumen por mes y categoría`,
                  archivo: `Pagos ${cliente?.nombre || clienteKey || ''} resumen mensual`,
                  hojas: [{
                    nombre: 'Resumen mensual',
                    columnas: [
                      { label: 'Mes', key: 'mesLabel', tipo: 'texto', ancho: 12 },
                      { label: 'Promociones', key: 'promociones', tipo: 'moneda' },
                      { label: 'Marketing', key: 'marketing', tipo: 'moneda' },
                      { label: 'Pagos Fijos', key: 'pagosFijos', tipo: 'moneda' },
                      { label: 'P. Variables', key: 'pagosVariables', tipo: 'moneda' },
                      { label: 'Rebate', key: 'rebate', tipo: 'moneda' },
                      { label: 'Total', key: 'total', tipo: 'moneda' },
                    ],
                    filas: mb.map((m) => { const [yr, mo] = m.mes.split('-'); return { mesLabel: `${MESES_CORTOS[parseInt(mo, 10) - 1]} ${yr}`, promociones: m.promociones || null, marketing: m.marketing || null, pagosFijos: m.pagosFijos || null, pagosVariables: m.pagosVariables || null, rebate: m.rebate || null, total: m.total || 0 }; }),
                    totales: { mesLabel: 'TOTAL', promociones: mb.reduce((s, m) => s + (m.promociones || 0), 0), marketing: mb.reduce((s, m) => s + (m.marketing || 0), 0), pagosFijos: mb.reduce((s, m) => s + (m.pagosFijos || 0), 0), pagosVariables: mb.reduce((s, m) => s + (m.pagosVariables || 0), 0), rebate: mb.reduce((s, m) => s + (m.rebate || 0), 0), total: mb.reduce((s, m) => s + (m.total || 0), 0) },
                  }],
                })}
              />
              <Boton onClick={abrirExport} icon={Download} title="Excel de pagos por pagar de uno o varios meses">Por pagar</Boton>
              {DB_CONFIGURED && <Boton onClick={verBitacoraGlobal} icon={History}>Bitácora</Boton>}
              {DB_CONFIGURED && canEdit && (vista === 'pendientes' && catActiva === 'promociones'
                ? <NuevaPromocionButton clienteKey={clienteKey} onCreated={() => setPromosVer(v => v + 1)} />
                : <Boton primario onClick={() => { setVista('pendientes'); setShowAdd(v => !v); }} icon={Plus}>Pago</Boton>)}
            </span>
          </div>

          {/* 4 · Contenido de la vista */}
          {vista === 'pendientes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                <Pill tone={catActiva === 'todas' ? 'inverse' : 'gray'} onClick={() => setCatActiva('todas')}>Todas · {nPendientes}</Pill>
                {catsFiltro.map(([key, meta]) => {
                  const on = catActiva === key;
                  const count = key === 'pagosFijos' ? fijoRecords.length : registros.filter(r => r.categoria === key && esActivo(r)).length;
                  return <Pill key={key} tone={on ? meta.tone : 'gray'} dot={on} onClick={() => setCatActiva(on ? 'todas' : key)} style={on ? { outline: `1px solid ${meta.color}66` } : undefined}>{meta.label} · {count}</Pill>;
                })}
                <span style={{ marginLeft: 'auto', fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{filtered.length} registro{filtered.length !== 1 ? 's' : ''}</span>
              </div>

              {showAdd && DB_CONFIGURED && (
                <FormNuevoPago clienteKey={clienteKey} newRow={newRow} setNewRow={setNewRow} onSave={handleAdd} onCancel={() => setShowAdd(false)} dicoFondoTablaMensual={dicoFondoTablaMensual} />
              )}

              {catActiva === 'promociones' && <ListaPromociones clienteKey={clienteKey} refreshKey={promosVer} />}

              {catActiva === 'pagosFijos' ? (
                <PagosFijos fijoGroups={fijoGroups} canEdit={canEdit} dbOk={DB_CONFIGURED} edit={edit}
                  expandedFijos={expandedFijos} toggleFijo={toggleFijo} togglePagado={togglePagado} crearMesFijo={crearMesFijo} handleDeleteFijo={handleDeleteFijo}
                  showAddFijo={showAddFijo} setShowAddFijo={setShowAddFijo} newFijo={newFijo} setNewFijo={setNewFijo} handleAddFijo={handleAddFijo} />
              ) : (
                <Panel titulo={catActiva === 'todas' ? 'Pagos pendientes' : `${CATEGORIA_META[catActiva]?.label} · pendientes`} meta={`${filtered.length} concepto${filtered.length !== 1 ? 's' : ''} · ${formatMXN(filtered.reduce((s, r) => s + (r.monto || 0), 0))}`} padding="0">
                  <TablaPendientes filas={filtered} canEdit={canEdit} dbOk={DB_CONFIGURED} edit={edit} catActiva={catActiva}
                    togglePagado={togglePagado} verHistorial={verHistorial} handleDuplicate={handleDuplicate} handleDelete={handleDelete}
                    expandedPagoId={expandedPagoId} togglePagoExpand={togglePagoExpand} actividadesPorPago={actividadesPorPago} excluirActividadDePago={excluirActividadDePago} />
                </Panel>
              )}

              {showFijosSection && catActiva === 'todas' && Object.keys(fijoGroups).length > 0 && (
                <Panel plegable abiertoInicial={false} titulo="Pagos fijos" meta={`${Object.keys(fijoGroups).length} conceptos · ${fijoRecords.filter(esActivo).length} meses por pagar`} padding="8px 10px">
                  <PagosFijos fijoGroups={fijoGroups} canEdit={canEdit} dbOk={DB_CONFIGURED} edit={edit}
                    expandedFijos={expandedFijos} toggleFijo={toggleFijo} togglePagado={togglePagado} crearMesFijo={crearMesFijo} handleDeleteFijo={handleDeleteFijo}
                    showAddFijo={showAddFijo} setShowAddFijo={setShowAddFijo} newFijo={newFijo} setNewFijo={setNewFijo} handleAddFijo={handleAddFijo} />
                </Panel>
              )}
            </div>
          )}

          {vista === 'pagados' && (
            <HistorialPagados pagados={registros.filter(r => r.estatus === 'pagado')} catActiva="todas" canEdit={canEdit} onTogglePagado={togglePagado} />
          )}

          {vista === 'rebate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clienteKey === 'digitalife' && (
                <RebateDigitalife rebateQ={rebateQ} setRebateQ={setRebateQ} rebateLoading={rebateLoading} rebateData={rebateData} REBATE_PCT={REBATE_PCT} rebateSynced={rebateSynced}
                  canEdit={canEdit} actualizarRebatePago={actualizarRebatePago} borrarRebatePago={borrarRebatePago} registrarRebateQ={registrarRebateQ} anio={anioActual} />
              )}
              {clienteKey === 'dicotech' && dicoRebateCalc && (
                <RebateDicotech dicoRebateCalc={dicoRebateCalc} dicoRebateTotalYTD={dicoRebateTotalYTD} lineamientos={lineamientos} pctPorMes={pctPorMes} setPctPorMes={setPctPorMes}
                  canEdit={canEdit} generarRebateDicotech={generarRebateDicotech} marcarRebateDicotechNoAplica={marcarRebateDicotechNoAplica} revertirSpiff={revertirSpiff} anio={anioActual} />
              )}
              {clienteKey === 'pcel' && pcelCalc && (
                <RebatePcel pcelCalc={pcelCalc} pcelRebateTiers={pcelRebateTiers} pcelOverrideRebate={pcelOverrideRebate} setPcelOverrideRebate={setPcelOverrideRebate}
                  pcelOverrideFondo={pcelOverrideFondo} setPcelOverrideFondo={setPcelOverrideFondo} pcelPagosReg={pcelPagosReg} showPagoForm={showPagoForm} setShowPagoForm={setShowPagoForm}
                  pagoFormData={pagoFormData} setPagoFormData={setPagoFormData} guardarPagoPcel={guardarPagoPcel} canEdit={canEdit} anio={anioActual} />
              )}
              <Panel titulo="Rebate · registros" meta={`${registros.filter(r => r.categoria === 'rebate' && esActivo(r)).length} pendientes`} padding="0">
                <TablaPendientes filas={registros.filter(r => r.categoria === 'rebate' && esActivo(r))} canEdit={canEdit} dbOk={DB_CONFIGURED} edit={edit} catActiva="rebate"
                  togglePagado={togglePagado} verHistorial={verHistorial} handleDuplicate={handleDuplicate} handleDelete={handleDelete}
                  expandedPagoId={expandedPagoId} togglePagoExpand={togglePagoExpand} actividadesPorPago={actividadesPorPago} excluirActividadDePago={excluirActividadDePago} />
              </Panel>
            </div>
          )}

          {vista === 'spiff' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clienteKey === 'digitalife' && spiffCalc && (
                <SpiffDigitalife spiffCalc={spiffCalc} spiffTotalYTD={spiffTotalYTD} SPIFF_CUOTA_SO_FACTOR={SPIFF_CUOTA_SO_FACTOR} SPIFF_FLAT_PCT={SPIFF_FLAT_PCT} SPIFF_MIN_ALCANCE={SPIFF_MIN_ALCANCE}
                  spiffDigiTiersUnlocked={spiffDigiTiersUnlocked} setSpiffDigiTiersUnlocked={setSpiffDigiTiersUnlocked} guardarSpiffDigiConfig={guardarSpiffDigiConfig}
                  canEdit={canEdit} crearSpiffPago={crearSpiffPago} marcarSpiffNoAplica={marcarSpiffNoAplica} revertirSpiff={revertirSpiff} anio={anioActual} />
              )}
              {clienteKey === 'dicotech' && spiffDicotechCalc && (
                <SpiffDicotech spiffDicotechCalc={spiffDicotechCalc} spiffDicotechTotalYTD={spiffDicotechTotalYTD} spiffDicoCompradoraPct={spiffDicoCompradoraPct}
                  spiffPctUnlocked={spiffPctUnlocked} setSpiffPctUnlocked={setSpiffPctUnlocked} spiffPctInputRef={spiffPctInputRef} guardarSpiffDicoConfig={guardarSpiffDicoConfig}
                  canEdit={canEdit} crearSpiffDicotechPago={crearSpiffDicotechPago} marcarSpiffDicotechNoAplica={marcarSpiffDicotechNoAplica} revertirSpiff={revertirSpiff} anio={anioActual} />
              )}
              {clienteKey === 'pcel' && pcelCalc && (
                <SpiffPcel pcelCalc={pcelCalc} SPIFF_PCT={SPIFF_PCT} pcelOverrideSpiff={pcelOverrideSpiff} setPcelOverrideSpiff={setPcelOverrideSpiff} pcelPagosReg={pcelPagosReg}
                  showPagoForm={showPagoForm} setShowPagoForm={setShowPagoForm} pagoFormData={pagoFormData} setPagoFormData={setPagoFormData} guardarPagoPcel={guardarPagoPcel} canEdit={canEdit} anio={anioActual} />
              )}
              {(spiffLoading && !spiffCalc && !spiffDicotechCalc) && <Nota>Cargando datos de SPIFF…</Nota>}
              <Panel titulo="SPIFF · registros" meta={`${registros.filter(r => r.categoria === 'spiff' && esActivo(r)).length} pendientes`} padding="0">
                <TablaPendientes filas={registros.filter(r => r.categoria === 'spiff' && esActivo(r))} canEdit={canEdit} dbOk={DB_CONFIGURED} edit={edit} catActiva="spiff"
                  togglePagado={togglePagado} verHistorial={verHistorial} handleDuplicate={handleDuplicate} handleDelete={handleDelete}
                  expandedPagoId={expandedPagoId} togglePagoExpand={togglePagoExpand} actividadesPorPago={actividadesPorPago} excluirActividadDePago={excluirActividadDePago} />
              </Panel>
            </div>
          )}

          {vista === 'fondos' && tieneFondos && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {clienteKey === 'dicotech' && dicoFondoTablaMensual && (
                <FondosDicotech dicoFondoTablaMensual={dicoFondoTablaMensual} revertirMovimientoFondo={revertirMovimientoFondo} canEdit={canEdit} anio={anioActual} />
              )}
              {clienteKey === 'pcel' && (
                <FondosPcel fondoResumen={fondoResumen} fondoLoading={fondoLoading} canEdit={canEdit} setFondoForm={setFondoForm} setShowFondoForm={setShowFondoForm} eliminarMovimientoFondo={eliminarMovimientoFondo} />
              )}
            </div>
          )}

          {/* Lineamientos editables de la vista (fondo MKT / rebate / SPIFF) */}
          {lineamientosTipos && <LineamientosCliente clienteKey={clienteKey} tipos={lineamientosTipos} />}

          {/* 5 · Resumen por mes (calendario + tabla), plegado por default */}
          <ResumenMensual registros={registros} clienteKey={clienteKey} anio={anioActual} mb={mb} totalAnio={totalAnio}
            expandedMonth={expandedMonth} setExpandedMonth={setExpandedMonth} onAbrirExport={abrirExport} />
        </div>
      )}

      {/* Modales */}
      {exportModalOpen && (
        <ExportModal mbList={mb} registros={registros} exportMeses={exportMeses} setExportMeses={setExportMeses} onClose={() => setExportModalOpen(false)} onExportar={exportarMeses} />
      )}
      {historialPago && <BitacoraModal historial={historialPago} onClose={() => setHistorialPago(null)} />}
      {clienteKey === 'pcel' && showFondoForm && (
        <FondoPcelModal fondoForm={fondoForm} setFondoForm={setFondoForm} onClose={() => setShowFondoForm(false)} onSave={crearMovimientoFondo} />
      )}
    </div>
  );
}
