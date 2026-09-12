// Sell Out del cliente propio (push) · SOLO consulta (sin sugerido ni compartir).
// Toggle Monto · Piezas (Monto por defecto) que manda en TODA la pantalla: hero, KPIs, lista de SKUs,
// composición por categoría y ficha del SKU. Hero: sell-out del mes elegido, último mes cerrado, YoY y
// ratio sell-out / sell-in del mes; selector de mes; lista de SKUs del mes con inventario del cliente +
// buscador; tocar un SKU abre la ficha (año mes a mes con Prom/Total + inventario del cliente).
// Fuentes (mismas que HomeClienteV3 · home/config.js):
//   Digitalife → v_sellout_detalle_sku_mes (cliente='digitalife') + inventario_cliente (última semana)
//   Dicotech   → sellout_sku (cliente='dicotech', monto_pesos) + v_sellout_dicotech_mensual + inventario_cliente
//   PCEL       → sellout_pcel_mensual (sólo piezas) + sellout_pcel (inventario última semana)
//   Sell-in del mes (ratio) → v_fact_cliente_mes (useClientesMes).
// PCEL no reporta importe: su monto se valúa a precio de lista "PCEL PROVISIONAL" vigente (respaldo
// "Mayoreo AAA"), la misma cascada de v_sellout_unificado; el hero lo avisa con la pill "valuado a lista".
// Valor del inventario del cliente: se muestra siempre (es inventario del cliente, no de Acteck).
// Lo que la fuente del cliente NO trae, NO se pinta: `campos` (disponibilidadDeCampos) decide
// qué KPIs existen. Hoy Dicotech no manda dias_sin_venta ni precio_venta, y PCEL no manda
// ni días sin venta ni fecha de última venta.
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Cabecera, Skeleton, HeatCell, Pill, Vacio, CampoBusqueda, Segmented } from '../piezas';
import { useClientesMes, useSelloutMensual } from '../datos';
import { money, moneyCompact, int, deltaPct, tonoDelta, MESES, N, disponibilidadDeCampos } from '../util';
import { SelectorMes, ComposicionCategorias, ultimosMeses, catalogoSkus, agruparCategorias } from './SellInCliente';
import FichaSkuSellOut from './sellout/FichaSkuSellOut';
import { preciosPcel } from './sellout/datos';

const STALE = 5 * 60 * 1000;
const UNIDADES = [{ id: 'monto', label: 'Monto' }, { id: 'piezas', label: 'Piezas' }];
const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// ── Sell-out por SKU (2 años) + inventario del cliente (última semana) → forma canónica
async function cargarSellOutSku(ck, anios) {
  if (ck === 'dicotech') {
    const rows = await fetchAll('sellout_sku', 'sku,anio,mes,piezas,monto_pesos', (q) => q.eq('cliente', ck).in('anio', anios));
    return { conMonto: true, rows: rows.map((r) => ({ sku: r.sku, anio: N(r.anio), mes: N(r.mes), piezas: N(r.piezas), monto: N(r.monto_pesos) })) };
  }
  if (ck === 'pcel') {
    // sellout_pcel_mensual trae el código PCEL (506901…): se traduce a SKU Acteck con pcel_sku_map; sin mapa se deja el código.
    // PCEL no manda importe: se valúa piezas × precio de lista vigente (PCEL PROVISIONAL → Mayoreo AAA).
    const [rows, mapa, precios] = await Promise.all([
      fetchAll('sellout_pcel_mensual', 'sku,anio,mes,piezas', (q) => q.in('anio', anios)),
      fetchAll('pcel_sku_map', 'sku_pcel,sku_acteck'),
      preciosPcel(),
    ]);
    const m = new Map(), inverso = new Map();
    mapa.filter((r) => r.sku_pcel && r.sku_acteck).forEach((r) => {
      m.set(String(r.sku_pcel), String(r.sku_acteck));
      const lista = inverso.get(String(r.sku_acteck)) || (inverso.set(String(r.sku_acteck), []), inverso.get(String(r.sku_acteck)));
      lista.push(String(r.sku_pcel));
    });
    const aSku = (c) => m.get(String(c)) || String(c);
    let conPrecio = 0, sinPrecio = 0;
    const canon = rows.map((r) => {
      const sku = aSku(r.sku), pz = N(r.piezas), p = precios.get(sku);
      if (pz > 0) { if (p) conPrecio += pz; else sinPrecio += pz; }
      return { sku, anio: N(r.anio), mes: N(r.mes), piezas: pz, monto: pz * N(p?.precio) };
    });
    return { conMonto: true, valuadoALista: true, mapaPcel: aSku, inversoPcel: inverso, precios, cobertura: { conPrecio, sinPrecio }, rows: canon };
  }
  const rows = await fetchAll('v_sellout_detalle_sku_mes', 'sku,marca,anio,mes,piezas,monto', (q) => q.eq('cliente', ck).in('anio', anios));
  return { conMonto: true, rows: rows.map((r) => ({ sku: r.sku, anio: N(r.anio), mes: N(r.mes), piezas: N(r.piezas), monto: N(r.monto) })) };
}

// Foto de inventario del cliente en la última semana cargada.
// det: sku → { stock, valor, costo, precioVenta, dias, semana }.
// `campos` dice qué trae realmente la fuente de ESTE cliente: lo que no viene, no se pinta.
const CAMPOS_INV = ['valor', 'costo_convenio', 'precio_venta', 'dias_sin_venta', 'fecha_ultima_venta'];

async function cargarInventario(ck, aSku = (c) => c) {
  const sinCampos = Object.fromEntries(CAMPOS_INV.map((c) => [c, false]));
  const vacio = { stock: new Map(), det: new Map(), nombres: new Map(), semana: null, totalPz: 0, totalValor: 0, skus: 0, sinVenta30: 0, campos: sinCampos };
  if (ck === 'pcel') {
    const { data: ult } = await cachedQuery(supabase.from('sellout_pcel').select('anio,semana').not('anio', 'is', null).order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1));
    const u = ult?.[0]; if (!u) return vacio;
    const rows = await fetchAll('sellout_pcel', 'sku,pcel_sku,producto,inventario,costo_promedio,vta_mes_actual,vta_mes_1', (q) => q.eq('anio', u.anio).eq('semana', u.semana));
    // sellout_pcel no trae días sin venta, fecha de última venta ni precio de venta del cliente.
    const dispo = disponibilidadDeCampos(ck, rows, ['inventario', 'costo_promedio'], { soloUltimaSemana: false });
    const stock = new Map(), det = new Map(), nombres = new Map();
    rows.forEach((r) => {
      const k = aSku(r.pcel_sku || r.sku), pz = N(r.inventario);
      stock.set(k, (stock.get(k) || 0) + pz);
      const o = det.get(k) || (det.set(k, { stock: 0, valor: 0, costo: N(r.costo_promedio), precioVenta: null, dias: null, semana: `S${u.semana} ${u.anio}` }), det.get(k));
      o.stock += pz; o.valor += pz * N(r.costo_promedio);
      if (r.producto && !nombres.has(k)) nombres.set(k, r.producto);
    });
    const lista = [...det.values()];
    return {
      stock, det, nombres, semana: `S${u.semana} ${u.anio}`,
      totalPz: lista.reduce((s, o) => s + o.stock, 0), totalValor: lista.reduce((s, o) => s + o.valor, 0),
      skus: lista.filter((o) => o.stock > 0).length,
      sinVenta30: 0,
      campos: { ...sinCampos, valor: dispo.hay('inventario') && dispo.hay('costo_promedio'), costo_convenio: dispo.hay('costo_promedio') },
    };
  }
  const { data: ult } = await supabase.from('inventario_cliente').select('anio,semana').eq('cliente', ck).not('anio', 'is', null).order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1);
  const u = ult?.[0]; if (!u) return vacio;
  const rows = await fetchAll('inventario_cliente', 'sku,stock,valor,costo_convenio,precio_venta,dias_sin_venta', (q) => q.eq('cliente', ck).eq('anio', u.anio).eq('semana', u.semana));
  const semana = `S${u.semana} ${u.anio}`;
  const dispo = disponibilidadDeCampos(ck, rows, CAMPOS_INV, { soloUltimaSemana: false });
  const stock = new Map(), det = new Map();
  rows.forEach((r) => {
    const pz = N(r.stock);
    // `valor` viene vacío en algunos clientes (digitalife): se reconstruye con stock × costo convenio.
    const valor = r.valor != null ? N(r.valor) : pz * N(r.costo_convenio);
    stock.set(r.sku, (stock.get(r.sku) || 0) + pz);
    det.set(r.sku, { stock: pz, valor, costo: N(r.costo_convenio), precioVenta: N(r.precio_venta), dias: r.dias_sin_venta == null ? null : N(r.dias_sin_venta), semana });
  });
  const lista = [...det.values()];
  return {
    stock, det, nombres: new Map(), semana,
    totalPz: lista.reduce((s, o) => s + o.stock, 0), totalValor: lista.reduce((s, o) => s + o.valor, 0),
    skus: lista.filter((o) => o.stock > 0).length,
    sinVenta30: lista.filter((o) => o.stock > 0 && o.dias != null && o.dias >= 30).length,
    // `valor` viene vacío en Digitalife pero se reconstruye con costo_convenio: cuenta como disponible.
    campos: { ...dispo.campos, valor: dispo.hay('valor') || dispo.hay('costo_convenio') },
  };
}

function useSellOutCliente(ck, anio) {
  return useQuery({
    queryKey: ['movil', 'sellout-cliente', ck, anio], staleTime: STALE, enabled: !!ck,
    queryFn: async () => {
      const so = await cargarSellOutSku(ck, [anio - 1, anio]);
      const [inv, cat] = await Promise.all([cargarInventario(ck, so.mapaPcel), catalogoSkus(so.rows.map((r) => r.sku))]);
      // PCEL: los códigos sin mapa toman el nombre del producto de sellout_pcel
      (inv.nombres || new Map()).forEach((nombre, sku) => { if (!cat.has(sku)) cat.set(sku, { descripcion: nombre, marca: '', categoria: '', familia: '' }); });
      return { ...so, inv, cat };
    },
  });
}

export default function SellOutCliente({ clienteKey, nombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioActual = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const [sel, setSel] = useState({ anio: anioActual, mes: mesActual });
  const [unidad, setUnidad] = useState('monto');
  const [q, setQ] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const { data, isLoading, error } = useSellOutCliente(clienteKey, anioActual);
  const { data: totales } = useSelloutMensual(clienteKey, anioActual);
  const { data: cli } = useClientesMes(anioActual);
  const esPcel = clienteKey === 'pcel';
  const usaMonto = unidad === 'monto';

  const r = useMemo(() => {
    if (!data) return null;
    const { anio: a, mes: m } = sel;
    const enCurso = a === anioActual && m === mesActual;
    // Totales del mes: vista mensual del cliente si existe, si no Σ de la fuente por SKU.
    // PCEL siempre desde las filas: la vista mensual valúa a costo promedio, aquí se valúa a lista.
    const tot = (aa, mm) => {
      const f = data.rows.filter((x) => x.anio === aa && x.mes === mm);
      const propio = { monto: sum(f, (x) => x.monto), piezas: sum(f, (x) => x.piezas) };
      if (esPcel) return propio;
      const v = (totales || []).filter((x) => N(x.anio) === aa && N(x.mes) === mm);
      if (v.length) return { monto: sum(v, (x) => x.monto), piezas: sum(v, (x) => x.piezas) };
      return propio;
    };
    const mesSel = tot(a, m), mesPrev = tot(a - 1, m);
    const medida = (x) => (usaMonto ? N(x.monto) : N(x.piezas));
    // Dicotech carga piezas antes que el importe del mes en curso: hay piezas y el monto sigue en 0.
    const montoPendiente = usaMonto && mesSel.monto === 0 && mesSel.piezas > 0;
    const valor = usaMonto ? mesSel.monto : mesSel.piezas, valorPrev = usaMonto ? mesPrev.monto : mesPrev.piezas;
    const factor = enCurso ? Math.min(1, Math.max(1, hoy.getDate()) / new Date(a, m, 0).getDate()) : 1;
    const yoy = delta(valor, valorPrev * factor);
    // Último mes cerrado con datos (< mes actual del año en curso)
    let cerrado = null;
    const previos = ultimosMeses(anioActual, mesActual, 13).slice(0, 12).reverse(); // del mes anterior hacia atrás, 12 meses
    for (const p of previos) {
      const t = tot(p.anio, p.mes);
      const v = usaMonto ? t.monto : t.piezas;
      if (v > 0) { const tp = tot(p.anio - 1, p.mes); cerrado = { anio: p.anio, mes: p.mes, ...t, valor: v, yoy: delta(v, usaMonto ? tp.monto : tp.piezas) }; break; }
    }
    // Sell-in del mes (v_fact_cliente_mes) → ratio
    const si = (cli?.fact || []).filter((x) => x.cliente_key === clienteKey && N(x.anio) === a && N(x.mes) === m);
    const siMonto = sum(si, (x) => x.monto), siPiezas = sum(si, (x) => x.piezas);
    const siValor = usaMonto ? siMonto : siPiezas;
    const ratioBruto = siValor > 0 ? (valor / siValor) * 100 : null;
    const ratio = ratioBruto != null && ratioBruto <= 999 ? ratioBruto : null; // sell-in casi nulo (p. ej. día 1-10) → sin ratio
    const siBajo = ratioBruto != null && ratioBruto > 999;
    // SKUs del mes
    const by = new Map();
    data.rows.filter((x) => x.anio === a && x.mes === m).forEach((x) => { if (!x.sku) return; const o = by.get(x.sku) || (by.set(x.sku, { sku: x.sku, monto: 0, piezas: 0, prev: 0 }), by.get(x.sku)); o.monto += x.monto; o.piezas += x.piezas; });
    data.rows.filter((x) => x.anio === a - 1 && x.mes === m).forEach((x) => { const o = by.get(x.sku); if (o) o.prev += medida(x); });
    const skus = [...by.values()].filter((o) => o.piezas > 0 || o.monto > 0)
      .map((o) => ({ ...o, valor: medida(o), yoy: delta(medida(o), o.prev), stock: data.inv.stock.get(o.sku) ?? null, ...(data.cat.get(o.sku) || {}) }))
      .sort((x, y) => y.valor - x.valor || y.piezas - x.piezas);
    const categorias = agruparCategorias(skus, medida);
    const disponibles = new Set(data.rows.filter((x) => x.piezas > 0).map((x) => `${x.anio}-${x.mes}`));
    const fmt = (v) => (usaMonto ? moneyCompact(v) : `${int(v)} pz`);
    const mesL = MESES[m - 1].toLowerCase();
    const frase = !valor ? (montoPendiente ? `${MESES[m - 1]} ${a} lleva ${int(mesSel.piezas)} pz; el importe aún no se carga` : `Sin sell-out cargado en ${mesL} ${a}`)
      : enCurso ? `${MESES[m - 1]} lleva ${fmt(valor)} de sell-out${yoy != null ? `, ${deltaPct(yoy)} vs ${a - 1} a mismo día` : ''}`
      : `${MESES[m - 1]} ${a} cerró en ${fmt(valor)}${yoy != null ? `, ${deltaPct(yoy)} vs ${a - 1}` : ''}`;
    return { a, m, enCurso, mesSel, valor, valorPrev, yoy, cerrado, siMonto, siPiezas, ratio, siBajo, montoPendiente, skus, categorias, disponibles, frase, fmt, total: sum(skus, (x) => x.valor) };
  }, [data, totales, cli, sel, unidad, usaMonto, esPcel, clienteKey, anioActual, mesActual, hoy]);

  const filtrados = useMemo(() => {
    if (!r) return [];
    const nq = norm(q.trim()); if (!nq) return r.skus;
    const terms = nq.split(/\s+/);
    return r.skus.filter((s) => { const t = norm(`${s.sku} ${s.descripcion} ${s.marca} ${s.categoria}`); return terms.every((w) => t.includes(w)); });
  }, [r, q]);
  const visibles = verTodo || q ? filtrados : filtrados.slice(0, 25);
  const maxCelda = Math.max(0, ...visibles.map((o) => o.valor));

  const abrirSku = (sku) => {
    const filas = data.rows.filter((x) => x.sku === sku).map((x) => ({ anio: x.anio, mes: x.mes, piezas: x.piezas, monto: x.monto }));
    const det = data.inv.det?.get(sku) || null;
    nav.push(
      <FichaSkuSellOut sku={sku} info={data.cat.get(sku) || {}} clienteKey={clienteKey} nombre={nombre} filas={filas} inv={det} campos={data.inv?.campos || {}}
        codigosPcel={data.inversoPcel?.get(sku) || null} unidadInicial={unidad} valuadoALista={!!data.valuadoALista} />,
      `sellout-sku-${sku}`,
    );
  };

  const inv = data?.inv;
  // Campos que la fuente de ESTE cliente trae realmente: lo que falta, no se pinta.
  const campos = inv?.campos || {};
  const sub = r ? `${nombre} · ${r.fmt(r.total)} en ${r.skus.length} SKUs` : nombre;

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta={nombre} derecha={<Segmented value={unidad} onChange={setUnidad} options={UNIDADES} />} />
      <TituloGrande titulo="Sell Out" sub={sub} derecha={<SelectorMes valor={sel} onChange={(v) => { setSel(v); setVerTodo(false); }} anioActual={anioActual} mesActual={mesActual} disponibles={r?.disponibles} />} />
      {error && <Vacio titulo="No se pudo cargar el sell out" sub={error.message} color={theme.red} />}
      {(isLoading || !r) && !error && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={84} r={12} /><Skeleton h={320} r={12} /></div>}
      {r && (
        <>
          <HeroM eyebrow={`Sell Out · ${MESES[r.m - 1]} ${r.a}${r.enCurso ? ' · en curso' : ''}`} frase={r.frase}
            sub={`${money(r.mesSel.monto)} · ${int(r.mesSel.piezas)} pz${r.siMonto > 0 || r.siPiezas > 0 ? ` · sell-in del mes ${usaMonto ? moneyCompact(r.siMonto) : `${int(r.siPiezas)} pz`}` : ''}`}
            stats={[
              { k: r.enCurso ? 'MTD' : 'Mes', v: r.fmt(r.valor), sub: r.yoy != null ? `${deltaPct(r.yoy)} YoY` : undefined },
              { k: r.cerrado ? `Cierre ${MESES[r.cerrado.mes - 1]}` : 'Último cerrado', v: r.cerrado ? r.fmt(r.cerrado.valor) : '—', sub: r.cerrado?.yoy != null ? `${deltaPct(r.cerrado.yoy)} YoY` : r.cerrado ? 'sin comparativo' : 'sin mes cerrado' },
              { k: 'SO / SI', v: r.ratio != null ? `${Math.round(r.ratio)}%` : '—', sub: r.ratio == null ? (r.siBajo ? 'sell-in aún bajo' : 'sin sell-in') : usaMonto ? 'del monto' : 'de las piezas', color: r.ratio == null ? undefined : r.ratio >= 100 ? theme.green : r.ratio >= 70 ? undefined : theme.orange },
            ]}>
            {(data.valuadoALista || r.montoPendiente) && usaMonto && (
              <div style={{ marginTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {data.valuadoALista && <Pill tone="orange" size="xs">valuado a lista</Pill>}
                {r.montoPendiente && <Pill tone="gray" size="xs">importe del mes aún sin cargar</Pill>}
              </div>
            )}
          </HeroM>

          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow={`vs ${r.a - 1}`} big={r.yoy != null ? deltaPct(r.yoy, 1) : '—'} bigColor={r.yoy == null ? undefined : r.yoy >= 0 ? theme.green : theme.red} sub={`${r.fmt(r.valorPrev)} en ${MESES[r.m - 1]} ${r.a - 1}${r.enCurso ? ' · mes completo' : ''}`} />
            <KpiM eyebrow="Inventario del cliente" big={inv.totalPz ? `${int(inv.totalPz)} pz` : '—'} sub={inv.semana ? `${inv.skus} SKUs con stock · ${inv.semana}` : 'sin inventario cargado'} />
            {/* El valor del inventario del cliente se muestra siempre; sólo se omite si su fuente no trae con qué valuarlo. */}
            {campos.valor && (
              <KpiM eyebrow="Valor del inventario" big={inv.totalValor > 0 ? money(inv.totalValor) : '—'}
                sub={`${esPcel ? 'a costo promedio' : 'a costo convenio'} · ${inv.semana || 'sin semana'}`} />
            )}
            {/* Dicotech y PCEL no mandan días sin venta: el KPI no existe para ellos. */}
            {campos.dias_sin_venta && (
              <KpiM eyebrow="Sin venta 30+ días" big={inv.semana ? int(inv.sinVenta30) : '—'}
                bigColor={inv.sinVenta30 > 0 ? theme.orange : undefined}
                sub={!inv.semana ? 'sin inventario cargado' : inv.skus ? `de ${inv.skus} SKUs con stock (${Math.round((inv.sinVenta30 / Math.max(1, inv.skus)) * 100)}%)` : 'sin SKUs con stock'} />
            )}
          </KpiGrid>

          <div style={{ padding: '18px 16px 8px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="Buscar SKU o producto del mes" /></div>
          <ListaAgrupada titulo={`SKUs · ${MESES[r.m - 1]}`} meta={q ? `${filtrados.length} de ${r.skus.length}` : `${r.skus.length}`} pie={`Celda = ${usaMonto ? 'monto' : 'piezas'} del mes (intensidad relativa al SKU líder) · "inv." = inventario del cliente en la última semana cargada · pill = ${usaMonto ? 'monto' : 'piezas'} vs mismo mes del año anterior. Toca un SKU para ver su año mes a mes y su inventario.`}>
            {visibles.length === 0 && <Vacio icon={null} titulo={q ? 'Sin coincidencias' : 'Sin sell-out este mes'} sub={q ? undefined : 'Todavía no hay sell-out cargado para este mes.'} />}
            {visibles.map((o, i) => (
              <button key={o.sku} type="button" onClick={() => abrirSku(o.sku)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 20, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{usaMonto ? `${int(o.piezas)} pz` : money(o.monto)}</span></span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descripcion || 'Sin descripción'}</span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <HeatCell v={o.valor} max={maxCelda} fmt={usaMonto ? moneyCompact : (n) => Math.round(n).toLocaleString('es-MX')} />
                  <span style={{ display: 'block', fontSize: 10.5, color: o.stock === 0 ? theme.red : theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{o.stock != null ? `${int(o.stock)} inv.` : 'sin inv.'}</span>
                </span>
                <Pill tone={tonoDelta(o.yoy)} size="xs" style={{ minWidth: 48, justifyContent: 'center' }}>{o.yoy != null ? deltaPct(o.yoy) : 'nuevo'}</Pill>
              </button>
            ))}
            {!verTodo && !q && filtrados.length > 25 && (
              <button type="button" onClick={() => setVerTodo(true)} style={{ width: '100%', height: 44, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Ver los {filtrados.length} SKUs</button>
            )}
          </ListaAgrupada>

          <ComposicionCategorias filas={r.categorias} total={r.total} unidad={usaMonto ? 'monto' : 'piezas'} pie={`Categoría del roadmap · % ${usaMonto ? 'del monto' : 'de las piezas'} de sell-out del mes.${data.valuadoALista ? ' PCEL valuado a precio de lista.' : ''}`} />
        </>
      )}
    </>
  );
}
