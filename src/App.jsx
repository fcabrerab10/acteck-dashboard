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
  // lineaCreditoMXN = 500,000 Ã 17.76 = 8,880,000

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
      { id: 1, nombre: "Campaña Madre Mayo", aportacionActeck: 15000, aportacionCliente: 8000, vigencia: "01 May â 15 May 2026" },
      { id: 2, nombre: "Bundle Auriculares Q2", aportacionActeck: 10000, aportacionCliente: 5000, vigencia: "10 Abr â 30 Abr 2026" },
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
      { id: 1, nombre: "Promo Teclados Mayo", aportacionActeck: 8000, aportacionCliente: 4000, vigencia: "01 May â 31 May 2026" },
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
              <p className="text-gray-400 text-xs mt-0.5">{p.responsable} Â· {formatFecha(p.fecha)}</p>
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
                  {p.estado === "vencida" ? <span className="text-red-500 font-semibold"> Â· Vencida hace {Math.abs(dias)} días</span>
                  : p.estado === "por vencer" ? <span className="text-yellow-600 font-semibold"> Â· {dias} días</span>
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
              <p className="text-xs text-gray-400 mt-1">Inversión total: {formatMXN(total)} Â· Nosotros {pctActeck}% / Cliente {100 - pctActeck}%</p>
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
              <span className="text-xs text-gray-500 font