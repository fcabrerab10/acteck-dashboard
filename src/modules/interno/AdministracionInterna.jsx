import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { puedeEditar } from "../../lib/permisos";
import {
  Plus, Trash2, CheckCircle2, Clock, Circle, ChevronLeft, ChevronRight,
  CalendarDays, X, Edit3, Filter,
} from "lucide-react";

/**
 * Administración Interna
 * ─────────────────────────
 * Calendario (arriba) + Pendientes (abajo)
 * Solo super_admin y asistente (RLS + guardas de UI)
 */

// ────────── Constantes de dominio ──────────
const CUENTAS = [
  { id: "mercadolibre", label: "Mercado Libre", color: "bg-yellow-100 text-yellow-800 border-yellow-200" },
  { id: "digitalife",   label: "Digitalife",    color: "bg-blue-100 text-blue-800 border-blue-200" },
  { id: "pcel",         label: "PCEL",          color: "bg-red-100 text-red-800 border-red-200" },
  { id: "otro",         label: "Otro",          color: "bg-purple-100 text-purple-800 border-purple-200" },
];

const ESTATUS = [
  { id: "pendiente",  label: "Pendiente",  icon: Circle,        cls: "text-gray-500 bg-gray-100" },
  { id: "en_proceso", label: "En proceso", icon: Clock,         cls: "text-amber-700 bg-amber-100" },
  { id: "listo",      label: "Listo",      icon: CheckCircle2,  cls: "text-emerald-700 bg-emerald-100" },
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
  "Reputación ML", "Publicaciones", "Mensajes postventa",
  "Materiales de marketing", "Campañas", "Ayuda a Hans",
  "Forecast", "Cobranza", "Estrategia", "Reunión", "Administrativo",
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
      pendiente: all.filter((p) => p.estatus === "pendiente").length,
      en_proceso: all.filter((p) => p.estatus === "en_proceso").length,
      listo: all.filter((p) => p.estatus === "listo").length,
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

      {/* STATS SEMANA */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard label="Esta semana" value={statsSemana.total}      color="gray" />
        <StatCard label="Pendiente"   value={statsSemana.pendiente}  color="gray" />
        <StatCard label="En proceso"  value={statsSemana.en_proceso} color="amber" />
        <StatCard label="Listo"       value={statsSemana.listo}      color="emerald" />
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

      {/* PENDIENTES SEMANA */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">
            Pendientes · Semana del {semanaVisible.getDate()} de {MESES_LARGO[semanaVisible.getMonth()]}
          </h2>
        </div>

        <div className="divide-y divide-gray-100">
          {Array.from({ length: 7 }, (_, i) => {
            const d = new Date(semanaVisible); d.setDate(d.getDate() + i);
            const key = toISO(d);
            const items = pendientesPorDia[key] || [];
            const esHoy = mismaFecha(d, new Date());
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
function StatCard({ label, value, color }) {
  const cls = {
    gray:    "bg-gray-50 text-gray-700",
    amber:   "bg-amber-50 text-amber-700",
    emerald: "bg-emerald-50 text-emerald-700",
  }[color] || "bg-gray-50 text-gray-700";
  return (
    <div className={`rounded-xl p-3 border border-gray-100 ${cls}`}>
      <div className="text-xs uppercase tracking-wide opacity-70">{label}</div>
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
  const label = etiquetaSinFecha
    ? "Sin fecha"
    : `${DIAS_SEMANA[(fecha.getDay() + 6) % 7].toUpperCase()} ${fecha.getDate()}/${String(fecha.getMonth() + 1).padStart(2, "0")}`;

  return (
    <div className="px-4 py-3">
      <div className="flex items-center justify-between mb-2">
        <div className={`text-sm font-semibold ${esHoy ? "text-blue-600" : "text-gray-700"}`}>
          {label} {esHoy && <span className="ml-1 text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Hoy</span>}
        </div>
        {canEdit && !etiquetaSinFecha && (
          <button
            onClick={onAgregar}
            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
          >
            <Plus className="w-3 h-3" /> Agregar
          </button>
        )}
      </div>

      {pendientes.length === 0 ? (
        <p className="text-xs text-gray-400 italic pl-1">Sin tareas</p>
      ) : (
        <div className="space-y-1.5">
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

  return (
    <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50 group">
      {/* Estatus toggle */}
      <button
        onClick={() => {
          if (!canEdit) return;
          // ciclo pendiente → en_proceso → listo → pendiente
          const idx = ESTATUS.findIndex((s) => s.id === p.estatus);
          const next = ESTATUS[(idx + 1) % ESTATUS.length].id;
          onCambiarEstatus(p.id, next);
        }}
        disabled={!canEdit}
        className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${estatus.cls} ${canEdit ? "hover:opacity-80 cursor-pointer" : ""}`}
        title={`Estatus: ${estatus.label}`}
      >
        <Icon className="w-4 h-4" />
      </button>

      {/* Cuenta */}
      <span className={`shrink-0 text-[11px] px-2 py-0.5 rounded border ${cuenta.color}`}>
        {cuenta.label}
      </span>

      {/* Tarea + categoría */}
      <div className="flex-1 min-w-0">
        <div className={`text-sm truncate ${p.estatus === "listo" ? "line-through text-gray-400" : "text-gray-800"}`}>
          {p.tarea}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2 truncate">
          {p.categoria && <span>{p.categoria}</span>}
          {p.responsable && (
            <span className="flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: paletaPorUsuario(p.responsable).dot }} />
              {nombrePorUserId[p.responsable] || "—"}
            </span>
          )}
          {p.notas && <span className="italic truncate">· {p.notas}</span>}
        </div>
      </div>

      {canEdit && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onEditar(p)} className="p-1.5 rounded hover:bg-gray-200 text-gray-500"><Edit3 className="w-3.5 h-3.5" /></button>
          <button onClick={() => onBorrar(p.id)} className="p-1.5 rounded hover:bg-red-100 text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
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
