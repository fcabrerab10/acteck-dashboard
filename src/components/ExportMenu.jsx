// ExportMenu — botón pill "Exportar" (Excel / PDF) estilo V3.
//
// Uso:
//   <ExportMenu
//     titulo="Sell In" subtitulo="Digitalife · 2026"
//     excel={() => ({ hojas: [{ nombre: 'SKUs', columnas, filas, totales }] })}   // o un objeto, o { table: tableRef }
//     pdf={{ ref: rootRef }}                                                       // o { elemento: HTMLElement | id }
//   />
//
// `excel` puede ser: objeto para exportarExcel · función (sync/async) que lo devuelve ·
//                    { table: ref|HTMLElement|id } para leer un <table> del DOM ·
//                    función async "propia" que devuelve undefined (export ya existente).
// `pdf`  : { ref } | { elemento } — la raíz de la pantalla (o bloque) a imprimir.
import React, { useEffect, useRef, useState } from 'react';
import { Download, FileSpreadsheet, FileText, ChevronDown } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { elevation } from '../lib/elevation';
import { exportarExcel, exportarPDF, tablaDesdeDOM } from '../lib/exportar';

const EASE = 'cubic-bezier(0.32,0.72,0,1)';

const resolverEl = (x) => {
  if (!x) return null;
  if (typeof x === 'string') return document.getElementById(x);
  if (x.current !== undefined) return x.current;
  return x;
};

export default function ExportMenu({
  titulo,
  subtitulo,
  excel,
  pdf,
  size = 'sm',
  deshabilitado = false,
  label = 'Exportar',
  align = 'right',
  style,
}) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(null); // 'excel' | 'pdf' | null
  const [error, setError] = useState(null);
  const wrapRef = useRef(null);
  const errTimer = useRef(null);

  const tieneExcel = !!excel;
  const tienePDF = !!pdf;
  const isDark = theme.mode === 'dark';
  const h = size === 'md' ? 34 : 28;
  const fs = size === 'md' ? 13 : 12;

  // Apertura/cierre con animación 160ms
  useEffect(() => {
    if (open) { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id); }
    setVisible(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown, { passive: true });
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => () => clearTimeout(errTimer.current), []);

  const mostrarError = (msg) => {
    setError(msg);
    clearTimeout(errTimer.current);
    errTimer.current = setTimeout(() => setError(null), 3000);
  };

  const cerrar = () => setOpen(false);

  const onExcel = async () => {
    cerrar();
    if (busy) return;
    setBusy('excel');
    try {
      let cfg = excel;
      if (typeof cfg === 'function') cfg = await cfg();
      if (cfg === undefined || cfg === null || cfg === true) return; // export propio ya ejecutado
      if (cfg.table) {
        const tableEl = resolverEl(cfg.table);
        const { columnas, filas } = tablaDesdeDOM(tableEl);
        cfg = { titulo: cfg.titulo || titulo, archivo: cfg.archivo, hojas: [{ nombre: cfg.nombre || 'Datos', subtitulo: cfg.subtitulo ?? subtitulo, columnas, filas }] };
      }
      await exportarExcel({ titulo, ...cfg, hojas: (cfg.hojas || []).map((hj) => ({ subtitulo, ...hj })) });
    } catch (e) {
      console.error('[ExportMenu] Excel', e);
      mostrarError(e?.message || 'No se pudo exportar a Excel');
    } finally {
      setBusy(null);
    }
  };

  const onPDF = async () => {
    cerrar();
    if (busy) return;
    setBusy('pdf');
    try {
      const elemento = resolverEl(pdf?.ref) || resolverEl(pdf?.elemento) || resolverEl(pdf);
      await exportarPDF({ titulo: pdf?.titulo || titulo, subtitulo: pdf?.subtitulo ?? subtitulo, elemento });
    } catch (e) {
      console.error('[ExportMenu] PDF', e);
      mostrarError(e?.message || 'No se pudo generar el PDF');
    } finally {
      setBusy(null);
    }
  };

  const disabled = deshabilitado || !!busy || (!tieneExcel && !tienePDF);

  const btnStyle = {
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: h, padding: `0 ${size === 'md' ? 12 : 10}px`,
    borderRadius: 999,
    border: `1px solid ${theme.borderStrong || theme.border}`,
    background: open ? (theme.surfaceHover || 'transparent') : 'transparent',
    color: disabled ? theme.textSubtle : theme.text,
    fontFamily: TYPO.fontText, fontSize: fs, fontWeight: 500, letterSpacing: '-0.01em',
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled && !busy ? 0.55 : 1,
    transition: `background 160ms ${EASE}, opacity 160ms ${EASE}`,
    whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1,
    ...style,
  };

  const itemStyle = (enabled) => ({
    display: 'flex', alignItems: 'center', gap: 8, width: '100%',
    padding: '7px 10px', borderRadius: 8, border: 'none', textAlign: 'left',
    background: 'transparent', color: enabled ? theme.text : theme.textSubtle,
    fontFamily: TYPO.fontText, fontSize: 13, fontWeight: 500, letterSpacing: '-0.01em',
    cursor: enabled ? 'pointer' : 'default', opacity: enabled ? 1 : 0.5,
  });

  return (
    <div ref={wrapRef} data-no-print style={{ position: 'relative', display: 'inline-block' }}>
      <button
        type="button"
        onClick={() => !disabled && setOpen((o) => !o)}
        disabled={disabled}
        aria-haspopup="menu"
        aria-expanded={open}
        title={label}
        style={btnStyle}
      >
        {busy ? <Spinner color={theme.text} /> : <Download style={{ width: 13, height: 13 }} strokeWidth={2.2} />}
        <span>{busy ? 'Exportando…' : label}</span>
        {!busy && <ChevronDown style={{ width: 11, height: 11, opacity: 0.6, transform: open ? 'rotate(180deg)' : 'none', transition: `transform 160ms ${EASE}` }} strokeWidth={2.4} />}
      </button>

      {open && (
        <div
          role="menu"
          style={{
            position: 'absolute', top: h + 6, [align === 'left' ? 'left' : 'right']: 0, zIndex: 60,
            minWidth: 164, padding: 4,
            background: isDark ? (theme.surface || '#1C1C1E') : (theme.surface || '#FFFFFF'),
            border: `1px solid ${theme.borderStrong || theme.border}`,
            borderRadius: 12,
            boxShadow: elevation(theme, 'flotante'),
            transformOrigin: align === 'left' ? 'top left' : 'top right',
            opacity: visible ? 1 : 0,
            transform: visible ? 'scale(1) translateY(0)' : 'scale(0.96) translateY(-4px)',
            transition: `opacity 160ms ${EASE}, transform 160ms ${EASE}`,
          }}
        >
          <button type="button" role="menuitem" style={itemStyle(tieneExcel)} disabled={!tieneExcel} onClick={onExcel}
            onMouseEnter={(e) => { if (tieneExcel) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <FileSpreadsheet style={{ width: 14, height: 14, color: theme.green }} strokeWidth={2} />
            Excel (.xlsx)
          </button>
          <button type="button" role="menuitem" style={itemStyle(tienePDF)} disabled={!tienePDF} onClick={onPDF}
            onMouseEnter={(e) => { if (tienePDF) e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.04)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <FileText style={{ width: 14, height: 14, color: theme.red }} strokeWidth={2} />
            PDF
          </button>
        </div>
      )}

      {error && (
        <div role="alert" style={{
          position: 'absolute', top: h + 6, [align === 'left' ? 'left' : 'right']: 0, zIndex: 61,
          maxWidth: 280, padding: '6px 10px', borderRadius: 999,
          background: theme.red || '#FF3B30', color: '#FFFFFF',
          fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, lineHeight: 1.3,
          boxShadow: elevation(theme, 'flotante'), whiteSpace: 'normal',
        }}>
          {error}
        </div>
      )}
    </div>
  );
}

function Spinner({ color }) {
  return (
    <span aria-hidden style={{
      width: 12, height: 12, borderRadius: '50%', flex: '0 0 auto',
      border: `2px solid ${color}`, borderTopColor: 'transparent', opacity: 0.8,
      animation: 'exportmenu-spin 0.8s linear infinite', display: 'inline-block',
    }}>
      <style>{'@keyframes exportmenu-spin{to{transform:rotate(360deg)}}'}</style>
    </span>
  );
}
