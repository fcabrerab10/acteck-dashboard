// Inventario de la empresa en el celular (3.81.0 · 2026-10-05 · nodo global `inventarioGlobal`; mockup
// scratchpad/inventario-precios-movil.html, pantalla 1, con los cambios posteriores de Fernando: «sólo información
// de valor»). Formato estándar:
//   TituloGrande «Inventario» + FrescuraPill → HeroM inversa con la frase («$133.2M en piso, 127 días al ritmo de los
//   3 meses cerrados; 41 SKUs agotados con demanda y $25.8M llegan en octubre», sub: piezas · SKUs con stock · costo
//   promedio) → 4 KpiM: Valor del inventario actual · Cambio contra el mes pasado · Llega este mes / viene en total ·
//   Vueltas de inventario del año → GraficaScrub 12 meses (inventario al cierre vs venta promedio 3 m; tooltip con los
//   días de inventario del mes) → PayM Categoría · Marca · Almacén → Detalle por SKU × 12 meses (stock al cierre, Piezas · $,
//   DetalleSkuAnual) → agotados con demanda plegados (hasta 10) con «Ver en S&OP». Tocar un SKU → FichaProducto.
// Sin permiso sensible todo va en piezas (ni valor, ni costo, ni CV en dinero).
// Datos: ./datos.js (8 consultas chicas) · agregación SKU × almacén = inventario/agregar.js (la de la web) · POs =
// inventario/arribos.js#agruparPorPO · lecturas puras = ./calculo.js. `InventarioMVista` es pura: la renderiza
// scripts/test-inventario-movil-ssr.mjs.
import React, { useMemo, useState } from 'react';
import { PackageX, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../../lib/permisos';
import { Cargando } from '../../../components/kit';
import FrescuraPill from '../../../components/FrescuraPill';
import { inventarioDesdeVista } from '../../../lib/medidas';
import { agregarSkus, resumenInventario } from '../../../modules/comercial/inventario/agregar';
import { agruparPorPO } from '../../../modules/comercial/inventario/arribos';
import { fmtFechaCorta } from '../../../modules/comercial/inventario/constantes';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Vacio, GraficaScrub, LeyendaScrub, PayM, ChipsPay, TituloSeccionM } from '../../piezas';
import { MONO, deltaPct } from '../../util';
import DetalleSkuAnual from '../sellout/DetalleSkuAnual';
import { columnasVentana, categoriasDe } from '../sellout/skuAnual';
import FichaProducto from '../../FichaProducto';
import { useInventarioEmpresa } from './datos';
import { resumenInventarioM, demandaDesdePivot, fmtDinero, fmtPz } from './calculo';

const DIMS = [['categoria', 'Categoría'], ['marca', 'Marca'], ['almacen', 'Almacén']];
const TOPE_AGOTADOS = 10;

/** Vista pura (sin red). r = resumenInventarioM(...) · categorias = categoriasDe(roadmap). */
export function InventarioMVista({ r, categorias = [], onSku, onSop, frescura = null, cargandoTabla = false }) {
  const { theme } = useTheme();
  const [dim, setDim] = useState('categoria');
  const [verAgotados, setVerAgotados] = useState(false);
  const gris = theme.textSubtle || theme.textMuted;
  const { res, sensible, llega, cambio, serie, mixes, agotados, tabla, hoy } = r;
  const fmt = sensible ? fmtDinero : (n) => `${fmtPz(n)} pz`;
  const columnas = useMemo(() => columnasVentana(hoy.getFullYear(), hoy.getMonth() + 1), [hoy]);
  const filasPay = useMemo(() => (mixes[dim] || []).map((x) => ({ key: x.key, label: x.label, v: x.v })), [mixes, dim]);
  const conSerie = serie.some((d) => d.inv != null);

  const sub = [
    `${fmtPz(res.piezas)} pz`,
    `${fmtPz(res.conStock)} SKUs con stock`,
    sensible && r.medidas?.costo_promedio != null ? `costo promedio ${fmtDinero(r.medidas.costo_promedio)}` : null,
  ].filter(Boolean).join(' · ');

  const colorCambio = cambio.valor == null ? undefined : cambio.valor > 0 ? theme.orange : theme.green;
  const signo = (v) => (v > 0 ? '+' : '');
  const tooltip = (d) => (
    <>
      <b style={{ fontSize: 12.5 }}>{d.label}</b> · inventario <b style={{ fontSize: 12.5 }}>{d.inv != null ? fmt(d.inv) : '—'}</b>
      {d.cv != null ? <> · venta 3 m {fmt(d.cv)}</> : null}
      {d.dias != null ? <> · <b style={{ fontSize: 12.5 }}>{fmtPz(d.dias)} d</b></> : null}
    </>
  );

  return (
    <>
      <HeroM eyebrow={`Inv Actual · medida del director · ${r.mesLabel} ${hoy.getFullYear()}`} frase={r.frase} sub={sub}>
        {frescura && <div style={{ marginTop: 8 }}>{frescura}</div>}
      </HeroM>

      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow="Valor del inventario actual" big={sensible && res.valor != null ? fmtDinero(res.valor) : `${fmtPz(res.piezas)} pz`}
          sub={sensible && res.valor != null ? `${fmtPz(res.piezas)} pz · ${res.diasInv != null ? `${fmtPz(res.diasInv)} días` : 'sin medida de días'}` : `${fmtPz(res.conStock)} SKUs con stock${res.diasInv != null ? ` · ${fmtPz(res.diasInv)} días` : ''}`} />
        <KpiM eyebrow="Cambio contra el mes pasado" big={cambio.valor == null ? '—' : `${signo(cambio.valor)}${fmt(cambio.valor)}`} bigColor={colorCambio}
          sub={cambio.valor == null ? `sin cierre de ${cambio.mesLabel.toLowerCase()}` : <>{cambio.pct != null ? <span style={{ color: colorCambio }}>{deltaPct(cambio.pct)}</span> : null} vs cierre de {cambio.mesLabel.toLowerCase()}{cambio.fechaCierre ? ` (${fmtFechaCorta(cambio.fechaCierre)})` : ''}</>} />
        <KpiM eyebrow={`Llega en ${llega.mesLabel}`} big={llega.mes.piezas > 0 ? (sensible && llega.mes.valor > 0 ? fmtDinero(llega.mes.valor) : `${fmtPz(llega.mes.piezas)} pz`) : 'Nada'}
          sub={llega.total.piezas > 0 ? `${llega.mes.pos ? `${fmtPz(llega.mes.pos)} PO · ` : ''}en total ${sensible && llega.total.valor > 0 ? fmtDinero(llega.total.valor) : `${fmtPz(llega.total.piezas)} pz`} (${fmtPz(llega.total.pos)} PO)` : 'sin embarques pendientes'} />
        <KpiM eyebrow="Vueltas de inventario del año" big={r.vueltas != null ? `${Number(r.vueltas).toFixed(1)}×` : '—'}
          sub={r.vueltas != null ? (sensible && r.medidas?.ytd_costo_venta != null ? `costo de venta YTD ${fmtDinero(r.medidas.ytd_costo_venta)} / inv. promedio ${fmtDinero(r.medidas.inv_promedio)}` : 'YTD costo de venta / inventario promedio') : 'sin medida'} />
      </KpiGrid>

      <TituloSeccionM style={{ margin: '18px 0 0', padding: '0 28px 6px' }} meta="arrastra para leer">Inventario al cierre de mes</TituloSeccionM>
      <div style={{ margin: '0 16px', background: theme.surface, borderRadius: 14, padding: '10px 10px 6px' }}>
        {conSerie ? (
          <GraficaScrub datos={serie} formato={fmt} tooltip={tooltip} activo={serie.length - 1}
            series={[{ key: 'cv', label: 'Venta promedio 3 m', color: gris }, { key: 'inv', label: 'Inventario', color: theme.accent, area: true, grosor: 2.6 }]} />
        ) : (
          <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '18px 6px', textAlign: 'center' }}>Sin fotos de cierre de mes todavía: la serie se llena con la foto diaria.</div>
        )}
        <LeyendaScrub items={[{ label: 'Inventario', color: theme.accent }, { label: 'Venta promedio 3 m', color: gris }]} derecha={sensible ? 'a costo' : 'en piezas'} />
      </div>
      <div style={{ fontSize: 11.5, color: gris, padding: '6px 28px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>Días del mes = inventario al cierre / CV de los 3 meses cerrados × 90 (medida del director).</div>

      <div style={{ padding: '0 16px' }}>
        <PayM titulo="Mix del inventario actual" filas={filasPay} formato={fmt} centro="HOY" vacio="Sin inventario comercial cargado."
          acciones={<ChipsPay opciones={DIMS} value={dim} onChange={setDim} />} />
        {dim !== 'almacen' && <div style={{ fontSize: 11.5, color: gris, padding: '6px 12px 0', lineHeight: 1.4, fontFamily: TYPO.fontText }}>{dim === 'marca' ? 'Marca por prefijo del SKU y roadmap.' : 'Categoría del roadmap; sin roadmap, «Sin categoría».'}</div>}
      </div>

      <DetalleSkuAnual titulo="Stock al cierre por SKU" filas={tabla} columnas={columnas} categorias={categorias} onSku={onSku} cargando={cargandoTabla}
        conTotalCol={false} soloPiezas={!sensible} vacio="Sin fotos de cierre de mes todavía." meta={`${tabla.length} SKUs · 12 meses`}
        pie="Stock en almacenes comerciales el último día con foto de cada mes (el mes en curso = hoy) · Δ = los 12 meses frente a los mismos del año anterior. Toca el encabezado para ordenar y un SKU para abrir su ficha." />

      {agotados.length > 0 && (
        <ListaAgrupada titulo="Agotados con demanda" meta={fmtPz(agotados.length)} style={{ marginTop: 18 }}
          accion={onSop ? <button type="button" onClick={onSop} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>Ver en S&OP</button> : null}
          pie={verAgotados ? `Sin stock y con venta en los 3 meses cerrados: se dejan de vender ${fmtPz(res.demandaPerdida)} pz al mes.` : null}>
          {!verAgotados ? (
            <Fila key="abrir" alto={46} chevron={false} onClick={() => setVerAgotados(true)}
              titulo={<span style={{ color: theme.accent, fontSize: 14 }}>Ver los {fmtPz(Math.min(TOPE_AGOTADOS, agotados.length))} con más demanda</span>}
              sub={`${fmtPz(res.demandaPerdida)} pz al mes sin vender`} />
          ) : agotados.slice(0, TOPE_AGOTADOS).map((s) => (
            <Fila key={s.sku} alto={56} tono={theme.red} onClick={onSku ? () => onSku(s.sku) : undefined}
              titulo={<span style={{ fontFamily: MONO, fontWeight: 600 }}>{s.sku}</span>} sub={[s.marca || null, s.descripcion || null].filter(Boolean).join(' · ') || '—'}
              valor={`${fmtPz(s.demandaMes)} pz/mes`}
              valorSub={s.transitoPz > 0 ? <span style={{ color: theme.accent }}>llega {fmtFechaCorta(s.transitoEta)} · {fmtPz(s.transitoPz)} pz</span> : <span style={{ color: theme.red }}>sin PO</span>} />
          ))}
        </ListaAgrupada>
      )}
      <div style={{ height: 24 }} />
    </>
  );
}

/** Pantalla conectada (push desde el menú). */
export default function InventarioM() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil() || nav?.perfil;
  const puedeVer = puedeVerPestanaGlobal(perfil, 'inventario_global');
  const sensible = puedeVerSensible(perfil);
  const d = useInventarioEmpresa(puedeVer);

  const roadmapMap = useMemo(() => new Map((d.roadmap || []).map((x) => [x.sku, { descripcion: x.descripcion || '', marca: x.marca || '', familia: x.familia || '', rdmp: x.rdmp || '', categoria: x.categoria || '' }])), [d.roadmap]);
  const r = useMemo(() => {
    if (!d.filas) return null;
    const demanda = demandaDesdePivot(d.demandaRows, d.cerrados);
    const skuRows = agregarSkus(d.filas, { descripciones: roadmapMap, transito: d.transito, leadTime: new Map(), demanda });
    const medidas = inventarioDesdeVista(d.medidasRow);
    const res = resumenInventario(skuRows, medidas);
    const porSku = new Map(skuRows.map((x) => [x.sku, x]));
    const pos = agruparPorPO({ transito: d.transito, porSku, descripciones: roadmapMap, hoy: d.hoy });
    return resumenInventarioM({ res, medidas, meses: d.meses, pos, porSku, precios: d.precios, filas: d.filas, roadmapMap, skuAnio: d.skuAnio, roadmap: d.roadmap, skuRows, hoy: d.hoy, sensible });
  }, [d.filas, d.demandaRows, d.cerrados, d.transito, d.medidasRow, d.meses, d.precios, d.skuAnio, d.roadmap, d.hoy, roadmapMap, sensible]);
  const categorias = useMemo(() => categoriasDe(d.roadmap), [d.roadmap]);

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Inventario" /><Vacio icon={PackageX} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene la pestaña Inventario." /></>);
  }
  const sub = <><span>La empresa · {sensible ? 'a costo' : 'en piezas'}</span><span>·</span><FrescuraPill pantalla="inventarioGlobal" detallado fila /></>;
  if (d.error) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Inventario" sub={sub} /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar el inventario" sub={d.error.message} /></>);
  if (d.loading || !r) return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Inventario" sub="Cargando…" /><Cargando pantalla="movilInventario" /></>);

  const verSku = (sku) => { nav.agregarSku?.(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  const verSop = () => nav.navegar?.({ pagina: 'forecastClientes' });

  return (
    <div data-stagger>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Inventario" sub={sub} />
      <InventarioMVista r={r} categorias={categorias} onSku={verSku} onSop={verSop} />
    </div>
  );
}
