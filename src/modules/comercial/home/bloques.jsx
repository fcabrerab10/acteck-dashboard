// Bloques (Panel) del Home V3 · presentación pura sobre el resultado de calc.js. Sólo kit + theme/TYPO.
import React, { useState } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { moneyCompact as $c, money as $, int, fecha, fechaCorta } from '../../../lib/format';
import { Panel, Segmented, TablaCompacta, HeatCell, Pill, Boton } from '../../../components/kit';
import { MESES, META_INV_DIAS } from './config';

const RANGOS = [{ id: 'Q1', label: 'Q1' }, { id: 'Q2', label: 'Q2' }, { id: 'Q3', label: 'Q3' }, { id: 'Q4', label: 'Q4' }, { id: 'anio', label: 'Año' }];
const signo = (v, d = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const toneRatio = (v) => (v == null ? 'gray' : v >= 80 ? 'green' : v >= 60 ? 'orange' : 'red');
const TONO_ESTADO = { pendiente: 'orange', en_curso: 'blue', esperando_info: 'purple', completado: 'green', activo: 'green', en_proceso: 'blue', pagado: 'green' };

// Mini estadística (k arriba, v abajo) para las filas de sumas dentro de un Panel.
export function Stat({ k, v, sub, color }) {
  const { theme } = useTheme();
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 8.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{v}</div>
      {sub && <div style={{ fontSize: 9.5, color: theme.textMuted, whiteSpace: 'nowrap' }}>{sub}</div>}
    </div>
  );
}
const FilaStats = ({ children }) => <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '2px 2px 10px' }}>{children}</div>;

// ── Sell In vs Sell Out mensual · barras SI/SO + líneas año anterior y cuotas · filtro Q · sumas
export function GraficaSiSo({ serie, rango, setRango, anio }) {
  const { theme } = useTheme();
  const { data, sums } = serie;
  const tip = { fontSize: 11.5, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText };
  const ejeY = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(1)}M` : `$${Math.round(v / 1e3)}K`);
  return (
    <Panel titulo="Sell In vs Sell Out" meta={`${anio} · mensual vs cuota y ${anio - 1}`} acciones={<Segmented options={RANGOS} value={rango} onChange={setRango} />}>
      <FilaStats>
        <Stat k={`Sell In ${anio}`} v={$c(sums.si)} sub={`${anio - 1}: ${$c(sums.siPrev)}`} />
        <Stat k="Δ YoY" v={signo(sums.yoy)} color={sums.yoy == null ? theme.textMuted : sums.yoy >= 0 ? theme.green : theme.red} />
        <Stat k="Cuota mín" v={$c(sums.cuotaMin)} sub={`Δ ${signo(sums.vsMin)}`} color={sums.vsMin == null ? undefined : sums.vsMin >= 0 ? theme.green : theme.orange} />
        <Stat k="Cuota ideal" v={$c(sums.cuota)} sub={`Δ ${signo(sums.vsIdeal)}`} color={sums.vsIdeal == null ? undefined : sums.vsIdeal >= 0 ? theme.green : theme.orange} />
        <Stat k="Sell Out" v={$c(sums.so)} sub={sums.ratio != null ? `ratio SO/SI ${Math.round(sums.ratio)}%${sums.ratioPrev != null ? ` · ${signo(sums.ratio - sums.ratioPrev)} pp vs ${anio - 1}` : ''}` : 'sin ratio'} />
      </FilaStats>
      <ResponsiveContainer width="100%" height={220}>
        <ComposedChart data={data} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
          <XAxis dataKey="mes" tick={{ fontSize: 10, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={ejeY} tick={{ fontSize: 9.5, fill: theme.textMuted }} axisLine={false} tickLine={false} width={44} />
          <Tooltip cursor={{ fill: theme.textMuted, fillOpacity: 0.06 }} contentStyle={tip} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} formatter={(v, n) => [v == null ? '—' : $(v), n]} />
          <Bar dataKey="si" name={`Sell In ${anio}`} fill={theme.accent} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Bar dataKey="so" name="Sell Out" fill={theme.green} fillOpacity={0.8} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
          <Line type="monotone" dataKey="siPrev" name={`Sell In ${anio - 1}`} stroke={theme.textMuted} strokeWidth={1.6} strokeDasharray="5 4" dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="cuota" name="Cuota ideal" stroke={theme.orange} strokeWidth={1.8} strokeDasharray="6 4" dot={false} isAnimationActive={false} connectNulls />
          <Line type="monotone" dataKey="cuotaMin" name="Cuota mín" stroke={theme.orange} strokeWidth={1.2} strokeDasharray="2 4" dot={false} isAnimationActive={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </Panel>
  );
}

// ── Sell In vs Sell Out por marca o por sucursal (HeatCell + ratio)
export function SplitTabla({ filas, cfg, rango, setRango }) {
  const maxSi = Math.max(1, ...filas.map((f) => f.si)), maxSo = Math.max(1, ...filas.map((f) => f.so));
  const sucursal = cfg.split === 'sucursal';
  const cols = [
    { key: 'label', label: sucursal ? 'Sucursal' : 'Marca', align: 'left', render: (f) => <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>{f.label}{sucursal && <Pill size="xs" tone={f.tipo === 'fisica' ? 'blue' : 'gray'}>{f.tipo === 'fisica' ? 'Física' : 'Virtual'}</Pill>}</span> },
    { key: 'si', label: sucursal ? 'Sell In prop.' : 'Sell In', render: (f) => <HeatCell v={f.si} max={maxSi} fmt={$c} /> },
    { key: 'so', label: 'Sell Out', render: (f) => <HeatCell v={f.so} max={maxSo} fmt={$c} /> },
    { key: 'ratio', label: 'SO/SI', render: (f) => <Pill tone={toneRatio(f.ratio)}>{f.ratio == null ? '—' : `${Math.round(f.ratio)}%`}</Pill> },
  ];
  return (
    <Panel titulo={`Sell In vs Sell Out por ${sucursal ? 'sucursal' : 'marca'}`} meta={sucursal ? 'SI repartido según el peso de cada sucursal en el SO' : 'ratio SO/SI'} acciones={<Segmented options={RANGOS.map((o) => (o.id === 'anio' ? { ...o, label: 'YTD' } : o))} value={rango} onChange={setRango} />}>
      <TablaCompacta columnas={cols} filas={filas} rowKey={(f) => f.key} dense vacio="Sin datos de sell in/out para este rango." />
    </Panel>
  );
}

// ── Top SKUs por sell-out (piezas) · últimos 4 meses con HeatCell
export function TopSkusTabla({ top, onNavegar }) {
  const max = Math.max(1, ...top.filas.flatMap((f) => top.meses.map((m) => f[`m${m}`] || 0)));
  const conMonto = top.filas.some((f) => f.monto > 0);
  const cols = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true },
    { key: 'marca', label: 'Marca', align: 'left', render: (f) => <Pill size="xs" tone={f.marca === 'Balam Rush' ? 'purple' : f.marca === 'Acteck' ? 'blue' : 'gray'}>{f.marca}</Pill> },
    ...top.meses.map((m) => ({ key: `m${m}`, label: MESES[m - 1], render: (f) => <HeatCell v={f[`m${m}`]} max={max} /> })),
    { key: 'total', label: 'Pzs', bold: true, render: (f) => int(f.total) },
    ...(conMonto ? [{ key: 'monto', label: 'Monto', render: (f) => $c(f.monto) }] : []),
  ];
  return (
    <Panel titulo="Top SKUs · sell-out" meta="piezas por mes" acciones={onNavegar && <Boton onClick={onNavegar}>Ver Sell Out</Boton>}>
      <TablaCompacta columnas={cols} filas={top.filas} rowKey={(f) => f.sku} dense vacio="Sin sell-out por SKU este año." />
    </Panel>
  );
}

// ── Inventario del cliente · snapshot + días + SKUs críticos
export function InventarioPanel({ r, onNavegar }) {
  const { theme } = useTheme();
  const dias = r.diasInv;
  const cols = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true },
    { key: 'titulo', label: 'Producto', align: 'left', maxWidth: 220 },
    { key: 'prom', label: 'Rotación/mes', render: (f) => int(f.prom) },
    { key: 'stock', label: 'Stock', render: (f) => int(f.stock) },
    { key: 'dias', label: 'Cobertura', render: (f) => <Pill tone={f.dias < 7 ? 'red' : f.dias < 15 ? 'orange' : 'yellow'}>{f.dias}d</Pill> },
  ];
  return (
    <Panel titulo="Inventario del cliente" meta={r.inv.semana ? `semana ${r.inv.semana} · ${r.inv.anio}` : 'sin snapshot'} acciones={onNavegar && <Boton onClick={onNavegar}>Ver detalle</Boton>}>
      <FilaStats>
        <Stat k="Valor" v={$c(r.inv.valor)} sub={`${int(r.inv.stock)} pzs · ${int(r.inv.skus)} SKUs con stock`} />
        <Stat k="Días de inventario" v={dias != null ? `${dias}d` : '—'} sub={`meta ${META_INV_DIAS}d${dias != null && dias > META_INV_DIAS ? ` · ▲${dias - META_INV_DIAS}d` : ''}`} color={dias == null ? theme.textMuted : dias > META_INV_DIAS ? theme.orange : theme.green} />
        <Stat k="Cobertura" v={dias == null ? '—' : dias <= 30 ? 'Riesgo stockout' : dias <= 90 ? 'Óptimo' : dias <= 150 ? 'Alto' : 'Sobreinventario'} color={dias == null ? theme.textMuted : dias <= 30 ? theme.red : dias <= 90 ? theme.green : theme.orange} />
        {r.inv.transito > 0 && <Stat k="Tránsito del cliente" v={`${int(r.inv.transito)} pzs`} />}
        <Stat k="SKUs críticos" v={String(r.criticos.length)} sub="< 30 días de cobertura" color={r.criticos.length ? theme.red : theme.green} />
      </FilaStats>
      {r.criticos.length > 0 && <TablaCompacta columnas={cols} filas={r.criticos} rowKey={(f) => f.sku} dense />}
    </Panel>
  );
}

// ── Crédito y cobranza · saldo, DSO, aging (click en un tramo → top 3 facturas)
export function CobranzaPanel({ r, onNavegar }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(null);
  const c = r.cartera, b = c.buckets;
  const tramos = [['d1_30', '1-30 d', theme.orange], ['d31_60', '31-60 d', theme.orange], ['d61_90', '61-90 d', theme.red], ['mas90', '+90 d', theme.red]];
  const monto = (k) => b[k].reduce((s, f) => s + f.saldo, 0);
  const maxB = Math.max(1, ...tramos.map(([k]) => monto(k)));
  return (
    <Panel titulo="Crédito y cobranza" meta={c.corte ? `corte ${fecha(c.corte)}` : 'sin estado de cuenta'} acciones={onNavegar && <Boton onClick={onNavegar}>Ver cartera</Boton>}>
      <FilaStats>
        <Stat k="Saldo actual" v={$c(c.total || c.saldo)} sub={`${$c(c.alDia)} al día`} />
        <Stat k="Vencido" v={$c(c.vencido)} sub={c.total > 0 ? `${Math.round((c.vencido / c.total) * 100)}% del saldo` : ''} color={c.vencido > 0 ? theme.red : theme.green} />
        <Stat k="Por vencer" v={$c(c.aVencer)} />
        <Stat k="DSO" v={c.dso != null ? `${c.dso} d` : '—'} color={c.dso == null ? theme.textMuted : c.dso <= 60 ? theme.green : c.dso <= 90 ? theme.orange : theme.red} />
        {c.notasCredito > 0 && <Stat k="Notas de crédito" v={$c(c.notasCredito)} />}
        {c.cobranzaMes != null && <Stat k="Cobranza est. mes" v={$c(c.cobranzaMes)} sub="fact. + Δ saldo" />}
      </FilaStats>
      {tramos.map(([k, label, col]) => (
        <div key={k} onClick={() => setAbierto(abierto === k ? null : k)} style={{ display: 'grid', gridTemplateColumns: '60px 1fr 28px 70px', gap: 8, alignItems: 'center', padding: '4px 6px', borderRadius: 6, cursor: 'pointer', fontSize: 10.5, background: abierto === k ? theme.surfaceHover : 'transparent' }}>
          <span style={{ color: theme.textMuted, fontWeight: 500 }}>{label}</span>
          <span style={{ height: 4, background: theme.border, borderRadius: 999, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${Math.min(100, (monto(k) / maxB) * 100)}%`, background: col, borderRadius: 999 }} /></span>
          <span style={{ fontFamily: TYPO.fontDisplay, color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{b[k].length || '—'}</span>
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{$c(monto(k))}</span>
        </div>
      ))}
      {abierto && b[abierto].length > 0 && (
        <TablaCompacta dense columnas={[{ key: 'folio', label: 'Factura', align: 'left', mono: true }, { key: 'dias', label: 'Atraso', render: (f) => `${f.dias}d` }, { key: 'saldo', label: 'Saldo', render: (f) => $(f.saldo) }]} filas={b[abierto].slice(0, 3)} rowKey={(f, i) => i} />
      )}
    </Panel>
  );
}

// ── Pendientes activos + últimas minutas (resumen, sólo lectura)
export function PendientesMinutas({ d }) {
  const { theme } = useTheme();
  const [minuta, setMinuta] = useState(null);
  const pend = d.pendientes.filter((p) => p.estado !== 'completado').slice(0, 6);
  return (
    <Panel titulo="Pendientes y minutas" meta={`${pend.length} activos · ${d.minutas.length} minutas recientes`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          {pend.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted, padding: '6px 0' }}>Sin pendientes activos.</div>}
          {pend.map((p) => (
            <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo || p.descripcion}</div>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{[p.responsable, p.fecha_entrega ? `entrega ${fechaCorta(p.fecha_entrega)}` : null].filter(Boolean).join(' · ')}</div>
              </div>
              <Pill size="xs" tone={TONO_ESTADO[p.estado] || 'gray'}>{String(p.estado || 'pendiente').replace('_', ' ')}</Pill>
            </div>
          ))}
        </div>
        <div>
          {d.minutas.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted, padding: '6px 0' }}>Sin minutas registradas.</div>}
          {d.minutas.map((m) => (
            <div key={m.id} style={{ padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5 }}>
              <div onClick={() => setMinuta(minuta === m.id ? null : m.id)} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, cursor: 'pointer' }}>
                <span style={{ fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.titulo || `Reunión ${fecha(m.fecha_reunion)}`}</span>
                <span style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap' }}>{fechaCorta(m.fecha_reunion)} · {m.fuente === 'plaud' ? 'Plaud' : 'Manual'}</span>
              </div>
              {minuta === m.id && <div style={{ marginTop: 6, fontSize: 11, color: theme.textMuted, whiteSpace: 'pre-wrap', maxHeight: 180, overflow: 'auto', lineHeight: 1.5 }}>{m.contenido}</div>}
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── Marketing · próximas actividades + inversión del año
export function MarketingPanel({ r, anio, onNavegar }) {
  const { theme } = useTheme();
  const m = r.marketing;
  return (
    <Panel titulo="Marketing" meta={`${m.activas} activas · ${m.total} actividades ${anio} · inversión ${$c(m.inversion)}`} acciones={onNavegar && <Boton onClick={onNavegar}>Ver marketing</Boton>}>
      {m.proximas.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin actividades próximas ni activas.</div>}
      {m.proximas.map((a) => (
        <div key={a.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 10, alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.nombre}</div>
            <div style={{ fontSize: 10, color: theme.textMuted }}>{[a.tipo, a.fecha ? fecha(a.fecha) : a.mes ? MESES[Number(a.mes) - 1] : null, a.inversion ? $c(a.inversion) : null].filter(Boolean).join(' · ')}</div>
          </div>
          <Pill size="xs" tone={TONO_ESTADO[a.estatus] || 'gray'}>{a.estatus}</Pill>
        </div>
      ))}
    </Panel>
  );
}

// ── Secundario (plegado): proyección de cierre, brecha y sugerido de reposición
export function Secundario({ r, anio, mesActual }) {
  const { theme } = useTheme();
  const p = r.proyeccion, colP = p.pct == null ? theme.textMuted : p.pct >= 100 ? theme.green : p.pct >= 90 ? theme.orange : theme.red;
  const brechaMin = r.ytd - r.cuotaMinYtd, brechaIdeal = r.ytd - r.cuotaYtd;
  return (
    <Panel titulo="Proyección, brecha y reposición" meta={p.estacional ? `estacional: ${anio - 1} × ${p.growth != null ? signo((p.growth - 1) * 100) : '—'}` : 'ritmo mixto (40% YTD · 60% últimos 3 meses)'} plegable abiertoInicial={false}>
      <FilaStats>
        <Stat k="Cuota anual" v={$c(p.cuotaAnual)} />
        <Stat k={`Real YTD (al ${MESES[mesActual - 1]})`} v={$c(p.ytd)} sub={p.cuotaAnual > 0 ? `${Math.round((p.ytd / p.cuotaAnual) * 100)}% de la anual` : ''} />
        <Stat k="Proyección cierre" v={$c(p.proyAnual)} sub={p.pct != null ? `${Math.round(p.pct)}% de cuota anual` : ''} color={colP} />
        <Stat k="Brecha proyectada" v={`${p.brecha >= 0 ? '+' : ''}${$c(p.brecha)}`} sub={p.brecha < 0 && p.mesesRestantes ? `falta ${$c(p.ritmoNecesario)}/mes` : ''} color={p.brecha >= 0 ? theme.green : theme.red} />
      </FilaStats>
      <FilaStats>
        <Stat k="Brecha YTD vs mín" v={`${brechaMin >= 0 ? '+' : ''}${$c(brechaMin)}`} sub={`cuota mín YTD ${$c(r.cuotaMinYtd)}`} color={brechaMin >= 0 ? theme.green : theme.red} />
        <Stat k="Brecha YTD vs ideal" v={`${brechaIdeal >= 0 ? '+' : ''}${$c(brechaIdeal)}`} sub={`cuota ideal YTD ${$c(r.cuotaYtd)}`} color={brechaIdeal >= 0 ? theme.green : theme.red} />
        <Stat k="Sugerido reposición" v={$c(r.sugerido.monto)} sub={`${int(r.sugerido.piezas)} pzs en ${r.sugerido.skus} SKUs · rotación 3m × 3 − stock, topado a disponible Acteck`} color={r.sugerido.monto > 0 ? theme.accent : theme.textMuted} />
      </FilaStats>
    </Panel>
  );
}
