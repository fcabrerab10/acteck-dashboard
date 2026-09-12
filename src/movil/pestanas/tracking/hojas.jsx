// Tracking móvil · hojas de captura (HojaM desde abajo). Escriben con las MISMAS funciones que la web
// (modules/comercial/tracking/datos.js: guardarOC, guardarEnvio, guardarCotizacion, ligarFacturaAOC,
// crearOCDesdeFactura) y leen el correo con el MISMO parser (parserCorreoOC.js). Aquí no hay reglas de negocio.
import React, { useEffect, useMemo, useState } from 'react';
import { Trash2, Wand2, ClipboardPaste, Check } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { toast } from '../../../components/kit';
import { HojaM, BotonGrande, Segmented, Pill, Fila, ListaAgrupada, Vacio } from '../../piezas';
import { CampoM } from '../agenda/comun';
import { MONO } from '../../util';
import {
  CLIENTES, PAQUETERIAS, ALMACENES, MOTIVOS_PERDIDA, ESTADO_COT_LABEL, isoDia, nombreCliente, fmtInt, fmtMoney, fmtFecha,
} from '../../../modules/comercial/tracking/textos';
import { parsearCorreoOC } from '../../../modules/comercial/tracking/parserCorreoOC';
import { guardarOC, guardarEnvio, guardarCotizacion, ligarFacturaAOC, crearOCDesdeFactura } from '../../../modules/comercial/tracking/datos';
import { candidatasParaFactura } from '../../../modules/comercial/tracking/calculo';
import { CampoF, SelectM, FechaM, ChipsFolios, BuscadorSkuM, NotaM } from './piezas';

const aIso = (d) => (d ? new Date(`${d}T12:00:00`).toISOString() : null);
const normFolio = (f) => String(f || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const cuerpo = { padding: '4px 16px 8px' };

function BotonGuardar({ onClick, disabled, saving, label = 'Guardar' }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || saving}
      style={{ border: 0, background: 'transparent', color: disabled || saving ? '#8E8E93' : '#007AFF', fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, padding: '6px 2px', cursor: disabled ? 'default' : 'pointer' }}>
      {saving ? 'Guardando…' : label}
    </button>
  );
}

// ─────────────────────────── OC (nueva · editar · pegar correo · folios · convertir) ───────────────────────────
const vacia = (cliente = '') => ({ id: null, cliente_key: cliente, numero_oc_cliente: '', fecha_recibida: isoDia(new Date()), facturas: [], notas: '', fuente: 'manual', cotizacion_id: null });

/** Facturas del ERP de los folios capturados, con sus partidas (igual que la web, en lista táctil). */
function FacturasPreviewM({ folios, erpFacturas, onUsarComoPedido }) {
  const { theme } = useTheme();
  const filas = useMemo(() => {
    const idx = new Map();
    for (const f of erpFacturas || []) idx.set(normFolio(f.folio), f);
    return (folios || []).map((folio) => ({ folio, f: idx.get(normFolio(folio)) || null }));
  }, [folios, erpFacturas]);
  if (!filas.length) return null;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
      {filas.map(({ folio, f }) => (
        <div key={folio} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', background: theme.surface }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '9px 12px', borderBottom: f ? `1px solid ${theme.border}` : 0 }}>
            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 13 }}>{folio}</span>
            {f ? <>
              <Pill tone="green" size="xs">ERP</Pill>
              <span style={{ fontSize: 12, color: theme.textMuted }}>{fmtFecha(f.fecha)} · {fmtInt(f.n_partidas)} SKU · {fmtInt(f.piezas)} pz</span>
              <span style={{ marginLeft: 'auto', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13 }}>{fmtMoney(f.monto)}</span>
            </> : <span style={{ fontSize: 12, color: theme.textMuted }}>aún no está en el ERP · se ligará sola</span>}
          </div>
          {f && (
            <>
              <div style={{ maxHeight: 190, overflowY: 'auto' }}>
                {(f.partidas || []).map((p, i) => (
                  <div key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 12px', borderTop: i ? `1px solid ${theme.border}` : 0, fontSize: 12.5 }}>
                    <span style={{ fontFamily: MONO, fontWeight: 600, minWidth: 84 }}>{p.sku}</span>
                    <span style={{ flex: 1, minWidth: 0, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.descripcion}</span>
                    <span style={{ fontFamily: MONO, textAlign: 'right' }}>{fmtInt(p.piezas)} pz</span>
                    <span style={{ fontFamily: MONO, textAlign: 'right', color: theme.textMuted, minWidth: 64 }}>{fmtMoney(p.monto)}</span>
                  </div>
                ))}
              </div>
              {onUsarComoPedido && <div style={{ padding: '8px 12px 10px' }}><BotonGrande onClick={() => onUsarComoPedido(f)} style={{ height: 42 }}>Usar como pedido</BotonGrande></div>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}

export function HojaOC({ abierto, onClose, modo = 'nueva', oc = null, cotizacion = null, roadmap = [], roadmapMap, erpFacturas = [], email, onGuardado }) {
  const { theme } = useTheme();
  const [form, setForm] = useState(vacia());
  const [skus, setSkus] = useState([]);
  const [texto, setTexto] = useState('');
  const [avisos, setAvisos] = useState([]);
  const [leido, setLeido] = useState(false);
  const [saving, setSaving] = useState(false);
  const soloFolios = modo === 'folios';

  useEffect(() => {
    if (!abierto) return;
    setTexto(''); setAvisos([]); setLeido(false); setSaving(false);
    if (oc) {
      setForm({ id: oc.id, cliente_key: oc.cliente_key, numero_oc_cliente: oc.numero_oc_cliente || '', fecha_recibida: isoDia(oc.fecha_recibida), facturas: [...(oc.facturas || []).map((f) => (typeof f === 'string' ? f : f.folio)), ...(oc.folioPendientes || [])].filter((v, i, a) => a.indexOf(v) === i), notas: oc.notas || '', fuente: oc.fuente || 'manual', cotizacion_id: oc.cotizacion_id || null });
      setSkus((oc.skusCalc || []).filter((s) => !s.noPedido).map((s) => ({ sku: s.sku, descripcion: s.descripcion, cantidad_ordenada: s.pedido, precio_unitario: s.precio || '' })));
    } else if (cotizacion) {
      setForm({ ...vacia(cotizacion.cliente_key), notas: cotizacion.notas || '', fuente: 'cotizacion', cotizacion_id: cotizacion.id });
      setSkus([]);
    } else { setForm(vacia()); setSkus([]); }
  }, [abierto, oc, cotizacion]);

  const set = (k, v) => setForm((p) => ({ ...p, [k]: v }));
  const setSku = (i, k, v) => setSkus((p) => p.map((s, j) => (j === i ? { ...s, [k]: v } : s)));
  const addSku = (r) => setSkus((p) => (p.some((s) => s.sku === r.sku) ? p : [...p, { sku: r.sku, descripcion: r.descripcion || roadmapMap?.get(r.sku)?.descripcion || '', cantidad_ordenada: r.cantidad || '', precio_unitario: r.precio || '' }]));

  const leer = () => {
    const r = parsearCorreoOC(texto);
    setAvisos(r.avisos); setLeido(true);
    setForm((p) => ({ ...p, cliente_key: r.cliente_key || p.cliente_key, numero_oc_cliente: r.numero_oc || p.numero_oc_cliente, fecha_recibida: r.fecha || p.fecha_recibida, fuente: 'correo', notas: r.asunto ? `Correo: ${r.asunto}` : p.notas }));
    setSkus(r.lineas.map((l) => ({ sku: l.sku, descripcion: l.descripcion || roadmapMap?.get(l.sku)?.descripcion || '', cantidad_ordenada: l.cantidad || '', precio_unitario: l.precio || '' })));
  };

  const totalPz = skus.reduce((s, x) => s + (Number(x.cantidad_ordenada) || 0), 0);
  const valido = !!form.cliente_key && !!String(form.numero_oc_cliente).trim() && (soloFolios || !!form.fecha_recibida) && (soloFolios || skus.every((s) => s.sku && Number(s.cantidad_ordenada) > 0));

  const guardar = async () => {
    if (!valido) return;
    setSaving(true);
    try {
      const id = await guardarOC(
        { ...form, fecha_recibida: form.fecha_recibida ? aIso(form.fecha_recibida) : null },
        soloFolios ? (oc?.skusCalc || []).filter((s) => !s.noPedido).map((s) => ({ sku: s.sku, cantidad_ordenada: s.pedido, precio_unitario: s.precio })) : skus,
        email,
      );
      toast.ok(oc ? 'OC actualizada' : cotizacion ? 'Cotización convertida en OC' : 'OC registrada');
      onGuardado?.(id); onClose?.();
    } catch (e) { toast.error(`No se pudo guardar: ${e.message}`); }
    finally { setSaving(false); }
  };

  const titulo = soloFolios ? 'Folios de factura' : modo === 'pegar' ? 'Pegar correo' : cotizacion ? 'Convertir en OC' : oc ? 'Editar OC' : 'Registrar OC';
  const sub = soloFolios ? `OC ${oc?.numero_oc_cliente} · se liga sola con el ERP`
    : modo === 'pegar' ? 'Pega el correo y toca «Leer»: revisa la vista previa'
    : cotizacion ? `Cotización ${cotizacion.folio || ''} · ${nombreCliente(cotizacion.cliente_key)}`
    : 'Sólo la OC: facturas y guías llegan del ERP';

  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={titulo} sub={sub} alto="92vh"
      acciones={<BotonGuardar onClick={guardar} disabled={!valido} saving={saving} />}>
      <div style={cuerpo}>
        {modo === 'pegar' && (
          <>
            <CampoF label="Texto del correo">
              <CampoM multiline value={texto} onChange={setTexto} placeholder={'Asunto: Orden de compra 4500218\nAC-943178 Mouse … 200 pz'} style={{ minHeight: 130, fontFamily: MONO, fontSize: 14 }} />
            </CampoF>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <BotonGrande primario icon={Wand2} onClick={leer} disabled={!texto.trim()}>Leer</BotonGrande>
              <BotonGrande icon={ClipboardPaste} onClick={async () => { try { setTexto(await navigator.clipboard.readText()); } catch { toast.info('Pega el texto en el cuadro'); } }}>Pegar</BotonGrande>
            </div>
            {leido && avisos.length > 0 && <NotaM tone="orange">{avisos.map((a, i) => <div key={i}>• {a}</div>)}</NotaM>}
            {leido && !avisos.length && <NotaM tone="green">Todo se leyó bien: revisa y guarda.</NotaM>}
            {!leido && <NotaM>Reconoce «OC-48211», «Orden de compra: 4500218», fechas y líneas «AC-943178 … 200 pz». Lo que no lea se corrige aquí mismo.</NotaM>}
          </>
        )}
        {(modo !== 'pegar' || leido) && (
          <>
            {!soloFolios && (
              <>
                <CampoF label="Cliente"><SelectM value={form.cliente_key} onChange={(v) => set('cliente_key', v)} placeholder="Elegir…" opciones={CLIENTES.map((c) => ({ id: c.key, label: c.nombre }))} /></CampoF>
                <CampoF label="Número de OC" sub="como lo escribe el cliente"><CampoM value={form.numero_oc_cliente} onChange={(v) => set('numero_oc_cliente', v)} placeholder="4500218 · OC-48211" style={{ fontFamily: MONO }} /></CampoF>
                <CampoF label="Fecha recibida"><FechaM value={form.fecha_recibida} onChange={(v) => set('fecha_recibida', v)} /></CampoF>
              </>
            )}
            <CampoF label="Folios de factura" sub="opcional">
              <ChipsFolios items={form.facturas} onChange={(v) => set('facturas', v)} />
              <FacturasPreviewM folios={form.facturas} erpFacturas={erpFacturas}
                onUsarComoPedido={soloFolios ? null : (f) => {
                  setSkus((p) => {
                    const m = new Map(p.map((s) => [s.sku, s]));
                    for (const x of f.partidas || []) {
                      const prev = m.get(x.sku);
                      const precio = x.piezas ? Math.round((Number(x.monto) / Number(x.piezas)) * 100) / 100 : '';
                      if (prev) m.set(x.sku, { ...prev, cantidad_ordenada: (Number(prev.cantidad_ordenada) || 0) + (Number(x.piezas) || 0), precio_unitario: prev.precio_unitario || precio });
                      else m.set(x.sku, { sku: x.sku, descripcion: x.descripcion || roadmapMap?.get(x.sku)?.descripcion || '', cantidad_ordenada: Number(x.piezas) || 0, precio_unitario: precio });
                    }
                    return [...m.values()];
                  });
                  toast.ok(`${fmtInt(f.n_partidas)} partidas de ${f.folio} agregadas`);
                }} />
            </CampoF>
            {!soloFolios && (
              <>
                <CampoF label="SKUs del pedido" sub={skus.length ? `${skus.length} SKU · ${fmtInt(totalPz)} pz` : 'busca en el roadmap o dicta'}>
                  <BuscadorSkuM roadmap={roadmap} onElegir={addSku} />
                  {skus.length > 0 && (
                    <div style={{ marginTop: 10, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden', background: theme.surface }}>
                      {skus.map((s, i) => (
                        <div key={s.sku} style={{ padding: '9px 12px', borderTop: i ? `1px solid ${theme.border}` : 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: MONO, fontWeight: 600, fontSize: 13 }}>{s.sku}</span>
                            <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.descripcion}</span>
                            <button type="button" onClick={() => setSkus((p) => p.filter((_, j) => j !== i))} aria-label="Quitar"
                              style={{ width: 34, height: 34, border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Trash2 size={15} /></button>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 6 }}>
                            <CampoM type="number" value={s.cantidad_ordenada} onChange={(v) => setSku(i, 'cantidad_ordenada', v)} placeholder="Piezas" style={{ fontFamily: MONO, minHeight: 40 }} />
                            <CampoM type="number" value={s.precio_unitario} onChange={(v) => setSku(i, 'precio_unitario', v)} placeholder="Precio" style={{ fontFamily: MONO, minHeight: 40 }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CampoF>
                <CampoF label="Notas"><CampoM multiline value={form.notas} onChange={(v) => set('notas', v)} placeholder="Condiciones, contacto, urgencia…" /></CampoF>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', fontSize: 12, color: theme.textMuted, marginBottom: 10 }}>
                  <Pill tone="gray" size="xs">fuente: {form.fuente}</Pill>
                  {form.cotizacion_id && <Pill tone="purple" size="xs">desde cotización</Pill>}
                  {!skus.length && <span>Sin SKUs también se guarda: el pedido se llena con las partidas de la factura.</span>}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </HojaM>
  );
}

// ─────────────────────────── Envío ───────────────────────────
export function HojaEnvio({ abierto, onClose, oc, envio = null, onGuardado }) {
  const { theme } = useTheme();
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setSaving(false);
    setF(envio
      ? { id: envio.id, paqueteria: envio.paqueteria || (envio.metodo_envio === 'unidad_propia' ? 'Unidad propia' : ''), guia_rastreo: envio.guia_rastreo || '', almacen_origen: envio.almacen_origen || '', numero_factura: envio.numero_factura || '', fecha_surtida: isoDia(envio.fecha_surtida), fecha_entregada: isoDia(envio.fecha_entregada), persona_recibio: envio.persona_recibio || '', notas: envio.notas || '' }
      : { paqueteria: '', guia_rastreo: '', almacen_origen: '', numero_factura: oc?.facturas?.[0]?.folio || '', fecha_surtida: isoDia(new Date()), fecha_entregada: '', persona_recibio: '', notas: '' });
  }, [abierto, envio, oc]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valido = !!(f.fecha_surtida || f.fecha_entregada);
  const guardar = async () => {
    setSaving(true);
    try {
      await guardarEnvio({ ...f, oc_id: oc.id, fecha_surtida: aIso(f.fecha_surtida), fecha_entregada: aIso(f.fecha_entregada) });
      toast.ok(envio ? 'Envío actualizado' : 'Envío registrado'); onGuardado?.(); onClose?.();
    } catch (e) { toast.error(`No se pudo guardar: ${e.message}`); }
    finally { setSaving(false); }
  };
  if (!oc) return null;
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={envio ? `Editar envío ${envio.numero_envio}` : 'Registrar envío'}
      sub={`OC ${oc.numero_oc_cliente} · ${nombreCliente(oc.cliente_key)}`} alto="90vh"
      acciones={<BotonGuardar onClick={guardar} disabled={!valido} saving={saving} />}>
      <div style={cuerpo}>
        {envio?.guia_erp_id && <NotaM tone="blue">Ya hay guía del ERP ligada (envío {fmtFecha(envio.fecha_envio_erp)}). Lo manual gana; el desfase se elige en la ficha.</NotaM>}
        <CampoF label="Paquetería"><SelectM value={f.paqueteria} onChange={(v) => set('paqueteria', v)} placeholder="Elegir…" opciones={PAQUETERIAS} /></CampoF>
        <CampoF label="Guía de rastreo"><CampoM value={f.guia_rastreo} onChange={(v) => set('guia_rastreo', v)} placeholder="781L00181820" style={{ fontFamily: MONO }} /></CampoF>
        <CampoF label="Almacén de salida"><SelectM value={f.almacen_origen} onChange={(v) => set('almacen_origen', v)} placeholder="—" opciones={ALMACENES} /></CampoF>
        <CampoF label="Factura" sub="folio del ERP, si se sabe"><CampoM value={f.numero_factura} onChange={(v) => set('numero_factura', v)} placeholder="A10381203" style={{ fontFamily: MONO }} /></CampoF>
        <CampoF label="Fecha de envío"><FechaM value={f.fecha_surtida} onChange={(v) => set('fecha_surtida', v)} /></CampoF>
        <CampoF label="Fecha de entrega" sub="cuando el cliente recibe"><FechaM value={f.fecha_entregada} onChange={(v) => set('fecha_entregada', v)} /></CampoF>
        <CampoF label="Quién recibió"><CampoM value={f.persona_recibio} onChange={(v) => set('persona_recibio', v)} placeholder="Nombre en el acuse" /></CampoF>
        <CampoF label="Notas"><CampoM multiline value={f.notas} onChange={(v) => set('notas', v)} /></CampoF>
        <div style={{ fontSize: 12, color: theme.textMuted, paddingBottom: 8 }}>Si el puente trae después la guía del ERP, se cuelga de este envío y se muestra el desfase.</div>
      </div>
    </HojaM>
  );
}

// ─────────────────────────── Cotización ───────────────────────────
const folioSugerido = (d = new Date()) => `COT-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export function HojaCotizacion({ abierto, onClose, cotizacion = null, email, onGuardado, onConvertir }) {
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setSaving(false);
    setF(cotizacion
      ? { id: cotizacion.id, cliente_key: cotizacion.cliente_key, folio: cotizacion.folio || '', estado: cotizacion.estado, fecha_solicitada: isoDia(cotizacion.fecha_solicitada), fecha_enviada: isoDia(cotizacion.fecha_enviada), fecha_respuesta: isoDia(cotizacion.fecha_respuesta), motivo_perdida: cotizacion.motivo_perdida || '', monto: cotizacion.monto ?? '', piezas: cotizacion.piezas ?? '', notas: cotizacion.notas || '' }
      : { cliente_key: 'dicotech', folio: folioSugerido(), estado: 'solicitada', fecha_solicitada: isoDia(new Date()), fecha_enviada: '', fecha_respuesta: '', motivo_perdida: '', monto: '', piezas: '', notas: '' });
  }, [abierto, cotizacion]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valido = !!f.cliente_key && !!f.fecha_solicitada;
  const guardar = async () => {
    setSaving(true);
    try {
      const id = await guardarCotizacion({ ...f, fecha_solicitada: aIso(f.fecha_solicitada), fecha_enviada: aIso(f.fecha_enviada), fecha_respuesta: aIso(f.fecha_respuesta) }, email);
      toast.ok(cotizacion ? 'Cotización actualizada' : 'Cotización registrada'); onGuardado?.(id); onClose?.();
    } catch (e) { toast.error(`No se pudo guardar: ${e.message}`); }
    finally { setSaving(false); }
  };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={cotizacion ? 'Editar cotización' : 'Nueva cotización'} sub="Sólo si el cliente cotiza antes de la OC" alto="90vh"
      acciones={<BotonGuardar onClick={guardar} disabled={!valido} saving={saving} />}>
      <div style={cuerpo}>
        <CampoF label="Cliente"><SelectM value={f.cliente_key} onChange={(v) => set('cliente_key', v)} opciones={CLIENTES.map((c) => ({ id: c.key, label: c.nombre }))} /></CampoF>
        <CampoF label="Folio"><CampoM value={f.folio} onChange={(v) => set('folio', v)} style={{ fontFamily: MONO }} /></CampoF>
        <CampoF label="Estado">
          <Segmented size="md" value={f.estado} onChange={(v) => set('estado', v)} style={{ display: 'flex', width: '100%' }}
            options={['solicitada', 'enviada', 'aceptada', 'perdida'].map((e) => ({ id: e, label: ESTADO_COT_LABEL[e].replace('Cot. ', '') }))} />
        </CampoF>
        <CampoF label="Solicitada"><FechaM value={f.fecha_solicitada} onChange={(v) => set('fecha_solicitada', v)} /></CampoF>
        <CampoF label="Enviada"><FechaM value={f.fecha_enviada} onChange={(v) => set('fecha_enviada', v)} /></CampoF>
        <CampoF label="Respuesta"><FechaM value={f.fecha_respuesta} onChange={(v) => set('fecha_respuesta', v)} /></CampoF>
        {f.estado === 'perdida' && <CampoF label="Motivo de pérdida"><SelectM value={f.motivo_perdida} onChange={(v) => set('motivo_perdida', v)} placeholder="Elegir…" opciones={MOTIVOS_PERDIDA} /></CampoF>}
        <CampoF label="Piezas cotizadas"><CampoM type="number" value={f.piezas} onChange={(v) => set('piezas', v)} style={{ fontFamily: MONO }} /></CampoF>
        <CampoF label="Monto cotizado" sub="MXN"><CampoM type="number" value={f.monto} onChange={(v) => set('monto', v)} style={{ fontFamily: MONO }} /></CampoF>
        <CampoF label="Notas"><CampoM multiline value={f.notas} onChange={(v) => set('notas', v)} placeholder="Qué se cotizó, vigencia, contacto…" /></CampoF>
        {cotizacion && cotizacion.estado !== 'perdida' && !cotizacion.oc_id && onConvertir && (
          <div style={{ paddingBottom: 10 }}><BotonGrande icon={Check} onClick={() => { onClose?.(); onConvertir(cotizacion); }}>Convertir en OC</BotonGrande></div>
        )}
      </div>
    </HojaM>
  );
}

// ─────────────────────────── Factura sin OC: crear o ligar ───────────────────────────
export function HojaFactura({ abierto, onClose, factura, filas, email, onHecho }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(false);
  const cand = useMemo(() => (factura ? candidatasParaFactura(factura, filas).slice(0, 40) : []), [factura, filas]);
  if (!factura) return null;
  const crear = async () => {
    setBusy(true);
    try { const id = await crearOCDesdeFactura(factura, email); toast.ok(`OC creada desde ${factura.folio}`); onHecho?.(id); onClose?.(); }
    catch (e) { toast.error(`No se pudo crear: ${e.message}`); }
    finally { setBusy(false); }
  };
  const ligar = async (oc) => {
    setBusy(true);
    try { await ligarFacturaAOC(oc.id, [factura.folio], (oc.facturas || []).map((x) => x.folio).concat(oc.folioPendientes || [])); toast.ok(`${factura.folio} ligada a la OC ${oc.numero_oc_cliente}`); onHecho?.(oc.id); onClose?.(); }
    catch (e) { toast.error(`No se pudo ligar: ${e.message}`); }
    finally { setBusy(false); }
  };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={`Factura ${factura.folio}`}
      sub={`${nombreCliente(factura.cliente_key)} · ref. ${factura.referencia || '—'} · ${fmtInt(factura.piezas)} pz`} alto="86vh">
      <div style={{ padding: '4px 16px 10px' }}>
        <BotonGrande primario onClick={crear} disabled={busy}>Crear OC desde esta factura</BotonGrande>
        <div style={{ fontSize: 12, color: theme.textMuted, margin: '8px 2px 4px' }}>Usa las partidas de la factura como pedido. O ligala a una OC ya registrada:</div>
      </div>
      {cand.length ? (
        <ListaAgrupada titulo="OCs del cliente" meta={cand.length}>
          {cand.map((o) => (
            <Fila key={o.id} titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{o.numero_oc_cliente}</span>}
              sub={[o.fecha_recibida ? `rec. ${fmtFecha(o.fecha_recibida)}` : null, `${fmtInt(o.pedido)} pz`, o.backorder ? `backorder ${fmtInt(o.backorder)}` : null, o.parecido ? 'la referencia coincide' : null].filter(Boolean).join(' · ')}
              pill={{ tone: o.parecido ? 'green' : 'gray', label: o.parecido ? 'coincide' : (o.abierta ? 'abierta' : 'cerrada') }}
              onClick={busy ? undefined : () => ligar(o)} />
          ))}
        </ListaAgrupada>
      ) : <Vacio icon={null} titulo="Este cliente no tiene OCs registradas" sub="Usa «Crear OC desde esta factura»." />}
    </HojaM>
  );
}
