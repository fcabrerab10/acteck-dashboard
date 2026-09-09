// Piezas compartidas de la pantalla Pagos (Ferruteck 2) · constantes,
// pills de categoría/estatus, inputs con tema, modal y menú de fila.
import React, { useEffect, useRef, useState } from 'react';
import { MoreHorizontal, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, Boton, EASE, DUR } from '../../../components/kit';

export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGOS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

export const CATEGORIA_META = {
  promociones: { label: 'Promociones', color: '#f59e0b', tone: 'orange' },
  marketing: { label: 'Marketing', color: '#8b5cf6', tone: 'purple' },
  pagosFijos: { label: 'Pagos Fijos', color: '#3b82f6', tone: 'blue' },
  pagosVariables: { label: 'Pagos Variables', color: '#10b981', tone: 'green' },
  rebate: { label: 'Rebate', color: '#ef4444', tone: 'red' },
  spiff: { label: 'SPIFF', color: '#9333ea', tone: 'purple' },
  // Solo aplica a Dicotech por ahora (interno, no visible para el cliente).
  fondoMkt: { label: 'Fondo MKT', color: '#7C3AED', tone: 'purple', soloPara: ['dicotech'] },
};

export const ESTATUS_OPT = [
  { value: 'pendiente', label: 'Por pagar', tone: 'orange' },
  { value: 'en_proceso', label: 'En proceso', tone: 'blue' },
  { value: 'pagado', label: 'Pagado', tone: 'green' },
  { value: 'vencido', label: 'Vencido', tone: 'red' },
  { value: 'no_aplica', label: 'No aplica', tone: 'gray' },
  { value: 'cancelado', label: 'Cancelado', tone: 'gray' },
];

export const TIPOS_ACTIVIDAD_MKT = [
  { value: 'stand', label: 'Stand / Punto de venta' },
  { value: 'anuncios', label: 'Anuncios pagados' },
  { value: 'evento', label: 'Evento / Convención' },
  { value: 'redes_sociales', label: 'Redes sociales' },
  { value: 'dem', label: 'DEM (email mkt)' },
  { value: 'capacitacion', label: 'Capacitación / Entrenamiento' },
  { value: 'material_pop', label: 'Material POP / Display' },
  { value: 'promocion', label: 'Promoción al consumidor' },
  { value: 'otro', label: 'Otro' },
];

export const FUENTE_META = {
  empresa: { label: 'Empresa', tone: 'green' },
  fondo_mkt: { label: 'Fondo MKT', tone: 'purple' },
  vendor: { label: 'Vendor', tone: 'gray' },
};

// ¿el mes de la fecha es posterior al mes actual? (no se cuenta como pendiente todavía)
export function esMesFuturo(fechaStr) {
  if (!fechaStr) return false;
  const s = String(fechaStr).slice(0, 10);
  const [y, m] = s.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return false;
  const hoy = new Date();
  const hy = hoy.getFullYear();
  const hm = hoy.getMonth() + 1;
  return y > hy || (y === hy && m > hm);
}

export const mesKeyDeFijo = (r) => (r.mes_fijo ? String(r.mes_fijo).padStart(2, '0') : r.fecha_compromiso ? String(r.fecha_compromiso).slice(5, 7) : null);

export const MONO = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };

export function CategoriaPill({ categoria, size = 'sm' }) {
  const m = CATEGORIA_META[categoria];
  if (!m) return <Pill tone="gray" size={size}>{categoria || '—'}</Pill>;
  return <Pill tone={m.tone} size={size}>{m.label}</Pill>;
}

export function EstatusPill({ estatus, programado = false, size = 'sm' }) {
  if (programado) return <Pill tone="blue" dot size={size}>Programado</Pill>;
  const s = ESTATUS_OPT.find((o) => o.value === (estatus || 'pendiente')) || ESTATUS_OPT[0];
  return <Pill tone={s.tone} dot size={size}>{s.label}</Pill>;
}

// Estilo base de inputs / selects con tema.
export function useInputStyle() {
  const { theme } = useTheme();
  return {
    width: '100%', boxSizing: 'border-box', height: 30, padding: '0 10px', borderRadius: 8,
    border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text,
    fontFamily: TYPO.fontText, fontSize: 12, outline: 'none',
  };
}

export function Campo({ label, children, hint, style }) {
  const { theme } = useTheme();
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, ...style }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.07em', color: theme.textMuted, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: 10, color: theme.textMuted, ...MONO }}>{hint}</span>}
    </label>
  );
}

export const Input = React.forwardRef(function Input({ style, ...props }, ref) {
  const base = useInputStyle();
  return <input ref={ref} {...props} style={{ ...base, ...style }} />;
});

export function Select({ style, children, ...props }) {
  const base = useInputStyle();
  return <select {...props} style={{ ...base, ...style }}>{children}</select>;
}

// Texto auxiliar (notas al pie de un panel).
export function Nota({ children, style }) {
  const { theme } = useTheme();
  return <div style={{ fontSize: 10.5, color: theme.textMuted, lineHeight: 1.5, fontFamily: TYPO.fontText, ...style }}>{children}</div>;
}

// Modal central con tema.
export function Modal({ titulo, sub, onClose, children, footer, width = 520 }) {
  const { theme } = useTheme();
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', maxWidth: width, maxHeight: '88vh', display: 'flex', flexDirection: 'column', background: theme.surface, color: theme.text, border: `1px solid ${theme.border}`, borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.25)', fontFamily: TYPO.fontText }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${theme.border}` }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{titulo}</div>
            {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{sub}</div>}
          </div>
          <button onClick={onClose} title="Cerrar" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, padding: 4, display: 'inline-flex' }}><X size={15} /></button>
        </div>
        <div style={{ overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, padding: '10px 14px', borderTop: `1px solid ${theme.border}` }}>{footer}</div>}
      </div>
    </div>
  );
}

// Menú de fila (⋯) · items: [{ label, onClick, peligro?, disabled? }]
export function MenuFila({ items, title = 'Más acciones' }) {
  const { theme } = useTheme();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);
  const visibles = (items || []).filter(Boolean);
  if (!visibles.length) return null;
  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }} onClick={(e) => e.stopPropagation()}>
      <button onClick={() => setOpen((v) => !v)} title={title}
        style={{ width: 24, height: 24, borderRadius: 999, border: `1px solid ${open ? theme.borderStrong || theme.border : 'transparent'}`, background: open ? theme.surfaceHover : 'transparent', color: theme.textMuted, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, transition: `background ${DUR.state}ms ${EASE}` }}>
        <MoreHorizontal size={14} />
      </button>
      {open && (
        <div style={{ position: 'absolute', right: 0, top: 26, zIndex: 20, minWidth: 190, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, boxShadow: '0 10px 30px rgba(0,0,0,0.16)', padding: 4 }}>
          {visibles.map((it, i) => (
            <button key={i} disabled={it.disabled} onClick={() => { setOpen(false); it.onClick?.(); }}
              style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', borderRadius: 7, border: 0, background: 'transparent', cursor: it.disabled ? 'not-allowed' : 'pointer', color: it.peligro ? theme.red : theme.text, fontFamily: TYPO.fontText, fontSize: 12, opacity: it.disabled ? 0.45 : 1, whiteSpace: 'nowrap' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </span>
  );
}

// Botón redondo ✓ para marcar/desmarcar pagado.
export function CheckPagado({ pagado, onClick, title, disabled }) {
  const { theme } = useTheme();
  const green = theme.green || '#34C759';
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.(); }} disabled={disabled} title={title}
      style={{ width: 22, height: 22, borderRadius: 999, border: `1.5px solid ${pagado ? green : theme.borderStrong || theme.border}`, background: pagado ? green : 'transparent', color: pagado ? '#FFF' : theme.textMuted, cursor: disabled ? 'not-allowed' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', padding: 0, fontSize: 12, fontWeight: 700, lineHeight: 1, opacity: disabled ? 0.4 : 1, transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}` }}>
      ✓
    </button>
  );
}

// Fila de toggle (carpeta) dentro de un panel · "▸ 3 pagos completados ($12,000)"
export function FilaToggle({ abierto, onClick, children, tone }) {
  const { theme } = useTheme();
  const col = tone === 'green' ? theme.green : tone === 'orange' ? theme.orange : theme.textMuted;
  return (
    <button onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', textAlign: 'left', padding: '6px 8px', border: 0, borderRadius: 8, background: 'transparent', cursor: 'pointer', color: col, fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}
      onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover || 'rgba(0,0,0,0.03)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
      <span style={{ display: 'inline-block', transform: abierto ? 'rotate(90deg)' : 'rotate(0)', transition: `transform ${DUR.state}ms ${EASE}`, fontSize: 10 }}>▶</span>
      {children}
    </button>
  );
}

export { Boton };
