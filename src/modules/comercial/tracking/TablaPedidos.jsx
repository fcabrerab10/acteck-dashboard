// Panel "Pedidos": buscador (OC, cotización, SKU, factura, guía, cliente; sin acentos) + pills con conteo + Segmented
// Abiertos/Entregados/Todos + TablaCompacta con drill (DrillOC). Los conteos se calculan con los demás filtros aplicados.
import React, { useMemo, useRef, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TablaCompacta, Segmented, Pill, Panel, Cargando } from '../../../components/kit';
import Buscador from '../sellin/Buscador';
import Filtros from '../sellin/Filtros';
import ExportMenu from '../../../components/ExportMenu';
import { ETAPAS, ETAPA_LABEL, ETAPA_TONE, CLIENTES, TONE_CLIENTE, nombreCliente, fmtInt, fmtFecha, fmtPct } from './textos';
import { facetas, pasaFiltros, nFiltrosActivos, ordenar } from './calculo';
import { ClientePill, EtapaPill, Avance, FuentePill } from './ui';
import DrillOC from './DrillOC';

const FUENTE_LABEL = { manual: 'Manual', correo: 'Correo', factura: 'Desde factura', cotizacion: 'Cotización' };

// Resumen de una línea: cuántas facturas y cómo va el envío. El detalle completo (folios, guías,
// paquetería, fechas, desfase) vive en el drill — así la tabla cabe en la tarjeta sin scroll lateral.
function Detalle({ oc }) {
  const { theme } = useTheme();
  const mute = { color: theme.textMuted, fontSize: 11.5 };
  if (oc.esCotizacion) {
    return <span style={mute}>{oc.cotizacion?.estado === 'enviada' ? 'esperando OC' : oc.cotizacion?.estado === 'perdida' ? (oc.cotizacion.motivo_perdida || 'perdida') : '—'}</span>;
  }
  const folios = (oc.facturas || []).map((x) => x.folio).concat(oc.folioPendientes || []);
  const envios = oc.envios || [];
  const ult = envios[envios.length - 1] || null;
  const paq = [...new Set(envios.map((x) => x.paqueteria).filter(Boolean))].join('/') || (envios.some((x) => x.metodo_envio === 'unidad_propia') ? 'Unidad propia' : '');
  const fecha = ult ? (ult.fechaEntrega || ult.fechaEnvio) : null;
  const titulo = [folios.length ? `Facturas: ${folios.join(', ')}` : null,
    envios.length ? `${envios.length} envío${envios.length === 1 ? '' : 's'}${paq ? ` · ${paq}` : ''}${ult?.guia_rastreo ? ` · guía ${ult.guia_rastreo}` : ''}` : null].filter(Boolean).join(' · ');
  if (!folios.length && !envios.length) return <span style={mute}>—</span>;
  return (
    <span title={titulo || undefined} style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', minWidth: 0 }}>
      {folios.length > 0 && <Pill tone="gray" size="xs">{folios.length} fact.</Pill>}
      {envios.length > 0 && <span style={{ ...mute, whiteSpace: 'nowrap' }}>{[paq || `${envios.length} envío${envios.length === 1 ? '' : 's'}`, fecha ? fmtFecha(fecha) : null].filter(Boolean).join(' · ')}</span>}
      {envios.some((x) => x.fuente === 'erp' || x.tieneGuiaErp) && <FuentePill fuente="erp" />}
      {oc.conDesfase && <Pill tone="orange" size="xs">desfase</Pill>}
    </span>
  );
}

export default function TablaPedidos({ filas, f, setF, abierta, setAbierta, refrescando, puedeEditar, drill, subtitulo }) {
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const [orden, setOrden] = useState(null);
  const fac = useMemo(() => facetas(filas, f), [filas, f]);
  const visibles = useMemo(() => {
    const base = ordenar(filas.filter((r) => pasaFiltros(r, f)));
    if (!orden) return base;
    const dir = orden.dir === 'asc' ? 1 : -1;
    const val = (r) => ({ cliente: nombreCliente(r.cliente_key), oc: r.numero_oc_cliente, recibida: r.fecha_recibida || '', etapa: r.etapa, pedido: r.pedido, fill: r.fill, dias: r.diasEnEtapa ?? -1 })[orden.col];
    return base.sort((a, b) => { const x = val(a), y = val(b); return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * dir; });
  }, [filas, f, orden]);
  const toggle = (grupo, id) => setF((p) => { const s = new Set(p[grupo]); s.has(id) ? s.delete(id) : s.add(id); return { ...p, [grupo]: s }; });
  const toggleFlag = (id) => setF((p) => ({ ...p, [id]: !p[id] }));
  const limpiar = () => setF((p) => ({ ...p, cliente: new Set(), etapa: new Set(), fuente: new Set(), detenida: false, backorder: false, desfase: false, surtible: false }));
  const etapasPresentes = [...ETAPAS, 'perdida'].filter((e) => fac.etapa.get(e) || f.etapa.has(e));
  const grupos = [
    { id: 'cliente', label: 'Cliente', sel: f.cliente, opciones: CLIENTES.map((c) => ({ id: c.key, label: c.nombre, n: fac.cliente.get(c.key) || 0, tone: TONE_CLIENTE[c.key] })) },
    { id: 'etapa', label: 'Etapa', sel: f.etapa, opciones: etapasPresentes.map((e) => ({ id: e, label: e === 'perdida' ? 'Cot. perdida' : ETAPA_LABEL[e], n: fac.etapa.get(e) || 0, tone: ETAPA_TONE[e] })) },
    { id: 'fuente', label: 'Fuente', sel: f.fuente, opciones: Object.keys(FUENTE_LABEL).filter((k) => fac.fuente.get(k) || f.fuente.has(k)).map((k) => ({ id: k, label: FUENTE_LABEL[k], n: fac.fuente.get(k) || 0 })) },
  ];
  const toggles = [
    { id: 'detenida', label: 'Detenida', on: f.detenida, n: fac.detenida },
    { id: 'backorder', label: 'Con backorder', on: f.backorder, n: fac.backorder },
    { id: 'surtible', label: 'Surtible hoy', on: f.surtible, n: fac.surtible },
    { id: 'desfase', label: 'Guía con desfase', on: f.desfase, n: fac.desfase },
  ];
  // Regla de ancho: 7 columnas visibles. La fecha de recibida va dentro de la celda de la OC (línea
  // chica en gris) y el detalle de facturas y envíos vive en el drill (DrillOC), que ya los muestra
  // completos; aquí sólo quedan los indicadores (n.º de facturas, guía, desfase) como píldoras.
  const columnas = [
    { key: 'cliente', label: 'Cliente', align: 'left', sort: true, render: (r) => <ClientePill k={r.cliente_key} /> },
    { key: 'oc', label: 'OC', align: 'left', mono: true, sort: true, bold: true, maxWidth: 180, render: (r) => (
      <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
        <span style={{ display: 'inline-flex', gap: 5, alignItems: 'center', minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.numero_oc_cliente}</span>
          {r.esCotizacion && <Pill tone="purple" size="xs">cot.</Pill>}
          {r.fuente && r.fuente !== 'manual' && !r.esCotizacion && <FuentePill fuente={r.fuente === 'factura' ? 'erp' : null} />}
        </span>
        <span style={{ fontSize: 10, color: theme.textMuted, fontWeight: 400, letterSpacing: 0 }}>
          {r.esCotizacion ? fmtFecha(r.fechaEtapa) : fmtFecha(r.fecha_recibida)}
        </span>
      </span>
    ) },
    { key: 'etapa', label: 'Etapa', align: 'left', sort: true, render: (r) => <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}><EtapaPill oc={r} />{r.detenida && <Pill tone="red" size="xs" dot>detenida</Pill>}</span> },
    { key: 'avance', label: 'Avance', align: 'left', render: (r) => <Avance oc={r} /> },
    { key: 'pedido', label: 'Pz', sort: true, render: (r) => fmtInt(r.pedido) },
    { key: 'fill', label: 'Fill', sort: true, render: (r) => r.esCotizacion ? '—' : <span style={{ fontWeight: 600, color: r.fill >= 99.5 ? theme.green : r.fill >= 85 ? theme.text : r.fill > 0 ? theme.orange : theme.textMuted }}>{fmtPct(r.fill)}</span> },
    { key: 'dias', label: 'Días', sort: true, render: (r) => r.diasEnEtapa == null ? '—' : <span style={{ color: r.detenida ? theme.red : theme.text }}>{Math.round(r.diasEnEtapa)}</span> },
    { key: 'estado', label: 'Detalle', align: 'left', maxWidth: 180, render: (r) => <Detalle oc={r} /> },
  ];
  const excel = () => ({
    hojas: [{ nombre: 'Pedidos', columnas: [
      { key: 'cliente', label: 'Cliente' }, { key: 'oc', label: 'OC' }, { key: 'recibida', label: 'Recibida' }, { key: 'etapa', label: 'Etapa' },
      { key: 'pedido', label: 'Pedido pz', tipo: 'numero' }, { key: 'facturado', label: 'Facturado pz', tipo: 'numero' }, { key: 'backorder', label: 'Backorder pz', tipo: 'numero' }, { key: 'fill', label: 'Fill %', tipo: 'numero' },
      { key: 'dias', label: 'Días en etapa', tipo: 'numero' }, { key: 'detenida', label: 'Detenida' }, { key: 'facturas', label: 'Facturas' }, { key: 'guias', label: 'Guías' }, { key: 'estimada', label: 'Entrega estimada' }],
      filas: visibles.map((r) => ({ cliente: nombreCliente(r.cliente_key), oc: r.numero_oc_cliente, recibida: r.fecha_recibida ? fmtFecha(r.fecha_recibida) : '', etapa: r.esCotizacion ? (r.cotizacion?.estado || '') : r.etapa, pedido: r.pedido, facturado: r.facturado, backorder: r.backorder, fill: Math.round(r.fill), dias: r.diasEnEtapa == null ? null : Math.round(r.diasEnEtapa), detenida: r.detenida ? 'Sí' : '', facturas: (r.facturas || []).map((x) => x.folio).join(', '), guias: (r.guias || []).join(' | '), estimada: r.fechaEstimada ? fmtFecha(r.fechaEstimada) : '' })) }],
  });
  return (
    <div ref={rootRef}>
      <Panel titulo="Pedidos" meta={subtitulo || `${visibles.length} de ${filas.length} · clic abre el drill`}
        acciones={<div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <Buscador value={f.q} onChange={(q) => setF((p) => ({ ...p, q }))} resultados={f.q ? `${visibles.length}` : null} placeholder="OC, cotización, SKU, factura, guía, cliente…" width={300} />
          <Segmented value={f.segmento} onChange={(segmento) => setF((p) => ({ ...p, segmento }))} options={[{ id: 'abiertos', label: 'Abiertos', badge: fac.segmento.abiertos }, { id: 'entregados', label: 'Entregados', badge: fac.segmento.entregados }, { id: 'todos', label: 'Todos', badge: fac.segmento.todos }]} />
          <ExportMenu titulo="Tracking Pedidos" subtitulo={`${visibles.length} pedidos`} excel={excel} pdf={{ ref: rootRef }} />
        </div>}>
        <Filtros grupos={grupos} toggles={toggles} onToggle={toggle} onToggleFlag={toggleFlag} onLimpiar={limpiar} activos={nFiltrosActivos(f)} style={{ marginBottom: 8 }} />
        <TablaCompacta columnas={columnas} filas={visibles} rowKey={(r) => r.id} onRowClick={(r) => setAbierta(abierta === r.id ? null : r.id)} orden={orden} onSort={(col) => setOrden((o) => (o?.col === col ? (o.dir === 'asc' ? { col, dir: 'desc' } : null) : { col, dir: 'asc' }))}
          expandidoKey={abierta} maxHeight={640} vacio={f.q || nFiltrosActivos(f) ? 'Nada coincide con la búsqueda o los filtros.' : 'Sin pedidos: registra la primera OC.'}
          rowStyle={(r) => (r.id === abierta ? { background: theme.mode === 'dark' ? 'rgba(10,132,255,0.10)' : 'rgba(0,122,255,0.06)' } : null)}
          renderExpandido={(r) => (
            <div style={{ minWidth: 0 }}>
              {refrescando ? <Cargando pantalla="trackingDrill" minHeight={220} /> : <DrillOC oc={r} puedeEditar={puedeEditar} {...drill} />}
            </div>
          )} />
      </Panel>
    </div>
  );
}
