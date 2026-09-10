// TarjetaPropuesta — tarjeta de la landing: cliente · nombre · estado · SKUs/piezas/total · pill "Convertido X %"
// (enviadas/cerradas, detalle expandible por SKU) · Excel final adjunto · Duplicar · Compartir · Eliminar (sólo borradores).
// Nada sensible: aquí no hay costo ni margen.
import React, { useRef, useState } from 'react';
import { Trash2, Copy, Share2, Paperclip, Download, X, ChevronDown } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton, TablaCompacta, EASE, DUR } from '../../../components/kit';
import { moneyCompact, int, relativo, fechaCorta } from '../../../lib/format';
import { CLIENTES, MES_LABEL, clienteColor, estadoInfo } from './constantes';

export default function TarjetaPropuesta({ p, ef, ocupado, onAbrir, onEliminar, onDuplicar, onCompartir, onExcelFinal }) {
  const { theme } = useTheme();
  const [detalle, setDetalle] = useState(false);
  const fileRef = useRef(null);
  const cli = CLIENTES.find((c) => c.key === p.clienteKey);
  const col = clienteColor(theme, p.clienteKey);
  const est = estadoInfo(p.estado);
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textSubtle || theme.textMuted, fontWeight: 600 };
  const stop = (fn) => (e) => { e.stopPropagation(); fn?.(e); };
  const puedeAdjuntar = p.estado !== 'borrador';
  const tonoConv = ef?.pct == null ? 'gray' : ef.pct >= 60 ? 'green' : ef.pct >= 25 ? 'orange' : 'red';

  const columnasEf = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 92 },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 180, render: (l) => <span title={l.descripcion} style={{ color: theme.textMuted }}>{l.descripcion || '—'}</span> },
    { key: 'piezasProp', label: 'Prop pz', width: 56, render: (l) => int(l.piezasProp) },
    { key: 'piezasFact', label: 'Fact pz', width: 56, bold: true, render: (l) => (l.piezasFact > 0 ? int(l.piezasFact) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'montoProp', label: 'Prop $', width: 72, render: (l) => moneyCompact(l.montoProp) },
    { key: 'montoFact', label: 'Vendido', width: 72, render: (l) => (l.montoFact > 0 ? moneyCompact(l.montoFact) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'pct', label: '%', width: 52, render: (l) => (l.pct == null ? '—' : <Pill tone={l.pct >= 60 ? 'green' : l.pct >= 25 ? 'orange' : l.pct > 0 ? 'red' : 'gray'} size="xs">{Math.round(l.pct)}%</Pill>) },
  ];

  return (
    <Panel elevable padding="12px 14px" style={{ cursor: 'pointer' }}>
      <div onClick={onAbrir}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <span style={{ width: 26, height: 26, borderRadius: 7, background: col, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 11, flexShrink: 0 }}>{cli?.iniciales || '?'}</span>
          <span style={{ flex: 1, minWidth: 0, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={`${cli?.label || p.clienteLabel} · ${p.nombre}`}>
            {cli?.label || p.clienteLabel} · {p.nombre || <span style={{ color: theme.textMuted, fontWeight: 500 }}>Sin nombre</span>}
          </span>
          <Pill tone={est.tone} size="xs" dot>{est.label}</Pill>
          {p.estado === 'borrador' && (
            <button type="button" title="Eliminar borrador" aria-label="Eliminar borrador" onClick={stop(onEliminar)}
              style={{ width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer', color: theme.textMuted, padding: 0, transition: `color ${DUR.state}ms ${EASE}` }}
              onMouseEnter={(e) => { e.currentTarget.style.color = theme.red || '#FF3B30'; }} onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; }}>
              <Trash2 size={13} />
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '2px 12px', marginBottom: 8 }}>
          <span style={lbl}>SKUs</span><span style={lbl}>Piezas</span><span style={lbl}>Total</span>
          <span style={{ ...mono, fontWeight: 600, fontSize: 13 }}>{int(p.resumen?.skus || 0)}</span>
          <span style={{ ...mono, fontWeight: 600, fontSize: 13 }}>{int(p.resumen?.piezas || 0)}</span>
          <span style={{ ...mono, fontWeight: 600, fontSize: 13, color: theme.green || '#34C759' }}>{moneyCompact(p.resumen?.total || 0)}</span>
        </div>
      </div>

      {ef && (
        <div onClick={stop(() => setDetalle((v) => !v))} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 0', borderTop: `1px solid ${theme.divider || theme.border}` }}
          title={`Ventana: ${ef.ventana.map((m) => `${MES_LABEL[m.mes - 1]} ${m.anio}`).join(' + ')}${ef.completa ? '' : ' (en curso)'} · ${ef.skusConvertidos} de ${ef.lineas.length} SKUs facturados`}>
          <Pill tone={tonoConv} size="xs" dot>Convertido {ef.pct == null ? '—' : `${Math.round(ef.pct)} %`}</Pill>
          <span style={{ fontSize: 10.5, color: theme.textMuted, ...mono }}>{moneyCompact(ef.montoFact)} de {moneyCompact(ef.montoProp)} · {ef.skusConvertidos}/{ef.lineas.length} SKUs{ef.completa ? '' : ' · en curso'}</span>
          <ChevronDown size={12} style={{ marginLeft: 'auto', color: theme.textMuted, transform: detalle ? 'rotate(180deg)' : 'none', transition: `transform ${DUR.state}ms ${EASE}` }} />
        </div>
      )}
      {ef && detalle && (
        <div onClick={(e) => e.stopPropagation()} style={{ margin: '4px 0 8px' }}>
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 6 }}>
            Ventana {ef.ventana.map((m) => `${MES_LABEL[m.mes - 1]} ${m.anio}`).join(' + ')} · enviada {fechaCorta(p.enviadaAt)}{p.enviadaAt && new Date(p.enviadaAt).getDate() < 15 ? ' (antes del 15: cuenta el mismo mes)' : ''}
          </div>
          <TablaCompacta dense columnas={columnasEf} filas={ef.lineas} rowKey={(l) => l.sku} maxHeight={220} />
        </div>
      )}

      {puedeAdjuntar && (
        p.excelFinal ? (
          <div onClick={(e) => e.stopPropagation()} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: `${theme.green || '#34C759'}12`, border: `1px solid ${theme.green || '#34C759'}44`, marginTop: 4 }}>
            <Paperclip size={12} style={{ color: theme.green || '#34C759', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: theme.green || '#34C759', fontWeight: 600 }}>Excel final enviado</div>
              <div style={{ ...mono, fontSize: 9.5, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.excelFinal.name}</div>
            </div>
            <Boton icon={Download} title="Descargar" onClick={() => { const a = document.createElement('a'); a.href = p.excelFinal.dataUrl; a.download = p.excelFinal.name; document.body.appendChild(a); a.click(); a.remove(); }} />
            <Boton icon={X} title="Quitar" onClick={() => onExcelFinal?.(p, null)} />
          </div>
        ) : (
          <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 4 }}>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onExcelFinal?.(p, f); }} />
            <Boton icon={Paperclip} onClick={() => fileRef.current?.click()} style={{ width: '100%', justifyContent: 'center', borderStyle: 'dashed' }}>Adjuntar el Excel final que se envió</Boton>
          </div>
        )
      )}

      <div onClick={(e) => e.stopPropagation()} style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 10, color: theme.textMuted, ...mono }} title={p.folio ? `Folio ${p.folio}` : undefined}>{relativo(p.updatedAt || p.tstamp)}{p.folio ? ` · ${p.folio}` : ''}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 4 }}>
          <Boton icon={Copy} title="Crear un borrador nuevo con las mismas líneas y precios de lista vigentes" disabled={ocupado} onClick={() => onDuplicar?.(p)}>Duplicar</Boton>
          <Boton icon={Share2} title="Resumen limpio por WhatsApp (sin costo ni margen)" disabled={ocupado || !(p.lineas?.length)} onClick={() => onCompartir?.(p)}>Compartir</Boton>
        </span>
      </div>
    </Panel>
  );
}
