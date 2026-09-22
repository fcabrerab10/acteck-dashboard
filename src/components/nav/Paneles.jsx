// Paneles · varias pantallas a la vez en un monitor panorámico (≥ 1900 px).
//
// Cada columna es una <PanelPagina> independiente: su propia pantalla, su propio scroll y su
// propio estado interno (filtros, meses, tablas). La PRIMERA columna es la pestaña activa de la
// app: navegar desde el menú, la paleta ⌘K o un evento `acteck:navegar` cambia sólo esa.
// Las demás se eligen en el selector de su cabecera y se guardan por dispositivo
// (localStorage → disp_prefs_v1.<modo>.paneles).
//
//   <Paneles columnas={[{pagina,clienteKey},…]} onCambiar={fn} paginaProps={…} arbol={…} />
import React, { Suspense, useMemo, useRef, useState } from 'react';
import { ChevronDown, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando } from '../kit';
import { PageTransition } from '../apple/AppleLoader';
import PaginaContenido from '../PaginaContenido';
import { nodosPlanos, CLIENTES_NAV } from './arbol';

/** Opciones del selector: todas las pantallas que el perfil puede ver (sin enlaces externos). */
export function opcionesDePaginas(arbol) {
  return nodosPlanos(arbol || [])
    .filter((n) => n.tipo !== 'enlace' && !n.disabled && n.pagina)
    .map((n) => ({
      id: n.id,
      pagina: n.pagina,
      clienteKey: n.clienteKey || null,
      label: n.clienteKey ? `${CLIENTES_NAV[n.clienteKey]?.label || n.clienteKey} · ${n.label}` : n.label,
    }));
}

const mismaPagina = (a, b) => a && b && a.pagina === b.pagina && (a.clienteKey || null) === (b.clienteKey || null);

export default function Paneles({ columnas, onCambiar, paginaProps = {}, arbol = [], anchoMax = 0 }) {
  const { theme } = useTheme();
  const opciones = useMemo(() => opcionesDePaginas(arbol), [arbol]);
  const n = Math.max(1, columnas.length);

  const cambiar = (i, destino) => {
    const next = columnas.map((c, j) => (j === i ? { pagina: destino.pagina, clienteKey: destino.clienteKey || null } : c));
    onCambiar?.(next, i, destino);
  };
  const cerrar = (i) => onCambiar?.(columnas.filter((_, j) => j !== i), i, null);

  return (
    <div style={{
      height: '100%', display: 'grid', gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))`, gap: 12,
      padding: '4px 16px 14px', boxSizing: 'border-box',
      maxWidth: anchoMax > 0 ? anchoMax : undefined, margin: '0 auto', width: '100%',
    }}>
      {columnas.map((col, i) => (
        <PanelPagina
          key={`${i}-${col.clienteKey || 'g'}-${col.pagina}`}
          indice={i}
          columna={col}
          opciones={opciones}
          theme={theme}
          onElegir={i === 0
            ? (d) => paginaProps.onNavegar?.(d.clienteKey || null, d.pagina)   // la primera columna ES la pestaña activa
            : (d) => cambiar(i, d)}
          onCerrar={i > 0 ? () => cerrar(i) : null}
          paginaProps={paginaProps}
          principal={i === 0}
        />
      ))}
    </div>
  );
}

function PanelPagina({ indice, columna, opciones, theme, onElegir, onCerrar, paginaProps, principal }) {
  const actual = opciones.find((o) => mismaPagina(o, columna));
  const titulo = actual?.label || columna.pagina;
  // Dentro de una columna secundaria, navegar cambia esa columna; en la primera manda la app.
  const onNavegar = principal
    ? paginaProps.onNavegar
    : (clienteKey, pagina) => onElegir({ pagina, clienteKey: clienteKey || null });

  return (
    <section style={{
      minWidth: 0, display: 'flex', flexDirection: 'column', height: '100%',
      border: `1px solid ${theme.border}`, borderRadius: 14, background: theme.bg, overflow: 'hidden',
    }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 10px', flexShrink: 0,
        borderBottom: `1px solid ${theme.border}`, background: theme.surface,
      }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}>
          {principal ? 'Principal' : `Panel ${indice + 1}`}
        </span>
        <SelectorPagina theme={theme} titulo={titulo} opciones={opciones} onElegir={onElegir} />
        <span style={{ flex: 1 }} />
        {onCerrar && (
          <button type="button" onClick={onCerrar} title="Quitar este panel"
            style={{ width: 24, height: 24, border: 0, borderRadius: 7, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} />
          </button>
        )}
      </header>
      <div data-panel-scroll={indice} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 12px 16px' }}>
        {/* La transición de página sólo en la principal: en las secundarias distrae más de lo que ayuda. */}
        <Envoltura principal={principal} claveTransicion={`${columna.clienteKey || 'g'}-${columna.pagina}`}>
          <Suspense fallback={<Cargando pantalla={columna.pagina} />}>
            <PaginaContenido {...paginaProps} onNavegar={onNavegar} pagina={columna.pagina} clienteKey={columna.clienteKey || null} />
          </Suspense>
        </Envoltura>
      </div>
    </section>
  );
}

function Envoltura({ principal, claveTransicion, children }) {
  return principal ? <PageTransition keyId={claveTransicion}>{children}</PageTransition> : children;
}

function SelectorPagina({ theme, titulo, opciones, onElegir }) {
  const [abierto, setAbierto] = useState(false);
  const [filtro, setFiltro] = useState('');
  const ref = useRef(null);
  const lista = useMemo(() => {
    const q = filtro.trim().toLowerCase();
    return q ? opciones.filter((o) => o.label.toLowerCase().includes(q)) : opciones;
  }, [opciones, filtro]);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 0 }}>
      <button type="button" onClick={() => { setAbierto((v) => !v); setFiltro(''); }} title="Elegir la pantalla de este panel"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 5, maxWidth: 260, height: 24, padding: '0 8px', cursor: 'pointer',
          border: `1px solid ${theme.border}`, borderRadius: 999, background: theme.bg, color: theme.text,
          fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.01em',
        }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{titulo}</span>
        <ChevronDown size={12} style={{ flexShrink: 0, opacity: 0.6 }} />
      </button>
      {abierto && (
        <>
          <div onClick={() => setAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 60 }} />
          <div style={{
            position: 'absolute', top: 28, left: 0, zIndex: 61, width: 260, maxHeight: 360, overflowY: 'auto',
            background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 6,
            boxShadow: '0 12px 32px rgba(0,0,0,0.16)',
          }}>
            <input value={filtro} onChange={(e) => setFiltro(e.target.value)} placeholder="Buscar pantalla…" autoFocus
              style={{ width: '100%', height: 28, marginBottom: 4, padding: '0 8px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, boxSizing: 'border-box' }} />
            {lista.length === 0 && <div style={{ padding: '8px 10px', fontSize: 12, color: theme.textMuted }}>Sin resultados.</div>}
            {lista.map((o) => (
              <button key={o.id} type="button" onClick={() => { onElegir(o); setAbierto(false); }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left', padding: '6px 8px', border: 0, borderRadius: 8,
                  background: o.label === titulo ? `${theme.accent}14` : 'transparent', color: theme.text,
                  fontFamily: TYPO.fontText, fontSize: 12.5, cursor: 'pointer',
                }}>
                {o.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
