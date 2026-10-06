// Calculadora de precio y margen en la web (2026-10-06; Fernando aprobó traerla del celular: «me gusta la 3»).
// Mismo motor puro que el celular (precios/calculadora.js) y la MISMA propuesta en curso (movil/pestanas/precios/propuesta.js:
// borrador real en propuestas_borradores, recordado en localStorage; aparece en Propuestas con su folio).
//   Izquierda: buscador «que entiende» → SKU elegido (lista natural del cliente primero, precio de lista, costo y margen
//   de lista si es sensible). Derecha: barra de descuento 0–40 % ⇄ campo de precio (lo último que se toca manda), piezas,
//   resultado 2×2 y avisos (bajo el mínimo · bajo lo ya facturado a ese cliente). Abajo: las líneas de la propuesta en curso.
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Settings2, AlertTriangle, Plus, Tag, Minus, ExternalLink, Trash2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';
import { usePreferencias, setPreferencia, getPath } from '../../../lib/preferencias';
import { interpretarBusqueda, coincideSku, indiceSku } from '../../../lib/buscarSku';
import { Panel, Segmented, Pill, Boton, toast } from '../../../components/kit';
import BuscadorEntiende from '../sellin/BuscadorEntiende';
import CampoNumero from '../propuestas/CampoNumero';
import { CLIENTES, LISTA_POR_CLIENTE } from '../propuestas/constantes';
import { calcular, DESCUENTO_MAX, MARGEN_MINIMO_DEFAULT, margenLineas } from './calculadora';
import { ordenarListas, listaLbl } from './textos';
import { clienteDeLista, labelCliente, cargarEnCurso, guardarLineas, recordarEnCurso, QK_PROPUESTAS } from '../../../movil/pestanas/precios/propuesta';
import { lineaDesdeCalculo } from '../../../movil/pestanas/precios/calculo';

const N = (v) => (v == null || v === '' || Number.isNaN(Number(v)) ? 0 : Number(v));
const STALE = 5 * 60 * 1000;
const fmt2 = (n) => `$${N(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmt0 = (n) => `$${Math.round(N(n)).toLocaleString('en-US')}`;
const fmtPct = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(d)} %`);

/** Último precio facturado del SKU a ese cliente (erp_ventas, movimiento Factura). */
function useFacturado(clienteKey, sku) {
  return useQuery({
    queryKey: ['precios', 'facturado', clienteKey, sku], staleTime: STALE, enabled: !!clienteKey && !!sku,
    queryFn: async () => {
      const r = await cachedQuery(supabase.from('erp_ventas').select('periodo,precio_unidad_pesos').eq('cliente_key', clienteKey).eq('articulo', sku).eq('movimiento_venta', 'Factura').gt('unidades', 0).order('periodo', { ascending: false }).limit(1));
      const f = r?.data?.[0];
      return f ? { precio: N(f.precio_unidad_pesos), fecha: String(f.periodo || '').slice(0, 10) } : null;
    },
  });
}

/**
 * @param {Array} catalogo    roadmap [{ sku, descripcion, marca, categoria, familia }]
 * @param {Map}   filasPorSku sku → fila de precios/calculo.js#construirFilas ({ precios, costo })
 * @param {string} skuInicial abre con ese SKU (desde la tabla: «Calcular»)
 */
export default function CalculadoraPanel({ catalogo = [], filasPorSku, sensible = false, skuInicial = null, perfil, onNavegar }) {
  const { theme } = useTheme();
  const qc = useQueryClient();
  const { prefs } = usePreferencias();
  const margenMinimo = N(getPath(prefs, 'precios.margenMinimo', MARGEN_MINIMO_DEFAULT)) || MARGEN_MINIMO_DEFAULT;

  const [q, setQ] = useState('');
  const [sku, setSku] = useState(skuInicial);
  const [lista, setLista] = useState(null);
  const [modo, setModo] = useState('descuento');
  const [descuento, setDescuento] = useState(0);
  const [precio, setPrecio] = useState(null);
  const [piezas, setPiezas] = useState(5);
  const [ajustando, setAjustando] = useState(false);
  useEffect(() => { if (skuInicial) { setSku(skuInicial); setQ(''); } }, [skuInicial]);

  // ── Propuesta en curso (borrador real) ──
  const [modelo, setModelo] = useState(null);
  const [clienteKey, setClienteKey] = useState('digitalife');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { let vivo = true; cargarEnCurso().then((m) => { if (vivo && m) { setModelo(m); setClienteKey(m.clienteKey || 'digitalife'); } }); return () => { vivo = false; }; }, []);
  const lineas = modelo?.lineas || [];
  const persistir = async (nuevas, ck = clienteKey) => {
    setGuardando(true);
    try {
      if (!nuevas.length && modelo) recordarEnCurso(null);
      const m = await guardarLineas({ modelo, clienteKey: ck, lineas: nuevas, perfil });
      setModelo(m); qc.invalidateQueries({ queryKey: QK_PROPUESTAS }); return m;
    } catch (e) { toast.error(`No se pudo guardar la propuesta: ${e?.message || e}`); return null; }
    finally { setGuardando(false); }
  };

  const categorias = useMemo(() => [...new Set(catalogo.map((r) => r.categoria).filter(Boolean))], [catalogo]);
  const indice = useMemo(() => new Map(catalogo.map((r) => [r.sku, indiceSku(r)])), [catalogo]);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const resultados = useMemo(() => {
    if (interp.vacio) return [];
    const out = [];
    for (const r of catalogo) { if (coincideSku(r, interp, indice.get(r.sku))) { out.push(r); if (out.length >= 10) break; } }
    return out;
  }, [catalogo, interp, indice]);

  const item = useMemo(() => (sku ? catalogo.find((r) => r.sku === sku) || { sku } : null), [catalogo, sku]);
  const fila = sku ? filasPorSku?.get(sku) : null;
  const listas = useMemo(() => ordenarListas(Object.keys(fila?.precios || {}).filter((l) => N(fila.precios[l]) > 0)), [fila]);
  const listaValida = lista && listas.includes(lista) ? lista : (listas.includes(LISTA_POR_CLIENTE[clienteKey]) ? LISTA_POR_CLIENTE[clienteKey] : listas[0] || null);
  const precioLista = listaValida ? N(fila?.precios?.[listaValida]) : 0;
  const costo = sensible ? N(fila?.costo) : 0;
  const margenLista = sensible && costo > 0 && precioLista > 0 ? ((precioLista - costo) / precioLista) * 100 : null;
  const { data: facturado } = useFacturado(clienteKey, sku);
  useEffect(() => { setDescuento(0); setPrecio(null); setModo('descuento'); }, [sku, listaValida]);

  const r = useMemo(() => calcular({
    precioLista, costo, piezas, margenMinimo,
    ...(modo === 'precio' && precio != null ? { precio } : { descuentoPct: descuento }),
    precioFacturado: facturado?.precio, facturadoFecha: facturado?.fecha, clienteLabel: labelCliente(clienteKey),
  }), [precioLista, costo, piezas, margenMinimo, modo, precio, descuento, facturado, clienteKey]);
  const avisos = sensible ? r.avisos : r.avisos.filter((a) => a.tipo === 'facturado');
  const colorMargen = { green: theme.green, orange: theme.orange, red: theme.red, gray: theme.textMuted }[r.tono] || theme.text;
  const descuentoBarra = Math.min(DESCUENTO_MAX, Math.max(0, Math.round(r.descuentoPct)));

  const cambiarLista = (l) => { setLista(l); const ck = clienteDeLista(l); if (ck && ck !== clienteKey) cambiarCliente(ck); };
  const cambiarCliente = (ck) => { if (ck === clienteKey) return; setClienteKey(ck); const nat = LISTA_POR_CLIENTE[ck]; if (nat && listas.includes(nat)) setLista(nat); if (lineas.length) persistir(lineas, ck); };
  const agregar = async () => {
    if (!item || !listaValida || !(r.precioNeto > 0) || !(r.piezas > 0)) return;
    const l = lineaDesdeCalculo({ sku: item.sku, descripcion: item.descripcion || '', marca: item.marca || '', familia: item.familia || '', lista: listaValida, precioLista, piezas: r.piezas, precioNeto: r.precioNeto, descuentoPct: r.descuentoPct });
    const m = await persistir([...lineas.filter((x) => x.sku !== l.sku), l]);
    if (m) toast.ok(`${l.sku} en la propuesta · ${m.folio || 'borrador'}`);
  };
  const quitar = (s) => persistir(lineas.filter((x) => x.sku !== s));
  const totales = useMemo(() => margenLineas(lineas.map((l) => ({ ...l, costo: sensible ? N(filasPorSku?.get(l.sku)?.costo) : 0 }))), [lineas, filasPorSku, sensible]);

  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted };
  const dato = (k, v, sub, color) => (
    <div style={{ minWidth: 0, padding: '8px 10px', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ ...lbl, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{v}</div>
      {sub != null && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
  const pillBtn = (on) => ({ display: 'inline-flex', alignItems: 'center', gap: 5, height: 24, padding: '0 9px', borderRadius: 999, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? `${theme.accent}14` : theme.surface, color: on ? theme.accent : theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer' });

  return (
    <Panel titulo="Calculadora de precio" meta={`descuento o precio → margen y avisos${guardando ? ' · guardando…' : ''}`}
      acciones={(
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {sensible && !ajustando && <button type="button" onClick={() => setAjustando(true)} style={pillBtn(false)}><Settings2 size={12} />mínimo {margenMinimo} %</button>}
          {sensible && ajustando && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Segmented size="sm" value={String(margenMinimo)} onChange={(v) => { setPreferencia('precios.margenMinimo', Number(v)); setAjustando(false); }} options={[10, 15, 20, 25].map((n) => ({ id: String(n), label: `${n} %` }))} />
              <button type="button" onClick={() => setAjustando(false)} style={pillBtn(false)}><X size={11} /></button>
            </span>
          )}
          <Segmented size="sm" value={clienteKey} onChange={cambiarCliente} options={CLIENTES.map((c) => ({ id: c.key, label: c.label }))} />
        </div>
      )}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(260px, 1fr) minmax(320px, 1.3fr)', gap: 14, fontFamily: TYPO.fontText }}>
        {/* ── Izquierda: SKU ── */}
        <div style={{ minWidth: 0 }}>
          {!item && (
            <>
              <BuscadorEntiende value={q} onChange={setQ} categorias={categorias} width="100%" autoFocus={false} placeholder="SKU, modelo, marca o categoría…" />
              {!interp.vacio && resultados.length === 0 && <div style={{ fontSize: 12, color: theme.textMuted, padding: '10px 2px 0' }}>Sin coincidencias en el roadmap.</div>}
              {resultados.length > 0 && (
                <div style={{ marginTop: 8, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden' }}>
                  {resultados.map((s, i) => {
                    const nL = Object.keys(filasPorSku?.get(s.sku)?.precios || {}).length;
                    return (
                      <button key={s.sku} type="button" onClick={() => { setSku(s.sku); setQ(''); setLista(null); }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: '7px 10px', border: 0, borderTop: i ? `1px solid ${theme.border}` : 0, background: 'transparent', color: theme.text, cursor: 'pointer', fontFamily: TYPO.fontText }}>
                        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap' }}>{s.sku}</span>
                        <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.descripcion || 'Sin descripción'}</span>
                        {nL ? <Pill tone="blue" size="xs">{nL} lista{nL === 1 ? '' : 's'}</Pill> : <Pill tone="gray" size="xs">sin precio</Pill>}
                      </button>
                    );
                  })}
                </div>
              )}
              {interp.vacio && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '10px 2px 0', lineHeight: 1.4 }}>Escribe un SKU («AC-9431»), un modelo, una marca o una categoría. También puedes tocar «Calcular» en la tabla de abajo.</div>}
            </>
          )}
          {item && (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em' }}>{item.sku}{item.marca && <span style={{ fontWeight: 500, fontSize: 11.5, color: theme.textMuted, marginLeft: 8 }}>{item.marca}</span>}</div>
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, lineHeight: 1.35 }}>{item.descripcion || 'Sin descripción en el roadmap'}</div>
                </div>
                <button type="button" onClick={() => { setSku(null); setQ(''); }} title="Cambiar SKU" style={pillBtn(false)}><X size={11} />cambiar</button>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <Tag size={12} style={{ color: theme.textMuted }} />
                {listas.length === 0 && <span style={{ fontSize: 12, color: theme.orange }}>Este SKU no tiene precio en ninguna lista.</span>}
                {listas.map((l) => <button key={l} type="button" onClick={() => cambiarLista(l)} style={pillBtn(l === listaValida)} title={clienteDeLista(l) ? `Lista natural de ${labelCliente(clienteDeLista(l))}` : l}>{listaLbl(l)} · {fmt0(fila?.precios?.[l])}</button>)}
              </div>
              {listaValida && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                  {dato('Precio de lista', fmt2(precioLista), `${listaLbl(listaValida)} · + IVA`)}
                  {sensible ? dato('Margen de lista', fmtPct(margenLista), costo > 0 ? `costo promedio ${fmt2(costo)}` : 'sin costo promedio') : dato('Cliente', labelCliente(clienteKey), 'de la propuesta')}
                </div>
              )}
              {facturado?.precio > 0 && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>Última factura a {labelCliente(clienteKey)}: <b style={{ color: theme.text }}>{fmt2(facturado.precio)}</b>{facturado.fecha ? ` · ${facturado.fecha}` : ''}</div>}
            </>
          )}
        </div>

        {/* ── Derecha: descuento ⇄ precio · piezas · resultado ── */}
        <div style={{ minWidth: 0, opacity: item && listaValida ? 1 : 0.45, pointerEvents: item && listaValida ? 'auto' : 'none' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Descuento <b style={{ fontFamily: TYPO.fontDisplay, color: theme.accent }}>{fmtPct(r.descuentoPct, r.descuentoPct % 1 ? 1 : 0)}</b></span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>o escribe el precio neto</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
            <input className="precios-range" type="range" min={0} max={DESCUENTO_MAX} step={1} value={descuentoBarra} onChange={(e) => { setModo('descuento'); setDescuento(Number(e.target.value)); }} aria-label="Descuento"
              style={{ flex: 1, minWidth: 0, '--precios-range-track': `linear-gradient(90deg, ${theme.accent} ${(descuentoBarra / DESCUENTO_MAX) * 100}%, ${theme.border} ${(descuentoBarra / DESCUENTO_MAX) * 100}%)` }} />
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
              <span style={{ fontSize: 12, color: theme.textMuted }}>$</span>
              <CampoNumero value={modo === 'precio' && precio != null ? precio : r.precioNeto} onChange={(v) => { if (v == null) { setPrecio(null); return; } setModo('precio'); setPrecio(v); }} decimales={2} ancho={96} alto={28} acento={modo === 'precio'} ariaLabel="Precio neto" />
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
            <span style={{ fontSize: 12.5, fontWeight: 500 }}>Piezas</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', height: 28, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, overflow: 'hidden' }}>
              <button type="button" aria-label="Menos 5" onClick={() => setPiezas((p) => Math.max(0, N(p) - 5))} style={{ width: 28, height: 28, border: 0, background: 'transparent', color: theme.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Minus size={13} /></button>
              <CampoNumero value={piezas} onChange={(v) => setPiezas(v == null ? null : v)} ancho={60} alto={26} ariaLabel="Piezas" style={{ border: 0, borderRadius: 0, background: 'transparent', textAlign: 'center' }} />
              <button type="button" aria-label="Más 5" onClick={() => setPiezas((p) => N(p) + 5)} style={{ width: 28, height: 28, border: 0, background: 'transparent', color: theme.accent, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Plus size={13} /></button>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
            {dato('Precio neto', fmt2(r.precioNeto), r.descuentoPct ? `${fmtPct(r.descuentoPct, r.descuentoPct % 1 ? 1 : 0)} bajo lista` : 'a precio de lista')}
            {sensible ? dato('Margen resultante', fmtPct(r.margenPct), r.margenPct == null ? 'sin costo promedio' : r.tono === 'green' ? `arriba del mínimo (${margenMinimo} %)` : r.tono === 'red' ? 'con pérdida' : `bajo el mínimo (${margenMinimo} %)`, colorMargen) : dato('Piezas', String(r.piezas), 'en la línea')}
            {sensible && dato('Piezas', String(r.piezas), 'en la línea')}
            {sensible
              ? dato('Monto · utilidad', fmt0(r.monto), r.utilidad != null ? `utilidad ${fmt0(r.utilidad)}` : 'sin costo promedio', r.utilidad != null && r.utilidad < 0 ? theme.red : undefined)
              : dato('Monto', fmt0(r.monto), '+ IVA')}
          </div>
          {avisos.length > 0 && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {avisos.map((a, i) => (
                <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 10px', borderRadius: 8, background: `${a.tipo === 'perdida' ? theme.red : theme.orange}14`, color: a.tipo === 'perdida' ? theme.red : theme.orange, fontSize: 11.5, lineHeight: 1.4 }}>
                  <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} /><span>{a.texto}</span>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <Boton primario icon={Plus} disabled={!(r.precioNeto > 0) || !(r.piezas > 0) || guardando} onClick={agregar}>Agregar a propuesta</Boton>
          </div>
        </div>
      </div>

      {/* ── Propuesta en curso ── */}
      {lineas.length > 0 && (
        <div style={{ marginTop: 14, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ ...lbl }}>Propuesta en curso · {labelCliente(clienteKey)}{modelo?.folio ? ` · ${modelo.folio}` : ' · borrador'}</span>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{lineas.length} SKU{lineas.length === 1 ? '' : 's'} · <b style={{ color: theme.text, fontFamily: TYPO.fontDisplay }}>{fmt0(totales.monto)}</b>{sensible && totales.margenPct != null ? ` · margen ${fmtPct(totales.margenPct)}` : ''}</span>
          </div>
          <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {lineas.map((l) => (
              <div key={l.sku} style={{ display: 'grid', gridTemplateColumns: '120px 1fr auto auto auto', gap: 10, alignItems: 'center', fontSize: 12, padding: '4px 0' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{l.sku}</span>
                <span style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.descripcion}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{N(l.piezas).toLocaleString('es-MX')} pz × {fmt2(l.precio)}{l.custom ? <Pill tone="orange" size="xs" style={{ marginLeft: 6 }}>−{fmtPct(l.descuentoPct, 0)}</Pill> : null}</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmt0(N(l.piezas) * N(l.precio))}</span>
                <button type="button" onClick={() => quitar(l.sku)} title="Quitar" style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex' }}><Trash2 size={13} /></button>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
            <Boton icon={ExternalLink} onClick={() => onNavegar?.({ pagina: 'propuestas', clienteKey })}>Abrir en Propuestas</Boton>
            <span style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted }}>Es un borrador real: en Propuestas la revisas, exportas y envías.</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
