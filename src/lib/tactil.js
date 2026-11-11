// ¿Pantalla táctil? (iPhone Duo abierto, iPad). Una sola definición para todo el dashboard (2026-11-11).
// Las piezas compartidas la usan para dar objetivos de 44 px y no depender de pasar el cursor.
export const esTactil = () => { try { return typeof window !== 'undefined' && !!window.matchMedia && window.matchMedia('(pointer: coarse)').matches; } catch { return false; } };
