// Pila — grupo de alertas de un área dentro del centro de notificaciones.
// Colapsada: título del área · hora relativa · conteo, y la alerta más severa +
// "y N más". Al tocar se expande (grid-rows, DUR.content) y muestra cada alerta
// con dot de severidad, título, detalle, Pill cliente/SKU y acciones.
import React, { useState } from 'react';
import { ChevronDown, Check, Clock, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Pill } from '../kit';
import { SEV_LABEL, NOMBRE_CLIENTE, accionAlerta, esNueva } from '../../lib/alertas';

export function colorSev(theme, sev) {
  return {
    critica: theme.red || '#FF3B30',
    alta: theme.orange || '#FF9500',
    media: theme.yellow || '#FFCC00',
    info: theme.accent || '#007AFF',
  }[sev] || theme.textSubtle;
}

export function horaRelativa(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.round(ms / 60000);
  if (min < 1) return 'ahora';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  if (d === 1) return 'ayer';
  if (d < 7) return `hace ${d} d`;
  const sem = Math.round(d / 7);
  return sem === 1 ? 'hace 1 sem' : `hace ${sem} sem`;
}

const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

function BotonMini({ children, color, onClick, title, primario = false }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const col = color || theme.textMuted;
  return (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick?.(); }} title={title}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, height: 24, padding: primario ? '0 10px' : '0 8px', borderRadius: 999,
        border: `1px solid ${primario ? (theme.accent || '#007AFF') : theme.border}`,
        background: primario ? (theme.accent || '#007AFF') : hover ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : 'transparent',
        color: primario ? '#FFF' : col, fontFamily: TYPO.fontText, fontSize: 11.5, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap',
        transition: `background ${DUR.state}ms ${EASE}`,
      }}>
      {children}
    </button>
  );
}

export function FilaAlerta({ a, lecturas, onAccion, onVer, onPosponer, onResolver, saliendo = false, quieta = false }) {
  const { theme } = useTheme();
  const col = colorSev(theme, a.severidad);
  const nueva = esNueva(a, lecturas);
  const acc = accionAlerta(a);
  const pill = a.sku || (a.cliente_key ? (NOMBRE_CLIENTE[a.cliente_key] || a.cliente_key) : null);
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '10px 1fr', gap: 10, padding: '10px 14px 10px 16px',
      borderTop: `1px solid ${theme.border}`, opacity: saliendo ? 0 : 1, transform: saliendo ? 'translateX(12px)' : 'none',
      transition: `opacity ${DUR.exit}ms ${EASE}, transform ${DUR.exit}ms ${EASE}`,
    }}>
      <span title={SEV_LABEL[a.severidad]} style={{ width: 8, height: 8, borderRadius: 999, marginTop: 5, background: col, boxShadow: a.severidad === 'critica' ? `0 0 6px ${col}88` : 'none', opacity: quieta ? 0.7 : 1 }} />
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: nueva ? 600 : 500, letterSpacing: '-0.005em', color: theme.text, lineHeight: 1.3 }}>{a.titulo}</span>
          {nueva && <span title="Nueva" style={{ width: 6, height: 6, borderRadius: 999, background: theme.accent || '#007AFF', marginTop: 5, flexShrink: 0 }} />}
        </div>
        {a.detalle && <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.4 }}>{a.detalle}</div>}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
          {pill && <Pill tone="gray" style={a.sku ? { fontFamily: MONO, letterSpacing: 0, fontWeight: 500 } : undefined}>{pill}</Pill>}
          <span style={{ flex: 1 }} />
          {acc && acc.label && acc.label !== 'Ver' && (
            <BotonMini primario onClick={() => onAccion?.(a)} title={acc.label}>{acc.label}</BotonMini>
          )}
          {acc && <BotonMini onClick={() => onVer?.(a)} title="Ver en el dashboard" color={theme.accent}><ArrowUpRight size={12} />Ver</BotonMini>}
          <BotonMini onClick={() => onPosponer?.(a)} title="Posponer 3 días"><Clock size={12} />3 d</BotonMini>
          <BotonMini onClick={() => onResolver?.(a)} title="Resolver" color={theme.green || '#34C759'}><Check size={12} /></BotonMini>
        </div>
      </div>
    </div>
  );
}

export default function Pila({ pila, lecturas, abiertaInicial = false, quieta = false, saliendo, onAccion, onVer, onPosponer, onResolver, onAbrir }) {
  const { theme } = useTheme();
  const [abierta, setAbierta] = useState(abiertaInicial);
  const [hover, setHover] = useState(false);
  const primera = pila.alertas[0];
  const n = pila.alertas.length;
  const col = colorSev(theme, primera?.severidad);
  const toggle = () => { const v = !abierta; setAbierta(v); if (v) onAbrir?.(pila); };
  return (
    <div style={{ borderTop: `1px solid ${theme.border}` }}>
      <div role="button" tabIndex={0} onClick={toggle} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } }}
        onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
        style={{ padding: '10px 14px 10px 16px', cursor: 'pointer', background: hover ? (theme.surfaceHover || 'rgba(0,0,0,0.02)') : 'transparent', transition: `background ${DUR.state}ms ${EASE}`, userSelect: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{pila.label}</span>
          {pila.nuevas > 0 && (
            <span style={{ minWidth: 16, height: 16, padding: '0 5px', borderRadius: 999, background: pila.criticaNueva ? (theme.red || '#FF3B30') : (theme.accent || '#007AFF'), color: '#FFF', fontSize: 10, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontVariantNumeric: 'tabular-nums' }}>{pila.nuevas}</span>
          )}
          <span style={{ fontSize: 11, color: theme.textSubtle }}>{horaRelativa(pila.ultima)}</span>
          <span style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{n} {n === 1 ? 'aviso' : 'avisos'}</span>
          <ChevronDown size={13} color={theme.textMuted} style={{ transform: abierta ? 'rotate(180deg)' : 'rotate(0)', transition: `transform ${DUR.state}ms ${EASE}` }} />
        </div>
        {!abierta && primera && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, minWidth: 0 }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: col, boxShadow: primera.severidad === 'critica' ? `0 0 6px ${col}88` : 'none', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{primera.titulo}</span>
            {n > 1 && <span style={{ fontSize: 11, color: theme.textSubtle, whiteSpace: 'nowrap' }}>y {n - 1} más</span>}
          </div>
        )}
      </div>
      <div style={{ display: 'grid', gridTemplateRows: abierta ? '1fr' : '0fr', transition: `grid-template-rows ${DUR.content}ms ${EASE}` }}>
        <div style={{ overflow: 'hidden', minHeight: 0 }}>
          {pila.alertas.map((a) => (
            <FilaAlerta key={a.id} a={a} lecturas={lecturas} quieta={quieta} saliendo={saliendo?.has(a.id)}
              onAccion={onAccion} onVer={onVer} onPosponer={onPosponer} onResolver={onResolver} />
          ))}
        </div>
      </div>
    </div>
  );
}
