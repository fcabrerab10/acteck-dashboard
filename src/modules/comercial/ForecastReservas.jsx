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
  { key: 'digitalife', label: 'Digitalife', short: 'DGL', band: '#F5EFFF', bandDark: '#1D1730', txt: '#5B3EAA', txtDark: '#B9A3F0' },
  { key: 'pcel',        label: 'PCEL',      short: 'PCE', band: '#EAF5EC', bandDark: '#122614', txt: '#2A7A44', txtDark: '#9CD2AA' },
  { key: 'dicotech',    label: 'Dicotech',  short: 'DCT', band: '#FEF3E4', bandDark: '#2A1C0C', txt: '#8B5A1F', txtDark: '#E0B77E' },
];
const BAND_ARR_LIGHT = '#F2F2F4';
const BAND_ARR_DARK = '#1C1C1F';
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

  const bandArr = isDark ? BAND_ARR_DARK : BAND_ARR_LIGHT;

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
          supabase.from('roadmap_sku').select('sku, descripcion, marca, familia, rdmp'),
          fetchAll(() => supabase.from('sellout_sku')
            .select('cliente, anio, mes, sku, piezas')
            .gte('anio', anioMin)).catch(e => { console.error('sellout_sku:', e); return []; }),
          supabase.from('cuotas_mensuales')
            .select('cliente, anio, mes, cuota_min, cuota_ideal')
            .eq('anio', anioObj).eq('mes', mesObj),
          fetchAll(() => supabase.from('facturacion_clientes')
            .select('cliente_key, sku, piezas, anio, mes')
            .eq('anio', anioObj).eq('mes', mesObj)).catch(e => { console.error('facturacion_clientes:', e); return []; }),
          fetchAll(() => supabase.from('embarques_compras')
            .select('codigo, arribo_almacen, po_qty, shp_qty, contenedor')
            .gte('arribo_almacen', toISO(hoy)).lte('arribo_almacen', toISO(trecs))).catch(e => { console.error('embarques_compras:', e); return []; }),
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

  // Arribos: agrupar por (sku, año-mes)
  const arribosPorSku = useMemo(() => {
    const map = new Map(); // sku → { mesLabel: totalPz }
    for (const e of arribos) {
      if (!e.codigo || !e.arribo_almacen) continue;
      const d = new Date(e.arribo_almacen);
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
        necesidad_dgl: vDgl,
        necesidad_pce: vPce,
        necesidad_dct: vDct,
        recomendado: totalNec,
        arribosPorMes: arrPorMes,
      });
    }
    return rows.sort((a, b) => b.recomendado - a.recomendado);
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

      {/* Hero */}
      <div style={{
        background: '#0A0A0A', color: '#FFF', borderRadius: 16, padding: '22px 26px',
        display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 36, alignItems: 'center', marginBottom: 16,
      }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>
            Dir. Comercial · Clientes Propios · Forecast · {NOMBRES_MES[mesObj]} {anioObj}
          </div>
          <h1 style={{ fontFamily: TYPO.fontDisplay, fontSize: 26, fontWeight: 700, letterSpacing: '-0.02em', margin: '6px 0 4px' }}>Forecast.</h1>
          <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.55)', maxWidth: 640 }}>
            <b style={{ color: '#FFF' }}>{filasBase.length} SKUs.</b>{' '}
            <b style={{ color: '#F4A79E' }}>{kpis.skusConBrecha} con brecha</b>,{' '}
            <b style={{ color: '#B4C7FF' }}>{kpis.skusEnPropuesta} en propuesta activa</b>.
            Arma tu propuesta seleccionando SKUs con la cantidad que reservarás en Acteck.
          </div>
        </div>
        <div style={{ paddingLeft: 28, borderLeft: '1px solid rgba(255,255,255,0.10)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>SKUs c/ brecha</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#FF9484' }}>{fmtInt(kpis.skusConBrecha)}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{fmtInt(kpis.totalRecom)} pz recomendadas</div>
          </div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>Propuesta activa</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em' }}>{fmtInt(kpis.totalReservo)} pz</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{kpis.skusEnPropuesta} SKUs</div>
          </div>
        </div>
        <div style={{ paddingLeft: 28, borderLeft: '1px solid rgba(255,255,255,0.10)', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>Próx. arribo</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#8EE6AC' }}>
              {kpis.proxArribo ? new Date(kpis.proxArribo).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }) : '—'}
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{arribos.length} embarques en 3 meses</div>
          </div>
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

          {/* Filters */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 12 }}>
            <div style={{ flex: 1, minWidth: 260, display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: theme.bg, borderRadius: 9, color: theme.textMuted, fontSize: 12.5 }}>
              <Search size={14} />
              <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
                placeholder="Buscar SKU · descripción · marca · familia"
                style={{ flex: 1, border: 0, background: 'transparent', outline: 'none', color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5 }} />
            </div>
            <button onClick={() => setSoloConBrecha(v => !v)}
              style={{
                padding: '8px 14px', borderRadius: 999,
                border: `1px solid ${soloConBrecha ? '#1D4FD8' : theme.border}`,
                background: soloConBrecha ? (isDark ? '#0F1830' : '#E7EEFF') : theme.surface,
                color: soloConBrecha ? '#1D4FD8' : theme.text,
                fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: soloConBrecha ? 600 : 500, cursor: 'pointer',
              }}>
              {soloConBrecha ? '✓ ' : ''}Solo con brecha ({filasBase.length})
            </button>
          </div>

          {/* Tabla */}
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${theme.border}` }}>
              <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, letterSpacing: '-0.01em', margin: 0 }}>Detalle por SKU</h3>
              <span style={{ fontSize: 11, color: theme.textMuted }}>
                <b style={{ color: theme.text, fontWeight: 600 }}>{filasFiltradas.length}</b> SKUs · <span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: '#1D4FD8', verticalAlign: 'middle', marginRight: 4 }} />en propuesta
              </span>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 12.5, minWidth: 1100 }}>
                <thead>
                  <tr>
                    <ThSup theme={theme} colspan={3} />
                    {CLIENTES.map(c => (
                      <ThSup key={c.key} theme={theme} bg={isDark ? c.bandDark : c.band} color={isDark ? c.txtDark : c.txt}>{c.label}</ThSup>
                    ))}
                    <ThSup theme={theme} bg={bandArr} color={theme.textMuted} colspan={3}>Próximos arribos</ThSup>
                    <ThSup theme={theme} colspan={3} />
                  </tr>
                  <tr>
                    <Th theme={theme} l w={80}>Roadmap</Th>
                    <Th theme={theme} l w={110}>SKU</Th>
                    <Th theme={theme} l>Descripción</Th>
                    {CLIENTES.map(c => <Th key={c.key} theme={theme} bg={isDark ? c.bandDark : c.band}>Necesita</Th>)}
                    {proxMeses.map(m => <Th key={m.key} theme={theme} bg={bandArr}>{m.label}</Th>)}
                    <Th theme={theme} color="#1D4FD8">Recom.</Th>
                    <Th theme={theme}>Reservo</Th>
                    <Th theme={theme}>Estado</Th>
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradas.map(f => {
                    const l = lineas[f.sku];
                    const enPropuesta = !!l;
                    return (
                      <tr key={f.sku}>
                        <Td theme={theme} l><RoadmapChip r={f.roadmap} /></Td>
                        <Td theme={theme} l><span style={{ fontFamily: TYPO.fontMono || 'monospace', fontSize: 11.5, fontWeight: 600, color: '#1D4FD8' }}>{f.sku}</span></Td>
                        <Td theme={theme} l>
                          <span style={{ fontFamily: TYPO.fontText, fontWeight: 500, fontSize: 12.5, color: theme.text, display: 'block' }}>{f.descripcion}</span>
                          <span style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{f.marca}{f.familia ? ` · ${f.familia}` : ''}</span>
                        </Td>
                        <Td theme={theme} bg={isDark ? CLIENTES[0].bandDark : CLIENTES[0].band}><NumCell n={f.necesidad_dgl} /></Td>
                        <Td theme={theme} bg={isDark ? CLIENTES[1].bandDark : CLIENTES[1].band}><NumCell n={f.necesidad_pce} /></Td>
                        <Td theme={theme} bg={isDark ? CLIENTES[2].bandDark : CLIENTES[2].band}><NumCell n={f.necesidad_dct} /></Td>
                        {proxMeses.map(m => (
                          <Td key={m.key} theme={theme} bg={bandArr}><NumCell n={f.arribosPorMes[m.key]} strong={f.arribosPorMes[m.key] > 0} /></Td>
                        ))}
                        <Td theme={theme}><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, color: '#1D4FD8', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(f.recomendado)}</span></Td>
                        <Td theme={theme}>
                          {enPropuesta ? (
                            <ReservoInput
                              value={Number(l.reservo) || 0}
                              max={f.recomendado}
                              confirmado={l.estado === 'confirmado' || l.estado === 'parcial'}
                              onChange={(v) => upsertLinea(f, { reservo: v, estado: propuesta?.estatus === 'generada' ? 'pend_confirmar' : 'draft' })}
                              onClear={() => eliminarLinea(f.sku)}
                            />
                          ) : (
                            <button onClick={() => upsertLinea(f, { reservo: f.recomendado })}
                              style={{
                                padding: '6px 12px', borderRadius: 999,
                                background: '#1D4FD8', color: '#FFF', border: 0, cursor: 'pointer',
                                fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600,
                              }}>
                              + Agregar {fmtInt(f.recomendado)} ▸
                            </button>
                          )}
                        </Td>
                        <Td theme={theme}><EstadoPill estado={l?.estado || 'draft'} confirmado={l?.confirmado} reservo={l?.reservo} recom={f.recomendado} /></Td>
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
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textMuted }}>Forecast · Reservas</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 700, letterSpacing: '-0.01em', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
                  Mi Propuesta
                  {Object.keys(lineas).length > 0 && (
                    <span style={{ background: '#1D4FD8', color: '#FFF', fontSize: 10, padding: '1px 7px', borderRadius: 999, fontWeight: 700 }}>{Object.keys(lineas).length}</span>
                  )}
                </div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: '#0F8F4F', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: '#0F8F4F' }} />Autoguardado
              </span>
            </div>
            <div style={{ padding: '0 16px 14px' }}>
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
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#1D4FD8' }}>Piezas</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 700, letterSpacing: '-0.02em', color: '#1D4FD8', fontVariantNumeric: 'tabular-nums' }}>{fmtInt(kpis.totalReservo)}</div>
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

function ThSup({ theme, children, bg, color, colspan = 1 }) {
  return (
    <th colSpan={colspan} style={{
      fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
      letterSpacing: '0.12em', textTransform: 'uppercase', color: color || theme.textMuted,
      textAlign: 'center', padding: '10px 8px', borderBottom: `1px solid ${theme.border}`,
      background: bg || theme.surface,
    }}>{children || ''}</th>
  );
}
function Th({ theme, children, l, w, bg, color }) {
  return (
    <th style={{
      fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600,
      letterSpacing: '0.10em', textTransform: 'uppercase', color: color || theme.textMuted,
      textAlign: l ? 'left' : 'right', padding: '12px 10px',
      borderBottom: `1px solid ${theme.border}`, background: bg || theme.surface,
      whiteSpace: 'nowrap', width: w,
    }}>{children}</th>
  );
}
function Td({ theme, children, l, bg }) {
  return <td style={{ padding: '11px 10px', borderBottom: `1px solid ${theme.divider || theme.border}`, textAlign: l ? 'left' : 'right', verticalAlign: 'middle', background: bg }}>{children}</td>;
}
function NumCell({ n, strong }) {
  const v = Number(n) || 0;
  return <span style={{ fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontWeight: strong ? 700 : 500, color: v === 0 ? '#A1A1A6' : 'inherit' }}>{fmtNum(v)}</span>;
}
function RoadmapChip({ r }) {
  const R = (r || '').toUpperCase();
  const bg = R === 'RMI' ? '#F2C744' : R === 'RML' ? '#F5D96A' : (R === 'EOL' ? '#F2F2F4' : '#F2F2F4');
  const color = R === 'EOL' ? '#6E6E73' : '#5D4300';
  return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 6, letterSpacing: '0.04em', minWidth: 44, background: bg, color }}>{R || '—'}</span>;
}
function ReservoInput({ value, max, confirmado, onChange, onClear }) {
  const [local, setLocal] = useState(String(value ?? 0));
  useEffect(() => { setLocal(String(value ?? 0)); }, [value]);
  const dirty = Number(local) !== value;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <input value={local}
        onChange={e => setLocal(e.target.value.replace(/[^\d]/g, ''))}
        onBlur={() => { const n = Number(local) || 0; if (n !== value) onChange(n); if (n === 0) onClear(); }}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        style={{
          width: 74, padding: '6px 10px', borderRadius: 8, textAlign: 'right',
          border: `1px solid ${confirmado ? '#0F8F4F' : (dirty ? '#1D4FD8' : '#E5E5E9')}`,
          background: confirmado ? '#E4F5EB' : (dirty ? '#E7EEFF' : 'transparent'),
          color: confirmado ? '#0F8F4F' : (dirty ? '#1D4FD8' : 'inherit'),
          fontFamily: 'ui-monospace, monospace', fontSize: 12, fontWeight: 600, outline: 'none',
        }} />
      <span style={{ color: '#A1A1A6', fontSize: 10, fontFamily: TYPO.fontDisplay, fontWeight: 500 }}>/ {fmtInt(max)}</span>
    </span>
  );
}
function EstadoPill({ estado, confirmado, reservo, recom }) {
  const styles = {
    draft:         { bg: '#F0F0F2', color: '#6E6E73', label: 'Borrador' },
    pend_confirmar:{ bg: '#E7EEFF', color: '#1D4FD8', label: 'Pend. confirmar' },
    confirmado:    { bg: '#E4F5EB', color: '#0F8F4F', label: 'Confirmado ✓' },
    parcial:       { bg: '#FFF3DF', color: '#B87400', label: `Parcial ${fmtInt(confirmado)}/${fmtInt(recom)}` },
    no_aplica:     { bg: '#FBECEA', color: '#C0392B', label: 'No aplica' },
  };
  const s = styles[estado] || styles.draft;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, padding: '4px 10px', borderRadius: 999, background: s.bg, color: s.color }}>{s.label}</span>;
}
