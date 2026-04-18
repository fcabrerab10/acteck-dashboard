import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { puedeEditar } from "../../lib/permisos";
import { toast } from "../../lib/toast";
import {
  Plus, Trash2, Check, Clock, Flame, PauseCircle, ChevronLeft, ChevronRight,
  CalendarDays, X, Edit3, ChevronDown, ChevronUp,
} from "lucide-react";

/**
 * Administración Interna — v2
 * ─────────────────────────────
 * Grid horizontal: una columna por día (L-V). Checkbox para completar.
 * Completadas en sección colapsable. Tabs Míos / Karolina / Todos.
 * Solo super_admin + asistente (RLS + guardas UI).
 */

// ────────── Constantes ──────────
const CUENTAS = [
  { id: "mercadolibre", label: "ML",         full: "Mercado Libre", stripe: "#F59E0B", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  { id: "digitalife",   label: "DGL",        full: "Digitalife",    stripe: "#3B82F6", bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-200" },
  { id: "pcel",         label: "PCEL",       full: "PCEL",          stripe: "#EF4444", bg: "bg-red-100",    text: "text-red-800",    border: "border-red-200" },
  { id: "otro",         label: "Otro",       full: "Otro",          stripe: "#A855F7", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
];

const ESTATUS_MAP = {
  pendiente:  { label: "Pendiente",  icon: null,        bg: "",                 dot: "#9CA3AF" },
  en_proceso: { label: "En proceso", icon: Clock,       bg: "bg-amber-50",      dot: "#F59E0B" },
  urgente:    { label: "Urgente",    icon: Flame,       bg: "bg-red-50/60",     dot: "#DC2626" },
  en_pausa:   { label: "En pausa",   icon: PauseCircle, bg: "bg-slate-50",      dot: "#64748B" },
  listo:      { label: "Listo",      icon: Check,       bg: "",                 dot: "#10B981" },
};

const TIPOS_EVENTO = [
  { id: "salida_trabajo", label: "Salida por trabajo", color: "#3b82f6" },
  { id: "vacaciones",     label: "Vacaciones",          color: "#10b981" },
  { id: "permiso",        label: "Permiso / personal",  color: "#f59e0b" },
  { id: "home_office",    label: "Home office",         color: "#8b5cf6" },
  { id: "feriado",        label: "Feriado",             color: "#ef4444" },
  { id: "reunion",        label: "Reunión interna",     color: "#14b8a6" },
];

const DIAS_SEMANA_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const DIAS_SEMANA_CORTO = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];
const MESES_LARGO = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTO = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];

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
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
};
const mismaFecha = (a, b) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

// ────────── usePersistedState ──────────
function usePersistedState(key, defaultValue, serialize = JSON.stringify, deserialize = JSON.parse) {
  const [state, setState] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return defaultValue;
      return deserialize(raw);
    } catch { return defaultValue; }
  });
  useEffect(() => {
    try { localStorage.setItem(key, serialize(state)); } catch {}
  }, [key, state, serialize]);
  return [state, setState];
}

// ────────── Componente principal ──────────
export default function AdministracionInterna() {
  const perfil = usePerfil();
  const canEdit = puedeEditar(perfil);
  const yoId = perfil?.user_id;

  const [perfiles, setPerfiles] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  // Estado persistente (se mantiene entre recargas)
  const [tabResp, setTabResp] = usePersistedState(
    "interna_tab_resp", "mios",
    String, (s) => s
  );
  const [semanaISO, setSemanaISO] = usePersistedState(
    "interna_semana",
    toISO(lunesDeSemana(new Date())),
    String, (s) => s
  );
  const semanaVisible = useMemo(() => parseISO(semanaISO) || lunesDeSemana(new Date()), [semanaISO]);
  const [mostrarFinde, setMostrarFinde] = usePersistedState("interna_finde", false);
  const [completadasOpen, setCompletadasOpen] = usePersistedState("interna_completadas_open", {});
  const [filtroCuenta, setFiltroCuenta] = usePersistedState(
    "interna_filtro_cuenta", "todas",
    String, (s) => s
  );
  const [mesVisibleISO, setMesVisibleISO] = usePersistedState(
    "interna_mes",
    toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    String, (s) => s
  );
  const mesVisible = useMemo(() => parseISO(mesVisibleISO) || new Date(), [mesVisibleISO]);
  const [calExpanded, setCalExpanded] = usePersistedState("interna_cal_open", true);

  // Modales
  const [modalTarea, setModalTarea] = useState(null);
  const [modalEvento, setModalEvento] = useState(null);

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

  const karolinaId = useMemo(() => {
    const p = perfiles.find((x) => (x.nombre || "").toLowerCase().includes("karolina") ||
                                    (x.email  || "").toLowerCase().includes("karolina"));
    return p?.user_id || null;
  }, [perfiles]);

  // Filtrado por tab y cuenta
  const pendientesFiltrados = useMemo(() => {
    return pendientes.filter((p) => {
      if (filtroCuenta !== "todas" && p.cuenta !== filtroCuenta) return false;
      if (tabResp === "mios"     && p.responsable !== yoId) return false;
      if (tabResp === "karolina" && p.responsable !== karolinaId) return false;
      return true;
    });
  }, [pendientes, filtroCuenta, tabResp, yoId, karolinaId]);

  // Días visibles (5 o 7)
  const diasVisibles = useMemo(() => {
    const n = mostrarFinde ? 7 : 5;
    return Array.from({ length: n }, (_, i) => {
      const d = new Date(semanaVisible); d.setDate(d.getDate() + i); return d;
    });
  }, [semanaVisible, mostrarFinde]);

  const pendientesPorDia = useMemo(() => {
    const res = {};
    diasVisibles.forEach((d) => { res[toISO(d)] = []; });
    res["sin_fecha"] = [];
    pendientesFiltrados.forEach((p) => {
      if (!p.fecha_limite) { res["sin_fecha"].push(p); return; }
      const k = p.fecha_limite.slice(0, 10);
      if (res[k] !== undefined) res[k].push(p);
    });
    return res;
  }, [pendientesFiltrados, diasVisibles]);

  // Stats semana
  const statsSemana = useMemo(() => {
    const all = diasVisibles.flatMap((d) => pendientesPorDia[toISO(d)] || []);
    return {
      total: all.length,
      listo: all.filter((p) => p.estatus === "listo").length,
      urgente: all.filter((p) => p.estatus === "urgente").length,
      en_proceso: all.filter((p) => p.estatus === "en_proceso").length,
    };
  }, [diasVisibles, pendientesPorDia]);

  // Acciones
  async function toggleCheck(id, estatusActual) {
    if (!canEdit) return;
    const nuevo = estatusActual === "listo" ? "pendiente" : "listo";
    setPendientes((prev) => prev.map((p) => (p.id === id ? { ...p, estatus: nuevo } : p)));
    const { error } = await supabase.from("pendientes_equipo").update({ estatus: nuevo }).eq("id", id);
    if (error) {
      console.error(error);
      toast.error("No se pudo actualizar la tarea");
      cargarTodo();
    } else {
      if (nuevo === "listo") toast.success("Tarea marcada como completada");
    }
  }

  async function cambiarEstatus(id, nuevo) {
    if (!canEdit) return;
    setPendientes((prev) => prev.map((p) => (p.id === id ? { ...p, estatus: nuevo } : p)));
    const { error } = await supabase.from("pendientes_equipo").update({ estatus: nuevo }).eq("id", id);
    if (error) {
      console.error(error);
      toast.error("No se pudo cambiar el estatus");
      cargarTodo();
    }
  }

  async function borrarPendiente(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    setPendientes((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("pendientes_equipo").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("No se pudo eliminar la tarea");
      cargarTodo();
    } else {
      toast.success("Tarea eliminada");
    }
  }

  async function borrarEvento(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar este evento?")) return;
    setEventos((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("eventos_equipo").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast.error("No se pudo eliminar el evento");
      cargarTodo();
    } else {
      toast.success("Evento eliminado");
    }
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando administración interna…</div>;

  const tabs = [
    { id: "mios",     label: "Ferru", count: pendientes.filter((p) => p.responsable === yoId && p.estatus !== "listo").length },
    { id: "karolina", label: "Karo",  count: pendientes.filter((p) => p.responsable === karolinaId && p.estatus !== "listo").length, disabled: !karolinaId },
    { id: "todos",    label: "Todos", count: pendientes.filter((p) => p.estatus !== "listo").length },
  ];

  return (
    <div className="space-y-5">
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
                onClick={() => setModalTarea({ fechaDefault: toISO(new Date()) })}
                className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" /> Nueva tarea
              </button>
            </>
          )}
        </div>
      </div>

      {/* CALENDARIO (colapsable) */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setCalExpanded(!calExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <span className="font-semibold text-gray-800">
            📅 Calendario · {MESES_LARGO[mesVisible.getMonth()]} {mesVisible.getFullYear()}
          </span>
          {calExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {calExpanded && (
          <Calendario
            mesVisible={mesVisible}
            setMesVisibleISO={setMesVisibleISO}
            eventos={eventos}
            nombrePorUserId={nombrePorUserId}
            yoId={yoId}
            karolinaId={karolinaId}
            canEdit={canEdit}
            onClickEvento={(ev) => setModalEvento({ evento: ev })}
            onClickDia={(fecha) => canEdit && setModalEvento({ fechaDefault: fecha })}
          />
        )}
      </div>

      {/* TABS + FILTROS + NAVEGADOR */}
      <div className="bg-white rounded-xl border border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs por responsable */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => !t.disabled && setTabResp(t.id)}
                disabled={t.disabled}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition",
                  tabResp === t.id
                    ? "bg-white text-blue-700 shadow-sm"
                    : "text-gray-600 hover:text-gray-900",
                  t.disabled ? "opacity-40 cursor-not-allowed" : "",
                ].join(" ")}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                    {t.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          {/* Filtro cuenta */}
          <select
            value={filtroCuenta}
            onChange={(e) => setFiltroCuenta(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="todas">Todas las cuentas</option>
            {CUENTAS.map((c) => <option key={c.id} value={c.id}>{c.full}</option>)}
          </select>

          {/* Toggle finde */}
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarFinde}
              onChange={(e) => setMostrarFinde(e.target.checked)}
              className="rounded border-gray-300"
            />
            Mostrar fin de semana
          </label>

          <div className="flex-1" />

          {/* Stats rápidas */}
          <div className="text-xs text-gray-500 hidden md:flex items-center gap-2">
            <span>
              <span className="font-semibold text-emerald-600">{statsSemana.listo}</span>/{statsSemana.total}
              {statsSemana.total > 0 && (
                <span className="ml-1">
                  · {Math.round((statsSemana.listo / statsSemana.total) * 100)}%
                </span>
              )}
            </span>
            {statsSemana.urgente > 0 && (
              <span className="text-red-600 font-semibold">🔴 {statsSemana.urgente}</span>
            )}
            {statsSemana.en_proceso > 0 && (
              <span className="text-amber-600 font-semibold">🟡 {statsSemana.en_proceso}</span>
            )}
          </div>

          {/* Navegador de semana */}
          <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg border border-gray-200">
            <button
              onClick={() => {
                const d = new Date(semanaVisible); d.setDate(d.getDate() - 7); setSemanaISO(toISO(d));
              }}
              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-l-lg"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setSemanaISO(toISO(lunesDeSemana(new Date())))}
              className="text-xs px-2 py-1 hover:bg-gray-100 text-gray-700 font-medium"
              title="Ir a la semana actual"
            >
              Esta semana
            </button>
            <button
              onClick={() => {
                const d = new Date(semanaVisible); d.setDate(d.getDate() + 7); setSemanaISO(toISO(d));
              }}
              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-r-lg"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Título semana */}
        <div className="text-xs text-gray-400 mt-2 text-center">
          Semana del {semanaVisible.getDate()} de {MESES_LARGO[semanaVisible.getMonth()]} —{" "}
          {(() => {
            const fin = new Date(semanaVisible); fin.setDate(fin.getDate() + (mostrarFinde ? 6 : 4));
            return `${fin.getDate()} de ${MESES_LARGO[fin.getMonth()]}`;
          })()}
        </div>
      </div>

      {/* GRID HORIZONTAL DE DÍAS */}
      <div
        className="grid gap-3"
        style={{ gridTemplateColumns: `repeat(${diasVisibles.length}, minmax(0, 1fr))` }}
      >
        {diasVisibles.map((d) => {
          const key = toISO(d);
          const tareas = pendientesPorDia[key] || [];
          const esHoy = mismaFecha(d, new Date());
          return (
            <ColumnaDia
              key={key}
              fecha={d}
              esHoy={esHoy}
              tareas={tareas}
              canEdit={canEdit}
              nombrePorUserId={nombrePorUserId}
              completadasOpen={completadasOpen[key] || false}
              toggleCompletadasOpen={() =>
                setCompletadasOpen({ ...completadasOpen, [key]: !completadasOpen[key] })
              }
              onToggleCheck={toggleCheck}
              onCambiarEstatus={cambiarEstatus}
              onEditar={(t) => setModalTarea({ tarea: t })}
              onBorrar={borrarPendiente}
              onAgregar={() => canEdit && setModalTarea({ fechaDefault: key })}
            />
          );
        })}
      </div>

      {/* SIN FECHA */}
      {(pendientesPorDia["sin_fecha"]?.length || 0) > 0 && (
        <SinFechaBloque
          tareas={pendientesPorDia["sin_fecha"]}
          canEdit={canEdit}
          nombrePorUserId={nombrePorUserId}
          onToggleCheck={toggleCheck}
          onEditar={(t) => setModalTarea({ tarea: t })}
          onBorrar={borrarPendiente}
        />
      )}

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

// ────────── Columna de día ──────────
function ColumnaDia({
  fecha, esHoy, tareas, canEdit, nombrePorUserId,
  completadasOpen, toggleCompletadasOpen,
  onToggleCheck, onCambiarEstatus, onEditar, onBorrar, onAgregar,
}) {
  const abiertas    = tareas.filter((t) => t.estatus !== "listo");
  const completadas = tareas.filter((t) => t.estatus === "listo");
  const total = tareas.length;
  const pct = total > 0 ? Math.round((completadas.length / total) * 100) : 0;

  return (
    <div className={[
      "bg-white rounded-xl border flex flex-col overflow-hidden",
      esHoy ? "border-blue-300 shadow-sm ring-2 ring-blue-100" : "border-gray-200",
    ].join(" ")}>
      {/* Header */}
      <div className={[
        "px-3 py-2.5 border-b text-center",
        esHoy ? "bg-gradient-to-b from-blue-50 to-white border-blue-200" : "bg-gray-50/50 border-gray-100",
      ].join(" ")}>
        <div className={[
          "text-[10px] uppercase tracking-widest font-bold",
          esHoy ? "text-blue-600" : "text-gray-500",
        ].join(" ")}>
          {DIAS_SEMANA_CORTO[(fecha.getDay() + 6) % 7]}
          {esHoy && <span className="ml-1 text-[9px] bg-blue-600 text-white px-1 py-0.5 rounded">HOY</span>}
        </div>
        <div className={[
          "text-xl font-bold mt-0.5",
          esHoy ? "text-blue-700" : "text-gray-800",
        ].join(" ")}>
          {fecha.getDate()} <span className="text-xs font-medium text-gray-500">{MESES_CORTO[fecha.getMonth()]}</span>
        </div>
        {total > 0 && (
          <div className="text-[10px] text-gray-500 mt-1">
            {completadas.length}/{total} · {pct}%
          </div>
        )}
      </div>

      {/* Progress bar delgada */}
      {total > 0 && (
        <div className="h-0.5 bg-gray-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {/* Tareas abiertas */}
      <div className="flex-1 p-2 space-y-1.5 min-h-[160px]">
        {abiertas.length === 0 && completadas.length === 0 ? (
          <p className="text-[11px] text-gray-400 italic text-center mt-4">Sin tareas</p>
        ) : abiertas.length === 0 ? (
          <p className="text-[11px] text-emerald-600 italic text-center mt-4">✓ Todo listo</p>
        ) : (
          abiertas.map((t) => (
            <TareaCard
              key={t.id}
              t={t}
              canEdit={canEdit}
              nombrePorUserId={nombrePorUserId}
              onToggleCheck={onToggleCheck}
              onCambiarEstatus={onCambiarEstatus}
              onEditar={onEditar}
              onBorrar={onBorrar}
            />
          ))
        )}
      </div>

      {/* + Agregar */}
      {canEdit && (
        <button
          onClick={onAgregar}
          className="mx-2 mb-2 py-1.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-dashed border-gray-200 hover:border-blue-300 transition flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      )}

      {/* Completadas colapsable */}
      {completadas.length > 0 && (
        <div className="border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={toggleCompletadasOpen}
            className="w-full px-3 py-2 flex items-center justify-between text-xs text-gray-600 hover:bg-gray-100/60"
          >
            <span className="flex items-center gap-1.5">
              {completadasOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <Check className="w-3 h-3 text-emerald-600" />
              <span className="font-medium">{completadas.length} completada{completadas.length !== 1 ? "s" : ""}</span>
            </span>
          </button>
          {completadasOpen && (
            <div className="px-2 pb-2 space-y-1">
              {completadas.map((t) => (
                <TareaCard
                  key={t.id}
                  t={t}
                  canEdit={canEdit}
                  nombrePorUserId={nombrePorUserId}
                  onToggleCheck={onToggleCheck}
                  onCambiarEstatus={onCambiarEstatus}
                  onEditar={onEditar}
                  onBorrar={onBorrar}
                  compacta
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────── Sin fecha ──────────
function SinFechaBloque({ tareas, canEdit, nombrePorUserId, onToggleCheck, onEditar, onBorrar }) {
  const [open, setOpen] = usePersistedState("interna_sin_fecha_open", true);
  const abiertas = tareas.filter((t) => t.estatus !== "listo");
  const completadas = tareas.filter((t) => t.estatus === "listo");

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
      >
        <span className="font-semibold text-gray-800 text-sm flex items-center gap-2">
          📌 Sin fecha asignada
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
            {tareas.length}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {abiertas.map((t) => (
            <TareaCard
              key={t.id}
              t={t}
              canEdit={canEdit}
              nombrePorUserId={nombrePorUserId}
              onToggleCheck={onToggleCheck}
              onEditar={onEditar}
              onBorrar={onBorrar}
            />
          ))}
          {completadas.map((t) => (
            <TareaCard
              key={t.id}
              t={t}
              canEdit={canEdit}
              nombrePorUserId={nombrePorUserId}
              onToggleCheck={onToggleCheck}
              onEditar={onEditar}
              onBorrar={onBorrar}
              compacta
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────── Tarjeta de tarea ──────────
function TareaCard({ t, canEdit, nombrePorUserId, onToggleCheck, onCambiarEstatus, onEditar, onBorrar, compacta }) {
  const cuenta = CUENTAS.find((c) => c.id === t.cuenta) || CUENTAS[3];
  const est = ESTATUS_MAP[t.estatus] || ESTATUS_MAP.pendiente;
  const EstIcon = est.icon;
  const esListo = t.estatus === "listo";
  const [menu, setMenu] = useState(false);

  return (
    <div
      className={[
        "relative group rounded-md border border-gray-100 hover:border-gray-200 transition",
        compacta ? "p-1.5" : "p-2",
        est.bg,
      ].join(" ")}
      style={{ borderLeft: `3px solid ${cuenta.stripe}` }}
    >
      <div className="flex items-start gap-2">
        {/* Checkbox */}
        <button
          onClick={(e) => { e.stopPropagation(); onToggleCheck(t.id, t.estatus); }}
          disabled={!canEdit}
          className={[
            "shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition",
            esListo
              ? "bg-emerald-500 border-emerald-500 text-white"
              : "border-gray-300 bg-white hover:border-emerald-500",
            canEdit ? "cursor-pointer" : "cursor-default",
          ].join(" ")}
          title={esListo ? "Marcar como pendiente" : "Marcar como completada"}
        >
          {esListo && <Check className="w-3 h-3" strokeWidth={3} />}
        </button>

        {/* Contenido */}
        <div className="flex-1 min-w-0">
          <div className={[
            "text-[13px] leading-snug break-words",
            esListo ? "line-through text-gray-400" : "text-gray-800",
          ].join(" ")}>
            {t.tarea}
          </div>

          {!compacta && (t.categoria || t.notas || !esListo) && (
            <div className="flex items-center gap-1 flex-wrap mt-1 text-[10px]">
              {/* Cuenta */}
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold ${cuenta.bg} ${cuenta.text}`}>
                {cuenta.label}
              </span>

              {/* Estatus (solo si no es pendiente ni listo) */}
              {!esListo && t.estatus !== "pendiente" && EstIcon && (
                <span
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold"
                  style={{ backgroundColor: `${est.dot}22`, color: est.dot }}
                  title={est.label}
                >
                  <EstIcon className="w-2.5 h-2.5" />
                  {est.label}
                </span>
              )}

              {/* Categoría */}
              {t.categoria && (
                <span className="text-gray-500 truncate max-w-[120px]" title={t.categoria}>
                  🏷️ {t.categoria}
                </span>
              )}

              {/* Notas */}
              {t.notas && (
                <span className="text-gray-400 italic truncate max-w-[140px]" title={t.notas}>
                  📝 {t.notas}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Acciones (hover) */}
        {canEdit && (
          <div className="relative shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}
              className="p-1 rounded hover:bg-white text-gray-400"
              title="Más"
            >
              <Edit3 className="w-3 h-3" />
            </button>
            {menu && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setMenu(false)} />
                <div className="absolute right-0 top-6 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-44 text-xs">
                  <button
                    onClick={() => { onEditar(t); setMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-gray-100 flex items-center gap-2"
                  >
                    <Edit3 className="w-3 h-3" /> Editar
                  </button>
                  <div className="border-t border-gray-100 my-1" />
                  {Object.entries(ESTATUS_MAP).map(([id, cfg]) => (
                    t.estatus !== id && (
                      <button
                        key={id}
                        onClick={() => { onCambiarEstatus(t.id, id); setMenu(false); }}
                        className="w-full text-left px-3 py-1.5 hover:bg-gray-100 flex items-center gap-2"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: cfg.dot }} />
                        {cfg.label}
                      </button>
                    )
                  ))}
                  <div className="border-t border-gray-100 my-1" />
                  <button
                    onClick={() => { onBorrar(t.id); setMenu(false); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-red-50 text-red-600 flex items-center gap-2"
                  >
                    <Trash2 className="w-3 h-3" /> Eliminar
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ────────── Calendario ──────────
// Color por persona: Ferru azul, Karo rosa, otros gris
const COLOR_FERRU = "#3B82F6";   // azul
const COLOR_KAROL = "#EC4899";   // rosa
const COLOR_OTROS = "#94A3B8";   // slate

function colorDePersona(userId, yoId, karolinaId) {
  if (userId && userId === yoId) return COLOR_FERRU;
  if (userId && userId === karolinaId) return COLOR_KAROL;
  return COLOR_OTROS;
}

function Calendario({ mesVisible, setMesVisibleISO, eventos, nombrePorUserId, yoId, karolinaId, canEdit, onClickEvento, onClickDia }) {
  const primerDia = new Date(mesVisible); primerDia.setDate(1);
  const startOffset = (primerDia.getDay() + 6) % 7;
  const inicio = new Date(primerDia); inicio.setDate(1 - startOffset);
  const celdas = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(inicio); d.setDate(inicio.getDate() + i);
    celdas.push(d);
  }

  const eventosPorFecha = useMemo(() => {
    const m = {};
    eventos.forEach((ev) => {
      const ini = parseISO(ev.fecha_ini), fin = parseISO(ev.fecha_fin);
      if (!ini || !fin) return;
      const cur = new Date(ini);
      while (cur <= fin) {
        const k = toISO(cur); if (!m[k]) m[k] = []; m[k].push(ev);
        cur.setDate(cur.getDate() + 1);
      }
    });
    return m;
  }, [eventos]);

  const hoy = new Date();

  return (
    <div>
      {/* Controles */}
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        {/* Leyenda por persona */}
        <div className="flex flex-wrap gap-3 text-xs items-center">
          <span className="flex items-center gap-1.5 text-gray-700">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_FERRU }} />
            <span className="font-medium">Ferru</span>
          </span>
          <span className="flex items-center gap-1.5 text-gray-700">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_KAROL }} />
            <span className="font-medium">Karo</span>
          </span>
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: COLOR_OTROS }} />
            Sin asignar
          </span>
          <span className="text-gray-300 mx-1">|</span>
          <span className="text-[11px] text-gray-500">
            Tipos: {TIPOS_EVENTO.map((t) => t.label).join(" · ")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const d = new Date(mesVisible); d.setMonth(d.getMonth() - 1); setMesVisibleISO(toISO(new Date(d.getFullYear(), d.getMonth(), 1)));
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            title="Mes anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { const d = new Date(); setMesVisibleISO(toISO(new Date(d.getFullYear(), d.getMonth(), 1))); }}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
            title="Ir al mes actual"
          >
            Este mes
          </button>
          <button
            onClick={() => {
              const d = new Date(mesVisible); d.setMonth(d.getMonth() + 1); setMesVisibleISO(toISO(new Date(d.getFullYear(), d.getMonth(), 1)));
            }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
            title="Mes siguiente"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-xs text-gray-500 border-b border-gray-100">
        {DIAS_SEMANA_LARGO.map((d) => (
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
                "min-h-[74px] border-t border-r border-gray-100 p-1.5 flex flex-col gap-0.5",
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
                  const colorPersona = colorDePersona(ev.responsable, yoId, karolinaId);
                  const persona = ev.responsable === yoId ? "Ferru" :
                                  ev.responsable === karolinaId ? "Karo" :
                                  (nombrePorUserId[ev.responsable] || "Sin asignar");
                  return (
                    <button
                      key={ev.id + "_" + idx}
                      onClick={(e) => { e.stopPropagation(); onClickEvento(ev); }}
                      className="text-[10px] px-1.5 py-0.5 rounded truncate flex items-center gap-1 text-left hover:brightness-95 font-medium"
                      style={{ backgroundColor: `${colorPersona}22`, color: colorPersona, borderLeft: `3px solid ${colorPersona}` }}
                      title={`${persona} · ${tipo?.label || ev.tipo} · ${ev.titulo}`}
                    >
                      <span className="truncate">{ev.titulo}</span>
                    </button>
                  );
                })}
                {evts.length > 3 && <span className="text-[10px] text-gray-400">+{evts.length - 3} más</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ────────── Modales ──────────
function ModalTarea({ data, perfiles, onClose, onGuardado }) {
  const perfil = usePerfil();
  const esNueva = !data.tarea;
  const [form, setForm] = useState(() => ({
    cuenta:       data.tarea?.cuenta || "otro",
    tarea:        data.tarea?.tarea || "",
    categoria:    data.tarea?.categoria || "",
    fecha_limite: data.tarea?.fecha_limite?.slice(0, 10) || data.fechaDefault || "",
    estatus:      data.tarea?.estatus || "pendiente",
    notas:        data.tarea?.notas || "",
    responsable:  data.tarea?.responsable || perfil?.user_id || "",
  }));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!form.tarea.trim()) return toast.error("Escribe la tarea");
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
    if (err) return toast.error("No se pudo guardar: " + err.message);
    toast.success(esNueva ? "Tarea creada" : "Tarea actualizada");
    onGuardado();
  }

  return (
    <ModalShell title={esNueva ? "Nueva tarea" : "Editar tarea"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Cuenta">
          <select value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
            {CUENTAS.map((c) => <option key={c.id} value={c.id}>{c.full}</option>)}
          </select>
        </Field>
        <Field label="Tarea / Pendiente">
          <input value={form.tarea} onChange={(e) => setForm({ ...form, tarea: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Ej. Revisar reputación ML" autoFocus />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <input value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Escribe la categoría que quieras" />
          </Field>
          <Field label="Fecha límite">
            <input type="date" value={form.fecha_limite}
              onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Responsable">
            <select value={form.responsable}
              onChange={(e) => setForm({ ...form, responsable: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
              <option value="">Sin asignar</option>
              {perfiles.map((p) => (
                <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
              ))}
            </select>
          </Field>
          <Field label="Estatus">
            <select value={form.estatus}
              onChange={(e) => setForm({ ...form, estatus: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {Object.entries(ESTATUS_MAP).map(([id, cfg]) => <option key={id} value={id}>{cfg.label}</option>)}
            </select>
          </Field>
        </div>
        <Field label="Notas">
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" rows={3} placeholder="Opcional" />
        </Field>
      </div>
      <div className="flex items-center justify-end gap-2 mt-5">
        <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
        <button onClick={guardar} disabled={guardando}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalEvento({ data, perfiles, onClose, onGuardado, onBorrar }) {
  const perfil = usePerfil();
  const esNuevo = !data.evento;
  const [form, setForm] = useState(() => ({
    titulo:      data.evento?.titulo || "",
    tipo:        data.evento?.tipo || "reunion",
    fecha_ini:   data.evento?.fecha_ini?.slice(0, 10) || data.fechaDefault || toISO(new Date()),
    fecha_fin:   data.evento?.fecha_fin?.slice(0, 10) || data.fechaDefault || toISO(new Date()),
    responsable: data.evento?.responsable || perfil?.user_id || "",
    notas:       data.evento?.notas || "",
  }));
  const [guardando, setGuardando] = useState(false);

  async function guardar() {
    if (!form.titulo.trim()) return toast.error("Pon un título");
    if (form.fecha_fin < form.fecha_ini) return toast.error("La fecha fin debe ser mayor o igual a la inicial");
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
    if (err) return toast.error("No se pudo guardar: " + err.message);
    toast.success(esNuevo ? "Evento creado" : "Evento actualizado");
    onGuardado();
  }

  return (
    <ModalShell title={esNuevo ? "Nuevo evento" : "Editar evento"} onClose={onClose}>
      <div className="space-y-3">
        <Field label="Título">
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Ej. Vacaciones Karolina" autoFocus />
        </Field>
        <Field label="Tipo">
          <div className="grid grid-cols-3 gap-2">
            {TIPOS_EVENTO.map((t) => (
              <button key={t.id} type="button"
                onClick={() => setForm({ ...form, tipo: t.id })}
                className={[
                  "flex items-center gap-1.5 px-2 py-1.5 rounded-lg border text-xs transition",
                  form.tipo === t.id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-700 hover:bg-gray-50",
                ].join(" ")}>
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: t.color }} />
                {t.label}
              </button>
            ))}
          </div>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Desde">
            <input type="date" value={form.fecha_ini}
              onChange={(e) => setForm({ ...form, fecha_ini: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <Field label="Hasta">
            <input type="date" value={form.fecha_fin}
              onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
        </div>
        <Field label="Responsable">
          <select value={form.responsable}
            onChange={(e) => setForm({ ...form, responsable: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
            <option value="">Sin asignar</option>
            {perfiles.map((p) => <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>)}
          </select>
        </Field>
        <Field label="Notas">
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" rows={2} placeholder="Opcional" />
        </Field>
      </div>
      <div className="flex items-center justify-between mt-5">
        <div>
          {!esNuevo && (
            <button onClick={() => { onBorrar(data.evento.id); onClose(); }}
              className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Eliminar
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </ModalShell>
  );
}

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
