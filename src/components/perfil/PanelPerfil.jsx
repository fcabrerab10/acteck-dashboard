// PanelPerfil · compat. Desde el chrome V3 (2026-09-11) el avatar de la pastilla es PanelAvatar
// (Avisos · Datos · Yo); lo que antes vivía aquí (tema, menú, densidad, favoritos, preferencias,
// administración, cerrar sesión) es la pestaña "Yo" (./PestanaYo.jsx). Este archivo sólo reexporta
// para que no haya dos paneles distintos montados.
export { default } from './PanelAvatar';
