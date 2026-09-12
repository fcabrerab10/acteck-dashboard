// Árbol de navegación · única fuente para los tres modos de menú (Barra · Sidebar · iPhone) y la paleta ⌘K.
//
// Nodo: { id, label, icon (lucide), tipo: 'global'|'cliente'|'enlace', clienteKey?, pagina, color?, grupo, hint?, disabled?, href? }
//   - id global  = pagina                 → 'visionGeneral'
//   - id cliente = `${clienteKey}:${pagina}` → 'digitalife:sellIn'
// Grupo: { id, label, icon, color, nodos: [...], clientes?: [{ key, label, color, nodos }] }
//
// construirArbol(perfil) devuelve sólo lo que ese perfil puede ver (mismas reglas que
// usa App.jsx para bloquear pantallas: puedeVerPaginaGlobal / puedeVerPestanaCliente).
import {
  Home, LayoutGrid, Calculator, Activity, PieChart, ShoppingCart, ShoppingBag, Boxes, HandCoins, Target,
  BarChart3, ClipboardList, TrendingUp, FileCheck, Megaphone, Wallet, CreditCard, History, Building2,
  Shield, Users, Briefcase, Landmark, Store, CalendarCheck,
} from 'lucide-react';
import { puedeVerPaginaGlobal, puedeVerCliente, puedeVerPestanaCliente } from '../../lib/permisos';

// ─── Clientes propios ───
export const CLIENTES_NAV = {
  digitalife: { key: 'digitalife', label: 'Digitalife', marca: 'Acteck / Balam Rush', color: '#FF3B30' },
  pcel:       { key: 'pcel',       label: 'PCEL',       marca: 'Acteck',              color: '#FF9500' },
  dicotech:   { key: 'dicotech',   label: 'Dicotech',   marca: 'Acteck / Balam Rush', color: '#0EA5E9' },
};
export const CLIENTES_ORDEN = ['digitalife', 'pcel', 'dicotech'];

const PESTANAS_CLIENTE = [
  { pagina: 'home',       label: 'Resumen',            icon: Home },
  { pagina: 'sellIn',     label: 'Sell In',            icon: ShoppingCart },
  { pagina: 'estrategia', label: 'Sell Out',           icon: ShoppingBag },
  { pagina: 'marketing',  label: 'Marketing',          icon: Megaphone },
  { pagina: 'pagos',      label: 'Pagos',              icon: Wallet },
  { pagina: 'cartera',    label: 'Crédito y Cobranza', icon: CreditCard },
];
// Pestañas deshabilitadas por cliente (se muestran atenuadas con hint).
const DESHABILITADAS = { pcel: { marketing: 'Pronto' } };

// ─── Grupos ───
// `color` se usa para los iconos de app en el modo iPhone y para acentos sutiles.
const GRUPOS_BASE = [
  {
    id: 'inicio', label: 'Inicio', icon: LayoutGrid, color: '#007AFF',
    nodos: [
      { pagina: 'inicio', label: 'Inicio', icon: LayoutGrid },
      { pagina: 'agenda', label: 'Agenda', icon: CalendarCheck }, // V3 · tareas, reuniones con minuta y calendario (sustituye a Pendientes & Calendario)
    ],
  },
  {
    id: 'direccionGeneral', label: 'Dirección General', icon: Landmark, color: '#5856D6',
    nodos: [
      { pagina: 'estadoResultados', label: 'Estado de Resultados', icon: Calculator, soloWeb: true }, // Fernando: no relevante en el celular
    ],
  },
  {
    id: 'direccionComercial', label: 'Dirección Comercial', icon: Briefcase, color: '#007AFF',
    nodos: [
      { pagina: 'visionGeneral',    label: 'Visión General',       icon: Activity },
      { pagina: 'analisisClientes', label: 'Análisis por Cliente', icon: PieChart },
      { pagina: 'sellIn',           label: 'Sell In',              icon: ShoppingCart },
      { pagina: 'sellOut',          label: 'Sell Out',             icon: ShoppingBag },
      { pagina: 'inventarioGlobal', label: 'Inventario',           icon: Boxes },
      { pagina: 'cobranzaGlobal',   label: 'Cobranza',             icon: HandCoins },
      { pagina: 'forecastClientes', label: 'S&OP',                 icon: Target },
    ],
  },
  {
    id: 'clientesPropios', label: 'Clientes propios', icon: Users, color: '#34C759',
    nodos: [
      { pagina: 'resumenClientes',   label: 'Resumen de Clientes',   icon: BarChart3 },
      // Pagos V3 · una sola pantalla para los tres clientes; se ve si el perfil ve `pagos` de al menos un cliente.
      { pagina: 'pagos',             label: 'Pagos',                 icon: Wallet,
        ver: (perfil) => CLIENTES_ORDEN.some((k) => puedeVerPestanaCliente(perfil, k, 'pagos')) },
      { pagina: 'propuestas',        label: 'Propuestas',            icon: ClipboardList },
      { pagina: 'estrategiaPrecios', label: 'Estrategia de Precios', icon: TrendingUp },
      { pagina: 'forecastReservas',  label: 'Forecast',              icon: Target },
      { pagina: 'ordenesCompra',     label: 'Tracking Pedidos',      icon: FileCheck },
    ],
    clientes: true,
  },
  {
    id: 'interno', label: 'Interno', icon: Building2, color: '#AF52DE',
    nodos: [
      { pagina: 'telemetria',       label: 'Actividad del equipo',    icon: Activity },
      { pagina: 'historialCambios', label: 'Historial de cambios',    icon: History },
      // Administración (usuarios y permisos · datos · notificaciones del equipo · sistema). Sólo super admin;
      // el importador central se abre desde Administración → Datos (y desde el avatar → Datos), no repite nodo.
      { pagina: 'configuracion',    label: 'Administración',          icon: Shield },
    ],
  },
  {
    id: 'axon', label: 'Axon', icon: Store, color: '#FF9500',
    nodos: [
      { pagina: 'axonMexico', label: 'Axon de México', icon: Store },
    ],
  },
];

export const idNodo = (clienteKey, pagina) => (clienteKey ? `${clienteKey}:${pagina}` : pagina);

/** Árbol filtrado por permisos. */
export function construirArbol(perfil, { movil = false } = {}) {
  if (!perfil) return [];
  const grupos = [];
  for (const g of GRUPOS_BASE) {
    const nodos = g.nodos
      .filter((n) => !(movil && n.soloWeb))
      .filter((n) => (typeof n.ver === 'function'
        ? n.ver(perfil)
        : (n.tipo === 'enlace' ? !!perfil.es_super_admin : puedeVerPaginaGlobal(perfil, n.pagina))))
      .map((n) => ({ ...n, id: n.pagina, tipo: n.tipo || 'global', clienteKey: null, grupo: g.id, grupoLabel: g.label, color: g.color }));
    let clientes = [];
    if (g.clientes) {
      clientes = CLIENTES_ORDEN
        .filter((k) => puedeVerCliente(perfil, k))
        .map((k) => {
          const c = CLIENTES_NAV[k];
          const pest = PESTANAS_CLIENTE
            .filter((p) => puedeVerPestanaCliente(perfil, k, p.pagina))
            .map((p) => ({
              ...p, id: idNodo(k, p.pagina), tipo: 'cliente', clienteKey: k, grupo: g.id, grupoLabel: c.label,
              color: c.color, hint: DESHABILITADAS[k]?.[p.pagina], disabled: !!DESHABILITADAS[k]?.[p.pagina],
            }));
          return { ...c, nodos: pest };
        })
        .filter((c) => c.nodos.length > 0);
    }
    if (nodos.length === 0 && clientes.length === 0) continue;
    grupos.push({ ...g, nodos, clientes });
  }
  return grupos;
}

/** Lista plana de todos los nodos navegables del árbol (globales + de cliente). */
export function nodosPlanos(arbol) {
  const out = [];
  for (const g of arbol) {
    out.push(...g.nodos);
    for (const c of g.clientes || []) out.push(...c.nodos);
  }
  return out;
}

export function buscarNodo(arbol, id) {
  return nodosPlanos(arbol).find((n) => n.id === id) || null;
}

/** ¿Este nodo es el activo? (vistaActual === 'configuracion' manda sobre paginaActiva). */
export function esNodoActivo(nodo, { clienteActivo, paginaActiva, vistaActual }) {
  if (!nodo) return false;
  if (vistaActual === 'configuracion') return nodo.pagina === 'configuracion';
  if (nodo.tipo === 'cliente') return clienteActivo === nodo.clienteKey && paginaActiva === nodo.pagina;
  if (nodo.tipo === 'global') return !clienteActivo && paginaActiva === nodo.pagina;
  return false;
}

/** id del nodo activo (para marcar favoritos, etc.) */
export function idActivo({ clienteActivo, paginaActiva, vistaActual }) {
  if (vistaActual === 'configuracion') return 'configuracion';
  return idNodo(clienteActivo, paginaActiva);
}

/** Favoritos resueltos contra el árbol (descarta ids que ya no existen / no tiene permiso). */
export function resolverFavoritos(arbol, favoritos) {
  const mapa = new Map(nodosPlanos(arbol).map((n) => [n.id, n]));
  return (favoritos || []).map((id) => mapa.get(id)).filter(Boolean);
}

/** Etiqueta con contexto: "Digitalife · Sell In" o "Visión General". */
export function etiquetaNodo(nodo) {
  if (!nodo) return '';
  return nodo.tipo === 'cliente' ? `${CLIENTES_NAV[nodo.clienteKey]?.label || nodo.clienteKey} · ${nodo.label}` : nodo.label;
}

/** Navega según el tipo de nodo. */
export function irANodo(nodo, onNavegar) {
  if (!nodo || nodo.disabled) return;
  if (nodo.tipo === 'enlace') { window.location.href = nodo.href; return; }
  onNavegar?.(nodo.clienteKey || null, nodo.pagina);
}
