// Bloques (Panel) de Inicio · presentación pura sobre el resultado de calc.js. Sólo kit + theme/TYPO.
import React, { useMemo } from 'react';
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { moneyCompact as $c, money as $, int, pct, pp, fechaCorta, relativo } from '../../../lib/format';
import { Panel, TablaCompacta, Pill, Boton, toast } from '../../../components/kit';
import { useBandejaHoy, completarItem } from '../../agenda/datos';
import { FilaItem, FilaAviso } from '../../agenda/comun';
import { isoDia as isoDiaAgenda } from '../../agenda/calculo';
import { accionAlerta, ejecutarAccion, SEV_LABEL } from '../../../lib/alertas';
import { formatFrescura } from '../../../lib/frescura';
import { MESES, CLIENTE_NOMBRE, canalLabel, PAGINAS } from './config';

const signo = (v, d = 1) => (v == null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const toneDe = (v) => (v == null ? 'gray' : v >= 0 ? 'green' : 'red');
const toneCuota = (v) => (v == null ? 'gray' : v >= 100 ? 'green' : v >= 85 ? 'blue' : v >= 60 ? 'orange' : 'red');
const SEV_TONE = { critica: 'red', alta: 'orange', media: 'yellow', info: 'gray' };

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
const FilaStats = ({ children, style }) => <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', padding: '2px 2px 8px', ...style }}>{children}</div>;

// ── Ventas y margen · últimos 12 meses (Fact Neta + Contribución en barras, MC % en línea) + deducciones del periodo
export function GraficaVentas({ r, onNavegar }) {
  const { theme } = useTheme();
  const accent = theme.accent, orange = theme.orange;
  const tip = { fontSize: 11.5, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText };
  const ejeY = (v) => (v >= 1e6 ? `$${(v / 1e6).toFixed(0)}M` : `$${Math.round(v / 1e3)}K`);
  const c = r.cur, p = r.prev;
  const periodo = r.modo === 'mes' ? `${r.mesL} ${r.anio}` : `YTD ${r.anio}`;
  return (
    <Panel titulo="Ventas y margen" meta="últimos 12 meses · Fact Neta, Contribución y MC %" acciones={onNavegar && <Boton onClick={onNavegar}>Ver Visión General</Boton>}>
      <ResponsiveContainer width="100%" height={200}>
        <ComposedChart data={r.serie} margin={{ top: 6, right: 6, left: 0, bottom: 0 }} barGap={2}>
          <CartesianGrid vertical={false} stroke={theme.border} strokeDasharray="2 4" />
          <XAxis dataKey="label" tick={{ fontSize: 10, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} />
          <YAxis yAxisId="m" tickFormatter={ejeY} tick={{ fontSize: 9.5, fill: theme.textMuted }} axisLine={false} tickLine={false} width={40} />
          <YAxis yAxisId="p" orientation="right" hide domain={[0, 60]} />
          <Tooltip cursor={{ fill: theme.textMuted, fillOpacity: 0.06 }} contentStyle={tip} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} formatter={(v, n) => [n === 'MC %' ? pct(v) : $(v), n]} />
          <Bar yAxisId="m" dataKey="fn" name="Fact Neta" fill={accent} fillOpacity={0.35} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {r.serie.map((s) => <Cell key={s.key} fillOpacity={s.actual ? 0.55 : 0.3} />)}
          </Bar>
          <Bar yAxisId="m" dataKey="c" name="Contribución" fill={accent} radius={[4, 4, 0, 0]} maxBarSize={28} isAnimationActive={false}>
            {r.serie.map((s) => <Cell key={s.key} fillOpacity={s.actual ? 1 : 0.75} stroke={s.actual ? theme.text : 'none'} strokeWidth={s.actual ? 1 : 0} />)}
          </Bar>
          <Line yAxisId="p" type="monotone" dataKey="mc" name="MC %" stroke={orange} strokeWidth={1.8} dot={{ r: 2, strokeWidth: 0, fill: orange }} connectNulls isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
      <FilaStats style={{ padding: '10px 2px 0', borderTop: `1px solid ${theme.border}`, marginTop: 6 }}>
        <Stat k={`Deducciones · ${periodo}`} v={$c(c.lost)} sub={c.lostPct != null ? `${pct(c.lostPct)} de la bruta${p.lostPct != null ? ` · ${pp(c.lostPct - p.lostPct)} vs ${r.anio - 1}` : ''}` : ''} color={theme.red} />
        <Stat k="Devoluciones" v={$c(c.devoluciones)} sub={p.devoluciones ? `${r.anio - 1}: ${$c(p.devoluciones)}` : null} />
        <Stat k="RMA's" v={$c(c.rmas)} sub={p.rmas ? `${r.anio - 1}: ${$c(p.rmas)}` : null} />
        <Stat k="Bonificaciones" v={$c(c.bonificaciones)} sub={p.bonificaciones ? `${r.anio - 1}: ${$c(p.bonificaciones)}` : null} />
        <Stat k="Ticket promedio" v={c.ticket != null ? $(c.ticket) : '—'} sub={c.ticket != null ? `${int(c.piezas)} pzs netas` : 'sin unidades en el ERP'} />
      </FilaStats>
    </Panel>
  );
}

// Impacto en dinero / contexto de una alerta según su tipo y meta.
function impactoAlerta(a) {
  const m = a.meta || {};
  switch (a.tipo) {
    case 'rebate_por_generar':     return { monto: Number(a.valor) || null, txt: m.sell_in ? `sobre ${$c(m.sell_in)} de sell in` : null };
    case 'devoluciones_anormales': return { monto: m.devoluciones_rmas != null ? Number(m.devoluciones_rmas) : null, txt: m.ratio_pct != null ? `${pct(m.ratio_pct)} de la bruta · base ${pct(m.base_pct)}` : null };
    case 'stock_vs_transito':      return { monto: null, txt: [m.stock != null ? `${int(m.stock)} pzs` : null, m.cobertura_dias != null ? `${Math.round(m.cobertura_dias)}d cobertura` : null, m.po ? `PO ${m.po}${m.eta ? ` · ETA ${fechaCorta(m.eta)}` : ''}` : null].filter(Boolean).join(' · ') };
    case 'cuota_en_riesgo':        return { monto: m.faltante != null ? Number(m.faltante) : null, txt: m.pct != null ? `${pct(m.pct, 0)} de cuota` : null };
    default:                       return { monto: a.valor != null && Number(a.valor) > 1000 ? Number(a.valor) : null, txt: null };
  }
}

// ── Requiere decisión · alertas críticas y altas (máx 5) con impacto y acción directa
export function DecisionPanel({ r, onNavegar, onNotificaciones, max }) {
  const { theme } = useTheme();
  const lista = r.decision.slice(0, max), total = r.decision.length;
  const abrir = (a) => ejecutarAccion(a, onNavegar);
  // Botón de acción: la del cron (alertas.accion) si trae etiqueta propia; rebate → "Generar" en Pagos del cliente.
  const accionDe = (a) => {
    if (a.tipo === 'rebate_por_generar') return { label: 'Generar', run: () => onNavegar?.(a.cliente_key || 'dicotech', PAGINAS.pagosCliente) };
    const acc = a.accion && typeof a.accion === 'object' ? accionAlerta(a) : null;
    return acc?.label ? { label: acc.label, run: () => abrir(a) } : null;
  };
  return (
    <Panel titulo="Requiere decisión" meta={total ? `${total} crítica${total === 1 ? '' : 's'} y alta${total === 1 ? '' : 's'} activas` : 'sin alertas críticas ni altas'}
      acciones={onNotificaciones && <Boton onClick={onNotificaciones}>Notificaciones</Boton>}>
      {lista.length === 0 && <div style={{ fontSize: 11.5, color: theme.textMuted, padding: '4px 0' }}>Nada urgente. {r.alertas.length ? `${r.alertas.length} avisos de menor severidad en Notificaciones.` : ''}</div>}
      {lista.map((a) => {
        const imp = impactoAlerta(a), acc = accionDe(a);
        return (
          <div key={a.id} onClick={() => abrir(a)} style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0,1fr) auto auto', gap: 10, alignItems: 'center', padding: '6px 4px', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', borderRadius: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'transparent'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <Pill size="xs" tone={SEV_TONE[a.severidad] || 'gray'} dot>{SEV_LABEL[a.severidad] || a.severidad}</Pill>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</div>
              <div style={{ fontSize: 10.5, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {[a.cliente_key ? CLIENTE_NOMBRE[a.cliente_key] || a.cliente_key : null, imp.txt || a.detalle].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: a.severidad === 'critica' ? theme.red : theme.text, whiteSpace: 'nowrap', textAlign: 'right' }}>{imp.monto != null ? $c(imp.monto) : ''}</div>
            <div onClick={(e) => e.stopPropagation()}>{acc ? <Boton primario onClick={acc.run}>{acc.label}</Boton> : <span style={{ fontSize: 11, color: theme.textMuted }}>›</span>}</div>
          </div>
        );
      })}
      {r.alertas.length > lista.length && onNotificaciones && (
        <div onClick={onNotificaciones} style={{ paddingTop: 8, fontSize: 11.5, fontWeight: 500, color: theme.accent, cursor: 'pointer' }}>
          Ver las {r.alertas.length} en Notificaciones ›
        </div>
      )}
    </Panel>
  );
}

// ── Tarjetas por cliente · % cuota del periodo, MC, sell-out último mes cerrado y alerta más severa
export function ClientesGrid({ r, onNavegar }) {
  const { theme } = useTheme();
  const periodo = r.modo === 'mes' ? r.mesL : `YTD ${r.anio}`;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 8 }}>
      {r.clientes.map((c) => {
        const col = c.pct == null ? theme.textMuted : c.pct >= 100 ? theme.green : c.pct >= 85 ? theme.text : theme.orange;
        return (
          <div key={c.key} onClick={onNavegar ? () => onNavegar(c.key, PAGINAS.homeCliente) : undefined}
            style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px', cursor: onNavegar ? 'pointer' : 'default', minWidth: 0, fontFamily: TYPO.fontText }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{c.nombre}</span>
              {c.alerta
                ? <Pill size="xs" tone={SEV_TONE[c.alerta.severidad] || 'gray'} dot title={c.alerta.titulo}>{c.nAlertas > 1 ? `${c.nAlertas} alertas · ${SEV_LABEL[c.alerta.severidad]}` : SEV_LABEL[c.alerta.severidad]}</Pill>
                : <Pill size="xs" tone="green">sin alertas</Pill>}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{$c(c.fact)}</span>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>{c.pct != null ? `${Math.round(c.pct)}% cuota` : 'sin cuota'}</span>
            </div>
            <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
              {periodo}{c.cuota ? ` · de ${$c(c.cuota)}` : ''}{c.yoy != null ? ` · ${signo(c.yoy, 0)} ${r.yoyLabel}` : ''}
            </div>
            <div style={{ marginTop: 8, height: 3, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, c.pct ?? 0))}%`, background: col, borderRadius: 999 }} />
            </div>
            <div style={{ display: 'flex', gap: 14, marginTop: 10 }}>
              <Stat k="MC" v={c.mc != null ? pct(c.mc) : '—'} sub={c.dMc != null ? `${pp(c.dMc)} YoY` : null} color={c.mc == null ? theme.textMuted : c.dMc == null || c.dMc >= 0 ? theme.text : theme.orange} />
              <Stat k={c.sellout ? `Sell Out · ${MESES[c.sellout.mes - 1]}` : 'Sell Out'} v={c.sellout ? $c(c.sellout.monto) : '—'} sub={c.sellout?.yoy != null ? `${signo(c.sellout.yoy, 0)} YoY` : 'sin mes cerrado'} color={c.sellout?.yoy == null ? undefined : c.sellout.yoy >= 0 ? theme.green : theme.red} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Canales · Fact Neta del periodo vs cuota (cuotas_canales) y MC por canal
export function CanalesPanel({ r, onNavegar }) {
  const { theme } = useTheme();
  const periodo = r.modo === 'mes' ? `${r.mesL} ${r.anio}` : `YTD ${r.anio}`;
  const hayCuota = r.canales.some((c) => c.cuota != null);
  const cols = [
    { key: 'canal', label: 'Canal', align: 'left', render: (c) => canalLabel(c.canal) },
    { key: 'fact', label: 'Fact Neta', bold: true, render: (c) => $c(c.fact) },
    { key: 'share', label: '% total', render: (c) => (r.totalCanales ? pct((c.fact / r.totalCanales) * 100, 0) : '—') },
    ...(hayCuota ? [{ key: 'cuota', label: 'Cuota', render: (c) => (c.cuota != null ? $c(c.cuota) : '—') }] : []),
    { key: 'pct', label: hayCuota ? '% cuota' : r.yoyLabel, render: (c) => (hayCuota
      ? <Pill tone={toneCuota(c.pct)}>{c.pct != null ? `${Math.round(c.pct)}%` : '—'}</Pill>
      : <Pill tone={toneDe(c.yoy)}>{signo(c.yoy, 0)}</Pill>) },
    ...(hayCuota ? [{ key: 'yoy', label: r.yoyLabel, render: (c) => <span style={{ color: c.yoy == null ? theme.textMuted : c.yoy >= 0 ? theme.green : theme.red }}>{signo(c.yoy, 0)}</span> }] : []),
    { key: 'mc', label: 'MC', render: (c) => <Pill tone={c.mc == null ? 'gray' : c.margenObjetivo != null ? (c.mc >= c.margenObjetivo ? 'green' : 'orange') : c.mc >= 30 ? 'green' : c.mc >= 20 ? 'blue' : 'orange'}>{c.mc != null ? pct(c.mc) : '—'}</Pill> },
    { key: 'dMc', label: 'Δ MC', render: (c) => <span style={{ color: c.dMc == null ? theme.textMuted : c.dMc >= 0 ? theme.green : theme.red }}>{c.dMc != null ? pp(c.dMc) : '—'}</span> },
  ];
  return (
    <Panel titulo={`Canales · ${periodo} vs cuota`} meta={hayCuota ? (r.modo === 'mes' ? 'cuota anual ÷ 12' : `cuota anual × ${r.mesActual}/12`) : 'sin cuotas por canal cargadas · se muestra YoY'} acciones={onNavegar && <Boton onClick={onNavegar}>Ver Sell In</Boton>}>
      <TablaCompacta columnas={cols} filas={r.canales} rowKey={(c) => c.canal} dense vacio="Sin ventas por canal en este periodo." />
    </Panel>
  );
}

// ── Próximos 7 días (pagos, arribos, marketing, eventos) + últimos cambios (auditoría, última carga ERP)
export function AgendaPanel({ r, frescuraErp, onNavegar }) {
  const { theme } = useTheme();
  const total = r.agenda.reduce((s, i) => s + (i.tipo === 'Pago' ? i.monto : 0), 0);
  return (
    <Panel titulo="Próximos 7 días y últimos cambios" meta={`${r.agenda.length} evento${r.agenda.length === 1 ? '' : 's'}${total ? ` · ${$c(total)} en pagos` : ''}`}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
        <div>
          {r.agenda.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted, padding: '6px 0' }}>Sin pagos, arribos ni actividades en los próximos 7 días.</div>}
          {r.agenda.slice(0, 8).map((i) => (
            <div key={i.id} onClick={onNavegar && i.pagina ? () => onNavegar(i.clienteKey ?? null, i.pagina) : undefined}
              style={{ display: 'grid', gridTemplateColumns: '44px auto minmax(0,1fr) auto', gap: 8, alignItems: 'center', padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5, cursor: onNavegar && i.pagina ? 'pointer' : 'default' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{fechaCorta(i.fecha)}</span>
              <Pill size="xs" tone={i.tone}>{i.tipo}</Pill>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.titulo}</div>
                {i.sub && <div style={{ fontSize: 10, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.sub}</div>}
              </div>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{i.monto ? $c(i.monto) : ''}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5 }}>
            <span style={{ fontWeight: 500, color: theme.text }}>Última carga del ERP</span>
            <span style={{ fontSize: 10.5, color: frescuraErp?.estado === 'atrasada' ? theme.orange : theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              {frescuraErp?.ultima_carga ? `${formatFrescura(frescuraErp.ultima_carga)}${frescuraErp.periodo_max ? ` · hasta ${frescuraErp.periodo_max}` : ''}` : 'sin registro'}
            </span>
          </div>
          {r.auditoria.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted, padding: '6px 0' }}>Sin cambios recientes registrados.</div>}
          {r.auditoria.map((a) => (
            <div key={a.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8, padding: '5px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {String(a.operacion || '').toLowerCase() === 'insert' ? 'Alta' : String(a.operacion || '').toLowerCase() === 'delete' ? 'Baja' : 'Cambio'} en {String(a.tabla || '').replace(/_/g, ' ')}
                  {a.cambios?.nombre || a.cambios?.concepto || a.cambios?.titulo ? ` · ${a.cambios.nombre || a.cambios.concepto || a.cambios.titulo}` : ''}
                </div>
                <div style={{ fontSize: 10, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{[a.cliente_key ? CLIENTE_NOMBRE[a.cliente_key] || a.cliente_key : null, a.usuario_email].filter(Boolean).join(' · ')}</div>
              </div>
              <span style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap' }}>{relativo(a.creado_at)}</span>
            </div>
          ))}
        </div>
      </div>
    </Panel>
  );
}

// ── "Hoy" (Agenda V3) · bandeja compacta arriba de las cifras: máx. MAX ítems (vencidas → hoy → avisos) + "Ver Agenda".
// Comparte useBandejaHoy (modo ligero: sin tracking ni /api/status) con la pestaña Agenda. Se oculta si no hay nada.
export function HoyPanel({ onNavegar, max = 6 }) {
  const { theme } = useTheme();
  const { bandeja: b, avisos, personasPorId, porId, hoy, cargando } = useBandejaHoy({ ligero: true });
  const hoyIso = isoDiaAgenda(hoy);
  const filas = useMemo(() => {
    const out = [];
    for (const it of b.vencidas) out.push({ k: `i:${it.id}`, item: it });
    for (const it of b.hoy) out.push({ k: `i:${it.id}`, item: it });
    for (const a of avisos.filter((x) => x.fecha === hoyIso || x.severidad === 'critica' || x.severidad === 'alta')) out.push({ k: a.id, aviso: a });
    return out;
  }, [b, avisos, hoyIso]);
  if (cargando || !filas.length) return null;
  const ir = () => onNavegar?.(null, 'agenda');
  const toggle = async (item, hecha) => { try { await completarItem(item, hecha); } catch (e) { toast.error(e.message); } };
  return (
    <Panel titulo="Hoy" meta={`${b.vencidas.length ? `${b.vencidas.length} vencida${b.vencidas.length === 1 ? '' : 's'} · ` : ''}${b.hoy.length} para hoy · ${avisos.length} aviso${avisos.length === 1 ? '' : 's'} del sistema`} padding="0"
      acciones={<Boton onClick={ir}>Ver Agenda</Boton>}>
      {filas.slice(0, max).map((f) => f.item
        ? <FilaItem key={f.k} item={f.item} personasPorId={personasPorId} porId={porId} hoy={hoy} onToggle={toggle} onAbrir={ir} compacta />
        : <FilaAviso key={f.k} aviso={f.aviso} onNavegar={onNavegar} hoy={hoy} compacta />)}
      {filas.length > max && <div onClick={ir} style={{ padding: '6px 12px', fontSize: 11, color: theme.accent, cursor: 'pointer' }}>+{filas.length - max} más en la Agenda</div>}
    </Panel>
  );
}
