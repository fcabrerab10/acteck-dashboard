// MobileYo — pestaña Yo/Configuración mobile-native.
// Reemplaza Configuracion cuando mobile === true.
//
// Estructura aprobada en mockup:
//   - Perfil card (avatar grande + nombre + email + badge rol)
//   - Apariencia: selector de tema visual (Claro/Midnight/Marfil)
//   - Notificaciones: toggles nativos iOS
//   - Datos: accesos a Actualización de datos, Usuarios y permisos
//   - Cuenta: Ayuda, Cerrar sesión
//   - Footer con versión

import React, { useState } from 'react';
import {
  Bell, Mail, Upload, Users, HelpCircle, LogOut, ChevronRight, Check,
} from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO, THEMES } from '../lib/themeTokens';
import { puedeConfigurar } from '../lib/permisos';

const ROL_LABELS = {
  super_admin: 'Super Admin',
  admin:       'Administrador',
  asistente:   'Asistente',
  cliente:     'Cliente',
  viewer:      'Viewer',
};

const APP_VERSION = 'v2.5.0';

// Preview de tema visual (mini swatch bi-color)
const THEME_PREVIEW = {
  claro:    { a: '#F5F5F7', b: '#000000', label: 'Claro',    emoji: '☀' },
  midnight: { a: '#000000', b: '#1D1D1F', label: 'Midnight', emoji: '🌙' },
  marfil:   { a: '#F7F3EC', b: '#0055B5', label: 'Marfil',   emoji: '🎨' },
};

// Notificaciones · localStorage-only por ahora (V2 = push server real)
const NOTIF_KEY = 'mobile_notif_prefs';
const loadNotifs = () => {
  try { return JSON.parse(localStorage.getItem(NOTIF_KEY)) || { push: true, email: true }; }
  catch { return { push: true, email: true }; }
};
const saveNotifs = (n) => { try { localStorage.setItem(NOTIF_KEY, JSON.stringify(n)); } catch {} };

export default function MobileYo({ perfil, onCerrarSesion, onOpenConfig }) {
  const { theme, setThemeKey } = useTheme();
  const isDark = theme.mode === 'dark';
  const puedeConfig = puedeConfigurar(perfil);
  const [notifs, setNotifs] = useState(loadNotifs);
  const [savedMsg, setSavedMsg] = useState(null);

  const iniciales = (perfil?.nombre || perfil?.email || 'FC')
    .split(/\s+|@/)[0].slice(0, 2).toUpperCase();

  const handleTheme = (key) => {
    setThemeKey(key);
    setSavedMsg('✓ Tema actualizado');
    setTimeout(() => setSavedMsg(null), 1600);
  };
  const toggleNotif = (k) => {
    const next = { ...notifs, [k]: !notifs[k] };
    setNotifs(next); saveNotifs(next);
  };

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Título */}
      <div style={{ padding: '10px 18px 4px' }}>
        <h1 style={{
          margin: 0, fontFamily: TYPO.fontDisplay,
          fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text,
        }}>Yo</h1>
      </div>

      {/* Toast tema */}
      {savedMsg && (
        <div style={{
          margin: '8px 18px 4px', padding: '8px 12px', borderRadius: 10,
          background: theme.accentSoft || 'rgba(0,122,255,.10)', color: theme.accent,
          fontSize: 12.5, fontWeight: 600, textAlign: 'center',
          animation: 'yoFade 200ms ease-out',
        }}>{savedMsg}</div>
      )}

      {/* Perfil card */}
      <div style={{ padding: '12px 18px 6px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: `linear-gradient(135deg, ${theme.pink || '#FF2D55'}, ${theme.orange || '#FF9500'})`,
          color: '#fff', display: 'grid', placeItems: 'center',
          fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 22,
        }}>{iniciales}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', color: theme.text, fontFamily: TYPO.fontDisplay }}>
            {perfil?.nombre || 'Usuario'}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {perfil?.email || '—'}
          </div>
          {perfil?.rol && (
            <span style={{
              display: 'inline-block', marginTop: 4,
              padding: '2px 8px', borderRadius: 100,
              background: theme.accentSoft || 'rgba(0,122,255,.10)', color: theme.accent,
              fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.06em',
            }}>{ROL_LABELS[perfil.rol] || perfil.rol}</span>
          )}
        </div>
      </div>

      {/* Apariencia · selector tema visual */}
      <SettingGroup theme={theme} title="Apariencia">
        <div style={{ padding: '12px 14px' }}>
          <div style={{ fontSize: 12, color: theme.textMuted, fontWeight: 600, marginBottom: 8 }}>Tema</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {Object.keys(THEMES).map((k) => {
              const p = THEME_PREVIEW[k]; if (!p) return null;
              const on = theme.key === k;
              return (
                <button key={k}
                  onClick={() => handleTheme(k)}
                  style={{
                    padding: '10px 6px', borderRadius: 12,
                    border: `2px solid ${on ? theme.accent : theme.border}`,
                    background: theme.surface,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                    fontSize: 11.5, color: on ? theme.text : theme.textMuted, fontWeight: 700,
                    cursor: 'pointer', fontFamily: TYPO.fontText,
                    transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1), border-color 200ms',
                    position: 'relative',
                  }}
                  onPointerDown={(e) => e.currentTarget.style.transform = 'scale(.96)'}
                  onPointerUp={(e) => e.currentTarget.style.transform = ''}
                  onPointerLeave={(e) => e.currentTarget.style.transform = ''}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: 10,
                    border: `1px solid ${theme.border}`,
                    background: `linear-gradient(135deg, ${p.a} 50%, ${p.b} 50%)`,
                  }} />
                  <span>{p.emoji} {p.label}</span>
                  {on && (
                    <span style={{
                      position: 'absolute', top: 6, right: 6,
                      width: 16, height: 16, borderRadius: '50%',
                      background: theme.accent, color: '#fff',
                      display: 'grid', placeItems: 'center',
                    }}>
                      <Check size={11} strokeWidth={3} />
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </SettingGroup>

      {/* Notificaciones */}
      <SettingGroup theme={theme} title="Notificaciones">
        <SettingRow theme={theme}
          iconBg={theme.pink || '#FF2D55'} icon={<Bell size={16} />}
          label="Push activas"
          sub="Cartera vencida, cierre de mes, SKUs"
          right={<Toggle theme={theme} on={notifs.push} onToggle={() => toggleNotif('push')} />}
        />
        <SettingRow theme={theme}
          iconBg={theme.orange || '#FF9500'} icon={<Mail size={16} />}
          label="Resumen diario email"
          sub="8:00 am · lunes a viernes"
          right={<Toggle theme={theme} on={notifs.email} onToggle={() => toggleNotif('email')} />}
        />
      </SettingGroup>

      {/* Datos */}
      {puedeConfig && (
        <SettingGroup theme={theme} title="Datos">
          <SettingRow theme={theme}
            iconBg={theme.accent} icon={<Upload size={16} />}
            label="Actualización de datos"
            sub="Uploads Excel · ERP · sellouts"
            onClick={() => window.open('/uploads.html', '_blank')}
            chev
          />
          <SettingRow theme={theme}
            iconBg={theme.indigo || '#5856D6'} icon={<Users size={16} />}
            label="Usuarios y permisos"
            sub="Gestionar cuentas y accesos"
            onClick={onOpenConfig}
            chev
          />
        </SettingGroup>
      )}

      {/* Cuenta */}
      <SettingGroup theme={theme} title="Cuenta">
        <SettingRow theme={theme}
          iconBg={theme.textMuted} icon={<HelpCircle size={16} />}
          label="Ayuda y soporte"
          onClick={() => window.open('mailto:soporte@acteck.com', '_blank')}
          chev
        />
        <SettingRow theme={theme}
          iconBg={theme.red || '#FF3B30'} icon={<LogOut size={16} />}
          label="Cerrar sesión"
          danger
          onClick={onCerrarSesion}
          chev
        />
      </SettingGroup>

      {/* Footer */}
      <div style={{ textAlign: 'center', padding: '24px 0 40px', color: theme.textSubtle, fontSize: 11, fontFamily: TYPO.fontText }}>
        Acteck Dashboard {APP_VERSION}<br />
        © {new Date().getFullYear()} Acteck · Balam Rush
      </div>

      <style>{`@keyframes yoFade { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </div>
  );
}

// ─────────────── Sub-componentes ───────────────
function SettingGroup({ theme, title, children }) {
  return (
    <div style={{
      margin: '12px 18px 0', background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <div style={{
        padding: '10px 14px 6px', fontSize: 10.5,
        textTransform: 'uppercase', letterSpacing: '.06em',
        color: theme.textMuted, fontWeight: 700,
        borderBottom: `1px solid ${theme.divider}`,
      }}>{title}</div>
      {children}
    </div>
  );
}

function SettingRow({ theme, iconBg, icon, label, sub, right, onClick, chev, danger }) {
  const Component = onClick ? 'button' : 'div';
  return (
    <Component
      onClick={onClick}
      style={{
        width: '100%', padding: '12px 14px',
        display: 'flex', alignItems: 'center', gap: 12,
        borderTop: `0px`, borderBottom: 'none',
        background: 'transparent', border: 'none',
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left', fontFamily: TYPO.fontText,
        color: danger ? (theme.red || '#FF3B30') : theme.text,
      }}
    >
      <div style={{
        width: 30, height: 30, borderRadius: 8, background: iconBg,
        color: '#fff', display: 'grid', placeItems: 'center',
        flex: '0 0 auto',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: danger ? (theme.red || '#FF3B30') : theme.text }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1 }}>{sub}</div>}
      </div>
      {right ? right : chev ? <ChevronRight size={16} style={{ color: danger ? (theme.red || '#FF3B30') : theme.textSubtle, flex: '0 0 auto' }} /> : null}
    </Component>
  );
}

function Toggle({ theme, on, onToggle }) {
  return (
    <button
      onClick={onToggle}
      role="switch" aria-checked={on}
      style={{
        width: 44, height: 26, borderRadius: 100,
        background: on ? (theme.green || '#34C759') : 'rgba(120,120,128,.30)',
        position: 'relative', border: 'none', cursor: 'pointer',
        transition: 'background 200ms',
        flex: '0 0 auto',
      }}
    >
      <span style={{
        position: 'absolute', top: 2, left: 2, width: 22, height: 22,
        borderRadius: '50%', background: '#fff',
        boxShadow: '0 2px 4px rgba(0,0,0,.15)',
        transition: 'transform 200ms cubic-bezier(.34,1.56,.64,1)',
        transform: on ? 'translateX(18px)' : 'translateX(0)',
      }} />
    </button>
  );
}
