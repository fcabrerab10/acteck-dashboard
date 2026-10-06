// «<Cuenta> frente al resto» (3.79.0 · 2026-10-05, mockup scratchpad/analisis-movil.html pantalla 5): lo que abre
// «Abrir sell out completo» desde la pestaña Sell Out de un cliente. HeroM con la posición en el ranking de las 17
// cuentas, peso en su canal, SO/SI contra el promedio del canal y nº de oportunidades → 4 KpiM → Oportunidades (SKUs que
// venden ≥ 2 cuentas pares del mismo canal en los 3 meses cerrados y esta cuenta no vende ni tiene en inventario; botón
// «Armar propuesta con estos SKUs» sólo en clientes propios) → Inventario en la cuenta por SKU (pz, semanas al ritmo de
// 3 meses cerrados, agotado/riesgo/sano; sólo si reporta inventario) → Clientes finales nuevos y perdidos (sólo si la
// receta trae clientes). Cálculo puro en sellout/oportunidades.js; ranking y peso sobre construirFilas (sellout/calculo.js).
// Datos (≤ 8): v_sellout_cuentas · v_sellout_cuenta_mes · mv_sellout_cuenta_dia · mv_sellout_cuenta_sku_mes (cuenta + pares,
// 3 meses) · mv_sellout_cuenta_sku_mes de la cuenta (2 años) · v_sellout_inventario_cuenta_sku · mv_sellout_cliente_final_mes · roadmap_sku.
import React, { useMemo } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Skeleton, Vacio, BotonGrande, Pill } from '../../piezas';
import { moneyCompact, int, MESES, N } from '../../util';
import { useCuentas, useDias, useMensual, useDrillSkus, useDrillInventario, useDrillClientesFinales } from '../../../modules/comercial/sellout/datos';
import { construirFilas, skusDeCuenta, ultimosMeses, canalLabel as canalSoLabel } from '../../../modules/comercial/sellout/calculo';
import { paresDe, oportunidades, ranking, pesoEnCanal, clientesNuevosPerdidos } from '../../../modules/comercial/sellout/oportunidades';
import FichaProducto from '../../FichaProducto';
import { useSkuMesCuentas } from './datos';
import { fraseFrente } from './calculo';

const PROPIOS = ['digitalife', 'pcel', 'dicotech'];

/** Vista pura (sin red): la prueba scripts/test-analisis-movil-ssr.mjs. */
export function FrenteVista({ nombre, anio, mes, rank, rankPrev, peso, oport, inv = [], reportaInv = false, cf = null, pares = [], paresNombre = [], propio = false, onPropuesta, onSku, cargando = {} }) {
  const { theme } = useTheme();
  const mesL = MESES[mes - 1];
  const canalLbl = peso?.canal ? canalSoLabel(peso.canal).toLowerCase() : 'su canal';
  const frase = fraseFrente({ nombre, pos: rank?.pos, de: rank?.de, pct: peso?.pct, canalLbl, soSi: peso?.soSi, soSiCanal: peso?.soSiCanal, nOport: oport?.total || 0 });
  const movRank = rank?.pos && rankPrev?.pos ? rankPrev.pos - rank.pos : null;
  const subRank = movRank == null ? `${mesL.toLowerCase()} ${anio}` : movRank === 0 ? `igual que en ${MESES[(mes + 10) % 12].toLowerCase()}` : movRank > 0 ? `sube ${movRank} vs ${MESES[(mes + 10) % 12].toLowerCase()}` : `baja ${-movRank} vs ${MESES[(mes + 10) % 12].toLowerCase()}`;
  const tonoSem = (s) => (s == null ? 'gray' : s <= 0 ? 'red' : s < 4 ? 'orange' : 'green');
  const lblSem = (s, stock) => (stock != null && stock <= 0 ? 'agotado' : s == null ? 'sin ritmo' : `${Math.round(s)} sem`);
  return (
    <>
      <HeroM eyebrow={`Posición · ${mesL.toLowerCase()} ${anio}`} frase={frase} />
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow="Ranking" big={rank?.pos ? `${rank.pos} de ${rank.de}` : '—'} sub={subRank} />
        <KpiM eyebrow={`Peso en ${canalLbl}`} big={peso?.pct != null ? `${Math.round(peso.pct)}%` : '—'} sub={peso?.deltaPp != null ? <><span style={{ color: peso.deltaPp >= 0 ? theme.green : theme.red }}>{peso.deltaPp >= 0 ? '+' : ''}{peso.deltaPp.toFixed(1)} pp</span> vs {anio - 1}</> : `${peso?.cuentasCanal || 0} cuentas en el canal`} />
        <KpiM eyebrow="SO/SI vs promedio" big={peso?.soSi != null ? (peso.soSi / 100).toFixed(2) : '—'} bigColor={peso?.soSi != null && peso?.soSiCanal != null ? (peso.soSi >= peso.soSiCanal ? theme.green : theme.red) : undefined} sub={peso?.soSiCanal != null ? `promedio del canal ${(peso.soSiCanal / 100).toFixed(2)}` : 'sin promedio del canal'} />
        <KpiM eyebrow="Oportunidades" big={oport ? `${oport.total} SKU${oport.total === 1 ? '' : 's'}` : '—'} sub={oport?.total ? `${moneyCompact(oport.importeMes)}/mes en cuentas pares` : 'nada que sus pares muevan y aquí falte'} />
      </KpiGrid>

      <ListaAgrupada titulo="Oportunidades" meta={paresNombre.length ? `mueven ${paresNombre.join(', ')} y aquí no` : 'sin cuentas pares'} style={{ marginTop: 18 }}
        pie={`SKUs con venta en ≥ 2 de las ${pares.length} cuentas pares (mismo canal) en los 3 meses cerrados, que ${nombre} no vendió ni tiene en inventario. Piezas = promedio mensual de las pares.`}>
        {cargando.oport && <div style={{ padding: 12 }}><Skeleton h={120} r={8} /></div>}
        {!cargando.oport && !oport?.lista?.length && <Vacio icon={null} titulo="Sin oportunidades" sub={pares.length ? 'Vende todo lo que mueven sus pares.' : 'No hay otras cuentas en su canal para comparar.'} style={{ padding: 16 }} />}
        {!cargando.oport && (oport?.lista || []).map((o) => (
          <Fila key={o.sku} titulo={o.descripcion ? `${o.descripcion} (${o.sku})` : o.sku} sub={`en ${o.nPares} de ${o.dePares} pares${o.categoria ? ` · ${o.categoria}` : ''}`} valor={`${int(Math.round(o.pzMes))} pz/mes`} valorSub={moneyCompact(o.importeMes)} chevron={false} onClick={onSku ? () => onSku(o.sku) : undefined} />
        ))}
      </ListaAgrupada>
      {propio && onPropuesta && oport?.lista?.length > 0 && (
        <div style={{ padding: '10px 16px 0' }}><BotonGrande primario icon={Plus} onClick={onPropuesta}>Armar propuesta con estos SKUs</BotonGrande></div>
      )}

      {reportaInv && (
        <ListaAgrupada titulo={`Inventario en ${nombre.split(' ')[0]}`} meta="por SKU · semanas" style={{ marginTop: 18 }} pie="Semanas al ritmo de sell out de los 3 meses cerrados · agotado = con venta y sin stock. Los 20 de más venta.">
          {cargando.inv && <div style={{ padding: 12 }}><Skeleton h={120} r={8} /></div>}
          {!cargando.inv && !inv.length && <Vacio icon={null} titulo="Sin foto de inventario" style={{ padding: 16 }} />}
          {!cargando.inv && inv.slice(0, 20).map((s) => (
            <Fila key={s.sku} titulo={s.descripcion ? `${s.descripcion} (${s.sku})` : s.sku} sub={s.mesActual ? `${int(s.mesActual)} pz vendidas en ${mesL.toLowerCase()}` : 'sin venta este mes'} valor={s.stock != null ? `${int(s.stock)} pz` : '—'} chevron={false} onClick={onSku ? () => onSku(s.sku) : undefined}
              pill={{ tone: tonoSem(s.stock != null && s.stock <= 0 ? 0 : s.semanas), label: lblSem(s.semanas, s.stock) }} />
          ))}
        </ListaAgrupada>
      )}

      {cf && (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '18px 28px 6px' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>Clientes finales</span>
            <span style={{ fontSize: 11, color: theme.textMuted }}>{mesL.toLowerCase()} · vs 6 meses atrás</span>
          </div>
          <KpiGrid>
            <KpiM eyebrow="Nuevos" big={String(cf.nuevos.length)} bigColor={cf.nuevos.length ? theme.green : undefined} sub={cf.nuevos.length ? moneyCompact(cf.nuevosImporte) : 'ninguno sin compra previa'} />
            <KpiM eyebrow="Perdidos" big={String(cf.perdidos.length)} bigColor={cf.perdidos.length ? theme.red : undefined} sub={cf.perdidos.length ? `compraban ${moneyCompact(cf.perdidosImporte)} en ${MESES[(mes + 10) % 12].toLowerCase()}` : 'nadie dejó de comprar'} />
          </KpiGrid>
          {(cf.nuevos.length > 0 || cf.perdidos.length > 0) && (
            <ListaAgrupada style={{ marginTop: 10 }} pie="Nuevo = compró este mes y en ninguno de los 6 anteriores · perdido = compró el mes anterior y no éste.">
              {cf.nuevos.slice(0, 5).map((c) => <Fila key={`n-${c.cliente}`} titulo={c.cliente} valor={moneyCompact(c.importe)} chevron={false} pill={{ tone: 'green', label: 'nuevo' }} />)}
              {cf.perdidos.slice(0, 5).map((c) => <Fila key={`p-${c.cliente}`} titulo={c.cliente} valor={moneyCompact(c.importe)} valorSub="mes anterior" chevron={false} pill={{ tone: 'red', label: 'perdido' }} />)}
            </ListaAgrupada>
          )}
        </>
      )}
      <div style={{ height: 12 }} />
    </>
  );
}

export default function CuentaFrenteAlResto({ cuenta, nombre, anio, mes, corteDia = 31, propio = false, clienteKey = null, conClientes = false }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const { data: cuentas = [], isLoading: lCta } = useCuentas();
  const { data: mensual = [], isLoading: lMes } = useMensual(anio);
  const { data: dias = [], isLoading: lDias } = useDias(anio);
  const pares = useMemo(() => paresDe(cuentas, cuenta), [cuentas, cuenta]);
  // Ventana = 3 meses cerrados: si el mes elegido está en curso, los tres anteriores.
  const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  const meses3 = useMemo(() => { const fin = enCurso ? (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }) : { anio, mes }; return ultimosMeses(fin.anio, fin.mes, 3); }, [anio, mes, enCurso]);
  const skuParesQ = useSkuMesCuentas([cuenta, ...pares], meses3, cuentas.length > 0);
  const skuQ = useDrillSkus(cuenta, anio);
  const invQ = useDrillInventario(cuenta);
  const cfQ = useDrillClientesFinales(cuenta, anio, mes, conClientes);
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);

  const filas = useMemo(() => construirFilas({ cuentas, mensual, dias, anio, mes, corteDia }), [cuentas, mensual, dias, anio, mes, corteDia]);
  const filasPrev = useMemo(() => { const p = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }; return construirFilas({ cuentas, mensual, dias, anio: p.anio, mes: p.mes, corteDia: 31 }); }, [cuentas, mensual, dias, anio, mes]);
  const rank = useMemo(() => ranking(filas, cuenta), [filas, cuenta]);
  const rankPrev = useMemo(() => ranking(filasPrev, cuenta), [filasPrev, cuenta]);
  const peso = useMemo(() => pesoEnCanal(filas, cuenta), [filas, cuenta]);
  const oport = useMemo(() => {
    const r = oportunidades({ skuMes: skuParesQ.data || [], cuenta, pares, meses: meses3, inventario: invQ.data || [] });
    return { ...r, lista: r.lista.map((o) => ({ ...o, descripcion: rd.get(o.sku)?.descripcion || '' })) };
  }, [skuParesQ.data, cuenta, pares, meses3, invQ.data, rd]);
  const fila = filas.find((f) => f.cuenta === cuenta) || null;
  const reportaInv = !!(fila && fila.invValor != null) || (invQ.data || []).length > 0;
  const inv = useMemo(() => (reportaInv ? skusDeCuenta(skuQ.data || [], invQ.data || [], anio, mes, 'piezas').filter((s) => s.stock != null).map((s) => ({ ...s, descripcion: rd.get(s.sku)?.descripcion || '' })) : []), [reportaInv, skuQ.data, invQ.data, anio, mes, rd]);
  const cf = useMemo(() => (conClientes ? clientesNuevosPerdidos(cfQ.data || [], anio, mes, 6) : null), [conClientes, cfQ.data, anio, mes]);
  const paresNombre = useMemo(() => pares.map((p) => { const c = cuentas.find((x) => x.cuenta === p); const n = String(c?.nombre || p).split(' ')[0]; return n.length <= 3 ? n : n.charAt(0) + n.slice(1).toLowerCase(); }), [pares, cuentas]);

  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  const armarPropuesta = () => nav.navegar({ pagina: 'propuestas', extra: { clienteKey: clienteKey || (PROPIOS.includes(cuenta) ? cuenta : null), skus: oport.lista.map((o) => o.sku) } });
  const cargando = lCta || lMes || lDias;
  return (
    <div data-stagger>
      <Cabecera onVolver={nav.pop} etiqueta={nombre} />
      <TituloGrande titulo={`${nombre.split(' (')[0]} frente al resto`} sub={`Sell out consolidado · ${MESES[mes - 1].toLowerCase()} ${anio}`} />
      {cargando && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={120} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={240} r={12} /></div>}
      {!cargando && !fila && <Vacio titulo="Cuenta sin sell out" sub={`${nombre} no tiene filas en el consolidado para ${anio}.`} color={theme.red} />}
      {!cargando && fila && (
        <FrenteVista nombre={nombre.split(' (')[0]} anio={anio} mes={mes} rank={rank} rankPrev={rankPrev} peso={peso} oport={oport} inv={inv} reportaInv={reportaInv} cf={cf} pares={pares} paresNombre={paresNombre}
          propio={propio || PROPIOS.includes(cuenta)} onPropuesta={armarPropuesta} onSku={abrirSku} cargando={{ oport: skuParesQ.isLoading, inv: skuQ.isLoading || invQ.isLoading }} />
      )}
    </div>
  );
}

