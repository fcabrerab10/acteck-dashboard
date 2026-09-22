// Paneles · varias pantallas a la vez en un monitor panorámico (≥ 1900 px).
//
// Desde 2026-09-21 no son "N columnas" sino **disposiciones** con nombre (uno · dos · tres ·
// dosArriba1Lado · unoLado2Derecha · unoArriba2Abajo · cuatro): cada una es una rejilla CSS con
// `grid-template-areas` y cada hueco lleva una <PanelPagina> independiente, con su propia
// pantalla, su propio scroll y su propio estado (filtros, meses, tablas).
//
// El hueco 0 (área "a") es la pestaña activa de la app: el menú, la paleta ⌘K y los eventos
// `acteck:navegar` cambian sólo ése, y es el único con PageTransition. Los demás se eligen en el
// selector de su cabecera. Todo se guarda por dispositivo (localStorage → disp_prefs_v1.<modo>.paneles
// = { disposicion, slots:[{pagina,clienteKey},…] }).
//
// Los huecos se intercambian arrastrando su cabecera (o con los botones ▲▼/◀▶). Si el que entra
// al hueco 0 es otro, la pestaña activa cambia con él (mismo camino que el menú).
//
//   <Paneles disposicion="dos" slots={[{pagina,clienteKey},…]} onCambiar={fn} paginaProps={…} arbol={…} />
import React, { Suspense, useMemo, useRef, useState } from 'react';
import { ChevronDown, X, GripVertical, ArrowUp, ArrowDown, ArrowLeft, ArrowRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Cargando } from '../kit';
import { PageTransition } from '../apple/AppleLoader';
import PaginaContenido from '../PaginaContenido';
import { nodosPlanos, CLIENTES_NAV } from './arbol';
import {
  DISPOSICION_POR_ID, DISPOSICION_DEFECTO, posicionSlot, intercambiarSlots,
  disposicionParaSlots, useDispositivo,
} from '../../lib/dispositivo';

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
const MIME_SLOT = 'text/x-acteck-panel';

export default function Paneles({
  disposicion, slots, columnas, onCambiar, paginaProps = {}, arbol = [], anchoMax = 0,
}) {
  const { theme } = useTheme();
  const { ancho, alto } = useDispositivo();
  const opciones = useMemo(() => opcionesDePaginas(arbol), [arbol]);
  // `columnas` es la forma vieja (array de columnas); se acepta para no romper nada que aún la pase.
  const lista = Array.isArray(slots) && slots.length ? slots : (Array.isArray(columnas) ? columnas : []);
  const idDisp = DISPOSICION_POR_ID[disposicion]
    ? disposicion
    : (disposicionParaSlots(Math.max(1, lista.length), { ancho, alto }) || DISPOSICION_DEFECTO);
  const def = DISPOSICION_POR_ID[idDisp] || DISPOSICION_POR_ID[DISPOSICION_DEFECTO];
  const huecos = lista.slice(0, def.slots);
  const [arrastrando, setArrastrando] = useState(null);

  const emitir = (nuevos, i, destino) => onCambiar?.({ disposicion: idDisp, slots: nuevos }, i, destino);

  const cambiar = (i, destino) => {
    const next = huecos.map((c, j) => (j === i ? { pagina: destino.pagina, clienteKey: destino.clienteKey || null } : c));
    emitir(next, i, destino);
  };

  const cerrar = (i) => {
    const next = huecos.filter((_, j) => j !== i);
    const nuevaDisp = disposicionParaSlots(next.length, { ancho, alto });
    const n0 = next[0];
    if (i === 0 && n0) paginaProps.onNavegar?.(n0.clienteKey || null, n0.pagina);
    onCambiar?.({ disposicion: nuevaDisp, slots: next }, i, null);
  };

  // Intercambiar dos huecos. Si toca al hueco 0, la pestaña activa se va con la pantalla que entra.
  const intercambiar = (i, j) => {
    if (i === j || !huecos[i] || !huecos[j]) return;
    const next = intercambiarSlots(huecos, i, j);
    if (i === 0 || j === 0) paginaProps.onNavegar?.(next[0].clienteKey || null, next[0].pagina);
    emitir(next, i, null);
  };

  return (
    <div
      data-disposicion={idDisp}
      style={{
        height: '100%', display: 'grid', gap: 12,
        gridTemplateAreas: def.gridTemplateAreas,
        gridTemplateColumns: def.gridTemplateColumns,
        gridTemplateRows: def.gridTemplateRows,
        padding: '4px 16px 14px', boxSizing: 'border-box',
        // Con más de un hueco la rejilla usa todo el monitor: el tope de ancho es para una pantalla sola.
        maxWidth: huecos.length > 1 ? undefined : (anchoMax > 0 ? anchoMax : undefined),
        margin: '0 auto', width: '100%',
      }}
    >
      {huecos.map((col, i) => (
        <PanelPagina
          key={`${i}-${col.clienteKey || 'g'}-${col.pagina}`}
          indice={i}
          total={huecos.length}
          disposicion={idDisp}
          columna={col}
          opciones={opciones}
          theme={theme}
          arrastrando={arrastrando}
          setArrastrando={setArrastrando}
          onIntercambiar={intercambiar}
          onElegir={i === 0
            ? (d) => paginaProps.onNavegar?.(d.clienteKey || null, d.pagina)   // el hueco 0 ES la pestaña activa
            : (d) => cambiar(i, d)}
          onCerrar={i > 0 ? () => cerrar(i) : null}
          paginaProps={paginaProps}
          principal={i === 0}
        />
      ))}
    </div>
  );
}

/** ▲▼ cuando el vecino está en otra fila, ◀▶ cuando está al lado. */
function flechaHacia(disposicion, desde, hacia) {
  const a = posicionSlot(disposicion, desde);
  const b = posicionSlot(disposicion, hacia);
  if (b.fila !== a.fila) return b.fila < a.fila ? ArrowUp : ArrowDown;
  return b.col < a.col ? ArrowLeft : ArrowRight;
}

function PanelPagina({
  indice, total, disposicion, columna, opciones, theme, onElegir, onCerrar, paginaProps, principal,
  arrastrando, setArrastrando, onIntercambiar,
}) {
  const actual = opciones.find((o) => mismaPagina(o, columna));
  const titulo = actual?.label || columna.pagina;
  // Dentro de un hueco secundario, navegar cambia ese hueco; en el principal manda la app.
  const onNavegar = principal
    ? paginaProps.onNavegar
    : (clienteKey, pagina) => onElegir({ pagina, clienteKey: clienteKey || null });

  const anterior = indice > 0 ? indice - 1 : null;
  const siguiente = indice < total - 1 ? indice + 1 : null;
  const FlechaAnt = anterior !== null ? flechaHacia(disposicion, indice, anterior) : null;
  const FlechaSig = siguiente !== null ? flechaHacia(disposicion, indice, siguiente) : null;
  const destino = arrastrando !== null && arrastrando !== indice;

  return (
    <section
      style={{
        gridArea: String.fromCharCode(97 + indice),
        minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', height: '100%',
        border: `1px solid ${destino ? theme.accent : theme.border}`, borderRadius: 14,
        background: theme.bg, overflow: 'hidden',
      }}
      onDragOver={(e) => { if (destino) e.preventDefault(); }}
      onDrop={(e) => {
        e.preventDefault();
        const origen = Number(e.dataTransfer?.getData(MIME_SLOT) ?? e.dataTransfer?.getData('text/plain'));
        setArrastrando(null);
        if (Number.isInteger(origen) && origen !== indice) onIntercambiar(origen, indice);
      }}
    >
      <header
        draggable={total > 1}
        onDragStart={(e) => {
          setArrastrando(indice);
          try {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData(MIME_SLOT, String(indice));
            e.dataTransfer.setData('text/plain', String(indice));
          } catch { /* navegadores quisquillosos */ }
        }}
        onDragEnd={() => setArrastrando(null)}
        title={total > 1 ? 'Arrastra esta cabecera para intercambiar los paneles' : undefined}
        style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px 6px 6px', flexShrink: 0,
          borderBottom: `1px solid ${theme.border}`, background: theme.surface,
          cursor: total > 1 ? 'grab' : 'default',
        }}
      >
        {total > 1 && <GripVertical size={13} style={{ flexShrink: 0, color: theme.textMuted, opacity: 0.7 }} />}
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted }}>
          {principal ? 'Principal' : `Panel ${indice + 1}`}
        </span>
        <SelectorPagina theme={theme} titulo={titulo} opciones={opciones} onElegir={onElegir} />
        <span style={{ flex: 1 }} />
        {FlechaAnt && (
          <BotonMover theme={theme} Icono={FlechaAnt} titulo="Mover este panel hacia atrás" onClick={() => onIntercambiar(indice, anterior)} />
        )}
        {FlechaSig && (
          <BotonMover theme={theme} Icono={FlechaSig} titulo="Mover este panel hacia adelante" onClick={() => onIntercambiar(indice, siguiente)} />
        )}
        {onCerrar && (
          <button type="button" onClick={onCerrar} title="Quitar este panel"
            style={{ width: 24, height: 24, border: 0, borderRadius: 7, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={13} />
          </button>
        )}
      </header>
      <div data-panel-scroll={indice} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', padding: '8px 12px 16px' }}>
        {/* La transición de página sólo en el principal: en los demás distrae más de lo que ayuda. */}
        <Envoltura principal={principal} claveTransicion={`${columna.clienteKey || 'g'}-${columna.pagina}`}>
          <Suspense fallback={<Cargando pantalla={columna.pagina} />}>
            <PaginaContenido {...paginaProps} onNavegar={onNavegar} pagina={columna.pagina} clienteKey={columna.clienteKey || null} />
          </Suspense>
        </Envoltura>
      </div>
    </section>
  );
}

function BotonMover({ theme, Icono, titulo, onClick }) {
  return (
    <button type="button" onClick={onClick} title={titulo} aria-label={titulo}
      style={{ width: 24, height: 24, border: 0, borderRadius: 7, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <Icono size={13} />
    </button>
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
        draggable={false} onDragStart={(e) => e.preventDefault()}
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
