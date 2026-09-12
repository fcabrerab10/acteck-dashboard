// Administración → Usuarios y permisos (celular).
//   Buscador + listas "Acteck · internos" y "Externos · clientes": avatar, nombre, tipo y puesto,
//   último acceso y pills (super admin, sensible, se evalúa, invitado, sin acceso).
//   Tocar una fila empuja su ficha (FichaUsuario). "Invitar usuario" abre la hoja del asistente reducido.
import React, { useMemo, useState } from 'react';
import { UserPlus, ShieldCheck, Users } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { AvatarImg } from '../../../lib/avatar';
import { relativo } from '../../../lib/format';
import { estadoDe, tipoDe, TIPO_LABEL, normalizarPermisos, contarNiveles, clientesConAcceso } from '../../../modules/configuracion/comun';
import { activoReciente } from '../../../modules/configuracion/useAdminData';
import { useNav } from '../../nav';
import { ListaAgrupada, CampoBusqueda, BotonGrande, Pill, Vacio } from '../../piezas';
import FichaUsuario from './FichaUsuario';
import Invitar from './Invitar';

export default function Usuarios({ usuarios, cargando, actividad, actualizar, refetch, miUserId }) {
  const { theme } = useTheme();
  const nav = useNav();
  const [busca, setBusca] = useState('');
  const [invitar, setInvitar] = useState(false);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (usuarios || [])
      .filter((u) => !q || (u.nombre || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.puesto || '').toLowerCase().includes(q))
      .sort((a, b) => (b.activo === a.activo ? 0 : a.activo ? -1 : 1) || (a.nombre || '').localeCompare(b.nombre || ''));
  }, [usuarios, busca]);
  const internos = filtrados.filter((u) => tipoDe(u) === 'interno');
  const externos = filtrados.filter((u) => tipoDe(u) === 'externo');

  const abrir = (u) => nav.push(<FichaUsuario id={u.id} actualizar={actualizar} refetch={refetch} miUserId={miUserId} ts={actividad?.[u.user_id]} />, `admin-u-${u.id}`);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ padding: '0 16px' }}>
        <CampoBusqueda value={busca} onChange={setBusca} placeholder="Buscar por nombre, correo o puesto" />
      </div>

      {internos.length > 0 && (
        <ListaAgrupada titulo="Acteck · internos" meta={String(internos.length)}>
          {internos.map((u) => <FilaUsuarioM key={u.id} u={u} ts={actividad?.[u.user_id]} soyYo={u.user_id === miUserId} onClick={() => abrir(u)} />)}
        </ListaAgrupada>
      )}

      {externos.length > 0 && (
        <ListaAgrupada titulo="Externos · clientes" meta={String(externos.length)} pie="Un externo sólo ve las pestañas de su cliente.">
          {externos.map((u) => <FilaUsuarioM key={u.id} u={u} ts={actividad?.[u.user_id]} soyYo={u.user_id === miUserId} onClick={() => abrir(u)} />)}
        </ListaAgrupada>
      )}

      {!cargando && filtrados.length === 0 && (
        <Vacio icon={Users} color={theme.textMuted} titulo="Sin usuarios que coincidan" sub={busca ? 'Prueba con otro nombre o correo.' : 'Todavía no hay perfiles.'} />
      )}

      <div style={{ padding: '0 16px' }}>
        <BotonGrande primario icon={UserPlus} onClick={() => setInvitar(true)}>Invitar usuario</BotonGrande>
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', marginTop: 8, fontFamily: TYPO.fontText, lineHeight: 1.4 }}>
          Los permisos se guardan al instante desde la ficha de cada persona.
        </div>
      </div>

      <Invitar abierto={invitar} onClose={() => setInvitar(false)} usuarios={usuarios} onCreado={refetch} />
    </div>
  );
}

function FilaUsuarioM({ u, ts, soyYo, onClick }) {
  const { theme } = useTheme();
  const est = estadoDe(u);
  const permisos = normalizarPermisos(u.permisos);
  const cnt = contarNiveles(permisos);
  const propios = clientesConAcceso(permisos);
  const reciente = activoReciente(ts);
  const sinAcceso = !u.es_super_admin && cnt.edit + cnt.ver === 0;

  return (
    <div role="button" onClick={onClick}
      style={{ display: 'flex', alignItems: 'flex-start', gap: 11, padding: '11px 12px', width: '100%', boxSizing: 'border-box', textAlign: 'left', background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer', opacity: est.key === 'suspendido' ? 0.6 : 1 }}>
      <AvatarImg perfil={u} size={38} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || u.email}</span>
          {u.es_super_admin && <ShieldCheck size={13} style={{ color: theme.purple || theme.accent, flexShrink: 0 }} />}
          {reciente && <span style={{ width: 7, height: 7, borderRadius: 999, background: theme.green, flexShrink: 0 }} />}
        </div>
        <div style={{ fontSize: 11.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {TIPO_LABEL[tipoDe(u)]}{u.puesto ? ` · ${u.puesto}` : ''} · {ts ? relativo(ts) : 'sin actividad'}
        </div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 6 }}>
          {soyYo && <Pill tone="blue" size="xs">Tú</Pill>}
          {u.es_super_admin && <Pill tone="purple" size="xs">Super admin</Pill>}
          {est.key === 'pendiente' && <Pill tone="orange" size="xs" dot>invitado</Pill>}
          {est.key === 'suspendido' && <Pill tone="gray" size="xs" dot>inactivo</Pill>}
          {permisos.sensible && !u.es_super_admin && <Pill tone="purple" size="xs">sensible</Pill>}
          {u.se_evalua && <Pill tone="blue" size="xs">se evalúa</Pill>}
          {sinAcceso ? <Pill tone="red" size="xs">sin acceso</Pill>
            : !u.es_super_admin && <Pill tone="gray" size="xs">{cnt.edit ? `${cnt.edit} edita` : `${cnt.ver} ve`}{propios.length ? ` · ${propios.length} cliente${propios.length === 1 ? '' : 's'}` : ''}</Pill>}
        </div>
      </div>
    </div>
  );
}
