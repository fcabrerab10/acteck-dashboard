// Estrategia de Precios · V3 (kit): Hero narrativo → 4 KpiCard → buscador + filtros pills → tabla SKU × listas
// (drill por SKU) → Panel plegable "Precio bajo accionable". Lógica en ./precios/ (datos.js, calculo.js, textos.js).
// Datos: precios_sku la REEMPLAZA el puente cada hora (sólo el mes actual); el histórico vive en precios_historico
// (trigger, acumula desde 2026-09-11) y v_precios_cambios_mes. Margen/costo sólo con puedeVerSensible(perfil)
// (también fuera del Excel). Comparativo % entre listas e inconsistencias: NO aprobado, no está.
import React, { useMemo, useRef, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import ExportMenu from '../../components/ExportMenu';
import { Hero, KpiCard, Panel, Cargando } from '../../components/kit';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { fecha as fmtFecha } from '../../lib/format';
import Buscador from './sellin/Buscador';
import Filtros from './sellin/Filtros';
import TablaPrecios from './precios/TablaPrecios';
import PanelPrecioBajo from './precios/PanelPrecioBajo';
import { useDatosPrecios } from './precios/datos';
import { FILTROS_VACIOS, conBusqueda, nActivos, listasVisibles, pasaTodos, facetas as calcFacetas, construirFilas, resumen, filasPrecioBajo, ordenar, precioEfectivo } from './precios/calculo';
import { LISTAS, listaLbl, roadmapTone, fmtInt, fmtPct, fmtMoneyShort, MESES_LARGO } from './precios/textos';

export default function EstrategiaPrecios() {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'estrategia_precios')) return <SinAcceso motivo="No tienes acceso a Estrategia de Precios." />;
  return <Pantalla sensible={puedeVerSensible(perfil)} />;
}

function Pantalla({ sensible }) {
  const { theme } = useTheme();
  const rootRef = useRef(null);
  const { roadmap, datos, loading, error } = useDatosPrecios(sensible);
  const [f, setF] = useState(FILTROS_VACIOS);
  const [orden, setOrden] = useState(null);
  const [skuAbierto, setSkuAbierto] = useState(null);
  const [bajoAbrir, setBajoAbrir] = useState(0); // contador: cada clic en el KPI vuelve a abrir el panel (aunque el usuario lo haya plegado)
  const hoy = new Date();
  const periodo = { anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 };

  const todas = useMemo(() => (datos ? construirFilas({ roadmap, ...datos }) : []), [roadmap, datos]);
  const filas = useMemo(() => ordenar(todas.filter((r) => pasaTodos(r, f, null)), orden), [todas, f, orden]);
  const facetas = useMemo(() => calcFacetas(todas, f), [todas, f]);
  const kpi = useMemo(() => resumen(filas, periodo), [filas, periodo.anio, periodo.mes]); // eslint-disable-line react-hooks/exhaustive-deps
  const bajas = useMemo(() => filasPrecioBajo(filas), [filas]);
  const listas = listasVisibles(f);
  const activos = nActivos(f);

  const toggleSet = (grupo, id) => setF((p) => { const s = new Set(p[grupo]); if (s.has(id)) s.delete(id); else s.add(id); return { ...p, [grupo]: s }; });
  const toggleFlag = (id) => setF((p) => ({ ...p, [id]: !p[id] }));
  const onSort = (col) => setOrden((o) => (o?.col === col ? (o.dir === 'desc' ? { col, dir: 'asc' } : null) : { col, dir: 'desc' }));
  const abrirBajo = () => { setBajoAbrir((n) => n + 1); setTimeout(() => document.getElementById('precio-bajo')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60); };

  const excel = () => {
    const columnas = [
      { label: 'Marca', key: 'marca', ancho: 12 }, { label: 'SKU', key: 'sku', ancho: 14 }, { label: 'Descripción', key: 'descripcion', ancho: 50 }, { label: 'Roadmap', key: 'rdmp', ancho: 10 },
      { label: 'Precio bajo facturado', key: 'bajoReal', tipo: 'moneda', ancho: 16 }, { label: 'Cliente precio bajo', key: 'bajoCliente', ancho: 28 }, { label: 'Piezas precio bajo', key: 'bajoPiezas', tipo: 'numero', ancho: 12 },
      ...listas.map((l) => ({ label: l, key: `p:${l}`, tipo: 'moneda', ancho: 14 })),
      ...(sensible ? [{ label: 'Costo promedio', key: 'costo', tipo: 'moneda', ancho: 14 }, ...listas.map((l) => ({ label: `Margen ${listaLbl(l)}`, key: `m:${l}`, tipo: 'pct', ancho: 12 }))] : []),
    ];
    const rows = filas.map((r) => {
      const o = { marca: r.marca, sku: r.sku, descripcion: r.descripcion, rdmp: r.rdmp, bajoReal: r.bajo?.real ?? null, bajoCliente: r.bajo?.cliente ?? null, bajoPiezas: r.bajo?.piezas ?? null };
      for (const l of listas) o[`p:${l}`] = precioEfectivo(r.precios, r.promo, l);
      if (sensible) { o.costo = r.costo > 0 ? r.costo : null; for (const l of listas) o[`m:${l}`] = r.margen[l] != null ? r.margen[l] / 100 : null; }
      return o;
    });
    const titulo = `Lista de Precios ${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`;
    return { titulo, hojas: [{ nombre: 'Lista de Precios', subtitulo: `${filas.length} SKUs · sin IVA`, columnas, filas: rows }] };
  };

  if (loading) return <Cargando pantalla="estrategiaPrecios" minHeight={480} />;
  if (error) return <div style={{ padding: 24, color: theme.red || '#FF3B30', fontFamily: TYPO.fontText, fontSize: 12 }}>No se pudieron cargar los precios: {String(error.message || error)}</div>;

  const historicoDesde = datos?.historicoDesde ? fmtFecha(datos.historicoDesde) : null;
  const nCambios = kpi.subieron + kpi.bajaron;
  const narrativa = `${fmtInt(kpi.conPrecio)} SKUs con precio de ${fmtInt(filas.length)}${activos || f.q ? ' filtrados' : ''}. `
    + (nCambios ? `${fmtInt(nCambios)} cambios de precio este mes (${kpi.subieron} subieron, ${kpi.bajaron} bajaron). ` : 'Sin cambios de precio registrados este mes. ')
    + (kpi.nBajo ? `${fmtInt(kpi.nBajo)} SKUs facturados debajo de su lista: ${fmtMoneyShort(kpi.dejado)} dejados en la mesa.` : 'Ningún cliente facturado debajo de su lista.');

  const grupos = [
    { id: 'marca', label: 'Marca', opciones: facetas.marca, sel: f.marca },
    { id: 'categoria', label: 'Categoría', opciones: facetas.categoria, sel: f.categoria },
    { id: 'roadmap', label: 'Roadmap', opciones: facetas.roadmap.map((o) => ({ ...o, tone: roadmapTone(o.id) })), sel: f.roadmap },
    { id: 'listas', label: 'Listas', opciones: LISTAS.map((l) => ({ id: l, label: listaLbl(l), n: facetas.listas.get(l) || 0 })), sel: f.listas },
  ];
  const toggles = [
    { id: 'conPromo', label: 'Con promo', on: f.conPromo, n: facetas.conPromo },
    { id: 'precioBajo', label: 'Precio bajo', on: f.precioBajo, n: facetas.precioBajo },
    { id: 'sinPrecio', label: 'Sin precio en alguna lista', on: f.sinPrecio, n: facetas.sinPrecio },
  ];

  return (
    <div ref={rootRef} data-stagger style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Hero eyebrow={`Dirección Comercial · ${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`} titulo="Estrategia de Precios." sub={narrativa}
        stats={[
          { k: 'SKUs con precio', v: fmtInt(kpi.conPrecio), sub: `de ${fmtInt(filas.length)}` },
          { k: 'Listas', v: fmtInt(LISTAS.length), sub: 'Mayoreo AAA primero' },
          { k: 'Promos vigentes', v: fmtInt(kpi.promos), sub: kpi.promos ? 'ya aplicadas en listas' : undefined },
        ]} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Cambios de precio este mes" badge={historicoDesde ? { l: `desde ${historicoDesde}`, tone: 'gray' } : undefined}
          big={fmtInt(nCambios)} bigSmall={nCambios ? `${kpi.subieron} subieron · ${kpi.bajaron} bajaron` : 'sin cambios'}
          sub={`vs el mes anterior con dato · ${MESES_LARGO[periodo.mes - 1]} · el histórico acumula desde ${historicoDesde || 'hoy'}`} />
        <KpiCard eyebrow="Precio bajo" badge={kpi.nBajo ? { l: 'ver detalle', tone: 'orange' } : undefined} onClick={abrirBajo}
          big={fmtInt(kpi.nBajo)} bigSmall="SKUs" bigColor={kpi.nBajo ? (theme.orange || '#FF9500') : undefined}
          sub={kpi.nBajo ? `${fmtMoneyShort(kpi.dejado)} dejados en la mesa · clientes debajo de su lista` : 'Nadie facturado debajo de su lista'} />
        {sensible ? (
          <KpiCard eyebrow="Margen promedio Mayoreo AAA" big={kpi.margenAAA != null ? fmtPct(kpi.margenAAA, 1) : '—'} bigSmall={kpi.margenN ? `${fmtInt(kpi.margenN)} SKUs` : undefined}
            bigColor={kpi.margenAAA == null ? undefined : kpi.margenAAA < 10 ? (theme.red || '#FF3B30') : kpi.margenAAA < 20 ? (theme.orange || '#FF9500') : undefined}
            sub="(precio AAA − Costo Promedio) / precio · promedio simple por SKU con costo"
            medida="Medida: Costo Promedio · Promedio de costopromedio con CostoInventario ≠ 0" />
        ) : (
          <KpiCard eyebrow="Promos vigentes" big={fmtInt(kpi.promos)} bigSmall="SKUs" sub="ya aplicadas en las listas (promos_temporada)" />
        )}
        <KpiCard eyebrow="Sin precio en alguna lista" big={fmtInt(kpi.sinPrecio)} bigSmall="SKUs" bigColor={kpi.sinPrecio ? (theme.orange || '#FF9500') : undefined}
          sub={`de ${fmtInt(filas.length)} · falta precio en al menos una de las ${LISTAS.length} listas`} />
      </div>

      <Panel titulo="Buscar y filtrar" meta={`${fmtInt(filas.length)} de ${fmtInt(todas.length)} SKUs · orden del roadmap${orden ? ' (ordenado por columna)' : ''}`}
        acciones={<ExportMenu titulo="Lista de Precios" subtitulo={`${MESES_LARGO[hoy.getMonth()]} ${hoy.getFullYear()}`} excel={excel} pdf={{ ref: rootRef }} deshabilitado={!filas.length} />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Buscador value={f.q} onChange={(q) => setF((p) => conBusqueda(p, q))} resultados={f.q ? `${fmtInt(filas.length)} SKUs` : null} width={420}
            placeholder="Buscar: mouse inalámbrico negro, AC-93, teclado balam, RMI…" />
          <Filtros grupos={grupos} toggles={toggles} activos={activos} onToggle={toggleSet} onToggleFlag={toggleFlag} onLimpiar={() => setF((p) => ({ ...FILTROS_VACIOS(), q: p.q, tokens: p.tokens }))} />
        </div>
      </Panel>

      <TablaPrecios filas={filas} listas={listas} sensible={sensible} orden={orden} onSort={onSort} skuAbierto={skuAbierto} onToggle={setSkuAbierto} periodo={periodo} />

      <PanelPrecioBajo filas={bajas} abrir={bajoAbrir} />
    </div>
  );
}
