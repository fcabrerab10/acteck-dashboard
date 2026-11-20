// Agenda · vista dividida (2026-11-20 · patrón «lista + detalle» aprobado en el diseño 3.105.0): con la preferencia por
// dispositivo `dividida` y ancho suficiente, el detalle del pendiente se pinta EN LÍNEA a la derecha de la lista en
// Hoy · Pendientes · Lo que mandé · Por cliente, sin taparla. Sin la preferencia (o en angosto) no cambia nada: la
// Agenda sigue abriendo la HojaLateral de siempre.
import React from 'react';
import { useTheme } from '../../lib/themeContext';

export { useAncho } from '../../lib/useAncho';

export const MODULOS_DIVIDIDOS = ['hoy6', 'pendientes', 'mande', 'clientes'];
/** Ancho mínimo del área de contenido de la Agenda (sin su menú) para partirla: ~290 px de lista + 320 de detalle. */
export const ANCHO_MIN_DIVIDIDA = 640;

/** ¿El detalle va en línea? Puro: lo decide la preferencia, el ancho medido y el módulo. */
export function cabeDividida({ dividida, ancho, modulo }) {
  return !!dividida && Number(ancho) >= ANCHO_MIN_DIVIDIDA && MODULOS_DIVIDIDOS.includes(modulo);
}

/**
 * Armazón: lista a la izquierda y, si `detalle` viene, el detalle a la derecha con su propio desplazamiento.
 * La estructura es la misma con y sin detalle para que la lista no se desmonte (conserva la fila elegida con ↑↓).
 */
export function AgendaDividida({ children, detalle = null, itemId = null }) {
  const { theme } = useTheme();
  const abierta = !!detalle;
  const resalte = `${theme.accent}1f`;
  const sel = itemId != null ? JSON.stringify(String(itemId)) : null;
  return (
    <div data-agenda-dividida={abierta ? 'si' : 'no'} style={abierta ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 46%)', gap: 14, alignItems: 'start' } : undefined}>
      <div style={{ minWidth: 0 }}>{children}</div>
      {abierta && (
        <aside style={{ position: 'sticky', top: 8, minWidth: 0, maxHeight: 'calc(100dvh - 120px)', overflowY: 'auto', WebkitOverflowScrolling: 'touch', borderLeft: `1px solid ${theme.border}`, paddingLeft: 14 }}>
          {/* La fila abierta queda marcada en la lista (FilaRapida y FilaTarea llevan su id en un data-atributo). */}
          {sel && <style>{`[data-fila-rapida=${sel}], [data-agenda-item=${sel}] { background: ${resalte} !important; }`}</style>}
          {detalle}
        </aside>
      )}
    </div>
  );
}
