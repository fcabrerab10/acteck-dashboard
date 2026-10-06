// Calculadora de precio y margen (celular · Estrategia de Precios · 3.82.0 · 2026-10-05).
// Buscador «que entiende» (lib/buscarSku.js) sobre el roadmap → SKU elegido: lista (v_estrategia_precios_lista vía
// precios/datos.js, la natural del cliente primero), precio de lista, costo promedio y margen de lista (sólo sensible).
// Dos formas de capturar ligadas: barra de descuento 0–40 % (range iOS) ⇄ campo de precio (CampoNumero); piezas con −/+ de 5.
// Resultado 2×2: precio neto · margen resultante (color) · piezas · monto y utilidad. Avisos en naranja: margen bajo el
// mínimo (perfiles.preferencias.precios.margenMinimo, ⚙︎ en la tarjeta) y neto por debajo de lo ya facturado a ese
// cliente (erp_ventas · Factura · último precio_unidad_pesos, una consulta chica por SKU + cliente con cachedQuery).
// Sin permiso sensible: sólo precio neto y monto, sin costo/margen/utilidad ni aviso de margen.
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Settings2, AlertTriangle, Plus, Share2, Tag, Minus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';
import { interpretarBusqueda, coincideSku, indiceSku, quitarChip } from '../../../lib/buscarSku';
import { calcular, DESCUENTO_MAX, MARGEN_MINIMO_DEFAULT } from '../../../modules/comercial/precios/calculadora';
import { ordenarListas, listaLbl } from '../../../modules/comercial/precios/textos';
import { CLIENTES, LISTA_POR_CLIENTE } from '../../../modules/comercial/propuestas/constantes';
import CampoNumero from '../../../modules/comercial/propuestas/CampoNumero';
import { ChipsEntendido } from '../sellout/DetalleSkuAnual';
import { CampoBusqueda, ListaAgrupada, Fila, HojaM, BotonGrande, Segmented, Pill } from '../../piezas';
import { money, int, MONO, N } from '../../util';
import { clienteDeLista, labelCliente } from './propuesta';

const STALE = 5 * 60 * 1000;
const fmt2 = (n) => `$${N(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(d)} %`);

/** Último precio facturado del SKU a ese cliente (erp_ventas, movimiento Factura). */
function useFacturado(clienteKey, sku) {
  return useQuery({
    queryKey: ['movil', 'precios', 'facturado', clienteKey, sku], staleTime: STALE, enabled: !!clienteKey && !!sku,
    queryFn: async () => {
      const r = await cachedQuery(supabase.from('erp_ventas').select('periodo,precio_unidad_pesos').eq('cliente_key', clienteKey).eq('articulo', sku).eq('movimiento_venta', 'Factura').gt('unidades', 0).order('periodo', { ascending: false }).limit(1));
      const f = r?.data?.[0];
      return f ? { precio: N(f.precio_unidad_pesos), fecha: String(f.periodo || '').slice(0, 10) } : null;
    },
  });
}

/**
 * @param {object} p
 * @param {Array}  p.catalogo     roadmap [{ sku, descripcion, marca, categoria, familia }]
 * @param {Map}    p.filasPorSku  sku → fila de precios/calculo.js#construirFilas ({ precios, costo, margen })
 * @param {boolean} p.sensible
 * @param {string} p.clienteKey / p.onCliente   cliente de la propuesta en curso (sincronizado con la lista natural)
 * @param {number} p.margenMinimo / p.onMargenMinimo
 * @param {Function} p.onAgregar({ sku, descripcion, marca, familia, lista, precioLista, piezas, precioNeto, descuentoPct })
 * @param {Function} p.onCompartir(sku, lista)
 * @param {string} p.skuInicial  (opcional) abre la calculadora con ese SKU
 */
export default function Calculadora({ catalogo = [], filasPorSku, sensible = false, clienteKey, onCliente, margenMinimo = MARGEN_MINIMO_DEFAULT, onMargenMinimo, onAgregar, onCompartir, skuInicial = null, cargando = false }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [sku, setSku] = useState(skuInicial || null);
  const [lista, setLista] = useState(null);
  const [eligiendoLista, setEligiendoLista] = useState(false);
  const [ajustando, setAjustando] = useState(false);
  const [modo, setModo] = useState('descuento');       // qué capturó al final: 'descuento' | 'precio'
  const [descuento, setDescuento] = useState(0);
  const [precio, setPrecio] = useState(null);
  const [piezas, setPiezas] = useState(5);

  const categorias = useMemo(() => [...new Set(catalogo.map((r) => r.categoria).filter(Boolean))], [catalogo]);
  const indice = useMemo(() => new Map(catalogo.map((r) => [r.sku, indiceSku(r)])), [catalogo]);
  const interp = useMemo(() => interpretarBusqueda(q, { categorias }), [q, categorias]);
  const resultados = useMemo(() => {
    if (interp.vacio) return [];
    const out = [];
    for (const r of catalogo) { if (coincideSku(r, interp, indice.get(r.sku))) { out.push(r); if (out.length >= 12) break; } }
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

  // Al cambiar de SKU o lista se parte del precio de lista (descuento 0).
  useEffect(() => { setDescuento(0); setPrecio(null); setModo('descuento'); }, [sku, listaValida]);

  const r = useMemo(() => calcular({
    precioLista, costo, piezas, margenMinimo,
    ...(modo === 'precio' && precio != null ? { precio } : { descuentoPct: descuento }),
    precioFacturado: facturado?.precio, facturadoFecha: facturado?.fecha, clienteLabel: labelCliente(clienteKey),
  }), [precioLista, costo, piezas, margenMinimo, modo, precio, descuento, facturado, clienteKey]);
  const avisos = sensible ? r.avisos : r.avisos.filter((a) => a.tipo === 'facturado');
  const colorMargen = { green: theme.green, orange: theme.orange, red: theme.red, gray: theme.textMuted }[r.tono] || theme.text;

  const elegir = (s) => { setSku(s); setQ(''); setLista(null); };
  const cambiarLista = (l) => {
    setLista(l); setEligiendoLista(false);
    const ck = clienteDeLista(l);
    if (ck && ck !== clienteKey) onCliente?.(ck);
  };
  const cambiarCliente = (ck) => {
    onCliente?.(ck);
    const nat = LISTA_POR_CLIENTE[ck];
    if (nat && listas.includes(nat)) setLista(nat);
  };
  const onBarra = (e) => { setModo('descuento'); setDescuento(Number(e.target.value)); };
  const onPrecio = (v) => { if (v == null) { setPrecio(null); return; } setModo('precio'); setPrecio(v); };
  const descuentoBarra = Math.min(DESCUENTO_MAX, Math.max(0, Math.round(r.descuentoPct)));

  const agregar = () => {
    if (!item || !listaValida || !(r.precioNeto > 0) || !(r.piezas > 0)) return;
    onAgregar?.({ sku: item.sku, descripcion: item.descripcion || '', marca: item.marca || '', familia: item.familia || '', lista: listaValida, precioLista, piezas: r.piezas, precioNeto: r.precioNeto, descuentoPct: r.descuentoPct });
  };

  const titulo = (t, extra) => (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{t}</span>
      {extra}
    </div>
  );
  const dato = (k, v, sub, color) => (
    <div style={{ minWidth: 0, padding: '10px 12px', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v}</div>
      {sub != null && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );

  return (
    <div data-calculadora style={{ margin: '0 16px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, padding: '12px 14px 14px', fontFamily: TYPO.fontText }}>
      {titulo('Calculadora', sensible && (
        <button type="button" onClick={() => setAjustando(true)} aria-label="Margen mínimo" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 8px', border: 0, borderRadius: 999, background: `${theme.text}0A`, color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer' }}>
          <Settings2 size={12} />mínimo {margenMinimo} %
        </button>
      ))}

      {!item && (
        <>
          <CampoBusqueda value={q} onChange={setQ} placeholder="SKU, modelo, categoría…" onSubmit={() => { if (resultados[0]) elegir(resultados[0].sku); }} />
          <div style={{ margin: '0 -16px' }}><ChipsEntendido chips={interp.chips} onQuitar={(c) => setQ(quitarChip(q, c, { categorias }))} /></div>
          {cargando && <div style={{ fontSize: 12, color: theme.textMuted, padding: '10px 2px 0' }}>Cargando precios…</div>}
          {!interp.vacio && resultados.length === 0 && !cargando && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '10px 2px 0' }}>Sin coincidencias en el roadmap.</div>}
          {resultados.length > 0 && (
            <ListaAgrupada style={{ margin: '10px 0 0' }}>
              {resultados.map((s) => {
                const f = filasPorSku?.get(s.sku);
                const nL = Object.keys(f?.precios || {}).length;
                return <Fila key={s.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</span>} sub={s.descripcion || 'Sin descripción'} chevron={false}
                  trailing={nL ? <Pill tone="blue" size="xs">{nL} lista{nL === 1 ? '' : 's'}</Pill> : <Pill tone="gray" size="xs">sin precio</Pill>} onClick={() => elegir(s.sku)} />;
              })}
            </ListaAgrupada>
          )}
          {interp.vacio && !cargando && <div style={{ fontSize: 12, color: theme.textSubtle || theme.textMuted, padding: '10px 2px 0', lineHeight: 1.4 }}>Escribe un SKU («AC-9431»), un modelo, una marca o una categoría; Enter elige el primero.</div>}
        </>
      )}

      {item && (
        <>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>{item.sku}{item.marca && <span style={{ fontWeight: 500, fontSize: 12, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText }}>{item.marca}</span>}</div>
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.descripcion || 'Sin descripción en el roadmap'}</div>
            </div>
            <button type="button" onClick={() => { setSku(null); setQ(''); }} aria-label="Cambiar SKU" style={{ flexShrink: 0, width: 30, height: 30, borderRadius: 999, border: 0, background: `${theme.text}0A`, color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><X size={15} /></button>
          </div>

          {/* Lista + cliente */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            <button type="button" onClick={() => listas.length > 0 && setEligiendoLista(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 10px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.bg, color: listaValida ? theme.accent : theme.orange, fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, cursor: 'pointer', maxWidth: '100%' }}>
              <Tag size={13} /><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{listaValida ? `Lista ${listaLbl(listaValida)}` : 'Sin precio de lista'}</span>{listas.length > 1 && <span style={{ color: theme.textMuted }}>▾</span>}
            </button>
            {sensible && costo > 0 && <span style={{ fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>costo promedio <b style={{ fontFamily: MONO, fontWeight: 600, color: theme.text }}>{fmt2(costo)}</b></span>}
          </div>
          <Segmented size="sm" value={clienteKey || ''} onChange={cambiarCliente} style={{ marginTop: 8, width: '100%', display: 'flex' }} options={CLIENTES.map((c) => ({ id: c.key, label: c.label }))} />

          {listaValida && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                {dato('Precio de lista', fmt2(precioLista), '+ IVA')}
                {sensible ? dato('Margen de lista', fmtPct(margenLista), costo > 0 ? 'sobre costo promedio' : 'sin costo promedio') : dato('Cliente', labelCliente(clienteKey), 'de la propuesta')}
              </div>

              {/* Descuento ⇄ precio */}
              <div style={{ marginTop: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
                  <span style={{ fontSize: 13, fontWeight: 500 }}>Descuento <b style={{ fontFamily: MONO, fontWeight: 600, color: theme.accent }}>{fmtPct(r.descuentoPct, r.descuentoPct % 1 ? 1 : 0)}</b></span>
                  <span style={{ fontSize: 11.5, color: theme.textMuted }}>o escribe el precio</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
                  <input className="precios-range" type="range" min={0} max={DESCUENTO_MAX} step={1} value={descuentoBarra} onChange={onBarra} aria-label="Descuento"
                    style={{ flex: 1, minWidth: 0, '--precios-range-track': `linear-gradient(90deg, ${theme.accent} ${(descuentoBarra / DESCUENTO_MAX) * 100}%, ${theme.border} ${(descuentoBarra / DESCUENTO_MAX) * 100}%)` }} />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
                    <span style={{ fontFamily: MONO, fontSize: 13, color: theme.textMuted }}>$</span>
                    <CampoNumero value={modo === 'precio' && precio != null ? precio : r.precioNeto} onChange={onPrecio} decimales={2} ancho={96} alto={36} acento={modo === 'precio'} ariaLabel="Precio neto" style={{ fontSize: 14, borderRadius: 10 }} />
                  </span>
                </div>
              </div>

              {/* Piezas */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 10 }}>
                <span style={{ fontSize: 13, fontWeight: 500 }}>Piezas</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', height: 36, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bg, overflow: 'hidden' }}>
                  <button type="button" aria-label="Menos 5" onClick={() => setPiezas((p) => Math.max(0, N(p) - 5))} style={{ width: 36, height: 36, border: 0, background: 'transparent', color: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Minus size={15} strokeWidth={2.4} /></button>
                  <CampoNumero value={piezas} onChange={(v) => setPiezas(v == null ? null : v)} ancho={64} alto={34} ariaLabel="Piezas" style={{ border: 0, borderRadius: 0, background: 'transparent', fontSize: 14, textAlign: 'center' }} />
                  <button type="button" aria-label="Más 5" onClick={() => setPiezas((p) => N(p) + 5)} style={{ width: 36, height: 36, border: 0, background: 'transparent', color: theme.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={15} strokeWidth={2.4} /></button>
                </span>
              </div>

              {/* Resultado 2×2 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12 }}>
                {dato('Precio neto', fmt2(r.precioNeto), r.descuentoPct ? `${fmtPct(r.descuentoPct, r.descuentoPct % 1 ? 1 : 0)} bajo lista` : 'a precio de lista')}
                {sensible ? dato('Margen resultante', fmtPct(r.margenPct), r.margenPct == null ? 'sin costo promedio' : r.tono === 'green' ? `arriba del mínimo (${margenMinimo} %)` : r.tono === 'red' ? 'con pérdida' : `bajo el mínimo (${margenMinimo} %)`, colorMargen) : dato('Piezas', int(r.piezas), 'en la línea')}
                {sensible && dato('Piezas', int(r.piezas), 'en la línea')}
                {sensible
                  ? dato('Monto · utilidad', `${money(r.monto)}`, r.utilidad != null ? `utilidad ${money(r.utilidad)}` : 'sin costo promedio', r.utilidad != null && r.utilidad < 0 ? theme.red : undefined)
                  : dato('Monto', money(r.monto), '+ IVA')}
              </div>

              {avisos.length > 0 && (
                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {avisos.map((a, i) => (
                    <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '9px 11px', borderRadius: 10, background: `${a.tipo === 'perdida' ? theme.red : theme.orange}14`, color: a.tipo === 'perdida' ? theme.red : theme.orange, fontSize: 12.5, lineHeight: 1.4 }}>
                      <AlertTriangle size={14} style={{ flexShrink: 0, marginTop: 1 }} /><span style={{ minWidth: 0 }}>{a.texto}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, marginTop: 12 }}>
                <BotonGrande primario icon={Plus} disabled={!(r.precioNeto > 0) || !(r.piezas > 0)} onClick={agregar}>Agregar a propuesta</BotonGrande>
                <BotonGrande icon={Share2} onClick={() => onCompartir?.(item.sku, listaValida)} style={{ width: 'auto', padding: '0 16px' }}>Compartir</BotonGrande>
              </div>
            </>
          )}
          {!listaValida && !cargando && (
            <div style={{ marginTop: 12, fontSize: 12.5, color: theme.orange, lineHeight: 1.4 }}>Este SKU no tiene precio en ninguna lista (precios_sku). Puedes compartir su disponibilidad desde la Ficha de producto.</div>
          )}
          {!listaValida && !cargando && <div style={{ marginTop: 10 }}><BotonGrande icon={Share2} onClick={() => onCompartir?.(item.sku, null)}>Compartir disponibilidad</BotonGrande></div>}
        </>
      )}

      <HojaM abierto={eligiendoLista} onClose={() => setEligiendoLista(false)} titulo="Lista de precios" sub="Precio sin IVA · la lista natural del cliente sale primero" alto="60vh">
        <ListaAgrupada>
          {listas.map((l) => {
            const ck = clienteDeLista(l);
            return <Fila key={l} icon={Tag} color={l === listaValida ? theme.accent : theme.textSubtle || theme.textMuted} titulo={listaLbl(l)} sub={ck ? `Lista natural de ${labelCliente(ck)}` : l} valor={fmt2(fila?.precios?.[l])} chevron={false}
              trailing={l === listaValida && <Pill tone="blue">Elegida</Pill>} onClick={() => cambiarLista(l)} />;
          })}
        </ListaAgrupada>
      </HojaM>

      <HojaM abierto={ajustando} onClose={() => setAjustando(false)} titulo="Margen mínimo" sub="Debajo de este margen la calculadora avisa en naranja · se guarda en tus preferencias" alto="46vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Segmented size="md" value={String(margenMinimo)} onChange={(v) => onMargenMinimo?.(Number(v))} style={{ width: '100%', display: 'flex' }} options={[10, 15, 20, 25].map((n) => ({ id: String(n), label: `${n} %` }))} />
          <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 48, padding: '8px 14px', borderRadius: 12, background: theme.surface, border: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: 15, fontWeight: 500 }}>Otro valor</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><CampoNumero value={margenMinimo} onChange={(v) => { if (v != null && v >= 0 && v <= 90) onMargenMinimo?.(v); }} ancho={72} alto={34} style={{ fontSize: 14 }} ariaLabel="Margen mínimo" /><span style={{ fontFamily: MONO, color: theme.textMuted }}>%</span></span>
          </label>
          <BotonGrande primario onClick={() => setAjustando(false)}>Listo</BotonGrande>
        </div>
      </HojaM>
    </div>
  );
}
