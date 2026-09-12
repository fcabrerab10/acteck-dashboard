// Inicio · pestaña de dirección general armada con el kit V3 (plantilla HomeClienteV3).
// Segmented Mes / Año cambia TODAS las cifras (Mes = mes actual · Año = YTD).
// Carga en inicio/useInicioData.js (sólo lib/queries), cálculos en inicio/calc.js, bloques en inicio/bloques.jsx.
// Se monta lazy desde App.jsx en paginaActiva === 'inicio' con props { onNavegar(clienteKey|null, pagina) }.
import React, { useMemo, useState } from 'react';
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
import { Hero, KpiCard, Pill, Panel, Segmented, SkeletonPantalla } from '../../components/kit';
import { FUENTES_INICIO, MODOS, PAGINAS, MAX_ALERTAS, abrirNotificaciones } from './inicio/config';
import { useInicioData } from './inicio/useInicioData';
import { calcular } from './inicio/calc';
import { GraficaVentas, DecisionPanel, ClientesGrid, CanalesPanel, AgendaPanel, HoyPanel } from './inicio/bloques';

const signo = (v, d = 0) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const toneDe = (v) => (v == null ? 'gray' : v >= 0 ? 'green' : 'red');
const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export default function Inicio({ onNavegar }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const [modo, setModo] = useState('mes');
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
  if (loading || (!r && !error)) return <SkeletonPantalla pantalla="inicio" />;
  if (error) return <Panel titulo="No se pudo cargar Inicio"><div style={{ fontSize: 12, color: theme.red }}>{error}</div></Panel>;

  const ir = (ck, pagina) => (onNavegar ? () => onNavegar(ck, pagina) : undefined);
  const esMes = modo === 'mes';
  const labelPeriodo = esMes ? `MTD · ${r.mesL}` : `YTD ${anio}`;
  const labelOtro = esMes ? `YTD ${anio}` : `MTD · ${r.mesL}`;
  const c = r.cur, cart = r.cartera, inv = r.inv;
  const diaTxt = fmtDia.format(hoy).replace(',', '');

  const stats = [
    { k: `Fact Neta · ${labelPeriodo}`, medida: tooltip('fact_neta', labelPeriodo), v: $c(c.fact_neta), sub: r.pctCuota != null ? `${Math.round(r.pctCuota)}% de cuota${r.yoy != null ? ` · ${signo(r.yoy)} ${r.yoyLabel}` : ''}` : r.yoy != null ? `${signo(r.yoy)} ${r.yoyLabel}` : 'sin cuota' },
    ...(sensible ? [
      { k: 'Margen al momento', medida: tooltip('pct_mc'), v: c.mc != null ? pct(c.mc) : '—', sub: c.muc != null ? `MUC ${pct(c.muc)}${r.dMc != null ? ` · ${pp(r.dMc)} YoY` : ''}` : 'MC sobre Fact Neta' },
      { k: 'Utilidad comercial', medida: tooltip('utilidad_comercial'), v: $c(c.utilidad_comercial), sub: r.yoyUtilidad != null ? `${signo(r.yoyUtilidad, 1)} vs ${anio - 1}${esMes ? ' a mismo día' : ''}` : 'sin comparativo', color: r.yoyUtilidad == null ? undefined : r.yoyUtilidad >= 0 ? theme.green : theme.red },
    ] : [
      { k: `Fact Neta · ${labelOtro}`, medida: tooltip('fact_neta', labelOtro), v: $c(r.otro.fact_neta), sub: r.pctOtro != null ? `${Math.round(r.pctOtro)}% de cuota` : r.yoyOtro != null ? `${signo(r.yoyOtro)} YoY` : 'sin cuota' },
      { k: 'Piezas netas', medida: tooltip('piezas_venta_neta'), v: int(c.piezas), sub: c.ticket != null ? `ticket promedio ${$c(c.ticket)}` : labelPeriodo },
    ]),
  ];

  const lostTxt = `lost profit ${$c(c.lost)}${c.lostPct != null ? ` (${pct(c.lostPct)} de la bruta)` : ''}`;
  const coberturaTone = inv.cobertura == null ? 'gray' : inv.cobertura > 120 ? 'orange' : inv.cobertura < 30 ? 'red' : 'green';

  return (
    <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>{esMes ? `Mes en curso · ${r.mesL} ${anio}` : `Acumulado · enero a ${r.mesL.toLowerCase()} ${anio}`}</span>
        <Segmented options={MODOS} value={modo} onChange={setModo} />
      </div>

      <Hero
        eyebrow={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Inicio · {diaTxt}<span style={{ textTransform: 'none', letterSpacing: 0 }}><FrescuraPill fuentes={FUENTES_INICIO} inverso /></span></span>}
        titulo={r.titulo} sub={r.sub} dot={r.decision.some((a) => a.severidad === 'critica')} stats={stats}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {r.decision.slice(0, 3).map((a) => <Pill key={a.id} tone={a.severidad === 'critica' ? 'red' : 'orange'} dot title={a.detalle || ''}>{a.titulo}</Pill>)}
          {r.cuota.fuente && <Pill tone="inverse" size="xs" title="Origen de la cuota total">cuota {r.cuota.fuente === 'cuotas_canales' ? 'anual (canales)' : 'Σ clientes'} {$c(r.cuota.anual)}</Pill>}
        </div>
      </Hero>

      {/* Bloque "Hoy" (Agenda V3): bandeja compacta compartida con la pestaña Agenda */}
      <HoyPanel onNavegar={onNavegar} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        {(sensible || ve.visionGeneral) && <KpiCard medida={tooltip('pct_alcance_venta')} eyebrow={`Fact Neta · ${labelOtro}`} badge={r.yoyOtro != null ? { l: `${signo(r.yoyOtro)} ${esMes ? 'YoY' : 'YoY a mismo día'}`, tone: toneDe(r.yoyOtro) } : undefined}
          big={$c(r.otro.fact_neta)} bigSmall={r.cuotaOtro ? `de ${$c(r.cuotaOtro)}` : ''}
          sub={[r.pctOtro != null ? `${Math.round(r.pctOtro)}% de cuota ${esMes ? 'YTD' : 'del mes'}` : 'sin cuota', r.pctAnual != null ? `${Math.round(r.pctAnual)}% de la anual ${$c(r.cuota.anual)}` : null].filter(Boolean).join(' · ')}
          progress={r.pctOtro ?? undefined} onClick={ve.visionGeneral ? ir(null, PAGINAS.visionGeneral) : undefined} />}
        {sensible
          ? <KpiCard medida={tooltip('contribucion')} eyebrow={`Contribución · ${labelPeriodo}`} badge={r.dMc != null ? { l: `${pp(r.dMc)} MC`, tone: r.dMc >= 0 ? 'green' : 'red' } : undefined}
              big={$c(c.contribucion)} bigSmall={c.mc != null ? `MC ${pct(c.mc)}` : ''}
              sub={`${lostTxt} · dev ${$c(c.devoluciones)} · RMA ${$c(c.rmas)} · bonif ${$c(c.bonificaciones)}`}
              onClick={ve.visionGeneral ? ir(null, PAGINAS.visionGeneral) : undefined} />
          : <KpiCard medida={tooltip('pct_lost_profit_bonif', "Devoluciones + RMA's + Bonificaciones")} eyebrow={`Deducciones · ${labelPeriodo}`} badge={c.lostPct != null ? { l: `${pct(c.lostPct)} de la bruta`, tone: c.lostPct > 8 ? 'orange' : 'gray' } : undefined}
              big={$c(c.lost)} bigSmall="dev + RMA + bonif"
              sub={`dev ${$c(c.devoluciones)} · RMA ${$c(c.rmas)} · bonif ${$c(c.bonificaciones)}`}
              onClick={ve.visionGeneral ? ir(null, PAGINAS.visionGeneral) : undefined} />}
        {ve.cobranza && <KpiCard eyebrow={cart.corte ? `Cartera · corte ${fecha(cart.corte)}` : 'Cartera'} badge={cart.vencido > 0 ? { l: `${$c(cart.vencido)} vencido`, tone: cart.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al corriente', tone: 'green' }}
          big={$c(cart.saldo)} bigSmall={`${cart.filas.length} cliente${cart.filas.length === 1 ? '' : 's'}`} bigColor={cart.vencido > 0 && cart.pctVencido > 25 ? theme.red : undefined}
          sub={[cart.dso != null ? `DSO ${cart.dso} d` : null, cart.mas90 > 0 ? `${$c(cart.mas90)} > 90 d` : null, cart.filas[0]?.vencido > 0 ? `${cart.filas[0].cliente}: ${$c(cart.filas[0].vencido)} vencido` : null].filter(Boolean).join(' · ') || 'sin estados de cuenta'}
          onClick={ir(null, PAGINAS.cobranza)} />}
        {ve.inventario && <KpiCard medida={`${tooltip('inv_actual')} — ${tooltip('dias_inv')}`} eyebrow="Inv Actual + tránsito" badge={{ l: inv.cobertura != null ? `${inv.cobertura} d de inv` : 'sin ritmo', tone: coberturaTone }}
          big={sensible ? $c(inv.valor) : int(inv.piezas)} bigSmall={sensible ? `+ ${$c(inv.transitoValor)} en tránsito` : `pzs · + ${int(inv.transitoPzs)} en tránsito`}
          sub={`${int(inv.transitoPzs)} pzs en ${inv.pos} PO · ${int(inv.skus)} SKUs con stock${inv.skusRiesgo ? ` · ${inv.skusRiesgo} SKUs en riesgo` : ''}`}
          onClick={ir(null, PAGINAS.inventario)} />}
      </div>

      <GraficaVentas r={r} onNavegar={ve.visionGeneral ? ir(null, PAGINAS.visionGeneral) : undefined} />
      <DecisionPanel r={r} onNavegar={onNavegar} onNotificaciones={() => abrirNotificaciones(onNavegar, perfil)} max={MAX_ALERTAS} />
      {r.clientes.length > 0 && <ClientesGrid r={r} onNavegar={onNavegar} />}
      {ve.sellIn && <CanalesPanel r={r} onNavegar={ir(null, PAGINAS.sellIn)} />}
      <AgendaPanel r={r} frescuraErp={porFuente.erp_ventas} onNavegar={onNavegar} />
    </div>
  );
}
