import React, { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { puedeEditarPestanaGlobal } from "../../lib/permisos";
import { toast } from "../../lib/toast";
import {
  Plus, Trash2, Check, Clock, Flame, PauseCircle, ChevronLeft, ChevronRight,
  CalendarDays, X, Edit3, ChevronDown, ChevronUp, AlertTriangle, Bell, BellOff,
  Building2, Tag, StickyNote, Inbox, RotateCcw, Users, FileText,
} from "lucide-react";
import MinutasPanel from "./MinutasPanel";
import RecurrentesPanel from "./RecurrentesPanel";

/**
 * Administración Interna — v3 (Fase 1)
 * ─────────────────────────────────────
 * - Tabs dinámicos por miembro interno (nombre + puesto)
 * - Fecha límite + prioridad + subtareas + barra de progreso
 * - Banner de vencidas / estancadas
 * - Auto-rollover de tareas no cerradas a la semana actual
 * - Métricas en header, contadores en título de pestaña
 * - Notificación del navegador (in-session) al detectar vencidas nuevas
 */

// ────────── Constantes ──────────
const CUENTAS = [
  { id: "mercadolibre", label: "ML",   full: "Mercado Libre", stripe: "#F59E0B", bg: "bg-yellow-100", text: "text-yellow-800", border: "border-yellow-200" },
  { id: "digitalife",   label: "DGL",  full: "Digitalife",    stripe: "#3B82F6", bg: "bg-blue-100",   text: "text-blue-800",   border: "border-blue-200" },
  { id: "pcel",         label: "PCEL", full: "PCEL",          stripe: "#EF4444", bg: "bg-red-100",    text: "text-red-800",    border: "border-red-200" },
  { id: "otro",         label: "Otro", full: "Otro",          stripe: "#A855F7", bg: "bg-purple-100", text: "text-purple-800", border: "border-purple-200" },
];

const ESTATUS_MAP = {
  pendiente:  { label: "Pendiente",  icon: null,        bg: "",             dot: "#9CA3AF" },
  en_proceso: { label: "En proceso", icon: Clock,       bg: "bg-amber-50",  dot: "#F59E0B" },
  urgente:    { label: "Urgente",    icon: Flame,       bg: "bg-red-50/60", dot: "#DC2626" },
  en_pausa:   { label: "En pausa",   icon: PauseCircle, bg: "bg-slate-50",  dot: "#64748B" },
  listo:      { label: "Listo",      icon: Check,       bg: "",             dot: "#10B981" },
};

const PRIORIDAD_MAP = {
  alta:  { label: "Alta",  bg: "bg-red-100",    text: "text-red-700",    dot: "#DC2626" },
  media: { label: "Media", bg: "bg-amber-100",  text: "text-amber-700",  dot: "#F59E0B" },
  baja:  { label: "Baja",  bg: "bg-slate-100",  text: "text-slate-600",  dot: "#94A3B8" },
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

// Paleta para miembros internos (se asigna en orden estable por user_id)
const PALETA_PERSONAS = ["#3B82F6", "#EC4899", "#10B981", "#F59E0B", "#8B5CF6", "#14B8A6", "#EF4444", "#6366F1"];

// Umbral de días sin actividad para considerar una tarea "estancada"
const DIAS_ESTANCADA = 7;

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

const hoyISO = () => toISO(new Date());
const diasEntre = (isoA, isoB) => {
  const a = parseISO(isoA), b = parseISO(isoB);
  if (!a || !b) return 0;
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
};

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

// ────────── Hook de notificaciones del navegador (in-session) ──────────
function useBrowserNotifications(vencidasIds, estancadasIds, enabled) {
  const avisadasRef = useRef(new Set());

  useEffect(() => {
    if (!enabled) return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const nuevas = [...vencidasIds, ...estancadasIds].filter(
      (id) => !avisadasRef.current.has(id)
    );
    if (nuevas.length === 0) return;

    // Una sola notificación consolidada para no spamear
    const venc = vencidasIds.filter((id) => !avisadasRef.current.has(id)).length;
    const est  = estancadasIds.filter((id) => !avisadasRef.current.has(id)).length;

    const partes = [];
    if (venc > 0) partes.push(`${venc} vencida${venc !== 1 ? "s" : ""}`);
    if (est  > 0) partes.push(`${est} estancada${est !== 1 ? "s" : ""}`);
    if (partes.length === 0) return;

    try {
      new Notification("Administración Interna", {
        body: `Tienes ${partes.join(" y ")} que requieren tu atención`,
        icon: "/favicon.ico",
        tag: "admin-interna-alertas",
      });
    } catch {}

    nuevas.forEach((id) => avisadasRef.current.add(id));
  }, [vencidasIds, estancadasIds, enabled]);
}

// Actualiza el título de la pestaña con un badge numérico
function useTituloBadge(cuenta) {
  const originalRef = useRef(null);
  useEffect(() => {
    if (originalRef.current === null) originalRef.current = document.title;
    const base = originalRef.current || "Dashboard Acteck";
    document.title = cuenta > 0 ? `(${cuenta}) ${base}` : base;
    return () => { document.title = base; };
  }, [cuenta]);
}

// ────────── Componente principal ──────────
export default function AdministracionInterna() {
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaGlobal(perfil, 'admin_interna');
  const yoId = perfil?.user_id;

  const [perfiles, setPerfiles] = useState([]);
  const [pendientes, setPendientes] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);
  const rolloverDoneRef = useRef(false);

  // Estado persistente
  const [tabResp, setTabResp] = usePersistedState("interna_tab_resp", "mios", String, (s) => s);
  const [semanaISO, setSemanaISO] = usePersistedState(
    "interna_semana", toISO(lunesDeSemana(new Date())), String, (s) => s
  );
  const semanaVisible = useMemo(() => parseISO(semanaISO) || lunesDeSemana(new Date()), [semanaISO]);
  const [mostrarFinde, setMostrarFinde] = usePersistedState("interna_finde", false);
  const [completadasOpen, setCompletadasOpen] = usePersistedState("interna_completadas_open", {});
  const [filtroCuenta, setFiltroCuenta] = usePersistedState("interna_filtro_cuenta", "todas", String, (s) => s);
  const [filtroPersona, setFiltroPersona] = useState("");
  const [mesVisibleISO, setMesVisibleISO] = usePersistedState(
    "interna_mes", toISO(new Date(new Date().getFullYear(), new Date().getMonth(), 1)), String, (s) => s
  );
  const mesVisible = useMemo(() => parseISO(mesVisibleISO) || new Date(), [mesVisibleISO]);
  const [calExpanded, setCalExpanded] = usePersistedState("interna_cal_open", true);
  const [notifEnabled, setNotifEnabled] = usePersistedState("interna_notif", true);
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== "undefined" ? Notification.permission : "default"
  );
  const [vista, setVista] = usePersistedState("interna_vista", "planeacion", String, (s) => s);

  // Modales
  const [modalTarea, setModalTarea] = useState(null);
  const [modalEvento, setModalEvento] = useState(null);

  useEffect(() => { cargarTodo(); /* eslint-disable-next-line */ }, []);

  async function cargarTodo() {
    setLoading(true);
    try {
      // Auto-generar recurrentes del día (idempotente, solo para editores)
      if (canEdit) {
        try {
          const { data: gen } = await supabase.rpc("generar_pendientes_recurrentes");
          if (gen && gen > 0) {
            toast.success(`${gen} tarea${gen !== 1 ? "s" : ""} recurrente${gen !== 1 ? "s" : ""} generada${gen !== 1 ? "s" : ""}`);
          }
        } catch (e) { console.error("generar_pendientes_recurrentes", e); }
      }

      const [pRes, peRes, evRes] = await Promise.all([
        supabase.from("perfiles")
          .select("user_id, nombre, email, rol, tipo, puesto, activo, es_super_admin")
          .eq("activo", true),
        supabase.from("pendientes_equipo").select("*").order("fecha_limite", { ascending: true, nullsFirst: false }),
        supabase.from("eventos_equipo").select("*").order("fecha_ini", { ascending: true }),
      ]);
      if (pRes.data)  setPerfiles(pRes.data);
      if (peRes.data) setPendientes(peRes.data);
      if (evRes.data) setEventos(evRes.data);
    } catch (e) { console.error(e); }
    setLoading(false);
  }

  // ────────── Perfiles internos / lookup ──────────
  const internos = useMemo(
    () => perfiles.filter((p) => p.tipo === "interno" || p.es_super_admin),
    [perfiles]
  );

  const nombrePorUserId = useMemo(() => {
    const map = {};
    perfiles.forEach((p) => { map[p.user_id] = p.nombre || p.email || "—"; });
    return map;
  }, [perfiles]);

  const puestoPorUserId = useMemo(() => {
    const map = {};
    perfiles.forEach((p) => { map[p.user_id] = p.puesto || ""; });
    return map;
  }, [perfiles]);

  // Paleta estable por persona (ordena por user_id para que no cambie)
  const colorPorUserId = useMemo(() => {
    const map = {};
    const ordenados = [...internos].sort((a, b) => (a.user_id || "").localeCompare(b.user_id || ""));
    ordenados.forEach((p, i) => { map[p.user_id] = PALETA_PERSONAS[i % PALETA_PERSONAS.length]; });
    return map;
  }, [internos]);

  // Helpers de "responsables" (multi o single legacy)
  const responsablesDe = (p) => {
    if (Array.isArray(p.responsables) && p.responsables.length > 0) return p.responsables;
    if (p.responsable) return [p.responsable];
    return [];
  };
  const pendienteDeUsuario = (p, uid) => responsablesDe(p).includes(uid);

  // ────────── Auto-rollover ──────────
  // Corre una sola vez por sesión. Tareas abiertas con fecha_limite < hoy
  // y que NO están ya en la semana actual, se mueven a hoy y se marca arrastrado_desde.
  useEffect(() => {
    if (loading) return;
    if (rolloverDoneRef.current) return;
    if (!canEdit) { rolloverDoneRef.current = true; return; }

    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const semanaInicio = lunesDeSemana(hoy);
    const vencidasParaArrastrar = pendientes.filter((p) => {
      if (p.estatus === "listo") return false;
      if (!p.fecha_limite) return false;
      const fl = parseISO(p.fecha_limite);
      if (!fl) return false;
      // Solo arrastra si quedó en una semana ANTERIOR a la actual
      return fl < semanaInicio;
    });

    if (vencidasParaArrastrar.length === 0) {
      rolloverDoneRef.current = true;
      return;
    }

    (async () => {
      rolloverDoneRef.current = true;
      const hoyStr = hoyISO();
      const ids = vencidasParaArrastrar.map((p) => p.id);

      // Optimista
      setPendientes((prev) => prev.map((p) => ids.includes(p.id)
        ? { ...p, fecha_limite: hoyStr, arrastrado_desde: p.arrastrado_desde || p.fecha_limite }
        : p
      ));

      // Persistir uno por uno (preservar arrastrado_desde original)
      await Promise.all(vencidasParaArrastrar.map((p) =>
        supabase.from("pendientes_equipo").update({
          fecha_limite: hoyStr,
          arrastrado_desde: p.arrastrado_desde || p.fecha_limite,
        }).eq("id", p.id)
      ));

      if (vencidasParaArrastrar.length > 0) {
        toast.success(`${vencidasParaArrastrar.length} tarea${vencidasParaArrastrar.length !== 1 ? "s" : ""} arrastrada${vencidasParaArrastrar.length !== 1 ? "s" : ""} de semanas anteriores`);
      }
    })();
  }, [loading, pendientes, canEdit]);

  // ────────── Filtrado ──────────
  const pendientesFiltrados = useMemo(() => {
    const q = filtroPersona.trim().toLowerCase();
    return pendientes.filter((p) => {
      if (filtroCuenta !== "todas" && p.cuenta !== filtroCuenta) return false;

      // Filtro por tab
      if (tabResp === "mios" && !pendienteDeUsuario(p, yoId)) return false;
      if (tabResp !== "mios" && tabResp !== "todos" && !pendienteDeUsuario(p, tabResp)) return false;

      // Filtro por búsqueda libre (match contra usuarios y libres)
      if (q) {
        const libres = Array.isArray(p.responsables_libres) ? p.responsables_libres : [];
        const nombresUsuarios = responsablesDe(p)
          .map((uid) => (nombrePorUserId[uid] || "").toLowerCase());
        const nombresLibres = libres.map((n) => (n || "").toLowerCase());
        const todos = [...nombresUsuarios, ...nombresLibres];
        const hay = todos.some((n) => n.includes(q)) ||
                    (p.tarea || "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientes, filtroCuenta, tabResp, yoId, filtroPersona, nombrePorUserId]);

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

  // ────────── Métricas globales ──────────
  const hoy = hoyISO();
  const ahora = new Date();

  const metricas = useMemo(() => {
    const activas = pendientesFiltrados.filter((p) => p.estatus !== "listo");
    const vencidas = activas.filter((p) => p.fecha_limite && p.fecha_limite.slice(0, 10) < hoy);
    const urgentes = activas.filter((p) => p.estatus === "urgente");
    const estancadas = activas.filter((p) => {
      if (!p.ultima_actividad) return false;
      if (p.fecha_limite && p.fecha_limite.slice(0, 10) < hoy) return false; // ya cuenta como vencida
      const dias = Math.floor((ahora - new Date(p.ultima_actividad)) / (1000 * 60 * 60 * 24));
      return dias >= DIAS_ESTANCADA;
    });
    const semana = diasVisibles.flatMap((d) => pendientesPorDia[toISO(d)] || []);
    const listoSemana = semana.filter((p) => p.estatus === "listo").length;

    return {
      activas: activas.length,
      vencidas,
      urgentes: urgentes.length,
      estancadas,
      semanaTotal: semana.length,
      semanaListo: listoSemana,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendientesFiltrados, diasVisibles, pendientesPorDia, hoy]);

  // Badge en título + notificación navegador
  useTituloBadge(metricas.vencidas.length + metricas.urgentes);
  useBrowserNotifications(
    metricas.vencidas.map((p) => p.id),
    metricas.estancadas.map((p) => p.id),
    notifEnabled
  );

  // ────────── Acciones ──────────
  async function toggleCheck(id, estatusActual) {
    if (!canEdit) return;
    const nuevo = estatusActual === "listo" ? "pendiente" : "listo";
    setPendientes((prev) => prev.map((p) => (p.id === id ? { ...p, estatus: nuevo } : p)));
    const { error } = await supabase.from("pendientes_equipo").update({ estatus: nuevo }).eq("id", id);
    if (error) {
      console.error(error);
      toast.error("No se pudo actualizar la tarea");
      cargarTodo();
    } else if (nuevo === "listo") {
      toast.success("Tarea marcada como completada");
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

  async function toggleSubtarea(tareaId, subId) {
    if (!canEdit) return;
    const tarea = pendientes.find((p) => p.id === tareaId);
    if (!tarea) return;
    const subtareas = Array.isArray(tarea.subtareas) ? tarea.subtareas : [];
    const nuevas = subtareas.map((s) => s.id === subId ? { ...s, hecho: !s.hecho } : s);

    // Auto-complete / auto-reopen según progreso de subtareas
    let nuevoEstatus = tarea.estatus;
    if (nuevas.length > 0) {
      const todasHechas = nuevas.every((s) => s.hecho);
      if (todasHechas && tarea.estatus !== "listo") {
        nuevoEstatus = "listo";
      } else if (!todasHechas && tarea.estatus === "listo") {
        nuevoEstatus = "pendiente";
      }
    }

    setPendientes((prev) => prev.map((p) =>
      p.id === tareaId ? { ...p, subtareas: nuevas, estatus: nuevoEstatus } : p
    ));
    const payload = { subtareas: nuevas };
    if (nuevoEstatus !== tarea.estatus) payload.estatus = nuevoEstatus;
    const { error } = await supabase.from("pendientes_equipo")
      .update(payload).eq("id", tareaId);
    if (error) {
      console.error(error);
      toast.error("No se pudo actualizar la subtarea");
      cargarTodo();
    } else if (nuevoEstatus === "listo" && tarea.estatus !== "listo") {
      toast.success("✓ Tarea completada automáticamente");
    }
  }

  async function borrarPendiente(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta tarea?")) return;
    setPendientes((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("pendientes_equipo").delete().eq("id", id);
    if (error) { console.error(error); toast.error("No se pudo eliminar"); cargarTodo(); }
    else toast.success("Tarea eliminada");
  }

  async function borrarEvento(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar este evento?")) return;
    setEventos((prev) => prev.filter((e) => e.id !== id));
    const { error } = await supabase.from("eventos_equipo").delete().eq("id", id);
    if (error) { console.error(error); toast.error("No se pudo eliminar"); cargarTodo(); }
    else toast.success("Evento eliminado");
  }

  async function solicitarPermisoNotif() {
    if (!("Notification" in window)) { toast.error("Este navegador no soporta notificaciones"); return; }
    if (Notification.permission === "granted") {
      setNotifPermission("granted"); setNotifEnabled(true);
      toast.success("Notificaciones activadas"); return;
    }
    if (Notification.permission === "denied") {
      setNotifPermission("denied");
      toast.error("Bloqueadas. Actívalas en la config del navegador."); return;
    }
    const res = await Notification.requestPermission();
    setNotifPermission(res);
    if (res === "granted") { setNotifEnabled(true); toast.success("Notificaciones activadas"); }
    else if (res === "denied") toast.error("Permiso denegado");
  }

  if (loading) return <div className="p-8 text-gray-400">Cargando administración interna…</div>;

  // ────────── Tabs dinámicos ──────────
  const otrosInternos = internos.filter((p) => p.user_id !== yoId);
  const tabs = [
    { id: "mios", label: perfil?.nombre?.split(" ")[0] || "Míos", puesto: perfil?.puesto || "", userId: yoId,
      count: pendientes.filter((p) => pendienteDeUsuario(p, yoId) && p.estatus !== "listo").length },
    ...otrosInternos.map((u) => ({
      id: u.user_id,
      label: (u.nombre || u.email || "—").split(" ")[0],
      puesto: u.puesto || "",
      userId: u.user_id,
      count: pendientes.filter((p) => pendienteDeUsuario(p, u.user_id) && p.estatus !== "listo").length,
    })),
    { id: "todos", label: "Todos", puesto: "", userId: null,
      count: pendientes.filter((p) => p.estatus !== "listo").length },
  ];

  const notifState = notifPermission;

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Building2 className="w-6 h-6 text-gray-700" />
            Administración Interna
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Pendientes del equipo · Calendario · Vacaciones y salidas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Toggle notificaciones */}
          {notifState === "granted" ? (
            <button
              onClick={() => setNotifEnabled(!notifEnabled)}
              className={[
                "px-3 py-2 rounded-lg border text-sm font-medium flex items-center gap-1.5",
                notifEnabled ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-500",
              ].join(" ")}
              title={notifEnabled ? "Notificaciones activas" : "Notificaciones en pausa"}
            >
              {notifEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
          ) : (
            <button
              onClick={solicitarPermisoNotif}
              className="px-3 py-2 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm text-gray-600 flex items-center gap-1.5"
              title="Activar notificaciones"
            >
              <BellOff className="w-4 h-4" /> Activar alertas
            </button>
          )}

          {canEdit && vista === "planeacion" && (
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

      {/* SWITCHER DE VISTA */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setVista("planeacion")}
          className={[
            "px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5",
            vista === "planeacion" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
          ].join(" ")}
        >
          <CalendarDays className="w-3.5 h-3.5" /> Planeación
        </button>
        <button
          onClick={() => setVista("minutas")}
          className={[
            "px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5",
            vista === "minutas" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
          ].join(" ")}
        >
          <FileText className="w-3.5 h-3.5" /> Minutas
        </button>
        <button
          onClick={() => setVista("recurrentes")}
          className={[
            "px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5",
            vista === "recurrentes" ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
          ].join(" ")}
        >
          <RotateCcw className="w-3.5 h-3.5" /> Recurrentes
        </button>
      </div>

      {vista === "planeacion" && <>
      {/* BANNER DE ALERTAS */}
      {(metricas.vencidas.length > 0 || metricas.estancadas.length > 0) && (
        <div className="bg-gradient-to-r from-red-50 to-amber-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3 flex-wrap">
          <AlertTriangle className="w-5 h-5 text-red-600 shrink-0" />
          <div className="flex-1 text-sm">
            {metricas.vencidas.length > 0 && (
              <span className="text-red-700 font-medium mr-3">
                {metricas.vencidas.length} vencida{metricas.vencidas.length !== 1 ? "s" : ""}
              </span>
            )}
            {metricas.estancadas.length > 0 && (
              <span className="text-amber-700 font-medium">
                {metricas.estancadas.length} sin avance en +{DIAS_ESTANCADA} días
              </span>
            )}
            <span className="text-gray-600 ml-2">
              · Revisa, cierra o ajusta la fecha de conclusión.
            </span>
          </div>
        </div>
      )}

      {/* CALENDARIO (colapsable) */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <button
          onClick={() => setCalExpanded(!calExpanded)}
          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50"
        >
          <span className="font-semibold text-gray-800 flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-gray-600" />
            Calendario · {MESES_LARGO[mesVisible.getMonth()]} {mesVisible.getFullYear()}
          </span>
          {calExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </button>
        {calExpanded && (
          <Calendario
            mesVisible={mesVisible}
            setMesVisibleISO={setMesVisibleISO}
            eventos={eventos}
            internos={internos}
            colorPorUserId={colorPorUserId}
            nombrePorUserId={nombrePorUserId}
            canEdit={canEdit}
            onClickEvento={(ev) => setModalEvento({ evento: ev })}
            onClickDia={(fecha) => canEdit && setModalEvento({ fechaDefault: fecha })}
          />
        )}
      </div>

      {/* TABS + FILTROS + NAVEGADOR */}
      <div className="bg-white rounded-xl border border-gray-100 px-3 py-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Tabs dinámicos por responsable */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto max-w-full">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTabResp(t.id)}
                className={[
                  "px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap text-left",
                  tabResp === t.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
                ].join(" ")}
                title={t.puesto || ""}
              >
                <div className="flex items-center gap-1.5">
                  {t.userId && (
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPorUserId[t.userId] || "#94A3B8" }} />
                  )}
                  <span>{t.label}</span>
                  {t.count > 0 && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                      {t.count}
                    </span>
                  )}
                </div>
                {t.puesto && (
                  <div className="text-[10px] text-gray-400 font-normal leading-tight">{t.puesto}</div>
                )}
              </button>
            ))}
          </div>

          <div className="w-px h-6 bg-gray-200 mx-1" />

          <select
            value={filtroCuenta}
            onChange={(e) => setFiltroCuenta(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
          >
            <option value="todas">Todas las cuentas</option>
            {CUENTAS.map((c) => <option key={c.id} value={c.id}>{c.full}</option>)}
          </select>

          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={mostrarFinde}
              onChange={(e) => setMostrarFinde(e.target.checked)}
              className="rounded border-gray-300"
            />
            Fin de semana
          </label>

          <input
            value={filtroPersona}
            onChange={(e) => setFiltroPersona(e.target.value)}
            placeholder="Buscar por persona o tarea…"
            className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white w-44"
          />
          {filtroPersona && (
            <button
              onClick={() => setFiltroPersona("")}
              className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
              title="Limpiar búsqueda"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <div className="flex-1" />

          {/* Métricas */}
          <div className="text-xs text-gray-600 hidden md:flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="font-semibold text-gray-800">{metricas.activas}</span>
              <span className="text-gray-400">activas</span>
            </span>
            {metricas.urgentes > 0 && (
              <span className="flex items-center gap-1 text-red-600 font-semibold">
                <Flame className="w-3 h-3" /> {metricas.urgentes}
              </span>
            )}
            {metricas.vencidas.length > 0 && (
              <span className="flex items-center gap-1 text-red-700 font-semibold">
                <AlertTriangle className="w-3 h-3" /> {metricas.vencidas.length}
              </span>
            )}
            <span className="flex items-center gap-1 text-emerald-600">
              <Check className="w-3 h-3" />
              <span className="font-semibold">{metricas.semanaListo}</span>/<span>{metricas.semanaTotal}</span>
            </span>
          </div>

          {/* Navegador de semana */}
          <div className="flex items-center gap-0.5 bg-gray-50 rounded-lg border border-gray-200">
            <button
              onClick={() => { const d = new Date(semanaVisible); d.setDate(d.getDate() - 7); setSemanaISO(toISO(d)); }}
              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-l-lg"
              title="Semana anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => { const d = new Date(semanaVisible); d.setDate(d.getDate() + 7); setSemanaISO(toISO(d)); }}
              className="p-1.5 hover:bg-gray-100 text-gray-600 rounded-r-lg"
              title="Semana siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Encabezado grande de la semana + botón "Ir a hoy" */}
        <div className="mt-2 flex items-center justify-center gap-3">
          <div className="text-base font-semibold text-gray-700">
            Semana del {semanaVisible.getDate()} de {MESES_LARGO[semanaVisible.getMonth()]} al{" "}
            {(() => {
              const fin = new Date(semanaVisible); fin.setDate(fin.getDate() + (mostrarFinde ? 6 : 4));
              return `${fin.getDate()} de ${MESES_LARGO[fin.getMonth()]}`;
            })()}
          </div>
          {(() => {
            const hoyLunes = toISO(lunesDeSemana(new Date()));
            const esSemanaActual = semanaISO === hoyLunes;
            if (esSemanaActual) return null;
            return (
              <button
                onClick={() => setSemanaISO(hoyLunes)}
                className="text-xs px-2 py-1 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium border border-blue-200"
              >
                Ir a hoy
              </button>
            );
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
              colorPorUserId={colorPorUserId}
              completadasOpen={completadasOpen[key] || false}
              toggleCompletadasOpen={() => setCompletadasOpen({ ...completadasOpen, [key]: !completadasOpen[key] })}
              onToggleCheck={toggleCheck}
              onToggleSubtarea={toggleSubtarea}
              onCambiarEstatus={cambiarEstatus}
              onEditar={(t) => setModalTarea({ tarea: t })}
              onBorrar={borrarPendiente}
              onAgregar={() => canEdit && setModalTarea({ fechaDefault: key })}
              hoyISO={hoy}
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
          colorPorUserId={colorPorUserId}
          onToggleCheck={toggleCheck}
          onToggleSubtarea={toggleSubtarea}
          onEditar={(t) => setModalTarea({ tarea: t })}
          onBorrar={borrarPendiente}
          hoyISO={hoy}
        />
      )}
      </>}

      {/* VISTA MINUTAS */}
      {vista === "minutas" && (
        <MinutasPanel
          canEdit={canEdit}
          internos={internos}
          perfiles={perfiles}
          nombrePorUserId={nombrePorUserId}
          colorPorUserId={colorPorUserId}
        />
      )}

      {/* VISTA RECURRENTES */}
      {vista === "recurrentes" && (
        <RecurrentesPanel
          canEdit={canEdit}
          internos={internos}
          perfiles={perfiles}
          nombrePorUserId={nombrePorUserId}
          colorPorUserId={colorPorUserId}
          onChanged={cargarTodo}
        />
      )}

      {/* MODALES */}
      {modalTarea && (
        <ModalTarea
          data={modalTarea}
          perfiles={perfiles}
          internos={internos}
          onClose={() => setModalTarea(null)}
          onGuardado={() => { cargarTodo(); setModalTarea(null); }}
        />
      )}
      {modalEvento && (
        <ModalEvento
          data={modalEvento}
          perfiles={perfiles}
          internos={internos}
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
  fecha, esHoy, tareas, canEdit, nombrePorUserId, colorPorUserId,
  completadasOpen, toggleCompletadasOpen,
  onToggleCheck, onToggleSubtarea, onCambiarEstatus, onEditar, onBorrar, onAgregar, hoyISO,
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

      {total > 0 && (
        <div className="h-0.5 bg-gray-100">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

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
              colorPorUserId={colorPorUserId}
              onToggleCheck={onToggleCheck}
              onToggleSubtarea={onToggleSubtarea}
              onCambiarEstatus={onCambiarEstatus}
              onEditar={onEditar}
              onBorrar={onBorrar}
              hoyISO={hoyISO}
            />
          ))
        )}
      </div>

      {canEdit && (
        <button
          onClick={onAgregar}
          className="mx-2 mb-2 py-1.5 text-xs text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md border border-dashed border-gray-200 hover:border-blue-300 transition flex items-center justify-center gap-1"
        >
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      )}

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
                  colorPorUserId={colorPorUserId}
                  onToggleCheck={onToggleCheck}
                  onToggleSubtarea={onToggleSubtarea}
                  onCambiarEstatus={onCambiarEstatus}
                  onEditar={onEditar}
                  onBorrar={onBorrar}
                  hoyISO={hoyISO}
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
function SinFechaBloque({ tareas, canEdit, nombrePorUserId, colorPorUserId, onToggleCheck, onToggleSubtarea, onEditar, onBorrar, hoyISO }) {
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
          <Inbox className="w-4 h-4 text-gray-500" />
          Sin fecha asignada
          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-normal">
            {tareas.length}
          </span>
        </span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
      </button>
      {open && (
        <div className="px-3 pb-3 grid gap-1.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {abiertas.map((t) => (
            <TareaCard key={t.id} t={t} canEdit={canEdit} nombrePorUserId={nombrePorUserId} colorPorUserId={colorPorUserId}
              onToggleCheck={onToggleCheck} onToggleSubtarea={onToggleSubtarea} onEditar={onEditar} onBorrar={onBorrar} hoyISO={hoyISO} />
          ))}
          {completadas.map((t) => (
            <TareaCard key={t.id} t={t} canEdit={canEdit} nombrePorUserId={nombrePorUserId} colorPorUserId={colorPorUserId}
              onToggleCheck={onToggleCheck} onToggleSubtarea={onToggleSubtarea} onEditar={onEditar} onBorrar={onBorrar} hoyISO={hoyISO} compacta />
          ))}
        </div>
      )}
    </div>
  );
}

// ────────── Tarjeta de tarea ──────────
function TareaCard({ t, canEdit, nombrePorUserId, colorPorUserId, onToggleCheck, onToggleSubtarea, onCambiarEstatus, onEditar, onBorrar, compacta, hoyISO }) {
  const cuenta = CUENTAS.find((c) => c.id === t.cuenta) || CUENTAS[3];
  const est = ESTATUS_MAP[t.estatus] || ESTATUS_MAP.pendiente;
  const pri = PRIORIDAD_MAP[t.prioridad] || PRIORIDAD_MAP.media;
  const EstIcon = est.icon;
  const esListo = t.estatus === "listo";
  const [menu, setMenu] = useState(false);
  const [subtOpen, setSubtOpen] = useState(false);

  // Responsables (multi con fallback a legacy)
  const responsables = Array.isArray(t.responsables) && t.responsables.length > 0
    ? t.responsables
    : (t.responsable ? [t.responsable] : []);
  const responsablesLibres = Array.isArray(t.responsables_libres) ? t.responsables_libres : [];

  // Subtareas
  const subs = Array.isArray(t.subtareas) ? t.subtareas : [];
  const subsHechas = subs.filter((s) => s.hecho).length;
  const pctSubs = subs.length > 0 ? Math.round((subsHechas / subs.length) * 100) : null;

  // Vencida / arrastrada
  const vencida = !esListo && t.fecha_limite && t.fecha_limite.slice(0, 10) < hoyISO;
  const arrastrada = !!t.arrastrado_desde && !esListo;

  return (
    <div
      className={[
        "relative group rounded-md border transition",
        compacta ? "p-1.5" : "p-2",
        vencida ? "border-red-300 bg-red-50/40 hover:border-red-400" : "border-gray-100 hover:border-gray-200",
        !vencida && est.bg,
      ].filter(Boolean).join(" ")}
      style={{ borderLeft: `3px solid ${cuenta.stripe}` }}
    >
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className={[
            "text-[13px] leading-snug break-words",
            esListo ? "line-through text-gray-400" : "text-gray-800",
          ].join(" ")}>
            {t.tarea}
          </div>

          {!compacta && (
            <div className="flex items-center gap-1 flex-wrap mt-1 text-[10px]">
              <span className={`inline-flex items-center px-1.5 py-0.5 rounded font-semibold ${cuenta.bg} ${cuenta.text}`}>
                {cuenta.label}
              </span>

              {/* Prioridad (solo si no es media, para reducir ruido) */}
              {!esListo && t.prioridad && t.prioridad !== "media" && (
                <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-semibold ${pri.bg} ${pri.text}`}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pri.dot }} />
                  {pri.label}
                </span>
              )}

              {/* Estatus (no pendiente ni listo) */}
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

              {/* Vencida */}
              {vencida && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded font-bold bg-red-600 text-white">
                  <AlertTriangle className="w-2.5 h-2.5" /> Vencida
                </span>
              )}

              {/* Arrastrada */}
              {arrastrada && (
                <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700" title={`Viene del ${t.arrastrado_desde}`}>
                  <RotateCcw className="w-2.5 h-2.5" /> Arrastrada
                </span>
              )}

              {/* Categoría */}
              {t.categoria && (
                <span className="text-gray-500 truncate max-w-[120px] inline-flex items-center gap-0.5" title={t.categoria}>
                  <Tag className="w-2.5 h-2.5" /> {t.categoria}
                </span>
              )}

              {/* Responsables (puntitos de color) */}
              {responsables.length > 0 && (
                <span className="inline-flex items-center gap-0.5" title={responsables.map((u) => nombrePorUserId[u] || "—").join(", ")}>
                  {responsables.slice(0, 3).map((u) => (
                    <span key={u} className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPorUserId[u] || "#94A3B8" }} />
                  ))}
                  {responsables.length > 3 && <span className="text-gray-400">+{responsables.length - 3}</span>}
                </span>
              )}

              {/* Responsables libres (etiquetas) */}
              {responsablesLibres.map((nombre, idx) => (
                <span
                  key={`lib_${idx}`}
                  className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-medium"
                  title={`Responsable: ${nombre}`}
                >
                  {nombre}
                </span>
              ))}

              {/* Notas */}
              {t.notas && (
                <span className="text-gray-400 italic truncate max-w-[140px] inline-flex items-center gap-0.5" title={t.notas}>
                  <StickyNote className="w-2.5 h-2.5" /> {t.notas}
                </span>
              )}
            </div>
          )}

          {/* Barra de progreso automática (si hay subtareas) */}
          {!compacta && subs.length > 0 && (
            <div className="mt-1.5">
              <button
                onClick={(e) => { e.stopPropagation(); setSubtOpen(!subtOpen); }}
                className="w-full flex items-center gap-1.5 text-[10px] text-gray-500 hover:text-gray-700"
              >
                {subtOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                <div className="flex-1 h-1 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={pctSubs === 100 ? "h-full bg-emerald-500" : "h-full bg-blue-500"}
                    style={{ width: `${pctSubs}%` }}
                  />
                </div>
                <span className="tabular-nums whitespace-nowrap">{subsHechas}/{subs.length}</span>
              </button>
              {subtOpen && (
                <div className="mt-1 space-y-0.5 max-h-48 overflow-y-auto pr-1">
                  {subs.map((s) => (
                    <label key={s.id} className="flex items-start gap-1.5 text-[11px] cursor-pointer group/sub">
                      <span className={`flex-1 ${s.hecho ? "line-through text-gray-400" : "text-gray-700"}`}>
                        {s.texto}
                      </span>
                      <input
                        type="checkbox"
                        checked={!!s.hecho}
                        disabled={!canEdit}
                        onChange={() => onToggleSubtarea && onToggleSubtarea(t.id, s.id)}
                        className="mt-0.5 rounded border-gray-300 shrink-0"
                      />
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Acciones + Check (a la derecha) */}
        <div className="shrink-0 flex items-start gap-1.5">
          {canEdit && (
            <div className="relative opacity-0 group-hover:opacity-100 transition-opacity">
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
          <button
            onClick={(e) => { e.stopPropagation(); onToggleCheck(t.id, t.estatus); }}
            disabled={!canEdit}
            className={[
              "shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition",
              esListo ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white hover:border-emerald-500",
              canEdit ? "cursor-pointer" : "cursor-default",
            ].join(" ")}
            title={esListo ? "Marcar como pendiente" : "Marcar como completada"}
          >
            {esListo && <Check className="w-3 h-3" strokeWidth={3} />}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── Calendario ──────────
function Calendario({ mesVisible, setMesVisibleISO, eventos, internos, colorPorUserId, nombrePorUserId, canEdit, onClickEvento, onClickDia }) {
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
      <div className="px-4 py-2 border-b border-gray-100 flex items-center justify-between flex-wrap gap-2">
        {/* Leyenda dinámica por persona interna */}
        <div className="flex flex-wrap gap-3 text-xs items-center">
          {internos.map((p) => (
            <span key={p.user_id} className="flex items-center gap-1.5 text-gray-700">
              <span className="w-3 h-3 rounded-full" style={{ backgroundColor: colorPorUserId[p.user_id] || "#94A3B8" }} />
              <span className="font-medium">{(p.nombre || p.email || "—").split(" ")[0]}</span>
            </span>
          ))}
          <span className="flex items-center gap-1.5 text-gray-500">
            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: "#94A3B8" }} />
            Externo / sin asignar
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { const d = new Date(mesVisible); d.setMonth(d.getMonth() - 1); setMesVisibleISO(toISO(new Date(d.getFullYear(), d.getMonth(), 1))); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => { const d = new Date(); setMesVisibleISO(toISO(new Date(d.getFullYear(), d.getMonth(), 1))); }}
            className="text-xs px-2 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700"
          >
            Este mes
          </button>
          <button
            onClick={() => { const d = new Date(mesVisible); d.setMonth(d.getMonth() + 1); setMesVisibleISO(toISO(new Date(d.getFullYear(), d.getMonth(), 1))); }}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-600"
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
                  const colorPersona = colorPorUserId[ev.responsable] || "#94A3B8";
                  const persona = nombrePorUserId[ev.responsable]?.split(" ")[0] || "Sin asignar";
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

// ────────── Modal Tarea ──────────
function ModalTarea({ data, perfiles, internos, onClose, onGuardado }) {
  const perfil = usePerfil();
  const esNueva = !data.tarea;
  const responsablesIniciales = (() => {
    if (data.tarea?.responsables && Array.isArray(data.tarea.responsables) && data.tarea.responsables.length > 0) return data.tarea.responsables;
    if (data.tarea?.responsable) return [data.tarea.responsable];
    if (!esNueva) return [];
    return perfil?.user_id ? [perfil.user_id] : [];
  })();
  const [form, setForm] = useState(() => ({
    cuenta:        data.tarea?.cuenta || "otro",
    tarea:         data.tarea?.tarea || "",
    categoria:     data.tarea?.categoria || "",
    fecha_limite:  data.tarea?.fecha_limite?.slice(0, 10) || data.fechaDefault || "",
    estatus:       data.tarea?.estatus || "pendiente",
    prioridad:     data.tarea?.prioridad || "media",
    notas:         data.tarea?.notas || "",
    responsables:  responsablesIniciales,
    responsables_libres: Array.isArray(data.tarea?.responsables_libres) ? data.tarea.responsables_libres : [],
    subtareas:     Array.isArray(data.tarea?.subtareas) ? data.tarea.subtareas : [],
  }));
  const [guardando, setGuardando] = useState(false);
  const [nuevaSub, setNuevaSub] = useState("");
  const [nuevoRespLibre, setNuevoRespLibre] = useState("");

  const toggleResp = (uid) => {
    setForm((f) => ({
      ...f,
      responsables: f.responsables.includes(uid)
        ? f.responsables.filter((u) => u !== uid)
        : [...f.responsables, uid],
    }));
  };

  const agregarRespLibre = () => {
    const txt = nuevoRespLibre.trim();
    if (!txt) return;
    if (form.responsables_libres.includes(txt)) { setNuevoRespLibre(""); return; }
    setForm((f) => ({ ...f, responsables_libres: [...f.responsables_libres, txt] }));
    setNuevoRespLibre("");
  };
  const quitarRespLibre = (nombre) => {
    setForm((f) => ({ ...f, responsables_libres: f.responsables_libres.filter((n) => n !== nombre) }));
  };

  const agregarSub = () => {
    const txt = nuevaSub.trim();
    if (!txt) return;
    setForm((f) => ({
      ...f,
      subtareas: [...f.subtareas, { id: Math.random().toString(36).slice(2, 10), texto: txt, hecho: false }],
    }));
    setNuevaSub("");
  };

  const quitarSub = (id) => setForm((f) => ({ ...f, subtareas: f.subtareas.filter((s) => s.id !== id) }));
  const toggleSub = (id) => setForm((f) => ({ ...f, subtareas: f.subtareas.map((s) => s.id === id ? { ...s, hecho: !s.hecho } : s) }));
  const editarSubTexto = (id, texto) => setForm((f) => ({ ...f, subtareas: f.subtareas.map((s) => s.id === id ? { ...s, texto } : s) }));

  async function guardar() {
    if (!form.tarea.trim()) return toast.error("Escribe la tarea");
    setGuardando(true);
    const payload = {
      cuenta: form.cuenta,
      tarea: form.tarea.trim(),
      categoria: form.categoria.trim() || null,
      fecha_limite: form.fecha_limite || null,
      estatus: form.estatus,
      prioridad: form.prioridad,
      notas: form.notas.trim() || null,
      responsables: form.responsables,
      responsables_libres: form.responsables_libres,
      responsable: form.responsables[0] || null,   // compat legacy
      subtareas: form.subtareas,
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
              placeholder="Escribe la categoría" />
          </Field>
          <Field label="Fecha límite">
            <input type="date" value={form.fecha_limite}
              onChange={(e) => setForm({ ...form, fecha_limite: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Prioridad">
            <div className="flex gap-1">
              {Object.entries(PRIORIDAD_MAP).map(([id, cfg]) => (
                <button key={id} type="button"
                  onClick={() => setForm({ ...form, prioridad: id })}
                  className={[
                    "flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1 transition",
                    form.prioridad === id ? `${cfg.bg} ${cfg.text} border-transparent ring-2 ring-offset-1 ring-blue-300` : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                  ].join(" ")}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: cfg.dot }} />
                  {cfg.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Estatus">
            <select value={form.estatus}
              onChange={(e) => setForm({ ...form, estatus: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
              {Object.entries(ESTATUS_MAP).map(([id, cfg]) => <option key={id} value={id}>{cfg.label}</option>)}
            </select>
          </Field>
        </div>

        {/* Responsables (multi) */}
        <Field label={<span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Responsables</span>}>
          <div className="flex flex-wrap gap-1.5">
            {perfiles.map((p) => {
              const activo = form.responsables.includes(p.user_id);
              const esInterno = p.tipo === "interno" || p.es_super_admin;
              return (
                <button key={p.user_id} type="button"
                  onClick={() => toggleResp(p.user_id)}
                  className={[
                    "px-2.5 py-1 rounded-full text-xs border transition",
                    activo
                      ? "bg-blue-600 border-blue-600 text-white"
                      : esInterno
                        ? "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
                        : "bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100",
                  ].join(" ")}
                  title={p.puesto || p.email}
                >
                  {(p.nombre || p.email || "—")}
                  {!esInterno && <span className="ml-1 text-[9px] opacity-70">(ext)</span>}
                </button>
              );
            })}
          </div>
          {form.responsables.length === 0 && form.responsables_libres.length === 0 && (
            <p className="text-[11px] text-gray-400 mt-1">Sin asignar</p>
          )}

          {/* Responsables libres (texto) */}
          <div className="mt-2 space-y-1.5">
            {form.responsables_libres.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {form.responsables_libres.map((nombre) => (
                  <span key={nombre} className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-purple-100 text-purple-700 text-xs">
                    {nombre}
                    <button onClick={() => quitarRespLibre(nombre)} className="hover:text-red-600">
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                value={nuevoRespLibre}
                onChange={(e) => setNuevoRespLibre(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarRespLibre(); } }}
                placeholder="+ Responsable externo (Nombre Apellido)"
                className="flex-1 px-2 py-1 rounded border border-dashed border-gray-300 text-xs"
              />
              <button
                type="button"
                onClick={agregarRespLibre}
                className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                Añadir
              </button>
            </div>
          </div>
        </Field>

        {/* Subtareas */}
        <Field label="Subtareas">
          <div className="space-y-1.5">
            {form.subtareas.map((s) => (
              <div key={s.id} className="flex items-center gap-2 group">
                <input
                  value={s.texto}
                  onChange={(e) => editarSubTexto(s.id, e.target.value)}
                  className={[
                    "flex-1 px-2 py-1 rounded border border-gray-200 text-sm",
                    s.hecho ? "line-through text-gray-400" : "",
                  ].join(" ")}
                />
                <button type="button" onClick={() => quitarSub(s.id)}
                  className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                  <X className="w-3.5 h-3.5" />
                </button>
                <input
                  type="checkbox"
                  checked={!!s.hecho}
                  onChange={() => toggleSub(s.id)}
                  className="rounded border-gray-300 shrink-0"
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <input
                value={nuevaSub}
                onChange={(e) => setNuevaSub(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarSub(); } }}
                className="flex-1 px-2 py-1 rounded border border-dashed border-gray-300 text-sm"
                placeholder="+ Agregar subtarea (Enter)"
              />
              <button type="button" onClick={agregarSub}
                className="px-2.5 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
                Añadir
              </button>
            </div>
            {form.subtareas.length > 0 && (
              <div className="text-[11px] text-gray-500">
                {form.subtareas.filter((s) => s.hecho).length} / {form.subtareas.length} completadas
              </div>
            )}
          </div>
        </Field>

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

// ────────── Modal Evento ──────────
function ModalEvento({ data, perfiles, internos, onClose, onGuardado, onBorrar }) {
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
            placeholder="Ej. Vacaciones" autoFocus />
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
            {(internos || perfiles).map((p) => <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>)}
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
