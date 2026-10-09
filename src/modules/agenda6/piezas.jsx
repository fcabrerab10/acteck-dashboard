// Agenda «que te lleva» (V6 · 2026-10-08) · piezas web compartidas: fila rápida con acciones al pasar el mouse (y teclado),
// avatares para «Mandar a», chips confirmables de la captura libre, lista de «Movidas hoy» con Deshacer.
import React, { useEffect, useMemo, useState } from 'react';
import { Clock, Undo2, Send } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Pill } from '../../components/kit';
import { Avatar, Palomita } from '../agenda5/comun';
import { nombreClienteAgenda, asignables } from '../agenda5/base/etiquetas';
import { fmtMin } from '../agenda5/calculo';
import { accionItem, deshacerMovida } from './datos';
import { LABEL_MOVIDA } from './calculo';

export const TONO_CHIP = { fecha: ['rgba(10,132,255,0.14)', '#0A84FF'], hora: ['rgba(10,132,255,0.14)', '#0A84FF'], duracion: ['rgba(10,132,255,0.14)', '#0A84FF'], cliente: ['rgba(255,159,10,0.16)', '#C77700'], persona: ['rgba(191,90,242,0.16)', '#9D4EDD'], prioridad: ['rgba(255,69,58,0.14)', '#D7261E'], tipo: ['rgba(48,209,88,0.16)', '#1F8F3A'], categoria: ['rgba(120,120,128,0.16)', '#6E6E73'] };
export const primerNombre = (p) => String(p?.nombre || p?.email || '').split(' ')[0];
export const fechaCorta = (iso) => { if (!iso) return ''; const d = new Date(`${iso}T12:00:00`); return `${d.getDate()} ${['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'][d.getMonth()]}`; };

/** Botón chico y plano de acción rápida. */
export function Accion({ children, onClick, tone, title, style }) {
  const { theme } = useTheme();
  const col = tone === 'red' ? theme.red : tone === 'blue' ? theme.accent : theme.textMuted;
  return (
    <button type="button" title={title} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      style={{ border: `1px solid ${theme.border}`, background: theme.surface, color: col, borderRadius: 999, padding: '3px 9px', fontSize: 11, fontWeight: 600, fontFamily: TYPO.fontDisplay, cursor: 'pointer', whiteSpace: 'nowrap', lineHeight: 1.4, ...style }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(120,120,128,0.12)'; }} onMouseLeave={(e) => { e.currentTarget.style.background = theme.surface; }}>
      {children}
    </button>
  );
}

/**
 * Fila rápida: palomita · título · cliente · persona · hora/fecha. Al pasar el mouse (o con la fila elegida por teclado)
 * salen Hoy · Mañana · Semana · Ya no · Mandar. Cada acción es optimista y deja «Deshacer» en el toast.
 */
export function FilaRapida({ item, uid, personasPorId, personas = [], hoyIso, puedeEditar, onAbrir, seleccionada = false, mostrarFecha = false, acciones = ['hoy', 'manana', 'semana', 'yano', 'mandar'], extra = null, compacta = false }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [mandar, setMandar] = useState(false);
  const hecha = item.estado === 'hecha';
  const otros = (item.responsables || []).filter((u) => u !== uid).map((u) => personasPorId?.get(u)).filter(Boolean);
  const fecha = item.cuando || item.fecha_limite || null;
  const vencida = !hecha && fecha && hoyIso && fecha < hoyIso;
  const act = (a, extraOpts) => accionItem(item, a, { hoyIso, ...(extraOpts || {}) }).catch(() => {});
  const visibles = (hover || seleccionada) && puedeEditar && !hecha;
  const puedeHoy = acciones.includes('hoy') && item.cuando !== hoyIso;
  return (
    <div onClick={() => onAbrir?.(item)} onMouseEnter={() => setHover(true)} onMouseLeave={() => { setHover(false); setMandar(false); }} data-fila-rapida={item.id}
      style={{ display: 'flex', alignItems: 'center', gap: 10, padding: compacta ? '5px 8px' : '7px 10px', borderRadius: 11, cursor: 'pointer', minHeight: compacta ? 34 : 40, position: 'relative',
        background: seleccionada ? `${theme.accent}14` : hover ? (theme.surfaceHover || 'rgba(120,120,128,0.10)') : 'transparent', outline: seleccionada ? `1.5px solid ${theme.accent}` : 'none', outlineOffset: -1,
        transition: `background ${DUR.state}ms ${EASE}`, opacity: hecha ? 0.6 : 1 }}>
      <Palomita hecha={hecha} size={compacta ? 18 : 20} onClick={() => { if (!puedeEditar) return; act(hecha ? 'reabrir' : 'hecha'); }} />
      <span style={{ flex: 1, minWidth: 0, fontSize: compacta ? 13 : 13.5, color: theme.text, textDecoration: hecha ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.titulo}</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 11, color: theme.textMuted }}>
        {extra}
        {!visibles && item.cliente_key && item.cliente_key !== 'interno' && <Pill size="xs" tone="orange">{nombreClienteAgenda(item.cliente_key)}</Pill>}
        {!visibles && (item.clientes || []).map((c) => <Pill key={c} size="xs" tone="orange">{nombreClienteAgenda(c)}</Pill>)}
        {!visibles && item.prioridad === 'alta' && !hecha && <Pill size="xs" tone="red">!</Pill>}
        {!visibles && otros.map((p) => <span key={p.user_id} title={p.nombre} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><Send size={10} /><Avatar persona={p} size={18} /></span>)}
        {!visibles && mostrarFecha && fecha && <span style={{ color: vencida ? theme.red : theme.textMuted, fontWeight: vencida ? 600 : 400 }}>{vencida ? 'venció ' : ''}{fechaCorta(fecha)}</span>}
        {!visibles && !mostrarFecha && item.hora && <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{item.hora}</span>}
        {!visibles && item.duracion_min ? <span title="estimado"><Clock size={10} style={{ verticalAlign: -1 }} /> {fmtMin(item.duracion_min)}</span> : null}
        {visibles && !mandar && <>
          {puedeHoy && <Accion tone="blue" onClick={() => act('hoy')} title="H">Hoy</Accion>}
          {acciones.includes('manana') && <Accion onClick={() => act('manana')} title="M">Mañana</Accion>}
          {acciones.includes('semana') && <Accion onClick={() => act('semana')}>Semana</Accion>}
          {acciones.includes('yano') && <Accion tone="red" onClick={() => act('yano')}>Ya no</Accion>}
          {acciones.includes('mandar') && personas.length > 1 && <Accion onClick={() => setMandar(true)}>Mandar…</Accion>}
        </>}
        {visibles && mandar && <AvataresMandar personas={personas} uid={uid} valor={item.responsables || []} compacto onChange={(resp) => { setMandar(false); act('mandar', { responsables: resp }); }} />}
      </span>
    </div>
  );
}

/** Avatares del equipo para «Mandar a»: varios a la vez; `valor` = user_ids. En compacto confirma al tocar uno. */
export function AvataresMandar({ personas = [], uid, valor = [], onChange, compacto = false, size = 28 }) {
  const { theme } = useTheme();
  const lista = useMemo(() => asignables(personas).filter((p) => p.user_id !== uid), [personas, uid]);
  const [sel, setSel] = useState(valor.filter((u) => u !== uid));
  const firma = valor.filter((u) => u !== uid).sort().join(',');
  useEffect(() => { setSel(firma ? firma.split(',') : []); }, [firma]); // sigue lo que entendió la captura
  const toggle = (u) => {
    const n = sel.includes(u) ? sel.filter((x) => x !== u) : [...sel, u];
    setSel(n);
    if (compacto) onChange?.(n.length ? n : [uid]);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }} onClick={(e) => e.stopPropagation()}>
      {lista.map((p) => { const on = sel.includes(p.user_id); return (
        <button key={p.user_id} type="button" title={p.nombre} onClick={() => toggle(p.user_id)} aria-pressed={on}
          style={{ border: `2px solid ${on ? theme.accent : 'transparent'}`, borderRadius: 999, padding: 1, background: on ? `${theme.accent}1a` : 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, paddingRight: compacto ? 1 : 8, transition: `all ${DUR.tap}ms ${EASE}` }}>
          <Avatar persona={p} size={size} />{!compacto && <span style={{ fontSize: 12, fontWeight: on ? 700 : 500, color: on ? theme.accent : theme.text }}>{primerNombre(p)}</span>}
        </button>); })}
      {!compacto && onChange && <Accion tone="blue" onClick={() => onChange(sel.length ? sel : [uid])}>Listo</Accion>}
    </span>
  );
}

/** Chips que entendió la captura; cada uno se puede quitar con ×. */
export function ChipsInterp({ chips = [], quitados = new Set(), onQuitar, size = 11.5 }) {
  const { theme } = useTheme();
  return (
    <>
      {chips.filter((c) => !quitados.has(`${c.tipo}:${c.valor ?? c.label}`)).map((c, k) => { const [bg, col] = TONO_CHIP[c.tipo] || TONO_CHIP.categoria; return (
        <span key={`${c.tipo}-${k}`} style={{ background: bg, color: col, borderRadius: 999, padding: '3px 4px 3px 9px', fontSize: size, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, animation: `capIn 180ms ${EASE} both` }}>
          {c.label}
          {onQuitar && <button type="button" aria-label={`Quitar ${c.label}`} onClick={() => onQuitar(c)} style={{ border: 0, background: 'transparent', color: 'inherit', width: 16, height: 16, borderRadius: 8, display: 'grid', placeItems: 'center', cursor: 'pointer', fontSize: 12, lineHeight: 1, padding: 0 }}>×</button>}
        </span>); })}
      <style>{`@keyframes capIn { from { opacity: 0; transform: translateY(-4px) scale(0.97) } to { opacity: 1; transform: none } }`}</style>
      {chips.length === 0 && <span style={{ fontSize: 12, color: theme.textMuted }}>Sin fecha ni persona: queda para hoy, tuya.</span>}
    </>
  );
}

/** «Movidas hoy»: bitácora del día con Deshacer. */
export function MovidasHoy({ movidas = [], compacta = false }) {
  const { theme } = useTheme();
  if (!movidas.length) return null;
  const hora = (ts) => { const d = new Date(ts); return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`; };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {movidas.slice(0, compacta ? 8 : 30).map((m) => (
        <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: theme.textMuted, padding: '4px 6px', borderRadius: 8, opacity: m.deshecha_at ? 0.5 : 1 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', width: 38, flexShrink: 0 }}>{hora(m.created_at)}</span>
          <span style={{ color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{m.titulo || '(sin título)'}</span>
          <Pill size="xs" tone={m.accion === 'hecha' ? 'green' : m.accion === 'yano' ? 'red' : m.accion === 'mandar' ? 'purple' : 'gray'}>{m.deshecha_at ? 'deshecha' : LABEL_MOVIDA[m.accion] || m.accion}</Pill>
          {!m.deshecha_at && m.antes && <button type="button" onClick={() => deshacerMovida(m).catch(() => {})} title="Deshacer" style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: theme.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, padding: '2px 6px' }}><Undo2 size={12} />Deshacer</button>}
        </div>
      ))}
    </div>
  );
}

/** Tarjeta inversa (negra en claro, clara en oscuro) para lo importante: Ahora, Organiza, Cierra. */
export function TarjetaInversa({ children, eyebrow, style, onClick }) {
  const { theme } = useTheme();
  return (
    <div onClick={onClick} style={{ background: theme.surfaceInverse || theme.text, color: theme.textOnInverse || theme.bg, borderRadius: 14, padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 8, fontFamily: TYPO.fontText, cursor: onClick ? 'pointer' : 'default', ...style }}>
      {eyebrow && <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', opacity: 0.6 }}>{eyebrow}</span>}
      {children}
    </div>
  );
}
export function BotonInv({ children, onClick, primario = false, disabled = false, style }) {
  const { theme } = useTheme();
  return <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick?.(); }} style={{ border: 0, borderRadius: 999, padding: '7px 14px', background: primario ? (theme.bg || '#fff') : `${theme.bg}26`, color: primario ? (theme.text || '#000') : 'inherit', fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 700, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }}>{children}</button>;
}
