// PreferenciasHoja · "Todas las preferencias" (hoja lateral derecha).
//   <PreferenciasHoja abierto onClose perfil seccionInicial="cuenta|apariencia|menu|notificaciones|atajos|acerca" onNavegar onCerrarSesion />
// Grupos: Mi cuenta · Apariencia · Menú · Notificaciones · Atajos · Acerca de.
// Nombre y cargo se guardan en perfiles (nombre / puesto) vía RPC set_perfil_propio (la fila propia).
import React, { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import { Camera, Trash2, User, Briefcase, Mail, KeyRound, Sun, Moon, Palette, Monitor, Rows3, Rows4, Sparkles, LayoutGrid, Star, ArrowUp, ArrowDown, X, Bell, Keyboard, Info, LogOut, Shield, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { usePreferencias, setPreferencia, getPath, MODOS_MENU } from '../../lib/preferencias';
import { puedeConfigurar } from '../../lib/permisos';
import { versionLabel, APP_VERSION } from '../../lib/version';
import { AvatarImg, usePerfilVivo, aplicarPerfilLocal, quitarAvatar } from '../../lib/avatar';
import { construirArbol, resolverFavoritos, etiquetaNodo } from '../nav/arbol';
import { Boton, Segmented, toast } from '../kit';
import { HojaLateral, Seccion, Grupo, Fila, Interruptor, Campo, BotonIcono, hairline, suaveBg, cargoDe } from './comun';
import CambiarFoto from './CambiarFoto';

// Preferencias de notificaciones: las monta el módulo src/components/notificaciones si existe (otro agente);
// el glob devuelve {} cuando no está, así el build no depende de él.
const modsNotif = import.meta.glob('../notificaciones/index.{js,jsx}');
const cargadorNotif = Object.values(modsNotif)[0];
const PreferenciasNotificaciones = cargadorNotif
  ? lazy(() => cargadorNotif().then((m) => ({ default: m.PreferenciasNotificaciones || m.default || (() => null) })))
  : null;

const TEMAS = [
  { id: 'claro', label: 'Claro', icon: Sun }, { id: 'midnight', label: 'Midnight', icon: Moon },
  { id: 'marfil', label: 'Marfil', icon: Palette }, { id: 'auto', label: 'Auto', icon: Monitor },
];
const ATAJOS = [
  { teclas: ['⌘', 'K'], que: 'Buscar y saltar a cualquier pantalla' },
  { teclas: ['?'], que: 'Ver atajos de teclado' },
  { teclas: ['Esc'], que: 'Cerrar paneles, hojas y menús' },
  { teclas: ['⌘', '⇧', 'P'], que: 'Modo presentación' },
];
const CHANGELOG = [
  'Panel rápido desde el avatar: tema, menú, densidad y notificaciones al instante.',
  'Fotos de perfil ilustradas (tu oficina de noche o de día).',
  'Menú en tres modos: Barra, iPad y iPhone, con favoritos.',
  'Arranque ~6× más ligero: pantallas y datos bajo demanda.',
];

export default function PreferenciasHoja({ abierto, onClose, perfil: perfilProp, seccionInicial = 'cuenta', onNavegar, onCerrarSesion }) {
  const { theme, themeKey, setThemeKey } = useTheme();
  const perfil = usePerfilVivo(perfilProp);
  const { menu, favoritos, prefs, toggleFavorito, moverFavorito } = usePreferencias();
  const [foto, setFoto] = useState(false);
  const [sub, setSub] = useState(null); // 'notificaciones' → página anidada con su propio “Atrás”
  const refs = useRef({});

  useEffect(() => {
    if (!abierto) return;
    if (seccionInicial === 'notificaciones' && PreferenciasNotificaciones) { setSub('notificaciones'); return; }
    setSub(null);
    const t = setTimeout(() => refs.current[seccionInicial]?.scrollIntoView?.({ block: 'start', behavior: 'smooth' }), 380);
    return () => clearTimeout(t);
  }, [abierto, seccionInicial]);

  const ancla = (id) => (el) => { refs.current[id] = el; };
  const arbol = useMemo(() => { try { return construirArbol(perfil); } catch { return []; } }, [perfil]);
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos), [arbol, favoritos]);

  return (
    <>
      <HojaLateral abierto={abierto} onClose={onClose} theme={theme} titulo="Preferencias" sub="Los cambios se guardan al instante.">
        {sub === 'notificaciones' && PreferenciasNotificaciones ? (
          <Suspense fallback={<Fila theme={theme} primera icon={Bell} label="Cargando…" />}>
            <PreferenciasNotificaciones onVolver={() => setSub(null)} />
          </Suspense>
        ) : (<>
        {/* ─── Mi cuenta ─── */}
        <div ref={ancla('cuenta')} />
        <Seccion theme={theme}>Mi cuenta</Seccion>
        <Grupo theme={theme}>
          <Fila theme={theme} primera alto={64} label="Foto de perfil" sub={perfil?.avatar_url ? 'Ilustración de tu oficina' : 'Aún no tienes foto: se muestran tus iniciales'}
            icon={undefined}>
            <AvatarImg perfil={perfil} size={40} />
            <Boton icon={Camera} onClick={() => setFoto(true)}>{perfil?.avatar_url ? 'Cambiar' : 'Subir'}</Boton>
            {perfil?.avatar_url && (
              <BotonIcono theme={theme} icon={Trash2} title="Quitar foto" onClick={async () => {
                try { await quitarAvatar(perfil.user_id); toast.ok('Foto eliminada'); } catch (e) { toast.error(e.message); }
              }} />
            )}
          </Fila>
          <CampoPerfil theme={theme} perfil={perfil} campo="nombre" icon={User} label="Nombre para mostrar" placeholder="Tu nombre" />
          <CampoPerfil theme={theme} perfil={perfil} campo="puesto" icon={Briefcase} label="Cargo" placeholder="Ej. Director Comercial" />
          <Fila theme={theme} icon={Mail} label="Correo" sub="Lo administra el super admin">
            <span style={{ fontSize: 12.5, color: theme.textMuted, fontFamily: TYPO.fontText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 200 }}>{perfil?.email}</span>
          </Fila>
          <InicioSesion theme={theme} />
        </Grupo>

        {/* ─── Apariencia ─── */}
        <div ref={ancla('apariencia')} />
        <Seccion theme={theme}>Apariencia</Seccion>
        <Grupo theme={theme}>
          <Fila theme={theme} primera icon={Palette} label="Tema" sub={themeKey === 'auto' ? 'Sigue al sistema (claro ↔ Midnight)' : undefined}>
            <Segmented value={themeKey || theme.key} onChange={(v) => { setThemeKey(v); setPreferencia('tema', v); }}
              options={TEMAS.map((t) => ({ id: t.id, title: t.label, label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><t.icon size={12} strokeWidth={2} />{t.label}</span> }))} />
          </Fila>
          <Fila theme={theme} icon={Rows3} label="Densidad" sub="Alto de filas y espaciado del menú">
            <Segmented value={menu.densidad || 'comoda'} onChange={(v) => setPreferencia('menu.densidad', v)}
              options={[{ id: 'comoda', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Rows3 size={12} />Cómoda</span> }, { id: 'compacta', label: <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Rows4 size={12} />Compacta</span> }]} />
          </Fila>
          <Fila theme={theme} icon={Sparkles} label="Reducir movimiento" sub="Menos animaciones al navegar">
            <Interruptor theme={theme} on={!!getPath(prefs, 'apariencia.reducirMovimiento', false)} onChange={(v) => setPreferencia('apariencia.reducirMovimiento', v)} />
          </Fila>
        </Grupo>

        {/* ─── Menú ─── */}
        <div ref={ancla('menu')} />
        <Seccion theme={theme}>Menú</Seccion>
        <Grupo theme={theme}>
          <Fila theme={theme} primera icon={LayoutGrid} label="Modo" sub={MODOS_MENU.find((m) => m.id === menu.modo)?.desc}>
            <Segmented value={menu.modo} onChange={(v) => setPreferencia('menu.modo', v)} options={MODOS_MENU.map((m) => ({ id: m.id, label: m.id === 'sidebar' ? 'iPad' : m.label, title: m.desc }))} />
          </Fila>
          <Fila theme={theme} icon={Star} label="Favoritos" sub={favs.length ? `${favs.length} fijado${favs.length === 1 ? '' : 's'} · aparecen primero en el menú` : 'Marca la ★ en cualquier pantalla del menú'} />
          {favs.map((n, i) => (
            <div key={n.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 10px 4px 38px', borderTop: `1px solid ${hairline(theme)}`, fontFamily: TYPO.fontText }}>
              {n.color && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: n.color, flexShrink: 0 }} />}
              <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{etiquetaNodo(n)}</span>
              <BotonIcono theme={theme} icon={ArrowUp} size={24} title="Subir" onClick={() => moverFavorito(n.id, -1)} style={{ opacity: i === 0 ? 0.35 : 1 }} />
              <BotonIcono theme={theme} icon={ArrowDown} size={24} title="Bajar" onClick={() => moverFavorito(n.id, 1)} style={{ opacity: i === favs.length - 1 ? 0.35 : 1 }} />
              <BotonIcono theme={theme} icon={X} size={24} title="Quitar de favoritos" onClick={() => toggleFavorito(n.id)} />
            </div>
          ))}
          <Fila theme={theme} icon={LayoutGrid} label="Abrir en" sub="Qué pantalla ves al entrar">
            <Segmented value={menu.inicio || 'inicio'} onChange={(v) => setPreferencia('menu.inicio', v)} options={[{ id: 'inicio', label: 'Inicio' }, { id: 'ultima', label: 'Última vista' }]} />
          </Fila>
        </Grupo>

        {/* ─── Notificaciones ─── */}
        <div ref={ancla('notificaciones')} />
        <Seccion theme={theme}>Notificaciones</Seccion>
        <Grupo theme={theme}>
          {PreferenciasNotificaciones ? (
            <Fila theme={theme} primera icon={Bell} label="Preferencias de notificaciones" sub="Por área: inmediato, resumen o silencio · hora del resumen" onClick={() => setSub('notificaciones')}>
              <ChevronRight size={14} style={{ color: theme.textSubtle || theme.textMuted }} />
            </Fila>
          ) : (
            <Fila theme={theme} primera icon={Bell} label="Resumen diario" sub="Las preferencias de notificaciones llegan con el módulo de notificaciones.">
              <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{getPath(prefs, 'notificaciones.resumenHora', '13:00')}</span>
            </Fila>
          )}
        </Grupo>

        {/* ─── Atajos ─── */}
        <div ref={ancla('atajos')} />
        <Seccion theme={theme}>Atajos</Seccion>
        <Grupo theme={theme}>
          {ATAJOS.map((a, i) => (
            <Fila key={a.que} theme={theme} primera={i === 0} icon={i === 0 ? Keyboard : undefined} label={a.que} alto={40}>
              <span style={{ display: 'inline-flex', gap: 3 }}>
                {a.teclas.map((t) => (
                  <kbd key={t} style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, padding: '2px 6px', borderRadius: 5, background: suaveBg(theme), color: theme.textMuted, border: `1px solid ${hairline(theme)}` }}>{t}</kbd>
                ))}
              </span>
            </Fila>
          ))}
        </Grupo>

        {/* ─── Acerca de ─── */}
        <div ref={ancla('acerca')} />
        <Seccion theme={theme}>Acerca de</Seccion>
        <Grupo theme={theme}>
          <Fila theme={theme} primera icon={Info} label="Acteck Dashboard" sub={`Versión ${APP_VERSION}`}>
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, userSelect: 'text' }}>{versionLabel()}</span>
          </Fila>
          <div style={{ padding: '8px 12px 10px', borderTop: `1px solid ${hairline(theme)}` }}>
            <div style={{ fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, marginBottom: 6 }}>Novedades</div>
            <ul style={{ margin: 0, paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 3 }}>
              {CHANGELOG.map((c) => <li key={c} style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.4 }}>{c}</li>)}
            </ul>
          </div>
        </Grupo>

        {(puedeConfigurar(perfil) || onCerrarSesion) && (
          <Grupo theme={theme} style={{ marginTop: 18 }}>
            {puedeConfigurar(perfil) && <Fila theme={theme} primera icon={Shield} label="Administración" sub="Usuarios · datos · cuotas" onClick={() => { onClose?.(); onNavegar?.(null, 'configuracion'); }} />}
            {onCerrarSesion && <Fila theme={theme} primera={!puedeConfigurar(perfil)} icon={LogOut} label="Cerrar sesión" peligro onClick={() => { onClose?.(); onCerrarSesion(); }} />}
          </Grupo>
        )}
        </>)}
      </HojaLateral>
      <CambiarFoto abierto={foto} onClose={() => setFoto(false)} perfil={perfil} />
    </>
  );
}

// Campo editable de la fila propia (guarda al salir o con Enter).
function CampoPerfil({ theme, perfil, campo, icon, label, placeholder }) {
  const [valor, setValor] = useState(perfil?.[campo] || '');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { setValor(perfil?.[campo] || ''); }, [perfil?.[campo]]); // eslint-disable-line react-hooks/exhaustive-deps
  const guardar = async () => {
    const v = valor.trim();
    if (v === (perfil?.[campo] || '')) return;
    if (!DB_CONFIGURED || !perfil?.user_id) { aplicarPerfilLocal(perfil?.user_id, { [campo]: v || null }); return; }
    setGuardando(true);
    const { error } = await supabase.rpc('set_perfil_propio', { p: { [campo]: v } });
    setGuardando(false);
    if (error) { toast.error(`No se pudo guardar: ${error.message}`); setValor(perfil?.[campo] || ''); return; }
    aplicarPerfilLocal(perfil.user_id, { [campo]: v || null });
    toast.ok(campo === 'nombre' ? 'Nombre actualizado' : 'Cargo actualizado');
  };
  return (
    <Fila theme={theme} icon={icon} label={label} sub={campo === 'puesto' && !perfil?.puesto ? `Hoy se muestra: ${cargoDe(perfil) || '—'}` : undefined}>
      <Campo theme={theme} value={valor} onChange={setValor} placeholder={placeholder} disabled={guardando} onBlur={guardar}
        onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') { setValor(perfil?.[campo] || ''); e.currentTarget.blur(); } }} />
    </Fila>
  );
}

function InicioSesion({ theme }) {
  const [info, setInfo] = useState(null);
  useEffect(() => {
    if (!DB_CONFIGURED) return;
    supabase.auth.getUser().then(({ data }) => {
      const u = data?.user; if (!u) return;
      const prov = u.app_metadata?.provider || 'email';
      const fecha = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
      setInfo({ proveedor: prov === 'google' ? 'Google' : 'Correo y contraseña', fecha });
    }).catch(() => {});
  }, []);
  return (
    <Fila theme={theme} icon={KeyRound} label="Inicio de sesión" sub={info?.fecha ? `Último acceso ${info.fecha}` : undefined}>
      <span style={{ fontSize: 12.5, color: theme.textMuted }}>{info?.proveedor || '—'}</span>
    </Fila>
  );
}
