// Sell Out consolidado (web, V3) · "la empresa como equipo".
//
// Hero narrativo + 4 KPIs · evolución de 12 meses y composición del mes ·
// tabla por cuenta (13 cuentas de mayoreo + Digitalife + PCEL + Dicotech + mostrador/e-commerce)
// con drill en línea por pestañas · mapa de México plegable.
//
// Los datos ya vienen agregados de Postgres (supabase/migrations/20260912_sellout_global_*.sql):
// la pantalla NO toca las 440 K filas de sellout_general. Cálculo puro en sellout/calculo.js,
// acceso a datos en sellout/datos.js, textos en sellout/textos.js.
//
// Montos SIEMPRE sin IVA (ver docs/CORRECCION_CLIENTES_20260912.md).
import React, { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Share2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal } from '../../lib/permisos';
import ExportMenu from '../../components/ExportMenu';
import FrescuraPill from '../../components/FrescuraPill';
import { Hero, KpiCard, Pill, DeltaPill, Segmented, TablaCompacta, Panel, Boton, Cargando, toast } from '../../components/kit';
import { moneyCompact } from '../../lib/format';
import { GraficaLineas } from '../../components/kit';
import Buscador from './sellin/Buscador';
import Filtros from './sellin/Filtros';
import DrillCuenta from './sellout/DrillCuenta';
// El mapa trae 82 KB de geometría: se carga sólo cuando se abre el panel.
const MapaMexico = lazy(() => import('./sellout/MapaMexico'));
import { useCuentas, useAnios, useDias, useMensual, useSkuMes, useEstadoMes } from './sellout/datos';
import {
  MESES, CANALES, canalLabel, canalTone, construirFilas, totalesDeFilas, porCanal, composicion,
  serie12, porEstado, ultimoDiaConVenta, ultimoMesConVenta, ultimosMeses, N,
} from './sellout/calculo';
import { fmtMoney, fmtInt, fmtPct, fmtSigno, fraseHero, subHero, textoResumenMes, capitalizarEstado, etiquetaMes } from './sellout/textos';

const ORIGENES = [{ id: 'todos', label: 'Todos' }, { id: 'propios', label: 'Propios' }, { id: 'erp', label: 'ERP' }];
const MODOS = [{ id: 'importe', label: 'Monto' }, { id: 'piezas', label: 'Piezas' }];
const DIMENSIONES = [{ id: 'canal', label: 'Canal' }, { id: 'marca', label: 'Marca' }, { id: 'categoria', label: 'Categoría' }];
const CANAL_SEG = [{ id: 'todos', label: 'Todos' }, ...CANALES.map((c) => ({ id: c.id, label: c.label }))];

const money = (n) => (n == null || !Number.isFinite(Number(n)) ? '—' : `$${Math.round(Number(n)).toLocaleString('es-MX')}`);

export default function SellOutGlobal() {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const rootRef = useRef(null);

  const { data: cuentas = [], isLoading: cargandoCuentas } = useCuentas();
  const { data: anios = [] } = useAnios();

  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [mes, setMes] = useState(hoy.getMonth() + 1);
  const [mesTocado, setMesTocado] = useState(false);
  const [canalSel, setCanalSel] = useState('todos');
  const [origen, setOrigen] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState({ col: 'importe', dir: 'desc' });
  const [abierto, setAbierto] = useState(null);
  const [modo, setModo] = useState('importe');
  const [dimension, setDimension] = useState('canal');
  const [dimSel, setDimSel] = useState(null);      // clic en la composición → filtra la tabla
  const [estadoSel, setEstadoSel] = useState(null); // clic en el mapa → filtra la tabla
  const [flags, setFlags] = useState({ caen: false, sinCliente: false, conInv: false });
  const [mapaAbierto, setMapaAbierto] = useState(false); // el mapa se monta al abrir el panel

  const { data: dias = [], isLoading: cargandoDias } = useDias(anio);
  const { data: mensual = [], isLoading: cargandoMes } = useMensual(anio);
  const { data: skuMes = [] } = useSkuMes(anio, mes);
  const { data: estadoMes = [] } = useEstadoMes(anio, mes);

  // Mes por defecto = el último con venta (el mes en curso casi siempre).
  useEffect(() => {
    if (mesTocado || !dias.length) return;
    const u = ultimoMesConVenta(dias);
    if (u && (u.anio !== anio || u.mes !== mes)) { setAnio(u.anio); setMes(u.mes); }
  }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setAbierto(null); }, [anio, mes, canalSel, origen, busqueda, dimSel, estadoSel]);

  const corteDia = useMemo(() => ultimoDiaConVenta(dias, anio, mes) || 31, [dias, anio, mes]);

  const filasBase = useMemo(
    () => construirFilas({ cuentas, mensual, dias, anio, mes, corteDia }),
    [cuentas, mensual, dias, anio, mes, corteDia],
  );

  // Cuentas que quedan dentro del filtro de composición (marca / categoría) o del mapa.
  const cuentasDeDim = useMemo(() => {
    if (!dimSel || dimension === 'canal') return null;
    const s = new Set();
    for (const r of skuMes) {
      if (N(r.anio) !== anio || N(r.mes) !== mes) continue;
      if ((r[dimension] || 'Sin dato') === dimSel) s.add(r.cuenta);
    }
    return s;
  }, [dimSel, dimension, skuMes, anio, mes]);
  const cuentasDeEstado = useMemo(() => {
    if (!estadoSel) return null;
    const s = new Set();
    for (const r of estadoMes) if (N(r.anio) === anio && N(r.mes) === mes && r.estado === estadoSel && N(r.importe) > 0) s.add(r.cuenta);
    return s;
  }, [estadoSel, estadoMes, anio, mes]);

  const filas = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    let l = filasBase;
    if (canalSel !== 'todos') l = l.filter((f) => f.canal === canalSel);
    if (dimension === 'canal' && dimSel) l = l.filter((f) => f.canal === dimSel);
    if (cuentasDeDim) l = l.filter((f) => cuentasDeDim.has(f.cuenta));
    if (cuentasDeEstado) l = l.filter((f) => cuentasDeEstado.has(f.cuenta));
    if (origen === 'propios') l = l.filter((f) => f.propio);
    if (origen === 'erp') l = l.filter((f) => !f.propio);
    if (q) l = l.filter((f) => f.nombre.toUpperCase().includes(q) || String(f.erp || '').includes(q));
    if (flags.caen) l = l.filter((f) => f.yoy != null && f.yoy < 0);
    if (flags.sinCliente) l = l.filter((f) => f.clientesFinales == null || f.clientesFinales === 0);
    if (flags.conInv) l = l.filter((f) => f.invValor != null);
    const dir = orden.dir === 'asc' ? 1 : -1;
    return [...l].sort((a, b) => {
      const va = a[orden.col], vb = b[orden.col];
      if (typeof va === 'string' || typeof vb === 'string') return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
      return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir;
    });
  }, [filasBase, busqueda, canalSel, origen, orden, dimSel, dimension, cuentasDeDim, cuentasDeEstado, flags]);

  const totales = useMemo(() => totalesDeFilas(filas), [filas]);
  const totalesGlobal = useMemo(() => totalesDeFilas(filasBase), [filasBase]);
  const canales = useMemo(() => porCanal(filasBase), [filasBase]);
  const cuentasVisibles = useMemo(() => new Set(filas.map((f) => f.cuenta)), [filas]);
  const serie = useMemo(() => serie12(mensual, anio, mes, cuentasVisibles.size === filasBase.length ? null : cuentasVisibles), [mensual, anio, mes, cuentasVisibles, filasBase.length]);
  const composicionMes = useMemo(() => {
    if (dimension === 'canal') return canales.map((c) => ({ id: c.id, label: c.label, importe: c.importe, pct: c.pct }));
    return composicion(skuMes.filter((r) => N(r.anio) === anio && N(r.mes) === mes), dimension, null, 8);
  }, [dimension, canales, skuMes, anio, mes]);
  const estados = useMemo(() => porEstado(estadoMes, anio, mes), [estadoMes, anio, mes]);

  const activas = filasBase.filter((f) => f.importe > 0).length;
  // Las cuentas sin fuente de sell out no cuentan en "X de Y cuentas activas".
  const conFuente = filasBase.filter((f) => !f.sinFuente).length;
  const caen = filasBase.filter((f) => f.yoy != null && f.yoy < 0).length;
  const conInvNombres = filasBase.filter((f) => f.invValor != null).map((f) => f.nombre.split(' (')[0].split(' ')[0]);

  const onSort = (col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'nombre' || col === 'erp' || col === 'canal' ? 'asc' : 'desc' }));

  // Selector de mes: últimos 12 con dato.
  const opcionesMes = useMemo(() => {
    const u = ultimoMesConVenta(dias) || { anio, mes };
    return ultimosMeses(u.anio, u.mes, 12).reverse();
  }, [dias, anio, mes]);

  const compartir = async () => {
    const txt = textoResumenMes({
      anio, mes, tot: totalesGlobal, canales,
      top: [...filasBase].sort((a, b) => b.importe - a.importe),
      corteDia: corteDia < 28 ? corteDia : null, cuentasActivas: activas, cuentasTotal: conFuente,
    });
    try { await navigator.clipboard.writeText(txt); toast.ok('Resumen copiado'); }
    catch { toast.error('No se pudo copiar el resumen'); }
  };

  if (!puedeVerPestanaGlobal(perfil, 'sell_out')) return <SinAcceso motivo="No tienes acceso a Sell Out." />;
  if (cargandoCuentas || cargandoDias || cargandoMes) return <Cargando pantalla="sellOutGlobal" minHeight={560} />;

  const mesLbl = MESES[mes - 1];
  const periodoLbl = `${etiquetaMes(anio, mes)}${corteDia < 28 ? ` · al día ${corteDia}` : ''} · sin IVA`;
  const sel = { height: 30, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer' };

  // Columnas compactas: el Nº de cliente va dentro de la celda del nombre; sucursales, clientes finales y vendedores
  // viven en el drill. Regla: la tabla cabe en la tarjeta, nada de desplazarse a lo ancho.
  const columnas = [
    { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 190, sort: true, render: (f) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: f.propio ? 600 : 500 }}>{f.nombre}</span>
        {f.erp && <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{f.erp}</span>}
        {f.propio && <Pill tone="inverse" size="xs">propio</Pill>}
      </span>
    ) },
    { key: 'canal', label: 'Canal', align: 'left', width: 84, sort: true, render: (f) => <Pill tone={canalTone(f.canal)} size="xs">{canalLabel(f.canal)}</Pill> },
    // `sinFuente` = el cliente existe en el ERP y factura, pero nadie reporta su sell out
    // (Ingram retail representados, 04126). Se pinta "—", nunca $0.
    { key: 'importe', label: `SO ${mesLbl}`, sort: true, bold: true, fmt: money, render: (f) => (f.sinFuente ? <span style={{ color: theme.textMuted }} title="Este cliente no reporta sell out a nadie">—</span> : money(f.importe)) },
    { key: 'yoy', label: 'YoY', width: 64, sort: true, render: (f) => (f.sinFuente ? '—' : <DeltaPill value={f.yoy} />), renderTotal: (v) => <DeltaPill value={v} /> },
    { key: 'ytd', label: 'YTD', sort: true, fmt: fmtMoney, render: (f) => (f.sinFuente ? '—' : fmtMoney(f.ytd)) },
    { key: 'sellIn', label: `SI ${mesLbl}`, sort: true, fmt: money, render: (f) => (f.cuenta === 'directo' ? <span style={{ color: theme.textMuted }}>=</span> : money(f.sellIn)) },
    { key: 'soSi', label: 'SO/SI', width: 60, sort: true, render: (f) => (f.soSi == null ? '—' : <span title={f.soSi > 999 ? `${Math.round(f.soSi).toLocaleString('es-MX')} % — el sell in del mes apenas empieza` : undefined} style={{ color: f.soSi < 60 ? theme.orange : f.soSi > 999 ? theme.textMuted : theme.text }}>{f.soSi > 999 ? '> 999 %' : fmtPct(f.soSi)}</span>), renderTotal: (v) => fmtPct(v) },
    { key: 'invValor', label: 'Inv. cliente', sort: true, fmt: fmtMoney, render: (f) => (f.invValor == null ? <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span> : fmtMoney(f.invValor)) },
    { key: 'invSemanas', label: 'Sem.', width: 48, sort: true, render: (f) => (f.invSemanas == null ? '—' : <span style={{ color: f.invSemanas > 12 ? theme.orange : theme.text }}>{f.invSemanas.toFixed(1)}</span>) },
    // Tendencia 6 m como mini trazo (90 px) en lugar de seis pastillas (≈ 280 px): la tabla cabe en la tarjeta.
    { key: 'tendencia', label: '6 m', align: 'left', width: 96, render: (f) => (
      f.sinFuente ? <span style={{ color: theme.textMuted, fontSize: 10.5 }}>—</span> : (
        <div style={{ width: 90 }}>
          <GraficaLineas mini alto={22} datos={f.tendencia.map((v, i) => ({ x: String(i), v: Number(v) || 0 }))} series={[{ key: 'v', tipo: 'principal' }]} />
        </div>
      )
    ) },
  ];
  const totalesFila = {
    nombre: `${filas.length} cuentas`, canal: '',
    importe: totales.importe, yoy: totales.yoy, ytd: totales.ytd, sellIn: totales.sellIn, soSi: totales.soSi,
    invValor: totales.invValor, invSemanas: '', tendencia: '',
  };

  const excel = () => ({
    titulo: 'Sell Out consolidado', archivo: `Sell Out ${etiquetaMes(anio, mes)}`,
    hojas: [{
      nombre: 'Cuentas', subtitulo: `${periodoLbl} · ${filas.length} cuentas`,
      columnas: [
        { label: 'Nº cliente', key: 'erp', tipo: 'texto', ancho: 10 }, { label: 'Cliente', key: 'nombre', tipo: 'texto', ancho: 34 },
        { label: 'Canal', key: 'canalTxt', tipo: 'texto', ancho: 14 },
        { label: `Sell out ${mesLbl}`, key: 'importe', tipo: 'moneda', ancho: 15 },
        { label: 'Piezas', key: 'cantidad', tipo: 'numero', ancho: 10 },
        { label: `Sell out ${mesLbl} ${anio - 1}`, key: 'importePrev', tipo: 'moneda', ancho: 15 },
        { label: 'Δ YoY', key: 'yoy', tipo: 'pct', ancho: 9 },
        { label: `YTD ${anio}`, key: 'ytd', tipo: 'moneda', ancho: 15 }, { label: `YTD ${anio - 1}`, key: 'ytdPrev', tipo: 'moneda', ancho: 15 },
        { label: `Sell in ${mesLbl}`, key: 'sellIn', tipo: 'moneda', ancho: 15 }, { label: 'Sell out / sell in', key: 'soSi', tipo: 'pct', ancho: 11 },
        { label: 'Inventario en el cliente', key: 'invValor', tipo: 'moneda', ancho: 16 }, { label: 'Piezas inv.', key: 'invPiezas', tipo: 'numero', ancho: 11 },
        { label: 'Semanas inv.', key: 'invSemanas', tipo: 'numero', ancho: 11 },
        { label: 'Sucursales', key: 'sucursales', tipo: 'numero', ancho: 10 }, { label: 'Clientes finales', key: 'clientesFinales', tipo: 'numero', ancho: 12 },
        { label: 'Vendedores', key: 'vendedores', tipo: 'numero', ancho: 10 },
      ],
      filas: filas.map((f) => ({ ...f, canalTxt: canalLabel(f.canal) })),
      totales: { nombre: 'TOTAL', importe: totales.importe, ytd: totales.ytd, sellIn: totales.sellIn, invValor: totales.invValor, sucursales: totales.sucursales, clientesFinales: totales.clientesFinales, vendedores: totales.vendedores },
    }],
  });

  const nFiltros = (canalSel !== 'todos' ? 1 : 0) + (origen !== 'todos' ? 1 : 0) + (dimSel ? 1 : 0) + (estadoSel ? 1 : 0) + Object.values(flags).filter(Boolean).length;
  const limpiar = () => { setCanalSel('todos'); setOrigen('todos'); setDimSel(null); setEstadoSel(null); setFlags({ caen: false, sinCliente: false, conInv: false }); };

  return (
    <div ref={rootRef} data-stagger style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select value={`${anio}-${mes}`} onChange={(e) => { const [a, m] = e.target.value.split('-').map(Number); setAnio(a); setMes(m); setMesTocado(true); }} style={sel} title="Mes del sell out">
            {opcionesMes.map((o) => <option key={`${o.anio}-${o.mes}`} value={`${o.anio}-${o.mes}`}>{MESES[o.mes - 1]} {o.anio}</option>)}
          </select>
          <select value={anio} onChange={(e) => { setAnio(Number(e.target.value)); setMesTocado(true); }} style={sel} title="Año (siempre se compara contra el anterior)">
            {(anios.length ? anios : [anio]).map((y) => <option key={y} value={y}>{y} vs {y - 1}</option>)}
          </select>
          <Segmented options={CANAL_SEG} value={canalSel} onChange={setCanalSel} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Boton icon={Share2} onClick={compartir}>Compartir resumen del mes</Boton>
          <ExportMenu titulo="Sell Out consolidado" subtitulo={periodoLbl} excel={excel} pdf={{ ref: rootRef }} />
        </div>
      </div>

      <Hero eyebrow={`Dirección Comercial · Sell Out · ${periodoLbl}`} dot={false}
        titulo={fraseHero(totalesGlobal, anio, mes, activas, conFuente)}
        sub={subHero(canales, totalesGlobal, activas, conFuente, caen, conInvNombres)}
        stats={[
          { k: `Sell out ${mesLbl}`, v: fmtMoney(totalesGlobal.importe), sub: `${totalesGlobal.yoy == null ? 'sin comparativo' : `${fmtSigno(totalesGlobal.yoy)} vs ${anio - 1}`} · ${fmtInt(totalesGlobal.cantidad)} pz` },
          { k: `YTD ${anio}`, v: fmtMoney(totalesGlobal.ytd), sub: totalesGlobal.yoyYtd == null ? `sin ${anio - 1}` : `${fmtSigno(totalesGlobal.yoyYtd)} vs ${anio - 1}` },
          { k: 'Sell out / sell in', v: totalesGlobal.soSi == null ? '—' : fmtPct(totalesGlobal.soSi), sub: 'del mes' },
        ]}>
        <div style={{ marginTop: 8 }}>
          <FrescuraPill pantalla="sellOutGlobal" detallado inverso
            etiquetas={{ sellout_general: 'Puente', sellout_pcel: 'PCEL', inventario_cliente: 'Inv. clientes' }} />
        </div>
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Inventario en clientes" badge={{ l: `${totalesGlobal.conInventario} clientes`, tone: 'blue' }}
          big={fmtMoney(totalesGlobal.invValor)} bigSmall={`${fmtInt(totalesGlobal.invPiezas)} pz`}
          sub={semanasTexto(filasBase)} />
        <KpiCard eyebrow={`Clientes finales · ${mesLbl}`} badge={kpiBadge(filasBase, 'cfNuevos', '+', 'nuevos')}
          big={fmtInt(sumar(filasBase, 'clientesFinales'))} bigSmall="en el mes"
          sub={`recompra ${fmtPct(promedioPonderado(filasBase, 'cfRecompra', 'clientesFinales'))} · ${fmtInt(sumar(filasBase, 'cfPerdidos'))} perdidos vs el mes anterior`} />
        <KpiCard eyebrow="Vendedores activos" badge={{ l: 'mayoreo', tone: 'gray' }}
          big={fmtInt(sumar(filasBase, 'vendedores'))}
          sub={`${fmtInt(sumar(filasBase, 'vendRecurrentes'))} venden los últimos 3 meses · ${fmtInt(sumar(filasBase, 'vendNuevos'))} nuevos · ${fmtInt(sumar(filasBase, 'vendPerdidos'))} perdidos`} />
        <KpiCard eyebrow="Sin estado / sin cliente final"
          badge={totalesGlobal.pctSinEstado != null ? { l: fmtPct(totalesGlobal.pctSinEstado), tone: totalesGlobal.pctSinEstado > 25 ? 'orange' : 'gray' } : undefined}
          big={fmtMoney(totalesGlobal.sinEstado)} bigSmall="del mayoreo"
          bigColor={totalesGlobal.pctSinEstado > 25 ? theme.orange : undefined}
          sub={sinDatoTexto(filasBase)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(0, 1fr)', gap: 8 }}>
        <GraficaLineas
          titulo="Evolución 12 meses" meta="sell out por canal + sell in"
          acciones={<Segmented options={MODOS} value={modo} onChange={setModo} />}
          datos={serie.map((d) => ({
            x: d.x,
            total: modo === 'piezas' ? d.totalPz : d.total,
            mayoreo: modo === 'piezas' ? d.mayoreoPz : d.mayoreo,
            distribuidor: modo === 'piezas' ? d.distribuidorPz : d.distribuidor,
            directo: modo === 'piezas' ? d.directoPz : d.directo,
            sellIn: modo === 'piezas' ? d.sellInPz : d.sellIn,
          }))}
          series={[
            { key: 'total', label: 'Sell out total', tipo: 'principal' },
            { key: 'sellIn', label: 'Sell in', tipo: 'anterior' },
            { key: 'mayoreo', label: 'Mayoreo', tipo: 'linea', color: theme.purple },
            { key: 'distribuidor', label: 'Distribuidores', tipo: 'linea', color: theme.teal || theme.indigo },
            { key: 'directo', label: 'Directo', tipo: 'linea', color: theme.orange },
          ]}
          alto={230} formato={modo === 'piezas' ? fmtInt : moneyCompact} />

        <Panel titulo="Composición del mes" meta={dimSel ? 'clic otra vez para quitar el filtro' : 'clic para filtrar la tabla'}
          acciones={<Segmented options={DIMENSIONES} value={dimension} onChange={(d) => { setDimension(d); setDimSel(null); }} />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {composicionMes.length === 0 && <span style={{ fontSize: 11, color: theme.textMuted }}>Sin venta este mes.</span>}
            {composicionMes.map((c) => {
              const on = dimSel === c.id;
              return (
                <button key={c.id} type="button" onClick={() => setDimSel(on ? null : c.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, background: on ? (theme.surfaceHover || 'rgba(0,0,0,0.04)') : 'transparent',
                    border: `1px solid ${on ? (theme.accent || '#007AFF') : 'transparent'}`, borderRadius: 8, padding: '3px 6px', cursor: 'pointer', textAlign: 'left', color: theme.text, font: 'inherit', fontSize: 11 }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.label}</span>
                  <div style={{ width: 64, height: 4, borderRadius: 999, background: `${theme.text}12`, overflow: 'hidden', flexShrink: 0 }}>
                    <div style={{ width: `${Math.min(100, c.pct || 0)}%`, height: '100%', background: theme.accent || '#007AFF', borderRadius: 999 }} />
                  </div>
                  <Pill tone={on ? 'blue' : 'gray'} size="xs">{fmtPct(c.pct)} · {fmtMoney(c.importe)}</Pill>
                </button>
              );
            })}
          </div>
        </Panel>
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <Buscador value={busqueda} onChange={setBusqueda} resultados={busqueda ? `${filas.length}` : null}
          placeholder="Buscar por nombre o Nº de cliente…" width={320} />
        <Segmented options={ORIGENES} value={origen} onChange={setOrigen} />
        <span style={{ fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {filas.length} cuentas · {fmtInt(totales.clientesFinales)} clientes finales
        </span>
      </div>

      <Filtros
        grupos={[{
          id: 'canal', label: 'Canal', sel: new Set(canalSel === 'todos' ? [] : [canalSel]),
          opciones: CANALES.map((c) => ({ id: c.id, label: c.label, tone: c.tone, n: filasBase.filter((f) => f.canal === c.id && f.importe > 0).length })),
        }]}
        toggles={[
          { id: 'caen', label: 'Caen vs el año pasado', on: flags.caen, n: caen },
          { id: 'sinCliente', label: 'Sin cliente final', on: flags.sinCliente, n: filasBase.filter((f) => f.clientesFinales == null || f.clientesFinales === 0).length },
          { id: 'conInv', label: 'Con inventario', on: flags.conInv, n: filasBase.filter((f) => f.invValor != null).length },
        ]}
        onToggle={(_g, id) => setCanalSel((c) => (c === id ? 'todos' : id))}
        onToggleFlag={(id) => setFlags((f) => ({ ...f, [id]: !f[id] }))}
        onLimpiar={limpiar} activos={nFiltros} />

      {estadoSel && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: theme.textMuted }}>
          Filtrado por estado:
          <Pill tone="blue" size="xs" onClick={() => setEstadoSel(null)} style={{ cursor: 'pointer' }}>{capitalizarEstado(estadoSel)} ✕</Pill>
        </div>
      )}

      <TablaCompacta columnas={columnas} filas={filas} rowKey={(f) => f.cuenta} orden={orden} onSort={onSort}
        totales={totalesFila} maxHeight={620} vacio="Ninguna cuenta coincide con el filtro."
        onRowClick={(f) => { if (f.sinFuente) return; setAbierto((k) => (k === f.cuenta ? null : f.cuenta)); }}
        expandidoKey={abierto}
        renderExpandido={(f) => <DrillCuenta fila={f} anio={anio} mes={mes} corteDia={corteDia} estadoSel={estadoSel} onEstado={setEstadoSel} />} />

      <Panel titulo="Mapa · dónde se vende" meta={`${MESES[mes - 1]} ${anio} · sólo las fuentes que traen estado del cliente final`} plegable abiertoInicial={false} onToggle={setMapaAbierto}>
        {(mapaAbierto || estadoSel) && (
          <Suspense fallback={<Cargando silueta={[{ tipo: 'panel', chart: 420 }]} minHeight={420} />}>
            <MapaMexico datos={estados} seleccion={estadoSel} onSelect={setEstadoSel} alto={420} />
          </Suspense>
        )}
      </Panel>
    </div>
  );
}

// ── auxiliares de pantalla ────────────────────────────────────────────────────
const sumar = (filas, campo) => filas.reduce((s, f) => s + (f[campo] == null ? 0 : Number(f[campo])), 0);

function promedioPonderado(filas, campo, peso) {
  let num = 0, den = 0;
  for (const f of filas) {
    if (f[campo] == null || !f[peso]) continue;
    num += Number(f[campo]) * Number(f[peso]); den += Number(f[peso]);
  }
  return den ? num / den : null;
}
function kpiBadge(filas, campo, signo, texto) {
  const v = sumar(filas, campo);
  return v ? { l: `${signo}${fmtInt(v)} ${texto}`, tone: 'green' } : undefined;
}
/** "5.1 semanas al ritmo del sell out · Digitalife $7.4 M" */
function semanasTexto(filas) {
  const conInv = filas.filter((f) => f.invValor != null);
  if (!conInv.length) return 'Ningún cliente reporta inventario este mes.';
  const pz = conInv.reduce((s, f) => s + Number(f.invPiezas || 0), 0);
  const sem = promedioPonderado(conInv, 'invSemanas', 'invPiezas');
  const mayor = [...conInv].sort((a, b) => b.invValor - a.invValor)[0];
  return `${sem == null ? '—' : `${sem.toFixed(1)} semanas`} al ritmo del sell out · ${mayor.nombre.split(' (')[0]} ${fmtMoney(mayor.invValor)}`;
}
/** Nombra las cuentas de mayoreo que no reportan cliente final. */
function sinDatoTexto(filas) {
  const sin = filas.filter((f) => f.canal === 'mayoreo' && f.importe > 0 && (f.clientesFinales == null || f.clientesFinales === 0))
    .map((f) => f.nombre.split(' ')[0]);
  if (!sin.length) return 'Todas las cuentas de mayoreo reportan cliente final.';
  return `${sin.slice(0, 4).join(', ')}${sin.length > 4 ? ` y ${sin.length - 4} más` : ''} no reportan cliente final.`;
}
