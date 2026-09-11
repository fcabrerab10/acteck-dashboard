// Cotización (Dicotech u otro cliente): solicitada → enviada → aceptada | perdida (motivo). Al aceptarse, "Convertir en OC" (FormOC).
import React, { useEffect, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { Boton, Segmented, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { CLIENTES, MOTIVOS_PERDIDA, isoDia, ESTADO_COT_LABEL } from './textos';
import { guardarCotizacion } from './datos';
import { Campo, Input, Select, TextArea, Fila2 } from './ui';

const aIso = (d) => (d ? new Date(`${d}T12:00:00`).toISOString() : null);
const folioSugerido = (d = new Date()) => `COT-${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function FormCotizacion({ abierto, onClose, cotizacion = null, email, onGuardado, onConvertir }) {
  const { theme } = useTheme();
  const [f, setF] = useState({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!abierto) return;
    setF(cotizacion
      ? { id: cotizacion.id, cliente_key: cotizacion.cliente_key, folio: cotizacion.folio || '', estado: cotizacion.estado, fecha_solicitada: isoDia(cotizacion.fecha_solicitada), fecha_enviada: isoDia(cotizacion.fecha_enviada), fecha_respuesta: isoDia(cotizacion.fecha_respuesta), motivo_perdida: cotizacion.motivo_perdida || '', monto: cotizacion.monto ?? '', piezas: cotizacion.piezas ?? '', notas: cotizacion.notas || '' }
      : { cliente_key: 'dicotech', folio: folioSugerido(), estado: 'solicitada', fecha_solicitada: isoDia(new Date()), fecha_enviada: '', fecha_respuesta: '', motivo_perdida: '', monto: '', piezas: '', notas: '' });
  }, [abierto, cotizacion]);
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  const valido = f.cliente_key && f.fecha_solicitada;
  const guardar = async () => {
    setSaving(true);
    try {
      const id = await guardarCotizacion({ ...f, fecha_solicitada: aIso(f.fecha_solicitada), fecha_enviada: aIso(f.fecha_enviada), fecha_respuesta: aIso(f.fecha_respuesta) }, email);
      toast.ok(cotizacion ? 'Cotización actualizada' : 'Cotización registrada'); onGuardado?.(id); onClose?.();
    } catch (e) { toast.error(`No se pudo guardar: ${e.message}`); }
    finally { setSaving(false); }
  };
  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} titulo={cotizacion ? 'Editar cotización' : 'Nueva cotización'} sub="Sólo si el cliente pide cotización antes de la OC (Dicotech). Al aceptarse, conviértela en OC." ancho={480}
      acciones={<Boton primario onClick={guardar} disabled={!valido || saving}>{saving ? 'Guardando…' : 'Guardar'}</Boton>}>
      <Fila2>
        <Campo label="Cliente"><Select value={f.cliente_key} onChange={(v) => set('cliente_key', v)} opciones={CLIENTES.map((c) => ({ id: c.key, label: c.nombre }))} /></Campo>
        <Campo label="Folio"><Input value={f.folio} onChange={(v) => set('folio', v)} mono /></Campo>
      </Fila2>
      <Campo label="Estado">
        <Segmented value={f.estado} onChange={(v) => set('estado', v)} options={['solicitada', 'enviada', 'aceptada', 'perdida'].map((e) => ({ id: e, label: ESTADO_COT_LABEL[e].replace('Cot. ', '') }))} />
      </Campo>
      <Fila2 cols="1fr 1fr 1fr">
        <Campo label="Solicitada"><Input type="date" value={f.fecha_solicitada} onChange={(v) => set('fecha_solicitada', v)} /></Campo>
        <Campo label="Enviada"><Input type="date" value={f.fecha_enviada} onChange={(v) => set('fecha_enviada', v)} /></Campo>
        <Campo label="Respuesta"><Input type="date" value={f.fecha_respuesta} onChange={(v) => set('fecha_respuesta', v)} /></Campo>
      </Fila2>
      {f.estado === 'perdida' && <Campo label="Motivo de pérdida"><Select value={f.motivo_perdida} onChange={(v) => set('motivo_perdida', v)} placeholder="Elegir…" opciones={MOTIVOS_PERDIDA} /></Campo>}
      <Fila2>
        <Campo label="Piezas cotizadas"><Input type="number" value={f.piezas} onChange={(v) => set('piezas', v)} mono /></Campo>
        <Campo label="Monto cotizado" sub="MXN"><Input type="number" value={f.monto} onChange={(v) => set('monto', v)} mono /></Campo>
      </Fila2>
      <Campo label="Notas"><TextArea value={f.notas} onChange={(v) => set('notas', v)} filas={3} placeholder="Qué se cotizó, vigencia, contacto…" /></Campo>
      {cotizacion && cotizacion.estado !== 'perdida' && !cotizacion.oc_id && onConvertir && (
        <div style={{ marginTop: 6 }}><Boton onClick={() => { onClose?.(); onConvertir(cotizacion); }}>Convertir en OC</Boton></div>
      )}
    </HojaLateral>
  );
}
