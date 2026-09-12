// Sidebar translúcida estilo iPad (Música / Notas / Ajustes) · chrome V3 opción C.
// Cabecera = tarjeta de perfil (avatar 30 con foto, nombre, cargo; al tocarla abre el PanelAvatar) +
// botón de colapsar. Buscador ("Buscar ⌘K"), sección FAVORITOS, grupos con título en versalitas, ítem
// activo con fondo theme.accent y texto blanco, clientes con punto de color. Al pie: logotipo "acteck."
// con la versión a la derecha. Colapsa a 56 px (botón y automático < 1100 px): sólo avatar arriba y
// monograma "a." abajo. El título grande de la pestaña lo pone cada pantalla.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { versionLabel } from '../../lib/version';
import { AvatarImg, usePerfilVivo } from '../../lib/avatar';
import { cargoDe } from '../perfil/comun';
import { abrirPanelAvatar } from '../perfil/PanelAvatar';
import { esNodoActivo, idActivo, irANodo, resolverFavoritos, CLIENTES_NAV } from './arbol';
import { Kbd, BotonFav, PuntoCliente, TituloSeccion, Logotipo, Monograma, vidrio, hoverBg, hairline, esMidnight } from './comun';
import { useResaltadoDeslizante } from './Resaltado';

export const SIDEBAR_ANCHO = 232;
export const SIDEBAR_COLAPSADA = 56;
const LS_COLAPSO = 'nav_sidebar_colapsada_v1';
const UMBRAL_AUTO = 1100;

export default function SidebarIpad({ arbol, favoritos, toggleFavorito, estado, onNavegar, onAbrirPaleta, densidad = 'comoda', modoPresent, perfil: perfilProp }) {
  const { theme } = useTheme();
  const dark = esMidnight(theme);
  const perfil = usePerfilVivo(perfilProp);

  // Colapso: manual (persistido) o automático por ancho (< 1100 px). El manual manda mientras no cambie el umbral.
  const [manual, setManual] = useState(() => { try { const v = localStorage.getItem(LS_COLAPSO); return v == null ? null : v === '1'; } catch { return null; } });
  const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && window.innerWidth < UMBRAL_AUTO);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${UMBRAL_AUTO - 1}px)`);
    const fn = (e) => { setAngosto(e.matches); setManual(null); try { localStorage.removeItem(LS_COLAPSO); } catch {} };
    mq.addEventListener ? mq.addEventListener('change', fn) : mq.addListener(fn);
    return () => { mq.removeEventListener ? mq.removeEventListener('change', fn) : mq.removeListener(fn); };
  }, []);
  const colapsada = manual == null ? angosto : manual;
  const toggleColapso = () => { const v = !colapsada; setManual(v); try { localStorage.setItem(LS_COLAPSO, v ? '1' : '0'); } catch {} };

  // Cliente expandido: el activo por defecto; se puede abrir otro
  const [clienteAbierto, setClienteAbierto] = useState(estado.clienteActivo || null);
  useEffect(() => { if (estado.clienteActivo) setClienteAbierto(estado.clienteActivo); }, [estado.clienteActivo]);

  // Inicio ya tiene su fila fija arriba: no se duplica en FAVORITOS (sigue contando para ⌘1).
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos).filter((n) => n.id !== 'inicio'), [arbol, favoritos]);
  const compacta = densidad === 'compacta';
  const ancho = colapsada ? SIDEBAR_COLAPSADA : SIDEBAR_ANCHO;

  // Pastilla de vidrio deslizante. La sidebar es una superficie casi blanca y plana: variante `plano`
  // (rgba(0,0,0,.05) + luces internas), si no el vidrio translúcido no se lee sobre ella.
  // Si la pestaña activa también está en FAVORITOS, la pastilla se queda en la fila de Favoritos
  // (la de arriba); la copia de abajo conserva sólo el peso 600.
  const activoNodo = idActivo(estado);
  const claveActiva = useMemo(() => {
    if (!activoNodo) return null;
    if (favs.some((n) => n.id === activoNodo)) return `fav-${activoNodo}`;
    return activoNodo;
  }, [activoNodo, favs]);
  const res = useResaltadoDeslizante(claveActiva, { theme, radio: 7, plano: true, deps: `${colapsada}-${compacta}-${clienteAbierto}-${favs.length}-${arbol.length}` });

  return (
    <aside style={{
      width: ancho, minWidth: ancho, height: '100vh', display: 'flex', flexDirection: 'column', flexShrink: 0,
      ...vidrio(theme, 'chrome'), borderRight: `1px solid ${hairline(theme)}`,
      color: theme.text, fontFamily: TYPO.fontText, overflow: 'hidden',
      transition: `width ${DUR.content}ms ${EASE}, min-width ${DUR.content}ms ${EASE}`,
      position: 'relative', zIndex: 30,
    }}>
      {/* Tarjeta de perfil + colapso */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: colapsada ? '12px 0 6px' : '10px 8px 6px 8px', flexDirection: colapsada ? 'column' : 'row', justifyContent: colapsada ? 'center' : 'space-between', minHeight: 48 }}>
        <TarjetaPerfil theme={theme} perfil={perfil} colapsada={colapsada} modoPresent={modoPresent} onClick={() => abrirPanelAvatar()} />
        <BotonIcono theme={theme} title={colapsada ? 'Expandir menú' : 'Colapsar menú'} onClick={toggleColapso}>
          {colapsada ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </BotonIcono>
      </div>

      {/* Buscador */}
      <div style={{ padding: colapsada ? '2px 8px 6px' : '2px 10px 6px' }}>
        <button type="button" onClick={onAbrirPaleta} title="Buscar (⌘K)"
          style={{
            width: '100%', height: 30, display: 'flex', alignItems: 'center', gap: 8, padding: colapsada ? 0 : '0 9px', justifyContent: colapsada ? 'center' : 'flex-start',
            border: `1px solid ${hairline(theme)}`, borderRadius: 8, cursor: 'pointer',
            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.65)', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12.5,
          }}>
          <Search size={13} />
          {!colapsada && <><span style={{ flex: 1, textAlign: 'left' }}>Buscar</span><Kbd theme={theme}>⌘K</Kbd></>}
        </button>
      </div>

      {/* Navegación */}
      <nav ref={res.refContenedor} style={{ position: 'relative', flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: colapsada ? '0 8px 12px' : '0 10px 12px', scrollbarWidth: 'thin' }}>
        {res.pastilla}
        {favs.length > 0 && (
          <Seccion theme={theme} titulo="Favoritos" colapsada={colapsada}>
            {favs.map((n) => (
              <Item key={`fav-${n.id}`} theme={theme} nodo={n} colapsada={colapsada} compacta={compacta} innerRef={res.refItem(`fav-${n.id}`)}
                activo={esNodoActivo(n, estado)} fav={true} onFav={() => toggleFavorito(n.id)}
                etiqueta={n.tipo === 'cliente' ? `${CLIENTES_NAV[n.clienteKey]?.label} · ${n.label}` : n.label}
                onClick={() => irANodo(n, onNavegar)} />
            ))}
          </Seccion>
        )}

        {arbol.map((g) => {
          if (g.id === 'inicio') {
            return (
              <div key={g.id} style={{ marginTop: favs.length ? 8 : 4 }}>
                {g.nodos.map((n) => (
                  <Item key={n.id} theme={theme} nodo={n} colapsada={colapsada} compacta={compacta} activo={esNodoActivo(n, estado)} innerRef={res.refItem(n.id)}
                    fav={favoritos.includes(n.id)} onFav={() => toggleFavorito(n.id)} onClick={() => irANodo(n, onNavegar)} />
                ))}
              </div>
            );
          }
          return (
            <Seccion key={g.id} theme={theme} titulo={g.label} colapsada={colapsada}>
              {g.nodos.map((n) => (
                <Item key={n.id} theme={theme} nodo={n} colapsada={colapsada} compacta={compacta} activo={esNodoActivo(n, estado)} innerRef={res.refItem(n.id)}
                  fav={favoritos.includes(n.id)} onFav={() => toggleFavorito(n.id)} onClick={() => irANodo(n, onNavegar)} />
              ))}
              {(g.clientes || []).map((c) => {
                const abierto = !colapsada && clienteAbierto === c.key;
                const clienteActivo = estado.clienteActivo === c.key && estado.vistaActual !== 'configuracion';
                return (
                  <div key={c.key}>
                    <FilaBase theme={theme} colapsada={colapsada} compacta={compacta} title={c.label}
                      onClick={() => { if (colapsada) { onNavegar?.(c.key, c.nodos[0]?.pagina || 'home'); return; } setClienteAbierto(abierto ? null : c.key); }}
                      leading={<PuntoCliente color={c.color} size={colapsada ? 10 : 8} activo={clienteActivo} />}
                      label={c.label} peso={clienteActivo ? 600 : 500}
                      trailing={<ChevronRight size={12} style={{ opacity: 0.5, transform: abierto ? 'rotate(90deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />} />
                    <div style={{ display: 'grid', gridTemplateRows: abierto ? '1fr' : '0fr', transition: `grid-template-rows ${DUR.content}ms ${EASE}` }}>
                      <div style={{ overflow: 'hidden' }}>
                        <div style={{ paddingLeft: 14, paddingBottom: 4 }}>
                          {c.nodos.map((n) => (
                            <Item key={n.id} theme={theme} nodo={n} colapsada={false} compacta={compacta} activo={esNodoActivo(n, estado)} innerRef={res.refItem(n.id)}
                              fav={favoritos.includes(n.id)} onFav={() => toggleFavorito(n.id)} onClick={() => irANodo(n, onNavegar)} />
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </Seccion>
          );
        })}
      </nav>

      {/* Pie: logotipo + versión (colapsada: monograma) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: colapsada ? 'center' : 'space-between', gap: 8, padding: colapsada ? '8px 0 14px' : '8px 16px 14px', borderTop: `1px solid ${hairline(theme)}`, flexShrink: 0 }}>
        {colapsada
          ? <Monograma theme={theme} title={`Acteck Dashboard ${versionLabel()}`} />
          : <>
              <Logotipo theme={theme} size={15} title="Acteck Dashboard" />
              <span title="Versión del dashboard" style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.textSubtle || theme.textMuted, letterSpacing: '0.01em', whiteSpace: 'nowrap', userSelect: 'text' }}>{versionLabel()}</span>
            </>}
      </div>
    </aside>
  );
}

function TarjetaPerfil({ theme, perfil, colapsada, modoPresent, onClick }) {
  const [h, setH] = useState(false);
  const nombre = perfil?.nombre || perfil?.email || 'Usuario';
  const cargo = modoPresent ? 'Presentación' : cargoDe(perfil);
  return (
    <button type="button" onClick={onClick} title={`${nombre} · perfil, avisos y datos`} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: colapsada ? '0 0 auto' : 1, border: 0, cursor: 'pointer', textAlign: 'left',
        padding: colapsada ? 2 : '3px 6px 3px 3px', borderRadius: colapsada ? 999 : 9, background: h ? hoverBg(theme) : 'transparent',
        color: theme.text, fontFamily: TYPO.fontText, transition: `background ${DUR.state}ms ${EASE}`,
      }}>
      <span style={{ display: 'inline-flex', borderRadius: 999, boxShadow: modoPresent ? `0 0 0 2px ${theme.green || '#34C759'}` : 'none', flexShrink: 0 }}>
        <AvatarImg perfil={perfil} size={30} />
      </span>
      {!colapsada && (
        <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.15, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombre}</span>
          {cargo && <span style={{ fontSize: 10, color: modoPresent ? (theme.green || '#34C759') : theme.textMuted, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cargo}</span>}
        </span>
      )}
    </button>
  );
}

function BotonIcono({ theme, title, onClick, children }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" title={title} onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{ width: 28, height: 28, border: 0, borderRadius: 7, cursor: 'pointer', background: h ? hoverBg(theme) : 'transparent', color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {children}
    </button>
  );
}

function Seccion({ theme, titulo, colapsada, children }) {
  if (colapsada) {
    return (
      <div style={{ marginTop: 6 }}>
        <div style={{ height: 1, background: hairline(theme), margin: '6px 8px 6px' }} title={titulo} />
        {children}
      </div>
    );
  }
  return (
    <div>
      <TituloSeccion theme={theme}>{titulo}</TituloSeccion>
      {children}
    </div>
  );
}

function FilaBase({ theme, colapsada, compacta, leading, label, trailing, onClick, activo, peso = 500, title, disabled, hint, extra, innerRef }) {
  const [h, setH] = useState(false);
  const alto = compacta ? 26 : 30;
  return (
    <button ref={innerRef} type="button" title={title || label} onClick={disabled ? undefined : onClick} disabled={disabled}
      onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        position: 'relative',
        width: '100%', height: alto, display: 'flex', alignItems: 'center', gap: 9, padding: colapsada ? 0 : '0 8px', justifyContent: colapsada ? 'center' : 'flex-start',
        border: 0, borderRadius: 7, cursor: disabled ? 'not-allowed' : 'pointer', marginBottom: 1,
        background: activo ? 'transparent' : h && !disabled ? hoverBg(theme) : 'transparent',
        color: disabled ? (theme.textSubtle || theme.textMuted) : theme.text,
        fontFamily: TYPO.fontText, fontSize: compacta ? 12.5 : 13, fontWeight: activo ? 600 : peso, letterSpacing: '-0.01em', textAlign: 'left',
        opacity: disabled ? 0.55 : 1, transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
      }}>
      {leading}
      {!colapsada && <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
      {!colapsada && hint && !activo && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{hint}</span>}
      {!colapsada && extra && extra(h)}
      {!colapsada && trailing}
    </button>
  );
}

function Item({ theme, nodo, colapsada, compacta, activo, fav, onFav, onClick, etiqueta, innerRef }) {
  const Icon = nodo.icon;
  const leading = nodo.tipo === 'cliente' && !etiqueta && colapsada
    ? <PuntoCliente color={nodo.color} size={10} activo={activo} />
    : Icon ? <Icon size={colapsada ? 17 : 15} strokeWidth={1.9} style={{ flexShrink: 0, opacity: activo ? 1 : 0.85 }} /> : null;
  return (
    <FilaBase theme={theme} colapsada={colapsada} compacta={compacta} activo={activo} disabled={nodo.disabled} hint={nodo.hint} innerRef={innerRef}
      leading={leading} label={etiqueta || nodo.label} title={etiqueta || nodo.label} onClick={onClick}
      extra={(hover) => (
        <BotonFav theme={theme} activo={fav} visible={hover} onToggle={onFav} size={11} />
      )} />
  );
}
