// SellOutClienteV2 · rediseño Apple V2 · exclusivo Digitalife
// ─ Hero editorial narrativo con 3 stats
// ─ 4 KPI cards planas (MTD · YTD · YoY · Inv. Digitalife)
// ─ Timeline lineal SO 2025 vs 2026 + filtros Q + sums row
// ─ Composición sucursal (interactiva, filtra tabla) — basada en inventario cliente
// ─ Composición marca (interactiva, filtra tabla)
// ─ Ferruteck cosmic strip
// ─ Tabla SKU con Roadmap chip + 12 meses heat + Inv. Digitalife

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, TrendingUp, AlertTriangle, MapPin, Zap } from 'lucide-react';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const Q_MESES = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12], anio: [1,2,3,4,5,6,7,8,9,10,11,12] };

const SUCURSAL_META = {
  'dicoags2':  { label: 'Aguascalientes', tipo: 'fisica', codigo: 'AG', color: '#0EA5E9' },
  'leon2':     { label: 'León',           tipo: 'fisica', codigo: 'LE', color: '#6366F1' },
  'Arboledas': { label: 'Arboledas',      tipo: 'fisica', codigo: 'AR', color: '#10B981', subtitle: 'Naucalpan' },
  'GDL':       { label: 'Guadalajara',    tipo: 'fisica', codigo: 'GL', color: '#F59E0B' },
  'ZACATECAS': { label: 'Zacatecas',      tipo: 'fisica', codigo: 'ZA', color: '#EC4899' },
  'santafe':   { label: 'Santa Fe',       tipo: 'fisica', codigo: 'SF', color: '#8B5CF6', subtitle: 'CDMX' },
  'DC':        { label: 'DC',             tipo: 'fisica', codigo: 'DC', color: '#F97316' },
  'AMAZON':    { label: 'Amazon',         tipo: 'virtual', codigo: 'AM', color: '#F97316' },
  'Internet':  { label: 'Internet',       tipo: 'virtual', codigo: 'IN', color: '#94A3B8' },
  'dropship':  { label: 'Dropship',       tipo: 'virtual', codigo: 'DR', color: '#14B8A6' },
};
const metaSuc = (name) => SUCURSAL_META[name] || { label: name, tipo: 'virtual', codigo: (name || '?').slice(0, 2).toUpperCase(), color: '#94A3B8' };

const MARCA_COLORS = { acteck: '#0071E3', 'balam rush': '#BF5AF2', balam: '#BF5AF2', vorago: '#FF9F0A' };
const marcaColor = (m) => MARCA_COLORS[String(m || '').trim().toLowerCase()] || '#94A3B8';

// Roadmap chip · colores iOS del palette (mismo mapping que SI V2)
function roadmapChipStyle(rdmp, P, theme) {
  const key = String(rdmp || '').toUpperCase();
  const map = {
    RMI:  { bg: `${P.teal}22`,   color: P.teal },
    RML:  { bg: `${P.purple}22`, color: P.purple },
    RMS:  { bg: `${P.pink}22`,   color: P.pink },
    '2026': { bg: `${P.orange}22`, color: P.orange },
  };
  return map[key] || { bg: `${theme.text}0F`, color: theme.textMuted };
}

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
export default function SellOutClienteV2({ clienteKey = 'digitalife' }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const anioPrev = anio - 1;

  const [loading, setLoading] = useState(true);
  const [mensual, setMensual] = useState([]);
  const [skuMesRaw, setSkuMesRaw] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [inventarioCliente, setInventarioCliente] = useState([]);
  const [inventarioSucursal, setInventarioSucursal] = useState([]);
  const [marcaMes, setMarcaMes] = useState([]);
  const [rango, setRango] = useState('Q3');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [marcaFilter, setMarcaFilter] = useState(null);
  const [familiaFilter, setFamiliaFilter] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [mes, skuMes, rdmp, inv, invSuc, mrcMes] = await Promise.all([
        fetchAll('v_sellout_digitalife_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas'),
        fetchAll('v_sellout_digitalife_sku_mes', 'sku,anio,mes,piezas,monto',
          (q) => q.in('anio', [anioPrev, anio])),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp,sort_order'),
        fetchAll('inventario_cliente', 'sku,stock,valor,precio_venta,costo_promedio,costo_convenio,anio,semana,fecha_ultima_venta,dias_sin_venta',
          (q) => q.eq('cliente', clienteKey)),
        fetchAll('inventario_cliente_sucursal', 'sku,sucursal,stock,valor,costo_convenio,anio,semana',
          (q) => q.eq('cliente', clienteKey)),
        fetchAll('v_sellout_digitalife_marca_mes', 'marca,anio,mes,piezas,monto,tx,skus_distintos',
          (q) => q.in('anio', [anioPrev, anio])),
      ]);
      setMensual(mes);
      setSkuMesRaw(skuMes);
      setRoadmap(rdmp);
      setInventarioCliente(inv);
      setInventarioSucursal(invSuc);
      setMarcaMes(mrcMes);
      setLoading(false);
    })();
  }, [clienteKey, anio, anioPrev]);

  // Mes actual = último con data
  const mesActual = useMemo(() => {
    let last = 1;
    for (const r of mensual) if (r.anio === anio && Number(r.piezas) > 0) last = Math.max(last, r.mes);
    return last;
  }, [mensual, anio]);

  useEffect(() => {
    if (mesActual <= 3) setRango('Q1');
    else if (mesActual <= 6) setRango('Q2');
    else if (mesActual <= 9) setRango('Q3');
    else setRango('Q4');
  }, [mesActual]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  // Serie mensual por año
  const mensualPorAnio = useMemo(() => {
    const m = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    const p = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    for (const r of mensual) {
      const y = r.anio, i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      if (m[y]) { m[y][i] = Number(r.monto) || 0; p[y][i] = Number(r.piezas) || 0; }
    }
    return { monto: m, piezas: p };
  }, [mensual, anio, anioPrev]);

  // KPIs
  const kpis = useMemo(() => {
    const mtdMonto = mensualPorAnio.monto[anio][mesActual - 1] || 0;
    const mtdPiezas = mensualPorAnio.piezas[anio][mesActual - 1] || 0;
    const mtdPrev = mensualPorAnio.monto[anioPrev][mesActual - 1] || 0;
    const mtdPiezasPrev = mensualPorAnio.piezas[anioPrev][mesActual - 1] || 0;
    const yoyMtd = mtdPrev > 0 ? ((mtdMonto - mtdPrev) / mtdPrev * 100) : null;

    let ytdMonto = 0, ytdPiezas = 0, ytdMontoPrev = 0, ytdPiezasPrev = 0;
    for (let i = 0; i < mesActual; i++) {
      ytdMonto += mensualPorAnio.monto[anio][i];
      ytdPiezas += mensualPorAnio.piezas[anio][i];
      ytdMontoPrev += mensualPorAnio.monto[anioPrev][i];
      ytdPiezasPrev += mensualPorAnio.piezas[anioPrev][i];
    }
    const yoyYtd = ytdMontoPrev > 0 ? ((ytdMonto - ytdMontoPrev) / ytdMontoPrev * 100) : null;

    const momPrev = mesActual >= 2 ? (mensualPorAnio.monto[anio][mesActual - 2] || 0) : 0;
    const momPct = momPrev > 0 ? ((mtdMonto - momPrev) / momPrev * 100) : null;

    return { mtdMonto, mtdPiezas, mtdPrev, mtdPiezasPrev, yoyMtd, ytdMonto, ytdPiezas, ytdMontoPrev, yoyYtd, momPrev, momPct };
  }, [mensualPorAnio, anio, anioPrev, mesActual]);

  // Matriz SKU × mes
  const matrizSku = useMemo(() => {
    const m = new Map();
    for (const r of skuMesRaw) {
      if (r.anio !== anio) continue;
      if (!m.has(r.sku)) m.set(r.sku, Array(12).fill(0));
      m.get(r.sku)[r.mes - 1] += Number(r.piezas) || 0;
    }
    return m;
  }, [skuMesRaw, anio]);

  const skusVendidos = useMemo(() => {
    const s = new Set();
    for (const r of skuMesRaw) {
      if (r.anio !== anio) continue;
      if (!(Number(r.piezas) > 0)) continue;
      s.add(r.sku);
    }
    return s;
  }, [skuMesRaw, anio]);

  // Inventario por SKU (último snapshot)
  const inventarioMap = useMemo(() => {
    const m = new Map();
    for (const r of inventarioCliente) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = m.get(r.sku);
      if (!prev || key > prev._key) {
        const stock = Number(r.stock) || 0;
        const valorRaw = Number(r.valor) || 0;
        const costoProm = Number(r.costo_promedio) || 0;
        // Si valor viene 0 en DB, calcular con stock × costo_promedio
        const valor = valorRaw > 0 ? valorRaw : stock * costoProm;
        m.set(r.sku, {
          stock,
          valor,
          costo_promedio: costoProm,
          precio_venta: Number(r.precio_venta) || 0,
          fecha_ultima_venta: r.fecha_ultima_venta,
          dias_sin_venta: Number(r.dias_sin_venta) || null,
          _key: key,
        });
      }
    }
    return m;
  }, [inventarioCliente]);

  const invTotales = useMemo(() => {
    let stock = 0, valor = 0, skus = 0;
    for (const [, v] of inventarioMap) { stock += v.stock; valor += v.valor; if (v.stock > 0) skus++; }
    return { stock, valor, skus };
  }, [inventarioMap]);

  const skusConInventario = useMemo(() => {
    const s = new Set();
    for (const [sku, v] of inventarioMap) if (v.stock > 0) s.add(sku);
    return s;
  }, [inventarioMap]);

  // Inventario por sucursal (último snapshot por sku+sucursal)
  const inventarioSucursalMap = useMemo(() => {
    const bySku = new Map();
    for (const r of inventarioSucursal) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      if (!bySku.has(r.sku)) bySku.set(r.sku, new Map());
      const bySuc = bySku.get(r.sku);
      const prev = bySuc.get(r.sucursal);
      if (!prev || key > prev._key) {
        bySuc.set(r.sucursal, {
          sucursal: r.sucursal,
          stock: Number(r.stock) || 0,
          valor: Number(r.valor) || 0,
          _key: key,
        });
      }
    }
    const out = new Map();
    for (const [sku, bySuc] of bySku) {
      const arr = Array.from(bySuc.values()).filter((x) => x.stock > 0).sort((a, b) => b.stock - a.stock);
      if (arr.length > 0) out.set(sku, arr);
    }
    return out;
  }, [inventarioSucursal]);

  // Agregado por familia (inventario Digitalife via roadmap)
  const CAT_COLORS = ['#0071E3', '#FF9F0A', '#30D158', '#BF5AF2', '#FF375F', '#64D2FF', '#5E5CE6', '#40C8E0', '#FFD60A', '#FF9500'];
  const familiasInvYTD = useMemo(() => {
    const map = new Map();
    for (const [sku, inv] of inventarioMap) {
      if (!(inv.stock > 0)) continue;
      const rd = roadmapMap.get(sku);
      const famRaw = ((rd?.familia || '').trim()) || 'Sin familia';
      const key = famRaw.charAt(0).toUpperCase() + famRaw.slice(1).toLowerCase();
      if (!map.has(key)) map.set(key, { name: key, stock: 0, valor: 0, skus: 0 });
      const it = map.get(key);
      it.stock += inv.stock;
      it.valor += inv.valor; // ya calculado (stock × costo_promedio si valor=0)
      it.skus += 1;
    }
    const arr = Array.from(map.values()).sort((a, b) => b.valor - a.valor);
    return arr.map((v, i) => ({ ...v, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [inventarioMap, roadmapMap]);
  const familiasInvTot = useMemo(() => {
    let stock = 0, valor = 0;
    for (const f of familiasInvYTD) { stock += f.stock; valor += f.valor; }
    return { stock, valor };
  }, [familiasInvYTD]);

  // Marca YTD (sell out)
  const marcaYTD = useMemo(() => {
    const map = new Map(); const mapPrev = new Map();
    for (const r of marcaMes) {
      const key = r.marca || '(sin marca)';
      const tgt = r.anio === anio ? map : (r.anio === anioPrev ? mapPrev : null);
      if (!tgt) continue;
      if (r.mes > mesActual) continue;
      const acc = tgt.get(key) || { name: key, monto: 0, piezas: 0, skus: 0 };
      acc.monto += Number(r.monto) || 0;
      acc.piezas += Number(r.piezas) || 0;
      acc.skus = Math.max(acc.skus, Number(r.skus_distintos) || 0);
      tgt.set(key, acc);
    }
    const out = [];
    for (const [k, v] of map) {
      const prev = mapPrev.get(k);
      out.push({
        ...v,
        color: marcaColor(v.name),
        prevMonto: prev?.monto || 0,
        yoy: prev && prev.monto > 0 ? ((v.monto - prev.monto) / prev.monto * 100) : null,
      });
    }
    return out.sort((a, b) => b.monto - a.monto);
  }, [marcaMes, anio, anioPrev, mesActual]);

  const totalYTD = useMemo(() => ({
    monto: kpis.ytdMonto,
    piezas: kpis.ytdPiezas,
  }), [kpis]);

  // Timeline data
  const timelineMeses = useMemo(() => {
    const rangoMeses = Q_MESES[rango] || Q_MESES.anio;
    return rangoMeses.map((m) => {
      const i = m - 1;
      const so2026 = mensualPorAnio.monto[anio][i] || 0;
      const so2025 = mensualPorAnio.monto[anioPrev][i] || 0;
      return {
        label: MESES[i],
        mes: m,
        sellIn: so2026,
        sellInPrev: so2025,
        cuota: 0,
        actual: m === mesActual,
        futuro: m > mesActual,
      };
    });
  }, [rango, mensualPorAnio, anio, anioPrev, mesActual]);

  const timelineSums = useMemo(() => {
    let s2026 = 0, s2025 = 0;
    for (const d of timelineMeses) { s2026 += d.sellIn; s2025 += d.sellInPrev; }
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    return { s2026, s2025, deltaYoY };
  }, [timelineMeses]);

  // Roadmap ordenado (sort_order)
  const roadmapOrdenado = useMemo(() => {
    return [...roadmap].sort((a, b) => {
      const sa = a.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(a.sort_order);
      const sb = b.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(b.sort_order);
      if (sa !== sb) return sa - sb;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    });
  }, [roadmap]);

  // Filas tabla
  const filas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const rows = [];
    for (const r of roadmapOrdenado) {
      const tieneVenta = skusVendidos.has(r.sku);
      const tieneInv = skusConInventario.has(r.sku);
      if (!tieneVenta && !tieneInv) continue;
      if (marcaFilter && String(r.marca || '').trim().toLowerCase() !== String(marcaFilter || '').trim().toLowerCase()) continue;
      if (familiaFilter) {
        const famNorm = (r.familia || '').trim();
        const famCap = famNorm ? famNorm.charAt(0).toUpperCase() + famNorm.slice(1).toLowerCase() : 'Sin familia';
        if (famCap !== familiaFilter) continue;
      }
      if (q) {
        const hay = String(r.sku || '').toUpperCase().includes(q) || String(r.descripcion || '').toUpperCase().includes(q);
        if (!hay) continue;
      }
      const piezas = matrizSku.get(r.sku) || Array(12).fill(0);
      const total = piezas.reduce((a, b) => a + b, 0);
      const cerrados = piezas.slice(0, mesActual);
      const conVenta = cerrados.filter((v) => v > 0);
      const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
      const inv = inventarioMap.get(r.sku);
      rows.push({
        ...r, piezas, total, promedio,
        vendido: tieneVenta,
        invStock: inv?.stock || 0,
        invValor: inv?.valor || 0,
        invDias: inv?.dias_sin_venta || null,
      });
    }
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => ((a[orden.col] || 0) - (b[orden.col] || 0)) * factor);
    }
    return rows;
  }, [roadmapOrdenado, skusVendidos, skusConInventario, inventarioMap, matrizSku, busqueda, marcaFilter, familiaFilter, orden, mesActual]);

  const maxCelda = useMemo(() => {
    let m = 0;
    for (const r of filas) for (const v of r.piezas) if (v > m) m = v;
    return m || 1;
  }, [filas]);

  const toggleSort = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };

  // Narrativa
  const narrativa = () => {
    if (kpis.mtdMonto === 0) return `Sin datos de sell out para ${MESES_LARGO[mesActual - 1]}`;
    const marca1 = marcaYTD[0];
    const fam1 = familiasInvYTD[0];
    if (marca1) return `${marca1.name} lidera con ${fmt.money(marca1.monto)}`;
    if (fam1) return `${fam1.name} concentra el inventario`;
    return `Sell Out ${MESES_LARGO[mesActual - 1]} · ${fmt.money(kpis.mtdMonto)}`;
  };
  const subnarrativa = () => {
    const parts = [];
    parts.push(`${fmt.money(kpis.mtdMonto)} vendidos`);
    if (kpis.yoyMtd != null) parts.push(`${kpis.yoyMtd >= 0 ? '+' : ''}${kpis.yoyMtd.toFixed(1)}% YoY`);
    if (marcaYTD[0]) parts.push(`${marcaYTD[0].name} domina la mezcla`);
    return parts.join(' · ');
  };

  // Ferruteck recomendaciones
  const copilotRecos = useMemo(() => {
    const out = [];
    if (familiasInvYTD[0]) {
      const f = familiasInvYTD[0];
      out.push({ icon: '🏆', t: `${f.name} concentra ${fmt.money(f.valor)} de inventario`, s: `${fmt.int(f.stock)} pzs · ${f.skus} SKUs` });
    }
    let sinRotacion = 0;
    for (const [sku, inv] of inventarioMap) {
      if (inv.stock > 0 && (inv.dias_sin_venta || 0) > 90) sinRotacion++;
    }
    if (sinRotacion > 0) {
      out.push({ icon: '⚠️', t: `${sinRotacion} SKUs sin sell out >90 días`, s: 'Inventario parado · revisa precio o rotación' });
    }
    if (marcaYTD[0] && marcaYTD[0].yoy != null) {
      const m = marcaYTD[0];
      const yoyStr = `${m.yoy >= 0 ? '+' : ''}${m.yoy.toFixed(0)}%`;
      out.push({ icon: m.yoy >= 0 ? '🔥' : '📉', t: `${m.name} ${yoyStr} YoY`, s: `Marca principal · ${fmt.money(m.monto)}` });
    }
    return out.slice(0, 3);
  }, [familiasInvYTD, inventarioMap, marcaYTD]);

  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  if (loading) {
    return <FerrutekLoader label="Cargando Sell Out…" sub={`Trayendo sell out de ${clienteKey}`} minHeight={480} />;
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
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#5E5CE6' }} />
            Sell Out · Digitalife · {MESES_LARGO[mesActual - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {narrativa()}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 440, lineHeight: 1.4, margin: 0 }}>
            {subnarrativa()}
          </p>
        </div>
        <HeroStat k={`MTD ${MESES[mesActual - 1]}`} v={fmt.money(kpis.mtdMonto)} sub={`${fmt.int(kpis.mtdPiezas)} pzs`} />
        <HeroStat k={`YTD ${anio}`} v={fmt.money(kpis.ytdMonto)} sub={`${fmt.int(kpis.ytdPiezas)} pzs`} />
        <HeroStat k={`YoY ${MESES[mesActual - 1]}`} v={kpis.yoyMtd != null ? `${kpis.yoyMtd >= 0 ? '+' : ''}${kpis.yoyMtd.toFixed(1)}%` : '—'} sub={`vs ${anioPrev}`} valColor={kpis.yoyMtd == null ? undefined : kpis.yoyMtd >= 0 ? P.green : P.red} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} P={P}
          eyebrow={`MTD · ${MESES[mesActual - 1]}`}
          badge={kpis.yoyMtd != null ? { l: `${kpis.yoyMtd >= 0 ? '+' : ''}${Math.round(kpis.yoyMtd)}%`, tone: kpis.yoyMtd >= 0 ? 'good' : 'warn' } : null}
          title="sell out del mes"
          big={fmt.money(kpis.mtdMonto)}
          bigSmall={`${fmt.int(kpis.mtdPiezas)} pz`}
          sub={<>{kpis.mtdPrev > 0 ? <><strong style={{ color: kpis.yoyMtd >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{kpis.yoyMtd >= 0 ? '+' : ''}{fmt.money(kpis.mtdMonto - kpis.mtdPrev)}</strong> vs {MESES[mesActual - 1]} {anioPrev}</> : `vs ${anioPrev} sin datos`} · {filas.length} SKUs</>}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YTD · ${anio}`}
          badge={kpis.yoyYtd != null ? { l: `${kpis.yoyYtd >= 0 ? '+' : ''}${Math.round(kpis.yoyYtd)}%`, tone: kpis.yoyYtd >= 0 ? 'good' : 'warn' } : null}
          title="acumulado del año"
          big={fmt.money(kpis.ytdMonto)}
          bigSmall={`${fmt.int(kpis.ytdPiezas)} pz`}
          sub={<>{marcaYTD.length} marcas · {familiasInvYTD.length} familias</>}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`MoM · vs ${MESES[Math.max(0, mesActual - 2)]}`}
          title="vs mes anterior"
          big={kpis.momPct != null ? `${kpis.momPct >= 0 ? '+' : ''}${kpis.momPct.toFixed(1)}%` : '—'}
          bigColor={kpis.momPct == null ? theme.text : kpis.momPct >= 0 ? P.green : P.red}
          sub={<><strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(kpis.mtdMonto)}</strong> vs {fmt.money(kpis.momPrev)}</>}
        />
        <KpiCard theme={theme} P={P}
          eyebrow="Inv. Digitalife"
          title="stock disponible"
          big={fmt.int(invTotales.stock)}
          bigSmall={`pz · ${fmt.money(invTotales.valor)}`}
          sub={<>{invTotales.skus} SKUs con stock · {familiasInvYTD.length} familias</>}
        />
      </div>

      {/* Fila: Timeline + Inventario por familia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10 }}>
        <TimelineLineal theme={theme} P={P} isDark={isDark}
          data={timelineMeses} sums={timelineSums} rango={rango} onChangeRango={setRango}
          anio={anio} anioPrev={anioPrev} mesActual={mesActual} />
        <InvFamiliaCard theme={theme} P={P}
          familias={familiasInvYTD} totalStock={familiasInvTot.stock} totalValor={familiasInvTot.valor}
          selected={familiaFilter} onSelect={setFamiliaFilter} />
      </div>

      {/* Composición marca */}
      <MarcaCard theme={theme} P={P} marcas={marcaYTD} totalYTD={totalYTD}
        selected={marcaFilter} onSelect={setMarcaFilter} />

      {/* Ferruteck strip */}
      <FerruteckStrip recos={copilotRecos} />

      {/* Tabla SKU */}
      <TablaSKU theme={theme} P={P} isDark={isDark}
        rows={filas} busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        maxCelda={maxCelda} mesActual={mesActual}
        marcaFilter={marcaFilter} onClearMarca={() => setMarcaFilter(null)}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)} />
    </div>
  );
}

// ═══════════════ Hero Stat ═══════════════
function HeroStat({ k, v, sub, valColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, color: valColor || '#FFF', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>{sub}</div>
    </div>
  );
}

// ═══════════════ KPI Card ═══════════════
function KpiCard({ theme, P, eyebrow, badge, title, big, bigSmall, bigColor, sub }) {
  const badgeStyle = (tone) => {
    if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };
    if (tone === 'warn') return { bg: 'rgba(255,159,10,0.14)', color: '#B76E00' };
    return { bg: 'rgba(0,113,227,0.12)', color: P.accent };
  };
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{eyebrow}</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, marginTop: 1 }}>{title}</div>
        </div>
        {badge && (() => {
          const s = badgeStyle(badge.tone);
          return <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.color }}>{badge.l}</span>;
        })()}
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: bigColor || theme.text, marginTop: 4 }}>
        {big}
        {bigSmall && <span style={{ fontFamily: TYPO.fontText, fontSize: 12, color: theme.textMuted, fontWeight: 500, marginLeft: 4 }}>{bigSmall}</span>}
      </div>
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ═══════════════ Timeline Lineal ═══════════════
function TimelineLineal({ theme, P, isDark, data, sums, rango, onChangeRango, anio, anioPrev, mesActual }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 700, H = 260;
  const padL = 46, padR = 20, padT = 32, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxRaw = Math.max(1, ...data.map(d => Math.max(d.sellIn, d.sellInPrev)));
  // Redondear a "1M" superior más cercano para tener ticks limpios
  const niceStep = (v) => {
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const norm = v / pow;
    const nice = norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10;
    return nice * pow;
  };
  const maxV = niceStep(maxRaw * 1.15);
  const xOf = (i) => padL + (i / Math.max(1, data.length - 1)) * chartW;
  const yOf = (v) => padT + chartH - (v / maxV) * chartH;
  const idxActual = data.findIndex(d => d.actual);
  const cerrados = data.filter(d => !d.futuro);
  // Área bajo la línea 2026
  const area2026 = cerrados.length > 0
    ? `M ${xOf(0)},${yOf(cerrados[0].sellIn)} ${cerrados.map((d, i) => `L ${xOf(i)},${yOf(d.sellIn)}`).join(' ')} L ${xOf(cerrados.length - 1)},${padT + chartH} L ${xOf(0)},${padT + chartH} Z`
    : '';
  const line2026 = cerrados.map((d, i) => `${xOf(i)},${yOf(d.sellIn)}`).join(' ');
  const line2025 = data.map((d, i) => `${xOf(i)},${yOf(d.sellInPrev)}`).join(' ');
  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const currentDatum = idxActual >= 0 ? data[idxActual] : null;

  // Ticks Y (0, 25%, 50%, 75%, 100%)
  const yTicks = [0, 0.25, 0.50, 0.75, 1].map(f => ({ f, v: maxV * f, y: padT + chartH * (1 - f) }));

  const filtros = [
    { k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }, { k: 'anio', l: 'Año' },
  ];

  const gradId = `soArea-${anio}`;

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Evolución mensual · Sell Out
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
      <div style={{ display: 'flex', gap: 14, padding: '6px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} />SO {anioPrev}</>} v={fmt.money(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={P.accent} />SO {anio}</>} v={fmt.money(sums.s2026)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ YoY" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={P.accent} stopOpacity="0.28" />
              <stop offset="100%" stopColor={P.accent} stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Y ticks + labels */}
          {yTicks.map((t, i) => (
            <g key={i}>
              <line x1={padL} y1={t.y} x2={W - padR} y2={t.y}
                stroke={i === 0 ? (theme.divider || theme.border) : (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)')}
                strokeDasharray={i === 0 ? undefined : '3 4'} />
              <text x={padL - 8} y={t.y + 3} textAnchor="end"
                fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill={theme.textMuted}>
                {fmt.money(t.v)}
              </text>
            </g>
          ))}

          {/* Área 2026 */}
          {area2026 && <path d={area2026} fill={`url(#${gradId})`} />}
          {/* Línea 2025 gris */}
          <polyline points={line2025} fill="none" stroke={theme.textMuted} strokeWidth="2" opacity="0.55" />
          {/* Línea 2026 accent grueso */}
          <polyline points={line2026} fill="none" stroke={P.accent} strokeWidth="3" />

          {/* Puntos + etiqueta de valor arriba */}
          {cerrados.map((d, i) => {
            const cx = xOf(i), cy = yOf(d.sellIn);
            return (
              <g key={`p-${i}`}>
                <circle cx={cx} cy={cy} r={d.actual ? 6 : 4}
                  fill={d.actual ? P.green : P.accent}
                  stroke={theme.surface} strokeWidth={d.actual ? 2.5 : 2} />
                {!d.actual && (
                  <text x={cx} y={cy - 10} textAnchor="middle"
                    fontFamily={TYPO.fontDisplay} fontSize="10" fontWeight="600" fill={theme.text}>
                    {fmt.money(d.sellIn)}
                  </text>
                )}
              </g>
            );
          })}

          {/* Hover overlays */}
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

          {/* X labels */}
          {data.map((d, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 8} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9"
              fill={d.actual ? P.green : theme.textMuted}
              fontWeight={d.actual ? 700 : 500}
              opacity={d.futuro ? 0.4 : 1}>
              {d.label}
            </text>
          ))}

          {/* Tooltip permanente sobre mes actual */}
          {currentDatum && idxActual >= 0 && hoverIdx == null && (() => {
            const cx = xOf(idxActual);
            const cy = yOf(currentDatum.sellIn);
            const yoyPct = currentDatum.sellInPrev > 0 ? ((currentDatum.sellIn - currentDatum.sellInPrev) / currentDatum.sellInPrev * 100) : null;
            const boxW = 130;
            const boxX = Math.max(padL, Math.min(W - padR - boxW, cx - boxW / 2));
            const boxY = Math.max(4, cy - 44);
            return (
              <g pointerEvents="none">
                <line x1={cx} y1={cy - 8} x2={cx} y2={boxY + 32} stroke={theme.text} strokeWidth="1" opacity="0.15" />
                <rect x={boxX} y={boxY} width={boxW} height={32} rx="6" fill="#0A0A0C" />
                <text x={boxX + boxW / 2} y={boxY + 13} textAnchor="middle"
                  fontFamily={TYPO.fontDisplay} fontSize="10.5" fontWeight="600" fill="#FFF">
                  {currentDatum.label} · {fmt.money(currentDatum.sellIn)}
                </text>
                <text x={boxX + boxW / 2} y={boxY + 25} textAnchor="middle"
                  fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9" fill="rgba(255,255,255,0.65)">
                  {yoyPct != null ? `${yoyPct >= 0 ? '+' : ''}${yoyPct.toFixed(1)}% YoY` : 'sin comparativo'}
                </text>
              </g>
            );
          })()}
        </svg>
        {hovered && !hovered.futuro && (
          <TimelineTooltip theme={theme} P={P} data={hovered} anio={anio} anioPrev={anioPrev}
            xPct={((hoverIdx * chartW / Math.max(1, data.length - 1)) + padL) / W * 100} />
        )}
      </div>
    </div>
  );
}

function Dot({ color }) {
  return <span style={{ display: 'inline-block', width: 8, height: 2, borderRadius: 1, background: color, marginRight: 4 }} />;
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
  return (
    <div style={{
      position: 'absolute', top: 8, left: `${xPct}%`, transform: 'translateX(-50%)',
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
      padding: '8px 12px', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', pointerEvents: 'none',
      zIndex: 5, minWidth: 150, maxWidth: 220,
    }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{data.label} · {anio}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 3 }}>
        <span style={{ color: theme.textMuted }}>SO {anio}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmt.money(data.sellIn)}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10.5, marginTop: 2 }}>
        <span style={{ color: theme.textMuted }}>SO {anioPrev}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text, fontWeight: 600 }}>{fmt.money(data.sellInPrev)}</span>
      </div>
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

// ═══════════════ Sucursal Card (interactiva: click filtra tabla) ═══════════════
// ═══════════════ Inventario por familia · donut ring + leyenda ═══════════════
function InvFamiliaCard({ theme, P, familias, totalStock, totalValor, selected, onSelect }) {
  // Usa VALOR ($) para proporciones — con fallback stock × costo_promedio
  const total = familias.reduce((s, f) => s + f.valor, 0);
  const anySelected = selected != null;
  const size = 180, cx = size / 2, cy = size / 2, rOuter = 78, rInner = 54;
  const arcs = [];
  if (total > 0) {
    let acc = 0;
    for (const f of familias) {
      const startAng = (acc / total) * Math.PI * 2 - Math.PI / 2;
      acc += f.valor;
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
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Inventario por familia
        </h5>
        {anySelected && (
          <button onClick={() => onSelect(null)}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 500, color: P.accent, padding: '2px 8px', borderRadius: 999 }}
            title="Quitar filtro">Ver todas ›</button>
        )}
      </div>
      {familias.length === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin inventario</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `${size + 12}px 1fr`, gap: 14, alignItems: 'center', marginTop: 4 }}>
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
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              {anySelected ? (() => {
                const f = familias.find(x => x.name === selected);
                const pct = f && total > 0 ? (f.valor / total * 100) : 0;
                return (
                  <>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, textAlign: 'center', padding: '0 6px' }}>{selected}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</div>
                    <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{f ? fmt.money(f.valor) : '—'}</div>
                  </>
                );
              })() : (
                <>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>Costo total</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.025em', color: theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(totalValor)}</div>
                  <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{fmt.int(totalStock)} pz · {familias.length}</div>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 220, overflowY: 'auto' }}>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', marginBottom: 2 }}>click filtra tabla</div>
            {familias.map((f, i) => {
              const isActive = selected === f.name;
              const isDim = anySelected && !isActive;
              const pct = total > 0 ? (f.valor / total * 100) : 0;
              return (
                <div key={f.name}
                  onClick={() => onSelect(isActive ? null : f.name)}
                  style={{
                    display: 'grid', gridTemplateColumns: '10px 1fr auto auto', gap: 8, alignItems: 'center',
                    padding: '4px 8px', margin: '0 -8px', borderRadius: 6,
                    cursor: 'pointer', opacity: isDim ? 0.45 : 1,
                    background: isActive ? `${f.color}18` : 'transparent',
                    transition: 'background 160ms, opacity 160ms',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${theme.text}05`; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: f.color }} />
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: isActive ? 700 : 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.text, fontWeight: 600, textAlign: 'right', minWidth: 56, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(f.valor)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════ Marca Card · tarjetas grandes con brand color ═══════════════
function MarcaCard({ theme, P, marcas, totalYTD, selected, onSelect }) {
  const total = marcas.reduce((s, x) => s + x.monto, 0);
  const anySelected = selected != null;
  const shade = (hex, pct) => {
    // Oscurece un hex #RRGGBB en pct (0..1)
    const h = hex.replace('#', '');
    const r = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(0, 2), 16) * (1 - pct))));
    const g = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(2, 4), 16) * (1 - pct))));
    const b = Math.max(0, Math.min(255, Math.round(parseInt(h.slice(4, 6), 16) * (1 - pct))));
    return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
  };
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, gap: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Sell Out por marca · YTD
        </h5>
        <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
          <span style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.textMuted }}>
            {marcas.length} marcas · <span style={{ color: theme.textSubtle || theme.textMuted, fontStyle: 'italic' }}>click filtra tabla</span>
          </span>
          {anySelected && (
            <button onClick={() => onSelect(null)}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 500, color: P.accent, padding: '2px 8px', borderRadius: 999 }}
              title="Quitar filtro">Ver todas ›</button>
          )}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.max(1, Math.min(marcas.length, 4))}, 1fr)`, gap: 10 }}>
        {marcas.length === 0 && (
          <div style={{ padding: '18px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11, gridColumn: '1 / -1' }}>Sin datos de marca</div>
        )}
        {marcas.map((m, i) => {
          const isActive = selected === m.name;
          const isDim = anySelected && !isActive;
          const pct = total > 0 ? (m.monto / total * 100) : 0;
          const dark = shade(m.color, 0.28);
          const yoyStr = m.yoy != null ? `${m.yoy >= 0 ? '+' : ''}${m.yoy.toFixed(0)}% YoY` : '—';
          return (
            <div
              key={m.name}
              onClick={() => onSelect(isActive ? null : m.name)}
              style={{
                padding: '14px 16px', borderRadius: 12,
                background: `linear-gradient(135deg, ${m.color} 0%, ${dark} 100%)`,
                border: `1px solid ${isActive ? 'rgba(255,255,255,0.6)' : 'transparent'}`,
                boxShadow: isActive ? '0 6px 18px rgba(0,0,0,0.14)' : '0 1px 3px rgba(0,0,0,0.06)',
                cursor: 'pointer', opacity: isDim ? 0.45 : 1,
                color: '#FFF', transition: 'transform 160ms, box-shadow 160ms, opacity 160ms',
                position: 'relative', overflow: 'hidden',
              }}
              onMouseEnter={(e) => { if (!isDim) e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, fontWeight: 700, opacity: 0.55 }}>#{i + 1}</span>
                {m.yoy != null && (
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.20)', color: '#FFF' }}>{yoyStr}</span>
                )}
              </div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em' }}>{m.name}</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 2 }}>{fmt.money(m.monto)}</div>
              <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>
                {pct.toFixed(0)}% de la mezcla · {fmt.int(m.piezas)} pz{m.skus ? ` · ${m.skus} SKUs` : ''}
              </div>
              <div style={{ marginTop: 10, height: 5, background: 'rgba(255,255,255,0.20)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: '#FFF', borderRadius: 999, width: `${pct}%`, transition: 'width 400ms' }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════ Ferruteck Strip ═══════════════
function FerruteckStrip({ recos }) {
  if (!recos || recos.length === 0) return null;
  return (
    <div style={{
      borderRadius: 12, padding: '12px 16px', color: '#FFF',
      background: `radial-gradient(120% 130% at 20% 30%, rgba(191,90,242,0.35), transparent 50%),
                   radial-gradient(120% 130% at 90% 90%, rgba(100,210,255,0.28), transparent 55%),
                   linear-gradient(180deg,#0F0B24 0%,#1A0F3E 100%)`,
      display: 'grid', gridTemplateColumns: `auto ${recos.map(() => '1fr').join(' ')}`, gap: 16, alignItems: 'center',
    }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <Sparkles size={12} /> Ferruteck
      </span>
      {recos.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{r.icon}</div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: '#FFF', lineHeight: 1.15 }}>{r.t}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)' }}>{r.s}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════ Tabla SKU ═══════════════
function TablaSKU({ theme, P, isDark, rows, busqueda, onChangeBusqueda, orden, onToggleSort, maxCelda, mesActual, marcaFilter, onClearMarca, familiaFilter, onClearFamilia }) {
  // Heat pill · idéntico a SI V2 (4 niveles Apple iOS blue)
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

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Detalle por SKU
        </h5>
        {marcaFilter && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `${marcaColor(marcaFilter)}18`, border: `1px solid ${marcaColor(marcaFilter)}40`, color: marcaColor(marcaFilter), fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600 }}>
            Marca: {marcaFilter}
            <button onClick={onClearMarca} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, color: 'inherit', fontSize: 14, lineHeight: 1, marginLeft: 2 }} title="Quitar filtro">×</button>
          </span>
        )}
        {familiaFilter && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `${P.accent}18`, border: `1px solid ${P.accent}40`, color: P.accent, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600 }}>
            Familia: {familiaFilter}
            <button onClick={onClearFamilia} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, color: P.accent, fontSize: 14, lineHeight: 1, marginLeft: 2 }} title="Quitar filtro">×</button>
          </span>
        )}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${theme.border}`, borderRadius: 999, height: 28, fontSize: 11, color: theme.textMuted, flex: 1, maxWidth: 280 }}>
          <Search size={12} />
          <input value={busqueda} onChange={(e) => onChangeBusqueda(e.target.value)}
            placeholder="Buscar SKU, descripción, marca…"
            style={{ border: 0, outline: 0, background: 'transparent', flex: 1, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text }} />
        </div>
        <span style={{ marginLeft: 'auto', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
          <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{rows.length}</strong> SKUs
        </span>
      </div>
      <div style={{ overflowX: 'auto', maxHeight: '65vh' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
          <thead>
            <tr>
              <th style={headStyle(theme)}>Marca</th>
              <th style={headStyle(theme)}>SKU</th>
              <th style={headStyle(theme)}>Descripción</th>
              <th style={{ ...headStyle(theme), textAlign: 'center' }}>Roadmap</th>
              {MESES.map((m, i) => (
                <th key={m} style={{ ...headStyle(theme), textAlign: 'right', opacity: i + 1 > mesActual ? 0.5 : 1 }}>{m}</th>
              ))}
              <SortableHeader theme={theme} col="promedio" label="Prom." orden={orden} onToggleSort={onToggleSort} align="right" />
              <SortableHeader theme={theme} col="total" label="Total" orden={orden} onToggleSort={onToggleSort} align="right" />
              <SortableHeader theme={theme} col="invStock" label={<>Inv.<br/>Digitalife</>} orden={orden} onToggleSort={onToggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5 + MESES.length + 3} style={{ padding: '32px', textAlign: 'center', color: theme.textMuted }}>Sin SKUs para los filtros seleccionados.</td></tr>
            )}
            {rows.slice(0, 500).map((r) => {
              const rmpStyle = r.rdmp ? roadmapChipStyle(r.rdmp, P, theme) : null;
              return (
                <tr key={r.sku}>
                  <td style={cellStyle(theme)}><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: marcaColor(r.marca) }}>{r.marca || '—'}</span></td>
                  <td style={{ ...cellStyle(theme), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{r.sku}</td>
                  <td style={{ ...cellStyle(theme), color: theme.textMuted, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
                  <td style={{ ...cellStyle(theme), textAlign: 'center' }}>
                    {rmpStyle ? <span style={{ display: 'inline-block', fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', padding: '2px 6px', borderRadius: 4, background: rmpStyle.bg, color: rmpStyle.color }}>{r.rdmp}</span>
                      : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}
                  </td>
                  {r.piezas.map((v, i) => {
                    const h = heatCell(v);
                    return (
                      <td key={i} style={{ ...cellStyle(theme, 'right'), padding: '4px 6px', fontFamily: '"SF Mono", ui-monospace, monospace', opacity: i + 1 > mesActual ? 0.5 : 1 }}>
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
                  <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: r.invStock > 0 ? theme.text : theme.textMuted }}>{r.invStock > 0 ? fmt.int(r.invStock) : '—'}</td>
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

function SortableHeader({ theme, col, label, orden, onToggleSort, align }) {
  const active = orden.col === col;
  const Icon = !active ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th style={{ ...headStyle(theme), textAlign: align || 'left', cursor: 'pointer' }} onClick={() => onToggleSort(col)}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: active ? theme.text : theme.textMuted }}>{label}<Icon size={10} /></span>
    </th>
  );
}
function headStyle(theme) {
  return {
    position: 'sticky', top: 0, background: theme.surface, textAlign: 'left',
    fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em',
    color: theme.textMuted, fontWeight: 600, padding: '8px 6px',
    borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
  };
}
function cellStyle(theme, align) {
  return {
    padding: '7px 6px', borderBottom: `1px solid ${theme.divider || theme.border}`,
    verticalAlign: 'middle', textAlign: align || 'left',
  };
}
