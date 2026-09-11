// Tracking Pedidos V3 · orquestador (página `ordenesCompra`). Kit V3, lógica pura en ./tracking/calculo.js.
// Hero → Ciclo del pedido (embudo) → 4 KPIs → Pedidos (buscador, pills, drill) → Backorder | Surtir hoy → Tiempos | Facturas sin OC.
// Facturas y guías llegan solas del ERP (RPC oc_sincronizar_erp al cargar); Karolina registra la OC (o la pega del correo),
// cotizaciones y envíos manuales. Lo manual gana sobre lo automático si difiere.
import React, { useMemo, useState } from 'react';
import { Plus, ClipboardPaste, Share2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import { Hero, KpiCard, Panel, Segmented, Boton, Pill, Cargando, toast } from '../../components/kit';
import { compartir } from '../../lib/whatsapp';
import { useTrackingDatos } from './tracking/datos';
import { calcularTodo, embudo as calcEmbudo, resumen as calcResumen, backorderPorSku, surtirHoy as calcSurtir, tiemposPorCliente, facturasSinOC as calcSinOC, FILTROS_VACIOS, fraseHero, subHero, pasaFiltros } from './tracking/calculo';
import { MESES_LARGO, META_ENTREGA, fmtInt, fmtPct, fmtMoneyShort, fmtDias, textoEstatusOC, ETAPA_LABEL } from './tracking/textos';
import Embudo from './tracking/Embudo';
import TablaPedidos from './tracking/TablaPedidos';
import Backorder from './tracking/Backorder';
import SurtirHoy from './tracking/SurtirHoy';
import Tiempos from './tracking/Tiempos';
import FacturasSinOC from './tracking/FacturasSinOC';
import FormOC from './tracking/FormOC';
import FormEnvio from './tracking/FormEnvio';
import FormCotizacion from './tracking/FormCotizacion';

export default function TrackingPedidos() {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const puedeVer = puedeVerPestanaGlobal(perfil, 'ordenes_compra');
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'ordenes_compra');
  const email = perfil?.email || null;
  const { data, isLoading, isFetching, error } = useTrackingDatos();

  const [periodo, setPeriodo] = useState('trimestre');
  const [f, setF] = useState(FILTROS_VACIOS);
  const [abierta, setAbierta] = useState(null);
  const [hoja, setHoja] = useState(null);   // { tipo: 'oc'|'pegar'|'folios'|'convertir'|'envio'|'cotizacion', oc?, envio?, cotizacion? }

  const hoy = useMemo(() => new Date(), [data?.cargadoAt]);
  const filas = useMemo(() => (data ? calcularTodo(data, hoy) : []), [data, hoy]);
  const res = useMemo(() => calcResumen(filas, hoy), [filas, hoy]);
  const emb = useMemo(() => calcEmbudo(filas, data?.cotizaciones, periodo, hoy), [filas, data, periodo, hoy]);
  const bo = useMemo(() => backorderPorSku(filas), [filas]);
  const surtir = useMemo(() => calcSurtir(filas), [filas]);
  const tiempos = useMemo(() => tiemposPorCliente(filas, hoy), [filas, hoy]);
  const sinOC = useMemo(() => (data ? calcSinOC(data.erpFacturas, data.facturas, hoy) : []), [data, hoy]);
  const porId = useMemo(() => new Map(filas.map((r) => [r.id, r])), [filas]);
  const ocAbierta = abierta ? porId.get(abierta) : null;

  if (!puedeVer) return <SinAcceso motivo="No tienes acceso a Tracking de Pedidos." />;

  const irA = (id, extra = {}) => { setF((p) => ({ ...p, ...FILTROS_VACIOS(), segmento: 'todos', ...extra })); setAbierta(id); setTimeout(() => document.getElementById('panel-pedidos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
  const filtrar = (patch) => { setF((p) => ({ ...p, ...patch })); setTimeout(() => document.getElementById('panel-pedidos')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };
  const etapaActiva = f.etapa.size === 1 ? [...f.etapa][0] : null;
  const compartirEstatus = async () => {
    const oc = ocAbierta || filas.filter((r) => pasaFiltros(r, f) && !r.esCotizacion)[0];
    if (!oc) { toast.info('Abre una OC en la tabla para compartir su estatus'); return; }
    const r = await compartir(textoEstatusOC(oc), { titulo: `Estatus OC ${oc.numero_oc_cliente}` });
    if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…');
  };
  const drill = {
    onRegistrarEnvio: (oc) => setHoja({ tipo: 'envio', oc }),
    onEditarEnvio: (envio) => setHoja({ tipo: 'envio', oc: ocAbierta, envio }),
    onEditarOC: (oc) => setHoja({ tipo: 'oc', oc }),
    onCapturarFolios: (oc) => setHoja({ tipo: 'folios', oc }),
    onConvertir: (cotizacion) => setHoja({ tipo: 'convertir', cotizacion }),
    onEditarCotizacion: (cotizacion) => setHoja({ tipo: 'cotizacion', cotizacion }),
  };
  const mesTxt = `${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`;
  const deltaDias = res.diasEntrega != null && res.diasEntregaPrev != null ? res.diasEntrega - res.diasEntregaPrev : null;
  const cargadoTxt = data?.cargadoAt ? new Date(data.cargadoAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' }) : '';

  return (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, padding: '10px 6px' }}>
      {isLoading ? <Cargando pantalla="ordenesCompra" /> : error ? (
        <Panel titulo="No se pudo cargar el tracking"><div style={{ fontSize: 12.5, color: theme.textMuted }}>{String(error.message || error)}</div></Panel>
      ) : (
        <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Hero eyebrow={`Tracking Pedidos · ${mesTxt}`} titulo={fraseHero(res, hoy)} sub={subHero(res)}
            stats={[
              { k: 'Abiertas', v: fmtInt(res.abiertas), sub: `${fmtMoneyShort(res.abiertasMonto)} · ${fmtInt(res.abiertasPz)} pz` },
              { k: 'Fill rate', v: fmtPct(res.fill), sub: 'facturado / pedido · 90 d' },
              { k: 'Días a entrega', v: fmtDias(res.diasEntrega), sub: `meta ${META_ENTREGA}${deltaDias != null ? ` · ${deltaDias <= 0 ? '↓' : '↑'} ${Math.abs(deltaDias).toFixed(1)} vs 90 d prev.` : ''}`, color: res.diasEntrega != null && res.diasEntrega > META_ENTREGA ? (theme.orange || '#FF9500') : undefined },
            ]}>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {puedeEditar && <Boton icon={Plus} onClick={() => setHoja({ tipo: 'cotizacion' })}>Cotización</Boton>}
              {puedeEditar && <Boton primario icon={Plus} onClick={() => setHoja({ tipo: 'oc' })}>Registrar OC</Boton>}
              {puedeEditar && <Boton icon={ClipboardPaste} onClick={() => setHoja({ tipo: 'pegar' })}>Pegar correo</Boton>}
              <Boton icon={Share2} onClick={compartirEstatus}>Compartir estatus</Boton>
              <Pill tone="inverse" size="xs" style={{ background: 'transparent', color: theme.mode === 'dark' ? 'rgba(29,29,31,0.66)' : 'rgba(245,245,247,0.66)' }}>
                {data?.sync?.error ? `ERP sin sincronizar: ${data.sync.error}` : `ERP al corte de las ${cargadoTxt}${isFetching ? ' · actualizando…' : ''}`}
              </Pill>
            </div>
          </Hero>

          <Panel titulo="Ciclo del pedido" meta={`clic en una etapa filtra la tabla · ${emb.periodo.label}`}
            acciones={<Segmented value={periodo} onChange={setPeriodo} options={[{ id: 'mes', label: 'Mes' }, { id: 'trimestre', label: 'Trimestre' }, { id: 'anio', label: 'Año' }]} />}>
            <Embudo embudo={emb} activa={etapaActiva} onEtapa={(e) => filtrar({ etapa: e ? new Set([e]) : new Set(), segmento: e === 'entregada' ? 'todos' : f.segmento })} />
          </Panel>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
            <KpiCard eyebrow="Detenidas" badge={res.detenidas ? { l: `> 3 d`, tone: 'red' } : null} big={fmtInt(res.detenidas)} bigColor={res.detenidas ? theme.red : undefined} sub={res.detenidas ? `más de 3 días sin avance · ${res.detenidasPorCliente}` : 'ninguna OC detenida'} onClick={() => filtrar({ detenida: !f.detenida })} />
            <KpiCard eyebrow="Surtible hoy" badge={{ l: 'stock', tone: 'green' }} big={fmtInt(res.surtiblesPz)} bigSmall="pz" sub={`${res.surtibles} OC${res.surtibles === 1 ? '' : 's'} con stock completo en almacén comercial`} onClick={() => filtrar({ surtible: !f.surtible })} />
            <KpiCard eyebrow="Backorder" big={fmtInt(res.backorderSkus)} bigSmall={`SKUs · ${fmtInt(res.backorderPz)} pz`} sub={`${res.backorderConStock} con stock hoy · ${res.backorderConArribo} con arribo · ${res.backorderSinPo} sin PO`} bigColor={res.backorderSinPo ? theme.orange : undefined} onClick={() => filtrar({ backorder: !f.backorder })} />
            <KpiCard eyebrow="Guías con desfase" badge={res.desfases ? { l: 'revisar', tone: 'orange' } : null} big={fmtInt(res.desfases)} bigSmall={res.desfases === 1 ? 'envío' : 'envíos'} sub="fecha ERP difiere > 2 d de lo capturado" onClick={() => filtrar({ desfase: !f.desfase, segmento: 'todos' })} />
          </div>

          <div id="panel-pedidos">
            <TablaPedidos filas={filas} f={f} setF={setF} abierta={abierta} setAbierta={setAbierta} refrescando={isFetching && !!abierta} puedeEditar={puedeEditar} drill={drill} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 10 }}>
            <Backorder filas={bo} onSku={(sku) => filtrar({ q: sku, backorder: false })} />
            <SurtirHoy filas={surtir} onOC={(id) => irA(id)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.2fr)', gap: 10 }}>
            <Tiempos filas={tiempos} />
            <FacturasSinOC filas={sinOC} todas={filas} puedeEditar={puedeEditar} email={email} />
          </div>

          <Panel titulo="Cómo funciona" meta="facturas y guías automáticas · captura sólo de la OC" plegable abiertoInicial={false}>
            <div style={{ fontSize: 12, lineHeight: 1.5, color: theme.textMuted, display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
              <div><b style={{ color: theme.text }}>Facturas.</b> La referencia de la factura en el ERP es el número de OC. Cada hora el puente trae las ventas; al abrir esta pestaña cada factura se liga a su OC (por referencia o por folio capturado) y toma sus partidas. Lo que no ligue aparece en «Facturas sin OC».</div>
              <div><b style={{ color: theme.text }}>Guías.</b> Las guías del ERP se ligan por factura o por OC. Si no llega, «Registrar envío» la captura a mano; cuando después llega la del ERP, se cuelga del mismo envío y si las fechas difieren más de 2 días se muestra el desfase para elegir cuál vale.</div>
              <div><b style={{ color: theme.text }}>Etapas.</b> {ETAPA_LABEL.cotizacion} (si existe) → {ETAPA_LABEL.recibida} → {ETAPA_LABEL.facturada} (parcial/total por SKU) → {ETAPA_LABEL.enviada} → {ETAPA_LABEL.entregada}. Detenida = más de 3 días en cotización, recibida o facturada. Fill = facturado / pedido; backorder por SKU con el arribo que lo cubre.</div>
            </div>
          </Panel>
        </div>
      )}

      <FormOC abierto={hoja?.tipo === 'oc' || hoja?.tipo === 'pegar' || hoja?.tipo === 'folios' || hoja?.tipo === 'convertir'} onClose={() => setHoja(null)}
        modo={hoja?.tipo === 'pegar' ? 'pegar' : hoja?.tipo === 'folios' ? 'folios' : hoja?.tipo === 'convertir' ? 'convertir' : hoja?.oc ? 'editar' : 'nueva'}
        oc={hoja?.oc || null} cotizacion={hoja?.cotizacion || null} roadmap={data?.roadmapRows || []} roadmapMap={data?.roadmap} email={email} erpFacturas={data?.erpFacturas || []} onGuardado={(id) => { if (id) setAbierta(id); }} />
      <FormEnvio abierto={hoja?.tipo === 'envio'} onClose={() => setHoja(null)} oc={hoja?.oc || null} envio={hoja?.envio || null} />
      <FormCotizacion abierto={hoja?.tipo === 'cotizacion'} onClose={() => setHoja(null)} cotizacion={hoja?.cotizacion || null} email={email} onConvertir={(c) => setHoja({ tipo: 'convertir', cotizacion: c })} />
    </div>
  );
}
