// Sólo desarrollo local (`npm run dev`): `?maqueta=duo` hace que la página se crea táctil, para revisar el iPhone Duo
// abierto (modo «plegable») en un navegador de escritorio. En producción no hace nada (import.meta.env.DEV = false).
if (import.meta.env.DEV && typeof window !== 'undefined' && !!window.location && new URLSearchParams(window.location.search || '').get('maqueta') === 'duo' && window.matchMedia) {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) => {
    const m = real(q);
    if (!/pointer:\s*coarse/.test(q)) return m;
    return { matches: true, media: q, onchange: null, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}, dispatchEvent() { return false; } };
  };
  document.documentElement.classList.add('maqueta-tactil');
  // La pantalla física «es» el área visible, como en el plegable (si no, un monitor grande descarta el modo plegable).
  try { Object.defineProperty(window, 'screen', { configurable: true, get: () => ({ width: window.innerWidth, height: window.innerHeight, availWidth: window.innerWidth, availHeight: window.innerHeight, orientation: { type: window.innerWidth >= window.innerHeight ? 'landscape-primary' : 'portrait-primary', addEventListener() {}, removeEventListener() {} } }) }); } catch { /* sin override */ }
}
