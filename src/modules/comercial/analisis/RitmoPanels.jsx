// Análisis por cliente · «Quién se mueve» y «A quién llamar hoy» (2026-10-08; sustituyen al Pareto y al Comparador por
// decisión de Fernando: «a mí sólo me gustaron el 3 y el 4»). Una sola consulta chica (v_sellin_cliente_dia, 6 meses).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, TablaCompacta, Pill, Skeleton } from '../../../components/kit';
import { quienSeMueve, ritmoCompra, ESTADO_RITMO, fraseEstado, fmtM } from './ritmo';
import { money, signo } from './formato';

const fechaCorta = (isoS) => { if (!isoS) return '—'; const d = new Date(`${isoS}T12:00:00`); return `${d.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`; };

function Lista({ titulo, pill, tone, items, vacio, onAbrir, valor }) {
  const { theme } = useTheme();
  return (
    <Panel titulo={titulo} meta={<Pill size="xs" tone={tone}>{items.length}</Pill>}>
      {items.length === 0 && <div style={{ fontSize: 11.5, color: theme.textMuted }}>{vacio}</div>}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {items.map((c) => (
          <div key={c.cliente} onClick={() => onAbrir?.(c.cliente)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderTop: `1px solid ${theme.border}`, cursor: onAbrir ? 'pointer' : 'default', fontSize: 12.5 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.nombre}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.frase}</div>
            </div>
            {valor(c)}
          </div>
        ))}
      </div>
    </Panel>
  );
}

/** Quién se mueve: suben · bajan (vs el mes anterior a mismo día) · compraron el mes pasado y este no. */
export function QuienSeMuevePanel({ diario, cargando, nombres, hoy, onAbrir }) {
  const { theme } = useTheme();
  const m = useMemo(() => quienSeMueve(diario || [], { hoy, nombres }), [diario, hoy, nombres]);
  const r = useMemo(() => ritmoCompra(diario || [], { hoy, nombres }), [diario, hoy, nombres]);
  const ritmoDe = new Map(r.lista.map((c) => [c.cliente, c]));
  if (cargando) return <Panel titulo="Quién se mueve"><Skeleton lineas={4} /></Panel>;
  const sin = m.sinComprar.map((c) => { const rc = ritmoDe.get(c.cliente); return { ...c, frase: rc?.cadencia ? `compra cada ${rc.cadencia} d · lleva ${rc.lleva}` : `en ${m.mesPrevLbl} ${fmtM(c.prevTotal)}`, estado: rc?.estado || 'ocasional', atraso: rc?.atraso || 0 }; }).sort((a, b) => b.atraso - a.atraso);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 6px' }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 700, color: theme.text, letterSpacing: '-0.01em' }}>Quién se mueve</span>
        <span style={{ fontSize: 11.5, color: theme.textMuted }}>{m.mesLbl} al día {m.dia} contra {m.mesPrevLbl} a mismo día · {m.total} clientes</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 10 }}>
        <Lista titulo="Suben" tone="green" items={m.suben} vacio="Nadie sube más de $50K todavía." onAbrir={onAbrir} valor={(c) => <span style={{ color: theme.green, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>+{fmtM(c.delta)}</span>} />
        <Lista titulo="Bajan" tone="red" items={m.bajan} vacio="Nadie baja más de $50K." onAbrir={onAbrir} valor={(c) => <span style={{ color: theme.red, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{fmtM(c.delta)}</span>} />
        <Lista titulo={`Compraron en ${m.mesPrevLbl} y en ${m.mesLbl} no`} tone="orange" items={sin.slice(0, 8)} vacio={`Todos los de ${m.mesPrevLbl} ya compraron.`} onAbrir={onAbrir}
          valor={(c) => <Pill size="xs" tone={ESTADO_RITMO[c.estado]?.tone || 'gray'}>{c.estado === 'atrasado' ? `atrasado ${c.atraso} d` : c.estado === 'leToca' ? 'le toca' : 'en tiempo'}</Pill>} />
      </div>
      {sin.length > 8 && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>Y {sin.length - 8} más en la lista de llamadas de abajo.</div>}
    </div>
  );
}

/** A quién llamar hoy: cadencia · lleva · última · ticket · este mes vs anterior · estado. */
export function LlamarHoyPanel({ diario, cargando, nombres, hoy, onAbrir }) {
  const { theme } = useTheme();
  const r = useMemo(() => ritmoCompra(diario || [], { hoy, nombres }), [diario, hoy, nombres]);
  const c = r.conteo;
  const meta = `${c.atrasado || 0} atrasados · ${c.leToca || 0} les toca · ${c.enfriado || 0} se enfriaron · ${c.alRitmo || 0} al ritmo · ${c.ocasional || 0} ocasionales`;
  const cols = [
    { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 240, render: (x) => <b>{x.nombre}</b> },
    { key: 'cadencia', label: 'Compra cada', width: 90, sort: true, render: (x) => (x.cadencia ? `${x.cadencia} d` : '—') },
    { key: 'lleva', label: 'Lleva', width: 70, sort: true, render: (x) => <span style={{ color: x.estado === 'atrasado' ? theme.red : x.estado === 'leToca' ? theme.accent : theme.text, fontWeight: x.estado === 'atrasado' || x.estado === 'leToca' ? 700 : 400 }}>{x.lleva} d</span> },
    { key: 'ultima', label: 'Última compra', width: 100, sort: true, render: (x) => fechaCorta(x.ultima) },
    { key: 'ticket', label: 'Ticket ⌀', width: 90, sort: true, render: (x) => money(x.ticket) },
    { key: 'vsPrev', label: 'Este mes vs anterior', width: 120, sort: true, render: (x) => (x.vsPrev == null ? '—' : <span style={{ color: x.vsPrev >= 0 ? theme.green : theme.red }}>{signo(x.vsPrev, 0)}</span>) },
    { key: 'estado', label: 'Estado', align: 'left', width: 150, render: (x) => <Pill size="xs" tone={ESTADO_RITMO[x.estado].tone}>{fraseEstado(x)}</Pill> },
  ];
  return (
    <Panel titulo="A quién llamar hoy" meta={cargando ? 'calculando…' : meta} plegable abiertoInicial>
      {cargando ? <Skeleton lineas={5} /> : <>
        <TablaCompacta dense columnas={cols} filas={r.lista} rowKey={(x) => x.cliente} maxHeight={460} onRowClick={onAbrir ? (x) => onAbrir(x.cliente) : undefined} vacio="Sin compras en los últimos 6 meses." />
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 6 }}>«Compra cada» = mediana de los días entre compras en los últimos 6 meses; atrasado = lleva más de 1.5 veces su ritmo. Ordenada por atraso: los de arriba son las llamadas de hoy.</div>
      </>}
    </Panel>
  );
}
