// Shared utility functions for the Acteck/Balam Rush dashboard



// ─── CARGA DINÁMICA DE SheetJS ───
export function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
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


