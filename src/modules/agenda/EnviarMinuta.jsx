// Agenda · «Enviar por correo» la minuta al cliente (2026-09-22, Fernando: «cuando acabe la minuta…
// se le pueda mandar por correo»). Modal: destinatarios = contactos del cliente (se recuerdan en
// agenda_contactos) + alta rápida "nombre <correo>"; copia a quien envía siempre; mensaje libre;
// vista previa en texto. Manda api/google-calendar.js?action=enviar-minuta y anota reunion.envios.
import React, { useMemo, useState } from 'react';
import { Mail, Plus, X, Check } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Modal } from '../../components/perfil/comun';
import { Boton, Pill, toast } from '../../components/kit';
import { relativo } from '../../lib/format';
import { useContactos, crearContacto, borrarContacto, enviarMinutaCorreo } from './datos';
import { nombreClienteAgenda } from './etiquetas';
import { textoMinuta } from './textos';

const RE_MAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** "Ana López <ana@x.com>" · "ana@x.com" · "Ana, ana@x.com" → { nombre, email } */
export function parsearContacto(s) {
  const t = String(s || '').trim();
  const m = /^(.*?)[<,\s]*([^\s<>,]+@[^\s<>,]+)>?\s*$/.exec(t);
  if (!m) return null;
  const email = m[2].toLowerCase();
  if (!RE_MAIL.test(email)) return null;
  return { nombre: m[1].replace(/[<,]/g, '').trim() || null, email };
}

export default function EnviarMinuta({ abierto, onClose, reunion, puntos = [], personasPorId, porId, yo }) {
  const { theme } = useTheme();
  const { contactos } = useContactos({ enabled: abierto });
  const delCliente = useMemo(() => contactos.filter((c) => c.cliente_key === reunion.cliente_key), [contactos, reunion.cliente_key]);
  const ultimo = (reunion.envios || []).at(-1);
  const [sel, setSel] = useState(() => new Set(ultimo?.para || []));
  const [nuevo, setNuevo] = useState('');
  const [mensaje, setMensaje] = useState(`Hola, les comparto la minuta de nuestra reunión de hoy. Quedo atento a cualquier comentario.`);
  const [enviando, setEnviando] = useState(false);
  const cliente = nombreClienteAgenda(reunion.cliente_key);
  const toggle = (email) => setSel((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const agregar = async () => {
    const c = parsearContacto(nuevo);
    if (!c) { toast.error('Escribe un correo válido: "Nombre <correo>" o sólo el correo'); return; }
    try { const row = await crearContacto({ cliente_key: reunion.cliente_key, ...c }); setSel((s) => new Set([...s, row.email])); setNuevo(''); }
    catch (e) { toast.error(e.message); }
  };
  const quitar = async (c) => { try { await borrarContacto(c.id); setSel((s) => { const n = new Set(s); n.delete(c.email); return n; }); } catch (e) { toast.error(e.message); } };
  const enviar = async () => {
    const para = [...sel];
    if (!para.length) { toast.error('Elige al menos un destinatario'); return; }
    setEnviando(true);
    try { const r = await enviarMinutaCorreo({ reunionId: reunion.id, para, mensaje }); toast.ok(`Minuta enviada a ${r.para.length} contacto${r.para.length === 1 ? '' : 's'} de ${cliente}`, { ms: 5000 }); onClose?.(); }
    catch (e) { toast.error(e.message); }
    setEnviando(false);
  };
  const previa = useMemo(() => textoMinuta(reunion, puntos, { personasPorId, porId }).replace(/[*_]/g, ''), [reunion, puntos, personasPorId, porId]);
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, marginBottom: 6 };

  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} ancho={560} titulo={`Enviar minuta a ${cliente}`} sub={ultimo ? `Último envío ${relativo(ultimo.at)} a ${ultimo.para.join(', ')}` : 'Se manda desde el correo de Acteck con copia para ti'}
      pie={<><Boton onClick={onClose}>Cancelar</Boton><Boton primario icon={Mail} onClick={enviar} disabled={enviando || !sel.size}>{enviando ? 'Enviando…' : `Enviar${sel.size ? ` a ${sel.size}` : ''}`}</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: TYPO.fontText }}>
        <div>
          <div style={lbl}>Para · contactos de {cliente}</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {delCliente.map((c) => {
              const on = sel.has(c.email);
              return (
                <span key={c.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 6px 4px 10px', borderRadius: 999, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? (theme.accentBg || 'rgba(0,122,255,0.10)') : theme.surface, fontSize: 12, color: theme.text }}>
                  <button type="button" onClick={() => toggle(c.email)} title={c.email} style={{ border: 0, background: 'transparent', padding: 0, cursor: 'pointer', color: 'inherit', fontFamily: 'inherit', fontSize: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    {on && <Check size={12} style={{ color: theme.accent }} />}<strong style={{ fontWeight: 600 }}>{c.nombre || c.email}</strong>{c.nombre && <span style={{ color: theme.textMuted }}>{c.email}</span>}
                  </button>
                  <button type="button" onClick={() => quitar(c)} title="Quitar de la lista" style={{ border: 0, background: 'transparent', padding: 2, cursor: 'pointer', color: theme.textMuted, display: 'inline-flex' }}><X size={11} /></button>
                </span>
              );
            })}
            {!delCliente.length && <span style={{ fontSize: 12, color: theme.textMuted }}>Aún no hay contactos de {cliente}: agrega el primero abajo y queda guardado para la próxima.</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }} placeholder="Nombre <correo@cliente.com>  · Enter agrega"
              style={{ flex: 1, height: 32, padding: '0 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, outline: 'none' }} />
            <Boton icon={Plus} onClick={agregar}>Agregar</Boton>
          </div>
        </div>
        <div>
          <div style={lbl}>Copia</div>
          <Pill tone="gray">{yo?.email || 'tú'}</Pill>
        </div>
        <div>
          <div style={lbl}>Mensaje</div>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} style={{ width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: 10, outline: 'none', resize: 'vertical', lineHeight: 1.45 }} />
        </div>
        <div>
          <div style={lbl}>Lo que va en el correo</div>
          <pre style={{ margin: 0, maxHeight: 220, overflow: 'auto', whiteSpace: 'pre-wrap', fontFamily: TYPO.fontText, fontSize: 12, lineHeight: 1.45, color: theme.textMuted, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10 }}>{previa}</pre>
        </div>
      </div>
    </Modal>
  );
}
