import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from './lib/supabase';

// ─── DATOS REALES — DIGITALIFE (API GLOBAL) ───────────────────────────────────
// Fuentes: Vw_TablaH_Ventas (Sell In), BD Sellout (Sell Out), BD Inventario
// Actualizado: 2026-04-07
const DIGITALIFE_REAL = {
  // Sell In 2026 por mes (desde Vw_TablaH_Ventas → API GLOBAL)
  sellIn: { 1: 80437.84, 2: 3986509.45, 3: 491098.50 },
  // Sell Out 2026 por mes (desde BD Sellout)
  sellOut: { 1: 1904705.28, 2: 1575772.46, 3: 1702411.72 },
  // Cuotas mensuales (desde pestaña 2026 — objetivo 30M, mínimo 25M)
  cuota30M: { 1:2502665.97, 2:2421385.87, 3:2287315.71, 4:1619770.63, 5:2112348.18, 6:2071317.14, 7:2757009.45, 8:2740078.67, 9:2803455.11, 10:2974335.88, 11:2913008.38, 12:2797308.99 },
  cuota25M: { 1:2085554.97, 2:2017821.56, 3:1906096.43, 4:1349808.86, 5:1760290.15, 6:1726097.61, 7:2297507.88, 8:2283398.89, 9:2336212.59, 10:2478613.23, 11:2427506.99, 12:2331090.83 },
  // Inventario del cliente (BD Inventario)
  inventarioPiezas: 8614,
  inventarioValor: 6612493.03,
  diasInventario: 154,
  // Histórico 2025
  hist2025: { sellIn: 15755483, sellOut: 15606924, cuota: 12270000 },
  // Sell Out por marca 2026
  sellOutMarca: { "ACTECK": 2556451.42, "BALAM RUSH": 2626438.04 },
};

// ─── DATOS REALES — CRÉDITO Y COBRANZA DIGITALIFE (API GLOBAL) ───────────────
// Fuente: correo "Estado de cuenta" enviado cada lunes desde intranet@acteck.com
// Se actualiza automáticamente cada lunes a las 4pm
const CARTERA_DIGITALIFE = {
  semana: 15,
  periodo: "2026-04-06 al 2026-04-12",
  saldoActual: 6884832.74,
  saldoVencido: 196678.56,
  saldoNC: -67210.44,
  saldoAVencer: 0.00,
  ultimaActualizacion: "2026-04-07",
  horaActualizacion: "16:00",
  correoSemana: "Estado de cuenta de la Semana 15 Del 2026-04-06 al 2026-04-12",

  // ── Línea de crédito ──
  lineaCreditoUSD: 500000,
  tipoCambio: 17.76,    // MXN/USD — Banxico 07-Abr-2026
  // lineaCreditoMXN = 500,000 × 17.76 = 8,880,000

  // ── Aging de facturas (suma = saldoActual) ──
  aging: {
    d0_30:  5500000.00,   // vigentes — vencen en ≤ 30 días
    d31_60: 1188154.18,   // vigentes — vencen en 31-60 días
    d61_90: 100000.00,    // vencidos recientes
    mas90:  96678.56,     // vencidos críticos (+90 días)
  },

  // ── Vencimientos por mes (calendario de cobranza) ──
  vencimientosMes: {
    "2026-04": 2100000.00,
    "2026-05": 3200000.00,
    "2026-06": 1584832.74,
  },

  // ── DSO (Days Sales Outstanding) ──
  dso: 65,  // días promedio de cobro — histórico cliente
};

// ─── DATOS — PAGOS Y COMPROMISOS DIGITALIFE 2026 ─────────────────────────────
// Categorías: Promociones, Plan de Marketing, Pagos Fijos, Pagos Variables
// Campos: Folio, Concepto, Monto, Estatus, Fecha Compromiso, Fecha Pago Real, Responsable, Notas
const PAGOS_DIGITALIFE_2026 = {
  categorias: {
    promociones: {
      label: "Promociones",
      icono: "🎯",
      color: "#E31E26",
      presupuesto: null, // Por definir
      items: [
        { folio: "PRO-001", concepto: "Campaña Madre Mayo", monto: 15000, estatus: "pendiente", fechaCompromiso: "2026-05-01", fechaPagoReal: null, responsable: "Marketing", notas: "Aportación Acteck. Cliente aporta $8,000 adicionales." },
        { folio: "PRO-002", concepto: "Bundle Auriculares Q2", monto: 10000, estatus: "pendiente", fechaCompromiso: "2026-04-10", fechaPagoReal: null, responsable: "Marketing", notas: "Aportación Acteck. Cliente aporta $5,000 adicionales." },
      ],
    },
    marketing: {
      label: "Plan de Marketing",
      icono: "📣",
      color: "#3b82f6",
      presupuesto: null, // Por definir
      items: [
        { folio: "MKT-001", concepto: "Material POP Q2", monto: 0, estatus: "pendiente", fechaCompromiso: null, fechaPagoReal: null, responsable: "Marketing", notas: "Monto y fecha por definir." },
        { folio: "MKT-002", concepto: "Activación punto de venta", monto: 0, estatus: "pendiente", fechaCompromiso: null, fechaPagoReal: null, responsable: "Fernando", notas: "Monto y fecha por definir." },
      ],
    },
    pagosFijos: {
      label: "Pagos Fijos",
      icono: "🏢",
      color: "#8b5cf6",
      presupuesto: null, // Por definir
      items: [
        { folio: "GF-001", concepto: "Cuota mensual exhibidor — Abril", monto: 0, estatus: "pendiente", fechaCompromiso: "2026-04-30", fechaPagoReal: null, responsable: "Fernando", notas: "Recurrente mensual. Monto por confirmar." },
        { folio: "GF-002", concepto: "Cuota mensual exhibidor — Mayo", monto: 0, estatus: "pendiente", fechaCompromiso: "2026-05-31", fechaPagoReal: null, responsable: "Fernando", notas: "Recurrente mensual. Monto por confirmar." },
      ],
    },
    pagosVariables: {
      label: "Pagos Variables",
      icono: "📊",
      color: "#f59e0b",
      presupuesto: null, // Por definir
      items: [
        { folio: "GV-001", concepto: "Evento lanzamiento producto Q2", monto: 0, estatus: "pendiente", fechaCompromiso: null, fechaPagoReal: null, responsable: "Fernando", notas: "Monto y fecha por definir según agenda." },
      ],
    },
  },
};

// Último mes con datos de Sell In
const ULTIMO_MES_SI = 3; // Marzo
const NOMBRES_MES = { 1:"Enero",2:"Febrero",3:"Marzo",4:"Abril",5:"Mayo",6:"Junio",7:"Julio",8:"Agosto",9:"Septiembre",10:"Octubre",11:"Noviembre",12:"Diciembre" };

// ─── CARGA DINÁMICA DE SheetJS ───
function loadSheetJS() {
  return new Promise((resolve, reject) => {
    if (window.XLSX) return resolve(window.XLSX);
    const s = document.createElement("script");
    s.src = "https://cdn.sheetjs.com/xlsx-0.20.3/package/dist/xlsx.full.min.js";
    s.onload = () => resolve(window.XLSX);
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

const clientes = {
  digitalife: {
    nombre: "Digitalife",
    marca: "Acteck / Balam Rush",
    ejecutivo: "Fernando Cabrera",
    frecuencia: "Semanal",
    color: "#E31E26",
    cuotaAnual: 30000000,
    // KPIs calculados desde datos reales
    kpis: {
      sellInMes: DIGITALIFE_REAL.sellIn[ULTIMO_MES_SI],
      cuotaMes: DIGITALIFE_REAL.cuota30M[ULTIMO_MES_SI],
      cuotaMes25M: DIGITALIFE_REAL.cuota25M[ULTIMO_MES_SI],
      sellInAcumulado: Object.values(DIGITALIFE_REAL.sellIn).reduce((a,b)=>a+b,0),
      cuotaAcumulada: Object.entries(DIGITALIFE_REAL.cuota30M).filter(([m])=>parseInt(m)<=ULTIMO_MES_SI).reduce((a,[,v])=>a+v,0),
      sellOut: DIGITALIFE_REAL.sellOut[ULTIMO_MES_SI],
      sellOutAcumulado: Object.values(DIGITALIFE_REAL.sellOut).reduce((a,b)=>a+b,0),
      diasInventario: DIGITALIFE_REAL.diasInventario,
      inventarioValor: DIGITALIFE_REAL.inventarioValor,
      ultimoMes: NOMBRES_MES[ULTIMO_MES_SI],
    },
    tendencia: Object.entries(DIGITALIFE_REAL.sellIn).map(([m,si])=>({
      mes: NOMBRES_MES[parseInt(m)].slice(0,3),
      sellIn: si,
      sellOut: DIGITALIFE_REAL.sellOut[m] || 0,
      cuota: DIGITALIFE_REAL.cuota30M[m] || 0,
    })),
    pendientes: [
      { id: 1, tarea: "Enviar propuesta de planograma Q2", responsable: "Fernando", fecha: "2026-04-10", estado: "pendiente" },
      { id: 2, tarea: "Confirmar entrega de pedido #4821", responsable: "Logística", fecha: "2026-04-08", estado: "en proceso" },
      { id: 3, tarea: "Armar materiales para campaña Mayo", responsable: "Marketing", fecha: "2026-04-15", estado: "pendiente" },
    ],
    pagos: [
      { id: 1, factura: "FAC-2026-0312", monto: 85000, vencimiento: "2026-04-09", estado: "vencida" },
      { id: 2, factura: "FAC-2026-0341", monto: 120000, vencimiento: "2026-04-20", estado: "por vencer" },
      { id: 3, factura: "FAC-2026-0358", monto: 95000, vencimiento: "2026-05-05", estado: "vigente" },
    ],
    promocionesActivas: [
      { id: 1, nombre: "Campaña Madre Mayo", aportacionActeck: 15000, aportacionCliente: 8000, vigencia: "01 May – 15 May 2026" },
      { id: 2, nombre: "Bundle Auriculares Q2", aportacionActeck: 10000, aportacionCliente: 5000, vigencia: "10 Abr – 30 Abr 2026" },
    ],
    minuta: {
      fechaReunion: "2026-04-01",
      proximaReunion: "2026-04-08",
      asistentes: ["Fernando Cabrera", "Ana López (Digitalife)", "Carlos Ruiz (Digitalife)"],
      acuerdos: [
        { id: 1, descripcion: "Confirmar cuota Q2 con dirección comercial", responsable: "Fernando", fechaCompromiso: "2026-04-05", fechaCumplimiento: "2026-04-04", cumplido: true },
        { id: 2, descripcion: "Digitalife envía sell out de Marzo completo", responsable: "Ana López", fechaCompromiso: "2026-04-05", fechaCumplimiento: null, cumplido: false },
        { id: 3, descripcion: "Propuesta de exhibidores para nueva tienda CDMX", responsable: "Fernando", fechaCompromiso: "2026-04-10", fechaCumplimiento: null, cumplido: false },
      ],
    },
    cartera: CARTERA_DIGITALIFE,
  },
  pcel: {
    nombre: "PCEL",
    marca: "Balam Rush",
    ejecutivo: "Fernando Cabrera",
    frecuencia: "Mensual",
    color: "#1A3A8F",
    cuotaAnual: 2400000,
    kpis: {
      sellInMes: 195000,
      cuotaMes: 200000,
      sellOut: 160000,
      diasInventario: 35,
    },
    pendientes: [
      { id: 1, tarea: "Revisión de portafolio Balam Rush Q2", responsable: "Fernando", fecha: "2026-04-20", estado: "pendiente" },
      { id: 2, tarea: "Cotización de material POP para PCEL Monterrey", responsable: "Marketing", fecha: "2026-04-18", estado: "en proceso" },
    ],
    pagos: [
      { id: 1, factura: "FAC-2026-0299", monto: 60000, vencimiento: "2026-04-12", estado: "por vencer" },
      { id: 2, factura: "FAC-2026-0315", monto: 75000, vencimiento: "2026-04-30", estado: "vigente" },
    ],
    promocionesActivas: [
      { id: 1, nombre: "Promo Teclados Mayo", aportacionActeck: 8000, aportacionCliente: 4000, vigencia: "01 May – 31 May 2026" },
    ],
    minuta: {
      fechaReunion: "2026-03-15",
      proximaReunion: "2026-04-15",
      asistentes: ["Fernando Cabrera", "Roberto Méndez (PCEL)"],
      acuerdos: [
        { id: 1, descripcion: "PCEL compartir reporte de ventas por SKU Marzo", responsable: "Roberto Méndez", fechaCompromiso: "2026-03-25", fechaCumplimiento: "2026-03-27", cumplido: true },
        { id: 2, descripcion: "Definir mix de productos para temporada calor", responsable: "Fernando", fechaCompromiso: "2026-04-10", fechaCumplimiento: null, cumplido: false },
      ],
    },
  },
  mercadolibre: {
    nombre: "Mercado Libre",
    marca: "Acteck / Balam Rush",
    ejecutivo: "Por asignar",
    frecuencia: "Semanal",
    color: "#FFE600",
    cuotaAnual: 0,
    kpis: {
      sellInMes: 0,
      cuotaMes: 0,
      cuotaMes25M: 0,
      sellInAcumulado: 0,
      cuotaAcumulada: 0,
      sellOut: 0,
      sellOutAcumulado: 0,
      diasInventario: 0,
      inventarioValor: 0,
      inventarioPiezas: 0,
      ultimoMes: "---",
    },
    tendencia: { sellIn: [0], sellOut: [0], cuota: [0] },
    pendientes: [],
    pagos: [],
    promocionesActivas: [],
    cartera: null,
    sellOutMarca: {},
    minuta: {
      fechaReunion: "",
      proximaReunion: "",
      asistentes: [],
      acuerdos: [],
    },
  },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function formatMXN(n) {
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n);
}

function formatUSD(n) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

function formatFecha(str) {
  if (!str) return "—";
  const [y, m, d] = str.split("-");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  return `${d} ${meses[parseInt(m) - 1]} ${y}`;
}

function diasRestantes(fechaStr) {
  const hoy = new Date();
  const fecha = new Date(fechaStr);
  return Math.ceil((fecha - hoy) / (1000 * 60 * 60 * 24));
}

function calcularSalud(kpis, pagos) {
  const cumplimiento = kpis.sellInAcumulado / kpis.cuotaAcumulada;
  const tieneVencidas = pagos.some(p => p.estado === "vencida");
  const diasInv = kpis.diasInventario;
  if (tieneVencidas || cumplimiento < 0.5 || diasInv > 180) return "rojo";
  if (cumplimiento < 0.80 || diasInv > 90) return "amarillo";
  return "verde";
}

// ─── COMPONENTES ─────────────────────────────────────────────────────────────

function Semaforo({ estado }) {
  const config = {
    verde:    { bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500",  label: "Saludable" },
    amarillo: { bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400", label: "Atención" },
    rojo:     { bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500",    label: "Crítico" },
  };
  const c = config[estado];
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${c.bg} ${c.text}`}>
      <span className={`w-2 h-2 rounded-full ${c.dot}`}></span>
      {c.label}
    </span>
  );
}

function KPICard({ label, valor, sub, color, alerta }) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm p-5 border-t-4`} style={{ borderColor: color }}>
      <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-800">{valor}</p>
      {sub && <p className={`text-xs mt-1 ${alerta ? "text-red-500 font-semibold" : "text-gray-400"}`}>{sub}</p>}
    </div>
  );
}

function CardHeader({ titulo, icono }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <span className="text-lg">{icono}</span>
      <h3 className="font-bold text-gray-700 text-base">{titulo}</h3>
    </div>
  );
}

function TarjetaPendientes({ pendientes }) {
  const colores = {
    "pendiente":  "bg-gray-100 text-gray-600",
    "en proceso": "bg-blue-100 text-blue-700",
    "completado": "bg-green-100 text-green-700",
  };
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Pendientes" icono="📋" />
      <div className="space-y-3">
        {pendientes.map(p => (
          <div key={p.id} className="flex items-start justify-between gap-3 text-sm">
            <div className="flex-1">
              <p className="text-gray-800 font-medium leading-snug">{p.tarea}</p>
              <p className="text-gray-400 text-xs mt-0.5">{p.responsable} · {formatFecha(p.fecha)}</p>
            </div>
            <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium ${colores[p.estado]}`}>
              {p.estado}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TarjetaPagos({ pagos }) {
  const colores = {
    "vencida":    { bg: "bg-red-100",    text: "text-red-700",    icon: "⚠️" },
    "por vencer": { bg: "bg-yellow-100", text: "text-yellow-700", icon: "🕐" },
    "vigente":    { bg: "bg-green-100",  text: "text-green-700",  icon: "✅" },
  };
  const total = pagos.reduce((s, p) => s + p.monto, 0);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Pagos Pendientes" icono="💳" />
      <div className="space-y-3 mb-4">
        {pagos.map(p => {
          const c = colores[p.estado];
          const dias = diasRestantes(p.vencimiento);
          return (
            <div key={p.id} className="flex items-center justify-between text-sm">
              <div>
                <p className="text-gray-700 font-medium">{p.factura}</p>
                <p className="text-gray-400 text-xs">Vence: {formatFecha(p.vencimiento)}
                  {p.estado === "vencida" ? <span className="text-red-500 font-semibold"> · Vencida hace {Math.abs(dias)} días</span>
                  : p.estado === "por vencer" ? <span className="text-yellow-600 font-semibold"> · {dias} días</span>
                  : null}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold text-gray-800">{formatMXN(p.monto)}</p>
                <span className={`text-xs px-2 py-0.5 rounded-full ${c.bg} ${c.text}`}>{c.icon} {p.estado}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="border-t pt-3 flex justify-between items-center">
        <span className="text-sm text-gray-500">Total adeudo</span>
        <span className="font-bold text-gray-800 text-base">{formatMXN(total)}</span>
      </div>
    </div>
  );
}

function TarjetaPromociones({ promos }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Promociones Activas" icono="🎯" />
      <div className="space-y-4">
        {promos.map(p => {
          const total = p.aportacionActeck + p.aportacionCliente;
          const pctActeck = Math.round((p.aportacionActeck / total) * 100);
          return (
            <div key={p.id} className="text-sm">
              <div className="flex justify-between items-start mb-1">
                <p className="font-semibold text-gray-800">{p.nombre}</p>
                <span className="text-xs text-gray-400">{p.vigencia}</span>
              </div>
              <div className="flex gap-4 text-xs mb-2">
                <span className="text-blue-700">Nuestra aportación: <b>{formatMXN(p.aportacionActeck)}</b></span>
                <span className="text-purple-700">Cliente aporta: <b>{formatMXN(p.aportacionCliente)}</b></span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-500 rounded-full" style={{ width: `${pctActeck}%` }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-1">Inversión total: {formatMXN(total)} · Nosotros {pctActeck}% / Cliente {100 - pctActeck}%</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TarjetaMinuta({ minuta }) {
  const cumplidos = minuta.acuerdos.filter(a => a.cumplido).length;
  const pct = Math.round((cumplidos / minuta.acuerdos.length) * 100);
  return (
    <div className="bg-white rounded-2xl shadow-sm p-5">
      <CardHeader titulo="Minuta — Reunión Anterior" icono="📝" />
      <div className="flex flex-wrap gap-4 text-sm mb-4">
        <div>
          <p className="text-xs text-gray-400">Fecha reunión</p>
          <p className="font-semibold text-gray-700">{formatFecha(minuta.fechaReunion)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Próxima reunión</p>
          <p className="font-semibold text-blue-600">{formatFecha(minuta.proximaReunion)}</p>
        </div>
        <div>
          <p className="text-xs text-gray-400">Asistentes</p>
          <p className="font-semibold text-gray-700">{minuta.asistentes.join(", ")}</p>
        </div>
      </div>

      <div className="mb-3">
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Cumplimiento de acuerdos</span>
          <span className="font-bold">{cumplidos}/{minuta.acuerdos.length} ({pct}%)</span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${pct === 100 ? "bg-green-500" : pct >= 60 ? "bg-yellow-400" : "bg-red-400"}`}
               style={{ width: `${pct}%` }}></div>
        </div>
      </div>

      <div className="space-y-2">
        {minuta.acuerdos.map(a => (
          <div key={a.id} className={`flex gap-3 text-sm p-3 rounded-xl ${a.cumplido ? "bg-green-50" : "bg-gray-50"}`}>
            <span className="text-base shrink-0">{a.cumplido ? "✅" : "⬜"}</span>
            <div className="flex-1">
              <p className={`font-medium leading-snug ${a.cumplido ? "text-gray-500 line-through" : "text-gray-800"}`}>{a.descripcion}</p>
              <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                <span>Responsable: {a.responsable}</span>
                <span>Compromiso: {formatFecha(a.fechaCompromiso)}</span>
                {a.cumplido && <span className="text-green-600 font-medium">Cumplido: {formatFecha(a.fechaCumplimiento)}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── PÁGINA HOME CLIENTE ──────────────────────────────────────────────────────
function BarraCuota({ actual, objetivo, minimo }) {
  const pctObj = Math.min((actual / objetivo) * 100, 100);
  const pctMin = (minimo / objetivo) * 100;
  return (
    <div className="mt-2">
      <div className="relative h-2 bg-gray-100 rounded-full overflow-visible">
        <div className="h-full rounded-full transition-all"
          style={{ width: `${pctObj}%`, backgroundColor: pctObj >= 100 ? "#22c55e" : pctObj >= 80 ? "#eab308" : "#ef4444" }} />
        {/* línea mínimo */}
        <div className="absolute top-0 h-full w-0.5 bg-orange-400" style={{ left: `${pctMin}%` }} title="Mínimo 25M" />
      </div>
      <div className="flex justify-between text-xs text-gray-400 mt-0.5">
        <span>0</span>
        <span className="text-orange-500">Mín {Math.round(pctMin)}%</span>
        <span>Obj 100%</span>
      </div>
    </div>
  );
}

// ─── COMPONENTE: ACTUALIZAR DATOS DESDE EXCEL ───
function ActualizarDatosExcel({ cliente, anio, onComplete }) {
  const [cargando, setCargando] = React.useState(false);
  const [resultado, setResultado] = React.useState(null);
  const fileRef = React.useRef(null);

  const procesarArchivo = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setCargando(true);
    setResultado(null);
    try {
      const XLSX = await loadSheetJS();
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: 0 });

      if (!rows.length) throw new Error("El archivo no contiene datos");

      // Detectar columnas flexiblemente
      const colMap = detectarColumnas(Object.keys(rows[0]));
      if (!colMap.mes) throw new Error("No se encontr\u00F3 columna de Mes");
      if (!colMap.sellIn && !colMap.sellOut) throw new Error("No se encontr\u00F3 columna de Sell In o Sell Out");

      const registros = rows.map(r => {
        const mesVal = parseMes(r[colMap.mes]);
        if (!mesVal) return null;
        const reg = { cliente, mes: mesVal, anio: anio || 2026 };
        if (colMap.sellIn) reg.sell_in = parseNum(r[colMap.sellIn]);
        if (colMap.sellOut) reg.sell_out = parseNum(r[colMap.sellOut]);
        if (colMap.cuota) reg.cuota = parseNum(r[colMap.cuota]);
        if (colMap.invDias) reg.inventario_dias = parseNum(r[colMap.invDias]);
        if (colMap.invValor) reg.inventario_valor = parseNum(r[colMap.invValor]);
        return reg;
      }).filter(Boolean);

      if (!registros.length) throw new Error("No se pudieron parsear registros v\u00E1lidos");

      // Upsert a Supabase
      const { error } = await supabase
        .from("ventas_mensuales")
        .upsert(registros, { onConflict: "cliente,mes,anio" });

      if (error) throw error;
      setResultado({ ok: true, msg: registros.length + " meses actualizados" });
      if (onComplete) onComplete();
    } catch (err) {
      setResultado({ ok: false, msg: err.message || "Error al procesar" });
    } finally {
      setCargando(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return React.createElement("div", { className: "inline-flex items-center gap-2" },
    React.createElement("input", {
      ref: fileRef, type: "file", accept: ".xlsx,.xls,.csv",
      onChange: procesarArchivo, className: "hidden", id: "excel-upload"
    }),
    React.createElement("label", {
      htmlFor: "excel-upload",
      className: "cursor-pointer inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium rounded-lg " +
        (cargando ? "bg-gray-200 text-gray-400" : "bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200")
    }, cargando ? "\u23F3 Procesando..." : "\uD83D\uDCC2 Actualizar desde Excel"),
    resultado && React.createElement("span", {
      className: "text-xs " + (resultado.ok ? "text-green-600" : "text-red-500")
    }, resultado.ok ? "\u2705 " + resultado.msg : "\u274C " + resultado.msg)
  );
}

// Helpers para parseo de Excel
function detectarColumnas(headers) {
  const map = {};
  const lower = headers.map(h => ({ orig: h, lc: String(h).toLowerCase().trim() }));
  for (const { orig, lc } of lower) {
    if (/mes|month|periodo/i.test(lc)) map.mes = orig;
    else if (/sell.?in|venta.?in|compra/i.test(lc)) map.sellIn = orig;
    else if (/sell.?out|venta.?out|sellout/i.test(lc)) map.sellOut = orig;
    else if (/cuota|quota|objetivo|meta/i.test(lc)) map.cuota = orig;
    else if (/inv.*d[ií]a|days.*inv/i.test(lc)) map.invDias = orig;
    else if (/inv.*val|valor.*inv/i.test(lc)) map.invValor = orig;
  }
  return map;
}

function parseMes(val) {
  if (typeof val === "number" && val >= 1 && val <= 12) return val;
  const s = String(val).toLowerCase().trim();
  const meses = { ene:1,feb:2,mar:3,abr:4,may:5,jun:6,jul:7,ago:8,sep:9,oct:10,nov:11,dic:12,
    enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,octubre:10,noviembre:11,diciembre:12,
    jan:1,feb:2,mar:3,apr:4,may:5,jun:6,jul:7,aug:8,sep:9,oct:10,nov:11,dec:12 };
  if (meses[s]) return meses[s];
  const n = parseInt(s);
  return (n >= 1 && n <= 12) ? n : null;
}

function parseNum(val) {
  if (typeof val === "number") return val;
  if (!val) return 0;
  return parseFloat(String(val).replace(/[,$\s]/g, "")) || 0;
}

function HomeCliente({ cliente, clienteKey, onUploadComplete }) {
  const [ventas, setVentas] = React.useState([]);
  const [meta, setMeta] = React.useState({ meta_sell_in_min: 25000000, meta_sell_in_optimista: 30000000 });
  const [pendCom, setPendCom] = React.useState([]);
  const [pendMkt, setPendMkt] = React.useState([]);
  const [invMkt, setInvMkt] = React.useState([]);
  const [minutasList, setMinutasList] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editingMeta, setEditingMeta] = React.useState(false);
  const [metaForm, setMetaForm] = React.useState({ min: 25000000, opt: 30000000 });

  const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const ESTADOS = [
    { key: "pendiente", label: "Pendiente", color: "#F59E0B", bg: "#FEF3C7" },
    { key: "en_curso", label: "En curso", color: "#3B82F6", bg: "#DBEAFE" },
    { key: "esperando_info", label: "Esperando info", color: "#8B5CF6", bg: "#EDE9FE" },
    { key: "completado", label: "Completado", color: "#10B981", bg: "#D1FAE5" }
  ];

  // ─── FETCH ALL DATA ─────────────────────────────────────────────────────────
  React.useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    Promise.all([
      supabase.from("ventas_mensuales").select("*").eq("cliente", clienteKey).eq("anio", 2026).order("mes"),
      supabase.from("metas_anuales").select("*").eq("cliente", clienteKey).eq("anio", 2026).maybeSingle(),
      supabase.from("pendientes").select("*").eq("cliente", clienteKey).eq("tipo", "comercial").order("created_at", { ascending: false }),
      supabase.from("pendientes").select("*").eq("cliente", clienteKey).eq("tipo", "marketing").order("created_at", { ascending: false }),
      supabase.from("inversion_marketing").select("*").eq("cliente", clienteKey).eq("anio", 2026).order("mes"),
      supabase.from("minutas").select("*").eq("cliente", clienteKey).order("fecha_reunion", { ascending: false }).limit(10),
    ]).then(([vR, mR, pcR, pmR, imR, minR]) => {
      setVentas(vR.data || []);
      if (mR.data) { setMeta(mR.data); setMetaForm({ min: mR.data.meta_sell_in_min, opt: mR.data.meta_sell_in_optimista }); }
      setPendCom(pcR.data || []);
      setPendMkt(pmR.data || []);
      setInvMkt(imR.data || []);
      setMinutasList(minR.data || []);
      setLoading(false);
    });
  }, [clienteKey]);

  // ─── DERIVED DATA ───────────────────────────────────────────────────────────
  const ventasPorMes = React.useMemo(() => {
    const map = {};
    ventas.forEach(v => { map[parseInt(v.mes)] = v; });
    return map;
  }, [ventas]);

  const totalSellIn = ventas.reduce((s, v) => s + (Number(v.sell_in) || 0), 0);
  const totalSellOut = ventas.reduce((s, v) => s + (Number(v.sell_out) || 0), 0);
  const totalInvValor = ventas.reduce((s, v) => s + (Number(v.inventario_valor) || 0), 0);
  const avgInvValor = ventas.length > 0 ? totalInvValor / ventas.length : 0;
  const lastInvValor = ventas.length > 0 ? Number(ventas[ventas.length - 1].inventario_valor) || 0 : 0;

  const totalInversionMkt = invMkt.reduce((s, v) => s + (Number(v.monto) || 0), 0);
  const costoXPeso = totalSellOut > 0 ? totalInversionMkt / totalSellOut : 0;
  const roiMkt = totalInversionMkt > 0 ? totalSellOut / totalInversionMkt : 0;

  // ─── SVG LINE CHART ─────────────────────────────────────────────────────────
  function LineChartSellInOut() {
    const W = 680, H = 260, PAD = { t: 30, r: 30, b: 40, l: 70 };
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;

    const data = [];
    for (let m = 1; m <= 12; m++) {
      const v = ventasPorMes[m];
      data.push({ mes: m, sellIn: v ? Number(v.sell_in) || 0 : null, sellOut: v ? Number(v.sell_out) || 0 : null });
    }
    const hasData = data.filter(d => d.sellIn !== null);
    if (hasData.length === 0) return React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#94A3B8" } }, "Sin datos de ventas a\u00fan");

    const allVals = hasData.flatMap(d => [d.sellIn, d.sellOut]).filter(v => v !== null);
    const maxVal = Math.max(...allVals, 1);
    const minVal = Math.min(...allVals, 0);
    const range = maxVal - minVal || 1;

    const x = (m) => PAD.l + ((m - 1) / 11) * plotW;
    const y = (val) => PAD.t + plotH - ((val - minVal) / range) * plotH;

    const lineSI = hasData.map(d => `${x(d.mes)},${y(d.sellIn)}`).join(" ");
    const lineSO = hasData.map(d => `${x(d.mes)},${y(d.sellOut)}`).join(" ");

    const gridLines = 5;
    const gridVals = Array.from({ length: gridLines }, (_, i) => minVal + (range / (gridLines - 1)) * i);

    const [hover, setHover] = React.useState(null);

    return React.createElement("svg", { viewBox: `0 0 ${W} ${H}`, style: { width: "100%", maxWidth: 720, fontFamily: "system-ui" } },
      // Grid
      gridVals.map((v, i) => React.createElement("g", { key: i },
        React.createElement("line", { x1: PAD.l, y1: y(v), x2: W - PAD.r, y2: y(v), stroke: "#E2E8F0", strokeWidth: 1 }),
        React.createElement("text", { x: PAD.l - 8, y: y(v) + 4, textAnchor: "end", fontSize: 10, fill: "#94A3B8" },
          "$" + (v / 1e6).toFixed(1) + "M")
      )),
      // X axis labels
      MESES_CORTOS.map((m, i) => React.createElement("text", {
        key: i, x: x(i + 1), y: H - 8, textAnchor: "middle", fontSize: 10, fill: "#64748B"
      }, m)),
      // Sell In line
      React.createElement("polyline", { points: lineSI, fill: "none", stroke: "#4472C4", strokeWidth: 2.5, strokeLinejoin: "round" }),
      // Sell Out line
      React.createElement("polyline", { points: lineSO, fill: "none", stroke: "#10B981", strokeWidth: 2.5, strokeLinejoin: "round", strokeDasharray: "6,3" }),
      // Data points Sell In
      hasData.map(d => React.createElement("circle", {
        key: "si" + d.mes, cx: x(d.mes), cy: y(d.sellIn), r: 4, fill: "#4472C4", stroke: "#fff", strokeWidth: 1.5,
        style: { cursor: "pointer" },
        onMouseEnter: () => setHover({ mes: d.mes, si: d.sellIn, so: d.sellOut }),
        onMouseLeave: () => setHover(null)
      })),
      // Data points Sell Out
      hasData.map(d => React.createElement("circle", {
        key: "so" + d.mes, cx: x(d.mes), cy: y(d.sellOut), r: 4, fill: "#10B981", stroke: "#fff", strokeWidth: 1.5,
        style: { cursor: "pointer" },
        onMouseEnter: () => setHover({ mes: d.mes, si: d.sellIn, so: d.sellOut }),
        onMouseLeave: () => setHover(null)
      })),
      // Legend
      React.createElement("circle", { cx: PAD.l + 10, cy: 14, r: 4, fill: "#4472C4" }),
      React.createElement("text", { x: PAD.l + 18, y: 18, fontSize: 11, fill: "#334155" }, "Sell In"),
      React.createElement("circle", { cx: PAD.l + 80, cy: 14, r: 4, fill: "#10B981" }),
      React.createElement("text", { x: PAD.l + 88, y: 18, fontSize: 11, fill: "#334155" }, "Sell Out"),
      // Tooltip
      hover && React.createElement("g", null,
        React.createElement("rect", { x: x(hover.mes) - 70, y: y(Math.max(hover.si, hover.so)) - 52, width: 140, height: 44, rx: 6, fill: "#1E293B", opacity: 0.92 }),
        React.createElement("text", { x: x(hover.mes), y: y(Math.max(hover.si, hover.so)) - 34, textAnchor: "middle", fontSize: 11, fill: "#93C5FD" },
          "Sell In: " + formatMXN(hover.si)),
        React.createElement("text", { x: x(hover.mes), y: y(Math.max(hover.si, hover.so)) - 18, textAnchor: "middle", fontSize: 11, fill: "#6EE7B7" },
          "Sell Out: " + formatMXN(hover.so))
      )
    );
  }

  // ─── PROGRESS BAR ──────────────────────────────────────────────────────────
  function ProgresoAnual() {
    const pctOpt = meta.meta_sell_in_optimista > 0 ? (totalSellIn / meta.meta_sell_in_optimista) * 100 : 0;
    const pctMin = meta.meta_sell_in_min > 0 ? (totalSellIn / meta.meta_sell_in_min) * 100 : 0;
    const minPctOfOpt = meta.meta_sell_in_optimista > 0 ? (meta.meta_sell_in_min / meta.meta_sell_in_optimista) * 100 : 0;

    const saveMeta = async () => {
      if (!DB_CONFIGURED) return;
      await supabase.from("metas_anuales").upsert({
        cliente: clienteKey, anio: 2026,
        meta_sell_in_min: Number(metaForm.min),
        meta_sell_in_optimista: Number(metaForm.opt)
      }, { onConflict: "cliente,anio" });
      setMeta(prev => ({ ...prev, meta_sell_in_min: Number(metaForm.min), meta_sell_in_optimista: Number(metaForm.opt) }));
      setEditingMeta(false);
    };

    return React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 12, padding: 20 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } }, "Progreso Anual Sell In"),
        React.createElement("button", {
          onClick: () => setEditingMeta(!editingMeta),
          style: { background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#4472C4" }
        }, editingMeta ? "Cancelar" : "Editar meta")
      ),
      editingMeta && React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" } },
        React.createElement("label", { style: { fontSize: 12, color: "#64748B" } }, "Meta m\u00ednima:",
          React.createElement("input", {
            type: "number", value: metaForm.min,
            onChange: e => setMetaForm(p => ({ ...p, min: e.target.value })),
            style: { width: 120, marginLeft: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }
          })
        ),
        React.createElement("label", { style: { fontSize: 12, color: "#64748B" } }, "Meta optimista:",
          React.createElement("input", {
            type: "number", value: metaForm.opt,
            onChange: e => setMetaForm(p => ({ ...p, opt: e.target.value })),
            style: { width: 120, marginLeft: 4, padding: "4px 8px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }
          })
        ),
        React.createElement("button", { onClick: saveMeta, style: { padding: "4px 12px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" } }, "Guardar")
      ),
      // Big number
      React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: "#1E293B", marginBottom: 4 } }, formatMXN(totalSellIn)),
      React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginBottom: 12 } },
        pctOpt.toFixed(1) + "% de meta optimista (" + formatMXN(meta.meta_sell_in_optimista) + ")"),
      // Bar
      React.createElement("div", { style: { position: "relative", height: 24, background: "#E2E8F0", borderRadius: 12, overflow: "hidden" } },
        React.createElement("div", { style: {
          position: "absolute", left: 0, top: 0, height: "100%", width: Math.min(pctOpt, 100) + "%",
          background: pctOpt >= 100 ? "linear-gradient(90deg,#10B981,#059669)" : "linear-gradient(90deg,#4472C4,#60A5FA)",
          borderRadius: 12, transition: "width 0.6s ease"
        } }),
        // Min marker
        React.createElement("div", { style: {
          position: "absolute", left: Math.min(minPctOfOpt, 100) + "%", top: 0, height: "100%", width: 2, background: "#F59E0B", zIndex: 2
        } })
      ),
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#94A3B8" } },
        React.createElement("span", null, "0"),
        React.createElement("span", { style: { color: "#F59E0B" } }, "M\u00edn: " + formatMXN(meta.meta_sell_in_min)),
        React.createElement("span", null, formatMXN(meta.meta_sell_in_optimista))
      ),
      // Sell Out mini
      React.createElement("div", { style: { marginTop: 16, paddingTop: 12, borderTop: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { fontSize: 12, color: "#64748B" } }, "Sell Out Acumulado"),
        React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#10B981" } }, formatMXN(totalSellOut))
      )
    );
  }

  // ─── INVENTARIO CARD ────────────────────────────────────────────────────────
  function InventarioCard() {
    return React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 12, padding: 20 } },
      React.createElement("h4", { style: { margin: "0 0 8px", fontSize: 14, color: "#334155" } }, "Valor de Inventario"),
      React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: "#1E293B" } }, formatMXN(lastInvValor)),
      React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginTop: 4 } },
        ventas.length > 0 ? "Mes m\u00e1s reciente con datos" : "Sin datos")
    );
  }

  // ─── PENDIENTES CARD (reusable) ─────────────────────────────────────────────
  function TarjetaPendientesEditable({ tipo, items, setItems }) {
    const [showForm, setShowForm] = React.useState(false);
    const [showHist, setShowHist] = React.useState(false);
    const [form, setForm] = React.useState({ titulo: "", descripcion: "", responsable: "", fecha_entrega: "" });

    const activos = items.filter(p => !p.archivado);
    const archivados = items.filter(p => p.archivado);

    const addPendiente = async () => {
      if (!form.titulo.trim()) return;
      const row = { cliente: clienteKey, tipo, titulo: form.titulo, descripcion: form.descripcion, responsable: form.responsable, fecha_entrega: form.fecha_entrega || null, estado: "pendiente", archivado: false };
      const { data } = await supabase.from("pendientes").insert(row).select();
      if (data) setItems(prev => [data[0], ...prev]);
      setForm({ titulo: "", descripcion: "", responsable: "", fecha_entrega: "" });
      setShowForm(false);
    };

    const updateEstado = async (id, estado) => {
      await supabase.from("pendientes").update({ estado, updated_at: new Date().toISOString() }).eq("id", id);
      setItems(prev => prev.map(p => p.id === id ? { ...p, estado } : p));
    };

    const archivar = async (id) => {
      await supabase.from("pendientes").update({ archivado: true, estado: "completado", updated_at: new Date().toISOString() }).eq("id", id);
      setItems(prev => prev.map(p => p.id === id ? { ...p, archivado: true, estado: "completado" } : p));
    };

    const estadoObj = (key) => ESTADOS.find(e => e.key === key) || ESTADOS[0];

    return React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" } },
      // Header
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #E2E8F0", background: tipo === "comercial" ? "#EFF6FF" : "#F0FDF4" } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } },
          (tipo === "comercial" ? "Pendientes Comerciales" : "Pendientes Marketing")),
        React.createElement("div", { style: { display: "flex", gap: 6 } },
          React.createElement("button", {
            onClick: () => setShowForm(!showForm),
            style: { padding: "4px 10px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
          }, showForm ? "Cancelar" : "+ Nuevo"),
          archivados.length > 0 && React.createElement("button", {
            onClick: () => setShowHist(!showHist),
            style: { padding: "4px 10px", background: "#F1F5F9", color: "#64748B", border: "1px solid #E2E8F0", borderRadius: 6, fontSize: 12, cursor: "pointer" }
          }, showHist ? "Ocultar historial" : "Historial (" + archivados.length + ")")
        )
      ),
      // Add form
      showForm && React.createElement("div", { style: { padding: 16, background: "#FAFBFC", borderBottom: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          React.createElement("input", { placeholder: "T\u00edtulo del pendiente *", value: form.titulo, onChange: e => setForm(p => ({ ...p, titulo: e.target.value })),
            style: { padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } }),
          React.createElement("input", { placeholder: "Descripci\u00f3n (opcional)", value: form.descripcion, onChange: e => setForm(p => ({ ...p, descripcion: e.target.value })),
            style: { padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } }),
          React.createElement("div", { style: { display: "flex", gap: 8 } },
            React.createElement("input", { placeholder: "Responsable", value: form.responsable, onChange: e => setForm(p => ({ ...p, responsable: e.target.value })),
              style: { flex: 1, padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } }),
            React.createElement("input", { type: "date", value: form.fecha_entrega, onChange: e => setForm(p => ({ ...p, fecha_entrega: e.target.value })),
              style: { padding: "8px 12px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13 } })
          ),
          React.createElement("button", { onClick: addPendiente,
            style: { alignSelf: "flex-end", padding: "8px 20px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }
          }, "Agregar pendiente")
        )
      ),
      // Active items
      React.createElement("div", { style: { maxHeight: 340, overflowY: "auto" } },
        activos.length === 0 && React.createElement("div", { style: { padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 } }, "No hay pendientes activos"),
        activos.map(p => {
          const est = estadoObj(p.estado);
          return React.createElement("div", { key: p.id, style: { padding: "12px 16px", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "flex-start", gap: 10 } },
            // Check to archive
            React.createElement("button", {
              onClick: () => archivar(p.id),
              title: "Marcar como completado y archivar",
              style: { marginTop: 2, width: 20, height: 20, borderRadius: "50%", border: "2px solid " + est.color, background: p.estado === "completado" ? est.color : "transparent", cursor: "pointer", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12 }
            }, p.estado === "completado" ? "\u2713" : ""),
            // Content
            React.createElement("div", { style: { flex: 1, minWidth: 0 } },
              React.createElement("div", { style: { fontWeight: 600, fontSize: 13, color: "#1E293B" } }, p.titulo),
              p.descripcion && React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginTop: 2 } }, p.descripcion),
              React.createElement("div", { style: { display: "flex", gap: 8, marginTop: 6, flexWrap: "wrap", alignItems: "center" } },
                p.responsable && React.createElement("span", { style: { fontSize: 11, color: "#64748B", background: "#F1F5F9", padding: "2px 8px", borderRadius: 10 } }, p.responsable),
                p.fecha_entrega && React.createElement("span", { style: { fontSize: 11, color: "#64748B" } }, "Entrega: " + formatFecha(p.fecha_entrega))
              )
            ),
            // Estado selector
            React.createElement("select", {
              value: p.estado,
              onChange: e => updateEstado(p.id, e.target.value),
              style: { padding: "4px 8px", borderRadius: 6, border: "1px solid " + est.color, background: est.bg, color: est.color, fontSize: 11, fontWeight: 600, cursor: "pointer" }
            }, ESTADOS.map(e => React.createElement("option", { key: e.key, value: e.key }, e.label)))
          );
        })
      ),
      // Archived history
      showHist && archivados.length > 0 && React.createElement("div", { style: { borderTop: "2px solid #E2E8F0" } },
        React.createElement("div", { style: { padding: "10px 16px", background: "#F8FAFC", fontSize: 12, fontWeight: 600, color: "#64748B" } }, "Historial completado"),
        archivados.map(p => React.createElement("div", { key: p.id, style: { padding: "8px 16px", borderBottom: "1px solid #F1F5F9", opacity: 0.6, display: "flex", gap: 8, alignItems: "center" } },
          React.createElement("span", { style: { color: "#10B981", fontSize: 14 } }, "\u2713"),
          React.createElement("span", { style: { fontSize: 12, color: "#64748B", textDecoration: "line-through" } }, p.titulo),
          p.responsable && React.createElement("span", { style: { fontSize: 11, color: "#94A3B8" } }, "(" + p.responsable + ")"),
          p.fecha_entrega && React.createElement("span", { style: { fontSize: 11, color: "#94A3B8" } }, formatFecha(p.fecha_entrega))
        ))
      )
    );
  }

  // ─── MARKETING METRICS ──────────────────────────────────────────────────────
  function MetricasMarketing() {
    const [showAddInv, setShowAddInv] = React.useState(false);
    const [invForm, setInvForm] = React.useState({ mes: new Date().getMonth() + 1, monto: "", descripcion: "" });

    const addInversion = async () => {
      if (!invForm.monto) return;
      const row = { cliente: clienteKey, mes: Number(invForm.mes), anio: 2026, monto: Number(invForm.monto), descripcion: invForm.descripcion };
      const { data } = await supabase.from("inversion_marketing").upsert(row, { onConflict: "cliente,mes,anio" }).select();
      if (data) {
        setInvMkt(prev => {
          const filtered = prev.filter(i => !(i.mes === Number(invForm.mes) && i.anio === 2026));
          return [...filtered, data[0]].sort((a, b) => a.mes - b.mes);
        });
      }
      setInvForm({ mes: new Date().getMonth() + 1, monto: "", descripcion: "" });
      setShowAddInv(false);
    };

    return React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 12, padding: 20 } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } }, "M\u00e9tricas de Marketing"),
        React.createElement("button", {
          onClick: () => setShowAddInv(!showAddInv),
          style: { padding: "4px 10px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
        }, showAddInv ? "Cancelar" : "+ Agregar inversi\u00f3n")
      ),
      showAddInv && React.createElement("div", { style: { display: "flex", gap: 8, marginBottom: 16, flexWrap: "wrap" } },
        React.createElement("select", { value: invForm.mes, onChange: e => setInvForm(p => ({ ...p, mes: e.target.value })),
          style: { padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 }
        }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m))),
        React.createElement("input", { type: "number", placeholder: "Monto $", value: invForm.monto,
          onChange: e => setInvForm(p => ({ ...p, monto: e.target.value })),
          style: { width: 120, padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 } }),
        React.createElement("input", { placeholder: "Descripci\u00f3n", value: invForm.descripcion,
          onChange: e => setInvForm(p => ({ ...p, descripcion: e.target.value })),
          style: { flex: 1, minWidth: 120, padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 } }),
        React.createElement("button", { onClick: addInversion,
          style: { padding: "6px 14px", background: "#4472C4", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
        }, "Guardar")
      ),
      // KPI row
      React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 } },
        React.createElement("div", { style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 4 } }, "Inversi\u00f3n Total"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#E67C73" } }, formatMXN(totalInversionMkt))
        ),
        React.createElement("div", { style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 4 } }, "Sell Out (Venta)"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#10B981" } }, formatMXN(totalSellOut))
        ),
        React.createElement("div", { style: { textAlign: "center" } },
          React.createElement("div", { style: { fontSize: 11, color: "#64748B", marginBottom: 4 } }, "Costo x Peso Vendido"),
          React.createElement("div", { style: { fontSize: 20, fontWeight: 700, color: "#4472C4" } }, "$" + costoXPeso.toFixed(2))
        )
      ),
      totalInversionMkt > 0 && React.createElement("div", { style: { background: "#fff", borderRadius: 8, padding: 12, border: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginBottom: 4 } }, "ROI Marketing: por cada $1 invertido genera " + formatMXN(roiMkt) + " en venta"),
        // Monthly breakdown
        React.createElement("div", { style: { display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 } },
          invMkt.map(i => React.createElement("span", { key: i.id, style: { fontSize: 11, background: "#EFF6FF", padding: "3px 8px", borderRadius: 6, color: "#334155" } },
            MESES_CORTOS[(i.mes || 1) - 1] + ": " + formatMXN(i.monto) + (i.descripcion ? " (" + i.descripcion + ")" : "")
          ))
        )
      )
    );
  }

  // ─── MINUTA CARD ────────────────────────────────────────────────────────────
  function MinutaPlaud() {
    const [showAdd, setShowAdd] = React.useState(false);
    const [minForm, setMinForm] = React.useState({ fecha: new Date().toISOString().split("T")[0], contenido: "" });
    const [expandedId, setExpandedId] = React.useState(null);

    const addMinuta = async () => {
      if (!minForm.contenido.trim()) return;
      const row = { cliente: clienteKey, fecha_reunion: minForm.fecha, contenido: minForm.contenido, fuente: "plaud" };
      const { data } = await supabase.from("minutas").insert(row).select();
      if (data) setMinutasList(prev => [data[0], ...prev]);
      setMinForm({ fecha: new Date().toISOString().split("T")[0], contenido: "" });
      setShowAdd(false);
    };

    return React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", overflow: "hidden" } },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", borderBottom: "1px solid #E2E8F0", background: "#FFFBEB" } },
        React.createElement("h4", { style: { margin: 0, fontSize: 14, color: "#334155" } }, "Minutas de Reuni\u00f3n"),
        React.createElement("button", {
          onClick: () => setShowAdd(!showAdd),
          style: { padding: "4px 10px", background: "#F59E0B", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, cursor: "pointer" }
        }, showAdd ? "Cancelar" : "+ Nueva minuta")
      ),
      showAdd && React.createElement("div", { style: { padding: 16, background: "#FAFBFC", borderBottom: "1px solid #E2E8F0" } },
        React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8 } },
          React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            React.createElement("label", { style: { fontSize: 12, color: "#64748B" } }, "Fecha reuni\u00f3n:"),
            React.createElement("input", { type: "date", value: minForm.fecha,
              onChange: e => setMinForm(p => ({ ...p, fecha: e.target.value })),
              style: { padding: "6px 10px", borderRadius: 6, border: "1px solid #CBD5E1", fontSize: 12 } })
          ),
          React.createElement("textarea", {
            placeholder: "Pega aqu\u00ed el texto de Plaud o escribe la minuta...",
            value: minForm.contenido,
            onChange: e => setMinForm(p => ({ ...p, contenido: e.target.value })),
            rows: 8,
            style: { padding: 12, borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 13, resize: "vertical", fontFamily: "system-ui", lineHeight: 1.5 }
          }),
          React.createElement("button", { onClick: addMinuta,
            style: { alignSelf: "flex-end", padding: "8px 20px", background: "#F59E0B", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }
          }, "Guardar minuta")
        )
      ),
      React.createElement("div", { style: { maxHeight: 400, overflowY: "auto" } },
        minutasList.length === 0 && React.createElement("div", { style: { padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13 } }, "No hay minutas registradas"),
        minutasList.map(m => React.createElement("div", { key: m.id, style: { padding: "12px 16px", borderBottom: "1px solid #F1F5F9" } },
          React.createElement("div", {
            onClick: () => setExpandedId(expandedId === m.id ? null : m.id),
            style: { display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer" }
          },
            React.createElement("div", null,
              React.createElement("span", { style: { fontWeight: 600, fontSize: 13, color: "#1E293B" } }, "Reuni\u00f3n " + formatFecha(m.fecha_reunion)),
              React.createElement("span", { style: { fontSize: 11, color: "#94A3B8", marginLeft: 8 } }, m.fuente === "plaud" ? "via Plaud" : "Manual")
            ),
            React.createElement("span", { style: { color: "#94A3B8", fontSize: 16 } }, expandedId === m.id ? "\u25B2" : "\u25BC")
          ),
          expandedId === m.id && React.createElement("div", { style: { marginTop: 10, padding: 12, background: "#F8FAFC", borderRadius: 8, fontSize: 13, color: "#334155", lineHeight: 1.6, whiteSpace: "pre-wrap" } }, m.contenido)
        ))
      )
    );
  }

  // ─── MAIN RENDER ────────────────────────────────────────────────────────────
  if (loading) return React.createElement("div", { style: { display: "flex", justifyContent: "center", padding: 60 } },
    React.createElement("div", { style: { fontSize: 16, color: "#94A3B8" } }, "Cargando datos..."));

  return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 20, padding: "0 4px" } },
    // Row 1: Line chart
    React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: 20 } },
      React.createElement("h3", { style: { margin: "0 0 12px", fontSize: 16, color: "#1E293B" } }, "Sell In vs Sell Out — " + (cliente?.nombre || clienteKey) + " 2026"),
      React.createElement(LineChartSellInOut, null)
    ),
    // Row 2: Progress + Inventario
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 } },
      React.createElement(ProgresoAnual, null),
      React.createElement(InventarioCard, null)
    ),
    // Row 3: Pendientes
    React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 } },
      React.createElement(TarjetaPendientesEditable, { tipo: "comercial", items: pendCom, setItems: setPendCom }),
      React.createElement(TarjetaPendientesEditable, { tipo: "marketing", items: pendMkt, setItems: setPendMkt })
    ),
    // Row 4: Marketing metrics
    React.createElement(MetricasMarketing, null),
    // Row 5: Minuta
    React.createElement(MinutaPlaud, null)
  );
}

// ─── PÁGINA: CRÉDITO Y COBRANZA ──────────────────────────────────────────────
function CreditoCobranza({ cliente }) {
  const c = cliente;
  const k = c.cartera;
  if (!k) return (
    <div className="p-6 text-gray-400 text-sm">Sin datos de crédito y cobranza disponibles.</div>
  );

  const lineaMXN = k.lineaCreditoUSD * k.tipoCambio;
  const usoPct = Math.round((k.saldoActual / lineaMXN) * 100);
  const disponibleMXN = lineaMXN - k.saldoActual;
  const disponibleUSD = disponibleMXN / k.tipoCambio;

  // Semáforo línea de crédito
  const lineaColor = usoPct >= 90 ? { bar: "#ef4444", bg: "bg-red-50", border: "border-red-200", text: "text-red-700", label: "Crítico — Línea casi agotada" }
                   : usoPct >= 70 ? { bar: "#eab308", bg: "bg-yellow-50", border: "border-yellow-200", text: "text-yellow-700", label: "Atención — Uso elevado" }
                   :                { bar: "#22c55e", bg: "bg-green-50",  border: "border-green-200",  text: "text-green-700",  label: "Saludable — Línea disponible" };

  // Aging total y porcentajes
  const ag = k.aging;
  const agTotal = ag.d0_30 + ag.d31_60 + ag.d61_90 + ag.mas90;
  const agPct = (v) => Math.round((v / agTotal) * 100);

  // Vencimientos por mes
  const mesesLabel = { "2026-04": "Abril", "2026-05": "Mayo", "2026-06": "Junio" };
  const vmEntries = Object.entries(k.vencimientosMes);
  const vmMax = Math.max(...vmEntries.map(([,v]) => v));

  // Proyección basada en tendencia de crecimiento real 2026
  const soValues = Object.values(DIGITALIFE_REAL.sellOut);
  const soUltimo = soValues[soValues.length - 1];           // Mar 2026: último mes con dato
  const soAnterior = soValues[soValues.length - 2];         // Feb 2026: mes previo
  const tasaCrecMensual = soUltimo / soAnterior;            // Tasa real mensual 2026
  const soPromedio = soValues.reduce((a, b) => a + b, 0) / soValues.length; // referencia
  const proyMeses = [
    { mes: "Abril",  monto: k.vencimientosMes["2026-04"], cobro: soUltimo * tasaCrecMensual },
    { mes: "Mayo",   monto: k.vencimientosMes["2026-05"], cobro: soUltimo * Math.pow(tasaCrecMensual, 2) },
    { mes: "Junio",  monto: k.vencimientosMes["2026-06"], cobro: soUltimo * Math.pow(tasaCrecMensual, 3) },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* ── ENCABEZADO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}>💳</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{c.nombre} — Crédito y Cobranza</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {" · "}Semana {k.semana} · {k.periodo}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">
              Actualizado: {formatFecha(k.ultimaActualizacion)}{k.horaActualizacion ? ` · ${k.horaActualizacion} hrs` : ""}
            </span>
            <span className="text-xs text-gray-400">TC: ${k.tipoCambio.toFixed(2)} MXN/USD</span>
          </div>
        </div>
      </div>

      {/* ── ALERTA VENCIDO ── */}
      {k.saldoVencido > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-4 mb-6 flex items-start gap-3">
          <span className="text-red-500 text-xl">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-red-700">Saldo Vencido — Gestión inmediata requerida</p>
            <p className="text-xs text-red-600 mt-0.5">
              <strong>{formatMXN(k.saldoVencido)}</strong> en cartera vencida
              ({" "}{formatMXN(ag.d61_90)} entre 61-90 días y{" "}
              {formatMXN(ag.mas90)} con más de 90 días).
            </p>
          </div>
        </div>
      )}

      {/* ── SEMÁFORO LÍNEA DE CRÉDITO ── */}
      <div className={`${lineaColor.bg} border ${lineaColor.border} rounded-2xl p-5 mb-6`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-0.5">Línea de Crédito</p>
            <p className="text-xl font-bold text-gray-800">
              {formatUSD(k.lineaCreditoUSD)} USD
              <span className="text-sm font-normal text-gray-400 ml-2">= {formatMXN(lineaMXN)}</span>
            </p>
          </div>
          <div className="text-right">
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold ${lineaColor.bg} ${lineaColor.text} border ${lineaColor.border}`}>
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lineaColor.bar }}></span>
              {lineaColor.label}
            </span>
          </div>
        </div>
        {/* Barra de utilización */}
        <div className="mb-3">
          <div className="flex justify-between text-xs text-gray-500 mb-1">
            <span>Utilización: <strong className={lineaColor.text}>{usoPct}%</strong></span>
            <span>Disponible: <strong className="text-green-700">{formatUSD(disponibleUSD)} ({formatMXN(disponibleMXN)})</strong></span>
          </div>
          <div className="h-4 bg-white rounded-full overflow-hidden border border-gray-200 shadow-inner">
            <div className="h-full rounded-full transition-all relative"
                 style={{ width: `${Math.min(usoPct, 100)}%`, backgroundColor: lineaColor.bar }}>
            </div>
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>$0</span>
            <span className="text-yellow-500">70% · Alerta</span>
            <span className="text-red-500">90% · Crítico</span>
            <span>{formatUSD(k.lineaCreditoUSD)}</span>
          </div>
        </div>
        {/* Desglose numérico */}
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Saldo Usado</p>
            <p className="text-base font-bold text-gray-800">{formatMXN(k.saldoActual)}</p>
            <p className="text-xs text-gray-400">{formatUSD(k.saldoActual / k.tipoCambio)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">Disponible</p>
            <p className="text-base font-bold text-green-700">{formatMXN(disponibleMXN)}</p>
            <p className="text-xs text-gray-400">{formatUSD(disponibleUSD)}</p>
          </div>
          <div className="bg-white rounded-xl p-3 text-center shadow-sm">
            <p className="text-xs text-gray-400 mb-1">DSO Actual</p>
            <p className="text-base font-bold text-blue-700">{k.dso} días</p>
            <p className="text-xs text-gray-400">promedio de cobro</p>
          </div>
        </div>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-blue-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo Total</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(k.saldoActual)}</p>
          <p className="text-xs text-gray-400 mt-1">{usoPct}% de la línea usada</p>
        </div>
        <div className={`bg-white rounded-2xl shadow-sm p-5 border-t-4 ${k.saldoVencido > 0 ? "border-red-500" : "border-green-500"}`}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Saldo Vencido</p>
          <p className={`text-2xl font-bold ${k.saldoVencido > 0 ? "text-red-600" : "text-green-600"}`}>
            {formatMXN(k.saldoVencido)}
          </p>
          <p className="text-xs text-gray-400 mt-1">{k.saldoVencido > 0 ? `${Math.round((k.saldoVencido / k.saldoActual) * 100)}% del saldo total` : "Sin vencidos"}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-purple-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Notas de Crédito</p>
          <p className="text-2xl font-bold text-purple-700">{formatMXN(k.saldoNC)}</p>
          <p className="text-xs text-gray-400 mt-1">A aplicar en próximos pagos</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-yellow-400">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">A Vencer (semana)</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(k.saldoAVencer)}</p>
          <p className="text-xs text-gray-400 mt-1">Próximos 7 días</p>
        </div>
      </div>

      {/* ── AGING DE FACTURAS + VENCIMIENTOS POR MES ── */}
      <div className="grid grid-cols-1 gap-6 mb-6 md:grid-cols-2">

        {/* Aging */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <CardHeader titulo="Aging de Facturas" icono="📅" />
          <div className="space-y-3">
            {[
              { label: "0 – 30 días",  monto: ag.d0_30,  color: "#22c55e", bg: "bg-green-500",  tag: "bg-green-100 text-green-700",  icono: "✅" },
              { label: "31 – 60 días", monto: ag.d31_60, color: "#3b82f6", bg: "bg-blue-400",   tag: "bg-blue-100 text-blue-700",    icono: "🔵" },
              { label: "61 – 90 días", monto: ag.d61_90, color: "#eab308", bg: "bg-yellow-400", tag: "bg-yellow-100 text-yellow-700", icono: "⚠️" },
              { label: "+ 90 días",    monto: ag.mas90,  color: "#ef4444", bg: "bg-red-500",    tag: "bg-red-100 text-red-700",       icono: "🔴" },
            ].map(({ label, monto, color, bg, tag, icono }) => (
              <div key={label}>
                <div className="flex justify-between items-center text-sm mb-1">
                  <div className="flex items-center gap-1.5">
                    <span>{icono}</span>
                    <span className="text-gray-700 font-medium">{label}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-800">{formatMXN(monto)}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${tag}`}>{agPct(monto)}%</span>
                  </div>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${bg}`} style={{ width: `${agPct(monto)}%` }}></div>
                </div>
              </div>
            ))}
            <div className="border-t pt-3 flex justify-between text-sm">
              <span className="text-gray-500">Total cartera</span>
              <span className="font-bold text-gray-800">{formatMXN(agTotal)}</span>
            </div>
          </div>
        </div>

        {/* Vencimientos por mes */}
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <CardHeader titulo="Vencimientos por Mes" icono="🗓️" />
          <div className="space-y-4">
            {vmEntries.map(([mes, monto]) => {
              const pct = Math.round((monto / vmMax) * 100);
              const isPast = mes < "2026-04";
              return (
                <div key={mes}>
                  <div className="flex justify-between items-center text-sm mb-1">
                    <span className="font-semibold text-gray-700">{mesesLabel[mes] || mes}</span>
                    <span className="font-bold text-gray-800">{formatMXN(monto)}</span>
                  </div>
                  <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full bg-blue-500"
                         style={{ width: `${pct}%` }}></div>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{pct}% del mes con mayor vencimiento</p>
                </div>
              );
            })}
          </div>
          {/* Mini-resumen */}
          <div className="mt-4 border-t pt-3 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400">Total a vencer (3 meses)</p>
              <p className="font-bold text-gray-800">{formatMXN(Object.values(k.vencimientosMes).reduce((a,b)=>a+b,0))}</p>
            </div>
            <div>
              <p className="text-gray-400">Mes con mayor vencimiento</p>
              <p className="font-bold text-blue-700">{mesesLabel[vmEntries.reduce((a,b)=>b[1]>a[1]?b:a)[0]]}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── PROYECCIÓN DE COBRO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
        <CardHeader titulo="Proyección de Cobro (basada en Sell Out)" icono="📈" />
        <p className="text-xs text-gray-400 mb-4">
          Sell out Mar 2026: <strong>{formatMXN(soUltimo)}</strong> · Crecimiento mensual: <strong>+{((tasaCrecMensual - 1) * 100).toFixed(1)}%</strong> · DSO: <strong>{k.dso} días</strong> · TC: ${k.tipoCambio.toFixed(2)} MXN/USD
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs text-gray-400 uppercase pb-2">Mes</th>
                <th className="text-right text-xs text-gray-400 uppercase pb-2">Vencimiento</th>
                <th className="text-right text-xs text-gray-400 uppercase pb-2">Venta Sell Out</th>
                <th className="text-right text-xs text-gray-400 uppercase pb-2">Balance</th>
                <th className="text-center text-xs text-gray-400 uppercase pb-2">Cobertura</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {proyMeses.map(({ mes, monto, cobro }) => {
                const balance = cobro - monto;
                const cobertura = Math.round((cobro / monto) * 100);
                return (
                  <tr key={mes} className="text-sm">
                    <td className="py-3 font-semibold text-gray-700">{mes}</td>
                    <td className="py-3 text-right text-gray-700">{formatMXN(monto)}</td>
                    <td className="py-3 text-right text-blue-700 font-semibold">{formatMXN(cobro)}</td>
                    <td className={`py-3 text-right font-semibold ${balance >= 0 ? "text-green-600" : "text-red-600"}`}>
                      {balance >= 0 ? "+" : ""}{formatMXN(balance)}
                    </td>
                    <td className="py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${cobertura >= 100 ? "bg-green-100 text-green-700" : cobertura >= 80 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
                        {cobertura}%
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-3 italic">
          * Venta Sell Out proyectada con base en la tendencia de crecimiento mensual 2026 (Ene–Mar). No incluye facturas diferidas ni acuerdos comerciales específicos.
        </p>
      </div>

      {/* ── FUENTE DEL DATO ── */}
      <div className="bg-white rounded-2xl shadow-sm p-5">
        <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Fuente del dato</p>
        <p className="text-sm text-gray-700 font-medium">{k.correoSemana}</p>
        <p className="text-xs text-gray-400 mt-1">
          Correo enviado cada lunes · intranet@acteck.com · Actualización automática 4pm
          {" · "}TC Banxico {formatFecha(k.ultimaActualizacion)}: ${k.tipoCambio.toFixed(2)} MXN/USD
        </p>
      </div>

    </div>
  );
}

// ——— PAGOS Y COMPROMISOS (Supabase) ———
const CATEGORIA_META = {
  promociones:    { label: "Promociones",      color: "#f59e0b" },
  marketing:      { label: "Marketing",        color: "#8b5cf6" },
  pagosFijos:     { label: "Pagos Fijos",      color: "#3b82f6" },
  pagosVariables: { label: "Pagos Variables",  color: "#10b981" },
  rebate:         { label: "Rebate",           color: "#ef4444" },
};

const ESTATUS_OPT = [
  { value: "pendiente",  label: "Pendiente" },
  { value: "en_proceso", label: "En Proceso" },
  { value: "pagado",     label: "Pagado" },
  { value: "vencido",    label: "Vencido" },
];

const MESES_CORTOS = {
  "01": "Ene", "02": "Feb", "03": "Mar", "04": "Abr",
  "05": "May", "06": "Jun", "07": "Jul", "08": "Ago",
  "09": "Sep", "10": "Oct", "11": "Nov", "12": "Dic",
};

function PagosCliente({ cliente }) {
  const c = cliente;

  // ── State ──
  const [registros, setRegistros]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [catActiva, setCatActiva]     = useState("todas");
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null);
  const [showAdd, setShowAdd]         = useState(false);
  const [expandedFijos, setExpandedFijos] = useState({});  // { conceptoKey: true }
  const [showAddFijo, setShowAddFijo] = useState(false);
  const [newFijo, setNewFijo]         = useState({ concepto: "", monto: "", responsable: "" });
  const [newRow, setNewRow]           = useState({
    folio: "", concepto: "", categoria: "promociones", monto: "",
    estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
    responsable: "", notas: "",
  });

  const MESES_ARR = [
    { key: "01", short: "Ene", full: "Enero" },
    { key: "02", short: "Feb", full: "Febrero" },
    { key: "03", short: "Mar", full: "Marzo" },
    { key: "04", short: "Abr", full: "Abril" },
    { key: "05", short: "May", full: "Mayo" },
    { key: "06", short: "Jun", full: "Junio" },
    { key: "07", short: "Jul", full: "Julio" },
    { key: "08", short: "Ago", full: "Agosto" },
    { key: "09", short: "Sep", full: "Septiembre" },
    { key: "10", short: "Oct", full: "Octubre" },
    { key: "11", short: "Nov", full: "Noviembre" },
    { key: "12", short: "Dic", full: "Diciembre" },
  ];

  // ── Data loading ──
  useEffect(() => {
    if (!DB_CONFIGURED) {
      const seed = Object.entries(PAGOS_DIGITALIFE_2026.categorias).flatMap(([key, cat]) =>
        cat.items.map(item => ({ ...item, id: item.folio, categoria: key }))
      );
      setRegistros(seed);
      setLoading(false);
      return;
    }
    fetchData();
    const channel = supabase
      .channel("pagos-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "pagos" }, fetchData)
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  const fetchData = async () => {
    const { data } = await supabase.from("pagos").select("*").order("created_at");
    setRegistros(data || []);
    setLoading(false);
  };

  // ── Toast ──
  const flash = (msg, type = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  // ── Inline edit helpers ──
  const startEdit = (id, field, value) => {
    if (!DB_CONFIGURED) return;
    setEditingCell({ id, field });
    setEditValue(value ?? "");
  };
  const cancelEdit = () => { setEditingCell(null); setEditValue(""); };
  const saveEdit = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const value = field === "monto" ? (parseFloat(editValue) || 0) : (editValue || null);
    setRegistros(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
    cancelEdit();
    setSaving(true);
    const { error } = await supabase.from("pagos")
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", id);
    setSaving(false);
    if (error) { flash("Error al guardar ✗", "err"); fetchData(); }
    else flash("Guardado ✓");
  };

  // ── Add record (non-fijos) ──
  const handleAdd = async () => {
    if (!newRow.concepto.trim()) return;
    const record = {
      ...newRow,
      folio: newRow.folio.trim() || "",
      monto: parseFloat(newRow.monto) || 0,
      fecha_compromiso: newRow.fecha_compromiso || null,
      fecha_pago_real: newRow.fecha_pago_real || null,
    };
    const { data, error } = await supabase.from("pagos").insert(record).select().single();
    if (error) { flash("Error al agregar ✗", "err"); return; }
    setRegistros(prev => [...prev, data]);
    setNewRow({ folio: "", concepto: "", categoria: "promociones", monto: "",
                estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
                responsable: "", notas: "" });
    setShowAdd(false);
    flash("Registro agregado ✓");
  };

  // ── Add Pago Fijo (creates 12 monthly records) ──
  const handleAddFijo = async () => {
    if (!newFijo.concepto.trim()) return;
    const monto = parseFloat(newFijo.monto) || 0;
    const records = MESES_ARR.map(m => ({
      folio: "",
      concepto: newFijo.concepto.trim(),
      categoria: "pagosFijos",
      monto,
      estatus: "pendiente",
      fecha_compromiso: `2026-${m.key}-01`,
      fecha_pago_real: null,
      responsable: newFijo.responsable.trim() || null,
      notas: null,
    }));
    setSaving(true);
    const { data, error } = await supabase.from("pagos").insert(records).select();
    setSaving(false);
    if (error) { flash("Error al crear pagos fijos ✗", "err"); return; }
    setRegistros(prev => [...prev, ...data]);
    setNewFijo({ concepto: "", monto: "", responsable: "" });
    setShowAddFijo(false);
    flash(`12 meses de "${newFijo.concepto}" creados ✓`);
  };

  // ── Delete record ──
  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setRegistros(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { flash("Error al eliminar ✗", "err"); fetchData(); }
    else flash("Eliminado ✓");
  };

  // ── Delete all months of a fijo concept ──
  const handleDeleteFijo = async (conceptoKey, ids) => {
    if (!window.confirm(`¿Eliminar todos los meses de "${conceptoKey}"? Esta acción no se puede deshacer.`)) return;
    setRegistros(prev => prev.filter(r => !ids.includes(r.id)));
    for (const id of ids) {
      await supabase.from("pagos").delete().eq("id", id);
    }
    flash(`"${conceptoKey}" eliminado ✓`);
  };

  // ── Toggle expand fijo ──
  const toggleFijo = (key) => {
    setExpandedFijos(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // ── Computed ──
  const fijoRecords = registros.filter(r => r.categoria === "pagosFijos");
  const nonFijoRecords = registros.filter(r => r.categoria !== "pagosFijos");
  const filtered = catActiva === "todas"
    ? nonFijoRecords
    : catActiva === "pagosFijos"
      ? []
      : registros.filter(r => r.categoria === catActiva);

  const showFijosSection = catActiva === "todas" || catActiva === "pagosFijos";
  const showRegularTable = catActiva !== "pagosFijos";

  // Group fijos by concepto
  const fijoGroups = {};
  fijoRecords.forEach(r => {
    const key = r.concepto || "Sin nombre";
    if (!fijoGroups[key]) fijoGroups[key] = [];
    fijoGroups[key].push(r);
  });

  // KPIs
  const totalPagado   = registros.filter(r => r.estatus === "pagado").reduce((s, r) => s + (r.monto || 0), 0);
  const totalPorPagar = registros.filter(r => ["pendiente","en proceso"].includes(r.estatus)).reduce((s, r) => s + (r.monto || 0), 0);
  const totalVencido  = registros.filter(r => r.estatus === "vencido").reduce((s, r) => s + (r.monto || 0), 0);
  const totalAnio     = registros.reduce((s, r) => s + (r.monto || 0), 0);

  // Monthly breakdown
  const monthlyBreakdown = () => {
    const months = {};
    registros.forEach(r => {
      const d = r.fecha_compromiso;
      if (!d) return;
      const m = typeof d === "string" ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7);
      if (!months[m]) months[m] = { mes: m, total: 0, promociones: 0, marketing: 0, pagosFijos: 0, pagosVariables: 0, rebate: 0 };
      months[m].total += (r.monto || 0);
      if (CATEGORIA_META[r.categoria]) months[m][r.categoria] = (months[m][r.categoria] || 0) + (r.monto || 0);
    });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  };

  // ── Inline cell renderer ──
  const renderCell = (row, field, type = "text") => {
    const isEditing = editingCell?.id === row.id && editingCell?.field === field;
    const inputCls = "w-full border border-blue-400 rounded px-2 py-1 text-sm outline-none bg-blue-50 focus:ring-1 focus:ring-blue-400";

    if (isEditing) {
      if (type === "sel-estatus") {
        return (
          <select autoFocus value={editValue} className={inputCls}
            onChange={e => setEditValue(e.target.value)} onBlur={saveEdit}
            onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }}>
            {ESTATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        );
      }
      if (type === "sel-cat") {
        return (
          <select autoFocus value={editValue} className={inputCls}
            onChange={e => setEditValue(e.target.value)} onBlur={saveEdit}
            onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }}>
            {Object.entries(CATEGORIA_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        );
      }
      return (
        <input autoFocus type={type} value={editValue} className={inputCls}
          onChange={e => setEditValue(e.target.value)} onBlur={saveEdit}
          onKeyDown={e => { if (e.key==="Enter") saveEdit(); if (e.key==="Escape") cancelEdit(); }} />
      );
    }

    const handleClick = () => {
      if (field === "monto") startEdit(row.id, field, row.monto ?? "");
      else startEdit(row.id, field, row[field] ?? "");
    };

    if (field === "estatus") {
      const s = ESTATUS_OPT.find(o => o.value === (row.estatus || "pendiente")) || ESTATUS_OPT[0];
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`}></span>{s.label}
          </span>
        </div>
      );
    }
    if (field === "categoria") {
      const m = CATEGORIA_META[row.categoria] || CATEGORIA_META.promociones;
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-semibold whitespace-nowrap"
                style={{ backgroundColor: m.color }}>{m.icono} {m.label}</span>
        </div>
      );
    }
    if (field === "monto") {
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          {(row.monto || 0) > 0
            ? <span className="font-bold text-gray-800">{formatMXN(row.monto)}</span>
            : <span className="text-gray-400 text-xs italic">Por definir</span>}
        </div>
      );
    }
    if (field === "fecha_compromiso" || field === "fecha_pago_real") {
      return (
        <div className={DB_CONFIGURED ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors whitespace-nowrap" : "whitespace-nowrap"} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
          {row[field] ? <span className="text-gray-600">{formatFecha(row[field])}</span> : <span className="text-gray-300">—</span>}
        </div>
      );
    }
    return (
      <div className={DB_CONFIGURED ? "cursor-pointer hover:bg-blue-50 rounded px-1 transition-colors" : ""} onClick={handleClick} title={DB_CONFIGURED ? "Click para editar" : ""}>
        {row[field] ? <span className="text-gray-700">{row[field]}</span> : <span className="text-gray-300">—</span>}
      </div>
    );
  };

  // ────────────────────────── RENDER ──────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-2.5 rounded-xl shadow-lg text-sm font-semibold transition-all ${toast.type === "err" ? "bg-red-500 text-white" : "bg-green-600 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}>💰</div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{c.nombre} — Pagos y Compromisos</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {" · "}Promociones · Marketing · Pagos Fijos · Variables
                {saving && <span className="ml-2 text-blue-400 animate-pulse">● Guardando...</span>}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs text-gray-400 block">
              Actualizado: {formatFecha(c.cartera?.ultimaActualizacion || "2026-04-07")}
              {c.cartera?.horaActualizacion ? ` · ${c.cartera.horaActualizacion} hrs` : ""}
            </span>
            {c.cartera?.tipoCambio && (
              <span className="text-xs text-gray-400">TC: ${c.cartera.tipoCambio.toFixed(2)} MXN/USD</span>
            )}
            <span className={`ml-2 text-xs px-2 py-0.5 rounded-full font-semibold ${DB_CONFIGURED ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"}`}>
              {DB_CONFIGURED ? "✅ Sincronizado" : "⚠️ Solo lectura"}
            </span>
          </div>
        </div>
      </div>

      {/* Banner de configuración pendiente */}
      {!DB_CONFIGURED && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <span className="text-2xl">⚙️</span>
          <div>
            <p className="font-semibold text-orange-800 mb-1">Configuración requerida para guardar cambios</p>
            <p className="text-sm text-orange-700 mb-2">
              Para que todos los cambios se guarden y sean visibles para el equipo, configura las variables en Vercel y la tabla en Supabase.
            </p>
            <code className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded block w-fit">
              VITE_SUPABASE_URL · VITE_SUPABASE_ANON_KEY
            </code>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
          <span className="text-gray-500">Cargando datos...</span>
        </div>
      )}

      {!loading && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
            <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-green-500">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total Pagado</p>
              <p className="text-2xl font-bold text-green-700">{totalPagado > 0 ? formatMXN(totalPagado) : "$0"}</p>
              <p className="text-xs text-gray-400 mt-1">{registros.filter(r => r.estatus === "pagado").length} conceptos</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-yellow-400">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Por Pagar</p>
              <p className="text-2xl font-bold text-yellow-600">{totalPorPagar > 0 ? formatMXN(totalPorPagar) : "$0"}</p>
              <p className="text-xs text-gray-400 mt-1">{registros.filter(r => ["pendiente","en proceso"].includes(r.estatus)).length} conceptos</p>
            </div>
            <div className={`bg-white rounded-2xl shadow-sm p-5 border-t-4 ${totalVencido > 0 ? "border-red-500" : "border-gray-200"}`}>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Vencido</p>
              <p className={`text-2xl font-bold ${totalVencido > 0 ? "text-red-600" : "text-gray-400"}`}>{totalVencido > 0 ? formatMXN(totalVencido) : "$0"}</p>
              <p className="text-xs text-gray-400 mt-1">{registros.filter(r => r.estatus === "vencido").length} conceptos</p>
            </div>
            <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-blue-500">
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total 2026</p>
              <p className="text-2xl font-bold text-gray-800">{totalAnio > 0 ? formatMXN(totalAnio) : "$0"}</p>
              <p className="text-xs text-gray-400 mt-1">{registros.length} conceptos registrados</p>
            </div>
          </div>

          {/* Category summary cards */}
          <div className="grid grid-cols-2 gap-4 mb-6 md:grid-cols-4">
            {Object.entries(CATEGORIA_META).map(([key, meta]) => {
              const items  = registros.filter(r => r.categoria === key);
              const pagado = items.filter(r => r.estatus === "pagado").reduce((s, r) => s + (r.monto || 0), 0);
              const total  = items.reduce((s, r) => s + (r.monto || 0), 0);
              const pct    = total > 0 ? Math.round(pagado / total * 100) : 0;
              const active = catActiva === key;
              return (
                <button key={key} onClick={() => setCatActiva(active ? "todas" : key)}
                  className={`bg-white rounded-2xl shadow-sm p-4 text-left transition-all border-2 ${active ? "shadow-md" : "border-transparent hover:border-gray-200"}`}
                  style={{ borderColor: active ? meta.color : undefined }}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{meta.icono}</span>
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide leading-tight">{meta.label}</p>
                  </div>
                  <p className="text-lg font-bold text-gray-800 mb-2">
                    {total > 0 ? formatMXN(total) : <span className="text-gray-400 text-sm font-normal">Sin monto</span>}
                  </p>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden mb-1">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: meta.color }}></div>
                  </div>
                  <p className="text-xs text-gray-400">{pct}% pagado · {items.length} conceptos</p>
                </button>
              );
            })}
          </div>

          {/* ═══════════════ PAGOS FIJOS SECTION ═══════════════ */}
          {showFijosSection && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏢</span>
                  <h3 className="font-bold text-gray-700 text-base">Pagos Fijos — Calendario Mensual</h3>
                  <span className="text-xs text-gray-400 ml-2">{Object.keys(fijoGroups).length} concepto{Object.keys(fijoGroups).length !== 1 ? "s" : ""}</span>
                </div>
                {DB_CONFIGURED && (
                  <button onClick={() => setShowAddFijo(!showAddFijo)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-purple-600 text-white rounded-full text-sm font-semibold hover:bg-purple-700 transition-colors">
                    ＋ Nuevo Pago Fijo
                  </button>
                )}
              </div>

              {/* Add Fijo Form */}
              {showAddFijo && DB_CONFIGURED && (
                <div className="mb-5 p-4 bg-purple-50 rounded-xl border border-purple-200">
                  <p className="text-sm font-semibold text-purple-800 mb-3">Nuevo Pago Fijo (se crean 12 meses automáticamente)</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Concepto *</label>
                      <input type="text" value={newFijo.concepto} placeholder="Ej: Renta Sucursal Norte"
                        onChange={e => setNewFijo(p => ({ ...p, concepto: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Monto Mensual (MXN)</label>
                      <input type="number" value={newFijo.monto} placeholder="10000"
                        onChange={e => setNewFijo(p => ({ ...p, monto: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-500 block mb-1">Responsable</label>
                      <input type="text" value={newFijo.responsable} placeholder="Fernando"
                        onChange={e => setNewFijo(p => ({ ...p, responsable: e.target.value }))}
                        className="w-full border rounded-lg px-3 py-1.5 text-sm" />
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleAddFijo} disabled={saving}
                      className="px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 transition-colors disabled:opacity-50">
                      {saving ? "Creando..." : "Crear 12 meses"}
                    </button>
                    <button onClick={() => setShowAddFijo(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Fijo Groups */}
              {Object.keys(fijoGroups).length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <p className="text-3xl mb-2">🏢</p>
                  <p className="text-sm">No hay pagos fijos registrados</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {Object.entries(fijoGroups).map(([conceptoKey, rows]) => {
                    const isOpen = expandedFijos[conceptoKey];
                    const pagados = rows.filter(r => r.estatus === "pagado").length;
                    const totalMeses = rows.length;
                    const pctPagado = totalMeses > 0 ? Math.round(pagados / totalMeses * 100) : 0;
                    const montoMensual = rows[0]?.monto || 0;
                    const totalPagadoGrp = rows.filter(r => r.estatus === "pagado").reduce((s, r) => s + (r.monto || 0), 0);
                    const totalGrp = rows.reduce((s, r) => s + (r.monto || 0), 0);

                    // Map rows by month
                    const byMonth = {};
                    rows.forEach(r => {
                      if (r.fecha_compromiso) {
                        const mk = r.fecha_compromiso.slice(5, 7);
                        byMonth[mk] = r;
                      }
                    });

                    return (
                      <div key={conceptoKey} className="border border-gray-200 rounded-xl overflow-hidden">
                        {/* Summary row */}
                        <button onClick={() => toggleFijo(conceptoKey)}
                          className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                          <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} style={{ fontSize: "12px" }}>▶</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap">
                              <span className="font-semibold text-gray-800 text-sm">{conceptoKey}</span>
                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-semibold" style={{ backgroundColor: "#8b5cf6" }}>🏢 Pago Fijo</span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5">
                              <span className="text-xs text-gray-500">Mensual: <strong className="text-gray-700">{formatMXN(montoMensual)}</strong></span>
                              <span className="text-xs text-gray-500">Pagado: <strong className="text-green-600">{formatMXN(totalPagadoGrp)}</strong> / {formatMXN(totalGrp)}</span>
                              <span className="text-xs text-gray-500">{pagados}/{totalMeses} meses</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 flex-shrink-0">
                            <div className="w-24">
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div className="h-full bg-purple-500 rounded-full transition-all" style={{ width: `${pctPagado}%` }}></div>
                              </div>
                              <p className="text-xs text-gray-400 text-center mt-0.5">{pctPagado}%</p>
                            </div>
                            {DB_CONFIGURED && (
                              <button onClick={(e) => { e.stopPropagation(); handleDeleteFijo(conceptoKey, rows.map(r => r.id)); }}
                                className="text-gray-300 hover:text-red-500 transition-colors text-base" title="Eliminar concepto completo">🗑</button>
                            )}
                          </div>
                        </button>

                        {/* Expanded month rows */}
                        {isOpen && (
                          <div className="border-t border-gray-100">
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide py-2.5 px-4 w-20">Mes</th>
                                    <th className="text-right text-xs text-gray-400 uppercase tracking-wide py-2.5 px-3 w-28">Monto</th>
                                    <th className="text-center text-xs text-gray-400 uppercase tracking-wide py-2.5 px-3 w-28">Estatus</th>
                                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide py-2.5 px-3 w-32">F. Pago Real</th>
                                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide py-2.5 px-3 w-28">Folio</th>
                                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide py-2.5 px-3 w-28">Responsable</th>
                                    <th className="text-left text-xs text-gray-400 uppercase tracking-wide py-2.5 px-3">Notas</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {MESES_ARR.map((mes, idx) => {
                                    const row = byMonth[mes.key];
                                    if (!row) {
                                      return (
                                        <tr key={mes.key} className={`border-b border-gray-50 ${idx % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                                          <td className="py-2.5 px-4 font-semibold text-gray-700 text-xs">{mes.short}</td>
                                          <td colSpan="6" className="py-2.5 px-3 text-center text-gray-300 text-xs italic">Sin registro para este mes</td>
                                        </tr>
                                      );
                                    }
                                    const isPast = new Date(`2026-${mes.key}-01`) < new Date();
                                    const isPagado = row.estatus === "pagado";
                                    const rowBg = isPagado ? "bg-green-50/40" : (row.estatus === "vencido" ? "bg-red-50/40" : (isPast && !isPagado ? "bg-yellow-50/30" : ""));
                                    return (
                                      <tr key={mes.key} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${idx % 2 === 1 ? "bg-gray-50/30" : ""} ${rowBg}`}>
                                        <td className="py-2.5 px-4">
                                          <span className="font-semibold text-gray-700 text-xs">{mes.short}</span>
                                        </td>
                                        <td className="py-2.5 px-3 text-right">{renderCell(row, "monto", "number")}</td>
                                        <td className="py-2.5 px-3 text-center">{renderCell(row, "estatus", "sel-estatus")}</td>
                                        <td className="py-2.5 px-3">{renderCell(row, "fecha_pago_real", "date")}</td>
                                        <td className="py-2.5 px-3">{renderCell(row, "folio")}</td>
                                        <td className="py-2.5 px-3">{renderCell(row, "responsable")}</td>
                                        <td className="py-2.5 px-3">{renderCell(row, "notas")}</td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                                <tfoot>
                                  <tr className="border-t-2 border-gray-200 bg-gray-50">
                                    <td className="py-2.5 px-4 font-bold text-gray-700 text-xs">TOTAL</td>
                                    <td className="py-2.5 px-3 text-right font-bold text-gray-800 text-sm">{formatMXN(totalGrp)}</td>
                                    <td className="py-2.5 px-3 text-center">
                                      <span className="text-xs text-green-600 font-semibold">{pagados} pagado{pagados !== 1 ? "s" : ""}</span>
                                    </td>
                                    <td colSpan="4" className="py-2.5 px-3">
                                      <span className="text-xs text-gray-400">Pendiente: {formatMXN(totalGrp - totalPagadoGrp)}</span>
                                    </td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-4 pt-3 border-t border-gray-100">
                <p className="text-xs text-gray-400">
                  💡 Haz click en una fila para expandir y ver/editar los 12 meses. Los campos de folio, estatus y fecha de pago son editables por mes.
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════ REGULAR TABLE (non-fijos) ═══════════════ */}
          {showRegularTable && (
            <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">

              {/* Filter tabs + Add button */}
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <button onClick={() => setCatActiva("todas")}
                  className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${catActiva === "todas" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                  Todas
                </button>
                {Object.entries(CATEGORIA_META).filter(([k]) => k !== "pagosFijos").map(([key, meta]) => (
                  <button key={key} onClick={() => setCatActiva(catActiva === key ? "todas" : key)}
                    className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${catActiva === key ? "text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                    style={catActiva === key ? { backgroundColor: meta.color } : {}}>
                    <span>{meta.icono}</span>{meta.label}
                  </button>
                ))}
                <span className="ml-auto text-xs text-gray-400">{filtered.length} registro{filtered.length !== 1 ? "s" : ""}</span>
                {DB_CONFIGURED && (
                  <button onClick={() => setShowAdd(!showAdd)}
                    className="flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white rounded-full text-sm font-semibold hover:bg-blue-700 transition-colors">
                    ＋ Agregar
                  </button>
                )}
              </div>

              {/* Add form */}
              {showAdd && DB_CONFIGURED && (
                <div className="mb-5 p-4 bg-blue-50 rounded-xl border border-blue-200">
                  <p className="text-sm font-semibold text-blue-800 mb-3">Nuevo registro</p>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {[
                      { label: "Categoría *", key: "categoria", type: "select-cat" },
                      { label: "Concepto *",  key: "concepto",  type: "text" },
                      { label: "Monto (MXN)", key: "monto",     type: "number" },
                      { label: "Estatus",     key: "estatus",   type: "select-est" },
                      { label: "F. Compromiso", key: "fecha_compromiso", type: "date" },
                      { label: "F. Pago Real",  key: "fecha_pago_real",  type: "date" },
                      { label: "Responsable",   key: "responsable",      type: "text" },
                      { label: "Folio (del cliente)", key: "folio", type: "text" },
                      { label: "Notas",         key: "notas",            type: "text" },
                    ].map(({ label, key, type }) => (
                      <div key={key}>
                        <label className="text-xs text-gray-500 block mb-1">{label}</label>
                        {type === "select-cat" ? (
                          <select value={newRow.categoria} onChange={e => setNewRow(p => ({ ...p, categoria: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                            {Object.entries(CATEGORIA_META).filter(([k]) => k !== "pagosFijos").map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                          </select>
                        ) : type === "select-est" ? (
                          <select value={newRow.estatus} onChange={e => setNewRow(p => ({ ...p, estatus: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                            {ESTATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        ) : (
                          <input type={type} value={newRow[key] || ""} placeholder={key === "monto" ? "0" : key === "folio" ? "Folio del cliente" : ""}
                            onChange={e => setNewRow(p => ({ ...p, [key]: e.target.value }))}
                            className="w-full border rounded-lg px-2 py-1.5 text-sm" />
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <button onClick={handleAdd} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
                      Guardar registro
                    </button>
                    <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-200 transition-colors">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 min-w-36">Concepto {DB_CONFIGURED && <span className="text-blue-300 normal-case font-normal">(click p/editar)</span>}</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Categoría</th>
                      <th className="text-right text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Monto</th>
                      <th className="text-center text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Estatus</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">F. Compromiso</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">F. Pago Real</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Responsable</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3 pr-3 whitespace-nowrap">Folio</th>
                      <th className="text-left text-xs text-gray-400 uppercase tracking-wide pb-3">Notas</th>
                      {DB_CONFIGURED && <th className="pb-3 w-8"></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((row, i) => (
                      <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50/60 transition-colors ${i % 2 === 1 ? "bg-gray-50/30" : ""}`}>
                        <td className="py-2.5 pr-3 min-w-36">{renderCell(row, "concepto")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "categoria", "sel-cat")}</td>
                        <td className="py-2.5 pr-3 text-right">{renderCell(row, "monto", "number")}</td>
                        <td className="py-2.5 pr-3 text-center">{renderCell(row, "estatus", "sel-estatus")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "fecha_compromiso", "date")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "fecha_pago_real", "date")}</td>
                        <td className="py-2.5 pr-3">{renderCell(row, "responsable")}</td>
                        <td className="py-2.5 pr-3">
                          <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">
                            {renderCell(row, "folio")}
                          </span>
                        </td>
                        <td className="py-2.5">{renderCell(row, "notas")}</td>
                        {DB_CONFIGURED && (
                          <td className="py-2.5 pl-1">
                            <button onClick={() => handleDelete(row.id)}
                              className="text-gray-300 hover:text-red-500 transition-colors text-base" title="Eliminar registro">🗑</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filtered.length === 0 && (
                  <div className="text-center py-8 text-gray-400">
                    <p className="text-3xl mb-2">📭</p>
                    <p className="text-sm">No hay registros{catActiva !== "todas" ? " en esta categoría" : ""}</p>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-gray-400">
                  {DB_CONFIGURED ? "✅ Cambios guardados y sincronizados para todo el equipo." : "⚠️ Modo lectura — configura Supabase para habilitar la edición."}
                  {" "}💡 <strong className="text-gray-600">Pendiente</strong> · <strong className="text-gray-600">En Proceso</strong> · <strong className="text-gray-600">Pagado</strong> · <strong className="text-gray-600">Vencido</strong>
                </p>
              </div>
            </div>
          )}

          {/* Monthly summary table */}
          {(() => {
            const mb = monthlyBreakdown();
            if (mb.length === 0) return null;
            return (
              <div className="bg-white rounded-2xl shadow-sm p-5">
                <CardHeader titulo="Resumen General por Mes y Categoría" icono="📅" />
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100">
                        <th className="text-left text-xs text-gray-400 uppercase pb-3 pr-4">Mes</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.promociones.color }}>Promociones</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.marketing.color }}>Marketing</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.pagosFijos.color }}>Pagos Fijos</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.pagosVariables.color }}>P. Variables</th>
                        <th className="text-right text-xs pb-3 pr-4" style={{ color: CATEGORIA_META.rebate.color }}>Rebate</th>
                        <th className="text-right text-xs text-gray-700 uppercase font-bold pb-3">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mb.map(m => {
                        const [yr, mo] = m.mes.split("-");
                        return (
                          <tr key={m.mes} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-2.5 pr-4 font-semibold text-gray-700">{MESES_CORTOS[mo]} {yr}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.promociones    > 0 ? formatMXN(m.promociones)    : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.marketing      > 0 ? formatMXN(m.marketing)      : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.pagosFijos    > 0 ? formatMXN(m.pagosFijos)    : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.pagosVariables> 0 ? formatMXN(m.pagosVariables): <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.rebate         > 0 ? formatMXN(m.rebate)         : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 text-right font-bold text-gray-800">{formatMXN(m.total)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-gray-200">
                        <td className="pt-3 font-bold text-gray-700 text-sm">TOTAL ANUAL</td>
                        {["promociones","marketing","pagosFijos","pagosVariables","rebate"].map(cat => (
                          <td key={cat} className="pt-3 pr-4 text-right font-bold text-gray-700">
                            {formatMXN(registros.filter(r => r.categoria === cat).reduce((s, r) => s + (r.monto || 0), 0))}
                          </td>
                        ))}
                        <td className="pt-3 text-right font-bold text-blue-700">{formatMXN(totalAnio)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            );
          })()}
        </>
      )}

    </div>
  );
}

// ─── ESTRATEGIA DE PRODUCTO ─── CONSTANTS ───────────────────────────────────────────────────────────────
const ROADMAP_CODES = {
  RMI:   { label: "RunRate",           color: "bg-green-100",  text: "text-green-700" },
  NVS:   { label: "Nuevo",             color: "bg-blue-100",   text: "text-blue-700" },
  "2025": { label: "Lanzamiento 2025", color: "bg-purple-100", text: "text-purple-700" },
  "2026": { label: "Lanzamiento 2026", color: "bg-orange-100", text: "text-orange-700" },
  EXMAY: { label: "Mayoreo",           color: "bg-amber-100",  text: "text-amber-700" },
  RML:   { label: "Liquidación",       color: "bg-red-100",    text: "text-red-700" },
  PEM:   { label: "Marketplace",       color: "bg-teal-100",   text: "text-teal-700" },
  DECME: { label: "DECME",             color: "bg-gray-100",   text: "text-gray-700" },
};

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const MONTH_KEYS_2025 = ["ene_2025", "feb_2025", "mar_2025", "abr_2025", "may_2025", "jun_2025", "jul_2025", "ago_2025", "sep_2025", "oct_2025", "nov_2025", "dic_2025"];
const MONTH_KEYS_2026 = ["ene_2026", "feb_2026", "mar_2026", "abr_2026", "may_2026", "jun_2026", "jul_2026", "ago_2026", "sep_2026", "oct_2026", "nov_2026", "dic_2026"];
const MONTH_VAL_2025 = ["ene_2025_val", "feb_2025_val", "mar_2025_val", "abr_2025_val", "may_2025_val", "jun_2025_val", "jul_2025_val", "ago_2025_val", "sep_2025_val", "oct_2025_val", "nov_2025_val", "dic_2025_val"];
const MONTH_VAL_2026 = ["ene_2026_val", "feb_2026_val", "mar_2026_val", "abr_2026_val", "may_2026_val", "jun_2026_val", "jul_2026_val", "ago_2026_val", "sep_2026_val", "oct_2026_val", "nov_2026_val", "dic_2026_val"];

// ─── HELPER FUNCTIONS ────────────────────────────────────────────────────────
function summonthlyValues(producto, monthKeys) {
  return monthKeys.reduce((sum, key) => sum + (producto[key] || 0), 0);
}

function filterProductos(productos, yearFilter, marcaFilter, categoriaFilter, roadmapFilter, searchTerm) {
  return productos.filter(p => {
    if (marcaFilter !== "todas" && (!p.marca || !p.marca.toUpperCase().includes(marcaFilter.toUpperCase()))) {
      return false;
    }
    if (categoriaFilter !== "todas" && p.categoria !== categoriaFilter) {
      return false;
    }
    if (roadmapFilter !== "todos" && p.roadmap !== roadmapFilter) {
      return false;
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      return (
        (p.sku && p.sku.toLowerCase().includes(term)) ||
        (p.descripcion && p.descripcion.toLowerCase().includes(term))
      );
    }
    return true;
  });
}

// ─── COMPONENT ───────────────────────────────────────────────────────────────
function EstrategiaProducto({ cliente = "Digitalife" }) {
  const [productos, setProductos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [yearFilter, setYearFilter] = useState(2026);
  const [marcaFilter, setMarcaFilter] = useState("todas");
  const [categoriaFilter, setCategoriaFilter] = useState("todas");
  const [roadmapFilter, setRoadmapFilter] = useState("todos");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortCol, setSortCol] = useState("sku");
  const [sortDir, setSortDir] = useState("asc");
  const [editingId, setEditingId] = useState(null);
  const [editingValue, setEditingValue] = useState("");
  const [toast, setToast] = useState("");
  const [catSortCol, setCatSortCol] = useState("ventas");
  const [catSortDir, setCatSortDir] = useState("desc");

  // Fetch productos from Supabase
  useEffect(() => {
    async function fetchProductos() {
      try {
        if (!DB_CONFIGURED) {
          setProductos([]);
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("productos")
          .select("*")
          .order("sku", { ascending: true });
        if (error) throw error;
        setProductos(data || []);
      } catch (err) {
        console.error("Error fetching productos:", err);
        setProductos([]);
      } finally {
        setLoading(false);
      }
    }
    fetchProductos();
    if (DB_CONFIGURED) {
      const subscription = supabase
        .channel("productos_changes")
        .on("postgres_changes", {
          event: "*",
          schema: "public",
          table: "productos"
        }, (payload) => {
          if (payload.eventType === "DELETE") {
            setProductos(p => p.filter(prod => prod.id !== payload.old.id));
          } else {
            setProductos(p => {
              const idx = p.findIndex(prod => prod.id === payload.new.id);
              if (idx >= 0) {
                const updated = [...p];
                updated[idx] = payload.new;
                return updated;
              }
              return [...p, payload.new];
            });
          }
        })
        .subscribe();
      return () => { subscription.unsubscribe(); };
    }
  }, []);

  const categorias = [...new Set(productos.map(p => p.categoria).filter(Boolean))].sort();
  const roadmapCodes = [...new Set(productos.map(p => p.roadmap).filter(Boolean))].sort();
  const filtered = filterProductos(productos, yearFilter, marcaFilter, categoriaFilter, roadmapFilter, searchTerm);

  const monthKeysForYear = yearFilter === 2025 ? MONTH_KEYS_2025 : MONTH_KEYS_2026;
  const monthValForYear = yearFilter === 2025 ? MONTH_VAL_2025 : MONTH_VAL_2026;

  // ─── Sort helper for product table ───
  const handleSort = (col) => {
    if (sortCol === col) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("desc"); }
  };
  const sortArrow = (col) => sortCol === col ? (sortDir === "asc" ? " \u2191" : " \u2193") : "";

  const sorted = [...filtered].sort((a, b) => {
    let aVal = a[sortCol];
    let bVal = b[sortCol];
    if (sortCol === "_sugerido") {
      aVal = a.sugerido_manual || a.sugerido || 0;
      bVal = b.sugerido_manual || b.sugerido || 0;
    }
    if (aVal == null) aVal = "";
    if (bVal == null) bVal = "";
    if (typeof aVal === "string") { aVal = aVal.toLowerCase(); bVal = (bVal || "").toLowerCase(); }
    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ─── KPIs ───
  const totalSKUs = filtered.length;
  const totalVentas = filtered.reduce((sum, p) => sum + summonthlyValues(p, monthValForYear), 0);
  const totalPiezas = filtered.reduce((sum, p) => sum + summonthlyValues(p, monthKeysForYear), 0);
  const totalInventarioValor = filtered.reduce((sum, p) => {
    return sum + ((p.inventario_cliente || 0) * (p.costo_promedio || 0));
  }, 0);

  // ─── Brand breakdown ───
  const acteckProds = filtered.filter(p => p.marca && p.marca.toUpperCase().includes("ACTECK"));
  const balamProds = filtered.filter(p => p.marca && p.marca.toUpperCase().includes("BALAM"));
  const acteckVentas = acteckProds.reduce((sum, p) => sum + summonthlyValues(p, monthValForYear), 0);
  const acteckPiezas = acteckProds.reduce((sum, p) => sum + summonthlyValues(p, monthKeysForYear), 0);
  const balamVentas = balamProds.reduce((sum, p) => sum + summonthlyValues(p, monthValForYear), 0);
  const balamPiezas = balamProds.reduce((sum, p) => sum + summonthlyValues(p, monthKeysForYear), 0);

  // ─── Category breakdown with monthly data ───
  const categoryBreakdown = categorias.map(cat => {
    const catProds = filtered.filter(p => p.categoria === cat);
    const monthlyVentas = monthValForYear.map(key => catProds.reduce((s, p) => s + (p[key] || 0), 0));
    const monthlyPiezas = monthKeysForYear.map(key => catProds.reduce((s, p) => s + (p[key] || 0), 0));
    const ventas = monthlyVentas.reduce((a, b) => a + b, 0);
    const piezas = monthlyPiezas.reduce((a, b) => a + b, 0);
    return { categoria: cat, ventas, piezas, count: catProds.length, monthlyVentas, monthlyPiezas };
  });

  // Sort categories
  const handleCatSort = (col) => {
    if (catSortCol === col) setCatSortDir(catSortDir === "asc" ? "desc" : "asc");
    else { setCatSortCol(col); setCatSortDir("desc"); }
  };
  const catSortArrow = (col) => catSortCol === col ? (catSortDir === "asc" ? " \u2191" : " \u2193") : "";

  const sortedCategories = [...categoryBreakdown].sort((a, b) => {
    let aVal, bVal;
    if (catSortCol === "categoria") { aVal = a.categoria.toLowerCase(); bVal = b.categoria.toLowerCase(); }
    else if (catSortCol.startsWith("m_")) {
      const idx = parseInt(catSortCol.split("_")[1]);
      aVal = a.monthlyVentas[idx]; bVal = b.monthlyVentas[idx];
    } else { aVal = a[catSortCol]; bVal = b[catSortCol]; }
    const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
    return catSortDir === "asc" ? cmp : -cmp;
  });

  // ─── Handle sugerido edit ───
  const handleEditSugerido = async (productoId, newValue) => {
    try {
      const { error } = await supabase
        .from("productos")
        .update({ sugerido_manual: parseInt(newValue) || 0 })
        .eq("id", productoId);
      if (error) throw error;
      setToast("Sugerido actualizado");
      setTimeout(() => setToast(""), 2000);
      setEditingId(null);
    } catch (err) {
      console.error("Error updating sugerido:", err);
      setToast("Error al guardar");
      setTimeout(() => setToast(""), 2000);
    }
  };

  // ─── Brand card click handler ───
  const handleBrandClick = (brand) => {
    if (marcaFilter === brand) setMarcaFilter("todas");
    else setMarcaFilter(brand);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 p-6 flex items-center justify-center">
        <div className="text-gray-500">Cargando productos...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* HEADER */}
      <div className="bg-gradient-to-r from-slate-700 to-slate-800 rounded-2xl p-6 mb-6 text-white">
        <h1 className="text-3xl font-bold mb-1">{cliente} — Estrategia de Producto</h1>
        <p className="text-slate-300 text-sm">Acteck / Balam Rush · Sellout Real</p>
      </div>

      {/* YEAR SELECTOR */}
      <div className="flex gap-2 mb-6">
        {[2025, 2026].map(year => (
          <button
            key={year}
            onClick={() => setYearFilter(year)}
            className={`px-4 py-2 rounded-lg font-semibold transition-all ${
              yearFilter === year
                ? "bg-blue-600 text-white shadow-lg"
                : "bg-white text-gray-700 border border-gray-200 hover:bg-gray-50"
            }`}
          >
            {year}
          </button>
        ))}
      </div>

      {/* KPI CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-blue-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Total SKUs Activos</p>
          <p className="text-3xl font-bold text-gray-800">{totalSKUs}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-green-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Venta Total {yearFilter}</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(totalVentas)}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-purple-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Piezas Totales</p>
          <p className="text-3xl font-bold text-gray-800">{totalPiezas.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-orange-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Valor Inventario</p>
          <p className="text-2xl font-bold text-gray-800">{formatMXN(totalInventarioValor)}</p>
        </div>
      </div>

      {/* BRAND CARDS — clickable to filter */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div
          onClick={() => handleBrandClick("acteck")}
          className={`bg-white rounded-xl shadow-sm p-5 border-l-4 cursor-pointer transition-all ${
            marcaFilter === "acteck" ? "border-red-500 ring-2 ring-red-200 bg-red-50" : "border-red-500 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔵</span>
              <h3 className="text-lg font-bold text-gray-800">Acteck</h3>
            </div>
            {marcaFilter === "acteck" && <span className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded-full font-medium">Filtro activo</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Ventas {yearFilter}</p>
              <p className="text-xl font-bold text-gray-800">{formatMXN(acteckVentas)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Piezas {yearFilter}</p>
              <p className="text-xl font-bold text-gray-800">{acteckPiezas.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">% del total</p>
              <p className="text-lg font-bold text-red-600">
                {totalVentas > 0 ? Math.round((acteckVentas / totalVentas) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">SKUs</p>
              <p className="text-lg font-bold text-gray-700">{acteckProds.length}</p>
            </div>
          </div>
        </div>

        <div
          onClick={() => handleBrandClick("balam")}
          className={`bg-white rounded-xl shadow-sm p-5 border-l-4 cursor-pointer transition-all ${
            marcaFilter === "balam" ? "border-blue-500 ring-2 ring-blue-200 bg-blue-50" : "border-blue-500 hover:shadow-md"
          }`}
        >
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">🔴</span>
              <h3 className="text-lg font-bold text-gray-800">Balam Rush</h3>
            </div>
            {marcaFilter === "balam" && <span className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded-full font-medium">Filtro activo</span>}
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-400 mb-1">Ventas {yearFilter}</p>
              <p className="text-xl font-bold text-gray-800">{formatMXN(balamVentas)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">Piezas {yearFilter}</p>
              <p className="text-xl font-bold text-gray-800">{balamPiezas.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">% del total</p>
              <p className="text-lg font-bold text-blue-600">
                {totalVentas > 0 ? Math.round((balamVentas / totalVentas) * 100) : 0}%
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">SKUs</p>
              <p className="text-lg font-bold text-gray-700">{balamProds.length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* CATEGORY TABLE — replaces individual cards */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-800">Desglose por Categoría — Ventas {yearFilter}</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleCatSort("categoria")}>
                  Categoría{catSortArrow("categoria")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleCatSort("ventas")}>
                  Ventas ${catSortArrow("ventas")}
                </th>
                <th className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleCatSort("piezas")}>
                  Piezas{catSortArrow("piezas")}
                </th>
                <th className="px-3 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleCatSort("count")}>
                  SKUs{catSortArrow("count")}
                </th>
                <th className="px-3 py-3 text-center font-semibold text-gray-700">%</th>
              </tr>
            </thead>
            <tbody>
              {sortedCategories.map((cat) => {
                const pct = totalVentas > 0 ? Math.round((cat.ventas / totalVentas) * 100) : 0;
                return (
                  <tr key={cat.categoria}
                      className={`border-b border-gray-100 hover:bg-blue-50 transition-colors cursor-pointer ${categoriaFilter === cat.categoria ? "bg-blue-50" : ""}`}
                      onClick={() => setCategoriaFilter(categoriaFilter === cat.categoria ? "todas" : cat.categoria)}>
                    <td className="px-4 py-3 font-semibold text-gray-800 whitespace-nowrap">
                      {cat.categoria}
                      {categoriaFilter === cat.categoria && <span className="ml-2 text-xs text-blue-500">✕</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-gray-800 whitespace-nowrap">{formatMXN(cat.ventas)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-700">{cat.piezas.toLocaleString()}</td>
                    <td className="px-3 py-3 text-center text-gray-700">{cat.count}</td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center gap-2 justify-center">
                        <div className="w-12 h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs font-bold text-blue-600 w-8">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {/* TOTALS ROW */}
              <tr className="bg-gray-50 font-bold border-t-2 border-gray-300">
                <td className="px-4 py-3 text-gray-800">Total</td>
                <td className="px-4 py-3 text-right text-gray-800 whitespace-nowrap">{formatMXN(totalVentas)}</td>
                <td className="px-4 py-3 text-right text-gray-700">{totalPiezas.toLocaleString()}</td>
                <td className="px-3 py-3 text-center text-gray-700">{totalSKUs}</td>
                <td className="px-3 py-3 text-center text-blue-600">100%</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-xl shadow-sm p-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Marca</label>
            <div className="flex gap-2">
              {["todas", "Acteck", "Balam"].map(m => (
                <button
                  key={m}
                  onClick={() => setMarcaFilter(m.toLowerCase())}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    marcaFilter === m.toLowerCase()
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Categoría</label>
            <select
              value={categoriaFilter}
              onChange={(e) => setCategoriaFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todas">Todas</option>
              {categorias.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Roadmap</label>
            <select
              value={roadmapFilter}
              onChange={(e) => setRoadmapFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="todos">Todos</option>
              {roadmapCodes.map(code => (
                <option key={code} value={code}>{ROADMAP_CODES[code]?.label || code}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 uppercase tracking-wide mb-2">Buscar</label>
            <input
              type="text"
              placeholder="SKU o descripción..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">Resultados</p>
            <p className="text-lg font-bold text-gray-800">{sorted.length}</p>
          </div>
        </div>
      </div>

      {/* PRODUCT TABLE — all columns sortable */}
      <div className="bg-white rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("sku")}>
                  SKU{sortArrow("sku")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("roadmap")}>
                  Roadmap{sortArrow("roadmap")}
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("descripcion")}>
                  Descripción{sortArrow("descripcion")}
                </th>
                {MONTHS.map((month, idx) => {
                  const colKey = monthKeysForYear[idx];
                  return (
                    <th key={month} className="px-2 py-3 text-center font-semibold text-gray-700 text-xs cursor-pointer hover:bg-gray-100"
                        onClick={() => handleSort(colKey)}>
                      {month}{sortArrow(colKey)}
                    </th>
                  );
                })}
                <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("promedio_90d")}>
                  Prom 90d{sortArrow("promedio_90d")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("inventario_cliente")}>
                  Inventario{sortArrow("inventario_cliente")}
                </th>
                <th className="px-4 py-3 text-center font-semibold text-gray-700 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort("_sugerido")}>
                  Sugerido{sortArrow("_sugerido")}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan="20" className="px-4 py-8 text-center text-gray-500">
                    Sin productos que coincidan
                  </td>
                </tr>
              ) : (
                sorted.map((producto) => {
                  const monthKeysRow = yearFilter === 2025 ? MONTH_KEYS_2025 : MONTH_KEYS_2026;
                  const sugerido = producto.sugerido_manual || producto.sugerido || 0;
                  const roadmapInfo = ROADMAP_CODES[producto.roadmap] || { label: producto.roadmap, color: "bg-gray-100", text: "text-gray-700" };

                  return (
                    <tr key={producto.id} className="border-b border-gray-100 hover:bg-blue-50 transition-colors">
                      <td className="px-4 py-3">
                        <span className="font-mono font-semibold text-gray-800">{producto.sku}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${roadmapInfo.color} ${roadmapInfo.text}`}>
                          {roadmapInfo.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="max-w-xs truncate text-gray-700 text-sm" title={producto.descripcion}>
                          {producto.descripcion}
                        </div>
                      </td>
                      {monthKeysRow.map((key, idx) => {
                        const val = producto[key] || 0;
                        return (
                          <td key={key} className={`px-2 py-3 text-center text-xs ${val > 0 ? "bg-blue-50 font-medium text-gray-800" : "text-gray-400"}`}>
                            {val > 0 ? val : "\u2014"}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-center font-bold text-gray-800">
                        {Math.round((producto.promedio_90d || 0))}
                      </td>
                      <td className="px-4 py-3 text-center text-gray-800">
                        {producto.inventario_cliente || 0}
                      </td>
                      <td className="px-4 py-3">
                        {editingId === producto.id ? (
                          <input
                            type="number"
                            value={editingValue}
                            onChange={(e) => setEditingValue(e.target.value)}
                            onBlur={() => handleEditSugerido(producto.id, editingValue)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleEditSugerido(producto.id, editingValue);
                              if (e.key === "Escape") setEditingId(null);
                            }}
                            autoFocus
                            className="w-16 px-2 py-1 rounded border border-blue-500 text-sm font-medium focus:ring-2 focus:ring-blue-500"
                          />
                        ) : (
                          <div
                            onClick={() => {
                              setEditingId(producto.id);
                              setEditingValue(sugerido.toString());
                            }}
                            className={`cursor-pointer px-3 py-1.5 rounded-lg transition-all font-medium text-sm inline-flex items-center gap-1.5 ${
                              sugerido > 0
                                ? "bg-green-100 text-green-700 hover:bg-green-200"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                          >
                            {sugerido}
                            <span className="text-xs opacity-50">✏️</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* TOAST */}
      {toast && (
        <div className="fixed bottom-6 right-6 bg-green-500 text-white px-4 py-3 rounded-lg shadow-lg animate-pulse">
          {toast}
        </div>
      )}

    </div>
  );
}


// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

// ——— MARKETING (Supabase) ———
const TIPO_ACTIVIDAD = {
  banner:     { label: "Banner",      color: "#8b5cf6", icon: "🖼️", tipo: "digital" },
  mailing:    { label: "Mailing",     color: "#3b82f6", icon: "📧", tipo: "digital" },
  reel:       { label: "Reel",        color: "#ec4899", icon: "🎬", tipo: "digital" },
  google_ads: { label: "Google Ads",  color: "#f59e0b", icon: "📢", tipo: "digital" },
  meta_ads:   { label: "Meta Ads",    color: "#6366f1", icon: "📱", tipo: "digital" },
  demo:       { label: "Demo Tienda", color: "#10b981", icon: "🏪", tipo: "presencial" },
  pop:        { label: "Material POP",color: "#14b8a6", icon: "🪧", tipo: "presencial" },
  taller:     { label: "Taller",      color: "#f97316", icon: "🔧", tipo: "presencial" },
};

const MKT_ESTATUS = [
  { value: "planeado",   label: "Planeado" },
  { value: "en_curso",   label: "En Curso" },
  { value: "completado", label: "Completado" },
  { value: "cancelado",  label: "Cancelado" },
];

const TEMPORALIDADES = {
  semana_santa: { label: "Semana Santa", emoji: "🐣", color: "#ffeaa7" },
  dia_nino:     { label: "Día del Niño", emoji: "🎈", color: "#fd79a8" },
  dia_madres:   { label: "Día Madres",   emoji: "💐", color: "#fab1a0" },
  dia_maestro:  { label: "Día Maestro",  emoji: "📚", color: "#74b9ff" },
  hot_sale:     { label: "HOT SALE",     emoji: "🔥", color: "#ff7675" },
  lluvias:      { label: "Temp. Lluvias",emoji: "🌧️", color: "#a29bfe" },
  buen_fin:     { label: "Buen Fin",     emoji: "🛒", color: "#e17055" },
  navidad:      { label: "Navidad",      emoji: "🎄", color: "#00b894" },
  regreso_clases:{ label: "Regreso Clases",emoji: "📓", color: "#fdcb6e" },
};
function MarketingCliente({ cliente }) {
  const c = cliente;
  const formatMXN = (n) => {
    if (n == null || isNaN(n)) return "—";
    return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const MESES_MKT = [
    { key: "01", short: "Ene", full: "Enero" },
    { key: "02", short: "Feb", full: "Febrero" },
    { key: "03", short: "Mar", full: "Marzo" },
    { key: "04", short: "Abr", full: "Abril" },
    { key: "05", short: "May", full: "Mayo" },
    { key: "06", short: "Jun", full: "Junio" },
    { key: "07", short: "Jul", full: "Julio" },
    { key: "08", short: "Ago", full: "Agosto" },
    { key: "09", short: "Sep", full: "Septiembre" },
    { key: "10", short: "Oct", full: "Octubre" },
    { key: "11", short: "Nov", full: "Noviembre" },
    { key: "12", short: "Dic", full: "Diciembre" },
  ];

  const [actividades, setActividades] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [expandedAct, setExpandedAct] = React.useState(null);
  const [filtroTipo, setFiltroTipo] = React.useState("todas");
  const [anio, setAnio] = React.useState(2026);
  const [editCell, setEditCell] = React.useState(null);

  // Cargar actividades de Supabase
  React.useEffect(() => {
    if (!DB_CONFIGURED || !supabase) { setLoading(false); return; }
    supabase
      .from("marketing_actividades")
      .select("*")
      .eq("cliente", cliente)
      .eq("anio", anio)
      .order("subtipo")
      .order("mes")
      .then(({ data, error }) => {
        if (!error && data) setActividades(data);
        setLoading(false);
      });
    const chan = supabase.channel("mkt-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_actividades" }, (payload) => {
        supabase.from("marketing_actividades").select("*").eq("cliente", cliente).eq("anio", anio).order("subtipo").order("mes").then(({ data }) => { if (data) setActividades(data); });
      })
      .subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [cliente, anio]);

  // Agrupar actividades por nombre (concepto fijo)
  const actividadesPorNombre = React.useMemo(() => {
    const map = {};
    actividades.forEach(a => {
      const key = a.nombre;
      if (!map[key]) map[key] = { nombre: a.nombre, subtipo: a.subtipo, tipo: a.tipo, meses: {} };
      map[key].meses[a.mes] = a;
    });
    return Object.values(map);
  }, [actividades]);

  const actDigitales = actividadesPorNombre.filter(a => a.tipo === "digital");
  const actPresenciales = actividadesPorNombre.filter(a => a.tipo === "presencial");

  // Filtrar
  const filtradas = filtroTipo === "todas"
    ? actividadesPorNombre
    : filtroTipo === "digital"
      ? actDigitales
      : filtroTipo === "presencial"
        ? actPresenciales
        : actividadesPorNombre.filter(a => a.subtipo === filtroTipo);

  // KPIs
  const totalInversion = actividades.reduce((s, a) => s + (Number(a.inversion) || 0), 0);
  const totalAlcance = actividades.reduce((s, a) => s + (Number(a.alcance) || 0), 0);
  const totalClics = actividades.reduce((s, a) => s + (Number(a.clics) || 0), 0);
  const totalConversiones = actividades.reduce((s, a) => s + (Number(a.conversiones) || 0), 0);
  const totalVentas = actividades.reduce((s, a) => s + (Number(a.ventas) || 0), 0);
  const ctr = totalAlcance > 0 ? ((totalClics / totalAlcance) * 100).toFixed(1) : "0.0";
  const roi = totalInversion > 0 ? (((totalVentas - totalInversion) / totalInversion) * 100).toFixed(0) : "0";

  // Guardar campo
  const saveField = async (id, field, value) => {
    if (!DB_CONFIGURED || !supabase) return;
    const numFields = ["inversion", "alcance", "clics", "conversiones", "unidades", "ventas"];
    const val = numFields.includes(field) ? (Number(value) || 0) : value;
    await supabase.from("marketing_actividades").update({ [field]: val, updated_at: new Date().toISOString() }).eq("id", id);
    setActividades(prev => prev.map(a => a.id === id ? { ...a, [field]: val } : a));
    setEditCell(null);
  };

  // Agregar actividad
  const addActividad = async (tipo, subtipo) => {
    if (!DB_CONFIGURED || !supabase) return;
    const meta = TIPO_ACTIVIDAD[subtipo];
    const nombre = meta ? meta.label + "  #" + (actividadesPorNombre.filter(a => a.subtipo === subtipo).length + 1) : "Nueva Actividad";
    const rows = MESES_MKT.map(m => ({
      cliente, tipo, subtipo, nombre, mes: m.key, anio,
      estatus: "planeado", inversion: 0, alcance: 0, clics: 0, conversiones: 0, unidades: 0, ventas: 0,
    }));
    const { data } = await supabase.from("marketing_actividades").insert(rows).select();
    if (data) setActividades(prev => [...prev, ...data]);
  };

  // Eliminar concepto completo
  const deleteConcepto = async (nombre) => {
    if (!DB_CONFIGURED || !supabase) return;
    if (!confirm("¿Eliminar todas las entradas de " + nombre + "?")) return;
    await supabase.from("marketing_actividades").delete().eq("cliente", cliente).eq("nombre", nombre).eq("anio", anio);
    setActividades(prev => prev.filter(a => a.nombre !== nombre));
  };

  // Celda editable inline
  const EditableCell = ({ act, field, type = "text", options = null }) => {
    const isEditing = editCell === act.id + "-" + field;
    const val = act[field];
    if (isEditing) {
      if (options) {
        return React.createElement("select", {
          autoFocus: true,
          defaultValue: val || "",
          className: "border rounded px-1 py-0.5 text-xs w-full",
          onBlur: (e) => saveField(act.id, field, e.target.value),
          onChange: (e) => saveField(act.id, field, e.target.value),
        }, options.map(o => React.createElement("option", { key: o.value, value: o.value }, o.label)));
      }
      return React.createElement("input", {
        autoFocus: true,
        type: type,
        defaultValue: val || "",
        className: "border rounded px-1 py-0.5 text-xs w-full",
        onBlur: (e) => saveField(act.id, field, e.target.value),
        onKeyDown: (e) => { if (e.key === "Enter") saveField(act.id, field, e.target.value); },
      });
    }
    const display = type === "number" && field !== "alcance" && field !== "clics" && field !== "conversiones" && field !== "unidades"
      ? formatMXN(val)
      : (val || "—");
    return React.createElement("span", {
      className: "cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs",
      title: "Click para editar",
      onClick: () => setEditCell(act.id + "-" + field),
    }, display);
  };

  // Resumen por mes
  const resumenPorMes = React.useMemo(() => {
    const map = {};
    actividades.forEach(a => {
      if (!map[a.mes]) map[a.mes] = { inversion: 0, alcance: 0, clics: 0, conversiones: 0, ventas: 0, count: 0 };
      map[a.mes].inversion += Number(a.inversion) || 0;
      map[a.mes].alcance += Number(a.alcance) || 0;
      map[a.mes].clics += Number(a.clics) || 0;
      map[a.mes].conversiones += Number(a.conversiones) || 0;
      map[a.mes].ventas += Number(a.ventas) || 0;
      map[a.mes].count++;
    });
    return map;
  }, [actividades]);

  if (loading) return React.createElement("div", { className: "p-8 text-center text-gray-400" }, "Cargando marketing...");

  const clienteNombre = cliente === "digitalife" ? "Digitalife" : cliente === "pcel" ? "PCEL" : cliente;
  const marca = "Acteck / Balam Rush";

  return React.createElement("div", { className: "max-w-7xl mx-auto" },
    // Header
    React.createElement("div", { className: "mb-6" },
      React.createElement("div", { className: "flex items-center gap-3 mb-1" },
        React.createElement("span", { className: "text-2xl" }, "📣"),
        React.createElement("h2", { className: "text-xl font-bold text-gray-800" }, clienteNombre + " — Marketing"),
      ),
      React.createElement("div", { className: "text-sm text-gray-500" },
        React.createElement("span", { className: "bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-xs font-medium mr-2" }, marca),
        " · Digital · Presencial · Métricas · Resultados"
      ),
      React.createElement("div", { className: "flex items-center gap-4 mt-2 text-xs text-gray-400" },
        React.createElement("span", null, "Año: " + anio),
        DB_CONFIGURED
          ? React.createElement("span", { className: "text-green-600" }, "✅ Sincronizado")
          : React.createElement("span", { className: "text-amber-600" }, "⚠️ Sin conexión a BD"),
      ),
    ),

    // KPIs
    React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6" },
      ...[
        { label: "Inversión", value: formatMXN(totalInversion), color: "bg-indigo-50 text-indigo-700" },
        { label: "Alcance", value: totalAlcance.toLocaleString(), color: "bg-purple-50 text-purple-700" },
        { label: "Clics", value: totalClics.toLocaleString(), color: "bg-blue-50 text-blue-700" },
        { label: "CTR", value: ctr + "%", color: "bg-cyan-50 text-cyan-700" },
        { label: "Conversiones", value: totalConversiones.toLocaleString(), color: "bg-green-50 text-green-700" },
        { label: "Ventas", value: formatMXN(totalVentas), color: "bg-emerald-50 text-emerald-700" },
        { label: "ROI", value: roi + "%", color: Number(roi) >= 0 ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700" },
      ].map((kpi, i) =>
        React.createElement("div", { key: i, className: "rounded-xl border p-3 text-center " + kpi.color },
          React.createElement("div", { className: "text-lg font-bold" }, kpi.value),
          React.createElement("div", { className: "text-xs opacity-70" }, kpi.label),
        )
      )
    ),

    // Filtros
    React.createElement("div", { className: "flex flex-wrap items-center gap-2 mb-4" },
      ...["todas", "digital", "presencial"].map(f =>
        React.createElement("button", {
          key: f,
          onClick: () => setFiltroTipo(f),
          className: "px-3 py-1 rounded-full text-xs font-medium transition " +
            (filtroTipo === f ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"),
        }, f === "todas" ? "Todas" : f === "digital" ? "📱 Digital" : "🏪 Presencial")
      ),
      React.createElement("span", { className: "text-xs text-gray-400 ml-2" },
        filtradas.length + " conceptos · " + actividades.filter(a => filtroTipo === "todas" || a.tipo === filtroTipo || a.subtipo === filtroTipo).length + " registros"
      ),
      React.createElement("div", { className: "ml-auto flex gap-2" },
        React.createElement("select", {
          className: "border rounded px-2 py-1 text-xs",
          value: anio,
          onChange: (e) => setAnio(Number(e.target.value)),
        },
          React.createElement("option", { value: 2026 }, "2026"),
          React.createElement("option", { value: 2025 }, "2025"),
        ),
      ),
    ),

    // Actividades Digitales
    (filtroTipo === "todas" || filtroTipo === "digital" || Object.keys(TIPO_ACTIVIDAD).filter(k => TIPO_ACTIVIDAD[k].tipo === "digital").includes(filtroTipo)) &&
    React.createElement("div", { className: "mb-8" },
      React.createElement("div", { className: "flex items-center justify-between mb-3" },
        React.createElement("h3", { className: "text-base font-semibold text-gray-700 flex items-center gap-2" },
          React.createElement("span", { className: "text-lg" }, "📱"),
          "Actividades Digitales — Calendario Mensual"
        ),
        React.createElement("div", { className: "flex gap-1" },
          ...Object.entries(TIPO_ACTIVIDAD).filter(([, v]) => v.tipo === "digital").map(([key, meta]) =>
            React.createElement("button", {
              key: key,
              onClick: () => addActividad("digital", key),
              className: "text-xs px-2 py-1 rounded border hover:bg-gray-50",
              title: "Agregar " + meta.label,
            }, "＋ " + meta.label)
          ),
        ),
      ),
      React.createElement("div", { className: "text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-3" },
        "💡 Haz click en una fila para expandir y ver/editar los 12 meses con métricas de alcance, clics, conversiones y ventas."
      ),
      // Filas expandibles digitales
      ...(filtroTipo === "todas" || filtroTipo === "digital" ? actDigitales : actividadesPorNombre.filter(a => a.subtipo === filtroTipo)).map(grupo =>
        React.createElement("div", { key: grupo.nombre, className: "border rounded-xl mb-2 overflow-hidden" },
          React.createElement("button", {
            onClick: () => setExpandedAct(expandedAct === grupo.nombre ? null : grupo.nombre),
            className: "w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition text-left",
          },
            React.createElement("div", { className: "flex items-center gap-3" },
              React.createElement("span", { className: "text-sm" }, expandedAct === grupo.nombre ? "▼" : "▶"),
              React.createElement("span", { className: "text-lg" }, TIPO_ACTIVIDAD[grupo.subtipo]?.icon || "📌"),
              React.createElement("div", null,
                React.createElement("div", { className: "font-semibold text-sm" }, grupo.nombre),
                React.createElement("div", { className: "text-xs text-gray-400" },
                  React.createElement("span", {
                    className: "inline-block px-1.5 py-0.5 rounded text-white text-xs mr-2",
                    style: { background: TIPO_ACTIVIDAD[grupo.subtipo]?.color || "#888" },
                  }, TIPO_ACTIVIDAD[grupo.subtipo]?.label || grupo.subtipo),
                  Object.keys(grupo.meses).length + "/12 meses"
                ),
              ),
            ),
            React.createElement("div", { className: "flex items-center gap-4 text-xs text-gray-500" },
              React.createElement("span", null, "Inversión: " + formatMXN(Object.values(grupo.meses).reduce((s, m) => s + (Number(m.inversion) || 0), 0))),
              React.createElement("span", null, "Ventas: " + formatMXN(Object.values(grupo.meses).reduce((s, m) => s + (Number(m.ventas) || 0), 0))),
              React.createElement("button", {
                onClick: (e) => { e.stopPropagation(); deleteConcepto(grupo.nombre); },
                className: "text-red-400 hover:text-red-600 ml-2",
                title: "Eliminar concepto completo",
              }, "🗑"),
            ),
          ),
          // Detalle expandido
          expandedAct === grupo.nombre && React.createElement("div", { className: "border-t bg-gray-50" },
            React.createElement("div", { className: "overflow-x-auto" },
              React.createElement("table", { className: "w-full text-xs" },
                React.createElement("thead", null,
                  React.createElement("tr", { className: "bg-gray-100 text-gray-500 text-left" },
                    ...["Mes", "Producto", "Mensaje", "Estatus", "Inversión", "Alcance", "Clics", "Conv.", "Uds.", "Ventas"].map(h =>
                      React.createElement("th", { key: h, className: "px-3 py-2 font-medium" }, h)
                    )
                  ),
                ),
                React.createElement("tbody", null,
                  ...MESES_MKT.map(m => {
                    const act = grupo.meses[m.key];
                    if (!act) return React.createElement("tr", { key: m.key, className: "border-t text-gray-300" },
                      React.createElement("td", { className: "px-3 py-2 font-medium text-gray-500" }, m.short + " " + anio),
                      ...Array(9).fill(null).map((_, i) => React.createElement("td", { key: i, className: "px-3 py-2" }, "—"))
                    );
                    const temporalidad = act.temporalidad && TEMPORALIDADES[act.temporalidad];
                    return React.createElement("tr", {
                      key: m.key,
                      className: "border-t hover:bg-white transition" + (temporalidad ? " bg-opacity-20" : ""),
                      style: temporalidad ? { background: temporalidad.color + "22" } : {},
                    },
                      React.createElement("td", { className: "px-3 py-2 font-medium text-gray-700 whitespace-nowrap" },
                        temporalidad && React.createElement("span", { className: "mr-1", title: temporalidad.label }, temporalidad.emoji),
                        m.short + " " + anio,
                      ),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "producto" })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "mensaje" })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "estatus", options: MKT_ESTATUS })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "inversion", type: "number" })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "alcance", type: "number" })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "clics", type: "number" })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "conversiones", type: "number" })),
                      React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "unidades", type: "number" })),
                      React.createElement("td", { className: "px-3 py-2 font-medium" }, React.createElement(EditableCell, { act, field: "ventas", type: "number" })),
                    );
                  })
                ),
              ),
            ),
          ),
        )
      ),
    ),

    // Actividades Presenciales
    (filtroTipo === "todas" || filtroTipo === "presencial" || Object.keys(TIPO_ACTIVIDAD).filter(k => TIPO_ACTIVIDAD[k].tipo === "presencial").includes(filtroTipo)) &&
    React.createElement("div", { className: "mb-8" },
      React.createElement("div", { className: "flex items-center justify-between mb-3" },
        React.createElement("h3", { className: "text-base font-semibold text-gray-700 flex items-center gap-2" },
          React.createElement("span", { className: "text-lg" }, "🏪"),
          "Actividades Presenciales — Calendario Mensual"
        ),
        React.createElement("div", { className: "flex gap-1" },
          ...Object.entries(TIPO_ACTIVIDAD).filter(([, v]) => v.tipo === "presencial").map(([key, meta]) =>
            React.createElement("button", {
              key: key,
              onClick: () => addActividad("presencial", key),
              className: "text-xs px-2 py-1 rounded border hover:bg-gray-50",
              title: "Agregar " + meta.label,
            }, "＋ " + meta.label)
          ),
        ),
      ),
      actPresenciales.length === 0
        ? React.createElement("div", { className: "text-center text-gray-400 py-8 border rounded-xl bg-gray-50" },
            React.createElement("div", { className: "text-2xl mb-2" }, "🏪"),
            React.createElement("div", { className: "text-sm" }, "Sin actividades presenciales registradas"),
            React.createElement("div", { className: "text-xs mt-1" }, "Usa los botones de arriba para agregar demos, material POP o talleres"),
          )
        : actPresenciales.map(grupo =>
            React.createElement("div", { key: grupo.nombre, className: "border rounded-xl mb-2 overflow-hidden" },
              React.createElement("button", {
                onClick: () => setExpandedAct(expandedAct === grupo.nombre ? null : grupo.nombre),
                className: "w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition text-left",
              },
                React.createElement("div", { className: "flex items-center gap-3" },
                  React.createElement("span", { className: "text-sm" }, expandedAct === grupo.nombre ? "▼" : "▶"),
                  React.createElement("span", { className: "text-lg" }, TIPO_ACTIVIDAD[grupo.subtipo]?.icon || "📌"),
                  React.createElement("div", null,
                    React.createElement("div", { className: "font-semibold text-sm" }, grupo.nombre),
                    React.createElement("div", { className: "text-xs text-gray-400" },
                      React.createElement("span", {
                        className: "inline-block px-1.5 py-0.5 rounded text-white text-xs mr-2",
                        style: { background: TIPO_ACTIVIDAD[grupo.subtipo]?.color || "#888" },
                      }, TIPO_ACTIVIDAD[grupo.subtipo]?.label || grupo.subtipo),
                      Object.keys(grupo.meses).length + "/12 meses"
                    ),
                  ),
                ),
                React.createElement("div", { className: "flex items-center gap-4 text-xs text-gray-500" },
                  React.createElement("span", null, "Inversión: " + formatMXN(Object.values(grupo.meses).reduce((s, m) => s + (Number(m.inversion) || 0), 0))),
                  React.createElement("button", {
                    onClick: (e) => { e.stopPropagation(); deleteConcepto(grupo.nombre); },
                    className: "text-red-400 hover:text-red-600 ml-2",
                  }, "🗑"),
                ),
              ),
              expandedAct === grupo.nombre && React.createElement("div", { className: "border-t bg-gray-50" },
                React.createElement("div", { className: "overflow-x-auto" },
                  React.createElement("table", { className: "w-full text-xs" },
                    React.createElement("thead", null,
                      React.createElement("tr", { className: "bg-gray-100 text-gray-500 text-left" },
                        ...["Mes", "Descripción", "Estatus", "Inversión", "Responsable", "Notas"].map(h =>
                          React.createElement("th", { key: h, className: "px-3 py-2 font-medium" }, h)
                        )
                      ),
                    ),
                    React.createElement("tbody", null,
                      ...MESES_MKT.map(m => {
                        const act = grupo.meses[m.key];
                        if (!act) return React.createElement("tr", { key: m.key, className: "border-t text-gray-300" },
                          React.createElement("td", { className: "px-3 py-2 font-medium text-gray-500" }, m.short + " " + anio),
                          ...Array(5).fill(null).map((_, i) => React.createElement("td", { key: i, className: "px-3 py-2" }, "—"))
                        );
                        return React.createElement("tr", { key: m.key, className: "border-t hover:bg-white transition" },
                          React.createElement("td", { className: "px-3 py-2 font-medium text-gray-700" }, m.short + " " + anio),
                          React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "producto" })),
                          React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "estatus", options: MKT_ESTATUS })),
                          React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "inversion", type: "number" })),
                          React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "responsable" })),
                          React.createElement("td", { className: "px-3 py-2" }, React.createElement(EditableCell, { act, field: "notas" })),
                        );
                      })
                    ),
                  ),
                ),
              ),
            )
          ),
    ),

    // Resumen General por Mes
    React.createElement("div", { className: "mt-8" },
      React.createElement("h3", { className: "text-base font-semibold text-gray-700 flex items-center gap-2 mb-3" },
        React.createElement("span", { className: "text-lg" }, "📅"),
        "Resumen General por Mes"
      ),
      React.createElement("div", { className: "overflow-x-auto border rounded-xl" },
        React.createElement("table", { className: "w-full text-xs" },
          React.createElement("thead", null,
            React.createElement("tr", { className: "bg-gray-50 text-gray-500 text-left" },
              ...["Mes", "Inversión", "Alcance", "Clics", "CTR", "Conv.", "Ventas", "ROI"].map(h =>
                React.createElement("th", { key: h, className: "px-3 py-2 font-medium" }, h)
              )
            ),
          ),
          React.createElement("tbody", null,
            ...MESES_MKT.filter(m => resumenPorMes[m.key]).map(m => {
              const r = resumenPorMes[m.key];
              const mCtr = r.alcance > 0 ? ((r.clics / r.alcance) * 100).toFixed(1) : "0.0";
              const mRoi = r.inversion > 0 ? (((r.ventas - r.inversion) / r.inversion) * 100).toFixed(0) : "0";
              return React.createElement("tr", { key: m.key, className: "border-t hover:bg-gray-50" },
                React.createElement("td", { className: "px-3 py-2 font-semibold text-gray-700" }, m.short + " " + anio),
                React.createElement("td", { className: "px-3 py-2" }, formatMXN(r.inversion)),
                React.createElement("td", { className: "px-3 py-2" }, r.alcance.toLocaleString()),
                React.createElement("td", { className: "px-3 py-2" }, r.clics.toLocaleString()),
                React.createElement("td", { className: "px-3 py-2" }, mCtr + "%"),
                React.createElement("td", { className: "px-3 py-2" }, r.conversiones.toLocaleString()),
                React.createElement("td", { className: "px-3 py-2 font-medium" }, formatMXN(r.ventas)),
                React.createElement("td", { className: "px-3 py-2 font-medium " + (Number(mRoi) >= 0 ? "text-green-600" : "text-red-600") }, mRoi + "%"),
              );
            }),
            // Total row
            React.createElement("tr", { className: "border-t-2 bg-gray-100 font-bold" },
              React.createElement("td", { className: "px-3 py-2" }, "TOTAL ANUAL"),
              React.createElement("td", { className: "px-3 py-2" }, formatMXN(totalInversion)),
              React.createElement("td", { className: "px-3 py-2" }, totalAlcance.toLocaleString()),
              React.createElement("td", { className: "px-3 py-2" }, totalClics.toLocaleString()),
              React.createElement("td", { className: "px-3 py-2" }, ctr + "%"),
              React.createElement("td", { className: "px-3 py-2" }, totalConversiones.toLocaleString()),
              React.createElement("td", { className: "px-3 py-2" }, formatMXN(totalVentas)),
              React.createElement("td", { className: "px-3 py-2 " + (Number(roi) >= 0 ? "text-green-600" : "text-red-600") }, roi + "%"),
            ),
          ),
        ),
      ),
    ),

    // Footer
    React.createElement("div", { className: "text-xs text-gray-400 text-center mt-4 mb-8" },
      "✅ Cambios guardados y sincronizados para todo el equipo. ",
      "💡 ",
      ...MKT_ESTATUS.map((s, i) =>
        React.createElement("span", { key: i },
          React.createElement("span", { className: "font-medium" }, s.label),
          i < MKT_ESTATUS.length - 1 ? " · " : ""
        )
      ),
    ),
  );
}

// ─── RESUMEN DE CUENTAS ──────────────────────────────────────────────────────────────────
function ResumenCuentas() {
  const [ventasAll, setVentasAll] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    supabase.from("ventas_mensuales").select("*").eq("anio", 2026).order("mes")
      .then(({ data }) => { setVentasAll(data || []); setLoading(false); });
  }, []);

  const clientesMeta = [
    { key: "digitalife", nombre: "Digitalife", color: "#4472C4", marca: "Acteck / Balam Rush" },
    { key: "pcel", nombre: "PCEL", color: "#E67C73", marca: "Balam Rush" },
    { key: "mercadolibre", nombre: "Mercado Libre", color: "#FFE600", marca: "Acteck / Balam Rush" },
  ];
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  function getClientData(clienteKey) {
    const rows = ventasAll.filter(r => r.cliente === clienteKey);
    let sellInTotal = 0, sellOutTotal = 0, piezasTotal = 0, invValor = 0, lastMes = 0;
    const monthly = {};
    for (const r of rows) {
      const m = parseInt(r.mes);
      const si = parseFloat(r.sell_in) || 0;
      const so = parseFloat(r.sell_out) || 0;
      sellInTotal += si; sellOutTotal += so;
      piezasTotal += parseInt(r.piezas || 0);
      if (m > lastMes) { lastMes = m; invValor = parseFloat(r.inventario_valor) || 0; }
      monthly[m] = { sellIn: si, sellOut: so };
    }
    return { sellInTotal, sellOutTotal, piezasTotal, invValor, lastMes, monthly };
  }

  if (loading) return (
    <div className="flex items-center justify-center py-32">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
    </div>
  );

  const clientesData = clientesMeta.map(cm => ({ ...cm, data: getClientData(cm.key) }));
  const grandTotalSI = clientesData.reduce((s, c) => s + c.data.sellInTotal, 0);
  const grandTotalSO = clientesData.reduce((s, c) => s + c.data.sellOutTotal, 0);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Resumen General de Cuentas</h1>
        <p className="text-sm text-gray-500 mt-1">Vista consolidada — Acteck / Balam Rush 2026</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-blue-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sell In Total</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatMXN(grandTotalSI)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-green-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sell Out Total</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatMXN(grandTotalSO)}</p>
        </div>
        <div className="bg-white rounded-xl shadow p-5 border-l-4 border-purple-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Participación Sell In</p>
          <div className="flex gap-4 mt-2">
            {clientesData.map(c => (
              <div key={c.key} className="text-center">
                <div className="text-xs font-medium" style={{ color: c.color }}>{c.nombre}</div>
                <div className="text-sm font-bold">
                  {grandTotalSI > 0 ? ((c.data.sellInTotal / grandTotalSI) * 100).toFixed(1) + "%" : "0%"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {clientesData.map(c => (
          <div key={c.key} className="bg-white rounded-xl shadow-sm border overflow-hidden">
            <div className="px-5 py-4 border-b" style={{ background: c.color + "15" }}>
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full" style={{ background: c.color }} />
                <div>
                  <h3 className="font-bold text-gray-800">{c.nombre}</h3>
                  <p className="text-xs text-gray-500">{c.marca}</p>
                </div>
              </div>
            </div>
            <div className="p-5 space-y-3">
              {[["Sell In Acum.", c.data.sellInTotal], ["Sell Out Acum.", c.data.sellOutTotal],
                ["Piezas", c.data.piezasTotal], ["Inventario", c.data.invValor]].map(([lbl, val]) => (
                <div key={lbl} className="flex justify-between">
                  <span className="text-sm text-gray-500">{lbl}</span>
                  <span className="text-sm font-bold text-gray-800">
                    {lbl === "Piezas" ? val.toLocaleString() : formatMXN(val)}
                  </span>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4">
              <table className="w-full text-xs">
                <thead><tr className="border-b">
                  <th className="text-left py-1 text-gray-400 font-medium">Mes</th>
                  <th className="text-right py-1 text-gray-400 font-medium">Sell In</th>
                  <th className="text-right py-1 text-gray-400 font-medium">Sell Out</th>
                </tr></thead>
                <tbody>
                  {meses.map((mes, i) => c.data.monthly[i+1] ? (
                    <tr key={mes} className={i%2===0 ? "bg-gray-50" : ""}>
                      <td className="py-1 text-gray-600">{mes}</td>
                      <td className="py-1 text-right text-gray-800">{formatMXN(c.data.monthly[i+1]?.sellIn||0)}</td>
                      <td className="py-1 text-right text-gray-800">{formatMXN(c.data.monthly[i+1]?.sellOut||0)}</td>
                    </tr>
                  ) : null)}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


export default function App() {
  const [clienteActivo, setClienteActivo] = useState("digitalife");
  const [modoPresent, setModoPresent] = useState(false);
  const [paginaActiva, setPaginaActiva] = useState("home");

  // ─── DATOS DESDE SUPABASE (ventas_mensuales) ───
  const [ventasDB, setVentasDB] = React.useState(null);
  const [ventasVer, setVentasVer] = React.useState(0);

  React.useEffect(() => {
    if (!DB_CONFIGURED) return;
    supabase.from("ventas_mensuales").select("*")
      .eq("cliente", clienteActivo).eq("anio", 2026).order("mes")
      .then(({ data }) => setVentasDB(data || []));
  }, [clienteActivo, ventasVer]);

  const c = React.useMemo(() => {
    const base = clientes[clienteActivo];
    if (!ventasDB || ventasDB.length === 0) return base;
    const sellInMap = {};
    const sellOutMap = {};
    ventasDB.forEach(r => { sellInMap[r.mes] = r.sell_in; sellOutMap[r.mes] = r.sell_out; });
    const ultimoMes = Math.max(...ventasDB.map(r => r.mes));
    const lastRow = ventasDB.find(r => r.mes === ultimoMes);
    const cuotaAcum = Object.entries(DIGITALIFE_REAL.cuota30M)
      .filter(([m]) => parseInt(m) <= ultimoMes)
      .reduce((a, [, v]) => a + v, 0);
    return {
      ...base,
      kpis: {
        ...base.kpis,
        sellInMes: sellInMap[ultimoMes] || base.kpis.sellInMes,
        sellOut: sellOutMap[ultimoMes] || base.kpis.sellOut,
        sellInAcumulado: Object.values(sellInMap).reduce((a, b) => a + b, 0),
        sellOutAcumulado: Object.values(sellOutMap).reduce((a, b) => a + b, 0),
        cuotaAcumulada: cuotaAcum || base.kpis.cuotaAcumulada,
        cuotaMes: DIGITALIFE_REAL.cuota30M[ultimoMes] || base.kpis.cuotaMes,
        cuotaMes25M: DIGITALIFE_REAL.cuota25M[ultimoMes] || base.kpis.cuotaMes25M,
        diasInventario: lastRow?.inventario_dias ?? base.kpis.diasInventario,
        inventarioValor: lastRow?.inventario_valor ?? base.kpis.inventarioValor,
        ultimoMes: NOMBRES_MES[ultimoMes] || base.kpis.ultimoMes,
      }
    };
  }, [clienteActivo, ventasDB]);

  // Al cambiar de cliente, volver al home
  const handleClienteChange = (key) => {
    setClienteActivo(key);
    setPaginaActiva("home");
  };

  const navItems = [
    { id: "home",      label: "Resumen",    icono: "🏠",  habilitado: true  },
    { id: "cartera",   label: "Crédito y Cobranza", icono: "📊", habilitado: true  },
    { id: "pagos",     label: "Pagos",      icono: "💰",  habilitado: true  },
    { id: "analisis",  label: "Análisis",   icono: "📊",  habilitado: false },
    { id: "estrategia",label: "Estrategia de Producto", icono: "📦", habilitado: true },
    { id: "marketing", label: "Marketing", icono: "📣", habilitado: true },
    { id: "resumen", label: "Resumen", icono: "📊", habilitado: true },
  ];

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* SIDEBAR */}
      <aside className="w-64 bg-white border-r border-gray-100 flex flex-col shadow-sm shrink-0">

        {/* Logo + Botón Modo Presentación */}
        <div className="p-5 border-b border-gray-100">
          {!modoPresent ? (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Dashboard Clientes</p>
              <div className="flex gap-2 mb-3">
                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded-full font-semibold">Acteck</span>
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full font-semibold">Balam Rush</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              <p className="text-xs text-green-600 font-semibold uppercase tracking-widest">Modo Presentación</p>
            </div>
          )}
          <button
            onClick={() => setModoPresent(!modoPresent)}
            className={`w-full text-xs font-semibold px-3 py-2 rounded-xl transition-all flex items-center justify-center gap-2 ${
              modoPresent
                ? "bg-gray-800 text-white hover:bg-gray-700"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {modoPresent ? (
              <><span>🔒</span> Salir de Presentación</>
            ) : (
              <><span>👁️</span> Modo Presentación</>
            )}
          </button>
        </div>

        {/* Selector de cliente — se oculta en modo presentación */}
        {!modoPresent && (
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
            <div className="space-y-1">
              {Object.entries(clientes).map(([key, cl]) => (
                <button
                  key={key}
                  onClick={() => handleClienteChange(key)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    clienteActivo === key
                      ? "bg-gray-800 text-white"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cl.color }}></span>
                    {cl.nombre}
                    <span className="ml-auto text-xs opacity-60">{cl.marca}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* En modo presentación: mostrar solo el cliente activo */}
        {modoPresent && (
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
            <div className="px-3 py-2.5 rounded-xl bg-gray-800 text-white text-sm font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: c.color }}></span>
              {c.nombre}
              <span className="ml-auto text-xs opacity-60">{c.marca}</span>
            </div>
          </div>
        )}

        {/* Navegación */}
        <nav className="p-4 flex-1">
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Secciones</p>
          <div className="space-y-1">
            {navItems.map(item => (
              <button
                key={item.id}
                onClick={() => item.habilitado && setPaginaActiva(item.id)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${
                  !item.habilitado
                    ? "text-gray-400 hover:bg-gray-50 hover:text-gray-600 cursor-not-allowed opacity-60"
                    : paginaActiva === item.id
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                }`}
                disabled={!item.habilitado}
                title={!item.habilitado ? "Próximamente" : ""}
              >
                <span>{item.icono}</span>
                {item.label}
                {!item.habilitado && (
                  <span className="ml-auto text-xs bg-gray-100 text-gray-400 px-1.5 py-0.5 rounded-full">Pronto</span>
                )}
              </button>
            ))}
          </div>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center">v1.0 · Abril 2026</p>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto">
        {/* Banner modo presentación */}
        {modoPresent && (
          <div className="bg-green-600 text-white text-xs text-center py-1.5 font-medium tracking-wide">
            Modo Presentación activo — Solo se muestra información de {c.nombre}
          </div>
        )}
          {paginaActiva === "resumen" && <ResumenCuentas />}
          {(clienteActivo === "pcel" || clienteActivo === "mercadolibre") && paginaActiva !== "resumen" ? (
            <div className="flex flex-col items-center justify-center py-32 px-8">
              <div className="text-7xl mb-6">🔒</div>
              <h2 className="text-2xl font-bold text-gray-700 mb-3">{c.nombre} — Próximamente</h2>
              <p className="text-gray-500 text-center max-w-lg">Las pestañas de {c.nombre} se gestionan de manera diferente y están actualmente en desarrollo. Próximamente se habilitará la gestión completa.</p>
            </div>
          ) : (
            <>
        {paginaActiva === "home"    && <HomeCliente cliente={c} clienteKey={clienteActivo} onUploadComplete={() => setVentasVer(v => v+1)} />}
        {paginaActiva === "cartera" && <CreditoCobranza cliente={c} />}
        {paginaActiva === "pagos"   && <PagosCliente cliente={c} />}
          {paginaActiva === "estrategia" && <EstrategiaProducto cliente={clienteActivo === "digitalife" ? "Digitalife" : "{c.nombre}"} />}
        {paginaActiva === "marketing" && React.createElement(MarketingCliente, { cliente: clienteActivo })}
            </>
          )}
      </main>

    </div>
  );
}
