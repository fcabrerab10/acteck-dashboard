import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import {
  ShoppingBag, Search, Download, ChevronDown, ChevronRight, Check, ArrowUpDown, ArrowUp, ArrowDown,
} from 'lucide-react';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer,
  ComposedChart, Bar, PieChart, Pie, Cell,
} from 'recharts';
import * as XLSX from 'xlsx-js-style';

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_LARGO = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Config por cliente. Cada cliente puede tener su propia vista / tabla / mayorista.
const CLIENTES_META = {
  dicotech: {
    nombre: 'Dicotech',
    marca: 'Acteck',
    accent: '#0EA5E9',
    vistaMensual: 'v_sellout_dicotech_mensual',
    vistaSkuMes: 'v_sellout_dicotech_sku_mes',
    vistaSucursalMes: 'v_sellout_dicotech_sucursal_mes',
    mayoristaKey: 'DICOTECH',
    sellInClienteKey: 'dicotech',
    listaPrecio: 'DICOTECH',
    drillClientesFinales: true,
    drillVendedores: true,
    drillSucursales: true,
  },
};

// Meta de sucursales Dicotech: label bonito, tipo (fisica/virtual), color, código,
// y coordenadas para posicionar burbuja en el mapa SVG (viewBox 0 0 640 420).
const SUCURSAL_META = {
  'dicoags2':  { label: 'Aguascalientes', tipo: 'fisica', codigo: 'AG', color: '#0EA5E9', mapX: 273, mapY: 230 },
  'leon2':     { label: 'León',           tipo: 'fisica', codigo: 'LE', color: '#6366F1', mapX: 325, mapY: 256 },
  'Arboledas': { label: 'Arboledas',      tipo: 'fisica', codigo: 'AR', color: '#10B981', mapX: 358, mapY: 278, subtitle: 'Naucalpan' },
  'GDL':       { label: 'Guadalajara',    tipo: 'fisica', codigo: 'GL', color: '#F59E0B', mapX: 234, mapY: 270 },
  'ZACATECAS': { label: 'Zacatecas',      tipo: 'fisica', codigo: 'ZA', color: '#EC4899', mapX: 297, mapY: 207 },
  'santafe':   { label: 'Santa Fe',       tipo: 'fisica', codigo: 'SF', color: '#8B5CF6', mapX: 368, mapY: 288, subtitle: 'CDMX' },
  'DC':        { label: 'DC',             tipo: 'fisica', codigo: 'DC', color: '#F97316', mapX: 350, mapY: 292 },
  'AMAZON':    { label: 'Amazon',         tipo: 'virtual', icon: '🛒', color: '#F97316' },
  'Internet':  { label: 'Internet',       tipo: 'virtual', icon: '🌐', color: '#94A3B8' },
  'dropship':  { label: 'Dropship',       tipo: 'virtual', icon: '📦', color: '#14B8A6' },
};
const SUCURSAL_LABEL = Object.fromEntries(Object.entries(SUCURSAL_META).map(([k, v]) => [k, v.label]));
const SUCURSAL_COLOR = Object.values(SUCURSAL_META).map((v) => v.color);
const metaSuc = (name) => SUCURSAL_META[name] || { label: name, tipo: 'virtual', codigo: name?.slice(0, 2).toUpperCase() || '?', color: '#94A3B8' };

const CAT_COLORS = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#94A3B8', '#F97316'];
const ROADMAP_COLOR = {
  RMI:  { bg:'#E1F5EE', text:'#085041' },
  RML:  { bg:'#EEEDFE', text:'#3C3489' },
  2026: { bg:'#FAEEDA', text:'#854F0B' },
  RMS:  { bg:'#FBEAF0', text:'#993556' },
};

const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const fmtMoneyShort = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(n);
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return '$' + (n / 1e3).toFixed(0) + 'K';
  return '$' + Math.round(n);
};

const PAGE = 1000;
async function fetchAll(table, select, extra = (q) => q) {
  let acc = []; let from = 0;
  while (true) {
    let q = supabase.from(table).select(select).range(from, from + PAGE - 1);
    q = extra(q);
    const { data, error } = await q;
    if (error || !data || data.length === 0) break;
    acc = acc.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return acc;
}

function MultiSelect({ label, options, selected, onChange, width = 160 }) {
  const [open, setOpen] = useState(false);
  const ref = React.useRef(null);
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const summary = selected.size === 0 ? `${label}: todas` : `${label}: ${selected.size}`;
  const toggle = (v) => {
    const next = new Set(selected);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  return (
    <div className="relative" ref={ref} style={{ width }}>
      <button onClick={() => setOpen((o) => !o)}
        className="w-full h-8 px-2.5 border border-gray-200 rounded-lg text-xs bg-white flex items-center justify-between gap-2 hover:border-gray-300">
        <span className="truncate text-gray-700">{summary}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-72 overflow-auto">
          <div className="flex items-center justify-between px-2 py-1.5 text-[11px] border-b border-gray-100 sticky top-0 bg-white">
            <button className="text-sky-600 hover:underline" onClick={() => onChange(new Set(options))}>Todas</button>
            <button className="text-gray-500 hover:underline" onClick={() => onChange(new Set())}>Limpiar</button>
          </div>
          {options.map((o) => {
            const sel = selected.has(o);
            return (
              <button key={o} onClick={() => toggle(o)}
                className="w-full flex items-center gap-2 px-2 py-1.5 text-xs hover:bg-gray-50 text-left">
                <span className={`w-4 h-4 border rounded flex items-center justify-center flex-shrink-0 ${sel ? 'bg-sky-500 border-sky-500' : 'border-gray-300'}`}>
                  {sel && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="truncate">{o}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function SellOutCliente({ clienteKey = 'dicotech' }) {
  const meta = CLIENTES_META[clienteKey] || CLIENTES_META.dicotech;
  const ACCENT = meta.accent;
  const hoy = new Date();
  const anioActual = hoy.getFullYear();
  const anioPrev = anioActual - 1;

  const [loading, setLoading] = useState(true);
  const [mensualDico, setMensualDico] = useState([]);
  const [skuMesRaw, setSkuMesRaw] = useState([]);
  const [roadmap, setRoadmap] = useState([]);
  const [facturacion, setFacturacion] = useState([]); // sell-in del mismo cliente para bloque conversión
  const [inventarioCliente, setInventarioCliente] = useState([]);
  const [inventarioSucursal, setInventarioSucursal] = useState([]);
  const [sucursalMes, setSucursalMes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [marcaSel, setMarcaSel] = useState(new Set());
  const [roadmapSel, setRoadmapSel] = useState(new Set());
  const [familiaSel, setFamiliaSel] = useState(new Set());
  const [orden, setOrden] = useState({ col: null, dir: null });
  const [skuAbierto, setSkuAbierto] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [mes, skuMes, rdmp, fact, inv, sucMes, invSuc] = await Promise.all([
        fetchAll(meta.vistaMensual, 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas'),
        fetchAll(meta.vistaSkuMes, 'sku,anio,mes,piezas,monto',
          (q) => q.in('anio', [anioPrev, anioActual])),
        fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp,sort_order'),
        fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto',
          (q) => q.eq('cliente_key', meta.sellInClienteKey).in('anio', [anioPrev, anioActual])),
        fetchAll('inventario_cliente', 'sku,stock,valor,precio_venta,costo_convenio,anio,semana,fecha_ultima_venta,dias_sin_venta',
          (q) => q.eq('cliente', meta.sellInClienteKey)),
        meta.vistaSucursalMes
          ? fetchAll(meta.vistaSucursalMes, 'sucursal,anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos',
              (q) => q.in('anio', [anioPrev, anioActual]))
          : Promise.resolve([]),
        fetchAll('inventario_cliente_sucursal', 'sku,sucursal,stock,valor,costo_convenio,anio,semana',
          (q) => q.eq('cliente', meta.sellInClienteKey)),
      ]);
      setMensualDico(mes);
      setSkuMesRaw(skuMes);
      setRoadmap(rdmp);
      setFacturacion(fact);
      setInventarioCliente(inv);
      setSucursalMes(sucMes);
      setInventarioSucursal(invSuc);
      setLoading(false);
    })();
  }, [anioActual, anioPrev, meta.vistaMensual, meta.vistaSkuMes, meta.sellInClienteKey]);

  // ── Determinar mes actual real (último mes con data) ──
  const mesActual = useMemo(() => {
    let last = 1;
    for (const r of mensualDico) if (r.anio === anioActual && Number(r.piezas) > 0) last = Math.max(last, r.mes);
    return last;
  }, [mensualDico, anioActual]);

  const roadmapMap = useMemo(() => {
    const m = new Map();
    for (const r of roadmap) m.set(r.sku, r);
    return m;
  }, [roadmap]);

  // ── Serie mensual $ y piezas por año ──
  const mensualPorAnio = useMemo(() => {
    const m = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    const p = { [anioPrev]: Array(12).fill(0), [anioActual]: Array(12).fill(0) };
    for (const r of mensualDico) {
      const y = r.anio, i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      if (m[y]) { m[y][i] = Number(r.monto) || 0; p[y][i] = Number(r.piezas) || 0; }
    }
    return { monto: m, piezas: p };
  }, [mensualDico, anioPrev, anioActual]);

  const chartData = useMemo(() => MESES.map((label, i) => ({
    mes: label,
    monto2025: Math.round(mensualPorAnio.monto[anioPrev][i]),
    monto2026: i <= mesActual - 1 && mensualPorAnio.monto[anioActual][i] > 0 ? Math.round(mensualPorAnio.monto[anioActual][i]) : null,
  })), [mensualPorAnio, anioPrev, anioActual, mesActual]);

  // ── KPIs ──
  const kpis = useMemo(() => {
    const mtdMonto = mensualPorAnio.monto[anioActual][mesActual - 1] || 0;
    const mtdPiezas = mensualPorAnio.piezas[anioActual][mesActual - 1] || 0;
    const mtdPrev = mensualPorAnio.monto[anioPrev][mesActual - 1] || 0;
    const yoyMtd = mtdPrev > 0 ? ((mtdMonto - mtdPrev) / mtdPrev * 100) : null;

    let ytdMonto = 0, ytdPiezas = 0, ytdMontoPrev = 0, ytdPiezasPrev = 0;
    for (let i = 0; i < mesActual; i++) {
      ytdMonto += mensualPorAnio.monto[anioActual][i];
      ytdPiezas += mensualPorAnio.piezas[anioActual][i];
      ytdMontoPrev += mensualPorAnio.monto[anioPrev][i];
      ytdPiezasPrev += mensualPorAnio.piezas[anioPrev][i];
    }
    const yoyYtd = ytdMontoPrev > 0 ? ((ytdMonto - ytdMontoPrev) / ytdMontoPrev * 100) : null;

    let facturasYTD = 0, clientesYTD = 0;
    for (const r of mensualDico) if (r.anio === anioActual && r.mes <= mesActual) {
      facturasYTD += Number(r.facturas) || 0;
      clientesYTD += Number(r.clientes_distintos) || 0;
    }
    let facturasYTDPrev = 0;
    for (const r of mensualDico) if (r.anio === anioPrev && r.mes <= mesActual) {
      facturasYTDPrev += Number(r.facturas) || 0;
    }
    const ticketPromedio = facturasYTD > 0 ? (ytdMonto / facturasYTD) : null;
    const ticketPrev = facturasYTDPrev > 0 ? (ytdMontoPrev / facturasYTDPrev) : null;
    const yoyTicket = ticketPrev > 0 ? ((ticketPromedio - ticketPrev) / ticketPrev * 100) : null;

    return { mtdMonto, mtdPiezas, mtdPrev, yoyMtd, ytdMonto, ytdPiezas, ytdMontoPrev, yoyYtd,
      facturasYTD, clientesYTD, ticketPromedio, yoyTicket };
  }, [mensualPorAnio, anioActual, anioPrev, mesActual, mensualDico]);

  // ── Matriz sku × mes (piezas) ──
  const matrizSku = useMemo(() => {
    const m = new Map();
    for (const r of skuMesRaw) {
      if (r.anio !== anioActual) continue;
      if (!m.has(r.sku)) m.set(r.sku, Array(12).fill(0));
      m.get(r.sku)[r.mes - 1] += Number(r.piezas) || 0;
    }
    return m;
  }, [skuMesRaw, anioActual]);

  const skusVendidos = useMemo(() => {
    const s = new Set();
    for (const r of skuMesRaw) if (r.anio === anioActual) s.add(r.sku);
    return s;
  }, [skuMesRaw, anioActual]);

  // ── Inventario cliente: último snapshot por SKU ──
  const inventarioMap = useMemo(() => {
    const m = new Map();
    for (const r of inventarioCliente) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = m.get(r.sku);
      if (!prev || key > prev._key) {
        m.set(r.sku, {
          stock: Number(r.stock) || 0,
          valor: Number(r.valor) || 0,
          precio_venta: Number(r.precio_venta) || 0,
          costo_convenio: Number(r.costo_convenio) || 0,
          fecha_ultima_venta: r.fecha_ultima_venta,
          dias_sin_venta: Number(r.dias_sin_venta) || null,
          anio: r.anio, semana: r.semana,
          _key: key,
        });
      }
    }
    return m;
  }, [inventarioCliente]);

  const invSemanaMax = useMemo(() => {
    let key = 0, anio = null, semana = null;
    for (const r of inventarioCliente) {
      const k = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      if (k > key) { key = k; anio = r.anio; semana = r.semana; }
    }
    return { anio, semana };
  }, [inventarioCliente]);

  const invTotales = useMemo(() => {
    let stock = 0, valor = 0;
    for (const [, v] of inventarioMap) { stock += v.stock; valor += v.valor; }
    return { stock, valor };
  }, [inventarioMap]);

  const skusConInventario = useMemo(() => {
    const s = new Set();
    for (const [sku, v] of inventarioMap) if (v.stock > 0) s.add(sku);
    return s;
  }, [inventarioMap]);

  // ── Inventario por sucursal: último snapshot por (sku, sucursal) ──
  const inventarioSucursalMap = useMemo(() => {
    // sku → array de {sucursal, stock, valor, anio, semana}
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
          costo_convenio: Number(r.costo_convenio) || 0,
          anio: r.anio, semana: r.semana, _key: key,
        });
      }
    }
    // Convertir Map interior a array sorted por stock desc
    const out = new Map();
    for (const [sku, bySuc] of bySku) {
      const arr = Array.from(bySuc.values())
        .filter((x) => x.stock > 0)
        .sort((a, b) => b.stock - a.stock);
      if (arr.length > 0) out.set(sku, arr);
    }
    return out;
  }, [inventarioSucursal]);

  // Agregado por sucursal (todos los SKUs) para bloque global
  const inventarioSucursalTotales = useMemo(() => {
    const map = new Map();
    for (const [, arr] of inventarioSucursalMap) {
      for (const s of arr) {
        if (!map.has(s.sucursal)) map.set(s.sucursal, { sucursal: s.sucursal, stock: 0, valor: 0, skus: 0 });
        const it = map.get(s.sucursal);
        it.stock += s.stock;
        it.valor += s.valor;
        it.skus += 1;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.valor - a.valor);
  }, [inventarioSucursalMap]);

  // ── Ventas por sucursal ──
  const sucursalesYTD = useMemo(() => {
    const map = new Map();
    const mapPrev = new Map();
    for (const r of sucursalMes) {
      const key = r.sucursal || '(sin sucursal)';
      const tgt = r.anio === anioActual ? map : r.anio === anioPrev ? mapPrev : null;
      if (!tgt) continue;
      if (tgt === map && r.mes > mesActual) continue;
      if (tgt === mapPrev && r.mes > mesActual) continue;
      if (!tgt.has(key)) tgt.set(key, { name: key, monto: 0, piezas: 0, tx: 0, skus: 0 });
      const it = tgt.get(key);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.tx += Number(r.tx) || 0;
      it.skus = Math.max(it.skus, Number(r.skus_distintos) || 0);
    }
    const arr = Array.from(map.values()).sort((a, b) => b.monto - a.monto);
    const tot = arr.reduce((s, x) => s + x.monto, 0);
    return arr.map((v, i) => {
      const prev = mapPrev.get(v.name);
      return {
        ...v,
        label: SUCURSAL_LABEL[v.name] || v.name,
        pct: tot ? (v.monto / tot * 100) : 0,
        color: SUCURSAL_COLOR[i % SUCURSAL_COLOR.length],
        prevMonto: prev?.monto || 0,
        yoy: prev?.monto > 0 ? ((v.monto - prev.monto) / prev.monto * 100) : null,
      };
    });
  }, [sucursalMes, anioActual, anioPrev, mesActual]);

  const sucursalesMensual = useMemo(() => {
    // matriz sucursal × mes para 2026 (monto y piezas)
    const skToMes = new Map();
    for (const r of sucursalMes) {
      if (r.anio !== anioActual) continue;
      const key = r.sucursal || '(sin sucursal)';
      if (!skToMes.has(key)) skToMes.set(key, Array(12).fill(0));
      skToMes.get(key)[r.mes - 1] = Number(r.monto) || 0;
    }
    return skToMes;
  }, [sucursalMes, anioActual]);

  // ── Composición por familia YTD ──
  const familiasYTD = useMemo(() => {
    const map = new Map();
    for (const r of skuMesRaw) {
      if (r.anio !== anioActual || r.mes > mesActual) continue;
      const fam = (roadmapMap.get(r.sku)?.familia || 'Sin familia').trim();
      const norm = fam.charAt(0).toUpperCase() + fam.slice(1).toLowerCase();
      if (!map.has(norm)) map.set(norm, { name: norm, monto: 0, piezas: 0, skus: new Set() });
      const it = map.get(norm);
      it.monto += Number(r.monto) || 0;
      it.piezas += Number(r.piezas) || 0;
      it.skus.add(r.sku);
    }
    const arr = Array.from(map.values()).map((v) => ({ ...v, skus: v.skus.size })).sort((a, b) => b.monto - a.monto);
    const tot = arr.reduce((s, x) => s + x.monto, 0);
    return arr.map((v, i) => ({ ...v, pct: tot ? (v.monto / tot * 100) : 0, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [skuMesRaw, roadmapMap, anioActual, mesActual]);

  const marcasOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.marca).filter(Boolean))).sort(), [roadmap]);
  const roadmapOpciones = useMemo(() => Array.from(new Set(roadmap.map((r) => r.rdmp).filter(Boolean))).sort(), [roadmap]);
  const familiaOpciones = useMemo(() => {
    const set = new Set();
    for (const r of roadmap) {
      const f = (r.familia || '').trim();
      if (f) set.add(f.charAt(0).toUpperCase() + f.slice(1).toLowerCase());
    }
    return Array.from(set).sort();
  }, [roadmap]);

  // ── Roadmap ordenado por sort_order (nulls al final) ──
  const roadmapOrdenado = useMemo(() => {
    return [...roadmap].sort((a, b) => {
      const sa = a.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(a.sort_order);
      const sb = b.sort_order == null ? Number.MAX_SAFE_INTEGER : Number(b.sort_order);
      if (sa !== sb) return sa - sb;
      return String(a.sku || '').localeCompare(String(b.sku || ''));
    });
  }, [roadmap]);

  // ── Filas tabla — muestra TODO el roadmap en orden sort_order ──
  const filas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const rows = [];
    for (const r of roadmapOrdenado) {
      // Solo SKUs con venta 2026 O con inventario > 0 en el cliente
      const tieneVenta = skusVendidos.has(r.sku);
      const tieneInv = skusConInventario.has(r.sku);
      if (!tieneVenta && !tieneInv) continue;
      if (marcaSel.size > 0 && !marcaSel.has(r.marca)) continue;
      if (roadmapSel.size > 0 && !roadmapSel.has(r.rdmp)) continue;
      const famNorm = ((r.familia || '').trim());
      const famCap = famNorm ? famNorm.charAt(0).toUpperCase() + famNorm.slice(1).toLowerCase() : '';
      if (familiaSel.size > 0 && !familiaSel.has(famCap)) continue;
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
        ...r, familiaCap: famCap, piezas, total, promedio,
        vendido: tieneVenta,
        invStock: inv?.stock || 0,
        invValor: inv?.valor || 0,
        invDiasSinVenta: inv?.dias_sin_venta || null,
      });
    }
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      rows.sort((a, b) => ((a[orden.col] || 0) - (b[orden.col] || 0)) * factor);
    }
    return rows;
  }, [roadmapOrdenado, skusVendidos, skusConInventario, inventarioMap, matrizSku, busqueda, marcaSel, roadmapSel, familiaSel, orden, mesActual]);

  const totalesFila = useMemo(() => {
    const t = Array(12).fill(0);
    for (const r of filas) for (let i = 0; i < 12; i++) t[i] += r.piezas[i];
    const total = t.reduce((a, b) => a + b, 0);
    const cerrados = t.slice(0, mesActual);
    const conVenta = cerrados.filter((v) => v > 0);
    const promedio = conVenta.length ? conVenta.reduce((a, b) => a + b, 0) / conVenta.length : 0;
    return { mes: t, total, promedio };
  }, [filas, mesActual]);

  const maxCelda = useMemo(() => {
    let m = 0;
    for (const r of filas) for (const v of r.piezas) if (v > m) m = v;
    return m || 1;
  }, [filas]);

  const heatClass = (v) => {
    if (!v) return null;
    const r = v / maxCelda;
    if (r > 0.75) return { bg: '#7DD3FC', color: '#082F49', weight: 600 };
    if (r > 0.50) return { bg: '#BAE6FD', color: '#0C4A6E', weight: 500 };
    if (r > 0.25) return { bg: '#E0F2FE', color: '#0C4A6E' };
    return { bg: '#F0F9FF', color: '#334155' };
  };

  const toggleOrden = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };
  const SortHeader = ({ col, label }) => {
    const active = orden.col === col;
    const Icon = !active ? ArrowUpDown : orden.dir === 'asc' ? ArrowUp : ArrowDown;
    return (
      <button onClick={() => toggleOrden(col)}
        className={`inline-flex items-center gap-1 ${active ? 'text-sky-700' : 'text-gray-500'} hover:text-gray-700`}>
        {label}<Icon className="w-3 h-3" />
      </button>
    );
  };

  const exportarExcel = () => {
    const HEADERS = ['Marca', 'SKU', 'Descripción', 'Familia', 'Roadmap', ...MESES, 'Promedio', 'Total', `Inv. ${meta.nombre} (pz)`, `Inv. ${meta.nombre} ($)`];
    const rows = filas.map((r) => [
      r.marca || '', r.sku || '', r.descripcion || '', r.familiaCap || '', r.rdmp || '',
      ...r.piezas.map((v) => v || null),
      Math.round(r.promedio) || null,
      r.total,
      r.invStock || null,
      r.invValor || null,
    ]);
    const totalRow = ['TOTAL', `${filas.length} SKUs`, '', '', '', ...totalesFila.mes.map((v) => v || null), Math.round(totalesFila.promedio) || null, totalesFila.total, invTotales.stock, invTotales.valor];
    const titulo = `Sell Out ${meta.nombre} · ${anioActual}`;
    const aoa = [[titulo, ...Array(HEADERS.length - 1).fill('')], HEADERS, ...rows, totalRow];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const headStyle = { font: { bold: true, color: { rgb: 'FFFFFF' } }, fill: { patternType: 'solid', fgColor: { rgb: '000000' } }, alignment: { horizontal: 'center', vertical: 'center', wrapText: true } };
    const titStyle = { ...headStyle, font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 14 } };
    for (let c = 0; c < HEADERS.length; c++) {
      const t = XLSX.utils.encode_cell({ r: 0, c });
      if (!ws[t]) ws[t] = { v: '', t: 's' };
      ws[t].s = titStyle;
      const h = XLSX.utils.encode_cell({ r: 1, c });
      if (ws[h]) ws[h].s = headStyle;
    }
    ws['!merges'] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: HEADERS.length - 1 } }];
    ws['!rows'] = [{ hpt: 26 }, { hpt: 24 }];
    ws['!cols'] = [{ wch: 10 }, { wch: 14 }, { wch: 50 }, { wch: 18 }, { wch: 9 }, ...MESES.map(() => ({ wch: 8 })), { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 14 }];
    ws['!freeze'] = { xSplit: 5, ySplit: 2 };
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sell Out');
    XLSX.writeFile(wb, `Sell Out ${meta.nombre} ${anioActual}.xlsx`);
  };

  if (loading) {
    return <div className="p-12 text-center text-gray-400">Cargando Sell Out de {meta.nombre}…</div>;
  }

  return (
    <div className="max-w-none mx-auto p-3 space-y-3">
      {/* Header */}
      <div className="flex items-end justify-between">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 text-[11px] font-semibold mb-1.5">
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: ACCENT }} />
            {meta.nombre} · {meta.marca}
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-gray-700" /> Sell Out
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Ventas de {meta.nombre} a sus clientes finales · Fuente Sellout General{invSemanaMax.semana ? ` · Inventario snapshot semana ${invSemanaMax.semana} ${invSemanaMax.anio}` : ''}
          </p>
        </div>
        <button onClick={exportarExcel}
          className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100">
          <Download className="w-3.5 h-3.5" /> Exportar Excel
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <KPI label={`Sell-out mes actual · ${MESES_LARGO[mesActual - 1]} ${anioActual}`}
          badge={kpis.yoyMtd != null ? `${kpis.yoyMtd >= 0 ? '+' : ''}${kpis.yoyMtd.toFixed(0)}% YoY` : null}
          badgeTone={kpis.yoyMtd == null ? 'neutral' : kpis.yoyMtd >= 0 ? 'good' : 'bad'}
          value={formatMXN(kpis.mtdMonto)}
          sub={<>
            <span className="tabular-nums">{fmtInt(kpis.mtdPiezas)} piezas</span>
            <span className="tabular-nums text-gray-400">vs {formatMXN(kpis.mtdPrev)} en {MESES[mesActual - 1]} {anioPrev}</span>
          </>}
        />
        <KPI label={`Sell-out YTD ${anioActual} · Ene – ${MESES[mesActual - 1]}`}
          badge={kpis.yoyYtd != null ? `${kpis.yoyYtd >= 0 ? '+' : ''}${kpis.yoyYtd.toFixed(0)}% vs YTD ${String(anioPrev).slice(-2)}` : null}
          badgeTone={kpis.yoyYtd == null ? 'neutral' : kpis.yoyYtd >= 0 ? 'good' : 'bad'}
          value={formatMXN(kpis.ytdMonto)}
          sub={<>
            <span className="tabular-nums">{fmtInt(kpis.ytdPiezas)} pz · {skusVendidos.size} SKUs</span>
            <span className="tabular-nums text-gray-400">vs {formatMXN(kpis.ytdMontoPrev)}</span>
          </>}
        />
        <KPI label={`Ticket promedio ${anioActual}`}
          badge={kpis.yoyTicket != null ? `${kpis.yoyTicket >= 0 ? '+' : ''}${kpis.yoyTicket.toFixed(0)}% vs ${String(anioPrev).slice(-2)}` : null}
          badgeTone={kpis.yoyTicket == null ? 'neutral' : kpis.yoyTicket >= 0 ? 'good' : 'bad'}
          value={formatMXN(kpis.ticketPromedio)}
          sub={<>
            <span className="tabular-nums">{fmtInt(kpis.facturasYTD)} facturas emitidas</span>
          </>}
        />
      </div>

      {/* Chart + Donut */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-2">
            <h3 className="text-sm font-semibold text-gray-800">Evolución mensual · Sell-out en $</h3>
            <div className="text-[11px] text-gray-500 flex gap-3">
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: '#F59E0B' }} /> {anioPrev}</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5" style={{ background: ACCENT }} /> {anioActual}</span>
            </div>
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="0" stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 'auto']} tickFormatter={(v) => fmtMoneyShort(v)}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v, name) => [formatMXN(v), name]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                <Line dataKey="monto2025" name={String(anioPrev)} stroke="#F59E0B" strokeWidth={2}
                  dot={{ r: 3, fill: '#F59E0B' }} activeDot={{ r: 5 }} connectNulls={false} />
                <Line dataKey="monto2026" name={String(anioActual)} stroke={ACCENT} strokeWidth={2.5}
                  dot={{ r: 3.5, fill: ACCENT }} activeDot={{ r: 5 }} connectNulls={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <div className="flex justify-between items-baseline mb-3">
            <h3 className="text-sm font-semibold text-gray-800">Composición por familia</h3>
            <span className="text-[10.5px] text-gray-500">YTD {anioActual} · {formatMXN(kpis.ytdMonto)}</span>
          </div>
          <div className="grid grid-cols-[130px_1fr] gap-4 items-center">
            <div style={{ width: 130, height: 130, position: 'relative' }}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={familiasYTD} dataKey="monto" cx="50%" cy="50%" innerRadius={40} outerRadius={62} paddingAngle={1} stroke="none">
                    {familiasYTD.map((c, i) => <Cell key={i} fill={c.color} />)}
                  </Pie>
                  <Tooltip formatter={(v) => formatMXN(v)} contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                <div className="text-[15px] font-semibold text-gray-800 tabular-nums">{familiasYTD.length}</div>
                <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-0.5">familias</div>
              </div>
            </div>
            <div className="flex flex-col gap-1.5 text-[11px]">
              {familiasYTD.slice(0, 6).map((c) => (
                <div key={c.name} className="grid grid-cols-[10px_1fr_auto] gap-2 items-center">
                  <span className="w-2 h-2 rounded-sm" style={{ background: c.color }} />
                  <span className="text-gray-700 truncate">{c.name}</span>
                  <span className="text-gray-500 tabular-nums font-medium">{c.pct.toFixed(1)}%</span>
                  <span className="col-span-2 col-start-2 h-0.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, c.pct)}%`, background: c.color }} />
                  </span>
                </div>
              ))}
            </div>
          </div>
          {familiasYTD.length >= 2 && (
            <div className="border-t border-gray-100 pt-2.5 mt-3 flex justify-between text-[11px] text-gray-500">
              <span>Dominante: <span className="text-gray-800 font-semibold">{familiasYTD[0].name}</span></span>
              <span>Top 3 = <span className="text-gray-800 font-semibold tabular-nums">{familiasYTD.slice(0, 3).reduce((s, x) => s + x.pct, 0).toFixed(1)}%</span></span>
            </div>
          )}
        </div>
      </div>

      {/* Tabla SKUs */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-3 border-b border-gray-200 bg-gray-50/60">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-1.5 px-2 bg-white border border-gray-200 rounded-lg h-8 flex-1 min-w-0 max-w-xs">
              <Search className="w-3.5 h-3.5 text-gray-400" />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar SKU o descripción…"
                className="flex-1 outline-none text-xs bg-transparent min-w-0" />
            </div>
            <MultiSelect label="Marca" options={marcasOpciones} selected={marcaSel} onChange={setMarcaSel} width={140} />
            <MultiSelect label="Roadmap" options={roadmapOpciones} selected={roadmapSel} onChange={setRoadmapSel} width={130} />
            <MultiSelect label="Familia" options={familiaOpciones} selected={familiaSel} onChange={setFamiliaSel} width={160} />
          </div>
          <span className="text-[11px] text-gray-500">
            {filas.length} SKUs · {filas.filter((r) => r.vendido).length} con venta {anioActual} · {filas.filter((r) => r.invStock > 0).length} con inventario
          </span>
        </div>
        <div className="overflow-auto" style={{ maxHeight: '70vh' }}>
          <table className="w-full text-[11px]">
            <thead>
              <tr>
                {[
                  { l: '', w: 24 },
                  { l: 'Marca', w: 60 },
                  { l: 'SKU', w: 88 },
                  { l: 'Descripción' },
                  { l: 'Roadmap', a: 'center', w: 60 },
                  ...MESES.map((m) => ({ l: m, a: 'right', w: 44 })),
                  { l: 'Promedio', a: 'right', sort: 'promedio', w: 60 },
                  { l: 'Total',    a: 'right', sort: 'total', w: 64 },
                  { l: `Inv. ${meta.nombre}`, a: 'right', sort: 'invStock', w: 90 },
                ].map((h, i) => (
                  <th key={i} className="py-1.5 px-1.5 font-medium uppercase tracking-wider text-[9px] text-gray-500 border-b border-gray-200 bg-gray-50"
                    style={{ textAlign: h.a || 'left', width: h.w, whiteSpace: 'nowrap' }}>
                    {h.sort ? <SortHeader col={h.sort} label={h.l} /> : h.l}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={19} className="py-12 text-center text-gray-400 text-sm">Sin SKUs para los filtros seleccionados.</td></tr>
              )}
              {filas.map((r) => {
                const rmp = ROADMAP_COLOR[r.rdmp] || { bg: '#F1EFE8', text: '#2C2C2A' };
                const abierta = skuAbierto === r.sku;
                return (
                  <React.Fragment key={r.sku}>
                    <tr onClick={() => setSkuAbierto(abierta ? null : r.sku)}
                      className={`border-t border-gray-100 cursor-pointer ${abierta ? 'bg-sky-50' : 'hover:bg-gray-50'}`}>
                      <td className="py-1 px-1.5 whitespace-nowrap">
                        <ChevronRight className="w-3 h-3 text-sky-500 transition-transform"
                          style={{ transform: abierta ? 'rotate(90deg)' : 'none' }} />
                      </td>
                      <td className="py-1 px-1.5 text-gray-600 text-[10px] whitespace-nowrap">{r.marca || '—'}</td>
                      <td className="py-1 px-1.5 font-mono text-gray-700 text-[10px] whitespace-nowrap">{r.sku}</td>
                      <td className="py-1 px-1.5 text-gray-800 truncate" style={{ maxWidth: 240 }} title={r.descripcion}>{r.descripcion || '—'}</td>
                      <td className="py-1 px-1.5 text-center">
                        {r.rdmp && <span className="text-[9px] font-medium px-1 py-0.5 rounded" style={{ background: rmp.bg, color: rmp.text }}>{r.rdmp}</span>}
                      </td>
                      {r.piezas.map((v, i) => {
                        const h = heatClass(v);
                        return (
                          <td key={i} className="py-1 px-1 text-right tabular-nums whitespace-nowrap"
                            style={{ background: h?.bg, color: h?.color || '#9CA3AF', fontWeight: h?.weight || 400 }}>
                            {v ? fmtInt(v) : '—'}
                          </td>
                        );
                      })}
                      <td className="py-1 px-1.5 text-right tabular-nums text-gray-700 bg-gray-50/60">
                        {r.promedio ? fmtInt(r.promedio) : '—'}
                      </td>
                      <td className="py-1 px-1.5 text-right tabular-nums font-semibold text-gray-800 bg-gray-50">
                        {fmtInt(r.total)}
                      </td>
                      <td className="py-1 px-1.5 text-right whitespace-nowrap" style={{ background: '#EEF2FF' }}>
                        {r.invStock > 0 ? (
                          <>
                            <div className="text-[11px] font-semibold text-indigo-800 tabular-nums">{fmtInt(r.invStock)} pz</div>
                            <div className="text-[10px] text-indigo-500 tabular-nums">{formatMXN(r.invValor)}</div>
                          </>
                        ) : (
                          <span className="text-gray-400 text-[10px]">—</span>
                        )}
                      </td>
                    </tr>
                    {abierta && (
                      <tr>
                        <td colSpan={20} style={{ padding: 0, background: '#FFFFFF', borderTop: '1px solid #E5E7EB', borderBottom: '1px solid #E5E7EB' }}>
                          <SkuDrillDownBoundary sku={r.sku}>
                            <SkuDrillDown sku={r.sku} skuInfo={r} meta={meta}
                              anioActual={anioActual} anioPrev={anioPrev} mesActual={mesActual}
                              sellInAcumulado={facturacion}
                              inventarioSucursales={inventarioSucursalMap.get(r.sku) || []} />
                          </SkuDrillDownBoundary>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              <tr className="font-semibold text-gray-800 bg-gray-50" style={{ borderTop: '2px solid #E5E7EB' }}>
                <td></td>
                <td colSpan={4} className="py-1.5 px-2 text-[10px] uppercase tracking-wider text-gray-600">Total · {filas.length} SKUs</td>
                {totalesFila.mes.map((v, i) => (
                  <td key={i} className="py-1.5 px-1 text-right tabular-nums">{v ? fmtInt(v) : '—'}</td>
                ))}
                <td className="py-1.5 px-1.5 text-right tabular-nums">{totalesFila.promedio ? fmtInt(totalesFila.promedio) : '—'}</td>
                <td className="py-1.5 px-1.5 text-right tabular-nums">{fmtInt(totalesFila.total)}</td>
                <td className="py-1.5 px-1.5 text-right whitespace-nowrap" style={{ background: '#E0E7FF' }}>
                  <div className="text-[11px] font-semibold text-indigo-800 tabular-nums">{fmtInt(invTotales.stock)} pz</div>
                  <div className="text-[10px] text-indigo-600 tabular-nums">{formatMXN(invTotales.valor)}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Ventas por sucursal */}
      {sucursalesYTD.length > 0 && (
        <BloqueSucursales sucursales={sucursalesYTD} matriz={sucursalesMensual} mesActual={mesActual} anioActual={anioActual} anioPrev={anioPrev}
          inventarioSucursales={inventarioSucursalTotales} />
      )}
    </div>
  );
}

function KPI({ label, badge, badgeTone, value, sub }) {
  const tones = {
    good: 'bg-emerald-50 text-emerald-700',
    warn: 'bg-amber-50 text-amber-700',
    bad: 'bg-rose-50 text-rose-700',
    neutral: 'bg-gray-100 text-gray-600',
  };
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex items-center justify-between text-[11px] text-gray-500 font-medium mb-2">
        <span>{label}</span>
        {badge && <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${tones[badgeTone] || tones.neutral}`}>{badge}</span>}
      </div>
      <div className="text-[24px] font-semibold text-gray-800 tabular-nums leading-tight">{value}</div>
      {sub && <div className="mt-2 text-[11px] text-gray-500 flex justify-between items-center gap-2">{sub}</div>}
    </div>
  );
}

// ── Bloque de sucursales ──
function BloqueSucursales({ sucursales, matriz, mesActual, anioActual, anioPrev, inventarioSucursales = [] }) {
  const [metrica, setMetrica] = useState('monto'); // 'monto' | 'piezas' | 'tx' | 'inventario'
  const [selKey, setSelKey] = useState(null);

  // Inventario indexado por sucursal
  const invBySuc = useMemo(() => {
    const m = new Map();
    for (const iv of inventarioSucursales) m.set(iv.sucursal, iv);
    return m;
  }, [inventarioSucursales]);

  // Combina venta + inventario y aplica meta (tipo, color, coords).
  // Incluye sucursales que están en ventas O en inventario aunque solo tengan una.
  const items = useMemo(() => {
    const keys = new Set([...sucursales.map((s) => s.name), ...inventarioSucursales.map((s) => s.sucursal)]);
    const arr = Array.from(keys).map((name) => {
      const s = sucursales.find((x) => x.name === name) || { name, monto: 0, piezas: 0, tx: 0, yoy: null };
      const inv = invBySuc.get(name) || { stock: 0, valor: 0 };
      const meta = metaSuc(name);
      return {
        key: name,
        label: meta.label,
        subtitle: meta.subtitle || null,
        tipo: meta.tipo,
        codigo: meta.codigo,
        icon: meta.icon || null,
        color: meta.color,
        mapX: meta.mapX,
        mapY: meta.mapY,
        monto: s.monto || 0,
        piezas: s.piezas || 0,
        tx: s.tx || 0,
        yoy: s.yoy,
        prevMonto: s.prevMonto || 0,
        invStock: inv.stock || 0,
        invValor: inv.valor || 0,
      };
    });
    return arr;
  }, [sucursales, inventarioSucursales, invBySuc]);

  const valorMetrica = (it) => {
    if (metrica === 'monto') return it.monto;
    if (metrica === 'piezas') return it.piezas;
    if (metrica === 'tx') return it.tx;
    if (metrica === 'inventario') return it.invValor;
    return 0;
  };
  const fmtMetrica = (v) => {
    if (metrica === 'monto' || metrica === 'inventario') return formatMXN(v);
    return fmtInt(v);
  };

  const fisicas = useMemo(() => items.filter((x) => x.tipo === 'fisica').sort((a, b) => valorMetrica(b) - valorMetrica(a)), [items, metrica]);
  const virtuales = useMemo(() => items.filter((x) => x.tipo === 'virtual').sort((a, b) => valorMetrica(b) - valorMetrica(a)), [items, metrica]);
  const totalVis = items.reduce((s, x) => s + valorMetrica(x), 0);
  const totalFisicas = fisicas.reduce((s, x) => s + valorMetrica(x), 0);
  const totalVirtuales = virtuales.reduce((s, x) => s + valorMetrica(x), 0);
  const maxFisica = fisicas.length ? valorMetrica(fisicas[0]) : 1;
  const topSuc = items.reduce((a, b) => (valorMetrica(a) >= valorMetrica(b) ? a : b), items[0] || null);

  const seleccionada = selKey ? items.find((x) => x.key === selKey) : null;
  const serieSel = seleccionada ? matriz.get(seleccionada.key) : null;
  const maxSerie = serieSel ? Math.max(1, ...serieSel.slice(0, mesActual)) : 1;

  const totalPzFisicas = fisicas.reduce((s, x) => s + x.invStock, 0);
  const totalValFisicas = fisicas.reduce((s, x) => s + x.invValor, 0);

  const metricaLabel = { monto: 'Venta $', piezas: 'Piezas', tx: 'Tickets', inventario: 'Inventario $' }[metrica];

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      {/* Header + toggle */}
      <div className="flex justify-between items-start gap-4 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-800">Ventas por sucursal · YTD {anioActual}</h3>
          <div className="text-[11.5px] text-gray-500 mt-0.5">
            {fisicas.length} sucursales físicas + {virtuales.length} canales virtuales · Ene – {MESES[mesActual - 1]} {anioActual} · Total {fmtMetrica(totalVis)}
          </div>
        </div>
        <div className="inline-flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          {[
            { k: 'monto', l: 'Venta $' },
            { k: 'piezas', l: 'Piezas' },
            { k: 'tx', l: 'Tickets' },
            { k: 'inventario', l: 'Inventario $' },
          ].map((m) => (
            <button key={m.k} onClick={() => setMetrica(m.k)}
              className={`px-2.5 py-1 text-[11.5px] rounded-md font-medium transition ${metrica === m.k ? 'bg-white text-gray-800 shadow-sm font-semibold' : 'text-gray-500 hover:text-gray-700'}`}>
              {m.l}
            </button>
          ))}
        </div>
      </div>

      {/* Main grid: Map + Ranking */}
      <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-5">
        {/* Mapa */}
        <div className="relative bg-slate-50 border border-slate-200 rounded-xl p-3" style={{ minHeight: 380 }}>
          <div className="absolute top-2 left-3 text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">
            Sucursales físicas · burbuja proporcional a {metricaLabel}
          </div>
          <MapaSucursales fisicas={fisicas} valorMetrica={valorMetrica} fmtMetrica={fmtMetrica}
            maxFisica={maxFisica} selKey={selKey} setSelKey={setSelKey} metricaLabel={metricaLabel} />
          <div className="absolute bottom-2 right-3 bg-white border border-gray-200 rounded-md px-2 py-1 text-[10px] text-gray-500 flex items-center gap-2">
            <span>Tamaño ~ {metricaLabel}</span>
            <span className="inline-flex items-end gap-1">
              <span className="inline-block rounded-full bg-sky-500 opacity-70" style={{ width: 4, height: 4 }} />
              <span className="inline-block rounded-full bg-sky-500 opacity-70" style={{ width: 8, height: 8 }} />
              <span className="inline-block rounded-full bg-sky-500 opacity-70" style={{ width: 12, height: 12 }} />
              <span className="inline-block rounded-full bg-sky-500 opacity-70" style={{ width: 18, height: 18 }} />
            </span>
          </div>
        </div>

        {/* Panel ranking */}
        <div className="flex flex-col gap-2 min-w-0">
          <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold flex justify-between items-baseline">
            <span>Sucursales físicas</span>
            <span className="text-gray-400 text-[10.5px] font-medium normal-case tracking-normal">{fisicas.length} · {formatMXN(totalFisicas > 0 && (metrica === 'monto' || metrica === 'inventario') ? totalFisicas : totalFisicas)}</span>
          </div>
          {fisicas.map((s) => (
            <RankRow key={s.key} it={s} metrica={metrica} valorMetrica={valorMetrica} fmtMetrica={fmtMetrica}
              max={maxFisica} selected={selKey === s.key} onClick={() => setSelKey(selKey === s.key ? null : s.key)} />
          ))}

          {virtuales.length > 0 && (
            <>
              <div className="h-px bg-gray-200 my-1" />
              <div className="text-[10px] uppercase tracking-widest text-gray-500 font-bold flex justify-between items-baseline">
                <span>Canales virtuales</span>
                <span className="text-gray-400 text-[10.5px] font-medium normal-case tracking-normal">{virtuales.length} · sin ubicación física</span>
              </div>
              {virtuales.map((s) => (
                <RankRow key={s.key} it={s} metrica={metrica} valorMetrica={valorMetrica} fmtMetrica={fmtMetrica}
                  max={maxFisica} selected={selKey === s.key} onClick={() => setSelKey(selKey === s.key ? null : s.key)} />
              ))}
            </>
          )}
        </div>
      </div>

      {/* Detalle sucursal seleccionada */}
      {seleccionada && (
        <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-xl">
          <div className="flex justify-between items-baseline mb-3">
            <h4 className="text-[13px] font-bold text-sky-900">
              {seleccionada.label}
              {seleccionada.subtitle && <span className="text-[11px] font-medium text-sky-700 ml-2">· {seleccionada.subtitle}</span>}
              <span className="text-[10.5px] font-medium text-sky-600 ml-3 uppercase tracking-wider">{seleccionada.tipo}</span>
            </h4>
            <button onClick={() => setSelKey(null)} className="text-[11px] text-sky-700 hover:underline">Cerrar</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
            <div className="bg-white border border-sky-200 rounded-md p-2.5">
              <div className="text-[9.5px] uppercase tracking-widest text-sky-600 font-bold">Venta YTD</div>
              <div className="text-[15px] font-bold tabular-nums">{formatMXN(seleccionada.monto)}</div>
              <div className="text-[10px] text-gray-500">
                {totalVis > 0 ? `${(seleccionada.monto / (sucursales.reduce((s, x) => s + x.monto, 0)) * 100).toFixed(1)}% del total` : '—'}
              </div>
            </div>
            <div className="bg-white border border-sky-200 rounded-md p-2.5">
              <div className="text-[9.5px] uppercase tracking-widest text-sky-600 font-bold">Piezas · Tickets</div>
              <div className="text-[15px] font-bold tabular-nums">{fmtInt(seleccionada.piezas)}</div>
              <div className="text-[10px] text-gray-500 tabular-nums">
                {fmtInt(seleccionada.tx)} tx · ticket prom {seleccionada.tx > 0 ? formatMXN(seleccionada.monto / seleccionada.tx) : '—'}
              </div>
            </div>
            <div className="bg-white border border-sky-200 rounded-md p-2.5">
              <div className="text-[9.5px] uppercase tracking-widest text-sky-600 font-bold">Inventario actual</div>
              <div className="text-[15px] font-bold tabular-nums">{fmtInt(seleccionada.invStock)} pz</div>
              <div className="text-[10px] text-gray-500 tabular-nums">
                {formatMXN(seleccionada.invValor)}
                {seleccionada.monto > 0 && seleccionada.invValor > 0 && mesActual > 0 && (
                  <span> · rota ~{(seleccionada.monto / mesActual / seleccionada.invValor).toFixed(1)}x/mes</span>
                )}
              </div>
            </div>
            <div className="bg-white border border-sky-200 rounded-md p-2.5">
              <div className="text-[9.5px] uppercase tracking-widest text-sky-600 font-bold">YoY vs {anioPrev}</div>
              <div className={`text-[15px] font-bold tabular-nums ${seleccionada.yoy == null ? 'text-gray-400' : seleccionada.yoy >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                {seleccionada.yoy != null ? `${seleccionada.yoy >= 0 ? '+' : ''}${seleccionada.yoy.toFixed(0)}%` : (seleccionada.prevMonto === 0 && seleccionada.monto > 0 ? 'nueva' : '—')}
              </div>
              <div className="text-[10px] text-gray-500 tabular-nums">
                {seleccionada.prevMonto > 0 ? `vs ${formatMXN(seleccionada.prevMonto)}` : (seleccionada.monto > 0 ? 'primer año' : '—')}
              </div>
            </div>
          </div>

          {/* Sparkline mensual */}
          {serieSel && (
            <div className="bg-white border border-sky-200 rounded-md p-3">
              <div className="text-[9.5px] uppercase tracking-widest text-sky-600 font-bold mb-1">Evolución mensual · venta $</div>
              <svg viewBox="0 0 500 90" preserveAspectRatio="none" style={{ width: '100%', height: 90 }}>
                <line x1="0" y1="72" x2="500" y2="72" stroke="#E5E7EB" strokeDasharray="2 3"/>
                {serieSel.slice(0, mesActual).length > 1 && (
                  <polyline
                    points={serieSel.slice(0, mesActual).map((v, i) => `${20 + i * (460 / Math.max(1, mesActual - 1))},${72 - (v / maxSerie * 60)}`).join(' ')}
                    stroke={seleccionada.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                )}
                {serieSel.slice(0, mesActual).map((v, i) => (
                  <circle key={i} cx={20 + i * (460 / Math.max(1, mesActual - 1))} cy={72 - (v / maxSerie * 60)}
                    r={i === mesActual - 1 ? 4 : 3.2}
                    fill={i === mesActual - 1 ? 'white' : seleccionada.color}
                    stroke={seleccionada.color} strokeWidth={i === mesActual - 1 ? 2 : 0} />
                ))}
                {MESES.slice(0, mesActual).map((m, i) => (
                  <text key={i} x={20 + i * (460 / Math.max(1, mesActual - 1))} y="86"
                    fontSize="9" fill="#6B7280" textAnchor="middle">{m}</text>
                ))}
              </svg>
            </div>
          )}
        </div>
      )}

      {/* Footer 4 KPIs */}
      <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-50 rounded-md p-3">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-bold">Venta física YTD</div>
          <div className="text-[16px] font-bold tabular-nums">{formatMXN(fisicas.reduce((s, x) => s + x.monto, 0))}</div>
          <div className="text-[10.5px] text-gray-500">
            {(fisicas.reduce((s, x) => s + x.monto, 0) / (sucursales.reduce((s, x) => s + x.monto, 0) || 1) * 100).toFixed(0)}% del total
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-bold">Venta virtual YTD</div>
          <div className="text-[16px] font-bold tabular-nums">{formatMXN(virtuales.reduce((s, x) => s + x.monto, 0))}</div>
          <div className="text-[10.5px] text-gray-500">
            {(virtuales.reduce((s, x) => s + x.monto, 0) / (sucursales.reduce((s, x) => s + x.monto, 0) || 1) * 100).toFixed(0)}% · dropship + retail
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-bold">Sucursal top</div>
          <div className="text-[14px] font-bold">{topSuc?.label || '—'}</div>
          <div className="text-[10.5px] text-gray-500">
            {topSuc ? `${((topSuc.monto / (sucursales.reduce((s, x) => s + x.monto, 0) || 1)) * 100).toFixed(1)}% del total` : ''}
            {topSuc?.yoy != null && ` · ${topSuc.yoy >= 0 ? '+' : ''}${topSuc.yoy.toFixed(0)}% YoY`}
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-3">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-bold">Inventario total físico</div>
          <div className="text-[16px] font-bold tabular-nums">{fmtInt(totalPzFisicas)} pz</div>
          <div className="text-[10.5px] text-gray-500 tabular-nums">
            {formatMXN(totalValFisicas)} · {fisicas.filter((x) => x.invStock > 0).length} sucursales
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Mapa SVG de México con burbujas por sucursal ─────────────────────────
function MapaSucursales({ fisicas, valorMetrica, fmtMetrica, maxFisica, selKey, setSelKey, metricaLabel }) {
  return (
    <svg viewBox="0 0 640 420" preserveAspectRatio="xMidYMid meet"
      style={{ width: '100%', height: '100%', minHeight: 340, maxHeight: 380, display: 'block' }}>
      {/* Contorno México simplificado */}
      <path d="M 60 190 L 55 165 L 68 150 L 90 152 L 100 140 L 105 145 L 118 152 L 130 145 L 145 150 L 150 158 L 155 172 L 162 175 L 168 165 L 175 158 L 185 155 L 195 158 L 202 165 L 210 160 L 218 165 L 222 170 L 220 175 L 225 180 L 232 175 L 240 172 L 248 165 L 254 168 L 258 162 L 265 158 L 272 152 L 280 148 L 288 145 L 295 148 L 300 155 L 302 165 L 308 170 L 316 178 L 320 182 L 325 176 L 330 172 L 340 168 L 348 165 L 356 168 L 362 174 L 368 178 L 374 175 L 380 170 L 385 165 L 390 158 L 395 154 L 402 152 L 410 150 L 418 145 L 425 145 L 432 142 L 440 138 L 448 135 L 456 132 L 464 128 L 470 128 L 478 128 L 486 132 L 494 138 L 500 145 L 504 152 L 506 160 L 505 168 L 500 175 L 496 182 L 500 190 L 508 200 L 512 210 L 520 220 L 528 230 L 538 240 L 545 250 L 548 260 L 550 268 L 552 278 L 550 285 L 548 292 L 545 295 L 540 292 L 535 288 L 528 285 L 522 282 L 515 278 L 510 275 L 502 270 L 494 268 L 486 268 L 478 272 L 470 278 L 462 285 L 458 290 L 452 298 L 445 305 L 438 308 L 432 312 L 425 315 L 418 320 L 412 325 L 405 328 L 398 332 L 390 335 L 385 340 L 378 342 L 370 345 L 362 348 L 355 350 L 348 350 L 342 350 L 338 355 L 335 362 L 330 368 L 325 372 L 320 375 L 314 378 L 308 382 L 300 385 L 292 388 L 285 392 L 280 388 L 275 385 L 268 380 L 262 378 L 255 375 L 248 372 L 240 368 L 232 362 L 228 358 L 222 350 L 216 342 L 210 335 L 205 328 L 202 322 L 198 316 L 195 310 L 190 305 L 186 298 L 182 292 L 178 285 L 175 278 L 172 272 L 168 265 L 164 258 L 160 252 L 155 245 L 148 240 L 140 235 L 132 232 L 125 230 L 120 225 L 118 218 L 115 210 L 110 202 L 105 195 L 98 190 L 92 188 L 86 192 L 78 195 L 72 198 L 66 196 L 62 192 Z"
        fill="#E7EDF2" stroke="#CBD5E1" strokeWidth="0.6" />
      <path d="M 30 148 L 42 145 L 48 158 L 52 175 L 55 190 L 52 205 L 50 215 L 45 218 L 42 210 L 40 200 L 36 190 L 32 180 L 30 168 Z"
        fill="#E7EDF2" stroke="#CBD5E1" strokeWidth="0.6" />
      <path d="M 540 240 L 570 232 L 590 240 L 600 255 L 605 270 L 600 282 L 590 288 L 578 285 L 568 278 L 562 272 L 555 265 L 550 258 Z"
        fill="#E7EDF2" stroke="#CBD5E1" strokeWidth="0.6" />

      {/* Etiquetas estados */}
      <g fill="#94A3B8" fontWeight="500" fontFamily="inherit">
        <text x="80" y="185" fontSize="8">B.C.</text>
        <text x="220" y="252" fontSize="9" fill="#64748B" fontWeight="600">JAL</text>
        <text x="270" y="252" fontSize="9" fill="#64748B" fontWeight="600">AGS</text>
        <text x="300" y="200" fontSize="9" fill="#64748B" fontWeight="600">ZAC</text>
        <text x="325" y="248" fontSize="9" fill="#64748B" fontWeight="600">GTO</text>
        <text x="350" y="285" fontSize="8" fill="#64748B" fontWeight="600">CDMX</text>
      </g>

      {/* Burbujas */}
      {fisicas.filter((s) => s.mapX != null).map((s) => {
        const val = valorMetrica(s);
        const r = maxFisica > 0 ? Math.max(4, Math.sqrt(val / maxFisica) * 28) : 4;
        const isSel = selKey === s.key;
        return (
          <g key={s.key} onClick={() => setSelKey(isSel ? null : s.key)} style={{ cursor: 'pointer' }}>
            <text x={s.mapX} y={s.mapY - r - 3} textAnchor="middle" fontSize="8.5" fill="#374151" fontWeight="600" fontFamily="inherit">
              {s.label}
            </text>
            <circle cx={s.mapX} cy={s.mapY} r={r} fill={s.color} opacity={isSel ? 0.95 : 0.72}
              stroke={isSel ? s.color : 'transparent'} strokeWidth={isSel ? 3 : 0} />
            {r >= 12 && (
              <text x={s.mapX} y={s.mapY + 3} textAnchor="middle" fontSize={Math.min(9, r * 0.4)} fill="white" fontWeight="700" fontFamily="inherit">
                {fmtMetrica(val).replace('$', '')}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}

// ── Row del ranking ────────────────────────────────────────────────────────
function RankRow({ it, metrica, valorMetrica, fmtMetrica, max, selected, onClick }) {
  const yoyClass = it.yoy == null ? 'bg-gray-100 text-gray-500' : it.yoy >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800';
  const val = valorMetrica(it);
  const pct = max > 0 ? (val / max * 100) : 0;
  return (
    <button onClick={onClick}
      className={`text-left rounded-lg border p-2.5 transition ${selected ? 'bg-sky-50 border-sky-300' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}>
      <div className="grid grid-cols-[auto_1fr_auto] gap-2 items-baseline">
        <span className="w-[22px] h-[22px] rounded flex items-center justify-center text-white text-[10px] font-bold tracking-wide"
          style={{ background: it.color, color: it.icon ? undefined : 'white' }}>
          {it.icon || it.codigo}
        </span>
        <span className="font-semibold text-[12px] text-gray-800 truncate">
          {it.label}
          {it.subtitle && <span className="ml-1.5 text-[10px] font-medium text-gray-500">· {it.subtitle}</span>}
        </span>
        <span className="text-[12.5px] font-bold tabular-nums text-gray-900">{fmtMetrica(val)}</span>
      </div>
      <div className="mt-1.5 h-[3px] bg-gray-200 rounded-full overflow-hidden">
        <span className="block h-full rounded-full" style={{ width: `${Math.min(100, pct).toFixed(1)}%`, background: it.color }} />
      </div>
      <div className="mt-1.5 flex justify-between items-baseline text-[10.5px] text-gray-500">
        <span className="tabular-nums">{fmtInt(it.piezas)} pz · {fmtInt(it.tx)} tx</span>
        {it.yoy != null && (
          <span className={`px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold ${yoyClass}`}>
            {it.yoy >= 0 ? '+' : ''}{it.yoy.toFixed(0)}% YoY
          </span>
        )}
        {it.yoy == null && it.prevMonto === 0 && it.monto > 0 && (
          <span className="px-1.5 py-0.5 rounded-full text-[9.5px] font-semibold bg-gray-100 text-gray-500">nueva</span>
        )}
      </div>
      {it.invStock > 0 && (
        <div className="mt-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 bg-indigo-50 text-indigo-800 rounded text-[10px] font-semibold tabular-nums">
          📦 Inv: {fmtInt(it.invStock)} pz · {formatMXN(it.invValor)}
        </div>
      )}
    </button>
  );
}

// ── Drill-down por SKU: clientes finales / vendedores / precio ─────────────
class SkuDrillDownBoundary extends React.Component {
  constructor(props) { super(props); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) { console.error('[SkuDrillDown]', err, info); }
  componentDidUpdate(prev) { if (prev.sku !== this.props.sku && this.state.err) this.setState({ err: null }); }
  render() {
    if (this.state.err) {
      return <div className="p-4 text-xs text-rose-700 bg-rose-50 border-l-4 border-rose-500">
        Error cargando detalle · {String(this.state.err.message || this.state.err)}
      </div>;
    }
    return this.props.children;
  }
}

function SkuDrillDown({ sku, skuInfo, meta, anioActual, anioPrev, mesActual, sellInAcumulado, inventarioSucursales = [] }) {
  const [cargando, setCargando] = useState(true);
  const [rows, setRows] = useState([]);
  const [precioLista, setPrecioLista] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    (async () => {
      try {
        const [txRes, precioRes] = await Promise.all([
          supabase.from('sellout_general')
            .select('anio,mes,cliente_nombre,vendedor_nombre,sucursal,cantidad,precio_unitario,importe')
            .eq('mayorista', meta.mayoristaKey).eq('sku', sku)
            .in('anio', [anioPrev, anioActual]),
          supabase.from('precios_sku')
            .select('precio').eq('sku', sku).eq('lista', meta.listaPrecio)
            .eq('anio', anioActual).eq('mes', mesActual).maybeSingle(),
        ]);
        if (cancelled) return;
        setRows(txRes.data || []);
        setPrecioLista(precioRes.data?.precio ? Number(precioRes.data.precio) : null);
        setCargando(false);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setCargando(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sku, meta.mayoristaKey, meta.listaPrecio, anioActual, anioPrev, mesActual]);

  const { topClientes, topVendedores, topSucursales, precioReal, piezasYTD, montoYTD, clientesTotal, vendedoresTotal, sucursalesTotal } = useMemo(() => {
    const cli = new Map(); const ven = new Map(); const suc = new Map();
    let pzYTD = 0, montoYTDacc = 0, precioAcum = 0, precioN = 0;
    const cliPrev = new Map(); const sucPrev = new Map();
    for (const r of rows) {
      const y = r.anio; const cnt = Number(r.cantidad) || 0; const imp = Number(r.importe) || 0;
      const cn = r.cliente_nombre || '(sin nombre)';
      const vn = r.vendedor_nombre || '(sin nombre)';
      const sn = r.sucursal || '(sin sucursal)';
      if (y === anioActual) {
        pzYTD += cnt; montoYTDacc += imp;
        if (Number(r.precio_unitario) > 0) { precioAcum += Number(r.precio_unitario) * cnt; precioN += cnt; }
        if (!cli.has(cn)) cli.set(cn, { name: cn, pz: 0, monto: 0 });
        cli.get(cn).pz += cnt; cli.get(cn).monto += imp;
        if (!ven.has(vn)) ven.set(vn, { name: vn, pz: 0, monto: 0 });
        ven.get(vn).pz += cnt; ven.get(vn).monto += imp;
        if (!suc.has(sn)) suc.set(sn, { name: sn, pz: 0, monto: 0 });
        suc.get(sn).pz += cnt; suc.get(sn).monto += imp;
      } else if (y === anioPrev) {
        if (!cliPrev.has(cn)) cliPrev.set(cn, 0);
        cliPrev.set(cn, cliPrev.get(cn) + imp);
        if (!sucPrev.has(sn)) sucPrev.set(sn, 0);
        sucPrev.set(sn, sucPrev.get(sn) + imp);
      }
    }
    const totCli = Array.from(cli.values()).reduce((s, x) => s + x.monto, 0);
    const totVen = Array.from(ven.values()).reduce((s, x) => s + x.monto, 0);
    const totSuc = Array.from(suc.values()).reduce((s, x) => s + x.monto, 0);
    const topC = Array.from(cli.values()).sort((a, b) => b.monto - a.monto).map((v) => ({
      ...v, pct: totCli > 0 ? (v.monto / totCli * 100) : 0,
      prev: cliPrev.get(v.name) || 0,
      yoy: cliPrev.get(v.name) > 0 ? ((v.monto - cliPrev.get(v.name)) / cliPrev.get(v.name) * 100) : null,
    }));
    const topV = Array.from(ven.values()).sort((a, b) => b.monto - a.monto).map((v) => ({
      ...v, pct: totVen > 0 ? (v.monto / totVen * 100) : 0,
    }));
    const topS = Array.from(suc.values()).sort((a, b) => b.monto - a.monto).map((v) => ({
      ...v, label: SUCURSAL_LABEL[v.name] || v.name,
      pct: totSuc > 0 ? (v.monto / totSuc * 100) : 0,
      yoy: sucPrev.get(v.name) > 0 ? ((v.monto - sucPrev.get(v.name)) / sucPrev.get(v.name) * 100) : null,
    }));
    const pr = precioN > 0 ? precioAcum / precioN : null;
    return {
      topClientes: topC, topVendedores: topV, topSucursales: topS,
      precioReal: pr, piezasYTD: pzYTD, montoYTD: montoYTDacc,
      clientesTotal: cli.size, vendedoresTotal: ven.size, sucursalesTotal: suc.size,
    };
  }, [rows, anioActual, anioPrev]);

  const siPzYTD = useMemo(() => {
    let s = 0;
    for (const r of sellInAcumulado) if (r.anio === anioActual && r.sku === sku && r.mes <= mesActual) s += Number(r.piezas) || 0;
    return s;
  }, [sellInAcumulado, sku, anioActual, mesActual]);

  const yieldPct = precioLista && precioReal ? (precioReal / precioLista * 100) : null;
  const ratioConv = siPzYTD > 0 ? (piezasYTD / siPzYTD * 100) : null;

  if (cargando) return <div className="p-6 text-center text-xs text-gray-500">Cargando detalle del SKU…</div>;

  const showRow = (v, palette) => {
    const yoyClass = v.yoy == null ? 'text-emerald-700' : v.yoy >= 0 ? 'text-emerald-700' : 'text-rose-700';
    return (
      <div key={v.name} className="pb-1.5 border-b border-dashed border-[#E5EAF0] last:border-b-0 last:pb-0">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[11.5px] font-medium text-gray-800 truncate flex-1">{v.name}</span>
          <span className="text-[11px] text-gray-500 font-medium tabular-nums">{v.pct.toFixed(1)}%</span>
        </div>
        <div className="h-[3px] bg-[#E4EAF2] rounded-full overflow-hidden mt-1">
          <span className="block h-full rounded-full" style={{ width: `${Math.min(100, v.pct)}%`, background: palette }} />
        </div>
        <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
          <span>{fmtInt(v.pz)} pz · {formatMXN(v.monto)}</span>
          {v.yoy != null && <span className={`font-semibold ${yoyClass}`}>{v.yoy >= 0 ? '+' : ''}{v.yoy.toFixed(0)}% YoY</span>}
          {v.yoy == null && v.prev != null && v.prev === 0 && v.monto > 0 && <span className="text-emerald-700 font-semibold">nuevo</span>}
        </div>
      </div>
    );
  };

  return (
    <div className="p-5">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-gray-500 mb-3">
        Detalle · <span className="text-gray-800 font-bold">{sku}</span> · {skuInfo?.descripcion || ''} · Sell-out YTD {anioActual}: <span className="text-gray-800 font-bold tabular-nums">{fmtInt(piezasYTD)} pz / {formatMXN(montoYTD)}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Col 1 Clientes finales */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">Clientes finales · YTD {anioActual}</span>
            <span className="text-[10.5px] text-gray-400">Top 6 de {clientesTotal}</span>
          </div>
          <div className="flex flex-col gap-2">
            {topClientes.slice(0, 6).map((v) => showRow(v, meta.accent))}
          </div>
        </div>

        {/* Col 2 Vendedores */}
        <div className="lg:border-l lg:border-r border-gray-200 lg:px-5">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">Vendedores · YTD {anioActual}</span>
            <span className="text-[10.5px] text-gray-400">Top 5 de {vendedoresTotal}</span>
          </div>
          <div className="flex flex-col gap-2">
            {topVendedores.slice(0, 5).map((v) => showRow(v, '#6366F1'))}
          </div>
          {topVendedores.length >= 3 && (
            <div className="mt-3 pt-2.5 border-t border-gray-200 grid grid-cols-2 gap-2">
              <div className="bg-gray-50 rounded-md p-2.5">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold">Top 3 vendedores</div>
                <div className="text-[15px] font-semibold tabular-nums">{topVendedores.slice(0, 3).reduce((s, v) => s + v.pct, 0).toFixed(1)}%</div>
              </div>
              <div className="bg-gray-50 rounded-md p-2.5">
                <div className="text-[9px] uppercase tracking-widest text-gray-500 font-semibold">Vendedor principal</div>
                <div className="text-[15px] font-semibold text-gray-800 tabular-nums truncate">{topVendedores[0]?.name?.split(' ').slice(0, 2).join(' ')}</div>
              </div>
            </div>
          )}
        </div>

        {/* Col 3 Sucursales */}
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">Sucursales · YTD {anioActual}</span>
            <span className="text-[10.5px] text-gray-400">Top 6 de {sucursalesTotal}</span>
          </div>
          <div className="flex flex-col gap-2">
            {topSucursales.slice(0, 6).map((v, i) => {
              const yoyClass = v.yoy == null ? 'text-emerald-700' : v.yoy >= 0 ? 'text-emerald-700' : 'text-rose-700';
              const color = SUCURSAL_COLOR[i % SUCURSAL_COLOR.length];
              return (
                <div key={v.name} className="pb-1.5 border-b border-dashed border-[#E5EAF0] last:border-b-0 last:pb-0">
                  <div className="flex items-baseline gap-1.5">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: color }} />
                    <span className="text-[11.5px] font-medium text-gray-800 truncate flex-1">{v.label}</span>
                    <span className="text-[11px] text-gray-500 font-medium tabular-nums">{v.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-[3px] bg-[#E4EAF2] rounded-full overflow-hidden mt-1">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, v.pct)}%`, background: color }} />
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1 tabular-nums">
                    <span>{fmtInt(v.pz)} pz · {formatMXN(v.monto)}</span>
                    {v.yoy != null && <span className={`font-semibold ${yoyClass}`}>{v.yoy >= 0 ? '+' : ''}{v.yoy.toFixed(0)}% YoY</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fila inferior: precio real vs lista */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 border-t border-gray-200 pt-4 mt-4">
        <div className="bg-gray-50 rounded-md p-2.5">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Precio prom. real</div>
          <div className="text-[15px] font-semibold tabular-nums">{precioReal ? formatMXN(precioReal) : '—'}</div>
          {precioLista && <div className="text-[10px] text-gray-500">vs {formatMXN(precioLista)} lista {meta.listaPrecio}</div>}
        </div>
        <div className="bg-gray-50 rounded-md p-2.5">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Yield real</div>
          <div className={`text-[15px] font-semibold tabular-nums ${yieldPct == null ? 'text-gray-400' : yieldPct >= 95 ? 'text-emerald-700' : yieldPct >= 85 ? 'text-amber-700' : 'text-rose-700'}`}>
            {yieldPct != null ? `${yieldPct.toFixed(1)}%` : '—'}
          </div>
          <div className="text-[10px] text-gray-500">Descuento efectivo</div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Sell in Acteck→{meta.nombre}</div>
          <div className="text-[15px] font-semibold tabular-nums">{fmtInt(siPzYTD)} pz</div>
          <div className="text-[10px] text-gray-500">YTD {anioActual}</div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Ratio conversión</div>
          <div className={`text-[15px] font-semibold tabular-nums ${ratioConv == null ? 'text-gray-400' : ratioConv >= 90 ? 'text-emerald-700' : ratioConv >= 70 ? 'text-amber-700' : 'text-rose-700'}`}>
            {ratioConv != null ? `${ratioConv.toFixed(0)}%` : '—'}
          </div>
          <div className="text-[10px] text-gray-500">
            {siPzYTD - piezasYTD > 0 ? `${fmtInt(siPzYTD - piezasYTD)} pz posible almacén` : 'Vendiendo stock previo'}
          </div>
        </div>
      </div>

      {/* Inventario por sucursal (último snapshot) */}
      {inventarioSucursales.length > 0 && (
        <div className="border-t border-gray-200 pt-4 mt-4">
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">
              Inventario por sucursal · snapshot semana {inventarioSucursales[0]?.semana} {inventarioSucursales[0]?.anio}
            </span>
            <span className="text-[10.5px] text-gray-500 tabular-nums">
              Total: {fmtInt(inventarioSucursales.reduce((s, x) => s + x.stock, 0))} pz · {formatMXN(inventarioSucursales.reduce((s, x) => s + x.valor, 0))}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
            {inventarioSucursales.map((s, i) => {
              const label = SUCURSAL_LABEL[s.sucursal] || s.sucursal;
              const color = SUCURSAL_COLOR[i % SUCURSAL_COLOR.length];
              return (
                <div key={s.sucursal} className="rounded-md p-2.5 border" style={{ borderColor: color + '40', background: color + '10' }}>
                  <div className="text-[9px] uppercase tracking-widest font-semibold truncate" style={{ color }}>{label}</div>
                  <div className="text-[15px] font-semibold tabular-nums text-gray-800 mt-0.5">{fmtInt(s.stock)} pz</div>
                  <div className="text-[10px] tabular-nums text-gray-500">{formatMXN(s.valor)}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
