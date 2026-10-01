// Página completa de UN cliente del ERP (2026-10-01, Fernando: «quiero ser gerente de ventas… una página por cliente
// con su Sell In y Sell Out como la veo con mis clientes propios, entrando por Análisis por cliente; el drill queda como
// vista previa»). Se abre desde la fila de Análisis por Cliente (botón «Ver página completa») y vive dentro de esa
// pestaña (como Revisar en Propuestas): «‹ Análisis por cliente» regresa a la tabla con el mismo año y modo.
//   Resumen  → DrillCliente en vista completa (sell out resumido, KPIs, tendencia, categorías, apoyo, top 10 SKUs).
//   Sell In  → KPIs del mes/YTD con cuota, evolución 12 m vs año anterior, tabla SKU × 12 meses (piezas o monto,
//              buscador, MC % si sensible), composición por categoría, apoyo comercial y comparador de periodos.
//   Sell Out → el MISMO drill del Sell Out consolidado (DrillCuenta) para la cuenta ligada al código del ERP
//              (CUENTA_POR_ERP: 12 mayoristas + 3 propios); si el cliente no reporta sell out, se dice y ya.
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Search, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { Hero, KpiCard, Pill, DeltaPill, Segmented, TablaCompacta, Panel, Boton, HeatCell, GraficaLineas, Cargando } from '../../../components/kit';
import { tooltip } from '../../../lib/medidas';
import ComparadorPeriodos from '../ComparadorPeriodos';
import DrillCliente, { ApoyoDelAnio } from './DrillCliente';
import DrillCuenta from '../sellout/DrillCuenta';
import { useCuentas, useMensual, useDias, useCuotas, useDrillSkus, useDrillInventario, CUENTA_POR_ERP } from '../sellout/datos';
import { construirFilas, ultimoMesConVenta as ultimoMesSellOut, ultimoDiaConVenta, skusDeCuenta, ultimosMeses } from '../sellout/calculo';
import { useDetalleCliente } from './useAnalisisData';
import { MESES, N, idxMes, serie12, pctDe, yoyDe, mcDe, cuotaPeriodo, alcanceCuota } from './calc';
import { money, moneyFull, int, pct, signo, toneDe, toneCanal, labelCanal } from './formato';

const TABS = [{ id: 'resumen', label: 'Resumen' }, { id: 'sellin', label: 'Sell In' }, { id: 'sellout', label: 'Sell Out' }];

export default function PaginaCliente({ cliente, anio, mesMax, modo, verSensible, alertas = [], cuotas, onVolver, tabInicial = 'resumen' }) {
  const { theme } = useTheme();
  const [tab, setTab] = useState(tabInicial);
  const mesLbl = MESES[mesMax - 1];
  const cuentaSellOut = CUENTA_POR_ERP[cliente.cliente] || null;

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
    <div data-stagger style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Boton icon={ArrowLeft} onClick={onVolver}>Análisis por cliente</Boton>
        <Segmented options={TABS} value={tab} onChange={setTab} />
        <span style={{ fontSize: 10.5, color: theme.textMuted }}>{anio} vs {anio - 1} · {modo === 'mes' ? `mes ${mesLbl}` : `YTD ene–${mesLbl.toLowerCase()}`}</span>
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Pill tone={toneCanal(cliente.canal)} size="xs">{labelCanal(cliente.canal)}</Pill>
          {cliente.propio && <Pill tone="inverse" size="xs">propio</Pill>}
          {cliente.ocasional && <Pill tone="orange" size="xs">compra ocasional</Pill>}
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
  const { data: roadmap } = useRoadmap();
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

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10 }}>
        <Panel titulo="Composición por categoría" meta={`YTD ${anio} · roadmap_sku / ERP`}>
          {!categorias.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin ventas en el año.</div>}
          <div style={{ display: 'grid', gap: 4 }}>
            {categorias.slice(0, 10).map((c) => (
              <div key={c.nombre} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px 44px', gap: 8, alignItems: 'center', fontSize: 11 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }}>{c.nombre}</div>
                  <div style={{ height: 3, borderRadius: 999, background: theme.border, marginTop: 2 }}><div style={{ height: '100%', width: `${Math.max(2, c.pct)}%`, background: accent, borderRadius: 999 }} /></div>
                </div>
                <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600 }}>{money(c.monto)}</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: theme.textMuted }}>{pct(c.pct, 0)}</span>
              </div>
            ))}
          </div>
        </Panel>
        <ApoyoDelAnio codigo={cliente.cliente} anio={anio} mesMax={mesMax} />
      </div>

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

  const ultimo = useMemo(() => ultimoMesSellOut(dias), [dias]);
  const mes = ultimo && ultimo.anio === anio ? ultimo.mes : (anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12);
  const corteDia = useMemo(() => ultimoDiaConVenta(dias, anio, mes) || 31, [dias, anio, mes]);
  const fila = useMemo(() => construirFilas({ cuentas, mensual, dias, anio, mes, corteDia, cuotas }).find((f) => f.cuenta === cuenta) || null, [cuentas, mensual, dias, anio, mes, corteDia, cuotas, cuenta]);

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
  return (
    <>
      <Panel titulo="Sell Out" meta={`${fila.nombre} · ${MESES[mes - 1].toLowerCase()} ${anio} · lo que desplaza y lo que tiene en su almacén · sin IVA`} padding="0">
        <DrillCuenta fila={fila} anio={anio} mes={mes} corteDia={corteDia} estadoSel={estadoSel} onEstado={setEstadoSel} />
      </Panel>
      <DetalleSkuSellOut cuenta={cuenta} anio={anio} mes={mes} conInventario={fila.invValor != null} />
    </>
  );
}

// Detalle por SKU del sell out (2026-10-01, Fernando: «que también tenga su detalle por SKU»): mismo formato que el de
// Sell In — SKU × últimos 12 meses en piezas o monto, buscador, descripción del roadmap, promedio, total, YoY (12 m vs
// los 12 anteriores) y, si la cuenta reporta inventario, stock y semanas. Datos: mv_sellout_cuenta_sku_mes (2 años).
function DetalleSkuSellOut({ cuenta, anio, mes, conInventario }) {
  const { theme } = useTheme();
  const skuQ = useDrillSkus(cuenta, anio);
  const invQ = useDrillInventario(cuenta, conInventario);
  const { data: roadmap } = useRoadmap();
  const [unidad, setUnidad] = useState('monto');
  const [busca, setBusca] = useState('');
  const [orden, setOrden] = useState({ col: 'total', dir: 'desc' });
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);
  const meses12 = useMemo(() => ultimosMeses(anio, mes, 12), [anio, mes]);

  const filas = useMemo(() => {
    const modo = unidad === 'piezas' ? 'piezas' : 'importe';
    const actual = skusDeCuenta(skuQ.data || [], invQ.data || [], anio, mes, modo);
    // YoY: los mismos 12 meses un año atrás.
    const prev = new Map(skusDeCuenta(skuQ.data || [], [], anio - 1, mes, modo).map((f) => [f.sku, f.total]));
    return actual.map((f) => ({ ...f, max: Math.max(0, ...f.meses), yoy: yoyDe(f.total, prev.get(f.sku) || 0), descripcion: rd.get(f.sku)?.descripcion || '' }));
  }, [skuQ.data, invQ.data, anio, mes, unidad, rd]);

  const visibles = useMemo(() => {
    const q = busca.trim().toUpperCase();
    const l = q ? filas.filter((f) => f.sku.includes(q) || f.descripcion.toUpperCase().includes(q) || String(f.marca || '').toUpperCase().includes(q)) : filas;
    const dir = orden.dir === 'asc' ? 1 : -1;
    return [...l].sort((a, b) => { const va = a[orden.col], vb = b[orden.col]; if (typeof va === 'string') return String(va).localeCompare(String(vb)) * dir; return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir; });
  }, [filas, busca, orden]);

  const fmtU = unidad === 'piezas' ? int : money;
  return (
    <Panel titulo="Detalle por SKU · Sell Out" meta={`${visibles.length} SKUs · últimos 12 meses · ${unidad === 'piezas' ? 'piezas' : 'importe sin IVA'}${conInventario ? ' · stock de la última foto' : ''}`}
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
      {skuQ.isLoading ? <Cargando pantalla="selloutDrill" minHeight={240} /> : (
        <TablaCompacta dense maxHeight={520} rowKey={(r) => r.sku} filas={visibles} orden={orden}
          onSort={(col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'sku' ? 'asc' : 'desc' }))}
          vacio="Sin SKUs con sell out en los últimos 12 meses."
          columnas={[
            { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100, sort: true },
            { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 240, render: (r) => <span style={{ color: theme.textMuted }} title={r.descripcion}>{r.descripcion || r.marca || '—'}</span> },
            ...meses12.map((m, i) => ({ key: `m${i}`, label: `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`, width: 50, render: (r) => <HeatCell v={r.meses[i]} max={r.max} fmt={fmtU} /> })),
            { key: 'prom', label: 'Prom', width: 60, sort: true, render: (r) => fmtU(r.prom) },
            { key: 'total', label: 'Total', width: 70, bold: true, sort: true, render: (r) => fmtU(r.total) },
            { key: 'yoy', label: 'YoY', width: 64, sort: true, render: (r) => <DeltaPill value={r.yoy} /> },
            ...(conInventario ? [
              { key: 'stock', label: 'Stock', width: 58, sort: true, render: (r) => (r.stock == null ? '—' : int(r.stock)) },
              { key: 'semanas', label: 'Sem.', width: 52, sort: true, render: (r) => (r.stock === 0 ? <Pill tone="orange" size="xs">0</Pill> : r.semanas == null ? '—' : r.semanas.toFixed(1)) },
            ] : []),
          ]} />
      )}
    </Panel>
  );
}
