// Comparador de periodos en el celular (2026-11-18 · congruencia web ↔ celular). El MISMO motor y las mismas consultas
// que ComparadorPeriodos.jsx de la web (modules/comercial/comparador/calculo.js y datos.js); aquí sólo se pinta.
//   Atajos (YTD · Trim. vs anterior · Trim. vs año ant. · Libre) → dos selectores de período A y B (HojaM: año, desde,
//   hasta; tocar uno pasa a «Libre») → 4 cifras A vs B con Δ (Contribución/MC sólo con `sensible`) → meses lado a lado
//   en una línea que se lee arrastrando → «Qué movió la diferencia» (SKUs que más suben y bajan; se pide al tocar).
// Va dentro de <PlegadoM> (piezas) al final de la pantalla y con lazy(): nada se descarga, consulta ni calcula hasta abrirlo.
// El preset «Mes vs mismo mes (3 años)» de la web no está aquí: tres columnas no caben en el ancho del teléfono.
// Alcance: {} = empresa · { clienteCodigo, clienteNombre } = cliente del ERP · { clienteKey } = cliente propio.
import React, { useMemo, useState } from 'react';
import { ChevronDown, ArrowLeftRight, Copy } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { copiar } from '../../../lib/whatsapp';
import { KpiM, KpiGrid, Skeleton, HojaM, BotonGrande, ListaAgrupada, Fila, GraficaScrub, LeyendaScrub, Pill, TituloSeccionM, toast } from '../../piezas';
import { moneyCompact, int, money } from '../../util';
import { PRESETS, MESES, deltaPct, labelPeriodo, comparar, ajustarLibre, moversDe, serieComparada, textoResumen } from '../../../modules/comercial/comparador/calculo';
import { useComparadorBase, useComparadorSkus } from '../../../modules/comercial/comparador/datos';

const PRESETS_M = PRESETS.filter((p) => p.k !== 'm3');
const pctTxt = (n) => (n == null || !Number.isFinite(n) ? null : `${n >= 0 ? '+' : '−'}${Math.abs(n).toFixed(Math.abs(n) >= 100 ? 0 : 1)}%`);
const signo = (d, f) => `${d >= 0 ? '+' : '−'}${f(Math.abs(d))}`;

/** Hoja para elegir un período: año, desde y hasta (botones de 44 px). */
export function HojaPeriodo({ abierto, id, periodo, anios = [], onCambio, onClose }) {
  const { theme } = useTheme();
  if (!periodo) return null;
  const lista = anios.includes(periodo.anio) ? anios : [periodo.anio, ...anios];
  const boton = (on) => ({ height: 44, borderRadius: 10, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? theme.accent : theme.surface, color: on ? (theme.textOnDark || '#FFF') : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontVariantNumeric: 'tabular-nums' });
  const rejilla = (campo) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
      {MESES.map((m, i) => {
        const en = i + 1 >= periodo.desde && i + 1 <= periodo.hasta;
        const on = periodo[campo] === i + 1;
        return <button key={m} type="button" onClick={() => onCambio({ [campo]: i + 1 })} style={{ ...boton(on), ...(en && !on ? { background: `${theme.accent}1A`, borderColor: `${theme.accent}55` } : null) }}>{m}</button>;
      })}
    </div>
  );
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo={`Período ${id}`} sub={labelPeriodo(periodo)} alto="82vh">
      <div style={{ padding: '0 16px 8px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: TYPO.fontText }}>
        <div>
          <TituloSeccionM style={{ padding: '0 2px 6px' }}>Año</TituloSeccionM>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            {lista.map((a) => <button key={a} type="button" onClick={() => onCambio({ anio: a })} style={boton(periodo.anio === a)}>{a}</button>)}
          </div>
        </div>
        <div><TituloSeccionM style={{ padding: '0 2px 6px' }}>Desde</TituloSeccionM>{rejilla('desde')}</div>
        <div><TituloSeccionM style={{ padding: '0 2px 6px' }}>Hasta</TituloSeccionM>{rejilla('hasta')}</div>
        <BotonGrande primario onClick={onClose}>Listo</BotonGrande>
      </div>
    </HojaM>
  );
}

/** Vista pura (sin red): la prueba scripts/test-congruencia-movil-ssr.mjs. `c` = comparar() del motor. */
export function ComparadorVista({ c, preset = 'ytd', onPreset, onPeriodo, sensible = false, movers = null, moversAbierto = false, cargandoMovers = false, onMovers, onSku, onCopiar, rd = null }) {
  const { theme } = useTheme();
  const gris = theme.textSubtle || theme.textMuted;
  const [A, B] = c.totales;
  const [pA, pB] = c.periodos;
  const serie = useMemo(() => serieComparada(c.totales.slice(0, 2), c.periodos.slice(0, 2)), [c]);
  if (c.sinDatos || !A || !B) return <div style={{ margin: '0 16px', padding: '18px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 13, color: theme.textMuted, textAlign: 'center' }}>Sin facturación para comparar.</div>;

  const kpi = (eyebrow, get, fmt, extra) => {
    const a = get(A), b = get(B);
    const d = a != null && b != null ? a - b : null, p = a != null && b != null ? deltaPct(a, b) : null;
    return (
      <KpiM eyebrow={eyebrow} big={a == null ? '—' : fmt(a)}
        pill={pctTxt(p) ? { tone: p >= 0 ? 'green' : 'red', label: pctTxt(p) } : undefined}
        sub={<>B {b == null ? '—' : fmt(b)}{d != null ? <> · <span style={{ color: d >= 0 ? theme.green : theme.red }}>{signo(d, fmt)}</span></> : null}{extra ? ` · ${extra}` : ''}</>} />
    );
  };
  const selector = (id, p, color) => (
    <button type="button" onClick={() => onPeriodo?.(id)} aria-label={`Elegir período ${id}`}
      style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 48, padding: '6px 10px 6px 12px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, cursor: 'pointer', textAlign: 'left', minWidth: 0 }}>
      <span style={{ width: 22, height: 22, borderRadius: 999, background: color, color: '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{id}</span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{labelPeriodo(p)}</span>
      <ChevronDown size={15} style={{ color: theme.textMuted, flexShrink: 0 }} />
    </button>
  );
  const filaMover = (s, sube) => (
    <Fila key={s.sku} titulo={s.sku} sub={`${rd?.get?.(s.sku)?.descripcion ? `${rd.get(s.sku).descripcion} · ` : ''}${moneyCompact(s.mB)} → ${moneyCompact(s.mA)} · ${int(s.pB)} → ${int(s.pA)} pz`}
      valor={<span style={{ color: sube ? theme.green : theme.red }}>{signo(s.d, moneyCompact)}</span>} chevron={!!onSku} onClick={onSku ? () => onSku(s.sku) : undefined} />
  );

  return (
    <div data-comparador>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '0 16px 10px' }}>
        {PRESETS_M.map((p) => (
          <button key={p.k} type="button" onClick={() => onPreset?.(p.k)}
            style={{ height: 44, padding: '0 14px', borderRadius: 999, border: `1px solid ${preset === p.k ? theme.accent : theme.border}`, background: preset === p.k ? theme.accent : theme.surface, color: preset === p.k ? (theme.textOnDark || '#FFF') : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>{p.corto}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 8, padding: '0 16px' }}>
        {selector('A', pA, theme.accent)}
        {selector('B', pB, gris)}
      </div>
      {c.mesParcial && <div style={{ padding: '6px 20px 0', fontSize: 11.5, color: theme.textMuted }}>{MESES[c.ultimo.mes - 1]} {c.ultimo.anio} va parcial: la comparación es contra el período completo de B.</div>}

      <KpiGrid style={{ marginTop: 10 }}>
        {kpi('Facturación · A', (t) => t.monto, moneyCompact)}
        {kpi('Piezas · A', (t) => t.piezas, int)}
        {kpi('Ticket promedio · A', (t) => t.ticket, (v) => `$${int(v)}`)}
        {sensible
          ? kpi('Contribución · A', (t) => (t.hayMedidas ? t.contribucion : null), moneyCompact, A.mc != null && B.mc != null ? `MC ${A.mc.toFixed(1)}% vs ${B.mc.toFixed(1)}%` : null)
          : <KpiM eyebrow="Diferencia A − B" big={signo(A.monto - B.monto, moneyCompact)} bigColor={A.monto - B.monto >= 0 ? theme.green : theme.red} sub={`${labelPeriodo(pA)} vs ${labelPeriodo(pB)}`} />}
      </KpiGrid>

      {serie.length > 1 && (
        <>
          <TituloSeccionM style={{ margin: '16px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Mes a mes · A frente a B</TituloSeccionM>
          <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
            <GraficaScrub datos={serie} formato={moneyCompact} etiqueta={(d) => d.label}
              tooltip={(d) => (<><b style={{ fontSize: 12.5 }}>{d.A_lbl || '—'}</b> <b style={{ fontSize: 12.5 }}>{d.A != null ? moneyCompact(d.A) : '—'}</b><br />{d.B_lbl || '—'} {d.B != null ? moneyCompact(d.B) : '—'}{d.A != null && d.B ? <> · <span style={{ color: d.A >= d.B ? theme.green : theme.red }}>{pctTxt(deltaPct(d.A, d.B))}</span></> : null}</>)}
              series={[{ key: 'B', label: labelPeriodo(pB), color: gris }, { key: 'A', label: labelPeriodo(pA), color: theme.accent, area: true, grosor: 2.6 }]} />
            <LeyendaScrub items={[{ label: `A · ${labelPeriodo(pA)}`, color: theme.accent }, { label: `B · ${labelPeriodo(pB)}`, color: gris }]} derecha="Facturación" />
          </div>
        </>
      )}

      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!moversAbierto && <BotonGrande icon={ArrowLeftRight} onClick={onMovers}>Qué movió la diferencia</BotonGrande>}
        {onCopiar && <BotonGrande icon={Copy} onClick={onCopiar}>Copiar resumen</BotonGrande>}
      </div>
      {moversAbierto && (cargandoMovers || !movers ? (
        <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}><Skeleton h={120} r={12} /><Skeleton h={120} r={12} /></div>
      ) : (
        <>
          <ListaAgrupada titulo="Subieron" meta={`A vs B · top ${movers.up.length}`} style={{ marginTop: 16 }}>
            {!movers.up.length && <Fila titulo="Ningún SKU subió" chevron={false} />}
            {movers.up.map((s) => filaMover(s, true))}
          </ListaAgrupada>
          <ListaAgrupada titulo="Bajaron" meta={`A vs B · top ${movers.down.length}`} style={{ marginTop: 14 }} pie="Diferencia en pesos de cada SKU entre los dos períodos.">
            {!movers.down.length && <Fila titulo="Ningún SKU bajó" chevron={false} />}
            {movers.down.map((s) => filaMover(s, false))}
          </ListaAgrupada>
        </>
      ))}
    </div>
  );
}

/** Comparador con datos: mismo alcance que la web. */
export default function ComparadorM({ clienteKey = null, clienteNombre = null, clienteCodigo = null, nombre = 'Global', sensible = false, onSku, rd = null }) {
  const alcance = { clienteKey, clienteNombre, clienteCodigo };
  const { fact, med } = useComparadorBase(alcance);
  const [preset, setPreset] = useState('ytd');
  const [libre, setLibre] = useState(null);
  const [hoja, setHoja] = useState('A');            // 'A' | 'B' (se conserva al cerrar para que la hoja no cambie mientras sale)
  const [hojaAbierta, setHojaAbierta] = useState(false);
  const [moversAbierto, setMoversAbierto] = useState(false);
  const c = useMemo(() => comparar({ fact, med, preset, libre }), [fact, med, preset, libre]);
  const yearsKey = useMemo(() => Array.from(new Set(c.periodos.map((p) => p.anio))).sort().join(','), [c.periodos]);
  const { rows, cargando } = useComparadorSkus(alcance, yearsKey, moversAbierto);
  const movers = useMemo(() => moversDe(rows, c.periodos), [rows, c.periodos]);

  if (!fact) return <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={48} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div></div>;
  // Tocar un selector pasa a «Libre» partiendo de los períodos que se están viendo.
  const abrirPeriodo = (id) => {
    if (preset !== 'libre' && c.periodos.length >= 2) {
      const [a, b] = c.periodos;
      setLibre({ A: { anio: a.anio, desde: a.desde, hasta: a.hasta }, B: { anio: b.anio, desde: b.desde, hasta: b.hasta } });
      setPreset('libre');
    }
    setHoja(id); setHojaAbierta(true);
  };
  const onCopiar = async () => {
    const texto = textoResumen({ nombre, periodos: c.periodos, totales: c.totales, ocultarSensible: !sensible, fmt: money });
    if (texto && await copiar(texto)) toast.ok('Resumen copiado'); else toast.error('No se pudo copiar');
  };
  return (
    <>
      <ComparadorVista c={c} preset={preset} onPreset={setPreset} onPeriodo={abrirPeriodo} sensible={sensible} movers={movers} moversAbierto={moversAbierto} cargandoMovers={cargando}
        onMovers={() => setMoversAbierto(true)} onSku={onSku} onCopiar={onCopiar} rd={rd} />
      <HojaPeriodo abierto={hojaAbierta} id={hoja} periodo={c.libre?.[hoja]} anios={c.anios} onClose={() => setHojaAbierta(false)}
        onCambio={(patch) => setLibre((s) => ajustarLibre(s || c.libre, hoja, patch))} />
    </>
  );
}
