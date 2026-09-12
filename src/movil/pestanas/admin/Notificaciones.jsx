// Administración → Notificaciones del equipo (celular). Lista de usuarios internos activos con su
// resumen (áreas fuera de "resumen", hora del resumen, correos) y, al tocar, su ficha con
// PreferenciasNotificaciones en modo CONTROLADO: escribe `perfiles.preferencias.notif` de ESE usuario
// con el mismo update optimista de useAdminData (no la RPC set_preferencias, que es para uno mismo).
import React from 'react';
import { BellOff } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { AvatarImg } from '../../../lib/avatar';
import { AREAS, AREA_LABEL, NOMBRE_CLIENTE, normalizarPrefsNotif } from '../../../lib/alertas';
import PreferenciasNotificaciones from '../../../components/notificaciones/PreferenciasNotificaciones';
import { tipoDe, estadoDe } from '../../../modules/configuracion/comun';
import { useUsuariosAdmin } from '../../../modules/configuracion/useAdminData';
import { useNav } from '../../nav';
import { TituloGrande, ListaAgrupada, Fila, Cabecera, Vacio, toast } from '../../piezas';

/** "Inventario y Cobranza al momento · Ventas en silencio · resumen 09:00" */
function resumirPrefs(p) {
  const inmediatas = AREAS.filter((a) => p.areas[a] === 'inmediato').map((a) => AREA_LABEL[a]);
  const silencio = AREAS.filter((a) => p.areas[a] === 'silencio').map((a) => AREA_LABEL[a]);
  const partes = [];
  if (inmediatas.length) partes.push(`${inmediatas.join(', ')} al momento`);
  if (silencio.length) partes.push(`${silencio.join(', ')} en silencio`);
  if (!partes.length) partes.push('todo en resumen');
  partes.push(`resumen ${p.resumen.hora}`);
  if (p.resumen.correo) partes.push('correo sí');
  if (p.clientes) partes.push(`sólo ${p.clientes.map((c) => NOMBRE_CLIENTE[c] || c).join(', ')}`);
  return partes.join(' · ');
}

export default function Notificaciones({ usuarios, actualizar }) {
  const { theme } = useTheme();
  const nav = useNav();
  const internos = (usuarios || []).filter((u) => tipoDe(u) === 'interno' && u.activo);

  const guardarDe = async (usuario, notif) => {
    const prev = usuario.preferencias && typeof usuario.preferencias === 'object' ? usuario.preferencias : {};
    await actualizar(usuario.id, { preferencias: { ...prev, notif } });
    toast.ok(`Preferencias de ${(usuario.nombre || usuario.email).split(' ')[0]} guardadas`);
  };

  if (!internos.length) return <Vacio icon={BellOff} color={theme.textMuted} titulo="Sin usuarios internos activos" sub="Los externos no reciben avisos del centro de notificaciones." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <ListaAgrupada titulo="Equipo interno" meta={String(internos.length)}
        pie="Los externos no reciben avisos. Los correos fijos del cron (tracking, forecast, evaluación) se cambian en Vercel.">
        {internos.map((u) => {
          const p = normalizarPrefsNotif(u.preferencias?.notif);
          return (
            <Fila key={u.id} avatar={<AvatarImg perfil={u} size={34} />} alto={58}
              titulo={u.nombre || u.email} sub={resumirPrefs(p)}
              onClick={() => nav.push(<FichaNotif id={u.id} onGuardar={guardarDe} />, `admin-notif-${u.id}`)} />
          );
        })}
      </ListaAgrupada>
    </div>
  );
}

// La ficha lee el perfil de la cache de React Query (useUsuariosAdmin) para ver el guardado optimista.
function FichaNotif({ id, onGuardar }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { usuarios } = useUsuariosAdmin();
  const u = (usuarios || []).find((x) => x.id === id);
  if (!u) return (<><Cabecera onVolver={nav.pop} /><Vacio icon={null} titulo="Usuario no encontrado" /></>);
  const est = estadoDe(u);
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo={(u.nombre || u.email).split(' ')[0]} sub={`Notificaciones${est.key === 'pendiente' ? ' · invitación pendiente' : ''}`} derecha={<AvatarImg perfil={u} size={44} />} />
      <div style={{ fontFamily: TYPO.fontText, color: theme.text }}>
        <PreferenciasNotificaciones valor={u.preferencias?.notif} onGuardar={(n) => onGuardar(u, n)}
          pieTexto={`Se guarda en el perfil de ${u.nombre || u.email}; lo verá la próxima vez que abra el dashboard.`} />
      </div>
      <div style={{ height: 8 }} />
    </>
  );
}
