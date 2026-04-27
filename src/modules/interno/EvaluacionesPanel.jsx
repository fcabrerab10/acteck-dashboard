import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { puedeEditarPestanaGlobal } from "../../lib/permisos";
import { toast } from "../../lib/toast";
import { formatMXN } from "../../lib/utils";
import {
  Award, Plus, Star, X, Edit3, Trash2, Calendar, ChevronDown, ChevronUp,
  TrendingUp, CheckCircle2, AlertCircle, Sparkles, Lightbulb, FileText,
  Save, RefreshCw, Lock, Users,
} from "lucide-react";

/**
 * EvaluacionesPanel — Sprint Equipo
 * ─────────────────────────────────────────────────────────────
 * Eval semanal (lun-vie) de 100 pts en 7 secciones:
 *   I  ML operativo (30)  ·  II Marketing (20)  ·  III Recurrentes auto (10)
 *   IV DGL (8)  ·  V PCEL (8)  ·  VI Soft skills (9)  ·  VII Propuestas (15)
 *
 * Score final = base × 0.8 + bonus extras (eventos, propuestas implementadas, cursos, etc.)
 * Bono mensual: <80% proporcional ($37.5/pt) · ≥80% $3000 + $50/pt adicional.
 *
 * Sólo super_admin (Fernando) edita. Karolina ve la suya read-only.
 */

const SECCIONES = [
  { id: "mercadolibre",    label: "Mercado Libre",            pts: 30, color: "#F59E0B" },
  { id: "marketing_dgl",   label: "Plan de Marketing Digitalife", pts: 15, color: "#3B82F6", auto: true },
  { id: "marketing_pcel",  label: "Plan de Marketing PCEL",   pts: 15, color: "#EF4444", auto: true },
  { id: "recurrentes",     label: "Tareas recurrentes",       pts: 8,  color: "#10B981", auto: true },
  { id: "tareas_dia",      label: "Tareas día a día",         pts: 7,  color: "#8B5CF6", auto: true },
  { id: "softskills",      label: "Soft skills",              pts: 10, color: "#14B8A6" },
  { id: "propuestas",      label: "Propuestas de mejora",     pts: 15, color: "#EC4899" },
];

// Helper: convierte un % de cumplimiento a calificación 1-5
function pctACalificacion(pct) {
  if (pct == null) return null;
  if (pct >= 95) return 5;
  if (pct >= 80) return 4;
  if (pct >= 60) return 3;
  if (pct >= 40) return 2;
  return 1;
}

const ESTATUS_PROP = {
  propuesta:     { label: "Propuesta",     bg: "bg-slate-100", text: "text-slate-700" },
  en_revision:   { label: "En revisión",   bg: "bg-blue-100",  text: "text-blue-700"  },
  aprobada:      { label: "Aprobada",      bg: "bg-amber-100", text: "text-amber-700" },
  rechazada:     { label: "Rechazada",     bg: "bg-gray-100",  text: "text-gray-600"  },
  implementada:  { label: "Implementada",  bg: "bg-green-100", text: "text-green-700" },
};

// ────────── Helpers de fecha ──────────
function lunesDeSemana(d) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x;
}
function viernesDeSemana(lunes) {
  const v = new Date(lunes);
  v.setDate(v.getDate() + 4);
  return v;
}
function toISO(d) {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, "0"), dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function fmtFechaCorta(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d} ${["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"][m - 1]} ${String(y).slice(2)}`;
}
function semanaISO(d) {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  return Math.ceil(((date - yearStart) / 86400000 + 1) / 7);
}

const colorScore = (s) => {
  if (s == null) return "#94A3B8";
  if (s >= 80) return "#10B981";
  if (s >= 60) return "#F59E0B";
  return "#EF4444";
};

// ────────── Componente principal ──────────
export default function EvaluacionesPanel() {
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaGlobal(perfil, "evaluaciones");
  const [internos, setInternos] = useState([]);
  const [personaActiva, setPersonaActiva] = useState(null);
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vistaActual, setVistaActual] = useState("evaluaciones"); // evaluaciones | propuestas | eventos
  const [modal, setModal] = useState(null);

  // Cargar perfiles internos
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("perfiles")
        .select("user_id, nombre, email, puesto, tipo, es_super_admin")
        .eq("activo", true);
      const list = (data || []).filter((p) => p.tipo === "interno" || p.es_super_admin);
      setInternos(list);
      // Si es super_admin: por default mostrar primer interno NO super_admin (Karolina)
      // Si es persona normal: mostrar la suya
      if (canEdit) {
        const target = list.find((p) => !p.es_super_admin) || list[0];
        if (target) setPersonaActiva(target.user_id);
      } else {
        setPersonaActiva(perfil?.user_id);
      }
    })();
  }, [perfil?.user_id, canEdit]);

  const cargarEvaluaciones = async (uid) => {
    if (!uid) return;
    setLoading(true);
    const { data } = await supabase
      .from("evaluaciones")
      .select("*")
      .eq("persona_user_id", uid)
      .order("semana_inicio", { ascending: false });
    setEvaluaciones(data || []);
    setLoading(false);
  };

  useEffect(() => { cargarEvaluaciones(personaActiva); }, [personaActiva]);

  const personaInfo = useMemo(() => internos.find((p) => p.user_id === personaActiva), [internos, personaActiva]);

  // Score mensual = promedio de los 4 viernes del mes natural
  // Resumen mensual: el bono se calcula como
  //   score_mensual = (promedio_base_semanal × 0.8) + SUMA_bonus_del_mes
  //   bono = mapping(score_mensual)
  // Esto asegura que bonus extras (eventos, propuestas) NO se diluyan al promediar.
  const resumenMensual = useMemo(() => {
    const m = {};
    evaluaciones.forEach((e) => {
      const k = `${e.anio}-${String(e.mes).padStart(2, "0")}`;
      if (!m[k]) m[k] = { anio: e.anio, mes: e.mes, evals: [], promedio: 0, bono: 0, sumaBonus: 0, promedioBase: 0 };
      m[k].evals.push(e);
    });
    Object.values(m).forEach((row) => {
      const cerradas = row.evals.filter((e) => e.estado === "cerrada");
      if (cerradas.length === 0) {
        row.promedio = null; row.bono = 0; row.sumaBonus = 0; row.promedioBase = null;
        return;
      }
      const sumBase  = cerradas.reduce((a, e) => a + Number(e.score_base || 0), 0);
      const sumBonus = cerradas.reduce((a, e) => a + Number(e.bonus_pts || 0), 0);
      const promedioBase = sumBase / cerradas.length;
      const scoreMensual = promedioBase * 0.8 + sumBonus;
      row.promedio = scoreMensual;
      row.promedioBase = promedioBase;
      row.sumaBonus = sumBonus;
      row.bono = scoreMensual < 80
        ? Math.round(scoreMensual * 37.5)
        : Math.round(3000 + (scoreMensual - 80) * 50);
    });
    return Object.values(m).sort((a, b) => `${b.anio}-${b.mes}`.localeCompare(`${a.anio}-${a.mes}`));
  }, [evaluaciones]);

  async function crearEvalEnFecha(fechaCualquiera) {
    if (!canEdit || !personaActiva) return;
    const lunes = lunesDeSemana(fechaCualquiera);
    const viernes = viernesDeSemana(lunes);
    const exists = evaluaciones.find((e) => e.semana_inicio?.slice(0, 10) === toISO(lunes));
    if (exists) {
      toast.success("Ya existe una evaluación de esa semana, abriéndola");
      setModal({ evalId: exists.id });
      return;
    }
    const payload = {
      persona_user_id: personaActiva,
      semana_inicio: toISO(lunes),
      semana_fin: toISO(viernes),
      anio: lunes.getFullYear(),
      mes: lunes.getMonth() + 1,
      semana_iso: semanaISO(lunes),
      estado: "draft",
      creado_por: perfil?.user_id,
    };
    const { data, error } = await supabase.from("evaluaciones").insert(payload).select().single();
    if (error) { toast.error("Error: " + error.message); return; }

    const { data: kpis } = await supabase.from("evaluaciones_kpis_template")
      .select("id, peso").eq("activo", true);
    if (kpis?.length) {
      await supabase.from("evaluacion_lineas").insert(
        kpis.map((k) => ({ evaluacion_id: data.id, kpi_id: k.id, peso_aplicado: k.peso }))
      );
    }
    toast.success("Evaluación creada");
    cargarEvaluaciones(personaActiva);
    setModal({ evalId: data.id });
  }

  function abrirSelectorSemana() {
    if (!canEdit || !personaActiva) return;
    setModal({ tipo: "selectorSemana" });
  }

  async function borrarEval(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta evaluación? No se puede deshacer.")) return;
    await supabase.from("evaluaciones").delete().eq("id", id);
    cargarEvaluaciones(personaActiva);
  }

  return (
    <div className="space-y-5 p-5">
      {/* HEADER */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Award className="w-6 h-6 text-gray-700" />
            Evaluaciones de desempeño
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Eval semanal · Score final = base × 0.8 + bonus · Bono mensual desde 80%
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && internos.length > 1 && (
            <select
              value={personaActiva || ""}
              onChange={(e) => setPersonaActiva(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 bg-white"
            >
              {internos.map((p) => (
                <option key={p.user_id} value={p.user_id}>
                  {p.nombre || p.email}{p.es_super_admin ? " (admin)" : ""}
                </option>
              ))}
            </select>
          )}
          {!canEdit && (
            <span className="text-xs text-gray-500 flex items-center gap-1">
              <Lock className="w-3 h-3" /> Solo lectura
            </span>
          )}
        </div>
      </div>

      {/* Persona activa */}
      {personaInfo && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100 rounded-xl px-4 py-3 flex items-center justify-between flex-wrap gap-3">
          <div>
            <div className="font-semibold text-gray-800">{personaInfo.nombre}</div>
            <div className="text-xs text-gray-600">{personaInfo.puesto || personaInfo.email}</div>
          </div>
          {canEdit && (
            <button onClick={abrirSelectorSemana}
              className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Nueva evaluación
            </button>
          )}
        </div>
      )}

      {/* TABS */}
      <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { id: "evaluaciones", label: "Evaluaciones", icon: Award },
          { id: "propuestas",   label: "Propuestas",   icon: Lightbulb },
          { id: "eventos",      label: "Eventos",      icon: Calendar },
        ].map((t) => {
          const Icon = t.icon;
          return (
            <button key={t.id} onClick={() => setVistaActual(t.id)}
              className={[
                "px-3 py-1.5 rounded-md text-sm font-medium transition flex items-center gap-1.5",
                vistaActual === t.id ? "bg-white text-blue-700 shadow-sm" : "text-gray-600 hover:text-gray-900",
              ].join(" ")}
            >
              <Icon className="w-3.5 h-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* CONTENIDO */}
      {vistaActual === "evaluaciones" && (
        <ListaEvaluaciones
          evaluaciones={evaluaciones}
          resumenMensual={resumenMensual}
          loading={loading}
          canEdit={canEdit}
          onAbrir={(id) => setModal({ evalId: id })}
          onBorrar={borrarEval}
        />
      )}
      {vistaActual === "propuestas" && (
        <PropuestasView personaActiva={personaActiva} canEdit={canEdit} esPropia={!canEdit} />
      )}
      {vistaActual === "eventos" && (
        <EventosView personaActiva={personaActiva} canEdit={canEdit} />
      )}

      {/* MODAL EVAL */}
      {modal?.evalId && (
        <ModalEvaluacion
          evalId={modal.evalId}
          canEdit={canEdit}
          personaActiva={personaActiva}
          onClose={() => { setModal(null); cargarEvaluaciones(personaActiva); }}
        />
      )}

      {/* MODAL SELECTOR DE SEMANA */}
      {modal?.tipo === "selectorSemana" && (
        <ModalSelectorSemana
          evaluaciones={evaluaciones}
          onClose={() => setModal(null)}
          onElegir={(fecha) => { setModal(null); crearEvalEnFecha(fecha); }}
        />
      )}
    </div>
  );
}

// ────────── Modal: selector de semana ──────────
function ModalSelectorSemana({ evaluaciones, onClose, onElegir }) {
  const [fecha, setFecha] = useState(toISO(new Date()));
  const lunes = lunesDeSemana(new Date(fecha + "T00:00:00"));
  const viernes = viernesDeSemana(lunes);
  const yaExiste = evaluaciones.some((e) => e.semana_inicio?.slice(0, 10) === toISO(lunes));

  // Sugerencias rápidas: esta semana, semana pasada, hace 2 semanas
  const sugerencias = [];
  for (let i = 0; i < 4; i++) {
    const d = new Date(); d.setDate(d.getDate() - i * 7);
    const l = lunesDeSemana(d);
    sugerencias.push({
      label: i === 0 ? "Esta semana" : i === 1 ? "Semana pasada" : `Hace ${i} semanas`,
      iso: toISO(l),
      lunes: l,
      viernes: viernesDeSemana(l),
      existe: evaluaciones.some((e) => e.semana_inicio?.slice(0, 10) === toISO(l)),
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" /> Elegir semana a evaluar</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Sugerencias rápidas */}
          <div>
            <div className="text-xs font-medium text-gray-600 mb-2">Atajos:</div>
            <div className="grid grid-cols-2 gap-2">
              {sugerencias.map((s) => (
                <button key={s.iso}
                  onClick={() => onElegir(s.lunes)}
                  disabled={s.existe}
                  className={[
                    "px-3 py-2 rounded-lg border text-left transition",
                    s.existe ? "bg-gray-50 border-gray-200 text-gray-400 cursor-not-allowed"
                             : "bg-white border-gray-200 hover:bg-blue-50 hover:border-blue-300",
                  ].join(" ")}>
                  <div className="text-sm font-medium">{s.label}</div>
                  <div className="text-[10px] text-gray-500">
                    {fmtFechaCorta(toISO(s.lunes))} - {fmtFechaCorta(toISO(s.viernes))}
                  </div>
                  {s.existe && <div className="text-[10px] text-amber-600 mt-0.5">Ya existe</div>}
                </button>
              ))}
            </div>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <Field label="O elige cualquier fecha (toma el lunes de esa semana)">
              <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <div className="text-xs text-gray-600 mt-2">
              Semana resultante: <strong>{fmtFechaCorta(toISO(lunes))}</strong> al <strong>{fmtFechaCorta(toISO(viernes))}</strong>
            </div>
            {yaExiste && (
              <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Ya existe una evaluación de esa semana. Al continuar se abrirá la existente.
              </div>
            )}
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          <button onClick={() => onElegir(lunes)}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            {yaExiste ? "Abrir existente" : "Crear evaluación"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── Lista evaluaciones + resumen mensual ──────────
function ListaEvaluaciones({ evaluaciones, resumenMensual, loading, canEdit, onAbrir, onBorrar }) {
  if (loading) return <div className="text-gray-400 text-sm p-6">Cargando…</div>;

  return (
    <div className="space-y-5">
      {/* Resumen mensual */}
      {resumenMensual.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center gap-2 flex-wrap">
            <TrendingUp className="w-4 h-4 text-gray-600" />
            <h3 className="font-semibold text-gray-800">Resumen mensual</h3>
            <span className="text-xs text-gray-500">Score = (Base prom × 0.8) + Suma de bonus del mes</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-600">
                <tr>
                  <th className="text-left px-4 py-2">Mes</th>
                  <th className="text-center px-3 py-2">Semanas</th>
                  <th className="text-right px-3 py-2">Base prom</th>
                  <th className="text-right px-3 py-2">Suma bonus</th>
                  <th className="text-right px-3 py-2">Score mensual</th>
                  <th className="text-right px-4 py-2">Bono</th>
                </tr>
              </thead>
              <tbody>
                {resumenMensual.map((r) => {
                  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
                  return (
                    <tr key={`${r.anio}-${r.mes}`} className="border-t border-gray-100">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{meses[r.mes - 1]} {r.anio}</td>
                      <td className="text-center px-3 py-2.5 text-gray-600">{r.evals.length}</td>
                      <td className="text-right px-3 py-2.5 text-gray-700 tabular-nums">
                        {r.promedioBase != null ? r.promedioBase.toFixed(1) : "—"}
                      </td>
                      <td className="text-right px-3 py-2.5 text-amber-700 font-semibold tabular-nums">
                        {r.promedioBase != null ? `+${r.sumaBonus.toFixed(1)}` : "—"}
                      </td>
                      <td className="text-right px-3 py-2.5 font-bold tabular-nums" style={{ color: colorScore(r.promedio) }}>
                        {r.promedio != null ? r.promedio.toFixed(1) : "—"}
                      </td>
                      <td className="text-right px-4 py-2.5 font-bold text-emerald-700 tabular-nums">
                        {r.promedio != null ? formatMXN(r.bono) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {/* Mini gráfica de evolución */}
          {resumenMensual.length >= 2 && (
            <div className="px-4 pb-4">
              <MiniChart data={[...resumenMensual].reverse()} />
            </div>
          )}
        </div>
      )}

      {/* Lista de evaluaciones semanales */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h3 className="font-semibold text-gray-800">Evaluaciones semanales</h3>
        </div>
        {evaluaciones.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Sin evaluaciones todavía.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {evaluaciones.map((e) => (
              <EvalRow key={e.id} eval_={e} canEdit={canEdit}
                onAbrir={() => onAbrir(e.id)}
                onBorrar={() => onBorrar(e.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EvalRow({ eval_, canEdit, onAbrir, onBorrar }) {
  const score = Number(eval_.score_final || 0);
  return (
    <div className="px-5 py-3 flex items-center gap-4 hover:bg-gray-50 cursor-pointer" onClick={onAbrir}>
      <div className="w-2 h-12 rounded-full" style={{ backgroundColor: eval_.estado === "cerrada" ? "#10B981" : "#94A3B8" }} />
      <div className="flex-1 min-w-0">
        <div className="font-medium text-gray-800">
          Semana del {fmtFechaCorta(eval_.semana_inicio)} al {fmtFechaCorta(eval_.semana_fin)}
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <span className={[
            "text-[10px] px-1.5 py-0.5 rounded font-semibold",
            eval_.estado === "cerrada" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
          ].join(" ")}>
            {eval_.estado === "cerrada" ? "Cerrada" : "Borrador"}
          </span>
          <span>Base {Number(eval_.score_base).toFixed(1)} + Bonus {Number(eval_.bonus_pts).toFixed(1)}</span>
        </div>
      </div>
      <div className="text-right">
        <div className="text-lg font-bold tabular-nums" style={{ color: colorScore(score) }}>
          {score.toFixed(1)}
        </div>
        <div className="text-[10px] text-gray-500">score semanal</div>
      </div>
      {canEdit && (
        <div className="flex items-center gap-1">
          <button onClick={(e) => { e.stopPropagation(); onAbrir(); }}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar">
            <Edit3 className="w-3.5 h-3.5" />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onBorrar(); }}
            className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Eliminar">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ────────── Mini gráfica SVG ──────────
function MiniChart({ data }) {
  const W = 700, H = 80;
  const padL = 40, padR = 16, padT = 10, padB = 24;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const max = Math.max(120, ...data.map((d) => d.promedio || 0));
  const xFor = (i) => padL + (i / Math.max(1, data.length - 1)) * innerW;
  const yFor = (v) => padT + innerH - ((v || 0) / max) * innerH;
  const path = data.filter((d) => d.promedio != null)
    .map((d, i, arr) => `${i === 0 ? "M" : "L"}${xFor(arr === data ? i : data.indexOf(d))},${yFor(d.promedio)}`).join(" ");
  const meses = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H}>
      {/* Línea de meta 80 */}
      <line x1={padL} y1={yFor(80)} x2={W - padR} y2={yFor(80)} stroke="#10B981" strokeDasharray="3 3" opacity={0.4} />
      <text x={padL - 4} y={yFor(80) + 3} fontSize="9" fill="#10B981" textAnchor="end">80</text>
      <path d={path} fill="none" stroke="#3B82F6" strokeWidth="2" />
      {data.map((d, i) => d.promedio != null && (
        <g key={i}>
          <circle cx={xFor(i)} cy={yFor(d.promedio)} r={3} fill="#3B82F6" />
          <text x={xFor(i)} y={H - padB + 14} fontSize="9" fill="#6B7280" textAnchor="middle">
            {meses[d.mes - 1]}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ────────── Modal de evaluación (calificar KPIs) ──────────
function ModalEvaluacion({ evalId, canEdit, personaActiva, onClose }) {
  const [evalData, setEvalData] = useState(null);
  const [lineas, setLineas] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [propuestas, setPropuestas] = useState([]);
  const [eventos, setEventos] = useState([]);
  const [bonusExtras, setBonusExtras] = useState([]);
  // Datos auto-calc: { recurrentes: {pct, ...}, tareas_dia: {...}, marketing_dgl: {...}, marketing_pcel: {...} }
  const [autoData, setAutoData] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingComment, setSavingComment] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const [evRes, lnRes, kpRes] = await Promise.all([
      supabase.from("evaluaciones").select("*").eq("id", evalId).single(),
      supabase.from("evaluacion_lineas").select("*").eq("evaluacion_id", evalId),
      supabase.from("evaluaciones_kpis_template").select("*").eq("activo", true).order("orden"),
    ]);
    setEvalData(evRes.data);
    setKpis(kpRes.data || []);

    if (evRes.data) {
      const inicio = evRes.data.semana_inicio;
      const fin    = evRes.data.semana_fin;

      // Propuestas en el rango
      const propRes = await supabase.from("propuestas_equipo")
        .select("*")
        .eq("persona_user_id", evRes.data.persona_user_id)
        .gte("fecha_propuesta", inicio).lte("fecha_propuesta", fin);
      setPropuestas(propRes.data || []);

      // Eventos vinculados a esta eval
      const evtRes = await supabase.from("eventos_cliente")
        .select("*").eq("evaluacion_id", evalId);
      setEventos(evtRes.data || []);

      // Bonus extras
      const bnRes = await supabase.from("evaluacion_bonus")
        .select("*").eq("evaluacion_id", evalId);
      setBonusExtras(bnRes.data || []);

      // ── Auto-calc para todas las secciones auto ──
      const [rcRes, tdRes, mkDglRes, mkPcelRes] = await Promise.all([
        supabase.rpc("cumplimiento_recurrentes", {
          p_user_id: evRes.data.persona_user_id, p_inicio: inicio, p_fin: fin,
        }),
        supabase.rpc("cumplimiento_pendientes_regulares", {
          p_user_id: evRes.data.persona_user_id, p_inicio: inicio, p_fin: fin,
        }),
        supabase.rpc("cumplimiento_marketing_cliente", {
          p_cliente: "digitalife", p_inicio: inicio, p_fin: fin,
        }),
        supabase.rpc("cumplimiento_marketing_cliente", {
          p_cliente: "pcel", p_inicio: inicio, p_fin: fin,
        }),
      ]);
      const auto = {
        recurrentes:    rcRes.data?.[0]    ? { pct: Number(rcRes.data[0].pct),    esperadas: rcRes.data[0].esperadas,    cumplidas: rcRes.data[0].cumplidas    } : null,
        tareas_dia:     tdRes.data?.[0]    ? { pct: Number(tdRes.data[0].pct),    esperadas: tdRes.data[0].esperadas,    cumplidas: tdRes.data[0].cumplidas    } : null,
        marketing_dgl:  mkDglRes.data?.[0] ? { pct: Number(mkDglRes.data[0].pct), totales:    mkDglRes.data[0].totales,  completadas: mkDglRes.data[0].completadas } : null,
        marketing_pcel: mkPcelRes.data?.[0]? { pct: Number(mkPcelRes.data[0].pct),totales:    mkPcelRes.data[0].totales, completadas: mkPcelRes.data[0].completadas } : null,
      };
      setAutoData(auto);

      // ── Aplicar automáticamente a las líneas auto que aún no tengan calificación ──
      const cerrada = evRes.data.estado === "cerrada";
      const kpisData = kpRes.data || [];
      const lineasData = [...(lnRes.data || [])];
      const sectionToAuto = {
        recurrentes:    auto.recurrentes,
        tareas_dia:     auto.tareas_dia,
        marketing_dgl:  auto.marketing_dgl,
        marketing_pcel: auto.marketing_pcel,
      };
      if (!cerrada) {
        const updates = [];
        for (const kpi of kpisData.filter((k) => k.auto_calc)) {
          const linea = lineasData.find((l) => l.kpi_id === kpi.id);
          if (!linea) continue;
          const auto_d = sectionToAuto[kpi.seccion];
          if (!auto_d || auto_d.pct == null) continue;
          const calNueva = pctACalificacion(auto_d.pct);
          // Solo aplica si la calificación actual está vacía (no pisa lo que el usuario haya cambiado)
          if (linea.calificacion == null && calNueva != null) {
            updates.push({ id: linea.id, cal: calNueva, sugerido: auto_d.pct });
          } else if (calNueva != null && linea.auto_sugerido !== auto_d.pct) {
            // Actualiza el sugerido aunque no pise calificacion
            updates.push({ id: linea.id, sugerido: auto_d.pct, soloSugerido: true });
          }
        }
        // Aplicar updates
        for (const u of updates) {
          if (u.soloSugerido) {
            await supabase.from("evaluacion_lineas").update({ auto_sugerido: u.sugerido }).eq("id", u.id);
            const idx = lineasData.findIndex((l) => l.id === u.id);
            if (idx >= 0) lineasData[idx] = { ...lineasData[idx], auto_sugerido: u.sugerido };
          } else {
            await supabase.from("evaluacion_lineas").update({ calificacion: u.cal, auto_sugerido: u.sugerido }).eq("id", u.id);
            const idx = lineasData.findIndex((l) => l.id === u.id);
            if (idx >= 0) {
              const peso = lineasData[idx].peso_aplicado;
              lineasData[idx] = { ...lineasData[idx], calificacion: u.cal, auto_sugerido: u.sugerido, puntaje: (u.cal / 5) * peso };
            }
          }
        }
      }
      setLineas(lineasData);
    }
    setLoading(false);
  };
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [evalId]);

  async function calificar(lineaId, calificacion) {
    if (!canEdit) return;
    setLineas((prev) => prev.map((l) => l.id === lineaId ? { ...l, calificacion } : l));
    await supabase.from("evaluacion_lineas").update({ calificacion }).eq("id", lineaId);
    // Refrescar score (trigger ya recalcula)
    setTimeout(refreshScore, 300);
  }

  async function refreshScore() {
    const { data } = await supabase.from("evaluaciones").select("*").eq("id", evalId).single();
    if (data) setEvalData(data);
  }

  async function comentarLinea(lineaId, comentarios) {
    if (!canEdit) return;
    setSavingComment(true);
    await supabase.from("evaluacion_lineas").update({ comentarios }).eq("id", lineaId);
    setSavingComment(false);
  }

  async function guardarTexto(campo, valor) {
    if (!canEdit) return;
    await supabase.from("evaluaciones").update({ [campo]: valor }).eq("id", evalId);
    setEvalData((prev) => ({ ...prev, [campo]: valor }));
  }

  async function cerrarEvaluacion() {
    if (!canEdit) return;
    if (!confirm("¿Cerrar esta evaluación? Después no se podrán cambiar las calificaciones.")) return;
    const score = Number(evalData.score_final || 0);
    const bono = score < 80 ? Math.round(score * 37.5) : Math.round(3000 + (score - 80) * 50);
    await supabase.from("evaluaciones")
      .update({ estado: "cerrada", bono_mxn: bono, cerrado_en: new Date().toISOString() })
      .eq("id", evalId);
    toast.success("Evaluación cerrada");
    onClose();
  }

  async function reabrirEvaluacion() {
    if (!canEdit) return;
    await supabase.from("evaluaciones")
      .update({ estado: "draft", cerrado_en: null })
      .eq("id", evalId);
    refreshScore();
    toast.success("Evaluación reabierta");
  }

  async function eliminarEvaluacion() {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta evaluación? Se borran todas sus calificaciones, bonus y eventos vinculados. No se puede deshacer.")) return;
    const { error } = await supabase.from("evaluaciones").delete().eq("id", evalId);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success("Evaluación eliminada");
    onClose();
  }

  if (loading || !evalData) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
        <div className="bg-white rounded-2xl p-8 text-gray-500">Cargando…</div>
      </div>
    );
  }

  const score = Number(evalData.score_final || 0);
  const bono = score < 80 ? Math.round(score * 37.5) : Math.round(3000 + (score - 80) * 50);
  const cerrada = evalData.estado === "cerrada";
  const editable = canEdit && !cerrada;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div>
            <h3 className="font-semibold text-gray-800 flex items-center gap-2">
              <Award className="w-5 h-5" />
              Evaluación · {fmtFechaCorta(evalData.semana_inicio)} al {fmtFechaCorta(evalData.semana_fin)}
            </h3>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
              <span className={[
                "text-[10px] px-1.5 py-0.5 rounded font-semibold",
                cerrada ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-600",
              ].join(" ")}>
                {cerrada ? "✓ Cerrada" : "Borrador"}
              </span>
              {!editable && <span className="text-[11px] flex items-center gap-1"><Lock className="w-3 h-3" /> Solo lectura</span>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ScoreCircle score={score} />
            <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Contenido */}
        <div className="p-6 space-y-5">
          {/* Resumen auto-calc aplicado automáticamente */}
          <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm">
            <Sparkles className="w-4 h-4 inline text-emerald-600 mr-1" />
            <strong className="text-emerald-900">Auto-aplicado al cargar</strong> (puedes ajustar manualmente):
            <ul className="mt-1 ml-5 text-xs text-emerald-800 space-y-0.5">
              {autoData.recurrentes && (
                <li>Recurrentes: <strong>{autoData.recurrentes.cumplidas}/{autoData.recurrentes.esperadas}</strong> ({autoData.recurrentes.pct ?? "—"}%)</li>
              )}
              {autoData.tareas_dia && (
                <li>Tareas día a día: <strong>{autoData.tareas_dia.cumplidas}/{autoData.tareas_dia.esperadas}</strong> ({autoData.tareas_dia.pct ?? "—"}%)</li>
              )}
              {autoData.marketing_dgl && (
                <li>Marketing Digitalife: <strong>{autoData.marketing_dgl.completadas}/{autoData.marketing_dgl.totales}</strong> ({autoData.marketing_dgl.pct ?? "—"}%)</li>
              )}
              {autoData.marketing_pcel && (
                <li>Marketing PCEL: <strong>{autoData.marketing_pcel.completadas}/{autoData.marketing_pcel.totales}</strong> ({autoData.marketing_pcel.pct ?? "—"}%)</li>
              )}
            </ul>
          </div>

          {/* Secciones de KPIs */}
          {SECCIONES.map((sec) => {
            const kpisSec = kpis.filter((k) => k.seccion === sec.id);
            const lineasSec = lineas.filter((l) => kpisSec.some((k) => k.id === l.kpi_id));
            const ptsObtenidos = lineasSec.reduce((a, l) => a + Number(l.puntaje || 0), 0);
            return (
              <SeccionKPIs
                key={sec.id}
                seccion={sec}
                kpis={kpisSec}
                lineas={lineasSec}
                ptsObtenidos={ptsObtenidos}
                propuestas={sec.id === "propuestas" ? propuestas : null}
                editable={editable}
                onCalificar={calificar}
                onComentar={comentarLinea}
              />
            );
          })}

          {/* Bonus extras */}
          <BonusSection
            evalId={evalId}
            eventos={eventos}
            bonusExtras={bonusExtras}
            propuestas={propuestas}
            editable={editable}
            personaActiva={personaActiva}
            onChanged={cargar}
          />

          {/* Retroalimentación */}
          <RetroSection
            evalData={evalData}
            editable={editable}
            onSave={guardarTexto}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
          <div className="text-sm text-gray-600">
            <strong className="text-gray-800">Score semanal:</strong> Base {Number(evalData.score_base).toFixed(1)} × 0.8 + Bonus {Number(evalData.bonus_pts).toFixed(1)} = <strong style={{ color: colorScore(score) }}>{score.toFixed(1)}</strong>
            <div className="text-[11px] text-gray-500 mt-0.5">
              El bono se calcula al final del mes con la suma de todas las semanas
            </div>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <button onClick={eliminarEvaluacion}
                className="px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 flex items-center gap-1.5"
                title="Eliminar evaluación">
                <Trash2 className="w-4 h-4" /> Eliminar
              </button>
            )}
            <button onClick={onClose}
              className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">
              Cerrar
            </button>
            {canEdit && cerrada && (
              <button onClick={reabrirEvaluacion}
                className="px-3 py-2 rounded-lg text-sm bg-amber-100 hover:bg-amber-200 text-amber-800">
                Reabrir
              </button>
            )}
            {canEdit && !cerrada && (
              <button onClick={cerrarEvaluacion}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4" /> Cerrar evaluación
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function ScoreCircle({ score }) {
  const color = colorScore(score);
  const pct = Math.min(100, score);
  return (
    <div className="flex items-center gap-3">
      <div className="w-14 h-14 rounded-full flex items-center justify-center"
        style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, #E5E7EB 0deg)` }}>
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center">
          <div className="text-center">
            <div className="text-sm font-bold" style={{ color }}>{score.toFixed(0)}</div>
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-[10px] text-gray-500 uppercase">Score sem</div>
        <div className="text-[10px] text-gray-500">contribuye al bono</div>
      </div>
    </div>
  );
}

function SeccionKPIs({ seccion, kpis, lineas, ptsObtenidos, propuestas, editable, onCalificar, onComentar }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden" style={{ borderLeft: `4px solid ${seccion.color}` }}>
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
        <div className="flex-1 text-left">
          <div className="font-semibold text-gray-800">{seccion.label}</div>
          <div className="text-xs text-gray-500">{kpis.length} KPI{kpis.length !== 1 ? "s" : ""} · máx {seccion.pts} pts {seccion.auto && "· Auto-calc disponible"}</div>
        </div>
        <div className="text-right">
          <div className="text-sm font-bold tabular-nums" style={{ color: seccion.color }}>
            {ptsObtenidos.toFixed(1)} / {seccion.pts}
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="border-t border-gray-100">
          {seccion.id === "propuestas" && (
            <div className="bg-pink-50/50 px-4 py-3 border-b border-pink-100 text-xs text-pink-900">
              <Lightbulb className="w-3.5 h-3.5 inline mr-1" />
              <strong>{propuestas?.length || 0} propuesta{propuestas?.length !== 1 ? "s" : ""}</strong> registrada{propuestas?.length !== 1 ? "s" : ""} en la semana.
              {propuestas?.length > 0 && (
                <ul className="mt-1 ml-5 list-disc space-y-0.5">
                  {propuestas.map((p) => (
                    <li key={p.id}>
                      <strong>{p.descripcion}</strong>{p.estatus !== "propuesta" && ` · ${ESTATUS_PROP[p.estatus]?.label}`}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          <div className="divide-y divide-gray-100">
            {kpis.map((kpi) => {
              const linea = lineas.find((l) => l.kpi_id === kpi.id);
              if (!linea) return null;
              return (
                <KpiRow key={kpi.id} kpi={kpi} linea={linea} editable={editable}
                  onCalificar={onCalificar} onComentar={onComentar} />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiRow({ kpi, linea, editable, onCalificar, onComentar }) {
  const [comments, setComments] = useState(linea.comentarios || "");
  return (
    <div className="px-4 py-3 hover:bg-gray-50/50">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium text-gray-800">{kpi.descripcion}</div>
          <div className="text-[10px] text-gray-500 mt-0.5">Peso: {kpi.peso} pts {kpi.auto_calc && "· Auto-calculable"}</div>
        </div>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n}
              onClick={() => editable && onCalificar(linea.id, n)}
              disabled={!editable}
              className={[
                "w-7 h-7 rounded-full text-xs font-bold transition",
                linea.calificacion === n
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-600",
                !editable && "opacity-60 cursor-not-allowed",
              ].join(" ")}
            >
              {n}
            </button>
          ))}
          <div className="ml-2 text-sm font-bold tabular-nums w-12 text-right" style={{ color: linea.calificacion >= 4 ? "#10B981" : linea.calificacion >= 3 ? "#F59E0B" : linea.calificacion ? "#EF4444" : "#94A3B8" }}>
            {Number(linea.puntaje || 0).toFixed(1)}
          </div>
        </div>
      </div>
      {(editable || comments) && (
        <input
          value={comments}
          onChange={(e) => setComments(e.target.value)}
          onBlur={() => onComentar(linea.id, comments)}
          disabled={!editable}
          placeholder={editable ? "Comentario (opcional)…" : ""}
          className="w-full mt-2 px-2 py-1 text-xs border border-gray-200 rounded bg-white"
        />
      )}
    </div>
  );
}

function BonusSection({ evalId, eventos, bonusExtras, propuestas, editable, personaActiva, onChanged }) {
  const [modal, setModal] = useState(null);

  const totalEventos = eventos.reduce((a, e) => a + Number(e.bonus_pts || 0), 0);
  const totalBonus = bonusExtras.reduce((a, b) => a + Number(b.puntos || 0), 0);
  const propsImplementadas = propuestas.filter((p) => p.estatus === "implementada");
  const totalProps = propsImplementadas.reduce((a, p) => a + Number(p.bonus_pts_aplicado || 0), 0);
  const total = totalEventos + totalBonus + totalProps;

  return (
    <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30" style={{ borderLeft: "4px solid #F59E0B" }}>
      <div className="px-4 py-3 flex items-center justify-between">
        <div>
          <div className="font-semibold text-gray-800 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-600" />
            Bonus extras
          </div>
          <div className="text-xs text-gray-500">Suman ENCIMA del 100. Eventos cubiertos, propuestas implementadas, cursos, reconocimientos.</div>
        </div>
        <div className="text-lg font-bold text-amber-700 tabular-nums">+{total.toFixed(1)} pts</div>
      </div>

      <div className="border-t border-amber-100 grid grid-cols-1 md:grid-cols-3 gap-3 p-4">
        {/* Eventos */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-amber-600" /> Eventos cubiertos</h4>
            {editable && (
              <button onClick={() => setModal({ type: "evento" })}
                className="text-xs text-amber-700 hover:text-amber-900 flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Agregar
              </button>
            )}
          </div>
          {eventos.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin eventos en esta semana</p>
          ) : (
            <div className="space-y-1.5">
              {eventos.map((e) => (
                <EventoCard key={e.id} evento={e} editable={editable} onChanged={onChanged} />
              ))}
            </div>
          )}
          <div className="text-xs text-amber-700 mt-2 font-semibold">Total: +{totalEventos.toFixed(1)}</div>
        </div>

        {/* Propuestas implementadas */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5"><Lightbulb className="w-3.5 h-3.5 text-pink-600" /> Propuestas implementadas</h4>
          </div>
          {propsImplementadas.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Ninguna esta semana</p>
          ) : (
            <div className="space-y-1.5">
              {propsImplementadas.map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="truncate flex-1">{p.descripcion}</span>
                  <span className="font-semibold text-pink-700 ml-2">+{Number(p.bonus_pts_aplicado || 0).toFixed(1)}</span>
                </div>
              ))}
            </div>
          )}
          <div className="text-xs text-pink-700 mt-2 font-semibold">Total: +{totalProps.toFixed(1)}</div>
        </div>

        {/* Otros bonus */}
        <div className="bg-white rounded-lg p-3 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm flex items-center gap-1.5"><Star className="w-3.5 h-3.5 text-blue-600" /> Cursos / Iniciativas / Reconocimientos</h4>
            {editable && (
              <button onClick={() => setModal({ type: "bonus" })}
                className="text-xs text-blue-700 hover:text-blue-900 flex items-center gap-0.5">
                <Plus className="w-3 h-3" /> Agregar
              </button>
            )}
          </div>
          {bonusExtras.length === 0 ? (
            <p className="text-xs text-gray-400 italic">Sin extras</p>
          ) : (
            <div className="space-y-1.5">
              {bonusExtras.map((b) => (
                <BonusCard key={b.id} bonus={b} editable={editable} onChanged={onChanged} />
              ))}
            </div>
          )}
          <div className="text-xs text-blue-700 mt-2 font-semibold">Total: +{totalBonus.toFixed(1)}</div>
        </div>
      </div>

      {modal?.type === "evento" && (
        <ModalEvento evalId={evalId} personaActiva={personaActiva}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); onChanged(); }} />
      )}
      {modal?.type === "bonus" && (
        <ModalBonus evalId={evalId}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); onChanged(); }} />
      )}
    </div>
  );
}

function EventoCard({ evento, editable, onChanged }) {
  async function borrar() {
    if (!confirm("¿Eliminar evento?")) return;
    await supabase.from("eventos_cliente").delete().eq("id", evento.id);
    onChanged();
  }
  const total = (evento.preparacion || 0) + (evento.cobertura || 0) + (evento.reporte || 0) + (evento.resultados || 0);
  return (
    <div className="text-xs border border-gray-100 rounded p-2 bg-gray-50">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium truncate flex-1">{evento.descripcion}</span>
        <span className="font-semibold text-amber-700 shrink-0">+{Number(evento.bonus_pts).toFixed(1)}</span>
        {editable && (
          <button onClick={borrar} className="text-gray-400 hover:text-red-600">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      <div className="text-[10px] text-gray-500 mt-0.5">
        {evento.cliente && <span>{evento.cliente} · </span>}
        {fmtFechaCorta(evento.fecha)} · {total}/20 ptos detalle
      </div>
    </div>
  );
}

function BonusCard({ bonus, editable, onChanged }) {
  async function borrar() {
    if (!confirm("¿Eliminar bonus?")) return;
    await supabase.from("evaluacion_bonus").delete().eq("id", bonus.id);
    onChanged();
  }
  const tipoLabels = { curso: "Curso", reconocimiento: "Reconocimiento", iniciativa: "Iniciativa", otro: "Otro" };
  return (
    <div className="text-xs border border-gray-100 rounded p-2 bg-gray-50 flex items-center gap-2">
      <span className="text-[9px] uppercase font-bold text-blue-600">{tipoLabels[bonus.tipo]}</span>
      <span className="flex-1 truncate">{bonus.descripcion}</span>
      <span className="font-semibold text-blue-700 shrink-0">+{Number(bonus.puntos).toFixed(1)}</span>
      {editable && (
        <button onClick={borrar} className="text-gray-400 hover:text-red-600">
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function ModalEvento({ evalId, personaActiva, onClose, onSaved }) {
  const perfil = usePerfil();
  const [form, setForm] = useState({
    fecha: toISO(new Date()),
    cliente: "digitalife",
    lugar: "",
    descripcion: "",
    preparacion: 0, cobertura: 0, reporte: 0, resultados: 0,
  });
  const [saving, setSaving] = useState(false);

  // Bonus calculado: 4 niveles, máx +20
  const total = form.preparacion + form.cobertura + form.reporte + form.resultados;
  let bonus = 0;
  if (total >= 18) bonus = 20;       // excelente
  else if (total >= 14) bonus = 15;  // bueno
  else if (total >= 10) bonus = 10;  // regular
  else if (total >= 6)  bonus = 5;   // aceptable

  async function guardar() {
    if (!form.descripcion.trim()) { toast.error("Pon descripción"); return; }
    setSaving(true);
    await supabase.from("eventos_cliente").insert({
      persona_user_id: personaActiva,
      fecha: form.fecha,
      cliente: form.cliente,
      lugar: form.lugar.trim() || null,
      descripcion: form.descripcion.trim(),
      preparacion: form.preparacion || null,
      cobertura: form.cobertura || null,
      reporte: form.reporte || null,
      resultados: form.resultados || null,
      bonus_pts: bonus,
      evaluacion_id: evalId,
      creado_por: perfil?.user_id,
    });
    setSaving(false);
    toast.success(`Evento agregado (+${bonus} bonus)`);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Calendar className="w-4 h-4" /> Nuevo evento de cliente</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha">
              <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Cliente">
              <select value={form.cliente} onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                <option value="digitalife">Digitalife</option>
                <option value="pcel">PCEL</option>
                <option value="mercadolibre">Mercado Libre</option>
                <option value="otro">Otro</option>
              </select>
            </Field>
          </div>
          <Field label="Descripción">
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej. Cobertura evento PCEL Monterrey"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <Field label="Lugar">
            <input value={form.lugar} onChange={(e) => setForm({ ...form, lugar: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
            <div className="text-xs font-semibold text-amber-900">Calificación del evento (1-5 cada criterio)</div>
            {[
              { k: "preparacion", l: "Preparación previa" },
              { k: "cobertura",   l: "Cobertura durante" },
              { k: "reporte",     l: "Reporte post-evento" },
              { k: "resultados",  l: "Resultados generados" },
            ].map((c) => (
              <div key={c.k} className="flex items-center gap-2">
                <span className="flex-1 text-xs text-gray-700">{c.l}</span>
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setForm({ ...form, [c.k]: n })}
                    className={[
                      "w-6 h-6 rounded text-[10px] font-bold",
                      form[c.k] === n ? "bg-amber-600 text-white" : "bg-white border border-gray-200 text-gray-600",
                    ].join(" ")}>
                    {n}
                  </button>
                ))}
              </div>
            ))}
            <div className="text-xs text-amber-900 pt-1 border-t border-amber-200">
              Total: {total}/20 → Bonus: <strong>+{bonus} pts</strong>
              <span className="text-[10px] text-amber-700 ml-2">(≥18 = +20 · ≥14 = +15 · ≥10 = +10 · ≥6 = +5)</span>
            </div>
          </div>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm font-medium">
            {saving ? "Guardando…" : `Agregar evento +${bonus} pts`}
          </button>
        </div>
      </div>
    </div>
  );
}

function ModalBonus({ evalId, onClose, onSaved }) {
  const perfil = usePerfil();
  const [form, setForm] = useState({ tipo: "curso", descripcion: "", puntos: 5 });
  const [saving, setSaving] = useState(false);

  const sugerencias = {
    curso: 7,
    reconocimiento: 8,
    iniciativa: 5,
    otro: 3,
  };

  async function guardar() {
    if (!form.descripcion.trim()) { toast.error("Pon descripción"); return; }
    setSaving(true);
    await supabase.from("evaluacion_bonus").insert({
      evaluacion_id: evalId,
      tipo: form.tipo,
      descripcion: form.descripcion.trim(),
      puntos: Number(form.puntos) || 0,
      creado_por: perfil?.user_id,
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold flex items-center gap-2"><Star className="w-4 h-4" /> Nuevo bonus</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Tipo">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: "curso", label: "Curso/Cert", sugerido: 7 },
                { id: "reconocimiento", label: "Reconocimiento cliente", sugerido: 8 },
                { id: "iniciativa", label: "Iniciativa fuera scope", sugerido: 5 },
                { id: "otro", label: "Otro", sugerido: 3 },
              ].map((t) => (
                <button key={t.id} onClick={() => setForm({ ...form, tipo: t.id, puntos: sugerencias[t.id] })}
                  className={[
                    "px-3 py-2 rounded-lg text-xs border text-left",
                    form.tipo === t.id ? "bg-blue-50 border-blue-400 text-blue-800" : "bg-white border-gray-200",
                  ].join(" ")}>
                  <div className="font-medium">{t.label}</div>
                  <div className="text-[10px] text-gray-500">Sugerido: +{t.sugerido}</div>
                </button>
              ))}
            </div>
          </Field>
          <Field label="Descripción">
            <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              placeholder="Ej. Curso de Excel avanzado completado"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <Field label="Puntos">
            <input type="number" min={0} max={15} step={0.5}
              value={form.puntos} onChange={(e) => setForm({ ...form, puntos: e.target.value })}
              className="w-32 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
            {saving ? "Guardando…" : `Agregar +${form.puntos} pts`}
          </button>
        </div>
      </div>
    </div>
  );
}

function RetroSection({ evalData, editable, onSave }) {
  const [open, setOpen] = useState(false);
  const [fields, setFields] = useState({
    fortalezas: evalData.fortalezas || "",
    oportunidades: evalData.oportunidades || "",
    plan_accion: evalData.plan_accion || "",
    notas_kam: evalData.notas_kam || "",
  });

  const handleBlur = (k) => onSave(k, fields[k]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(!open)} className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50">
        <FileText className="w-4 h-4 text-gray-600" />
        <span className="font-semibold text-gray-800 flex-1 text-left">Retroalimentación</span>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4 space-y-3">
          {[
            { k: "fortalezas",    label: "Fortalezas observadas",    rows: 3 },
            { k: "oportunidades", label: "Áreas de oportunidad",     rows: 3 },
            { k: "plan_accion",   label: "Compromisos / plan acción", rows: 3 },
            { k: "notas_kam",     label: "Notas del KAM",            rows: 2 },
          ].map((f) => (
            <Field key={f.k} label={f.label}>
              <textarea
                value={fields[f.k]}
                onChange={(e) => setFields({ ...fields, [f.k]: e.target.value })}
                onBlur={() => handleBlur(f.k)}
                disabled={!editable}
                rows={f.rows}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none"
              />
            </Field>
          ))}
        </div>
      )}
    </div>
  );
}

// ────────── Vista Propuestas (todas, filtradas por persona) ──────────
function PropuestasView({ personaActiva, canEdit, esPropia }) {
  const perfil = usePerfil();
  const [props, setProps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null);

  const cargar = async () => {
    setLoading(true);
    const { data } = await supabase.from("propuestas_equipo")
      .select("*").eq("persona_user_id", personaActiva)
      .order("fecha_propuesta", { ascending: false });
    setProps(data || []);
    setLoading(false);
  };
  useEffect(() => { if (personaActiva) cargar(); /* eslint-disable-next-line */ }, [personaActiva]);

  // Karolina puede crear (es la persona); admin también puede
  const puedeCrear = canEdit || perfil?.user_id === personaActiva;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
        <div className="text-sm">
          <strong>{props.length}</strong> propuesta{props.length !== 1 ? "s" : ""} registrada{props.length !== 1 ? "s" : ""}
        </div>
        {puedeCrear && (
          <button onClick={() => setModal({ nueva: true })}
            className="px-3 py-1.5 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Nueva propuesta
          </button>
        )}
      </div>

      {loading ? (
        <div className="text-gray-400 text-sm p-6">Cargando…</div>
      ) : props.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <Lightbulb className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">Sin propuestas todavía.</p>
          {puedeCrear && <p className="text-xs text-gray-400 mt-1">Registra ideas cuando se te ocurran — cuentan en la evaluación.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {props.map((p) => (
            <PropCard key={p.id} prop={p} canEdit={canEdit} puedeEditarPropia={perfil?.user_id === p.persona_user_id}
              onEditar={() => setModal({ prop: p })} onChanged={cargar} />
          ))}
        </div>
      )}

      {modal && (
        <ModalPropuesta data={modal} personaActiva={personaActiva} canEdit={canEdit}
          onClose={() => setModal(null)} onSaved={() => { setModal(null); cargar(); }} />
      )}
    </div>
  );
}

function PropCard({ prop, canEdit, puedeEditarPropia, onEditar, onChanged }) {
  const est = ESTATUS_PROP[prop.estatus] || ESTATUS_PROP.propuesta;
  async function borrar() {
    if (!confirm("¿Eliminar propuesta?")) return;
    await supabase.from("propuestas_equipo").delete().eq("id", prop.id);
    onChanged();
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3" style={{ borderLeft: "4px solid #EC4899" }}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${est.bg} ${est.text}`}>
              {est.label}
            </span>
            {prop.cuenta && <span className="text-[10px] text-gray-500">{prop.cuenta}</span>}
            {prop.calificacion_kam && (
              <span className="text-[10px] text-amber-600">★ {prop.calificacion_kam}/5</span>
            )}
            {prop.bonus_pts_aplicado > 0 && (
              <span className="text-[10px] font-semibold text-emerald-700">+{prop.bonus_pts_aplicado} pts</span>
            )}
          </div>
          <div className="font-medium text-gray-800 mt-0.5">{prop.descripcion}</div>
          <div className="text-xs text-gray-500 mt-0.5">
            {fmtFechaCorta(prop.fecha_propuesta)}
            {prop.area_impacto && <> · {prop.area_impacto}</>}
            {prop.beneficio_esperado && <> · {prop.beneficio_esperado}</>}
          </div>
          {prop.resultado_avance && (
            <div className="text-xs text-gray-600 mt-1 italic">Avance: {prop.resultado_avance}</div>
          )}
          {prop.notas_kam && (
            <div className="text-xs text-blue-700 mt-1 italic">KAM: {prop.notas_kam}</div>
          )}
        </div>
        {(canEdit || puedeEditarPropia) && (
          <div className="flex items-center gap-1">
            <button onClick={onEditar} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
            {canEdit && (
              <button onClick={borrar} className="p-1.5 rounded hover:bg-red-50 text-red-600" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ModalPropuesta({ data, personaActiva, canEdit, onClose, onSaved }) {
  const perfil = usePerfil();
  const editing = !!data.prop;
  const [form, setForm] = useState(() => editing ? {
    descripcion: data.prop.descripcion || "",
    area_impacto: data.prop.area_impacto || "",
    beneficio_esperado: data.prop.beneficio_esperado || "",
    cuenta: data.prop.cuenta || "general",
    estatus: data.prop.estatus || "propuesta",
    fecha_propuesta: data.prop.fecha_propuesta?.slice(0, 10) || toISO(new Date()),
    fecha_implementacion: data.prop.fecha_implementacion?.slice(0, 10) || "",
    resultado_avance: data.prop.resultado_avance || "",
    calificacion_kam: data.prop.calificacion_kam || null,
    bonus_pts_aplicado: data.prop.bonus_pts_aplicado || 0,
    notas_kam: data.prop.notas_kam || "",
  } : {
    descripcion: "",
    area_impacto: "",
    beneficio_esperado: "",
    cuenta: "general",
    estatus: "propuesta",
    fecha_propuesta: toISO(new Date()),
    fecha_implementacion: "",
    resultado_avance: "",
    calificacion_kam: null,
    bonus_pts_aplicado: 0,
    notas_kam: "",
  });
  const [saving, setSaving] = useState(false);

  async function guardar() {
    if (!form.descripcion.trim()) { toast.error("Pon descripción"); return; }
    setSaving(true);
    const payload = {
      ...form,
      fecha_propuesta: form.fecha_propuesta,
      fecha_implementacion: form.fecha_implementacion || null,
      calificacion_kam: form.calificacion_kam || null,
      bonus_pts_aplicado: Number(form.bonus_pts_aplicado) || 0,
    };
    let error;
    if (editing) {
      ({ error } = await supabase.from("propuestas_equipo").update(payload).eq("id", data.prop.id));
    } else {
      payload.persona_user_id = personaActiva;
      payload.creado_por = perfil?.user_id;
      ({ error } = await supabase.from("propuestas_equipo").insert(payload));
    }
    setSaving(false);
    if (error) { toast.error("Error: " + error.message); return; }
    toast.success(editing ? "Actualizada" : "Propuesta agregada");
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="px-5 py-4 border-b flex items-center justify-between sticky top-0 bg-white">
          <h3 className="font-semibold flex items-center gap-2"><Lightbulb className="w-4 h-4" /> {editing ? "Editar propuesta" : "Nueva propuesta"}</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="p-5 space-y-3">
          <Field label="Descripción">
            <textarea value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
              rows={3} placeholder="¿Qué propones?"
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Área de impacto">
              <input value={form.area_impacto} onChange={(e) => setForm({ ...form, area_impacto: e.target.value })}
                placeholder="Ej. Operación, Marketing, Logística"
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Cuenta">
              <select value={form.cuenta} onChange={(e) => setForm({ ...form, cuenta: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                <option value="general">General</option>
                <option value="digitalife">Digitalife</option>
                <option value="pcel">PCEL</option>
                <option value="mercadolibre">Mercado Libre</option>
                <option value="interno">Interno</option>
              </select>
            </Field>
          </div>
          <Field label="Beneficio esperado">
            <input value={form.beneficio_esperado} onChange={(e) => setForm({ ...form, beneficio_esperado: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha propuesta">
              <input type="date" value={form.fecha_propuesta} onChange={(e) => setForm({ ...form, fecha_propuesta: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Estatus">
              <select value={form.estatus} onChange={(e) => setForm({ ...form, estatus: e.target.value })}
                disabled={!canEdit}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {Object.entries(ESTATUS_PROP).map(([id, v]) => <option key={id} value={id}>{v.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Sección KAM (solo super_admin) */}
          {canEdit && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-2">
              <div className="text-xs font-semibold text-amber-900">Sección KAM</div>
              <Field label="Resultado / avance">
                <input value={form.resultado_avance} onChange={(e) => setForm({ ...form, resultado_avance: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Calificación 1-5">
                  <select value={form.calificacion_kam || ""} onChange={(e) => setForm({ ...form, calificacion_kam: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                    <option value="">—</option>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </Field>
                <Field label="Bonus si implementada">
                  <input type="number" min={0} max={15} step={0.5}
                    value={form.bonus_pts_aplicado} onChange={(e) => setForm({ ...form, bonus_pts_aplicado: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </Field>
                <Field label="Fecha implementación">
                  <input type="date" value={form.fecha_implementacion} onChange={(e) => setForm({ ...form, fecha_implementacion: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </Field>
              </div>
              <Field label="Notas KAM">
                <textarea value={form.notas_kam} onChange={(e) => setForm({ ...form, notas_kam: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              </Field>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm hover:bg-gray-100">Cancelar</button>
          <button onClick={guardar} disabled={saving}
            className="px-4 py-2 rounded-lg bg-pink-600 hover:bg-pink-700 text-white text-sm font-medium">
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ────────── Vista Eventos (lista de todos los eventos) ──────────
function EventosView({ personaActiva, canEdit }) {
  const [eventos, setEventos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!personaActiva) return;
    (async () => {
      setLoading(true);
      const { data } = await supabase.from("eventos_cliente")
        .select("*").eq("persona_user_id", personaActiva)
        .order("fecha", { ascending: false });
      setEventos(data || []);
      setLoading(false);
    })();
  }, [personaActiva]);

  if (loading) return <div className="text-gray-400 text-sm p-6">Cargando…</div>;
  if (eventos.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
        <Calendar className="w-10 h-10 text-gray-300 mx-auto mb-2" />
        <p className="text-sm text-gray-500">Sin eventos registrados todavía.</p>
        <p className="text-xs text-gray-400 mt-1">Los eventos se agregan desde la evaluación correspondiente.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {eventos.map((e) => {
        const total = (e.preparacion || 0) + (e.cobertura || 0) + (e.reporte || 0) + (e.resultados || 0);
        return (
          <div key={e.id} className="bg-white rounded-xl border border-gray-200 px-4 py-3" style={{ borderLeft: "4px solid #F59E0B" }}>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">{e.cliente}</span>
                  <span className="text-xs text-gray-500">{fmtFechaCorta(e.fecha)}</span>
                  {e.lugar && <span className="text-xs text-gray-500">· {e.lugar}</span>}
                </div>
                <div className="font-medium text-gray-800 mt-0.5">{e.descripcion}</div>
                <div className="text-xs text-gray-500 mt-0.5">
                  Prep {e.preparacion || "—"} · Cob {e.cobertura || "—"} · Rep {e.reporte || "—"} · Res {e.resultados || "—"} · Total {total}/20
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-amber-700">+{Number(e.bonus_pts).toFixed(1)}</div>
                <div className="text-[10px] text-gray-500">bonus aplicado</div>
              </div>
            </div>
          </div>
        );
      })}
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
