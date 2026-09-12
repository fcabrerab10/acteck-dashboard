// SellOutPcel · rediseño Apple V2 · exclusivo PCEL
// Clon estructural de SellOutClienteV2 con vistas PCEL:
//   - v_sellout_pcel_mensual · agregado por año/mes ($ a costo)
//   - v_sellout_pcel_sku_mes · sell out por sku/mes
//   - v_sellout_pcel_marca_mes · sell out por marca/mes
// PCEL no expone clientes finales/vendedores/sucursales — el drill
// del SKU muestra evolución mensual + inventario del SKU en PCEL.
// ─ Hero editorial narrativo con 3 stats
// ─ 4 KPI cards planas (MTD · YTD · YoY · Inv. PCEL)
// ─ Timeline lineal SO 2025 vs 2026 + filtros Q + sums row
// ─ Composición sucursal (interactiva, filtra tabla) — basada en inventario cliente
// ─ Composición marca (interactiva, filtra tabla)
// ─ Tabla SKU con Roadmap chip + 12 meses heat + Inv. PCEL

import React, { useEffect, useMemo, useState } from 'react';
import { useRoadmap, useInventarioCliente } from '../../lib/queries';
import { disponibilidadDeCampos } from '../../lib/disponibilidad';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando, Panel, GraficaLineas, SelectorTrimestres, usePersistTrimestres, etiquetaTrimestres } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronRight } from 'lucide-react';
import { fetchAll as fetchAllCentral } from '../../lib/queries';

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

// Delegado al motor paginado PARALELO central (lib/queries.js).
async function fetchAll(table, select, applyFilter = (q) => q) {
  return fetchAllCentral(table, select, applyFilter);
}

// ═══════════════════════════════════════════════════════════════════
// Componente principal
// ═══════════════════════════════════════════════════════════════════
export default function SellOutPcel({ clienteKey = 'pcel' }) {
  const perfil = usePerfil();
  if (!puedeVerPestanaCliente(perfil, clienteKey, 'estrategia')) {
    return <SinAcceso motivo={`No tienes acceso a Sell Out de ${clienteKey || 'este cliente'}.`} />;
  }
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';

  const anio = new Date().getFullYear();
  const anioPrev = anio - 1;

  // Datos compartidos via React Query
  const { data: roadmap = [] } = useRoadmap();
  const { data: inventarioCliente = [] } = useInventarioCliente(clienteKey);

  const [loading, setLoading] = useState(true);
  const [mensual, setMensual] = useState([]);
  const [skuMesRaw, setSkuMesRaw] = useState([]);
  const [inventarioSucursal, setInventarioSucursal] = useState([]);
  const [marcaMes, setMarcaMes] = useState([]);
  const [rango, setRango, rangoPersistido] = usePersistTrimestres(`sellOut:${clienteKey}`, () => new Set(['Q3']));
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const [marcaFilter, setMarcaFilter] = useState(null);
  const [familiaFilter, setFamiliaFilter] = useState(null);
  const [skuOpen, setSkuOpen] = useState(null); // sku actualmente expandido en drill

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [mes, skuMes, invSuc, mrcMes] = await Promise.all([
        fetchAll('v_sellout_pcel_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas,skus_sin_mapear,piezas_sin_mapear'),
        fetchAll('v_sellout_pcel_sku_mes', 'sku,anio,mes,piezas,monto',
          (q) => q.in('anio', [anioPrev, anio])),
        fetchAll('inventario_cliente_sucursal', 'sku,sucursal,stock,valor,costo_convenio,anio,semana',
          (q) => q.eq('cliente', clienteKey)),
        fetchAll('v_sellout_pcel_marca_mes', 'marca,anio,mes,piezas,monto,tx,skus_distintos',
          (q) => q.in('anio', [anioPrev, anio])),
      ]);
      setMensual(mes);
      setSkuMesRaw(skuMes);
      setInventarioSucursal(invSuc);
      setMarcaMes(mrcMes);
      setLoading(false);
    })();
  }, [clienteKey, anio, anioPrev]);

  // SKUs de PCEL sin mapeo a SKU Acteck en el año en curso (aviso en pantalla).
  const sinMapear = useMemo(() => {
    let skus = 0, piezas = 0;
    for (const r of mensual) if (r.anio === anio) { skus = Math.max(skus, Number(r.skus_sin_mapear) || 0); piezas += Number(r.piezas_sin_mapear) || 0; }
    return { skus, piezas };
  }, [mensual, anio]);

  // Mes actual = último con data
  const mesActual = useMemo(() => {
    let last = 1;
    for (const r of mensual) if (r.anio === anio && Number(r.piezas) > 0) last = Math.max(last, r.mes);
    return last;
  }, [mensual, anio]);

  useEffect(() => {
    if (rangoPersistido) return; // la selección guardada por pantalla manda
    const q = mesActual <= 3 ? 'Q1' : mesActual <= 6 ? 'Q2' : mesActual <= 9 ? 'Q3' : 'Q4';
    setRango(new Set([q]));
  }, [mesActual, rangoPersistido, setRango]);

  // Meses seleccionados a partir del Set (soporta multi-Q · empty = Año)
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

  // Qué campos trae de verdad la carga de ESTE cliente (última semana): lo que no
  // viene no se pinta (regla de Fernando). Hoy: Dicotech no manda dias_sin_venta ni
  // precio_venta; Digitalife manda `valor` vacío pero sí costo_convenio (se reconstruye).
  const camposInv = useMemo(() => {
    const d = disponibilidadDeCampos(clienteKey, inventarioCliente, ['valor', 'costo_convenio', 'precio_venta', 'dias_sin_venta', 'fecha_ultima_venta']);
    return { ...d.campos, valor: d.hay('valor') || d.hay('costo_convenio') };
  }, [clienteKey, inventarioCliente]);

  // Inventario por SKU (último snapshot)
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
        // Si valor viene 0 en DB, aproximar con stock × costo_convenio o precio_venta
        const valor = valorRaw > 0 ? valorRaw : stock * (costoConv || precioVta);
        m.set(r.sku, {
          stock,
          valor,
          costo_convenio: costoConv,
          precio_venta: precioVta,
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

  // Agregado por familia (inventario PCEL via roadmap)
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
    return Q_MESES.anio.map((m) => {
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
  }, [mensualPorAnio, anio, anioPrev, mesActual]);

  const timelineSums = useMemo(() => {
    let s2026 = 0, s2025 = 0;
    for (const d of timelineMeses) { if (!mesesRango.includes(d.mes)) continue; s2026 += d.sellIn; s2025 += d.sellInPrev; }
    const deltaYoY = s2025 > 0 ? ((s2026 - s2025) / s2025 * 100) : null;
    return { s2026, s2025, deltaYoY };
  }, [timelineMeses, mesesRango]);

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

  const heroBg = theme.heroCardBg || (isDark ? '#0A0A0C' : '#1C1C1E');

  if (loading) {
    return <Cargando pantalla="sellOut" label="Cargando Sell Out…" sub={`Trayendo sell out de ${clienteKey}`} minHeight={480} />;
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
            Sell Out · PCEL · {MESES_LARGO[mesActual - 1]} {anio} · estimado a lista
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

      {/* Aviso: PCEL manda códigos propios; los que no tienen mapeo a SKU Acteck se
          muestran con su código (ya no se descartan) pero no cruzan con roadmap ni precios. */}
      {sinMapear.skus > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 11px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, fontSize: 11.5, color: theme.textMuted }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: P.orange || P.red, flex: '0 0 auto' }} />
          <span><strong style={{ color: theme.text }}>{sinMapear.skus} SKUs de PCEL sin mapear</strong> ({fmt.int(sinMapear.piezas)} pz en {anio}): se muestran con el código de PCEL y sin valuación. Agrégalos a <span style={{ fontFamily: TYPO.fontDisplay }}>pcel_sku_map</span> para que crucen con roadmap y precios.</span>
        </div>
      )}

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
          eyebrow="Inv. PCEL"
          title="stock disponible"
          big={fmt.int(invTotales.stock)}
          bigSmall={camposInv.valor && invTotales.valor > 0 ? `pz · ${fmt.money(invTotales.valor)}` : 'pz'}
          sub={<>{invTotales.skus} SKUs con stock · {familiasInvYTD.length} familias</>}
        />
      </div>

      {/* Fila: Timeline + Inventario por familia */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        <TimelineLineal mesesRango={mesesRango} theme={theme} P={P}
          data={timelineMeses} sums={timelineSums} rango={rango} onChangeRango={setRango}
          anio={anio} anioPrev={anioPrev} mesActual={mesActual} />
        <InvFamiliaCard theme={theme} P={P} hayValor={camposInv.valor}
          familias={familiasInvYTD} totalStock={familiasInvTot.stock} totalValor={familiasInvTot.valor}
          selected={familiaFilter} onSelect={setFamiliaFilter} />
      </div>

      {/* Composición marca */}
      <MarcaCard theme={theme} P={P} marcas={marcaYTD} totalYTD={totalYTD}
        selected={marcaFilter} onSelect={setMarcaFilter} />

      {/* Tabla SKU */}
      <TablaSKU theme={theme} P={P} isDark={isDark}
        rows={filas} busqueda={busqueda} onChangeBusqueda={setBusqueda}
        orden={orden} onToggleSort={toggleSort}
        maxCelda={maxCelda} mesActual={mesActual}
        marcaFilter={marcaFilter} onClearMarca={() => setMarcaFilter(null)}
        familiaFilter={familiaFilter} onClearFamilia={() => setFamiliaFilter(null)}
        skuOpen={skuOpen}
        onToggleSku={(sku) => setSkuOpen((prev) => prev === sku ? null : sku)}
        anio={anio} anioPrev={anioPrev}
        inventarioSucursalMap={inventarioSucursalMap}
        skuMesRaw={skuMesRaw}
      />
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
function TimelineLineal({ theme, P, data, sums, rango, onChangeRango, anio, anioPrev, mesActual, mesesRango = [] }) {
  // Serie completa del año: los meses fuera de los trimestres marcados se atenúan (no desaparecen).
  const datos = data.map((d) => ({ x: d.label, mes: d.mes, actual: d.futuro ? null : d.sellIn, anterior: d.sellInPrev }));
  const series = [
    { key: 'actual', label: `SO ${anio}`, tipo: 'principal' },
    { key: 'anterior', label: `SO ${anioPrev}`, tipo: 'anterior' },
  ];
  const sel = new Set(mesesRango);
  const atenuados = datos.map((d, i) => (sel.has(d.mes) ? null : i)).filter((i) => i != null);
  const mesActivo = datos.findIndex((d) => d.mes === mesActual);
  const resumen = `${etiquetaTrimestres(rango)} · ${fmt.money(sums.s2026)} · ${mesesRango.length} ${mesesRango.length === 1 ? 'mes' : 'meses'}`;
  return (
    <Panel titulo="Evolución mensual · Sell Out" meta="combina trimestres para sumar"
      acciones={<SelectorTrimestres value={rango} onChange={onChangeRango} resumen={resumen} />}>
      <div style={{ display: 'flex', gap: 14, padding: '2px 0 8px', flexWrap: 'wrap', borderBottom: `1px solid ${theme.divider || theme.border}`, marginBottom: 6 }}>
        <SumStat theme={theme} k={<><Dot color={theme.textMuted} dashed />SO {anioPrev}</>} v={fmt.money(sums.s2025)} vColor={theme.textMuted} />
        <SumStat theme={theme} k={<><Dot color={P.accent} />SO {anio}</>} v={fmt.money(sums.s2026)} vColor={theme.text} />
        {sums.deltaYoY != null && (
          <SumStat theme={theme} k="Δ YoY" v={`${sums.deltaYoY >= 0 ? '+' : ''}${sums.deltaYoY.toFixed(1)}%`} vColor={sums.deltaYoY >= 0 ? P.green : P.red} />
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

function InvFamiliaCard({ theme, P, familias, totalStock, totalValor, selected, onSelect, hayValor = true }) {
  const [expanded, setExpanded] = useState(false);
  const TOP_N = 7; // familias visibles antes del "Ver más"
  // Usa VALOR ($) para proporciones — con fallback stock × costo_promedio
  const total = familias.reduce((s, f) => s + f.valor, 0);
  const anySelected = selected != null;
  const visibles = expanded ? familias : familias.slice(0, TOP_N);
  const ocultas = familias.length - TOP_N;
  const size = 240, cx = size / 2, cy = size / 2, rOuter = 108, rInner = 76;
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
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px', display: 'flex', flexDirection: 'column' }}>
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
        <div style={{ display: 'grid', gridTemplateColumns: `${size + 12}px 1fr`, gap: 18, alignItems: 'center', marginTop: 4 }}>
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
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, textAlign: 'center', padding: '0 6px' }}>{selected}</div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(0)}%</div>
                    <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{f ? (hayValor && f.valor > 0 ? fmt.money(f.valor) : `${fmt.int(f.stock)} pz`) : '—'}</div>
                  </>
                );
              })() : (
                <>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{hayValor && totalValor > 0 ? 'Costo total' : 'Inventario'}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 700, letterSpacing: '-0.025em', color: theme.text, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>{hayValor && totalValor > 0 ? fmt.money(totalValor) : fmt.int(totalStock)}</div>
                  <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme.textMuted, marginTop: 2 }}>{hayValor && totalValor > 0 ? `${fmt.int(totalStock)} pz` : 'pz'} · {familias.length}</div>
                </>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignSelf: 'stretch' }}>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textSubtle || theme.textMuted, fontStyle: 'italic', marginBottom: 2 }}>click filtra tabla</div>
            {visibles.map((f, i) => {
              const isActive = selected === f.name;
              const isDim = anySelected && !isActive;
              const pct = total > 0 ? (f.valor / total * 100) : 0;
              return (
                <div key={f.name}
                  onClick={() => onSelect(isActive ? null : f.name)}
                  style={{
                    display: 'grid', gridTemplateColumns: '12px 1fr auto auto', gap: 10, alignItems: 'center',
                    padding: '5px 10px', margin: '0 -10px', borderRadius: 8,
                    cursor: 'pointer', opacity: isDim ? 0.45 : 1,
                    background: isActive ? `${f.color}18` : 'transparent',
                    transition: 'background 160ms, opacity 160ms',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = `${theme.text}05`; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: f.color }} />
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: isActive ? 700 : 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{pct.toFixed(1)}%</span>
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11.5, color: theme.text, fontWeight: 600, textAlign: 'right', minWidth: 60, fontVariantNumeric: 'tabular-nums' }}>{hayValor && f.valor > 0 ? fmt.money(f.valor) : `${fmt.int(f.stock)} pz`}</span>
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
                  transition: 'background 160ms',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = `${theme.text}10`; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = `${theme.text}06`; }}>
                {expanded ? `Ver menos ▴` : `+ ${ocultas} categorías más ▾`}
              </button>
            )}
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

// ═══════════════ Tabla SKU ═══════════════
function TablaSKU({ theme, P, isDark, rows, busqueda, onChangeBusqueda, orden, onToggleSort, maxCelda, mesActual, marcaFilter, onClearMarca, familiaFilter, onClearFamilia, skuOpen, onToggleSku, anio, anioPrev, inventarioSucursalMap, skuMesRaw }) {
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
              <SortableHeader theme={theme} col="invStock" label={<>Inv.<br/>PCEL</>} orden={orden} onToggleSort={onToggleSort} align="right" />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={5 + MESES.length + 3} style={{ padding: '32px', textAlign: 'center', color: theme.textMuted }}>Sin SKUs para los filtros seleccionados.</td></tr>
            )}
            {rows.slice(0, 500).map((r) => {
              const rmpStyle = r.rdmp ? roadmapChipStyle(r.rdmp, P, theme) : null;
              const clickable = typeof onToggleSku === 'function';
              const isOpen = skuOpen === r.sku;
              return (
                <React.Fragment key={r.sku}>
                <tr
                  onClick={() => clickable && onToggleSku(r.sku)}
                  style={{
                    cursor: clickable ? 'pointer' : 'default',
                    background: isOpen ? (isDark ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)') : 'transparent',
                    transition: 'background 200ms cubic-bezier(.4,0,.2,1)',
                  }}
                  onMouseEnter={(e) => { if (clickable && !isOpen) e.currentTarget.style.background = `${theme.text}05`; }}
                  onMouseLeave={(e) => { if (clickable && !isOpen) e.currentTarget.style.background = 'transparent'; }}>
                  <td style={cellStyle(theme)}><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: marcaColor(r.marca) }}>{r.marca || '—'}</span></td>
                  <td style={{ ...cellStyle(theme), fontFamily: '"SF Mono", ui-monospace, monospace', color: (clickable && isOpen) ? P.accent : theme.text, fontWeight: clickable ? 600 : 400 }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      {clickable && <ChevronRight size={11} style={{ color: isOpen ? P.accent : theme.textSubtle, transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 280ms cubic-bezier(.4,0,.2,1)' }} />}
                      {r.sku}
                    </span>
                  </td>
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
                {isOpen && (
                  <tr>
                    <td colSpan={5 + MESES.length + 3} style={{ padding: 0, border: 0 }}>
                      <SkuDrillInline theme={theme} P={P} isDark={isDark}
                        skuRow={r}
                        anio={anio} anioPrev={anioPrev}
                        skuMesRaw={skuMesRaw}
                        inventarioSucursalMap={inventarioSucursalMap}
                        onClose={() => onToggleSku(r.sku)} />
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

// ═══════════════ Drill-down inline por SKU ═══════════════
// Muestra: hero mini con marca/desc/roadmap + KPI strip + evolución mensual + inventario por sucursal
function SkuDrillInline({ theme, P, isDark, skuRow, anio, anioPrev, skuMesRaw, inventarioSucursalMap, onClose }) {
  const sku = skuRow.sku;

  // Derivados del SKU
  const stats = useMemo(() => {
    let ytdPiezas = 0, ytdMonto = 0, prevPiezas = 0, prevMonto = 0;
    const mensual = Array(12).fill(0);
    const mensualMonto = Array(12).fill(0);
    for (const r of skuMesRaw) {
      if (r.sku !== sku) continue;
      const y = Number(r.anio);
      const m = Number(r.mes);
      const pz = Number(r.piezas) || 0;
      const mt = Number(r.monto) || 0;
      if (y === anio) {
        ytdPiezas += pz; ytdMonto += mt;
        if (m >= 1 && m <= 12) { mensual[m - 1] += pz; mensualMonto[m - 1] += mt; }
      } else if (y === anioPrev) {
        prevPiezas += pz; prevMonto += mt;
      }
    }
    const yoy = prevMonto > 0 ? ((ytdMonto - prevMonto) / prevMonto * 100) : null;
    const promMensual = mensual.filter((v) => v > 0);
    const promedio = promMensual.length > 0 ? promMensual.reduce((a, b) => a + b, 0) / promMensual.length : 0;
    return { ytdPiezas, ytdMonto, prevPiezas, prevMonto, mensual, mensualMonto, yoy, mesesActivos: promMensual.length, promedio };
  }, [skuMesRaw, sku, anio, anioPrev]);

  const invSuc = inventarioSucursalMap?.get(sku) || [];
  const invTotal = invSuc.reduce((s, x) => ({ stock: s.stock + x.stock, valor: s.valor + x.valor }), { stock: 0, valor: 0 });

  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#000000');
  const drillBg = isDark ? 'rgba(10,132,255,0.05)' : 'rgba(0,122,255,0.04)';
  const drillBorder = isDark ? 'rgba(10,132,255,0.18)' : 'rgba(0,122,255,0.24)';

  return (
    <div style={{
      background: drillBg,
      borderTop: `1px dashed ${drillBorder}`,
      borderBottom: `1px dashed ${drillBorder}`,
      padding: '12px 14px',
      animation: 'soV2SkuSlide 340ms cubic-bezier(.4,0,.2,1)',
      overflow: 'hidden',
    }}>
      <style>{`@keyframes soV2SkuSlide{from{opacity:0; transform:translateY(-6px);} to{opacity:1; transform:translateY(0);}}`}</style>
      <div style={{
        background: theme.surface, borderRadius: 12, overflow: 'hidden',
        boxShadow: isDark ? '0 4px 14px rgba(0,0,0,0.30)' : '0 2px 10px rgba(0,0,0,0.08)',
        border: `1px solid ${theme.border}`,
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Hero mini */}
        <div style={{
          background: heroBg, color: '#FFF', padding: '12px 18px',
          display: 'grid', gridTemplateColumns: '1fr auto auto auto auto', gap: 14, alignItems: 'center',
        }}>
          <div style={{ minWidth: 0 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.6)', fontWeight: 600 }}>
              Detalle SKU · Sell Out YTD {anio}
            </span>
            <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', margin: '3px 0 3px', color: '#FFF' }}>
              {sku} · {skuRow.descripcion || ''}
            </h3>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', margin: 0 }}>
              <strong style={{ color: marcaColor(skuRow.marca) }}>{skuRow.marca || 'Sin marca'}</strong>
              {skuRow.categoria ? ` · ${skuRow.categoria}` : ''}
              {skuRow.rdmp ? ` · Roadmap ${skuRow.rdmp}` : ''}
            </p>
          </div>
          <DrillHeroStat k="Piezas YTD" v={fmt.int(stats.ytdPiezas)} s={`vs ${fmt.int(stats.prevPiezas)} en ${anioPrev}`} />
          <DrillHeroStat k="Monto YTD" v={fmt.money(stats.ytdMonto)} s={`${stats.mesesActivos} meses activos`} />
          <DrillHeroStat k="YoY" v={stats.yoy != null ? `${stats.yoy >= 0 ? '+' : ''}${stats.yoy.toFixed(0)}%` : '—'} s="vs 2025" valColor={stats.yoy == null ? undefined : stats.yoy >= 0 ? P.green : P.red} />
          <button onClick={(e) => { e.stopPropagation(); onClose(); }}
            style={{
              background: 'rgba(255,255,255,0.14)', border: 0, color: '#FFF',
              width: 28, height: 28, borderRadius: 999, cursor: 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'flex-start',
              transition: 'background 200ms cubic-bezier(.4,0,.2,1)',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.22)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.14)'}
            title="Cerrar drill">✕</button>
        </div>

        {/* Body */}
        <div style={{ padding: '12px 18px 14px', display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 12 }}>
          {/* Evolución mensual del SKU */}
          <div style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>
                Evolución mensual · piezas {anio}
              </span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>
                Prom. {fmt.int(Math.round(stats.promedio))} pz/mes
              </span>
            </div>
            <SkuMonthlyChart theme={theme} P={P} isDark={isDark} mensual={stats.mensual} mensualMonto={stats.mensualMonto} />
          </div>
          {/* Inventario por sucursal */}
          <div style={{
            background: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
            borderRadius: 10, padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>
                Inventario por sucursal
              </span>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted }}>
                último snapshot
              </span>
            </div>
            {invSuc.length === 0 ? (
              <div style={{ padding: '18px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 10.5, fontStyle: 'italic' }}>Sin stock registrado</div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(invSuc.length, 5)}, 1fr)`, gap: 5 }}>
                  {invSuc.slice(0, 5).map((s, i) => {
                    const isTop = i === 0;
                    const label = (s.sucursal || '').slice(0, 4).toUpperCase();
                    return (
                      <div key={s.sucursal} style={{
                        background: theme.surface, border: `1px solid ${isTop ? P.accent : theme.border}`,
                        borderRadius: 6, padding: '6px 4px', textAlign: 'center',
                        boxShadow: isTop ? `0 0 0 1px ${P.accent}44` : 'none',
                      }}>
                        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.05em', color: theme.textMuted, fontWeight: 600 }}>{label}</div>
                        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 700, color: theme.text, marginTop: 1, letterSpacing: '-0.01em' }}>{fmt.int(s.stock)}</div>
                        <div style={{ fontSize: 8.5, color: theme.textSubtle || theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>{s.valor > 0 ? fmt.money(s.valor) : ''}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', padding: '6px 0 0', marginTop: 6,
                  borderTop: `1px dashed ${theme.divider || theme.border}`,
                  fontSize: 10, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace',
                }}>
                  <span>{invSuc.length} con stock</span>
                  <span>Total <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.int(invTotal.stock)} pz</strong>{invTotal.valor > 0 ? <> · <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmt.money(invTotal.valor)}</strong></> : null}</span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DrillHeroStat({ k, v, s, valColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, color: valColor || '#FFF', letterSpacing: '-0.015em', fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      {s && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.55)' }}>{s}</div>}
    </div>
  );
}

function SkuMonthlyChart({ mensual }) {
  const datos = MESES.map((x, i) => ({ x, piezas: mensual[i] > 0 ? mensual[i] : null }));
  return <GraficaLineas compacto datos={datos} series={[{ key: 'piezas', label: 'Piezas', tipo: 'principal' }]} formato={(v) => `${fmt.int(v)} pz`} alto={110} mostrarMinMax={false} />;
}
