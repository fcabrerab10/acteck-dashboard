// Agenda móvil · hoja «Enviar minuta por correo» (2026-09-22). Misma lógica que la web
// (src/modules/agenda/EnviarMinuta.jsx): contactos del cliente como chips, alta rápida, mensaje y envío.
import React, { useMemo, useState } from 'react';
import { Mail, Plus, Check, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { relativo } from '../../../lib/format';
import { useContactos, crearContacto, borrarContacto, enviarMinutaCorreo } from '../../../modules/agenda/datos';
import { nombreClienteAgenda } from '../../../modules/agenda/etiquetas';
import { parsearContacto } from '../../../modules/agenda/EnviarMinuta';
import { HojaM, BotonGrande, toast } from '../../piezas';
import { ChipM, SeccionM } from './comun';

export default function EnviarMinutaM({ abierto, onClose, reunion }) {
  const { theme } = useTheme();
  const { contactos } = useContactos({ enabled: abierto });
  const delCliente = useMemo(() => contactos.filter((c) => c.cliente_key === reunion.cliente_key), [contactos, reunion.cliente_key]);
  const ultimo = (reunion.envios || []).at(-1);
  const [sel, setSel] = useState(() => new Set(ultimo?.para || []));
  const [nuevo, setNuevo] = useState('');
  const [mensaje, setMensaje] = useState('Hola, les comparto la minuta de nuestra reunión de hoy. Quedo atento a cualquier comentario.');
  const [busy, setBusy] = useState(false);
  const cliente = nombreClienteAgenda(reunion.cliente_key);
  const toggle = (email) => setSel((s) => { const n = new Set(s); if (n.has(email)) n.delete(email); else n.add(email); return n; });
  const agregar = async () => {
    const c = parsearContacto(nuevo);
    if (!c) { toast.error('Escribe un correo válido'); return; }
    try { const row = await crearContacto({ cliente_key: reunion.cliente_key, ...c }); setSel((s) => new Set([...s, row.email])); setNuevo(''); } catch (e) { toast.error(e.message); }
  };
  const enviar = async () => {
    const para = [...sel]; if (!para.length) return;
    setBusy(true);
    try { const r = await enviarMinutaCorreo({ reunionId: reunion.id, para, mensaje }); toast.ok(`Minuta enviada a ${r.para.length} de ${cliente}`, { ms: 5000 }); onClose?.(); } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const campo = { width: '100%', boxSizing: 'border-box', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 14, padding: '9px 12px', outline: 'none' };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={`Enviar minuta a ${cliente}`} alto="86vh" sub={ultimo ? `Último envío ${relativo(ultimo.at)}` : 'Desde el correo de Acteck, con copia para ti'}>
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <SeccionM>Para</SeccionM>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
            {delCliente.map((c) => (
              <ChipM key={c.id} on={sel.has(c.email)} onClick={() => toggle(c.email)}>{sel.has(c.email) && <Check size={12} />}{c.nombre || c.email}</ChipM>
            ))}
            {!delCliente.length && <span style={{ fontSize: 12.5, color: theme.textMuted }}>Agrega el primer contacto de {cliente}: queda guardado para la próxima.</span>}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Nombre <correo@cliente.com>" inputMode="email" autoCapitalize="none" style={{ ...campo, flex: 1 }} />
            <button type="button" onClick={agregar} aria-label="Agregar contacto" style={{ width: 42, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={16} /></button>
          </div>
          {delCliente.some((c) => sel.has(c.email)) && <div style={{ marginTop: 6, fontSize: 11.5, color: theme.textMuted }}>Quitar de la lista: {delCliente.filter((c) => sel.has(c.email)).map((c) => <button key={c.id} type="button" onClick={() => borrarContacto(c.id).then(() => toggle(c.email)).catch((e) => toast.error(e.message))} style={{ border: 0, background: 'transparent', color: theme.textMuted, fontFamily: 'inherit', fontSize: 'inherit', display: 'inline-flex', alignItems: 'center', gap: 2, padding: '0 4px' }}><X size={10} />{c.nombre || c.email}</button>)}</div>}
        </div>
        <div>
          <SeccionM>Mensaje</SeccionM>
          <textarea value={mensaje} onChange={(e) => setMensaje(e.target.value)} rows={3} style={{ ...campo, marginTop: 6, resize: 'vertical', lineHeight: 1.4 }} />
        </div>
      </div>
      <div style={{ padding: '10px 16px 8px' }}>
        <BotonGrande primario icon={Mail} disabled={!sel.size || busy} onClick={enviar}>{busy ? 'Enviando…' : sel.size ? `Enviar a ${sel.size}` : 'Elige a quién'}</BotonGrande>
      </div>
    </HojaM>
  );
}
