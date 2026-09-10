// Formulario de alta/edición de actividad · modal con el estilo del kit.
// Mismo contenido que la versión anterior: tipo, marca, fecha, red social (reel),
// nombre, mensaje, inversión, métricas por tipo, sucursal/POP (evento), responsable, notas.
import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, Segmented, EASE, DUR, elevation, bordeFlotante } from '../../../components/kit';
import { TIPOS, MARCAS, REDES_SOCIALES } from './config';

function Field({ label, children }) {
  const { theme } = useTheme();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.textMuted, fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

export default function ActividadForm({ form, setForm, editId, saving, onSave, onClose }) {
  const { theme } = useTheme();
  const tm = TIPOS[form.tipo] || TIPOS.mailing;
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setMet = (k, v) => setForm((f) => ({ ...f, metricas: { ...f.metricas, [k]: v === '' ? null : (isNaN(v) ? v : Number(v)) } }));
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const input = {
    padding: '7px 10px', border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12.5, width: '100%', boxSizing: 'border-box',
    background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, outline: 'none',
  };
  const dark = theme.mode === 'dark';

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: dark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <style>{`@keyframes mktFormIn{from{opacity:0;transform:translateY(10px) scale(.98)}to{opacity:1;transform:none}}`}</style>
      <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true"
        style={{
          background: theme.surface, border: bordeFlotante(theme), borderRadius: 14, maxWidth: 640, width: '100%', maxHeight: '90vh',
          overflow: 'hidden', display: 'flex', flexDirection: 'column', fontFamily: TYPO.fontText, color: theme.text,
          boxShadow: elevation(theme, 'flotante'), animation: `mktFormIn ${DUR.content}ms ${EASE} both`,
        }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>Marketing</div>
            <h3 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em' }}>{editId ? 'Editar actividad' : 'Nueva actividad'}</h3>
          </div>
          <Boton icon={X} onClick={onClose} title="Cerrar (Esc)" style={{ padding: '0 8px' }} />
        </div>

        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 12, overflowY: 'auto' }}>
          <Field label="Tipo de actividad">
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {Object.entries(TIPOS).map(([k, t]) => (
                <Pill key={k} tone={form.tipo === k ? t.tone : 'gray'} onClick={() => set('tipo', k)} style={{ cursor: 'pointer', outline: form.tipo === k ? `1.5px solid ${t.color}` : 'none' }}>
                  <t.Icon size={11} strokeWidth={2} />{t.label}
                </Pill>
              ))}
            </div>
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: tm.redSocial ? '1fr 1fr 1fr' : '1fr 1fr', gap: 10 }}>
            <Field label="Marca">
              <Segmented value={form.marca} onChange={(v) => set('marca', v)} options={Object.entries(MARCAS).map(([k, m]) => ({ id: k, label: m.label }))} style={{ width: '100%' }} />
            </Field>
            <Field label="Fecha">
              <input type="date" value={form.fecha} onChange={(e) => set('fecha', e.target.value)} style={input} />
            </Field>
            {tm.redSocial && (
              <Field label="Red social">
                <select value={form.red_social} onChange={(e) => set('red_social', e.target.value)} style={input}>
                  <option value="">Selecciona…</option>
                  {Object.entries(REDES_SOCIALES).map(([k, r]) => <option key={k} value={k}>{r.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          <Field label="Nombre / título">
            <input type="text" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Ej: Black Friday Sillas Gamer" style={input} autoFocus />
          </Field>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10 }}>
            <Field label="Temática / mensaje (opcional)">
              <input type="text" value={form.mensaje} onChange={(e) => set('mensaje', e.target.value)} placeholder="Qué promueve esta actividad" style={input} />
            </Field>
            <Field label="Inversión ($)">
              <input type="number" value={form.inversion} onChange={(e) => set('inversion', e.target.value)} style={{ ...input, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }} />
            </Field>
          </div>

          {/* Métricas específicas del tipo */}
          <div style={{ background: `${tm.color}14`, border: `1px solid ${tm.color}44`, padding: '10px 12px', borderRadius: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
              <tm.Icon size={13} strokeWidth={2} style={{ color: tm.color }} />
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: tm.color, fontWeight: 700 }}>Métricas · {tm.label}</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
              {tm.metricas.map((m) => (
                <Field key={m.key} label={m.label}>
                  <input type="number" value={form.metricas?.[m.key] ?? ''} onChange={(e) => setMet(m.key, e.target.value)} style={{ ...input, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }} />
                </Field>
              ))}
            </div>
          </div>

          {/* Evento */}
          {tm.evento && (
            <div style={{ background: `${tm.color}0F`, border: `1px solid ${tm.color}33`, padding: '10px 12px', borderRadius: 12 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.07em', color: tm.color, fontWeight: 700, marginBottom: 8 }}>Detalle del evento</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <Field label="Sucursal">
                  <input type="text" value={form.evento_sucursal} onChange={(e) => set('evento_sucursal', e.target.value)} placeholder="Dónde se realizó" style={input} />
                </Field>
                <Field label="POP / material">
                  <input type="text" value={form.evento_pop} onChange={(e) => set('evento_pop', e.target.value)} placeholder="Ej: Lona, displays, muestras" style={input} />
                </Field>
              </div>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 10 }}>
            <Field label="Responsable (opcional)">
              <input type="text" value={form.responsable} onChange={(e) => set('responsable', e.target.value)} style={input} />
            </Field>
            <Field label="Notas (opcional)">
              <textarea value={form.notas} onChange={(e) => set('notas', e.target.value)} rows={2} style={{ ...input, resize: 'vertical' }} />
            </Field>
          </div>
        </div>

        <div style={{ padding: '10px 16px', borderTop: `1px solid ${theme.border}`, display: 'flex', gap: 8, justifyContent: 'flex-end', background: theme.bg }}>
          <Boton onClick={onClose} disabled={saving} size="md">Cancelar</Boton>
          <Boton primario onClick={onSave} disabled={saving} size="md">{saving ? 'Guardando…' : editId ? 'Guardar cambios' : 'Crear actividad'}</Boton>
        </div>
      </div>
    </div>
  );
}
