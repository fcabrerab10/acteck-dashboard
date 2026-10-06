// Pestañas Sell In y Sell Out de la página móvil de un cliente del ERP (3.79.0 · 2026-10-05, mockup
// scratchpad/analisis-movil.html pantallas 3, 4 y 4b) + piezas que comparte el Resumen (MovimientoM, CuotasTrimestreM).
//   Sell In  → Segmented Piezas · $ que manda en TODO el bloque (zoom diario, evolución 12 m, detalle por SKU × 12 m),
//              cuotas por trimestre; tocar un SKU abre su ficha de producto.
//   Sell Out → cuenta ligada por CUENTA_POR_ERP. Comunes: 2 KpiM, zoom diario (mv_sellout_cuenta_dia), evolución 12 m.
//              Después SÓLO los bloques que la cuenta alimenta (sellout/BloquesCuenta.jsx: RECETAS · bloquesDe), en orden:
//              Dónde está el movimiento · Dónde vende · Sucursales · Vendedores · Clientes finales · Detalle por SKU.
//              La nota de cobertura de la receta va en una tarjeta chica; sin cuenta → «no reporta sell out».
//              Tocar una sucursal o un vendedor abre HojaM con sus SKUs del mes. Al final «Abrir sell out completo»
//              → CuentaFrenteAlResto. Todos los cálculos son los de la web (sellout/calculo.js, analisis/*).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShoppingBag } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { useNav } from '../../nav';
import { KpiM, KpiGrid, Skeleton, Vacio, CampoBusqueda, Segmented, BotonGrande, TituloSeccionM, ListaAgrupada, Fila, HojaM, MiniTrazo, GraficaScrub, LeyendaScrub, Pill } from '../../piezas';
import { moneyCompact, int, deltaPct, MESES, N, pct } from '../../util';
import TablaAnual from '../sellout/TablaAnual';
import { catalogoSkus } from '../SellInCliente';
import FichaProducto from '../../FichaProducto';
import { useCuentas, useDias, useMensual, useCuotas, useDrillSkus, useDrillSucursales, useDrillVendedores, useDrillClientesFinales, useDrillEstados, CUENTA_POR_ERP } from '../../../modules/comercial/sellout/datos';
import { construirFilas, ultimoDiaConVenta, ultimoMesConVenta as ultimoMesSellOut, skusDeCuenta, agregarDimension, clientesFinalesDelMes, porEstado, ultimosMeses as ultimosMesesSO, idxMes, yoy as yoyDe } from '../../../modules/comercial/sellout/calculo';
import { capitalizarEstado } from '../../../modules/comercial/sellout/textos';
import { bloquesDe } from '../../../modules/comercial/sellout/BloquesCuenta';
import { GraficaLineas } from '../../../components/kit';
import { patronMes } from '../../../modules/comercial/analisis/ZoomDiario';
import { cuotasPorTrimestre } from '../../../modules/comercial/analisis/CuotasTrimestre';
import { movimientos } from '../../../modules/comercial/analisis/movimiento';
import { mapaCuotas, cuotaPeriodo, alcanceCuota, yoyDe as yoyCalc, idxMes as idxSi } from '../../../modules/comercial/analisis/calc';
import { useSkusDimension } from './datos';
import { fraccionMes } from './calculo';
import CuentaFrenteAlResto from './CuentaFrenteAlResto';

const STALE = 5 * 60 * 1000;
const fmtPz = (n) => Math.round(N(n)).toLocaleString('es-MX');
const fmtDe = (unidad) => (unidad === 'piezas' ? fmtPz : moneyCompact);
const seg = (style) => ({ margin: '14px 0 0', padding: '0 28px 6px', ...style });
const SEG_UNIDAD = [{ id: 'piezas', label: 'Piezas' }, { id: 'monto', label: '$' }];

// ── Zoom por día del mes (mismo motor que la web: patronMes) ──
export function ZoomDiarioM({ titulo, filas, anio, mes, cargando, formato = moneyCompact, hoy = new Date() }) {
  const { theme } = useTheme();
  const cur = useMemo(() => patronMes(filas, anio, mes), [filas, anio, mes]);
  const prev = useMemo(() => patronMes(filas, anio - 1, mes), [filas, anio, mes]);
  const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1; const diaHoy = enCurso ? hoy.getDate() : cur.diasMes;
  const datos = cur.porDia.map((d, i) => ({ x: String(d.dia), dia: d.dia <= diaHoy ? d.valor : null, acum: d.dia <= diaHoy ? d.acum : null, prev: prev.porDia[i]?.acum ?? null }));
  const tono = cur.pctUlt5 == null ? 'gray' : cur.pctUlt5 >= 50 ? 'red' : cur.pctUlt5 >= 35 ? 'orange' : 'green';
  return (
    <>
      <TituloSeccionM style={seg()} meta={`${MESES[mes - 1]} ${anio}`}>{titulo}</TituloSeccionM>
      <div style={{ margin: '0 16px', padding: '8px 8px 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12 }}>
        {cargando ? <Skeleton h={120} r={8} /> : (
          <>
            <GraficaLineas compacto alto={150} datos={datos} formato={formato}
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
export function CuotasTrimestreM({ mensual, cuotasRows = [], codigo, anio, mes }) {
  const qs = useMemo(() => cuotasPorTrimestre(mensual, mapaCuotas(cuotasRows), codigo, anio, mes), [mensual, cuotasRows, codigo, anio, mes]);
  const logrados = qs.filter((q) => q.logrado === true).length, cerrados = qs.filter((q) => q.cerrado).length;
  return (
    <>
      <TituloSeccionM style={seg({ margin: '18px 0 0' })} meta={qs.some((q) => q.cuota) ? `${logrados} de ${cerrados} logrados` : 'sin cuota'}>Cuotas por trimestre</TituloSeccionM>
      <KpiGrid>
        {qs.map((q) => {
          const tone = q.pct == null ? 'gray' : q.pct >= 100 ? 'green' : q.pct >= 85 ? 'blue' : q.pct >= 60 ? 'orange' : 'red';
          return <KpiM key={q.q} eyebrow={`Q${q.q} · ${q.futuro ? 'por venir' : q.enCurso ? 'en curso' : q.logrado ? 'logrado' : q.cuota ? 'no logrado' : 'cerrado'}`} big={q.futuro ? '—' : moneyCompact(q.venta)} sub={q.cuota ? `de ${moneyCompact(q.cuota)}${q.yoy != null && !q.futuro ? ` · ${deltaPct(q.yoy)} vs ${anio - 1}` : ''}` : 'sin cuota'} progress={q.cuota && !q.futuro ? q.pct : undefined} pill={q.cuota && !q.futuro ? { tone, label: `${Math.round(q.pct)}%` } : undefined} />;
        })}
      </KpiGrid>
    </>
  );
}

// ── «Dónde está el movimiento» / «Qué cambió este mes» (movimiento.js) ──
export function MovimientoM({ titulo = 'Dónde está el movimiento', movs, meta, nota, onSku }) {
  const { theme } = useTheme();
  const tonoTipo = { SKU: 'blue', Sucursal: 'purple', 'Cliente final': 'gray', Categoría: 'orange', Vendedor: 'green' };
  return (
    <ListaAgrupada titulo={titulo} meta={meta} style={{ marginTop: 18 }} pie={nota}>
      {!movs?.filas?.length && <Vacio icon={null} titulo="Sin movimientos relevantes" sub="Nada cambió más de $1,000 contra el mes anterior." style={{ padding: 16 }} />}
      {(movs?.filas || []).map((f) => (
        <Fila key={`${f.tipo}-${f.clave}`} chevron={false} onClick={f.tipo === 'SKU' && onSku ? () => onSku(f.clave) : undefined}
          titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%' }}>{f.tipo !== 'SKU' && <Pill tone={tonoTipo[f.tipo] || 'gray'} size="xs">{f.tipo}</Pill>}<span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{f.tipo === 'SKU' && f.etiqueta ? `${f.etiqueta} (${f.clave})` : f.clave}</span></span>}
          sub={f.explicacion || `${moneyCompact(f.prev)} → ${moneyCompact(f.act)}`}
          valor={<span style={{ color: f.delta >= 0 ? theme.green : theme.red }}>{f.delta >= 0 ? '+' : '−'}{moneyCompact(Math.abs(f.delta))}</span>} />
      ))}
    </ListaAgrupada>
  );
}

// ── Detalle por SKU × 12 meses (TablaAnual) con Piezas · $ y buscador ──
function DetalleSkuM({ titulo = 'Detalle por SKU', filas, meses, unidad, busca, onBusca, onSku, pie, cargando, placeholder = 'SKU o descripción' }) {
  const { theme } = useTheme();
  const q = busca.trim().toUpperCase();
  const visibles = filas.filter((f) => !q || f.sku.toUpperCase().includes(q) || String(f.descripcion || '').toUpperCase().includes(q) || String(f.sub || '').toUpperCase().includes(q)).slice(0, 80);
  return (
    <>
      <TituloSeccionM style={seg({ margin: '18px 0 0' })} meta={`${filas.length} SKUs · 12 meses`}>{titulo}</TituloSeccionM>
      <div style={{ padding: '0 16px 8px' }}><CampoBusqueda value={busca} onChange={onBusca} placeholder={placeholder} /></div>
      <div style={{ padding: '0 16px' }}>
        {cargando ? <Skeleton h={160} r={12} /> : !filas.length ? <Vacio icon={null} titulo="Sin movimiento en los últimos 12 meses" /> : (
          <TablaAnual columnas={meses} filas={visibles.map((f) => ({ ...f, label: f.sku, onClick: onSku ? () => onSku(f.sku) : undefined }))} fmt={fmtDe(unidad)}
            etiquetaFilas={filas.length > 80 ? 'top 80' : ''} totalLabel="Total" vacio="Ningún SKU coincide." />
        )}
        {pie && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>{pie}</div>}
      </div>
    </>
  );
}

// ── Evolución 12 meses (GraficaScrub: este año vs el anterior) ──
function Evolucion12M({ titulo, datos, unidad, anio, color, pie }) {
  const { theme } = useTheme();
  const gris = theme.textSubtle || theme.textMuted;
  const f = fmtDe(unidad);
  return (
    <>
      <TituloSeccionM style={seg({ margin: '18px 0 0' })} meta="arrastra para leer">{titulo}</TituloSeccionM>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
        <GraficaScrub datos={datos} formato={f} series={[{ key: 'prev', label: 'año anterior', color: gris }, { key: 'v', label: 'este año', color, area: true, grosor: 2.6 }]}
          tooltip={(d) => <><b style={{ fontSize: 12.5 }}>{d.label}</b> · <b style={{ fontSize: 12.5 }}>{d.v != null ? f(d.v) : '—'}</b>{d.prev != null ? ` · ${d.anioPrev} ${f(d.prev)}` : ''}{d.yoy != null ? <> · <span style={{ color: d.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(d.yoy)}</span></> : null}</>} />
        <LeyendaScrub items={[{ label: 'últimos 12 meses', color }, { label: 'mismo mes del año anterior', color: gris }]} derecha={pie} />
      </div>
    </>
  );
}

/** Serie de 12 meses (hasta anio/mes) desde un Map idx → valor y la misma de 12 meses antes. */
function serie12De(get, anio, mes) {
  return ultimosMesesSO(anio, mes, 12).map((m) => {
    const k = idxMes(m.anio, m.mes), v = get(k), prev = get(k - 12);
    return { label: `${MESES[m.mes - 1]}${m.mes === 1 ? ` ${String(m.anio).slice(2)}` : ''}`, v, prev, anioPrev: m.anio - 1, yoy: yoyDe(v, prev) };
  });
}

// ───────────────────────────── Sell In ─────────────────────────────
/** Vista pura (sin red). mensual = Map idx → { fact_neta, piezas, contribucion… } · detalle = mv_analisis_cliente_sku_mes. */
export function SellInVista({ codigo, mensual, detalle = [], diario = [], cuotasRows = [], anio, mes, sensible = false, rd = new Map(), cargandoDia = false, cargandoDetalle = false, onSku, hoy = new Date() }) {
  const { theme } = useTheme();
  const [unidad, setUnidad] = useState('monto');
  const [busca, setBusca] = useState('');
  const campo = unidad === 'piezas' ? 'piezas' : 'fact_neta';
  const kMes = idxSi(anio, mes), factor = fraccionMes(anio, mes, hoy);
  const get = (k) => N(mensual.get(k)?.[campo]);
  const mtd = get(kMes), mtdPrev = get(kMes - 12) * factor;
  const ytd = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + N(a[campo]), 0);
  const ytdPrev = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio - 1 && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + N(a[campo]), 0) - get(kMes - 12) * (1 - factor);
  const ytdMonto = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + N(a.fact_neta), 0);
  const contribYtd = [...mensual.entries()].filter(([k]) => Math.floor(k / 12) === anio && (k % 12) + 1 <= mes).reduce((s, [, a]) => s + N(a.contribucion), 0);
  const mapa = useMemo(() => mapaCuotas(cuotasRows), [cuotasRows]);
  const cuotaYtd = cuotaPeriodo(mapa, codigo, anio, mes, 'ytd'), pctYtd = alcanceCuota(ytdMonto, cuotaYtd);
  const f = fmtDe(unidad);
  const meses = useMemo(() => ultimosMesesSO(anio, mes, 12), [anio, mes]);
  const porSku = useMemo(() => {
    const idx = new Map(meses.map((m, i) => [idxMes(m.anio, m.mes), i]));
    const by = new Map();
    for (const r of detalle) {
      const i = idx.get(idxMes(N(r.anio), N(r.mes))); if (i == null || !r.articulo) continue;
      const o = by.get(r.articulo) || { sku: r.articulo, piezas: Array(12).fill(0), monto: Array(12).fill(0) };
      o.piezas[i] += N(r.piezas_venta_neta); o.monto[i] += N(r.fact_neta); by.set(r.articulo, o);
    }
    return [...by.values()].map((o) => ({ ...o, totMonto: o.monto.reduce((s, v) => s + v, 0), descripcion: rd.get(o.sku)?.descripcion || '', sub: rd.get(o.sku)?.descripcion || rd.get(o.sku)?.marca || '', valores: unidad === 'piezas' ? o.piezas : o.monto })).sort((a, b) => b.totMonto - a.totMonto);
  }, [detalle, meses, rd, unidad]);
  const evol = useMemo(() => serie12De(get, anio, mes), [mensual, anio, mes, campo]); // eslint-disable-line react-hooks/exhaustive-deps
  const mesL = MESES[mes - 1];
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 20px 10px' }}>
        <span style={{ fontSize: 12.5, color: theme.textMuted }}>Todo el bloque en</span>
        <Segmented value={unidad} onChange={setUnidad} options={SEG_UNIDAD} />
      </div>
      <KpiGrid data-entrada-kpis>
        <KpiM eyebrow={`${mesL} a mismo día`} big={f(mtd)} sub={mtdPrev > 0 ? <><span style={{ color: mtd >= mtdPrev ? theme.green : theme.red }}>{deltaPct(yoyCalc(mtd, mtdPrev))}</span> vs {anio - 1}</> : `sin ${anio - 1}`} />
        <KpiM eyebrow={`YTD ${anio}`} big={f(ytd)} sub={<>{ytdPrev > 0 ? <><span style={{ color: ytd >= ytdPrev ? theme.green : theme.red }}>{deltaPct(yoyCalc(ytd, ytdPrev))}</span></> : `sin ${anio - 1}`}{pctYtd != null ? ` · ${Math.round(pctYtd)} % de cuota` : ''}</>} />
        {sensible && <KpiM eyebrow="MC % · YTD" big={ytdMonto ? pct((contribYtd / ytdMonto) * 100, 1) : '—'} sub={`contribución ${moneyCompact(contribYtd)}`} />}
      </KpiGrid>
      {codigo && <ZoomDiarioM titulo="Sell in por día" filas={diario.map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: unidad === 'piezas' ? r.piezas : r.fact_neta }))} anio={anio} mes={mes} cargando={cargandoDia} formato={f} hoy={hoy} />}
      {codigo && <CuotasTrimestreM mensual={mensual} cuotasRows={cuotasRows} codigo={codigo} anio={anio} mes={mes} />}
      <Evolucion12M titulo="Evolución · 12 meses" datos={evol} unidad={unidad} anio={anio} color={theme.accent} />
      <DetalleSkuM titulo="Productos · 12 meses" filas={porSku} meses={meses.map((m) => `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`)} unidad={unidad} busca={busca} onBusca={setBusca} onSku={onSku} cargando={cargandoDetalle}
        pie={<>{unidad === 'piezas' ? 'Piezas' : 'Fact. neta'} por mes de lo que nos compra este cliente · <strong>Prom</strong> = promedio de los meses con compra. Toca un SKU para ver disponibilidad y precios.</>} />
    </>
  );
}

export function SellInM({ codigo, mensual, detalle, diario, cuotasRows, anio, mes, sensible, rd }) {
  const nav = useNav();
  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  return <SellInVista codigo={codigo} mensual={mensual} detalle={detalle} diario={diario} cuotasRows={cuotasRows} anio={anio} mes={mes} sensible={sensible} rd={rd} onSku={abrirSku} />;
}

// ───────────────────────────── Sell Out ─────────────────────────────
/** Hoja con los SKUs del mes de una sucursal o un vendedor (consulta sólo al abrir). */
function HojaDimension({ cuenta, anio, mes, campo, item, onClose }) {
  const { theme } = useTheme();
  const { data: skus = [], isLoading } = useSkusDimension(cuenta, anio, mes, campo, item?.clave, !!item);
  const lista = skus.slice(0, 40);
  const { data: cat } = useQuery({ queryKey: ['movil', 'analisis-cat', lista.map((s) => s.sku).join(',')], staleTime: STALE, enabled: lista.length > 0, queryFn: () => catalogoSkus(lista.map((s) => s.sku)) });
  const total = skus.reduce((s, x) => s + x.importe, 0);
  return (
    <HojaM abierto={!!item} onClose={onClose} titulo={item?.clave || ''} sub={item ? `${MESES[mes - 1]} ${anio} · ${moneyCompact(item.importe)}${item.yoy != null ? ` · ${deltaPct(item.yoy)} vs ${anio - 1}` : ''}${item.vendedores ? ` · ${int(item.vendedores)} vendedores` : ''}${item.clientes ? ` · ${int(item.clientes)} clientes` : ''}` : ''} alto="80vh">
      {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={200} r={12} /></div>}
      {!isLoading && <ListaAgrupada titulo="SKUs del mes" meta={`${skus.length}`} pie="Importe sin IVA y piezas de lo que vendió en el mes.">
        {!lista.length && <Vacio icon={null} titulo="Sin SKUs en el mes" style={{ padding: 16 }} />}
        {lista.map((s) => <Fila key={s.sku} titulo={s.sku} sub={cat?.get(s.sku)?.descripcion || ''} valor={moneyCompact(s.importe)} valorSub={`${fmtPz(s.cantidad)} pz · ${total ? Math.round((s.importe / total) * 100) : 0}%`} chevron={false} />)}
      </ListaAgrupada>}
      <div style={{ height: 24 }} />
    </HojaM>
  );
}

/** Lista de sucursales o vendedores (agregarDimension): nombre, mini trazo 6 m, monto y Δ. */
function DimensionM({ titulo, filas, anio, mes, onTocar, sub, cargando, vacio }) {
  const { theme } = useTheme();
  const conVenta = filas.filter((f) => f.importe > 0).length;
  return (
    <ListaAgrupada titulo={titulo} meta={`${conVenta} con venta${filas.length > conVenta ? ` · ${filas.length - conVenta} sin` : ''}`} style={{ marginTop: 18 }} pie={`${MESES[mes - 1]} ${anio} · Δ contra el mismo mes de ${anio - 1} · trazo = 6 meses. Toca para ver sus SKUs.`}>
      {cargando && <div style={{ padding: 12 }}><Skeleton h={120} r={8} /></div>}
      {!cargando && !filas.length && <Vacio icon={null} titulo={vacio} style={{ padding: 16 }} />}
      {!cargando && filas.slice(0, 25).map((f) => (
        <Fila key={f.clave} titulo={f.clave} sub={sub ? sub(f) : undefined} chevron={false} onClick={onTocar ? () => onTocar(f) : undefined}
          trailing={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}><MiniTrazo puntos={f.tendencia} color={f.yoy == null ? theme.textMuted : f.yoy >= 0 ? theme.green : theme.red} /><span style={{ textAlign: 'right' }}><span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.text }}>{moneyCompact(f.importe)}</span><span style={{ display: 'block', fontSize: 11, color: f.yoy == null ? theme.textMuted : f.yoy >= 0 ? theme.green : theme.red, fontVariantNumeric: 'tabular-nums' }}>{f.yoy != null ? deltaPct(f.yoy) : 'nuevo'}</span></span></span>} />
      ))}
    </ListaAgrupada>
  );
}

/** Vista pura del Sell Out de una cuenta (sin red): la prueba scripts/test-analisis-movil-ssr.mjs. */
export function SellOutVista({ cuenta, nombre, fila, bloques, nota, anio, mes, dias = [], mensualCuenta = [], skus = [], suc = [], ven = [], cf = [], edo = [], rd = new Map(), cargando = {}, onSku, onDimension, onCompleto, hoy = new Date() }) {
  const { theme } = useTheme();
  const [unidad, setUnidad] = useState('monto');
  const [busca, setBusca] = useState('');
  const mesL = MESES[mes - 1];
  const morado = theme.purple || theme.indigo || theme.accent;
  const campo = unidad === 'piezas' ? 'cantidad' : 'importe';
  const f = fmtDe(unidad);
  const evol = useMemo(() => { const m = new Map(); mensualCuenta.forEach((r) => m.set(idxMes(N(r.anio), N(r.mes)), N(r[campo]))); return serie12De((k) => (m.has(k) ? m.get(k) : null), anio, mes); }, [mensualCuenta, anio, mes, campo]);
  const hoyM = new Date();
  const pocoMes = anio === hoyM.getFullYear() && mes === hoyM.getMonth() + 1 && hoyM.getDate() < 10;
  const [mAnio, mMes] = pocoMes ? (mes === 1 ? [anio - 1, 12] : [anio, mes - 1]) : [anio, mes];
  const movs = useMemo(() => ({ ...movimientos({
    grupos: [
      { tipo: 'SKU', filas: skus, clave: 'sku', valor: 'importe', piezas: 'cantidad', etiqueta: (k) => rd.get(k)?.descripcion || '' },
      ...(bloques.includes('sucursales') ? [{ tipo: 'Sucursal', filas: suc, clave: 'sucursal', valor: 'importe', piezas: 'cantidad' }] : []),
      ...(bloques.includes('clientes') ? [{ tipo: 'Cliente final', filas: cf, clave: 'cliente_final', valor: 'importe', piezas: 'cantidad' }] : []),
    ], anio: mAnio, mes: mMes, top: 6,
  }), mesLbl: MESES[mMes - 1].toLowerCase() }), [skus, suc, cf, bloques, rd, mAnio, mMes]);
  const estados = useMemo(() => porEstado(edo, anio, mes).filter((e) => e.estado !== 'SIN ESTADO' && e.importe > 0).slice(0, 8), [edo, anio, mes]);
  const totalEdo = estados.reduce((s, e) => s + e.importe, 0), maxEdo = Math.max(1, ...estados.map((e) => e.importe));
  const sucursales = useMemo(() => agregarDimension(suc, 'sucursal', anio, mes), [suc, anio, mes]);
  const vendedores = useMemo(() => agregarDimension(ven, 'vendedor', anio, mes), [ven, anio, mes]);
  const clientes = useMemo(() => clientesFinalesDelMes(cf, anio, mes), [cf, anio, mes]);
  const filasSku = useMemo(() => skusDeCuenta(skus, [], anio, mes, unidad === 'piezas' ? 'piezas' : 'importe').map((s) => ({ ...s, descripcion: rd.get(s.sku)?.descripcion || '', sub: rd.get(s.sku)?.descripcion || [s.marca, s.categoria].filter(Boolean).join(' · '), valores: s.meses })), [skus, anio, mes, unidad, rd]);
  const meses12 = ultimosMesesSO(anio, mes, 12).map((m) => `${MESES[m.mes - 1]}${m.anio !== anio ? ` ${String(m.anio).slice(2)}` : ''}`);
  const dimsTxt = ['SKU', bloques.includes('sucursales') ? 'sucursal' : null, bloques.includes('clientes') ? 'cliente final' : null].filter(Boolean).join(' · ');
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '4px 20px 10px' }}>
        <span style={{ fontSize: 12.5, color: theme.textMuted }}>{mesL} {anio} · todo el bloque en</span>
        <Segmented value={unidad} onChange={setUnidad} options={SEG_UNIDAD} />
      </div>
      <KpiGrid data-entrada-kpis>
        <KpiM eyebrow={`Sell out · ${mesL.toLowerCase()}`} big={f(unidad === 'piezas' ? fila.cantidad : fila.importe)} sub={<>{fila.yoy != null ? <><span style={{ color: fila.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(fila.yoy)}</span> vs {anio - 1}</> : `sin ${anio - 1}`}{fila.soSi != null ? ` · SO/SI ${(fila.soSi / 100).toFixed(2)}` : ''}</>} />
        <KpiM eyebrow={`Inventario en ${nombre.split(' ')[0]}`} big={fila.invPiezas != null ? (fila.invSemanas != null ? `${Math.round(fila.invSemanas)} sem` : `${fmtPz(fila.invPiezas)} pz`) : '—'} sub={fila.invPiezas != null ? `${fmtPz(fila.invPiezas)} pz${fila.invValor ? ` · ${moneyCompact(fila.invValor)}` : ''}` : 'no reporta inventario'} />
      </KpiGrid>
      {nota && <div style={{ margin: '10px 16px 0', padding: '10px 12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontSize: 11.5, color: theme.textMuted, lineHeight: 1.45 }}>{nota}</div>}
      <ZoomDiarioM titulo="Sell out por día" filas={dias.map((r) => ({ anio: r.anio, mes: r.mes, dia: r.dia, valor: r[campo] }))} anio={anio} mes={mes} formato={f} cargando={cargando.dias} hoy={hoy} />
      <Evolucion12M titulo="Evolución · 12 meses" datos={evol} unidad={unidad} anio={anio} color={morado} />
      {bloques.includes('cambios') && <MovimientoM titulo="Dónde está el movimiento" movs={movs} meta={`${movs.mesLbl} vs ${movs.mesPrevLbl} · ${dimsTxt}`} nota="Mayores subidas y bajadas en pesos contra el mes anterior." onSku={onSku} />}
      {bloques.includes('mapa') && (
        <ListaAgrupada titulo="Dónde vende" meta={`por estado · ${mesL.toLowerCase()}`} style={{ marginTop: 18 }} pie="% del sell out del mes con estado; Δ contra el mismo mes del año anterior.">
          {cargando.edo && <div style={{ padding: 12 }}><Skeleton h={120} r={8} /></div>}
          {!cargando.edo && !estados.length && <Vacio icon={null} titulo="Sin estado en este mes" style={{ padding: 16 }} />}
          {!cargando.edo && estados.map((e) => (
            <div key={e.estado} style={{ display: 'grid', gridTemplateColumns: '96px minmax(0,1fr) 44px 52px', gap: 8, alignItems: 'center', padding: '9px 12px', fontSize: 12.5, fontFamily: TYPO.fontText }}>
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }}>{capitalizarEstado(e.estado)}</span>
              <span style={{ display: 'block', height: 10, borderRadius: 3, background: `${theme.text}10`, overflow: 'hidden' }}><span style={{ display: 'block', height: '100%', width: `${(e.importe / maxEdo) * 100}%`, background: morado, borderRadius: 3 }} /></span>
              <span style={{ textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: theme.text }}>{totalEdo ? `${Math.round((e.importe / totalEdo) * 100)}%` : '—'}</span>
              <span style={{ textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: e.yoy == null ? theme.textMuted : e.yoy >= 0 ? theme.green : theme.red }}>{e.yoy != null ? deltaPct(e.yoy) : '—'}</span>
            </div>
          ))}
        </ListaAgrupada>
      )}
      {bloques.includes('sucursales') && <DimensionM titulo="Sucursales" filas={sucursales} anio={anio} mes={mes} cargando={cargando.suc} vacio="Esta cuenta no reporta sucursales" sub={(x) => [x.vendedores ? `${int(x.vendedores)} vendedores` : null, x.top_vendedor || null].filter(Boolean).join(' · ') || undefined} onTocar={onDimension ? (x) => onDimension('sucursal', x) : undefined} />}
      {bloques.includes('vendedores') && <DimensionM titulo="Vendedores" filas={vendedores} anio={anio} mes={mes} cargando={cargando.ven} vacio="Esta cuenta no reporta vendedores" sub={(x) => [x.clientes ? `${int(x.clientes)} clientes` : null, x.skus ? `${int(x.skus)} SKUs` : null].filter(Boolean).join(' · ') || undefined} onTocar={onDimension ? (x) => onDimension('vendedor_nombre', x) : undefined} />}
      {bloques.includes('clientes') && (
        <ListaAgrupada titulo="Clientes finales" meta={`${int(clientes.activos)} en ${mesL.toLowerCase()} · ${int(clientes.nuevos)} nuevos · ${int(clientes.perdidos)} perdidos`} style={{ marginTop: 18 }} pie="Nuevos y perdidos contra el mes anterior; los 8 de más venta del mes.">
          {cargando.cf && <div style={{ padding: 12 }}><Skeleton h={120} r={8} /></div>}
          {!cargando.cf && !clientes.filas.length && <Vacio icon={null} titulo="Esta cuenta no reporta cliente final" style={{ padding: 16 }} />}
          {!cargando.cf && clientes.filas.filter((c) => !c.perdido).slice(0, 8).map((c) => (
            <Fila key={c.cliente_final} titulo={c.cliente_final} sub={[c.estado ? capitalizarEstado(c.estado) : null, c.facturas ? `${int(c.facturas)} facturas` : null].filter(Boolean).join(' · ') || undefined} valor={moneyCompact(c.importe)} chevron={false}
              pill={c.nuevo ? { tone: 'green', label: 'nuevo' } : { tone: 'gray', label: 'recurrente' }} />
          ))}
        </ListaAgrupada>
      )}
      {bloques.includes('skus') && <DetalleSkuM titulo="Detalle por SKU · 12 m" filas={filasSku} meses={meses12} unidad={unidad} busca={busca} onBusca={setBusca} onSku={onSku} cargando={cargando.skus} placeholder="SKU, marca o categoría"
        pie={<>{unidad === 'piezas' ? 'Piezas' : 'Importe sin IVA'} por mes de lo que esta cuenta vendió · <strong>Prom</strong> = promedio de los meses con venta. Toca un SKU para abrir su ficha.</>} />}
      {onCompleto && (
        <div style={{ padding: '18px 16px 0' }}>
          <BotonGrande primario icon={ShoppingBag} onClick={onCompleto}>Abrir sell out completo</BotonGrande>
          <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '8px 4px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>{nombre} frente al resto: ranking de las 17 cuentas, peso en su canal, SO/SI contra el promedio y los SKUs que mueven sus pares y aquí faltan.</div>
        </div>
      )}
    </>
  );
}

export function SellOutM({ codigo, nombre, anio, propio, clienteKey }) {
  const nav = useNav();
  const cuenta = codigo ? (CUENTA_POR_ERP[codigo] || null) : null;
  const { data: cuentas = [] } = useCuentas();
  const { data: dias = [], isLoading: lDias } = useDias(cuenta ? anio : null);
  const { data: mensual = [], isLoading: lMes } = useMensual(cuenta ? anio : null);
  const { data: cuotas = [] } = useCuotas(cuenta ? anio : null);
  const [dim, setDim] = useState(null); // { campo, item }

  // Mes = el último con sell out de ESTA cuenta en el año (como la web). Dimensiones = lo que la fuente trajo en cualquier mes del año.
  const propios = useMemo(() => mensual.filter((r) => r.cuenta === cuenta && N(r.anio) === anio), [mensual, cuenta, anio]);
  const mes = useMemo(() => {
    const con = propios.filter((r) => N(r.importe) > 0).map((r) => N(r.mes));
    if (con.length) return Math.max(...con);
    const u = ultimoMesSellOut(dias);
    return u && u.anio === anio ? u.mes : (anio === new Date().getFullYear() ? new Date().getMonth() + 1 : 12);
  }, [propios, dias, anio]);
  const corteDia = useMemo(() => ultimoDiaConVenta(dias, anio, mes) || 31, [dias, anio, mes]);
  const fila = useMemo(() => {
    const fl = construirFilas({ cuentas, mensual, dias, anio, mes, corteDia, cuotas }).find((x) => x.cuenta === cuenta);
    if (!fl) return null;
    const hay = (k) => propios.some((r) => r[k] != null);
    return { ...fl, sucursales: hay('sucursales') ? (fl.sucursales ?? 0) : null, vendedores: hay('vendedores') ? (fl.vendedores ?? 0) : null, clientesFinales: hay('clientes_finales') ? (fl.clientesFinales ?? 0) : null, estados: Math.max(fl.estados || 0, ...propios.map((r) => N(r.estados))) };
  }, [cuentas, mensual, dias, anio, mes, corteDia, cuotas, cuenta, propios]);
  const { bloques, nota } = useMemo(() => (fila ? bloquesDe(cuenta, fila) : { bloques: [], nota: null }), [cuenta, fila]);

  const skuQ = useDrillSkus(cuenta, anio, !!fila);
  const sucQ = useDrillSucursales(cuenta, anio, !!fila && bloques.includes('sucursales'));
  const venQ = useDrillVendedores(cuenta, anio, !!fila && bloques.includes('vendedores'));
  const cfQ = useDrillClientesFinales(cuenta, anio, mes, !!fila && bloques.includes('clientes'));
  const edoQ = useDrillEstados(cuenta, anio, mes, !!fila && bloques.includes('mapa'));
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => { const m = new Map(); (roadmap || []).forEach((r) => m.set(r.sku, r)); return m; }, [roadmap]);
  const diasCuenta = useMemo(() => dias.filter((r) => r.cuenta === cuenta), [dias, cuenta]);
  const mensualCuenta = useMemo(() => mensual.filter((r) => r.cuenta === cuenta), [mensual, cuenta]);

  if (!cuenta) {
    return <Vacio icon={ShoppingBag} titulo="No reporta sell out" sub={`${nombre} no está entre los 12 mayoristas del puente ni es cliente propio: lo que se ve es su Sell In (lo que nos compra).`} style={{ padding: 18 }} />;
  }
  if (lDias || lMes || !fila) return <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div><Skeleton h={200} r={12} /><Skeleton h={240} r={12} /></div>;

  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  const abrirCompleto = () => nav.push(<CuentaFrenteAlResto cuenta={cuenta} nombre={nombre} anio={anio} mes={mes} corteDia={corteDia} propio={propio} clienteKey={clienteKey} conClientes={bloques.includes('clientes')} />, `frente-${cuenta}`);
  return (
    <>
      <SellOutVista cuenta={cuenta} nombre={nombre} fila={fila} bloques={bloques} nota={nota} anio={anio} mes={mes} dias={diasCuenta} mensualCuenta={mensualCuenta}
        skus={skuQ.data || []} suc={sucQ.data || []} ven={venQ.data || []} cf={cfQ.data || []} edo={edoQ.data || []} rd={rd}
        cargando={{ skus: skuQ.isLoading, suc: sucQ.isLoading, ven: venQ.isLoading, cf: cfQ.isLoading, edo: edoQ.isLoading }}
        onSku={abrirSku} onDimension={(campo, item) => setDim({ campo, item })} onCompleto={abrirCompleto} />
      <HojaDimension cuenta={cuenta} anio={anio} mes={mes} campo={dim?.campo} item={dim?.item} onClose={() => setDim(null)} />
    </>
  );
}
