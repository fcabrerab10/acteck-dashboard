// Inicio · pestaña de dirección general armada con el kit V3 (plantilla HomeClienteV3).
// Un solo tablero (Fernando, 2026-10-01: «la híbrida está horrible… lo que debería ver siendo director general: la
// información anual, el mes actual y moverme entre los meses frente al año anterior», propuesta A ajustada):
//   · Selector de período: mes (Ene…Dic) o Año, y año. Por defecto el mes en curso. Todas las cifras del tablero
//     (hero, KPIs, clientes, canales) son de ese período y se comparan con el mismo período del año anterior.
//   · «Hoy» (bandeja de la Agenda) y «Requiere decisión» son fijos: no dependen del período.
//   · «<año> frente a <año-1>»: gráfica y tabla mes a mes; clic en un mes cambia el período de toda la pestaña.
//   · El detalle del año (rentabilidad, mix por marca/categoría, sell out, inventario = la antigua Visión General)
//     va plegado al final y se monta sólo al abrirlo. `pagina: 'visionGeneral'` abre Inicio en modo Año con ese
//     panel abierto (PaginaContenido → vistaInicial='anio').
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
import { Hero, KpiCard, Pill, Panel, SkeletonPantalla, Cargando } from '../../components/kit';
const VisionGeneral = lazy(() => import('../comercial/VisionGeneral'));
const RentabilidadBloque = lazy(() => import('../comercial/RentabilidadBloque'));
import { FUENTES_INICIO, PAGINAS, MAX_ALERTAS, MESES, abrirNotificaciones } from './inicio/config';
import { useInicioData } from './inicio/useInicioData';
import { calcular } from './inicio/calc';
import { DecisionPanel, ClientesGrid, AgendaPanel, HoyPanel, ComparativoAnual, SelectorPeriodo, BarraCuota, SellOutPanel, MixPanel, InventarioPanel } from './inicio/bloques';

const signo = (v, d = 0) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const toneDe = (v) => (v == null ? 'gray' : v >= 0 ? 'green' : 'red');
const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Inicio({ onNavegar, vistaInicial = 'hoy' }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(vistaInicial === 'anio' ? 'anio' : mesHoy);   // 1..12 | 'anio'
  const [verDetalleAnio, setVerDetalleAnio] = useState(vistaInicial === 'anio');
  const modo = mes === 'anio' ? 'anio' : 'mes';
  const { loading, error, data } = useInicioData(anio);
  // Mes de cálculo: el elegido; en modo Año, el último mes con ventas de ese año (o el mes en curso).
  const ultimoMesConDatos = useMemo(() => (data ? (data.medidas || []).filter((r) => Number(r.anio) === anio && Number(r.fact_neta)).reduce((u, r) => Math.max(u, Number(r.mes)), 0) : 0), [data, anio]);
  const mesActual = modo === 'mes' ? mes : (anio === anioHoy ? mesHoy : (ultimoMesConDatos || 12));
  const enCurso = anio === anioHoy && mesActual === mesHoy;
  const anios = useMemo(() => [anioHoy, anioHoy - 1, anioHoy - 2], [anioHoy]);
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
  const r = useMemo(() => (data ? calcular(data, alertasQ.data || [], { anio, mesActual, hoy, modo, sensible, clientesVisibles, enCurso }) : null), [data, alertasQ.data, anio, mesActual, hoy, modo, sensible, clientesVisibles, enCurso]);

  if (!puedeVerInicio(perfil)) return <SinAcceso motivo="No tienes acceso a Inicio." />;

  const esMes = modo === 'mes';
  const barra = (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10.5, color: theme.textMuted }}>{fmtDia.format(hoy).replace(',', '')}{enCurso ? '' : ` · viendo ${esMes ? `${MESES[mesActual - 1]} ${anio}` : anio}`}</span>
      <SelectorPeriodo anio={anio} mes={mes} anioHoy={anioHoy} mesHoy={mesHoy} anios={anios} onChange={(a, m) => { setAnio(a); setMes(m); }} />
    </div>
  );
  if (loading || (!r && !error)) return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{barra}<SkeletonPantalla pantalla="inicio" /></div>;
  if (error) return <Panel titulo="No se pudo cargar Inicio"><div style={{ fontSize: 12, color: theme.red }}>{error}</div></Panel>;

  const ir = (ck, pagina) => (onNavegar ? () => onNavegar(ck, pagina) : undefined);
  const labelPeriodo = esMes ? (enCurso ? `MTD · ${r.mesL}` : `${r.mesL} ${anio}`) : (anio === anioHoy ? `YTD ${anio}` : `${anio}`);
  const c = r.cur, cart = r.cartera, inv = r.inv, so = r.sellOut, ec = r.enCamino;
  const diaTxt = fmtDia.format(hoy).replace(',', '');
  const coberturaTone = inv.cobertura == null ? 'gray' : inv.cobertura > 120 ? 'orange' : inv.cobertura < 30 ? 'red' : 'green';

  // La facturación de TODA la empresa es información sensible (Fernando, 2026-09-21): sin el permiso, el tablero
  // del negocio no se muestra; la persona ve su día, sus avisos y sus clientes.
  const veEmpresa = sensible;
  if (!veEmpresa) {
    return (
      <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
        <Hero eyebrow={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Inicio · {diaTxt}<span style={{ textTransform: 'none', letterSpacing: 0 }}><FrescuraPill fuentes={FUENTES_INICIO} inverso /></span></span>}
          titulo={`Hoy tienes ${r.decision.length} aviso${r.decision.length === 1 ? '' : 's'} que atender.`} sub={`Tus clientes: ${r.clientes.map((x) => x.nombre).join(', ') || 'ninguno'}`}
          stats={[{ k: 'Clientes que ves', v: String(r.clientes.length), sub: r.clientes.map((x) => x.nombre).slice(0, 3).join(' · ') || 'ninguno' }, { k: 'Avisos', v: String(r.decision.length), sub: 'que atender hoy' }]} />
        <HoyPanel onNavegar={onNavegar} />
        <DecisionPanel r={r} onNavegar={onNavegar} onNotificaciones={() => abrirNotificaciones(onNavegar, perfil)} max={MAX_ALERTAS} />
        {r.clientes.length > 0 && <ClientesGrid r={r} onNavegar={onNavegar} />}
      </div>
    );
  }

  // Frase del negocio: sell in (calc.js) + sell out + inventario y camino
  const fraseNegocio = [
    so.total > 0 ? `Sell out ${$c(so.total)}${so.yoy != null ? ` (${signo(so.yoy)} vs ${anio - 1})` : ''}${so.soSi != null ? ` · SO/SI ${so.soSi.toFixed(2)}` : ''}` : null,
    inv.cobertura != null ? `${inv.cobertura} d de inventario` : null,
    ec.valor > 0 ? `${$c(ec.valor)} en camino en ${ec.pos} PO${ec.proximos[0] ? ` · próximo arribo ${fecha(ec.proximos[0].eta)}` : ''}` : null,
    cart.vencido > 0 ? `cartera vencida ${$c(cart.vencido)}` : null,
  ].filter(Boolean).join(' · ');
  const stats = [
    { k: `Sell in · ${labelPeriodo}`, medida: tooltip('fact_neta', labelPeriodo), v: $c(c.fact_neta), sub: r.yoy != null ? `${signo(r.yoy)} ${r.yoyLabel}` : 'sin comparativo' },
    { k: 'Sell out', v: so.total > 0 ? $c(so.total) : '—', sub: so.total > 0 ? `${so.nCuentas} cuentas${so.soSi != null ? ` · SO/SI ${so.soSi.toFixed(2)}` : ''}` : 'sin sell out en el período' },
    { k: enCurso ? 'Margen al momento' : 'Margen', medida: tooltip('pct_mc'), v: c.mc != null ? pct(c.mc) : '—', sub: r.dMc != null ? `${pp(r.dMc)} vs ${anio - 1}` : 'MC sobre Fact Neta' },
  ];

  return (
    <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      {barra}

      <Hero
        eyebrow={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Inicio · {esMes ? `${r.mesL} ${anio}` : `Año ${anio}`}{enCurso ? ` · ${diaTxt}` : ''}<span style={{ textTransform: 'none', letterSpacing: 0 }}><FrescuraPill fuentes={FUENTES_INICIO} inverso /></span></span>}
        titulo={r.titulo} sub={fraseNegocio} stats={stats}>
        <div style={{ marginTop: 10, maxWidth: 560 }}><BarraCuota valor={c.fact_neta} cuota={r.cuotaPeriodo} label={esMes ? `cuota de ${r.mesL.toLowerCase()}` : (anio === anioHoy ? 'cuota a la fecha' : 'cuota anual')} inverso /></div>
        {r.decision.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {r.decision.slice(0, 3).map((a) => <Pill key={a.id} tone={a.severidad === 'critica' ? 'red' : 'orange'} dot title={a.detalle || ''}>{a.titulo}</Pill>)}
          {r.decision.length > 3 && <Pill tone="inverse" size="xs" onClick={() => abrirNotificaciones(onNavegar, perfil)} style={{ cursor: 'pointer' }}>+{r.decision.length - 3} más</Pill>}
        </div>}
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
        <KpiCard medida={tooltip('pct_alcance_venta')} eyebrow={`Sell in · ${labelPeriodo}`} badge={r.yoy != null ? { l: `${signo(r.yoy)} ${r.yoyLabel}`, tone: toneDe(r.yoy) } : undefined}
          big={$c(c.fact_neta)} bigSmall={r.cuotaPeriodo ? `de ${$c(r.cuotaPeriodo)}` : ''} progress={r.pctCuota ?? undefined}
          sub={r.pctCuota != null ? `${Math.round(r.pctCuota)}% de cuota${esMes && r.pctOtro != null ? ` · YTD ${Math.round(r.pctOtro)}% de ${$c(r.cuotaOtro)}` : ''}` : 'sin cuota cargada'} onClick={ir(null, PAGINAS.sellIn)} />
        <KpiCard eyebrow={`Sell out · ${labelPeriodo}`} badge={so.yoy != null ? { l: `${signo(so.yoy)} vs ${anio - 1}`, tone: toneDe(so.yoy) } : undefined}
          big={so.total > 0 ? $c(so.total) : '—'} bigSmall={so.soSi != null ? `SO/SI ${so.soSi.toFixed(2)}` : ''}
          sub={so.total > 0 ? `${so.nCuentas} cuentas · sell in a cuentas ${$c(so.sellIn)}${so.invCuentas ? ` · inv. en cuentas ${$c(so.invValor)}` : ''}` : 'sin sell out cargado en el período'} onClick={ir(null, 'sellOut')} />
        <KpiCard medida={tooltip('contribucion')} eyebrow={`Contribución · ${labelPeriodo}`} badge={r.dMc != null ? { l: `${pp(r.dMc)} MC`, tone: r.dMc >= 0 ? 'green' : 'red' } : undefined}
          big={$c(c.contribucion)} bigSmall={c.mc != null ? `MC ${pct(c.mc)}` : ''}
          sub={`lost profit ${$c(c.lost)}${c.lostPct != null ? ` (${pct(c.lostPct)} de la bruta)` : ''} · utilidad comercial ${$c(c.utilidad_comercial)}`} />
        {ve.inventario && <KpiCard medida={`${tooltip('inv_actual')} — ${tooltip('dias_inv')}`} eyebrow="Inventario comercial" badge={{ l: inv.cobertura != null ? `${inv.cobertura} d de inv` : 'sin ritmo', tone: coberturaTone }}
          big={$c(inv.valor)} bigSmall={`${int(inv.piezas)} pz`}
          sub={`${int(inv.skus)} SKUs con stock${inv.skusAgotados != null ? ` · ${int(inv.skusAgotados)} agotados con demanda` : ''}`} onClick={ir(null, PAGINAS.inventario)} />}
        {ve.inventario && <KpiCard eyebrow="En camino" badge={ec.atrasados.pos > 0 ? { l: `${ec.atrasados.pos} PO con ETA vencida`, tone: 'red' } : ec.proximos[0] ? { l: `próximo ${fecha(ec.proximos[0].eta)}`, tone: 'blue' } : undefined}
          big={$c(ec.valor)} bigSmall={`${int(ec.piezas)} pz`}
          sub={`${ec.pos} PO${ec.porMes[0] ? ` · ${ec.porMes[0].label}: ${$c(ec.porMes[0].valor)}` : ''}${ec.porMes[1] ? ` · ${ec.porMes[1].label}: ${$c(ec.porMes[1].valor)}` : ''}`} onClick={ir(null, PAGINAS.inventario)} />}
        {ve.cobranza && <KpiCard eyebrow={cart.corte ? `Cartera · corte ${fecha(cart.corte)}` : 'Cartera'} badge={cart.vencido > 0 ? { l: `${$c(cart.vencido)} vencido`, tone: cart.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al corriente', tone: 'green' }}
          big={$c(cart.saldo)} bigSmall={`${cart.filas.length} cliente${cart.filas.length === 1 ? '' : 's'}`} bigColor={cart.vencido > 0 && cart.pctVencido > 25 ? theme.red : undefined}
          sub={[cart.dso != null ? `DSO ${cart.dso} d` : null, cart.mas90 > 0 ? `${$c(cart.mas90)} > 90 d` : null].filter(Boolean).join(' · ') || 'sin estado de cuenta'} onClick={ir(null, PAGINAS.cobranza)} />}
      </div>

      <ComparativoAnual r={r} mesSel={mes} onMes={(m) => setMes(m)} />
      <MixPanel r={r} onNavegar={ir(null, PAGINAS.sellIn)} />
      <SellOutPanel r={r} onNavegar={ir(null, 'sellOut')} />
      {ve.inventario && <InventarioPanel r={r} onNavegar={ir(null, PAGINAS.inventario)} />}

      <Panel titulo="Hoy y decisiones" meta={`${r.decision.length ? `${r.decision.length} asunto${r.decision.length === 1 ? '' : 's'} que requieren decisión · ` : ''}pendientes de la Agenda y avisos del sistema`} plegable abiertoInicial={r.decision.length > 0}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <HoyPanel onNavegar={onNavegar} />
          <DecisionPanel r={r} onNavegar={onNavegar} onNotificaciones={() => abrirNotificaciones(onNavegar, perfil)} max={MAX_ALERTAS} />
        </div>
      </Panel>
      <Panel titulo={`Rentabilidad ${anio === anioHoy ? 'YTD' : ''} ${anio}`} meta="medidas del director · cascada Fact Bruta → Utilidad Comercial" plegable abiertoInicial={false}>
        <Suspense fallback={<Cargando minHeight={200} />}><RentabilidadBloque anio={anio} mesMax={mesActual} /></Suspense>
      </Panel>
      {ve.visionGeneral && (
        <Panel titulo={`Detalle del año ${anio}`} meta="mix por cliente dentro de cada bloque, tendencia 3 años, sell out por canal y promociones" plegable abiertoInicial={verDetalleAnio} onToggle={setVerDetalleAnio}>
          {verDetalleAnio && <Suspense fallback={<Cargando pantalla="visionGeneral" minHeight={520} />}><VisionGeneral /></Suspense>}
        </Panel>
      )}
      <AgendaPanel r={r} frescuraErp={porFuente.erp_ventas} onNavegar={onNavegar} />
    </div>
  );
}
