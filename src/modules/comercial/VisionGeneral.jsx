import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import {
  Activity, TrendingUp, TrendingDown, Users, Package,
  Wallet, AlertTriangle,
} from 'lucide-react';
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer, AreaChart, Area, Legend,
} from 'recharts';

// ────────── Constantes ──────────
const MESES_LBL  = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// Paleta Bento (igual que EstadoResultados para mantener consistencia)
const PALETTE = {
  blue:   { bg: '#E6F1FB', text: '#042C53', mid: '#185FA5', strong: '#3B82F6' },
  teal:   { bg: '#E1F5EE', text: '#04342C', mid: '#0F6E56', strong: '#1D9E75' },
  purple: { bg: '#EEEDFE', text: '#26215C', mid: '#534AB7', strong: '#7F77DD' },
  coral:  { bg: '#FAECE7', text: '#4A1B0C', mid: '#993C1D', strong: '#D85A30' },
  amber:  { bg: '#FAEEDA', text: '#412402', mid: '#854F0B', strong: '#BA7517' },
  red:    { bg: '#FCEBEB', text: '#501313', mid: '#A32D2D', strong: '#E24B4A' },
  pink:   { bg: '#FBEAF0', text: '#4B1528', mid: '#993556', strong: '#D4537E' },
  gray:   { bg: '#F1EFE8', text: '#2C2C2A', mid: '#5F5E5A', strong: '#888780' },
};

// Mapeo color por admin_interna (sub-canal específico)
const CANAL_COLOR = {
  'DISTRIBUIDOR':         PALETTE.blue.mid,
  'MERCADO LIBRE':        PALETTE.amber.mid,
  'AMAZON':               PALETTE.coral.mid,
  'SITIO WEB':            PALETTE.teal.mid,
  'CYBERPURTA':           PALETTE.purple.mid,
  'SANBORN':              PALETTE.pink.mid,
  'WALMART':              PALETTE.purple.strong,
  'MOSTRADOR':            PALETTE.teal.strong,
  'RETAIL REPRESENTADOS': PALETTE.coral.strong,
  'RETAIL PROPIOS':       PALETTE.pink.strong,
  'MAYOREO':              PALETTE.blue.strong,
  'otros':                PALETTE.gray.mid,
};
const colorCanal = (k) => CANAL_COLOR[String(k || '').toUpperCase()] || PALETTE.gray.mid;

// ────────── Formateadores ──────────
const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  const sign = Number(n) < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(Number(n));
  return (Number(n) < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
const fmtPctDelta = (n) => n == null || isNaN(n) ? '—' : (n >= 0 ? '+' : '') + n.toFixed(1) + '%';
const fmtInt = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

// ────────── Componente principal ──────────
export default function VisionGeneral() {
  const [anio, setAnio] = useState(new Date().getFullYear());
  const [aniosDisponibles, setAniosDisponibles] = useState([]);
  const [mensualAct, setMensualAct] = useState([]);
  const [mensualPrev, setMensualPrev] = useState([]);
  const [topClientes, setTopClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  // ── Cargar años disponibles
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('v_vision_canal_mensual').select('anio').order('anio', { ascending: false });
      const unique = Array.from(new Set((data || []).map((r) => r.anio))).sort((a, b) => b - a);
      setAniosDisponibles(unique);
      if (unique.length > 0 && !unique.includes(anio)) setAnio(unique[0]);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Cargar mensual del año + año anterior + top clientes
  useEffect(() => {
    setLoading(true);
    (async () => {
      const [a, p, t] = await Promise.all([
        supabase.from('v_vision_canal_mensual').select('*').eq('anio', anio),
        supabase.from('v_vision_canal_mensual').select('*').eq('anio', anio - 1),
        supabase.from('v_vision_top_clientes').select('*').eq('anio', anio)
          .order('monto', { ascending: false }).limit(15),
      ]);
      setMensualAct(a.data || []);
      setMensualPrev(p.data || []);
      setTopClientes(t.data || []);
      setLoading(false);
    })();
  }, [anio]);

  // ── Mes máximo con datos
  const mesMax = useMemo(() => {
    let m = 0;
    mensualAct.forEach((r) => { if (Number(r.mes) > m) m = Number(r.mes); });
    return m || 12;
  }, [mensualAct]);

  // ── Helpers de agregación
  const sumYTDPor = (rows, fn, m = mesMax) => rows
    .filter((r) => Number(r.mes) <= m)
    .reduce((s, r) => s + (Number(fn(r)) || 0), 0);

  // ── KPIs
  const kpis = useMemo(() => {
    const monto      = sumYTDPor(mensualAct, (r) => r.monto);
    const piezas     = sumYTDPor(mensualAct, (r) => r.piezas);
    const montoPrev  = sumYTDPor(mensualPrev, (r) => r.monto);
    const piezasPrev = sumYTDPor(mensualPrev, (r) => r.piezas);
    const nClientes  = new Set(topClientes.map((c) => c.cliente_nombre)).size; // proxy aprox (top 15)
    // Para # clientes total ytd, sumamos n_clientes únicos por canal (aprox)
    const clientesTot = mensualAct
      .filter((r) => Number(r.mes) <= mesMax)
      .reduce((s, r) => Math.max(s, Number(r.n_clientes) || 0), 0);
    const tkt = piezas > 0 ? monto / piezas : null;

    return {
      monto, piezas, montoPrev, piezasPrev, tkt,
      clientes: nClientes,
      clientesTot,
      deltaMonto:  montoPrev > 0 ? ((monto - montoPrev) / montoPrev) * 100 : null,
      deltaPiezas: piezasPrev > 0 ? ((piezas - piezasPrev) / piezasPrev) * 100 : null,
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensualAct, mensualPrev, topClientes, mesMax]);

  // ── Mix por sub-canal (admin_interna) — agregación YTD
  const mixCanales = useMemo(() => {
    const m = new Map();
    mensualAct
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const key = r.admin_interna || 'Otros';
        if (!m.has(key)) m.set(key, { admin_interna: key, canal: r.canal, monto: 0, piezas: 0, n_clientes: 0 });
        const c = m.get(key);
        c.monto += Number(r.monto) || 0;
        c.piezas += Number(r.piezas) || 0;
        c.n_clientes = Math.max(c.n_clientes, Number(r.n_clientes) || 0);
      });
    // Δ YoY
    const prevByCanal = new Map();
    mensualPrev
      .filter((r) => Number(r.mes) <= mesMax)
      .forEach((r) => {
        const key = r.admin_interna || 'Otros';
        prevByCanal.set(key, (prevByCanal.get(key) || 0) + (Number(r.monto) || 0));
      });
    const totalActual = Array.from(m.values()).reduce((s, c) => s + c.monto, 0);
    return Array.from(m.values())
      .map((c) => {
        const prev = prevByCanal.get(c.admin_interna) || 0;
        return {
          ...c,
          share: totalActual > 0 ? (c.monto / totalActual) * 100 : 0,
          deltaYoY: prev > 0 ? ((c.monto - prev) / prev) * 100 : null,
        };
      })
      .sort((a, b) => b.monto - a.monto);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensualAct, mensualPrev, mesMax]);

  // ── Tendencia mensual: 12 meses, una col por sub-canal
  const tendencia = useMemo(() => {
    const canalesTop = mixCanales.slice(0, 7).map((c) => c.admin_interna); // top 7 + otros
    const otrasCanal = new Set(
      mixCanales.slice(7).map((c) => c.admin_interna)
    );
    const data = [];
    for (let i = 1; i <= 12; i++) {
      const row = { mes: MESES_LBL[i - 1] };
      canalesTop.forEach((c) => { row[c] = 0; });
      if (otrasCanal.size > 0) row['Otros'] = 0;
      data.push(row);
    }
    mensualAct.forEach((r) => {
      const mes = Number(r.mes);
      if (mes < 1 || mes > 12) return;
      const key = canalesTop.includes(r.admin_interna) ? r.admin_interna
                 : (otrasCanal.size > 0 ? 'Otros' : null);
      if (!key) return;
      data[mes - 1][key] = (data[mes - 1][key] || 0) + (Number(r.monto) || 0);
    });
    return { data: data.slice(0, mesMax || 12), canales: [...canalesTop, ...(otrasCanal.size > 0 ? ['Otros'] : [])] };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mensualAct, mixCanales, mesMax]);

  // ── Alertas / concentración
  const alertas = useMemo(() => {
    const out = [];
    const total = kpis.monto;
    if (total > 0) {
      // Cliente con concentración >25%
      const topCli = topClientes[0];
      if (topCli && (Number(topCli.monto) / total) > 0.25) {
        out.push({
          type: 'concentracion',
          msg: `${topCli.cliente_nombre} concentra ${((Number(topCli.monto) / total) * 100).toFixed(1)}% de la facturación (${topCli.admin_interna})`,
        });
      }
      // Top canal
      const topCanal = mixCanales[0];
      if (topCanal && topCanal.share > 50) {
        out.push({
          type: 'canal',
          msg: `${topCanal.admin_interna} concentra ${topCanal.share.toFixed(1)}% del total`,
        });
      }
      // Canal en caída
      mixCanales.slice(0, 5).forEach((c) => {
        if (c.deltaYoY != null && c.deltaYoY <= -15) {
          out.push({
            type: 'caida',
            msg: `${c.admin_interna}: ${fmtPctDelta(c.deltaYoY)} vs ${anio - 1} (${fmtCompact(c.monto)})`,
          });
        }
      });
    }
    return out;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kpis.monto, mixCanales, topClientes, anio]);

  if (loading) {
    return (
      <div className="p-12 text-center text-gray-400">
        <Activity className="w-10 h-10 mx-auto mb-3" />
        Cargando visión general…
      </div>
    );
  }
  if (mensualAct.length === 0) {
    return (
      <div className="p-12 text-center text-gray-500">
        <Activity className="w-12 h-12 text-gray-300 mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-gray-700 mb-2">Visión general</h2>
        <p>No hay datos para {anio}. Sube el archivo ERP en /uploads.html.</p>
      </div>
    );
  }

  return (
    <div className="max-w-none mx-auto p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4 px-1">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-gray-500 mb-1">
            Dirección Comercial · YTD ene–{MESES_LBL[mesMax - 1]} {anio}
          </p>
          <h2 className="text-2xl font-medium text-gray-800">Visión general</h2>
        </div>
        <label className="flex flex-col text-[11px] text-gray-500">
          Año
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white">
            {aniosDisponibles.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </div>

      {/* Alertas */}
      {alertas.length > 0 && <AlertasBanner alertas={alertas} />}

      {/* KPIs Bento */}
      <div className="grid grid-cols-4 gap-2.5">
        <BentoKpi palette={PALETTE.blue} icon={Wallet} label="Facturación YTD"
          valor={fmtCompact(kpis.monto)} delta={kpis.deltaMonto}
          deltaLabel={`vs ${anio - 1}`}
          subtitulo={kpis.montoPrev > 0 ? `${anio - 1}: ${fmtCompact(kpis.montoPrev)}` : `${anio - 1} sin datos`} />
        <BentoKpi palette={PALETTE.teal} icon={Package} label="Piezas YTD"
          valor={fmtInt(kpis.piezas)} delta={kpis.deltaPiezas}
          deltaLabel={`vs ${anio - 1}`}
          subtitulo={kpis.piezasPrev > 0 ? `${anio - 1}: ${fmtInt(kpis.piezasPrev)} pzs` : ''} />
        <BentoKpi palette={PALETTE.purple} icon={Users} label="Clientes activos"
          valor={fmtInt(kpis.clientesTot)} delta={null}
          subtitulo={`Distintos cliente_nombre del periodo`} />
        <BentoKpi palette={PALETTE.coral} icon={TrendingUp} label="Ticket promedio"
          valor={kpis.tkt != null ? fmtMoney(kpis.tkt) : '—'} delta={null}
          subtitulo={`$ / pieza facturada`} />
      </div>

      {/* Mix de canales — donut + tabla */}
      <MixCanalesCard mix={mixCanales} anio={anio} anioPrev={anio - 1} total={kpis.monto} />

      {/* Tendencia mensual por canal */}
      <TendenciaCard data={tendencia.data} canales={tendencia.canales} anio={anio} mesMax={mesMax} />

      {/* Top 15 clientes */}
      <TopClientesCard clientes={topClientes} total={kpis.monto} />

      <p className="text-[11px] text-gray-400 px-2">
        Fuente: <code>v_vision_canal_mensual</code> + <code>v_vision_top_clientes</code> (agregación de ventas_erp).
        monto = monto_venta_pesos neto (devoluciones incluidas).
      </p>
    </div>
  );
}

// ────────── KPI Bento ──────────
function BentoKpi({ palette, icon: Icon, label, valor, subtitulo, delta, deltaLabel }) {
  return (
    <div style={{ background: palette.bg, borderRadius: 12, padding: '14px 16px' }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
        <p style={{ fontSize: 11, margin: 0, color: palette.mid, letterSpacing: '0.03em' }}>{label}</p>
        {Icon && <Icon className="w-3.5 h-3.5" style={{ color: palette.mid }} />}
      </div>
      <p style={{
        fontSize: 24, fontWeight: 500, margin: '2px 0 4px',
        color: palette.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1,
      }}>
        {valor}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minHeight: 14, flexWrap: 'wrap' }}>
        {delta != null && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 2, fontSize: 11, fontWeight: 500,
            color: delta >= 0 ? '#0F6E56' : '#A32D2D' }}>
            {delta >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {fmtPctDelta(delta)} {deltaLabel}
          </span>
        )}
        {subtitulo && <span style={{ fontSize: 11, color: palette.mid }}>{subtitulo}</span>}
      </div>
    </div>
  );
}

// ────────── Mix de canales (donut + tabla) ──────────
function MixCanalesCard({ mix, anio, anioPrev, total }) {
  if (mix.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 grid gap-4" style={{ gridTemplateColumns: '1fr 1.4fr' }}>
      <div>
        <p className="text-sm font-medium text-gray-800 mb-2">Mix por canal · YTD</p>
        <div style={{ width: '100%', height: 260 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie data={mix} dataKey="monto" nameKey="admin_interna"
                innerRadius={60} outerRadius={100} stroke="#fff" strokeWidth={2}
                isAnimationActive={false}>
                {mix.map((c, i) => <Cell key={i} fill={colorCanal(c.admin_interna)} />)}
              </Pie>
              <Tooltip
                formatter={(v, n, p) => [fmtMoney(v) + ` · ${(p.payload.share || 0).toFixed(1)}%`, p.payload.admin_interna]}
                contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-1">
          Total facturación: {fmtCompact(total)}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ ...thLeft, minWidth: 140 }}>Canal</th>
              <th style={thRight}>Monto</th>
              <th style={thRight}>% del total</th>
              <th style={thRight}>Clientes</th>
              <th style={{ ...thRight, background: PALETTE.purple.bg, color: PALETTE.purple.text }}>vs {anioPrev}</th>
            </tr>
          </thead>
          <tbody>
            {mix.map((c) => (
              <tr key={c.admin_interna} style={{ borderBottom: '1px solid #F1F5F9' }}>
                <td style={tdLeft}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 4, background: colorCanal(c.admin_interna) }} />
                    {c.admin_interna}
                  </span>
                  <span className="block text-[10px] text-gray-400">{c.canal}</span>
                </td>
                <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(c.monto)}</td>
                <td style={tdRight}>
                  <BarPct pct={c.share} color={colorCanal(c.admin_interna)} />
                </td>
                <td style={tdRight}>{fmtInt(c.n_clientes)}</td>
                <td style={{ ...tdRight, background: PALETTE.purple.bg,
                  color: c.deltaYoY == null ? '#94A3B8' : c.deltaYoY >= 0 ? '#0F6E56' : '#A32D2D',
                  fontWeight: 500 }}>
                  {c.deltaYoY == null ? '—' : fmtPctDelta(c.deltaYoY)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BarPct({ pct, color }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
      <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>{pct.toFixed(1)}%</span>
      <span style={{ width: 50, height: 6, background: '#F1F5F9', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
        <span style={{ position: 'absolute', inset: 0, width: `${Math.min(pct, 100)}%`, background: color }} />
      </span>
    </span>
  );
}

// ────────── Tendencia (área apilada) ──────────
function TendenciaCard({ data, canales, anio, mesMax }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">Facturación mensual por canal</p>
        <p className="text-[11px] text-gray-400">{anio} · {mesMax} meses con datos</p>
      </div>
      <div style={{ width: '100%', height: 280 }}>
        <ResponsiveContainer>
          <AreaChart data={data} margin={{ top: 10, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#F1F5F9" vertical={false} />
            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={{ stroke: '#E2E8F0' }} tickLine={false} />
            <YAxis tickFormatter={(v) => '$' + (v / 1e6).toFixed(0) + 'M'} tick={{ fontSize: 10, fill: '#6B6A64' }} axisLine={false} tickLine={false} />
            <Tooltip formatter={(v) => fmtMoney(v)} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 10, paddingTop: 6 }} iconType="square" />
            {canales.map((c) => (
              <Area key={c} type="monotone" dataKey={c} stackId="1"
                stroke={colorCanal(c)} fill={colorCanal(c)} fillOpacity={0.85}
                isAnimationActive={false} />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ────────── Top clientes ──────────
function TopClientesCard({ clientes, total }) {
  if (clientes.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-baseline justify-between mb-2">
        <p className="text-sm font-medium text-gray-800">Top 15 clientes · YTD</p>
        <p className="text-[11px] text-gray-400">% del total facturado</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full" style={{ fontSize: 12 }}>
          <thead>
            <tr style={{ background: '#FAFBFC', borderBottom: '1px solid #E2E8F0' }}>
              <th style={{ ...thLeft, width: 30 }}>#</th>
              <th style={thLeft}>Cliente</th>
              <th style={thLeft}>Canal</th>
              <th style={thRight}>Monto</th>
              <th style={thRight}>%</th>
              <th style={thRight}>Piezas</th>
              <th style={thRight}>Meses activos</th>
            </tr>
          </thead>
          <tbody>
            {clientes.map((c, i) => {
              const share = total > 0 ? (Number(c.monto) / total) * 100 : 0;
              return (
                <tr key={c.cliente_nombre + i} style={{ borderBottom: '1px solid #F1F5F9' }}>
                  <td style={{ ...tdLeft, color: '#94A3B8' }}>{i + 1}</td>
                  <td style={tdLeft} title={c.cliente_nombre}>
                    <span className="block" style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {c.cliente_nombre}
                    </span>
                  </td>
                  <td style={tdLeft}>
                    <span style={{
                      fontSize: 10, padding: '2px 8px', borderRadius: 10,
                      background: colorCanal(c.admin_interna) + '20', color: '#1E293B',
                    }}>
                      {c.admin_interna}
                    </span>
                  </td>
                  <td style={{ ...tdRight, fontWeight: 500 }}>{fmtCompact(c.monto)}</td>
                  <td style={tdRight}>
                    <BarPct pct={share} color={colorCanal(c.admin_interna)} />
                  </td>
                  <td style={tdRight}>{fmtInt(c.piezas)}</td>
                  <td style={tdRight}>{c.meses_activos}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ────────── Alertas ──────────
function AlertasBanner({ alertas }) {
  return (
    <div style={{
      background: PALETTE.amber.bg, borderRadius: 12, padding: '10px 14px',
      borderLeft: `4px solid ${PALETTE.amber.strong}`,
    }}>
      <div className="flex items-start gap-2.5">
        <AlertTriangle className="w-4 h-4 flex-none mt-0.5" style={{ color: PALETTE.amber.mid }} />
        <div className="flex-1">
          <p style={{ fontSize: 11, color: PALETTE.amber.mid, fontWeight: 500, margin: 0, letterSpacing: '0.03em' }}>
            Insights del periodo ({alertas.length})
          </p>
          <ul style={{ margin: '4px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {alertas.map((a, i) => (
              <li key={i} style={{ fontSize: 12, color: PALETTE.amber.text }}>{a.msg}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// ────────── Tabla styles ──────────
const thLeft = { padding: '8px 12px', textAlign: 'left', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const thRight = { padding: '8px 8px', textAlign: 'right', fontWeight: 500, color: '#6B6A64', fontSize: 11, whiteSpace: 'nowrap' };
const tdLeft = { padding: '8px 12px', color: '#334155', fontSize: 12 };
const tdRight = { padding: '8px 8px', textAlign: 'right', color: '#1E293B', fontSize: 12, fontVariantNumeric: 'tabular-nums' };
