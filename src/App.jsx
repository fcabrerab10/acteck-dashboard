import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from './lib/supabase';

// ─── DATOS REALES — DIGITALIFE (API GLOBAL) ───────────────────────────────────
// Fuentes: Vw_TablaH_Ventas (Sell In), BD Sellout (Sell Out), BD Inventario
// Actualizado: 2026-04-07
const DIGITALIFE_REAL = {
  // Sell In 2026 por mes (desde Vw_TablaH_Ventas â API GLOBAL)
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
    d0_30:  5500000.00,   // vigentes — vencen en â¤ 30 días
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

const ML_SELLOUT_DEFAULT = {
  sellOut: {},
  sellOutMarca: {},
  sellOutPorMesMarca: {},
  totalOrdenes: 0,
  totalMonto: 0,
};

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
  if (kpis.cuotaAcumulada === 0) return "verde";
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
    "vencida":    { bg: "bg-red-100",    text: "text-red-700",    icon: "â ️" },
    "por vencer": { bg: "bg-yellow-100", text: "text-yellow-700", icon: "🕐" },
    "vigente":    { bg: "bg-green-100",  text: "text-green-700",  icon: "â" },
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
            <span className="text-base shrink-0">{a.cumplido ? "â" : "â¬"}</span>
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


function TarjetaSellOutMarca({ sellOutMarca, totalMonto }) {
  const marcas = Object.entries(sellOutMarca || {}).sort((a, b) => b[1] - a[1]);
  const colores = { ACTECK: "#DC2626", "BALAM RUSH": "#2563EB", OTRO: "#6B7280" };
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">🏷️</span>
        <h3 className="font-semibold text-gray-800">Sell Out por Marca (ML)</h3>
      </div>
      <div className="space-y-3">
        {marcas.map(([marca, monto]) => {
          const pct = totalMonto > 0 ? ((monto / totalMonto) * 100) : 0;
          return (
            <div key={marca}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium" style={{ color: colores[marca] || "#6B7280" }}>{marca}</span>
                <span className="text-gray-600">{"$"}{Math.round(monto).toLocaleString("es-MX")}</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2.5">
                <div className="h-2.5 rounded-full" style={{ width: pct + "%", backgroundColor: colores[marca] || "#6B7280" }}></div>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">{pct.toFixed(0)}% del total</p>
            </div>
          );
        })}
      </div>
      <div className="mt-4 pt-3 border-t border-gray-100 text-sm text-gray-500">
        Total sell-out ML <span className="font-semibold text-gray-800">{"$"}{Math.round(totalMonto).toLocaleString("es-MX")}</span>
      </div>
      <div className="text-xs text-gray-400 mt-1">{Math.round(totalMonto) > 0 ? (marcas.length + " marcas · " + Math.round(totalMonto).toLocaleString("es-MX") + " total") : ""}</div>
    </div>
  );
}

function TarjetaTendenciaML({ sellOutPorMesMarca }) {
  const meses = ["", "Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  const data = Object.entries(sellOutPorMesMarca || {}).sort((a, b) => Number(a[0]) - Number(b[0]));
  const maxTotal = Math.max(...data.map(([, v]) => (v.ACTECK || 0) + (v["BALAM RUSH"] || 0) + (v.OTRO || 0)), 1);
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-lg">📈</span>
        <h3 className="font-semibold text-gray-800">Tendencia Sell Out ML por Mes</h3>
      </div>
      <div className="space-y-3">
        {data.map(([mes, vals]) => {
          const act = vals.ACTECK || 0; const br = vals["BALAM RUSH"] || 0; const otro = vals.OTRO || 0;
          const total = act + br + otro;
          return (
            <div key={mes}>
              <div className="flex justify-between text-sm mb-1">
                <span className="font-medium text-gray-700">{meses[Number(mes)]}</span>
                <span className="text-gray-600">{"$"}{Math.round(total).toLocaleString("es-MX")}</span>
              </div>
              <div className="flex w-full h-3 rounded-full overflow-hidden bg-gray-100">
                <div style={{ width: ((act/maxTotal)*100)+"%", backgroundColor: "#DC2626" }}></div>
                <div style={{ width: ((br/maxTotal)*100)+"%", backgroundColor: "#2563EB" }}></div>
                <div style={{ width: ((otro/maxTotal)*100)+"%", backgroundColor: "#D1D5DB" }}></div>
              </div>
              <div className="flex gap-3 text-xs text-gray-400 mt-0.5">
                <span>Acteck: {"$"}{Math.round(act).toLocaleString("es-MX")}</span>
                <span>BR: {"$"}{Math.round(br).toLocaleString("es-MX")}</span>
                <span>Otro: {"$"}{Math.round(otro).toLocaleString("es-MX")}</span>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-4 mt-3 pt-2 border-t border-gray-100 text-xs text-gray-400">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-600"></span>Acteck</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-600"></span>Balam Rush</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300"></span>Otro</span>
      </div>
    </div>
  );
}

function HomeCliente({ cliente, clienteKey, onUploadComplete, isML }) {

  // ML-specific view
  if (isML) {
    const mesesNombres = ["","Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    const mesesData = Object.keys(cliente.sellOutPorMesMarca || {}).sort((a,b) => Number(a) - Number(b));
    const lastMes = mesesData.length > 0 ? mesesData[mesesData.length - 1] : null;
    const mesLabel = lastMes ? mesesNombres[Number(lastMes)] : "---";
    const sellOutMes = lastMes && cliente.tendencia && cliente.tendencia.sellOut ? cliente.tendencia.sellOut[cliente.tendencia.sellOut.length - 1] || 0 : 0;
    const acumulado = cliente.totalMonto || 0;
    const ordenes = cliente.totalOrdenes || 0;
    const ticketProm = ordenes > 0 ? Math.round(acumulado / ordenes) : 0;
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">💰</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Sell Out {mesLabel}</span>
            </div>
            <p className="text-2xl font-bold text-blue-700">{"$"}{sellOutMes.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📈</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Acumulado 2026</span>
            </div>
            <p className="text-2xl font-bold text-green-700">{"$"}{acumulado.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">📋</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Total Ordenes 2026</span>
            </div>
            <p className="text-2xl font-bold text-purple-700">{ordenes.toLocaleString("es-MX")}</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-lg">🎯</span>
              <span className="text-xs text-gray-500 font-semibold uppercase">Ticket Promedio</span>
            </div>
            <p className="text-2xl font-bold text-orange-700">{"$"}{ticketProm.toLocaleString("es-MX")}</p>
          </div>
        </div>
        <TarjetaSellOutMarca sellOutMarca={cliente.sellOutMarca} totalMonto={cliente.totalMonto} />
        <TarjetaTendenciaML sellOutPorMesMarca={cliente.sellOutPorMesMarca} />
        {cliente.pendientes && cliente.pendientes.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
            <h3 className="font-semibold text-gray-700 mb-3">Pendientes</h3>
            <ul className="space-y-2">
              {cliente.pendientes.map((p, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                  <span className="text-yellow-500 mt-0.5">⚠️</span>
                  <span>{p}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }
  const [ventas, setVentas] = React.useState([]);
  const [meta, setMeta] = React.useState({ meta_sell_in_min: 25000000, meta_sell_in_optimista: 30000000 });
  const [pendCom, setPendCom] = React.useState([]);
  const [pendMkt, setPendMkt] = React.useState([]);
  const [invMkt, setInvMkt] = React.useState([]);
  const [minutasList, setMinutasList] = React.useState([]);
  const [invCliente, setInvCliente] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [editingMeta, setEditingMeta] = React.useState(false);
  const [metaForm, setMetaForm] = React.useState({ min: 25000000, opt: 30000000 });
  const [periodoTipo, setPeriodoTipo] = React.useState('ytd');
  const [periodoMes, setPeriodoMes] = React.useState(new Date().getMonth() + 1);
  const [periodoRango, setPeriodoRango] = React.useState([1, 12]);
  const [cuotasMensuales, setCuotasMensuales] = React.useState([]);

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
      supabase.from("inventario_cliente").select("valor").eq("cliente", clienteKey),
      supabase.from("cuotas_mensuales").select("*").eq("cliente", clienteKey).eq("anio", 2026),
    ]).then(([vR, mR, pcR, pmR, imR, minR, invCR, cuotasR]) => {
      setVentas(vR.data || []);
      if (mR.data) { setMeta(mR.data); setMetaForm({ min: mR.data.meta_sell_in_min, opt: mR.data.meta_sell_in_optimista }); }
      setPendCom(pcR.data || []);
      setPendMkt(pmR.data || []);
      setInvMkt(imR.data || []);
      setMinutasList(minR.data || []);
      setInvCliente(invCR.data || []);
      setCuotasMensuales(cuotasR?.data || []);
      setLoading(false);
    });
  }, [clienteKey]);

  // ─── DERIVED DATA ───────────────────────────────────────────────────────────
  const ventasPorMes = React.useMemo(() => {
    const map = {};
    ventas.forEach(v => { map[parseInt(v.mes)] = v; });
    return map;
  }, [ventas]);

  // ─── CUOTAS POR MES (from cuotas_mensuales table) ────────────────────────
  const cuotasPorMes = React.useMemo(() => {
    const map = {};
    cuotasMensuales.forEach(c => { map[parseInt(c.mes)] = c; });
    return map;
  }, [cuotasMensuales]);

  // ─── PERIOD FILTER ────────────────────────────────────────────────────────
  const mesesFiltrados = React.useMemo(() => {
    if (periodoTipo === 'ytd') return Array.from({length: 12}, (_, i) => i + 1);
    if (periodoTipo === 'mes') return [periodoMes];
    if (periodoTipo === 'trimestre') {
      const t = Math.ceil(periodoMes / 3);
      const start = (t - 1) * 3 + 1;
      return [start, start + 1, start + 2];
    }
    if (periodoTipo === 'rango') {
      const arr = [];
      for (let i = periodoRango[0]; i <= periodoRango[1]; i++) arr.push(i);
      return arr;
    }
    return Array.from({length: 12}, (_, i) => i + 1);
  }, [periodoTipo, periodoMes, periodoRango]);

  const ventasFiltradas = React.useMemo(() => {
    return ventas.filter(v => mesesFiltrados.includes(parseInt(v.mes)));
  }, [ventas, mesesFiltrados]);

  const totalSellIn = ventasFiltradas.reduce((s, v) => s + (Number(v.sell_in) || 0), 0);
  const totalSellOut = ventasFiltradas.reduce((s, v) => s + (Number(v.sell_out) || 0), 0);
  const totalCuotaMin = mesesFiltrados.reduce((s, m) => s + (cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_min) || 0 : 0), 0);
  const totalCuotaIdeal = mesesFiltrados.reduce((s, m) => s + (cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_ideal) || 0 : 0), 0);
  const cumplimientoMin = totalCuotaMin > 0 ? (totalSellIn / totalCuotaMin * 100) : 0;
  const cumplimientoIdeal = totalCuotaIdeal > 0 ? (totalSellIn / totalCuotaIdeal * 100) : 0;
  const totalInvValor = ventas.reduce((s, v) => s + (Number(v.inventario_valor) || 0), 0);
  const avgInvValor = ventas.length > 0 ? totalInvValor / ventas.length : 0;
  const lastInvValor = ventas.length > 0 ? Number(ventas[ventas.length - 1].inventario_valor) || 0 : 0;
  const totalInvCliente = invCliente.reduce((s, r) => s + (Number(r.valor) || 0), 0);

  const totalInversionMkt = invMkt.reduce((s, v) => s + (Number(v.monto) || 0), 0);
  const costoXPeso = totalSellOut > 0 ? totalInversionMkt / totalSellOut : 0;
  const roiMkt = totalInversionMkt > 0 ? totalSellOut / totalInversionMkt : 0;
  const cuotaAcumulada = ventas.reduce((s, v) => s + (Number(v.cuota) || 0), 0);
  const ultimoMesData = ventas.length > 0 ? ventas[ventas.length - 1] : null;
  const diasInventario = ultimoMesData && Number(ultimoMesData.sell_out) > 0 ? Math.round((Number(ultimoMesData.inventario_valor) || 0) / (Number(ultimoMesData.sell_out) / 30)) : 0;
  const estadoSalud = calcularSalud({ cuotaAcumulada, sellInAcumulado: totalSellIn, diasInventario }, []);

  // ─── SVG LINE CHART ─────────────────────────────────────────────────────────
  function LineChartSellInOut() {
  const W = 780, H = 340, PAD = { t: 40, r: 70, b: 50, l: 75 };
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;

  const data = [];
  for (let m = 1; m <= 12; m++) {
    const v = ventasPorMes[m];
    data.push({
      mes: m,
      sellIn: v ? Number(v.sell_in) || 0 : null,
      sellOut: v ? Number(v.sell_out) || 0 : null,
      cuota: cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_ideal) || 0 : (v ? Number(v.cuota) || 0 : null), cuotaMin: cuotasPorMes[m] ? Number(cuotasPorMes[m].cuota_min) || 0 : null,
      inventario: v ? Number(v.inventario_valor) || 0 : null
    });
  }
  const hasData = data.filter(d => d.sellIn !== null);
  if (hasData.length === 0) return React.createElement("div", { style: { textAlign: "center", padding: 40, color: "#94A3B8" } }, "Sin datos de ventas a\u00fan");

  // Primary Y axis: money values (Sell In, Sell Out, Cuota, Inventario)
  const moneyVals = hasData.flatMap(d => [d.sellIn, d.sellOut, d.cuota, d.inventario].filter(v => v !== null && v > 0));
  const maxMoney = Math.max(...moneyVals, 1) * 1.12;
  const minMoney = 0;
  const rangeMoney = maxMoney - minMoney || 1;

  // Secondary Y axis: cumplimiento % (sell_in / cuota * 100)
  const cumpData = hasData.filter(d => d.cuota > 0).map(d => ({ mes: d.mes, pct: (d.sellIn / d.cuota) * 100 }));
  const maxPct = cumpData.length > 0 ? Math.max(...cumpData.map(d => d.pct), 100) * 1.1 : 120;
  const minPct = 0;
  const rangePct = maxPct - minPct || 1;

  const x = (m) => PAD.l + ((m - 1) / 11) * plotW;
  const yMoney = (val) => PAD.t + plotH - ((val - minMoney) / rangeMoney) * plotH;
  const yPct = (val) => PAD.t + plotH - ((val - minPct) / rangePct) * plotH;

  // Build polyline strings
  const lineSI = hasData.map(d => x(d.mes) + "," + yMoney(d.sellIn)).join(" ");
  const lineSO = hasData.map(d => x(d.mes) + "," + yMoney(d.sellOut)).join(" ");
  const lineCuota = hasData.filter(d => d.cuota > 0).map(d => x(d.mes) + "," + yMoney(d.cuota)).join(" ");
  const lineInv = hasData.filter(d => d.inventario > 0).map(d => x(d.mes) + "," + yMoney(d.inventario)).join(" ");
  const lineCump = cumpData.map(d => x(d.mes) + "," + yPct(d.pct)).join(" ");

  // Area fill paths (Sell In)
  const areaSI = "M" + hasData.map(d => x(d.mes) + "," + yMoney(d.sellIn)).join("L") + "L" + x(hasData[hasData.length-1].mes) + "," + yMoney(0) + "L" + x(hasData[0].mes) + "," + yMoney(0) + "Z";
  // Area fill (Sell Out)
  const areaSO = "M" + hasData.map(d => x(d.mes) + "," + yMoney(d.sellOut)).join("L") + "L" + x(hasData[hasData.length-1].mes) + "," + yMoney(0) + "L" + x(hasData[0].mes) + "," + yMoney(0) + "Z";

  const gridLines = 6;
  const gridVals = Array.from({ length: gridLines }, (_, i) => minMoney + (rangeMoney / (gridLines - 1)) * i);
  const pctGridVals = [0, 25, 50, 75, 100, maxPct > 100 ? Math.ceil(maxPct / 25) * 25 : null].filter(v => v !== null && v <= maxPct * 1.05);

  const [hover, setHover] = React.useState(null);
  const [activeLines, setActiveLines] = React.useState({ sellIn: true, sellOut: true, cuota: true, inventario: true, cumplimiento: true });

  const toggleLine = (key) => { setActiveLines(prev => Object.assign({}, prev, { [key]: !prev[key] })); };

  const series = [
    { key: "sellIn", label: "Sell In", color: "#3B82F6", dash: "" },
    { key: "sellOut", label: "Sell Out", color: "#10B981", dash: "" },
    { key: "cuota", label: "Cuota", color: "#F59E0B", dash: "8,4" },
    { key: "inventario", label: "Inventario", color: "#8B5CF6", dash: "4,4" },
    { key: "cumplimiento", label: "Cumplimiento %", color: "#EF4444", dash: "2,4" }
  ];

  return React.createElement("svg", { viewBox: "0 0 " + W + " " + H, style: { width: "100%", maxWidth: 820, fontFamily: "system-ui" } },
    // Defs for gradients
    React.createElement("defs", null,
      React.createElement("linearGradient", { id: "gradSI", x1: "0", y1: "0", x2: "0", y2: "1" },
        React.createElement("stop", { offset: "0%", stopColor: "#3B82F6", stopOpacity: 0.18 }),
        React.createElement("stop", { offset: "100%", stopColor: "#3B82F6", stopOpacity: 0.02 })
      ),
      React.createElement("linearGradient", { id: "gradSO", x1: "0", y1: "0", x2: "0", y2: "1" },
        React.createElement("stop", { offset: "0%", stopColor: "#10B981", stopOpacity: 0.15 }),
        React.createElement("stop", { offset: "100%", stopColor: "#10B981", stopOpacity: 0.02 })
      )
    ),
    // Background
    React.createElement("rect", { x: PAD.l, y: PAD.t, width: plotW, height: plotH, fill: "#FAFBFD", rx: 4 }),
    // Grid lines (horizontal)
    gridVals.map((v, i) => React.createElement("g", { key: "g" + i },
      React.createElement("line", { x1: PAD.l, y1: yMoney(v), x2: W - PAD.r, y2: yMoney(v), stroke: "#E2E8F0", strokeWidth: 0.8, strokeDasharray: i === 0 ? "" : "3,3" }),
      React.createElement("text", { x: PAD.l - 10, y: yMoney(v) + 4, textAnchor: "end", fontSize: 10, fill: "#94A3B8", fontWeight: 500 },
        v >= 1e6 ? "$" + (v / 1e6).toFixed(1) + "M" : "$" + (v / 1e3).toFixed(0) + "K")
    )),
    // Right Y axis labels (%)
    pctGridVals.map((v, i) => React.createElement("g", { key: "p" + i },
      React.createElement("line", { x1: W - PAD.r, y1: yPct(v), x2: W - PAD.r + 5, y2: yPct(v), stroke: "#FCA5A5", strokeWidth: 0.8 }),
      React.createElement("text", { x: W - PAD.r + 10, y: yPct(v) + 4, textAnchor: "start", fontSize: 10, fill: "#EF4444", fontWeight: 500 }, v + "%")
    )),
    // 100% reference line
    React.createElement("line", { x1: PAD.l, y1: yPct(100), x2: W - PAD.r, y2: yPct(100), stroke: "#FCA5A5", strokeWidth: 0.8, strokeDasharray: "6,4", opacity: 0.6 }),
    // X axis labels
    MESES_CORTOS.map((m, i) => React.createElement("text", { key: "m" + i, x: x(i + 1), y: H - 12, textAnchor: "middle", fontSize: 11, fill: "#64748B", fontWeight: 500 }, m)),
    // Axis labels
    React.createElement("text", { x: 14, y: H / 2, textAnchor: "middle", fontSize: 10, fill: "#94A3B8", transform: "rotate(-90 14 " + H / 2 + ")" }, "Monto (MXN)"),
    React.createElement("text", { x: W - 8, y: H / 2, textAnchor: "middle", fontSize: 10, fill: "#EF4444", transform: "rotate(90 " + (W - 8) + " " + H / 2 + ")" }, "Cumplimiento %"),
    // Area fills
    activeLines.sellIn && React.createElement("path", { d: areaSI, fill: "url(#gradSI)" }),
    activeLines.sellOut && React.createElement("path", { d: areaSO, fill: "url(#gradSO)" }),
    // Lines
    activeLines.sellIn && React.createElement("polyline", { points: lineSI, fill: "none", stroke: "#3B82F6", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
    activeLines.sellOut && React.createElement("polyline", { points: lineSO, fill: "none", stroke: "#10B981", strokeWidth: 2.5, strokeLinejoin: "round", strokeLinecap: "round" }),
    activeLines.cuota && lineCuota && React.createElement("polyline", { points: lineCuota, fill: "none", stroke: "#F59E0B", strokeWidth: 2, strokeLinejoin: "round", strokeDasharray: "8,4" }),
    activeLines.inventario && lineInv && React.createElement("polyline", { points: lineInv, fill: "none", stroke: "#8B5CF6", strokeWidth: 2, strokeLinejoin: "round", strokeDasharray: "4,4" }),
    activeLines.cumplimiento && lineCump && React.createElement("polyline", { points: lineCump, fill: "none", stroke: "#EF4444", strokeWidth: 2, strokeLinejoin: "round", strokeDasharray: "2,4" }),
    // Data points Sell In
    activeLines.sellIn && hasData.map(d => React.createElement("circle", { key: "si" + d.mes, cx: x(d.mes), cy: yMoney(d.sellIn), r: 4.5, fill: "#3B82F6", stroke: "#fff", strokeWidth: 2, style: { cursor: "pointer", filter: "drop-shadow(0 1px 2px rgba(59,130,246,0.3))" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Sell Out
    activeLines.sellOut && hasData.map(d => React.createElement("circle", { key: "so" + d.mes, cx: x(d.mes), cy: yMoney(d.sellOut), r: 4.5, fill: "#10B981", stroke: "#fff", strokeWidth: 2, style: { cursor: "pointer", filter: "drop-shadow(0 1px 2px rgba(16,185,129,0.3))" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Cuota
    activeLines.cuota && hasData.filter(d => d.cuota > 0).map(d => React.createElement("circle", { key: "cu" + d.mes, cx: x(d.mes), cy: yMoney(d.cuota), r: 3.5, fill: "#F59E0B", stroke: "#fff", strokeWidth: 1.5, style: { cursor: "pointer" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Inventario
    activeLines.inventario && hasData.filter(d => d.inventario > 0).map(d => React.createElement("circle", { key: "iv" + d.mes, cx: x(d.mes), cy: yMoney(d.inventario), r: 3.5, fill: "#8B5CF6", stroke: "#fff", strokeWidth: 1.5, style: { cursor: "pointer" }, onMouseEnter: () => setHover(d), onMouseLeave: () => setHover(null) })),
    // Data points Cumplimiento
    activeLines.cumplimiento && cumpData.map(d => React.createElement("circle", { key: "cp" + d.mes, cx: x(d.mes), cy: yPct(d.pct), r: 3.5, fill: "#EF4444", stroke: "#fff", strokeWidth: 1.5, style: { cursor: "pointer" } })),
    // Interactive Legend
    series.map((s, i) => React.createElement("g", { key: "lg" + i, style: { cursor: "pointer" }, onClick: () => toggleLine(s.key), opacity: activeLines[s.key] ? 1 : 0.35 },
      React.createElement("rect", { x: PAD.l + i * 130, y: 6, width: 120, height: 22, rx: 11, fill: activeLines[s.key] ? s.color + "15" : "#f1f5f9", stroke: activeLines[s.key] ? s.color + "40" : "#e2e8f0", strokeWidth: 1 }),
      React.createElement("circle", { cx: PAD.l + i * 130 + 14, cy: 17, r: 4, fill: s.color }),
      React.createElement("text", { x: PAD.l + i * 130 + 24, y: 21, fontSize: 10.5, fill: activeLines[s.key] ? "#334155" : "#94a3b8", fontWeight: 600 }, s.label)
    )),
    // Tooltip
    hover && React.createElement("g", null,
      React.createElement("line", { x1: x(hover.mes), y1: PAD.t, x2: x(hover.mes), y2: PAD.t + plotH, stroke: "#CBD5E1", strokeWidth: 1, strokeDasharray: "4,3" }),
      React.createElement("rect", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185), y: PAD.t + 6, width: 180, height: hover.cuota > 0 ? 96 : 56, rx: 8, fill: "#1E293B", opacity: 0.94, filter: "drop-shadow(0 4px 12px rgba(0,0,0,0.15))" }),
      React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 90, y: PAD.t + 24, textAnchor: "middle", fontSize: 11, fill: "#E2E8F0", fontWeight: 700 }, MESES_CORTOS[hover.mes - 1] + " 2026"),
      React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 40, fontSize: 10.5, fill: "#93C5FD" }, "\u25CF Sell In: " + formatMXN(hover.sellIn)),
      React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 54, fontSize: 10.5, fill: "#6EE7B7" }, "\u25CF Sell Out: " + formatMXN(hover.sellOut)),
      hover.cuota > 0 && React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 68, fontSize: 10.5, fill: "#FCD34D" }, "\u25CF Cuota: " + formatMXN(hover.cuota)),
      hover.cuota > 0 && React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + 82, fontSize: 10.5, fill: "#FCA5A5" }, "\u25CF Cump: " + ((hover.sellIn / hover.cuota) * 100).toFixed(1) + "%"),
      hover.inventario > 0 && React.createElement("text", { x: Math.min(x(hover.mes) - 90, W - PAD.r - 185) + 12, y: PAD.t + (hover.cuota > 0 ? 96 : 68), fontSize: 10.5, fill: "#C4B5FD" }, "\u25CF Inv: " + formatMXN(hover.inventario))
    )
  );
}

  // ─── PROGRESS BAR ──────────────────────────────────────────────────────────
  function ProgresoAnual() {
    const cuotaIdealEff = totalCuotaIdeal > 0 ? totalCuotaIdeal : meta.meta_sell_in_optimista;
    const cuotaMinEff = totalCuotaMin > 0 ? totalCuotaMin : meta.meta_sell_in_min;
    const pctOpt = cuotaIdealEff > 0 ? (totalSellIn / cuotaIdealEff) * 100 : 0;
    const pctMin = cuotaMinEff > 0 ? (totalSellIn / cuotaMinEff) * 100 : 0;
    const minPctOfOpt = cuotaIdealEff > 0 ? (cuotaMinEff / cuotaIdealEff) * 100 : 0;

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
        pctOpt.toFixed(1) + "% de cuota ideal (" + formatMXN(cuotaIdealEff) + ")"),
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
        React.createElement("span", { style: { color: "#F59E0B" } }, "M\u00edn: " + formatMXN(cuotaMinEff)),
        React.createElement("span", null, formatMXN(cuotaIdealEff))
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
      React.createElement("div", { style: { fontSize: 28, fontWeight: 700, color: "#1E293B" } }, formatMXN(totalInvCliente > 0 ? totalInvCliente : lastInvValor)),
      React.createElement("div", { style: { fontSize: 12, color: "#64748B", marginTop: 4 } },
        totalInvCliente > 0 ? invCliente.length + " SKUs en inventario" : (ventas.length > 0 ? "Mes m\u00e1s reciente con datos" : "Sin datos"))
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
    // Row 0: Header with Semaforo
    React.createElement("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "14px 20px" } },
      React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 12 } },
        React.createElement("h2", { style: { fontSize: 18, fontWeight: 700, color: "#1E293B", margin: 0 } }, (cliente && cliente.nombre ? cliente.nombre : clienteKey)),
        React.createElement("span", { style: { fontSize: 13, color: "#94A3B8" } }, "Acteck / Balam Rush")
      ),
      React.createElement(Semaforo, { estado: estadoSalud })
    ),
    // Row 0.5: Period selector
    React.createElement("div", { style: { background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", padding: "12px 20px", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" } },
      React.createElement("span", { style: { fontSize: 13, fontWeight: 600, color: "#334155" } }, "Periodo:"),
      ["ytd", "mes", "trimestre", "rango"].map(t => 
        React.createElement("button", {
          key: t,
          onClick: () => setPeriodoTipo(t),
          style: {
            padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
            border: periodoTipo === t ? "2px solid #4472C4" : "1px solid #E2E8F0",
            background: periodoTipo === t ? "#EFF6FF" : "#fff",
            color: periodoTipo === t ? "#4472C4" : "#64748B"
          }
        }, t === "ytd" ? "Acumulado YTD" : t === "mes" ? "Mes" : t === "trimestre" ? "Trimestre" : "Rango")
      ),
      periodoTipo === "mes" && React.createElement("select", {
        value: periodoMes,
        onChange: e => setPeriodoMes(Number(e.target.value)),
        style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
      }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m))),
      periodoTipo === "trimestre" && React.createElement("select", {
        value: Math.ceil(periodoMes / 3),
        onChange: e => setPeriodoMes((Number(e.target.value) - 1) * 3 + 1),
        style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
      }, [1,2,3,4].map(q => React.createElement("option", { key: q, value: q }, "Q" + q))),
      periodoTipo === "rango" && React.createElement(React.Fragment, null,
        React.createElement("select", {
          value: periodoRango[0],
          onChange: e => setPeriodoRango([Number(e.target.value), periodoRango[1]]),
          style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
        }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m))),
        React.createElement("span", { style: { color: "#94A3B8" } }, "a"),
        React.createElement("select", {
          value: periodoRango[1],
          onChange: e => setPeriodoRango([periodoRango[0], Number(e.target.value)]),
          style: { padding: "6px 10px", borderRadius: 8, border: "1px solid #CBD5E1", fontSize: 12 }
        }, MESES_CORTOS.map((m, i) => React.createElement("option", { key: i, value: i + 1 }, m)))
      ),
      // Cuota summary
      totalCuotaIdeal > 0 && React.createElement("div", { style: { marginLeft: "auto", display: "flex", gap: 16, fontSize: 12 } },
        React.createElement("span", { style: { color: "#F59E0B", fontWeight: 600 } }, "Cuota Min: " + formatMXN(totalCuotaMin)),
        React.createElement("span", { style: { color: "#E67C73", fontWeight: 600 } }, "Cuota Ideal: " + formatMXN(totalCuotaIdeal)),
        React.createElement("span", { style: { color: cumplimientoMin >= 100 ? "#10B981" : cumplimientoMin >= 80 ? "#F59E0B" : "#EF4444", fontWeight: 700 } }, "Cump: " + cumplimientoMin.toFixed(1) + "%")
      )
    ),
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
          <span className="text-red-500 text-xl">â ️</span>
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
              { label: "0 – 30 días",  monto: ag.d0_30,  color: "#22c55e", bg: "bg-green-500",  tag: "bg-green-100 text-green-700",  icono: "â" },
              { label: "31 – 60 días", monto: ag.d31_60, color: "#3b82f6", bg: "bg-blue-400",   tag: "bg-blue-100 text-blue-700",    icono: "🔵" },
              { label: "61 – 90 días", monto: ag.d61_90, color: "#eab308", bg: "bg-yellow-400", tag: "bg-yellow-100 text-yellow-700", icono: "â ️" },
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
    if (error) { flash("Error al guardar â", "err"); fetchData(); }
    else flash("Guardado â");
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
    if (error) { flash("Error al agregar â", "err"); return; }
    setRegistros(prev => [...prev, data]);
    setNewRow({ folio: "", concepto: "", categoria: "promociones", monto: "",
                estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
                responsable: "", notas: "" });
    setShowAdd(false);
    flash("Registro agregado â");
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
    if (error) { flash("Error al crear pagos fijos â", "err"); return; }
    setRegistros(prev => [...prev, ...data]);
    setNewFijo({ concepto: "", monto: "", responsable: "" });
    setShowAddFijo(false);
    flash(`12 meses de "${newFijo.concepto}" creados â`);
  };

  // ── Delete record ──
  const handleDelete = async (id) => {
    if (!window.confirm("Â¿Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setRegistros(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { flash("Error al eliminar â", "err"); fetchData(); }
    else flash("Eliminado â");
  };

  // ── Delete all months of a fijo concept ──
  const handleDeleteFijo = async (conceptoKey, ids) => {
    if (!window.confirm(`Â¿Eliminar todos los meses de "${conceptoKey}"? Esta acción no se puede deshacer.`)) return;
    setRegistros(prev => prev.filter(r => !ids.includes(r.id)));
    for (const id of ids) {
      await supabase.from("pagos").delete().eq("id", id);
    }
    flash(`"${conceptoKey}" eliminado â`);
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
                {saving && <span className="ml-2 text-blue-400 animate-pulse">â Guardando...</span>}
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
              {DB_CONFIGURED ? "â Sincronizado" : "â ️ Solo lectura"}
            </span>
          </div>
        </div>
      </div>

      {/* Banner de configuración pendiente */}
      {!DB_CONFIGURED && (
        <div className="bg-orange-50 border border-orange-200 rounded-2xl p-5 mb-6 flex items-start gap-3">
          <span className="text-2xl">â️</span>
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
                    ï¼ Nuevo Pago Fijo
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
                          <span className={`text-gray-400 transition-transform ${isOpen ? "rotate-90" : ""}`} style={{ fontSize: "12px" }}>â¶</span>
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
                    ï¼ Agregar
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
                  {DB_CONFIGURED ? "â Cambios guardados y sincronizados para todo el equipo." : "â ️ Modo lectura — configura Supabase para habilitar la edición."}
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

// ——— ESTRATEGIA DE PRODUCTO (Excel Upload + Data Display) ———
function EstrategiaProducto({ cliente, clienteKey, onUploadComplete }) {
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [datos, setDatos] = React.useState(null);
  const [searchFilter, setSearchFilter] = React.useState("");
  const [sortBy, setSortBy] = React.useState("sell-in");
  const [sugeridoEdits, setSugeridoEdits] = React.useState({});

  const formatMXN = (n) => {
    if (n == null || isNaN(n)) return "—";
    return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const MARCA_COLORES = {
    "ACTECK": "#3B82F6",
    "Balam Rush": "#8B5CF6",
  };

  const ESTADO_COLORES = {
    "D": "#10B981",
    "NVS": "#F59E0B",
    "RMI": "#3B82F6",
    "RML": "#8B5CF6",
  };

  const MESES_ABREV = { 1:"Ene", 2:"Feb", 3:"Mar", 4:"Abr", 5:"May", 6:"Jun", 7:"Jul", 8:"Ago", 9:"Sep", 10:"Oct", 11:"Nov", 12:"Dic" };

  // Parse Excel Reporte Acteck
  const parseActeck = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = window.XLSX.read(e.target.result, { cellDates: true });
          const sheetTD = wb.Sheets["TD Ventas"];
          const sheetMaster = wb.Sheets["Master"];

          if (!sheetTD || !sheetMaster) return reject("Hojas no encontradas");

          // Parse TD Ventas (pivot already filtered by client)
          const rangeTD = sheetTD['!ref'];
          const productos = [];

          if (rangeTD) {
            const decoded = window.XLSX.utils.decode_range(rangeTD);
            for (let r = 6; r <= decoded.e.r; r++) {
              const skuCell = sheetTD[window.XLSX.utils.encode_cell({r, c: 0})];
              const sku = skuCell ? skuCell.v : null;
              if (!sku || sku === "Total") break;

              const prod = { sku: String(sku).trim(), meses: {} };

              // Extract 2026 months from columns (cols 22+ for 2026, 3 columns per month: cost, amount, piezas)
              let colOffset = 22;
              for (let mes = 1; mes <= 12; mes++) {
                const piezasIdx = colOffset + (mes - 1) * 3 + 2;
                const montoIdx = colOffset + (mes - 1) * 3 + 1;
                const piezasCell = sheetTD[window.XLSX.utils.encode_cell({r, c: piezasIdx})];
                const montoCell = sheetTD[window.XLSX.utils.encode_cell({r, c: montoIdx})];
                const piezas = piezasCell ? Number(piezasCell.v) || 0 : 0;
                const monto = montoCell ? Number(montoCell.v) || 0 : 0;
                if (piezas > 0 || monto > 0) {
                  prod.meses[mes] = { piezas, monto };
                }
              }
              if (Object.keys(prod.meses).length > 0) productos.push(prod);
            }
          }

          // Parse Master
          const rangeMaster = sheetMaster['!ref'];
          const masterMap = {};
          if (rangeMaster) {
            const decoded = window.XLSX.utils.decode_range(rangeMaster);
            for (let r = 4; r <= Math.min(decoded.e.r, 500); r++) {
              const skuCell = sheetMaster[window.XLSX.utils.encode_cell({r, c: 1})];
              const sku = skuCell ? String(skuCell.v).trim() : null;
              if (!sku) continue;
              const roadmapCell = sheetMaster[window.XLSX.utils.encode_cell({r, c: 2})];
              const descCell = sheetMaster[window.XLSX.utils.encode_cell({r, c: 3})];
              masterMap[sku] = {
                roadmap: roadmapCell ? String(roadmapCell.v) : "",
                descripcion: descCell ? String(descCell.v) : "",
              };
            }
          }

          productos.forEach(p => {
            const m = masterMap[p.sku];
            if (m) { p.roadmap = m.roadmap; p.descripcion = m.descripcion; }
          });

          resolve(productos);
        } catch (err) {
          reject(err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Parse Excel Resumen Digitalife
  const parseDigitalife = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = window.XLSX.read(e.target.result, { cellDates: true });
          const sheetSellout = wb.Sheets["BD Sellout"];
          const sheetInventario = wb.Sheets["BD Inventario"];
          const sheetRDMP = wb.Sheets["RDMP"];

          if (!sheetSellout || !sheetInventario || !sheetRDMP) return reject("Hojas no encontradas");

          // Parse BD Sellout
          const rangeSO = sheetSellout['!ref'];
          const selloutMap = {};
          if (rangeSO) {
            const decoded = window.XLSX.utils.decode_range(rangeSO);
            for (let r = 1; r <= decoded.e.r; r++) {
              const fechaCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 0})];
              const skuCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 2})];
              const cantCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 4})];
              const totalCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 9})];

              if (!fechaCell || !skuCell) continue;
              const sku = String(skuCell.v).trim();
              const fecha = fechaCell.v instanceof Date ? fechaCell.v : new Date(fechaCell.v);
              const cantidad = cantCell ? Number(cantCell.v) || 0 : 0;
              const total = totalCell ? Number(totalCell.v) || 0 : 0;

              if (sku && fecha && cantidad > 0) {
                const mes = fecha.getMonth() + 1;
                const anio = fecha.getFullYear();
                const key = `${sku}|${anio}|${mes}`;
                if (!selloutMap[key]) selloutMap[key] = { piezas: 0, monto: 0 };
                selloutMap[key].piezas += cantidad;
                selloutMap[key].monto += total;
              }
            }
          }

          // Parse BD Inventario
          const rangeInv = sheetInventario['!ref'];
          const invMap = {};
          if (rangeInv) {
            const decoded = window.XLSX.utils.decode_range(rangeInv);
            for (let r = 1; r <= decoded.e.r; r++) {
              const skuCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 0})];
              if (!skuCell) continue;
              const sku = String(skuCell.v).trim();
              const marcaCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 1})];
              const titleCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 2})];
              const stockCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 3})];
              const costCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 5})];
              const priceCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 6})];
              const valorCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 10})];

              invMap[sku] = {
                marca: marcaCell ? String(marcaCell.v) : "",
                titulo: titleCell ? String(titleCell.v) : "",
                stock: stockCell ? Number(stockCell.v) || 0 : 0,
                costo: costCell ? Number(costCell.v) || 0 : 0,
                precio: priceCell ? Number(priceCell.v) || 0 : 0,
                valor: valorCell ? Number(valorCell.v) || 0 : 0,
              };
            }
          }

          // Parse RDMP
          const rangeRDMP = sheetRDMP['!ref'];
          const productosRDMP = [];
          if (rangeRDMP) {
            const decoded = window.XLSX.utils.decode_range(rangeRDMP);
            for (let r = 6; r <= decoded.e.r; r++) {
              const skuCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 1})];
              if (!skuCell) continue;
              const sku = String(skuCell.v).trim();

              const catCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 2})];
              const roadCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 3})];
              const descCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 4})];
              const estCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 5})];
              const costCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 6})];
              const priceCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 7})];

              const prod = {
                sku,
                categoria: catCell ? String(catCell.v) : "",
                roadmap: roadCell ? String(roadCell.v) : "",
                descripcion: descCell ? String(descCell.v) : "",
                estado: estCell ? String(estCell.v) : "D",
                costo_promedio: costCell ? Number(costCell.v) || 0 : 0,
                precio_venta: priceCell ? Number(priceCell.v) || 0 : 0,
                meses: {},
              };

              prod.marca = sku.startsWith("AC-") ? "ACTECK" : sku.startsWith("BR-") ? "Balam Rush" : "Otro";

              // Extract monthly 2026 data
              let colOffset = 22;
              for (let mes = 1; mes <= 12; mes++) {
                const cellIdx = colOffset + (mes - 1);
                const cell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: cellIdx})];
                const piezas = cell ? Number(cell.v) || 0 : 0;
                if (piezas > 0) prod.meses[mes] = piezas;
              }

              productosRDMP.push(prod);
            }
          }

          resolve({ productosRDMP, selloutMap, invMap });
        } catch (err) {
          reject(err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Upsert to Supabase
  const upsertData = async (tabla, rows, uniqueFields) => {
    if (!DB_CONFIGURED || !supabase) return 0;
    let count = 0;
    const chunks = [];
    for (let i = 0; i < rows.length; i += 50) chunks.push(rows.slice(i, i + 50));

    for (const chunk of chunks) {
      const { error } = await supabase.from(tabla).upsert(chunk, { onConflict: uniqueFields });
      if (!error) count += chunk.length;
    }
    return count;
  };

  // Handle file uploads
  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    setMessage("");
    try {
      let counts = { productos: 0, sellIn: 0, sellOut: 0, inventario: 0 };

      for (const file of files) {
        if (file.name.includes("Acteck")) {
          const productos = await parseActeck(file);
          const rows = productos.map(p => ({
            cliente: clienteKey,
            sku: p.sku,
            categoria: "TBD",
            roadmap: p.roadmap || "",
            descripcion: p.descripcion || "",
            estado: "D",
            costo_promedio: 0,
            precio_venta: 0,
            marca: p.sku.startsWith("AC-") ? "ACTECK" : "Balam Rush",
          }));
          counts.productos += await upsertData("productos_cliente", rows, "cliente,sku");

          for (const prod of productos) {
            for (const [mes, data] of Object.entries(prod.meses)) {
              const sellInRow = {
                cliente: clienteKey,
                sku: prod.sku,
                anio: 2026,
                mes: parseInt(mes),
                piezas: data.piezas,
                monto_pesos: data.monto,
              };
              await supabase.from("sell_in_sku").upsert([sellInRow], { onConflict: "cliente,sku,anio,mes" });
              counts.sellIn++;
            }
          }
        } else if (file.name.includes("Digitalife")) {
          const { productosRDMP, selloutMap, invMap } = await parseDigitalife(file);

          const prodRows = productosRDMP.map(p => ({
            cliente: clienteKey,
            sku: p.sku,
            categoria: p.categoria,
            roadmap: p.roadmap,
            descripcion: p.descripcion,
            estado: p.estado,
            costo_promedio: p.costo_promedio,
            precio_venta: p.precio_venta,
            marca: p.marca,
          }));
          counts.productos += await upsertData("productos_cliente", prodRows, "cliente,sku");

          for (const [key, data] of Object.entries(selloutMap)) {
            const [sku, anio, mes] = key.split("|");
            const row = {
              cliente: clienteKey,
              sku,
              anio: parseInt(anio),
              mes: parseInt(mes),
              piezas: data.piezas,
              monto_pesos: data.monto,
            };
            await supabase.from("sellout_sku").upsert([row], { onConflict: "cliente,sku,anio,mes" });
            counts.sellOut++;
          }

          for (const [sku, inv] of Object.entries(invMap)) {
            const row = {
              cliente: clienteKey,
              sku,
              marca: inv.marca,
              titulo: inv.titulo,
              stock: inv.stock,
              costo_convenio: inv.costo,
              precio_venta: inv.precio,
              valor: inv.valor,
              dias_sin_venta: 0,
              fecha_ultima_venta: null,
            };
            await supabase.from("inventario_cliente").upsert([row], { onConflict: "cliente,sku" });
            counts.inventario++;
          }
        }
      }

      setMessage(`Cargado: ${counts.productos} productos, ${counts.sellIn} registros sell-in, ${counts.sellOut} sell-out, ${counts.inventario} inventario`);
      if (onUploadComplete) onUploadComplete();
      loadData();
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
    setLoading(false);
  };

  // Load data from Supabase
  const loadData = async () => {
    if (!DB_CONFIGURED || !supabase) return;
    setLoading(true);
    try {
      const [productos, sellIn, sellOut, inventario] = await Promise.all([
        supabase.from("productos_cliente").select("*").eq("cliente", clienteKey),
        supabase.from("sell_in_sku").select("*").eq("cliente", clienteKey).eq("anio", 2026),
        supabase.from("sellout_sku").select("*").eq("cliente", clienteKey).eq("anio", 2026),
        supabase.from("inventario_cliente").select("*").eq("cliente", clienteKey),
      ]);

      if (productos.data && sellIn.data && sellOut.data && inventario.data) {
        setDatos({
          productos: productos.data || [],
          sellIn: sellIn.data || [],
          sellOut: sellOut.data || [],
          inventario: inventario.data || [],
        });
      }
    } catch (err) {
      console.error("Error loading data:", err);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    loadData();
  }, [cliente, clienteKey]);

  // Compute aggregations
  const aggs = React.useMemo(() => {
    if (!datos) return null;

    const sellInTotal = datos.sellIn.reduce((s, r) => s + (r.monto_pesos || 0), 0);
    const sellInPiezas = datos.sellIn.reduce((s, r) => s + (r.piezas || 0), 0);
    const sellOutTotal = datos.sellOut.reduce((s, r) => s + (r.monto_pesos || 0), 0);
    const sellOutPiezas = datos.sellOut.reduce((s, r) => s + (r.piezas || 0), 0);
    const invTotal = datos.inventario.reduce((s, r) => s + (r.valor || 0), 0);
    const invPiezas = datos.inventario.reduce((s, r) => s + (r.stock || 0), 0);

    // Find max months
    const siByMes = {};
    const soByMes = {};
    datos.sellIn.forEach(r => { siByMes[r.mes] = (siByMes[r.mes] || 0) + (r.monto_pesos || 0); });
    datos.sellOut.forEach(r => { soByMes[r.mes] = (soByMes[r.mes] || 0) + (r.monto_pesos || 0); });
    const maxSIMes = Object.entries(siByMes).reduce((a, b) => a[1] > b[1] ? a : b, [0, 0])[0];
    const maxSOMes = Object.entries(soByMes).reduce((a, b) => a[1] > b[1] ? a : b, [0, 0])[0];

    // By marca
    const byMarca = {};
    datos.productos.forEach(p => {
      if (!byMarca[p.marca]) byMarca[p.marca] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      const siForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const siMontoForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const soForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const soMontoForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const invForSku = datos.inventario.find(r => r.sku === p.sku);
      byMarca[p.marca].siPiezas += siForSku;
      byMarca[p.marca].siMonto += siMontoForSku;
      byMarca[p.marca].soPiezas += soForSku;
      byMarca[p.marca].soMonto += soMontoForSku;
      if (invForSku) {
        byMarca[p.marca].invPiezas += invForSku.stock || 0;
        byMarca[p.marca].invValor += invForSku.valor || 0;
      }
    });

    // By categoria
    const byCategoria = {};
    datos.productos.forEach(p => {
      const cat = p.categoria || "Sin Categoría";
      if (!byCategoria[cat]) byCategoria[cat] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0 };
      const siForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const siMontoForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const soForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const soMontoForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const invForSku = datos.inventario.find(r => r.sku === p.sku);
      byCategoria[cat].siPiezas += siForSku;
      byCategoria[cat].siMonto += siMontoForSku;
      byCategoria[cat].soPiezas += soForSku;
      byCategoria[cat].soMonto += soMontoForSku;
      if (invForSku) byCategoria[cat].invPiezas += invForSku.stock || 0;
    });

    return {
      sellInTotal, sellInPiezas, sellOutTotal, sellOutPiezas, invTotal, invPiezas,
      maxSIMes, maxSOMes, byMarca, byCategoria,
    };
  }, [datos]);

  // Filtered & sorted SKUs
  const skuDetail = React.useMemo(() => {
    if (!datos) return [];
    return datos.productos
      .filter(p => !searchFilter || p.sku.toUpperCase().includes(searchFilter.toUpperCase()) || p.descripcion.toUpperCase().includes(searchFilter.toUpperCase()))
      .map(p => {
        const siData = datos.sellIn.filter(r => r.sku === p.sku);
        const soData = datos.sellOut.filter(r => r.sku === p.sku);
        const invData = datos.inventario.find(r => r.sku === p.sku);

        const siPiezasTotal = siData.reduce((s, r) => s + (r.piezas || 0), 0);
        const soMontoTotal = soData.reduce((s, r) => s + (r.monto_pesos || 0), 0);
        const promedio90d = siData.slice(-3).length > 0 ? Math.round(siData.slice(-3).reduce((s, r) => s + (r.piezas || 0), 0) / 3) : 0;
        const stock = invData?.stock || 0;
        const sugerido = Math.max(0, promedio90d * 3 - stock);

        return {
          sku: p.sku,
          descripcion: p.descripcion,
          marca: p.marca,
          estado: p.estado,
          siPiezasTotal,
          promedio90d,
          stock,
          sugerido,
          soMontoTotal,
        };
      })
      .sort((a, b) => {
        if (sortBy === "sell-in") return b.siPiezasTotal - a.siPiezasTotal;
        if (sortBy === "inventory") return b.stock - a.stock;
        if (sortBy === "suggested") return b.sugerido - a.sugerido;
        return 0;
      });
  }, [datos, searchFilter, sortBy]);

  // ———— RENDER ————

  if (!datos && !loading) {
    return React.createElement("div", { className: "max-w-4xl mx-auto p-6" },
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6 mb-6" },
        React.createElement("h2", { className: "text-2xl font-bold text-gray-800 mb-4" }, "Estrategia de Producto"),
        React.createElement("p", { className: "text-gray-600 mb-4" }, "Carga archivos Excel para actualizar datos de Sell In, Sell Out e Inventario."),
        React.createElement("div", { className: "space-y-4" },
          React.createElement("div", {
            className: "border-2 border-dashed border-blue-300 rounded-xl p-6 text-center bg-blue-50 cursor-pointer transition-all hover:border-blue-500",
            onClick: () => document.getElementById("file-input").click(),
          },
            React.createElement("p", { className: "text-blue-700 font-semibold mb-2" }, "📁 Selecciona archivos Excel"),
            React.createElement("p", { className: "text-sm text-gray-600" }, "Reporte Acteck y/o Resumen Digitalife"),
            React.createElement("input", {
              id: "file-input",
              type: "file",
              multiple: true,
              accept: ".xlsx,.xls",
              style: { display: "none" },
              onChange: handleUpload,
            }),
          ),
        ),
        message && React.createElement("p", { className: `mt-4 text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}` }, message),
      ),
    );
  }

  return React.createElement("div", { className: "max-w-7xl mx-auto p-6 space-y-6" },
    // Header
    React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("div", { className: "flex justify-between items-start mb-4" },
        React.createElement("h2", { className: "text-2xl font-bold text-gray-800" }, "Estrategia de Producto"),
        React.createElement("button", {
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium",
          onClick: () => document.getElementById("file-input-update").click(),
        }, "📤 Actualizar datos"),
        React.createElement("input", {
          id: "file-input-update",
          type: "file",
          multiple: true,
          accept: ".xlsx,.xls",
          style: { display: "none" },
          onChange: handleUpload,
        }),
      ),
      message && React.createElement("p", { className: `text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}` }, message),
    ),

    // Summary Cards
    aggs && React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6 border-t-4", style: { borderColor: "#4472C4" } },
        React.createElement("p", { className: "text-xs text-gray-400 uppercase tracking-wide mb-2" }, "Sell In"),
        React.createElement("p", { className: "text-2xl font-bold text-gray-800 mb-1" }, formatMXN(aggs.sellInTotal)),
        React.createElement("p", { className: "text-xs text-gray-600 mb-3" }, `${aggs.sellInPiezas.toLocaleString("es-MX")} piezas YTD`),
        React.createElement("p", { className: "text-xs text-gray-500" }, `Mayor: ${MESES_ABREV[aggs.maxSIMes] || "—"}`),
      ),
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6 border-t-4", style: { borderColor: "#8B5CF6" } },
        React.createElement("p", { className: "text-xs text-gray-400 uppercase tracking-wide mb-2" }, "Sell Out"),
        React.createElement("p", { className: "text-2xl font-bold text-gray-800 mb-1" }, formatMXN(aggs.sellOutTotal)),
        React.createElement("p", { className: "text-xs text-gray-600 mb-3" }, `${aggs.sellOutPiezas.toLocaleString("es-MX")} piezas YTD`),
        React.createElement("p", { className: "text-xs text-gray-500" }, `Mayor: ${MESES_ABREV[aggs.maxSOMes] || "—"}`),
      ),
    ),

    // Marca Comparison
    aggs && React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("h3", { className: "font-bold text-gray-800 mb-4" }, "Comparativa por Marca"),
            // Visual bar chart for brand comparison
            React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" } },
              Object.entries(aggs.byMarca).map(function([marca, m]) {
                var total = Object.values(aggs.byMarca).reduce(function(s, x) { return s + x.soMonto; }, 0);
                var pct = total > 0 ? (m.soMonto / total * 100) : 0;
                var color = MARCA_COLORES[marca] || "#64748B";
                return React.createElement("div", { key: "viz_"+marca, style: { flex: 1, minWidth: 200, background: "#F8FAFC", borderRadius: 12, padding: 16, border: "1px solid #E2E8F0" } },
                  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                    React.createElement("span", { style: { fontWeight: 700, color: color, fontSize: 14 } }, marca),
                    React.createElement("span", { style: { fontSize: 12, color: "#94A3B8", fontWeight: 600 } }, pct.toFixed(1) + "% del SO")
                  ),
                  React.createElement("div", { style: { height: 8, background: "#E2E8F0", borderRadius: 4, marginBottom: 12 } },
                    React.createElement("div", { style: { height: "100%", width: pct + "%", background: color, borderRadius: 4 } })
                  ),
                  React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 } },
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Sell In"),
                      React.createElement("div", { style: { fontWeight: 700, color: "#1E293B" } }, formatMXN(m.siMonto))
                    ),
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Sell Out"),
                      React.createElement("div", { style: { fontWeight: 700, color: "#10B981" } }, formatMXN(m.soMonto))
                    ),
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Inventario"),
                      React.createElement("div", { style: { fontWeight: 700, color: "#8B5CF6" } }, formatMXN(m.invValor))
                    ),
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Eficiencia"),
                      React.createElement("div", { style: { fontWeight: 700, color: m.siMonto > 0 ? (m.soMonto/m.siMonto >= 0.8 ? "#10B981" : "#F59E0B") : "#94A3B8" } }, m.siMonto > 0 ? (m.soMonto/m.siMonto*100).toFixed(0) + "%" : "\u2014")
                    )
                  )
                );
              })
            ),
      React.createElement("div", { className: "overflow-x-auto" },
        React.createElement("table", { className: "w-full text-sm" },
          React.createElement("thead", {},
            React.createElement("tr", { className: "border-b border-gray-200" },
              React.createElement("th", { className: "text-left py-2 px-3 font-semibold text-gray-700" }, "Marca"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SI Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SI $"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SO Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SO $"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Inv Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Inv Valor"),
            ),
          ),
          React.createElement("tbody", {},
            Object.entries(aggs.byMarca).map(([marca, m]) =>
              React.createElement("tr", { key: marca, className: "border-b border-gray-100 hover:bg-gray-50" },
                React.createElement("td", { className: "py-3 px-3 text-gray-700 font-medium" }, marca),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, m.siPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(m.siMonto)),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, m.soPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(m.soMonto)),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, m.invPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(m.invValor)),
              )
            ),
          ),
        ),
      ),
    ),

    // By Categoria
    aggs && Object.keys(aggs.byCategoria).length > 0 && React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("h3", { className: "font-bold text-gray-800 mb-4" }, "Por Categoría"),
      React.createElement("div", { className: "overflow-x-auto" },
        React.createElement("table", { className: "w-full text-sm" },
          React.createElement("thead", {},
            React.createElement("tr", { className: "border-b border-gray-200" },
              React.createElement("th", { className: "text-left py-2 px-3 font-semibold text-gray-700" }, "Categoría"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SI Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SI $"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Inv Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SO Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SO $"),
            ),
          ),
          React.createElement("tbody", {},
            Object.entries(aggs.byCategoria).map(([cat, c]) =>
              React.createElement("tr", { key: cat, className: "border-b border-gray-100 hover:bg-gray-50" },
                React.createElement("td", { className: "py-3 px-3 text-gray-700 font-medium" }, cat),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, c.siPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(c.siMonto)),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, c.invPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, c.soPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(c.soMonto)),
              )
            ),
          ),
        ),
      ),
    ),

    // SKU Detail
    React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 } },
              React.createElement("h3", { className: "font-bold text-gray-800" }, "Detalle por SKU"),
              React.createElement("button", {
                onClick: exportToExcel,
                style: { padding: "8px 16px", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6 }
              }, "\uD83D\uDCE5 Exportar a Excel")
            ),
      React.createElement("div", { className: "mb-4 flex gap-3 flex-wrap" },
        React.createElement("input", {
          type: "text",
          placeholder: "Buscar SKU o descripción...",
          value: searchFilter,
          onChange: (e) => setSearchFilter(e.target.value),
          className: "flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm",
        }),
        React.createElement("select", {
          value: sortBy,
          onChange: (e) => setSortBy(e.target.value),
          className: "px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white",
        },
          React.createElement("option", { value: "sell-in" }, "Ordenar: Sell In"),
          React.createElement("option", { value: "inventory" }, "Ordenar: Inventario"),
          React.createElement("option", { value: "suggested" }, "Ordenar: Sugerido"),
        ),
      ),
      React.createElement("div", { className: "space-y-4" },
        skuDetail.map(sku =>
          React.createElement("div", { key: sku.sku, className: "border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow" },
            React.createElement("div", { className: "flex justify-between items-start mb-3" },
              React.createElement("div", { className: "flex-1" },
                React.createElement("div", { className: "flex items-center gap-2 mb-1" },
                  React.createElement("p", { className: "font-bold text-gray-800" }, sku.sku),
                  React.createElement("span", {
                    className: "text-xs font-semibold px-2 py-1 rounded-full text-white",
                    style: { backgroundColor: ESTADO_COLORES[sku.estado] || "#999" },
                  }, sku.estado),
                  React.createElement("span", {
                    className: "text-xs font-semibold px-2 py-1 rounded-full text-white",
                    style: { backgroundColor: MARCA_COLORES[sku.marca] || "#999" },
                  }, sku.marca),
                ),
                React.createElement("p", { className: "text-sm text-gray-600" }, sku.descripcion),
              ),
            ),
            React.createElement("div", { className: "grid grid-cols-2 md:grid-cols-4 gap-3 text-sm mb-3" },
              React.createElement("div", { className: "bg-gray-50 p-3 rounded-lg" },
                React.createElement("p", { className: "text-gray-500 text-xs mb-1" }, "Sell In Total"),
                React.createElement("p", { className: "font-semibold text-gray-800" }, sku.siPiezasTotal.toLocaleString("es-MX")),
              ),
              React.createElement("div", { className: "bg-gray-50 p-3 rounded-lg" },
                React.createElement("p", { className: "text-gray-500 text-xs mb-1" }, "Prom 90d"),
                React.createElement("p", { className: "font-semibold text-gray-800" }, sku.promedio90d.toLocaleString("es-MX")),
              ),
              React.createElement("div", { className: "bg-gray-50 p-3 rounded-lg" },
                React.createElement("p", { className: "text-gray-500 text-xs mb-1" }, "Inventario"),
                React.createElement("p", { className: "font-semibold text-gray-800" }, sku.stock.toLocaleString("es-MX")),
              ),
              React.createElement("div", { className: "bg-blue-50 p-3 rounded-lg border border-blue-200" },
                React.createElement("p", { className: "text-blue-700 text-xs mb-1 font-semibold" }, "Sugerido"),
                React.createElement("p", { className: "font-bold text-blue-700" }, sku.sugerido.toLocaleString("es-MX")),
              ),
            ),
          )
        ),
        skuDetail.length === 0 && React.createElement("p", { className: "text-center text-gray-500 py-6" }, "No hay datos"),
      ),
    ),
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
function MarketingCliente({ cliente = "Digitalife", clienteKey }) {
  const MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  const MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const TIPOS_COLOR = { digital: "#3b82f6", presencial: "#10b981", mixto: "#f59e0b" };
  const ESTATUS_COLOR = { planificado: "#94a3b8", "en curso": "#3b82f6", completado: "#10b981", cancelado: "#ef4444" };
  const ESTATUS_OPTS = ["planificado","planeado","en curso","completado","cancelado"];
  const CLASIFICACION_OPTS = ["Plan de marketing","Taller","Evento especial","Otro"];

  const [actividades, setActividades] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [anio, setAnio] = React.useState(2026);
  const [filtroTipo, setFiltroTipo] = React.useState("todas");
  const [filtroEstatus, setFiltroEstatus] = React.useState("todas");
  const [mesActivo, setMesActivo] = React.useState(null);
  const [showModal, setShowModal] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [expandedId, setExpandedId] = React.useState(null);
  const [vista, setVista] = React.useState("calendario"); // calendario | lista

  // Form state
  const emptyForm = { nombre:"", tipo:"digital", subtipo:"", mes:new Date().getMonth()+1, anio:2026, estatus:"planificado", producto:"", mensaje:"", temporalidad:"", semana:1, costo:0, clasificacion:"otro", inversion:0, alcance:0, clics:0, conversiones:0, unidades:0, ventas:0, responsable:"", notas:"" };
  const [form, setForm] = React.useState({...emptyForm});

  // Load data
  React.useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    supabase.from("marketing_actividades").select("*").eq("cliente", clienteKey || cliente).eq("anio", anio)
      .then(({ data, error }) => {
        if (!error && data) setActividades(data);
        setLoading(false);
      });
    // Realtime
    const chan = supabase.channel("mkt-rt-" + anio)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_actividades" }, (payload) => {
        if (payload.eventType === "INSERT") setActividades(prev => [...prev, payload.new]);
        else if (payload.eventType === "UPDATE") setActividades(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        else if (payload.eventType === "DELETE") setActividades(prev => prev.filter(a => a.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [cliente, clienteKey, anio]);

  // Filtered data
  const filtered = React.useMemo(() => {
    let f = actividades;
    if (filtroTipo !== "todas") f = f.filter(a => a.tipo === filtroTipo);
    if (filtroEstatus !== "todas") f = f.filter(a => a.estatus === filtroEstatus);
    if (mesActivo !== null) f = f.filter(a => Number(a.mes) === mesActivo);
    return f;
  }, [actividades, filtroTipo, filtroEstatus, mesActivo]);

  // KPIs
  const kpis = React.useMemo(() => {
    const costoTotal = actividades.reduce((s, a) => s + (Number(a.costo) || 0), 0);
    const inv = actividades.reduce((s, a) => s + (Number(a.inversion) || 0), 0);
    const ven = actividades.reduce((s, a) => s + (Number(a.ventas) || 0), 0);
    const alc = actividades.reduce((s, a) => s + (Number(a.alcance) || 0), 0);
    const conv = actividades.reduce((s, a) => s + (Number(a.conversiones) || 0), 0);
    const clics = actividades.reduce((s, a) => s + (Number(a.clics) || 0), 0);
    const roi = inv > 0 ? ((ven - inv) / inv * 100) : 0;
    return { costoTotal, inv, ven, alc, conv, clics, roi, total: actividades.length, completadas: actividades.filter(a => a.estatus === "completado").length };
  }, [actividades]);

  // Activities grouped by month for calendar
  const porMes = React.useMemo(() => {
    const m = {};
    for (let i = 1; i <= 12; i++) m[i] = [];
    actividades.forEach(a => { if (m[Number(a.mes)]) m[Number(a.mes)].push(a); });
    return m;
  }, [actividades]);

  // Save (insert or update)
  const handleSave = async () => {
    const row = { ...form, costo: parseFloat(form.costo) || 0, clasificacion: form.clasificacion || "otro", cliente: clienteKey || cliente };
    if (editItem) {
      await supabase.from("marketing_actividades").update(row).eq("id", editItem.id);
    } else {
      await supabase.from("marketing_actividades").insert([row]);
    }
    setShowModal(false);
    setEditItem(null);
    setForm({...emptyForm});
    // Reload
    const { data } = await supabase.from("marketing_actividades").select("*").eq("cliente", clienteKey || cliente).eq("anio", anio);
    if (data) setActividades(data);
  };

  const handleEdit = (act) => {
    setEditItem(act);
    setForm({ nombre: act.nombre || "", tipo: act.tipo || "digital", subtipo: act.subtipo || "", mes: act.mes, anio: act.anio, estatus: act.estatus || "planificado", producto: act.producto || "", mensaje: act.mensaje || "", temporalidad: act.temporalidad || "", semana: act.semana || 1, costo: act.costo || 0, clasificacion: act.clasificacion || "otro", inversion: act.inversion || 0, alcance: act.alcance || 0, clics: act.clics || 0, conversiones: act.conversiones || 0, unidades: act.unidades || 0, ventas: act.ventas || 0, responsable: act.responsable || "", notas: act.notas || "" });
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    await supabase.from("marketing_actividades").delete().eq("id", id);
    setActividades(prev => prev.filter(a => a.id !== id));
  };

  const fmtMoney = (v) => "$" + Number(v||0).toLocaleString("es-MX", {minimumFractionDigits:0});
  const fmtNum = (v) => Number(v||0).toLocaleString("es-MX");

  // ── RENDER ──
  const el = React.createElement;

  // KPI Card helper
  const kpiCard = (label, value, sub, color) =>
    el("div", { style: { flex:"1", minWidth:130, background:"#ffffff", borderRadius:10, padding:"10px 14px", borderLeft:`3px solid ${color}` } },
      el("div", { style: { color:"#94a3b8", fontSize:11, marginBottom:2 } }, label),
      el("div", { style: { color:"#1e293b", fontSize:18, fontWeight:700 } }, value),
      sub ? el("div", { style: { color:"#64748b", fontSize:10, marginTop:2 } }, sub) : null
    );

  // Filter pill helper
  const pill = (label, active, onClick) =>
    el("button", { onClick, style: { padding:"4px 12px", borderRadius:20, border:"none", cursor:"pointer", fontSize:12, fontWeight:active?600:400, background:active?"#3b82f6":"#1e293b", color:active?"#fff":"#94a3b8", transition:"all .2s" } }, label);

  // ── MODAL ──
  const modal = showModal ? el("div", { style: { position:"fixed", inset:0, background:"rgba(0,0,0,.6)", zIndex:999, display:"flex", alignItems:"center", justifyContent:"center" }, onClick: () => { setShowModal(false); setEditItem(null); } },
    el("div", { onClick: e => e.stopPropagation(), style: { background:"#ffffff", borderRadius:14, padding:24, width:520, maxHeight:"80vh", overflowY:"auto", color:"#1e293b" } },
      el("div", { style: { display:"flex", justifyContent:"space-between", marginBottom:16 } },
        el("h3", { style: { margin:0, fontSize:16 } }, editItem ? "Editar Actividad" : "Nueva Actividad"),
        el("button", { onClick: () => { setShowModal(false); setEditItem(null); }, style: { background:"none", border:"none", color:"#94a3b8", cursor:"pointer", fontSize:18 } }, "\u2715")
      ),
      // Row 1: nombre + tipo
      el("div", { style: { display:"grid", gridTemplateColumns:"2fr 1fr", gap:10, marginBottom:10 } },
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Nombre / Campa\u00f1a"),
          el("input", { value: form.nombre, onChange: e => setForm({...form, nombre: e.target.value}), style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } })
        ),
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Tipo"),
          el("select", { value: form.tipo, onChange: e => setForm({...form, tipo: e.target.value}), style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13 } },
            el("option", { value:"digital" }, "Digital"),
            el("option", { value:"presencial" }, "Presencial / F\u00edsico"),
            el("option", { value:"mixto" }, "Mixto")
          )
        )
      ),
      // Row 2: subtipo + producto + temporalidad
      el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:10 } },
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Subtipo"),
          el("input", { value: form.subtipo, onChange: e => setForm({...form, subtipo: e.target.value}), placeholder:"Redes, evento, POP...", style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } })
        ),
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Producto"),
          el("input", { value: form.producto, onChange: e => setForm({...form, producto: e.target.value}), placeholder:"SKU o l\u00ednea...", style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } })
        ),
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Temporalidad"),
          el("input", { value: form.temporalidad, onChange: e => setForm({...form, temporalidad: e.target.value}), placeholder:"Semanal, mensual...", style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } })
        )
      ),
      // Row 3: mes + estatus + responsable
      el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr 1fr", gap:10, marginBottom:10 } },
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Mes"),
          el("select", { value: form.mes, onChange: e => setForm({...form, mes: Number(e.target.value)}), style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13 } },
            MESES_FULL.map((m, i) => el("option", { key: i, value: i+1 }, m))
          )
        ),
        el("div", null,
      el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Semana"),
      el("select", { value: form.semana, onChange: function(e) { setForm(Object.assign({}, form, { semana: Number(e.target.value) })); },
        style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13 }
      },
        el("option", { value: 1 }, "Semana 1"),
        el("option", { value: 2 }, "Semana 2"),
        el("option", { value: 3 }, "Semana 3"),
        el("option", { value: 4 }, "Semana 4")
      )
    ),
    el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Estatus"),
          el("select", { value: form.estatus, onChange: e => setForm({...form, estatus: e.target.value}), style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13 } },
            ESTATUS_OPTS.map(s => el("option", { key: s, value: s }, s.charAt(0).toUpperCase() + s.slice(1)))
          )
        ),
        el("div", null,
          el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Responsable"),
          el("input", { value: form.responsable, onChange: e => setForm({...form, responsable: e.target.value}), style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } })
        )
      ),
      // Row 3b: Costo + Clasificación
    el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:10 } },
      el("div", null,
        el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Costo / Precio"),
        el("input", { type:"number", value: form.costo, onChange: e => setForm({...form, costo: parseFloat(e.target.value) || 0}), placeholder:"0 = Gratis", style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } })
      ),
      el("div", null,
        el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Clasificación"),
        el("select", { value: form.clasificacion, onChange: e => setForm({...form, clasificacion: e.target.value}), style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, boxSizing:"border-box" } },
          CLASIFICACION_OPTS.map(o => el("option", { key: o, value: o.toLowerCase() }, o))
        )
      )
    ),
    // Row 4: mensaje (material description)
      el("div", { style: { marginBottom:10 } },
        el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Material / Descripci\u00f3n de campa\u00f1a"),
        el("textarea", { value: form.mensaje, onChange: e => setForm({...form, mensaje: e.target.value}), rows:2, placeholder:"Qu\u00e9 material se necesita, f\u00edsico o digital, especificaciones...", style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, resize:"vertical", boxSizing:"border-box" } })
      ),
      // Row 5: metrics (compact 2x3 grid)
      el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:4, fontWeight:600 } }, "M\u00e9tricas"),
      el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:10 } },
        ...[["Inversi\u00f3n ($)","inversion"],["Alcance","alcance"],["Clics","clics"],["Conversiones","conversiones"],["Unidades","unidades"],["Ventas ($)","ventas"]].map(([lbl,key]) =>
          el("div", { key },
            el("label", { style: { fontSize:10, color:"#64748b", display:"block", marginBottom:2 } }, lbl),
            el("input", { type:"number", value: form[key], onChange: e => setForm({...form, [key]: Number(e.target.value)}), style: { width:"100%", padding:"5px 8px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:12, boxSizing:"border-box" } })
          )
        )
      ),
      // Row 6: notas
      el("div", { style: { marginBottom:16 } },
        el("label", { style: { fontSize:11, color:"#94a3b8", display:"block", marginBottom:3 } }, "Notas"),
        el("textarea", { value: form.notas, onChange: e => setForm({...form, notas: e.target.value}), rows:2, style: { width:"100%", padding:"6px 10px", borderRadius:6, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:13, resize:"vertical", boxSizing:"border-box" } })
      ),
      // Actions
      el("div", { style: { display:"flex", gap:10, justifyContent:"flex-end" } },
        el("button", { onClick: () => { setShowModal(false); setEditItem(null); }, style: { padding:"8px 18px", borderRadius:8, border:"1px solid #cbd5e1", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:13 } }, "Cancelar"),
        el("button", { onClick: handleSave, style: { padding:"8px 18px", borderRadius:8, border:"none", background:"#3b82f6", color:"#fff", cursor:"pointer", fontSize:13, fontWeight:600 } }, editItem ? "Guardar" : "Crear")
      )
    )
  ) : null;

  // ── CALENDAR VIEW (Weekly) ──
  // Default to current month if none selected
  const mesCalendario = mesActivo || (new Date().getMonth() + 1);
  const actsMes = porMes[mesCalendario] || [];
  const porSemana = { 1:[], 2:[], 3:[], 4:[] };
  actsMes.forEach(function(a) { var s = Number(a.semana) || 1; if (porSemana[s]) porSemana[s].push(a); });

  // Pendientes: actividades planificadas o en curso
  const pendientesMes = actsMes.filter(function(a) { return a.estatus === "planificado" || a.estatus === "planeado" || a.estatus === "en curso"; });

  const calendarioView = el("div", null,
    // Month selector bar
    el("div", { style: { display:"flex", gap:4, marginTop:12, marginBottom:12, flexWrap:"wrap" } },
      MESES.map(function(m, i) {
        var mesNum = i + 1;
        var count = (porMes[mesNum] || []).length;
        var isActive = mesCalendario === mesNum;
        return el("button", { key: i, onClick: function() { setMesActivo(mesNum); },
          style: { padding:"6px 14px", borderRadius:8, border: isActive ? "1px solid #3b82f6" : "1px solid transparent", cursor:"pointer", fontSize:12, fontWeight: isActive ? 700 : 400, background: isActive ? "#1e3a5f" : "#1e293b", color: isActive ? "#93c5fd" : "#94a3b8", transition:"all .2s", position:"relative" }
        }, m, count > 0 ? el("span", { style: { fontSize:9, marginLeft:4, background: isActive ? "#3b82f6" : "#334155", color:"#fff", borderRadius:10, padding:"1px 5px", fontWeight:600 } }, count) : null);
      })
    ),
    // Month title
    el("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:10 } },
      el("h3", { style: { margin:0, fontSize:16, color:"#1e293b", fontWeight:700 } }, MESES_FULL[mesCalendario - 1] + " " + anio),
      el("span", { style: { fontSize:12, color:"#64748b" } }, actsMes.length + " actividades")
    ),
    // Weekly grid - 4 rows
    el("div", { style: { display:"flex", flexDirection:"column", gap:8 } },
      [1,2,3,4].map(function(sem) {
        var acts = porSemana[sem];
        return el("div", { key: sem, style: { background:"#ffffff", borderRadius:10, padding:"12px 14px", borderLeft: acts.length > 0 ? "3px solid #3b82f6" : "3px solid #334155" } },
          el("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: acts.length > 0 ? 8 : 0 } },
            el("span", { style: { fontSize:13, fontWeight:600, color:"#1e293b" } }, "Semana " + sem),
            el("span", { style: { fontSize:11, color:"#64748b" } }, acts.length + " actividades")
          ),
          acts.length > 0 ? el("div", { style: { display:"flex", flexDirection:"column", gap:6 } },
            acts.map(function(a) {
              return el("div", { key: a.id, style: { display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f1f5f9", borderRadius:8, cursor:"pointer" }, onClick: function() { setExpandedId(expandedId === a.id ? null : a.id); handleEdit(a); } },
                el("span", { style: { width:8, height:8, borderRadius:"50%", background: TIPOS_COLOR[a.tipo] || "#3b82f6", flexShrink:0 } }),
                el("span", { style: { flex:1, fontSize:12, color:"#1e293b", fontWeight:500 } }, a.nombre || a.subtipo || "Sin nombre"),
                el("span", { style: { padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:500, background: ESTATUS_COLOR[a.estatus] || "#94a3b8", color:"#fff" } }, a.estatus || ""),
            Number(a.costo) > 0 ? el("span", { style: { fontSize:10, color:"#059669", fontWeight:600 } }, fmtMoney(a.costo)) : el("span", { style: { fontSize:10, color:"#94a3b8" } }, "Gratis"),
                a.inversion ? el("span", { style: { fontSize:11, color:"#94a3b8" } }, fmtMoney(a.inversion)) : null,
                el("span", { style: { fontSize:10, color:"#64748b" } }, a.tipo)
              );
            })
          ) : el("div", { style: { fontSize:11, color:"#475569", fontStyle:"italic" } }, "Sin actividades programadas")
        );
      })
    ),
    // Pendientes section
    pendientesMes.length > 0 ? el("div", { style: { marginTop:16, background:"#ffffff", borderRadius:10, padding:"14px 16px", borderLeft:"3px solid #f59e0b" } },
      el("h4", { style: { margin:"0 0 10px", fontSize:14, color:"#fbbf24", fontWeight:700 } }, "\u26A0\uFE0F Pendientes de " + MESES_FULL[mesCalendario - 1] + " (" + pendientesMes.length + ")"),
      el("div", { style: { display:"flex", flexDirection:"column", gap:6 } },
        pendientesMes.map(function(a) {
          return el("div", { key: a.id, style: { display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f1f5f9", borderRadius:8 } },
            el("span", { style: { width:8, height:8, borderRadius:"50%", background: ESTATUS_COLOR[a.estatus], flexShrink:0 } }),
            el("span", { style: { flex:1, fontSize:12, color:"#1e293b" } }, a.nombre || a.subtipo || "Sin nombre"),
            el("span", { style: { fontSize:10, color:"#94a3b8" } }, "Sem " + (a.semana || 1)),
            el("span", { style: { padding:"2px 8px", borderRadius:10, fontSize:10, background: ESTATUS_COLOR[a.estatus], color:"#fff" } }, a.estatus),
            a.responsable ? el("span", { style: { fontSize:10, color:"#64748b" } }, a.responsable) : null
          );
        })
      )
    ) : null
  );

  // ── LIST VIEW ──
  const listaView = el("div", { style: { marginTop:12, display:"flex", flexDirection:"column", gap:6 } },
    filtered.length === 0 ? el("div", { style: { textAlign:"center", color:"#64748b", padding:30, fontSize:13 } }, "No hay actividades con estos filtros") :
    filtered.map(a =>
      el("div", { key: a.id, style: { background:"#ffffff", borderRadius:10, overflow:"hidden", border: expandedId === a.id ? "1px solid #334155" : "1px solid transparent" } },
        // Header row (always visible)
        el("div", {
          onClick: () => setExpandedId(expandedId === a.id ? null : a.id),
          style: { display:"grid", gridTemplateColumns:"3fr 1fr 1fr 1fr 1fr auto", gap:8, alignItems:"center", padding:"10px 14px", cursor:"pointer", fontSize:12 }
        },
          el("div", { style: { display:"flex", alignItems:"center", gap:8 } },
            el("span", { style: { width:8, height:8, borderRadius:"50%", background: TIPOS_COLOR[a.tipo] || "#3b82f6", flexShrink:0 } }),
            el("span", { style: { color:"#1e293b", fontWeight:600, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" } }, a.nombre || a.subtipo || "Sin nombre"),
            el("span", { style: { fontSize:10, color:"#64748b" } }, a.subtipo && a.nombre ? a.subtipo : "")
          ),
          el("div", { style: { color:"#94a3b8" } }, MESES[a.mes - 1] || ""),
          el("div", null,
            el("span", { style: { padding:"2px 8px", borderRadius:10, fontSize:10, fontWeight:500, background: ESTATUS_COLOR[a.estatus] || "#94a3b8", color:"#fff" } }, a.estatus || "—")
          ),
          el("div", { style: { color:"#94a3b8" } }, a.inversion ? fmtMoney(a.inversion) : "—"),
          el("div", { style: { color:"#94a3b8" } }, a.ventas ? fmtMoney(a.ventas) : "—"),
          el("span", { style: { color:"#64748b", fontSize:14, transition:"transform .2s", transform: expandedId === a.id ? "rotate(180deg)" : "rotate(0)" } }, "\u25BC")
        ),
        // Expanded detail
        expandedId === a.id ? el("div", { style: { padding:"0 14px 12px", borderTop:"1px solid #0f172a" } },
          el("div", { style: { display:"grid", gridTemplateColumns:"repeat(4, 1fr)", gap:10, marginTop:10, fontSize:11 } },
            el("div", null, el("span", { style: { color:"#64748b" } }, "Producto: "), el("span", { style: { color:"#1e293b" } }, a.producto || "—")),
            el("div", null, el("span", { style: { color:"#64748b" } }, "Responsable: "), el("span", { style: { color:"#1e293b" } }, a.responsable || "—")),
            el("div", null, el("span", { style: { color:"#64748b" } }, "Temporalidad: "), el("span", { style: { color:"#1e293b" } }, a.temporalidad || "—")),
            el("div", null, el("span", { style: { color:"#64748b" } }, "Tipo: "), el("span", { style: { color:"#1e293b" } }, a.tipo || "—"))
          ),
          a.mensaje ? el("div", { style: { marginTop:8, fontSize:11 } }, el("span", { style: { color:"#64748b" } }, "Material: "), el("span", { style: { color:"#cbd5e1" } }, a.mensaje)) : null,
          el("div", { style: { display:"grid", gridTemplateColumns:"repeat(5, 1fr)", gap:8, marginTop:10, fontSize:11 } },
            el("div", null, el("div", { style: { color:"#64748b", fontSize:10 } }, "Alcance"), el("div", { style: { color:"#1e293b", fontWeight:600 } }, fmtNum(a.alcance))),
            el("div", null, el("div", { style: { color:"#64748b", fontSize:10 } }, "Clics"), el("div", { style: { color:"#1e293b", fontWeight:600 } }, fmtNum(a.clics))),
            el("div", null, el("div", { style: { color:"#64748b", fontSize:10 } }, "Conv."), el("div", { style: { color:"#1e293b", fontWeight:600 } }, fmtNum(a.conversiones))),
            el("div", null, el("div", { style: { color:"#64748b", fontSize:10 } }, "Uds."), el("div", { style: { color:"#1e293b", fontWeight:600 } }, fmtNum(a.unidades))),
            a.inversion > 0 && a.ventas > 0 ? el("div", null, el("div", { style: { color:"#64748b", fontSize:10 } }, "ROI"), el("div", { style: { color: ((a.ventas-a.inversion)/a.inversion*100) >= 0 ? "#10b981" : "#ef4444", fontWeight:600 } }, ((a.ventas-a.inversion)/a.inversion*100).toFixed(0) + "%")) : null
          ),
          a.notas ? el("div", { style: { marginTop:8, fontSize:11, color:"#64748b", fontStyle:"italic" } }, a.notas) : null,
          el("div", { style: { display:"flex", gap:8, marginTop:10, justifyContent:"flex-end" } },
            el("button", { onClick: (e) => { e.stopPropagation(); handleEdit(a); }, style: { padding:"4px 14px", borderRadius:6, border:"1px solid #cbd5e1", background:"transparent", color:"#94a3b8", cursor:"pointer", fontSize:11 } }, "Editar"),
            el("button", { onClick: (e) => { e.stopPropagation(); if(confirm("\u00bfEliminar esta actividad?")) handleDelete(a.id); }, style: { padding:"4px 14px", borderRadius:6, border:"1px solid #7f1d1d", background:"transparent", color:"#ef4444", cursor:"pointer", fontSize:11 } }, "Eliminar")
          )
        ) : null
      )
    )
  );

  // ── MAIN LAYOUT ──
  return el("div", { style: { maxWidth:1100, margin:"0 auto" } },
    modal,
    // Header
    el("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:8 } },
      el("h2", { style: { margin:0, color:"#1e293b", fontSize:20, fontWeight:700 } }, "\ud83d\udce3 Marketing"),
      el("div", { style: { display:"flex", gap:8, alignItems:"center" } },
        el("select", { value: anio, onChange: e => setAnio(Number(e.target.value)), style: { padding:"5px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:12 } },
          el("option", { value: 2025 }, "2025"),
          el("option", { value: 2026 }, "2026"),
          el("option", { value: 2027 }, "2027")
        ),
        el("button", { onClick: () => { setEditItem(null); setForm({...emptyForm}); setShowModal(true); }, style: { padding:"6px 16px", borderRadius:8, border:"none", background:"#3b82f6", color:"#fff", cursor:"pointer", fontSize:12, fontWeight:600 } }, "+ Nueva Actividad")
      )
    ),

    // KPI Bar (compact horizontal)
    el("div", { style: { display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" } },
      kpiCard("Inversi\u00f3n Total", fmtMoney(kpis.inv), kpis.total + " actividades", "#3b82f6"),
      kpiCard("Ventas Generadas", fmtMoney(kpis.ven), null, "#10b981"),
      kpiCard("ROI", (kpis.roi >= 0 ? "+" : "") + kpis.roi.toFixed(0) + "%", kpis.inv > 0 ? "vs inversi\u00f3n" : "sin datos", kpis.roi >= 0 ? "#10b981" : "#ef4444"),
      kpiCard("Alcance", fmtNum(kpis.alc), fmtNum(kpis.conv) + " conv.", "#8b5cf6"),
      kpiCard("Completadas", kpis.completadas + "/" + kpis.total, kpis.total > 0 ? (kpis.completadas/kpis.total*100).toFixed(0) + "%" : "—", "#f59e0b")
    ),

    // Filters + view toggle
    el("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8, flexWrap:"wrap", gap:6 } },
      el("div", { style: { display:"flex", gap:4, flexWrap:"wrap" } },
        pill("Todas", filtroTipo === "todas", () => setFiltroTipo("todas")),
        pill("Digital", filtroTipo === "digital", () => setFiltroTipo("digital")),
        pill("Presencial", filtroTipo === "presencial", () => setFiltroTipo("presencial")),
        pill("Mixto", filtroTipo === "mixto", () => setFiltroTipo("mixto")),
        el("span", { style: { width:1, height:20, background:"#334155", margin:"0 4px" } }),
        pill("Todos", filtroEstatus === "todas", () => setFiltroEstatus("todas")),
        ...ESTATUS_OPTS.map(s => pill(s.charAt(0).toUpperCase() + s.slice(1), filtroEstatus === s, () => setFiltroEstatus(s)))
      ),
      el("div", { style: { display:"flex", gap:4 } },
        el("button", { onClick: () => { setVista("calendario"); setMesActivo(null); }, style: { padding:"4px 12px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, background: vista==="calendario" ? "#3b82f6" : "#1e293b", color: vista==="calendario" ? "#fff" : "#94a3b8" } }, "\ud83d\udcc5 Calendario"),
        el("button", { onClick: () => setVista("lista"), style: { padding:"4px 12px", borderRadius:6, border:"none", cursor:"pointer", fontSize:12, background: vista==="lista" ? "#3b82f6" : "#1e293b", color: vista==="lista" ? "#fff" : "#94a3b8" } }, "\ud83d\udccb Lista")
      )
    ),

    // Active month indicator
    mesActivo !== null ? el("div", { style: { display:"flex", alignItems:"center", gap:8, marginBottom:8, padding:"6px 12px", background:"#1e3a5f", borderRadius:8, fontSize:12 } },
      el("span", { style: { color:"#93c5fd" } }, "Filtrando: " + MESES_FULL[mesActivo - 1]),
      el("button", { onClick: () => setMesActivo(null), style: { background:"none", border:"none", color:"#93c5fd", cursor:"pointer", fontSize:14 } }, "\u2715")
    ) : null,

    // Loading
    loading ? el("div", { style: { textAlign:"center", color:"#64748b", padding:30 } }, "Cargando actividades...") :

    // Views
    vista === "calendario" ? calendarioView : listaView
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
    <div className="min-h-screen bg-gray-50 p-6 space-y-6 max-w-7xl mx-auto">
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-2">
        <h1 className="text-2xl font-bold text-gray-800">Resumen General de Cuentas</h1>
        <p className="text-sm text-gray-500 mt-1">Vista consolidada — Acteck / Balam Rush 2026</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-blue-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sell In Total</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatMXN(grandTotalSI)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-green-600">
          <p className="text-xs text-gray-500 uppercase tracking-wide">Sell Out Total</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{formatMXN(grandTotalSO)}</p>
        </div>
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-purple-600">
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
          <div key={c.key} className="bg-white rounded-2xl shadow-sm border overflow-hidden">
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
              <div className="mb-3">
                {/* Visual bars */}
                <div className="flex items-end gap-1" style={{height:60}}>
                  {meses.map((mes, i) => {
                    const d = c.data.monthly[i+1];
                    if (!d) return null;
                    const maxVal = Math.max(...Object.values(c.data.monthly).map(m => Math.max(m.sellIn, m.sellOut)), 1);
                    const siH = Math.max((d.sellIn / maxVal) * 50, 2);
                    const soH = Math.max((d.sellOut / maxVal) * 50, 2);
                    return (
                      <div key={mes} className="flex-1 flex flex-col items-center gap-0.5">
                        <div className="w-full flex gap-0.5 items-end" style={{height:52}}>
                          <div className="flex-1 rounded-t" style={{height:siH, background: c.color, opacity:0.7}} />
                          <div className="flex-1 rounded-t" style={{height:soH, background:"#10b981"}} />
                        </div>
                        <span className="text-[8px] text-gray-400">{mes.substring(0,1)}</span>
                      </div>
                    );
                  })}
                </div>
                <div className="flex gap-3 mt-1 mb-2">
                  <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded" style={{background: c.color, opacity:0.7}} /> Sell In</span>
                  <span className="text-[9px] text-gray-400 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded bg-green-500" /> Sell Out</span>
                  {c.data.lastMes < 12 && <span className="text-[9px] text-gray-300 flex items-center gap-1"><span className="inline-block w-2 h-2 rounded border border-dashed border-gray-300" /> Proyección</span>}
                </div>
                {c.data.lastMes >= 2 && c.data.lastMes < 12 && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 mb-2 text-xs">
                    <span className="text-blue-600 font-medium">Proyección anual:</span>
                    <span className="ml-2 text-gray-600">SI {formatMXN(c.data.sellInTotal / c.data.lastMes * 12)}</span>
                    <span className="ml-2 text-green-600">SO {formatMXN(c.data.sellOutTotal / c.data.lastMes * 12)}</span>
                  </div>
                )}
              </div>
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




// ── ANÁLISIS ──────────────────────────────────────────────────────────────────
function AnalisisCliente({ cliente, clienteKey }) {
  var el = React.createElement;
  var MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  var MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  var _s = React.useState;
  var [ventas, setVentas] = _s([]);
  var [marketing, setMarketing] = _s([]);
  var [productos, setProductos] = _s([]);
  var [sellInSku, setSellInSku] = _s([]);
  var [sellOutSku, setSellOutSku] = _s([]);
  var [inventario, setInventario] = _s([]);
  var [loading, setLoading] = _s(true);
  var [anio, setAnio] = _s(2026);
  var [cuotasMens, setCuotasMens] = _s([]);

  React.useEffect(function() {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    var ck = clienteKey || cliente;
    Promise.all([
      supabase.from("ventas_mensuales").select("*").eq("cliente", ck).eq("anio", anio),
      supabase.from("marketing_actividades").select("*").eq("cliente", ck).eq("anio", anio),
      supabase.from("productos_cliente").select("*").eq("cliente", ck),
      supabase.from("sell_in_sku").select("*").eq("cliente", ck).eq("anio", anio),
      supabase.from("sellout_sku").select("*").eq("cliente", ck).eq("anio", anio),
      supabase.from("inventario_cliente").select("*").eq("cliente", ck),
      supabase.from("cuotas_mensuales").select("*").eq("cliente", ck).eq("anio", anio)
    ]).then(function(results) {
      if (results[0].data) setVentas(results[0].data);
      if (results[1].data) setMarketing(results[1].data);
      if (results[2].data) setProductos(results[2].data);
      if (results[3].data) setSellInSku(results[3].data);
      if (results[4].data) setSellOutSku(results[4].data);
      if (results[5].data) setInventario(results[5].data);
    if (results[6] && results[6].data) setCuotasMens(results[6].data);
      setLoading(false);
    });
  }, [cliente, clienteKey, anio]);

  // ── Helpers ──
  var fmtM = function(v) { return "$" + (Number(v||0)/1000000).toFixed(2) + "M"; };
  var fmtK = function(v) { return "$" + (Number(v||0)/1000).toFixed(0) + "K"; };
  var fmtMoney = function(v) { return "$" + Number(v||0).toLocaleString("es-MX", {minimumFractionDigits:0}); };
  var fmtPct = function(v) { return (Number(v||0)).toFixed(1) + "%"; };
  var fmtNum = function(v) { return Number(v||0).toLocaleString("es-MX"); };

  // ── Sell-through by month ──
  var ventasPorMes = React.useMemo(function() {
    var result = [];
    for (var i = 1; i <= 12; i++) {
      var row = ventas.find(function(v) { return Number(v.mes) === i; });
      var si = row ? Number(row.sell_in || 0) : 0;
      var so = row ? Number(row.sell_out || 0) : 0;
      var st = si > 0 && so > 0 ? (so / si * 100) : 0;
      result.push({ mes: i, label: MESES[i-1], sell_in: si, sell_out: so, sellThrough: st, cuota: row ? Number(row.cuota || 0) : 0, invDias: row ? Number(row.inventario_dias || 0) : 0, invValor: row ? Number(row.inventario_valor || 0) : 0 });
    }
    return result;
  }, [ventas]);

  // ── YTD Totals ──
  var ytd = React.useMemo(function() {
    var si = ventasPorMes.reduce(function(s,v) { return s + v.sell_in; }, 0);
    var so = ventasPorMes.reduce(function(s,v) { return s + v.sell_out; }, 0);
    var st = si > 0 && so > 0 ? (so / si * 100) : 0;
    var mesesConDatos = ventasPorMes.filter(function(v) { return v.sell_in > 0 || v.sell_out > 0; }).length;
    // Projection
    var avgSI = mesesConDatos > 0 ? si / mesesConDatos : 0;
    var avgSO = mesesConDatos > 0 ? so / mesesConDatos : 0;
    var projSI = si + avgSI * (12 - mesesConDatos);
    var projSO = so + avgSO * (12 - mesesConDatos);
    return { si: si, so: so, st: st, mesesConDatos: mesesConDatos, avgSI: avgSI, avgSO: avgSO, projSI: projSI, projSO: projSO };
  }, [ventasPorMes]);

  // ── Marketing aggregates by month ──
  var mktPorMes = React.useMemo(function() {
    var m = {};
    for (var i = 1; i <= 12; i++) m[i] = { inv: 0, ventas: 0, alcance: 0, count: 0 };
    marketing.forEach(function(a) {
      var mes = Number(a.mes);
      if (m[mes]) {
        m[mes].inv += Number(a.inversion || 0);
        m[mes].ventas += Number(a.ventas || 0);
        m[mes].alcance += Number(a.alcance || 0);
        m[mes].count++;
      }
    });
    return m;
  }, [marketing]);

  var mktTotals = React.useMemo(function() {
    var inv = marketing.reduce(function(s,a) { return s + Number(a.inversion||0); }, 0);
    var ven = marketing.reduce(function(s,a) { return s + Number(a.ventas||0); }, 0);
    return { inv: inv, ven: ven, roi: inv > 0 ? ((ven-inv)/inv*100) : 0 };
  }, [marketing]);

  // ── SKU-level analysis (when data available) ──
  var skuAnalysis = React.useMemo(function() {
    if (productos.length === 0) return null;
    var skuMap = {};
    productos.forEach(function(p) {
      skuMap[p.sku] = { sku: p.sku, desc: p.descripcion || p.sku, marca: p.marca || "", categoria: p.categoria || "", costo: Number(p.costo_promedio || 0), precio: Number(p.precio_venta || 0), siTotal: 0, soTotal: 0, invStock: 0, invValor: 0, diasSinVenta: 0 };
    });
    sellInSku.forEach(function(s) { if (skuMap[s.sku]) skuMap[s.sku].siTotal += Number(s.piezas || 0); });
    sellOutSku.forEach(function(s) { if (skuMap[s.sku]) skuMap[s.sku].soTotal += Number(s.piezas || 0); });
    inventario.forEach(function(inv) {
      if (skuMap[inv.sku]) {
        skuMap[inv.sku].invStock = Number(inv.stock || 0);
        skuMap[inv.sku].invValor = Number(inv.valor || 0);
        skuMap[inv.sku].diasSinVenta = Number(inv.dias_sin_venta || 0);
      }
    });
    var all = Object.values(skuMap);
    // Margins
    all.forEach(function(s) {
      s.margenCliente = s.precio > 0 && s.costo > 0 ? ((s.precio - s.costo) / s.precio * 100) : 0;
      s.margenPesos = (s.precio - s.costo) * s.soTotal;
      s.sellThrough = s.siTotal > 0 && s.soTotal > 0 ? (s.soTotal / s.siTotal * 100) : 0;
    });
    // Sort for top/bottom
    var topSO = all.filter(function(s){return s.soTotal>0;}).sort(function(a,b){return b.soTotal-a.soTotal;}).slice(0,10);
    var bottomSO = all.filter(function(s){return s.siTotal>0 && s.soTotal===0;}).sort(function(a,b){return b.siTotal-a.siTotal;}).slice(0,10);
    // Inventory health
    var sinVenta60 = all.filter(function(s){return s.diasSinVenta>60;});
    var sinVenta90 = all.filter(function(s){return s.diasSinVenta>90;});
    var invMuerto = sinVenta90.reduce(function(s,p){return s+p.invValor;},0);
    // Margins by brand
    var byMarca = {};
    all.forEach(function(s) {
      if (!byMarca[s.marca]) byMarca[s.marca] = { costo: 0, precio: 0, piezas: 0, margenTotal: 0 };
      byMarca[s.marca].piezas += s.soTotal;
      byMarca[s.marca].margenTotal += s.margenPesos;
    });
    return { all: all, topSO: topSO, bottomSO: bottomSO, sinVenta60: sinVenta60, sinVenta90: sinVenta90, invMuerto: invMuerto, byMarca: byMarca, total: all.length };
  }, [productos, sellInSku, sellOutSku, inventario]);

  // ── Scorecard ──
  var scorecard = React.useMemo(function() {
    var items = [];
    // Sell-through
    var stColor = ytd.st >= 80 ? "#10b981" : ytd.st >= 50 ? "#f59e0b" : "#ef4444";
    // Cuota from cuotas_mensuales
    var cuotaMap = {};
    cuotasMens.forEach(function(cm) { cuotaMap[parseInt(cm.mes)] = cm; });
    var totalCuotaIdealA = cuotasMens.reduce(function(s, cm) { return s + (Number(cm.cuota_ideal) || 0); }, 0);
    var totalCuotaMinA = cuotasMens.reduce(function(s, cm) { return s + (Number(cm.cuota_min) || 0); }, 0);
    var cumpCuotaA = totalCuotaIdealA > 0 ? (ytd.si / totalCuotaIdealA * 100) : 0;
    if (totalCuotaIdealA > 0) {
      items.push({ label: "Cuota Ideal YTD", value: fmtM(totalCuotaIdealA), color: "#F59E0B", detail: "Min: " + fmtM(totalCuotaMinA) });
      items.push({ label: "Cumplimiento Cuota", value: fmtPct(cumpCuotaA), color: cumpCuotaA >= 100 ? "#10b981" : cumpCuotaA >= 80 ? "#f59e0b" : "#ef4444", detail: "vs Cuota Ideal" });
    }
    items.push({ label: "Eficiencia de Venta YTD", value: fmtPct(ytd.st), color: stColor, detail: "Meta: >80%" });
    // Cumplimiento cuota
    var cuotaTotal = ventasPorMes.reduce(function(s,v){return s+v.cuota;},0);
    var cumpPct = cuotaTotal > 0 ? (ytd.si / cuotaTotal * 100) : 0;
    var cumpColor = cumpPct >= 90 ? "#10b981" : cumpPct >= 70 ? "#f59e0b" : "#ef4444";
    items.push({ label: "Cumplimiento Cuota", value: cuotaTotal > 0 ? fmtPct(cumpPct) : "Sin cuota", color: cuotaTotal > 0 ? cumpColor : "#64748b", detail: cuotaTotal > 0 ? "Cuota: " + fmtMoney(cuotaTotal) : "" });
    // Marketing ROI
    var roiColor = mktTotals.roi > 50 ? "#10b981" : mktTotals.roi > 0 ? "#f59e0b" : "#ef4444";
    items.push({ label: "ROI Marketing", value: mktTotals.inv > 0 ? fmtPct(mktTotals.roi) : "Sin datos", color: mktTotals.inv > 0 ? roiColor : "#64748b", detail: "Inv: " + fmtMoney(mktTotals.inv) });
    // Actividades completadas
    var completadas = marketing.filter(function(a){return a.estatus==="completado";}).length;
    var actPct = marketing.length > 0 ? (completadas/marketing.length*100) : 0;
    var actColor = actPct >= 80 ? "#10b981" : actPct >= 50 ? "#f59e0b" : "#ef4444";
    items.push({ label: "Ejecuci\u00F3n Marketing", value: completadas + "/" + marketing.length, color: marketing.length > 0 ? actColor : "#64748b", detail: marketing.length > 0 ? fmtPct(actPct) + " completado" : "" });
    // Inventory (if data)
    if (skuAnalysis) {
      var invColor = skuAnalysis.sinVenta90.length === 0 ? "#10b981" : skuAnalysis.sinVenta90.length <= 5 ? "#f59e0b" : "#ef4444";
      items.push({ label: "Salud Inventario", value: skuAnalysis.sinVenta90.length + " sin venta 90d", color: invColor, detail: "Valor muerto: " + fmtMoney(skuAnalysis.invMuerto) });
    }
    return items;
  }, [ytd, ventasPorMes, mktTotals, marketing, skuAnalysis]);

  // ── RENDER ──
  if (loading) return el("div", { style: { textAlign:"center", color:"#64748b", padding:60 } }, "Cargando an\u00E1lisis...");

  // Section card helper
  var section = function(title, icon, children) {
    return el("div", { style: { background:"#ffffff", borderRadius:12, padding:"16px 20px", marginBottom:12 } },
      el("h3", { style: { margin:"0 0 12px", fontSize:14, fontWeight:700, color:"#1e293b", display:"flex", alignItems:"center", gap:8 } }, icon, " ", title),
      children
    );
  };

  // Metric box helper
  var metricBox = function(label, value, sub, color) {
    return el("div", { style: { background:"#f1f5f9", borderRadius:10, padding:"12px 16px", flex:1, minWidth:140, borderTop:"3px solid " + (color || "#3b82f6") } },
      el("div", { style: { fontSize:11, color:"#94a3b8", marginBottom:4 } }, label),
      el("div", { style: { fontSize:20, fontWeight:700, color:"#1e293b" } }, value),
      sub ? el("div", { style: { fontSize:10, color:"#64748b", marginTop:2 } }, sub) : null
    );
  };

  // Bar helper for horizontal bars
  var bar = function(label, value, max, color, subLabel) {
    var pct = max > 0 ? Math.min(value / max * 100, 100) : 0;
    return el("div", { style: { marginBottom:8 } },
      el("div", { style: { display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 } },
        el("span", { style: { color:"#cbd5e1" } }, label),
        el("span", { style: { color:"#94a3b8" } }, subLabel || fmtMoney(value))
      ),
      el("div", { style: { height:6, background:"#f1f5f9", borderRadius:3, overflow:"hidden" } },
        el("div", { style: { height:"100%", width: pct + "%", background: color || "#3b82f6", borderRadius:3, transition:"width .5s" } })
      )
    );
  };

  return el("div", { style: { maxWidth:1100, margin:"0 auto", color:"#1e293b" } },
    // Header
    el("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 } },
      el("h2", { style: { margin:0, fontSize:20, fontWeight:700 } }, "\uD83D\uDCC8 An\u00E1lisis — " + (cliente || clienteKey)),
      el("select", { value: anio, onChange: function(e) { setAnio(Number(e.target.value)); }, style: { padding:"5px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:12 } },
        el("option", { value: 2025 }, "2025"), el("option", { value: 2026 }, "2026"), el("option", { value: 2027 }, "2027")
      )
    ),

    // ═══ 1. SCORECARD ═══
    section("Scorecard", "\uD83D\uDEA6",
      el("div", { style: { display:"flex", gap:10, flexWrap:"wrap" } },
        scorecard.map(function(s, i) {
          return el("div", { key: i, style: { flex:1, minWidth:150, background:"#f1f5f9", borderRadius:10, padding:"14px 16px", borderLeft:"4px solid " + s.color } },
            el("div", { style: { fontSize:11, color:"#94a3b8", marginBottom:4 } }, s.label),
            el("div", { style: { fontSize:22, fontWeight:700, color: s.color } }, s.value),
            s.detail ? el("div", { style: { fontSize:10, color:"#64748b", marginTop:4 } }, s.detail) : null
          );
        })
      )
    ),

    // ═══ 2. SELL-THROUGH POR MES ═══
    section("Eficiencia de Venta Mensual", "\uD83D\uDD04",
        el("div", { style: { background: "#F0F9FF", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#334155", lineHeight: 1.5, border: "1px solid #BAE6FD" } },
          el("strong", null, "\u00bfQu\u00e9 es la Eficiencia de Venta? "),
          "Mide la relaci\u00f3n entre lo que el cliente nos compra (Sell In) y lo que vende a sus clientes (Sell Out). ",
          "Una eficiencia \u2265 80% indica un balance saludable. Valores bajos sugieren sobreinventario; valores muy altos pueden indicar riesgo de desabasto."
        ),
      el("div", null,
        // YTD summary row
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Sell In YTD", fmtM(ytd.si), null, "#3b82f6"),
          metricBox("Sell Out YTD", fmtM(ytd.so), null, "#10b981"),
          metricBox("Eficiencia de Venta YTD", fmtPct(ytd.st), ytd.st >= 80 ? "Saludable" : ytd.st >= 50 ? "Moderado" : "Bajo", ytd.st >= 80 ? "#10b981" : ytd.st >= 50 ? "#f59e0b" : "#ef4444")
        ),
        // Monthly bars
        el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 } },
          el("div", null,
            el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Sell In por Mes"),
            ventasPorMes.filter(function(v){return v.sell_in>0;}).map(function(v) {
              return el("div", { key: v.mes }, bar(v.label, v.sell_in, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_in;})), "#3b82f6"));
            })
          ),
          el("div", null,
            el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Sell Out por Mes"),
            ventasPorMes.filter(function(v){return v.sell_out>0;}).map(function(v) {
              return el("div", { key: v.mes }, bar(v.label, v.sell_out, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_out;})), "#10b981"));
            }),
            ventasPorMes.filter(function(v){return v.sell_out>0;}).length === 0 ? el("div", { style: { fontSize:12, color:"#475569", fontStyle:"italic", padding:12 } }, "Sin datos de sell out a\u00FAn") : null
          )
        ),
        // Sell-through % per month
        el("div", { style: { marginTop:16 } },
          el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Eficiencia de Venta % por Mes"),
          el("div", { style: { display:"flex", gap:6, flexWrap:"wrap" } },
            ventasPorMes.map(function(v) {
              var hasST = v.sell_in > 0 && v.sell_out > 0;
              var color = !hasST ? "#334155" : v.sellThrough >= 80 ? "#10b981" : v.sellThrough >= 50 ? "#f59e0b" : "#ef4444";
              return el("div", { key: v.mes, style: { textAlign:"center", width:70, background:"#f1f5f9", borderRadius:8, padding:"8px 4px", borderBottom:"3px solid " + color } },
                el("div", { style: { fontSize:10, color:"#94a3b8" } }, v.label),
                el("div", { style: { fontSize:16, fontWeight:700, color: hasST ? color : "#475569" } }, hasST ? fmtPct(v.sellThrough) : "—")
              );
            })
          )
        )
      )
    ),

    // ═══ 3. MARKETING vs VENTAS ═══
    section("Marketing vs Ventas", "\uD83D\uDCE3",
      el("div", null,
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Inversi\u00F3n Mkt", fmtMoney(mktTotals.inv), marketing.length + " actividades", "#8b5cf6"),
          metricBox("Sell Out Total", fmtM(ytd.so), null, "#10b981"),
          metricBox("Costo x Peso Vendido", ytd.so > 0 ? "$" + (mktTotals.inv / ytd.so).toFixed(2) : "—", ytd.so > 0 ? "Por cada $1 de sell out" : "Sin sell out", "#f59e0b")
        ),
        // Monthly comparison
        el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Inversi\u00F3n Marketing vs Sell Out por Mes"),
        el("div", { style: { display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:6 } },
          ventasPorMes.slice(0, 6).map(function(v) {
            var mktMes = mktPorMes[v.mes];
            var hasMkt = mktMes && mktMes.inv > 0;
            var hasSO = v.sell_out > 0;
            return el("div", { key: v.mes, style: { background:"#f1f5f9", borderRadius:8, padding:"10px 8px", textAlign:"center" } },
              el("div", { style: { fontSize:10, color:"#94a3b8", marginBottom:6 } }, v.label),
              el("div", { style: { fontSize:11, color:"#8b5cf6", fontWeight:600 } }, hasMkt ? fmtK(mktMes.inv) : "—"),
              el("div", { style: { fontSize:9, color:"#64748b", margin:"2px 0" } }, "mkt"),
              el("div", { style: { fontSize:11, color:"#10b981", fontWeight:600 } }, hasSO ? fmtK(v.sell_out) : "—"),
              el("div", { style: { fontSize:9, color:"#64748b" } }, "sell out")
            );
          })
        )
      )
    ),

    // ═══ 4. MÁRGENES DEL CANAL ═══
    skuAnalysis ? section("Margen de Digitalife", "\uD83D\uDCB0",
      el("div", null,
        el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:12 } }, "Comparativa: Costo Acteck vs Precio " + (cliente || clienteKey) + " — Margen que se lleva el cliente"),
        // By brand summary
        Object.keys(skuAnalysis.byMarca).length > 0 ? el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          Object.keys(skuAnalysis.byMarca).map(function(marca) {
            var d = skuAnalysis.byMarca[marca];
            return el("div", { key: marca, style: { flex:1, minWidth:200, background:"#f1f5f9", borderRadius:10, padding:"12px 16px" } },
              el("div", { style: { fontSize:13, fontWeight:600, color:"#1e293b", marginBottom:6 } }, marca || "Sin marca"),
              el("div", { style: { fontSize:11, color:"#94a3b8" } }, fmtNum(d.piezas) + " pzas vendidas"),
              el("div", { style: { fontSize:11, color:"#10b981", fontWeight:600 } }, "Margen cliente: " + fmtMoney(d.margenTotal))
            );
          })
        ) : null,
        // Top SKUs by margin
        el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Top 10 SKUs por Margen del Cliente"),
        el("div", { style: { overflowX:"auto" } },
          el("table", { style: { width:"100%", fontSize:11, borderCollapse:"collapse" } },
            el("thead", null,
              el("tr", { style: { borderBottom:"1px solid #e2e8f0" } },
                ["SKU","Descripci\u00F3n","Costo Acteck","Precio Cliente","Margen %","Pzas SO","Margen $"].map(function(h) {
                  return el("th", { key: h, style: { textAlign:"left", padding:"6px 8px", color:"#94a3b8", fontWeight:600 } }, h);
                })
              )
            ),
            el("tbody", null,
              skuAnalysis.all.filter(function(s){return s.margenPesos>0;}).sort(function(a,b){return b.margenPesos-a.margenPesos;}).slice(0,10).map(function(s) {
                return el("tr", { key: s.sku, style: { borderBottom:"1px solid #e2e8f0" } },
                  el("td", { style: { padding:"6px 8px", color:"#94a3b8", fontFamily:"monospace", fontSize:10 } }, s.sku),
                  el("td", { style: { padding:"6px 8px", color:"#1e293b", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" } }, s.desc),
                  el("td", { style: { padding:"6px 8px", color:"#3b82f6" } }, fmtMoney(s.costo)),
                  el("td", { style: { padding:"6px 8px", color:"#10b981" } }, fmtMoney(s.precio)),
                  el("td", { style: { padding:"6px 8px", color:"#f59e0b", fontWeight:600 } }, fmtPct(s.margenCliente)),
                  el("td", { style: { padding:"6px 8px", color:"#94a3b8" } }, fmtNum(s.soTotal)),
                  el("td", { style: { padding:"6px 8px", color:"#10b981", fontWeight:600 } }, fmtMoney(s.margenPesos))
                );
              })
            )
          )
        )
      )
    ) : section("Margen de Digitalife", "\uD83D\uDCB0",
      el("div", { style: { textAlign:"center", padding:20, color:"#475569" } },
        el("div", { style: { fontSize:28, marginBottom:8 } }, "\uD83D\uDCE6"),
        el("div", { style: { fontSize:13 } }, "Sube los archivos de Estrategia de Producto para activar el an\u00E1lisis de m\u00E1rgenes"),
        el("div", { style: { fontSize:11, marginTop:4 } }, "Necesitas: Reporte Acteck + Resumen " + (cliente || clienteKey))
      )
    ),

    // ═══ 5. TOP/BOTTOM SKUs ═══
    skuAnalysis ? section("Top / Bottom SKUs", "\uD83C\uDFC6",
      el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 } },
        el("div", null,
          el("div", { style: { fontSize:12, color:"#10b981", marginBottom:8, fontWeight:600 } }, "\u2B06 Top 10 Sell Out"),
          skuAnalysis.topSO.map(function(s, i) {
            return el("div", { key: s.sku, style: { display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background: i % 2 === 0 ? "#F8FAFC" : "#fff", borderRadius:6, fontSize:11 } },
              el("span", { style: { color:"#64748b", width:16 } }, (i+1) + "."),
              el("span", { style: { flex:1, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" } }, s.desc || s.sku),
              el("span", { style: { color:"#10b981", fontWeight:600 } }, fmtNum(s.soTotal) + " pzas")
            );
          })
        ),
        el("div", null,
          el("div", { style: { fontSize:12, color:"#ef4444", marginBottom:8, fontWeight:600 } }, "\u2B07 Sin Movimiento (con stock)"),
          skuAnalysis.bottomSO.map(function(s, i) {
            return el("div", { key: s.sku, style: { display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background: i % 2 === 0 ? "#F8FAFC" : "#fff", borderRadius:6, fontSize:11 } },
              el("span", { style: { color:"#64748b", width:16 } }, (i+1) + "."),
              el("span", { style: { flex:1, color:"#1e293b", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" } }, s.desc || s.sku),
              el("span", { style: { color:"#ef4444" } }, fmtNum(s.siTotal) + " pzas in")
            );
          })
        )
      )
    ) : section("Top / Bottom SKUs", "\uD83C\uDFC6",
      el("div", { style: { textAlign:"center", padding:20, color:"#475569" } },
        el("div", { style: { fontSize:28, marginBottom:8 } }, "\uD83D\uDCCA"),
        el("div", { style: { fontSize:13 } }, "Sube los datos de Estrategia de Producto para ver el ranking de SKUs")
      )
    ),

    // ═══ 6. SALUD DEL INVENTARIO ═══
    skuAnalysis ? section("Salud del Inventario", "\uD83D\uDCE6",
      el("div", null,
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Total SKUs", fmtNum(skuAnalysis.total), null, "#3b82f6"),
              metricBox("D\u00edas de Inventario", skuAnalysis.diasCobertura ? fmtNum(skuAnalysis.diasCobertura) + "d" : (inventario.length > 0 && ytd.so > 0 ? fmtNum(Math.round(inventario.reduce(function(s,x){return s+(Number(x.valor)||0);},0) / (ytd.so / ytd.mesesConDatos) * 30)) + "d" : "\u2014"), "Cobertura estimada", "#8b5cf6"),
          metricBox(">60 d\u00EDas sin venta", fmtNum(skuAnalysis.sinVenta60.length), "SKUs en riesgo", skuAnalysis.sinVenta60.length > 10 ? "#ef4444" : "#f59e0b"),
          metricBox(">90 d\u00EDas sin venta", fmtNum(skuAnalysis.sinVenta90.length), "Inventario muerto", skuAnalysis.sinVenta90.length > 5 ? "#ef4444" : "#f59e0b"),
          metricBox("Valor Muerto", fmtMoney(skuAnalysis.invMuerto), ">90 d\u00EDas", "#ef4444")
        ),
        skuAnalysis.sinVenta90.length > 0 ? el("div", null,
          el("div", { style: { fontSize:12, color:"#ef4444", marginBottom:8, fontWeight:600 } }, "SKUs cr\u00EDticos (+90 d\u00EDas sin venta)"),
          skuAnalysis.sinVenta90.slice(0, 8).map(function(s) {
            return el("div", { key: s.sku, style: { display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f1f5f9", borderRadius:6, marginBottom:4, fontSize:11 } },
              el("span", { style: { color:"#94a3b8", fontFamily:"monospace", fontSize:10, width:80 } }, s.sku),
              el("span", { style: { flex:1, color:"#1e293b" } }, s.desc),
              el("span", { style: { color:"#ef4444" } }, s.diasSinVenta + "d"),
              el("span", { style: { color:"#f59e0b" } }, fmtNum(s.invStock) + " pzas"),
              el("span", { style: { color:"#94a3b8" } }, fmtMoney(s.invValor))
            );
          })
        ) : null
      )
    ) : section("Salud del Inventario", "\uD83D\uDCE6",
      el("div", { style: { textAlign:"center", padding:20, color:"#475569" } },
        el("div", { style: { fontSize:28, marginBottom:8 } }, "\uD83D\uDCE6"),
        el("div", { style: { fontSize:13 } }, "Sube los archivos de Estrategia de Producto para activar el an\u00E1lisis de inventario")
      )
    ),

    // ═══ 7. PROYECCIÓN ═══
    section("Proyecci\u00F3n de Cierre Anual", "\uD83D\uDD2E",
      el("div", null,
        ytd.mesesConDatos >= 2 ? el("div", null,
          el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
            metricBox("Promedio Mensual SI", fmtM(ytd.avgSI), "\u00DAltimos " + ytd.mesesConDatos + " meses", "#3b82f6"),
            metricBox("Proyecci\u00F3n SI Anual", fmtM(ytd.projSI), "Estimado cierre " + anio, "#8b5cf6"),
            metricBox("Ratio SI/SO", ytd.so > 0 ? fmtPct(ytd.so/ytd.si*100) : "—", ytd.st < 50 ? "â ️ Riesgo alto de sobreinventario" : ytd.st < 70 ? "â ️ Inventario acumulado" : "Rotación saludable", ytd.st < 50 ? "#ef4444" : ytd.st < 70 ? "#f59e0b" : "#10b981"),
          metricBox("Cuota Ideal Anual", totalCuotaIdealA > 0 ? fmtM(totalCuotaIdealA) : "Sin datos", totalCuotaIdealA > 0 ? "Cump: " + fmtPct(cumpCuotaA) : "Subir cuotas", "#F59E0B"),
            metricBox("Promedio Mensual SO", fmtM(ytd.avgSO), "\u00DAltimos " + ytd.mesesConDatos + " meses", "#10b981"),
            metricBox("Proyecci\u00F3n SO Anual", fmtM(ytd.projSO), "Estimado cierre " + anio, "#059669")
          ),
          // Monthly projection bars
          el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Sell In: Real vs Proyectado"),
          el("div", { style: { display:"flex", gap:4, alignItems:"flex-end", height:120 } },
            ventasPorMes.map(function(v) {
              var isReal = v.sell_in > 0;
              var val = isReal ? v.sell_in : ytd.avgSI;
              var maxVal = Math.max(ytd.avgSI * 1.5, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_in;})));
              var h = maxVal > 0 ? Math.max(val / maxVal * 100, 4) : 4;
              return el("div", { key: v.mes, style: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 } },
                el("div", { style: { fontSize:9, color:"#94a3b8" } }, fmtK(val)),
                el("div", { style: { width:"100%", height: h + "px", background: isReal ? "#3b82f6" : "#dbeafe", borderRadius:3, border: isReal ? "none" : "1px dashed #93c5fd" } }),
                el("div", { style: { fontSize:9, color:"#64748b" } }, v.label)
              );
            })
          ),
          el("div", { style: { fontSize:12, color:"#64748b", marginBottom:8, marginTop:16, fontWeight:600 } }, "Sell Out: Real vs Proyectado"),
          el("div", { style: { display:"flex", gap:4, alignItems:"flex-end", height:120 } },
            ventasPorMes.map(function(v) {
              var isReal = v.sell_out > 0;
              var val = isReal ? v.sell_out : ytd.avgSO;
              var maxVal = Math.max(ytd.avgSO * 1.5, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_out;})));
              var h = maxVal > 0 ? Math.max(val / maxVal * 100, 4) : 4;
              return el("div", { key: "so"+v.mes, style: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 } },
                el("div", { style: { fontSize:9, color:"#64748b" } }, fmtK(val)),
                el("div", { style: { width:"100%", height: h + "px", background: isReal ? "#10b981" : "#d1fae5", borderRadius:3, border: isReal ? "none" : "1px dashed #6ee7b7" } }),
                el("div", { style: { fontSize:9, color:"#94a3b8" } }, v.label)
              );
            })
          ),
          ytd.st < 60 ? el("div", { style: { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 16px", marginTop:12, display:"flex", alignItems:"center", gap:10 } },
            el("span", { style: { fontSize:20 } }, "â ️"),
            el("div", null,
              el("div", { style: { fontSize:13, fontWeight:600, color:"#dc2626" } }, "Alerta: Sell Out proyectado muy por debajo del Sell In"),
              el("div", { style: { fontSize:11, color:"#991b1b" } }, "Posible sobreinventario de " + fmtM(ytd.projSI - ytd.projSO) + ". Considerar ajustar sell in o impulsar sell out.")
            )
          ) : null

        ) : el("div", { style: { textAlign:"center", padding:20, color:"#475569", fontSize:13 } }, "Se necesitan al menos 2 meses de datos para proyectar")
      )
    )
  );
}



// ==================== FORECAST CLIENTE ====================
function ForecastCliente({ cliente, clienteKey }) {
  const [loading, setLoading] = React.useState(true);
  const [ventas, setVentas] = React.useState([]);
  const [sellInSku, setSellInSku] = React.useState([]);
  const [sellOutSku, setSellOutSku] = React.useState([]);
  const [inventario, setInventario] = React.useState([]);
  const [enCamino, setEnCamino] = React.useState([]);
  const [productos, setProductos] = React.useState([]);
  const [seccionActiva, setSeccionActiva] = React.useState('resumen');
  const [busqueda, setBusqueda] = React.useState('');
  const [ordenSku, setOrdenSku] = React.useState('riesgo');

  React.useEffect(function() {
    if (!clienteKey) return;
    setLoading(true);
    Promise.all([
      supabase.from('ventas_mensuales').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('sell_in_sku').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('sellout_sku').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('inventario_cliente').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('inventario_en_camino').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('productos_cliente').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; })
    ]).then(function(results) {
      setVentas(results[0] || []);
      setSellInSku(results[1] || []);
      setSellOutSku(results[2] || []);
      setInventario(results[3] || []);
      setEnCamino(results[4] || []);
      setProductos(results[5] || []);
      setLoading(false);
    });
  }, [clienteKey]);

  // ===== HELPER FUNCTIONS =====
  var currentMonth = new Date().getMonth() + 1;
  var currentYear = new Date().getFullYear();

  var fmt = function(n) {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('es-MX');
  };

  var fmtN = function(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Math.round(n).toLocaleString('es-MX');
  };

  // Calculate weighted average demand per SKU (last 3 months sell-out, weighted: recent months heavier)
  var calcDemandaSku = function(sku) {
    var soRows = sellOutSku.filter(function(r) { return r.sku === sku; });
    if (soRows.length === 0) {
      // Fallback to sell-in as proxy
      var siRows = sellInSku.filter(function(r) { return r.sku === sku; });
      if (siRows.length === 0) return { promMensual: 0, tendencia: 0, meses: 0 };
      siRows.sort(function(a, b) { return (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes); });
      var recSi = siRows.slice(0, 3);
      var wSi = [0.5, 0.33, 0.17];
      var totalW = 0; var sumW = 0;
      recSi.forEach(function(r, i) { sumW += (r.piezas || 0) * wSi[i]; totalW += wSi[i]; });
      return { promMensual: totalW > 0 ? sumW / totalW : 0, tendencia: 0, meses: recSi.length, fuente: 'sell-in' };
    }
    soRows.sort(function(a, b) { return (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes); });
    var rec = soRows.slice(0, 3);
    var weights = [0.5, 0.33, 0.17];
    var tW = 0; var sW = 0;
    rec.forEach(function(r, i) { sW += (r.piezas || 0) * weights[i]; tW += weights[i]; });
    var prom = tW > 0 ? sW / tW : 0;
    // Tendencia: diferencia entre mes más reciente y promedio
    var tend = rec.length >= 2 ? ((rec[0].piezas || 0) - (rec[rec.length - 1].piezas || 0)) / rec.length : 0;
    return { promMensual: prom, tendencia: tend, meses: rec.length, fuente: 'sell-out' };
  };

  // Seasonality index by month (from ventas_mensuales)
  var calcSeasonality = function() {
    if (ventas.length === 0) return {};
    var byMonth = {};
    var total = 0;
    ventas.forEach(function(v) {
      var m = parseInt(v.mes);
      var so = parseFloat(v.sell_out) || parseFloat(v.sell_in) || 0;
      if (!byMonth[m]) byMonth[m] = { sum: 0, count: 0 };
      byMonth[m].sum += so;
      byMonth[m].count += 1;
      total += so;
    });
    var avgMonth = total / 12;
    var indices = {};
    for (var m = 1; m <= 12; m++) {
      if (byMonth[m] && avgMonth > 0) {
        indices[m] = (byMonth[m].sum / byMonth[m].count) / avgMonth;
      } else {
        indices[m] = 1;
      }
    }
    return indices;
  };

  var seasonality = calcSeasonality();

  // Get all unique SKUs
  var allSkus = React.useMemo(function() {
    var set = {};
    productos.forEach(function(p) { set[p.sku] = true; });
    inventario.forEach(function(i) { set[i.sku] = true; });
    sellInSku.forEach(function(s) { set[s.sku] = true; });
    sellOutSku.forEach(function(s) { set[s.sku] = true; });
    return Object.keys(set);
  }, [productos, inventario, sellInSku, sellOutSku]);

  // Build forecast data per SKU
  var forecastData = React.useMemo(function() {
    return allSkus.map(function(sku) {
      var prod = productos.find(function(p) { return p.sku === sku; }) || {};
      var inv = inventario.find(function(i) { return i.sku === sku; }) || {};
      var transit = enCamino.filter(function(e) { return e.sku === sku && e.estatus !== 'entregado'; });
      var transitPzas = transit.reduce(function(s, t) { return s + (t.piezas || 0); }, 0);
      var demanda = calcDemandaSku(sku);
      var stockActual = inv.stock || 0;
      var stockTotal = stockActual + transitPzas;
      var coberturaSemanas = demanda.promMensual > 0 ? (stockTotal / demanda.promMensual) * 4.33 : 999;
      var coberturaActualSemanas = demanda.promMensual > 0 ? (stockActual / demanda.promMensual) * 4.33 : 999;

      // Sugerido de compra: 8 semanas de cobertura target
      var targetSemanas = 8;
      var necesario = Math.ceil(demanda.promMensual * (targetSemanas / 4.33));
      var sugerido = Math.max(0, necesario - stockTotal);

      // Risk level
      var riesgo = 'ok';
      if (coberturaSemanas < 2) riesgo = 'critico';
      else if (coberturaSemanas < 4) riesgo = 'bajo';
      else if (coberturaSemanas > 16) riesgo = 'sobrestock';

      // Proyección next 6 months
      var proyeccion = [];
      for (var i = 1; i <= 6; i++) {
        var mesP = ((currentMonth - 1 + i) % 12) + 1;
        var seasonIdx = seasonality[mesP] || 1;
        var demMes = Math.round(demanda.promMensual * seasonIdx);
        proyeccion.push({ mes: mesP, demanda: demMes });
      }

      return {
        sku: sku,
        descripcion: prod.descripcion || inv.titulo || sku,
        marca: prod.marca || inv.marca || '',
        categoria: prod.categoria || '',
        stockActual: stockActual,
        enTransito: transitPzas,
        stockTotal: stockTotal,
        demandaMensual: Math.round(demanda.promMensual),
        tendencia: demanda.tendencia,
        fuenteDemanda: demanda.fuente || 'sell-out',
        coberturaSemanas: Math.round(coberturaSemanas * 10) / 10,
        coberturaActualSemanas: Math.round(coberturaActualSemanas * 10) / 10,
        sugerido: sugerido,
        riesgo: riesgo,
        costoUnitario: parseFloat(prod.costo_promedio) || parseFloat(inv.costo_convenio) || 0,
        valorSugerido: sugerido * (parseFloat(prod.costo_promedio) || parseFloat(inv.costo_convenio) || 0),
        proyeccion: proyeccion,
        transitDetail: transit
      };
    }).filter(function(d) { return d.demandaMensual > 0 || d.stockActual > 0 || d.enTransito > 0; });
  }, [allSkus, productos, inventario, enCamino, sellInSku, sellOutSku, seasonality]);

  // ===== AGGREGATIONS =====
  var totalDemanda = forecastData.reduce(function(s, d) { return s + d.demandaMensual; }, 0);
  var totalStock = forecastData.reduce(function(s, d) { return s + d.stockActual; }, 0);
  var totalTransito = forecastData.reduce(function(s, d) { return s + d.enTransito; }, 0);
  var totalSugerido = forecastData.reduce(function(s, d) { return s + d.sugerido; }, 0);
  var totalValorSugerido = forecastData.reduce(function(s, d) { return s + d.valorSugerido; }, 0);
  var coberturaGlobal = totalDemanda > 0 ? ((totalStock + totalTransito) / totalDemanda) * 4.33 : 0;
  var criticos = forecastData.filter(function(d) { return d.riesgo === 'critico'; }).length;
  var bajos = forecastData.filter(function(d) { return d.riesgo === 'bajo'; }).length;
  var sobrestock = forecastData.filter(function(d) { return d.riesgo === 'sobrestock'; }).length;

  // Filter and sort
  var filteredData = forecastData.filter(function(d) {
    if (!busqueda) return true;
    var b = busqueda.toLowerCase();
    return (d.sku && d.sku.toLowerCase().indexOf(b) >= 0) ||
           (d.descripcion && d.descripcion.toLowerCase().indexOf(b) >= 0) ||
           (d.marca && d.marca.toLowerCase().indexOf(b) >= 0);
  });

  filteredData.sort(function(a, b) {
    if (ordenSku === 'riesgo') {
      var riskOrder = { critico: 0, bajo: 1, ok: 2, sobrestock: 3 };
      return (riskOrder[a.riesgo] || 2) - (riskOrder[b.riesgo] || 2);
    }
    if (ordenSku === 'demanda') return b.demandaMensual - a.demandaMensual;
    if (ordenSku === 'cobertura') return a.coberturaSemanas - b.coberturaSemanas;
    if (ordenSku === 'sugerido') return b.sugerido - a.sugerido;
    return 0;
  });

  // Month names
  var meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Risk badge helper
  var riskBadge = function(riesgo) {
    var colors = {
      critico: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Cr\u00edtico' },
      bajo: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Stock Bajo' },
      ok: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'OK' },
      sobrestock: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Sobrestock' }
    };
    var c = colors[riesgo] || colors.ok;
    return React.createElement('span', {
      style: { padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
               backgroundColor: c.bg, color: c.color, border: '1px solid ' + c.border }
    }, c.label);
  };

  // Semaphore bar
  var semaphoreBar = function(semanas) {
    var pct = Math.min(100, (semanas / 16) * 100);
    var color = semanas < 2 ? '#dc2626' : semanas < 4 ? '#d97706' : semanas <= 12 ? '#16a34a' : '#2563eb';
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      React.createElement('div', { style: { flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' } },
        React.createElement('div', { style: { width: pct + '%', height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s' } })
      ),
      React.createElement('span', { style: { fontSize: '12px', fontWeight: 600, color: color, minWidth: '50px' } },
        semanas >= 999 ? 'Sin demanda' : semanas.toFixed(1) + ' sem')
    );
  };

  // ===== SECTIONS =====
  var secciones = [
    { key: 'resumen', label: 'Resumen de Forecast', icon: '\uD83D\uDCCA' },
    { key: 'demanda', label: 'Demanda Proyectada', icon: '\uD83D\uDCC8' },
    { key: 'cobertura', label: 'Cobertura de Inventario', icon: '\uD83D\uDEE1\uFE0F' },
    { key: 'sugerido', label: 'Sugerido de Compra', icon: '\uD83D\uDED2' },
    { key: 'temporalidad', label: 'Temporalidad', icon: '\uD83D\uDCC5' },
    { key: 'alertas', label: 'Alertas y Riesgos', icon: '\u26A0\uFE0F' }
  ];

  if (loading) {
    return React.createElement('div', { style: { minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '48px', marginBottom: '16px', animation: 'pulse 2s infinite' } }, '\uD83D\uDD2E'),
        React.createElement('p', { style: { color: '#64748b', fontSize: '16px' } }, 'Calculando forecast...')
      )
    );
  }

  // ===== SECTION: RESUMEN =====
  var renderResumen = function() {
    var kpis = [
      { label: 'Demanda Mensual Prom.', value: fmtN(totalDemanda) + ' pzas', sub: 'Basado en sell-out ponderado', color: '#6366f1' },
      { label: 'Stock Disponible', value: fmtN(totalStock) + ' pzas', sub: fmt(totalStock * (forecastData.length > 0 ? forecastData.reduce(function(s,d){return s+d.costoUnitario;},0)/forecastData.length : 0)), color: '#10b981' },
      { label: 'En Tr\u00e1nsito', value: fmtN(totalTransito) + ' pzas', sub: enCamino.length + ' pedidos activos', color: '#f59e0b' },
      { label: 'Cobertura Global', value: coberturaGlobal.toFixed(1) + ' semanas', sub: coberturaGlobal < 4 ? 'Nivel bajo' : coberturaGlobal > 12 ? 'Sobrestock' : 'Nivel saludable', color: coberturaGlobal < 4 ? '#dc2626' : '#10b981' },
      { label: 'Sugerido de Compra', value: fmtN(totalSugerido) + ' pzas', sub: fmt(totalValorSugerido), color: '#8b5cf6' },
      { label: 'SKUs en Riesgo', value: criticos + bajos, sub: criticos + ' cr\u00edticos, ' + bajos + ' bajos', color: criticos > 0 ? '#dc2626' : '#f59e0b' }
    ];

    return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' } },
      kpis.map(function(k, i) {
        return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '4px solid ' + k.color } },
          React.createElement('p', { style: { fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 } }, k.label),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#1e293b', margin: '4px 0' } }, k.value),
          React.createElement('p', { style: { fontSize: '12px', color: '#94a3b8' } }, k.sub)
        );
      })
    );
  };

  // ===== SECTION: DEMANDA PROYECTADA =====
  var renderDemanda = function() {
    return React.createElement('div', null,
      // Search and sort bar
      React.createElement('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' } },
        React.createElement('input', {
          type: 'text', placeholder: 'Buscar SKU, descripci\u00f3n o marca...',
          value: busqueda, onChange: function(e) { setBusqueda(e.target.value); },
          style: { flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }
        }),
        React.createElement('select', {
          value: ordenSku, onChange: function(e) { setOrdenSku(e.target.value); },
          style: { padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', backgroundColor: '#ffffff', cursor: 'pointer' }
        },
          React.createElement('option', { value: 'riesgo' }, 'Ordenar: Mayor riesgo'),
          React.createElement('option', { value: 'demanda' }, 'Ordenar: Mayor demanda'),
          React.createElement('option', { value: 'cobertura' }, 'Ordenar: Menor cobertura'),
          React.createElement('option', { value: 'sugerido' }, 'Ordenar: Mayor sugerido')
        )
      ),
      // SKU cards
      React.createElement('div', { style: { display: 'grid', gap: '12px' } },
        filteredData.slice(0, 50).map(function(d, i) {
          return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } },
              React.createElement('div', null,
                React.createElement('span', { style: { fontSize: '14px', fontWeight: 700, color: '#1e293b' } }, d.sku),
                React.createElement('span', { style: { fontSize: '12px', color: '#64748b', marginLeft: '8px' } }, d.marca),
                React.createElement('p', { style: { fontSize: '12px', color: '#94a3b8', marginTop: '2px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, d.descripcion)
              ),
              riskBadge(d.riesgo)
            ),
            // Mini projection bars
            React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-end', height: '40px', marginBottom: '8px' } },
              d.proyeccion.map(function(p, j) {
                var maxD = Math.max.apply(null, d.proyeccion.map(function(x) { return x.demanda; }));
                var h = maxD > 0 ? (p.demanda / maxD) * 36 + 4 : 4;
                return React.createElement('div', { key: j, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 } },
                  React.createElement('div', { style: { width: '100%', height: h + 'px', backgroundColor: '#c7d2fe', borderRadius: '3px' } }),
                  React.createElement('span', { style: { fontSize: '9px', color: '#94a3b8', marginTop: '2px' } }, meses[p.mes])
                );
              })
            ),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' } },
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Demanda/mes: '),
                React.createElement('span', { style: { fontWeight: 600, color: '#1e293b' } }, fmtN(d.demandaMensual))
              ),
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Stock: '),
                React.createElement('span', { style: { fontWeight: 600, color: '#1e293b' } }, fmtN(d.stockActual))
              ),
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Tr\u00e1nsito: '),
                React.createElement('span', { style: { fontWeight: 600, color: '#1e293b' } }, fmtN(d.enTransito))
              ),
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Tendencia: '),
                React.createElement('span', { style: { fontWeight: 600, color: d.tendencia > 0 ? '#16a34a' : d.tendencia < 0 ? '#dc2626' : '#64748b' } },
                  d.tendencia > 0 ? '\u2191' : d.tendencia < 0 ? '\u2193' : '\u2194')
              )
            )
          );
        })
      ),
      filteredData.length > 50 ? React.createElement('p', { style: { textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '12px' } },
        'Mostrando 50 de ' + filteredData.length + ' SKUs. Usa el buscador para filtrar.') : null
    );
  };

  // ===== SECTION: COBERTURA =====
  var renderCobertura = function() {
    var sorted = filteredData.slice().sort(function(a, b) { return a.coberturaSemanas - b.coberturaSemanas; });
    return React.createElement('div', null,
      // Legend
      React.createElement('div', { style: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' } },
        [{ color: '#dc2626', label: 'Cr\u00edtico (<2 sem)' }, { color: '#d97706', label: 'Bajo (2-4 sem)' },
         { color: '#16a34a', label: 'Saludable (4-12 sem)' }, { color: '#2563eb', label: 'Sobrestock (>12 sem)' }].map(function(l, i) {
          return React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('div', { style: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: l.color } }),
            React.createElement('span', { style: { fontSize: '12px', color: '#64748b' } }, l.label)
          );
        })
      ),
      // Coverage list
      React.createElement('div', { style: { display: 'grid', gap: '8px' } },
        sorted.slice(0, 60).map(function(d, i) {
          return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } },
            React.createElement('div', { style: { minWidth: '140px' } },
              React.createElement('span', { style: { fontSize: '13px', fontWeight: 600, color: '#1e293b' } }, d.sku),
              React.createElement('p', { style: { fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' } }, d.marca)
            ),
            React.createElement('div', { style: { flex: 1 } }, semaphoreBar(d.coberturaSemanas)),
            React.createElement('div', { style: { minWidth: '100px', textAlign: 'right', fontSize: '12px' } },
              React.createElement('span', { style: { color: '#64748b' } }, fmtN(d.stockTotal) + ' pzas'),
              React.createElement('span', { style: { color: '#94a3b8', marginLeft: '4px' } }, '/ ' + fmtN(d.demandaMensual) + ' dem')
            )
          );
        })
      )
    );
  };

  // ===== SECTION: SUGERIDO DE COMPRA =====
  var renderSugerido = function() {
    var need = filteredData.filter(function(d) { return d.sugerido > 0; }).sort(function(a, b) { return b.valorSugerido - a.valorSugerido; });
    var totalPzas = need.reduce(function(s, d) { return s + d.sugerido; }, 0);
    var totalVal = need.reduce(function(s, d) { return s + d.valorSugerido; }, 0);

    return React.createElement('div', null,
      // Summary banner
      React.createElement('div', { style: { backgroundColor: '#f5f3ff', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid #e9d5ff', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '12px' } },
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '13px', color: '#7c3aed' } }, 'SKUs por comprar'),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#5b21b6' } }, need.length)
        ),
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '13px', color: '#7c3aed' } }, 'Total piezas'),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#5b21b6' } }, fmtN(totalPzas))
        ),
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '13px', color: '#7c3aed' } }, 'Inversi\u00f3n estimada'),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#5b21b6' } }, fmt(totalVal))
        )
      ),
      // Table
      React.createElement('div', { style: { backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' } },
              ['SKU', 'Marca', 'Demanda/mes', 'Stock', 'Tr\u00e1nsito', 'Cobertura', 'Sugerido', 'Valor'].map(function(h, i) {
                return React.createElement('th', { key: i, style: { padding: '10px 12px', textAlign: i > 1 ? 'right' : 'left', color: '#64748b', fontWeight: 600 } }, h);
              })
            )
          ),
          React.createElement('tbody', null,
            need.slice(0, 50).map(function(d, i) {
              return React.createElement('tr', { key: i, style: { borderBottom: '1px solid #f1f5f9' } },
                React.createElement('td', { style: { padding: '10px 12px', fontWeight: 600, color: '#1e293b' } }, d.sku),
                React.createElement('td', { style: { padding: '10px 12px', color: '#64748b' } }, d.marca),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#1e293b' } }, fmtN(d.demandaMensual)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#1e293b' } }, fmtN(d.stockActual)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#f59e0b' } }, fmtN(d.enTransito)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right' } }, riskBadge(d.riesgo)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' } }, fmtN(d.sugerido) + ' pzas'),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#5b21b6' } }, fmt(d.valorSugerido))
              );
            })
          )
        )
      )
    );
  };

  // ===== SECTION: TEMPORALIDAD =====
  var renderTemporalidad = function() {
    // Ventas mensuales aggregated
    var monthlyData = [];
    for (var m = 1; m <= 12; m++) {
      var vRow = ventas.find(function(v) { return parseInt(v.mes) === m; });
      var si = vRow ? (parseFloat(vRow.sell_in) || 0) : 0;
      var so = vRow ? (parseFloat(vRow.sell_out) || 0) : 0;
      var idx = seasonality[m] || 1;
      monthlyData.push({ mes: m, label: meses[m], si: si, so: so, index: idx });
    }
    var maxVal = Math.max.apply(null, monthlyData.map(function(d) { return Math.max(d.si, d.so); }).concat([1]));

    return React.createElement('div', null,
      // Seasonality chart
      React.createElement('div', { style: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' } },
        React.createElement('h3', { style: { fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' } }, '\uD83D\uDCC5 Patr\u00f3n de Estacionalidad'),
        React.createElement('div', { style: { display: 'flex', gap: '4px', alignItems: 'flex-end', height: '160px', padding: '0 8px' } },
          monthlyData.map(function(d, i) {
            var barH = maxVal > 0 ? (d.si / maxVal) * 140 : 0;
            var barHso = maxVal > 0 ? (d.so / maxVal) * 140 : 0;
            var isFuture = d.mes > currentMonth;
            return React.createElement('div', { key: i, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } },
              React.createElement('div', { style: { display: 'flex', gap: '2px', alignItems: 'flex-end', height: '140px' } },
                React.createElement('div', { style: { width: '14px', height: Math.max(barH, 2) + 'px', backgroundColor: isFuture ? '#bfdbfe' : '#3b82f6', borderRadius: '3px 3px 0 0', opacity: isFuture ? 0.5 : 1 } }),
                React.createElement('div', { style: { width: '14px', height: Math.max(barHso, 2) + 'px', backgroundColor: isFuture ? '#bbf7d0' : '#10b981', borderRadius: '3px 3px 0 0', opacity: isFuture ? 0.5 : 1 } })
              ),
              React.createElement('span', { style: { fontSize: '10px', color: '#64748b', marginTop: '4px' } }, d.label),
              React.createElement('span', { style: { fontSize: '9px', color: d.index > 1.15 ? '#dc2626' : d.index < 0.85 ? '#2563eb' : '#94a3b8', fontWeight: d.index > 1.15 || d.index < 0.85 ? 600 : 400 } },
                (d.index * 100).toFixed(0) + '%')
            );
          })
        ),
        // Legend
        React.createElement('div', { style: { display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('div', { style: { width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' } }),
            React.createElement('span', { style: { fontSize: '12px', color: '#64748b' } }, 'Sell In')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('div', { style: { width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' } }),
            React.createElement('span', { style: { fontSize: '12px', color: '#64748b' } }, 'Sell Out')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('span', { style: { fontSize: '12px', color: '#94a3b8' } }, '\u00cdndice < 100% = mes bajo | > 100% = mes alto')
          )
        )
      ),
      // Insight cards
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' } },
        React.createElement('div', { style: { backgroundColor: '#fff7ed', borderRadius: '12px', padding: '16px', border: '1px solid #fed7aa' } },
          React.createElement('p', { style: { fontWeight: 700, color: '#c2410c', fontSize: '14px', marginBottom: '4px' } }, '\uD83D\uDD25 Meses Pico'),
          React.createElement('p', { style: { fontSize: '13px', color: '#9a3412' } },
            monthlyData.filter(function(d) { return d.index > 1.15; }).map(function(d) { return d.label + ' (' + (d.index * 100).toFixed(0) + '%)'; }).join(', ') || 'Sin datos suficientes')
        ),
        React.createElement('div', { style: { backgroundColor: '#eff6ff', borderRadius: '12px', padding: '16px', border: '1px solid #bfdbfe' } },
          React.createElement('p', { style: { fontWeight: 700, color: '#1d4ed8', fontSize: '14px', marginBottom: '4px' } }, '\u2744\uFE0F Meses Valle'),
          React.createElement('p', { style: { fontSize: '13px', color: '#1e40af' } },
            monthlyData.filter(function(d) { return d.index < 0.85 && d.si > 0; }).map(function(d) { return d.label + ' (' + (d.index * 100).toFixed(0) + '%)'; }).join(', ') || 'Sin datos suficientes')
        ),
        React.createElement('div', { style: { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '16px', border: '1px solid #bbf7d0' } },
          React.createElement('p', { style: { fontWeight: 700, color: '#15803d', fontSize: '14px', marginBottom: '4px' } }, '\uD83D\uDCCA Ratio SI/SO Promedio'),
          React.createElement('p', { style: { fontSize: '13px', color: '#166534' } },
            (function() {
              var totalSI = monthlyData.reduce(function(s, d) { return s + d.si; }, 0);
              var totalSO = monthlyData.reduce(function(s, d) { return s + d.so; }, 0);
              var ratio = totalSO > 0 ? (totalSI / totalSO).toFixed(2) : 'N/A';
              return 'Ratio: ' + ratio + 'x' + (ratio > 1.5 ? ' \u2014 Posible sobreabastecimiento' : ratio < 0.8 ? ' \u2014 Demanda supera oferta' : ' \u2014 Balance saludable');
            })()
          )
        )
      )
    );
  };

  // ===== SECTION: ALERTAS =====
  var renderAlertas = function() {
    var alertas = [];

    // Critical stockout
    forecastData.filter(function(d) { return d.riesgo === 'critico'; }).forEach(function(d) {
      alertas.push({ tipo: 'critico', icon: '\uD83D\uDEA8', titulo: 'Riesgo de desabasto: ' + d.sku, desc: d.descripcion + ' \u2014 Cobertura: ' + d.coberturaSemanas.toFixed(1) + ' semanas. Stock: ' + d.stockActual + ' pzas, demanda: ' + d.demandaMensual + ' pzas/mes', accion: 'Compra urgente: ' + d.sugerido + ' pzas (' + fmt(d.valorSugerido) + ')' });
    });

    // Low stock
    forecastData.filter(function(d) { return d.riesgo === 'bajo'; }).forEach(function(d) {
      alertas.push({ tipo: 'bajo', icon: '\u26A0\uFE0F', titulo: 'Stock bajo: ' + d.sku, desc: 'Cobertura: ' + d.coberturaSemanas.toFixed(1) + ' semanas. Se agota en ~' + Math.round(d.coberturaSemanas / 4.33) + ' meses.', accion: 'Sugerido: ' + d.sugerido + ' pzas' });
    });

    // Overstock
    forecastData.filter(function(d) { return d.riesgo === 'sobrestock'; }).slice(0, 10).forEach(function(d) {
      var mesesStock = d.demandaMensual > 0 ? Math.round(d.stockTotal / d.demandaMensual) : 999;
      alertas.push({ tipo: 'sobrestock', icon: '\uD83D\uDCE6', titulo: 'Sobrestock: ' + d.sku, desc: d.stockTotal + ' pzas = ' + mesesStock + ' meses de inventario. Capital inmovilizado: ' + fmt(d.stockTotal * d.costoUnitario), accion: 'Evaluar promoci\u00f3n o redistribuci\u00f3n' });
    });

    // Dead inventory (stock > 0, demanda = 0)
    forecastData.filter(function(d) { return d.stockActual > 0 && d.demandaMensual === 0; }).slice(0, 5).forEach(function(d) {
      alertas.push({ tipo: 'muerto', icon: '\uD83D\uDC80', titulo: 'Inventario muerto: ' + d.sku, desc: d.stockActual + ' pzas sin demanda. Valor: ' + fmt(d.stockActual * d.costoUnitario), accion: 'Liquidar o regresar a proveedor' });
    });

    var colorMap = { critico: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }, bajo: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }, sobrestock: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, muerto: { bg: '#f8fafc', border: '#e2e8f0', text: '#334155' } };

    return React.createElement('div', null,
      // Summary
      React.createElement('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' } },
        [{ label: 'Cr\u00edticos', count: criticos, color: '#dc2626' },
         { label: 'Stock Bajo', count: bajos, color: '#d97706' },
         { label: 'Sobrestock', count: sobrestock, color: '#2563eb' },
         { label: 'Inv. Muerto', count: forecastData.filter(function(d) { return d.stockActual > 0 && d.demandaMensual === 0; }).length, color: '#64748b' }
        ].map(function(s, i) {
          return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '12px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', textAlign: 'center', minWidth: '120px', borderTop: '3px solid ' + s.color } },
            React.createElement('p', { style: { fontSize: '24px', fontWeight: 700, color: s.color } }, s.count),
            React.createElement('p', { style: { fontSize: '12px', color: '#64748b' } }, s.label)
          );
        })
      ),
      // Alert list
      alertas.length === 0 ?
        React.createElement('div', { style: { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '24px', textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '32px' } }, '\u2705'),
          React.createElement('p', { style: { fontSize: '16px', fontWeight: 600, color: '#16a34a' } }, 'Sin alertas activas'),
          React.createElement('p', { style: { fontSize: '13px', color: '#4ade80' } }, 'Todos los SKUs tienen cobertura saludable')
        ) :
        React.createElement('div', { style: { display: 'grid', gap: '10px' } },
          alertas.slice(0, 30).map(function(a, i) {
            var c = colorMap[a.tipo] || colorMap.bajo;
            return React.createElement('div', { key: i, style: { backgroundColor: c.bg, borderRadius: '10px', padding: '14px 16px', border: '1px solid ' + c.border } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px' } },
                React.createElement('span', { style: { fontSize: '20px' } }, a.icon),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('p', { style: { fontWeight: 700, color: c.text, fontSize: '14px' } }, a.titulo),
                  React.createElement('p', { style: { fontSize: '12px', color: c.text, opacity: 0.8, marginTop: '2px' } }, a.desc),
                  React.createElement('p', { style: { fontSize: '12px', fontWeight: 600, color: c.text, marginTop: '6px', backgroundColor: 'rgba(255,255,255,0.5)', display: 'inline-block', padding: '2px 8px', borderRadius: '6px' } }, '\u2192 ' + a.accion)
                )
              )
            );
          })
        )
    );
  };

  // ===== MAIN RENDER =====
  var renderMap = {
    resumen: renderResumen,
    demanda: renderDemanda,
    cobertura: renderCobertura,
    sugerido: renderSugerido,
    temporalidad: renderTemporalidad,
    alertas: renderAlertas
  };

  return React.createElement('div', { style: { minHeight: '100vh', backgroundColor: '#f8fafc', padding: '24px' } },
    // Header
    React.createElement('div', { style: { backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '4px solid #6366f1' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' } },
        React.createElement('div', null,
          React.createElement('h2', { style: { fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 } }, '\uD83D\uDD2E Forecast \u2014 ' + cliente),
          React.createElement('p', { style: { fontSize: '14px', color: '#64748b', marginTop: '4px' } }, 'Proyecci\u00f3n de demanda, cobertura de inventario y sugeridos de compra')
        ),
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement('span', { style: { fontSize: '12px', color: '#94a3b8' } }, 'Actualizado: ' + new Date().toLocaleDateString('es-MX')),
          React.createElement('span', { style: { fontSize: '12px', padding: '4px 10px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '8px', fontWeight: 500 } }, allSkus.length + ' SKUs')
        )
      )
    ),
    // Section tabs
    React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' } },
      secciones.map(function(s) {
        var isActive = seccionActiva === s.key;
        return React.createElement('button', {
          key: s.key,
          onClick: function() { setSeccionActiva(s.key); },
          style: { padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? 700 : 500,
                   backgroundColor: isActive ? '#6366f1' : '#ffffff', color: isActive ? '#ffffff' : '#64748b',
                   boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }
        }, s.icon + ' ' + s.label);
      })
    ),
    // Active section content
    React.createElement('div', null, renderMap[seccionActiva] ? renderMap[seccionActiva]() : null)
  );
}
// ==================== FIN FORECAST CLIENTE ====================
// ── PanelActualizacion ── Central update panel (slide-over)
function PanelActualizacion({ onClose, cliente, clienteKey, anio, onVentasUpdate, onGoToSection }) {
  return React.createElement("div", {
    className: "fixed inset-0 z-50 flex",
    onClick: function(e) { if (e.target === e.currentTarget) onClose(); }
  },
    React.createElement("div", { className: "absolute inset-0 bg-black bg-opacity-40" }),
    React.createElement("div", {
      className: "relative ml-auto w-full max-w-md bg-white shadow-2xl flex flex-col h-full",
      style: { animation: "slideInRight 0.3s ease-out" }
    },
      React.createElement("div", { className: "flex items-center justify-between p-5 border-b border-gray-100" },
        React.createElement("div", null,
          React.createElement("h2", { className: "text-lg font-bold text-gray-800" }, "\uD83D\uDD04 Central de Actualizaci\u00F3n"),
          React.createElement("p", { className: "text-xs text-gray-400 mt-0.5" }, "Actualiza todos los datos desde un solo lugar")
        ),
        React.createElement("button", {
          onClick: onClose,
          className: "w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
        }, "\u2715")
      ),
      React.createElement("div", { className: "flex-1 overflow-y-auto p-5 space-y-5" },
        React.createElement("div", { className: "bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-4 border border-blue-200" },
          React.createElement("div", { className: "flex items-center gap-2 mb-3" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCCA"),
            React.createElement("div", null,
              React.createElement("p", { className: "text-sm font-semibold text-blue-800" }, "Ventas Mensuales"),
              React.createElement("p", { className: "text-xs text-blue-500" }, "Excel Central de Ventas")
            )
          ),
          React.createElement(ActualizarDatosExcel, { cliente: clienteKey, anio: anio, onComplete: onVentasUpdate })
        ),
        React.createElement("div", { className: "bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl p-4 border border-emerald-200 cursor-pointer hover:shadow-md transition-shadow", onClick: function() { if (onGoToSection) { onGoToSection("estrategia"); onClose(); } } },
          React.createElement("div", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCE6"),
            React.createElement("div", { className: "flex-1" },
              React.createElement("p", { className: "text-sm font-semibold text-emerald-800" }, "Estrategia de Producto"),
              React.createElement("p", { className: "text-xs text-emerald-500" }, "Reporte Acteck + Resumen Cliente")
            ),
            React.createElement("span", { className: "text-xs bg-emerald-600 text-white px-2 py-0.5 rounded-full font-medium" }, "Activo")
          )
        ),
        React.createElement("div", { className: "bg-gradient-to-br from-amber-50 to-amber-100 rounded-xl p-4 border border-amber-200 opacity-60" },
          React.createElement("div", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCE7"),
            React.createElement("div", { className: "flex-1" },
              React.createElement("p", { className: "text-sm font-semibold text-amber-800" }, "Correos y Reportes"),
              React.createElement("p", { className: "text-xs text-amber-500" }, "Descarga autom\u00E1tica de reportes por email")
            ),
            React.createElement("span", { className: "text-xs bg-amber-200 text-amber-700 px-2 py-0.5 rounded-full font-medium" }, "Pronto")
          )
        ),
        React.createElement("div", { className: "bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-4 border border-purple-200 opacity-60" },
          React.createElement("div", { className: "flex items-center gap-2" },
            React.createElement("span", { className: "text-lg" }, "\uD83D\uDCE3"),
            React.createElement("div", { className: "flex-1" },
              React.createElement("p", { className: "text-sm font-semibold text-purple-800" }, "Marketing"),
              React.createElement("p", { className: "text-xs text-purple-500" }, "Importar campa\u00F1as y m\u00E9tricas")
            ),
            React.createElement("span", { className: "text-xs bg-purple-200 text-purple-700 px-2 py-0.5 rounded-full font-medium" }, "Pronto")
          )
        )
      ),
      React.createElement("div", { className: "p-4 border-t border-gray-100 bg-gray-50" },
        React.createElement("p", { className: "text-xs text-gray-400 text-center" },
          "Cliente: ", React.createElement("span", { className: "font-semibold text-gray-600" }, cliente),
          " \u00B7 A\u00F1o: ", React.createElement("span", { className: "font-semibold text-gray-600" }, anio)
        )
      )
    )
  );
}


export default function App() {
  const [mlData, setMlData] = useState(null);
    const [mlLoading, setMlLoading] = useState(true);
    useEffect(() => {
      let cancelled = false;
      setMlLoading(true);
      fetch("/api/ml-sellout?year=2026")
        .then(r => r.json())
        .then(data => {
          if (!cancelled && data.sellOutPorMes) setMlData(data);
        })
        .catch(err => console.error("ML sellout fetch error:", err))
        .finally(() => { if (!cancelled) setMlLoading(false); });
      return () => { cancelled = true; };
    }, []);

  // Enrich ML client with live data
  const clientesDinamicos = { ...clientes };
  if (mlData) {
    const mesesArr = Object.keys(mlData.sellOutPorMes || {}).sort((a,b) => Number(a) - Number(b));
    const ultimoMes = mesesArr.length > 0 ? mesesArr[mesesArr.length - 1] : null;
    const sellOutUltimoMes = ultimoMes ? mlData.sellOutPorMes[ultimoMes] : 0;
    clientesDinamicos.mercadolibre = {
      ...clientes.mercadolibre,
      ejecutivo: "Fernando Cabrera",
      kpis: {
        ...clientes.mercadolibre.kpis,
        sellOut: sellOutUltimoMes,
        sellOutAcumulado: mlData.totalMonto || 0,
        ultimoMes: ultimoMes ? ["","Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"][Number(ultimoMes)] : "---",
      },
      tendencia: {
        ...clientes.mercadolibre.tendencia,
        sellOut: mesesArr.map(m => mlData.sellOutPorMes[m]),
      },
      sellOutMarca: mlData.sellOutPorMarca || {},
      sellOutPorMesMarca: mlData.sellOutPorMesMarca || {},
      totalOrdenes: mlData.totalOrdenes || 0,
      totalMonto: mlData.totalMonto || 0,
    };
  }

  
    const [clienteActivo, setClienteActivo] = useState("digitalife");
  const [modoPresent, setModoPresent] = useState(false);
  const [paginaActiva, setPaginaActiva] = useState("home");
  const [showUpdatePanel, setShowUpdatePanel] = useState(false);

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
    const base = clientesDinamicos[clienteActivo];
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
    { id: "home",       label: "Resumen",               icono: "🏠", habilitado: true  },
    { id: "analisis",   label: "Análisis",                icono: "📈", habilitado: true  },
    { id: "estrategia", label: "Estrategia de Producto", icono: "📦", habilitado: true  },
    { id: "marketing",  label: "Marketing",              icono: "📣", habilitado: true  },
    { id: "pagos",      label: "Pagos",                  icono: "💰", habilitado: true  },
    { id: "cartera",    label: "Crédito y Cobranza",     icono: "📊", habilitado: true  },
  ]

  return (
    <div className="flex h-screen bg-gray-50 font-sans">

      {/* SIDEBAR */}
      <aside className="w-52 bg-white border-r border-gray-100 flex flex-col shadow-sm shrink-0 overflow-y-auto">

        {/* Logo + Botón Modo Presentación */}
        <div className="p-3 border-b border-gray-100">
          {!modoPresent ? (
            <>
              <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Administración de Clientes</p>
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

        {/* Botón Resumen General */}
        <div className="px-4 py-2 border-b border-gray-100">
          <button
            onClick={() => setPaginaActiva("resumen")}
            className={"w-full text-left text-sm font-medium px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 " + (paginaActiva === "resumen" ? "bg-gradient-to-r from-indigo-50 to-blue-50 text-indigo-700 shadow-sm border border-indigo-100" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
          >
            <span>{"📊"}</span>
            <span>Resumen General</span>
          </button>
        </div>

        {/* Botón Forecast */}
          <div className="px-4 py-2 border-b border-gray-100">
            <button
              onClick={() => setPaginaActiva("forecast")}
              className={"w-full text-left text-sm font-medium px-3 py-2.5 rounded-xl transition-all flex items-center gap-2 " + (paginaActiva === "forecast" ? "bg-gradient-to-r from-emerald-50 to-teal-50 text-emerald-700 shadow-sm border border-emerald-100" : "text-gray-500 hover:bg-gray-50 hover:text-gray-700")}
            >
              <span>{"🔮"}</span>
              <span>Forecast</span>
            </button>
          </div>

          {/* Selector de cliente — se oculta en modo presentación */}
        {!modoPresent && (
          <div className="p-4 border-b border-gray-100">
            <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Cliente</p>
            <div className="space-y-1">
              {Object.entries(clientesDinamicos).map(([key, cl]) => (
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

        <div className="p-4 border-t border-gray-100">
            <button
              onClick={() => setShowUpdatePanel(true)}
              className="w-full text-sm font-semibold px-3 py-3 rounded-xl transition-all bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
            >
              {"\uD83D\uDD04"} Actualizar Datos
            </button>
          </div>
          {/* Footer */}
        <div className="p-4 border-t border-gray-100">
          <p className="text-xs text-gray-300 text-center">v1.0 · Abril 2026</p>
        </div>
      </aside>

      {/* CONTENIDO */}
      <main className="flex-1 overflow-y-auto">
        {/* Banner modo presentación */}
        { /* Banner removed */ }
          {paginaActiva === "resumen" && <ResumenCuentas />}
          <>
            <>
        {paginaActiva === "home"    && <HomeCliente cliente={c} clienteKey={clienteActivo} onUploadComplete={() => setVentasVer(v => v+1)} isML={clienteActivo === "mercadolibre"} />}
        {paginaActiva === "cartera" && <CreditoCobranza cliente={c} />}
        {paginaActiva === "pagos"   && <PagosCliente cliente={c} />}
          {paginaActiva === "analisis" && React.createElement(AnalisisCliente, { cliente: clientesDinamicos[clienteActivo] ? clientesDinamicos[clienteActivo].nombre : clienteActivo, clienteKey: clienteActivo })}
            {paginaActiva === "estrategia" && <EstrategiaProducto cliente={clienteActivo === "digitalife" ? "Digitalife" : "{c.nombre}"}  clienteKey={clienteActivo} />}
        {paginaActiva === "marketing" && React.createElement(MarketingCliente, { cliente: clienteActivo })}
                    {paginaActiva === "forecast" && React.createElement(ForecastCliente, { cliente: c.nombre, clienteKey: clienteActivo })}
</>
          </>
</main>
      {showUpdatePanel && React.createElement(PanelActualizacion, {
        onClose: function() { setShowUpdatePanel(false); },
        cliente: clientesDinamicos[clienteActivo] ? clientesDinamicos[clienteActivo].nombre : clienteActivo,
        clienteKey: clienteActivo,
        anio: 2026,
        onVentasUpdate: function() { setVentasVer(function(v) { return v + 1; }); }
      })}


    </div>
  );
}
