// Pestañas Sell In y Sell Out de la ficha móvil de Análisis por cliente (2026-10-01): mismas tres pestañas que la
// página web (Resumen · Sell In · Sell Out) para cualquier cliente del ERP.
//   Sell In  → detalle por SKU × últimos 12 meses (TablaAnual, piezas o monto, buscador) con las filas de
//              facturacion_clientes que la ficha ya cargó; tocar un SKU abre su ficha de producto.
//   Sell Out → la cuenta de sell out ligada al código del ERP (CUENTA_POR_ERP): pastillas del último mes con venta
//              (importe, SO/SI, Δ YoY) y «Abrir Sell Out completo» → la pantalla Cuenta del consolidado móvil
//              (SKUs, inventario, sucursales, clientes finales, estados: sólo lo que la fuente trae).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { cachedQuery } from '../../../lib/queries';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useNav } from '../../nav';
import { KpiM, KpiGrid, Skeleton, Vacio, CampoBusqueda, Segmented, BotonGrande, TituloSeccionM } from '../../piezas';
import { money, moneyCompact, int, deltaPct, tonoDelta, MESES, N } from '../../util';
import TablaAnual from '../sellout/TablaAnual';
import { catalogoSkus, ultimosMeses } from '../SellInCliente';
import FichaProducto from '../../FichaProducto';
import Cuenta from '../selloutGlobal/Cuenta';
import { useCuentas, useDias, useMensual, useCuotas, CUENTA_POR_ERP } from '../../../modules/comercial/sellout/datos';
import { construirFilas, ultimoDiaConVenta, yoy } from '../../../modules/comercial/sellout/calculo';
import { GraficaLineas, Pill } from '../../../components/kit';
import { patronMes } from '../../../modules/comercial/analisis/ZoomDiario';
import { cuotasPorTrimestre } from '../../../modules/comercial/analisis/CuotasTrimestre';
import { useCuotasClientes, useSellInDia } from '../../../modules/comercial/analisis/useAnalisisData';
import { mapaCuotas, idxMes } from '../../../modules/comercial/analisis/calc';
import { pct } from '../../util';

// ── Zoom por día del mes (2026-10-02, mismo motor que la web: patronMes) ──
function ZoomDiarioM({ titulo, filas, anio, mes, cargando }) {
  const { theme } = useTheme();
  const cur = useMemo(() => patronMes(filas, anio, mes), [filas, anio, mes]);
  const prev = useMemo(() => patronMes(filas, anio - 1, mes), [filas, anio, mes]);
  const hoy = new Date(); const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1; const diaHoy = enCurso ? hoy.getDate() : cur.diasMes;
  const datos = cur.porDia.map((d, i) => ({ x: String(d.dia), dia: d.dia <= diaHoy ? d.valor : null, acum: d.dia <= diaHoy ? d.acum : null, prev: prev.porDia[i]?.acum ?? null }));
  const tono = cur.pctUlt5 == null ? 'gray' : cur.pctUlt5 >= 50 ? 'red' : cur.pctUlt5 >= 35 ? 'orange' : 'green';
  return (
    <>
      <TituloSeccionM style={{ margin: '14px 0 0', padding: '0 28px 6px' }} meta={`${MESES[mes - 1]} ${anio}`}>{titulo}</TituloSeccionM>
      <div style={{ margin: '0 16px', padding: '8px 8px 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12 }}>
        {cargando ? <Skeleton h={120} r={8} /> : (
          <>
            <GraficaLineas compacto alto={150} datos={datos} formato={moneyCompact}
              series={[{ key: 'dia', label: 'Día', tipo: 'principal' }, { key: 'acum', label: 'Acumulado', tipo: 'linea', color: theme.accent }, { key: 'prev', label: `Acum. ${anio - 1}`, tipo: 'anterior' }]} />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', padding: '8px 6px 0', fontSize: 11.5, color: theme.textMuted, lineHeight: 1.4 }}>
              {cur.total > 0 ? <><Pill size="xs" tone={tono}>{cur.pctUlt5 >= 50 ? 'Todo al cierre' : cur.pctUlt5 >= 35 ? 'Cargado al cierre' : 'Repartido'}</Pill><span>{pct(cur.pctUlt5, 0)} en los últimos 5 días · {pct(cur.pctMitad, 0)} en la primera quincena · {cur.conVenta} días con venta{cur.pico ? ` · pico día ${cur.pico.dia}` : ''}</span></> : <span>Sin venta registrada en este mes.</span>}
            </div>
            {cur.total > 0 && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0,1fr))', gap: 6, padding: '8px 6px 0' }}>
              {cur.semanas.map((w) => <div key={w.semana}><div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted }}><span>{w.semana === 5 ? '29+' : `S${w.semana}`}</span><span style={{ color: theme.text, fontWeight: 600 }}>{pct(w.pct, 0)}</span></div><div style={{ height: 4, borderRadius: 999, background: `${theme.text}12`, marginTop: 2, overflow: 'hidden' }}><div style={{ height: '100%', width: `${w.pct}%`, background: w.semana >= 4 && w.pct >= 40 ? theme.orange : theme.accent }} /></div></div>)}
            </div>}
          </>
        )}
      </div>
    </>
  );
}

// ── Cuotas por trimestre (mismo cálculo que la web: cuotasPorTrimestre) ──
function CuotasTrimestreM({ rows, codigo, anio, mes }) {
  const { theme } = useTheme();
  const { data: cuotasRows = [] } = useCuotasClientes(anio);
  const qs = useMemo(() => {
    const mensual = new Map();
    rows.forEach((r) => { const k = idxMes(r.anio, r.mes); const o = mensual.get(k) || { fact_neta: 0 }; o.fact_neta += N(r.monto); mensual.set(k, o); });
    return cuotasPorTrimestre(mensual, mapaCuotas(cuotasRows), codigo, anio, mes);
  }, [rows, cuotasRows, codigo, anio, mes]);
  const logrados = qs.filter((q) => q.logrado === true).length, cerrados = qs.filter((q) => q.cerrado).length;
  return (
    <>
      <TituloSeccionM style={{ margin: '14px 0 0', padding: '0 28px 6px' }} meta={qs.some((q) => q.cuota) ? `${logrados} de ${cerrados} logrados` : 'sin cuota'}>Cuotas por trimestre</TituloSeccionM>
      <KpiGrid>
        {qs.map((q) => {
          const tone = q.pct == null ? 'gray' : q.pct >= 100 ? 'green' : q.pct >= 85 ? 'blue' : q.pct >= 60 ? 'orange' : 'red';
          return <KpiM key={q.q} eyebrow={`Q${q.q} · ${q.futuro ? 'por venir' : q.enCurso ? 'en curso' : q.logrado ? 'logrado' : 'no logrado'}`} big={q.futuro ? '—' : moneyCompact(q.venta)} sub={q.cuota ? `de ${moneyCompact(q.cuota)}${q.yoy != null && !q.futuro ? ` · ${deltaPct(q.yoy)} vs ${anio - 1}` : ''}` : 'sin cuota'} progress={q.cuota && !q.futuro ? q.pct : undefined} pill={q.cuota && !q.futuro ? { tone, label: `${Math.round(q.pct)}%` } : undefined} />;
        })}
      </KpiGrid>
    </>
  );
}


const STALE = 5 * 60 * 1000;

// ───────────────────────────── Sell In ─────────────────────────────
export function SellInM({ rows = [], anio, mes, clienteNombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { data: codigo } = useCodigoErp(clienteNombre, anio);
  const { data: diario = [], isLoading: cargandoDia } = useSellInDia(codigo, anio, !!codigo);
  const [unidad, setUnidad] = useState('monto');
  const [busca, setBusca] = useState('');
  const meses = useMemo(() => ultimosMeses(anio, mes, 12), [anio, mes]);

  const porSku = useMemo(() => {
    const idx = new Map(meses.map((m, i) => [`${m.anio}-${m.mes}`, i]));
    const by = new Map();
    for (const r of rows) {
      if (!r.sku) continue;
      const i = idx.get(`${N(r.anio)}-${N(r.mes)}`);
      if (i == null) continue;
      const o = by.get(r.sku) || { sku: r.sku, piezas: Array(12).fill(0), monto: Array(12).fill(0) };
      o.piezas[i] += N(r.piezas); o.monto[i] += N(r.monto);
      by.set(r.sku, o);
    }
    return [...by.values()].map((o) => ({ ...o, totMonto: o.monto.reduce((s, v) => s + v, 0), totPz: o.piezas.reduce((s, v) => s + v, 0) })).sort((a, b) => b.totMonto - a.totMonto);
  }, [rows, meses]);

  const skus = useMemo(() => porSku.slice(0, 80).map((o) => o.sku), [porSku]);
  const { data: cat } = useQuery({ queryKey: ['movil', 'analisis-cat', skus.join(',')], staleTime: STALE, enabled: skus.length > 0, queryFn: () => catalogoSkus(skus) });

  const filas = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return porSku.slice(0, 80).map((o) => {
      const c = cat?.get(o.sku) || {};
      return { sku: o.sku, label: o.sku, sub: c.descripcion || c.marca || '', valores: unidad === 'piezas' ? o.piezas : o.monto, descripcion: c.descripcion || '' };
    }).filter((f) => !q || f.sku.toUpperCase().includes(q) || f.descripcion.toUpperCase().includes(q));
  }, [porSku, cat, unidad, busca]);

  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  const fmt = unidad === 'piezas' ? (n) => Math.round(n).toLocaleString('es-MX') : moneyCompact;

  return (
    <>
      {codigo && <ZoomDiarioM titulo="Sell in por día" filas={diario.map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: r.fact_neta }))} anio={anio} mes={mes} cargando={cargandoDia} />}
      {codigo && <CuotasTrimestreM rows={rows} codigo={codigo} anio={anio} mes={mes} />}
      <TituloSeccionM style={{ margin: '14px 0 0', padding: '0 28px 6px' }} meta={`${porSku.length} SKUs · 12 meses`}>Detalle por SKU</TituloSeccionM>
      <div style={{ padding: '0 16px 8px', display: 'flex', gap: 8, alignItems: 'center' }}>
        <CampoBusqueda value={busca} onChange={setBusca} placeholder="SKU o descripción" style={{ flex: 1 }} />
        <Segmented value={unidad} onChange={setUnidad} options={[{ id: 'piezas', label: 'Pz' }, { id: 'monto', label: '$' }]} />
      </div>
      <div style={{ padding: '0 16px' }}>
        {!porSku.length ? <Vacio icon={null} titulo="Sin facturación en los últimos 12 meses" /> : (
          <TablaAnual columnas={meses.map((m) => m.label)} filas={filas.map((f) => ({ ...f, onClick: () => abrirSku(f.sku) }))} fmt={fmt}
            etiquetaFilas={porSku.length > 80 ? 'top 80' : ''} totalLabel="Total" vacio="Ningún SKU coincide." />
        )}
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>
          {unidad === 'piezas' ? 'Piezas' : 'Fact. neta'} por mes de lo que nos compra este cliente · <strong>Prom</strong> = promedio de los meses con compra. Toca un SKU para ver disponibilidad y precios.
        </div>
      </div>
    </>
  );
}

// ───────────────────────────── Sell Out ─────────────────────────────
/** Código ERP del cliente a partir de su nombre (v_analisis_cliente_mes); con él, la cuenta de sell out. */
function useCodigoErp(clienteNombre, anio) {
  return useQuery({
    queryKey: ['movil', 'analisis-codigo', clienteNombre, anio], staleTime: STALE, enabled: !!clienteNombre,
    queryFn: async () => {
      const { data } = await cachedQuery(supabase.from('v_analisis_cliente_mes').select('cliente,fact_neta').eq('cliente_nombre', clienteNombre).in('anio', [anio - 1, anio]));
      const por = new Map();
      (data || []).forEach((r) => por.set(r.cliente, (por.get(r.cliente) || 0) + N(r.fact_neta)));
      return [...por.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    },
  });
}

export function SellOutM({ clienteNombre, nombre, anio }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { data: codigo, isLoading: lCod } = useCodigoErp(clienteNombre, anio);
  const cuenta = codigo ? (CUENTA_POR_ERP[codigo] || null) : null;
  const { data: cuentas = [] } = useCuentas();
  const { data: dias = [], isLoading: lDias } = useDias(cuenta ? anio : null);
  const { data: mensual = [], isLoading: lMes } = useMensual(cuenta ? anio : null);
  const { data: cuotas = [] } = useCuotas(cuenta ? anio : null);

  const propios = useMemo(() => mensual.filter((r) => r.cuenta === cuenta && N(r.anio) === anio), [mensual, cuenta, anio]);
  const mes = useMemo(() => {
    const con = propios.filter((r) => N(r.importe) > 0).map((r) => N(r.mes));
    return con.length ? Math.max(...con) : (anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12);
  }, [propios, anio]);
  const corteDia = useMemo(() => ultimoDiaConVenta(dias, anio, mes) || 31, [dias, anio, mes]);
  const fila = useMemo(() => construirFilas({ cuentas, mensual, dias, anio, mes, corteDia, cuotas }).find((f) => f.cuenta === cuenta) || null, [cuentas, mensual, dias, anio, mes, corteDia, cuotas, cuenta]);
  const prev = useMemo(() => mensual.find((r) => r.cuenta === cuenta && N(r.anio) === anio - 1 && N(r.mes) === mes), [mensual, cuenta, anio, mes]);
  const act = useMemo(() => propios.find((r) => N(r.mes) === mes), [propios, mes]);

  if (lCod) return <div style={{ padding: '14px 16px' }}><Skeleton h={120} r={12} /></div>;
  if (!cuenta) {
    return <Vacio icon={ShoppingBag} titulo="No reporta sell out" sub={`${nombre} no está entre los 12 mayoristas del puente ni es cliente propio: lo que se ve es su Sell In (lo que nos compra).`} style={{ padding: 18 }} />;
  }
  if (lDias || lMes || !fila) return <div style={{ padding: '14px 16px' }}><Skeleton h={120} r={12} /></div>;

  const soSi = act && N(act.sell_in) > 0 ? (N(act.importe) / N(act.sell_in)) * 100 : null;
  const dYoy = yoy(N(act?.importe), N(prev?.importe));
  return (
    <>
      <TituloSeccionM style={{ margin: '14px 0 0', padding: '0 28px 6px' }} meta={`${MESES[mes - 1]} ${anio}`}>Sell Out</TituloSeccionM>
      <KpiGrid>
        <KpiM eyebrow={`Sell out ${MESES[mes - 1]}`} big={moneyCompact(N(act?.importe))} sub={dYoy != null ? `${deltaPct(dYoy)} vs ${anio - 1}` : `sin ${anio - 1}`} pill={dYoy != null ? { tone: tonoDelta(dYoy), label: deltaPct(dYoy) } : undefined} />
        <KpiM eyebrow="Sell out vs sell in" big={soSi == null ? '—' : `${Math.round(soSi)}%`} sub={act && N(act.sell_in) > 0 ? `sell in ${moneyCompact(N(act.sell_in))}` : 'sin sell in ese mes'} />
        <KpiM eyebrow="Clientes finales" big={fila.clientesFinales != null ? int(N(fila.clientesFinales)) : '—'} sub={fila.clientesFinales != null ? 'con compra en el mes' : 'la fuente no lo trae'} />
        <KpiM eyebrow="Inventario" big={fila.invValor != null ? `${int(N(act?.inv_piezas))} pz` : '—'} sub={fila.invValor != null ? money(N(fila.invValor)) : 'no reporta'} />
      </KpiGrid>
      <ZoomDiarioM titulo="Sell out por día" filas={dias.filter((r) => r.cuenta === cuenta).map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: r.importe }))} anio={anio} mes={mes} />
      <div style={{ padding: '14px 16px 0' }}>
        <BotonGrande primario icon={ShoppingBag} onClick={() => nav.push(<Cuenta fila={fila} anio={anio} mes={mes} corteDia={corteDia} />, `sellout-cuenta-${cuenta}`)}>Abrir Sell Out completo</BotonGrande>
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '8px 4px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>SKUs, inventario, sucursales, clientes finales y estados: sólo lo que la fuente de {nombre} alimenta.</div>
      </div>
    </>
  );
}
