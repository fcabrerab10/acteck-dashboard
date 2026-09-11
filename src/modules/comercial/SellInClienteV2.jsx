// SellInClienteV2 · rediseño Apple V2
// ─ Hero editorial narrativo con 3 stats
// ─ 4 KPI cards planas (MTD · YTD · YoY · MoM)
// ─ Timeline lineal 3 líneas + filtros Q + sums row
// ─ Composición familia (barras planas ordenadas)
// ─ Tabla SKU con Sell In + Sell Out + Roadmap chip + Heat

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useRoadmap, useFacturacion, useFacturacionAll, useCuotasMensuales } from '../../lib/queries';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando, Panel, GraficaLineas, SelectorTrimestres, usePersistTrimestres, etiquetaTrimestres } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import { ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchAll as fetchAllCentral } from '../../lib/queries';
import RentabilidadBloque from './RentabilidadBloque';
import ComparadorPeriodos from './ComparadorPeriodos';
import ExportMenu from '../../components/ExportMenu';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const Q_MESES = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12], anio: [1,2,3,4,5,6,7,8,9,10,11,12] };

function paletteFromTheme(theme) {
  return {
    accent: theme.accent || '#007AFF',
    green:  theme.green  || '#34C759',
    orange: theme.orange || '#FF9500',
    red:    theme.red    || '#FF3B30',
    purple: theme.purple || '#AF52DE',
    pink:   theme.pink   || '#FF2D55',
    teal:   theme.teal   || '#5AC8FA',
    indigo: theme.indigo || '#5856D6',
  };
}

const fmt = {
  money: (n) => {
    if (n == null || !isFinite(n)) return '—';
    const a = Math.abs(Number(n));
    if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
    if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
    return `$${Math.round(n)}`;
  },
  pct: (n) => (n == null || !isFinite(n) ? '—' : `${Math.round(n)}%`),
  int: (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX')),
};

// Delegado al motor paginado PARALELO central (lib/queries.js).
async function fetchAll(table, select, applyFilter = (q) => q) {
  return fetchAllCentral(table, select, applyFilter);
}

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════
export default function SellInClienteV2({ clienteKey }) {
  const perfil = usePerfil();
  if (!puedeVerPestanaCliente(perfil, clienteKey, 'sellIn')) {
    return <SinAcceso motivo={`No tienes acceso a Sell In de ${clienteKey || 'este cliente'}.`} />;
  }
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';
  const rootRef = useRef(null); // raíz para exportar PDF

  const anio = new Date().getFullYear();
  const anioPrev = anio - 1;
  const mesActual = new Date().getMonth() + 1;

  // Multi-año para la tabla Detalle por SKU. Default: sólo año actual.
  // Los KPIs siguen usando (anio, anioPrev); estos años SIEMPRE se
  // incluyen en el fetch aunque el usuario los deseleccione, para no
  // romper el resto del módulo. Se guardan en aniosSel para renderizar
  // los chips y los bloques mensuales.
  const [aniosSel, setAniosSel] = useState(() => new Set([anioPrev, anio]));
  const aniosDisponibles = useMemo(() => {
    // Ventana fija: últimos 4 años ordenados ASC (izquierda → derecha).
    return [anio - 3, anio - 2, anio - 1, anio];
  }, [anio]);
  const toggleAnio = (y) => {
    setAniosSel((prev) => {
      const next = new Set(prev);
      if (next.has(y)) {
        if (next.size === 1) return prev; // no permitir 0 seleccionados
        next.delete(y);
      } else {
        next.add(y);
      }
      return next;
    });
  };
  // Años a pedir a la BD: unión de aniosSel + los que usan los KPIs.
  const aniosFetch = useMemo(() => {
    const s = new Set(aniosSel);
    s.add(anio); s.add(anioPrev);
    return Array.from(s).sort((a, b) => a - b);
  }, [aniosSel, anio, anioPrev]);
  // Años a renderizar en la tabla, ordenados ASC (2024, 2025, 2026).
  const aniosSelOrd = useMemo(() => Array.from(aniosSel).sort((a, b) => a - b), [aniosSel]);

  // Toggle "Consolidado": cuando está activo, la tabla Detalle por SKU
  // muestra ventas de TODOS los canales (mayoreo, e_commerce, distribuidor,
  // mostrador…) además del cliente actual, para que aparezcan SKUs que
  // solo se venden a clientes sin tab dedicado (Amazon, CVA, Mercado Libre…).
  // Los KPIs superiores del módulo SIGUEN filtrando por clienteKey — el
  // consolidado solo afecta la tabla.
  const [consolidado, setConsolidado] = useState(false);

  // Cache compartida via useQuery. Mantengo los nombres facturacion/roadmap/cuotas
  // para no romper el resto del módulo.
  const { data: facturacion = [], isLoading: facturacionLoading } =
    useFacturacion(clienteKey, aniosFetch, 'sku,anio,mes,piezas,monto,cliente_nombre,canal');
  // Data adicional para la tabla cuando el usuario activa "Consolidado".
  // Se pide sólo cuando consolidado=true para no gastar red en balde.
  const { data: facturacionAll = [] } =
    useFacturacionAll(aniosFetch, 'sku,anio,mes,piezas,monto,cliente_nombre,canal', consolidado);
  const { data: roadmap = [], isLoading: roadmapLoading } = useRoadmap();
  const { data: cuotas = [], isLoading: cuotasLoading } =
    useCuotasMensuales(clienteKey, anio);
  const [selloutDet, setSelloutDet] = useState([]);
  const [selloutLoading, setSelloutLoading] = useState(true);
  const loading = facturacionLoading || roadmapLoading || cuotasLoading || selloutLoading;
  // rango es un Set de trimestres seleccionados: subset de {'Q1','Q2','Q3','Q4'}
  // Un set vacío significa "Año completo"
  const [rango, setRango] = usePersistTrimestres(`sellIn:${clienteKey}`, () => new Set([getCurrentQ(mesActual)]));
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [familiaFilter, setFamiliaFilter] = useState(null); // click en familia filtra la tabla

  function getCurrentQ(m) {
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
  }

  // Meses seleccionados a partir del Set de rangos
  const mesesRango = useMemo(() => {
    if (!rango || rango.size === 0) return Q_MESES.anio;
    const set = new Set();
    for (const q of rango) (Q_MESES[q] || []).forEach(m => set.add(m));
    return Array.from(set).sort((a, b) => a - b);
  }, [rango]);

  // sellout_detalle sigue con fetch local (cliente-específico, rango dinámico).
  useEffect(() => {
    let cancel = false;
    setSelloutLoading(true);
    (async () => {
      // Vista agregada por sku+mes (v_sellout_detalle_sku_mes): ~4× menos filas
      // que el detalle diario y sin fechas/precios. El consumidor sólo agrega
      // por sku del año actual.
      const sod = await fetchAll('v_sellout_detalle_sku_mes', 'sku,anio,mes,piezas,monto',
        (q) => q.eq('cliente', clienteKey).in('anio', [anioPrev, anio]));
      if (cancel) return;
      setSelloutDet(sod);
      setSelloutLoading(false);
    })();
    return () => { cancel = true; };
  }, [clienteKey, anio, anioPrev]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  const cuotaPorMes = useMemo(() => {
    const m = new Map();
    for (const c of cuotas) m.set(Number(c.mes), { min: Number(c.cuota_min) || 0, ideal: Number(c.cuota_ideal) || 0 });
    return m;
  }, [cuotas]);

  // Agregados por mes/año (Sell In)
  const mensualPorAnio = useMemo(() => {
    const m = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    const p = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    for (const r of facturacion) {
      const y = Number(r.anio), i = Number(r.mes) - 1;
      if (i < 0 || i > 11) continue;
      if (m[y]) { m[y][i] += Number(r.monto) || 0; p[y][i] += Number(r.piezas) || 0; }
    }
    return { monto: m, piezas: p };
  }, [facturacion, anio, anioPrev]);

  // Sell Out por sku + agregado
  const selloutBySku = useMemo(() => {
    const map = new Map();
    for (const r of selloutDet) {
      if (Number(r.anio) !== anio) continue;
      const sku = String(r.sku || '').trim();
      if (!sku) continue;
      if (!map.has(sku)) map.set(sku, { monto: 0, piezas: 0 });
      const s = map.get(sku);
      s.monto += Number(r.monto) || 0;
      s.piezas += Number(r.piezas) || 0;
    }
    return map;
  }, [selloutDet, anio]);

  // KPIs
  const mesActualData = {
    monto: mensualPorAnio.monto[anio][mesActual - 1],
    piezas: mensualPorAnio.piezas[anio][mesActual - 1],
    prevMonto: mensualPorAnio.monto[anioPrev][mesActual - 1],
    prevPiezas: mensualPorAnio.piezas[anioPrev][mesActual - 1],
    cuota: cuotaPorMes.get(mesActual),
  };
  const totalYTD = useMemo(() => {
    let monto = 0, piezas = 0;
    for (let i = 0; i < mesActual; i++) {
      monto += mensualPorAnio.monto[anio][i];
      piezas += mensualPorAnio.piezas[anio][i];
    }
    return { monto, piezas };
  }, [mensualPorAnio, anio, mesActual]);
  const cuotaYTD = useMemo(() => {
    let min = 0, ideal = 0;
    for (let i = 0; i < mesActual; i++) {
      const c = cuotaPorMes.get(i + 1);
      if (c) { min += c.min; ideal += c.ideal; }
    }
    return { min, ideal };
  }, [cuotaPorMes, mesActual]);

  const pctMTD = mesActualData.cuota?.ideal ? (mesActualData.monto / mesActualData.cuota.ideal * 100) : null;
  const pctMTDmin = mesActualData.cuota?.min ? (mesActualData.monto / mesActualData.cuota.min * 100) : null;
  const pctYTD = cuotaYTD.ideal ? (totalYTD.monto / cuotaYTD.ideal * 100) : null;
  const pctYTDmin = cuotaYTD.min ? (totalYTD.monto / cuotaYTD.min * 100) : null;

  // Proyección mes actual anualizada: si estamos a mitad de Jul, escalamos al mes completo
  const hoyDate = new Date();
  const diasTranscurridos = (hoyDate.getFullYear() === anio && hoyDate.getMonth() + 1 === mesActual) ? hoyDate.getDate() : new Date(anio, mesActual, 0).getDate();
  const diasDelMes = new Date(anio, mesActual, 0).getDate();
  const factorProy = diasTranscurridos > 0 ? diasDelMes / diasTranscurridos : 1;
  const sellInMesProyectado = mesActualData.monto * factorProy;
  const yoyProyectado = mesActualData.prevMonto > 0 ? ((sellInMesProyectado - mesActualData.prevMonto) / mesActualData.prevMonto * 100) : null;
  const yoyMonto = mesActualData.prevMonto ? ((mesActualData.monto - mesActualData.prevMonto) / mesActualData.prevMonto * 100) : null;
  // FIX audit #1: yoyMonto engaña con mes parcial (compara MTD vs mes cerrado).
  // Cuando factorProy > 1.05 (queda >~15% del mes por facturar), usamos la
  // proyección para el KPI principal para no mostrar caídas artificiales.
  const yoyDisplay = factorProy > 1.05 ? yoyProyectado : yoyMonto;
  const yoyEsProyectado = factorProy > 1.05;
  const yoyPiezasDelta = mesActualData.prevPiezas ? mesActualData.piezas - mesActualData.prevPiezas : null;
  const momIdx = mesActual - 2;
  const momPrevMonto = momIdx < 0 ? mensualPorAnio.monto[anioPrev][11] : mensualPorAnio.monto[anio][momIdx];
  const momPrevPiezas = momIdx < 0 ? mensualPorAnio.piezas[anioPrev][11] : mensualPorAnio.piezas[anio][momIdx];
  const momPct = momPrevMonto ? ((mesActualData.monto - momPrevMonto) / momPrevMonto * 100) : null;
  const momPiezasDelta = momPrevPiezas ? mesActualData.piezas - momPrevPiezas : null;
  const momLabel = momIdx < 0 ? `${MESES_LARGO[11]} ${anioPrev}` : MESES_LARGO[momIdx];

  // Timeline data
  const timelineMeses = useMemo(() => {
    return Q_MESES.anio.map(m => ({
      mes: m,
      label: MESES[m - 1],
      sellIn: mensualPorAnio.monto[anio][m - 1],
      sellInPrev: mensualPorAnio.monto[anioPrev][m - 1],
      cuota: cuotaPorMes.get(m)?.ideal || 0,       // 30M · meta ideal
      cuotaMin: cuotaPorMes.get(m)?.min || 0,      // 25M · mínimo
      actual: m === mesActual,
      futuro: m > mesActual,
    }));
  }, [mensualPorAnio, anio, anioPrev, cuotaPorMes, mesActual]);

  const timelineSums = useMemo(() => {
    let s2026 = 0, s2025 = 0, cuota = 0, cuotaMin = 0;
    mesesRango.forEach(m => {
      s2026 += mensualPorAnio.monto[anio][m - 1];
      s2025 += mensualPorAnio.monto[anioPrev][m - 1];
      cuota += cuotaPorMes.get(m)?.ideal || 0;
      cuotaMin += cuotaPorMes.get(m)?.min || 0;
    });
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    const deltaCuota = cuota > 0 ? ((s2026 - cuota) / cuota * 100) : null;
    const deltaCuotaMin = cuotaMin > 0 ? ((s2026 - cuotaMin) / cuotaMin * 100) : null;
    return { s2026, s2025, cuota, cuotaMin, deltaYoY, deltaCuota, deltaCuotaMin };
  }, [mensualPorAnio, cuotaPorMes, mesesRango, anio, anioPrev]);

  // Familias YTD
  const familiasYTD = useMemo(() => {
    const map = new Map();
    for (const r of facturacion) {
      if (Number(r.anio) !== anio || Number(r.mes) > mesActual) continue;
      const rm = roadmapMap.get(r.sku);
      const raw = (rm?.familia || 'Sin familia').trim();
      const norm = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
      if (!map.has(norm)) map.set(norm, { name: norm, monto: 0, piezas: 0, skus: new Set() });
      const it = map.get(norm);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.skus.add(r.sku);
    }
    const arr = Array.from(map.values()).map((v) => ({ ...v, skus: v.skus.size })).sort((a, b) => b.monto - a.monto);
    const palette = [P.accent, P.orange, P.green, P.purple, P.pink, P.teal, P.indigo, theme.textMuted];
    return arr.slice(0, 8).map((v, i) => ({ ...v, color: palette[i % palette.length] }));
  }, [facturacion, roadmapMap, anio, mesActual, P, theme]);

  // Sell In matriz mensual multi-año + totales + Sell Out YTD por SKU.
  // piezasPorAnio: { [anio]: number[12] }. piezas legacy = piezas del año
  // actual (para no romper el sort por mes y para KPIs YoY que ya usan
  // .piezas[i] del año principal).
  // Fuente: consolidado ? todos los canales : solo cliente actual.
  const filasSKU = useMemo(() => {
    const acc = new Map();
    const emptyPorAnio = () => Object.fromEntries(aniosSelOrd.map((y) => [y, Array(12).fill(0)]));
    const facturacionSrc = consolidado ? facturacionAll : facturacion;
    // Matriz Sell In por mes (piezas) + montoSI YTD
    for (const r of facturacionSrc) {
      const y = Number(r.anio);
      if (!aniosSel.has(y)) continue;
      const sku = r.sku;
      if (!acc.has(sku)) acc.set(sku, { sku, piezas: Array(12).fill(0), piezasPorAnio: emptyPorAnio(), montoSI: 0, piezasSI: 0, montoSO: 0, piezasSO: 0 });
      const it = acc.get(sku);
      const mIdx = Number(r.mes) - 1;
      if (mIdx >= 0 && mIdx < 12) {
        if (it.piezasPorAnio[y]) it.piezasPorAnio[y][mIdx] += Number(r.piezas) || 0;
        if (y === anio) it.piezas[mIdx] += Number(r.piezas) || 0;
      }
      if (y === anio) {
        it.montoSI += Number(r.monto) || 0;
        it.piezasSI += Number(r.piezas) || 0;
      }
    }
    // Sell Out por sku (join)
    selloutBySku.forEach((v, sku) => {
      if (!acc.has(sku)) acc.set(sku, { sku, piezas: Array(12).fill(0), piezasPorAnio: emptyPorAnio(), montoSI: 0, piezasSI: 0, montoSO: 0, piezasSO: 0 });
      const it = acc.get(sku);
      it.montoSO = v.monto;
      it.piezasSO = v.piezas;
    });
    // Enriquecer con roadmap + calcular promedio y total
    const q = busqueda.trim().toUpperCase();
    const rows = [];
    acc.forEach((it) => {
      const rm = roadmapMap.get(it.sku) || {};
      const descripcion = rm.descripcion || '';
      const marca = rm.marca || '';
      const categoriaRaw = rm.categoria || '';
      const categoria = categoriaRaw ? categoriaRaw.charAt(0).toUpperCase() + categoriaRaw.slice(1).toLowerCase() : '';
      const familia = rm.familia || 'Sin familia';
      const rdmp = rm.rdmp || '';
      if (q) {
        const hay = `${it.sku} ${descripcion} ${marca} ${categoria}`.toUpperCase();
        if (!hay.includes(q)) return;
      }
      // Filtro por familia (click en Composición por familia)
      if (familiaFilter) {
        const famNorm = (familia || 'Sin familia').trim();
        const famCap = famNorm.charAt(0).toUpperCase() + famNorm.slice(1).toLowerCase();
        if (famCap !== familiaFilter) return;
      }
      // Total = suma de TODOS los años seleccionados; Promedio = avg de
      // meses cerrados con venta del año actual (referencia).
      const total = aniosSelOrd.reduce((s, y) => s + (it.piezasPorAnio[y] || []).reduce((a, b) => a + b, 0), 0);
      const cerrados = it.piezas.slice(0, mesActual - 1);
      const conVenta = cerrados.filter((v) => v > 0);
      const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
      const ratio = it.montoSI > 0 ? (it.montoSO / it.montoSI * 100) : null;
      rows.push({ ...it, descripcion, marca, categoria, familia, rdmp, total, promedio, ratio });
    });
    // Sort
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      const isString = ['sku', 'descripcion', 'marca', 'categoria', 'familia', 'rdmp'].includes(orden.col);
      const mesMatch = /^mes-(\d+)$/.exec(orden.col);
      const mesMatchAnio = /^mes-(\d{4})-(\d+)$/.exec(orden.col);
      if (isString) {
        rows.sort((a, b) => String(a[orden.col] || '').localeCompare(String(b[orden.col] || '')) * factor);
      } else if (mesMatchAnio) {
        const yy = Number(mesMatchAnio[1]);
        const i = Number(mesMatchAnio[2]);
        rows.sort((a, b) => (((a.piezasPorAnio?.[yy]?.[i] || 0) - (b.piezasPorAnio?.[yy]?.[i] || 0))) * factor);
      } else if (mesMatch) {
        const i = Number(mesMatch[1]);
        rows.sort((a, b) => ((a.piezas[i] || 0) - (b.piezas[i] || 0)) * factor);
      } else {
        rows.sort((a, b) => ((a[orden.col] || 0) - (b[orden.col] || 0)) * factor);
      }
    }
    return rows;
  }, [facturacion, facturacionAll, consolidado, selloutBySku, roadmapMap, busqueda, orden, anio, mesActual, familiaFilter, aniosSel, aniosSelOrd]);

  const toggleSort = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };

  // Estilos base
  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  if (loading) {
    return <Cargando pantalla="sellIn" label="Cargando Sell In…" sub={`Trayendo facturación de ${clienteKey}`} minHeight={480} />;
  }

  return (
    <div ref={rootRef} style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero */}
      <div style={{
        background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 20, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#EF4444' }} />
            Sell In · {MESES_LARGO[mesActual - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {narrativa(pctMTD)}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 400, lineHeight: 1.4, margin: 0 }}>
            {subnarrativa(mesActualData.monto, mesActualData.cuota?.ideal, familiasYTD[0], yoyDisplay)}
          </p>
        </div>
        <HeroStat k={`MTD ${MESES[mesActual - 1]}`} v={fmt.money(mesActualData.monto)} sub={pctMTD != null ? `${Math.round(pctMTD)}% cuota` : ''} />
        <HeroStat k={`YTD ${anio}`} v={fmt.money(totalYTD.monto)} sub={pctYTD != null ? `${Math.round(pctYTD)}% cuota` : ''} />
        <HeroStat k={yoyEsProyectado ? "YoY proy." : "YoY"} v={yoyDisplay != null ? `${yoyDisplay >= 0 ? '+' : ''}${yoyDisplay.toFixed(0)}%` : '—'} sub={yoyEsProyectado ? `vs ${anioPrev} · fin de mes` : `vs ${anioPrev}`} valColor={yoyDisplay == null ? undefined : yoyDisplay >= 0 ? P.green : P.red} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} P={P}
          eyebrow={`MTD · ${MESES[mesActual - 1]}`}
          badge={pctMTD != null ? { l: `${Math.round(pctMTD)}% ideal`, tone: pctMTD >= 100 ? 'good' : pctMTD >= 85 ? 'neutral' : 'warn' } : null}
          title="vs cuota mensual"
          big={fmt.money(mesActualData.monto)}
          bigSmall={mesActualData.cuota?.min ? `/ ${fmt.money(mesActualData.cuota.min)} mín · ${fmt.money(mesActualData.cuota.ideal)} ideal` : ''}
          sub={<>{fmt.int(mesActualData.piezas)} pzs · {pctMTDmin != null ? <><strong style={{ color: pctMTDmin >= 100 ? P.green : pctMTDmin >= 85 ? theme.text : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{Math.round(pctMTDmin)}%</strong> mín</> : ''}{yoyPiezasDelta != null ? <> · <strong style={{ color: yoyPiezasDelta >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{yoyPiezasDelta >= 0 ? '+' : ''}{fmt.int(yoyPiezasDelta)}</strong>pz vs {anioPrev}</> : ''}</>}
          progress={pctMTD}
          progressSecondary={pctMTDmin}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YTD Sell In · ${anio}`}
          badge={pctYTD != null ? { l: `${Math.round(pctYTD)}% ideal`, tone: pctYTD >= 100 ? 'good' : pctYTD >= 85 ? 'neutral' : 'warn' } : null}
          title="Facturación acumulada"
          big={fmt.money(totalYTD.monto)}
          bigSmall={cuotaYTD.min ? `/ ${fmt.money(cuotaYTD.min)} mín · ${fmt.money(cuotaYTD.ideal)} ideal` : ''}
          sub={<>{fmt.int(totalYTD.piezas)} pzs · {filasSKU.length} SKUs · {pctYTDmin != null ? <><strong style={{ color: pctYTDmin >= 100 ? P.green : pctYTDmin >= 85 ? theme.text : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{Math.round(pctYTDmin)}%</strong> mín</> : ''}</>}
          progress={pctYTD}
          progressSecondary={pctYTDmin}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YoY · ${MESES[mesActual - 1]}`}
          title={`vs ${anioPrev}`}
          big={yoyMonto != null ? `${yoyMonto >= 0 ? '+' : ''}${yoyMonto.toFixed(1)}%` : '—'}
          bigColor={yoyMonto == null ? theme.text : yoyMonto >= 0 ? P.green : P.red}
          sub={<>
            <div><strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(mesActualData.monto)}</strong> vs {fmt.money(mesActualData.prevMonto)}</div>
            {yoyProyectado != null && factorProy > 1.05 && (
              <div style={{ marginTop: 2 }}>
                Proyec. mes completo: <strong style={{ color: yoyProyectado >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{yoyProyectado >= 0 ? '+' : ''}{yoyProyectado.toFixed(1)}%</strong>
                <span style={{ color: theme.textSubtle || theme.textMuted }}> ({fmt.money(sellInMesProyectado)})</span>
              </div>
            )}
          </>}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`MoM · vs ${momLabel}`}
          title="vs mes anterior"
          big={momPct != null ? `${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%` : '—'}
          bigColor={momPct == null ? theme.text : momPct >= 0 ? P.green : P.red}
          sub={<><strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(mesActualData.monto)}</strong> vs {fmt.money(momPrevMonto)}{momPiezasDelta != null ? ` · ${momPiezasDelta >= 0 ? '+' : ''}${fmt.int(momPiezasDelta)}pz` : ''}</>}
        />
      </div>

      {/* Rentabilidad del cliente · medidas del director (v_erp_medidas_cliente_mes) */}
      <RentabilidadBloque anio={anio} mesMax={mesActual} clienteKey={clienteKey} titulo="Qué deja este cliente, del bruto a la utilidad." />

      {/* Comparador de periodos · A vs B (presets + libre) */}
      <ComparadorPeriodos clienteKey={clienteKey} />

      {/* Fila: Timeline lineal + Composición familia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10 }}>
        <TimelineLineal mesesRango={mesesRango} theme={theme} P={P} data={timelineMeses} sums={timelineSums} rango={rango} onChangeRango={setRango} anio={anio} anioPrev={anioPrev} mesActual={mesActual} />
        <FamiliaCard theme={theme} P={P} familias={familiasYTD} totalYTD={totalYTD} selected={familiaFilter} onSelect={setFamiliaFilter} />
      </div>

      {/* Tabla SKU */}
      <TablaSKU theme={theme} P={P}
        rows={filasSKU}
        busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)}
        aniosSel={aniosSelOrd} aniosDisponibles={aniosDisponibles} onToggleAnio={toggleAnio}
        anio={anio}
        consolidado={consolidado} onToggleConsolidado={() => setConsolidado((v) => !v)}
        facturacion={facturacion} facturacionAll={facturacionAll}
        pdfRef={rootRef} clienteKey={clienteKey}
      />
    </div>
  );
}

// ═══════════════ Helpers UI ═══════════════
function narrativa(pct) {
  if (pct == null) return 'Sin datos de sell in para este mes';
  if (pct >= 100) return `MTD ${(pct - 100).toFixed(1)}% arriba de cuota`;
  if (pct >= 85) return `MTD al ${Math.round(pct)}% de cuota`;
  return 'Falta un empujón para cerrar la cuota';
}
function subnarrativa(monto, cuota, marca, yoy) {
  const parts = [];
  if (monto > 0) parts.push(`${fmt.money(monto)} facturados`);
  if (cuota > 0) parts.push(`de ${fmt.money(cuota)} meta`);
  if (yoy != null) parts.push(`${yoy >= 0 ? '+' : ''}${yoy.toFixed(0)}% YoY`);
  if (marca) parts.push(`${marca.name} lideró`);
  return parts.length > 0 ? parts.join(' · ') : 'Carga la facturación para ver el resumen aquí.';
}

function HeroStat({ k, v, sub, valColor }) {
  return (
    <div style={{ textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: valColor || '#FFF', marginTop: 2 }}>{v}</div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>{sub}</div>}
    </div>
  );
}

function KpiCard({ theme, P, eyebrow, badge, title, big, bigSmall, bigColor, sub, progress, progressSecondary }) {
  const [hover, setHover] = useState(false);
  const badgeTone = badge?.tone;
  const badgeBg = badgeTone === 'good' ? `${P.green}22` : badgeTone === 'warn' ? `${P.orange}22` : `${theme.text}0F`;
  const badgeCol = badgeTone === 'good' ? P.green : badgeTone === 'warn' ? P.orange : theme.textMuted;
  const progColor = progress == null ? theme.textMuted : progress >= 100 ? P.green : progress >= 85 ? theme.text : P.orange;
  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
        transition: 'transform 200ms, box-shadow 200ms',
        transform: hover ? 'translateY(-1px)' : 'none',
        boxShadow: hover ? '0 4px 12px rgba(0,0,0,0.06)' : 'none',
        position: 'relative',
      }}
    >
      <ChevronRight size={13} style={{ position: 'absolute', top: 10, right: 12, color: theme.textSubtle || theme.textMuted }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</span>
        {badge && (
          <span style={{ padding: '2px 6px', borderRadius: 999, background: badgeBg, color: badgeCol, fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.06em' }}>{badge.l}</span>
        )}
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', margin: '0 0 8px', color: theme.text }}>{title}</div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: bigColor || theme.text }}>{big}</div>
        {bigSmall && <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 500, color: theme.textMuted }}>{bigSmall}</div>}
      </div>
      {sub && <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{sub}</div>}
      {progress != null && (
        <div style={{ marginTop: 8, position: 'relative', height: progressSecondary != null ? 8 : 3, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
          {progressSecondary != null && (
            <div title="vs cuota mínima" style={{ position: 'absolute', top: 0, left: 0, height: 3, width: `${Math.min(100, Math.max(0, progressSecondary))}%`, background: progressSecondary >= 100 ? P.green : progressSecondary >= 85 ? theme.text : P.orange, borderRadius: 999, transition: 'width 400ms', opacity: 0.55 }} />
          )}
          <div title="vs cuota ideal" style={{ position: 'absolute', bottom: 0, left: 0, height: 3, width: `${Math.min(100, Math.max(0, progress))}%`, background: progColor, borderRadius: 999, transition: 'width 400ms' }} />
        </div>
      )}
    </div>
  );
}

// ═══════════════ Timeline Lineal ═══════════════
function TimelineLineal({ theme, P, data, sums, rango, onChangeRango, anio, anioPrev, mesActual, mesesRango = [], cuotaSimple = false }) {
  // Serie completa del año: los meses fuera de los trimestres marcados se atenúan (no desaparecen).
  const datos = data.map((d) => ({ x: d.label, mes: d.mes, actual: d.futuro ? null : d.sellIn, anterior: d.sellInPrev, cuota: d.cuota > 0 ? d.cuota : null, cuotaMin: d.cuotaMin > 0 ? d.cuotaMin : null }));
  const series = [
    { key: 'actual', label: `SI ${anio}`, tipo: 'principal' },
    { key: 'anterior', label: `SI ${anioPrev}`, tipo: 'anterior' },
    { key: 'cuota', label: cuotaSimple ? 'Cuota' : 'Cuota ideal', tipo: 'cuota' },
    ...(cuotaSimple ? [] : [{ key: 'cuotaMin', label: 'Cuota mín', tipo: 'cuota', dash: '1 3' }]),
  ];
  const sel = new Set(mesesRango);
  const atenuados = datos.map((d, i) => (sel.has(d.mes) ? null : i)).filter((i) => i != null);
  const mesActivo = datos.findIndex((d) => d.mes === mesActual);
  const resumen = `${etiquetaTrimestres(rango)} · ${fmt.money(sums.s2026)} · ${mesesRango.length} ${mesesRango.length === 1 ? 'mes' : 'meses'}`;
  return (
    <Panel titulo="Evolución mensual · Sell In" meta="combina trimestres para sumar"
      acciones={<SelectorTrimestres value={rango} onChange={onChangeRango} resumen={resumen} />}>
      <div style={{ display: 'flex', gap: 12, padding: '2px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} dashed />SI {anioPrev}</>} v={fmt.money(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={P.accent} />SI {anio}</>} v={fmt.money(sums.s2026)} vColor={theme.text} />
        {!cuotaSimple && <SumStat theme={theme} k={<><Dot color={P.green} dashed />Cuota mín</>} v={fmt.money(sums.cuotaMin)} vColor={theme.text} />}
        <SumStat theme={theme} k={<><Dot color={P.green} dashed />{cuotaSimple ? 'Cuota' : 'Cuota ideal'}</>} v={fmt.money(sums.cuota)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ YoY" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
        )}
        {!cuotaSimple && sums.deltaCuotaMin != null && (
          <SumStat theme={theme} k="Δ vs mín" v={`${sums.deltaCuotaMin >= 0 ? '+' : ''}${sums.deltaCuotaMin.toFixed(1)}%`} vColor={sums.deltaCuotaMin >= 0 ? P.green : P.red} />
        )}
        {sums.deltaCuota != null && (
          <SumStat theme={theme} k={cuotaSimple ? 'Δ vs cuota' : 'Δ vs ideal'} v={`${sums.deltaCuota >= 0 ? '+' : ''}${sums.deltaCuota.toFixed(1)}%`} vColor={sums.deltaCuota >= 0 ? P.green : P.red} />
        )}
      </div>
      <GraficaLineas datos={datos} series={series} formato={fmt.money} alto={240} mesActivo={mesActivo} mesesAtenuados={atenuados} />
    </Panel>
  );
}

function Dot({ color, dashed }) {
  return (
    <span style={{ display: 'inline-block', width: 8, height: dashed ? 0 : 2, borderRadius: 1, background: dashed ? 'transparent' : color, borderTop: dashed ? `2px dashed ${color}` : 'none', marginRight: 4 }} />
  );
}
function SumStat({ theme, k, v, vColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: vColor || theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

// ═══════════════ Familia Card · donut ring + leyenda ═══════════════
function FamiliaCard({ theme, P, familias, totalYTD, selected, onSelect }) {
  const total = familias.reduce((s, f) => s + f.monto, 0);
  const anySelected = selected != null;
  // Donut geometry
  const size = 240, cx = size / 2, cy = size / 2, rOuter = 108, rInner = 76;
  const arcs = [];
  if (total > 0) {
    let acc = 0;
    for (const f of familias) {
      const startAng = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += f.monto;
      const endAng = (acc / total) * Math.PI * 2 - Math.PI / 2;
      const large = (endAng - startAng) > Math.PI ? 1 : 0;
      const x1 = cx + rOuter * Math.cos(startAng), y1 = cy + rOuter * Math.sin(startAng);
      const x2 = cx + rOuter * Math.cos(endAng),   y2 = cy + rOuter * Math.sin(endAng);
      const x3 = cx + rInner * Math.cos(endAng),   y3 = cy + rInner * Math.sin(endAng);
      const x4 = cx + rInner * Math.cos(startAng), y4 = cy + rInner * Math.sin(startAng);
      const d = `M ${x1} ${y1} A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2} L ${x3} ${y3} A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4} Z`;
      arcs.push({ d, color: f.color, name: f.name });
    }
  }
  const top1 = familias[0];
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Composición por familia · YTD
        </h5>
        {anySelected && (
          <button onClick={() => onSelect(null)}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer',
              fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 500, color: P.accent,
              padding: '2px 8px', borderRadius: 999,
            }}
            title="Quitar filtro"
          >Ver todas ›</button>
        )}
      </div>
      {familias.length === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin datos aún</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `${size + 12}px 1fr`, gap: 18, alignItems: 'center', marginTop: 4, flex: 1 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: size, height: size }}>
            <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size}>
              {arcs.map((a, i) => {
                const isActive = selected === a.name;
                const isDim = anySelected && !isActive;
                return (
                  <path key={i} d={a.d} fill={a.color}
                    opacity={isDim ? 0.35 : 1}
                    stroke={theme.surface} strokeWidth={isActive ? 2 : 1}
                    style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
                    onClick={() => onSelect(isActive ? null : a.name)} />
                );
              })}
            </svg>
            {/* Centro */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {anySelected ? (() => {
                const f = familias.find(x => x.name === selected);
                const pct = f && total > 0 ? (f.monto / total * 100) : 0;
                return (
                  <>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{selected}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</div>
                    <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{f ? fmt.money(f.monto) : '—'}</div>
                  </>
                );
              })() : (
                <>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>YTD</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(totalYTD.monto)}</div>
                  <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{familias.length} familias</div>
                </>
              )}
            </div>
          </div>
          {/* Leyenda · las filas se distribuyen para llenar la altura disponible */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'stretch', height: '100%' }}>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', marginBottom: 2 }}>click filtra tabla</div>
            {familias.map((f, i) => {
              const isActive = selected === f.name;
              const isDim = anySelected && !isActive;
              const pct = total > 0 ? (f.monto / total * 100) : 0;
              return (
                <div key={f.name}
                  onClick={() => onSelect(isActive ? null : f.name)}
                  style={{
                    display: 'grid', gridTemplateColumns: '12px 1fr auto auto', gap: 10, alignItems: 'center',
                    padding: '6px 10px', margin: '0 -10px', borderRadius: 8,
                    cursor: 'pointer', opacity: isDim ? 0.45 : 1,
                    background: isActive ? `${f.color}18` : 'transparent',
                    transition: 'background 160ms, opacity 160ms',
                    flex: 1, minHeight: 34,
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${theme.text}05`; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: f.color }} />
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: isActive ? 700 : 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme.text, fontWeight: 600, textAlign: 'right', minWidth: 64, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(f.monto)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════ Tabla SKU ═══════════════
// Devuelve las columnas originales del SellInCliente: Marca · SKU · Descripción
// · Categoría · Roadmap · 12 meses (piezas SI heat map) · Promedio · Total
// Al final agrega Sell Out YTD: Pzs SO · Monto SO · Ratio SO/SI
// Paleta por año — el año en curso usa accent iOS blue, los anteriores
// se distribuyen entre morado / gris / naranja para distinguirlos rápido.
function anioColor(y, aniosSel, P) {
  if (!aniosSel || aniosSel.length === 0) return P.accent;
  const anioNow = new Date().getFullYear();
  if (y === anioNow) return P.accent;
  const paleta = [P.purple, P.textMuted || '#8E8E93', P.orange, P.teal, P.pink];
  const prevYears = aniosSel.filter((yy) => yy !== anioNow).sort((a, b) => b - a);
  const idx = prevYears.indexOf(y);
  return paleta[idx % paleta.length] || P.textMuted || '#8E8E93';
}

function TablaSKU({ theme, P, rows, busqueda, onChangeBusqueda, orden, onToggleSort, familiaFilter, onClearFamilia, aniosSel = [], aniosDisponibles = [], onToggleAnio = () => {}, anio, consolidado = false, onToggleConsolidado = () => {}, facturacion = [], facturacionAll = [], pdfRef, clienteKey }) {
  const [skuAbierto, setSkuAbierto] = useState(null);
  const clienteLabel = clienteKey ? clienteKey.charAt(0).toUpperCase() + clienteKey.slice(1) : '';
  // Excel con las columnas visibles (años seleccionados / consolidado)
  const excelSKU = () => {
    const columnas = [
      { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 10 },
      { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 14 },
      { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 50 },
      { label: 'RDMP', key: 'rdmp', tipo: 'texto', ancho: 9 },
      ...aniosSel.flatMap((y) => MESES.map((m, i) => ({ label: `${m} ${y}`, key: `m_${y}_${i}`, tipo: 'numero', ancho: 9 }))),
      { label: 'Prom.', key: 'promedio', tipo: 'numero', ancho: 10 },
      { label: 'Total', key: 'total', tipo: 'numero', ancho: 10 },
    ];
    const totales = { marca: 'TOTAL', sku: `${rows.length} SKUs`, promedio: 0, total: 0 };
    const filas = rows.map((r) => {
      const o = { marca: r.marca || '', sku: r.sku, descripcion: r.descripcion || '', rdmp: r.rdmp || '', promedio: Math.round(r.promedio) || null, total: r.total || null };
      aniosSel.forEach((y) => (r.piezasPorAnio?.[y] || []).forEach((v, i) => { const k = `m_${y}_${i}`; o[k] = v || null; totales[k] = (totales[k] || 0) + (v || 0); }));
      totales.promedio += Math.round(r.promedio) || 0; totales.total += r.total || 0;
      return o;
    });
    return {
      titulo: `Sell In ${clienteLabel}${consolidado ? ' · Todos los canales' : ''}`,
      archivo: `Sell In ${clienteLabel} ${aniosSel.join('-')}`,
      hojas: [{ nombre: 'Detalle por SKU', subtitulo: `${aniosSel.join(' · ')}${familiaFilter ? ` · Familia ${familiaFilter}` : ''}`, columnas, filas, totales }],
    };
  };
  const isDark = theme.mode === 'dark';
  // Max celda (piezas mensuales) para heat coloring
  const maxCelda = useMemo(() => {
    let m = 0;
    for (const r of rows) for (const v of r.piezas) if (v > m) m = v;
    return m || 1;
  }, [rows]);

  // Heat pill · Apple iOS blue con 4 intensidades
  const heatCell = (v) => {
    if (v == null || v === 0) return null;
    if (v < 0) return { bg: `${P.red}22`, color: P.red, weight: 600 };
    const r = v / maxCelda;
    const b = P.accent;
    if (r > 0.75) return { bg: b, color: '#FFF', weight: 600 };
    if (r > 0.50) return { bg: isDark ? 'rgba(10,132,255,0.45)' : `${b}59`, color: '#FFF', weight: 600 };
    if (r > 0.25) return { bg: `${b}2E`, color: theme.text };
    return { bg: `${b}14`, color: theme.textMuted };
  };

  const roadmapChip = (r) => {
    if (!r) return null;
    const key = String(r).toUpperCase();
    const map = {
      RMI:  { bg: `${P.teal}22`,   color: P.teal },
      RML:  { bg: `${P.purple}22`, color: P.purple },
      RMS:  { bg: `${P.pink}22`,   color: P.pink },
      '2026': { bg: `${P.orange}22`, color: P.orange },
    };
    const style = map[key] || { bg: `${theme.text}0F`, color: theme.textMuted };
    return (
      <span style={{ padding: '2px 6px', borderRadius: 4, fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', ...style }}>
        {r}
      </span>
    );
  };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${theme.divider || theme.border}`, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Detalle por SKU
        </h5>
        {familiaFilter && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '4px 10px 4px 10px', borderRadius: 999,
            background: `${P.accent}18`, border: `1px solid ${P.accent}40`,
            color: P.accent, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600,
          }}>
            Familia: {familiaFilter}
            <button onClick={onClearFamilia}
              style={{
                background: 'transparent', border: 0, cursor: 'pointer', padding: 0,
                color: P.accent, fontSize: 14, lineHeight: 1, marginLeft: 2,
              }}
              title="Quitar filtro"
            >×</button>
          </span>
        )}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px',
          background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
          border: `1px solid ${theme.border}`, borderRadius: 999, height: 28,
          fontSize: 11, color: theme.textMuted, flex: 1, maxWidth: 280,
        }}>
          <Search size={12} />
          <input value={busqueda} onChange={(e) => onChangeBusqueda(e.target.value)}
            placeholder="Buscar SKU, descripción, marca…"
            style={{ border: 0, outline: 0, background: 'transparent', flex: 1, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text }} />
        </div>
        {/* Multi-select de años · segmented control estilo iOS */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 2,
          padding: 2, background: theme.mode === 'dark' ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)',
          borderRadius: 9, height: 30,
        }}>
          {aniosDisponibles.map((y) => {
            const on = aniosSel.includes(y);
            const col = anioColor(y, aniosSel, P);
            return (
              <button key={y} onClick={() => onToggleAnio(y)} title={on ? 'Quitar año' : 'Agregar año'}
                style={{
                  padding: '4px 12px', borderRadius: 7, cursor: 'pointer',
                  background: on
                    ? (theme.mode === 'dark' ? 'rgba(99,99,102,0.9)' : '#FFFFFF')
                    : 'transparent',
                  color: on ? col : (theme.mode === 'dark' ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)'),
                  border: 0,
                  boxShadow: on ? '0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)' : 'none',
                  fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: on ? 700 : 500,
                  letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums',
                  transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
                }}>{y}</button>
            );
          })}
        </div>
        {/* Toggle Consolidado — muestra ventas de TODOS los canales */}
        <button
          onClick={onToggleConsolidado}
          title={consolidado ? 'Volver a mostrar solo este cliente' : 'Mostrar ventas de todos los canales (mayoreo, e-commerce, distribuidor, etc.)'}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 999, cursor: 'pointer',
            background: consolidado ? P.accent : 'transparent',
            color: consolidado ? '#FFF' : theme.textMuted,
            border: `1px solid ${consolidado ? P.accent : theme.border}`,
            fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600,
            letterSpacing: '-0.005em', height: 30,
            transition: 'all 180ms cubic-bezier(0.4, 0, 0.2, 1)',
          }}>
          <span style={{
            width: 6, height: 6, borderRadius: 50,
            background: consolidado ? '#FFF' : theme.textMuted,
          }} />
          {consolidado ? 'Todos los canales' : 'Solo este cliente'}
        </button>

        <span style={{ marginLeft: 'auto', fontFamily: TYPO.fontDisplay, fontSize: 11, color: theme.textMuted, fontWeight: 500, letterSpacing: '-0.005em' }}>
          <strong style={{ color: theme.text, fontWeight: 600 }}>{rows.length}</strong> SKUs
        </span>
        <ExportMenu titulo="Sell In" subtitulo={`${clienteLabel} · ${aniosSel.join(' · ')}`} excel={excelSKU} pdf={{ ref: pdfRef }} deshabilitado={!rows.length} />
      </div>
      <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <SortableHeader theme={theme} col="marca" label="Marca" orden={orden} onToggleSort={onToggleSort} align="left" width={90} rowSpan={2} />
              <SortableHeader theme={theme} col="sku" label="SKU" orden={orden} onToggleSort={onToggleSort} align="left" width={100} rowSpan={2} />
              <SortableHeader theme={theme} col="descripcion" label="Descripción" orden={orden} onToggleSort={onToggleSort} align="left" rowSpan={2} />
              <SortableHeader theme={theme} col="rdmp" label="RDMP" orden={orden} onToggleSort={onToggleSort} align="left" width={68} rowSpan={2} />
              {aniosSel.map((y) => {
                const col = anioColor(y, aniosSel, P);
                const isCurrent = y === anio;
                return (
                  <th key={`band-${y}`} colSpan={12} style={{
                    position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
                    padding: '6px 12px', textAlign: 'left',
                    borderBottom: `1px solid ${theme.divider || theme.border}`,
                    borderLeft: `1px solid ${theme.divider || theme.border}`,
                  }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 5,
                      padding: '2px 9px 2px 7px', borderRadius: 999,
                      background: `${col}14`,
                      fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700,
                      color: col, letterSpacing: '-0.005em', textTransform: 'none',
                      fontVariantNumeric: 'tabular-nums',
                    }}>
                      <span style={{ width: 6, height: 6, borderRadius: 50, background: col }} />
                      {y}
                      {isCurrent && <span style={{ fontSize: 8.5, fontWeight: 600, opacity: 0.7, letterSpacing: '0.04em', textTransform: 'uppercase' }}>· actual</span>}
                    </span>
                  </th>
                );
              })}
              <SortableHeader theme={theme} col="promedio" label="Prom." orden={orden} onToggleSort={onToggleSort} align="right" width={60} rowSpan={2} />
              <SortableHeader theme={theme} col="total" label="Total" orden={orden} onToggleSort={onToggleSort} align="right" width={70} rowSpan={2} />
            </tr>
            <tr>
              {aniosSel.map((y) => (
                MESES.map((m, i) => (
                  <SortableHeader
                    key={`${y}-${m}`}
                    theme={theme}
                    col={y === anio ? `mes-${i}` : `mes-${y}-${i}`}
                    label={m}
                    orden={orden} onToggleSort={onToggleSort}
                    align="right" width={44}
                    topOffset={28}
                    borderLeft={i === 0 ? `2px solid ${theme.divider || theme.border}` : undefined}
                  />
                ))
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => {
              const abierto = skuAbierto === r.sku;
              const totalCols = 4 + aniosSel.length * 12 + 2;
              return (
                <React.Fragment key={r.sku}>
                  <tr
                    onClick={() => setSkuAbierto((prev) => prev === r.sku ? null : r.sku)}
                    style={{
                      borderTop: `1px solid ${theme.divider || theme.border}`,
                      cursor: 'pointer',
                      background: abierto ? (isDark ? 'rgba(10,132,255,0.06)' : 'rgba(0,122,255,0.04)') : 'transparent',
                    }}>
                    <td style={cellStyle(theme, 'left')}>{r.marca || '—'}</td>
                    <td style={{ ...cellStyle(theme, 'left'), display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: theme.textMuted, fontSize: 10, transition: 'transform 150ms', transform: abierto ? 'rotate(90deg)' : 'rotate(0)' }}>▸</span>
                      {r.sku}
                    </td>
                    <td style={{ ...cellStyle(theme, 'left'), maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
                    <td style={cellStyle(theme, 'left')}>{roadmapChip(r.rdmp) || '—'}</td>
                    {aniosSel.map((y) => (
                      (r.piezasPorAnio?.[y] || Array(12).fill(0)).map((v, i) => {
                        const h = heatCell(v);
                        return (
                          <td key={`${y}-${i}`} style={{
                            ...cellStyle(theme, 'right'), padding: '4px 6px',
                            fontFamily: '"SF Mono", ui-monospace, monospace',
                            borderLeft: i === 0 ? `2px solid ${theme.divider || theme.border}` : undefined,
                          }}>
                            {h ? (
                              <span style={{
                                display: 'inline-block', padding: '3px 7px', borderRadius: 6,
                                background: h.bg, color: h.color, fontWeight: h.weight || 500,
                                minWidth: 30, textAlign: 'right',
                              }}>{fmt.int(v)}</span>
                            ) : (
                              <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>
                            )}
                          </td>
                        );
                      })
                    ))}
                    <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{r.promedio > 0 ? fmt.int(Math.round(r.promedio)) : '—'}</td>
                    <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600 }}>{r.total > 0 ? fmt.int(r.total) : '—'}</td>
                  </tr>
                  {abierto && (
                    <tr>
                      <td colSpan={totalCols} style={{ padding: '0 0 12px', background: isDark ? 'rgba(10,132,255,0.03)' : 'rgba(0,122,255,0.02)' }}>
                        <DrillClientesSKU
                          sku={r.sku}
                          theme={theme} P={P} isDark={isDark}
                          facturacion={consolidado ? facturacionAll : facturacion}
                          aniosSel={aniosSel}
                        />
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
        {rows.length > 500 && (
          <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, color: theme.textMuted, borderTop: `1px solid ${theme.divider || theme.border}` }}>
            Mostrando 500 de {rows.length} · usa el buscador para filtrar
          </div>
        )}
      </div>
    </div>
  );
}

function SortableHeader({ theme, col, label, orden, onToggleSort, align, width, rowSpan, borderLeft, topOffset = 0 }) {
  const active = orden.col === col;
  const Icon = !active ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th rowSpan={rowSpan} style={{
      position: 'sticky', top: topOffset, background: theme.surface, zIndex: 1,
      textAlign: align, padding: '9px 10px',
      fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 9.5,
      textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted,
      borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width,
      ...(borderLeft ? { borderLeft } : {}),
    }}>
      <button onClick={() => onToggleSort(col)}
        style={{
          background: 'transparent', border: 0, padding: 0,
          fontFamily: 'inherit', fontSize: 'inherit', textTransform: 'inherit', letterSpacing: 'inherit',
          color: active ? theme.text : 'inherit', fontWeight: active ? 700 : 600,
          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        }}>
        {label}
        <Icon size={11} />
      </button>
    </th>
  );
}

function cellStyle(theme, align) {
  return {
    padding: '7px 10px', fontSize: 11.5, fontFamily: TYPO.fontText, color: theme.text,
    textAlign: align, whiteSpace: 'nowrap',
  };
}

// ═══════════════════════════════════════════════════════════════════
// Drill inline: clientes que se llevan el SKU · heatmap Pareto 80%
// Estilo S&OP. Ventana = últimos 6 meses cerrados (inclusive el actual).
// Fuente = facturacion filtrada por SKU. Agrupa por cliente_nombre.
// ═══════════════════════════════════════════════════════════════════
function DrillClientesSKU({ sku, theme, P, isDark, facturacion, aniosSel }) {
  const MESES_S = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const CANAL_COL = {
    MAYOREO: P.purple, DISTRIBUIDOR: P.accent || '#007AFF',
    'E-COMMERCE': P.teal || '#5AC8FA', MOSTRADOR: P.green || '#34C759',
    'RETAIL PROPIOS': P.pink || '#FF375F', 'RETAIL REPRESENTADOS': P.orange || '#FF9500',
  };

  const { pareto, cola, colaMensual, colaTotal, colaPct, totalesMes, grandTotal, meses } = React.useMemo(() => {
    // Ventana 6 meses hacia atrás desde el mes actual
    const hoy = new Date();
    const mm = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
      mm.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
    }
    const idxOf = (a, m) => mm.findIndex((x) => x.anio === a && x.mes === m);
    const byCli = new Map();
    for (const r of facturacion) {
      if (r.sku !== sku) continue;
      const i = idxOf(Number(r.anio), Number(r.mes));
      if (i < 0) continue;
      const key = r.cliente_nombre || '(sin nombre)';
      if (!byCli.has(key)) byCli.set(key, { cliente: key, canal: r.canal || '', mensual: Array(6).fill(0), total: 0 });
      const it = byCli.get(key);
      it.mensual[i] += Number(r.piezas) || 0;
      it.total += Number(r.piezas) || 0;
      if (!it.canal && r.canal) it.canal = r.canal;
    }
    const arr = Array.from(byCli.values())
      .filter((c) => c.total > 0)
      .sort((a, b) => b.total - a.total);
    const grand = arr.reduce((s, x) => s + x.total, 0);
    let acum = 0, corte = 0;
    const withAcum = arr.map((c) => {
      const pct = grand > 0 ? (c.total / grand) * 100 : 0;
      acum += pct;
      return { ...c, pct, pctAcum: acum };
    });
    for (let i = 0; i < withAcum.length; i++) {
      if ((withAcum[i].pctAcum || 0) >= 80) { corte = i + 1; break; }
    }
    if (corte === 0 && withAcum.length > 0) corte = withAcum.length;
    const par = withAcum.slice(0, corte);
    const col = withAcum.slice(corte);
    const colMen = Array(6).fill(0).map((_, i) => col.reduce((s, c) => s + (c.mensual[i] || 0), 0));
    const colTot = col.reduce((s, c) => s + c.total, 0);
    const colPct = grand > 0 ? (colTot / grand) * 100 : 0;
    const totMes = Array(6).fill(0).map((_, i) => withAcum.reduce((s, c) => s + (c.mensual[i] || 0), 0));
    return { pareto: par, cola: col, colaMensual: colMen, colaTotal: colTot, colaPct: colPct, totalesMes: totMes, grandTotal: grand, meses: mm };
  }, [facturacion, sku]);

  const [mostrarCola, setMostrarCola] = React.useState(false);
  const totalMaxMes = Math.max(0, ...totalesMes);

  if (pareto.length === 0 && cola.length === 0) {
    return (
      <div style={{ padding: '14px 20px', color: theme.textMuted, fontSize: 11, fontFamily: TYPO.fontDisplay, textAlign: 'center' }}>
        No hay ventas del SKU {sku} en los últimos 6 meses.
      </div>
    );
  }

  const nivel = (v, max) => {
    if (!v || v <= 0 || !max) return 0;
    const r = v / max;
    if (r < 0.15) return 1;
    if (r < 0.35) return 2;
    if (r < 0.60) return 3;
    if (r < 0.85) return 4;
    return 5;
  };
  const heatBg = (lv) => {
    if (lv === 0) return 'transparent';
    const alphas = [0, 0.05, 0.11, 0.20, 0.30, 0.44];
    return isDark ? `rgba(10,132,255,${alphas[lv]})` : `rgba(0,122,255,${alphas[lv]})`;
  };
  const heatCol = (lv) => (lv >= 4 ? (P.accent || '#007AFF') : theme.text);
  const HeatCell = ({ v, max }) => {
    if (!v || v <= 0) return <span style={{ color: theme.textSubtle || theme.textMuted, fontSize: 11 }}>—</span>;
    const lv = nivel(v, max);
    return (
      <span style={{
        display: 'inline-block', padding: '2px 7px', borderRadius: 999,
        background: heatBg(lv), color: heatCol(lv),
        fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
        fontSize: 11, fontWeight: lv >= 4 ? 700 : 500,
        letterSpacing: '-0.01em', minWidth: 34, textAlign: 'center', lineHeight: 1.3,
      }}>{Math.round(v).toLocaleString('es-MX')}</span>
    );
  };
  const NumPillC = ({ value, strong }) => {
    const n = Number(value || 0);
    if (!n) return <span style={{ color: theme.textSubtle || theme.textMuted, fontSize: 11 }}>—</span>;
    return (
      <span style={{
        display: 'inline-block', padding: '2px 7px', borderRadius: 999,
        background: isDark ? `rgba(10,132,255,${strong ? 0.11 : 0.05})` : `rgba(0,122,255,${strong ? 0.11 : 0.05})`,
        color: theme.text, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
        fontSize: strong ? 11.5 : 11, fontWeight: strong ? 700 : 500,
        letterSpacing: '-0.01em', minWidth: 34, textAlign: 'center', lineHeight: 1.3,
      }}>{Math.round(n).toLocaleString('es-MX')}</span>
    );
  };
  const PctPill = ({ pct }) => (
    <span style={{
      display: 'inline-block', padding: '1px 6px', borderRadius: 999,
      background: isDark ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.12)',
      color: P.orange || '#FF9500', fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums',
      fontSize: 10, fontWeight: 700, minWidth: 32, textAlign: 'center',
    }}>{pct >= 1 ? `${Math.round(pct)}%` : pct > 0 ? `${pct.toFixed(1)}%` : '—'}</span>
  );

  const th = { padding: '5px 6px', fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: 'right' };
  const thL = { ...th, textAlign: 'left' };
  const td = { padding: '3px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.divider || theme.border}` };
  const tdL = { ...td, textAlign: 'left' };
  const orange = P.orange || '#FF9500';

  const renderFila = (p, i, esMenor = false) => {
    const maxCli = Math.max(0, ...p.mensual);
    const canalKey = String(p.canal || '').toUpperCase();
    const canalCol = CANAL_COL[canalKey] || theme.textMuted;
    return (
      <tr key={`${i}-${p.cliente}`}>
        <td style={{ ...tdL, padding: '4px 6px 4px 8px', fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, fontWeight: 600, fontVariantNumeric: 'tabular-nums', width: 22 }}>
          {i + 1}
        </td>
        <td style={tdL}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, paddingLeft: esMenor ? 12 : 0 }}>
            <span style={{ width: 6, height: 6, borderRadius: 50, background: canalCol, flex: '0 0 6px' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, letterSpacing: '-0.01em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 240 }}>{p.cliente}</div>
              {canalKey && (
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginTop: 1, lineHeight: 1.1 }}>
                  {canalKey}
                </div>
              )}
            </div>
          </div>
        </td>
        {p.mensual.map((v, mi) => (
          <td key={mi} style={td}><HeatCell v={v} max={maxCli} /></td>
        ))}
        <td style={td}><NumPillC value={p.total / 6} /></td>
        <td style={td}><NumPillC value={p.total} strong /></td>
        <td style={td}><PctPill pct={p.pct} /></td>
        <td style={{ ...td, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
          {(p.pctAcum ?? 0).toFixed(1)}%
        </td>
      </tr>
    );
  };

  return (
    <div style={{
      margin: '4px 16px 0', padding: '10px 14px',
      background: theme.surface, border: `1px solid ${theme.divider || theme.border}`,
      borderRadius: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 6, marginBottom: 2, borderBottom: `1px solid ${theme.divider || theme.border}`, gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>Consumo por cliente · Pareto 80%</span>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 500 }}>
            {pareto.length + cola.length} clientes · últimos 6 meses · intensidad = mes vs pico del cliente
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}>
          <span>−</span>
          {[0.05, 0.11, 0.20, 0.30, 0.44].map((a, i) => (
            <span key={i} style={{ width: 12, height: 8, borderRadius: 2, background: isDark ? `rgba(10,132,255,${a})` : `rgba(0,122,255,${a})` }} />
          ))}
          <span>+</span>
          <span style={{ width: 1, height: 10, background: theme.divider || theme.border, margin: '0 3px' }} />
          <span style={{ padding: '1px 6px', borderRadius: 999, background: isDark ? 'rgba(255,159,10,0.14)' : 'rgba(255,149,0,0.12)', color: orange, fontSize: 9, fontWeight: 700 }}>80%</span>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={{ ...thL, width: 22 }}>#</th>
              <th style={thL}>Cliente</th>
              {meses.map((m, i) => <th key={i} style={th}>{MESES_S[m.mes - 1]}</th>)}
              <th style={th}>Prom /m</th>
              <th style={th}>Total</th>
              <th style={th}>%</th>
              <th style={th}>Acum</th>
            </tr>
          </thead>
          <tbody>
            {pareto.map((p, i) => renderFila(p, i))}
            {cola.length > 0 && (
              <tr>
                <td colSpan={meses.length + 6} style={{ padding: 0 }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '5px 8px',
                    background: isDark ? 'rgba(255,159,10,0.05)' : 'rgba(255,149,0,0.04)',
                    borderTop: `1px dashed ${orange}`, borderBottom: `1px dashed ${orange}`,
                  }}>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.10em', textTransform: 'uppercase', color: orange }}>Corte Pareto · 80%</span>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 500 }}>
                      {pareto.length} cliente{pareto.length === 1 ? '' : 's'} concentran el {(pareto[pareto.length - 1]?.pctAcum ?? 0).toFixed(1)}% de la venta
                    </span>
                  </div>
                </td>
              </tr>
            )}
            {cola.length > 0 && (
              <tr
                onClick={(e) => { e.stopPropagation(); setMostrarCola((v) => !v); }}
                style={{ cursor: 'pointer', background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}
              >
                <td style={{ ...tdL, padding: '4px 6px 4px 8px', color: P.accent, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, fontWeight: 600 }}>
                  {mostrarCola ? '▾' : '▸'}
                </td>
                <td style={tdL}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    <span style={{ width: 6, height: 6, borderRadius: 50, background: theme.textMuted, flex: '0 0 6px' }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: P.accent, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
                        Cola larga · {cola.length} cliente{cola.length === 1 ? '' : 's'} menores
                      </div>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginTop: 1, lineHeight: 1.1 }}>
                        {colaPct.toFixed(1)}% restante · click para {mostrarCola ? 'colapsar' : 'expandir'}
                      </div>
                    </div>
                  </div>
                </td>
                {colaMensual.map((v, mi) => (
                  <td key={mi} style={td}><HeatCell v={v} max={Math.max(0, ...colaMensual)} /></td>
                ))}
                <td style={td}><NumPillC value={colaTotal / 6} /></td>
                <td style={td}><NumPillC value={colaTotal} strong /></td>
                <td style={td}><PctPill pct={colaPct} /></td>
                <td style={{ ...td, fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>100.0%</td>
              </tr>
            )}
            {mostrarCola && cola.map((p, i) => renderFila(p, pareto.length + i, true))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2} style={{ padding: '6px 6px 4px', borderTop: `1px solid ${theme.divider || theme.border}`, textAlign: 'left', fontFamily: TYPO.fontDisplay, fontSize: 8.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>
                Total {pareto.length + cola.length} clientes
              </td>
              {totalesMes.map((v, i) => (
                <td key={i} style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}` }}><HeatCell v={v} max={totalMaxMes} /></td>
              ))}
              <td style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}` }}><NumPillC value={grandTotal / 6} strong /></td>
              <td style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}` }}><NumPillC value={grandTotal} strong /></td>
              <td style={{ padding: '6px 6px 4px', textAlign: 'right', borderTop: `1px solid ${theme.divider || theme.border}`, fontFamily: TYPO.fontDisplay, fontSize: 10, color: theme.textMuted, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>100%</td>
              <td style={{ borderTop: `1px solid ${theme.divider || theme.border}` }} />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
