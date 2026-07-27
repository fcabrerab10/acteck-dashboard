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
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Sparkles, X, ChevronRight } from 'lucide-react';

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
    '2025': { bg: `${theme.text}0F`, color: theme.textMuted },
  };
  return map[key] || { bg: `${theme.text}0F`, color: theme.textMuted };
}

// Color de marca (como Digitalife: Acteck iOS blue · Balam Rush morado · Vorago naranja)
function marcaColor(marca, P) {
  const key = String(marca || '').trim().toLowerCase();
  if (key === 'balam rush' || key === 'balam') return P.purple;
  if (key === 'vorago') return P.orange;
  if (key === 'acteck') return P.accent;
  return P.accent;
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
  const [inventarioSucursal, setInventarioSucursal] = useState([]);
  const [selloutGeneral, setSelloutGeneral] = useState([]); // detalle transaccional para vendedores/clientes/drill
  const [rango, setRango] = useState(() => new Set(['Q3']));
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [familiaFilter, setFamiliaFilter] = useState(null);
  const [sucursalDrill, setSucursalDrill] = useState(null); // sucursal expandida en el ranking
  const [skuDrill, setSkuDrill] = useState(null); // { sku, descripcion, ... } → abre modal

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [mes, skuMes, sucMes, rdmp, inv, invSuc, general] = await Promise.all([
        fetchAll('v_sellout_dicotech_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas'),
        fetchAll('v_sellout_dicotech_sku_mes', 'sku,anio,mes,piezas,monto',
          (q) => q.in('anio', [anioPrev, anio])),
        fetchAll('v_sellout_dicotech_sucursal_mes', 'sucursal,anio,mes,piezas,monto,tx,clientes_distintos',
          (q) => q.eq('anio', anio)),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp,sort_order'),
        fetchAll('inventario_cliente', 'sku,stock,valor,precio_venta,costo_convenio,anio,semana,fecha_ultima_venta,dias_sin_venta',
          (q) => q.eq('cliente', clienteKey)),
        fetchAll('inventario_cliente_sucursal', 'sku,sucursal,stock,valor,costo_convenio,anio,semana',
          (q) => q.eq('cliente', clienteKey)),
        fetchAll('sellout_general', 'anio,mes,sku,cliente_nombre,vendedor_nombre,sucursal,cantidad,precio_unitario,importe',
          (q) => q.eq('mayorista', 'DICOTECH').in('anio', [anioPrev, anio])),
      ]);
      setMensual(mes);
      setSkuMesRaw(skuMes);
      setSucursalMes(sucMes);
      setRoadmap(rdmp);
      setInventarioCliente(inv);
      setInventarioSucursal(invSuc);
      setSelloutGeneral(general);
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

  // Inventario por sucursal · último snapshot por sku+sucursal
  const inventarioSucursalMap = useMemo(() => {
    const bySku = new Map();
    for (const r of inventarioSucursal) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      if (!bySku.has(r.sku)) bySku.set(r.sku, new Map());
      const bySuc = bySku.get(r.sku);
      const prev = bySuc.get(r.sucursal);
      if (!prev || key > prev._key) {
        const stock = Number(r.stock) || 0;
        const valorRaw = Number(r.valor) || 0;
        const costoConv = Number(r.costo_convenio) || 0;
        const valor = valorRaw > 0 ? valorRaw : stock * costoConv;
        bySuc.set(r.sucursal, { sucursal: r.sucursal, stock, valor, _key: key });
      }
    }
    const out = new Map();
    for (const [sku, bySuc] of bySku) {
      const arr = Array.from(bySuc.values()).filter((x) => x.stock > 0).sort((a, b) => b.stock - a.stock);
      if (arr.length > 0) out.set(sku, arr);
    }
    return out;
  }, [inventarioSucursal]);

  // ═════ Rankings globales de vendedores y clientes finales (YTD del año actual) ═════
  const rankingsGlobales = useMemo(() => {
    const vend = new Map(), vendPrev = new Map();
    const cli = new Map(), cliPrev = new Map();
    for (const r of selloutGeneral) {
      const y = Number(r.anio);
      const mes = Number(r.mes);
      if (mes > mesActual && y === anio) continue;
      const cnt = Number(r.cantidad) || 0;
      const imp = Number(r.importe) || 0;
      const vn = (r.vendedor_nombre || '(sin nombre)').trim() || '(sin nombre)';
      const cn = (r.cliente_nombre || '(sin nombre)').trim() || '(sin nombre)';
      const [mVend, mCli] = y === anio ? [vend, cli] : y === anioPrev ? [vendPrev, cliPrev] : [null, null];
      if (!mVend) continue;
      if (!mVend.has(vn)) mVend.set(vn, { name: vn, monto: 0, piezas: 0, tx: 0, clientes: new Set() });
      const vv = mVend.get(vn);
      vv.monto += imp; vv.piezas += cnt; vv.tx += 1; vv.clientes.add(cn);
      if (!mCli.has(cn)) mCli.set(cn, { name: cn, monto: 0, piezas: 0, tx: 0 });
      const cc = mCli.get(cn);
      cc.monto += imp; cc.piezas += cnt; cc.tx += 1;
    }
    const totVend = Array.from(vend.values()).reduce((s, x) => s + x.monto, 0);
    const totCli = Array.from(cli.values()).reduce((s, x) => s + x.monto, 0);
    const vendedores = Array.from(vend.values()).map((v) => {
      const prev = vendPrev.get(v.name)?.monto || 0;
      return {
        name: v.name, monto: v.monto, piezas: v.piezas, tx: v.tx, clientes: v.clientes.size,
        pct: totVend > 0 ? (v.monto / totVend * 100) : 0,
        yoy: prev > 0 ? ((v.monto - prev) / prev * 100) : null,
      };
    }).sort((a, b) => b.monto - a.monto);
    const clientes = Array.from(cli.values()).map((v) => {
      const prev = cliPrev.get(v.name)?.monto || 0;
      return {
        name: v.name, monto: v.monto, piezas: v.piezas, tx: v.tx,
        pct: totCli > 0 ? (v.monto / totCli * 100) : 0,
        yoy: prev > 0 ? ((v.monto - prev) / prev * 100) : null,
      };
    }).sort((a, b) => b.monto - a.monto);
    return { vendedores, clientes, totVendedores: vend.size, totClientes: cli.size };
  }, [selloutGeneral, anio, anioPrev, mesActual]);

  // ═════ Drill por SUCURSAL: top clientes + top vendedores de una sucursal (YTD) ═════
  const drillSucursal = useMemo(() => {
    if (!sucursalDrill) return null;
    const cli = new Map(), ven = new Map();
    for (const r of selloutGeneral) {
      if (Number(r.anio) !== anio) continue;
      if (Number(r.mes) > mesActual) continue;
      if ((r.sucursal || '(sin sucursal)') !== sucursalDrill) continue;
      const cnt = Number(r.cantidad) || 0;
      const imp = Number(r.importe) || 0;
      const cn = (r.cliente_nombre || '(sin nombre)').trim() || '(sin nombre)';
      const vn = (r.vendedor_nombre || '(sin nombre)').trim() || '(sin nombre)';
      if (!cli.has(cn)) cli.set(cn, { name: cn, monto: 0, piezas: 0 });
      cli.get(cn).monto += imp; cli.get(cn).piezas += cnt;
      if (!ven.has(vn)) ven.set(vn, { name: vn, monto: 0, piezas: 0 });
      ven.get(vn).monto += imp; ven.get(vn).piezas += cnt;
    }
    const totCli = Array.from(cli.values()).reduce((s, x) => s + x.monto, 0);
    const totVen = Array.from(ven.values()).reduce((s, x) => s + x.monto, 0);
    const topClientes = Array.from(cli.values()).map((v) => ({
      ...v, pct: totCli > 0 ? (v.monto / totCli * 100) : 0,
    })).sort((a, b) => b.monto - a.monto).slice(0, 5);
    const topVendedores = Array.from(ven.values()).map((v) => ({
      ...v, pct: totVen > 0 ? (v.monto / totVen * 100) : 0,
    })).sort((a, b) => b.monto - a.monto).slice(0, 5);
    return { topClientes, topVendedores, clientesTotal: cli.size, vendedoresTotal: ven.size };
  }, [sucursalDrill, selloutGeneral, anio, mesActual]);

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

  // Enriquecemos sucursalesYTD con inventario + venta del mes por sucursal
  // Valor de inventario POR sucursal (agregado desde inventarioSucursalMap)
  const inventarioPorSucursal = useMemo(() => {
    const acc = new Map();
    for (const [, sucs] of inventarioSucursalMap) {
      for (const s of sucs) {
        if (!acc.has(s.sucursal)) acc.set(s.sucursal, { stock: 0, valor: 0 });
        const it = acc.get(s.sucursal);
        it.stock += s.stock;
        it.valor += s.valor;
      }
    }
    return acc;
  }, [inventarioSucursalMap]);

  // Venta del MES actual por sucursal
  const ventaMesPorSucursal = useMemo(() => {
    const acc = new Map();
    for (const r of sucursalMes) {
      if (Number(r.anio) !== anio) continue;
      if (Number(r.mes) !== mesActual) continue;
      const suc = r.sucursal || '(sin sucursal)';
      if (!acc.has(suc)) acc.set(suc, { monto: 0, piezas: 0, tx: 0, clientes: 0 });
      const it = acc.get(suc);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.tx += Number(r.tx) || 0;
      it.clientes = Math.max(it.clientes, Number(r.clientes_distintos) || 0);
    }
    return acc;
  }, [sucursalMes, anio, mesActual]);

  // Enriquecemos sucursalesYTD con inventario + venta del mes por sucursal
  const sucursalesEnriched = useMemo(() => {
    return sucursalesYTD.map((s) => {
      const inv = inventarioPorSucursal.get(s.sucursal) || { stock: 0, valor: 0 };
      const vm = ventaMesPorSucursal.get(s.sucursal) || { monto: 0, piezas: 0, tx: 0, clientes: 0 };
      return {
        ...s,
        invStock: inv.stock,
        invValor: inv.valor,
        ventaMes: vm.monto,
        piezasMes: vm.piezas,
        txMes: vm.tx,
        clientesMes: vm.clientes,
      };
    });
  }, [sucursalesYTD, inventarioPorSucursal, ventaMesPorSucursal]);

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

      {/* Nueva sección: Físico vs Online (compacto) + Ranking sucursales (con drill expandible) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 0.55fr) minmax(0, 1.45fr)', gap: 10, alignItems: 'stretch' }}>
        <FisicoOnlineCard theme={theme} P={P} split={splitFisicoOnline} />
        <SucursalesRankingCard theme={theme} P={P} sucursales={sucursalesEnriched}
          drillSucursal={sucursalDrill} onSelectSucursal={setSucursalDrill}
          drillData={drillSucursal}
          mesActualLabel={MESES[mesActual - 1]} />
      </div>

      {/* Nueva sección: Rankings globales Vendedores + Clientes finales · expandibles con drill individual */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <RankingCard theme={theme} P={P} isDark={isDark}
          type="vendedor"
          title="Ranking vendedores · YTD"
          allItems={rankingsGlobales.vendedores}
          totalCount={rankingsGlobales.totVendedores}
          color={P.indigo}
          selloutGeneral={selloutGeneral}
          anio={anio} mesActual={mesActual}
          emptyMsg="Sin datos de vendedores" />
        <RankingCard theme={theme} P={P} isDark={isDark}
          type="cliente"
          title="Ranking clientes finales · YTD"
          allItems={rankingsGlobales.clientes}
          totalCount={rankingsGlobales.totClientes}
          color={P.teal}
          selloutGeneral={selloutGeneral}
          anio={anio} mesActual={mesActual}
          emptyMsg="Sin datos de clientes" />
      </div>

      {/* Ferruteck strip */}
      <FerruteckStrip recos={copilotRecos} />

      {/* Tabla SKU · click en fila expande drill inline debajo */}
      <TablaSKU theme={theme} P={P} isDark={isDark}
        rows={filas} busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        maxCelda={maxCelda} mesActual={mesActual}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)}
        skuOpen={skuDrill?.sku || null}
        onToggleSku={(row) => setSkuDrill((prev) => prev?.sku === row.sku ? null : row)}
        anio={anio} anioPrev={anioPrev}
        selloutGeneral={selloutGeneral}
        inventarioSucursalMap={inventarioSucursalMap} />
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

// ═══════════════ Físico vs Online · compacto (ring 110px + leyenda apretada) ═══════════════
function FisicoOnlineCard({ theme, P, split }) {
  const size = 110, cx = 120, cy = 120, r = 88, stroke = 34;
  const circ = 2 * Math.PI * r;
  const fisLen = split.total > 0 ? (split.fis.monto / split.total) * circ : 0;
  const onlLen = split.total > 0 ? (split.onl.monto / split.total) * circ : 0;
  const fisColor = P.green;
  const onlColor = P.teal;
  const pctFis = Math.round(split.fis.pct);
  const pctOnl = Math.round(split.onl.pct);
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, gap: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Físico vs Online · YTD
        </h5>
        <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic' }}>canal</span>
      </div>
      {split.total === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin sucursales aún</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: `${size}px 1fr`, gap: 12, alignItems: 'center' }}>
          <div style={{ position: 'relative', width: size, height: size }}>
            <svg viewBox="0 0 240 240" width={size} height={size}>
              <circle cx={cx} cy={cy} r={r} fill="none"
                stroke={theme.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
                strokeWidth={stroke} />
              <g transform={`rotate(-90 ${cx} ${cy})`} fill="none" strokeWidth={stroke}>
                <circle cx={cx} cy={cy} r={r} stroke={fisColor}
                  strokeDasharray={`${fisLen} ${circ}`} strokeDashoffset={0}
                  style={{ transition: 'stroke-dasharray 460ms cubic-bezier(.4,0,.2,1)' }} />
                <circle cx={cx} cy={cy} r={r} stroke={onlColor}
                  strokeDasharray={`${onlLen} ${circ}`} strokeDashoffset={-fisLen}
                  style={{ transition: 'stroke-dasharray 460ms cubic-bezier(.4,0,.2,1)' }} />
              </g>
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>Split</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{pctFis}/{pctOnl}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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
        <span style={{ padding: '2px 7px', borderRadius: 999, background: `${color}22`, color, fontFamily: TYPO.fontDisplay, fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em' }}>{kind}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11.5, fontWeight: 600, color: theme.text, textAlign: 'right' }}>{fmt.money(monto)}</span>
      </div>
      <div style={{ fontSize: 9.5, color: theme.textMuted, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
        {pct}% · {fmt.int(tx)} tx · {fmt.int(clientes)} cli{ticket != null ? ` · Ticket ${fmt.moneyFull(ticket)}` : ''}
      </div>
    </div>
  );
}

// ═══════════════ Ranking sucursales · mini-cards grid 3×2 + drill inline ═══════════════
function SucursalesRankingCard({ theme, P, sucursales, drillSucursal, onSelectSucursal, drillData, mesActualLabel }) {
  const [modo, setModo] = useState('venta'); // venta | inv | ventames
  const rows = sucursales.slice(0, 6);
  const valueOf = (r) => modo === 'venta' ? r.monto : modo === 'inv' ? r.invValor : r.ventaMes;
  const maxVal = Math.max(1, ...rows.map(valueOf));
  const formatValue = (r) => fmt.money(valueOf(r));
  const isDark = theme.mode === 'dark';
  // Título dinámico del modo
  const modoTitle = modo === 'venta' ? 'Ranking sucursales · YTD' : modo === 'inv' ? `Inventario por sucursal · snapshot` : `Ranking sucursales · ${mesActualLabel || 'mes'}`;
  const seg = (k, l) => (
    <button key={k} onClick={() => setModo(k)}
      style={{
        border: 0, background: modo === k ? theme.surface : 'transparent',
        padding: '4px 12px', borderRadius: 6,
        fontFamily: modo === k ? TYPO.fontDisplay : TYPO.fontText, fontSize: 10.5,
        color: modo === k ? theme.text : theme.textMuted, fontWeight: modo === k ? 600 : 500, cursor: 'pointer',
        boxShadow: modo === k ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
        borderWidth: 1, borderStyle: 'solid', borderColor: modo === k ? theme.border : 'transparent',
        transition: 'background 200ms cubic-bezier(.4,0,.2,1), color 200ms cubic-bezier(.4,0,.2,1)',
      }}>{l}</button>
  );

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          {modoTitle}
          <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>
            top {rows.length}
          </span>
        </h5>
        <div style={{ display: 'inline-flex', background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8, padding: 2 }}>
          {seg('venta', 'Venta')}{seg('inv', 'Inventario')}{seg('ventames', `Venta ${mesActualLabel || 'mes'}`)}
        </div>
      </div>
      {rows.length === 0 ? (
        <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>Sin sucursales aún</div>
      ) : (
        <>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8 }}>
          {rows.map((r, i) => {
            const pct = valueOf(r) / maxVal * 100;
            const isFis = r.tipo === 'fisica';
            const accent = isFis ? P.teal : P.green;
            const isOpen = drillSucursal === r.sucursal;
            const canDrill = typeof onSelectSucursal === 'function';
            return (
              <MiniSucursalCard key={r.sucursal}
                theme={theme} isDark={isDark}
                rank={i + 1}
                label={r.label}
                isFis={isFis}
                accent={accent}
                modo={modo}
                monto={formatValue(r)}
                pct={pct}
                tx={r.tx}
                clientes={r.clientes}
                momPct={r.momPct}
                invStock={r.invStock}
                invValor={r.invValor}
                txMes={r.txMes}
                clientesMes={r.clientesMes}
                isOpen={isOpen}
                onClick={() => canDrill && onSelectSucursal(isOpen ? null : r.sucursal)}
                P={P} />
            );
          })}
        </div>
        {drillSucursal && drillData && (() => {
          const sucInfo = rows.find((r) => r.sucursal === drillSucursal);
          return (
            <SucursalDrillPanel theme={theme} P={P} isDark={isDark}
              label={sucInfo?.label || drillSucursal}
              suc={sucInfo}
              data={drillData}
              onClose={() => onSelectSucursal(null)} />
          );
        })()}
        </>
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

// ═══════════════ Tabla SKU (sin marca column · single-brand Acteck) + drill inline ═══════════════
function TablaSKU({ theme, P, isDark, rows, busqueda, onChangeBusqueda, orden, onToggleSort, maxCelda, mesActual, familiaFilter, onClearFamilia, skuOpen, onToggleSku, anio, anioPrev, selloutGeneral, inventarioSucursalMap }) {
  const heatCell = (v) => {
    if (v == null || v === 0) return null;
    if (v < 0) return { bg: `${P.red}22`, color: P.red, weight: 600 };
    const r = v / maxCelda;
    const b = P.accent; // iOS blue como Digitalife
    if (r > 0.75) return { bg: b, color: '#FFF', weight: 600 };
    if (r > 0.50) return { bg: isDark ? 'rgba(10,132,255,0.45)' : `${b}59`, color: '#FFF', weight: 600 };
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
              <SortableHeader theme={theme} col="marca" label="Marca" orden={orden} onToggleSort={onToggleSort} align="left" />
              <SortableHeader theme={theme} col="sku" label="SKU" orden={orden} onToggleSort={onToggleSort} align="left" />
              <th style={headStyle(theme)}>Descripción</th>
              <SortableHeader theme={theme} col="rdmp" label="Roadmap" orden={orden} onToggleSort={onToggleSort} align="center" />
              {MESES.map((m, i) => (
                <th key={m} style={{ ...headStyle(theme), textAlign: 'right', opacity: i + 1 > mesActual ? 0.5 : 1 }}>{m}</th>
              ))}
              <SortableHeader theme={theme} col="promedio" label="Prom." orden={orden} onToggleSort={onToggleSort} align="right" />
              <SortableHeader theme={theme} col="total" label="Total" orden={orden} onToggleSort={onToggleSort} align="right" />
              <SortableHeader theme={theme} col="invStock" label={<>Inv.<br/>Dicotech</>} orden={orden} onToggleSort={onToggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={4 + MESES.length + 3} style={{ padding: '32px', textAlign: 'center', color: theme.textMuted }}>Sin SKUs para los filtros seleccionados.</td></tr>
            )}
            {rows.slice(0, 500).map((r) => {
              const rmpStyle = r.rdmp ? roadmapChipStyle(r.rdmp, P, theme) : null;
              const clickable = typeof onToggleSku === 'function';
              const isOpen = skuOpen === r.sku;
              const rowColSpan = 4 + MESES.length + 4;
              return (
                <React.Fragment key={r.sku}>
                <tr
                  onClick={() => clickable && onToggleSku(r)}
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    background: isOpen ? (isDark ? 'rgba(100,210,255,0.08)' : 'rgba(90,200,250,0.06)') : 'transparent',
                    transition: 'background 200ms cubic-bezier(.4,0,.2,1)',
                  }}
                  onMouseEnter={(e) => { if (clickable && !isOpen) e.currentTarget.style.background = `${theme.text}05`; }}
                  onMouseLeave={(e) => { if (clickable && !isOpen) e.currentTarget.style.background = 'transparent'; }}>
                  <td style={{ ...cellStyle(theme), fontFamily: TYPO.fontDisplay, fontWeight: 600, color: marcaColor(r.marca, P) }}>
                    {r.marca || 'Acteck'}
                  </td>
                  <td style={{ ...cellStyle(theme), fontFamily: '"SF Mono", ui-monospace, monospace', color: (clickable && isOpen) ? P.accent : (clickable ? P.accent : theme.text), fontWeight: clickable ? 600 : 400 }}>
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', gap: 6,
                    }}>
                      {clickable && (
                        <ChevronRight size={11} style={{
                          color: isOpen ? P.accent : theme.textSubtle,
                          transform: isOpen ? 'rotate(90deg)' : 'none',
                          transition: 'transform 280ms cubic-bezier(.4,0,.2,1)',
                        }} />
                      )}
                      {r.sku}
                    </span>
                  </td>
                  <td style={{ ...cellStyle(theme), color: theme.textMuted, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
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
                {isOpen && (
                  <tr>
                    <td colSpan={rowColSpan} style={{ padding: 0, border: 0 }}>
                      <SkuDrillInline theme={theme} P={P} isDark={isDark}
                        skuRow={r}
                        anio={anio} anioPrev={anioPrev} mesActual={mesActual}
                        selloutGeneral={selloutGeneral}
                        inventarioSucursalMap={inventarioSucursalMap}
                        onClose={() => onToggleSku(r)} />
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

// ═══════════════ Ranking expandible con drill individual (vendedores / clientes) ═══════════════
function RankingCard({ theme, P, isDark, type, title, allItems, totalCount, color, selloutGeneral, anio, mesActual, emptyMsg }) {
  const TOP_N = 6;
  const [expanded, setExpanded] = useState(false);
  const [openName, setOpenName] = useState(null);
  const items = expanded ? allItems : allItems.slice(0, TOP_N);
  const maxMonto = Math.max(1, ...allItems.map((x) => x.monto || 0));
  const restCount = Math.max(0, allItems.length - TOP_N);

  // Derivar drill del item abierto — depende del tipo
  const drillData = useMemo(() => {
    if (!openName) return null;
    const field = type === 'vendedor' ? 'vendedor_nombre' : 'cliente_nombre';
    const filtered = [];
    for (const r of selloutGeneral) {
      if (Number(r.anio) !== anio) continue;
      if (Number(r.mes) > mesActual) continue;
      const val = (r[field] || '(sin nombre)').trim() || '(sin nombre)';
      if (val === openName) filtered.push(r);
    }
    // Agregados
    const skus = new Map(), sucs = new Map();
    const otros = new Map(); // clientes si type=vendedor · vendedores si type=cliente
    const otrosField = type === 'vendedor' ? 'cliente_nombre' : 'vendedor_nombre';
    let totalPz = 0, totalMonto = 0, totalTx = filtered.length;
    for (const r of filtered) {
      const cnt = Number(r.cantidad) || 0;
      const imp = Number(r.importe) || 0;
      totalPz += cnt; totalMonto += imp;
      const sku = r.sku || '(sin sku)';
      if (!skus.has(sku)) skus.set(sku, { sku, piezas: 0, monto: 0 });
      skus.get(sku).piezas += cnt; skus.get(sku).monto += imp;
      const suc = r.sucursal || '(sin sucursal)';
      if (!sucs.has(suc)) sucs.set(suc, { name: suc, piezas: 0, monto: 0 });
      sucs.get(suc).piezas += cnt; sucs.get(suc).monto += imp;
      const ot = (r[otrosField] || '(sin nombre)').trim() || '(sin nombre)';
      if (!otros.has(ot)) otros.set(ot, { name: ot, piezas: 0, monto: 0 });
      otros.get(ot).piezas += cnt; otros.get(ot).monto += imp;
    }
    const topProductos = Array.from(skus.values())
      .map((v) => ({ ...v, pct: totalMonto > 0 ? (v.monto / totalMonto * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto).slice(0, 5);
    const topSucursales = Array.from(sucs.values())
      .map((v) => ({ ...v, label: (SUCURSAL_META[v.name]?.label) || v.name, tipo: metaSuc(v.name).tipo, pct: totalMonto > 0 ? (v.monto / totalMonto * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto).slice(0, 5);
    const topOtros = Array.from(otros.values())
      .map((v) => ({ ...v, pct: totalMonto > 0 ? (v.monto / totalMonto * 100) : 0 }))
      .sort((a, b) => b.monto - a.monto).slice(0, 5);
    const ticket = totalTx > 0 ? totalMonto / totalTx : null;
    return { topProductos, topSucursales, topOtros, totalPz, totalMonto, totalTx, ticket, totalSkus: skus.size, totalOtros: otros.size };
  }, [openName, type, selloutGeneral, anio, mesActual]);

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10, gap: 8 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          {title}
          <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontWeight: 500, fontStyle: 'italic', marginLeft: 8 }}>
            click abre drill
          </span>
        </h5>
        <span style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>
          Top {items.length} de {totalCount}
        </span>
      </div>
      {allItems.length === 0 ? (
        <div style={{ padding: '20px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 11 }}>{emptyMsg}</div>
      ) : (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, maxHeight: expanded ? 520 : 'none', overflowY: expanded ? 'auto' : 'visible' }}>
            {items.map((r, i) => {
              const isOpen = openName === r.name;
              return (
                <React.Fragment key={r.name}>
                  <div
                    onClick={() => setOpenName(isOpen ? null : r.name)}
                    onMouseEnter={(e) => { if (!isOpen) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'; }}
                    onMouseLeave={(e) => { if (!isOpen) e.currentTarget.style.background = 'transparent'; }}
                    style={{
                      display: 'grid', gridTemplateColumns: '22px 1fr auto 12px', gap: 10, alignItems: 'center',
                      padding: '8px', margin: '0 -8px', borderRadius: 8, cursor: 'pointer',
                      background: isOpen ? (isDark ? 'rgba(100,210,255,0.08)' : 'rgba(90,200,250,0.08)') : 'transparent',
                      transition: 'background 200ms cubic-bezier(.4,0,.2,1)',
                    }}>
                    <span style={{
                      fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700, color: theme.textMuted,
                      background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', borderRadius: 6, padding: '3px 0', textAlign: 'center', letterSpacing: '0.02em',
                    }}>#{i + 1}</span>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.name}>{r.name}</span>
                        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 500, color: theme.textMuted }}>{r.pct?.toFixed(1)}%</span>
                      </div>
                      <div style={{ height: 4, borderRadius: 999, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)', overflow: 'hidden' }}>
                        <div style={{
                          width: `${(r.monto / maxMonto * 100).toFixed(1)}%`, height: '100%', borderRadius: 999,
                          background: `linear-gradient(90deg, ${color}CC 0%, ${color} 100%)`,
                          transition: 'width 460ms cubic-bezier(.4,0,.2,1)',
                        }} />
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', marginTop: 1 }}>
                        <span>{fmt.int(r.piezas)} pz · {fmt.money(r.monto)}</span>
                        {r.yoy != null && <span style={{ fontWeight: 700, color: r.yoy >= 0 ? P.green : P.red }}>{r.yoy >= 0 ? '+' : ''}{r.yoy.toFixed(0)}% YoY</span>}
                      </div>
                    </div>
                    <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: theme.text, textAlign: 'right', minWidth: 56 }}>{fmt.money(r.monto)}</span>
                    <ChevronRight size={12} style={{
                      color: isOpen ? P.accent : theme.textSubtle,
                      transform: isOpen ? 'rotate(90deg)' : 'none',
                      transition: 'transform 280ms cubic-bezier(.4,0,.2,1)',
                    }} />
                  </div>
                  {isOpen && drillData && (
                    <RankingDrillPanel theme={theme} P={P} isDark={isDark}
                      type={type} name={r.name} data={drillData}
                      onClose={() => setOpenName(null)} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
          {restCount > 0 && (
            <button onClick={() => setExpanded((v) => !v)}
              onMouseEnter={(e) => { e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = P.accent; e.currentTarget.style.color = P.accent; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.color = theme.textMuted; }}
              style={{
                marginTop: 10, padding: '8px 14px', width: '100%',
                border: `1px solid ${theme.border}`, borderRadius: 999,
                background: 'transparent', color: theme.textMuted,
                fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500,
                cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                transition: 'background 200ms cubic-bezier(.4,0,.2,1), border-color 200ms cubic-bezier(.4,0,.2,1), color 200ms cubic-bezier(.4,0,.2,1)',
              }}>
              {expanded ? `Ver menos ▴` : `+ Ver los ${totalCount} ${type === 'vendedor' ? 'vendedores' : 'clientes'} ▾`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

// ═══════════════ Drill inline vendedor/cliente ═══════════════
function RankingDrillPanel({ theme, P, isDark, type, name, data, onClose }) {
  const bg = isDark ? 'rgba(100,210,255,0.06)' : 'rgba(90,200,250,0.05)';
  const border = isDark ? 'rgba(100,210,255,0.20)' : 'rgba(90,200,250,0.28)';
  const cols = type === 'vendedor' ? 3 : 2;
  return (
    <div style={{
      background: bg, border: `1px dashed ${border}`, borderRadius: 10, padding: '10px 12px',
      margin: '4px -8px 8px', animation: 'sodicoRankSlide 320ms cubic-bezier(.4,0,.2,1)', overflow: 'hidden',
    }}>
      <style>{`@keyframes sodicoRankSlide{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:translateY(0);}}`}</style>
      {/* Header con stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 12, paddingBottom: 8, marginBottom: 8, borderBottom: `1px dashed ${theme.divider || theme.border}`,
      }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>
            Detalle {type === 'vendedor' ? 'vendedor' : 'cliente'} · YTD
          </div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {name}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'baseline' }}>
          <SmallStat theme={theme} k="Piezas" v={fmt.int(data.totalPz)} />
          <SmallStat theme={theme} k="Monto" v={fmt.money(data.totalMonto)} />
          {type === 'vendedor' ? (
            <SmallStat theme={theme} k="Clientes" v={fmt.int(data.totalOtros)} />
          ) : (
            <SmallStat theme={theme} k="Frecuencia" v={`${fmt.int(data.totalTx)} tx`} />
          )}
          {data.ticket != null && <SmallStat theme={theme} k="Ticket" v={fmt.moneyFull(data.ticket)} />}
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted,
              padding: 4, borderRadius: 6, marginLeft: 4,
              transition: 'background 160ms cubic-bezier(.4,0,.2,1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = `${theme.text}0F`}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Cerrar">
            <X size={14} />
          </button>
        </div>
      </div>
      {/* Columnas */}
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 14 }}>
        <ProductosCol theme={theme} P={P} items={data.topProductos} totalSkus={data.totalSkus} />
        {type === 'vendedor' && (
          <SimpleRankingCol theme={theme} P={P} title="Mejores clientes"
            count={`Top ${Math.min(5, data.topOtros.length)} de ${data.totalOtros}`}
            items={data.topOtros} color={P.teal} />
        )}
        <SucursalesCol theme={theme} P={P} items={data.topSucursales} title={type === 'vendedor' ? 'Sucursales' : 'Compra desde sucursales'} />
      </div>
    </div>
  );
}

function ProductosCol({ theme, P, items, totalSkus }) {
  const maxMonto = Math.max(1, ...items.map((x) => x.monto));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>Productos que más vende</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>Top {items.length} de {totalSkus}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10.5, color: theme.textMuted, fontStyle: 'italic' }}>Sin ventas</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((v) => (
            <div key={v.sku} style={{ paddingBottom: 5, borderBottom: `1px dashed ${theme.divider || theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: P.accent }}>{v.sku}</span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontWeight: 500 }}>{v.pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 3, background: `${P.accent}18`, borderRadius: 999, marginTop: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(v.monto / maxMonto * 100).toFixed(1)}%`, background: P.accent, borderRadius: 999, transition: 'width 460ms cubic-bezier(.4,0,.2,1)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: theme.textMuted, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                <span>{fmt.int(v.piezas)} pz · {fmt.money(v.monto)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SimpleRankingCol({ theme, P, title, count, items, color }) {
  const maxMonto = Math.max(1, ...items.map((x) => x.monto));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{title}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10.5, color: theme.textMuted, fontStyle: 'italic' }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((v) => (
            <div key={v.name} style={{ paddingBottom: 5, borderBottom: `1px dashed ${theme.divider || theme.border}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={v.name}>{v.name}</span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontWeight: 500 }}>{v.pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 3, background: `${color}18`, borderRadius: 999, marginTop: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(v.monto / maxMonto * 100).toFixed(1)}%`, background: color, borderRadius: 999, transition: 'width 460ms cubic-bezier(.4,0,.2,1)' }} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: theme.textMuted, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                <span>{fmt.int(v.piezas)} pz · {fmt.money(v.monto)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SucursalesCol({ theme, P, items, title }) {
  const maxMonto = Math.max(1, ...items.map((x) => x.monto));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{title || 'Sucursales'}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>Top {items.length}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10.5, color: theme.textMuted, fontStyle: 'italic' }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((v) => {
            const c = v.tipo === 'online' ? P.green : P.accent;
            return (
              <div key={v.name} style={{ paddingBottom: 5, borderBottom: `1px dashed ${theme.divider || theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, color: theme.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={v.label}>{v.label}</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontWeight: 500 }}>{v.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 3, background: `${c}18`, borderRadius: 999, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(v.monto / maxMonto * 100).toFixed(1)}%`, background: c, borderRadius: 999, transition: 'width 460ms cubic-bezier(.4,0,.2,1)' }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: theme.textMuted, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  <span>{fmt.int(v.piezas)} pz · {fmt.money(v.monto)}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════ Mini-card de sucursal (grid 3×2) · footer según modo ═══════════════
function MiniSucursalCard({ theme, isDark, P, rank, label, isFis, accent, modo, monto, pct, tx, clientes, momPct, invStock, invValor, txMes, clientesMes, isOpen, onClick }) {
  const [hover, setHover] = useState(false);
  // Footer content dinámico según modo
  let footerLeft = '', footerRight = null;
  if (modo === 'venta') {
    footerLeft = `${fmt.int(tx)} tx · ${fmt.int(clientes)} cli`;
    if (momPct != null) footerRight = (
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, fontWeight: 700, color: momPct >= 0 ? P.green : P.red }}>
        {momPct >= 0 ? '+' : ''}{momPct.toFixed(0)}% MoM
      </span>
    );
  } else if (modo === 'inv') {
    footerLeft = invStock > 0 ? `${fmt.int(invStock)} pz stock` : 'sin stock';
    footerRight = null;
  } else if (modo === 'ventames') {
    footerLeft = `${fmt.int(txMes)} tx · ${fmt.int(clientesMes)} cli`;
    footerRight = null;
  }
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface,
        border: `1px solid ${isOpen ? accent : theme.border}`,
        borderRadius: 10, padding: '10px 12px 9px 14px',
        position: 'relative', overflow: 'hidden',
        cursor: 'pointer',
        transform: hover && !isOpen ? 'translateY(-1px)' : 'none',
        boxShadow: isOpen
          ? `0 0 0 3px ${accent}22, 0 2px 8px ${accent}20`
          : hover
            ? '0 4px 14px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.04)'
            : '0 1px 2px rgba(0,0,0,0.04)',
        transition: 'transform 260ms cubic-bezier(.4,0,.2,1), border-color 200ms cubic-bezier(.4,0,.2,1), box-shadow 240ms cubic-bezier(.4,0,.2,1)',
      }}>
      {/* Acento lateral · más definido con gradiente sutil */}
      <span style={{
        position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
        background: `linear-gradient(180deg, ${accent} 0%, ${accent}CC 100%)`,
      }} />
      {/* Header: rank pill + tag FÍS/ONL */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
        <span style={{
          fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, color: theme.textMuted,
          background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
          borderRadius: 999, padding: '1px 7px', letterSpacing: '0.05em',
        }}>#{rank}</span>
        <span style={{
          fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', fontWeight: 700,
          padding: '2px 7px', borderRadius: 4,
          background: `${accent}1F`, color: accent,
        }}>{isFis ? 'FÍS' : 'ONL'}</span>
      </div>
      {/* Nombre */}
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text,
        letterSpacing: '-0.01em', marginTop: 5,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }} title={label}>
        {label} {isOpen ? '▾' : ''}
      </div>
      {/* Valor grande */}
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, color: theme.text,
        letterSpacing: '-0.02em', marginTop: 2, fontVariantNumeric: 'tabular-nums',
      }}>{monto}</div>
      {/* Barra con gradiente sutil */}
      <div style={{
        height: 3, borderRadius: 999,
        background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
        marginTop: 6, overflow: 'hidden',
      }}>
        <div style={{
          width: `${pct}%`, height: '100%', borderRadius: 999,
          background: `linear-gradient(90deg, ${accent}CC 0%, ${accent} 100%)`,
          transition: 'width 460ms cubic-bezier(.4,0,.2,1)',
        }} />
      </div>
      {/* Footer dinámico */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 6, marginTop: 5, fontSize: 9.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace',
      }}>
        <span>{footerLeft}</span>
        {footerRight}
      </div>
    </div>
  );
}

// ═══════════════ Drill-down inline por sucursal (después del grid) ═══════════════
function SucursalDrillPanel({ theme, P, isDark, label, suc, data, onClose }) {
  const { topClientes, topVendedores, clientesTotal, vendedoresTotal } = data;
  const bg = isDark ? 'rgba(100,210,255,0.06)' : 'rgba(90,200,250,0.05)';
  const border = isDark ? 'rgba(100,210,255,0.20)' : 'rgba(90,200,250,0.28)';
  const ticket = suc?.tx > 0 ? suc.monto / suc.tx : null;
  return (
    <div style={{
      background: bg, border: `1px dashed ${border}`, borderRadius: 10, padding: '10px 14px',
      marginTop: 10, animation: 'sodicoSlideOpen 320ms cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes sodicoSlideOpen{from{opacity:0; transform:translateY(-4px);} to{opacity:1; transform:translateY(0);}}`}</style>
      {/* Header con stats */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'baseline',
        gap: 12, paddingBottom: 8, marginBottom: 8, borderBottom: `1px dashed ${theme.divider || theme.border}`,
      }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>
            Detalle sucursal · YTD
          </div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginTop: 2 }}>
            {label}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, alignItems: 'baseline' }}>
          <SmallStat theme={theme} k="Clientes" v={fmt.int(clientesTotal)} />
          <SmallStat theme={theme} k="Vendedores" v={fmt.int(vendedoresTotal)} />
          {suc?.tx > 0 && <SmallStat theme={theme} k="Tx" v={fmt.int(suc.tx)} />}
          {ticket != null && <SmallStat theme={theme} k="Ticket" v={fmt.moneyFull(ticket)} />}
          <button onClick={(e) => { e.stopPropagation(); onClose && onClose(); }}
            style={{
              background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted,
              padding: 4, borderRadius: 6, marginLeft: 4,
              transition: 'background 160ms',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = `${theme.text}0F`}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            title="Cerrar drill">
            <X size={14} />
          </button>
        </div>
      </div>
      {/* 2 cols rankings */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <MiniRankingList theme={theme} P={P} color={P.teal}
          title={`Top clientes · ${label}`} count={`Top ${Math.min(5, topClientes.length)} de ${clientesTotal}`}
          items={topClientes} />
        <MiniRankingList theme={theme} P={P} color={P.indigo}
          title={`Top vendedores · ${label}`} count={`Top ${Math.min(5, topVendedores.length)} de ${vendedoresTotal}`}
          items={topVendedores} />
      </div>
    </div>
  );
}

function SmallStat({ theme, k, v }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

function MiniRankingList({ theme, P, color, title, count, items }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{title}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10.5, color: theme.textMuted, fontStyle: 'italic' }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {items.map((v) => (
            <div key={v.name}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 4 }}>
                <span style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500 }} title={v.name}>{v.name}</span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted }}>{v.pct.toFixed(1)}%</span>
              </div>
              <div style={{ height: 3, borderRadius: 999, background: `${color}18`, overflow: 'hidden', marginTop: 2 }}>
                <div style={{ width: `${v.pct}%`, height: '100%', background: color, borderRadius: 999 }} />
              </div>
              <div style={{ fontSize: 9.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', marginTop: 2 }}>
                {fmt.int(v.piezas)} pz · {fmt.money(v.monto)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════ Drill-down INLINE por SKU (dentro de la tabla) ═══════════════
function SkuDrillInline({ theme, P, isDark, skuRow, anio, anioPrev, mesActual, selloutGeneral, inventarioSucursalMap, onClose }) {
  const sku = skuRow.sku;
  const [precioLista, setPrecioLista] = useState(null);
  const [loadingPrecio, setLoadingPrecio] = useState(true);

  useEffect(() => {
    setLoadingPrecio(true);
    (async () => {
      const { data } = await supabase.from('precios_sku')
        .select('precio').eq('sku', sku).eq('lista', 'DICOTECH')
        .eq('anio', anio).eq('mes', mesActual).maybeSingle();
      setPrecioLista(data?.precio ? Number(data.precio) : null);
      setLoadingPrecio(false);
    })();
  }, [sku, anio, mesActual]);

  // Filtrar sellout_general por sku
  const skuRows = useMemo(() => selloutGeneral.filter((r) => r.sku === sku), [selloutGeneral, sku]);

  // Rankings del SKU
  const { topClientes, topVendedores, topSucursales, mensuales, piezasYTD, montoYTD, precioReal, clientesTotal, vendedoresTotal, sucursalesTotal } = useMemo(() => {
    const cli = new Map(); const ven = new Map(); const suc = new Map();
    const cliPrev = new Map(); const sucPrev = new Map();
    const mensual = Array.from({ length: 12 }, () => ({ mesPiezas: 0, mesMonto: 0, mesN: 0 }));
    let pz = 0, monto = 0, precioAcum = 0, precioN = 0;
    for (const r of skuRows) {
      const y = Number(r.anio), m = Number(r.mes);
      const cnt = Number(r.cantidad) || 0; const imp = Number(r.importe) || 0;
      const cn = (r.cliente_nombre || '(sin nombre)').trim() || '(sin nombre)';
      const vn = (r.vendedor_nombre || '(sin nombre)').trim() || '(sin nombre)';
      const sn = r.sucursal || '(sin sucursal)';
      if (y === anio && m <= mesActual) {
        pz += cnt; monto += imp;
        if (Number(r.precio_unitario) > 0) { precioAcum += Number(r.precio_unitario) * cnt; precioN += cnt; }
        if (m >= 1 && m <= 12) {
          mensual[m - 1].mesPiezas += cnt;
          mensual[m - 1].mesMonto += imp;
          if (Number(r.precio_unitario) > 0) { mensual[m - 1].mesN += cnt; mensual[m - 1].precioAcum = (mensual[m - 1].precioAcum || 0) + Number(r.precio_unitario) * cnt; }
        }
        if (!cli.has(cn)) cli.set(cn, { name: cn, monto: 0, piezas: 0 });
        cli.get(cn).monto += imp; cli.get(cn).piezas += cnt;
        if (!ven.has(vn)) ven.set(vn, { name: vn, monto: 0, piezas: 0 });
        ven.get(vn).monto += imp; ven.get(vn).piezas += cnt;
        if (!suc.has(sn)) suc.set(sn, { name: sn, monto: 0, piezas: 0 });
        suc.get(sn).monto += imp; suc.get(sn).piezas += cnt;
      } else if (y === anioPrev && m <= mesActual) {
        cliPrev.set(cn, (cliPrev.get(cn) || 0) + imp);
        sucPrev.set(sn, (sucPrev.get(sn) || 0) + imp);
      }
    }
    const totCli = Array.from(cli.values()).reduce((s, x) => s + x.monto, 0);
    const totVen = Array.from(ven.values()).reduce((s, x) => s + x.monto, 0);
    const totSuc = Array.from(suc.values()).reduce((s, x) => s + x.monto, 0);
    const topC = Array.from(cli.values()).map((v) => ({
      ...v, pct: totCli > 0 ? (v.monto / totCli * 100) : 0,
      yoy: cliPrev.get(v.name) > 0 ? ((v.monto - cliPrev.get(v.name)) / cliPrev.get(v.name) * 100) : null,
    })).sort((a, b) => b.monto - a.monto).slice(0, 6);
    const topV = Array.from(ven.values()).map((v) => ({
      ...v, pct: totVen > 0 ? (v.monto / totVen * 100) : 0,
    })).sort((a, b) => b.monto - a.monto).slice(0, 5);
    const topS = Array.from(suc.values()).map((v) => ({
      ...v, label: (SUCURSAL_META[v.name]?.label) || v.name,
      tipo: metaSuc(v.name).tipo,
      pct: totSuc > 0 ? (v.monto / totSuc * 100) : 0,
      yoy: sucPrev.get(v.name) > 0 ? ((v.monto - sucPrev.get(v.name)) / sucPrev.get(v.name) * 100) : null,
    })).sort((a, b) => b.monto - a.monto).slice(0, 6);
    const precioR = precioN > 0 ? precioAcum / precioN : null;
    const mensuales = mensual.map((mm, i) => ({
      mes: i + 1, label: MESES[i],
      piezas: mm.mesPiezas,
      precioReal: mm.mesN > 0 ? (mm.precioAcum / mm.mesN) : null,
    }));
    return {
      topClientes: topC, topVendedores: topV, topSucursales: topS,
      mensuales, piezasYTD: pz, montoYTD: monto, precioReal: precioR,
      clientesTotal: cli.size, vendedoresTotal: ven.size, sucursalesTotal: suc.size,
    };
  }, [skuRows, anio, anioPrev, mesActual]);

  const yieldPct = precioLista && precioReal ? (precioReal / precioLista * 100) : null;
  const ratioSISo = skuRow.total > 0 ? (piezasYTD / skuRow.total * 100) : null;
  const invSuc = inventarioSucursalMap.get(sku) || [];
  const invTotal = invSuc.reduce((s, x) => ({ stock: s.stock + x.stock, valor: s.valor + x.valor }), { stock: 0, valor: 0 });

  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#000000');
  const drillBg = isDark ? 'rgba(100,210,255,0.05)' : 'rgba(90,200,250,0.04)';
  const drillBorder = isDark ? 'rgba(100,210,255,0.18)' : 'rgba(90,200,250,0.26)';

  return (
    <div style={{
      background: drillBg,
      borderTop: `1px dashed ${drillBorder}`,
      borderBottom: `1px dashed ${drillBorder}`,
      padding: '12px 14px',
      animation: 'sodicoSkuSlide 340ms cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes sodicoSkuSlide{from{opacity:0; transform:translateY(-6px);} to{opacity:1; transform:translateY(0);}}`}</style>
      <div style={{
        background: theme.surface, borderRadius: 12, overflow: 'hidden',
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.30)' : '0 2px 10px rgba(0,0,0,0.08)',
        border: `1px solid ${theme.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Hero */}
        <div style={{
          background: heroBg, color: '#FFF', padding: '12px 18px',
          display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 14, alignItems: 'center',
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              Detalle SKU · Sell Out YTD {anio}
            </span>
            <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: '3px 0 3px', color: '#FFF' }}>
              {sku} · {skuRow.descripcion || ''}
            </h3>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              {skuRow.categoria || 'Sin categoría'}{skuRow.rdmp ? ` · Roadmap ${skuRow.rdmp}` : ''}
              {precioReal != null && <> · <strong style={{ color: '#FFF' }}>Ticket promedio {fmt.moneyFull(precioReal)}</strong></>}
              {precioLista && <> · precio lista {fmt.moneyFull(precioLista)}</>}
              {yieldPct != null && <> · <span style={{ color: yieldPct >= 95 ? P.green : yieldPct >= 85 ? P.orange : P.red }}>{yieldPct.toFixed(0)}% yield</span></>}
            </p>
          </div>
          <MiniStat k="Piezas YTD" v={fmt.int(piezasYTD)} s={ratioSISo != null ? `${ratioSISo.toFixed(0)}% del SI` : ''} />
          <MiniStat k="Monto YTD" v={fmt.money(montoYTD)} s={`${mesActual} meses`} />
          <MiniStat k="Precio real" v={precioReal != null ? fmt.moneyFull(precioReal) : '—'} s="promedio" />
          <button onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.14)', border: 0, color: '#FFF',
              width: 30, height: 30, borderRadius: 999, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
            }}>
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 18px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* KPI strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8,
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            padding: '9px 12px', borderRadius: 10,
          }}>
            <KpiCell theme={theme} k="Clientes finales" v={fmt.int(clientesTotal)} s={topClientes[0] ? `Top: ${topClientes[0].name.split(' ').slice(0, 2).join(' ')}` : ''} />
            <KpiCell theme={theme} k="Vendedores" v={fmt.int(vendedoresTotal)} s={topVendedores[0] ? `Top: ${topVendedores[0].name.split(' ').slice(0, 2).join(' ')} ${topVendedores[0].pct.toFixed(0)}%` : ''} />
            <KpiCell theme={theme} k="Sucursales" v={fmt.int(sucursalesTotal)} s={topSucursales[0] ? `${topSucursales[0].label} ${topSucursales[0].pct.toFixed(0)}%` : ''} />
            <KpiCell theme={theme} k="Ratio SO / SI" v={ratioSISo != null ? `${ratioSISo.toFixed(0)}%` : '—'} s={`${fmt.int(piezasYTD)} SO / ${fmt.int(skuRow.total)} SI`} vColor={ratioSISo == null ? undefined : ratioSISo >= 80 ? P.green : P.orange} />
          </div>

          {/* 3 columnas rankings */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
            <DrillCol theme={theme} P={P} title="Clientes finales" count={`Top ${topClientes.length} de ${clientesTotal}`} items={topClientes} color={P.teal} />
            <DrillCol theme={theme} P={P} title="Vendedores"     count={`Top ${topVendedores.length} de ${vendedoresTotal}`} items={topVendedores} color={P.indigo} />
            <DrillCol theme={theme} P={P} title="Sucursales"     count={`Top ${topSucursales.length} de ${sucursalesTotal}`} items={topSucursales} color={P.accent} sucursalTint />
          </div>

          {/* Compacto: análisis mensual + inventario por sucursal (2 columnas) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 12 }}>
            <AnalisisMensualMini theme={theme} P={P} isDark={isDark} mensuales={mensuales.slice(0, mesActual)} precioLista={precioLista} />
            <InvSucursalMini theme={theme} P={P} isDark={isDark} inv={invSuc} total={invTotal} />
          </div>

          <div style={{ fontSize: 10, color: theme.textSubtle || theme.textMuted, textAlign: 'right' }}>
            Datos <strong>sellout_general</strong> · precio <strong>precios_sku</strong> lista DICOTECH · inv <strong>inventario_cliente_sucursal</strong>
          </div>
        </div>
      </div>
    </div>
  );
}

function MiniStat({ k, v, s }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, color: '#FFF', letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)' }}>{s}</div>}
    </div>
  );
}

function KpiCell({ theme, k, v, s, vColor }) {
  return (
    <div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: vColor || theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: 9.5, color: theme.textMuted }}>{s}</div>}
    </div>
  );
}

function DrillCol({ theme, P, title, count, items, color, sucursalTint }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{title}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>{count}</span>
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: 10.5, color: theme.textMuted, fontStyle: 'italic' }}>Sin datos</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          {items.map((v) => {
            const c = sucursalTint && v.tipo === 'online' ? P.green : color;
            return (
              <div key={v.name} style={{ paddingBottom: 5, borderBottom: `1px dashed ${theme.divider || theme.border}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 6 }}>
                  <span style={{ fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={v.name}>
                    {v.label || v.name}
                  </span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontWeight: 500 }}>{v.pct.toFixed(1)}%</span>
                </div>
                <div style={{ height: 3, background: `${c}18`, borderRadius: 999, marginTop: 2, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${v.pct}%`, background: c, borderRadius: 999 }} />
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: theme.textMuted, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  <span>{fmt.int(v.piezas)} pz · {fmt.money(v.monto)}</span>
                  {v.yoy != null && <span style={{ fontWeight: 700, color: v.yoy >= 0 ? P.green : P.red }}>{v.yoy >= 0 ? '+' : ''}{v.yoy.toFixed(0)}% YoY</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AnalisisMensualMini({ theme, P, isDark, mensuales, precioLista }) {
  const W = 400, H = 90;
  const padL = 18, padR = 8, padT = 14, padB = 22;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const maxPz = Math.max(1, ...mensuales.map((m) => m.piezas));
  const preciosVal = mensuales.filter((m) => m.precioReal != null).map((m) => m.precioReal);
  const precioMin = Math.min(...preciosVal, precioLista || Infinity);
  const precioMax = Math.max(...preciosVal, precioLista || 0);
  const precioRange = precioMax - precioMin || 1;
  const xOf = (i) => padL + (i / Math.max(1, mensuales.length - 1)) * chartW;
  const yBar = (v) => padT + chartH * (1 - v / maxPz);
  const yPr = (v) => padT + chartH * (1 - (v - precioMin) / precioRange);
  const barW = Math.max(6, chartW / mensuales.length - 4);
  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>
          Análisis mensual · precio × piezas
        </span>
        <div style={{ display: 'flex', gap: 8, fontSize: 9, color: theme.textMuted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 7, height: 2, borderRadius: 1, background: P.teal }} />Real
          </span>
          {precioLista && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
              <span style={{ width: 7, height: 2, borderRadius: 1, background: theme.textMuted }} />Lista
            </span>
          )}
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <span style={{ width: 6, height: 6, borderRadius: 1, background: P.orange, opacity: 0.7 }} />Piezas
          </span>
        </div>
      </div>
      {mensuales.length === 0 ? (
        <div style={{ padding: '18px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 10.5 }}>Sin transacciones aún</div>
      ) : (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: H, display: 'block' }}>
          <line x1={padL} y1={padT} x2={W - padR} y2={padT} stroke={isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'} strokeDasharray="3 4" />
          <line x1={padL} y1={padT + chartH / 2} x2={W - padR} y2={padT + chartH / 2} stroke={isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'} strokeDasharray="3 4" />
          <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke={theme.divider || theme.border} />
          {mensuales.map((m, i) => (
            m.piezas > 0 ? <rect key={`b-${i}`} x={xOf(i) - barW / 2} y={yBar(m.piezas)} width={barW} height={padT + chartH - yBar(m.piezas)} fill={P.orange} opacity="0.55" rx="1" /> : null
          ))}
          {precioLista && (
            <polyline points={mensuales.map((m, i) => `${xOf(i)},${yPr(precioLista)}`).join(' ')} fill="none" stroke={theme.textMuted} strokeWidth="1.2" strokeDasharray="4 3" opacity="0.55" />
          )}
          {(() => {
            const puntos = mensuales.filter((m) => m.precioReal != null);
            if (puntos.length === 0) return null;
            const pts = mensuales.map((m, i) => m.precioReal != null ? `${xOf(i)},${yPr(m.precioReal)}` : null).filter(Boolean).join(' ');
            return <polyline points={pts} fill="none" stroke={P.teal} strokeWidth="2" />;
          })()}
          {mensuales.map((m, i) => (
            <text key={`x-${i}`} x={xOf(i)} y={H - 8} textAnchor="middle"
              fontFamily='"SF Mono", ui-monospace, monospace' fontSize="8" fill={theme.textMuted}>{m.label}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

function InvSucursalMini({ theme, P, isDark, inv, total }) {
  const SIETE = ['dicoags2', 'leon2', 'Arboledas', 'GDL', 'ZACATECAS', 'santafe', 'DC'];
  const byName = new Map(inv.map((x) => [x.sucursal, x]));
  const cells = SIETE.map((s) => ({ key: s, label: (SUCURSAL_META[s]?.label || s).slice(0, 3), data: byName.get(s) }));
  const online = inv.filter((x) => metaSuc(x.sucursal).tipo === 'online');
  const maxStock = Math.max(1, ...inv.map((x) => x.stock));
  return (
    <div style={{
      background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
      borderRadius: 10, padding: '10px 12px', display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>
          Inventario por sucursal
        </span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>
          snapshot
        </span>
      </div>
      {inv.length === 0 ? (
        <div style={{ padding: '18px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 10.5 }}>Sin stock</div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
            {cells.map((c) => {
              const has = !!c.data;
              const isTop = has && c.data.stock === maxStock;
              return (
                <div key={c.key} style={{
                  background: theme.surface, border: `1px solid ${isTop ? P.teal : theme.border}`,
                  borderRadius: 6, padding: '5px 4px', textAlign: 'center',
                  opacity: has ? 1 : 0.45,
                  boxShadow: isTop ? `0 0 0 1px ${P.teal}44` : 'none',
                }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textMuted, fontWeight: 600 }}>{c.label}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, color: theme.text, marginTop: 1, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{has ? fmt.int(c.data.stock) : '—'}</div>
                  <div style={{ fontSize: 8.5, color: theme.textSubtle || theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>{has && c.data.valor > 0 ? fmt.money(c.data.valor) : ''}</div>
                </div>
              );
            })}
          </div>
          {online.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {online.map((s) => (
                <span key={s.sucursal} style={{
                  fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
                  padding: '3px 8px', borderRadius: 999, background: `${P.green}18`, color: P.green,
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                }}>
                  {metaSuc(s.sucursal).label} <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace' }}>{fmt.int(s.stock)}</span>
                </span>
              ))}
            </div>
          )}
          <div style={{
            display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 6,
            borderTop: `1px dashed ${theme.divider || theme.border}`,
            fontSize: 10, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace',
          }}>
            <span>{inv.length} sucursales con stock</span>
            <span>Total <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.int(total.stock)} pz</strong> · <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(total.valor)}</strong></span>
          </div>
        </>
      )}
    </div>
  );
}
