import { useState, useEffect } from "react";
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

function HomeCliente({ cliente }) {
  const c = cliente;
  const k = c.kpis;
  const salud = calcularSalud(k, c.pagos);
  const pctCuotaMes = k.cuotaMes > 0 ? Math.round((k.sellInMes / k.cuotaMes) * 100) : 0;
  const pctCuotaAcum = k.cuotaAcumulada > 0 ? Math.round((k.sellInAcumulado / k.cuotaAcumulada) * 100) : 0;
  const pctCuotaAnual = Math.round((k.sellInAcumulado / c.cuotaAnual) * 100);

  return (
    <div className="min-h-screen bg-gray-50 p-6">

      {/* ENCABEZADO */}
      <div className="bg-white rounded-2xl shadow-sm p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg"
                 style={{ backgroundColor: c.color }}>
              {c.nombre[0]}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-800">{c.nombre}</h1>
              <p className="text-sm text-gray-400">
                <span className="font-medium" style={{ color: c.color }}>{c.marca}</span>
                {" · "}Ejecutivo: {c.ejecutivo}
                {" · "}Frecuencia: {c.frecuencia}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Semaforo estado={salud} />
            <div className="text-right">
              <span className="text-xs text-gray-400 block">
                Actualizado: {formatFecha(c.cartera?.ultimaActualizacion || new Date().toISOString().slice(0,10))}
                {c.cartera?.horaActualizacion ? ` · ${c.cartera.horaActualizacion} hrs` : ""}
              </span>
              {c.cartera?.tipoCambio && (
                <span className="text-xs text-gray-400">TC: ${c.cartera.tipoCambio.toFixed(2)} MXN/USD</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs — FILA 1: Sell In con barra de cuota */}
      <div className="grid grid-cols-1 gap-4 mb-4 md:grid-cols-2">

        {/* Sell In Mes + Acumulado */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4" style={{ borderColor: c.color }}>
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Sell In — {k.ultimoMes || "Último mes"}</p>
          <div className="flex items-end gap-3">
            <p className="text-2xl font-bold text-gray-800">{formatMXN(k.sellInMes)}</p>
            <span className={`text-xs px-2 py-0.5 rounded-full font-semibold mb-1 ${pctCuotaMes >= 100 ? "bg-green-100 text-green-700" : pctCuotaMes >= 80 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"}`}>
              {pctCuotaMes}% del mes
            </span>
          </div>
          <p className="text-xs text-gray-400 mb-2">Cuota: {formatMXN(k.cuotaMes)} · Mínimo: {formatMXN(k.cuotaMes25M)}</p>
          <div className="border-t pt-3 mt-1">
            <div className="flex justify-between items-center mb-1">
              <span className="text-xs text-gray-500 font-medium">Acumulado 2026</span>
              <span className="text-sm font-bold text-gray-700">{formatMXN(k.sellInAcumulado)}</span>
            </div>
            <BarraCuota actual={k.sellInAcumulado} objetivo={k.cuotaAcumulada} minimo={k.cuotaAcumulada * (25/30)} />
            <p className="text-xs text-gray-400 mt-1">vs cuota acumulada {formatMXN(k.cuotaAcumulada)} · <span className="font-semibold">{pctCuotaAcum}%</span></p>
          </div>
        </div>

        {/* Avance Anual */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border-t-4 border-blue-500">
          <p className="text-xs text-gray-400 uppercase tracking-wide mb-1">Avance Anual 2026</p>
          <div className="flex items-end gap-3">
            <p className="text-2xl font-bold text-gray-800">{pctCuotaAnual}%</p>
            <span className="text-xs text-gray-400 mb-1">de {(c.cuotaAnual/1000000).toFixed(0)}M objetivo</span>
          </div>
          <p className="text-xs text-gray-400 mb-3">{formatMXN(k.sellInAcumulado)} facturado de {formatMXN(c.cuotaAnual)}</p>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
            <div className="h-full rounded-full bg-blue-500" style={{ width: `${Math.min(pctCuotaAnual, 100)}%` }} />
          </div>
          <div className="border-t pt-3 mt-2 grid grid-cols-2 gap-2 text-xs">
            <div>
              <p className="text-gray-400">2025 Sell In</p>
              <p className="font-semibold text-gray-700">{formatMXN(15755483)}</p>
            </div>
            <div>
              <p className="text-gray-400">Crec. necesario</p>
              <p className="font-semibold text-blue-600">+{Math.round((30000000/15755483-1)*100)}% vs 2025</p>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs — FILA 2: Sell Out e Inventario */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <KPICard
          label={`Sell Out — ${k.ultimoMes || "Último mes"}`}
          valor={formatMXN(k.sellOut)}
          sub={`Acumulado 2026: ${formatMXN(k.sellOutAcumulado)}`}
          color="#8b5cf6"
        />
        <KPICard
          label="Días de Inventario"
          valor={`${k.diasInventario} días`}
          sub={k.diasInventario > 90 ? "⚠️ Inventario elevado" : k.diasInventario < 15 ? "⚠️ Inventario bajo" : "✅ Nivel adecuado"}
          color="#0ea5e9"
          alerta={k.diasInventario > 90 || k.diasInventario < 15}
        />
      </div>

      {/* TARJETAS PRINCIPALES */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <TarjetaPendientes pendientes={c.pendientes} />
        <TarjetaPagos pagos={c.pagos} />
        <TarjetaPromociones promos={c.promocionesActivas} />
        <TarjetaMinuta minuta={c.minuta} />
      </div>

    </div>
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

// ─── PAGOS — CONSTANTES COMPARTIDAS ──────────────────────────────────────────
const CATEGORIA_META = {
  promociones:     { label: "Promociones",      icono: "🎯", color: "#E31E26", prefix: "PRO" },
  marketing:       { label: "Plan de Marketing", icono: "📣", color: "#3b82f6", prefix: "MKT" },
  pagosFijos:     { label: "Pagos Fijos",      icono: "🏢", color: "#8b5cf6", prefix: "PF"  },
  pagosVariables: { label: "Pagos Variables",  icono: "📊", color: "#f59e0b", prefix: "PV"  },
  rebate:           { label: "Rebate",           icono: "🔄", color: "#10b981", prefix: "REB" },
};

const ESTATUS_OPT = [
  { value: "pendiente",   label: "Pendiente",  bg: "bg-yellow-100", text: "text-yellow-700", dot: "bg-yellow-400" },
  { value: "en proceso",  label: "En Proceso", bg: "bg-blue-100",   text: "text-blue-700",   dot: "bg-blue-400"   },
  { value: "pagado",      label: "Pagado",     bg: "bg-green-100",  text: "text-green-700",  dot: "bg-green-500"  },
  { value: "vencido",     label: "Vencido",    bg: "bg-red-100",    text: "text-red-700",    dot: "bg-red-500"    },
];

const MESES_CORTO = { "01":"Ene","02":"Feb","03":"Mar","04":"Abr","05":"May","06":"Jun","07":"Jul","08":"Ago","09":"Sep","10":"Oct","11":"Nov","12":"Dic" };

// ─── PAGOS Y COMPROMISOS (Supabase) ──────────────────────────────────────────
function PagosCliente({ cliente }) {
  const c = cliente;

  // ── State ──
  const [registros, setRegistros]     = useState([]);
  const [loading, setLoading]         = useState(true);
  const [catActiva, setCatActiva]     = useState("todas");
  const [editingCell, setEditingCell] = useState(null); // { id, field }
  const [editValue, setEditValue]     = useState("");
  const [saving, setSaving]           = useState(false);
  const [toast, setToast]             = useState(null); // { msg, type }
  const [showAdd, setShowAdd]         = useState(false);
  const [newRow, setNewRow]           = useState({
    folio: "", concepto: "", categoria: "promociones", monto: "",
    estatus: "pendiente", fecha_compromiso: "", fecha_pago_real: "",
    responsable: "", notas: "",
  });

  // ── Data loading ──
  useEffect(() => {
    if (!DB_CONFIGURED) {
      // Usar datos del hardcode como modo lectura
      const seed = Object.entries(PAGOS_DIGITALIFE_2026.categorias).flatMap(([key, cat]) =>
        cat.items.map(item => ({ ...item, id: item.folio, categoria: key }))
      );
      setRegistros(seed);
      setLoading(false);
      return;
    }
    fetchData();
    // Suscripción en tiempo real — cualquier cambio se refleja automáticamente
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
  const saveEdit   = async () => {
    if (!editingCell) return;
    const { id, field } = editingCell;
    const value = field === "monto" ? (parseFloat(editValue) || 0) : (editValue || null);
    // Actualización optimista
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

  // ── Add record ──
  const handleAdd = async () => {
    if (!newRow.concepto.trim()) return;
    const meta   = CATEGORIA_META[newRow.categoria] || CATEGORIA_META.promociones;
    const sameC  = registros.filter(r => r.categoria === newRow.categoria).length;
    const folio  = newRow.folio.trim() || `${meta.prefix}-${String(sameC + 1).padStart(3, "0")}`;
    const record = {
      ...newRow, folio,
      monto:             parseFloat(newRow.monto) || 0,
      fecha_compromiso:  newRow.fecha_compromiso  || null,
      fecha_pago_real:   newRow.fecha_pago_real   || null,
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

  // ── Delete record ──
  const handleDelete = async (id) => {
    if (!window.confirm("¼Eliminar este registro? Esta acción no se puede deshacer.")) return;
    setRegistros(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from("pagos").delete().eq("id", id);
    if (error) { flash("Error al eliminar ✗", "err"); fetchData(); }
    else flash("Eliminado ✓");
  };

  // ── Computed KPIs ──
  const filtered      = catActiva === "todas" ? registros : registros.filter(r => r.categoria === catActiva);
  const totalPagado   = registros.filter(r => r.estatus === "pagado").reduce((s, r) => s + (r.monto || 0), 0);
  const totalPorPagar = registros.filter(r => ["pendiente","en proceso"].includes(r.estatus)).reduce((s, r) => s + (r.monto || 0), 0);
  const totalVencido  = registros.filter(r => r.estatus === "vencido").reduce((s, r) => s + (r.monto || 0), 0);
  const totalAnio     = registros.reduce((s, r) => s + (r.monto || 0), 0);

  // ── Monthly breakdown ──
  const monthlyBreakdown = () => {
    const months = {};
    registros.forEach(r => {
      const d = r.fecha_compromiso;
      if (!d) return;
      const m = typeof d === "string" ? d.slice(0, 7) : new Date(d).toISOString().slice(0, 7);
      if (!months[m]) months[m] = { mes: m, total: 0, promociones: 0, marketing: 0, pagosFijos: 0, pagosVariables: 0 };
      months[m].total += (r.monto || 0);
      if (CATEGORIA_META[r.categoria]) months[m][r.categoria] = (months[m][r.categoria] || 0) + (r.monto || 0);
    });
    return Object.values(months).sort((a, b) => a.mes.localeCompare(b.mes));
  };

  // ── Inline cell renderer (función, no componente, para evitar remounts) ──
  const renderCell = (row, field, type = "text") => {
    const isEditing = editingCell?.id === row.id && editingCell?.field === field;
    const inputCls  = "w-full border border-blue-400 rounded px-2 py-1 text-sm outline-none bg-blue-50 focus:ring-1 focus:ring-blue-400";

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

    // Modo display
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
            : <span className="text-gray-400 text-xs italic">Por definir</span>
          }
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
              Para que todos los cambios se guarden y sean visibles para el equipo, configura las variables en Vercel y la tabla en Supabase (ver instrucciones).
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

          {/* Main table */}
          <div className="bg-white rounded-2xl shadow-sm p-5 mb-6">

            {/* Filter tabs + Add button */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <button onClick={() => setCatActiva("todas")}
                className={`px-4 py-1.5 rounded-full text-sm font-semibold transition-all ${catActiva === "todas" ? "bg-gray-800 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                Todas
              </button>
              {Object.entries(CATEGORIA_META).map(([key, meta]) => (
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
                    { label: "Concepto *",  key: "concepto",  type: "text"       },
                    { label: "Monto (MXN)", key: "monto",     type: "number"     },
                    { label: "Estatus",     key: "estatus",   type: "select-est" },
                    { label: "F. Compromiso", key: "fecha_compromiso", type: "date" },
                    { label: "F. Pago Real",  key: "fecha_pago_real",  type: "date" },
                    { label: "Responsable",   key: "responsable",      type: "text" },
                    { label: "Folio", key: "folio", type: "text" },
              { label: "Notas",         key: "notas",            type: "text" },
                  ].map(({ label, key, type }) => (
                    <div key={key}>
                      <label className="text-xs text-gray-500 block mb-1">{label}</label>
                      {type === "select-cat" ? (
                        <select value={newRow.categoria} onChange={e => setNewRow(p => ({ ...p, categoria: e.target.value }))}
                          className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                          {Object.entries(CATEGORIA_META).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                        </select>
                      ) : type === "select-est" ? (
                        <select value={newRow.estatus} onChange={e => setNewRow(p => ({ ...p, estatus: e.target.value }))}
                          className="w-full border rounded-lg px-2 py-1.5 text-sm bg-white">
                          {ESTATUS_OPT.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      ) : (
                        <input type={type} value={newRow[key] || ""} placeholder={key === "monto" ? "0" : ""}
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
                        <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded whitespace-nowrap">{row.folio}</span>
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
                            <td className="py-2.5 pr-4 font-semibold text-gray-700">{MESES_CORTO[mo]} {yr}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.promociones    > 0 ? formatMXN(m.promociones)    : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.marketing      > 0 ? formatMXN(m.marketing)      : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.pagosFijos    > 0 ? formatMXN(m.pagosFijos)    : <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.pagosVariables> 0 ? formatMXN(m.pagosVariables): <span className="text-gray-300">—</span>}</td>
                            <td className="py-2.5 pr-4 text-right text-gray-600">{m.rebate > 0 ? formatMXN(m.rebate) : <span className="text-gray-300">—</span>}</td>
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
                {MONTHS.map((month, idx) => (
                  <th key={month} className="px-2 py-3 text-center font-semibold text-gray-700 text-xs cursor-pointer hover:bg-gray-100"
                      onClick={() => handleCatSort("m_" + idx)}>
                    {month}{catSortArrow("m_" + idx)}
                  </th>
                ))}
                <th className="px-4 py-3 text-right font-semibold text-gray-700 cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                    onClick={() => handleCatSort("ventas")}>
                  Total ${catSortArrow("ventas")}
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
                    {cat.monthlyVentas.map((val, idx) => (
                      <td key={idx} className={`px-2 py-3 text-center text-xs ${val > 0 ? "font-medium text-gray-800" : "text-gray-300"}`}>
                        {val > 0 ? formatMXN(val).replace("$", "").trim() : "—"}
                      </td>
                    ))}
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
                {monthValForYear.map((key, idx) => {
                  const monthTotal = filtered.reduce((s, p) => s + (p[key] || 0), 0);
                  return (
                    <td key={idx} className="px-2 py-3 text-center text-xs text-gray-800">
                      {monthTotal > 0 ? formatMXN(monthTotal).replace("$", "").trim() : "—"}
                    </td>
                  );
                })}
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
export default function App() {
  const [clienteActivo, setClienteActivo] = useState("digitalife");
  const [modoPresent, setModoPresent] = useState(false);
  const [paginaActiva, setPaginaActiva] = useState("home");

  const c = clientes[clienteActivo];

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
        {paginaActiva === "home"    && <HomeCliente cliente={c} />}
        {paginaActiva === "cartera" && <CreditoCobranza cliente={c} />}
        {paginaActiva === "pagos"   && <PagosCliente cliente={c} />}
          {paginaActiva === "estrategia" && <EstrategiaProducto cliente={clienteActivo === "digitalife" ? "Digitalife" : "PCEL"} />}
      </main>

    </div>
  );
}
