// Centro de notificaciones ("Centro iOS"). El chrome V3 monta CuerpoNotificaciones dentro del PanelAvatar
// (pestaña Avisos); la campana clásica sigue disponible:
//   import CentroNotificaciones, { useContadorNotificaciones } from './components/notificaciones';
//   <CentroNotificaciones onNavegar={handleNavegar} />
export { default } from './CentroNotificaciones';
export { default as CentroNotificaciones } from './CentroNotificaciones';
export { default as CuerpoNotificaciones } from './CuerpoNotificaciones';
export { default as useContadorNotificaciones } from './useContadorNotificaciones';
export { default as PreferenciasNotificaciones } from './PreferenciasNotificaciones';
export { default as Pila, FilaAlerta } from './Pila';
