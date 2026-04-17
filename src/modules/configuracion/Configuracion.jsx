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
  { value: "home",       label: "Resumen" },
  { value: "analisis",   label: "Análisis" },
  { value: "estrategia", label: "Estrategia de Producto" },
  { value: "marketing",  label: "Marketing" },
  { value: "pagos",      label: "Pagos" },
  { value: "cartera",    label: "Crédito y Cobranza" },
];

const CLIENTES_OPT = [
  { value: "digitalife", label: "Digitalife" },
  { value: "pcel", label: "PCEL" },
  { value: "mercadolibre", label: "Mercado Libre" },
];

const MODULOS_OPT = [
  { value: "comercial", label: "Área Comercial" },
  { value: "marketing", label: "Marketing General" },
  { value: "pnl", label: "Estado de Resultados" },
  { value: "operaciones", label: "Operaciones" },
  { value: "compras", label: "Compras" },
  { value: "rrhh", label: "RRHH" },
  { value: "finanzas", label: "Finanzas" },
  { value: "kpis", label: "KPIs Ejecutivos" },
];

export default function Configuracion({ session }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({ nombre: "", email: "", password: "", rol: "viewer", clientes: [], modulos: ["comercial"], pestanas_cliente: [], puede_editar: false });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => { fetchUsuarios(); }, []);

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
              <select value={form.rol} onChange={e => setForm({...form, rol: e.target.value})} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm">
                {ROLES.map(r => <option key={r.value} value={r.value}>{r.label} — {r.desc}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Clientes asignados</label>
              <div className="flex flex-wrap gap-2">
                {CLIENTES_OPT.map(c => (
                  <button key={c.value} onClick={() => setForm({...form, clientes: toggleArray(form.clientes, c.value)})} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition " + (form.clientes.includes(c.value) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{c.label}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">Módulos permitidos</label>
              <div className="flex flex-wrap gap-2">
                {MODULOS_OPT.map(m => (
                  <button key={m.value} onClick={() => setForm({...form, modulos: toggleArray(form.modulos, m.value)})} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition " + (form.modulos.includes(m.value) ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200")}>{m.label}</button>
                ))}
              </div>
            </div>
          </div>
          {form.rol === "cliente" && (
            <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-xl">
              <label className="block text-sm font-medium text-gray-700 mb-2">Pestañas visibles para este cliente</label>
              <p className="text-xs text-gray-500 mb-2">El usuario solo verá las pestañas que marques del/los cliente(s) asignado(s).</p>
              <div className="flex flex-wrap gap-2">
                {PESTANAS_OPT.map(p => (
                  <button key={p.value} onClick={() => setForm({...form, pestanas_cliente: toggleArray(form.pestanas_cliente, p.value)})} className={"px-3 py-1.5 rounded-lg text-xs font-medium transition " + (form.pestanas_cliente.includes(p.value) ? "bg-green-600 text-white" : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50")}>{p.label}</button>
                ))}
              </div>
            </div>
          )}
          {(form.rol === "asistente" || form.rol === "admin") && (
            <div className="flex items-center gap-2 mb-4">
              <input type="checkbox" checked={form.puede_editar} onChange={e => setForm({...form, puede_editar: e.target.checked})} id="canEdit" className="rounded" />
              <label htmlFor="canEdit" className="text-sm text-gray-600">Puede editar datos (si se desmarca, será solo lectura)</label>
            </div>
          )}
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">{saving ? "Guardando..." : (editingId ? "Guardar cambios" : "Crear usuario")}</button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">Cancelar</button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Usuario</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Rol</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Clientes</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500">Módulos</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Editar</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
              <th className="text-center px-4 py-3 font-medium text-gray-500">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Cargando usuarios...</td></tr>
            ) : usuarios.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">No hay usuarios registrados</td></tr>
            ) : usuarios.map(u => (
              <tr key={u.id} className={"border-t " + (!u.activo ? "opacity-50" : "")}>
                <td className="px-4 py-3">
                  <p className="font-medium text-gray-800">{u.nombre}</p>
                  <p className="text-xs text-gray-400">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <span className={"px-2 py-1 rounded-lg text-xs font-medium " + (u.rol === "super_admin" ? "bg-purple-100 text-purple-700" : u.rol === "admin" ? "bg-indigo-100 text-indigo-700" : u.rol === "asistente" ? "bg-blue-100 text-blue-700" : u.rol === "cliente" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700")}>{ROLES.find(r => r.value === u.rol)?.label || u.rol}</span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-600">{(u.clientes || []).join(", ") || "Todos"}</td>
                <td className="px-4 py-3 text-xs text-gray-600">{(u.modulos || []).join(", ") || "Todos"}</td>
                <td className="px-4 py-3 text-center">{u.puede_editar ? <span className="text-green-600">Sí</span> : <span className="text-gray-400">No</span>}</td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => toggleActivo(u)} className={"px-2 py-1 rounded-lg text-xs font-medium " + (u.activo ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>{u.activo ? "Activo" : "Inactivo"}</button>
                </td>
                <td className="px-4 py-3 text-center">
                  <button onClick={() => startEdit(u)} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Editar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
