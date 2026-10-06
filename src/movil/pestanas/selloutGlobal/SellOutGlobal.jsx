// Sell Out de la empresa en el celular (3.80.0 · 2026-10-05 · mockup scratchpad/sellout-sellin-movil.html, pantalla 1).
// Sólo empresa y productos: la tabla de cuentas vive en Análisis por cliente. Formato estándar:
//   TituloGrande (Segmented Mes · YTD + SelectorPeriodoM) → HeroM inversa con la frase (cuánto desplazó el canal, vs el
//   año anterior a mismo día, SO/SI, semanas de inventario en cuentas) y el reparto de las 5 cuentas mayores →
//   4 KpiM (sell out · SO/SI · inventario en cuentas · SKUs activos) → GraficaScrub 12 meses (año en área vs anterior)
//   → PayM Canal · Marca · Categoría → Detalle por SKU × 12 meses (DetalleSkuAnual: Piezas · $, buscador con chips,
//   ordenable, Δ, top 80). Tocar un SKU → FichaProducto (nav.agregarSku).
// Regla del mes en curso: si el mes elegido aún no tiene sell out, todo usa el ÚLTIMO mes con sell out y lo dice.
// Datos (5 consultas): v_sellout_cuentas · mv_sellout_cuenta_dia · v_sellout_cuenta_mes (sellout/datos.js, las de la
// web) · v_sellout_sku_anio (3 años pivotados) · roadmap_sku. Cálculo puro en ./calculo.js. Nada sensible.
import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import FrescuraPill from '../../../components/FrescuraPill';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, Cabecera, Skeleton, Vacio, Segmented, SelectorPeriodoM, GraficaScrub, LeyendaScrub, PayM, ChipsPay, TituloSeccionM, Pill } from '../../piezas';
import { moneyCompact, int, deltaPct, MESES } from '../../util';
import { useCuentas, useDias, useMensual, useSkuAnio } from '../../../modules/comercial/sellout/datos';
import { resumenSellOut } from './calculo';
import { categoriasDe } from '../sellout/skuAnual';
import DetalleSkuAnual from '../sellout/DetalleSkuAnual';
import FichaProducto from '../../FichaProducto';

const DIMS = [['canal', 'Canal'], ['marca', 'Marca'], ['categoria', 'Categoría']];
const SEG_MODO = [{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }];

/** Vista pura (sin red): la prueba scripts/test-sellout-sellin-movil-ssr.mjs. */
export function SellOutVista({ r, categorias = [], onSku, cargandoTabla = false }) {
  const { theme } = useTheme();
  const [dim, setDim] = useState('canal');
  const gris = theme.textSubtle || theme.textMuted;
  const mesL = MESES[r.mes - 1];
  const etiquetaPeriodo = r.modo === 'mes' ? mesL.toLowerCase() : `YTD ${r.anio}`;
  const filasPay = useMemo(() => (r.mixes[dim] || []).map((x) => ({ key: x.key, label: x.label, v: x.v })), [r.mixes, dim]);
  const tooltip = (d) => (
    <>
      <b style={{ fontSize: 12.5 }}>{d.label}</b> · {r.anio} <b style={{ fontSize: 12.5 }}>{d.cur != null ? moneyCompact(d.cur) : '—'}</b> · {r.anio - 1} {d.prev != null ? moneyCompact(d.prev) : '—'}
      {d.yoy != null ? <> · <span style={{ color: d.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(d.yoy)}</span></> : null}
    </>
  );
  return (
    <>
      <HeroM eyebrow={<>Dirección comercial · {r.periodoLbl}{r.esOtroMes ? <Pill tone="orange" size="xs" style={{ marginLeft: 6 }}>último con sell out</Pill> : null}</>}
        frase={r.frase} sub={r.reparto || undefined} />

      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow={`Sell out · ${etiquetaPeriodo}`} big={r.importe > 0 ? moneyCompact(r.importe) : '—'}
          sub={r.importe > 0 ? <>{r.yoy != null ? <><span style={{ color: r.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(r.yoy)}</span> vs {r.anio - 1} · </> : null}{r.cuentasConSellOut} de {r.cuentasConFuente} cuentas</> : 'sin sell out cargado'} />
        <KpiM eyebrow={`SO / SI${r.soSiMes ? ` · ${MESES[r.soSiMes - 1].toLowerCase()}` : ''}`} big={r.soSi != null ? (r.soSi / 100).toFixed(2) : '—'} bigColor={r.soSi == null ? undefined : r.soSi >= 100 ? theme.green : r.soSi < 60 ? theme.orange : undefined}
          sub={r.sellInSoSi > 0 ? `sell in ${moneyCompact(r.sellInSoSi)}${r.soSiMes ? ' · cuentas con ambos' : ''}` : 'sin sell in en el período'} />
        <KpiM eyebrow="Inventario en cuentas" big={r.inv.cuentas ? (r.inv.semanas != null ? `${Math.round(r.inv.semanas)} sem` : int(r.inv.piezas) + ' pz') : '—'}
          sub={r.inv.cuentas ? `${moneyCompact(r.inv.valor)} · ${r.inv.cuentas} cuentas reportan` : 'ninguna cuenta reporta'} />
        <KpiM eyebrow="SKUs activos" big={String(r.skus.activos)} sub={`de ${r.skus.roadmap} del roadmap · ${r.skus.sinMovimiento} sin movimiento`} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">{r.anio} frente a {r.anio - 1}</TituloSeccionM>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
        <GraficaScrub datos={r.serie} formato={moneyCompact} tooltip={tooltip} activo={r.modo === 'mes' ? r.mes - 1 : null}
          series={[{ key: 'prev', label: String(r.anio - 1), color: gris }, { key: 'cur', label: String(r.anio), color: theme.purple || theme.accent, area: true, grosor: 2.6 }]} />
        <LeyendaScrub items={[{ label: String(r.anio), color: theme.purple || theme.accent }, { label: String(r.anio - 1), color: gris }]} derecha="sell out sin IVA" />
      </div>

      <div style={{ padding: '0 16px' }}>
        <PayM titulo={`Mix · ${etiquetaPeriodo}`} filas={filasPay} formato={moneyCompact} centro={r.modo === 'mes' ? mesL.toUpperCase() : 'YTD'} vacio="Sin sell out en el período."
          acciones={<ChipsPay opciones={DIMS} value={dim} onChange={setDim} />} />
        {dim !== 'canal' && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '6px 12px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>{dim === 'marca' ? 'Marca por prefijo del SKU y roadmap.' : 'Categoría del roadmap; sin roadmap, la de la fuente.'}</div>}
      </div>

      <DetalleSkuAnual titulo="Detalle por SKU" filas={r.tabla} columnas={r.columnas} categorias={categorias} onSku={onSku} cargando={cargandoTabla}
        pie="Sell out de todas las cuentas · Δ = los 12 meses frente a los mismos del año anterior. Toca el encabezado para ordenar y un SKU para abrir su ficha." />
    </>
  );
}

export default function SellOutGlobal() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);
  const [modo, setModo] = useState('mes');

  const { data: cuentas = [], isLoading: lCuentas, error: eCuentas } = useCuentas();
  const { data: dias = [], isLoading: lDias, error: eDias } = useDias(anio);
  const { data: mensual = [], isLoading: lMes, error: eMes } = useMensual(anio);
  const { data: skuAnio = [], isLoading: lSku } = useSkuAnio(anio);
  const { data: roadmap = [] } = useRoadmap();
  const cargando = lCuentas || lDias || lMes;
  const error = eCuentas || eDias || eMes;

  const r = useMemo(() => (cuentas.length && mensual.length ? resumenSellOut({ cuentas, mensual, dias, skuAnio, roadmap, anio, mes, modo, hoy }) : null),
    [cuentas, mensual, dias, skuAnio, roadmap, anio, mes, modo, hoy]);
  const categorias = useMemo(() => categoriasDe(roadmap), [roadmap]);
  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };

  const periodoLbl = modo === 'mes' ? `${MESES[mes - 1]} ${anio}` : `${anio} a ${MESES[mes - 1].toLowerCase()}`;
  const sub = <><span>La empresa · sin IVA</span><span>·</span><FrescuraPill pantalla="sellOutGlobal" detallado fila etiquetas={{ sellout_general: 'Puente', sellout_pcel: 'PCEL', inventario_cliente: 'Inv. clientes' }} /></>;

  return (
    <div data-stagger>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Sell Out" sub={sub} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px' }}>
        <Segmented value={modo} onChange={setModo} options={SEG_MODO} />
        <SelectorPeriodoM anio={anio} mes={mes} anioHoy={anioHoy} mesHoy={mesHoy} conAnio={false} onChange={(a, m) => { setAnio(a); setMes(m); }} />
      </div>
      {error && <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar el Sell Out" sub={error.message} />}
      {(cargando || !r) && !error && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={150} r={12} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
          <Skeleton h={200} r={14} /><Skeleton h={160} r={14} /><Skeleton h={320} r={12} />
        </div>
      )}
      {r && !cargando && <SellOutVista r={r} categorias={categorias} onSku={abrirSku} cargandoTabla={lSku} />}
      {r && !cargando && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '10px 28px 0', lineHeight: 1.4 }}>{periodoLbl} · sell out sin IVA de v_sellout_cuenta_mes y mv_sellout_cuenta_dia (a mismo día que el año pasado) · sell in = Fact Neta del ERP de las cuentas que reportan.</div>}
    </div>
  );
}
