// Barra superior oscura translúcida estilo apple.com · sin sidebar.
// Ítems por grupo con mega-menú (grid de 4+ columnas: subgrupos + Favoritos), submenú de clientes,
// a la izquierda el logotipo "acteck."; a la derecha ⌘K · avatar con contador (ChromeDerecho oscuro).
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { ChromeDerecho } from '../Topbar';
import { esNodoActivo, irANodo, resolverFavoritos, CLIENTES_NAV } from './arbol';
import { BotonFav, PuntoCliente, Logotipo, esMidnight } from './comun';

export const BARRA_ALTO = 48;
const CORTO = { direccionGeneral: 'General', direccionComercial: 'Comercial', clientesPropios: 'Clientes', interno: 'Interno', axon: 'Axon' };

export default function BarraApple({ arbol, favoritos, toggleFavorito, estado, onNavegar, onAbrirPaleta, onAbrirAtajos, chrome, modoPresent }) {
  const { theme } = useTheme();
  const dark = esMidnight(theme);
  const [abierto, setAbierto] = useState(null);
  const rootRef = useRef(null);
  const timer = useRef(null);

  const grupos = useMemo(() => arbol.filter((g) => g.id !== 'inicio' && g.id !== 'configuracion'), [arbol]);
  const inicio = useMemo(() => arbol.find((g) => g.id === 'inicio')?.nodos?.[0] || null, [arbol]);
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos), [arbol, favoritos]);

  const cancelar = () => { if (timer.current) { clearTimeout(timer.current); timer.current = null; } };
  const abrir = (id) => { cancelar(); setAbierto(id); };
  const cerrarLuego = () => { cancelar(); timer.current = setTimeout(() => { setAbierto(null); timer.current = null; }, 200); };
  useEffect(() => {
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setAbierto(null); };
    const onKey = (e) => { if (e.key === 'Escape') setAbierto(null); };
    document.addEventListener('mousedown', onDoc); window.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDoc); window.removeEventListener('keydown', onKey); };
  }, []);
  useEffect(() => { setAbierto(null); }, [estado.paginaActiva, estado.clienteActivo, estado.vistaActual]);

  const grupoActivo = useMemo(() => {
    if (estado.vistaActual === 'configuracion') return 'configuracion';
    for (const g of arbol) {
      if (g.nodos.some((n) => esNodoActivo(n, estado))) return g.id;
      if ((g.clientes || []).some((c) => c.nodos.some((n) => esNodoActivo(n, estado)))) return g.id;
    }
    return null;
  }, [arbol, estado]);

  const colorTexto = 'rgba(255,255,255,0.82)';
  const g = grupos.find((x) => x.id === abierto);

  return (
    <div ref={rootRef} style={{ position: 'sticky', top: 0, zIndex: 45 }} onMouseLeave={cerrarLuego} onMouseEnter={cancelar}>
      <div style={{
        height: BARRA_ALTO, display: 'flex', alignItems: 'center', gap: 2, padding: '0 14px',
        background: dark ? 'rgba(0,0,0,0.7)' : 'rgba(29,29,31,0.86)',
        backdropFilter: 'saturate(180%) blur(20px)', WebkitBackdropFilter: 'saturate(180%) blur(20px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)', color: colorTexto, fontFamily: TYPO.fontText,
      }}>
        {/* Marca */}
        <Logotipo theme={theme} oscuro size={15} title="Inicio" onClick={() => inicio && irANodo(inicio, onNavegar)} style={{ padding: '0 8px 0 4px', cursor: 'pointer' }} />
        <span style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.14)', margin: '0 8px' }} />

        {inicio && (
          <ItemBarra label="Inicio" activo={grupoActivo === 'inicio'} onClick={() => irANodo(inicio, onNavegar)} onMouseEnter={() => abrir(null)} />
        )}
        {grupos.map((gr) => (
          <ItemBarra key={gr.id} label={CORTO[gr.id] || gr.label} activo={grupoActivo === gr.id} abierto={abierto === gr.id} chevron
            onClick={() => setAbierto(abierto === gr.id ? null : gr.id)} onMouseEnter={() => abrir(gr.id)} />
        ))}

        <span style={{ flex: 1 }} />
        {modoPresent && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px', borderRadius: 999, background: 'rgba(52,199,89,0.18)', color: '#30D158', fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 8 }}>
            <span style={{ width: 5, height: 5, borderRadius: 999, background: '#30D158' }} />Presentación
          </span>
        )}
        <ChromeDerecho {...chrome} oscuro mostrarBuscar onAbrirPaleta={onAbrirPaleta} onAbrirAtajos={onAbrirAtajos} />
      </div>

      {/* Mega-menú */}
      <div aria-hidden={!g} style={{
        position: 'absolute', left: 0, right: 0, top: BARRA_ALTO, overflow: 'hidden',
        pointerEvents: g ? 'auto' : 'none', opacity: g ? 1 : 0, transform: g ? 'translateY(0)' : 'translateY(-6px)',
        transition: `opacity ${DUR.state}ms ${EASE}, transform ${DUR.state}ms ${EASE}`,
      }}>
        {g && (
          <div style={{
            background: dark ? 'rgba(0,0,0,0.82)' : 'rgba(29,29,31,0.92)', backdropFilter: 'saturate(180%) blur(30px)', WebkitBackdropFilter: 'saturate(180%) blur(30px)',
            borderBottom: '1px solid rgba(255,255,255,0.10)', boxShadow: '0 24px 48px rgba(0,0,0,0.35)', color: colorTexto, fontFamily: TYPO.fontText,
          }}>
            <MegaMenu grupo={g} favs={favs} favoritos={favoritos} toggleFavorito={toggleFavorito} estado={estado} onNavegar={onNavegar} theme={theme} />
          </div>
        )}
      </div>
    </div>
  );
}

function ItemBarra({ label, activo, abierto, chevron, onClick, onMouseEnter }) {
  const [h, setH] = useState(false);
  return (
    <button type="button" onClick={onClick} onMouseEnter={() => { setH(true); onMouseEnter?.(); }} onMouseLeave={() => setH(false)}
      style={{
        height: 30, padding: '0 11px', border: 0, borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4,
        background: activo ? 'rgba(255,255,255,0.14)' : h || abierto ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: activo || h || abierto ? '#FFF' : 'rgba(255,255,255,0.78)', fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: activo ? 600 : 500, letterSpacing: '-0.01em',
        transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
      }}>
      {label}
      {chevron && <ChevronDown size={10} style={{ opacity: 0.6, transform: abierto ? 'rotate(180deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />}
    </button>
  );
}

function MegaMenu({ grupo, favs, favoritos, toggleFavorito, estado, onNavegar, theme }) {
  // Columnas: nodos del grupo (una columna) + una por cliente + Favoritos.
  const columnas = [];
  if (grupo.nodos.length) columnas.push({ id: `g-${grupo.id}`, titulo: grupo.label, nodos: grupo.nodos });
  for (const c of grupo.clientes || []) columnas.push({ id: `c-${c.key}`, titulo: c.label, color: c.color, nodos: c.nodos, cliente: c });
  const n = Math.max(4, columnas.length + 1);
  return (
    <div style={{ maxWidth: 1600, margin: '0 auto', padding: '18px 24px 22px', display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 20 }}>
      {columnas.map((col) => (
        <Columna key={col.id} titulo={col.titulo} color={col.color}>
          {col.nodos.map((nodo) => (
            <FilaMega key={nodo.id} nodo={nodo} activo={esNodoActivo(nodo, estado)} fav={favoritos.includes(nodo.id)}
              onFav={() => toggleFavorito(nodo.id)} onClick={() => irANodo(nodo, onNavegar)} theme={theme} />
          ))}
        </Columna>
      ))}
      {/* relleno para mantener la rejilla de 4 */}
      {Array.from({ length: Math.max(0, n - columnas.length - 1) }).map((_, i) => <div key={`vacio-${i}`} />)}
      <Columna titulo="Favoritos" color="#FFCC00">
        {favs.length === 0 && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.45)', padding: '4px 8px' }}>Pasa el cursor por una pestaña y pulsa ☆</div>}
        {favs.map((nodo) => (
          <FilaMega key={`fav-${nodo.id}`} nodo={nodo} activo={esNodoActivo(nodo, estado)} fav
            etiqueta={nodo.tipo === 'cliente' ? `${CLIENTES_NAV[nodo.clienteKey]?.label} · ${nodo.label}` : nodo.label}
            onFav={() => toggleFavorito(nodo.id)} onClick={() => irANodo(nodo, onNavegar)} theme={theme} />
        ))}
      </Columna>
    </div>
  );
}

function Columna({ titulo, color, children }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 6px', fontSize: 10, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
        {color && <PuntoCliente color={color} size={7} />}
        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>{children}</div>
    </div>
  );
}

function FilaMega({ nodo, activo, fav, onFav, onClick, theme, etiqueta }) {
  const [h, setH] = useState(false);
  const Icon = nodo.icon;
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} onClick={nodo.disabled ? undefined : onClick} role="button" tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (!nodo.disabled) onClick(); } }}
      style={{
        display: 'flex', alignItems: 'center', gap: 9, height: 30, padding: '0 8px', borderRadius: 7, cursor: nodo.disabled ? 'not-allowed' : 'pointer',
        background: activo ? theme.accent : h ? 'rgba(255,255,255,0.08)' : 'transparent',
        color: activo ? '#FFF' : nodo.disabled ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: activo ? 600 : 500, letterSpacing: '-0.01em',
        transition: `background ${DUR.state}ms ${EASE}`, outline: 'none',
      }}>
      {Icon && <Icon size={14} strokeWidth={1.9} style={{ flexShrink: 0, opacity: activo ? 1 : 0.8 }} />}
      <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{etiqueta || nodo.label}</span>
      {nodo.hint && !activo && <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.45)' }}>{nodo.hint}</span>}
      {activo && <Check size={12} style={{ opacity: 0.9 }} />}
      <BotonFav theme={{ ...theme, textSubtle: 'rgba(255,255,255,0.6)', yellow: '#FFD60A' }} activo={fav} visible={h} onToggle={onFav} size={11} />
    </div>
  );
}
