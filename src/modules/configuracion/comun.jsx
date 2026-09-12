// Piezas compartidas de Administración: tri-estado de nivel (Oculto · Ver · Editar), estado del usuario,
// orden de las pestañas globales según el menú y helpers puros de permisos. Sólo kit + theme.*.
import React, { useLayoutEffect, useRef, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation } from '../../lib/elevation';
import { CLIENTES, PESTANAS_CLIENTE, PESTANAS_GLOBALES } from '../../lib/permisos';
import { Pill } from '../../components/kit';

export const NIVELES = ['oculto', 'ver', 'edit'];
export const NIVEL_LABEL = { oculto: 'Oculto', ver: 'Ver', edit: 'Editar' };
export const NIVEL_TONE = { oculto: 'gray', ver: 'blue', edit: 'green' };

/** Pestañas globales agrupadas en el orden del menú (src/components/nav/arbol.js). Lo que no esté aquí cae en "Otras". */
const GRUPOS_MENU = [
  { id: 'direccionGeneral',  label: 'Dirección General',  ids: ['estado_resultados'] },
  { id: 'direccionComercial', label: 'Dirección Comercial', ids: ['vision_general', 'analisis_clientes', 'sell_in', 'sell_out', 'inventario_global', 'cobranza_global', 'forecast_clientes', 'forecast_solicitudes'] },
  { id: 'clientesPropios',   label: 'Clientes propios',   ids: ['resumen_clientes', 'propuestas', 'estrategia_precios', 'forecast_reservas', 'ordenes_compra'] },
  { id: 'interno',           label: 'Interno',            ids: ['agenda', 'historial_cambios', 'configuracion'] },
  { id: 'axon',              label: 'Axon',               ids: ['axon_mexico'] },
];
export function gruposGlobales() {
  const porId = Object.fromEntries(PESTANAS_GLOBALES.map((p) => [p.id, p]));
  const usados = new Set();
  const out = GRUPOS_MENU.map((g) => ({ ...g, pestanas: g.ids.map((id) => { usados.add(id); return porId[id]; }).filter(Boolean) }));
  const resto = PESTANAS_GLOBALES.filter((p) => !usados.has(p.id));
  if (resto.length) out.push({ id: 'otras', label: 'Otras', pestanas: resto });
  return out.filter((g) => g.pestanas.length);
}

/** Pestañas globales que un externo sí puede tener (el resto se muestran en gris). */
export const GLOBALES_EXTERNO = new Set(['resumen_clientes']);
/** Pestañas globales que nunca se editan desde la UI (sólo super admin por código). */
export const GLOBALES_SOLO_SUPER = new Set(['configuracion']);

export const permisosVacios = () => ({
  clientes: Object.fromEntries(CLIENTES.map((c) => [c.id, Object.fromEntries(PESTANAS_CLIENTE.map((p) => [p.id, 'oculto']))])),
  globales: Object.fromEntries(PESTANAS_GLOBALES.map((p) => [p.id, 'oculto'])),
});

/** Normaliza permisos de la BD (pueden faltar claves) sin perder valores existentes.
 *  `sensible` (bool): información sensible de Acteck — márgenes, utilidad, contribución y costos propios (puedeVerSensible). El valor del inventario de los clientes NO entra. */
export function normalizarPermisos(p) {
  const base = permisosVacios();
  const clientes = { ...base.clientes };
  for (const c of CLIENTES) clientes[c.id] = { ...base.clientes[c.id], ...(p?.clientes?.[c.id] || {}) };
  return { clientes, globales: { ...base.globales, ...(p?.globales || {}) }, sensible: p?.sensible === true };
}

export const nivelDe = (v) => (NIVELES.includes(v) ? v : 'oculto');
export const tieneAcceso = (v) => v === 'ver' || v === 'edit';

/** Clientes a los que el perfil tiene al menos una pestaña visible. */
export const clientesConAcceso = (permisos) =>
  CLIENTES.filter((c) => Object.values(permisos?.clientes?.[c.id] || {}).some(tieneAcceso)).map((c) => c.id);

/** Conteo de pestañas con 'edit' / 'ver' (globales + clientes) para resúmenes. */
export function contarNiveles(permisos) {
  const vals = [...Object.values(permisos?.globales || {}), ...Object.values(permisos?.clientes || {}).flatMap((c) => Object.values(c || {}))];
  return { edit: vals.filter((v) => v === 'edit').length, ver: vals.filter((v) => v === 'ver').length };
}

/** Estado visible del usuario: activo · pendiente (invitación) · suspendido. */
export function estadoDe(u) {
  if (!u?.activo || u?.estado === 'suspendido') return { key: 'suspendido', label: 'Inactivo', tone: 'gray' };
  if (u?.estado === 'pendiente') return { key: 'pendiente', label: 'Invitación enviada', tone: 'orange' };
  return { key: 'activo', label: 'Activo', tone: 'green' };
}

export const tipoDe = (u) => u?.tipo || (u?.rol === 'cliente' || u?.rol === 'viewer' ? 'externo' : 'interno');
export const TIPO_LABEL = { interno: 'Interno', externo: 'Externo' };

export function PillTipo({ u }) {
  const t = tipoDe(u);
  return <Pill tone={t === 'interno' ? 'blue' : 'purple'} size="xs">{TIPO_LABEL[t]}</Pill>;
}

/**
 * Tri-estado Oculto · Ver · Editar con la misma pastilla deslizante del Segmented del kit, pero a 24 px
 * para caber en listas largas. `disabled` lo atenúa y bloquea; `title` explica por qué.
 */
export function TriNivel({ value, onChange, disabled = false, title }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const ref = useRef(null);
  const [thumb, setThumb] = useState({ left: 2, width: 0 });
  const v = nivelDe(value);
  useLayoutEffect(() => {
    const el = ref.current?.querySelector(`[data-nivel="${v}"]`);
    if (el) setThumb({ left: el.offsetLeft, width: el.offsetWidth });
  }, [v]);
  const colorOn = { oculto: theme.text, ver: theme.accent || '#007AFF', edit: theme.green || '#34C759' }[v];
  return (
    <div ref={ref} role="radiogroup" title={title} aria-disabled={disabled} style={{
      position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 1, padding: 2, height: 24, borderRadius: 7, flexShrink: 0,
      background: dark ? 'rgba(120,120,128,0.24)' : 'rgba(120,120,128,0.12)', opacity: disabled ? 0.45 : 1,
    }}>
      {thumb.width > 0 && (
        <span aria-hidden style={{
          position: 'absolute', top: 2, bottom: 2, left: thumb.left, width: thumb.width, borderRadius: 5,
          background: dark ? 'rgba(99,99,102,0.9)' : theme.surface, boxShadow: elevation(theme, 'hover'),
          transition: `left ${DUR.state}ms ${EASE}, width ${DUR.state}ms ${EASE}`,
        }} />
      )}
      {NIVELES.map((n) => {
        const on = n === v;
        return (
          <button key={n} type="button" role="radio" aria-checked={on} data-nivel={n} disabled={disabled}
            onClick={() => !disabled && !on && onChange?.(n)}
            style={{
              position: 'relative', zIndex: 1, height: 20, padding: '0 9px', borderRadius: 5, border: 0, background: 'transparent',
              cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: on ? 700 : 500, letterSpacing: '-0.01em',
              color: on ? colorOn : (dark ? 'rgba(235,235,245,0.60)' : 'rgba(60,60,67,0.60)'), whiteSpace: 'nowrap', transition: `color ${DUR.state}ms ${EASE}`,
            }}>
            {NIVEL_LABEL[n]}
          </button>
        );
      })}
    </div>
  );
}

/** Input de texto del kit de Administración (mismo look que Campo del perfil, ancho 100 %). */
export function Input({ value, onChange, placeholder, type = 'text', autoFocus, style, onKeyDown }) {
  const { theme } = useTheme();
  const [foco, setFoco] = useState(false);
  const dark = theme.mode === 'dark';
  return (
    <input type={type} value={value ?? ''} onChange={(e) => onChange?.(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} onKeyDown={onKeyDown}
      onFocus={() => setFoco(true)} onBlur={() => setFoco(false)}
      style={{
        width: '100%', height: 30, padding: '0 10px', borderRadius: 8, fontFamily: TYPO.fontText, fontSize: 12.5, color: theme.text, boxSizing: 'border-box',
        background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(120,120,128,0.10)', border: `1px solid ${foco ? theme.accent : 'transparent'}`, outline: 'none',
        boxShadow: foco ? `0 0 0 3px ${theme.accentBg || 'rgba(0,122,255,0.15)'}` : 'none', transition: `box-shadow ${DUR.state}ms ${EASE}`, ...style,
      }} />
  );
}

/** Título de grupo en versalitas (para listas dentro de un Panel). */
export function Eyebrow({ children, style }) {
  const { theme } = useTheme();
  return <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, ...style }}>{children}</div>;
}

export const plural = (n, s, p = `${s}s`) => `${n} ${n === 1 ? s : p}`;
