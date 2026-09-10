// Topbar · chrome común de la app (sin navegación: esa vive en src/components/nav/).
// ─ ChromeDerecho: badge de alertas · Actualizar datos (super admin) · campana (CentroNotificaciones) · avatar con menú
//   de usuario (Configuración, modo presentación, tema, modo de menú, versión, cerrar sesión).
// ─ Topbar (default): fila sticky con ChromeDerecho a la derecha; la usan los modos Sidebar e iPhone.
//   El modo Barra embebe <ChromeDerecho oscuro /> dentro de su barra.
import { useState, useEffect, useRef } from 'react';
import { Bell, Check, RefreshCw, LogOut, Settings, Eye, AlertTriangle, Clock, Palette, Search, LayoutPanelLeft, PanelTop, Smartphone, Keyboard } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { elevation, bordeFlotante } from '../lib/elevation';
import { EASE, DUR } from '../lib/motion';
import { versionLabel } from '../lib/version';
import { puedeConfigurar, puedeActualizarDatos } from '../lib/permisos';
import { usePreferencias, MODOS_MENU } from '../lib/preferencias';
import { BadgeAlertas } from './BandejaAlertas';
import { PanelPerfil } from './perfil';
import CentroNotificaciones from './notificaciones';

const ICONO_MODO = { barra: PanelTop, sidebar: LayoutPanelLeft, iphone: Smartphone };

// ═════════ Chrome derecho (reutilizable) ═════════
export function ChromeDerecho({ onNavegar, onCerrarSesion, perfilUsuario, modoPresent, onToggleModoPresent, oscuro = false, onAbrirPaleta, onAbrirAtajos, mostrarBuscar = false }) {
  const { theme, setThemeKey } = useTheme();
  const isMidnight = theme.key === 'midnight';
  const [openMenuId, setOpenMenuId] = useState(null); // 'update' | 'user'
  const rootRef = useRef(null);
  const closeTimerRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpenMenuId(null); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setOpenMenuId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const cancelarCierre = () => { if (closeTimerRef.current) { clearTimeout(closeTimerRef.current); closeTimerRef.current = null; } };
  const scheduleClose = (id) => {
    cancelarCierre();
    closeTimerRef.current = setTimeout(() => { setOpenMenuId((cur) => (cur === id ? null : cur)); closeTimerRef.current = null; }, 220);
  };
  const closeMenu = () => setOpenMenuId(null);

  const iniciales = (perfilUsuario?.nombre || 'U').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
  const colorIcono = oscuro ? 'rgba(255,255,255,0.82)' : theme.text;
  const hoverBg = oscuro || isMidnight ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)';
  const miniBtnStyle = {
    width: 28, height: 28, padding: 0, border: 0, background: 'transparent', borderRadius: 7, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: colorIcono, position: 'relative',
    transition: `background ${DUR.state}ms ${EASE}`,
  };
  const puedeActualizar = puedeActualizarDatos(perfilUsuario);

  return (
    <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 4, pointerEvents: 'auto' }}
      onMouseLeave={() => scheduleClose(openMenuId)} onMouseEnter={cancelarCierre}>
      {/* Alertas críticas/altas · va al Resumen global */}
      <BadgeAlertas onClick={() => onNavegar?.(null, 'resumen')} style={{ marginRight: 4 }} />

      {mostrarBuscar && (
        <button type="button" onClick={onAbrirPaleta} title="Buscar (⌘K)" style={{
          height: 28, padding: '0 8px 0 9px', border: 0, borderRadius: 999, cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: oscuro ? 'rgba(255,255,255,0.10)' : (isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)'),
          color: oscuro ? 'rgba(255,255,255,0.8)' : theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12,
        }}>
          <Search size={12} /> <span>Buscar</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9, padding: '1px 5px', borderRadius: 4, background: oscuro || isMidnight ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.06)' }}>⌘K</span>
        </button>
      )}

      {puedeActualizar && (
        <button type="button" onClick={() => setOpenMenuId(openMenuId === 'update' ? null : 'update')} title="Actualizar datos" style={miniBtnStyle}
          onMouseEnter={(e) => { e.currentTarget.style.background = hoverBg; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
          <RefreshCw size={14} />
          <span style={{ position: 'absolute', top: 4, right: 4, width: 6, height: 6, borderRadius: 999, background: theme.green || '#34C759' }} />
        </button>
      )}

      {/* Campana · slot del centro de notificaciones */}
      <span style={{ display: 'inline-flex', alignItems: 'center', color: colorIcono }}>
        <CentroNotificaciones onNavegar={onNavegar} />
      </span>

      {/* Avatar → Panel rápido de perfil y preferencias (V3) */}
      <span style={{ marginLeft: 4, display: 'inline-flex', alignItems: 'center', boxShadow: modoPresent ? `0 0 0 2px ${theme.green || '#34C759'}` : 'none', borderRadius: 999 }}>
        <PanelPerfil perfil={perfilUsuario} onNavegar={onNavegar} onCerrarSesion={onCerrarSesion}
          filasExtra={[{ label: 'Modo presentación', toggle: !!modoPresent, cerrar: false, onClick: onToggleModoPresent }]} />
      </span>

      {openMenuId === 'update' && (
        <UpdatePanel theme={theme} isMidnight={isMidnight} onClose={closeMenu} onMouseEnter={cancelarCierre} onMouseLeave={() => scheduleClose('update')} />
      )}
    </div>
  );
}

// ═════════ Topbar (fila sticky) · modos Sidebar e iPhone ═════════
export default function Topbar(props) {
  const { theme } = useTheme();
  const { modoPresent } = props;
  return (
    <div style={{
      position: 'sticky', top: 0, zIndex: 40, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10,
      padding: '8px 16px 0', maxWidth: 1600, margin: '0 auto', width: '100%', fontFamily: TYPO.fontText,
    }}>
      {modoPresent && (
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, pointerEvents: 'auto',
          background: 'rgba(52,199,89,0.14)', color: theme.green || '#34C759', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
        }}>
          <span style={{ width: 5, height: 5, borderRadius: 999, background: theme.green || '#34C759' }} />Presentación
        </span>
      )}
      <div style={{
        pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', height: 36, padding: '0 6px', borderRadius: 999,
        background: theme.key === 'midnight' ? 'rgba(30,30,32,0.72)' : theme.key === 'marfil' ? 'rgba(255,251,244,0.78)' : 'rgba(255,255,255,0.78)',
        backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        border: `1px solid ${theme.key === 'midnight' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
        boxShadow: elevation(theme, 'hover'),
      }}>
        <ChromeDerecho {...props} />
      </div>
    </div>
  );
}

// ═══════════════ Panel Actualizar datos ═══════════════
function UpdatePanel({ theme, isMidnight, onMouseEnter, onMouseLeave }) {
  const [fuentes, setFuentes] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/status?type=last').then((r) => r.json());
        if (r?.last_update) setLastUpdate(r.last_update);
      } catch {}
    })();
    setFuentes([
      { id: 'sellout-pcel',       label: 'Sell Out PCEL',       status: 'ok',      when: 'semana 15' },
      { id: 'ventas-erp',         label: 'ERP · Ventas',        status: 'pending', when: 'nunca' },
      { id: 'sellout-digitalife', label: 'Sell Out Digitalife', status: 'pending', when: 'nunca' },
      { id: 'estados-cuenta',     label: 'Estados de cuenta',   status: 'ok',      when: 'reciente' },
      { id: 'inventario-acteck',  label: 'Inventario Acteck',   status: 'ok',      when: 'reciente' },
    ]);
  }, []);

  const cardStyle = {
    position: 'absolute', top: 36, right: 0, zIndex: 41, width: 340,
    background: isMidnight ? 'rgba(40,40,45,0.92)' : 'rgba(255,255,255,0.94)',
    backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: bordeFlotante(theme), borderRadius: 14, boxShadow: elevation(theme, 'flotante'),
    padding: 10, paddingTop: 14, fontFamily: TYPO.fontText, color: theme.text,
  };

  return (
    <div style={cardStyle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '4px 8px 8px' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: '-0.02em' }}>Actualizar datos</div>
        {lastUpdate && (
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: theme.textMuted }}>
            {new Date(lastUpdate).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {fuentes.map((f) => {
          const grad = f.status === 'ok' ? 'linear-gradient(135deg, #34C759, #248A3D)' : f.status === 'warn' ? 'linear-gradient(135deg, #FF9500, #C56E00)' : 'linear-gradient(135deg, #86868B, #6E6E73)';
          const StatusIco = f.status === 'ok' ? Check : f.status === 'warn' ? AlertTriangle : Clock;
          const statusColor = f.status === 'ok' ? '#34C759' : f.status === 'warn' ? '#FF9500' : '#86868B';
          const statusLabel = f.status === 'ok' ? 'al día' : f.status === 'warn' ? 'atrasada' : 'pendiente';
          return (
            <div key={f.id} style={{ display: 'grid', gridTemplateColumns: '24px 1fr auto', gap: 10, alignItems: 'center', padding: '8px 10px', borderRadius: 8 }}>
              <span style={{ width: 24, height: 24, borderRadius: 6, background: grad, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFF' }}>
                <StatusIco size={12} strokeWidth={2.5} />
              </span>
              <div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{f.label}</div>
                <div style={{ fontFamily: TYPO.fontText, fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{f.when}</div>
              </div>
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, color: statusColor, fontWeight: 600 }}>{statusLabel}</span>
            </div>
          );
        })}
      </div>
      <div style={{ height: 1, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '4px 4px' }} />
      <a href="/uploads.html" style={{
        display: 'block', margin: '4px 4px 2px', padding: '9px 12px', borderRadius: 10, background: theme.accent, color: '#FFF',
        fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, textAlign: 'center', textDecoration: 'none', letterSpacing: '-0.005em',
      }}>Ir al importador central →</a>
    </div>
  );
}

// ═══════════════ Menú de usuario ═══════════════
function UserMenu({ theme, isMidnight, setThemeKey, perfil, modoPresent, onToggleModoPresent, onConfig, onUpdate, onAtajos, onLogout, onMouseEnter, onMouseLeave }) {
  const puedeConfig = puedeConfigurar(perfil);
  const puedeActualizar = puedeActualizarDatos(perfil);
  const { menu, setPreferencia } = usePreferencias();
  const iniciales = (perfil?.nombre || 'U').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0].toUpperCase()).join('');
  const rolLabel = { super_admin: 'Super Admin', admin: 'Administrador', asistente: 'Asistente', cliente: 'Cliente', viewer: 'Viewer' }[perfil?.rol] || perfil?.rol;

  const cardStyle = {
    position: 'absolute', top: 36, right: 0, zIndex: 41, minWidth: 290,
    background: isMidnight ? 'rgba(40,40,45,0.92)' : 'rgba(255,255,255,0.94)',
    backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)',
    border: bordeFlotante(theme), borderRadius: 12, boxShadow: elevation(theme, 'flotante'),
    padding: 6, paddingTop: 10, fontFamily: TYPO.fontText, color: theme.text,
  };
  const rowStyle = (danger) => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '7px 10px', borderRadius: 7, border: 0, cursor: 'pointer',
    background: 'transparent', color: danger ? (theme.red || '#FF3B30') : theme.text,
    fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, letterSpacing: '-0.005em', textAlign: 'left',
  });
  const hov = (e) => { e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,113,227,0.06)'; };
  const out = (e) => { e.currentTarget.style.background = 'transparent'; };
  const swatchDot = (key, bg) => ({
    width: 18, height: 18, borderRadius: 999, cursor: 'pointer', background: bg, padding: 0,
    border: theme.key === key ? `1.5px solid ${theme.accent}` : `1px solid ${isMidnight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)'}`,
    boxShadow: theme.key === key ? `0 0 0 2px ${theme.accent}22` : 'none',
  });
  const sep = <div style={{ height: 1, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', margin: '4px 4px' }} />;

  return (
    <div style={cardStyle} onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      {perfil?.nombre && (
        <div style={{ padding: '10px 12px 12px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, marginBottom: 6 }}>
          <div style={{ width: 36, height: 36, borderRadius: 999, background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple || '#AF52DE'})`, color: '#FFF', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{iniciales}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: '-0.005em' }}>{perfil.nombre}</div>
            {rolLabel && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{rolLabel}</div>}
            {perfil.email && <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{perfil.email}</div>}
          </div>
        </div>
      )}

      {puedeConfig && (
        <button style={rowStyle(false)} onClick={onConfig} onMouseEnter={hov} onMouseLeave={out}>
          <Settings size={14} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1 }}>Configuración</span>
        </button>
      )}
      {puedeActualizar && (
        <button style={rowStyle(false)} onClick={onUpdate} onMouseEnter={hov} onMouseLeave={out}>
          <RefreshCw size={14} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1 }}>Actualizar datos</span>
        </button>
      )}
      <button style={{ ...rowStyle(false), justifyContent: 'space-between' }} onClick={onToggleModoPresent} onMouseEnter={hov} onMouseLeave={out}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}><Eye size={14} style={{ color: theme.textMuted }} />Modo presentación</span>
        <span style={{ width: 30, height: 18, borderRadius: 999, background: modoPresent ? theme.green : (isMidnight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'), position: 'relative', transition: 'background 220ms', display: 'inline-block' }}>
          <span style={{ position: 'absolute', top: 1, left: modoPresent ? 13 : 1, width: 16, height: 16, borderRadius: 999, background: '#FFF', boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: `left ${DUR.state}ms ${EASE}` }} />
        </span>
      </button>

      {/* Tema */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px' }}>
        <Palette size={14} style={{ color: theme.textMuted }} />
        <span style={{ flex: 1, fontSize: 12.5, color: theme.text }}>Tema</span>
        <div style={{ display: 'inline-flex', padding: 2, gap: 3, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 999 }}>
          <button title="Claro" onClick={() => setThemeKey('claro')} style={swatchDot('claro', 'linear-gradient(135deg, #FFF, #E5E5EA)')} />
          <button title="Midnight" onClick={() => setThemeKey('midnight')} style={swatchDot('midnight', 'linear-gradient(135deg, #0F0F11, #1D1D1F)')} />
          <button title="Marfil" onClick={() => setThemeKey('marfil')} style={swatchDot('marfil', 'linear-gradient(135deg, #FFFBF3, #EEE7DA)')} />
        </div>
      </div>

      {/* Modo de menú · selector rápido */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px' }}>
        <LayoutPanelLeft size={14} style={{ color: theme.textMuted }} />
        <span style={{ flex: 1, fontSize: 12.5, color: theme.text }}>Menú</span>
        <div style={{ display: 'inline-flex', padding: 2, gap: 2, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', borderRadius: 8 }}>
          {MODOS_MENU.map((m) => {
            const Icon = ICONO_MODO[m.id];
            const on = menu.modo === m.id;
            return (
              <button key={m.id} title={`${m.label} · ${m.desc}`} onClick={() => setPreferencia('menu.modo', m.id)}
                style={{
                  height: 22, padding: '0 8px', border: 0, borderRadius: 6, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: on ? (isMidnight ? 'rgba(99,99,102,0.9)' : '#FFF') : 'transparent', boxShadow: on ? elevation(theme, 'hover') : 'none',
                  color: on ? theme.text : theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: on ? 600 : 500,
                  transition: `background ${DUR.state}ms ${EASE}`,
                }}>
                <Icon size={11} /> {m.label}
              </button>
            );
          })}
        </div>
      </div>

      {onAtajos && (
        <button style={rowStyle(false)} onClick={onAtajos} onMouseEnter={hov} onMouseLeave={out}>
          <Keyboard size={14} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1 }}>Atajos de teclado</span>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textMuted, background: isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 4 }}>?</span>
        </button>
      )}

      {onLogout && (
        <>
          {sep}
          <button style={rowStyle(true)} onClick={onLogout} onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,59,48,0.08)'; }} onMouseLeave={out}>
            <LogOut size={14} />
            <span>Cerrar sesión</span>
          </button>
        </>
      )}

      {sep}
      <div title="Versión del dashboard" style={{ padding: '5px 10px 4px', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, letterSpacing: '0.01em', userSelect: 'text' }}>
        Acteck Dashboard {versionLabel()}
      </div>
    </div>
  );
}

// Campana de respaldo (por si el centro de notificaciones no monta nada): no se usa en producción,
// se exporta para pruebas de layout.
export function CampanaSimple({ onClick, count = 0 }) {
  const { theme } = useTheme();
  return (
    <button type="button" onClick={onClick} title="Notificaciones" style={{ width: 28, height: 28, border: 0, background: 'transparent', borderRadius: 7, cursor: 'pointer', color: 'inherit', position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Bell size={14} />
      {count > 0 && <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 12, height: 12, padding: '0 3px', borderRadius: 999, background: theme.red || '#FF3B30', color: '#FFF', fontSize: 8, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{count > 9 ? '9+' : count}</span>}
    </button>
  );
}
