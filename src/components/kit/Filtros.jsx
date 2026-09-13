// Filtros del kit · diseño B aprobado por Fernando (2026-09-13): "un botón por grupo".
// Una sola fila arriba de la tabla: buscador · un botón por grupo (Estado ▾, Proveedor ▾, …) ·
// Limpiar · resumen ("208 de 818 SKUs") · acciones. Cada botón lleva un badge con cuántas
// opciones están marcadas y se resalta cuando tiene alguna. Al pulsarlo se abre un popover
// anclado bajo el botón (en pantallas < 700 px, una hoja desde abajo) con buscador cuando el
// grupo tiene más de 8 opciones, la lista con el conteo facetado a la derecha, "Sólo éste"
// por fila y un pie "Listo". Debajo de la fila van las pastillas de lo que está activo, con su ×.
//
//   grupos:  [{ id, label, opciones: [{ id, label, n, tone?, title? }], seleccion: Set | string | null,
//              multiple = true, buscador = 'auto' }]
//   toggles: [{ id, label, on, n?, tone? }]   → banderas booleanas al final de la fila
//
// El popover va por portal a <body>: dentro de la página hay ancestros con transform
// (PageTransition), y un `position: fixed` bajo un transform queda relativo a él.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { toneColors } from './Pill';

const ANCHO_POPOVER = 300;
const MAX_FILAS_VISIBLES = 300;   // 730 clientes no se pintan de golpe: se busca
export const UMBRAL_BUSCADOR = 8; // más de 8 opciones → el grupo trae su buscador
export const ANCHO_HOJA = 700;    // < 700 px: hoja desde abajo en vez de popover

const fmt = (n) => (n == null || Number.isNaN(n) ? '' : Math.round(n).toLocaleString('es-MX'));

/** Texto comparable: minúsculas y sin acentos. */
export function normaliza(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

/** ¿Está marcada esta opción? La selección puede ser un Set (multi) o un valor suelto (single). */
export function estaSel(seleccion, id) {
  if (seleccion instanceof Set) return seleccion.has(id);
  return seleccion != null && seleccion !== '' && seleccion === id;
}

/** Cuántas opciones marcadas tiene un grupo. */
export function cuentaSel(seleccion) {
  if (seleccion instanceof Set) return seleccion.size;
  return seleccion != null && seleccion !== '' ? 1 : 0;
}

/** Ids marcados, en orden de aparición. */
export function idsSel(seleccion) {
  if (seleccion instanceof Set) return [...seleccion];
  return seleccion != null && seleccion !== '' ? [seleccion] : [];
}

/** Orden de la lista: marcadas primero, luego por conteo desc, y las de 0 resultados al final. */
export function ordenarOpciones(opciones = [], seleccion) {
  return [...opciones].sort((a, b) => {
    const sa = estaSel(seleccion, a.id) ? 1 : 0;
    const sb = estaSel(seleccion, b.id) ? 1 : 0;
    if (sa !== sb) return sb - sa;
    const za = !sa && !(a.n > 0) ? 1 : 0;
    const zb = !sb && !(b.n > 0) ? 1 : 0;
    if (za !== zb) return za - zb;
    const na = Number(a.n || 0), nb = Number(b.n || 0);
    if (na !== nb) return nb - na;
    return String(a.label ?? a.id).localeCompare(String(b.label ?? b.id), 'es');
  });
}

/** Búsqueda dentro del grupo: palabras en cualquier orden, sin acentos. */
export function filtrarOpciones(opciones = [], q) {
  const toks = normaliza(q).split(/\s+/).filter(Boolean);
  if (!toks.length) return opciones;
  return opciones.filter((o) => {
    const txt = `${normaliza(o.label ?? '')} ${normaliza(o.id ?? '')}`;
    return toks.every((t) => txt.includes(t));
  });
}

/** Etiqueta de una opción por su id (para las pastillas de lo activo). */
export function etiquetaDe(grupo, id) {
  const o = (grupo.opciones || []).find((x) => x.id === id);
  return o ? (o.label ?? o.id) : id;
}

// ─────────────────────────────────────────────────────────── fila de opción
function FilaOpcion({ theme, opcion, on, onToggle, onSolo, multiple }) {
  const [hover, setHover] = useState(false);
  const apagada = !on && !(opcion.n > 0);
  const accent = theme.accent || '#007AFF';
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ display: 'flex', alignItems: 'center', gap: 4, borderRadius: 8, background: hover ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : 'transparent' }}>
      <button type="button" role="checkbox" aria-checked={on} onClick={onToggle} title={opcion.title || opcion.label}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 8px', borderRadius: 8,
          border: 0, background: 'transparent', cursor: 'pointer', textAlign: 'left',
          color: apagada ? theme.textMuted : theme.text, opacity: apagada ? 0.55 : 1,
          fontFamily: TYPO.fontText, fontSize: 12,
        }}>
        <span aria-hidden style={{
          width: 15, height: 15, flexShrink: 0, borderRadius: multiple ? 4 : 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          border: `1.5px solid ${on ? accent : (theme.borderStrong || theme.border)}`, background: on ? accent : 'transparent', color: '#FFF',
          transition: `background ${DUR.tap}ms ${EASE}, border-color ${DUR.tap}ms ${EASE}`,
        }}>{on && <Check size={10} strokeWidth={3} />}</span>
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opcion.label ?? opcion.id}</span>
        <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(opcion.n)}</span>
      </button>
      {onSolo && (
        <button type="button" onClick={onSolo} title="Dejar sólo esta opción en el grupo"
          style={{
            flexShrink: 0, height: 22, padding: '0 7px', marginRight: 4, borderRadius: 999, cursor: 'pointer',
            border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted,
            fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, whiteSpace: 'nowrap',
            visibility: hover ? 'visible' : 'hidden',
          }}>Sólo éste</button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────── popover / hoja
function PanelGrupo({ grupo, rect, onCerrar, onToggle, onSolo }) {
  const { theme } = useTheme();
  const cajaRef = useRef(null);
  const [q, setQ] = useState('');
  const [hoja, setHoja] = useState(() => (typeof window !== 'undefined' ? window.innerWidth < ANCHO_HOJA : false));

  useEffect(() => {
    const onResize = () => setHoja(window.innerWidth < ANCHO_HOJA);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); onCerrar(); } };
    const onFuera = (e) => { if (cajaRef.current && !cajaRef.current.contains(e.target) && !e.target.closest?.('[data-filtros-boton]')) onCerrar(); };
    window.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onFuera, true);
    return () => { window.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onFuera, true); };
  }, [onCerrar]);

  const multiple = grupo.multiple !== false;
  const conBuscador = grupo.buscador === true || (grupo.buscador !== false && (grupo.opciones || []).length > UMBRAL_BUSCADOR);
  const ordenadas = useMemo(() => ordenarOpciones(grupo.opciones, grupo.seleccion), [grupo.opciones, grupo.seleccion]);
  const visibles = useMemo(() => filtrarOpciones(ordenadas, q), [ordenadas, q]);
  const recortadas = visibles.slice(0, MAX_FILAS_VISIBLES);
  const nSel = cuentaSel(grupo.seleccion);

  const pos = hoja
    ? { position: 'fixed', left: 0, right: 0, bottom: 0, maxHeight: '70vh', borderRadius: '16px 16px 0 0' }
    : (() => {
      const w = ANCHO_POPOVER;
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
      let left = rect?.left ?? 12;
      if (left + w > vw - 8) left = Math.max(8, (rect?.right ?? vw) - w);   // se voltea a la izquierda
      return { position: 'fixed', top: (rect?.bottom ?? 0) + 6, left, width: w, maxHeight: 'min(420px, 70vh)', borderRadius: 12 };
    })();

  const caja = (
    <div ref={cajaRef} role="dialog" aria-label={`Filtrar por ${grupo.label}`}
      style={{
        ...pos, zIndex: 80, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: theme.surface, border: bordeFlotante(theme), boxShadow: elevation(theme, 'flotante'),
        fontFamily: TYPO.fontText, color: theme.text,
      }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: `1px solid ${theme.border}` }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '-0.01em', flex: 1, minWidth: 0 }}>{grupo.label}</span>
        <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{nSel ? `${nSel} marcada${nSel === 1 ? '' : 's'}` : `${(grupo.opciones || []).length} opciones`}</span>
      </div>

      {conBuscador && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '8px 10px 4px', padding: '0 10px', height: 28, borderRadius: 999, border: `1px solid ${q ? (theme.accent || '#007AFF') : theme.border}`, background: theme.bg }}>
          <Search size={12} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.preventDefault(); }}
            placeholder={`Buscar en ${String(grupo.label).toLowerCase()}…`} aria-label={`Buscar en ${grupo.label}`}
            style={{ border: 0, outline: 0, background: 'transparent', fontFamily: TYPO.fontText, fontSize: 12, color: theme.text, flex: 1, minWidth: 0 }} />
          {q && <X size={12} style={{ color: theme.textMuted, cursor: 'pointer', flexShrink: 0 }} onClick={() => setQ('')} />}
        </div>
      )}

      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 6px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {recortadas.map((o) => (
          <FilaOpcion key={o.id} theme={theme} opcion={o} multiple={multiple} on={estaSel(grupo.seleccion, o.id)}
            onToggle={() => onToggle(grupo.id, o.id)}
            onSolo={multiple ? () => onSolo(grupo.id, o.id) : null} />
        ))}
        {recortadas.length === 0 && <span style={{ padding: '10px 8px', fontSize: 11.5, color: theme.textMuted }}>Nada coincide con la búsqueda.</span>}
        {visibles.length > recortadas.length && (
          <span style={{ padding: '6px 8px', fontSize: 10.5, color: theme.textMuted }}>y {fmt(visibles.length - recortadas.length)} más · usa el buscador</span>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8, padding: '8px 10px', borderTop: `1px solid ${theme.border}` }}>
        <button type="button" onClick={onCerrar}
          style={{ height: 26, padding: '0 14px', borderRadius: 999, border: 0, cursor: 'pointer', background: theme.accent || '#007AFF', color: '#FFF', fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500 }}>Listo</button>
      </div>
    </div>
  );

  if (typeof document === 'undefined') return caja;
  return createPortal(
    hoja ? <>
      <div onMouseDown={onCerrar} style={{ position: 'fixed', inset: 0, zIndex: 79, background: 'rgba(0,0,0,0.28)' }} />
      {caja}
    </> : caja,
    document.body,
  );
}

// ─────────────────────────────────────────────────────────── botón de grupo
function BotonGrupo({ grupo, abierto, onAbrir }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const accent = theme.accent || '#007AFF';
  const n = cuentaSel(grupo.seleccion);
  const on = n > 0;
  return (
    <button type="button" data-filtros-boton={grupo.id} onClick={onAbrir}
      aria-expanded={abierto} aria-haspopup="dialog"
      title={on ? `${grupo.label}: ${n} marcada${n === 1 ? '' : 's'}` : `Filtrar por ${grupo.label.toLowerCase()}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 999, cursor: 'pointer',
        border: `1px solid ${on || abierto ? accent : theme.border}`,
        background: on ? (dark ? 'rgba(10,132,255,0.18)' : 'rgba(0,122,255,0.10)') : theme.surface,
        color: on ? accent : theme.text, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: on ? 600 : 500, whiteSpace: 'nowrap',
        transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}`,
      }}>
      {grupo.label}
      {on && (
        <span style={{ fontSize: 9.5, minWidth: 14, padding: '0 4px', borderRadius: 999, fontVariantNumeric: 'tabular-nums', fontWeight: 700, background: accent, color: '#FFF' }}>{n}</span>
      )}
      <ChevronDown size={12} style={{ opacity: 0.7, transform: abierto ? 'rotate(180deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />
    </button>
  );
}

function PillToggle({ t, onClick }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const accent = theme.accent || '#007AFF';
  const [bgTone, colTone] = toneColors(theme, t.tone || 'gray');
  const apagado = !t.on && t.n === 0;
  return (
    <button type="button" onClick={onClick} aria-pressed={!!t.on} disabled={apagado} title={t.title || t.label}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, height: 28, padding: '0 10px', borderRadius: 999, cursor: apagado ? 'not-allowed' : 'pointer',
        border: `1px solid ${t.on ? accent : theme.border}`,
        background: t.on ? (dark ? 'rgba(10,132,255,0.18)' : 'rgba(0,122,255,0.10)') : (t.tone ? bgTone : theme.surface),
        color: t.on ? accent : (t.tone ? colTone : theme.text), opacity: apagado ? 0.5 : 1,
        fontFamily: TYPO.fontText, fontSize: 12, fontWeight: t.on ? 600 : 500, whiteSpace: 'nowrap',
        transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}`,
      }}>
      {t.label}
      {t.n != null && <span style={{ fontSize: 9.5, color: t.on ? accent : theme.textMuted, fontVariantNumeric: 'tabular-nums', opacity: 0.85 }}>{fmt(t.n)}</span>}
    </button>
  );
}

function PillActiva({ label, tone, onQuitar }) {
  const { theme } = useTheme();
  const [bg, col] = toneColors(theme, tone || 'gray');
  return (
    <button type="button" onClick={onQuitar} title="Quitar este filtro"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: 220, height: 22, padding: '0 6px 0 9px', borderRadius: 999, cursor: 'pointer',
        border: `1px solid ${theme.border}`, background: bg, color: col,
        fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.01em',
      }}>
      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <X size={10} style={{ flexShrink: 0 }} />
    </button>
  );
}

// ─────────────────────────────────────────────────────────── componente
export default function Filtros({
  grupos = [], toggles = [], onToggle, onSolo, onToggleFlag, onLimpiar,
  activos = 0, resumen = null, acciones = null, buscador = null, style,
}) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(null);   // id del grupo abierto
  const [rect, setRect] = useState(null);
  const filaRef = useRef(null);

  // Los grupos aceptan `seleccion` (kit) o `sel` (nombre viejo de sellin/Filtros).
  const gs = useMemo(() => grupos.filter(Boolean).map((g) => ({ ...g, seleccion: g.seleccion !== undefined ? g.seleccion : g.sel })), [grupos]);
  const grupoAbierto = gs.find((g) => g.id === abierto) || null;

  const medir = useCallback(() => {
    if (!abierto || typeof document === 'undefined') return;
    const el = [...(filaRef.current?.querySelectorAll('[data-filtros-boton]') || [])].find((n) => n.dataset.filtrosBoton === String(abierto));
    if (el) setRect(el.getBoundingClientRect());
  }, [abierto]);

  useEffect(() => {
    if (!abierto) return undefined;
    window.addEventListener('scroll', medir, true);
    window.addEventListener('resize', medir);
    return () => { window.removeEventListener('scroll', medir, true); window.removeEventListener('resize', medir); };
  }, [abierto, medir]);

  // "Sólo éste" por defecto: desmarca lo demás del grupo y deja ésta.
  const soloDefault = useCallback((gid, oid) => {
    const g = gs.find((x) => x.id === gid);
    if (!g) return;
    const marcados = idsSel(g.seleccion);
    if (marcados.length === 1 && marcados[0] === oid) return;
    marcados.filter((id) => id !== oid).forEach((id) => onToggle?.(gid, id));
    if (!marcados.includes(oid)) onToggle?.(gid, oid);
  }, [gs, onToggle]);

  const activas = gs.flatMap((g) => idsSel(g.seleccion).map((id) => {
    const o = (g.opciones || []).find((x) => x.id === id);
    return { k: `${g.id}::${id}`, label: o ? (o.label ?? o.id) : id, tone: o?.tone, quitar: () => onToggle?.(g.id, id) };
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, fontFamily: TYPO.fontText, ...style }}>
      <div ref={filaRef} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        {buscador}
        {gs.map((g) => (
          <BotonGrupo key={g.id} grupo={g} abierto={abierto === g.id}
            onAbrir={(e) => { setRect(e.currentTarget.getBoundingClientRect()); setAbierto((a) => (a === g.id ? null : g.id)); }} />
        ))}
        {toggles.filter(Boolean).map((t) => <PillToggle key={t.id} t={t} onClick={() => onToggleFlag?.(t.id, !t.on)} />)}
        {activos > 0 && onLimpiar && (
          <button type="button" onClick={() => { setAbierto(null); onLimpiar(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 28, padding: '0 10px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 12 }}>
            <X size={11} /> Limpiar{activos > 1 ? ` · ${activos}` : ''}
          </button>
        )}
        {(resumen || acciones) && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 'auto', flexWrap: 'wrap', justifyContent: 'flex-end', minWidth: 0 }}>
            {resumen && <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>{resumen}</span>}
            {acciones}
          </span>
        )}
      </div>

      {activas.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
          {activas.map((a) => <PillActiva key={a.k} label={a.label} tone={a.tone} onQuitar={a.quitar} />)}
          {activas.length > 1 && onLimpiar && (
            <button type="button" onClick={() => { setAbierto(null); onLimpiar(); }}
              style={{ height: 22, padding: '0 9px', borderRadius: 999, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600 }}>Limpiar</button>
          )}
        </div>
      )}

      {grupoAbierto && (
        <PanelGrupo grupo={grupoAbierto} rect={rect} onCerrar={() => setAbierto(null)}
          onToggle={(gid, oid) => onToggle?.(gid, oid)}
          onSolo={onSolo || soloDefault} />
      )}
    </div>
  );
}
