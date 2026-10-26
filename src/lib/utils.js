// Shared utility functions for the Acteck/Balam Rush dashboard



// ─── CARGA DINÁMICA DE SheetJS ───
// SheetJS bajo demanda (2026-10-26): se usa la librería ya empaquetada (xlsx-js-style, chunk vendor-xlsx) en vez del CDN.
// Antes se leía window.XLSX del CDN; pero el chunk empaquetado, por su envoltura UMD, deja window.XLSX = {} (vacío) en cuanto
// se abre Propuestas, Inventario o una exportación, y el importador fallaba con «n.read is not a function».
let _sheetjs = null;
export function loadSheetJS() {
  if (_sheetjs) return _sheetjs;
  _sheetjs = import('xlsx-js-style').then((m) => {
    const X = m.default && typeof m.default.read === 'function' ? m.default : m;
    if (typeof X.read !== 'function') throw new Error('SheetJS no cargó (sin read)');
    try { window.XLSX = X; } catch { /* sin window */ }
    return X;
  }).catch((e) => { _sheetjs = null; throw e; });
  return _sheetjs;
}




// ─── HELPERS ─────────────────────────────────────────────────────────────────
export function formatMXN(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

export function formatUSD(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

export function formatFecha(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${meses[parseInt(m) - 1]} ${y}`;
}

export function diasRestantes(fechaStr) {
  const hoy = new Date();
  const fecha = new Date(fechaStr);
  return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
}

export function calcularSalud(kpis, pagos) {
  if (kpis.cuotaAcumulada === 0) return "verde";
  const cumplimiento = kpis.sellInAcumulado / kpis.cuotaAcumulada;
  const tieneVencidas = pagos.some(p => p.estado === "vencida");
  const diasInv = kpis.diasInventario;
  if (tieneVencidas || cumplimiento < 0.5 || diasInv > 180) return "rojo";
  if (cumplimiento < 0.80 || diasInv > 90) return "amarillo";
  return "verde";
}

// ─── COMPONENTES ─────────────────────────────────────────────────────────────


