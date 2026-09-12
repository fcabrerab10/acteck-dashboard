// SellInDicotech · rediseño Apple V2 para Dicotech
// ─ Clon adaptado de SellInClienteV2 con dos diferencias clave:
//   1. Sin datos de Sell Out por SKU (Dicotech no expone SO a nivel SKU)
//   2. Cuota simple: cuando mín === ideal, se muestra una sola línea "Cuota"

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando, Panel, GraficaLineas, SelectorTrimestres, usePersistTrimestres, etiquetaTrimestres } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import { ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { fetchAll as fetchAllCentral } from '../../lib/queries';
import ApoyoComercial from './sellin/ApoyoComercial';

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
export default function SellInDicotech({ clienteKey }) {
  const perfil = usePerfil();
  if (!puedeVerPestanaCliente(perfil, clienteKey, 'sellIn')) {
    return <SinAcceso motivo={`No tienes acceso a Sell In de ${clienteKey || 'este cliente'}.`} />;
  }
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
  const [rango, setRango] = usePersistTrimestres(`sellIn:${clienteKey}`, () => new Set([getCurrentQ(mesActual)]));
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [familiaFilter, setFamiliaFilter] = useState(null);

  function getCurrentQ(m) {
    if (m <= 3) return 'Q1';
    if (m <= 6) return 'Q2';
    if (m <= 9) return 'Q3';
    return 'Q4';
  }

  const mesesRango = useMemo(() => {
    if (!rango || rango.size === 0) return Q_MESES.anio;
    const set = new Set();
    for (const q of rango) (Q_MESES[q] || []).forEach(m => set.add(m));
    return Array.from(set).sort((a, b) => a - b);
  }, [rango]);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [fact, rdmp, ct] = await Promise.all([
        fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto',
          (q) => q.eq('cliente_key', clienteKey).in('anio', [anioPrev, anio])),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp'),
        fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal',
          (q) => q.eq('cliente', clienteKey).eq('anio', anio)),
      ]);
      setFacturacion(fact);
      setRoadmap(rdmp);
      setCuotas(ct);
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

  // Dicotech: por lo general cuota mín === ideal. Detectamos el modo.
  const cuotaSimple = useMemo(() => {
    if (cuotas.length === 0) return true;
    return cuotas.every(c => Number(c.cuota_min || 0) === Number(c.cuota_ideal || 0));
  }, [cuotas]);

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

  const hoyDate = new Date();
  const diasTranscurridos = (hoyDate.getFullYear() === anio && hoyDate.getMonth() + 1 === mesActual) ? hoyDate.getDate() : new Date(anio, mesActual, 0).getDate();
  const diasDelMes = new Date(anio, mesActual, 0).getDate();
  const factorProy = diasTranscurridos > 0 ? diasDelMes / diasTranscurridos : 1;
  const sellInMesProyectado = mesActualData.monto * factorProy;
  const yoyProyectado = mesActualData.prevMonto > 0 ? ((sellInMesProyectado - mesActualData.prevMonto) / mesActualData.prevMonto * 100) : null;
  const yoyMonto = mesActualData.prevMonto ? ((mesActualData.monto - mesActualData.prevMonto) / mesActualData.prevMonto * 100) : null;
  // FIX audit #1: YoY con mes parcial engaña — usar proyección cuando factorProy > 1.05
  const yoyDisplay = factorProy > 1.05 ? yoyProyectado : yoyMonto;
  const yoyEsProyectado = factorProy > 1.05;
  const yoyPiezasDelta = mesActualData.prevPiezas ? mesActualData.piezas - mesActualData.prevPiezas : null;
  const momIdx = mesActual - 2;
  const momPrevMonto = momIdx < 0 ? mensualPorAnio.monto[anioPrev][11] : mensualPorAnio.monto[anio][momIdx];
  const momPrevPiezas = momIdx < 0 ? mensualPorAnio.piezas[anioPrev][11] : mensualPorAnio.piezas[anio][momIdx];
  const momPct = momPrevMonto ? ((mesActualData.monto - momPrevMonto) / momPrevMonto * 100) : null;
  const momPiezasDelta = momPrevPiezas ? mesActualData.piezas - momPrevPiezas : null;
  const momLabel = momIdx < 0 ? `${MESES_LARGO[11]} ${anioPrev}` : MESES_LARGO[momIdx];

  const timelineMeses = useMemo(() => {
    return Q_MESES.anio.map(m => ({
      mes: m,
      label: MESES[m - 1],
      sellIn: mensualPorAnio.monto[anio][m - 1],
      sellInPrev: mensualPorAnio.monto[anioPrev][m - 1],
      cuota: cuotaPorMes.get(m)?.ideal || 0,
      cuotaMin: cuotaPorMes.get(m)?.min || 0,
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

  // Tabla SKU · sin datos de Sell Out (Dicotech no expone SO por SKU)
  const filasSKU = useMemo(() => {
    const acc = new Map();
    for (const r of facturacion) {
      if (Number(r.anio) !== anio) continue;
      const sku = r.sku;
      if (!acc.has(sku)) acc.set(sku, { sku, piezas: Array(12).fill(0), montoSI: 0, piezasSI: 0 });
      const it = acc.get(sku);
      const mIdx = Number(r.mes) - 1;
      if (mIdx >= 0 && mIdx < 12) it.piezas[mIdx] += Number(r.piezas) || 0;
      it.montoSI += Number(r.monto) || 0;
      it.piezasSI += Number(r.piezas) || 0;
    }
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
      if (familiaFilter) {
        const famNorm = (familia || 'Sin familia').trim();
        const famCap = famNorm.charAt(0).toUpperCase() + famNorm.slice(1).toLowerCase();
        if (famCap !== familiaFilter) return;
      }
      const total = it.piezas.reduce((a, b) => a + b, 0);
      const cerrados = it.piezas.slice(0, mesActual - 1);
      const conVenta = cerrados.filter((v) => v > 0);
      const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
      rows.push({ ...it, descripcion, marca, categoria, familia, rdmp, total, promedio });
    });
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
  }, [facturacion, roadmapMap, busqueda, orden, anio, mesActual, familiaFilter]);

  const toggleSort = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };

  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  if (loading) {
    return <Cargando pantalla="sellIn" label="Cargando Sell In…" sub={`Trayendo facturación de ${clienteKey}`} minHeight={480} />;
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
          badge={pctMTD != null ? { l: `${Math.round(pctMTD)}% cuota`, tone: pctMTD >= 100 ? 'good' : pctMTD >= 85 ? 'neutral' : 'warn' } : null}
          title="vs cuota mensual"
          big={fmt.money(mesActualData.monto)}
          bigSmall={mesActualData.cuota?.ideal ? (cuotaSimple ? `/ ${fmt.money(mesActualData.cuota.ideal)} cuota` : `/ ${fmt.money(mesActualData.cuota.min)} mín · ${fmt.money(mesActualData.cuota.ideal)} ideal`) : ''}
          sub={<>{fmt.int(mesActualData.piezas)} pzs{!cuotaSimple && pctMTDmin != null ? <> · <strong style={{ color: pctMTDmin >= 100 ? P.green : pctMTDmin >= 85 ? theme.text : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{Math.round(pctMTDmin)}%</strong> mín</> : ''}{yoyPiezasDelta != null ? <> · <strong style={{ color: yoyPiezasDelta >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{yoyPiezasDelta >= 0 ? '+' : ''}{fmt.int(yoyPiezasDelta)}</strong>pz vs {anioPrev}</> : ''}</>}
          progress={pctMTD}
          progressSecondary={cuotaSimple ? null : pctMTDmin}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YTD Sell In · ${anio}`}
          badge={pctYTD != null ? { l: `${Math.round(pctYTD)}% cuota`, tone: pctYTD >= 100 ? 'good' : pctYTD >= 85 ? 'neutral' : 'warn' } : null}
          title="Facturación acumulada"
          big={fmt.money(totalYTD.monto)}
          bigSmall={cuotaYTD.ideal ? (cuotaSimple ? `/ ${fmt.money(cuotaYTD.ideal)} cuota` : `/ ${fmt.money(cuotaYTD.min)} mín · ${fmt.money(cuotaYTD.ideal)} ideal`) : ''}
          sub={<>{fmt.int(totalYTD.piezas)} pzs · {filasSKU.length} SKUs{!cuotaSimple && pctYTDmin != null ? <> · <strong style={{ color: pctYTDmin >= 100 ? P.green : pctYTDmin >= 85 ? theme.text : P.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{Math.round(pctYTDmin)}%</strong> mín</> : ''}</>}
          progress={pctYTD}
          progressSecondary={cuotaSimple ? null : pctYTDmin}
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

      {/* Timeline + Composición familia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10 }}>
        <TimelineLineal mesesRango={mesesRango} theme={theme} P={P} data={timelineMeses} sums={timelineSums} rango={rango} onChangeRango={setRango} anio={anio} anioPrev={anioPrev} mesActual={mesActual} cuotaSimple={cuotaSimple} />
        <FamiliaCard theme={theme} P={P} familias={familiasYTD} totalYTD={totalYTD} selected={familiaFilter} onSelect={setFamiliaFilter} />
      </div>

      {/* Tabla SKU */}
      <TablaSKU theme={theme} P={P}
        rows={filasSKU}
        busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)}
      />

      {/* Apoyo comercial: bonificaciones por concepto (erp_ventas · rama SERVICIOS) */}
      <ApoyoComercial anio={anio} mes={mesActual} clienteKey={clienteKey} />
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
function subnarrativa(monto, cuota, top, yoy) {
  const parts = [];
  if (monto > 0) parts.push(`${fmt.money(monto)} facturados`);
  if (cuota > 0) parts.push(`de ${fmt.money(cuota)} meta`);
  if (yoy != null) parts.push(`${yoy >= 0 ? '+' : ''}${yoy.toFixed(0)}% YoY`);
  if (top?.name) parts.push(`${top.name} lidera`);
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

// ═══════════════ Familia Card · donut ring (stroke-dasharray) ═══════════════
function FamiliaCard({ theme, P, familias, totalYTD, selected, onSelect }) {
  const total = familias.reduce((s, f) => s + f.monto, 0);
  const anySelected = selected != null;
  // Donut: stroke-dasharray sobre <circle>. Radio y stroke calibrados para 210×210.
  const size = 210, cx = 120, cy = 120, r = 88, stroke = 34;
  const circ = 2 * Math.PI * r; // 552.92
  const segments = [];
  if (total > 0) {
    let offset = 0;
    for (const f of familias) {
      const len = (f.monto / total) * circ;
      segments.push({ len, offset, color: f.color, name: f.name });
      offset += len;
    }
  }
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
        <div style={{ display: 'grid', gridTemplateColumns: `${size}px 1fr`, gap: 16, alignItems: 'center', marginTop: 4, flex: 1 }}>
          {/* Ring */}
          <div style={{ position: 'relative', width: size, height: size }}>
            <svg viewBox="0 0 240 240" width={size} height={size}>
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                strokeWidth={stroke} />
              <g transform={`rotate(-90 ${cx} ${cy})`} fill="none" strokeWidth={stroke}>
                {segments.map((s, i) => {
                  const isActive = selected === s.name;
                  const isDim = anySelected && !isActive;
                  return (
                    <circle key={i} cx={cx} cy={cy} r={r}
                      stroke={s.color}
                      strokeDasharray={`${s.len} ${circ}`}
                      strokeDashoffset={-s.offset}
                      opacity={isDim ? 0.30 : 1}
                      style={{ cursor: 'pointer', transition: 'opacity 160ms' }}
                      onClick={() => onSelect(isActive ? null : s.name)} />
                  );
                })}
              </g>
            </svg>
            {/* Centro */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {anySelected ? (() => {
                const f = familias.find(x => x.name === selected);
                const pct = f && total > 0 ? (f.monto / total * 100) : 0;
                return (
                  <>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, maxWidth: 100, textAlign: 'center', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selected}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</div>
                    <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{f ? fmt.money(f.monto) : '—'}</div>
                  </>
                );
              })() : (
                <>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>YTD</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(totalYTD.monto)}</div>
                  <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{familias.length} familias</div>
                </>
              )}
            </div>
          </div>
          {/* Leyenda */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'stretch', height: '100%' }}>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', marginBottom: 2 }}>click filtra tabla</div>
            {familias.map((f) => {
              const isActive = selected === f.name;
              const isDim = anySelected && !isActive;
              const pct = total > 0 ? (f.monto / total * 100) : 0;
              return (
                <div key={f.name}
                  onClick={() => onSelect(isActive ? null : f.name)}
                  style={{
                    display: 'grid', gridTemplateColumns: '10px 1fr auto auto', gap: 8, alignItems: 'center',
                    padding: '5px 8px', margin: '0 -8px', borderRadius: 8,
                    cursor: 'pointer', opacity: isDim ? 0.45 : 1,
                    background: isActive ? `${f.color}18` : 'transparent',
                    transition: 'background 160ms, opacity 160ms',
                    flex: 1, minHeight: 30,
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${theme.text}05`; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color }} />
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: isActive ? 700 : 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.text, fontWeight: 600, textAlign: 'right', minWidth: 58, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(f.monto)}</span>
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
function TablaSKU({ theme, P, rows, busqueda, onChangeBusqueda, orden, onToggleSort, familiaFilter, onClearFamilia }) {
  const isDark = theme.mode === 'dark';
  const maxCelda = useMemo(() => {
    let m = 0;
    for (const r of rows) for (const v of r.piezas) if (v > m) m = v;
    return m || 1;
  }, [rows]);

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
      NVS:  { bg: `${P.green}22`,  color: P.green },
      '2026': { bg: `${P.orange}22`, color: P.orange },
      '2025': { bg: `${theme.text}0F`, color: theme.textMuted },
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
