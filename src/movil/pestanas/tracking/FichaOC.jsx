// Ficha de una OC en el celular (push desde la lista o desde una alerta de tracking con meta.oc_id).
//   Hero (pedido · facturado · backorder) → recorrido por etapas con su fuente (Karolina / ERP) → acciones
//   → SKUs (pedido vs facturado vs backorder, con "Cubre") → facturas ligadas con sus partidas → envíos.
// Todo lo calculado viene de tracking/calculo.js (calcularTodo) y el texto de WhatsApp de tracking/textos.js.
import React, { useMemo, useState } from 'react';
import { Truck, Share2, Edit2, FileText, ChevronRight, PackageX, Check, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { compartir } from '../../../lib/whatsapp';
import { Cargando } from '../../../components/kit';
import { useTrackingDatos, elegirFechaEnvio } from '../../../modules/comercial/tracking/datos';
import { calcularTodo } from '../../../modules/comercial/tracking/calculo';
import {
  ETAPA_LABEL, ESTADO_COT_LABEL, fmtInt, fmtFecha, fmtFechaAnio, fmtPct, fmtMoney, nombreCliente,
  textoEstatusOC, textoExplicativo, DESFASE_DIAS,
} from '../../../modules/comercial/tracking/textos';
import { useNav } from '../../nav';
import { HeroM, Cabecera, TituloGrande, ListaAgrupada, Fila, BotonGrande, Pill, Vacio, toast } from '../../piezas';
import { MONO } from '../../util';
import { EtapaPill, FuentePill, Avance } from './piezas';
import { HojaEnvio, HojaOC, HojaCotizacion } from './hojas';

const PROPIOS = new Set(['digitalife', 'pcel', 'dicotech']);

export default function FichaOC({ ocId }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav?.perfil;
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'ordenes_compra');
  const { data, isLoading, error } = useTrackingDatos();
  const [hoja, setHoja] = useState(null);      // { tipo: 'envio'|'oc'|'folios'|'cotizacion'|'convertir', envio? }
  const [verPartidas, setVerPartidas] = useState(null);

  const hoy = useMemo(() => new Date(), [data?.cargadoAt]);
  const oc = useMemo(() => (data ? calcularTodo(data, hoy).find((r) => r.id === ocId) || null : null), [data, hoy, ocId]);

  if (isLoading) return (<><Cabecera onVolver={nav.pop} /><Cargando pantalla="movilTrackingOC" /></>);
  if (error) return (<><Cabecera onVolver={nav.pop} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar la OC" sub={String(error.message || error)} /></>);
  if (!oc) return (<><Cabecera onVolver={nav.pop} /><Vacio icon={PackageX} color={theme.textMuted} titulo="La OC ya no existe" sub="Puede haberse borrado o cambiado de número." /></>);

  const compartirEstatus = async () => {
    const r = await compartir(textoEstatusOC(oc), { titulo: `Estatus OC ${oc.numero_oc_cliente}` });
    if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…');
  };
  const elegir = async (envio, cual) => {
    try { await elegirFechaEnvio(envio.id, cual); toast.ok(`Fecha ${cual === 'erp' ? 'del ERP' : 'manual'} elegida`); }
    catch (e) { toast.error(e.message); }
  };

  const stats = oc.esCotizacion
    ? [{ k: 'Piezas', v: fmtInt(oc.pedido) }, { k: 'Monto', v: oc.monto ? fmtMoney(oc.monto) : '—' }, { k: 'Días', v: oc.diasEnEtapa != null ? `${Math.round(oc.diasEnEtapa)} d` : '—' }]
    : [
      { k: 'Pedido', v: fmtInt(oc.pedido), sub: `fill ${fmtPct(oc.fill)}` },
      { k: 'Facturado', v: fmtInt(oc.facturado), sub: oc.facturas.length ? `${oc.facturas.length} factura${oc.facturas.length === 1 ? '' : 's'}` : 'sin factura' },
      { k: 'Backorder', v: fmtInt(oc.backorder), sub: oc.backorder ? `${oc.backorderSkus.length} SKU` : 'completo', color: oc.backorder ? theme.orange : undefined },
    ];

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo={`${oc.esCotizacion ? '' : 'OC '}${oc.numero_oc_cliente}`}
        sub={<>
          <span>{nombreCliente(oc.cliente_key)}</span>
          <EtapaPill oc={oc} />
          {oc.detenida && <Pill tone="red" size="xs" dot>{Math.round(oc.diasEnEtapa)} d detenida</Pill>}
          {oc.fecha_recibida && <span>· recibida {fmtFechaAnio(oc.fecha_recibida)}</span>}
        </>} />

      <HeroM eyebrow={oc.abierta ? 'Abierta' : 'Cerrada'} frase={oc.esCotizacion ? (ESTADO_COT_LABEL[oc.cotizacion?.estado] || 'Cotización') : `${fmtInt(oc.facturado)} de ${fmtInt(oc.pedido)} pz facturadas`}
        sub={textoExplicativo(oc)} stats={stats} />

      <div style={{ padding: '12px 16px 4px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {oc.esCotizacion ? (
          <>
            {puedeEditar && oc.cotizacion?.estado !== 'perdida' && <BotonGrande primario icon={Check} onClick={() => setHoja({ tipo: 'convertir' })}>Convertir en OC</BotonGrande>}
            {puedeEditar && <BotonGrande icon={Edit2} onClick={() => setHoja({ tipo: 'cotizacion' })}>Editar cotización</BotonGrande>}
          </>
        ) : (
          <>
            {puedeEditar && <BotonGrande primario={oc.etapa === 'facturada'} icon={Truck} onClick={() => setHoja({ tipo: 'envio' })}>Registrar envío</BotonGrande>}
            <BotonGrande icon={Share2} onClick={compartirEstatus}>Compartir estatus</BotonGrande>
            {puedeEditar && <BotonGrande icon={FileText} onClick={() => setHoja({ tipo: 'folios' })}>Capturar folios de factura</BotonGrande>}
            {puedeEditar && <BotonGrande icon={Edit2} onClick={() => setHoja({ tipo: 'oc' })}>Editar OC</BotonGrande>}
          </>
        )}
        {PROPIOS.has(oc.cliente_key) && (
          <BotonGrande icon={ChevronRight} onClick={() => nav.navegar({ clienteKey: oc.cliente_key, pagina: 'home' })}>Ir a {nombreCliente(oc.cliente_key)}</BotonGrande>
        )}
      </div>

      <ListaAgrupada titulo="Recorrido" style={{ marginTop: 16 }}
        pie={oc.fechaEstimada && oc.abierta ? `Entrega estimada ${fmtFecha(oc.fechaEstimada)}.` : null}
        accion={<Avance oc={oc} ancho={72} />}>
        {oc.timeline.map((t) => (
          <Fila key={t.etapa} chevron={false} alto={50}
            tono={t.estado === 'hecho' ? theme.green : t.estado === 'parcial' ? theme.orange : t.estado === 'perdida' ? theme.red : theme.border}
            titulo={<span style={{ color: t.fecha ? theme.text : theme.textMuted }}>{ETAPA_LABEL[t.etapa]}{t.estado === 'parcial' ? ' parcial' : ''}</span>}
            sub={t.nota || (t.estado === 'saltada' ? 'sin fecha' : null)}
            valor={t.fecha ? fmtFecha(t.fecha) : '—'}
            trailing={t.fecha ? <FuentePill fuente={t.fuente} /> : null} />
        ))}
      </ListaAgrupada>

      {!oc.esCotizacion && (
        <ListaAgrupada titulo="SKUs" meta={oc.skusCalc.length} style={{ marginTop: 16 }}
          pie={oc.folioPendientes.length ? `Folio${oc.folioPendientes.length > 1 ? 's' : ''} ${oc.folioPendientes.join(', ')} aún no aparece en el ERP.` : null}>
          {oc.skusCalc.length ? oc.skusCalc.map((s) => (
            <Fila key={s.sku} chevron={false} alto={58}
              titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: MONO, fontWeight: 600 }}>{s.sku}</span>
                {s.noPedido && <Pill tone="orange" size="xs">no pedido</Pill>}
              </span>}
              sub={[s.descripcion || null, s.folios.length ? `factura ${s.folios.join(', ')}` : null].filter(Boolean).join(' · ') || null}
              valor={<span style={{ color: s.completo ? theme.green : theme.text }}>{fmtInt(s.facturado)}/{fmtInt(s.pedido)}</span>}
              valorSub={s.backorder > 0 ? `faltan ${fmtInt(s.backorder)}` : null}
              pill={s.backorder <= 0 ? { tone: 'green', label: 'Completo' } : s.conStock ? { tone: 'green', label: 'Stock hoy' } : s.cubre ? { tone: 'blue', label: `PO ${s.cubre.po || '—'} · ${fmtFecha(s.cubre.eta)}` } : { tone: 'red', label: 'Sin PO' }} />
          )) : <Fila chevron={false} titulo="Sin SKUs capturados" sub="Edita la OC para agregarlos o captura el folio de la factura." />}
        </ListaAgrupada>
      )}

      {!oc.esCotizacion && oc.facturas.length > 0 && (
        <ListaAgrupada titulo="Facturas" meta={oc.facturas.length} style={{ marginTop: 16 }}>
          {oc.facturas.flatMap((f) => {
            const abierta = verPartidas === f.folio;
            const filas = [
              <Fila key={f.folio} alto={54}
                titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{f.folio}</span>}
                sub={[fmtFecha(f.fecha), `${fmtInt(f.piezas)} pz`, `ligada por ${f.ligada_por}`, f.referencia ? `ref. ${f.referencia}` : null].filter(Boolean).join(' · ')}
                valor={fmtMoney(f.monto)} chevron={false}
                trailing={<Pill tone={f.fuente === 'erp' ? 'blue' : 'gray'} size="xs">{f.fuente === 'erp' ? 'ERP' : 'manual'}</Pill>}
                onClick={() => setVerPartidas(abierta ? null : f.folio)} />,
            ];
            if (abierta) for (const p of f.skus || []) filas.push(
              <Fila key={`${f.folio}-${p.sku}`} chevron={false} alto={44} style={{ paddingLeft: 24, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}
                titulo={<span style={{ fontFamily: MONO, fontSize: 13 }}>{p.sku}</span>} sub={p.descripcion}
                valor={`${fmtInt(p.piezas)} pz`} valorSub={p.piezas ? fmtMoney(Number(p.monto) / Number(p.piezas)) : null} />,
            );
            return filas;
          })}
        </ListaAgrupada>
      )}

      {!oc.esCotizacion && (
        <ListaAgrupada titulo="Envíos" meta={oc.envios.length || null} style={{ marginTop: 16, marginBottom: 24 }}
          pie={`Lo manual gana; si el ERP difiere más de ${DESFASE_DIAS} d se muestra el desfase para elegir cuál vale.`}>
          {oc.envios.length ? oc.envios.map((e) => (
            <Fila key={e.id} alto={62} chevron={puedeEditar && e.fuente === 'manual'}
              onClick={puedeEditar && e.fuente === 'manual' ? () => setHoja({ tipo: 'envio', envio: e }) : undefined}
              titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: MONO, fontWeight: 600 }}>{e.guia_rastreo || `Envío ${e.numero_envio}`}</span>
                <FuentePill fuente={e.fuente === 'erp' ? 'erp' : 'manual'} />
                {e.conDesfase && <Pill tone="orange" size="xs">desfase {Math.round(e.desfase)} d</Pill>}
              </span>}
              sub={[e.paqueteria || (e.metodo_envio === 'unidad_propia' ? 'Unidad propia' : null), e.fechaEnvio ? `enviado ${fmtFecha(e.fechaEnvio)}` : null, e.fechaEntrega ? `recibido ${fmtFecha(e.fechaEntrega)}${e.persona_recibio ? ` · ${e.persona_recibio}` : ''}` : 'sin recepción'].filter(Boolean).join(' · ')}
              trailing={e.conDesfase && puedeEditar ? (
                <span style={{ display: 'inline-flex', gap: 6, flexShrink: 0 }}>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); elegir(e, 'manual'); }} style={btn(theme)}>manual</button>
                  <button type="button" onClick={(ev) => { ev.stopPropagation(); elegir(e, 'erp'); }} style={btn(theme)}>ERP</button>
                </span>) : null} />
          )) : <Fila chevron={false} titulo="Sin guía todavía" sub="El ERP la trae sola, o regístrala con «Registrar envío»." />}
        </ListaAgrupada>
      )}

      {oc.notas && <div style={{ padding: '0 20px 24px', fontSize: 12.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>Notas: {oc.notas}</div>}

      <HojaEnvio abierto={hoja?.tipo === 'envio'} onClose={() => setHoja(null)} oc={oc} envio={hoja?.envio || null} />
      <HojaOC abierto={hoja?.tipo === 'oc' || hoja?.tipo === 'folios' || hoja?.tipo === 'convertir'} onClose={() => setHoja(null)}
        modo={hoja?.tipo === 'folios' ? 'folios' : hoja?.tipo === 'convertir' ? 'convertir' : 'editar'}
        oc={hoja?.tipo === 'convertir' ? null : oc} cotizacion={hoja?.tipo === 'convertir' ? oc.cotizacion : null}
        roadmap={data?.roadmapRows || []} roadmapMap={data?.roadmap} erpFacturas={data?.erpFacturas || []} email={perfil?.email || null} />
      <HojaCotizacion abierto={hoja?.tipo === 'cotizacion'} onClose={() => setHoja(null)} cotizacion={oc.cotizacion} email={perfil?.email || null}
        onConvertir={() => setHoja({ tipo: 'convertir' })} />
    </>
  );
}

const btn = (theme) => ({ border: `1px solid ${theme.border}`, background: theme.surface, color: theme.accent, borderRadius: 999, padding: '6px 10px', fontSize: 12, fontFamily: TYPO.fontDisplay, fontWeight: 600, cursor: 'pointer' });
