// Ficha de producto · consulta de inventario y precio para varios SKUs (canasta, en el contexto de MovilApp).
// Por SKU: descripción, marca, Disponible (v_inventario_comercial.disponible), inventario total, reservado,
// tránsito (arribo más cercano con las piezas de ESE embarque + total en camino, de v_transito_sku.embarques_detalle),
// cobertura en días (inventario / demanda ERP de 3 meses cerrados, como Inventario global) y precio de lista
// SIN IVA (v_estrategia_precios_lista) según la lista elegida. Sin lista elegida no hay precio ni compartir.
// Nunca muestra costos ni márgenes. "Compartir por WhatsApp" arma el texto con src/lib/whatsapp.js.
import React, { useMemo, useState } from 'react';
import { Trash2, Plus, Share2, Copy, Tag, Package, Ship, Search } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { textoDisponibilidad, compartir, copiar, precio as fmtPrecio, fechaCorta } from '../lib/whatsapp';
import { useNav } from './nav';
import { TituloGrande, Cabecera, ListaAgrupada, Fila, FilaDeslizable, BotonGrande, CampoBusqueda, Vacio, Skeleton, Pill, HojaM, toast } from './piezas';
import { useFichaProducto, useCatalogoBusqueda } from './datos';
import { int, MONO } from './util';
import { tonoCobertura, etiquetaCobertura } from '../modules/comercial/inventario/constantes';

const ESTATUS_CORTO = { 'TRANSITO MARITIMO': 'En el mar', 'PROXIMO A ZARPAR': 'Por zarpar', 'EN PRODUCCION': 'En producción', 'EN ESPERA DE CONSOLIDAR': 'Por consolidar', 'EN RESGUARDO': 'En resguardo', 'Pendiente modular': 'Pendiente' };

export default function FichaProducto({ raiz = false }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { canasta, agregarSku, quitarSku, limpiarCanasta } = nav;
  const [lista, setLista] = useState(null);          // obligatoria, no se recuerda entre sesiones
  const [buscando, setBuscando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  const { data, isLoading, error } = useFichaProducto(canasta);
  const items = data?.items || [];
  const listas = data?.listas || [];
  const listaValida = lista && listas.includes(lista) ? lista : null;

  const paraCompartir = useMemo(() => items.map((it) => ({ sku: it.sku, descripcion: it.descripcion, disponible: it.disponible, proximoArribo: it.proximoArribo, enCamino: it.enCamino, precio: listaValida ? it.precios[listaValida]?.precio ?? null : null })), [items, listaValida]);
  const texto = useMemo(() => (listaValida && items.length ? textoDisponibilidad(paraCompartir) : ''), [paraCompartir, listaValida, items.length]);
  const puedeCompartir = !!listaValida && items.length > 0 && !isLoading;

  const onCompartir = async () => {
    if (!puedeCompartir) return;
    const r = await compartir(texto);
    if (r === 'share') toast.ok('Compartido');
  };
  const onCopiar = async () => { if (!puedeCompartir) return; if (await copiar(texto)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };

  return (
    <>
      {!raiz && <Cabecera onVolver={nav.pop} derecha={canasta.length > 0 && <button type="button" onClick={limpiarCanasta} style={{ border: 0, background: 'transparent', color: theme.red, fontFamily: TYPO.fontText, fontSize: 15, padding: '0 10px', height: 44, cursor: 'pointer' }}>Vaciar</button>} />}
      <TituloGrande titulo="Ficha de producto" sub={canasta.length ? `${canasta.length} SKU${canasta.length === 1 ? '' : 's'} · disponibilidad, tránsito y precio de lista` : 'Disponibilidad, tránsito y precio de lista'} />

      <div style={{ padding: '0 16px 14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <BotonGrande icon={Plus} onClick={() => setBuscando(true)}>Agregar SKU</BotonGrande>
        <BotonGrande icon={Tag} onClick={() => setEligiendo(true)} style={{ color: listaValida ? theme.text : theme.orange }}>{listaValida ? listaValida : 'Elige una lista'}</BotonGrande>
      </div>

      {canasta.length === 0 && <Vacio icon={Package} color={theme.textMuted} titulo="Sin SKUs en la canasta" sub="Agrega uno o varios SKUs con el buscador; también puedes tocar un SKU desde Buscar o desde Sell In." accion={<BotonGrande primario icon={Search} onClick={() => setBuscando(true)} style={{ width: 'auto', padding: '0 22px' }}>Buscar SKU</BotonGrande>} />}
      {error && <Vacio titulo="No se pudo consultar" sub={error.message} color={theme.red} />}
      {isLoading && canasta.length > 0 && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>{canasta.map((s) => <Skeleton key={s} h={150} r={12} />)}</div>}

      {!isLoading && items.map((it) => <TarjetaSku key={it.sku} it={it} lista={listaValida} onQuitar={() => quitarSku(it.sku)} theme={theme} />)}

      {canasta.length > 0 && (
        <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {!listaValida && <div style={{ fontSize: 12.5, color: theme.orange, textAlign: 'center' }}>Elige una lista de precios para ver el precio y compartir.</div>}
          <BotonGrande primario icon={Share2} disabled={!puedeCompartir} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} disabled={!puedeCompartir} onClick={onCopiar}>Copiar texto</BotonGrande>
          {puedeCompartir && <pre style={{ margin: '4px 0 0', padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, color: theme.textMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>}
        </div>
      )}

      <HojaBuscarSku abierto={buscando} onClose={() => setBuscando(false)} onElegir={(sku) => { agregarSku(sku); setBuscando(false); }} enCanasta={canasta} theme={theme} />

      <HojaM abierto={eligiendo} onClose={() => setEligiendo(false)} titulo="Lista de precios" sub="Precio de lista sin IVA · no se guarda entre sesiones" alto="60vh">
        {canasta.length === 0 && <Vacio icon={null} titulo="Agrega un SKU primero" sub="Las listas disponibles salen de los SKUs de la canasta." />}
        {canasta.length > 0 && isLoading && <div style={{ padding: 16 }}><Skeleton h={44} r={10} /></div>}
        {listas.length > 0 && (
          <ListaAgrupada>
            {listas.map((l) => <Fila key={l} icon={Tag} color={l === listaValida ? theme.accent : theme.textSubtle || theme.textMuted} titulo={l} sub={`${items.filter((it) => it.precios[l]).length} de ${items.length} SKU con precio`} chevron={false}
              trailing={l === listaValida && <Pill tone="blue">Elegida</Pill>} onClick={() => { setLista(l); setEligiendo(false); }} />)}
          </ListaAgrupada>
        )}
        {canasta.length > 0 && !isLoading && listas.length === 0 && <Vacio icon={null} titulo="Sin precios de lista" sub="Ninguno de estos SKUs tiene precio cargado en precios_sku." />}
      </HojaM>
    </>
  );
}

function TarjetaSku({ it, lista, onQuitar, theme }) {
  const p = lista ? it.precios[lista] : null;
  const tono = tonoCobertura(it.cobertura, it.inventario);
  const dato = (k, v, sub, color) => (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
  return (
    <div style={{ margin: '0 16px 10px', borderRadius: 12, overflow: 'hidden', border: `1px solid ${theme.border}` }}>
      <FilaDeslizable acciones={[{ label: 'Quitar', icon: Trash2, color: theme.red, onClick: onQuitar }]}>
        <div style={{ padding: '12px 14px', background: theme.surface, fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>{it.sku}{it.marca && <span style={{ fontWeight: 500, fontSize: 12, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText }}>{it.marca}</span>}</div>
              <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{it.descripcion || 'Sin descripción en el roadmap'}</div>
            </div>
            <Pill tone={tono} dot style={{ flexShrink: 0 }}>{etiquetaCobertura(it.cobertura, it.inventario)}{it.cobertura != null && Number.isFinite(it.cobertura) ? ` · ${Math.round(it.cobertura)} d` : ''}</Pill>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 10, marginTop: 12 }}>
            {dato('Disponible', `${int(it.disponible)} pz`, `${int(it.inventario)} inv. · ${int(it.reservado)} res.`, it.disponible > 0 ? theme.text : theme.red)}
            {dato('Próximo arribo', it.proximoArribo ? fechaCorta(it.proximoArribo.fecha) : '—', it.proximoArribo ? `${int(it.proximoArribo.piezas)} pz · ${ESTATUS_CORTO[it.proximoArribo.estatus] || it.proximoArribo.estatus || 'PO ' + it.proximoArribo.po}` : 'sin tránsito')}
            {dato('Precio de lista', p ? fmtPrecio(p.precio) : lista ? '—' : 'Elige', p ? `+ IVA · ${p.moneda === 'PESOS' ? 'MXN' : p.moneda}` : lista ? 'sin precio en esta lista' : 'una lista', p ? theme.text : theme.orange)}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 11.5, color: theme.textMuted }}>
            <Ship size={13} />{it.enCamino > 0 ? `${int(it.enCamino)} pz en camino en ${it.embarques} embarque${it.embarques === 1 ? '' : 's'}${it.proximoArribo?.po ? ` · próximo PO ${it.proximoArribo.po}` : ''}` : 'Nada en camino'}
            {it.demandaMes > 0 && <span style={{ marginLeft: 'auto' }}>{int(it.demandaMes)} pz/mes ERP</span>}
          </div>
        </div>
      </FilaDeslizable>
    </div>
  );
}

function HojaBuscarSku({ abierto, onClose, onElegir, enCanasta, theme }) {
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
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU o descripción" autoFocus={abierto} onSubmit={() => { if (res[0]) onElegir(res[0].sku); }} />
      </div>
      {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={44} r={10} /></div>}
      {!nq && !isLoading && <Vacio icon={null} titulo="Escribe parte del SKU" sub="Por ejemplo AC-943 o “mouse”. Enter agrega el primer resultado." />}
      {nq && res.length === 0 && !isLoading && <Vacio icon={null} titulo="Sin coincidencias" />}
      {res.length > 0 && (
        <ListaAgrupada>
          {res.map((s) => {
            const ya = enCanasta.includes(s.sku);
            return <Fila key={s.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</span>} sub={s.descripcion || 'Sin descripción'} valor={<span style={{ fontFamily: MONO, fontSize: 13 }}>{int(s.disponible)}</span>} valorSub="disp." chevron={false}
              trailing={ya ? <Pill tone="gray">En canasta</Pill> : <Plus size={18} style={{ color: theme.accent }} />} onClick={ya ? undefined : () => onElegir(s.sku)} />;
          })}
        </ListaAgrupada>
      )}
    </HojaM>
  );
}
