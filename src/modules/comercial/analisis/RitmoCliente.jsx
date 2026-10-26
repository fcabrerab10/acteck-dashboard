// Página del cliente · Resumen · «Ritmo de compra de este cliente» (3.96.0 · 2026-10-26, bloque 2 del mockup aprobado).
// 4 KpiCard sobre el diario del cliente (v_sellin_cliente_dia, ya lo baja useSellInDia para el zoom): compra cada N días,
// lleva sin comprar (con el estado de «A quién llamar hoy»), ticket por día de compra y el mes en curso a mismo día contra
// el anterior. Motor: ritmo.js#ritmoDeUnCliente (reusa ritmoCompra). Año que no es el actual → se calcula al último día
// con venta de ese año y se dice en el meta.
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { KpiCard, Skeleton } from '../../../components/kit';
import { useSellInDia } from './useAnalisisData';
import { ritmoDeUnCliente, ultimoDiaConVentaAnio, ESTADO_RITMO, fraseEstado } from './ritmo';
import { money, signo } from './formato';

const MES_CORTO = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (isoS) => { if (!isoS) return '—'; const d = new Date(`${isoS}T12:00:00`); return `${d.getDate()} ${MES_CORTO[d.getMonth()]}${d.getFullYear() !== new Date().getFullYear() ? ` ${d.getFullYear()}` : ''}`; };
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

export default function RitmoCliente({ cliente, anio }) {
  const { data: diario = [], isLoading } = useSellInDia(cliente.cliente, anio);
  const hoyReal = new Date();
  const esActual = anio === hoyReal.getFullYear();
  // Año cerrado: «hoy» = el último día con venta de ese año, para que «lleva» y «a mismo día» tengan sentido.
  const hoy = useMemo(() => (esActual ? hoyReal : ultimoDiaConVentaAnio(diario, anio) || new Date(anio, 11, 31, 12)), [esActual, diario, anio]); // eslint-disable-line react-hooks/exhaustive-deps
  const r = useMemo(() => ritmoDeUnCliente(diario, { cliente: cliente.cliente, hoy, nombre: cliente.nombre }), [diario, cliente, hoy]);
  const meta = esActual
    ? `${cap(r.mesLbl)} al día ${r.dia} contra ${r.mesPrevLbl} a mismo día · ritmo sobre los últimos 6 meses`
    : `${anio} ya cerró: calculado al ${hoy.getDate()} ${MES_CORTO[hoy.getMonth()]} ${anio}, último día con venta de ese año`;
  return <RitmoClienteVista r={r} meta={meta} cargando={isLoading} ocasional={cliente.ocasional} />;
}

/** Vista pura (SSR en scripts/test-pagina-cliente-ssr.mjs). */
export function RitmoClienteVista({ r, meta, cargando = false, ocasional = false }) {
  const { theme } = useTheme();
  const c = r?.ritmo || null;
  const tonoColor = { red: theme.red, orange: theme.orange, blue: theme.accent, green: theme.green, gray: theme.textMuted };
  const est = c ? ESTADO_RITMO[c.estado] : null;
  const titulo = (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '6px 0 2px', flexWrap: 'wrap' }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 700, color: theme.text, letterSpacing: '-0.01em' }}>Ritmo de compra de este cliente</span>
      <span style={{ fontSize: 11.5, color: theme.textMuted }}>{meta}</span>
    </div>
  );
  if (cargando) return <div>{titulo}<Skeleton lineas={3} /></div>;
  if (!c) {
    return (
      <div>{titulo}<div style={{ fontSize: 12, color: theme.textMuted, padding: '4px 2px' }}>Sin compras en los últimos 6 meses: no hay ritmo que medir.</div></div>
    );
  }
  const sinCadencia = c.cadencia == null;
  return (
    <div>
      {titulo}
      <div data-entrada-kpis style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Compra cada" badge={sinCadencia || ocasional ? { l: 'compra ocasional', tone: 'gray' } : undefined}
          big={sinCadencia ? 'ocasional' : `${c.cadencia} d`} bigSmall={sinCadencia ? `${c.compras} compra${c.compras === 1 ? '' : 's'} en 6 meses` : 'mediana entre compras'}
          sub={`${r.prevDias} día${r.prevDias === 1 ? '' : 's'} con compra en ${r.mesPrevLbl}`} />
        <KpiCard eyebrow="Lleva sin comprar" badge={{ l: est.label, tone: est.tone }} big={`${c.lleva} d`} bigColor={tonoColor[est.tone] || theme.text}
          bigSmall={fraseEstado(c)} sub={`última: ${fechaCorta(c.ultima)}, ${money(r.ultimaMonto)}`} />
        <KpiCard eyebrow="Ticket ⌀ por día de compra" big={money(c.ticket)} bigSmall={`${c.compras} días con compra`}
          sub={r.ticketPrev != null ? `ticket de ${r.mesPrevLbl}: ${money(r.ticketPrev)}` : `sin compras en ${r.mesPrevLbl}`} />
        <KpiCard eyebrow={`${cap(r.mesLbl)} a mismo día vs ${r.mesPrevLbl}`} big={c.vsPrev == null ? '—' : signo(c.vsPrev, 0)} bigColor={c.vsPrev == null ? undefined : c.vsPrev >= 0 ? theme.green : theme.red}
          bigSmall={c.vsPrev == null ? (c.prev > 0 ? '' : `en ${r.mesPrevLbl} nada a mismo día`) : ''}
          sub={`${money(c.cur)} · en ${r.mesPrevLbl} llevaba ${money(c.prev)} al día ${r.dia}`} />
      </div>
    </div>
  );
}
