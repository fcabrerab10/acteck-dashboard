// ForecastReservas.jsx — Reservas por cliente
//
// Objetivo: ver cuántas piezas necesita cada cliente (Digitalife/PCEL/Dicotech)
// para el mes objetivo, cotejar contra próximos arribos de Acteck y armar una
// propuesta de reservas que se guarda en Supabase (workflow: Borrador → Generada → Cerrada).
//
// Fuentes:
//   sellout_sku          → velocity SO últimos 6m por (cliente, sku)
//   cuotas_mensuales     → cuota del mes objetivo (para banda info)
//   facturacion_clientes → sell-in MTD para cuota restante
//   embarques_compras    → arribos próximos 3 meses (agrupado por mes)
//   roadmap_sku          → descripción, marca, familia, roadmap
//   forecast_propuestas + forecast_propuesta_lineas → persistencia

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import { usePerfil } from '../../lib/perfilContext';
import { Search, ChevronDown, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

const NOMBRES_MES = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', short: 'DGL', txt: '#6B6B70', txtDark: '#A1A1A6' },
  { key: 'pcel',       label: 'PCEL',       short: 'PCE', txt: '#6B6B70', txtDark: '#A1A1A6' },
  { key: 'dicotech',   label: 'Dicotech',   short: 'DCT', txt: '#6B6B70', txtDark: '#A1A1A6' },
];
const LIME = '#CDE64A';

// Paginación estándar. Requiere `.order()` en la query para que PostgREST
// devuelva chunks estables — sin order puede repetir/skipar filas o loopar.
async function fetchAll(qFactory, orderCol = 'id', pageSize = 1000) {
  const acc = [];
  let from = 0;
  const MAX_ITERS = 100; // guardrail: 100 * 1000 = 100k filas máximo
  for (let i = 0; i < MAX_ITERS; i++) {
    const q = qFactory().order(orderCol, { ascending: true }).range(from, from + pageSize - 1);
    const { data, error } = await q;
    if (error) throw error;
    if (!data || data.length === 0) break;
    acc.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}

function fmtInt(n) { return (Math.round(Number(n) || 0)).toLocaleString('es-MX'); }
function fmtNum(n) { const v = Math.round(Number(n) || 0); return v === 0 ? '—' : v.toLocaleString('es-MX'); }
function toISO(d) { return d.toISOString().slice(0, 10); }

export default function ForecastReservas() {
  const { theme, isDark } = useTheme();
  const perfil = usePerfil();
  const yoId = perfil?.user_id || null;

  const hoy = useMemo(() => new Date(), []);
  const anioObj = hoy.getFullYear();
  const mesObj = hoy.getMonth() + 1;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Datos base
  const [roadmap, setRoadmap] = useState([]); // sku, descripcion, marca, familia, rdmp
  const [sellout, setSellout] = useState([]); // sellout_sku 6m
  const [cuotas, setCuotas] = useState([]);
  const [facturacion, setFacturacion] = useState([]);
  const [arribos, setArribos] = useState([]); // embarques_compras próximos 3m

  // Propuesta activa (borrador único por usuario)
  const [propuesta, setPropuesta] = useState(null); // { id, nombre, estatus, ... }
  const [lineas, setLineas] = useState({});         // { sku: { reservo, confirmado, estado, id } }

  // UI state
  const [busqueda, setBusqueda] = useState('');
  const [soloConBrecha, setSoloConBrecha] = useState(true);
  const [saving, setSaving] = useState(false);

  const bandArr = 'transparent';
  const groupSep = isDark ? '#232326' : '#E5E5E9';

  // ─── Fetch inicial ──────────────────────────────────────────
  useEffect(() => {
    if (!DB_CONFIGURED) return;
    let cancelled = false;
    (async () => {
      setLoading(true); setError(null);
      try {
        // Ventana 6 meses hacia atrás
        const seis = new Date(hoy); seis.setMonth(seis.getMonth() - 6);
        const anioMin = seis.getFullYear();

        // Ventana próximos 3 meses para arribos
        const trecs = new Date(hoy); trecs.setMonth(trecs.getMonth() + 3);

        // Fetch en paralelo, cada uno con manejo propio (no aborta todo si uno falla)
        const [rmRes, soRows, ctRes, faRows, embRows, propRes] = await Promise.all([
          supabase.from('roadmap_sku').select('sku, descripcion, marca, familia, rdmp, sort_order').order('sort_order', { ascending: true, nullsFirst: false }),
          fetchAll(() => supabase.from('sellout_sku')
            .select('cliente, anio, mes, sku, piezas')
            .gte('anio', anioMin)).catch(e => { console.error('sellout_sku:', e); return []; }),
          supabase.from('cuotas_mensuales')
            .select('cliente, anio, mes, cuota_min, cuota_ideal')
            .eq('anio', anioObj).eq('mes', mesObj),
          fetchAll(() => supabase.from('facturacion_clientes')
            .select('cliente_key, sku, piezas, anio, mes')
            .eq('anio', anioObj).eq('mes', mesObj)).catch(e => { console.error('facturacion_clientes:', e); return []; }),
          // arribo_almacen está vacío en toda la tabla — usamos fallback:
          // arribo_cedis (3.5k filas) o eta_puerto (4.1k filas)
          fetchAll(() => supabase.from('embarques_compras')
            .select('codigo, arribo_almacen, arribo_cedis, eta_puerto, po_qty, shp_qty, contenedor'))
            .catch(e => { console.error('embarques_compras:', e); return []; }),
          // Propuesta activa: 2 queries separadas para no depender de FK-embed de PostgREST
          yoId
            ? supabase.from('forecast_propuestas')
                .select('*')
                .eq('creado_por', yoId).eq('estatus', 'borrador')
                .order('created_at', { ascending: false }).limit(1).maybeSingle()
                .then(r => r).catch(e => { console.error('forecast_propuestas:', e); return { data: null }; })
            : Promise.resolve({ data: null }),
        ]);

        if (cancelled) return;

        if (rmRes.error) throw new Error('roadmap_sku: ' + rmRes.error.message);
        if (ctRes.error) console.warn('cuotas_mensuales:', ctRes.error.message);

        setRoadmap(rmRes.data || []);
        setSellout(soRows || []);
        setCuotas(ctRes.data || []);
        setFacturacion(faRows || []);
        setArribos(embRows || []);

        // Propuesta activa: si existe, cargar sus líneas en query separada
        if (propRes.data) {
          setPropuesta(propRes.data);
          const { data: linRows, error: linErr } = await supabase
            .from('forecast_propuesta_lineas').select('*').eq('propuesta_id', propRes.data.id);
          if (linErr) console.warn('forecast_propuesta_lineas:', linErr.message);
          const lin = {};
          for (const l of (linRows || [])) lin[l.sku] = l;
          setLineas(lin);
        } else {
          setPropuesta(null);
          setLineas({});
        }
      } catch (e) {
        if (!cancelled) setError(e.message || String(e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [yoId, anioObj, mesObj]);

  // ─── Cálculos ──────────────────────────────────────────────
  // Velocity SO por (cliente, sku) = promedio piezas últimos 6 meses completos
  const velocity = useMemo(() => {
    const map = new Map(); // key = `${cliente}|${sku}` → { total, meses:Set }
    for (const r of sellout) {
      const cli = r.cliente, sku = r.sku;
      if (!cli || !sku) continue;
      const k = `${cli}|${sku}`;
      const key = `${r.anio}-${r.mes}`;
      const cur = map.get(k) || { total: 0, meses: new Set() };
      cur.total += Number(r.piezas) || 0;
      cur.meses.add(key);
      map.set(k, cur);
    }
    const out = {};
    for (const [k, v] of map) {
      const n = Math.max(v.meses.size, 1);
      out[k] = v.total / n;
    }
    return out;
  }, [sellout]);

  // Arribos: agrupar por (sku, año-mes). Fallback de fecha:
  //   arribo_almacen → arribo_cedis → eta_puerto
  const arribosPorSku = useMemo(() => {
    const map = new Map();
    for (const e of arribos) {
      if (!e.codigo) continue;
      const fecha = e.arribo_almacen || e.arribo_cedis || e.eta_puerto;
      if (!fecha) continue;
      const d = new Date(fecha);
      if (isNaN(d)) continue;
      const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
      const qty = Number(e.shp_qty) || Number(e.po_qty) || 0;
      const cur = map.get(e.codigo) || {};
      cur[key] = (cur[key] || 0) + qty;
      map.set(e.codigo, cur);
    }
    return map;
  }, [arribos]);

  // Próximos 3 meses (labels y keys) desde hoy
  const proxMeses = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 3; i++) {
      const d = new Date(hoy); d.setDate(1); d.setMonth(d.getMonth() + i);
      arr.push({ key: `${d.getFullYear()}-${d.getMonth() + 1}`, label: NOMBRES_MES[d.getMonth() + 1] });
    }
    return arr;
  }, [hoy]);

  // Filas: para cada SKU en roadmap con velocity > 0 en algún cliente
  const filasBase = useMemo(() => {
    const rows = [];
    const skusVistos = new Set();
    for (const rm of roadmap) {
      if (!rm.sku || skusVistos.has(rm.sku)) continue;
      skusVistos.add(rm.sku);

      const vDgl = Math.round(velocity[`digitalife|${rm.sku}`] || 0);
      const vPce = Math.round(velocity[`pcel|${rm.sku}`] || 0);
      const vDct = Math.round(velocity[`dicotech|${rm.sku}`] || 0);
      const totalNec = vDgl + vPce + vDct;
      if (totalNec === 0 && !lineas[rm.sku]) continue;

      const arr = arribosPorSku.get(rm.sku) || {};
      const arrPorMes = {};
      for (const m of proxMeses) arrPorMes[m.key] = arr[m.key] || 0;

      rows.push({
        sku: rm.sku,
        descripcion: rm.descripcion || rm.sku,
        marca: rm.marca || '',
        familia: rm.familia || '',
        roadmap: (rm.rdmp || '').toUpperCase(),
        sort_order: rm.sort_order,
        necesidad_dgl: vDgl,
        necesidad_pce: vPce,
        necesidad_dct: vDct,
        recomendado: totalNec,
        arribosPorMes: arrPorMes,
      });
    }
    // Orden por defecto del roadmap (sort_order)
    return rows;
  }, [roadmap, velocity, arribosPorSku, proxMeses, lineas]);

  const filasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return filasBase.filter(r => {
      if (soloConBrecha && r.recomendado === 0) return false;
      if (!q) return true;
      return (r.sku + ' ' + r.descripcion + ' ' + r.marca + ' ' + r.familia).toLowerCase().includes(q);
    });
  }, [filasBase, busqueda, soloConBrecha]);

  // KPIs hero
  const kpis = useMemo(() => {
    const totalRecom = filasBase.reduce((a, r) => a + r.recomendado, 0);
    const totalReservo = Object.values(lineas).reduce((a, l) => a + (Number(l.reservo) || 0), 0);
    const skusConBrecha = filasBase.length;
    const skusEnPropuesta = Object.keys(lineas).length;
    const proxArribo = arribos
      .map(e => e.arribo_almacen)
      .filter(Boolean)
      .sort()[0] || null;
    return { totalRecom, totalReservo, skusConBrecha, skusEnPropuesta, proxArribo };
  }, [filasBase, lineas, arribos]);

  // ─── Persistencia ──────────────────────────────────────────
  // Asegurar propuesta activa (crea borrador si no existe)
  const asegurarPropuesta = useCallback(async () => {
    if (propuesta) return propuesta;
    const nombre = `Preventa & Reservas · ${NOMBRES_MES[mesObj]} ${anioObj}`;
    const { data, error } = await supabase.from('forecast_propuestas')
      .insert({ nombre, estatus: 'borrador', meta_anio: anioObj, meta_mes: mesObj, creado_por: yoId })
      .select().single();
    if (error) { alert('No se pudo crear propuesta: ' + error.message); throw error; }
    setPropuesta(data);
    return data;
  }, [propuesta, mesObj, anioObj, yoId]);

  // Guarda/actualiza una línea (reservo o confirmado)
  const upsertLinea = useCallback(async (fila, patch) => {
    const p = await asegurarPropuesta();
    const existing = lineas[fila.sku];
    const payload = {
      propuesta_id: p.id,
      sku: fila.sku,
      descripcion: fila.descripcion,
      marca: fila.marca,
      familia: fila.familia,
      roadmap: fila.roadmap,
      necesidad_dgl: fila.necesidad_dgl,
      necesidad_pce: fila.necesidad_pce,
      necesidad_dct: fila.necesidad_dct,
      recomendado: fila.recomendado,
      arribos_snapshot: fila.arribosPorMes,
      estado: existing?.estado || 'draft',
      reservo: existing?.reservo || 0,
      confirmado: existing?.confirmado ?? null,
      ...patch,
    };
    // Optimistic update
    setLineas(prev => ({ ...prev, [fila.sku]: { ...(prev[fila.sku] || {}), ...payload } }));

    const { data, error } = await supabase.from('forecast_propuesta_lineas')
      .upsert(payload, { onConflict: 'propuesta_id,sku' }).select().single();
    if (error) {
      alert('No se pudo guardar: ' + error.message);
      return;
    }
    setLineas(prev => ({ ...prev, [fila.sku]: data }));
  }, [lineas, asegurarPropuesta]);

  const eliminarLinea = useCallback(async (sku) => {
    const l = lineas[sku];
    if (!l?.id) { setLineas(prev => { const c = { ...prev }; delete c[sku]; return c; }); return; }
    setLineas(prev => { const c = { ...prev }; delete c[sku]; return c; });
    await supabase.from('forecast_propuesta_lineas').delete().eq('id', l.id);
  }, [lineas]);

  const generarPropuesta = useCallback(async () => {
    if (!propuesta) { alert('No hay líneas en la propuesta.'); return; }
    if (Object.keys(lineas).length === 0) { alert('Agrega al menos un SKU antes de generar la propuesta.'); return; }
    setSaving(true);
    const { error } = await supabase.from('forecast_propuestas')
      .update({ estatus: 'generada', generado_at: new Date().toISOString() })
      .eq('id', propuesta.id);
    setSaving(false);
    if (error) { alert('Error: ' + error.message); return; }
    // Marcar todas las líneas draft como pend_confirmar
    await supabase.from('forecast_propuesta_lineas')
      .update({ estado: 'pend_confirmar' })
      .eq('propuesta_id', propuesta.id).eq('estado', 'draft');
    // Refrescar
    const { data: refreshed } = await supabase.from('forecast_propuestas')
      .select('*, forecast_propuesta_lineas(*)').eq('id', propuesta.id).single();
    if (refreshed) {
      setPropuesta(refreshed);
      const lin = {};
      for (const l of (refreshed.forecast_propuesta_lineas || [])) lin[l.sku] = l;
      setLineas(lin);
    }
  }, [propuesta, lineas]);

  const vaciarPropuesta = useCallback(async () => {
    if (!propuesta) return;
    if (!confirm('¿Vaciar todas las líneas de la propuesta actual?')) return;
    await supabase.from('forecast_propuesta_lineas').delete().eq('propuesta_id', propuesta.id);
    setLineas({});
  }, [propuesta]);

  // ─── Render ───────────────────────────────────────────────
  if (!DB_CONFIGURED) return <div style={{ padding: 40, color: theme.textMuted }}>DB no configurada.</div>;
  if (loading) return <div style={{ padding: 40 }}><FerrutekLoader label="Cargando forecast…" /></div>;
  if (error) return (
    <div style={{ padding: 20, maxWidth: 720, margin: '40px auto', background: '#FBECEA', border: '1px solid #C0392B', borderRadius: 12, color: '#C0392B' }}>
      <b style={{ fontFamily: TYPO.fontDisplay, fontSize: 14 }}>Error cargando forecast</b>
      <pre style={{ fontSize: 11, marginTop: 8, whiteSpace: 'pre-wrap' }}>{error}</pre>
      <button onClick={() => location.reload()} style={{ marginTop: 8, padding: '6px 14px', borderRadius: 999, background: '#C0392B', color: '#FFF', border: 0, cursor: 'pointer', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600 }}>Reintentar</button>
    </div>
  );

  const step = propuesta?.estatus === 'generada' ? 3 : (Object.keys(lineas).length > 0 ? 2 : 1);

  return (
    <div style={{ padding: '20px 20px 60px', maxWidth: 1520, margin: '0 auto' }}>

      {/* Hero editorial · estilo S&OP */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: 24,
        background: '#0A0A0A', color: '#F5F5F7',
        borderRadius: 14, padding: '18px 22px', marginBottom: 12,
        alignItems: 'center',
      }}>
        <div>
          <p style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: 'rgba(255,255,255,0.55)', fontWeight: 500, fontFamily: TYPO.fontText, margin: 0,
          }}>
            Dirección Comercial · Forecast · {NOMBRES_MES[mesObj]} {anioObj}
          </p>
          <h2 style={{
            fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em',
            color: '#F5F5F7', margin: '4px 0 6px', lineHeight: 1.15,
          }}>
            Reservas de arribos por cliente.
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.72)', fontSize: 12, lineHeight: 1.55, margin: 0, maxWidth: 600,
            fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums',
          }}>
            <strong style={{ color: '#F5F5F7', fontWeight: 500 }}>{filasBase.length} SKUs</strong>.
            {kpis.skusConBrecha > 0 && <> <strong style={{ color: '#FF6961', fontWeight: 500 }}>{kpis.skusConBrecha} con brecha</strong>,</>}
            {kpis.skusEnPropuesta > 0 && <> <strong style={{ color: '#F5F5F7', fontWeight: 500 }}>{kpis.skusEnPropuesta} en propuesta</strong>,</>}
            {' '}Arma tu propuesta seleccionando SKUs con la cantidad que reservarás en Acteck.
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px' }}>
          <HeroStat label="SKUs c/ brecha" value={fmtInt(kpis.skusConBrecha)} sub={`${fmtInt(kpis.totalRecom)} pz recom.`} color="#FF6961" />
          <HeroStat label="Propuesta activa" value={`${fmtInt(kpis.totalReservo)} pz`} sub={`${kpis.skusEnPropuesta} SKUs`} color="#F5F5F7" />
          <HeroStat label="Próx. arribo" value={kpis.proxArribo ? new Date(kpis.proxArribo).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'} sub={`${arribos.length} embarques 3m`} color="#34D158" />
          <HeroStat label="Método" value="Velocity 6m" sub="promedio sell-out" color="#F5F5F7" />
        </div>
      </div>

      {/* Workflow */}
      <div style={{ display: 'flex', alignItems: 'center', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 5, marginBottom: 14 }}>
        <StepChip theme={theme} n={1} lb="Borrador" sub={`${Object.keys(lineas).length} SKUs`} active={step === 1} done={step > 1} />
        <div style={{ width: 1, height: 20, background: theme.border, margin: '0 4px' }} />
        <StepChip theme={theme} n={2} lb="Generar propuesta de preventa & reservas" sub={propuesta?.generado_at ? 'Generada' : 'Se guarda en Landing'} active={step === 2} done={step > 2} />
        <div style={{ width: 1, height: 20, background: theme.border, margin: '0 4px' }} />
        <StepChip theme={theme} n={3} lb="Confirmar reservado" sub="" active={step === 3} done={false} />
      </div>

      {/* Layout main + sidebar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 320px', gap: 16, alignItems: 'start' }}>

        <div style={{ minWidth: 0 }}>

          {/* Card unificada: Header negro con buscador + tabla */}
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {/* Header negro con búsqueda inline */}
            <div style={{ background: '#0A0A0A', color: '#FFF', padding: '12px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
                <div>
                  <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: '#FFF' }}>Detalle por SKU</h3>
                  <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>
                    <b style={{ color: '#FFF', fontWeight: 600 }}>{filasFiltradas.length}</b> SKUs · click para drill · <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 999, background: '#5EABFF', verticalAlign: 'middle', marginRight: 4 }} />en propuesta
                  </div>
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: 'rgba(255,255,255,0.08)', borderRadius: 999, color: 'rgba(255,255,255,0.55)', fontSize: 12 }}>
                  <Search size={13} />
                  <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                    placeholder="Buscar SKU · descripción · marca · familia"
                    style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', color: '#FFF', fontFamily: TYPO.fontText, fontSize: 12 }} />
                </div>
                <button onClick={() => setSoloConBrecha(v => !v)}
                  style={{
                    padding: '7px 14px', borderRadius: 999,
                    border: `1px solid ${soloConBrecha ? '#5EABFF' : 'rgba(255,255,255,0.16)'}`,
                    background: soloConBrecha ? 'rgba(94,171,255,0.16)' : 'transparent',
                    color: soloConBrecha ? '#5EABFF' : 'rgba(255,255,255,0.72)',
                    fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: soloConBrecha ? 600 : 500, cursor: 'pointer',
                  }}>
                  {soloConBrecha ? '✓ ' : ''}Solo con brecha ({filasBase.length})
                </button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5, minWidth: 1100 }}>
                <thead>
                  <tr>
                    <Th theme={theme} l w={110}>SKU</Th>
                    <Th theme={theme} l>Descripción</Th>
                    <Th theme={theme} w={72}>Roadmap</Th>
                    <Th theme={theme} bl={groupSep} w={72}>Digitalife</Th>
                    <Th theme={theme} w={64}>PCEL</Th>
                    <Th theme={theme} w={72}>Dicotech</Th>
                    {proxMeses.map((m, i) => <Th key={m.key} theme={theme} bl={i === 0 ? groupSep : undefined} w={68}>Arribo {m.label}</Th>)}
                    <Th theme={theme} bl={groupSep} w={72} color={theme.accent}>Recom.</Th>
                    <Th theme={theme} w={112}>Reservo</Th>
                    <Th theme={theme} w={128}>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradas.map(f => {
                    const l = lineas[f.sku];
                    const enPropuesta = !!l;
                    return (
                      <tr key={f.sku} style={{
                        borderTop: `1px solid ${theme.divider || theme.hairline || theme.border}`,
                        background: enPropuesta ? 'rgba(0,122,255,0.03)' : 'transparent',
                        transition: 'background 160ms ease',
                      }}>
                        <Td theme={theme} l><span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11, color: theme.accent, fontWeight: 600 }}>{f.sku}</span></Td>
                        <Td theme={theme} l>
                          <div title={`${f.descripcion}${f.marca ? ' · ' + f.marca : ''}${f.familia ? ' · ' + f.familia : ''}`}
                            style={{ fontFamily: TYPO.fontText, fontWeight: 400, fontSize: 12, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 340 }}>
                            {f.descripcion || '—'}
                          </div>
                        </Td>
                        <Td theme={theme} c><RoadmapChip r={f.roadmap} /></Td>
                        <Td theme={theme} bl={groupSep}><NumCell n={f.necesidad_dgl} /></Td>
                        <Td theme={theme}><NumCell n={f.necesidad_pce} /></Td>
                        <Td theme={theme}><NumCell n={f.necesidad_dct} /></Td>
                        {proxMeses.map((m, i) => (
                          <Td key={m.key} theme={theme} bl={i === 0 ? groupSep : undefined}><NumCell n={f.arribosPorMes[m.key]} strong={f.arribosPorMes[m.key] > 0} /></Td>
                        ))}
                        <Td theme={theme} bl={groupSep}><span style={{ fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11.5, fontWeight: 700, color: theme.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(f.recomendado)}</span></Td>
                        <Td theme={theme}>
                          <ReservoInput
                            value={Number(l?.reservo) || 0}
                            recom={f.recomendado}
                            confirmado={l?.estado === 'confirmado' || l?.estado === 'parcial'}
                            accent={theme.accent}
                            onChange={(v) => {
                              if (v === 0 && l?.id) return eliminarLinea(f.sku);
                              if (v > 0) upsertLinea(f, { reservo: v, estado: propuesta?.estatus === 'generada' ? 'pend_confirmar' : 'draft' });
                            }}
                          />
                        </Td>
                        <Td theme={theme}><EstadoPill estado={l?.estado || 'draft'} confirmado={l?.confirmado} reservo={l?.reservo} recom={f.recomendado} accent={theme.accent} /></Td>
                      </tr>
                    );
                  })}
                  {filasFiltradas.length === 0 && (
                    <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: theme.textMuted }}>No hay SKUs que mostrar con los filtros actuales.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: 12, position: 'sticky', top: 20 }}>
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
            {/* Header negro */}
            <div style={{ background: '#0A0A0A', padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>Forecast · Reservas</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8, color: '#FFF' }}>
                  Mi Propuesta
                  {Object.keys(lineas).length > 0 && (
                    <span style={{ background: '#CDE64A', color: '#050505', fontSize: 10, padding: '1px 7px', borderRadius: 999, fontWeight: 700 }}>{Object.keys(lineas).length}</span>
                  )}
                </div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#8EE6AC', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#8EE6AC' }} />Autoguardado
              </span>
            </div>
            <div style={{ padding: '14px 16px 14px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.10em', fontWeight: 600, color: theme.textMuted, marginBottom: 4 }}>Nombre</div>
              <input
                value={propuesta?.nombre || `Preventa & Reservas · ${NOMBRES_MES[mesObj]} ${anioObj}`}
                onChange={async e => {
                  const p = await asegurarPropuesta();
                  setPropuesta(prev => ({ ...prev, nombre: e.target.value }));
                  await supabase.from('forecast_propuestas').update({ nombre: e.target.value }).eq('id', p.id);
                }}
                style={{ width: '100%', padding: '8px 10px', border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 8, fontSize: 12, fontFamily: TYPO.fontText, color: theme.text, outline: 'none' }} />
              <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6 }}>
                {Object.keys(lineas).length} SKUs · {propuesta?.estatus === 'generada' ? 'Generada' : 'Borrador'}
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', padding: '0 16px 16px', gap: 12 }}>
              <div style={{ padding: '12px 14px', background: isDark ? '#0F1830' : '#E7EEFF', borderRadius: 10 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.accent }}>Piezas</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: theme.accent, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(kpis.totalReservo)}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>de {fmtInt(kpis.totalRecom)} recom.</div>
              </div>
              <div style={{ padding: '12px 14px', background: isDark ? '#0F2B1E' : '#E4F5EB', borderRadius: 10 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#0F8F4F' }}>SKUs</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#0F8F4F', fontVariantNumeric: 'tabular-nums' }}>{Object.keys(lineas).length}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>en propuesta</div>
              </div>
            </div>
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button
                disabled={saving || Object.keys(lineas).length === 0 || propuesta?.estatus === 'generada'}
                onClick={generarPropuesta}
                style={{
                  width: '100%', padding: '9px 16px', borderRadius: 999,
                  background: propuesta?.estatus === 'generada' ? theme.border : '#0A0A0A',
                  color: '#FFF', border: 0, cursor: (saving || Object.keys(lineas).length === 0) ? 'not-allowed' : 'pointer',
                  fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
                  opacity: (saving || Object.keys(lineas).length === 0) ? 0.55 : 1,
                }}>
                {propuesta?.estatus === 'generada' ? '✓ Propuesta generada' : 'Generar propuesta →'}
              </button>
              <button onClick={vaciarPropuesta} disabled={Object.keys(lineas).length === 0}
                style={{ width: '100%', padding: '9px 16px', borderRadius: 999, background: theme.surface, color: theme.textMuted, border: `1px solid ${theme.border}`, cursor: Object.keys(lineas).length === 0 ? 'not-allowed' : 'pointer', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, opacity: Object.keys(lineas).length === 0 ? 0.5 : 1 }}>
                Vaciar propuesta
              </button>
            </div>
          </div>
        </aside>

      </div>

    </div>
  );
}

// ─── Sub-componentes ────────────────────────────────────────
function StepChip({ theme, n, lb, sub, active, done }) {
  const bg = active ? '#0A0A0A' : 'transparent';
  const color = active ? '#FFF' : theme.textMuted;
  const nBg = done ? '#0F8F4F' : (active ? '#CDE64A' : '#F0F0F2');
  const nColor = done ? '#FFF' : (active ? '#050505' : theme.textMuted);
  return (
    <div style={{ flex: 1, padding: '9px 14px', display: 'flex', alignItems: 'center', gap: 10, borderRadius: 8, background: bg, color, fontFamily: TYPO.fontDisplay, fontSize: 11.5 }}>
      <span style={{ width: 20, height: 20, borderRadius: 999, background: nBg, color: nColor, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 10.5, fontWeight: 700 }}>{done ? '✓' : n}</span>
      <span style={{ fontWeight: 600 }}>{lb}</span>
      {sub && <span style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 500, color: active ? 'rgba(255,255,255,0.55)' : theme.textMuted }}>{sub}</span>}
    </div>
  );
}

function Th({ theme, children, l, c, w, bg, color, bl }) {
  return (
    <th style={{
      fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
      letterSpacing: '0.10em', textTransform: 'uppercase', color: color || theme.textMuted,
      textAlign: l ? 'left' : (c ? 'center' : 'right'),
      padding: '10px 10px',
      borderBottom: `1px solid ${theme.border}`, background: bg || theme.surface,
      whiteSpace: 'nowrap', width: w,
      borderLeft: bl ? `1px solid ${bl}` : undefined,
      position: 'sticky', top: 0, zIndex: 2,
    }}>{children}</th>
  );
}
function Td({ theme, children, l, c, bg, bl }) {
  return <td style={{
    padding: '5px 10px',
    textAlign: l ? 'left' : (c ? 'center' : 'right'),
    verticalAlign: 'middle', background: bg,
    borderLeft: bl ? `1px solid ${bl}` : undefined,
    fontSize: 12, color: theme.text, fontFamily: TYPO.fontText,
    whiteSpace: 'nowrap',
  }}>{children}</td>;
}

function HeroStat({ label, value, sub, color }) {
  return (
    <div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)' }}>{label}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color, marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>{sub}</div>
    </div>
  );
}
function NumCell({ n, strong }) {
  const v = Number(n) || 0;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11.5, fontWeight: strong ? 600 : 500, color: v === 0 ? '#A1A1A6' : 'inherit' }}>{fmtNum(v)}</span>;
}
function RoadmapChip({ r }) {
  const R = (r || '').toUpperCase();
  // paleta S&OP (RMI/RML amarillo · EOL gris)
  // paleta clara y bien diferenciable
  const map = {
    RMI: { bg: '#F2C744', color: '#5D4300' },              // amarillo
    RML: { bg: 'rgba(52,199,89,0.18)', color: '#0F8F4F' }, // verde
    RMD: { bg: 'rgba(0,122,255,0.14)', color: '#0057D9' }, // azul
    RMN: { bg: 'rgba(175,82,222,0.15)', color: '#7128B8' },// morado
    EOL: { bg: '#F2F2F4', color: '#6E6E73' },              // gris
  };
  const s = map[R] || { bg: '#F5F5F7', color: '#A1A1A6' };
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 6, letterSpacing: '0.04em', minWidth: 40, background: s.bg, color: s.color }}>{R || '—'}</span>;
}
function ReservoInput({ value, recom, confirmado, onChange, accent = '#007AFF' }) {
  const [local, setLocal] = useState(String(value ?? 0));
  useEffect(() => { setLocal(String(value ?? 0)); }, [value]);
  const numLocal = Number(local) || 0;
  const dirty = numLocal !== value;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <input value={local}
        placeholder="0"
        onChange={e => setLocal(e.target.value.replace(/[^\d]/g, ''))}
        onFocus={e => e.currentTarget.select()}
        onBlur={() => { const n = Number(local) || 0; if (n !== value) onChange(n); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{
          width: 68, padding: '4px 8px', borderRadius: 6, textAlign: 'right',
          border: `1px solid ${confirmado ? '#34C759' : (numLocal > 0 ? accent : 'transparent')}`,
          background: confirmado ? 'rgba(52,199,89,0.10)' : (numLocal > 0 ? 'rgba(0,122,255,0.06)' : 'transparent'),
          color: confirmado ? '#34C759' : (numLocal > 0 ? accent : '#A1A1A6'),
          fontFamily: 'SF Mono, ui-monospace, monospace', fontSize: 11.5, fontWeight: 600, outline: 'none',
        }} />
      <span style={{ color: '#A1A1A6', fontSize: 10, fontFamily: 'SF Mono, ui-monospace, monospace', fontWeight: 500 }}>/ {fmtInt(recom)}</span>
    </span>
  );
}
function EstadoPill({ estado, confirmado, reservo, recom, accent = '#007AFF' }) {
  const styles = {
    draft:         { bg: 'transparent', color: '#A1A1A6', label: '—' },
    pend_confirmar:{ bg: 'rgba(0,122,255,0.10)', color: accent, label: 'Pendiente' },
    confirmado:    { bg: 'rgba(52,199,89,0.12)', color: '#34C759', label: 'Confirmado' },
    parcial:       { bg: 'rgba(255,149,0,0.12)', color: '#FF9500', label: `Parcial ${fmtInt(confirmado)}/${fmtInt(recom)}` },
    no_aplica:     { bg: 'rgba(255,59,48,0.12)', color: '#FF3B30', label: 'No aplica' },
  };
  const s = styles[estado] || styles.draft;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>;
}
