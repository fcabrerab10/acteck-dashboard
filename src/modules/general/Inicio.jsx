// Inicio · pestaña de dirección general armada con el kit V3 (plantilla HomeClienteV3).
// Una sola pestaña con dos modos (Fernando, 2026-10-01: «Inicio y Visión General se me hacen repetitivas», opción A):
//   Hoy  = qué atender hoy: hero MTD, bandeja Hoy, 4 KPIs, decisiones, mis clientes, agenda.
//   Año  = cómo va el año: la antigua Visión General (rentabilidad, mix, tendencia 3 años, sell out, inventario).
// La gráfica de ventas 12 m y el panel de canales salieron de Hoy porque viven en Año. Visión General ya no está en
// el menú; `pagina: 'visionGeneral'` abre Inicio en modo Año (PaginaContenido).
// Carga en inicio/useInicioData.js (sólo lib/queries), cálculos en inicio/calc.js, bloques en inicio/bloques.jsx.
// Se monta lazy desde App.jsx en paginaActiva === 'inicio' con props { onNavegar(clienteKey|null, pagina) }.
import React, { lazy, Suspense, useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerInicio, puedeVerSensible, puedeVerPestanaGlobal, puedeVerCliente } from '../../lib/permisos';
import { useAlertas } from '../../lib/alertas';
import { useFrescura } from '../../lib/frescura';
import { moneyCompact as $c, int, pct, pp, fecha } from '../../lib/format';
import { tooltip } from '../../lib/medidas';
import SinAcceso from '../../components/SinAcceso';
import FrescuraPill from '../../components/FrescuraPill';
import { Hero, KpiCard, Pill, Panel, Segmented, SkeletonPantalla, Cargando } from '../../components/kit';
const VisionGeneral = lazy(() => import('../comercial/VisionGeneral'));
const VISTAS = [{ id: 'hoy', label: 'Hoy' }, { id: 'anio', label: 'Año' }];
import { FUENTES_INICIO, PAGINAS, MAX_ALERTAS, abrirNotificaciones } from './inicio/config';
import { useInicioData } from './inicio/useInicioData';
import { calcular } from './inicio/calc';
import { DecisionPanel, ClientesGrid, AgendaPanel, HoyPanel } from './inicio/bloques';

const signo = (v, d = 0) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const toneDe = (v) => (v == null ? 'gray' : v >= 0 ? 'green' : 'red');
const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Inicio({ onNavegar, vistaInicial = 'hoy' }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const [vista, setVista] = useState(vistaInicial);
  const modo = 'mes'; // Hoy siempre es el mes en curso; el acumulado del año vive en el modo Año
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const { loading, error, data } = useInicioData(anio);
  const alertasQ = useAlertas({ clienteKey: null });
  const { porFuente } = useFrescura(true);

  // Permisos: lo sensible (márgenes, contribución, utilidad, costos) sólo con el permiso; los bloques
  // globales sólo si el usuario ve esa pestaña; las tarjetas de cliente sólo de los clientes que ve.
  const sensible = puedeVerSensible(perfil);
  const ve = useMemo(() => ({
    visionGeneral: puedeVerPestanaGlobal(perfil, 'vision_general'),
    cobranza: puedeVerPestanaGlobal(perfil, 'cobranza_global'),
    inventario: puedeVerPestanaGlobal(perfil, 'inventario_global'),
    sellIn: puedeVerPestanaGlobal(perfil, 'sell_in'),
  }), [perfil]);
  const clientesVisibles = useMemo(() => ['digitalife', 'pcel', 'dicotech'].filter((k) => puedeVerCliente(perfil, k)), [perfil]);
  const r = useMemo(() => (data ? calcular(data, alertasQ.data || [], { anio, mesActual, hoy, modo, sensible, clientesVisibles }) : null), [data, alertasQ.data, anio, mesActual, hoy, modo, sensible, clientesVisibles]);

  if (!puedeVerInicio(perfil)) return <SinAcceso motivo="No tienes acceso a Inicio." />;

  const barra = (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 10.5, color: theme.textMuted }}>{vista === 'hoy' ? `Qué atender hoy · ${fmtDia.format(hoy).replace(',', '')}` : `Cómo va el año · ${anio}`}</span>
      {ve.visionGeneral && <Segmented options={VISTAS} value={vista} onChange={setVista} />}
    </div>
  );
  if (vista === 'anio' && ve.visionGeneral) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {barra}
        <Suspense fallback={<Cargando pantalla="visionGeneral" minHeight={520} />}><VisionGeneral /></Suspense>
      </div>
    );
  }
  if (loading || (!r && !error)) return <SkeletonPantalla pantalla="inicio" />;
  if (error) return <Panel titulo="No se pudo cargar Inicio"><div style={{ fontSize: 12, color: theme.red }}>{error}</div></Panel>;

  const ir = (ck, pagina) => (onNavegar ? () => onNavegar(ck, pagina) : undefined);
  const esMes = modo === 'mes';
  const labelPeriodo = esMes ? `MTD · ${r.mesL}` : `YTD ${anio}`;
  const labelOtro = esMes ? `YTD ${anio}` : `MTD · ${r.mesL}`;
  const c = r.cur, cart = r.cartera, inv = r.inv;
  const diaTxt = fmtDia.format(hoy).replace(',', '');

  // La facturación de TODA la empresa es información sensible (Fernando, 2026-09-21): sin el permiso, el hero
  // no muestra Fact Neta ni margen ni la gráfica de ventas de la empresa; sólo lo de sus clientes y su día.
  const veEmpresa = sensible;
  const statsSinEmpresa = [
    { k: 'Clientes que ves', v: String(r.clientes.length), sub: r.clientes.map((c) => c.nombre || c.clienteKey || c.key).filter(Boolean).slice(0, 3).join(' · ') || 'ninguno' },
    { k: 'Avisos', v: String(r.decision.length), sub: 'que atender hoy' },
    { k: 'Fact Neta · mis clientes', v: $c(r.clientes.reduce((a, c) => a + (Number(c.fact) || 0), 0)), sub: `${labelPeriodo} · sólo los clientes que ves` },
  ];
  const stats = veEmpresa ? [
    { k: `Fact Neta · ${labelPeriodo}`, medida: tooltip('fact_neta', labelPeriodo), v: $c(c.fact_neta), sub: r.pctCuota != null ? `${Math.round(r.pctCuota)}% de cuota${r.yoy != null ? ` · ${signo(r.yoy)} ${r.yoyLabel}` : ''}` : r.yoy != null ? `${signo(r.yoy)} ${r.yoyLabel}` : 'sin cuota' },
    ...(sensible ? [
      { k: 'Margen al momento', medida: tooltip('pct_mc'), v: c.mc != null ? pct(c.mc) : '—', sub: c.muc != null ? `MUC ${pct(c.muc)}${r.dMc != null ? ` · ${pp(r.dMc)} YoY` : ''}` : 'MC sobre Fact Neta' },
      { k: 'Utilidad comercial', medida: tooltip('utilidad_comercial'), v: $c(c.utilidad_comercial), sub: r.yoyUtilidad != null ? `${signo(r.yoyUtilidad, 1)} vs ${anio - 1}${esMes ? ' a mismo día' : ''}` : 'sin comparativo', color: r.yoyUtilidad == null ? undefined : r.yoyUtilidad >= 0 ? theme.green : theme.red },
    ] : [
      { k: `Fact Neta · ${labelOtro}`, medida: tooltip('fact_neta', labelOtro), v: $c(r.otro.fact_neta), sub: r.pctOtro != null ? `${Math.round(r.pctOtro)}% de cuota` : r.yoyOtro != null ? `${signo(r.yoyOtro)} YoY` : 'sin cuota' },
      { k: 'Piezas netas', medida: tooltip('piezas_venta_neta'), v: int(c.piezas), sub: c.ticket != null ? `ticket promedio ${$c(c.ticket)}` : labelPeriodo },
    ]),
  ] : statsSinEmpresa;

  const lostTxt = `lost profit ${$c(c.lost)}${c.lostPct != null ? ` (${pct(c.lostPct)} de la bruta)` : ''}`;
  const coberturaTone = inv.cobertura == null ? 'gray' : inv.cobertura > 120 ? 'orange' : inv.cobertura < 30 ? 'red' : 'green';

  return (
    <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      {barra}

      <Hero
        eyebrow={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Inicio · {diaTxt}<span style={{ textTransform: 'none', letterSpacing: 0 }}><FrescuraPill fuentes={FUENTES_INICIO} inverso /></span></span>}
        titulo={veEmpresa ? r.titulo : `Hoy tienes ${r.decision.length} aviso${r.decision.length === 1 ? '' : 's'} que atender.`} sub={veEmpresa ? r.sub : `Tus clientes: ${r.clientes.map((c) => c.nombre || c.label || c.key).filter(Boolean).join(' · ') || 'ninguno'}.`} dot={r.decision.some((a) => a.severidad === 'critica')} stats={stats}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {r.decision.slice(0, 3).map((a) => <Pill key={a.id} tone={a.severidad === 'critica' ? 'red' : 'orange'} dot title={a.detalle || ''}>{a.titulo}</Pill>)}
          {veEmpresa && r.cuota.fuente && <Pill tone="inverse" size="xs" title="Origen de la cuota total">cuota {r.cuota.fuente === 'cuotas_canales' ? 'anual (canales)' : 'Σ clientes'} {$c(r.cuota.anual)}</Pill>}
        </div>
      </Hero>

      {/* Bloque "Hoy" (Agenda V3): bandeja compacta compartida con la pestaña Agenda */}
      <HoyPanel onNavegar={onNavegar} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        {veEmpresa && <KpiCard medida={tooltip('pct_alcance_venta')} eyebrow={`Fact Neta · ${labelOtro}`} badge={r.yoyOtro != null ? { l: `${signo(r.yoyOtro)} ${esMes ? 'YoY' : 'YoY a mismo día'}`, tone: toneDe(r.yoyOtro) } : undefined}
          big={$c(r.otro.fact_neta)} bigSmall={r.cuotaOtro ? `de ${$c(r.cuotaOtro)}` : ''}
          sub={[r.pctOtro != null ? `${Math.round(r.pctOtro)}% de cuota ${esMes ? 'YTD' : 'del mes'}` : 'sin cuota', r.pctAnual != null ? `${Math.round(r.pctAnual)}% de la anual ${$c(r.cuota.anual)}` : null].filter(Boolean).join(' · ')}
          progress={r.pctOtro ?? undefined} onClick={ve.visionGeneral ? () => setVista('anio') : undefined} />}
        {sensible
          ? <KpiCard medida={tooltip('contribucion')} eyebrow={`Contribución · ${labelPeriodo}`} badge={r.dMc != null ? { l: `${pp(r.dMc)} MC`, tone: r.dMc >= 0 ? 'green' : 'red' } : undefined}
              big={$c(c.contribucion)} bigSmall={c.mc != null ? `MC ${pct(c.mc)}` : ''}
              sub={`${lostTxt} · dev ${$c(c.devoluciones)} · RMA ${$c(c.rmas)} · bonif ${$c(c.bonificaciones)}`}
              onClick={ve.visionGeneral ? () => setVista('anio') : undefined} />
          : <KpiCard medida={tooltip('pct_lost_profit_bonif', "Devoluciones + RMA's + Bonificaciones")} eyebrow={`Deducciones · ${labelPeriodo}`} badge={c.lostPct != null ? { l: `${pct(c.lostPct)} de la bruta`, tone: c.lostPct > 8 ? 'orange' : 'gray' } : undefined}
              big={$c(c.lost)} bigSmall="dev + RMA + bonif"
              sub={`dev ${$c(c.devoluciones)} · RMA ${$c(c.rmas)} · bonif ${$c(c.bonificaciones)}`}
              onClick={ve.visionGeneral ? () => setVista('anio') : undefined} />}
        {ve.cobranza && <KpiCard eyebrow={cart.corte ? `Cartera · corte ${fecha(cart.corte)}` : 'Cartera'} badge={cart.vencido > 0 ? { l: `${$c(cart.vencido)} vencido`, tone: cart.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al corriente', tone: 'green' }}
          big={$c(cart.saldo)} bigSmall={`${cart.filas.length} cliente${cart.filas.length === 1 ? '' : 's'}`} bigColor={cart.vencido > 0 && cart.pctVencido > 25 ? theme.red : undefined}
          sub={[cart.dso != null ? `DSO ${cart.dso} d` : null, cart.mas90 > 0 ? `${$c(cart.mas90)} > 90 d` : null, cart.filas[0]?.vencido > 0 ? `${cart.filas[0].cliente}: ${$c(cart.filas[0].vencido)} vencido` : null].filter(Boolean).join(' · ') || 'sin estados de cuenta'}
          onClick={ir(null, PAGINAS.cobranza)} />}
        {ve.inventario && <KpiCard medida={`${tooltip('inv_actual')} — ${tooltip('dias_inv')}`} eyebrow="Inv Actual + tránsito" badge={{ l: inv.cobertura != null ? `${inv.cobertura} d de inv` : 'sin ritmo', tone: coberturaTone }}
          big={sensible ? $c(inv.valor) : int(inv.piezas)} bigSmall={sensible ? `+ ${$c(inv.transitoValor)} en tránsito` : `pzs · + ${int(inv.transitoPzs)} en tránsito`}
          sub={`${int(inv.transitoPzs)} pzs en ${inv.pos} PO · ${int(inv.skus)} SKUs con stock${inv.skusRiesgo ? ` · ${inv.skusRiesgo} SKUs en riesgo` : ''}`}
          onClick={ir(null, PAGINAS.inventario)} />}
      </div>

      <DecisionPanel r={r} onNavegar={onNavegar} onNotificaciones={() => abrirNotificaciones(onNavegar, perfil)} max={MAX_ALERTAS} />
      {r.clientes.length > 0 && <ClientesGrid r={r} onNavegar={onNavegar} />}
      <AgendaPanel r={r} frescuraErp={porFuente.erp_ventas} onNavegar={onNavegar} />
    </div>
  );
}
