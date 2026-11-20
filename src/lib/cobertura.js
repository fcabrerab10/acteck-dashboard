// Semáforo de cobertura de inventario · ÚNICA implementación (2026-11-20). Puro: sin React ni red.
// Pruebas: scripts/test-cobertura.mjs.
//
// Una sola regla de decisión (`estadoCobertura`) y, por separado, lo que SÍ difiere entre pantallas y se conservó tal
// cual al fusionar: los umbrales (PERFILES) y el color/etiqueta de cada estado (TONOS_*). Cambiar un umbral o un color
// se hace aquí, en un solo lugar; unificar los perfiles entre sí es decisión de Fernando (ver la tabla del informe).
//
// Estados posibles, en el orden en que se evalúan:
//   'agotado'  → la pantalla dice que no hay stock (cada una decide con qué: `!stock`, `inv <= 0`, `dias <= 0`…).
//   'sinDato'  → no hay cobertura que medir (null; o no finita, salvo `soloNull`).
//   'critico'  → valor <  perfil.critico
//   'justo'    → valor <  perfil.justo      (sólo perfiles que tienen tramo intermedio)
//   'sobre'    → valor >  perfil.sobre      (sólo perfiles con tope alto)
//   'sano'     → lo demás

/** Umbrales por familia de pantallas. Unidad entre paréntesis. */
export const PERFILES = {
  /** Inventario global, tabla del S&OP, drill de Sell In, ficha de producto, sugeridos de Propuestas (días). */
  inventario: { critico: 30, sobre: 90 },
  /** S&OP «lo que llega» / Producto 360 · Abasto / tabla del S&OP en el celular / drill del S&OP / Resumen de clientes (días). */
  sop: { critico: 30, justo: 60 },
  /** «Días de Inv» del director en Inicio (días, global en pesos). */
  direccion: { critico: 30, sobre: 120 },
  /** Visión General · «Detalle del año» (días, global en pesos). */
  visionGeneral: { critico: 60, sobre: 120 },
  /** Producto 360 · quién lo desplaza: inventario en la cuenta (semanas). */
  cuentaSemanas: { critico: 2, sobre: 12 },
  /** Cuenta frente al resto (celular): inventario en la cuenta (semanas). */
  frenteSemanas: { justo: 4 },
};

/**
 * Estado de cobertura de un valor (días o semanas) con un perfil de umbrales.
 *   opts.agotado   boolean ya resuelto por quien llama (cada pantalla tiene su prueba de «sin stock»).
 *   opts.soloNull  true → sólo null/undefined es 'sinDato' (un valor no finito se compara tal cual).
 */
export function estadoCobertura(valor, perfil = PERFILES.inventario, { agotado = false, soloNull = false } = {}) {
  if (agotado) return 'agotado';
  if (valor == null || (!soloNull && !Number.isFinite(valor))) return 'sinDato';
  if (perfil.critico != null && valor < perfil.critico) return 'critico';
  if (perfil.justo != null && valor < perfil.justo) return 'justo';
  if (perfil.sobre != null && valor > perfil.sobre) return 'sobre';
  return 'sano';
}

/** Tono del kit por estado. Cada mapa es el de una familia de pantallas (no coinciden entre sí; se conservaron). */
export const TONOS = {
  /** Inventario: agotado y crítico en rojo, sobre-stock en naranja. */
  inventario: { agotado: 'red', sinDato: 'gray', critico: 'red', sobre: 'orange', sano: 'green', justo: 'green' },
  /** S&OP: <30 rojo, <60 naranja, lo demás verde. */
  sop: { agotado: 'red', sinDato: 'gray', critico: 'red', justo: 'orange', sano: 'green', sobre: 'green' },
  /** Dirección (Inicio, Visión General): bajo en rojo, alto en naranja. */
  direccion: { agotado: 'red', sinDato: 'gray', critico: 'red', sobre: 'orange', sano: 'green', justo: 'green' },
};
export const ETIQUETAS = {
  inventario: { agotado: 'Agotado', sinDato: 'Sin demanda', critico: 'Crítica', sobre: 'Sobre-stock', sano: 'Sana', justo: 'Sana' },
  /** Drill del S&OP (web). */
  sopDrill: { sinDato: 'sin demanda', critico: 'crítica', justo: 'tensa', sano: 'holgura sana', sobre: 'holgura sana', agotado: 'crítica' },
  visionGeneral: { sinDato: '—', critico: 'Bajo', sobre: 'Alto', sano: 'Sano', justo: 'Sano', agotado: 'Bajo' },
};

/** Atajo: tono del kit para un valor. */
export const tonoCobertura = (valor, perfil, tonos, opts) => tonos[estadoCobertura(valor, perfil, opts)];
