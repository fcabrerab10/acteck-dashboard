/**
 * Sistema de permisos — modelo granular por (cliente, pestaña) + globales.
 *
 * Cada perfil tiene:
 *   - es_super_admin (bool): Fernando. Override total. Único con acceso a
 *                            Configuración y Actualizar Datos.
 *   - tipo: 'interno' | 'externo'. Informativo + controla qué secciones
 *           se ven en la UI de Configuración.
 *   - puesto: texto libre, solo informativo.
 *   - permisos (JSON):
 *       {
 *         clientes: {
 *           digitalife:   { home, analisis, estrategia, marketing, pagos, cartera },
 *           pcel:         { ... },
 *           mercadolibre: { ... }
 *         },
 *         globales: {
 *           resumen_clientes, forecast_clientes, admin_interna, configuracion
 *         }
 *       }
 *   - Cada valor es uno de: 'oculto' | 'ver' | 'edit'.
 */

// ═══ Helpers primitivos ═══

/** Nivel bruto de una pestaña de cliente: 'oculto' | 'ver' | 'edit' */
export const nivelPestanaCliente = (perfil, clienteId, pestanaId) => {
  if (!perfil) return "oculto";
  if (perfil.es_super_admin) return "edit";
  const nivel = perfil?.permisos?.clientes?.[clienteId]?.[pestanaId];
  return nivel || "oculto";
};

/** Nivel bruto de una pestaña global: 'oculto' | 'ver' | 'edit' */
export const nivelPestanaGlobal = (perfil, pestanaId) => {
  if (!perfil) return "oculto";
  if (perfil.es_super_admin) return "edit";
  const nivel = perfil?.permisos?.globales?.[pestanaId];
  return nivel || "oculto";
};

// ═══ Helpers para la UI ═══

/** ¿Puede VER una pestaña de cliente? (incluye 'ver' y 'edit') */
export const puedeVerPestanaCliente = (perfil, clienteId, pestanaId) => {
  const n = nivelPestanaCliente(perfil, clienteId, pestanaId);
  return n === "ver" || n === "edit";
};

/** ¿Puede EDITAR una pestaña de cliente? */
export const puedeEditarPestanaCliente = (perfil, clienteId, pestanaId) => {
  return nivelPestanaCliente(perfil, clienteId, pestanaId) === "edit";
};

/** ¿Puede VER una pestaña global? */
export const puedeVerPestanaGlobal = (perfil, pestanaId) => {
  const n = nivelPestanaGlobal(perfil, pestanaId);
  return n === "ver" || n === "edit";
};

/** ¿Puede EDITAR en una pestaña global? */
export const puedeEditarPestanaGlobal = (perfil, pestanaId) => {
  return nivelPestanaGlobal(perfil, pestanaId) === "edit";
};

/** ¿Tiene acceso al cliente? (cualquier pestaña de ese cliente != 'oculto') */
export const puedeVerCliente = (perfil, clienteId) => {
  if (!perfil) return false;
  if (perfil.es_super_admin) return true;
  const c = perfil?.permisos?.clientes?.[clienteId];
  if (!c) return false;
  return Object.values(c).some(v => v === "ver" || v === "edit");
};

/** Lista de clientes que el usuario puede ver (tiene al menos una pestaña no-oculta) */
export const clientesPermitidos = (perfil, todosIds) => {
  if (!perfil) return [];
  if (perfil.es_super_admin) return todosIds;
  return todosIds.filter(id => puedeVerCliente(perfil, id));
};

// ═══ Flags globales especiales ═══

/** ¿Puede ver Configuración? Solo super_admin. */
export const puedeConfigurar = (perfil) => !!perfil?.es_super_admin;

/** ¿Puede subir/actualizar datos (/uploads.html)? Solo super_admin. */
export const puedeActualizarDatos = (perfil) => !!perfil?.es_super_admin;

// ═══ Compat con código viejo (marcadas para depreciar) ═══
//
// Estos helpers existen para no romper componentes que aún no se refactoran.
// Los nuevos componentes deben usar los helpers granulares de arriba.

/**
 * @deprecated Usar puedeEditarPestanaCliente(perfil, cliente, pestana) en su lugar.
 * Mantiene compatibilidad: true si el perfil tiene AL MENOS UNA pestaña con nivel 'edit'
 * (suficiente para que componentes que usaban este flag no rompan).
 */
export const puedeEditar = (perfil) => {
  if (!perfil) return false;
  if (perfil.es_super_admin) return true;
  const p = perfil.permisos || {};
  const allValues = [
    ...Object.values(p.clientes || {}).flatMap(c => Object.values(c || {})),
    ...Object.values(p.globales || {}),
  ];
  return allValues.some(v => v === "edit");
};

/**
 * @deprecated Usar puedeVerPestanaCliente(perfil, cliente, pestana) en su lugar.
 * Compat: true si puede ver alguna pestaña del cliente (equivalente a
 * puedeVerCliente).
 */
export const puedeVerModulo = (perfil, moduloId) => {
  if (!perfil) return false;
  if (perfil.es_super_admin) return true;
  // Si el "módulo" es 'comercial', chequear si tiene cualquier cliente
  if (moduloId === "comercial") {
    return Object.values(perfil?.permisos?.clientes || {})
      .some(c => Object.values(c || {}).some(v => v === "ver" || v === "edit"));
  }
  // Para módulos no-comercial: legacy, retorna true si el campo viejo lo tiene
  return (perfil.modulos || []).includes(moduloId);
};

/**
 * @deprecated Usar puedeVerPestanaCliente(perfil, cliente, pestana) en su lugar.
 * Compat para App.jsx: recibe (perfil, pestanaId) sin cliente. Retorna true
 * si el usuario tiene esa pestaña en algún cliente.
 */
export const puedeVerPestana = (perfil, pestanaId) => {
  if (!perfil) return false;
  if (perfil.es_super_admin) return true;
  return Object.values(perfil?.permisos?.clientes || {})
    .some(c => { const n = c?.[pestanaId]; return n === "ver" || n === "edit"; });
};

// ═══ Catálogos para UI ═══

/** Tipos de usuario — reemplaza al viejo 'rol'. */
export const TIPOS_USUARIO = [
  { value: "interno", label: "Interno",  desc: "Equipo de Acteck. Puede ver pestañas globales.", color: "blue"  },
  { value: "externo", label: "Externo",  desc: "Empleado del cliente. Solo ve lo que le asignes.", color: "green" },
];

/** Niveles de permiso por pestaña. */
export const NIVELES_PERMISO = [
  { value: "oculto", label: "Ocultar",  desc: "No aparece en el menú. Ni sabe que existe.", color: "gray"  },
  { value: "ver",    label: "Ver",      desc: "La ve pero no puede modificar nada.",        color: "blue"  },
  { value: "edit",   label: "Editar",   desc: "Ve y puede crear/modificar/borrar datos.",   color: "green" },
];

/** Pestañas de cliente (aplican a Digitalife/PCEL/ML). */
export const PESTANAS_CLIENTE = [
  { id: "home",       label: "Resumen",               desc: "Dashboard inicial con KPIs" },
  { id: "analisis",   label: "Análisis",              desc: "Ventas, tendencias, gráficas" },
  { id: "estrategia", label: "Estrategia de Producto", desc: "Sugerido de compra, SKUs en riesgo" },
  { id: "marketing",  label: "Marketing",             desc: "Actividades de marketing del cliente" },
  { id: "pagos",      label: "Pagos",                 desc: "Promociones, rebate, SPIFF, pagos fijos" },
  { id: "cartera",    label: "Crédito y Cobranza",    desc: "Cartera, aging, DSO" },
];

/** Pestañas globales (solo para internos). */
export const PESTANAS_GLOBALES = [
  { id: "resumen_clientes",   label: "Resumen de Clientes",   desc: "Dashboard consolidado de los 3 clientes" },
  { id: "forecast_clientes",  label: "Forecast Clientes",     desc: "Planeación de compras cross-cliente" },
  { id: "ordenes_compra",     label: "Órdenes de Compra",     desc: "Gestión de OCs, fill rate y cruce con ERP" },
  { id: "admin_interna",      label: "Administración Interna", desc: "Pendientes & Calendario del equipo" },
  { id: "evaluaciones",       label: "Evaluaciones",          desc: "Evaluación de desempeño semanal y bono" },
  { id: "axon_mexico",        label: "Axon de México",        desc: "Nueva empresa para gestión de e-commerce" },
  { id: "configuracion",      label: "Configuración",          desc: "Gestión de usuarios (⚠️ solo super admin)" },
];

/** Clientes del sistema. */
export const CLIENTES = [
  { id: "digitalife",   label: "Digitalife" },
  { id: "pcel",         label: "PCEL" },
  { id: "mercadolibre", label: "Mercado Libre" },
];

// @deprecated Mantener para compat con UI vieja que aún referencia ROLES_UI
export const ROLES_UI = [
  { value: "super_admin", label: "Super Admin",   desc: "Control total",                        color: "purple" },
  { value: "admin",       label: "Administrador", desc: "Edita todo pero no gestiona usuarios", color: "indigo" },
  { value: "asistente",   label: "Asistente",     desc: "Acceso operativo",                     color: "blue"   },
  { value: "cliente",     label: "Cliente",       desc: "Solo ve su cliente, read-only",        color: "green"  },
  { value: "viewer",      label: "Viewer",        desc: "Solo lectura",                         color: "gray"   },
];
