// SellOutDicotech · rediseño Apple V2 para Dicotech
// ─ Basado en SellOutClienteV2 con mejoras aprovechando la data más rica de Dicotech:
//    · KPI "Ticket promedio" (SO / TX) con MoM
//    · KPI "Clientes activos" (distintos del mes) con frecuencia
//    · Nueva sección "Físico vs Online" (donut 2 segmentos)
//    · Nueva sección "Ranking sucursales" (barras horizontales top 6)
// ─ Sin split por marca (Dicotech es single-brand Acteck)

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Sparkles } from 'lucide-react';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const Q_MESES = { Q1: [1,2,3], Q2: [4,5,6], Q3: [7,8,9], Q4: [10,11,12], anio: [1,2,3,4,5,6,7,8,9,10,11,12] };

const SUCURSAL_META = {
  'dicoags2':  { label: 'Aguascalientes', tipo: 'fisica' },
  'leon2':     { label: 'León',           tipo: 'fisica' },
  'Arboledas': { label: 'Arboledas',      tipo: 'fisica' },
  'GDL':       { label: 'Guadalajara',    tipo: 'fisica' },
  'ZACATECAS': { label: 'Zacatecas',      tipo: 'fisica' },
  'santafe':   { label: 'Santa Fe',       tipo: 'fisica' },
  'DC':        { label: 'DC',             tipo: 'fisica' },
  'AMAZON':    { label: 'Amazon',         tipo: 'online' },
  'Internet':  { label: 'Internet',       tipo: 'online' },
  'dropship':  { label: 'Dropship',       tipo: 'online' },
};
const metaSuc = (name) => SUCURSAL_META[name] || { label: name || '(sin sucursal)', tipo: 'online' };

function roadmapChipStyle(rdmp, P, theme) {
  const key = String(rdmp || '').toUpperCase();
  const map = {
    RMI:  { bg: `${P.teal}22`,   color: P.teal },
    RML:  { bg: `${P.purple}22`, color: P.purple },
    RMS:  { bg: `${P.pink}22`,   color: P.pink },
    NVS:  { bg: `${P.green}22`,  color: P.green },
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
  moneyFull: (n) => {
    if (n == null || !isFinite(n)) return '—';
    return `$${Math.round(n).toLocaleString('es-MX')}`;
  },
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
export default function SellOutDicotech({ clienteKey = 'dicotech' }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const anioPrev = anio - 1;

  const [loading, setLoading] = useState(true);
  const [mensual, setMensual] = useState([]);
  const [skuMesRaw, setSkuMesRaw] = useState([]);
  const [sucursalMes, setSucursalMes] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [inventarioCliente, setInventarioCliente] = useState([]);
  const [rango, setRango] = useState(() => new Set(['Q3']));
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [familiaFilter, setFamiliaFilter] = useState(null);
  const [sucursalFilter, setSucursalFilter] = useState(null); // reservado para futuro drill

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [mes, skuMes, sucMes, rdmp, inv] = await Promise.all([
        fetchAll('v_sellout_dicotech_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas'),
        fetchAll('v_sellout_dicotech_sku_mes', 'sku,anio,mes,piezas,monto',
          (q) => q.in('anio', [anioPrev, anio])),
        fetchAll('v_sellout_dicotech_sucursal_mes', 'sucursal,anio,mes,piezas,monto,tx,clientes_distintos',
          (q) => q.eq('anio', anio)),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp,sort_order'),
        fetchAll('inventario_cliente', 'sku,stock,valor,precio_venta,costo_convenio,anio,semana,fecha_ultima_venta,dias_sin_venta',
          (q) => q.eq('cliente', clienteKey)),
      ]);
      setMensual(mes);
      setSkuMesRaw(skuMes);
      setSucursalMes(sucMes);
      setRoadmap(rdmp);
      setInventarioCliente(inv);
      setLoading(false);
    })();
  }, [clienteKey, anio, anioPrev]);

  const mesActual = useMemo(() => {
    let last = 1;
    for (const r of mensual) if (r.anio === anio && Number(r.piezas) > 0) last = Math.max(last, r.mes);
    return last;
  }, [mensual, anio]);

  useEffect(() => {
    const q = mesActual <= 3 ? 'Q1' : mesActual <= 6 ? 'Q2' : mesActual <= 9 ? 'Q3' : 'Q4';
    setRango(new Set([q]));
  }, [mesActual]);

  const mesesRango = useMemo(() => {
    if (!rango || typeof rango.has !== 'function' || rango.size === 0) return Q_MESES.anio;
    const set = new Set();
    for (const q of rango) (Q_MESES[q] || []).forEach(m => set.add(m));
    return Array.from(set).sort((a, b) => a - b);
  }, [rango]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  // Serie mensual por año — monto + piezas + tx + clientes_distintos
  const mensualPorAnio = useMemo(() => {
    const m = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    const p = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    const t = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    const c = { [anioPrev]: Array(12).fill(0), [anio]: Array(12).fill(0) };
    for (const r of mensual) {
      const y = r.anio, i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      if (m[y]) {
        m[y][i] = Number(r.monto) || 0;
        p[y][i] = Number(r.piezas) || 0;
        t[y][i] = Number(r.tx) || 0;
        c[y][i] = Number(r.clientes_distintos) || 0;
      }
    }
    return { monto: m, piezas: p, tx: t, clientes: c };
  }, [mensual, anio, anioPrev]);

  // KPIs
  const kpis = useMemo(() => {
    const mtdMonto = mensualPorAnio.monto[anio][mesActual - 1] || 0;
    const mtdPiezas = mensualPorAnio.piezas[anio][mesActual - 1] || 0;
    const mtdTx = mensualPorAnio.tx[anio][mesActual - 1] || 0;
    const mtdClientes = mensualPorAnio.clientes[anio][mesActual - 1] || 0;
    const mtdPrev = mensualPorAnio.monto[anioPrev][mesActual - 1] || 0;
    const mtdPiezasPrev = mensualPorAnio.piezas[anioPrev][mesActual - 1] || 0;
    const yoyMtd = mtdPrev > 0 ? ((mtdMonto - mtdPrev) / mtdPrev * 100) : null;

    let ytdMonto = 0, ytdPiezas = 0, ytdTx = 0, ytdMontoPrev = 0;
    for (let i = 0; i < mesActual; i++) {
      ytdMonto += mensualPorAnio.monto[anio][i];
      ytdPiezas += mensualPorAnio.piezas[anio][i];
      ytdTx += mensualPorAnio.tx[anio][i];
      ytdMontoPrev += mensualPorAnio.monto[anioPrev][i];
    }
    const yoyYtd = ytdMontoPrev > 0 ? ((ytdMonto - ytdMontoPrev) / ytdMontoPrev * 100) : null;

    // MoM montos + ticket + clientes
    const idxPrev = mesActual - 2;
    const momPrev = idxPrev >= 0 ? (mensualPorAnio.monto[anio][idxPrev] || 0) : 0;
    const momPct = momPrev > 0 ? ((mtdMonto - momPrev) / momPrev * 100) : null;
    const momPrevTx = idxPrev >= 0 ? (mensualPorAnio.tx[anio][idxPrev] || 0) : 0;
    const momPrevClientes = idxPrev >= 0 ? (mensualPorAnio.clientes[anio][idxPrev] || 0) : 0;

    // Ticket promedio del mes
    const ticketMtd = mtdTx > 0 ? mtdMonto / mtdTx : null;
    const momPrevMonto = idxPrev >= 0 ? (mensualPorAnio.monto[anio][idxPrev] || 0) : 0;
    const ticketPrev = momPrevTx > 0 ? momPrevMonto / momPrevTx : null;
    const ticketMomPct = ticketPrev && ticketPrev > 0 ? ((ticketMtd - ticketPrev) / ticketPrev * 100) : null;

    // Clientes MoM
    const clientesMomPct = momPrevClientes > 0 ? ((mtdClientes - momPrevClientes) / momPrevClientes * 100) : null;
    const frecuencia = mtdClientes > 0 ? mtdTx / mtdClientes : null;

    return {
      mtdMonto, mtdPiezas, mtdTx, mtdClientes,
      mtdPrev, mtdPiezasPrev, yoyMtd,
      ytdMonto, ytdPiezas, ytdTx, ytdMontoPrev, yoyYtd,
      momPrev, momPct, momPrevTx, momPrevClientes,
      ticketMtd, ticketPrev, ticketMomPct,
      clientesMomPct, frecuencia,
    };
  }, [mensualPorAnio, anio, anioPrev, mesActual]);

  // Matriz SKU × mes (piezas)
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

  // Familias YTD por MONTO SO (no por inventario) — más pertinente en Sell Out
  const familiasSOYTD = useMemo(() => {
    const CAT_COLORS = [P.teal, P.orange, P.green, P.purple, P.red, P.indigo, P.pink, theme.textMuted, P.accent];
    const map = new Map();
    for (const r of skuMesRaw) {
      if (r.anio !== anio) continue;
      if (r.mes > mesActual) continue;
      const rd = roadmapMap.get(r.sku);
      const famRaw = ((rd?.familia || '').trim()) || 'Sin familia';
      const key = famRaw.charAt(0).toUpperCase() + famRaw.slice(1).toLowerCase();
      if (!map.has(key)) map.set(key, { name: key, monto: 0, piezas: 0, skus: new Set() });
      const it = map.get(key);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.skus.add(r.sku);
    }
    const arr = Array.from(map.values())
      .map((v) => ({ ...v, skus: v.skus.size }))
      .sort((a, b) => b.monto - a.monto);
    return arr.map((v, i) => ({ ...v, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [skuMesRaw, roadmapMap, anio, mesActual, P, theme]);

  const familiasSOTot = useMemo(() => {
    let monto = 0, piezas = 0;
    for (const f of familiasSOYTD) { monto += f.monto; piezas += f.piezas; }
    return { monto, piezas };
  }, [familiasSOYTD]);

  // Inventario (para columna Inv. tabla)
  const inventarioMap = useMemo(() => {
    const m = new Map();
    for (const r of inventarioCliente) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = m.get(r.sku);
      if (!prev || key > prev._key) {
        const stock = Number(r.stock) || 0;
        const valorRaw = Number(r.valor) || 0;
        const costoConv = Number(r.costo_convenio) || 0;
        const precioVta = Number(r.precio_venta) || 0;
        const valor = valorRaw > 0 ? valorRaw : stock * (costoConv || precioVta);
        m.set(r.sku, {
          stock, valor,
          dias_sin_venta: Number(r.dias_sin_venta) || null,
          _key: key,
        });
      }
    }
    return m;
  }, [inventarioCliente]);

  const skusConInventario = useMemo(() => {
    const s = new Set();
    for (const [sku, v] of inventarioMap) if (v.stock > 0) s.add(sku);
    return s;
  }, [inventarioMap]);

  // ═════ Sucursales YTD · agregado + split físico/online ═════
  const sucursalesYTD = useMemo(() => {
    const map = new Map();
    for (const r of sucursalMes) {
      if (r.anio !== anio) continue;
      if (r.mes > mesActual) continue;
      const suc = r.sucursal || '(sin sucursal)';
      if (!map.has(suc)) map.set(suc, { sucursal: suc, monto: 0, piezas: 0, tx: 0, clientes: 0, montoActual: 0, montoPrev: 0 });
      const it = map.get(suc);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.tx += Number(r.tx) || 0;
      it.clientes = Math.max(it.clientes, Number(r.clientes_distintos) || 0);
      if (r.mes === mesActual) it.montoActual = Number(r.monto) || 0;
      if (r.mes === mesActual - 1) it.montoPrev = Number(r.monto) || 0;
    }
    const arr = Array.from(map.values()).map((s) => {
      const meta = metaSuc(s.sucursal);
      const momPct = s.montoPrev > 0 ? ((s.montoActual - s.montoPrev) / s.montoPrev * 100) : null;
      return { ...s, label: meta.label, tipo: meta.tipo, momPct };
    }).sort((a, b) => b.monto - a.monto);
    return arr;
  }, [sucursalMes, anio, mesActual]);

  const splitFisicoOnline = useMemo(() => {
    let fisMonto = 0, fisTx = 0, fisClientes = 0;
    let onlMonto = 0, onlTx = 0, onlClientes = 0;
    for (const s of sucursalesYTD) {
      if (s.tipo === 'fisica') {
        fisMonto += s.monto; fisTx += s.tx; fisClientes += s.clientes;
      } else {
        onlMonto += s.monto; onlTx += s.tx; onlClientes += s.clientes;
      }
    }
    const total = fisMonto + onlMonto;
    const nFis = sucursalesYTD.filter(s => s.tipo === 'fisica').length;
    const nOnl = sucursalesYTD.filter(s => s.tipo === 'online').length;
    return {
      fis: { monto: fisMonto, tx: fisTx, clientes: fisClientes, n: nFis, ticket: fisTx > 0 ? fisMonto / fisTx : null, pct: total > 0 ? (fisMonto / total * 100) : 0 },
      onl: { monto: onlMonto, tx: onlTx, clientes: onlClientes, n: nOnl, ticket: onlTx > 0 ? onlMonto / onlTx : null, pct: total > 0 ? (onlMonto / total * 100) : 0 },
      total,
    };
  }, [sucursalesYTD]);

  // Timeline
  const timelineMeses = useMemo(() => {
    return mesesRango.map((m) => {
      const i = m - 1;
      return {
        label: MESES[i], mes: m,
        sellIn: mensualPorAnio.monto[anio][i] || 0,
        sellInPrev: mensualPorAnio.monto[anioPrev][i] || 0,
        actual: m === mesActual,
        futuro: m > mesActual,
      };
    });
  }, [mesesRango, mensualPorAnio, anio, anioPrev, mesActual]);

  const timelineSums = useMemo(() => {
    let s2026 = 0, s2025 = 0;
    for (const d of timelineMeses) { s2026 += d.sellIn; s2025 += d.sellInPrev; }
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    return { s2026, s2025, deltaYoY };
  }, [timelineMeses]);

  const roadmapOrdenado = useMemo(() => {
    return [...roadmap].sort((a, b) => {
      const sa = a.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(a.sort_order);
      const sb = b.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(b.sort_order);
      if (sa !== sb) return sa - sb;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    });
  }, [roadmap]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const rows = [];
    for (const r of roadmapOrdenado) {
      const tieneVenta = skusVendidos.has(r.sku);
      const tieneInv = skusConInventario.has(r.sku);
      if (!tieneVenta && !tieneInv) continue;
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
        invStock: inv?.stock || 0,
        invValor: inv?.valor || 0,
      });
    }
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => ((a[orden.col] || 0) - (b[orden.col] || 0)) * factor);
    }
    return rows;
  }, [roadmapOrdenado, skusVendidos, skusConInventario, inventarioMap, matrizSku, busqueda, familiaFilter, orden, mesActual]);

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
    if (kpis.ticketMomPct != null && kpis.ticketMomPct >= 5) return `Ticket promedio subió ${kpis.ticketMomPct.toFixed(0)}% vs ${MESES_LARGO[mesActual - 2] || MESES_LARGO[11]}`;
    if (kpis.yoyMtd != null && kpis.yoyMtd >= 10) return `${MESES_LARGO[mesActual - 1]} crece ${kpis.yoyMtd.toFixed(0)}% YoY`;
    if (familiasSOYTD[0]) return `${familiasSOYTD[0].name} lidera con ${fmt.money(familiasSOYTD[0].monto)}`;
    return `Sell Out ${MESES_LARGO[mesActual - 1]} · ${fmt.money(kpis.mtdMonto)}`;
  };
  const subnarrativa = () => {
    const parts = [];
    parts.push(`${fmt.money(kpis.mtdMonto)} vendidos`);
    if (kpis.mtdTx > 0) parts.push(`${fmt.int(kpis.mtdTx)} tx`);
    if (kpis.mtdClientes > 0) parts.push(`${fmt.int(kpis.mtdClientes)} clientes distintos`);
    if (sucursalesYTD[0]) parts.push(`${sucursalesYTD[0].label} lidera`);
    return parts.join(' · ');
  };

  // Ferruteck recos
  const copilotRecos = useMemo(() => {
    const out = [];
    // Top sucursal online creciente
    const topOnl = sucursalesYTD.filter(s => s.tipo === 'online' && (s.momPct || 0) >= 10).sort((a, b) => (b.momPct || 0) - (a.momPct || 0))[0];
    if (topOnl) {
      out.push({ icon: '🚀', t: `${topOnl.label} +${topOnl.momPct.toFixed(0)}% MoM`, s: `${fmt.money(topOnl.monto)} YTD · canal online en aceleración` });
    }
    // Ticket subiendo
    if (kpis.ticketMomPct != null && kpis.ticketMomPct >= 5) {
      out.push({ icon: '📈', t: `Ticket sube ${kpis.ticketMomPct.toFixed(0)}% en ${MESES[mesActual - 1]}`, s: `${fmt.moneyFull(kpis.ticketMtd)} vs ${fmt.moneyFull(kpis.ticketPrev)} · mix premium jala` });
    }
    // Sucursal en caída
    const sucCae = sucursalesYTD.filter(s => s.momPct != null && s.momPct < -2).sort((a, b) => (a.momPct || 0) - (b.momPct || 0))[0];
    if (sucCae) {
      out.push({ icon: '⚠️', t: `${sucCae.label} ${sucCae.momPct.toFixed(0)}% MoM`, s: 'Revisa piso / precio / rotación' });
    }
    // Sucursal top absoluta si no hemos usado otra reco similar
    if (out.length < 3 && sucursalesYTD[0]) {
      const s = sucursalesYTD[0];
      out.push({ icon: '🏆', t: `${s.label} lidera con ${fmt.money(s.monto)}`, s: `${fmt.int(s.tx)} tx · ${fmt.int(s.clientes)} clientes` });
    }
    return out.slice(0, 3);
  }, [sucursalesYTD, kpis, mesActual]);

  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  if (loading) {
    return <FerrutekLoader label="Cargando Sell Out…" sub={`Trayendo sell out de ${clienteKey}`} minHeight={480} />;
  }

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {/* Hero — 4 stats (agregamos Clientes YTD) */}
      <div style={{
        background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px',
        display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 18, alignItems: 'center',
      }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: P.teal }} />
            Sell Out · Dicotech · {MESES_LARGO[mesActual - 1]} {anio}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {narrativa()}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 460, lineHeight: 1.4, margin: 0 }}>
            {subnarrativa()}
          </p>
        </div>
        <HeroStat k={`MTD ${MESES[mesActual - 1]}`} v={fmt.money(kpis.mtdMonto)} sub={kpis.mtdTx > 0 ? `${fmt.int(kpis.mtdTx)} tx` : `${fmt.int(kpis.mtdPiezas)} pz`} />
        <HeroStat k={`YTD ${anio}`} v={fmt.money(kpis.ytdMonto)} sub={kpis.ytdTx > 0 ? `${fmt.int(kpis.ytdTx)} tx` : `${fmt.int(kpis.ytdPiezas)} pz`} />
        <HeroStat k={`YoY ${MESES[mesActual - 1]}`} v={kpis.yoyMtd != null ? `${kpis.yoyMtd >= 0 ? '+' : ''}${kpis.yoyMtd.toFixed(0)}%` : '—'} sub={`vs ${anioPrev}`} valColor={kpis.yoyMtd == null ? undefined : kpis.yoyMtd >= 0 ? P.green : P.red} />
        {kpis.mtdClientes > 0 && (
          <HeroStat k="Clientes MTD" v={fmt.int(kpis.mtdClientes)} sub="distintos" />
        )}
      </div>

      {/* KPI cards — MTD, YTD, Ticket promedio (NUEVO), Clientes activos (NUEVO) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} P={P}
          eyebrow={`MTD · ${MESES[mesActual - 1]}`}
          badge={kpis.yoyMtd != null ? { l: `${kpis.yoyMtd >= 0 ? '+' : ''}${Math.round(kpis.yoyMtd)}% YoY`, tone: kpis.yoyMtd >= 0 ? 'good' : 'warn' } : null}
          title="Sell Out del mes"
          big={fmt.money(kpis.mtdMonto)}
          bigColor={P.teal}
          bigSmall={kpis.mtdTx > 0 ? `${fmt.int(kpis.mtdTx)} tx` : `${fmt.int(kpis.mtdPiezas)} pz`}
          sub={<>
            {kpis.mtdPrev > 0 ? <><strong style={{ color: (kpis.yoyMtd || 0) >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{(kpis.yoyMtd || 0) >= 0 ? '+' : ''}{fmt.money(kpis.mtdMonto - kpis.mtdPrev)}</strong> vs {MESES[mesActual - 1]} {anioPrev}</> : `vs ${anioPrev} sin datos`}
            {kpis.momPct != null && <> · <strong style={{ color: kpis.momPct >= 0 ? P.green : P.red, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{kpis.momPct >= 0 ? '+' : ''}{kpis.momPct.toFixed(1)}%</strong> MoM</>}
          </>}
        />
        <KpiCard theme={theme} P={P}
          eyebrow={`YTD · ${anio}`}
          badge={kpis.yoyYtd != null ? { l: `${kpis.yoyYtd >= 0 ? '+' : ''}${Math.round(kpis.yoyYtd)}% YoY`, tone: kpis.yoyYtd >= 0 ? 'good' : 'warn' } : null}
          title="Facturado a consumidor"
          big={fmt.money(kpis.ytdMonto)}
          bigSmall={kpis.ytdTx > 0 ? `${fmt.int(kpis.ytdTx)} tx` : `${fmt.int(kpis.ytdPiezas)} pz`}
          sub={<>{filas.length} SKUs vendidos · {familiasSOYTD.length} familias{sucursalesYTD[0] ? <> · Top <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{sucursalesYTD[0].label}</strong> {fmt.money(sucursalesYTD[0].monto)}</> : null}</>}
        />
        {/* KPI NUEVO: Ticket promedio */}
        <KpiCard theme={theme} P={P}
          eyebrow={`Ticket promedio · ${MESES[mesActual - 1]}`}
          badge={{ l: 'nuevo', tone: 'new' }}
          title="SO / TX"
          big={kpis.ticketMtd != null ? fmt.moneyFull(kpis.ticketMtd) : '—'}
          bigColor={P.purple}
          bigSmall={kpis.ticketMomPct != null ? `${kpis.ticketMomPct >= 0 ? '+' : ''}${kpis.ticketMomPct.toFixed(0)}% MoM` : ''}
          sub={<>
            {kpis.ticketPrev != null && <>{fmt.moneyFull(kpis.ticketPrev)} en {MESES_LARGO[mesActual - 2] || MESES_LARGO[11]}</>}
            {kpis.ticketMomPct != null && kpis.ticketMomPct >= 5 && <> · <strong style={{ color: P.green, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>▲</strong> sube mix premium</>}
          </>}
        />
        {/* KPI NUEVO: Clientes activos */}
        <KpiCard theme={theme} P={P}
          eyebrow={`Clientes activos · ${MESES[mesActual - 1]}`}
          badge={{ l: 'nuevo', tone: 'new' }}
          title="Compradores distintos"
          big={fmt.int(kpis.mtdClientes)}
          bigColor={P.indigo}
          bigSmall={kpis.clientesMomPct != null ? `${kpis.clientesMomPct >= 0 ? '+' : ''}${kpis.clientesMomPct.toFixed(0)}% MoM` : ''}
          sub={<>
            {kpis.momPrevClientes > 0 && <>{fmt.int(kpis.momPrevClientes)} en {MESES_LARGO[mesActual - 2] || MESES_LARGO[11]}</>}
            {kpis.frecuencia != null && <> · Frecuencia <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{kpis.frecuencia.toFixed(2)}</strong> tx/cliente</>}
          </>}
        />
      </div>

      {/* Fila: Timeline + Composición por familia (donut) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <TimelineLineal theme={theme} P={P} isDark={isDark}
          data={timelineMeses} sums={timelineSums} rango={rango} onChangeRango={setRango}
          anio={anio} anioPrev={anioPrev} mesActual={mesActual} />
        <FamiliaSOCard theme={theme} P={P}
          familias={familiasSOYTD} totalMonto={familiasSOTot.monto} totalPiezas={familiasSOTot.piezas}
          selected={familiaFilter} onSelect={setFamiliaFilter} />
      </div>

      {/* Nueva sección: Físico vs Online + Ranking sucursales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.3fr)', gap: 10, alignItems: 'stretch' }}>
        <FisicoOnlineCard theme={theme} P={P} split={splitFisicoOnline} />
        <SucursalesRankingCard theme={theme} P={P} sucursales={sucursalesYTD} />
      </div>

      {/* Ferruteck strip */}
      <FerruteckStrip recos={copilotRecos} />

      {/* Tabla SKU */}
      <TablaSKU theme={theme} P={P} isDark={isDark}
        rows={filas} busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        maxCelda={maxCelda} mesActual={mesActual}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)} />
    </div>
  );
}

// ═══════════════ Hero Stat ═══════════════
function HeroStat({ k, v, sub, valColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, color: valColor || '#FFF', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>{sub}</div>
    </div>
  );
}

// ═══════════════ KPI Card ═══════════════
function KpiCard({ theme, P, eyebrow, badge, title, big, bigSmall, bigColor, sub }) {
  const badgeStyle = (tone) => {
    if (tone === 'good') return { bg: 'rgba(48,209,88,0.14)', color: '#0F8A3A' };
    if (tone === 'warn') return { bg: 'rgba(255,159,10,0.14)', color: '#B76E00' };
    if (tone === 'new')  return { bg: `${P.purple}22`, color: P.purple };
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
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: bigColor || theme.text, marginTop: 4 }}>
        {big}
        {bigSmall && <span style={{ fontFamily: TYPO.fontText, fontSize: 12, color: theme.textMuted, fontWeight: 500, marginLeft: 4 }}>{bigSmall}</span>}
      </div>
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>
    </div>
  );
}

// ═══════════════ Timeline Lineal (color = P.teal para SO) ═══════════════
function TimelineLineal({ theme, P, isDark, data, sums, rango, onChangeRango, anio, anioPrev, mesActual }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const W = 700, H = 260;
  const padL = 46, padR = 20, padT = 32, padB = 28;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxRaw = Math.max(1, ...data.map(d => Math.max(d.sellIn, d.sellInPrev)));
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
  const area2026 = cerrados.length > 0
    ? `M ${xOf(0)},${yOf(cerrados[0].sellIn)} ${cerrados.map((d, i) => `L ${xOf(i)},${yOf(d.sellIn)}`).join(' ')} L ${xOf(cerrados.length - 1)},${padT + chartH} L ${xOf(0)},${padT + chartH} Z`
    : '';
  const line2026 = cerrados.map((d, i) => `${xOf(i)},${yOf(d.sellIn)}`).join(' ');
  const line2025 = data.map((d, i) => `${xOf(i)},${yOf(d.sellInPrev)}`).join(' ');
  const hovered = hoverIdx != null ? data[hoverIdx] : null;
  const currentDatum = idxActual >= 0 ? data[idxActual] : null;
  const yTicks = [0, 0.25, 0.50, 0.75, 1].map(f => ({ f, v: maxV * f, y: padT + chartH * (1 - f) }));

  const isSet = rango && typeof rango.has === 'function';
  const isActiveQ = (q) => isSet ? rango.has(q) : rango === q;
  const isActiveAnio = isSet ? rango.size === 4 || rango.size === 0 : rango === 'anio';
  const toggleQ = (q) => {
    if (!isSet) { onChangeRango(new Set([q])); return; }
    const next = new Set(rango);
    if (next.has(q)) next.delete(q); else next.add(q);
    onChangeRango(next);
  };
  const setAnio = () => onChangeRango(new Set(['Q1', 'Q2', 'Q3', 'Q4']));
  const filtros = [{ k: 'Q1', l: 'Q1' }, { k: 'Q2', l: 'Q2' }, { k: 'Q3', l: 'Q3' }, { k: 'Q4', l: 'Q4' }];

  const gradId = `soDicoArea-${anio}`;
  const lineColor = P.teal; // sell out = teal

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 6, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Evolución mensual · Sell Out
          <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>
            Combina trimestres para sumar
          </span>
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
          {filtros.map(f => (
            <button key={f.k} onClick={() => toggleQ(f.k)}
              style={{
                border: 0, background: isActiveQ(f.k) ? theme.surface : 'transparent',
                padding: '4px 10px', borderRadius: 6,
                fontFamily: isActiveQ(f.k) ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 10.5, color: isActiveQ(f.k) ? theme.text : theme.textMuted,
                fontWeight: isActiveQ(f.k) ? 600 : 500, cursor: 'pointer',
                boxShadow: isActiveQ(f.k) ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
                borderWidth: 1, borderStyle: 'solid', borderColor: isActiveQ(f.k) ? theme.border : 'transparent',
              }}>{f.l}</button>
          ))}
          <button onClick={setAnio}
            style={{
              border: 0, background: isActiveAnio ? theme.surface : 'transparent',
              padding: '4px 10px', borderRadius: 6,
              fontFamily: isActiveAnio ? TYPO.fontDisplay : TYPO.fontText,
              fontSize: 10.5, color: isActiveAnio ? theme.text : theme.textMuted,
              fontWeight: isActiveAnio ? 600 : 500, cursor: 'pointer',
              boxShadow: isActiveAnio ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
              borderWidth: 1, borderStyle: 'solid', borderColor: isActiveAnio ? theme.border : 'transparent',
            }}>Año</button>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, padding: '6px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} />SO {anioPrev}</>} v={fmt.money(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={lineColor} />SO {anio}</>} v={fmt.money(sums.s2026)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ YoY" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
        )}
      </div>
      <div style={{ position: 'relative' }}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 260, display: 'block' }}>
          <defs>
            <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.28" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
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
          {area2026 && <path d={area2026} fill={`url(#${gradId})`} />}
          <polyline points={line2025} fill="none" stroke={theme.textMuted} strokeWidth="2" opacity="0.55" />
          <polyline points={line2026} fill="none" stroke={lineColor} strokeWidth="3" />
          {cerrados.map((d, i) => {
            const cx = xOf(i), cy = yOf(d.sellIn);
            return (
              <g key={`p-${i}`}>
                <circle cx={cx} cy={cy} r={d.actual ? 6 : 4}
                  fill={d.actual ? P.green : lineColor}
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
            <text key={`x-${i}`} x={xOf(i)} y={H - 8} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="9"
              fill={d.actual ? P.green : theme.textMuted}
              fontWeight={d.actual ? 700 : 500}
              opacity={d.futuro ? 0.4 : 1}>
              {d.label}
            </text>
          ))}
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

// ═══════════════ Composición por familia · SO YTD (donut stroke-dasharray) ═══════════════
function FamiliaSOCard({ theme, P, familias, totalMonto, totalPiezas, selected, onSelect }) {
  const [expanded, setExpanded] = useState(false);
  const TOP_N = 7;
  const total = familias.reduce((s, f) => s + f.monto, 0);
  const anySelected = selected != null;
  const visibles = expanded ? familias : familias.slice(0, TOP_N);
  const ocultas = familias.length - TOP_N;
  // Ring técnico: stroke-dasharray sobre <circle>
  const size = 210, cx = 120, cy = 120, r = 88, stroke = 34;
  const circ = 2 * Math.PI * r;
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
          Composición por familia · YTD SO
        </h5>
        {anySelected && (
          <button onClick={() => onSelect(null)}
            style={{ background: 'transparent', border: 0, cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 500, color: P.accent, padding: '2px 8px', borderRadius: 999 }}
            title="Quitar filtro">Ver todas ›</button>
        )}
      </div>
      {familias.length === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin datos aún</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `${size}px 1fr`, gap: 16, alignItems: 'center', marginTop: 4 }}>
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
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>YTD SO</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 700, letterSpacing: '-0.025em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{fmt.money(totalMonto)}</div>
                  <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{familias.length} familias</div>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'stretch' }}>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', marginBottom: 2 }}>click filtra tabla</div>
            {visibles.map((f) => {
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
            {ocultas > 0 && (
              <button onClick={() => setExpanded(x => !x)}
                style={{
                  marginTop: 6, padding: '6px 10px', borderRadius: 8, border: 0,
                  background: `${theme.text}06`, color: theme.textMuted, cursor: 'pointer',
                  fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
                }}>
                {expanded ? `Ver menos ▴` : `+ ${ocultas} categorías más ▾`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════ NUEVA: Físico vs Online (donut 2 segmentos) ═══════════════
function FisicoOnlineCard({ theme, P, split }) {
  const size = 160, cx = 120, cy = 120, r = 88, stroke = 34;
  const circ = 2 * Math.PI * r;
  const fisLen = split.total > 0 ? (split.fis.monto / split.total) * circ : 0;
  const onlLen = split.total > 0 ? (split.onl.monto / split.total) * circ : 0;
  const fisColor = P.green;
  const onlColor = P.teal;
  const pctFis = Math.round(split.fis.pct);
  const pctOnl = Math.round(split.onl.pct);
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: '0 0 8px', color: theme.text }}>
        Físico vs Online · YTD
        <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>canal de venta</span>
      </h5>
      {split.total === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin sucursales aún</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `${size}px 1fr`, gap: 16, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: size, height: size }}>
            <svg viewBox="0 0 240 240" width={size} height={size}>
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                strokeWidth={stroke} />
              <g transform={`rotate(-90 ${cx} ${cy})`} fill="none" strokeWidth={stroke}>
                <circle cx={cx} cy={cy} r={r} stroke={fisColor}
                  strokeDasharray={`${fisLen} ${circ}`} strokeDashoffset={0} />
                <circle cx={cx} cy={cy} r={r} stroke={onlColor}
                  strokeDasharray={`${onlLen} ${circ}`} strokeDashoffset={-fisLen} />
              </g>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>Split</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{pctFis}/{pctOnl}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FoRow color={fisColor} kind="FÍSICO" name={`${split.fis.n} sucursales`} monto={split.fis.monto} pct={pctFis} tx={split.fis.tx} clientes={split.fis.clientes} ticket={split.fis.ticket} theme={theme} />
            <FoRow color={onlColor} kind="ONLINE" name="Amazon · Internet · dropship" monto={split.onl.monto} pct={pctOnl} tx={split.onl.tx} clientes={split.onl.clientes} ticket={split.onl.ticket} theme={theme} />
          </div>
        </div>
      )}
    </div>
  );
}

function FoRow({ color, kind, name, monto, pct, tx, clientes, ticket, theme }) {
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 8, alignItems: 'center' }}>
        <span style={{ padding: '3px 8px', borderRadius: 999, background: `${color}22`, color, fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em' }}>{kind}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text }}>{name}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, fontWeight: 600, color: theme.text, textAlign: 'right' }}>{fmt.money(monto)}</span>
      </div>
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3, fontFamily: TYPO.fontText }}>
        {pct}% · {fmt.int(tx)} tx · {fmt.int(clientes)} clientes{ticket != null ? ` · Ticket ${fmt.moneyFull(ticket)}` : ''}
      </div>
    </div>
  );
}

// ═══════════════ NUEVA: Ranking sucursales (barras horizontales top 6) ═══════════════
function SucursalesRankingCard({ theme, P, sucursales }) {
  const [modo, setModo] = useState('monto'); // monto | tx | ticket
  const top = sucursales.slice(0, 6);
  const rows = top.map((s) => {
    const ticket = s.tx > 0 ? s.monto / s.tx : 0;
    return { ...s, ticket };
  });
  const valueOf = (r) => modo === 'monto' ? r.monto : modo === 'tx' ? r.tx : r.ticket;
  const maxVal = Math.max(1, ...rows.map(valueOf));
  const formatValue = (r) => modo === 'monto' ? fmt.money(r.monto) : modo === 'tx' ? fmt.int(r.tx) : fmt.moneyFull(r.ticket);
  const isDark = theme.mode === 'dark';
  const seg = (k, l) => (
    <button key={k} onClick={() => setModo(k)}
      style={{
        border: 0, background: modo === k ? theme.surface : 'transparent',
        padding: '3px 9px', borderRadius: 6,
        fontFamily: modo === k ? TYPO.fontDisplay : TYPO.fontText, fontSize: 10,
        color: modo === k ? theme.text : theme.textMuted, fontWeight: modo === k ? 600 : 500, cursor: 'pointer',
        boxShadow: modo === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        borderWidth: 1, borderStyle: 'solid', borderColor: modo === k ? theme.border : 'transparent',
      }}>{l}</button>
  );

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Ranking sucursales · YTD
          <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>
            top {top.length}
          </span>
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
          {seg('monto', '$')}{seg('tx', 'Tx')}{seg('ticket', 'Ticket')}
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin sucursales aún</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((r, i) => {
            const pct = valueOf(r) / maxVal * 100;
            const isFis = r.tipo === 'fisica';
            const barColor = isFis ? P.teal : P.green;
            return (
              <div key={r.sucursal} style={{ display: 'grid', gridTemplateColumns: '22px 1fr auto', gap: 10, alignItems: 'center' }}>
                <span style={{
                  fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700, color: theme.textMuted,
                  background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 0', textAlign: 'center', letterSpacing: '0.02em',
                }}>{i + 1}</span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {r.label}
                      <span style={{
                        fontFamily: TYPO.fontText, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 600,
                        padding: '1px 6px', borderRadius: 4,
                        background: isFis ? `${P.teal}1F` : `${P.green}1F`,
                        color: isFis ? P.teal : P.green,
                      }}>{isFis ? 'FÍS' : 'ONL'}</span>
                    </span>
                    {r.momPct != null && (
                      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: r.momPct >= 0 ? P.green : P.red }}>
                        {r.momPct >= 0 ? '+' : ''}{r.momPct.toFixed(0)}% MoM
                      </span>
                    )}
                  </div>
                  <div style={{ height: 6, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                    <div style={{ width: `${pct}%`, height: '100%', background: barColor, borderRadius: 999, transition: 'width 400ms' }} />
                  </div>
                </div>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: theme.text, textAlign: 'right', minWidth: 60 }}>{formatValue(r)}</span>
              </div>
            );
          })}
        </div>
      )}
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

// ═══════════════ Tabla SKU (sin marca column · single-brand Acteck) ═══════════════
function TablaSKU({ theme, P, isDark, rows, busqueda, onChangeBusqueda, orden, onToggleSort, maxCelda, mesActual, familiaFilter, onClearFamilia }) {
  const heatCell = (v) => {
    if (v == null || v === 0) return null;
    if (v < 0) return { bg: `${P.red}22`, color: P.red, weight: 600 };
    const r = v / maxCelda;
    const b = P.teal;
    if (r > 0.75) return { bg: b, color: '#FFF', weight: 600 };
    if (r > 0.50) return { bg: isDark ? 'rgba(100,210,255,0.45)' : `${b}59`, color: '#FFF', weight: 600 };
    if (r > 0.25) return { bg: `${b}2E`, color: theme.text };
    return { bg: `${b}14`, color: theme.textMuted };
  };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Detalle por SKU · Sell Out
        </h5>
        {familiaFilter && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: `${P.accent}18`, border: `1px solid ${P.accent}40`, color: P.accent, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600 }}>
            Familia: {familiaFilter}
            <button onClick={onClearFamilia} style={{ background: 'transparent', border: 0, cursor: 'pointer', padding: 0, color: P.accent, fontSize: 14, lineHeight: 1, marginLeft: 2 }} title="Quitar filtro">×</button>
          </span>
        )}
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)', border: `1px solid ${theme.border}`, borderRadius: 999, height: 28, fontSize: 11, color: theme.textMuted, flex: 1, maxWidth: 280 }}>
          <Search size={12} />
          <input value={busqueda} onChange={(e) => onChangeBusqueda(e.target.value)}
            placeholder="Buscar SKU, descripción…"
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
              <th style={headStyle(theme)}>SKU</th>
              <th style={headStyle(theme)}>Descripción</th>
              <th style={headStyle(theme)}>Categoría</th>
              <th style={{ ...headStyle(theme), textAlign: 'center' }}>Roadmap</th>
              {MESES.map((m, i) => (
                <th key={m} style={{ ...headStyle(theme), textAlign: 'right', opacity: i + 1 > mesActual ? 0.5 : 1 }}>{m}</th>
              ))}
              <SortableHeader theme={theme} col="promedio" label="Prom." orden={orden} onToggleSort={onToggleSort} align="right" />
              <SortableHeader theme={theme} col="total" label="Total" orden={orden} onToggleSort={onToggleSort} align="right" />
              <SortableHeader theme={theme} col="invStock" label="Inv." orden={orden} onToggleSort={onToggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4 + MESES.length + 3} style={{ padding: '32px', textAlign: 'center', color: theme.textMuted }}>Sin SKUs para los filtros seleccionados.</td></tr>
            )}
            {rows.slice(0, 500).map((r) => {
              const rmpStyle = r.rdmp ? roadmapChipStyle(r.rdmp, P, theme) : null;
              return (
                <tr key={r.sku}>
                  <td style={{ ...cellStyle(theme), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{r.sku}</td>
                  <td style={{ ...cellStyle(theme), color: theme.textMuted, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
                  <td style={cellStyle(theme)}>{r.categoria || '—'}</td>
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
