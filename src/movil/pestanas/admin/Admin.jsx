// Administración en el celular (página global `configuracion`, sólo super admin).
//
//   Hero corto (usuarios activos · puente vivo/caído · fuentes atrasadas · versión) + Segmented con las
//   CUATRO secciones de la web: Usuarios y permisos · Datos · Notificaciones del equipo · Sistema.
//
// Toda la lógica de datos es la MISMA de la web (src/modules/configuracion/useAdminData.js: useUsuariosAdmin
// con update optimista + rollback, useActividadUsuarios) y la frescura sale del importador
// (useFrescura + useFuentesConfig + useEstadoImportador, igual que PestanaDatos del avatar).
// `perfiles` y `sync_solicitudes` son tablas que la app escribe: nunca pasan por cachedQuery.
import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { versionLabel } from '../../../lib/version';
import { relativo } from '../../../lib/format';
import { useFrescura } from '../../../lib/frescura';
import { useFuentesConfig } from '../../../modules/settings/importador/fuentesConfig';
import { useEstadoImportador } from '../../../modules/settings/importador/useImportadorData';
import { latidoPuente } from '../../../modules/settings/importador/frescura';
import { resumirDatos } from '../../../components/perfil/PestanaDatos';
import { useUsuariosAdmin, useActividadUsuarios } from '../../../modules/configuracion/useAdminData';
import { estadoDe, tipoDe, plural } from '../../../modules/configuracion/comun';
import { Cargando } from '../../../components/kit';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, Cabecera, Segmented, Vacio } from '../../piezas';
import Usuarios from './Usuarios';
import Datos from './Datos';
import Notificaciones from './Notificaciones';
import Sistema from './Sistema';

const SECCIONES = [
  { id: 'usuarios', label: 'Usuarios' },
  { id: 'datos', label: 'Datos' },
  { id: 'notificaciones', label: 'Notificaciones' },
  { id: 'sistema', label: 'Sistema' },
];

export default function Admin() {
  const { theme } = useTheme();
  const nav = useNav();
  const esAdmin = nav?.perfil?.es_super_admin === true;
  const [seccion, setSeccion] = useState('usuarios');

  const { usuarios, cargando, error, refetch, actualizar } = useUsuariosAdmin();
  const { porUserId: actividad } = useActividadUsuarios(esAdmin ? usuarios : []);

  // Frescura de las fuentes (misma fuente que el avatar → Datos y que Administración web).
  const { filas: filasVista } = useFrescura(esAdmin);
  const { fuentes } = useFuentesConfig({ enabled: esAdmin });
  const { status, upload, refetch: refetchStatus } = useEstadoImportador({ enabled: esAdmin });
  const datos = useMemo(() => (status ? resumirDatos({ filasVista, fuentes, status, upload }) : null), [filasVista, fuentes, status, upload]);
  const latido = useMemo(() => latidoPuente(status), [status]);

  const hero = useMemo(() => {
    const activos = usuarios.filter((u) => estadoDe(u).key === 'activo');
    const internos = usuarios.filter((u) => tipoDe(u) === 'interno').length;
    const pendientes = usuarios.filter((u) => estadoDe(u).key === 'pendiente').length;
    const atrasadas = datos?.atrasadas?.length || 0;
    const frase = cargando
      ? 'Leyendo usuarios…'
      : `${plural(activos.length, 'usuario activo', 'usuarios activos')}${pendientes ? ` · ${plural(pendientes, 'invitación pendiente', 'invitaciones pendientes')}` : ''}.`;
    const sub = status
      ? `${latido.enLinea ? 'Puente en línea' : latido.t ? 'Puente sin señal' : 'Puente sin latido'}${latido.t ? ` · latido ${relativo(latido.t)}` : ''} · ${versionLabel()}`
      : versionLabel();
    return {
      frase, sub,
      dot: atrasadas > 0 || (!!status && !latido.enLinea),
      stats: [
        { k: 'Usuarios', v: cargando ? '…' : String(activos.length), sub: `${internos} internos` },
        { k: 'Puente', v: status ? (latido.enLinea ? 'Vivo' : 'Caído') : '…', sub: status ? (latido.enLinea ? 'Mac mini' : 'sin señal') : 'leyendo', color: status && !latido.enLinea ? theme.redSoft || theme.red : undefined },
        { k: 'Atrasadas', v: datos ? String(atrasadas) : '…', sub: datos ? `de ${datos.total} fuentes` : 'frescura', color: atrasadas ? theme.orangeSoft || theme.orange : undefined },
      ],
    };
  }, [usuarios, datos, status, latido, cargando, theme]);

  const cabecera = (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Administración" sub="Sólo la ves tú" />
    </>
  );

  if (!esAdmin) return (<>{cabecera}<Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="Administración sólo la ve el super admin." /></>);
  if (cargando && !usuarios.length) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla="movilAdmin" /></div></>);

  return (
    <>
      {cabecera}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
        <HeroM eyebrow="Interno · Administración" frase={hero.frase} sub={hero.sub} stats={hero.stats} />

        {error && <div style={{ padding: '0 18px', fontSize: 11.5, color: theme.orange, fontFamily: TYPO.fontText }}>No se pudieron leer los usuarios: {error.message}</div>}

        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px' }}>
          <Segmented size="md" value={seccion} onChange={setSeccion} options={SECCIONES} />
        </div>

        {seccion === 'usuarios' && (
          <Usuarios usuarios={usuarios} cargando={cargando} actividad={actividad} actualizar={actualizar} refetch={refetch} miUserId={nav?.perfil?.user_id || null} />
        )}
        {seccion === 'datos' && <Datos status={status} upload={upload} fuentes={fuentes} filasVista={filasVista} resumen={datos} latido={latido} perfil={nav?.perfil} onRefetch={refetchStatus} />}
        {seccion === 'notificaciones' && <Notificaciones usuarios={usuarios} actualizar={actualizar} />}
        {seccion === 'sistema' && <Sistema status={status} latido={latido} />}
      </div>
    </>
  );
}
