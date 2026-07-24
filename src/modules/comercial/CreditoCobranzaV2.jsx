// CreditoCobranzaV2 · rediseño Apple V2 · Propuesta A · Digitalife
// ─ Hero editorial + 4 KPIs (Saldo · Vencido · DSO · Uso línea)
// ─ Aging horizontal + vencimientos próximos 3 meses
// ─ Ferruteck cosmic strip con alertas
// ─ Tabla facturas con saldo (badges de días de atraso)
// Preserva 100% de la data que ya carga CreditoCobranza.jsx (estados_cuenta + detalle + config + sell_in_sku + cuotas + sell_out)

import React, { useState, useEffect, useMemo } from 'react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { FerrutekLoader } from '../../components';
import { Sparkles, AlertTriangle, TrendingUp, Calendar, CreditCard } from 'lucide-react';

const NOMBRES_MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const MESES_CORTOS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const fmt$ = (v) => {
  const n = Number(v || 0);
  const abs = Math.abs(n);
  if (abs >= 1e6) return `$${(n / 1e6).toFixed(abs >= 1e7 ? 1 : 2)}M`;
  if (abs >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('es-MX')}`;
};
const fmt$Full = (v) => '$' + Math.round(Number(v || 0)).toLocaleString('es-MX');
const fmtInt = (v) => Number(v || 0).toLocaleString('es-MX');

const fmtFechaCorta = (iso) => {
  if (!iso) return '—';
  const p = String(iso).slice(0, 10).split('-').map(n => parseInt(n, 10));
  if (p.length !== 3 || !p[0]) return String(iso);
  return `${p[2]}-${MESES_CORTOS[p[1] - 1]}`;
};

// ═══════════════════════════════════════════════════════════════════
export default function CreditoCobranzaV2({ cliente, clienteKey }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  const [estado, setEstado] = useState(null);
  const [estadoPrev, setEstadoPrev] = useState(null);
  const [sellIn, setSellIn] = useState(0);
  const [detalle, setDetalle] = useState([]);
  const [detallePrev, setDetallePrev] = useState([]);
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'diasAtraso', dir: 'desc' });

  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    (async () => {
      const anio = new Date().getFullYear();
      const [ecRes, siRes, cfgRes] = await Promise.all([
        supabase.from('estados_cuenta').select('*').eq('cliente', clienteKey)
          .order('anio', { ascending: false }).order('semana', { ascending: false }).limit(2),
        supabase.from('sell_in_sku').select('mes, monto_pesos').eq('cliente', clienteKey).eq('anio', anio),
        supabase.from('clientes_credito_config').select('*').eq('cliente', clienteKey).maybeSingle(),
      ]);
      const ecArr = ecRes.data || [];
      const ecActual = ecArr[0] || null;
      const ecPrev = ecArr[1] || null;
      setEstado(ecActual);
      setEstadoPrev(ecPrev);
      setConfig(cfgRes.data || null);
      if (ecActual || ecPrev) {
        const ids = [ecActual?.id, ecPrev?.id].filter(Boolean);
        const { data: det } = await supabase.from('estados_cuenta_detalle').select('*').in('estado_cuenta_id', ids);
        const detAll = det || [];
        setDetalle(detAll.filter(r => r.estado_cuenta_id === ecActual?.id));
        setDetallePrev(detAll.filter(r => r.estado_cuenta_id === ecPrev?.id));
      } else { setDetalle([]); setDetallePrev([]); }
      setSellIn((siRes.data || []).reduce((s, r) => s + (Number(r.monto_pesos) || 0), 0));
      setLoading(false);
    })();
  }, [clienteKey]);

  const hoy = new Date();
  const hoyMs = hoy.getTime();

  const mesesVenc = useMemo(() => {
    if (!estado) return [];
    return [
      { k: 1, monto: Number(estado.venc_mes_1) || 0 },
      { k: 2, monto: Number(estado.venc_mes_2) || 0 },
      { k: 3, monto: Number(estado.venc_mes_3) || 0 },
    ].map(x => {
      const d = new Date(hoy.getFullYear(), hoy.getMonth() + x.k - 1, 1);
      return { ...x, label: NOMBRES_MES[d.getMonth()], mesCorto: MESES_CORTOS[d.getMonth()], mes: d.getMonth() + 1, anio: d.getFullYear() };
    });
  }, [estado]);

  const notasCredito = Math.abs(Number(estado?.notas_credito) || 0);
  const tipoCambio = Number(estado?.tipo_cambio) || 0;

  const lineaUSD = Number(config?.linea_credito_usd) || 0;
  const lineaMXNPagare = Number(config?.linea_credito_mxn_pagare) || 0;
  const PLAZO = Number(config?.plazo_dias_credito) || 90;
  const lineaMXN = lineaUSD * tipoCambio + lineaMXNPagare;
  const usoPct = lineaMXN > 0 ? Math.min(Math.round((saldoActual / lineaMXN) * 100), 999) : null;

  const diasAtraso = (f) => {
    if (!f.vencimiento) return 0;
    const v = new Date(f.vencimiento + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((hoyMs - v) / (1000 * 60 * 60 * 24)));
  };
  const diasSinCobrar = (f) => {
    if (!f.fecha_emision) return null;
    const e = new Date(f.fecha_emision + 'T00:00:00').getTime();
    return Math.max(0, Math.floor((hoyMs - e) / (1000 * 60 * 60 * 24)));
  };
  const diasParaVencer = (f) => {
    if (!f.vencimiento) return null;
    const v = new Date(f.vencimiento + 'T00:00:00').getTime();
    return Math.floor((v - hoyMs) / (1000 * 60 * 60 * 24));
  };

  const facturasConSaldo = useMemo(() => (detalle || []).filter(f => Number(f.saldo_actual) > 0), [detalle]);

  // Saldos: preferir header del corte; si están vacíos, calcular desde detalle
  const saldoActualDet = useMemo(() => facturasConSaldo.reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0), [facturasConSaldo]);
  const saldoActual = Number(estado?.saldo_actual) > 0 ? Number(estado.saldo_actual) : saldoActualDet;
  const saldoVencidoDet = useMemo(() => facturasConSaldo.filter(f => diasAtraso(f) > 0).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0), [facturasConSaldo]);
  const saldoVencido = Number(estado?.saldo_vencido) > 0 ? Number(estado.saldo_vencido) : saldoVencidoDet;
  const saldoAVencerDet = useMemo(() => facturasConSaldo.filter(f => diasAtraso(f) === 0).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0), [facturasConSaldo]);
  const saldoAVencer = Number(estado?.saldo_a_vencer) > 0 ? Number(estado.saldo_a_vencer) : saldoAVencerDet;

  const saldoActualPrevDet = useMemo(() => (detallePrev || []).filter(f => Number(f.saldo_actual) > 0).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0), [detallePrev]);
  const saldoVencidoPrevDet = useMemo(() => {
    const refMs = estadoPrev?.fecha_corte ? new Date(estadoPrev.fecha_corte + 'T00:00:00').getTime() : hoyMs;
    return (detallePrev || []).filter(f => {
      if (!f.vencimiento) return false;
      if (Number(f.saldo_actual) <= 0) return false;
      const v = new Date(f.vencimiento + 'T00:00:00').getTime();
      return refMs > v;
    }).reduce((s, f) => s + (Number(f.saldo_actual) || 0), 0);
  }, [detallePrev, estadoPrev]);
  const saldoActualPrev = Number(estadoPrev?.saldo_actual) > 0 ? Number(estadoPrev.saldo_actual) : saldoActualPrevDet;
  const saldoVencidoPrev = Number(estadoPrev?.saldo_vencido) > 0 ? Number(estadoPrev.saldo_vencido) : saldoVencidoPrevDet;

  const aging = useMemo(() => {
    const b = { d0_30: 0, d31_60: 0, d61_90: 0, d91_180: 0, mas180: 0 };
    facturasConSaldo.forEach(f => {
      const d = diasAtraso(f);
      if (d <= 0) return;
      const s = Number(f.saldo_actual) || 0;
      if (d <= 30) b.d0_30 += s;
      else if (d <= 60) b.d31_60 += s;
      else if (d <= 90) b.d61_90 += s;
      else if (d <= 180) b.d91_180 += s;
      else b.mas180 += s;
    });
    return b;
  }, [facturasConSaldo]);
  const agTotal = aging.d0_30 + aging.d31_60 + aging.d61_90 + aging.d91_180 + aging.mas180;

  // DSO real (edad promedio ponderada por saldo)
  const dsoReal = useMemo(() => {
    let num = 0, den = 0;
    facturasConSaldo.forEach(f => {
      if (!f.fecha_emision) return;
      const s = Number(f.saldo_actual) || 0;
      const d = Math.floor((hoyMs - new Date(f.fecha_emision + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
      if (d < 0) return;
      num += s * d; den += s;
    });
    return den > 0 ? Math.round(num / den) : null;
  }, [facturasConSaldo]);
  const dsoRealPrev = useMemo(() => {
    if (!detallePrev || detallePrev.length === 0) return null;
    const prev = detallePrev.filter(f => Number(f.saldo_actual) > 0);
    const refMs = estadoPrev?.fecha_corte ? new Date(estadoPrev.fecha_corte + 'T00:00:00').getTime() : hoyMs;
    let num = 0, den = 0;
    prev.forEach(f => {
      if (!f.fecha_emision) return;
      const s = Number(f.saldo_actual) || 0;
      const d = Math.floor((refMs - new Date(f.fecha_emision + 'T00:00:00').getTime()) / (1000 * 60 * 60 * 24));
      if (d < 0) return;
      num += s * d; den += s;
    });
    return den > 0 ? Math.round(num / den) : null;
  }, [detallePrev, estadoPrev]);

  const dso = dsoReal != null ? dsoReal : (estado?.dso != null ? Number(estado.dso) : null);

  const vencidas = useMemo(() => facturasConSaldo.filter(f => diasAtraso(f) > 0), [facturasConSaldo]);

  // Deltas vs corte anterior
  const deltaSaldo = estadoPrev ? saldoActual - saldoActualPrev : null;
  const deltaSaldoPct = estadoPrev && saldoActualPrev > 0 ? Math.round((deltaSaldo / saldoActualPrev) * 100) : null;
  const deltaVencido = estadoPrev ? saldoVencido - saldoVencidoPrev : null;
  const deltaDso = dsoRealPrev != null && dso != null ? dso - dsoRealPrev : null;

  // Factura más atrasada
  const facturaMasAtrasada = useMemo(() => {
    let worst = null;
    vencidas.forEach(f => {
      const d = diasAtraso(f);
      if (!worst || d > worst.dias) worst = { dias: d, factura: f };
    });
    return worst;
  }, [vencidas]);

  const ratioSaldoSI = sellIn > 0 ? Math.round((saldoActual / sellIn) * 100) : null;

  // Alertas priorizadas para Ferruteck (max 3)
  const recos = useMemo(() => {
    const out = [];
    if (facturaMasAtrasada && facturaMasAtrasada.dias > 0) {
      const f = facturaMasAtrasada.factura;
      out.push({ icon: '⚠️', t: `${f.movimiento || f.referencia || 'Factura'} con ${facturaMasAtrasada.dias}d de atraso · ${fmt$(f.saldo_actual)}`, s: `Emitida ${fmtFechaCorta(f.fecha_emision)}${f.vencimiento ? ` · vencida ${fmtFechaCorta(f.vencimiento)}` : ''}` });
    }
    if (deltaVencido != null && deltaVencido > 0) {
      out.push({ icon: '📈', t: `Vencido subió ${fmt$(deltaVencido)} vs corte anterior`, s: `De ${fmt$(saldoVencido - deltaVencido)} a ${fmt$(saldoVencido)}` });
    } else if (deltaVencido != null && deltaVencido < 0) {
      out.push({ icon: '✅', t: `Vencido bajó ${fmt$(-deltaVencido)}`, s: 'Cobranza efectiva desde el último corte' });
    }
    const proxMax = mesesVenc.reduce((mx, m) => m.monto > (mx?.monto || 0) ? m : mx, null);
    if (proxMax && proxMax.monto > 0) {
      out.push({ icon: '📅', t: `${proxMax.label} concentra ${fmt$(proxMax.monto)}`, s: 'Mes pico de cobranza próxima' });
    }
    if (deltaDso != null && deltaDso < 0 && Math.abs(deltaDso) >= 3) {
      out.push({ icon: '🔥', t: `DSO bajó ${Math.abs(deltaDso)}d vs corte anterior`, s: 'Cliente pagando más rápido' });
    }
    return out.slice(0, 3);
  }, [facturaMasAtrasada, deltaVencido, saldoVencido, mesesVenc, deltaDso]);

  // Semáforos
  const usoStatus = usoPct == null ? null
    : usoPct >= 90 ? { label: 'Uso alto', tone: 'bad' }
    : usoPct >= 70 ? { label: 'Uso medio', tone: 'warn' }
    : { label: 'Saludable', tone: 'good' };
  const dsoStatus = dso == null ? null
    : dso <= PLAZO ? { label: 'Dentro plazo', tone: 'good' }
    : dso <= PLAZO + 30 ? { label: 'Retraso leve', tone: 'warn' }
    : { label: 'Muy rezagado', tone: 'bad' };
  const pctVencido = saldoActual > 0 ? (saldoVencido / saldoActual * 100) : 0;
  const vencidoStatus = pctVencido == 0 ? { label: 'Sin vencido', tone: 'good' }
    : pctVencido <= 5 ? { label: 'Bajo', tone: 'good' }
    : pctVencido <= 15 ? { label: 'Vigilar', tone: 'warn' }
    : { label: 'Crítico', tone: 'bad' };

  // Narrativa
  const narrativa = () => {
    if (!estado) return 'Sin corte cargado';
    if (dsoStatus?.tone === 'good' && vencidoStatus?.tone === 'good' && usoStatus?.tone === 'good') return 'Cartera sana';
    if (vencidoStatus?.tone === 'bad' || dsoStatus?.tone === 'bad') return 'Cartera con riesgo alto';
    if (vencidoStatus?.tone === 'warn' || dsoStatus?.tone === 'warn') return 'Cartera con atención puntual';
    return 'Cartera en observación';
  };
  const subnarrativa = () => {
    const parts = [`Saldo ${fmt$(saldoActual)}`];
    if (saldoVencido > 0) parts.push(`${pctVencido.toFixed(0)}% vencido (${fmt$(saldoVencido)})`);
    if (usoPct != null) parts.push(`uso de línea ${usoPct}% ${usoStatus?.label?.toLowerCase()}`);
    const proxMax = mesesVenc.reduce((mx, m) => m.monto > (mx?.monto || 0) ? m : mx, null);
    if (proxMax && proxMax.monto > 0) parts.push(`vencimientos altos en ${proxMax.mesCorto?.toLowerCase() || proxMax.label.toLowerCase()} (${fmt$(proxMax.monto)})`);
    return parts.join(' · ');
  };

  // Tabla facturas ordenada + búsqueda
  const filasTabla = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const rows = facturasConSaldo.map(f => {
      const dAtraso = diasAtraso(f);
      const dParaVenc = diasParaVencer(f);
      const importe = Number(f.importe_factura) || 0;
      const saldo = Number(f.saldo_actual) || 0;
      const pctPagado = importe > 0 ? Math.max(0, Math.min(100, Math.round((1 - saldo / importe) * 100))) : 0;
      return { f, dAtraso, dParaVenc, importe, saldo, pctPagado };
    });
    const filtered = q ? rows.filter(r => {
      const mov = String(r.f.movimiento || '').toLowerCase();
      const ref = String(r.f.referencia || '').toLowerCase();
      return mov.includes(q) || ref.includes(q);
    }) : rows;
    if (orden.col && orden.dir) {
      const factor = orden.dir === 'asc' ? 1 : -1;
      filtered.sort((a, b) => {
        const va = a[orden.col] ?? 0;
        const vb = b[orden.col] ?? 0;
        return (va - vb) * factor;
      });
    }
    return filtered;
  }, [facturasConSaldo, busqueda, orden]);

  if (loading) {
    return <FerrutekLoader label="Cargando cartera…" sub={`Ferruteck está trayendo el estado de cuenta de ${cliente || clienteKey}`} minHeight={480} />;
  }

  if (!estado) {
    return (
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 40, textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, marginBottom: 4 }}>Sin estado de cuenta cargado</div>
        <div style={{ fontSize: 12 }}>Sube un archivo desde Actualizar Datos para ver la cartera.</div>
      </div>
    );
  }

  const heroBg = theme.heroCardBg || '#0A0A0C';
  const bgAlt = theme.bgAlt || (isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)');
  const badgeStyle = (tone) => {
    if (tone === 'good') return { bg: 'rgba(52,199,89,0.14)', color: '#0F8A3A' };
    if (tone === 'warn') return { bg: 'rgba(255,149,0,0.14)', color: '#8A5000' };
    if (tone === 'bad') return { bg: 'rgba(255,59,48,0.14)', color: '#B10E00' };
    return { bg: `${theme.accent}18`, color: theme.accent };
  };
  const B = (tone) => badgeStyle(tone);

  return (
    <div style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      {/* Hero */}
      <div style={{ background: heroBg, color: '#FFF', borderRadius: 12, padding: '14px 18px', display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 20, alignItems: 'center' }}>
        <div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.55)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.accent }} />
            Crédito y cobranza · {cliente || clienteKey} · Corte {fmtFechaCorta(estado.fecha_corte)}
          </span>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, margin: '3px 0 2px', color: '#FFF', letterSpacing: '-0.025em' }}>
            {narrativa()}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11.5, maxWidth: 480, lineHeight: 1.4, margin: 0 }}>
            {subnarrativa()}
          </p>
        </div>
        <HeroStat k="Saldo" v={fmt$(saldoActual)} sub={`${facturasConSaldo.length} factura${facturasConSaldo.length === 1 ? '' : 's'}`} />
        <HeroStat k="Vencido" v={fmt$(saldoVencido)} sub={`${pctVencido.toFixed(0)}% del total`} valColor={vencidoStatus?.tone === 'good' ? theme.green : vencidoStatus?.tone === 'warn' ? theme.orange : theme.red} />
        <HeroStat k="DSO" v={dso != null ? `${dso}d` : '—'} sub={`vs ${PLAZO}d plazo`} valColor={dsoStatus?.tone === 'good' ? theme.green : dsoStatus?.tone === 'warn' ? theme.orange : theme.red} />
      </div>

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
        <KpiCard theme={theme} eyebrow="Saldo actual" title="Cartera total"
          badge={deltaSaldoPct != null ? { l: `${deltaSaldo >= 0 ? '▲' : '▼'} ${Math.abs(deltaSaldoPct)}%`, tone: deltaSaldo <= 0 ? 'good' : 'warn' } : null}
          big={fmt$(saldoActual)}
          bigSmall={`${facturasConSaldo.length} facturas`}
          sub={deltaSaldo != null ? <><strong style={{ color: deltaSaldo <= 0 ? theme.green : theme.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{deltaSaldo >= 0 ? '+' : '−'}{fmt$(Math.abs(deltaSaldo))}</strong> vs corte anterior</> : 'Sin comparativo'} />
        <KpiCard theme={theme} eyebrow="Vencido" title="Cartera en riesgo"
          badge={vencidoStatus ? { l: `${pctVencido.toFixed(0)}%`, tone: vencidoStatus.tone } : null}
          big={fmt$(saldoVencido)}
          bigColor={vencidoStatus?.tone === 'bad' ? theme.red : vencidoStatus?.tone === 'warn' ? theme.orange : theme.text}
          bigSmall={`${vencidas.length} facturas`}
          sub={facturaMasAtrasada ? <>Más atrasada: <strong>{facturaMasAtrasada.dias}d · {fmt$(facturaMasAtrasada.factura.saldo_actual)}</strong></> : 'Sin facturas vencidas'} />
        <KpiCard theme={theme} eyebrow="DSO real" title="Edad promedio ponderada"
          badge={dsoStatus ? { l: dsoStatus.label, tone: dsoStatus.tone } : null}
          big={dso != null ? `${dso}d` : '—'}
          bigColor={dsoStatus?.tone === 'bad' ? theme.red : dsoStatus?.tone === 'warn' ? theme.orange : theme.green}
          bigSmall={`vs ${PLAZO}d plazo`}
          sub={deltaDso != null ? <><strong style={{ color: deltaDso <= 0 ? theme.green : theme.orange, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{deltaDso >= 0 ? '+' : '−'}{Math.abs(deltaDso)}d</strong> vs corte anterior</> : 'Sin comparativo'} />
        <KpiCard theme={theme} eyebrow="Uso de línea" title={lineaMXN > 0 ? `${fmt$(saldoActual)} / ${fmt$(lineaMXN)}` : 'Línea no configurada'}
          badge={usoStatus ? { l: usoStatus.label, tone: usoStatus.tone } : null}
          big={usoPct != null ? `${usoPct}%` : '—'}
          bigColor={usoStatus?.tone === 'bad' ? theme.red : usoStatus?.tone === 'warn' ? theme.orange : theme.text}
          bigSmall={lineaMXNPagare > 0 && lineaUSD > 0 ? 'MXN + USD' : (lineaUSD > 0 ? 'USD' : (lineaMXNPagare > 0 ? 'MXN' : ''))}
          progress={usoPct != null ? Math.min(100, usoPct) : null}
          progressColor={usoStatus?.tone === 'bad' ? theme.red : usoStatus?.tone === 'warn' ? theme.orange : theme.green} />
      </div>

      {/* Aging + Vencimientos próximos */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Aging de cartera vencida</h5>
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>Total {fmt$(agTotal)}</span>
          </div>
          {agTotal === 0 ? (
            <div style={{ padding: '30px 4px', textAlign: 'center', color: theme.textMuted, fontSize: 12, fontStyle: 'italic' }}>Sin cartera vencida · toda la cartera está vigente 🎉</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <AgingRow theme={theme} label="0–30d" monto={aging.d0_30} total={agTotal} color={theme.yellow || '#FFCC00'} />
              <AgingRow theme={theme} label="31–60d" monto={aging.d31_60} total={agTotal} color={theme.orange} />
              <AgingRow theme={theme} label="61–90d" monto={aging.d61_90} total={agTotal} color={theme.red} />
              <AgingRow theme={theme} label="91–180d" monto={aging.d91_180} total={agTotal} color="#B10E00" />
              <AgingRow theme={theme} label="+180d" monto={aging.mas180} total={agTotal} color="#7B0000" />
            </div>
          )}
        </div>

        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Vencimientos próximos 3 meses</h5>
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>{fmt$(mesesVenc.reduce((s, m) => s + m.monto, 0) + saldoVencido)} por cobrar</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            <VencMes theme={theme} label="Vencido" tone="bad" monto={saldoVencido} sub={saldoVencido > 0 ? 'Ya en cartera vencida' : 'Sin vencido'} maxV={Math.max(saldoVencido, ...mesesVenc.map(m => m.monto), 1)} />
            {mesesVenc.map(m => (
              <VencMes key={m.k} theme={theme} label={m.mesCorto} tone={m.k === 1 && m.monto > 0 ? 'accent' : 'accent'} monto={m.monto} sub={m.monto > 0 ? `${m.label}` : 'Sin vencimientos'} maxV={Math.max(saldoVencido, ...mesesVenc.map(x => x.monto), 1)} />
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginTop: 12, paddingTop: 10, borderTop: `1px solid ${theme.divider || theme.border}` }}>
            <Stat theme={theme} k="Notas crédito" v={notasCredito > 0 ? fmt$(notasCredito) : '—'} />
            <Stat theme={theme} k="Saldo / SI YTD" v={ratioSaldoSI != null ? `${ratioSaldoSI}%` : '—'} />
            <Stat theme={theme} k="A vencer" v={fmt$(saldoAVencer)} />
          </div>
        </div>
      </div>

      {/* Ferruteck strip */}
      {recos.length > 0 && <FerruteckStrip recos={recos} />}

      {/* Tabla facturas */}
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
          <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', margin: 0, color: theme.text }}>Facturas con saldo · ordenadas por atraso</h5>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', background: bgAlt, border: `1px solid ${theme.border}`, borderRadius: 999, height: 28, fontSize: 11, color: theme.textMuted, flex: 1, maxWidth: 260 }}>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar folio o referencia…"
              style={{ border: 0, outline: 0, background: 'transparent', flex: 1, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text }} />
          </div>
          <span style={{ marginLeft: 'auto', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted }}>
            <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{filasTabla.length}</strong> {filasTabla.length === 1 ? 'factura' : 'facturas'} · {fmt$(filasTabla.reduce((s, r) => s + r.saldo, 0))}
          </span>
        </div>
        <div style={{ overflowX: 'auto', maxHeight: '55vh' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11.5 }}>
            <thead>
              <tr>
                <ThSort theme={theme}>Folio</ThSort>
                <ThSort theme={theme}>Emisión</ThSort>
                <ThSort theme={theme}>Vencimiento</ThSort>
                <ThSort theme={theme} align="right" col="importe" orden={orden} setOrden={setOrden}>Importe</ThSort>
                <ThSort theme={theme} align="right" col="saldo" orden={orden} setOrden={setOrden}>Saldo</ThSort>
                <ThSort theme={theme} align="right" col="pctPagado" orden={orden} setOrden={setOrden}>% pagado</ThSort>
                <ThSort theme={theme} align="right" col="diasAtraso" orden={orden} setOrden={setOrden}>Días atraso</ThSort>
              </tr>
            </thead>
            <tbody>
              {filasTabla.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 30, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>Sin facturas para mostrar.</td></tr>
              )}
              {filasTabla.slice(0, 500).map((r, i) => {
                const badgeStyle = r.dAtraso === 0
                  ? (r.dParaVenc != null && r.dParaVenc <= 15 ? { bg: `${theme.accent}18`, color: theme.accent, label: r.dParaVenc >= 0 ? `Vence en ${r.dParaVenc}d` : 'Hoy' } : { bg: `${theme.green}18`, color: theme.green, label: 'Vigente' })
                  : r.dAtraso <= 30 ? { bg: 'rgba(255,204,0,0.16)', color: '#8A5000', label: `${r.dAtraso}d` }
                  : r.dAtraso <= 60 ? { bg: 'rgba(255,149,0,0.16)', color: '#8A4000', label: `${r.dAtraso}d` }
                  : r.dAtraso <= 90 ? { bg: 'rgba(255,59,48,0.14)', color: '#B10E00', label: `${r.dAtraso}d` }
                  : { bg: 'rgba(255,59,48,0.28)', color: '#7B0000', label: `${r.dAtraso}d` };
                return (
                  <tr key={i}>
                    <td style={cellStyle(theme)}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text }}>{r.f.movimiento || '—'}</div>
                      {r.f.referencia && <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textSubtle || theme.textMuted, marginTop: 1 }}>{r.f.referencia}</div>}
                    </td>
                    <td style={{ ...cellStyle(theme), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{fmtFechaCorta(r.f.fecha_emision)}</td>
                    <td style={{ ...cellStyle(theme), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{fmtFechaCorta(r.f.vencimiento)}</td>
                    <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace' }}>{fmt$Full(r.importe)}</td>
                    <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600 }}>{fmt$Full(r.saldo)}</td>
                    <td style={{ ...cellStyle(theme, 'right'), fontFamily: '"SF Mono", ui-monospace, monospace', color: r.pctPagado > 0 ? theme.text : theme.textMuted }}>{r.pctPagado}%</td>
                    <td style={{ ...cellStyle(theme, 'right') }}>
                      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, padding: '2px 7px', borderRadius: 999, fontSize: 10.5, background: badgeStyle.bg, color: badgeStyle.color }}>{badgeStyle.label}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filasTabla.length > 500 && (
          <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 11, color: theme.textMuted }}>Mostrando 500 de {filasTabla.length} · usa el buscador para filtrar</div>
        )}
      </div>
    </div>
  );
}

// ═══════════ Sub-componentes ═══════════════════════
function HeroStat({ k, v, sub, valColor }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', textAlign: 'right' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'rgba(255,255,255,0.5)', fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, color: valColor || '#FFF', letterSpacing: '-0.02em' }}>{v}</div>
      <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)' }}>{sub}</div>
    </div>
  );
}

function KpiCard({ theme, eyebrow, title, big, bigSmall, bigColor, sub, badge, progress, progressColor }) {
  const badgeStyle = (tone) => {
    if (tone === 'good') return { bg: 'rgba(52,199,89,0.14)', color: '#0F8A3A' };
    if (tone === 'warn') return { bg: 'rgba(255,149,0,0.14)', color: '#8A5000' };
    if (tone === 'bad') return { bg: 'rgba(255,59,48,0.14)', color: '#B10E00' };
    return { bg: `${theme.accent}20`, color: theme.accent };
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
          return <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: s.bg, color: s.color, whiteSpace: 'nowrap' }}>{badge.l}</span>;
        })()}
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: bigColor || theme.text, marginTop: 4 }}>
        {big}
        {bigSmall && <span style={{ fontFamily: TYPO.fontText, fontSize: 11, color: theme.textMuted, fontWeight: 500, marginLeft: 6 }}>{bigSmall}</span>}
      </div>
      <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>
      {progress != null && (
        <div style={{ height: 4, borderRadius: 999, background: `${theme.text}10`, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ height: '100%', borderRadius: 999, background: progressColor || theme.accent, width: `${Math.min(100, progress)}%`, transition: 'width 400ms' }} />
        </div>
      )}
    </div>
  );
}

function AgingRow({ theme, label, monto, total, color }) {
  const pct = total > 0 ? Math.round((monto / total) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '76px 1fr 40px 80px', gap: 10, alignItems: 'center', fontSize: 11.5 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text }}>{label}</span>
      <span style={{ height: 8, borderRadius: 999, background: `${theme.text}0A`, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: '100%', background: color, borderRadius: 999, width: `${pct}%`, transition: 'width 400ms' }} />
      </span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', color: theme.textMuted, fontSize: 10.5, textAlign: 'right' }}>{pct}%</span>
      <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, textAlign: 'right', color: monto > 0 ? theme.text : theme.textSubtle || theme.textMuted }}>{monto > 0 ? fmt$(monto) : '—'}</span>
    </div>
  );
}

function VencMes({ theme, label, tone, monto, sub, maxV }) {
  const pct = maxV > 0 ? Math.round((monto / maxV) * 100) : 0;
  const isBad = tone === 'bad' && monto > 0;
  return (
    <div style={{
      borderRadius: 10, padding: '10px 12px',
      background: isBad ? 'rgba(255,59,48,0.08)' : (theme.bgAlt || `${theme.text}05`),
      border: isBad ? '1px solid rgba(255,59,48,0.20)' : `1px solid ${theme.border}`,
    }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: isBad ? theme.red : theme.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: isBad ? theme.red : theme.text, marginTop: 2 }}>{fmt$(monto)}</div>
      <div style={{ marginTop: 8, height: 4, borderRadius: 999, background: `${theme.text}0A`, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, background: isBad ? theme.red : theme.accent, width: `${pct}%`, transition: 'width 400ms' }} />
      </div>
      <div style={{ fontSize: 10, color: isBad ? theme.red : theme.textMuted, marginTop: 4 }}>{sub}</div>
    </div>
  );
}

function Stat({ theme, k, v }) {
  return (
    <div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginTop: 1 }}>{v}</div>
    </div>
  );
}

function FerruteckStrip({ recos }) {
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

function ThSort({ theme, children, align, col, orden, setOrden }) {
  const active = col && orden && orden.col === col;
  const clickable = !!col && !!setOrden;
  const style = {
    position: 'sticky', top: 0, background: theme.surface, textAlign: align || 'left',
    fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em',
    color: active ? theme.text : theme.textMuted, fontWeight: 600, padding: '8px 8px',
    borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
    cursor: clickable ? 'pointer' : 'default',
  };
  const onClick = () => {
    if (!clickable) return;
    setOrden(p => {
      if (p.col !== col) return { col, dir: 'desc' };
      if (p.dir === 'desc') return { col, dir: 'asc' };
      return { col: null, dir: null };
    });
  };
  return <th style={style} onClick={onClick}>{children}{active && <span style={{ marginLeft: 4, color: theme.accent, fontSize: 8 }}>{orden.dir === 'asc' ? '▲' : '▼'}</span>}</th>;
}

function cellStyle(theme, align) {
  return {
    padding: '7px 8px', borderBottom: `1px solid ${theme.divider || theme.border}`,
    verticalAlign: 'middle', textAlign: align || 'left', color: theme.text,
  };
}
