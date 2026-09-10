// Análisis por Cliente (web, V3) · todos los clientes del ERP con las medidas del director
// por cliente (código ERP) y mes: Hero + 4 KPIs · tabla ordenable con drill-down por fila ·
// Pareto 80 % · comparador de periodos por cliente. Datos: v_analisis_cliente_mes (MV) vía
// analisis/useAnalisisData; cálculo puro en analisis/calc.js.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { useAlertas } from '../../lib/alertas';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Pill, DeltaPill, Segmented, TablaCompacta, Panel, Cargando } from '../../components/kit';
import ComparadorPeriodos from './ComparadorPeriodos';
import { useAniosDisponibles, useAnalisisClientes } from './analisis/useAnalisisData';
import { MESES, PROPIOS, OTROS_KEY, OCASIONAL, agregarClientes, filaOtros, aplanar, ultimoMesConVenta, totalesMensuales, idxMes, yoyDe, mcDe, ajustesDe, sumarPeriodo, pctDe, vacio } from './analisis/calc';
import { money, moneyFull, int, pct, signo, toneDe, toneCanal, labelCanal } from './analisis/formato';
import DrillCliente from './analisis/DrillCliente';
import ParetoPanel from './analisis/ParetoPanel';

const MODOS = [{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }];
const ORIGENES = [{ id: 'todos', label: 'Todos' }, { id: 'propios', label: 'Propios' }, { id: 'erp', label: 'ERP' }];

export default function AnalisisClientesGlobal() {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const verSensible = puedeVerSensible(perfil);
  const rootRef = useRef(null);
  const hoy = new Date();
  const [anio, setAnio] = useState(hoy.getFullYear());
  const [modo, setModo] = useState('mes');
  const [busqueda, setBusqueda] = useState('');
  const [canalFiltro, setCanalFiltro] = useState('TODOS');
  const [origen, setOrigen] = useState('todos');
  const [orden, setOrden] = useState({ col: 'fact_neta', dir: 'desc' });
  const [abierto, setAbierto] = useState(null);
  const [compCliente, setCompCliente] = useState(null);

  const { data: anios = [] } = useAniosDisponibles();
  const { data: rows, isLoading } = useAnalisisClientes(anio);
  const { data: alertas = [] } = useAlertas({ enabled: true });

  useEffect(() => { if (anios.length && !anios.includes(anio)) setAnio(anios[0]); }, [anios, anio]);
  useEffect(() => { setAbierto(null); }, [anio, modo, canalFiltro, origen, busqueda]);

  const mesMax = useMemo(() => ultimoMesConVenta(rows || [], anio) || (anio === hoy.getFullYear() ? hoy.getMonth() + 1 : 12), [rows, anio]);
  const agg = useMemo(() => agregarClientes(rows || [], anio, mesMax, modo), [rows, anio, mesMax, modo]);
  const global = useMemo(() => {
    const r = rows || [];
    const tm = totalesMensuales(r);
    const mes = tm.get(idxMes(anio, mesMax)) || vacio();
    const mesPrev = tm.get(idxMes(anio - 1, mesMax)) || vacio();
    const ytd = sumarPeriodo(r, anio, mesMax, 'ytd'), ytdPrev = sumarPeriodo(r, anio - 1, mesMax, 'ytd');
    return { mes, mesPrev, ytd, ytdPrev, yoyMes: yoyDe(mes.fact_neta, mesPrev.fact_neta), yoyYtd: yoyDe(ytd.fact_neta, ytdPrev.fact_neta), mcYtd: mcDe(ytd), mcYtdPrev: mcDe(ytdPrev), ajustesMes: ajustesDe(mes), ajustesMesPrev: ajustesDe(mesPrev) };
  }, [rows, anio, mesMax]);

  const canales = useMemo(() => Array.from(new Set(agg.clientes.map((c) => c.canal).filter(Boolean))).sort(), [agg]);

  // Filtros → filas planas; los ocasionales se agrupan en una sola fila (siempre al final).
  const { filas, ocasionales, totales } = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const filtrar = (arr) => {
      let l = arr;
      if (canalFiltro !== 'TODOS') l = l.filter((c) => c.canal === canalFiltro);
      if (origen === 'propios') l = l.filter((c) => c.propio);
      if (origen === 'erp') l = l.filter((c) => !c.propio);
      if (q) l = l.filter((c) => c.nombre.toUpperCase().includes(q) || String(c.cliente).toUpperCase().includes(q));
      return l;
    };
    const lista = filtrar(agg.clientes);
    const perdidos = filtrar(agg.soloPrev); // sólo compraron el año anterior: cuentan en el YoY del total
    const regulares = lista.filter((c) => !c.ocasional).map(aplanar);
    const ocas = lista.filter((c) => c.ocasional).map(aplanar);
    const dir = orden.dir === 'asc' ? 1 : -1;
    const col = orden.col;
    regulares.sort((a, b) => {
      const va = a[col], vb = b[col];
      if (typeof va === 'string' || typeof vb === 'string') return String(va ?? '').localeCompare(String(vb ?? '')) * dir;
      return ((va ?? -Infinity) - (vb ?? -Infinity)) * dir;
    });
    const filas = ocas.length ? [...regulares, aplanar(filaOtros(ocas))] : regulares;
    const tot = { cliente: `${lista.length} clientes`, nombre: null, fact_bruta: 0, devoluciones: 0, rmas: 0, bonificaciones: 0, fact_neta: 0, venta_neta: 0, piezas: 0, contribucion: 0, prevFn: 0 };
    for (const c of lista) { for (const k of ['fact_bruta', 'devoluciones', 'rmas', 'bonificaciones', 'fact_neta', 'venta_neta', 'contribucion']) tot[k] += c.cur[k]; tot.piezas += c.cur.piezas_venta_neta; tot.prevFn += c.prev.fact_neta; }
    for (const c of perdidos) tot.prevFn += c.prev.fact_neta;
    tot.yoy = yoyDe(tot.fact_neta, tot.prevFn); tot.mc = pctDe(tot.contribucion, tot.fact_neta);
    return { filas, ocasionales: ocas, totales: tot };
  }, [agg, busqueda, canalFiltro, origen, orden]);

  const onSort = (col) => setOrden((o) => (o.col === col ? { col, dir: o.dir === 'asc' ? 'desc' : 'asc' } : { col, dir: col === 'nombre' || col === 'cliente' || col === 'canal' ? 'asc' : 'desc' }));

  if (!puedeVerPestanaGlobal(perfil, 'analisis_clientes')) return <SinAcceso motivo="No tienes acceso a Análisis por Cliente." />;
  if (isLoading || !rows) return <Cargando pantalla="analisisClientes" minHeight={520} />;

  const mesLbl = MESES[mesMax - 1];
  const periodoLbl = modo === 'mes' ? `${mesLbl} ${anio}` : `YTD ene–${mesLbl.toLowerCase()} ${anio}`;
  const esParcial = anio === hoy.getFullYear() && mesMax === hoy.getMonth() + 1;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const sel = { height: 30, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer' };
  const sensibleTip = 'Sólo visible con permiso de información sensible';

  const columnas = [
    { key: 'cliente', label: 'Nº cliente', align: 'left', width: 78, mono: true, sort: true, render: (r) => <span style={{ color: r.esGrupo ? theme.textMuted : theme.text, fontSize: 10.5 }}>{r.esGrupo ? '—' : r.cliente}</span> },
    { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 240, sort: true, render: (r) => (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: r.esGrupo || r.propio ? 600 : 500 }}>{r.nombre}</span>
        {r.propio && <Pill tone="inverse" size="xs">propio</Pill>}
      </span>
    ) },
    { key: 'canal', label: 'Canal', align: 'left', width: 92, sort: true, render: (r) => (r.esGrupo ? <span style={{ color: theme.textMuted, fontSize: 10.5 }}>varios</span> : <Pill tone={toneCanal(r.canal)} size="xs">{labelCanal(r.canal)}</Pill>) },
    { key: 'fact_bruta', fmt: moneyFull, label: 'Fact. bruta', sort: true, sum: true, render: (r) => moneyFull(r.fact_bruta) },
    { key: 'devoluciones', fmt: moneyFull, label: 'Devoluciones', sort: true, sum: true, render: (r) => <span style={{ color: r.devoluciones < 0 ? theme.red : theme.textMuted }}>{moneyFull(r.devoluciones)}</span> },
    { key: 'rmas', fmt: moneyFull, label: 'Notas crédito', sort: true, sum: true, render: (r) => <span style={{ color: r.rmas < 0 ? theme.red : theme.textMuted }}>{moneyFull(r.rmas)}</span> },
    { key: 'bonificaciones', fmt: moneyFull, label: 'Bonif.', sort: true, sum: true, render: (r) => <span style={{ color: r.bonificaciones < 0 ? theme.orange : theme.textMuted }}>{moneyFull(r.bonificaciones)}</span> },
    { key: 'fact_neta', fmt: moneyFull, label: 'Fact. neta', sort: true, sum: true, bold: true, render: (r) => moneyFull(r.fact_neta) },
    { key: 'venta_neta', fmt: moneyFull, label: 'Venta neta', sort: true, sum: true, render: (r) => moneyFull(r.venta_neta) },
    { key: 'piezas', fmt: int, label: 'Piezas', sort: true, sum: true, render: (r) => int(r.piezas) },
    { key: 'yoy', label: 'Δ YoY', width: 78, sort: true, render: (r) => <DeltaPill value={r.yoy} />, renderTotal: (v) => <DeltaPill value={v} /> },
    ...(verSensible ? [{ key: 'mc', label: 'MC %', width: 62, sort: true, render: (r) => <span style={{ color: r.mc == null ? theme.textMuted : r.mc < 0 ? theme.red : theme.text }}>{pct(r.mc)}</span>, renderTotal: (v) => pct(v) }] : []),
    { key: 'sellout', label: 'Sell-out', width: 64, render: () => <span title="Próximamente" style={{ color: theme.textSubtle || theme.textMuted }}>—</span> },
  ];
  const totalesFila = { ...totales, mc: totales.mc, yoy: totales.yoy, sellout: '' };

  const excelClientes = () => {
    const todos = [...agg.clientes].filter((c) => (origen === 'propios' ? c.propio : origen === 'erp' ? !c.propio : true)).filter((c) => canalFiltro === 'TODOS' || c.canal === canalFiltro).map(aplanar).sort((a, b) => b.fact_neta - a.fact_neta);
    return {
      titulo: `Análisis por cliente ${anio}`, archivo: `Analisis por cliente ${periodoLbl}`,
      hojas: [{
        nombre: 'Clientes', subtitulo: `${periodoLbl}${canalFiltro !== 'TODOS' ? ` · ${canalFiltro}` : ''} · ${todos.length} clientes`,
        columnas: [
          { label: 'Nº cliente', key: 'cliente', tipo: 'texto', ancho: 10 }, { label: 'Cliente', key: 'nombre', tipo: 'texto', ancho: 34 }, { label: 'Canal', key: 'canal', tipo: 'texto', ancho: 16 },
          { label: 'Propio', key: 'propioTxt', tipo: 'texto', ancho: 8 }, { label: 'Compra ocasional', key: 'ocasTxt', tipo: 'texto', ancho: 10 },
          { label: 'Fact. bruta', key: 'fact_bruta', tipo: 'moneda', ancho: 15 }, { label: 'Devoluciones', key: 'devoluciones', tipo: 'moneda', ancho: 14 }, { label: 'Notas de crédito', key: 'rmas', tipo: 'moneda', ancho: 14 },
          { label: 'Bonificaciones', key: 'bonificaciones', tipo: 'moneda', ancho: 14 }, { label: 'Fact. neta', key: 'fact_neta', tipo: 'moneda', ancho: 15 }, { label: 'Venta neta', key: 'venta_neta', tipo: 'moneda', ancho: 15 },
          { label: 'Piezas', key: 'piezas', tipo: 'numero', ancho: 10 }, { label: `Fact. neta ${anio - 1}`, key: 'prevFn', tipo: 'moneda', ancho: 15 }, { label: 'Δ YoY', key: 'yoy', tipo: 'pct', ancho: 9 },
          ...(verSensible ? [{ label: 'MC %', key: 'mc', tipo: 'pct', ancho: 8 }] : []),
        ],
        filas: todos.map((c) => ({ ...c, propioTxt: c.propio ? 'Sí' : '', ocasTxt: c.ocasional ? 'Sí' : '', prevFn: c.prev.fact_neta })),
        totales: { nombre: 'TOTAL', fact_bruta: totales.fact_bruta, devoluciones: totales.devoluciones, rmas: totales.rmas, bonificaciones: totales.bonificaciones, fact_neta: totales.fact_neta, venta_neta: totales.venta_neta, piezas: totales.piezas, prevFn: totales.prevFn, yoy: totales.yoy, ...(verSensible ? { mc: totales.mc } : {}) },
      }],
    };
  };

  const compOpciones = agg.clientes.filter((c) => c.ytd.fact_neta > 0).sort((a, b) => b.ytd.fact_neta - a.ytd.fact_neta);
  const compSel = compOpciones.find((c) => c.cliente === compCliente) || compOpciones[0] || null;

  return (
    <div ref={rootRef} data-stagger style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 10, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Segmented options={MODOS} value={modo} onChange={setModo} />
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))} style={sel} title="Año (comparativo contra el anterior)">
            {(anios.length ? anios : [anio]).map((y) => <option key={y} value={y}>{y} vs {y - 1}</option>)}
          </select>
          <span style={{ fontSize: 10.5, color: theme.textMuted }}>{modo === 'mes' ? `Mes · ${mesLbl} ${anio}` : `Acumulado · enero a ${mesLbl.toLowerCase()} ${anio}`}{esParcial ? ' · mes en curso' : ''}</span>
        </div>
        <ExportMenu titulo="Análisis por cliente" subtitulo={periodoLbl} excel={excelClientes} pdf={{ ref: rootRef }} />
      </div>

      <Hero eyebrow={`Dirección Comercial · Análisis por cliente · ${periodoLbl}`} dot={false}
        titulo={`${money(modo === 'mes' ? global.mes.fact_neta : global.ytd.fact_neta)} de facturación neta en ${int(agg.clientes.filter((c) => c.cur.fact_neta > 0).length)} clientes.`}
        sub={`Los 10 primeros concentran el ${pct(agg.concentracion10, 0)} · ${int(agg.clientes.filter((c) => c.ocasional).length)} clientes de compra ocasional (< ${OCASIONAL.MIN_MESES} meses con compra en ${OCASIONAL.VENTANA} o < ${(OCASIONAL.PCT_MIN * 100).toFixed(1)} % del YTD) van agrupados en "Otros".`}
        stats={[
          { k: `Fact. neta ${mesLbl}`, v: money(global.mes.fact_neta), sub: global.yoyMes != null ? `${signo(global.yoyMes)} vs ${anio - 1}` : `sin ${anio - 1}` },
          { k: `YTD ${anio}`, v: money(global.ytd.fact_neta), sub: global.yoyYtd != null ? `${signo(global.yoyYtd)} vs ${anio - 1}` : `sin ${anio - 1}` },
          { k: `Clientes activos ${mesLbl}`, v: int(agg.activosMes), sub: `de ${int(agg.clientes.length)} en el año` },
        ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow={`Fact. neta · ${mesLbl} ${anio}`} badge={global.yoyMes != null ? { l: `${signo(global.yoyMes)} YoY`, tone: toneDe(global.yoyMes) } : undefined}
          big={money(global.mes.fact_neta)} bigSmall={`vs ${money(global.mesPrev.fact_neta)}`} sub={`${mesLbl} ${anio - 1} · ${int(global.mes.piezas_venta_neta)} pzs`} />
        <KpiCard eyebrow={`YTD ene–${mesLbl.toLowerCase()} ${anio}`} badge={global.yoyYtd != null ? { l: `${signo(global.yoyYtd)} YoY`, tone: toneDe(global.yoyYtd) } : undefined}
          big={money(global.ytd.fact_neta)} bigSmall={`vs ${money(global.ytdPrev.fact_neta)}`} sub={`mismo periodo ${anio - 1} · ${int(global.ytd.piezas_venta_neta)} pzs`} />
        <KpiCard eyebrow={`Dev + NC + bonif · ${mesLbl}`} badge={global.ajustesMes != null && global.ajustesMesPrev != null ? { l: `${signo(global.ajustesMes - global.ajustesMesPrev)} pp`, tone: global.ajustesMes - global.ajustesMesPrev <= 0 ? 'green' : 'red' } : undefined}
          big={pct(global.ajustesMes)} bigSmall="de la fact. bruta" bigColor={global.ajustesMes > 5 ? theme.red : undefined}
          sub={`dev ${money(global.mes.devoluciones)} · NC ${money(global.mes.rmas)} · bonif ${money(global.mes.bonificaciones)}`} />
        {verSensible
          ? <KpiCard eyebrow={`MC % · YTD ${anio}`} badge={global.mcYtd != null && global.mcYtdPrev != null ? { l: `${signo(global.mcYtd - global.mcYtdPrev)} pp`, tone: toneDe(global.mcYtd - global.mcYtdPrev) } : undefined}
              big={pct(global.mcYtd)} bigSmall={`contribución ${money(global.ytd.contribucion)}`} sub={`MC ${anio - 1}: ${pct(global.mcYtdPrev)}`} />
          : <KpiCard eyebrow="MC % · YTD" big="—" bigSmall="sensible" sub={sensibleTip} />}
      </div>

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 220, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30 }}>
          <Search size={13} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o Nº de cliente…" style={{ flex: 1, outline: 'none', fontSize: 12, background: 'transparent', border: 'none', color: theme.text, fontFamily: 'inherit' }} />
          {busqueda && <button onClick={() => setBusqueda('')} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: theme.textMuted, padding: 2, display: 'inline-flex' }}><X size={13} /></button>}
        </div>
        <select value={canalFiltro} onChange={(e) => setCanalFiltro(e.target.value)} style={sel}>
          <option value="TODOS">Todos los canales</option>
          {canales.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <Segmented options={ORIGENES} value={origen} onChange={setOrigen} />
        <span style={{ fontSize: 10.5, color: theme.textMuted, ...mono }}>{filas.length - (ocasionales.length ? 1 : 0)} recurrentes · {ocasionales.length} ocasionales</span>
      </div>

      <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.cliente} orden={orden} onSort={onSort} totales={totalesFila} maxHeight={640}
        vacio="Ningún cliente coincide con el filtro."
        onRowClick={(r) => setAbierto((k) => (k === r.cliente ? null : r.cliente))}
        expandidoKey={abierto}
        renderExpandido={(r) => (r.esGrupo
          ? (
            <div style={{ padding: 10, background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)' }}>
              <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 6 }}>Clientes de compra ocasional en el filtro actual · ordenados por fact. neta del periodo.</div>
              <TablaCompacta dense maxHeight={320} rowKey={(h) => h.cliente} filas={[...r.hijos].sort((a, b) => b.fact_neta - a.fact_neta)}
                columnas={[
                  { key: 'cliente', label: 'Nº', align: 'left', width: 70, mono: true },
                  { key: 'nombre', label: 'Cliente', align: 'left', maxWidth: 260 },
                  { key: 'canal', label: 'Canal', align: 'left', width: 90, render: (h) => <Pill tone={toneCanal(h.canal)} size="xs">{labelCanal(h.canal)}</Pill> },
                  { key: 'fact_neta', label: 'Fact. neta', render: (h) => moneyFull(h.fact_neta) },
                  { key: 'piezas', label: 'Piezas', render: (h) => int(h.piezas) },
                  { key: 'mesesCompra12', label: 'Meses c/compra (12)', width: 110 },
                  { key: 'ultima', label: 'Última compra', width: 90, render: (h) => (h.ultimaCompra ? `${MESES[h.ultimaCompra.mes - 1]} ${h.ultimaCompra.anio}` : '—') },
                  { key: 'yoy', label: 'Δ YoY', width: 78, render: (h) => <DeltaPill value={h.yoy} /> },
                ]} />
            </div>
          )
          : <DrillCliente cliente={r} anio={anio} mesMax={mesMax} modo={modo} verSensible={verSensible} alertas={alertas} />
        )} />

      <ParetoPanel filas={filas} periodoLbl={periodoLbl} />

      <Panel titulo="Comparador de periodos por cliente" meta={compSel ? compSel.nombre : 'sin clientes'} plegable abiertoInicial={false}
        acciones={(
          <select value={compSel?.cliente || ''} onChange={(e) => setCompCliente(e.target.value)} style={{ ...sel, maxWidth: 280 }}>
            {compOpciones.map((c) => <option key={c.cliente} value={c.cliente}>{c.cliente} · {c.nombre}</option>)}
          </select>
        )}>
        {compSel ? <ComparadorPeriodos clienteNombre={compSel.nombre} clienteCodigo={compSel.cliente} ocultarSensible={!verSensible} /> : <div style={{ fontSize: 11.5, color: theme.textMuted }}>Sin clientes con venta este año.</div>}
      </Panel>
    </div>
  );
}
