import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';

export default function MarketingCliente({ cliente = "Digitalife", clienteKey }) {
  const MESES_ARR = [
    { key: "01", short: "Ene", full: "Enero" }, { key: "02", short: "Feb", full: "Febrero" },
    { key: "03", short: "Mar", full: "Marzo" }, { key: "04", short: "Abr", full: "Abril" },
    { key: "05", short: "May", full: "Mayo" }, { key: "06", short: "Jun", full: "Junio" },
    { key: "07", short: "Jul", full: "Julio" }, { key: "08", short: "Ago", full: "Agosto" },
    { key: "09", short: "Sep", full: "Septiembre" }, { key: "10", short: "Oct", full: "Octubre" },
    { key: "11", short: "Nov", full: "Noviembre" }, { key: "12", short: "Dic", full: "Diciembre" },
  ];
  const TIPO_META = {
    digital: { label: "Digital", color: "#3b82f6", icon: "💻" },
    fisico: { label: "Físico", color: "#10b981", icon: "🏪" },
    extra: { label: "Extra", color: "#f59e0b", icon: "⭐" },
  };

  const [actividades, setActividades] = React.useState([]);
  const [pagosMarketing, setPagosMarketing] = React.useState([]);
  const [selloutData, setSelloutData] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [anio, setAnio] = React.useState(2026);
  const [showForm, setShowForm] = React.useState(false);
  const [editItem, setEditItem] = React.useState(null);
  const [expandedId, setExpandedId] = React.useState(null);
  const [saving, setSaving] = React.useState(false);
  const [flash, setFlash] = React.useState(null);

  const emptyForm = { nombre: "", tipo: "digital", tematica: "", sku: "", costo: "", periodo_inicio: "", periodo_fin: "", vistas: "", clics: "", notas: "", responsable: "" };
  const [form, setForm] = React.useState({ ...emptyForm });
  // Calendar states
  const [calView, setCalView] = React.useState("mes");
  const now = new Date();
  const [calMonth, setCalMonth] = React.useState(now.getMonth());
  const [calYear, setCalYear] = React.useState(now.getFullYear());
  const [dragStart, setDragStart] = React.useState(null);
  const [dragEnd, setDragEnd] = React.useState(null);
  const [isDragging, setIsDragging] = React.useState(false);

  const showFlash = (msg, type) => { setFlash({ msg, type }); setTimeout(() => setFlash(null), 3000); };
  const formatMXN = (v) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v || 0);

  // Load activities + pagos marketing + sellout
  React.useEffect(() => {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    Promise.all([
      supabase.from("marketing_actividades").select("*").eq("cliente", clienteKey || cliente).eq("anio", anio),
      supabase.from("pagos").select("*").eq("categoria", "marketing"),
      supabase.from("sellout_sku").select("*").eq("cliente", clienteKey || cliente).limit(10000),
    ]).then(([actRes, pagRes, soRes]) => {
      if (actRes.data) setActividades(actRes.data);
      if (pagRes.data) setPagosMarketing(pagRes.data);
      if (soRes.data) setSelloutData(soRes.data);
      setLoading(false);
    });
    const chan = supabase.channel("mkt-rt-" + anio)
      .on("postgres_changes", { event: "*", schema: "public", table: "marketing_actividades" }, (payload) => {
        if (payload.eventType === "INSERT") setActividades(prev => [...prev, payload.new]);
        else if (payload.eventType === "UPDATE") setActividades(prev => prev.map(a => a.id === payload.new.id ? payload.new : a));
        else if (payload.eventType === "DELETE") setActividades(prev => prev.filter(a => a.id !== payload.old.id));
      }).subscribe();
    return () => { supabase.removeChannel(chan); };
  }, [cliente, clienteKey, anio]);

  // ── CRUD ──
  const handleSave = async () => {
    if (!form.nombre.trim()) return;
    setSaving(true);
    const row = {
      nombre: form.nombre.trim(),
      tipo: form.tipo,
      mensaje: form.tematica.trim(),
      producto: form.sku.trim(),
      costo: parseFloat(form.costo) || 0,
      temporalidad: form.periodo_inicio || null,
      subtipo: form.periodo_fin || null,
      alcance: parseInt(form.vistas) || 0,
      clics: parseInt(form.clics) || 0,
      notas: form.notas.trim() || null,
      responsable: form.responsable.trim() || null,
      cliente: clienteKey || cliente,
      anio,
      estatus: "activo",
      mes: form.periodo_inicio ? parseInt(form.periodo_inicio.slice(5, 7)) : new Date().getMonth() + 1,
    };
    if (editItem) {
      const { error } = await supabase.from("marketing_actividades").update(row).eq("id", editItem.id);
      if (error) { showFlash("Error al actualizar", "err"); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("marketing_actividades").insert([row]);
      if (error) { showFlash("Error al crear actividad", "err"); setSaving(false); return; }
    }
    setSaving(false);
    setShowForm(false);
    setEditItem(null);
    setForm({ ...emptyForm });
    showFlash(editItem ? "Actividad actualizada" : "Actividad creada");
    // Reload
    const { data } = await supabase.from("marketing_actividades").select("*").eq("cliente", clienteKey || cliente).eq("anio", anio);
    if (data) setActividades(data);
  };

  const handleEdit = (act) => {
    setForm({
      nombre: act.nombre || "",
      tipo: act.tipo || "digital",
      tematica: act.mensaje || "",
      sku: act.producto || "",
      costo: act.costo || "",
      periodo_inicio: act.temporalidad || "",
      periodo_fin: act.subtipo || "",
      vistas: act.alcance || "",
      clics: act.clics || "",
      notas: act.notas || "",
      responsable: act.responsable || "",
    });
    setEditItem(act);
    setShowForm(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm("¿Eliminar esta actividad?")) return;
    await supabase.from("marketing_actividades").delete().eq("id", id);
    setActividades(prev => prev.filter(a => a.id !== id));
    showFlash("Actividad eliminada");
  };

  // ── Generate 12 monthly payments ──
  const handleGeneratePagos = async () => {
    if (!window.confirm("Esto creará 12 pagos mensuales de marketing proporcionales al total de inversión. ¿Continuar?")) return;
    const totalInversion = actividades.reduce((s, a) => s + (Number(a.costo) || 0), 0);
    const montoMensual = Math.round(totalInversion / 12);
    const existingMeses = pagosMarketing.map(p => p.fecha_compromiso ? p.fecha_compromiso.slice(5, 7) : null).filter(Boolean);
    const newMeses = MESES_ARR.filter(m => !existingMeses.includes(m.key));
    if (newMeses.length === 0) { showFlash("Ya existen pagos para todos los meses", "err"); return; }
    const records = newMeses.map(m => ({
      folio: "",
      concepto: "Plan Marketing " + anio + " - " + cliente,
      categoria: "marketing",
      monto: montoMensual,
      estatus: "pendiente",
      fecha_compromiso: anio + "-" + m.key + "-01",
      fecha_pago_real: null,
      responsable: null,
      notas: null,
      }));
    setSaving(true);
    const { data, error } = await supabase.from("pagos").insert(records).select();
    setSaving(false);
    if (error) { showFlash("Error al crear pagos", "err"); return; }
    setPagosMarketing(prev => [...prev, ...data]);
    showFlash(newMeses.length + " pagos mensuales creados");
  };

  // ── KPIs ──
  const totalInversion = actividades.reduce((s, a) => s + (Number(a.costo) || 0), 0);
  const pagoMensual = totalInversion > 0 ? Math.round(totalInversion / 12) : 0;
  const totalPagado = pagosMarketing.filter(p => p.estatus === "pagado").reduce((s, p) => s + (Number(p.monto) || 0), 0);
  const totalPendiente = totalInversion - totalPagado;

  // ── Sell Out matching ──
  const getSellOutForActivity = (act) => {
    const sku = (act.producto || "").toLowerCase().trim();
    const inicio = act.temporalidad;
    const fin = act.subtipo;
    if (!sku || !inicio) return 0;
    return selloutData.filter(s => {
      const skuMatch = (s.sku || "").toLowerCase().includes(sku) || (s.descripcion || "").toLowerCase().includes(sku) || (s.categoria || "").toLowerCase().includes(sku);
      if (!skuMatch) return false;
      if (!s.fecha) return false;
      const fecha = s.fecha;
      if (inicio && fecha < inicio) return false;
      if (fin && fecha > fin) return false;
      return true;
    }).reduce((s, r) => s + (Number(r.monto_pesos || r.venta_pesos || r.total) || 0), 0);
  };

  const totalSellOut = actividades.reduce((s, a) => s + getSellOutForActivity(a), 0);
  const roi = totalInversion > 0 ? ((totalSellOut / totalInversion) * 100).toFixed(1) : 0;

  if (loading) return (<div className="flex items-center justify-center py-20"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div><span className="ml-3 text-gray-500">Cargando marketing...</span></div>);

  return (
    <div className="space-y-6">
      {/* Flash message */}
      {flash && (
        <div className={"fixed top-4 right-4 z-50 px-4 py-2 rounded-xl text-sm font-semibold shadow-lg " + (flash.type === "err" ? "bg-red-100 text-red-700" : "bg-green-100 text-green-700")}>
          {flash.msg}
        </div>
      )}

      {/* ═══ HEADER ═══ */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-800">📣 Plan de Marketing {anio}</h2>
          <p className="text-sm text-gray-500 mt-1">{cliente} · {actividades.length} actividades registradas</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={anio} onChange={e => setAnio(Number(e.target.value))} className="border rounded-lg px-3 py-1.5 text-sm bg-white">
            <option value={2025}>2025</option>
            <option value={2026}>2026</option>
          </select>
          {DB_CONFIGURED && (
            <button onClick={() => { setForm({...emptyForm}); setEditItem(null); setShowForm(true); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              + Nueva Actividad
            </button>
          )}
        </div>
      </div>

      {/* ═══ FINANCIAL SUMMARY ═══ */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Inversión Total</p>
          <p className="text-xl font-bold text-gray-800">{formatMXN(totalInversion)}</p>
          <p className="text-xs text-gray-400 mt-1">{actividades.length} actividades</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Pago Mensual</p>
          <p className="text-xl font-bold text-blue-600">{formatMXN(pagoMensual)}</p>
          <p className="text-xs text-gray-400 mt-1">Total ÷ 12</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Pagado</p>
          <p className="text-xl font-bold text-green-600">{formatMXN(totalPagado)}</p>
          <p className="text-xs text-gray-400 mt-1">{pagosMarketing.filter(p => p.estatus === "pagado").length} de {pagosMarketing.length} meses</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Pendiente</p>
          <p className="text-xl font-bold text-orange-500">{formatMXN(totalPendiente > 0 ? totalPendiente : 0)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm">
          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Sell Out / ROI</p>
          <p className="text-xl font-bold text-purple-600">{formatMXN(totalSellOut)}</p>
          <p className="text-xs text-gray-400 mt-1">{roi}% retorno</p>
        </div>
      </div>
      {/* Generate payments button */}
      {DB_CONFIGURED && pagosMarketing.length < 12 && totalInversion > 0 && (
        <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3 border border-blue-200">
          <span className="text-sm text-blue-700">Plan total: {formatMXN(totalInversion)} → {formatMXN(pagoMensual)}/mes</span>
          <button onClick={handleGeneratePagos} disabled={saving}
            className="ml-auto px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors">
            {saving ? "Creando..." : "Generar Pagos Mensuales"}
          </button>
        </div>
      )}

      {/* ═══ CALENDARIO ═══ */}
      {(() => {
        const daysInMonth = (m, y) => new Date(y, m + 1, 0).getDate();
        const firstDayOfWeek = (m, y) => { const d = new Date(y, m, 1).getDay(); return d === 0 ? 6 : d - 1; };
        const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

        // Get activities for a specific month
        const getActsForMonth = (m) => {
          const monthKey = String(m + 1).padStart(2, "0");
          const monthStr = anio + "-" + monthKey;
          return actividades.filter(a => {
            const inicio = a.temporalidad || "";
            const fin = a.subtipo || "";
            if (inicio) {
              const inicioM = inicio.slice(0, 7);
              const finM = fin ? fin.slice(0, 7) : inicioM;
              return inicioM <= monthStr && finM >= monthStr;
            }
            return a.mes === m + 1;
          });
        };

        // Get activities for a specific day in a specific month
        const getActsForDay = (m, day) => {
          const monthKey = String(m + 1).padStart(2, "0");
          const dateStr = anio + "-" + monthKey + "-" + String(day).padStart(2, "0");
          const actsMes = getActsForMonth(m);
          return actsMes.filter(a => {
            const inicio = a.temporalidad || "";
            const fin = a.subtipo || inicio;
            if (inicio) return inicio <= dateStr && fin >= dateStr;
            return true;
          });
        };

        // Drag handlers for monthly view
        const monthKey = String(calMonth + 1).padStart(2, "0");
        const handleMouseDown = (day) => { setDragStart(day); setDragEnd(day); setIsDragging(true); };
        const handleMouseEnter = (day) => { if (isDragging) setDragEnd(day); };
        const handleMouseUp = (day) => {
          if (isDragging) {
            setIsDragging(false);
            const d1 = Math.min(dragStart, day);
            const d2 = Math.max(dragStart, day);
            const pInicio = anio + "-" + monthKey + "-" + String(d1).padStart(2, "0");
            const pFin = anio + "-" + monthKey + "-" + String(d2).padStart(2, "0");
            setForm({...emptyForm, periodo_inicio: pInicio, periodo_fin: d1 === d2 ? "" : pFin});
            setEditItem(null);
            setShowForm(true);
          }
        };
        const isInDragRange = (day) => {
          if (!isDragging || dragStart === null) return false;
          const d1 = Math.min(dragStart, dragEnd || dragStart);
          const d2 = Math.max(dragStart, dragEnd || dragStart);
          return day >= d1 && day <= d2;
        };

        return (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            {/* Calendar header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                {calView === "mes" && (
                  <>
                    <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(calYear - 1); } else setCalMonth(calMonth - 1); }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm font-bold">&lt;</button>
                    <h3 className="text-lg font-bold text-gray-800 min-w-[180px] text-center">{MESES_ARR[calMonth] ? MESES_ARR[calMonth].full : ""} {calYear}</h3>
                    <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(calYear + 1); } else setCalMonth(calMonth + 1); }} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm font-bold">&gt;</button>
                  </>
                )}
                {calView === "anual" && (
                  <>
                    <button onClick={() => setCalYear(calYear - 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm font-bold">&lt;</button>
                    <h3 className="text-lg font-bold text-gray-800 min-w-[100px] text-center">{calYear}</h3>
                    <button onClick={() => setCalYear(calYear + 1)} className="w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500 text-sm font-bold">&gt;</button>
                  </>
                )}
              </div>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                {[{k:"mes",l:"Mes"},{k:"anual",l:"Anual"}].map(v => (
                  <button key={v.k} onClick={() => setCalView(v.k)} className={"px-3 py-1.5 rounded-md text-xs font-semibold transition-colors " + (calView === v.k ? "bg-white text-gray-800 shadow-sm" : "text-gray-500 hover:text-gray-700")}>{v.l}</button>
                ))}
              </div>
            </div>
            {/* ── MONTHLY GRID ── */}
            {calView === "mes" && (() => {
              const totalDays = daysInMonth(calMonth, calYear);
              const startDay = firstDayOfWeek(calMonth, calYear);
              return (
                <div>
                  <p className="text-xs text-gray-400 mb-3">{getActsForMonth(calMonth).length} actividades \u00b7 Click en un d\u00eda para crear, arrastra para definir periodo</p>
                  <div onMouseLeave={() => { if (isDragging) setIsDragging(false); }} style={{ userSelect: "none" }}>
                    <div className="grid grid-cols-7 gap-0">
                      {DIAS.map(d => (<div key={d} className="text-center text-xs font-semibold text-gray-400 py-2 border-b border-gray-100">{d}</div>))}
                      {Array.from({ length: startDay }).map((_, i) => (<div key={"e" + i} className="min-h-[80px] border-b border-r border-gray-50"></div>))}
                      {Array.from({ length: totalDays }).map((_, i) => {
                        const day = i + 1;
                        const dayActs = getActsForDay(calMonth, day);
                        const inRange = isInDragRange(day);
                        const isToday = day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear();
                        return (
                          <div key={day}
                            onMouseDown={() => handleMouseDown(day)}
                            onMouseEnter={() => handleMouseEnter(day)}
                            onMouseUp={() => handleMouseUp(day)}
                            className={"min-h-[80px] border-b border-r border-gray-50 p-1 cursor-crosshair transition-colors " + (inRange ? "bg-blue-50" : "hover:bg-gray-50")}
                          >
                            <div className={"text-xs font-semibold mb-1 " + (isToday ? "bg-blue-600 text-white w-6 h-6 rounded-full flex items-center justify-center" : "text-gray-500 pl-1")}>{day}</div>
                            <div className="space-y-0.5">
                              {dayActs.slice(0, 3).map((a, idx) => {
                                const meta = TIPO_META[a.tipo] || TIPO_META.digital;
                                return (<div key={a.id || idx} onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === a.id ? null : a.id); }} className="text-xs px-1.5 py-0.5 rounded truncate cursor-pointer hover:opacity-80" style={{ backgroundColor: meta.color + "20", color: meta.color, borderLeft: "3px solid " + meta.color }} title={a.nombre}>{a.nombre}</div>);
                              })}
                              {dayActs.length > 3 && (<div className="text-xs text-gray-400 pl-1">+{dayActs.length - 3} m\u00e1s</div>)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })()}
            {/* ── ANNUAL VIEW ── */}
            {calView === "anual" && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {MESES_ARR.map((mes, mi) => {
                  const td = daysInMonth(mi, calYear);
                  const sd = firstDayOfWeek(mi, calYear);
                  const mActs = getActsForMonth(mi);
                  const isCurrentMonth = mi === new Date().getMonth() && calYear === new Date().getFullYear();
                  // Count activities per day for intensity
                  const dayCounts = {};
                  mActs.forEach(a => {
                    const mk = String(mi + 1).padStart(2, "0");
                    for (let d = 1; d <= td; d++) {
                      const ds = calYear + "-" + mk + "-" + String(d).padStart(2, "0");
                      const ini = a.temporalidad || "";
                      const fin = a.subtipo || ini;
                      if (ini && ini <= ds && fin >= ds) dayCounts[d] = (dayCounts[d] || 0) + 1;
                      else if (!ini) dayCounts[d] = (dayCounts[d] || 0) + 1;
                    }
                  });
                  return (
                    <div key={mi} className={"rounded-xl border p-3 cursor-pointer hover:shadow-md transition-all " + (isCurrentMonth ? "border-blue-300 bg-blue-50/30" : "border-gray-100 bg-white")} onClick={() => { setCalMonth(mi); setCalView("mes"); }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className={"text-sm font-bold " + (isCurrentMonth ? "text-blue-700" : "text-gray-700")}>{mes.short}</span>
                        {mActs.length > 0 && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-600 font-semibold">{mActs.length}</span>
                        )}
                      </div>
                      {/* Mini calendar grid */}
                      <div className="grid grid-cols-7 gap-0">
                        {DIAS.map(d => (<div key={d} className="text-center text-[9px] text-gray-300 font-medium">{d}</div>))}
                        {Array.from({ length: sd }).map((_, i) => (<div key={"e" + i}></div>))}
                        {Array.from({ length: td }).map((_, i) => {
                          const day = i + 1;
                          const count = dayCounts[day] || 0;
                          const isToday = day === new Date().getDate() && isCurrentMonth;
                          let bg = "";
                          if (count >= 3) bg = "bg-blue-500 text-white";
                          else if (count === 2) bg = "bg-blue-300 text-white";
                          else if (count === 1) bg = "bg-blue-100 text-blue-700";
                          if (isToday && !count) bg = "bg-gray-800 text-white";
                          else if (isToday) bg = bg.replace("bg-blue-", "bg-indigo-") + " ring-1 ring-indigo-400";
                          return (
                            <div key={day} className={"text-center text-[10px] py-0.5 rounded-sm " + (bg || "text-gray-500")} title={count > 0 ? count + " actividades" : ""}>{day}</div>
                          );
                        })}
                      </div>
                      {/* Activity type summary */}
                      {mActs.length > 0 && (
                        <div className="flex gap-1 mt-2 flex-wrap">
                          {Object.entries(TIPO_META).map(([k, v]) => {
                            const c = mActs.filter(a => a.tipo === k).length;
                            if (c === 0) return null;
                            return (<span key={k} className="text-[9px] px-1 py-0.5 rounded font-semibold" style={{ backgroundColor: v.color + "20", color: v.color }}>{v.icon}{c}</span>);
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}</div>
  );
})()}
      {/* ═══ ADD/EDIT FORM ═══ */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-gray-800">{editItem ? "Editar Actividad" : "Nueva Actividad"}</h3>
            <button onClick={() => { setShowForm(false); setEditItem(null); setForm({...emptyForm}); }} className="text-gray-400 hover:text-gray-600 text-xl">&times;</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Nombre */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Nombre de la actividad *</label>
              <input type="text" value={form.nombre} onChange={e => setForm({...form, nombre: e.target.value})} placeholder="Ej: Banner Home Semana Santa" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
            {/* Tipo */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
              <div className="flex gap-2">
                {Object.entries(TIPO_META).map(([k, v]) => (
                  <button key={k} onClick={() => setForm({...form, tipo: k})} className={"flex-1 px-3 py-2 rounded-lg text-sm font-semibold border transition-colors " + (form.tipo === k ? "text-white border-transparent" : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50")} style={form.tipo === k ? { backgroundColor: v.color } : {}}>
                    {v.icon} {v.label}
                  </button>
                ))}
              </div>
            </div>
            {/* Costo */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Costo (MXN)</label>
              <input type="number" value={form.costo} onChange={e => setForm({...form, costo: e.target.value})} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
            {/* Tematica */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Tem\u00e1tica</label>
              <input type="text" value={form.tematica} onChange={e => setForm({...form, tematica: e.target.value})} placeholder="Ej: Hot Sale, Regreso a clases..." className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
            {/* SKU / Producto */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">SKU / Producto</label>
              <input type="text" value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="SKU, categor\u00eda o marca" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
              <p className="text-xs text-gray-400 mt-1">Texto libre, se conecta con Sell Out</p>
            </div>
            {/* Responsable */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Responsable</label>
              <input type="text" value={form.responsable} onChange={e => setForm({...form, responsable: e.target.value})} placeholder="Nombre del responsable" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
            {/* Periodo inicio */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Periodo inicio</label>
              <input type="date" value={form.periodo_inicio} onChange={e => setForm({...form, periodo_inicio: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
            {/* Periodo fin */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Periodo fin</label>
              <input type="date" value={form.periodo_fin} onChange={e => setForm({...form, periodo_fin: e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
            </div>
            {/* Digital metrics: vistas + clics */}
            {form.tipo === "digital" && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Vistas</label>
                  <input type="number" value={form.vistas} onChange={e => setForm({...form, vistas: e.target.value})} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Clics</label>
                  <input type="number" value={form.clics} onChange={e => setForm({...form, clics: e.target.value})} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none" />
                </div>
              </>
            )}
            {/* Notas - always show but especially for fisico/extra */}
            <div className={form.tipo !== "digital" ? "md:col-span-2" : ""}>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Notas</label>
              <textarea value={form.notas} onChange={e => setForm({...form, notas: e.target.value})} placeholder={form.tipo === "digital" ? "Observaciones adicionales..." : "Resultados, observaciones, detalles del evento..."} rows={2} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400 outline-none resize-none" />
            </div>
          </div>
          {/* Save / Cancel */}
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-gray-100">
            <button onClick={() => { setShowForm(false); setEditItem(null); setForm({...emptyForm}); }} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={saving || !form.nombre.trim()} className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {saving ? "Guardando..." : (editItem ? "Actualizar" : "Crear Actividad")}
            </button>
          </div>
        </div>
      )}
      {/* ═══ ACTIVITY LIST ═══ */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Actividades ({actividades.length})</h3>
        {actividades.length === 0 ? (
          <div className="bg-white rounded-2xl border border-dashed border-gray-200 p-8 text-center">
            <p className="text-gray-400 text-sm">No hay actividades registradas para {anio}</p>
            {DB_CONFIGURED && <button onClick={() => { setForm({...emptyForm}); setEditItem(null); setShowForm(true); }} className="mt-3 text-blue-600 text-sm font-semibold hover:text-blue-700">+ Agregar primera actividad</button>}
          </div>
        ) : (
          actividades.map(act => {
            const meta = TIPO_META[act.tipo] || TIPO_META.digital;
            const soAmount = getSellOutForActivity(act);
            const actCosto = Number(act.costo) || 0;
            const actRoi = actCosto > 0 ? ((soAmount / actCosto) * 100).toFixed(0) : "--";
            const isExpanded = expandedId === act.id;
            return (
              <div key={act.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden transition-all">
                {/* Card header - clickable */}
                <div onClick={() => setExpandedId(isExpanded ? null : act.id)} className="flex items-center gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors">
                  <span className="text-2xl">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-gray-800 truncate">{act.nombre}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold text-white" style={{ backgroundColor: meta.color }}>{meta.label}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                      {act.mensaje && <span>{act.mensaje}</span>}
                      {act.producto && <span>SKU: {act.producto}</span>}
                      {act.temporalidad && <span>{act.temporalidad}{act.subtipo ? " a " + act.subtipo : ""}</span>}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-gray-800">{formatMXN(actCosto)}</p>
                    {soAmount > 0 && <p className="text-xs text-green-600 font-semibold">SO: {formatMXN(soAmount)} ({actRoi}%)</p>}
                  </div>
                  <span className={"text-gray-400 transition-transform " + (isExpanded ? "rotate-180" : "")}>&#9660;</span>
                </div>
                {/* Expanded detail */}
                {isExpanded && (
                  <div className="px-5 pb-5 border-t border-gray-100 bg-gray-50">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">Tem\u00e1tica</p>
                        <p className="text-sm text-gray-700">{act.mensaje || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">SKU / Producto</p>
                        <p className="text-sm text-gray-700">{act.producto || "—"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">Periodo</p>
                        <p className="text-sm text-gray-700">{act.temporalidad ? (act.temporalidad + (act.subtipo ? " a " + act.subtipo : "")) : "Sin definir"}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">Responsable</p>
                        <p className="text-sm text-gray-700">{act.responsable || "—"}</p>
                      </div>
                      {/* Digital metrics */}
                      {act.tipo === "digital" && (
                        <>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold">Vistas</p>
                            <p className="text-sm text-gray-700 font-bold">{(act.alcance || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold">Clics</p>
                            <p className="text-sm text-gray-700 font-bold">{(act.clics || 0).toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 font-semibold">CTR</p>
                            <p className="text-sm text-gray-700 font-bold">{act.alcance > 0 ? ((act.clics / act.alcance) * 100).toFixed(2) + "%" : "—"}</p>
                          </div>
                        </>
                      )}
                      {/* Sell Out */}
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">Sell Out</p>
                        <p className="text-sm font-bold" style={{ color: soAmount > 0 ? "#10b981" : "#9ca3af" }}>{formatMXN(soAmount)}</p>
                      </div>
                      {/* ROI */}
                      <div>
                        <p className="text-xs text-gray-400 font-semibold">ROI</p>
                        <p className="text-sm font-bold" style={{ color: Number(actRoi) > 100 ? "#10b981" : Number(actRoi) > 0 ? "#f59e0b" : "#9ca3af" }}>{actRoi}%</p>
                      </div>
                    </div>
                    {/* Notas */}
                    {act.notas && (
                      <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
                        <p className="text-xs text-gray-400 font-semibold mb-1">Notas</p>
                        <p className="text-sm text-gray-600">{act.notas}</p>
                      </div>
                    )}
                    {/* Actions */}
                    {DB_CONFIGURED && (
                      <div className="flex gap-2 mt-4 pt-3 border-t border-gray-200">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(act); }} className="px-4 py-1.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition-colors">Editar</button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(act.id); }} className="px-4 py-1.5 text-sm font-semibold text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors">Eliminar</button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}




// ── ANÁLISIS ──────────────────────────────────────────────────────────────────

