// HomeClienteV3 · un solo "Resumen" por cliente armado con el kit V3.
// Sustituye a HomeDigitalife / HomeDicotech / HomePcel / HomeCliente. Config por cliente en home/config.js,
// carga en home/useHomeData.js (sólo lib/queries), cálculos en home/calc.js, bloques en home/bloques.jsx.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaCliente } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import { moneyCompact as $c, fecha } from '../../lib/format';
import { Hero, KpiCard, Pill, Panel, SkeletonPantalla } from '../../components/kit';
import { configDe, MESES, Q_MESES, qDe, META_INV_DIAS } from './home/config';
import { useHomeData } from './home/useHomeData';
import { calcular, serieMensual, splitPor, topSkus } from './home/calc';
import { GraficaSiSo, SplitTabla, TopSkusTabla, InventarioPanel, CobranzaPanel, PendientesMinutas, MarketingPanel, Secundario } from './home/bloques';

const signo = (v, d = 0) => (v == null ? null : `${v >= 0 ? '+' : ''}${v.toFixed(d)}%`);
const toneDe = (v) => (v == null ? 'gray' : v >= 0 ? 'green' : 'red');

// `onUploadComplete` se conserva por compatibilidad con App.jsx: hoy ningún cliente muestra uploader en el Resumen
// (el de HomeCliente para ventas_mensuales estaba definido pero nunca se renderizaba); las cargas viven en uploads.html.
export default function HomeClienteV3({ cliente, clienteKey, onUploadComplete, onNavegar }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const cfg = useMemo(() => configDe(clienteKey, cliente), [clienteKey, cliente]);
  const hoy = new Date(), anio = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const [rango, setRango] = useState(qDe(mesActual));       // gráfica SI vs SO
  const [rangoSplit, setRangoSplit] = useState(qDe(mesActual)); // split marca / sucursal
  const { loading, error, data } = useHomeData(clienteKey, cfg, anio);

  const r = useMemo(() => (data ? calcular(data, cfg, anio, mesActual) : null), [data, cfg, anio, mesActual]);
  const serie = useMemo(() => (r ? serieMensual(r, Q_MESES[rango], mesActual) : null), [r, rango, mesActual]);
  const split = useMemo(() => (r ? splitPor(data, cfg, r, Q_MESES[rangoSplit], anio) : []), [data, cfg, r, rangoSplit, anio]);
  const top = useMemo(() => (r ? topSkus(data, r) : null), [data, r]);

  if (!puedeVerPestanaCliente(perfil, clienteKey, 'home')) return <SinAcceso motivo={`No tienes acceso al Resumen de ${cfg.nombre}.`} />;
  if (loading || (!r && !error)) return <SkeletonPantalla pantalla="home" />;
  if (error) return <Panel titulo="No se pudo cargar el Resumen" meta={cfg.nombre}><div style={{ fontSize: 12, color: theme.red }}>{error}</div></Panel>;

  const ir = (pagina) => (onNavegar ? () => onNavegar(clienteKey, pagina) : undefined);
  const pctCuotaTone = r.pctCuota == null ? 'gray' : r.pctCuota >= 100 ? 'green' : r.pctCuota >= 85 ? 'blue' : 'orange';
  const dias = r.diasInv;

  const stats = [
    { k: `MTD · ${MESES[mesActual - 1]}`, v: $c(r.siMes), sub: r.pctCuota != null ? `${Math.round(r.pctCuota)}% de cuota ideal` : 'sin cuota' },
    { k: `YTD ${anio}`, v: $c(r.ytd), sub: [r.pctYtd != null ? `${Math.round(r.pctYtd)}% cuota` : null, signo(r.yoyYtd, 1) ? `${signo(r.yoyYtd, 1)} YoY` : null].filter(Boolean).join(' · ') || '—' },
    { k: r.soCerrado ? `Sell Out · ${MESES[r.soCerrado.mes - 1]}` : 'Sell Out', v: r.soCerrado ? $c(r.soCerrado.monto) : '—', sub: r.soCerrado?.yoy != null ? `${signo(r.soCerrado.yoy, 1)} YoY` : 'último mes cerrado', color: r.soCerrado?.yoy == null ? undefined : r.soCerrado.yoy >= 0 ? theme.green : theme.red },
  ];

  const bloques = {
    siso: <GraficaSiSo key="siso" serie={serie} rango={rango} setRango={setRango} anio={anio} />,
    split: <SplitTabla key="split" filas={split} cfg={cfg} rango={rangoSplit} setRango={setRangoSplit} />,
    top_skus: <TopSkusTabla key="top" top={top} onNavegar={ir('estrategia')} />,
    inventario: <InventarioPanel key="inv" r={r} onNavegar={ir('estrategia')} />,
    cobranza: <CobranzaPanel key="cob" r={r} onNavegar={ir('cartera')} />,
    pendientes: <PendientesMinutas key="pen" d={data} />,
    marketing: <MarketingPanel key="mkt" r={r} anio={anio} onNavegar={ir('marketing')} />,
  };

  return (
    <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <Hero eyebrow={`Resumen · ${cfg.nombre} · ${MESES[mesActual - 1]} ${anio}`} titulo={r.titulo} sub={r.sub} dot={r.recos.some((x) => x.tone === 'red')} stats={stats}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {r.recos.slice(0, 4).map((x, i) => <Pill key={i} tone={x.tone} dot title={x.s}>{x.t}</Pill>)}
          <Pill tone="inverse" size="xs" title="Última actualización de cada fuente">
            SI {r.mesSiUlt ? MESES[r.mesSiUlt - 1] : '—'} · SO {r.ultimaFechaSo ? fecha(r.ultimaFechaSo) : r.mesSoUlt ? MESES[r.mesSoUlt - 1] : '—'} · Inv {r.inv.semana ? `S${r.inv.semana}` : '—'} · Cartera {r.cartera.semana ? `S${r.cartera.semana}` : '—'}
          </Pill>
        </div>
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow={`Cuota · ${MESES[mesActual - 1]}`} badge={{ l: r.pctCuota != null ? `${Math.round(r.pctCuota)}% ideal` : 'sin cuota', tone: pctCuotaTone }}
          big={$c(r.siMes)} bigSmall={r.cuota.ideal ? `de ${$c(r.cuota.ideal)}` : ''}
          sub={r.cuota.min ? `mín ${$c(r.cuota.min)} (${r.pctMin != null ? Math.round(r.pctMin) : 0}%) · ${r.siMes >= r.cuota.ideal ? 'cuota ideal cumplida' : `faltan ${$c(r.cuota.ideal - r.siMes)}`}` : 'sin cuota mínima cargada'}
          progress={r.pctCuota ?? 0} progressSecondary={r.pctMin ?? undefined} onClick={ir('sellIn')} />
        <KpiCard eyebrow={r.soCerrado ? `Sell Out · ${MESES[r.soCerrado.mes - 1]}` : 'Sell Out'} badge={r.soCerrado?.yoy != null ? { l: `${signo(r.soCerrado.yoy)} YoY`, tone: toneDe(r.soCerrado.yoy) } : undefined}
          big={r.soCerrado ? $c(r.soCerrado.monto) : '—'} bigSmall={`MTD ${$c(r.soMtd)}`}
          sub={`YTD ${$c(r.soYtd)}${r.ratio != null ? ` · ratio SO/SI ${Math.round(r.ratio)}%` : ''}${r.soMtdPrev > 0 ? ` · MTD ${anio - 1}: ${$c(r.soMtdPrev)}` : ''}`}
          onClick={ir('estrategia')} />
        <KpiCard eyebrow="Inventario del cliente" badge={{ l: dias == null ? 'sin datos' : dias > META_INV_DIAS ? `▲${dias - META_INV_DIAS}d vs meta` : 'en meta', tone: dias == null ? 'gray' : dias > META_INV_DIAS ? 'orange' : 'green' }}
          big={dias != null ? `${dias}d` : '—'} bigSmall={`meta ${META_INV_DIAS}d`} bigColor={dias == null ? theme.textMuted : dias > META_INV_DIAS ? theme.orange : theme.green}
          sub={`${$c(r.inv.valor)} · ${r.inv.skus} SKUs${r.inv.semana ? ` · semana ${r.inv.semana}` : ''}${r.criticos.length ? ` · ${r.criticos.length} críticos` : ''}`}
          progress={dias != null ? Math.min(100, (dias / META_INV_DIAS) * 100) : undefined} progressColor={dias != null && dias > META_INV_DIAS ? theme.orange : theme.green} onClick={ir('estrategia')} />
        <KpiCard eyebrow="Pagos y rebates" badge={r.pagos.vencidos.length ? { l: `${r.pagos.vencidos.length} vencido${r.pagos.vencidos.length > 1 ? 's' : ''}`, tone: 'red' } : { l: `${r.pagos.n} pendiente${r.pagos.n === 1 ? '' : 's'}`, tone: r.pagos.n ? 'orange' : 'green' }}
          big={$c(r.pagos.total)} bigSmall="por pagar"
          sub={r.pagos.proximo ? `próximo ${fecha(r.pagos.proximo.fecha_compromiso)} · ${r.pagos.proximo.concepto || r.pagos.proximo.categoria} ${$c(r.pagos.proximo.monto)}` : r.pagos.n ? 'sin fecha compromiso' : 'sin pagos pendientes'}
          onClick={ir('pagos')} />
      </div>

      {cfg.bloques.map((id) => bloques[id]).filter(Boolean)}
      {cfg.secundario?.length > 0 && <Secundario r={r} anio={anio} mesActual={mesActual} />}
    </div>
  );
}
