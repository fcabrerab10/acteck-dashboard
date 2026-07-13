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
    vistaMarcaMes: null,
    mayoristaKey: 'DICOTECH',
    sellInClienteKey: 'dicotech',
    listaPrecio: 'DICOTECH',
    tablaSellOut: 'sellout_general',
    drillClientesFinales: true,
    drillVendedores: true,
    drillSucursales: true,
    drillMarca: false,
  },
  digitalife: {
    nombre: 'Digitalife',
    marca: 'Acteck / Balam Rush',
    accent: '#8B5CF6',
    vistaMensual: 'v_sellout_digitalife_mensual',
    vistaSkuMes: 'v_sellout_digitalife_sku_mes',
    vistaSucursalMes: null,
    vistaMarcaMes: 'v_sellout_digitalife_marca_mes',
    mayoristaKey: null,
    sellInClienteKey: 'digitalife',
    listaPrecio: 'DIGITALIFE',
    tablaSellOut: 'sellout_detalle',
    drillClientesFinales: false,
    drillVendedores: false,
    drillSucursales: false,
    drillMarca: true,
  },
};

// Meta de sucursales Dicotech: label bonito, tipo (fisica/virtual), color, código,
// y coordenadas para posicionar burbuja en el mapa SVG (viewBox 0 0 640 420).
const SUCURSAL_META = {
  'dicoags2':  { label: 'Aguascalientes', tipo: 'fisica', codigo: 'AG', color: '#0EA5E9' },
  'leon2':     { label: 'León',           tipo: 'fisica', codigo: 'LE', color: '#6366F1' },
  'Arboledas': { label: 'Arboledas',      tipo: 'fisica', codigo: 'AR', color: '#10B981', subtitle: 'Naucalpan' },
  'GDL':       { label: 'Guadalajara',    tipo: 'fisica', codigo: 'GL', color: '#F59E0B' },
  'ZACATECAS': { label: 'Zacatecas',      tipo: 'fisica', codigo: 'ZA', color: '#EC4899' },
  'santafe':   { label: 'Santa Fe',       tipo: 'fisica', codigo: 'SF', color: '#8B5CF6', subtitle: 'CDMX' },
  'DC':        { label: 'DC',             tipo: 'fisica', codigo: 'DC', color: '#F97316' },
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
  const [marcaMes, setMarcaMes] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [marcaSel, setMarcaSel] = useState(new Set());
  const [roadmapSel, setRoadmapSel] = useState(new Set());
  const [familiaSel, setFamiliaSel] = useState(new Set());
  const [orden, setOrden] = useState({ col: null, dir: null });
  const [skuAbierto, setSkuAbierto] = useState(null);

  useEffect(() => {
    setLoading(true);
    (async () => {
      const [mes, skuMes, rdmp, fact, inv, sucMes, invSuc, mrcMes] = await Promise.all([
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
        meta.vistaMarcaMes
          ? fetchAll(meta.vistaMarcaMes, 'marca,anio,mes,piezas,monto,tx,skus_distintos',
              (q) => q.in('anio', [anioPrev, anioActual]))
          : Promise.resolve([]),
      ]);
      setMensualDico(mes);
      setSkuMesRaw(skuMes);
      setRoadmap(rdmp);
      setFacturacion(fact);
      setInventarioCliente(inv);
      setSucursalMes(sucMes);
      setInventarioSucursal(invSuc);
      setMarcaMes(mrcMes);
      setLoading(false);
    })();
  }, [anioActual, anioPrev, meta.vistaMensual, meta.vistaSkuMes, meta.vistaMarcaMes, meta.sellInClienteKey]);

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

  // ── Marca YTD y matriz mensual (para clientes con mezcla de marcas: Digitalife) ──
  const marcaYTD = useMemo(() => {
    if (!meta.drillMarca) return [];
    const map = new Map(); const mapPrev = new Map();
    for (const r of marcaMes) {
      const key = r.marca || '(sin marca)';
      const tgt = r.anio === anioActual ? map : (r.anio === anioPrev ? mapPrev : null);
      if (!tgt) continue;
      if (tgt === map && r.mes > mesActual) continue;
      if (tgt === mapPrev && r.mes > mesActual) continue;
      const acc = tgt.get(key) || { name: key, monto: 0, piezas: 0, tx: 0, skus: 0 };
      acc.monto += Number(r.monto) || 0;
      acc.piezas += Number(r.piezas) || 0;
      acc.tx += Number(r.tx) || 0;
      acc.skus = Math.max(acc.skus, Number(r.skus_distintos) || 0);
      tgt.set(key, acc);
    }
    const out = [];
    for (const [k, v] of map) {
      const prev = mapPrev.get(k);
      out.push({
        ...v,
        prevMonto: prev?.monto || 0,
        yoy: prev && prev.monto > 0 ? ((v.monto - prev.monto) / prev.monto * 100) : null,
      });
    }
    return out.sort((a, b) => b.monto - a.monto);
  }, [marcaMes, anioActual, anioPrev, mesActual, meta.drillMarca]);

  const marcaMensual = useMemo(() => {
    const map = new Map();
    for (const r of marcaMes) {
      if (r.anio !== anioActual) continue;
      const key = r.marca || '(sin marca)';
      if (!map.has(key)) map.set(key, Array(12).fill(0));
      map.get(key)[r.mes - 1] = Number(r.monto) || 0;
    }
    return map;
  }, [marcaMes, anioActual]);

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
            {meta.tablaSellOut === 'sellout_general'
              ? `Ventas de ${meta.nombre} a sus clientes finales · Fuente Sellout General`
              : `Ventas de ${meta.nombre} desde su tienda física y online · Fuente Histórico Sellout ${meta.nombre}`}
            {invSemanaMax.semana ? ` · Inventario snapshot semana ${invSemanaMax.semana} ${invSemanaMax.anio}` : ''}
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

      {/* Ventas por sucursal — sólo si el cliente tiene datos de sucursal */}
      {meta.drillSucursales && sucursalesYTD.length > 0 && (
        <BloqueSucursales sucursales={sucursalesYTD} matriz={sucursalesMensual} mesActual={mesActual} anioActual={anioActual} anioPrev={anioPrev}
          inventarioSucursales={inventarioSucursalTotales} meta={meta} />
      )}

      {/* Breakdown por marca — sólo si el cliente tiene mezcla de marcas (Digitalife) */}
      {meta.drillMarca && marcaYTD.length > 0 && (
        <BloqueMarca marcas={marcaYTD} matriz={marcaMensual} mesActual={mesActual} anioActual={anioActual} anioPrev={anioPrev} meta={meta} />
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
// ── Bloque de marcas: dos tarjetas grandes (Acteck / Balam Rush) con % share,
//    YoY y sparkline. Se usa en clientes que venden mezcla de marcas (Digitalife).
function BloqueMarca({ marcas, matriz, mesActual, anioActual, anioPrev, meta }) {
  const MARCA_COLOR = {
    'ACTECK': '#0EA5E9',
    'BALAM RUSH': '#DC2626',
  };
  const MARCA_ACCENT = (m) => MARCA_COLOR[m] || meta.accent || '#6366F1';

  const totalMonto = marcas.reduce((s, m) => s + m.monto, 0);
  const totalPz    = marcas.reduce((s, m) => s + m.piezas, 0);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="mb-3">
        <h3 className="text-sm font-semibold text-gray-800">Composición por marca · YTD {anioActual}</h3>
        <div className="text-[11.5px] text-gray-500 mt-0.5">
          {marcas.length} marcas · Ene – {MESES[mesActual - 1]} {anioActual} · Total {formatMXN(totalMonto)}
        </div>
      </div>

      <div className={`grid gap-3 ${marcas.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'}`}>
        {marcas.map((m) => {
          const color = MARCA_ACCENT(m.name);
          const share = totalMonto > 0 ? (m.monto / totalMonto * 100) : 0;
          const shareP = totalPz > 0 ? (m.piezas / totalPz * 100) : 0;
          const serie = (matriz.get(m.name) || []).slice(0, mesActual);
          const maxSerie = Math.max(1, ...serie);
          return (
            <div key={m.name} className="rounded-xl p-4 border relative"
              style={{ background: `linear-gradient(135deg, ${color}18 0%, ${color}08 100%)`, borderColor: `${color}55` }}>
              <div className="flex justify-between items-baseline gap-2 mb-1">
                <div>
                  <div className="text-[16px] font-bold" style={{ color, filter: 'brightness(0.7)' }}>{m.name}</div>
                  <div className="text-[10.5px] text-gray-500">{fmtInt(m.skus)} SKUs distintos · {fmtInt(m.tx)} líneas de venta</div>
                </div>
                {m.yoy != null && (
                  <span className={`text-[10.5px] font-bold px-2 py-0.5 rounded-full ${m.yoy >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                    {m.yoy >= 0 ? '+' : ''}{m.yoy.toFixed(0)}% YoY
                  </span>
                )}
              </div>
              <div className="text-[28px] font-extrabold tabular-nums leading-none mt-2" style={{ color, filter: 'brightness(0.6)' }}>
                {formatMXN(m.monto)}
              </div>
              <div className="text-[11px] text-gray-600 mt-1 tabular-nums">
                {share.toFixed(1)}% del total · {fmtInt(m.piezas)} pz ({shareP.toFixed(1)}%)
              </div>

              {/* barra share */}
              <div className="mt-2 h-[6px] bg-white/60 rounded-full overflow-hidden">
                <span className="block h-full rounded-full" style={{ width: `${share.toFixed(1)}%`, background: color }} />
              </div>

              {/* sparkline mensual */}
              {serie.length > 1 && (
                <div className="bg-white/80 rounded-md p-2.5 mt-3 border border-white/50">
                  <div className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mb-1">Evolución mensual · venta $</div>
                  <svg viewBox="0 0 400 60" preserveAspectRatio="none" style={{ width: '100%', height: 60, display: 'block' }}>
                    <line x1="0" y1="48" x2="400" y2="48" stroke="#E5E7EB" strokeDasharray="2 3" />
                    <defs>
                      <linearGradient id={`mrc-grad-${m.name.replace(/\s/g,'')}`} x1="0" x2="0" y1="0" y2="1">
                        <stop offset="0%" stopColor={color} stopOpacity="0.28" />
                        <stop offset="100%" stopColor={color} stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    {(() => {
                      const pts = serie.map((v, i) => ({
                        x: 20 + i * (360 / Math.max(1, serie.length - 1)),
                        y: 48 - (v / maxSerie * 38),
                      }));
                      const areaPath = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length - 1].x} 48 L ${pts[0].x} 48 Z`;
                      return (
                        <>
                          <path d={areaPath} fill={`url(#mrc-grad-${m.name.replace(/\s/g,'')})`} />
                          <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                            stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                          {pts.map((p, i) => (
                            <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.5 : 2.8}
                              fill={i === pts.length - 1 ? 'white' : color}
                              stroke={color} strokeWidth={i === pts.length - 1 ? 2 : 0} />
                          ))}
                          {MESES.slice(0, serie.length).map((n, i) => (
                            <text key={i} x={pts[i].x} y="58" fontSize="8.5" fill="#9CA3AF" textAnchor="middle" fontFamily="inherit">{n}</text>
                          ))}
                        </>
                      );
                    })()}
                  </svg>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BloqueSucursales({ sucursales, matriz, mesActual, anioActual, anioPrev, inventarioSucursales = [], meta }) {
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

      {/* Bento: Hero (top sucursal) + satélites + strip virtuales */}
      <BentoSucursales
        fisicas={fisicas} virtuales={virtuales}
        matriz={matriz} mesActual={mesActual}
        metrica={metrica} valorMetrica={valorMetrica} fmtMetrica={fmtMetrica}
        totalVis={totalVis} selKey={selKey} setSelKey={setSelKey} />


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

          {/* Top clientes + Top vendedores de la sucursal */}
          {meta && (
            <SucursalDrillDown
              sucursal={seleccionada.key} sucursalLabel={seleccionada.label} color={seleccionada.color}
              meta={meta} anioActual={anioActual} anioPrev={anioPrev} mesActual={mesActual} />
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

// ── Drill-down por sucursal: top clientes + top vendedores ────────────────
function SucursalDrillDown({ sucursal, sucursalLabel, color, meta, anioActual, anioPrev, mesActual }) {
  const [cargando, setCargando] = useState(true);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;
    setCargando(true);
    (async () => {
      try {
        const { data, error } = await supabase.from('sellout_general')
          .select('anio,mes,cliente_nombre,vendedor_nombre,cantidad,importe')
          .eq('mayorista', meta.mayoristaKey)
          .eq('sucursal', sucursal)
          .in('anio', [anioPrev, anioActual]);
        if (cancelled) return;
        if (error) { console.error('[SucursalDrillDown]', error); setRows([]); }
        else setRows(data || []);
        setCargando(false);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setCargando(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sucursal, meta.mayoristaKey, anioActual, anioPrev]);

  const { topClientes, topVendedores, clientesTotal, vendedoresTotal, montoYTD } = useMemo(() => {
    const cli = new Map(); const ven = new Map(); const cliPrev = new Map(); const venPrev = new Map();
    let mYTD = 0;
    for (const r of rows) {
      const y = r.anio; const cnt = Number(r.cantidad) || 0; const imp = Number(r.importe) || 0;
      const cn = (r.cliente_nombre || '(sin nombre)').trim();
      const vn = (r.vendedor_nombre || '(sin nombre)').trim();
      if (y === anioActual) {
        mYTD += imp;
        if (!cli.has(cn)) cli.set(cn, { name: cn, pz: 0, monto: 0 });
        const c = cli.get(cn); c.pz += cnt; c.monto += imp;
        if (!ven.has(vn)) ven.set(vn, { name: vn, pz: 0, monto: 0 });
        const v = ven.get(vn); v.pz += cnt; v.monto += imp;
      } else if (y === anioPrev) {
        cliPrev.set(cn, (cliPrev.get(cn) || 0) + imp);
        venPrev.set(vn, (venPrev.get(vn) || 0) + imp);
      }
    }
    const totCli = Array.from(cli.values()).reduce((s, x) => s + x.monto, 0) || 1;
    const totVen = Array.from(ven.values()).reduce((s, x) => s + x.monto, 0) || 1;
    const topC = Array.from(cli.values()).sort((a, b) => b.monto - a.monto).slice(0, 8).map((v) => ({
      ...v, pct: v.monto / totCli * 100,
      prev: cliPrev.get(v.name) || 0,
      yoy: cliPrev.get(v.name) > 0 ? ((v.monto - cliPrev.get(v.name)) / cliPrev.get(v.name) * 100) : null,
    }));
    const topV = Array.from(ven.values()).sort((a, b) => b.monto - a.monto).slice(0, 8).map((v) => ({
      ...v, pct: v.monto / totVen * 100,
      prev: venPrev.get(v.name) || 0,
      yoy: venPrev.get(v.name) > 0 ? ((v.monto - venPrev.get(v.name)) / venPrev.get(v.name) * 100) : null,
    }));
    return { topClientes: topC, topVendedores: topV, clientesTotal: cli.size, vendedoresTotal: ven.size, montoYTD: mYTD };
  }, [rows, anioActual, anioPrev]);

  if (cargando) {
    return (
      <div className="mt-3 p-3 bg-white border border-sky-200 rounded-md text-center text-[11px] text-gray-500">
        Cargando clientes y vendedores de {sucursalLabel}…
      </div>
    );
  }

  if (topClientes.length === 0 && topVendedores.length === 0) {
    return (
      <div className="mt-3 p-3 bg-white border border-sky-200 rounded-md text-center text-[11px] text-gray-500">
        Sin transacciones en {sucursalLabel} en el periodo.
      </div>
    );
  }

  const Row = ({ v, maxMonto }) => {
    const pctBarra = maxMonto > 0 ? Math.min(100, v.monto / maxMonto * 100) : 0;
    return (
      <div className="pb-1.5 border-b border-dashed border-gray-200 last:border-b-0 last:pb-0">
        <div className="grid grid-cols-[1fr_auto_auto] gap-2 items-baseline">
          <span className="text-[11.5px] font-semibold text-gray-800 truncate" title={v.name}>{v.name}</span>
          <span className="text-[11.5px] font-bold tabular-nums text-gray-900">{formatMXN(v.monto)}</span>
          <span className="text-[10px] text-gray-500 tabular-nums w-[38px] text-right">{v.pct.toFixed(1)}%</span>
        </div>
        <div className="mt-1 h-[2.5px] bg-gray-100 rounded-full overflow-hidden">
          <span className="block h-full rounded-full" style={{ width: `${pctBarra.toFixed(1)}%`, background: color }} />
        </div>
        <div className="mt-0.5 flex justify-between items-baseline text-[10px] text-gray-500 tabular-nums">
          <span>{fmtInt(v.pz)} pz</span>
          {v.yoy != null && (
            <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${v.yoy >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
              {v.yoy >= 0 ? '+' : ''}{v.yoy.toFixed(0)}% YoY
            </span>
          )}
          {v.yoy == null && v.prev === 0 && v.monto > 0 && (
            <span className="px-1.5 py-0.5 rounded-full text-[9px] font-semibold bg-gray-100 text-gray-500">nuevo</span>
          )}
        </div>
      </div>
    );
  };

  const maxMontoCli = topClientes[0]?.monto || 0;
  const maxMontoVen = topVendedores[0]?.monto || 0;

  return (
    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
      {/* Top clientes */}
      <div className="bg-white border border-sky-200 rounded-md p-3">
        <div className="flex justify-between items-baseline mb-2">
          <div className="text-[10.5px] uppercase tracking-widest text-sky-700 font-bold">Top clientes</div>
          <span className="text-[10px] text-gray-500">{clientesTotal} totales</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {topClientes.map((v) => <Row key={v.name} v={v} maxMonto={maxMontoCli} />)}
        </div>
      </div>

      {/* Top vendedores */}
      <div className="bg-white border border-sky-200 rounded-md p-3">
        <div className="flex justify-between items-baseline mb-2">
          <div className="text-[10.5px] uppercase tracking-widest text-sky-700 font-bold">Top vendedores</div>
          <span className="text-[10px] text-gray-500">{vendedoresTotal} totales</span>
        </div>
        <div className="flex flex-col gap-1.5">
          {topVendedores.map((v) => <Row key={v.name} v={v} maxMonto={maxMontoVen} />)}
        </div>
      </div>
    </div>
  );
}

// ── Bento asimétrico: hero (top sucursal) + satélites + strip virtuales ──
function BentoSucursales({ fisicas, virtuales, matriz, mesActual, metrica, valorMetrica, fmtMetrica, totalVis, selKey, setSelKey }) {
  if (fisicas.length === 0 && virtuales.length === 0) {
    return <div className="p-6 text-center text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-lg">Sin datos de sucursales en el periodo.</div>;
  }

  const [hero, ...restoFisicas] = fisicas;
  const heroVal = hero ? valorMetrica(hero) : 0;
  const heroPct = totalVis > 0 ? (heroVal / totalVis * 100) : 0;
  const heroSerie = hero ? (matriz.get(hero.key) || []) : [];
  const heroSerieVis = heroSerie.slice(0, mesActual);
  const heroMaxSerie = Math.max(1, ...heroSerieVis);

  const HeroCard = () => {
    if (!hero) return null;
    const isSel = selKey === hero.key;
    return (
      <button onClick={() => setSelKey(isSel ? null : hero.key)}
        className={`text-left rounded-xl p-4 relative transition ${isSel ? 'ring-2 ring-sky-400' : ''}`}
        style={{ background: `linear-gradient(135deg, ${hero.color}18 0%, ${hero.color}08 100%)`, border: `1px solid ${hero.color}55` }}>
        <span className="absolute top-2.5 right-2.5 text-[9px] font-bold uppercase tracking-wider text-white px-2 py-0.5 rounded-full"
          style={{ background: hero.color }}>🏆 Top</span>
        <div className="text-[19px] font-bold leading-tight" style={{ color: hero.color, filter: 'brightness(0.7)' }}>
          {hero.label}
        </div>
        {hero.subtitle && <div className="text-[11px] mt-0.5" style={{ color: hero.color, filter: 'brightness(0.85)' }}>{hero.subtitle}</div>}
        <div className="text-[11px] text-gray-600 mt-0.5">
          {heroPct.toFixed(1)}% del total · {fmtInt(hero.piezas)} pz · {fmtInt(hero.tx)} tx
        </div>

        <div className="text-[32px] font-extrabold tabular-nums mt-3 leading-none" style={{ color: hero.color, filter: 'brightness(0.6)' }}>
          {fmtMetrica(heroVal)}
        </div>
        <div className="text-[10.5px] text-gray-500 mt-0.5">YTD {metrica === 'monto' ? 'venta $' : metrica === 'piezas' ? 'piezas' : metrica === 'tx' ? 'tickets' : 'inventario $'}</div>

        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-white/70 rounded-md p-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-gray-600">Ticket prom.</div>
            <div className="text-[13px] font-bold tabular-nums text-gray-800">{hero.tx > 0 ? formatMXN(hero.monto / hero.tx) : '—'}</div>
          </div>
          <div className="bg-white/70 rounded-md p-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-gray-600">YoY</div>
            <div className={`text-[13px] font-bold tabular-nums ${hero.yoy == null ? 'text-gray-400' : hero.yoy >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              {hero.yoy != null ? `${hero.yoy >= 0 ? '+' : ''}${hero.yoy.toFixed(0)}%` : '—'}
            </div>
          </div>
          <div className="bg-white/70 rounded-md p-2">
            <div className="text-[9px] uppercase tracking-wider font-bold text-gray-600">Inv. actual</div>
            <div className="text-[13px] font-bold tabular-nums text-gray-800">{fmtInt(hero.invStock)} pz</div>
          </div>
        </div>

        {heroSerieVis.length > 1 && (
          <div className="bg-white/80 rounded-md p-2.5 mt-3 border border-white/50">
            <div className="text-[9px] uppercase tracking-wider font-bold text-gray-500 mb-1">Evolución mensual · venta $</div>
            <svg viewBox="0 0 400 70" preserveAspectRatio="none" style={{ width: '100%', height: 70, display: 'block' }}>
              <line x1="0" y1="56" x2="400" y2="56" stroke="#E5E7EB" strokeDasharray="2 3" />
              <defs>
                <linearGradient id={`hero-grad-${hero.key}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={hero.color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={hero.color} stopOpacity="0" />
                </linearGradient>
              </defs>
              {(() => {
                const pts = heroSerieVis.map((v, i) => {
                  const x = 20 + i * (360 / Math.max(1, heroSerieVis.length - 1));
                  const y = 56 - (v / heroMaxSerie * 44);
                  return { x, y, v };
                });
                const areaPath = `M ${pts[0].x} ${pts[0].y} ` + pts.slice(1).map((p) => `L ${p.x} ${p.y}`).join(' ') + ` L ${pts[pts.length - 1].x} 56 L ${pts[0].x} 56 Z`;
                return (
                  <>
                    <path d={areaPath} fill={`url(#hero-grad-${hero.key})`} />
                    <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                      stroke={hero.color} strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    {pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r={i === pts.length - 1 ? 3.8 : 3}
                        fill={i === pts.length - 1 ? 'white' : hero.color}
                        stroke={hero.color} strokeWidth={i === pts.length - 1 ? 2 : 0} />
                    ))}
                    {MESES.slice(0, heroSerieVis.length).map((m, i) => (
                      <text key={i} x={pts[i].x} y="68" fontSize="9" fill="#9CA3AF" textAnchor="middle" fontFamily="inherit">{m}</text>
                    ))}
                  </>
                );
              })()}
            </svg>
          </div>
        )}
      </button>
    );
  };

  const SatCell = ({ s, rank }) => {
    const val = valorMetrica(s);
    const isSel = selKey === s.key;
    const yoyClass = s.yoy == null ? 'bg-gray-100 text-gray-500' : s.yoy >= 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800';
    return (
      <button onClick={() => setSelKey(isSel ? null : s.key)}
        className={`text-left bg-white rounded-lg p-3 border transition flex flex-col gap-1.5 hover:shadow-sm ${isSel ? 'ring-2 ring-sky-400 border-sky-300' : 'border-gray-200'}`}>
        <div className="flex justify-between items-baseline gap-2">
          <div className="text-[13px] font-bold text-gray-800 truncate">
            {s.label}
            {s.subtitle && <span className="ml-1 text-[10.5px] font-medium text-gray-500">· {s.subtitle}</span>}
          </div>
          <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-1.5 py-0.5 rounded">#{rank}</span>
        </div>
        <div className="text-[19px] font-bold tabular-nums text-gray-900 leading-none">{fmtMetrica(val)}</div>
        <div className="flex justify-between items-baseline text-[10.5px] text-gray-500 tabular-nums">
          <span>{totalVis > 0 ? (val / totalVis * 100).toFixed(1) : '0.0'}% · {fmtInt(s.piezas)} pz</span>
          {s.yoy != null && (
            <span className={`text-[9.5px] font-bold px-1.5 py-0.5 rounded-full ${yoyClass}`}>
              {s.yoy >= 0 ? '+' : ''}{s.yoy.toFixed(0)}%
            </span>
          )}
        </div>
        {/* Sparkline mini */}
        {(() => {
          const serie = (matriz.get(s.key) || []).slice(0, mesActual);
          if (serie.length < 2) return null;
          const mx = Math.max(1, ...serie);
          const pts = serie.map((v, i) => `${(i / (serie.length - 1)) * 200},${20 - (v / mx * 16)}`).join(' ');
          return (
            <svg viewBox="0 0 200 22" preserveAspectRatio="none" style={{ width: '100%', height: 22, display: 'block' }}>
              <polyline points={pts} stroke={s.color} strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          );
        })()}
        {s.invStock > 0 && (
          <div className="text-[10px] text-indigo-800 bg-indigo-50 px-1.5 py-0.5 rounded font-semibold tabular-nums self-start">
            📦 {fmtInt(s.invStock)} pz · {formatMXN(s.invValor)}
          </div>
        )}
      </button>
    );
  };

  const VirtualCell = ({ s }) => {
    const val = valorMetrica(s);
    const isSel = selKey === s.key;
    return (
      <button onClick={() => setSelKey(isSel ? null : s.key)}
        className={`text-left bg-white rounded-lg p-2.5 border transition grid grid-cols-[auto_1fr_auto] gap-2 items-center hover:shadow-sm ${isSel ? 'ring-2 ring-sky-400 border-sky-300' : 'border-gray-200'}`}>
        <span className="w-7 h-7 rounded-md flex items-center justify-center text-[15px]"
          style={{ background: `${s.color}22` }}>{s.icon || '•'}</span>
        <div className="min-w-0">
          <div className="font-bold text-[12.5px] text-gray-800 truncate">{s.label}</div>
          <div className="text-[10.5px] text-gray-500 tabular-nums">{fmtInt(s.piezas)} pz</div>
        </div>
        <div className="text-right">
          <div className="text-[14px] font-bold tabular-nums text-gray-900">{fmtMetrica(val)}</div>
          {s.yoy != null && (
            <div className={`text-[9.5px] font-bold ${s.yoy >= 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
              {s.yoy >= 0 ? '+' : ''}{s.yoy.toFixed(0)}%
            </div>
          )}
        </div>
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {/* Bento principal: hero + satélites */}
      <div className={`grid gap-3 ${hero ? 'grid-cols-1 lg:grid-cols-[1.4fr_2.6fr]' : ''}`}>
        {hero && <HeroCard />}
        {restoFisicas.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 content-start">
            {restoFisicas.map((s, i) => <SatCell key={s.key} s={s} rank={i + 2} />)}
          </div>
        )}
      </div>

      {/* Strip virtuales */}
      {virtuales.length > 0 && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-bold mb-2">
            Canales virtuales · sin ubicación física · {virtuales.length}
          </div>
          <div className={`grid gap-2 ${virtuales.length === 1 ? 'grid-cols-1' : virtuales.length === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-3'}`}>
            {virtuales.map((s) => <VirtualCell key={s.key} s={s} />)}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Drill-down por SKU: clientes finales / vendedores / precio ─────────────
// ── Análisis de margen: costo (sell-in Acteck→cliente) × precio venta (sellout)
//    × piezas vendidas, mes a mes. Deriva margen unitario y absoluto por mes.
function AnalisisMargenSku({ sku, rows, sellInAcumulado, anioActual, mesActual, accent, precioReal, precioLista, yieldPct, siPzYTD, clienteNombre, listaPrecio }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = React.useRef(null);
  const data = useMemo(() => {
    // Sellout por mes: piezas y monto
    const soPz = Array(12).fill(0); const soMonto = Array(12).fill(0);
    for (const r of rows) {
      if (r.anio !== anioActual) continue;
      const i = (r.mes || 0) - 1;
      if (i < 0 || i > 11) continue;
      soPz[i]    += Number(r.cantidad) || 0;
      soMonto[i] += Number(r.importe)  || 0;
    }
    // Sell-in por mes (facturacion): piezas y monto para este SKU
    const siPz = Array(12).fill(0); const siMonto = Array(12).fill(0);
    for (const r of sellInAcumulado) {
      if (r.anio !== anioActual || r.sku !== sku) continue;
      const i = r.mes - 1;
      if (i < 0 || i > 11) continue;
      siPz[i]    += Number(r.piezas) || 0;
      siMonto[i] += Number(r.monto)  || 0;
    }
    // Costo promedio YTD ponderado por piezas compradas — se usa como fallback
    // cuando en un mes no hay compra pero sí hay ventas.
    let siTotPz = 0, siTotMonto = 0;
    for (let i = 0; i < 12; i++) { siTotPz += siPz[i]; siTotMonto += siMonto[i]; }
    const costoPromYTD = siTotPz > 0 ? siTotMonto / siTotPz : null;
    const out = [];
    for (let i = 0; i < mesActual; i++) {
      const costoReal  = siPz[i] > 0 ? siMonto[i] / siPz[i] : null;
      // Fallback: si no hay compra ese mes pero hay ventas, usa el costo prom YTD
      const costoUnit  = costoReal != null ? costoReal
                        : (soPz[i] > 0 && costoPromYTD != null ? costoPromYTD : null);
      const costoFallback = costoReal == null && costoUnit != null;
      const precioUnit = soPz[i] > 0 ? soMonto[i] / soPz[i] : null;
      const margenUnit = costoUnit != null && precioUnit != null ? precioUnit - costoUnit : null;
      const margenPct  = margenUnit != null && precioUnit > 0 ? (margenUnit / precioUnit * 100) : null;
      const margenAbs  = margenUnit != null ? margenUnit * soPz[i] : null;
      out.push({
        mes: MESES[i],
        piezasVend: soPz[i],
        piezasComp: siPz[i],
        costoUnit, costoFallback, precioUnit, margenUnit, margenPct, margenAbs,
      });
    }
    return out;
  }, [rows, sellInAcumulado, sku, anioActual, mesActual]);

  const kpis = useMemo(() => {
    const conCosto = data.filter((d) => d.costoUnit != null && d.piezasVend > 0);
    const conPrecio = data.filter((d) => d.precioUnit != null && d.piezasVend > 0);
    const totalPz = data.reduce((s, d) => s + d.piezasVend, 0);
    const totalVenta = data.reduce((s, d) => s + (d.precioUnit || 0) * d.piezasVend, 0);
    const totalCosto = data.reduce((s, d) => s + (d.costoUnit != null ? d.costoUnit * d.piezasVend : 0), 0);
    const totalMargen = data.reduce((s, d) => s + (d.margenAbs || 0), 0);
    const costoProm  = conCosto.length ? conCosto.reduce((s, d) => s + d.costoUnit * d.piezasVend, 0) / conCosto.reduce((s, d) => s + d.piezasVend, 0) : null;
    const precioProm = conPrecio.length ? conPrecio.reduce((s, d) => s + d.precioUnit * d.piezasVend, 0) / conPrecio.reduce((s, d) => s + d.piezasVend, 0) : null;
    const margenProm = costoProm != null && precioProm != null ? precioProm - costoProm : null;
    const margenPctProm = margenProm != null && precioProm > 0 ? (margenProm / precioProm * 100) : null;
    return { totalPz, totalVenta, totalCosto, totalMargen, costoProm, precioProm, margenProm, margenPctProm };
  }, [data]);

  if (kpis.totalPz === 0 && kpis.totalCosto === 0) return null;

  const maxPz = Math.max(1, ...data.map((d) => d.piezasVend));
  const maxPrecio = Math.max(1, ...data.map((d) => Math.max(d.precioUnit || 0, d.costoUnit || 0)));

  return (
    <div className="border-t border-gray-200 pt-4 mt-4">
      <div className="flex items-baseline justify-between mb-3">
        <span className="text-[10.5px] uppercase tracking-widest font-bold text-gray-700">
          Margen mes a mes · costo × precio × piezas
        </span>
        <span className="text-[10.5px] text-gray-500 tabular-nums">
          YTD {anioActual}: {fmtInt(kpis.totalPz)} pz vendidas · margen total {formatMXN(kpis.totalMargen)}
        </span>
      </div>

      {/* 3 columnas iguales: Tabla · Chart · Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">

      {/* COL 1: Tabla detalle mensual */}
      <div className="bg-white border border-gray-200 rounded-md p-3 flex flex-col">
        <div className="text-[10px] uppercase tracking-widest font-bold text-gray-500 mb-2 flex justify-between items-baseline">
          <span>Detalle mensual</span>
          <span className="font-medium text-gray-400 normal-case tracking-normal">{data.length} meses</span>
        </div>
        <div className="overflow-x-auto flex-1">
        <table className="w-full text-[10.5px] tabular-nums">
          <thead className="bg-gray-50 text-gray-600">
            <tr className="text-[9px] uppercase tracking-wide">
              <th className="text-left py-1.5 px-1.5 font-semibold">Mes</th>
              <th className="text-right py-1.5 px-1.5 font-semibold">Comp</th>
              <th className="text-right py-1.5 px-1.5 font-semibold">Vend</th>
              <th className="text-right py-1.5 px-1.5 font-semibold">Costo</th>
              <th className="text-right py-1.5 px-1.5 font-semibold">Precio</th>
              <th className="text-right py-1.5 px-1.5 font-semibold">Marg</th>
              <th className="text-right py-1.5 px-1.5 font-semibold">%</th>
            </tr>
          </thead>
          <tbody>
            {data.map((d, i) => (
              <tr key={i} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-1 px-1.5 font-semibold text-gray-800">{d.mes}</td>
                <td className="py-1 px-1.5 text-right text-gray-600">{d.piezasComp > 0 ? fmtInt(d.piezasComp) : '—'}</td>
                <td className="py-1 px-1.5 text-right text-gray-800">{d.piezasVend > 0 ? fmtInt(d.piezasVend) : '—'}</td>
                <td className="py-1 px-1.5 text-right text-amber-700">
                  {d.costoUnit != null ? formatMXN(d.costoUnit) : '—'}
                  {d.costoFallback ? <span className="text-amber-500">*</span> : null}
                </td>
                <td className="py-1 px-1.5 text-right" style={{ color: accent }}>{d.precioUnit != null ? formatMXN(d.precioUnit) : '—'}</td>
                <td className="py-1 px-1.5 text-right text-gray-800">{d.margenUnit != null ? formatMXN(d.margenUnit) : '—'}</td>
                <td className="py-1 px-1.5 text-right text-gray-800">{d.margenPct != null ? `${d.margenPct.toFixed(1)}%` : '—'}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-gray-800">
              <td className="py-1.5 px-1.5">Total</td>
              <td className="py-1.5 px-1.5 text-right">{fmtInt(data.reduce((s, d) => s + d.piezasComp, 0))}</td>
              <td className="py-1.5 px-1.5 text-right">{fmtInt(kpis.totalPz)}</td>
              <td className="py-1.5 px-1.5 text-right text-amber-700">{kpis.costoProm != null ? formatMXN(kpis.costoProm) : '—'}</td>
              <td className="py-1.5 px-1.5 text-right" style={{ color: accent }}>{kpis.precioProm != null ? formatMXN(kpis.precioProm) : '—'}</td>
              <td className="py-1.5 px-1.5 text-right">{kpis.margenProm != null ? formatMXN(kpis.margenProm) : '—'}</td>
              <td className="py-1.5 px-1.5 text-right">{kpis.margenPctProm != null ? `${kpis.margenPctProm.toFixed(1)}%` : '—'}</td>
            </tr>
          </tfoot>
        </table>
        </div>
        {data.some((d) => d.costoFallback) && (
          <div className="text-[9.5px] text-amber-600 mt-2">* Mes sin compra: se usa costo promedio YTD como fallback</div>
        )}
      </div>

      {/* COL 2: Chart */}
      <div className="bg-white border border-gray-200 rounded-md p-3 relative">
        <div className="flex justify-between items-baseline mb-1">
          <div>
            <div className="text-[12.5px] font-bold text-gray-800">Costo × Precio × Piezas</div>
            <div className="text-[10px] text-gray-500">Hover un mes para desglose</div>
          </div>
        </div>
        {hoverIdx != null && data[hoverIdx] && (() => {
          const d = data[hoverIdx];
          return (
            <div className="absolute top-2 right-2 bg-white border border-gray-200 rounded-md p-2.5 shadow-lg text-[11px] tabular-nums min-w-[190px] z-10 pointer-events-none">
              <div className="font-bold text-gray-800 mb-1.5 pb-1 border-b border-gray-100 flex justify-between items-baseline">
                <span>{d.mes} {anioActual}</span>
                <span className="text-[10px] font-normal text-gray-500">{fmtInt(d.piezasVend)} pz vend</span>
              </div>
              <div className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-gray-600">
                <span>Pz comp</span>
                <span className="text-right text-gray-800">{d.piezasComp > 0 ? fmtInt(d.piezasComp) : '—'}</span>
                <span>Pz vend</span>
                <span className="text-right text-gray-800">{d.piezasVend > 0 ? fmtInt(d.piezasVend) : '—'}</span>
                <span style={{ color: '#F59E0B' }}>Costo unit</span>
                <span className="text-right" style={{ color: '#B45309' }}>{d.costoUnit != null ? formatMXN(d.costoUnit) : '—'}</span>
                <span style={{ color: accent }}>Precio unit</span>
                <span className="text-right font-semibold" style={{ color: accent, filter: 'brightness(0.7)' }}>{d.precioUnit != null ? formatMXN(d.precioUnit) : '—'}</span>
                <span>Margen unit</span>
                <span className="text-right text-gray-800">{d.margenUnit != null ? formatMXN(d.margenUnit) : '—'}</span>
                <span>% margen</span>
                <span className="text-right text-gray-800">{d.margenPct != null ? `${d.margenPct.toFixed(1)}%` : '—'}</span>
                <span className="pt-1 border-t border-gray-100">Margen $</span>
                <span className="text-right font-bold text-gray-900 pt-1 border-t border-gray-100">{d.margenAbs != null ? formatMXN(d.margenAbs) : '—'}</span>
              </div>
            </div>
          );
        })()}
        <svg ref={svgRef} viewBox="0 0 720 220" preserveAspectRatio="none" style={{ width: '100%', height: 220, display: 'block' }} fontFamily="inherit"
          onMouseMove={(e) => {
            if (!svgRef.current || data.length === 0) return;
            const rect = svgRef.current.getBoundingClientRect();
            // viewBox X 0..720 se mapea linealmente al ancho del SVG (preserveAspectRatio="none")
            const vbX = (e.clientX - rect.left) / rect.width * 720;
            const colW = 640 / data.length;
            const idx = Math.floor((vbX - 55) / colW);
            if (idx >= 0 && idx < data.length) {
              if (idx !== hoverIdx) setHoverIdx(idx);
            } else if (hoverIdx != null) setHoverIdx(null);
          }}
          onMouseLeave={() => setHoverIdx(null)}>
          {/* Grid horizontal */}
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
            <line key={i} x1="45" y1={30 + f * 140} x2="700" y2={30 + f * 140} stroke="#E5E7EB" strokeDasharray="2 3" />
          ))}
          {/* Eje Y izquierdo (precio) */}
          {[0, 0.25, 0.5, 0.75, 1].map((f, i) => (
            <text key={i} x="42" y={30 + (1 - f) * 140 + 3} fontSize="9" fill="#6B7280" textAnchor="end">
              {formatMXN(maxPrecio * f).replace('$', '$')}
            </text>
          ))}
          {/* Eje Y derecho (piezas) */}
          {[0, 0.5, 1].map((f, i) => (
            <text key={i} x="703" y={30 + (1 - f) * 140 + 3} fontSize="9" fill="#9CA3AF" textAnchor="start">
              {fmtInt(maxPz * f)}pz
            </text>
          ))}
          {/* Bars piezas */}
          {data.map((d, i) => {
            const colW = 640 / Math.max(1, data.length);
            const barX = 55 + i * colW;
            const barW = colW * 0.55;
            const barH = d.piezasVend > 0 ? (d.piezasVend / maxPz) * 140 : 0;
            const isHover = hoverIdx === i;
            return (
              <rect key={i} x={barX} y={170 - barH} width={barW} height={barH}
                fill={isHover ? '#64748B' : '#CBD5E1'} opacity={isHover ? 1 : 0.85} rx="1.5"
                pointerEvents="none" style={{ transition: 'fill 120ms' }} />
            );
          })}
          {/* Line precio venta */}
          {(() => {
            const pts = data.map((d, i) => {
              const x = 55 + i * (640 / Math.max(1, data.length)) + (640 / Math.max(1, data.length)) * 0.275;
              const y = d.precioUnit != null ? 170 - (d.precioUnit / maxPrecio) * 140 : null;
              return { x, y, v: d.precioUnit };
            }).filter((p) => p.y != null);
            if (pts.length < 2) return null;
            return (
              <>
                <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke={accent} strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3.5" fill={accent} stroke="white" strokeWidth="1.5" />)}
              </>
            );
          })()}
          {/* Line costo */}
          {(() => {
            const pts = data.map((d, i) => {
              const x = 55 + i * (640 / Math.max(1, data.length)) + (640 / Math.max(1, data.length)) * 0.275;
              const y = d.costoUnit != null ? 170 - (d.costoUnit / maxPrecio) * 140 : null;
              return { x, y, v: d.costoUnit };
            }).filter((p) => p.y != null);
            if (pts.length < 2) return null;
            return (
              <>
                <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  stroke="#F59E0B" strokeWidth="2" fill="none" strokeDasharray="4 3" strokeLinecap="round" strokeLinejoin="round" />
                {pts.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="3" fill="white" stroke="#F59E0B" strokeWidth="1.8" />)}
              </>
            );
          })()}
          {/* Etiquetas mes */}
          {data.map((d, i) => (
            <text key={i} x={55 + i * (640 / Math.max(1, data.length)) + (640 / Math.max(1, data.length)) * 0.275}
              y="188" fontSize="10" fill="#6B7280" textAnchor="middle">{d.mes}</text>
          ))}
          {/* Leyenda */}
          <g transform="translate(55, 208)" fontSize="10" fill="#6B7280">
            <rect x="0" y="-8" width="10" height="8" fill="#CBD5E1" rx="1" />
            <text x="14" y="0">Piezas vendidas</text>
            <line x1="115" y1="-4" x2="130" y2="-4" stroke={accent} strokeWidth="2.2" />
            <circle cx="122.5" cy="-4" r="3" fill={accent} stroke="white" strokeWidth="1.2" />
            <text x="135" y="0">Precio venta</text>
            <line x1="220" y1="-4" x2="235" y2="-4" stroke="#F59E0B" strokeWidth="2" strokeDasharray="3 2" />
            <circle cx="227.5" cy="-4" r="2.5" fill="white" stroke="#F59E0B" strokeWidth="1.5" />
            <text x="240" y="0">Costo (sell-in / pz)</text>
          </g>
          {/* Línea guía vertical en la posición hovereada (renderizada al final para estar encima) */}
          {hoverIdx != null && (() => {
            const colW = 640 / Math.max(1, data.length);
            const x = 55 + hoverIdx * colW + colW * 0.5;
            return (
              <line x1={x} y1="30" x2={x} y2="170" stroke="#475569" strokeWidth="1.2" strokeDasharray="3 2" opacity="0.7" pointerEvents="none" />
            );
          })()}
        </svg>
      </div>

      {/* COL 3: Cards apiladas */}
      <div className="flex flex-col gap-2">
        {/* Hero: Margen total YTD */}
        <div className="rounded-md p-3 border" style={{ background: `linear-gradient(135deg, ${accent}18 0%, ${accent}08 100%)`, borderColor: `${accent}55` }}>
          <div className="text-[9.5px] uppercase tracking-widest font-bold" style={{ color: accent, filter: 'brightness(0.7)' }}>Margen total YTD</div>
          <div className="text-[20px] font-bold tabular-nums" style={{ color: accent, filter: 'brightness(0.6)' }}>{formatMXN(kpis.totalMargen)}</div>
          <div className="text-[10px] tabular-nums" style={{ color: accent, filter: 'brightness(0.7)' }}>
            {kpis.totalVenta > 0 ? `${(kpis.totalMargen / kpis.totalVenta * 100).toFixed(1)}% de la venta` : '—'}
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Costo prom.</div>
          <div className="text-[14px] font-bold tabular-nums text-gray-800">{kpis.costoProm != null ? formatMXN(kpis.costoProm) : '—'}</div>
          <div className="text-[10px] text-gray-500 tabular-nums">Total costo {formatMXN(kpis.totalCosto)}</div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Precio venta prom.</div>
          <div className="text-[14px] font-bold tabular-nums text-gray-800">{kpis.precioProm != null ? formatMXN(kpis.precioProm) : '—'}</div>
          <div className="text-[10px] text-gray-500 tabular-nums">Total venta {formatMXN(kpis.totalVenta)}</div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Margen unit. prom.</div>
          <div className="text-[14px] font-bold tabular-nums text-gray-800">{kpis.margenProm != null ? formatMXN(kpis.margenProm) : '—'}</div>
          <div className="text-[10px] text-gray-500 tabular-nums">
            {kpis.margenPctProm != null ? `${kpis.margenPctProm.toFixed(1)}% del precio` : '—'}
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Precio real vs lista</div>
          <div className="text-[14px] font-bold tabular-nums text-gray-800">
            {precioReal ? formatMXN(precioReal) : '—'}
            {precioLista ? <span className="text-gray-400 font-normal"> / {formatMXN(precioLista)}</span> : null}
          </div>
          <div className="text-[10px] text-gray-500">
            {yieldPct != null ? `Yield ${yieldPct.toFixed(1)}%` : (precioLista ? `Lista ${listaPrecio}` : 'Sin lista')}
          </div>
        </div>
        <div className="bg-gray-50 rounded-md p-2.5 border border-gray-100">
          <div className="text-[9.5px] uppercase tracking-widest text-gray-500 font-semibold">Sell-in Acteck→{clienteNombre}</div>
          <div className="text-[14px] font-bold tabular-nums text-gray-800">{fmtInt(siPzYTD)} pz</div>
          <div className="text-[10px] text-gray-500">YTD {anioActual}</div>
        </div>
      </div>
      </div>
    </div>
  );
}

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
        // sellout_general (Dicotech) trae detalle transaccional con clientes/vendedores/sucursales.
        // sellout_detalle (Digitalife) sólo trae fecha/marca/no_parte/cantidad/precio/total.
        const esGeneral = meta.tablaSellOut === 'sellout_general';
        const txPromise = esGeneral
          ? supabase.from('sellout_general')
              .select('anio,mes,cliente_nombre,vendedor_nombre,sucursal,cantidad,precio_unitario,importe')
              .eq('mayorista', meta.mayoristaKey).eq('sku', sku)
              .in('anio', [anioPrev, anioActual])
          : supabase.from('sellout_detalle')
              .select('fecha,marca,cantidad,precio,total')
              .eq('cliente', meta.sellInClienteKey).eq('no_parte', sku)
              .gte('fecha', `${anioPrev}-01-01`);
        const [txRes, precioRes] = await Promise.all([
          txPromise,
          supabase.from('precios_sku')
            .select('precio').eq('sku', sku).eq('lista', meta.listaPrecio)
            .eq('anio', anioActual).eq('mes', mesActual).maybeSingle(),
        ]);
        if (cancelled) return;
        let rows = txRes.data || [];
        if (!esGeneral) {
          // Normaliza al mismo shape que sellout_general para reutilizar el resto del código.
          rows = rows.map((r) => {
            const [y, m] = (r.fecha || '').split('-');
            return {
              anio: parseInt(y, 10),
              mes: parseInt(m, 10),
              cliente_nombre: null,
              vendedor_nombre: null,
              sucursal: null,
              cantidad: r.cantidad,
              precio_unitario: r.precio,
              importe: r.total,
            };
          });
        }
        setRows(rows);
        setPrecioLista(precioRes.data?.precio ? Number(precioRes.data.precio) : null);
        setCargando(false);
      } catch (e) {
        if (cancelled) return;
        console.error(e);
        setCargando(false);
      }
    })();
    return () => { cancelled = true; };
  }, [sku, meta.mayoristaKey, meta.tablaSellOut, meta.sellInClienteKey, meta.listaPrecio, anioActual, anioPrev, mesActual]);

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
      <div className={`grid grid-cols-1 gap-5 ${meta.drillClientesFinales || meta.drillVendedores || meta.drillSucursales ? 'lg:grid-cols-3' : ''}`}>
        {/* Col 1 Clientes finales */}
        {meta.drillClientesFinales && (
        <div>
          <div className="flex items-baseline justify-between mb-3">
            <span className="text-[9.5px] uppercase tracking-widest font-semibold text-gray-500">Clientes finales · YTD {anioActual}</span>
            <span className="text-[10.5px] text-gray-400">Top 6 de {clientesTotal}</span>
          </div>
          <div className="flex flex-col gap-2">
            {topClientes.slice(0, 6).map((v) => showRow(v, meta.accent))}
          </div>
        </div>
        )}

        {/* Col 2 Vendedores */}
        {meta.drillVendedores && (
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
        )}

        {/* Col 3 Sucursales */}
        {meta.drillSucursales && (
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
        )}
      </div>

      {/* Cruce mensual costo × precio × piezas + KPIs de precio y sell-in */}
      <AnalisisMargenSku sku={sku} rows={rows} sellInAcumulado={sellInAcumulado}
        anioActual={anioActual} mesActual={mesActual} accent={meta.accent}
        precioReal={precioReal} precioLista={precioLista} yieldPct={yieldPct}
        siPzYTD={siPzYTD} clienteNombre={meta.nombre} listaPrecio={meta.listaPrecio} />

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
