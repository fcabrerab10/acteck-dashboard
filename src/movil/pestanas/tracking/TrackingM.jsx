// Tracking de pedidos en el celular · V2 compacta (2026-10-05, nodo global `ordenesCompra`).
//
//   Hero con la frase del mes (OCs abiertas · detenidas · piezas surtibles hoy) + FrescuraPill del ERP
//   → 4 KPIs (fill rate 90 d · días a entrega vs meta · backorder · monto abierto)
//   → «Surtir hoy» (OCs con stock completo; compartir la lista)
//   → embudo por etapa: una fila tocable por etapa que FILTRA la lista
//   → lista de pedidos agrupada por cliente (número · etapa · días · monto) con buscador y chips de cliente;
//     deslizar a la izquierda = Registrar envío (si puede editar) · Compartir estatus; tocar = ficha (push).
//
// Sólo consulta: no hay captura de OCs ni cotizaciones aquí (eso sigue en la web). La única escritura es
// «Registrar envío», que reusa HojaEnvio de ./hojas.jsx. Toda la lógica es la MISMA de la web:
// tracking/datos.js (useTrackingDatos), tracking/calculo.js (calcularTodo · resumen · surtirHoy · backorderPorSku ·
// ordenar · textoBusqueda) y tracking/textos.js (formatos y textos de WhatsApp). Aquí sólo hay layout táctil.
//
// `TrackingMVista` es pura (recibe filas ya calculadas): la renderiza scripts/test-movil-tracking-inventario-ssr.mjs.
import React, { useMemo, useState } from 'react';
import { Share2, Truck, PackageCheck, Package, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { compartir } from '../../../lib/whatsapp';
import { EASE, DUR } from '../../../lib/motion';
import { Cargando } from '../../../components/kit';
import FrescuraPill from '../../../components/FrescuraPill';
import { useTrackingDatos } from '../../../modules/comercial/tracking/datos';
import {
  calcularTodo, resumen as calcResumen, backorderPorSku, surtirHoy as calcSurtir, ordenar, textoBusqueda, coincide, fraseHero,
} from '../../../modules/comercial/tracking/calculo';
import {
  ETAPAS, ETAPA_LABEL, ETAPA_TONE, META_ENTREGA, CLIENTES, fmtInt, fmtPct, fmtDias, fmtFecha, fmtMoneyShort,
  nombreCliente, tokens as toks, textoEstatusOC, textoListaSurtir,
} from '../../../modules/comercial/tracking/textos';
import { useNav } from '../../nav';
import {
  TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, FilaDeslizable, Cabecera, CampoBusqueda, Segmented, Vacio, HojaM, Pill, toast,
} from '../../piezas';
import { ChipM } from '../agenda/comun';
import { colorCliente } from '../../datos';
import { MONO } from '../../util';
import { HojaEnvio } from './hojas';
import FichaOC from './FichaOC';

const SEGMENTOS = [{ id: 'abiertas', label: 'Abiertas' }, { id: 'detenidas', label: 'Detenidas' }, { id: 'entregadas', label: 'Entregadas' }];
const CHIPS = [{ key: 'todos', nombre: 'Todos' }, ...CLIENTES.map((c) => ({ key: c.key, nombre: c.nombre }))];
const MAX_SURTIR = 5;

const pasaSegmento = (o, seg) => (seg === 'detenidas' ? o.detenida : seg === 'entregadas' ? !o.abierta && o.etapa === 'entregada' : o.abierta);

/** Embudo: por etapa, cuántas OCs están HOY en esa etapa (abiertas) y su monto. Entregada = cerradas. */
export function embudoHoy(filas) {
  const max = { n: 0 };
  const etapas = ETAPAS.map((etapa) => {
    const items = filas.filter((o) => o.etapa === etapa && (etapa === 'entregada' ? !o.abierta : o.abierta));
    const r = { etapa, n: items.length, monto: items.reduce((s, o) => s + (Number(o.monto) || 0), 0), detenidas: items.filter((o) => o.detenida).length };
    if (r.n > max.n) max.n = r.n;
    return r;
  });
  return etapas.map((e) => ({ ...e, ancho: max.n ? (e.n / max.n) * 100 : 0 }));
}

/** Fila de pedido dentro de la lista agrupada por cliente. */
function FilaPedido({ oc, onAbrir, onEnvio, onCompartir }) {
  const { theme } = useTheme();
  const dias = oc.diasEnEtapa != null ? `${Math.round(oc.diasEnEtapa)} d` : '—';
  const sub = oc.esCotizacion
    ? [oc.fechaEtapa ? fmtFecha(oc.fechaEtapa) : null, oc.pedido ? `${fmtInt(oc.pedido)} pz` : null, 'cotización'].filter(Boolean).join(' · ')
    : [oc.fecha_recibida ? `rec. ${fmtFecha(oc.fecha_recibida)}` : null, `${fmtInt(oc.pedido)} pz`, oc.pedido ? `fill ${fmtPct(oc.fill)}` : null].filter(Boolean).join(' · ');
  const acciones = [];
  if (onEnvio && !oc.esCotizacion && oc.abierta) acciones.push({ label: 'Envío', color: theme.accent, icon: Truck, onClick: () => onEnvio(oc) });
  if (onCompartir) acciones.push({ label: 'Compartir', color: theme.green, icon: Share2, onClick: () => onCompartir(oc) });
  const fila = (
    <Fila alto={60} tono={oc.detenida ? theme.red : colorCliente(oc.cliente_key, theme)} onClick={() => onAbrir?.(oc)}
      titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontFamily: MONO, fontWeight: 600 }}>{oc.esCotizacion ? '' : 'OC '}{oc.numero_oc_cliente}</span>
        <Pill tone={ETAPA_TONE[oc.etapa] || 'gray'} size="xs">{ETAPA_LABEL[oc.etapa] || oc.etapa}</Pill>
        {oc.surtibleHoy && <Pill tone="green" size="xs">surtible</Pill>}
      </span>}
      sub={sub}
      valor={fmtMoneyShort(oc.monto)}
      valorSub={<span style={{ color: oc.detenida ? theme.red : undefined }}>{dias}{oc.detenida ? ' · detenida' : ''}</span>} />
  );
  return acciones.length ? <FilaDeslizable acciones={acciones}>{fila}</FilaDeslizable> : fila;
}

/**
 * Vista pura. filas = calcularTodo(datos, hoy) · res = resumen(filas, hoy) · surtir = surtirHoy(filas) ·
 * backorder = backorderPorSku(filas). Callbacks opcionales: onAbrir(oc) · onEnvio(oc) · onCompartir(oc) · onCompartirSurtir(lista).
 */
export function TrackingMVista({ filas = [], res, surtir = [], backorder = [], hoy = new Date(), onAbrir, onEnvio, onCompartir, onCompartirSurtir, frescura = null, onVolver }) {
  const { theme } = useTheme();
  const [segmento, setSegmento] = useState('abiertas');
  const [etapaSel, setEtapaSel] = useState(null);
  const [cliente, setCliente] = useState('todos');
  const [q, setQ] = useState('');
  const [verSurtir, setVerSurtir] = useState(false);
  const [hojaBO, setHojaBO] = useState(false);

  const t = useMemo(() => toks(q), [q]);
  // Base = cliente + búsqueda (lo que comparten embudo, surtir y lista).
  const base = useMemo(() => filas.filter((o) => {
    if (cliente !== 'todos' && o.cliente_key !== cliente) return false;
    if (t.length && !coincide(o._hay || (o._hay = textoBusqueda(o)), t)) return false;
    return true;
  }), [filas, cliente, t]);
  const embudo = useMemo(() => embudoHoy(base), [base]);
  const porId = useMemo(() => new Map(base.map((o) => [o.id, o])), [base]);
  const surtirVisibles = useMemo(() => surtir.filter((s) => porId.has(s.id)), [surtir, porId]);
  const visibles = useMemo(() => ordenar(base.filter((o) => pasaSegmento(o, segmento) && (!etapaSel || o.etapa === etapaSel))), [base, segmento, etapaSel]);
  const grupos = useMemo(() => {
    const m = new Map();
    for (const o of visibles) { if (!m.has(o.cliente_key)) m.set(o.cliente_key, []); m.get(o.cliente_key).push(o); }
    return [...m.entries()].map(([ck, items]) => ({ ck, items })).sort((a, b) => b.items.length - a.items.length);
  }, [visibles]);

  const elegirEtapa = (etapa) => {
    if (etapaSel === etapa) { setEtapaSel(null); return; }
    setEtapaSel(etapa);
    setSegmento(etapa === 'entregada' ? 'entregadas' : 'abiertas');
  };
  const deltaDias = res.diasEntrega != null && res.diasEntregaPrev != null ? res.diasEntrega - res.diasEntregaPrev : null;
  const vacioTitulo = segmento === 'detenidas' ? 'Ninguna OC detenida' : segmento === 'entregadas' ? 'Sin entregas registradas' : 'Sin pedidos abiertos';
  const vacioSub = etapaSel ? `Nada en «${ETAPA_LABEL[etapaSel]}» con estos filtros.` : segmento === 'detenidas' ? 'Todas avanzaron en los últimos 3 días.' : segmento === 'entregadas' ? 'Aquí aparecen las OCs con recepción del cliente.' : 'Todo lo registrado está entregado.';

  return (
    <>
      <Cabecera onVolver={onVolver} />
      <TituloGrande titulo="Tracking" sub={`${fmtInt(res.abiertas)} OC abiertas · toca una etapa para filtrar`} />
      <HeroM eyebrow="Pedidos de clientes" frase={fraseHero(res, hoy)}
        stats={[
          { k: 'Abiertas', v: fmtInt(res.abiertas), sub: `${fmtMoneyShort(res.abiertasMonto)} · ${fmtInt(res.abiertasPz)} pz` },
          { k: 'Detenidas', v: fmtInt(res.detenidas), sub: res.detenidas ? '> 3 d sin avance' : 'ninguna', color: res.detenidas ? theme.red : undefined },
          { k: 'Surtir hoy', v: fmtInt(res.surtibles), sub: `${fmtInt(res.surtiblesPz)} pz con stock` },
        ]}>
        {frescura && <div style={{ marginTop: 8 }}>{frescura}</div>}
      </HeroM>

      <KpiGrid style={{ marginTop: 10 }}>
        <KpiM eyebrow="Fill rate 90 d" big={fmtPct(res.fill)} sub={res.fillPrev != null ? `antes ${fmtPct(res.fillPrev)} · facturado / pedido` : 'facturado / pedido'} progress={res.fill ?? undefined} />
        <KpiM eyebrow="Días a entrega" big={fmtDias(res.diasEntrega)} bigColor={res.diasEntrega != null && res.diasEntrega > META_ENTREGA ? theme.orange : undefined}
          sub={`meta ${META_ENTREGA} d${deltaDias != null ? ` · ${deltaDias <= 0 ? '↓' : '↑'} ${Math.abs(deltaDias).toFixed(1)}` : ''}`} />
        <KpiM eyebrow="Backorder" big={`${fmtInt(res.backorderSkus)} SKU`} sub={`${fmtInt(res.backorderPz)} pz · ${fmtInt(res.backorderSinPo)} sin PO`}
          bigColor={res.backorderSinPo ? theme.orange : undefined} onClick={backorder.length ? () => setHojaBO(true) : undefined} />
        <KpiM eyebrow="Monto abierto" big={fmtMoneyShort(res.abiertasMonto)} sub={`${fmtInt(res.abiertasPendPz)} pz pendientes de facturar`} />
      </KpiGrid>

      {surtirVisibles.length > 0 && (
        <ListaAgrupada titulo="Surtir hoy" meta={surtirVisibles.length} style={{ marginTop: 18 }}
          pie="Stock disponible en almacén comercial para todo lo que falta de la OC."
          accion={onCompartirSurtir ? (
            <button type="button" onClick={() => onCompartirSurtir(surtirVisibles)} style={botonTexto(theme)}><Share2 size={13} strokeWidth={2.2} /> Compartir</button>
          ) : null}>
          {(verSurtir ? surtirVisibles : surtirVisibles.slice(0, MAX_SURTIR)).map((s) => {
            const oc = porId.get(s.id);
            return (
              <Fila key={s.id} alto={54} tono={theme.green} onClick={oc && onAbrir ? () => onAbrir(oc) : undefined}
                titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>OC {s.numero_oc_cliente}</span>}
                sub={[nombreCliente(s.cliente_key), s.almacen ? `desde ${s.almacen}` : null, s.diasEnEtapa != null ? `${Math.round(s.diasEnEtapa)} d en ${ETAPA_LABEL[s.etapa] || s.etapa}` : null].filter(Boolean).join(' · ')}
                valor={`${fmtInt(s.pendiente)} pz`} valorSub="por surtir" />
            );
          })}
          {surtirVisibles.length > MAX_SURTIR && (
            <Fila key="mas" alto={44} chevron={false} onClick={() => setVerSurtir((v) => !v)}
              titulo={<span style={{ color: theme.accent, fontSize: 14 }}>{verSurtir ? 'Ver menos' : `Ver las ${surtirVisibles.length}`}</span>} />
          )}
        </ListaAgrupada>
      )}

      <ListaAgrupada titulo="Por etapa" meta={etapaSel ? ETAPA_LABEL[etapaSel] : null} style={{ marginTop: 18 }}
        pie={etapaSel ? 'Toca la misma etapa para quitar el filtro.' : 'Dónde está hoy cada pedido abierto; Entregada = cerradas.'}
        accion={etapaSel ? <button type="button" onClick={() => setEtapaSel(null)} style={botonTexto(theme)}>Quitar filtro</button> : null}>
        {embudo.map((e) => (
          <FilaEmbudo key={e.etapa} e={e} activa={etapaSel === e.etapa} atenuada={!!etapaSel && etapaSel !== e.etapa} onClick={() => elegirEtapa(e.etapa)} />
        ))}
      </ListaAgrupada>

      <div style={{ padding: '18px 0 10px' }}>
        <div style={{ padding: '0 16px 2px' }}>
          <Segmented size="md" value={segmento} onChange={(s) => { setSegmento(s); if (s !== 'abiertas' && etapaSel && (s === 'entregadas') !== (etapaSel === 'entregada')) setEtapaSel(null); }}
            options={SEGMENTOS.map((x) => ({ ...x, badge: x.id === 'detenidas' && res.detenidas ? res.detenidas : undefined }))} />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 16px 2px' }}>
          {CHIPS.map((c) => <ChipM key={c.key} on={cliente === c.key} onClick={() => setCliente(c.key)}>{c.nombre}</ChipM>)}
        </div>
        <div style={{ padding: '10px 16px 0' }}>
          <CampoBusqueda value={q} onChange={setQ} placeholder="OC, factura, guía o SKU" />
        </div>
      </div>

      {grupos.length === 0 && <Vacio icon={segmento === 'entregadas' ? Package : PackageCheck} color={segmento === 'entregadas' ? theme.textMuted : undefined} titulo={vacioTitulo} sub={vacioSub} />}
      {grupos.map((g) => (
        <ListaAgrupada key={g.ck} titulo={nombreCliente(g.ck)} meta={g.items.length} style={{ marginBottom: 16 }}>
          {g.items.map((o) => <FilaPedido key={o.id} oc={o} onAbrir={onAbrir} onEnvio={onEnvio} onCompartir={onCompartir} />)}
        </ListaAgrupada>
      ))}
      {onEnvio && grupos.length > 0 && (
        <div style={{ padding: '0 20px 8px', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontText }}>Desliza una fila a la izquierda: registrar envío · compartir estatus.</div>
      )}
      <div style={{ height: 24 }} />

      <HojaM abierto={hojaBO} onClose={() => setHojaBO(false)} titulo="Backorder por SKU" sub="Piezas pendientes de OCs abiertas, con el stock de hoy y la PO que las cubre" alto="80vh">
        <ListaAgrupada>
          {backorder.map((b) => (
            <Fila key={b.sku} alto={60} chevron={false}
              titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{b.sku}</span>}
              sub={[b.descripcion || null, b.clientes.map(nombreCliente).join(', '), `OC ${b.ocs.slice(0, 2).join(', ')}${b.ocs.length > 2 ? '…' : ''}`].filter(Boolean).join(' · ')}
              valor={<span style={{ color: theme.orange }}>{fmtInt(b.backorder)}</span>} valorSub={`stock ${fmtInt(b.stock)}`}
              pill={b.stock >= b.backorder ? { tone: 'green', label: 'Stock hoy' } : b.cubre ? { tone: 'blue', label: `PO ${b.cubre.po || '—'} · ${fmtFecha(b.cubre.eta)}` } : { tone: 'red', label: 'Sin PO' }} />
          ))}
        </ListaAgrupada>
        <div style={{ height: 24 }} />
      </HojaM>
    </>
  );
}

function FilaEmbudo({ e, activa, atenuada, onClick }) {
  const { theme } = useTheme();
  const [bg] = toneBg(theme, ETAPA_TONE[e.etapa] || 'gray');
  return (
    <Fila alto={54} chevron={false} onClick={onClick} style={{ opacity: atenuada ? 0.5 : 1, transition: `opacity ${DUR.state}ms ${EASE}, background ${DUR.state}ms ${EASE}`, ...(activa ? { background: theme.surfaceHover || 'rgba(0,0,0,0.03)' } : {}) }}
      titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{ETAPA_LABEL[e.etapa]}{e.detenidas > 0 && <Pill tone="red" size="xs" dot>{e.detenidas} detenida{e.detenidas === 1 ? '' : 's'}</Pill>}</span>}
      sub={<span style={{ display: 'block', height: 4, borderRadius: 999, background: `${theme.text}0F`, marginTop: 4, overflow: 'hidden' }}>
        <span style={{ display: 'block', height: 4, width: `${e.ancho}%`, background: bg, borderRadius: 999, transition: `width 600ms ${EASE}` }} />
      </span>}
      valor={fmtInt(e.n)} valorSub={e.monto ? fmtMoneyShort(e.monto) : '—'} />
  );
}

// Color pleno por tono (la barra del embudo), sin inventar hex: todo sale del theme.
function toneBg(theme, tone) {
  const m = { green: theme.green, blue: theme.accent, orange: theme.orange, red: theme.red, yellow: theme.yellow || theme.orange, purple: theme.purple || theme.indigo || theme.accent, gray: theme.textMuted };
  return [m[tone] || theme.accent];
}
const botonTexto = (theme) => ({ display: 'inline-flex', alignItems: 'center', gap: 4, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13, padding: 0, cursor: 'pointer' });

/** Pantalla conectada (push desde el menú). */
export default function TrackingM() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav?.perfil;
  const puedeVer = puedeVerPestanaGlobal(perfil, 'ordenes_compra');
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'ordenes_compra');
  const { data, isLoading, error } = useTrackingDatos({ enabled: puedeVer });
  const [envio, setEnvio] = useState(null); // OC a la que se registra envío

  const hoy = useMemo(() => new Date(), [data?.cargadoAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const filas = useMemo(() => (data ? calcularTodo(data, hoy) : []), [data, hoy]);
  const res = useMemo(() => calcResumen(filas, hoy), [filas, hoy]);
  const surtir = useMemo(() => calcSurtir(filas), [filas]);
  const backorder = useMemo(() => backorderPorSku(filas), [filas]);

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Tracking" /><Vacio icon={Package} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña Tracking de Pedidos." /></>);
  }
  if (isLoading) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Tracking" sub="Cargando…" /><Cargando pantalla="movilTracking" /></>);
  if (error) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Tracking" /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar" sub={String(error.message || error)} /></>);

  const abrir = (oc) => nav.push(<FichaOC ocId={oc.id} />, `oc-${oc.id}`, 'ordenesCompra');
  const compartirOC = async (oc) => {
    const r = await compartir(textoEstatusOC(oc), { titulo: `Estatus OC ${oc.numero_oc_cliente}` });
    if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…');
  };
  const compartirSurtir = async (lista) => {
    const r = await compartir(textoListaSurtir(lista, { fecha: hoy }), { titulo: 'Surtir hoy' });
    if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…');
  };

  return (
    <>
      <TrackingMVista filas={filas} res={res} surtir={surtir} backorder={backorder} hoy={hoy} onVolver={nav.pop}
        onAbrir={abrir} onEnvio={puedeEditar ? setEnvio : null} onCompartir={compartirOC} onCompartirSurtir={compartirSurtir}
        frescura={<FrescuraPill pantalla="ventasErp" inverso detallado />} />
      <HojaEnvio abierto={!!envio} onClose={() => setEnvio(null)} oc={envio} />
    </>
  );
}
