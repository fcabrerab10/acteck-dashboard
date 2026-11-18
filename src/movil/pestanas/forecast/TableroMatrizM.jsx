// Tablero por mes y Matriz SKU × mes de Proyectos y forecast en el celular (2026-11-18 · congruencia web ↔ celular).
// Son las dos vistas de la web (proyectos/Tablero.jsx y MatrizSkuMes.jsx) pintadas para dedo; el cálculo es el mismo
// motor (modules/comercial/proyectos/calculo.js: calcular → tablero() · matriz() · detalleSku()). Aquí no se calcula nada.
//   TableroVista → una sección por mes del horizonte (+ «Más adelante»): dinero del mes con su reparto por cliente,
//                  tarjetas de proyecto (monto, piezas, estado, barra de cobertura, faltante). En vez de arrastrar,
//                  cada tarjeta tiene «Mover» (44 px) que abre HojaMover con los meses.
//   MatrizVista  → tabla SKU × meses con la celda coloreada por cobertura (verde cubierto · naranja justo · rojo falta)
//                  y selector Necesidad · Faltante · Reservado (cambia el número, no el color). Primera columna fija;
//                  si los 6 meses no caben, el desplazamiento es dentro de la tabla, nunca de la página. Tocar un SKU
//                  abre HojaSkuM (cobertura mes a mes, proyectos que lo piden y la compra sugerida).
// Las monta src/movil/pestanas/Proyectos.jsx (vistas «Tablero» y «Matriz»), que pone los datos y las escrituras.
import React from 'react';
import { ArrowLeftRight, Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { EASE } from '../../../lib/motion';
import { moneyCompact } from '../../../lib/format';
import { CLIENTES, CLIENTE_LABEL, PROB_LABEL, PROB_TONE } from '../../../modules/comercial/proyectos/calculo';
import { TONOS, pctCorto, fechaCortaISO } from '../../../modules/comercial/proyectos/textos';
import { FONDO, TINTA } from '../../../modules/comercial/proyectos/MatrizSkuMes';
import { HojaM, ListaAgrupada, Fila, Pill, Segmented, Vacio } from '../../piezas';
import { int, MONO } from '../../util';

export const MEDIDAS_MATRIZ = [
  { id: 'necesidad', label: 'Necesidad' },
  { id: 'faltante', label: 'Faltante' },
  { id: 'reservado', label: 'Reservado' },
];
const colorCliente = (k) => CLIENTES.find((c) => c.key === k)?.color || '#8E8E93';
const colorPct = (theme, pct) => (pct == null ? theme.textMuted : pct >= 99.5 ? theme.green : pct >= 70 ? theme.orange : theme.red);

/** Tarjeta de proyecto: tocarla abre la ficha; «Mover» cambia el mes sin arrastrar. */
export function TarjetaProyectoM({ proyecto: p, onAbrir, onMover }) {
  const { theme } = useTheme();
  const col = colorPct(theme, p.cubiertoPct);
  return (
    <div data-proyecto={p.id} style={{ display: 'flex', alignItems: 'stretch', background: theme.surface, border: `1px solid ${theme.border}`, borderLeft: `3px solid ${colorCliente(p.cliente)}`, borderRadius: 12, overflow: 'hidden', opacity: p.probabilidad === 'cancelado' ? 0.55 : 1, fontFamily: TYPO.fontText }}>
      <button type="button" onClick={() => onAbrir?.(p)} style={{ flex: 1, minWidth: 0, minHeight: 64, padding: '10px 12px', border: 0, background: 'transparent', color: theme.text, textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ flex: 1, minWidth: 0, fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}</span>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: col, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{pctCorto(p.cubiertoPct)}</span>
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
          {CLIENTE_LABEL[p.cliente] || p.cliente} · <span style={{ color: theme.text, fontWeight: 600 }}>{p.monto > 0 ? moneyCompact(p.monto) : 'sin precio'}</span> · {int(p.pz)} pz{p.skus ? ` · ${p.skus} SKU${p.skus === 1 ? '' : 's'}` : ''}
        </div>
        <div style={{ marginTop: 7, height: 4, borderRadius: 999, background: `${theme.text}0F`, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.min(100, Math.max(0, p.cubiertoPct || 0))}%`, background: col, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 7 }}>
          <Pill tone={PROB_TONE[p.probabilidad] || 'gray'} size="xs">{PROB_LABEL[p.probabilidad] || p.probabilidad}</Pill>
          <span style={{ fontSize: 11.5, color: p.faltante > 0 ? theme.red : theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.faltante > 0 ? `faltan ${int(p.faltante)} pz` : (p.pz > 0 ? 'cubierto' : 'sin SKUs')}</span>
        </div>
      </button>
      {onMover && (
        <button type="button" onClick={() => onMover(p)} aria-label={`Mover ${p.nombre} a otro mes`}
          style={{ width: 56, minHeight: 44, flexShrink: 0, border: 0, borderLeft: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, fontFamily: TYPO.fontText, fontSize: 10.5, fontWeight: 600 }}>
          <ArrowLeftRight size={17} strokeWidth={2.2} />Mover
        </button>
      )}
    </div>
  );
}

/** Vista pura del Tablero. `columnas` = tablero(res) del motor. */
export function TableroVista({ columnas = [], puedeEditar = false, onAbrir, onMover, onNuevo }) {
  const { theme } = useTheme();
  const hay = columnas.some((c) => c.proyectos.length);
  if (!hay && !puedeEditar) return <Vacio icon={null} titulo="Todavía no hay proyectos" sub="Un proyecto es una venta comprometida: cliente, mes y SKUs." color={theme.textMuted} />;
  return (
    <div data-tablero style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {columnas.map((col) => (
        <section key={col.clave} data-mes={col.clave}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, padding: '0 4px 6px' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, textTransform: col.anio ? 'capitalize' : 'none' }}>{col.labelLargo || col.label}</span>
            <span style={{ fontFamily: MONO, fontSize: 11.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{col.proyectos.length ? `${col.proyectos.length} · ${int(col.piezas)} pz` : 'sin proyectos'}</span>
          </div>
          {col.monto > 0 && (
            <div style={{ padding: '0 4px 8px', display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: TYPO.fontRounded || TYPO.fontDisplay, fontSize: 21, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{moneyCompact(col.monto)}</span>
              {CLIENTES.filter((c) => col.montoPorCliente?.[c.key] > 0).map((c) => (
                <span key={c.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color }} />{CLIENTE_LABEL[c.key]} {moneyCompact(col.montoPorCliente[c.key])}
                </span>
              ))}
              {col.montoPorProb?.confirmado > 0 && <span style={{ fontSize: 11.5, color: theme.textMuted }}>· confirmado {moneyCompact(col.montoPorProb.confirmado)}</span>}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {col.proyectos.map((p) => <TarjetaProyectoM key={p.id} proyecto={p} onAbrir={onAbrir} onMover={puedeEditar ? onMover : null} />)}
            {puedeEditar && col.anio && onNuevo && (
              <button type="button" onClick={() => onNuevo(col.anio, col.mes)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, width: '100%', height: 44, border: `1px dashed ${theme.border}`, borderRadius: 12, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 13, cursor: 'pointer' }}>
                <Plus size={15} /> Proyecto en {col.label}
              </button>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

/** «Mover a…»: los meses del horizonte como filas; sustituye al arrastre de la web. */
export function HojaMover({ abierto, proyecto, horizonte = [], onMover, onClose }) {
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Mover a…" sub={proyecto ? `${proyecto.nombre} · ${CLIENTE_LABEL[proyecto.cliente] || proyecto.cliente}` : undefined} alto="62vh">
      <ListaAgrupada pie="Cambia el mes objetivo del proyecto; la cobertura se vuelve a calcular con el inventario y el tránsito de ese mes.">
        {horizonte.map((m) => {
          const actual = proyecto && proyecto.anio === m.anio && proyecto.mes === m.mes;
          return <Fila key={m.clave} titulo={<span style={{ textTransform: 'capitalize' }}>{m.labelLargo || m.label}</span>} chevron={false} alto={48}
            trailing={actual ? <Pill tone="blue">Está aquí</Pill> : undefined} onClick={actual ? undefined : () => onMover?.(proyecto, m)} />;
        })}
      </ListaAgrupada>
    </HojaM>
  );
}

/** Vista pura de la Matriz. `filas` = matriz(res, { medida, soloFaltante }) del motor. */
export function MatrizVista({ filas = [], horizonte = [], medida = 'necesidad', onMedida, soloFaltante = false, onSoloFaltante, onSku }) {
  const { theme } = useTheme();
  const hair = `1px solid ${theme.border}`;
  const th = { padding: '8px 4px', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: hair, background: theme.surface, whiteSpace: 'nowrap', textAlign: 'center' };
  const fija = { position: 'sticky', left: 0, background: theme.surface, zIndex: 1, borderRight: hair };
  return (
    <div data-matriz>
      <div style={{ padding: '4px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <Segmented options={MEDIDAS_MATRIZ} value={medida} onChange={onMedida} style={{ width: '100%' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <button type="button" onClick={() => onSoloFaltante?.(!soloFaltante)} aria-pressed={soloFaltante}
            style={{ height: 44, padding: '0 14px', borderRadius: 999, border: `1px solid ${soloFaltante ? theme.red : theme.border}`, background: soloFaltante ? `${theme.red}1A` : theme.surface, color: soloFaltante ? theme.red : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer' }}>Sólo con faltante</button>
          <span style={{ display: 'inline-flex', gap: 8, fontSize: 11, color: theme.textMuted, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            {Object.entries(TONOS).map(([k, t]) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 9, height: 9, borderRadius: 3, background: TINTA[k]?.(theme) }} />{t.label}</span>)}
          </span>
        </div>
      </div>
      {!filas.length ? (
        <Vacio icon={null} titulo={soloFaltante ? 'Ningún SKU con faltante' : 'Ningún SKU con demanda de proyectos'} sub="En los seis meses del horizonte." color={theme.textMuted} style={{ padding: '26px 16px' }} />
      ) : (
        <div style={{ margin: '10px 16px 0', background: theme.surface, border: hair, borderRadius: 12, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: 0, width: '100%', minWidth: 104 + horizonte.length * 40 + 46 }}>
              <thead>
                <tr>
                  <th style={{ ...th, ...fija, textAlign: 'left', padding: '8px 8px', zIndex: 2 }}>SKU</th>
                  {horizonte.map((m) => <th key={m.clave} style={th}>{String(m.label).split(' ')[0]}</th>)}
                  <th style={{ ...th, borderLeft: hair }}>Falta</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((r) => (
                  <tr key={r.sku} onClick={() => onSku?.(r.sku)} style={{ cursor: onSku ? 'pointer' : 'default' }}>
                    <td style={{ ...fija, padding: '6px 8px', borderBottom: hair, maxWidth: 104, height: 44, boxSizing: 'border-box' }}>
                      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap' }}>{r.sku}</div>
                      {r.descripcion && <div style={{ fontSize: 10, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 92 }}>{r.descripcion}</div>}
                    </td>
                    {horizonte.map((m) => {
                      const c = r.celdas[m.clave];
                      const v = r[m.clave];
                      const vacia = !c || v == null || (medida !== 'necesidad' && !v);
                      return (
                        <td key={m.clave} data-tono={vacia ? undefined : c.tono} style={{ padding: '4px 3px', borderBottom: hair, textAlign: 'center', fontFamily: MONO, fontSize: 11.5, fontWeight: vacia ? 400 : 600, fontVariantNumeric: 'tabular-nums', background: vacia ? 'transparent' : FONDO[c.tono]?.(theme), color: vacia ? (theme.textSubtle || theme.textMuted) : TINTA[c.tono]?.(theme) }}>
                          {vacia ? (c ? '0' : '—') : int(v)}
                        </td>
                      );
                    })}
                    <td style={{ padding: '4px 4px', borderBottom: hair, borderLeft: hair, textAlign: 'center', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: r.faltante > 0 ? theme.red : theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{r.faltante > 0 ? int(r.faltante) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '8px 28px 0', lineHeight: 1.4 }}>
        El color dice si alcanza para ese mes (inventario disponible + tránsito que llega a tiempo, en orden de mes); el número es la {medida === 'faltante' ? 'pieza que falta' : medida === 'reservado' ? 'pieza reservada' : 'necesidad'}. Toca un SKU para ver el detalle.
      </div>
    </div>
  );
}

/** Detalle de un SKU de la matriz. `detalle` = detalleSku(res, sku) del motor. */
export function HojaSkuM({ abierto, detalle, horizonte = [], onClose, onProyecto }) {
  const { theme } = useTheme();
  const etiqueta = (clave) => { const m = horizonte.find((x) => x.clave === clave); return m ? (m.labelLargo || m.label) : clave; };
  const compra = detalle?.compra || null;
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={detalle?.sku || 'SKU'} sub={detalle?.celdas?.[0]?.descripcion || undefined} alto="80vh">
      {detalle && (
        <>
          {compra && (
            <div style={{ margin: '0 16px 14px', padding: '12px 14px', borderRadius: 12, background: `${theme.red}14`, border: `1px solid ${theme.red}33`, fontFamily: TYPO.fontText, fontSize: 13, color: theme.text, lineHeight: 1.45 }}>
              Faltan <b>{int(compra.falta)} pz</b> para {compra.mesLabel}. {compra.llegaTarde ? 'La fecha límite de compra ya pasó' : `Hay que pedirlas antes del ${fechaCortaISO(compra.limite)}`} (lead time {compra.leadTime} d{compra.proveedor ? ` · ${compra.proveedor}` : ''}).
            </div>
          )}
          <ListaAgrupada titulo="Cobertura por mes">
            {detalle.celdas.map((c) => (
              <Fila key={c.clave} titulo={<span style={{ textTransform: 'capitalize' }}>{etiqueta(c.clave)}</span>} chevron={false}
                sub={`necesita ${int(c.necesidad)} · disponible ${int(c.disponible)} · tránsito a tiempo ${int(c.transitoAntes)}${c.etaTarde ? ` · llega tarde ${fechaCortaISO(c.etaTarde)}` : ''}`}
                trailing={<Pill tone={TONOS[c.tono]?.tone || 'gray'}>{c.faltante > 0 ? `faltan ${int(c.faltante)}` : TONOS[c.tono]?.label}</Pill>} />
            ))}
          </ListaAgrupada>
          {detalle.proyectos.length > 0 && (
            <ListaAgrupada titulo="Proyectos que lo piden" meta={detalle.proyectos.length} style={{ marginTop: 14 }}>
              {detalle.proyectos.map((p) => (
                <Fila key={p.id} tono={colorCliente(p.cliente)} titulo={p.nombre} sub={`${CLIENTE_LABEL[p.cliente] || p.cliente} · ${PROB_LABEL[p.probabilidad] || p.probabilidad}`}
                  valor={`${int(p.linea?.piezas)} pz`} valorSub={Number(p.linea?.reservado) > 0 ? `${int(p.linea.reservado)} reserv.` : null} onClick={onProyecto ? () => onProyecto(p) : undefined} chevron={!!onProyecto} />
              ))}
            </ListaAgrupada>
          )}
        </>
      )}
    </HojaM>
  );
}
