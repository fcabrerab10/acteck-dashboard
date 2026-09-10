// Formulario de actividad de marketing (contenido de HojaM) · alta y edición desde el celular.
// Mismo payload y reglas que MarketingCliente.jsx de escritorio (marketing/config.js): tipo (pills), nombre, fecha,
// marca (Segmented), inversión, red social si reel, sucursal/POP si evento, métricas del tipo, notas.
// Foto opcional: sólo con FOTOS_ACTIVAS = true (requiere el bucket público `marketing` en Storage; al 2026-09-10 NO existe,
// por eso va apagado — el sondeo por API no distingue bucket inexistente de bucket vacío). La URL pública se anexa a `notas`.
//   <MarketingForm clienteKey actividad? fechaInicial? onGuardado(actividad) onCancelar />
import React, { useMemo, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Segmented, Pill, BotonGrande, toast } from '../piezas';
import { TIPOS, MARCAS, REDES_SOCIALES, emptyForm } from '../../modules/comercial/marketing/config';

const BUCKET_FOTOS = 'marketing';
export const FOTOS_ACTIVAS = false; // → true cuando exista el bucket `marketing` (público) en Supabase Storage

export function formDe(a) {
  if (!a) return emptyForm();
  return {
    tipo: a.tipo || 'mailing',
    marca: a.marca || 'acteck',
    fecha: a.fecha || (a.anio && a.mes ? `${a.anio}-${String(a.mes).padStart(2, '0')}-01` : ''),
    nombre: a.nombre || '',
    mensaje: a.mensaje || '',
    red_social: a.red_social || '',
    inversion: Number(a.inversion) || 0,
    metricas: a.metricas || {},
    evento_sucursal: a.evento_sucursal || '',
    evento_pop: a.evento_pop || '',
    notas: a.notas || '',
    responsable: a.responsable || '',
  };
}

/** Payload idéntico al de escritorio (incluye defaults de columnas legacy NOT NULL). */
export function payloadDe(form, clienteKey, { anio, mes }) {
  let fAnio = anio, fMes = mes;
  if (form.fecha) {
    const parts = form.fecha.split('-').map((n) => parseInt(n, 10));
    if (parts.length === 3 && parts[0] && parts[1]) { fAnio = parts[0]; fMes = parts[1]; }
  }
  return {
    cliente: clienteKey,
    tipo: form.tipo,
    marca: form.marca,
    nombre: form.nombre.trim(),
    mensaje: form.mensaje || '',
    red_social: form.red_social || null,
    fecha: form.fecha || null,
    anio: fAnio,
    mes: String(fMes),
    inversion: Number(form.inversion) || 0,
    metricas: form.metricas || {},
    evento_sucursal: form.evento_sucursal || null,
    evento_pop: form.evento_pop || null,
    notas: form.notas || null,
    responsable: form.responsable || null,
    estatus: 'activo',
    subtipo: form.fecha || '',
    temporalidad: form.fecha || '',
    producto: '',
  };
}

function Campo({ label, children }) {
  const { theme } = useTheme();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

export default function MarketingForm({ clienteKey, actividad = null, fechaInicial, onGuardado, onCancelar }) {
  const { theme } = useTheme();
  const [form, setForm] = useState(() => (actividad ? formDe(actividad) : { ...emptyForm(), fecha: fechaInicial || emptyForm().fecha }));
  const [saving, setSaving] = useState(false);
  const conFoto = FOTOS_ACTIVAS;
  const [foto, setFoto] = useState(null); // File
  const fileRef = useRef(null);
  const tm = TIPOS[form.tipo] || TIPOS.mailing;
  const editId = actividad?.id || null;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setMet = (k, v) => setForm((f) => ({ ...f, metricas: { ...f.metricas, [k]: v === '' ? null : (isNaN(v) ? v : Number(v)) } }));

  const dark = theme.mode === 'dark';
  const input = useMemo(() => ({
    height: 44, padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 11, fontSize: 16, width: '100%', boxSizing: 'border-box',
    background: dark ? 'rgba(255,255,255,0.06)' : theme.surface, color: theme.text, fontFamily: TYPO.fontText, outline: 'none', WebkitAppearance: 'none',
  }), [theme, dark]);
  const num = { ...input, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right' };

  const guardar = async () => {
    if (!form.nombre.trim()) { toast.error('Falta el nombre de la actividad'); return; }
    setSaving(true);
    const hoy = new Date();
    const payload = payloadDe(form, clienteKey, { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
    // Foto opcional → Storage `marketing` (si el bucket existe) → URL pública anexada a notas.
    if (conFoto && foto) {
      try {
        const ext = (foto.name.split('.').pop() || 'jpg').toLowerCase();
        const ruta = `${clienteKey}/${payload.anio}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET_FOTOS).upload(ruta, foto, { contentType: foto.type || 'image/jpeg', upsert: false });
        if (upErr) throw upErr;
        const { data: pub } = supabase.storage.from(BUCKET_FOTOS).getPublicUrl(ruta);
        if (pub?.publicUrl) payload.notas = [payload.notas, `Foto: ${pub.publicUrl}`].filter(Boolean).join('\n');
      } catch (e) { toast.error('No se pudo subir la foto: ' + (e.message || e)); }
    }
    const q = editId
      ? supabase.from('marketing_actividades').update(payload).eq('id', editId).select().single()
      : supabase.from('marketing_actividades').insert(payload).select().single();
    const { data, error } = await q;
    setSaving(false);
    if (error) { toast.error('Error guardando: ' + error.message); return; }
    toast.ok(editId ? 'Actividad actualizada' : 'Actividad creada');
    onGuardado?.(data);
  };

  return (
    <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: TYPO.fontText, color: theme.text }}>
      <Campo label="Tipo de actividad">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {Object.entries(TIPOS).map(([k, t]) => (
            <Pill key={k} tone={form.tipo === k ? t.tone : 'gray'} onClick={() => set('tipo', k)} style={{ cursor: 'pointer', padding: '6px 11px', fontSize: 12, outline: form.tipo === k ? `1.5px solid ${t.color}` : 'none' }}>
              <t.Icon size={12} strokeWidth={2} />{t.label}
            </Pill>
          ))}
        </div>
      </Campo>

      <Campo label="Nombre / título">
        <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Black Friday Sillas Gamer" style={input} autoFocus={!editId} />
      </Campo>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Campo label="Fecha">
          <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={input} />
        </Campo>
        <Campo label="Inversión ($)">
          <input type="number" inputMode="decimal" value={form.inversion} onChange={(e) => set('inversion', e.target.value)} style={num} />
        </Campo>
      </div>

      <Campo label="Marca">
        <Segmented size="md" value={form.marca} onChange={(v) => set('marca', v)} options={Object.entries(MARCAS).map(([k, m]) => ({ id: k, label: m.label }))} style={{ width: '100%', display: 'flex' }} />
      </Campo>

      {tm.redSocial && (
        <Campo label="Red social">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {Object.entries(REDES_SOCIALES).map(([k, r]) => (
              <Pill key={k} tone={form.red_social === k ? 'inverse' : 'gray'} onClick={() => set('red_social', form.red_social === k ? '' : k)} style={{ cursor: 'pointer', padding: '6px 11px', fontSize: 12 }}>{r.label}</Pill>
            ))}
          </div>
        </Campo>
      )}

      {tm.evento && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo label="Sucursal"><input type="text" value={form.evento_sucursal} onChange={(e) => set('evento_sucursal', e.target.value)} placeholder="Dónde se realizó" style={input} /></Campo>
          <Campo label="POP / material"><input type="text" value={form.evento_pop} onChange={(e) => set('evento_pop', e.target.value)} placeholder="Lona, displays…" style={input} /></Campo>
        </div>
      )}

      <Campo label="Temática / mensaje (opcional)">
        <input type="text" value={form.mensaje} onChange={(e) => set('mensaje', e.target.value)} placeholder="Qué promueve esta actividad" style={input} />
      </Campo>

      {tm.metricas.length > 0 && (
        <div style={{ background: `${tm.color}14`, border: `1px solid ${tm.color}44`, padding: '10px 12px', borderRadius: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
            <tm.Icon size={13} strokeWidth={2} style={{ color: tm.color }} />
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: tm.color, fontWeight: 700 }}>Métricas · {tm.label}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {tm.metricas.map((m) => (
              <Campo key={m.key} label={m.label}>
                <input type="number" inputMode="decimal" value={form.metricas?.[m.key] ?? ''} onChange={(e) => setMet(m.key, e.target.value)} style={num} />
              </Campo>
            ))}
          </div>
        </div>
      )}

      <Campo label="Notas (opcional)">
        <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
      </Campo>

      {conFoto && (
        <Campo label="Foto (opcional)">
          <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={(e) => setFoto(e.target.files?.[0] || null)} style={{ display: 'none' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button type="button" onClick={() => fileRef.current?.click()} style={{ ...input, width: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <Camera size={16} strokeWidth={2} />{foto ? 'Cambiar foto' : 'Tomar foto'}
            </button>
            {foto && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: theme.textMuted, minWidth: 0 }}>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{foto.name}</span>
                <button type="button" aria-label="Quitar foto" onClick={() => setFoto(null)} style={{ border: 0, background: 'transparent', color: theme.textMuted, padding: 2, cursor: 'pointer' }}><X size={14} /></button>
              </span>
            )}
          </div>
        </Campo>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4, paddingBottom: 8 }}>
        <BotonGrande primario disabled={saving} onClick={guardar}>{saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear actividad'}</BotonGrande>
        <BotonGrande disabled={saving} onClick={onCancelar}>Cancelar</BotonGrande>
      </div>
    </div>
  );
}
