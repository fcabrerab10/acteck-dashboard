// Ficha de un usuario en el celular (pantalla empujada desde Usuarios.jsx).
//   Hero (correo, puesto, última actividad, conteo de pestañas) · interruptores "Información sensible" y
//   "Se evalúa mensualmente" · permisos pestaña por pestaña agrupados como el menú (Dirección General,
//   Dirección Comercial, Clientes propios, Interno) con el TriNivel táctil · acciones (copiar permisos de…,
//   ver como, reenviar invitación, activar/desactivar).
//
// Guardado: `actualizar(id, patch)` de useAdminData (update perfiles optimista con rollback). Cada cambio
// muestra un toast con "Deshacer" que vuelve a guardar el valor anterior. Lee el perfil de la cache de
// React Query (useUsuariosAdmin) para reflejar el optimismo al instante.
import React, { useMemo, useState } from 'react';
import { Copy, Eye, Mail, UserX, UserCheck } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { AvatarImg } from '../../../lib/avatar';
import { relativo } from '../../../lib/format';
import { apiFetch } from '../../../lib/apiFetch';
import { CLIENTES, PESTANAS_CLIENTE } from '../../../lib/permisos';
import {
  gruposGlobales, normalizarPermisos, clientesConAcceso, contarNiveles, estadoDe, tipoDe, TIPO_LABEL,
  GLOBALES_EXTERNO, GLOBALES_SOLO_SUPER, NIVEL_LABEL, nivelDe, plural,
} from '../../../modules/configuracion/comun';
import { useUsuariosAdmin, activoReciente } from '../../../modules/configuracion/useAdminData';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, ListaAgrupada, Fila, Cabecera, BotonGrande, Pill, Vacio, toast } from '../../piezas';
import { FilaPermiso, FilaToggle, Atajos, toastDeshacer } from './piezas';
import { HojaCopiarDe, HojaVerComo } from './hojas';

const ESPEJO = ['pcel', 'dicotech'];

export default function FichaUsuario({ id, actualizar, refetch, miUserId, ts }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { usuarios } = useUsuariosAdmin();
  const u = usuarios.find((x) => x.id === id) || null;

  const [copiar, setCopiar] = useState(false);
  const [verComo, setVerComo] = useState(false);
  const [espejo, setEspejo] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  const permisos = useMemo(() => normalizarPermisos(u?.permisos), [u?.permisos]);
  const grupos = useMemo(() => gruposGlobales(), []);

  if (!u) return (<><Cabecera onVolver={nav.pop} /><Vacio icon={null} titulo="Usuario no encontrado" sub="Puede que se haya borrado o que la lista cambiara." /></>);

  const tipo = tipoDe(u);
  const externo = tipo === 'externo';
  const esSuper = !!u.es_super_admin;
  const soyYo = u.user_id === miUserId;
  const est = estadoDe(u);
  const propios = clientesConAcceso(permisos);
  const cnt = contarNiveles(permisos);

  // ── Guardado (optimista + rollback en useAdminData) con Deshacer ──
  const guardarPermisos = async (nuevo, msg = 'Permiso guardado', previo = permisos) => {
    try {
      await actualizar(u.id, { permisos: nuevo });
      toastDeshacer(msg, async () => {
        try { await actualizar(u.id, { permisos: previo }); toast.ok('Deshecho'); }
        catch (e) { toast.error(`No se pudo deshacer: ${e.message || e}`); }
      });
    } catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); }
  };
  const setGlobal = (pid, nivel) => guardarPermisos({ ...permisos, globales: { ...permisos.globales, [pid]: nivel } }, `${NIVEL_LABEL[nivel]}`);
  const setCliente = (ck, pestana, nivel) => {
    const clientes = { ...permisos.clientes, [ck]: { ...permisos.clientes[ck], [pestana]: nivel } };
    if (ck === 'digitalife' && espejo) for (const k of ESPEJO) clientes[k] = { ...clientes.digitalife };
    guardarPermisos({ ...permisos, clientes }, `${NIVEL_LABEL[nivel]}${ck === 'digitalife' && espejo ? ' en los tres clientes' : ''}`);
  };
  const setTodasCliente = (ck, nivel) => {
    const filaNiveles = Object.fromEntries(PESTANAS_CLIENTE.map((p) => [p.id, nivel]));
    const clientes = { ...permisos.clientes, [ck]: filaNiveles };
    if (ck === 'digitalife' && espejo) for (const k of ESPEJO) clientes[k] = { ...filaNiveles };
    guardarPermisos({ ...permisos, clientes }, `${NIVEL_LABEL[nivel]} en todas las pestañas`);
  };
  const darAcceso = (ck) => setCliente(ck, 'home', 'ver');
  const toggleEspejo = (on) => {
    setEspejo(on);
    if (!on) return;
    const clientes = { ...permisos.clientes };
    for (const k of ESPEJO) clientes[k] = { ...permisos.clientes.digitalife };
    guardarPermisos({ ...permisos, clientes }, 'Digitalife aplicado a PCEL y Dicotech');
  };
  const setSensible = (on) => guardarPermisos({ ...permisos, sensible: !!on }, on ? 'Ya ve información sensible' : 'Información sensible oculta');
  const setSeEvalua = async (on) => {
    const previo = !!u.se_evalua;
    try {
      await actualizar(u.id, { se_evalua: !!on });
      toastDeshacer(on ? 'Se evalúa mensualmente' : 'Ya no se evalúa', () => actualizar(u.id, { se_evalua: previo }).catch(() => {}));
    } catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); }
  };
  const copiarDe = async (origen) => {
    setCopiar(false);
    await guardarPermisos(normalizarPermisos(origen.permisos), `Permisos copiados de ${origen.nombre || origen.email}`);
  };

  // ── Acciones que pasan por /api/admin (mismas rutas de la web) ──
  const llamarAdmin = async (ruta, body, okMsg) => {
    setOcupado(true);
    try {
      const r = await apiFetch(ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      toast.ok(j.message || okMsg);
      await refetch?.();
    } catch (e) { toast.error(`Error: ${e.message}`); }
    finally { setOcupado(false); }
  };
  const toggleActivo = () => {
    const suspender = !!u.activo;
    if (!window.confirm(suspender ? `¿Desactivar a ${u.nombre || u.email}? Deja de poder entrar al dashboard.` : `¿Activar a ${u.nombre || u.email}?`)) return;
    llamarAdmin('/api/admin/toggle-suspend', { perfil_id: u.id, suspended: suspender }, suspender ? 'Usuario desactivado' : 'Usuario activado');
  };
  const reenviar = () => llamarAdmin('/api/admin/resend-invitation', { email: u.email }, `Invitación reenviada a ${u.email}`);

  // ── Reglas (idénticas a la web) ──
  const motivoGlobal = (pid) => {
    if (esSuper) return 'Super admin: acceso total';
    if (GLOBALES_SOLO_SUPER.has(pid)) return 'Sólo el super admin';
    if (externo && !GLOBALES_EXTERNO.has(pid)) return 'Los externos no ven pestañas globales';
    return null;
  };
  const motivoCliente = (ck) => {
    if (esSuper) return 'Super admin: acceso total';
    if (externo && propios.length && !propios.includes(ck)) return 'Externo: sólo su cliente';
    return null;
  };

  const reciente = activoReciente(ts);
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo={u.nombre || u.email} sub={`${TIPO_LABEL[tipo]}${u.puesto ? ` · ${u.puesto}` : ''}`} derecha={<AvatarImg perfil={u} size={44} />} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
        <HeroM eyebrow={est.key === 'activo' ? (reciente ? 'Activo' : 'Sin entrar en 30 días') : est.label}
          frase={u.email}
          sub={esSuper ? 'Acceso total a todas las pestañas por código.' : ts ? `Última actividad ${relativo(ts)}.` : 'Sin actividad registrada.'}
          stats={[
            { k: 'Edita', v: esSuper ? 'Todo' : String(cnt.edit), sub: esSuper ? 'super admin' : 'pestañas' },
            { k: 'Sólo ve', v: esSuper ? '—' : String(cnt.ver), sub: 'pestañas' },
            { k: 'Clientes', v: esSuper ? '3' : String(propios.length), sub: propios.length ? propios.map((k) => CLIENTES.find((c) => c.id === k)?.label).join(', ') : 'sin clientes' },
          ]} />

        <div style={{ padding: '0 16px', display: 'flex', gap: 8 }}>
          <BotonGrande icon={Eye} onClick={() => setVerComo(true)} style={{ height: 44, fontSize: 14 }}>Ver como</BotonGrande>
          <BotonGrande icon={Copy} disabled={esSuper} onClick={() => setCopiar(true)} style={{ height: 44, fontSize: 14 }}>Copiar de…</BotonGrande>
        </div>

        <ListaAgrupada titulo="Acceso" pie="Cada cambio se guarda al instante en su perfil.">
          <FilaToggle titulo="Información sensible" on={esSuper || permisos.sensible === true} disabled={esSuper} onChange={setSensible}
            sub={esSuper ? 'Super admin: siempre visible.' : 'Márgenes, utilidad, contribución y costos, en web y celular.'} />
          <FilaToggle titulo="Se evalúa mensualmente" on={!!u.se_evalua} disabled={externo} onChange={setSeEvalua}
            sub={externo ? 'Los externos no se evalúan.' : 'Aparece en Actividad del equipo con evaluación y bono.'} />
          {est.key === 'pendiente' && (
            <Fila icon={Mail} color={theme.orange} titulo="Reenviar invitación" sub={u.email} chevron={false} onClick={ocupado ? undefined : reenviar} />
          )}
          {!esSuper && !soyYo && (
            <Fila icon={u.activo ? UserX : UserCheck} color={u.activo ? theme.red : theme.green}
              titulo={u.activo ? 'Desactivar usuario' : 'Activar usuario'} sub={u.activo ? 'Deja de poder entrar al dashboard' : 'Vuelve a tener acceso'}
              chevron={false} onClick={ocupado ? undefined : toggleActivo} />
          )}
        </ListaAgrupada>

        {/* ── Pestañas globales, agrupadas como el menú ── */}
        {grupos.map((g) => (
          <ListaAgrupada key={g.id} titulo={g.label} meta={String(g.pestanas.length)}>
            {g.pestanas.map((p) => {
              const motivo = motivoGlobal(p.id);
              return (
                <FilaPermiso key={p.id} label={p.label} value={esSuper ? 'edit' : nivelDe(permisos.globales[p.id])}
                  disabled={!!motivo} motivo={motivo} onChange={(n) => setGlobal(p.id, n)} />
              );
            })}
          </ListaAgrupada>
        ))}

        {/* ── Clientes propios, pestaña por pestaña ── */}
        {CLIENTES.map((c) => {
          const motivo = motivoCliente(c.id);
          const vals = permisos.clientes[c.id] || {};
          const acceso = Object.values(vals).filter((v) => v === 'ver' || v === 'edit').length;
          return (
            <ListaAgrupada key={c.id} titulo={c.label} meta={esSuper ? 'acceso total' : acceso ? `${acceso}/${PESTANAS_CLIENTE.length}` : 'sin acceso'}
              accion={!esSuper && !motivo ? <Atajos onTodas={(n) => setTodasCliente(c.id, n)} /> : null}>
              {motivo && !esSuper && (
                <Fila chevron={false} alto={44} titulo={motivo} sub={externo && !propios.includes(c.id) ? `Tocar para dar acceso a ${c.label}` : undefined}
                  onClick={externo && !propios.includes(c.id) ? () => darAcceso(c.id) : undefined} />
              )}
              {c.id === 'digitalife' && !externo && !esSuper && (
                <FilaToggle alto={48} titulo="Aplicar a PCEL y Dicotech" on={espejo} onChange={toggleEspejo}
                  sub="Copia estos niveles a los otros dos clientes y los mantiene iguales." />
              )}
              {PESTANAS_CLIENTE.map((p) => (
                <FilaPermiso key={p.id} label={p.label} value={esSuper ? 'edit' : nivelDe(vals[p.id])} disabled={!!motivo} motivo={motivo}
                  onChange={(n) => setCliente(c.id, p.id, n)} />
              ))}
            </ListaAgrupada>
          );
        })}

        <div style={{ padding: '0 28px', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontText, lineHeight: 1.45 }}>
          {esSuper ? 'El super admin ve y edita todo por código: sus niveles no se guardan.' : `${plural(cnt.edit + cnt.ver, 'pestaña visible', 'pestañas visibles')} de ${Object.keys(permisos.globales).length + CLIENTES.length * PESTANAS_CLIENTE.length}.`}
          {' '}Los datos (nombre, puesto, tipo) se editan desde la computadora.
        </div>
        {est.key === 'pendiente' && <div style={{ padding: '0 28px' }}><Pill tone="orange" size="xs" dot>invitación pendiente</Pill></div>}
      </div>

      <HojaCopiarDe abierto={copiar} onClose={() => setCopiar(false)} u={u} usuarios={usuarios} onElegir={copiarDe} />
      <HojaVerComo abierto={verComo} onClose={() => setVerComo(false)} u={{ ...u, permisos }} />
    </>
  );
}
