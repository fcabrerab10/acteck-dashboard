// Perfil · avatar con panel (Avisos · Datos · Yo), cambio de foto ilustrada y hoja de preferencias.
//   import { PanelAvatar, abrirPanelAvatar } from './components/perfil';
//   <PanelAvatar perfil={perfil} onNavegar={onNavegar} onCerrarSesion={handleLogout} modoPresent onToggleModoPresent />
//   abrirPanelAvatar('avisos')   // desde cualquier sitio (evento 'acteck:abrir-avatar')
export { default as PanelAvatar, abrirPanelAvatar, EVENTO_AVATAR } from './PanelAvatar';
export { default as PanelPerfil } from './PanelPerfil';
export { default as PestanaYo } from './PestanaYo';
export { default as PestanaDatos } from './PestanaDatos';
export { default as CambiarFoto } from './CambiarFoto';
export { default as PreferenciasHoja } from './PreferenciasHoja';
export { AvatarImg, useAvatar, usePerfilVivo, subirSelfie, quitarAvatar } from '../../lib/avatar';
