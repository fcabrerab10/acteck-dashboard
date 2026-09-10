// Parsers de las fuentes MANUALES del importador central (Configuración →
// Actualización de datos). Fuente de verdad: este directorio; public/uploads.html
// conserva copias como respaldo técnico.
//
// Contrato: parser(wb, fileName, opts) → job | job[]
//   job = { table, onConflict, rows, replace?, deleteAnios?, deletePeriodos?, deleteCliente?, recalc?, resumen }
//       | { endpoint, body, filas, resumen }           (fuentes con endpoint propio, p. ej. estados de cuenta)
// El workbook se obtiene con leerWorkbook(file) (carga SheetJS bajo demanda).
export { leerWorkbook } from './_util';
export { default as roadmap } from './roadmap';
export { default as estadosResultados } from './estadosResultados';
export { selloutGeneral, revkoSellout } from './selloutGeneral';
export { digitalifeSellout, digitalifeInv } from './digitalife';
export { default as pcelVentaMarca } from './pcel';
export { dicotechSelloutSemanal, dicotechInventario } from './dicotech';
export { default as estadoCuenta } from './estadoCuenta';
