// Agenda · piezas compartidas por Bandeja y Tablero (sólo kit + theme.*).
// TagCliente · TagPersona · CatPill · FuenteLabel · Palomita · FilaItem · FilaAviso · Filtros · CampoEtiquetas
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, ChevronRight, ExternalLink } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, toneColors, Boton, EASE, DUR } from '../../components/kit';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { CATEGORIAS, CATEGORIA_LABEL, CATEGORIA_TONE, nombreClienteAgenda, tokenActivo, sugerencias, aplicarSugerencia } from './etiquetas';
import { cuando, vencido, vecesArrastrado, ordinal, conteos } from './calculo';

export const TONE_CLIENTE = { digitalife: 'red', pcel: 'orange', dicotech: 'blue', interno: 'gray', mercadolibre: 'yellow' };
export const TONE_FUENTE = { Alertas: 'red', Tracking: 'purple', Importador: 'orange', Calendario: 'gray', Google: 'blue' };
export const mono = (theme) => ({ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' });
export const iniciales = (n) => String(n || '?').trim().split(/\s+/).map((p) => p[0] || '').slice(0, 2).join('').toUpperCase() || '?';

export function TagCliente({ clienteKey, onClick, size = 'xs' }) {
  if (!clienteKey) return null;
  return <Pill tone={TONE_CLIENTE[clienteKey] || 'gray'} size={size} onClick={onClick} title={nombreClienteAgenda(clienteKey)} style={{ fontFamily: TYPO.fontDisplay }}>#{clienteKey}</Pill>;
}
export function TagPersona({ persona, onClick, size = 'xs' }) {
  if (!persona) return null;
  return <Pill tone="blue" size={size} onClick={onClick} title={persona.nombre}>@{persona.handle || (persona.nombre || '').split(' ')[0].toLowerCase()}</Pill>;
}
export function CatPill({ categoria, size = 'xs', onClick }) {
  if (!categoria) return null;
  return <Pill tone={CATEGORIA_TONE[categoria] || 'gray'} size={size} onClick={onClick}>{CATEGORIA_LABEL[categoria] || categoria}</Pill>;
}
export function FuenteLabel({ fuente }) {
  const { theme } = useTheme();
  return <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600 }}>{fuente}</span>;
}
export function Avatar({ persona, size = 22 }) {
  const { theme } = useTheme();
  return persona?.avatar_url
    ? <img src={persona.avatar_url} alt="" width={size} height={size} style={{ width: size, height: size, borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
    : <span title={persona?.nombre} style={{ width: size, height: size, borderRadius: 999, background: theme.surfaceInverse || '#000', color: theme.textOnInverse || '#F5F5F7', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontSize: Math.round(size * 0.4), fontWeight: 600, flexShrink: 0 }}>{iniciales(persona?.nombre)}</span>;
}

/** Palomita circular (14 px) · hecha = verde. */
export function Palomita({ hecha, onClick, title, size = 15, disabled }) {
  const { theme } = useTheme();
  const green = theme.green || '#34C759';
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); if (!disabled) onClick?.(); }} title={title || (hecha ? 'Reabrir' : 'Marcar como hecha')} aria-pressed={hecha} disabled={disabled}
      style={{ width: size, height: size, borderRadius: 999, flexShrink: 0, padding: 0, cursor: disabled ? 'default' : 'pointer', border: `1.5px solid ${hecha ? green : theme.borderStrong || theme.border}`, background: hecha ? green : 'transparent', color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: `background ${DUR.tap}ms ${EASE}, border-color ${DUR.tap}ms ${EASE}` }}>
      {hecha && <svg width={size - 6} height={size - 6} viewBox="0 0 10 10" fill="none"><path d="M2 5.2 4.2 7.4 8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>}
    </button>
  );
}

const fila = (theme) => ({ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '7px 12px', borderBottom: `1px solid ${theme.border}`, fontFamily: TYPO.fontText, cursor: 'pointer', transition: `background ${DUR.state}ms ${EASE}` });

/** Fila de tarea / punto en la bandeja. */
export function FilaItem({ item, personasPorId, porId, hoy, onToggle, onAbrir, onFiltrarPersona, onFiltrarCliente, compacta = false, reunion }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const hecha = item.estado === 'hecha';
  const venc = vencido(item, hoy);
  const n = vecesArrastrado(item, porId);
  const w = cuando(item.fecha_limite, hoy);
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={() => onAbrir?.(item)} style={{ ...fila(theme), background: hover ? (theme.surfaceHover || 'rgba(0,0,0,0.02)') : 'transparent', opacity: hecha ? 0.6 : 1 }}>
      <div style={{ paddingTop: 2 }}><Palomita hecha={hecha} onClick={() => onToggle?.(item, !hecha)} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compacta ? 12 : 12.5, fontWeight: 500, color: theme.text, textDecoration: hecha ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compacta ? 'nowrap' : 'normal' }}>{item.titulo}</div>
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 3, fontSize: 10.5, color: theme.textMuted }}>
          {item.tipo === 'punto' && <Pill tone="gray" size="xs">punto</Pill>}
          <TagCliente clienteKey={item.cliente_key} onClick={onFiltrarCliente ? (e) => { e.stopPropagation(); onFiltrarCliente(item.cliente_key); } : undefined} />
          {(item.responsables || []).map((u) => <TagPersona key={u} persona={personasPorId?.get(u)} onClick={onFiltrarPersona ? (e) => { e.stopPropagation(); onFiltrarPersona(u); } : undefined} />)}
          <CatPill categoria={item.categoria} />
          {item.prioridad === 'alta' && !hecha && <Pill tone="red" size="xs" dot>alta</Pill>}
          {n > 0 && <Pill tone="orange" size="xs" title="Veces que se ha arrastrado de reunión en reunión">{ordinal(n)}</Pill>}
          {reunion && <span>de la reunión del {cuando(reunion.fecha?.slice?.(0, 10), hoy)}</span>}
          {!compacta && item.notas && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>{String(item.notas).split('\n')[0]}</span>}
        </div>
      </div>
      <span style={{ ...mono(theme), fontSize: 10.5, color: venc ? (theme.red || '#FF3B30') : theme.textMuted, whiteSpace: 'nowrap', paddingTop: 2, fontWeight: venc ? 600 : 400 }}>{item.hora && w === 'hoy' ? String(item.hora).slice(0, 5) : w}</span>
    </div>
  );
}

/** Fila de aviso del sistema (sólo lectura, con botón de acción). */
export function FilaAviso({ aviso, onNavegar, compacta = false, hoy }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const sev = aviso.severidad === 'critica' ? 'red' : aviso.severidad === 'alta' ? 'orange' : null;
  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...fila(theme), cursor: 'default', background: hover ? (theme.surfaceHover || 'rgba(0,0,0,0.02)') : 'transparent' }}>
      <span style={{ width: 15, height: 15, borderRadius: 4, marginTop: 2, flexShrink: 0, background: toneColors(theme, TONE_FUENTE[aviso.fuente] || 'gray')[0], display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ width: 5, height: 5, borderRadius: 999, background: toneColors(theme, TONE_FUENTE[aviso.fuente] || 'gray')[1] }} /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: compacta ? 12 : 12.5, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: compacta ? 'nowrap' : 'normal' }}>{aviso.titulo}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 3, fontSize: 10.5, color: theme.textMuted }}>
          <FuenteLabel fuente={aviso.fuente} />
          <TagCliente clienteKey={aviso.cliente_key} />
          {sev && <Pill tone={sev} size="xs" dot>{aviso.severidad}</Pill>}
          {!compacta && aviso.sub && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 300 }}>{aviso.sub}</span>}
          {aviso.accion && onNavegar && <Boton size="sm" onClick={() => onNavegar(aviso.accion.clienteKey ?? null, aviso.accion.pagina, { aviso })} style={{ height: 20, padding: '0 8px', fontSize: 10.5 }}>{aviso.accion.label}<ChevronRight size={11} /></Boton>}
        </div>
      </div>
      <span style={{ ...mono(theme), fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', paddingTop: 2 }}>{cuando(aviso.fecha, hoy)}</span>
    </div>
  );
}

/** Encabezado de sección dentro de un Panel ("VENCIDAS · 2"). */
export function Seccion({ children, n, tone }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px 4px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, letterSpacing: '0.08em', textTransform: 'uppercase', color: tone ? toneColors(theme, tone)[1] : theme.textMuted, fontWeight: 600 }}>
      {children}{n != null && <span style={{ ...mono(theme), fontWeight: 500 }}>· {n}</span>}
    </div>
  );
}

export function Vacio({ children }) {
  const { theme } = useTheme();
  return <div style={{ padding: '18px 12px', fontSize: 12, color: theme.textMuted, textAlign: 'center' }}>{children}</div>;
}

/** Buscador + pills con conteo (persona · cliente · categoría · vencidas). filtros = FILTROS_VACIOS() con Sets. */
export function Filtros({ items, personas, filtros, onChange, hoy, extra }) {
  const { theme } = useTheme();
  const c = useMemo(() => conteos(items, hoy), [items, hoy]);
  const toggle = (set, v) => { const s = new Set(filtros[set]); s.has(v) ? s.delete(v) : s.add(v); onChange({ ...filtros, [set]: s }); };
  const activos = filtros.personas.size + filtros.clientes.size + filtros.categorias.size + (filtros.vencidas ? 1 : 0) + (filtros.q ? 1 : 0);
  const pill = (on, tone, label, onClick, key) => <Pill key={key} tone={on ? (tone === 'gray' ? 'inverse' : tone) : 'gray'} onClick={onClick} style={{ cursor: 'pointer', border: on ? 'none' : `1px solid ${theme.border}` }}>{label}</Pill>;
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${theme.border}` }}>
      <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 999, padding: '3px 10px', minWidth: 200 }}>
        <Search size={12} style={{ color: theme.textMuted }} />
        <input value={filtros.q} onChange={(e) => onChange({ ...filtros, q: e.target.value })} placeholder="buscar · #cliente · @persona" style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text, flex: 1, minWidth: 0 }} />
        {filtros.q && <X size={12} style={{ color: theme.textMuted, cursor: 'pointer' }} onClick={() => onChange({ ...filtros, q: '' })} />}
      </label>
      {personas.filter((p) => c.personas.get(p.user_id)).map((p) => pill(filtros.personas.has(p.user_id), 'blue', `@${p.handle} · ${c.personas.get(p.user_id)}`, () => toggle('personas', p.user_id), p.user_id))}
      {c.sinResponsable > 0 && pill(filtros.personas.has('__sin__'), 'gray', `sin responsable · ${c.sinResponsable}`, () => toggle('personas', '__sin__'), '__sin__')}
      {[...c.clientes.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => pill(filtros.clientes.has(k), TONE_CLIENTE[k] || 'gray', `#${k} · ${n}`, () => toggle('clientes', k), `c:${k}`))}
      {CATEGORIAS.filter((x) => c.categorias.get(x.id)).map((x) => pill(filtros.categorias.has(x.id), x.tone, `${x.label} · ${c.categorias.get(x.id)}`, () => toggle('categorias', x.id), `k:${x.id}`))}
      {c.vencidas > 0 && pill(filtros.vencidas, 'red', `Vencidas · ${c.vencidas}`, () => onChange({ ...filtros, vencidas: !filtros.vencidas }), 'venc')}
      {activos > 0 && <Pill tone="gray" onClick={() => onChange({ ...filtros, q: '', personas: new Set(), clientes: new Set(), categorias: new Set(), vencidas: false })} style={{ cursor: 'pointer' }}><X size={10} /> limpiar</Pill>}
      {extra}
    </div>
  );
}

/**
 * Campo de texto con autocompletar de #cliente · @persona · /categoría (popover al teclear).
 * Props: value, onChange(texto), personas, placeholder, onEnter, onEscape, autoFocus, style, multiline=false, onBlur, inputRef.
 */
export function CampoEtiquetas({ value, onChange, personas = [], placeholder, onEnter, onEscape, autoFocus, style, onBlur, inputRef, size = 'sm', onKeyDownExtra, sinBorde = false }) {
  const { theme } = useTheme();
  const ref = useRef(null);
  const el = inputRef || ref;
  const [cursor, setCursor] = useState(null);
  const [sel, setSel] = useState(0);
  const [abierto, setAbierto] = useState(true);
  const token = useMemo(() => (abierto ? tokenActivo(value, cursor) : null), [value, cursor, abierto]);
  const sugs = useMemo(() => sugerencias(token, personas), [token, personas]);
  useEffect(() => { setSel(0); }, [token?.texto, token?.tipo]);
  const aplicar = (s) => {
    const r = aplicarSugerencia(value, token, s);
    onChange(r.texto);
    requestAnimationFrame(() => { const i = el.current; if (i) { i.focus(); i.setSelectionRange(r.cursor, r.cursor); setCursor(r.cursor); } });
  };
  const onKeyDown = (e) => {
    if (token && sugs.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => (s + 1) % sugs.length); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => (s - 1 + sugs.length) % sugs.length); return; }
      if (e.key === 'Tab' || e.key === 'Enter') { e.preventDefault(); aplicar(sugs[sel]); return; }
      if (e.key === 'Escape') { e.preventDefault(); setAbierto(false); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); onEnter?.(e); return; }
    if (e.key === 'Escape') { onEscape?.(e); return; }
    onKeyDownExtra?.(e);
  };
  const actualizar = (e) => { setAbierto(true); onChange(e.target.value); setCursor(e.target.selectionStart); };
  const h = size === 'md' ? 34 : 28;
  return (
    <div style={{ position: 'relative', flex: 1, minWidth: 0, ...style }}>
      <input ref={el} value={value ?? ''} onChange={actualizar} onKeyDown={onKeyDown} onKeyUp={(e) => setCursor(e.target.selectionStart)} onClick={(e) => setCursor(e.target.selectionStart)} onBlur={(e) => { setTimeout(() => setAbierto(false), 120); onBlur?.(e); }} onFocus={() => setAbierto(true)}
        placeholder={placeholder} autoFocus={autoFocus}
        style={{ width: '100%', height: h, padding: sinBorde ? '0 2px' : '0 10px', borderRadius: 8, border: sinBorde ? 0 : `1px solid ${theme.border}`, background: sinBorde ? 'transparent' : theme.bg, outline: 'none', fontFamily: TYPO.fontText, fontSize: size === 'md' ? 13 : 12.5, color: theme.text, boxSizing: 'border-box' }} />
      {token && sugs.length > 0 && (
        <div role="listbox" style={{ position: 'absolute', left: 0, top: h + 4, zIndex: 40, minWidth: 220, background: theme.surface, border: bordeFlotante(theme), borderRadius: 10, boxShadow: elevation(theme, 'flotante'), overflow: 'hidden' }}>
          {sugs.map((s, i) => (
            <div key={s.id} role="option" aria-selected={i === sel} onMouseDown={(e) => { e.preventDefault(); aplicar(s); }} onMouseEnter={() => setSel(i)}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', cursor: 'pointer', background: i === sel ? (theme.surfaceHover || 'rgba(0,0,0,0.04)') : 'transparent', fontFamily: TYPO.fontText, fontSize: 12 }}>
              <span style={{ ...mono(theme), fontSize: 11, color: theme.accent, minWidth: 90 }}>{s.insertar}</span>
              <span style={{ color: theme.text, fontWeight: 500 }}>{s.label}</span>
              {s.sub && s.sub !== s.insertar && <span style={{ color: theme.textMuted, fontSize: 10.5, marginLeft: 'auto' }}>{s.sub}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EnlaceExterno({ href, children }) {
  const { theme } = useTheme();
  return <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} style={{ color: theme.accent, fontSize: 10.5, display: 'inline-flex', alignItems: 'center', gap: 3, textDecoration: 'none' }}>{children}<ExternalLink size={10} /></a>;
}
