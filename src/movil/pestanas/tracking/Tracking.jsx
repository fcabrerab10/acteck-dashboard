// Tracking de pedidos en el celular (push · nodo global `ordenesCompra`).
//
//   Hero: OCs abiertas · detenidas · surtible hoy (+ FrescuraPill de las ventas del ERP) · 4 KPIs (fill del mes,
//   días a entrega vs meta, backorder, facturas sin OC) · Segmented Abiertas · Detenidas · Surtir hoy · Backorder ·
//   Entregadas · chips de cliente · buscador (OC, factura, guía, SKU, sin acentos).
//   Fila de OC: deslizar a la DERECHA = Registrar envío · a la IZQUIERDA = Compartir estatus (WhatsApp).
//   FAB "+": Registrar OC · Pegar correo · Cotización.
//
// Toda la lógica es la MISMA de la web: tracking/datos.js (useTrackingDatos + escrituras),
// tracking/calculo.js (calcularTodo, resumen, backorderPorSku, surtirHoy, facturasSinOC, ordenar, búsqueda)
// y tracking/textos.js (formatos y textos de WhatsApp). Aquí sólo hay layout táctil.
import React, { useMemo, useState } from 'react';
import { Plus, ClipboardPaste, FileText, Share2, PackageCheck, AlertTriangle, Package } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal } from '../../../lib/permisos';
import { compartir } from '../../../lib/whatsapp';
import { Cargando } from '../../../components/kit';
import FrescuraPill from '../../../components/FrescuraPill';
import { useTrackingDatos } from '../../../modules/comercial/tracking/datos';
import {
  calcularTodo, resumen as calcResumen, backorderPorSku, surtirHoy as calcSurtir, facturasSinOC as calcSinOC,
  ordenar, textoBusqueda, coincide, rangoPeriodo, fraseHero,
} from '../../../modules/comercial/tracking/calculo';
import {
  ETAPAS, ETAPA_LABEL, META_ENTREGA, CLIENTES, N, fmtInt, fmtPct, fmtDias, fmtFecha, fmtMoneyShort,
  nombreCliente, normalizar, tokens as toks, aFecha, textoEstatusOC, textoListaSurtir,
} from '../../../modules/comercial/tracking/textos';
import { useNav } from '../../nav';
import {
  TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, CampoBusqueda, Segmented, Vacio, HojaM, BotonGrande, toast,
} from '../../piezas';
import { FAB } from '../agenda/comun';
import { MONO } from '../../util';
import { FilaOC, ChipM } from './piezas';
import { HojaOC, HojaEnvio, HojaCotizacion, HojaFactura } from './hojas';
import FichaOC from './FichaOC';

const TABS = [
  { id: 'abiertas', label: 'Abiertas' },
  { id: 'detenidas', label: 'Detenidas' },
  { id: 'surtir', label: 'Surtir hoy' },
  { id: 'backorder', label: 'Backorder' },
  { id: 'entregadas', label: 'Entregadas' },
];
const CHIPS = [{ key: 'todos', nombre: 'Todos' }, ...CLIENTES.map((c) => ({ key: c.key, nombre: c.nombre }))];

/** Fill rate del mes en curso (OCs recibidas en el mes): facturado / pedido. */
function fillDelMes(filas, hoy) {
  const r = rangoPeriodo('mes', hoy);
  let ped = 0, fac = 0;
  for (const o of filas) {
    if (o.esCotizacion || !o.fecha_recibida) continue;
    const d = aFecha(o.fecha_recibida);
    if (!d || d < r.desde || d >= r.hasta) continue;
    ped += N(o.pedido); fac += N(o.facturado);
  }
  return ped > 0 ? Math.min(100, (fac / ped) * 100) : null;
}

export default function Tracking() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav?.perfil;
  const puedeVer = puedeVerPestanaGlobal(perfil, 'ordenes_compra');
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'ordenes_compra');
  const email = perfil?.email || null;
  const { data, isLoading, error } = useTrackingDatos({ enabled: puedeVer });

  const [tab, setTab] = useState('abiertas');
  const [cliente, setCliente] = useState('todos');
  const [q, setQ] = useState('');
  const [hoja, setHoja] = useState(null);      // { tipo: 'mas'|'oc'|'pegar'|'cotizacion'|'envio'|'factura', oc?, factura? }

  const hoy = useMemo(() => new Date(), [data?.cargadoAt]);
  const filas = useMemo(() => (data ? calcularTodo(data, hoy) : []), [data, hoy]);
  const res = useMemo(() => calcResumen(filas, hoy), [filas, hoy]);
  const bo = useMemo(() => backorderPorSku(filas), [filas]);
  const surtir = useMemo(() => calcSurtir(filas), [filas]);
  const sinOC = useMemo(() => (data ? calcSinOC(data.erpFacturas, data.facturas, hoy) : []), [data, hoy]);
  const fillMes = useMemo(() => fillDelMes(filas, hoy), [filas, hoy]);
  const porId = useMemo(() => new Map(filas.map((r) => [r.id, r])), [filas]);

  const t = useMemo(() => toks(q), [q]);
  const visibles = useMemo(() => {
    const out = filas.filter((o) => {
      if (cliente !== 'todos' && o.cliente_key !== cliente) return false;
      if (t.length && !coincide(o._hay || (o._hay = textoBusqueda(o)), t)) return false;
      return true;
    });
    return ordenar(out);
  }, [filas, cliente, t]);

  const abrir = (oc) => nav.push(<FichaOC ocId={oc.id} />, `oc-${oc.id}`, 'ordenesCompra');
  const compartirOC = async (oc) => {
    const r = await compartir(textoEstatusOC(oc), { titulo: `Estatus OC ${oc.numero_oc_cliente}` });
    if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…');
  };
  const registrarEnvio = puedeEditar ? (oc) => setHoja({ tipo: 'envio', oc }) : null;

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Tracking" /><Vacio icon={Package} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña Tracking de Pedidos." /></>);
  }
  if (isLoading) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Tracking" sub="Cargando…" /><Cargando pantalla="movilTracking" /></>);
  if (error) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Tracking" /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar" sub={String(error.message || error)} /></>);

  // ── Contenido por pestaña ──
  const abiertas = visibles.filter((o) => o.abierta);
  const detenidas = visibles.filter((o) => o.detenida);
  const entregadas = visibles.filter((o) => !o.abierta && o.etapa === 'entregada');
  const setVisibles = new Set(visibles.map((o) => o.id));
  const surtirFilas = surtir.map((s) => porId.get(s.id)).filter((o) => o && setVisibles.has(o.id));
  const boFilas = bo.filter((b) => {
    if (cliente !== 'todos' && !b.clientes.includes(cliente)) return false;
    if (!t.length) return true;
    const hay = normalizar(`${b.sku} ${b.descripcion} ${b.ocs.join(' ')} ${b.clientes.map(nombreCliente).join(' ')}`);
    return coincide(hay, t);
  });
  const sinOCFilas = sinOC.filter((f) => (cliente === 'todos' || f.cliente_key === cliente) && (!t.length || coincide(normalizar(`${f.folio} ${f.referencia || ''} ${nombreCliente(f.cliente_key)}`), t)));

  const grupos = ETAPAS.filter((e) => e !== 'entregada').map((e) => ({ etapa: e, items: abiertas.filter((o) => o.etapa === e) })).filter((g) => g.items.length);
  const filaProps = { onAbrir: abrir, onEnvio: registrarEnvio, onCompartir: compartirOC };

  let cuerpo = null;
  if (tab === 'abiertas') {
    cuerpo = (
      <>
        {!abiertas.length && <Vacio icon={PackageCheck} titulo="Sin pedidos abiertos" sub="Todo lo registrado está entregado." />}
        {grupos.map((g) => (
          <ListaAgrupada key={g.etapa} titulo={ETAPA_LABEL[g.etapa]} meta={g.items.length} style={{ marginBottom: 16 }}>
            {g.items.map((o) => <FilaOC key={o.id} oc={o} {...filaProps} />)}
          </ListaAgrupada>
        ))}
        {sinOCFilas.length > 0 && (
          <ListaAgrupada titulo="Facturas sin OC" meta={sinOCFilas.length} style={{ marginBottom: 16 }}
            pie="Facturas del ERP de los últimos 30 días que no ligaron a ninguna OC. Tócalas para crear la OC o ligarlas.">
            {sinOCFilas.map((f) => (
              <Fila key={f.folio} alto={56} titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{f.folio}</span>}
                sub={[nombreCliente(f.cliente_key), fmtFecha(f.fecha), `${fmtInt(f.piezas)} pz`, f.referencia ? `ref. ${f.referencia}` : null].filter(Boolean).join(' · ')}
                valor={fmtMoneyShort(f.monto)} onClick={puedeEditar ? () => setHoja({ tipo: 'factura', factura: f }) : undefined} chevron={puedeEditar} />
            ))}
          </ListaAgrupada>
        )}
      </>
    );
  } else if (tab === 'detenidas') {
    cuerpo = detenidas.length ? (
      <ListaAgrupada titulo="Más de 3 días sin avance" meta={detenidas.length} style={{ marginBottom: 16 }}>
        {detenidas.map((o) => <FilaOC key={o.id} oc={o} {...filaProps} />)}
      </ListaAgrupada>
    ) : <Vacio titulo="Ninguna OC detenida" sub="Todas avanzaron en los últimos 3 días." />;
  } else if (tab === 'surtir') {
    cuerpo = surtirFilas.length ? (
      <>
        <div style={{ padding: '0 16px 12px' }}>
          <BotonGrande icon={Share2} onClick={async () => {
            const r = await compartir(textoListaSurtir(surtir.filter((s) => setVisibles.has(s.id)), { fecha: hoy }), { titulo: 'Surtir hoy' });
            if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…');
          }}>Compartir lista</BotonGrande>
        </div>
        <ListaAgrupada titulo="Con stock completo" meta={surtirFilas.length} style={{ marginBottom: 16 }}
          pie="Stock disponible en almacén comercial para todo lo que falta de la OC.">
          {surtirFilas.map((o) => <FilaOC key={o.id} oc={o} {...filaProps} />)}
        </ListaAgrupada>
      </>
    ) : <Vacio titulo="Nada para surtir hoy" sub="Ninguna OC abierta tiene stock completo de lo pendiente." />;
  } else if (tab === 'backorder') {
    cuerpo = boFilas.length ? (
      <ListaAgrupada titulo="Pendiente por SKU" meta={boFilas.length} style={{ marginBottom: 16 }}
        pie="Piezas pendientes de OCs abiertas, con el stock de hoy y la PO que las cubre.">
        {boFilas.map((b) => (
          <Fila key={b.sku} alto={60} chevron={false}
            titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{b.sku}</span>}
            sub={[b.descripcion || null, b.clientes.map(nombreCliente).join(', '), `OC ${b.ocs.slice(0, 3).join(', ')}${b.ocs.length > 3 ? '…' : ''}`].filter(Boolean).join(' · ')}
            valor={<span style={{ color: theme.orange }}>{fmtInt(b.backorder)}</span>} valorSub={`stock ${fmtInt(b.stock)}`}
            pill={b.stock >= b.backorder ? { tone: 'green', label: 'Stock hoy' } : b.cubre ? { tone: 'blue', label: `PO ${b.cubre.po || '—'} · ${fmtFecha(b.cubre.eta)}` } : { tone: 'red', label: 'Sin PO' }} />
        ))}
      </ListaAgrupada>
    ) : <Vacio titulo="Sin backorder" sub="Todo lo pedido está facturado." />;
  } else {
    cuerpo = entregadas.length ? (
      <ListaAgrupada titulo="Entregadas" meta={entregadas.length} style={{ marginBottom: 16 }}>
        {entregadas.map((o) => <FilaOC key={o.id} oc={o} {...filaProps} />)}
      </ListaAgrupada>
    ) : <Vacio icon={Package} color={theme.textMuted} titulo="Sin entregas registradas" sub="Aquí aparecen las OCs con recepción del cliente." />;
  }

  const deltaDias = res.diasEntrega != null && res.diasEntregaPrev != null ? res.diasEntrega - res.diasEntregaPrev : null;

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Tracking" sub={`${fmtInt(res.abiertas)} OC abiertas · desliza una fila: → envío, ← compartir`} />
      <HeroM eyebrow="Pedidos de clientes" frase={fraseHero(res, hoy)}
        stats={[
          { k: 'Abiertas', v: fmtInt(res.abiertas), sub: `${fmtMoneyShort(res.abiertasMonto)} · ${fmtInt(res.abiertasPz)} pz` },
          { k: 'Detenidas', v: fmtInt(res.detenidas), sub: res.detenidas ? '> 3 d sin avance' : 'ninguna', color: res.detenidas ? theme.red : undefined },
          { k: 'Surtir hoy', v: fmtInt(res.surtibles), sub: `${fmtInt(res.surtiblesPz)} pz con stock` },
        ]}>
        <div style={{ marginTop: 8 }}><FrescuraPill pantalla="ventasErp" inverso detallado /></div>
      </HeroM>

      <KpiGrid style={{ marginTop: 10 }}>
        <KpiM eyebrow="Fill rate del mes" big={fmtPct(fillMes)} sub="facturado / pedido" progress={fillMes ?? undefined} />
        <KpiM eyebrow="Días a entrega" big={fmtDias(res.diasEntrega)} bigColor={res.diasEntrega != null && res.diasEntrega > META_ENTREGA ? theme.orange : undefined}
          sub={`meta ${META_ENTREGA} d${deltaDias != null ? ` · ${deltaDias <= 0 ? '↓' : '↑'} ${Math.abs(deltaDias).toFixed(1)}` : ''}`} />
        <KpiM eyebrow="Backorder" big={fmtInt(res.backorderSkus)} sub={`${fmtInt(res.backorderPz)} pz · ${res.backorderSinPo} sin PO`}
          bigColor={res.backorderSinPo ? theme.orange : undefined} onClick={() => setTab('backorder')} />
        <KpiM eyebrow="Facturas sin OC" big={fmtInt(sinOC.length)} sub="ERP · últimos 30 días" onClick={() => { setTab('abiertas'); }} />
      </KpiGrid>

      <div style={{ padding: '14px 0 10px' }}>
        <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '0 16px 2px' }}>
          <Segmented size="md" value={tab} onChange={setTab} options={TABS.map((x) => ({
            ...x,
            badge: x.id === 'detenidas' && res.detenidas ? res.detenidas : x.id === 'surtir' && res.surtibles ? res.surtibles : undefined,
          }))} />
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', WebkitOverflowScrolling: 'touch', padding: '10px 16px 2px' }}>
          {CHIPS.map((c) => <ChipM key={c.key} on={cliente === c.key} onClick={() => setCliente(c.key)}>{c.nombre}</ChipM>)}
        </div>
        <div style={{ padding: '10px 16px 0' }}>
          <CampoBusqueda value={q} onChange={setQ} placeholder="OC, factura, guía o SKU" />
        </div>
      </div>

      {cuerpo}
      <div style={{ height: 72 }} />

      {puedeEditar && <FAB onClick={() => setHoja({ tipo: 'mas' })} label="Registrar OC o cotización" />}

      <HojaM abierto={hoja?.tipo === 'mas'} onClose={() => setHoja(null)} titulo="Registrar" sub="Karolina sólo captura la OC: facturas y guías llegan del ERP" alto="44vh">
        <div style={{ padding: '4px 16px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <BotonGrande primario icon={Plus} onClick={() => setHoja({ tipo: 'oc' })}>Registrar OC</BotonGrande>
          <BotonGrande icon={ClipboardPaste} onClick={() => setHoja({ tipo: 'pegar' })}>Pegar correo</BotonGrande>
          <BotonGrande icon={FileText} onClick={() => setHoja({ tipo: 'cotizacion' })}>Cotización</BotonGrande>
        </div>
      </HojaM>

      <HojaOC abierto={hoja?.tipo === 'oc' || hoja?.tipo === 'pegar'} onClose={() => setHoja(null)} modo={hoja?.tipo === 'pegar' ? 'pegar' : 'nueva'}
        roadmap={data?.roadmapRows || []} roadmapMap={data?.roadmap} erpFacturas={data?.erpFacturas || []} email={email}
        onGuardado={(id) => { if (id) nav.push(<FichaOC ocId={id} />, `oc-${id}`, 'ordenesCompra'); }} />
      <HojaEnvio abierto={hoja?.tipo === 'envio'} onClose={() => setHoja(null)} oc={hoja?.oc || null} />
      <HojaCotizacion abierto={hoja?.tipo === 'cotizacion'} onClose={() => setHoja(null)} email={email} />
      <HojaFactura abierto={hoja?.tipo === 'factura'} onClose={() => setHoja(null)} factura={hoja?.factura || null} filas={filas} email={email}
        onHecho={(id) => { if (id) nav.push(<FichaOC ocId={id} />, `oc-${id}`, 'ordenesCompra'); }} />
    </>
  );
}
