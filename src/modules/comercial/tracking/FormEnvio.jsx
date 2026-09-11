// Registrar / editar envío manual (HojaLateral): paquetería, guía, almacén, factura, fecha de envío, fecha de entrega, quién recibió.
// Si después llega la guía del ERP para la misma OC/factura, se liga sola y el drill muestra el desfase.
import React, { useEffect, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Boton, Pill, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { PAQUETERIAS, ALMACENES, isoDia, nombreCliente, fmtFecha } from './textos';
import { guardarEnvio } from './datos';
import { Campo, Input, Select, TextArea, Fila2, Nota } from './ui';

const aIso = (d) => (d ? new Date(`${d}T12:00:00`).toISOString() : null);

export default function FormEnvio({ abierto, onClose, oc, envio = null, onGuardado }) {
  const { theme } = useTheme();
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setF(envio
      ? { id: envio.id, paqueteria: envio.paqueteria || (envio.metodo_envio === 'unidad_propia' ? 'Unidad propia' : ''), guia_rastreo: envio.guia_rastreo || '', almacen_origen: envio.almacen_origen || '', numero_factura: envio.numero_factura || '', fecha_surtida: isoDia(envio.fecha_surtida), fecha_entregada: isoDia(envio.fecha_entregada), persona_recibio: envio.persona_recibio || '', notas: envio.notas || '' }
      : { paqueteria: '', guia_rastreo: '', almacen_origen: '', numero_factura: oc?.facturas?.[0]?.folio || '', fecha_surtida: isoDia(new Date()), fecha_entregada: '', persona_recibio: '', notas: '' });
  }, [abierto, envio, oc]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valido = f.fecha_surtida || f.fecha_entregada;
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
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} titulo={envio ? `Editar envío ${envio.numero_envio}` : 'Registrar envío'} sub={`OC ${oc.numero_oc_cliente} · ${nombreCliente(oc.cliente_key)} · captura manual`} ancho={480}
      acciones={<Boton primario onClick={guardar} disabled={!valido || saving}>{saving ? 'Guardando…' : 'Guardar'}</Boton>}>
      {envio?.guia_erp_id && <Nota tone="blue">Este envío ya tiene guía del ERP ligada (envío {fmtFecha(envio.fecha_envio_erp)}{envio.fecha_entrega_erp ? ` · recepción ${fmtFecha(envio.fecha_entrega_erp)}` : ''}). Lo manual gana; el desfase se elige en el drill.</Nota>}
      <Fila2>
        <Campo label="Paquetería"><Select value={f.paqueteria} onChange={(v) => set('paqueteria', v)} placeholder="Elegir…" opciones={PAQUETERIAS} /></Campo>
        <Campo label="Almacén de salida"><Select value={f.almacen_origen} onChange={(v) => set('almacen_origen', v)} placeholder="—" opciones={ALMACENES} /></Campo>
      </Fila2>
      <Fila2>
        <Campo label="Guía de rastreo"><Input value={f.guia_rastreo} onChange={(v) => set('guia_rastreo', v)} mono placeholder="781L00181820" /></Campo>
        <Campo label="Factura" sub="folio del ERP, si se sabe"><Input value={f.numero_factura} onChange={(v) => set('numero_factura', v)} mono placeholder="A10381203" list={`folios-${oc.id}`} /></Campo>
      </Fila2>
      <datalist id={`folios-${oc.id}`}>{(oc.facturas || []).map((x) => <option key={x.folio} value={x.folio} />)}</datalist>
      <Fila2>
        <Campo label="Fecha de envío"><Input type="date" value={f.fecha_surtida} onChange={(v) => set('fecha_surtida', v)} /></Campo>
        <Campo label="Fecha de entrega" sub="cuando el cliente recibe"><Input type="date" value={f.fecha_entregada} onChange={(v) => set('fecha_entregada', v)} /></Campo>
      </Fila2>
      <Campo label="Quién recibió"><Input value={f.persona_recibio} onChange={(v) => set('persona_recibio', v)} placeholder="Nombre en el acuse" /></Campo>
      <Campo label="Notas"><TextArea value={f.notas} onChange={(v) => set('notas', v)} filas={2} /></Campo>
      <div style={{ fontSize: 11, color: theme.textMuted, display: 'flex', gap: 6, alignItems: 'center' }}><Pill tone="gray" size="xs">Karolina</Pill> Si el puente trae después la guía del ERP para esta OC o factura, se cuelga de este envío y se muestra el desfase.</div>
    </HojaLateral>
  );
}
