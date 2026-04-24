import React, { useState, useEffect } from "react";
import { supabase } from '../../lib/supabase';

const ROLES = [
  { value: "super_admin", label: "Super Admin",   desc: "Control total. Único que gestiona usuarios y sube datos." },
  { value: "admin",       label: "Administrador", desc: "Edita datos pero no gestiona usuarios ni sube datos." },
  { value: "asistente",   label: "Asistente",     desc: "Acceso a clientes asignados. Edita si tiene permiso." },
  { value: "cliente",     label: "Cliente",       desc: "Ve solo SU cliente y pestañas marcadas. Read-only." },
  { value: "viewer",      label: "Viewer",        desc: "Solo lectura. Nunca edita." },
];

const PESTANAS_OPT = [
  { value: "home",       label: "Resumen",                 desc: "Dashboard inicial con KPIs del cliente" },
  { value: "analisis",   label: "Análisis",                desc: "Ventas, tendencias y gráficas" },
  { value: "estrategia", label: "Estrategia de Producto",  desc: "Sugeridos de compra, SKUs en riesgo, Excel" },
  { value: "marketing",  label: "Marketing",               desc: "Actividades de marketing del cliente" },
  { value: "pagos",      label: "Pagos",                   desc: "Promociones, rebate, SPIFF, pagos fijos" },
  { value: "cartera",    label: "Crédito y Cobranza",      desc: "Cartera vencida, aging, DSO" },
];

const CLIENTES_OPT = [
  { value: "digitalife",   label: "Digitalife",    desc: "Acteck / Balam Rush" },
  { value: "pcel",         label: "PCEL",          desc: "PC Online" },
  { value: "mercadolibre", label: "Mercado Libre", desc: "Publico General ML" },
];

const MODULOS_OPT = [
  { value: "comercial",   label: "Área Comercial",        desc: "Acceso a clientes (resumen, pagos, cobranza, etc.)" },
  { value: "marketing",   label: "Marketing General",     desc: "Estrategia de marketing corporativa (próximo)" },
  { value: "pnl",         label: "Estado de Resultados",  desc: "P&L corporativo (próximo)" },
  { value: "operaciones", label: "Operaciones",           desc: "Logística y almacenes (próximo)" },
  { value: "compras",     label: "Compras",               desc: "Compras a proveedores (próximo)" },
  { value: "rrhh",        label: "RRHH",                  desc: "Recursos humanos (próximo)" },
  { value: "finanzas",    label: "Finanzas",              desc: "Tesorería y presupuesto (próximo)" },
  { value: "kpis",        label: "KPIs Ejecutivos",       desc: "Dashboard para dirección (próximo)" },
];

// Plantillas por rol — se aplican al CAMBIAR el rol en el form,
// reemplazando los checks con los defaults típicos de ese rol.
// Fernando (super_admin) puede destildar después si hace falta.
const PLANTILLAS_ROL = {
  super_admin: {
    clientes:         ["digitalife", "pcel", "mercadolibre"],
    modulos:          ["comercial","marketing","pnl","operaciones","compras","rrhh","finanzas","kpis"],
    pestanas_cliente: [],
    puede_editar:     true,
  },
  admin: {
    clientes:         ["digitalife", "pcel", "mercadolibre"],
    modulos:          ["comercial","marketing","pnl","operaciones","compras","rrhh","finanzas","kpis"],
    pestanas_cliente: [],
    puede_editar:     true,
  },
  asistente: {
    // Default operativo: área comercial + marketing, todos los clientes, con edición.
    clientes:         ["digitalife", "pcel", "mercadolibre"],
    modulos:          ["comercial","marketing"],
    pestanas_cliente: [],
    puede_editar:     true,
  },
  viewer: {
    // Solo lectura pero con acceso al comercial por default. Fernando
    // ajusta clientes específicos.
    clientes:         [],
    modulos:          ["comercial"],
    pestanas_cliente: [],
    puede_editar:     false,
  },
  cliente: {
    // Empleado del cliente: ve SU cliente y solo pestañas seleccionadas.
    // Fernando debe marcar cuál cliente y cuáles pestañas.
    clientes:         [],
    modulos:          ["comercial"],
    pestanas_cliente: ["home", "analisis", "estrategia"],  // defaults usuales
    puede_editar:     false,
  },
};

export default function Configuracion({ session }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "viewer", clientes: [], modulos: ["comercial"], pestanas_cliente: [], puede_editar: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [miUserId, setMiUserId] = useState(null);

  useEffect(() => {
    fetchUsuarios();
    // Identificar al usuario actual para destacar su fila en la tabla
    supabase.auth.getUser().then(({ data }) => setMiUserId(data?.user?.id || null));
  }, []);

  async function fetchUsuarios() {
    setLoading(true);
    const { data } = await supabase.from("perfiles").select("*").order("created_at", { ascending: true });
    setUsuarios(data || []);
    setLoading(false);
  }

  function toggleArray(arr, val) {
    return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val];
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (editingId) {
        const updates = { nombre: form.nombre, rol: form.rol, clientes: form.clientes, modulos: form.modulos, pestanas_cliente: form.pestanas_cliente, puede_editar: form.puede_editar };
        const body = { perfil_id: editingId, updates };
        if (form.password) body.new_password = form.password;
        const res = await fetch("/api/admin/update-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify(body)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMsg("Usuario actualizado");
      } else {
        if (!form.password) throw new Error("La contraseña es requerida");
        const res = await fetch("/api/admin/create-user", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify(form)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMsg("Usuario creado exitosamente");
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ nombre: "", email: "", password: "", rol: "viewer", clientes: [], modulos: ["comercial"], pestanas_cliente: [], puede_editar: false });
      fetchUsuarios();
    } catch (err) {
      setMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u) {
    setEditingId(u.id);
    setForm({ nombre: u.nombre, email: u.email, password: "", rol: u.rol, clientes: u.clientes || [], modulos: u.modulos || [], pestanas_cliente: u.pestanas_cliente || [], puede_editar: u.puede_editar });
    setShowForm(true);
  }

  async function toggleActivo(u) {
    const token = (await supabase.auth.getSession()).data.session?.access_token;
    await fetch("/api/admin/update-user", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
      body: JSON.stringify({ perfil_id: u.id, updates: { activo: !u.activo } })
    });
    fetchUsuarios();
  }

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
          <p className="text-sm text-gray-400">Gestión de usuarios y permisos</p>
        </div>
        <button onClick={() => { setShowForm(true); setEditingId(null); setForm({ nombre: "", email: "", password: "", rol: "viewer", clientes: [], modulos: ["comercial"], pestanas_cliente: [], puede_editar: false }); }} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">+ Nuevo usuario</button>
      </div>

      {msg && <div className={"mb-4 p-3 rounded-xl text-sm " + (msg.startsWith("Error") ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-600 border border-green-200")}>{msg}</div>}

      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">{editingId ? "Editar usuario" : "Nuevo usuario"}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})} disabled={!!editingId} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-50" placeholder="usuario@acteck.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">{editingId ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}</label>
              <input type="password" value={form.password} onChange={e => setForm({...form, password: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm" placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Rol</label>
              <select value={form.rol} onChange={e => {
                const nuevoRol = e.target.value;
                // Al cambiar de rol, aplicar la plantilla default (solo si estamos
                // creando nuevo usuario o si el rol cambia respecto al guardado).
                // Preserva nombre/email/password — solo reemplaza permisos.
                const plantilla = PLANTILLAS_ROL[nuevoRol];
                if (plantilla) {
                  setForm({ ...form, rol: nuevoRol, ...plantilla });
                } else {
                  setForm({ ...form, rol: nuevoRol });
                }
              }} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Al cambiar de rol se aplican permisos default. Puedes ajustar abajo.
              </p>
            </div>
          </div>
          {/* ═══ Permisos — checklist con label izquierda + check derecha ═══ */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <SeccionPermisos
              titulo="Clientes asignados"
              subtitulo="El usuario tendrá acceso a estos clientes"
              opciones={CLIENTES_OPT}
              seleccionados={form.clientes}
              onToggle={(v) => setForm({ ...form, clientes: toggleArray(form.clientes, v) })}
              onAll={() => setForm({ ...form, clientes: CLIENTES_OPT.map(o => o.value) })}
              onNone={() => setForm({ ...form, clientes: [] })}
              color="blue"
            />
            <SeccionPermisos
              titulo="Módulos permitidos"
              subtitulo="Áreas del dashboard a las que tiene acceso"
              opciones={MODULOS_OPT}
              seleccionados={form.modulos}
              onToggle={(v) => setForm({ ...form, modulos: toggleArray(form.modulos, v) })}
              onAll={() => setForm({ ...form, modulos: MODULOS_OPT.map(o => o.value) })}
              onNone={() => setForm({ ...form, modulos: [] })}
              color="indigo"
            />
          </div>

          {form.rol === "cliente" && (
            <div className="mb-4">
              <SeccionPermisos
                titulo="Pestañas visibles"
                subtitulo="El usuario-cliente solo verá estas pestañas dentro de su cliente asignado"
                opciones={PESTANAS_OPT}
                seleccionados={form.pestanas_cliente}
                onToggle={(v) => setForm({ ...form, pestanas_cliente: toggleArray(form.pestanas_cliente, v) })}
                onAll={() => setForm({ ...form, pestanas_cliente: PESTANAS_OPT.map(o => o.value) })}
                onNone={() => setForm({ ...form, pestanas_cliente: [] })}
                color="green"
              />
            </div>
          )}

          {(form.rol === "asistente" || form.rol === "admin") && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-800">Puede editar datos</p>
                <p className="text-xs text-gray-500">Si está desactivado, será solo lectura (como un viewer)</p>
              </div>
              <input type="checkbox"
                     checked={form.puede_editar}
                     onChange={e => setForm({...form, puede_editar: e.target.checked})}
                     className="w-5 h-5 rounded text-amber-600 focus:ring-amber-500 cursor-pointer" />
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">{saving ? "Guardando..." : (editingId ? "Guardar cambios" : "Crear usuario")}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">Cancelar</button>
          </div>
        </div>
      )}

      {/* Barra de búsqueda */}
      <div className="mb-3 flex items-center gap-2">
        <input
          type="text"
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por nombre o correo…"
          className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
        />
        {busqueda && (
          <button onClick={() => setBusqueda("")} className="text-xs text-gray-500 hover:underline">Limpiar</button>
        )}
        <span className="text-xs text-gray-400">
          {usuarios.filter(u =>
            !busqueda ||
            (u.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
            (u.email  || "").toLowerCase().includes(busqueda.toLowerCase())
          ).length} / {usuarios.length} usuario(s)
        </span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Usuario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Clientes</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Módulos</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Pestañas visibles</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Edita</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">Cargando usuarios...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-gray-400">No hay usuarios registrados</td></tr>
            ) : usuarios
                .filter(u =>
                  !busqueda ||
                  (u.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
                  (u.email  || "").toLowerCase().includes(busqueda.toLowerCase())
                )
                .map(u => {
                  const soyYo = u.user_id && u.user_id === miUserId;
                  // Validación visual: ¿este usuario puede ver algo?
                  const esExterno   = u.rol === "cliente" || u.rol === "viewer";
                  const esInterno   = ["super_admin","admin","asistente"].includes(u.rol);
                  const sinClientes = (u.clientes || []).length === 0 && u.rol !== "super_admin" && u.rol !== "admin";
                  const sinModulos  = (u.modulos  || []).length === 0 && u.rol !== "super_admin";
                  const sinPestanas = u.rol === "cliente" && (u.pestanas_cliente || []).length === 0;
                  const tieneWarn   = sinClientes || sinModulos || sinPestanas;
                  const rolMeta     = ROLES.find(r => r.value === u.rol);
                  const pestanasLabel = u.rol === "cliente"
                    ? ((u.pestanas_cliente || []).length > 0
                        ? (u.pestanas_cliente || []).map(p => PESTANAS_OPT.find(x => x.value === p)?.label || p).join(", ")
                        : "— ninguna —")
                    : "Todas las asignadas";
                  return (
              <tr key={u.id} className={
                "border-t " +
                (!u.activo ? "opacity-50 " : "") +
                (soyYo ? "bg-blue-50/40 " : "")
              }>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800 flex items-center gap-1.5">
                    {u.nombre}
                    {soyYo && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-semibold">TÚ</span>}
                    {tieneWarn && <span title={`${sinClientes ? "Sin clientes asignados. " : ""}${sinModulos ? "Sin módulos asignados — no podrá ver ninguna pestaña. " : ""}${sinPestanas ? "Cliente sin pestañas seleccionadas." : ""}`}
                                       className="text-[11px] text-amber-600">⚠️</span>}
                  </p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={"px-2 py-1 rounded-lg text-xs font-medium " + (u.rol === "super_admin" ? "bg-purple-100 text-purple-700" : u.rol === "admin" ? "bg-indigo-100 text-indigo-700" : u.rol === "asistente" ? "bg-blue-100 text-blue-700" : u.rol === "cliente" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")}
                        title={rolMeta?.desc || ""}>
                    {rolMeta?.label || u.rol}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {u.rol === "super_admin" ? <span className="italic text-gray-400">Todos</span>
                   : (u.clientes || []).length > 0
                      ? (u.clientes || []).map(c => CLIENTES_OPT.find(x => x.value === c)?.label || c).join(", ")
                      : <span className="text-amber-600">— sin clientes —</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {u.rol === "super_admin" ? <span className="italic text-gray-400">Todos</span>
                   : (u.modulos || []).length > 0
                      ? (u.modulos || []).map(m => MODULOS_OPT.find(x => x.value === m)?.label || m).join(", ")
                      : <span className="text-amber-600">— sin módulos —</span>}
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">
                  {pestanasLabel}
                </td>
                <td className="px-4 py-3 text-center">{u.puede_editar ? <span className="text-green-600 font-semibold">Sí</span> : <span className="text-gray-400">No</span>}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActivo(u)}
                          className={"px-2 py-1 rounded-lg text-xs font-medium " + (u.activo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200")}
                          title={u.activo ? "Click para desactivar" : "Click para reactivar"}>
                    {u.activo ? "Activo" : "Inactivo"}
                  </button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => startEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                </td>
              </tr>
                  );
                })}
          </tbody>
        </table>
        </div>
      </div>

      {/* Leyenda de roles — explica de un vistazo qué hace cada uno */}
      <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Referencia rápida de roles</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {ROLES.map(r => (
            <div key={r.value} className="flex items-start gap-2">
              <span className={"px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 " +
                (r.value === "super_admin" ? "bg-purple-100 text-purple-700" :
                 r.value === "admin" ? "bg-indigo-100 text-indigo-700" :
                 r.value === "asistente" ? "bg-blue-100 text-blue-700" :
                 r.value === "cliente" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")
              }>{r.label}</span>
              <span className="text-gray-500 leading-tight">{r.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SeccionPermisos — lista vertical de permisos con label a la izquierda y
// checkbox a la derecha. Incluye encabezado con contador y botones rápidos.
// ═══════════════════════════════════════════════════════════════════════════
function SeccionPermisos({ titulo, subtitulo, opciones, seleccionados, onToggle, onAll, onNone, color = "blue" }) {
  const totalSel = seleccionados.length;
  const total    = opciones.length;
  const todoMarcado = totalSel === total && total > 0;
  const nadaMarcado = totalSel === 0;

  const colorMap = {
    blue:   { badge: "bg-blue-100 text-blue-700",     ring: "focus:ring-blue-500", accent: "text-blue-600" },
    indigo: { badge: "bg-indigo-100 text-indigo-700", ring: "focus:ring-indigo-500", accent: "text-indigo-600" },
    green:  { badge: "bg-green-100 text-green-700",   ring: "focus:ring-green-500", accent: "text-green-600" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* Encabezado */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-semibold text-gray-800">{titulo}</h4>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${c.badge}`}>
              {totalSel} de {total}
            </span>
          </div>
          {subtitulo && <p className="text-[11px] text-gray-500 mt-0.5">{subtitulo}</p>}
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={onAll} disabled={todoMarcado}
                  className="text-[11px] text-gray-600 hover:text-blue-600 disabled:text-gray-300 disabled:hover:text-gray-300 font-medium">
            Todos
          </button>
          <span className="text-gray-300">·</span>
          <button type="button" onClick={onNone} disabled={nadaMarcado}
                  className="text-[11px] text-gray-600 hover:text-red-600 disabled:text-gray-300 disabled:hover:text-gray-300 font-medium">
            Ninguno
          </button>
        </div>
      </div>

      {/* Lista de opciones */}
      <div className="divide-y divide-gray-100">
        {opciones.map(op => {
          const checked = seleccionados.includes(op.value);
          return (
            <label key={op.value}
                   className={`flex items-center justify-between px-4 py-2.5 cursor-pointer transition-colors ${checked ? "bg-blue-50/40" : "hover:bg-gray-50"}`}>
              <div className="flex-1 min-w-0 mr-3">
                <p className="text-sm text-gray-800 font-medium truncate">{op.label}</p>
                {op.desc && <p className="text-[11px] text-gray-500 truncate">{op.desc}</p>}
              </div>
              <input
                type="checkbox"
                checked={checked}
                onChange={() => onToggle(op.value)}
                className={`w-5 h-5 rounded border-gray-300 ${c.accent} ${c.ring} cursor-pointer shrink-0`}
              />
            </label>
          );
        })}
      </div>
    </div>
  );
}
