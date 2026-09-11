// CreditoCobranzaV2 · V3 · pestaña "Crédito y Cobranza" (Digitalife · PCEL · Dicotech)
// Armado sólo con el kit (src/components/kit):
// ─ Hero negro: eyebrow "Crédito y Cobranza · Cliente · semana N", frase por reglas, 3 HeroStat (saldo · vencido · DSO)
// ─ 4 KpiCard con el aging (0-30 · 31-60 · 61-90 · +90) con barra proporcional y tono por tramo (click = filtra la tabla)
// ─ Panel "Vencimientos próximos" (Recharts) + Panel "Línea de crédito y corte" (uso de línea, deltas vs corte anterior)
// ─ Panel "Facturas con saldo" con TablaCompacta (búsqueda, filtro por tramo, orden, totales) + ExportMenu
// ─ Panel plegable "Historial de cortes" (serie semanal con GraficaLineas del kit + tabla; click en una semana = corte seleccionado)
// Preserva la data que ya cargaba (estados_cuenta + detalle + clientes_credito_config + v_fact_cliente_mes).

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Search } from 'lucide-react';
import {
  ComposedChart, Bar, Cell, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Pill, Segmented, TablaCompacta, Panel, Boton, SkeletonPantalla, GraficaLineas, EASE, DUR } from '../../components/kit';

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DIA_MS = 1000 * 60 * 60 * 24;

const fmt$ = (v) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('es-MX')}`;
};
const fmt$Full = (v) => '$' + Math.round(Number(v || 0)).toLocaleString('es-MX');

const fmtFechaCorta = (iso) => {
  if (!iso) return '—';
  const p = String(iso).slice(0, 10).split('-').map((n) => parseInt(n, 10));
  if (p.length !== 3 || !p[0]) return String(iso);
  return `${p[2]}-${MESES_CORTOS[p[1] - 1]}`;
};

const paletteFromTheme = (theme) => ({
  accent: theme.accent || '#007AFF',
  green:  theme.green  || '#34C759',
  orange: theme.orange || '#FF9500',
  red:    theme.red    || '#FF3B30',
  yellow: theme.yellow || '#FFCC00',
});

// tono semántico (good/warn/bad) → tono de Pill
const TONE = { good: 'green', warn: 'orange', bad: 'red' };

// Tramos del aging · tono por tramo (el kit pinta el color)
const TRAMOS = [
  { id: '0_30',  label: '0–30 días',  min: 1,  max: 30,       tone: 'yellow' },
  { id: '31_60', label: '31–60 días', min: 31, max: 60,       tone: 'orange' },
  { id: '61_90', label: '61–90 días', min: 61, max: 90,       tone: 'red' },
  { id: 'mas90', label: '+90 días',   min: 91, max: Infinity, tone: 'red' },
];
const tramoDe = (d) => (d <= 0 ? null : TRAMOS.find((t) => d >= t.min && d <= t.max)?.id || 'mas90');

// ═══════════════════════════════════════════════════════════════════
export default function CreditoCobranzaV2({ cliente, clienteKey }) {
  const { theme } = useTheme();
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';
  const rootRef = useRef(null); // raíz para exportar PDF
  const perfil = usePerfil();
  if (!puedeVerPestanaCliente(perfil, clienteKey, 'cartera')) {
    return <SinAcceso motivo={`No tienes acceso a Crédito y Cobranza de ${clienteKey || 'este cliente'}.`} />;
  }
  const nombreCliente = typeof cliente === 'string' ? cliente : (cliente?.nombre || clienteKey || '');

  const [cortes, setCortes] = useState([]);          // todos los cortes del cliente (más reciente primero)
  const [corteSel, setCorteSel] = useState(null);    // id del corte seleccionado (semana)
  const [detalle, setDetalle] = useState([]);
  const [detallePrev, setDetallePrev] = useState([]);
  const [sellIn, setSellIn] = useState(0);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [cargandoDet, setCargandoDet] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [filtro, setFiltro] = useState('todas');
  const [orden, setOrden] = useState({ col: 'dAtraso', dir: 'desc' });

  // 1) Cortes + config + sell in YTD
  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    let cancel = false;
    setLoading(true);
    (async () => {
      const anio = new Date().getFullYear();
      const [ecRes, siRes, cfgRes] = await Promise.all([
        supabase.from('estados_cuenta').select('*').eq('cliente', clienteKey)
          .order('anio', { ascending: false }).order('semana', { ascending: false }).limit(30),
        // v_fact_cliente_mes: 12 filas; antes facturacion_clientes cruda sin paginar.
        supabase.from('v_fact_cliente_mes').select('mes, monto').eq('cliente_key', clienteKey).eq('anio', anio),
        supabase.from('clientes_credito_config').select('*').eq('cliente', clienteKey).maybeSingle(),
      ]);
      if (cancel) return;
      const arr = ecRes.data || [];
      setCortes(arr);
      setCorteSel(arr[0]?.id ?? null);
      setConfig(cfgRes.data || null);
      setSellIn((siRes.data || []).reduce((s, r) => s + (Number(r.monto) || 0), 0));
      if (!arr.length) setLoading(false);
    })();
    return () => { cancel = true; };
  }, [clienteKey]);

  const idxSel = useMemo(() => Math.max(0, cortes.findIndex((c) => c.id === corteSel)), [cortes, corteSel]);
  const estado = cortes[idxSel] || null;
  const estadoPrev = cortes[idxSel + 1] || null;
  const esUltimo = idxSel === 0;

  // 2) Detalle del corte seleccionado + anterior
  useEffect(() => {
    if (!estado) return;
    let cancel = false;
    setCargandoDet(true);
    (async () => {
      const ids = [estado?.id, estadoPrev?.id].filter(Boolean);
      const { data: det } = await supabase.from('estados_cuenta_detalle').select('*').in('estado_cuenta_id', ids);
      if (cancel) return;
      const detAll = det || [];
      setDetalle(detAll.filter((r) => r.estado_cuenta_id === estado?.id));
      setDetallePrev(detAll.filter((r) => r.estado_cuenta_id === estadoPrev?.id));
      setCargandoDet(false);
      setLoading(false);
    })();
    return () => { cancel = true; };
  }, [estado?.id, estadoPrev?.id]);

  // Referencia temporal: hoy para el último corte, la fecha de corte para semanas anteriores.
  const hoy = new Date();
  const refMs = (!esUltimo && estado?.fecha_corte) ? new Date(estado.fecha_corte + 'T00:00:00').getTime() : hoy.getTime();
  const refPrevMs = estadoPrev?.fecha_corte ? new Date(estadoPrev.fecha_corte + 'T00:00:00').getTime() : refMs;

  const mesesVenc = useMemo(() => {
    if (!estado) return [];
    const base = new Date(refMs);
    return [
      { k: 1, monto: Number(estado.venc_mes_1) || 0 },
      { k: 2, monto: Number(estado.venc_mes_2) || 0 },
      { k: 3, monto: Number(estado.venc_mes_3) || 0 },
    ].map((x) => {
      const d = new Date(base.getFullYear(), base.getMonth() + x.k - 1, 1);
      return { ...x, label: NOMBRES_MES[d.getMonth()], mesCorto: MESES_CORTOS[d.getMonth()] };
    });
  }, [estado, refMs]);

  const notasCredito = Math.abs(Number(estado?.notas_credito) || 0);
  const tipoCambio = Number(estado?.tipo_cambio) || 0;
  const lineaUSD = Number(config?.linea_credito_usd) || 0;
  const lineaMXNPagare = Number(config?.linea_credito_mxn_pagare) || 0;
  const PLAZO = Number(config?.plazo_dias_credito) || 90;
  const lineaMXN = lineaUSD * tipoCambio + lineaMXNPagare;

  const diasAtrasoA = (f, ref) => {
    if (!f.vencimiento) return 0;
    return Math.max(0, Math.floor((ref - new Date(f.vencimiento + 'T00:00:00').getTime()) / DIA_MS));
  };
  const diasAtraso = (f) => diasAtrasoA(f, refMs);
  const diasParaVencer = (f) => {
    if (!f.vencimiento) return null;
    return Math.floor((new Date(f.vencimiento + 'T00:00:00').getTime() - refMs) / DIA_MS);
  };
  const dsoDe = (rows, ref) => {
    let num = 0, den = 0;
    rows.forEach((f) => {
      if (!f.fecha_emision) return;
      const s = Number(f.saldo_actual) || 0;
      const d = Math.floor((ref - new Date(f.fecha_emision + 'T00:00:00').getTime()) / DIA_MS);
      if (d < 0) return;
      num += s * d; den += s;
    });
    return den > 0 ? Math.round(num / den) : null;
  };

  const facturasConSaldo = useMemo(() => (detalle || []).filter((f) => Number(f.saldo_actual) > 0), [detalle]);
  const facturasPrev = useMemo(() => (detallePrev || []).filter((f) => Number(f.saldo_actual) > 0), [detallePrev]);
  const suma = (rows) => rows.reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0);

  // Saldos: preferir header del corte; si están vacíos, calcular desde detalle
  const saldoActual = Number(estado?.saldo_actual) > 0 ? Number(estado.saldo_actual) : suma(facturasConSaldo);
  const vencidas = useMemo(() => facturasConSaldo.filter((f) => diasAtraso(f) > 0), [facturasConSaldo, refMs]);
  const saldoVencido = Number(estado?.saldo_vencido) > 0 ? Number(estado.saldo_vencido) : suma(vencidas);
  const saldoAVencer = Number(estado?.saldo_a_vencer) > 0 ? Number(estado.saldo_a_vencer) : suma(facturasConSaldo.filter((f) => diasAtraso(f) === 0));
  const usoPct = lineaMXN > 0 ? Math.min(Math.round((saldoActual / lineaMXN) * 100), 999) : null;

  const saldoActualPrev = Number(estadoPrev?.saldo_actual) > 0 ? Number(estadoPrev.saldo_actual) : suma(facturasPrev);
  const saldoVencidoPrev = Number(estadoPrev?.saldo_vencido) > 0 ? Number(estadoPrev.saldo_vencido) : suma(facturasPrev.filter((f) => diasAtrasoA(f, refPrevMs) > 0));

  // Aging por tramo (monto + número de facturas)
  const aging = useMemo(() => {
    const b = Object.fromEntries(TRAMOS.map((t) => [t.id, { monto: 0, n: 0, maxDias: 0 }]));
    facturasConSaldo.forEach((f) => {
      const d = diasAtraso(f);
      const id = tramoDe(d);
      if (!id) return;
      b[id].monto += Number(f.saldo_actual) || 0;
      b[id].n += 1;
      b[id].maxDias = Math.max(b[id].maxDias, d);
    });
    return b;
  }, [facturasConSaldo, refMs]);
  const agTotal = TRAMOS.reduce((s, t) => s + aging[t.id].monto, 0);

  // DSO real (edad promedio ponderada por saldo) · fallback al DSO del header
  const dsoReal = useMemo(() => dsoDe(facturasConSaldo, refMs), [facturasConSaldo, refMs]);
  const dsoRealPrev = useMemo(() => (facturasPrev.length ? dsoDe(facturasPrev, refPrevMs) : null), [facturasPrev, refPrevMs]);
  const dso = dsoReal != null ? dsoReal : (estado?.dso != null ? Number(estado.dso) : null);

  // Deltas vs corte anterior
  const deltaSaldo = estadoPrev ? saldoActual - saldoActualPrev : null;
  const deltaSaldoPct = estadoPrev && saldoActualPrev > 0 ? Math.round((deltaSaldo / saldoActualPrev) * 100) : null;
  const deltaVencido = estadoPrev ? saldoVencido - saldoVencidoPrev : null;
  const deltaDso = dsoRealPrev != null && dso != null ? dso - dsoRealPrev : null;

  const facturaMasAtrasada = useMemo(() => {
    let worst = null;
    vencidas.forEach((f) => { const d = diasAtraso(f); if (!worst || d > worst.dias) worst = { dias: d, factura: f }; });
    return worst;
  }, [vencidas, refMs]);

  const ratioSaldoSI = sellIn > 0 ? Math.round((saldoActual / sellIn) * 100) : null;
  const proxMax = mesesVenc.reduce((mx, m) => (m.monto > (mx?.monto || 0) ? m : mx), null);

  // Semáforos
  const usoStatus = usoPct == null ? null : usoPct >= 90 ? { label: 'Uso alto', tone: 'bad' } : usoPct >= 70 ? { label: 'Uso medio', tone: 'warn' } : { label: 'Saludable', tone: 'good' };
  const dsoStatus = dso == null ? null : dso <= PLAZO ? { label: 'Dentro de plazo', tone: 'good' } : dso <= PLAZO + 30 ? { label: 'Retraso leve', tone: 'warn' } : { label: 'Muy rezagado', tone: 'bad' };
  const pctVencido = saldoActual > 0 ? (saldoVencido / saldoActual) * 100 : 0;
  const vencidoStatus = pctVencido === 0 ? { label: 'Sin vencido', tone: 'good' } : pctVencido <= 5 ? { label: 'Bajo', tone: 'good' } : pctVencido <= 15 ? { label: 'Vigilar', tone: 'warn' } : { label: 'Crítico', tone: 'bad' };
  const colorDe = (st) => (st?.tone === 'bad' ? P.red : st?.tone === 'warn' ? P.orange : P.green);

  // Alertas (máx. 3) → pills dentro del hero
  const recos = useMemo(() => {
    const out = [];
    if (facturaMasAtrasada && facturaMasAtrasada.dias > 0) {
      const f = facturaMasAtrasada.factura;
      out.push({ tone: 'red', t: `${f.movimiento || f.referencia || 'Factura'} · ${facturaMasAtrasada.dias}d de atraso · ${fmt$(f.saldo_actual)}`, s: `Emitida ${fmtFechaCorta(f.fecha_emision)}${f.vencimiento ? ` · vencida ${fmtFechaCorta(f.vencimiento)}` : ''}` });
    }
    if (deltaVencido != null && deltaVencido > 0) out.push({ tone: 'orange', t: `Vencido subió ${fmt$(deltaVencido)} vs corte anterior`, s: `De ${fmt$(saldoVencido - deltaVencido)} a ${fmt$(saldoVencido)}` });
    else if (deltaVencido != null && deltaVencido < 0) out.push({ tone: 'green', t: `Vencido bajó ${fmt$(-deltaVencido)}`, s: 'Cobranza efectiva desde el último corte' });
    if (proxMax && proxMax.monto > 0) out.push({ tone: 'blue', t: `${proxMax.label} concentra ${fmt$(proxMax.monto)}`, s: 'Mes pico de cobranza próxima' });
    if (deltaDso != null && deltaDso < 0 && Math.abs(deltaDso) >= 3) out.push({ tone: 'green', t: `DSO bajó ${Math.abs(deltaDso)}d vs corte anterior`, s: 'Cliente pagando más rápido' });
    return out.slice(0, 3);
  }, [facturaMasAtrasada, deltaVencido, saldoVencido, proxMax, deltaDso]);

  // Frase del hero por reglas
  const nMas90 = aging.mas90.n;
  const frase = !estado ? 'Sin corte cargado'
    : saldoVencido > 0
      ? `Saldo vencido de ${fmt$(saldoVencido)}, ${nMas90 > 0 ? `${nMas90} factura${nMas90 === 1 ? '' : 's'} +90 días.` : 'ninguna a más de 90 días.'}`
      : 'Cartera sana.';
  const subFrase = (() => {
    const parts = [`Saldo ${fmt$(saldoActual)} en ${facturasConSaldo.length} factura${facturasConSaldo.length === 1 ? '' : 's'}`];
    if (usoPct != null) parts.push(`uso de línea ${usoPct}% (${usoStatus?.label?.toLowerCase()})`);
    if (proxMax && proxMax.monto > 0) parts.push(`vencimientos altos en ${proxMax.label.toLowerCase()} (${fmt$(proxMax.monto)})`);
    if (!esUltimo && estado?.fecha_corte) parts.push(`visto al corte del ${fmtFechaCorta(estado.fecha_corte)}`);
    return parts.join(' · ');
  })();

  // Tabla: filas planas + búsqueda + filtro por tramo + orden
  const filasBase = useMemo(() => facturasConSaldo.map((f, i) => {
    const dAtraso = diasAtraso(f);
    const importe = Number(f.importe_factura) || 0;
    const saldo = Number(f.saldo_actual) || 0;
    return {
      id: f.id ?? `${f.movimiento || ''}-${i}`, folio: f.movimiento || '', referencia: f.referencia || '',
      emision: f.fecha_emision, vencimiento: f.vencimiento, importe, saldo,
      pctPagado: importe > 0 ? Math.max(0, Math.min(100, Math.round((1 - saldo / importe) * 100))) : 0,
      dAtraso, dParaVenc: diasParaVencer(f), tramo: tramoDe(dAtraso),
    };
  }), [facturasConSaldo, refMs]);
  const filasTabla = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    let rows = filasBase;
    if (filtro === 'vigente') rows = rows.filter((r) => r.dAtraso === 0);
    else if (filtro !== 'todas') rows = rows.filter((r) => r.tramo === filtro);
    if (q) rows = rows.filter((r) => r.folio.toLowerCase().includes(q) || r.referencia.toLowerCase().includes(q));
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      rows = [...rows].sort((a, b) => ((a[orden.col] ?? 0) - (b[orden.col] ?? 0)) * factor);
    }
    return rows;
  }, [filasBase, busqueda, filtro, orden]);
  const onSort = (col) => setOrden((p) => (p.col !== col ? { col, dir: 'desc' } : p.dir === 'desc' ? { col, dir: 'asc' } : { col: null, dir: null }));

  // Historial de cortes (ascendente para la serie)
  const historial = useMemo(() => [...cortes].reverse().map((c) => ({
    id: c.id, anio: c.anio, semana: c.semana, etiqueta: `S${c.semana}`, fecha: c.fecha_corte,
    saldo: Number(c.saldo_actual) || 0, vencido: Number(c.saldo_vencido) || 0, dso: c.dso != null ? Number(c.dso) : null,
  })), [cortes]);

  // ── Render ─────────────────────────────────────────────────────────
  if (loading) return <SkeletonPantalla pantalla="cobranza" />;

  if (!estado) {
    return (
      <div data-stagger>
        <Panel>
          <div style={{ padding: 30, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 }}>Sin estado de cuenta cargado</div>
            <div style={{ fontSize: 12 }}>Sube un archivo desde Actualizar Datos para ver la cartera de {nombreCliente}.</div>
          </div>
        </Panel>
      </div>
    );
  }

  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const eyebrowStyle = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap' };
  const tooltipStyle = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 11, fontFamily: TYPO.fontText, color: theme.text };
  const cursorFill = { fill: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)' };
  const totalPorCobrar = mesesVenc.reduce((s, m) => s + m.monto, 0) + saldoVencido;
  const vencData = [{ k: 'Vencido', monto: saldoVencido, col: P.red, sub: saldoVencido > 0 ? 'Ya en cartera vencida' : 'Sin vencido' }, ...mesesVenc.map((m) => ({ k: m.mesCorto, monto: m.monto, col: P.accent, sub: m.label }))];
  const detStyle = { transition: `opacity ${DUR.state}ms ${EASE}`, opacity: cargandoDet ? 0.55 : 1 };

  const pillEstatus = (r) => {
    if (r.dAtraso === 0) {
      if (r.dParaVenc != null && r.dParaVenc <= 15) return <Pill tone="blue" size="xs">{r.dParaVenc > 0 ? `Vence en ${r.dParaVenc}d` : 'Hoy'}</Pill>;
      return <Pill tone="green" size="xs">Vigente</Pill>;
    }
    const t = TRAMOS.find((x) => x.id === r.tramo);
    return <Pill tone={t?.tone || 'red'} size="xs" dot={r.tramo === 'mas90'}>{r.dAtraso}d</Pill>;
  };

  const columnas = [
    { key: 'folio', label: 'Folio', align: 'left', render: (r) => (
      <div style={{ lineHeight: 1.2 }}>
        <div style={{ ...mono, fontSize: 11.5, fontWeight: 600, color: theme.text }}>{r.folio || '—'}</div>
        {r.referencia && <div style={{ ...mono, fontSize: 10, color: theme.textSubtle || theme.textMuted }}>{r.referencia}</div>}
      </div>
    ) },
    { key: 'emision', label: 'Emisión', align: 'left', mono: true, render: (r) => fmtFechaCorta(r.emision) },
    { key: 'vencimiento', label: 'Vencimiento', align: 'left', mono: true, render: (r) => fmtFechaCorta(r.vencimiento) },
    { key: 'importe', label: 'Importe', sort: true, sum: true, fmt: fmt$Full, render: (r) => fmt$Full(r.importe) },
    { key: 'saldo', label: 'Saldo', sort: true, sum: true, bold: true, fmt: fmt$Full, render: (r) => fmt$Full(r.saldo) },
    { key: 'pctPagado', label: '% pagado', sort: true, render: (r) => <span style={{ color: r.pctPagado > 0 ? theme.text : theme.textMuted }}>{r.pctPagado}%</span> },
    { key: 'dAtraso', label: 'Atraso', sort: true, render: (r) => pillEstatus(r) },
  ];

  const columnasHist = [
    { key: 'etiqueta', label: 'Semana', align: 'left', render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ ...mono, fontWeight: r.id === estado.id ? 700 : 500 }}>{r.etiqueta} · {r.anio}</span>
        {r.id === estado.id && <Pill tone="inverse" size="xs">seleccionada</Pill>}
      </span>
    ) },
    { key: 'fecha', label: 'Corte', align: 'left', mono: true, render: (r) => fmtFechaCorta(r.fecha) },
    { key: 'saldo', label: 'Saldo', render: (r) => fmt$Full(r.saldo) },
    { key: 'vencido', label: 'Vencido', render: (r) => <span style={{ color: r.vencido > 0 ? P.red : theme.textMuted }}>{r.vencido > 0 ? fmt$Full(r.vencido) : '—'}</span> },
    { key: 'dso', label: 'DSO', render: (r) => (r.dso != null ? `${r.dso}d` : '—') },
  ];

  return (
    <div ref={rootRef} data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      {/* Hero */}
      <Hero
        eyebrow={`Crédito y Cobranza · ${nombreCliente} · semana ${estado.semana}${estado.fecha_corte ? ` · corte ${fmtFechaCorta(estado.fecha_corte)}` : ''}`}
        titulo={frase}
        sub={subFrase}
        dot={saldoVencido > 0}
        stats={[
          { k: 'Saldo actual', v: fmt$(saldoActual), sub: `${facturasConSaldo.length} factura${facturasConSaldo.length === 1 ? '' : 's'}` },
          { k: 'Vencido', v: fmt$(saldoVencido), sub: `${pctVencido.toFixed(0)}% del saldo`, color: saldoVencido > 0 ? P.red : P.green },
          { k: 'DSO', v: dso != null ? `${dso} días` : '—', sub: `vs ${PLAZO}d de plazo`, color: dsoStatus ? colorDe(dsoStatus) : undefined },
        ]}
      >
        {recos.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
            {recos.map((r, i) => <Pill key={i} tone={r.tone} dot title={r.s}>{r.t}</Pill>)}
          </div>
        )}
      </Hero>

      {/* Aging · 4 KpiCard */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8, ...detStyle }}>
        {TRAMOS.map((t) => {
          const b = aging[t.id];
          const pct = agTotal > 0 ? Math.round((b.monto / agTotal) * 100) : 0;
          const col = P[t.tone];
          return (
            <KpiCard key={t.id}
              eyebrow={t.label}
              badge={{ l: filtro === t.id ? 'Filtrando' : `${pct}%`, tone: b.monto > 0 ? t.tone : 'gray' }}
              big={b.monto > 0 ? fmt$(b.monto) : '—'}
              bigColor={b.monto > 0 ? (t.id === '0_30' ? theme.text : col) : theme.textMuted}
              bigSmall={b.n > 0 ? `${b.n} factura${b.n === 1 ? '' : 's'}` : ''}
              sub={b.n > 0 ? `Hasta ${b.maxDias}d de atraso · ${pct}% del vencido` : 'Sin facturas en este tramo'}
              progress={pct}
              progressColor={col}
              onClick={() => setFiltro((f) => (f === t.id ? 'todas' : t.id))}
            />
          );
        })}
      </div>

      {/* Vencimientos próximos + Línea de crédito y corte */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10, ...detStyle }}>
        <Panel titulo="Vencimientos próximos" meta={`${fmt$(totalPorCobrar)} por cobrar en 3 meses`}>
          <div style={{ height: 150, minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={vencData} margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
                <XAxis dataKey="k" tick={{ fontSize: 10, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} />
                <YAxis hide />
                <Tooltip cursor={cursorFill} contentStyle={tooltipStyle} formatter={(v, _n, p) => [fmt$Full(v), p?.payload?.sub || 'Monto']} />
                <Bar dataKey="monto" name="Monto" radius={[4, 4, 0, 0]} isAnimationActive={false} maxBarSize={56}>
                  {vencData.map((d, i) => <Cell key={i} fill={d.col} fillOpacity={d.monto > 0 ? (i === 0 ? 1 : 0.85) : 0.25} />)}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 6, marginTop: 6 }}>
            {vencData.map((d, i) => (
              <div key={i} style={{ minWidth: 0 }}>
                <div style={{ ...eyebrowStyle, color: i === 0 && d.monto > 0 ? P.red : theme.textMuted }}>{d.k}</div>
                <div style={{ ...mono, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: i === 0 && d.monto > 0 ? P.red : d.monto > 0 ? theme.text : theme.textMuted }}>{fmt$(d.monto)}</div>
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 6, marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.divider || theme.border}` }}>
            <StatCell theme={theme} k="Notas de crédito" v={notasCredito > 0 ? fmt$(notasCredito) : '—'} />
            <StatCell theme={theme} k="Saldo / Sell In YTD" v={ratioSaldoSI != null ? `${ratioSaldoSI}%` : '—'} />
            <StatCell theme={theme} k="A vencer" v={fmt$(saldoAVencer)} />
          </div>
        </Panel>

        <Panel titulo="Línea de crédito y corte" meta={estadoPrev ? `vs semana ${estadoPrev.semana}${estadoPrev.fecha_corte ? ` (${fmtFechaCorta(estadoPrev.fecha_corte)})` : ''}` : 'sin corte anterior'}
          acciones={usoStatus ? <Pill tone={TONE[usoStatus.tone]} dot>{usoStatus.label}</Pill> : <Pill tone="gray">Línea no configurada</Pill>}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ ...mono, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: usoStatus ? colorDe(usoStatus) : theme.textMuted }}>{usoPct != null ? `${usoPct}%` : '—'}</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              {lineaMXN > 0 ? `${fmt$(saldoActual)} de ${fmt$(lineaMXN)}` : 'Configura la línea en Configuración del cliente'}
              {lineaUSD > 0 && ` · USD ${Math.round(lineaUSD).toLocaleString('es-MX')}${tipoCambio ? ` @ ${tipoCambio.toFixed(2)}` : ''}`}
              {lineaMXNPagare > 0 && ` · pagaré ${fmt$(lineaMXNPagare)}`}
            </span>
          </div>
          <div style={{ marginTop: 8, height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, usoPct || 0)}%`, background: usoStatus ? colorDe(usoStatus) : theme.textMuted, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 8, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.divider || theme.border}` }}>
            <DeltaCell theme={theme} P={P} k="Saldo" v={fmt$(saldoActual)} delta={deltaSaldo} fmt={fmt$} extra={deltaSaldoPct != null ? `${deltaSaldoPct >= 0 ? '+' : '−'}${Math.abs(deltaSaldoPct)}%` : null} />
            <DeltaCell theme={theme} P={P} k="Vencido" v={fmt$(saldoVencido)} delta={deltaVencido} fmt={fmt$} extra={vencidoStatus.label} />
            <DeltaCell theme={theme} P={P} k="DSO" v={dso != null ? `${dso}d` : '—'} delta={deltaDso} fmt={(n) => `${n}d`} extra={dsoStatus?.label} />
          </div>
          <div style={{ marginTop: 10, fontSize: 10.5, color: theme.textMuted }}>
            Plazo de crédito {PLAZO} días{config?.aseguradora ? ` · aseguradora ${config.aseguradora}` : ''}{config?.tipo_garantia_mxn ? ` · garantía ${config.tipo_garantia_mxn}` : ''}.
          </div>
        </Panel>
      </div>

      {/* Facturas con saldo */}
      <Panel
        titulo="Facturas con saldo"
        meta={`${filasTabla.length} ${filasTabla.length === 1 ? 'factura' : 'facturas'} · ${fmt$(filasTabla.reduce((s, r) => s + r.saldo, 0))}`}
        padding="8px"
        style={detStyle}
        acciones={
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            <Segmented size="sm" value={filtro} onChange={setFiltro} options={[
              { id: 'todas', label: 'Todas' },
              { id: 'vigente', label: 'Vigentes', badge: filasBase.filter((r) => r.dAtraso === 0).length || undefined },
              ...TRAMOS.map((t) => ({ id: t.id, label: t.label.replace(' días', ''), badge: aging[t.id].n || undefined })),
            ]} />
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', background: theme.surfaceHover || `${theme.text}05`, border: `1px solid ${theme.border}`, borderRadius: 999, height: 28, color: theme.textMuted, width: 200 }}>
              <Search size={12} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Folio o referencia…"
                style={{ border: 0, outline: 0, background: 'transparent', flex: 1, minWidth: 0, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text }} />
            </label>
            <ExportMenu
              titulo="Crédito y Cobranza"
              subtitulo={`${nombreCliente} · facturas con saldo · semana ${estado.semana}`}
              deshabilitado={!filasTabla.length}
              pdf={{ ref: rootRef }}
              excel={() => ({
                titulo: `Crédito y Cobranza ${nombreCliente}`,
                archivo: `Cobranza ${nombreCliente}`,
                hojas: [{
                  nombre: 'Facturas con saldo',
                  columnas: [
                    { label: 'Folio', key: 'folio', tipo: 'texto', ancho: 14 },
                    { label: 'Referencia', key: 'referencia', tipo: 'texto', ancho: 18 },
                    { label: 'Emisión', key: 'emision', tipo: 'fecha' },
                    { label: 'Vencimiento', key: 'vencimiento', tipo: 'fecha' },
                    { label: 'Importe', key: 'importe', tipo: 'moneda' },
                    { label: 'Saldo', key: 'saldo', tipo: 'moneda' },
                    { label: '% pagado', key: 'pctPagado', tipo: 'pct' },
                    { label: 'Días atraso', key: 'dAtraso', tipo: 'numero', ancho: 11 },
                    { label: 'Vence en (días)', key: 'dParaVenc', tipo: 'numero', ancho: 14 },
                  ],
                  filas: filasTabla.map((r) => ({ folio: r.folio, referencia: r.referencia, emision: r.emision, vencimiento: r.vencimiento, importe: r.importe, saldo: r.saldo, pctPagado: r.pctPagado, dAtraso: r.dAtraso, dParaVenc: r.dAtraso === 0 ? r.dParaVenc : null })),
                  totales: { folio: 'TOTAL', referencia: `${filasTabla.length} facturas`, importe: filasTabla.reduce((s, r) => s + r.importe, 0), saldo: filasTabla.reduce((s, r) => s + r.saldo, 0) },
                }],
              })}
            />
          </div>
        }
      >
        <TablaCompacta
          columnas={columnas}
          filas={filasTabla.slice(0, 500)}
          rowKey={(r) => r.id}
          orden={orden}
          onSort={onSort}
          maxHeight="55vh"
          vacio={busqueda || filtro !== 'todas' ? 'Sin facturas con ese filtro.' : 'Sin facturas con saldo.'}
        />
        {filasTabla.length > 500 && (
          <div style={{ padding: '8px 4px 0', textAlign: 'center', fontSize: 11, color: theme.textMuted }}>Mostrando 500 de {filasTabla.length} · usa el buscador o el filtro por tramo</div>
        )}
      </Panel>

      {/* Historial de cortes semanales */}
      <Panel
        titulo="Historial de cortes"
        meta={`${historial.length} corte${historial.length === 1 ? '' : 's'} · click en una semana para verla`}
        plegable
        abiertoInicial={!esUltimo}
        acciones={!esUltimo && <Boton onClick={() => setCorteSel(cortes[0]?.id ?? null)}>Volver al último corte</Boton>}
      >
        {historial.length >= 2 ? (
          <div style={{ marginBottom: 8 }}>
            <GraficaLineas
              datos={historial.map((h) => ({ x: h.etiqueta, saldo: h.saldo, vencido: h.vencido, dso: h.dso }))}
              series={[
                { key: 'saldo', label: 'Saldo', tipo: 'principal' },
                { key: 'vencido', label: 'Vencido', tipo: 'linea', color: P.red },
                { key: 'dso', label: 'DSO', tipo: 'linea', color: P.orange, eje: 'der', formato: (v) => `${Math.round(v)}d` },
              ]}
              formato={fmt$}
              alto={150}
              mesActivo={historial.findIndex((h) => h.id === estado.id)}
              onClickMes={(i) => { const h = historial[i]; if (h?.id) setCorteSel(h.id); }}
            />
          </div>
        ) : (
          <div style={{ fontSize: 11, color: theme.textMuted, marginBottom: 8 }}>La serie semanal aparece a partir del segundo corte cargado.</div>
        )}
        <TablaCompacta
          columnas={columnasHist}
          filas={[...historial].reverse()}
          rowKey={(r) => r.id}
          onRowClick={(r) => setCorteSel(r.id)}
          maxHeight={260}
          dense
          vacio="Sin cortes cargados."
        />
      </Panel>
    </div>
  );
}

// ═══════════ Celdas auxiliares (sin componente propio en el kit) ═══════════
function StatCell({ theme, k, v }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

// Delta vs corte anterior · bajar es bueno (saldo, vencido, DSO)
function DeltaCell({ theme, P, k, v, delta, fmt, extra }) {
  const col = delta == null ? theme.textMuted : delta <= 0 ? P.green : P.orange;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginTop: 1, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {delta != null
          ? <><span style={{ color: col, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{delta >= 0 ? '+' : '−'}{fmt(Math.abs(delta))}</span> vs anterior{extra ? ` · ${extra}` : ''}</>
          : (extra || 'Sin comparativo')}
      </div>
    </div>
  );
}
