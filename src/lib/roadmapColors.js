/**
 * Roadmap Acteck/Balam Rush — colores oficiales y significados.
 *
 * Fuente: tabla de "Estado" del archivo Reporte 2026.xlsx que Fernando aprobó.
 * Esta es la ÚNICA fuente de verdad para los colores del roadmap. Todo el
 * dashboard debe usar esta tabla para mantener consistencia visual.
 *
 * Uso:
 *   import { roadmapStyle, roadmapInfo } from "../../lib/roadmapColors";
 *   const style = roadmapStyle(rdmp);  // { bg, color, border }
 *   const info  = roadmapInfo(rdmp);   // { label, descripcion }
 */

// Tabla maestra
export const ROADMAP_TABLE = {
  RMI: {
    bg: "#A9D18E",
    color: "#1F2937",
    descripcion:
      "Productos RunRate, seguirán teniendo continuidad en nuestro portafolio, compras y stock constante",
  },
  NVS: {
    bg: "#92D050",
    color: "#1F2937",
    descripcion: "Productos del último bloque de lanzamiento 2024 / H1 2025",
  },
  "2025": {
    bg: "#9DC3E6",
    color: "#1F2937",
    descripcion: "Productos en lanzamiento (/2025)",
  },
  "2026": {
    bg: "#1F4E79",
    color: "#FFFFFF",
    descripcion: "Productos en lanzamiento (/2026)",
  },
  EXMAY: {
    bg: "#DDEBF7",
    color: "#1F2937",
    descripcion: "Productos que serán solamente comercializados en el canal de Mayoreo",
  },
  RML: {
    bg: "#FFC000",
    color: "#1F2937",
    descripcion:
      "Productos disponibles hasta agotar existencias, no se recompran o se recompran solo para one shots",
  },
  PEM: {
    bg: "#000000",
    color: "#FFFFFF",
    descripcion: "Producto para comercialización exclusiva Marketplaces",
  },
  // Estados auxiliares (no en la tabla original pero usados en el sistema)
  D: {
    bg: "#FEE2E2",
    color: "#991B1B",
    descripcion: "Producto descontinuado",
  },
  DISC: {
    bg: "#FEE2E2",
    color: "#991B1B",
    descripcion: "Producto descontinuado",
  },
  RMS: {
    bg: "#FFC000",
    color: "#1F2937",
    descripcion: "Roadmap Local / Stock (alias de RML)",
  },
};

// Estilo default si el código no está en la tabla
const DEFAULT_STYLE = {
  bg: "#F1F5F9",
  color: "#475569",
  descripcion: null,
};

const EMPTY_STYLE = {
  bg: "#F8FAFC",
  color: "#94A3B8",
  descripcion: null,
};

/**
 * Devuelve el estilo CSS (bg + color de texto) para un código de roadmap.
 * Si no hay match, devuelve un gris discreto.
 */
export function roadmapStyle(rdmp) {
  if (!rdmp) return EMPTY_STYLE;
  const key = String(rdmp).toUpperCase().trim();
  return ROADMAP_TABLE[key] || DEFAULT_STYLE;
}

/**
 * Devuelve el código normalizado y la descripción del significado.
 */
export function roadmapInfo(rdmp) {
  if (!rdmp) return { label: "—", descripcion: null };
  const key = String(rdmp).toUpperCase().trim();
  const data = ROADMAP_TABLE[key];
  return {
    label: rdmp,
    descripcion: data?.descripcion || null,
  };
}

/**
 * Lista de roadmaps oficiales en el orden que aparece en la tabla
 * (útil para selectors, filtros y leyendas).
 */
export const ROADMAP_ORDER = ["RMI", "NVS", "2025", "2026", "EXMAY", "RML", "PEM"];
