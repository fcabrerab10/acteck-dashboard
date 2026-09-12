// Administración → Usuarios y permisos. Dos columnas: lista de usuarios (buscador · filtro · + Nuevo)
// y ficha del seleccionado (datos · permisos pestaña por pestaña con guardado al instante · acciones).
//
// Estructura guardada en perfiles.permisos (jsonb, ver src/lib/permisos.js):
//   { globales: { [pestanaGlobalId]: 'oculto'|'ver'|'edit' },
//     clientes: { digitalife|pcel|dicotech: { home, analisis, sellIn, estrategia, marketing, pagos, cartera } } }
// Cada cambio hace `update perfiles set permisos = …` (optimista en la cache de React Query; rollback + toast si falla).
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Copy, Eye, Pencil, UserX, UserCheck, Mail, ShieldCheck, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { relativo } from '../../lib/format';
import { apiFetch } from '../../lib/apiFetch';
import { CLIENTES, PESTANAS_CLIENTE, PAGINA_A_PERMISO_GLOBAL, nivelPestanaGlobal, nivelPestanaCliente, puedeVerInicio } from '../../lib/permisos';
import { construirArbol } from '../../components/nav/arbol';
import { AvatarImg } from '../../lib/avatar';
import { Panel, Pill, Segmented, Boton, toast } from '../../components/kit';
import { Modal, HojaLateral, Interruptor, hoverBg, suaveBg, hairline } from '../../components/perfil/comun';
import {
  TriNivel, Input, Eyebrow, PillTipo, estadoDe, tipoDe, TIPO_LABEL, gruposGlobales, normalizarPermisos, clientesConAcceso,
  contarNiveles, GLOBALES_EXTERNO, GLOBALES_SOLO_SUPER, NIVEL_LABEL, NIVEL_TONE, nivelDe, plural,
} from './comun';
import { activoReciente } from './useAdminData';

const FILTROS = [{ id: 'todos', label: 'Todos' }, { id: 'interno', label: 'Internos' }, { id: 'externo', label: 'Externos' }];
const ESPEJO = ['pcel', 'dicotech'];

export default function UsuariosPermisos({ usuarios, cargando, actividad, actualizar, refetch, miUserId, onNuevo }) {
  const { theme } = useTheme();
  const [busca, setBusca] = useState('');
  const [filtro, setFiltro] = useState('todos');
  const [selId, setSelId] = useState(null);

  const lista = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (usuarios || [])
      .filter((u) => filtro === 'todos' || tipoDe(u) === filtro)
      .filter((u) => !q || (u.nombre || '').toLowerCase().includes(q) || (u.email || '').toLowerCase().includes(q) || (u.puesto || '').toLowerCase().includes(q))
      .sort((a, b) => (b.activo === a.activo ? 0 : a.activo ? -1 : 1) || (a.nombre || '').localeCompare(b.nombre || ''));
  }, [usuarios, busca, filtro]);

  useEffect(() => {
    if (!lista.length) return;
    if (!selId || !lista.some((u) => u.id === selId)) setSelId(lista[0].id);
  }, [lista, selId]);
  const sel = usuarios.find((u) => u.id === selId) || null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 300px) 1fr', gap: 10, alignItems: 'start' }}>
      <Panel titulo="Usuarios" meta={cargando ? 'cargando…' : `${lista.length} de ${usuarios.length}`} padding="8px"
        acciones={<Boton primario icon={Plus} onClick={onNuevo}>Nuevo usuario</Boton>}>
        <div style={{ position: 'relative', marginBottom: 6 }}>
          <Search size={13} style={{ position: 'absolute', left: 9, top: 8.5, color: theme.textSubtle || theme.textMuted, pointerEvents: 'none' }} />
          <Input value={busca} onChange={setBusca} placeholder="Buscar por nombre, correo o puesto" style={{ paddingLeft: 28 }} />
        </div>
        <Segmented options={FILTROS} value={filtro} onChange={setFiltro} style={{ display: 'flex', marginBottom: 6 }} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!cargando && lista.length === 0 && <div style={{ padding: '16px 8px', fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>Sin usuarios que coincidan.</div>}
          {lista.map((u) => <FilaUsuario key={u.id} u={u} on={u.id === selId} soyYo={u.user_id === miUserId} ts={actividad?.[u.user_id]} onClick={() => setSelId(u.id)} />)}
        </div>
      </Panel>

      {sel
        ? <FichaUsuario key={sel.id} u={sel} usuarios={usuarios} actualizar={actualizar} refetch={refetch} soyYo={sel.user_id === miUserId} ts={actividad?.[sel.user_id]} />
        : <Panel><div style={{ padding: 24, fontSize: 12.5, color: theme.textMuted, textAlign: 'center' }}>{cargando ? 'Cargando usuarios…' : 'Elige un usuario de la lista.'}</div></Panel>}
    </div>
  );
}

function FilaUsuario({ u, on, soyYo, ts, onClick }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const est = estadoDe(u);
  const activo = activoReciente(ts);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, width: '100%', padding: '6px 8px', borderRadius: 9, border: 0, textAlign: 'left', cursor: 'pointer',
        background: on ? (theme.sidebarActive || 'rgba(0,122,255,0.10)') : hover ? hoverBg(theme) : 'transparent', fontFamily: TYPO.fontText,
        opacity: est.key === 'suspendido' ? 0.6 : 1, transition: `background ${DUR.state}ms ${EASE}`,
      }}>
      <AvatarImg perfil={u} size={32} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
          <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.nombre || u.email}</span>
          {soyYo && <Pill tone="blue" size="xs">Tú</Pill>}
          {u.es_super_admin && <ShieldCheck size={12} style={{ color: theme.purple || theme.accent, flexShrink: 0 }} title="Super admin" />}
        </span>
        <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {TIPO_LABEL[tipoDe(u)]}{u.puesto ? ` · ${u.puesto}` : ''} · {ts ? relativo(ts) : 'sin actividad'}
        </span>
      </span>
      <Pill tone={est.key === 'activo' ? (activo ? 'green' : 'gray') : est.tone} size="xs" dot>{est.key === 'activo' ? (activo ? 'activo' : 'inactivo') : est.key === 'pendiente' ? 'invitado' : 'inactivo'}</Pill>
    </button>
  );
}

// ─── Ficha ───
function FichaUsuario({ u, usuarios, actualizar, refetch, soyYo, ts }) {
  const { theme } = useTheme();
  const permisos = useMemo(() => normalizarPermisos(u.permisos), [u.permisos]);
  const tipo = tipoDe(u);
  const externo = tipo === 'externo';
  const esSuper = !!u.es_super_admin;
  const est = estadoDe(u);
  const [editar, setEditar] = useState(false);
  const [copiar, setCopiar] = useState(false);
  const [verComo, setVerComo] = useState(false);
  const [espejo, setEspejo] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const propios = clientesConAcceso(permisos);
  const cnt = contarNiveles(permisos);

  const guardar = async (nuevo, msg = 'Permiso guardado') => {
    try { await actualizar(u.id, { permisos: nuevo }); toast.ok(msg); }
    catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); }
  };
  const setGlobal = (id, nivel) => guardar({ ...permisos, globales: { ...permisos.globales, [id]: nivel } });
  const setSensible = (on) => guardar({ ...permisos, sensible: !!on }, on ? 'Ya ve información sensible' : 'Información sensible oculta');
  // perfiles.se_evalua (migración 20260911_equipo_se_evalua.sql): mismo patrón optimista + rollback de `actualizar`.
  const setSeEvalua = async (on) => {
    try { await actualizar(u.id, { se_evalua: !!on }); toast.ok(on ? 'Se evalúa mensualmente' : 'Ya no se evalúa mensualmente'); }
    catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); }
  };
  const setCliente = (ck, pestana, nivel) => {
    const clientes = { ...permisos.clientes, [ck]: { ...permisos.clientes[ck], [pestana]: nivel } };
    if (ck === 'digitalife' && espejo) for (const k of ESPEJO) clientes[k] = { ...clientes.digitalife };
    guardar({ ...permisos, clientes });
  };
  const setTodasCliente = (ck, nivel) => {
    const fila = Object.fromEntries(PESTANAS_CLIENTE.map((p) => [p.id, nivel]));
    const clientes = { ...permisos.clientes, [ck]: fila };
    if (ck === 'digitalife' && espejo) for (const k of ESPEJO) clientes[k] = { ...fila };
    guardar({ ...permisos, clientes }, `${NIVEL_LABEL[nivel]} en todas las pestañas`);
  };
  const toggleEspejo = (on) => {
    setEspejo(on);
    if (on) {
      const clientes = { ...permisos.clientes };
      for (const k of ESPEJO) clientes[k] = { ...permisos.clientes.digitalife };
      guardar({ ...permisos, clientes }, 'Niveles de Digitalife aplicados a PCEL y Dicotech');
    }
  };
  const darAcceso = (ck) => setCliente(ck, 'home', 'ver');

  const copiarDe = async (origen) => {
    setCopiar(false);
    await guardar(normalizarPermisos(origen.permisos), `Permisos copiados de ${origen.nombre || origen.email}`);
  };

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
    if (!window.confirm(suspender ? `¿Desactivar a ${u.nombre}? Deja de poder entrar al dashboard.` : `¿Activar a ${u.nombre}?`)) return;
    llamarAdmin('/api/admin/toggle-suspend', { perfil_id: u.id, suspended: suspender }, suspender ? 'Usuario desactivado' : 'Usuario activado');
  };
  const reenviar = () => llamarAdmin('/api/admin/resend-invitation', { email: u.email }, `Invitación reenviada a ${u.email}`);

  const grupos = useMemo(() => gruposGlobales(), []);
  const activoRec = activoReciente(ts);

  // Regla para pestañas globales: super admin → todo fijo; externo → sólo GLOBALES_EXTERNO; 'configuracion' nunca desde la UI.
  const motivoGlobal = (id) => {
    if (esSuper) return 'Super admin: acceso total por código';
    if (GLOBALES_SOLO_SUPER.has(id)) return 'Sólo el super admin (no se asigna desde aquí)';
    if (externo && !GLOBALES_EXTERNO.has(id)) return 'Los usuarios externos no ven pestañas globales';
    return null;
  };
  // Regla para clientes: externo con cliente propio → los demás en gris (con "Dar acceso").
  const motivoCliente = (ck) => {
    if (esSuper) return 'Super admin: acceso total por código';
    if (externo && propios.length && !propios.includes(ck)) return 'Externo: sólo su cliente';
    return null;
  };

  const sub = { fontSize: 11, color: theme.textMuted };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
      <Panel padding="12px 14px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <AvatarImg perfil={u} size={40} />
          <div style={{ flex: 1, minWidth: 180 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>{u.nombre || '—'}</span>
              {soyYo && <Pill tone="blue" size="xs">Tú</Pill>}
              {esSuper && <Pill tone="purple" size="xs">Super admin</Pill>}
              <PillTipo u={u} />
              <Pill tone={est.tone} size="xs" dot>{est.label}</Pill>
            </div>
            <div style={{ ...sub, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
              {u.email}{u.puesto ? ` · ${u.puesto}` : ''} · {ts ? `última actividad ${relativo(ts)}` : 'sin actividad registrada'}{!activoRec && ts ? ' · sin entrar en 30 días' : ''}
            </div>
            <div style={{ ...sub, marginTop: 2 }}>
              {esSuper ? 'Acceso total a todas las pestañas.' : `${plural(cnt.edit, 'pestaña con edición', 'pestañas con edición')} · ${cnt.ver} sólo lectura · ${propios.length ? propios.map((k) => CLIENTES.find((c) => c.id === k)?.label).join(', ') : 'sin clientes'}`}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Boton icon={Pencil} onClick={() => setEditar(true)}>Editar datos</Boton>
            {est.key === 'pendiente' && <Boton icon={Mail} onClick={reenviar} disabled={ocupado}>Reenviar invitación</Boton>}
            {!esSuper && !soyYo && (
              <Boton icon={u.activo ? UserX : UserCheck} peligro={!!u.activo} onClick={toggleActivo} disabled={ocupado}>{u.activo ? 'Desactivar' : 'Activar'}</Boton>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10, paddingTop: 10, borderTop: `1px solid ${hairline(theme)}` }}>
          <Boton icon={Copy} onClick={() => setCopiar(true)} disabled={esSuper} title={esSuper ? 'El super admin no necesita permisos' : 'Copiar todos los permisos de otro usuario'}>Copiar permisos de…</Boton>
          <Boton icon={Eye} onClick={() => setVerComo(true)}>Ver como</Boton>
          <span style={{ ...sub, alignSelf: 'center', marginLeft: 'auto' }}>Cada cambio se guarda al instante.</span>
        </div>
      </Panel>

      <Panel titulo="Información sensible" meta="márgenes, utilidad, contribución y costos" padding="6px 12px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: theme.text, letterSpacing: '-0.005em' }}>Márgenes, utilidad, contribución y costos</span>
            <span style={{ display: 'block', fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>
              {esSuper ? 'Super admin: siempre visible.' : 'Sin esto ve ventas, cuotas, mix e inventario en piezas, pero no MC %, contribución, utilidad, costos ni el valor del inventario a costo, en ninguna pantalla (web y móvil).'}
            </span>
          </span>
          <Interruptor theme={theme} on={esSuper || permisos.sensible === true} onChange={esSuper ? undefined : setSensible} title={esSuper ? 'Super admin: acceso total por código' : 'Mostrar u ocultar información sensible'} />
        </div>
      </Panel>

      <Panel titulo="Evaluación mensual" meta="Actividad del equipo · bono y evaluación" padding="6px 12px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: theme.text, letterSpacing: '-0.005em' }}>Se evalúa mensualmente</span>
            <span style={{ display: 'block', fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>
              {externo ? 'Los usuarios externos no se evalúan.' : 'Con esto su tarjeta y su hoja en Actividad del equipo muestran evaluación cualitativa, tareas, ajustes y bono (variable fija + comisión sobre facturación).'}
            </span>
          </span>
          <Interruptor theme={theme} on={!!u.se_evalua} onChange={externo ? undefined : setSeEvalua} title={externo ? 'Sólo usuarios internos' : 'Activar o desactivar la evaluación mensual'} />
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 10, alignItems: 'start' }}>
        <Panel titulo="Pestañas globales" meta={externo ? 'externo: sólo Resumen de Clientes' : 'en el orden del menú'} padding="4px 0 6px">
          {grupos.map((g) => (
            <div key={g.id}>
              <Eyebrow style={{ padding: '8px 12px 3px' }}>{g.label}</Eyebrow>
              {g.pestanas.map((p) => {
                const motivo = motivoGlobal(p.id);
                const valor = esSuper ? 'edit' : nivelDe(permisos.globales[p.id]);
                return <FilaPermiso key={p.id} label={p.label} desc={p.desc} value={valor} disabled={!!motivo} title={motivo || p.desc} onChange={(n) => setGlobal(p.id, n)} />;
              })}
            </div>
          ))}
        </Panel>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CLIENTES.map((c) => {
            const motivo = motivoCliente(c.id);
            const vals = permisos.clientes[c.id] || {};
            const acceso = Object.values(vals).filter((v) => v === 'ver' || v === 'edit').length;
            return (
              <Panel key={c.id} titulo={c.label} meta={esSuper ? 'acceso total' : acceso ? `${acceso}/${PESTANAS_CLIENTE.length} con acceso` : 'sin acceso'} padding="4px 0 6px"
                acciones={!esSuper && !motivo && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {c.id === 'digitalife' && !externo && (
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: theme.textMuted, cursor: 'pointer', userSelect: 'none' }} title="Copia ahora los niveles de Digitalife a PCEL y Dicotech y los mantiene iguales mientras esté marcado">
                        <input type="checkbox" checked={espejo} onChange={(e) => toggleEspejo(e.target.checked)} style={{ accentColor: theme.accent, margin: 0 }} />
                        aplicar a PCEL y Dicotech
                      </label>
                    )}
                    <Atajos onTodas={(n) => setTodasCliente(c.id, n)} />
                  </div>
                )}>
                {motivo && !esSuper && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '6px 12px 2px', fontSize: 11, color: theme.textMuted }}>
                    <span>{motivo}.</span>
                    <button type="button" onClick={() => darAcceso(c.id)} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', padding: 0 }}>Dar acceso a {c.label}</button>
                  </div>
                )}
                {PESTANAS_CLIENTE.map((p) => (
                  <FilaPermiso key={p.id} label={p.label} desc={p.desc} value={esSuper ? 'edit' : nivelDe(vals[p.id])} disabled={!!motivo} title={motivo || p.desc} onChange={(n) => setCliente(c.id, p.id, n)} />
                ))}
              </Panel>
            );
          })}
        </div>
      </div>

      <ModalEditarDatos abierto={editar} onClose={() => setEditar(false)} u={u} actualizar={actualizar} onToggleActivo={!esSuper && !soyYo ? toggleActivo : null} />
      <ModalCopiarDe abierto={copiar} onClose={() => setCopiar(false)} u={u} usuarios={usuarios} onElegir={copiarDe} />
      <HojaVerComo abierto={verComo} onClose={() => setVerComo(false)} u={{ ...u, permisos }} />
    </div>
  );
}

function Atajos({ onTodas }) {
  const { theme } = useTheme();
  const b = { border: 0, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, cursor: 'pointer', padding: '2px 4px' };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, whiteSpace: 'nowrap' }} title="Aplicar a las 7 pestañas de este cliente">
      <button type="button" style={b} onClick={() => onTodas('oculto')}>ocultar todo</button>·
      <button type="button" style={{ ...b, color: theme.accent }} onClick={() => onTodas('ver')}>ver todo</button>·
      <button type="button" style={{ ...b, color: theme.green }} onClick={() => onTodas('edit')}>editar todo</button>
    </span>
  );
}

function FilaPermiso({ label, desc, value, onChange, disabled, title }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 12px', minHeight: 30, opacity: disabled ? 0.55 : 1 }}>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 12.5, fontWeight: 500, color: theme.text, letterSpacing: '-0.005em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
        {desc && <span style={{ display: 'block', fontSize: 10.5, color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{desc}</span>}
      </span>
      <TriNivel value={value} onChange={onChange} disabled={disabled} title={title} />
    </div>
  );
}

// ─── Editar datos (nombre · puesto · tipo · activo) ───
function ModalEditarDatos({ abierto, onClose, u, actualizar, onToggleActivo }) {
  const { theme } = useTheme();
  const [f, setF] = useState({ nombre: '', puesto: '', tipo: 'interno' });
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierto) setF({ nombre: u.nombre || '', puesto: u.puesto || '', tipo: tipoDe(u) }); }, [abierto, u]);
  const guardar = async () => {
    setGuardando(true);
    try {
      const patch = { nombre: f.nombre.trim() || u.nombre, puesto: f.puesto.trim() || null, tipo: f.tipo };
      if (f.tipo === 'externo' && tipoDe(u) !== 'externo') {
        // Al volverse externo, las globales que no aplican se ocultan (misma regla que el wizard).
        const p = normalizarPermisos(u.permisos);
        const globales = Object.fromEntries(Object.entries(p.globales).map(([k, v]) => [k, GLOBALES_EXTERNO.has(k) ? v : 'oculto']));
        patch.permisos = { ...p, globales };
      }
      await actualizar(u.id, patch);
      toast.ok('Datos guardados');
      onClose();
    } catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); }
    finally { setGuardando(false); }
  };
  const lbl = { fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginBottom: 4, display: 'block' };
  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} titulo="Editar datos" sub={u.email} ancho={420}
      pie={<><Boton onClick={onClose}>Cancelar</Boton><Boton primario onClick={guardar} disabled={guardando}>{guardando ? 'Guardando…' : 'Guardar'}</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '6px 0 2px' }}>
        <div><span style={lbl}>Nombre</span><Input value={f.nombre} onChange={(v) => setF({ ...f, nombre: v })} autoFocus /></div>
        <div><span style={lbl}>Puesto</span><Input value={f.puesto} onChange={(v) => setF({ ...f, puesto: v })} placeholder="Sólo informativo" /></div>
        <div>
          <span style={lbl}>Tipo</span>
          <Segmented size="md" value={f.tipo} onChange={(v) => setF({ ...f, tipo: v })} options={[{ id: 'interno', label: 'Interno' }, { id: 'externo', label: 'Externo' }]} />
          <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4 }}>{f.tipo === 'interno' ? 'Equipo de Acteck: puede tener pestañas globales.' : 'Empleado del cliente: sólo ve lo que le asignes de su cliente.'}</div>
        </div>
        {onToggleActivo && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 10, background: suaveBg(theme) }}>
            <div><div style={{ fontSize: 12.5, fontWeight: 500, color: theme.text }}>Activo</div><div style={{ fontSize: 11, color: theme.textMuted }}>Si se desactiva, no puede entrar al dashboard.</div></div>
            <Interruptor theme={theme} on={!!u.activo} onChange={() => onToggleActivo()} />
          </div>
        )}
      </div>
    </Modal>
  );
}

// ─── Copiar permisos de otro usuario ───
function ModalCopiarDe({ abierto, onClose, u, usuarios, onElegir }) {
  const { theme } = useTheme();
  const [pend, setPend] = useState(null);
  const candidatos = (usuarios || []).filter((x) => x.id !== u.id && !x.es_super_admin);
  useEffect(() => { if (!abierto) setPend(null); }, [abierto]);
  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} titulo="Copiar permisos de…" sub={`Sustituye TODOS los permisos de ${u.nombre || u.email}. El tipo (interno/externo) no cambia.`} ancho={440}
      pie={pend ? <><Boton onClick={() => setPend(null)}>Atrás</Boton><Boton primario onClick={() => onElegir(pend)}>Copiar de {pend.nombre || pend.email}</Boton></> : <Boton onClick={onClose}>Cancelar</Boton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '4px 0' }}>
        {candidatos.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted, padding: 12 }}>No hay otros usuarios de quien copiar.</div>}
        {candidatos.map((x) => {
          const p = normalizarPermisos(x.permisos); const c = contarNiveles(p); const cl = clientesConAcceso(p);
          const on = pend?.id === x.id;
          return (
            <button key={x.id} type="button" onClick={() => setPend(x)}
              style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 8px', borderRadius: 9, border: 0, textAlign: 'left', cursor: 'pointer', fontFamily: TYPO.fontText,
                background: on ? (theme.sidebarActive || 'rgba(0,122,255,0.10)') : 'transparent' }}>
              <AvatarImg perfil={x} size={32} />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: theme.text }}>{x.nombre || x.email} <span style={{ fontWeight: 400, color: theme.textMuted }}>· {TIPO_LABEL[tipoDe(x)]}</span></span>
                <span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted }}>{c.edit} con edición · {c.ver} sólo lectura · {cl.length ? cl.map((k) => CLIENTES.find((q) => q.id === k)?.label).join(', ') : 'sin clientes'}</span>
              </span>
              <ChevronRight size={13} style={{ color: theme.textSubtle || theme.textMuted }} />
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

// ─── Ver como · árbol de navegación que vería ese usuario (construirArbol con su perfil, sin cambiar sesión) ───
function HojaVerComo({ abierto, onClose, u }) {
  const { theme } = useTheme();
  const arbol = useMemo(() => (abierto ? construirArbol(u) : []), [abierto, u]);
  const total = arbol.reduce((s, g) => s + g.nodos.length + (g.clientes || []).reduce((t, c) => t + c.nodos.length, 0), 0);
  const nivelGlobal = (n) => {
    if (n.pagina === 'inicio') return puedeVerInicio(u) ? 'ver' : 'oculto';
    const id = PAGINA_A_PERMISO_GLOBAL[n.pagina];
    return id === '__super_admin_only__' ? (u.es_super_admin ? 'edit' : 'oculto') : nivelPestanaGlobal(u, id);
  };
  const fila = (n, nivel) => (
    <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', borderTop: `1px solid ${hairline(theme)}`, fontSize: 12.5, color: theme.text }}>
      {n.icon && <n.icon size={14} strokeWidth={1.8} style={{ color: n.color || theme.textMuted, flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.label}{n.disabled ? <span style={{ color: theme.textMuted }}> · {n.hint}</span> : null}</span>
      <Pill tone={NIVEL_TONE[nivel]} size="xs">{NIVEL_LABEL[nivel]}</Pill>
    </div>
  );
  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} titulo={`Ver como ${u.nombre || u.email}`} sub={`Menú que vería este usuario · ${plural(total, 'pantalla')}. Vista simulada: tu sesión no cambia.`} ancho={420}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        {arbol.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: 14, textAlign: 'center' }}>Sin acceso a ninguna pantalla: al entrar vería el aviso "Sin acceso".</div>}
        {arbol.map((g) => (
          <div key={g.id} style={{ borderRadius: 12, border: `1px solid ${hairline(theme)}`, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 10px', background: suaveBg(theme) }}>
              {g.icon && <g.icon size={14} strokeWidth={2} style={{ color: g.color || theme.textMuted }} />}
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text }}>{g.label}</span>
            </div>
            {g.nodos.map((n) => fila(n, nivelGlobal(n)))}
            {(g.clientes || []).map((c) => (
              <div key={c.key}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px 2px', borderTop: `1px solid ${hairline(theme)}` }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, letterSpacing: '0.03em', textTransform: 'uppercase' }}>{c.label}</span>
                </div>
                {c.nodos.map((n) => fila(n, nivelPestanaCliente(u, c.key, n.pagina)))}
              </div>
            ))}
          </div>
        ))}
      </div>
    </HojaLateral>
  );
}
