// Ficha de análisis de UN cliente del ERP (push) · hero MTD / YTD / YoY, 12 meses en gráfica, top 10 SKUs del año
// con piezas, sección "Interno" (alertas del cliente y cartera si es propio; etiquetada, nunca se comparte) y
// "Compartir ficha" con texto limpio (textoFichaCliente: sin YoY negativo, sin alertas, márgenes ni cartera).
// Fuentes: facturacion_clientes por cliente_nombre (2 años) · roadmap_sku / catalogo_articulos · alertas (lib/alertas) ·
// estados_cuenta (último corte del cliente propio).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from 'recharts';
import { Share2, Copy, Lock, CreditCard, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { fetchAll, cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useAlertas } from '../../lib/alertas';
import { colorSev } from '../../components/notificaciones/Pila';
import { canalLabel } from '../../modules/general/inicio/config';
import { textoFichaCliente, compartir, copiar } from '../../lib/whatsapp';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Skeleton, HeatCell, Vacio, HojaM, BotonGrande, TituloSeccionM, toast } from '../piezas';
import { PROPIOS, nombreCliente, colorCliente } from '../datos';
import { money, moneyCompact, int, pct, deltaPct, MESES, MONO, N } from '../util';
import { catalogoSkus, ultimosMeses } from './SellInCliente';
import FichaProducto from '../FichaProducto';

const STALE = 5 * 60 * 1000;
const sum = (arr, f) => arr.reduce((s, x) => s + N(f(x)), 0);
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);

/** Nombre display: "CT INTERNACIONAL DEL NOROESTE" → "Ct Internacional Del Noroeste" (siglas ≤ 3 letras se respetan). */
const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'e', 'en', 'sa', 'cv', 'sapi']);
export const nombreBonito = (s) => String(s || '').trim().toLowerCase().split(/\s+/).map((w, i) => {
  if (PARTICULAS.has(w) && i > 0) return w === 'sa' || w === 'cv' || w === 'sapi' ? w.toUpperCase() : w;
  if (w.length <= 3 && /^[a-z]+$/.test(w)) return w.toUpperCase();
  return w.replace(/^(\S)/, (c) => c.toUpperCase());
}).join(' ');

/** Gráfica mínima de 12 barras (Recharts, sin animación) con el mes actual resaltado. serie: [{ key, label, v, actual }]. */
export function MiniBarras({ serie, fmt = moneyCompact, alto = 150, nombre = 'Monto' }) {
  const { theme } = useTheme();
  const accent = theme.accent;
  const tip = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontSize: 12, fontFamily: TYPO.fontText, color: theme.text, boxShadow: 'none' };
  return (
    <div style={{ margin: '0 16px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 6px 4px 0' }}>
      <ResponsiveContainer width="100%" height={alto}>
        <BarChart data={serie} margin={{ top: 4, right: 6, left: 0, bottom: 0 }} barCategoryGap="28%">
          <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontDisplay }} axisLine={false} tickLine={false} interval={0} />
          <YAxis tickFormatter={(v) => moneyCompact(v).replace('$', '')} tick={{ fontSize: 9, fill: theme.textMuted }} axisLine={false} tickLine={false} width={34} />
          <Tooltip cursor={{ fill: theme.textMuted, fillOpacity: 0.06 }} contentStyle={tip} labelStyle={{ color: theme.textMuted, fontWeight: 500 }} formatter={(v) => [fmt(v), nombre]} />
          <Bar dataKey="v" name={nombre} fill={accent} radius={[4, 4, 0, 0]} maxBarSize={22} isAnimationActive={false}>
            {serie.map((s) => <Cell key={s.key} fillOpacity={s.actual ? 1 : 0.42} stroke={s.actual ? theme.text : 'none'} strokeWidth={s.actual ? 1 : 0} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

function useAnalisisFicha(clienteNombre, anio) {
  return useQuery({
    queryKey: ['movil', 'analisis-ficha', clienteNombre, anio], staleTime: STALE, enabled: !!clienteNombre,
    queryFn: async () => {
      const rows = await fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto,cliente_key,canal', (q) => q.eq('cliente_nombre', clienteNombre).in('anio', [anio - 1, anio]));
      const ck = rows.find((r) => r.cliente_key)?.cliente_key || null;
      const propio = PROPIOS.includes(ck);
      const porSku = new Map();
      rows.filter((r) => N(r.anio) === anio && r.sku).forEach((r) => { const o = porSku.get(r.sku) || (porSku.set(r.sku, { sku: r.sku, piezas: 0, monto: 0 }), porSku.get(r.sku)); o.piezas += N(r.piezas); o.monto += N(r.monto); });
      const top = [...porSku.values()].sort((a, b) => b.monto - a.monto).slice(0, 10);
      const [cat, cartera] = await Promise.all([
        catalogoSkus(top.map((t) => t.sku)),
        propio ? cachedQuery(supabase.from('estados_cuenta').select('cliente,fecha_corte,saldo_actual,saldo_vencido,aging_mas90,dso').eq('cliente', ck).order('fecha_corte', { ascending: false }).limit(1)) : Promise.resolve({ data: [] }),
      ]);
      return { rows, ck, propio, canal: rows.find((r) => r.canal)?.canal || null, top: top.map((t) => ({ ...t, ...(cat.get(t.sku) || {}) })), cartera: cartera.data?.[0] || null };
    },
  });
}

export default function AnalisisFicha({ clienteNombre, canal, label }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const [compartiendo, setCompartiendo] = useState(false);
  const { data, isLoading, error } = useAnalisisFicha(clienteNombre, anio);
  const { data: alertas = [] } = useAlertas({ clienteKey: data?.ck || null, enabled: !!data?.propio });
  const nombre = label || (data?.propio ? nombreCliente(data.ck) : nombreBonito(clienteNombre));

  const r = useMemo(() => {
    if (!data) return null;
    const de = (a, m) => data.rows.filter((x) => N(x.anio) === a && N(x.mes) === m);
    const factor = Math.min(1, Math.max(1, hoy.getDate()) / new Date(anio, mes, 0).getDate());
    const mtd = sum(de(anio, mes), (x) => x.monto), mtdPrev = sum(de(anio - 1, mes), (x) => x.monto);
    const piezas = sum(de(anio, mes), (x) => x.piezas);
    const ytd = sum(data.rows.filter((x) => N(x.anio) === anio && N(x.mes) <= mes), (x) => x.monto);
    const ytdPrev = sum(data.rows.filter((x) => N(x.anio) === anio - 1 && N(x.mes) <= mes), (x) => x.monto);
    const anioPrevTotal = sum(data.rows.filter((x) => N(x.anio) === anio - 1), (x) => x.monto);
    const serie = ultimosMeses(anio, mes, 12).map((c) => ({ key: `${c.anio}-${c.mes}`, label: c.label, v: sum(de(c.anio, c.mes), (x) => x.monto), actual: c.anio === anio && c.mes === mes }));
    const mesesActivos = new Set(data.rows.filter((x) => N(x.anio) === anio && N(x.monto) > 0).map((x) => N(x.mes))).size;
    const yoy = delta(mtd, mtdPrev * factor), yoyYtd = delta(ytd, ytdPrev);
    const frase = !mtd ? `Sin facturación en ${MESES[mes - 1].toLowerCase()}${ytd ? ` · ${moneyCompact(ytd)} en el año` : ''}`
      : `${MESES[mes - 1]} lleva ${moneyCompact(mtd)}${yoy != null ? `, ${deltaPct(yoy)} vs ${anio - 1} a mismo día` : ''}`;
    return { mtd, mtdPrev, piezas, ytd, ytdPrev, anioPrevTotal, yoy, yoyYtd, serie, mesesActivos, frase, maxTop: Math.max(0, ...data.top.map((t) => t.piezas)), totalTop: sum(data.top, (t) => t.monto) };
  }, [data, anio, mes, hoy]);

  const texto = useMemo(() => (r ? textoFichaCliente({ cliente: nombre, mes, anio, mtd: r.mtd, ytd: r.ytd, yoyYtd: r.yoyYtd, top: data.top.slice(0, 5) }) : ''), [r, data, nombre, mes, anio]);
  const onCompartir = async () => { const res = await compartir(texto, { titulo: `Ficha ${nombre}` }); if (res === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(texto)) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };
  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha'); };

  const color = data?.propio ? colorCliente(data.ck, theme) : theme.textMuted;
  const canalTxt = canalLabel(canal || data?.canal || 'otros');
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Análisis" />
      <TituloGrande titulo={nombre} sub={<><span style={{ width: 8, height: 8, borderRadius: 999, background: color, display: 'inline-block' }} />{data?.propio ? 'Cliente propio' : 'Cliente del ERP'} · {canalTxt} · {MESES[mes - 1]} {anio}</>} />
      {error && <Vacio titulo="No se pudo cargar el cliente" sub={error.message} color={theme.red} />}
      {(isLoading || !r) && !error && <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={84} r={12} /><Skeleton h={160} r={12} /><Skeleton h={300} r={12} /></div>}
      {r && (
        <>
          <HeroM eyebrow={`Facturación · ${nombre}`} frase={r.frase} sub={`${money(r.mtd)} este mes${r.piezas ? ` · ${int(r.piezas)} pz` : ''} · activo ${r.mesesActivos} de ${mes} meses`}
            stats={[
              { k: 'MTD', v: moneyCompact(r.mtd), sub: r.yoy != null ? `${deltaPct(r.yoy)} a mismo día` : `${anio - 1}: ${moneyCompact(r.mtdPrev)}` },
              { k: `YTD ${anio}`, v: moneyCompact(r.ytd), sub: r.yoyYtd != null ? `${deltaPct(r.yoyYtd)} vs ${anio - 1}` : undefined },
              { k: `${anio - 1} total`, v: moneyCompact(r.anioPrevTotal), sub: r.ytdPrev ? `${moneyCompact(r.ytdPrev)} a ${MESES[mes - 1]}` : undefined },
            ]} />
          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow={`YTD vs ${anio - 1}`} big={r.yoyYtd != null ? deltaPct(r.yoyYtd, 1) : '—'} bigColor={r.yoyYtd == null ? undefined : r.yoyYtd >= 0 ? theme.green : theme.red} sub={`${moneyCompact(r.ytdPrev)} el año pasado`} />
            <KpiM eyebrow="Top 10 SKUs" big={r.ytd > 0 ? pct((r.totalTop / r.ytd) * 100, 0) : '—'} sub="del acumulado del año" />
          </KpiGrid>

          <TituloSeccionM style={{ marginTop: 18, padding: '0 28px 6px' }}>Últimos 12 meses</TituloSeccionM>
          <MiniBarras serie={r.serie} nombre="Facturación" />

          <ListaAgrupada titulo={`Top ${data.top.length} SKUs · ${anio}`} style={{ marginTop: 18 }} pie="Celda = piezas del año (intensidad relativa al SKU líder). Toca un SKU para ver disponibilidad y precio.">
            {data.top.length === 0 && <Vacio icon={null} titulo="Sin facturación este año" />}
            {data.top.map((t, i) => (
              <button key={t.sku} type="button" onClick={() => abrirSku(t.sku)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 56, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 20, fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: theme.textSubtle || theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0, textAlign: 'right' }}>{i + 1}</span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{money(t.monto)}</span></span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.descripcion || 'Sin descripción'}</span>
                </span>
                <HeatCell v={t.piezas} max={r.maxTop} />
              </button>
            ))}
          </ListaAgrupada>

          <ListaAgrupada style={{ marginTop: 18 }} titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={11} />Interno · no se comparte</span>}
            pie={'Alertas y cartera sólo aparecen para clientes propios; el texto de "Compartir ficha" nunca las incluye.'}>
            {!data.propio && <Vacio icon={null} titulo="Sin datos internos" sub="Este cliente no tiene pestaña propia: no hay alertas ni cartera cargadas." style={{ padding: '18px' }} />}
            {data.propio && data.cartera && (
              <Fila icon={CreditCard} color={N(data.cartera.saldo_vencido) > 0 ? theme.red : theme.green} titulo="Cartera" chevron={false}
                sub={`corte ${data.cartera.fecha_corte}${data.cartera.dso != null ? ` · DSO ${Math.round(N(data.cartera.dso))} d` : ''}`}
                valor={money(data.cartera.saldo_actual)} valorSub={N(data.cartera.saldo_vencido) > 0 ? `${moneyCompact(data.cartera.saldo_vencido)} vencido` : 'sin vencidos'} />
            )}
            {data.propio && !data.cartera && <Fila icon={CreditCard} color={theme.textMuted} titulo="Cartera" sub="sin estado de cuenta cargado" chevron={false} />}
            {data.propio && alertas.length === 0 && <Fila icon={AlertTriangle} color={theme.green} titulo="Sin alertas activas" chevron={false} />}
            {data.propio && alertas.slice(0, 5).map((a) => (
              <Fila key={a.id} tono={colorSev(theme, a.severidad)} titulo={a.titulo} sub={[a.sku, a.detalle].filter(Boolean).join(' · ')} chevron={false} pill={{ tone: a.severidad === 'critica' ? 'red' : a.severidad === 'alta' ? 'orange' : 'gray', label: a.severidad }} />
            ))}
          </ListaAgrupada>

          <div style={{ padding: '18px 16px 0' }}>
            <BotonGrande primario icon={Share2} disabled={!r.ytd} onClick={() => setCompartiendo(true)}>Compartir ficha</BotonGrande>
          </div>
        </>
      )}

      <HojaM abierto={compartiendo} onClose={() => setCompartiendo(false)} titulo="Compartir ficha" sub="Texto limpio · sin alertas, márgenes ni cartera" alto="70vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </HojaM>
    </>
  );
}
