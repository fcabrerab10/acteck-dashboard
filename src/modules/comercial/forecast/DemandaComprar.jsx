// S&OP web · «Demanda vs stock · 6 meses» y «Comprar ahora» (2026-11-18, congruencia web ↔ celular).
// Mismo motor que el celular (forecast/sopCalculo.js: serieDemanda · comprarAhora) alimentado con lo que ya bajó la
// pantalla (useForecastData: filas del motor + v_transito_sku). Sin consultas nuevas.
//   Demanda vs stock → por SKU, stock de hoy + lo que llega por ETA cubre la demanda mensual del motor; lo que no alcanza
//                      es «se queda corto». Se suma en piezas sobre el universo del S&OP.
//   Comprar ahora    → sugerido del motor, agotado → menos cobertura → más USD. «+ Solicitud» abre el mismo modal de
//                      cantidad que la tabla (AgregarLineaModal → borrador de solicitudes_compra); «Agregar todos» es el
//                      mismo botón de la barra de filtros.
import React, { useMemo, useState } from 'react';
import { estadoCobertura, PERFILES } from '../../../lib/cobertura.js';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, GraficaLineas, TablaCompacta, Pill, Boton } from '../../../components/kit';
import { serieDemanda, comprarAhora, llegadasDe, usdCompact } from './sopCalculo';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const pz = (n) => `${int(n)} pz`;

/** Meses en que el stock + lo que llega no cubre la demanda: «Ene 1,200 pz · Feb 300 pz». */
export function mesesCortos(serie = []) {
  return serie.filter((m) => m.falta > 0).map((m) => ({ key: m.key, label: m.label.split(' ')[0], falta: m.falta, pct: m.demanda > 0 ? Math.round((m.falta / m.demanda) * 100) : null }));
}

export function DemandaStockVista({ serie = [] }) {
  const { theme } = useTheme();
  const cortos = mesesCortos(serie);
  const datos = serie.map((m) => ({ x: m.label.split(' ')[0], demanda: m.demanda, tendremos: m.tendremos, falta: m.falta, llega: m.llega }));
  return (
    <Panel titulo="Demanda vs stock · 6 meses" meta="piezas · stock de hoy + lo que llega por ETA contra la demanda mensual del motor" padding="10px 12px">
      <GraficaLineas datos={datos} alto={210} formato={pz} mostrarMinMax={false}
        series={[
          { key: 'demanda', label: 'Demanda', tipo: 'principal' },
          { key: 'tendremos', label: 'Stock + llega', tipo: 'linea', color: theme.teal },
          { key: 'falta', label: 'Se queda corto', tipo: 'linea', color: theme.red, dash: '4 4' },
          { key: 'llega', label: 'Llega', tipo: 'lectura' },
        ]} />
      <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginTop: 8, fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.textMuted }}>
        {cortos.length === 0
          ? <Pill tone="green" size="xs">cubierto los {serie.length} meses</Pill>
          : <><span>Se queda corto en</span>{cortos.map((m) => <Pill key={m.key} tone={m.pct != null && m.pct >= 20 ? 'red' : 'orange'} size="xs" title={m.pct != null ? `${m.pct} % de la demanda del mes` : undefined}>{m.label} · {pz(m.falta)}</Pill>)}</>}
      </div>
    </Panel>
  );
}

export function ComprarAhoraVista({ comprar, sensible = false, puedeEditar = false, enSolicitud = new Set(), onAgregar, onAgregarTodos, onSku, agregando = false, top = 8 }) {
  const { theme } = useTheme();
  const [todos, setTodos] = useState(false);
  const filas = todos ? comprar.todos : comprar.todos.slice(0, top);
  const meta = comprar.total ? `${comprar.total} SKU${comprar.total === 1 ? '' : 's'} · ${pz(comprar.piezas)}${sensible && comprar.usd ? ` · ${usdCompact(comprar.usd)} USD` : ''} · los más urgentes primero` : 'sin sugerido a 3 meses';
  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', width: 104, render: (c) => (
      <button type="button" onClick={(e) => { e.stopPropagation(); onSku?.(c.sku); }} title={c.descripcion || c.sku}
        style={{ border: 0, background: 'transparent', padding: 0, cursor: onSku ? 'pointer' : 'default', color: theme.accent, fontFamily: '"SF Mono", ui-monospace, Menlo, monospace', fontSize: 11.5, fontWeight: 600 }}>{c.sku}</button>
    ) },
    { key: 'linea', label: 'Estado', align: 'left', maxWidth: 260, render: (c) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <Pill tone={{ agotado: 'red', critico: 'orange' }[estadoCobertura(c.dias, { critico: PERFILES.sop.critico }, { agotado: c.inv <= 0, soloNull: true })] || 'gray'} size="xs">{c.inv <= 0 ? 'agotado' : c.dias != null ? `${int(c.dias)} d` : 'sin ritmo'}</Pill>
        <span title={`${c.descripcion ? `${c.descripcion} · ` : ''}${c.linea}`} style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.linea.split(' · ').slice(1).join(' · ') || c.descripcion}</span>
      </span>
    ) },
    { key: 'piezas', label: 'Sugerido', width: 84, bold: true, render: (c) => pz(c.piezas) },
    ...(sensible ? [{ key: 'usd', label: 'USD', width: 70, render: (c) => (c.usd > 0 ? usdCompact(c.usd) : '—') }] : []),
    { key: 'accion', label: '', width: 104, align: 'right', render: (c) => (enSolicitud.has(c.sku)
      ? <Pill tone="green" size="xs">en solicitud</Pill>
      : <Boton icon={Plus} disabled={!puedeEditar} onClick={(e) => { e?.stopPropagation?.(); onAgregar?.(c.row); }} title={puedeEditar ? `Agregar ${c.sku} a la solicitud (puedes ajustar la cantidad)` : 'Tu perfil sólo consulta'}>Solicitud</Boton>) },
  ];
  return (
    <Panel titulo="Comprar ahora" meta={meta} padding="6px"
      acciones={puedeEditar && comprar.total > 0 ? <Boton primario icon={Plus} onClick={onAgregarTodos} disabled={agregando}>{agregando ? 'Agregando…' : 'Agregar todos'}</Boton> : null}>
      <TablaCompacta dense dividir={false} rowKey={(c) => c.sku} filas={filas} columnas={columnas} vacio="Ningún SKU del universo del S&OP tiene sugerido de compra a 3 meses." />
      {comprar.total > top && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
          <Boton onClick={() => setTodos((v) => !v)}>{todos ? `Ver sólo los ${top} más urgentes` : `Ver los ${comprar.total}`}</Boton>
        </div>
      )}
    </Panel>
  );
}

/** Los dos bloques lado a lado (se apilan en pantallas angostas). `rows` = filas del motor; `transito` = v_transito_sku. */
export default function DemandaComprar({ rows = [], transito = [], sensible = false, puedeEditar = false, enSolicitud, onAgregar, onAgregarTodos, onSku, agregando = false, hoy }) {
  const dia = useMemo(() => hoy || new Date(), [hoy]);
  const serie = useMemo(() => serieDemanda({ rows, llegadas: llegadasDe(transito), hoy: dia, meses: 6 }), [rows, transito, dia]);
  const comprar = useMemo(() => comprarAhora(rows), [rows]);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))', gap: 10, alignItems: 'start' }}>
      <DemandaStockVista serie={serie} />
      <ComprarAhoraVista comprar={comprar} sensible={sensible} puedeEditar={puedeEditar} enSolicitud={enSolicitud} onAgregar={onAgregar} onAgregarTodos={onAgregarTodos} onSku={onSku} agregando={agregando} />
    </div>
  );
}
