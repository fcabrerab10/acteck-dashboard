// Cajón lateral (modo "cajón") · réplica del sidebar iPad para el celular: 78 % de ancho (máx. 340), entra desde la
// izquierda en 340 ms EASE con capa oscura; cierra al elegir, tocando la capa o deslizando hacia la izquierda.
// Contenido: tarjeta de perfil (avatar 30 · nombre · cargo → hoja de perfil), FAVORITOS (resolverFavoritos, los
// mismos que en la web), los grupos del árbol en su orden con título en versalitas, clientes propios con punto
// de color (al tocar uno, el cajón muestra sus pestañas con "‹ Clientes") y al pie "acteck." + versión + el
// selector Cajón · Barra. Todo sale de construirArbol(perfil) vía NavContext (nav.arbol) y usePreferencias.
//   <Cajon abierto arrastre onClose onAbrirPerfil />   arrastre: px del gesto de apertura (null si no hay gesto)
import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR, reduceMotion } from '../../lib/motion';
import { versionLabel } from '../../lib/version';
import { AvatarImg, usePerfilVivo } from '../../lib/avatar';
import { usePreferencias, MODOS_MENU_MOVIL } from '../../lib/preferencias';
import { cargoDe } from '../../components/perfil/comun';
import { resolverFavoritos, CLIENTES_NAV } from '../../components/nav/arbol';
import { BotonFav, PuntoCliente, TituloSeccion, Logotipo, hairline, esMidnight } from '../../components/nav/comun';
import { Segmented } from '../../components/kit';
import { useNav } from '../nav';

export const anchoCajon = () => Math.min(Math.round((typeof window !== 'undefined' ? window.innerWidth : 390) * 0.78), 340);

export default function Cajon({ abierto, arrastre = null, onClose, onAbrirPerfil }) {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfilVivo(nav.perfil);
  const { favoritos, toggleFavorito, menu, setPreferencia } = usePreferencias();
  const arbol = nav.arbol || [];
  const dark = esMidnight(theme);
  const ancho = anchoCajon();

  const [montado, setMontado] = useState(abierto);
  const [visible, setVisible] = useState(false);
  const [cliente, setCliente] = useState(null);   // clave del cliente cuyas pestañas se muestran
  const [dx, setDx] = useState(0);                // arrastre para cerrar (≤ 0)
  const drag = useRef(null);
  const dxRef = useRef(0);
  const ponDx = (v) => { dxRef.current = v; setDx(v); };
  const arrastrando = arrastre != null;
  const ultimoArrastre = useRef(null);            // dónde quedó el gesto de apertura al soltar (evita el salto al -ancho)
  if (arrastrando) ultimoArrastre.current = arrastre;

  useLayoutEffect(() => {
    if (abierto && ultimoArrastre.current != null) { setMontado(true); setVisible(true); ultimoArrastre.current = null; }
  }, [abierto]);
  useEffect(() => {
    if (abierto || arrastrando) { setMontado(true); const t = setTimeout(() => setVisible(abierto), 16); return () => clearTimeout(t); }
    ultimoArrastre.current = null;
    setVisible(false);
    const t = setTimeout(() => { setMontado(false); ponDx(0); setCliente(null); }, reduceMotion() ? 0 : DUR.page);
    return () => clearTimeout(t);
  }, [abierto, arrastrando]);

  useEffect(() => {
    if (!abierto) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [abierto, onClose]);

  // Deslizar hacia la izquierda para cerrar (sobre el propio cajón).
  const onStart = (e) => { const t = e.touches[0]; drag.current = { x: t.clientX, y: t.clientY, t0: Date.now(), ok: null }; };
  const onMove = (e) => {
    const d = drag.current; if (!d) return;
    const t = e.touches[0]; const ddx = t.clientX - d.x, ddy = t.clientY - d.y;
    if (d.ok == null) { if (Math.abs(ddx) < 8 && Math.abs(ddy) < 8) return; d.ok = ddx < 0 && Math.abs(ddx) > Math.abs(ddy) * 1.2; }
    if (!d.ok) return;
    if (e.cancelable) e.preventDefault();
    ponDx(Math.min(0, ddx));
  };
  const onEnd = () => {
    const d = drag.current; drag.current = null; if (!d || !d.ok) { ponDx(0); return; }
    const rapido = Date.now() - d.t0 < 300 && dxRef.current < -30;
    if (dxRef.current < -ancho / 3 || rapido) onClose?.(); else ponDx(0);
  };

  // Inicio ya tiene su fila fija arriba: no se repite en FAVORITOS (igual que el sidebar iPad).
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos).filter((n) => n.id !== 'inicio'), [arbol, favoritos]);
  const elegir = (n) => { onClose?.(); nav.navegar(n); };

  if (!montado) return null;

  // Posición: gesto de apertura (sigue al dedo) > arrastre de cierre > abierto/cerrado.
  let x = visible ? 0 : -ancho;
  if (arrastrando) x = Math.min(0, -ancho + arrastre);
  else if (visible && dx < 0) x = dx;
  const progreso = Math.max(0, Math.min(1, 1 + x / ancho));
  const sinAnim = arrastrando || dx < 0 || reduceMotion();

  const clienteAbierto = cliente ? arbol.flatMap((g) => g.clientes || []).find((c) => c.key === cliente) : null;

  return (
    <div onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }} aria-hidden={!abierto}
      style={{ position: 'fixed', inset: 0, zIndex: 65, background: `rgba(0,0,0,${(0.38 * progreso).toFixed(3)})`, transition: sinAnim ? 'none' : `background ${DUR.page}ms ${EASE}`, pointerEvents: abierto || arrastrando ? 'auto' : 'none' }}>
      <aside role="dialog" aria-modal="true" aria-label="Menú"
        onTouchStart={onStart} onTouchMove={onMove} onTouchEnd={onEnd} onTouchCancel={onEnd}
        style={{
          position: 'absolute', top: 0, bottom: 0, left: 0, width: ancho, display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
          background: dark ? 'rgba(22,22,24,0.97)' : theme.key === 'marfil' ? 'rgba(250,247,241,0.98)' : 'rgba(247,247,249,0.98)',
          backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
          borderRight: `1px solid ${hairline(theme)}`, boxShadow: progreso > 0 ? '8px 0 32px rgba(0,0,0,0.22)' : 'none',
          color: theme.text, fontFamily: TYPO.fontText, transform: `translateX(${x}px)`, transition: sinAnim ? 'none' : `transform ${DUR.page}ms ${EASE}`,
          paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', willChange: 'transform',
        }}>
        {/* Tarjeta de perfil */}
        <button type="button" onClick={() => { onClose?.(); onAbrirPerfil?.(); }} style={{
          display: 'flex', alignItems: 'center', gap: 10, margin: '10px 10px 4px', padding: '6px 8px', border: 0, borderRadius: 10, background: 'transparent',
          color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', minHeight: 44,
        }}>
          <AvatarImg perfil={perfil} size={30} />
          <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', flex: 1 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{perfil?.nombre || perfil?.email || 'Usuario'}</span>
            <span style={{ fontSize: 11, color: theme.textMuted, lineHeight: 1.25, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cargoDe(perfil) || 'Perfil y preferencias'}</span>
          </span>
          <ChevronRight size={14} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0 }} />
        </button>

        {/* Árbol (o pestañas del cliente elegido) */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '0 10px 12px', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {clienteAbierto ? (
            <>
              <button type="button" onClick={() => setCliente(null)} style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 8px 0 0', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}>
                <ChevronLeft size={22} strokeWidth={2.2} style={{ marginLeft: -4 }} />Clientes
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 8px 8px' }}>
                <PuntoCliente color={clienteAbierto.color} size={9} activo />
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{clienteAbierto.label}</span>
                <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 'auto' }}>{clienteAbierto.marca}</span>
              </div>
              {clienteAbierto.nodos.map((n) => (
                <Item key={n.id} theme={theme} nodo={n} activo={nav.activoId === n.id} fav={favoritos.includes(n.id)} onFav={() => toggleFavorito(n.id)} onClick={() => elegir(n)} />
              ))}
            </>
          ) : (
            <>
              {favs.length > 0 && (
                <Seccion theme={theme} titulo="Favoritos">
                  {favs.map((n) => (
                    <Item key={`fav-${n.id}`} theme={theme} nodo={n} activo={nav.activoId === n.id} fav onFav={() => toggleFavorito(n.id)} onClick={() => elegir(n)}
                      etiqueta={n.tipo === 'cliente' ? `${CLIENTES_NAV[n.clienteKey]?.label} · ${n.label}` : n.label} />
                  ))}
                </Seccion>
              )}
              {arbol.map((g) => {
                if (g.id === 'inicio') {
                  return (
                    <div key={g.id} style={{ marginTop: favs.length ? 8 : 4 }}>
                      {g.nodos.map((n) => <Item key={n.id} theme={theme} nodo={n} activo={nav.activoId === n.id} fav={favoritos.includes(n.id)} onFav={() => toggleFavorito(n.id)} onClick={() => elegir(n)} />)}
                    </div>
                  );
                }
                return (
                  <Seccion key={g.id} theme={theme} titulo={g.label}>
                    {g.nodos.map((n) => <Item key={n.id} theme={theme} nodo={n} activo={nav.activoId === n.id} fav={favoritos.includes(n.id)} onFav={() => toggleFavorito(n.id)} onClick={() => elegir(n)} />)}
                    {(g.clientes || []).map((c) => {
                      const activo = nav.activoId?.startsWith(`${c.key}:`);
                      return (
                        <Fila key={c.key} theme={theme} onClick={() => setCliente(c.key)} activo={false} peso={activo ? 600 : 500} title={c.label}
                          leading={<PuntoCliente color={c.color} size={9} activo={activo} style={{ margin: '0 4px' }} />} label={c.label}
                          trailing={<ChevronRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />} />
                      );
                    })}
                  </Seccion>
                );
              })}
            </>
          )}
        </nav>

        {/* Pie: logotipo + versión + selector de modo */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '10px 16px 12px', borderTop: `1px solid ${hairline(theme)}`, flexShrink: 0 }}>
          <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
            <Logotipo theme={theme} size={16} title="Acteck Dashboard" />
            <span title="Versión del dashboard" style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, whiteSpace: 'nowrap', userSelect: 'text' }}>{versionLabel()}</span>
          </span>
          <Segmented value={menu.modoMovil || 'cajon'} onChange={(v) => setPreferencia('menu.modoMovil', v)} options={MODOS_MENU_MOVIL.map((m) => ({ id: m.id, label: m.label, title: m.desc }))} />
        </div>
      </aside>
    </div>
  );
}

function Seccion({ theme, titulo, children }) {
  return (
    <div>
      <TituloSeccion theme={theme} style={{ fontSize: 10.5, padding: '14px 8px 6px' }}>{titulo}</TituloSeccion>
      {children}
    </div>
  );
}

function Fila({ theme, leading, label, trailing, onClick, activo, peso = 500, title, disabled, hint }) {
  const [down, setDown] = useState(false);
  return (
    <button type="button" title={title || label} onClick={disabled ? undefined : onClick} disabled={disabled}
      onTouchStart={() => !disabled && setDown(true)} onTouchEnd={() => setDown(false)} onTouchCancel={() => setDown(false)}
      style={{
        width: '100%', height: 44, display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px', border: 0, borderRadius: 9, cursor: disabled ? 'not-allowed' : 'pointer', marginBottom: 1,
        background: activo ? theme.accent : down ? (esMidnight(theme) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)') : 'transparent',
        color: activo ? '#FFF' : disabled ? (theme.textSubtle || theme.textMuted) : theme.text,
        fontFamily: TYPO.fontText, fontSize: 15, fontWeight: activo ? 600 : peso, letterSpacing: '-0.01em', textAlign: 'left',
        opacity: disabled ? 0.55 : 1, transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
      }}>
      {leading}
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {hint && !activo && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{hint}</span>}
      {trailing}
    </button>
  );
}

function Item({ theme, nodo, activo, fav, onFav, onClick, etiqueta }) {
  const Icon = nodo.icon;
  return (
    <Fila theme={theme} activo={activo} disabled={nodo.disabled} hint={nodo.hint} label={etiqueta || nodo.label} title={etiqueta || nodo.label} onClick={onClick}
      leading={Icon ? <Icon size={17} strokeWidth={1.9} style={{ flexShrink: 0, opacity: activo ? 1 : 0.85 }} /> : null}
      trailing={<BotonFav theme={activo ? { ...theme, textSubtle: 'rgba(255,255,255,0.8)', yellow: '#FFF' } : theme} activo={fav} visible onToggle={onFav} size={14} />} />
  );
}
