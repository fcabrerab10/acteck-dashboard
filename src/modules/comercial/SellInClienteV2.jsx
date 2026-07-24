// SellInClienteV2 · rediseño Apple V2
// ─ Hero editorial narrativo con 3 stats
// ─ 4 KPI cards planas (MTD · YTD · YoY · MoM)
// ─ Timeline lineal 3 líneas + filtros Q + sums row
// ─ Ferruteck cosmic strip con recomendaciones
// ─ Composición familia (barras planas ordenadas)
// ─ Tabla SKU con Sell In + Sell Out + Roadmap chip + Heat

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import { ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, AlertTriangle, Clock, TrendingUp, Sparkles } from 'lucide-react';

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

async function fetchAll(table, select, applyFilter = (q) => q) {
  const PAGE = 1000;
  let acc = [], from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    q = applyFilter(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════
export default function SellInClienteV2({ clienteKey }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const anioPrev = anio - 1;
  const mesActual = new Date().getMonth() + 1;

  const [loading, setLoading] = useState(true);
  const [facturacion, setFacturacion] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [cuotas, setCuotas] = useState([]);
  const [selloutDet, setSelloutDet] = useState([]);
  const [rango, setRango] = useState(getCurrentQ(mesActual));
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [familiaFilter, setFamiliaFilter] = useState(null); // click en familia filtra la tabla

  function getCurrentQ(m) {
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
  }

  useEffect(() => {
    setLoading(true);
    (async () => {
      const anioIni = `${anioPrev}-01-01`;
      const [fact, rdmp, ct, sod] = await Promise.all([
        fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto',
          (q) => q.eq('cliente_key', clienteKey).in('anio', [anioPrev, anio])),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp'),
        fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal',
          (q) => q.eq('cliente', clienteKey).eq('anio', anio)),
        fetchAll('sellout_detalle', 'fecha,total,cantidad,no_parte',
          (q) => q.eq('cliente', clienteKey).gte('fecha', anioIni)),
      ]);
      setFacturacion(fact);
      setRoadmap(rdmp);
      setCuotas(ct);
      setSelloutDet(sod);
      setLoading(false);
    })();
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
      if (!r.fecha) continue;
      const d = new Date(r.fecha);
      if (d.getFullYear() !== anio) continue;
      const sku = String(r.no_parte || '').trim();
      if (!sku) continue;
      if (!map.has(sku)) map.set(sku, { monto: 0, piezas: 0 });
      const s = map.get(sku);
      s.monto += Number(r.total) || 0;
      s.piezas += Number(r.cantidad) || 0;
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
  const pctYTD = cuotaYTD.ideal ? (totalYTD.monto / cuotaYTD.ideal * 100) : null;
  const yoyMonto = mesActualData.prevMonto ? ((mesActualData.monto - mesActualData.prevMonto) / mesActualData.prevMonto * 100) : null;
  const yoyPiezasDelta = mesActualData.prevPiezas ? mesActualData.piezas - mesActualData.prevPiezas : null;
  const momIdx = mesActual - 2;
  const momPrevMonto = momIdx < 0 ? mensualPorAnio.monto[anioPrev][11] : mensualPorAnio.monto[anio][momIdx];
  const momPrevPiezas = momIdx < 0 ? mensualPorAnio.piezas[anioPrev][11] : mensualPorAnio.piezas[anio][momIdx];
  const momPct = momPrevMonto ? ((mesActualData.monto - momPrevMonto) / momPrevMonto * 100) : null;
  const momPiezasDelta = momPrevPiezas ? mesActualData.piezas - momPrevPiezas : null;
  const momLabel = momIdx < 0 ? `${MESES_LARGO[11]} ${anioPrev}` : MESES_LARGO[momIdx];

  // Timeline data
  const timelineMeses = useMemo(() => {
    const meses = Q_MESES[rango] || Q_MESES.anio;
    return meses.map(m => ({
      mes: m,
      label: MESES[m - 1],
      sellIn: mensualPorAnio.monto[anio][m - 1],
      sellInPrev: mensualPorAnio.monto[anioPrev][m - 1],
      cuota: cuotaPorMes.get(m)?.ideal || 0,
      actual: m === mesActual,
      futuro: m > mesActual,
    }));
  }, [mensualPorAnio, anio, anioPrev, cuotaPorMes, rango, mesActual]);

  const timelineSums = useMemo(() => {
    const meses = Q_MESES[rango] || Q_MESES.anio;
    let s2026 = 0, s2025 = 0, cuota = 0;
    meses.forEach(m => {
      s2026 += mensualPorAnio.monto[anio][m - 1];
      s2025 += mensualPorAnio.monto[anioPrev][m - 1];
      cuota += cuotaPorMes.get(m)?.ideal || 0;
    });
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    const deltaCuota = cuota > 0 ? ((s2026 - cuota) / cuota * 100) : null;
    return { s2026, s2025, cuota, deltaYoY, deltaCuota };
  }, [mensualPorAnio, cuotaPorMes, rango, anio, anioPrev]);

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

  // Sell In matriz mensual + totales + Sell Out YTD por SKU
  const filasSKU = useMemo(() => {
    const acc = new Map();
    // Matriz Sell In por mes (piezas) + montoSI YTD
    for (const r of facturacion) {
      if (Number(r.anio) !== anio) continue;
      const sku = r.sku;
      if (!acc.has(sku)) acc.set(sku, { sku, piezas: Array(12).fill(0), montoSI: 0, piezasSI: 0, montoSO: 0, piezasSO: 0 });
      const it = acc.get(sku);
      const mIdx = Number(r.mes) - 1;
      if (mIdx >= 0 && mIdx < 12) it.piezas[mIdx] += Number(r.piezas) || 0;
      it.montoSI += Number(r.monto) || 0;
      it.piezasSI += Number(r.piezas) || 0;
    }
    // Sell Out por sku (join)
    selloutBySku.forEach((v, sku) => {
      if (!acc.has(sku)) acc.set(sku, { sku, piezas: Array(12).fill(0), montoSI: 0, piezasSI: 0, montoSO: 0, piezasSO: 0 });
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
      // Total = sum meses; Promedio = avg de meses cerrados con venta
      const total = it.piezas.reduce((a, b) => a + b, 0);
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
      if (isString) {
        rows.sort((a, b) => String(a[orden.col] || '').localeCompare(String(b[orden.col] || '')) * factor);
      } else if (mesMatch) {
        const i = Number(mesMatch[1]);
        rows.sort((a, b) => ((a.piezas[i] || 0) - (b.piezas[i] || 0)) * factor);
      } else {
        rows.sort((a, b) => ((a[orden.col] || 0) - (b[orden.col] || 0)) * factor);
      }
    }
    return rows;
  }, [facturacion, selloutBySku, roadmapMap, busqueda, orden, anio, mesActual, familiaFilter]);

  const toggleSort = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };

  // Copilot recos
  const copilotRecos = useMemo(() => {
    const arr = [];
    if (pctMTD != null && pctMTD >= 100) {
      arr.push({ sev: 'info', title: `Arriba de cuota · +${(pctMTD - 100).toFixed(1)}%`, sub: 'Considera subir meta trimestral' });
    } else if (pctMTD != null && pctMTD < 85) {
      const cuotaIdeal = mesActualData.cuota?.ideal || 0;
      const falta = cuotaIdeal - (mesActualData.monto || 0);
      arr.push({ sev: 'warn', title: `MTD al ${Math.round(pctMTD)}% de cuota`, sub: `Faltan ${fmt.money(falta)} para meta del mes` });
    }
    // Top familia crecimiento
    if (familiasYTD.length > 0) {
      arr.push({ sev: 'info', title: `${familiasYTD[0].name} lidera con ${fmt.money(familiasYTD[0].monto)}`, sub: `${familiasYTD[0].skus} SKUs · ${fmt.int(familiasYTD[0].piezas)}pz` });
    }
    // SKUs sin sell out (con SI pero SO = 0)
    const sinSO = filasSKU.filter((r) => r.montoSI > 0 && r.montoSO === 0);
    if (sinSO.length >= 3) {
      arr.push({ sev: 'urgente', title: `${sinSO.length} SKUs no rotaron`, sub: 'Sell In sin Sell Out · revisa precio o rotación' });
    }
    return arr.slice(0, 3);
  }, [pctMTD, mesActualData, familiasYTD, filasSKU]);

  // Estilos base
  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  if (loading) {
    return <FerrutekLoader label="Cargando Sell In…" sub={`Trayendo facturación de ${clienteKey}`} minHeight={480} />;
  }

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
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
            {subnarrativa(mesActualData.monto, mesActualData.cuota?.ideal, familiasYTD[0], yoyMonto)}
          </p>
        </div>
        <HeroStat k={`MTD ${MESES[mesActual - 1]}`} v={fmt.money(mesActualData.monto)} sub={pctMTD != null ? `${Math.round(pctMTD)}% cuota` : ''} />
        <HeroStat k={`YTD ${anio}`} v={fmt.money(totalYTD.monto)} sub={pctYTD != null ? `${Math.round(pctYTD)}% cuota` : ''} />
        <HeroStat k="YoY" v={yoyMonto != null ? `${yoyMonto >= 0 ? '+' : ''}${yoyMonto.toFixed(0)}%` : '—'} sub={`vs ${anioPrev}`} valColor={yoyMonto == null ? undefined : yoyMonto >= 0 ? P.green : P.red} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} P={P}
          eyebrow={`MTD · ${MESES[mesActual - 1]}`}
          badge={pctMTD != null ? { l: `${Math.round(pctMTD)}%`, tone: pctMTD >= 100 ? 'good' : pctMTD >= 85 ? 'neutral' : 'warn' } : null}
          title="vs cuota mensual"
          big={fmt.money(mesActualData.monto)}
          bigSmall={mesActualData.cuota?.ideal ? `/ ${fmt.money(mesActualData.cuota.ideal)}` : ''}
          sub={<>{fmt.int(mesActualData.piezas)} pzs · {yoyPiezasDelta != null ? <><strong style={{ color: yoyPiezasDelta >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{yoyPiezasDelta >= 0 ? '+' : ''}{fmt.int(yoyPiezasDelta)}</strong> vs {anioPrev}</> : ''}</>}
          progress={pctMTD}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YTD · ${anio}`}
          badge={pctYTD != null ? { l: `${Math.round(pctYTD)}%`, tone: pctYTD >= 100 ? 'good' : pctYTD >= 85 ? 'neutral' : 'warn' } : null}
          title="acumulado del año"
          big={fmt.money(totalYTD.monto)}
          bigSmall={cuotaYTD.ideal ? `/ ${fmt.money(cuotaYTD.ideal)}` : ''}
          sub={<>{fmt.int(totalYTD.piezas)} pzs · {filasSKU.length} SKUs</>}
          progress={pctYTD}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YoY · ${MESES[mesActual - 1]}`}
          title={`vs ${anioPrev}`}
          big={yoyMonto != null ? `${yoyMonto >= 0 ? '+' : ''}${yoyMonto.toFixed(1)}%` : '—'}
          bigColor={yoyMonto == null ? theme.text : yoyMonto >= 0 ? P.green : P.red}
          sub={<><strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(mesActualData.monto)}</strong> vs {fmt.money(mesActualData.prevMonto)}</>}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`MoM · vs ${momLabel}`}
          title="vs mes anterior"
          big={momPct != null ? `${momPct >= 0 ? '+' : ''}${momPct.toFixed(1)}%` : '—'}
          bigColor={momPct == null ? theme.text : momPct >= 0 ? P.green : P.red}
          sub={<><strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(mesActualData.monto)}</strong> vs {fmt.money(momPrevMonto)}{momPiezasDelta != null ? ` · ${momPiezasDelta >= 0 ? '+' : ''}${fmt.int(momPiezasDelta)}pz` : ''}</>}
        />
      </div>

      {/* Fila: Timeline lineal + Composición familia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10 }}>
        <TimelineLineal theme={theme} P={P} data={timelineMeses} sums={timelineSums} rango={rango} onChangeRango={setRango} anio={anio} anioPrev={anioPrev} mesActual={mesActual} />
        <FamiliaCard theme={theme} P={P} familias={familiasYTD} totalYTD={totalYTD} selected={familiaFilter} onSelect={setFamiliaFilter} />
      </div>

      {/* Ferruteck cosmic strip */}
      <FerruteckStrip recos={copilotRecos} />

      {/* Tabla SKU */}
      <TablaSKU theme={theme} P={P}
        rows={filasSKU}
        busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)}
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

function KpiCard({ theme, P, eyebrow, badge, title, big, bigSmall, bigColor, sub, progress }) {
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
        <div style={{ marginTop: 8, height: 3, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, progress))}%`, background: progColor, borderRadius: 999, transition: 'width 400ms' }} />
        </div>
      )}
    </div>
  );
}

// ═══════════════ Timeline Lineal ═══════════════
function TimelineLineal({ theme, P, data, sums, rango, onChangeRango, anio, anioPrev, mesActual }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const isDark = theme.mode === 'dark';
  const W = 600, H = 220;
  const padL = 26, padR = 16, padT = 12, padB = 20;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxV = Math.max(1, ...data.map(d => Math.max(d.sellIn, d.sellInPrev, d.cuota)));
  const xOf = (i) => padL + (i / Math.max(1, data.length - 1)) * chartW;
  const yOf = (v) => padT + chartH - (v / maxV) * chartH;
  const line2026 = data.filter(d => !d.futuro).map((d, i) => `${xOf(i)},${yOf(d.sellIn)}`).join(' ');
  const line2025 = data.map((d, i) => `${xOf(i)},${yOf(d.sellInPrev)}`).join(' ');
  const lineCuota = data.map((d, i) => `${xOf(i)},${yOf(d.cuota)}`).join(' ');
  const hovered = hoverIdx != null ? data[hoverIdx] : null;

  const filtros = [
    { k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }, { k: 'anio', l: 'Año' },
  ];

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Evolución mensual · Sell In
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
          {filtros.map(f => (
            <button key={f.k} onClick={() => onChangeRango(f.k)}
              style={{
                border: 0, background: rango === f.k ? theme.surface : 'transparent',
                padding: '4px 10px', borderRadius: 6,
                fontFamily: rango === f.k ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10.5, color: rango === f.k ? theme.text : theme.textMuted,
                fontWeight: rango === f.k ? 600 : 500, cursor: 'pointer',
                boxShadow: rango === f.k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderWidth: 1, borderStyle: 'solid', borderColor: rango === f.k ? theme.border : 'transparent',
              }}>{f.l}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 12, padding: '6px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} />SI {anioPrev}</>} v={fmt.money(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={P.accent} />SI {anio}</>} v={fmt.money(sums.s2026)} vColor={theme.text} />
        <SumStat theme={theme} k={<><Dot color={P.orange} dashed />Cuota {anio}</>} v={fmt.money(sums.cuota)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ YoY" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
        )}
        {sums.deltaCuota != null && (
          <SumStat theme={theme} k="Δ vs cuota" v={`${sums.deltaCuota >= 0 ? '+' : ''}${sums.deltaCuota.toFixed(1)}%`} vColor={sums.deltaCuota >= 0 ? P.green : P.red} />
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 220, display: 'block' }}>
          {[0.25, 0.5, 0.75].map(f => (
            <line key={f} x1={padL} y1={padT + chartH * f} x2={W - padR} y2={padT + chartH * f}
              stroke={isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'} strokeDasharray="3 4" />
          ))}
          <line x1={padL} y1={H - padB} x2={W - padR} y2={H - padB} stroke={theme.divider || theme.border} />
          <polyline points={line2025} fill="none" stroke={theme.textMuted} strokeWidth="2" opacity="0.55" />
          <polyline points={lineCuota} fill="none" stroke={P.orange} strokeWidth="2" strokeDasharray="5 4" opacity="0.85" />
          <polyline points={line2026} fill="none" stroke={P.accent} strokeWidth="2.5" />
          {data.map((d, i) => !d.futuro && (
            <circle key={`p-${i}`} cx={xOf(i)} cy={yOf(d.sellIn)} r={d.actual ? 5 : 3.5}
              fill={d.actual ? P.green : P.accent}
              stroke={theme.surface} strokeWidth={d.actual ? 2 : 1.5} />
          ))}
          {data.map((d, i) => (
            <rect key={`h-${i}`}
              x={xOf(i) - chartW / (data.length * 2)}
              y={padT}
              width={chartW / data.length}
              height={chartH}
              fill="transparent"
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
              style={{ cursor: 'pointer' }}
            />
          ))}
          {hoverIdx != null && (
            <line x1={xOf(hoverIdx)} y1={padT} x2={xOf(hoverIdx)} y2={H - padB}
              stroke={theme.textMuted} strokeWidth="1" strokeDasharray="2 3" opacity="0.4" />
          )}
          {data.map((d, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 6} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9"
              fill={d.actual ? P.green : theme.textMuted}
              fontWeight={d.actual ? 700 : 500}
              opacity={d.futuro ? 0.4 : 1}>
              {d.label}
            </text>
          ))}
        </svg>
        {hovered && !hovered.futuro && (
          <TimelineTooltip theme={theme} P={P} data={hovered} anio={anio} anioPrev={anioPrev}
            xPct={(hoverIdx / (data.length - 1)) * 100} />
        )}
      </div>
    </div>
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
function TimelineTooltip({ theme, P, data, anio, anioPrev, xPct }) {
  const delta = data.sellInPrev > 0 ? ((data.sellIn - data.sellInPrev) / data.sellInPrev * 100) : null;
  const deltaCuota = data.cuota > 0 ? ((data.sellIn - data.cuota) / data.cuota * 100) : null;
  return (
    <div style={{
      position: 'absolute', top: 8, left: `${xPct}%`, transform: 'translateX(-50%)',
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', pointerEvents: 'none',
      zIndex: 5, minWidth: 150, maxWidth: 220,
    }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{data.label} · {anio}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
        <span style={{ color: theme.textMuted }}>SI {anio}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmt.money(data.sellIn)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
        <span style={{ color: theme.textMuted }}>SI {anioPrev}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmt.money(data.sellInPrev)}</span>
      </div>
      {data.cuota > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
          <span style={{ color: theme.textMuted }}>Cuota</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmt.money(data.cuota)}</span>
        </div>
      )}
      {delta != null && (
        <div style={{ marginTop: 4, paddingTop: 4, borderTop: `1px dashed ${theme.divider || theme.border}`, display: 'flex', justifyContent: 'space-between', fontSize: 10 }}>
          <span style={{ color: theme.textMuted }}>Δ YoY</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: delta >= 0 ? P.green : P.red }}>
            {delta >= 0 ? '+' : ''}{delta.toFixed(1)}%
          </span>
        </div>
      )}
    </div>
  );
}

// ═══════════════ Familia Card (interactiva: click filtra tabla) ═══════════════
function FamiliaCard({ theme, P, familias, totalYTD, selected, onSelect }) {
  const total = familias.reduce((s, f) => s + f.monto, 0);
  const anySelected = selected != null;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
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
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: theme.text }}>
        {fmt.money(totalYTD.monto)}
        <span style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.textMuted, fontWeight: 500, marginLeft: 6 }}>
          {fmt.int(totalYTD.piezas)}pz · {familias.length} familias · <span style={{ color: theme.textSubtle || theme.textMuted, fontStyle: 'italic' }}>click filtra tabla</span>
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        {familias.length === 0 && (
          <div style={{ padding: '18px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin datos aún</div>
        )}
        {familias.map((f, i) => {
          const isActive = selected === f.name;
          const isDim = anySelected && !isActive;
          return (
            <div
              key={f.name}
              onClick={() => onSelect(isActive ? null : f.name)}
              style={{
                display: 'grid', gridTemplateColumns: '18px 1fr 1fr 60px', gap: 8, alignItems: 'center',
                padding: '6px 8px', margin: '0 -8px', fontSize: 11,
                borderTop: `1px solid ${theme.divider || theme.border}`, borderRadius: 6,
                cursor: 'pointer', opacity: isDim ? 0.45 : 1,
                background: isActive ? `${f.color}18` : 'transparent',
                transition: 'background 160ms, opacity 160ms',
              }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${theme.text}05`; }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
            >
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, textAlign: 'right', fontWeight: 600 }}>#{i + 1}</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: isActive ? 700 : 600, color: theme.text, display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                <span style={{ width: 8, height: 8, borderRadius: 3, background: f.color, flexShrink: 0 }} />
                {f.name}
              </span>
              <span style={{ height: 5, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
                <span style={{ display: 'block', height: '100%', background: f.color, borderRadius: 999, width: `${total > 0 ? (f.monto / total * 100) : 0}%`, transition: 'width 400ms' }} />
              </span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.text, fontWeight: 600, textAlign: 'right' }}>{fmt.money(f.monto)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════ Ferruteck cosmic strip ═══════════════
function FerruMini({ size = 14 }) {
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150">
      <defs>
        <radialGradient id="fSellInMini" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z" fill="url(#fSellInMini)" />
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function FerruteckStrip({ recos }) {
  if (recos.length === 0) return null;
  return (
    <div style={{
      borderRadius: 12, padding: '12px 16px',
      background: `
        radial-gradient(circle at 15% 40%, rgba(191,90,242,0.30) 0%, transparent 50%),
        radial-gradient(circle at 85% 60%, rgba(100,210,255,0.22) 0%, transparent 50%),
        linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
      color: '#FFF', border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: `auto ${recos.map(() => '1fr').join(' ')}`, gap: 16, alignItems: 'center',
    }}>
      <FerruStars />
      <span style={{
        padding: '4px 10px 4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(191,90,242,0.3)', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6, zIndex: 1,
      }}>
        <FerruMini size={14} />
        Ferruteck
      </span>
      {recos.map((r, i) => (
        <FerruReco key={i} r={r} first={i === 0} />
      ))}
    </div>
  );
}

function FerruReco({ r, first }) {
  const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';
  const iconColor = r.sev === 'info' ? '#000' : '#FFF';
  const Icon = r.sev === 'urgente' ? AlertTriangle : r.sev === 'warn' ? Clock : TrendingUp;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
      borderLeft: first ? 'none' : '1px solid rgba(255,255,255,0.10)',
      cursor: 'pointer', zIndex: 1, minWidth: 0,
    }}>
      <span style={{ width: 26, height: 26, borderRadius: 6, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{r.sub}</div>
      </div>
    </div>
  );
}

function FerruStars() {
  const stars = [
    { top: '20%', left: '10%', d: 0 }, { top: '60%', left: '25%', d: 0.5 },
    { top: '30%', left: '55%', d: 1 }, { top: '75%', left: '75%', d: 1.5 },
    { top: '15%', left: '85%', d: 2 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes fSellInTwinkle { 0%,100% { opacity:0.35; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.3); } }`}</style>
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 6px rgba(255,255,255,0.7)',
          animation: `fSellInTwinkle 3s ease-in-out ${s.d}s infinite`,
        }} />
      ))}
    </div>
  );
}

// ═══════════════ Tabla SKU ═══════════════
// Devuelve las columnas originales del SellInCliente: Marca · SKU · Descripción
// · Categoría · Roadmap · 12 meses (piezas SI heat map) · Promedio · Total
// Al final agrega Sell Out YTD: Pzs SO · Monto SO · Ratio SO/SI
function TablaSKU({ theme, P, rows, busqueda, onChangeBusqueda, orden, onToggleSort, familiaFilter, onClearFamilia }) {
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
        <span style={{ marginLeft: 'auto', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
          <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{rows.length}</strong> SKUs
        </span>
      </div>
      <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr>
              <SortableHeader theme={theme} col="marca" label="Marca" orden={orden} onToggleSort={onToggleSort} align="left" width={90} />
              <SortableHeader theme={theme} col="sku" label="SKU" orden={orden} onToggleSort={onToggleSort} align="left" width={100} />
              <SortableHeader theme={theme} col="descripcion" label="Descripción" orden={orden} onToggleSort={onToggleSort} align="left" />
              <SortableHeader theme={theme} col="categoria" label="Categoría" orden={orden} onToggleSort={onToggleSort} align="left" width={110} />
              <SortableHeader theme={theme} col="rdmp" label="Roadmap" orden={orden} onToggleSort={onToggleSort} align="left" width={80} />
              {MESES.map((m, i) => (
                <SortableHeader key={m} theme={theme} col={`mes-${i}`} label={m} orden={orden} onToggleSort={onToggleSort} align="right" width={54} />
              ))}
              <SortableHeader theme={theme} col="promedio" label="Prom." orden={orden} onToggleSort={onToggleSort} align="right" width={64} />
              <SortableHeader theme={theme} col="total" label="Total" orden={orden} onToggleSort={onToggleSort} align="right" width={70} />
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 500).map((r) => {
              return (
                <tr key={r.sku} style={{ borderTop: `1px solid ${theme.divider || theme.border}` }}>
                  <td style={cellStyle(theme, 'left')}>{r.marca || '—'}</td>
                  <td style={cellStyle(theme, 'left')}>{r.sku}</td>
                  <td style={{ ...cellStyle(theme, 'left'), maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
                  <td style={cellStyle(theme, 'left')}>{r.categoria || '—'}</td>
                  <td style={cellStyle(theme, 'left')}>{roadmapChip(r.rdmp) || '—'}</td>
                  {r.piezas.map((v, i) => {
                    const h = heatCell(v);
                    return (
                      <td key={i} style={{ ...cellStyle(theme, 'right'), padding: '4px 6px', fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                        {h ? (
                          <span style={{
                            display: 'inline-block', padding: '3px 7px', borderRadius: 6,
                            background: h.bg, color: h.color, fontWeight: h.weight || 500,
                            minWidth: 34, textAlign: 'right',
                          }}>{fmt.int(v)}</span>
                        ) : (
                          <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{r.promedio > 0 ? fmt.int(Math.round(r.promedio)) : '—'}</td>
                  <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600 }}>{r.total > 0 ? fmt.int(r.total) : '—'}</td>
                </tr>
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

function SortableHeader({ theme, col, label, orden, onToggleSort, align, width }) {
  const active = orden.col === col;
  const Icon = !active ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th style={{
      position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
      textAlign: align, padding: '9px 10px',
      fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 9.5,
      textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted,
      borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width,
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
