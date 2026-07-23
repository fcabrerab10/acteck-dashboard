// Topbar · trío de pills flotantes estilo Dynamic Island
// ─ Pill izquierdo: mark + breadcrumb dropdown (jump-to-módulo)
// ─ Pill central:   search ⌘K (stub por ahora)
// ─ Pill derecho:   toggle tema + notificaciones + avatar
//
// Se monta arriba del layout principal (encima de sidebar + content).
// Mobile lo oculta — MobileNav sigue manejando esos casos.

import { useState, useEffect, useMemo, useRef } from 'react';
import { Bell, Search, Sun, Moon, Palette, Check, ChevronDown, X, ArrowRight, AlertTriangle, Clock, Sparkles } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { supabase, DB_CONFIGURED } from '../lib/supabase';
import { CLIENTES as SIDEBAR_CLIENTES } from './Sidebar';

const UMBRAL_DIAS_ALERTA = 3;
const ETAPAS_BASE = ['recibida', 'procesada', 'surtida', 'entregada'];
const ETAPAS_DICOTECH = ['cotizacion_solicitada', 'cotizacion_enviada', 'recibida', 'procesada', 'surtida', 'entregada'];
const CAMPO_ETAPA = {
  cotizacion_solicitada: 'fecha_cotizacion_solicitada',
  cotizacion_enviada:    'fecha_cotizacion_enviada',
  recibida:              'fecha_recibida',
  procesada:             'fecha_procesada',
  surtida:               'fecha_surtida',
  entregada:             'fecha_entregada',
};

// ─── util: etapa actual + días en esa etapa ───
function analizarOc(oc) {
  const etapas = oc.cliente_key === 'dicotech' ? ETAPAS_DICOTECH : ETAPAS_BASE;
  let ultima = null;
  let fechaUltima = null;
  for (const e of etapas) {
    const f = oc[CAMPO_ETAPA[e]];
    if (f) { ultima = e; fechaUltima = f; }
  }
  if (!ultima || ultima === 'entregada') return null;
  const dias = Math.floor((Date.now() - new Date(fechaUltima).getTime()) / 86400000);
  return { etapaActual: ultima, dias, fechaUltima };
}

// ─── módulos raíz (jump-to) ───
const MODULOS_JUMP = [
  { grupo: 'Dirección General',      pagina: 'estadoResultados', label: 'Estado de Resultados', permiso: 'estado_resultados' },
  { grupo: 'Dirección Comercial',    pagina: 'visionGeneral',    label: 'Visión General',        permiso: 'vision_general' },
  { grupo: 'Dirección Comercial',    pagina: 'ordenesCompra',    label: 'Tracking Pedidos',     permiso: 'ordenes_compra' },
  { grupo: 'Dirección Comercial',    pagina: 'estrategiaPrecios',label: 'Estrategia de Precios',permiso: 'estrategia_precios' },
  { grupo: 'Administración Interna', pagina: 'adminInterna',     label: 'Pendientes & Calendario', permiso: 'admin_interna' },
  { grupo: 'Axon de México',         pagina: 'axonMexico',       label: 'Resumen Axon',         permiso: 'axon_mexico' },
];

// Etiquetas legibles para el breadcrumb (fallback a "Dashboard")
const PAGINA_LABEL = {
  home: 'Resumen', analisis: 'Análisis', sellIn: 'Sell In', estrategia: 'Sell Out',
  marketing: 'Marketing', pagos: 'Pagos', cartera: 'Crédito y Cobranza',
  resumenClientes: 'Resumen de Clientes', estadoResultados: 'Estado de Resultados',
  visionGeneral: 'Visión General', analisisClientes: 'Análisis por Cliente',
  sellOut: 'Sell Out', inventarioGlobal: 'Inventario', cobranzaGlobal: 'Cobranza',
  forecastClientes: 'S&OP', estrategiaPrecios: 'Estrategia de Precios',
  ordenesCompra: 'Tracking Pedidos', propuestas: 'Propuestas',
  adminInterna: 'Pendientes & Calendario', telemetria: 'Actividad del equipo',
  axonMexico: 'Axon de México', configuracion: 'Configuración', actualizacion: 'Actualización de datos',
};

export default function Topbar({ clienteActivo, paginaActiva, vistaActual, onNavegar, perfilUsuario }) {
  const { theme, setThemeKey } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notifs, setNotifs] = useState([]);
  const [silenciadas, setSilenciadas] = useState(() => {
    try { return new Set(JSON.parse(localStorage.getItem('notif_silenciadas') || '[]')); }
    catch { return new Set(); }
  });

  const isMidnight = theme.key === 'midnight';
  const isMarfil = theme.key === 'marfil';

  // ─── Fetch de notificaciones (OCs atrasadas) ───
  useEffect(() => {
    if (!DB_CONFIGURED) return;
    let cancel = false;
    (async () => {
      const [{ data: ocs = [] }, { data: envios = [] }, { data: skus = [] }] = await Promise.all([
        supabase.from('oc_clientes').select('*'),
        supabase.from('oc_envios').select('*'),
        supabase.from('oc_clientes_skus').select('*'),
      ]);
      if (cancel) return;

      const enviosPorOc = new Map();
      envios.forEach(e => {
        const arr = enviosPorOc.get(e.oc_id) || [];
        arr.push(e); enviosPorOc.set(e.oc_id, arr);
      });

      const alertas = [];
      ocs.forEach(oc => {
        const enviosDeEsta = enviosPorOc.get(oc.id) || [];
        const entregadosTodos = enviosDeEsta.length > 0 && enviosDeEsta.every(e => e.fecha_entregada);
        if (entregadosTodos) return;
        const info = analizarOc(oc);
        if (!info) return;
        if (info.dias >= UMBRAL_DIAS_ALERTA) {
          const clienteLabel = SIDEBAR_CLIENTES[oc.cliente_key]?.label || oc.cliente_key;
          const clienteColor = SIDEBAR_CLIENTES[oc.cliente_key]?.color || '#999';
          const etapaLegible = ({
            cotizacion_solicitada: 'Cotización solicitada',
            cotizacion_enviada:    'Cotización enviada',
            recibida:              'Recibida',
            procesada:             'Procesada',
            surtida:               'Surtida',
          })[info.etapaActual] || info.etapaActual;
          alertas.push({
            id: `oc-${oc.id}`,
            severidad: info.dias >= 7 ? 'urgente' : 'warn',
            titulo: `${clienteLabel} · OC ${oc.numero_oc_cliente} · ${info.dias}d en ${etapaLegible}`,
            subtitulo: 'Tracking Pedidos',
            color: clienteColor,
            navegarA: () => onNavegar(null, 'ordenesCompra'),
            tiempo: `hace ${info.dias}d`,
          });
        }
      });

      // Recomendación Copilot: OCs listas para cerrar (todas surtidas sin entregar)
      const listas = ocs.filter(oc => {
        const enviosDeEsta = enviosPorOc.get(oc.id) || [];
        if (enviosDeEsta.length === 0) return false;
        return enviosDeEsta.every(e => e.fecha_surtida) && enviosDeEsta.some(e => !e.fecha_entregada);
      });
      if (listas.length >= 2) {
        alertas.push({
          id: 'copilot-cerrar',
          severidad: 'info',
          titulo: `${listas.length} OCs listas para marcar como Entregadas`,
          subtitulo: 'Copilot Operaciones',
          navegarA: () => onNavegar(null, 'ordenesCompra'),
          tiempo: 'ahora',
        });
      }

      alertas.sort((a, b) => (a.severidad === 'urgente' ? -1 : 1));
      setNotifs(alertas);
    })();
    return () => { cancel = true; };
  }, [onNavegar]);

  // ─── ⌘K abre búsqueda ───
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); }
      if (e.key === 'Escape') { setSearchOpen(false); setNotifOpen(false); setMenuOpen(false); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // ─── Close popovers on outside click ───
  const leftRef = useRef(null);
  const rightRef = useRef(null);
  useEffect(() => {
    const onDoc = (e) => {
      if (menuOpen && leftRef.current && !leftRef.current.contains(e.target)) setMenuOpen(false);
      if (notifOpen && rightRef.current && !rightRef.current.contains(e.target)) setNotifOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [menuOpen, notifOpen]);

  const silenciar = (id) => {
    setSilenciadas(prev => {
      const next = new Set(prev); next.add(id);
      try { localStorage.setItem('notif_silenciadas', JSON.stringify([...next])); } catch {}
      return next;
    });
  };
  const marcarTodo = () => {
    const ids = notifs.map(n => n.id);
    setSilenciadas(prev => {
      const next = new Set(prev); ids.forEach(id => next.add(id));
      try { localStorage.setItem('notif_silenciadas', JSON.stringify([...next])); } catch {}
      return next;
    });
  };

  const notifsVisibles = notifs.filter(n => !silenciadas.has(n.id));
  const urgentes = notifsVisibles.filter(n => n.severidad === 'urgente');
  const warns    = notifsVisibles.filter(n => n.severidad === 'warn');
  const infos    = notifsVisibles.filter(n => n.severidad === 'info');

  // ─── Breadcrumb text ───
  const breadcrumbGrupo = useMemo(() => {
    if (vistaActual === 'configuracion') return 'Configuración';
    if (clienteActivo) return SIDEBAR_CLIENTES[clienteActivo]?.label || clienteActivo;
    if (['estadoResultados'].includes(paginaActiva)) return 'Dirección General';
    if (['adminInterna', 'telemetria'].includes(paginaActiva)) return 'Administración';
    if (['axonMexico'].includes(paginaActiva)) return 'Axon de México';
    return 'Comercial';
  }, [clienteActivo, paginaActiva, vistaActual]);

  const breadcrumbPagina = useMemo(() => {
    if (vistaActual === 'configuracion') return '';
    return PAGINA_LABEL[paginaActiva] || '';
  }, [paginaActiva, vistaActual]);

  const clienteDot = clienteActivo ? SIDEBAR_CLIENTES[clienteActivo]?.color : null;

  const iniciales = (perfilUsuario?.nombre || 'U').split(' ').filter(Boolean).slice(0, 2).map(s => s[0].toUpperCase()).join('');

  // ─── Cycle tema ───
  const nextTheme = { claro: 'midnight', midnight: 'marfil', marfil: 'claro' }[theme.key] || 'claro';
  const IconoTema = theme.key === 'claro' ? Sun : theme.key === 'midnight' ? Moon : Palette;

  // ─── Estilos compartidos ───
  const pillStyle = {
    height: 34,
    background: isMidnight ? 'rgba(30,30,32,0.72)' : isMarfil ? 'rgba(255,251,244,0.78)' : 'rgba(255,255,255,0.78)',
    backdropFilter: 'saturate(180%) blur(24px)',
    WebkitBackdropFilter: 'saturate(180%) blur(24px)',
    border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}`,
    borderRadius: 999,
    boxShadow: isMidnight ? '0 2px 10px rgba(0,0,0,0.3)' : '0 2px 10px rgba(0,0,0,0.06)',
    display: 'inline-flex',
    alignItems: 'center',
    color: theme.text,
    fontFamily: TYPO.fontText,
  };

  const miniBtnStyle = {
    width: 24, height: 24, padding: 0, border: 0, background: 'transparent',
    borderRadius: 6, cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    color: theme.text, position: 'relative',
  };

  return (
    <>
      {/* Trío de pills — sticky top */}
      <div
        style={{
          position: 'sticky', top: 0, zIndex: 40,
          padding: '10px 14px',
          display: 'grid',
          gridTemplateColumns: 'auto 1fr auto',
          gap: 10,
          alignItems: 'center',
          pointerEvents: 'none', // el bg no bloquea scroll — solo los pills sí
        }}
      >
        {/* ═══ PILL IZQUIERDA · breadcrumb + dropdown ═══ */}
        <div ref={leftRef} style={{ position: 'relative', pointerEvents: 'auto' }}>
          <div style={{ ...pillStyle, padding: '0 8px 0 8px', gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: 5,
              background: isMidnight ? theme.accent : theme.text,
              color: isMidnight ? '#000' : (theme.textOnDark || '#F5F5F7'),
              fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              letterSpacing: '-0.02em',
              boxShadow: isMidnight ? `0 0 12px ${theme.accentGlow || 'rgba(100,210,255,0.4)'}` : 'none',
            }}>a</div>
            <button
              onClick={() => setMenuOpen(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 8px 3px 4px',
                background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer',
                fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
                color: theme.text, letterSpacing: '-0.015em',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              {clienteDot && (
                <span style={{ width: 8, height: 8, borderRadius: 999, background: clienteDot, marginRight: 2 }} />
              )}
              {breadcrumbGrupo}
              {breadcrumbPagina && (
                <>
                  <span style={{ color: theme.textSubtle || theme.textMuted, fontWeight: 400 }}>›</span>
                  <span style={{ color: theme.textMuted, fontWeight: 500 }}>{breadcrumbPagina}</span>
                </>
              )}
              <ChevronDown size={10} style={{ marginLeft: 2, color: theme.textSubtle || theme.textMuted, opacity: 0.7 }} />
            </button>
          </div>

          {menuOpen && (
            <JumpMenu
              theme={theme} isMidnight={isMidnight}
              perfil={perfilUsuario}
              paginaActiva={paginaActiva}
              onGo={(p) => { setMenuOpen(false); onNavegar(null, p); }}
            />
          )}
        </div>

        {/* ═══ PILL CENTRAL · search ═══ */}
        <button
          onClick={() => setSearchOpen(true)}
          style={{
            ...pillStyle,
            justifySelf: 'center', width: '100%', maxWidth: 460,
            padding: '0 12px', gap: 8, cursor: 'pointer',
            pointerEvents: 'auto',
            border: pillStyle.border,
          }}
          onMouseEnter={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(100,210,255,0.3)' : 'rgba(0,0,0,0.12)'}
          onMouseLeave={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        >
          <Search size={13} style={{ color: theme.textMuted }} />
          <span style={{ flex: 1, textAlign: 'left', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.textMuted }}>
            Buscar OC, SKU, cliente…
          </span>
          <span style={{
            fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
            color: theme.textSubtle || theme.textMuted,
            background: isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            padding: '1px 5px', borderRadius: 4,
          }}>⌘K</span>
        </button>

        {/* ═══ PILL DERECHA · tema + notif + avatar ═══ */}
        <div ref={rightRef} style={{ position: 'relative', pointerEvents: 'auto' }}>
          <div style={{ ...pillStyle, padding: '0 6px', gap: 2 }}>
            <button
              onClick={() => setThemeKey(nextTheme)}
              title={`Cambiar a ${nextTheme}`}
              style={miniBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <IconoTema size={13} />
            </button>
            <button
              onClick={() => setNotifOpen(v => !v)}
              title="Notificaciones"
              style={miniBtnStyle}
              onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            >
              <Bell size={13} />
              {notifsVisibles.length > 0 && (
                <span style={{
                  position: 'absolute', top: -1, right: -1,
                  background: theme.red || '#FF3B30', color: '#FFF',
                  fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 8,
                  minWidth: 12, height: 12, padding: '0 3px', borderRadius: 999,
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1,
                  boxShadow: `0 1px 2px ${theme.red || '#FF3B30'}66`,
                }}>{notifsVisibles.length > 9 ? '9+' : notifsVisibles.length}</span>
              )}
            </button>
            <div
              title={perfilUsuario?.nombre || 'Usuario'}
              style={{
                width: 20, height: 20, borderRadius: 999, marginLeft: 2,
                background: `linear-gradient(135deg, ${theme.accent}, ${theme.purple || '#AF52DE'})`,
                color: '#FFF', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 9,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}
            >{iniciales}</div>
          </div>

          {notifOpen && (
            <NotifPanel
              theme={theme} isMidnight={isMidnight}
              urgentes={urgentes} warns={warns} infos={infos}
              onGo={(navegarA) => { setNotifOpen(false); navegarA(); }}
              onSilenciar={silenciar}
              onMarcarTodo={marcarTodo}
              onClose={() => setNotifOpen(false)}
            />
          )}
        </div>
      </div>

      {searchOpen && (
        <SearchOverlay
          theme={theme} isMidnight={isMidnight}
          onClose={() => setSearchOpen(false)}
        />
      )}
    </>
  );
}

// ═══════════════ Jump menu ═══════════════
function JumpMenu({ theme, isMidnight, perfil, paginaActiva, onGo }) {
  // Simplificado: no verificamos permisos aquí — el usuario verá SinAcceso si no puede
  const grupos = MODULOS_JUMP.reduce((acc, m) => {
    (acc[m.grupo] ||= []).push(m); return acc;
  }, {});
  return (
    <div style={{
      position: 'absolute', top: 42, left: 0, minWidth: 260, zIndex: 41,
      background: isMidnight ? 'rgba(40,40,45,0.85)' : 'rgba(255,255,255,0.90)',
      backdropFilter: 'saturate(180%) blur(30px)',
      WebkitBackdropFilter: 'saturate(180%) blur(30px)',
      border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 12,
      boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.1)',
      padding: 6,
      fontFamily: TYPO.fontText,
    }}>
      {Object.entries(grupos).map(([grupo, items]) => (
        <div key={grupo} style={{ marginBottom: 4 }}>
          <div style={{
            padding: '6px 10px 3px', fontFamily: TYPO.fontDisplay, fontSize: 9.5,
            textTransform: 'uppercase', letterSpacing: '0.08em',
            color: theme.textMuted, fontWeight: 600,
          }}>{grupo}</div>
          {items.map(it => (
            <button
              key={it.pagina}
              onClick={() => onGo(it.pagina)}
              style={{
                display: 'flex', alignItems: 'center', width: '100%',
                padding: '7px 10px', gap: 8, border: 0, borderRadius: 7,
                background: paginaActiva === it.pagina
                  ? (isMidnight ? 'rgba(100,210,255,0.12)' : 'rgba(0,113,227,0.10)')
                  : 'transparent',
                color: paginaActiva === it.pagina ? theme.accent : theme.text,
                fontFamily: paginaActiva === it.pagina ? TYPO.fontDisplay : TYPO.fontText,
                fontSize: 12.5, fontWeight: paginaActiva === it.pagina ? 600 : 500,
                cursor: 'pointer', textAlign: 'left',
              }}
              onMouseEnter={(e) => {
                if (paginaActiva !== it.pagina)
                  e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)';
              }}
              onMouseLeave={(e) => {
                if (paginaActiva !== it.pagina) e.currentTarget.style.background = 'transparent';
              }}
            >
              <span style={{ flex: 1 }}>{it.label}</span>
              {paginaActiva === it.pagina && <Check size={13} style={{ color: theme.accent }} />}
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}

// ═══════════════ Notification panel ═══════════════
function NotifPanel({ theme, isMidnight, urgentes, warns, infos, onGo, onSilenciar, onMarcarTodo, onClose }) {
  const total = urgentes.length + warns.length + infos.length;
  return (
    <div style={{
      position: 'absolute', top: 42, right: 0, width: 360, zIndex: 41,
      background: isMidnight ? 'rgba(40,40,45,0.85)' : 'rgba(255,255,255,0.90)',
      backdropFilter: 'saturate(180%) blur(30px)',
      WebkitBackdropFilter: 'saturate(180%) blur(30px)',
      border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
      borderRadius: 14,
      boxShadow: isMidnight ? '0 12px 40px rgba(0,0,0,0.5)' : '0 12px 40px rgba(0,0,0,0.10)',
      padding: 10, fontFamily: TYPO.fontText,
      maxHeight: '80vh', overflowY: 'auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px 8px' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: theme.text, letterSpacing: '-0.02em' }}>Notificaciones</div>
        {total > 0 && (
          <button
            onClick={onMarcarTodo}
            style={{ background: 'transparent', border: 0, color: theme.accent, fontFamily: TYPO.fontText, fontSize: 11, fontWeight: 500, cursor: 'pointer', padding: '3px 6px', borderRadius: 5 }}
          >Marcar todo</button>
        )}
      </div>

      {total === 0 && (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
          Todo bajo control · sin alertas pendientes
        </div>
      )}

      <NotifSection label="Urgentes" count={urgentes.length} theme={theme} isMidnight={isMidnight}>
        {urgentes.map(n => <NotifItem key={n.id} n={n} theme={theme} isMidnight={isMidnight} onGo={onGo} onSilenciar={onSilenciar} />)}
      </NotifSection>
      <NotifSection label="Advertencias" count={warns.length} theme={theme} isMidnight={isMidnight}>
        {warns.map(n => <NotifItem key={n.id} n={n} theme={theme} isMidnight={isMidnight} onGo={onGo} onSilenciar={onSilenciar} />)}
      </NotifSection>
      <NotifSection label="Copilot" count={infos.length} theme={theme} isMidnight={isMidnight}>
        {infos.map(n => <NotifItem key={n.id} n={n} theme={theme} isMidnight={isMidnight} onGo={onGo} onSilenciar={onSilenciar} />)}
      </NotifSection>
    </div>
  );
}

function NotifSection({ label, count, theme, isMidnight, children }) {
  if (count === 0) return null;
  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between', padding: '4px 8px 4px',
        fontFamily: TYPO.fontText, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em',
        color: theme.textMuted, fontWeight: 600,
      }}>
        <span>{label}</span>
        <span style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{count}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>{children}</div>
    </div>
  );
}

function NotifItem({ n, theme, isMidnight, onGo, onSilenciar }) {
  const grad = n.severidad === 'urgente' ? 'linear-gradient(135deg, #FF3B30, #C22B22)'
    : n.severidad === 'warn' ? 'linear-gradient(135deg, #FF9500, #C56E00)'
    : `linear-gradient(135deg, ${theme.accent}, ${theme.accentHover || theme.accent})`;
  const Icon = n.severidad === 'urgente' ? AlertTriangle : n.severidad === 'warn' ? Clock : Sparkles;
  return (
    <div
      onClick={() => onGo(n.navegarA)}
      style={{
        background: isMidnight ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.7)',
        border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}`,
        borderRadius: 10, padding: '9px 10px',
        display: 'grid', gridTemplateColumns: '26px 1fr auto', gap: 10, alignItems: 'center',
        cursor: 'pointer',
      }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = theme.accent}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'}
    >
      <span style={{
        width: 26, height: 26, borderRadius: 7, background: grad,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
      }}>
        <Icon size={13} strokeWidth={2.5} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text,
          letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{n.titulo}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
          {n.subtitulo} · {n.tiempo}
        </div>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onSilenciar(n.id); }}
        title="Silenciar"
        style={{
          width: 20, height: 20, padding: 0, border: 0, background: 'transparent',
          borderRadius: 999, cursor: 'pointer', color: theme.textMuted,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        }}
        onMouseEnter={(e) => e.currentTarget.style.background = isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'}
        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ═══════════════ Search overlay ═══════════════
function SearchOverlay({ theme, isMidnight, onClose }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: isMidnight ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)',
        backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '15vh', paddingLeft: 16, paddingRight: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 560,
          background: isMidnight ? 'rgba(40,40,45,0.92)' : 'rgba(255,255,255,0.95)',
          backdropFilter: 'saturate(180%) blur(30px)',
          border: `1px solid ${isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
          borderRadius: 16,
          boxShadow: isMidnight ? '0 20px 60px rgba(0,0,0,0.6)' : '0 20px 60px rgba(0,0,0,0.15)',
          padding: 8,
          fontFamily: TYPO.fontText,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px' }}>
          <Search size={16} style={{ color: theme.textMuted }} />
          <input
            autoFocus
            placeholder="Buscar OC, SKU, cliente…"
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: TYPO.fontText, fontSize: 15, color: theme.text,
            }}
          />
          <span style={{
            fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10,
            color: theme.textMuted, background: isMidnight ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
            padding: '2px 6px', borderRadius: 5,
          }}>ESC</span>
        </div>
        <div style={{
          borderTop: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
          padding: '14px 16px', color: theme.textMuted, fontSize: 12,
        }}>
          Búsqueda universal próximamente · por ahora usa el sidebar para navegar
        </div>
      </div>
    </div>
  );
}
