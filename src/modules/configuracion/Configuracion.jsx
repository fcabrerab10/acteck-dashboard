import React, { useState, useEffect } from "react";
import { supabase } from '../../lib/supabase';
import {
  TIPOS_USUARIO,
  NIVELES_PERMISO,
  CLIENTES,
  PESTANAS_CLIENTE,
  PESTANAS_GLOBALES,
} from '../../lib/permisos';

// ═══════════════════════════════════════════════════════════════════════
// Configuración — Gestión de usuarios y permisos granulares
//
// Modelo nuevo (ver permisos.js):
//   - tipo: 'interno' | 'externo'
//   - puesto: texto libre
//   - permisos: JSON con nivel por (cliente, pestaña) + pestañas globales
//
// Solo Fernando (es_super_admin=true) puede usar este módulo.
// ═══════════════════════════════════════════════════════════════════════

// Estructura default de permisos — todo oculto al crear nuevo usuario.
const permisosVacios = () => ({
  clientes: Object.fromEntries(
    CLIENTES.map(c => [c.id, Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "oculto"]))])
  ),
  globales: Object.fromEntries(PESTANAS_GLOBALES.map(p => [p.id, "oculto"])),
});

// Plantillas rápidas — al hacer clic en un botón se aplican estos permisos.
// Fernando puede ajustar caso por caso después.
const PLANTILLAS = {
  internoTotal: {
    label: "Interno con acceso total (excepto configuración)",
    desc:  "Edita todas las pestañas de los 3 clientes + globales internas. No accede a Configuración.",
    aplicar: () => ({
      tipo: "interno",
      permisos: {
        clientes: Object.fromEntries(
          CLIENTES.map(c => [c.id, Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "edit"]))])
        ),
        globales: {
          resumen_clientes:  "edit",
          forecast_clientes: "edit", ordenes_compra:    "edit",
          admin_interna:     "edit",
          configuracion:     "oculto",
        },
      },
    }),
  },
  internoVer: {
    label: "Interno solo lectura",
    desc:  "Ve todos los clientes y pestañas globales pero no edita nada.",
    aplicar: () => ({
      tipo: "interno",
      permisos: {
        clientes: Object.fromEntries(
          CLIENTES.map(c => [c.id, Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "ver"]))])
        ),
        globales: {
          resumen_clientes:  "ver",
          forecast_clientes: "ver", ordenes_compra:    "ver",
          admin_interna:     "ver",
          configuracion:     "oculto",
        },
      },
    }),
  },
  clienteDigitalife: {
    label: "Cliente Digitalife (solo home/análisis/estrategia)",
    desc:  "Externo — ve Digitalife en modo ver, solo pestañas de producto. Pagos y Cobranza OCULTOS.",
    aplicar: () => ({
      tipo: "externo",
      permisos: {
        clientes: {
          digitalife: { home:"ver", analisis:"ver", estrategia:"ver", marketing:"oculto", pagos:"oculto", cartera:"oculto" },
          pcel:       Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "oculto"])),
          mercadolibre: Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "oculto"])),
        },
        globales: {
          resumen_clientes:"oculto", forecast_clientes:"oculto", ordenes_compra:"oculto", admin_interna:"oculto", configuracion:"oculto",
        },
      },
    }),
  },
  clientePCEL: {
    label: "Cliente PCEL (solo home/análisis/estrategia)",
    desc:  "Externo — ve PCEL en modo ver, solo pestañas de producto. Pagos y Cobranza OCULTOS.",
    aplicar: () => ({
      tipo: "externo",
      permisos: {
        clientes: {
          digitalife: Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "oculto"])),
          pcel:       { home:"ver", analisis:"ver", estrategia:"ver", marketing:"oculto", pagos:"oculto", cartera:"oculto" },
          mercadolibre: Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "oculto"])),
        },
        globales: {
          resumen_clientes:"oculto", forecast_clientes:"oculto", ordenes_compra:"oculto", admin_interna:"oculto", configuracion:"oculto",
        },
      },
    }),
  },
};

const formVacio = () => ({
  nombre: "",
  email: "",
  password: "",
  tipo: "interno",
  puesto: "",
  permisos: permisosVacios(),
});

export default function Configuracion({ session }) {
  const [usuarios, setUsuarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(formVacio());
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [miUserId, setMiUserId] = useState(null);

  useEffect(() => {
    fetchUsuarios();
    supabase.auth.getUser().then(({ data }) => setMiUserId(data?.user?.id || null));
  }, []);

  async function fetchUsuarios() {
    setLoading(true);
    const { data } = await supabase.from("perfiles").select("*").order("created_at", { ascending: true });
    setUsuarios(data || []);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    setMsg("");
    try {
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (editingId) {
        const updates = {
          nombre: form.nombre,
          tipo:   form.tipo,
          puesto: form.puesto || null,
          permisos: form.permisos,
        };
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
          body: JSON.stringify({
            nombre: form.nombre,
            email: form.email,
            password: form.password,
            tipo: form.tipo,
            puesto: form.puesto || null,
            permisos: form.permisos,
          })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setMsg("Usuario creado exitosamente");
      }
      setShowForm(false);
      setEditingId(null);
      setForm(formVacio());
      fetchUsuarios();
    } catch (err) {
      setMsg("Error: " + err.message);
    } finally {
      setSaving(false);
    }
  }

  function startEdit(u) {
    setEditingId(u.id);
    setForm({
      nombre: u.nombre || "",
      email: u.email || "",
      password: "",
      tipo: u.tipo || (u.rol === "cliente" || u.rol === "viewer" ? "externo" : "interno"),
      puesto: u.puesto || "",
      permisos: u.permisos || permisosVacios(),
    });
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

  // Cambiar nivel de una celda (cliente, pestana) o (globales, pestana)
  function setNivelCliente(clienteId, pestanaId, nivel) {
    setForm(f => ({
      ...f,
      permisos: {
        ...f.permisos,
        clientes: {
          ...f.permisos.clientes,
          [clienteId]: { ...f.permisos.clientes[clienteId], [pestanaId]: nivel },
        },
      },
    }));
  }
  function setNivelGlobal(pestanaId, nivel) {
    setForm(f => ({
      ...f,
      permisos: {
        ...f.permisos,
        globales: { ...f.permisos.globales, [pestanaId]: nivel },
      },
    }));
  }

  // Aplica uno de los niveles a TODAS las pestañas de un cliente (shortcut)
  function setTodasPestanas(clienteId, nivel) {
    setForm(f => ({
      ...f,
      permisos: {
        ...f.permisos,
        clientes: {
          ...f.permisos.clientes,
          [clienteId]: Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, nivel])),
        },
      },
    }));
  }

  // Resumen de permisos de un usuario (texto corto para la tabla)
  function resumenPermisos(u) {
    if (u.es_super_admin) return "Acceso total (super admin)";
    const p = u.permisos;
    if (!p) return <span className="text-gray-400 italic">Sin permisos configurados</span>;
    const clientesAcc = Object.entries(p.clientes || {})
      .filter(([_, ps]) => Object.values(ps || {}).some(v => v === "ver" || v === "edit"))
      .map(([id]) => CLIENTES.find(c => c.id === id)?.label || id);
    const globConEdit = Object.entries(p.globales || {}).filter(([_, v]) => v === "edit").length;
    const globConVer  = Object.entries(p.globales || {}).filter(([_, v]) => v === "ver").length;
    const parts = [];
    if (clientesAcc.length > 0) parts.push(`${clientesAcc.length}/3 clientes: ${clientesAcc.join(", ")}`);
    else parts.push("Sin clientes");
    if (globConEdit > 0 || globConVer > 0) {
      parts.push(`Globales: ${globConEdit} editar / ${globConVer} ver`);
    }
    return parts.join(" · ");
  }

  const usuariosFiltrados = usuarios.filter(u =>
    !busqueda ||
    (u.nombre || "").toLowerCase().includes(busqueda.toLowerCase()) ||
    (u.email  || "").toLowerCase().includes(busqueda.toLowerCase())
  );

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Configuración</h2>
          <p className="text-sm text-gray-400">Gestión de usuarios y permisos granulares</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setForm(formVacio()); }}
          className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition"
        >
          + Nuevo usuario
        </button>
      </div>

      {msg && (
        <div className={"mb-4 p-3 rounded-xl text-sm " + (msg.startsWith("Error") ? "bg-red-50 text-red-600 border border-red-200" : "bg-green-50 text-green-600 border border-green-200")}>
          {msg}
        </div>
      )}

      {/* ═══ FORMULARIO ═══ */}
      {showForm && (
        <div className="bg-white rounded-2xl shadow-sm p-6 mb-6 border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">{editingId ? "Editar usuario" : "Nuevo usuario"}</h3>

          {/* Datos básicos */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Nombre completo</label>
              <input value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})}
                     className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                     placeholder="Juan Pérez" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Correo electrónico</label>
              <input value={form.email} onChange={e => setForm({...form, email: e.target.value})}
                     disabled={!!editingId}
                     className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm disabled:bg-gray-50"
                     placeholder="usuario@acteck.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                {editingId ? "Nueva contraseña (dejar vacío para no cambiar)" : "Contraseña"}
              </label>
              <input type="password" value={form.password}
                     onChange={e => setForm({...form, password: e.target.value})}
                     className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                     placeholder="••••••••" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">Puesto</label>
              <input value={form.puesto} onChange={e => setForm({...form, puesto: e.target.value})}
                     className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                     placeholder="Ej: Gerente Comercial, Analista de Compras" />
              <p className="text-[11px] text-gray-400 mt-1">Solo informativo, no afecta permisos</p>
            </div>
          </div>

          {/* Tipo */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-600 mb-2">Tipo de usuario</label>
            <div className="grid grid-cols-2 gap-2">
              {TIPOS_USUARIO.map(t => (
                <button key={t.value}
                        type="button"
                        onClick={() => setForm({ ...form, tipo: t.value })}
                        className={`p-3 rounded-xl border text-left transition ${
                          form.tipo === t.value
                            ? (t.value === "interno" ? "border-blue-500 bg-blue-50" : "border-green-500 bg-green-50")
                            : "border-gray-200 hover:border-gray-300"
                        }`}>
                  <p className={`text-sm font-semibold ${form.tipo === t.value ? (t.value === "interno" ? "text-blue-700" : "text-green-700") : "text-gray-700"}`}>
                    {t.label}
                  </p>
                  <p className="text-[11px] text-gray-500 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Plantillas rápidas */}
          <div className="mb-5 p-3 bg-indigo-50 border border-indigo-200 rounded-xl">
            <p className="text-xs font-semibold text-indigo-800 mb-2">⚡ Plantillas rápidas (opcional)</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {Object.entries(PLANTILLAS)
                .filter(([_, pl]) => {
                  // Solo mostrar plantillas consistentes con el tipo seleccionado
                  const plantillaEsExterno = pl.aplicar().tipo === "externo";
                  return form.tipo === "externo" ? plantillaEsExterno : !plantillaEsExterno;
                })
                .map(([key, pl]) => (
                <button key={key} type="button"
                        onClick={() => setForm(f => ({ ...f, ...pl.aplicar() }))}
                        className="text-left p-2 bg-white hover:bg-indigo-100 rounded-lg border border-indigo-200 transition">
                  <p className="text-xs font-semibold text-indigo-900">{pl.label}</p>
                  <p className="text-[10px] text-gray-500 leading-tight mt-0.5">{pl.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Permisos por cliente */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Permisos por cliente
            </label>
            <p className="text-xs text-gray-500 mb-3">
              Para cada pestaña de cada cliente, elige el nivel de acceso.
              <span className="ml-1 text-gray-400">
                <strong>Ocultar</strong> = ni aparece en el menú ·
                <strong> Ver</strong> = solo lectura ·
                <strong> Editar</strong> = puede modificar
              </span>
            </p>
            <div className="space-y-3">
              {CLIENTES.map(cliente => (
                <ClientePermisos
                  key={cliente.id}
                  cliente={cliente}
                  valores={form.permisos.clientes[cliente.id] || {}}
                  onChange={(pestana, nivel) => setNivelCliente(cliente.id, pestana, nivel)}
                  onTodas={(nivel) => setTodasPestanas(cliente.id, nivel)}
                />
              ))}
            </div>
          </div>

          {/* Permisos globales (solo para internos) */}
          {form.tipo === "interno" && (
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Pestañas globales (solo internos)
              </label>
              <p className="text-xs text-gray-500 mb-3">
                Funcionalidades que ven solo personas del equipo interno. Configuración solo Fernando.
              </p>
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {PESTANAS_GLOBALES.map((p, idx) => (
                  <div key={p.id}
                       className={`flex items-center justify-between px-4 py-2.5 ${idx % 2 === 0 ? "bg-gray-50/50" : "bg-white"}`}>
                    <div className="flex-1 min-w-0 mr-3">
                      <p className="text-sm font-medium text-gray-800">{p.label}</p>
                      <p className="text-[11px] text-gray-500 truncate">{p.desc}</p>
                    </div>
                    <SegmentedNivel
                      valor={form.permisos.globales?.[p.id] || "oculto"}
                      onChange={(n) => setNivelGlobal(p.id, n)}
                      disabled={p.id === "configuracion"}  // Configuración solo Fernando (nunca editable desde UI)
                      disabledMsg="Solo Fernando (super admin)"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Botones */}
          <div className="flex gap-2 pt-3 border-t border-gray-200">
            <button onClick={handleSave} disabled={saving}
                    className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? "Guardando..." : (editingId ? "Guardar cambios" : "Crear usuario")}
            </button>
            <button onClick={() => { setShowForm(false); setEditingId(null); }}
                    className="px-4 py-2 bg-gray-100 text-gray-600 rounded-xl text-sm hover:bg-gray-200 transition">
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* ═══ BUSCADOR Y TABLA ═══ */}
      <div className="mb-3 flex items-center gap-2">
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
               placeholder="Buscar por nombre o correo…"
               className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        {busqueda && <button onClick={() => setBusqueda("")} className="text-xs text-gray-500 hover:underline">Limpiar</button>}
        <span className="text-xs text-gray-400">{usuariosFiltrados.length} / {usuarios.length} usuario(s)</span>
      </div>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Usuario</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Tipo · Puesto</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500">Resumen de acceso</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Estado</th>
                <th className="text-center px-4 py-3 font-medium text-gray-500">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">Cargando usuarios...</td></tr>
              ) : usuariosFiltrados.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-8 text-gray-400">No hay usuarios</td></tr>
              ) : usuariosFiltrados.map(u => {
                const soyYo = u.user_id && u.user_id === miUserId;
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
                      {u.es_super_admin && <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-700 font-semibold">SUPER</span>}
                    </p>
                    <p className="text-xs text-gray-400">{u.email}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block text-[11px] px-2 py-0.5 rounded-full font-semibold ${
                      u.tipo === "interno" ? "bg-blue-100 text-blue-700" :
                      u.tipo === "externo" ? "bg-green-100 text-green-700" :
                      "bg-gray-100 text-gray-600"
                    }`}>
                      {u.tipo === "interno" ? "Interno" : u.tipo === "externo" ? "Externo" : "—"}
                    </span>
                    {u.puesto && <p className="text-xs text-gray-500 mt-0.5">{u.puesto}</p>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-600 max-w-md">
                    {resumenPermisos(u)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => toggleActivo(u)}
                            className={"px-2 py-1 rounded-lg text-xs font-medium " + (u.activo ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200")}>
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

      {/* Leyenda de niveles */}
      <div className="mt-4 bg-white rounded-xl shadow-sm p-4">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Niveles de permiso</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
          {NIVELES_PERMISO.map(n => (
            <div key={n.value} className="flex items-start gap-2">
              <span className={"px-2 py-0.5 rounded text-[10px] font-semibold shrink-0 " + (
                n.value === "oculto" ? "bg-gray-200 text-gray-700" :
                n.value === "ver" ? "bg-blue-100 text-blue-700" :
                "bg-green-100 text-green-700"
              )}>{n.label}</span>
              <span className="text-gray-500 leading-tight">{n.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ClientePermisos — sub-bloque por cliente con 6 pestañas + shortcut 'Todas'
// ═══════════════════════════════════════════════════════════════════════
function ClientePermisos({ cliente, valores, onChange, onTodas }) {
  const conteo = PESTANAS_CLIENTE.reduce((acc, p) => {
    const n = valores[p.id] || "oculto";
    acc[n] = (acc[n] || 0) + 1;
    return acc;
  }, {});
  const totalAcceso = (conteo.ver || 0) + (conteo.edit || 0);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
      <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-red-500"></span>
          <h4 className="text-sm font-semibold text-gray-800">{cliente.label}</h4>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
            {totalAcceso > 0 ? `${totalAcceso}/${PESTANAS_CLIENTE.length} con acceso` : "sin acceso"}
          </span>
        </div>
        <div className="flex gap-1">
          <button type="button" onClick={() => onTodas("oculto")} className="text-[11px] text-gray-600 hover:text-red-600 font-medium">Ocultar todas</button>
          <span className="text-gray-300">·</span>
          <button type="button" onClick={() => onTodas("ver")}    className="text-[11px] text-gray-600 hover:text-blue-600 font-medium">Ver todas</button>
          <span className="text-gray-300">·</span>
          <button type="button" onClick={() => onTodas("edit")}   className="text-[11px] text-gray-600 hover:text-green-600 font-medium">Editar todas</button>
        </div>
      </div>
      <div>
        {PESTANAS_CLIENTE.map((p, idx) => (
          <div key={p.id} className={`flex items-center justify-between px-4 py-2 ${idx < PESTANAS_CLIENTE.length - 1 ? "border-b border-gray-100" : ""}`}>
            <div className="flex-1 min-w-0 mr-3">
              <p className="text-sm text-gray-800">{p.label}</p>
              <p className="text-[11px] text-gray-500 truncate">{p.desc}</p>
            </div>
            <SegmentedNivel
              valor={valores[p.id] || "oculto"}
              onChange={(n) => onChange(p.id, n)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// SegmentedNivel — botones segmentados Ocultar / Ver / Editar
// ═══════════════════════════════════════════════════════════════════════
function SegmentedNivel({ valor, onChange, disabled = false, disabledMsg = "" }) {
  const opciones = [
    { value: "oculto", label: "Ocultar", colorOn: "bg-gray-600 text-white",  colorOff: "text-gray-500 hover:bg-gray-100" },
    { value: "ver",    label: "Ver",     colorOn: "bg-blue-600 text-white",  colorOff: "text-gray-600 hover:bg-blue-50" },
    { value: "edit",   label: "Editar",  colorOn: "bg-green-600 text-white", colorOff: "text-gray-600 hover:bg-green-50" },
  ];
  return (
    <div className="inline-flex bg-gray-100 rounded-lg p-0.5" title={disabled ? disabledMsg : ""}>
      {opciones.map(op => {
        const activo = valor === op.value;
        return (
          <button key={op.value} type="button"
                  disabled={disabled}
                  onClick={() => !disabled && onChange(op.value)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold transition ${activo ? op.colorOn : op.colorOff} ${disabled ? "opacity-40 cursor-not-allowed" : ""}`}>
            {op.label}
          </button>
        );
      })}
    </div>
  );
}
