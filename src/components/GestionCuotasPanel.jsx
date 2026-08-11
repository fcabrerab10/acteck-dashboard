// GestionCuotasPanel — subir Excel de cuotas mensuales por cliente.
// Ya NO se cargan desde el ERP (para no reescribirse en cada upload).
// Formato Excel esperado (misma hoja "Cuotas" del ERP):
//   row 0: header
//   row 1: años en columnas (ej. col 1 = 2025, col 13 = 2026)
//   row 2: meses (Ene..Dic × cada año)
//   row 3: "Etiquetas de fila"
//   row 4+: filas de clientes (col 0 = nombre) × 12 columnas por año
//
// El parser detecta bloques de año automáticamente y emite filas
// { cliente, anio, mes, cuota_min, cuota_ideal } — mismo shape que la BD.
import React from 'react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';

const P_ACCENT = '#007AFF';
const XLSX_URL = 'https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js';

const NORM_CLIENTE = {
  'DICOTECH': 'dicotech',
  'DIGITAL LIFE': 'digitalife',
  'DIGITALIFE': 'digitalife',
  'PCEL': 'pcel',
};

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function normalizarCliente(nm) {
  const up = String(nm || '').trim().toUpperCase();
  if (NORM_CLIENTE[up]) return NORM_CLIENTE[up];
  return up.toLowerCase().replace(/\s+/g, '_');
}

function toNum(v) {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return v;
  const n = parseFloat(String(v).replace(/[,\s$]/g, ''));
  return isNaN(n) ? null : n;
}

function formatMX(n) {
  const v = Number(n);
  if (!isFinite(v) || v === 0) return '—';
  return new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(v);
}

async function loadSheetJS() {
  if (window.XLSX) return window.XLSX;
  await new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = XLSX_URL; s.onload = resolve; s.onerror = reject;
    document.head.appendChild(s);
  });
  return window.XLSX;
}

// Parser espejo del cuotasClientes() de uploads.html
function parseCuotas(wb) {
  // Preferimos la hoja "Cuotas"; si no existe, usa la primera hoja del libro.
  const sheetName = wb.SheetNames.find((n) => n.toLowerCase() === 'cuotas') || wb.SheetNames[0];
  const sh = wb.Sheets[sheetName];
  if (!sh) return { rows: [], warning: 'No se encontró ninguna hoja' };
  const arr = window.XLSX.utils.sheet_to_json(sh, { header: 1, defval: null });
  if (arr.length < 5) return { rows: [], warning: 'Hoja demasiado corta (mínimo 5 filas)' };

  const headerAnios = arr[1] || [];
  const bloques = [];
  for (let c = 0; c < headerAnios.length; c++) {
    const v = String(headerAnios[c] || '').trim();
    const m = v.match(/^(20\d{2})$/);
    if (m) bloques.push({ anio: parseInt(m[1], 10), colStart: c, colEnd: c + 11 });
  }
  if (bloques.length === 0) {
    return { rows: [], warning: 'No se encontraron años en la fila 2 (esperado formato "2025", "2026", ...)' };
  }

  const out = [];
  for (let r = 4; r < arr.length; r++) {
    const row = arr[r];
    if (!row) continue;
    const cliente = normalizarCliente(row[0]);
    if (!cliente || cliente === 'total_general' || cliente === '') continue;
    for (const b of bloques) {
      for (let mes = 1; mes <= 12; mes++) {
        const val = toNum(row[b.colStart + (mes - 1)]);
        if (val == null || val <= 0) continue;
        out.push({
          cliente,
          anio: b.anio,
          mes,
          cuota_min: val,
          cuota_ideal: val,
        });
      }
    }
  }
  return { rows: out, sheetName, bloques };
}

// Agrupa filas para el preview: { cliente: { anio: [mes×12] } }
function agrupar(rows) {
  const map = new Map();
  for (const r of rows) {
    if (!map.has(r.cliente)) map.set(r.cliente, new Map());
    const cliMap = map.get(r.cliente);
    if (!cliMap.has(r.anio)) cliMap.set(r.anio, new Array(12).fill(0));
    cliMap.get(r.anio)[r.mes - 1] = r.cuota_min;
  }
  const salida = [];
  for (const [cli, cliMap] of map) {
    for (const [anio, meses] of cliMap) {
      salida.push({ cliente: cli, anio, meses, total: meses.reduce((s, v) => s + v, 0) });
    }
  }
  return salida.sort((a, b) => a.cliente.localeCompare(b.cliente) || a.anio - b.anio);
}

export default function GestionCuotasPanel({ onClose, onSaved }) {
  const { theme } = useTheme();
  const fileInputRef = React.useRef(null);
  const [parsed, setParsed] = React.useState(null); // { rows, sheetName, bloques, fileName }
  const [saving, setSaving] = React.useState(false);
  const [reemplazar, setReemplazar] = React.useState(true);
  const [error, setError] = React.useState(null);
  const [msg, setMsg] = React.useState(null);
  const [busy, setBusy] = React.useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    setBusy(true); setError(null); setMsg(null); setParsed(null);
    try {
      const XLSX = await loadSheetJS();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const { rows, warning, sheetName, bloques } = parseCuotas(wb);
      if (warning) throw new Error(warning);
      if (rows.length === 0) throw new Error('El Excel no contiene filas de cuotas válidas');
      setParsed({ rows, sheetName, bloques, fileName: file.name });
    } catch (e) {
      setError(e.message || 'No se pudo leer el archivo');
    } finally { setBusy(false); }
  };

  const guardar = async () => {
    if (!parsed) return;
    setSaving(true); setError(null); setMsg(null);
    try {
      // Si reemplazar=true, borramos primero todas las (cliente, anio) presentes en el excel.
      if (reemplazar) {
        const pares = new Map(); // key = cliente:anio
        for (const r of parsed.rows) pares.set(`${r.cliente}:${r.anio}`, { cliente: r.cliente, anio: r.anio });
        for (const { cliente, anio } of pares.values()) {
          const { error: delErr } = await supabase.from('cuotas_mensuales')
            .delete().eq('cliente', cliente).eq('anio', anio);
          if (delErr) throw delErr;
        }
      }
      // Upsert por lotes de 500
      const CHUNK = 500;
      for (let i = 0; i < parsed.rows.length; i += CHUNK) {
        const slice = parsed.rows.slice(i, i + CHUNK);
        const { error: upErr } = await supabase.from('cuotas_mensuales')
          .upsert(slice, { onConflict: 'cliente,mes,anio' });
        if (upErr) throw upErr;
      }
      const pares = new Set(parsed.rows.map((r) => `${r.cliente}:${r.anio}`));
      setMsg(`✓ Cargadas ${parsed.rows.length} filas · ${pares.size} combinaciones (cliente × año)`);
      onSaved?.();
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally { setSaving(false); }
  };

  const grupos = parsed ? agrupar(parsed.rows) : [];

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
      fontFamily: TYPO.fontText, padding: 20,
    }} onClick={onClose}>
      <div style={{
        background: theme.surface, borderRadius: 16, width: '100%', maxWidth: 900,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column',
        boxShadow: '0 20px 60px rgba(0,0,0,0.25)', border: `1px solid ${theme.border}`,
      }} onClick={(e) => e.stopPropagation()}>
        {/* Header negro Ferruteck */}
        <div style={{ background: '#000', color: '#F5F5F7', padding: '18px 22px', borderRadius: '16px 16px 0 0', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17 }}>🎯</div>
          <div>
            <h3 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>
              Cuotas mensuales
            </h3>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
              Subes un Excel con todas las cuotas · reemplaza las de los años/clientes que traiga
            </div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'transparent', border: 0, cursor: 'pointer', color: 'rgba(255,255,255,0.6)', fontSize: 20, padding: 4 }}>✕</button>
        </div>

        {/* Cuerpo */}
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px' }}>
          {!parsed && (
            <div style={{
              border: `2px dashed ${theme.border}`, borderRadius: 14, padding: 40,
              textAlign: 'center', background: theme.bg,
            }}
              onDragOver={(e) => { e.preventDefault(); }}
              onDrop={(e) => {
                e.preventDefault();
                const f = e.dataTransfer.files?.[0];
                if (f) handleFile(f);
              }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
              <h4 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: theme.text, fontFamily: TYPO.fontDisplay }}>
                {busy ? 'Leyendo Excel…' : 'Arrastra el Excel de cuotas aquí'}
              </h4>
              <p style={{ margin: '6px 0 14px', fontSize: 11, color: theme.textMuted, lineHeight: 1.5 }}>
                Mismo formato que la hoja "Cuotas" del ERP. Se detectan los años automáticamente.<br />
                Filas = clientes · columnas = 12 meses por año.
              </p>
              <button onClick={() => fileInputRef.current?.click()} disabled={busy}
                style={{
                  padding: '9px 18px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                  cursor: busy ? 'not-allowed' : 'pointer', border: 0,
                  background: '#000', color: '#fff', fontFamily: 'inherit', opacity: busy ? 0.5 : 1,
                }}>
                {busy ? 'Procesando…' : 'Elegir archivo…'}
              </button>
              <input ref={fileInputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }}
                onChange={(e) => handleFile(e.target.files?.[0])} />
            </div>
          )}

          {parsed && (
            <div>
              {/* Resumen */}
              <div style={{
                display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
                padding: '10px 14px', background: theme.bg, border: `1px solid ${theme.border}`,
                borderRadius: 12, marginBottom: 14,
              }}>
                <div style={{ fontSize: 11, color: theme.textMuted }}>
                  <strong style={{ color: theme.text }}>{parsed.fileName}</strong>
                  <span> · hoja "{parsed.sheetName}" · {parsed.rows.length} filas · años: {parsed.bloques.map((b) => b.anio).join(', ')}</span>
                </div>
                <button onClick={() => { setParsed(null); setError(null); setMsg(null); }}
                  style={{
                    marginLeft: 'auto', padding: '5px 12px', borderRadius: 999, fontSize: 10.5,
                    fontWeight: 600, cursor: 'pointer', border: `1px solid ${theme.border}`,
                    background: 'transparent', color: theme.textMuted, fontFamily: 'inherit',
                  }}>Cambiar archivo</button>
              </div>

              {/* Tabla preview */}
              <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 11 }}>
                  <thead>
                    <tr style={{ background: theme.bg }}>
                      <th style={{ padding: '10px 12px', textAlign: 'left', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>Cliente</th>
                      <th style={{ padding: '10px 8px', textAlign: 'center', fontSize: 9, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>Año</th>
                      {MESES.map((m) => (
                        <th key={m} style={{ padding: '10px 4px', textAlign: 'right', fontSize: 9, fontWeight: 600, color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>{m}</th>
                      ))}
                      <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: 9, fontWeight: 700, color: theme.text, borderBottom: `1px solid ${theme.border}` }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grupos.map((g, i) => (
                      <tr key={`${g.cliente}-${g.anio}`} style={{ borderTop: i > 0 ? `1px solid ${theme.border}` : 0 }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: theme.text, textTransform: 'capitalize' }}>{g.cliente}</td>
                        <td style={{ padding: '8px 8px', textAlign: 'center', color: theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace' }}>{g.anio}</td>
                        {g.meses.map((v, mi) => (
                          <td key={mi} style={{ padding: '8px 4px', textAlign: 'right', color: v > 0 ? theme.text : theme.textMuted, fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10 }}>
                            {v > 0 ? formatMX(v) : '—'}
                          </td>
                        ))}
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 700, color: theme.text, fontFamily: '"SF Mono", ui-monospace, monospace' }}>${formatMX(g.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 14, cursor: 'pointer', padding: '10px 12px', background: theme.bg, borderRadius: 10, border: `1px solid ${theme.border}` }}>
                <input type="checkbox" checked={reemplazar} onChange={(e) => setReemplazar(e.target.checked)}
                  style={{ marginTop: 2 }} />
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: theme.text }}>Reemplazar cuotas existentes de los años cargados</div>
                  <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.4 }}>
                    Recomendado. Borra las cuotas actuales de cada (cliente × año) presente en el Excel antes de insertar.
                    Sin esto, sólo se agregan las filas nuevas y se actualizan las existentes por (cliente, mes, año).
                  </div>
                </div>
              </label>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', padding: '14px 22px', borderTop: `1px solid ${theme.border}`, background: theme.bg, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, minWidth: 200, flex: 1 }}>
            {error && <span style={{ color: '#B91C1C', fontWeight: 600 }}>⚠ {error}</span>}
            {msg && <span style={{ color: '#166534', fontWeight: 600 }}>{msg}</span>}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={onClose}
              style={{ padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: 'pointer', background: theme.surface, color: theme.text, fontFamily: 'inherit', border: `1px solid ${theme.border}` }}>
              Cerrar
            </button>
            <button onClick={guardar} disabled={!parsed || saving}
              style={{
                padding: '9px 16px', borderRadius: 999, fontSize: 12, fontWeight: 600,
                cursor: parsed && !saving ? 'pointer' : 'not-allowed',
                border: 0, background: parsed && !saving ? '#000' : theme.border,
                color: '#fff', fontFamily: 'inherit', opacity: parsed && !saving ? 1 : 0.5,
              }}>
              {saving ? 'Cargando…' : parsed ? `Cargar ${parsed.rows.length} cuotas` : 'Cargar cuotas'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
