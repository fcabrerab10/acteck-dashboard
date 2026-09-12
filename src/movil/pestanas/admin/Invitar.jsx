// Invitar usuario desde el celular · asistente reducido en una hoja (correo · nombre · tipo · cliente si es
// externo · plantilla de permisos "como…"). Es la misma llamada del wizard de la web
// (WizardNuevoUsuario.jsx): POST /api/admin/create-user con { nombre, email, puesto, tipo, permisos,
// metodo: 'invite' } y el JWT del super admin (apiFetch). Supabase manda el correo de invitación.
//
// Diferencias con el wizard web (a propósito, para que quepa en una hoja):
//   · sin contraseña manual: siempre invitación por correo;
//   · los permisos salen de una plantilla ("como Karolina") o, si eliges cliente sin plantilla,
//     de "ver" en las 7 pestañas de ese cliente. El detalle se afina luego en su ficha.
import React, { useMemo, useState } from 'react';
import { UserPlus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { apiFetch } from '../../../lib/apiFetch';
import { CLIENTES, PESTANAS_CLIENTE, PESTANAS_GLOBALES } from '../../../lib/permisos';
import { permisosVacios, normalizarPermisos, GLOBALES_EXTERNO, tipoDe, contarNiveles } from '../../../modules/configuracion/comun';
import { HojaM, BotonGrande, Segmented, toast } from '../../piezas';
import { CampoM, ChipM, lbl } from '../agenda/comun';

const TIPOS = [{ id: 'interno', label: 'Interno' }, { id: 'externo', label: 'Externo' }];
const emailOk = (e) => /\S+@\S+\.\S+/.test(String(e || '').trim());

/** Permisos a enviar: plantilla (si la hay) + reglas del tipo elegido. Pura, misma lógica que el wizard. */
export function permisosDeInvitacion({ tipo, clienteKey, plantilla }) {
  const base = plantilla ? normalizarPermisos(plantilla.permisos) : permisosVacios();
  const clientes = { ...base.clientes };
  let globales = { ...base.globales };
  if (tipo === 'externo') {
    globales = Object.fromEntries(PESTANAS_GLOBALES.map((p) => [p.id, GLOBALES_EXTERNO.has(p.id) ? (globales[p.id] || 'ver') : 'oculto']));
    for (const c of CLIENTES) {
      if (c.id === clienteKey) {
        const tienePlantilla = plantilla && Object.values(base.clientes[c.id] || {}).some((v) => v === 'ver' || v === 'edit');
        clientes[c.id] = tienePlantilla ? base.clientes[c.id] : Object.fromEntries(PESTANAS_CLIENTE.map((p) => [p.id, 'ver']));
      } else clientes[c.id] = Object.fromEntries(PESTANAS_CLIENTE.map((p) => [p.id, 'oculto']));
    }
  }
  return { clientes, globales, sensible: base.sensible === true };
}

export default function Invitar({ abierto, onClose, usuarios, onCreado }) {
  const { theme } = useTheme();
  const [f, setF] = useState({ email: '', nombre: '', puesto: '', tipo: 'interno', cliente: 'digitalife' });
  const [plantillaId, setPlantillaId] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const plantillas = useMemo(
    () => (usuarios || []).filter((u) => !u.es_super_admin && u.activo !== false && tipoDe(u) === f.tipo),
    [usuarios, f.tipo],
  );
  const plantilla = plantillas.find((u) => u.id === plantillaId) || null;
  const valido = emailOk(f.email) && f.nombre.trim().length > 1;

  const cerrar = () => { if (!enviando) { setF({ email: '', nombre: '', puesto: '', tipo: 'interno', cliente: 'digitalife' }); setPlantillaId(null); onClose?.(); } };

  const enviar = async () => {
    if (!valido || enviando) return;
    setEnviando(true);
    try {
      const permisos = permisosDeInvitacion({ tipo: f.tipo, clienteKey: f.cliente, plantilla });
      const r = await apiFetch('/api/admin/create-user', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: f.nombre.trim(), email: f.email.trim().toLowerCase(), puesto: f.puesto.trim() || null,
          tipo: f.tipo, permisos, metodo: 'invite',
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      toast.ok(`Invitación enviada a ${f.email.trim().toLowerCase()}`);
      await onCreado?.();
      setEnviando(false);
      cerrar();
    } catch (e) {
      toast.error(`No se pudo invitar: ${e.message || e}`);
      setEnviando(false);
    }
  };

  const cnt = plantilla ? contarNiveles(normalizarPermisos(plantilla.permisos)) : null;
  const nota = f.tipo === 'externo'
    ? `Verá sólo ${CLIENTES.find((c) => c.id === f.cliente)?.label}${plantilla ? ' con los niveles de la plantilla' : ' (las 7 pestañas en "ver")'}.`
    : plantilla ? `Copiará los permisos de ${plantilla.nombre || plantilla.email}: ${cnt.edit} con edición, ${cnt.ver} sólo lectura.`
      : 'Entrará sin permisos: ajústaselos en su ficha después de que acepte.';

  return (
    <HojaM abierto={abierto} onClose={cerrar} titulo="Invitar usuario" sub="Recibe un correo de Supabase para entrar con su contraseña." alto="86vh">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 16px 8px', fontFamily: TYPO.fontText }}>
        <div><span style={lbl(theme)}>Correo</span><CampoM type="email" value={f.email} onChange={(v) => setF({ ...f, email: v })} placeholder="nombre@acteck.com" autoComplete="off" autoCapitalize="none" /></div>
        <div><span style={lbl(theme)}>Nombre</span><CampoM value={f.nombre} onChange={(v) => setF({ ...f, nombre: v })} placeholder="Nombre y apellido" /></div>
        <div><span style={lbl(theme)}>Puesto</span><CampoM value={f.puesto} onChange={(v) => setF({ ...f, puesto: v })} placeholder="Sólo informativo" /></div>

        <div>
          <span style={lbl(theme)}>Tipo</span>
          <Segmented size="md" value={f.tipo} onChange={(v) => { setF({ ...f, tipo: v }); setPlantillaId(null); }} options={TIPOS} style={{ display: 'flex', width: '100%' }} />
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 6, lineHeight: 1.4 }}>
            {f.tipo === 'interno' ? 'Equipo de Acteck: puede tener pestañas globales.' : 'Empleado del cliente: sólo ve lo que le asignes de su cliente.'}
          </div>
        </div>

        {f.tipo === 'externo' && (
          <div>
            <span style={lbl(theme)}>Cliente</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CLIENTES.map((c) => <ChipM key={c.id} on={f.cliente === c.id} onClick={() => setF({ ...f, cliente: c.id })}>{c.label}</ChipM>)}
            </div>
          </div>
        )}

        <div>
          <span style={lbl(theme)}>Permisos como…</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <ChipM on={!plantillaId} onClick={() => setPlantillaId(null)}>Sin plantilla</ChipM>
            {plantillas.map((u) => <ChipM key={u.id} on={plantillaId === u.id} onClick={() => setPlantillaId(u.id)}>{(u.nombre || u.email).split(' ')[0]}</ChipM>)}
          </div>
          <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 8, lineHeight: 1.4 }}>{nota}</div>
        </div>

        <BotonGrande primario icon={UserPlus} disabled={!valido || enviando} onClick={enviar}>
          {enviando ? 'Enviando…' : 'Enviar invitación'}
        </BotonGrande>
        <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, textAlign: 'center', lineHeight: 1.4, paddingBottom: 6 }}>
          Queda como "invitación pendiente" hasta que entre. Desde su ficha puedes reenviarla.
        </div>
      </div>
    </HojaM>
  );
}
