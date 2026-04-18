import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { puedeEditar } from "../../lib/permisos";
import {
  Plus, Trash2, CheckCircle2, Clock, Circle, ChevronLeft, ChevronRight,
  CalendarDays, X, Edit3, Filter, Flame, PauseCircle,
} from "lucide-react";

/**
 * Administración Interna
 * ─────────────────────────
 * Calendario (arriba) + Pendientes (abajo)
 * Solo super_admin y asistente (RLS + guardas de UI)
 */

// ────────── Constantes de dominio ──────────
const CUENTAS = [
  { id: "mercadolibre", label: "Mercado Libre", color: "bg-yellow-100 text-yellow-800 border-yellow-200", stripe: "#F59E0B", emoji: "🟡" },
  { id: "digitalife",   label: "Digitalife",    color: "bg-blue-100 text-blue-800 border-blue-200",       stripe: "#3B82F6", emoji: "🔵" },
  { id: "pcel",         label: "PCEL",          color: "bg-red-100 text-red-800 border-red-200",          stripe: "#EF4444", emoji: "🔴" },
  { id: "otro",         label: "Otro",          color: "bg-purple-100 text-purple-800 border-purple-200", stripe: "#A855F7", emoji: "🟣" },
];

const ESTATUS = [
  { id: "pendiente",  label: "Pendiente",  icon: Circle,        cls: "text-gray-600 bg-gray-100",           dot: "#9CA3AF", emoji: "⚪" },
  { id: "en_proceso", label: "En proceso", icon: Clock,         cls: "text-amber-700 bg-amber-100",         dot: "#F59E0B", emoji: "🟡" },
  { id: "urgente",    label: "Urgente",    icon: Flame,         cls: "text-red-700 bg-red-100",             dot: "#DC2626", emoji: "🔴" },
  { id: "en_pausa",   label: "En pausa",   icon: PauseCircle,   cls: "text-slate-600 bg-slate-200",         dot: "#64748B", emoji: "🟨" },
  { id: "listo",      label: "Listo",      icon: CheckCircle2,  cls: "text-emerald-700 bg-emerald-100",     dot: "#10B981", emoji: "🟢" },
];

const TIPOS_EVENTO = [
  { id: "salida_trabajo", label: "Salida por trabajo", color: "#3b82f6" },
  { id: "vacaciones",     label: "Vacaciones",          color: "#10b981" },
  { id: "permiso",        label: "Permiso / personal",  color: "#f59e0b" },
  { id: "home_office",    label: "Home office",         color: "#8b5cf6" },
  { id: "feriado",        label: "Feriado",             color: "#ef4444" },
  { id: "reunion",        label: "Reunión interna",     color: "#14b8a6" },
];

// Sugerencias de categoría (autocomplete — el usuario puede tipear cualquier cosa)
const CATEGORIAS_SUGERIDAS = [
  "Reputación ML",
  "Mensajes postventa / Reclamos y Preguntas",
  "Publicaciones",
  "Campañas y promociones",
  "Materiales de marketing",
  "Plan de MKT",
  "Carga de productos / catálogo",
  "Seguimiento de solicitud de diseños",
  "Seguimiento de pagos / facturas",
  "Envío de cotizaciones",
  "Ayuda a Hans",
  "Clips / Contenido",
  "Revisión",
  "Excel",
  "Cobranza",
  "Reunión",
  "Administrativo",
];

const DIAS_SEMANA = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MESES_LARGO = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ────────── Utilidades de fecha ──────────
const toISO = (d) => {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
};
const parseISO = (s) => {
  if (!s) return null;
  const [y, m, d] = s.slice(0, 10).split("-").map((n) => parseInt(n, 10));
  return new Date(y, m - 1, d);
};
const lunesDeSemana = (d) => {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // Lunes = 0
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const mismaFecha = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// Color consistente por persona (hash del UUID → una de 6 paletas)
const PALETAS_USUARIO = [
  { bg: "bg-rose-100",    text: "text-rose-700",    dot: "#f43f5e" },
  { bg: "bg-indigo-100",  text: "text-indigo-700",  dot: "#6366f1" },
  { bg: "bg-emerald-100", text: "text-emerald-700", dot: "#10b981" },
  { bg: "bg-orange-100",  text: "text-orange-700",  dot: "#f97316" },
  { bg: "bg-cyan-100",    text: "text-cyan-700",    dot: "#06b6d4" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-700", dot: "#d946ef" },
];
const paletaPorUsuario = (userId) => {
  if (!userId) return PALETAS_USUARIO[0];
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return PALETAS_USUARIO[h % PALETAS_USUARIO.length];
};

// ────────── Componente principal ──────────
export default function AdministracionInterna() {
  const perfil = usePerfil();
  const canEdit = puedeEditar(perfil);
  const [perfiles, setPerfiles] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendario — mes visible
  const [mesVisible, setMesVisible] = useState(() => {
    const d = new Date(); d.setDate(1); d.setHours(0, 0, 0, 0); return d;
  });

  // Pendientes — semana visible
  const [semanaVisible, setSemanaVisible] = useState(() => lunesDeSemana(new Date()));

  // Filtros pendientes
  const [filtroCuenta, setFiltroCuenta] = useState("todas");
  const [filtroEstatus, setFiltroEstatus] = useState("todos");
  const [filtroResponsable, setFiltroResponsable] = useState("todos");

  // Modales
  const [modalTarea, setModalTarea] = useState(null);   // { tarea? } o null
  const [modalEvento, setModalEvento] = useState(null); // { evento? } o null

  // ── Carga inicial ──
  useEffect(() => { cargarTodo(); /* eslint-disable-next-line */ }, []);

  async function cargarTodo() {
    setLoading(true);
    try {
      const [pRes, peRes, evRes] = await Promise.all([
        supabase.from("perfiles").select("user_id, nombre, email, rol, activo").eq("activo", true),
        supabase.from("pendientes_equipo").select("*").order("fecha_limite", { ascending: true }),
        supabase.from("eventos_equipo").select("*").order("fecha_ini", { ascending: true }),
      ]);
      if (pRes.data)  setPerfiles(pRes.data);
      if (peRes.data) setPendientes(peRes.data);
      if (evRes.data) setEventos(evRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  const nombrePorUserId = useMemo(() => {
    const map = {};
    perfiles.forEach((p) => { map[p.user_id] = p.nombre || p.email || "—"; });
    return map;
  }, [perfiles]);

  // ── Pendientes filtrados ──
  const pendientesFiltrados = useMemo(() => {
    return pendientes.filter((p) => {
      if (filtroCuenta !== "todas" && p.cuenta !== filtroCuenta) return false;
      if (filtroEstatus !== "todos" && p.estatus !== filtroEstatus) return false;
      if (filtroResponsable !== "todos" && p.responsable !== filtroResponsable) return false;
      return true;
    });
  }, [pendientes, filtroCuenta, filtroEstatus, filtroResponsable]);

  // ── Pendientes de la semana visible, agrupados por día ──
  const pendientesPorDia = useMemo(() => {
    const res = {};
    for (let i = 0; i < 7; i++) {
      const d = new Date(semanaVisible); d.setDate(d.getDate() + i);
      res[toISO(d)] = [];
    }
    // "Sin fecha" bucket
    res["sin_fecha"] = [];
    pendientesFiltrados.forEach((p) => {
      if (!p.fecha_limite) { res["sin_fecha"].push(p); return; }
      const k = p.fecha_limite.slice(0, 10);
      if (res[k] !== undefined) res[k].push(p);
    });
    return res;
  }, [pendientesFiltrados, semanaVisible]);

  // Estadísticas rápidas de la semana
  const statsSemana = useMemo(() => {
    const keys = Object.keys(pendientesPorDia).filter((k) => k !== "sin_fecha");
    const all = keys.flatMap((k) => pendientesPorDia[k]);
    return {
      total: all.length,
      pendiente:  all.filter((p) => p.estatus === "pendiente").length,
      en_proceso: all.filter((p) => p.estatus === "en_proceso").length,
      urgente:    all.filter((p) => p.estatus === "urgente").length,
      en_pausa:   all.filter((p) => p.estatus === "en_pausa").length,
      listo:      all.filter((p) => p.estatus === "listo").length,
    };
  }, [pendientesPorDia]);

  // ── Cambiar estatus inline ──
  async function cambiarEstatus(id, nuevo) {
    if (!canEdit) return;
    setPendientes((prev) => prev.map((p) => (p.id === id ? { ...p, estatus: nuevo } : p)));
    const { error } = await supabase.from("pendientes_equipo").update({ estatus: nuevo }).eq("id", id);
    if (error) { console.error(error); cargarTodo(); }
  }

  async function borrarPendiente(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    setPendientes((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("pendientes_equipo").delete().eq("id", id);
    if (error) { console.error(error); cargarTodo(); }
  }

  async function borrarEvento(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar este evento del calendario?")) return;
    setEventos((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("eventos_equipo").delete().eq("id", id);
    if (error) { console.error(error); cargarTodo(); }
  }

  // ── UI ──
  if (loading) {
    return <div className="p-8 text-gray-400">Cargando administración interna…</div>;
  }

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">🏢 Administración Interna</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pendientes del equipo · Calendario · Vacaciones y salidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <>
              <button
                onClick={() => setModalEvento({})}
                className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm font-medium text-gray-700 flex items-center gap-1.5"
              >
                <CalendarDays className="w-4 h-4" /> + Evento
              </button>
              <button
                onClick={() => setModalTarea({})}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Nueva tarea
              </button>
            </>
          )}
        </div>
      </div>

      {/* CALENDARIO */}
      <Calendario
        mesVisible={mesVisible}
        setMesVisible={setMesVisible}
        eventos={eventos}
        nombrePorUserId={nombrePorUserId}
        canEdit={canEdit}
        onClickEvento={(ev) => setModalEvento({ evento: ev })}
        onClickDia={(fecha) => canEdit && setModalEvento({ fechaDefault: fecha })}
      />

      {/* STATS SEMANA — más visual */}
      <div className="bg-white rounded-xl border border-gray-100 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-700">Resumen de la semana</h3>
          <div className="text-xs text-gray-500">
            {statsSemana.total > 0 && (
              <span>
                <span className="font-semibold text-emerald-600">{statsSemana.listo}</span>
                /{statsSemana.total} completadas ·{" "}
                <span className="font-semibold text-emerald-600">{Math.round((statsSemana.listo / statsSemana.total) * 100)}%</span>
              </span>
            )}
          </div>
        </div>
        <div className="grid grid-cols-6 gap-3">
          <StatCard label="Total"      value={statsSemana.total}      color="gray"    emoji="📋" />
          <StatCard label="Urgente"    value={statsSemana.urgente}    color="red"     emoji="🔴" />
          <StatCard label="En proceso" value={statsSemana.en_proceso} color="amber"   emoji="🟡" />
          <StatCard label="Pendiente"  value={statsSemana.pendiente}  color="gray"    emoji="⚪" />
          <StatCard label="En pausa"   value={statsSemana.en_pausa}   color="slate"   emoji="⏸️" />
          <StatCard label="Listo"      value={statsSemana.listo}      color="emerald" emoji="🟢" />
        </div>
        {/* Barra de progreso */}
        {statsSemana.total > 0 && (
          <div className="mt-3 h-2 rounded-full bg-gray-100 overflow-hidden flex">
            <div className="bg-red-500"     style={{ width: `${(statsSemana.urgente    / statsSemana.total) * 100}%` }} />
            <div className="bg-amber-400"   style={{ width: `${(statsSemana.en_proceso / statsSemana.total) * 100}%` }} />
            <div className="bg-gray-300"    style={{ width: `${(statsSemana.pendiente  / statsSemana.total) * 100}%` }} />
            <div className="bg-slate-400"   style={{ width: `${(statsSemana.en_pausa   / statsSemana.total) * 100}%` }} />
            <div className="bg-emerald-500" style={{ width: `${(statsSemana.listo      / statsSemana.total) * 100}%` }} />
          </div>
        )}
      </div>

      {/* FILTROS */}
      <div className="bg-white rounded-xl border border-gray-100 p-3 flex items-center gap-3 flex-wrap">
        <Filter className="w-4 h-4 text-gray-400" />
        <select
          value={filtroCuenta}
          onChange={(e) => setFiltroCuenta(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="todas">Todas las cuentas</option>
          {CUENTAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <select
          value={filtroEstatus}
          onChange={(e) => setFiltroEstatus(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="todos">Todos los estatus</option>
          {ESTATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <select
          value={filtroResponsable}
          onChange={(e) => setFiltroResponsable(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="todos">Todos los responsables</option>
          {perfiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>)}
        </select>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(semanaVisible); d.setDate(d.getDate() - 7); setSemanaVisible(d);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSemanaVisible(lunesDeSemana(new Date()))}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const d = new Date(semanaVisible); d.setDate(d.getDate() + 7); setSemanaVisible(d);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* PENDIENTES SEMANA — grid de tarjetas por día */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            📋 Pendientes · Semana del {semanaVisible.getDate()} de {MESES_LARGO[semanaVisible.getMonth()]}
          </h2>
        </div>

        <div className="space-y-3">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(semanaVisible); d.setDate(d.getDate() + i);
            const key = toISO(d);
            const items = pendientesPorDia[key] || [];
            const esHoy = mismaFecha(d, new Date());
            // Ocultar sábado/domingo si están vacíos
            const esFinde = i >= 5;
            if (esFinde && items.length === 0) return null;
            return (
              <DiaBloque
                key={key}
                fecha={d}
                esHoy={esHoy}
                pendientes={items}
                nombrePorUserId={nombrePorUserId}
                canEdit={canEdit}
                onCambiarEstatus={cambiarEstatus}
                onEditar={(p) => setModalTarea({ tarea: p })}
                onBorrar={borrarPendiente}
                onAgregar={() => canEdit && setModalTarea({ fechaDefault: toISO(d) })}
              />
            );
          })}

          {(pendientesPorDia["sin_fecha"]?.length || 0) > 0 && (
            <DiaBloque
              fecha={null}
              esHoy={false}
              etiquetaSinFecha
              pendientes={pendientesPorDia["sin_fecha"]}
              nombrePorUserId={nombrePorUserId}
              canEdit={canEdit}
              onCambiarEstatus={cambiarEstatus}
              onEditar={(p) => setModalTarea({ tarea: p })}
              onBorrar={borrarPendiente}
              onAgregar={() => canEdit && setModalTarea({})}
            />
          )}
        </div>
      </div>

      {/* MODALES */}
      {modalTarea && (
        <ModalTarea
          data={modalTarea}
          perfiles={perfiles}
          onClose={() => setModalTarea(null)}
          onGuardado={() => { cargarTodo(); setModalTarea(null); }}
        />
      )}
      {modalEvento && (
        <ModalEvento
          data={modalEvento}
          perfiles={perfiles}
          onClose={() => setModalEvento(null)}
          onGuardado={() => { cargarTodo(); setModalEvento(null); }}
          onBorrar={borrarEvento}
        />
      )}
    </div>
  );
}

// ────────── Calendario mensual ──────────
function Calendario({ mesVisible, setMesVisible, eventos, nombrePorUserId, canEdit, onClickEvento, onClickDia }) {
  // Matriz 6x7 de días
  const primerDia = new Date(mesVisible); primerDia.setDate(1);
  const startOffset = (primerDia.getDay() + 6) % 7; // Lunes = 0
  const inicio = new Date(primerDia); inicio.setDate(1 - startOffset);

  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio); d.setDate(inicio.getDate() + i);
    celdas.push(d);
  }

  const eventosPorFecha = useMemo(() => {
    const m = {};
    eventos.forEach((ev) => {
      const ini = parseISO(ev.fecha_ini);
      const fin = parseISO(ev.fecha_fin);
      if (!ini || !fin) return;
      const cur = new Date(ini);
      while (cur <= fin) {
        const k = toISO(cur);
        if (!m[k]) m[k] = [];
        m[k].push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return m;
  }, [eventos]);

  const hoy = new Date();

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Header mes */}
      <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
        <h2 className="font-semibold text-gray-800">
          📅 {MESES_LARGO[mesVisible.getMonth()]} {mesVisible.getFullYear()}
        </h2>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(mesVisible); d.setMonth(d.getMonth() - 1); setMesVisible(d);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { const d = new Date(); d.setDate(1); setMesVisible(d); }}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Hoy
          </button>
          <button
            onClick={() => {
              const d = new Date(mesVisible); d.setMonth(d.getMonth() + 1); setMesVisible(d);
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Leyenda de tipos */}
      <div className="px-4 py-2 border-b border-gray-100 flex flex-wrap gap-3 text-xs">
        {TIPOS_EVENTO.map((t) => (
          <span key={t.id} className="flex items-center gap-1.5 text-gray-600">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.color }} />
            {t.label}
          </span>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7 text-xs text-gray-500 border-b border-gray-100">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="px-2 py-1.5 font-medium">{d.slice(0, 3)}</div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((d, idx) => {
          const delMes = d.getMonth() === mesVisible.getMonth();
          const esHoy = mismaFecha(d, hoy);
          const evts = eventosPorFecha[toISO(d)] || [];
          return (
            <div
              key={idx}
              onClick={() => onClickDia && onClickDia(toISO(d))}
              className={[
                "min-h-[84px] border-t border-r border-gray-100 p-1.5 flex flex-col gap-0.5",
                delMes ? "bg-white" : "bg-gray-50",
                canEdit ? "cursor-pointer hover:bg-blue-50/40" : "",
              ].join(" ")}
            >
              <div className={[
                "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full",
                esHoy ? "bg-blue-600 text-white" : delMes ? "text-gray-700" : "text-gray-400",
              ].join(" ")}>
                {d.getDate()}
              </div>
              <div className="flex-1 flex flex-col gap-0.5 overflow-hidden">
                {evts.slice(0, 3).map((ev) => {
                  const tipo = TIPOS_EVENTO.find((t) => t.id === ev.tipo);
                  const paleta = paletaPorUsuario(ev.responsable);
                  return (
                    <button
                      key={ev.id + "_" + idx}
                      onClick={(e) => { e.stopPropagation(); onClickEvento(ev); }}
                      className={`${paleta.bg} ${paleta.text} text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 text-left`}
                      title={`${tipo?.label || ev.tipo} · ${nombrePorUserId[ev.responsable] || "—"}`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: tipo?.color || "#999" }} />
                      <span className="truncate">{ev.titulo}</span>
                    </button>
                  );
                })}
                {evts.length > 3 && (
                  <span className="text-[10px] text-gray-400">+{evts.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────── Stat Card ──────────
function StatCard({ label, value, color, emoji }) {
  const cls = {
    gray:    "bg-gray-50 text-gray-700 border-gray-100",
    amber:   "bg-amber-50 text-amber-700 border-amber-100",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-100",
    red:     "bg-red-50 text-red-700 border-red-100",
    slate:   "bg-slate-50 text-slate-700 border-slate-100",
  }[color] || "bg-gray-50 text-gray-700 border-gray-100";
  return (
    <div className={`rounded-xl p-2.5 border ${cls}`}>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide opacity-80">
        {emoji && <span>{emoji}</span>}
        {label}
      </div>
      <div className="text-2xl font-bold mt-0.5">{value}</div>
    </div>
  );
}

// ────────── Día bloque ──────────
function DiaBloque({
  fecha, esHoy, etiquetaSinFecha, pendientes,
  nombrePorUserId, canEdit,
  onCambiarEstatus, onEditar, onBorrar, onAgregar,
}) {
  const diaNombre = etiquetaSinFecha
    ? "Sin fecha"
    : DIAS_SEMANA[(fecha.getDay() + 6) % 7];
  const fechaStr = etiquetaSinFecha ? "" : `${fecha.getDate()} ${MESES_LARGO[fecha.getMonth()].slice(0, 3).toLowerCase()}`;

  // Progreso del día
  const total = pendientes.length;
  const listo = pendientes.filter((p) => p.estatus === "listo").length;
  const urgente = pendientes.filter((p) => p.estatus === "urgente").length;
  const enProceso = pendientes.filter((p) => p.estatus === "en_proceso").length;
  const pendiente = pendientes.filter((p) => p.estatus === "pendiente").length;
  const enPausa = pendientes.filter((p) => p.estatus === "en_pausa").length;
  const pct = total > 0 ? Math.round((listo / total) * 100) : 0;

  const headerCls = esHoy
    ? "bg-gradient-to-r from-blue-50 to-blue-100/50 border-blue-200"
    : "bg-gray-50/50 border-gray-100";

  return (
    <div className={`bg-white rounded-xl border overflow-hidden ${esHoy ? "border-blue-200 shadow-sm" : "border-gray-100"}`}>
      {/* Header del día */}
      <div className={`px-4 py-3 border-b ${headerCls} flex items-center justify-between gap-3`}>
        <div className="flex items-center gap-3 min-w-0">
          {!etiquetaSinFecha && (
            <div className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 ${
              esHoy ? "bg-blue-600 text-white" : "bg-white border border-gray-200 text-gray-700"
            }`}>
              <span className="text-[10px] uppercase tracking-wider opacity-80 leading-none">
                {MESES_LARGO[fecha.getMonth()].slice(0, 3)}
              </span>
              <span className="text-base font-bold leading-tight">{fecha.getDate()}</span>
            </div>
          )}
          <div className="min-w-0">
            <div className={`text-sm font-bold uppercase tracking-wide ${esHoy ? "text-blue-700" : "text-gray-800"}`}>
              {diaNombre}
              {esHoy && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full normal-case font-semibold">HOY</span>}
            </div>
            {!etiquetaSinFecha && total > 0 && (
              <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                <span>{listo}/{total} completadas · {pct}%</span>
                {urgente > 0   && <span className="text-red-600 font-medium">🔴 {urgente} urgente{urgente > 1 ? "s" : ""}</span>}
                {enProceso > 0 && <span className="text-amber-600 font-medium">🟡 {enProceso} en proceso</span>}
                {pendiente > 0 && <span className="text-gray-500 font-medium">⚪ {pendiente} pendiente{pendiente > 1 ? "s" : ""}</span>}
                {enPausa > 0   && <span className="text-slate-500 font-medium">⏸️ {enPausa} en pausa</span>}
              </div>
            )}
          </div>
        </div>
        {canEdit && !etiquetaSinFecha && (
          <button
            onClick={onAgregar}
            className="text-xs text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {/* Progress bar */}
      {!etiquetaSinFecha && total > 0 && (
        <div className="h-1 bg-gray-100 flex">
          <div className="bg-red-500"     style={{ width: `${(urgente   / total) * 100}%` }} />
          <div className="bg-amber-400"   style={{ width: `${(enProceso / total) * 100}%` }} />
          <div className="bg-gray-300"    style={{ width: `${(pendiente / total) * 100}%` }} />
          <div className="bg-slate-400"   style={{ width: `${(enPausa   / total) * 100}%` }} />
          <div className="bg-emerald-500" style={{ width: `${(listo     / total) * 100}%` }} />
        </div>
      )}

      {/* Lista de tareas */}
      {pendientes.length === 0 ? (
        <p className="text-xs text-gray-400 italic p-4 text-center">Sin tareas · usa "Agregar" para crear una</p>
      ) : (
        <div className="divide-y divide-gray-50">
          {pendientes.map((p) => (
            <PendienteRow
              key={p.id}
              p={p}
              nombrePorUserId={nombrePorUserId}
              canEdit={canEdit}
              onCambiarEstatus={onCambiarEstatus}
              onEditar={onEditar}
              onBorrar={onBorrar}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PendienteRow({ p, nombrePorUserId, canEdit, onCambiarEstatus, onEditar, onBorrar }) {
  const cuenta = CUENTAS.find((c) => c.id === p.cuenta) || CUENTAS[3];
  const estatus = ESTATUS.find((s) => s.id === p.estatus) || ESTATUS[0];
  const Icon = estatus.icon;

  // Tono sutil de fondo cuando urgente
  const rowBg = p.estatus === "urgente" ? "bg-red-50/40 hover:bg-red-50/70"
             : p.estatus === "listo"    ? "hover:bg-gray-50 opacity-80"
             : "hover:bg-gray-50";

  return (
    <div className={`relative flex items-center gap-3 pl-4 pr-3 py-2.5 group ${rowBg}`}>
      {/* Stripe de cuenta (barra de color a la izquierda) */}
      <div
        className="absolute left-0 top-1 bottom-1 w-1 rounded-r-md"
        style={{ backgroundColor: cuenta.stripe }}
        title={cuenta.label}
      />

      {/* Estatus toggle — pill con icono y texto */}
      <button
        onClick={() => {
          if (!canEdit) return;
          // ciclo: pendiente → en_proceso → urgente → en_pausa → listo → pendiente
          const idx = ESTATUS.findIndex((s) => s.id === p.estatus);
          const next = ESTATUS[(idx + 1) % ESTATUS.length].id;
          onCambiarEstatus(p.id, next);
        }}
        disabled={!canEdit}
        className={`shrink-0 inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-[11px] font-semibold ${estatus.cls} ${canEdit ? "hover:ring-2 hover:ring-offset-1 hover:ring-current/20 cursor-pointer" : ""}`}
        title={canEdit ? `Cambiar estatus (actual: ${estatus.label})` : estatus.label}
      >
        <Icon className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">{estatus.label}</span>
      </button>

      {/* Cuenta */}
      <span className={`shrink-0 text-[10px] font-semibold px-2 py-0.5 rounded border ${cuenta.color}`}>
        {cuenta.label}
      </span>

      {/* Tarea + meta */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${p.estatus === "listo" ? "line-through text-gray-400" : "text-gray-800"}`}>
          {p.tarea}
        </div>
        {(p.categoria || p.responsable || p.notas) && (
          <div className="text-xs text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
            {p.categoria && (
              <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                🏷️ {p.categoria}
              </span>
            )}
            {p.responsable && (
              <span className="inline-flex items-center gap-1">
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: paletaPorUsuario(p.responsable).dot }} />
                {nombrePorUserId[p.responsable] || "—"}
              </span>
            )}
            {p.notas && <span className="italic text-gray-400 truncate max-w-xs">📝 {p.notas}</span>}
          </div>
        )}
      </div>

      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => onEditar(p)} className="p-1.5 rounded hover:bg-gray-200 text-gray-500" title="Editar"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onBorrar(p.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      )}
    </div>
  );
}

// ────────── Modal Tarea ──────────
function ModalTarea({ data, perfiles, onClose, onGuardado }) {
  const perfil = usePerfil();
  const esNueva = !data.tarea;
  const [form, setForm] = useState(() => ({
    cuenta: data.tarea?.cuenta || "otro",
    tarea: data.tarea?.tarea || "",
    categoria: data.tarea?.categoria || "",
    fecha_limite: data.tarea?.fecha_limite?.slice(0, 10) || data.fechaDefault || "",
    estatus: data.tarea?.estatus || "pendiente",
    notas: data.tarea?.notas || "",
    responsable: data.tarea?.responsable || perfil?.user_id || "",
  }));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!form.tarea.trim()) return alert("Escribe la tarea");
    setGuardando(true);
    const payload = {
      cuenta: form.cuenta,
      tarea: form.tarea.trim(),
      categoria: form.categoria.trim() || null,
      fecha_limite: form.fecha_limite || null,
      estatus: form.estatus,
      notas: form.notas.trim() || null,
      responsable: form.responsable || null,
    };
    let err;
    if (esNueva) {
      payload.creado_por = perfil?.user_id || null;
      ({ error: err } = await supabase.from("pendientes_equipo").insert(payload));
    } else {
      ({ error: err } = await supabase.from("pendientes_equipo").update(payload).eq("id", data.tarea.id));
    }
    setGuardando(false);
    if (err) return alert("Error: " + err.message);
    onGuardado();
  }

  return (
    <ModalShell title={esNueva ? "Nueva tarea" : "Editar tarea"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Cuenta">
          <select
            value={form.cuenta}
            onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
          >
            {CUENTAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
        </Field>

        <Field label="Tarea / Pendiente">
          <input
            value={form.tarea}
            onChange={(e) => setForm({ ...form, tarea: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Ej. Revisar reputación ML"
            autoFocus
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría (libre)">
            <input
              value={form.categoria}
              list="categorias-sugeridas"
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Opcional"
            />
            <datalist id="categorias-sugeridas">
              {CATEGORIAS_SUGERIDAS.map((c) => <option key={c} value={c} />)}
            </datalist>
          </Field>
          <Field label="Fecha límite">
            <input
              type="date"
              value={form.fecha_limite}
              onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable">
            <select
              value={form.responsable}
              onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            >
              <option value="">Sin asignar</option>
              {perfiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
              ))}
            </select>
          </Field>
          <Field label="Estatus">
            <select
              value={form.estatus}
              onChange={(e) => setForm({ ...form, estatus: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            >
              {ESTATUS.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </Field>
        </div>

        <Field label="Notas">
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            rows={3}
            placeholder="Opcional"
          />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5">
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
        >Cancelar</button>
        <button
          onClick={guardar}
          disabled={guardando}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
        >{guardando ? "Guardando…" : "Guardar"}</button>
      </div>
    </ModalShell>
  );
}

// ────────── Modal Evento ──────────
function ModalEvento({ data, perfiles, onClose, onGuardado, onBorrar }) {
  const perfil = usePerfil();
  const esNuevo = !data.evento;
  const [form, setForm] = useState(() => ({
    titulo: data.evento?.titulo || "",
    tipo: data.evento?.tipo || "reunion",
    fecha_ini: data.evento?.fecha_ini?.slice(0, 10) || data.fechaDefault || toISO(new Date()),
    fecha_fin: data.evento?.fecha_fin?.slice(0, 10) || data.fechaDefault || toISO(new Date()),
    responsable: data.evento?.responsable || perfil?.user_id || "",
    notas: data.evento?.notas || "",
  }));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!form.titulo.trim()) return alert("Pon un título al evento");
    if (form.fecha_fin < form.fecha_ini) return alert("La fecha final debe ser ≥ a la inicial");
    setGuardando(true);
    const payload = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      fecha_ini: form.fecha_ini,
      fecha_fin: form.fecha_fin,
      responsable: form.responsable || null,
      notas: form.notas.trim() || null,
    };
    let err;
    if (esNuevo) {
      payload.creado_por = perfil?.user_id || null;
      ({ error: err } = await supabase.from("eventos_equipo").insert(payload));
    } else {
      ({ error: err } = await supabase.from("eventos_equipo").update(payload).eq("id", data.evento.id));
    }
    setGuardando(false);
    if (err) return alert("Error: " + err.message);
    onGuardado();
  }

  return (
    <ModalShell title={esNuevo ? "Nuevo evento" : "Editar evento"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Título">
          <input
            value={form.titulo}
            onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Ej. Vacaciones Karolina"
            autoFocus
          />
        </Field>

        <Field label="Tipo">
          <div className="grid grid-cols-3 gap-2">
            {TIPOS_EVENTO.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setForm({ ...form, tipo: t.id })}
                className={[
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition",
                  form.tipo === t.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.label}
              </button>
            ))}
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <input
              type="date"
              value={form.fecha_ini}
              onChange={(e) => setForm({ ...form, fecha_ini: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </Field>
          <Field label="Hasta">
            <input
              type="date"
              value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
          </Field>
        </div>

        <Field label="Responsable">
          <select
            value={form.responsable}
            onChange={(e) => setForm({ ...form, responsable: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
          >
            <option value="">Sin asignar</option>
            {perfiles.map((p) => (
              <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
            ))}
          </select>
        </Field>

        <Field label="Notas">
          <textarea
            value={form.notas}
            onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            rows={2}
            placeholder="Opcional"
          />
        </Field>
      </div>

      <div className="flex items-center justify-between mt-5">
        <div>
          {!esNuevo && (
            <button
              onClick={() => { onBorrar(data.evento.id); onClose(); }}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1"
            >
              <Trash2 className="w-3.5 h-3.5" /> Eliminar evento
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100"
          >Cancelar</button>
          <button
            onClick={guardar}
            disabled={guardando}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50"
          >{guardando ? "Guardando…" : "Guardar"}</button>
        </div>
      </div>
    </ModalShell>
  );
}

// ────────── Shell modal reutilizable ──────────
function ModalShell({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  );
}
