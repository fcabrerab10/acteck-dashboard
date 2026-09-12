// GraficaLineasLazy · envoltorio perezoso de GraficaLineas (kit V3).
//
// Por qué: recharts 3 pesa ~405 KB (117 KB gz) con su maquinaria de redux/d3. Como
// `kit/index.js` reexporta GraficaLineas, CUALQUIER pantalla con una gráfica lo metía
// en su chunk: entrar a Inicio (la pestaña por defecto) descargaba 117 KB gz antes de
// pintar nada. Ahora la gráfica se carga aparte y la pantalla pinta de inmediato.
//
// Para que NO se note (regla "casi nativa"): en cuanto la app arranca, `prefetchGraficas()`
// pide recharts en el hueco del ralentí (requestIdleCallback). Cuando el usuario llega a
// una gráfica el módulo ya está en memoria y React la monta en el mismo frame — sin
// Suspense visible. Si aún no llegó, el hueco tiene EXACTAMENTE el alto final (y el mismo
// Panel si se pasó `titulo`), así que no hay salto de layout.
import React, { Suspense, lazy } from 'react';
import Panel from './Panel';

const Real = lazy(() => import('./GraficaLineas'));

let pedido = false;
/** Pide recharts en el ralentí (idempotente). Se llama una vez desde App.jsx al entrar. */
export function prefetchGraficas() {
  if (pedido || typeof window === 'undefined') return;
  pedido = true;
  const pedir = () => { import('./GraficaLineas').catch(() => { pedido = false; }); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(pedir, { timeout: 2500 });
  else setTimeout(pedir, 300);
}

/** Hueco del mismo alto que la gráfica final (con Panel si lleva título), para que no salte nada. */
function Hueco({ alto = 240, titulo, meta, style }) {
  const cuerpo = <div style={style}><div style={{ height: alto }} aria-hidden /></div>;
  if (!titulo) return cuerpo;
  return <Panel titulo={titulo} meta={meta}>{cuerpo}</Panel>;
}

export default function GraficaLineas(props) {
  return (
    <Suspense fallback={<Hueco alto={props.alto} titulo={props.titulo} meta={props.meta} style={props.style} />}>
      <Real {...props} />
    </Suspense>
  );
}
