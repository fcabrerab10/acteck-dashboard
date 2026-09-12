// Ficha del SKU dentro de Sell Out por cliente (pantalla empujada desde la lista de SKUs del mes).
//
//   1. Toggle Monto · Piezas (el mismo de la pantalla padre, se hereda al abrir).
//   2. Sell-out del AÑO EN CURSO mes a mes (Ene–mes actual) con el año anterior completo como fila
//      comparativa, más columnas Prom (sólo meses con dato) y Total (TablaAnual).
//   3. Inventario del cliente para ESE producto: stock de la última semana cargada, semanas de cobertura
//      al ritmo de los últimos 3 meses con dato, su valor al costo del propio cliente y —sólo si la fuente
//      de ese cliente lo trae— los días sin venta. Lo que la fuente no manda no se pinta (`campos`).
//   4. Stock al cierre de cada mes del año (última semana cargada de cada mes) con su promedio, para ver
//      si el inventario del cliente sube o baja frente a su venta.
//   5. "Ver disponibilidad" → Ficha de producto (inventario Acteck, tránsito y precio de lista).
//
// Fuentes: las filas de sell-out ya cargadas por la pantalla padre (una sola petición por cliente) +
// inventario_cliente / sellout_pcel por sku y año (useInventarioSkuAnio, ~20-40 renglones).
// PCEL no reporta importe: el monto es piezas × precio de lista (ver sellout/datos.js).
import React, { useMemo, useState } from 'react';
import { PackageSearch } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useNav } from '../../nav';
import { TituloGrande, Cabecera, KpiM, KpiGrid, TituloSeccionM, BotonGrande, Skeleton, Pill, Vacio, Segmented } from '../../piezas';
import { money, moneyCompact, int, deltaPct, tonoDelta, MESES, MONO, N } from '../../util';
import FichaProducto from '../../FichaProducto';
import TablaAnual from './TablaAnual';
import { useInventarioSkuAnio } from './datos';

const UNIDADES = [{ id: 'monto', label: 'Monto' }, { id: 'piezas', label: 'Piezas' }];
const delta = (a, b) => (b ? ((a - b) / Math.abs(b)) * 100 : null);
const SEMANAS_MES = 4.345;

/**
 * sku, info {descripcion, marca, categoria} · clienteKey, nombre
 * filas: [{ anio, mes, piezas, monto }] del SKU (año en curso y anterior; monto ya valuado)
 * inv:   { stock, valor, costo, precioVenta, dias, semana } de la última semana cargada (o null)
 * campos: qué trae la fuente de este cliente (disponibilidadDeCampos) → { valor, dias_sin_venta, … }
 * codigosPcel: códigos PCEL del sku (sólo cliente pcel) · unidadInicial: 'monto' | 'piezas'
 */
export default function FichaSkuSellOut({ sku, info = {}, clienteKey, nombre, filas = [], inv = null, campos = {}, codigosPcel = null, unidadInicial = 'monto', valuadoALista = false }) {
  const { theme } = useTheme();
  const nav = useNav();
  const [unidad, setUnidad] = useState(unidadInicial);
  const hoy = useMemo(() => new Date(), []);
  const anio = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;
  const esPcel = clienteKey === 'pcel';

  const { data: histo, isLoading: lHisto } = useInventarioSkuAnio(clienteKey, sku, anio, codigosPcel);

  const fmt = unidad === 'monto' ? moneyCompact : (n) => Math.round(n).toLocaleString('es-MX');
  const fmtLargo = unidad === 'monto' ? money : (n) => `${int(n)} pz`;

  // ── Serie anual: 12 columnas, fila del año en curso + fila del año anterior ──
  const a = useMemo(() => {
    const cur = Array.from({ length: 12 }, () => 0), prev = Array.from({ length: 12 }, () => 0);
    const curPz = Array.from({ length: 12 }, () => 0), prevPz = Array.from({ length: 12 }, () => 0);
    filas.forEach((r) => {
      const m = N(r.mes); if (m < 1 || m > 12) return;
      const v = unidad === 'monto' ? N(r.monto) : N(r.piezas);
      if (N(r.anio) === anio) { cur[m - 1] += v; curPz[m - 1] += N(r.piezas); }
      else if (N(r.anio) === anio - 1) { prev[m - 1] += v; prevPz[m - 1] += N(r.piezas); }
    });
    const totCur = cur.reduce((s, v) => s + v, 0), totPrev = prev.reduce((s, v) => s + v, 0);
    const mesesCon = cur.filter((v) => v !== 0).length;
    const promCur = mesesCon ? totCur / mesesCon : 0;
    const ytdPrev = prev.slice(0, mesActual).reduce((s, v) => s + v, 0);
    // Ritmo: últimos 3 meses del año en curso con piezas (para la cobertura del inventario)
    const conPz = [];
    for (let m = mesActual; m >= 1 && conPz.length < 3; m -= 1) if (curPz[m - 1] > 0) conPz.push(curPz[m - 1]);
    const ritmoMes = conPz.length ? conPz.reduce((s, v) => s + v, 0) / conPz.length : 0;
    return { cur, prev, curPz, totCur, totPrev, promCur, mesesCon, ytdPrev, yoyYtd: delta(totCur, ytdPrev), ritmoMes, mesesRitmo: conPz.length };
  }, [filas, unidad, anio, mesActual]);

  const columnas = MESES;
  const filasAnio = useMemo(() => {
    const out = [];
    if (a.cur.some((v) => v !== 0)) out.push({ label: String(anio), sub: `Ene–${MESES[mesActual - 1]}`, valores: a.cur });
    if (a.prev.some((v) => v !== 0)) out.push({ label: String(anio - 1), sub: 'año completo', valores: a.prev });
    return out;
  }, [a, anio, mesActual]);

  // ── Inventario del cliente ──
  const stock = inv?.stock ?? null;
  const cobertura = stock != null && a.ritmoMes > 0 ? (stock / a.ritmoMes) * SEMANAS_MES : null;
  const valorInv = inv ? (inv.valor != null ? N(inv.valor) : N(inv.stock) * N(inv.costo)) : null;
  const dias = inv?.dias ?? null;
  // `campos` = qué trae la fuente del cliente. Sin él, se decide con el propio renglón.
  const hayValor = (campos.valor ?? true) && valorInv != null && valorInv > 0;
  const hayDias = (campos.dias_sin_venta ?? true) && dias != null;

  const stockMes = histo?.porMes || null;
  const filasStock = useMemo(() => {
    if (!stockMes || !stockMes.some((v) => v != null)) return [];
    const promMeses = stockMes.filter((v) => v != null).length;
    return [{ label: 'Stock', sub: 'al cierre de mes', valores: stockMes.map((v) => (v == null ? 0 : v)), promMeses }];
  }, [stockMes]);
  const mesesStock = stockMes ? stockMes.filter((v) => v != null).length : 0;
  const tendenciaStock = useMemo(() => {
    if (!stockMes) return null;
    const con = stockMes.map((v, i) => (v == null ? null : { i, v })).filter(Boolean);
    if (con.length < 2) return null;
    return delta(con[con.length - 1].v, con[0].v);
  }, [stockMes]);

  const verDisponibilidad = () => { nav.agregarSku(sku); nav.push(<FichaProducto />, `ficha-${sku}`); };

  const tonoCob = cobertura == null ? 'gray' : cobertura <= 2 ? 'red' : cobertura <= 4 ? 'orange' : cobertura >= 16 ? 'orange' : 'green';
  const colorCob = cobertura == null ? undefined : cobertura <= 2 ? theme.red : cobertura <= 4 ? theme.orange : cobertura >= 16 ? theme.orange : theme.green;

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Sell Out" derecha={<Segmented value={unidad} onChange={setUnidad} options={UNIDADES} />} />
      <TituloGrande titulo={sku} sub={info.descripcion || 'Sin descripción en el roadmap'} />

      <div style={{ padding: '0 20px 14px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {info.marca && <Pill tone="blue">{info.marca}</Pill>}
        {info.categoria && <Pill tone="gray">{info.categoria}</Pill>}
        <Pill tone="gray">{nombre}</Pill>
        {valuadoALista && unidad === 'monto' && <Pill tone="orange">valuado a lista</Pill>}
      </div>

      <KpiGrid>
        <KpiM eyebrow={`Sell-out ${anio}`} big={fmt(a.totCur)} sub={a.yoyYtd != null ? `${deltaPct(a.yoyYtd)} vs ${anio - 1} a ${MESES[mesActual - 1]}` : `sin ${anio - 1} comparable`}
          pill={a.yoyYtd != null ? { tone: tonoDelta(a.yoyYtd), label: deltaPct(a.yoyYtd) } : undefined} />
        <KpiM eyebrow="Promedio por mes" big={fmt(a.promCur)} sub={a.mesesCon ? `${a.mesesCon} mes${a.mesesCon === 1 ? '' : 'es'} con venta` : 'sin venta este año'} />
        <KpiM eyebrow="Stock del cliente" big={stock != null ? `${int(stock)} pz` : '—'} bigColor={stock === 0 ? theme.red : undefined}
          sub={inv?.semana ? `última semana ${inv.semana}` : 'sin inventario cargado'} />
        <KpiM eyebrow="Cobertura" big={cobertura != null ? `${cobertura.toFixed(1)} sem` : '—'} bigColor={colorCob}
          sub={a.ritmoMes > 0 ? `al ritmo de ${int(a.ritmoMes)} pz/mes (${a.mesesRitmo}m)` : 'sin ritmo de venta'}
          pill={cobertura != null ? { tone: tonoCob, label: cobertura <= 4 ? 'baja' : cobertura >= 16 ? 'alta' : 'ok' } : undefined} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '20px 0 0', padding: '0 28px 6px' }} meta={`${anio}`}>Sell-out mes a mes</TituloSeccionM>
      <div style={{ padding: '0 16px' }}>
        <TablaAnual columnas={columnas} filas={filasAnio} fmt={fmt} etiquetaFilas={filasAnio.length > 1 ? '2 años' : ''} totalLabel="Total"
          vacio={`Sin sell-out de este SKU en ${anio - 1}–${anio}.`} />
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
          {unidad === 'monto' ? (valuadoALista ? 'Monto valuado a precio de lista (PCEL no reporta importe)' : 'Monto de sell-out') : 'Piezas de sell-out'} por mes · <strong>Prom</strong> = promedio sólo de los meses con dato · <strong>Total</strong> = suma de la fila.
          {a.ytdPrev > 0 && ` ${anio - 1} a ${MESES[mesActual - 1]}: ${fmtLargo(a.ytdPrev)}.`}
        </div>
      </div>

      <TituloSeccionM style={{ margin: '20px 0 0', padding: '0 28px 6px' }} meta={inv?.semana || undefined}>Inventario del cliente</TituloSeccionM>
      <div style={{ padding: '0 16px' }}>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px', fontFamily: TYPO.fontText }}>
          {!inv && <div style={{ fontSize: 12.5, color: theme.textMuted, textAlign: 'center', padding: '6px 0' }}>Este SKU no aparece en la última foto de inventario del cliente.</div>}
          {inv && (
            <>
              {/* Sólo se pinta lo que la fuente de este cliente trae: el valor del inventario del
                  cliente si hay con qué valuarlo, los días sin venta si vienen en la carga. */}
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${2 + (hayValor ? 1 : 0) + (hayDias ? 1 : 0)}, minmax(0,1fr))`, gap: 10 }}>
                <Dato k="Stock" v={`${int(stock)} pz`} sub={inv.semana ? inv.semana : undefined} color={stock === 0 ? theme.red : theme.text} theme={theme} />
                <Dato k="Cobertura" v={cobertura != null ? `${cobertura.toFixed(1)} sem` : '—'} sub={a.ritmoMes > 0 ? `${int(a.ritmoMes)} pz/mes` : 'sin ritmo'} color={colorCob} theme={theme} />
                {hayValor && <Dato k="Valor (costo)" v={valorInv != null ? money(valorInv) : '—'} sub={N(inv.costo) > 0 ? `${money(inv.costo)} / pz ${esPcel ? 'promedio' : 'convenio'}` : undefined} theme={theme} />}
                {hayDias && <Dato k="Días sin venta" v={`${int(dias)} d`} sub={dias >= 30 ? 'sin rotación' : 'con rotación'} color={dias >= 30 ? theme.orange : undefined} theme={theme} />}
              </div>
              {N(inv.precioVenta) > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 11.5, color: theme.textMuted, flexWrap: 'wrap' }}>
                  <span>precio de venta del cliente {money(inv.precioVenta)}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <TituloSeccionM style={{ margin: '20px 0 0', padding: '0 28px 6px' }} meta={mesesStock ? `${mesesStock} meses` : undefined}>Stock al cierre de cada mes</TituloSeccionM>
      <div style={{ padding: '0 16px' }}>
        {lHisto && <Skeleton h={92} r={12} />}
        {!lHisto && filasStock.length === 0 && <Vacio icon={null} titulo="Sin historial de inventario" sub={`No hay semanas cargadas de este SKU en ${anio}.`} style={{ padding: 18 }} />}
        {!lHisto && filasStock.length > 0 && (
          <>
            <TablaAnual columnas={columnas} filas={filasStock} fmt={(n) => Math.round(n).toLocaleString('es-MX')} conTotalCol={false} conTotalFila={false} etiquetaFilas="" />
            <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4 }}>
              Piezas en piso del cliente en la última semana cargada de cada mes · <strong>Prom</strong> = promedio de los meses con foto (no hay Total: es un saldo, no un flujo).
              {tendenciaStock != null && ` El inventario ${tendenciaStock >= 0 ? 'subió' : 'bajó'} ${deltaPct(Math.abs(tendenciaStock))} del primer al último mes con foto.`}
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '18px 16px 0' }}>
        <BotonGrande icon={PackageSearch} onClick={verDisponibilidad}>Ver disponibilidad</BotonGrande>
      </div>

      <div style={{ padding: '16px 16px 0', fontSize: 11, color: theme.textSubtle || theme.textMuted, lineHeight: 1.45, fontFamily: TYPO.fontText }}>
        Sell-out de <span style={{ fontFamily: MONO }}>{esPcel ? 'sellout_pcel_mensual' : clienteKey === 'dicotech' ? 'sellout_sku' : 'sellout_detalle'}</span> · inventario de <span style={{ fontFamily: MONO }}>{esPcel ? 'sellout_pcel' : 'inventario_cliente'}</span> (una foto por semana).
      </div>
    </>
  );
}

function Dato({ k, v, sub, color, theme }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap' }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2, whiteSpace: 'nowrap' }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}
