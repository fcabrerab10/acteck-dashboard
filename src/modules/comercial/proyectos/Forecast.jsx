// Forecast CRM · vista «Forecast» de Proyectos y forecast (2026-10-01, Fernando eligió la propuesta A):
// el dashboard SUGIERE las piezas por SKU y mes para la ventana del CRM (motor en forecastCalc.js: ritmo de 3 meses
// cerrados, estacionalidad, inventario del cliente descontado, proyectos sumados; sin los SKUs que ya tienen forecast
// en el CRM), Fernando ajusta lo que quiera y pulsa «Exportar plantilla del CRM»: baja el Excel exacto que acepta
// «Cargar Excel» en el CRM y deja copia en forecast_crm / forecast_crm_lotes para comparar después contra lo real.
// Clientes: los tres propios (Segmented) u otro cliente del ERP (select); para los del ERP el ritmo es de sell in.
import React, { useEffect, useMemo, useState } from 'react';
import { Download, RefreshCw, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useRoadmap } from '../../../lib/queries';
import { KpiCard, Panel, Pill, Segmented, Boton, TablaCompacta, Cargando, toast } from '../../../components/kit';
import CampoNumero from '../propuestas/CampoNumero';
import { descargarBlob } from '../../../lib/compartirArchivo';
import { construirLibro, nombreArchivoPlantilla } from '../reservas/plantillaCRM';
import { crearLoteDB, upsertCrmDB, invalidarCrm, invalidarLotes, useForecastCrm } from '../reservas/datos';
import { clienteForecast, useVentasForecast, useStockForecast, useProyectosForecast, useForecastExistente, useClientesErp, PROPIOS } from './forecastDatos';
import { ventana as ventanaDe, mesSiguiente, sugerir, validar, filasPlantilla, MIN_JUSTIFICACION } from './forecastCalc';

const CLIENTES = [{ id: 'digitalife', label: 'Digitalife' }, { id: 'pcel', label: 'PCEL' }, { id: 'dicotech', label: 'Dicotech' }, { id: 'erp', label: 'Otro cliente del ERP' }];
const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const TONO = { sugerido: 'blue', proyecto: 'green', mixto: 'purple', manual: 'orange' };

export default function Forecast({ yoId }) {
  const { theme } = useTheme();
  const [sel, setSel] = useState('digitalife');
  const [codigoErp, setCodigoErp] = useState('');
  const [mesInicio, setMesInicio] = useState(() => mesSiguiente());
  const [nMeses, setNMeses] = useState(6);
  const [filas, setFilas] = useState(null);     // null = sin sugerir todavía
  const [verExcluidos, setVerExcluidos] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [busca, setBusca] = useState('');

  const cliente = useMemo(() => (sel === 'erp' ? (codigoErp ? clienteForecast(codigoErp) : null) : clienteForecast(sel)), [sel, codigoErp]);
  const ventana = useMemo(() => ventanaDe(mesInicio, nMeses), [mesInicio, nMeses]);
  const { data: ventas, isLoading: lVentas } = useVentasForecast(cliente);
  const { data: stock } = useStockForecast(cliente);
  const { data: proyectos = [] } = useProyectosForecast(cliente);
  const { data: existente } = useForecastExistente(cliente?.codigo);
  const { data: exportadas = [] } = useForecastCrm(cliente?.key); // lo que ya salió del dashboard a la plantilla (y por tanto ya está o estará en el CRM)
  const { data: roadmap } = useRoadmap();
  const { data: clientesErp = [] } = useClientesErp();
  const rd = useMemo(() => new Map((roadmap || []).map((r) => [r.sku, r])), [roadmap]);
  const nombreErp = useMemo(() => (sel === 'erp' ? clientesErp.find((c) => c.codigo === codigoErp)?.nombre || codigoErp : null), [sel, codigoErp, clientesErp]);

  // Ya capturado = lo que está en el CRM (copia) + lo exportado desde aquí para cualquier mes de la ventana.
  const yaCapturado = useMemo(() => {
    const s = new Set(existente?.skus || []);
    const keys = new Set(ventana.map((m) => m.key));
    for (const r of exportadas) if (r.estado === 'exportado' && keys.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`) && N(r.piezas) > 0) s.add(r.sku);
    return s;
  }, [existente, exportadas, ventana]);
  const sugerido = useMemo(() => {
    if (!cliente || !ventas) return null;
    return sugerir({ ventanaMeses: ventana, series: ventas.series, stock: stock || new Map(), proyectos, excluir: verExcluidos ? new Set() : yaCapturado, roadmap: rd, fuente: ventas.fuente });
  }, [cliente, ventas, stock, proyectos, yaCapturado, rd, ventana, verExcluidos]);

  // Cada vez que cambia el cliente, la ventana o la base, el sugerido manda (lo editado se pierde: se avisa en pantalla).
  useEffect(() => { setFilas(sugerido ? sugerido.filas.map((f) => ({ ...f, meses: { ...f.meses } })) : null); }, [sugerido]);

  const editar = (sku, patch) => setFilas((prev) => prev.map((f) => (f.sku === sku ? { ...f, ...patch, origen: patch.meses ? 'manual' : f.origen } : f)));
  const quitar = (sku) => setFilas((prev) => prev.filter((f) => f.sku !== sku));
  const visibles = useMemo(() => {
    const q = busca.trim().toUpperCase();
    return (filas || []).filter((f) => !q || f.sku.includes(q) || String(f.descripcion || '').toUpperCase().includes(q));
  }, [filas, busca]);
  const totales = useMemo(() => {
    const l = filas || [];
    const porMes = Object.fromEntries(ventana.map((m) => [m.key, l.reduce((s, f) => s + N(f.meses[m.key]), 0)]));
    return { skus: l.length, piezas: l.reduce((s, f) => s + Object.values(f.meses).reduce((a, b) => a + N(b), 0), 0), porMes, proyectos: l.filter((f) => f.origen === 'proyecto' || f.origen === 'mixto').length };
  }, [filas, ventana]);
  const errores = useMemo(() => validar(filas || []), [filas]);

  const exportar = async () => {
    if (exportando || !cliente) return;
    if (errores.length) { toast.error(`${errores.length} SKU sin justificación de ${MIN_JUSTIFICACION} caracteres (${errores[0].sku})`); return; }
    const pl = filasPlantilla(filas || [], { tipo: cliente.tipo, clienteCodigo: cliente.codigo });
    if (!pl.length) { toast.info('No hay piezas en la ventana.'); return; }
    setExportando(true);
    try {
      const XLSX = await import('xlsx-js-style');
      const wb = construirLibro(XLSX, { mesInicio, meses: nMeses, filas: pl });
      const out = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const nombre = nombreArchivoPlantilla(mesInicio);
      const blob = new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      // Copia en la base: una fila por SKU y mes, marcada exportada y ligada al lote (para comparar después contra lo real).
      const lote = await crearLoteDB({ mesInicio, meses: nMeses, clientes: [cliente.key], filas: pl.length, archivoNombre: nombre, yoId });
      const rows = [];
      for (const f of pl) for (const m of ventana) { const v = N(f.meses[m.key]); if (v > 0) rows.push({ cliente_key: cliente.key, cliente_codigo: cliente.codigo, cliente_nombre: cliente.nombre, tipo: cliente.tipo, sku: f.sku, anio: m.anio, mes: m.mes, piezas: v, justificacion: f.justificacion, estado: 'exportado', lote_id: lote.id, creado_por: yoId }); }
      await upsertCrmDB(rows);
      descargarBlob(blob, nombre);
      toast.ok(`${nombre} · ${pl.length} SKUs · ${int(totales.piezas)} pz · súbela en el CRM con «Cargar Excel»`);
      invalidarCrm(cliente.key); invalidarLotes();
    } catch (e) { toast.error(`No se pudo exportar: ${e.message || e}`); }
    finally { setExportando(false); }
  };

  const selStyle = { height: 30, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 8, fontSize: 12, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, cursor: 'pointer' };
  const mesesInicio = Array.from({ length: 4 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + i); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; });
  const nombreCliente = cliente ? (cliente.propio ? PROPIOS[cliente.key].nombre : nombreErp) : '';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Segmented options={CLIENTES} value={sel} onChange={setSel} />
        {sel === 'erp' && (
          <select value={codigoErp} onChange={(e) => setCodigoErp(e.target.value)} style={{ ...selStyle, maxWidth: 320 }}>
            <option value="">Elige un cliente del ERP…</option>
            {clientesErp.map((c) => <option key={c.codigo} value={c.codigo}>{c.codigo} · {c.nombre}</option>)}
          </select>
        )}
        <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value)} style={selStyle} title="Primer mes de la ventana (el CRM captura desde el mes siguiente)">
          {mesesInicio.map((k) => <option key={k} value={k}>desde {ventanaDe(k, 1)[0].label}</option>)}
        </select>
        <Segmented options={[{ id: 3, label: '3 m' }, { id: 6, label: '6 m' }, { id: 12, label: '12 m' }]} value={nMeses} onChange={setNMeses} />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          <Boton icon={RefreshCw} onClick={() => setFilas(sugerido ? sugerido.filas.map((f) => ({ ...f, meses: { ...f.meses } })) : null)} title="Vuelve al sugerido del dashboard y descarta tus ajustes">Volver al sugerido</Boton>
          <Boton icon={Download} primario onClick={exportar} disabled={exportando || !filas?.length}>Exportar plantilla del CRM</Boton>
        </span>
      </div>

      {!cliente && <Panel titulo="Forecast"><div style={{ fontSize: 12, color: theme.textMuted }}>Elige un cliente del ERP para sugerir su forecast con su ritmo de compra.</div></Panel>}
      {cliente && (lVentas || !filas) && <Cargando pantalla="forecast" minHeight={320} />}
      {cliente && filas && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <KpiCard eyebrow={`SKUs en el forecast · ${nombreCliente}`} big={int(totales.skus)} sub={`${ventana[0].label} – ${ventana[ventana.length - 1].label} · ritmo de ${ventas?.fuente === 'sellout' ? 'sell out' : 'sell in'} 3 meses cerrados`} />
            <KpiCard eyebrow="Piezas sugeridas" big={int(totales.piezas)} sub={ventana.map((m) => `${m.label.split(' ')[0]} ${int(totales.porMes[m.key])}`).join(' · ')} />
            <KpiCard eyebrow="Con proyecto" big={int(totales.proyectos)} sub={totales.proyectos ? 'SKUs que suman piezas de proyectos probables o confirmados' : 'sin proyectos en la ventana'} />
            <KpiCard eyebrow="Ya capturado (no se repite)" big={int(yaCapturado.size)} bigColor={yaCapturado.size ? theme.orange : undefined}
              sub={yaCapturado.size ? `${int(existente?.skus?.size || 0)} en el CRM (copia del ${String(existente?.capturado || '').slice(0, 10)}) · ${int(yaCapturado.size - (existente?.skus?.size || 0))} exportados desde aquí` : 'nada capturado para este cliente'} />
          </div>

          <Panel titulo="Sugerido por SKU" meta={`${visibles.length} SKUs · edita piezas o justificación · ✕ quita el SKU`} padding="0 0 2px"
            acciones={(
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="SKU o descripción…" style={{ height: 28, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 11.5, background: theme.surface, color: theme.text, fontFamily: 'inherit', outline: 'none', minWidth: 180 }} />
                {yaCapturado.size > 0 && <Boton onClick={() => setVerExcluidos((v) => !v)} title="Mostrar también los SKUs que ya tienen forecast capturado">{verExcluidos ? 'Ocultar los capturados' : `Ver los ${yaCapturado.size} capturados`}</Boton>}
              </div>
            )}>
            <TablaCompacta dense maxHeight={560} rowKey={(r) => r.sku} filas={visibles} vacio="Sin SKUs con ritmo de venta ni proyectos en la ventana."
              columnas={[
                { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100 },
                { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 220, render: (r) => <span style={{ color: theme.textMuted }} title={r.descripcion}>{r.descripcion || r.marca || '—'}</span> },
                { key: 'base', label: 'Ritmo', width: 64, render: (r) => <span title="pz/mes · promedio de 3 meses cerrados">{r.base ? int(r.base) : '—'}</span> },
                { key: 'stock', label: 'Stock', width: 70, render: (r) => (r.stock == null ? '—' : <span title={r.semanas != null ? `${r.semanas} semanas` : ''}>{int(r.stock)}{r.semanas != null ? <span style={{ color: theme.textMuted }}> · {r.semanas}s</span> : null}</span>) },
                { key: 'origen', label: 'Origen', width: 78, align: 'left', render: (r) => <Pill tone={TONO[r.origen] || 'gray'} size="xs" title={r.proyectos?.length ? r.proyectos.join(', ') : ''}>{r.origen}</Pill> },
                ...ventana.map((m) => ({ key: `m${m.key}`, label: m.label, width: 66, render: (r) => (
                  <CampoNumero value={r.meses[m.key]} ancho={60} ariaLabel={`${r.sku} ${m.label}`} onChange={(n) => editar(r.sku, { meses: { ...r.meses, [m.key]: n > 0 ? Math.round(n) : null } })} />
                ) })),
                { key: 'total', label: 'Total', width: 64, bold: true, render: (r) => int(Object.values(r.meses).reduce((s, v) => s + N(v), 0)) },
                { key: 'justificacion', label: 'Justificación', align: 'left', maxWidth: 320, render: (r) => (
                  <input value={r.justificacion || ''} onChange={(e) => editar(r.sku, { justificacion: e.target.value })} title={r.justificacion}
                    style={{ width: '100%', minWidth: 220, height: 24, padding: '0 8px', border: `1px solid ${String(r.justificacion || '').trim().length < MIN_JUSTIFICACION ? theme.red : theme.border}`, borderRadius: 6, fontSize: 11, background: theme.surface, color: theme.text, fontFamily: 'inherit', outline: 'none' }} />
                ) },
                { key: 'quitar', label: '', width: 30, render: (r) => <button onClick={() => quitar(r.sku)} title="Quitar del forecast" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, display: 'inline-flex' }}><X size={13} /></button> },
              ]} />
            <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '6px 10px 4px', lineHeight: 1.45 }}>
              Sugerido = ritmo de 3 meses cerrados × estacionalidad del año anterior − inventario en exceso en el cliente + proyectos probables/confirmados de la pestaña Proyectos. Múltiplos de 5 desde 20 pz. Los SKUs que ya tienen forecast en el CRM no se sugieren para no duplicar. Al exportar se guarda copia (forecast_crm) y el archivo se sube tal cual en el CRM con «Cargar Excel».
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}
