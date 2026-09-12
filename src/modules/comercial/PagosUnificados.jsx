// Pagos unificados · V3 (2026-09-12)
//
// UNA pestaña para Digitalife, PCEL y Dicotech. Desde el menú de un cliente se abre ya
// filtrada (prop `clienteKey`). Eje elegido por Fernando: calendario del mes + pipeline.
//
// Plantilla V3: Hero → Flujo del mes → Calendario → Pagos del mes (tabla con drill)
//               → Cálculo → Fondos → Reglas (con candado) → Historial de pagados.
//
// El 90 % de los pagos los calcula el motor (pagosv3/motor.js, el mismo que usa el cron
// en api/_pagos.js); el resto se captura a mano. Todos siguen un solo flujo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Send, Download, Mail } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { DB_CONFIGURED } from '../../lib/supabase';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Panel, Pill, Segmented, TablaCompacta, Boton, Cargando, toast } from '../../components/kit';
import FrescuraPill from '../../components/FrescuraPill';

import M from './pagosv3/motor';
import { CLIENTE_LABEL, reglaDe, resumenReglas } from './pagosv3/reglas';
import { ETAPAS, ESTADO_META, TIPO_META, estaAbierto, estaVencido, venceEn, resumenFlujo, diasParaPago } from './pagosv3/estados';
import { correoLote } from './pagosv3/correo';
import {
  useDatosPagos, puedeEditarPagos, cambiarEstado, guardarPropuestas, crearPagoManual,
  borrarPago, guardarRegla, guardarDinamica, movimientoFondo,
} from './pagosv3/datos';
import {
  mxn, mxnCorto, MONO, Nota, FiltroPill, EstadoPill, TipoPill, ClientePill, FlujoBarras,
} from './pagosv3/ui';
import { SIL_PAGOS } from './pagosv3/siluetas';
import Calendario from './pagosv3/Calendario';
import DrillPago from './pagosv3/DrillPago';
import PanelCalculo from './pagosv3/PanelCalculo';
import PanelFondos from './pagosv3/PanelFondos';
import PanelReglas from './pagosv3/PanelReglas';
import PanelMarketing from './pagosv3/PanelMarketing';
import FormPagoManual from './pagosv3/FormPagoManual';
import HojaRegistrarPago from './pagosv3/HojaRegistrarPago';

const hoyISO = () => new Date().toISOString().slice(0, 10);
const MESES = M.MESES_LARGOS;

export default function PagosUnificados({ clienteKey = null }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const hoy = hoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [filtroCliente, setFiltroCliente] = useState(clienteKey || 'todos');
  const [filtroEtapa, setFiltroEtapa] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState(null);
  const [filtroOrigen, setFiltroOrigen] = useState(null);
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [formManual, setFormManual] = useState(false);
  const [registrando, setRegistrando] = useState(null);
  const [correoLoteTxt, setCorreoLoteTxt] = useState(null);

  useEffect(() => { if (clienteKey) setFiltroCliente(clienteKey); }, [clienteKey]);

  const d = useDatosPagos({ perfil, anio, mes });
  const visibles = d.visibles;

  const puedeEditar = (c) => puedeEditarPagos(perfil, c);
  const puedeAlgo = visibles.some(puedeEditar);
  const clientesFiltro = filtroCliente === 'todos' ? visibles : [filtroCliente];
  const per = M.periodoMes(anio, mes);

  // ── Pagos del mes (por fecha programada) ──
  const delMes = useMemo(() => d.pagos.filter((p) => {
    if (!clientesFiltro.includes(p.cliente)) return false;
    const f = p.fecha_programada || p.fecha_compromiso;
    if (!f) return p.periodo === per;
    return String(f).slice(0, 7) === per;
  }), [d.pagos, clientesFiltro.join(','), per]);

  const flujo = useMemo(() => resumenFlujo(delMes), [delMes]);

  const filtrados = useMemo(() => delMes.filter((p) => {
    if (filtroEtapa && p.estado !== filtroEtapa) return false;
    if (filtroTipo && p.tipo !== filtroTipo) return false;
    if (filtroOrigen && p.origen !== filtroOrigen) return false;
    if (soloVencidos && !estaVencido(p, hoy)) return false;
    return true;
  }), [delMes, filtroEtapa, filtroTipo, filtroOrigen, soloVencidos, hoy]);

  // Los returns tempranos van DESPUÉS de todos los hooks (regla de hooks de React).
  if (visibles.length === 0) return <SinAcceso motivo="No tienes acceso a Pagos de ningún cliente." />;
  if (d.cargando) return <Cargando silueta={SIL_PAGOS} label="Cargando Pagos…" />;

  // ── Cifras del hero ──
  const comprometido = delMes.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const auto = delMes.filter((p) => p.origen === 'auto' && p.estado !== 'cancelado').reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const pagadoMes = delMes.filter((p) => p.estado === 'pagado');
  const pagado = pagadoMes.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const vencen = delMes.filter((p) => venceEn(p, 7, hoy) || estaVencido(p, hoy));
  const vencenMonto = vencen.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const porSolicitar = delMes.filter((p) => p.estado === 'calculado' && Number(p.monto) > 0);
  const porAutorizar = delMes.filter((p) => p.estado === 'solicitado');
  const sinFolio = delMes.filter((p) => p.estado === 'autorizado');
  const pctAuto = comprometido > 0 ? Math.round((auto / comprometido) * 100) : 0;

  const frase = `${mxnCorto(comprometido)} comprometidos en ${MESES[mes - 1].toLowerCase()}: ${mxnCorto(auto)} los calcula el sistema y ${mxnCorto(comprometido - auto)} son manuales`;
  const sub = [
    porSolicitar.length ? `${porSolicitar.length} por solicitar` : null,
    porAutorizar.length ? `${porAutorizar.length} esperan autorización` : null,
    sinFolio.length ? `${sinFolio.length} autorizado(s) sin folio` : null,
    vencen.length ? `${vencen.length} vence(n) en 7 días` : null,
  ].filter(Boolean).join(' · ') || 'Nada pendiente este mes.';

  // ── Acciones ──
  const recargarTras = async (fn, msgOk) => {
    try { const r = await fn(); await d.recargar(); if (msgOk) toast.ok(typeof msgOk === 'function' ? msgOk(r) : msgOk); return r; }
    catch (e) { toast.error(e.message || String(e)); }
  };

  const accion = ({ pago, hacia, extra, nota }) =>
    recargarTras(() => cambiarEstado({ pago, hacia, perfil, extra, nota }), `${ESTADO_META[hacia]?.label || hacia}`);

  const crearDesdePropuesta = (propuesta) =>
    recargarTras(() => guardarPropuestas({ propuestas: [propuesta], perfil }), 'Pago creado en estado calculado');

  const solicitarCalculados = async () => {
    const lote = porSolicitar;
    if (lote.length === 0) { toast.error('No hay pagos calculados por solicitar.'); return; }
    const reglaDest = reglaDe(d.reglas, '_global', 'destinatarios');
    const c = correoLote({ pagos: lote, perfil, reglaDestinatarios: reglaDest });
    setCorreoLoteTxt(c);
    try { await navigator.clipboard.writeText(c.texto); toast.ok('Correo del lote copiado'); } catch { /* se muestra abajo */ }
    await recargarTras(async () => {
      for (const p of lote) await cambiarEstado({ pago: p, hacia: 'solicitado', perfil, nota: `Lote: ${c.asunto}` });
    }, `${lote.length} pago(s) marcados como solicitados`);
  };

  // Lote a finanzas: si hay autorizados/con folio se exportan ésos; si no, todo el mes.
  const exportarLote = () => {
    const autorizados = delMes.filter((p) => ['autorizado', 'folio'].includes(p.estado));
    const usar = autorizados.length ? autorizados : delMes;
    const filas = usar.map((p) => ({
      cliente: CLIENTE_LABEL[p.cliente] || p.cliente,
      concepto: p.concepto,
      tipo: TIPO_META[p.tipo]?.label || p.tipo,
      origen: p.origen === 'auto' ? 'Automático' : 'Manual',
      periodo: p.periodo || '',
      monto: Number(p.monto) || 0,
      etapa: ESTADO_META[p.estado]?.label || p.estado,
      folio: p.folio || '',
      fecha: p.fecha_programada || '',
      nc: p.nc_folio || '',
      factura: p.nc_factura || '',
    }));
    const columnas = [
      { key: 'cliente', label: 'Cliente' },
      { key: 'concepto', label: 'Concepto' },
      { key: 'tipo', label: 'Tipo' },
      { key: 'origen', label: 'Origen' },
      { key: 'periodo', label: 'Periodo' },
      { key: 'monto', label: 'Monto', tipo: 'moneda' },
      { key: 'etapa', label: 'Etapa' },
      { key: 'folio', label: 'Folio' },
      { key: 'fecha', label: 'Fecha de pago' },
      { key: 'nc', label: 'Nota de crédito' },
      { key: 'factura', label: 'Factura aplicada' },
    ];
    return {
      titulo: `Pagos · ${MESES[mes - 1]} ${anio}`,
      hojas: [{
        nombre: autorizados.length ? 'Lote a finanzas' : 'Pagos del mes',
        subtitulo: autorizados.length ? 'Autorizados y con folio' : 'Todos los pagos del mes',
        columnas, filas,
        totales: { monto: filas.reduce((s, f) => s + f.monto, 0) },
      }],
    };
  };

  const columnas = [
    { key: 'concepto', label: 'Pago', align: 'left', render: (p) => (
      <span style={{ display: 'inline-flex', flexDirection: 'column' }}>
        <span style={{ fontFamily: TYPO.fontText, fontSize: 11.5 }}>{p.concepto}</span>
        {p.periodo && <span style={{ fontSize: 9.5, color: theme.textMuted, ...MONO }}>{p.periodo}</span>}
      </span>
    ) },
    { key: 'cliente', label: 'Cliente', align: 'left', width: 110, render: (p) => <ClientePill clienteKey={p.cliente} /> },
    { key: 'tipo', label: 'Tipo', align: 'left', width: 150, render: (p) => <TipoPill tipo={p.tipo} origen={p.origen} /> },
    { key: 'monto', label: 'Monto', width: 100, render: (p) => <span style={MONO}>{mxn(p.monto)}</span> },
    { key: 'base', label: 'Base', align: 'left', render: (p) => (
      <span style={{ fontSize: 10.5, color: theme.textMuted }}>
        {p.detalle?.base != null ? `${mxnCorto(p.detalle.base)}${p.detalle?.pct ? ` × ${(p.detalle.pct * 100).toFixed(2)} %` : ''}` : (p.origen === 'manual' ? 'captura manual' : '—')}
      </span>
    ) },
    { key: 'estado', label: 'Flujo', align: 'left', width: 150, render: (p) => <FlujoBarras estado={p.estado} /> },
    { key: 'fecha_programada', label: 'Fecha pago', align: 'left', width: 96, render: (p) => {
      const f = p.fecha_programada || p.fecha_compromiso;
      if (!f) return <span style={{ color: theme.textMuted }}>—</span>;
      const dias = diasParaPago(p, hoy);
      const alerta = estaAbierto(p) && dias !== null && dias < 0;
      return <span style={{ ...MONO, fontSize: 11, color: alerta ? theme.red : theme.text }}>{String(f).slice(5, 10).replace('-', '/')}{alerta ? ` · ${Math.abs(dias)}d` : ''}</span>;
    } },
    { key: 'acc', label: '', align: 'right', width: 120, render: (p) => {
      const meta = ESTADO_META[p.estado];
      if (!meta?.accion || !puedeEditar(p.cliente)) return null;
      return <Boton onClick={(e) => { e?.stopPropagation?.(); setExpandido(p.id); }}>{meta.accion}</Boton>;
    } },
  ];

  const conteoTipo = (t) => delMes.filter((p) => p.tipo === t).length;
  const conteoCliente = (c) => d.pagos.filter((p) => p.cliente === c && (String(p.fecha_programada || p.fecha_compromiso || '').slice(0, 7) === per || p.periodo === per)).length;
  const reglaDest = reglaDe(d.reglas, '_global', 'destinatarios');

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-stagger>
      {/* 1 · Hero */}
      <Hero
        eyebrow={`Pagos · ${filtroCliente === 'todos' ? visibles.map((k) => CLIENTE_LABEL[k]).join(' · ') : CLIENTE_LABEL[filtroCliente]} · ${MESES[mes - 1]} ${anio}`}
        titulo={frase}
        sub={sub}
        stats={[
          { k: 'Comprometido', v: mxnCorto(comprometido), sub: `${pctAuto} % automático` },
          { k: 'Pagado en el mes', v: mxnCorto(pagado), sub: `${pagadoMes.length} pago(s)` },
          { k: 'Vence en 7 días', v: mxnCorto(vencenMonto), sub: `${vencen.length} pago(s)` },
        ]}
      >
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Segmented size="sm"
            options={[{ id: 'todos', label: 'Todos' }, ...visibles.map((k) => ({ id: k, label: CLIENTE_LABEL[k] }))]}
            value={filtroCliente} onChange={setFiltroCliente} />
          {puedeAlgo && <Boton icon={Plus} onClick={() => setFormManual(true)}>Pago manual</Boton>}
          {puedeAlgo && porSolicitar.length > 0 && <Boton icon={Send} onClick={solicitarCalculados}>Solicitar los calculados ({porSolicitar.length})</Boton>}
          <ExportMenu titulo={`Pagos · ${MESES[mes - 1]} ${anio}`} subtitulo={frase} excel={exportarLote} pdf={{ ref: rootRef }} />
          <FrescuraPill pantalla="pagos" clienteKey={filtroCliente === 'todos' ? null : filtroCliente} inverso />
          {!DB_CONFIGURED && <Pill tone="orange" size="xs">Solo lectura</Pill>}
        </div>
      </Hero>

      {/* 2 · KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Del mes" titulo="Comprometido" big={mxnCorto(comprometido)} sub={`${delMes.length} pagos · ${pctAuto} % automático`} progress={pctAuto} />
        <KpiCard eyebrow="Flujo" titulo="Por solicitar" big={String(porSolicitar.length)} bigSmall={mxnCorto(porSolicitar.reduce((s, p) => s + Number(p.monto || 0), 0))} sub="calculados sin correo" onClick={() => setFiltroEtapa(filtroEtapa === 'calculado' ? null : 'calculado')} />
        <KpiCard eyebrow="Flujo" titulo="Esperan autorización" big={String(porAutorizar.length)} bigSmall={mxnCorto(porAutorizar.reduce((s, p) => s + Number(p.monto || 0), 0))} sub="solicitados" onClick={() => setFiltroEtapa(filtroEtapa === 'solicitado' ? null : 'solicitado')} />
        <KpiCard eyebrow="Riesgo" titulo="Vencen en 7 días" big={String(vencen.length)} bigSmall={mxnCorto(vencenMonto)} bigColor={vencen.length ? theme.orange : undefined} sub={`${delMes.filter((p) => estaVencido(p, hoy)).length} ya vencido(s)`} onClick={() => setSoloVencidos((v) => !v)} />
      </div>

      {/* 3 · Flujo del mes */}
      <Panel titulo="Flujo del mes" meta="clic en una etapa filtra la tabla">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 6 }}>
          {flujo.map((e) => {
            const activo = filtroEtapa === e.id;
            return (
              <button key={e.id} onClick={() => setFiltroEtapa(activo ? null : e.id)} style={{
                textAlign: 'left', padding: '8px 10px', borderRadius: 12, cursor: 'pointer',
                border: `1px solid ${activo ? (theme.accent || '#007AFF') : theme.border}`,
                background: activo ? `${theme.accent || '#007AFF'}0F` : 'transparent', color: theme.text,
              }}>
                <div style={{ ...MONO, fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{e.n}</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{e.label}</div>
                <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{mxnCorto(e.monto)} · {e.sub}</div>
              </button>
            );
          })}
        </div>
      </Panel>

      {/* 4 · Calendario */}
      <Calendario pagos={delMes} anio={anio} mes={mes} hoyISO={hoy}
                  onMes={(a, m) => { setAnio(a); setMes(m); }}
                  onPago={(p) => setExpandido(p.id)} />

      {/* 5 · Pagos del mes */}
      <Panel titulo="Pagos del mes" meta="clic en una fila abre el cálculo, la evidencia y el flujo">
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
          <FiltroPill activo={!filtroOrigen} onClick={() => setFiltroOrigen(null)}>Todos</FiltroPill>
          <FiltroPill activo={filtroOrigen === 'auto'} onClick={() => setFiltroOrigen(filtroOrigen === 'auto' ? null : 'auto')} n={delMes.filter((p) => p.origen === 'auto').length}>Automáticos</FiltroPill>
          <FiltroPill activo={filtroOrigen === 'manual'} onClick={() => setFiltroOrigen(filtroOrigen === 'manual' ? null : 'manual')} n={delMes.filter((p) => p.origen === 'manual').length}>Manuales</FiltroPill>
          <span style={{ width: 10 }} />
          {visibles.map((c) => (
            <FiltroPill key={c} activo={filtroCliente === c} onClick={() => setFiltroCliente(filtroCliente === c ? 'todos' : c)} n={conteoCliente(c)}>{CLIENTE_LABEL[c]}</FiltroPill>
          ))}
          <span style={{ width: 10 }} />
          {Object.keys(TIPO_META).filter((t) => conteoTipo(t) > 0).map((t) => (
            <FiltroPill key={t} activo={filtroTipo === t} onClick={() => setFiltroTipo(filtroTipo === t ? null : t)} n={conteoTipo(t)}>{TIPO_META[t].label}</FiltroPill>
          ))}
          <FiltroPill activo={soloVencidos} onClick={() => setSoloVencidos((v) => !v)} n={delMes.filter((p) => estaVencido(p, hoy)).length}>Vencidos</FiltroPill>
          {(filtroEtapa || filtroTipo || filtroOrigen || soloVencidos) && (
            <FiltroPill onClick={() => { setFiltroEtapa(null); setFiltroTipo(null); setFiltroOrigen(null); setSoloVencidos(false); }}>Limpiar filtros</FiltroPill>
          )}
        </div>

        {filtroEtapa && <Nota style={{ marginBottom: 6 }}>Filtrando por etapa: {ESTADO_META[filtroEtapa]?.label}.</Nota>}

        <TablaCompacta
          columnas={columnas} filas={filtrados} rowKey={(p) => p.id}
          onRowClick={(p) => setExpandido(expandido === p.id ? null : p.id)}
          expandidoKey={expandido}
          renderExpandido={(p) => (
            <DrillPago
              pago={p} perfil={perfil} puedeEditar={puedeEditar(p.cliente)} reglaDestinatarios={reglaDest}
              onAccion={accion}
              onRegistrarPago={(pg) => setRegistrando(pg)}
              onBorrar={(pg) => { if (window.confirm(`¿Borrar "${pg.concepto}"?`)) recargarTras(() => borrarPago({ pago: pg }), 'Pago borrado'); }}
            />
          )}
          vacio="Sin pagos en este mes con los filtros aplicados."
        />

        {correoLoteTxt && (
          <div style={{ marginTop: 8, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>Correo del lote</span>
              <span style={{ display: 'inline-flex', gap: 6 }}>
                <Boton icon={Mail} onClick={async () => { try { await navigator.clipboard.writeText(correoLoteTxt.texto); toast.ok('Copiado'); } catch { toast.error('Copia el texto a mano'); } }}>Copiar</Boton>
                <Boton onClick={() => setCorreoLoteTxt(null)}>Cerrar</Boton>
              </span>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11, lineHeight: 1.5, ...MONO, maxHeight: 300, overflowY: 'auto' }}>{correoLoteTxt.texto}</pre>
          </div>
        )}
      </Panel>

      {/* 6 · Cálculo */}
      <PanelCalculo
        clientes={clientesFiltro} reglas={d.reglas} datosMotor={d.datosMotor}
        anio={anio} mes={mes} dinamica={d.dinamica} pagos={d.pagos}
        puedeEditar={puedeEditar}
        onCrearPago={crearDesdePropuesta}
        onGuardarDinamica={(x) => recargarTras(() => guardarDinamica({ ...x, perfil }), 'Meta y premios guardados')}
      />

      {/* 6b · Marketing: cargo a fondo o paga la empresa */}
      <PanelMarketing
        actividades={d.actividades} clientes={clientesFiltro} anio={anio} mes={mes}
        fondos={d.fondos} pagos={d.pagos} puedeEditar={puedeEditar}
        onCambio={d.recargar} onCrearPago={crearDesdePropuesta}
      />

      {/* 7 · Fondos */}
      <PanelFondos
        fondos={d.fondos} movimientos={d.movFondos} clientes={clientesFiltro} puedeEditar={puedeEditar}
        onMovimiento={(x) => recargarTras(() => movimientoFondo({ ...x, perfil }), 'Movimiento registrado')}
      />

      {/* 8 · Reglas con candado */}
      <PanelReglas
        clientes={visibles} reglas={d.reglas} puedeEditar={puedeEditar}
        onGuardar={(x) => recargarTras(() => guardarRegla({ ...x, perfil }), null)}
      />

      {/* 9 · Historial de pagados */}
      <HistorialPagados pagos={d.pagos} clientes={clientesFiltro} />

      <FormPagoManual
        abierto={formManual} onCerrar={() => setFormManual(false)}
        clientes={visibles.filter(puedeEditar)} clienteInicial={filtroCliente === 'todos' ? null : filtroCliente}
        anio={anio} mes={mes}
        onGuardar={(datos) => recargarTras(() => crearPagoManual({ datos, perfil }), 'Pago manual creado')}
      />

      <HojaRegistrarPago
        pago={registrando} abierto={!!registrando} onCerrar={() => setRegistrando(null)}
        onGuardar={({ pago, extra }) => recargarTras(() => cambiarEstado({ pago, hacia: 'pagado', perfil, extra, nota: `NC ${extra.nc_folio}` }), 'Pago registrado')}
      />
    </div>
  );
}

function HistorialPagados({ pagos, clientes }) {
  const { theme } = useTheme();
  const filas = useMemo(() => pagos
    .filter((p) => p.estado === 'pagado' && clientes.includes(p.cliente))
    .sort((a, b) => String(b.pagado_at || b.fecha_pago_real || '').localeCompare(String(a.pagado_at || a.fecha_pago_real || ''))),
    [pagos, clientes.join(',')]);
  const total = filas.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  return (
    <Panel titulo="Historial de pagados" plegable abiertoInicial={false} meta={`${filas.length} pagos · ${mxn(total)}`}>
      <TablaCompacta
        dense maxHeight={420}
        columnas={[
          { key: 'fecha', label: 'Pagado', align: 'left', width: 92, render: (p) => String(p.pagado_at || p.fecha_pago_real || '').slice(0, 10) || '—' },
          { key: 'cliente', label: 'Cliente', align: 'left', width: 104, render: (p) => <ClientePill clienteKey={p.cliente} /> },
          { key: 'concepto', label: 'Concepto', align: 'left' },
          { key: 'tipo', label: 'Tipo', align: 'left', width: 110, render: (p) => <Pill tone={TIPO_META[p.tipo]?.tone || 'gray'} size="xs">{TIPO_META[p.tipo]?.label || p.tipo}</Pill> },
          { key: 'nc', label: 'Nota de crédito', align: 'left', width: 150, render: (p) => p.nc_folio ? `${p.nc_folio}${p.nc_factura ? ` → ${p.nc_factura}` : ''}` : (p.folio || '—') },
          { key: 'monto', label: 'Monto', width: 100, sum: true, render: (p) => <span style={MONO}>{mxn(p.monto)}</span> },
        ]}
        filas={filas} rowKey={(p) => p.id}
        vacio="Todavía no hay pagos registrados como pagados."
      />
    </Panel>
  );
}
