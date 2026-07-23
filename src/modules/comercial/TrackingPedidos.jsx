import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import {
  Target, Plus, Search, X, ChevronRight, Trash2, Edit2, Truck, Package,
  Sparkles, ChevronDown, AlertTriangle, Send,
} from 'lucide-react';

// ═══ Constantes y helpers ═══
const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife', rol: 'Acteck · Balam Rush', letra: 'D' },
  { key: 'pcel',       nombre: 'PCEL',       rol: 'Acteck',              letra: 'P' },
  { key: 'dicotech',   nombre: 'Dicotech',   rol: 'Acteck · Balam Rush', letra: 'Di' },
];
const NOMBRE_CLIENTE = Object.fromEntries(CLIENTES.map((c) => [c.key, c.nombre]));

const ETAPAS_BASE = ['recibida', 'procesada', 'surtida', 'entregada'];
const ETAPAS_DICOTECH = ['cotizacion_solicitada', 'cotizacion_enviada', 'recibida', 'procesada', 'surtida', 'entregada'];
const ETAPA_LABEL = {
  cotizacion_solicitada: 'Cot. solicitada',
  cotizacion_enviada:    'Cot. enviada',
  recibida: 'Recibida', procesada: 'Procesada', surtida: 'Surtida', entregada: 'Entregada',
};
const etapasPara = (clienteKey) => (clienteKey === 'dicotech' ? ETAPAS_DICOTECH : ETAPAS_BASE);
const CAMPO_ETAPA = {
  cotizacion_solicitada: 'fecha_cotizacion_solicitada',
  cotizacion_enviada: 'fecha_cotizacion_enviada',
  recibida: 'fecha_recibida', procesada: 'fecha_procesada',
};

const ALMACENES = ['GDL', 'CDMX'];
const PAQUETERIAS = ['DHL', 'Estafeta', 'Fedex', 'Redpack', 'Paquetexpress', 'Otra'];
const UMBRAL_DIAS_ALERTA = 3;

// Metas SLA por etapa (días) — usadas por el módulo de métricas
const METAS_DIAS = { recepcion: 2, procesamiento: 2, envio: 2, total: 9 };
const isoWeek = (d) => {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  dt.setUTCDate(dt.getUTCDate() + 4 - (dt.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

const fmtDate = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' }); }
  catch { return '—'; }
};
const fmtDateFull = (iso) => {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return '—'; }
};
const fmtInt = (n) => (n == null || !isFinite(n) ? '—' : Math.round(n).toLocaleString('es-MX'));
const fmtCompact = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(Number(n));
  if (a >= 1e6) return `$${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};
const dias = (from, to) => {
  if (!from || !to) return null;
  return (new Date(to).getTime() - new Date(from).getTime()) / 86400000;
};
const nowIso = () => new Date().toISOString();
const todayLocalIso = () => new Date().toISOString().slice(0, 16);
const toIso = (v) => (v ? new Date(v).toISOString() : null);

// Paleta consistente
function paletteFromTheme(theme) {
  return {
    accent: theme.accent || '#007AFF',
    green:  theme.green  || '#34C759',
    orange: theme.orange || '#FF9500',
    red:    theme.red    || '#FF3B30',
    purple: theme.purple || '#AF52DE',
    teal:   theme.teal   || '#5AC8FA',
    indigo: theme.indigo || '#5856D6',
  };
}
function clienteColor(theme, key) {
  const P = paletteFromTheme(theme);
  const map = { digitalife: P.accent, pcel: P.red, dicotech: P.purple };
  return map[key] || P.accent;
}
function etapaColor(theme, etapa) {
  const P = paletteFromTheme(theme);
  const map = {
    cotizacion_solicitada: P.indigo,
    cotizacion_enviada:    P.purple,
    recibida:  P.teal,
    procesada: P.accent,
    surtida:   P.orange,
    entregada: P.green,
  };
  return map[etapa] || P.accent;
}

// ── Etapa derivada (respeta etapas de cotización para dicotech) ──
function etapaDeOc(oc, envios, fillRate) {
  const esDico = oc.cliente_key === 'dicotech';
  if (esDico) {
    if (!oc.fecha_cotizacion_solicitada && !oc.fecha_recibida) return null;
    if (oc.fecha_cotizacion_solicitada && !oc.fecha_cotizacion_enviada && !oc.fecha_recibida) return 'cotizacion_solicitada';
    if (oc.fecha_cotizacion_enviada && !oc.fecha_recibida) return 'cotizacion_enviada';
  }
  if (!oc.fecha_recibida) return null;
  if (!oc.fecha_procesada) return 'recibida';
  const algunSurtido = envios.some((e) => e.fecha_surtida);
  if (!algunSurtido) return 'procesada';
  const todosEntregados = envios.length > 0 && envios.every((e) => e.fecha_entregada);
  if (todosEntregados && fillRate >= 100) return 'entregada';
  return 'surtida';
}
function fechaEtapaOc(oc, envios, etapa) {
  if (CAMPO_ETAPA[etapa]) return oc[CAMPO_ETAPA[etapa]];
  if (etapa === 'surtida') {
    const fechas = envios.map((e) => e.fecha_surtida).filter(Boolean).sort();
    return fechas[0] || null;
  }
  if (etapa === 'entregada') {
    const fechas = envios.map((e) => e.fecha_entregada).filter(Boolean).sort();
    return fechas[fechas.length - 1] || null;
  }
  return null;
}
function ultimaFechaOc(oc, envios) {
  const todas = [
    oc.fecha_cotizacion_solicitada, oc.fecha_cotizacion_enviada,
    oc.fecha_recibida, oc.fecha_procesada,
    ...envios.flatMap((e) => [e.fecha_surtida, e.fecha_entregada]),
  ].filter(Boolean).sort();
  return todas[todas.length - 1];
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ═══════════════════════════════════════════════════════════════════
export default function TrackingPedidos() {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const P = paletteFromTheme(theme);

  const [loading, setLoading] = useState(true);
  const [ocs, setOcs] = useState([]);
  const [skusPorOc, setSkusPorOc] = useState({});
  const [enviosPorOc, setEnviosPorOc] = useState({});
  const [envioSkusPorEnvio, setEnvioSkusPorEnvio] = useState({});
  const [busqueda, setBusqueda] = useState('');
  const [clienteFiltro, setClienteFiltro] = useState('TODOS');
  const [estatusFiltro, setEstatusFiltro] = useState('abiertas');
  const [ocAbierta, setOcAbierta] = useState(null);
  const [envioAbierto, setEnvioAbierto] = useState(null);
  const [showNuevaOC, setShowNuevaOC] = useState(false);
  const [editOc, setEditOc] = useState(null);
  const [envioModal, setEnvioModal] = useState(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [alertasSilenciadas, setAlertasSilenciadas] = useState(new Set());
  const [etapaExpandida, setEtapaExpandida] = useState('total');

  const cargar = async () => {
    setLoading(true);
    const [ocsRes, skusRes, enviosRes, envioSkusRes] = await Promise.all([
      supabase.from('oc_clientes').select('*').order('created_at', { ascending: false }),
      supabase.from('oc_clientes_skus').select('*'),
      supabase.from('oc_envios').select('*').order('numero_envio'),
      supabase.from('oc_envio_skus').select('*'),
    ]);
    const skus = {}; for (const s of (skusRes.data || [])) { (skus[s.oc_id] ||= []).push(s); }
    const envios = {}; for (const e of (enviosRes.data || [])) { (envios[e.oc_id] ||= []).push(e); }
    const esk = {}; for (const x of (envioSkusRes.data || [])) { (esk[x.envio_id] ||= []).push(x); }
    setOcs(ocsRes.data || []);
    setSkusPorOc(skus);
    setEnviosPorOc(envios);
    setEnvioSkusPorEnvio(esk);
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);

  const enriquecidas = useMemo(() => ocs.map((oc) => {
    const skus = skusPorOc[oc.id] || [];
    const envios = enviosPorOc[oc.id] || [];
    const piezasOrd = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
    const monto = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0) * (Number(x.precio_unitario) || 0), 0);
    const surtidoPorSku = {};
    for (const e of envios) {
      const es = envioSkusPorEnvio[e.id] || [];
      for (const x of es) {
        surtidoPorSku[x.oc_sku_id] = (surtidoPorSku[x.oc_sku_id] || 0) + (Number(x.cantidad_surtida) || 0);
      }
    }
    const piezasSur = Object.values(surtidoPorSku).reduce((s, v) => s + v, 0);
    const fillRate = piezasOrd > 0 ? (piezasSur / piezasOrd * 100) : 0;
    const etapa = etapaDeOc(oc, envios, fillRate);
    const ultimaFecha = ultimaFechaOc(oc, envios);
    const diasSinAvance = ultimaFecha ? dias(ultimaFecha, nowIso()) : null;
    return {
      ...oc, skus, envios, surtidoPorSku,
      piezasOrd, piezasSur, monto, fillRate, etapa, ultimaFecha, diasSinAvance,
      atrasada: etapa && etapa !== 'entregada' && diasSinAvance != null && diasSinAvance > UMBRAL_DIAS_ALERTA,
    };
  }), [ocs, skusPorOc, enviosPorOc, envioSkusPorEnvio]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return enriquecidas.filter((oc) => {
      if (clienteFiltro !== 'TODOS' && oc.cliente_key !== clienteFiltro) return false;
      if (estatusFiltro === 'abiertas' && oc.etapa === 'entregada') return false;
      if (estatusFiltro === 'entregadas' && oc.etapa !== 'entregada') return false;
      if (q) {
        const hay = `${oc.numero_oc_cliente} ${(oc.skus || []).map((s) => s.sku).join(' ')} ${(oc.envios || []).map((e) => `${e.numero_factura || ''} ${e.guia_rastreo || ''}`).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [enriquecidas, busqueda, clienteFiltro, estatusFiltro]);

  const kpis = useMemo(() => {
    const abiertas = enriquecidas.filter((oc) => oc.etapa !== 'entregada');
    const atrasadas = abiertas.filter((oc) => oc.atrasada);
    const mesActual = new Date().getMonth();
    const anioActual = new Date().getFullYear();
    const conEnvioMes = enriquecidas.filter((oc) => oc.envios.some((e) => {
      if (!e.fecha_surtida) return false;
      const d = new Date(e.fecha_surtida);
      return d.getMonth() === mesActual && d.getFullYear() === anioActual;
    }));
    const piezasOrdMes = conEnvioMes.reduce((s, oc) => s + oc.piezasOrd, 0);
    const piezasSurMes = conEnvioMes.reduce((s, oc) => s + oc.piezasSur, 0);
    const fillMes = piezasOrdMes > 0 ? (piezasSurMes / piezasOrdMes * 100) : null;
    const entregadas = enriquecidas.filter((oc) => oc.etapa === 'entregada' && oc.fecha_recibida);
    const promedios = entregadas.map((oc) => {
      const fEnt = fechaEtapaOc(oc, oc.envios, 'entregada');
      return dias(oc.fecha_recibida, fEnt);
    }).filter((n) => n != null);
    const tiempoPromedio = promedios.length ? promedios.reduce((a, b) => a + b, 0) / promedios.length : null;
    return {
      abiertas: abiertas.length,
      abiertasMonto: abiertas.reduce((s, x) => s + x.monto, 0),
      abiertasPiezas: abiertas.reduce((s, x) => s + x.piezasOrd, 0),
      atrasadas: atrasadas.length,
      atrasadasDetalle: atrasadas.slice(0, 5),
      atrasadasAll: atrasadas,
      conEnvioMes: conEnvioMes.length,
      fillMes, piezasOrdMes, piezasSurMes,
      tiempoPromedio, nEntregadas: entregadas.length,
    };
  }, [enriquecidas]);

  // ═════ Métricas de tiempo por etapa (rings Apple Fitness) ═════
  const metricas = useMemo(() => {
    const ahora = new Date();
    const inicioMes = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
    const inicioMesAnt = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
    const finMesAnt = new Date(ahora.getFullYear(), ahora.getMonth(), 0, 23, 59, 59);
    const mk = () => ({ current: [], prev: [], porCliente: {}, porSemana: {} });
    const buckets = { recepcion: mk(), procesamiento: mk(), envio: mk(), total: mk() };
    for (const oc of enriquecidas) {
      const fSur = fechaEtapaOc(oc, oc.envios, 'surtida');
      const fEnt = fechaEtapaOc(oc, oc.envios, 'entregada');
      const val = {
        recepcion: dias(oc.fecha_recibida, oc.fecha_procesada),
        procesamiento: dias(oc.fecha_procesada, fSur),
        envio: dias(fSur, fEnt),
        total: dias(oc.fecha_recibida, fEnt),
      };
      const fBase = fEnt || fSur || oc.fecha_procesada || oc.fecha_recibida;
      if (!fBase) continue;
      const d = new Date(fBase);
      const enMesActual = d >= inicioMes;
      const enMesAnt = d >= inicioMesAnt && d <= finMesAnt;
      const sem = isoWeek(d);
      for (const k of ['recepcion', 'procesamiento', 'envio', 'total']) {
        const v = val[k];
        if (v == null || v < 0) continue;
        const b = buckets[k];
        if (enMesActual) b.current.push(v);
        if (enMesAnt) b.prev.push(v);
        (b.porCliente[oc.cliente_key] ||= []).push(v);
        (b.porSemana[sem] ||= []).push(v);
      }
    }
    const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);
    const mkRing = (key, label, meta) => {
      const b = buckets[key];
      const cur = avg(b.current);
      const prev = avg(b.prev);
      const delta = cur != null && prev != null ? cur - prev : null;
      const pctMeta = cur != null ? Math.min(120, (cur / meta) * 100) : 0;
      return {
        key, label, meta,
        avg: cur, avgAnt: prev, delta, pctMeta,
        count: b.current.length,
        porCliente: Object.fromEntries(
          Object.entries(b.porCliente).map(([k, arr]) => [k, { avg: avg(arr), count: arr.length }])
        ),
        porSemana: Object.entries(b.porSemana)
          .sort((a, b) => a[0].localeCompare(b[0]))
          .slice(-4)
          .map(([sem, arr]) => ({ sem, avg: avg(arr), count: arr.length })),
      };
    };
    return {
      recepcion:     mkRing('recepcion',     'Recepción',     METAS_DIAS.recepcion),
      procesamiento: mkRing('procesamiento', 'Procesamiento', METAS_DIAS.procesamiento),
      envio:         mkRing('envio',         'Envío',         METAS_DIAS.envio),
      total:         mkRing('total',         'Total E2E',     METAS_DIAS.total),
    };
  }, [enriquecidas]);

  const tiemposPorCliente = useMemo(() => {
    const acc = {};
    for (const c of CLIENTES) acc[c.key] = { cot: [], cr: [], rp: [], ps: [], se: [] };
    for (const oc of enriquecidas) {
      if (oc.etapa !== 'entregada') continue;
      const fSur = fechaEtapaOc(oc, oc.envios, 'surtida');
      const fEnt = fechaEtapaOc(oc, oc.envios, 'entregada');
      const b = acc[oc.cliente_key];
      if (!b) continue;
      if (oc.cliente_key === 'dicotech') {
        const cot = dias(oc.fecha_cotizacion_solicitada, oc.fecha_cotizacion_enviada);
        const cr  = dias(oc.fecha_cotizacion_enviada, oc.fecha_recibida);
        if (cot != null) b.cot.push(cot);
        if (cr != null) b.cr.push(cr);
      }
      const rp = dias(oc.fecha_recibida, oc.fecha_procesada);
      const ps = dias(oc.fecha_procesada, fSur);
      const se = dias(fSur, fEnt);
      if (rp != null) b.rp.push(rp);
      if (ps != null) b.ps.push(ps);
      if (se != null) b.se.push(se);
    }
    const avg = (arr) => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
    return CLIENTES.map((c) => {
      const b = acc[c.key];
      const cot = avg(b.cot), cr = avg(b.cr), rp = avg(b.rp), ps = avg(b.ps), se = avg(b.se);
      const total = [cot, cr, rp, ps, se].filter((n) => n != null).reduce((a, b) => a + b, 0);
      const n = Math.max(b.rp.length, b.ps.length, b.se.length, b.cot.length, b.cr.length);
      return { cliente: c.nombre, clienteKey: c.key, cot, cr, rp, ps, se, total, n };
    });
  }, [enriquecidas]);

  // Copilot Operaciones · recomendaciones data-driven
  const recomendaciones = useMemo(() => {
    const recs = [];
    // 1) OCs atrasadas urgentes
    const urgentes = kpis.atrasadasAll.filter((o) => o.diasSinAvance > UMBRAL_DIAS_ALERTA * 2);
    if (urgentes.length > 0) {
      const top = urgentes[0];
      recs.push({
        id: 'urg', tag: 'Urgente', tagColor: P.red,
        title: `Acelerar OC ${top.numero_oc_cliente} (${NOMBRE_CLIENTE[top.cliente_key]})`,
        desc: `Lleva ${top.diasSinAvance.toFixed(0)} días en ${ETAPA_LABEL[top.etapa] || 'sin captura'}. ${urgentes.length > 1 ? `+${urgentes.length - 1} OCs con retraso similar.` : ''}`,
        ocId: top.id,
      });
    }
    // 2) OCs cercanas al SLA (5-10 días)
    const cerca = enriquecidas.filter((o) => o.etapa && o.etapa !== 'entregada' && o.diasSinAvance != null && o.diasSinAvance >= 5 && o.diasSinAvance <= 10);
    if (cerca.length > 0) {
      recs.push({
        id: 'sla', tag: 'Cerca del SLA', tagColor: P.orange,
        title: `${cerca.length} OC${cerca.length > 1 ? 's' : ''} en zona amarilla`,
        desc: `Entre 5 y 10 días sin avance. Empújalas esta semana antes de que se atrasen.`,
      });
    }
    // 3) OCs con fill alto listas para cerrar
    const listas = enriquecidas.filter((o) => o.etapa === 'surtida' && o.fillRate >= 100 && o.envios.length > 0 && !o.envios.every((e) => e.fecha_entregada));
    if (listas.length > 0) {
      recs.push({
        id: 'close', tag: 'Cierre mes', tagColor: P.green,
        title: `${listas.length} OC${listas.length > 1 ? 's' : ''} lista${listas.length > 1 ? 's' : ''} para cerrar`,
        desc: `Fill 100% pero falta marcar la entrega final. Ciérralas para mejorar el SLA del mes.`,
      });
    }
    return recs.slice(0, 3);
  }, [enriquecidas, kpis, P]);

  const eliminarOC = async (oc) => {
    if (!confirm(`¿Eliminar OC ${oc.numero_oc_cliente}? Esto borra también sus SKUs y envíos.`)) return;
    const { error } = await supabase.from('oc_clientes').delete().eq('id', oc.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };
  const eliminarEnvio = async (envio) => {
    if (!confirm(`¿Eliminar envío #${envio.numero_envio}?`)) return;
    const { error } = await supabase.from('oc_envios').delete().eq('id', envio.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };
  const avanzarOc = async (oc, campo) => {
    const { error } = await supabase.from('oc_clientes')
      .update({ [campo]: nowIso(), updated_at: nowIso() }).eq('id', oc.id);
    if (error) return alert('Error: ' + error.message);
    cargar();
  };

  const silenciarAlerta = (id) => {
    setAlertasSilenciadas((prev) => new Set([...prev, id]));
  };
  const alertasVisibles = kpis.atrasadasDetalle.filter((oc) => !alertasSilenciadas.has(oc.id));

  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = 'rgba(255,255,255,0.72)';
  const heroSub = 'rgba(255,255,255,0.55)';

  if (loading) {
    return (
      <div style={{ padding: 60, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        <div style={{ fontSize: 12 }}>Cargando pedidos…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">

      {/* ═════ Hero editorial ═════ */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 20,
        background: heroBg, color: heroText, borderRadius: 14, padding: '14px 18px',
        alignItems: 'center', position: 'relative', overflow: 'hidden',
        border: isDark ? `1px solid rgba(255,255,255,0.06)` : 'none',
      }}>
        {isDark && (
          <div style={{
            position: 'absolute', top: '-30%', right: '-10%', width: '50%', height: '100%',
            background: `radial-gradient(circle, ${P.accent}1F 0%, transparent 70%)`, pointerEvents: 'none',
          }} />
        )}
        <button onClick={() => setShowNuevaOC(true)}
          style={{
            position: 'absolute', top: 14, right: 16,
            background: 'rgba(255,255,255,0.12)', border: 0, color: heroText,
            padding: '6px 12px', borderRadius: 999, fontSize: 11, fontWeight: 600,
            cursor: 'pointer', fontFamily: TYPO.fontText, display: 'inline-flex', alignItems: 'center', gap: 5,
          }}>
          <Plus style={{ width: 12, height: 12 }} strokeWidth={2.5} /> Nueva OC
        </button>
        <div style={{ position: 'relative' }}>
          <p style={{
            fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em',
            color: heroSub, fontWeight: 500, fontFamily: TYPO.fontText, margin: 0,
          }}>
            Dirección Comercial · Operación · {new Date().toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })}
          </p>
          <h2 style={{
            fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em',
            color: heroText, margin: '4px 0 6px', lineHeight: 1.15,
          }}>
            Tracking Pedidos.
          </h2>
          <p style={{
            color: heroMuted, fontSize: 11.5, lineHeight: 1.5, margin: 0, maxWidth: 460,
            fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums',
          }}>
            <strong style={{ color: heroText, fontWeight: 500 }}>{fmtInt(kpis.abiertas)} OCs abiertas</strong>
            {kpis.fillMes != null && <> · Fill del mes <strong style={{ color: heroText, fontWeight: 500 }}>{kpis.fillMes.toFixed(1)}%</strong></>}
            {kpis.tiempoPromedio != null && <> · Tiempo prom <strong style={{ color: heroText, fontWeight: 500 }}>{kpis.tiempoPromedio.toFixed(1)}d</strong></>}
            {kpis.atrasadas > 0 && <> · Hay <strong style={{ color: heroText, fontWeight: 500 }}>{kpis.atrasadas} atrasadas</strong> más de {UMBRAL_DIAS_ALERTA} días — revisa las urgentes.</>}
          </p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 14px', position: 'relative' }}>
          <HeroStat label="OCs abiertas" value={fmtInt(kpis.abiertas)} sub={fmtCompact(kpis.abiertasMonto)} heroSub={heroSub} heroText={heroText} />
          <HeroStat label="Fill mes" value={kpis.fillMes != null ? `${kpis.fillMes.toFixed(1)}%` : '—'} valueColor={kpis.fillMes == null ? heroText : kpis.fillMes >= 95 ? P.green : kpis.fillMes >= 85 ? P.orange : P.red} heroSub={heroSub} heroText={heroText} />
          <HeroStat label="Tiempo prom." value={kpis.tiempoPromedio != null ? `${kpis.tiempoPromedio.toFixed(1)}d` : '—'} sub={`${kpis.nEntregadas} entregadas`} heroSub={heroSub} heroText={heroText} />
          <HeroStat label="Atrasadas" value={fmtInt(kpis.atrasadas)} valueColor={kpis.atrasadas > 0 ? P.red : heroText} heroSub={heroSub} heroText={heroText} />
        </div>
      </div>

      {/* ═════ Métricas de tiempo por etapa (rings Apple Fitness) ═════ */}
      <MetricasRings
        metricas={metricas}
        expandida={etapaExpandida}
        onExpand={(k) => setEtapaExpandida((cur) => (cur === k ? null : k))}
        theme={theme} P={P}
      />

      {/* ═════ Chart tiempos por etapa ═════ */}
      {tiemposPorCliente.some((t) => t.total > 0) && (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '12px 16px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12, flexWrap: 'wrap', gap: 6 }}>
            <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>
              Tiempo promedio por etapa · días
            </h4>
            <div style={{ display: 'flex', gap: 12, fontSize: 10, color: theme.textMuted, flexWrap: 'wrap' }}>
              <LegendItem color={P.indigo} label="Cot. solic → enviada" />
              <LegendItem color={P.purple} label="Cot. → OC" />
              <LegendItem color={P.teal} label="Recibida → Procesada" />
              <LegendItem color={P.accent} label="Procesada → Envío" />
              <LegendItem color={P.orange} label="Envío → Entrega" />
            </div>
          </div>
          {tiemposPorCliente.map((t) => (
            <ChartRowCliente key={t.clienteKey} theme={theme} P={P} data={t}
              maxTotal={Math.max(1, ...tiemposPorCliente.map((x) => x.total))} />
          ))}
        </div>
      )}

      {/* ═════ Tabla OCs ═════ */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden' }}>
        <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: `1px solid ${theme.border}`, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30, flex: 1, maxWidth: 280 }}>
            <Search style={{ width: 12, height: 12, color: theme.textMuted }} strokeWidth={2.2} />
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar No. OC, SKU, factura, guía…"
              style={{ border: 0, outline: 0, background: 'transparent', fontFamily: TYPO.fontText, fontSize: 11, color: theme.text, flex: 1 }} />
          </div>
          <select value={clienteFiltro} onChange={(e) => setClienteFiltro(e.target.value)}
            style={{ height: 30, padding: '0 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 11, color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer' }}>
            <option value="TODOS">Todos los clientes</option>
            {CLIENTES.map((c) => <option key={c.key} value={c.key}>{c.nombre}</option>)}
          </select>
          <div style={{ display: 'inline-flex', gap: 1, padding: 2, background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)', borderRadius: 999 }}>
            {[{ k: 'abiertas', l: 'Abiertas' }, { k: 'entregadas', l: 'Entregadas' }, { k: 'todas', l: 'Todas' }].map((op) => (
              <button key={op.k} onClick={() => setEstatusFiltro(op.k)}
                style={{
                  padding: '5px 11px', borderRadius: 999,
                  background: estatusFiltro === op.k ? theme.surface : 'transparent',
                  color: estatusFiltro === op.k ? theme.text : theme.textMuted,
                  fontWeight: estatusFiltro === op.k ? 600 : 500, border: 0, fontFamily: TYPO.fontText,
                  fontSize: 11, cursor: 'pointer',
                  boxShadow: estatusFiltro === op.k ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}>{op.l}</button>
            ))}
          </div>
          <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
            <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtInt(filas.length)}</strong> OCs
          </span>
        </div>

        <div style={{ overflow: 'auto', maxHeight: '65vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr>
                {[
                  { l: 'Cliente', a: 'left', w: 130 },
                  { l: 'No. OC', a: 'left', w: 100 },
                  { l: 'Envíos', a: 'center', w: 60 },
                  { l: 'Recibida', a: 'left', w: 90 },
                  { l: 'Piezas', a: 'right', w: 70 },
                  { l: 'Monto', a: 'right', w: 96 },
                  { l: 'Fill', a: 'right', w: 60 },
                  { l: 'Progreso', a: 'left', w: 160 },
                  { l: 'Estatus', a: 'left', w: 110 },
                ].map((h, i) => (
                  <th key={i} style={{
                    position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
                    textAlign: h.a, padding: '9px 8px',
                    fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9,
                    textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted,
                    borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap', width: h.w,
                  }}>{h.l}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filas.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText }}>
                  Sin OCs. Da click en "+ Nueva OC" para capturar la primera.
                </td></tr>
              )}
              {filas.map((oc) => {
                const abierta = ocAbierta === oc.id;
                const cliCol = clienteColor(theme, oc.cliente_key);
                return (
                  <React.Fragment key={oc.id}>
                    <tr onClick={() => setOcAbierta(abierta ? null : oc.id)}
                      style={{
                        cursor: 'pointer', height: 44,
                        background: abierta ? `${P.accent}${isDark ? '1F' : '0D'}` : 'transparent',
                        transition: 'background 100ms',
                      }}
                      onMouseEnter={(e) => { if (!abierta) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                      onMouseLeave={(e) => { if (!abierta) e.currentTarget.style.background = 'transparent'; }}>
                      <td style={tdStyle(theme, 'left')}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                          <span style={{
                            width: 22, height: 22, borderRadius: 7, background: cliCol, color: '#FFF',
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10,
                          }}>{CLIENTES.find((c) => c.key === oc.cliente_key)?.letra || '?'}</span>
                          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500 }}>{NOMBRE_CLIENTE[oc.cliente_key] || oc.cliente_key}</span>
                        </span>
                      </td>
                      <td style={{ ...tdStyle(theme, 'left'), fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text, paddingLeft: 14 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <ChevronRight style={{ width: 11, height: 11, color: P.accent, transform: abierta ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} strokeWidth={2.4} />
                          {oc.numero_oc_cliente}
                        </span>
                      </td>
                      <td style={{ ...tdStyle(theme, 'center') }}>
                        {oc.envios.length > 0
                          ? <span style={{ display: 'inline-block', background: `${P.accent}24`, color: P.accent, padding: '2px 9px', borderRadius: 999, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10.5 }}>{oc.envios.length}</span>
                          : <span style={{ color: theme.textSubtle || theme.textMuted, fontSize: 10.5 }}>—</span>}
                      </td>
                      <td style={{ ...tdStyle(theme, 'left'), fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.textMuted, fontSize: 10.5 }}>
                        {fmtDate(oc.fecha_recibida)}
                      </td>
                      <td style={{ ...tdStyle(theme, 'right') }}>{fmtInt(oc.piezasOrd)}</td>
                      <td style={{ ...tdStyle(theme, 'right'), fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11.5, letterSpacing: '-0.005em' }}>
                        {formatMXN(oc.monto)}
                      </td>
                      <td style={{ ...tdStyle(theme, 'right') }}><FillCell oc={oc} P={P} theme={theme} /></td>
                      <td style={{ ...tdStyle(theme, 'left') }}><ProgresoEtapas oc={oc} theme={theme} P={P} /></td>
                      <td style={{ ...tdStyle(theme, 'left') }}>{oc.etapa && <EstatusChip etapa={oc.etapa} theme={theme} P={P} />}</td>
                    </tr>
                    {abierta && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0, background: theme.bg, borderTop: `1px solid ${theme.border}`, borderBottom: `1px solid ${theme.border}` }}>
                          <DetalleOC oc={oc} theme={theme} P={P} isDark={isDark}
                            envioAbierto={envioAbierto} setEnvioAbierto={setEnvioAbierto}
                            envioSkusPorEnvio={envioSkusPorEnvio}
                            onEditarOc={() => setEditOc(oc)}
                            onEliminarOc={() => eliminarOC(oc)}
                            onNuevoEnvio={() => setEnvioModal({ ocId: oc.id, envio: null, ocContext: oc })}
                            onEditarEnvio={(env) => setEnvioModal({ ocId: oc.id, envio: env, ocContext: oc })}
                            onEliminarEnvio={eliminarEnvio}
                            onAvanzarOc={(campo) => avanzarOc(oc, campo)} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Copilot Operaciones · expandible al pie */}
        <CopilotOps theme={theme} P={P} isDark={isDark} open={copilotOpen} setOpen={setCopilotOpen} recs={recomendaciones} />
      </div>

      {(showNuevaOC || editOc) && (
        <ModalOC theme={theme} P={P} isDark={isDark}
          ocInicial={editOc}
          onClose={() => { setShowNuevaOC(false); setEditOc(null); }}
          onSaved={() => { setShowNuevaOC(false); setEditOc(null); cargar(); }} />
      )}
      {envioModal && (
        <ModalEnvio theme={theme} P={P} isDark={isDark}
          ocContext={envioModal.ocContext} envio={envioModal.envio}
          envioSkusPorEnvio={envioSkusPorEnvio}
          onClose={() => setEnvioModal(null)}
          onSaved={() => { setEnvioModal(null); cargar(); }} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// HELPERS DE ESTILO Y SUB-COMPONENTES
// ═══════════════════════════════════════════════════════════════════
const tdStyle = (theme, align = 'left') => ({
  padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontSize: 11,
  whiteSpace: 'nowrap', textAlign: align, verticalAlign: 'middle',
  color: theme.text,
});

function HeroStat({ label, value, sub, valueColor, heroSub, heroText }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: heroSub, fontWeight: 500, fontFamily: TYPO.fontText }}>{label}</span>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', marginTop: 2, fontVariantNumeric: 'tabular-nums', color: valueColor || heroText }}>
        {value}
        {sub && <span style={{ color: heroSub, fontSize: 10, marginLeft: 4, fontWeight: 500 }}>{sub}</span>}
      </span>
    </div>
  );
}

function LegendItem({ color, label }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      <span style={{ width: 10, height: 10, borderRadius: 3, background: color, display: 'inline-block' }} />
      {label}
    </span>
  );
}

function ChartRowCliente({ theme, P, data, maxTotal }) {
  const colores = [P.indigo, P.purple, P.teal, P.accent, P.orange];
  const partes = [data.cot, data.cr, data.rp, data.ps, data.se];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px', gap: 12, alignItems: 'center', padding: '6px 0', borderBottom: `1px dashed ${theme.border}` }}>
      <div>
        <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, fontSize: 12, color: theme.text }}>{data.cliente}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>
          {data.n} OC{data.n !== 1 ? 's' : ''} entregada{data.n !== 1 ? 's' : ''}
        </div>
      </div>
      <div style={{ display: 'flex', height: 10, borderRadius: 999, overflow: 'hidden', background: theme.divider || theme.border }}>
        {partes.map((v, i) => v != null && v > 0 && (
          <span key={i} style={{ display: 'block', width: `${(v / maxTotal) * 100}%`, background: colores[i] }} title={`${v.toFixed(1)}d`} />
        ))}
      </div>
      <div style={{ textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>
        {data.total > 0 ? data.total.toFixed(1) + 'd' : '—'}
      </div>
    </div>
  );
}

function FillCell({ oc, P, theme }) {
  if (oc.piezasOrd === 0) return <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const c = oc.fillRate >= 100 ? P.green : oc.fillRate >= 85 ? P.orange : P.red;
  return <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11.5, color: c, letterSpacing: '-0.005em' }}>{oc.fillRate.toFixed(0)}%</span>;
}

function ProgresoEtapas({ oc, theme, P }) {
  const etapas = etapasPara(oc.cliente_key);
  const currentIdx = etapas.indexOf(oc.etapa);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
      {etapas.map((e, i) => {
        const done = currentIdx > i || (oc.etapa === 'entregada' && i === etapas.length - 1);
        const active = currentIdx === i && oc.etapa !== 'entregada';
        const col = done ? P.green : active ? P.accent : theme.divider || theme.border;
        return (
          <React.Fragment key={e}>
            <span style={{
              width: 12, height: 12, borderRadius: 999, background: col,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 7.5, color: '#FFF', fontWeight: 700, fontFamily: TYPO.fontDisplay,
            }}>
              {done ? '✓' : (active ? (i + 1) : '')}
            </span>
            {i < etapas.length - 1 && (
              <span style={{ flex: 1, minWidth: 6, maxWidth: 14, height: 2, background: done ? P.green : theme.divider || theme.border, borderRadius: 999 }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function EstatusChip({ etapa, theme, P }) {
  const col = etapaColor(theme, etapa);
  return (
    <span style={{
      display: 'inline-block', padding: '3px 10px', borderRadius: 999,
      background: `${col}22`, color: col,
      fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10, letterSpacing: '-0.005em',
    }}>
      {ETAPA_LABEL[etapa]}
    </span>
  );
}

function AlertBar({ theme, P, oc, onIrOC, onNuevoEnvio, onSilenciar }) {
  const isDark = theme.mode === 'dark';
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 14px', background: `${P.red}${isDark ? '18' : '10'}`,
      borderLeft: `3px solid ${P.red}`, borderRadius: 10,
      fontSize: 11.5, fontFamily: TYPO.fontText,
    }}>
      <AlertTriangle style={{ width: 14, height: 14, color: P.red, flexShrink: 0 }} strokeWidth={2} />
      <span style={{ flex: 1, color: isDark ? P.red : `color-mix(in srgb, ${P.red} 65%, black)` }}>
        <strong style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{NOMBRE_CLIENTE[oc.cliente_key]} · OC {oc.numero_oc_cliente}</strong> lleva <strong style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{oc.diasSinAvance.toFixed(0)} días</strong> en {ETAPA_LABEL[oc.etapa]} sin avance
      </span>
      <button onClick={onIrOC}
        style={{
          padding: '4px 10px', background: theme.surface, border: `1px solid ${P.red}40`,
          color: P.red, borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 10, fontWeight: 600, cursor: 'pointer',
        }}>Ver OC</button>
      <button onClick={onNuevoEnvio}
        style={{
          padding: '4px 10px', background: P.red, border: 0, color: '#FFF',
          borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 10, fontWeight: 600, cursor: 'pointer',
        }}>+ Nuevo envío</button>
      <button onClick={onSilenciar}
        style={{
          padding: '4px 8px', background: 'transparent', border: 0, color: theme.textMuted,
          fontFamily: TYPO.fontText, fontSize: 10, fontWeight: 500, cursor: 'pointer',
        }}>Silenciar</button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DRILL-DOWN · Detalle OC (timeline + envíos + SKUs)
// ═══════════════════════════════════════════════════════════════════
function DetalleOC({ oc, theme, P, isDark, envioAbierto, setEnvioAbierto, envioSkusPorEnvio,
  onEditarOc, onEliminarOc, onNuevoEnvio, onEditarEnvio, onEliminarEnvio, onAvanzarOc }) {
  const skus = oc.skus || [];
  const envios = oc.envios || [];
  const totalOrd = skus.reduce((s, x) => s + Number(x.cantidad_ordenada || 0), 0);
  const totalMonto = skus.reduce((s, x) => s + Number(x.cantidad_ordenada || 0) * Number(x.precio_unitario || 0), 0);
  const totalSur = oc.piezasSur;
  const puedeMarcarProcesada = oc.fecha_recibida && !oc.fecha_procesada;
  const etapas = etapasPara(oc.cliente_key);
  const currentIdx = etapas.indexOf(oc.etapa);

  return (
    <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
      {/* Header con acciones */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 3 }}>
            OC <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.text }}>{oc.numero_oc_cliente}</span> · {NOMBRE_CLIENTE[oc.cliente_key]}
          </div>
          {oc.notas && <div style={{ fontSize: 11.5, color: theme.textMuted, fontStyle: 'italic', fontFamily: TYPO.fontText }}>"{oc.notas}"</div>}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {puedeMarcarProcesada && (
            <button onClick={() => onAvanzarOc('fecha_procesada')}
              style={{ padding: '5px 12px', background: P.accent, border: 0, color: '#FFF', borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
              Marcar como Procesada ›
            </button>
          )}
          <button onClick={onEditarOc}
            style={{ padding: '5px 12px', background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Edit2 style={{ width: 11, height: 11 }} strokeWidth={2} /> Editar OC
          </button>
          <button onClick={onEliminarOc}
            style={{ padding: '5px 12px', background: 'transparent', border: 0, color: P.red, borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <Trash2 style={{ width: 11, height: 11 }} strokeWidth={2} /> Eliminar
          </button>
        </div>
      </div>

      {/* Timeline horizontal · etapas dinámicas por cliente */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 16px' }}>
        <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 10 }}>
          Timeline
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${etapas.length}, 1fr)`, gap: 10 }}>
          {etapas.map((e, i) => {
            const iso = fechaEtapaOc(oc, envios, e);
            const done = i < currentIdx || iso;
            const active = i === currentIdx && oc.etapa !== 'entregada';
            const col = done ? P.green : active ? P.accent : theme.textMuted;
            const nota =
              e === 'surtida' && envios.length > 0 && oc.fillRate < 100 ? `${oc.fillRate.toFixed(1)}% surtido` :
              e === 'entregada' && envios.length > 0 && !envios.every((x) => x.fecha_entregada) ? 'Falta último envío' :
              null;
            return (
              <div key={e}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                  <span style={{
                    width: 16, height: 16, borderRadius: 999, background: done ? col : (active ? col : 'transparent'),
                    border: !done && !active ? `2px solid ${col}` : 'none',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8.5, color: done ? '#FFF' : col, fontWeight: 700, fontFamily: TYPO.fontDisplay,
                    boxShadow: active ? `0 0 0 3px ${col}30` : 'none',
                  }}>{done ? '✓' : (active ? (i + 1) : '')}</span>
                  <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>
                    {ETAPA_LABEL[e]}
                  </span>
                </div>
                <div style={{
                  fontFamily: iso ? TYPO.fontDisplay : TYPO.fontText, fontSize: 12,
                  fontWeight: iso ? 600 : 400, letterSpacing: iso ? '-0.005em' : 0,
                  color: iso ? theme.text : theme.textMuted, marginLeft: 22, fontVariantNumeric: 'tabular-nums',
                }}>
                  {iso ? fmtDateFull(iso) : 'Pendiente'}
                </div>
                {nota && <div style={{ fontSize: 10, color: P.orange, fontWeight: 600, marginLeft: 22, marginTop: 1 }}>{nota}</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* SKUs de la OC */}
      <div>
        <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>
          SKUs de la OC · agregado
        </div>
        {skus.length > 0 ? (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums', fontSize: 11.5 }}>
              <thead>
                <tr>
                  {['SKU', 'Cant. ordenada', 'Surtida (Σ envíos)', 'Fill rate', 'Precio', 'Subtotal ordenado'].map((h, i) => (
                    <th key={i} style={{
                      textAlign: i === 0 ? 'left' : 'right', padding: '7px 10px',
                      fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`,
                      background: theme.bg,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {skus.map((s) => {
                  const surt = oc.surtidoPorSku[s.id] || 0;
                  const fill = s.cantidad_ordenada > 0 ? (surt / Number(s.cantidad_ordenada) * 100) : 0;
                  const c = fill >= 100 ? P.green : fill >= 50 ? P.orange : fill > 0 ? P.red : theme.textMuted;
                  return (
                    <tr key={s.id}>
                      <td style={{ padding: '7px 10px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text }}>{s.sku}</td>
                      <td style={{ padding: '7px 10px', borderTop: `1px solid ${theme.border}`, textAlign: 'right' }}>{fmtInt(s.cantidad_ordenada)}</td>
                      <td style={{ padding: '7px 10px', borderTop: `1px solid ${theme.border}`, textAlign: 'right' }}>{fmtInt(surt)}</td>
                      <td style={{ padding: '7px 10px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: c }}>{fill.toFixed(1)}%</td>
                      <td style={{ padding: '7px 10px', borderTop: `1px solid ${theme.border}`, textAlign: 'right' }}>{formatMXN(Number(s.precio_unitario))}</td>
                      <td style={{ padding: '7px 10px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.005em' }}>{formatMXN(Number(s.cantidad_ordenada) * Number(s.precio_unitario))}</td>
                    </tr>
                  );
                })}
                <tr style={{ background: theme.bg }}>
                  <td style={{ padding: '9px 10px', borderTop: `2px solid ${theme.borderStrong || theme.border}`, fontFamily: TYPO.fontText, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>{skus.length} SKUs</td>
                  <td style={{ padding: '9px 10px', borderTop: `2px solid ${theme.borderStrong || theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtInt(totalOrd)}</td>
                  <td style={{ padding: '9px 10px', borderTop: `2px solid ${theme.borderStrong || theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtInt(totalSur)}</td>
                  <td style={{ padding: '9px 10px', borderTop: `2px solid ${theme.borderStrong || theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{totalOrd > 0 ? `${(totalSur / totalOrd * 100).toFixed(1)}%` : '—'}</td>
                  <td style={{ borderTop: `2px solid ${theme.borderStrong || theme.border}` }}></td>
                  <td style={{ padding: '9px 10px', borderTop: `2px solid ${theme.borderStrong || theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.005em' }}>{formatMXN(totalMonto)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 11.5, color: theme.textMuted, fontStyle: 'italic' }}>Sin SKUs capturados.</div>
        )}
      </div>

      {/* Envíos */}
      <div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
          <span style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>
            Envíos · {envios.length} registrado{envios.length !== 1 ? 's' : ''}
          </span>
          <button onClick={onNuevoEnvio} disabled={skus.length === 0}
            style={{
              padding: '5px 12px', background: skus.length === 0 ? theme.bg : P.accent,
              color: skus.length === 0 ? theme.textMuted : '#FFF', border: 0, borderRadius: 999,
              fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 600, cursor: skus.length === 0 ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}>
            <Plus style={{ width: 11, height: 11 }} strokeWidth={2.5} /> Nuevo envío
          </button>
        </div>
        {envios.length === 0 ? (
          <div style={{ fontSize: 11.5, color: theme.textMuted, fontStyle: 'italic', padding: '20px 0', textAlign: 'center', background: theme.surface, borderRadius: 10, border: `1px dashed ${theme.border}` }}>
            No hay envíos registrados. {skus.length === 0 ? 'Captura primero los SKUs de la OC.' : 'Da click en "+ Nuevo envío" para agregar el primero.'}
          </div>
        ) : (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>
              <thead>
                <tr>
                  {['', '#', 'Almacén', 'Surtido', 'Entregado', 'Método', 'Factura', 'Guía', 'Piezas', 'Cita', 'Estatus', ''].map((h, i) => (
                    <th key={i} style={{
                      textAlign: [8].includes(i) ? 'right' : 'left', padding: '7px 8px',
                      fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase',
                      letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`,
                      background: theme.bg, width: i === 0 ? 22 : undefined,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {envios.map((e) => {
                  const abiertoE = envioAbierto === e.id;
                  const eskus = envioSkusPorEnvio[e.id] || [];
                  const pzs = eskus.reduce((s, x) => s + Number(x.cantidad_surtida || 0), 0);
                  const entregado = !!e.fecha_entregada;
                  const almCol = e.almacen_origen === 'GDL' ? P.purple : e.almacen_origen === 'CDMX' ? P.teal : theme.textMuted;
                  return (
                    <React.Fragment key={e.id}>
                      <tr style={{ background: abiertoE ? `${P.accent}${isDark ? '18' : '0D'}` : 'transparent' }}>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, cursor: 'pointer' }} onClick={() => setEnvioAbierto(abiertoE ? null : e.id)}>
                          <ChevronRight style={{ width: 11, height: 11, color: P.accent, transform: abiertoE ? 'rotate(90deg)' : 'none', transition: 'transform 120ms' }} strokeWidth={2.4} />
                        </td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{e.numero_envio}</td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}` }}>
                          <span style={{ background: `${almCol}22`, color: almCol, padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{e.almacen_origen}</span>
                        </td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.textMuted, fontSize: 10.5 }}>{fmtDate(e.fecha_surtida)}</td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.textMuted, fontSize: 10.5 }}>
                          {e.fecha_entregada ? fmtDate(e.fecha_entregada) : <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>Pendiente</span>}
                        </td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontSize: 10.5 }}>
                          {e.metodo_envio === 'unidad_propia' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: P.accent }}><Truck style={{ width: 11, height: 11 }} strokeWidth={2} /> Unidad propia{e.unidad_envio ? ` · ${e.unidad_envio}` : ''}</span>
                          )}
                          {e.metodo_envio === 'paqueteria' && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: P.purple }}><Package style={{ width: 11, height: 11 }} strokeWidth={2} /> {e.paqueteria || 'Paquetería'}</span>
                          )}
                          {!e.metodo_envio && <span style={{ color: theme.textMuted, fontStyle: 'italic' }}>—</span>}
                        </td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>{e.numero_factura || '—'}</td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>{e.guia_rastreo || '—'}</td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtInt(pzs)}</td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}` }}>
                          {e.requiere_cita ? (
                            <span style={{ background: `${P.green}22`, color: P.green, padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10 }}>
                              Con cita{e.fecha_cita ? ` · ${fmtDate(e.fecha_cita)}` : ''}
                            </span>
                          ) : (
                            <span style={{ background: theme.bg, color: theme.textMuted, padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontText, fontWeight: 500, fontSize: 10 }}>Sin cita</span>
                          )}
                        </td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}` }}>
                          {entregado
                            ? <span style={{ background: `${P.green}22`, color: P.green, padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10 }}>Entregado</span>
                            : e.fecha_surtida
                            ? <span style={{ background: `${P.orange}22`, color: P.orange, padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10 }}>En tránsito</span>
                            : <span style={{ background: theme.bg, color: theme.textMuted, padding: '2px 8px', borderRadius: 999, fontFamily: TYPO.fontText, fontWeight: 500, fontSize: 10 }}>Programado</span>}
                        </td>
                        <td style={{ padding: '7px 8px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button onClick={() => onEditarEnvio(e)} style={{ padding: 4, background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer' }} title="Editar envío"><Edit2 style={{ width: 11, height: 11 }} strokeWidth={2} /></button>
                          <button onClick={() => onEliminarEnvio(e)} style={{ padding: 4, background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer' }} title="Eliminar envío"><Trash2 style={{ width: 11, height: 11 }} strokeWidth={2} /></button>
                        </td>
                      </tr>
                      {abiertoE && (
                        <tr>
                          <td colSpan={12} style={{ background: theme.bg, padding: '10px 14px', borderTop: `1px solid ${theme.border}` }}>
                            <div style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>SKUs de este envío</div>
                            {eskus.length === 0 ? (
                              <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>Sin SKUs capturados en este envío.</div>
                            ) : (
                              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 11 }}>
                                <thead>
                                  <tr>
                                    <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, fontFamily: TYPO.fontText, background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>SKU</th>
                                    <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, fontFamily: TYPO.fontText, background: theme.bg, borderBottom: `1px solid ${theme.border}` }}>Cant. surtida</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {eskus.map((es) => {
                                    const skuInfo = skus.find((s) => s.id === es.oc_sku_id);
                                    return (
                                      <tr key={es.id}>
                                        <td style={{ padding: '6px 10px', borderTop: `1px solid ${theme.border}`, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600 }}>{skuInfo?.sku || es.oc_sku_id}</td>
                                        <td style={{ padding: '6px 10px', borderTop: `1px solid ${theme.border}`, textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(es.cantidad_surtida)}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            )}
                            {e.notas && <div style={{ fontSize: 11, color: theme.textMuted, fontStyle: 'italic', marginTop: 6 }}>"{e.notas}"</div>}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COPILOT OPERACIONES · expandible en el pie
// ═══════════════════════════════════════════════════════════════════
function CopilotOps({ theme, P, isDark, open, setOpen, recs }) {
  const grad = `linear-gradient(135deg, ${P.accent}0F, ${P.purple}0F)`;
  return (
    <div style={{ borderTop: `1px solid ${theme.border}`, background: grad }}>
      <button onClick={() => setOpen((o) => !o)}
        style={{
          width: '100%', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'transparent', border: 0, cursor: 'pointer', fontFamily: TYPO.fontText,
        }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 24, height: 24, borderRadius: 7,
            background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`,
            color: '#FFF', display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <Sparkles style={{ width: 12, height: 12 }} strokeWidth={2} />
          </span>
          <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, letterSpacing: '-0.01em', color: theme.text }}>Copilot Operaciones</span>
            <span style={{ fontSize: 9.5, color: theme.textMuted, marginTop: 1 }}>
              {recs.length === 0 ? <>Sin recomendaciones · todo bajo control</>
                : <><strong style={{ color: P.accent, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{recs.length} acci{recs.length === 1 ? 'ón' : 'ones'} sugerida{recs.length === 1 ? '' : 's'}</strong> · click para {open ? 'plegar' : 'ver'}</>}
            </span>
          </div>
        </div>
        <span style={{
          width: 22, height: 22, borderRadius: 999,
          background: open ? `${P.accent}22` : (isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)'),
          color: open ? P.accent : theme.textMuted,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 200ms',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <ChevronDown style={{ width: 12, height: 12 }} strokeWidth={2.5} />
        </span>
      </button>
      <div style={{
        maxHeight: open ? 500 : 0, overflow: 'hidden',
        transition: 'max-height 250ms ease',
        borderTop: open ? `1px solid ${P.accent}22` : '1px solid transparent',
      }}>
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {recs.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: `repeat(${Math.min(recs.length, 3)}, 1fr)`, gap: 8 }}>
              {recs.map((r) => (
                <div key={r.id} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
                  padding: '10px 12px', cursor: 'pointer',
                }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                    fontSize: 8.5, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                    background: `${r.tagColor}22`, color: r.tagColor, marginBottom: 4, fontFamily: TYPO.fontDisplay,
                  }}>{r.tag}</span>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', marginBottom: 3, color: theme.text }}>
                    {r.title}
                  </div>
                  <p style={{ fontSize: 10.5, color: theme.textMuted, margin: 0, lineHeight: 1.4 }}>{r.desc}</p>
                </div>
              ))}
            </div>
          )}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999,
          }}>
            <Sparkles style={{ width: 12, height: 12, color: P.accent }} strokeWidth={2} />
            <input
              placeholder="Pregúntame algo sobre las OCs (próximamente)…"
              disabled
              style={{ border: 0, outline: 0, background: 'transparent', font: 'inherit', fontFamily: TYPO.fontText, fontSize: 11.5, flex: 1, color: theme.text, opacity: 0.6, cursor: 'not-allowed' }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL NUEVA / EDITAR OC
// ═══════════════════════════════════════════════════════════════════
function ModalOC({ theme, P, isDark, ocInicial, onClose, onSaved }) {
  const es = !!ocInicial;
  const [numero, setNumero] = useState(ocInicial?.numero_oc_cliente || '');
  const [cliente, setCliente] = useState(ocInicial?.cliente_key || 'digitalife');
  const [fechaCotizacionSolic, setFechaCotizacionSolic] = useState(ocInicial?.fecha_cotizacion_solicitada ? ocInicial.fecha_cotizacion_solicitada.slice(0, 16) : '');
  const [fechaCotizacionEnv, setFechaCotizacionEnv] = useState(ocInicial?.fecha_cotizacion_enviada ? ocInicial.fecha_cotizacion_enviada.slice(0, 16) : '');
  const [fechaRecibida, setFechaRecibida] = useState(ocInicial?.fecha_recibida ? ocInicial.fecha_recibida.slice(0, 16) : todayLocalIso());
  const [fechaProcesada, setFechaProcesada] = useState(ocInicial?.fecha_procesada ? ocInicial.fecha_procesada.slice(0, 16) : '');
  const [notas, setNotas] = useState(ocInicial?.notas || '');
  const esDico = cliente === 'dicotech';
  const [skus, setSkus] = useState(() => {
    if (ocInicial?.skus?.length) {
      return ocInicial.skus.map((s) => ({ id: s.id, sku: s.sku, cantidad_ordenada: s.cantidad_ordenada, precio_unitario: s.precio_unitario }));
    }
    return [{ sku: '', cantidad_ordenada: '', precio_unitario: '' }];
  });
  const [saving, setSaving] = useState(false);

  const addSku = () => setSkus([...skus, { sku: '', cantidad_ordenada: '', precio_unitario: '' }]);
  const removeSku = (i) => setSkus(skus.filter((_, j) => j !== i));
  const updateSku = (i, field, val) => setSkus(skus.map((s, j) => j === i ? { ...s, [field]: val } : s));

  const guardar = async () => {
    if (!numero.trim()) return alert('Falta el número de OC');
    if (!cliente) return alert('Falta el cliente');
    setSaving(true);
    const payload = {
      numero_oc_cliente: numero.trim(),
      cliente_key: cliente,
      fecha_cotizacion_solicitada: cliente === 'dicotech' ? toIso(fechaCotizacionSolic) : null,
      fecha_cotizacion_enviada: cliente === 'dicotech' ? toIso(fechaCotizacionEnv) : null,
      fecha_recibida: toIso(fechaRecibida),
      fecha_procesada: toIso(fechaProcesada),
      notas: notas.trim() || null,
      updated_at: nowIso(),
    };
    let ocId;
    if (es) {
      const { error } = await supabase.from('oc_clientes').update(payload).eq('id', ocInicial.id);
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      ocId = ocInicial.id;
      const nuevosIds = new Set(skus.filter((s) => s.id).map((s) => s.id));
      const originales = (ocInicial.skus || []).map((s) => s.id);
      const aBorrar = originales.filter((id) => !nuevosIds.has(id));
      if (aBorrar.length > 0) await supabase.from('oc_clientes_skus').delete().in('id', aBorrar);
    } else {
      const { data, error } = await supabase.from('oc_clientes').insert(payload).select('id').single();
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      ocId = data.id;
    }
    for (const s of skus) {
      if (!s.sku || !s.sku.trim()) continue;
      const row = { oc_id: ocId, sku: s.sku.trim(), cantidad_ordenada: Number(s.cantidad_ordenada) || 0, precio_unitario: Number(s.precio_unitario) || 0 };
      if (s.id) await supabase.from('oc_clientes_skus').update(row).eq('id', s.id);
      else await supabase.from('oc_clientes_skus').insert(row);
    }
    setSaving(false);
    onSaved();
  };

  return (
    <ModalShell theme={theme} P={P} isDark={isDark}
      eyebrow={es ? 'Editar orden existente' : `Captura nueva orden · ${new Date().toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' })}`}
      title={es ? 'Editar OC' : 'Nueva OC'}
      contexto={es ? <>Cliente <strong>{NOMBRE_CLIENTE[ocInicial.cliente_key]}</strong> · OC <code>{ocInicial.numero_oc_cliente}</code></> : 'Registra los datos iniciales de una nueva Orden de Compra. Podrás agregar envíos y SKUs después.'}
      onClose={onClose} onGuardar={guardar} saving={saving} ctaLabel={es ? 'Actualizar OC' : 'Guardar OC'}
      sideNote={<>Se guarda en <strong>tracking_pedidos</strong></>}>

      <SectionEyebrow theme={theme}>Cliente</SectionEyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {CLIENTES.map((c) => {
          const col = clienteColor(theme, c.key);
          const on = cliente === c.key;
          return (
            <button key={c.key} onClick={() => setCliente(c.key)}
              style={{
                padding: '10px 12px', background: on ? `${P.accent}14` : theme.surface,
                border: `1.5px solid ${on ? P.accent : theme.border}`, borderRadius: 12,
                fontFamily: TYPO.fontText, cursor: 'pointer',
                display: 'flex', alignItems: 'center', gap: 10, fontSize: 12,
                color: on ? P.accent : theme.text, transition: 'border-color 120ms, background 120ms',
              }}>
              <span style={{
                width: 30, height: 30, borderRadius: 9, background: col, color: '#FFF',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, letterSpacing: '-0.015em',
              }}>{c.letra}</span>
              <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'left', minWidth: 0 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12.5, letterSpacing: '-0.01em', color: on ? P.accent : theme.text }}>{c.nombre}</span>
                <span style={{ fontSize: 9.5, color: theme.textMuted, marginTop: 1 }}>{c.rol}</span>
              </div>
            </button>
          );
        })}
      </div>

      <SectionEyebrow theme={theme}>Detalles de la OC</SectionEyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FieldApple theme={theme} label="No. OC del cliente *">
          <InputPrefix theme={theme} prefix="#" value={numero} onChange={setNumero} placeholder="ej. OC-24891" />
        </FieldApple>
        <FieldApple theme={theme} label="Fecha recibida">
          <InputApple theme={theme} type="datetime-local" mono value={fechaRecibida} onChange={setFechaRecibida} />
        </FieldApple>
        <FieldApple theme={theme} label="Fecha procesada">
          <InputApple theme={theme} type="datetime-local" mono value={fechaProcesada} onChange={setFechaProcesada} />
        </FieldApple>
        <FieldApple theme={theme} label="Notas · opcional">
          <InputApple theme={theme} value={notas} onChange={setNotas} placeholder="Observaciones internas…" />
        </FieldApple>
      </div>

      {esDico && (
        <>
          <SectionEyebrow theme={theme}>Cotización · previo a la OC (solo Dicotech)</SectionEyebrow>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <FieldApple theme={theme} label="Dicotech solicitó cotización">
              <InputApple theme={theme} type="datetime-local" mono value={fechaCotizacionSolic} onChange={setFechaCotizacionSolic} />
            </FieldApple>
            <FieldApple theme={theme} label="Acteck envió cotización">
              <InputApple theme={theme} type="datetime-local" mono value={fechaCotizacionEnv} onChange={setFechaCotizacionEnv} />
            </FieldApple>
          </div>
        </>
      )}

      <SectionEyebrow theme={theme}>
        SKUs de la OC · lo que pidió el cliente
        <button onClick={addSku}
          style={{ marginLeft: 'auto', background: 'transparent', border: 0, color: P.accent, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}>
          + Agregar SKU
        </button>
      </SectionEyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 28px', gap: 8, marginBottom: 6 }}>
        {['SKU', 'Cant. ordenada', 'Precio unitario', ''].map((h, i) => (
          <span key={i} style={{ fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, textAlign: i === 0 ? 'left' : i === 3 ? 'center' : 'right' }}>{h}</span>
        ))}
      </div>
      {skus.map((s, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr 0.8fr 28px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
          <InputApple theme={theme} mono value={s.sku} onChange={(v) => updateSku(i, 'sku', v)} placeholder="ej. AC-935845" />
          <InputApple theme={theme} type="number" value={s.cantidad_ordenada} onChange={(v) => updateSku(i, 'cantidad_ordenada', v)} placeholder="0" />
          <InputApple theme={theme} type="number" step="0.01" value={s.precio_unitario} onChange={(v) => updateSku(i, 'precio_unitario', v)} placeholder="0.00" />
          <button onClick={() => removeSku(i)}
            style={{ background: 'transparent', border: 0, color: theme.textMuted, cursor: 'pointer', width: 28, height: 28, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
            onMouseEnter={(e) => e.currentTarget.style.color = P.red}
            onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}>
            <X style={{ width: 14, height: 14 }} strokeWidth={2} />
          </button>
        </div>
      ))}
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════
// MODAL NUEVO / EDITAR ENVÍO
// ═══════════════════════════════════════════════════════════════════
function ModalEnvio({ theme, P, isDark, ocContext, envio, envioSkusPorEnvio, onClose, onSaved }) {
  const es = !!envio;
  const skus = ocContext.skus || [];
  const numEnvio = es ? envio.numero_envio : ((ocContext.envios || []).reduce((m, e) => Math.max(m, e.numero_envio || 0), 0)) + 1;

  const [almacen, setAlmacen] = useState(envio?.almacen_origen || 'GDL');
  const [fechaSurtida, setFechaSurtida] = useState(envio?.fecha_surtida ? envio.fecha_surtida.slice(0, 16) : todayLocalIso());
  const [fechaEntregada, setFechaEntregada] = useState(envio?.fecha_entregada ? envio.fecha_entregada.slice(0, 16) : '');
  const [metodoEnvio, setMetodoEnvio] = useState(envio?.metodo_envio || 'unidad_propia');
  const [paqueteria, setPaqueteria] = useState(envio?.paqueteria || '');
  const [unidadEnvio, setUnidadEnvio] = useState(envio?.unidad_envio || '');
  const [numFactura, setNumFactura] = useState(envio?.numero_factura || '');
  const [guia, setGuia] = useState(envio?.guia_rastreo || '');
  const [requiereCita, setRequiereCita] = useState(!!envio?.requiere_cita);
  const [fechaCita, setFechaCita] = useState(envio?.fecha_cita ? envio.fecha_cita.slice(0, 16) : '');
  const [notas, setNotas] = useState(envio?.notas || '');

  const [cantidades, setCantidades] = useState(() => {
    const map = {};
    if (es) {
      const es_ = envioSkusPorEnvio[envio.id] || [];
      for (const x of es_) map[x.oc_sku_id] = x.cantidad_surtida;
    }
    return map;
  });
  const setCant = (skuId, val) => setCantidades((c) => ({ ...c, [skuId]: val }));

  const [saving, setSaving] = useState(false);

  const surtidoOtrosEnvios = useMemo(() => {
    const acc = {};
    for (const otroEnvio of (ocContext.envios || [])) {
      if (es && otroEnvio.id === envio.id) continue;
      const eskus = envioSkusPorEnvio[otroEnvio.id] || [];
      for (const x of eskus) acc[x.oc_sku_id] = (acc[x.oc_sku_id] || 0) + Number(x.cantidad_surtida || 0);
    }
    return acc;
  }, [ocContext.envios, envioSkusPorEnvio, envio, es]);

  // Progreso para ring
  const enviosTotalesEsperados = ocContext.envios_esperados || (ocContext.envios?.length || 0) + (es ? 0 : 1);
  const pieDone = es ? numEnvio : Math.max(1, numEnvio);
  const pieTotal = Math.max(enviosTotalesEsperados, pieDone);
  const pct = pieDone / pieTotal;

  // Total del envío
  const totalEnvio = Object.values(cantidades).reduce((s, v) => s + (Number(v) || 0), 0);
  const totalOc = skus.reduce((s, x) => s + Number(x.cantidad_ordenada || 0), 0);
  const yaSurtidoOtros = Object.values(surtidoOtrosEnvios).reduce((s, v) => s + v, 0);
  const cierraOc = totalOc > 0 && (yaSurtidoOtros + totalEnvio) >= totalOc;
  const faltante = Math.max(0, totalOc - yaSurtidoOtros - totalEnvio);

  const guardar = async () => {
    if (!almacen) return alert('Falta almacén de origen');
    setSaving(true);
    let envioId;
    if (es) {
      const { error } = await supabase.from('oc_envios').update({
        almacen_origen: almacen,
        fecha_surtida: toIso(fechaSurtida),
        fecha_entregada: toIso(fechaEntregada),
        metodo_envio: metodoEnvio,
        paqueteria: metodoEnvio === 'paqueteria' ? (paqueteria || null) : null,
        unidad_envio: metodoEnvio === 'unidad_propia' ? (unidadEnvio.trim() || null) : null,
        numero_factura: numFactura.trim() || null,
        guia_rastreo: guia.trim() || null,
        requiere_cita: requiereCita,
        fecha_cita: requiereCita ? toIso(fechaCita) : null,
        notas: notas.trim() || null,
        updated_at: nowIso(),
      }).eq('id', envio.id);
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      envioId = envio.id;
      await supabase.from('oc_envio_skus').delete().eq('envio_id', envioId);
    } else {
      const { data, error } = await supabase.from('oc_envios').insert({
        oc_id: ocContext.id,
        numero_envio: numEnvio,
        almacen_origen: almacen,
        fecha_surtida: toIso(fechaSurtida),
        fecha_entregada: toIso(fechaEntregada),
        metodo_envio: metodoEnvio,
        paqueteria: metodoEnvio === 'paqueteria' ? (paqueteria || null) : null,
        unidad_envio: metodoEnvio === 'unidad_propia' ? (unidadEnvio.trim() || null) : null,
        numero_factura: numFactura.trim() || null,
        guia_rastreo: guia.trim() || null,
        requiere_cita: requiereCita,
        fecha_cita: requiereCita ? toIso(fechaCita) : null,
        notas: notas.trim() || null,
      }).select('id').single();
      if (error) { setSaving(false); return alert('Error: ' + error.message); }
      envioId = data.id;
    }
    const rows = Object.entries(cantidades)
      .map(([oc_sku_id, cant]) => ({ envio_id: envioId, oc_sku_id, cantidad_surtida: Number(cant) || 0 }))
      .filter((r) => r.cantidad_surtida > 0);
    if (rows.length > 0) {
      const { error } = await supabase.from('oc_envio_skus').insert(rows);
      if (error) { setSaving(false); return alert('Error SKUs envío: ' + error.message); }
    }
    setSaving(false);
    onSaved();
  };

  const ringComponent = (
    <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0, marginLeft: 6 }}>
      <svg viewBox="0 0 40 40" style={{ transform: 'rotate(-90deg)', width: '100%', height: '100%' }}>
        <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
        <circle cx="20" cy="20" r="16" fill="none" stroke="#FFF" strokeWidth="4" strokeLinecap="round"
          strokeDasharray={`${pct * 100.5} 100.5`} strokeDashoffset="0" />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em', lineHeight: 1 }}>
          {numEnvio}<span style={{ color: 'rgba(255,255,255,0.55)', fontWeight: 500, letterSpacing: 0 }}>/{pieTotal}</span>
        </span>
        <span style={{ fontFamily: TYPO.fontText, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.55)', fontWeight: 500, marginTop: 2 }}>envíos</span>
      </div>
    </div>
  );

  return (
    <ModalShell theme={theme} P={P} isDark={isDark} wide
      eyebrow="Registrar envío parcial"
      title={es ? `Editar envío #${envio.numero_envio}` : 'Nuevo envío'}
      contexto={<>OC <code>#{ocContext.numero_oc_cliente} · {NOMBRE_CLIENTE[ocContext.cliente_key]}</code> · captura factura, guía y los SKUs incluidos en este envío.</>}
      heroExtra={ringComponent}
      onClose={onClose} onGuardar={guardar} saving={saving} ctaLabel={es ? 'Actualizar envío' : 'Guardar envío'}
      sideNote={<>Total OC · <strong>{fmtInt(totalOc)} pz</strong> · faltan {fmtInt(faltante)}</>}>

      <SectionEyebrow theme={theme}>Datos del envío</SectionEyebrow>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <FieldApple theme={theme} label="Almacén de origen *">
          <div style={{ display: 'flex', gap: 6 }}>
            {ALMACENES.map((a) => (
              <button key={a} onClick={() => setAlmacen(a)}
                style={{
                  flex: 1, padding: '9px 14px', borderRadius: 999,
                  background: almacen === a ? P.accent : theme.surface,
                  border: `1px solid ${almacen === a ? P.accent : theme.border}`,
                  color: almacen === a ? '#FFF' : theme.text,
                  fontFamily: TYPO.fontText, fontSize: 12, fontWeight: almacen === a ? 600 : 500, cursor: 'pointer',
                }}>{a}</button>
            ))}
          </div>
        </FieldApple>
        <FieldApple theme={theme} label="No. Factura">
          <InputPrefix theme={theme} prefix="A-" value={numFactura} onChange={setNumFactura} placeholder="89298" mono />
        </FieldApple>
        <FieldApple theme={theme} label="Fecha surtida">
          <InputApple theme={theme} type="datetime-local" mono value={fechaSurtida} onChange={setFechaSurtida} />
        </FieldApple>
        <FieldApple theme={theme} label="Fecha entregada">
          <InputApple theme={theme} type="datetime-local" mono value={fechaEntregada} onChange={setFechaEntregada} />
        </FieldApple>
      </div>

      <SectionEyebrow theme={theme}>Método de envío</SectionEyebrow>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={() => setMetodoEnvio('unidad_propia')}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            background: metodoEnvio === 'unidad_propia' ? `${P.accent}14` : theme.surface,
            border: `1.5px solid ${metodoEnvio === 'unidad_propia' ? P.accent : theme.border}`,
            color: metodoEnvio === 'unidad_propia' ? P.accent : theme.text,
            fontFamily: TYPO.fontText, fontSize: 12, fontWeight: metodoEnvio === 'unidad_propia' ? 600 : 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
          <Truck style={{ width: 14, height: 14 }} strokeWidth={2} /> Unidad propia
        </button>
        <button onClick={() => setMetodoEnvio('paqueteria')}
          style={{
            flex: 1, padding: '10px 14px', borderRadius: 12,
            background: metodoEnvio === 'paqueteria' ? `${P.accent}14` : theme.surface,
            border: `1.5px solid ${metodoEnvio === 'paqueteria' ? P.accent : theme.border}`,
            color: metodoEnvio === 'paqueteria' ? P.accent : theme.text,
            fontFamily: TYPO.fontText, fontSize: 12, fontWeight: metodoEnvio === 'paqueteria' ? 600 : 500, cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'center',
          }}>
          <Package style={{ width: 14, height: 14 }} strokeWidth={2} /> Paquetería
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 8 }}>
        {metodoEnvio === 'unidad_propia' && (
          <FieldApple theme={theme} label="Unidad · opcional">
            <InputApple theme={theme} value={unidadEnvio} onChange={setUnidadEnvio} placeholder="ej. Camión Acteck #4" />
          </FieldApple>
        )}
        {metodoEnvio === 'paqueteria' && (
          <FieldApple theme={theme} label="Paquetería">
            <select value={paqueteria} onChange={(e) => setPaqueteria(e.target.value)}
              style={{
                padding: '9px 13px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
                fontFamily: TYPO.fontText, fontSize: 12.5, color: theme.text, outline: 0, width: '100%',
              }}>
              <option value="">Seleccionar…</option>
              {PAQUETERIAS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </FieldApple>
        )}
        <FieldApple theme={theme} label="Guía / rastreo">
          <InputApple theme={theme} mono value={guia} onChange={setGuia} placeholder="ej. 1Z9877W..." />
        </FieldApple>
      </div>

      <div style={{ marginTop: 10, padding: '10px 14px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 10 }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text }}>
          <input type="checkbox" checked={requiereCita} onChange={(e) => setRequiereCita(e.target.checked)} style={{ accentColor: P.accent }} />
          Requiere cita de entrega
        </label>
        {requiereCita && (
          <div style={{ marginTop: 8 }}>
            <FieldApple theme={theme} label="Fecha y hora de cita">
              <InputApple theme={theme} type="datetime-local" mono value={fechaCita} onChange={setFechaCita} />
            </FieldApple>
          </div>
        )}
      </div>

      <SectionEyebrow theme={theme}>Cantidades surtidas en este envío</SectionEyebrow>
      {skus.length === 0 ? (
        <div style={{ fontSize: 11.5, color: theme.textMuted, fontStyle: 'italic', padding: '12px 0' }}>La OC no tiene SKUs capturados.</div>
      ) : (
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ padding: '9px 14px', display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 100px', gap: 8, alignItems: 'center', fontFamily: TYPO.fontText, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600, borderBottom: `1px solid ${theme.border}`, background: theme.bg }}>
            <span>SKU</span>
            <span>Descripción</span>
            <span style={{ textAlign: 'right' }}>Ordenada</span>
            <span style={{ textAlign: 'right' }}>Ya surtido</span>
            <span style={{ textAlign: 'right' }}>Este envío</span>
          </div>
          {skus.map((s) => {
            const otros = surtidoOtrosEnvios[s.id] || 0;
            const restante = Math.max(0, Number(s.cantidad_ordenada || 0) - otros);
            return (
              <div key={s.id} style={{ padding: '9px 14px', display: 'grid', gridTemplateColumns: '110px 1fr 80px 80px 100px', gap: 8, alignItems: 'center', borderTop: `1px solid ${theme.divider || theme.border}`, fontSize: 11.5 }}>
                <span style={{
                  fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: theme.text,
                  background: `${P.accent}14`, padding: '3px 8px', borderRadius: 6, display: 'inline-block', letterSpacing: '-0.005em',
                  width: 'fit-content',
                }}>{s.sku}</span>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  <span style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, fontWeight: 400, fontVariantNumeric: 'tabular-nums' }}>
                    Quedan {fmtInt(restante)}
                  </span>
                </div>
                <span style={{ textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(s.cantidad_ordenada)}</span>
                <span style={{ textAlign: 'right', color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(otros)}</span>
                <input type="number" min="0" value={cantidades[s.id] ?? ''} onChange={(e) => setCant(s.id, e.target.value)}
                  placeholder="0"
                  style={{
                    padding: '6px 10px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8,
                    fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, outline: 0,
                    width: '100%', textAlign: 'right', fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.005em',
                  }} />
              </div>
            );
          })}
        </div>
      )}
      {totalOc > 0 && (
        <div style={{
          marginTop: 8, padding: '9px 12px',
          background: cierraOc ? `${P.green}14` : `${P.orange}12`,
          border: `1px solid ${cierraOc ? P.green : P.orange}40`, borderRadius: 10,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, fontSize: 11,
        }}>
          <span style={{ color: isDark ? (cierraOc ? P.green : P.orange) : theme.text, fontFamily: TYPO.fontText }}>
            {skus.filter((s) => cantidades[s.id] > 0).length} SKUs seleccionados · <strong style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(totalEnvio)} pz</strong> en este envío
          </span>
          <span style={{
            padding: '3px 10px', borderRadius: 999, background: cierraOc ? P.green : P.orange, color: '#FFF',
            fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10.5, letterSpacing: '-0.005em',
          }}>
            {cierraOc ? 'Cierra el 100% de la OC' : `Faltarían ${fmtInt(faltante)} pz`}
          </span>
        </div>
      )}

      <SectionEyebrow theme={theme}>Notas del envío · opcional</SectionEyebrow>
      <FieldApple theme={theme}>
        <InputApple theme={theme} value={notas} onChange={setNotas} placeholder="Observaciones del envío…" />
      </FieldApple>
    </ModalShell>
  );
}

// ═══════════════════════════════════════════════════════════════════
// COMPONENTES DEL MODAL
// ═══════════════════════════════════════════════════════════════════
function ModalShell({ theme, P, isDark, wide, eyebrow, title, contexto, heroExtra, onClose, onGuardar, saving, ctaLabel, sideNote, children }) {
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = 'rgba(255,255,255,0.72)';
  const heroSub = 'rgba(255,255,255,0.55)';
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(0,0,0,0.40)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
      fontFamily: TYPO.fontText,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18,
        boxShadow: isDark ? '0 16px 48px rgba(0,0,0,0.55)' : '0 16px 48px rgba(0,0,0,0.20), 0 4px 12px rgba(0,0,0,0.08)',
        overflow: 'hidden', maxWidth: wide ? 780 : 640, width: '100%', maxHeight: '92vh',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Hero mini */}
        <div style={{ background: heroBg, color: heroText, padding: '16px 22px', position: 'relative', overflow: 'hidden', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 14 }}>
          {isDark && (
            <div style={{ position: 'absolute', top: '-40%', right: '-8%', width: '45%', height: '100%', background: `radial-gradient(circle, ${P.accent}29 0%, transparent 70%)`, pointerEvents: 'none' }} />
          )}
          <div style={{ position: 'relative', minWidth: 0, flex: 1 }}>
            {eyebrow && <p style={{ fontFamily: TYPO.fontText, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: heroSub, fontWeight: 500, margin: 0 }}>{eyebrow}</p>}
            <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', color: heroText, margin: '4px 0 4px', lineHeight: 1.15 }}>{title}</h3>
            {contexto && (
              <p style={{ fontFamily: TYPO.fontText, fontSize: 11.5, color: heroMuted, lineHeight: 1.5, margin: 0, fontVariantNumeric: 'tabular-nums' }}>
                {typeof contexto === 'string' ? contexto : React.Children.map(contexto, (child) => {
                  if (typeof child === 'string') return child;
                  if (child?.type === 'code') return <code style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, background: 'rgba(255,255,255,0.10)', padding: '1px 6px', borderRadius: 6, color: heroText }}>{child.props.children}</code>;
                  if (child?.type === 'strong') return <strong style={{ color: heroText, fontWeight: 500 }}>{child.props.children}</strong>;
                  return child;
                })}
              </p>
            )}
          </div>
          {heroExtra}
          <button onClick={onClose}
            style={{ color: 'rgba(255,255,255,0.55)', background: 'transparent', border: 0, fontSize: 15, cursor: 'pointer', padding: '4px 8px', lineHeight: 1, position: 'relative', flexShrink: 0 }}>
            <X style={{ width: 15, height: 15 }} strokeWidth={2} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '6px 22px 18px', overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
          {children}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: `1px solid ${theme.border}`, background: theme.bg, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <div style={{ fontSize: 10.5, color: theme.textMuted, display: 'flex', alignItems: 'center', gap: 6, fontFamily: TYPO.fontText }}>
            {sideNote}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '8px 16px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, cursor: 'pointer', fontWeight: 500 }}>
              Cancelar
            </button>
            <button onClick={onGuardar} disabled={saving}
              style={{ padding: '8px 20px', background: P.accent, border: 0, color: '#FFF', borderRadius: 999, fontFamily: TYPO.fontText, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', fontWeight: 600, letterSpacing: '-0.005em', opacity: saving ? 0.5 : 1, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {saving ? 'Guardando…' : <>{ctaLabel} ›</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionEyebrow({ theme, children }) {
  return (
    <div style={{
      fontFamily: TYPO.fontText, fontSize: 10, textTransform: 'uppercase',
      letterSpacing: '0.10em', color: theme.textMuted, fontWeight: 600,
      margin: '12px 2px 8px', display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {children}
      <span style={{ flex: 1, height: 1, background: theme.divider || theme.border }} />
    </div>
  );
}

function FieldApple({ theme, label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {label && (
        <label style={{ fontFamily: TYPO.fontText, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>
          {label}
        </label>
      )}
      {children}
    </div>
  );
}

function InputApple({ theme, mono, value, onChange, ...rest }) {
  return (
    <input value={value ?? ''} onChange={(e) => onChange(e.target.value)}
      style={{
        padding: '9px 13px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
        fontFamily: mono ? '"SF Mono", ui-monospace, monospace' : TYPO.fontText,
        fontSize: 12.5, color: theme.text, outline: 0,
      }}
      {...rest} />
  );
}

function InputPrefix({ theme, prefix, mono, value, onChange, placeholder }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', padding: '0 12px',
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
    }}>
      <span style={{
        fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 12, color: theme.textMuted, fontWeight: 500,
        paddingRight: 6, borderRight: `1px solid ${theme.divider || theme.border}`, marginRight: 8,
      }}>{prefix}</span>
      <input value={value ?? ''} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: 0, outline: 0, background: 'transparent', padding: '9px 0',
          fontFamily: mono ? '"SF Mono", ui-monospace, monospace' : TYPO.fontText,
          fontSize: 12, color: theme.text, flex: 1, fontVariantNumeric: 'tabular-nums',
          width: '100%',
        }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
//  Métricas · rings Apple Fitness + drill panel
// ═══════════════════════════════════════════════════════════════════
function MetricasRings({ metricas, expandida, onExpand, theme, P }) {
  const rings = ['recepcion', 'procesamiento', 'envio', 'total'];
  const active = expandida && metricas[expandida];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 10 }}>
        {rings.map((k) => (
          <RingCard key={k} data={metricas[k]} theme={theme} P={P}
            active={expandida === k}
            onClick={() => onExpand(k)} />
        ))}
      </div>
      {active && <DrillPanel data={active} theme={theme} P={P} />}
    </div>
  );
}

function RingCard({ data, active, onClick, theme, P }) {
  const [hover, setHover] = React.useState(false);
  const isDark = theme.mode === 'dark';
  const overMeta = data.avg != null && data.avg > data.meta;
  const ringColor = overMeta ? P.orange : P.green;
  const CIRC = 2 * Math.PI * 42;
  const pct = Math.min(100, Math.max(0, data.pctMeta || 0));
  const dashOffset = CIRC * (1 - pct / 100);
  const goodDelta = data.delta != null && data.delta < 0;
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        background: theme.surface, borderRadius: 14, padding: 14, cursor: 'pointer',
        border: `${active ? 1.5 : 1}px solid ${active ? P.accent : theme.border}`,
        boxShadow: active ? `0 4px 20px ${P.accent}22` : hover ? `0 2px 10px ${theme.text}0F` : 'none',
        transform: hover && !active ? 'translateY(-2px)' : 'none',
        transition: 'transform 200ms cubic-bezier(0.32, 0.72, 0, 1), border-color 200ms, box-shadow 200ms',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.text }}>{data.label}</span>
        {data.delta != null && (
          <span style={{
            fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700,
            padding: '2px 6px', borderRadius: 999,
            background: goodDelta ? `${P.green}1E` : `${P.red}1E`,
            color: goodDelta ? P.green : P.red, letterSpacing: '-0.005em',
          }}>{goodDelta ? '▼' : '▲'} {Math.abs(data.delta).toFixed(1)}d</span>
        )}
      </div>
      <div style={{ position: 'relative', margin: '4px auto 4px', width: 88, height: 88 }}>
        <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
          <circle cx="50" cy="50" r="42" fill="none" stroke={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'} strokeWidth="8" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={ringColor} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={CIRC} strokeDashoffset={dashOffset}
            style={{ transition: 'stroke-dashoffset 500ms cubic-bezier(0.32, 0.72, 0, 1)' }} />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em', color: theme.text, lineHeight: 1 }}>
            {data.avg != null ? data.avg.toFixed(1) : '—'}
          </div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginTop: 2 }}>días</div>
        </div>
      </div>
      <div style={{ textAlign: 'center', fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, lineHeight: 1.3 }}>
        meta <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{data.meta}d</strong> · {data.count} OC{data.count === 1 ? '' : 's'}
      </div>
    </div>
  );
}

function DrillPanel({ data, theme, P }) {
  const clientesArr = Object.entries(data.porCliente).map(([k, v]) => ({
    key: k, nombre: NOMBRE_CLIENTE[k] || k, avg: v.avg, count: v.count,
  })).sort((a, b) => (b.avg || 0) - (a.avg || 0));
  const maxCli = Math.max(1, ...clientesArr.map((c) => c.avg || 0));
  const maxSem = Math.max(1, ...data.porSemana.map((s) => s.avg || 0));
  const barColor = (v) => (v != null && v > data.meta ? P.orange : P.green);
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: '14px 16px 12px',
      animation: 'drillFadeIn 260ms cubic-bezier(0.32, 0.72, 0, 1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{
          padding: '2px 8px', borderRadius: 999,
          background: `${P.accent}1E`, color: P.accent,
          fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>{data.label}</span>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>
          Desglose · {data.avg != null ? `${data.avg.toFixed(1)}d promedio` : 'sin datos aún'}
        </h5>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
        <DrillCol theme={theme} title="Por cliente">
          {clientesArr.length === 0 && <DrillEmpty theme={theme}>Sin datos aún</DrillEmpty>}
          {clientesArr.map((c) => (
            <DrillRow key={c.key} theme={theme}
              lbl={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 7, height: 7, borderRadius: 999, background: clienteColor(theme, c.key) }} />
                {c.nombre}
              </span>}
              barPct={c.avg ? (c.avg / maxCli * 100) : 0}
              barColor={barColor(c.avg)}
              val={c.avg != null ? `${c.avg.toFixed(1)}d` : '—'}
            />
          ))}
        </DrillCol>
        <DrillCol theme={theme} title="Por encargado">
          <div style={{ padding: '20px 4px', textAlign: 'center', fontSize: 11, color: theme.textMuted, fontFamily: TYPO.fontText, lineHeight: 1.5 }}>
            <span style={{
              display: 'inline-block', padding: '2px 8px', borderRadius: 999,
              background: `${theme.textMuted}18`, color: theme.textMuted,
              fontFamily: TYPO.fontDisplay, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em',
              marginBottom: 8,
            }}>Próximamente</span>
            <div>Necesitamos agregar el campo <strong style={{ color: theme.text }}>encargado</strong> a la tabla OCs.</div>
          </div>
        </DrillCol>
        <DrillCol theme={theme} title="Por semana (últimas 4)">
          {data.porSemana.length === 0 && <DrillEmpty theme={theme}>Sin datos aún</DrillEmpty>}
          {data.porSemana.map((s) => (
            <DrillRow key={s.sem} theme={theme}
              lbl={s.sem.replace(/^\d{4}-W/, 'Sem ')}
              barPct={s.avg ? (s.avg / maxSem * 100) : 0}
              barColor={barColor(s.avg)}
              val={s.avg != null ? `${s.avg.toFixed(1)}d` : '—'}
            />
          ))}
        </DrillCol>
      </div>
      <style>{`@keyframes drillFadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

function DrillCol({ theme, title, children }) {
  return (
    <div>
      <div style={{
        fontFamily: TYPO.fontText, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: theme.textMuted, fontWeight: 600, marginBottom: 8,
      }}>{title}</div>
      {children}
    </div>
  );
}

function DrillRow({ theme, lbl, barPct, barColor, val }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '5px 0', borderBottom: `1px solid ${theme.divider || theme.border}`,
      fontSize: 11.5,
    }}>
      <span style={{ flex: 1, fontFamily: TYPO.fontText, color: theme.text, fontWeight: 500, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{lbl}</span>
      <span style={{ width: 60, height: 4, borderRadius: 999, background: `${theme.text}0F`, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', background: barColor, borderRadius: 999, width: `${Math.min(100, barPct)}%`, transition: 'width 400ms cubic-bezier(0.32, 0.72, 0, 1)' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 11, fontWeight: 600, color: theme.text, minWidth: 34, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{val}</span>
    </div>
  );
}

function DrillEmpty({ theme, children }) {
  return (
    <div style={{ padding: '12px 4px', fontSize: 11, color: theme.textMuted, fontFamily: TYPO.fontText, textAlign: 'center' }}>
      {children}
    </div>
  );
}
