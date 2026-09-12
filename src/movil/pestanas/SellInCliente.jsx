// Sell In del cliente (push) · consulta rápida: hero MTD vs cuota ideal/mínima (barra), YTD, YoY y frase;
// selector de mes (año en curso y anterior); lista de SKUs del mes con piezas, monto y YoY + buscador;
// tocar un SKU abre su ficha en hoja (el AÑO elegido mes a mes con columnas Prom y Total, el año anterior
// como fila comparativa y los clientes finales del año, en piezas o monto) y desde ahí "Ver disponibilidad";
// composición por categoría (roadmap_sku) y "Compartir avance" (texto limpio, sin pagos ni márgenes).
// Fuentes: facturacion_clientes (3 años, por cliente_key) · cuotas_mensuales · roadmap_sku / catalogo_articulos.
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, Share2, Copy, PackageSearch } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { textoAvance, compartir, copiar } from '../../lib/whatsapp';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Skeleton, HeatCell, Pill, Vacio, CampoBusqueda, HojaM, BotonGrande, Segmented, toast } from '../piezas';
import { PROPIOS } from '../datos';
import { money, moneyCompact, int, deltaPct, tonoDelta, tonoCuota, MESES, MONO, N } from '../util';
import FichaProducto from '../FichaProducto';
import TablaAnual from './sellout/TablaAnual';

const STALE = 5 * 60 * 1000;
const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const UNIDADES_SKU = [{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: 'Monto' }];

/** Últimos `n` meses terminando en (anio, mes): [{ anio, mes, label }]. */
export function ultimosMeses(anio, mes, n = 6) {
  return Array.from({ length: n }, (_, i) => { let m = mes - (n - 1) + i, a = anio; while (m <= 0) { m += 12; a -= 1; } return { anio: a, mes: m, label: `${MESES[m - 1]}${m === 1 || i === 0 ? ` ${String(a).slice(2)}` : ''}` }; });
}

/** sku → { descripcion, marca, categoria, familia } · roadmap_sku con respaldo catalogo_articulos (cachedQuery por lotes). */
export async function catalogoSkus(skus) {
  const m = new Map();
  const lista = [...new Set(skus.filter(Boolean))];
  for (let i = 0; i < lista.length; i += 200) {
    const ch = lista.slice(i, i + 200);
    const { data } = await cachedQuery(supabase.from('roadmap_sku').select('sku,descripcion,marca,categoria,familia').in('sku', ch));
    (data || []).forEach((r) => { if (!m.has(r.sku)) m.set(r.sku, { descripcion: r.descripcion || '', marca: r.marca || '', categoria: r.categoria || '', familia: r.familia || '' }); });
    const faltan = ch.filter((s) => !m.has(s));
    if (faltan.length) {
      const { data: cat } = await cachedQuery(supabase.from('catalogo_articulos').select('articulo,descripcion').in('articulo', faltan));
      (cat || []).forEach((r) => m.set(r.articulo, { descripcion: r.descripcion || '', marca: '', categoria: '', familia: '' }));
    }
  }
  return m;
}

// ── Datos: facturación del cliente 3 años (para YoY del año anterior) + cuotas + catálogo
function useSellInCliente(ck, anio) {
  return useQuery({
    queryKey: ['movil', 'sellin-cliente', ck, anio], staleTime: STALE, enabled: !!ck,
    queryFn: async () => {
      const anios = [anio - 2, anio - 1, anio];
      const [rows, cuotas] = await Promise.all([
        fetchAll('facturacion_clientes', 'cliente_nombre,sku,anio,mes,piezas,monto', (q) => q.eq('cliente_key', ck).in('anio', anios)),
        fetchAll('cuotas_mensuales', 'cliente,mes,anio,cuota_ideal,cuota_min', (q) => q.eq('cliente', ck).in('anio', [anio - 1, anio])),
      ]);
      const cat = await catalogoSkus(rows.map((r) => r.sku));
      return { rows, cuotas, cat };
    },
  });
}

/** Botón "Sep 2026 ▾" + hoja con los meses del año en curso y del anterior. */
export function SelectorMes({ valor, onChange, anioActual, mesActual, disponibles }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const anios = [anioActual, anioActual - 1];
  return (
    <>
      <button type="button" onClick={() => setAbierto(true)}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, height: 32, padding: '0 10px 0 12px', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', flexShrink: 0 }}>
        {MESES[valor.mes - 1]} {valor.anio}<ChevronDown size={14} style={{ color: theme.textMuted }} />
      </button>
      <HojaM abierto={abierto} onClose={() => setAbierto(false)} titulo="Mes" sub="Año en curso y anterior" alto="70vh">
        {anios.map((a) => (
          <ListaAgrupada key={a} titulo={String(a)} style={{ marginBottom: 14 }}>
            {MESES.map((lbl, i) => {
              const m = i + 1;
              if (a === anioActual && m > mesActual) return null;
              const on = valor.anio === a && valor.mes === m;
              const hay = disponibles ? disponibles.has(`${a}-${m}`) : true;
              return <Fila key={m} titulo={`${lbl} ${a}`} sub={a === anioActual && m === mesActual ? 'Mes en curso' : hay ? undefined : 'Sin facturación'} chevron={false} alto={44}
                trailing={on ? <Pill tone="blue">Elegido</Pill> : undefined} onClick={() => { onChange({ anio: a, mes: m }); setAbierto(false); }} style={{ opacity: hay ? 1 : 0.5 }} />;
            })}
          </ListaAgrupada>
        ))}
      </HojaM>
    </>
  );
}

/** Agrupa SKUs por categoría del roadmap (sin distinguir mayúsculas) → [{ label, valor, skus }] ordenado por valor. */
export function agruparCategorias(skus, medida) {
  const cat = new Map();
  skus.forEach((s) => { const raw = String(s.categoria || '').trim() || 'Sin categoría'; const k = raw.toLowerCase(); const o = cat.get(k) || (cat.set(k, { label: raw, valor: 0, skus: 0 }), cat.get(k)); o.valor += N(medida(s)); o.skus++; });
  return [...cat.values()].sort((x, y) => y.valor - x.valor);
}

/** Lista "Composición por categoría" (monto y % del total) · reutilizada por Sell Out. */
export function ComposicionCategorias({ filas, total, titulo = 'Composición por categoría', unidad = 'monto', pie }) {
  const { theme } = useTheme();
  if (!filas.length) return null;
  const max = Math.max(0, ...filas.map((f) => f.valor));
  return (
    <ListaAgrupada titulo={titulo} meta={`${filas.length}`} style={{ marginTop: 18 }} pie={pie}>
      {filas.map((f) => (
        <div key={f.label} style={{ padding: '9px 12px', fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }}>{f.label}<span style={{ fontSize: 11.5, color: theme.textMuted, marginLeft: 6 }}>{f.skus} SKU</span></span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', flexShrink: 0, color: theme.text }}>{total > 0 ? `${Math.round((f.valor / total) * 100)}%` : '—'}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 6, fontSize: 12, fontFamily: TYPO.fontText }}>{unidad === 'monto' ? moneyCompact(f.valor) : `${int(f.valor)} pz`}</span></span>
          </div>
          <div style={{ marginTop: 6, height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ height: 4, width: `${max > 0 ? (f.valor / max) * 100 : 0}%`, background: theme.accent, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </ListaAgrupada>
  );
}

export default function SellInCliente({ clienteKey, nombre }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioActual = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const [sel, setSel] = useState({ anio: anioActual, mes: mesActual });
  const [q, setQ] = useState('');
  const [verTodo, setVerTodo] = useState(false);
  const [skuHeat, setSkuHeat] = useState(null);
  const [unidadSku, setUnidadSku] = useState('piezas');
  const [compartiendo, setCompartiendo] = useState(false);
  const { data, isLoading, error } = useSellInCliente(clienteKey, anioActual);
  const propio = PROPIOS.includes(clienteKey);
  const fmtSku = unidadSku === 'monto' ? moneyCompact : (n) => Math.round(n).toLocaleString('es-MX');

  const r = useMemo(() => {
    if (!data) return null;
    const { anio: a, mes: m } = sel;
    const enCurso = a === anioActual && m === mesActual;
    const rows = data.rows;
    const de = (aa, mm) => rows.filter((x) => N(x.anio) === aa && N(x.mes) === mm);
    const mtd = sum(de(a, m), (x) => x.monto), piezas = sum(de(a, m), (x) => x.piezas);
    const prev = sum(de(a - 1, m), (x) => x.monto);
    const factor = enCurso ? Math.min(1, Math.max(1, hoy.getDate()) / new Date(a, m, 0).getDate()) : 1;
    const yoy = delta(mtd, prev * factor);
    const ytd = sum(rows.filter((x) => N(x.anio) === a && N(x.mes) <= m), (x) => x.monto);
    const ytdPrev = sum(rows.filter((x) => N(x.anio) === a - 1 && N(x.mes) <= m), (x) => x.monto);
    const cu = data.cuotas.find((c) => N(c.anio) === a && N(c.mes) === m);
    const cuotaIdeal = N(cu?.cuota_ideal), cuotaMin = N(cu?.cuota_min);
    const pct = cuotaIdeal > 0 ? (mtd / cuotaIdeal) * 100 : null, pctMin = cuotaMin > 0 ? (mtd / cuotaMin) * 100 : null;
    const cuotaYtd = sum(data.cuotas.filter((c) => N(c.anio) === a && N(c.mes) <= m), (c) => c.cuota_ideal);
    // SKUs del mes
    const by = new Map();
    de(a, m).forEach((x) => { if (!x.sku) return; const o = by.get(x.sku) || (by.set(x.sku, { sku: x.sku, monto: 0, piezas: 0, prev: 0 }), by.get(x.sku)); o.monto += N(x.monto); o.piezas += N(x.piezas); });
    de(a - 1, m).forEach((x) => { const o = by.get(x.sku); if (o) o.prev += N(x.monto); });
    const skus = [...by.values()].filter((o) => o.monto > 0 || o.piezas > 0).map((o) => ({ ...o, yoy: delta(o.monto, o.prev), ...(data.cat.get(o.sku) || {}) })).sort((x, y) => y.monto - x.monto);
    // Composición por categoría
    const categorias = agruparCategorias(skus, (x) => x.monto);
    const disponibles = new Set(rows.filter((x) => N(x.monto) > 0).map((x) => `${x.anio}-${N(x.mes)}`));
    const mesL = MESES[m - 1].toLowerCase();
    const frase = !mtd ? `Aún sin facturación en ${mesL} ${a}`
      : pct == null ? `${MESES[m - 1]} ${a}: ${moneyCompact(mtd)}${yoy != null ? `, ${deltaPct(yoy)} vs ${a - 1}` : ''}`
      : pct >= 100 ? `${MESES[m - 1]} cerró ${(pct - 100).toFixed(0)}% arriba de la cuota ideal`
      : pctMin != null && pctMin >= 100 ? `Cuota mínima cubierta · ${Math.round(pct)}% de la ideal`
      : enCurso ? `Va al ${Math.round(pct)}% de la cuota ideal de ${mesL}` : `${MESES[m - 1]} quedó al ${Math.round(pct)}% de la cuota ideal`;
    return { a, m, enCurso, mtd, piezas, prev, yoy, ytd, ytdPrev, yoyYtd: delta(ytd, ytdPrev), cuotaIdeal, cuotaMin, pct, pctMin, cuotaYtd, skus, categorias, disponibles, frase, total: sum(skus, (s) => s.monto) };
  }, [data, sel, anioActual, mesActual, hoy]);

  const filtrados = useMemo(() => {
    if (!r) return [];
    const nq = norm(q.trim()); if (!nq) return r.skus;
    const terms = nq.split(/\s+/);
    return r.skus.filter((s) => { const t = norm(`${s.sku} ${s.descripcion} ${s.marca} ${s.categoria}`); return terms.every((w) => t.includes(w)); });
  }, [r, q]);
  const visibles = verTodo || q ? filtrados : filtrados.slice(0, 25);
  const maxPz = Math.max(0, ...visibles.map((o) => o.piezas));

  // Ficha del SKU: el AÑO elegido mes a mes (12 columnas + Prom + Total), el año anterior como fila
  // comparativa, y debajo los clientes finales (cliente_nombre dentro del cliente_key) del mismo año.
  const heat = useMemo(() => {
    if (!skuHeat || !data) return null;
    const a = sel.anio;
    const vacio = () => Array.from({ length: 12 }, () => 0);
    const anioCur = { piezas: vacio(), monto: vacio() }, anioPrev = { piezas: vacio(), monto: vacio() };
    const clientes = new Map();
    data.rows.forEach((x) => {
      if (x.sku !== skuHeat) return;
      const y = N(x.anio), m = N(x.mes); if (m < 1 || m > 12) return;
      if (y === a) {
        anioCur.piezas[m - 1] += N(x.piezas); anioCur.monto[m - 1] += N(x.monto);
        const lbl = x.cliente_nombre || 'Sin nombre';
        const f = clientes.get(lbl) || (clientes.set(lbl, { label: lbl, piezas: vacio(), monto: vacio() }), clientes.get(lbl));
        f.piezas[m - 1] += N(x.piezas); f.monto[m - 1] += N(x.monto);
      } else if (y === a - 1) { anioPrev.piezas[m - 1] += N(x.piezas); anioPrev.monto[m - 1] += N(x.monto); }
    });
    return { a, anioCur, anioPrev, clientes: [...clientes.values()], info: data.cat.get(skuHeat) || {} };
  }, [skuHeat, data, sel.anio]);

  // Filas listas para TablaAnual según la unidad elegida en la hoja.
  const heatFilas = useMemo(() => {
    if (!heat) return null;
    const v = (o) => (unidadSku === 'monto' ? o.monto : o.piezas);
    const hay = (arr) => arr.some((x) => x !== 0);
    const anios = [];
    if (hay(v(heat.anioCur))) anios.push({ label: String(heat.a), sub: heat.a === anioActual ? `Ene–${MESES[mesActual - 1]}` : 'año completo', valores: v(heat.anioCur) });
    if (hay(v(heat.anioPrev))) anios.push({ label: String(heat.a - 1), sub: 'año completo', valores: v(heat.anioPrev) });
    const clientes = heat.clientes.map((c) => ({ label: c.label, valores: v(c) })).filter((c) => hay(c.valores)).sort((p, s) => sum(s.valores, (x) => x) - sum(p.valores, (x) => x));
    return { anios, clientes };
  }, [heat, unidadSku, anioActual, mesActual]);

  const textoCompartir = useMemo(() => (r ? textoAvance({ cliente: nombre, mes: r.m, anio: r.a, mtd: r.mtd, cuota: r.cuotaIdeal, ytd: r.ytd, top: r.skus.slice(0, 5) }) : ''), [r, nombre]);
  const onCompartir = async () => { const res = await compartir(textoCompartir, { titulo: `Avance ${nombre}` }); if (res === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(textoCompartir)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };
  const abrirFicha = (sku) => { nav.agregarSku(sku); setSkuHeat(null); nav.push(<FichaProducto />, 'ficha'); };

  const sub = r ? `${nombre} · ${money(r.total)} en ${r.skus.length} SKUs${r.piezas ? ` · ${int(r.piezas)} pz` : ''}` : nombre;
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta={nombre} />
      <TituloGrande titulo="Sell In" sub={sub} derecha={<SelectorMes valor={sel} onChange={(v) => { setSel(v); setVerTodo(false); }} anioActual={anioActual} mesActual={mesActual} disponibles={r?.disponibles} />} />
      {error && <Vacio titulo="No se pudo cargar el sell in" sub={error.message} color={theme.red} />}
      {(isLoading || !r) && !error && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={84} r={12} /><Skeleton h={320} r={12} /></div>}
      {r && (
        <>
          <HeroM eyebrow={`${propio ? 'Sell In' : 'Facturación'} · ${MESES[r.m - 1]} ${r.a}${r.enCurso ? ' · en curso' : ''}`} frase={r.frase}
            sub={r.cuotaIdeal > 0 ? `${money(r.mtd)} de ${moneyCompact(r.cuotaIdeal)} ideal${r.cuotaMin > 0 ? ` · mínima ${moneyCompact(r.cuotaMin)}` : ''}` : `${money(r.mtd)} · sin cuota cargada`}
            stats={[
              { k: r.enCurso ? 'MTD' : 'Mes', v: moneyCompact(r.mtd), sub: r.pct != null ? `${Math.round(r.pct)}% ideal` : undefined },
              { k: `YTD ${r.a}`, v: moneyCompact(r.ytd), sub: r.cuotaYtd > 0 ? `${Math.round((r.ytd / r.cuotaYtd) * 100)}% cuota` : r.yoyYtd != null ? `${deltaPct(r.yoyYtd)} YoY` : undefined },
              { k: `vs ${r.a - 1}`, v: r.yoy != null ? deltaPct(r.yoy) : '—', sub: r.enCurso ? 'a mismo día' : `${moneyCompact(r.prev)} ${r.a - 1}`, color: r.yoy == null ? undefined : r.yoy >= 0 ? theme.green : theme.red },
            ]}>
            {r.cuotaIdeal > 0 && <BarraCuota mtd={r.mtd} ideal={r.cuotaIdeal} min={r.cuotaMin} theme={theme} />}
          </HeroM>

          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow="Cuota ideal" big={r.cuotaIdeal > 0 ? moneyCompact(r.cuotaIdeal) : '—'} sub={r.cuotaIdeal > 0 ? `faltan ${moneyCompact(Math.max(0, r.cuotaIdeal - r.mtd))}` : 'sin cuota cargada'} progress={r.pct} pill={r.pct != null ? { tone: tonoCuota(r.pct), label: `${Math.round(r.pct)}%` } : undefined} />
            <KpiM eyebrow="Cuota mínima" big={r.cuotaMin > 0 ? moneyCompact(r.cuotaMin) : '—'} sub={r.cuotaMin > 0 ? (r.mtd >= r.cuotaMin ? 'cubierta' : `faltan ${moneyCompact(r.cuotaMin - r.mtd)}`) : 'sin mínima cargada'} progress={r.pctMin} pill={r.pctMin != null ? { tone: tonoCuota(r.pctMin), label: `${Math.round(r.pctMin)}%` } : undefined} />
          </KpiGrid>

          <div style={{ padding: '18px 16px 8px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="Buscar SKU o producto del mes" /></div>
          <ListaAgrupada titulo={`SKUs · ${MESES[r.m - 1]}`} meta={q ? `${filtrados.length} de ${r.skus.length}` : `${r.skus.length}`} pie="Celda = piezas del mes (intensidad relativa al SKU líder) · pill = monto vs mismo mes del año anterior. Toca un SKU para ver su año mes a mes (con promedio y total) y sus clientes finales.">
            {visibles.length === 0 && <Vacio icon={null} titulo={q ? 'Sin coincidencias' : 'Sin facturación este mes'} sub={q ? undefined : 'Todavía no hay renglones cargados para este mes.'} />}
            {visibles.map((o, i) => (
              <button key={o.sku} type="button" onClick={() => setSkuHeat(o.sku)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 20, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{money(o.monto)}</span></span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.descripcion || 'Sin descripción'}{o.categoria ? ` · ${o.categoria}` : ''}</span>
                </span>
                <HeatCell v={o.piezas} max={maxPz} />
                <Pill tone={tonoDelta(o.yoy)} size="xs" style={{ minWidth: 48, justifyContent: 'center' }}>{o.yoy != null ? deltaPct(o.yoy) : 'nuevo'}</Pill>
              </button>
            ))}
            {!verTodo && !q && filtrados.length > 25 && (
              <button type="button" onClick={() => setVerTodo(true)} style={{ width: '100%', height: 44, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 500, cursor: 'pointer' }}>Ver los {filtrados.length} SKUs</button>
            )}
          </ListaAgrupada>

          <ComposicionCategorias filas={r.categorias} total={r.total} pie="Categoría del roadmap · % del monto facturado en el mes." />

          <div style={{ padding: '18px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <BotonGrande primario icon={Share2} disabled={!r.mtd} onClick={() => setCompartiendo(true)}>Compartir avance</BotonGrande>
          </div>
        </>
      )}

      <HojaM abierto={!!skuHeat} onClose={() => setSkuHeat(null)} titulo={skuHeat || 'SKU'} sub={`${nombre} · ${sel.anio} mes a mes`} alto="86vh">
        {heat && heatFilas && (
          <div style={{ padding: '0 16px 8px', fontFamily: TYPO.fontText, color: theme.text }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{skuHeat}{heat.info.marca && <span style={{ fontWeight: 500, fontSize: 12, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText }}>{heat.info.marca}</span>}</div>
                <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.35 }}>{heat.info.descripcion || 'Sin descripción'}</div>
              </div>
              <Segmented value={unidadSku} onChange={setUnidadSku} options={UNIDADES_SKU} style={{ flexShrink: 0 }} />
            </div>

            <TablaAnual columnas={MESES} filas={heatFilas.anios} fmt={fmtSku} etiquetaFilas={heatFilas.anios.length > 1 ? '2 años' : ''} conTotalFila={false}
              vacio={`Sin facturación de este SKU en ${heat.a - 1}–${heat.a}.`} />
            <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 4px 12px', lineHeight: 1.4 }}>
              {unidadSku === 'monto' ? 'Monto facturado' : 'Piezas facturadas'} a {nombre} por mes · <strong>Prom</strong> = promedio sólo de los meses con dato · <strong>Total</strong> = año.
            </div>

            {heatFilas.clientes.length > 0 && (
              <>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, padding: '4px 4px 6px' }}>
                  Clientes finales {heat.a}
                </div>
                <TablaAnual columnas={MESES} filas={heatFilas.clientes} fmt={fmtSku} etiquetaFilas={`${heatFilas.clientes.length} clientes`} totalLabel="Total" />
                <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 4px 0', lineHeight: 1.4 }}>
                  {heatFilas.clientes.length === 1 ? `${nombre} factura con un solo nombre en el ERP ("${heatFilas.clientes[0].label}").` : 'Nombre del cliente final en el ERP · intensidad relativa al máximo de cada fila.'}
                </div>
              </>
            )}

            <BotonGrande icon={PackageSearch} onClick={() => abrirFicha(skuHeat)} style={{ marginTop: 14 }}>Ver disponibilidad</BotonGrande>
          </div>
        )}
      </HojaM>

      <HojaM abierto={compartiendo} onClose={() => setCompartiendo(false)} titulo="Compartir avance" sub={`${nombre} · ${MESES[sel.mes - 1]} ${sel.anio} · sin pagos ni márgenes`} alto="70vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{textoCompartir}</pre>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </HojaM>
    </>
  );
}

/** Barra de avance dentro del Hero: relleno = MTD / ideal, marca = cuota mínima. */
function BarraCuota({ mtd, ideal, min, theme }) {
  const pct = Math.min(100, (mtd / ideal) * 100);
  const posMin = min > 0 && min < ideal ? (min / ideal) * 100 : null;
  const inverso = theme.mode === 'dark' ? 'rgba(29,29,31,0.16)' : 'rgba(245,245,247,0.18)';
  const relleno = pct >= 100 ? theme.green : posMin != null && mtd >= min ? (theme.textOnInverse || theme.textOnDark) : theme.orange;
  return (
    <div style={{ marginTop: 12, position: 'relative' }}>
      <div style={{ height: 6, background: inverso, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: 6, width: `${pct}%`, background: relleno, borderRadius: 999 }} />
      </div>
      {posMin != null && <span aria-hidden style={{ position: 'absolute', top: -3, left: `${posMin}%`, width: 2, height: 12, background: theme.textOnInverse || theme.textOnDark, opacity: 0.8, borderRadius: 1 }} />}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10.5, color: theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.62)', fontVariantNumeric: 'tabular-nums' }}>
        <span>{posMin != null ? `mínima ${moneyCompact(min)}` : ''}</span><span>ideal {moneyCompact(ideal)}</span>
      </div>
    </div>
  );
}
