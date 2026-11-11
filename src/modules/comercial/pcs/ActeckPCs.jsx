// Acteck PCs (2026-11-11) · gestión del proyecto de computadoras ensambladas con GRUPO DECME.
// UNA sola pantalla para la computadora y el celular (`movil` sólo cambia tablas por listas y los márgenes):
// así una mejora nunca queda en un solo lado. Hero → 4 cifras → pedidos por etapa → modelos → dinero y componentes.
// Costo, margen y utilidad sólo con `puedeVerSensible`.
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerSensible } from '../../../lib/permisos';
import { money, moneyCompact, int, pct, fechaCorta, hoyISO } from '../../../lib/format.js';
import { Hero, KpiCard, Panel, Pill, Segmented, TablaCompacta, Boton, Cargando } from '../../../components/kit';
import { usePcs } from './datos';
import { pedidos as armarPedidos, resumen as armarResumen, frase, filasModelos, capacidad, ETAPAS, TARIMA } from './calculo.js';
import HojaPedido from './HojaPedido';
import HojaModelo from './HojaModelo';

const TONO_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.tone]));
const LABEL_ETAPA = Object.fromEntries(ETAPAS.map((e) => [e.id, e.label]));

function PillEtapa({ p }) {
  if (p.etapa === 'cancelada') return <Pill tone="gray">Cancelado</Pill>;
  if (p.cobroVencido) return <Pill tone="red">Vencido {p.cobroVencido} d</Pill>;
  return <Pill tone={p.entregaTarde ? 'red' : TONO_ETAPA[p.etapa]}>{LABEL_ETAPA[p.etapa]}{p.entregaTarde ? ' · tarde' : ''}</Pill>;
}

const modelosDe = (p) => p.lineas.map((l) => l.sku_modelo).join(' · ') || '—';
const cobroDe = (p) => (p.etapa === 'cobrada' ? `pagó ${fechaCorta(p.cobrado_at)}` : p.etapa === 'facturada' && p.factura_cliente_vence ? `vence ${fechaCorta(p.factura_cliente_vence)}` : '—');

/** Vista pura (sin red): la usan la pantalla y las pruebas SSR. */
export function ActeckPcsVista({ datos, hoy, sensible = false, movil = false, onPedido, onModelo, onNuevo }) {
  const { theme } = useTheme();
  const [filtro, setFiltro] = useState('abiertos');
  const [etapa, setEtapa] = useState(null);
  const peds = useMemo(() => armarPedidos(datos, hoy), [datos, hoy]);
  const r = useMemo(() => armarResumen(peds, hoy), [peds, hoy]);
  const modelos = useMemo(() => filasModelos(datos, peds, hoy), [datos, peds, hoy]);
  const comps = useMemo(() => capacidad(datos, peds), [datos, peds]);
  const lista = peds.filter((p) => (etapa ? p.etapa === etapa : filtro === 'todos' ? true : !['cobrada', 'cancelada'].includes(p.etapa)));
  const facturadoErp = (datos.ventas || []).reduce((s, v) => s + (Number(v.monto) || 0), 0);
  const pad = movil ? '0 16px' : 0;
  const sub = [r.siguiente ? `Siguiente entrega: ${r.siguiente.equipos} equipos a ${r.siguiente.cliente} el ${fechaCorta(r.siguiente.entrega)}` : null, sensible && r.margen != null ? `margen del proyecto ${pct(r.margen)}` : null].filter(Boolean).join(' · ');

  const colPedidos = [
    { key: 'folio', label: 'Pedido', align: 'left', mono: true, render: (p) => p.folio || p.oc_cliente || '—' },
    { key: 'cliente', label: 'Cliente', align: 'left', render: (p) => `${p.cliente}${p.direct_order ? ' · directo' : ''}` },
    { key: 'modelos', label: 'Modelos', align: 'left', mono: true, maxWidth: 220, render: modelosDe },
    { key: 'equipos', label: 'Equipos', render: (p) => int(p.equipos) },
    { key: 'monto', label: 'Monto', render: (p) => money(p.monto) },
    ...(sensible ? [{ key: 'utilidad', label: 'Utilidad', render: (p) => (p.utilidad == null ? '—' : money(p.utilidad)) }] : []),
    { key: 'etapa', label: 'Etapa', align: 'left', render: (p) => <PillEtapa p={p} /> },
    { key: 'entrega', label: 'Entrega', align: 'left', render: (p) => (p.entrega ? `${fechaCorta(p.entrega)}${p.entregaEstimada ? ' · est.' : ''}` : '—') },
    { key: 'cobro', label: 'Cobro', align: 'left', render: cobroDe },
  ];
  const colModelos = [
    { key: 'sku', label: 'Clave', align: 'left', mono: true },
    { key: 'config', label: 'Configuración', align: 'left', maxWidth: 240, render: (m) => m.config || <span style={{ color: theme.textMuted }}>por capturar</span> },
    { key: 'licencia', label: 'Windows', align: 'left', render: (m) => String(m.licencia || '—').replace('Windows ', '') },
    { key: 'precio', label: 'Precio lista', render: (m) => (m.precio ? money(m.precio) : <Pill tone="orange">sin precio</Pill>) },
    ...(sensible ? [
      { key: 'costo', label: 'Costo DECME', render: (m) => (m.costo == null ? '—' : <span>{money(m.costo)}{m.deltaCosto ? <span style={{ color: m.deltaCosto > 0 ? theme.red : theme.green, marginLeft: 4 }}>{m.deltaCosto > 0 ? '▲' : '▼'}</span> : null}</span>) },
      { key: 'margen', label: 'Margen', render: (m) => (m.margen == null ? '—' : pct(m.margen)) },
    ] : []),
    { key: 'pedidos', label: 'Pedidos', render: (m) => int(m.pedidos) },
    { key: 'facturados', label: 'Facturados', render: (m) => int(m.facturados) },
  ];

  const fila = { display: 'flex', justifyContent: 'space-between', gap: 12, padding: '7px 0', fontSize: 12.5, color: theme.text, fontVariantNumeric: 'tabular-nums' };
  const tarjetaM = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 4, cursor: 'pointer', minHeight: 44, color: theme.text };

  return (
    <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
      <div style={{ padding: pad }}>
        <Hero eyebrow={r.diasPiloto ? `Piloto de 90 días · día ${r.diasPiloto}` : 'Acteck PCs · con Grupo DECME'} titulo={frase(r)} sub={sub || 'Tarima de 60 equipos · hasta 100 por día de producción · envío de 2 a 3 días.'}
          stats={movil ? [] : [{ k: 'Tarimas', v: r.tarimas ? (Number.isInteger(r.tarimas) ? r.tarimas : r.tarimas.toFixed(1)) : '0', sub: `${r.clientes} cliente${r.clientes === 1 ? '' : 's'}` }]} />
      </div>

      <div data-entrada-kpis style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${movil ? 150 : 200}px, 1fr))`, gap: 10, padding: pad }}>
        <KpiCard eyebrow="Equipos vendidos" big={int(r.equipos)} sub={`${r.pedidos} pedido${r.pedidos === 1 ? '' : 's'} · ${int(r.enProduccion)} en producción`} />
        <KpiCard eyebrow="Venta" big={moneyCompact(r.venta)} sub={r.ticket ? `ticket ⌀ ${money(r.ticket)} por equipo` : 'sin pedidos'} />
        <KpiCard eyebrow="Por cobrar" big={moneyCompact(r.porCobrar)} badge={r.vencido ? { tone: 'red', l: `${moneyCompact(r.vencido)} vencido` } : null} sub={`cobrado ${moneyCompact(r.cobrado)} · sin facturar ${moneyCompact(r.sinFacturar)}`} />
        <KpiCard eyebrow="Por pagar a DECME" big={moneyCompact(r.porPagar)} sub={`pagado ${moneyCompact(r.pagado)}`} />
      </div>

      <div style={{ padding: pad }}>
        <Panel titulo="Pedidos" meta="de la orden de compra al cobro"
          acciones={<><Segmented options={[{ id: 'abiertos', label: 'Abiertos' }, { id: 'todos', label: 'Todos' }]} value={filtro} onChange={(v) => { setFiltro(v); setEtapa(null); }} />{onNuevo && <Boton primario icon={Plus} onClick={onNuevo}>{movil ? 'Pedido' : 'Nuevo pedido'}</Boton>}</>}>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${movil ? 3 : 6}, minmax(0, 1fr))`, gap: 6, marginBottom: 10 }}>
            {ETAPAS.map((e) => {
              const on = etapa === e.id;
              return (
                <button key={e.id} type="button" onClick={() => setEtapa(on ? null : e.id)}
                  style={{ textAlign: 'left', border: 0, borderRadius: 12, padding: '8px 10px', minHeight: 44, cursor: 'pointer', background: on ? `${theme.accent}22` : (theme.surfaceHover || 'rgba(120,120,128,0.10)'), color: on ? theme.accent : theme.text }}>
                  <span style={{ display: 'block', fontSize: 10, color: on ? theme.accent : theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{e.label}</span>
                  <span style={{ fontFamily: TYPO.fontRounded, fontSize: 18, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.etapas[e.id] || 0}</span>
                </button>
              );
            })}
          </div>
          {movil ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {!lista.length && <div style={{ color: theme.textMuted, fontSize: 12.5, padding: 8 }}>Sin pedidos en esta vista.</div>}
              {lista.map((p) => (
                <div key={p.id} role="button" onClick={() => onPedido?.(p)} style={tarjetaM}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}><b style={{ fontSize: 13.5 }}>{p.cliente}</b><PillEtapa p={p} /></div>
                  <div style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{int(p.equipos)} equipos · {money(p.monto)} · {p.entrega ? `entrega ${fechaCorta(p.entrega)}` : 'sin fecha'}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted }}>{p.folio || p.oc_cliente || 'sin folio'} · {modelosDe(p)}</div>
                </div>
              ))}
            </div>
          ) : (
            <TablaCompacta columnas={colPedidos} filas={lista} onRowClick={onPedido} vacio="Sin pedidos en esta vista. Registra el primero con «Nuevo pedido»." />
          )}
        </Panel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: movil ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(460px, 1fr))', gap: 12, padding: pad, alignItems: 'start' }}>
        <Panel titulo="Modelos" meta={`${modelos.length} claves · toca una para ver componentes y costos`}>
          {movil ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {modelos.map((m) => (
                <div key={m.sku} role="button" onClick={() => onModelo?.(m)} style={tarjetaM}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}><b style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{m.sku}</b><span style={{ fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>{m.precio ? money(m.precio) : 'sin precio'}</span></div>
                  <div style={{ fontSize: 12, color: theme.textMuted }}>{m.config || 'configuración por capturar'} · {String(m.licencia || '').replace('Windows ', 'Win ')}</div>
                  <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{int(m.pedidos)} pedidos · {int(m.facturados)} facturados{sensible && m.margen != null ? ` · margen ${pct(m.margen)}` : ''}</div>
                </div>
              ))}
            </div>
          ) : <TablaCompacta columnas={colModelos} filas={modelos} rowKey={(m) => m.sku} onRowClick={onModelo} />}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
          <Panel titulo="Dinero del proyecto">
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={fila}><span>Vendido en pedidos</span><b>{money(r.venta)}</b></div>
              <div style={fila}><span>Facturado en el ERP</span><span>{facturadoErp ? money(facturadoErp) : 'aún sin facturas'}</span></div>
              <div style={fila}><span>Cobrado</span><span>{money(r.cobrado)}</span></div>
              <div style={fila}><span>Por cobrar {r.vencido ? <Pill tone="red" size="xs">{moneyCompact(r.vencido)} vencido</Pill> : null}</span><span>{money(r.porCobrar)}</span></div>
              <div style={fila}><span>Pagado a DECME</span><span>{money(r.pagado)}</span></div>
              <div style={fila}><span>Por pagar a DECME</span><span>{money(r.porPagar)}</span></div>
              {sensible && <div style={{ ...fila, borderTop: `1px solid ${theme.border}`, marginTop: 4, paddingTop: 10 }}><b>Utilidad del proyecto</b><b>{r.utilidad == null ? 'faltan costos' : `${money(r.utilidad)} · ${pct(r.margen)}`}</b></div>}
            </div>
          </Panel>
          <Panel titulo="Nuestros componentes dentro de las PCs" meta="lo que le vendemos a DECME">
            {!comps.length && <div style={{ color: theme.textMuted, fontSize: 12.5 }}>Captura en cada modelo qué gabinete, fuente y enfriamiento lleva (con su clave AC- o BR-) y aquí verás cuántas tarimas alcanzan con el inventario de hoy.</div>}
            {comps.map((c) => (
              <div key={c.sku} style={{ ...fila, alignItems: 'center' }}>
                <span style={{ minWidth: 0 }}><span style={{ display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.descripcion}</span><span style={{ fontSize: 10.5, color: theme.textMuted }}>{c.sku} · usados {int(c.usados)} · tenemos {int(c.disponible)}{c.llega ? ` · llegan ${int(c.llegaPiezas)} el ${fechaCorta(c.llega)}` : ''}</span></span>
                <Pill tone={c.tono}>{c.tarimas} tarima{c.tarimas === 1 ? '' : 's'}</Pill>
              </div>
            ))}
          </Panel>
        </div>
      </div>
      <div style={{ padding: pad, fontSize: 10.5, color: theme.textMuted }}>Tarima = {TARIMA} equipos. Precio de lista: Mayoreo PMM. Las fechas «est.» se calculan con la regla del anexo.</div>
    </div>
  );
}

export default function ActeckPCs({ movil = false }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const { data, isLoading, error } = usePcs();
  const [pedido, setPedido] = useState(null); // objeto del pedido | 'nuevo'
  const [modeloSku, setModeloSku] = useState(null);
  const sensible = puedeVerSensible(perfil);
  if (isLoading) return <Cargando pantalla="forecastReservas" />;
  if (error || !data) return <div style={{ padding: 24, color: theme.textMuted, fontFamily: TYPO.fontText }}>No se pudo cargar Acteck PCs. {String(error?.message || '')}</div>;
  return (
    <>
      <ActeckPcsVista datos={data} hoy={hoyISO()} sensible={sensible} movil={movil} onPedido={setPedido} onModelo={(m) => setModeloSku(m.sku)} onNuevo={() => setPedido('nuevo')} />
      {pedido && <HojaPedido pedido={pedido === 'nuevo' ? null : pedido} datos={data} sensible={sensible} perfil={perfil} onClose={() => setPedido(null)} />}
      {modeloSku && <HojaModelo sku={modeloSku} datos={data} sensible={sensible} perfil={perfil} onClose={() => setModeloSku(null)} />}
    </>
  );
}
