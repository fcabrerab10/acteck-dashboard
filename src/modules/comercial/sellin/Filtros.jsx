// Adaptador delgado sobre el componente del kit (src/components/kit/Filtros.jsx).
// Desde 2026-09-13 los filtros de tabla son "un botón por grupo" (diseño B aprobado por
// Fernando): el mismo componente en todas las pantallas. Este archivo se queda para que los
// importadores de siempre (Sell In, Sell Out, Estrategia de Precios, Forecast Reservas,
// Propuestas, Tracking, Historial de cambios) no cambien: el kit ya acepta `sel` como
// sinónimo de `seleccion`.
export { default } from '../../../components/kit/Filtros';
