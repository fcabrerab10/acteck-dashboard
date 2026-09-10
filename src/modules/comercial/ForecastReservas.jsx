// ForecastReservas.jsx — Forecast (Clientes propios) · V3 kit.
//
// Dos vistas (Segmented en el hero):
//   · Reservas    → recomienda piezas por SKU y cliente con la velocidad de sell-out (método elegible:
//                   3 meses · 6 meses · Ponderado; ver reservas/calculo.js), coteja contra arribos
//                   (embarques_compras) y arma una propuesta de reserva (forecast_propuestas + líneas)
//                   en la hoja lateral "Mi reserva" (pill flotante). Landing con propuestas generadas.
//   · Forecast CRM → captura mensual por cliente y SKU (6 meses) y exportación en la plantilla del CRM
//                   (reservas/Captura.jsx · forecast_crm).
// Avisos de arribo (3 días antes / el día): alertas area 'forecast' generadas por api/cron.js (generar-alertas).
// Piezas en src/modules/comercial/reservas/.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ShoppingCart } from 'lucide-react';
import { DB_CONFIGURED } from '../../lib/supabase';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { Hero, KpiCard, Panel, Pill, Segmented, Boton, Cargando, toast } from '../../components/kit';
import Buscador from './sellin/Buscador';
import Filtros from './sellin/Filtros';
import { fmtFechaCorta } from './inventario/constantes';
import { CLIENTES, ESTADOS_FILA, MESES, fmtInt, tokens, N } from './reservas/textos';
import { METODOS, METODO_DEFAULT, metodoInfo, construirFilas, proxMeses, FILTROS_VACIOS, pasaTodos, nActivos, facetas, mesSiguiente } from './reservas/calculo';
import { useBaseReservas, usePropuestaActiva, useLanding, invalidarPropuesta, invalidarLanding, invalidarDrill, crearPropuesta, upsertLineaDB, eliminarLineaDB, actualizarPropuestaDB, actualizarLineasDB, actualizarLineaDB, vaciarLineasDB, eliminarPropuestaDB } from './reservas/datos';
import TablaReservas from './reservas/TablaReservas';
import DrillSku from './reservas/DrillSku';
import HojaReserva from './reservas/HojaReserva';
import Landing from './reservas/Landing';
import Captura from './reservas/Captura';

const LS_METODO = 'forecastReservas.metodo';
const leerMetodo = () => { try { const v = localStorage.getItem(LS_METODO); return METODOS.some((m) => m.id === v) ? v : METODO_DEFAULT; } catch { return METODO_DEFAULT; } };

export default function ForecastReservas() {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const yoId = perfil?.user_id || null;
  const hoy = useMemo(() => new Date(), []);
  const anioObj = hoy.getFullYear(), mesObj = hoy.getMonth() + 1;

  // ── Preferencias de pantalla ──
  const [metodo, setMetodo] = useState(leerMetodo);
  useEffect(() => { try { localStorage.setItem(LS_METODO, metodo); } catch { /* noop */ } }, [metodo]);
  const [vista, setVista] = useState('reservas');      // 'reservas' | 'crm'
  const [subvista, setSubvista] = useState('armador'); // 'armador' | 'landing'
  const [clienteCrm, setClienteCrm] = useState('digitalife');
  const [mesInicio, setMesInicio] = useState(() => mesSiguiente(hoy));

  // ── Datos ──
  const base = useBaseReservas(hoy);
  const prop = usePropuestaActiva(yoId);
  const landing = useLanding();
  const propuesta = prop.data?.propuesta || null;
  const [lineasLocal, setLineasLocal] = useState(null); // overlay optimista sobre prop.data.lineas
  useEffect(() => { setLineasLocal(null); }, [prop.data]);
  const lineas = lineasLocal || prop.data?.lineas || {};
  const setLineas = (fn) => setLineasLocal((prev) => fn(prev || prop.data?.lineas || {}));

  // ── Filtros / búsqueda / orden / drill ──
  const [busqueda, setBusqueda] = useState('');
  const [f, setF] = useState(FILTROS_VACIOS);
  useEffect(() => { setF((p) => ({ ...p, tokens: tokens(busqueda) })); }, [busqueda]);
  const [orden, setOrden] = useState(null);
  const [expandedSku, setExpandedSku] = useState(null);
  const [hoja, setHoja] = useState(false);
  const [propuestaAbierta, setPropuestaAbierta] = useState(null);
  const [saving, setSaving] = useState(false);

  const meses = useMemo(() => proxMeses(hoy, 3, MESES), [hoy]);
  const filasBase = useMemo(() => {
    if (!base.data) return [];
    const { roadmap, sellout, arribos, inventarioPorSku, stockClientes } = base.data;
    return construirFilas({ roadmap, series: sellout.series, metodo, hoy, arribos, inventarioPorSku, lineas, stockClientes, meses });
  }, [base.data, metodo, hoy, lineas, meses]);
  const filasPorSku = useMemo(() => new Map(filasBase.map((r) => [r.sku, r])), [filasBase]);
  const roadmapSet = useMemo(() => new Set(filasBase.map((r) => r.sku)), [filasBase]);

  const fac = useMemo(() => facetas(filasBase, f, lineas), [filasBase, f, lineas]);
  const filasFiltradas = useMemo(() => {
    const out = filasBase.filter((r) => pasaTodos(r, f, null, lineas));
    if (orden?.col) {
      const d = orden.dir === 'asc' ? 1 : -1;
      out.sort((a, b) => (N(a[orden.col]) - N(b[orden.col])) * d || (a.sort_order ?? 1e9) - (b.sort_order ?? 1e9));
    }
    return out;
  }, [filasBase, f, lineas, orden]);
  const onSort = (col) => setOrden((o) => (o?.col === col ? (o.dir === 'desc' ? { col, dir: 'asc' } : null) : { col, dir: 'desc' }));
  const toggleGrupo = (g, id) => setF((p) => { const s = new Set(p[g]); s.has(id) ? s.delete(id) : s.add(id); return { ...p, [g]: s }; });
  const limpiar = () => { setF((p) => ({ ...FILTROS_VACIOS(), tokens: p.tokens, soloMovimiento: p.soloMovimiento })); };

  // ── KPIs ──
  const kpis = useMemo(() => {
    const totalRecom = filasBase.reduce((a, r) => a + r.recomendado, 0);
    const totalReservo = Object.values(lineas).reduce((a, l) => a + N(l.reservo), 0);
    const conBrecha = filasBase.filter((r) => r.estado === 'con_brecha').length;
    const conArribo30 = filasBase.filter((r) => r.arribo30);
    const pz30 = conArribo30.reduce((a, r) => a + r.pz30, 0);
    return { totalRecom, totalReservo, conBrecha, enPropuesta: Object.keys(lineas).length, conArribo30: conArribo30.length, pz30, proxArribo: base.data?.arribos.proxGlobal || null, futuros: base.data?.arribos.futuros || 0 };
  }, [filasBase, lineas, base.data]);

  const stats = useMemo(() => {
    const cobertura = Object.fromEntries(CLIENTES.map((c) => [c.key, { recom: 0, reservo: 0 }]));
    for (const r of filasBase) {
      for (const c of CLIENTES) cobertura[c.key].recom += r.necesidad[c.key];
      const l = lineas[r.sku];
      if (!l || !N(l.reservo) || r.recomendado === 0) continue;
      const ratio = N(l.reservo) / r.recomendado;
      for (const c of CLIENTES) cobertura[c.key].reservo += r.necesidad[c.key] * ratio;
    }
    const enPropuesta = Object.values(lineas).filter((l) => N(l.reservo) > 0)
      .map((l) => { const r = filasPorSku.get(l.sku); return { sku: l.sku, descripcion: r?.descripcion || l.descripcion || l.sku, reservo: N(l.reservo), recomendado: r?.recomendado ?? N(l.recomendado) }; })
      .sort((a, b) => b.reservo - a.reservo);
    return { cobertura, enPropuesta };
  }, [filasBase, lineas, filasPorSku]);

  // ── Persistencia de la propuesta ──
  const nombreDefault = `Preventa & Reservas · ${MESES[mesObj - 1]} ${anioObj}`;
  const asegurarPropuesta = useCallback(async () => {
    if (propuesta) return propuesta;
    const p = await crearPropuesta({ nombre: nombreDefault, anio: anioObj, mes: mesObj, yoId });
    await invalidarPropuesta();
    return p;
  }, [propuesta, nombreDefault, anioObj, mesObj, yoId]);

  const upsertLinea = useCallback(async (fila, patch) => {
    try {
      const p = await asegurarPropuesta();
      const existing = lineas[fila.sku];
      const payload = {
        propuesta_id: p.id, sku: fila.sku, descripcion: fila.descripcion, marca: fila.marca, familia: fila.familia, roadmap: fila.roadmap,
        necesidad_dgl: fila.necesidad_dgl, necesidad_pce: fila.necesidad_pce, necesidad_dct: fila.necesidad_dct, recomendado: fila.recomendado,
        arribos_snapshot: fila.arribosPorMes, estado: existing?.estado || 'draft', reservo: existing?.reservo || 0, confirmado: existing?.confirmado ?? null, ...patch,
      };
      setLineas((prev) => ({ ...prev, [fila.sku]: { ...(prev[fila.sku] || {}), ...payload } }));
      const data = await upsertLineaDB(payload);
      setLineas((prev) => ({ ...prev, [fila.sku]: data }));
      invalidarDrill(fila.sku);
    } catch (e) { toast.error(`No se pudo guardar: ${e.message || e}`); invalidarPropuesta(); }
  }, [lineas, asegurarPropuesta]); // eslint-disable-line react-hooks/exhaustive-deps

  const eliminarLinea = useCallback(async (sku) => {
    const l = lineas[sku];
    setLineas((prev) => { const c = { ...prev }; delete c[sku]; return c; });
    if (l?.id) { try { await eliminarLineaDB(l.id); invalidarDrill(sku); } catch (e) { toast.error(`No se pudo quitar: ${e.message || e}`); invalidarPropuesta(); } }
  }, [lineas]); // eslint-disable-line react-hooks/exhaustive-deps

  const onReservo = (fila, v) => {
    const l = lineas[fila.sku];
    if (v === 0) { if (l) eliminarLinea(fila.sku); return; }
    upsertLinea(fila, { reservo: v, estado: propuesta?.estatus === 'generada' ? 'pend_confirmar' : (l?.estado || 'draft') });
  };

  const generarPropuesta = useCallback(async () => {
    if (!propuesta || Object.keys(lineas).length === 0) { toast.info('Agrega al menos un SKU antes de generar la propuesta.'); return; }
    setSaving(true);
    try {
      await actualizarPropuestaDB(propuesta.id, { estatus: 'generada', generado_at: new Date().toISOString() });
      await actualizarLineasDB(propuesta.id, { estado: 'draft' }, { estado: 'pend_confirmar' });
      await Promise.all([invalidarLanding(), invalidarPropuesta()]);
      setHoja(false); setSubvista('landing');
      toast.ok('Propuesta generada');
    } catch (e) { toast.error(`Error: ${e.message || e}`); }
    finally { setSaving(false); }
  }, [propuesta, lineas]);

  const vaciarPropuesta = useCallback(async () => {
    if (!propuesta) return;
    if (!confirm('¿Vaciar todas las líneas de la reserva actual?')) return;
    setLineas(() => ({}));
    try { await vaciarLineasDB(propuesta.id); await invalidarPropuesta(); toast.ok('Reserva vaciada'); } catch (e) { toast.error(`Error: ${e.message || e}`); invalidarPropuesta(); }
  }, [propuesta]); // eslint-disable-line react-hooks/exhaustive-deps

  const onActualizarLinea = useCallback(async (linea, patch) => {
    try {
      await actualizarLineaDB(linea.id, patch);
      await invalidarLanding();
      invalidarDrill(linea.sku);
      setPropuestaAbierta((prev) => (!prev ? prev : { ...prev, forecast_propuesta_lineas: (prev.forecast_propuesta_lineas || []).map((l) => (l.id === linea.id ? { ...l, ...patch } : l)) }));
    } catch (e) { toast.error(`Error: ${e.message || e}`); }
  }, []);

  // ── Render ──
  if (!DB_CONFIGURED) return <div style={{ padding: 40, color: theme.textMuted }}>DB no configurada.</div>;
  if (base.isLoading || (yoId && prop.isLoading && !prop.data)) return <div style={{ padding: 20 }}><Cargando pantalla="forecastReservas" /></div>;
  if (base.error) return (
    <div style={{ padding: 20, maxWidth: 720, margin: '40px auto' }}>
      <Panel titulo="Error cargando forecast" acciones={<Boton onClick={() => base.refetch()}>Reintentar</Boton>}>
        <pre style={{ fontSize: 11, whiteSpace: 'pre-wrap', color: theme.red, margin: 0 }}>{String(base.error.message || base.error)}</pre>
      </Panel>
    </div>
  );

  const m = metodoInfo(metodo);
  const grupos = [
    { id: 'cliente', label: 'Cliente', sel: f.cliente, opciones: CLIENTES.map((c) => ({ id: c.key, label: c.label, n: fac.cliente.get(c.key)?.n || 0, tone: f.cliente.has(c.key) ? c.tone : undefined })) },
    { id: 'marca', label: 'Marca', sel: f.marca, opciones: fac.marca.slice(0, 8) },
    { id: 'familia', label: 'Familia', sel: f.familia, opciones: fac.familia.slice(0, 10) },
    { id: 'roadmap', label: 'Roadmap', sel: f.roadmap, opciones: fac.roadmap },
    { id: 'estado', label: 'Estado', sel: f.estado, opciones: ESTADOS_FILA.map((e) => ({ id: e.id, label: e.label, n: fac.estado.get(e.id)?.n || 0, tone: f.estado.has(e.id) ? e.tone : undefined })) },
  ];
  const toggles = [
    { id: 'arribo30', label: 'Con arribo en 30 días', on: f.arribo30, n: fac.arribo30 },
    { id: 'movimiento', label: 'Sólo con movimiento', on: f.soloMovimiento, n: fac.movimiento },
  ];
  const onToggleFlag = (id) => setF((p) => (id === 'arribo30' ? { ...p, arribo30: !p.arribo30 } : { ...p, soloMovimiento: !p.soloMovimiento }));
  const labelPill = `Reserva · ${fmtInt(kpis.totalReservo)} pz`;
  const propuestas = landing.data || [];
  const pct = kpis.totalRecom > 0 ? Math.round((kpis.totalReservo / kpis.totalRecom) * 100) : 0;

  return (
    <div style={{ padding: '20px 20px 80px', maxWidth: 1560, margin: '0 auto', fontFamily: TYPO.fontText }} data-stagger>
      <Hero eyebrow={`Dirección Comercial · Forecast · ${MESES[mesObj - 1]} ${anioObj}`}
        titulo={vista === 'crm' ? 'Forecast mensual para el CRM.' : 'Reservas de arribos por cliente.'}
        sub={vista === 'crm'
          ? `Captura piezas por cliente y SKU para 6 meses y exporta la plantilla exacta del CRM. El apoyo (sell-out, stock, cobertura) usa el método ${m.label.toLowerCase()}.`
          : <>{filasBase.length} SKUs del roadmap · <b style={{ color: theme.textOnInverse }}>{kpis.conBrecha} con brecha</b>{kpis.enPropuesta ? <> · <b style={{ color: theme.textOnInverse }}>{kpis.enPropuesta} en la reserva</b></> : null}. Recomendación = sell-out {m.desc.toLowerCase()}; escribe las piezas a reservar en la columna Reservo.</>}
        stats={[
          { k: 'SKUs c/ brecha', v: fmtInt(kpis.conBrecha), sub: `${fmtInt(kpis.totalRecom)} pz recomendadas`, color: kpis.conBrecha ? theme.orangeSoft || theme.orange : undefined },
          { k: 'Reserva activa', v: `${fmtInt(kpis.totalReservo)} pz`, sub: `${kpis.enPropuesta} SKUs · ${pct}%` },
          { k: 'Próx. arribo', v: kpis.proxArribo ? fmtFechaCorta(kpis.proxArribo) : '—', sub: `${fmtInt(kpis.futuros)} embarques por llegar`, color: theme.green },
          { k: 'Método', v: m.corto, sub: m.desc },
        ]}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          <Segmented value={vista} onChange={setVista} options={[{ id: 'reservas', label: 'Reservas', badge: kpis.enPropuesta || undefined }, { id: 'crm', label: 'Forecast CRM' }]} />
          <Segmented value={metodo} onChange={setMetodo} options={METODOS.map((x) => ({ id: x.id, label: x.label, title: x.desc }))} />
          {vista === 'reservas' && <Segmented value={subvista} onChange={setSubvista} options={[{ id: 'armador', label: 'Armador' }, { id: 'landing', label: 'Propuestas', badge: propuestas.length || undefined }]} />}
        </div>
      </Hero>

      {vista === 'reservas' && subvista === 'armador' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10, marginTop: 12 }}>
          <KpiCard eyebrow="Recomendado" big={fmtInt(kpis.totalRecom)} bigSmall="pz" sub={`${m.desc} · 3 clientes`} />
          <KpiCard eyebrow="Reservado" big={fmtInt(kpis.totalReservo)} bigSmall={`/ ${fmtInt(kpis.totalRecom)} pz`} sub={`${pct}% de la necesidad · ${kpis.enPropuesta} SKUs`} progress={pct} onClick={() => setHoja(true)} />
          <KpiCard eyebrow="Arribos en 30 días" big={fmtInt(kpis.conArribo30)} bigSmall="SKUs" sub={`${fmtInt(kpis.pz30)} pz por llegar`} onClick={() => setF((p) => ({ ...p, arribo30: !p.arribo30 }))} badge={f.arribo30 ? { tone: 'blue', l: 'filtro activo' } : undefined} />
          <KpiCard eyebrow="Propuestas generadas" big={fmtInt(propuestas.length)} sub={propuestas[0] ? `última: ${propuestas[0].nombre}` : 'ninguna todavía'} onClick={() => setSubvista('landing')} />
        </div>
      )}

      {vista === 'reservas' && subvista === 'landing' && (
        <div style={{ marginTop: 12 }}>
          <Landing propuestas={propuestas} propuestaAbierta={propuestaAbierta} setPropuestaAbierta={setPropuestaAbierta} yoId={yoId}
            onNueva={() => setSubvista('armador')}
            onReabrir={async (p) => {
              try {
                if (propuesta && propuesta.id !== p.id && Object.keys(lineas).length) { toast.info('Ya tienes una reserva en borrador: genérala o vacíala antes de reabrir otra.'); return; }
                await actualizarPropuestaDB(p.id, { estatus: 'borrador' });
                await Promise.all([invalidarLanding(), invalidarPropuesta()]);
                setSubvista('armador'); toast.ok('Propuesta reabierta como borrador');
              } catch (e) { toast.error(`Error: ${e.message || e}`); }
            }}
            onEliminar={async (p) => {
              if (!confirm(`¿Eliminar "${p.nombre}"?`)) return;
              try { await eliminarPropuestaDB(p.id); if (propuestaAbierta?.id === p.id) setPropuestaAbierta(null); await invalidarLanding(); toast.ok('Propuesta eliminada'); } catch (e) { toast.error(`Error: ${e.message || e}`); }
            }}
            onActualizarLinea={onActualizarLinea} />
        </div>
      )}

      {(vista === 'crm' || subvista === 'armador') && (
        <Panel style={{ marginTop: 12 }} padding="8px 12px 10px"
          titulo={vista === 'crm' ? 'Buscar y filtrar SKUs' : 'Detalle por SKU'}
          meta={`${vista === 'crm' ? filasFiltradas.length : filasFiltradas.length} de ${filasBase.length} SKUs${vista === 'crm' ? '' : ' · click en la fila para el drill'}`}
          acciones={<Buscador value={busqueda} onChange={setBusqueda} resultados={busqueda ? filasFiltradas.length : null} width={320} placeholder="Buscar: mouse inalámbrico, AC-93, balam…" />}>
          <Filtros grupos={grupos} toggles={toggles} onToggle={toggleGrupo} onToggleFlag={onToggleFlag} onLimpiar={limpiar} activos={nActivos(f)} />
        </Panel>
      )}

      {vista === 'reservas' && subvista === 'armador' && (
        <div style={{ marginTop: 12 }}>
          <TablaReservas filas={filasFiltradas} lineas={lineas} meses={meses} expandedSku={expandedSku}
            onToggle={(sku) => setExpandedSku((p) => (p === sku ? null : sku))} onReservo={onReservo} orden={orden} onSort={onSort}
            renderExpandido={(r) => <DrillSku fila={r} matriz={base.data.sellout.matriz.get(r.sku)} anios={base.data.sellout.anios} metodo={metodo} onClose={() => setExpandedSku(null)} />} />
        </div>
      )}

      {vista === 'crm' && (
        <div style={{ marginTop: 12 }}>
          <Captura filas={filasFiltradas} soloMovimiento={f.soloMovimiento} clienteKey={clienteCrm} setClienteKey={setClienteCrm}
            mesInicio={mesInicio} setMesInicio={setMesInicio} metodo={metodo} yoId={yoId} roadmapSet={roadmapSet} />
        </div>
      )}

      {vista === 'reservas' && (
        <button type="button" onClick={() => setHoja(true)} title="Abrir Mi reserva"
          style={{
            position: 'fixed', right: 22, bottom: 22, zIndex: 60, display: 'inline-flex', alignItems: 'center', gap: 8, height: 40, padding: '0 16px 0 14px', borderRadius: 999,
            background: theme.surfaceInverse, color: theme.textOnInverse, border: bordeFlotante(theme), boxShadow: elevation(theme, 'flotante'),
            fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.01em', cursor: 'pointer', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums',
            transition: `transform ${DUR.tap}ms ${EASE}`,
          }}
          onMouseDown={(e) => { e.currentTarget.style.transform = 'scale(0.96)'; }}
          onMouseUp={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'scale(1)'; }}>
          <ShoppingCart size={14} strokeWidth={2} />
          {labelPill}
          {kpis.enPropuesta > 0 && <Pill tone="green" size="xs" style={{ marginLeft: 2 }}>{kpis.enPropuesta}</Pill>}
        </button>
      )}

      <HojaReserva abierto={hoja} onClose={() => setHoja(false)} theme={theme} propuesta={propuesta} lineas={lineas} filasPorSku={filasPorSku}
        kpis={kpis} stats={stats} nombre={propuesta?.nombre || nombreDefault} saving={saving}
        onRenombrar={async (v) => { try { const p = await asegurarPropuesta(); await actualizarPropuestaDB(p.id, { nombre: v }); invalidarPropuesta(); } catch (e) { toast.error(`Error: ${e.message || e}`); } }}
        onGenerar={generarPropuesta} onVaciar={vaciarPropuesta}
        onVerSku={(sku) => { setHoja(false); setBusqueda(sku); setExpandedSku(sku); setVista('reservas'); setSubvista('armador'); }}
        onEliminarSku={eliminarLinea} />
    </div>
  );
}
