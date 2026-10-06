// Estrategia de Precios del celular (3.82.0 · 2026-10-05) · mockup aprobado `scratchpad/inventario-precios-movil.html` (pantalla 4).
// Hero inverso con la frase del negocio del mes (margen de la lista principal ponderado por venta · facturado debajo
// de lista · SKUs bajo el margen mínimo) + 2 KpiM → tarjeta Calculadora → «Propuesta en curso» (borrador real en
// propuestas_borradores) → push a la pantalla Propuesta (WhatsApp · Excel · Enviar).
// Datos: precios/datos.js#useDatosPrecios (roadmap, precios por lista, bajos, promos, cambios, costos sensibles) +
// v_sellin_global_sku_anio del año (venta por SKU para ponderar). Sin permiso sensible el hero habla de cambios de precio.
// Vista pura `PreciosVista` para SSR (scripts/test-precios-movil-ssr.mjs).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ClipboardList, X, ChevronRight, Tag } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { supabase } from '../../../lib/supabase';
import { fetchAllQ } from '../../../lib/queries';
import { puedeVerSensible } from '../../../lib/permisos';
import { usePreferencias, getPath } from '../../../lib/preferencias';
import FrescuraPill from '../../../components/FrescuraPill';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, Cabecera, Skeleton, Vacio, ListaAgrupada, Fila, HojaM, Pill, toast } from '../../piezas';
import { money, moneyCompact, int, MONO, N } from '../../util';
import { nombreCorto } from '../../../lib/whatsapp';
import { useDatosPrecios } from '../../../modules/comercial/precios/datos';
import { construirFilas, listasDeDatos } from '../../../modules/comercial/precios/calculo';
import { listaLbl } from '../../../modules/comercial/precios/textos';
import { MARGEN_MINIMO_DEFAULT, margenLineas } from '../../../modules/comercial/precios/calculadora';
import { resumenPrecios, lineaDesdeCalculo, descuentoLinea, LISTA_PRINCIPAL } from './calculo';
import { cargarEnCurso, guardarLineas, QK_PROPUESTAS, labelCliente, recordarEnCurso } from './propuesta';
import Calculadora from './Calculadora';
import PropuestaPrecios from './PropuestaPrecios';
import FichaProducto from '../../FichaProducto';

const STALE = 5 * 60 * 1000;
const fmtPct = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(d)} %`);
const fmt2 = (n) => `$${N(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** Venta por SKU del año (v_sellin_global_sku_anio, 1 página): para ponderar el margen del mes. */
function useVentaSkuAnio(anio) {
  return useQuery({
    queryKey: ['movil', 'precios', 'sku-anio', anio], staleTime: STALE, enabled: !!anio,
    queryFn: async () => {
      const rows = await fetchAllQ(() => supabase.from('v_sellin_global_sku_anio').select('sku,anio,monto').in('anio', [anio - 1, anio]), { pageSize: 5000, orderCol: 'sku', label: 'v_sellin_global_sku_anio' });
      return (rows || []).map((r) => ({ sku: r.sku, anio: Number(r.anio), monto: r.monto || [] }));
    },
  });
}

/**
 * Vista pura (sin red): hero + KPIs + calculadora + propuesta en curso.
 * @param {object} p.r            resumenPrecios()
 * @param {Array}  p.lineas       líneas del borrador en curso (forma canónica)
 */
export function PreciosVista({ r, sensible, catalogo, filasPorSku, costoDe, clienteKey, onCliente, margenMinimo, onMargenMinimo, lineas = [], onAgregar, onQuitar, onAbrirPropuesta, onCompartir, folio, cargando = false, skuInicial = null }) {
  const { theme } = useTheme();
  const [verBajo, setVerBajo] = useState(false);
  const mg = margenLineas(lineas.map((l) => ({ ...l, costo: sensible ? costoDe?.(l.sku) : 0 })));
  const pz = lineas.reduce((s, l) => s + N(l.piezas), 0);
  return (
    <>
      <HeroM eyebrow={`Estrategia de precios · ${r.mesUsado.label}`} frase={r.frase}
        sub={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{r.cambios.promos ? `${int(r.cambios.promos)} con promo este mes` : 'Calculadora de margen y descuento'}<FrescuraPill pantalla="estrategiaPrecios" inverso /></span>} />
      <KpiGrid style={{ marginTop: 10 }}>
        {sensible
          ? <KpiM eyebrow={`Margen ${listaLbl(r.margen.lista)}`} big={fmtPct(r.margen.pct)} bigColor={r.margen.pct == null ? undefined : r.margen.pct < r.margen.minimo ? theme.orange : theme.green} sub={r.margen.pct == null ? 'sin venta para ponderar' : `ponderado por venta · ${int(r.margen.bajoMinimo)} bajo el mínimo`} />
          : <KpiM eyebrow="Cambios de precio" big={int(r.cambios.total)} sub={r.cambios.total ? `${int(r.cambios.subieron)} subieron · ${int(r.cambios.bajaron)} bajaron` : 'ninguno este mes'} />}
        <KpiM eyebrow="Debajo de lista" big={r.bajo.skus ? moneyCompact(r.bajo.dejado) : '—'} bigColor={r.bajo.skus ? theme.orange : undefined} sub={r.bajo.skus ? `${int(r.bajo.skus)} SKUs · dejado en la mesa` : 'nadie facturó debajo de lista'} onClick={r.bajo.skus ? () => setVerBajo(true) : undefined} />
      </KpiGrid>

      <div style={{ marginTop: 14 }}>
        <Calculadora catalogo={catalogo} filasPorSku={filasPorSku} sensible={sensible} clienteKey={clienteKey} onCliente={onCliente} margenMinimo={margenMinimo} onMargenMinimo={onMargenMinimo} onAgregar={onAgregar} onCompartir={onCompartir} skuInicial={skuInicial} cargando={cargando} />
      </div>

      <ListaAgrupada titulo="Propuesta en curso" meta={lineas.length ? `${int(lineas.length)} SKU${lineas.length === 1 ? '' : 's'} · ${moneyCompact(mg.monto)}` : null}
        accion={lineas.length ? <button type="button" onClick={onAbrirPropuesta} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, cursor: 'pointer', padding: 0 }}>Abrir <ChevronRight size={14} /></button> : null}
        style={{ marginTop: 18 }}
        pie={lineas.length ? `${labelCliente(clienteKey)}${folio ? ` · ${folio}` : ' · borrador'} · se guarda en Propuestas` : null}>
        {lineas.length === 0 && <div style={{ padding: '18px 14px', fontSize: 12.5, color: theme.textMuted, lineHeight: 1.45, textAlign: 'center' }}>Lo que agregues desde la calculadora se vuelve una propuesta de verdad: aparece en Propuestas con su folio y de ahí sale el WhatsApp y el Excel.</div>}
        {lineas.map((l) => {
          const d = descuentoLinea(l);
          return (
            <Fila key={l.sku} chevron={false} titulo={<span><span style={{ fontFamily: TYPO.fontDisplay }}>{l.sku}</span>{l.descripcion ? <span style={{ color: theme.textMuted, fontWeight: 400 }}> · {nombreCorto(l.descripcion)}</span> : null}</span>}
              sub={`${int(l.piezas)} pz × ${fmt2(l.precio)}${d ? ` (−${d % 1 ? d.toFixed(1) : d} %)` : ''}${l.listaBase ? ` · ${listaLbl(l.listaBase)}` : ''}`}
              valor={money(N(l.piezas) * N(l.precio))}
              trailing={<button type="button" onClick={() => onQuitar?.(l.sku)} aria-label={`Quitar ${l.sku}`} style={{ width: 28, height: 28, borderRadius: 999, border: 0, background: `${theme.text}0A`, color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={14} /></button>} />
          );
        })}
        {lineas.length > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '10px 12px 12px', borderTop: `1px solid ${theme.border}` }}>
            <span style={{ fontSize: 12, color: theme.textMuted }}>{int(pz)} pz{sensible && mg.margenPct != null ? ` · margen ${fmtPct(mg.margenPct)} (${money(mg.utilidad)})` : ''}{sensible && mg.sinCosto ? ` · ${mg.sinCosto} sin costo` : ''}</span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums' }}>{money(mg.monto)}</span>
          </div>
        )}
      </ListaAgrupada>

      <HojaM abierto={verBajo} onClose={() => setVerBajo(false)} titulo="Facturado debajo de lista" sub={`${int(r.bajo.skus)} SKUs en el año · ${moneyCompact(r.bajo.dejado)} dejados en la mesa · los 20 más grandes`} alto="80vh">
        <ListaAgrupada pie="Cliente más bajo del año por SKU (≥ 50 pz) contra la lista que le corresponde; dejado = (lista − real) × piezas.">
          {r.bajo.top.map((b) => (
            <Fila key={b.sku} chevron={false} icon={Tag} color={theme.orange} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{b.sku}</span>}
              sub={`${b.cliente} · ${fmt2(b.real)} vs ${fmt2(b.precioLista)} ${listaLbl(b.lista)} · ${int(b.piezas)} pz`}
              valor={moneyCompact(b.dejado)} valorSub={`${b.difPct.toFixed(1)} %`} />
          ))}
        </ListaAgrupada>
      </HojaM>
    </>
  );
}

export default function EstrategiaPreciosM({ inicial = null }) {
  const { theme } = useTheme();
  const nav = useNav();
  const qc = useQueryClient();
  const sensible = puedeVerSensible(nav.perfil);
  const { prefs, setPreferencia } = usePreferencias();
  const margenMinimo = N(getPath(prefs, 'precios.margenMinimo', MARGEN_MINIMO_DEFAULT)) || MARGEN_MINIMO_DEFAULT;
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;

  const { roadmap, datos, loading, error } = useDatosPrecios(sensible);
  const { data: skuAnio } = useVentaSkuAnio(anio);

  const filas = useMemo(() => (datos ? construirFilas({ roadmap, precios: datos.precios, bajos: datos.bajos, promos: datos.promos, costos: sensible ? datos.costos : [], cambios: datos.cambios, listas: listasDeDatos(datos.precios) }) : []), [roadmap, datos, sensible]);
  const filasPorSku = useMemo(() => new Map(filas.map((f) => [f.sku, f])), [filas]);
  const costoDe = useCallback((sku) => N(filasPorSku.get(sku)?.costo), [filasPorSku]);
  const r = useMemo(() => resumenPrecios({ filas, skuAnio: skuAnio || [], anio, mes, margenMinimo, lista: LISTA_PRINCIPAL, sensible }), [filas, skuAnio, anio, mes, margenMinimo, sensible]);

  // ── Propuesta en curso (borrador real) ──
  const [modelo, setModelo] = useState(null);
  const [clienteKey, setClienteKey] = useState(inicial?.clienteKey || 'digitalife');
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { let vivo = true; cargarEnCurso().then((m) => { if (vivo && m) { setModelo(m); setClienteKey(m.clienteKey || 'digitalife'); } }); return () => { vivo = false; }; }, []);
  const lineas = modelo?.lineas || [];

  const persistir = async (nuevas, ck = clienteKey) => {
    setGuardando(true);
    try {
      if (!nuevas.length && modelo) { recordarEnCurso(null); }
      const m = await guardarLineas({ modelo, clienteKey: ck, lineas: nuevas, perfil: nav.perfil });
      setModelo(m);
      qc.invalidateQueries({ queryKey: QK_PROPUESTAS });
      return m;
    } catch (e) { toast.error(`No se pudo guardar la propuesta: ${e?.message || e}`); return null; }
    finally { setGuardando(false); }
  };
  const onAgregar = async (c) => {
    const l = lineaDesdeCalculo(c);
    const nuevas = [...lineas.filter((x) => x.sku !== l.sku), l];
    const m = await persistir(nuevas);
    if (m) toast.ok(`${l.sku} en la propuesta · ${m.folio || 'borrador'}`);
  };
  const onQuitar = (sku) => persistir(lineas.filter((x) => x.sku !== sku));
  const onCliente = (ck) => {
    if (ck === clienteKey) return;
    setClienteKey(ck);
    if (lineas.length) persistir(lineas, ck);
  };
  const onAbrirPropuesta = () => { if (modelo?.id) nav.push(<PropuestaPrecios id={modelo.id} onCambio={(m) => setModelo(m?.estado === 'borrador' ? m : null)} />, `propuesta-precios-${modelo.id}`, 'estrategiaPrecios'); };
  const onCompartir = (sku, lista) => { nav.agregarSku(sku); nav.push(<FichaProducto listaInicial={lista || null} />, 'ficha', 'estrategiaPrecios'); };

  const sub = <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>Calculadora de margen y descuento{guardando && <Pill tone="gray" size="xs">Guardando…</Pill>}</span>;

  if (error) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Estrategia de precios" sub={sub} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudieron cargar los precios" sub={error.message} /></>);
  if (loading && !datos) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Estrategia de precios" sub={sub} /><div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={220} r={12} /></div></>);
  }
  if (!filas.length) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Estrategia de precios" sub={sub} /><Vacio icon={ClipboardList} color={theme.textMuted} titulo="Sin precios cargados" sub="El puente carga precios_sku cada hora; vuelve a intentarlo en un rato." /></>);

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Estrategia de precios" sub={sub} />
      <PreciosVista r={r} sensible={sensible} catalogo={roadmap} filasPorSku={filasPorSku} costoDe={costoDe} clienteKey={clienteKey} onCliente={onCliente} margenMinimo={margenMinimo} onMargenMinimo={(n) => setPreferencia('precios.margenMinimo', n)}
        lineas={lineas} onAgregar={onAgregar} onQuitar={onQuitar} onAbrirPropuesta={onAbrirPropuesta} onCompartir={onCompartir} folio={modelo?.folio} cargando={loading} skuInicial={inicial?.sku || null} />
      <div style={{ padding: '14px 16px 0', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, lineHeight: 1.4, textAlign: 'center', fontFamily: MONO }}>{sensible ? 'Costo promedio = [Costo Promedio] del director · margen = (neto − costo) / neto' : 'Precios de lista sin IVA'}</div>
    </>
  );
}
