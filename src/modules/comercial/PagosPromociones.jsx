import React, { useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import { usePerfil } from "../../lib/perfilContext";
import { puedeEditarPestanaCliente } from "../../lib/permisos";
import { toast } from "../../lib/toast";
import { formatMXN, formatFecha } from "../../lib/utils";
import {
  Plus, X, ChevronDown, ChevronUp, Trash2, Edit3, Check, Clock,
  TrendingUp, ShieldCheck, ShoppingCart, Package, FileText, Calendar,
  DollarSign, Tag,
} from "lucide-react";

/**
 * PagosPromociones — sub-módulo para la sección "Promociones" dentro de Pagos.
 *
 * Exporta 2 componentes:
 *   <NuevaPromocionButton clienteKey />  — botón + modal con selector de tipo + formularios
 *   <ListaPromociones clienteKey />      — lista de promociones con estados
 */

// ────────── Catálogo de tipos ──────────
export const TIPOS_PROMO = [
  {
    id: "sellout",
    titulo: "Sellout",
    descripcion: "Monto fijo por pieza vendida durante el periodo",
    icon: TrendingUp,
    color: "#10b981",
    ejemplo: "Ej. $50 MXN por cada pieza que el cliente venda del SKU.",
  },
  {
    id: "proteccion_precio",
    titulo: "Protección de precios",
    descripcion: "Pagar la diferencia cuando baja el precio del SKU",
    icon: ShieldCheck,
    color: "#3b82f6",
    ejemplo: "Ej. Precio bajó de $1,000 a $800 → le pago $200 × piezas en su inventario.",
  },
  {
    id: "sell_in",
    titulo: "Sell In",
    descripcion: "Monto fijo por pieza comprada en el periodo",
    icon: ShoppingCart,
    color: "#f59e0b",
    ejemplo: "Ej. $30 MXN por cada pieza que el cliente me compre del SKU.",
  },
  {
    id: "bolsa",
    titulo: "Bolsa",
    descripcion: "Monto fijo total, no depende de piezas",
    icon: Package,
    color: "#8b5cf6",
    ejemplo: "Ej. $50,000 MXN por la campaña completa del trimestre.",
  },
];

export const ESTATUS_PROMO = {
  borrador:      { label: "Borrador",     bg: "bg-gray-100",    text: "text-gray-700",    dot: "#6b7280" },
  activa:        { label: "Activa",       bg: "bg-blue-100",    text: "text-blue-700",    dot: "#2563eb" },
  por_calcular:  { label: "Por calcular", bg: "bg-amber-100",   text: "text-amber-700",   dot: "#d97706" },
  aprobada:      { label: "Aprobada",     bg: "bg-indigo-100",  text: "text-indigo-700",  dot: "#4f46e5" },
  pagada:        { label: "Pagada",       bg: "bg-emerald-100", text: "text-emerald-700", dot: "#059669" },
  cancelada:     { label: "Cancelada",    bg: "bg-red-100",     text: "text-red-700",     dot: "#dc2626" },
};

// ────────────────────────────────────────────────────────────
//  NuevaPromocionButton — botón + modal con tiles + form
// ────────────────────────────────────────────────────────────
export function NuevaPromocionButton({ clienteKey, onCreated }) {
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaCliente(perfil, clienteKey, 'pagos');
  const [open, setOpen] = useState(false);
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null);

  if (!canEdit) return null;

  return (
    <>
      <button
        onClick={() => { setOpen(true); setTipoSeleccionado(null); }}
        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold transition-colors"
      >
        <Plus className="w-4 h-4" />
        Nueva promoción
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">
                {tipoSeleccionado
                  ? `Nueva promoción · ${TIPOS_PROMO.find(t => t.id === tipoSeleccionado)?.titulo}`
                  : "¿Qué tipo de promoción quieres crear?"}
              </h3>
              <button onClick={() => setOpen(false)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selector de tipo o Form */}
            <div className="p-5">
              {!tipoSeleccionado ? (
                <div className="grid grid-cols-2 gap-3">
                  {TIPOS_PROMO.map((t) => {
                    const Icon = t.icon;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setTipoSeleccionado(t.id)}
                        className="text-left border border-gray-200 hover:border-amber-400 hover:bg-amber-50/40 rounded-xl p-4 transition group"
                      >
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${t.color}20` }}>
                            <Icon className="w-5 h-5" style={{ color: t.color }} />
                          </div>
                          <div className="font-bold text-gray-800">{t.titulo}</div>
                        </div>
                        <div className="text-xs text-gray-600 mb-1">{t.descripcion}</div>
                        <div className="text-[11px] text-gray-400 italic">{t.ejemplo}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <FormPromocion
                  tipo={tipoSeleccionado}
                  clienteKey={clienteKey}
                  onBack={() => setTipoSeleccionado(null)}
                  onSaved={() => {
                    setOpen(false);
                    setTipoSeleccionado(null);
                    onCreated && onCreated();
                  }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────────────────────────────
//  FormPromocion — despacha al form específico según tipo
// ────────────────────────────────────────────────────────────
function FormPromocion({ tipo, clienteKey, onBack, onSaved, promoEdicion }) {
  const perfil = usePerfil();
  const [skuInput, setSkuInput] = useState("");
  const [form, setForm] = useState(() => ({
    titulo:                promoEdicion?.titulo || "",
    descripcion:           promoEdicion?.descripcion || "",
    fecha_inicio:          promoEdicion?.fecha_inicio?.slice(0, 10) || "",
    fecha_fin:             promoEdicion?.fecha_fin?.slice(0, 10) || "",
    skus:                  promoEdicion?.skus || [],
    monto_por_pieza:       promoEdicion?.monto_por_pieza ?? "",
    inventario_inicial:    promoEdicion?.inventario_inicial ?? "",
    precio_viejo:          promoEdicion?.precio_viejo ?? "",
    precio_nuevo:          promoEdicion?.precio_nuevo ?? "",
    fecha_baja_precio:     promoEdicion?.fecha_baja_precio?.slice(0, 10) || "",
    inventario_al_momento: promoEdicion?.inventario_al_momento ?? "",
    monto_total_bolsa:     promoEdicion?.monto_total_bolsa ?? "",
    notas:                 promoEdicion?.notas || "",
    estatus:               promoEdicion?.estatus || "borrador",
  }));
  const [guardando, setGuardando] = useState(false);

  // Snapshot automático de inventario inicial (para Sellout)
  // Trae el inventario MÁS RECIENTE por SKU y los suma.
  //   - PCEL: sellout_pcel (columna `inventario`)
  //   - Resto (digitalife/ml): inventario_cliente.stock
  // Nota: la BD tiene registros legacy con anio/semana NULL. Calculamos una
  // "clave de recencia" = anio*100 + semana y nos quedamos con el MAX por SKU
  // (ignora DB sort que pondría NULLs primero con ORDER BY DESC).
  async function snapshotInventario() {
    if (form.skus.length === 0) return toast.error("Agrega al menos un SKU primero");
    try {
      const skusNormalizados = form.skus.map((s) => String(s).trim());
      const esPcel = clienteKey === "pcel";

      let rows = [];
      if (esPcel) {
        const { data, error } = await supabase
          .from("sellout_pcel")
          .select("sku, anio, semana, inventario")
          .in("sku", skusNormalizados);
        if (error) throw error;
        rows = (data || []).map(r => ({
          sku: String(r.sku),
          stock: Number(r.inventario) || 0,
          aw: (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0),
        }));
      } else {
        const { data, error } = await supabase
          .from("inventario_cliente")
          .select("sku, stock, anio, semana")
          .eq("cliente", clienteKey)
          .in("sku", skusNormalizados);
        if (error) throw error;
        rows = (data || []).map(r => ({
          sku: String(r.sku),
          stock: Number(r.stock) || 0,
          aw: (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0),
        }));
      }

      // Quedarse con la fila de mayor `aw` (última semana real) por SKU
      const latest = {};
      rows.forEach(r => {
        if (!latest[r.sku] || r.aw > latest[r.sku].aw) latest[r.sku] = r;
      });

      const skusConInv = Object.keys(latest).length;
      const skusSinInv = form.skus.length - skusConInv;
      const total = Object.values(latest).reduce((s, r) => s + r.stock, 0);

      setForm((f) => ({ ...f, inventario_inicial: total }));

      let msg = `Snapshot: ${total.toLocaleString("es-MX")} pzs`;
      msg += ` · ${skusConInv}/${form.skus.length} SKUs encontrados`;
      if (skusSinInv > 0) msg += ` (${skusSinInv} sin datos)`;
      (total > 0 ? toast.success : toast.info)(msg);
    } catch (e) {
      toast.error("No se pudo traer el inventario: " + e.message);
    }
  }

  async function snapshotInventarioMomento() {
    if (form.skus.length === 0) return toast.error("Agrega al menos un SKU primero");
    await snapshotInventario();
    setForm((f) => ({ ...f, inventario_al_momento: f.inventario_inicial }));
  }

  function agregarSku() {
    const sku = (skuInput || "").trim().toUpperCase();
    if (!sku) return;
    if (form.skus.includes(sku)) { toast.info("Ese SKU ya está agregado"); setSkuInput(""); return; }
    setForm((f) => ({ ...f, skus: [...f.skus, sku] }));
    setSkuInput("");
  }
  function quitarSku(s) {
    setForm((f) => ({ ...f, skus: f.skus.filter((x) => x !== s) }));
  }

  async function guardar(estatusTarget = "borrador") {
    if (!form.titulo.trim()) return toast.error("Ponle un título a la promoción");
    // Sólo la fecha de inicio es obligatoria. La fecha fin puede quedar en blanco
    // ("indefinida") y se cierra después cuando se defina.
    if (!form.fecha_inicio) return toast.error("Fecha de inicio requerida");
    if (form.skus.length === 0 && tipo !== "bolsa") return toast.error("Agrega al menos un SKU");
    if (tipo === "sellout" || tipo === "sell_in") {
      if (!form.monto_por_pieza) return toast.error("Monto por pieza requerido");
    }
    if (tipo === "proteccion_precio") {
      if (!form.precio_viejo || !form.precio_nuevo) return toast.error("Precios viejo y nuevo requeridos");
      if (!form.fecha_baja_precio) return toast.error("Fecha de baja de precio requerida");
    }
    if (tipo === "bolsa") {
      if (!form.monto_total_bolsa) return toast.error("Monto total de la bolsa requerido");
    }

    const payload = {
      cliente: clienteKey,
      tipo,
      titulo: form.titulo.trim(),
      descripcion: form.descripcion.trim() || null,
      estatus: estatusTarget,
      fecha_inicio: form.fecha_inicio,
      fecha_fin: form.fecha_fin || null, // null = indefinida (se cierra después)
      skus: form.skus,
      notas: form.notas.trim() || null,
      creado_por: perfil?.user_id || null,
      monto_por_pieza: (tipo === "sellout" || tipo === "sell_in") ? Number(form.monto_por_pieza) : null,
      inventario_inicial: tipo === "sellout" ? (form.inventario_inicial !== "" ? Number(form.inventario_inicial) : null) : null,
      precio_viejo: tipo === "proteccion_precio" ? Number(form.precio_viejo) : null,
      precio_nuevo: tipo === "proteccion_precio" ? Number(form.precio_nuevo) : null,
      fecha_baja_precio: tipo === "proteccion_precio" ? form.fecha_baja_precio : null,
      inventario_al_momento: tipo === "proteccion_precio" ? (form.inventario_al_momento !== "" ? Number(form.inventario_al_momento) : null) : null,
      monto_total_bolsa: tipo === "bolsa" ? Number(form.monto_total_bolsa) : null,
    };

    setGuardando(true);
    let err;
    if (promoEdicion) {
      ({ error: err } = await supabase.from("promociones").update(payload).eq("id", promoEdicion.id));
    } else {
      ({ error: err } = await supabase.from("promociones").insert(payload));
    }
    setGuardando(false);
    if (err) return toast.error("No se pudo guardar: " + err.message);
    toast.success(promoEdicion ? "Promoción actualizada" : `Promoción creada como ${ESTATUS_PROMO[estatusTarget].label.toLowerCase()}`);
    onSaved && onSaved();
  }

  const tipoInfo = TIPOS_PROMO.find((t) => t.id === tipo);
  const TipoIcon = tipoInfo?.icon || Tag;

  return (
    <div>
      {/* Volver + tipo pill */}
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onBack} className="text-xs text-gray-500 hover:text-gray-700">← Cambiar tipo</button>
        <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold"
             style={{ backgroundColor: `${tipoInfo.color}20`, color: tipoInfo.color }}>
          <TipoIcon className="w-3.5 h-3.5" />
          {tipoInfo.titulo}
        </div>
      </div>

      <div className="space-y-3">
        <Field label="Título *">
          <input value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Ej. Promo Hot Sale — Teclados Mecánicos" autoFocus />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha inicio *">
            <input type="date" value={form.fecha_inicio}
              onChange={(e) => setForm({ ...form, fecha_inicio: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
          </Field>
          <Field label="Fecha fin (opcional — si no, queda indefinida)">
            <div className="flex gap-2">
              <input type="date" value={form.fecha_fin}
                onChange={(e) => setForm({ ...form, fecha_fin: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm" />
              {form.fecha_fin && (
                <button type="button" onClick={() => setForm({ ...form, fecha_fin: "" })}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-medium whitespace-nowrap"
                  title="Dejar indefinida">
                  Limpiar
                </button>
              )}
            </div>
          </Field>
        </div>

        {/* SKUs (no para Bolsa a menos que quieras) */}
        <Field label={tipo === "bolsa" ? "SKUs aplicables (opcional)" : "SKUs *"}>
          <div className="flex gap-2">
            <input
              value={skuInput}
              onChange={(e) => setSkuInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); agregarSku(); } }}
              className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm uppercase"
              placeholder="Ej. AC-920CM-NG" />
            <button type="button" onClick={agregarSku}
              className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-medium">
              Agregar
            </button>
          </div>
          {form.skus.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {form.skus.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 px-2 py-1 rounded text-xs font-mono">
                  {s}
                  <button onClick={() => quitarSku(s)} className="text-gray-400 hover:text-red-600">
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Field>

        {/* Campos específicos por tipo */}
        {(tipo === "sellout" || tipo === "sell_in") && (
          <Field label="Monto por pieza (MXN) *">
            <input type="number" step="0.01" value={form.monto_por_pieza}
              onChange={(e) => setForm({ ...form, monto_por_pieza: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Ej. 50" />
          </Field>
        )}

        {tipo === "sellout" && (
          <Field label="Inventario inicial (suma de todos los SKUs)">
            <div className="flex gap-2">
              <input type="number" value={form.inventario_inicial}
                onChange={(e) => setForm({ ...form, inventario_inicial: e.target.value })}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                placeholder="Piezas" />
              <button type="button" onClick={snapshotInventario}
                className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium whitespace-nowrap">
                📸 Snapshot auto
              </button>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Snapshot trae el inventario actual del cliente para los SKUs seleccionados. Puedes editarlo manualmente.
            </p>
          </Field>
        )}

        {tipo === "proteccion_precio" && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Precio viejo (MXN) *">
                <input type="number" step="0.01" value={form.precio_viejo}
                  onChange={(e) => setForm({ ...form, precio_viejo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Ej. 1000" />
              </Field>
              <Field label="Precio nuevo (MXN) *">
                <input type="number" step="0.01" value={form.precio_nuevo}
                  onChange={(e) => setForm({ ...form, precio_nuevo: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Ej. 800" />
              </Field>
            </div>
            <Field label="Fecha de baja de precio *">
              <input type="date" value={form.fecha_baja_precio}
                onChange={(e) => setForm({ ...form, fecha_baja_precio: e.target.value })}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" />
            </Field>
            <Field label="Inventario del cliente al momento de la baja">
              <div className="flex gap-2">
                <input type="number" value={form.inventario_al_momento}
                  onChange={(e) => setForm({ ...form, inventario_al_momento: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  placeholder="Piezas a proteger" />
                <button type="button" onClick={snapshotInventarioMomento}
                  className="px-3 py-2 bg-blue-100 hover:bg-blue-200 text-blue-700 rounded-lg text-xs font-medium whitespace-nowrap">
                  📸 Inventario actual
                </button>
              </div>
            </Field>
            {form.precio_viejo && form.precio_nuevo && form.inventario_al_momento && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <strong className="text-blue-800">Cálculo preliminar:</strong>{" "}
                ({formatMXN(form.precio_viejo)} − {formatMXN(form.precio_nuevo)}) × {form.inventario_al_momento} ={" "}
                <strong className="text-blue-900">
                  {formatMXN((Number(form.precio_viejo) - Number(form.precio_nuevo)) * Number(form.inventario_al_momento))}
                </strong>
              </div>
            )}
          </>
        )}

        {tipo === "bolsa" && (
          <Field label="Monto total de la bolsa (MXN) *">
            <input type="number" step="0.01" value={form.monto_total_bolsa}
              onChange={(e) => setForm({ ...form, monto_total_bolsa: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
              placeholder="Ej. 50000" />
          </Field>
        )}

        <Field label="Descripción (opcional)">
          <input value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
            placeholder="Detalles adicionales" />
        </Field>

        <Field label="Notas internas (opcional)">
          <textarea value={form.notas} onChange={(e) => setForm({ ...form, notas: e.target.value })}
            className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" rows={2}
            placeholder="Notas para el equipo" />
        </Field>
      </div>

      <div className="flex items-center justify-end gap-2 mt-5 pt-4 border-t border-gray-100">
        <button onClick={() => guardar("borrador")} disabled={guardando}
          className="px-4 py-2 rounded-lg text-sm text-gray-700 bg-gray-100 hover:bg-gray-200 disabled:opacity-50">
          Guardar como borrador
        </button>
        <button onClick={() => guardar("activa")} disabled={guardando}
          className="px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold disabled:opacity-50">
          {guardando ? "Guardando…" : "Crear y activar"}
        </button>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//  ListaPromociones — tarjetas de las promos del cliente
// ────────────────────────────────────────────────────────────
export function ListaPromociones({ clienteKey, refreshKey }) {
  const perfil = usePerfil();
  const canEdit = puedeEditarPestanaCliente(perfil, clienteKey, 'pagos');
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalEdit, setModalEdit] = useState(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from("promociones")
        .select("*")
        .eq("cliente", clienteKey)
        .order("fecha_fin", { ascending: false });
      setPromos(data || []);
      setLoading(false);
    })();
  }, [clienteKey, refreshKey]);

  async function cambiarEstatus(id, nuevo) {
    if (!canEdit) return;
    setPromos((prev) => prev.map((p) => (p.id === id ? { ...p, estatus: nuevo } : p)));
    const { error } = await supabase.from("promociones").update({ estatus: nuevo }).eq("id", id);
    if (error) { toast.error("No se pudo actualizar: " + error.message); return; }
    toast.success(`Estatus cambiado a ${ESTATUS_PROMO[nuevo].label}`);
  }

  async function borrar(id) {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta promoción?")) return;
    setPromos((prev) => prev.filter((p) => p.id !== id));
    const { error } = await supabase.from("promociones").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    toast.success("Promoción eliminada");
  }

  if (loading) return <p className="text-sm text-gray-400 italic p-4">Cargando promociones…</p>;

  if (promos.length === 0) {
    return (
      <div className="bg-gray-50 rounded-xl border border-dashed border-gray-200 p-6 text-center">
        <p className="text-sm text-gray-500">Aún no hay promociones registradas.</p>
        <p className="text-xs text-gray-400 mt-1">Usa "Nueva promoción" para crear la primera.</p>
      </div>
    );
  }

  // Agrupar por estatus
  const porEstatus = {};
  promos.forEach((p) => {
    const e = p.estatus || "borrador";
    if (!porEstatus[e]) porEstatus[e] = [];
    porEstatus[e].push(p);
  });

  const ORDEN = ["activa", "por_calcular", "aprobada", "borrador", "pagada", "cancelada"];

  return (
    <div className="space-y-4">
      {ORDEN.filter((e) => porEstatus[e]?.length > 0).map((estatus) => {
        const info = ESTATUS_PROMO[estatus];
        const items = porEstatus[estatus];
        return (
          <div key={estatus}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: info.dot }} />
              <h4 className="text-xs font-bold uppercase tracking-wider text-gray-600">{info.label}</h4>
              <span className="text-xs text-gray-400">({items.length})</span>
            </div>
            <div className="space-y-2">
              {items.map((p) => (
                <PromoCard
                  key={p.id}
                  promo={p}
                  clienteKey={clienteKey}
                  canEdit={canEdit}
                  onCambiarEstatus={cambiarEstatus}
                  onEditar={() => setModalEdit(p)}
                  onBorrar={() => borrar(p.id)}
                  onRefresh={async () => {
                    const { data } = await supabase.from("promociones").select("*").eq("cliente", clienteKey).order("fecha_fin", { ascending: false });
                    setPromos(data || []);
                  }}
                />
              ))}
            </div>
          </div>
        );
      })}

      {modalEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: "rgba(0,0,0,0.5)" }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="font-bold text-gray-800 text-lg">
                Editar · {TIPOS_PROMO.find(t => t.id === modalEdit.tipo)?.titulo}
              </h3>
              <button onClick={() => setModalEdit(null)} className="p-1 rounded hover:bg-gray-100 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5">
              <FormPromocion
                tipo={modalEdit.tipo}
                clienteKey={clienteKey}
                promoEdicion={modalEdit}
                onBack={() => setModalEdit(null)}
                onSaved={() => {
                  setModalEdit(null);
                  // recarga
                  supabase.from("promociones").select("*").eq("cliente", clienteKey)
                    .order("fecha_fin", { ascending: false })
                    .then(({ data }) => setPromos(data || []));
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const MESES_LARGOS = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

// ────────────────────────────────────────────────────────────────────
//  SelloutCierreMes — pagos mensuales para promociones tipo "sellout"
// ────────────────────────────────────────────────────────────────────
// Cada mes, lo que vendió el cliente al consumidor final se paga al
// cliente. Este componente:
//   - muestra historial de cierres mensuales (tabla de pagos.promocion_id)
//   - muestra progreso vs inventario inicial
//   - permite cerrar un mes (calcula sellout real + crea pago)
//   - permite "pagar el resto" del inventario
//   - permite cerrar manual (sin pago)
function SelloutCierreMes({ promo, clienteKey, canEdit, onChange }) {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mesSel, setMesSel] = useState(""); // "YYYY-MM"
  const [procesando, setProcesando] = useState(false);

  const cargar = React.useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("pagos")
      .select("id, concepto, monto, estatus, fecha_compromiso, fecha_pago_real, mes_sellout, anio_sellout, piezas_mes, folio, notas")
      .eq("promocion_id", promo.id)
      .order("anio_sellout", { ascending: true })
      .order("mes_sellout", { ascending: true })
      .order("created_at", { ascending: true });
    setHistorial(data || []);
    setLoading(false);
  }, [promo.id]);

  useEffect(() => { cargar(); }, [cargar]);

  const piezasInicial = Number(promo.inventario_inicial || 0);
  const piezasPagadas = Number(promo.piezas_pagadas_acum || 0);
  const piezasRestantes = Math.max(0, piezasInicial - piezasPagadas);
  const pct = piezasInicial > 0 ? Math.min(100, (piezasPagadas / piezasInicial * 100)) : 0;

  // Meses disponibles = desde fecha_inicio.mes hasta mes anterior al actual,
  // restando los ya cerrados (con pago con mes/anio_sellout no nulos).
  const mesesDisponibles = useMemo(() => {
    if (!promo.fecha_inicio) return [];
    const out = [];
    const start = new Date(promo.fecha_inicio + "T00:00:00");
    const hoy = new Date();
    // último mes cerrado completo = mes anterior al actual
    const limite = new Date(hoy.getFullYear(), hoy.getMonth(), 1); // 1er día del mes actual
    if (promo.fecha_fin) {
      const finProm = new Date(promo.fecha_fin + "T00:00:00");
      const finMes1 = new Date(finProm.getFullYear(), finProm.getMonth() + 1, 1);
      if (finMes1 < limite) limite.setTime(finMes1.getTime());
    }
    const cerradosSet = new Set(
      historial
        .filter(p => p.mes_sellout && p.anio_sellout)
        .map(p => `${p.anio_sellout}-${String(p.mes_sellout).padStart(2,"0")}`)
    );
    let cur = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cur < limite) {
      const a = cur.getFullYear();
      const m = cur.getMonth() + 1;
      const k = `${a}-${String(m).padStart(2,"0")}`;
      if (!cerradosSet.has(k)) out.push({ anio: a, mes: m, key: k, label: `${MESES_LARGOS[m-1]} ${a}` });
      cur.setMonth(cur.getMonth() + 1);
    }
    return out;
  }, [promo.fecha_inicio, promo.fecha_fin, historial]);

  async function calcularPiezasVendidasMes(anio, mes) {
    if (clienteKey === "pcel") {
      const { data, error } = await supabase
        .from("sellout_pcel_mensual")
        .select("piezas, sku")
        .eq("anio", anio).eq("mes", mes)
        .in("sku", promo.skus);
      if (error) throw error;
      return (data || []).reduce((s, r) => s + (Number(r.piezas) || 0), 0);
    } else {
      // digitalife / ml: sellout_detalle por rango de fechas
      const pad = (n) => String(n).padStart(2, "0");
      const finDia = new Date(anio, mes, 0).getDate(); // último día del mes
      const inicio = `${anio}-${pad(mes)}-01`;
      const fin = `${anio}-${pad(mes)}-${pad(finDia)}`;
      const { data, error } = await supabase
        .from("sellout_detalle")
        .select("cantidad, no_parte")
        .eq("cliente", clienteKey)
        .gte("fecha", inicio).lte("fecha", fin)
        .in("no_parte", promo.skus);
      if (error) throw error;
      return (data || []).reduce((s, r) => s + (Number(r.cantidad) || 0), 0);
    }
  }

  async function cerrarMes() {
    if (!canEdit) return;
    if (!mesSel) return toast.error("Elige el mes a cerrar");
    const [anioStr, mesStr] = mesSel.split("-");
    const anio = Number(anioStr), mes = Number(mesStr);
    setProcesando(true);
    try {
      const piezasReales = await calcularPiezasVendidasMes(anio, mes);
      if (piezasReales <= 0) {
        const seguir = confirm(`No se encontraron ventas en ${MESES_LARGOS[mes-1]} ${anio} para estos SKUs. ¿Crear el pago en $0 de todos modos?`);
        if (!seguir) { setProcesando(false); return; }
      }
      // Topear al restante del inventario
      const piezasPago = Math.min(piezasReales, piezasRestantes > 0 ? piezasRestantes : piezasReales);
      if (piezasRestantes > 0 && piezasReales > piezasRestantes) {
        toast.info(`Solo quedan ${piezasRestantes} pzs del inventario inicial. Se pagan ${piezasRestantes}, no las ${piezasReales} vendidas.`);
      }
      const monto = piezasPago * Number(promo.monto_por_pieza || 0);
      const nextMes = mes === 12 ? 1 : mes + 1;
      const nextAnio = mes === 12 ? anio + 1 : anio;
      const pad = (n) => String(n).padStart(2, "0");
      const fechaCompromiso = `${nextAnio}-${pad(nextMes)}-15`;
      const concepto = `Sellout ${promo.titulo} — ${MESES_LARGOS[mes-1]} ${anio} — ${piezasPago} pzs × ${formatMXN(promo.monto_por_pieza)}`;

      const { error } = await supabase.from("pagos").insert({
        cliente: clienteKey,
        categoria: "promociones",
        concepto,
        monto,
        estatus: "pendiente",
        fecha_compromiso: fechaCompromiso,
        responsable: "Fernando Cabrera",
        promocion_id: promo.id,
        mes_sellout: mes,
        anio_sellout: anio,
        piezas_mes: piezasPago,
      });
      if (error) throw error;
      toast.success(`Pago creado: ${formatMXN(monto)} compromiso ${formatFecha(fechaCompromiso)}`);
      // Si con este pago se acabó el inventario inicial, auto-cerrar
      const nuevoAcum = piezasPagadas + piezasPago;
      if (piezasInicial > 0 && nuevoAcum >= piezasInicial) {
        await supabase.from("promociones")
          .update({ cerrada_por_inventario: true, cerrada_at: new Date().toISOString(), estatus: "pagada" })
          .eq("id", promo.id);
        toast.success("Inventario inicial alcanzado — promoción cerrada automáticamente");
      }
      setMesSel("");
      await cargar();
      onChange && onChange();
    } catch (e) {
      toast.error("Error al cerrar mes: " + (e?.message || e));
    } finally {
      setProcesando(false);
    }
  }

  async function pagarInventarioRestante() {
    if (!canEdit) return;
    if (piezasRestantes <= 0) return toast.info("No quedan piezas por pagar");
    if (!confirm(`Pagar el restante de ${piezasRestantes} pzs (${formatMXN(piezasRestantes * Number(promo.monto_por_pieza || 0))}) y cerrar la promoción?`)) return;
    setProcesando(true);
    try {
      const monto = piezasRestantes * Number(promo.monto_por_pieza || 0);
      const hoy = new Date();
      const nextMes = hoy.getMonth() + 2 > 12 ? 1 : hoy.getMonth() + 2;
      const nextAnio = hoy.getMonth() + 2 > 12 ? hoy.getFullYear() + 1 : hoy.getFullYear();
      const pad = (n) => String(n).padStart(2, "0");
      const fechaCompromiso = `${nextAnio}-${pad(nextMes)}-15`;

      const { error: eIns } = await supabase.from("pagos").insert({
        cliente: clienteKey,
        categoria: "promociones",
        concepto: `Sellout ${promo.titulo} — Resto inventario ${piezasRestantes} pzs × ${formatMXN(promo.monto_por_pieza)}`,
        monto,
        estatus: "pendiente",
        fecha_compromiso: fechaCompromiso,
        responsable: "Fernando Cabrera",
        promocion_id: promo.id,
        piezas_mes: piezasRestantes, // sin mes/anio_sellout → es "ajuste final"
      });
      if (eIns) throw eIns;
      await supabase.from("promociones")
        .update({ cerrada_manual: true, cerrada_at: new Date().toISOString(), estatus: "pagada" })
        .eq("id", promo.id);
      toast.success(`Pago final de ${formatMXN(monto)} creado. Promoción cerrada.`);
      await cargar();
      onChange && onChange();
    } catch (e) {
      toast.error("Error: " + (e?.message || e));
    } finally {
      setProcesando(false);
    }
  }

  async function cerrarManual() {
    if (!canEdit) return;
    if (!confirm("Cerrar la promoción manualmente SIN generar pago del restante. ¿Continuar?")) return;
    setProcesando(true);
    try {
      const { error } = await supabase.from("promociones")
        .update({ cerrada_manual: true, cerrada_at: new Date().toISOString(), estatus: "cancelada" })
        .eq("id", promo.id);
      if (error) throw error;
      toast.success("Promoción cerrada manualmente");
      onChange && onChange();
    } catch (e) {
      toast.error("Error: " + (e?.message || e));
    } finally {
      setProcesando(false);
    }
  }

  const estaCerrada = promo.cerrada_manual || promo.cerrada_por_inventario || ["pagada","cancelada"].includes(promo.estatus);

  return (
    <div className="mt-3 pt-3 border-t border-gray-200 space-y-3">
      {/* Progreso */}
      <div>
        <div className="flex justify-between items-baseline mb-1 text-xs">
          <strong className="text-gray-700">Pagos mensuales de sellout</strong>
          <span className="text-gray-500">
            {piezasPagadas.toLocaleString("es-MX")} / {piezasInicial.toLocaleString("es-MX")} pzs pagadas
            {piezasInicial > 0 && <span className="text-gray-400"> · {pct.toFixed(0)}%</span>}
          </span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
          <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
        </div>
        {piezasInicial > 0 && (
          <div className="text-[11px] text-gray-500 mt-1">
            Restan por pagar: <strong>{piezasRestantes.toLocaleString("es-MX")} pzs</strong>{" "}
            ({formatMXN(piezasRestantes * Number(promo.monto_por_pieza || 0))})
          </div>
        )}
      </div>

      {/* Historial */}
      {loading ? (
        <p className="text-[11px] text-gray-400 italic">Cargando historial…</p>
      ) : historial.length === 0 ? (
        <p className="text-[11px] text-gray-400 italic">Aún no hay pagos mensuales generados.</p>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-2 py-1.5 text-left font-semibold">Periodo</th>
                <th className="px-2 py-1.5 text-right font-semibold">Piezas</th>
                <th className="px-2 py-1.5 text-right font-semibold">Monto</th>
                <th className="px-2 py-1.5 text-left font-semibold">Compromiso</th>
                <th className="px-2 py-1.5 text-left font-semibold">Estatus</th>
              </tr>
            </thead>
            <tbody>
              {historial.map(p => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="px-2 py-1.5">
                    {p.mes_sellout && p.anio_sellout
                      ? `${MESES_LARGOS[p.mes_sellout-1]} ${p.anio_sellout}`
                      : <span className="italic text-gray-500">Ajuste final</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono">{Number(p.piezas_mes || 0).toLocaleString("es-MX")}</td>
                  <td className="px-2 py-1.5 text-right font-semibold">{formatMXN(p.monto)}</td>
                  <td className="px-2 py-1.5">{p.fecha_compromiso ? formatFecha(p.fecha_compromiso) : "—"}</td>
                  <td className="px-2 py-1.5">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      p.estatus === "pagado" ? "bg-emerald-100 text-emerald-700"
                      : p.estatus === "pendiente" ? "bg-amber-100 text-amber-700"
                      : "bg-gray-100 text-gray-600"
                    }`}>{p.estatus || "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Acciones */}
      {canEdit && !estaCerrada && (
        <div className="flex items-end gap-2 flex-wrap">
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-semibold text-gray-600 uppercase mb-1">Cerrar mes</label>
            <select
              value={mesSel}
              onChange={e => setMesSel(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs"
              disabled={procesando}
            >
              <option value="">— Elige un mes —</option>
              {mesesDisponibles.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
            </select>
          </div>
          <button
            onClick={cerrarMes}
            disabled={!mesSel || procesando}
            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white rounded text-xs font-semibold whitespace-nowrap"
          >
            {procesando ? "Procesando…" : "Cerrar mes"}
          </button>
          {piezasRestantes > 0 && (
            <button
              onClick={pagarInventarioRestante}
              disabled={procesando}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white rounded text-xs font-semibold"
              title="Paga el resto del inventario como si se hubiera vendido y cierra la promo"
            >
              Pagar restante
            </button>
          )}
          <button
            onClick={cerrarManual}
            disabled={procesando}
            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded text-xs font-semibold border border-gray-300"
            title="Cierra la promoción sin pagar el resto"
          >
            Cerrar manual
          </button>
        </div>
      )}

      {estaCerrada && (
        <div className="text-[11px] text-gray-500 italic">
          {promo.cerrada_por_inventario && "Cerrada automáticamente al agotar inventario inicial."}
          {promo.cerrada_manual && "Cerrada manualmente."}
          {!promo.cerrada_por_inventario && !promo.cerrada_manual && `Estatus actual: ${promo.estatus}`}
        </div>
      )}
    </div>
  );
}

function PromoCard({ promo, canEdit, clienteKey, onCambiarEstatus, onEditar, onBorrar, onRefresh }) {
  const [open, setOpen] = useState(false);
  const tipoInfo = TIPOS_PROMO.find((t) => t.id === promo.tipo);
  const TipoIcon = tipoInfo?.icon || Tag;
  const estInfo = ESTATUS_PROMO[promo.estatus] || ESTATUS_PROMO.borrador;

  // Monto estimado para mostrar
  let montoEstimado = null;
  if (promo.tipo === "sellout" && promo.inventario_inicial && promo.monto_por_pieza) {
    montoEstimado = promo.inventario_inicial * promo.monto_por_pieza;
  } else if (promo.tipo === "sell_in" && promo.monto_por_pieza) {
    montoEstimado = null; // depende de compras
  } else if (promo.tipo === "proteccion_precio" && promo.precio_viejo && promo.precio_nuevo && promo.inventario_al_momento) {
    montoEstimado = (Number(promo.precio_viejo) - Number(promo.precio_nuevo)) * Number(promo.inventario_al_momento);
  } else if (promo.tipo === "bolsa") {
    montoEstimado = promo.monto_total_bolsa;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="p-3 flex items-start gap-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
             style={{ backgroundColor: `${tipoInfo?.color || "#999"}20` }}>
          <TipoIcon className="w-5 h-5" style={{ color: tipoInfo?.color || "#999" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h5 className="font-semibold text-gray-800 truncate">{promo.titulo}</h5>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${estInfo.bg} ${estInfo.text}`}>
              {estInfo.label}
            </span>
          </div>
          <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-3 flex-wrap">
            <span className="inline-flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {formatFecha(promo.fecha_inicio)} → {promo.fecha_fin ? formatFecha(promo.fecha_fin) : <span className="italic text-gray-400">indefinida</span>}
            </span>
            {promo.skus?.length > 0 && (
              <span className="inline-flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {promo.skus.length} SKU{promo.skus.length !== 1 ? "s" : ""}
              </span>
            )}
            {montoEstimado !== null && (
              <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold">
                <DollarSign className="w-3 h-3" />
                {formatMXN(montoEstimado)} estimado
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => setOpen(!open)} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {canEdit && (
            <>
              <button onClick={onEditar} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Editar">
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button onClick={onBorrar} className="p-1.5 rounded hover:bg-red-100 text-red-500" title="Eliminar">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {open && (
        <div className="border-t border-gray-100 bg-gray-50/50 px-3 py-2.5 space-y-2 text-xs">
          {promo.descripcion && <p><strong>Descripción:</strong> {promo.descripcion}</p>}
          {promo.skus?.length > 0 && (
            <p>
              <strong>SKUs:</strong>{" "}
              <span className="font-mono text-gray-700">{promo.skus.join(", ")}</span>
            </p>
          )}

          {promo.tipo === "sellout" && (
            <>
              <p><strong>Monto/pieza:</strong> {formatMXN(promo.monto_por_pieza)} · <strong>Inv. inicial:</strong> {promo.inventario_inicial}</p>
              <SelloutCierreMes
                promo={promo}
                clienteKey={clienteKey}
                canEdit={canEdit}
                onChange={onRefresh}
              />
            </>
          )}
          {promo.tipo === "sell_in" && (
            <p><strong>Monto/pieza comprada:</strong> {formatMXN(promo.monto_por_pieza)}</p>
          )}
          {promo.tipo === "proteccion_precio" && (
            <p>
              <strong>Precio viejo:</strong> {formatMXN(promo.precio_viejo)} ·{" "}
              <strong>nuevo:</strong> {formatMXN(promo.precio_nuevo)} ·{" "}
              <strong>baja:</strong> {formatFecha(promo.fecha_baja_precio)} ·{" "}
              <strong>inv. al momento:</strong> {promo.inventario_al_momento}
            </p>
          )}
          {promo.tipo === "bolsa" && (
            <p><strong>Monto total:</strong> {formatMXN(promo.monto_total_bolsa)}</p>
          )}
          {promo.notas && <p className="italic text-gray-500">"{promo.notas}"</p>}

          {/* Cambio rápido de estatus */}
          {canEdit && (
            <div className="flex items-center gap-1 flex-wrap pt-2 border-t border-gray-200">
              <span className="text-[10px] text-gray-500 uppercase font-semibold mr-1">Cambiar estatus:</span>
              {Object.entries(ESTATUS_PROMO).filter(([id]) => id !== promo.estatus).map(([id, info]) => (
                <button
                  key={id}
                  onClick={() => onCambiarEstatus(promo.id, id)}
                  className={`text-[10px] px-2 py-0.5 rounded ${info.bg} ${info.text} hover:brightness-95 font-semibold`}
                >
                  {info.label}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
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
