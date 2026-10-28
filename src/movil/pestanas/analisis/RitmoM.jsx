// Ritmo de compra en el celular (3.97.0 · 2026-10-28): las versiones móviles de lo último que entró en la web.
//   · QuienSeMueveM / LlamarHoyM → debajo de la lista de Análisis por cliente (web: analisis/RitmoPanels.jsx).
//   · RitmoClienteM → Resumen de la ficha del cliente, 4 KpiM (web: analisis/RitmoCliente.jsx).
//   · SucursalesMovimientoM → Sell Out de la cuenta, sólo si la receta trae sucursales (web: sellout/SucursalesMovimientoPanel.jsx).
// Nada de lógica propia: los motores son analisis/ritmo.js y sellout/sucursales.js. Sell in en pesos (fact. neta), nunca
// margen ni costo; sell out y sucursales no son sensibles. Todas las vistas son puras (SSR en test-analisis-movil-ssr.mjs).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Vacio, Pill, TituloSeccionM } from '../../piezas';
import { moneyCompact, deltaPct } from '../../util';
import { quienSeMueve, ritmoCompra, ESTADO_RITMO, fraseEstado, fmtM } from '../../../modules/comercial/analisis/ritmo';
import { movimientoSucursales, fmtMovSuc } from '../../../modules/comercial/sellout/sucursales';

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (isoS) => { if (!isoS) return '—'; const d = new Date(`${isoS}T12:00:00`); return `${d.getDate()} ${MES_CORTO[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`; };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);
const seg = { margin: '18px 0 0', padding: '0 28px 6px' };
const tonoEstado = (theme, tone) => ({ red: theme.red, orange: theme.orange, blue: theme.accent, green: theme.green, gray: theme.textMuted }[tone] || theme.text);

/** Lista corta (suben · bajan · sin comprar) con el valor a la derecha. `valor(c)` devuelve un nodo. */
function ListaCorta({ titulo, meta, items, vacio, onAbrir, valor, pie }) {
  return (
    <ListaAgrupada titulo={titulo} meta={meta} style={{ marginTop: 14 }} pie={pie}>
      {items.length === 0 && <div style={{ padding: '12px 14px', fontSize: 12.5, opacity: 0.7, fontFamily: TYPO.fontText }}>{vacio}</div>}
      {items.map((c) => <Fila key={c.cliente} titulo={c.nombre} sub={c.frase} chevron={false} onClick={onAbrir ? () => onAbrir(c.cliente) : undefined} trailing={valor(c)} />)}
    </ListaAgrupada>
  );
}

/** Quién se mueve: suben · bajan (vs el mes anterior a mismo día) · compraron el mes pasado y este no. */
export function QuienSeMueveM({ diario = [], cargando = false, nombres = new Map(), solo = null, hoy = new Date(), onAbrir }) {
  const { theme } = useTheme();
  const m = useMemo(() => quienSeMueve(diario, { hoy, nombres, solo }), [diario, hoy, nombres, solo]);
  const r = useMemo(() => ritmoCompra(diario, { hoy, nombres, solo }), [diario, hoy, nombres, solo]);
  const sin = useMemo(() => {
    const ritmoDe = new Map(r.lista.map((c) => [c.cliente, c]));
    return m.sinComprar.map((c) => { const rc = ritmoDe.get(c.cliente); return { ...c, frase: rc?.cadencia ? `compra cada ${rc.cadencia} d · lleva ${rc.lleva}` : `en ${m.mesPrevLbl} ${fmtM(c.prevTotal)}`, estado: rc?.estado || 'ocasional', atraso: rc?.atraso || 0 }; }).sort((a, b) => b.atraso - a.atraso);
  }, [m, r]);
  const num = (color, mas) => (c) => <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{mas && c.delta > 0 ? '+' : ''}{fmtM(c.delta)}</span>;
  return (
    <>
      <TituloSeccionM style={seg} meta={`${m.mesLbl} al día ${m.dia} vs ${m.mesPrevLbl} a mismo día`}>Quién se mueve</TituloSeccionM>
      {cargando ? <div style={{ padding: '0 16px' }}><Skeleton h={140} r={12} /></div> : (
        <>
          <ListaCorta titulo="Suben" meta={String(m.suben.length)} items={m.suben} vacio="Nadie sube más de $50K todavía." onAbrir={onAbrir} valor={num(theme.green, true)} />
          <ListaCorta titulo="Bajan" meta={String(m.bajan.length)} items={m.bajan} vacio="Nadie baja más de $50K." onAbrir={onAbrir} valor={num(theme.red)} />
          <ListaCorta titulo={`Compraron en ${m.mesPrevLbl} y en ${m.mesLbl} no`} meta={String(sin.length)} items={sin.slice(0, 8)} vacio={`Todos los de ${m.mesPrevLbl} ya compraron.`} onAbrir={onAbrir}
            valor={(c) => <Pill size="xs" tone={ESTADO_RITMO[c.estado]?.tone || 'gray'}>{c.estado === 'atrasado' ? `atrasado ${c.atraso} d` : c.estado === 'leToca' ? 'le toca' : 'en tiempo'}</Pill>}
            pie={sin.length > 8 ? `Y ${sin.length - 8} más en «A quién llamar hoy».` : `Sólo clientes recurrentes · umbral $50K · ${m.total} clientes.`} />
        </>
      )}
    </>
  );
}

/** A quién llamar hoy: compra cada N d · lleva · estado; primero atrasados y «le toca»; «Mostrar más». */
export function LlamarHoyM({ diario = [], cargando = false, nombres = new Map(), solo = null, hoy = new Date(), onAbrir, inicial = 8 }) {
  const { theme } = useTheme();
  const [n, setN] = useState(inicial);
  const r = useMemo(() => ritmoCompra(diario, { hoy, nombres, solo }), [diario, hoy, nombres, solo]);
  const c = r.conteo;
  const urgentes = (c.atrasado || 0) + (c.leToca || 0);
  const meta = `${c.atrasado || 0} atrasados · ${c.leToca || 0} les toca · ${c.enfriado || 0} se enfriaron`;
  const visibles = r.lista.slice(0, n);
  return (
    <>
      <TituloSeccionM style={seg} meta={cargando ? 'calculando…' : meta}>A quién llamar hoy</TituloSeccionM>
      {cargando ? <div style={{ padding: '0 16px' }}><Skeleton h={200} r={12} /></div> : (
        <ListaAgrupada style={{ marginTop: 0 }} pie={<>Sólo clientes recurrentes. <strong>Compra cada</strong> = mediana de los días entre compras en 6 meses; atrasado = lleva más de 1.5 veces su ritmo; «dejó de comprar» = más de 45 días. Los de arriba son las llamadas de hoy{urgentes ? ` (${urgentes})` : ''}.</>}>
          {!r.lista.length && <Vacio icon={null} titulo="Sin compras en los últimos 6 meses" style={{ padding: 16 }} />}
          {visibles.map((x) => {
            const est = ESTADO_RITMO[x.estado] || ESTADO_RITMO.ocasional;
            const col = tonoEstado(theme, est.tone);
            return (
              <Fila key={x.cliente} titulo={x.nombre} chevron={false} onClick={onAbrir ? () => onAbrir(x.cliente) : undefined}
                sub={<span>{x.cadencia ? `compra cada ${x.cadencia} d` : `${x.compras} compra${x.compras === 1 ? '' : 's'} en 6 m`} · última {fechaCorta(x.ultima)} · ticket {moneyCompact(x.ticket)}{x.vsPrev != null ? <> · <span style={{ color: x.vsPrev >= 0 ? theme.green : theme.red }}>{deltaPct(x.vsPrev)}</span> vs mes ant.</> : ''}</span>}
                trailing={<span style={{ textAlign: 'right', flexShrink: 0 }}><span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>lleva {x.lleva} d</span><span style={{ display: 'block', fontSize: 11, color: col }}>{fraseEstado(x)}</span></span>} />
            );
          })}
          {r.lista.length > n && (
            <button type="button" onClick={() => setN((v) => v + 12)} style={{ width: '100%', border: 0, background: 'transparent', padding: '12px 14px', fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.accent, cursor: 'pointer', minHeight: 44 }}>
              Mostrar más · {r.lista.length - n} restantes
            </button>
          )}
        </ListaAgrupada>
      )}
    </>
  );
}

/** Ritmo de compra de UN cliente: 4 KpiM sobre ritmo.js#ritmoDeUnCliente. `r` ya calculado (hook en la ficha). */
export function RitmoClienteM({ r, cargando = false }) {
  const { theme } = useTheme();
  const c = r?.ritmo || null;
  const titulo = <TituloSeccionM style={seg} meta={r ? `${r.mesLbl} al día ${r.dia} vs ${r.mesPrevLbl} · 6 meses` : undefined}>Ritmo de compra</TituloSeccionM>;
  if (cargando) return <>{titulo}<div style={{ padding: '0 16px' }}><Skeleton h={180} r={12} /></div></>;
  if (!c) return <>{titulo}<div style={{ padding: '0 28px', fontSize: 12.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>Sin compras en los últimos 6 meses: no hay ritmo que medir.</div></>;
  const est = ESTADO_RITMO[c.estado] || ESTADO_RITMO.ocasional;
  const sinCadencia = c.cadencia == null;
  return (
    <>
      {titulo}
      <KpiGrid data-entrada-kpis>
        <KpiM eyebrow="Compra cada" big={sinCadencia ? 'ocasional' : `${c.cadencia} d`} pill={sinCadencia ? { tone: 'gray', label: `${c.compras} compras` } : undefined}
          sub={`${r.prevDias} día${r.prevDias === 1 ? '' : 's'} con compra en ${r.mesPrevLbl}`} />
        <KpiM eyebrow="Lleva sin comprar" big={`${c.lleva} d`} bigColor={tonoEstado(theme, est.tone)} pill={{ tone: est.tone, label: fraseEstado(c) }}
          sub={`última ${fechaCorta(c.ultima)} · ${moneyCompact(r.ultimaMonto)}`} />
        <KpiM eyebrow="Ticket ⌀ por día" big={moneyCompact(c.ticket)} sub={r.ticketPrev != null ? `${c.compras} días con compra · ${r.mesPrevLbl} ${moneyCompact(r.ticketPrev)}` : `${c.compras} días con compra · nada en ${r.mesPrevLbl}`} />
        <KpiM eyebrow={`${cap(r.mesLbl)} vs ${r.mesPrevLbl} · mismo día`} big={c.vsPrev == null ? '—' : deltaPct(c.vsPrev)} bigColor={c.vsPrev == null ? undefined : c.vsPrev >= 0 ? theme.green : theme.red}
          sub={`${moneyCompact(c.cur)} · en ${r.mesPrevLbl} llevaba ${moneyCompact(c.prev)}`} />
      </KpiGrid>
    </>
  );
}

/** Sucursales que suben, bajan y dejaron de vender (sell out de la cuenta, mes vs mes anterior). */
export function SucursalesMovimientoM({ suc = [], anio, mes, cargando = false }) {
  const { theme } = useTheme();
  const m = useMemo(() => movimientoSucursales(suc, { anio, mes }), [suc, anio, mes]);
  const num = (color) => (s) => <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{s.delta >= 0 ? '+' : ''}{fmtMovSuc(s.delta)}</span>;
  const lista = (titulo, items, vacio, valor) => (
    <ListaAgrupada titulo={titulo} meta={String(items.length)} style={{ marginTop: 14 }}>
      {items.length === 0 && <div style={{ padding: '12px 14px', fontSize: 12.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>{vacio}</div>}
      {items.map((s) => <Fila key={s.sucursal} titulo={s.sucursal} sub={s.frase} chevron={false} trailing={valor(s)} />)}
    </ListaAgrupada>
  );
  return (
    <>
      <TituloSeccionM style={seg} meta={`${m.mesLbl} vs ${m.mesPrevLbl} · ${m.total} con venta`}>Sucursales que suben, bajan y dejaron de vender</TituloSeccionM>
      {cargando ? <div style={{ padding: '0 16px' }}><Skeleton h={140} r={12} /></div> : (
        <>
          {lista('Suben', m.suben, `Ninguna sube más de $50K en ${m.mesLbl}.`, num(theme.green))}
          {lista('Bajan', m.bajan, `Ninguna baja más de $50K en ${m.mesLbl}.`, num(theme.red))}
          {lista(`Sin venta en ${m.mesLbl}`, m.sinVenta, `Todas las de ${m.mesPrevLbl} siguen vendiendo.`, () => <Pill size="xs" tone="orange">dejó de vender</Pill>)}
          <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 28px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>En pesos contra el mes anterior, umbral $50K, top 5. «Vendía $X/mes» = promedio de los 3 meses anteriores.</div>
        </>
      )}
    </>
  );
}
