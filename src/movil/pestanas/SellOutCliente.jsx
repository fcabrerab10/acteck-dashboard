// Sell Out del cliente propio (push) · SOLO consulta (sin sugerido ni compartir).
// Hero: sell-out del mes elegido, último mes cerrado, YoY y ratio sell-out / sell-in del mes; selector de mes;
// lista de SKUs del mes con piezas e inventario del cliente + buscador; tocar un SKU abre HeatmapSku
// (meses × piezas: ninguna fuente de sell-out por SKU trae sucursal/cliente final) y composición por categoría.
// Fuentes (mismas que HomeClienteV3 · home/config.js):
//   Digitalife → v_sellout_detalle_sku_mes (cliente='digitalife') + inventario_cliente (última semana)
//   Dicotech   → sellout_sku (cliente='dicotech', monto_pesos) + v_sellout_dicotech_mensual + inventario_cliente
//   PCEL       → sellout_pcel_mensual (sólo piezas) + v_sellout_pcel_mensual + sellout_pcel (inventario última semana)
//   Sell-in del mes (ratio) → v_fact_cliente_mes (useClientesMes).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Cabecera, Skeleton, HeatCell, Pill, Vacio, CampoBusqueda, HojaM } from '../piezas';
import HeatmapSku from '../piezas/HeatmapSku';
import { useClientesMes, useSelloutMensual } from '../datos';
import { money, moneyCompact, int, deltaPct, tonoDelta, MESES, N } from '../util';
import { SelectorMes, ComposicionCategorias, ultimosMeses, catalogoSkus, agruparCategorias } from './SellInCliente';
import FichaProducto from '../FichaProducto';

const STALE = 5 * 60 * 1000;
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
    const [rows, mapa] = await Promise.all([
      fetchAll('sellout_pcel_mensual', 'sku,anio,mes,piezas', (q) => q.in('anio', anios)),
      fetchAll('pcel_sku_map', 'sku_pcel,sku_acteck'),
    ]);
    const m = new Map(mapa.filter((r) => r.sku_pcel && r.sku_acteck).map((r) => [String(r.sku_pcel), String(r.sku_acteck)]));
    const aSku = (c) => m.get(String(c)) || String(c);
    return { conMonto: false, mapaPcel: aSku, rows: rows.map((r) => ({ sku: aSku(r.sku), anio: N(r.anio), mes: N(r.mes), piezas: N(r.piezas), monto: 0 })) };
  }
  const rows = await fetchAll('v_sellout_detalle_sku_mes', 'sku,marca,anio,mes,piezas,monto', (q) => q.eq('cliente', ck).in('anio', anios));
  return { conMonto: true, rows: rows.map((r) => ({ sku: r.sku, anio: N(r.anio), mes: N(r.mes), piezas: N(r.piezas), monto: N(r.monto) })) };
}

async function cargarInventario(ck, aSku = (c) => c) {
  if (ck === 'pcel') {
    const { data: ult } = await cachedQuery(supabase.from('sellout_pcel').select('anio,semana').not('anio', 'is', null).order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1));
    const u = ult?.[0]; if (!u) return { stock: new Map(), nombres: new Map(), semana: null };
    const rows = await fetchAll('sellout_pcel', 'sku,pcel_sku,producto,inventario', (q) => q.eq('anio', u.anio).eq('semana', u.semana));
    const stock = new Map(), nombres = new Map();
    rows.forEach((r) => { const k = aSku(r.pcel_sku || r.sku); stock.set(k, (stock.get(k) || 0) + N(r.inventario)); if (r.producto && !nombres.has(k)) nombres.set(k, r.producto); });
    return { stock, nombres, semana: `S${u.semana} ${u.anio}` };
  }
  const { data: ult } = await supabase.from('inventario_cliente').select('anio,semana').eq('cliente', ck).not('anio', 'is', null).order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1);
  const u = ult?.[0]; if (!u) return { stock: new Map(), semana: null };
  const rows = await fetchAll('inventario_cliente', 'sku,stock', (q) => q.eq('cliente', ck).eq('anio', u.anio).eq('semana', u.semana));
  return { stock: new Map(rows.map((r) => [r.sku, N(r.stock)])), semana: `S${u.semana} ${u.anio}` };
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
  const [q, setQ] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const [skuHeat, setSkuHeat] = useState(null);
  const { data, isLoading, error } = useSellOutCliente(clienteKey, anioActual);
  const { data: totales } = useSelloutMensual(clienteKey, anioActual);
  const { data: cli } = useClientesMes(anioActual);

  const r = useMemo(() => {
    if (!data) return null;
    const { anio: a, mes: m } = sel;
    const enCurso = a === anioActual && m === mesActual;
    const conMonto = data.conMonto;
    // Totales del mes: vista mensual del cliente si existe, si no Σ de la fuente por SKU
    const tot = (aa, mm) => {
      const v = (totales || []).filter((x) => N(x.anio) === aa && N(x.mes) === mm);
      if (v.length) return { monto: sum(v, (x) => x.monto), piezas: sum(v, (x) => x.piezas) };
      const f = data.rows.filter((x) => x.anio === aa && x.mes === mm);
      return { monto: sum(f, (x) => x.monto), piezas: sum(f, (x) => x.piezas) };
    };
    const mesSel = tot(a, m), mesPrev = tot(a - 1, m);
    // Dicotech carga piezas antes que el importe del mes en curso: si el mes tiene piezas sin importe, se mide en piezas.
    const usaMonto = conMonto && !(mesSel.monto === 0 && mesSel.piezas > 0);
    const medida = (x) => (usaMonto ? x.monto : x.piezas);
    const valor = usaMonto ? mesSel.monto : mesSel.piezas, valorPrev = usaMonto ? mesPrev.monto : mesPrev.piezas;
    const factor = enCurso ? Math.min(1, Math.max(1, hoy.getDate()) / new Date(a, m, 0).getDate()) : 1;
    const yoy = delta(valor, valorPrev * factor);
    // Último mes cerrado con datos (< mes actual del año en curso)
    let cerrado = null;
    const previos = ultimosMeses(anioActual, mesActual, 13).slice(0, 12).reverse(); // del mes anterior hacia atrás, 12 meses
    for (const p of previos) {
      const t = tot(p.anio, p.mes);
      if ((conMonto ? t.monto : t.piezas) > 0) { const tp = tot(p.anio - 1, p.mes); cerrado = { anio: p.anio, mes: p.mes, ...t, yoy: delta(conMonto ? t.monto : t.piezas, conMonto ? tp.monto : tp.piezas) }; break; }
    }
    // Sell-in del mes (v_fact_cliente_mes) → ratio
    const si = (cli?.fact || []).filter((x) => x.cliente_key === clienteKey && N(x.anio) === a && N(x.mes) === m);
    const siMonto = sum(si, (x) => x.monto), siPiezas = sum(si, (x) => x.piezas);
    const ratioBruto = usaMonto ? (siMonto > 0 ? (mesSel.monto / siMonto) * 100 : null) : (siPiezas > 0 ? (mesSel.piezas / siPiezas) * 100 : null);
    const ratio = ratioBruto != null && ratioBruto <= 999 ? ratioBruto : null; // sell-in casi nulo (p. ej. día 1-10) → sin ratio
    const siBajo = ratioBruto != null && ratioBruto > 999;
    // SKUs del mes
    const by = new Map();
    data.rows.filter((x) => x.anio === a && x.mes === m).forEach((x) => { if (!x.sku) return; const o = by.get(x.sku) || (by.set(x.sku, { sku: x.sku, monto: 0, piezas: 0, prev: 0 }), by.get(x.sku)); o.monto += x.monto; o.piezas += x.piezas; });
    data.rows.filter((x) => x.anio === a - 1 && x.mes === m).forEach((x) => { const o = by.get(x.sku); if (o) o.prev += medida(x); });
    const skus = [...by.values()].filter((o) => o.piezas > 0 || o.monto > 0).map((o) => ({ ...o, yoy: delta(medida(o), o.prev), stock: data.inv.stock.get(o.sku) ?? null, ...(data.cat.get(o.sku) || {}) })).sort((x, y) => medida(y) - medida(x) || y.piezas - x.piezas);
    const categorias = agruparCategorias(skus, medida);
    const disponibles = new Set(data.rows.filter((x) => x.piezas > 0).map((x) => `${x.anio}-${x.mes}`));
    const fmt = (v) => (usaMonto ? moneyCompact(v) : `${int(v)} pz`);
    const mesL = MESES[m - 1].toLowerCase();
    const frase = !valor ? `Sin sell-out cargado en ${mesL} ${a}`
      : enCurso ? `${MESES[m - 1]} lleva ${fmt(valor)} de sell-out${conMonto && !usaMonto ? ' (importe aún sin cargar)' : ''}${yoy != null ? `, ${deltaPct(yoy)} vs ${a - 1} a mismo día` : ''}`
      : `${MESES[m - 1]} ${a} cerró en ${fmt(valor)}${yoy != null ? `, ${deltaPct(yoy)} vs ${a - 1}` : ''}`;
    return { a, m, enCurso, conMonto: usaMonto, mesSel, valor, valorPrev, yoy, cerrado, siMonto, siPiezas, ratio, siBajo, skus, categorias, disponibles, frase, fmt, total: sum(skus, medida) };
  }, [data, totales, cli, sel, clienteKey, anioActual, mesActual, hoy]);

  const filtrados = useMemo(() => {
    if (!r) return [];
    const nq = norm(q.trim()); if (!nq) return r.skus;
    const terms = nq.split(/\s+/);
    return r.skus.filter((s) => { const t = norm(`${s.sku} ${s.descripcion} ${s.marca} ${s.categoria}`); return terms.every((w) => t.includes(w)); });
  }, [r, q]);
  const visibles = verTodo || q ? filtrados : filtrados.slice(0, 25);
  const maxPz = Math.max(0, ...visibles.map((o) => o.piezas));

  const heat = useMemo(() => {
    if (!skuHeat || !data) return null;
    const cols = ultimosMeses(sel.anio, sel.mes, 6);
    const idx = new Map(cols.map((c, i) => [`${c.anio}-${c.mes}`, i]));
    const valores = cols.map(() => 0);
    data.rows.forEach((x) => { if (x.sku !== skuHeat) return; const i = idx.get(`${x.anio}-${x.mes}`); if (i != null) valores[i] += x.piezas; });
    const stock = data.inv.stock.get(skuHeat);
    return { cols: cols.map((c) => c.label), filas: [{ label: 'Sell-out', sub: stock != null ? `inventario ${int(stock)} pz` : undefined, valores }], info: data.cat.get(skuHeat) || {} };
  }, [skuHeat, data, sel]);

  const abrirFicha = (sku) => { nav.agregarSku(sku); setSkuHeat(null); nav.push(<FichaProducto />, 'ficha'); };
  const sub = r ? `${nombre} · ${r.conMonto ? money(r.total) : `${int(r.total)} pz`} en ${r.skus.length} SKUs` : nombre;

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta={nombre} />
      <TituloGrande titulo="Sell Out" sub={sub} derecha={<SelectorMes valor={sel} onChange={(v) => { setSel(v); setVerTodo(false); }} anioActual={anioActual} mesActual={mesActual} disponibles={r?.disponibles} />} />
      {error && <Vacio titulo="No se pudo cargar el sell out" sub={error.message} color={theme.red} />}
      {(isLoading || !r) && !error && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={84} r={12} /><Skeleton h={320} r={12} /></div>}
      {r && (
        <>
          <HeroM eyebrow={`Sell Out · ${MESES[r.m - 1]} ${r.a}${r.enCurso ? ' · en curso' : ''}`} frase={r.frase}
            sub={`${r.conMonto ? `${money(r.mesSel.monto)} · ` : ''}${int(r.mesSel.piezas)} pz${r.siMonto > 0 || r.siPiezas > 0 ? ` · sell-in del mes ${r.conMonto ? moneyCompact(r.siMonto) : `${int(r.siPiezas)} pz`}` : ''}`}
            stats={[
              { k: r.enCurso ? 'MTD' : 'Mes', v: r.fmt(r.valor), sub: r.yoy != null ? `${deltaPct(r.yoy)} YoY` : undefined, color: undefined },
              { k: r.cerrado ? `Cierre ${MESES[r.cerrado.mes - 1]}` : 'Último cerrado', v: r.cerrado ? r.fmt(r.conMonto ? r.cerrado.monto : r.cerrado.piezas) : '—', sub: r.cerrado?.yoy != null ? `${deltaPct(r.cerrado.yoy)} YoY` : r.cerrado ? 'sin comparativo' : 'sin mes cerrado' },
              { k: 'SO / SI', v: r.ratio != null ? `${Math.round(r.ratio)}%` : '—', sub: r.ratio == null ? (r.siBajo ? 'sell-in aún bajo' : 'sin sell-in') : r.conMonto ? 'del monto' : 'de las piezas', color: r.ratio == null ? undefined : r.ratio >= 100 ? theme.green : r.ratio >= 70 ? undefined : theme.orange },
            ]} />

          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow={`vs ${r.a - 1}`} big={r.yoy != null ? deltaPct(r.yoy, 1) : '—'} bigColor={r.yoy == null ? undefined : r.yoy >= 0 ? theme.green : theme.red} sub={`${r.fmt(r.valorPrev)} en ${MESES[r.m - 1]} ${r.a - 1}${r.enCurso ? ' · mes completo' : ''}`} />
            <KpiM eyebrow="Inventario del cliente" big={data.inv.stock.size ? `${int([...data.inv.stock.values()].reduce((s, v) => s + v, 0))} pz` : '—'} sub={data.inv.semana ? `${data.inv.stock.size} SKUs · ${data.inv.semana}` : 'sin inventario cargado'} />
          </KpiGrid>

          <div style={{ padding: '18px 16px 8px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="Buscar SKU o producto del mes" /></div>
          <ListaAgrupada titulo={`SKUs · ${MESES[r.m - 1]}`} meta={q ? `${filtrados.length} de ${r.skus.length}` : `${r.skus.length}`} pie={`Celda = piezas vendidas en el mes (intensidad relativa al SKU líder) · "inv." = inventario del cliente en la última semana cargada${r.conMonto ? ' · pill = monto vs mismo mes del año anterior' : ' · pill = piezas vs año anterior'}. Toca un SKU para ver sus últimos 6 meses.`}>
            {visibles.length === 0 && <Vacio icon={null} titulo={q ? 'Sin coincidencias' : 'Sin sell-out este mes'} sub={q ? undefined : 'Todavía no hay sell-out cargado para este mes.'} />}
            {visibles.map((o, i) => (
              <button key={o.sku} type="button" onClick={() => setSkuHeat(o.sku)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 20, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{r.conMonto ? money(o.monto) : ''}</span></span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descripcion || 'Sin descripción'}</span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <HeatCell v={o.piezas} max={maxPz} />
                  <span style={{ display: 'block', fontSize: 10.5, color: o.stock === 0 ? theme.red : theme.textMuted, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>{o.stock != null ? `${int(o.stock)} inv.` : 'sin inv.'}</span>
                </span>
                <Pill tone={tonoDelta(o.yoy)} size="xs" style={{ minWidth: 48, justifyContent: 'center' }}>{o.yoy != null ? deltaPct(o.yoy) : 'nuevo'}</Pill>
              </button>
            ))}
            {!verTodo && !q && filtrados.length > 25 && (
              <button type="button" onClick={() => setVerTodo(true)} style={{ width: '100%', height: 44, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Ver los {filtrados.length} SKUs</button>
            )}
          </ListaAgrupada>

          <ComposicionCategorias filas={r.categorias} total={r.total} unidad={r.conMonto ? 'monto' : 'piezas'} pie={`Categoría del roadmap · % ${r.conMonto ? 'del monto' : 'de las piezas'} de sell-out del mes.`} />
        </>
      )}

      <HojaM abierto={!!skuHeat} onClose={() => setSkuHeat(null)} titulo="Sell-out por mes" sub={`${nombre} · últimos 6 meses a ${MESES[sel.mes - 1]} ${sel.anio}`} alto="70vh">
        {heat && <HeatmapSku sku={skuHeat} nombre={heat.info.descripcion} marca={heat.info.marca} columnas={heat.cols} filas={heat.filas} onDisponibilidad={() => abrirFicha(skuHeat)}
          pie="La fuente de sell-out por SKU de este cliente no trae sucursal ni cliente final: se muestran las piezas por mes." />}
      </HojaM>
    </>
  );
}
