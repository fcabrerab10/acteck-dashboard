// Shared para los 3 layouts de HomeCliente.
// Hook de datos + formatters + componentes comunes.
import React, { useEffect, useMemo, useState } from 'react';
import { supabase, DB_CONFIGURED } from '../../../lib/supabase';
import { clientes } from '../../../lib/constants';
import { TYPO } from '../../../lib/themeTokens';
import { fetchSelloutSku, fetchInventarioCliente } from '../../../lib/pcelAdapter';

// ─── Constantes ───
export const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
export const MESES_FULL = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ─── Formatters ───
export const fmtCompact = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (a >= 1e6) return sign + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1e3) return sign + '$' + (a / 1e3).toFixed(0) + 'K';
  return sign + '$' + Math.round(a);
};
export const fmtMoney = (n) => {
  if (n == null || isNaN(n)) return '—';
  const a = Math.abs(n);
  return (n < 0 ? '-' : '') + '$' + a.toLocaleString('es-MX', { maximumFractionDigits: 0 });
};
export const fmtPct = (n) => n == null || isNaN(n) ? '—' : n.toFixed(1) + '%';
export const fmtNumber = (n) => n == null || isNaN(n) ? '—' : Math.round(n).toLocaleString('es-MX');

export function typo(t) {
  return {
    fontFamily: t === TYPO.body || t === TYPO.bodyLg || t === TYPO.eyebrow || t === TYPO.label || t === TYPO.caption
      ? TYPO.fontText : TYPO.fontDisplay,
    fontSize: t.fs, fontWeight: t.w, letterSpacing: t.ls, lineHeight: t.lh || 1.4,
  };
}

// Paginated fetch (PostgREST 1000 rows max)
async function fetchAllPages(queryFactory) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFactory().range(from, from + PAGE - 1);
    if (error || !data) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

// ─── Hook: carga datos del cliente ───
export function useHomeClienteData(clienteKey, anio) {
  const [sellInSku, setSellInSku] = useState([]);
  const [sellOutSku, setSellOutSku] = useState([]);
  const [sellInPrev, setSellInPrev] = useState([]);
  const [sellOutPrev, setSellOutPrev] = useState([]);
  const [cuotasMensuales, setCuotasMensuales] = useState([]);
  const [meta, setMeta] = useState(null);
  const [invCliente, setInvCliente] = useState([]);
  const [selloutSem, setSelloutSem] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [minutasList, setMinutasList] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    const hoy = new Date();
    const hace56 = new Date(hoy.getTime() - 56 * 86400000).toISOString().slice(0, 10);
    (async () => {
      const [siData, soData, mR, invData, cuotasR, sdR, tareasR, prodData, minR] = await Promise.all([
        fetchAllPages(() => supabase.from('sell_in_sku').select('*').eq('cliente', clienteKey).eq('anio', anio)),
        fetchSelloutSku(clienteKey, anio),
        supabase.from('metas_anuales').select('*').eq('cliente', clienteKey).eq('anio', anio).maybeSingle(),
        fetchInventarioCliente(clienteKey),
        supabase.from('cuotas_mensuales').select('*').eq('cliente', clienteKey).eq('anio', anio),
        fetchAllPages(() => supabase.from('sellout_detalle').select('fecha,total,cantidad,no_parte,marca').eq('cliente', clienteKey).gte('fecha', hace56)),
        supabase.from('pendientes').select('*').eq('cliente', clienteKey).eq('archivado', false).order('created_at', { ascending: false }),
        fetchAllPages(() => supabase.from('productos_cliente').select('sku,marca,precio_venta').eq('cliente', clienteKey)),
        supabase.from('minutas').select('*').eq('cliente', clienteKey).order('fecha_reunion', { ascending: false }).limit(3),
      ]);
      setSellInSku(siData);
      setSellOutSku(soData);
      setMeta(mR.data || null);
      setInvCliente(invData);
      setCuotasMensuales(cuotasR?.data || []);
      setSelloutSem(sdR);
      setTareas(tareasR.data || []);
      setProductos(prodData);
      setMinutasList(minR.data || []);

      // Fetch año anterior en paralelo
      const [siP, soP] = await Promise.all([
        fetchAllPages(() => supabase.from('sell_in_sku').select('mes,monto_pesos').eq('cliente', clienteKey).eq('anio', anio - 1)),
        fetchSelloutSku(clienteKey, anio - 1),
      ]);
      setSellInPrev(siP);
      setSellOutPrev(soP);

      setLoading(false);
    })();
  }, [clienteKey, anio]);

  const ventasPorMes = useMemo(() => {
    const map = {};
    for (let m = 1; m <= 12; m++) map[m] = { mes: m, sell_in: 0, sell_out: 0, sell_in_prev: 0, sell_out_prev: 0 };
    sellInSku.forEach(r => { const m = Number(r.mes); if (map[m]) map[m].sell_in += Number(r.monto_pesos) || 0; });
    sellOutSku.forEach(r => { const m = Number(r.mes); if (map[m]) map[m].sell_out += Number(r.monto_pesos) || 0; });
    sellInPrev.forEach(r => { const m = Number(r.mes); if (map[m]) map[m].sell_in_prev += Number(r.monto_pesos) || 0; });
    sellOutPrev.forEach(r => { const m = Number(r.mes); if (map[m]) map[m].sell_out_prev += Number(r.monto_pesos) || 0; });
    return map;
  }, [sellInSku, sellOutSku, sellInPrev, sellOutPrev]);

  const cuotasPorMes = useMemo(() => {
    const map = {};
    if (cuotasMensuales.length > 0) {
      cuotasMensuales.forEach(c => { map[Number(c.mes)] = c; });
    } else {
      const cfg = clientes[clienteKey];
      if (cfg?.cuotasMensuales) {
        for (let m = 1; m <= 12; m++) {
          map[m] = { mes: m, cuota_ideal: cfg.cuotasMensuales[m] || 0, cuota_min: cfg.cuotasMinimas?.[m] || Math.round((cfg.cuotasMensuales[m] || 0) * 0.9) };
        }
      }
    }
    return map;
  }, [cuotasMensuales, clienteKey]);

  const mesActual = new Date().getMonth() + 1;
  const cuotaAnual = (clientes[clienteKey]?.cuotaAnual) || (meta?.meta_sell_in_optimista) || 30000000;

  const kpis = useMemo(() => {
    let ventaYTD = 0, sellOutYTD = 0, ventaYTDPrev = 0, sellOutYTDPrev = 0;
    let cuotaYTD = 0;
    for (let m = 1; m <= 12; m++) {
      const v = ventasPorMes[m];
      const c = cuotasPorMes[m];
      if (m <= mesActual) {
        ventaYTD += v.sell_in;
        sellOutYTD += v.sell_out;
        ventaYTDPrev += v.sell_in_prev;
        sellOutYTDPrev += v.sell_out_prev;
        cuotaYTD += c?.cuota_ideal || 0;
      }
    }
    const ventaMes = ventasPorMes[mesActual]?.sell_in || 0;
    const ventaMesPrev = ventasPorMes[mesActual]?.sell_in_prev || 0;
    const cuotaMes = cuotasPorMes[mesActual]?.cuota_ideal || 0;
    const sellOutMes = ventasPorMes[mesActual]?.sell_out || 0;

    const deltaVentaYoY = ventaMesPrev > 0 ? ((ventaMes - ventaMesPrev) / ventaMesPrev) * 100 : null;
    const deltaVentaYTD = ventaYTDPrev > 0 ? ((ventaYTD - ventaYTDPrev) / ventaYTDPrev) * 100 : null;
    const deltaSellOutYTD = sellOutYTDPrev > 0 ? ((sellOutYTD - sellOutYTDPrev) / sellOutYTDPrev) * 100 : null;
    const cumplMes = cuotaMes > 0 ? (ventaMes / cuotaMes) * 100 : null;
    const cumplYTD = cuotaYTD > 0 ? (ventaYTD / cuotaYTD) * 100 : null;
    const cumplAnual = cuotaAnual > 0 ? (ventaYTD / cuotaAnual) * 100 : null;

    return {
      ventaMes, ventaMesPrev, cuotaMes, sellOutMes,
      ventaYTD, ventaYTDPrev, sellOutYTD, sellOutYTDPrev, cuotaYTD,
      cuotaAnual, deltaVentaYoY, deltaVentaYTD, deltaSellOutYTD,
      cumplMes, cumplYTD, cumplAnual,
    };
  }, [ventasPorMes, cuotasPorMes, mesActual, cuotaAnual]);

  // Inventario: última semana
  const invLatest = useMemo(() => {
    if (!invCliente.length) return { valor: 0, unidades: 0, skus: 0 };
    let maxA = 0, maxS = 0;
    invCliente.forEach(r => {
      const a = Number(r.anio) || 0, s = Number(r.semana) || 0;
      if (a > maxA || (a === maxA && s > maxS)) { maxA = a; maxS = s; }
    });
    const filas = invCliente.filter(r => Number(r.anio) === maxA && Number(r.semana) === maxS);
    let valor = 0, unidades = 0;
    filas.forEach(r => {
      const v = Number(r.valor) || (Number(r.stock) || 0) * (Number(r.costo_convenio) || 0);
      valor += v;
      unidades += Number(r.stock) || 0;
    });
    return { valor, unidades, skus: filas.length };
  }, [invCliente]);

  // Sellout semana actual + delta vs anterior
  const selloutSemana = useMemo(() => {
    if (!selloutSem.length) return { total: 0, delta: null };
    const getISOWeek = (d) => {
      const date = new Date(d);
      const thursday = new Date(date.valueOf());
      thursday.setDate(date.getDate() + 3 - ((date.getDay() + 6) % 7));
      const jan4 = new Date(thursday.getFullYear(), 0, 4);
      return 1 + Math.round(((thursday - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
    };
    const wMap = {};
    selloutSem.forEach(r => {
      if (!r.fecha) return;
      const d = new Date(r.fecha);
      const key = d.getFullYear() + '-W' + String(getISOWeek(d)).padStart(2, '0');
      if (!wMap[key]) wMap[key] = { total: 0, date: d };
      wMap[key].total += Number(r.total) || 0;
    });
    const sorted = Object.values(wMap).sort((a, b) => a.date - b.date);
    const last = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    const delta = prev && prev.total > 0 ? ((last.total - prev.total) / prev.total) * 100 : null;
    return { total: last?.total || 0, delta };
  }, [selloutSem]);

  // Top SKUs por venta YTD
  const topSkus = useMemo(() => {
    const map = {};
    sellOutSku.forEach(r => {
      if (!r.sku) return;
      if (!map[r.sku]) map[r.sku] = { sku: r.sku, monto: 0, piezas: 0 };
      map[r.sku].monto += Number(r.monto_pesos) || 0;
      map[r.sku].piezas += Number(r.piezas) || 0;
    });
    const prodMap = {};
    productos.forEach(p => { if (p.sku) prodMap[p.sku] = p; });
    return Object.values(map)
      .map(s => ({ ...s, marca: prodMap[s.sku]?.marca || '—' }))
      .sort((a, b) => b.monto - a.monto)
      .slice(0, 10);
  }, [sellOutSku, productos]);

  return {
    loading, mesActual,
    ventasPorMes, cuotasPorMes, kpis,
    invLatest, selloutSemana, topSkus,
    tareas, minutasList,
    clienteCfg: clientes[clienteKey] || {},
  };
}

// ─── Sparkline reutilizable ───
export function Sparkline({ theme, series, mesMax, color, height = 24, width = 100, interactive = false }) {
  const [hoverI, setHoverI] = useState(null);
  const points = (series || []).slice(0, mesMax).filter((v) => v != null && !isNaN(v));
  if (points.length < 2) return <div style={{ height }} />;
  const min = Math.min(...points, 0);
  const max = Math.max(...points);
  const range = max - min || 1;
  const step = width / (points.length - 1);
  const coords = points.map((v, i) => ({
    x: i * step,
    y: height - ((v - min) / range) * (height - 4) - 2,
    v,
  }));
  const poly = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ');
  const handleMove = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * width;
    const i = Math.round(x / step);
    setHoverI(i >= 0 && i < coords.length ? i : null);
  };
  return (
    <svg viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none"
      style={{ display: 'block', width: '100%', height, cursor: interactive ? 'crosshair' : 'default' }}
      onMouseMove={interactive ? handleMove : undefined}
      onMouseLeave={interactive ? () => setHoverI(null) : undefined}>
      <polyline points={poly} fill="none" stroke={color || theme.text}
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {interactive && hoverI != null && coords[hoverI] && (
        <>
          <circle cx={coords[hoverI].x} cy={coords[hoverI].y} r="2.5" fill={color || theme.text} />
          <title>{`${MESES_LBL[hoverI]}: ${fmtCompact(coords[hoverI].v)}`}</title>
        </>
      )}
    </svg>
  );
}

// ─── Chart mensual grande (venta vs cuota, comparativa año prev) ───
export function ChartVentaMensual({ theme, ventasPorMes, cuotasPorMes, mesMax, onMesClick }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const meses = [1,2,3,4,5,6,7,8,9,10,11,12];
  const ventaSerie = meses.map((m) => ventasPorMes[m]?.sell_in || 0);
  const ventaPrevSerie = meses.map((m) => ventasPorMes[m]?.sell_in_prev || 0);
  const cuotaSerie = meses.map((m) => cuotasPorMes[m]?.cuota_ideal || 0);

  const W = 900, H = 220;
  const padL = 40, padR = 40, padT = 30, padB = 46;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;
  const stepX = chartW / 11;

  const allVals = [...ventaSerie, ...ventaPrevSerie, ...cuotaSerie].filter((v) => v > 0);
  if (allVals.length === 0) return <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textMuted }}>Sin datos</div>;
  const min = 0;
  const max = Math.max(...allVals);
  const range = (max - min) || 1;
  const scaleY = (v) => padT + chartH - ((v - min) / range) * chartH;
  const scaleX = (i) => padL + i * stepX;

  const pathVenta = ventaSerie.map((v, i) => i <= mesMax && v > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}` : '').filter(Boolean).join(' ');
  const pathVentaPrev = ventaPrevSerie.map((v, i) => v > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}` : '').filter(Boolean).join(' ');
  const pathCuota = cuotaSerie.map((v, i) => v > 0 ? `${i === 0 ? 'M' : 'L'} ${scaleX(i)} ${scaleY(v)}` : '').filter(Boolean).join(' ');

  const handleMouseMove = (e) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    if (x < padL || x > W - padR) { setHoverIdx(null); return; }
    const i = Math.round((x - padL) / stepX);
    if (i < 0 || i > 11) { setHoverIdx(null); return; }
    setHoverIdx(i);
  };

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setHoverIdx(null)}>
      <line x1={padL} y1={scaleY(0)} x2={W - padR} y2={scaleY(0)} stroke={theme.divider} strokeWidth="1" />

      {pathCuota && <path d={pathCuota} fill="none" stroke={theme.textSubtle} strokeWidth="1.5" strokeDasharray="4 3" />}
      {pathVentaPrev && <path d={pathVentaPrev} fill="none" stroke={theme.textMuted} strokeWidth="1.5" strokeDasharray="2 3" opacity="0.6" />}
      {pathVenta && <path d={pathVenta} fill="none" stroke={theme.text} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />}

      {ventaSerie.map((v, i) => (i <= mesMax && v > 0) ? (
        <circle key={i} cx={scaleX(i)} cy={scaleY(v)} r={hoverIdx === i ? 6.5 : 4.5}
          fill={theme.text} stroke={theme.surface} strokeWidth={hoverIdx === i ? 3 : 2}
          style={{ cursor: 'pointer', transition: 'r 180ms cubic-bezier(0.34, 1.56, 0.64, 1)' }}
          onClick={() => onMesClick && onMesClick(i + 1)} />
      ) : null)}

      {hoverIdx != null && ventaSerie[hoverIdx] > 0 && (
        <>
          <line x1={scaleX(hoverIdx)} x2={scaleX(hoverIdx)} y1={padT} y2={padT + chartH}
            stroke={theme.text} strokeOpacity="0.25" strokeWidth="1" strokeDasharray="2 3" />
          <text x={scaleX(hoverIdx)} y={scaleY(ventaSerie[hoverIdx]) - 14} textAnchor="middle"
            fontSize="12" fontWeight="700" fill={theme.text} fontFamily={TYPO.fontDisplay}
            style={{ fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(ventaSerie[hoverIdx])}
          </text>
        </>
      )}

      {MESES_LBL.map((m, i) => (
        <text key={m} x={scaleX(i)} y={H - 14} textAnchor="middle"
          fontSize="11" fill={i < mesMax ? theme.textMuted : theme.textSubtle}
          fontFamily={TYPO.fontText}>{m}</text>
      ))}
    </svg>
  );
}

// ─── DeltaLine ───
export function DeltaLine({ theme, pct, label, size = 'sm', isPts, muted }) {
  if (pct == null || !isFinite(pct)) return <span style={{ ...typo(TYPO.caption), color: theme.textMuted }}>—</span>;
  const isPos = pct >= 0;
  const col = muted ? (isPos ? theme.green : theme.red) : (isPos ? theme.green : theme.red);
  const t = size === 'lg' ? { fs: 21, w: 500, ls: 0 } : size === 'md' ? { fs: 15, w: 500, ls: 0 } : { fs: 12, w: 500, ls: 0 };
  return (
    <span style={{
      ...typo(t), fontFamily: TYPO.fontText,
      color: col, fontVariantNumeric: 'tabular-nums',
    }}>
      {isPos ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}{isPts ? ' pts' : '%'}
      {label && <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6 }}>{label}</span>}
    </span>
  );
}

// ─── Progress bar tipo Apple ───
export function ProgressBar({ theme, pct, color, height = 8 }) {
  const clampedPct = Math.max(0, Math.min(100, pct || 0));
  return (
    <div style={{
      width: '100%', height, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
      borderRadius: 999, overflow: 'hidden',
    }}>
      <div style={{
        width: `${clampedPct}%`, height: '100%',
        background: color || theme.text, borderRadius: 999,
        transition: 'width 600ms cubic-bezier(0.32, 0.72, 0, 1)',
      }} />
    </div>
  );
}

// ─── TareasPanel — lista simple de pendientes ───
export function TareasPanel({ theme, tareas, max = 5 }) {
  const activas = tareas.filter(t => !t.completada).slice(0, max);
  if (activas.length === 0) {
    return (
      <div style={{ padding: '32px 0', textAlign: 'center', color: theme.textMuted }}>
        <div style={{ ...typo(TYPO.body), fontFamily: TYPO.fontText }}>Sin pendientes activos</div>
      </div>
    );
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {activas.map((t) => (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 14px', borderRadius: 10,
          background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: 999,
            background: t.prioridad === 'alta' ? theme.red : t.prioridad === 'media' ? theme.orange : theme.textSubtle,
            flexShrink: 0,
          }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ ...typo(TYPO.body), fontFamily: TYPO.fontText, color: theme.text }}>{t.descripcion}</div>
            {t.responsable && (
              <div style={{ ...typo(TYPO.caption), color: theme.textMuted, marginTop: 2 }}>{t.responsable}</div>
            )}
          </div>
          {t.fecha_entrega && (
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
              {new Date(t.fecha_entrega).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── TopSkusTable — top vendidos YTD ───
export function TopSkusTable({ theme, topSkus }) {
  if (!topSkus?.length) {
    return <div style={{ padding: '32px 0', textAlign: 'center', color: theme.textMuted, ...typo(TYPO.body), fontFamily: TYPO.fontText }}>Sin datos de venta</div>;
  }
  const maxMonto = topSkus[0]?.monto || 1;
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {topSkus.map((s, i) => (
        <div key={s.sku} style={{
          display: 'grid', gridTemplateColumns: '30px 1fr 90px 100px 60px',
          gap: 12, alignItems: 'center', padding: '12px 4px',
          borderBottom: i < topSkus.length - 1 ? `1px solid ${theme.divider}` : 'none',
        }}>
          <span style={{ ...typo(TYPO.caption), color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {String(i + 1).padStart(2, '0')}
          </span>
          <div style={{ minWidth: 0 }}>
            <div style={{ ...typo({ fs: 14, w: 500 }), color: theme.text, fontFamily: TYPO.fontText,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sku}</div>
            <div style={{ ...typo(TYPO.caption), color: theme.textMuted }}>{s.marca}</div>
          </div>
          <div style={{ ...typo({ fs: 13, w: 500 }), color: theme.text, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {fmtCompact(s.monto)}
          </div>
          <div style={{ ...typo(TYPO.caption), color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
            {fmtNumber(s.piezas)} pzs
          </div>
          <div>
            <div style={{
              height: 3, background: theme.divider, borderRadius: 999, overflow: 'hidden',
            }}>
              <div style={{
                width: `${(s.monto / maxMonto) * 100}%`, height: '100%',
                background: theme.text, borderRadius: 999,
              }} />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
