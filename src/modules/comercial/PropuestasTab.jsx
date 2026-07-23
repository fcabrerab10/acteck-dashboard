// PropuestasTab.jsx — Armador de propuestas de venta por cliente.
// Flujo: landing (con recientes) → cliente picker → one-page + copilot → revisar.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ClipboardList, Search, ChevronRight, Download, X, Sparkles, ArrowLeft, Save } from 'lucide-react';
import * as XLSX from 'xlsx-js-style';
import { toast } from '../../lib/toast';

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

// ═══ Persistencia local de recientes ═══
// Blindaje multi-capa contra pérdida de datos:
//   · propuestas_recientes_v1        · principal (24 más recientes)
//   · propuestas_recientes_v1_bak    · backup rolling (24 más recientes, se actualiza SOLO si el principal se pudo leer)
//   · propuestas_recientes_v1_last   · último snapshot antes de cada save (rollback de emergencia)
const STORAGE_KEY = 'propuestas_recientes_v1';
const BACKUP_KEY  = 'propuestas_recientes_v1_bak';
const LAST_KEY    = 'propuestas_recientes_v1_last';

function loadRecientes() {
  // Fallback 3 capas: principal → backup → snapshot antes del último save
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        console.log('[Propuestas] cargadas desde principal:', arr.length);
        return arr;
      }
    }
  } catch (e) { console.warn('[Propuestas] fallo lectura principal', e); }
  try {
    const raw = localStorage.getItem(BACKUP_KEY);
    if (raw) {
      const arr = JSON.parse(raw);
      if (Array.isArray(arr) && arr.length > 0) {
        console.warn('[Propuestas] cargando desde BACKUP · principal vacío/corrupto', arr.length);
        return arr;
      }
    }
  } catch {}
  try {
    const raw = localStorage.getItem(LAST_KEY);
    if (raw) {
      const snap = JSON.parse(raw);
      const arr = snap?.data;
      if (Array.isArray(arr) && arr.length > 0) {
        console.warn('[Propuestas] cargando desde SNAPSHOT _last · principal + backup vacíos', arr.length);
        return arr;
      }
    }
  } catch {}
  console.log('[Propuestas] sin propuestas en ninguna capa');
  return [];
}

// Import: restaura propuestas desde un JSON descargado previamente
function importarBackup(json) {
  try {
    let arr = null;
    if (Array.isArray(json)) arr = json;
    else if (json?.recientes && Array.isArray(json.recientes)) arr = json.recientes;
    else if (json?.data && Array.isArray(json.data)) arr = json.data;
    if (!arr || arr.length === 0) return { ok: false, count: 0, msg: 'El JSON no tiene propuestas' };
    // Merge con lo existente por id (import gana en caso de conflicto)
    const existentes = loadRecientes();
    const map = new Map(existentes.map((r) => [r.id, r]));
    arr.forEach((r) => { if (r && r.id) map.set(r.id, r); });
    const merged = Array.from(map.values())
      .filter((r) => r && r.id)
      .sort((a, b) => (b.tstamp || 0) - (a.tstamp || 0))
      .slice(0, 100); // ampliamos límite para permitir historial más largo
    const str = JSON.stringify(merged);
    localStorage.setItem(STORAGE_KEY, str);
    try { localStorage.setItem(BACKUP_KEY, str); } catch {}
    return { ok: true, count: merged.length, added: merged.length - existentes.length };
  } catch (e) {
    console.error('[Propuestas] importarBackup falló', e);
    return { ok: false, count: 0, msg: e?.message || 'error desconocido' };
  }
}

function saveReciente(entry) {
  try {
    const prev = loadRecientes();
    // Snapshot rollback: guarda estado previo antes de sobrescribir
    try {
      localStorage.setItem(LAST_KEY, JSON.stringify({ tstamp: Date.now(), data: prev }));
    } catch {}

    const all = prev.filter((r) => r.id !== entry.id);
    all.unshift(entry);
    const nextStr = JSON.stringify(all.slice(0, 24));
    localStorage.setItem(STORAGE_KEY, nextStr);
    // Backup copy solo si la escritura principal succeed
    try { localStorage.setItem(BACKUP_KEY, nextStr); } catch {}
    return true;
  } catch (e) {
    console.error('[Propuestas] Error guardando en localStorage:', e);
    return false;
  }
}

function removeReciente(id) {
  try {
    const all = loadRecientes().filter((r) => r.id !== id);
    const nextStr = JSON.stringify(all);
    // Snapshot antes de borrar
    try { localStorage.setItem(LAST_KEY, JSON.stringify({ tstamp: Date.now(), data: loadRecientes() })); } catch {}
    localStorage.setItem(STORAGE_KEY, nextStr);
    try { localStorage.setItem(BACKUP_KEY, nextStr); } catch {}
  } catch {}
}

// Export helper: descarga snapshot completo como JSON (rescate de emergencia)
function exportarSnapshot() {
  try {
    const data = { tstamp: new Date().toISOString(), recientes: loadRecientes() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `propuestas_backup_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    return true;
  } catch (e) {
    console.error('[Propuestas] fallo snapshot', e);
    return false;
  }
}
function nuevaPropuestaId() {
  return `prp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

// ════════════════════════════════════════════════════════════════════
// COMPONENTE PRINCIPAL
// ════════════════════════════════════════════════════════════════════
export default function PropuestasTab() {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  // Vistas: 0 = Landing, 1 = Cliente picker, 2 = One-Page, 3 = Revisar
  const [vista, setVista] = useState(0);
  const [clienteKey, setClienteKey] = useState(null);
  const [propuesta, setPropuesta] = useState({});
  const [propuestaId, setPropuestaId] = useState(null);
  const [nombreBorrador, setNombreBorrador] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skus, setSkus] = useState([]);
  const [contexto, setContexto] = useState(null);
  const [recientesTick, setRecientesTick] = useState(0); // fuerza re-render de landing tras guardar
  const lastAutoSaveRef = React.useRef(0);

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
    setNombreBorrador('');
    setSkus([]);
    setContexto(null);
    setError(null);
  };

  const iniciarCliente = (cli) => {
    setPropuesta({});
    setPropuestaId(nuevaPropuestaId());
    setNombreBorrador('');
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
    setNombreBorrador(r.nombre || '');
    setSkus([]);
    setContexto(null);
    setError(null);
    setVista(2);
  };

  // Guarda silencioso (sin toast) — usado por autosave
  const guardarSilencioso = React.useCallback(() => {
    if (!clienteKey) return false;
    let pid = propuestaId;
    if (!pid) { pid = nuevaPropuestaId(); setPropuestaId(pid); }
    try {
      const cli = CLIENTES.find((c) => c.key === clienteKey);
      const propuestaLista = Object.entries(propuesta)
        .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
        .filter((r) => r.sku);
      const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
      const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
      const ok = saveReciente({
        id: pid,
        clienteKey,
        clienteLabel: cli?.label || clienteKey,
        nombre: nombreBorrador,
        estado: 'Borrador',
        tstamp: Date.now(),
        propuesta,
        resumen: { skus: propuestaLista.length, piezas, total },
      });
      if (ok) setRecientesTick((t) => t + 1);
      return ok;
    } catch (e) {
      console.error('[Propuestas] autosave falló', e);
      return false;
    }
  }, [clienteKey, propuestaId, propuesta, skus, nombreBorrador]);

  // Auto-save cada 15 segundos si hay cambios y estamos editando
  useEffect(() => {
    if (vista !== 2 && vista !== 3) return;
    if (!clienteKey) return;
    const interval = setInterval(() => {
      const now = Date.now();
      // Solo si pasaron 15s desde el último autosave
      if (now - lastAutoSaveRef.current > 15000) {
        const propuestaCount = Object.keys(propuesta).length;
        if (propuestaCount === 0 && !nombreBorrador) return; // nada que guardar
        const ok = guardarSilencioso();
        if (ok) lastAutoSaveRef.current = now;
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [vista, clienteKey, propuesta, nombreBorrador, guardarSilencioso]);

  const guardarBorrador = () => {
    // Auto-genera propuestaId si no existe (defensivo: nunca perder trabajo)
    let pid = propuestaId;
    if (!pid) {
      pid = nuevaPropuestaId();
      setPropuestaId(pid);
    }
    if (!clienteKey) {
      toast.error('No se pudo guardar: selecciona un cliente primero');
      return;
    }
    try {
      const cli = CLIENTES.find((c) => c.key === clienteKey);
      const propuestaLista = Object.entries(propuesta)
        .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
        .filter((r) => r.sku);
      const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
      const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
      saveReciente({
        id: pid,
        clienteKey,
        clienteLabel: cli?.label || clienteKey,
        nombre: nombreBorrador,
        estado: 'Borrador',
        tstamp: Date.now(),
        propuesta,
        resumen: { skus: propuestaLista.length, piezas, total },
      });
      setRecientesTick((t) => t + 1);
      toast.success(`Borrador guardado · ${propuestaLista.length} SKUs · ${formatMXN(total)}`);
    } catch (e) {
      console.error('[Propuestas] Error guardando borrador:', e);
      toast.error('Error al guardar borrador: ' + (e?.message || 'desconocido'));
    }
  };

  // ═══ Export Excel real ═══
  const exportarExcel = () => {
    if (!clienteKey) {
      toast.error('Selecciona un cliente para exportar');
      return;
    }
    console.log('[Propuestas] export inicia', { clienteKey, propuestaKeys: Object.keys(propuesta).length, skusLoaded: skus.length, nombreBorrador });
    try {
      const cli = CLIENTES.find((c) => c.key === clienteKey);
      // Blindaje: si skus no está cargado, exportar con lo que tengamos en el
      // objeto propuesta (evita perder trabajo del usuario por fetch tardío)
      const skusIdx = new Map(skus.map((r) => [r.sku, r]));
      // IVA MX 16%
      const IVA = 0.16;
      const propuestaLista = Object.entries(propuesta)
        .map(([sku, val]) => {
          const dataSku = skusIdx.get(sku) || {};
          const precioBase = Number(val.precio) || 0;
          const piezas = Number(val.piezas) || 0;
          const precioIVA = +(precioBase * (1 + IVA)).toFixed(2);
          const total = +(piezas * precioIVA).toFixed(2);
          return {
            sku,
            descripcion: dataSku.descripcion || val.descripcion || '',
            familia:     dataSku.familia     || val.familia     || '',
            piezas, precioBase, precioIVA, total,
          };
        })
        .filter((r) => r.sku && r.piezas > 0);
      if (propuestaLista.length === 0) {
        console.warn('[Propuestas] export sin filas · propuesta state:', propuesta, 'skus loaded:', skus.length);
        toast.error('La propuesta no tiene SKUs con piezas · guarda el borrador antes de exportar');
        return;
      }

      const wb = XLSX.utils.book_new();
      const CURRENCY = '"$"#,##0.00';

      // ═══ Helper para hoja de detalle ═══
      // Columnas: SKU · Descripción · Familia · Piezas · Precio + IVA (money) · Total (money)
      const buildDetalleSheet = (filas, sheetName) => {
        if (!filas || filas.length === 0) return;
        const dataRows = filas.map((r) => ({
          SKU: r.sku,
          'Descripción': r.descripcion,
          Familia: r.familia,
          Piezas: r.piezas,
          'Precio + IVA': r.precioIVA,
          Total: r.total,
        }));
        const totalPiezas = filas.reduce((s, r) => s + r.piezas, 0);
        const totalMonto  = filas.reduce((s, r) => s + r.total, 0);
        dataRows.push({
          SKU: '', 'Descripción': '', Familia: 'TOTAL',
          Piezas: totalPiezas, 'Precio + IVA': '', Total: totalMonto,
        });
        const ws = XLSX.utils.json_to_sheet(dataRows);
        ws['!cols'] = [
          { wch: 16 }, { wch: 44 }, { wch: 18 }, { wch: 10 }, { wch: 16 }, { wch: 18 },
        ];
        const range = XLSX.utils.decode_range(ws['!ref']);
        // Header (fila 0): bold blanco sobre fondo negro
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[addr]) {
            ws[addr].s = {
              font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
              fill: { fgColor: { rgb: '1D1D1F' } },
              alignment: { horizontal: c >= 3 ? 'right' : 'left', vertical: 'center' },
            };
          }
        }
        // Filas de datos + total: formato moneda en columnas E (Precio + IVA) y F (Total)
        for (let R = 1; R <= range.e.r; R++) {
          const isTotal = R === range.e.r;
          ['E', 'F'].forEach((col) => {
            const addr = `${col}${R + 1}`;
            if (ws[addr] && typeof ws[addr].v === 'number') {
              ws[addr].z = CURRENCY;
              ws[addr].s = {
                numFmt: CURRENCY,
                alignment: { horizontal: 'right' },
                font: isTotal ? { bold: true } : undefined,
                fill: isTotal ? { fgColor: { rgb: 'F0F0F0' } } : undefined,
              };
            }
          });
          // Piezas col D — right align
          const addrD = `D${R + 1}`;
          if (ws[addrD]) {
            ws[addrD].s = {
              alignment: { horizontal: 'right' },
              font: isTotal ? { bold: true } : undefined,
              fill: isTotal ? { fgColor: { rgb: 'F0F0F0' } } : undefined,
            };
          }
          if (isTotal) {
            // Bold en columnas A-C también
            ['A', 'B', 'C'].forEach((col) => {
              const addr = `${col}${R + 1}`;
              if (ws[addr]) {
                ws[addr].s = {
                  font: { bold: true },
                  fill: { fgColor: { rgb: 'F0F0F0' } },
                };
              }
            });
          }
        }
        // Sheet name sanitize (Excel máx 31 chars, sin []:*?/\)
        const safeName = String(sheetName).replace(/[[\]:*?/\\]/g, '').slice(0, 31);
        XLSX.utils.book_append_sheet(wb, ws, safeName);
      };

      // ═══ Hoja Resumen ═══
      const buildResumen = (bloques) => {
        // bloques = [{ nombre, skus, piezas, total }]
        const rows = bloques.map((b) => ({
          'Nombre de la propuesta': b.nombre,
          'Cantidad de SKUs': b.skus,
          'Piezas totales': b.piezas,
          'Monto total': b.total,
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        ws['!cols'] = [{ wch: 40 }, { wch: 18 }, { wch: 16 }, { wch: 20 }];
        const range = XLSX.utils.decode_range(ws['!ref']);
        // Header
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: 0, c });
          if (ws[addr]) {
            ws[addr].s = {
              font: { bold: true, color: { rgb: 'FFFFFF' }, name: 'Calibri', sz: 11 },
              fill: { fgColor: { rgb: '1D1D1F' } },
              alignment: { horizontal: c >= 1 ? 'right' : 'left', vertical: 'center' },
            };
          }
        }
        // Monto total col D como currency
        for (let R = 1; R <= range.e.r; R++) {
          const addr = `D${R + 1}`;
          if (ws[addr] && typeof ws[addr].v === 'number') {
            ws[addr].z = CURRENCY;
            ws[addr].s = { numFmt: CURRENCY, alignment: { horizontal: 'right' } };
          }
          // Right align números
          ['B', 'C'].forEach((col) => {
            const a = `${col}${R + 1}`;
            if (ws[a]) ws[a].s = { alignment: { horizontal: 'right' } };
          });
        }
        // Fila TOTAL general (última) en gris + bold
        if (bloques.length > 1) {
          const totalRow = range.e.r + 1;
          const totalSKUs   = bloques.reduce((s, b) => s + b.skus, 0);
          const totalPiezas = bloques.reduce((s, b) => s + b.piezas, 0);
          const totalMonto  = bloques.reduce((s, b) => s + b.total, 0);
          ws[`A${totalRow + 1}`] = { t: 's', v: 'TOTAL GENERAL' };
          ws[`B${totalRow + 1}`] = { t: 'n', v: totalSKUs };
          ws[`C${totalRow + 1}`] = { t: 'n', v: totalPiezas };
          ws[`D${totalRow + 1}`] = { t: 'n', v: totalMonto, z: CURRENCY };
          ['A', 'B', 'C', 'D'].forEach((col) => {
            const a = `${col}${totalRow + 1}`;
            ws[a].s = {
              font: { bold: true },
              fill: { fgColor: { rgb: 'D0D0D0' } },
              alignment: col === 'A' ? { horizontal: 'left' } : { horizontal: 'right' },
              numFmt: col === 'D' ? CURRENCY : undefined,
            };
          });
          ws['!ref'] = XLSX.utils.encode_range({ s: { c: 0, r: 0 }, e: { c: 3, r: totalRow } });
        }
        XLSX.utils.book_append_sheet(wb, ws, 'Resumen');
      };

      const nombrePropuesta = (nombreBorrador || '').trim() || `Propuesta ${cli?.label || clienteKey}`;

      // Construcción según cliente
      if (clienteKey === 'digitalife') {
        // Digitalife: 3 hojas de familia + Resumen
        const grupos = { 'Monitores': [], 'Sillas': [], 'Todo lo demás': [] };
        for (const r of propuestaLista) grupos[familiaHoja(r.familia)].push(r);
        // Resumen con un renglón por hoja
        const bloques = Object.entries(grupos).filter(([, filas]) => filas.length > 0).map(([nombre, filas]) => ({
          nombre: `${nombrePropuesta} · ${nombre}`,
          skus: filas.length,
          piezas: filas.reduce((s, r) => s + r.piezas, 0),
          total: filas.reduce((s, r) => s + r.total, 0),
        }));
        buildResumen(bloques);
        Object.entries(grupos).forEach(([nombre, filas]) => {
          if (filas.length > 0) buildDetalleSheet(filas, nombre);
        });
      } else {
        // Otros clientes: 1 hoja Resumen + 1 hoja Propuesta
        buildResumen([{
          nombre: nombrePropuesta,
          skus: propuestaLista.length,
          piezas: propuestaLista.reduce((s, r) => s + r.piezas, 0),
          total: propuestaLista.reduce((s, r) => s + r.total, 0),
        }]);
        buildDetalleSheet(propuestaLista, 'Propuesta');
      }

      // Filename: Propuesta (Cliente) (Nombre del Borrador) (Mes) (Año)
      const MESES_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
      const now = new Date();
      const mesEs = MESES_ES[now.getMonth()];
      const anioNum = now.getFullYear();
      const clienteSafe = (cli?.label || clienteKey).replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ-]/g, '').trim();
      const nombreSafe = (nombreBorrador || '').replace(/[^\w\sáéíóúüñÁÉÍÓÚÜÑ-]/g, '').trim();
      const partes = ['Propuesta', clienteSafe];
      if (nombreSafe) partes.push(nombreSafe);
      partes.push(mesEs, String(anioNum));
      const filename = partes.join(' ') + '.xlsx';
      XLSX.writeFile(wb, filename);
      const totalGlobal = propuestaLista.reduce((s, r) => s + r.total, 0);
      toast.success(`Excel exportado · ${propuestaLista.length} SKUs · ${formatMXN(totalGlobal)}`);
    } catch (e) {
      console.error('[Propuestas] Error exportando Excel:', e);
      toast.error('Error al exportar: ' + (e?.message || 'desconocido'));
    }
  };

  const cliente = CLIENTES.find((c) => c.key === clienteKey);
  const P = paletteFromTheme(theme);

  // ── Landing ──
  if (vista === 0) {
    return <Landing theme={theme} isDark={isDark} onIniciar={() => setVista(1)} onAbrirReciente={abrirReciente} tick={recientesTick} />;
  }

  // ── Cliente picker ──
  if (vista === 1) {
    return <VistaClientePicker theme={theme} isDark={isDark} onElegir={iniciarCliente} onBack={reiniciar} />;
  }

  // ── Loading / error ──
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 12, fontFamily: TYPO.fontText }}>
        Cargando data de {cliente?.label}…
      </div>
    );
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
      nombreBorrador={nombreBorrador} onChangeNombre={setNombreBorrador}
      onBack={() => setVista(2)}
      onGuardar={guardarBorrador}
      onExportar={exportarExcel}
    />;
  }

  return null;
}

// ════════════════════════════════════════════════════════════════════
// LANDING · Header + Hero + Recientes
// ════════════════════════════════════════════════════════════════════
function Landing({ theme, isDark, onIniciar, onAbrirReciente, tick }) {
  const P = paletteFromTheme(theme);
  const heroBg = theme.heroCardBg || (isDark ? '#0F0F0F' : '#1D1D1F');
  const heroText = theme.heroCardText || '#F5F5F7';
  const heroMuted = theme.textMutedOnDark || 'rgba(255,255,255,0.65)';
  const heroSub = theme.textSubtleOnDark || 'rgba(255,255,255,0.5)';
  const [recientes, setRecientes] = useState(() => loadRecientes());
  useEffect(() => { setRecientes(loadRecientes()); }, [tick]);

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
      <div style={{ padding: '0 4px', marginBottom: 12, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
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
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          <label
            title="Sube un JSON de backup para restaurar propuestas"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 999,
              background: theme.surface, border: `1px solid ${theme.border}`,
              color: theme.textMuted, fontSize: 11, fontFamily: TYPO.fontText, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            ↑ Importar backup
            <input type="file" accept="application/json,.json" style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = (ev) => {
                  try {
                    const json = JSON.parse(String(ev.target?.result || 'null'));
                    const res = importarBackup(json);
                    if (res.ok) {
                      setRecientes(loadRecientes());
                      toast.success(`Backup importado · ${res.count} propuestas en total${res.added > 0 ? ` (+${res.added} nuevas)` : ''}`);
                    } else {
                      toast.error(res.msg || 'No se pudo importar');
                    }
                  } catch (err) {
                    toast.error('JSON inválido: ' + (err?.message || 'error'));
                  }
                  e.target.value = ''; // permite re-subir el mismo archivo
                };
                reader.readAsText(file);
              }}
            />
          </label>
          <button
            onClick={() => {
              const ok = exportarSnapshot();
              if (ok) toast.success(`Snapshot descargado · ${recientes.length} borradores respaldados`);
              else toast.error('No se pudo descargar el snapshot');
            }}
            title="Descarga un JSON con TODOS tus borradores (rescate manual)"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 12px', borderRadius: 999,
              background: theme.surface, border: `1px solid ${theme.border}`,
              color: theme.textMuted, fontSize: 11, fontFamily: TYPO.fontText, fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Download style={{ width: 12, height: 12 }} strokeWidth={2} />
            Backup JSON
          </button>
        </div>
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
            El mes cierra pronto. Arma una propuesta con las recomendaciones del Copilot y déjala lista antes del corte.
          </p>
        </div>
        <button onClick={onIniciar}
          style={{ padding: '11px 22px', background: P.accent, color: '#FFFFFF', border: 0, borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em', position: 'relative' }}>
          + Nueva propuesta
        </button>
      </div>

      {/* Recientes */}
      <div style={{ padding: '0 4px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
          <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>
            Propuestas recientes
          </h3>
          <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
            {recientes.length === 0 ? 'sin propuestas aún' : `${recientes.length} guardada${recientes.length === 1 ? '' : 's'}`}
          </span>
        </div>
        {(() => {
          // Split: últimos 30 días = "Recientes", más viejas = "Anteriores"
          const CUTOFF = 30 * 86400 * 1000;
          const now = Date.now();
          const rec = recientes.filter((r) => now - (r.tstamp || 0) <= CUTOFF);
          const ant = recientes.filter((r) => now - (r.tstamp || 0) > CUTOFF);

          if (recientes.length === 0) {
            return (
              <div style={{
                background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 14,
                padding: 32, textAlign: 'center', color: theme.textMuted, fontSize: 12,
              }}>
                Al guardar borradores aparecerán aquí para volver a abrirlos con un click.
              </div>
            );
          }

          return (
            <>
              {/* Recientes (últimos 30 días) */}
              {rec.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, marginBottom: ant.length > 0 ? 20 : 0 }}>
                  {rec.map((r) => (
                    <PropuestaCard key={r.id} r={r} theme={theme} timeAgo={timeAgo} estadoPill={estadoPill} onAbrirReciente={onAbrirReciente} />
                  ))}
                </div>
              )}
              {/* Anteriores (más de 30 días) */}
              {ant.length > 0 && (
                <div style={{ marginTop: rec.length > 0 ? 4 : 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10 }}>
                    <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, margin: 0 }}>
                      Propuestas anteriores
                    </h3>
                    <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                      {ant.length} · más de 30 días
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10, opacity: 0.85 }}>
                    {ant.map((r) => (
                      <PropuestaCard key={r.id} r={r} theme={theme} timeAgo={timeAgo} estadoPill={estadoPill} onAbrirReciente={onAbrirReciente} historico />
                    ))}
                  </div>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}

function PropuestaCard({ r, theme, timeAgo, estadoPill, onAbrirReciente, historico }) {
  const cli = CLIENTES.find((c) => c.key === r.clienteKey);
  const col = clienteColor(theme, r.clienteKey);
  const pill = estadoPill(r.estado);
  return (
    <div onClick={() => onAbrirReciente(r)}
      style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
        padding: '14px 16px', cursor: 'pointer', transition: 'transform 120ms, border-color 120ms',
        fontFamily: TYPO.fontText,
      }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.borderColor = col; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.borderColor = theme.border; }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
        <div style={{
          width: 28, height: 28, borderRadius: 8, background: col, color: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, letterSpacing: '-0.02em',
        }}>{cli?.iniciales || '?'}</div>
        <span style={{ padding: '2px 8px', borderRadius: 999, fontSize: 9, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', background: pill.bg, color: pill.color }}>{r.estado || 'Borrador'}</span>
      </div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>
        {r.nombre ? r.nombre : `Propuesta ${cli?.label || r.clienteLabel}`}
      </div>
      <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2, fontVariantNumeric: 'tabular-nums' }}>
        {r.nombre ? `${cli?.label || r.clienteLabel} · ${timeAgo(r.tstamp)}` : timeAgo(r.tstamp)}
      </div>
      <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px dashed ${theme.border}`, display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>
          {r.resumen?.skus || 0} SKUs · {fmtInt(r.resumen?.piezas || 0)}pz
        </span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.015em', fontSize: 15, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>
          {fmtCompact(r.resumen?.total || 0)}
        </span>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// VISTA CLIENTE PICKER
// ════════════════════════════════════════════════════════════════════
function VistaClientePicker({ theme, isDark, onElegir, onBack }) {
  const [kpis, setKpis] = useState({}); // { clienteKey: { cuota, facturado, gap } }

  useEffect(() => {
    (async () => {
      const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
      const [cuotas, ventas] = await Promise.all([
        supabase.from('cuotas_mensuales').select('cliente,cuota_min,cuota_meta').eq('anio', anio).eq('mes', mes),
        supabase.from('v_ventas_mensuales_agg').select('cliente,sell_in').eq('anio', anio).eq('mes', mes),
      ]);
      const out = {};
      (cuotas.data || []).forEach((r) => {
        if (!out[r.cliente]) out[r.cliente] = { cuota: 0, facturado: 0 };
        out[r.cliente].cuota += Number(r.cuota_min || r.cuota_meta || 0);
      });
      (ventas.data || []).forEach((r) => {
        if (!out[r.cliente]) out[r.cliente] = { cuota: 0, facturado: 0 };
        out[r.cliente].facturado += Number(r.sell_in || 0);
      });
      Object.values(out).forEach((v) => { v.gap = Math.max(0, v.cuota - v.facturado); });
      setKpis(out);
    })();
  }, []);

  const P = paletteFromTheme(theme);

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

      <div style={{ padding: '20px 20px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
        <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', color: theme.text, margin: '4px 0 6px' }}>
          ¿Para qué cliente?
        </h3>
        <p style={{ fontSize: 13, color: theme.textMuted, marginBottom: 28, maxWidth: 420, lineHeight: 1.5 }}>
          Elige el cliente y arma la propuesta con el Copilot en la siguiente pantalla.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, maxWidth: 780, width: '100%' }}>
          {CLIENTES.map((c) => {
            const col = clienteColor(theme, c.key);
            const k = kpis[c.key];
            const gap = k?.gap ?? 0;
            const gapCol = gap > 300000 ? P.red : gap > 100000 ? P.orange : P.green;
            return (
              <button key={c.key} onClick={() => onElegir(c.key)}
                style={{
                  padding: 22, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16,
                  cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                  transition: 'transform 120ms, border-color 120ms, background 120ms',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.borderColor = col;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.borderColor = theme.border;
                }}>
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: col, color: '#FFFFFF',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 16, letterSpacing: '-0.02em', marginBottom: 12,
                }}>{c.iniciales}</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{c.label}</div>
                <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 3 }}>{c.marca}</div>
                {k && (
                  <div style={{
                    marginTop: 14, paddingTop: 12, borderTop: `1px dashed ${theme.border}`,
                    display: 'flex', justifyContent: 'space-between', fontSize: 10, color: theme.textMuted,
                    fontVariantNumeric: 'tabular-nums',
                  }}>
                    <span>Cuota <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtCompact(k.cuota)}</strong></span>
                    <span>Gap <strong style={{ color: gapCol, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{fmtCompact(k.gap)}</strong></span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
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

  const familias = useMemo(() => {
    const s = new Set();
    for (const r of skus) if (r.familia) s.add(r.familia);
    return ['todas', ...Array.from(s).sort()];
  }, [skus]);

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
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header sticky */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 20,
        background: `color-mix(in srgb, ${theme.surface} 92%, transparent)`,
        backdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: `1px solid ${theme.border}`,
        padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={onBack} title="Volver"
            style={{ background: 'transparent', border: 0, padding: 4, color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontFamily: 'inherit' }}>
            <ArrowLeft style={{ width: 14, height: 14 }} strokeWidth={2} /> Propuestas
          </button>
          <div style={{ width: 1, height: 24, background: theme.border, margin: '0 4px' }} />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 10, background: cliCol, color: '#FFF',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em',
            }}>{cliente.iniciales}</div>
            <div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>
                Propuesta · {cliente.label}
              </div>
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
                {MES_LABEL[MES_ACTUAL.mes - 1]} {MES_ACTUAL.anio} · borrador
              </div>
            </div>
          </div>
        </div>
        {contexto && (
          <div style={{ display: 'flex', gap: 22, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Cuota</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtCompact(contexto.cuota)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Facturado · {cuotaPct}%</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtCompact(contexto.facturado)}</div>
              <div style={{ height: 5, background: theme.divider || theme.border, borderRadius: 999, overflow: 'hidden', marginTop: 4, width: 160 }}>
                <div style={{ height: '100%', width: `${cuotaPct}%`, background: P.accent, borderRadius: 999 }} />
              </div>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Gap</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: contexto.gap > 0 ? P.orange : P.green, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{fmtCompact(contexto.gap)}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Días</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 1 }}>{contexto.diasRestantes}d</div>
            </div>
          </div>
        )}
      </div>

      {/* Body: catálogo (izq) + copilot (der) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', flex: 1, minHeight: 0 }}>
        {/* Catálogo */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
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
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="invCliente" width={60}>Inv cli</SortableTh>
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="invActeck" width={60}>Inv Ack</SortableTh>
                  <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="sellout90" width={64}>SO 90d</SortableTh>
                  <th style={{ ...thBase, width: 80 }}>Piezas</th>
                  <th style={{ ...thLeft, width: 170 }}>Precio</th>
                  <th style={{ ...thBase, width: 92 }}>Total</th>
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
                      <td style={{ padding: '6px 6px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{r.invActeck ? fmtInt(r.invActeck) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                      <td style={{ padding: '6px 6px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{r.sellout90 ? fmtInt(r.sellout90) : <span style={{ color: theme.textSubtle || theme.textMuted, fontWeight: 400 }}>—</span>}</td>
                      {/* Piezas (editable si sel) */}
                      <td style={{ padding: '4px 6px', textAlign: 'right' }}>
                        {sel ? (
                          <input type="number" min="0" value={val.piezas ?? ''}
                            onChange={(e) => editarSku(r.sku, { piezas: Number(e.target.value) || 0 })}
                            onClick={(e) => e.stopPropagation()}
                            style={{ width: 62, padding: '4px 8px', textAlign: 'right', fontSize: 11, fontFamily: 'inherit', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                        ) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}
                      </td>
                      {/* Precio (select lista + custom si sel) */}
                      <td style={{ padding: '4px 6px' }}>
                        {sel ? (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <select value={val.listaSel || ''}
                              onChange={(e) => {
                                const lst = e.target.value;
                                editarSku(r.sku, { listaSel: lst, precio: lst === '__custom' ? val.precio : (r.precios[lst] || 0) });
                              }}
                              onClick={(e) => e.stopPropagation()}
                              style={{ flex: 1, minWidth: 0, padding: '4px 6px', fontSize: 10, fontFamily: 'inherit', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, outline: 'none', cursor: 'pointer' }}>
                              {listasKeys.map((k) => <option key={k} value={k}>{k} · {formatMXN(r.precios[k])}</option>)}
                              <option value="__custom">Personalizado</option>
                            </select>
                            {val.listaSel === '__custom' && (
                              <input type="number" min="0" step="0.01" value={val.precio ?? ''}
                                onChange={(e) => editarSku(r.sku, { precio: Number(e.target.value) || 0 })}
                                onClick={(e) => e.stopPropagation()}
                                style={{ width: 68, padding: '4px 6px', textAlign: 'right', fontSize: 10.5, fontFamily: 'inherit', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text, outline: 'none', fontVariantNumeric: 'tabular-nums' }} />
                            )}
                          </div>
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
                    <td colSpan={10} style={{ padding: 12, textAlign: 'center', fontSize: 11, color: theme.textMuted, borderTop: `1px solid ${theme.border}` }}>
                      Mostrando 300 de {fmtInt(filtrados.length)} · usa el buscador para filtrar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer sticky negro Apple */}
          <div style={{
            position: 'sticky', bottom: 0, zIndex: 20,
            background: heroBg, color: heroText,
            borderTop: isDark ? '1px solid rgba(255,255,255,0.08)' : 'none',
            padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16,
          }}>
            <div style={{ display: 'flex', gap: 32 }}>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: heroSub, fontWeight: 500 }}>SKUs</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{propuestaLista.length}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: heroSub, fontWeight: 500 }}>Piezas</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{fmtInt(piezasTotal)}</div>
              </div>
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: heroSub, fontWeight: 500 }}>Total propuesta</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.025em', fontVariantNumeric: 'tabular-nums', marginTop: 2 }}>{formatMXN(totalPropuesta)}</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={onGuardar}
                style={{ padding: '9px 18px', background: 'rgba(255,255,255,0.12)', border: 0, borderRadius: 999, color: '#FFF', fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Save style={{ width: 12, height: 12 }} strokeWidth={2} />
                Guardar borrador
              </button>
              <button onClick={onRevisar} disabled={propuestaLista.length === 0}
                style={{
                  padding: '9px 20px',
                  background: propuestaLista.length === 0 ? 'rgba(255,255,255,0.10)' : P.accent,
                  color: propuestaLista.length === 0 ? heroSub : '#FFF',
                  border: 0, borderRadius: 999, fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                  cursor: propuestaLista.length === 0 ? 'not-allowed' : 'pointer',
                  display: 'inline-flex', alignItems: 'center', gap: 6, letterSpacing: '-0.01em',
                }}>
                Revisar <ChevronRight style={{ width: 12, height: 12 }} strokeWidth={2} />
              </button>
            </div>
          </div>
        </div>

        {/* Copilot lateral derecha */}
        <Copilot theme={theme} isDark={isDark} P={P} cliente={cliente} contexto={contexto} skus={skus} propuesta={propuesta} onAplicarPaquete={aplicarPaquete} />
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
      background: theme.surface, borderLeft: `1px solid ${theme.border}`,
      display: 'flex', flexDirection: 'column', minWidth: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '14px 16px', borderBottom: `1px solid ${theme.border}`,
        background: `linear-gradient(135deg, ${P.accent}0F, ${P.purple}0F)`,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 9,
            background: `linear-gradient(135deg, ${P.accent}, ${P.purple})`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFF',
          }}>
            <Sparkles style={{ width: 14, height: 14 }} strokeWidth={2} />
          </div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, letterSpacing: '-0.015em', color: theme.text }}>
              Copilot
            </div>
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>
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
          <input placeholder="Chat con el Copilot (próximamente)"
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
function VistaRevisar({ theme, isDark, cliente, contexto, skus, propuesta, nombreBorrador, onChangeNombre, onBack, onGuardar, onExportar }) {
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

  const grupos = useMemo(() => {
    if (cliente.key !== 'digitalife') return { 'Propuesta': propuestaLista };
    const g = { 'Monitores': [], 'Sillas': [], 'Todo lo demás': [] };
    for (const r of propuestaLista) g[familiaHoja(r.familia)].push(r);
    return g;
  }, [propuestaLista, cliente]);

  const gap = contexto?.gap || 0;
  const cierraGapPct = gap > 0 ? Math.round((total / gap) * 100) : null;
  const exportar = () => (onExportar ? onExportar() : null);

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
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em' }}>
                Revisar · {cliente.label}
              </div>
              <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>Listo para enviar</div>
            </div>
          </div>
          <div style={{ width: 1, height: 24, background: theme.border }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <label style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>Nombre del borrador</label>
            <input
              type="text"
              value={nombreBorrador || ''}
              onChange={(e) => onChangeNombre?.(e.target.value)}
              placeholder="ej. Kickoff Q3, Promo verano…"
              style={{
                background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8,
                padding: '5px 10px', fontSize: 12, fontFamily: TYPO.fontText, color: theme.text,
                minWidth: 200, outline: 'none',
              }}
              onFocus={(e) => e.target.style.borderColor = P.accent}
              onBlur={(e) => e.target.style.borderColor = theme.border}
            />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onGuardar}
            style={{ padding: '8px 16px', background: theme.surface, border: `1px solid ${theme.border}`, color: theme.text, fontWeight: 500, fontFamily: 'inherit', borderRadius: 999, fontSize: 12, cursor: 'pointer' }}>
            Guardar borrador
          </button>
          <button onClick={exportar}
            style={{ padding: '8px 18px', background: P.accent, border: 0, color: '#FFF', fontWeight: 600, fontFamily: 'inherit', borderRadius: 999, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Download style={{ width: 12, height: 12 }} strokeWidth={2} />
            Exportar Excel
          </button>
        </div>
      </div>

      <div style={{ padding: '0 4px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Hero total */}
        <div style={{
          background: heroBg, color: heroText, borderRadius: 16, padding: '20px 24px',
          display: 'grid', gridTemplateColumns: '1fr auto', gap: 20, alignItems: 'center',
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
            <p style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: heroSub, fontWeight: 500, margin: 0 }}>
              Total de la propuesta
            </p>
            <h2 style={{ fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 600, letterSpacing: '-0.03em', color: heroText, margin: '6px 0', fontVariantNumeric: 'tabular-nums' }}>
              {formatMXN(total)}
            </h2>
            <p style={{ fontSize: 12, color: heroMuted, margin: 0, maxWidth: 480, lineHeight: 1.5 }}>
              <strong style={{ color: heroText, fontWeight: 500 }}>{propuestaLista.length} SKUs · {fmtInt(piezas)} piezas.</strong>
              {' '}
              {cierraGapPct != null
                ? <>Cierra el gap del mes en <strong style={{ color: heroText }}>{cierraGapPct}%</strong> — te da margen para negociar cierres.</>
                : <>El gap del mes ya está cerrado; esta propuesta suma a tu YTD.</>}
            </p>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, textAlign: 'right', position: 'relative' }}>
            {cierraGapPct != null && (
              <div>
                <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: heroSub, fontWeight: 500 }}>Cierra gap</div>
                <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', fontSize: 20, marginTop: 2, color: cierraGapPct >= 100 ? P.green : P.orange }}>
                  ▲ {cierraGapPct}%
                </div>
              </div>
            )}
            <div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: heroSub, fontWeight: 500 }}>Precio promedio</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', fontSize: 18, marginTop: 2, color: heroText }}>
                {formatMXN(precioProm)}/pz
              </div>
            </div>
          </div>
        </div>

        {/* KPIs Fitness */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
          <KpiFit theme={theme} P={P} icon="🧾" iconBg={`${P.accent}22`} iconColor={P.accent} chip="SKUs" value={String(propuestaLista.length)} note="Productos incluidos en la propuesta." />
          <KpiFit theme={theme} P={P} icon="📦" iconBg={`${P.green}22`} iconColor={P.green} chip="Piezas" value={fmtInt(piezas)} note={<>Suma total de <strong style={{ color: theme.text }}>{propuestaLista.length} SKUs</strong>.</>} />
          <KpiFit theme={theme} P={P} icon="💰" iconBg={`${P.orange}22`} iconColor={P.orange} chip="Total" value={fmtCompact(total)} note={<>Precio promedio <strong style={{ color: theme.text }}>{formatMXN(precioProm)}</strong>/pz.</>} />
          <KpiFit theme={theme} P={P} icon="🎯" iconBg={`${P.purple}22`} iconColor={P.purple} chip="Vs Gap"
            value={cierraGapPct != null ? `▲ ${cierraGapPct}%` : '—'}
            valueColor={cierraGapPct != null && cierraGapPct >= 100 ? P.green : cierraGapPct != null ? P.orange : theme.text}
            note={gap > 0 ? <>Gap era <strong style={{ color: theme.text }}>{fmtCompact(gap)}</strong>.</> : <>Sin gap pendiente.</>} />
        </div>

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
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 60 }}>Inv cli</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 60 }}>Inv Ack</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 68 }}>SO 90d</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 66 }}>Piezas</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 86 }}>Precio</th>
                      <th style={{ textAlign: 'right', padding: '8px 8px', color: '#FFF', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap', width: 100 }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filas.map((r) => (
                      <tr key={r.sku} style={{ borderTop: `1px solid ${theme.border}`, height: 30 }}>
                        <td style={{ padding: '5px 10px', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text }}>{r.sku}</td>
                        <td style={{ padding: '5px 10px', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.invCliente || 0)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.invActeck || 0)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: theme.textMuted, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.sellout90 || 0)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(r.piezas || 0)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', color: r.listaSel === '__custom' ? P.accent : theme.text, fontWeight: r.listaSel === '__custom' ? 600 : 400, fontSize: 11, fontVariantNumeric: 'tabular-nums' }}>{formatMXN(r.precio)}</td>
                        <td style={{ padding: '5px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12, letterSpacing: '-0.01em', fontVariantNumeric: 'tabular-nums' }}>{formatMXN((r.piezas || 0) * (r.precio || 0))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: theme.bg, borderTop: `2px solid ${theme.borderStrong || theme.border}` }}>
                      <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.textMuted, letterSpacing: '-0.01em' }}>
                        Total {nombreGrupo.toLowerCase()}
                      </td>
                      <td style={{ padding: '10px 8px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{fmtInt(piezasGrupo)}</td>
                      <td></td>
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
async function fetchAll(clienteKey) {
  const mm = mesesCerrados();
  const anioMin = Math.min(...mm.map((m) => m.anio));
  const anioMax = Math.max(...mm.map((m) => m.anio));

  const [roadmapRes, invAckRes, invCliRes, preciosRes, sellout90, selloutMes, cuotaRes] = await Promise.all([
    supabase.from('roadmap_sku').select('sku,marca,familia,categoria,descripcion,rdmp'),
    supabase.from('inventario_acteck').select('articulo,disponible,no_almacen'),
    supabase.from('inventario_cliente').select('sku,stock,titulo,anio,semana').eq('cliente', clienteKey),
    supabase.from('precios_sku')
      .select('sku,lista,precio,anio,mes')
      .gte('anio', anioMax - 1)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
    fetchSellout(clienteKey, mm, anioMin, anioMax),
    fetchSelloutMesActual(clienteKey),
    supabase.from('cuotas_mensuales')
      .select('cuota_min,cuota_meta')
      .eq('cliente', clienteKey)
      .eq('anio', MES_ACTUAL.anio).eq('mes', MES_ACTUAL.mes),
  ]);

  const ALMACENES_COMERCIALES = new Set([1, 2, 3, 6, 9, 12, 14, 15, 16, 17, 19, 25, 44, 64, 71]);
  const invAck = new Map();
  for (const r of invAckRes.data || []) {
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
  for (const r of preciosRes.data || []) {
    if (!preciosPorSku.has(r.sku)) preciosPorSku.set(r.sku, {});
    const lst = preciosPorSku.get(r.sku);
    if (!(r.lista in lst)) lst[r.lista] = Number(r.precio) || 0;
  }
  const sellout = new Map();
  for (const r of sellout90) sellout.set(r.sku, (sellout.get(r.sku) || 0) + (Number(r.cantidad) || 0));

  const rows = (roadmapRes.data || []).map((r) => ({
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
    precios: preciosPorSku.get(r.sku) || {},
  }));
  rows.sort((a, b) => b.sellout90 - a.sellout90);

  const cuota = (cuotaRes.data || []).reduce((s, r) => s + (Number(r.cuota_min) || Number(r.cuota_meta) || 0), 0);
  const facturado = selloutMes;
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantes = Math.max(0, Math.ceil((finMes - hoy) / 86400000));
  const skusConInv = rows.filter((r) => r.invActeck > 0).length;
  const topVendidos = rows.slice(0, 5).map((r) => ({ sku: r.sku, piezas: r.sellout90 }));

  return {
    skus: rows,
    contexto: { cuota, facturado, gap: Math.max(0, cuota - facturado), diasRestantes, skusConInv, topVendidos },
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

async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const meses = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    const { data } = await supabase.from('sellout_detalle')
      .select('no_parte,cantidad,fecha')
      .eq('cliente', 'digitalife')
      .gte('fecha', `${anioMin}-01-01`).limit(200000);
    return (data || [])
      .filter((r) => meses.has(String(r.fecha).slice(0, 7)))
      .map((r) => ({ sku: r.no_parte, cantidad: r.cantidad }));
  }
  if (clienteKey === 'pcel') {
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
      const total = (Number(r.vta_mes_1) || 0) + (Number(r.vta_mes_2) || 0) + (Number(r.vta_mes_3) || 0);
      if (total > 0) out.push({ sku: r.sku, cantidad: total });
    }
    return out;
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin).limit(200000);
    return (data || [])
      .filter((r) => meses.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad }));
  }
  return [];
}
