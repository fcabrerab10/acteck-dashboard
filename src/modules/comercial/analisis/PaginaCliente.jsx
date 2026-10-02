// Página completa de UN cliente del ERP (2026-10-01, Fernando: «quiero ser gerente de ventas… una página por cliente
// con su Sell In y Sell Out como la veo con mis clientes propios, entrando por Análisis por cliente; el drill queda como
// vista previa»). Se abre desde la fila de Análisis por Cliente (botón «Ver página completa») y vive dentro de esa
// pestaña (como Revisar en Propuestas): «‹ Análisis por cliente» regresa a la tabla con el mismo año y modo.
//   Resumen  → DrillCliente en vista completa (sell out resumido, KPIs, tendencia, categorías, apoyo, top 10 SKUs).
//   Sell In  → KPIs del mes/YTD con cuota, evolución 12 m vs año anterior, tabla SKU × 12 meses (piezas o monto,
//              buscador, MC % si sensible), composición por categoría, apoyo comercial y comparador de periodos.
//   Sell Out → el MISMO drill del Sell Out consolidado (DrillCuenta) para la cuenta ligada al código del ERP
//              (CUENTA_POR_ERP: 12 mayoristas + 3 propios); si el cliente no reporta sell out, se dice y ya.
import React, { useMemo, useRef, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { Hero, KpiCard, Pill, DeltaPill, Segmented, TablaCompacta, Panel, Boton, HeatCell, GraficaLineas, Cargando } from '../../../components/kit';
import { tooltip } from '../../../lib/medidas';
import ComparadorPeriodos from '../ComparadorPeriodos';
import ExportMenu from '../../../components/ExportMenu';
import DrillCliente from './DrillCliente';
import ZoomDiario from './ZoomDiario';
import CuotasTrimestre from './CuotasTrimestre';
import CategoriasSiSo from './CategoriasSiSo';
import DrillCuenta from '../sellout/DrillCuenta';
import SellOutPorReceta, { BloqueSkus } from '../sellout/BloquesCuenta';
import { useCuentas, useMensual, useDias, useCuotas, useDrillSkus, CUENTA_POR_ERP } from '../sellout/datos';
import { construirFilas, ultimoMesConVenta as ultimoMesSellOut, ultimoDiaConVenta, ultimosMeses, skusDeCuenta } from '../sellout/calculo';
import { useDetalleCliente, useSellInDia } from './useAnalisisData';
import { MESES, N, idxMes, serie12, pctDe, yoyDe, mcDe, cuotaPeriodo, alcanceCuota } from './calc';
import { money, moneyFull, int, pct, signo, toneDe, toneCanal, labelCanal } from './formato';

const TABS = [{ id: 'resumen', label: 'Resumen' }, { id: 'sellin', label: 'Sell In' }, { id: 'sellout', label: 'Sell Out' }];

// `periodo` (2026-10-01, Fernando: «en la página completa no me deja seleccionar mes o periodos»): los mismos
// controles de la tabla — Mes/YTD, año y mes — viven también en la barra de la página y cambian el estado de la pestaña.
export default function PaginaCliente({ cliente, anio, mesMax, modo, verSensible, alertas = [], cuotas, onVolver, tabInicial = 'resumen', periodo = null }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState(tabInicial);
  const rootRef = useRef(null);
  const mesLbl = MESES[mesMax - 1];
  const sel = { height: 30, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer' };
  const cuentaSellOut = CUENTA_POR_ERP[cliente.cliente] || null;
  // Para exportar (2026-10-01): el detalle por SKU de Sell In y de Sell Out se arma aquí con las mismas consultas
  // (cacheadas) que usan las pestañas, así el Excel sale completo aunque no se hayan abierto.
  const { data: detalleSku } = useDetalleCliente(cliente.cliente, anio);
  const { data: skuSellOut } = useDrillSkus(cuentaSellOut, anio, !!cuentaSellOut);
  const { data: roadmapExp } = useRoadmap();
  const excel = () => {
    const rd = new Map((roadmapExp || []).map((r) => [r.sku, r]));
    const kFin = idxMes(anio, mesMax);
    const meses12 = ultimosMeses(anio, mesMax, 12);
    const colMes = (pref) => meses12.map((m, i) => ({ label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)}`, key: `${pref}${i}`, tipo: pref === 'p' ? 'numero' : 'moneda', ancho: 11 }));
    // Sell In por SKU: fact. neta y piezas por mes (mv_analisis_cliente_sku_mes)
    const si = new Map();
    for (const r of detalleSku || []) {
      const i = idxMes(r.anio, r.mes) - (kFin - 11); if (i < 0 || i > 11) continue;
      const o = si.get(r.articulo) || { sku: r.articulo, descripcion: rd.get(r.articulo)?.descripcion || '', marca: r.marca || '', categoria: rd.get(r.articulo)?.categoria || r.categoria || '', total: 0, piezas: 0, contribucion: 0 };
      o[`m${i}`] = (o[`m${i}`] || 0) + N(r.fact_neta); o[`p${i}`] = (o[`p${i}`] || 0) + N(r.piezas_venta_neta);
      o.total += N(r.fact_neta); o.piezas += N(r.piezas_venta_neta); o.contribucion += N(r.contribucion); si.set(r.articulo, o);
    }
    const filasSi = [...si.values()].map((o) => ({ ...o, mc: o.total ? (o.contribucion / o.total) * 100 : null })).sort((a, b) => b.total - a.total);
    const hojas = [{
      nombre: 'Resumen', subtitulo: `${cliente.nombre} · Nº ${cliente.cliente} · ${anio} vs ${anio - 1}`,
      columnas: [{ label: 'Concepto', key: 'k', tipo: 'texto', ancho: 32 }, { label: 'Valor', key: 'v', tipo: 'texto', ancho: 22 }],
      filas: [
        { k: `Fact. neta ${mesLbl} ${anio}`, v: moneyFull(N(mes.fact_neta)) }, { k: `Fact. neta ${mesLbl} ${anio - 1}`, v: moneyFull(N(mesPrev.fact_neta)) },
        { k: `YTD ${anio}`, v: moneyFull(cliente.ytd.fact_neta) }, { k: `YTD ${anio - 1}`, v: moneyFull(cliente.ytdPrev.fact_neta) },
        { k: 'Piezas YTD', v: int(cliente.ytd.piezas_venta_neta) }, { k: 'Cuota YTD', v: cuotaYtd == null ? '—' : `${moneyFull(cuotaYtd)} · ${pct(pctYtd, 0)}` },
        ...(verSensible ? [{ k: '% MC YTD', v: pct(mcDe(cliente.ytd)) }, { k: 'Contribución YTD', v: moneyFull(cliente.ytd.contribucion) }] : []),
        { k: 'Última compra', v: cliente.ultimaCompra ? `${MESES[cliente.ultimaCompra.mes - 1]} ${cliente.ultimaCompra.anio}` : '—' }, { k: 'Meses con compra (12)', v: String(cliente.mesesCompra12) },
        { k: 'Sell out', v: cuentaSellOut ? 'reporta' : 'no reporta' },
      ],
    }, {
      nombre: 'Sell In por SKU', subtitulo: `${filasSi.length} SKUs · últimos 12 meses · fact. neta y piezas`,
      columnas: [
        { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 12 }, { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 40 }, { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 12 }, { label: 'Categoría', key: 'categoria', tipo: 'texto', ancho: 16 },
        ...colMes('m'), { label: 'Total 12 m', key: 'total', tipo: 'moneda', ancho: 14 }, ...colMes('p'), { label: 'Piezas 12 m', key: 'piezas', tipo: 'numero', ancho: 11 },
        ...(verSensible ? [{ label: 'MC %', key: 'mc', tipo: 'pct', ancho: 8 }] : []),
      ],
      filas: filasSi,
    }];
    if (cuentaSellOut) {
      const mesSo = (() => { const con = (skuSellOut || []).filter((r) => N(r.anio) === anio && N(r.importe) > 0).map((r) => N(r.mes)); return con.length ? Math.max(...con) : mesMax; })();
      const m12 = ultimosMeses(anio, mesSo, 12);
      const imp = skusDeCuenta(skuSellOut || [], [], anio, mesSo, 'importe'), pz = new Map(skusDeCuenta(skuSellOut || [], [], anio, mesSo, 'piezas').map((f) => [f.sku, f]));
      const filasSo = imp.map((f) => { const p = pz.get(f.sku); const o = { sku: f.sku, descripcion: rd.get(f.sku)?.descripcion || '', marca: f.marca || '', total: f.total, piezas: p?.total || 0 }; f.meses.forEach((v, i) => { o[`m${i}`] = v; o[`p${i}`] = p?.meses[i] || 0; }); return o; });
      hojas.push({
        nombre: 'Sell Out por SKU', subtitulo: `${filasSo.length} SKUs · últimos 12 meses a ${MESES[mesSo - 1]} ${anio} · importe sin IVA y piezas`,
        columnas: [
          { label: 'SKU', key: 'sku', tipo: 'texto', ancho: 12 }, { label: 'Descripción', key: 'descripcion', tipo: 'texto', ancho: 40 }, { label: 'Marca', key: 'marca', tipo: 'texto', ancho: 12 },
          ...m12.map((m, i) => ({ label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)}`, key: `m${i}`, tipo: 'moneda', ancho: 11 })), { label: 'Total 12 m', key: 'total', tipo: 'moneda', ancho: 14 },
          ...m12.map((m, i) => ({ label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)} pz`, key: `p${i}`, tipo: 'numero', ancho: 10 })), { label: 'Piezas 12 m', key: 'piezas', tipo: 'numero', ancho: 11 },
        ],
        filas: filasSo,
      });
    }
    return { titulo: `${cliente.nombre} · ${anio}`, archivo: `Cliente ${cliente.cliente} ${cliente.nombre.slice(0, 30)} ${anio}`, hojas };
  };

  const mes = cliente.mensual.get(idxMes(anio, mesMax)) || {}, mesPrev = cliente.mensual.get(idxMes(anio - 1, mesMax)) || {};
  const yoyMes = yoyDe(N(mes.fact_neta), N(mesPrev.fact_neta)), yoyYtd = yoyDe(cliente.ytd.fact_neta, cliente.ytdPrev.fact_neta);
  const cuotaYtd = cuotaPeriodo(cuotas, cliente.cliente, anio, mesMax, 'ytd');
  const pctYtd = cuotaYtd == null ? null : alcanceCuota(cliente.ytd.fact_neta, cuotaYtd);
  const titular = cliente.ytd.fact_neta > 0
    ? `${cliente.nombre} lleva ${money(cliente.ytd.fact_neta)} en ${anio}${yoyYtd != null ? `, ${signo(yoyYtd, 0)} contra ${anio - 1}` : ''}.`
    : `${cliente.nombre} no ha facturado en ${anio}.`;
  const sub = [
    cliente.ultimaCompra ? `Última compra ${MESES[cliente.ultimaCompra.mes - 1]} ${cliente.ultimaCompra.anio}` : 'Sin compras recientes',
    `${cliente.mesesCompra12} de 12 meses con compra`,
    pctYtd != null ? `${pct(pctYtd, 0)} de su cuota acumulada (${moneyFull(cuotaYtd)})` : 'sin cuota cargada',
    cuentaSellOut ? 'reporta sell out' : 'no reporta sell out',
  ].join(' · ');

  return (
    <div ref={rootRef} data-stagger style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Boton icon={ArrowLeft} onClick={onVolver}>Análisis por cliente</Boton>
        <Segmented options={TABS} value={tab} onChange={setTab} />
        {periodo ? (
          <>
            <Segmented options={[{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }]} value={modo} onChange={periodo.setModo} />
            <select value={anio} onChange={(e) => periodo.setAnio(Number(e.target.value))} style={sel} title="Año (comparativo contra el anterior)">
              {periodo.anios.map((y) => <option key={y} value={y}>{y} vs {y - 1}</option>)}
            </select>
            <select value={mesMax} onChange={(e) => periodo.setMes(Number(e.target.value))} style={sel} title={modo === 'mes' ? 'Mes a ver' : 'Acumulado hasta este mes'}>
              {Array.from({ length: periodo.mesAuto || 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{modo === 'mes' ? MESES[m - 1] : `ene–${MESES[m - 1].toLowerCase()}`}{m === periodo.mesAuto ? ' · último' : ''}</option>)}
            </select>
          </>
        ) : <span style={{ fontSize: 10.5, color: theme.textMuted }}>{anio} vs {anio - 1} · {modo === 'mes' ? `mes ${mesLbl}` : `YTD ene–${mesLbl.toLowerCase()}`}</span>}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Pill tone={toneCanal(cliente.canal)} size="xs">{labelCanal(cliente.canal)}</Pill>
          {cliente.propio && <Pill tone="inverse" size="xs">propio</Pill>}
          {cliente.ocasional && <Pill tone="orange" size="xs">compra ocasional</Pill>}
          <ExportMenu titulo={cliente.nombre} subtitulo={`Nº ${cliente.cliente} · ${anio}`} excel={excel} pdf={{ ref: rootRef }} />
        </span>
      </div>

      <Hero eyebrow={`Análisis por cliente · ${cliente.nombre} · Nº ${cliente.cliente}`} dot={false} titulo={titular} sub={sub}
        stats={[
          { k: `Fact Neta ${mesLbl}`, medida: tooltip('fact_neta', mesLbl), v: money(N(mes.fact_neta)), sub: yoyMes != null ? `${signo(yoyMes)} vs ${anio - 1}` : `sin ${anio - 1}` },
          { k: `YTD ${anio}`, medida: tooltip('fact_neta', `YTD ${anio}`), v: money(cliente.ytd.fact_neta), sub: yoyYtd != null ? `${signo(yoyYtd)} vs ${anio - 1}` : `sin ${anio - 1}` },
          { k: 'Piezas YTD', v: int(cliente.ytd.piezas_venta_neta), sub: `${int(cliente.ytdPrev.piezas_venta_neta)} en ${anio - 1}` },
          verSensible
            ? { k: '% MC · YTD', medida: tooltip('pct_mc'), v: pct(mcDe(cliente.ytd)), sub: `contribución ${money(cliente.ytd.contribucion)}` }
            : { k: 'Cuota YTD', v: pctYtd == null ? '—' : pct(pctYtd, 0), sub: cuotaYtd == null ? 'sin cuota' : moneyFull(cuotaYtd) },
        ]} />

      {tab === 'resumen' && <DrillCliente cliente={cliente} anio={anio} mesMax={mesMax} modo={modo} verSensible={verSensible} alertas={alertas} vista="completa" />}
      {tab === 'sellin' && <SellInCliente cliente={cliente} anio={anio} mesMax={mesMax} verSensible={verSensible} cuotas={cuotas} />}
      {tab === 'sellout' && <SellOutCuenta codigo={cliente.cliente} nombre={cliente.nombre} anio={anio} />}
    </div>
  );
}

// ───────────────────────────── Sell In ─────────────────────────────
function SellInCliente({ cliente, anio, mesMax, verSensible, cuotas }) {
  const { theme } = useTheme();
  const { data: detalle, isLoading } = useDetalleCliente(cliente.cliente, anio);
  const { data: diario = [], isLoading: cargandoDia } = useSellInDia(cliente.cliente, anio);
  const { data: roadmap } = useRoadmap();
  const cuentaSO = CUENTA_POR_ERP[cliente.cliente] || null;
  const [unidad, setUnidad] = useState('monto');
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const mesLbl = MESES[mesMax - 1];
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);

  const serie = useMemo(() => serie12(cliente.mensual, anio, mesMax), [cliente, anio, mesMax]);
  const kMes = idxMes(anio, mesMax);
  const mes = cliente.mensual.get(kMes) || {}, mesPrev = cliente.mensual.get(kMes - 12) || {}, mesAnt = cliente.mensual.get(kMes - 1) || {};
  const cuotaMes = cuotaPeriodo(cuotas, cliente.cliente, anio, mesMax, 'mes'), cuotaYtd = cuotaPeriodo(cuotas, cliente.cliente, anio, mesMax, 'ytd');
  const yoyMes = yoyDe(N(mes.fact_neta), N(mesPrev.fact_neta)), yoyYtd = yoyDe(cliente.ytd.fact_neta, cliente.ytdPrev.fact_neta), mom = yoyDe(N(mes.fact_neta), N(mesAnt.fact_neta));

  // SKU × últimos 12 meses (mv_analisis_cliente_sku_mes): piezas o fact. neta por mes, promedio, total y YoY (YTD vs YTD).
  const { filas, categorias } = useMemo(() => {
    const rows = detalle || [];
    const fin = kMes, ini = fin - 11;
    const by = new Map(), cat = new Map();
    let totalYtd = 0;
    for (const r of rows) {
      const k = idxMes(r.anio, r.mes), sku = r.articulo || '—';
      let s = by.get(sku);
      if (!s) { s = { sku, marca: r.marca, meses: Array(12).fill(0), ytd: 0, ytdPrev: 0, pzYtd: 0, contrib: 0, montoYtd: 0 }; by.set(sku, s); }
      const v = unidad === 'piezas' ? N(r.piezas_venta_neta) : N(r.fact_neta);
      if (k >= ini && k <= fin) s.meses[k - ini] += v;
      const enYtd = N(r.anio) === anio && N(r.mes) <= mesMax, enYtdPrev = N(r.anio) === anio - 1 && N(r.mes) <= mesMax;
      if (enYtd) { s.ytd += v; s.pzYtd += N(r.piezas_venta_neta); s.contrib += N(r.contribucion); s.montoYtd += N(r.fact_neta); totalYtd += N(r.fact_neta); }
      if (enYtdPrev) s.ytdPrev += v;
      if (enYtd) {
        const cRaw = String(rd.get(sku)?.categoria || r.categoria || 'Sin categoría').trim(), cKey = cRaw.toLowerCase();
        const prev = cat.get(cKey) || { nombre: cRaw, monto: 0 }; prev.monto += N(r.fact_neta); cat.set(cKey, prev);
      }
    }
    const filas = Array.from(by.values()).filter((s) => s.meses.some((v) => v !== 0) || s.ytd !== 0).map((s) => {
      const con = s.meses.filter((v) => v > 0);
      return { ...s, total: s.meses.reduce((a, b) => a + b, 0), prom: con.length ? con.reduce((a, b) => a + b, 0) / con.length : 0, max: Math.max(0, ...s.meses), yoy: yoyDe(s.ytd, s.ytdPrev), mc: s.montoYtd ? (s.contrib / s.montoYtd) * 100 : null, descripcion: rd.get(s.sku)?.descripcion || '' };
    });
    const categorias = Array.from(cat.values()).map((c) => ({ ...c, pct: pctDe(c.monto, totalYtd) || 0 })).sort((a, b) => b.monto - a.monto);
    return { filas, categorias };
  }, [detalle, rd, anio, mesMax, unidad, kMes]);

  const filasVisibles = useMemo(() => {
    const q = busca.trim().toUpperCase();
    let l = q ? filas.filter((f) => f.sku.toUpperCase().includes(q) || f.descripcion.toUpperCase().includes(q) || String(f.marca || '').toUpperCase().includes(q)) : filas;
    const dir = orden.dir === 'asc' ? 1 : -1;
    return [...l].sort((a, b) => { const va = a[orden.col], vb = b[orden.col]; if (typeof va === 'string') return String(va).localeCompare(String(vb)) * dir; return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir; });
  }, [filas, busca, orden]);

  const fmtU = unidad === 'piezas' ? int : money;
  const meses12 = Array.from({ length: 12 }, (_, i) => { const k = kMes - 11 + i; return { anio: Math.floor(k / 12), mes: (k % 12) + 1 }; });
  const accent = theme.accent || '#007AFF';

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard medida={tooltip('fact_neta')} eyebrow={`MTD · ${mesLbl}`} badge={yoyMes != null ? { l: `${signo(yoyMes)} YoY`, tone: toneDe(yoyMes) } : undefined}
          big={money(N(mes.fact_neta))} bigSmall={`vs ${money(N(mesPrev.fact_neta))}`} sub={cuotaMes != null ? `cuota ${moneyFull(cuotaMes)} · ${pct(alcanceCuota(N(mes.fact_neta), cuotaMes), 0)}` : `${int(N(mes.piezas_venta_neta))} pz`} />
        <KpiCard medida={tooltip('fact_neta', 'YTD')} eyebrow={`YTD · ${anio}`} badge={yoyYtd != null ? { l: `${signo(yoyYtd)} YoY`, tone: toneDe(yoyYtd) } : undefined}
          big={money(cliente.ytd.fact_neta)} bigSmall={`vs ${money(cliente.ytdPrev.fact_neta)}`} sub={cuotaYtd != null ? `cuota ${moneyFull(cuotaYtd)} · ${pct(alcanceCuota(cliente.ytd.fact_neta, cuotaYtd), 0)}` : `${int(cliente.ytd.piezas_venta_neta)} pz`} />
        <KpiCard eyebrow={`MoM · vs ${MESES[Math.max(0, mesMax - 2)]}`} big={mom == null ? '—' : signo(mom, 1)} bigColor={mom == null ? undefined : mom >= 0 ? theme.green : theme.red} sub={`${money(N(mesAnt.fact_neta))} el mes anterior`} />
        <KpiCard eyebrow={`Dev + RMA's + bonif · YTD`} big={pct(cliente.ytd.fact_bruta ? ((cliente.ytd.devoluciones + cliente.ytd.rmas + cliente.ytd.bonificaciones) / cliente.ytd.fact_bruta) * -100 : null)} bigSmall="de la fact. bruta"
          sub={`dev ${money(cliente.ytd.devoluciones)} · NC ${money(cliente.ytd.rmas)} · bonif ${money(cliente.ytd.bonificaciones)}`} />
      </div>

      <ZoomDiario titulo={`Sell in por día · ${mesLbl} ${anio}`} filas={diario.map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: r.fact_neta }))} anio={anio} mes={mesMax} formato={money} cargando={cargandoDia} />

      <CuotasTrimestre mensual={cliente.mensual} cuotas={cuotas} cliente={cliente.cliente} anio={anio} mesMax={mesMax} />

      <Panel titulo="Evolución mensual · Sell In" meta={`últimos 12 meses · línea gris = mismo mes de ${anio - 1}${verSensible ? ' · verde = contribución' : ''}`} padding="6px 8px 4px">
        <GraficaLineas datos={serie.map((d) => ({ x: d.label, fact_neta: d.fact_neta, anterior: d.anterior, contribucion: d.contribucion }))}
          series={[{ key: 'fact_neta', label: 'Fact. neta', tipo: 'principal' }, { key: 'anterior', label: 'Año anterior', tipo: 'anterior' }, ...(verSensible ? [{ key: 'contribucion', label: 'Contribución', tipo: 'linea', color: theme.green || '#34C759' }] : [])]}
          formato={money} alto={220} />
      </Panel>

      <Panel titulo="Detalle por SKU" meta={`${filasVisibles.length} SKUs · últimos 12 meses · ${unidad === 'piezas' ? 'piezas' : 'fact. neta'}`}
        acciones={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, height: 28, minWidth: 200 }}>
              <Search size={12} style={{ color: theme.textMuted }} />
              <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="SKU, descripción o marca…" style={{ flex: 1, outline: 'none', fontSize: 11.5, background: 'transparent', border: 'none', color: theme.text, fontFamily: 'inherit' }} />
              {busca && <button onClick={() => setBusca('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: 0, display: 'inline-flex' }}><X size={12} /></button>}
            </div>
            <Segmented options={[{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: 'Monto' }]} value={unidad} onChange={setUnidad} />
          </div>
        )} padding="0 0 2px">
        {isLoading ? <Cargando pantalla="analisisDrill" minHeight={240} /> : (
          <TablaCompacta dense maxHeight={520} rowKey={(r) => r.sku} filas={filasVisibles} orden={orden}
            onSort={(col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'sku' ? 'asc' : 'desc' }))}
            vacio="Sin SKUs con venta en los últimos 12 meses."
            columnas={[
              { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100, sort: true },
              { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 240, render: (r) => <span style={{ color: theme.textMuted }} title={r.descripcion}>{r.descripcion || r.marca || '—'}</span> },
              ...meses12.map((m, i) => ({ key: `m${i}`, label: `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`, width: 50, render: (r) => <HeatCell v={r.meses[i]} max={r.max} fmt={fmtU} /> })),
              { key: 'prom', label: 'Prom', width: 60, sort: true, render: (r) => fmtU(r.prom) },
              { key: 'total', label: 'Total', width: 70, bold: true, sort: true, render: (r) => fmtU(r.total) },
              { key: 'yoy', label: 'YoY', width: 64, sort: true, render: (r) => <DeltaPill value={r.yoy} /> },
              ...(verSensible ? [{ key: 'mc', label: 'MC %', width: 54, sort: true, render: (r) => <span style={{ color: r.mc == null ? theme.textMuted : r.mc < 0 ? theme.red : theme.text }}>{pct(r.mc)}</span> }] : []),
            ]} />
        )}
      </Panel>

      <CategoriasSiSo categoriasSellIn={categorias} cuenta={cuentaSO} anio={anio} mesMax={mesMax} />

      <Panel titulo="Comparador de periodos" meta={cliente.nombre} plegable abiertoInicial={false}>
        <ComparadorPeriodos clienteNombre={cliente.nombre} clienteCodigo={cliente.cliente} ocultarSensible={!verSensible} />
      </Panel>
    </>
  );
}

// ───────────────────────────── Sell Out ─────────────────────────────
// Misma cuenta y mismo drill que el Sell Out consolidado: las pestañas (SKUs, Inventario, Sucursales y vendedores,
// Clientes finales, Mapa) aparecen sólo si la fuente de esa cuenta las alimenta.
function SellOutCuenta({ codigo, nombre, anio }) {
  const { theme } = useTheme();
  const cuenta = CUENTA_POR_ERP[codigo] || null;
  const { data: cuentas = [] } = useCuentas();
  const { data: dias = [], isLoading: cDias } = useDias(cuenta ? anio : null);
  const { data: mensual = [], isLoading: cMes } = useMensual(cuenta ? anio : null);
  const { data: cuotas = [] } = useCuotas(cuenta ? anio : null);
  const [estadoSel, setEstadoSel] = useState(null);

  // Mes = el último con sell out de ESTA cuenta en el año (no el del consolidado: el día 1 otra cuenta ya tiene
  // ventas y ésta saldría en $0). Dimensiones = lo que la fuente trajo en cualquier mes del año, no sólo en ese mes.
  const propios = useMemo(() => mensual.filter((r) => r.cuenta === cuenta && Number(r.anio) === anio), [mensual, cuenta, anio]);
  const mes = useMemo(() => {
    const con = propios.filter((r) => Number(r.importe) > 0).map((r) => Number(r.mes));
    if (con.length) return Math.max(...con);
    const u = ultimoMesSellOut(dias);
    return u && u.anio === anio ? u.mes : (anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12);
  }, [propios, dias, anio]);
  const corteDia = useMemo(() => ultimoDiaConVenta(dias, anio, mes) || 31, [dias, anio, mes]);
  const diasCuenta = useMemo(() => dias.filter((r) => r.cuenta === cuenta).map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: r.importe })), [dias, cuenta]);
  const fila = useMemo(() => {
    const f = construirFilas({ cuentas, mensual, dias, anio, mes, corteDia, cuotas }).find((x) => x.cuenta === cuenta);
    if (!f) return null;
    const hay = (k) => propios.some((r) => r[k] != null);
    return {
      ...f,
      sucursales: hay('sucursales') ? (f.sucursales ?? 0) : null,
      vendedores: hay('vendedores') ? (f.vendedores ?? 0) : null,
      clientesFinales: hay('clientes_finales') ? (f.clientesFinales ?? 0) : null,
      estados: Math.max(f.estados || 0, ...propios.map((r) => Number(r.estados) || 0)),
    };
  }, [cuentas, mensual, dias, anio, mes, corteDia, cuotas, cuenta, propios]);

  if (!cuenta) {
    return (
      <Panel titulo="Sell Out" meta="sin fuente">
        <div style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.5 }}>
          {nombre} no reporta sell out al dashboard: no está entre los 12 mayoristas del puente ni es cliente propio. Lo que se ve de este cliente es su Sell In (lo que nos compra).
        </div>
      </Panel>
    );
  }
  if (cDias || cMes || !fila) return <Cargando pantalla="selloutDrill" minHeight={320} />;
  // Propios (Digitalife, PCEL, Dicotech): el drill con pestañas del consolidado + detalle por SKU.
  // No propios: bloques apilados a la medida de lo que trae su fuente (sellout/BloquesCuenta.jsx · RECETAS).
  if (fila.propio) {
    return (
      <>
        <Panel titulo="Sell Out" meta={`${fila.nombre} · ${MESES[mes - 1].toLowerCase()} ${anio} · lo que desplaza y lo que tiene en su almacén · sin IVA`} padding="0">
          <DrillCuenta fila={fila} anio={anio} mes={mes} corteDia={corteDia} estadoSel={estadoSel} onEstado={setEstadoSel} />
        </Panel>
        <ZoomDiario titulo={`Sell out por día · ${MESES[mes - 1]} ${anio}`} filas={diasCuenta} anio={anio} mes={mes} formato={money} />
        <BloqueSkus cuenta={cuenta} anio={anio} mes={mes} conInventario={fila.invValor != null} />
      </>
    );
  }
  return (
    <>
      <SellOutPorReceta cuenta={cuenta} fila={fila} anio={anio} mes={mes} corteDia={corteDia} />
      <ZoomDiario titulo={`Sell out por día · ${MESES[mes - 1]} ${anio}`} filas={diasCuenta} anio={anio} mes={mes} formato={money} />
    </>
  );
}
