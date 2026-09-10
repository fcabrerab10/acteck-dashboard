// Visión General (push) · dirección general en el celular con los MISMOS cálculos que Inicio de escritorio
// (useInicioData + calcular, modo Mes/Año): hero Fact Neta / % cuota / MC / utilidad comercial + frase por reglas,
// 4 KPIs, mix por canal (tocable → clientes del canal, v_vision_factura_clientes YTD), tendencia 12 meses,
// sell-out por mayorista y "Compartir cierre" (hoja: mes, cobranza, comentario, pronóstico UAI editable → textoCierre).
//
// Fuentes extra a las de Inicio: v_vision_factura_clientes · v_vision_sellout_mayoristas (YTD; no existe vista mensual por
// mayorista) · v_vision_sellout_mensual (último mes cerrado por canal) · estados_resultados (gastos promedio para el UAI) ·
// erp_ventas (renglones del mismo mes del año anterior hasta el mismo día → estacionalidad de la contribución proyectada).
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Share2, Copy, Store, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import FrescuraPill from '../../components/FrescuraPill';
import { useInicioData } from '../../modules/general/inicio/useInicioData';
import { calcular } from '../../modules/general/inicio/calc';
import { FUENTES_INICIO, MODOS, canalLabel } from '../../modules/general/inicio/config';
import { useAlertas } from '../../lib/alertas';
import { textoCierre, compartir, copiar, mdp } from '../../lib/whatsapp';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Skeleton, Vacio, Segmented, HojaM, BotonGrande, TituloSeccionM, Pill, toast } from '../piezas';
import { moneyCompact, pct, deltaPct, tonoCuota, tonoDelta, MESES, MESES_LARGO, MONO, N } from '../util';
import { MiniBarras, nombreBonito } from './AnalisisFicha';
import { ultimosMeses } from './SellInCliente';
import FichaProducto from '../FichaProducto';

const STALE = 5 * 60 * 1000;
const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const CUENTAS_PL = ['utilidad_bruta', 'uaii_contable_sin_proyectos', 'total_gastos', 'total_productos_financieros', 'gastos_financieros'];

function useVisionExtra(anio) {
  return useQuery({
    queryKey: ['movil', 'vision-extra', anio], staleTime: STALE,
    queryFn: async () => {
      const [clientes, mayoristas, soMensual, pl] = await Promise.all([
        fetchAll('v_vision_factura_clientes', 'canal,cliente_nombre,venta,piezas,meses_activos', (q) => q.eq('anio', anio)),
        cachedQuery(supabase.from('v_vision_sellout_mayoristas').select('mayorista,importe,canal_sellout,clientes_finales,skus').eq('anio', anio).order('importe', { ascending: false })),
        cachedQuery(supabase.from('v_vision_sellout_mensual').select('anio,mes,canal_sellout,importe').in('anio', [anio - 1, anio])),
        cachedQuery(supabase.from('estados_resultados').select('anio,mes,cuenta_norm,valor').in('anio', [anio - 1, anio]).in('cuenta_norm', CUENTAS_PL)),
      ]);
      return { clientes, mayoristas: mayoristas.data || [], soMensual: soMensual.data || [], pl: pl.data || [] };
    },
  });
}

/** Gastos promedio de los últimos 3 meses con P&L: utilidad bruta − UAII (gastos de operación + resultado financiero neto),
 *  como los agrega EstadoResultados.jsx; respaldo total_gastos + total_productos_financieros (o gastos_financieros). */
export function gastosPromedio(pl) {
  const by = new Map();
  (pl || []).forEach((r) => { const k = `${r.anio}-${String(r.mes).padStart(2, '0')}`; const o = by.get(k) || (by.set(k, { anio: N(r.anio), mes: N(r.mes) }), by.get(k)); o[r.cuenta_norm] = N(r.valor); });
  const meses = [...by.values()].map((o) => {
    const g = o.utilidad_bruta != null && o.uaii_contable_sin_proyectos != null ? o.utilidad_bruta - o.uaii_contable_sin_proyectos
      : o.total_gastos != null ? o.total_gastos + (o.total_productos_financieros ?? o.gastos_financieros ?? 0) : null;
    return { ...o, gastos: g };
  }).filter((o) => o.gastos != null && o.gastos > 0).sort((a, b) => (b.anio - a.anio) || (b.mes - a.mes)).slice(0, 3);
  if (!meses.length) return { valor: null, meses: [] };
  return { valor: sum(meses, (m) => m.gastos) / meses.length, meses: meses.map((m) => ({ anio: m.anio, mes: m.mes, gastos: m.gastos })) };
}

/** Contribución del ERP (fact_neta − costo) sobre renglones crudos de erp_ventas, con la misma regla de v_erp_medidas. */
function contribucionRenglones(rows) {
  let fb = 0, dev = 0, cfb = 0, cdev = 0;
  (rows || []).forEach((r) => {
    const mv = r.movimiento_venta, nc = /nota credito/i.test(r.instruccion || '');
    if (mv === 'Factura' || mv === 'Factura Com.Ext33') fb += N(r.monto_venta_pesos);
    if (mv === 'Factura') cfb += N(r.costo_venta_pesos);
    if (mv === 'Devolucion Venta' && !nc) { dev += N(r.monto_venta_pesos); cdev += N(r.costo_venta_pesos); }
  });
  return (fb + dev) - (cfb + cdev);
}

export default function VisionGeneral() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const [modo, setModo] = useState('mes');
  const [canalAbierto, setCanalAbierto] = useState(null);
  const [cierre, setCierre] = useState(false);
  const { loading, error, data } = useInicioData(anio);
  const { data: alertas = [] } = useAlertas();
  const { data: extra } = useVisionExtra(anio);
  const r = useMemo(() => (data ? calcular(data, alertas, { anio, mesActual, hoy, modo }) : null), [data, alertas, anio, mesActual, hoy, modo]);

  // Sell-out: último mes cerrado (v_vision_sellout_mensual, Σ canales) + ranking YTD por mayorista
  const so = useMemo(() => {
    if (!extra) return null;
    const tot = (a, m) => sum(extra.soMensual.filter((x) => N(x.anio) === a && N(x.mes) === m), (x) => x.importe);
    let cerrado = null;
    for (const p of ultimosMeses(anio, mesActual, 13).slice(0, 12).reverse()) { const v = tot(p.anio, p.mes); if (v > 0) { cerrado = { ...p, importe: v, prev: tot(p.anio - 1, p.mes) }; break; } }
    const ytd = sum(extra.mayoristas, (m) => m.importe);
    return { cerrado, ytd, mayoristas: extra.mayoristas.slice(0, 12) };
  }, [extra, anio, mesActual]);

  const clientesCanal = useMemo(() => {
    if (!canalAbierto || !extra) return [];
    return extra.clientes.filter((c) => String(c.canal || 'otros').toUpperCase() === String(canalAbierto).toUpperCase()).sort((a, b) => N(b.venta) - N(a.venta)).slice(0, 40);
  }, [canalAbierto, extra]);

  const sub = <><span>{MESES_LARGO[mesActual - 1].replace(/^./, (c) => c.toUpperCase())} {anio} · día {hoy.getDate()}</span><span>·</span><FrescuraPill fuentes={FUENTES_INICIO} /></>;
  if (error) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Visión General" sub={sub} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar los datos" sub={error} /></>);
  if (loading || !r) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Visión General" sub={sub} /><div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={160} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={220} r={12} /></div></>);
  }

  const periodo = modo === 'mes' ? `${r.mesL} ${anio}` : `${anio} YTD`;
  const otroLabel = modo === 'mes' ? `YTD ${anio}` : `${r.mesL}`;
  const yoyOtroLabel = modo === 'mes' ? 'YoY' : 'YoY a mismo día';
  return (
    <>
      <Cabecera onVolver={nav.pop} derecha={<Segmented value={modo} onChange={setModo} options={MODOS} />} />
      <TituloGrande titulo="Visión General" sub={sub} />

      <HeroM eyebrow={`Dirección general · ${periodo}`} frase={r.titulo} sub={r.sub}
        stats={[
          { k: modo === 'mes' ? 'Fact Neta MTD' : 'Fact Neta YTD', v: moneyCompact(r.cur.fact_neta), sub: r.pctCuota != null ? `${Math.round(r.pctCuota)}% de cuota` : r.yoy != null ? `${deltaPct(r.yoy)} ${r.yoyLabel}` : 'sin cuota' },
          { k: 'Margen MC', v: r.cur.mc != null ? pct(r.cur.mc) : '—', sub: r.dMc != null ? `${r.dMc >= 0 ? '+' : ''}${r.dMc.toFixed(1)} pp vs ${anio - 1}` : undefined },
          { k: 'Utilidad com.', v: moneyCompact(r.cur.utilidad_comercial), sub: r.yoyUtilidad != null ? `${deltaPct(r.yoyUtilidad)} YoY` : undefined },
        ]} />

      <KpiGrid style={{ marginTop: 12 }}>
        <KpiM eyebrow={`Fact Neta ${otroLabel}`} big={moneyCompact(r.otro.fact_neta)} sub={r.yoyOtro != null ? `${deltaPct(r.yoyOtro)} vs ${anio - 1} (${yoyOtroLabel})` : undefined} progress={r.pctOtro} pill={r.pctOtro != null ? { tone: tonoCuota(r.pctOtro), label: `${Math.round(r.pctOtro)}%` } : undefined} />
        <KpiM eyebrow={`Contribución ${modo === 'mes' ? 'MTD' : 'YTD'}`} big={moneyCompact(r.cur.contribucion)} sub={r.cur.mc != null ? `MC ${pct(r.cur.mc)} · ${moneyCompact(r.prev.contribucion)} en ${anio - 1}` : undefined} />
        <KpiM eyebrow="Cartera vencida" big={moneyCompact(r.cartera.vencido)} bigColor={r.cartera.vencido > 0 ? theme.red : undefined} sub={r.cartera.saldo > 0 ? `${pct(r.cartera.pctVencido, 0)} de ${moneyCompact(r.cartera.saldo)}${r.cartera.dso != null ? ` · DSO ${r.cartera.dso} d` : ''}` : 'sin saldo'} />
        <KpiM eyebrow="Inventario + tránsito" big={moneyCompact(r.inv.valor)} sub={`${r.inv.cobertura != null ? `${r.inv.cobertura} d · ` : ''}${moneyCompact(r.inv.transitoValor)} en camino`} pill={r.inv.skusRiesgo > 0 ? { tone: 'red', label: `${r.inv.skusRiesgo} en riesgo` } : undefined} onClick={() => nav.push(<FichaProducto />, 'ficha')} />
      </KpiGrid>

      <ListaAgrupada titulo={`Mix por canal · ${periodo}`} meta={r.canales.length || undefined} style={{ marginTop: 18 }} pie="Fact Neta del ERP · pill = % de la cuota del canal (cuotas_canales) o YoY. Toca un canal para ver sus clientes.">
        {r.canales.length === 0 && <Vacio icon={null} titulo="Sin ventas del ERP en el periodo" style={{ padding: 18 }} />}
        {r.canales.map((c) => (
          <Fila key={c.canal} icon={Store} color={theme.accent} titulo={canalLabel(c.canal)} sub={`${r.totalCanales > 0 ? `${Math.round((c.fact / r.totalCanales) * 100)}% del total` : ''}${c.mc != null ? ` · MC ${pct(c.mc)}` : ''}${c.yoy != null && c.pct != null ? ` · ${deltaPct(c.yoy)} YoY` : ''}`}
            valor={moneyCompact(c.fact)} valorSub={c.cuota ? `de ${moneyCompact(c.cuota)}` : undefined}
            pill={c.pct != null ? { tone: tonoCuota(c.pct), label: `${Math.round(c.pct)}% cuota` } : { tone: tonoDelta(c.yoy), label: c.yoy != null ? `${deltaPct(c.yoy)} YoY` : 'nuevo' }} onClick={() => setCanalAbierto(c.canal)} />
        ))}
      </ListaAgrupada>

      <TituloSeccionM style={{ marginTop: 18, padding: '0 28px 6px' }}>Tendencia 12 meses · Fact Neta</TituloSeccionM>
      <MiniBarras serie={r.serie.map((s) => ({ key: s.key, label: s.label, v: s.fn, actual: s.actual }))} nombre="Fact Neta" />
      <div style={{ padding: '8px 28px 0', fontSize: 11.5, color: theme.textSubtle || theme.textMuted }}>{r.runRate > 0 ? `Run-rate de ${r.mesL.toLowerCase()}: ${moneyCompact(r.runRate)}${r.runRateYoy != null ? ` (${deltaPct(r.runRateYoy)} vs ${r.mesL.slice(0, 3).toLowerCase()} ${anio - 1})` : ''}.` : 'Mes actual resaltado.'}</div>

      <ListaAgrupada titulo={so?.cerrado ? `Sell-out · cierre ${MESES[so.cerrado.mes - 1]}` : 'Sell-out por mayorista'} meta={so?.cerrado ? moneyCompact(so.cerrado.importe) : undefined} style={{ marginTop: 18 }}
        pie={`Ranking acumulado ${anio} (v_vision_sellout_mayoristas, con lag de carga); el cierre del mes es la suma de canales de sellout_general.${so?.cerrado?.prev ? ` ${MESES[so.cerrado.mes - 1]} ${anio - 1}: ${moneyCompact(so.cerrado.prev)}.` : ''}`}>
        {!so && <div style={{ padding: 16 }}><Skeleton h={44} r={10} /></div>}
        {so && so.mayoristas.length === 0 && <Vacio icon={null} titulo="Sin sell-out cargado" style={{ padding: 18 }} />}
        {so && so.mayoristas.map((m, i) => (
          <Fila key={m.mayorista} titulo={<span><span style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, marginRight: 8 }}>{i + 1}</span>{nombreBonito(m.mayorista)}</span>}
            sub={`${m.canal_sellout || 'mayoreo'} · ${N(m.skus)} SKUs${N(m.clientes_finales) ? ` · ${N(m.clientes_finales).toLocaleString('es-MX')} clientes finales` : ''}`}
            valor={moneyCompact(m.importe)} valorSub={so.ytd > 0 ? `${Math.round((N(m.importe) / so.ytd) * 100)}% YTD` : undefined} chevron={false} />
        ))}
      </ListaAgrupada>

      <div style={{ padding: '18px 16px 0' }}>
        <BotonGrande primario icon={Share2} onClick={() => setCierre(true)}>Compartir cierre</BotonGrande>
      </div>

      <HojaM abierto={!!canalAbierto} onClose={() => setCanalAbierto(null)} titulo={canalAbierto ? canalLabel(canalAbierto) : ''} sub={`Clientes del canal · acumulado ${anio} (facturacion_clientes)`} alto="78vh">
        {!extra && <div style={{ padding: 16 }}><Skeleton h={200} r={12} /></div>}
        {extra && clientesCanal.length === 0 && <Vacio icon={null} titulo="Sin clientes con facturación en este canal" />}
        {clientesCanal.length > 0 && (
          <ListaAgrupada pie="Toca un cliente para abrir su ficha de análisis.">
            {clientesCanal.map((c, i) => {
              const total = sum(clientesCanal, (x) => x.venta);
              return <Fila key={c.cliente_nombre} titulo={<span><span style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, marginRight: 8 }}>{i + 1}</span>{nombreBonito(c.cliente_nombre)}</span>} sub={`${N(c.meses_activos)} meses activo · ${N(c.piezas).toLocaleString('es-MX')} pz`} valor={moneyCompact(c.venta)} valorSub={total > 0 ? `${Math.round((N(c.venta) / total) * 100)}%` : undefined} chevron={false} />;
            })}
          </ListaAgrupada>
        )}
      </HojaM>

      <HojaCierre abierto={cierre} onClose={() => setCierre(false)} r={r} data={data} extra={extra} anio={anio} mesActual={mesActual} hoy={hoy} theme={theme} />
    </>
  );
}

/** Hoja "Compartir cierre": mes, cobranza, comentario, pronóstico UAI (precalculado y editable) y el texto final. */
function HojaCierre({ abierto, onClose, r, data, extra, anio, mesActual, hoy, theme }) {
  const sugerido = hoy.getDate() <= 3 ? (mesActual === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mesActual - 1 }) : { anio, mes: mesActual };
  const [sel, setSel] = useState(sugerido);
  const [cobranza, setCobranza] = useState('');
  const [comentario, setComentario] = useState('');
  const [uaiTxt, setUaiTxt] = useState('');
  const [editado, setEditado] = useState(false);
  const enCurso = sel.anio === anio && sel.mes === mesActual;
  const dia = hoy.getDate(), diasMes = new Date(sel.anio, sel.mes, 0).getDate();

  // Estacionalidad: contribución del mismo mes del año anterior hasta el mismo día (renglones de erp_ventas)
  const { data: mismoDia } = useQuery({
    queryKey: ['movil', 'contrib-mismo-dia', sel.anio - 1, sel.mes, dia], staleTime: STALE, enabled: abierto && enCurso,
    queryFn: async () => contribucionRenglones(await fetchAll('erp_ventas', 'movimiento_venta,instruccion,monto_venta_pesos,costo_venta_pesos', (q) => q.eq('anio', sel.anio - 1).eq('mes', sel.mes).lte('dia', dia))),
  });

  const calc = useMemo(() => {
    const fila = (a, m) => data.medidas.find((x) => N(x.anio) === a && N(x.mes) === m) || {};
    const cur = fila(sel.anio, sel.mes), prev = fila(sel.anio - 1, sel.mes);
    const ventas = N(cur.fact_neta), contrib = N(cur.contribucion);
    const presupuesto = sel.anio === anio ? r.cuota.mes(sel.mes) : 0;
    const pctMc = ventas ? (contrib / ventas) * 100 : null;
    let proyectada = contrib, metodo = 'real';
    if (enCurso && contrib > 0) {
      const lineal = (contrib / Math.max(1, dia)) * diasMes;
      if (mismoDia > 0 && N(prev.contribucion) > 0) { proyectada = contrib * (N(prev.contribucion) / mismoDia); metodo = 'estacional'; }
      else { proyectada = lineal; metodo = 'lineal'; }
    }
    const gastos = gastosPromedio(extra?.pl);
    const uai = gastos.valor != null ? proyectada - gastos.valor : null;
    const cv3 = N(cur.cv_ultimos_3_meses) || N(fila(anio, mesActual).cv_ultimos_3_meses);
    const dias = cv3 > 0 && r.inv.valor > 0 ? r.inv.valor / (cv3 / 90) : null;
    const rango = gastos.meses.length ? `${MESES[gastos.meses[gastos.meses.length - 1].mes - 1].toLowerCase()}–${MESES[gastos.meses[0].mes - 1].toLowerCase()}${gastos.meses[0].anio !== anio ? ` ${gastos.meses[0].anio}` : ''}` : null;
    return { ventas, contrib, presupuesto, pctMc, proyectada, metodo, gastos, uai, dias, rango, stock: r.inv.valor };
  }, [data, extra, r, sel, anio, mesActual, enCurso, dia, diasMes, mismoDia]);

  useEffect(() => { if (!editado) setUaiTxt(calc.uai != null ? (calc.uai / 1e6).toFixed(1) : ''); }, [calc.uai, editado]);
  useEffect(() => { if (abierto) { setSel(sugerido); setEditado(false); } }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const uaiNum = uaiTxt.trim() === '' || Number.isNaN(Number(uaiTxt)) ? null : Number(uaiTxt) * 1e6;
  const texto = textoCierre({ mes: sel.mes, ventas: calc.ventas, presupuesto: calc.presupuesto, utilidadBruta: calc.contrib, pctMc: calc.pctMc, uai: uaiNum, cobranza, stock: calc.stock, diasInventario: calc.dias, comentario });
  const onCompartir = async () => { const res = await compartir(texto, { titulo: `Cierre de ${MESES_LARGO[sel.mes - 1]}` }); if (res === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(texto)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };

  const mesesOpc = ultimosMeses(anio, mesActual, 6).reverse();
  const campo = { width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 15, padding: '10px 12px', outline: 'none' };
  const etiqueta = { fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, margin: '12px 0 6px' };
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Compartir cierre" sub="Reporte del mes para dirección · edita y comparte" alto="92vh">
      <div style={{ padding: '0 16px 8px' }}>
        <div style={etiqueta}>Mes</div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {mesesOpc.map((m) => { const on = m.anio === sel.anio && m.mes === sel.mes; return <button key={`${m.anio}-${m.mes}`} type="button" onClick={() => { setSel({ anio: m.anio, mes: m.mes }); setEditado(false); }} style={{ flexShrink: 0, height: 32, padding: '0 12px', borderRadius: 9, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? theme.accent : theme.surface, color: on ? (theme.textOnDark || '#FFF') : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{MESES[m.mes - 1]} {m.anio}{m.anio === anio && m.mes === mesActual ? ' · en curso' : ''}</button>; })}
        </div>

        <div style={etiqueta}>Cobranza</div>
        <input value={cobranza} onChange={(e) => setCobranza(e.target.value)} placeholder="Texto libre, p. ej. 92% de la meta" style={campo} />

        <div style={etiqueta}>Pronóstico UAI (mdp)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input inputMode="decimal" value={uaiTxt} onChange={(e) => { setUaiTxt(e.target.value); setEditado(true); }} placeholder="6.5" style={{ ...campo, fontFamily: MONO, maxWidth: 140 }} />
          {editado && <button type="button" onClick={() => setEditado(false)} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13, cursor: 'pointer' }}>Recalcular</button>}
          <Pill tone={calc.metodo === 'real' ? 'green' : calc.metodo === 'estacional' ? 'blue' : 'orange'} style={{ marginLeft: 'auto' }}>{calc.metodo === 'real' ? 'mes cerrado' : calc.metodo === 'estacional' ? `estacionalidad ${sel.anio - 1}` : 'proyección lineal'}</Pill>
        </div>
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 6, lineHeight: 1.45 }}>
          contribución {calc.metodo === 'real' ? 'real' : 'proyectada'} {mdp(calc.proyectada)} · gastos promedio {calc.gastos.valor != null ? mdp(calc.gastos.valor) : '—'}{calc.rango ? ` (P&L ${calc.rango})` : ' (sin P&L cargado)'}
          {enCurso && calc.metodo !== 'real' ? ` · MTD ${mdp(calc.contrib)} al día ${dia} de ${diasMes}` : ''}
        </div>

        <div style={etiqueta}>Comentario</div>
        <textarea value={comentario} onChange={(e) => setComentario(e.target.value)} rows={3} placeholder="Opcional · va al final del mensaje" style={{ ...campo, resize: 'vertical', minHeight: 70 }} />

        <div style={etiqueta}>Texto</div>
        <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </div>
    </HojaM>
  );
}
