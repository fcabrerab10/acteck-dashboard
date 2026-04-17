import React from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';

// ═══════════ CONFIG DE TIPOS DE ACTIVIDAD ═══════════════════════
// Cada tipo tiene color, icono y lista de métricas específicas
const TIPOS = {
  mailing:    { label: "Mailing",    color: "#10B981", bg: "#ECFDF5", icon: "📧", metricas: [
    { key: "envios", label: "Envíos" },
    { key: "aperturas", label: "Aperturas" },
    { key: "clics", label: "Clics" },
  ]},
  reel:       { label: "Reel",       color: "#A855F7", bg: "#F5F3FF", icon: "🎬", redSocial: true, metricas: [
    { key: "visualizaciones", label: "Visualizaciones" },
    { key: "interaccion", label: "Interacción" },
    { key: "cuentas_alcanzadas", label: "Cuentas alcanzadas" },
    { key: "retencion", label: "Retención (%)" },
    { key: "me_gusta", label: "Me gusta" },
  ]},
  banner:     { label: "Banner",     color: "#3B82F6", bg: "#EFF6FF", icon: "🖼️", metricas: [
    { key: "usuarios_activos", label: "Usuarios activos" },
    { key: "sesiones", label: "Sesiones" },
    { key: "vistas", label: "Vistas" },
  ]},
  meta_ads:   { label: "Meta Ads",   color: "#EAB308", bg: "#FEFCE8", icon: "📱", metricas: [
    { key: "importe_gastado", label: "Importe gastado ($)", money: true },
    { key: "alcance", label: "Alcance" },
    { key: "impresiones", label: "Impresiones" },
    { key: "clics_enlace", label: "Clics en enlace" },
    { key: "compras", label: "Compras" },
    { key: "valor_conversion", label: "Valor conversión ($)", money: true },
  ]},
  google_ads: { label: "Google Ads", color: "#F97316", bg: "#FFF7ED", icon: "🔍", metricas: [
    { key: "calidad", label: "Calidad (1-10)" },
    { key: "clics", label: "Clics" },
    { key: "impresiones", label: "Impresiones" },
    { key: "conversiones", label: "Conversiones" },
    { key: "valor_conversion", label: "Valor conversión ($)", money: true },
    { key: "costo", label: "Costo ($)", money: true },
    { key: "nivel_optimizacion", label: "Nivel optimización (%)" },
  ]},
  evento:     { label: "Evento",     color: "#EC4899", bg: "#FCE7F3", icon: "🎪", evento: true, metricas: [
    { key: "asistentes", label: "Asistentes" },
    { key: "contactos", label: "Contactos capturados" },
    { key: "ventas", label: "Ventas ($)", money: true },
  ]},
};

const MARCAS = {
  acteck:     { label: "Acteck",     color: "#3B82F6" },
  balam_rush: { label: "Balam Rush", color: "#8B5CF6" },
};

const REDES_SOCIALES = {
  tiktok:    { label: "TikTok",    color: "#000000", icon: "🎵" },
  facebook:  { label: "Facebook",  color: "#1877F2", icon: "📘" },
  instagram: { label: "Instagram", color: "#E4405F", icon: "📷" },
  youtube:   { label: "YouTube",   color: "#FF0000", icon: "▶️" },
};

const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
const MESES_CORTOS = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
const DIAS_SEMANA = ["L","M","X","J","V","S","D"];

const emptyForm = () => ({
  tipo: "mailing",
  marca: "acteck",
  fecha: new Date().toISOString().slice(0, 10),
  nombre: "",
  mensaje: "",
  red_social: "",
  inversion: 0,
  metricas: {},
  evento_sucursal: "",
  evento_pop: "",
  notas: "",
  responsable: "",
});

const fmtMXN = (v) => "$" + Number(v || 0).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fmtNum = (v) => Number(v || 0).toLocaleString("es-MX");

export default function MarketingCliente({ cliente, clienteKey }) {
  const [actividades, setActividades] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [anio, setAnio] = React.useState(2026);
  const [mesSel, setMesSel] = React.useState(new Date().getMonth() + 1);
  const [filterTipo, setFilterTipo] = React.useState("todos");
  const [filterMarca, setFilterMarca] = React.useState("todas");
  const [showCalendar, setShowCalendar] = React.useState(true);
  const [calVista, setCalVista] = React.useState("mes");  // 'mes' o 'anual'
  const [diaSeleccionado, setDiaSeleccionado] = React.useState(null);
  const [showForm, setShowForm] = React.useState(false);
  const [editId, setEditId] = React.useState(null);
  const [form, setForm] = React.useState(emptyForm());
  const [saving, setSaving] = React.useState(false);
  const [mostrarArchivadas, setMostrarArchivadas] = React.useState(false);

  const ck = clienteKey || cliente;

  // ─── Carga de datos ───────────────────────────────────────────
  React.useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    supabase.from("marketing_actividades").select("*").eq("cliente", ck).eq("anio", anio).then(({ data }) => {
      setActividades(data || []);
      setLoading(false);
    });
    // Realtime subscription
    const chan = supabase.channel("mkt-" + ck + "-" + anio)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_actividades" }, (payload) => {
        if (payload.eventType === "INSERT") setActividades(p => [...p, payload.new]);
        else if (payload.eventType === "UPDATE") setActividades(p => p.map(a => a.id === payload.new.id ? payload.new : a));
        else if (payload.eventType === "DELETE") setActividades(p => p.filter(a => a.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [ck, anio]);

  // Parse YYYY-MM-DD sin timezone shift
  const parseFecha = (f) => {
    if (!f) return null;
    const p = String(f).slice(0, 10).split("-").map(n => parseInt(n, 10));
    if (p.length !== 3 || !p[0]) return null;
    return { y: p[0], m: p[1], d: p[2] };
  };

  // ─── Filtros aplicados ────────────────────────────────────────
  const { activasFiltradas, completadasFiltradas } = React.useMemo(() => {
    const applyFilters = (arr) => arr.filter(a => {
      const pf = parseFecha(a.fecha);
      const aMes = pf ? pf.m : Number(a.mes) || 0;
      const aAnio = pf ? pf.y : Number(a.anio) || 0;
      if (aAnio !== anio) return false;
      if (aMes !== mesSel) return false;
      if (filterTipo !== "todos" && a.tipo !== filterTipo) return false;
      if (filterMarca !== "todas" && a.marca !== filterMarca) return false;
      if (diaSeleccionado && pf) {
        if (pf.d !== diaSeleccionado) return false;
      }
      return true;
    }).sort((a, b) => {
      const pa = parseFecha(a.fecha), pb = parseFecha(b.fecha);
      const dA = pa ? pa.d : 0; const dB = pb ? pb.d : 0;
      return dA - dB;
    });
    const activas = applyFilters(actividades.filter(a => a.estatus !== "completado" && a.estatus !== "archivado"));
    const completadas = applyFilters(actividades.filter(a => a.estatus === "completado" || a.estatus === "archivado"));
    return { activasFiltradas: activas, completadasFiltradas: completadas };
  }, [actividades, anio, mesSel, filterTipo, filterMarca, diaSeleccionado]);

  // ─── Actividades del mes (para el calendario) ────────────────
  const actividadesDelMes = React.useMemo(() => {
    return actividades.filter(a => {
      const pf = parseFecha(a.fecha);
      const m = pf ? pf.m : Number(a.mes) || 0;
      const y = pf ? pf.y : Number(a.anio) || 0;
      return y === anio && m === mesSel;
    });
  }, [actividades, anio, mesSel]);

  // ─── CRUD ────────────────────────────────────────────────────
  const openNew = () => {
    setForm({ ...emptyForm(), fecha: new Date(anio, mesSel - 1, Math.min(new Date().getDate(), 28)).toISOString().slice(0, 10) });
    setEditId(null);
    setShowForm(true);
  };
  const openEdit = (a) => {
    setForm({
      tipo: a.tipo || "mailing",
      marca: a.marca || "acteck",
      fecha: a.fecha || (a.anio && a.mes ? `${a.anio}-${String(a.mes).padStart(2, "0")}-01` : ""),
      nombre: a.nombre || "",
      mensaje: a.mensaje || "",
      red_social: a.red_social || "",
      inversion: Number(a.inversion) || 0,
      metricas: a.metricas || {},
      evento_sucursal: a.evento_sucursal || "",
      evento_pop: a.evento_pop || "",
      notas: a.notas || "",
      responsable: a.responsable || "",
    });
    setEditId(a.id);
    setShowForm(true);
  };
  const closeForm = () => { setShowForm(false); setEditId(null); setForm(emptyForm()); };
  const save = async () => {
    if (!form.nombre.trim()) { alert("Falta el nombre de la actividad"); return; }
    setSaving(true);
    // Parse YYYY-MM-DD SIN conversión de timezone (new Date() lo interpreta como UTC)
    let fAnio = anio, fMes = mesSel;
    if (form.fecha) {
      const parts = form.fecha.split("-").map(n => parseInt(n, 10));
      if (parts.length === 3 && parts[0] && parts[1]) { fAnio = parts[0]; fMes = parts[1]; }
    }
    const payload = {
      cliente: ck,
      tipo: form.tipo,
      marca: form.marca,
      nombre: form.nombre.trim(),
      mensaje: form.mensaje || "",
      red_social: form.red_social || null,
      fecha: form.fecha || null,
      anio: fAnio,
      mes: String(fMes),
      inversion: Number(form.inversion) || 0,
      metricas: form.metricas || {},
      evento_sucursal: form.evento_sucursal || null,
      evento_pop: form.evento_pop || null,
      notas: form.notas || null,
      responsable: form.responsable || null,
      estatus: "activo",
      // Valores por defecto para columnas legacy NOT NULL
      subtipo: form.fecha || "",
      temporalidad: form.fecha || "",
      producto: "",
    };
    let err = null;
    let saved = null;
    if (editId) {
      const { data, error } = await supabase.from("marketing_actividades").update(payload).eq("id", editId).select().single();
      err = error; saved = data;
    } else {
      const { data, error } = await supabase.from("marketing_actividades").insert(payload).select().single();
      err = error; saved = data;
    }
    setSaving(false);
    if (err) { alert("Error guardando: " + err.message); return; }
    // Actualizar estado local de inmediato (no depender solo de realtime)
    if (saved) {
      if (editId) {
        setActividades(p => p.map(a => a.id === editId ? saved : a));
      } else {
        setActividades(p => [...p.filter(a => a.id !== saved.id), saved]);
      }
    }
    closeForm();
  };
  const deleteAct = async (id) => {
    if (!window.confirm("¿Eliminar esta actividad?")) return;
    // Optimistic: remove from local state immediately
    setActividades(p => p.filter(a => a.id !== id));
    const { error } = await supabase.from("marketing_actividades").delete().eq("id", id);
    if (error) {
      alert("Error al eliminar: " + error.message);
      // Revert: reload from DB
      const { data } = await supabase.from("marketing_actividades").select("*").eq("cliente", ck).eq("anio", anio);
      setActividades(data || []);
    }
  };
  const toggleCompletada = async (a) => {
    const nuevoEstatus = (a.estatus === "completado" || a.estatus === "archivado") ? "activo" : "completado";
    // Optimistic
    setActividades(p => p.map(x => x.id === a.id ? { ...x, estatus: nuevoEstatus } : x));
    const { error } = await supabase.from("marketing_actividades").update({ estatus: nuevoEstatus }).eq("id", a.id);
    if (error) {
      alert("Error al cambiar estatus: " + error.message);
      setActividades(p => p.map(x => x.id === a.id ? a : x));
    }
  };

  // ─── Totales ────────────────────────────────────────────────
  const totales = React.useMemo(() => {
    const t = { actividades: actividadesDelMes.length, inversion: 0, porTipo: {} };
    actividadesDelMes.forEach(a => {
      t.inversion += Number(a.inversion) || 0;
      if (!t.porTipo[a.tipo]) t.porTipo[a.tipo] = 0;
      t.porTipo[a.tipo]++;
    });
    return t;
  }, [actividadesDelMes]);

  // ─── Construcción del calendario ────────────────────────────
  const calendario = React.useMemo(() => {
    const firstDay = new Date(anio, mesSel - 1, 1);
    const lastDay = new Date(anio, mesSel, 0).getDate();
    // Offset lunes = 0 .. domingo = 6
    const startOffset = (firstDay.getDay() + 6) % 7;
    const days = [];
    for (let i = 0; i < startOffset; i++) days.push(null);
    for (let d = 1; d <= lastDay; d++) {
      const acts = actividadesDelMes.filter(a => {
        const pf = parseFecha(a.fecha);
        return pf && pf.d === d;
      });
      days.push({ day: d, actividades: acts });
    }
    return days;
  }, [anio, mesSel, actividadesDelMes]);

  // ─── Render ──────────────────────────────────────────────────
  if (loading) return <div style={{ textAlign: "center", padding: 60, color: "#64748b" }}>Cargando marketing...</div>;

  const tipoMeta = (tipo) => TIPOS[tipo] || { label: tipo || "?", color: "#94A3B8", bg: "#F1F5F9", icon: "📌", metricas: [] };

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", color: "#1e293b" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>📢 Marketing — {cliente || ck}</h2>
          <div style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>
            {totales.actividades} actividades en {MESES[mesSel - 1]} · Inversión: {fmtMXN(totales.inversion)}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}>
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
          <select value={mesSel} onChange={e => { setMesSel(Number(e.target.value)); setDiaSeleccionado(null); }} style={{ padding: "6px 10px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13 }}>
            {MESES.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <button onClick={openNew} style={{ padding: "8px 14px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>+ Nueva actividad</button>
        </div>
      </div>

      {/* Filtros: tipo + marca */}
      <div style={{ display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginRight: 4 }}>TIPO:</span>
          <button onClick={() => setFilterTipo("todos")} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 11, border: filterTipo === "todos" ? "2px solid #1E293B" : "1px solid #E2E8F0", background: filterTipo === "todos" ? "#1E293B" : "#fff", color: filterTipo === "todos" ? "#fff" : "#475569", cursor: "pointer", fontWeight: 600 }}>Todos</button>
          {Object.entries(TIPOS).map(([key, t]) => (
            <button key={key} onClick={() => setFilterTipo(key)} style={{
              padding: "4px 10px", borderRadius: 14, fontSize: 11,
              border: filterTipo === key ? "2px solid " + t.color : "1px solid #E2E8F0",
              background: filterTipo === key ? t.color : "#fff",
              color: filterTipo === key ? "#fff" : "#475569", cursor: "pointer", fontWeight: 600,
            }}>{t.icon} {t.label}</button>
          ))}
        </div>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginLeft: 12, marginRight: 4 }}>MARCA:</span>
          <button onClick={() => setFilterMarca("todas")} style={{ padding: "4px 10px", borderRadius: 14, fontSize: 11, border: filterMarca === "todas" ? "2px solid #1E293B" : "1px solid #E2E8F0", background: filterMarca === "todas" ? "#1E293B" : "#fff", color: filterMarca === "todas" ? "#fff" : "#475569", cursor: "pointer", fontWeight: 600 }}>Todas</button>
          {Object.entries(MARCAS).map(([key, m]) => (
            <button key={key} onClick={() => setFilterMarca(key)} style={{
              padding: "4px 10px", borderRadius: 14, fontSize: 11,
              border: filterMarca === key ? "2px solid " + m.color : "1px solid #E2E8F0",
              background: filterMarca === key ? m.color : "#fff",
              color: filterMarca === key ? "#fff" : "#475569", cursor: "pointer", fontWeight: 600,
            }}>{m.label}</button>
          ))}
        </div>
        <button onClick={() => setShowCalendar(s => !s)} style={{ marginLeft: "auto", padding: "4px 10px", borderRadius: 8, fontSize: 11, border: "1px solid #E2E8F0", background: "#F8FAFC", color: "#475569", cursor: "pointer" }}>
          {showCalendar ? "Ocultar calendario" : "Mostrar calendario"}
        </button>
      </div>

      {/* Calendario */}
      {showCalendar && (
        <div style={{ background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14, marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
            <h3 style={{ margin: 0, fontSize: 14, color: "#1E293B", fontWeight: 700 }}>📅 {calVista === "mes" ? MESES[mesSel - 1] + " " + anio : anio}</h3>
            <div style={{ display: "flex", gap: 4 }}>
              <button onClick={() => setCalVista("mes")} style={{ padding: "4px 12px", fontSize: 11, borderRadius: 8, border: calVista === "mes" ? "2px solid #3B82F6" : "1px solid #E2E8F0", background: calVista === "mes" ? "#EFF6FF" : "#fff", color: calVista === "mes" ? "#3B82F6" : "#64748B", cursor: "pointer", fontWeight: 600 }}>Mes</button>
              <button onClick={() => setCalVista("anual")} style={{ padding: "4px 12px", fontSize: 11, borderRadius: 8, border: calVista === "anual" ? "2px solid #3B82F6" : "1px solid #E2E8F0", background: calVista === "anual" ? "#EFF6FF" : "#fff", color: calVista === "anual" ? "#3B82F6" : "#64748B", cursor: "pointer", fontWeight: 600 }}>Anual</button>
              {diaSeleccionado && (
                <button onClick={() => setDiaSeleccionado(null)} style={{ padding: "4px 10px", borderRadius: 8, fontSize: 11, border: "1px solid #E2E8F0", background: "#F1F5F9", cursor: "pointer" }}>
                  Limpiar día ({diaSeleccionado})
                </button>
              )}
            </div>
          </div>
          {calVista === "mes" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4, fontSize: 10, color: "#94A3B8", marginBottom: 4 }}>
                {DIAS_SEMANA.map((d, i) => <div key={i} style={{ textAlign: "center", fontWeight: 600, padding: 4 }}>{d}</div>)}
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {calendario.map((cell, i) => {
                  if (!cell) return <div key={i} style={{ minHeight: 60 }}/>;
                  const isSelected = cell.day === diaSeleccionado;
                  return (
                    <div key={i} onClick={() => setDiaSeleccionado(cell.day === diaSeleccionado ? null : cell.day)}
                      style={{
                        minHeight: 60, background: isSelected ? "#EFF6FF" : "#F8FAFC",
                        border: isSelected ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                        borderRadius: 6, padding: 4, cursor: "pointer",
                        display: "flex", flexDirection: "column", gap: 3
                      }}>
                      <div style={{ fontSize: 11, color: "#475569", fontWeight: 600 }}>{cell.day}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
                        {cell.actividades.slice(0, 4).map(a => {
                          const tm = tipoMeta(a.tipo);
                          return <div key={a.id} title={tm.label + ": " + (a.nombre || "")} style={{ width: 8, height: 8, borderRadius: 4, background: tm.color }} />;
                        })}
                        {cell.actividades.length > 4 && <span style={{ fontSize: 9, color: "#64748B" }}>+{cell.actividades.length - 4}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <CalendarioAnual
              anio={anio}
              actividades={actividades}
              filterTipo={filterTipo}
              filterMarca={filterMarca}
              mesSel={mesSel}
              onSelectMes={(m) => { setMesSel(m); setCalVista("mes"); setDiaSeleccionado(null); }}
            />
          )}
        </div>
      )}

      {/* Grid de tarjetas activas */}
      {activasFiltradas.length === 0 && completadasFiltradas.length === 0 ? (
        <div style={{ textAlign: "center", padding: 40, color: "#94A3B8", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0" }}>
          No hay actividades para estos filtros. <button onClick={openNew} style={{ marginLeft: 8, color: "#3B82F6", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Crear la primera</button>
        </div>
      ) : (
        <>
          {activasFiltradas.length === 0 ? (
            <div style={{ textAlign: "center", padding: 20, color: "#94A3B8", background: "#fff", borderRadius: 12, border: "1px solid #E2E8F0", fontSize: 13, fontStyle: "italic", marginBottom: 14 }}>
              ✓ Sin actividades pendientes este mes. Revisa las completadas abajo.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
              {activasFiltradas.map(a => <ActividadCard key={a.id} a={a} onEdit={openEdit} onDelete={deleteAct} onToggle={toggleCompletada} />)}
            </div>
          )}

          {/* Repositorio de actividades completadas (colapsable) */}
          {completadasFiltradas.length > 0 && (
            <div style={{ marginTop: 20, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 12, padding: 14 }}>
              <button
                onClick={() => setMostrarArchivadas(s => !s)}
                style={{
                  width: "100%", background: "none", border: "none", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 700, color: "#475569", padding: "4px 0"
                }}
              >
                <span style={{ fontSize: 11, display: "inline-block", transform: mostrarArchivadas ? "rotate(90deg)" : "rotate(0)", transition: "transform .2s" }}>▶</span>
                📁 Actividades completadas
                <span style={{ background: "#F1F5F9", color: "#64748B", fontSize: 11, padding: "1px 8px", borderRadius: 10, fontWeight: 500 }}>{completadasFiltradas.length}</span>
              </button>
              {mostrarArchivadas && (
                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 12 }}>
                  {completadasFiltradas.map(a => <ActividadCard key={a.id} a={a} onEdit={openEdit} onDelete={deleteAct} onToggle={toggleCompletada} />)}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* Modal formulario */}
      {showForm && <ActividadForm form={form} setForm={setForm} editId={editId} saving={saving} onSave={save} onClose={closeForm} />}
    </div>
  );
}

// ═══════════ TARJETA DE ACTIVIDAD ═══════════════════════
function ActividadCard({ a, onEdit, onDelete, onToggle }) {
  const tm = (TIPOS[a.tipo] || { color: "#94A3B8", bg: "#F1F5F9", icon: "📌", label: a.tipo || "?", metricas: [] });
  const marca = MARCAS[a.marca] || null;
  const rs = a.red_social ? REDES_SOCIALES[a.red_social] : null;
  const metricas = a.metricas || {};
  const fechaTxt = a.fecha ? new Date(a.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "short" }) : "";
  const isCompleted = a.estatus === "completado" || a.estatus === "archivado";

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      border: "1px solid #E2E8F0",
      borderTop: "4px solid " + tm.color,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      opacity: isCompleted ? 0.75 : 1,
    }}>
      {/* Header */}
      <div style={{ padding: "12px 14px 8px", background: tm.bg, borderBottom: "1px solid " + tm.color + "33" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 20 }}>{tm.icon}</span>
            <div>
              <div style={{ fontSize: 11, color: tm.color, fontWeight: 700, textTransform: "uppercase" }}>{tm.label}{rs ? " · " + rs.icon + " " + rs.label : ""}</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1E293B", marginTop: 1 }}>{a.nombre || "Sin nombre"}</div>
            </div>
          </div>
          {marca && <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: marca.color + "22", color: marca.color, fontWeight: 700, whiteSpace: "nowrap" }}>{marca.label}</span>}
        </div>
        <div style={{ fontSize: 11, color: "#64748B", marginTop: 6, display: "flex", gap: 10, flexWrap: "wrap" }}>
          {fechaTxt && <span>📆 {fechaTxt}</span>}
          {Number(a.inversion) > 0 && <span style={{ fontWeight: 600, color: "#10B981" }}>💰 {fmtMXN(a.inversion)}</span>}
          {a.responsable && <span>👤 {a.responsable}</span>}
        </div>
        {a.mensaje && <div style={{ fontSize: 12, color: "#475569", marginTop: 6, fontStyle: "italic" }}>"{a.mensaje}"</div>}
      </div>

      {/* Métricas */}
      <div style={{ padding: "10px 14px", flex: 1 }}>
        {tm.metricas.length > 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(90px, 1fr))", gap: 8 }}>
            {tm.metricas.map(m => {
              const v = metricas[m.key];
              const display = v != null && v !== "" ? (m.money ? fmtMXN(v) : fmtNum(v)) : "—";
              return (
                <div key={m.key} style={{ background: "#F8FAFC", borderRadius: 6, padding: "6px 8px" }}>
                  <div style={{ fontSize: 9, color: "#94A3B8", textTransform: "uppercase", fontWeight: 600 }}>{m.label}</div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: v != null && v !== "" ? "#1E293B" : "#CBD5E1", marginTop: 1 }}>{display}</div>
                </div>
              );
            })}
          </div>
        )}
        {/* Evento extras */}
        {a.tipo === "evento" && (a.evento_sucursal || a.evento_pop) && (
          <div style={{ marginTop: 8, padding: "6px 8px", background: "#FCE7F3", borderRadius: 6, fontSize: 11, color: "#831843" }}>
            {a.evento_sucursal && <div>🏢 Sucursal: <strong>{a.evento_sucursal}</strong></div>}
            {a.evento_pop && <div>🎁 POP: {a.evento_pop}</div>}
          </div>
        )}
      </div>

      {/* Footer actions */}
      <div style={{ padding: "8px 14px", borderTop: "1px solid #E2E8F0", background: "#FAFBFC", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <button onClick={() => onToggle(a)} style={{ padding: "4px 10px", background: isCompleted ? "#FEF3C7" : "#D1FAE5", border: "1px solid " + (isCompleted ? "#FDE68A" : "#A7F3D0"), borderRadius: 6, fontSize: 11, cursor: "pointer", color: isCompleted ? "#92400E" : "#065F46", fontWeight: 600 }}>
          {isCompleted ? "↺ Reactivar" : "✓ Completar"}
        </button>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => onEdit(a)} style={{ padding: "4px 10px", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#475569" }}>✏️ Editar</button>
          <button onClick={() => onDelete(a.id)} style={{ padding: "4px 10px", background: "#fff", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 11, cursor: "pointer", color: "#991B1B" }}>🗑</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════ FORMULARIO (Modal) ═══════════════════════
function ActividadForm({ form, setForm, editId, saving, onSave, onClose }) {
  const tipoMeta = TIPOS[form.tipo] || TIPOS.mailing;
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setMet = (k, v) => setForm(f => ({ ...f, metricas: { ...f.metricas, [k]: v === "" ? null : (isNaN(v) ? v : Number(v)) } }));

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(15,23,42,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: "#fff", borderRadius: 12, maxWidth: 640, width: "100%", maxHeight: "90vh",
        overflowY: "auto", display: "flex", flexDirection: "column"
      }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #E2E8F0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editId ? "Editar actividad" : "Nueva actividad"}</h3>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "#64748B" }}>×</button>
        </div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Tipo + Marca */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Field label="Tipo de actividad">
              <select value={form.tipo} onChange={e => set("tipo", e.target.value)} style={inputStyle}>
                {Object.entries(TIPOS).map(([k, t]) => <option key={k} value={k}>{t.icon} {t.label}</option>)}
              </select>
            </Field>
            <Field label="Marca">
              <select value={form.marca} onChange={e => set("marca", e.target.value)} style={inputStyle}>
                {Object.entries(MARCAS).map(([k, m]) => <option key={k} value={k}>{m.label}</option>)}
              </select>
            </Field>
          </div>

          {/* Fecha + Red social (si reel) */}
          <div style={{ display: "grid", gridTemplateColumns: tipoMeta.redSocial ? "1fr 1fr" : "1fr", gap: 10 }}>
            <Field label="Fecha">
              <input type="date" value={form.fecha} onChange={e => set("fecha", e.target.value)} style={inputStyle} />
            </Field>
            {tipoMeta.redSocial && (
              <Field label="Red social">
                <select value={form.red_social} onChange={e => set("red_social", e.target.value)} style={inputStyle}>
                  <option value="">Selecciona...</option>
                  {Object.entries(REDES_SOCIALES).map(([k, r]) => <option key={k} value={k}>{r.icon} {r.label}</option>)}
                </select>
              </Field>
            )}
          </div>

          <Field label="Nombre / título">
            <input type="text" value={form.nombre} onChange={e => set("nombre", e.target.value)} placeholder="Ej: Black Friday Sillas Gamer" style={inputStyle} />
          </Field>

          <Field label="Temática / mensaje (opcional)">
            <input type="text" value={form.mensaje} onChange={e => set("mensaje", e.target.value)} placeholder="Qué promueve esta actividad" style={inputStyle} />
          </Field>

          <Field label="Inversión ($)">
            <input type="number" value={form.inversion} onChange={e => set("inversion", e.target.value)} style={inputStyle} />
          </Field>

          {/* Métricas específicas del tipo */}
          <div style={{ background: tipoMeta.bg, padding: 12, borderRadius: 8, border: "1px solid " + tipoMeta.color + "55" }}>
            <div style={{ fontSize: 11, color: tipoMeta.color, fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>
              Métricas {tipoMeta.icon} {tipoMeta.label}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              {tipoMeta.metricas.map(m => (
                <Field key={m.key} label={m.label}>
                  <input type="number" value={form.metricas?.[m.key] ?? ""} onChange={e => setMet(m.key, e.target.value)} style={inputStyle} />
                </Field>
              ))}
            </div>
          </div>

          {/* Eventos */}
          {tipoMeta.evento && (
            <div style={{ background: "#FCE7F3", padding: 12, borderRadius: 8, border: "1px solid #F9A8D4" }}>
              <div style={{ fontSize: 11, color: "#831843", fontWeight: 700, marginBottom: 8, textTransform: "uppercase" }}>🎪 Detalle del evento</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Field label="Sucursal">
                  <input type="text" value={form.evento_sucursal} onChange={e => set("evento_sucursal", e.target.value)} placeholder="Dónde se realizó" style={inputStyle} />
                </Field>
                <Field label="POP / material">
                  <input type="text" value={form.evento_pop} onChange={e => set("evento_pop", e.target.value)} placeholder="Ej: Lona, displays, muestras" style={inputStyle} />
                </Field>
              </div>
            </div>
          )}

          <Field label="Responsable (opcional)">
            <input type="text" value={form.responsable} onChange={e => set("responsable", e.target.value)} style={inputStyle} />
          </Field>

          <Field label="Notas (opcional)">
            <textarea value={form.notas} onChange={e => set("notas", e.target.value)} rows={2} style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
          </Field>
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid #E2E8F0", display: "flex", gap: 8, justifyContent: "flex-end", background: "#FAFBFC" }}>
          <button onClick={onClose} disabled={saving} style={{ padding: "8px 14px", background: "#fff", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, cursor: "pointer" }}>Cancelar</button>
          <button onClick={onSave} disabled={saving} style={{ padding: "8px 18px", background: "#3B82F6", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
            {saving ? "Guardando..." : (editId ? "Guardar cambios" : "Crear actividad")}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = { padding: "7px 10px", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 13, width: "100%", boxSizing: "border-box" };

// ═══════════ CALENDARIO ANUAL ═══════════════════════
function CalendarioAnual({ anio, actividades, filterTipo, filterMarca, mesSel, onSelectMes }) {
  // Agrupar actividades por mes y tipo
  const porMes = React.useMemo(() => {
    const out = {};
    for (let m = 1; m <= 12; m++) out[m] = { total: 0, porTipo: {}, inv: 0 };
    const parse = (f) => { if (!f) return null; const p = String(f).slice(0,10).split("-").map(n => parseInt(n,10)); return p.length === 3 && p[0] ? { y: p[0], m: p[1] } : null; };
    actividades.forEach(a => {
      const pf = parse(a.fecha);
      const m = pf ? pf.m : Number(a.mes) || 0;
      const y = pf ? pf.y : Number(a.anio) || 0;
      if (y !== anio) return;
      if (m < 1 || m > 12) return;
      if (filterTipo !== "todos" && a.tipo !== filterTipo) return;
      if (filterMarca !== "todas" && a.marca !== filterMarca) return;
      out[m].total++;
      out[m].porTipo[a.tipo] = (out[m].porTipo[a.tipo] || 0) + 1;
      out[m].inv += Number(a.inversion) || 0;
    });
    return out;
  }, [actividades, anio, filterTipo, filterMarca]);

  const totalAnual = Object.values(porMes).reduce((s, m) => s + m.total, 0);
  const invAnual = Object.values(porMes).reduce((s, m) => s + m.inv, 0);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
        {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => {
          const data = porMes[m];
          const isSelected = m === mesSel;
          return (
            <div key={m}
              onClick={() => onSelectMes(m)}
              style={{
                background: isSelected ? "#EFF6FF" : "#F8FAFC",
                border: isSelected ? "2px solid #3B82F6" : "1px solid #E2E8F0",
                borderRadius: 8, padding: "10px 12px", cursor: "pointer",
                display: "flex", flexDirection: "column", gap: 6, minHeight: 100
              }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#1E293B" }}>{MESES_CORTOS[m-1]}</div>
                <div style={{ fontSize: 11, color: "#64748B" }}>{data.total} {data.total === 1 ? "act" : "acts"}</div>
              </div>
              {data.total > 0 && (
                <>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                    {Object.entries(data.porTipo).map(([t, c]) => {
                      const tm = TIPOS[t] || { color: "#94A3B8", label: t };
                      return (
                        <div key={t} title={tm.label + ": " + c} style={{
                          fontSize: 9, padding: "1px 6px", borderRadius: 8,
                          background: tm.color + "22", color: tm.color, fontWeight: 600
                        }}>{c}</div>
                      );
                    })}
                  </div>
                  {data.inv > 0 && <div style={{ fontSize: 10, color: "#10B981", fontWeight: 600 }}>{fmtMXN(data.inv)}</div>}
                </>
              )}
              {data.total === 0 && <div style={{ fontSize: 10, color: "#CBD5E1", fontStyle: "italic" }}>Sin actividad</div>}
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 12, padding: "8px 12px", background: "#F8FAFC", borderRadius: 8, display: "flex", justifyContent: "space-between", fontSize: 12, color: "#475569" }}>
        <span><strong>Total anual:</strong> {totalAnual} actividades</span>
        <span><strong>Inversión:</strong> {fmtMXN(invAnual)}</span>
      </div>
    </div>
  );
}
