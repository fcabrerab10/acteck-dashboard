// Inicio del celular en tarjetas (2026-11-18 · congruencia con la web, `general/inicio/InicioTarjetas.jsx`).
// Mismo catálogo y mismo orden guardado (`preferencias.inicio.tarjetas`, módulo compartido `general/inicio/tarjetas.js`):
// lo que se acomoda aquí se ve igual al abrir el plegable. Rejilla de 2 columnas (chica 1×1 · mediana 2×1 · grande 2×2).
// Editar estilo iPhone: mantener presionada una tarjeta (o «Editar») → tiemblan; se arrastran con el dedo (pointer
// events), «−» quita, «Agregar» abre la hoja con el catálogo, «Restablecer» vuelve al orden de fábrica, «Listo» termina.
// Este archivo se carga con lazy() sólo en modo tarjetas: no pesa en el Inicio de siempre.
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { elevation } from '../../../lib/elevation';
import { usePreferencias } from '../../../lib/preferencias';
import { Pill } from '../../../components/kit';
import Trazo from '../../../components/kit/Trazo';
import { catalogo, idsVisibles, tarjetasFuera, moverTarjeta } from '../../../modules/general/inicio/tarjetas';
import { HojaM, ListaAgrupada, Fila, BotonGrande, Vacio } from '../../piezas';

const TAM_TXT = { g: 'grande', m: 'mediana', c: 'chica' };

/** Botón de cabecera (44 px de alto táctil). */
function BotonCab({ children, primario, onClick, icon: Icon }) {
  const { theme } = useTheme();
  return (
    <button type="button" onClick={onClick} style={{ minHeight: 44, padding: '0 14px', borderRadius: 999, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', whiteSpace: 'nowrap' }}>
      {Icon && <Icon size={15} strokeWidth={2.4} />}{children}
    </button>
  );
}

/** Una tarjeta del catálogo. Presentación pura. */
function Tarjeta({ t, n, editando, mio, transform, refEl, onBajar, onTocar, onQuitar }) {
  const { theme } = useTheme();
  const inv = t.inversa;
  const fg = inv ? (theme.textOnInverse || '#F5F5F7') : theme.text;
  const mut = inv ? (theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.66)') : theme.textMuted;
  const bg = inv ? (theme.surfaceInverse || '#000') : theme.surface;
  return (
    <div ref={refEl} role={t.pagina && !editando ? 'button' : undefined} data-tarjeta={t.id} className={editando && !mio ? 'tarjeta-tiembla' : undefined}
      onPointerDown={onBajar} onContextMenu={(e) => e.preventDefault()} onClick={onTocar}
      style={{
        gridColumn: t.tam === 'c' ? 'span 1' : 'span 2', gridRow: t.tam === 'g' ? 'span 2' : 'span 1', minWidth: 0, position: 'relative',
        backgroundColor: bg, backgroundImage: inv ? `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${bg} 86%, #8A90A8), ${bg} 62%)` : 'none', color: fg,
        border: inv ? 0 : `1px solid ${theme.border}`, borderRadius: 18, padding: 14, boxShadow: mio ? elevation(theme, 'flotante') : elevation(theme, 'tarjeta'),
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, cursor: t.pagina && !editando ? 'pointer' : 'default',
        userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: editando ? 'none' : 'manipulation', fontFamily: TYPO.fontText,
        transform, zIndex: mio ? 5 : 1, opacity: mio ? 0.96 : 1,
        animation: editando && !mio ? `tarjetaTiembla ${0.26 + (n % 3) * 0.03}s ease-in-out ${(n % 4) * -0.07}s infinite` : 'none',
        transition: 'box-shadow 160ms, opacity 160ms',
      }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{t.eyebrow}</span>
        {!editando && t.pill && t.tam !== 'c' && <Pill tone={t.pill.tone} size="xs">{t.pill.l}</Pill>}
      </div>
      {t.lista ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {!t.lista.length && <span style={{ fontSize: 13, color: mut }}>{t.vacio}</span>}
          {t.lista.map((x, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, minWidth: 0 }}>
              <Pill tone={x.tone} dot size="xs">{x.d || ' '}</Pill><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>{x.t}</span>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontRounded, fontSize: t.tam === 'g' ? 46 : 23, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.big}</div>
          {/* En la tarjeta chica la pastilla baja a su propio renglón: arriba no cabe junto al título a 2 columnas. */}
          {!editando && t.pill && t.tam === 'c' && <div style={{ marginTop: 6 }}><Pill tone={t.pill.tone} size="xs">{t.pill.l}</Pill></div>}
          {t.sub && <div style={{ fontSize: 11.5, color: mut, marginTop: 5, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{t.sub}</div>}
          {t.trazo && <Trazo puntos={t.trazo} h={t.trazoAlto || 22} style={{ marginTop: 6 }} />}
          {t.progreso != null && <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(127,127,140,0.3)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, Math.max(0, t.progreso))}%`, borderRadius: 999, background: t.progreso >= 100 ? theme.green : t.progreso >= 85 ? theme.accent : t.progreso >= 60 ? theme.orange : theme.red }} /></div>}
        </div>
      )}
      {editando && !mio && (
        // El círculo mide 28 px pero el área que recibe el dedo es de 44 × 44.
        <button type="button" aria-label={`Quitar ${t.label}`} onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); onQuitar?.(t.id); }}
          style={{ position: 'absolute', top: -14, left: -14, width: 44, height: 44, border: 0, background: 'transparent', padding: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <span style={{ width: 28, height: 28, borderRadius: 999, border: `1px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: theme.mode === 'dark' ? '#3A3A3C' : '#E5E5EA', color: theme.text, boxShadow: elevation(theme, 'hover') }}><Minus size={16} strokeWidth={2.6} /></span>
        </button>
      )}
    </div>
  );
}

/** Vista pura (SSR): cabecera de acciones + rejilla de 2 columnas. Los manejadores de puntero llegan de fuera. */
export function TarjetasVista({ visibles = [], fuera = [], editando = false, hayGuardadas = false, arrastre = null, transformDe, refDe, refRejilla,
  onBajar, onMover, onSoltar, onTocar, onQuitar, onEditar, onListo, onAgregar, onRestablecer, onVerPagina }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '0 16px', fontFamily: TYPO.fontText }}>
      <style>{'@keyframes tarjetaTiembla{0%{transform:rotate(-0.7deg)}50%{transform:rotate(0.7deg)}100%{transform:rotate(-0.7deg)}}@media (prefers-reduced-motion: reduce){.tarjeta-tiembla{animation:none!important}}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
        <span style={{ fontSize: 12, color: theme.textMuted, minWidth: 0, flex: '1 1 120px' }}>{editando ? 'Arrastra para acomodar · «−» quita' : 'Mantén presionada una tarjeta para acomodarlas'}</span>
        <span style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {editando && fuera.length > 0 && <BotonCab icon={Plus} onClick={onAgregar}>Agregar</BotonCab>}
          {editando && hayGuardadas && <BotonCab onClick={onRestablecer}>Restablecer</BotonCab>}
          {!editando && <BotonCab onClick={onVerPagina}>Ver página</BotonCab>}
          <BotonCab primario={editando} onClick={editando ? onListo : onEditar}>{editando ? 'Listo' : 'Editar'}</BotonCab>
        </span>
      </div>
      {visibles.length === 0
        ? <Vacio icon={null} titulo="Sin tarjetas" sub="Toca «Editar» y después «Agregar» para elegir las tuyas." style={{ padding: '26px 8px' }} />
        : (
          <div ref={refRejilla} data-entrada-kpis onPointerMove={onMover} onPointerUp={onSoltar} onPointerCancel={onSoltar}
            style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: 'minmax(112px, auto)', gridAutoFlow: 'dense', gap: 10 }}>
            {visibles.map((t, n) => (
              <Tarjeta key={t.id} t={t} n={n} editando={editando} mio={arrastre?.id === t.id} transform={transformDe?.(t.id)} refEl={refDe?.(t.id)}
                onBajar={(e) => onBajar?.(e, t.id)} onTocar={() => onTocar?.(t)} onQuitar={onQuitar} />
            ))}
          </div>
        )}
    </div>
  );
}

/** Hoja «Agregar tarjeta»: el catálogo que no está en pantalla. Vista pura. */
export function CatalogoVista({ fuera = [], onAgregar }) {
  const { theme } = useTheme();
  if (!fuera.length) return <Vacio icon={null} titulo="Ya están todas" sub="No queda ninguna tarjeta por agregar." style={{ padding: '22px 12px' }} />;
  return (
    <ListaAgrupada titulo="Tarjetas disponibles" meta={`${fuera.length}`} style={{ marginTop: 4 }} pie="Se agregan al final; después arrástralas a su lugar.">
      {fuera.map((t) => (
        <Fila key={t.id} alto={56} chevron={false} titulo={t.label} sub={`${TAM_TXT[t.tam] || ''}${t.big && !t.lista ? ` · hoy ${t.big}` : ''}`}
          valor={<span style={{ width: 30, height: 30, borderRadius: 999, background: theme.accent, color: '#fff', display: 'inline-grid', placeItems: 'center' }}><Plus size={17} strokeWidth={2.6} /></span>}
          onClick={() => onAgregar?.(t.id)} />
      ))}
    </ListaAgrupada>
  );
}

export default function InicioTarjetasM({ r, ve, anio, labelPeriodo, onNavegar, onVerPagina }) {
  const { prefs, setPreferencia } = usePreferencias();
  const [editando, setEditando] = useState(false);
  const [orden, setOrden] = useState(null);       // orden local mientras se arrastra
  const [arrastre, setArrastre] = useState(null); // { id, x, y, gx, gy }
  const [hoja, setHoja] = useState(false);
  const rejilla = useRef(null), elems = useRef({}), pulso = useRef({ t: null, x: 0, y: 0 }), ultimoCambio = useRef(0), seMovio = useRef(false);
  const todas = catalogo({ r, ve, anio, labelPeriodo });
  const guardadas = Array.isArray(prefs?.inicio?.tarjetas) ? prefs.inicio.tarjetas : null;
  const ids = idsVisibles(todas, guardadas, orden);
  const visibles = ids.map((id) => todas.find((t) => t.id === id));
  const fuera = tarjetasFuera(todas, ids);
  const guardar = (lista) => { setOrden(null); setPreferencia('inicio.tarjetas', lista); };
  const soltarPulso = () => { clearTimeout(pulso.current.t); pulso.current.t = null; };

  const alBajar = (e, id) => {
    seMovio.current = false;
    if (editando) {
      const el = elems.current[id]; if (!el) return;
      const rc = el.getBoundingClientRect();
      rejilla.current?.setPointerCapture?.(e.pointerId); // el dedo sigue mandando aunque salga de la tarjeta
      setOrden(ids);
      setArrastre({ id, x: e.clientX, y: e.clientY, gx: e.clientX - rc.left, gy: e.clientY - rc.top });
      return;
    }
    soltarPulso();
    pulso.current = { x: e.clientX, y: e.clientY, t: setTimeout(() => { seMovio.current = true; pulso.current.t = null; setEditando(true); try { navigator.vibrate?.(8); } catch { /* sin vibración */ } }, 450) };
  };
  const alMover = (e) => {
    if (!arrastre) { if (pulso.current.t && Math.hypot(e.clientX - pulso.current.x, e.clientY - pulso.current.y) > 8) soltarPulso(); return; }
    seMovio.current = true;
    setArrastre((a) => (a ? { ...a, x: e.clientX, y: e.clientY } : a));
    const ahora = Date.now();
    if (ahora - ultimoCambio.current < 160) return;
    for (const id of ids) {
      if (id === arrastre.id) continue;
      const rc = elems.current[id]?.getBoundingClientRect(); if (!rc) continue;
      if (e.clientX > rc.left + rc.width * 0.2 && e.clientX < rc.right - rc.width * 0.2 && e.clientY > rc.top + rc.height * 0.2 && e.clientY < rc.bottom - rc.height * 0.2) {
        ultimoCambio.current = ahora; setOrden(moverTarjeta(ids, arrastre.id, id)); break;
      }
    }
  };
  const alSoltar = () => {
    soltarPulso();
    if (arrastre) { setArrastre(null); if (orden) guardar(orden); }
  };
  useEffect(() => () => clearTimeout(pulso.current.t), []);
  // Si el dedo empieza a desplazar la página, el toque largo se cancela (el navegador manda pointercancel).
  const transformDe = (id) => {
    if (arrastre?.id !== id) return undefined;
    const el = elems.current[id], g = rejilla.current?.getBoundingClientRect();
    if (!el || !g) return undefined;
    return `translate(${arrastre.x - (g.left + el.offsetLeft) - arrastre.gx}px, ${arrastre.y - (g.top + el.offsetTop) - arrastre.gy}px) scale(1.04)`;
  };

  return (
    <>
      <TarjetasVista visibles={visibles} fuera={fuera} editando={editando} hayGuardadas={!!guardadas} arrastre={arrastre}
        transformDe={transformDe} refDe={(id) => (el) => { elems.current[id] = el; }} refRejilla={rejilla}
        onBajar={alBajar} onMover={alMover} onSoltar={alSoltar}
        onTocar={(t) => { if (!editando && !seMovio.current && t.pagina) onNavegar?.(t.pagina); }}
        onQuitar={(id) => guardar(ids.filter((x) => x !== id))}
        onEditar={() => setEditando(true)} onListo={() => { setEditando(false); setArrastre(null); setOrden(null); }}
        onAgregar={() => setHoja(true)} onRestablecer={() => guardar(null)} onVerPagina={onVerPagina} />
      <HojaM abierto={hoja} onClose={() => setHoja(false)} titulo="Agregar tarjeta" sub="Las mismas del Inicio en la computadora" alto="70vh">
        <CatalogoVista fuera={fuera} onAgregar={(id) => { guardar([...ids, id]); if (fuera.length <= 1) setHoja(false); }} />
        <div style={{ padding: '12px 16px 18px' }}><BotonGrande onClick={() => setHoja(false)}>Listo</BotonGrande></div>
      </HojaM>
    </>
  );
}
