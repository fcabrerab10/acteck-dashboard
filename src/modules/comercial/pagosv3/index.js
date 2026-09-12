// Pagos V3 · barril del módulo. La pantalla se importa directo (React.lazy en App.jsx):
// desde aquí sólo salen las piezas puras que reutilizan el cron, el móvil y los tests.
export { default as motor } from './motor';
export * from './motor';
export * from './reglas';
export * from './estados';
export * from './correo';
export * from './leerNotaCredito';
export { SIL_PAGOS, SIL_PAGOS_DRILL, SIL_MOVIL_PAGOS } from './siluetas';
