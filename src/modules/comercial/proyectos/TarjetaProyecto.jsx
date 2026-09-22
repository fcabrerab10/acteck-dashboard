// Tarjeta de proyecto del Tablero: nombre, cliente, piezas, probabilidad, barra de
// cobertura y responsable. Se arrastra entre columnas (HTML5 drag) y, para quien no
// quiera arrastrar, tiene dos flechas que la mueven un mes hacia atrás o adelante.
import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, GripVertical } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE, DUR } from '../../../lib/motion';
import { elevation } from '../../../lib/elevation';
import { Pill } from '../../../components/kit';
import { int } from '../../../lib/format';
import { PROB_LABEL, PROB_TONE, CLIENTE_LABEL, CLIENTES } from './calculo';
import { pctCorto } from './textos';

const colorCliente = (k) => CLIENTES.find((c) => c.key === k)?.color || '#8E8E93';

export default function TarjetaProyecto({ proyecto: p, onAbrir, onMover, arrastrable = true, compacta = false }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const [drag, setDrag] = useState(false);
  const pct = p.cubiertoPct;
  const col = pct == null ? theme.textMuted : pct >= 99.5 ? (theme.green || '#34C759') : pct >= 70 ? (theme.orange || '#FF9500') : (theme.red || '#FF3B30');

  return (
    <div
      draggable={arrastrable}
      onDragStart={(e) => { setDrag(true); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', p.id); }}
      onDragEnd={() => setDrag(false)}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      onClick={() => onAbrir?.(p)}
      title={`${p.nombre} · ${CLIENTE_LABEL[p.cliente] || p.cliente}`}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12,
        padding: compacta ? '8px 10px' : '10px 12px', cursor: 'pointer', fontFamily: TYPO.fontText,
        borderLeft: `3px solid ${colorCliente(p.cliente)}`,
        opacity: drag ? 0.45 : p.probabilidad === 'cancelado' ? 0.55 : 1,
        boxShadow: elevation(theme, hover ? 'hover' : 'reposo'),
        transform: hover && !drag ? 'translateY(-1px)' : 'none',
        transition: `transform ${DUR.state}ms ${EASE}, box-shadow ${DUR.state}ms ${EASE}, opacity ${DUR.state}ms ${EASE}`,
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</div>
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {CLIENTE_LABEL[p.cliente] || p.cliente} · {int(p.pz)} pz{p.skus ? ` · ${p.skus} SKU${p.skus === 1 ? '' : 's'}` : ''}
          </div>
        </div>
        {arrastrable && <GripVertical size={12} style={{ color: theme.textSubtle || theme.textMuted, opacity: hover ? 0.8 : 0.25, flexShrink: 0, marginTop: 2 }} />}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
        <Pill tone={PROB_TONE[p.probabilidad] || 'gray'} size="xs">{PROB_LABEL[p.probabilidad] || p.probabilidad}</Pill>
        <span style={{ flex: 1 }} />
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums' }}>{pctCorto(pct)}</span>
      </div>

      <div style={{ marginTop: 5, height: 3, borderRadius: 999, background: `${theme.text}0F`, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, pct || 0))}%`, background: col, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6, minHeight: 16 }}>
        <span style={{ fontSize: 10, color: theme.textMuted, flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {p.responsable || 'Sin responsable'}
          {p.faltante > 0 && <> · <span style={{ color: theme.red || '#FF3B30' }}>faltan {int(p.faltante)} pz</span></>}
        </span>
        {onMover && (
          <span style={{ display: 'inline-flex', gap: 2, opacity: hover ? 1 : 0, transition: `opacity ${DUR.state}ms ${EASE}` }}>
            <Flecha theme={theme} icon={ChevronLeft} title="Un mes antes" onClick={(e) => { e.stopPropagation(); onMover(p, -1); }} />
            <Flecha theme={theme} icon={ChevronRight} title="Un mes después" onClick={(e) => { e.stopPropagation(); onMover(p, 1); }} />
          </span>
        )}
      </div>
    </div>
  );
}

function Flecha({ theme, icon: Icon, onClick, title }) {
  return (
    <button type="button" onClick={onClick} title={title} aria-label={title}
      style={{ width: 18, height: 18, borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, cursor: 'pointer' }}>
      <Icon size={11} />
    </button>
  );
}
