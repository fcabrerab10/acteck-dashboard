// Editor de propuesta (push desde Propuestas) · nueva o existente, mismo esquema que el armador de escritorio:
//   propuestas_borradores { id 'prp_…', cliente_key, cliente_label, nombre, estado 'Borrador'|'Exportada'|'Enviada',
//                           tstamp, propuesta: { sku → { piezas, precio, listaSel, descripcion, marca, familia } },
//                           resumen: { skus, piezas, total, mes }, exported_filename }
// Cliente (Segmented) · mes · lista de precios (v_estrategia_precios_lista; por defecto la lista natural del cliente y,
// como en escritorio, cada línea puede cambiar de lista o poner precio personalizado) · líneas con buscador de SKUs
// (mismo catálogo que la Ficha de producto; piezas por defecto = promedio de sell-out de los 3 meses cerrados, como
// escritorio) · total al pie · Guardar borrador · "Exportar y enviar": MISMO Excel que escritorio
// (modules/comercial/propuestas/excelPropuesta.js) compartido con src/lib/compartirArchivo.js → estado Enviada.
// Una propuesta ya exportada/enviada abre en modo detalle (resumen + líneas + compartir de nuevo) con "Editar".
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Share2, Save, Tag, Pencil, ClipboardList, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { supabase } from '../../lib/supabase';
import { cachedQuery } from '../../lib/queries';
import { CLIENTES, MES_LABEL, MES_FULL, mesesCerrados, nuevaPropuestaId, LISTA_POR_CLIENTE, listaShort, listaColor } from '../../modules/comercial/propuestas/constantes';
import { fetchSellout } from '../../modules/comercial/propuestas/datos';
import { propuestaExcelBlob } from '../../modules/comercial/propuestas/excelPropuesta';
import { compartirArchivo, puedeCompartirArchivos } from '../../lib/compartirArchivo';
import { useNav } from '../nav';
import { TituloGrande, Cabecera, HeroM, ListaAgrupada, Fila, BotonGrande, CampoBusqueda, Segmented, Vacio, Skeleton, Pill, HojaM, toast } from '../piezas';
import { useCatalogoBusqueda, colorCliente } from '../datos';
import { money, int, MONO, N } from '../util';
import { CampoCantidad } from './SOPExport';

export const QK_PROPUESTAS = ['movil', 'propuestas'];
export const TONO_ESTADO = { Borrador: 'gray', Exportada: 'green', Enviada: 'blue' };
const STALE = 5 * 60 * 1000;
const mesKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const labelMes = (k) => { const [a, m] = String(k || '').split('-').map(Number); return a && m ? `${MES_FULL[m - 1]} ${a}` : '—'; };
const fmtPrecio = (n) => `$${Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Datos de los SKUs de la propuesta: descripción/marca/familia (roadmap) + precios por lista + inventario comercial ──
function useSkusPropuesta(skus) {
  const lista = [...skus].sort();
  return useQuery({
    queryKey: ['movil', 'propuesta-skus', lista], staleTime: STALE, enabled: lista.length > 0,
    queryFn: async () => {
      const [rm, pr, inv] = await Promise.all([
        cachedQuery(supabase.from('roadmap_sku').select('sku,descripcion,marca,familia').in('sku', lista)),
        cachedQuery(supabase.from('v_estrategia_precios_lista').select('sku,lista,precio').in('sku', lista)),
        cachedQuery(supabase.from('v_inventario_comercial').select('sku,inventario').in('sku', lista)),
      ]);
      const meta = new Map((rm.data || []).map((r) => [r.sku, { descripcion: r.descripcion || '', marca: r.marca || '', familia: r.familia || '' }]));
      const precios = new Map();
      (pr.data || []).forEach((r) => { if (!precios.has(r.sku)) precios.set(r.sku, {}); precios.get(r.sku)[r.lista] = N(r.precio); });
      const inventario = new Map();
      (inv.data || []).forEach((r) => inventario.set(r.sku, (inventario.get(r.sku) || 0) + N(r.inventario)));
      return { meta, precios, inventario };
    },
  });
}

// ── Sell-out del cliente en los 3 meses cerrados → promedio mensual por SKU (piezas por defecto, como escritorio) ──
function useSelloutCliente(clienteKey, enabled) {
  return useQuery({
    queryKey: ['movil', 'propuesta-sellout', clienteKey], staleTime: STALE, enabled: !!clienteKey && enabled,
    queryFn: async () => {
      const mm = mesesCerrados();
      const rows = await fetchSellout(clienteKey, mm, Math.min(...mm.map((m) => m.anio)), Math.max(...mm.map((m) => m.anio)));
      const m = new Map();
      rows.forEach((r) => m.set(r.sku, (m.get(r.sku) || 0) + N(r.cantidad)));
      m.forEach((v, k) => m.set(k, Math.round(v / 3)));
      return m;
    },
  });
}

export default function PropuestaEditor({ id }) {
  const { theme } = useTheme();
  const nav = useNav();
  const qc = useQueryClient();
  const [propId] = useState(() => id || nuevaPropuestaId());
  const { data: row, isLoading: cargandoRow, error: errorRow } = useQuery({
    queryKey: ['movil', 'propuesta', id], enabled: !!id, staleTime: 0,
    queryFn: async () => { const { data, error } = await supabase.from('propuestas_borradores').select('*').eq('id', id).single(); if (error) throw error; return data; },
  });

  const hoy = useMemo(() => new Date(), []);
  const mesesOpc = useMemo(() => [hoy, new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1)].map((d) => ({ id: mesKey(d), label: `${MES_LABEL[d.getMonth()]} ${d.getFullYear()}` })), [hoy]);
  const [cargado, setCargado] = useState(!id);
  const [modo, setModo] = useState('editar');          // 'editar' | 'detalle'
  const [clienteKey, setClienteKey] = useState('digitalife');
  const [nombre, setNombre] = useState('Cierre');
  const [mes, setMes] = useState(mesKey(hoy));
  const [lista, setLista] = useState(LISTA_POR_CLIENTE.digitalife);
  const [lineas, setLineas] = useState({});            // sku → { piezas, precio, listaSel, descripcion, marca, familia }
  const [estado, setEstado] = useState('Borrador');
  const [exportado, setExportado] = useState(null);    // exported_filename
  const [buscando, setBuscando] = useState(false);
  const [eligiendoLista, setEligiendoLista] = useState(null); // 'todas' | sku
  const [ocupado, setOcupado] = useState(false);
  const [sucio, setSucio] = useState(false);
  const xlsxListo = useRef(false);

  // Carga de una propuesta existente (una sola vez).
  useEffect(() => {
    if (!row || cargado) return;
    setClienteKey(row.cliente_key || 'digitalife');
    setNombre(row.nombre || 'Cierre');
    setMes(row.resumen?.mes && /^\d{4}-\d{2}$/.test(row.resumen.mes) ? row.resumen.mes : mesKey(new Date(N(row.tstamp) || Date.now())));
    const ls = row.propuesta && typeof row.propuesta === 'object' ? row.propuesta : {};
    const limpias = {};
    Object.entries(ls).forEach(([sku, v]) => { if (sku && v && typeof v === 'object') limpias[sku] = { ...v, sku, piezas: N(v.piezas), precio: N(v.precio), listaSel: v.listaSel || '' }; });
    setLineas(limpias);
    const primera = Object.values(limpias).map((v) => v.listaSel).find((l) => l && l !== '__custom');
    setLista(primera || LISTA_POR_CLIENTE[row.cliente_key] || LISTA_POR_CLIENTE.digitalife);
    setEstado(row.estado || 'Borrador');
    setExportado(row.exported_filename || null);
    setModo(row.estado && row.estado !== 'Borrador' ? 'detalle' : 'editar');
    setCargado(true);
  }, [row, cargado]);
  useEffect(() => { if (cargado && modo === 'editar' && !xlsxListo.current) import('xlsx-js-style').then(() => { xlsxListo.current = true; }).catch(() => {}); }, [cargado, modo]);

  const skus = useMemo(() => Object.keys(lineas), [lineas]);
  const { data: info } = useSkusPropuesta(skus);
  const { data: sellout } = useSelloutCliente(clienteKey, cargado && modo === 'editar');
  const cli = CLIENTES.find((c) => c.key === clienteKey) || CLIENTES[0];
  const color = colorCliente(clienteKey, theme);

  const listasDisponibles = useMemo(() => {
    const s = new Set();
    if (info) info.precios.forEach((p) => Object.keys(p).forEach((l) => s.add(l)));
    s.add(LISTA_POR_CLIENTE[clienteKey] || lista);
    return [...s].sort();
  }, [info, clienteKey, lista]);

  const propuestaLista = useMemo(() => Object.values(lineas).map((v) => {
    const m = info?.meta.get(v.sku) || {};
    return { ...v, descripcion: v.descripcion || m.descripcion || '', marca: v.marca || m.marca || '', familia: v.familia || m.familia || '' };
  }), [lineas, info]);
  const total = propuestaLista.reduce((s, r) => s + N(r.piezas) * N(r.precio), 0);
  const piezas = propuestaLista.reduce((s, r) => s + N(r.piezas), 0);

  const precioDe = (sku, l) => { const p = info?.precios.get(sku) || {}; if (l && p[l] != null) return { lista: l, precio: p[l] }; const k = Object.keys(p)[0]; return k ? { lista: k, precio: p[k] } : { lista: '', precio: 0 }; };
  const editar = (sku, cambios) => { setLineas((prev) => (prev[sku] ? { ...prev, [sku]: { ...prev[sku], ...cambios } } : prev)); setSucio(true); };
  const quitar = (sku) => { setLineas((prev) => { const n = { ...prev }; delete n[sku]; return n; }); setSucio(true); };
  const agregar = (s) => {
    if (lineas[s.sku]) return;
    const { lista: l, precio } = precioDe(s.sku, lista);
    setLineas((prev) => ({ ...prev, [s.sku]: { sku: s.sku, piezas: Math.max(1, sellout?.get(s.sku) || 1), precio, listaSel: l, descripcion: s.descripcion || '', marca: s.marca || '', familia: s.familia || '' } }));
    setSucio(true);
  };
  // Al llegar precios/meta de un SKU recién agregado (o al cambiar de cliente), completa las líneas que quedaron en 0 / sin lista.
  useEffect(() => {
    if (!info) return;
    setLineas((prev) => {
      let cambio = false; const n = { ...prev };
      Object.values(prev).forEach((v) => {
        const m = info.meta.get(v.sku);
        const p = info.precios.get(v.sku) || {};
        const upd = {};
        if (v.listaSel !== '__custom' && (!v.listaSel || !(v.precio > 0)) && Object.keys(p).length) { const r = precioDe(v.sku, lista); upd.listaSel = r.lista; upd.precio = r.precio; }
        if (m && (!v.descripcion || !v.familia)) { upd.descripcion = v.descripcion || m.descripcion; upd.marca = v.marca || m.marca; upd.familia = v.familia || m.familia; }
        if (Object.keys(upd).length) { n[v.sku] = { ...v, ...upd }; cambio = true; }
      });
      return cambio ? n : prev;
    });
  }, [info]); // eslint-disable-line react-hooks/exhaustive-deps
  const cambiarLista = (l) => {
    setLista(l);
    setLineas((prev) => { const n = {}; Object.values(prev).forEach((v) => { const p = info?.precios.get(v.sku) || {}; n[v.sku] = v.listaSel === '__custom' || p[l] == null ? v : { ...v, listaSel: l, precio: p[l] }; }); return n; });
    setSucio(true);
  };
  const cambiarCliente = (k) => { setClienteKey(k); const l = LISTA_POR_CLIENTE[k]; if (l) cambiarLista(l); setSucio(true); };

  const guardar = async (estadoNuevo, extra = {}) => {
    const fila = {
      id: propId, cliente_key: clienteKey, cliente_label: cli.label, nombre: (nombre || 'Cierre').trim() || 'Cierre', estado: estadoNuevo, tstamp: Date.now(),
      propuesta: Object.fromEntries(Object.entries(lineas).map(([k, v]) => [k, { piezas: N(v.piezas), precio: N(v.precio), listaSel: v.listaSel || '', descripcion: v.descripcion || '', marca: v.marca || '', familia: v.familia || '' }])),
      resumen: { skus: propuestaLista.length, piezas, total, mes }, updated_at: new Date().toISOString(), ...extra,
    };
    const { error } = await supabase.from('propuestas_borradores').upsert(fila, { onConflict: 'id' });
    if (error) throw error;
    setEstado(estadoNuevo); setSucio(false);
    qc.invalidateQueries({ queryKey: QK_PROPUESTAS });
    qc.setQueryData(['movil', 'propuesta', propId], (old) => ({ ...(old || {}), ...fila }));
  };
  const onGuardar = async () => {
    if (!propuestaLista.length) { toast.error('Agrega al menos un SKU'); return; }
    setOcupado(true);
    try { await guardar('Borrador'); toast.ok('Borrador guardado'); }
    catch (e) { toast.error(`No se pudo guardar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  const exportar = async () => {
    if (!propuestaLista.length) { toast.error('La propuesta está vacía'); return; }
    if (propuestaLista.some((r) => !(r.precio > 0))) { toast.error('Hay líneas sin precio'); return; }
    setOcupado(true);
    try {
      const { blob, filename } = await propuestaExcelBlob({ cliente: cli, propuestaLista, nombre });
      const r = await compartirArchivo(blob, filename, { titulo: filename, texto: `Propuesta ${cli.label} · ${propuestaLista.length} SKUs · ${money(total)}` });
      if (!r) { toast.info('Se canceló el envío'); return; }
      const nuevo = r === 'share' || estado === 'Enviada' ? 'Enviada' : 'Exportada';
      await guardar(nuevo, { exported_filename: filename });
      setExportado(filename); setModo('detalle');
      toast.ok(r === 'share' ? 'Propuesta enviada' : 'Excel descargado · propuesta exportada');
    } catch (e) {
      toast.error(`No se pudo exportar: ${e?.message || e}`);
    } finally { setOcupado(false); }
  };

  if (id && (cargandoRow || !cargado) && !errorRow) {
    return (<><Cabecera onVolver={nav.pop} etiqueta="Propuestas" /><TituloGrande titulo="Propuesta" sub="Cargando…" /><div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={140} r={12} /><Skeleton h={220} r={12} /></div></>);
  }
  if (errorRow) return (<><Cabecera onVolver={nav.pop} etiqueta="Propuestas" /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se encontró la propuesta" sub={errorRow.message} /></>);

  const soporteShare = puedeCompartirArchivos(new Blob([''], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'x.xlsx');
  const subTitulo = <><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />{cli.label} · {labelMes(mes)} · <Pill tone={TONO_ESTADO[estado] || 'gray'} size="xs">{estado}</Pill></>;

  // ── Detalle (exportada / enviada) ──
  if (modo === 'detalle') {
    return (
      <>
        <Cabecera onVolver={nav.pop} etiqueta="Propuestas" derecha={<button type="button" onClick={() => setModo('editar')} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 44, padding: '0 10px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}><Pencil size={15} />Editar</button>} />
        <TituloGrande titulo={nombre || 'Cierre'} sub={subTitulo} />
        <HeroM eyebrow={`Propuesta ${cli.label}`} frase={money(total)} sub={exportado ? `Excel: ${exportado}` : 'Todavía no se ha exportado el Excel'}
          stats={[{ k: 'SKUs', v: int(propuestaLista.length) }, { k: 'Piezas', v: int(piezas) }, { k: 'Precio prom.', v: piezas > 0 ? money(total / piezas) : '—', sub: 'por pieza' }]} />
        <ListaAgrupada titulo="Líneas" meta={propuestaLista.length} style={{ marginTop: 18 }}>
          {propuestaLista.length === 0 && <Vacio icon={null} titulo="Sin líneas" style={{ padding: '22px 16px' }} />}
          {propuestaLista.map((r) => <Fila key={r.sku} chevron={false} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{r.sku}</span>} sub={r.descripcion || 'Sin descripción'} valor={money(N(r.piezas) * N(r.precio))} valorSub={`${int(r.piezas)} × ${fmtPrecio(r.precio)}`} />)}
        </ListaAgrupada>
        <div style={{ padding: '16px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BotonGrande primario icon={Share2} disabled={ocupado || !propuestaLista.length} onClick={exportar}>{ocupado ? 'Generando…' : soporteShare ? 'Compartir de nuevo' : 'Descargar Excel de nuevo'}</BotonGrande>
          <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', lineHeight: 1.4 }}>Genera el mismo Excel que la computadora (hoja Resumen{clienteKey === 'digitalife' ? ' + Monitores / Sillas / Otras familias' : ' + Propuesta'}) y abre la hoja para mandarlo por WhatsApp o correo.</div>
        </div>
      </>
    );
  }

  // ── Editor ──
  const tituloVista = id ? (nombre || 'Cierre') : 'Nueva propuesta';
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Propuestas" derecha={sucio ? <Pill tone="orange" size="xs">Sin guardar</Pill> : null} />
      <TituloGrande titulo={tituloVista} sub={subTitulo} />

      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Segmented size="md" value={clienteKey} onChange={cambiarCliente} style={{ width: '100%', display: 'flex' }} options={CLIENTES.map((c) => ({ id: c.key, label: c.label }))} />
        <ListaAgrupada>
          <label style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 52, padding: '8px 12px' }}>
            <span style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em', flexShrink: 0 }}>Nombre</span>
            <input value={nombre} onChange={(e) => { setNombre(e.target.value); setSucio(true); }} placeholder="Cierre" autoCapitalize="sentences" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 16, color: theme.accent, textAlign: 'right' }} />
          </label>
          <Fila titulo="Mes" chevron={false} trailing={<Segmented value={mes} onChange={(m) => { setMes(m); setSucio(true); }} options={mesesOpc} />} />
          <Fila icon={Tag} color={listaColor(lista)} titulo={lista} sub={`Lista de precios · ${listasDisponibles.length} disponible${listasDisponibles.length === 1 ? '' : 's'} para estos SKUs`} onClick={() => setEligiendoLista('todas')} />
        </ListaAgrupada>
        <BotonGrande icon={Plus} onClick={() => setBuscando(true)}>{propuestaLista.length ? 'Agregar otro SKU' : 'Agregar SKU'}</BotonGrande>
      </div>

      {propuestaLista.length === 0 && <Vacio icon={ClipboardList} color={theme.textMuted} titulo="Sin líneas todavía" sub="Busca un SKU: la línea toma las piezas del sell-out promedio de 3 meses y el precio de la lista elegida; puedes editar ambos." style={{ padding: '24px 20px 8px' }} />}
      {propuestaLista.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '16px 28px 6px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>Líneas <span style={{ fontFamily: MONO, letterSpacing: 0, textTransform: 'none', fontWeight: 500 }}>{propuestaLista.length}</span></span>
          <span style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted }}>Piezas y precio editables</span>
        </div>
      )}
      {propuestaLista.map((r) => (
        <div key={r.sku} style={{ margin: '0 16px 10px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface }}>
            <div style={{ padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15.5, fontWeight: 600, letterSpacing: '-0.015em' }}>{r.sku}{r.marca && <span style={{ fontWeight: 500, fontSize: 12, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText }}>{r.marca}</span>}</div>
                  <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{r.descripcion || 'Sin descripción'}</div>
                  <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, marginTop: 3 }}>{info?.inventario.has(r.sku) ? `${int(info.inventario.get(r.sku))} pz en inventario` : ''}{sellout?.get(r.sku) ? ` · ${int(sellout.get(r.sku))} pz/mes sell-out` : ''}</div>
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{money(N(r.piezas) * N(r.precio))}</div>
                  <button type="button" onClick={() => quitar(r.sku)} aria-label="Quitar" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 26, padding: '0 6px', marginRight: -6, border: 0, background: 'transparent', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12, cursor: 'pointer' }}><Trash2 size={13} />Quitar</button>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
                <CampoCantidad value={N(r.piezas)} onChange={(v) => editar(r.sku, { piezas: v })} min={1} ancho={128} />
                <PrecioLinea r={r} theme={theme} onPrecio={(p) => editar(r.sku, { precio: p, listaSel: '__custom' })} onLista={() => setEligiendoLista(r.sku)} />
              </div>
            </div>
        </div>
      ))}

      {propuestaLista.length > 0 && (
        <div style={{ margin: '6px 16px 0', padding: '12px 14px', borderRadius: 12, background: theme.surfaceInverse || theme.surfaceDark, color: theme.textOnInverse || theme.textOnDark, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: 12, opacity: 0.7 }}>{int(propuestaLista.length)} SKUs · {int(piezas)} pz{piezas > 0 ? ` · ${money(total / piezas)} prom.` : ''}</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums' }}>{money(total)}</div>
        </div>
      )}
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        <BotonGrande primario icon={Share2} disabled={ocupado || !propuestaLista.length} onClick={exportar}>{ocupado ? 'Generando…' : soporteShare ? 'Exportar y enviar' : 'Exportar Excel'}</BotonGrande>
        <BotonGrande icon={Save} disabled={ocupado || !propuestaLista.length} onClick={onGuardar}>Guardar borrador</BotonGrande>
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', lineHeight: 1.4 }}>Se exportará como <b>Propuesta {cli.label} {(nombre || 'Cierre').trim()} {MES_FULL[hoy.getMonth()]} {hoy.getFullYear()}.xlsx</b>, el mismo Excel que la computadora. Al compartirlo la propuesta queda como Enviada.</div>
      </div>

      <HojaBuscarSkuProp abierto={buscando} onClose={() => setBuscando(false)} enLineas={skus} theme={theme} onElegir={(s) => { agregar(s); setBuscando(false); }} />

      <HojaM abierto={!!eligiendoLista} onClose={() => setEligiendoLista(null)} titulo={eligiendoLista === 'todas' ? 'Lista de precios' : `Precio de ${eligiendoLista}`} sub={eligiendoLista === 'todas' ? 'Aplica a todas las líneas sin precio personalizado' : 'Elige la lista para esta línea'} alto="62vh">
        {eligiendoLista === 'todas' && (
          <ListaAgrupada pie="Precios sin IVA de v_estrategia_precios_lista (los mismos que Estrategia de precios y el armador de escritorio).">
            {listasDisponibles.map((l) => <Fila key={l} icon={Tag} color={listaColor(l)} titulo={l} sub={info ? `${propuestaLista.filter((r) => info.precios.get(r.sku)?.[l] != null).length} de ${propuestaLista.length} SKU con precio` : listaShort(l)} chevron={false}
              trailing={l === lista && <Pill tone="blue">Elegida</Pill>} onClick={() => { cambiarLista(l); setEligiendoLista(null); }} />)}
          </ListaAgrupada>
        )}
        {eligiendoLista && eligiendoLista !== 'todas' && (
          <ListaAgrupada>
            {Object.entries(info?.precios.get(eligiendoLista) || {}).map(([l, p]) => <Fila key={l} icon={Tag} color={listaColor(l)} titulo={l} valor={fmtPrecio(p)} chevron={false}
              trailing={lineas[eligiendoLista]?.listaSel === l && <Pill tone="blue">Elegida</Pill>} onClick={() => { editar(eligiendoLista, { listaSel: l, precio: p }); setEligiendoLista(null); }} />)}
            {Object.keys(info?.precios.get(eligiendoLista) || {}).length === 0 && <Vacio icon={null} titulo="Sin precios de lista" sub="Este SKU no tiene precio en precios_sku; captura uno personalizado." />}
            <Fila icon={Pencil} color={theme.orange} titulo="Personalizado" sub="Escribe el precio directamente en la línea" chevron={false} trailing={lineas[eligiendoLista]?.listaSel === '__custom' && <Pill tone="orange">Actual</Pill>} onClick={() => { editar(eligiendoLista, { listaSel: '__custom' }); setEligiendoLista(null); }} />
          </ListaAgrupada>
        )}
      </HojaM>
    </>
  );
}

/** Precio unitario editable (sin IVA) con chip de la lista; tocar el chip cambia la lista de esa línea. */
function PrecioLinea({ r, theme, onPrecio, onLista }) {
  const [txt, setTxt] = useState(String(r.precio ?? ''));
  useEffect(() => { setTxt(N(r.precio) ? String(N(r.precio)) : ''); }, [r.precio]);
  const custom = r.listaSel === '__custom';
  const chip = custom ? 'CUSTOM' : listaShort(r.listaSel || '') || '—';
  const chipColor = custom ? theme.orange : listaColor(r.listaSel);
  const commit = () => { const n = Number(String(txt).replace(/[^0-9.]/g, '')) || 0; if (n !== N(r.precio)) onPrecio(n); else setTxt(N(r.precio) ? String(N(r.precio)) : ''); };
  return (
    <span style={{ flex: 1, display: 'inline-flex', alignItems: 'center', height: 40, borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bg, overflow: 'hidden', minWidth: 0 }}>
      <span style={{ paddingLeft: 10, color: theme.textMuted, fontFamily: MONO, fontSize: 13 }}>$</span>
      <input inputMode="decimal" value={txt} onChange={(e) => setTxt(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') { commit(); e.currentTarget.blur(); } }} placeholder="0.00"
        style={{ flex: 1, minWidth: 0, width: 40, border: 0, outline: 'none', background: 'transparent', padding: '0 6px', fontFamily: MONO, fontSize: 15, fontWeight: 600, color: r.precio > 0 ? theme.text : theme.red, fontVariantNumeric: 'tabular-nums' }} />
      <button type="button" onClick={onLista} style={{ height: 40, padding: '0 10px', border: 0, borderLeft: `1px solid ${theme.border}`, background: `${chipColor}18`, color: chipColor, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 700, letterSpacing: '0.04em', cursor: 'pointer', flexShrink: 0 }}>{chip} ▾</button>
    </span>
  );
}

/** Buscador de SKUs · mismo catálogo que la Ficha de producto (roadmap_sku + disponible comercial). */
function HojaBuscarSkuProp({ abierto, onClose, onElegir, enLineas, theme }) {
  const [q, setQ] = useState('');
  const { data: catalogo, isLoading } = useCatalogoBusqueda(abierto);
  const nq = q.trim().toLowerCase();
  const res = useMemo(() => {
    if (!nq || !catalogo) return [];
    const terms = nq.split(/\s+/);
    return catalogo.filter((s) => { const t = `${s.sku} ${s.descripcion} ${s.marca}`.toLowerCase(); return terms.every((w) => t.includes(w)); })
      .sort((a, b) => (b.sku.toLowerCase().startsWith(nq) - a.sku.toLowerCase().startsWith(nq)) || b.disponible - a.disponible).slice(0, 25);
  }, [nq, catalogo]);
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Agregar SKU" alto="86vh">
      <div style={{ padding: '0 16px 12px' }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU o descripción" autoFocus={abierto} onSubmit={() => { if (res[0]) onElegir(res[0]); }} />
      </div>
      {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={44} r={10} /></div>}
      {!nq && !isLoading && <Vacio icon={null} titulo="Escribe parte del SKU" sub="Por ejemplo AC-943 o “mouse”. Enter agrega el primer resultado." />}
      {nq && res.length === 0 && !isLoading && <Vacio icon={null} titulo="Sin coincidencias" />}
      {res.length > 0 && (
        <ListaAgrupada>
          {res.map((s) => {
            const ya = enLineas.includes(s.sku);
            return <Fila key={s.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</span>} sub={s.descripcion || 'Sin descripción'} valor={<span style={{ fontFamily: MONO, fontSize: 13 }}>{int(s.disponible)}</span>} valorSub="disp." chevron={false}
              trailing={ya ? <Pill tone="gray">En la propuesta</Pill> : <Plus size={18} style={{ color: theme.accent }} />} onClick={ya ? undefined : () => onElegir(s)} />;
          })}
        </ListaAgrupada>
      )}
    </HojaM>
  );
}
