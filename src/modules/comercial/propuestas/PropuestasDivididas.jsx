// Propuestas · vista dividida de la landing (2026-11-20 · patrón «lista + detalle» del diseño 3.105.0).
// Con la preferencia por dispositivo `dividida` y un contenedor ≥ 900 px, la landing cambia las tarjetas por meses por
// una lista a la izquierda (cliente · nombre / folio · mes · monto, estado como pill) y el detalle de la propuesta
// elegida a la derecha, en modo LECTURA: resumen, líneas y las mismas acciones de la tarjeta. Editar sigue siendo el
// armador de pantalla completa («Abrir en el armador»). Sin la preferencia o en angosto, la landing queda como siempre.
// Nada sensible: las líneas guardadas no traen costo, así que aquí no hay margen ni costo para nadie.
import React, { useRef, useState } from 'react';
import { Trash2, Copy, Share2, Paperclip, Download, X, PencilLine } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Pill, Boton, TablaCompacta, ListaDetalle } from '../../../components/kit';
import { money, moneyCompact, int, relativo, fechaCorta } from '../../../lib/format';
import { CLIENTES, MES_LABEL, MES_FULL, clienteColor, estadoInfo } from './constantes';

/** Ancho mínimo del contenedor de la landing para partirla. */
export const ANCHO_MIN_PROPUESTAS = 900;
export const cabeDivididaPropuestas = ({ dividida, ancho, n }) => !!dividida && Number(ancho) >= ANCHO_MIN_PROPUESTAS && n > 0;

const N = (v) => Number(v) || 0;
const nombreCliente = (p) => CLIENTES.find((c) => c.key === p.clienteKey)?.label || p.clienteLabel || p.clienteKey || '—';
/** Mes objetivo de la propuesta (si no lo trae, el de su fecha), igual que la agrupación de la landing. */
export function mesObjetivo(p) {
  let { anio, mes } = p;
  if (!anio || !mes) { const d = new Date(p.tstamp || Date.now()); anio = d.getFullYear(); mes = d.getMonth() + 1; }
  return { anio, mes };
}
/** Resumen de una propuesta: el guardado, o calculado de sus líneas si falta. */
export function resumenLectura(p) {
  const lineas = p.lineas || [];
  const calc = { skus: lineas.length, piezas: lineas.reduce((s, l) => s + N(l.piezas), 0), total: lineas.reduce((s, l) => s + N(l.piezas) * N(l.precio), 0) };
  return { skus: p.resumen?.skus ?? calc.skus, piezas: p.resumen?.piezas ?? calc.piezas, total: p.resumen?.total ?? calc.total };
}
/** Filas de la lista (forma de `ListaDetalle`). Puro. */
export function itemsDeLista(propuestas = []) {
  return propuestas.map((p) => {
    const { anio, mes } = mesObjetivo(p); const est = estadoInfo(p.estado);
    return {
      id: p.id, titulo: `${nombreCliente(p)} · ${(p.nombre || '').trim() || 'Sin nombre'}`,
      sub: `${p.folio ? `${p.folio} · ` : ''}${MES_LABEL[mes - 1]} ${anio} · ${moneyCompact(resumenLectura(p).total)}`,
      pill: { l: est.label, tone: est.tone },
    };
  });
}

/** Detalle en lectura de una propuesta. Vista pura (los archivos y confirmaciones los resuelven los callbacks). */
export function DetallePropuesta({ p, ef = null, ocupado = false, onAbrir, onEliminar, onDuplicar, onCompartir, onExcelFinal }) {
  const { theme } = useTheme();
  const fileRef = useRef(null);
  const cli = CLIENTES.find((c) => c.key === p.clienteKey);
  const est = estadoInfo(p.estado);
  const { anio, mes } = mesObjetivo(p);
  const r = resumenLectura(p);
  const lineas = (p.lineas || []).map((l) => ({ ...l, monto: N(l.piezas) * N(l.precio) }));
  const borrador = p.estado === 'borrador';
  const tonoConv = ef?.pct == null ? 'gray' : ef.pct >= 60 ? 'green' : ef.pct >= 25 ? 'orange' : 'red';
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textSubtle || theme.textMuted, fontWeight: 600 };
  const dato = (k, v, color) => (
    <div style={{ minWidth: 0 }}><div style={lbl}>{k}</div><div style={{ ...mono, fontSize: 14, fontWeight: 600, color: color || theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div></div>
  );
  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 96 },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 260, render: (l) => <span title={l.descripcion} style={{ color: theme.textMuted }}>{l.descripcion || '—'}</span> },
    { key: 'piezas', label: 'Piezas', width: 64, render: (l) => int(l.piezas) },
    { key: 'precio', label: 'Precio', width: 84, render: (l) => <span title={l.custom ? 'Precio personalizado' : l.lista || undefined}>{N(l.precio) > 0 ? money(l.precio) : '—'}</span> },
    { key: 'monto', label: 'Monto', width: 96, bold: true, render: (l) => (l.monto > 0 ? money(l.monto) : '—') },
  ];

  return (
    <Panel padding="14px 16px">
      <div data-detalle-propuesta={p.id} style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: clienteColor(theme, p.clienteKey), color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 12, flexShrink: 0 }}>{cli?.iniciales || '?'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.nombre || '').trim() || 'Sin nombre'}</div>
            <div style={{ fontSize: 11.5, color: theme.textMuted, ...mono }}>{p.folio ? `${p.folio} · ` : ''}actualizada {relativo(p.updatedAt || p.tstamp)}{p.enviadaAt ? ` · enviada ${fechaCorta(p.enviadaAt)}` : ''}</div>
          </div>
          <Pill tone={est.tone} dot>{est.label}</Pill>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px 14px' }}>
          {dato('Cliente', nombreCliente(p))}
          {dato('Mes objetivo', `${MES_FULL[mes - 1]} ${anio}`)}
          {dato('Vigencia', p.vigencia ? fechaCorta(p.vigencia) : '—')}
          {dato('Total', money(r.total), theme.green)}
          {dato('Piezas', int(r.piezas))}
          {dato('SKUs', int(r.skus))}
        </div>

        {ef && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', paddingTop: 8, borderTop: `1px solid ${theme.divider || theme.border}` }}>
            <Pill tone={tonoConv} size="xs" dot>Convertido {ef.pct == null ? '—' : `${Math.round(ef.pct)} %`}</Pill>
            <span style={{ fontSize: 11, color: theme.textMuted, ...mono }}>{moneyCompact(ef.montoFact)} de {moneyCompact(ef.montoProp)} · {ef.skusConvertidos}/{ef.lineas.length} SKUs · ventana {ef.ventana.map((m) => `${MES_LABEL[m.mes - 1]} ${m.anio}`).join(' + ')}{ef.completa ? '' : ' (en curso)'}</span>
          </div>
        )}

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Boton primario icon={PencilLine} disabled={ocupado} onClick={() => onAbrir?.(p)} title="Abre el armador de pantalla completa (ahí se exporta el Excel y el PDF)">{borrador ? 'Editar en el armador' : 'Abrir en el armador'}</Boton>
          <Boton icon={Copy} disabled={ocupado} onClick={() => onDuplicar?.(p)} title="Crear un borrador nuevo con las mismas líneas y precios de lista vigentes">Duplicar</Boton>
          <Boton icon={Share2} disabled={ocupado || !lineas.length} onClick={() => onCompartir?.(p)} title="Resumen limpio por WhatsApp (sin costo ni margen); un borrador queda como enviada">{borrador ? 'Compartir y enviar' : 'Compartir'}</Boton>
          {!borrador && !p.excelFinal && (<>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onExcelFinal?.(p, f); }} />
            <Boton icon={Paperclip} onClick={() => fileRef.current?.click()} title="Adjuntar el Excel final que se envió">Adjuntar Excel final</Boton>
          </>)}
          {borrador && <Boton icon={Trash2} peligro disabled={ocupado} onClick={() => onEliminar?.(p)} style={{ marginLeft: 'auto' }}>Eliminar</Boton>}
        </div>

        {!borrador && p.excelFinal && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 8, background: `${theme.green}12`, border: `1px solid ${theme.green}44` }}>
            <Paperclip size={13} style={{ color: theme.green, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10.5, color: theme.green, fontWeight: 600 }}>Excel final enviado</div>
              <div style={{ ...mono, fontSize: 10.5, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.excelFinal.name}</div>
            </div>
            <Boton icon={Download} title="Descargar" onClick={() => { const a = document.createElement('a'); a.href = p.excelFinal.dataUrl; a.download = p.excelFinal.name; document.body.appendChild(a); a.click(); a.remove(); }} />
            <Boton icon={X} title="Quitar" onClick={() => onExcelFinal?.(p, null)} />
          </div>
        )}

        <div>
          <div style={{ ...lbl, marginBottom: 6 }}>Líneas · {int(lineas.length)}</div>
          <TablaCompacta columnas={columnas} filas={lineas} rowKey={(l, i) => `${l.sku}-${i}`} maxHeight="min(460px, calc(100dvh - 300px))"
            totales={lineas.length ? { piezas: int(r.piezas), monto: money(r.total) } : null} vacio="Sin líneas. Ábrela en el armador para agregar productos." />
        </div>
      </div>
    </Panel>
  );
}

/** Lista a la izquierda + detalle a la derecha. `propuestas` ya viene filtrada y en el orden de la landing. */
export default function PropuestasDivididas({ propuestas = [], efectividades, ocupado, inicial = null, onAbrir, onEliminar, onDuplicar, onCompartir, onExcelFinal }) {
  const [sel, setSel] = useState(inicial);
  const p = propuestas.find((x) => x.id === sel) || propuestas[0] || null;
  if (!p) return null;
  return (
    <ListaDetalle titulo={`Propuestas · ${int(propuestas.length)}`} items={itemsDeLista(propuestas)} activo={p.id} onElegir={setSel} anchoLista={300}>
      <DetallePropuesta key={p.id} p={p} ef={efectividades?.get?.(p.id) || null} ocupado={ocupado}
        onAbrir={onAbrir} onEliminar={onEliminar} onDuplicar={onDuplicar} onCompartir={onCompartir} onExcelFinal={onExcelFinal} />
    </ListaDetalle>
  );
}
