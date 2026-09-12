// Sell In consolidado de la empresa en el celular (página global `sellIn`, clienteKey == null).
//
//   1. Hero del mes: MTD vs cuota total (Σ cuotas_mensuales.cuota_ideal) con barra y marca del ritmo del día,
//      YTD con YoY, selector de mes (año en curso y anterior) y toggle "Todos los canales / Clientes clave".
//   2. Por canal: monto del mes, % de cuota del canal (cuotas_canales) o YoY, y mini tendencia de 6 meses.
//      Tocar un canal filtra el resto de la pantalla; "Todos" lo quita.
//   3. Buscar un producto (sku, descripción, marca, categoría; sin acentos) → ficha del SKU.
//   4. Composición del mes por Categoría · Marca (toggle monto · piezas).
//   5. Top 10 SKUs del mes con YoY.
//   6. "Compartir resumen del mes por canal" (textoResumenMesCanal, el mismo texto de la web).
//
// Datos: src/movil/pestanas/sellin/datos.js (sólo año en curso y anterior; el mes elegido filtra en memoria)
// + useRoadmap() para marca/categoría/roadmap. NADA sensible: ni margen, ni costo, ni contribución.
import React, { useMemo, useState } from 'react';
import { Share2, Copy, AlertTriangle, Package } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { Cargando } from '../../../components/kit';
import FrescuraPill from '../../../components/FrescuraPill';
import { textoResumenMesCanal, compartir, copiar } from '../../../lib/whatsapp';
import { normalizar, tokens, coincide, canalLabel } from '../../../modules/comercial/sellin/textos';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, HeatCell, Pill, Vacio, CampoBusqueda, HojaM, BotonGrande, Segmented, TituloSeccionM, toast } from '../../piezas';
import { money, moneyCompact, int, deltaPct, tonoDelta, tonoCuota, MESES, MESES_LARGO, MONO, N } from '../../util';
import { SelectorMes, ComposicionCategorias, ultimosMeses } from '../SellInCliente';
import { BarraMes, Sparkline } from './piezas';
import { useSellInGlobal } from './datos';
import FichaSku from './FichaSku';

const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const canalDe = (r) => String(r.canal || 'otros').toUpperCase();
const DIMENSIONES = [{ id: 'categoria', label: 'Categoría' }, { id: 'marca', label: 'Marca' }];
const UNIDADES = [{ id: 'monto', label: 'Monto' }, { id: 'piezas', label: 'Piezas' }];

/** Agrupa los SKUs del mes por `campo` del roadmap → [{ label, valor, skus }] ordenado por valor. */
function agrupar(skus, campo, medida) {
  const map = new Map();
  skus.forEach((s) => {
    const raw = String(s[campo] || '').trim() || (campo === 'marca' ? 'Sin marca' : 'Sin categoría');
    const k = raw.toLowerCase();
    const o = map.get(k) || (map.set(k, { label: raw, valor: 0, skus: 0 }), map.get(k));
    o.valor += N(medida(s)); o.skus++;
  });
  return [...map.values()].filter((o) => o.valor > 0).sort((a, b) => b.valor - a.valor);
}

export default function SellInGlobal() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioActual = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;

  const [sel, setSel] = useState({ anio: anioActual, mes: mesActual });
  const [soloClave, setSoloClave] = useState(false);
  const [canalSel, setCanalSel] = useState(null);
  const [q, setQ] = useState('');
  const [dimension, setDimension] = useState('categoria');
  const [unidad, setUnidad] = useState('monto');
  const [compartiendo, setCompartiendo] = useState(false);

  const { data, isLoading, error } = useSellInGlobal(anioActual);
  const { data: roadmap = [] } = useRoadmap();
  const catalogo = useMemo(() => new Map(roadmap.map((r) => [r.sku, r])), [roadmap]);

  // ── Cuota total del mes: cuotas_canales TOTAL/12 si existe; si no, Σ cuotas_mensuales.cuota_ideal ──
  const cuotas = useMemo(() => {
    const porMes = new Map();
    (data?.cuotaMensual || []).forEach((c) => porMes.set(`${N(c.anio)}-${N(c.mes)}`, N(c.cuota_ideal)));
    const total = (data?.cuotaCanales || []).find((c) => /total/i.test(c.dimension_tipo || '') || /total/i.test(c.dimension_valor || ''));
    const porCanal = new Map();
    (data?.cuotaCanales || []).forEach((c) => { if (/canal/i.test(c.dimension_tipo || '') && c.dimension_valor) porCanal.set(String(c.dimension_valor).toUpperCase(), N(c.meta_facturacion) / 12); });
    const mes = (a, m) => (total && a === anioActual ? N(total.meta_facturacion) / 12 : porMes.get(`${a}-${m}`) || 0);
    return { mes, porCanal, fuente: total ? 'cuotas_canales' : 'cuotas_mensuales' };
  }, [data, anioActual]);

  const meses6 = useMemo(() => ultimosMeses(sel.anio, sel.mes, 6), [sel]);

  const r = useMemo(() => {
    if (!data) return null;
    const { anio: a, mes: m } = sel;
    const enCurso = a === anioActual && m === mesActual;
    const idx6 = new Map(meses6.map((c, i) => [`${c.anio}-${c.mes}`, i]));

    // ── Un solo recorrido: totales del mes, YTD, canales (serie 6 m) y SKUs del mes ──
    let mtd = 0, piezas = 0, prev = 0, ytd = 0, ytdPrev = 0;
    const canales = new Map();          // canal → { monto, prev, serie[6] }
    const bySku = new Map();            // sku → { monto, piezas, prev }
    const disponibles = new Set();
    const skusAnio = new Set();

    for (const row of data.rows) {
      const ra = N(row.anio), rm = N(row.mes), mo = N(row.monto), pz = N(row.piezas);
      if (soloClave && !row.es_clave) continue;
      if (mo > 0) disponibles.add(`${ra}-${rm}`);
      const ck = canalDe(row);

      // Canales: siempre con todos (el filtro de canal no debe vaciar su propia lista)
      const c = canales.get(ck) || (canales.set(ck, { canal: ck, monto: 0, prev: 0, serie: meses6.map(() => 0) }), canales.get(ck));
      if (ra === a && rm === m) c.monto += mo;
      if (ra === a - 1 && rm === m) c.prev += mo;
      const i6 = idx6.get(`${ra}-${rm}`);
      if (i6 != null) c.serie[i6] += mo;

      if (canalSel && ck !== canalSel) continue;
      if (ra === a && rm <= m) ytd += mo;
      if (ra === a - 1 && rm <= m) ytdPrev += mo;
      if (ra === a && pz > 0) skusAnio.add(row.sku);
      if ((ra === a || ra === a - 1) && rm === m) {
        // Los renglones del año anterior llegan antes que los del actual (un fetch por año):
        // la entrada se crea en las dos ramas o el YoY por SKU se pierde.
        const o = bySku.get(row.sku) || (bySku.set(row.sku, { sku: row.sku, monto: 0, piezas: 0, prev: 0 }), bySku.get(row.sku));
        if (ra === a) { mtd += mo; piezas += pz; o.monto += mo; o.piezas += pz; }
        else { prev += mo; o.prev += mo; }
      }
    }

    const factor = enCurso ? Math.max(1, hoy.getDate()) / new Date(a, m, 0).getDate() : 1;
    const yoy = delta(mtd, prev * Math.min(1, factor));
    const yoyYtd = delta(ytd, ytdPrev);

    // Cuota: sólo comparable sin filtros (o con cuota del canal elegido)
    const cuotaTotal = cuotas.mes(a, m);
    const cuotaCanal = canalSel ? cuotas.porCanal.get(canalSel) || null : null;
    const cuota = canalSel ? cuotaCanal : soloClave ? null : cuotaTotal || null;
    const cuotaYtd = !canalSel && !soloClave ? Array.from({ length: m }, (_, i) => cuotas.mes(a, i + 1)).reduce((x, y) => x + y, 0) : null;
    const pct = cuota > 0 ? (mtd / cuota) * 100 : null;

    const skus = [...bySku.values()]
      .filter((o) => o.monto > 0 || o.piezas > 0)
      .map((o) => { const cat = catalogo.get(o.sku) || {}; return { ...o, yoy: delta(o.monto, o.prev), descripcion: cat.descripcion || '', marca: cat.marca || '', categoria: cat.categoria || '', rdmp: cat.rdmp || '' }; })
      .sort((x, y) => y.monto - x.monto);

    const medida = unidad === 'monto' ? (s) => s.monto : (s) => s.piezas;
    const composicion = agrupar(skus, dimension, medida);
    const totalComposicion = sum(skus, medida);

    const listaCanales = [...canales.values()]
      .filter((c) => c.monto || c.prev || c.serie.some((v) => v > 0))
      .map((c) => ({ ...c, cuota: cuotas.porCanal.get(c.canal) || null, yoy: delta(c.monto, c.prev * Math.min(1, factor)) }))
      .sort((x, y) => y.monto - x.monto);
    const totalCanales = sum(listaCanales, (c) => c.monto);

    const mesL = MESES_LARGO[m - 1].toLowerCase();
    const diasRestantes = enCurso ? Math.max(0, new Date(a, m, 0).getDate() - hoy.getDate()) : 0;
    const frase = !mtd ? `Aún sin facturación en ${mesL} ${a}`
      : pct == null ? `${MESES[m - 1]} ${a}: ${moneyCompact(mtd)}${yoy != null ? `, ${deltaPct(yoy)} vs ${a - 1}` : ''}`
      : pct >= 100 ? `${MESES[m - 1]} ya cumplió la cuota: ${Math.round(pct)}% del objetivo`
      : enCurso ? `${MESES[m - 1]} va al ${Math.round(pct)}%; faltan ${moneyCompact(cuota - mtd)}${diasRestantes ? ` en ${diasRestantes} día${diasRestantes === 1 ? '' : 's'}` : ''}`
      : `${MESES[m - 1]} cerró al ${Math.round(pct)}% de la cuota`;

    return {
      a, m, enCurso, mtd, piezas, prev, yoy, ytd, ytdPrev, yoyYtd, cuota, cuotaYtd, pct, frase,
      skus, composicion, totalComposicion, canales: listaCanales, totalCanales, disponibles, comparable: a === anioActual,
      skusAnio: skusAnio.size, ritmo: enCurso ? Math.min(1, factor) : null,
    };
  }, [data, sel, soloClave, canalSel, dimension, unidad, catalogo, cuotas, meses6, anioActual, mesActual, hoy]);

  // ── Buscador sobre el roadmap (sin acentos) con el monto del mes si lo hubo ──
  const resultados = useMemo(() => {
    const toks = tokens(q);
    if (!toks.length || !r) return [];
    const ventas = new Map(r.skus.map((s) => [s.sku, s]));
    return roadmap
      .map((x) => ({ sku: x.sku, descripcion: x.descripcion || '', marca: x.marca || '', categoria: x.categoria || '', rdmp: x.rdmp || '', venta: ventas.get(x.sku) || null }))
      .filter((x) => coincide(normalizar(`${x.sku} ${x.descripcion} ${x.marca} ${x.categoria}`), toks))
      .sort((a, b) => N(b.venta?.monto) - N(a.venta?.monto) || a.sku.localeCompare(b.sku))
      .slice(0, 30);
  }, [q, roadmap, r]);

  /** Serie por canal de UN sku en los 6 meses (sobre todos los renglones, sin los filtros de pantalla). */
  const abrirSku = (sku, info) => {
    const idx6 = new Map(meses6.map((c, i) => [`${c.anio}-${c.mes}`, i]));
    const porCanal = new Map();
    (data?.rows || []).forEach((row) => {
      if (row.sku !== sku) return;
      const i = idx6.get(`${N(row.anio)}-${N(row.mes)}`); if (i == null) return;
      const ck = canalDe(row);
      const o = porCanal.get(ck) || (porCanal.set(ck, { canal: ck, piezas: meses6.map(() => 0), monto: meses6.map(() => 0) }), porCanal.get(ck));
      o.piezas[i] += N(row.piezas); o.monto[i] += N(row.monto);
    });
    const cat = catalogo.get(sku) || {};
    nav.push(<FichaSku sku={sku} meses={meses6} porCanal={[...porCanal.values()]} info={{ descripcion: info?.descripcion || cat.descripcion || '', marca: info?.marca || cat.marca || '', categoria: info?.categoria || cat.categoria || '', rdmp: info?.rdmp || cat.rdmp || '' }} />, `sellin-sku-${sku}`);
  };

  const textoCompartir = useMemo(() => (r ? textoResumenMesCanal({
    mes: r.m, anio: r.a, mtd: r.mtd, cuota: r.cuota || null, ytd: r.ytd, yoyYtd: r.yoyYtd,
    canales: r.canales.map((c) => ({ canal: c.canal, monto: c.monto, cuota: c.cuota, yoy: c.yoy })),
  }) : ''), [r]);
  const onCompartir = async () => { if (await compartir(textoCompartir, { titulo: `Sell In ${MESES_LARGO[sel.mes - 1]} ${sel.anio}` }) === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(textoCompartir)) toast.ok('Resumen copiado'); else toast.error('No se pudo copiar'); };

  const top = r ? r.skus.slice(0, 10) : [];
  const maxTop = Math.max(0, ...top.map((o) => o.piezas));
  const sub = <><span>Todos los clientes y canales</span><span>·</span><FrescuraPill pantalla="sellIn" detallado /></>;
  const etiquetaFiltro = `${canalSel ? canalLabel(canalSel) : 'Todos los canales'}${soloClave ? ' · clientes clave' : ''}`;

  if (error) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Sell In" sub={sub} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar el Sell In" sub={error.message} /></>);

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Sell In" sub={sub} derecha={<SelectorMes valor={sel} onChange={setSel} anioActual={anioActual} mesActual={mesActual} disponibles={r?.disponibles} />} />

      {(isLoading || !r) && <div style={{ padding: '0 16px' }}><Cargando pantalla="movilSellInGlobal" /></div>}

      {r && (
        <>
          <HeroM eyebrow={`Consolidado · ${MESES[r.m - 1]} ${r.a}${r.enCurso ? ' · en curso' : ''}`} frase={r.frase}
            sub={r.cuota > 0 ? `${money(r.mtd)} de ${moneyCompact(r.cuota)} de cuota · ${etiquetaFiltro}` : `${money(r.mtd)} · ${etiquetaFiltro} · sin cuota comparable`}
            stats={[
              { k: r.enCurso ? 'MTD' : 'Mes', v: moneyCompact(r.mtd), sub: r.pct != null ? `${Math.round(r.pct)}% de cuota` : `${int(r.piezas)} pz` },
              { k: `YTD ${r.a}`, v: moneyCompact(r.ytd), sub: r.yoyYtd != null ? `${deltaPct(r.yoyYtd)} vs ${r.a - 1}` : undefined },
              { k: `vs ${r.a - 1}`, v: r.yoy != null ? deltaPct(r.yoy) : '—', sub: !r.comparable ? `${r.a - 1} no se carga aquí` : r.enCurso ? 'a mismo día' : `${moneyCompact(r.prev)} en ${r.a - 1}`, color: r.yoy == null ? undefined : r.yoy >= 0 ? theme.green : theme.red },
            ]}>
            <BarraMes mtd={r.mtd} cuota={r.cuota} ritmo={r.ritmo} theme={theme} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
              <PillHero on={!soloClave} onClick={() => setSoloClave(false)} theme={theme}>Todos los canales</PillHero>
              <PillHero on={soloClave} onClick={() => setSoloClave(true)} theme={theme}>Clientes clave</PillHero>
              <PillHero onClick={() => setCompartiendo(true)} theme={theme} style={{ marginLeft: 'auto' }}><Share2 size={12} strokeWidth={2.4} />Compartir</PillHero>
            </div>
          </HeroM>

          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow="Cuota mes" big={r.cuota > 0 ? moneyCompact(r.cuota) : '—'} sub={r.cuota > 0 ? (r.mtd >= r.cuota ? 'cubierta' : `faltan ${moneyCompact(r.cuota - r.mtd)}`) : canalSel ? 'este canal no tiene cuota' : soloClave ? 'la cuota es de toda la empresa' : 'sin cuota cargada'} progress={r.pct} pill={r.pct != null ? { tone: tonoCuota(r.pct), label: `${Math.round(r.pct)}%` } : undefined} />
            <KpiM eyebrow="Cuota YTD" big={r.cuotaYtd > 0 ? moneyCompact(r.cuotaYtd) : '—'} sub={r.cuotaYtd > 0 ? `${moneyCompact(r.ytd)} en ${r.a}` : 'no comparable con filtros'} progress={r.cuotaYtd > 0 ? (r.ytd / r.cuotaYtd) * 100 : null} pill={r.cuotaYtd > 0 ? { tone: tonoCuota((r.ytd / r.cuotaYtd) * 100), label: `${Math.round((r.ytd / r.cuotaYtd) * 100)}%` } : undefined} />
            <KpiM eyebrow={`Piezas · ${MESES[r.m - 1]}`} big={int(r.piezas)} sub={`${int(r.skus.length)} SKUs en el mes`} />
            <KpiM eyebrow={`SKUs ${r.a}`} big={int(r.skusAnio)} sub="distintos con venta en el año" />
          </KpiGrid>

          <ListaAgrupada titulo={`Por canal · ${MESES[r.m - 1]}`} meta={`${r.canales.length}`} style={{ marginTop: 18 }}
            accion={canalSel ? <button type="button" onClick={() => setCanalSel(null)} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, cursor: 'pointer', padding: 0 }}>Todos</button> : undefined}
            pie="Monto del mes · pastilla = % de la cuota del canal (cuotas_canales) o YoY si no hay cuota · línea = 6 meses. Toca un canal para filtrar el resto de la pantalla.">
            {r.canales.length === 0 && <Vacio icon={null} titulo="Sin facturación en el mes" style={{ padding: 18 }} />}
            {r.canales.map((c) => {
              const on = canalSel === c.canal;
              const pctC = c.cuota > 0 ? (c.monto / c.cuota) * 100 : null;
              return (
                <Fila key={c.canal} tono={on ? theme.accent : undefined}
                  titulo={canalLabel(c.canal)} sub={r.totalCanales > 0 ? `${Math.round((c.monto / r.totalCanales) * 100)}% del mes` : 'sin venta'}
                  valor={moneyCompact(c.monto)} valorSub={c.cuota > 0 ? `de ${moneyCompact(c.cuota)}` : undefined}
                  pill={pctC != null ? { tone: tonoCuota(pctC), label: `${Math.round(pctC)}% cuota` } : { tone: tonoDelta(c.yoy), label: c.yoy != null ? `${deltaPct(c.yoy)} YoY` : r.comparable ? 'nuevo' : '—' }}
                  trailing={<Sparkline valores={c.serie} ancho={46} color={on ? theme.accent : undefined} />}
                  chevron={false} onClick={() => setCanalSel(on ? null : c.canal)}
                  style={{ gap: 8, ...(on ? { background: `${theme.accent}0E` } : null) }} />
              );
            })}
          </ListaAgrupada>

          <div style={{ padding: '18px 16px 8px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="Buscar un producto (sku, nombre, marca)" /></div>
          {q.trim() && (
            <ListaAgrupada titulo="Resultados" meta={`${resultados.length}`} pie="Del roadmap · el monto es el del mes elegido. Toca uno para abrir su ficha.">
              {resultados.length === 0 && <Vacio icon={null} titulo="Sin coincidencias" sub="Prueba con parte del SKU, del nombre o de la marca." />}
              {resultados.map((x) => (
                <Fila key={x.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{x.sku}</span>} sub={`${x.descripcion || 'Sin descripción'}${x.marca ? ` · ${x.marca}` : ''}`}
                  valor={x.venta ? moneyCompact(x.venta.monto) : '—'} valorSub={x.venta ? `${int(x.venta.piezas)} pz` : 'sin venta'}
                  onClick={() => abrirSku(x.sku, x)} />
              ))}
            </ListaAgrupada>
          )}

          <div style={{ padding: '18px 16px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <Segmented value={dimension} onChange={setDimension} options={DIMENSIONES} />
            <Segmented value={unidad} onChange={setUnidad} options={UNIDADES} />
          </div>
          <ComposicionCategorias filas={r.composicion} total={r.totalComposicion} unidad={unidad}
            titulo={`Composición por ${dimension === 'marca' ? 'marca' : 'categoría'}`}
            pie={`${dimension === 'marca' ? 'Marca' : 'Categoría'} del roadmap · % del ${unidad === 'monto' ? 'monto facturado' : 'total de piezas'} en ${MESES[r.m - 1]} ${r.a}.`} />

          <ListaAgrupada titulo={`Top 10 SKUs · ${MESES[r.m - 1]}`} meta={`${r.skus.length}`} style={{ marginTop: 18 }}
            pie="Celda = piezas del mes (intensidad relativa al SKU líder) · pastilla = monto vs el mismo mes del año anterior. Toca un SKU para abrir su ficha.">
            {top.length === 0 && <Vacio icon={Package} color={theme.textMuted} titulo="Sin facturación en el mes" style={{ padding: 18 }} />}
            {top.map((o, i) => (
              <button key={o.sku} type="button" onClick={() => abrirSku(o.sku, o)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 20, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{money(o.monto)}</span></span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descripcion || 'Sin descripción'}{o.marca ? ` · ${o.marca}` : ''}</span>
                </span>
                <HeatCell v={o.piezas} max={maxTop} />
                <Pill tone={tonoDelta(o.yoy)} size="xs" style={{ minWidth: 48, justifyContent: 'center' }}>{o.yoy != null ? deltaPct(o.yoy) : r.comparable ? 'nuevo' : '—'}</Pill>
              </button>
            ))}
          </ListaAgrupada>

          <TituloSeccionM style={{ marginTop: 18, padding: '0 28px 6px' }}>Fuente</TituloSeccionM>
          <div style={{ padding: '0 28px', fontSize: 11, color: theme.textSubtle || theme.textMuted, lineHeight: 1.45, fontFamily: TYPO.fontText }}>
            Facturación del ERP por SKU y canal (<span style={{ fontFamily: MONO }}>v_sellin_global_sku_canal_mes</span>), año en curso y anterior · cuota de{' '}
            <span style={{ fontFamily: MONO }}>{cuotas.fuente}</span>.
          </div>

          <div style={{ padding: '18px 16px 0' }}>
            <BotonGrande primario icon={Share2} disabled={!r.mtd} onClick={() => setCompartiendo(true)}>Compartir resumen del mes</BotonGrande>
          </div>
        </>
      )}

      <HojaM abierto={compartiendo} onClose={() => setCompartiendo(false)} titulo="Resumen del mes por canal" sub={`${MESES_LARGO[sel.mes - 1]} ${sel.anio} · sin márgenes ni costos`} alto="76vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{textoCompartir}</pre>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </HojaM>
    </>
  );
}

/** Pastilla tocable sobre el hero inverso (no es Pill del kit: vive sobre fondo negro/marfil). */
function PillHero({ on = false, onClick, children, theme, style }) {
  const activo = theme.mode === 'dark' ? 'rgba(29,29,31,0.92)' : 'rgba(245,245,247,0.95)';
  const texto = theme.mode === 'dark' ? 'rgba(245,245,247,0.95)' : 'rgba(29,29,31,0.92)';
  const inactivo = theme.mode === 'dark' ? 'rgba(29,29,31,0.14)' : 'rgba(245,245,247,0.16)';
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 5, height: 26, padding: '0 11px', borderRadius: 999, border: 0, cursor: 'pointer',
      background: on ? activo : inactivo, color: on ? texto : (theme.textOnInverse || theme.textOnDark),
      fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', ...style,
    }}>{children}</button>
  );
}
