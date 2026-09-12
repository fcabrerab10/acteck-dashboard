// Pagos unificados · V3 (2026-09-12)
//
// UNA pestaña para Digitalife, PCEL y Dicotech. Desde el menú de un cliente se abre ya
// filtrada (prop `clienteKey`). Eje elegido por Fernando: calendario del mes + pipeline.
//
// Diseño B (2026-09-12): arriba un mini resumen de las TRES cuentas (tarjetas que también
// eligen el cliente); todo lo demás es de UN cliente a la vez: Hero → Flujo del mes →
// Pagos del mes (tabla con drill) + Calendario → una sección secundaria a la vez
// (Cálculo · Marketing · Fondo · Reglas · Historial). Ninguna cifra se repite.
//
// El 90 % de los pagos los calcula el motor (pagosv3/motor.js, el mismo que usa el cron
// en api/_pagos.js); el resto se captura a mano. Todos siguen un solo flujo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Send, Mail } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { DB_CONFIGURED } from '../../lib/supabase';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { Hero, Panel, Pill, Segmented, TablaCompacta, Boton, Cargando, toast } from '../../components/kit';
import FrescuraPill from '../../components/FrescuraPill';

import M from './pagosv3/motor';
import { CLIENTE_LABEL, CLIENTE_COLOR, reglaDe } from './pagosv3/reglas';
import { ETAPAS, ESTADO_META, TIPO_META, estaAbierto, estaVencido, venceEn, resumenFlujo, diasParaPago } from './pagosv3/estados';
import { correoLote } from './pagosv3/correo';
import {
  useDatosPagos, puedeEditarPagos, cambiarEstado, guardarPropuestas, crearPagoManual,
  borrarPago, guardarRegla, guardarDinamica, movimientoFondo,
} from './pagosv3/datos';
import {
  mxn, mxnCorto, MONO, Nota, FiltroPill, TipoPill, ClientePill, FlujoBarras,
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
  const [cliente, setCliente] = useState(clienteKey || null);   // un cliente a la vez (diseño B)
  const [seccion, setSeccion] = useState('calculo');             // sección secundaria visible
  const [filtroEtapa, setFiltroEtapa] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState(null);
  const [filtroOrigen, setFiltroOrigen] = useState(null);
  const [soloVencidos, setSoloVencidos] = useState(false);
  const [expandido, setExpandido] = useState(null);
  const [formManual, setFormManual] = useState(false);
  const [registrando, setRegistrando] = useState(null);
  const [correoLoteTxt, setCorreoLoteTxt] = useState(null);

  useEffect(() => { if (clienteKey) setCliente(clienteKey); }, [clienteKey]);

  const d = useDatosPagos({ perfil, anio, mes });
  const visibles = d.visibles;
  const per = M.periodoMes(anio, mes);

  const puedeEditar = (c) => puedeEditarPagos(perfil, c);

  const esDelMes = (p) => {
    const f = p.fecha_programada || p.fecha_compromiso;
    if (!f) return p.periodo === per;
    return String(f).slice(0, 7) === per;
  };
  const delMesTodos = useMemo(() => d.pagos.filter(esDelMes), [d.pagos, per]);

  // ── Mini resumen de las tres cuentas (y selector) ──
  const cuentas = useMemo(() => visibles.map((k) => {
    const mios = delMesTodos.filter((p) => p.cliente === k);
    const vivos = mios.filter((p) => p.estado !== 'cancelado');
    const fondo = (d.fondos || []).filter((f) => f.cliente === k && f.activo !== false).reduce((s, f) => s + (Number(f.saldo) || 0), 0);
    return {
      key: k,
      comprometido: vivos.reduce((s, p) => s + (Number(p.monto) || 0), 0),
      n: vivos.length,
      porSolicitar: mios.filter((p) => p.estado === 'calculado' && Number(p.monto) > 0).length,
      porAutorizar: mios.filter((p) => p.estado === 'solicitado').length,
      vencidos: mios.filter((p) => estaVencido(p, hoy)).length,
      vencen: mios.filter((p) => venceEn(p, 7, hoy) || estaVencido(p, hoy)).length,
      pagado: mios.filter((p) => p.estado === 'pagado').reduce((s, p) => s + (Number(p.monto) || 0), 0),
      fondo,
    };
  }), [visibles.join(','), delMesTodos, d.fondos, hoy]);

  // Cliente inicial: el que trae algo por solicitar; si no, el primero.
  useEffect(() => {
    if (cliente && visibles.includes(cliente)) return;
    if (!visibles.length) return;
    const conPendiente = cuentas.find((c) => c.porSolicitar > 0 || c.vencidos > 0);
    setCliente(conPendiente?.key || visibles[0]);
  }, [visibles.join(','), cuentas, cliente]);

  const clienteSel = cliente && visibles.includes(cliente) ? cliente : visibles[0];
  const clientesFiltro = clienteSel ? [clienteSel] : [];
  const puedeAlgo = clienteSel ? puedeEditar(clienteSel) : false;

  // ── Pagos del mes del cliente elegido ──
  const delMes = useMemo(() => delMesTodos.filter((p) => p.cliente === clienteSel), [delMesTodos, clienteSel]);

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

  const nombreSel = CLIENTE_LABEL[clienteSel] || clienteSel;
  const fondoSel = cuentas.find((c) => c.key === clienteSel)?.fondo ?? null;
  const frase = `${nombreSel} lleva ${mxnCorto(comprometido)} comprometidos en ${MESES[mes - 1].toLowerCase()}${porSolicitar.length ? ` y ${porSolicitar.length} pago(s) esperan tu correo` : ''}`;
  const totalTres = {
    comprometido: cuentas.reduce((s, c) => s + c.comprometido, 0),
    porSolicitar: cuentas.reduce((s, c) => s + c.porSolicitar, 0),
    porAutorizar: cuentas.reduce((s, c) => s + c.porAutorizar, 0),
    vencen: cuentas.reduce((s, c) => s + c.vencen, 0),
    pagado: cuentas.reduce((s, c) => s + c.pagado, 0),
    fondo: cuentas.reduce((s, c) => s + c.fondo, 0),
  };
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
  const reglaDest = reglaDe(d.reglas, '_global', 'destinatarios');
  const SECCIONES = [
    { id: 'calculo', label: 'Cálculo' },
    { id: 'marketing', label: 'Marketing' },
    { id: 'fondo', label: 'Fondo' },
    { id: 'reglas', label: 'Reglas' },
    { id: 'historial', label: 'Historial' },
  ];

  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-stagger>
      {/* 0 · Mini resumen de las tres cuentas · las tarjetas eligen el cliente */}
      {visibles.length > 1 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap', padding: '0 2px' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.textMuted }}>Las tres cuentas · {MESES[mes - 1]} {anio}</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>
              <b style={{ color: theme.text, ...MONO }}>{mxnCorto(totalTres.comprometido)}</b> comprometidos
              {totalTres.porSolicitar ? <> · <b style={{ color: theme.text }}>{totalTres.porSolicitar}</b> por solicitar</> : null}
              {totalTres.porAutorizar ? <> · <b style={{ color: theme.text }}>{totalTres.porAutorizar}</b> por autorizar</> : null}
              {totalTres.vencen ? <> · <b style={{ color: theme.orange }}>{totalTres.vencen}</b> vence(n) en 7 días</> : null}
              {' · '}<b style={{ color: theme.text, ...MONO }}>{mxnCorto(totalTres.pagado)}</b> pagados
              {' · fondos '}<b style={{ color: theme.text, ...MONO }}>{mxnCorto(totalTres.fondo)}</b>
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cuentas.length}, minmax(0, 1fr))`, gap: 8 }}>
            {cuentas.map((c) => {
              const on = c.key === clienteSel;
              const color = CLIENTE_COLOR[c.key] || theme.accent;
              return (
                <button key={c.key} onClick={() => { setCliente(c.key); setFiltroEtapa(null); setFiltroTipo(null); setFiltroOrigen(null); setSoloVencidos(false); setExpandido(null); }}
                  style={{ textAlign: 'left', padding: '10px 12px', borderRadius: 12, cursor: 'pointer', minWidth: 0,
                    border: `1px solid ${on ? color : theme.border}`, background: on ? `${color}14` : theme.surface, color: theme.text,
                    boxShadow: on ? `inset 0 0 0 1px ${color}` : 'none', transition: 'background 160ms, border-color 160ms' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0 }} />
                    <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 700 }}>{CLIENTE_LABEL[c.key]}</span>
                    {c.vencidos > 0 && <Pill tone="red" size="xs">{c.vencidos} vencido{c.vencidos > 1 ? 's' : ''}</Pill>}
                  </div>
                  <div style={{ ...MONO, fontSize: 19, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2, lineHeight: 1.1 }}>{mxnCorto(c.comprometido)}</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.n} pago{c.n === 1 ? '' : 's'}{c.porSolicitar ? ` · ${c.porSolicitar} por solicitar` : ''}{c.porAutorizar ? ` · ${c.porAutorizar} por autorizar` : ''} · fondo {mxnCorto(c.fondo)}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 1 · Hero del cliente elegido · las únicas cifras en dinero de la pantalla */}
      <Hero
        eyebrow={`Pagos · ${nombreSel} · ${MESES[mes - 1]} ${anio}`}
        titulo={frase}
        sub={sub}
        stats={[
          { k: 'Comprometido', v: mxnCorto(comprometido), sub: `${delMes.length} pagos · ${pctAuto} % automático` },
          { k: 'Pagado en el mes', v: mxnCorto(pagado), sub: `${pagadoMes.length} pago(s)` },
          { k: 'Vence en 7 días', v: mxnCorto(vencenMonto), sub: `${vencen.length} pago(s)${delMes.filter((p) => estaVencido(p, hoy)).length ? ` · ${delMes.filter((p) => estaVencido(p, hoy)).length} ya vencido(s)` : ''}` },
          ...(fondoSel != null ? [{ k: 'Fondo', v: mxnCorto(fondoSel), sub: 'disponible' }] : []),
        ]}
      >
        <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {puedeAlgo && <Boton icon={Plus} onClick={() => setFormManual(true)}>Pago manual</Boton>}
          {puedeAlgo && porSolicitar.length > 0 && <Boton icon={Send} onClick={solicitarCalculados}>Solicitar los calculados ({porSolicitar.length})</Boton>}
          <ExportMenu titulo={`Pagos · ${nombreSel} · ${MESES[mes - 1]} ${anio}`} subtitulo={frase} excel={exportarLote} pdf={{ ref: rootRef }} />
          <FrescuraPill pantalla="pagos" clienteKey={clienteSel} inverso />
          {!DB_CONFIGURED && <Pill tone="orange" size="xs">Solo lectura</Pill>}
        </div>
      </Hero>

      {/* 2 · Flujo del mes · cuenta en pagos (el hero cuenta en dinero) · cada etapa filtra la tabla */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 6 }}>
        {flujo.map((e) => {
          const activo = filtroEtapa === e.id;
          return (
            <button key={e.id} onClick={() => setFiltroEtapa(activo ? null : e.id)} style={{
              textAlign: 'left', padding: '8px 10px', borderRadius: 12, cursor: 'pointer', minWidth: 0,
              border: `1px solid ${activo ? (theme.accent || '#007AFF') : theme.border}`,
              background: activo ? `${theme.accent || '#007AFF'}0F` : theme.surface, color: theme.text,
            }}>
              <div style={{ ...MONO, fontSize: 20, fontWeight: 600, lineHeight: 1.1 }}>{e.n}</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, marginTop: 2 }}>{e.label}</div>
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{mxnCorto(e.monto)} · {e.sub}</div>
            </button>
          );
        })}
      </div>

      {/* 3 · Pagos del mes + calendario, lado a lado */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 8, alignItems: 'start' }}>
        <Panel titulo={`Pagos de ${nombreSel}`} meta="clic en una fila abre el cálculo, la evidencia y el flujo">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <FiltroPill activo={!filtroOrigen && !filtroTipo && !soloVencidos && !filtroEtapa} onClick={() => { setFiltroOrigen(null); setFiltroTipo(null); setSoloVencidos(false); setFiltroEtapa(null); }}>Todos</FiltroPill>
            <FiltroPill activo={filtroOrigen === 'auto'} onClick={() => setFiltroOrigen(filtroOrigen === 'auto' ? null : 'auto')} n={delMes.filter((p) => p.origen === 'auto').length}>Automáticos</FiltroPill>
            <FiltroPill activo={filtroOrigen === 'manual'} onClick={() => setFiltroOrigen(filtroOrigen === 'manual' ? null : 'manual')} n={delMes.filter((p) => p.origen === 'manual').length}>Manuales</FiltroPill>
            <span style={{ width: 10 }} />
            {Object.keys(TIPO_META).filter((t) => conteoTipo(t) > 0).map((t) => (
              <FiltroPill key={t} activo={filtroTipo === t} onClick={() => setFiltroTipo(filtroTipo === t ? null : t)} n={conteoTipo(t)}>{TIPO_META[t].label}</FiltroPill>
            ))}
            {delMes.some((p) => estaVencido(p, hoy)) && (
              <FiltroPill activo={soloVencidos} tone="red" onClick={() => setSoloVencidos((v) => !v)} n={delMes.filter((p) => estaVencido(p, hoy)).length}>Vencidos</FiltroPill>
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

        <Calendario pagos={delMes} anio={anio} mes={mes} hoyISO={hoy}
                    onMes={(a, m) => { setAnio(a); setMes(m); }}
                    onPago={(p) => setExpandido(p.id)} />
      </div>

      {/* 4 · Secundario · una sección a la vez */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '2px 2px 0' }}>
        <Segmented size="sm" options={SECCIONES} value={seccion} onChange={setSeccion} />
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>de {nombreSel}</span>
      </div>

      {seccion === 'calculo' && (
        <PanelCalculo
          clientes={clientesFiltro} reglas={d.reglas} datosMotor={d.datosMotor}
          anio={anio} mes={mes} dinamica={d.dinamica} pagos={d.pagos}
          puedeEditar={puedeEditar}
          onCrearPago={crearDesdePropuesta}
          onGuardarDinamica={(x) => recargarTras(() => guardarDinamica({ ...x, perfil }), 'Meta y premios guardados')}
        />
      )}

      {seccion === 'marketing' && (
        <PanelMarketing
          actividades={d.actividades} clientes={clientesFiltro} anio={anio} mes={mes}
          fondos={d.fondos} pagos={d.pagos} puedeEditar={puedeEditar}
          onCambio={d.recargar} onCrearPago={crearDesdePropuesta} abiertoInicial
        />
      )}

      {seccion === 'fondo' && (
        <PanelFondos
          fondos={d.fondos} movimientos={d.movFondos} clientes={clientesFiltro} puedeEditar={puedeEditar}
          onMovimiento={(x) => recargarTras(() => movimientoFondo({ ...x, perfil }), 'Movimiento registrado')}
        />
      )}

      {seccion === 'reglas' && (
        <PanelReglas
          clientes={clientesFiltro} reglas={d.reglas} puedeEditar={puedeEditar} abiertoInicial
          onGuardar={(x) => recargarTras(() => guardarRegla({ ...x, perfil }), null)}
        />
      )}

      {seccion === 'historial' && <HistorialPagados pagos={d.pagos} clientes={clientesFiltro} abiertoInicial />}

      <FormPagoManual
        abierto={formManual} onCerrar={() => setFormManual(false)}
        clientes={visibles.filter(puedeEditar)} clienteInicial={clienteSel}
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

function HistorialPagados({ pagos, clientes, abiertoInicial = false }) {
  const { theme } = useTheme();
  const filas = useMemo(() => pagos
    .filter((p) => p.estado === 'pagado' && clientes.includes(p.cliente))
    .sort((a, b) => String(b.pagado_at || b.fecha_pago_real || '').localeCompare(String(a.pagado_at || a.fecha_pago_real || ''))),
    [pagos, clientes.join(',')]);
  const total = filas.reduce((s, p) => s + (Number(p.monto) || 0), 0);
  return (
    <Panel titulo="Historial de pagados" plegable abiertoInicial={abiertoInicial} meta={`${filas.length} pagos · ${mxn(total)}`}>
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
