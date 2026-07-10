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

// Sucursales de Dicotech con label bonito
const SUCURSAL_LABEL = {
  'dicoags2': 'Aguascalientes',
  'leon2': 'León',
  'Arboledas': 'Arboledas',
  'GDL': 'Guadalajara',
  'dropship': 'Dropship',
  'ZACATECAS': 'Zacatecas',
  'AMAZON': 'Amazon',
  'Internet': 'Internet',
  'santafe': 'Santa Fe',
};
const SUCURSAL_COLOR = ['#0EA5E9', '#6366F1', '#10B981', '#F59E0B', '#EC4899', '#8B5CF6', '#F97316', '#14B8A6', '#94A3B8'];

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
      const [mes, skuMes, rdmp, fact, inv, sucMes] = await Promise.all([
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
      ]);
      setMensualDico(mes);
      setSkuMesRaw(skuMes);
      setRoadmap(rdmp);
      setFacturacion(fact);
      setInventarioCliente(inv);
      setSucursalMes(sucMes);
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
                              sellInAcumulado={facturacion} />
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
        <BloqueSucursales sucursales={sucursalesYTD} matriz={sucursalesMensual} mesActual={mesActual} anioActual={anioActual} anioPrev={anioPrev} />
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
function BloqueSucursales({ sucursales, matriz, mesActual, anioActual, anioPrev }) {
  const totalYTD = sucursales.reduce((s, x) => s + x.monto, 0);
  const maxPct = sucursales[0]?.pct || 1;

  // Data para chart apilado por mes: cada sucursal es una serie
  const chartData = MESES.map((m, i) => {
    const row = { mes: m };
    if (i >= mesActual) return row;
    for (const s of sucursales) {
      const serie = matriz.get(s.name);
      row[s.name] = serie ? Math.round(serie[i]) : 0;
    }
    return row;
  });

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4">
      <div className="flex justify-between items-baseline mb-3">
        <h3 className="text-sm font-semibold text-gray-800">
          Ventas por sucursal · YTD {anioActual}
        </h3>
        <span className="text-[11px] text-gray-500">
          {sucursales.length} sucursales · {formatMXN(totalYTD)}
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-4">
        {/* Ranking sucursales YTD */}
        <div className="flex flex-col gap-2">
          {sucursales.map((s) => {
            const yoyClass = s.yoy == null ? 'text-gray-400' : s.yoy >= 0 ? 'text-emerald-700' : 'text-rose-700';
            return (
              <div key={s.name} className="text-[12px]">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-sm flex-shrink-0" style={{ background: s.color }} />
                    <span className="font-medium text-gray-800 truncate">{s.label}</span>
                  </span>
                  <span className="text-gray-500 tabular-nums font-medium">{s.pct.toFixed(1)}%</span>
                </div>
                <div className="h-[4px] bg-gray-100 rounded-full overflow-hidden mt-1">
                  <span className="block h-full rounded-full" style={{ width: `${(s.pct / maxPct * 100).toFixed(1)}%`, background: s.color }} />
                </div>
                <div className="flex justify-between text-[10.5px] text-gray-500 mt-1 tabular-nums">
                  <span>{fmtInt(s.piezas)} pz · {formatMXN(s.monto)} · {fmtInt(s.tx)} tx</span>
                  {s.yoy != null ? (
                    <span className={`font-semibold ${yoyClass}`}>{s.yoy >= 0 ? '+' : ''}{s.yoy.toFixed(0)}% YoY</span>
                  ) : s.prevMonto === 0 && s.monto > 0 ? (
                    <span className="text-emerald-700 font-semibold">nueva</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>

        {/* Chart apilado mensual */}
        <div>
          <div className="text-[10.5px] uppercase tracking-widest font-semibold text-gray-500 mb-2">
            Evolución mensual · $ apilado por sucursal
          </div>
          <div style={{ height: 260 }}>
            <ResponsiveContainer>
              <ComposedChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#F3F4F6" vertical={false} />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#6B7280' }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={(v) => fmtMoneyShort(v)}
                  tick={{ fontSize: 10, fill: '#9CA3AF' }} axisLine={false} tickLine={false} width={55} />
                <Tooltip formatter={(v) => formatMXN(v)}
                  labelFormatter={(l) => `${l} ${anioActual}`}
                  contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #E5E7EB' }} />
                {sucursales.map((s) => (
                  <Bar key={s.name} dataKey={s.name} name={s.label} stackId="s"
                    fill={s.color} maxBarSize={40} />
                ))}
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {sucursales.length >= 2 && (
        <div className="border-t border-gray-200 mt-3 pt-3 flex justify-between text-[11.5px] text-gray-500">
          <span>
            Dominante: <strong className="text-gray-800">{sucursales[0].label}</strong> ({sucursales[0].pct.toFixed(1)}%)
          </span>
          <span>
            Top 3 = <strong className="text-gray-800 tabular-nums">{sucursales.slice(0, 3).reduce((s, x) => s + x.pct, 0).toFixed(1)}%</strong> del total
          </span>
        </div>
      )}
    </div>
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

function SkuDrillDown({ sku, skuInfo, meta, anioActual, anioPrev, mesActual, sellInAcumulado }) {
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
    </div>
  );
}
