// DetalleReunion — una reunión S&OP con el mismo formato del correo del CRM (encabezado · nota · tabla · qué sigue · pie)
// más el cruce con hoy por línea (sugerido del motor, stock, tránsito, PO/arribo) y el cumplimiento.
// El cruce se calcula al abrir el detalle (useMemo) sobre datos que la pantalla S&OP ya tiene en memoria.
import React, { useMemo, useRef } from 'react';
import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { TYPO } from '../../../../lib/themeTokens';
import { fecha as fmtFecha, fechaCorta } from '../../../../lib/format';
import ExportMenu from '../../../../components/ExportMenu';
import { Panel, Pill, Boton, TablaCompacta, KpiCard } from '../../../../components/kit';
import { fmtInt } from '../../inventario/constantes';
import { cruzarReunion, tonoCumplimiento } from './cruce';

const ESTADO_PILL = {
  sin_po: { tone: 'red', label: 'Sin PO' },
  po: { tone: 'blue' }, parcial: { tone: 'orange' }, llego: { tone: 'green' },
};

export function PillPO({ l }) {
  const cfg = ESTADO_PILL[l.estado] || ESTADO_PILL.sin_po;
  if (l.estado === 'sin_po') return <Pill tone="red" size="xs">Sin PO</Pill>;
  const nPo = l.pos.length;
  const poTxt = nPo === 1 ? `PO ${l.pos[0].po}` : `${nPo} POs`;
  if (l.estado === 'llego') return <Pill tone="green" size="xs" title={l.pos.map((p) => p.po).join(', ')}>Llegó · {fmtInt(l.poPz)} pz</Pill>;
  const arribo = l.proximoArribo ? ` · llega ${fechaCorta(l.proximoArribo)}` : '';
  const parcial = l.estado === 'parcial' ? ` · ${fmtInt(l.llegadoPz)} ya llegaron` : '';
  return <Pill tone={cfg.tone} size="xs" title={l.pos.map((p) => `${p.po} · ${p.estatus} · ${fmtInt(p.qty)} pz`).join('\n')}>{poTxt}{arribo} · {fmtInt(l.poPz)} pz{parcial}</Pill>;
}

export default function DetalleReunion({ theme, reunion, lineas, idx, puedeEditar, sensible, onVolver, onEditar, onEliminar }) {
  const rootRef = useRef(null);
  const cruce = useMemo(() => cruzarReunion(reunion, lineas, idx), [reunion, lineas, idx]);
  const muted = { color: theme.textMuted };
  const sig = Array.isArray(reunion.siguientes) ? reunion.siguientes : [];
  const fechaTxt = reunion.fecha_reunion ? fmtFecha(reunion.fecha_reunion) : fmtFecha(String(reunion.created_at || '').slice(0, 10));

  const columnas = [
    { key: 'marca', label: 'Marca', align: 'left', width: 80, render: (l) => <span style={{ fontSize: 10.5 }}>{l.marca || '—'}</span> },
    { key: 'familia', label: 'Familia', align: 'left', width: 120, maxWidth: 130, render: (l) => <span style={{ fontSize: 10.5 }}>{l.familia || '—'}</span> },
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 88 },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 260, render: (l) => <span title={l.descripcion}>{l.descripcion || '—'}</span> },
    { key: 'pedido', label: 'Cantidad', sum: true, render: (l) => <strong>{fmtInt(l.pedido)}</strong> },
    { key: 'comentario', label: 'Comentarios', align: 'left', maxWidth: 200, render: (l) => <span title={l.comentario} style={{ fontSize: 10.5, ...(!l.comentario ? muted : {}) }}>{l.comentario || '—'}</span> },
    { key: 'sugeridoHoy', label: 'Sugerido hoy', render: (l) => (l.sugeridoHoy == null ? <span style={muted} title="SKU fuera del Reporte">—</span> : <span style={{ color: l.sugeridoHoy > l.pedido ? theme.orange : theme.text }}>{fmtInt(l.sugeridoHoy)}</span>) },
    { key: 'stock', label: 'Stock', render: (l) => (l.stock == null ? '—' : fmtInt(l.stock)) },
    { key: 'transito', label: 'Tránsito', render: (l) => (l.transito ? fmtInt(l.transito) : <span style={muted}>0</span>) },
    { key: 'po', label: 'PO · arribo', align: 'left', width: 200, render: (l) => <PillPO l={l} /> },
  ];

  const excel = () => ({
    titulo: `S&OP · ${reunion.folio}`, archivo: `SOP ${reunion.folio}`,
    hojas: [{
      nombre: reunion.folio, subtitulo: `${reunion.titulo || ''} · solicita ${reunion.solicita || '—'} · ${fechaTxt} · cumplimiento ${Math.round(cruce.cumplimiento)} %`,
      columnas: [
        { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 12 }, { label: 'Familia', key: 'familia', tipo: 'texto', ancho: 18 }, { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 12 },
        { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 50 }, { label: 'Cantidad', key: 'pedido', tipo: 'numero' }, { label: 'Comentarios', key: 'comentario', tipo: 'texto', ancho: 36 },
        { label: 'Sugerido hoy', key: 'sugeridoHoy', tipo: 'numero' }, { label: 'Stock', key: 'stock', tipo: 'numero' }, { label: 'Tránsito', key: 'transito', tipo: 'numero' },
        { label: 'POs', key: 'pos', tipo: 'texto', ancho: 18 }, { label: 'Pz con PO', key: 'poPz', tipo: 'numero' }, { label: 'Próximo arribo', key: 'proximoArribo', tipo: 'fecha' }, { label: 'Estado', key: 'estado', tipo: 'texto', ancho: 10 },
      ],
      filas: cruce.lineas.map((l) => ({ ...l, pos: l.pos.map((p) => p.po).join(', '), sugeridoHoy: l.sugeridoHoy ?? null, estado: { sin_po: 'Sin PO', po: 'Con PO', parcial: 'Parcial', llego: 'Llegó' }[l.estado] })),
      totales: { marca: 'TOTAL', sku: `${cruce.lineas.length} SKUs`, pedido: cruce.pedido, poPz: cruce.lineas.reduce((a, l) => a + l.poPz, 0) },
    }],
  });

  return (
    <div ref={rootRef} data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Boton icon={ArrowLeft} onClick={onVolver}>Reuniones</Boton>
        <span style={{ flex: 1 }} />
        {puedeEditar && <Boton icon={Pencil} onClick={onEditar}>Editar</Boton>}
        {puedeEditar && <Boton icon={Trash2} peligro onClick={onEliminar}>Eliminar</Boton>}
        <ExportMenu titulo={`S&OP · ${reunion.folio}`} subtitulo={reunion.titulo} excel={excel} pdf={{ ref: rootRef }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard eyebrow="Cumplimiento" badge={{ tone: tonoCumplimiento(cruce.cumplimiento), l: `${cruce.conPo} de ${cruce.lineas.length} con PO` }}
          big={`${Math.round(cruce.cumplimiento)} %`} bigSmall={`${fmtInt(cruce.cubierto)} de ${fmtInt(cruce.pedido)} pz`} progress={cruce.cumplimiento}
          sub="Σ min(pedido, piezas en PO emitidas desde la reunión) ÷ Σ pedido" />
        <KpiCard eyebrow="Pedido" big={`${fmtInt(cruce.pedido)} pz`} bigSmall={`${cruce.lineas.length} SKUs`} sub={`solicita ${reunion.solicita || '—'} · ${fechaTxt}`} />
        <KpiCard eyebrow="Ya llegó" badge={{ tone: cruce.llegadas ? 'green' : 'gray', l: `${cruce.llegadas} SKUs` }} big={`${fmtInt(cruce.lineas.reduce((a, l) => a + l.llegadoPz, 0))} pz`} sub="embarques concluidos de esas POs" />
        <KpiCard eyebrow="Sin PO" badge={{ tone: cruce.lineas.length - cruce.conPo ? 'red' : 'green', l: cruce.lineas.length - cruce.conPo ? 'atender' : 'ok' }}
          big={fmtInt(cruce.lineas.length - cruce.conPo)} bigSmall="SKUs" bigColor={cruce.lineas.length - cruce.conPo ? theme.red : undefined}
          sub={`${fmtInt(cruce.lineas.filter((l) => l.estado === 'sin_po').reduce((a, l) => a + l.pedido, 0))} pz sin orden de compra`} />
      </div>

      {/* Formato del correo */}
      <Panel padding="0">
        <div style={{ background: theme.accent || '#007AFF', color: '#FFF', padding: '12px 16px', borderRadius: '12px 12px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.85, fontWeight: 600 }}>ACTECK - SOLICITUD DE COMPRA</div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', margin: '2px 0' }}>{reunion.titulo || reunion.folio}</div>
            <div style={{ fontSize: 11.5, opacity: 0.9 }}>{fmtInt(reunion.total_skus)} SKUs · {fmtInt(reunion.total_piezas)} piezas · solicita {reunion.solicita || '—'}</div>
          </div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.18)', letterSpacing: '0.04em' }}>{reunion.folio}</span>
        </div>
        <div style={{ padding: '12px 16px', fontSize: 12.5, lineHeight: 1.5, color: theme.text }}>
          <p style={{ margin: '0 0 8px' }}>Hola equipo,</p>
          <p style={{ margin: '0 0 12px', ...muted }}>De su apoyo para gestionar las siguientes adquisiciones. Las cantidades se calcularon como stock mínimo menos inventario menos órdenes de compra ya en tránsito.</p>
          {reunion.nota && (
            <div style={{ borderLeft: `3px solid ${theme.accent || '#007AFF'}`, padding: '6px 12px', marginBottom: 12, background: theme.surfaceHover || 'rgba(0,0,0,0.02)', borderRadius: '0 8px 8px 0' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, ...muted, marginBottom: 2 }}>Nota de {reunion.nota_autor || reunion.solicita || '—'}</div>
              <div style={{ whiteSpace: 'pre-wrap' }}>{reunion.nota}</div>
            </div>
          )}
          <TablaCompacta dense columnas={columnas} filas={cruce.lineas} rowKey={(l, i) => `${l.sku}-${i}`} vacio="Sin líneas." />
          {sig.length > 0 && (
            <div style={{ marginTop: 14 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 600, ...muted, marginBottom: 6 }}>Qué sigue · por rol</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'max-content 1fr', gap: '4px 14px', fontSize: 12 }}>
                {sig.map((s, i) => (
                  <React.Fragment key={i}>
                    <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{s.rol}</span>
                    <span>{s.accion}</span>
                  </React.Fragment>
                ))}
              </div>
            </div>
          )}
          <div style={{ marginTop: 14, fontSize: 10.5, ...muted, borderTop: `1px solid ${theme.border}`, paddingTop: 8 }}>
            {reunion.fuente === 'correo' ? 'Generado desde el módulo S&OP del CRM Acteck' : 'Capturado a mano en el dashboard'} · {fechaTxt}
            {reunion.updated_at && reunion.updated_at !== reunion.created_at ? ` · editado ${fmtFecha(String(reunion.updated_at).slice(0, 10))}` : ''}
          </div>
        </div>
      </Panel>
    </div>
  );
}
