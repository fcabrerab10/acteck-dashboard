// Forecast CRM · captura mensual por cliente y SKU (ventana de 6 meses) y exportación en la plantilla del CRM.
// Segmented de cliente + mes inicial (default: mes siguiente) + tipo directa/indirecta (pill por cliente).
// Tabla: apoyo (sell-out promedio del método, stock del cliente, cobertura) · Sugerir · 6 meses editables
// (enteros; Tab avanza) · Justificación (≥ 15 caracteres, pill roja si falta con piezas) · estado.
// Autoguardado con debounce 3 s en forecast_crm (una fila por mes; justificación repetida por SKU).
// "Exportar plantilla" valida, crea un lote (forecast_crm_lotes), marca las filas exportadas y descarga
// Plantilla_Forecast_YYYY-MM.xlsx ("Compartir" usa navigator.share con el archivo cuando existe).
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Download, Share2, Wand2, RefreshCw } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { queryClient } from '../../../lib/queryClient';
import { Panel, Pill, Boton, Segmented, TablaCompacta, Cargando, KpiCard, toast } from '../../../components/kit';
import { compartirArchivo, descargarBlob, puedeCompartirArchivos } from '../../../lib/compartirArchivo';
import { MONO, tonoCobertura, etiquetaCobertura, fmtDias, fmtFechaCorta } from '../inventario/constantes';
import { CLIENTES, clienteLabel, fmtInt, roadmapTone, labelMes, N, MESES } from './textos';
import { ventanaCRM, sugerirMeses, validarCRM, coberturaDias, MIN_JUSTIFICACION, metodoInfo } from './calculo';
import { clienteCRM, guardarTipoCRM, TIPOS_CRM } from './clientesCRM';
import { useForecastCrm, upsertCrmDB, borrarCrmDB, invalidarCrm, crearLoteDB, marcarExportadoDB, useLotesCrm, invalidarLotes, filasDeLoteDB } from './datos';
import { plantillaBlob, nombreArchivoPlantilla, filasDesdeCrm } from './plantillaCRM';

const DEBOUNCE_MS = 3000;

// Input de piezas: estado local, se compromete al salir (blur / Enter); Tab sigue al siguiente input.
const MesInput = React.memo(function MesInput({ value, onCommit, activo }) {
  const { theme } = useTheme();
  const [v, setV] = useState(value == null ? '' : String(value));
  useEffect(() => { setV(value == null ? '' : String(value)); }, [value]);
  const commit = () => { const n = v === '' ? null : N(v); if ((n ?? null) !== (value ?? null)) onCommit(n); };
  const lleno = v !== '' && N(v) > 0;
  return (
    <input value={v} inputMode="numeric" placeholder="—" aria-label="Piezas del mes"
      onChange={(e) => setV(e.target.value.replace(/[^\d]/g, ''))}
      onFocus={(e) => e.currentTarget.select()} onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
      style={{
        width: 56, padding: '3px 6px', borderRadius: 6, textAlign: 'right', outline: 'none', fontFamily: MONO, fontSize: 11.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        border: `1px solid ${lleno ? theme.accent : theme.border}`, background: lleno ? (theme.accentBg || `${theme.accent}12`) : (activo ? theme.surface : 'transparent'), color: lleno ? theme.accent : theme.text,
      }} />
  );
});

const JustInput = React.memo(function JustInput({ value, onCommit, requerida, error }) {
  const { theme } = useTheme();
  const [v, setV] = useState(value || '');
  useEffect(() => { setV(value || ''); }, [value]);
  const falta = requerida && String(v).trim().length < MIN_JUSTIFICACION;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <input value={v} placeholder="Justificación (mín. 15 caracteres)" aria-label="Justificación"
        onChange={(e) => setV(e.target.value)} onBlur={() => { if ((v || '') !== (value || '')) onCommit(v); }}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
        style={{ width: 250, padding: '3px 8px', borderRadius: 6, outline: 'none', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text, background: theme.surface, border: `1px solid ${falta || error ? theme.red : theme.border}` }} />
      {(falta || error) && <Pill tone="red" size="xs">{falta ? `${String(v).trim().length}/${MIN_JUSTIFICACION}` : 'revisar'}</Pill>}
    </span>
  );
});

function hace(ts) {
  if (!ts) return '';
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 5) return 'ahora';
  if (s < 60) return `hace ${s} s`;
  const m = Math.round(s / 60);
  return m < 60 ? `hace ${m} min` : `hace ${Math.round(m / 60)} h`;
}

export default function Captura({ filas, soloMovimiento, clienteKey, setClienteKey, mesInicio, setMesInicio, metodo, yoId, roadmapSet }) {
  const { theme } = useTheme();
  const ventana = useMemo(() => ventanaCRM(mesInicio, 6), [mesInicio]);
  const { data: rows = [], isLoading } = useForecastCrm(clienteKey);
  const [tipo, setTipo] = useState(() => clienteCRM(clienteKey).tipo);
  useEffect(() => { setTipo(clienteCRM(clienteKey).tipo); }, [clienteKey]);

  // Servidor → por SKU
  const porSku = useMemo(() => {
    const out = {};
    for (const r of rows) {
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      const s = out[r.sku] || (out[r.sku] = { justificacion: '', meses: {}, exportado: false });
      s.meses[key] = { piezas: N(r.piezas), id: r.id, estado: r.estado };
      if (r.justificacion && !s.justificacion) s.justificacion = r.justificacion;
      if (r.estado === 'exportado' && ventana.some((m) => m.key === key)) s.exportado = true;
    }
    return out;
  }, [rows, ventana]);

  // Ediciones locales (overlay) + autoguardado
  const [edits, setEdits] = useState({});
  const editsRef = useRef(edits); editsRef.current = edits;
  const dirty = useRef(new Set());
  const timer = useRef(null);
  const [guardando, setGuardando] = useState(false);
  const [ultimoGuardado, setUltimoGuardado] = useState(null);
  const [, tick] = useState(0);
  useEffect(() => { const t = setInterval(() => tick((x) => x + 1), 5000); return () => clearInterval(t); }, []);
  useEffect(() => { setEdits({}); dirty.current = new Set(); }, [clienteKey]);

  const valorMes = useCallback((sku, key) => { const e = edits[sku]?.meses; if (e && key in e) return e[key]; return porSku[sku]?.meses[key]?.piezas ?? null; }, [edits, porSku]);
  const justif = useCallback((sku) => (edits[sku]?.justificacion !== undefined ? edits[sku].justificacion : (porSku[sku]?.justificacion || '')), [edits, porSku]);

  const marcar = (sku, patch) => {
    dirty.current.add(sku);
    setEdits((prev) => ({ ...prev, [sku]: { ...(prev[sku] || {}), ...patch, meses: { ...(prev[sku]?.meses || {}), ...(patch.meses || {}) } } }));
  };
  const setMes = (sku, key, n) => marcar(sku, { meses: { [key]: n } });
  const setJust = (sku, txt) => marcar(sku, { justificacion: txt });
  const sugerir = (fila) => marcar(fila.sku, { meses: sugerirMeses(fila.velocidad?.[clienteKey], ventana) });

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const skus = [...dirty.current];
    if (!skus.length) return;
    dirty.current = new Set();
    const e = editsRef.current;
    const info = clienteCRM(clienteKey);
    const upserts = [], borrar = [];
    for (const sku of skus) {
      const srv = porSku[sku] || { justificacion: '', meses: {} };
      const just = (e[sku]?.justificacion !== undefined ? e[sku].justificacion : srv.justificacion) || '';
      for (const m of ventana) {
        const em = e[sku]?.meses;
        const val = em && m.key in em ? em[m.key] : (srv.meses[m.key]?.piezas ?? null);
        const existe = srv.meses[m.key];
        if (N(val) > 0) upserts.push({ cliente_key: clienteKey, cliente_codigo: info.codigo, cliente_nombre: info.nombre, tipo, sku, anio: m.anio, mes: m.mes, piezas: N(val), justificacion: just.trim() || null, estado: 'borrador', creado_por: yoId });
        else if (existe) borrar.push(existe.id);
      }
      // Meses fuera de la ventana con piezas: sólo actualizar la justificación.
      for (const [key, r] of Object.entries(srv.meses)) {
        if (ventana.some((m) => m.key === key) || !(r.piezas > 0)) continue;
        const [a, mm] = key.split('-').map(Number);
        upserts.push({ cliente_key: clienteKey, cliente_codigo: info.codigo, cliente_nombre: info.nombre, tipo, sku, anio: a, mes: mm, piezas: r.piezas, justificacion: just.trim() || null, estado: r.estado === 'exportado' ? 'borrador' : r.estado, creado_por: yoId });
      }
    }
    setGuardando(true);
    try {
      await borrarCrmDB(borrar);
      await upsertCrmDB(upserts);
      await invalidarCrm(clienteKey);
      setUltimoGuardado(Date.now());
      setEdits((prev) => { const n = { ...prev }; for (const s of skus) if (!dirty.current.has(s)) delete n[s]; return n; });
    } catch (err) {
      for (const s of skus) dirty.current.add(s);
      toast.error(`No se pudo guardar: ${err.message || err}`);
    } finally { setGuardando(false); }
  }, [clienteKey, porSku, ventana, tipo, yoId]);

  useEffect(() => {
    if (!dirty.current.size) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, DEBOUNCE_MS);
    return () => clearTimeout(timer.current);
  }, [edits, flush]);

  const cambiarTipo = (t) => { setTipo(t); guardarTipoCRM(clienteKey, t); for (const sku of Object.keys(porSku)) dirty.current.add(sku); setEdits((p) => ({ ...p })); };
  const cambiarCliente = async (ck) => { if (ck === clienteKey) return; await flush(); setClienteKey(ck); };

  // Filas visibles: con necesidad del cliente, con captura o todas (según el toggle "Sólo con movimiento").
  const visibles = useMemo(() => filas.filter((f) => !soloMovimiento || (f.necesidad?.[clienteKey] || 0) > 0 || porSku[f.sku] || edits[f.sku]), [filas, soloMovimiento, clienteKey, porSku, edits]);

  const resumen = useMemo(() => {
    let skus = 0, piezas = 0, faltaJust = 0;
    for (const f of filas) {
      let tot = 0;
      for (const m of ventana) tot += N(valorMes(f.sku, m.key));
      if (tot > 0) { skus += 1; piezas += tot; if (String(justif(f.sku)).trim().length < MIN_JUSTIFICACION) faltaJust += 1; }
    }
    return { skus, piezas, faltaJust };
  }, [filas, ventana, valorMes, justif]);

  const [errores, setErrores] = useState(new Set());
  const [exportando, setExportando] = useState(false);
  const { data: lotes = [] } = useLotesCrm();

  const exportar = async (modo) => {
    if (exportando) return;
    setExportando(true);
    try {
      await flush();
      const fresh = queryClient.getQueryData(['forecast_crm', clienteKey]) || rows;
      const filasCRM = filas.map((f) => { const meses = {}; for (const m of ventana) { const v = valorMes(f.sku, m.key); if (N(v) > 0) meses[m.key] = N(v); } return { sku: f.sku, justificacion: justif(f.sku), meses }; });
      const { validas, errores: errs } = validarCRM(filasCRM, roadmapSet);
      if (errs.length) { setErrores(new Set(errs.map((x) => x.sku))); toast.error(`${errs.length} SKU con errores (${errs[0].sku}: ${errs[0].errores.join(', ')})`); return; }
      setErrores(new Set());
      if (!validas.length) { toast.info('No hay piezas capturadas en la ventana.'); return; }
      const info = clienteCRM(clienteKey);
      const filasPlantilla = validas.map((v) => ({ tipo, cliente: info.codigo || info.nombre, sku: v.sku, justificacion: v.justificacion, meses: v.meses }));
      const nombre = nombreArchivoPlantilla(mesInicio);
      const blob = await plantillaBlob({ mesInicio, meses: 6, filas: filasPlantilla });
      const keys = new Set(ventana.map((m) => m.key));
      const skusOk = new Set(validas.map((v) => v.sku));
      const ids = fresh.filter((r) => skusOk.has(r.sku) && keys.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`) && N(r.piezas) > 0).map((r) => r.id);
      const lote = await crearLoteDB({ mesInicio, meses: 6, clientes: [clienteKey], filas: validas.length, archivoNombre: nombre, yoId });
      await marcarExportadoDB(ids, lote.id, { tipo, cliente_codigo: info.codigo, cliente_nombre: info.nombre });
      const r = modo === 'compartir' ? await compartirArchivo(blob, nombre, { titulo: nombre, texto: `Forecast CRM · ${clienteLabel(clienteKey)} · ${labelMes(ventana[0].anio, ventana[0].mes)} → ${labelMes(ventana[5].anio, ventana[5].mes)}` }) : (descargarBlob(blob, nombre) ? 'descarga' : false);
      toast.ok(`${nombre} · ${validas.length} SKU${validas.length === 1 ? '' : 's'}${r === 'share' ? ' compartida' : r ? ' descargada' : ''}`);
      invalidarCrm(clienteKey); invalidarLotes();
    } catch (err) {
      toast.error(`No se pudo exportar: ${err.message || err}`);
    } finally { setExportando(false); }
  };

  const redescargar = async (lote) => {
    try {
      const mi = String(lote.mes_inicio).slice(0, 7);
      const filasLote = filasDesdeCrm(await filasDeLoteDB(lote.id), ventanaCRM(mi, lote.meses || 6), { orden: filas.map((f) => f.sku) });
      if (!filasLote.length) { toast.info('El lote ya no tiene filas (se editaron después).'); return; }
      const blob = await plantillaBlob({ mesInicio: mi, meses: lote.meses || 6, filas: filasLote });
      descargarBlob(blob, lote.archivo_nombre || nombreArchivoPlantilla(mi));
      toast.ok('Plantilla descargada');
    } catch (err) { toast.error(`No se pudo descargar: ${err.message || err}`); }
  };

  const estadoGuardado = guardando ? { tone: 'blue', txt: 'Guardando…' } : dirty.current.size ? { tone: 'orange', txt: 'Cambios sin guardar' } : ultimoGuardado ? { tone: 'green', txt: `Guardado ${hace(ultimoGuardado)}` } : { tone: 'gray', txt: 'Sin cambios' };
  const puedeCompartir = useMemo(() => puedeCompartirArchivos(null, 'plantilla.xlsx'), []);

  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', width: 96, mono: true, render: (r) => <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: theme.accent }}>{r.sku}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 220, render: (r) => <span title={r.descripcion} style={{ fontFamily: TYPO.fontText, fontSize: 11.5 }}>{r.descripcion}</span> },
    { key: 'roadmap', label: 'Roadmap', align: 'center', width: 60, render: (r) => <Pill tone={roadmapTone(r.roadmap)} size="xs">{r.roadmap || '—'}</Pill> },
    { key: 'so', label: `SO ${metodoInfo(metodo).corto}`, width: 70, render: (r) => { const v = Math.round(r.velocidad?.[clienteKey] || 0); return <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: v > 0 ? theme.text : (theme.textSubtle || theme.textMuted) }}>{v > 0 ? fmtInt(v) : '—'}</span>; } },
    { key: 'stock', label: 'Stock cte.', width: 64, render: (r) => { const s = r.stockCliente?.[clienteKey]; return <span style={{ fontFamily: MONO, fontSize: 11.5, color: s == null ? (theme.textSubtle || theme.textMuted) : theme.text }}>{s == null ? 's/d' : fmtInt(s)}</span>; } },
    { key: 'cob', label: 'Cobertura', align: 'center', width: 76, render: (r) => { const s = r.stockCliente?.[clienteKey]; if (s == null) return '—'; const d = coberturaDias(s, r.velocidad?.[clienteKey] || 0); return <Pill tone={tonoCobertura(d, s > 0)} size="xs">{s > 0 && d != null ? fmtDias(d) : etiquetaCobertura(d, s > 0)}</Pill>; } },
    // Pill (no botón) para que Tab no se detenga aquí y siga de mes en mes.
    { key: 'sug', label: '', align: 'center', width: 70, render: (r) => { const v = Math.round(r.velocidad?.[clienteKey] || 0); return <Pill tone={v > 0 ? 'blue' : 'gray'} size="xs" onClick={v > 0 ? () => sugerir(r) : undefined} title={v > 0 ? `Rellenar los 6 meses con ${fmtInt(v)} pz (${metodoInfo(metodo).desc})` : 'Sin sell-out del cliente'} style={{ cursor: v > 0 ? 'pointer' : 'default', opacity: v > 0 ? 1 : 0.45, border: `1px solid ${v > 0 ? 'currentColor' : theme.border}`, padding: '2px 7px' }}><Wand2 size={10} /> Sugerir</Pill>; } },
    ...ventana.map((m) => ({ key: m.key, label: `${MESES[m.mes - 1]} ${String(m.anio).slice(2)}`, width: 64, render: (r) => <MesInput value={valorMes(r.sku, m.key)} onCommit={(n) => setMes(r.sku, m.key, n)} activo /> })),
    { key: 'just', label: 'Justificación', align: 'left', render: (r) => { const tot = ventana.reduce((a, m) => a + N(valorMes(r.sku, m.key)), 0); return <JustInput value={justif(r.sku)} onCommit={(t) => setJust(r.sku, t)} requerida={tot > 0} error={errores.has(r.sku)} />; } },
    { key: 'est', label: 'Estado', align: 'center', width: 80, render: (r) => { const s = porSku[r.sku]; const tot = ventana.reduce((a, m) => a + N(valorMes(r.sku, m.key)), 0); if (tot <= 0) return <span style={{ opacity: 0.35 }}>—</span>; return <Pill tone={edits[r.sku] ? 'orange' : s?.exportado ? 'green' : 'blue'} size="xs">{edits[r.sku] ? 'Editado' : s?.exportado ? 'Exportado' : 'Borrador'}</Pill>; } },
  ];

  return (
    <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard eyebrow="SKUs con forecast" big={fmtInt(resumen.skus)} sub={`de ${visibles.length} visibles · ${clienteLabel(clienteKey)}`} />
        <KpiCard eyebrow="Piezas en la ventana" big={fmtInt(resumen.piezas)} sub={`${labelMes(ventana[0].anio, ventana[0].mes)} → ${labelMes(ventana[5].anio, ventana[5].mes)}`} />
        <KpiCard eyebrow="Justificación pendiente" big={fmtInt(resumen.faltaJust)} bigColor={resumen.faltaJust ? theme.red : undefined} sub={`mínimo ${MIN_JUSTIFICACION} caracteres por SKU`} badge={resumen.faltaJust ? { tone: 'red', l: 'bloquea export' } : { tone: 'green', l: 'ok' }} />
        <KpiCard eyebrow="Autoguardado" big={estadoGuardado.txt} bigColor={estadoGuardado.tone === 'green' ? theme.green : estadoGuardado.tone === 'orange' ? theme.orange : undefined} sub={`debounce ${DEBOUNCE_MS / 1000} s · forecast_crm`} style={{ minWidth: 0 }} />
      </div>

      <Panel titulo="Captura por cliente" meta="una fila por SKU · piezas enteras · Tab avanza"
        acciones={<>
          <Boton icon={Share2} onClick={() => exportar('compartir')} disabled={exportando || !resumen.skus} title={puedeCompartir ? 'Compartir el archivo (WhatsApp, Correo, AirDrop…)' : 'Este navegador no comparte archivos; se descarga'}>Compartir</Boton>
          <Boton icon={Download} primario onClick={() => exportar('descargar')} disabled={exportando || !resumen.skus}>Exportar plantilla</Boton>
        </>}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <Segmented value={clienteKey} onChange={cambiarCliente} options={CLIENTES.map((c) => ({ id: c.key, label: c.label }))} />
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: TYPO.fontDisplay, fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>
            Mes inicial
            <input type="month" value={mesInicio} onChange={(e) => e.target.value && setMesInicio(e.target.value)} aria-label="Mes inicial de la ventana"
              style={{ height: 28, padding: '0 8px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, outline: 'none' }} />
          </label>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, color: theme.textMuted, fontWeight: 600 }}>Tipo</span>
            {TIPOS_CRM.map((t) => <Pill key={t} tone={tipo === t ? 'blue' : 'gray'} size="xs" onClick={() => cambiarTipo(t)} style={{ cursor: 'pointer', border: `1px solid ${tipo === t ? 'currentColor' : theme.border}`, padding: '2px 8px' }}>{t}</Pill>)}
          </span>
          <Pill tone="gray" size="xs" title="Código de cliente en el CRM (erp_ventas)">CRM {clienteCRM(clienteKey).codigo} · {clienteCRM(clienteKey).nombre}</Pill>
          <span style={{ flex: 1 }} />
          <Pill tone={estadoGuardado.tone} size="xs" dot>{estadoGuardado.txt}</Pill>
        </div>
      </Panel>

      {isLoading ? <Cargando pantalla="forecastCaptura" minHeight={320} /> : (
        <TablaCompacta dense columnas={columnas} filas={visibles} rowKey={(r) => r.sku} maxHeight="calc(100vh - 420px)"
          vacio={soloMovimiento ? `Sin SKUs con sell-out de ${clienteLabel(clienteKey)} en la ventana del método. Quita "Sólo con movimiento" para ver todo el roadmap.` : 'Sin SKUs.'} />
      )}

      <Panel titulo="Lotes exportados" meta={lotes.length ? `${lotes.length} exportación${lotes.length === 1 ? '' : 'es'}` : 'ninguna todavía'} plegable abiertoInicial={false} padding="0">
        <TablaCompacta dense vacio="Aún no se ha exportado ninguna plantilla." filas={lotes} rowKey={(l) => l.id}
          columnas={[
            { key: 'created_at', label: 'Fecha', align: 'left', render: (l) => `${fmtFechaCorta(l.created_at)} · ${new Date(l.created_at).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}` },
            { key: 'clientes', label: 'Cliente(s)', align: 'left', render: (l) => <span style={{ display: 'inline-flex', gap: 4 }}>{(l.clientes || []).map((c) => <Pill key={c} tone={CLIENTES.find((x) => x.key === c)?.tone || 'gray'} size="xs">{clienteLabel(c)}</Pill>)}</span> },
            { key: 'ventana', label: 'Ventana', align: 'left', render: (l) => { const v = ventanaCRM(String(l.mes_inicio).slice(0, 7), l.meses || 6); return `${labelMes(v[0].anio, v[0].mes)} → ${labelMes(v[v.length - 1].anio, v[v.length - 1].mes)}`; } },
            { key: 'filas', label: 'Filas', render: (l) => fmtInt(l.filas) },
            { key: 'archivo_nombre', label: 'Archivo', align: 'left', mono: true, render: (l) => <span style={{ fontFamily: MONO, fontSize: 11 }}>{l.archivo_nombre || '—'}</span> },
            { key: 'dl', label: '', align: 'center', width: 110, render: (l) => <Boton icon={RefreshCw} onClick={() => redescargar(l)} style={{ height: 24, fontSize: 11 }}>Re-descargar</Boton> },
          ]} />
      </Panel>
    </div>
  );
}
