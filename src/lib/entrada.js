// Entrada al dashboard (3.68.0 · 2026-10-04). Elegido por Fernando en el prototipo «Entrada Acteck»:
//   · Arranque en frío: «acteck.» con el punto azul latiendo sobre el fondo del tema (componente Arranque).
//   · Al entrar (desde el login o con sesión ya iniciada) las tarjetas entran «cada una por su lado» y más
//     despacio que una navegación normal: barra lateral desde la izquierda, hero desde arriba, KPIs y paneles
//     uno a uno. Lo pinta `src/index.css` mientras <html data-entrada> esté puesto (ver iniciarEntrada).
//   · Último usuario: el login es una pantalla de bloqueo (avatar + nombre + contraseña); recuerda quién entró
//     la última vez en este navegador para no pedir el correo otra vez.
import { reduceMotion } from './motion';

export const ENTRADA_MS = 2600; // ventana en la que las animaciones de entrada sustituyen a las normales
const LS_ULTIMO = 'acteck_ultimo_usuario_v1';

export function iniciarEntrada() {
  if (typeof document === 'undefined' || reduceMotion()) return;
  const r = document.documentElement;
  r.setAttribute('data-entrada', '1');
  clearTimeout(iniciarEntrada._t);
  iniciarEntrada._t = setTimeout(() => r.removeAttribute('data-entrada'), ENTRADA_MS);
}

export function leerUltimoUsuario() {
  try {
    const u = JSON.parse(localStorage.getItem(LS_ULTIMO) || 'null');
    return u && u.email ? u : null;
  } catch { return null; }
}

export function guardarUltimoUsuario(perfil, email) {
  const correo = email || perfil?.email;
  if (!correo) return;
  try {
    localStorage.setItem(LS_ULTIMO, JSON.stringify({ email: correo, nombre: perfil?.nombre || '', avatar_url: perfil?.avatar_url || null }));
  } catch { /* privado */ }
}

export function olvidarUltimoUsuario() {
  try { localStorage.removeItem(LS_ULTIMO); } catch { /* privado */ }
}
