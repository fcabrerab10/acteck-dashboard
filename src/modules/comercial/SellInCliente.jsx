// Sell In consolidado · Dirección Comercial (plantilla V3, kit). Antes este archivo tenía una rama por cliente
// (`clienteKey != null`) que App.jsx ya no usa: Digitalife → SellInClienteV2, Dicotech → SellInDicotech,
// PCEL → SellInPcel. Se conserva el export default y la firma ({ clienteKey }) por compatibilidad con App.jsx.
//
// Datos (todo por lib/queries: cache 5 min + paginación paralela):
//   v_sellin_global_sku_canal_mes  sku × canal × es_clave × año × mes (1 fetch por año seleccionado, 10K/página)
//   roadmap_sku                    orden, marca, categoría, familia, roadmap
//   v_cuota_global_mensual         Σ cuotas_mensuales.cuota_ideal · cuotas_canales (TOTAL/12 y por canal) si existe
//   v_sellin_global_sku_anio_erp   MC % por SKU y año (sólo con permiso `sensible`)
//   v_inventario_comercial         disponible por SKU (filtro "sólo con stock")
// El drill de cada SKU (sellin/DrillSku.jsx) carga lo suyo al abrir.
import React, { useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Share2, Copy, RotateCcw } from 'lucide-react';
import { Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { useRoadmap, fetchAll, fetchAllQ, cachedQuery } from '../../lib/queries';
import { cuotas as cuotasMedida, tooltip } from '../../lib/medidas';
import { Hero, KpiCard, Pill, DeltaPill, Segmented, TablaCompacta, HeatCell, Panel, Boton, Cargando, toast, GraficaLineas } from '../../components/kit';
import ExportMenu from '../../components/ExportMenu';
import SinAcceso from '../../components/SinAcceso';
import ComparadorPeriodos from './ComparadorPeriodos';
import { textoResumenMesCanal, compartir, copiar } from '../../lib/whatsapp';
import Buscador from './sellin/Buscador';
import Filtros from './sellin/Filtros';
import DrillSku from './sellin/DrillSku';
import { MESES, MESES_LARGO, normalizar, tokens, coincide, capitalizar, canalLabel, canalTone, N, fmtInt, fmtPct, fmtMoneyShort, pctDelta, anioColor, roadmapTone, CAT_COLORS } from './sellin/textos';

// ─── Datos ───
function useFacturacionGlobal(anios) {
  return useQuery({
    queryKey: ['sellin_global', 'sku_canal_anio', anios],
    queryFn: async () => {
      // v_sellin_global_sku_canal_anio (MV, migración 20260912_perf_sellin_global):
      // 1 fila por sku × canal × es_clave × AÑO con los 12 meses en arrays. Antes esto
      // era la vista viva por MES: ~16K filas/año → 2 páginas de 10K por año + el count
      // exact de cada una, reagregando facturacion_clientes en caliente (≈185 ms por
      // página, ≈3 s en total). Ahora son ~3.8K filas/año (1 página) y 6 ms en Postgres.
      // Los arrays se expanden aquí a la MISMA forma fila-por-mes que ya consumían los
      // agregados de la pantalla, así que abajo no cambia nada.
      const partes = await Promise.all(anios.map((y) => fetchAllQ(
        () => supabase.from('v_sellin_global_sku_canal_anio').select('sku,canal,es_clave,anio,piezas,monto').eq('anio', y),
        { pageSize: 10000, orderCol: 'sku', label: `v_sellin_global_sku_canal_anio·${y}` },
      )));
      const filas = [];
      for (const r of partes.flat()) {
        const pz = r.piezas || [], mo = r.monto || [];
        for (let i = 0; i < 12; i++) {
          // null = ese mes NO tenía fila en facturacion_clientes (el FILTER del pivot
          // devuelve NULL): así se reproduce EXACTAMENTE el juego de filas de la vista vieja.
          if (pz[i] == null && mo[i] == null) continue;
          filas.push({ sku: r.sku, canal: r.canal, es_clave: r.es_clave, anio: r.anio, mes: i + 1, piezas: Number(pz[i]) || 0, monto: Number(mo[i]) || 0 });
        }
      }
      return filas;
    },
  });
}
function useCuotasGlobal(anio) {
  return useQuery({
    queryKey: ['sellin_global', 'cuotas', anio],
    queryFn: async () => {
      const [mensual, canales] = await Promise.all([
        fetchAll('v_cuota_global_mensual', 'anio,mes,cuota_min,cuota_ideal', (q) => q.eq('anio', anio)),
        cachedQuery(supabase.from('cuotas_canales').select('dimension_tipo,dimension_valor,meta_facturacion').eq('anio', anio)).then((r) => r.data || []).catch(() => []),
      ]);
      return { mensual: mensual || [], canales };
    },
  });
}
function useErpSkuAnio(anios, enabled) {
  return useQuery({
    queryKey: ['sellin_global', 'erp_sku_anio', anios],
    enabled,
    queryFn: () => fetchAllQ(
      () => supabase.from('v_sellin_global_sku_anio_erp').select('sku,anio,fact_neta,contribucion,pct_mc,piezas').in('anio', anios),
      { pageSize: 10000, orderCol: 'sku', label: 'v_sellin_global_sku_anio_erp' },
    ),
  });
}
function useStockSku() {
  return useQuery({ queryKey: ['sellin_global', 'stock'], queryFn: () => fetchAll('v_inventario_comercial', 'sku,disponible') });
}
function useAnioMinimo() {
  return useQuery({
    queryKey: ['sellin_global', 'anio_min'],
    queryFn: async () => { const { data } = await cachedQuery(supabase.from('facturacion_clientes').select('anio').order('anio', { ascending: true }).limit(1)); return Number(data?.[0]?.anio) || null; },
  });
}

const emptyAnios = (anios) => Object.fromEntries(anios.map((y) => [y, Array(12).fill(0)]));

export default function SellInCliente({ clienteKey = null }) {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'sell_in')) return <SinAcceso motivo="No tienes acceso a Sell In." />;
  return <SellInGlobal sensible={puedeVerSensible(perfil)} clienteKey={clienteKey} />;
}

function SellInGlobal({ sensible }) {
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const hoy = new Date();
  const anio = hoy.getFullYear(), anioPrev = anio - 1, mesActual = hoy.getMonth() + 1;
  const diasMes = new Date(anio, mesActual, 0).getDate();
  const diasRestantes = Math.max(0, diasMes - hoy.getDate());

  // ── Estado ──
  const [aniosSel, setAniosSel] = useState(() => new Set([anioPrev, anio]));
  const [consolidado, setConsolidado] = useState(true); // true = todos los canales · false = sólo clientes clave (digitalife/pcel/dicotech)
  const [busqueda, setBusqueda] = useState('');
  const [sel, setSel] = useState({ marca: new Set(), categoria: new Set(), rdmp: new Set(), canal: new Set() });
  const [flags, setFlags] = useState({ ventaMes: false, stock: false });
  const [orden, setOrden] = useState(null); // { col, dir } · null = orden del roadmap
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [familiaSel, setFamiliaSel] = useState(null);

  const aniosSelOrd = useMemo(() => Array.from(aniosSel).sort((a, b) => a - b), [aniosSel]);
  const aniosFetch = useMemo(() => Array.from(new Set([...aniosSel, anio, anioPrev])).sort((a, b) => a - b), [aniosSel, anio, anioPrev]);
  const { data: anioMin } = useAnioMinimo();
  const aniosDisponibles = useMemo(() => { const desde = Math.max(anioMin || anio - 1, anio - 3); const out = []; for (let y = desde; y <= anio; y++) out.push(y); return out; }, [anioMin, anio]);
  const toggleAnio = (y) => setAniosSel((prev) => { const n = new Set(prev); if (n.has(y)) { if (n.size === 1) return prev; n.delete(y); } else n.add(y); return n; });

  // ── Datos ──
  const { data: fact = [], isLoading: lFact, error: eFact } = useFacturacionGlobal(aniosFetch);
  const { data: roadmap = [], isLoading: lRoad } = useRoadmap();
  const { data: cuotasData, isLoading: lCuotas } = useCuotasGlobal(anio);
  const { data: erp = [], isFetching: lErp } = useErpSkuAnio(aniosFetch, sensible);
  const { data: stock = [] } = useStockSku();
  const loading = lFact || lRoad || lCuotas;

  // ── Cuota Venta ([Cuota Venta] = Σ BP[IMPORTEDEVENTA]) ──
  // La precedencia (cuotas_canales TOTAL/12 → Σ cuotas_mensuales.cuota_ideal)
  // estaba reimplementada en 4 pantallas; ahora vive en lib/medidas.js → cuotas().
  const cuotas = useMemo(() => {
    const c = cuotasMedida(cuotasData?.canales || [], cuotasData?.mensual || []);
    const porCanal = new Map();
    for (const x of cuotasData?.canales || []) if (/canal/i.test(x.dimension_tipo || '') && x.dimension_valor) porCanal.set(String(x.dimension_valor).toUpperCase(), N(x.meta_facturacion) / 12);
    return { mes: (m) => c.mes(m) || 0, ytd: c.hasta(mesActual) || 0, anual: c.hasta(12) || 0, porCanal, fuente: c.fuente };
  }, [cuotasData, mesActual]);

  // ── Catálogo ──
  const roadmapMap = useMemo(() => new Map(roadmap.map((r) => [r.sku, r])), [roadmap]);
  const familiaDe = (sku) => capitalizar(roadmapMap.get(sku)?.familia || 'Sin familia');
  const stockMap = useMemo(() => new Map(stock.map((s) => [s.sku, N(s.disponible)])), [stock]);
  const erpMap = useMemo(() => { const m = new Map(); for (const r of erp) m.set(`${r.sku}|${r.anio}`, r); return m; }, [erp]);

  // ── Agregados globales (todos los canales, todos los clientes) para hero / KPIs / chart ──
  const global = useMemo(() => {
    const monto = emptyAnios(aniosFetch), piezas = emptyAnios(aniosFetch), montoFam = emptyAnios(aniosFetch);
    const canal = new Map(); // canal → { [y]: monto[12] }
    const skusAnio = new Set();
    for (const r of fact) {
      const y = r.anio, i = r.mes - 1; if (!monto[y] || i < 0 || i > 11) continue;
      const m = N(r.monto), p = N(r.piezas);
      monto[y][i] += m; piezas[y][i] += p;
      if (!familiaSel || familiaDe(r.sku) === familiaSel) montoFam[y][i] += m;
      if (y === anio && p > 0) skusAnio.add(r.sku);
      const ck = String(r.canal || 'otros').toUpperCase();
      if (!canal.has(ck)) canal.set(ck, emptyAnios(aniosFetch));
      canal.get(ck)[y][i] += m;
    }
    return { monto, piezas, montoFam, canal, skusAnio: skusAnio.size };
  }, [fact, aniosFetch, anio, familiaSel, roadmapMap]);

  const sum = (arr, hasta = 12) => arr.slice(0, hasta).reduce((a, b) => a + b, 0);
  const mtd = global.monto[anio][mesActual - 1], mtdPz = global.piezas[anio][mesActual - 1];
  const mtdPrev = global.monto[anioPrev][mesActual - 1], mtdPzPrev = global.piezas[anioPrev][mesActual - 1];
  const ytd = sum(global.monto[anio], mesActual), ytdPz = sum(global.piezas[anio], mesActual);
  const ytdPrev = sum(global.monto[anioPrev], mesActual);
  const cuotaMes = cuotas.mes(mesActual);
  const pctMTD = cuotaMes ? (mtd / cuotaMes) * 100 : null;
  const pctYTD = cuotas.ytd ? (ytd / cuotas.ytd) * 100 : null;
  const yoyMes = pctDelta(mtd, mtdPrev), yoyYtd = pctDelta(ytd, ytdPrev);
  const momIdx = mesActual - 2;
  const momPrev = momIdx < 0 ? global.monto[anioPrev][11] : global.monto[anio][momIdx];
  const momPzPrev = momIdx < 0 ? global.piezas[anioPrev][11] : global.piezas[anio][momIdx];
  const mom = pctDelta(mtd, momPrev);
  const momLabel = momIdx < 0 ? `${MESES_LARGO[11]} ${anioPrev}` : `${MESES_LARGO[momIdx]} ${anio}`;
  const mesLargo = MESES_LARGO[mesActual - 1];
  const green = theme.green || '#34C759', red = theme.red || '#FF3B30', orange = theme.orange || '#FF9500', blue = theme.accent || '#007AFF';
  const tonoPct = (p) => (p == null ? 'gray' : p >= 100 ? 'green' : p >= 85 ? 'blue' : p >= 60 ? 'orange' : 'red');

  const frase = pctMTD != null
    ? (pctMTD >= 100
      ? `${mesLargo} ya cumplió la cuota: ${fmtMoneyShort(mtd)} facturados, ${pctMTD.toFixed(0)} % del objetivo${diasRestantes ? ` con ${diasRestantes} días por delante` : ''}.`
      : `${mesLargo} va al ${pctMTD.toFixed(0)} % de la cuota; faltan ${fmtMoneyShort(cuotaMes - mtd)}${diasRestantes ? ` con ${diasRestantes} día${diasRestantes === 1 ? '' : 's'} por delante` : ' y el mes cerró'}.`)
    : `${mesLargo} lleva ${fmtMoneyShort(mtd)} facturados${yoyMes != null ? `, ${yoyMes >= 0 ? 'arriba' : 'abajo'} ${Math.abs(yoyMes).toFixed(0)} % de ${mesLargo} ${anioPrev}` : ''}.`;

  // ── Por canal (hero → compartir) ──
  const canales = useMemo(() => Array.from(global.canal.entries()).map(([c, m]) => ({
    canal: c, monto: m[anio][mesActual - 1], prev: m[anioPrev][mesActual - 1], ytd: sum(m[anio], mesActual),
    cuota: cuotas.porCanal.get(c) || null, yoy: pctDelta(m[anio][mesActual - 1], m[anioPrev][mesActual - 1]),
  })).filter((c) => c.monto || c.prev).sort((a, b) => b.monto - a.monto), [global, anio, anioPrev, mesActual, cuotas]);
  const textoResumen = () => textoResumenMesCanal({ mes: mesActual, anio, mtd, cuota: cuotaMes || null, ytd, yoyYtd, canales });
  const onCompartirResumen = async () => { const r = await compartir(textoResumen(), { titulo: `Sell In ${mesLargo} ${anio}` }); if (r === 'share') toast.ok('Compartido'); };
  const onCopiarResumen = async () => { if (await copiar(textoResumen())) toast.ok('Resumen copiado'); else toast.error('No se pudo copiar'); };

  // ── Chart + familias ──
  const chartData = useMemo(() => MESES.map((label, i) => ({ mes: label, prev: Math.round(global.montoFam[anioPrev][i]), act: i < mesActual ? Math.round(global.montoFam[anio][i]) : null, cuota: cuotas.mes(i + 1) || null })), [global, anio, anioPrev, mesActual, cuotas]);
  const familias = useMemo(() => {
    const map = new Map();
    for (const r of fact) {
      if (r.anio !== anio || r.mes > mesActual) continue;
      const f = familiaDe(r.sku);
      if (!map.has(f)) map.set(f, { name: f, monto: 0, skus: new Set() });
      const it = map.get(f); it.monto += N(r.monto); it.skus.add(r.sku);
    }
    const arr = Array.from(map.values()).map((v) => ({ ...v, skus: v.skus.size })).sort((a, b) => b.monto - a.monto);
    const tot = arr.reduce((s, x) => s + x.monto, 0);
    return arr.map((v, i) => ({ ...v, pct: tot ? (v.monto / tot) * 100 : 0, color: CAT_COLORS[i % CAT_COLORS.length] }));
  }, [fact, anio, mesActual, roadmapMap]);

  // ── Tabla por SKU: piezas por sku × año × mes según consolidado / canal ──
  const porSku = useMemo(() => {
    const m = new Map(); // sku → { piezas: {y: [12]}, monto: {y:[12]}, canales: Set }
    for (const r of fact) {
      if (!consolidado && !r.es_clave) continue;
      const ck = String(r.canal || 'otros').toUpperCase();
      if (sel.canal.size > 0 && !sel.canal.has(ck)) continue;
      if (!m.has(r.sku)) m.set(r.sku, { piezas: emptyAnios(aniosFetch), monto: emptyAnios(aniosFetch), canales: new Set() });
      const it = m.get(r.sku); const i = r.mes - 1;
      if (it.piezas[r.anio] && i >= 0 && i < 12) { it.piezas[r.anio][i] += N(r.piezas); it.monto[r.anio][i] += N(r.monto); }
      it.canales.add(ck);
    }
    return m;
  }, [fact, consolidado, sel.canal, aniosFetch]);
  // canales por SKU sin el filtro de canal (para los conteos de la pill Canal)
  const canalesSku = useMemo(() => { const m = new Map(); for (const r of fact) { if (!consolidado && !r.es_clave) continue; if (!m.has(r.sku)) m.set(r.sku, new Set()); m.get(r.sku).add(String(r.canal || 'otros').toUpperCase()); } return m; }, [fact, consolidado]);

  const candidatos = useMemo(() => {
    const toks = tokens(busqueda);
    const out = [];
    for (const r of roadmap) {
      const catCap = capitalizar(r.categoria);
      const hay = normalizar(`${r.sku} ${r.descripcion} ${r.marca} ${catCap} ${r.familia} ${r.rdmp}`);
      if (toks.length && !coincide(hay, toks)) continue;
      if (familiaSel && capitalizar(r.familia || 'Sin familia') !== familiaSel) continue;
      const d = porSku.get(r.sku);
      const pzAct = d?.piezas[anio] || Array(12).fill(0);
      out.push({ ...r, categoriaCap: catCap, rdmp: r.rdmp || '', canales: canalesSku.get(r.sku) || new Set(), ventaMes: pzAct[mesActual - 1] > 0, stock: (stockMap.get(r.sku) || 0) > 0, d });
    }
    return out;
  }, [roadmap, busqueda, familiaSel, porSku, canalesSku, stockMap, anio, mesActual]);

  const pasa = (r, omitir) => (
    (omitir === 'marca' || sel.marca.size === 0 || sel.marca.has(r.marca || '—'))
    && (omitir === 'categoria' || sel.categoria.size === 0 || sel.categoria.has(r.categoriaCap || '—'))
    && (omitir === 'rdmp' || sel.rdmp.size === 0 || sel.rdmp.has(r.rdmp || '—'))
    && (omitir === 'canal' || sel.canal.size === 0 || Array.from(sel.canal).some((c) => r.canales.has(c)))
    && (omitir === 'ventaMes' || !flags.ventaMes || r.ventaMes)
    && (omitir === 'stock' || !flags.stock || r.stock)
  );

  const grupos = useMemo(() => {
    const conteo = (campo, omitir, valorDe) => {
      const m = new Map();
      for (const r of candidatos) { if (!pasa(r, omitir)) continue; const vs = valorDe(r); for (const v of vs) m.set(v, (m.get(v) || 0) + 1); }
      return m;
    };
    const opciones = (m, extra = new Set(), label = (v) => v, tone) => Array.from(new Set([...m.keys(), ...extra])).sort().map((v) => ({ id: v, label: label(v), n: m.get(v) || 0, tone: tone ? tone(v) : undefined }));
    const todosCanales = new Set(); for (const s of canalesSku.values()) for (const c of s) todosCanales.add(c);
    return [
      { id: 'marca', label: 'Marca', sel: sel.marca, opciones: opciones(conteo('marca', 'marca', (r) => [r.marca || '—']), sel.marca) },
      { id: 'categoria', label: 'Categoría', sel: sel.categoria, opciones: opciones(conteo('categoria', 'categoria', (r) => [r.categoriaCap || '—']), sel.categoria) },
      { id: 'rdmp', label: 'Roadmap', sel: sel.rdmp, opciones: opciones(conteo('rdmp', 'rdmp', (r) => [r.rdmp || '—']), sel.rdmp, (v) => v, (v) => roadmapTone(v)) },
      { id: 'canal', label: 'Canal', sel: sel.canal, opciones: opciones(conteo('canal', 'canal', (r) => Array.from(r.canales)), new Set([...sel.canal, ...todosCanales]), canalLabel, canalTone) },
    ];
  }, [candidatos, sel, flags, canalesSku]);
  const togglesFiltro = useMemo(() => [
    { id: 'ventaMes', label: `Sólo con venta en ${MESES[mesActual - 1]}`, on: flags.ventaMes, n: candidatos.filter((r) => pasa(r, 'ventaMes') && r.ventaMes).length },
    { id: 'stock', label: 'Sólo con stock', on: flags.stock, n: candidatos.filter((r) => pasa(r, 'stock') && r.stock).length },
  ], [candidatos, sel, flags, mesActual]);
  const activos = sel.marca.size + sel.categoria.size + sel.rdmp.size + sel.canal.size + (flags.ventaMes ? 1 : 0) + (flags.stock ? 1 : 0);
  const onToggleSel = (g, v) => setSel((p) => { const n = new Set(p[g]); if (n.has(v)) n.delete(v); else n.add(v); return { ...p, [g]: n }; });
  const limpiar = () => { setSel({ marca: new Set(), categoria: new Set(), rdmp: new Set(), canal: new Set() }); setFlags({ ventaMes: false, stock: false }); };

  const filas = useMemo(() => {
    const rows = [];
    for (const r of candidatos) {
      if (!pasa(r)) continue;
      const pz = r.d?.piezas || emptyAnios(aniosFetch);
      const row = { ...r, piezasPorAnio: pz };
      let total = 0;
      for (const y of aniosSelOrd) for (let i = 0; i < 12; i++) { const v = pz[y]?.[i] || 0; row[`m_${y}_${i}`] = v; total += v; }
      const cerrados = (pz[anio] || []).slice(0, mesActual - 1).filter((v) => v > 0);
      row.promedio = cerrados.length ? cerrados.reduce((a, b) => a + b, 0) / cerrados.length : 0;
      row.total = total;
      const ytdA = (pz[anio] || []).slice(0, mesActual).reduce((a, b) => a + b, 0), ytdP = (pz[anioPrev] || []).slice(0, mesActual).reduce((a, b) => a + b, 0);
      row.ytdPz = ytdA; row.ytdPzPrev = ytdP; row.yoy = pctDelta(ytdA, ytdP);
      const e = erpMap.get(`${r.sku}|${anio}`);
      row.mc = e && e.pct_mc != null ? Number(e.pct_mc) * 100 : null; row.factNeta = e ? N(e.fact_neta) : 0; row.contrib = e ? N(e.contribucion) : 0;
      rows.push(row);
    }
    if (orden?.col) {
      const f = orden.dir === 'asc' ? 1 : -1;
      const str = new Set(['marca', 'sku', 'descripcion', 'rdmp']);
      rows.sort((a, b) => (str.has(orden.col) ? String(a[orden.col] || '').localeCompare(String(b[orden.col] || '')) : ((a[orden.col] ?? -Infinity) - (b[orden.col] ?? -Infinity))) * f);
    }
    return rows;
  }, [candidatos, sel, flags, aniosSelOrd, aniosFetch, anio, anioPrev, mesActual, erpMap, orden]);

  const totales = useMemo(() => {
    const t = { promedio: 0, total: 0, ytdPz: 0, ytdPzPrev: 0, factNeta: 0, contrib: 0 };
    for (const y of aniosSelOrd) for (let i = 0; i < 12; i++) t[`m_${y}_${i}`] = 0;
    for (const r of filas) { for (const y of aniosSelOrd) for (let i = 0; i < 12; i++) t[`m_${y}_${i}`] += r[`m_${y}_${i}`]; t.total += r.total; t.ytdPz += r.ytdPz; t.ytdPzPrev += r.ytdPzPrev; t.factNeta += r.factNeta; t.contrib += r.contrib; }
    const cerr = aniosSelOrd.includes(anio) ? Array.from({ length: Math.max(0, mesActual - 1) }, (_, i) => t[`m_${anio}_${i}`]).filter((v) => v > 0) : [];
    t.promedio = cerr.length ? cerr.reduce((a, b) => a + b, 0) / cerr.length : 0;
    t.yoy = pctDelta(t.ytdPz, t.ytdPzPrev);
    t.mc = t.factNeta ? (t.contrib / t.factNeta) * 100 : null;
    return t;
  }, [filas, aniosSelOrd, anio, mesActual]);
  const maxCelda = useMemo(() => { let m = 0; for (const r of filas) for (const y of aniosSelOrd) for (let i = 0; i < 12; i++) if (r[`m_${y}_${i}`] > m) m = r[`m_${y}_${i}`]; return m || 1; }, [filas, aniosSelOrd]);

  const onSort = (col) => setOrden((p) => (p?.col !== col ? { col, dir: 'desc' } : p.dir === 'desc' ? { col, dir: 'asc' } : null));
  const columnas = useMemo(() => {
    const cols = [
      { key: 'marca', label: 'Marca', align: 'left', width: 70, sort: true, maxWidth: 80, render: (r) => r.marca || '—' },
      { key: 'sku', label: 'SKU', align: 'left', width: 96, sort: true, mono: true, bold: true },
      { key: 'descripcion', label: 'Descripción', align: 'left', sort: true, maxWidth: 300, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
      { key: 'rdmp', label: 'Roadmap', align: 'center', width: 64, sort: true, render: (r) => (r.rdmp ? <Pill tone={roadmapTone(r.rdmp)} size="xs">{r.rdmp}</Pill> : <span style={{ color: theme.textSubtle }}>—</span>) },
    ];
    for (const y of aniosSelOrd) for (let i = 0; i < 12; i++) {
      const key = `m_${y}_${i}`;
      cols.push({ key, label: MESES[i], align: 'right', width: 44, sort: true, render: (r) => <HeatCell v={r[key]} max={maxCelda} />, renderTotal: (v) => (v ? fmtInt(v) : '—') });
    }
    cols.push({ key: 'promedio', label: `Prom ${String(anio).slice(2)}`, align: 'right', width: 58, sort: true, render: (r) => (r.promedio ? fmtInt(r.promedio) : '—'), renderTotal: (v) => (v ? fmtInt(v) : '—') });
    cols.push({ key: 'total', label: 'Total', align: 'right', width: 64, sort: true, bold: true, render: (r) => fmtInt(r.total), renderTotal: (v) => fmtInt(v) });
    cols.push({ key: 'yoy', label: 'Δ YoY', align: 'right', width: 70, sort: true, render: (r) => (r.ytdPz || r.ytdPzPrev ? <span title={`ene–${MESES[mesActual - 1]}: ${fmtInt(r.ytdPz)} vs ${fmtInt(r.ytdPzPrev)} pz`}><DeltaPill value={r.yoy} /></span> : <span style={{ color: theme.textSubtle }}>—</span>), renderTotal: (v) => <DeltaPill value={v} /> });
    if (sensible) cols.push({ key: 'mc', label: `MC % ${String(anio).slice(2)}`, align: 'right', width: 62, sort: true, render: (r) => (r.mc == null ? <span style={{ color: theme.textSubtle }}>{lErp ? '…' : '—'}</span> : <span style={{ color: r.mc >= 25 ? green : r.mc >= 15 ? theme.text : orange, fontWeight: 600 }}>{fmtPct(r.mc, 1)}</span>), renderTotal: (v) => (v == null ? '—' : fmtPct(v, 1)) });
    return cols;
  }, [aniosSelOrd, maxCelda, sensible, anio, mesActual, theme, lErp]);
  const grupos2 = useMemo(() => [
    { label: '', colSpan: 4 },
    ...aniosSelOrd.map((y) => ({ label: y === anio ? `${y} · en curso` : y, colSpan: 12, color: anioColor(y, aniosSelOrd, theme) })),
    { label: '', colSpan: 3 + (sensible ? 1 : 0) },
  ], [aniosSelOrd, anio, theme, sensible]);

  // ── Excel ──
  const excel = () => {
    const columnasX = [
      { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 10 }, { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 14 }, { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 50 },
      { label: 'Categoría', key: 'categoriaCap', tipo: 'texto', ancho: 16 }, { label: 'Roadmap', key: 'rdmp', tipo: 'texto', ancho: 9 },
      ...aniosSelOrd.flatMap((y) => MESES.map((m, i) => ({ label: `${m} ${y}`, key: `m_${y}_${i}`, tipo: 'numero', ancho: 8 }))),
      { label: `Prom ${anio}`, key: 'promedio', tipo: 'numero', ancho: 10 }, { label: 'Total', key: 'total', tipo: 'numero', ancho: 10 }, { label: 'Δ YoY %', key: 'yoy', tipo: 'numero', ancho: 9 },
      ...(sensible ? [{ label: `MC % ${anio}`, key: 'mc', tipo: 'numero', ancho: 9 }] : []),
    ];
    const filasX = filas.map((r) => { const o = { marca: r.marca || '', sku: r.sku, descripcion: r.descripcion || '', categoriaCap: r.categoriaCap || '', rdmp: r.rdmp || '', promedio: Math.round(r.promedio) || null, total: r.total || null, yoy: r.yoy != null ? Math.round(r.yoy) : null, mc: r.mc != null ? Math.round(r.mc * 10) / 10 : null }; aniosSelOrd.forEach((y) => MESES.forEach((_, i) => { o[`m_${y}_${i}`] = r[`m_${y}_${i}`] || null; })); return o; });
    const totalesX = { marca: 'TOTAL', sku: `${filas.length} SKUs`, promedio: Math.round(totales.promedio) || null, total: totales.total, yoy: totales.yoy != null ? Math.round(totales.yoy) : null, mc: totales.mc != null ? Math.round(totales.mc * 10) / 10 : null };
    aniosSelOrd.forEach((y) => MESES.forEach((_, i) => { totalesX[`m_${y}_${i}`] = totales[`m_${y}_${i}`] || null; }));
    return { titulo: `Sell In consolidado${consolidado ? '' : ' · Clientes clave'}`, archivo: `Sell In consolidado ${aniosSelOrd.join('-')}`, hojas: [{ nombre: 'Detalle por SKU', subtitulo: `${aniosSelOrd.join(' · ')}${activos ? ` · ${activos} filtro${activos === 1 ? '' : 's'}` : ''}${busqueda ? ` · "${busqueda}"` : ''}`, columnas: columnasX, filas: filasX, totales: totalesX }] };
  };

  if (loading) return <Cargando pantalla="sellInGlobal" label="Cargando Sell In consolidado…" sub="Facturación por canal, roadmap y cuotas" minHeight={520} />;
  if (eFact) return <div style={{ padding: 20, color: red, fontFamily: TYPO.fontText }}>No se pudo cargar la facturación: {String(eFact.message || eFact)}</div>;

  const segAnios = (
    <div role="group" aria-label="Años" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: 2, background: theme.mode === 'dark' ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)', borderRadius: 9, height: 30 }}>
      {aniosDisponibles.map((y) => { const on = aniosSel.has(y); const col = anioColor(y, aniosSelOrd, theme); return (
        <button key={y} type="button" onClick={() => toggleAnio(y)} aria-pressed={on} title={on ? 'Quitar año' : 'Agregar año'}
          style={{ padding: '4px 12px', borderRadius: 7, cursor: 'pointer', border: 0, background: on ? (theme.mode === 'dark' ? 'rgba(99,99,102,0.9)' : '#FFFFFF') : 'transparent', color: on ? col : (theme.mode === 'dark' ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)'), boxShadow: on ? '0 3px 8px rgba(0,0,0,0.12), 0 3px 1px rgba(0,0,0,0.04)' : 'none', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', transition: 'all 180ms cubic-bezier(0.4,0,0.2,1)' }}>{y}</button>
      ); })}
    </div>
  );

  return (
    <div ref={rootRef} data-stagger style={{ padding: '10px 6px', display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Hero */}
      <Hero eyebrow={`Dirección Comercial · Sell In consolidado · ${mesLargo} ${anio}`} titulo={frase}
        sub={`Facturación de todos los clientes y canales (ERP) · cuota ${cuotas.fuente === 'cuotas_canales' ? 'anual TOTAL / 12' : 'Σ cuota ideal de los clientes'} · ${fmtInt(global.skusAnio)} SKUs con venta en ${anio}`}
        stats={[
          { k: `${MESES[mesActual - 1]} MTD`, medida: tooltip('fact_neta', 'MTD'), v: fmtMoneyShort(mtd), sub: cuotaMes ? `${pctMTD.toFixed(0)} % de ${fmtMoneyShort(cuotaMes)}` : `${fmtInt(mtdPz)} pz`, color: pctMTD == null ? undefined : pctMTD >= 100 ? green : pctMTD < 60 ? orange : undefined },
          { k: `YTD ${anio}`, medida: tooltip('fact_neta', `YTD ${anio}`), v: fmtMoneyShort(ytd), sub: yoyYtd != null ? `${yoyYtd >= 0 ? '↑' : '↓'} ${Math.abs(yoyYtd).toFixed(1)} % vs ${anioPrev}` : `${fmtInt(ytdPz)} pz`, color: yoyYtd == null ? undefined : yoyYtd >= 0 ? green : red },
          { k: 'Cuota del mes', medida: tooltip('cuota_venta'), v: cuotaMes ? fmtMoneyShort(cuotaMes) : '—', sub: cuotaMes ? `faltan ${fmtMoneyShort(Math.max(0, cuotaMes - mtd))}` : 'sin cuota cargada' },
        ]}>
        <div style={{ marginTop: 10, maxWidth: 460 }}>
          <div style={{ position: 'relative', height: 5, borderRadius: 999, background: theme.mode === 'dark' ? 'rgba(29,29,31,0.16)' : 'rgba(245,245,247,0.18)', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', inset: '0 auto 0 0', width: `${Math.min(100, Math.max(0, pctMTD ?? 0))}%`, background: pctMTD == null ? theme.textMuted : pctMTD >= 100 ? green : pctMTD >= 85 ? blue : pctMTD >= 60 ? orange : red, borderRadius: 999, transition: 'width 600ms cubic-bezier(0.32,0.72,0,1)' }} />
            {pctMTD != null && <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${Math.min(100, (hoy.getDate() / diasMes) * 100)}%`, width: 1, background: theme.mode === 'dark' ? 'rgba(29,29,31,0.6)' : 'rgba(245,245,247,0.7)' }} title="Avance del calendario" />}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
            <Boton primario icon={Share2} onClick={onCompartirResumen} title="WhatsApp / compartir · sin datos sensibles">Compartir resumen del mes por canal</Boton>
            <Boton icon={Copy} onClick={onCopiarResumen} title="Copiar el resumen">Copiar</Boton>
            <span style={{ fontSize: 10.5, color: theme.mode === 'dark' ? 'rgba(29,29,31,0.66)' : 'rgba(245,245,247,0.66)' }}>{canales.length} canales · día {hoy.getDate()} de {diasMes}</span>
          </div>
        </div>
      </Hero>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard medida={tooltip('pct_alcance_venta')} eyebrow={`${mesLargo} MTD`} badge={{ l: pctMTD != null ? `${pctMTD.toFixed(0)} % cuota` : 'sin cuota', tone: tonoPct(pctMTD) }} big={fmtMoneyShort(mtd)} bigSmall={cuotaMes ? `/ ${fmtMoneyShort(cuotaMes)}` : undefined} sub={`${fmtInt(mtdPz)} piezas`} progress={pctMTD ?? undefined} />
        <KpiCard medida={tooltip('pct_alcance_venta', 'YTD')} eyebrow={`YTD ${anio} · ene–${MESES[mesActual - 1]}`} badge={{ l: pctYTD != null ? `${pctYTD.toFixed(0)} % cuota` : 'sin cuota', tone: tonoPct(pctYTD) }} big={fmtMoneyShort(ytd)} bigSmall={cuotas.ytd ? `/ ${fmtMoneyShort(cuotas.ytd)}` : undefined} sub={`${fmtInt(ytdPz)} piezas · ${fmtInt(global.skusAnio)} SKUs`} progress={pctYTD ?? undefined} />
        <KpiCard eyebrow={`${mesLargo} vs ${anioPrev} · YoY`} badge={yoyMes != null ? { l: `${yoyMes >= 0 ? '↑' : '↓'} ${Math.abs(yoyMes).toFixed(1)} %`, tone: yoyMes >= 0 ? 'green' : 'red' } : undefined} big={fmtMoneyShort(mtd)} bigSmall={`vs ${fmtMoneyShort(mtdPrev)}`} bigColor={yoyMes == null ? undefined : yoyMes >= 0 ? green : red} sub={mtdPzPrev ? `${mtdPz >= mtdPzPrev ? '↑' : '↓'} ${fmtInt(Math.abs(mtdPz - mtdPzPrev))} pz vs ${MESES[mesActual - 1]} ${anioPrev}` : `${fmtInt(mtdPz)} pz`} />
        <KpiCard eyebrow={`vs ${momLabel} · MoM`} badge={mom != null ? { l: `${mom >= 0 ? '↑' : '↓'} ${Math.abs(mom).toFixed(1)} %`, tone: mom >= 0 ? 'green' : 'red' } : undefined} big={fmtMoneyShort(mtd)} bigSmall={`vs ${fmtMoneyShort(momPrev)}`} bigColor={mom == null ? undefined : mom >= 0 ? green : red} sub={momPzPrev ? `${mtdPz >= momPzPrev ? '↑' : '↓'} ${fmtInt(Math.abs(mtdPz - momPzPrev))} pz · mes completo vs parcial` : `${fmtInt(mtdPz)} pz`} />
      </div>

      {/* Comparador de periodos */}
      <ComparadorPeriodos clienteKey={null} ocultarSensible={!sensible} />

      {/* Evolución mensual + composición por familia */}
      <Panel titulo="Evolución mensual" meta={`${anio} vs ${anioPrev} · monto facturado${familiaSel ? ` · familia ${familiaSel}` : ''}`}
        acciones={familiaSel ? <Boton size="sm" icon={RotateCcw} onClick={() => setFamiliaSel(null)}>Todas las familias</Boton> : null}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 20 }}>
          <GraficaLineas datos={chartData.map((d) => ({ x: d.mes, act: d.act, prev: d.prev, cuota: d.cuota }))}
            series={[{ key: 'act', label: String(anio), tipo: 'principal' }, { key: 'prev', label: String(anioPrev), tipo: 'anterior' }, ...(cuotas.anual > 0 && !familiaSel ? [{ key: 'cuota', label: 'Cuota', tipo: 'cuota' }] : [])]}
            formato={fmtMoneyShort} alto={210} mesActivo={mesActual - 1} />
          <div style={{ borderLeft: `1px solid ${theme.divider || theme.border}`, paddingLeft: 18, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text }}>Composición por familia · YTD</span>
              <span style={{ fontSize: 10, color: theme.textMuted }}>{familias.length} · clic filtra</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '108px minmax(0, 1fr)', gap: 12, alignItems: 'center' }}>
              <div style={{ position: 'relative', width: 108, height: 108 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={familias} dataKey="monto" cx="50%" cy="50%" innerRadius={34} outerRadius={52} paddingAngle={1} stroke="none" onClick={(d) => setFamiliaSel(familiaSel === d.name ? null : d.name)} cursor="pointer" isAnimationActive={false}>
                      {familias.map((c, i) => <Cell key={i} fill={c.color} opacity={familiaSel && familiaSel !== c.name ? 0.25 : 1} stroke={familiaSel === c.name ? theme.text : 'none'} strokeWidth={familiaSel === c.name ? 2 : 0} />)}
                    </Pie>
                    <Tooltip formatter={(v) => formatMXN(v)} contentStyle={{ fontSize: 11, borderRadius: 8, background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div style={{ fontSize: 8, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', maxWidth: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{familiaSel || 'Total'}</div>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{fmtMoneyShort(familiaSel ? familias.find((f) => f.name === familiaSel)?.monto || 0 : ytd)}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 2 }}>
                {familias.slice(0, 6).map((c, i) => { const on = familiaSel === c.name; return (
                  <div key={c.name} onClick={() => setFamiliaSel(on ? null : c.name)} style={{ display: 'grid', gridTemplateColumns: '14px 6px minmax(0,1fr) 56px 40px', alignItems: 'center', gap: 6, padding: '2px 4px', borderRadius: 6, cursor: 'pointer', background: on ? (theme.surfaceHover || 'rgba(0,0,0,0.04)') : 'transparent', opacity: familiaSel && !on ? 0.5 : 1, transition: 'background 120ms, opacity 120ms' }}>
                    <span style={{ fontSize: 9, color: theme.textSubtle, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>#{i + 1}</span>
                    <span style={{ width: 6, height: 6, borderRadius: 2, background: c.color }} />
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${c.name} · ${c.skus} SKUs`}>{c.name}</span>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{fmtMoneyShort(c.monto)}</span>
                    <span style={{ fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>{c.pct.toFixed(1)}%</span>
                  </div>
                ); })}
                {familias.length > 6 && <div style={{ padding: '2px 4px 0 26px', fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>+ {familias.length - 6} familias más</div>}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      {/* Tabla por SKU */}
      <Panel titulo="Detalle por SKU" meta={`${fmtInt(filas.length)} de ${fmtInt(candidatos.length)} SKUs · piezas · orden ${orden ? 'personalizado' : 'roadmap'}`} padding="8px 10px 10px"
        acciones={(
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {orden && <Boton icon={RotateCcw} onClick={() => setOrden(null)} title="Volver al orden del roadmap">Orden roadmap</Boton>}
            {segAnios}
            <Segmented value={consolidado ? 'todos' : 'clave'} onChange={(v) => setConsolidado(v === 'todos')}
              options={[{ id: 'todos', label: 'Todos los canales', title: 'Todos los clientes y canales del ERP' }, { id: 'clave', label: 'Clientes clave', title: 'Sólo Digitalife, PCEL y Dicotech' }]} />
            <ExportMenu titulo="Sell In consolidado" subtitulo={aniosSelOrd.join(' · ')} excel={excel} pdf={{ ref: rootRef }} deshabilitado={!filas.length} />
          </div>
        )}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <Buscador value={busqueda} onChange={setBusqueda} resultados={`${filas.length} SKU${filas.length === 1 ? '' : 's'}`} />
            <span style={{ fontSize: 10.5, color: theme.textMuted }}>Cualquier palabra, cualquier orden, sin acentos · descripción, marca, categoría, familia, roadmap o parte del SKU</span>
          </div>
          <Filtros grupos={grupos} toggles={togglesFiltro} onToggle={onToggleSel} onToggleFlag={(id) => setFlags((f) => ({ ...f, [id]: !f[id] }))} onLimpiar={limpiar} activos={activos} />
          <TablaCompacta columnas={columnas} grupos={grupos2} filas={filas} rowKey={(r) => r.sku} totales={totales} maxHeight="72vh" dense
            orden={orden || undefined} onSort={onSort} onRowClick={(r) => setSkuAbierto((s) => (s === r.sku ? null : r.sku))} expandidoKey={skuAbierto}
            vacio={busqueda || activos ? 'Ningún SKU coincide con la búsqueda y los filtros.' : 'Sin SKUs en el roadmap.'}
            renderExpandido={(r) => <DrillSku sku={r.sku} info={r} anio={anio} anioPrev={anioPrev} mesActual={mesActual} sensible={sensible} />} />
        </div>
      </Panel>
    </div>
  );
}
