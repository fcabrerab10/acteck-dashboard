// Agenda móvil · C "Tablero deslizable": Segmented Cliente · Persona · Categoría, UNA columna por pantalla con
// scroll horizontal (scroll-snap) y puntos indicadores; tarjetas = tareas, puntos, reuniones (botón Minuta) y avisos.
// Mantener presionada una tarjeta abre una hoja con "Mover a…", "Marcar hecha", "Posponer", "Abrir".
// Las columnas y el cambio al mover salen de calculo.js (columnasTablero · cambioAlSoltar), igual que en la web.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Clock, ExternalLink, ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { columnasTablero, cambioAlSoltar, MODOS_TABLERO, isoDia, sumarDias, vencido, cuando } from '../../../modules/agenda/calculo';
import { actualizarItem } from '../../../modules/agenda/datos';
import { Segmented, Pill, HojaM, toast } from '../../piezas';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { TarjetaItem, TarjetaAviso, TarjetaReunion, TagCliente, TagPersona, CatPill, useLongPress } from './comun';

const MODOS = MODOS_TABLERO.filter((m) => m.id !== 'estado');

export default function Tablero() {
  const { theme } = useTheme();
  const a = useAgenda();
  const { items, reuniones, avisos, personas, personasPorId, porId, hoy, puedeEditar, abrirItem, abrirMinuta, toggle, posponer, navegarAviso } = a;
  const [modo, setModo] = useState('cliente');
  const [idx, setIdx] = useState(0);
  const [sel, setSel] = useState(null); // { item, colId } → hoja de acciones
  const [moviendo, setMoviendo] = useState(false);
  const scroller = useRef(null);
  const hoyIso = isoDia(hoy);

  const tarjetas = useMemo(() => {
    const its = items.filter((i) => i.estado === 'abierta' || (i.estado === 'hecha' && i.completado_en && isoDia(new Date(i.completado_en)) === hoyIso)).map((i) => ({ ...i, clave: 'item' }));
    const reus = reuniones.filter((r) => r.estado !== 'cerrada' && new Date(r.fecha) >= sumarDias(hoy, -1)).map((r) => ({ clave: 'reunion', id: `r:${r.id}`, ref: r, cliente_key: r.cliente_key, fecha: isoDia(new Date(r.fecha)), responsables: [], categoria: null }));
    const avs = avisos.map((x) => ({ ...x, clave: 'sistema', responsables: [], categoria: null }));
    return [...its, ...reus, ...avs];
  }, [items, reuniones, avisos, hoy, hoyIso]);
  const columnas = useMemo(() => columnasTablero(tarjetas, modo, personas, hoy).filter((c) => !c.zona).map((c) => ({ ...c, tarjetas: [...c.tarjetas].sort(ordenTarjeta(hoy)) })), [tarjetas, modo, personas, hoy]);

  useEffect(() => { setIdx(0); scroller.current?.scrollTo({ left: 0 }); }, [modo]);
  const onScroll = () => { const el = scroller.current; if (!el) return; const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth)); if (i !== idx) setIdx(Math.max(0, Math.min(columnas.length - 1, i))); };
  const irA = (i) => { const el = scroller.current; if (!el) return; el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' }); };

  // ── Acciones de la hoja (mantener presionado) ──
  const it = sel ? items.find((x) => x.id === sel.item.id) : null;
  const mover = async (col) => {
    if (!it) return;
    const cambio = cambioAlSoltar(modo, col.id, { ...it, clave: 'item' });
    if (!cambio) return;
    if (modo === 'persona' && col.id !== '__sin__') cambio.responsables = [...new Set([...(it.responsables || []).filter((u) => u !== sel.colId), col.id])];
    try { await actualizarItem(it.id, cambio, { prevResponsables: it.responsables || [] }); toast.ok(`Movido a ${col.label}`); setSel(null); } catch (e) { toast.error(e.message); }
  };
  const hecha = async () => { if (!it) return; setSel(null); await toggle(it, it.estado !== 'hecha'); };
  const pos = async () => { if (!it) return; setSel(null); await posponer(it, 1); };
  const abrir = () => { if (!it) return; setSel(null); abrirItem(it); };

  const dark = theme.mode === 'dark';
  const accion = (Icon, label, onClick, color) => (
    <button type="button" onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 50, padding: '0 16px', border: 0, borderTop: `1px solid ${theme.border}`, background: 'transparent', color: color || theme.text, fontFamily: TYPO.fontText, fontSize: 16, textAlign: 'left', cursor: 'pointer' }}>
      <Icon size={18} style={{ color: color || theme.accent, flexShrink: 0 }} /><span style={{ flex: 1 }}>{label}</span><ChevronRight size={16} style={{ color: theme.textSubtle || theme.textMuted }} />
    </button>
  );
  const destinos = columnas.filter((c) => c.id !== sel?.colId);

  return (
    <>
      <div style={{ padding: '0 16px 10px' }}>
        <Segmented size="md" value={modo} onChange={setModo} options={MODOS} style={{ display: 'flex', width: '100%' }} />
      </div>
      <div ref={scroller} onScroll={onScroll} style={{ display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}>
        {columnas.map((col) => {
          const venc = col.tarjetas.filter((t) => t.clave === 'item' && vencido(t, hoy)).length;
          return (
            <div key={col.id} style={{ flex: '0 0 100%', width: '100%', scrollSnapAlign: 'start', boxSizing: 'border-box', padding: '0 16px' }}>
              <div style={{ background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(120,120,128,0.10)', borderRadius: 14, padding: 10, minHeight: 240 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px 8px' }}>
                  {modo === 'cliente' && col.id !== 'interno' && <TagCliente clienteKey={col.id} size="sm" />}
                  {modo === 'persona' && col.id !== '__sin__' && <TagPersona persona={personasPorId.get(col.id)} size="sm" />}
                  {modo === 'categoria' && col.id !== '__sin__' && <CatPill categoria={col.id} size="sm" />}
                  <b style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</b>
                  {venc > 0 && <Pill tone="red" size="xs">{venc} venc.</Pill>}
                  <span style={{ fontFamily: MONO, fontSize: 12, color: theme.textMuted }}>{col.tarjetas.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {col.tarjetas.map((t) => {
                    if (t.clave === 'reunion') return <TarjetaReunion key={t.id} reunion={t.ref} items={items} porId={porId} hoy={hoy} onMinuta={abrirMinuta} />;
                    if (t.clave === 'sistema') return <TarjetaAviso key={t.id} aviso={t} hoy={hoy} onNavegar={navegarAviso} />;
                    return <TarjetaLP key={t.id} t={t} colId={col.id} personasPorId={personasPorId} porId={porId} hoy={hoy} modo={modo} puedeEditar={puedeEditar} onToggle={toggle} onAbrir={abrirItem} onLong={(item) => setSel({ item, colId: col.id })} />;
                  })}
                  {!col.tarjetas.length && <div style={{ fontSize: 12.5, color: theme.textMuted, textAlign: 'center', padding: '28px 8px' }}>Nada aquí</div>}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, justifyContent: 'center', padding: '10px 0 74px' }}>
        {columnas.map((c, i) => <button key={c.id} type="button" aria-label={c.label} onClick={() => irA(i)} style={{ width: i === idx ? 18 : 7, height: 7, borderRadius: 999, border: 0, padding: 0, background: i === idx ? theme.text : theme.border, transition: `width ${DUR.state}ms ${EASE}, background ${DUR.state}ms ${EASE}`, cursor: 'pointer' }} />)}
      </div>
      <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, textAlign: 'center', marginTop: -66, paddingBottom: 66, fontFamily: TYPO.fontText }}>{columnas.length > 1 ? 'desliza entre columnas · ' : ''}{puedeEditar ? 'mantén presionada una tarjeta para moverla' : ''}</div>

      <HojaM abierto={!!sel && !!it} onClose={() => { setSel(null); setMoviendo(false); }} titulo={it?.titulo} sub={it ? [it.cliente_key ? `#${it.cliente_key}` : null, it.fecha_limite ? cuando(it.fecha_limite, hoy) : 'sin fecha'].filter(Boolean).join(' · ') : ''} alto="70vh">
        {it && !moviendo && (
          <div>
            {accion(ArrowRight, `Mover a otra ${modo === 'cliente' ? 'cliente' : modo === 'persona' ? 'persona' : 'categoría'}…`, () => setMoviendo(true))}
            {accion(Check, it.estado === 'hecha' ? 'Reabrir' : 'Marcar hecha', hecha, theme.green)}
            {accion(Clock, 'Posponer a mañana', pos, theme.orange)}
            {accion(ExternalLink, 'Abrir', abrir)}
          </div>
        )}
        {it && moviendo && (
          <div>
            <div style={{ padding: '4px 16px 8px', fontSize: 12.5, color: theme.textMuted }}>Elige la columna destino</div>
            {destinos.map((c) => accion(ArrowRight, c.label, () => mover(c)))}
            {!destinos.length && <div style={{ padding: '8px 16px', fontSize: 13, color: theme.textMuted }}>No hay otra columna.</div>}
          </div>
        )}
      </HojaM>
    </>
  );
}

function ordenTarjeta(hoy) {
  const peso = (t) => (t.clave === 'reunion' ? 0 : t.clave === 'item' && vencido(t, hoy) ? 1 : t.clave === 'item' && t.estado === 'abierta' ? 2 : t.clave === 'sistema' ? 3 : 4);
  return (x, y) => peso(x) - peso(y) || String(x.fecha_limite || x.fecha || '9999').localeCompare(String(y.fecha_limite || y.fecha || '9999'));
}

/** Tarjeta de ítem con mantener-presionado (abre la hoja de acciones) y tocar (abre el ítem). */
function TarjetaLP({ t, personasPorId, porId, hoy, modo, puedeEditar, onToggle, onAbrir, onLong }) {
  const gestos = useLongPress(puedeEditar ? () => onLong(t) : null, { onTap: () => onAbrir(t) });
  return (
    <div style={{ WebkitTouchCallout: 'none', userSelect: 'none' }}>
      <TarjetaItem item={t} personasPorId={personasPorId} porId={porId} hoy={hoy} onToggle={puedeEditar ? onToggle : undefined} onAbrir={onAbrir} gestos={gestos} compacta
        mostrarCliente={modo !== 'cliente'} mostrarPersonas={modo !== 'persona'} />
    </div>
  );
}
