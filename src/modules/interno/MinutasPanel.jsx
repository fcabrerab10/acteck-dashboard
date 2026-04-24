import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { toast } from "../../lib/toast";
import {
  Plus, Trash2, Check, X, Edit3, FileText, Users, Calendar,
  ChevronDown, ChevronUp, Search, Copy, Sparkles,
} from "lucide-react";

/**
 * MinutasPanel — Fase 3
 * Lista minutas, filtrables por cliente/fecha. Cada minuta tiene título,
 * asistentes, contenido (texto libre), y acuerdos estructurados que generan
 * pendientes_equipo vinculados automáticamente.
 */

const CLIENTES_MIN = [
  { id: "digitalife",   label: "Digitalife",   stripe: "#3B82F6" },
  { id: "pcel",         label: "PCEL",         stripe: "#EF4444" },
  { id: "mercadolibre", label: "Mercado Libre",stripe: "#F59E0B" },
  { id: "interno",      label: "Interno",      stripe: "#A855F7" },
];

const PLANTILLAS = [
  {
    id: "libre",
    label: "En blanco",
    descripcion: "Empezar desde cero",
    tituloSugerido: "",
    contenido: "",
    acuerdos: [],
  },
  {
    id: "cliente_semanal",
    label: "Reunión semanal cliente",
    descripcion: "Sell-in, sell-out, inventario, promos, acuerdos",
    tituloSugerido: "Reunión semanal — {cliente}",
    contenido:
      "## Sell-in\n- \n\n## Sell-out\n- \n\n## Inventario\n- \n\n## Promociones\n- \n\n## Otros temas\n- ",
    acuerdos: [],
  },
  {
    id: "interno",
    label: "Reunión interna",
    descripcion: "Temas del equipo + acuerdos",
    tituloSugerido: "Reunión interna",
    contenido: "## Temas\n- \n\n## Puntos revisados\n- ",
    acuerdos: [],
  },
  {
    id: "mensual",
    label: "Cierre mensual",
    descripcion: "Resultados del mes + plan siguiente",
    tituloSugerido: "Cierre de mes — {cliente}",
    contenido:
      "## Resultados del mes\n- Ventas:\n- Inventario:\n- Marketing:\n\n## Siguiente mes\n- Objetivos:\n- Promociones:",
    acuerdos: [],
  },
];

const PRIORIDADES = [
  { id: "alta",  label: "Alta",  bg: "bg-red-100",   text: "text-red-700",    dot: "#DC2626" },
  { id: "media", label: "Media", bg: "bg-amber-100", text: "text-amber-700",  dot: "#F59E0B" },
  { id: "baja",  label: "Baja",  bg: "bg-slate-100", text: "text-slate-600",  dot: "#94A3B8" },
];

// Util
const hoyISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const formatFechaCorto = (iso) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(d, 10)} ${meses[parseInt(m, 10) - 1]} ${y}`;
};

export default function MinutasPanel({ canEdit, internos, perfiles, nombrePorUserId, colorPorUserId }) {
  const perfil = usePerfil();
  const [minutas, setMinutas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filtroCliente, setFiltroCliente] = useState("todos");
  const [busqueda, setBusqueda] = useState("");
  const [modalMinuta, setModalMinuta] = useState(null);

  useEffect(() => { cargar(); }, []);

  async function cargar() {
    setLoading(true);
    const { data, error } = await supabase
      .from("minutas")
      .select("*, minuta_acuerdos(*)")
      .order("fecha_reunion", { ascending: false });
    if (error) { console.error(error); toast.error("Error cargando minutas"); }
    setMinutas(data || []);
    setLoading(false);
  }

  const filtradas = useMemo(() => {
    return minutas.filter((m) => {
      if (filtroCliente !== "todos" && m.cliente !== filtroCliente) return false;
      if (busqueda) {
        const q = busqueda.toLowerCase();
        const hay =
          (m.titulo || "").toLowerCase().includes(q) ||
          (m.contenido || "").toLowerCase().includes(q) ||
          (m.cliente || "").toLowerCase().includes(q);
        if (!hay) return false;
      }
      return true;
    });
  }, [minutas, filtroCliente, busqueda]);

  async function borrarMinuta(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta minuta? Los acuerdos y sus pendientes vinculados se pierden.")) return;
    const { error } = await supabase.from("minutas").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Minuta eliminada");
    cargar();
  }

  if (loading) return <div className="p-6 text-gray-400 text-sm">Cargando minutas…</div>;

  return (
    <div className="space-y-4">
      {/* Barra de acciones */}
      <div className="bg-white rounded-xl border border-gray-100 px-3 py-2 flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2 top-2.5 w-3.5 h-3.5 text-gray-400" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar en minutas…"
            className="w-full pl-7 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg bg-white"
          />
        </div>
        <select
          value={filtroCliente}
          onChange={(e) => setFiltroCliente(e.target.value)}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 bg-white"
        >
          <option value="todos">Todos los clientes</option>
          {CLIENTES_MIN.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <div className="text-xs text-gray-500">
          {filtradas.length} minuta{filtradas.length !== 1 ? "s" : ""}
        </div>
        <div className="flex-1" />
        {canEdit && (
          <button
            onClick={() => setModalMinuta({ nueva: true })}
            className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Nueva minuta
          </button>
        )}
      </div>

      {/* Lista */}
      {filtradas.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 p-10 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-sm text-gray-500">
            {busqueda || filtroCliente !== "todos"
              ? "No hay minutas con esos filtros"
              : "Aún no hay minutas. Crea la primera."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtradas.map((m) => (
            <MinutaCard
              key={m.id}
              minuta={m}
              canEdit={canEdit}
              nombrePorUserId={nombrePorUserId}
              colorPorUserId={colorPorUserId}
              onEditar={() => setModalMinuta({ minuta: m })}
              onBorrar={() => borrarMinuta(m.id)}
            />
          ))}
        </div>
      )}

      {modalMinuta && (
        <ModalMinuta
          data={modalMinuta}
          perfiles={perfiles}
          internos={internos}
          onClose={() => setModalMinuta(null)}
          onGuardado={() => { cargar(); setModalMinuta(null); }}
        />
      )}
    </div>
  );
}

// ────────── Tarjeta de minuta ──────────
function MinutaCard({ minuta, canEdit, nombrePorUserId, colorPorUserId, onEditar, onBorrar }) {
  const [open, setOpen] = useState(false);
  const cliente = CLIENTES_MIN.find((c) => c.id === minuta.cliente) || CLIENTES_MIN[3];
  const acuerdos = Array.isArray(minuta.minuta_acuerdos) ? minuta.minuta_acuerdos : [];
  const acLight = acuerdos.filter((a) => a.estado === "listo").length;

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 overflow-hidden"
      style={{ borderLeft: `4px solid ${cliente.stripe}` }}
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className="text-[10px] font-bold px-1.5 py-0.5 rounded uppercase"
              style={{ backgroundColor: `${cliente.stripe}22`, color: cliente.stripe }}
            >
              {cliente.label}
            </span>
            <span className="text-xs text-gray-500">
              <Calendar className="w-3 h-3 inline mr-1" />
              {formatFechaCorto(minuta.fecha_reunion)}
            </span>
            {minuta.fuente && (
              <span className="text-[10px] text-gray-400 italic">via {minuta.fuente}</span>
            )}
            {acuerdos.length > 0 && (
              <span className="text-[11px] text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded-full">
                {acLight}/{acuerdos.length} acuerdos
              </span>
            )}
          </div>
          <div className="font-semibold text-gray-800 mt-0.5 truncate">
            {minuta.titulo || "(Sin título)"}
          </div>
          {Array.isArray(minuta.asistentes) && minuta.asistentes.length > 0 && (
            <div className="text-xs text-gray-500 mt-0.5 truncate">
              <Users className="w-3 h-3 inline mr-1" />
              {minuta.asistentes.map((a) => a.nombre || nombrePorUserId[a.user_id] || "—").join(", ")}
            </div>
          )}
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {open && (
        <div className="px-4 pb-4 pt-1 border-t border-gray-100 space-y-3">
          {minuta.contenido && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Contenido</div>
              <pre className="whitespace-pre-wrap text-sm text-gray-700 font-sans bg-gray-50 rounded-lg p-3 border border-gray-100">
                {minuta.contenido}
              </pre>
            </div>
          )}

          {acuerdos.length > 0 && (
            <div>
              <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1">Acuerdos</div>
              <div className="space-y-1.5">
                {[...acuerdos].sort((a, b) => a.orden - b.orden).map((ac) => (
                  <AcuerdoRow
                    key={ac.id}
                    acuerdo={ac}
                    nombrePorUserId={nombrePorUserId}
                    colorPorUserId={colorPorUserId}
                    canEdit={canEdit}
                  />
                ))}
              </div>
            </div>
          )}

          {canEdit && (
            <div className="flex items-center gap-2 pt-2">
              <button
                onClick={onEditar}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-blue-50"
              >
                <Edit3 className="w-3 h-3" /> Editar
              </button>
              <button
                onClick={onBorrar}
                className="text-xs text-red-600 hover:text-red-800 flex items-center gap-1 px-2 py-1 rounded hover:bg-red-50"
              >
                <Trash2 className="w-3 h-3" /> Eliminar
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function AcuerdoRow({ acuerdo, nombrePorUserId, colorPorUserId, canEdit }) {
  const [estado, setEstado] = useState(acuerdo.estado);
  const pri = PRIORIDADES.find((p) => p.id === acuerdo.prioridad) || PRIORIDADES[1];
  const listo = estado === "listo";

  async function toggle() {
    if (!canEdit) return;
    const nuevo = listo ? "pendiente" : "listo";
    setEstado(nuevo);
    const { error } = await supabase.from("minuta_acuerdos").update({ estado: nuevo }).eq("id", acuerdo.id);
    if (error) { setEstado(estado); toast.error("No se pudo actualizar"); return; }
    toast.success(nuevo === "listo" ? "Acuerdo cerrado" : "Acuerdo reabierto");
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <button
        onClick={toggle}
        disabled={!canEdit}
        className={[
          "shrink-0 w-4 h-4 mt-0.5 rounded border-2 flex items-center justify-center transition",
          listo ? "bg-emerald-500 border-emerald-500 text-white" : "border-gray-300 bg-white hover:border-emerald-500",
          canEdit ? "cursor-pointer" : "cursor-default",
        ].join(" ")}
      >
        {listo && <Check className="w-3 h-3" strokeWidth={3} />}
      </button>
      <div className="flex-1 min-w-0">
        <div className={listo ? "line-through text-gray-400" : "text-gray-700"}>
          {acuerdo.descripcion}
        </div>
        <div className="flex items-center gap-2 text-[10px] mt-0.5 flex-wrap">
          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium ${pri.bg} ${pri.text}`}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: pri.dot }} />
            {pri.label}
          </span>
          {acuerdo.fecha_limite && (
            <span className="text-gray-500">
              <Calendar className="w-2.5 h-2.5 inline mr-0.5" />
              {formatFechaCorto(acuerdo.fecha_limite)}
            </span>
          )}
          {acuerdo.responsable && (
            <span className="inline-flex items-center gap-1 text-gray-600">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: colorPorUserId[acuerdo.responsable] || "#94A3B8" }} />
              {nombrePorUserId[acuerdo.responsable]?.split(" ")[0] || "—"}
            </span>
          )}
          {acuerdo.pendiente_id && (
            <span className="text-[10px] text-blue-600 italic">→ pendiente #{acuerdo.pendiente_id}</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ────────── Modal crear/editar minuta ──────────
function ModalMinuta({ data, perfiles, internos, onClose, onGuardado }) {
  const perfil = usePerfil();
  const esNueva = !!data.nueva;
  const original = data.minuta || {};
  const acuerdosOriginales = Array.isArray(original.minuta_acuerdos) ? original.minuta_acuerdos : [];

  const [paso, setPaso] = useState(esNueva ? "plantilla" : "form");
  const [plantillaSel, setPlantillaSel] = useState(null);

  const [form, setForm] = useState(() => ({
    cliente:       original.cliente || "digitalife",
    titulo:        original.titulo || "",
    fecha_reunion: original.fecha_reunion?.slice(0, 10) || hoyISO(),
    asistentes:    Array.isArray(original.asistentes) ? original.asistentes : [],
    contenido:     original.contenido || "",
    plantilla:     original.plantilla || null,
    fuente:        original.fuente || null,
  }));
  // Acuerdos locales (cada uno con marker para distinguir nuevo vs existente)
  const [acuerdos, setAcuerdos] = useState(() =>
    acuerdosOriginales
      .sort((a, b) => a.orden - b.orden)
      .map((a) => ({
        _tempId: `e_${a.id}`,
        id: a.id,
        descripcion: a.descripcion,
        responsable: a.responsable || "",
        fecha_limite: a.fecha_limite?.slice(0, 10) || "",
        prioridad: a.prioridad || "media",
        estado: a.estado || "pendiente",
        pendiente_id: a.pendiente_id || null,
      }))
  );
  const [guardando, setGuardando] = useState(false);

  const aplicarPlantilla = (p) => {
    setPlantillaSel(p);
    setForm((f) => ({
      ...f,
      plantilla: p.id,
      contenido: p.contenido || f.contenido,
      titulo: p.tituloSugerido
        ? p.tituloSugerido.replace(
            "{cliente}",
            CLIENTES_MIN.find((c) => c.id === f.cliente)?.label || ""
          )
        : f.titulo,
    }));
    setPaso("form");
  };

  // Helpers de asistentes
  const toggleAsistente = (p) => {
    const existe = form.asistentes.find((a) => a.user_id === p.user_id);
    const nuevos = existe
      ? form.asistentes.filter((a) => a.user_id !== p.user_id)
      : [...form.asistentes, { user_id: p.user_id, nombre: p.nombre || p.email }];
    setForm({ ...form, asistentes: nuevos });
  };
  const agregarAsistenteLibre = (nombre) => {
    const txt = nombre.trim();
    if (!txt) return;
    setForm({ ...form, asistentes: [...form.asistentes, { nombre: txt }] });
  };
  const quitarAsistenteIdx = (idx) => {
    setForm({ ...form, asistentes: form.asistentes.filter((_, i) => i !== idx) });
  };

  // Helpers de acuerdos
  const agregarAcuerdo = () => {
    setAcuerdos((prev) => [
      ...prev,
      {
        _tempId: `n_${Math.random().toString(36).slice(2, 10)}`,
        descripcion: "",
        responsable: "",
        fecha_limite: "",
        prioridad: "media",
        estado: "pendiente",
        pendiente_id: null,
      },
    ]);
  };
  const actualizarAcuerdo = (tempId, patch) =>
    setAcuerdos((prev) => prev.map((a) => (a._tempId === tempId ? { ...a, ...patch } : a)));
  const quitarAcuerdo = (tempId) =>
    setAcuerdos((prev) => prev.filter((a) => a._tempId !== tempId));

  async function guardar() {
    if (!form.titulo.trim()) return toast.error("Pon un título");
    if (!form.fecha_reunion) return toast.error("Define la fecha");
    if (!form.contenido.trim() && acuerdos.length === 0) {
      return toast.error("Agrega contenido o al menos un acuerdo");
    }

    setGuardando(true);
    let minutaId = original.id;

    const payload = {
      cliente: form.cliente,
      titulo: form.titulo.trim(),
      fecha_reunion: form.fecha_reunion,
      contenido: form.contenido,
      asistentes: form.asistentes,
      plantilla: form.plantilla,
      fuente: form.fuente,
    };

    if (esNueva) {
      payload.creado_por = perfil?.user_id || null;
      const { data: ins, error } = await supabase
        .from("minutas")
        .insert(payload)
        .select()
        .single();
      if (error) { setGuardando(false); toast.error("No se pudo crear: " + error.message); return; }
      minutaId = ins.id;
    } else {
      const { error } = await supabase.from("minutas").update(payload).eq("id", minutaId);
      if (error) { setGuardando(false); toast.error("No se pudo actualizar: " + error.message); return; }
    }

    // Sync acuerdos
    // 1) Borrar los que estaban y ya no están
    const idsLocales = acuerdos.filter((a) => a.id).map((a) => a.id);
    const idsOriginales = acuerdosOriginales.map((a) => a.id);
    const idsBorrar = idsOriginales.filter((id) => !idsLocales.includes(id));
    if (idsBorrar.length > 0) {
      // Borrar pendiente_equipo vinculado también (best-effort)
      const acOrigBorrar = acuerdosOriginales.filter((a) => idsBorrar.includes(a.id));
      const pendIdsBorrar = acOrigBorrar.map((a) => a.pendiente_id).filter(Boolean);
      if (pendIdsBorrar.length > 0) {
        await supabase.from("pendientes_equipo").delete().in("id", pendIdsBorrar);
      }
      await supabase.from("minuta_acuerdos").delete().in("id", idsBorrar);
    }

    // 2) Procesar los restantes (upsert + crear pendiente si hace falta)
    for (let i = 0; i < acuerdos.length; i++) {
      const ac = acuerdos[i];
      const desc = ac.descripcion.trim();
      if (!desc) continue;

      let pendienteId = ac.pendiente_id;

      // Si tiene responsable o fecha_limite y NO tiene pendiente vinculado → crear uno
      if (!pendienteId && (ac.responsable || ac.fecha_limite)) {
        const pendPayload = {
          cuenta: form.cliente === "interno" ? "otro" : form.cliente,
          tarea: desc,
          categoria: "Acuerdo de minuta",
          fecha_limite: ac.fecha_limite || null,
          estatus: ac.estado,
          prioridad: ac.prioridad,
          responsable: ac.responsable || null,
          responsables: ac.responsable ? [ac.responsable] : [],
          creado_por: perfil?.user_id || null,
          notas: `Acuerdo de minuta: ${form.titulo.trim()}`,
        };
        const { data: pend, error: pendErr } = await supabase
          .from("pendientes_equipo").insert(pendPayload).select().single();
        if (!pendErr) pendienteId = pend.id;
      } else if (pendienteId) {
        // Mantener el pendiente sincronizado con los cambios del acuerdo
        await supabase.from("pendientes_equipo").update({
          tarea: desc,
          fecha_limite: ac.fecha_limite || null,
          estatus: ac.estado,
          prioridad: ac.prioridad,
          responsable: ac.responsable || null,
          responsables: ac.responsable ? [ac.responsable] : [],
        }).eq("id", pendienteId);
      }

      const acPayload = {
        minuta_id: minutaId,
        descripcion: desc,
        responsable: ac.responsable || null,
        fecha_limite: ac.fecha_limite || null,
        prioridad: ac.prioridad,
        estado: ac.estado,
        pendiente_id: pendienteId,
        orden: i,
      };

      if (ac.id) {
        await supabase.from("minuta_acuerdos").update(acPayload).eq("id", ac.id);
      } else {
        await supabase.from("minuta_acuerdos").insert(acPayload);
      }
    }

    setGuardando(false);
    toast.success(esNueva ? "Minuta creada" : "Minuta actualizada");
    onGuardado();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <h3 className="font-semibold text-gray-800 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            {esNueva ? "Nueva minuta" : "Editar minuta"}
          </h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5">
          {paso === "plantilla" ? (
            <div>
              <p className="text-sm text-gray-600 mb-3 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Elige una plantilla (puedes editarla después)
              </p>
              <div className="grid grid-cols-2 gap-2">
                {PLANTILLAS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => aplicarPlantilla(p)}
                    className="text-left p-3 rounded-xl border border-gray-200 hover:border-blue-400 hover:bg-blue-50/50 transition"
                  >
                    <div className="font-medium text-gray-800 text-sm">{p.label}</div>
                    <div className="text-xs text-gray-500 mt-0.5">{p.descripcion}</div>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cliente">
                  <select
                    value={form.cliente}
                    onChange={(e) => setForm({ ...form, cliente: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  >
                    {CLIENTES_MIN.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </Field>
                <Field label="Fecha de reunión">
                  <input type="date" value={form.fecha_reunion}
                    onChange={(e) => setForm({ ...form, fecha_reunion: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
                </Field>
              </div>

              <Field label="Título">
                <input
                  value={form.titulo}
                  onChange={(e) => setForm({ ...form, titulo: e.target.value })}
                  placeholder="Ej. Reunión semanal Digitalife"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  autoFocus
                />
              </Field>

              {/* Asistentes */}
              <Field label={<span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" /> Asistentes</span>}>
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5">
                    {perfiles.map((p) => {
                      const activo = !!form.asistentes.find((a) => a.user_id === p.user_id);
                      return (
                        <button key={p.user_id} type="button"
                          onClick={() => toggleAsistente(p)}
                          className={[
                            "px-2.5 py-1 rounded-full text-xs border transition",
                            activo
                              ? "bg-blue-600 border-blue-600 text-white"
                              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50",
                          ].join(" ")}
                        >
                          {p.nombre || p.email}
                        </button>
                      );
                    })}
                  </div>
                  {/* Asistentes externos (texto libre) */}
                  <AsistenteLibre onAgregar={agregarAsistenteLibre} />
                  {form.asistentes.filter((a) => !a.user_id).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {form.asistentes.map((a, idx) =>
                        !a.user_id ? (
                          <span key={idx} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 text-xs">
                            {a.nombre}
                            <button onClick={() => quitarAsistenteIdx(idx)} className="hover:text-red-600">
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ) : null
                      )}
                    </div>
                  )}
                </div>
              </Field>

              <Field label="Contenido / Notas">
                <textarea
                  value={form.contenido}
                  onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                  rows={8}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-mono"
                  placeholder="Puedes usar markdown: ## Tema&#10;- punto"
                />
              </Field>

              {/* Acuerdos */}
              <Field
                label={
                  <span className="flex items-center justify-between">
                    <span>Acuerdos · generan pendientes automáticos</span>
                    <button
                      type="button"
                      onClick={agregarAcuerdo}
                      className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-normal"
                    >
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  </span>
                }
              >
                {acuerdos.length === 0 ? (
                  <p className="text-xs text-gray-400 italic py-2">Sin acuerdos. Click "Agregar" para crear uno.</p>
                ) : (
                  <div className="space-y-2">
                    {acuerdos.map((ac) => (
                      <AcuerdoEditor
                        key={ac._tempId}
                        acuerdo={ac}
                        perfiles={perfiles}
                        onChange={(patch) => actualizarAcuerdo(ac._tempId, patch)}
                        onBorrar={() => quitarAcuerdo(ac._tempId)}
                      />
                    ))}
                  </div>
                )}
              </Field>
            </div>
          )}
        </div>

        {paso === "form" && (
          <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100 sticky bottom-0 bg-white">
            <div>
              {esNueva && (
                <button
                  onClick={() => setPaso("plantilla")}
                  className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" /> Cambiar plantilla
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button onClick={onClose} className="px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100">Cancelar</button>
              <button onClick={guardar} disabled={guardando}
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium disabled:opacity-50">
                {guardando ? "Guardando…" : "Guardar minuta"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AcuerdoEditor({ acuerdo, perfiles, onChange, onBorrar }) {
  return (
    <div className="bg-gray-50 rounded-lg border border-gray-200 p-2.5 space-y-2">
      <div className="flex items-start gap-2">
        <input
          value={acuerdo.descripcion}
          onChange={(e) => onChange({ descripcion: e.target.value })}
          placeholder="Qué se acordó"
          className="flex-1 px-2 py-1.5 rounded border border-gray-200 text-sm bg-white"
        />
        <button
          onClick={onBorrar}
          className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
          title="Eliminar acuerdo"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <select
          value={acuerdo.responsable}
          onChange={(e) => onChange({ responsable: e.target.value })}
          className="px-2 py-1.5 rounded border border-gray-200 text-xs bg-white"
        >
          <option value="">Sin responsable</option>
          {perfiles.map((p) => (
            <option key={p.user_id} value={p.user_id}>{p.nombre || p.email}</option>
          ))}
        </select>
        <input
          type="date"
          value={acuerdo.fecha_limite}
          onChange={(e) => onChange({ fecha_limite: e.target.value })}
          className="px-2 py-1.5 rounded border border-gray-200 text-xs bg-white"
        />
        <select
          value={acuerdo.prioridad}
          onChange={(e) => onChange({ prioridad: e.target.value })}
          className="px-2 py-1.5 rounded border border-gray-200 text-xs bg-white"
        >
          {PRIORIDADES.map((p) => <option key={p.id} value={p.id}>Prioridad {p.label}</option>)}
        </select>
      </div>
      {(acuerdo.responsable || acuerdo.fecha_limite) && !acuerdo.id && (
        <p className="text-[10px] text-blue-600 italic">
          → Al guardar, se creará un pendiente vinculado automáticamente
        </p>
      )}
    </div>
  );
}

function AsistenteLibre({ onAgregar }) {
  const [txt, setTxt] = useState("");
  return (
    <div className="flex items-center gap-2">
      <input
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); onAgregar(txt); setTxt(""); } }}
        placeholder="+ Asistente externo (nombre libre)"
        className="flex-1 px-2 py-1 rounded border border-dashed border-gray-300 text-xs"
      />
      <button
        type="button"
        onClick={() => { onAgregar(txt); setTxt(""); }}
        className="text-xs px-2 py-1 rounded bg-gray-100 hover:bg-gray-200 text-gray-700"
      >
        Añadir
      </button>
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
