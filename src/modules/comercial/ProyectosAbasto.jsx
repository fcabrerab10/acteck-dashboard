// Proyectos y abasto (V3 · 2026-09-21) — sustituye a Forecast › Reservas.
//
// Un PROYECTO es una venta comprometida: cliente, mes y SKUs. La pantalla responde a una
// sola pregunta — ¿alcanza lo que tengo (inventario + tránsito) para lo que ya prometí?—
// y, si no alcanza, qué hay que comprar y antes de cuándo.
//
//   · Tablero          → una columna por mes (6), tarjetas arrastrables entre meses.
//   · Matriz SKU × mes → el mismo dato visto por SKU, coloreado por cobertura.
//   · Historial        → auditoría de quién cambió qué (auditoria_cambios).
//
// Todo el cálculo vive en proyectos/calculo.js (puro, con pruebas); aquí sólo va el layout,
// el estado de la UI y las escrituras. Ver docs/PROYECTOS_ABASTO.md.
import React, { useCallback, useMemo, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaGlobal } from '../../lib/permisos';
import { int, moneyCompact } from '../../lib/format';
import { Hero, KpiCard, Panel, Pill, Segmented, Boton, Cargando, toast } from '../../components/kit';
import ExportMenu from '../../components/ExportMenu';
import FrescuraPill from '../../components/FrescuraPill';
import { exportarExcel } from '../../lib/exportar';
import {
  calcular, matriz as construirMatriz, tablero as construirTablero, detalleSku,
  mesesHorizonte, arribosDeTransito, CLIENTES, CLIENTE_LABEL, PROB_LABEL, claveMes,
} from './proyectos/calculo';
import { fraseHero, subHero, pctCorto, COLUMNAS_COMPRAS, COLUMNAS_PROYECTOS } from './proyectos/textos';
import { useProyectos, useAbasto, useHistorialProyectos, crearProyecto, actualizarProyecto, eliminarProyecto, guardarLinea, eliminarLinea, mandarAlSop } from './proyectos/datos';
import Tablero from './proyectos/Tablero';
import MatrizSkuMes from './proyectos/MatrizSkuMes';
import QueFaltaComprar from './proyectos/QueFaltaComprar';
import HojaProyecto from './proyectos/HojaProyecto';
import HojaSku from './proyectos/HojaSku';
import Historial from './proyectos/Historial';

const VISTAS = [
  { id: 'tablero', label: 'Tablero' },
  { id: 'matriz',  label: 'Matriz SKU × mes' },
  { id: 'historial', label: 'Historial' },
];
const MEDIDAS = [
  { id: 'necesidad', label: 'Necesidad' },
  { id: 'faltante',  label: 'Faltante' },
  { id: 'reservado', label: 'Reservado' },
];

export default function ProyectosAbasto() {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_reservas');
  const rootRef = useRef(null);
  const hoy = useMemo(() => new Date(), []);
  const horizonte = useMemo(() => mesesHorizonte(hoy, 6), [hoy]);

  // ── Estado de la UI ──
  const [vista, setVista] = useState('tablero');
  const [clientes, setClientes] = useState(() => new Set());
  const [soloConfirmados, setSoloConfirmados] = useState(false);
  const [medida, setMedida] = useState('necesidad');
  const [soloFaltante, setSoloFaltante] = useState(false);
  const [hojaProyecto, setHojaProyecto] = useState(null);   // { proyecto } | { nuevo:true, mesClave }
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [ocupado, setOcupado] = useState(false);

  // ── Datos ──
  const pr = useProyectos();
  const ab = useAbasto();
  const hist = useHistorialProyectos({ enabled: vista === 'historial' });

  const stock = useMemo(() => {
    const m = new Map();
    for (const r of ab.data?.inventario || []) if (r.sku) m.set(r.sku, Number(r.disponible ?? r.inventario) || 0);
    return m;
  }, [ab.data]);
  const arribos = useMemo(() => arribosDeTransito(ab.data?.transito || []), [ab.data]);

  const res = useMemo(() => calcular({
    proyectos: pr.data?.proyectos || [],
    lineas: pr.data?.lineas || [],
    inventario: ab.data?.inventario || [],
    transito: ab.data?.transito || [],
    leadTimes: ab.data?.leadTimes || [],
    leadProveedor: ab.data?.leadProveedor || [],
    descripciones: ab.data?.descripciones || null,
    meses: horizonte, hoy,
    filtros: { clientes: clientes.size ? [...clientes] : null, soloConfirmados },
  }), [pr.data, ab.data, horizonte, hoy, clientes, soloConfirmados]);

  const columnas = useMemo(() => construirTablero(res), [res]);
  const filasMatriz = useMemo(() => construirMatriz(res, { medida, soloFaltante }), [res, medida, soloFaltante]);
  const proyectoAbierto = useMemo(
    () => (hojaProyecto?.proyectoId ? res.porProyecto.find((p) => p.id === hojaProyecto.proyectoId) || null : null),
    [hojaProyecto, res],
  );
  const detalle = useMemo(() => (skuAbierto ? detalleSku(res, skuAbierto) : null), [skuAbierto, res]);

  const cargando = pr.isLoading || ab.isLoading;

  // ── Escrituras ──
  const conError = useCallback(async (fn, okMsg) => {
    setOcupado(true);
    try { const r = await fn(); if (okMsg) toast.ok(okMsg); return r; }
    catch (e) { toast.error(e?.message || 'No se pudo guardar'); return null; }
    finally { setOcupado(false); }
  }, []);

  const moverAMes = (id, anio, mes) => {
    const p = res.porProyecto.find((x) => x.id === id);
    if (!p || (p.anio === anio && p.mes === mes)) return;
    conError(() => actualizarProyecto(id, { anio, mes }), `“${p.nombre}” se movió a ${horizonte.find((m) => m.clave === claveMes(anio, mes))?.labelLargo || `${mes}/${anio}`}`);
  };
  const moverRelativo = (p, delta) => {
    if (!p.anio || !p.mes) return;
    const d = new Date(Date.UTC(p.anio, p.mes - 1 + delta, 1));
    moverAMes(p.id, d.getUTCFullYear(), d.getUTCMonth() + 1);
  };

  const reservarTodo = (p) => conError(async () => {
    for (const l of p.lineas || []) {
      const falta = (p.faltantes || []).find((f) => f.sku === l.sku)?.faltante || 0;
      const respaldo = Math.max(0, Number(l.piezas || 0) - falta);
      if (respaldo !== Number(l.reservado || 0)) await guardarLinea(p.id, { sku: l.sku, piezas: l.piezas, reservado: respaldo });
    }
  }, 'Piezas con respaldo marcadas como reservadas');

  const pedirCompra = (compras) => conError(async () => {
    const r = await mandarAlSop(compras, perfil);
    if (!r.ok) { toast.error(r.motivo); return null; }
    toast.ok(r.agregadas
      ? `${r.agregadas} SKU${r.agregadas === 1 ? '' : 's'} en el borrador de solicitud de compra (S&OP)${r.repetidas ? ` · ${r.repetidas} ya estaban` : ''}`
      : 'Esos SKUs ya estaban en el borrador de solicitud');
    return r;
  });

  const excelCompras = async () => {
    await exportarExcel({
      titulo: 'Proyectos y abasto',
      hojas: [
        { nombre: 'Qué falta comprar', columnas: COLUMNAS_COMPRAS, filas: res.comprasSugeridas },
        {
          nombre: 'Proyectos',
          columnas: COLUMNAS_PROYECTOS,
          filas: res.porProyecto.map((p) => ({
            ...p,
            clienteLabel: CLIENTE_LABEL[p.cliente] || p.cliente,
            mesLabel: p.anio && p.mes ? horizonte.find((m) => m.clave === p.clave)?.labelLargo || `${p.mes}/${p.anio}` : '—',
            probLabel: PROB_LABEL[p.probabilidad] || p.probabilidad,
          })),
        },
      ],
    });
  };

  if (cargando) return <Cargando pantalla="proyectos" />;

  const r = res.resumen;
  const stats = [
    { k: 'Proyectos', v: int(r.proyectos), sub: `${r.confirmados} confirmados` },
    { k: 'Piezas', v: int(r.piezas), sub: 'comprometidas' },
    { k: 'Cubierto', v: pctCorto(r.cubiertoPct), sub: 'inventario + tránsito' },
  ];

  return (
    <div ref={rootRef} data-stagger style={{ display: 'grid', gap: 12, fontFamily: TYPO.fontText }}>
      <Hero
        eyebrow="Proyectos y forecast · clientes propios"
        titulo={fraseHero(r)}
        sub={subHero(r)}
        stats={stats}>
        <div style={{ marginTop: 8 }}><FrescuraPill pantalla="proyectos" inverso /></div>
      </Hero>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
        <KpiCard eyebrow="Proyectos activos" big={int(r.proyectos)} bigSmall={r.enRiesgo ? `· ${r.enRiesgo} en riesgo` : null}
          sub={`${r.confirmados} confirmados · ${horizonte[0].label}–${horizonte.at(-1).label}`} />
        <KpiCard eyebrow="Monto comprometido" big={moneyCompact(r.monto || 0)} bigSmall={r.montoMesActual ? `· ${moneyCompact(r.montoMesActual)} este mes` : null} sub={`${int(r.piezas)} pz · ${moneyCompact(r.montoConfirmado || 0)} confirmado${r.sinPrecio ? ` · ${r.sinPrecio} línea${r.sinPrecio === 1 ? '' : 's'} sin precio` : ''}`} />
        <KpiCard eyebrow="% cubierto" big={pctCorto(r.cubiertoPct)} progress={r.cubiertoPct ?? 0}
          sub="Inventario disponible + tránsito que llega a tiempo" />
        <KpiCard eyebrow="SKUs por comprar" big={int(r.skusPorComprar)} bigSmall={r.piezasPorComprar ? `· ${int(r.piezasPorComprar)} pz` : null}
          bigColor={r.vencidos ? (theme.red || '#FF3B30') : undefined}
          sub={r.vencidos ? `${r.vencidos} ya pasaron su fecha límite` : r.limiteProximo ? `el más próximo vence pronto` : 'nada pendiente'} />
      </div>

      {/* Barra de control */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {puedeEditar && <Boton primario icon={Plus} onClick={() => setHojaProyecto({ nuevo: true, mesClave: horizonte[0].clave })}>Nuevo proyecto</Boton>}
        <Segmented options={VISTAS} value={vista} onChange={setVista} />
        <span style={{ display: 'inline-flex', gap: 5 }}>
          {CLIENTES.map((c) => {
            const on = clientes.has(c.key);
            return (
              <Pill key={c.key} tone={on ? 'blue' : 'gray'} dot
                onClick={() => setClientes((s) => { const n = new Set(s); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })}
                style={{ cursor: 'pointer' }}>{c.label}</Pill>
            );
          })}
        </span>
        <Pill tone={soloConfirmados ? 'green' : 'gray'} onClick={() => setSoloConfirmados((v) => !v)} style={{ cursor: 'pointer' }}>Sólo confirmados</Pill>
        <span style={{ flex: 1 }} />
        <ExportMenu titulo="Proyectos y abasto" subtitulo={`${r.proyectos} proyectos · ${int(r.piezas)} pz`} excel={excelCompras} pdf={{ ref: rootRef }} />
      </div>

      {/* Contenido */}
      {vista === 'tablero' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(280px, 340px)', gap: 12, alignItems: 'start' }}>
          <Tablero columnas={columnas} puedeEditar={puedeEditar}
            onAbrir={(p) => setHojaProyecto({ proyectoId: p.id })}
            onMoverAMes={moverAMes} onMoverRelativo={moverRelativo}
            onNuevo={(anio, mes) => setHojaProyecto({ nuevo: true, mesClave: claveMes(anio, mes) })} />
          <QueFaltaComprar compras={res.comprasSugeridas} puedeEditar={puedeEditar} ocupado={ocupado}
            onAbrirSku={setSkuAbierto} onMandarSop={() => pedirCompra(res.comprasSugeridas)} onExcel={excelCompras} />
        </div>
      )}

      {vista === 'matriz' && (
        <Panel titulo="Matriz SKU × mes" meta={`${filasMatriz.length} SKU${filasMatriz.length === 1 ? '' : 's'} con demanda`} padding="0"
          acciones={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Segmented options={MEDIDAS} value={medida} onChange={setMedida} />
              <Pill tone={soloFaltante ? 'red' : 'gray'} onClick={() => setSoloFaltante((v) => !v)} style={{ cursor: 'pointer' }}>Sólo con faltante</Pill>
            </span>
          }>
          <MatrizSkuMes filas={filasMatriz} horizonte={horizonte} medida={medida} onAbrirSku={setSkuAbierto} />
        </Panel>
      )}

      {vista === 'historial' && <Historial filas={hist.data} cargando={hist.isLoading} />}

      {/* Hojas laterales */}
      <HojaProyecto
        abierto={!!hojaProyecto}
        proyecto={proyectoAbierto}
        mesInicial={hojaProyecto?.mesClave}
        horizonte={horizonte}
        catalogoSkus={ab.data?.catalogoSkus || []}
        precios={ab.data?.precios}
        stock={stock} arribos={arribos}
        puedeEditar={puedeEditar} guardando={ocupado}
        onCerrar={() => setHojaProyecto(null)}
        onCrear={(campos) => conError(async () => { await crearProyecto(campos, perfil); setHojaProyecto(null); }, 'Proyecto creado')}
        onActualizar={(id, campos) => conError(async () => { await actualizarProyecto(id, campos); setHojaProyecto(null); }, 'Proyecto actualizado')}
        onEliminar={(p) => { if (window.confirm(`¿Eliminar “${p.nombre}” y sus SKUs?`)) conError(async () => { await eliminarProyecto(p.id); setHojaProyecto(null); }, 'Proyecto eliminado'); }}
        onGuardarLinea={(id, l) => conError(() => guardarLinea(id, l))}
        onEliminarLinea={(id) => conError(() => eliminarLinea(id), 'SKU quitado')}
        onReservarTodo={reservarTodo}
        onPedirCompra={(p) => pedirCompra(res.comprasSugeridas.filter((c) => (p.faltantes || []).some((f) => f.sku === c.sku)))}
        onAbrirSku={(sku) => setSkuAbierto(sku)} />

      <HojaSku
        abierto={!!skuAbierto}
        detalle={detalle}
        descripcion={ab.data?.descripciones?.get(skuAbierto) || null}
        stock={stock} arribos={arribos} puedeEditar={puedeEditar}
        onCerrar={() => setSkuAbierto(null)}
        onAbrirProyecto={(p) => { setSkuAbierto(null); setHojaProyecto({ proyectoId: p.id }); }}
        onPedirCompra={pedirCompra} />
    </div>
  );
}
