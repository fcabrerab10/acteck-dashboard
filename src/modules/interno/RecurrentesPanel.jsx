import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { toast } from "../../lib/toast";
import {
  Plus, Trash2, X, Edit3, Repeat, Calendar, ChevronDown, ChevronUp,
  Users, Power, PowerOff, RefreshCw, Check, History, CheckCircle2,
} from "lucide-react";

/**
 * RecurrentesPanel — Fase 2
 * CRUD de plantillas de tareas que se replican automáticamente.
 * Diaria / semanal (con días) / mensual (día específico o último día).
 * Al entrar a Administración Interna se llama `generar_pendientes_recurrentes()`
 * que materializa las plantillas del día.
 */

const CUENTAS = [
  { id: "digitalife",   label: "Digitalife",    stripe: "#3B82F6" },
  { id: "pcel",         label: "PCEL",          stripe: "#EF4444" },
  { id: "mercadolibre", label: "Mercado Libre", stripe: "#F59E0B" },
  { id: "otro",         label: "Otro / Interno",stripe: "#A855F7" },
];

const PRIORIDADES = [
  { id: "alta",  label: "Alta",  bg: "bg-red-100",   text: "text-red-700",    dot: "#DC2626" },
  { id: "media", label: "Media", bg: "bg-amber-100", text: "text-amber-700",  dot: "#F59E0B" },
  { id: "baja",  label: "Baja",  bg: "bg-slate-100", text: "text-slate-600",  dot: "#94A3B8" },
];

const DIAS_ISO = [
  { n: 1, lbl: "L" }, { n: 2, lbl: "M" }, { n: 3, lbl: "X" },
  { n: 4, lbl: "J" }, { n: 5, lbl: "V" }, { n: 6, lbl: "S" }, { n: 7, lbl: "D" },
];
const DIAS_LARGO = ["Lun","Mar","Mié","Jue","Vie","Sáb","Dom"];

export default function RecurrentesPanel({ canEdit, perfiles, internos, nombrePorUserId, colorPorUserId, onChanged }) {
  const perfil = usePerfil();
  const yoId = perfil?.user_id;
  const [recs, setRecs] = useState([]);
  const [ejecucionesPorRec, setEjecucionesPorRec] = useState({});
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);
  const [regenerando, setRegenerando] = useState(false);
  // Tab persona: 'mios' | 'todos' | <user_id>
  const [tabResp, setTabResp] = useState('mios');

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const [recRes, ejecRes] = await Promise.all([
      supabase.from("tareas_recurrentes").select("*")
        .order("activa", { ascending: false })
        .order("frecuencia")
        .order("tarea"),
      // Últimas 200 ejecuciones (pendientes con origen_recurrente_id, listos)
      supabase.from("pendientes_equipo")
        .select("id, origen_recurrente_id, fecha_generado, fecha_limite, estatus, completado_en, responsable, responsables, ultima_actividad")
        .not("origen_recurrente_id", "is", null)
        .order("fecha_generado", { ascending: false })
        .limit(500),
    ]);
    if (recRes.error) { console.error(recRes.error); toast.error("Error cargando recurrentes"); }
    setRecs(recRes.data || []);
    // Indexar ejecuciones por origen_recurrente_id
    const map = {};
    (ejecRes.data || []).forEach((e) => {
      if (!map[e.origen_recurrente_id]) map[e.origen_recurrente_id] = [];
      map[e.origen_recurrente_id].push(e);
    });
    setEjecucionesPorRec(map);
    setLoading(false);
  }

  // Marca como ejecutada hoy: crea (si no existe) un pendiente del día
  // con origen_recurrente_id y lo marca como 'listo'.
  async function marcarEjecutadaHoy(r) {
    if (!canEdit) return;
    const hoy = new Date(); const hoyISO = hoy.toISOString().slice(0, 10);
    // ¿Ya hay un pendiente generado hoy de esta plantilla?
    const { data: existente } = await supabase.from("pendientes_equipo")
      .select("id, estatus")
      .eq("origen_recurrente_id", r.id)
      .eq("fecha_generado", hoyISO)
      .limit(1);

    if (existente && existente.length > 0) {
      // Marcar como listo si no lo está
      if (existente[0].estatus !== "listo") {
        await supabase.from("pendientes_equipo")
          .update({ estatus: "listo" })
          .eq("id", existente[0].id);
        toast.success(`✓ "${r.tarea}" marcada como ejecutada`);
      } else {
        toast.success(`Ya estaba marcada como ejecutada hoy`);
      }
    } else {
      // Crear pendiente nuevo del día y marcarlo listo
      const payload = {
        cuenta: r.cuenta,
        tarea: r.tarea,
        categoria: r.categoria || "Recurrente",
        fecha_limite: hoyISO,
        estatus: "listo",
        prioridad: r.prioridad,
        notas: r.notas,
        responsable: r.responsable,
        responsables: Array.isArray(r.responsables) && r.responsables.length > 0 ? r.responsables : (r.responsable ? [r.responsable] : []),
        subtareas: Array.isArray(r.subtareas_plantilla) ? r.subtareas_plantilla.map((s) => ({ ...s, hecho: true })) : [],
        origen_recurrente_id: r.id,
        fecha_generado: hoyISO,
        creado_por: perfil?.user_id || null,
      };
      const { error } = await supabase.from("pendientes_equipo").insert(payload);
      if (error) { toast.error("Error: " + error.message); return; }
      toast.success(`✓ "${r.tarea}" registrada como ejecutada`);
    }
    cargar();
    if (onChanged) onChanged();
  }

  async function toggleActiva(r) {
    if (!canEdit) return;
    const { error } = await supabase.from("tareas_recurrentes")
      .update({ activa: !r.activa }).eq("id", r.id);
    if (error) { toast.error("No se pudo cambiar"); return; }
    toast.success(r.activa ? "Plantilla pausada" : "Plantilla activada");
    cargar();
  }

  async function borrar(r) {
    if (!canEdit) return;
    if (!confirm(`¿Eliminar plantilla "${r.tarea}"? Los pendientes ya generados se mantienen.`)) return;
    const { error } = await supabase.from("tareas_recurrentes").delete().eq("id", r.id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Plantilla eliminada");
    cargar();
  }

  async function regenerarHoy() {
    if (!canEdit) return;
    setRegenerando(true);
    const { data, error } = await supabase.rpc("generar_pendientes_recurrentes");
    setRegenerando(false);
    if (error) { toast.error("Error: " + error.message); return; }
    const n = data || 0;
    toast.success(n > 0 ? `${n} tarea${n !== 1 ? "s" : ""} generada${n !== 1 ? "s" : ""}` : "Ya están todas generadas para hoy");
    if (onChanged) onChanged();
    cargar();
  }

  // Filtrar por tab de persona
  const responsablesDe = (r) => {
    if (Array.isArray(r.responsables) && r.responsables.length > 0) return r.responsables;
    if (r.responsable) return [r.responsable];
    return [];
  };
  const recsFiltradas = useMemo(() => {
    if (tabResp === 'todos') return recs;
    if (tabResp === 'mios') return recs.filter((r) => responsablesDe(r).includes(yoId));
    return recs.filter((r) => responsablesDe(r).includes(tabResp));
  }, [recs, tabResp, yoId]);

  const activas = useMemo(() => recsFiltradas.filter((r) => r.activa), [recsFiltradas]);
  const pausadas = useMemo(() => recsFiltradas.filter((r) => !r.activa), [recsFiltradas]);

  // Tabs dinámicos por persona interna
  const otrosInternos = (internos || []).filter((p) => p.user_id !== yoId);
  const tabs = [
    { id: 'mios', label: perfil?.nombre?.split(' ')[0] || 'Míos', userId: yoId,
      count: recs.filter((r) => responsablesDe(r).includes(yoId) && r.activa).length },
    ...otrosInternos.map((u) => ({
      id: u.user_id,
      label: (u.nombre || u.email || '—').split(' ')[0],
      userId: u.user_id,
      count: recs.filter((r) => responsablesDe(r).includes(u.user_id) && r.activa).length,
    })),
    { id: 'todos', label: 'Todos', userId: null,
      count: recs.filter((r) => r.activa).length },
  ];

  if (loading) return <div className="p-6 text-gray-400 text-sm">Cargando plantillas…</div>;

  return (
    <div className="space-y-4">
      {/* Tabs por persona */}
      <div className="bg-white rounded-xl border border-gray-100 px-3 py-2">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 overflow-x-auto max-w-full w-fit">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => setTabResp(t.id)}
              className={[
                "px-3 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap",
                tabResp === t.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}>
              <div className="flex items-center gap-1.5">
                {t.userId && (
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPorUserId?.[t.userId] || "#94A3B8" }} />
                )}
                <span>{t.label}</span>
                {t.count > 0 && (
                  <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">
                    {t.count}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 px-4 py-3 flex items-center gap-3 flex-wrap">
        <Repeat className="w-5 h-5 text-blue-600" />
        <div className="flex-1 text-sm">
          <div className="font-semibold text-gray-800">Tareas recurrentes</div>
          <div className="text-xs text-gray-500">
            Plantillas que se generan automáticamente. {activas.length} activa{activas.length !== 1 ? "s" : ""} · {pausadas.length} pausada{pausadas.length !== 1 ? "s" : ""}.
          </div>
        </div>
        {canEdit && (
          <>
            <button
              onClick={regenerarHoy}
              disabled={regenerando}
              className="px-3 py-1.5 rounded-lg bg-white border border-gray-200 hover:bg-gray-50 text-sm text-gray-700 flex items-center gap-1.5 disabled:opacity-50"
              title="Ejecuta generar_pendientes_recurrentes() para hoy"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerando ? "animate-spin" : ""}`} />
              {regenerando ? "Generando…" : "Generar hoy"}
            </button>
            <button
              onClick={() => setModal({ nueva: true })}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Nueva plantilla
            </button>
          </>
        )}
      </div>

      {recs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <Repeat className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            Aún no tienes plantillas recurrentes.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Ejemplo: "Enviar reporte semanal al equipo" cada viernes, responsable tú, prioridad media.
          </p>
        </div>
      ) : (
        <>
          {activas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-500 px-1">Activas</h3>
              {activas.map((r) => (
                <RecurrenteCard
                  key={r.id} r={r} canEdit={canEdit}
                  nombrePorUserId={nombrePorUserId} colorPorUserId={colorPorUserId}
                  ejecuciones={ejecucionesPorRec[r.id] || []}
                  onMarcarEjecutada={() => marcarEjecutadaHoy(r)}
                  onEditar={() => setModal({ rec: r })}
                  onToggle={() => toggleActiva(r)}
                  onBorrar={() => borrar(r)}
                />
              ))}
            </div>
          )}
          {pausadas.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-xs uppercase tracking-wider font-semibold text-gray-400 px-1">Pausadas</h3>
              {pausadas.map((r) => (
                <RecurrenteCard
                  key={r.id} r={r} canEdit={canEdit}
                  nombrePorUserId={nombrePorUserId} colorPorUserId={colorPorUserId}
                  ejecuciones={ejecucionesPorRec[r.id] || []}
                  onMarcarEjecutada={() => marcarEjecutadaHoy(r)}
                  onEditar={() => setModal({ rec: r })}
                  onToggle={() => toggleActiva(r)}
                  onBorrar={() => borrar(r)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {modal && (
        <ModalRecurrente
          data={modal}
          perfiles={perfiles}
          onClose={() => setModal(null)}
          onGuardado={() => { cargar(); setModal(null); }}
        />
      )}
    </div>
  );
}

// ────────── Descripción humana de la frecuencia ──────────
function describirFrecuencia(r) {
  if (r.frecuencia === "diaria") return "Cada día";
  if (r.frecuencia === "semanal") {
    const dias = (r.dias_semana || []).sort((a, b) => a - b).map((n) => DIAS_LARGO[n - 1]).join(", ");
    return dias ? `Semanal: ${dias}` : "Semanal";
  }
  if (r.frecuencia === "mensual") {
    if (r.dia_mes === -1) return "Mensual: último día";
    if (r.dia_mes) return `Mensual: día ${r.dia_mes}`;
    return "Mensual";
  }
  return r.frecuencia;
}

// ────────── Card ──────────
function RecurrenteCard({ r, canEdit, nombrePorUserId, colorPorUserId, ejecuciones = [], onMarcarEjecutada, onEditar, onToggle, onBorrar }) {
  const [histOpen, setHistOpen] = useState(false);
  const cuenta = CUENTAS.find((c) => c.id === r.cuenta) || CUENTAS[3];
  const pri = PRIORIDADES.find((p) => p.id === r.prioridad) || PRIORIDADES[1];
  const responsables = Array.isArray(r.responsables) && r.responsables.length > 0
    ? r.responsables : (r.responsable ? [r.responsable] : []);
  const subs = Array.isArray(r.subtareas_plantilla) ? r.subtareas_plantilla : [];

  return (
    <div
      className={[
        "bg-white rounded-xl border border-gray-100 px-4 py-3",
        !r.activa && "opacity-60",
      ].filter(Boolean).join(" ")}
      style={{ borderLeft: `4px solid ${cuenta.stripe}` }}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
              style={{ backgroundColor: `${cuenta.stripe}22`, color: cuenta.stripe }}>
              {cuenta.label}
            </span>
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded inline-flex items-center gap-1 ${pri.bg} ${pri.text}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pri.dot }} />
              {pri.label}
            </span>
            <span className="text-[11px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {describirFrecuencia(r)}
            </span>
            {r.categoria && (
              <span className="text-[11px] text-gray-500">· {r.categoria}</span>
            )}
          </div>
          <div className="font-semibold text-gray-800 mt-1">{r.tarea}</div>
          <div className="flex items-center gap-3 text-xs text-gray-500 mt-1 flex-wrap">
            {responsables.length > 0 ? (
              <span className="inline-flex items-center gap-1.5">
                <Users className="w-3 h-3" />
                {responsables.map((u) => (
                  <span key={u} className="inline-flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPorUserId[u] || "#94A3B8" }} />
                    {nombrePorUserId[u]?.split(" ")[0] || "—"}
                  </span>
                ))}
              </span>
            ) : (
              <span className="italic">Sin responsable</span>
            )}
            {subs.length > 0 && <span>· {subs.length} subtarea{subs.length !== 1 ? "s" : ""}</span>}
            {r.offset_dias > 0 && <span>· +{r.offset_dias}d desfase</span>}
            {r.ultima_generacion && (
              <span className="text-gray-400">Últ: {r.ultima_generacion.slice(0, 10)}</span>
            )}
          </div>
        </div>

        {/* Botón marcar ejecutada (compacto, prominente) */}
        {canEdit && r.activa && (() => {
          const hoyISO = new Date().toISOString().slice(0, 10);
          const yaHoy = ejecuciones.some((e) => e.fecha_generado?.slice(0, 10) === hoyISO && e.estatus === "listo");
          return (
            <button
              onClick={onMarcarEjecutada}
              className={[
                "shrink-0 px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition",
                yaHoy
                  ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm",
              ].join(" ")}
              title={yaHoy ? "Ya marcada como ejecutada hoy" : "Marcar como ejecutada hoy"}
            >
              {yaHoy ? <CheckCircle2 className="w-4 h-4" /> : <Check className="w-4 h-4" />}
              {yaHoy ? "Hecha hoy" : "Marcar hecha"}
            </button>
          );
        })()}

        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onToggle}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500"
              title={r.activa ? "Pausar" : "Activar"}>
              {r.activa ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5 text-emerald-600" />}
            </button>
            <button onClick={onEditar}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            <button onClick={onBorrar}
              className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Eliminar">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Histórico de ejecuciones (colapsable) */}
      {ejecuciones.length > 0 && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <button
            onClick={() => setHistOpen(!histOpen)}
            className="text-xs text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
          >
            {histOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <History className="w-3 h-3" />
            <span className="font-medium">
              {ejecuciones.filter((e) => e.estatus === "listo").length} ejecución{ejecuciones.filter((e) => e.estatus === "listo").length !== 1 ? "es" : ""} registrada{ejecuciones.filter((e) => e.estatus === "listo").length !== 1 ? "s" : ""}
            </span>
            {ejecuciones.filter((e) => e.estatus === "listo").length > 0 && (
              <span className="text-gray-400">
                · última: {ejecuciones.find((e) => e.estatus === "listo")?.fecha_generado?.slice(0, 10) || "—"}
              </span>
            )}
          </button>

          {histOpen && (
            <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
              {ejecuciones.slice(0, 30).map((e) => {
                const fecha = e.fecha_generado?.slice(0, 10) || "—";
                const completada = e.completado_en
                  ? new Date(e.completado_en).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })
                  : null;
                return (
                  <div key={e.id} className="flex items-center gap-2 text-[11px]">
                    <span className={[
                      "w-2 h-2 rounded-full shrink-0",
                      e.estatus === "listo" ? "bg-emerald-500" : "bg-gray-300",
                    ].join(" ")} />
                    <span className="text-gray-700 tabular-nums">{fecha}</span>
                    <span className={[
                      "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                      e.estatus === "listo" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500",
                    ].join(" ")}>
                      {e.estatus === "listo" ? "Hecha" : e.estatus}
                    </span>
                    {completada && (
                      <span className="text-gray-400 text-[10px]">{completada}</span>
                    )}
                  </div>
                );
              })}
              {ejecuciones.length > 30 && (
                <div className="text-[10px] text-gray-400 italic">+{ejecuciones.length - 30} más…</div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ────────── Modal ──────────
function ModalRecurrente({ data, perfiles, onClose, onGuardado }) {
  const perfil = usePerfil();
  const esNueva = !!data.nueva;
  const original = data.rec || {};

  const [form, setForm] = useState(() => ({
    tarea:              original.tarea || "",
    cuenta:             original.cuenta || "otro",
    categoria:          original.categoria || "Recurrente",
    prioridad:          original.prioridad || "media",
    notas:              original.notas || "",
    responsables:       Array.isArray(original.responsables) && original.responsables.length > 0
                          ? original.responsables
                          : original.responsable ? [original.responsable]
                          : perfil?.user_id ? [perfil.user_id] : [],
    frecuencia:         original.frecuencia || "semanal",
    dias_semana:        Array.isArray(original.dias_semana) ? original.dias_semana : [],
    dia_mes:            original.dia_mes ?? null,
    offset_dias:        original.offset_dias ?? 0,
    activa:             original.activa !== false,
    subtareas_plantilla: Array.isArray(original.subtareas_plantilla) ? original.subtareas_plantilla : [],
  }));
  const [guardando, setGuardando] = useState(false);
  const [nuevaSub, setNuevaSub] = useState("");

  const toggleResp = (uid) => setForm((f) => ({
    ...f,
    responsables: f.responsables.includes(uid)
      ? f.responsables.filter((u) => u !== uid)
      : [...f.responsables, uid],
  }));
  const toggleDia = (n) => setForm((f) => ({
    ...f,
    dias_semana: f.dias_semana.includes(n)
      ? f.dias_semana.filter((d) => d !== n)
      : [...f.dias_semana, n],
  }));

  const agregarSub = () => {
    const txt = nuevaSub.trim();
    if (!txt) return;
    setForm((f) => ({
      ...f,
      subtareas_plantilla: [...f.subtareas_plantilla, { id: Math.random().toString(36).slice(2, 10), texto: txt, hecho: false }],
    }));
    setNuevaSub("");
  };
  const quitarSub = (id) => setForm((f) => ({ ...f, subtareas_plantilla: f.subtareas_plantilla.filter((s) => s.id !== id) }));

  async function guardar() {
    if (!form.tarea.trim()) return toast.error("Escribe la tarea");
    if (form.frecuencia === "semanal" && form.dias_semana.length === 0) {
      return toast.error("Elige al menos un día de la semana");
    }
    if (form.frecuencia === "mensual" && (form.dia_mes === null || form.dia_mes === undefined)) {
      return toast.error("Elige el día del mes");
    }

    setGuardando(true);
    const payload = {
      tarea: form.tarea.trim(),
      cuenta: form.cuenta,
      categoria: form.categoria.trim() || null,
      prioridad: form.prioridad,
      notas: form.notas.trim() || null,
      responsable: form.responsables[0] || null,
      responsables: form.responsables,
      frecuencia: form.frecuencia,
      dias_semana: form.frecuencia === "semanal" ? form.dias_semana : [],
      dia_mes: form.frecuencia === "mensual" ? form.dia_mes : null,
      offset_dias: parseInt(form.offset_dias, 10) || 0,
      activa: form.activa,
      subtareas_plantilla: form.subtareas_plantilla,
    };

    let err;
    if (esNueva) {
      payload.creado_por = perfil?.user_id || null;
      ({ error: err } = await supabase.from("tareas_recurrentes").insert(payload));
    } else {
      ({ error: err } = await supabase.from("tareas_recurrentes").update(payload).eq("id", original.id));
    }
    setGuardando(false);
    if (err) return toast.error("No se pudo guardar: " + err.message);
    toast.success(esNueva ? "Plantilla creada" : "Plantilla actualizada");
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <Repeat className="w-4 h-4" />
            {esNueva ? "Nueva plantilla recurrente" : "Editar plantilla"}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-3">
          <Field label="Descripción de la tarea">
            <input
              value={form.tarea}
              onChange={(e) => setForm({ ...form, tarea: e.target.value })}
              placeholder="Ej. Enviar reporte semanal al equipo"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              autoFocus
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Cuenta">
              <select value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {CUENTAS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </select>
            </Field>
            <Field label="Categoría">
              <input value={form.categoria}
                onChange={(e) => setForm({ ...form, categoria: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
          </div>

          <Field label="Prioridad">
            <div className="flex gap-1">
              {PRIORIDADES.map((p) => (
                <button key={p.id} type="button"
                  onClick={() => setForm({ ...form, prioridad: p.id })}
                  className={[
                    "flex-1 px-2 py-1.5 rounded-lg border text-xs font-medium flex items-center justify-center gap-1 transition",
                    form.prioridad === p.id
                      ? `${p.bg} ${p.text} border-transparent ring-2 ring-offset-1 ring-blue-300`
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                  ].join(" ")}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: p.dot }} />
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Frecuencia */}
          <Field label="Frecuencia">
            <div className="flex gap-2 mb-2">
              {[
                { id: "diaria",  label: "Diaria" },
                { id: "semanal", label: "Semanal" },
                { id: "mensual", label: "Mensual" },
              ].map((f) => (
                <button key={f.id} type="button"
                  onClick={() => setForm({ ...form, frecuencia: f.id })}
                  className={[
                    "flex-1 px-3 py-2 rounded-lg border text-sm font-medium transition",
                    form.frecuencia === f.id
                      ? "bg-blue-50 border-blue-500 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                  ].join(" ")}>
                  {f.label}
                </button>
              ))}
            </div>

            {form.frecuencia === "semanal" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Días en que se genera:</p>
                <div className="flex gap-1">
                  {DIAS_ISO.map((d) => {
                    const activo = form.dias_semana.includes(d.n);
                    return (
                      <button key={d.n} type="button" onClick={() => toggleDia(d.n)}
                        className={[
                          "w-9 h-9 rounded-lg border text-sm font-bold transition",
                          activo
                            ? "bg-blue-600 border-blue-600 text-white"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50",
                        ].join(" ")}>
                        {d.lbl}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {form.frecuencia === "mensual" && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Día del mes:</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1} max={31}
                    value={form.dia_mes > 0 ? form.dia_mes : ""}
                    onChange={(e) => setForm({ ...form, dia_mes: parseInt(e.target.value, 10) || null })}
                    placeholder="1-31"
                    className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    disabled={form.dia_mes === -1}
                  />
                  <label className="flex items-center gap-1.5 text-sm text-gray-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.dia_mes === -1}
                      onChange={(e) => setForm({ ...form, dia_mes: e.target.checked ? -1 : null })}
                    />
                    Último día del mes
                  </label>
                </div>
              </div>
            )}
          </Field>

          {/* Offset */}
          <Field label={
            <span className="flex items-center gap-1">
              Desfase (opcional)
              <span className="text-[10px] text-gray-400 font-normal">
                días entre generación y fecha límite
              </span>
            </span>
          }>
            <input
              type="number"
              min={0} max={14}
              value={form.offset_dias}
              onChange={(e) => setForm({ ...form, offset_dias: e.target.value })}
              className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-sm"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">
              Ej. si generas el lunes pero la tarea vence el martes, pon 1.
            </p>
          </Field>

          {/* Responsables */}
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
                    ].join(" ")}>
                    {(p.nombre || p.email)}
                    {!esInterno && <span className="ml-1 text-[9px] opacity-70">(ext)</span>}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Subtareas plantilla */}
          <Field label="Subtareas (plantilla)">
            <div className="space-y-1.5">
              {form.subtareas_plantilla.map((s) => (
                <div key={s.id} className="flex items-center gap-2 group">
                  <span className="w-4 h-4 rounded border-2 border-gray-300" />
                  <span className="flex-1 text-sm text-gray-700">{s.texto}</span>
                  <button type="button" onClick={() => quitarSub(s.id)}
                    className="p-1 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <div className="flex items-center gap-2">
                <input
                  value={nuevaSub}
                  onChange={(e) => setNuevaSub(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarSub(); } }}
                  className="flex-1 px-2 py-1 rounded border border-dashed border-gray-300 text-sm"
                  placeholder="+ Subtarea plantilla (Enter)"
                />
                <button type="button" onClick={agregarSub}
                  className="px-2.5 py-1 text-xs rounded bg-gray-100 hover:bg-gray-200 text-gray-700">
                  Añadir
                </button>
              </div>
            </div>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" rows={2} placeholder="Opcional" />
          </Field>

          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={form.activa}
              onChange={(e) => setForm({ ...form, activa: e.target.checked })}
              className="rounded border-gray-300"
            />
            Plantilla activa (genera pendientes automáticamente)
          </label>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={guardando}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
            {guardando ? "Guardando…" : "Guardar"}
          </button>
        </div>
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
