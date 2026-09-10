// compartirArchivo.js — compartir un archivo generado en el navegador (Blob: Excel, PDF…) desde el celular.
//
//   compartirArchivo(blob, nombre, { titulo, texto }) → 'share' | 'descarga' | false
//     1) navigator.share({ files }) si el dispositivo lo soporta → hoja nativa (WhatsApp, Correo, AirDrop, Archivos…).
//        Devuelve 'share'. Si el usuario cancela la hoja → false (no se descarga nada).
//     2) Si no hay Web Share con archivos (escritorio, Android viejo, Safari < 15) → descarga con <a download>
//        y devuelve 'descarga'. Si ni eso se puede (webview sin download) → abre el archivo en una pestaña.
//   descargarBlob(blob, nombre) → true | false
//   puedeCompartirArchivos(blob, nombre) → bool (para decidir el texto del botón: "Compartir" vs "Descargar")
//
// iOS Safari: navigator.share con archivos existe desde iOS 15 y tiene que llamarse dentro del gesto del usuario
// (transient activation). Por eso los callers precargan xlsx-js-style al abrir la hoja y construyen el libro
// justo antes de llamar aquí; si el gesto expiró Safari lanza NotAllowedError y caemos a la descarga.
// En la PWA instalada en la pantalla de inicio (standalone) el share de archivos funciona desde iOS 16.4;
// en versiones anteriores la descarga abre el archivo en una vista previa con su propio botón de compartir.

const TIPO_XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

function aFile(blob, nombre) {
  const type = blob?.type || (/\.xlsx$/i.test(nombre) ? TIPO_XLSX : 'application/octet-stream');
  try { return new File([blob], nombre, { type }); } catch { return null; }
}

export function puedeCompartirArchivos(blob, nombre = 'archivo.xlsx') {
  if (typeof navigator === 'undefined' || !navigator.share || !navigator.canShare) return false;
  const f = aFile(blob || new Blob([]), nombre);
  if (!f) return false;
  try { return navigator.canShare({ files: [f] }); } catch { return false; }
}

export function descargarBlob(blob, nombre) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const soportaDownload = 'download' in a;
    a.href = url;
    if (soportaDownload) a.download = nombre;
    else { a.target = '_blank'; a.rel = 'noopener'; }
    a.style.display = 'none';
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 60_000);
    return true;
  } catch {
    return false;
  }
}

export async function compartirArchivo(blob, nombre, { titulo, texto } = {}) {
  const file = aFile(blob, nombre);
  if (file && typeof navigator !== 'undefined' && navigator.share) {
    let puede = false;
    try { puede = !navigator.canShare || navigator.canShare({ files: [file] }); } catch { puede = false; }
    if (puede) {
      try {
        await navigator.share({ files: [file], title: titulo || nombre, text: texto });
        return 'share';
      } catch (e) {
        if (e?.name === 'AbortError') return false;   // el usuario cerró la hoja
        // NotAllowedError (gesto expirado), TypeError (archivo no compartible)… → descarga
      }
    }
  }
  return descargarBlob(blob, nombre) ? 'descarga' : false;
}
