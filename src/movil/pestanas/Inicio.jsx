// Pestaña Inicio del celular (3.77.0 · 2026-10-05, propuesta A elegida por Fernando: «al ser en el celular quiero que
// sea mucho más rápida de leer, sin tanto rollo y solamente datos sólidos»). Mismos cálculos que el Inicio de
// escritorio (useInicioData + calcular). Orden fijo: selector de período → hero (cuota del mes, margen, utilidad,
// piezas) → gráfica «<año> frente a <año-1>» que se lee arrastrando el dedo (inicio/GraficaScrub) → cuatro tarjetas
// (sell out global, sell in del año, inventario, llega en <mes>) → mix de sell in como pay (inicio/PayMix).
// Fuera a propósito: agenda, «requiere decisión», sell out por cuenta, tabla de meses, detalle de inventario:
// cada uno tiene su pestaña. Quien no tiene permiso sensible ve sus clientes y sus avisos.
import React, { useMemo, useState } from 'react';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import FrescuraPill from '../../components/FrescuraPill';
import { useInicioData } from '../../modules/general/inicio/useInicioData';
import { calcular } from '../../modules/general/inicio/calc';
import { FUENTES_INICIO, MAX_ALERTAS } from '../../modules/general/inicio/config';
import GraficaScrub from './inicio/GraficaScrub';
import PayMix from './inicio/PayMix';
import { useAlertas } from '../../lib/alertas';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Skeleton, Vacio, HojaM, Pill } from '../piezas';
import { idNodo } from '../../components/nav/arbol';
import { colorCliente } from '../datos';
import { puedeVerSensible, puedeVerPestanaGlobal, puedeVerCliente, puedeVerInicio } from '../../lib/permisos';
import { saludo, diaLargo, nombreCorto, moneyCompact, money, pct, deltaPct, tonoCuota, MESES, N } from '../util';
import FichaCliente from './FichaCliente';

const fmtM = (n) => moneyCompact(n);

/** Barra de cuota (se llena y cambia de color: rojo < 60 · naranja < 85 · azul < 100 · verde) con monto y %. */
function BarraCuotaM({ valor, cuota, label }) {
  const { theme } = useTheme();
  if (!cuota) return null;
  const p = Math.max(0, (valor / cuota) * 100);
  const color = p >= 100 ? theme.green : p >= 85 ? '#5AC8FA' : p >= 60 ? theme.orange : theme.red;
  // Va dentro del HeroM (tarjeta inversa): en tema oscuro la tarjeta es clara, así que el texto es oscuro.
  const texto = theme.textOnInverse || theme.textOnDark || '#FFF';
  const muted = theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.7)';
  const pista = theme.mode === 'dark' ? 'rgba(29,29,31,0.12)' : 'rgba(255,255,255,0.14)';
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', fontSize: 11.5, color: muted, fontVariantNumeric: 'tabular-nums' }}>
        <span><b style={{ color: texto, fontWeight: 600 }}>{fmtM(valor)}</b> de {fmtM(cuota)} de {label}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, color }}>{Math.round(p)}%</span>
      </div>
      <div style={{ marginTop: 4, height: 8, borderRadius: 999, background: pista, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, p)}%`, background: color, borderRadius: 999, transition: 'width 420ms cubic-bezier(0.32,0.72,0,1)' }} /></div>
    </div>
  );
}

/** Botón «Sep 2026 ▾» + hoja con los meses (y «Año completo») del año en curso y los dos anteriores. */
function SelectorPeriodoM({ anio, mes, anioHoy, mesHoy, onChange }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const anios = [anioHoy, anioHoy - 1, anioHoy - 2];
  const label = mes === 'anio' ? `Año ${anio}` : `${MESES[mes - 1]} ${anio}`;
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px 0 12px', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {label}<ChevronDown size={14} style={{ color: theme.textMuted }} />
      </button>
      <HojaM abierto={abierto} onClose={() => setAbierto(false)} titulo="Período" sub="Mes o año completo · se compara con el año anterior" alto="75vh">
        {anios.map((a) => (
          <ListaAgrupada key={a} titulo={String(a)} style={{ marginBottom: 14 }}>
            <Fila titulo={`Año ${a}`} sub={a === anioHoy ? 'Acumulado a hoy' : 'Año completo'} chevron={false} alto={44}
              trailing={anio === a && mes === 'anio' ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange(a, 'anio'); setAbierto(false); }} />
            {MESES.map((lbl, i) => {
              const m = i + 1;
              if (a === anioHoy && m > mesHoy) return null;
              const on = anio === a && mes === m;
              return <Fila key={m} titulo={`${lbl} ${a}`} sub={a === anioHoy && m === mesHoy ? 'Mes en curso' : undefined} chevron={false} alto={44}
                trailing={on ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange(a, m); setAbierto(false); }} />;
            })}
          </ListaAgrupada>
        ))}
      </HojaM>
    </>
  );
}

export default function Inicio() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);   // 1..12 | 'anio'
  const modo = mes === 'anio' ? 'anio' : 'mes';
  const { loading, error, data } = useInicioData(anio);
  const ultimoMesConDatos = useMemo(() => (data ? (data.medidas || []).filter((x) => N(x.anio) === anio && N(x.fact_neta)).reduce((u, x) => Math.max(u, N(x.mes)), 0) : 0), [data, anio]);
  const mesActual = modo === 'mes' ? mes : (anio === anioHoy ? mesHoy : (ultimoMesConDatos || 12));
  const enCurso = anio === anioHoy && mesActual === mesHoy;
  const elegirPeriodo = (a, m) => { setAnio(a); setMes(m); };
  const { data: alertas = [] } = useAlertas();
  const perfil = nav.perfil;
  const veInicio = puedeVerInicio(perfil);
  const sensible = puedeVerSensible(perfil);
  const veInventario = puedeVerPestanaGlobal(perfil, 'inventario_global');
  const clientesVisibles = useMemo(() => ['digitalife', 'pcel', 'dicotech'].filter((k) => puedeVerCliente(perfil, k)), [perfil]);
  const r = useMemo(() => (data ? calcular(data, alertas, { anio, mesActual, hoy, modo, sensible, clientesVisibles, enCurso }) : null), [data, alertas, anio, mesActual, hoy, modo, sensible, clientesVisibles, enCurso]);

  const abrirCliente = (ck) => nav.push(<FichaCliente clienteKey={ck} />, `cliente-${ck}`, ['digitalife', 'pcel', 'dicotech'].includes(ck) ? idNodo(ck, 'home') : null);
  const titulo = `${saludo(hoy)}, ${nombreCorto(nav.perfil) || 'hola'}`;
  const periodoLbl = modo === 'mes' ? `${MESES[mesActual - 1]} ${anio}` : `${anio}`;
  const selector = sensible ? <SelectorPeriodoM anio={anio} mes={mes} anioHoy={anioHoy} mesHoy={mesHoy} onChange={elegirPeriodo} /> : null;
  const sub = <><span>{diaLargo(hoy).replace(/^./, (c) => c.toUpperCase())}</span><span>·</span><FrescuraPill fuentes={FUENTES_INICIO} detallado fila /></>;

  if (error) {
    return (<><TituloGrande titulo={titulo} sub={sub} derecha={selector} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar los datos" sub={error} /></>);
  }
  if (!veInicio) return <Vacio titulo="Sin acceso a Inicio" sub="Entra por Clientes para ver tu información." style={{ padding: '40px 16px' }} />;
  if (loading || !r) {
    return (
      <>
        <TituloGrande titulo={titulo} sub={sub} derecha={selector} />
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={150} r={12} />
          <Skeleton h={200} r={12} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
        </div>
      </>
    );
  }

  const so = r.sellOut, ec = r.enCamino, c = r.comparativo;
  const decision = r.decision.slice(0, MAX_ALERTAS);
  // «Llega en <mes>»: el mes en curso si tiene arribos; si no, el primer mes con ETA.
  const mesHoyKey = `${anioHoy}-${String(mesHoy).padStart(2, '0')}`;
  const llega = ec.porMes.find((m) => m.key === mesHoyKey) || ec.porMes.find((m) => m.key !== 'sin ETA') || null;
  const metaGrafica = c.mesesConDatos ? `${c.mesesArriba} de ${c.mesesConDatos} meses arriba de ${anio - 1}` : undefined;

  return (
    <div data-stagger>
      <TituloGrande titulo={titulo} sub={sub} derecha={selector} />

      {/* La facturación de toda la empresa es sensible: sin el permiso, el hero es de sus clientes y su día. */}
      <HeroM eyebrow={sensible ? `Dirección general · ${modo === 'mes' ? `${r.mesL} ${anio}` : `Año ${anio}`}` : `Mis clientes · ${r.mesL} ${anio}`}
        frase={sensible ? r.titulo : `Hoy tienes ${decision.length} aviso${decision.length === 1 ? '' : 's'} que atender.`}
        stats={sensible ? [
          { k: 'Margen MC', v: r.cur.mc != null ? pct(r.cur.mc) : '—', sub: r.dMc != null ? `${r.dMc >= 0 ? '+' : ''}${r.dMc.toFixed(1)} pp vs ${anio - 1}` : undefined },
          { k: 'Utilidad', v: fmtM(r.cur.utilidad_comercial), sub: r.yoyUtilidad != null ? `${deltaPct(r.yoyUtilidad)} ${r.yoyLabel}` : undefined },
          { k: 'Piezas netas', v: Math.round(r.cur.piezas).toLocaleString('es-MX'), sub: modo === 'mes' ? 'del mes' : 'del año' },
        ] : [
          { k: 'Clientes', v: String(r.clientes.length), sub: 'que ves' },
          { k: 'Avisos', v: String(decision.length), sub: 'hoy' },
        ]}>
        {sensible && <BarraCuotaM valor={r.cur.fact_neta} cuota={r.cuotaPeriodo} label={modo === 'mes' ? `cuota de ${r.mesL.toLowerCase()}` : (anio === anioHoy ? 'cuota a la fecha' : 'cuota anual')} />}
      </HeroM>

      {sensible && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 4px 6px 2px' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{anio} frente a {anio - 1}</span>
            <span style={{ fontSize: 11.5, color: theme.textMuted }}>{mes !== 'anio' ? <button type="button" onClick={() => setMes('anio')} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, padding: 0, cursor: 'pointer' }}>Año completo ›</button> : metaGrafica}</span>
          </div>
          <div style={{ background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
            <GraficaScrub meses={c.meses} anio={anio} formato={fmtM} mesActivo={mes === 'anio' ? null : mes - 1} onMes={(m) => setMes(m)} />
            <div style={{ display: 'flex', gap: 12, fontSize: 11, color: theme.textMuted, padding: '2px 4px 4px', flexWrap: 'wrap' }}>
              <span><i style={{ display: 'inline-block', width: 10, height: 3, borderRadius: 2, background: theme.accent, verticalAlign: 'middle', marginRight: 5 }} />{anio}</span>
              <span><i style={{ display: 'inline-block', width: 10, height: 3, borderRadius: 2, background: theme.mode === 'dark' ? '#8E8E93' : '#AEAEB2', verticalAlign: 'middle', marginRight: 5 }} />{anio - 1}</span>
              {c.cuotaAnual ? <span><i style={{ display: 'inline-block', width: 10, height: 0, borderTop: `2px dashed ${theme.orange}`, verticalAlign: 'middle', marginRight: 5 }} />Cuota</span> : null}
              <span style={{ marginLeft: 'auto' }}>Arrastra para leer · toca para elegir el mes</span>
            </div>
          </div>
        </div>
      )}

      {sensible && (
        <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
          <KpiM eyebrow={`Sell out global · ${periodoLbl}`} big={so.total > 0 ? fmtM(so.total) : '—'} sub={so.total > 0 ? `${so.yoy != null ? `${deltaPct(so.yoy)} vs ${anio - 1}` : `${so.nCuentas} cuentas`}${so.soSi != null ? ` · SO/SI ${so.soSi.toFixed(2)}` : ''}` : 'sin sell out en el período'} onClick={() => nav.navegar({ pagina: 'sellOut' })} />
          <KpiM eyebrow={modo === 'mes' ? `Sell in del año ${anio}` : `Sell in ${r.mesL}`} big={fmtM(r.otro.fact_neta)} sub={r.yoyOtro != null ? `${deltaPct(r.yoyOtro)} vs ${anio - 1}` : undefined} pill={r.pctOtro != null ? { tone: tonoCuota(r.pctOtro), label: `${Math.round(r.pctOtro)}% cuota` } : undefined} />
          {veInventario && <KpiM eyebrow="Inventario" big={fmtM(r.inv.valor)} sub={r.inv.cobertura != null ? `${r.inv.cobertura} d de cobertura` : `${r.inv.skus} SKUs con stock`} onClick={() => nav.navegar({ pagina: 'inventarioGlobal' })} />}
          {veInventario && <KpiM eyebrow={llega ? `Llega en ${llega.label.split(' ')[0].toLowerCase()}` : 'En camino'} big={llega ? fmtM(llega.valor) : (ec.valor > 0 ? fmtM(ec.valor) : '—')} sub={llega ? `${llega.pos} PO${ec.proximos[0] ? ` · próximo ${ec.proximos[0].eta.slice(8, 10)}/${ec.proximos[0].eta.slice(5, 7)}` : ''} · ${fmtM(ec.valor)} en camino` : (ec.pos ? `${ec.pos} PO en camino` : 'nada en camino')} onClick={() => nav.navegar({ pagina: 'inventarioGlobal' })} />}
        </KpiGrid>
      )}

      {sensible && <PayMix mixes={r.mixes} formato={fmtM} titulo={`Mix de sell in · ${periodoLbl}`} />}

      {!sensible && <ListaAgrupada titulo={`Clientes · ${periodoLbl}`} style={{ marginTop: 18 }} pie="Toca un cliente para ver su ficha.">
        {r.clientes.map((cl) => (
          <Fila key={cl.key} tono={colorCliente(cl.key, theme)} titulo={cl.nombre} sub={cl.cuota > 0 ? `${money(cl.fact)} de ${fmtM(cl.cuota)}` : money(cl.fact)}
            pill={cl.pct != null ? { tone: tonoCuota(cl.pct), label: `${Math.round(cl.pct)}% cuota` } : { tone: 'gray', label: cl.yoy != null ? `${deltaPct(cl.yoy)} YoY` : 'sin cuota' }}
            onClick={() => abrirCliente(cl.key)} />
        ))}
      </ListaAgrupada>}
    </div>
  );
}
