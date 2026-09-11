// Drill de una OC (fila expandida de la tabla): timeline con fuente por etapa, texto explicativo, SKUs pedido vs
// facturado vs backorder con "Cubre", envíos (guía, paquetería, fechas, fuente, desfase con elección) y acciones.
import React, { useState } from 'react';
import { Truck, Share2, Edit2, FileText, ArrowRightLeft, Check } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Pill, Boton, toneColors, toast } from '../../../components/kit';
import { ETAPA_LABEL, ETAPA_TONE, ESTADO_COT_LABEL, fmtInt, fmtFecha, fmtFechaAnio, fmtPct, textoExplicativo, textoEstatusOC, DESFASE_DIAS, nombreCliente } from './textos';
import { compartir } from '../../../lib/whatsapp';
import { elegirFechaEnvio } from './datos';
import { FuentePill } from './ui';

function Timeline({ oc }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, overflowX: 'auto', padding: '2px 0 6px' }}>
      {oc.timeline.map((t, i) => {
        const [bg, col] = toneColors(theme, t.estado === 'perdida' ? 'red' : ETAPA_TONE[t.etapa]);
        const hecho = t.estado === 'hecho' || t.estado === 'parcial' || t.estado === 'perdida';
        const actual = t.etapa === oc.etapa;
        return (
          <div key={t.etapa} style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <div style={{ padding: '6px 10px', borderRadius: 10, background: actual ? bg : 'transparent', border: `1px solid ${actual ? col : 'transparent'}`, minWidth: 108 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: hecho ? col : 'transparent', border: `1.5px solid ${hecho ? col : theme.border}`, display: 'inline-block' }} />
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: hecho ? theme.text : theme.textMuted }}>{ETAPA_LABEL[t.etapa]}{t.estado === 'parcial' ? ' parcial' : ''}</span>
              </div>
              <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums', display: 'flex', gap: 5, alignItems: 'center' }}>
                {t.fecha ? fmtFecha(t.fecha) : '—'}{t.fecha && <FuentePill fuente={t.fuente} />}
              </div>
              {t.nota && <div style={{ fontSize: 10, color: theme.textSubtle || theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 150 }}>{t.nota}</div>}
            </div>
            {i < oc.timeline.length - 1 && <span style={{ width: 14, height: 1, background: theme.border, flexShrink: 0 }} />}
          </div>
        );
      })}
      {oc.etapa !== 'entregada' && oc.diasEnEtapa != null && (
        <div style={{ marginLeft: 'auto', alignSelf: 'center', paddingLeft: 10, whiteSpace: 'nowrap' }}>
          <Pill tone={oc.detenida ? 'red' : 'gray'} size="xs" dot={oc.detenida}>{Math.round(oc.diasEnEtapa)} d en {ETAPA_LABEL[oc.etapa]?.toLowerCase()}{oc.detenida ? ' · detenida' : ''}</Pill>
        </div>
      )}
    </div>
  );
}

function Desfase({ e, puedeEditar }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  if (!e.desfase || e.fuente === 'erp') return e.fecha_elegida ? <Pill tone="gray" size="xs">vale {e.fecha_elegida === 'erp' ? 'ERP' : 'manual'}</Pill> : null;
  const elegir = async (v) => { setBusy(true); try { await elegirFechaEnvio(e.id, v); toast.ok(`Fecha ${v === 'erp' ? 'del ERP' : 'manual'} elegida`); } catch (err) { toast.error(err.message); } finally { setBusy(false); } };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <Pill tone={e.conDesfase ? 'orange' : 'gray'} size="xs" title={`Manual ${fmtFecha(e.fecha_surtida)} · ERP ${fmtFecha(e.fecha_envio_erp)}`}>desfase {Math.round(e.desfase)} d{e.fecha_elegida ? ` · vale ${e.fecha_elegida === 'erp' ? 'ERP' : 'manual'}` : ''}</Pill>
      {puedeEditar && e.conDesfase && (
        <>
          <button type="button" disabled={busy} onClick={() => elegir('manual')} style={btn(theme)}>manual {fmtFecha(e.fecha_surtida)}</button>
          <button type="button" disabled={busy} onClick={() => elegir('erp')} style={btn(theme)}>ERP {fmtFecha(e.fecha_envio_erp)}</button>
        </>
      )}
    </span>
  );
}
const btn = (theme) => ({ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent || '#007AFF', borderRadius: 999, padding: '1px 7px', fontSize: 10, fontFamily: TYPO.fontDisplay, fontWeight: 600, cursor: 'pointer' });

export default function DrillOC({ oc, puedeEditar, onRegistrarEnvio, onEditarOC, onEditarEnvio, onCapturarFolios, onConvertir, onEditarCotizacion }) {
  const { theme } = useTheme();
  const compartirEstatus = async () => { const r = await compartir(textoEstatusOC(oc), { titulo: `Estatus OC ${oc.numero_oc_cliente}` }); if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…'); };
  const cabecera = oc.esCotizacion
    ? `${oc.numero_oc_cliente} · ${ESTADO_COT_LABEL[oc.cotizacion?.estado] || 'Cotización'}${oc.pedido ? ` · ${fmtInt(oc.pedido)} pz` : ''}${oc.monto ? ` · ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(oc.monto)}` : ''}`
    : `OC ${oc.numero_oc_cliente} · recibida ${fmtFechaAnio(oc.fecha_recibida)} · ${fmtInt(oc.pedido)} pz${oc.monto ? ` · ${new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(oc.monto)}` : ''}${oc.fechaEstimada && oc.abierta ? ` · entrega estimada ${fmtFecha(oc.fechaEstimada)}` : ''}`;

  const colsSku = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, render: (r) => <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{r.sku}{r.noPedido && <Pill tone="orange" size="xs" style={{ marginLeft: 6 }}>no pedido</Pill>}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 260, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
    { key: 'pedido', label: 'Pedido', render: (r) => fmtInt(r.pedido) },
    { key: 'facturado', label: 'Facturado', render: (r) => <span style={{ color: r.facturado >= r.pedido && r.pedido > 0 ? theme.green : theme.text }}>{fmtInt(r.facturado)}</span> },
    { key: 'folios', label: 'Factura', align: 'left', mono: true, render: (r) => r.folios.length ? r.folios.join(', ') : (oc.fuenteFacturado === 'manual' && r.facturado > 0 ? 'surtido manual' : '—') },
    { key: 'backorder', label: 'Backorder', render: (r) => r.backorder > 0 ? <span style={{ color: theme.orange, fontWeight: 600 }}>{fmtInt(r.backorder)}</span> : '0' },
    { key: 'stock', label: 'Stock hoy', render: (r) => r.backorder > 0 ? fmtInt(r.stock) : '—' },
    { key: 'cubre', label: 'Cubre', align: 'left', render: (r) => r.backorder <= 0 ? <Pill tone="green" size="xs">Completo</Pill> : r.stock >= r.backorder ? <Pill tone="green" size="xs">Stock hoy</Pill> : r.cubre ? <Pill tone="blue" size="xs">PO {r.cubre.po || '—'} · {fmtFecha(r.cubre.eta)}</Pill> : <Pill tone="red" size="xs">Sin PO</Pill> },
  ];
  const colsEnv = [
    { key: 'numero_envio', label: '#', width: 30, render: (r) => r.numero_envio },
    { key: 'guia_rastreo', label: 'Guía', align: 'left', mono: true, maxWidth: 220, render: (r) => <span title={r.guia_rastreo || ''}>{r.guia_rastreo || '—'}</span> },
    { key: 'paqueteria', label: 'Paquetería', align: 'left', render: (r) => r.paqueteria || (r.metodo_envio === 'unidad_propia' ? 'Unidad propia' : '—') },
    { key: 'numero_factura', label: 'Factura', align: 'left', mono: true, render: (r) => r.numero_factura || '—' },
    { key: 'almacen_origen', label: 'Alm.', align: 'left', render: (r) => r.almacen_origen || '—' },
    { key: 'fechaEnvio', label: 'Envío', align: 'left', render: (r) => <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{fmtFecha(r.fechaEnvio)}<FuentePill fuente={r.fuenteEnvio} /></span> },
    { key: 'fechaEntrega', label: 'Recepción', align: 'left', render: (r) => <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{fmtFecha(r.fechaEntrega)}{r.fechaEntrega && <FuentePill fuente={r.fuenteEntrega} />}{r.persona_recibio ? <span style={{ color: theme.textMuted }}>· {r.persona_recibio}</span> : null}</span> },
    { key: 'desfase', label: 'Fuente · desfase', align: 'left', render: (r) => <span style={{ display: 'inline-flex', gap: 4, alignItems: 'center', flexWrap: 'wrap' }}><FuentePill fuente={r.fuente === 'erp' ? 'erp' : 'manual'} />{r.tieneGuiaErp && r.fuente !== 'erp' && <Pill tone="blue" size="xs">guía ERP ligada</Pill>}<Desfase e={r} puedeEditar={puedeEditar} /></span> },
    ...(puedeEditar ? [{ key: 'acc', label: '', width: 60, render: (r) => r.fuente === 'manual' ? <button type="button" onClick={(ev) => { ev.stopPropagation(); onEditarEnvio?.(r); }} style={btn(theme)}>editar</button> : null }] : []),
  ];

  return (
    <div style={{ padding: '12px 14px 14px', background: theme.mode === 'dark' ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.018)', fontFamily: TYPO.fontText }} onClick={(e) => e.stopPropagation()}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, marginBottom: 8 }}>{cabecera}</div>
      <Timeline oc={oc} />
      <p style={{ margin: '4px 0 10px', fontSize: 12, lineHeight: 1.5, color: theme.textMuted, maxWidth: 780 }}>{textoExplicativo(oc)}</p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        {oc.esCotizacion ? (
          <>
            {puedeEditar && oc.cotizacion?.estado !== 'perdida' && <Boton primario icon={Check} onClick={() => onConvertir?.(oc.cotizacion)}>Convertir en OC</Boton>}
            {puedeEditar && <Boton icon={Edit2} onClick={() => onEditarCotizacion?.(oc.cotizacion)}>Editar cotización</Boton>}
          </>
        ) : (
          <>
            {puedeEditar && <Boton primario={oc.etapa === 'facturada'} icon={Truck} onClick={() => onRegistrarEnvio?.(oc)}>Registrar envío{oc.envios.length ? '' : ' (manual)'}</Boton>}
            <Boton icon={Share2} onClick={compartirEstatus}>Compartir estatus</Boton>
            {puedeEditar && <Boton icon={Edit2} onClick={() => onEditarOC?.(oc)}>Editar OC</Boton>}
            {puedeEditar && <Boton icon={FileText} onClick={() => onCapturarFolios?.(oc)}>Capturar folios de factura</Boton>}
          </>
        )}
      </div>
      {!oc.esCotizacion && (
        <>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, margin: '0 0 6px' }}>
            SKUs de la OC · pedido vs facturado {oc.fuenteFacturado === 'erp' ? '(automático, ERP)' : oc.fuenteFacturado === 'manual' ? '(surtido capturado a mano)' : ''}
            {oc.folioPendientes.length > 0 && <Pill tone="orange" size="xs" style={{ marginLeft: 8 }}>folio{oc.folioPendientes.length > 1 ? 's' : ''} {oc.folioPendientes.join(', ')} aún no en ERP</Pill>}
          </div>
          <TablaCompacta columnas={colsSku} filas={oc.skusCalc} rowKey={(r) => r.sku} dense maxHeight={260} vacio="Sin SKUs capturados: edita la OC para agregarlos." />
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, margin: '12px 0 6px', display: 'flex', alignItems: 'center', gap: 8 }}>
            Envíos <ArrowRightLeft size={11} /> <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>manual gana; desfase cuando el ERP difiere más de {DESFASE_DIAS} d</span>
          </div>
          <TablaCompacta columnas={colsEnv} filas={oc.envios} dense maxHeight={200} vacio="Sin guía aún: el ERP la trae sola o regístrala a mano." />
          {oc.facturas.length > 0 && (
            <div style={{ marginTop: 10, fontSize: 11, color: theme.textMuted, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              Facturas: {oc.facturas.map((f) => <Pill key={f.folio} tone={f.cliente_key_erp && f.cliente_key_erp !== oc.cliente_key ? 'orange' : 'gray'} size="xs" title={`${f.referencia ? `ref. ${f.referencia} · ` : ''}ligada por ${f.ligada_por}${f.cliente_key_erp && f.cliente_key_erp !== oc.cliente_key ? ` · en el ERP es de ${nombreCliente(f.cliente_key_erp)}` : ''}`}>{f.folio} · {fmtFecha(f.fecha)} · {fmtInt(f.piezas)} pz · {f.ligada_por}{f.cliente_key_erp && f.cliente_key_erp !== oc.cliente_key ? ` · ERP: ${nombreCliente(f.cliente_key_erp)}` : ''}</Pill>)}
              <span>· fill {fmtPct(oc.fill)}</span>
            </div>
          )}
        </>
      )}
      {oc.notas && <div style={{ marginTop: 10, fontSize: 11.5, color: theme.textMuted }}>Notas: {oc.notas}</div>}
    </div>
  );
}
