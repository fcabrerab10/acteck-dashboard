// Fila de actividad · tile de tipo, nombre, meta (fecha · marca · red · responsable),
// métricas en una línea, inversión tabular, pill de estatus y acciones al hover.
import React, { useState } from 'react';
import { Check, RotateCcw, Pencil, Archive, Trash2, Lock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, EASE, DUR } from '../../../components/kit';
import { tipoMeta, MARCAS, REDES_SOCIALES, fechaCorta, fmtMXN, estatusDe, metricasLinea, esCerrada } from './config';

function IconBtn({ Icon, title, onClick, disabled, peligro }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  return (
    <button type="button" title={title} disabled={disabled} onClick={(e) => { e.stopPropagation(); onClick?.(); }}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        width: 24, height: 24, borderRadius: 999, border: `1px solid ${theme.border}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover && !disabled ? (theme.surfaceHover || 'rgba(0,0,0,0.03)') : theme.surface,
        color: disabled ? (theme.textSubtle || theme.textMuted) : peligro ? (theme.red || '#FF3B30') : theme.text,
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: `background ${DUR.tap}ms ${EASE}`,
      }}>
      <Icon size={12} strokeWidth={2} />
    </button>
  );
}

export default function ActividadFila({ a, hoy, canEdit, onEdit, onToggle, onArchivar, onDelete, ultima }) {
  const { theme } = useTheme();
  const [hover, setHover] = useState(false);
  const tm = tipoMeta(a.tipo);
  const marca = MARCAS[a.marca];
  const rs = a.red_social ? REDES_SOCIALES[a.red_social] : null;
  const st = estatusDe(a, hoy);
  const cerrada = esCerrada(a);
  const mets = metricasLinea(a);
  const inv = Number(a.inversion) || 0;
  const Icon = tm.Icon;
  const meta = [fechaCorta(a.fecha), rs?.label, a.responsable].filter(Boolean);
  if (a.tipo === 'evento' && a.evento_sucursal) meta.push(`Sucursal ${a.evento_sucursal}`);
  if (a.tipo === 'evento' && a.evento_pop) meta.push(`POP ${a.evento_pop}`);

  return (
    <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={canEdit ? () => onEdit(a) : undefined}
      style={{
        display: 'grid', gridTemplateColumns: '28px minmax(0,1fr) auto', gap: 10, alignItems: 'center', padding: '8px 4px',
        borderBottom: ultima ? 'none' : `1px solid ${theme.border}`, opacity: cerrada ? 0.62 : 1, cursor: canEdit ? 'pointer' : 'default',
        background: hover ? (theme.surfaceHover || 'rgba(0,0,0,0.02)') : 'transparent', borderRadius: 8, transition: `background ${DUR.state}ms ${EASE}`,
      }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: `${tm.color}22`, color: tm.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={14} strokeWidth={1.8} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.nombre || 'Sin nombre'}</span>
          {marca && <Pill tone={marca.tone} size="xs">{marca.label}</Pill>}
        </div>
        <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
          <span style={{ color: tm.color, fontWeight: 600 }}>{tm.label}</span>{meta.length ? ' · ' + meta.join(' · ') : ''}
          {a.mensaje && <span style={{ fontStyle: 'italic' }}> · “{a.mensaje}”</span>}
        </div>
        {mets.length > 0 && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1, fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mets.join(' · ')}</div>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em', color: inv > 0 ? theme.text : (theme.textSubtle || theme.textMuted), minWidth: 62, textAlign: 'right' }}>{inv > 0 ? fmtMXN(inv) : '—'}</span>
        <Pill tone={st.tone} dot={!!st.dot} size="xs" style={{ minWidth: 68, justifyContent: 'center' }}>{st.lock && <Lock size={9} strokeWidth={2.5} />}{st.label}</Pill>
        {canEdit && (
          <span style={{ display: 'inline-flex', gap: 4, opacity: hover ? 1 : 0, transition: `opacity ${DUR.state}ms ${EASE}`, pointerEvents: hover ? 'auto' : 'none' }}>
            <IconBtn Icon={cerrada ? RotateCcw : Check} title={cerrada ? 'Reactivar' : 'Completar'} onClick={() => onToggle(a)} />
            <IconBtn Icon={Pencil} title="Editar" onClick={() => onEdit(a)} />
            <IconBtn Icon={Archive} title={a.estatus === 'archivado' ? 'Ya archivada' : 'Archivar'} disabled={a.estatus === 'archivado'} onClick={() => onArchivar(a)} />
            <IconBtn Icon={Trash2} title={a.pago_id ? 'Ligada a un pago · no se puede eliminar' : 'Eliminar'} disabled={!!a.pago_id} peligro onClick={() => onDelete(a.id)} />
          </span>
        )}
      </div>
    </div>
  );
}
