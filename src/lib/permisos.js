/**
 * Sistema de permisos centralizado.
 *
 * Modelo de roles:
 *   - super_admin: Único con acceso a Configuración + Actualizar Datos. Edita todo.
 *   - admin:       Edita datos pero NO gestiona usuarios ni sube datos.
 *   - asistente:   Acceso según clientes/módulos asignados. Edita si puede_editar=true.
 *   - cliente:     Ve SOLO su cliente y solo las pestañas de pestanas_cliente. Read-only.
 *   - viewer:      Acceso según clientes/módulos. NUNCA edita (ignora puede_editar).
 */

/** ¿Puede ver la Configuración (gestión de usuarios)? */
export const puedeConfigurar = (perfil) => perfil?.rol === "super_admin";

/** ¿Puede subir/actualizar datos (/uploads.html)? */
export const puedeActualizarDatos = (perfil) => perfil?.rol === "super_admin";

/** ¿Puede editar datos operativos (pagos, marketing, etc)? */
export const puedeEditar = (perfil) => {
  if (!perfil) return false;
  if (perfil.rol === "super_admin" || perfil.rol === "admin") return true;
  if (perfil.rol === "viewer" || perfil.rol === "cliente") return false;
  // asistente: depende del flag
  if (perfil.rol === "asistente") return !!perfil.puede_editar;
  return false;
};

/** ¿Tiene acceso a un cliente específico? */
export const puedeVerCliente = (perfil, clienteId) => {
  if (!perfil) return false;
  if (perfil.rol === "super_admin") return true;
  const clientes = perfil.clientes || [];
  return clientes.includes(clienteId);
};

/** Lista de clientes que el usuario puede ver */
export const clientesPermitidos = (perfil, todosIds) => {
  if (!perfil) return [];
  if (perfil.rol === "super_admin") return todosIds;
  return (perfil.clientes || []).filter(c => todosIds.includes(c));
};

/** ¿Tiene acceso a un módulo global? (comercial, marketing, pnl, etc.) */
export const puedeVerModulo = (perfil, moduloId) => {
  if (!perfil) return false;
  if (perfil.rol === "super_admin") return true;
  const modulos = perfil.modulos || [];
  return modulos.includes(moduloId);
};

/** ¿Tiene acceso a una pestaña de cliente? (home, analisis, pagos, etc.) */
export const puedeVerPestana = (perfil, pestanaId) => {
  if (!perfil) return false;
  if (perfil.rol === "super_admin" || perfil.rol === "admin") return true;
  if (perfil.rol === "asistente" || perfil.rol === "viewer") return true; // ven todas las pestañas de los clientes asignados
  if (perfil.rol === "cliente") {
    const pestanas = perfil.pestanas_cliente || [];
    return pestanas.includes(pestanaId);
  }
  return false;
};

/** Lista legible de roles para UI */
export const ROLES_UI = [
  { value: "super_admin", label: "Super Admin",   desc: "Control total (tú)",                   color: "purple" },
  { value: "admin",       label: "Administrador", desc: "Edita todo pero no gestiona usuarios", color: "indigo" },
  { value: "asistente",   label: "Asistente",     desc: "Acceso operativo, edita según flag",   color: "blue"   },
  { value: "cliente",     label: "Cliente",       desc: "Solo ve su cliente, read-only",        color: "green"  },
  { value: "viewer",      label: "Viewer",        desc: "Solo lectura, sin edición",            color: "gray"   },
];
