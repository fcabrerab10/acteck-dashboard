// Sell In de la empresa en el celular (3.80.0 · 2026-10-05 · mockup scratchpad/sellout-sellin-movil.html, pantalla 2).
// Sólo empresa y productos: la tabla de clientes vive en Análisis por cliente. Mismo esqueleto que Sell Out:
//   TituloGrande (Segmented Mes · YTD + SelectorPeriodoM) → HeroM con la frase de cuota («va al 73 % de cuota con
//   margen del 19.1 %, 23 % abajo de sep 2025 a mismo día») y BarraCuotaM → 4 KpiM (sell in del período con YoY y
//   % cuota · YTD/mes con YoY y % cuota · Margen MC sólo con puedeVerSensible, si no Piezas · clientes con compra
//   «de N activos en el año · M nuevos») → GraficaScrub 12 meses con cuota punteada (como Inicio) → PayM Canal · Marca ·
//   Categoría → Detalle por SKU × 12 meses (DetalleSkuAnual). Tocar un SKU → FichaProducto.
// Datos: sellin/datos.js#useSellInEmpresa (6 consultas) + useRoadmap. Cálculo puro en ./calculo.js.
// ApoyoM.jsx y EquipoM.jsx (3.24) quedan en la carpeta sin uso desde esta pantalla.
import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { puedeVerSensible } from '../../../lib/permisos';
import FrescuraPill from '../../../components/FrescuraPill';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, Cabecera, Skeleton, Vacio, Segmented, SelectorPeriodoM, BarraCuotaM, GraficaScrub, LeyendaScrub, PayM, ChipsPay, TituloSeccionM } from '../../piezas';
import { moneyCompact, int, deltaPct, tonoCuota, MESES } from '../../util';
import { useSellInEmpresa } from './datos';
import { resumenSellIn } from './calculo';
import { categoriasDe } from '../sellout/skuAnual';
import DetalleSkuAnual from '../sellout/DetalleSkuAnual';
import FichaProducto from '../../FichaProducto';

const DIMS = [['canal', 'Canal'], ['marca', 'Marca'], ['categoria', 'Categoría']];
const SEG_MODO = [{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }];

/** Vista pura (sin red): la prueba scripts/test-sellout-sellin-movil-ssr.mjs. */
export function SellInVista({ r, sensible = true, categorias = [], onSku, onMes }) {
  const { theme } = useTheme();
  const [dim, setDim] = useState('canal');
  const gris = theme.textSubtle || theme.textMuted;
  const mesL = MESES[r.mes - 1];
  const etiquetaPeriodo = r.modo === 'mes' ? mesL.toLowerCase() : `YTD ${r.anio}`;
  const etiquetaOtro = r.modo === 'mes' ? `YTD ${r.anio}` : mesL.toLowerCase();
  const filasPay = useMemo(() => (r.mixes[dim] || []).map((x) => ({ key: x.key, label: x.label, v: x.v })), [r.mixes, dim]);
  const tooltip = (d) => (
    <>
      <b style={{ fontSize: 12.5 }}>{d.label}{d.enCurso ? ' ·' : ''}</b> · {r.anio} <b style={{ fontSize: 12.5 }}>{d.fn != null ? moneyCompact(d.fn) : '—'}</b>{d.pct != null ? ` · ${Math.round(d.pct)}% cuota` : ''}<br />
      {r.anio - 1} {d.prev != null ? moneyCompact(d.prev) : '—'}{d.yoy != null ? <> · <span style={{ color: d.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(d.yoy)}</span></> : null}{d.cuota ? ` · cuota ${moneyCompact(d.cuota)}` : ''}
    </>
  );
  const yoyLbl = r.modo === 'mes' && r.enCurso ? `vs ${r.anio - 1} a mismo día` : `vs ${r.anio - 1}`;
  return (
    <>
      <HeroM eyebrow={`Dirección comercial · ${r.periodoLbl}`} frase={r.frase}>
        <BarraCuotaM valor={r.cur.fact_neta} cuota={r.cuotaPeriodo} label={r.modo === 'mes' ? `cuota de ${mesL.toLowerCase()}` : 'cuota a la fecha'} />
      </HeroM>

      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow={`Sell in · ${etiquetaPeriodo}`} big={moneyCompact(r.cur.fact_neta)}
          sub={<>{r.yoy != null ? <><span style={{ color: r.yoy >= 0 ? theme.green : theme.red }}>{deltaPct(r.yoy)}</span> {yoyLbl}</> : `sin ${r.anio - 1}`}</>}
          pill={r.pctCuota != null ? { tone: tonoCuota(r.pctCuota), label: `${Math.round(r.pctCuota)}% cuota` } : undefined} />
        <KpiM eyebrow={`Sell in · ${etiquetaOtro}`} big={moneyCompact(r.otro.fact_neta)}
          sub={r.yoyOtro != null ? <><span style={{ color: r.yoyOtro >= 0 ? theme.green : theme.red }}>{deltaPct(r.yoyOtro)}</span> vs {r.anio - 1}</> : `sin ${r.anio - 1}`}
          pill={r.pctOtro != null ? { tone: tonoCuota(r.pctOtro), label: `${Math.round(r.pctOtro)}% cuota` } : undefined} />
        {sensible
          ? <KpiM eyebrow="Margen MC" big={r.cur.mc != null ? `${r.cur.mc.toFixed(1)}%` : '—'} bigColor={r.cur.mc == null ? undefined : r.dMc != null && r.dMc < 0 ? theme.red : undefined}
              sub={r.dMc != null ? `${r.dMc >= 0 ? '+' : '−'}${Math.abs(r.dMc).toFixed(1)} pp vs ${r.anio - 1} · contribución ${moneyCompact(r.cur.contribucion)}` : 'sin comparativo'} />
          : <KpiM eyebrow={`Piezas · ${etiquetaPeriodo}`} big={int(r.cur.piezas)} sub={r.yoyPiezas != null ? `${deltaPct(r.yoyPiezas)} ${yoyLbl}` : undefined} />}
        <KpiM eyebrow="Clientes con compra" big={String(r.clientes.conCompra)} sub={`de ${r.clientes.activosAnio} activos en ${r.anio}${r.clientes.nuevos ? ` · ${r.clientes.nuevos} nuevos` : ''}`} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer · toca para elegir el mes">{r.anio} frente a {r.anio - 1}</TituloSeccionM>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
        <GraficaScrub datos={r.serie} formato={moneyCompact} tooltip={tooltip} activo={r.modo === 'mes' ? r.mes - 1 : null}
          onTocar={(k) => { if (onMes && r.serie[k]?.fn != null) onMes(k + 1); }}
          series={[{ key: 'cuota', label: 'Cuota', color: theme.orange, dash: true }, { key: 'prev', label: String(r.anio - 1), color: gris }, { key: 'fn', label: String(r.anio), color: theme.accent, area: true, grosor: 2.6 }]} />
        <LeyendaScrub items={[{ label: String(r.anio), color: theme.accent }, { label: String(r.anio - 1), color: gris }, ...(r.cuota.anual ? [{ label: 'Cuota', color: theme.orange, dash: true }] : [])]} derecha="Fact. neta" />
      </div>

      <div style={{ padding: '0 16px' }}>
        <PayM titulo={`Mix · ${etiquetaPeriodo}`} filas={filasPay} formato={moneyCompact} centro={r.modo === 'mes' ? mesL.toUpperCase() : 'YTD'} vacio="Sin sell in en el período."
          acciones={<ChipsPay opciones={DIMS} value={dim} onChange={setDim} />} />
      </div>

      <DetalleSkuAnual titulo="Detalle por SKU" filas={r.tabla} columnas={r.columnas} categorias={categorias} onSku={onSku}
        pie="Facturación de todos los clientes · Δ = los 12 meses frente a los mismos del año anterior. Toca el encabezado para ordenar y un SKU para abrir su ficha." />
      <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '10px 28px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>
        Medidas del director (Fact. neta, contribución) de v_erp_medidas_mes · cuota {r.cuota.fuente === 'cuotas_canales' ? 'anual de cuotas_canales' : r.cuota.fuente ? 'Σ cuotas_mensuales' : 'no cargada'} · el mes en curso se compara a mismo día.
      </div>
    </>
  );
}

export default function SellInGlobal() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);
  const [modo, setModo] = useState('mes');
  const sensible = puedeVerSensible(nav.perfil);

  const { data, isLoading, error } = useSellInEmpresa(anio);
  const { data: roadmap = [] } = useRoadmap();
  const r = useMemo(() => (data ? resumenSellIn({ ...data, roadmap }, { anio, mes, modo, hoy, sensible }) : null), [data, roadmap, anio, mes, modo, hoy, sensible]);
  const categorias = useMemo(() => categoriasDe(roadmap), [roadmap]);
  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };

  const periodoLbl = modo === 'mes' ? `${MESES[mes - 1]} ${anio}` : `${anio} a ${MESES[mes - 1].toLowerCase()}`;
  const sub = <><span>La empresa · Fact. neta</span><span>·</span><FrescuraPill pantalla="sellIn" detallado fila /></>;

  return (
    <div data-stagger>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Sell In" sub={sub} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px' }}>
        <Segmented value={modo} onChange={setModo} options={SEG_MODO} />
        <SelectorPeriodoM anio={anio} mes={mes} anioHoy={anioHoy} mesHoy={mesHoy} conAnio={false} onChange={(a, m) => { setAnio(a); setMes(m); }} />
      </div>
      {error && <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar el Sell In" sub={error.message} />}
      {(isLoading || !r) && !error && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={170} r={12} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
          <Skeleton h={200} r={14} /><Skeleton h={160} r={14} /><Skeleton h={320} r={12} />
        </div>
      )}
      {r && !isLoading && <SellInVista r={r} sensible={sensible} categorias={categorias} onSku={abrirSku} onMes={(m) => { setMes(m); setModo('mes'); }} />}
      {!r && !isLoading && !error && <Vacio icon={null} titulo={`Sin facturación en ${periodoLbl}`} />}
    </div>
  );
}
