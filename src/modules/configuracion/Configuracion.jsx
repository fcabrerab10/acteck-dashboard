// Administración (página `configuracion`, sólo super admin; antes "Configuración").
//   Hero (usuarios activos · sin entrar en 30 d · datos al día) + Segmented:
//   Usuarios y permisos · Datos · Notificaciones del equipo · Sistema.
// Las preferencias personales viven en el avatar (PanelAvatar); cuotas/lineamientos en el importador.
// Se monta lazy desde App.jsx con session={{ user, perfil }}.
import React, { useMemo, useState } from 'react';
import { ArrowRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { puedeConfigurar } from '../../lib/permisos';
import { versionLabel } from '../../lib/version';
import { relativo } from '../../lib/format';
import { useFrescura } from '../../lib/frescura';
import { useFuentesConfig } from '../settings/importador/fuentesConfig';
import { useEstadoImportador } from '../settings/importador/useImportadorData';
import { resumirDatos } from '../../components/perfil/PestanaDatos';
import SinAcceso from '../../components/SinAcceso';
import { Hero, Segmented, Cargando } from '../../components/kit';
import WizardNuevoUsuario from './WizardNuevoUsuario';
import UsuariosPermisos from './UsuariosPermisos';
import SeccionDatos from './SeccionDatos';
import SeccionNotificaciones from './SeccionNotificaciones';
import SeccionSistema from './SeccionSistema';
import { useUsuariosAdmin, useActividadUsuarios, useUltimoCambioPermisos, activoReciente, irAPagina } from './useAdminData';
import { tipoDe, estadoDe, normalizarPermisos, contarNiveles, plural } from './comun';

const SECCIONES = [
  { id: 'usuarios', label: 'Usuarios y permisos' },
  { id: 'datos', label: 'Datos' },
  { id: 'notificaciones', label: 'Notificaciones del equipo' },
  { id: 'sistema', label: 'Sistema' },
];

export default function Configuracion({ session }) {
  const { theme } = useTheme();
  const perfil = session?.perfil;
  const miUserId = session?.user?.id || perfil?.user_id || null;
  const [seccion, setSeccion] = useState('usuarios');
  const [wizard, setWizard] = useState(false);

  const { usuarios, cargando, error, refetch, actualizar } = useUsuariosAdmin();
  const { porUserId: actividad } = useActividadUsuarios(usuarios);
  const { data: ultimoCambio } = useUltimoCambioPermisos();

  // Datos al día (misma fuente que el avatar → Datos): vista de frescura + cadencia de manuales.
  const { filas: filasVista } = useFrescura(true);
  const { fuentes } = useFuentesConfig({ enabled: true });
  const { status, upload } = useEstadoImportador({ enabled: true });
  const datos = useMemo(() => (status ? resumirDatos({ filasVista, fuentes, status, upload }) : null), [filasVista, fuentes, status, upload]);

  const hero = useMemo(() => {
    const activos = usuarios.filter((u) => estadoDe(u).key === 'activo');
    const internos = usuarios.filter((u) => tipoDe(u) === 'interno').length;
    const externos = usuarios.length - internos;
    const pendientes = usuarios.filter((u) => estadoDe(u).key === 'pendiente').length;
    const activos30 = activos.filter((u) => activoReciente(actividad?.[u.user_id])).length;
    const sinEntrar = activos.length - activos30;
    const editores = activos.filter((u) => !u.es_super_admin && tipoDe(u) === 'interno').map((u) => {
      const c = contarNiveles(normalizarPermisos(u.permisos));
      const nombre = (u.nombre || u.email || '').split(' ')[0];
      return c.edit ? `${nombre} edita ${plural(c.edit, 'pestaña')}` : c.ver ? `${nombre} sólo lectura` : `${nombre} sin permisos`;
    });
    const titulo = cargando ? 'Leyendo usuarios…'
      : `${plural(activos.length, 'usuario activo', 'usuarios activos')}${sinEntrar ? `, ${sinEntrar} sin entrar en 30 días` : ''}${pendientes ? ` · ${plural(pendientes, 'invitación pendiente', 'invitaciones pendientes')}` : ''}.`;
    const partes = [];
    if (editores.length) partes.push(editores.join(' · '));
    if (ultimoCambio) partes.push(`último cambio de permisos ${relativo(ultimoCambio.creado_at)}${ultimoCambio.usuario_email ? ` (${ultimoCambio.usuario_email.split('@')[0]})` : ''}`);
    else if (ultimoCambio === null) partes.push('sin cambios de permisos registrados');
    partes.push(versionLabel());
    const atras = datos?.atrasadas?.length || 0;
    const stats = [
      { k: 'Usuarios', v: String(usuarios.length), sub: `${internos} internos · ${externos} externo${externos === 1 ? '' : 's'}` },
      { k: 'Activos 30 d', v: cargando ? '…' : String(activos30), sub: `de ${activos.length} activos`, color: sinEntrar ? (theme.orange || '#FF9500') : undefined },
      { k: 'Datos al día', v: datos ? `${datos.alDia}/${datos.total}` : '…', sub: datos ? (atras ? `${plural(atras, 'atrasada')}` : datos.porVencer.length ? `${datos.porVencer.length} por vencer` : 'sin pendientes') : 'leyendo frescura', color: datos ? (atras ? (theme.red || '#FF3B30') : (theme.green || '#34C759')) : undefined },
    ];
    return { titulo, sub: partes.join(' · '), stats, dot: sinEntrar > 0 || atras > 0 };
  }, [usuarios, actividad, ultimoCambio, datos, cargando, theme]);

  if (!puedeConfigurar(perfil)) return <SinAcceso motivo="Solo el Super Admin puede ver Administración." />;
  if (wizard) return <WizardNuevoUsuario onCancel={() => setWizard(false)} onCreated={() => { setWizard(false); refetch(); }} />;
  if (cargando && !usuarios.length) return <Cargando pantalla="configuracion" />;

  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.66)' : 'rgba(245,245,247,0.66)';
  return (
    <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <Hero eyebrow="Interno · Administración" titulo={hero.titulo} sub={hero.sub} dot={hero.dot} stats={hero.stats}>
        <button type="button" onClick={() => irAPagina('actualizacion')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, padding: 0, border: 0, background: 'transparent', cursor: 'pointer', color: theme.accentDark || theme.accent, fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 500 }}>
          Abrir importador central <ArrowRight size={12} strokeWidth={2.2} />
        </button>
        {error && <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>No se pudieron leer los usuarios: {error.message}</div>}
      </Hero>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Segmented size="md" options={SECCIONES} value={seccion} onChange={setSeccion} />
        <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 'auto' }}>Tus preferencias personales (tema, menú, notificaciones) están en tu avatar.</span>
      </div>

      {seccion === 'usuarios' && (
        <UsuariosPermisos usuarios={usuarios} cargando={cargando} actividad={actividad} actualizar={actualizar} refetch={refetch} miUserId={miUserId} onNuevo={() => setWizard(true)} />
      )}
      {seccion === 'datos' && <SeccionDatos />}
      {seccion === 'notificaciones' && <SeccionNotificaciones usuarios={usuarios} actualizar={actualizar} />}
      {seccion === 'sistema' && <SeccionSistema />}
    </div>
  );
}
