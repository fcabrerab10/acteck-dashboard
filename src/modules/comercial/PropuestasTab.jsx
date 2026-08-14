// PropuestasTab.jsx — Armador de propuestas de venta por cliente.
// Flujo: landing (con recientes) → cliente picker → one-page + Ferruteck → revisar.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ClipboardList, Search, ChevronRight, Download, X, Sparkles, ArrowLeft, Save, Trash2 } from 'lucide-react';
import SinAcceso from '../../components/SinAcceso';
import { FerrutekLoader } from '../../components';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal } from '../../lib/permisos';

// ═══ Constantes ═══
const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', iniciales: 'D', marca: 'Acteck · Balam Rush' },
  { key: 'pcel',       label: 'PCEL',       iniciales: 'P', marca: 'Acteck' },
  { key: 'dicotech',   label: 'Dicotech',   iniciales: 'Di', marca: 'Acteck · Balam Rush' },
];

const FAMILIA_DIGITALIFE_HOJA = {
  'Monitor':        'Monitores',
  'Sillas y Mesas': 'Sillas',
};
const familiaHoja = (familia) => FAMILIA_DIGITALIFE_HOJA[familia] || 'Todo lo demás';

// Meses cerrados anteriores al actual (los últimos 3)
function mesesCerrados() {
  const hoy = new Date();
  const arr = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    arr.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return arr;
}
const MES_ACTUAL = { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
const MES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const MES_FULL  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

// ═══ Paleta derivada del tema ═══
function paletteFromTheme(theme) {
  return {
    accent: theme.accent  || '#007AFF',
    green:  theme.green   || '#34C759',
    orange: theme.orange  || '#FF9500',
    red:    theme.red     || '#FF3B30',
    purple: theme.purple  || '#AF52DE',
    teal:   theme.teal    || '#5AC8FA',
  };
}
function clienteColor(theme, key) {
  const P = paletteFromTheme(theme);
  const map = { digitalife: P.accent, pcel: P.red, dicotech: P.purple };
  return map[key] || P.accent;
}
function fmtInt(n) { return Number(n || 0).toLocaleString('es-MX'); }
function fmtCompact(n) {
  const v = Number(n) || 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return `$${(v / 1_000_000).toFixed(v >= 10_000_000 ? 1 : 2)}M`;
  if (abs >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
  return `$${Math.round(v)}`;
}

// ═══ Persistencia de borradores ═══
// Estrategia: cache local (render instantáneo) + sync a Supabase (fuente de verdad).
// Al iniciar la landing, un useEffect llama syncRecientesFromRemote() que jala de
// Supabase y actualiza el cache. Cualquier local no visto en remote se migra.
// Cada save/remove/setExcelFinal escribe ambos: localStorage inmediato + upsert
// fire-and-forget a Supabase.

const STORAGE_KEY = 'propuestas_recientes_v1';

function loadRecientesLocal() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch { return []; }
}
function saveRecientesLocal(all) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all.slice(0, 50))); } catch {}
}

function rowToReciente(r) {
  return {
    id: r.id,
    clienteKey: r.cliente_key,
    clienteLabel: r.cliente_label,
    nombre: r.nombre,
    estado: r.estado || 'Borrador',
    tstamp: Number(r.tstamp),
    propuesta: r.propuesta || {},
    resumen: r.resumen || {},
    excelFinal: r.excel_final || null,
    exportedFilename: r.exported_filename || null,
    origen: r.origen || null,
    ultimaImportacion: r.ultima_importacion || null,
  };
}
function recienteToRow(entry) {
  return {
    id: entry.id,
    cliente_key: entry.clienteKey,
    cliente_label: entry.clienteLabel || null,
    nombre: entry.nombre || null,
    estado: entry.estado || 'Borrador',
    tstamp: entry.tstamp || Date.now(),
    propuesta: entry.propuesta || {},
    resumen: entry.resumen || {},
    excel_final: entry.excelFinal || null,
    exported_filename: entry.exportedFilename || null,
    origen: entry.origen || null,
    ultima_importacion: entry.ultimaImportacion || null,
    updated_at: new Date().toISOString(),
  };
}

async function fetchRecientesRemote() {
  try {
    const { data, error } = await supabase.from('propuestas_borradores')
      .select('*').order('tstamp', { ascending: false }).limit(50);
    if (error) return null;
    return (data || []).map(rowToReciente);
  } catch { return null; }
}
async function upsertRecienteRemote(entry) {
  try {
    const row = recienteToRow(entry);
    const { error } = await supabase.from('propuestas_borradores').upsert(row, { onConflict: 'id' });
    return !error;
  } catch { return false; }
}
async function deleteRecienteRemote(id) {
  try {
    const { error } = await supabase.from('propuestas_borradores').delete().eq('id', id);
    return !error;
  } catch { return false; }
}

// Sincroniza: (1) sube al remoto cualquier local que no exista allá (migración),
// (2) devuelve el estado remoto como fuente de verdad. Si falla la red, retorna
// null para que el consumer se quede con el cache local.
async function syncRecientesFromRemote() {
  const remote = await fetchRecientesRemote();
  if (remote === null) return null;
  const local = loadRecientesLocal();
  const remoteIds = new Set(remote.map((r) => r.id));
  const toMigrate = local.filter((r) => !remoteIds.has(r.id));
  if (toMigrate.length > 0) {
    await Promise.all(toMigrate.map((r) => upsertRecienteRemote(r)));
    const remote2 = await fetchRecientesRemote();
    if (remote2) { saveRecientesLocal(remote2); return remote2; }
  }
  saveRecientesLocal(remote);
  return remote;
}

// API pública — mantiene firma sincrónica para no romper consumers existentes.
function loadRecientes() { return loadRecientesLocal(); }
function saveReciente(entry) {
  const all = loadRecientesLocal().filter((r) => r.id !== entry.id);
  all.unshift(entry);
  saveRecientesLocal(all);
  upsertRecienteRemote(entry); // fire-and-forget
}
function removeReciente(id) {
  const all = loadRecientesLocal().filter((r) => r.id !== id);
  saveRecientesLocal(all);
  deleteRecienteRemote(id); // fire-and-forget
}
function nuevaPropuestaId() {
  return `prp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// Agrupa recientes por mes-año de creación (basado en tstamp). Devuelve
// Array<{ label, key, items }> ordenado descendente (mes actual arriba).
function agruparPorMes(recientes) {
  const groups = new Map();
  for (const r of recientes) {
    const d = new Date(r.tstamp || Date.now());
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (!groups.has(key)) {
      groups.set(key, {
        key, label: `${MES_FULL[d.getMonth()]} ${d.getFullYear()}`,
        items: [],
      });
    }
    groups.get(key).items.push(r);
  }
  return Array.from(groups.values()).sort((a, b) => b.key.localeCompare(a.key));
}

// Adjunta / reemplaza el Excel final enviado al cliente. Persiste como
// dataUrl base64 en cache local + Supabase. Cambia el estatus a "Enviada".
function setExcelFinalReciente(id, excel) {
  try {
    const all = loadRecientesLocal();
    const idx = all.findIndex((r) => r.id === id);
    if (idx < 0) return;
    if (excel) {
      all[idx] = { ...all[idx], excelFinal: excel, estado: 'Enviada' };
    } else {
      const { excelFinal: _drop, ...rest } = all[idx];
      all[idx] = { ...rest, estado: rest.estado === 'Enviada' ? 'Exportada' : rest.estado };
    }
    saveRecientesLocal(all);
    upsertRecienteRemote(all[idx]); // fire-and-forget
  } catch {}
}

// Convierte un File a dataUrl base64 para persistir en localStorage.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

// Descarga un dataUrl como archivo
function descargarDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
}

// ═══ SPIFFs · parser Excel + upload ═══
// Layout del Excel: fila 1 = título con total, fila 2 = headers, fila 3+ = data.
// Headers esperados (col B..H): Articulo · Descripcion 1 · Situación ·
// Valor Spiff x Unidad MXN · Spiff Total · Inv Total · Transito.
async function parseSpiffsExcel(file) {
  const mod = await import('xlsx-js-style');
  const XLSX = mod.default || mod;
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', cellDates: true });
  const sh = wb.Sheets[wb.SheetNames[0]];
  if (!sh) throw new Error('El archivo está vacío');
  const rows = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  const dataRows = rows.slice(2); // salta título + headers
  const out = [];
  for (const r of dataRows) {
    // r[0] = Articulo, r[1] = Descripcion, r[2] = Situación, r[3] = Monto
    const sku = r?.[0] ? String(r[0]).trim() : null;
    const monto = Number(r?.[3]);
    if (!sku || !monto || monto <= 0) continue;
    out.push({
      sku,
      descripcion: r?.[1] ? String(r[1]).trim() : null,
      situacion: r?.[2] ? String(r[2]).trim() : null,
      monto,
    });
  }
  if (out.length === 0) throw new Error('No se encontraron filas válidas (columnas B=SKU, E=Valor Spiff)');
  return out;
}

// Infiere vigencia del nombre del archivo. Formatos soportados:
// "Spiff Q1 2026" → 01-ene a 31-mar 2026
// "Spiff Q2 2026" → 01-abr a 30-jun 2026, etc.
// Fallback: mes actual completo.
function inferVigenciaFromFilename(name) {
  const m = /Q([1-4])[\s_-]*(\d{4})/i.exec(name || '');
  if (m) {
    const q = parseInt(m[1]);
    const anio = parseInt(m[2]);
    const mesIni = (q - 1) * 3 + 1;
    const mesFin = q * 3;
    const finDia = new Date(anio, mesFin, 0).getDate();
    return {
      inicio: `${anio}-${String(mesIni).padStart(2, '0')}-01`,
      fin: `${anio}-${String(mesFin).padStart(2, '0')}-${String(finDia).padStart(2, '0')}`,
    };
  }
  const hoy = new Date();
  const fin = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  return {
    inicio: `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-01`,
    fin: `${fin.getFullYear()}-${String(fin.getMonth() + 1).padStart(2, '0')}-${String(fin.getDate()).padStart(2, '0')}`,
  };
}

async function subirSpiffs(spiffs, { vigencia_inicio, vigencia_fin, fuente }) {
  // Trae la anon key desde el cliente supabase (ya inicializado)
  const rows = spiffs.map((s) => ({ ...s, vigencia_inicio, vigencia_fin, fuente }));
  // Primero borra la tabla existente (replace), luego upsert
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) throw new Error('No hay sesión activa');
  // Usamos el endpoint import-central (requiere superAdmin)
  const res = await fetch('/api/import-central', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      table: 'spiffs',
      rows,
      // No hay deleteAnios/deletePeriodos aplicables; hacemos delete manual antes
      _replaceAll: true,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  return res.json();
}

async function borrarSpiffsExistentes() {
  const { data: sess } = await supabase.auth.getSession();
  const token = sess?.session?.access_token;
  if (!token) return;
  // Borrado en lote de la tabla spiffs vía RPC del cliente
  await supabase.from('spiffs').delete().gte('id', 0);
}

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════
export default function PropuestasTab() {
  const perfil = usePerfil();
  if (!puedeVerPestanaGlobal(perfil, 'propuestas')) {
    return <SinAcceso motivo="No tienes acceso a Propuestas." />;
  }
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  // Vistas: 0 = Landing, 1 = Cliente picker, 2 = One-Page, 3 = Revisar
  const [vista, setVista] = useState(0);
  const [clienteKey, setClienteKey] = useState(null);
  const [propuesta, setPropuesta] = useState({});
  const [propuestaId, setPropuestaId] = useState(null);
  const [propuestaNombre, setPropuestaNombre] = useState('Cierre');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skus, setSkus] = useState([]);
  const [contexto, setContexto] = useState(null);
  const [recientesTick, setRecientesTick] = useState(0); // fuerza re-render de landing tras guardar
  const [spiffPanelOpen, setSpiffPanelOpen] = useState(false);
  const [spiffUploadMsg, setSpiffUploadMsg] = useState(null);

  const handleSpiffFile = async (file) => {
    if (!file) return;
    setSpiffUploadMsg({ tipo: 'info', msg: 'Parseando…' });
    try {
      const spiffs = await parseSpiffsExcel(file);
      const { inicio, fin } = inferVigenciaFromFilename(file.name);
      await borrarSpiffsExistentes();
      await subirSpiffs(spiffs, { vigencia_inicio: inicio, vigencia_fin: fin, fuente: file.name });
      setSpiffUploadMsg({ tipo: 'ok', msg: `✓ ${spiffs.length} SPIFFs cargados · vigencia ${inicio} → ${fin}` });
      setRecientesTick((t) => t + 1);
      setTimeout(() => setSpiffUploadMsg(null), 4200);
    } catch (e) {
      setSpiffUploadMsg({ tipo: 'error', msg: `✕ ${e.message || 'Error al cargar'}` });
      setTimeout(() => setSpiffUploadMsg(null), 6000);
    }
  };

  // Fetch al entrar a la vista One-Page
  useEffect(() => {
    if (vista < 2 || !clienteKey) return;
    if (skus.length > 0) return;
    setLoading(true);
    fetchAll(clienteKey).then(({ skus: rows, contexto: ctx }) => {
      setSkus(rows);
      setContexto(ctx);
      setLoading(false);
    }).catch((e) => {
      console.warn('[Propuestas]', e);
      setError(e.message || 'Error al cargar');
      setLoading(false);
    });
  }, [vista, clienteKey, skus.length]);

  const reiniciar = () => {
    setVista(0);
    setClienteKey(null);
    setPropuesta({});
    setPropuestaId(null);
    setSkus([]);
    setContexto(null);
    setError(null);
  };

  const iniciarCliente = (cli) => {
    setPropuesta({});
    setPropuestaId(nuevaPropuestaId());
    setPropuestaNombre('Cierre');
    setSkus([]);
    setContexto(null);
    setError(null);
    setClienteKey(cli);
    setVista(2);
  };

  const abrirReciente = (r) => {
    setPropuestaId(r.id);
    setClienteKey(r.clienteKey);
    setPropuesta(r.propuesta || {});
    setPropuestaNombre(r.nombre || 'Cierre');
    setSkus([]);
    setContexto(null);
    setError(null);
    setVista(2);
  };

  // ─── Importar Excel (formato antiguo: SKU, Descripción, Marca, Familia, Piezas, Precio unitario) ───
  const importarExcel = async (file) => {
    if (!file) return;
    const XLSX = window.XLSX;
    if (!XLSX) { alert('SheetJS no está disponible. Recarga la página.'); return; }

    // Auto-detectar cliente por nombre de archivo
    const fname = (file.name || '').toLowerCase();
    let cliDetected = 'digitalife';
    if (fname.includes('pcel')) cliDetected = 'pcel';
    else if (fname.includes('dicotech')) cliDetected = 'dicotech';

    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rows.length) throw new Error('El archivo está vacío');

      // Buscar fila de encabezados (contiene "SKU")
      let headerIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toUpperCase() === 'SKU'));
      if (headerIdx < 0) headerIdx = 0;
      const headers = rows[headerIdx].map((c) => String(c).trim().toLowerCase());

      const idxSku = headers.findIndex((h) => h === 'sku' || h === 'no. parte' || h === 'no parte');
      const idxDesc = headers.findIndex((h) => h.includes('descripc'));
      const idxMarca = headers.findIndex((h) => h === 'marca');
      const idxFam = headers.findIndex((h) => h.includes('familia') || h.includes('categoria') || h.includes('categoría'));
      const idxPz = headers.findIndex((h) => h.includes('pieza') || h.includes('cantidad') || h === 'qty');
      const idxPr = headers.findIndex((h) => h.includes('precio') && !h.includes('total'));

      if (idxSku < 0) throw new Error('No encontré la columna "SKU"');
      if (idxPz < 0)  throw new Error('No encontré la columna "Piezas" o "Cantidad"');

      const propuestaObj = {};
      let count = 0;
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i];
        const sku = String(r[idxSku] || '').trim();
        if (!sku) continue;
        const piezas = Number(r[idxPz]) || 0;
        const precio = idxPr >= 0 ? (Number(r[idxPr]) || 0) : 0;
        if (piezas <= 0) continue;
        propuestaObj[sku] = {
          sku,
          piezas,
          precio,
          descripcion: idxDesc >= 0 ? String(r[idxDesc] || '') : '',
          marca: idxMarca >= 0 ? String(r[idxMarca] || '') : '',
          familia: idxFam >= 0 ? String(r[idxFam] || '') : '',
          _importado: true,
        };
        count++;
      }
      if (count === 0) throw new Error('No encontré filas válidas con piezas > 0');

      const cli = CLIENTES.find((c) => c.key === cliDetected);
      const total = Object.values(propuestaObj).reduce((s, v) => s + (v.piezas * v.precio), 0);
      const piezasTot = Object.values(propuestaObj).reduce((s, v) => s + v.piezas, 0);

      // Nombre corto: quita "Propuesta <Cliente>" del nombre del archivo,
      // y también sufijos tipo "Mes Año" que agrega el exporter
      const rawName = file.name.replace(/\.xlsx?$/i, '');
      const mesFullRe = MES_FULL.join('|');
      const shortName = rawName
        .replace(new RegExp(`^propuesta\\s+${cli?.label || ''}\\s*`, 'i'), '')
        .replace(new RegExp(`\\s+(${mesFullRe})\\s+\\d{4}$`, 'i'), '')
        .trim() || 'Cierre';

      // Si ya existe un borrador con mismo cliente y nombre, actualizarlo
      // en lugar de crear uno nuevo (así el borrador refleja la versión
      // final que se editó fuera del dashboard y se re-importó).
      const existente = loadRecientes().find(
        (r) => r.clienteKey === cliDetected && (r.nombre || '').trim().toLowerCase() === shortName.toLowerCase()
      );
      const id = existente?.id || nuevaPropuestaId();
      const esActualizacion = !!existente;

      saveReciente({
        id,
        clienteKey: cliDetected,
        clienteLabel: cli?.label || cliDetected,
        nombre: shortName,
        estado: esActualizacion ? (existente.estado || 'Borrador') : 'Borrador',
        tstamp: Date.now(),
        propuesta: propuestaObj,
        resumen: { skus: count, piezas: piezasTot, total },
        origen: esActualizacion ? 'Excel re-importado' : 'Excel importado',
        ultimaImportacion: {
          filename: file.name,
          fecha: Date.now(),
          skus: count,
          piezas: piezasTot,
          total,
        },
      });
      setRecientesTick((t) => t + 1);
      abrirReciente({ id, clienteKey: cliDetected, propuesta: propuestaObj, nombre: shortName });
    } catch (e) {
      alert('Error al importar: ' + (e.message || e));
    }
  };

  const guardarBorrador = () => {
    if (!clienteKey || !propuestaId) return;
    const cli = CLIENTES.find((c) => c.key === clienteKey);
    const propuestaLista = Object.entries(propuesta)
      .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
      .filter((r) => r.sku);
    const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
    const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
    saveReciente({
      id: propuestaId,
      clienteKey,
      clienteLabel: cli?.label || clienteKey,
      nombre: propuestaNombre || 'Cierre',
      estado: 'Borrador',
      tstamp: Date.now(),
      propuesta,
      resumen: { skus: propuestaLista.length, piezas, total },
    });
    setRecientesTick((t) => t + 1);
  };

  const cliente = CLIENTES.find((c) => c.key === clienteKey);
  const P = paletteFromTheme(theme);

  // ── Landing ──
  if (vista === 0) {
    return (
      <>
        <Landing
          theme={theme} isDark={isDark}
          onIniciar={() => setVista(1)}
          onAbrirReciente={abrirReciente}
          onImportar={importarExcel}
          onSubirSpiffs={handleSpiffFile}
          onGestionarSpiffs={() => setSpiffPanelOpen(true)}
          spiffUploadMsg={spiffUploadMsg}
          tick={recientesTick}
        />
        {spiffPanelOpen && (
          <SpiffPanel
            theme={theme} isDark={isDark}
            onClose={() => setSpiffPanelOpen(false)}
            onSaved={() => { setRecientesTick((t) => t + 1); }}
          />
        )}
      </>
    );
  }

  // ── Cliente picker ──
  if (vista === 1) {
    return <VistaClientePicker theme={theme} isDark={isDark} onElegir={iniciarCliente} onBack={reiniciar} />;
  }

  // ── Loading / error ──
  if (loading) {
    return <FerrutekLoader label={`Cargando ${cliente?.label || 'cliente'}…`} sub="Ferruteck está trayendo inventario, sell-out, precios y roadmap" minHeight={480} />;
  }
  if (error) {
    return (
      <div style={{ padding: 20, fontFamily: TYPO.fontText }}>
        <div style={{ padding: 14, background: `${P.red}14`, border: `1px solid ${P.red}40`, borderRadius: 12, color: P.red, fontSize: 12 }}>
          {error}
        </div>
      </div>
    );
  }

  // ── One-Page ──
  if (vista === 2) {
    return <VistaOnePage
      theme={theme} isDark={isDark}
      cliente={cliente} contexto={contexto} skus={skus}
      propuesta={propuesta} setPropuesta={setPropuesta}
      nombre={propuestaNombre} setNombre={setPropuestaNombre}
      onBack={reiniciar}
      onGuardar={guardarBorrador}
      onRevisar={() => { guardarBorrador(); setVista(3); }}
    />;
  }

  // ── Revisar ──
  if (vista === 3) {
    return <VistaRevisar
      theme={theme} isDark={isDark}
      cliente={cliente} contexto={contexto} skus={skus} propuesta={propuesta}
      nombre={propuestaNombre} setNombre={setPropuestaNombre}
      onBack={() => setVista(2)}
      onGuardar={guardarBorrador}
      onSalir={() => { guardarBorrador(); reiniciar(); }}
    />;
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════
// LANDING · Header + Hero + Recientes
// ════════════════════════════════════════════════════════════════════
function Landing({ theme, isDark, onIniciar, onAbrirReciente, onImportar, onSubirSpiffs, onGestionarSpiffs, spiffUploadMsg, tick }) {
  const P = paletteFromTheme(theme);
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = theme.textMutedOnDark || 'rgba(255,255,255,0.65)';
  const heroSub = theme.textSubtleOnDark || 'rgba(255,255,255,0.5)';
  const [recientes, setRecientes] = useState(() => loadRecientes());
  useEffect(() => {
    // Cache local para render inmediato + sync con Supabase (fuente de verdad)
    setRecientes(loadRecientes());
    syncRecientesFromRemote().then((r) => { if (r) setRecientes(r); });
  }, [tick]);

  const timeAgo = (ts) => {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `hace ${s}s`;
    if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
    return `hace ${Math.floor(s / 86400)}d`;
  };
  const estadoPill = (est) => {
    if (est === 'Enviada') return { bg: `${P.green}22`, color: P.green };
    if (est === 'Cerrada') return { bg: `${P.accent}22`, color: P.accent };
    return { bg: `${P.orange}22`, color: P.orange };
  };

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Header */}
      <div style={{ padding: '0 4px', marginBottom: 12 }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
          Dirección Comercial · Armador
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
          Propuestas.
        </h2>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText }}>
          Arma propuestas de venta por cliente con inventario, precios y sell-out.
        </p>
      </div>

      {/* Hero card */}
      <div style={{
        background: heroBg, color: heroText, borderRadius: 20, padding: '20px 24px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 20, marginBottom: 20,
        position: 'relative', overflow: 'hidden', flexWrap: 'wrap',
        border: isDark ? '1px solid rgba(255,255,255,0.06)' : 'none',
      }}>
        {isDark && (
          <div style={{
            position: 'absolute', top: '-30%', right: '-10%', width: '60%', height: '100%',
            background: `radial-gradient(circle, ${P.accent}22 0%, transparent 70%)`, pointerEvents: 'none',
          }} />
        )}
        <div style={{ position: 'relative', maxWidth: 520 }}>
          <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: heroSub, fontWeight: 500, margin: 0 }}>
            Cierra el mes
          </p>
          <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em', color: heroText, margin: '4px 0 6px' }}>
            Empújalo con una propuesta ganadora.
          </h2>
          <p style={{ color: heroMuted, fontSize: 12, lineHeight: 1.5, margin: 0 }}>
            El mes cierra pronto. Arma una propuesta con las recomendaciones de Ferruteck y déjala lista antes del corte.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', position: 'relative' }}>
          <button onClick={onIniciar}
            style={{ padding: '11px 22px', background: P.accent, color: '#FFFFFF', border: 0, borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em' }}>
            + Nueva propuesta
          </button>
          {onImportar && (
            <label style={{
              padding: '11px 20px', background: 'rgba(255,255,255,0.10)', color: heroText,
              border: `1px solid rgba(255,255,255,0.20)`, borderRadius: 999, fontSize: 13, fontWeight: 600,
              fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
              display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
              ↑ Importar Excel
              <input type="file" accept=".xlsx,.xls"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportar(f); e.target.value = ''; }}
                style={{ display: 'none' }} />
            </label>
          )}
          {onSubirSpiffs && (
            <label title="Sube el Excel de SPIFFs (vigencia auto-detectada del nombre)"
              style={{
                padding: '11px 20px', background: 'rgba(255,255,255,0.10)', color: heroText,
                border: `1px solid rgba(255,255,255,0.20)`, borderRadius: 999, fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              ↑ Excel de SPIFFs
              <input type="file" accept=".xlsx,.xls"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) onSubirSpiffs(f); e.target.value = ''; }}
                style={{ display: 'none' }} />
            </label>
          )}
          {onGestionarSpiffs && (
            <button onClick={onGestionarSpiffs} title="Editar SPIFFs cargados: monto, vigencia, agregar/quitar SKUs"
              style={{
                padding: '11px 20px', background: 'rgba(255,255,255,0.10)', color: heroText,
                border: `1px solid rgba(255,255,255,0.20)`, borderRadius: 999, fontSize: 13, fontWeight: 600,
                fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
                display: 'inline-flex', alignItems: 'center', gap: 6,
              }}>
              ⚙ Gestionar SPIFFs
            </button>
          )}
        </div>
      </div>

      {spiffUploadMsg && (
        <div style={{
          padding: '10px 16px', marginBottom: 12, borderRadius: 10,
          background: spiffUploadMsg.tipo === 'ok' ? `${P.green}18` : spiffUploadMsg.tipo === 'error' ? `${P.red}18` : `${P.accent}14`,
          color: spiffUploadMsg.tipo === 'ok' ? P.green : spiffUploadMsg.tipo === 'error' ? P.red : P.accent,
          border: `1px solid ${spiffUploadMsg.tipo === 'ok' ? P.green : spiffUploadMsg.tipo === 'error' ? P.red : P.accent}33`,
          fontSize: 12, fontWeight: 500,
        }}>
          {spiffUploadMsg.msg}
        </div>
      )}

      {/* Recientes agrupadas por mes + filtros + slot Excel final */}
      <PropuestasRecientes
        theme={theme} isDark={isDark} P={P}
        recientes={recientes}
        onAbrirReciente={onAbrirReciente}
        onRefresh={() => {
          setRecientes(loadRecientes());
          syncRecientesFromRemote().then((r) => { if (r) setRecientes(r); });
        }}
      />
    </div>
  );
}

// ────────── Recientes: filtros + agrupado por mes + slot Excel final ──────────
function PropuestasRecientes({ theme, isDark, P, recientes, onAbrirReciente, onRefresh }) {
  const [filtroCli, setFiltroCli] = useState('todos');
  const [filtroEst, setFiltroEst] = useState('todas');
  const [busqueda, setBusqueda] = useState('');

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return recientes.filter((r) => {
      if (filtroCli !== 'todos' && r.clienteKey !== filtroCli) return false;
      if (filtroEst !== 'todas') {
        const est = r.estado || 'Borrador';
        if (filtroEst === 'borrador' && est !== 'Borrador') return false;
        if (filtroEst === 'exportada' && est !== 'Exportada') return false;
        if (filtroEst === 'enviada' && est !== 'Enviada') return false;
      }
      if (q) {
        const hay = `${r.nombre || ''} ${r.clienteLabel || ''} ${r.clienteKey || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [recientes, filtroCli, filtroEst, busqueda]);

  const grupos = useMemo(() => agruparPorMes(filtradas), [filtradas]);

  const segStyle = (active) => ({
    padding: '5px 12px', borderRadius: 999, fontSize: 11, fontWeight: active ? 600 : 500,
    cursor: 'pointer', border: 0,
    background: active ? theme.surface : 'transparent',
    color: active ? theme.text : theme.textMuted,
    boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
    fontFamily: 'inherit',
  });

  return (
    <div style={{ padding: '0 4px' }}>
      {/* Filtros */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{
          flex: 1, maxWidth: 280,
          background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999,
          padding: '7px 14px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: theme.textMuted,
        }}>
          <Search style={{ width: 12, height: 12 }} strokeWidth={2.2} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre, cliente…"
            style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 11.5, color: theme.text, flex: 1 }} />
        </div>
        <div style={{ display: 'inline-flex', padding: 2, background: isDark ? 'rgba(255,255,255,0.06)' : '#EFEFF4', borderRadius: 999, gap: 1 }}>
          {[
            { k: 'todos', l: 'Todos' },
            { k: 'digitalife', l: 'Digi' },
            { k: 'pcel', l: 'PCEL' },
            { k: 'dicotech', l: 'Dico' },
          ].map((op) => (
            <button key={op.k} onClick={() => setFiltroCli(op.k)} style={segStyle(filtroCli === op.k)}>{op.l}</button>
          ))}
        </div>
        <div style={{ display: 'inline-flex', padding: 2, background: isDark ? 'rgba(255,255,255,0.06)' : '#EFEFF4', borderRadius: 999, gap: 1 }}>
          {[
            { k: 'todas', l: 'Todas' },
            { k: 'borrador', l: 'Borradores' },
            { k: 'exportada', l: 'Exportadas' },
            { k: 'enviada', l: 'Enviadas' },
          ].map((op) => (
            <button key={op.k} onClick={() => setFiltroEst(op.k)} style={segStyle(filtroEst === op.k)}>{op.l}</button>
          ))}
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
          {filtradas.length} de {recientes.length}
        </span>
      </div>

      {filtradas.length === 0 ? (
        <div style={{
          background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 14,
          padding: 32, textAlign: 'center', color: theme.textMuted, fontSize: 12,
        }}>
          {recientes.length === 0
            ? 'Al guardar borradores aparecerán aquí para volver a abrirlos con un click.'
            : 'Ninguna propuesta con los filtros actuales.'}
        </div>
      ) : (
        grupos.map((g) => (
          <MesGroup key={g.key} grupo={g} theme={theme} isDark={isDark} P={P}
            onAbrirReciente={onAbrirReciente} onRefresh={onRefresh} />
        ))
      )}
    </div>
  );
}

function MesGroup({ grupo, theme, isDark, P, onAbrirReciente, onRefresh }) {
  const totalMes = grupo.items.reduce((s, r) => s + (Number(r.resumen?.total) || 0), 0);
  const enviadas = grupo.items.filter((r) => r.estado === 'Enviada').length;
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 10, paddingBottom: 6 }}>
        <h5 style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, margin: 0 }}>
          {grupo.label}
        </h5>
        <span style={{ fontSize: 10.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
          {grupo.items.length} propuesta{grupo.items.length === 1 ? '' : 's'} · {fmtCompact(totalMes)} total{enviadas > 0 ? ` · ${enviadas} enviada${enviadas === 1 ? '' : 's'}` : ''}
        </span>
        <div style={{ flex: 1, height: 1, background: theme.border, marginLeft: 8 }}></div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {grupo.items.map((r) => (
          <PropuestaCard key={r.id} r={r} theme={theme} isDark={isDark} P={P}
            onAbrir={() => onAbrirReciente(r)} onRefresh={onRefresh} />
        ))}
      </div>
    </div>
  );
}

function PropuestaCard({ r, theme, isDark, P, onAbrir, onRefresh }) {
  const cli = CLIENTES.find((c) => c.key === r.clienteKey);
  const col = clienteColor(theme, r.clienteKey);
  const estado = r.estado || 'Borrador';
  const pill =
    estado === 'Enviada' ? { bg: `${P.accent}22`, color: P.accent, label: 'Enviada' } :
    estado === 'Exportada' ? { bg: `${P.green}22`, color: P.green, label: 'Exportada' } :
    { bg: `${P.orange}22`, color: P.orange, label: 'Borrador' };

  const timeAgo = (ts) => {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return `hace ${s}s`;
    if (s < 3600) return `hace ${Math.floor(s / 60)}m`;
    if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
    return `hace ${Math.floor(s / 86400)}d`;
  };

  const onSubirExcel = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const dataUrl = await fileToDataUrl(f);
      setExcelFinalReciente(r.id, { name: f.name, size: f.size, dataUrl, tstamp: Date.now() });
      onRefresh();
    } catch (err) { console.warn('excel final', err); }
  };
  const onQuitarExcel = (e) => {
    e.stopPropagation();
    if (!confirm('¿Quitar el Excel final adjunto?')) return;
    setExcelFinalReciente(r.id, null);
    onRefresh();
  };
  const onDescargarExcel = (e) => {
    e.stopPropagation();
    if (r.excelFinal?.dataUrl) descargarDataUrl(r.excelFinal.dataUrl, r.excelFinal.name);
  };

  const puedeAdjuntar = estado !== 'Borrador'; // solo exportadas/enviadas tienen sentido

  return (
    <div
      onClick={onAbrir}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer', transition: 'transform 120ms, border-color 120ms, box-shadow 120ms',
        fontFamily: TYPO.fontText,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'scale(1.015)'; e.currentTarget.style.boxShadow = `0 8px 24px ${theme.text}18`; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <div style={{
          width: 26, height: 26, borderRadius: 7, background: col, color: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 11, letterSpacing: '-0.02em', flexShrink: 0,
        }}>{cli?.iniciales || '?'}</div>
        <span style={{ flex: 1, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.005em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {cli?.label || r.clienteLabel} · {r.nombre || 'Cierre'}
        </span>
        <span style={{
          padding: '2px 7px', borderRadius: 6, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.04em',
          textTransform: 'uppercase', background: pill.bg, color: pill.color, fontFamily: '"SF Mono", ui-monospace, monospace',
        }}>{pill.label}</span>
        {estado === 'Borrador' && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              const label = `${cli?.label || r.clienteLabel} · ${r.nombre || 'Cierre'}`;
              if (!confirm(`¿Eliminar el borrador "${label}"?\n\nEsta acción no se puede deshacer.`)) return;
              removeReciente(r.id);
              onRefresh();
            }}
            title="Eliminar borrador"
            style={{
              width: 24, height: 24, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', border: 0, borderRadius: 6, cursor: 'pointer',
              color: theme.textMuted, flexShrink: 0, padding: 0,
              transition: 'background 160ms, color 160ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `${P.red}15`; e.currentTarget.style.color = P.red; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = theme.textMuted; }}
          >
            <Trash2 size={13} strokeWidth={2} />
          </button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '4px 12px', fontSize: 11, marginBottom: 8 }}>
        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textSubtle || theme.textMuted, fontWeight: 600 }}>SKUs</span>
        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textSubtle || theme.textMuted, fontWeight: 600 }}>Piezas</span>
        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textSubtle || theme.textMuted, fontWeight: 600 }}>Total</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, fontSize: 13 }}>{r.resumen?.skus || 0}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, fontSize: 13 }}>{fmtInt(r.resumen?.piezas || 0)}</span>
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, fontSize: 13, color: P.green }}>{fmtCompact(r.resumen?.total || 0)}</span>
      </div>

      {/* Slot Excel final */}
      {puedeAdjuntar && (
        r.excelFinal ? (
          <div style={{
            background: `${P.green}12`, border: `1px solid ${P.green}44`, borderRadius: 8,
            padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 8, marginTop: 6,
          }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: P.green, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, flexShrink: 0 }}>📎</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 10, color: P.green, fontWeight: 600 }}>Excel final enviado</div>
              <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9.5, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.excelFinal.name}</div>
            </div>
            <button onClick={onDescargarExcel} title="Descargar"
              style={{ padding: '2px 6px', background: theme.surface, border: 0, borderRadius: 4, fontSize: 10, cursor: 'pointer', color: theme.textMuted }}>↓</button>
            <button onClick={onQuitarExcel} title="Quitar"
              style={{ padding: '2px 6px', background: theme.surface, border: 0, borderRadius: 4, fontSize: 10, cursor: 'pointer', color: theme.textMuted }}>✕</button>
          </div>
        ) : (
          <label onClick={(e) => e.stopPropagation()}
            style={{
              border: `1.5px dashed ${theme.border}`, borderRadius: 8, padding: '8px 10px',
              display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 6,
              transition: 'border-color 160ms, background 160ms',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = P.accent; e.currentTarget.style.background = `${P.accent}0A`; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = theme.border; e.currentTarget.style.background = 'transparent'; }}>
            <div style={{ width: 22, height: 22, borderRadius: 5, background: theme.bg, color: theme.textMuted, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11 }}>📎</div>
            <span style={{ flex: 1, fontSize: 10.5, color: theme.textMuted, fontWeight: 500 }}>Sube el Excel final que le enviaste al cliente</span>
            <input type="file" accept=".xlsx,.xls" onChange={onSubirExcel} style={{ display: 'none' }} />
          </label>
        )
      )}

      <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
          {timeAgo(r.tstamp)}
        </span>
        {r.exportedFilename && (
          <span style={{ fontSize: 9.5, color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>{r.exportedFilename.slice(0, 24)}{r.exportedFilename.length > 24 ? '…' : ''}</span>
        )}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VISTA CLIENTE PICKER
// ════════════════════════════════════════════════════════════════════
function VistaClientePicker({ theme, isDark, onElegir, onBack }) {
  const [kpis, setKpis] = useState({}); // { clienteKey: { cuota, facturado, gap } }
  const [ultimasProp, setUltimasProp] = useState({}); // { clienteKey: lastReciente }

  useEffect(() => {
    (async () => {
      const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
      const cliKeys = CLIENTES.map((c) => c.key);
      // Fuente canónica del sell-in real: facturacion_clientes (mismo que Sell In V2).
      // v_ventas_mensuales_agg quedaba desactualizada en varios meses.
      const [cuotas, factRes] = await Promise.all([
        supabase.from('cuotas_mensuales').select('cliente,cuota_min,cuota_ideal').eq('anio', anio).eq('mes', mes).in('cliente', cliKeys),
        supabase.from('facturacion_clientes').select('cliente_key,monto').eq('anio', anio).eq('mes', mes).in('cliente_key', cliKeys),
      ]);
      const out = {};
      for (const k of cliKeys) out[k] = { cuota: 0, facturado: 0 };
      (cuotas.data || []).forEach((r) => {
        if (out[r.cliente]) out[r.cliente].cuota += Number(r.cuota_min || r.cuota_ideal || 0);
      });
      (factRes.data || []).forEach((r) => {
        if (out[r.cliente_key]) out[r.cliente_key].facturado += Number(r.monto || 0);
      });
      Object.values(out).forEach((v) => { v.gap = Math.max(0, v.cuota - v.facturado); });
      setKpis(out);
      // Última propuesta por cliente
      const rec = loadRecientes();
      const ultima = {};
      for (const r of rec) if (!ultima[r.clienteKey]) ultima[r.clienteKey] = r;
      setUltimasProp(ultima);
    })();
  }, []);

  const P = paletteFromTheme(theme);
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantes = Math.max(0, Math.ceil((finMes - hoy) / 86400000));

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 4px', marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <button onClick={onBack}
            style={{ background: 'transparent', border: 0, padding: 0, fontSize: 11, color: theme.textMuted, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            ← Propuestas
          </button>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Nueva propuesta.
          </h2>
        </div>
      </div>

      <div style={{ padding: '10px 4px 30px' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: '4px 0 5px' }}>
            ¿Para qué cliente?
          </h3>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>
            Elige el cliente y arma la propuesta con Ferruteck en la siguiente pantalla.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 1080, width: '100%', margin: '0 auto' }}>
          {CLIENTES.map((c) => {
            const col = clienteColor(theme, c.key);
            const k = kpis[c.key];
            const cuota = k?.cuota || 0;
            const facturado = k?.facturado || 0;
            const gap = k?.gap ?? 0;
            const pctCumpl = cuota > 0 ? (facturado / cuota) * 100 : 0;
            const gapCol = gap > 300000 ? '#FF453A' : gap > 100000 ? '#FF9F0A' : '#30D158';
            const ultima = ultimasProp[c.key];
            const estUlt = ultima?.estado || 'Borrador';
            const estColor = estUlt === 'Enviada' ? '#30D158' : estUlt === 'Exportada' ? '#64D2FF' : '#FF9F0A';
            const timeAgoStr = (ts) => {
              if (!ts) return '';
              const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
              if (s < 3600) return `hace ${Math.floor(s / 60) || 1}m`;
              if (s < 86400) return `hace ${Math.floor(s / 3600)}h`;
              return `hace ${Math.floor(s / 86400)}d`;
            };
            return (
              <button key={c.key} onClick={() => onElegir(c.key)}
                style={{
                  padding: 0, background: '#000', color: '#F5F5F7',
                  border: 0, borderRadius: 14, cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  overflow: 'hidden', position: 'relative',
                  transition: 'transform 240ms cubic-bezier(0.34, 1.56, 0.64, 1)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}>
                {/* Barra accent */}
                <div style={{ height: 3, background: col }} />
                {/* Top: avatar + nombre */}
                <div style={{ padding: '20px 22px 14px', display: 'flex', alignItems: 'center', gap: 14, borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: 13, background: col, color: '#FFF',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em',
                  }}>{c.iniciales}</div>
                  <div>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em' }}>{c.label}</div>
                    <div style={{ fontSize: 11, color: 'rgba(245,245,247,0.55)', marginTop: 3 }}>{c.marca}</div>
                  </div>
                </div>
                {/* Stats */}
                <div style={{ padding: '14px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px 16px' }}>
                  <Stat label="Cuota Ago" value={fmtCompact(cuota)} />
                  <Stat label="Facturado" value={cuota > 0 ? `${fmtCompact(facturado)} · ${pctCumpl.toFixed(0)}%` : fmtCompact(facturado)} />
                  <Stat label="Gap" value={gap > 0 ? fmtCompact(gap) : '✓ Cumplida'} color={gap > 0 ? gapCol : '#30D158'} />
                  <Stat label="Días" value={`${diasRestantes}d`} />
                </div>
                {/* Última propuesta */}
                <div style={{ padding: '0 22px 14px', fontSize: 10.5, color: 'rgba(245,245,247,0.55)', display: 'flex', alignItems: 'center', gap: 5, borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: 14 }}>
                  {ultima ? (
                    <>📋 Última: <span style={{ background: `${estColor}33`, color: estColor, padding: '2px 7px', borderRadius: 5, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{estUlt}</span> · {ultima.resumen?.skus || 0} SKUs · {timeAgoStr(ultima.tstamp)}</>
                  ) : (
                    <>📋 Sin propuestas previas</>
                  )}
                </div>
                {/* CTA */}
                <div style={{ padding: '14px 22px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: '#F5F5F7' }}>
                  <span>Armar propuesta</span>
                  <span style={{ fontSize: 16, opacity: 0.6 }}>→</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, color }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.5)' }}>{label}</div>
      <div style={{ fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', fontFamily: '"SF Mono", ui-monospace, monospace', marginTop: 3, color: color || '#F5F5F7' }}>{value}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VISTA ONE-PAGE + COPILOT
// ════════════════════════════════════════════════════════════════════
function VistaOnePage({ theme, isDark, cliente, contexto, skus, propuesta, setPropuesta, onBack, onGuardar, onRevisar }) {
  const P = paletteFromTheme(theme);
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroSub = theme.textSubtleOnDark || 'rgba(255,255,255,0.5)';
  const cliCol = clienteColor(theme, cliente.key);

  const [busqueda, setBusqueda] = useState('');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [soloConInv, setSoloConInv] = useState(true);
  const [orden, setOrden] = useState({ col: 'sellout90', dir: 'desc' });
  const [savedMsg, setSavedMsg] = useState(null);
  const handleGuardar = () => {
    onGuardar?.();
    setSavedMsg('✓ Borrador guardado');
    setTimeout(() => setSavedMsg(null), 1800);
  };

  const familias = useMemo(() => {
    const s = new Set();
    for (const r of skus) if (r.familia) s.add(r.familia);
    return ['todas', ...Array.from(s).sort()];
  }, [skus]);

  // Meses cerrados (los 3 anteriores al actual). mm[0] = mes anterior, [1] anterior a ese, [2] tres atrás.
  const mesesCerr = useMemo(() => mesesCerrados(), []);
  const mesesLabels = mesesCerr.map((m) => MES_LABEL[m.mes - 1]);
  const mesesKeys = mesesCerr.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const arr = skus.filter((r) => {
      if (filtroFamilia !== 'todas' && r.familia !== filtroFamilia) return false;
      if (soloConInv && (r.invActeck || 0) <= 0) return false;
      if (q && !(String(r.sku).toUpperCase().includes(q) || String(r.descripcion).toUpperCase().includes(q))) return false;
      return true;
    });
    if (orden.col) {
      const mult = orden.dir === 'asc' ? 1 : -1;
      arr.sort((a, b) => ((Number(a[orden.col]) || 0) - (Number(b[orden.col]) || 0)) * mult);
    }
    return arr;
  }, [skus, busqueda, filtroFamilia, soloConInv, orden]);

  const toggleOrden = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: 'sellout90', dir: 'desc' };
    });
  };

  const toggleSku = (sku) => {
    setPropuesta((prev) => {
      const next = { ...prev };
      if (sku in next) { delete next[sku]; return next; }
      const meta = skus.find((r) => r.sku === sku);
      const precioDefault = meta ? Object.values(meta.precios)[0] || 0 : 0;
      const listaDefault = meta ? Object.keys(meta.precios)[0] || '' : '';
      next[sku] = {
        piezas: Math.max(1, meta?.promSellout || 1),
        precio: precioDefault,
        listaSel: listaDefault,
      };
      return next;
    });
  };

  const editarSku = (sku, cambios) => {
    setPropuesta((prev) => {
      if (!(sku in prev)) return prev;
      return { ...prev, [sku]: { ...prev[sku], ...cambios } };
    });
  };

  const aplicarPaquete = (skusIds) => {
    setPropuesta((prev) => {
      const next = { ...prev };
      skusIds.forEach((sku) => {
        if (sku in next) return;
        const meta = skus.find((r) => r.sku === sku);
        if (!meta) return;
        const precioDefault = Object.values(meta.precios)[0] || 0;
        const listaDefault = Object.keys(meta.precios)[0] || '';
        next[sku] = {
          piezas: Math.max(1, meta.promSellout || 1),
          precio: precioDefault,
          listaSel: listaDefault,
        };
      });
      return next;
    });
  };

  const propuestaLista = useMemo(() => Object.entries(propuesta)
    .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
    .filter((r) => r.sku), [propuesta, skus]);
  const totalPropuesta = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezasTotal = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
  const spiffTotal = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.spiff) || 0), 0);
  const spiffSkusCount = propuestaLista.filter((r) => (Number(r.spiff) || 0) > 0 && (Number(r.piezas) || 0) > 0).length;
  const spiffDisponiblesCount = (skus || []).filter((r) => (Number(r.spiff) || 0) > 0).length;

  const cuotaPct = contexto?.cuota > 0 ? Math.min(100, Math.round((contexto.facturado / contexto.cuota) * 100)) : 0;

  const thBase = {
    position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
    textAlign: 'right', padding: '8px 6px',
    fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase',
    letterSpacing: '0.06em', color: theme.textMuted,
    borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
  };
  const thLeft = { ...thBase, textAlign: 'left' };

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%', display: 'flex', flexDirection: 'column', padding: '10px 12px 0' }}>
      {/* HERO negro grande — estilo S&OP */}
      <div style={{
        position: 'relative', overflow: 'hidden',
        background: '#000', color: '#F5F5F7',
        borderRadius: 14, padding: '20px 28px',
        marginBottom: 12,
      }}>
        <div style={{
          position: 'absolute', top: '-40%', right: '-10%', width: '50%', height: '200%',
          background: `radial-gradient(circle, ${P.accent}22 0%, transparent 60%)`, pointerEvents: 'none',
        }} />
        {/* Botón volver arriba */}
        <button onClick={onBack} title="Volver a Propuestas"
          style={{ position:'relative', background: 'transparent', border: 0, padding: 0, color: 'rgba(245,245,247,0.65)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'inherit', marginBottom: 6 }}>
          <ArrowLeft style={{ width: 12, height: 12 }} strokeWidth={2} /> Propuestas
        </button>

        <div style={{ position: 'relative', display: 'grid', gridTemplateColumns: contexto ? '1.4fr repeat(4, auto)' : '1fr', gap: 36, alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)' }}>
              Dirección Comercial · Armador · {MES_FULL[MES_ACTUAL.mes - 1]} {MES_ACTUAL.anio}
            </div>
            <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 28, fontWeight: 600, letterSpacing: '-0.025em', color: '#F5F5F7', margin: '6px 0', lineHeight: 1.15, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{
                width: 34, height: 34, borderRadius: 10, background: cliCol, color: '#FFF',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14, letterSpacing: '-0.02em',
              }}>{cliente.iniciales}</span>
              Propuesta {cliente.label}.
            </h2>
            <p style={{ fontSize: 12, color: 'rgba(245,245,247,0.68)', margin: 0, maxWidth: 640, lineHeight: 1.5 }}>
              <strong style={{ color: '#F5F5F7', fontWeight: 500 }}>{fmtInt(skus.length)} SKUs</strong> disponibles ·
              <strong style={{ color: '#FFD60A', fontWeight: 600 }}> {propuestaLista.length} en export</strong> · Cierra el mes con las recomendaciones de Ferruteck y déjala lista antes del corte.
            </p>
          </div>
          {contexto && (
            <>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)', marginBottom: 6 }}>Cuota {MES_LABEL[MES_ACTUAL.mes - 1]}</div>
                <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 24, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1, color: '#F5F5F7' }}>
                  {fmtCompact(contexto.cuota)}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(245,245,247,0.55)', marginTop: 4, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  {contexto.cuota > 0 ? 'meta del mes' : 'sin capturar'}
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)', marginBottom: 6 }}>Facturado · {cuotaPct}%</div>
                <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 24, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1, color: '#F5F5F7' }}>
                  {fmtCompact(contexto.facturado)}
                </div>
                <div style={{ height: 4, background: 'rgba(255,255,255,0.10)', borderRadius: 999, overflow: 'hidden', marginTop: 6, width: 120 }}>
                  <div style={{ height: '100%', width: `${cuotaPct}%`, background: cuotaPct >= 90 ? '#30D158' : cuotaPct >= 60 ? '#FFD60A' : '#FF9F0A', borderRadius: 999 }} />
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)', marginBottom: 6 }}>Total propuesta</div>
                <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 24, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1, color: totalPropuesta > 0 ? '#30D158' : 'rgba(245,245,247,0.55)' }}>
                  {totalPropuesta > 0 ? fmtCompact(totalPropuesta) : '$0'}
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(245,245,247,0.55)', marginTop: 4, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  {propuestaLista.length} SKUs · {fmtInt(piezasTotal)} pz
                </div>
              </div>
              <div style={{ position: 'relative' }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)', marginBottom: 6 }}>Días</div>
                <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 24, fontWeight: 600, letterSpacing: '-0.028em', lineHeight: 1, color: '#F5F5F7' }}>
                  {contexto.diasRestantes}d
                </div>
                <div style={{ fontSize: 10.5, color: 'rgba(245,245,247,0.55)', marginTop: 4, fontFamily: '"SF Mono", ui-monospace, monospace' }}>hasta corte</div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Banner de warnings — detecta data faltante y ofrece ir a arreglarla */}
      {(contexto?.warnings?.length || 0) > 0 && (
        <div style={{ padding: '10px 16px 4px', display: 'flex', flexDirection: 'column', gap: 6, background: theme.bg }}>
          {contexto.warnings.map((w, i) => {
            const color = w.tipo === 'error' ? P.red : w.tipo === 'warn' ? P.orange : P.accent;
            return (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px', borderRadius: 10,
                background: `${color}10`, border: `1px solid ${color}44`, fontSize: 12,
              }}>
                <span style={{ color, fontSize: 13, fontWeight: 700 }}>
                  {w.tipo === 'error' ? '⚠' : w.tipo === 'warn' ? '▲' : 'ℹ'}
                </span>
                <span style={{ fontWeight: 600, color: theme.text }}>{w.titulo}</span>
                <span style={{ color: theme.textMuted }}>· {w.msg}</span>
                {w.link && (
                  <a href={w.link} target="_blank" rel="noopener noreferrer"
                    style={{ marginLeft: 'auto', color, fontWeight: 600, textDecoration: 'none', fontSize: 11.5, whiteSpace: 'nowrap' }}>
                    Ir al uploader →
                  </a>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Body: catálogo (izq) + copilot (der) — gap para separar visualmente */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 12, flex: 1, minHeight: 0, padding: '0 12px 12px' }}>
        {/* Catálogo — card blanca redondeada como el resto del sistema */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, overflow: 'hidden' }}>
          {/* Toolbar */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderBottom: `1px solid ${theme.border}`, background: theme.surface, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30, flex: 1, maxWidth: 260 }}>
              <Search style={{ width: 12, height: 12, color: theme.textMuted }} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar SKU o descripción…"
                style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 11, color: theme.text, flex: 1 }} />
            </div>
            <select value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}
              style={{ height: 30, padding: '0 12px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 11, color: theme.text, fontFamily: 'inherit', cursor: 'pointer' }}>
              {familias.map((f) => <option key={f} value={f}>{f === 'todas' ? 'Todas las familias' : f}</option>)}
            </select>
            <button onClick={() => setSoloConInv((v) => !v)}
              style={{
                height: 30, padding: '0 12px', border: `1px solid ${soloConInv ? P.accent : theme.border}`, borderRadius: 999,
                fontSize: 11, color: soloConInv ? P.accent : theme.text, fontFamily: 'inherit', cursor: 'pointer',
                background: soloConInv ? `${P.accent}18` : theme.surface,
                fontWeight: soloConInv ? 600 : 500,
              }}>
              Solo con inventario
            </button>
            <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
              <strong style={{ color: P.accent, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{propuestaLista.length} sel</strong> · {fmtInt(filtrados.length)} SKUs
            </span>
          </div>

          {/* Tabla */}
          <div style={{ flex: 1, overflow: 'auto', background: theme.surface, minHeight: 400 }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ ...thLeft, width: 96 }}>SKU</th>
                  <th style={thLeft}>Descripción</th>
                  <th style={{ ...thLeft, width: 110 }}>Familia</th>
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="invCliente" width={62}>Inv cli</SortableTh>
                  <th style={{ ...thBase, width: 54, background: `${P.accent}0F`, color: P.accent }}>{mesesLabels[2]}</th>
                  <th style={{ ...thBase, width: 54, background: `${P.accent}0F`, color: P.accent }}>{mesesLabels[1]}</th>
                  <th style={{ ...thBase, width: 54, background: `${P.accent}0F`, color: P.accent }}>{mesesLabels[0]}</th>
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="promSellout" width={58}>⌀ 3m</SortableTh>
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="invActeck" width={62}>Inv Ack</SortableTh>
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="spiff" width={54}>
                    SPIFF
                    <span style={{ display: 'block', fontSize: 8, fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: theme.textSubtle || theme.textMuted, marginTop: 1 }}>$/pz</span>
                  </SortableTh>
                  <th style={{ ...thBase, width: 78 }}>Piezas</th>
                  <th style={{ ...thLeft, width: 154 }}>Precio</th>
                  <th style={{ ...thBase, width: 88 }}>Total</th>
                  <th style={{ ...thBase, width: 40, textAlign: 'center' }}></th>
                </tr>
              </thead>
              <tbody>
                {filtrados.slice(0, 300).map((r) => {
                  const sel = r.sku in propuesta;
                  const val = propuesta[r.sku] || {};
                  const listasKeys = Object.keys(r.precios);
                  const precioActual = Number(val.precio || 0);
                  const totalFila = (Number(val.piezas) || 0) * precioActual;
                  return (
                    <tr key={r.sku}
                      style={{
                        background: sel ? `${P.accent}${isDark ? '1F' : '0D'}` : 'transparent',
                        transition: 'background 100ms',
                        borderTop: `1px solid ${theme.border}`,
                      }}>
                      <td style={{ padding: '6px 6px 6px 12px', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text }}>{r.sku}</td>
                      <td style={{ padding: '6px 6px', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion || '—'}</td>
                      <td style={{ padding: '6px 6px', color: theme.textMuted, fontSize: 10.5 }}>{r.familia || '—'}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{r.invCliente ? fmtInt(r.invCliente) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                      {/* Sellout Jul/Jun/May (orden viejo→reciente: mesesKeys[2], [1], [0]) */}
                      {[2, 1, 0].map((idx) => {
                        const v = Number(r.selloutMes?.[mesesKeys[idx]] || 0);
                        return (
                          <td key={idx} style={{ padding: '6px 6px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums', background: `${P.accent}05` }}>
                            {v ? fmtInt(v) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}
                          </td>
                        );
                      })}
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12, fontVariantNumeric: 'tabular-nums', background: `${P.accent}0F` }}>
                        {r.promSellout ? fmtInt(r.promSellout) : <span style={{ color: theme.textSubtle || theme.textMuted, fontWeight: 400 }}>—</span>}
                      </td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{r.invActeck ? fmtInt(r.invActeck) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', color: r.spiff > 0 ? '#B45309' : (theme.textSubtle || theme.textMuted), fontWeight: r.spiff > 0 ? 600 : 400, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                        {r.spiff > 0 ? `$${r.spiff}` : '—'}
                      </td>
                      {/* Piezas (editable si sel) */}
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        {sel ? (
                          <input type="number" min="0" value={val.piezas ?? ''}
                            onChange={(e) => editarSku(r.sku, { piezas: Number(e.target.value) || 0 })}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 62, padding: '4px 8px', textAlign: 'right', fontSize: 11, fontFamily: 'inherit', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                        ) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}
                      </td>
                      {/* Precio: chip Apple con popover de listas + custom */}
                      <td style={{ padding: '4px 6px' }}>
                        {sel ? (
                          <PrecioPicker
                            r={r} val={val} theme={theme} isDark={isDark} P={P}
                            onChange={(patch) => editarSku(r.sku, patch)}
                          />
                        ) : (
                          <span style={{ paddingLeft: 8, fontSize: 10, color: theme.textSubtle || theme.textMuted }}>Marcar para editar</span>
                        )}
                      </td>
                      {/* Total */}
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: sel ? theme.text : (theme.textSubtle || theme.textMuted), fontSize: 12, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>
                        {sel ? formatMXN(totalFila) : '—'}
                      </td>
                      {/* Check */}
                      <td style={{ padding: '4px 4px 4px 4px', textAlign: 'center', paddingRight: 12 }}>
                        <span onClick={() => toggleSku(r.sku)}
                          style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 22, height: 22, borderRadius: 999, cursor: 'pointer',
                            background: sel ? P.accent : 'transparent',
                            border: sel ? `1px solid ${P.accent}` : `1.5px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}`,
                            color: '#FFF', fontSize: 12, fontWeight: 700, lineHeight: 1,
                            transition: 'background 120ms, border-color 120ms',
                          }}>{sel ? '✓' : ''}</span>
                      </td>
                    </tr>
                  );
                })}
                {filtrados.length > 300 && (
                  <tr>
                    <td colSpan={14} style={{ padding: 12, textAlign: 'center', fontSize: 11, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}>
                      Mostrando 300 de {fmtInt(filtrados.length)} · usa el buscador para filtrar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* El footer sticky se movió a la card 'Mi Propuesta' en el sidebar
              — mismos totales, botones y estados de guardado en una sola pieza. */}
        </div>

        {/* Sidebar derecho: Mi Propuesta (arriba) + Ferruteck (abajo) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, minHeight: 0 }}>
          <MiPropuestaCard
            theme={theme} isDark={isDark} P={P}
            cliente={cliente} cliCol={cliCol}
            propuestaLista={propuestaLista}
            totalPropuesta={totalPropuesta} piezasTotal={piezasTotal}
            spiffTotal={spiffTotal} spiffSkusCount={spiffSkusCount} spiffDisponiblesCount={spiffDisponiblesCount}
            onGuardar={handleGuardar} onRevisar={onRevisar}
            savedMsg={savedMsg}
          />
          <Copilot theme={theme} isDark={isDark} P={P} cliente={cliente} contexto={contexto} skus={skus} propuesta={propuesta} onAplicarPaquete={aplicarPaquete} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MI PROPUESTA CARD · header negro + body blanco (estilo S&OP Mi Export)
// ════════════════════════════════════════════════════════════════════
function MiPropuestaCard({ theme, isDark, P, cliente, cliCol, propuestaLista, totalPropuesta, piezasTotal, spiffTotal, spiffSkusCount, spiffDisponiblesCount, onGuardar, onRevisar, savedMsg }) {
  const vacia = propuestaLista.length === 0;
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      overflow: 'hidden', display: 'flex', flexDirection: 'column',
      fontFamily: TYPO.fontText,
    }}>
      {/* Header negro */}
      <div style={{ background: '#000', color: '#F5F5F7', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(245,245,247,0.55)', marginBottom: 6 }}>
          <span>Propuesta · {cliente.label}</span>
          {savedMsg && (
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(48,209,88,0.16)', color: '#30D158', fontSize: 9.5, fontWeight: 700 }}>● {savedMsg}</span>
          )}
          {!savedMsg && (
            <span style={{ padding: '2px 8px', borderRadius: 999, background: 'rgba(48,209,88,0.16)', color: '#30D158', fontSize: 9.5, fontWeight: 700 }}>● Autoguardado</span>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', margin: 0 }}>
            Mi Propuesta
          </h4>
          <span style={{
            background: `${P.accent}44`, color: '#64D2FF',
            padding: '1px 8px', borderRadius: 999,
            fontSize: 11, fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600,
          }}>{propuestaLista.length}</span>
        </div>
      </div>

      {/* Body blanco */}
      <div style={{ padding: '16px 18px', background: theme.surface, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Totales */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 12, borderBottom: `1px solid ${theme.border}` }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textMuted }}>Total propuesta</div>
            <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: vacia ? theme.textMuted : P.green, marginTop: 3, lineHeight: 1 }}>
              {vacia ? '—' : formatMXN(totalPropuesta)}
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textMuted }}>Piezas</div>
            <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, marginTop: 3, lineHeight: 1 }}>
              {fmtInt(piezasTotal)}
            </div>
          </div>
        </div>

        {/* Sección SPIFF si hay */}
        {spiffDisponiblesCount > 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '8px 12px', background: '#FEF9E7', border: '1px solid #FCD34D66', borderRadius: 8,
            fontSize: 11,
          }}>
            <span style={{ color: '#B45309', fontWeight: 600 }}>💰 SPIFF ganado</span>
            <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, color: '#B45309' }}>
              {spiffTotal > 0 ? formatMXN(spiffTotal) : '—'}
              <span style={{ fontSize: 10, fontWeight: 500, color: '#B45309', opacity: 0.7, marginLeft: 5 }}>
                {spiffSkusCount}/{spiffDisponiblesCount}
              </span>
            </span>
          </div>
        )}

        {/* Lista de líneas seleccionadas */}
        {vacia ? (
          <div style={{
            padding: '20px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 11, fontStyle: 'italic',
            border: `1px dashed ${theme.border}`, borderRadius: 8,
          }}>
            Selecciona SKUs de la tabla para armar tu propuesta.
          </div>
        ) : (
          <div style={{ maxHeight: 220, overflow: 'auto', margin: '0 -4px' }}>
            {propuestaLista.slice(0, 20).map((r) => {
              const total = (Number(r.piezas) || 0) * (Number(r.precio) || 0);
              return (
                <div key={r.sku} style={{
                  display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center',
                  padding: '8px 4px', borderBottom: `1px solid ${theme.border}`,
                  fontSize: 10.5,
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: theme.text }}>{r.sku}</div>
                    <div style={{ fontSize: 9.5, color: theme.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.descripcion}
                    </div>
                  </div>
                  <div style={{ color: P.accent, fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, fontSize: 10.5 }}>
                    {fmtInt(r.piezas)} pz
                  </div>
                  <div style={{ color: P.green, fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 700, fontSize: 10.5, minWidth: 60, textAlign: 'right' }}>
                    {formatMXN(total)}
                  </div>
                </div>
              );
            })}
            {propuestaLista.length > 20 && (
              <div style={{ padding: '8px 4px', textAlign: 'center', fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>
                +{propuestaLista.length - 20} más…
              </div>
            )}
          </div>
        )}

        {/* Botones */}
        <div style={{ display: 'flex', gap: 8, paddingTop: 4 }}>
          <button onClick={onRevisar} disabled={vacia}
            style={{
              flex: 1, padding: '11px 14px', border: 0, borderRadius: 10,
              background: vacia ? theme.border : 'linear-gradient(180deg, #30D158, #248A3D)',
              color: '#FFF', fontWeight: 700, fontSize: 12, fontFamily: 'inherit',
              cursor: vacia ? 'not-allowed' : 'pointer',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              opacity: vacia ? 0.5 : 1,
            }}>
            Revisar y exportar <ChevronRight style={{ width: 12, height: 12 }} strokeWidth={2.5} />
          </button>
          <button onClick={onGuardar}
            style={{
              padding: '11px 14px', border: `1px solid ${theme.border}`, borderRadius: 10,
              background: theme.surface, color: theme.text, fontWeight: 600, fontSize: 12, fontFamily: 'inherit',
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}>
            <Save style={{ width: 12, height: 12 }} strokeWidth={2} /> Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// COPILOT · sugerencias inteligentes
// ════════════════════════════════════════════════════════════════════
function Copilot({ theme, isDark, P, cliente, contexto, skus, propuesta, onAplicarPaquete }) {
  const [aplicadas, setAplicadas] = useState(new Set());

  const sugerencias = useMemo(() => {
    if (!skus || skus.length === 0) return [];
    // 1) Top 12 SO 90d con inv comercial
    const topSO = skus
      .filter((r) => (r.sellout90 || 0) > 0 && (r.invActeck || 0) > 100)
      .slice(0, 12);
    const topSOTotal = topSO.reduce((s, r) => {
      const p = Object.values(r.precios || {})[0] || 0;
      return s + (r.promSellout || 1) * p;
    }, 0);

    // 2) Cobertura baja del cliente (invCliente < promSellout · con inv Acteck > 0)
    const covBaja = skus
      .filter((r) => (r.promSellout || 0) > 0 && (r.invCliente || 0) < (r.promSellout || 0) && (r.invActeck || 0) > 0)
      .sort((a, b) => (a.invCliente || 0) - (b.invCliente || 0))
      .slice(0, 10);
    const covBajaTotal = covBaja.reduce((s, r) => {
      const p = Object.values(r.precios || {})[0] || 0;
      const suggPz = Math.max(1, (r.promSellout || 1) * 2 - (r.invCliente || 0));
      return s + suggPz * p;
    }, 0);

    // 3) Skus con múltiples listas de precios — precio más agresivo
    const multiLista = skus
      .filter((r) => Object.keys(r.precios || {}).length > 1 && (r.sellout90 || 0) > 0 && (r.invActeck || 0) > 0)
      .slice(0, 8);
    const multiTotal = multiLista.reduce((s, r) => {
      const listaB = Object.values(r.precios || {}).sort((a, b) => a - b)[0] || 0;
      return s + (r.promSellout || 1) * listaB;
    }, 0);

    return [
      {
        id: 'top-so',
        tag: 'Top movidos',
        tagColor: P.green,
        title: `Top ${topSO.length} SO 90d con inv`,
        desc: 'Los más movidos con stock comercial suficiente para empujar sin agotar CEDIS.',
        skus: topSO.length,
        piezas: topSO.reduce((s, r) => s + (r.promSellout || 1), 0),
        monto: topSOTotal,
        applyIds: topSO.map((r) => r.sku),
      },
      {
        id: 'cov-baja',
        tag: 'Reposición',
        tagColor: P.orange,
        title: 'Cobertura baja del cliente',
        desc: `${covBaja.length} SKUs donde ${cliente.label} tiene menos inventario del que vende. Repón hasta cubrir 60 días.`,
        skus: covBaja.length,
        piezas: covBaja.reduce((s, r) => s + Math.max(1, (r.promSellout || 1) * 2 - (r.invCliente || 0)), 0),
        monto: covBajaTotal,
        applyIds: covBaja.map((r) => r.sku),
      },
      {
        id: 'multi-lista',
        tag: 'Oportunidad',
        tagColor: P.accent,
        title: 'Precio agresivo (múltiples listas)',
        desc: `${multiLista.length} SKUs con varias listas — puedes negociar la más baja para volumen.`,
        skus: multiLista.length,
        piezas: multiLista.reduce((s, r) => s + (r.promSellout || 1), 0),
        monto: multiTotal,
        applyIds: multiLista.map((r) => r.sku),
      },
    ].filter((s) => s.skus > 0);
  }, [skus, cliente.label, P]);

  const aplicar = (sug) => {
    onAplicarPaquete(sug.applyIds);
    setAplicadas((prev) => new Set([...prev, sug.id]));
  };

  const totalAplicables = sugerencias.reduce((s, x) => s + x.skus, 0);

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`,
      borderRadius: 14, overflow: 'hidden',
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      {/* Header — negro consistente con Mi Propuesta */}
      <div style={{
        padding: '14px 16px', background: '#000', color: '#F5F5F7',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: 'linear-gradient(135deg, #FF9F0A 0%, #FF453A 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
            fontSize: 15,
          }} title="Ferruteck">
            🌴
          </div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 14, letterSpacing: '-0.015em', color: '#F5F5F7' }}>
              Ferruteck
            </div>
            <div style={{ fontSize: 10.5, color: 'rgba(245,245,247,0.6)', marginTop: 1 }}>
              {cliente.label} · {sugerencias.length} sugerencia{sugerencias.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: 12, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8, flex: 1 }}>
        {sugerencias.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 11, lineHeight: 1.5 }}>
            Sin sugerencias con los datos actuales. Prueba usar el buscador o desactivar "Solo con inventario".
          </div>
        ) : sugerencias.map((sug) => {
          const applied = aplicadas.has(sug.id);
          return (
            <div key={sug.id} onClick={() => !applied && aplicar(sug)}
              style={{
                background: applied ? `${P.green}0F` : theme.bg,
                border: `1px solid ${applied ? P.green : theme.border}`,
                borderRadius: 12, padding: '12px 14px',
                cursor: applied ? 'default' : 'pointer',
                transition: 'border-color 120ms',
                fontFamily: TYPO.fontText,
              }}
              onMouseEnter={(e) => { if (!applied) e.currentTarget.style.borderColor = P.accent; }}
              onMouseLeave={(e) => { if (!applied) e.currentTarget.style.borderColor = theme.border; }}>
              <span style={{
                display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em',
                background: applied ? `${P.green}22` : `${sug.tagColor}22`,
                color: applied ? P.green : sug.tagColor,
                marginBottom: 6,
              }}>{applied ? 'Aplicada' : sug.tag}</span>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginBottom: 4 }}>
                {sug.title}
              </div>
              <p style={{ fontSize: 11, color: theme.textMuted, margin: '0 0 8px', lineHeight: 1.4 }}>
                {sug.desc}
              </p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', paddingTop: 6, borderTop: `1px dashed ${theme.divider || theme.border}` }}>
                <span>{sug.skus} SKUs · {fmtInt(sug.piezas)}pz</span>
                <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtCompact(sug.monto)}</strong>
              </div>
            </div>
          );
        })}
      </div>

      {/* Input placeholder (todavía no funcional) */}
      <div style={{ padding: 12, borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px',
          background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999,
        }}>
          <Sparkles style={{ width: 12, height: 12, color: P.accent }} strokeWidth={2} />
          <input placeholder="Chat con Ferruteck (próximamente)"
            disabled
            style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 11, color: theme.text, flex: 1, cursor: 'not-allowed', opacity: 0.6 }} />
        </div>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// SortableTh — header ordenable
// ════════════════════════════════════════════════════════════════════
// ────── PrecioPicker: chip Apple con popover de listas + input personalizado ──────
const LISTA_COLORS = {
  'API PROVISIONAL': '#007AFF',
  'DECME PROVISIONAL': '#AF52DE',
  'DICOTECH': '#8B5CF6',
  'Mayoreo A': '#EF4444',
  'Mayoreo AA': '#F59E0B',
  'Mayoreo AAA': '#EC4899',
  'MAYOREO B1': '#14B8A6',
  'Mayoreo PMM': '#0EA5E9',
  'PCEL PROVISIONAL': '#F97316',
};
const LISTA_SHORT = {
  'API PROVISIONAL': 'API',
  'DECME PROVISIONAL': 'DECME',
  'DICOTECH': 'DICO',
  'Mayoreo A': 'MA',
  'Mayoreo AA': 'MAA',
  'Mayoreo AAA': 'MAAA',
  'MAYOREO B1': 'MB1',
  'Mayoreo PMM': 'PMM',
  'PCEL PROVISIONAL': 'PCEL',
};
function listaColor(name) { return LISTA_COLORS[name] || '#6E6E73'; }
function listaShort(name) { return LISTA_SHORT[name] || (name || '').slice(0, 4).toUpperCase(); }

function PrecioPicker({ r, val, theme, isDark, P, onChange }) {
  const [open, setOpen] = React.useState(false);
  const [customEditing, setCustomEditing] = React.useState(false);
  const wrapRef = React.useRef(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const listasKeys = Object.keys(r.precios || {});
  const listaActiva = val.listaSel && listasKeys.includes(val.listaSel) ? val.listaSel : (val.listaSel === '__custom' ? '__custom' : listasKeys[0]);
  const precioActual = Number(val.precio || 0);
  const chipColor = listaActiva === '__custom' ? P.orange : listaColor(listaActiva);
  const chipLabel = listaActiva === '__custom' ? 'CUSTOM' : listaShort(listaActiva);

  const elegir = (k) => {
    if (k === '__custom') {
      onChange({ listaSel: '__custom' });
      setCustomEditing(true);
      setOpen(false);
      return;
    }
    onChange({ listaSel: k, precio: r.precios[k] || 0 });
    setOpen(false);
    setCustomEditing(false);
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        <button onClick={() => setOpen((o) => !o)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            padding: '3px 8px 3px 6px', borderRadius: 6,
            background: isDark ? 'rgba(255,255,255,0.05)' : '#F2F2F7',
            border: `1px solid ${open ? P.accent : 'transparent'}`,
            cursor: 'pointer', fontFamily: 'inherit', color: theme.text,
            transition: 'background 160ms, border-color 160ms',
          }}
          onMouseEnter={(e) => { if (!open) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.09)' : '#DBEAFE'; }}
          onMouseLeave={(e) => { if (!open) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.05)' : '#F2F2F7'; }}>
          <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, fontSize: 11 }}>{formatMXN(precioActual)}</span>
          <span style={{
            fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', padding: '1px 4px', borderRadius: 3,
            background: `${chipColor}22`, color: chipColor,
          }}>{chipLabel}</span>
          <span style={{ fontSize: 9, color: theme.textMuted }}>▾</span>
        </button>
        {listaActiva === '__custom' && customEditing && (
          <input type="number" min="0" step="0.01" value={val.precio ?? ''} autoFocus
            onChange={(e) => onChange({ precio: Number(e.target.value) || 0 })}
            onBlur={() => setCustomEditing(false)}
            style={{ width: 62, padding: '3px 6px', textAlign: 'right', fontSize: 10.5, fontFamily: '"SF Mono", ui-monospace, monospace', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 6, color: theme.text, outline: 'none' }} />
        )}
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', right: 0, zIndex: 40,
          background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10,
          boxShadow: '0 8px 24px rgba(0,0,0,0.14)', padding: 6, minWidth: 220,
          animation: 'fadeInDown 160ms ease',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textMuted, padding: '6px 10px 4px' }}>
            Elige lista para este SKU
          </div>
          {listasKeys.length === 0 && (
            <div style={{ padding: '8px 10px', fontSize: 11, color: theme.textMuted, fontStyle: 'italic' }}>Sin listas de precio para este SKU</div>
          )}
          {listasKeys.map((k) => {
            const active = listaActiva === k;
            return (
              <div key={k} onClick={() => elegir(k)} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11.5,
                background: active ? `${P.accent}18` : 'transparent',
                color: theme.text,
              }}
              onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = theme.bg; }}
              onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: listaColor(k), display: 'inline-block' }} />
                  {k}
                </span>
                <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600 }}>
                  {formatMXN(r.precios[k])} {active && '✓'}
                </span>
              </div>
            );
          })}
          <div onClick={() => elegir('__custom')} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '7px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 11.5,
            background: listaActiva === '__custom' ? `${P.orange}18` : 'transparent',
            color: theme.text, borderTop: `1px dashed ${theme.border}`, marginTop: 4,
          }}
          onMouseEnter={(e) => { if (listaActiva !== '__custom') e.currentTarget.style.background = theme.bg; }}
          onMouseLeave={(e) => { if (listaActiva !== '__custom') e.currentTarget.style.background = 'transparent'; }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 500 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: P.orange, display: 'inline-block' }} />
              Personalizado
            </span>
            <span style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>
              editable
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function SortableTh({ theme, P, orden, onToggle, col, width, children }) {
  const active = orden.col === col;
  const dir = active ? orden.dir : null;
  const color = active ? P.accent : theme.textMuted;
  const arrow = dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕';
  return (
    <th
      onClick={() => onToggle(col)}
      style={{
        position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
        textAlign: 'right', padding: '8px 6px',
        fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase',
        letterSpacing: '0.06em', color,
        borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
        width, cursor: 'pointer', userSelect: 'none',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = theme.text; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = theme.textMuted; }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{ fontSize: 8, opacity: active ? 1 : 0.4, fontWeight: 700 }}>{arrow}</span>
      </span>
    </th>
  );
}

// ════════════════════════════════════════════════════════════════════
// VISTA REVISAR · Hero total + KPIs Fitness + agrupación por familia
// ════════════════════════════════════════════════════════════════════
function VistaRevisar({ theme, isDark, cliente, contexto, skus, propuesta, nombre, setNombre, onBack, onGuardar, onSalir }) {
  const P = paletteFromTheme(theme);
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = theme.textMutedOnDark || 'rgba(255,255,255,0.65)';
  const heroSub = theme.textSubtleOnDark || 'rgba(255,255,255,0.5)';
  const cliCol = clienteColor(theme, cliente.key);

  const propuestaLista = useMemo(() => Object.entries(propuesta)
    .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
    .filter((r) => r.sku), [propuesta, skus]);
  const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
  const precioProm = piezas > 0 ? Math.round(total / piezas) : 0;
  const spiffTotal = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.spiff) || 0), 0);
  const spiffSkus = propuestaLista.filter((r) => (Number(r.spiff) || 0) > 0 && (Number(r.piezas) || 0) > 0).length;

  const grupos = useMemo(() => {
    if (cliente.key !== 'digitalife') return { 'Propuesta': propuestaLista };
    const g = { 'Monitores': [], 'Sillas': [], 'Todo lo demás': [] };
    for (const r of propuestaLista) g[familiaHoja(r.familia)].push(r);
    return g;
  }, [propuestaLista, cliente]);

  const gap = contexto?.gap || 0;
  const cierraGapPct = gap > 0 ? Math.round((total / gap) * 100) : null;

  // ═════ Métricas comerciales: descuento vs Mayoreo AAA + margen vs costo ═════
  const metricasComerciales = useMemo(() => {
    let ahorroTotal = 0;
    let sumaDescPond = 0, sumaTotalConComp = 0;
    let sumaMargPond = 0, sumaTotalConCosto = 0;
    let sinCosto = 0, sinComparacion = 0;
    for (const r of propuestaLista) {
      const px = Number(r.precio) || 0;
      const pz = Number(r.piezas) || 0;
      const tot = px * pz;
      const maaa = Number(r.precios?.['Mayoreo AAA']) || 0;
      const costo = Number(r.costo) || 0;
      if (maaa > 0 && px > 0) {
        const ahorro = (maaa - px) * pz;
        ahorroTotal += ahorro;
        sumaDescPond += ((maaa - px) / maaa) * tot;
        sumaTotalConComp += tot;
      } else if (px > 0) {
        sinComparacion++;
      }
      if (costo > 0 && px > 0) {
        sumaMargPond += ((px - costo) / px) * tot;
        sumaTotalConCosto += tot;
      } else if (px > 0) {
        sinCosto++;
      }
    }
    return {
      ahorroTotal,
      descuentoProm: sumaTotalConComp > 0 ? (sumaDescPond / sumaTotalConComp) * 100 : null,
      margenProm: sumaTotalConCosto > 0 ? (sumaMargPond / sumaTotalConCosto) * 100 : null,
      sinCosto, sinComparacion,
    };
  }, [propuestaLista]);

  // Distribución por familia para la barra visual
  const distribucionFamilia = useMemo(() => {
    const arr = Object.entries(grupos).map(([k, filas]) => ({
      nombre: k,
      total: filas.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0),
    })).filter((g) => g.total > 0);
    const sumaTotal = arr.reduce((s, g) => s + g.total, 0);
    return arr.map((g) => ({ ...g, pct: sumaTotal > 0 ? (g.total / sumaTotal) * 100 : 0 }));
  }, [grupos]);

  const FAMILIA_COLORS = { 'Monitores': P.accent, 'Sillas': P.purple, 'Todo lo demás': P.green, 'Propuesta': P.accent };
  const famColor = (n) => FAMILIA_COLORS[n] || P.accent;

  const [savedMsg, setSavedMsg] = useState(null);
  const handleGuardar = () => {
    onGuardar?.();
    setSavedMsg('✓ Borrador guardado');
    setTimeout(() => setSavedMsg(null), 1800);
  };

  const exportar = async () => {
    if (propuestaLista.length === 0) { alert('La propuesta está vacía.'); return; }
    let XLSX;
    try {
      const mod = await import('xlsx-js-style');
      XLSX = mod.default || mod;
    } catch {
      XLSX = window.XLSX;
      if (!XLSX) { alert('SheetJS no disponible. Recarga la página.'); return; }
    }

    // ─── Estilos: header negro con letra blanca en negritas ───
    const HEADER_STYLE = {
      font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11, name: 'Calibri' },
      fill: { fgColor: { rgb: '000000' }, patternType: 'solid' },
      alignment: { horizontal: 'left', vertical: 'center', wrapText: true },
      border: {
        top:    { style: 'thin', color: { rgb: '000000' } },
        bottom: { style: 'thin', color: { rgb: '000000' } },
        left:   { style: 'thin', color: { rgb: '000000' } },
        right:  { style: 'thin', color: { rgb: '000000' } },
      },
    };
    const CELL_BORDER = {
      top:    { style: 'thin', color: { rgb: 'D9D9D9' } },
      bottom: { style: 'thin', color: { rgb: 'D9D9D9' } },
      left:   { style: 'thin', color: { rgb: 'D9D9D9' } },
      right:  { style: 'thin', color: { rgb: 'D9D9D9' } },
    };
    const CELL_STYLE = {
      font: { sz: 10.5, name: 'Calibri' },
      alignment: { vertical: 'center' },
      border: CELL_BORDER,
    };
    const NUM_STYLE = {
      ...CELL_STYLE,
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '#,##0',
    };
    const MONEY_STYLE = {
      ...CELL_STYLE,
      alignment: { horizontal: 'right', vertical: 'center' },
      numFmt: '"$"#,##0.00',
    };
    const TOTAL_LABEL_STYLE = {
      font: { bold: true, sz: 11, name: 'Calibri' },
      alignment: { horizontal: 'right', vertical: 'center' },
      fill: { fgColor: { rgb: 'F2F2F2' }, patternType: 'solid' },
      border: CELL_BORDER,
    };
    const TOTAL_NUM_STYLE = { ...NUM_STYLE, font: { bold: true, sz: 11, name: 'Calibri' }, fill: { fgColor: { rgb: 'F2F2F2' }, patternType: 'solid' } };
    const TOTAL_MONEY_STYLE = { ...MONEY_STYLE, font: { bold: true, sz: 11, name: 'Calibri' }, fill: { fgColor: { rgb: 'F2F2F2' }, patternType: 'solid' } };

    // ─── Helper: construir una hoja con estilo ───
    // rows es array de { sku, descripcion|desc, marca, familia, piezas, precio }
    const buildSheet = (rowsData, { incluirFamilia = true } = {}) => {
      const headers = incluirFamilia
        ? ['SKU', 'Descripción', 'Marca', 'Familia', 'Piezas', 'Precio unitario', 'Total línea']
        : ['SKU', 'Descripción', 'Marca', 'Piezas', 'Precio unitario', 'Total línea'];

      const dataRows = rowsData.map((r) => {
        const pz = Number(r.piezas) || 0;
        const px = Number(r.precio) || 0;
        return incluirFamilia
          ? [r.sku, r.descripcion || r.desc || '', r.marca || '', r.familia || '', pz, px, pz * px]
          : [r.sku, r.descripcion || r.desc || '', r.marca || '', pz, px, pz * px];
      });

      const sumPz = rowsData.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
      const sumTotal = rowsData.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
      const totalRow = incluirFamilia
        ? ['', '', '', 'TOTAL', sumPz, '', sumTotal]
        : ['', '', 'TOTAL', sumPz, '', sumTotal];

      const ws = XLSX.utils.aoa_to_sheet([headers, ...dataRows, totalRow]);

      // Anchos
      ws['!cols'] = incluirFamilia
        ? [{ wch: 14 }, { wch: 60 }, { wch: 14 }, { wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }]
        : [{ wch: 14 }, { wch: 60 }, { wch: 14 }, { wch: 10 }, { wch: 16 }, { wch: 16 }];
      ws['!rows'] = [{ hpt: 24 }]; // header más alto

      const colCount = headers.length;
      const totalRowIdx = dataRows.length + 1; // 0 = header, 1..n = data, n+1 = total

      // Aplicar estilos celda por celda
      for (let c = 0; c < colCount; c++) {
        // Header
        const hAddr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[hAddr]) ws[hAddr].s = HEADER_STYLE;

        // Data rows
        for (let r = 1; r <= dataRows.length; r++) {
          const addr = XLSX.utils.encode_cell({ r, c });
          if (!ws[addr]) continue;
          const piezasCol = incluirFamilia ? 4 : 3;
          const precioCol = incluirFamilia ? 5 : 4;
          const totalCol  = incluirFamilia ? 6 : 5;
          if (c === piezasCol) ws[addr].s = NUM_STYLE;
          else if (c === precioCol || c === totalCol) ws[addr].s = MONEY_STYLE;
          else ws[addr].s = CELL_STYLE;
        }

        // Total row
        const tAddr = XLSX.utils.encode_cell({ r: totalRowIdx, c });
        if (!ws[tAddr]) {
          ws[tAddr] = { t: 's', v: '' };
        }
        const piezasCol = incluirFamilia ? 4 : 3;
        const totalCol  = incluirFamilia ? 6 : 5;
        if (c === piezasCol) ws[tAddr].s = TOTAL_NUM_STYLE;
        else if (c === totalCol) ws[tAddr].s = TOTAL_MONEY_STYLE;
        else ws[tAddr].s = TOTAL_LABEL_STYLE;
      }

      // Autofiltro y freeze header
      ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: dataRows.length, c: colCount - 1 } }) };
      ws['!freeze'] = { xSplit: 0, ySplit: 1 };

      // Expandir el range para incluir la fila de totales
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: totalRowIdx, c: colCount - 1 } });

      return ws;
    };

    // ─── Hoja Resumen ───
    const now = new Date();
    const mesLbl = MES_FULL[now.getMonth()];
    const anio = now.getFullYear();
    const nombreLimpio = (nombre || 'Cierre').trim();
    const fechaLbl = `${String(now.getDate()).padStart(2, '0')} ${MES_FULL[now.getMonth()]} ${anio}`;

    // Segmentación única de la tabla resumen:
    //   Resumen general · Monitores · Sillas · Todas las categorías (Unificadas)
    // Para clientes ≠ Digitalife, Monitores y Sillas quedan vacíos y solo se
    // muestra la fila de resumen general.
    const monitoresList = cliente.key === 'digitalife'
      ? propuestaLista.filter((r) => familiaHoja(r.familia) === 'Monitores')
      : [];
    const sillasList = cliente.key === 'digitalife'
      ? propuestaLista.filter((r) => familiaHoja(r.familia) === 'Sillas')
      : [];
    const otrasList = cliente.key === 'digitalife'
      ? propuestaLista.filter((r) => familiaHoja(r.familia) === 'Todo lo demás')
      : propuestaLista;
    const agregar = (list) => ({
      skus: list.length,
      piezas: list.reduce((s, r) => s + (Number(r.piezas) || 0), 0),
      total: list.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0),
    });
    const aggGeneral = { skus: propuestaLista.length, piezas, total };
    const aggMonitores = agregar(monitoresList);
    const aggSillas = agregar(sillasList);
    const aggOtras = agregar(otrasList);

    const filasResumen = [['Resumen general', aggGeneral.skus, aggGeneral.piezas, aggGeneral.total]];
    if (cliente.key === 'digitalife') {
      filasResumen.push(
        ['Monitores', aggMonitores.skus, aggMonitores.piezas, aggMonitores.total],
        ['Sillas', aggSillas.skus, aggSillas.piezas, aggSillas.total],
        ['Todas las categorías (Unificadas)', aggOtras.skus, aggOtras.piezas, aggOtras.total],
      );
    }

    const resumenAoa = [
      ['Concepto', 'SKUs', 'Piezas', 'Total'],
      ...filasResumen,
    ];
    const wsResumen = XLSX.utils.aoa_to_sheet(resumenAoa);
    wsResumen['!cols'] = [{ wch: 34 }, { wch: 12 }, { wch: 14 }, { wch: 18 }];
    wsResumen['!rows'] = [{ hpt: 24 }];

    // Estilos: header negro + celdas
    for (let c = 0; c < 4; c++) {
      const h = XLSX.utils.encode_cell({ r: 0, c });
      if (wsResumen[h]) wsResumen[h].s = HEADER_STYLE;
      for (let r = 1; r <= filasResumen.length; r++) {
        const a = XLSX.utils.encode_cell({ r, c });
        if (!wsResumen[a]) continue;
        if (c === 0) wsResumen[a].s = CELL_STYLE;
        else if (c === 3) wsResumen[a].s = MONEY_STYLE;
        else wsResumen[a].s = NUM_STYLE;
      }
    }

    // ─── Construir el workbook ───
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen');

    if (cliente.key === 'digitalife') {
      // 3 hojas: Monitores, Sillas, Otras familias
      const monitores  = propuestaLista.filter((r) => familiaHoja(r.familia) === 'Monitores');
      const sillas     = propuestaLista.filter((r) => familiaHoja(r.familia) === 'Sillas');
      const otras      = propuestaLista.filter((r) => familiaHoja(r.familia) === 'Todo lo demás');
      if (monitores.length > 0) XLSX.utils.book_append_sheet(wb, buildSheet(monitores, { incluirFamilia: false }), 'Monitores');
      if (sillas.length > 0)    XLSX.utils.book_append_sheet(wb, buildSheet(sillas,    { incluirFamilia: false }), 'Sillas');
      if (otras.length > 0)     XLSX.utils.book_append_sheet(wb, buildSheet(otras,     { incluirFamilia: true }),  'Otras familias');
    } else {
      // Otros clientes: una sola hoja "Propuesta"
      XLSX.utils.book_append_sheet(wb, buildSheet(propuestaLista, { incluirFamilia: true }), 'Propuesta');
    }

    const fname = `Propuesta ${cliente.label} ${nombreLimpio} ${mesLbl} ${anio}.xlsx`;
    XLSX.writeFile(wb, fname);
    setSavedMsg('✓ Excel descargado');
    setTimeout(() => setSavedMsg(null), 1800);
  };

  return (
    <div style={{ padding: '10px 6px 40px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      {/* Header sticky */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: `color-mix(in srgb, ${theme.surface} 92%, transparent)`,
        backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${theme.border}`, padding: '12px 20px', marginBottom: 16,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} title="Volver a editar"
            style={{ background: 'transparent', border: 0, padding: 4, color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}>
            <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={2} /> Editar
          </button>
          <div style={{ width: 1, height: 24, background: theme.border }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: cliCol, color: '#FFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em',
            }}>{cliente.iniciales}</div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>Revisar · {cliente.label} ·</span>
                <input
                  type="text"
                  value={nombre || ''}
                  onChange={(e) => setNombre?.(e.target.value)}
                  placeholder="Nombre propuesta"
                  style={{
                    background: 'transparent', border: `1px dashed ${theme.border}`, borderRadius: 6,
                    padding: '2px 8px', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600,
                    letterSpacing: '-0.02em', color: theme.accent, minWidth: 100, maxWidth: 240,
                    outline: 'none',
                  }}
                  onFocus={(e) => e.target.style.borderColor = theme.accent}
                  onBlur={(e) => e.target.style.borderColor = theme.border}
                />
              </div>
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
                Se exportará como <b>Propuesta {cliente.label} {(nombre || 'Cierre').trim()} {MES_FULL[new Date().getMonth()]} {new Date().getFullYear()}.xlsx</b>
              </div>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {savedMsg && (
            <span style={{ fontSize: 12, color: P.green, fontWeight: 600, fontFamily: 'inherit' }}>{savedMsg}</span>
          )}
          <button onClick={handleGuardar}
            style={{ padding: '8px 16px', background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 500, fontFamily: 'inherit', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
            Guardar borrador
          </button>
          {onSalir && (
            <button onClick={onSalir} title="Guarda el borrador y regresa a Propuestas"
              style={{ padding: '8px 16px', background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 500, fontFamily: 'inherit', borderRadius: 999, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <ArrowLeft style={{ width: 12, height: 12 }} strokeWidth={2} />
              Guardar y salir
            </button>
          )}
          <button onClick={exportar}
            style={{ padding: '8px 18px', background: P.accent, border: 0, color: '#FFF', fontWeight: 600, fontFamily: 'inherit', borderRadius: 999, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download style={{ width: 12, height: 12 }} strokeWidth={2} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Hero denso: total + descuento⌀ + margen⌀ + cierra gap */}
        <div style={{
          background: heroBg, color: heroText, borderRadius: 16, padding: '22px 28px',
          display: 'grid', gridTemplateColumns: '1.4fr repeat(3, auto)', gap: 28, alignItems: 'center',
          position: 'relative', overflow: 'hidden',
          border: isDark ? '1px solid rgba(255,255,255,0.06)' : 'none',
        }}>
          {isDark && (
            <div style={{
              position: 'absolute', top: '-30%', right: '-10%', width: '60%', height: '100%',
              background: `radial-gradient(circle, ${P.accent}22 0%, transparent 70%)`, pointerEvents: 'none',
            }} />
          )}
          <div style={{ position: 'relative' }}>
            <p style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: heroSub, fontWeight: 600, margin: 0 }}>
              Revisar propuesta · {cliente.label} · {MES_FULL[new Date().getMonth()]} {new Date().getFullYear()}
            </p>
            <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 40, fontWeight: 600, letterSpacing: '-0.032em', color: heroText, margin: '6px 0 4px', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
              {formatMXN(total)}
            </h2>
            <p style={{ fontSize: 12, color: heroMuted, margin: 0, maxWidth: 520, lineHeight: 1.5 }}>
              <strong style={{ color: heroText, fontWeight: 500 }}>{propuestaLista.length} SKUs · {fmtInt(piezas)} piezas.</strong>
              {' '}
              {metricasComerciales.ahorroTotal > 0 && (
                <><strong style={{ color: P.green, fontWeight: 600 }}>{fmtCompact(metricasComerciales.ahorroTotal)} ahorro</strong> aplicado sobre Mayoreo AAA{metricasComerciales.descuentoProm != null ? ` (${metricasComerciales.descuentoProm.toFixed(1)}%)` : ''}. </>
              )}
              {cierraGapPct != null
                ? <>Cierra el gap del mes en <strong style={{ color: heroText }}>{cierraGapPct}%</strong>.</>
                : <>El gap del mes ya está cerrado.</>}
            </p>
          </div>
          <div style={{ borderLeft: `1px solid rgba(255,255,255,0.08)`, paddingLeft: 24, position: 'relative' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: heroSub }}>Descuento ⌀</div>
            <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: heroText, marginTop: 3 }}>
              {metricasComerciales.descuentoProm != null ? `${metricasComerciales.descuentoProm.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: 10.5, color: heroSub, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
              vs Mayoreo AAA
            </div>
          </div>
          <div style={{ position: 'relative' }}>
            <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: heroSub }}>Margen ⌀</div>
            <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 3, color: metricasComerciales.margenProm != null && metricasComerciales.margenProm >= 25 ? '#30D158' : metricasComerciales.margenProm != null && metricasComerciales.margenProm >= 15 ? '#FF9F0A' : metricasComerciales.margenProm != null ? '#FF453A' : heroText }}>
              {metricasComerciales.margenProm != null ? `${metricasComerciales.margenProm.toFixed(1)}%` : '—'}
            </div>
            <div style={{ fontSize: 10.5, color: heroSub, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
              vs costo{metricasComerciales.sinCosto > 0 ? ` · ${metricasComerciales.sinCosto} sin costo` : ''}
            </div>
          </div>
          {cierraGapPct != null && (
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: heroSub }}>Cierra gap</div>
              <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 3, color: cierraGapPct >= 100 ? '#30D158' : '#FF9F0A' }}>
                ▲ {cierraGapPct}%
              </div>
              <div style={{ fontSize: 10.5, color: heroSub, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                de {fmtCompact(gap)}
              </div>
            </div>
          )}
          {spiffTotal > 0 && (
            <div style={{ position: 'relative' }}>
              <div style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.14em', textTransform: 'uppercase', color: heroSub }}>SPIFF ganado</div>
              <div style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', marginTop: 3, color: '#F5C842' }}>
                {formatMXN(spiffTotal)}
              </div>
              <div style={{ fontSize: 10.5, color: heroSub, marginTop: 2, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                {spiffSkus} SKUs · {contexto?.spiffsMeta ? `hasta ${new Date(contexto.spiffsMeta.vigencia_fin).toLocaleDateString('es-MX')}` : 'Q actual'}
              </div>
            </div>
          )}
        </div>

        {/* Distribución por familia — barra visual */}
        {distribucionFamilia.length > 1 && (
          <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '14px 18px' }}>
            <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 10 }}>
              Distribución del total por familia
            </div>
            <div style={{ display: 'flex', height: 18, borderRadius: 9, overflow: 'hidden', background: theme.bg, marginBottom: 10 }}>
              {distribucionFamilia.map((g) => (
                <div key={g.nombre} style={{ width: `${g.pct}%`, background: famColor(g.nombre), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 600 }}>
                  {g.pct >= 8 ? `${g.pct.toFixed(0)}%` : ''}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11 }}>
              {distribucionFamilia.map((g) => (
                <span key={g.nombre} style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.text }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: famColor(g.nombre) }} />
                  {g.nombre}
                  <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, marginLeft: 4 }}>{fmtCompact(g.total)}</span>
                </span>
              ))}
              {distribucionFamilia.some((g) => g.pct > 60) && (
                <span style={{ marginLeft: 'auto', color: P.orange, fontSize: 10.5, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                  ⚠ {distribucionFamilia.find((g) => g.pct > 60).nombre} concentra {distribucionFamilia.find((g) => g.pct > 60).pct.toFixed(0)}% — considera balancear
                </span>
              )}
            </div>
          </div>
        )}

        {/* Grupos */}
        {Object.entries(grupos).map(([nombreGrupo, filas]) => {
          if (filas.length === 0) return null;
          const totalGrupo = filas.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
          const piezasGrupo = filas.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
          return (
            <div key={nombreGrupo} style={{
              background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, overflow: 'hidden',
            }}>
              <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: `1px solid ${theme.border}` }}>
                <h4 style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
                  {nombreGrupo}
                  <span style={{ color: theme.textMuted, fontFamily: TYPO.fontText, fontWeight: 500, marginLeft: 8, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>
                    · {filas.length} SKUs · {fmtInt(piezasGrupo)}pz
                  </span>
                </h4>
                <span style={{
                  padding: '4px 12px', borderRadius: 999,
                  background: theme.bg, fontFamily: TYPO.fontDisplay, fontWeight: 600,
                  fontSize: 12, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums', color: theme.text,
                }}>{formatMXN(totalGrupo)}</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                  <thead>
                    <tr style={{ background: heroBg }}>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 100 }}>SKU</th>
                      <th style={{ textAlign: 'left', padding: '8px 10px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>Descripción</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 60 }}>Piezas</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 130, background: 'rgba(100,210,255,0.14)' }}>Precio propuesta</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 82, background: 'rgba(100,210,255,0.14)' }}>vs MAAA</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 76, background: 'rgba(100,210,255,0.14)' }}>Descuento</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 76 }}>Margen</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 100 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((r) => {
                      const px = Number(r.precio) || 0;
                      const pz = Number(r.piezas) || 0;
                      const maaa = Number(r.precios?.['Mayoreo AAA']) || 0;
                      const costo = Number(r.costo) || 0;
                      const descuento = (maaa > 0 && px > 0) ? ((maaa - px) / maaa) * 100 : null;
                      const margen = (costo > 0 && px > 0) ? ((px - costo) / px) * 100 : null;
                      const listaSel = r.listaSel && r.listaSel !== '__custom' ? r.listaSel : null;
                      const chipColor = listaSel ? listaColor(listaSel) : P.orange;
                      const chipLabel = listaSel ? listaShort(listaSel) : (r.listaSel === '__custom' ? 'CUSTOM' : '');
                      const margenColor = margen == null ? P.red : margen >= 25 ? P.green : margen >= 15 ? P.orange : P.red;
                      const bgSplit = isDark ? 'rgba(100,210,255,0.05)' : `${P.accent}05`;
                      return (
                        <tr key={r.sku} style={{ borderTop: `1px solid ${theme.border}`, height: 32 }}>
                          <td style={{ padding: '5px 10px', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text }}>{r.sku}</td>
                          <td style={{ padding: '5px 10px', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(pz)}</td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: theme.text, fontSize: 11, fontVariantNumeric: 'tabular-nums', background: bgSplit }}>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                              <strong style={{ fontFamily: '"SF Mono", ui-monospace, monospace' }}>{formatMXN(px)}</strong>
                              {chipLabel && (
                                <span style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.04em', padding: '1px 4px', borderRadius: 3, background: `${chipColor}22`, color: chipColor }}>{chipLabel}</span>
                              )}
                            </span>
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums', background: bgSplit, fontFamily: '"SF Mono", ui-monospace, monospace' }}>
                            {maaa > 0 ? formatMXN(maaa) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 11, fontVariantNumeric: 'tabular-nums', background: bgSplit, fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: descuento == null ? theme.textMuted : descuento > 0 ? P.green : descuento < 0 ? P.red : theme.textMuted }}>
                            {descuento != null ? `${descuento > 0 ? '-' : descuento < 0 ? '+' : ''}${Math.abs(descuento).toFixed(1)}%` : '—'}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontSize: 11 }}>
                            {margen != null ? (
                              <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 7px', borderRadius: 5, fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, background: `${margenColor}18`, color: margenColor }}>
                                {margen.toFixed(0)}%
                              </span>
                            ) : (
                              <span title="Falta cargar costo_promedio en precios_sku para este SKU" style={{ display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 6px', borderRadius: 5, background: `${P.red}18`, color: P.red, fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                                ⚠ sin costo
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{formatMXN(pz * px)}</td>
                        </tr>
                      );
                    })}
                    <tr style={{ background: theme.bg, borderTop: `2px solid ${theme.borderStrong || theme.border}` }}>
                      <td colSpan={2} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.textMuted, letterSpacing: '-0.01em' }}>
                        Total {nombreGrupo.toLowerCase()}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtInt(piezasGrupo)}</td>
                      <td colSpan={4}></td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{formatMXN(totalGrupo)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiFit({ theme, P, icon, iconBg, iconColor, chip, value, valueColor, note }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 4,
      fontFamily: TYPO.fontText,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{
          width: 28, height: 28, borderRadius: 8, background: iconBg, color: iconColor,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 14,
        }}>{icon}</span>
        <span style={{
          fontSize: 9, padding: '2px 7px', borderRadius: 999,
          background: theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
          color: theme.textMuted, fontWeight: 500,
        }}>{chip}</span>
      </div>
      <div style={{
        fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.03em',
        color: valueColor || theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 6, lineHeight: 1,
      }}>{value}</div>
      <div style={{ fontSize: 10, color: theme.textMuted, lineHeight: 1.4, marginTop: 6 }}>{note}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// fetchAll y helpers async — preservados
// ════════════════════════════════════════════════════════════════════
// Paginador genérico (Supabase corta en 1000 filas por defecto).
async function fetchAllPagesLocal(qFactory, pageSize = 1000) {
  const MAX_RETRIES = 6;
  const BACKOFF = [500, 1000, 2000, 4000, 8000, 16000];
  const acc = [];
  let from = 0;
  while (true) {
    let lastErr = null; let data = null;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const res = await qFactory().range(from, from + pageSize - 1);
      if (!res.error) { data = res.data || []; break; }
      lastErr = res.error;
      if (attempt < MAX_RETRIES - 1) {
        console.warn(`[fetchAllPagesLocal] chunk from=${from} attempt ${attempt + 1} falló (retry en ${BACKOFF[attempt]}ms):`, lastErr?.message || lastErr);
        await new Promise((r) => setTimeout(r, BACKOFF[attempt]));
      }
    }
    if (data == null) {
      console.error(`[fetchAllPagesLocal] chunk from=${from} falló tras ${MAX_RETRIES} intentos.`);
      throw new Error(`Paginación falló en chunk ${from}. Refresca la página. Detalle: ${lastErr?.message || 'error desconocido'}`);
    }
    if (data.length === 0) break;
    acc.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  return acc;
}

async function fetchAll(clienteKey) {
  const mm = mesesCerrados();
  const anioMin = Math.min(...mm.map((m) => m.anio));
  const anioMax = Math.max(...mm.map((m) => m.anio));

  // inventario_acteck tiene ~43K filas; sin paginar Supabase corta en 1000 y
  // el Armador pierde almacenes → invActeck queda muy por debajo del real.
  // Sacamos esta query fuera del Promise.all para paginarla.
  const invAckDataP = fetchAllPagesLocal(() =>
    supabase.from('inventario_acteck').select('articulo,disponible,no_almacen'));

  const [roadmapRes, invAckData, invCliRes, preciosRes, costosRes, sellout90, selloutMes, cuotaRes, spiffsRes] = await Promise.all([
    supabase.from('roadmap_sku').select('sku,marca,familia,categoria,descripcion,rdmp'),
    invAckDataP,
    supabase.from('inventario_cliente').select('sku,stock,titulo,anio,semana').eq('cliente', clienteKey),
    // Vista canónica: mismos precios que la pestaña Estrategia de Precios.
    // Trae 1 fila por (sku, lista) con el precio más reciente.
    supabase.from('v_estrategia_precios_lista').select('sku,lista,precio'),
    // Costo lo seguimos leyendo de la tabla base porque la vista no lo trae.
    supabase.from('precios_sku')
      .select('sku,costo_promedio,anio,mes')
      .gte('anio', anioMax - 1)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
    fetchSellout(clienteKey, mm, anioMin, anioMax),
    fetchSelloutMesActual(clienteKey),
    supabase.from('cuotas_mensuales')
      .select('cuota_min,cuota_meta')
      .eq('cliente', clienteKey)
      .eq('anio', MES_ACTUAL.anio).eq('mes', MES_ACTUAL.mes),
    fetchSpiffsActivos(),
  ]);

  const ALMACENES_COMERCIALES = new Set([1, 2, 3, 6, 9, 12, 14, 15, 16, 17, 19, 25, 44, 64, 71]);
  const invAck = new Map();
  for (const r of invAckData || []) {
    if (!ALMACENES_COMERCIALES.has(Number(r.no_almacen))) continue;
    invAck.set(r.articulo, (invAck.get(r.articulo) || 0) + (Number(r.disponible) || 0));
  }
  for (const [k, v] of invAck.entries()) invAck.set(k, Math.round(v));

  const invCli = new Map();
  const invCliTitulos = new Map();
  for (const r of invCliRes.data || []) {
    const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
    const prev = invCli.get(r.sku);
    if (!prev || prev.key < key) {
      invCli.set(r.sku, { key, stock: Number(r.stock) || 0 });
      if (r.titulo) invCliTitulos.set(r.sku, r.titulo);
    }
  }
  const preciosPorSku = new Map();
  // v_estrategia_precios_lista ya trae 1 fila por (sku, lista) con el precio canónico
  for (const r of preciosRes.data || []) {
    if (!preciosPorSku.has(r.sku)) preciosPorSku.set(r.sku, {});
    const lst = preciosPorSku.get(r.sku);
    lst[r.lista] = Number(r.precio) || 0;
  }
  const costoPorSku = new Map();
  // Costo: primer valor no-null encontrado (registros ya vienen ordenados desc por año/mes)
  for (const r of costosRes.data || []) {
    if (!costoPorSku.has(r.sku) && r.costo_promedio) {
      costoPorSku.set(r.sku, Number(r.costo_promedio) || 0);
    }
  }
  // Total 3m y desglose por mes: selloutPorMes.get(sku) = { 'YYYY-MM': cantidad }
  const sellout = new Map();
  const selloutPorMes = new Map();
  for (const r of sellout90) {
    sellout.set(r.sku, (sellout.get(r.sku) || 0) + (Number(r.cantidad) || 0));
    if (r.anio && r.mes) {
      const key = `${r.anio}-${String(r.mes).padStart(2, '0')}`;
      const mesMap = selloutPorMes.get(r.sku) || {};
      mesMap[key] = (mesMap[key] || 0) + (Number(r.cantidad) || 0);
      selloutPorMes.set(r.sku, mesMap);
    }
  }
  // mm ordenado descendente (mes más reciente primero): [Jul, Jun, May] cuando estamos en Ago
  const mesesKeys = mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`);

  const rows = (roadmapRes.data || []).map((r) => {
    const selloutMes = selloutPorMes.get(r.sku) || {};
    const arr = mesesKeys.map((k) => Number(selloutMes[k]) || 0);
    return {
      sku: r.sku,
      marca: r.marca || '',
      familia: r.familia || '',
      categoria: r.categoria || '',
      descripcion: r.descripcion || invCliTitulos.get(r.sku) || '',
      rdmp: r.rdmp || '',
      invActeck: invAck.get(r.sku) || 0,
      invCliente: invCli.get(r.sku)?.stock || 0,
      sellout90: sellout.get(r.sku) || 0,
      promSellout: Math.round((sellout.get(r.sku) || 0) / 3),
      selloutMes: {
        [mesesKeys[0]]: arr[0],
        [mesesKeys[1]]: arr[1],
        [mesesKeys[2]]: arr[2],
      },
      precios: preciosPorSku.get(r.sku) || {},
      costo: costoPorSku.get(r.sku) || 0,
      spiff: spiffsRes?.byKey?.get(r.sku)?.monto || 0,
    };
  });
  rows.sort((a, b) => b.sellout90 - a.sellout90);

  const cuota = (cuotaRes.data || []).reduce((s, r) => s + (Number(r.cuota_min) || Number(r.cuota_meta) || 0), 0);
  const facturado = selloutMes;
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantes = Math.max(0, Math.ceil((finMes - hoy) / 86400000));
  const skusConInv = rows.filter((r) => r.invActeck > 0).length;
  const topVendidos = rows.slice(0, 5).map((r) => ({ sku: r.sku, piezas: r.sellout90 }));

  // ═══ Warnings automáticos: detecta data faltante para avisar al usuario ═══
  const warnings = [];
  const skusConPrecios = rows.filter((r) => Object.keys(r.precios || {}).length > 0).length;
  const pctConPrecios = rows.length > 0 ? (skusConPrecios / rows.length) * 100 : 0;

  if (rows.length === 0) {
    warnings.push({ tipo: 'error', titulo: 'Sin SKUs cargados', msg: 'La tabla roadmap_sku está vacía. Sube el archivo Roadmap.xlsx en /uploads.html.', link: '/uploads.html' });
  } else if (pctConPrecios < 10) {
    warnings.push({ tipo: 'error', titulo: 'Sin precios cargados', msg: `Solo ${skusConPrecios} de ${rows.length} SKUs tienen precios en precios_sku. Sube Actualizaciones ERP en /uploads.html para actualizar las listas.`, link: '/uploads.html' });
  } else if (pctConPrecios < 60) {
    warnings.push({ tipo: 'warn', titulo: 'Precios incompletos', msg: `Solo ${pctConPrecios.toFixed(0)}% de los SKUs tienen lista de precios. Considera re-subir el ERP.`, link: '/uploads.html' });
  }

  const spiffsCount = spiffsRes?.meta?.total || 0;
  // Nota: quité los warnings de cuota/facturado/spiffs — solo dejamos los que
  // bloquean el armado de la propuesta (SKUs vacíos y precios sin cargar).

  return {
    skus: rows,
    contexto: {
      cuota, facturado, gap: Math.max(0, cuota - facturado), diasRestantes,
      skusConInv, topVendidos,
      spiffsMeta: spiffsRes?.meta || null,
      warnings,
      diag: { totalSkus: rows.length, skusConPrecios, spiffsActivos: spiffsCount },
    },
  };
}

async function fetchSelloutMesActual(clienteKey) {
  const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
  if (clienteKey === 'digitalife') {
    const ini = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const finM = new Date(anio, mes, 0);
    const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(finM.getDate()).padStart(2, '0')}`;
    const { data } = await supabase.from('sellout_detalle')
      .select('cantidad,precio')
      .eq('cliente', 'digitalife')
      .gte('fecha', ini).lte('fecha', fin)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.cantidad) || 0) * (Number(r.precio) || 0), 0);
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('importe')
      .eq('mayorista', 'DICOTECH')
      .eq('anio', anio).eq('mes', mes)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.importe) || 0), 0);
  }
  return 0;
}

// Devuelve { sku, cantidad, anio, mes } — desglose por mes para poder mostrar Jul/Jun/May
// individualmente en la tabla de propuesta.
async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const mesesSet = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    const { data } = await supabase.from('sellout_detalle')
      .select('no_parte,cantidad,fecha')
      .eq('cliente', 'digitalife')
      .gte('fecha', `${anioMin}-01-01`).limit(200000);
    return (data || [])
      .filter((r) => mesesSet.has(String(r.fecha).slice(0, 7)))
      .map((r) => {
        const s = String(r.fecha);
        return { sku: r.no_parte, cantidad: r.cantidad, anio: Number(s.slice(0, 4)), mes: Number(s.slice(5, 7)) };
      });
  }
  if (clienteKey === 'pcel') {
    // sellout_pcel trae los últimos 3 meses en columnas vta_mes_1/2/3
    // relativo a la SEMANA. mm[0] = mes anterior, mm[1] = anterior al anterior, mm[2] = 3 atrás.
    const { data } = await supabase.from('sellout_pcel')
      .select('sku,anio,semana,vta_mes_1,vta_mes_2,vta_mes_3')
      .gte('anio', anioMax - 1).limit(50000);
    const byKey = new Map();
    for (const r of data || []) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = byKey.get(r.sku);
      if (!prev || prev.key < key) byKey.set(r.sku, { key, r });
    }
    const out = [];
    for (const { r } of byKey.values()) {
      const cols = [Number(r.vta_mes_1) || 0, Number(r.vta_mes_2) || 0, Number(r.vta_mes_3) || 0];
      mm.forEach((m, i) => {
        if (cols[i] > 0) out.push({ sku: r.sku, cantidad: cols[i], anio: m.anio, mes: m.mes });
      });
    }
    return out;
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin).limit(200000);
    return (data || [])
      .filter((r) => mesesSet.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad, anio: Number(r.anio), mes: Number(r.mes) }));
  }
  return [];
}

// ═══ Fetch de SPIFFs activos hoy ═══
async function fetchSpiffsActivos() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('spiffs')
    .select('sku,monto,vigencia_inicio,vigencia_fin,descripcion,fuente')
    .lte('vigencia_inicio', hoy).gte('vigencia_fin', hoy);
  if (error) return { list: [], byKey: new Map(), meta: null };
  const byKey = new Map();
  for (const r of data || []) byKey.set(r.sku, r);
  const meta = data && data.length > 0
    ? {
        total: data.length,
        potencial: data.reduce((s, r) => s + Number(r.monto || 0), 0), // suma monto/pz — no potencial real
        vigencia_inicio: data[0].vigencia_inicio,
        vigencia_fin: data[0].vigencia_fin,
        fuente: data[0].fuente,
      }
    : null;
  return { list: data || [], byKey, meta };
}

// ════════════════════════════════════════════════════════════════════
// MODAL · Cargar / Actualizar SPIFFs
// ════════════════════════════════════════════════════════════════════
// ════════════════════════════════════════════════════════════════════
// PANEL · Gestión editable de SPIFFs (tabla con CRUD)
// ════════════════════════════════════════════════════════════════════
function SpiffPanel({ theme, isDark, onClose, onSaved }) {
  const [rows, setRows] = React.useState([]);          // filas actuales (incluye editadas)
  const [originalIds, setOriginalIds] = React.useState(new Set()); // ids que venían del server (para saber qué borrar)
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [busqueda, setBusqueda] = React.useState('');

  React.useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.from('spiffs')
          .select('id,sku,descripcion,monto,vigencia_inicio,vigencia_fin,fuente')
          .order('sku');
        if (error) throw error;
        setRows((data || []).map((r) => ({ ...r, _dirty: false, _new: false })));
        setOriginalIds(new Set((data || []).map((r) => r.id)));
      } catch (e) {
        setError(e.message);
      } finally { setLoading(false); }
    })();
  }, []);

  const filtradas = React.useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => (r.sku || '').toLowerCase().includes(q) || (r.descripcion || '').toLowerCase().includes(q));
  }, [rows, busqueda]);

  const editRow = (id, patch) => {
    setRows((prev) => prev.map((r) => (r.id === id || r._tempId === id) ? { ...r, ...patch, _dirty: true } : r));
  };
  const removeRow = (id) => {
    setRows((prev) => prev.filter((r) => (r.id || r._tempId) !== id));
  };
  const addRow = () => {
    const tempId = `_tmp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    // Copia la vigencia de la primera fila si existe
    const ref = rows[0] || {};
    setRows((prev) => [{
      _tempId: tempId, id: null, _new: true, _dirty: true,
      sku: '', descripcion: '', monto: 0,
      vigencia_inicio: ref.vigencia_inicio || '',
      vigencia_fin: ref.vigencia_fin || '',
    }, ...prev]);
  };

  const guardar = async () => {
    setSaving(true); setError(null); setMsg(null);
    try {
      // Valida: sku + monto > 0 + fechas válidas
      const invalidas = rows.filter((r) => !r.sku?.trim() || !(Number(r.monto) > 0) || !r.vigencia_inicio || !r.vigencia_fin);
      if (invalidas.length > 0) {
        throw new Error(`${invalidas.length} filas incompletas (falta SKU, monto o fecha)`);
      }
      // Determina qué borrar (originales que ya no están)
      const currentIds = new Set(rows.filter((r) => r.id).map((r) => r.id));
      const toDelete = Array.from(originalIds).filter((id) => !currentIds.has(id));

      if (toDelete.length > 0) {
        const { error: delErr } = await supabase.from('spiffs').delete().in('id', toDelete);
        if (delErr) throw delErr;
      }
      // Upsert (por sku que es unique key)
      const payload = rows.map((r) => ({
        sku: r.sku.trim(),
        descripcion: r.descripcion || null,
        monto: Number(r.monto),
        vigencia_inicio: r.vigencia_inicio,
        vigencia_fin: r.vigencia_fin,
        situacion: 'Spiff',
        fuente: r.fuente || 'edición manual',
      }));
      const { error: upErr } = await supabase.from('spiffs').upsert(payload, { onConflict: 'sku' });
      if (upErr) throw upErr;

      setMsg(`✓ Guardado · ${payload.length} SPIFFs${toDelete.length > 0 ? ` (${toDelete.length} eliminadas)` : ''}`);
      onSaved?.();
      setTimeout(() => { onClose?.(); }, 900);
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const dirty = rows.some((r) => r._dirty) || rows.length !== originalIds.size;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      fontFamily: TYPO.fontText, animation: 'sopFadeIn 180ms ease', padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: theme.surface, borderRadius: 16, width: '100%', maxWidth: 900,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 22px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #F59E0B, #F5C842)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>💰</div>
          <div>
            <h3 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text }}>
              Gestionar SPIFFs
            </h3>
            <div style={{ fontSize: 11, color: theme.textMuted }}>
              {loading ? 'Cargando…' : `${rows.length} SKUs${dirty ? ' · cambios sin guardar' : ''}`}
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 30, fontSize: 11 }}>
              <Search style={{ width: 12, height: 12, color: theme.textMuted }} strokeWidth={2.2} />
              <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar SKU o descripción"
                style={{ border: 0, outline: 0, background: 'transparent', fontSize: 11, color: theme.text, width: 180, fontFamily: 'inherit' }} />
            </div>
            <button onClick={addRow}
              style={{ padding: '6px 12px', borderRadius: 999, border: 0, background: `${P_ACCENT}18`, color: P_ACCENT, fontSize: 11, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
              ＋ Agregar SKU
            </button>
            <button onClick={onClose}
              style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, fontSize: 18, padding: 4 }}>✕</button>
          </div>
        </div>

        {/* Tabla */}
        <div style={{ flex: 1, overflow: 'auto', padding: '4px 22px' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: theme.textMuted }}>Cargando SPIFFs…</div>
          ) : filtradas.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', fontSize: 12, color: theme.textMuted }}>
              {rows.length === 0 ? 'Sin SPIFFs. Sube un Excel o agrega SKUs manualmente.' : 'Sin resultados con la búsqueda actual.'}
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11.5 }}>
              <thead>
                <tr>
                  {['SKU', 'Descripción', 'Monto/pz', 'Vig. inicio', 'Vig. fin', ''].map((h, i) => (
                    <th key={i} style={{
                      position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
                      textAlign: i === 2 ? 'right' : 'left', padding: '10px 8px',
                      fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase',
                      color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtradas.map((r) => {
                  const rid = r.id || r._tempId;
                  const inputStyle = {
                    width: '100%', padding: '5px 8px', fontSize: 11, fontFamily: 'inherit',
                    background: r._new ? `${P_ACCENT}0A` : theme.bg,
                    border: `1px solid ${r._dirty ? P_ACCENT + '55' : theme.border}`, borderRadius: 6,
                    color: theme.text, outline: 'none',
                  };
                  return (
                    <tr key={rid} style={{ borderTop: `1px solid ${theme.border}` }}>
                      <td style={{ padding: '6px 8px', width: 110 }}>
                        <input value={r.sku || ''} onChange={(e) => editRow(rid, { sku: e.target.value.toUpperCase() })}
                          placeholder="AC-XXXXXX"
                          style={{ ...inputStyle, fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '6px 8px' }}>
                        <input value={r.descripcion || ''} onChange={(e) => editRow(rid, { descripcion: e.target.value })}
                          placeholder="Descripción opcional"
                          style={inputStyle} />
                      </td>
                      <td style={{ padding: '6px 8px', width: 90 }}>
                        <input type="number" min="0" step="0.5" value={r.monto ?? ''}
                          onChange={(e) => editRow(rid, { monto: Number(e.target.value) || 0 })}
                          style={{ ...inputStyle, textAlign: 'right', fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 600, color: (Number(r.monto) > 0) ? '#B45309' : theme.textMuted }} />
                      </td>
                      <td style={{ padding: '6px 8px', width: 140 }}>
                        <input type="date" value={r.vigencia_inicio || ''}
                          onChange={(e) => editRow(rid, { vigencia_inicio: e.target.value })}
                          style={inputStyle} />
                      </td>
                      <td style={{ padding: '6px 8px', width: 140 }}>
                        <input type="date" value={r.vigencia_fin || ''}
                          onChange={(e) => editRow(rid, { vigencia_fin: e.target.value })}
                          style={inputStyle} />
                      </td>
                      <td style={{ padding: '6px 8px', width: 40, textAlign: 'center' }}>
                        <button onClick={() => removeRow(rid)} title="Eliminar SPIFF"
                          style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, fontSize: 14, padding: 4 }}>🗑</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderTop: `1px solid ${theme.border}`, background: theme.bg }}>
          <div style={{ fontSize: 11, minWidth: 200 }}>
            {error && <span style={{ color: '#B91C1C', fontWeight: 600 }}>⚠ {error}</span>}
            {msg && <span style={{ color: '#166534', fontWeight: 600 }}>{msg}</span>}
            {!error && !msg && dirty && <span style={{ color: theme.textMuted }}>Cambios sin guardar</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 0, background: theme.surface, color: theme.text, fontFamily: 'inherit', border: `1px solid ${theme.border}` }}>
              {dirty ? 'Cancelar' : 'Cerrar'}
            </button>
            <button onClick={guardar} disabled={!dirty || saving}
              style={{
                padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                cursor: dirty && !saving ? 'pointer' : 'not-allowed',
                border: 0, background: dirty && !saving ? 'linear-gradient(135deg, #F59E0B, #F5C842)' : theme.border,
                color: '#fff', fontFamily: 'inherit', opacity: dirty && !saving ? 1 : 0.5,
              }}>
              {saving ? 'Guardando…' : 'Guardar cambios'}
            </button>
          </div>
        </div>
      </div>
      <style>{`@keyframes sopFadeIn { from { opacity:0 } to { opacity:1 } }`}</style>
    </div>
  );
}

// Constante para el color accent — evita colisión con el prop P que existe en otras funciones
const P_ACCENT = '#007AFF';
