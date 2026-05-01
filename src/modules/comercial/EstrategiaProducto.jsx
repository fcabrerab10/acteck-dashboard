import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED, fetchAllPagesREST } from '../../lib/supabase';
import { formatMXN, loadSheetJS } from '../../lib/utils';
import { usePerfil } from '../../lib/perfilContext';
import { puedeEditarPestanaCliente } from '../../lib/permisos';
import { roadmapStyle, roadmapInfo } from '../../lib/roadmapColors';
import { PCEL_REAL } from '../../lib/constants';

export default function EstrategiaProducto({ cliente, clienteKey, onUploadComplete }) {
  const perfil = usePerfil();
  // Permiso granular por (clienteKey, 'estrategia'). Si está en 'ver', canEdit=false
  // y toda la UI queda solo-lectura (inputs bloqueados, botones ocultos).
  const canEdit = puedeEditarPestanaCliente(perfil, clienteKey, 'estrategia');
  const [loading, setLoading] = React.useState(false);
  const [message, setMessage] = React.useState("");
  const [datos, setDatos] = React.useState(null);
  const [searchFilter, setSearchFilter] = React.useState("");
  const [sortCol, setSortCol] = React.useState("stock");
    const [sortDir, setSortDir] = React.useState("desc");
  const [sugeridoEdits, setSugeridoEdits] = React.useState({});
  const [precioEdits, setPrecioEdits] = React.useState({});
  const [nuevosSearch, setNuevosSearch] = React.useState("");
  const [enCaminoSearch, setEnCaminoSearch] = React.useState("");
  const [riesgoSearch, setRiesgoSearch] = React.useState("");
  const [categoriaFilter, setCategoriaFilter] = React.useState("");
  const [soloActivosPcel, setSoloActivosPcel] = React.useState(() => {
    try { const v = localStorage.getItem("pcel_solo_activos"); return v === null ? true : v === "true"; } catch { return true; }
  });
  React.useEffect(() => {
    try { localStorage.setItem("pcel_solo_activos", String(soloActivosPcel)); } catch {}
  }, [soloActivosPcel]);

  // Cargar overrides persistidos desde Supabase al montar / cambiar de cliente
  React.useEffect(() => {
    if (!DB_CONFIGURED || !clienteKey) return;
    (async () => {
      const { data } = await supabase
        .from("sugerido_overrides")
        .select("sku, sugerido")
        .eq("cliente", clienteKey);
      const map = {};
      (data || []).forEach(r => { map[r.sku] = Number(r.sugerido); });
      setSugeridoEdits(map);
    })();
  }, [clienteKey]);

  // Indicadores de guardado por SKU { [sku]: "saving" | "saved" | "error" }
  const [sugeridoSaveState, setSugeridoSaveState] = React.useState({});
  const [precioSaveState,   setPrecioSaveState]   = React.useState({});
  const sugeridoTimeouts = React.useRef({});
  const precioTimeouts   = React.useRef({});

  // Guardar edit en Supabase (upsert por cliente+sku)
  const saveSugeridoOverride = async (sku, valor) => {
    if (!canEdit) return; // viewer/cliente sin permiso de edición
    if (!DB_CONFIGURED) return;
    const v = Number(valor) || 0;
    setSugeridoSaveState(p => ({ ...p, [sku]: "saving" }));
    const { error } = await supabase
      .from("sugerido_overrides")
      .upsert({ cliente: clienteKey, sku, sugerido: v, updated_at: new Date().toISOString() },
              { onConflict: "cliente,sku" });
    if (error) {
      console.error("saveSugeridoOverride error:", error);
      setSugeridoSaveState(p => ({ ...p, [sku]: "error" }));
    } else {
      setSugeridoSaveState(p => ({ ...p, [sku]: "saved" }));
      setTimeout(() => setSugeridoSaveState(p => { const n = { ...p }; delete n[sku]; return n; }), 1500);
    }
  };

  // Debounce: al cambiar, programa guardado 600ms después (se resetea si sigue escribiendo)
  const debounceSaveSugerido = (sku, valor) => {
    if (sugeridoTimeouts.current[sku]) clearTimeout(sugeridoTimeouts.current[sku]);
    sugeridoTimeouts.current[sku] = setTimeout(() => {
      saveSugeridoOverride(sku, valor);
    }, 600);
  };

  // Precio overrides — mismo patrón que sugerido
  React.useEffect(() => {
    if (!DB_CONFIGURED || !clienteKey) return;
    (async () => {
      const { data } = await supabase
        .from("precio_overrides")
        .select("sku, precio")
        .eq("cliente", clienteKey);
      const map = {};
      (data || []).forEach(r => { map[r.sku] = Number(r.precio); });
      setPrecioEdits(map);
    })();
  }, [clienteKey]);

  const savePrecioOverride = async (sku, valor) => {
    if (!canEdit) return;
    if (!DB_CONFIGURED) return;
    const v = Number(valor) || 0;
    setPrecioSaveState(p => ({ ...p, [sku]: "saving" }));
    const { error } = await supabase
      .from("precio_overrides")
      .upsert({ cliente: clienteKey, sku, precio: v, updated_at: new Date().toISOString() },
              { onConflict: "cliente,sku" });
    if (error) {
      console.error("savePrecioOverride error:", error);
      setPrecioSaveState(p => ({ ...p, [sku]: "error" }));
    } else {
      setPrecioSaveState(p => ({ ...p, [sku]: "saved" }));
      setTimeout(() => setPrecioSaveState(p => { const n = { ...p }; delete n[sku]; return n; }), 1500);
    }
  };

  const debounceSavePrecio = (sku, valor) => {
    if (precioTimeouts.current[sku]) clearTimeout(precioTimeouts.current[sku]);
    precioTimeouts.current[sku] = setTimeout(() => {
      savePrecioOverride(sku, valor);
    }, 600);
  };

  // ── Tracking de propuestas: Sugerí vs Compraron ──
  // Ventana exacta de 14 días desde la fecha de la propuesta:
  //   · Digitalife → sellout_detalle (fecha diaria exacta) — match preciso
  //   · PCEL → sellout_pcel (semanal). Tomamos las semanas que tocan los 14d
  //     (típicamente 2-3 semanas) y prorrateamos por días de cada semana
  //     que caen en la ventana.
  // Helper: ISO week (1-53) — semana ISO 8601 que usa Lunes como inicio
  const isoWeek = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return { anio: d.getUTCFullYear(), semana: Math.ceil((((d - yearStart) / 86400000) + 1) / 7) };
  };

  const propuestasConTracking = React.useMemo(() => {
    if (!propuestasHist || propuestasHist.length === 0 || !datos) return [];
    const esPcel = clienteKey === 'pcel';

    // ── Index Digitalife: sku → [{fecha, cantidad}] ──
    const ventasDiarias = {};
    if (!esPcel && datos.selloutDiario) {
      datos.selloutDiario.forEach((r) => {
        const sku = r.no_parte;
        if (!sku || !r.fecha) return;
        if (!ventasDiarias[sku]) ventasDiarias[sku] = [];
        ventasDiarias[sku].push({ fecha: r.fecha, cantidad: Number(r.cantidad) || 0 });
      });
    }

    // ── Index PCEL: sku → {anio-semana → vta_semana} ──
    const ventasSemanales = {};
    if (esPcel && datos.selloutPcelSemanal) {
      datos.selloutPcelSemanal.forEach((r) => {
        const sku = r.sku;
        if (!sku || r.anio == null || r.semana == null) return;
        if (!ventasSemanales[sku]) ventasSemanales[sku] = {};
        const k = Number(r.anio) + '-' + Number(r.semana);
        ventasSemanales[sku][k] = (ventasSemanales[sku][k] || 0) + (Number(r.vta_semana) || 0);
      });
    }

    // Para PCEL: cuántos días de la ventana caen dentro de cada semana
    // (asume semanas Lun-Dom, ISO). Útil para prorratear.
    const semanasEnVentana = (fechaInicio, dias) => {
      const out = {};
      const d = new Date(fechaInicio);
      for (let i = 0; i < dias; i++) {
        const cur = new Date(d.getTime() + i * 86400000);
        const { anio, semana } = isoWeek(cur);
        const k = anio + '-' + semana;
        out[k] = (out[k] || 0) + 1;
      }
      return out;
    };

    return propuestasHist.map((p) => {
      const filas = Array.isArray(p.filas) ? p.filas : [];
      if (filas.length === 0) return { ...p, tracking: { sinFilas: true } };
      const skusSug = filas.map((f) => ({
        sku: String(f.SKU || f['SKU Cliente'] || f.sku || ''),
        sugerido: Number(f.Sugerido || f.sugerido || 0),
      })).filter((s) => s.sku && s.sugerido > 0);
      if (skusSug.length === 0) return { ...p, tracking: { sinFilas: true } };

      const fechaPropuesta = new Date(p.fecha || p.created_at);
      const fechaIni = new Date(fechaPropuesta.getFullYear(), fechaPropuesta.getMonth(), fechaPropuesta.getDate());
      const fechaFin = new Date(fechaIni.getTime() + 14 * 86400000);
      const fechaIniISO = fechaIni.toISOString().slice(0, 10);
      const fechaFinISO = fechaFin.toISOString().slice(0, 10);

      const semanasVent = esPcel ? semanasEnVentana(fechaIni, 14) : null;

      let totalSug = 0, totalCompr = 0, skusComprados = 0;
      const detalle = skusSug.map((s) => {
        let compTotal = 0;
        if (esPcel) {
          // Sumar cada semana × (días que caen en ventana / 7)
          const sem = ventasSemanales[s.sku] || {};
          for (const k in semanasVent) {
            const ventaSem = sem[k] || 0;
            const factor = semanasVent[k] / 7;
            compTotal += ventaSem * factor;
          }
          compTotal = Math.round(compTotal);
        } else {
          // Digitalife: sumar cantidades en la ventana exacta
          const arr = ventasDiarias[s.sku] || [];
          for (const v of arr) {
            if (v.fecha >= fechaIniISO && v.fecha < fechaFinISO) {
              compTotal += v.cantidad;
            }
          }
        }
        totalSug += s.sugerido;
        totalCompr += Math.min(compTotal, s.sugerido);
        if (compTotal > 0) skusComprados += 1;
        return { sku: s.sku, sugerido: s.sugerido, comprado: compTotal };
      });
      const pct = totalSug > 0 ? (totalCompr / totalSug) * 100 : null;
      return {
        ...p,
        tracking: {
          totalSug, totalCompr, pct,
          skusTotales: skusSug.length,
          skusComprados,
          detalle,
          ventana: '14 días desde ' + fechaIniISO,
          metodoMatch: esPcel ? 'sellout_pcel semanal prorrateado' : 'sellout_detalle diario exacto',
        },
      };
    });
  }, [propuestasHist, datos, clienteKey]);

  // Banner KPI: % acierto promedio últimas 5 propuestas con datos
  const aciertoPromedio = React.useMemo(() => {
    const conDatos = (propuestasConTracking || [])
      .filter((p) => p.tracking && !p.tracking.sinFilas && p.tracking.pct != null)
      .slice(0, 5);
    if (conDatos.length === 0) return null;
    const avg = conDatos.reduce((s, p) => s + p.tracking.pct, 0) / conDatos.length;
    return { pct: avg, n: conDatos.length };
  }, [propuestasConTracking]);

  // ── Bulk operations: estados ──
  // Snapshot del último estado para Deshacer (Undo)
  const [undoSnapshot, setUndoSnapshot] = React.useState(null);
  // SKUs excluidos del envío (sólo memoria; se recalculan al recargar)
  const [excluidosSku, setExcluidosSku] = React.useState(new Set());
  // Modal de Vista Previa de bulk
  const [bulkPreview, setBulkPreview] = React.useState(null); // { modo, scope, cambios:[], totalAntes, totalDespues }
  // Modal de Calculadora reversa de cuota
  const [cuotaCalc, setCuotaCalc] = React.useState(null); // { meta, faltaMonto, cambios:[{sku,...}], cubre, sobrante }
  // Modificadores del scope del bulk (toolbar)
  const [bulkSoloFiltrados, setBulkSoloFiltrados] = React.useState(false);
  const [bulkSoloSinStock, setBulkSoloSinStock] = React.useState(false);
  // Tarjeta KPI desplegable abierta ('cuotaMes' | 'cumplYTD' | null)
  const [kpiAbierto, setKpiAbierto] = React.useState(null);

  // ── Recomendaciones del día (banner) ──
  // Triggers: stock=0 con sellout, faltante de cuota, productos nuevos sin propuesta.
  // Persistencia: localStorage por cliente, así no aparecen las descartadas en el día.
  const recomendacionesKey = React.useMemo(() => 'recoDescartadas-' + clienteKey + '-' + new Date().toISOString().slice(0, 10), [clienteKey]);
  const [recoDescartadas, setRecoDescartadas] = React.useState(() => {
    if (typeof localStorage === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem(recomendacionesKey);
      return raw ? new Set(JSON.parse(raw)) : new Set();
    } catch { return new Set(); }
  });
  React.useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      try { localStorage.setItem(recomendacionesKey, JSON.stringify([...recoDescartadas])); } catch {}
    }
  }, [recoDescartadas, recomendacionesKey]);
  // Recargar lista de descartadas al cambiar de cliente o día
  React.useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    try {
      const raw = localStorage.getItem(recomendacionesKey);
      setRecoDescartadas(raw ? new Set(JSON.parse(raw)) : new Set());
    } catch { setRecoDescartadas(new Set()); }
  }, [recomendacionesKey]);
  const descartarReco = (id) => setRecoDescartadas((prev) => {
    const next = new Set(prev); next.add(id); return next;
  });

  // ── Propuesta personalizada (selección manual de SKUs) ──
  // Para casos donde Fernando solo quiere mandar algunos SKUs específicos
  // (negociación puntual, lanzamiento, etc.), no la propuesta completa.
  const [propPersonalizada, setPropPersonalizada] = React.useState(null);
  // Estructura: { nombre, notas, skus: [{ sku, cantidad, precio }] }
  const abrirPropPersonalizada = () => {
    setPropPersonalizada({
      nombre: '',
      notas: '',
      skus: [],
      busqueda: '',
    });
  };
  const cerrarPropPersonalizada = () => setPropPersonalizada(null);
  const agregarSkuAPropPersonalizada = (skuItem) => {
    setPropPersonalizada((prev) => {
      if (!prev) return prev;
      if (prev.skus.find((s) => s.sku === skuItem.sku)) return prev; // ya está
      const precio = Number(skuItem.precioAAAcd) > 0 ? Number(skuItem.precioAAAcd) : Number(skuItem.precio) || 0;
      return {
        ...prev,
        skus: [...prev.skus, { sku: skuItem.sku, descripcion: skuItem.descripcion, cantidad: 0, precio }],
        busqueda: '',
      };
    });
  };
  const quitarSkuDePropPersonalizada = (sku) => {
    setPropPersonalizada((prev) => prev ? { ...prev, skus: prev.skus.filter((s) => s.sku !== sku) } : prev);
  };
  const actualizarSkuPropPersonalizada = (sku, campo, valor) => {
    setPropPersonalizada((prev) => prev ? {
      ...prev,
      skus: prev.skus.map((s) => s.sku === sku ? { ...s, [campo]: valor } : s),
    } : prev);
  };

  // Exporta a Excel + guarda en propuestas_compra con prefijo en nota
  const exportarPropPersonalizada = async () => {
    if (!propPersonalizada || propPersonalizada.skus.length === 0) return;
    const skusValidos = propPersonalizada.skus.filter((s) => Number(s.cantidad) > 0);
    if (skusValidos.length === 0) { alert('Asigna cantidades > 0 a al menos un SKU.'); return; }

    const XLSX = await loadSheetJS();
    if (!XLSX) { alert('Error cargando librería Excel'); return; }

    const piezasTotal = skusValidos.reduce((a, s) => a + Number(s.cantidad), 0);
    const montoTotal = skusValidos.reduce((a, s) => a + (Number(s.cantidad) * Number(s.precio)), 0);

    const rows = skusValidos.map((s) => ({
      SKU: s.sku,
      'Descripción': s.descripcion || '',
      'Piezas': Number(s.cantidad),
      'Precio': Math.round(Number(s.precio)),
      'Total': Math.round(Number(s.cantidad) * Number(s.precio)),
    }));
    rows.push({ SKU: 'TOTAL', 'Descripción': '', 'Piezas': piezasTotal, 'Precio': '', 'Total': Math.round(montoTotal) });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    // Formato números
    const headers = Object.keys(rows[0]);
    const moneyCols = new Set(['Precio', 'Total']);
    const intCols = new Set(['Piezas']);
    for (let r = 0; r < rows.length; r++) {
      headers.forEach((h, cIdx) => {
        const addr = XLSX.utils.encode_cell({ c: cIdx, r: r + 1 });
        const cell = ws[addr];
        if (!cell) return;
        if (moneyCols.has(h) && typeof cell.v === 'number') { cell.t = 'n'; cell.z = '"$"#,##0'; }
        else if (intCols.has(h) && typeof cell.v === 'number') { cell.t = 'n'; cell.z = '#,##0'; }
      });
    }
    ws['!cols'] = [{ wch: 14 }, { wch: 55 }, { wch: 12 }, { wch: 14 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws, 'Propuesta');

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreLimpio = (propPersonalizada.nombre || 'personalizada').replace(/[^a-z0-9-_]/gi, '_').toLowerCase();
    const filename = `propuesta-${clienteKey}-${nombreLimpio}-${fecha}.xlsx`;
    XLSX.writeFile(wb, filename);

    // Guardar en histórico
    if (DB_CONFIGURED) {
      const nota = '[Personalizada] ' + (propPersonalizada.nombre || 'sin nombre') +
        (propPersonalizada.notas ? ' · ' + propPersonalizada.notas : '');
      await supabase.from('propuestas_compra').insert({
        cliente: clienteKey,
        fecha: new Date().toISOString(),
        filas: skusValidos,
        skus_count: skusValidos.length,
        piezas_total: piezasTotal,
        monto_total: Math.round(montoTotal),
        nota,
        estatus: 'pendiente',
      });
      cargarPropuestasCompra();
    }
    setMessage(`✓ Propuesta personalizada generada: ${skusValidos.length} SKUs · ${formatMXN(montoTotal)}`);
    setTimeout(() => setMessage(''), 5000);
    cerrarPropPersonalizada();
  };

  // Recalcula el sugerido aplicando una meta diferente. Replica los gates de
  // la fórmula original (MIN_COMPRA, cobertura > 4m, umbral) pero usando la
  // META que pasamos. Devuelve el nuevo sugerido (entero).
  const calcularSugeridoConMeta = React.useCallback((s, metaMeses) => {
    const MIN_COMPRA = 20, UMBRAL_STOCK = 0.5;
    const stock = Number(s.stock) || 0;
    const invActeck = Number(s.invActeck) || 0;
    const invTransito = Number(s.invTransito) || 0;
    const transPcel = Number(s.transPcel) || 0;
    const backOrder = Number(s.backOrder) || 0;
    const promedio90d = Number(s.promedio90d) || 0;
    const promCompra = Number(s.promCompra) || 0;
    const disponibleActeck = invActeck + invTransito;

    const selloutMensual = clienteKey === 'pcel'
      ? (promedio90d > 0 ? promedio90d : promCompra || 0)
      : promedio90d;

    if (disponibleActeck < MIN_COMPRA) return 0;
    if (selloutMensual <= 0) {
      // Sin sellout: para PCEL surte back order si hay; Digitalife solo si stock=0 y roadmap nuevo
      if (clienteKey === 'pcel' && backOrder > 0) {
        return Math.min(backOrder, disponibleActeck);
      }
      return 0;
    }
    // Cap: si ya tiene >4m de cobertura, no sugerir
    const stockCliente = clienteKey === 'pcel' ? (stock + transPcel) : stock;
    const coberturaActual = stockCliente / selloutMensual;
    if (coberturaActual > 4) return 0;

    const base = metaMeses * selloutMensual;
    const ideal = clienteKey === 'pcel'
      ? Math.max(0, Math.round(base - stock - transPcel)) + backOrder
      : Math.max(0, Math.round(base - stock));
    let sug = Math.min(ideal, disponibleActeck);
    if (disponibleActeck < selloutMensual * UMBRAL_STOCK) sug = 0;
    if (sug > 0 && sug < MIN_COMPRA) sug = MIN_COMPRA;
    return sug;
  }, [clienteKey]);

  // Persiste un override de sugerido en BD (sin tocar el state local; eso lo
  // hace el llamador para batchear).
  const saveSugeridoOverrideSilent = React.useCallback(async (sku, valor) => {
    if (!canEdit || !DB_CONFIGURED) return;
    await supabase
      .from('sugerido_overrides')
      .upsert(
        { cliente: clienteKey, sku, sugerido: Number(valor) || 0, updated_at: new Date().toISOString() },
        { onConflict: 'cliente,sku' }
      );
  }, [canEdit, clienteKey]);

  // Aplica un cambio en bulk a un set de cambios { sku → nuevoSugerido }
  // Guarda snapshot para Undo y persiste en BD.
  const aplicarBulkSugerido = React.useCallback(async (cambios, etiqueta) => {
    if (!canEdit) return;
    // Snapshot ANTES de aplicar (para Undo)
    setUndoSnapshot({ edits: { ...sugeridoEdits }, etiqueta });
    // Merge en state local (instantáneo)
    setSugeridoEdits((prev) => ({ ...prev, ...cambios }));
    // Persistir en BD (paralelo, sin bloquear la UI)
    const promesas = Object.entries(cambios).map(([sku, val]) =>
      saveSugeridoOverrideSilent(sku, val)
    );
    Promise.all(promesas).catch((err) => console.error('aplicarBulk error:', err));
    setMessage(`✓ ${etiqueta} aplicado a ${Object.keys(cambios).length} SKUs`);
    setTimeout(() => setMessage(''), 3500);
  }, [canEdit, sugeridoEdits, saveSugeridoOverrideSilent]);

  // Deshacer: restaura el snapshot
  const deshacerBulk = React.useCallback(async () => {
    if (!undoSnapshot || !canEdit) return;
    const prevEdits = undoSnapshot.edits || {};
    setSugeridoEdits(prevEdits);
    // Persistir cambios revertidos
    if (DB_CONFIGURED) {
      const skusActuales = Object.keys(sugeridoEdits);
      const skusPrev = Object.keys(prevEdits);
      const todosLosSkus = new Set([...skusActuales, ...skusPrev]);
      const promesas = [...todosLosSkus].map((sku) => {
        const valorPrev = prevEdits[sku];
        if (valorPrev === undefined) {
          // Borrar override (volver a auto)
          return supabase.from('sugerido_overrides').delete()
            .match({ cliente: clienteKey, sku });
        }
        return saveSugeridoOverrideSilent(sku, valorPrev);
      });
      Promise.all(promesas).catch((err) => console.error('deshacer error:', err));
    }
    setMessage(`↶ Deshecho: ${undoSnapshot.etiqueta}`);
    setTimeout(() => setMessage(''), 3500);
    setUndoSnapshot(null);
  }, [undoSnapshot, canEdit, sugeridoEdits, clienteKey, saveSugeridoOverrideSilent]);

  // Toggle excluir SKU del envío
  const toggleExcluirSku = React.useCallback((sku) => {
    setExcluidosSku((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku); else next.add(sku);
      return next;
    });
  }, []);

  // Historial de propuestas de compra exportadas
  const [propuestasHist, setPropuestasHist] = React.useState([]);
  const [histAbierto, setHistAbierto] = React.useState(false);
  const cargarPropuestasCompra = React.useCallback(async () => {
    if (!DB_CONFIGURED || !clienteKey) return;
    const { data } = await supabase
      .from("propuestas_compra")
      .select("id, fecha, skus_count, piezas_total, monto_total, filas, nota, estatus, cerrada_at")
      .eq("cliente", clienteKey)
      .order("fecha", { ascending: false })
      .limit(50);
    setPropuestasHist(data || []);
  }, [clienteKey]);
  React.useEffect(() => { cargarPropuestasCompra(); }, [cargarPropuestasCompra]);

  // SKUs que ya están en propuestas pendientes (aún no cruzadas con OC)
  // → se excluyen de "SKUs en riesgo de desabasto"
  const skusEnPropuestasPendientes = React.useMemo(() => {
    const set = new Set();
    (propuestasHist || []).forEach(p => {
      if (p.estatus !== "pendiente") return;
      const filas = Array.isArray(p.filas) ? p.filas : [];
      filas.forEach(f => {
        // PCEL guarda "SKU Cliente" (numérico). Digitalife/ML guardan "SKU".
        // Acepto cualquiera de los dos para que el ciclo funcione en ambos.
        const sku = String(f["SKU Cliente"] || f["SKU"] || "").trim();
        if (sku && sku !== "TOTAL") set.add(sku);
      });
    });
    return set;
  }, [propuestasHist]);

  // Cerrar propuesta (pasa de pendiente → cerrada, sus SKUs vuelven a aparecer en riesgo)
  const cerrarPropuesta = async (id) => {
    if (!canEdit) return;
    if (!confirm("¿Marcar esta propuesta como cerrada? Los SKUs volverán a aparecer en riesgo de desabasto si aplica.")) return;
    const { error } = await supabase.from("propuestas_compra")
      .update({ estatus: "cerrada", cerrada_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    await cargarPropuestasCompra();
  };
  const reactivarPropuesta = async (id) => {
    if (!canEdit) return;
    const { error } = await supabase.from("propuestas_compra")
      .update({ estatus: "pendiente", cerrada_at: null })
      .eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    await cargarPropuestasCompra();
  };

  // Re-descargar un Excel histórico
  const descargarPropuestaHistorica = async (prop) => {
    const XLSX = await loadSheetJS();
    if (!XLSX) { alert("Error cargando librería Excel"); return; }
    const filas = Array.isArray(prop.filas) ? prop.filas : [];
    if (filas.length === 0) { alert("Esta propuesta no tiene filas guardadas."); return; }
    const ws = XLSX.utils.json_to_sheet(filas);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Propuesta");
    const fechaStr = String(prop.fecha).slice(0, 10);
    XLSX.writeFile(wb, `propuesta-${clienteKey}-${fechaStr}-#${prop.id}.xlsx`);
  };

  const borrarPropuestaHistorica = async (id) => {
    if (!canEdit) return;
    if (!confirm("¿Eliminar esta propuesta del historial?")) return;
    const { error } = await supabase.from("propuestas_compra").delete().eq("id", id);
    if (error) { alert("Error al borrar: " + error.message); return; }
    await cargarPropuestasCompra();
  };

  // Formato de fecha en español medio: "5 de mayo de 2026"
  const formatFechaES = (s) => {
    if (!s) return "";
    try {
      const str = String(s).slice(0, 10);
      const [y, m, d] = str.split("-").map(n => parseInt(n, 10));
      if (!y || !m || !d) return s;
      const meses = ["enero","febrero","marzo","abril","mayo","junio","julio","agosto","septiembre","octubre","noviembre","diciembre"];
      return `${d} de ${meses[m-1]} de ${y}`;
    } catch { return s; }
  };

  const formatMXN = (n) => {
    if (n == null || isNaN(n)) return "—";
    return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Keys en Title Case porque aggs normaliza las marcas (ACTECK/Acteck → "Acteck",
  // BALAM RUSH/Balam Rush → "Balam Rush"). "Balam Rush Spectrum" se consolida
  // en "Balam Rush" en la comparativa por marca (Spectrum es modelo, no marca).
  const MARCA_COLORES = {
    "Acteck": "#3B82F6",
    "Balam Rush": "#8B5CF6",
  };

  // Normaliza un modelo Acteck para matchear entre Digitalife (sku="AC-XXXXXX")
  // y PCEL (modelo="XXXXXX"). Quita prefijo "AC-" y uniforma mayúsculas.
  const normModelo = (s) => {
    if (!s) return "";
    return String(s).trim().toUpperCase().replace(/^AC-?/, "");
  };

  // Quita acentos y normaliza espacios para comparar subfamilias de PCEL
  // (la BD a veces viene con/ sin acentos, con doble espacio, etc.)
  const normSubfam = (s) => {
    if (!s) return "";
    return String(s).trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/\s+/g, " ");
  };

  // Mapeo PCEL subfamilia → 13 categorías canónicas de Digitalife
  // (Audio, Cables, Celulares, Cooling, Energía, Fuentes, Gabinetes,
  //  Monitores, Mouse, Sillas, Soportes, Teclados, Accesorios)
  const SUBFAM_TO_CAT = {
    // Audio
    "audfonos y micrfonos": "Audio",
    "audifonos y microfonos": "Audio",
    "bocinas": "Audio",
    "home theaters": "Audio",
    "home theater": "Audio",
    "cables de audio": "Audio",
    // Cables
    "cables usb": "Cables",
    "cables de video": "Cables",
    "cables de red": "Cables",
    "cables de energa": "Cables",
    "cables de energia": "Cables",
    // Celulares / Tablets
    "accesorios para celular": "Celulares",
    "accesorios para ipad y tablets": "Celulares",
    "tablets": "Celulares",
    // Cooling
    "disipadores y ventiladores": "Cooling",
    "pastas trmicas": "Cooling",
    "pastas termicas": "Cooling",
    // Energía
    "pilas bateras y cargadores": "Energía",
    "pilas baterias y cargadores": "Energía",
    "reguladores multicontactos": "Energía",
    "reguladores  multicontactos": "Energía",
    // Fuentes
    "fuentes de poder": "Fuentes",
    // Gabinetes
    "gabinetes": "Gabinetes",
    "gabinetes y accesorios para discos duros": "Gabinetes",
    // Monitores
    "monitores": "Monitores",
    // Mouse
    "mouse ratones": "Mouse",
    "mouse  ratones": "Mouse",
    "mouse pads": "Mouse",
    // Sillas
    "sillas gamer": "Sillas",
    "sillas para oficina": "Sillas",
    // Soportes
    "bases para laptops": "Soportes",
    "soportes para tv": "Soportes",
    // Teclados
    "teclados": "Teclados",
    // Accesorios (catch-all)
    "escritorios": "Accesorios",
    "articulos de oficina y mobiliario": "Accesorios",
    "artculos de oficina y mobiliario": "Accesorios",
    "cmaras web": "Accesorios",
    "camaras web": "Accesorios",
    "cmaras de vigilancia": "Accesorios",
    "camaras de vigilancia": "Accesorios",
    "controles": "Accesorios",
    "controles remotos": "Accesorios",
    "adaptadores bluetooth": "Accesorios",
    "tarjetas y adaptadores inalmbricos": "Accesorios",
    "tarjetas y adaptadores inalambricos": "Accesorios",
    "limpieza": "Accesorios",
    "herramientas": "Accesorios",
    "lectores de memoria flash": "Accesorios",
    "setup gamer": "Accesorios",
    "desktops": "Accesorios",
    "remate de mercanca": "Accesorios",
    "remate de mercancia": "Accesorios",
    "caja abierta": "Accesorios",
    "hogar inteligente": "Accesorios",
    "accesorios": "Accesorios",
  };

  const ESTADO_COLORES = {
    "D": "#10B981",
    "NVS": "#F59E0B",
    "RMI": "#3B82F6",
    "RML": "#8B5CF6",
  };

  const MESES_ABREV = { 1:"Ene", 2:"Feb", 3:"Mar", 4:"Abr", 5:"May", 6:"Jun", 7:"Jul", 8:"Ago", 9:"Sep", 10:"Oct", 11:"Nov", 12:"Dic" };

  // Parse Excel Reporte Acteck
  const parseActeck = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = window.XLSX.read(e.target.result, { cellDates: true });
          const sheetTD = wb.Sheets["TD Ventas"];
          const sheetMaster = wb.Sheets["Master"];

          if (!sheetTD || !sheetMaster) return reject("Hojas no encontradas");

          // Parse TD Ventas (pivot already filtered by client)
          const rangeTD = sheetTD['!ref'];
          const productos = [];

          if (rangeTD) {
            const decoded = window.XLSX.utils.decode_range(rangeTD);
            for (let r = 6; r <= decoded.e.r; r++) {
              const skuCell = sheetTD[window.XLSX.utils.encode_cell({r, c: 0})];
              const sku = skuCell ? skuCell.v : null;
              if (!sku || sku === "Total") break;

              const prod = { sku: String(sku).trim(), meses: {} };

              // Extract 2026 months from columns (cols 22+ for 2026, 3 columns per month: cost, amount, piezas)
              let colOffset = 22;
              for (let mes = 1; mes <= 12; mes++) {
                const piezasIdx = colOffset + (mes - 1) * 3 + 2;
                const montoIdx = colOffset + (mes - 1) * 3 + 1;
                const piezasCell = sheetTD[window.XLSX.utils.encode_cell({r, c: piezasIdx})];
                const montoCell = sheetTD[window.XLSX.utils.encode_cell({r, c: montoIdx})];
                const piezas = piezasCell ? Number(piezasCell.v) || 0 : 0;
                const monto = montoCell ? Number(montoCell.v) || 0 : 0;
                if (piezas > 0 || monto > 0) {
                  prod.meses[mes] = { piezas, monto };
                }
              }
              if (Object.keys(prod.meses).length > 0) productos.push(prod);
            }
          }

          // Parse Master
          const rangeMaster = sheetMaster['!ref'];
          const masterMap = {};
          if (rangeMaster) {
            const decoded = window.XLSX.utils.decode_range(rangeMaster);
            for (let r = 4; r <= Math.min(decoded.e.r, 500); r++) {
              const skuCell = sheetMaster[window.XLSX.utils.encode_cell({r, c: 1})];
              const sku = skuCell ? String(skuCell.v).trim() : null;
              if (!sku) continue;
              const roadmapCell = sheetMaster[window.XLSX.utils.encode_cell({r, c: 2})];
              const descCell = sheetMaster[window.XLSX.utils.encode_cell({r, c: 3})];
              masterMap[sku] = {
                roadmap: roadmapCell ? String(roadmapCell.v) : "",
                descripcion: descCell ? String(descCell.v) : "",
              };
            }
          }

          productos.forEach(p => {
            const m = masterMap[p.sku];
            if (m) { p.roadmap = m.roadmap; p.descripcion = m.descripcion; }
          });

          resolve(productos);
        } catch (err) {
          reject(err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Parse Excel Resumen Digitalife
  const parseDigitalife = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const wb = window.XLSX.read(e.target.result, { cellDates: true });
          const sheetSellout = wb.Sheets["BD Sellout"];
          const sheetInventario = wb.Sheets["BD Inventario"];
          const sheetRDMP = wb.Sheets["RDMP"];

          if (!sheetSellout || !sheetInventario || !sheetRDMP) return reject("Hojas no encontradas");

          // Parse BD Sellout
          const rangeSO = sheetSellout['!ref'];
          const selloutMap = {};
          if (rangeSO) {
            const decoded = window.XLSX.utils.decode_range(rangeSO);
            for (let r = 1; r <= decoded.e.r; r++) {
              const fechaCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 0})];
              const skuCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 2})];
              const cantCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 4})];
              const totalCell = sheetSellout[window.XLSX.utils.encode_cell({r, c: 9})];

              if (!fechaCell || !skuCell) continue;
              const sku = String(skuCell.v).trim();
              const fecha = fechaCell.v instanceof Date ? fechaCell.v : new Date(fechaCell.v);
              const cantidad = cantCell ? Number(cantCell.v) || 0 : 0;
              const total = totalCell ? Number(totalCell.v) || 0 : 0;

              if (sku && fecha && cantidad > 0) {
                const mes = fecha.getMonth() + 1;
                const anio = fecha.getFullYear();
                const key = `${sku}|${anio}|${mes}`;
                if (!selloutMap[key]) selloutMap[key] = { piezas: 0, monto: 0 };
                selloutMap[key].piezas += cantidad;
                selloutMap[key].monto += total;
              }
            }
          }

          // Parse BD Inventario
          const rangeInv = sheetInventario['!ref'];
          const invMap = {};
          if (rangeInv) {
            const decoded = window.XLSX.utils.decode_range(rangeInv);
            for (let r = 1; r <= decoded.e.r; r++) {
              const skuCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 0})];
              if (!skuCell) continue;
              const sku = String(skuCell.v).trim();
              const marcaCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 1})];
              const titleCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 2})];
              const stockCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 3})];
              const costCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 5})];
              const priceCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 6})];
              const valorCell = sheetInventario[window.XLSX.utils.encode_cell({r, c: 10})];

              invMap[sku] = {
                marca: marcaCell ? String(marcaCell.v) : "",
                titulo: titleCell ? String(titleCell.v) : "",
                stock: stockCell ? Number(stockCell.v) || 0 : 0,
                costo: costCell ? Number(costCell.v) || 0 : 0,
                precio: priceCell ? Number(priceCell.v) || 0 : 0,
                valor: valorCell ? Number(valorCell.v) || 0 : 0,
              };
            }
          }

          // Parse RDMP
          const rangeRDMP = sheetRDMP['!ref'];
          const productosRDMP = [];
          if (rangeRDMP) {
            const decoded = window.XLSX.utils.decode_range(rangeRDMP);
            for (let r = 6; r <= decoded.e.r; r++) {
              const skuCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 1})];
              if (!skuCell) continue;
              const sku = String(skuCell.v).trim();

              const catCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 2})];
              const roadCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 3})];
              const descCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 4})];
              const estCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 5})];
              const costCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 6})];
              const priceCell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: 7})];

              const prod = {
                sku,
                categoria: catCell ? String(catCell.v) : "",
                roadmap: roadCell ? String(roadCell.v) : "",
                descripcion: descCell ? String(descCell.v) : "",
                estado: estCell ? String(estCell.v) : "D",
                costo_promedio: costCell ? Number(costCell.v) || 0 : 0,
                precio_venta: priceCell ? Number(priceCell.v) || 0 : 0,
                meses: {},
              };

              prod.marca = sku.startsWith("AC-") ? "ACTECK" : sku.startsWith("BR-") ? "Balam Rush" : "Otro";

              // Extract monthly 2026 data
              let colOffset = 22;
              for (let mes = 1; mes <= 12; mes++) {
                const cellIdx = colOffset + (mes - 1);
                const cell = sheetRDMP[window.XLSX.utils.encode_cell({r, c: cellIdx})];
                const piezas = cell ? Number(cell.v) || 0 : 0;
                if (piezas > 0) prod.meses[mes] = piezas;
              }

              productosRDMP.push(prod);
            }
          }

          resolve({ productosRDMP, selloutMap, invMap });
        } catch (err) {
          reject(err.message);
        }
      };
      reader.readAsArrayBuffer(file);
    });
  };

  // Upsert to Supabase
  const upsertData = async (tabla, rows, uniqueFields) => {
    if (!DB_CONFIGURED || !supabase) return 0;
    let count = 0;
    const chunks = [];
    for (let i = 0; i < rows.length; i += 50) chunks.push(rows.slice(i, i + 50));

    for (const chunk of chunks) {
      const { error } = await supabase.from(tabla).upsert(chunk, { onConflict: uniqueFields });
      if (!error) count += chunk.length;
    }
    return count;
  };

  // Handle file uploads
  const handleUpload = async (e) => {
    if (!canEdit) return;
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    setLoading(true);
    setMessage("");
    try {
      let counts = { productos: 0, sellIn: 0, sellOut: 0, inventario: 0 };

      for (const file of files) {
        if (file.name.includes("Acteck")) {
          const productos = await parseActeck(file);
          const rows = productos.map(p => ({
            cliente: clienteKey,
            sku: p.sku,
            categoria: "TBD",
            roadmap: p.roadmap || "",
            descripcion: p.descripcion || "",
            estado: "D",
            costo_promedio: 0,
            precio_venta: 0,
            marca: p.sku.startsWith("AC-") ? "ACTECK" : "Balam Rush",
          }));
          counts.productos += await upsertData("productos_cliente", rows, "cliente,sku");

          for (const prod of productos) {
            for (const [mes, data] of Object.entries(prod.meses)) {
              const sellInRow = {
                cliente: clienteKey,
                sku: prod.sku,
                anio: 2026,
                mes: parseInt(mes),
                piezas: data.piezas,
                monto_pesos: data.monto,
              };
              await supabase.from("sell_in_sku").upsert([sellInRow], { onConflict: "cliente,sku,anio,mes" });
              counts.sellIn++;
            }
          }
        } else if (file.name.includes("Digitalife")) {
          const { productosRDMP, selloutMap, invMap } = await parseDigitalife(file);

          const prodRows = productosRDMP.map(p => ({
            cliente: clienteKey,
            sku: p.sku,
            categoria: p.categoria,
            roadmap: p.roadmap,
            descripcion: p.descripcion,
            estado: p.estado,
            costo_promedio: p.costo_promedio,
            precio_venta: p.precio_venta,
            marca: p.marca,
          }));
          counts.productos += await upsertData("productos_cliente", prodRows, "cliente,sku");

          for (const [key, data] of Object.entries(selloutMap)) {
            const [sku, anio, mes] = key.split("|");
            const row = {
              cliente: clienteKey,
              sku,
              anio: parseInt(anio),
              mes: parseInt(mes),
              piezas: data.piezas,
              monto_pesos: data.monto,
            };
            await supabase.from("sellout_sku").upsert([row], { onConflict: "cliente,sku,anio,mes" });
            counts.sellOut++;
          }

          for (const [sku, inv] of Object.entries(invMap)) {
            const row = {
              cliente: clienteKey,
              sku,
              marca: inv.marca,
              titulo: inv.titulo,
              stock: inv.stock,
              costo_convenio: inv.costo,
              precio_venta: inv.precio,
              valor: inv.valor,
              dias_sin_venta: 0,
              fecha_ultima_venta: null,
            };
            await supabase.from("inventario_cliente").upsert([row], { onConflict: "cliente,sku" });
            counts.inventario++;
          }
        }
      }

      setMessage(`Cargado: ${counts.productos} productos, ${counts.sellIn} registros sell-in, ${counts.sellOut} sell-out, ${counts.inventario} inventario`);
      if (onUploadComplete) onUploadComplete();
      loadData();
    } catch (err) {
      setMessage(`Error: ${err}`);
    }
    setLoading(false);
  };

  // Load data from Supabase
  // Acteck warehouses to sum for "Inv Acteck" column
  const ACTECK_ALMACENES = [1, 2, 3, 4, 14, 16, 17, 25, 44];

  const loadData = async () => {
    if (!DB_CONFIGURED || !supabase) return;
    setLoading(true);
    try {
      // Para PCEL: usar adapter para sellout + inventario (leen de sellout_pcel)
      const { fetchSelloutSku, fetchInventarioCliente, fetchHistoricoComprasPcel, fetchSnapshotPcel } = await import('../../lib/pcelAdapter');
      const esPcel = clienteKey === 'pcel';

      // Tracking N (Sugerí vs Compraron) requiere data con fecha precisa:
      //  · Digitalife → sellout_detalle (diario, fecha exacta)
      //  · PCEL → sellout_pcel (semanal, anio+semana → ventana de 14d ≈ 2 semanas)
      // Cargamos últimos 120 días para cubrir propuestas recientes.
      const hace120dias = new Date(Date.now() - 120 * 86400000).toISOString().slice(0, 10);

      const [productos, sellIn, sellOut, inventario, invActeck, transito, roadmap, precios,
             histPcel, snapshotPcel, dglCategoriasRaw, cuotasMensualesRaw,
             selloutDiario, selloutPcelSemanal] = await Promise.all([
        fetchAllPagesREST(`productos_cliente?select=*&cliente=eq.${clienteKey}`),
        fetchAllPagesREST(`sell_in_sku?select=*&cliente=eq.${clienteKey}&anio=eq.2026`),
        fetchSelloutSku(clienteKey, 2026),
        fetchInventarioCliente(clienteKey),
        fetchAllPagesREST(`inventario_acteck?select=articulo,no_almacen,disponible&no_almacen=in.(${ACTECK_ALMACENES.join(',')})`),
        fetchAllPagesREST(`transito_sku?select=sku,inventario_transito,siguiente_arribo,payload,sort_order`),
        fetchAllPagesREST(`roadmap_sku?select=sku,rdmp,descripcion,payload,sort_order&order=sort_order.asc`),
        fetchAllPagesREST(`precios_sku?select=sku,precio_aaa,descuento,precio_descuento`),
        // Extras sólo para PCEL:
        esPcel ? fetchHistoricoComprasPcel(6) : Promise.resolve({}),
        esPcel ? fetchSnapshotPcel() : Promise.resolve([]),
        // Master de categorías = productos_cliente de Digitalife (sku = modelo Acteck).
        // Sólo se pide cuando estamos en PCEL, para el mapeo modelo→categoría.
        esPcel ? fetchAllPagesREST(`productos_cliente?select=sku,categoria&cliente=eq.digitalife`) : Promise.resolve([]),
        // Cuotas mensuales para la tarjeta KPI #3 (cumplimiento de cuota).
        fetchAllPagesREST(`cuotas_mensuales?select=mes,cuota_min,cuota_ideal&cliente=eq.${clienteKey}&anio=eq.2026`),
        // Tracking N — Digitalife: sellout_detalle (fecha exacta, últimos 120d)
        !esPcel
          ? fetchAllPagesREST(`sellout_detalle?cliente=eq.digitalife&fecha=gte.${hace120dias}&select=fecha,no_parte,cantidad`)
          : Promise.resolve([]),
        // Tracking N — PCEL: sellout_pcel (anio,semana,sku,vta_semana)
        esPcel
          ? fetchAllPagesREST(`sellout_pcel?select=anio,semana,sku,vta_semana&order=anio.desc,semana.desc&limit=20000`)
          : Promise.resolve([]),
      ]);

      // Para PCEL fallback: si la tabla cuotas_mensuales está vacía pero
      // PCEL_REAL.cuota50M está disponible, sintetizamos los registros.
      let cuotasMensuales = cuotasMensualesRaw || [];
      if (esPcel && cuotasMensuales.length === 0 && PCEL_REAL && PCEL_REAL.cuota50M) {
        cuotasMensuales = Object.entries(PCEL_REAL.cuota50M).map(([mes, monto]) => ({
          mes: Number(mes), cuota_min: Number(monto) || 0, cuota_ideal: Number(monto) || 0,
        }));
      }

      // Map Digitalife (modelo normalizado) → categoría canónica, para asignar
      // categorías a los 906 SKUs de PCEL vía modelo. Fallback: subfamilia.
      const dglModeloCat = {};
      (dglCategoriasRaw || []).forEach(r => {
        const k = normModelo(r.sku);
        const cat = (r.categoria || "").trim();
        if (k && cat) dglModeloCat[k] = cat;
      });

      // Pre-aggregate Acteck inventory by SKU (sum across all 9 warehouses)
      const actStockBySku = {};
      invActeck.forEach(r => {
        if (!r.articulo) return;
        actStockBySku[r.articulo] = (actStockBySku[r.articulo] || 0) + (Number(r.disponible) || 0);
      });

      // Transit by SKU
      const transitoBySku = {};
      transito.forEach(r => {
        if (!r.sku) return;
        transitoBySku[r.sku] = (transitoBySku[r.sku] || 0) + (Number(r.inventario_transito) || 0);
      });

      // Filter inventario_cliente to most recent snapshot week (avoid stale history)
      let maxA = 0, maxS = 0;
      inventario.forEach(inv => {
        const a = Number(inv.anio) || 0, s = Number(inv.semana) || 0;
        if (a > maxA || (a === maxA && s > maxS)) { maxA = a; maxS = s; }
      });
      const inventarioLatest = maxA > 0 ? inventario.filter(inv =>
        Number(inv.anio) === maxA && Number(inv.semana) === maxS
      ) : inventario;

      // Precios AAA por SKU (modelo Acteck)
      const preciosBySku = {};
      (precios || []).forEach(r => {
        if (!r.sku) return;
        preciosBySku[r.sku] = {
          precio_aaa: Number(r.precio_aaa) || 0,
          descuento:  Number(r.descuento) || 0,
          precio_descuento: Number(r.precio_descuento) || 0,
        };
      });

      // Extras PCEL: diccionarios por SKU
      const backOrderBySkuPcel = {};
      const transitoPcelBySku  = {};
      const costoPromBySkuPcel = {};
      (snapshotPcel || []).forEach(r => {
        if (!r.sku) return;
        backOrderBySkuPcel[r.sku] = Number(r.back_order) || 0;
        transitoPcelBySku[r.sku]  = Number(r.transito) || 0;
        costoPromBySkuPcel[r.sku] = Number(r.costo_promedio) || 0;
      });

      // Para PCEL: usar catalogo_sku_pcel como fuente base (906 SKUs reales)
      // en lugar de productos_cliente (solo 25 filas).
      let productosEfectivos = productos;
      if (esPcel) {
        const catPcel = await fetchAllPagesREST(`catalogo_sku_pcel?select=*`);
        // Mapear al schema esperado por el componente (productos_cliente)
        const prodExistentes = new Map((productos || []).map(p => [p.sku, p]));
        productosEfectivos = (catPcel || []).map(c => {
          const existente = prodExistentes.get(c.sku) || {};
          // Categoría (opción C): (1) productos_cliente.pcel si ya existe,
          // (2) match por modelo contra Digitalife, (3) fallback subfamilia → canonical.
          const modKey = normModelo(c.modelo);
          const catFromDgl = modKey ? dglModeloCat[modKey] : null;
          const catFromSubfam = SUBFAM_TO_CAT[normSubfam(c.subfamilia)] || null;
          const categoria =
            (existente.categoria && existente.categoria.trim()) ||
            catFromDgl ||
            catFromSubfam ||
            "Accesorios"; // catch-all para subfamilias no mapeadas
          return {
            // datos base
            sku: c.sku,
            cliente: 'pcel',
            marca: c.marca || existente.marca || '',
            modelo: c.modelo || existente.modelo || '',
            descripcion: c.producto || existente.descripcion || '',
            familia: c.familia || existente.familia || '',
            subfamilia: c.subfamilia || existente.subfamilia || '',
            // categoría ya resuelta (Digitalife-style)
            categoria,
            precio_venta: existente.precio_venta || null,
            estado: existente.estado || 'ALTA',
            roadmap: existente.roadmap || null,
            // metadata catálogo
            primera_aparicion: c.primera_aparicion,
            ultima_aparicion:  c.ultima_aparicion,
            apariciones:       c.apariciones,
          };
        });
      }

      setDatos({
        productos: productosEfectivos, sellIn, sellOut,
        inventario: inventarioLatest,
        inventarioAll: inventario,   // preserved for future historical views
        latestWeek: { anio: maxA, semana: maxS },
        actStockBySku, transitoBySku,
        transito,
        roadmap,
        preciosBySku,
        cuotasMensuales,             // para tarjeta KPI #3 (cumplimiento cuota)
        selloutDiario,               // sellout_detalle Digitalife (fecha exacta) — tracking N
        selloutPcelSemanal,          // sellout_pcel (anio,semana,vta_semana) — tracking N
        // Extras específicos PCEL:
        histPcel,               // { [sku]: { piezas, facturas, promedio, primerFecha, ultimaFecha } }
        backOrderBySkuPcel,     // { [sku]: backOrder }
        transitoPcelBySku,      // { [sku]: transito del cliente }
      });
    } catch (err) {
      console.error("Error loading data:", err);
    }
    setLoading(false);
  };

  React.useEffect(() => {
    loadData();
  }, [cliente, clienteKey]);

  // Compute aggregations
  const aggs = React.useMemo(() => {
    if (!datos) return null;

    // PostgREST devuelve `numeric` como string; hay que convertir con Number()
    // antes de sumar para evitar concatenación accidental de strings.
    const sellInTotal = datos.sellIn.reduce((s, r) => s + (Number(r.monto_pesos) || 0), 0);
    const sellInPiezas = datos.sellIn.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
    const sellOutTotal = datos.sellOut.reduce((s, r) => s + (Number(r.monto_pesos) || 0), 0);
    const sellOutPiezas = datos.sellOut.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
    // `valor` en inventario_cliente suele estar NULL. Fallback: stock × costo_convenio.
    const invTotal = datos.inventario.reduce((s, r) => {
      const v = Number(r.valor);
      if (v > 0) return s + v;
      return s + (Number(r.stock) || 0) * (Number(r.costo_convenio) || Number(r.costo_promedio) || 0);
    }, 0);
    const invPiezas = datos.inventario.reduce((s, r) => s + (Number(r.stock) || 0), 0);

    // Find max months
    const siByMes = {};
    const soByMes = {};
    datos.sellIn.forEach(r => { siByMes[r.mes] = (siByMes[r.mes] || 0) + (r.monto_pesos || 0); });
    datos.sellOut.forEach(r => { soByMes[r.mes] = (soByMes[r.mes] || 0) + (r.monto_pesos || 0); });
    const maxSIMes = Object.entries(siByMes).reduce((a, b) => a[1] > b[1] ? a : b, [0, 0])[0];
    const maxSOMes = Object.entries(soByMes).reduce((a, b) => a[1] > b[1] ? a : b, [0, 0])[0];

    // Normalize text labels so "ACTECK"/"Acteck"/"acteck" collapse to "Acteck",
    // and "AUDIO"/"Audio" collapse to "Audio". Sin esto, la BD tiene duplicados
    // por case y las tablas se ven fragmentadas.
    const normLabel = (s) => {
      if (!s) return "";
      const t = String(s).trim().toLowerCase();
      return t.replace(/\b([a-záéíóúñ])/g, (m) => m.toUpperCase());
    };

    // Colapsa "Balam Rush Spectrum" → "Balam Rush" sólo para la comparativa.
    // Spectrum es un modelo, nunca fue una marca. Se aplica sólo en byMarca.
    const consolidaMarca = (m) => (m === "Balam Rush Spectrum" ? "Balam Rush" : m);

    const esPcel = clienteKey === "pcel";
    // Índices pre-agregados (evita O(N*M) re-filtrando en cada iter).
    // Sell In vive en `sell_in_sku`. Para Digitalife viene con sku "AC-XXXXXX"
    // (articulo de ventas_erp). Para PCEL también es articulo Acteck, pero
    // catalogo_sku_pcel.modelo es "XXXXXX" (sin AC-). Por eso normalizamos
    // ambos lados con normModelo() para que las claves cuadren.
    const siByKey = {}, siMontoByKey = {}, soByKey = {}, soMontoByKey = {};
    datos.sellIn.forEach(r => {
      const k = esPcel ? normModelo(r.sku) : r.sku;
      if (!k) return;
      siByKey[k]      = (siByKey[k] || 0)      + (Number(r.piezas) || 0);
      siMontoByKey[k] = (siMontoByKey[k] || 0) + (Number(r.monto_pesos) || 0);
    });
    datos.sellOut.forEach(r => {
      const k = r.sku; if (!k) return;
      soByKey[k]      = (soByKey[k] || 0)      + (Number(r.piezas) || 0);
      soMontoByKey[k] = (soMontoByKey[k] || 0) + (Number(r.monto_pesos) || 0);
    });
    const invBySku = {};
    datos.inventario.forEach(r => { if (r.sku) invBySku[r.sku] = r; });

    // Para PCEL, sellIn keyea por modelo Acteck normalizado (sin AC-);
    // para los demás, por sku cliente tal cual.
    const sellInKey = (p) => esPcel ? normModelo(p.modelo) : p.sku;
    // sellOut: para PCEL usa el sku numérico PCEL (que es lo que hay en
    // sellout_pcel_mensual). Para los demás, sku del cliente.
    const sellOutKey = (p) => p.sku;

    // By marca (normalizada + Spectrum consolidado)
    const byMarca = {};
    datos.productos.forEach(p => {
      const marca = consolidaMarca(normLabel(p.marca)) || "Sin Marca";
      if (!byMarca[marca]) byMarca[marca] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      const sik = sellInKey(p), sok = sellOutKey(p);
      byMarca[marca].siPiezas += siByKey[sik] || 0;
      byMarca[marca].siMonto  += siMontoByKey[sik] || 0;
      byMarca[marca].soPiezas += soByKey[sok] || 0;
      byMarca[marca].soMonto  += soMontoByKey[sok] || 0;
      const invForSku = invBySku[p.sku];
      if (invForSku) {
        byMarca[marca].invPiezas += Number(invForSku.stock) || 0;
        byMarca[marca].invValor  += Number(invForSku.valor) || 0;
      }
    });

    // By categoria (normalizada — Spectrum NO se consolida aquí, sólo en marca)
    const byCategoria = {};
    datos.productos.forEach(p => {
      const cat = normLabel(p.categoria) || "Sin Categoría";
      if (!byCategoria[cat]) byCategoria[cat] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      const sik = sellInKey(p), sok = sellOutKey(p);
      byCategoria[cat].siPiezas += siByKey[sik] || 0;
      byCategoria[cat].siMonto  += siMontoByKey[sik] || 0;
      byCategoria[cat].soPiezas += soByKey[sok] || 0;
      byCategoria[cat].soMonto  += soMontoByKey[sok] || 0;
      const invForSku = invBySku[p.sku];
      if (invForSku) {
        byCategoria[cat].invPiezas += Number(invForSku.stock) || 0;
        byCategoria[cat].invValor  += (Number(invForSku.stock) || 0) * (Number(invForSku.costo_convenio || invForSku.costo_promedio) || 0);
      }
    });

    return {
      sellInTotal, sellInPiezas, sellOutTotal, sellOutPiezas, invTotal, invPiezas,
      maxSIMes, maxSOMes, byMarca, byCategoria,
    };
  }, [datos, clienteKey]);

  // KPIs extendidos para tarjetas arriba
  const kpis = React.useMemo(() => {
    if (!datos || !aggs) return null;
    const esPcel = clienteKey === "pcel";
    // Eficiencia SI/SO — PCEL lo maneja por piezas (no tiene monto de sellout);
    // los demás por monto.
    const efi = esPcel
      ? (aggs.sellInPiezas > 0 && aggs.sellOutPiezas > 0 ? (aggs.sellOutPiezas / aggs.sellInPiezas * 100) : 0)
      : (aggs.sellInTotal > 0 && aggs.sellOutTotal > 0 ? (aggs.sellOutTotal / aggs.sellInTotal * 100) : 0);
    // SKUs activos (con ventas YTD o inventario > 0)
    const skusConVenta = new Set();
    datos.sellIn.forEach(r => skusConVenta.add(r.sku));
    datos.sellOut.forEach(r => skusConVenta.add(r.sku));
    const skusActivos = skusConVenta.size;
    const skusConInv = datos.inventario.filter(r => (Number(r.stock) || 0) > 0).length;
    // Días de cobertura — PCEL: piezas inv cliente / piezas diarias SO.
    // Resto: monto inventario / monto diario SO.
    const mesesConDatos = Math.max(1, new Set(datos.sellOut.map(r => Number(r.mes) || 0).filter(m => m > 0 && m < new Date().getMonth() + 1)).size);
    const soDiario = esPcel
      ? (mesesConDatos > 0 ? aggs.sellOutPiezas / (mesesConDatos * 30) : 0)
      : (mesesConDatos > 0 ? aggs.sellOutTotal / (mesesConDatos * 30) : 0);
    const invRef = esPcel ? aggs.invPiezas : aggs.invTotal;
    const diasCob = soDiario > 0 ? Math.round(invRef / soDiario) : null;
    // Inv Acteck disponible (piezas totales en los 9 almacenes)
    const invActeckPiezas = Object.values(datos.actStockBySku || {}).reduce((s, v) => s + (Number(v) || 0), 0);
    // Sugerido total $
    const mesActual = new Date().getMonth() + 1;
    let sugPiezas = 0, sugMonto = 0, sugSkus = 0;
    const skusAll = new Set();
    datos.sellOut.forEach(r => skusAll.add(r.sku));
    skusAll.forEach(sku => {
      const soData = datos.sellOut.filter(r => r.sku === sku);
      const soSinMes = soData.filter(r => Number(r.mes) < mesActual);
      const prom = soSinMes.slice(-3).length > 0 ? Math.round(soSinMes.slice(-3).reduce((s, r) => s + (r.piezas || 0), 0) / Math.min(3, soSinMes.slice(-3).length)) : 0;
      if (prom <= 0) return;
      const stock = (datos.inventario.find(r => r.sku === sku) || {}).stock || 0;
      const invAct = datos.actStockBySku[sku] || 0;
      const invTr = datos.transitoBySku[sku] || 0;
      let sug = Math.max(0, prom * 3 - stock);
      if (clienteKey === 'digitalife' && stock < prom && sug < 11) sug = 11;
      sug = Math.min(sug, invAct + invTr);
      if (sug > 0) {
        const prod = datos.productos.find(p => p.sku === sku);
        const precio = Number(prod?.precio_venta) || 0;
        sugPiezas += sug;
        sugMonto += sug * precio;
        sugSkus++;
      }
    });
    // ── Cumplimiento de cuota (para tarjeta KPI #3) ──
    // Sell-In YTD (en monto) y cuota YTD (de cuotas_mensuales o constants para PCEL).
    const anioActual = new Date().getFullYear();
    const mesActualNum = new Date().getMonth() + 1;
    let siYTD = 0;
    datos.sellIn.forEach((r) => {
      if (Number(r.anio) === anioActual && Number(r.mes) <= mesActualNum) {
        siYTD += Number(r.monto_pesos) || 0;
      }
    });
    let cuotaYTD = 0;
    let cuotaMesActual = 0;
    let siMesActual = 0;
    if (datos.cuotasMensuales && datos.cuotasMensuales.length) {
      datos.cuotasMensuales.forEach((c) => {
        const mes = Number(c.mes);
        const monto = Number(c.cuota_min || c.monto || 0);
        if (mes <= mesActualNum) cuotaYTD += monto;
        if (mes === mesActualNum) cuotaMesActual = monto;
      });
    }
    // Sell-In del mes actual
    datos.sellIn.forEach((r) => {
      if (Number(r.anio) === anioActual && Number(r.mes) === mesActualNum) {
        siMesActual += Number(r.monto_pesos) || 0;
      }
    });

    // Cumplimiento mensual (12 meses) — para strip debajo de las tarjetas
    const cuotaPorMes = {};
    if (datos.cuotasMensuales) {
      datos.cuotasMensuales.forEach((c) => {
        cuotaPorMes[Number(c.mes)] = Number(c.cuota_min || c.monto || 0);
      });
    }
    const siPorMes = {};
    datos.sellIn.forEach((r) => {
      if (Number(r.anio) === anioActual) {
        const m = Number(r.mes);
        siPorMes[m] = (siPorMes[m] || 0) + (Number(r.monto_pesos) || 0);
      }
    });
    const cumplimientoMensual = [];
    for (let m = 1; m <= 12; m++) {
      const cuota = cuotaPorMes[m] || 0;
      const si = siPorMes[m] || 0;
      const pct = cuota > 0 ? (si / cuota) * 100 : null;
      cumplimientoMensual.push({
        mes: m, cuota, sellIn: si, pct,
        esActual: m === mesActualNum,
        esFuturo: m > mesActualNum,
      });
    }

    // ── Cuota por Q (trimestre) ──
    // Q1: ene-mar · Q2: abr-jun · Q3: jul-sep · Q4: oct-dic
    const trimestreActual = Math.ceil(mesActualNum / 3);
    const mesesQ = (q) => [(q - 1) * 3 + 1, (q - 1) * 3 + 2, (q - 1) * 3 + 3];
    const cuotasQ = [1, 2, 3, 4].map((q) => {
      const meses = mesesQ(q);
      const cuotaQ = meses.reduce((s, m) => s + (cuotaPorMes[m] || 0), 0);
      const siQ = meses.reduce((s, m) => s + (siPorMes[m] || 0), 0);
      // Solo incluye meses pasados completos (no el corriente futuro)
      const sellInQAcumulado = meses
        .filter((m) => m <= mesActualNum)
        .reduce((s, m) => s + (siPorMes[m] || 0), 0);
      return {
        q,
        meses,
        cuota: cuotaQ,
        sellIn: siQ,
        sellInAcumulado: sellInQAcumulado,
        pct: cuotaQ > 0 ? (sellInQAcumulado / cuotaQ) * 100 : null,
        falta: Math.max(0, cuotaQ - sellInQAcumulado),
        esActual: q === trimestreActual,
        esPasado: q < trimestreActual,
      };
    });
    const qActualData = cuotasQ.find((q) => q.q === trimestreActual);

    return {
      efi, skusActivos, skusConInv, diasCob, invActeckPiezas,
      sugPiezas, sugMonto, sugSkus,
      siYTD, cuotaYTD, cuotaMesActual, siMesActual,
      cumplimientoMensual,
      trimestreActual, cuotasQ, qActualData,
    };
  }, [datos, aggs, clienteKey]);

  // SKUs en riesgo de desabasto — reusa el sugerido del Detalle por SKU
  // para consistencia. Usa los mismos overrides (sugeridoEdits) que el usuario
  // haya editado en la tabla principal.
  const skusRiesgo = React.useMemo(() => {
    if (!datos) return [];
    const mesActual = new Date().getMonth() + 1;
    const transitoBySku = datos.transitoBySku || {};
    const actStockBySku = datos.actStockBySku || {};
    // Roadmap lookup (para detección de producto nuevo en Digitalife)
    const roadmapBySku = {};
    (datos.roadmap || []).forEach(r => { if (r.sku) roadmapBySku[r.sku] = r.rdmp || ""; });
    const riesgo = [];

    // Iteramos sobre productos (catálogo), igual que skuDetail
    (datos.productos || []).forEach(p => {
      const skuExterno = (clienteKey === 'pcel' && p.modelo) ? p.modelo : p.sku;
      const soData = datos.sellOut.filter(r => r.sku === p.sku);
      const soSinMes = soData.filter(r => Number(r.mes) < mesActual).sort((a, b) => Number(a.mes) - Number(b.mes));
      const ultimos3 = soSinMes.slice(-3);
      const prom = ultimos3.length > 0
        ? ultimos3.reduce((s, r) => s + (r.piezas || 0), 0) / ultimos3.length
        : 0;
      if (prom < 2) return; // filtro mínimo de rotación para no inundar

      const invData = datos.inventario.find(r => r.sku === p.sku);
      const stock = Number(invData?.stock) || 0;
      const diasRestantes = prom > 0 ? Math.round((stock / prom) * 30) : 999;
      if (diasRestantes >= 30) return;

      const invActeck = actStockBySku[skuExterno] || actStockBySku[p.sku] || 0;
      const invTransito = transitoBySku[skuExterno] || transitoBySku[p.sku] || 0;
      const disponibleActeck = invActeck + invTransito;

      // Gate "sin stock" — aplica tanto para PCEL como Digitalife
      const esPcelOrDgl = clienteKey === "pcel" || clienteKey === "digitalife";
      const sinStock = esPcelOrDgl && invActeck === 0 && invTransito === 0;

      let sugerido = 0;
      const MIN = 20, UMBRAL = 0.5;

      if (!sinStock && clienteKey === "pcel") {
        // Fórmula PCEL simplificada: meta 3m cobertura, cap Acteck, mínimo 20
        if (disponibleActeck >= MIN && prom > 0) {
          const base = 3 * prom;
          const ideal = Math.max(0, Math.round(base - stock));
          sugerido = Math.min(ideal, disponibleActeck);
          if (sugerido > 0 && sugerido < MIN) sugerido = MIN;
        }
      } else if (!sinStock && clienteKey === "digitalife") {
        // Fórmula DIGITALIFE v4 — meta dinámica 90/120/150 días
        if (disponibleActeck >= MIN && prom > 0) {
          let crecimiento = 0;
          if (soSinMes.length >= 6) {
            const ant3 = soSinMes.slice(-6, -3);
            const sumUlt = ultimos3.reduce((s, r) => s + (r.piezas || 0), 0);
            const sumAnt = ant3.reduce((s, r) => s + (r.piezas || 0), 0);
            if (sumAnt > 0) crecimiento = (sumUlt / sumAnt) - 1;
          }
          const anioActual = new Date().getFullYear();
          const rdmpRaw = String(roadmapBySku[skuExterno] || roadmapBySku[p.sku] || "").trim();
          const esNuevo = rdmpRaw === String(anioActual);
          let metaMeses = 3;
          if (esNuevo) metaMeses = Math.max(metaMeses, 4);
          if (crecimiento >= 0.40) metaMeses = Math.max(metaMeses, 5);
          else if (crecimiento >= 0.20) metaMeses = Math.max(metaMeses, 4);

          const coberturaActual = stock / prom;
          if (coberturaActual <= 4) {
            const base = metaMeses * prom;
            const ideal = Math.max(0, Math.round(base - stock));
            sugerido = Math.min(ideal, disponibleActeck);
            if (disponibleActeck < prom * UMBRAL) sugerido = 0;
            if (sugerido > 0 && sugerido < MIN) sugerido = MIN;
          }
        }
      }
      // Aplicar override manual si existe
      if (sugeridoEdits[p.sku] !== undefined) {
        // Si está en sinStock, forzar 0 ignorando override
        sugerido = sinStock ? 0 : Number(sugeridoEdits[p.sku]) || 0;
      }

      const prod = datos.productos.find(q => q.sku === p.sku);
      const titulo = (invData && invData.titulo) || (prod && prod.descripcion) || p.descripcion || p.sku;

      riesgo.push({
        sku: p.sku,
        modelo: p.modelo || "",
        titulo,
        stock,
        promMes: Math.round(prom),
        diasRestantes,
        invActeck,
        transito: invTransito,
        sugerido,
        sinStock,
        urgencia: sinStock ? 3
                : diasRestantes < 7 ? 3
                : diasRestantes < 15 ? 2 : 1,
      });
    });

    // Excluir SKUs que ya están en propuestas pendientes (ya se envió sugerido)
    const filtrado = riesgo.filter(r => !skusEnPropuestasPendientes.has(String(r.sku)));
    return filtrado.sort((a, b) => a.diasRestantes - b.diasRestantes);
  }, [datos, clienteKey, sugeridoEdits, skusEnPropuestasPendientes]);

  // Cuántos SKUs quedaron fuera del riesgo por estar en propuestas pendientes
  const skusOcultosEnPropuesta = React.useMemo(() => skusEnPropuestasPendientes.size, [skusEnPropuestasPendientes]);

  // Roadmap + Tránsito cruce: identifica productos nuevos (en tránsito sin roadmap)
  // Solo considera SKUs que empiezan con "AC" o "BR"
  const roadmapCruce = React.useMemo(() => {
    if (!datos || !datos.roadmap || !datos.transito) return null;
    const isAcBr = (sku) => {
      if (!sku) return false;
      const s = String(sku).toUpperCase();
      return s.startsWith("AC-") || s.startsWith("BR-") || s.startsWith("AC") || s.startsWith("BR");
    };
    const roadmapFiltered = datos.roadmap.filter(r => isAcBr(r.sku));
    const transitoFiltered = datos.transito.filter(t => isAcBr(t.sku));
    const roadmapSet = new Set(roadmapFiltered.map(r => r.sku));
    const transitoMap = {};
    transitoFiltered.forEach(t => { transitoMap[t.sku] = t; });

    // Helpers para extraer info del payload
    const getDesc = (t, fallback) => {
      const p = t && t.payload;
      if (p) {
        return p["DESCRIPCIÓN"] || p["Descripcion"] || p["DESCRIPCION"] || p.descripcion || fallback || "";
      }
      return fallback || "";
    };
    const getArriboCedis = (t) => {
      const p = t && t.payload;
      if (p) return p["ARRIBO A CEDIS"] || p["arribo_cedis"] || p["Arribo a CEDIS"] || null;
      return null;
    };
    const getCedis = (t) => {
      const p = t && t.payload;
      if (p) return p.CEDIS || p.cedis || null;
      return null;
    };

    // Productos nuevos = en tránsito pero NO en roadmap
    const nuevos = transitoFiltered.filter(t => !roadmapSet.has(t.sku)).map(t => ({
      sku: t.sku,
      descripcion: getDesc(t, "—"),
      piezas: Number(t.inventario_transito) || 0,
      arribo: getArriboCedis(t),
      cedis: getCedis(t),
    }));
    // En tránsito + roadmap = reposición planeada (incluye inv Acteck actual)
    const actStockBySku = datos.actStockBySku || {};
    const enCamino = roadmapFiltered.filter(r => transitoMap[r.sku]).map(r => {
      const t = transitoMap[r.sku];
      return {
        sku: r.sku,
        descripcion: r.descripcion || getDesc(t, ""),
        rdmp: r.rdmp,
        piezas: Number(t.inventario_transito) || 0,
        arribo: getArriboCedis(t),
        cedis: getCedis(t),
        invActeck: Number(actStockBySku[r.sku]) || 0,
      };
    });
    return { nuevos, enCamino, total: roadmapFiltered.length };
  }, [datos]);

  // Filtered & sorted SKUs
  const skuDetailUnsorted = React.useMemo(() => {
    if (!datos) return [];
    // Build roadmap lookups:
    //   roadmapBySku     → rdmp (estado RMI/RML/2026/D/NVS)
    //   roadmapDescBySku → descripción corta del roadmap (para UI de tabla)
    //   roadmapDescLongBySku → descripción larga del payload "Descripcion 2" (para Excel export)
    const roadmapBySku = {};
    const roadmapDescBySku = {};
    const roadmapDescLongBySku = {};
    (datos.roadmap || []).forEach(r => {
      if (!r.sku) return;
      roadmapBySku[r.sku] = r.rdmp || "";
      roadmapDescBySku[r.sku] = r.descripcion || "";
      const p = r.payload;
      if (p) {
        roadmapDescLongBySku[r.sku] = p["Descripcion 2"] || p["DESCRIPCION 2"] || p["Descripción 2"] || p["DESCRIPCIÓN 2"] || "";
      }
    });
    return datos.productos
      .filter(p => !categoriaFilter || (p.categoria || "") === categoriaFilter)
      .filter(p => !searchFilter || (p.sku || "").toUpperCase().includes(searchFilter.toUpperCase()) || (p.modelo || "").toUpperCase().includes(searchFilter.toUpperCase()) || (p.descripcion || "").toUpperCase().includes(searchFilter.toUpperCase()))
      .map(p => {
        // Para PCEL, los SKUs son numéricos pero roadmap/inv_acteck/transito_sku
        // usan el código "modelo" (AC-xxx, BR-xxx). Entonces para lookups que
        // cruzan con tablas globales usamos el modelo; para lookups específicos
        // de PCEL (sellout_pcel, sell_in, sellout) usamos el sku numérico.
        const skuExterno = (clienteKey === 'pcel' && p.modelo) ? p.modelo : p.sku;
        const siData = datos.sellIn.filter(r => r.sku === p.sku);
        const soData = datos.sellOut.filter(r => r.sku === p.sku);
        const invData = datos.inventario.find(r => r.sku === p.sku);

        const siPiezasTotal = siData.reduce((s, r) => s + (r.piezas || 0), 0);
        const soMontoTotal = soData.reduce((s, r) => s + (r.monto_pesos || 0), 0);

        // ── Último precio facturado al cliente ──
        // Toma la fila más reciente con piezas > 0 y calcula monto/piezas.
        // Para Digitalife: sell_in_sku (lo que se le facturó). Para PCEL: igual.
        const ultimaVenta = (siData || [])
          .filter(r => Number(r.piezas) > 0 && Number(r.monto_pesos) > 0)
          .sort((a, b) => {
            const ka = Number(a.anio) * 100 + Number(a.mes);
            const kb = Number(b.anio) * 100 + Number(b.mes);
            return kb - ka;
          })[0];
        const ultimoPrecio = ultimaVenta
          ? Math.round((Number(ultimaVenta.monto_pesos) / Number(ultimaVenta.piezas)) * 100) / 100
          : 0;
        const mesActual = new Date().getMonth() + 1;
        const soSinMesActual = soData.filter(r => Number(r.mes) < mesActual).sort((a, b) => Number(a.mes) - Number(b.mes));
        // promedio90d = promedio mensual de piezas vendidas en últimos 3 meses completos
        const ultimos3 = soSinMesActual.slice(-3);
        const promedio90d = ultimos3.length > 0 ? Math.round(ultimos3.reduce((s, r) => s + (r.piezas || 0), 0) / ultimos3.length) : 0;

        // Factor estacional: últimos 3 meses vs 3 meses anteriores (si hay historial suficiente)
        let factorEstacional = 1.0;
        if (soSinMesActual.length >= 6) {
          const anteriores3 = soSinMesActual.slice(-6, -3);
          const sumUltimos3 = ultimos3.reduce((s, r) => s + (r.piezas || 0), 0);
          const sumAnt3 = anteriores3.reduce((s, r) => s + (r.piezas || 0), 0);
          if (sumAnt3 > 0) {
            factorEstacional = sumUltimos3 / sumAnt3;
            // Clamp 0.7 - 1.5 para evitar extremos
            factorEstacional = Math.max(0.7, Math.min(1.5, factorEstacional));
          }
        }

        const stock = Number(invData?.stock) || 0;
        // Fallback: cuando inventario_cliente.valor está NULL (caso común
        // para Digitalife), calcular stock × costo.
        const valorInv = (Number(invData?.valor) > 0)
          ? Number(invData.valor)
          : stock * (Number(invData?.costo_convenio) || Number(invData?.costo_promedio) || 0);

        // Acteck inventory (9 almacenes) + tránsito — usan skuExterno (modelo para PCEL)
        const invActeck = (datos.actStockBySku && datos.actStockBySku[skuExterno]) || 0;
        const invTransito = (datos.transitoBySku && datos.transitoBySku[skuExterno]) || 0;

        // ═══ Campos específicos PCEL ═══
        // backOrder y transito vienen de sellout_pcel (usa SKU numérico = p.sku)
        const backOrder    = (datos.backOrderBySkuPcel && datos.backOrderBySkuPcel[p.sku]) || 0;
        const transPcel    = (datos.transitoPcelBySku  && datos.transitoPcelBySku[p.sku])  || 0;
        // histPcel viene de ventas_erp por articulo (= modelo Acteck)
        const histPcelSku  = (datos.histPcel && (datos.histPcel[skuExterno] || datos.histPcel[p.sku])) || null;
        // Prom Compra:
        //   PCEL — promedio del histórico ERP (ya calculado en histPcelSku)
        //   Digitalife — promedio de piezas/mes del sell_in_sku últimos 6 meses
        let promCompra;
        if (clienteKey === 'pcel') {
          promCompra = histPcelSku ? Math.round(histPcelSku.promedio) : 0;
        } else {
          const siUlt6 = (siData || [])
            .slice()
            .sort((a, b) => {
              const ka = Number(a.anio) * 100 + Number(a.mes);
              const kb = Number(b.anio) * 100 + Number(b.mes);
              return kb - ka;
            })
            .slice(0, 6)
            .filter(r => Number(r.piezas) > 0);
          promCompra = siUlt6.length > 0
            ? Math.round(siUlt6.reduce((s, r) => s + (Number(r.piezas) || 0), 0) / siUlt6.length)
            : 0;
        }
        const facturasHist = histPcelSku ? histPcelSku.facturas : 0;
        // "Activo" para PCEL, 2 condiciones obligatorias:
        //   (A) Tiene actividad: lo han comprado (historial ERP) O tiene
        //       venta reciente O tiene inventario en algún lado (PCEL,
        //       Acteck o tránsito).
        //   (B) Está en el roadmap actual (si salió del catálogo, se quita).
        const tieneActividad =
          facturasHist > 0 ||        // compra histórica en ventas_erp
          promedio90d > 0 ||         // sellout reciente
          stock > 0 ||               // inventario en PCEL
          invActeck > 0 ||           // inventario Acteck
          invTransito > 0 ||         // tránsito nuestro hacia Acteck
          transPcel > 0 ||           // tránsito hacia PCEL
          backOrder > 0;             // back order pendiente
        const enRoadmap    = !!(roadmapBySku[skuExterno] || roadmapBySku[p.sku]);
        const isActivo     = enRoadmap && tieneActividad;

        // ═══ FÓRMULA DEL SUGERIDO ═══
        let sugerido = 0;
        let metaMesesDigi = null;   // sólo para Digitalife (badge UI)
        let metaRazonDigi = null;
        if (clienteKey === 'pcel') {
          // FÓRMULA PCEL v4 (basada en patrón de overrides manuales del usuario)
          //
          // Meta: que PCEL termine con META_COBERTURA meses de stock después de surtir.
          // Fallback a promCompra si no hay sellout reciente.
          //
          // 1) base = META × sellout_mensual
          // 2) ideal = base − stock_PCEL − tránsito_PCEL + back_order
          // 3) cap al stock disponible en Acteck (inv + tránsito)
          // 4) umbral: si Acteck tiene < ½ mes de sellout, sugerido = 0
          //    (no comprometer lo que apenas tenemos)
          const META_COBERTURA = 3;         // meses objetivo en PCEL
          const UMBRAL_STOCK   = 0.5;       // múltiplo mínimo del sellout mensual
          const MIN_COMPRA     = 20;        // piezas mínimas para proponer

          const selloutMensual = promedio90d > 0 ? promedio90d
                                : (promCompra > 0 ? promCompra : 0);
          const disponibleActeck = invActeck + invTransito;

          // Regla dura: si no hay al menos MIN_COMPRA piezas disponibles en
          // Acteck (inv + tránsito), no proponemos nada. No vale la pena.
          if (disponibleActeck < MIN_COMPRA) {
            sugerido = 0;
          } else if (selloutMensual > 0) {
            // Sobre-inventariado: si ya tienen >4 meses, no sugerir
            const coberturaActual = (stock + transPcel) / selloutMensual;
            if (coberturaActual > 4) {
              sugerido = 0;
            } else {
              const base = META_COBERTURA * selloutMensual;
              const ideal = Math.max(0, Math.round(base - stock - transPcel)) + backOrder;
              // Cap por disponibilidad Acteck
              sugerido = Math.min(ideal, disponibleActeck);
              // Umbral: si apenas hay stock Acteck, no sugerir
              if (disponibleActeck < selloutMensual * UMBRAL_STOCK) sugerido = 0;
            }
          } else if (backOrder > 0 && disponibleActeck > 0) {
            // Sin sellout pero debemos back order y tenemos stock → surtir
            sugerido = Math.min(backOrder, disponibleActeck);
          }
          // Mínimo de compra: si la fórmula da algo > 0 pero < MIN_COMPRA,
          // subir a MIN_COMPRA (ya garantizado que Acteck tiene ≥ 20).
          if (sugerido > 0 && sugerido < MIN_COMPRA) {
            sugerido = MIN_COMPRA;
          }
        } else {
          // FÓRMULA DIGITALIFE v4 — alineada con PCEL pero con meta dinámica.
          //
          // Meta = 90 días de inventario en el cliente (3 meses).
          //   - Sube a 120d si crecimiento ≥ 20% (últimos 3m vs 3m anteriores)
          //   - Sube a 150d si crecimiento ≥ 40%
          //   - Sube a 120d si roadmap = año actual (productos nuevos que
          //     "nunca han tenido inventario" y queremos empujar venta)
          //   - Gana la meta MÁS ALTA que aplique.
          //
          // Gates idénticos a PCEL:
          //   - disponibleActeck (inv + tránsito) < MIN_COMPRA (20) → 0
          //   - cobertura actual cliente > 4 meses → 0 (sobre-inventariado)
          //   - disponibleActeck < ½ mes sellout → 0 (no comprometer stock
          //     que apenas tenemos)
          //
          // Para Digitalife, NO contamos tránsito hacia cliente (no lo
          // manejan) ni back order (se trabajará después).
          const MIN_COMPRA   = 20;
          const UMBRAL_STOCK = 0.5;

          // Crecimiento (ratio últimos 3m / 3m anteriores)
          let crecimiento = 0;
          if (soSinMesActual.length >= 6) {
            const sumUlt = ultimos3.reduce((s, r) => s + (r.piezas || 0), 0);
            const anteriores3 = soSinMesActual.slice(-6, -3);
            const sumAnt = anteriores3.reduce((s, r) => s + (r.piezas || 0), 0);
            if (sumAnt > 0) crecimiento = (sumUlt / sumAnt) - 1;
          }

          // ¿Roadmap = año actual? (productos nuevos que queremos empujar)
          const anioActual = new Date().getFullYear();
          const rdmpRaw = String(roadmapBySku[skuExterno] || roadmapBySku[p.sku] || "").trim();
          const esRoadmapNuevo = rdmpRaw === String(anioActual);

          // Meta dinámica (gana la mayor)
          metaMesesDigi = 3;
          if (esRoadmapNuevo) metaMesesDigi = Math.max(metaMesesDigi, 4);         // 120d
          if (crecimiento >= 0.40) metaMesesDigi = Math.max(metaMesesDigi, 5);    // 150d
          else if (crecimiento >= 0.20) metaMesesDigi = Math.max(metaMesesDigi, 4); // 120d

          if (metaMesesDigi > 3) {
            if (crecimiento >= 0.40) metaRazonDigi = "Crecimiento +" + Math.round(crecimiento * 100) + "%";
            else if (crecimiento >= 0.20) metaRazonDigi = "Crecimiento +" + Math.round(crecimiento * 100) + "%";
            else if (esRoadmapNuevo) metaRazonDigi = "Roadmap " + anioActual;
          }

          const disponibleActeck = invActeck + invTransito;

          if (disponibleActeck < MIN_COMPRA) {
            sugerido = 0;
          } else if (promedio90d > 0) {
            const coberturaActual = stock / promedio90d;
            if (coberturaActual > 4) {
              sugerido = 0;
            } else {
              const base = metaMesesDigi * promedio90d;
              const ideal = Math.max(0, Math.round(base - stock));
              sugerido = Math.min(ideal, disponibleActeck);
              if (disponibleActeck < promedio90d * UMBRAL_STOCK) sugerido = 0;
            }
          } else if (esRoadmapNuevo && stock === 0) {
            // Producto nuevo del año actual sin sellout todavía y sin stock
            // en el cliente. Empujar con MIN_COMPRA para arrancar la venta.
            sugerido = MIN_COMPRA;
          }
          if (sugerido > 0 && sugerido < MIN_COMPRA) sugerido = MIN_COMPRA;
        }

        // Precio: prioridad (1) productos_cliente.precio_venta → (2) inventario_cliente.precio_venta
        //                  → (3) precios_sku.precio_descuento (del roadmap Acteck)
        const precioInfoSku = (datos.preciosBySku && (datos.preciosBySku[skuExterno] || datos.preciosBySku[p.sku])) || {};
        const precioSku = Number(p.precio_venta) > 0
          ? Number(p.precio_venta)
          : (Number(invData && invData.precio_venta) > 0
              ? Number(invData.precio_venta)
              : Number(precioInfoSku.precio_descuento) || 0);
        return {
          sku: p.sku,
          // Descripción corta (para UI): prioridad roadmap → productos_cliente
          descripcion: roadmapDescBySku[skuExterno] || roadmapDescBySku[p.sku] || p.descripcion || "",
          // Descripción larga (para Excel): prioridad payload 'Descripcion 2' → corta del roadmap → productos_cliente
          descripcionLarga: roadmapDescLongBySku[skuExterno] || roadmapDescLongBySku[p.sku] || roadmapDescBySku[skuExterno] || roadmapDescBySku[p.sku] || p.descripcion || "",
          marca: p.marca,
          modelo: p.modelo || "",
          categoria: p.categoria || "",
          estado: p.estado,
          roadmap: roadmapBySku[skuExterno] || roadmapBySku[p.sku] || p.roadmap || "",   // desde roadmap_sku real
          precio: precioSku,
          siPiezasTotal,
          promedio90d,
          stock,
          valorInv,
          invActeck,
          invTransito,
          sugerido,
          soMontoTotal,
          // Campos específicos PCEL:
          backOrder,
          transPcel,
          promCompra,
          ultimoPrecio,
          facturasHist,
          isActivo,
          // Meta dinámica de Digitalife (badge en UI)
          metaMeses: metaMesesDigi,
          metaRazon: metaRazonDigi,
          precioAAAcd:     (datos.preciosBySku && (datos.preciosBySku[skuExterno] || datos.preciosBySku[p.sku]) || {}).precio_descuento || 0,
          // Próximo arribo del SKU: lookup en transito_sku por modelo Acteck
          arriboFecha: (function() {
            const t = (datos.transito || []).find(x => x.sku === skuExterno || x.sku === p.sku);
            return t ? (t.siguiente_arribo || null) : null;
          })(),
          arriboPiezas: (function() {
            const t = (datos.transito || []).find(x => x.sku === skuExterno || x.sku === p.sku);
            return t ? (Number(t.inventario_transito) || 0) : 0;
          })(),
        };
      })
      .filter(r => {
        // Filtro "Solo activos" para PCEL
        if (clienteKey === 'pcel' && soloActivosPcel && !r.isActivo) return false;
        return true;
      });
    // IMPORTANTE: el sort NO se hace en este useMemo para que editar un
    // sugerido/precio no reordene las filas (sería frustrante: el producto
    // que estás editando se te mueve de lugar). El orden se aplica en otro
    // useEffect de abajo que solo corre cuando cambian sort/filtros/datos,
    // NO cuando cambian los edits manuales.
    }, [datos, searchFilter, categoriaFilter, clienteKey, soloActivosPcel]);

  // ═══ Orden congelado ═══
  // Guardamos el orden (array de sku ids) y sólo se recalcula cuando cambia
  // sortCol, sortDir, o los filtros base (no cuando editas sugerido/precio).
  // Así editar una fila NO la mueve de lugar. El orden se refresca al
  // clickear una cabecera de columna o cambiar filtros.
  const [orderedSkus, setOrderedSkus] = React.useState([]);
  // Refs para leer los edits más recientes en el useEffect de sort sin
  // incluirlos como dep (evitaría resort en cada edit).
  const sugeridoEditsRef = React.useRef(sugeridoEdits);
  const precioEditsRef   = React.useRef(precioEdits);
  React.useEffect(() => { sugeridoEditsRef.current = sugeridoEdits; }, [sugeridoEdits]);
  React.useEffect(() => { precioEditsRef.current   = precioEdits;   }, [precioEdits]);

  React.useEffect(() => {
    if (!skuDetailUnsorted || skuDetailUnsorted.length === 0) {
      setOrderedSkus([]);
      return;
    }
    const safeNum = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
    const resolver = (r) => {
      if (sortCol === "sugerido") {
        const ov = sugeridoEditsRef.current[r.sku];
        return (ov !== undefined && ov !== null && ov !== "") ? safeNum(ov) : safeNum(r.sugerido);
      }
      if (sortCol === "precioAAAcd" && (clienteKey === "pcel" || clienteKey === "digitalife")) {
        const ov = precioEditsRef.current[r.sku];
        return (ov !== undefined && ov !== null && ov !== "") ? safeNum(ov) : safeNum(r.precioAAAcd);
      }
      return safeNum(r[sortCol]);
    };
    const sorted = [...skuDetailUnsorted].sort((a, b) => {
      const vA = resolver(a), vB = resolver(b);
      return sortDir === "asc" ? vA - vB : vB - vA;
    });
    setOrderedSkus(sorted.map(s => s.sku));
  }, [skuDetailUnsorted, sortCol, sortDir, clienteKey]);

  // skuDetail final: reordena skuDetailUnsorted según el orden guardado.
  // Cualquier SKU nuevo que no esté en orderedSkus va al final (fallback).
  const skuDetail = React.useMemo(() => {
    if (!orderedSkus || orderedSkus.length === 0) return skuDetailUnsorted;
    const byKey = {};
    skuDetailUnsorted.forEach(s => { byKey[s.sku] = s; });
    const ordered = [];
    const seen = new Set();
    orderedSkus.forEach(sku => {
      const item = byKey[sku];
      if (item) { ordered.push(item); seen.add(sku); }
    });
    // SKUs que no estaban en el último sort (ej: nuevos por filtros) → al final
    skuDetailUnsorted.forEach(s => { if (!seen.has(s.sku)) ordered.push(s); });
    return ordered;
  }, [orderedSkus, skuDetailUnsorted]);

  // ── Productos nuevos / No vendidos al cliente ──
  // Dos categorías para apoyar el desarrollo de cuenta:
  //   🆕 Nuevos: vienen en tránsito a Acteck Y nunca tuvieron stock en
  //      Acteck (actStockBySku = 0) Y el cliente nunca los ha comprado.
  //   🎯 No vendidos: SKU ya existe en stock pero el cliente nunca ha
  //      hecho compra de ese SKU.
  // En ambos casos Fernando sugiere manualmente la cantidad inicial.
  const skusOportunidad = React.useMemo(() => {
    if (!skuDetail) return { nuevos: [], noVendidos: [] };
    // SKUs que el cliente HA comprado (con sell_in_sku.piezas > 0 algún mes)
    const clienteHaComprado = new Set();
    if (datos && datos.sellIn) {
      datos.sellIn.forEach((r) => {
        if (Number(r.piezas) > 0) clienteHaComprado.add(r.sku);
      });
    }
    const nuevos = [];
    const noVendidos = [];
    skuDetail.forEach((s) => {
      if (clienteHaComprado.has(s.sku)) return;  // ya le vendimos
      const enTransito = Number(s.invTransito) > 0;
      const sinStockActeck = Number(s.invActeck) === 0;
      if (enTransito && sinStockActeck) {
        // 🆕 nuevo (en camino, primer contacto con la cuenta)
        nuevos.push(s);
      } else if (Number(s.invActeck) > 0) {
        // 🎯 ya hay stock pero nunca se le vendió
        noVendidos.push(s);
      }
    });
    return { nuevos, noVendidos };
  }, [skuDetail, datos]);

  // Estado: sección colapsable de oportunidad
  const [oportunidadAbierta, setOportunidadAbierta] = React.useState(true);
  const [oportunidadTab, setOportunidadTab] = React.useState('nuevos');  // 'nuevos' | 'noVendidos'

  // ── KPIs derivados del Detalle por SKU (fuente de verdad) ──
  // Antes `kpis.sugMonto/sugPiezas/sugSkus` se calculaban con una fórmula
  // simplificada distinta de la real del Detalle, así que nunca cuadraban.
  // Estos sí cuadran porque iteran sobre el mismo skuDetail que se renderiza,
  // respetando overrides manuales (sugeridoEdits) y SKUs excluidos.
  const kpisSugerido = React.useMemo(() => {
    if (!skuDetail || skuDetail.length === 0) return { sugMonto: 0, sugPiezas: 0, sugSkus: 0 };
    let sugMonto = 0, sugPiezas = 0, sugSkus = 0;
    skuDetail.forEach((s) => {
      if (excluidosSku.has(s.sku)) return;
      const sug = sugeridoEdits[s.sku] !== undefined
        ? Number(sugeridoEdits[s.sku])
        : Number(s.sugerido) || 0;
      if (sug <= 0) return;
      const precio = Number(s.precioAAAcd) > 0
        ? (precioEdits[s.sku] !== undefined ? Number(precioEdits[s.sku]) : Number(s.precioAAAcd))
        : Number(s.precio) || 0;
      sugPiezas += sug;
      sugMonto += sug * precio;
      sugSkus += 1;
    });
    return { sugMonto, sugPiezas, sugSkus };
  }, [skuDetail, sugeridoEdits, precioEdits, excluidosSku]);

  // ── Vista Previa del bulk: calcula cambios y abre el modal ──
  const previewBulk = React.useCallback((modo, metaMeses) => {
    if (!canEdit || !skuDetail) return;
    // Filtrar el universo según los toggles
    let universo = skuDetail.slice();
    if (bulkSoloFiltrados) {
      // skuDetail YA está filtrado por searchFilter+categoriaFilter (se calcula con esos)
      // así que no hay que re-filtrar; sólo confirmamos que NO se aplique a SKUs fuera del filtro.
    }
    if (bulkSoloSinStock) {
      universo = universo.filter((s) => Number(s.stock) === 0);
    }
    // Excluir SKUs marcados como excluidos del envío
    universo = universo.filter((s) => !excluidosSku.has(s.sku));

    const cambios = {};
    let cuentaCambios = 0;
    let totalAntes = 0;
    let totalDespues = 0;

    universo.forEach((s) => {
      const precio = Number(s.precioAAAcd) > 0 ? Number(s.precioAAAcd) : Number(s.precio) || 0;
      const sugAnterior = sugeridoEdits[s.sku] !== undefined
        ? Number(sugeridoEdits[s.sku])
        : Number(s.sugerido) || 0;
      let sugNuevo;
      if (modo === 'reiniciar') {
        sugNuevo = Number(s.sugerido) || 0;  // auto
      } else {
        sugNuevo = calcularSugeridoConMeta(s, metaMeses);
      }
      totalAntes += sugAnterior * precio;
      totalDespues += sugNuevo * precio;
      if (sugNuevo !== sugAnterior) {
        cambios[s.sku] = sugNuevo;
        cuentaCambios++;
      }
    });

    setBulkPreview({
      modo, metaMeses,
      etiqueta: modo === 'reiniciar' ? 'Reiniciado' : ('Cobertura ' + metaMeses + ' meses (' + (metaMeses * 30) + 'd)'),
      cambios, cuentaCambios,
      universoSize: universo.length,
      totalAntes, totalDespues,
      diferencia: totalDespues - totalAntes,
      modificadores: {
        soloFiltrados: bulkSoloFiltrados && (searchFilter || categoriaFilter),
        soloSinStock: bulkSoloSinStock,
      },
    });
  }, [canEdit, skuDetail, bulkSoloFiltrados, bulkSoloSinStock, excluidosSku, sugeridoEdits, calcularSugeridoConMeta, searchFilter, categoriaFilter]);

  // ── Calculadora reversa de cuota ──
  // Dado un faltante en MXN (mes o Q), elige SKUs respetando el sugerido
  // auto y, si no alcanza, sube hasta el agresivo (meta = 4 meses) por SKU.
  // Prioriza por monto sugerido $ DESC (volumen) + sell-in histórico DESC.
  const calcularParaCuota = React.useCallback((meta) => {
    if (!skuDetail || !kpis) return;
    const faltaMonto = meta === 'mes'
      ? Math.max(0, (kpis.cuotaMesActual || 0) - (kpis.siMesActual || 0))
      : (kpis.qActualData ? Math.max(0, kpis.qActualData.cuota - kpis.qActualData.sellInAcumulado) : 0);

    if (faltaMonto <= 0) {
      setMessage('✓ Ya estás al día con la cuota — no falta dinero.');
      setTimeout(() => setMessage(''), 4000);
      return;
    }

    // Universo: SKUs no excluidos con precio > 0 (sin precio no podemos calcular monto)
    const candidatos = skuDetail
      .filter((s) => !excluidosSku.has(s.sku))
      .map((s) => {
        const precio = Number(s.precioAAAcd) > 0 ? Number(s.precioAAAcd) : Number(s.precio) || 0;
        const sugActual = sugeridoEdits[s.sku] !== undefined
          ? Number(sugeridoEdits[s.sku])
          : Number(s.sugerido) || 0;
        const sugAgresivo = calcularSugeridoConMeta(s, 4);  // 120 días = agresivo
        return {
          sku: s.sku,
          descripcion: s.descripcion,
          precio,
          sugActual,
          sugAgresivo,
          montoActual: sugActual * precio,
          montoAgresivo: sugAgresivo * precio,
          siPiezasTotal: Number(s.siPiezasTotal) || 0,
        };
      })
      .filter((c) => c.precio > 0 && c.sugAgresivo > 0)
      // Prioridad: mayor potencial de monto (agresivo) DESC,
      //            luego mayor histórico de venta DESC
      .sort((a, b) => (b.montoAgresivo - a.montoAgresivo) || (b.siPiezasTotal - a.siPiezasTotal));

    // Greedy: ir sumando hasta llegar al gap, primero respetando sugActual,
    // si no alcanza, subiendo a agresivo cuando se necesite.
    let acumulado = 0;
    const cambios = {};
    const detalle = [];

    // PASO 1: contar lo que ya está propuesto (auto + override) — el gap real es lo que hay que SUMAR
    // pero los sugeridos actuales también van al cliente, así que ya están contribuyendo.
    // Sin embargo, lo que ya está NO suma a "cuota mes" hasta que el cliente compre.
    // Para llegar al gap necesitamos que el cliente compre por ese monto.
    // El sugerido es lo que LE PROPONEMOS — si lo compra, eso es sell-in que sí cuenta.
    // Lógica: queremos que la propuesta total llegue al gap (al monto del faltante).
    // Vamos a setear los sugeridos para que la propuesta total ≥ faltaMonto.

    // Total actual de la propuesta
    const totalActualPropuesta = candidatos.reduce((s, c) => s + c.montoActual, 0);

    if (totalActualPropuesta >= faltaMonto) {
      // Ya con lo actual cubrirías el gap si compra todo
      setCuotaCalc({
        meta, faltaMonto,
        totalActualPropuesta,
        cambios: {},
        skusAfectados: 0,
        cubre: true,
        nuevoTotal: totalActualPropuesta,
        skusUsados: candidatos.filter((c) => c.sugActual > 0).map((c) => ({
          sku: c.sku, descripcion: c.descripcion, sugActual: c.sugActual, sugNuevo: c.sugActual, monto: c.montoActual, motivo: 'ya propuesto',
        })),
      });
      return;
    }

    // PASO 2: subir SKUs al agresivo en orden, hasta cerrar el gap
    let acumNuevoMonto = totalActualPropuesta;
    candidatos.forEach((c) => {
      if (acumNuevoMonto >= faltaMonto) return;
      if (c.sugAgresivo <= c.sugActual) return; // no sube
      const subir = c.sugAgresivo - c.sugActual;
      const montoExtra = subir * c.precio;
      cambios[c.sku] = c.sugAgresivo;
      detalle.push({
        sku: c.sku,
        descripcion: c.descripcion,
        sugActual: c.sugActual,
        sugNuevo: c.sugAgresivo,
        delta: subir,
        precio: c.precio,
        montoExtra,
      });
      acumNuevoMonto += montoExtra;
    });

    setCuotaCalc({
      meta,
      faltaMonto,
      totalActualPropuesta,
      cambios,
      skusAfectados: detalle.length,
      cubre: acumNuevoMonto >= faltaMonto,
      nuevoTotal: acumNuevoMonto,
      sobrante: Math.max(0, acumNuevoMonto - faltaMonto),
      skusUsados: detalle,
    });
  }, [skuDetail, kpis, excluidosSku, sugeridoEdits, calcularSugeridoConMeta]);

  // Aplica los cambios de la calculadora reversa
  const aplicarCuotaCalc = React.useCallback(async () => {
    if (!cuotaCalc || !cuotaCalc.cubre || Object.keys(cuotaCalc.cambios).length === 0) {
      setCuotaCalc(null);
      return;
    }
    await aplicarBulkSugerido(
      cuotaCalc.cambios,
      'Para cuota ' + (cuotaCalc.meta === 'mes' ? 'mes' : 'Q')
    );
    setCuotaCalc(null);
  }, [cuotaCalc, aplicarBulkSugerido]);

  // Confirma el bulk preview y aplica los cambios
  const confirmarBulk = React.useCallback(async () => {
    if (!bulkPreview) return;
    if (bulkPreview.modo === 'reiniciar') {
      // Borra TODOS los overrides (para los SKUs en el universo)
      const cambiosVacios = {};
      Object.keys(bulkPreview.cambios).forEach((sku) => { cambiosVacios[sku] = bulkPreview.cambios[sku]; });
      // Snapshot
      setUndoSnapshot({ edits: { ...sugeridoEdits }, etiqueta: 'Reiniciar' });
      // Quitar overrides del state local (se mantienen los de SKUs no afectados)
      setSugeridoEdits((prev) => {
        const next = { ...prev };
        Object.keys(bulkPreview.cambios).forEach((sku) => { delete next[sku]; });
        return next;
      });
      // Borrar de BD
      if (DB_CONFIGURED) {
        const skus = Object.keys(bulkPreview.cambios);
        for (let i = 0; i < skus.length; i += 50) {
          const batch = skus.slice(i, i + 50);
          await supabase.from('sugerido_overrides').delete()
            .eq('cliente', clienteKey).in('sku', batch);
        }
      }
      setMessage('↻ Reiniciado: ' + skus_count(bulkPreview.cuentaCambios) + ' volvieron a auto');
    } else {
      await aplicarBulkSugerido(bulkPreview.cambios, bulkPreview.etiqueta);
    }
    setBulkPreview(null);
    function skus_count(n) { return n === 1 ? '1 SKU' : (n + ' SKUs'); }
  }, [bulkPreview, aplicarBulkSugerido, sugeridoEdits, clienteKey]);

  // Export to Excel
  const handleSort = (col) => { if (sortCol === col) { setSortDir(sortDir === "desc" ? "asc" : "desc"); } else { setSortCol(col); setSortDir("desc"); } };
    const sortArrow = (col) => sortCol === col ? (sortDir === "desc" ? " \u25BC" : " \u25B2") : " \u25B7";
    const thSort = (label, col) => React.createElement("th", { onClick: () => handleSort(col), style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === col ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" } }, label + sortArrow(col));

      // Export específico para PCEL: columnas pensadas para la propuesta de
      // compra al cliente + equipo interno.
      const exportToExcelPcel = async () => {
        if (!canEdit) return; // exporta Y persiste snapshot en BD → gate
        const XLSX = await loadSheetJS();
        if (!XLSX) { alert("Error cargando librería Excel"); return; }

        // Diccionario de próximo arribo (de transito_sku, payload tiene fechas)
        const arriboBySku = {};
        (datos.transito || []).forEach(t => {
          if (!t.sku) return;
          arriboBySku[t.sku] = {
            piezas: Number(t.inventario_transito) || 0,
            fecha:  t.siguiente_arribo || null,
          };
        });

        const preciosBySku = datos.preciosBySku || {};

        // Construir filas base (todas las que tienen sugerido > 0)
        const FMT_INT   = "#,##0";
        const FMT_MONEY = '"$"#,##0';

        const baseRows = skuDetail
          .filter(s => {
            // Excluidos del envío: nunca van al Excel
            if (excluidosSku.has(s.sku)) return false;
            const sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
            return sug > 0;
          })
          .map(s => {
            const sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
            const arribo = arriboBySku[s.modelo] || arriboBySku[s.sku] || { piezas: 0, fecha: null };
            const precioOv = precioEdits[s.sku];
            const prec = preciosBySku[s.modelo] || preciosBySku[s.sku] || null;
            const precioFinal = Math.round(precioOv !== undefined ? Number(precioOv) : (prec ? Number(prec.precio_descuento) || 0 : 0));
            const invAct = Number(s.invActeck) || 0;
            const gap = Math.max(0, sug - invAct);
            return { s, sug, precioFinal, invAct, arribo, gap };
          });

        // Separar: los que se surten con stock Acteck actual, y los que dependen del tránsito
        const conStock  = baseRows.filter(r => r.gap === 0);
        const requiereTransito = baseRows.filter(r => r.gap > 0);

        // Helper: construir filas de una hoja
        // Hoja 1: SKU Cliente | SKU Acteck | Descripción | Inv Cliente | Prom 90d | Sugerido | Inv Acteck | Precio | Total
        const buildStockRows = (arr) => arr.map(({ s, sug, precioFinal, invAct }) => ({
          "SKU Cliente":              String(s.sku || ""),
          "SKU Acteck":               s.modelo || "",
          "Descripción":              s.descripcionLarga || s.descripcion || "",
          "Inventario Cliente":       Number(s.stock) || 0,
          "Promedio últimos 90 días": Number(s.promedio90d) || 0,
          "Sugerido":                 sug,
          "Inventario Acteck":        invAct,
          "Precio":                   precioFinal,
          "Total":                    sug * precioFinal,
        }));
        // Hoja 2: SKU Cliente | SKU Acteck | Descripción | Inv Cliente | Prom 90d | Sugerido | Precio | Piezas tránsito | Fecha arribo | Total
        const buildTransitoRows = (arr) => arr.map(({ s, sug, precioFinal, arribo }) => ({
          "SKU Cliente":              String(s.sku || ""),
          "SKU Acteck":               s.modelo || "",
          "Descripción":              s.descripcionLarga || s.descripcion || "",
          "Inventario Cliente":       Number(s.stock) || 0,
          "Promedio últimos 90 días": Number(s.promedio90d) || 0,
          "Sugerido":                 sug,
          "Precio":                   precioFinal,
          "Piezas en tránsito":       Number(arribo.piezas) || 0,
          "Fecha de arribo":          formatFechaES(arribo.fecha || ""),
          "Total":                    sug * precioFinal,
        }));

        // Push fila TOTAL con sumas
        const pushTotalStock = (rows) => {
          const totSug = rows.reduce((a, r) => a + (r.Sugerido || 0), 0);
          const totInvCli = rows.reduce((a, r) => a + (r["Inventario Cliente"] || 0), 0);
          const totInvAct = rows.reduce((a, r) => a + (r["Inventario Acteck"] || 0), 0);
          const totMonto  = rows.reduce((a, r) => a + (Number(r.Total) || 0), 0);
          rows.push({
            "SKU Cliente": "TOTAL",
            "SKU Acteck": "",
            "Descripción": `${rows.length} SKUs`,
            "Inventario Cliente": totInvCli,
            "Promedio últimos 90 días": "",
            "Sugerido": totSug,
            "Inventario Acteck": totInvAct,
            "Precio": "",
            "Total": totMonto,
          });
        };
        const pushTotalTransito = (rows) => {
          const totSug = rows.reduce((a, r) => a + (r.Sugerido || 0), 0);
          const totInvCli = rows.reduce((a, r) => a + (r["Inventario Cliente"] || 0), 0);
          const totTrans = rows.reduce((a, r) => a + (r["Piezas en tránsito"] || 0), 0);
          const totMonto  = rows.reduce((a, r) => a + (Number(r.Total) || 0), 0);
          rows.push({
            "SKU Cliente": "TOTAL",
            "SKU Acteck": "",
            "Descripción": `${rows.length} SKUs`,
            "Inventario Cliente": totInvCli,
            "Promedio últimos 90 días": "",
            "Sugerido": totSug,
            "Precio": "",
            "Piezas en tránsito": totTrans,
            "Fecha de arribo": "",
            "Total": totMonto,
          });
        };

        // Helper: aplicar formato numérico a un worksheet
        const aplicarFormatos = (ws, intCols, moneyCols) => {
          const ref = ws["!ref"];
          if (!ref) return;
          const rng = XLSX.utils.decode_range(ref);
          for (let R = rng.s.r + 1; R <= rng.e.r; R++) {
            for (const C of intCols) {
              const addr = XLSX.utils.encode_cell({ r: R, c: C });
              if (ws[addr] && typeof ws[addr].v === "number") ws[addr].z = FMT_INT;
            }
            for (const C of moneyCols) {
              const addr = XLSX.utils.encode_cell({ r: R, c: C });
              if (ws[addr] && typeof ws[addr].v === "number") ws[addr].z = FMT_MONEY;
            }
          }
        };

        const wb = XLSX.utils.book_new();

        // Hoja 1 — Stock disponible (9 columnas)
        // [SKU Cliente · SKU Acteck · Descripción · Inv Cliente · Prom 90d ·
        //  Sugerido · Inv Acteck · Precio · Total]
        const filasStock = buildStockRows(conStock);
        if (filasStock.length > 0) {
          pushTotalStock(filasStock);
          const ws1 = XLSX.utils.json_to_sheet(filasStock);
          ws1["!cols"] = [
            { wch: 12 }, { wch: 14 }, { wch: 48 }, { wch: 14 }, { wch: 18 },
            { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 14 },
          ];
          // int cols: Inv Cliente(3), Prom 90d(4), Sugerido(5), Inv Acteck(6)
          // money cols: Precio(7), Total(8)
          aplicarFormatos(ws1, [3, 4, 5, 6], [7, 8]);
          XLSX.utils.book_append_sheet(wb, ws1, "Stock disponible");
        }

        // Hoja 2 — Requiere tránsito (10 columnas)
        // [SKU Cliente · SKU Acteck · Descripción · Inv Cliente · Prom 90d ·
        //  Sugerido · Precio · Piezas tránsito · Fecha arribo · Total]
        const filasTrans = buildTransitoRows(requiereTransito);
        if (filasTrans.length > 0) {
          pushTotalTransito(filasTrans);
          const ws2 = XLSX.utils.json_to_sheet(filasTrans);
          ws2["!cols"] = [
            { wch: 12 }, { wch: 14 }, { wch: 48 }, { wch: 14 }, { wch: 18 },
            { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 22 }, { wch: 14 },
          ];
          // int cols: Inv Cliente(3), Prom 90d(4), Sugerido(5), Piezas tránsito(7)
          // money cols: Precio(6), Total(9)
          aplicarFormatos(ws2, [3, 4, 5, 7], [6, 9]);
          XLSX.utils.book_append_sheet(wb, ws2, "Requiere tránsito");
        }

        // Si ninguna hoja tiene filas, fallback a una hoja vacía con encabezado
        if (wb.SheetNames.length === 0) {
          const ws0 = XLSX.utils.json_to_sheet([{ "Mensaje": "No hay SKUs con sugerido > 0" }]);
          XLSX.utils.book_append_sheet(wb, ws0, "Sugerido PCEL");
        }

        // Nombre del archivo: "Sugerido PCEL Abril 2026.xlsx"
        const hoy = new Date();
        const mesesCap = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
        const mesNombre = mesesCap[hoy.getMonth()];
        const anioActual = hoy.getFullYear();
        XLSX.writeFile(wb, `Sugerido PCEL ${mesNombre} ${anioActual}.xlsx`);

        // Para el snapshot del historial: mezclar ambas hojas en un solo array
        const filtradas = [...filasStock.filter(r => r["SKU Cliente"] !== "TOTAL"),
                           ...filasTrans.filter(r => r["SKU Cliente"] !== "TOTAL")];
        const totSug = filtradas.reduce((a, r) => a + (r.Sugerido || 0), 0);
        const totMonto = filtradas.reduce((a, r) => a + (Number(r.Sugerido) || 0) * (Number(r.Precio) || 0), 0);

        // Guardar snapshot en Supabase para historial de propuestas
        try {
          const filasSnapshot = filtradas.filter(r => r["SKU Cliente"] !== "TOTAL");
          const payload = {
            cliente: "pcel",
            filas: filasSnapshot,
            skus_count: filasSnapshot.length,
            piezas_total: totSug,
            monto_total: Math.round(totMonto),
            nota: null,
          };
          const { error } = await supabase.from("propuestas_compra").insert(payload);
          if (error) console.error("guardar propuesta error:", error);
          else await cargarPropuestasCompra();
        } catch (e) { console.error(e); }
      };

      const exportToExcel = async () => {
    if (!canEdit) return;
    if (clienteKey === "pcel") return exportToExcelPcel();
    const XLSX = await loadSheetJS();
    if (!XLSX) { alert("Error cargando librería Excel"); return; }

    // Para Digitalife: precio = AAA c/desc (con override si aplica).
    // Para otros clientes: usa precio_venta como antes.
    const esDigi = clienteKey === "digitalife";

    // 1) Armar filas simplificadas para propuesta al cliente
    const formatFechaESShort = (s) => {
      if (!s) return "";
      try {
        const str = String(s).slice(0, 10);
        const [y, m, d] = str.split("-").map(n => parseInt(n, 10));
        if (!y || !m || !d) return s;
        const meses = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
        return `${d} ${meses[m-1]} ${y}`;
      } catch { return s; }
    };
    // Excluidos del envío: nunca van al Excel
    const skuDetailFiltrado = skuDetail.filter(s => !excluidosSku.has(s.sku));
    const allRows = skuDetailFiltrado.map(function(s) {
      const sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
      const precio = esDigi
        ? (precioEdits[s.sku] !== undefined ? Number(precioEdits[s.sku]) : Number(s.precioAAAcd || 0))
        : Number(s.precio || 0);
      const total = sug * precio;
      return {
        SKU: s.sku,
        "Descripción": s.descripcionLarga || s.descripcion || "",
        "Stock Cliente": Number(s.stock) || 0,
        "Promedio 90d": Number(s.promedio90d) || 0,
        "Sugerido": sug,
        "Precio": precio,
        "Total": total,
        // Metadatos para clasificar y armar la hoja de tránsito
        _sug: sug, _total: total, _cat: (s.categoria || "").trim().toLowerCase(),
        _invActeck: Number(s.invActeck) || 0,
        _arriboPiezas: Number(s.arriboPiezas) || 0,
        _arriboFecha: s.arriboFecha || null,
      };
    }).filter(r => r._sug > 0 && r._total > 0);

    // 2) Separar en 4 hojas:
    //    - "Requiere tránsito": productos SIN inv Acteck (el sugerido depende
    //       100% del tránsito que viene en camino). Van todos juntos sin
    //       importar categoría.
    //    - Resto (con inv Acteck > 0): se clasifican en Monitores / Sillas /
    //       Accesorios (match estricto, consistente con el Rebate).
    const requiereTransito = allRows.filter(r => r._invActeck === 0);
    const resto = allRows.filter(r => r._invActeck > 0);
    const isMonitor = (c) => c === "monitores";
    const isSilla = (c) => c === "sillas";
    const monitores = resto.filter(r => isMonitor(r._cat));
    const sillas = resto.filter(r => isSilla(r._cat));
    const accesorios = resto.filter(r => !isMonitor(r._cat) && !isSilla(r._cat));

    // Helper: aplica formato numérico (XLSX numFmt) a las columnas de la hoja
    // Formato: Dinero → "$#,##0.00" · Piezas (enteras) → "#,##0"
    const FMT_MONEY = '"$"#,##0.00';
    const FMT_INT   = '#,##0';
    const applyNumFmt = (ws, clean) => {
      if (!clean || clean.length === 0) return;
      const headers = Object.keys(clean[0]);
      const moneyCols = new Set(["Precio", "Total", "Total $"]);
      const intCols   = new Set(["Stock Cliente", "Promedio 90d", "Sugerido", "Piezas", "# SKUs"]);
      // Recorrer filas (desde 2 — la 1 es header) y aplicar numFmt por columna
      for (let r = 0; r < clean.length; r++) {
        headers.forEach((h, cIdx) => {
          const addr = XLSX.utils.encode_cell({ c: cIdx, r: r + 1 });
          const cell = ws[addr];
          if (!cell) return;
          if (moneyCols.has(h) && typeof cell.v === "number") { cell.t = "n"; cell.z = FMT_MONEY; }
          else if (intCols.has(h) && typeof cell.v === "number") { cell.t = "n"; cell.z = FMT_INT; }
        });
      }
      // Anchos de columna razonables
      const widthMap = { SKU: 14, "Descripción": 55, "Stock Cliente": 14, "Promedio 90d": 14, "Sugerido": 12, "Precio": 14, "Total": 16, "Categoría": 18, "# SKUs": 10, "Piezas": 12, "Total $": 16 };
      ws["!cols"] = headers.map(h => ({ wch: widthMap[h] || 14 }));
    };

    // Helper: crear hoja con totales
    const makeSheet = (rows, nombre) => {
      const clean = rows.map(r => {
        const o = Object.assign({}, r);
        delete o._sug; delete o._total; delete o._cat;
        delete o._invActeck; delete o._arriboPiezas; delete o._arriboFecha;
        return o;
      });
      if (clean.length > 0) {
        const sumSug = rows.reduce((a, r) => a + r._sug, 0);
        const sumTot = rows.reduce((a, r) => a + r._total, 0);
        clean.push({
          SKU: "TOTAL",
          "Descripción": "",
          "Stock Cliente": "",
          "Promedio 90d": "",
          "Sugerido": sumSug,
          "Precio": "",
          "Total": sumTot,
        });
      } else {
        clean.push({ SKU: "(Sin propuestas en " + nombre + ")", "Descripción": "", "Stock Cliente": "", "Promedio 90d": "", "Sugerido": "", "Precio": "", "Total": "" });
      }
      const ws = XLSX.utils.json_to_sheet(clean);
      applyNumFmt(ws, clean);
      return ws;
    };

    // Helper específico para hoja "Requiere tránsito" — columnas con piezas
    // en tránsito y fecha de arribo (no aplican en las hojas de categoría).
    const makeTransitoSheet = (rows) => {
      if (rows.length === 0) {
        const ws = XLSX.utils.json_to_sheet([{
          SKU: "(Sin productos que dependan 100% del tránsito)",
          "Descripción": "", "Sugerido": "", "Pzs tránsito": "", "Fecha arribo": "", "Precio": "", "Total": "",
        }]);
        return ws;
      }
      const clean = rows.map(r => ({
        SKU: r.SKU,
        "Descripción": r["Descripción"],
        "Sugerido": r._sug,
        "Pzs tránsito": r._arriboPiezas,
        "Fecha arribo": r._arriboFecha ? formatFechaESShort(r._arriboFecha) : "(sin fecha)",
        "Precio": r.Precio,
        "Total": r._total,
      }));
      const sumSug = rows.reduce((a, r) => a + r._sug, 0);
      const sumTot = rows.reduce((a, r) => a + r._total, 0);
      clean.push({ SKU: "TOTAL", "Descripción": "", "Sugerido": sumSug, "Pzs tránsito": "", "Fecha arribo": "", "Precio": "", "Total": sumTot });
      const ws = XLSX.utils.json_to_sheet(clean);
      // Formato numérico específico de esta hoja
      const moneyCols = new Set(["Precio", "Total"]);
      const intCols   = new Set(["Sugerido", "Pzs tránsito"]);
      const headers = Object.keys(clean[0]);
      for (let r = 0; r < clean.length; r++) {
        headers.forEach((h, cIdx) => {
          const addr = XLSX.utils.encode_cell({ c: cIdx, r: r + 1 });
          const cell = ws[addr];
          if (!cell) return;
          if (moneyCols.has(h) && typeof cell.v === "number") { cell.t = "n"; cell.z = '"$"#,##0.00'; }
          else if (intCols.has(h) && typeof cell.v === "number") { cell.t = "n"; cell.z = '#,##0'; }
        });
      }
      ws["!cols"] = [{ wch: 14 }, { wch: 55 }, { wch: 12 }, { wch: 14 }, { wch: 18 }, { wch: 14 }, { wch: 16 }];
      return ws;
    };

    // 3) Hoja Resumen: totales por categoría (+ Requiere tránsito)
    const sumBy = (arr, key) => arr.reduce((a, r) => a + (r[key] || 0), 0);
    const resumenRows = [
      { "Categoría": "Monitores", "# SKUs": monitores.length, "Piezas": sumBy(monitores, "_sug"), "Total $": sumBy(monitores, "_total") },
      { "Categoría": "Sillas", "# SKUs": sillas.length, "Piezas": sumBy(sillas, "_sug"), "Total $": sumBy(sillas, "_total") },
      { "Categoría": "Accesorios", "# SKUs": accesorios.length, "Piezas": sumBy(accesorios, "_sug"), "Total $": sumBy(accesorios, "_total") },
      { "Categoría": "Requiere tránsito", "# SKUs": requiereTransito.length, "Piezas": sumBy(requiereTransito, "_sug"), "Total $": sumBy(requiereTransito, "_total") },
      { "Categoría": "GRAN TOTAL", "# SKUs": allRows.length, "Piezas": sumBy(allRows, "_sug"), "Total $": sumBy(allRows, "_total") },
    ];

    const wb = XLSX.utils.book_new();
    const resumenWs = XLSX.utils.json_to_sheet(resumenRows);
    applyNumFmt(resumenWs, resumenRows);
    XLSX.utils.book_append_sheet(wb, resumenWs, "Resumen");
    XLSX.utils.book_append_sheet(wb, makeSheet(monitores, "Monitores"), "Monitores");
    XLSX.utils.book_append_sheet(wb, makeSheet(sillas, "Sillas"), "Sillas");
    XLSX.utils.book_append_sheet(wb, makeSheet(accesorios, "Accesorios"), "Accesorios");
    XLSX.utils.book_append_sheet(wb, makeTransitoSheet(requiereTransito), "Requiere tránsito");

    // Nombre del archivo: "Sugerido Digitalife Abril 2026.xlsx"
    const hoy = new Date();
    const mesesCap = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const mesNombre = mesesCap[hoy.getMonth()];
    const anioActual = hoy.getFullYear();
    const nombreCliente = clienteKey === "digitalife" ? "Digitalife"
                        : clienteKey === "mercadolibre" ? "Mercado Libre"
                        : (cliente || clienteKey || "Cliente");
    XLSX.writeFile(wb, `Sugerido ${nombreCliente} ${mesNombre} ${anioActual}.xlsx`);

    // 4) Guardar snapshot en propuestas_compra para el ciclo de propuesta
    //    (igual que PCEL): exportar → pendiente → OC → cerrar. Los SKUs
    //    pendientes se ocultan de "SKUs en riesgo de desabasto" mientras.
    if (esDigi) {
      try {
        const filasSnapshot = allRows.map(r => {
          const o = Object.assign({}, r);
          delete o._sug; delete o._total; delete o._cat;
          delete o._invActeck; delete o._arriboPiezas; delete o._arriboFecha;
          return o;
        });
        const totSug = sumBy(allRows, "_sug");
        const totMonto = sumBy(allRows, "_total");
        const payload = {
          cliente: "digitalife",
          filas: filasSnapshot,
          skus_count: filasSnapshot.length,
          piezas_total: totSug,
          monto_total: Math.round(totMonto),
          nota: null,
        };
        const { error } = await supabase.from("propuestas_compra").insert(payload);
        if (error) console.error("guardar propuesta digitalife:", error);
        else await cargarPropuestasCompra();
      } catch (e) { console.error(e); }
    }
  };

  // ———— RENDER ————

  if (!datos && !loading) {
    return React.createElement("div", { className: "max-w-4xl mx-auto p-6" },
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6 mb-6" },
        React.createElement("h2", { className: "text-2xl font-bold text-gray-800 mb-4" }, "Estrategia de Producto"),
        React.createElement("p", { className: "text-gray-600 mb-4" }, "Carga archivos Excel para actualizar datos de Sell In, Sell Out e Inventario."),
        React.createElement("div", { className: "space-y-4" },
          React.createElement("div", {
            className: "border-2 border-dashed border-blue-300 rounded-xl p-6 text-center bg-blue-50 cursor-pointer transition-all hover:border-blue-500",
            onClick: () => document.getElementById("file-input").click(),
          },
            React.createElement("p", { className: "text-blue-700 font-semibold mb-2" }, "📁 Selecciona archivos Excel"),
            React.createElement("p", { className: "text-sm text-gray-600" }, "Reporte Acteck y/o Resumen Digitalife"),
            React.createElement("input", {
              id: "file-input",
              type: "file",
              multiple: true,
              accept: ".xlsx,.xls",
              style: { display: "none" },
              onChange: handleUpload,
            }),
          ),
        ),
        message && React.createElement("p", { className: `mt-4 text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}` }, message),
      ),
    );
  }

  return React.createElement("div", { className: "max-w-none mx-auto p-6 space-y-6" },
    // Header
    React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("div", { className: "flex justify-between items-start mb-4" },
        React.createElement("h2", { className: "text-2xl font-bold text-gray-800" }, "Estrategia de Producto"),
        // Botón de actualizar datos sólo para usuarios con permiso de edición
        canEdit && React.createElement("button", {
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium",
          onClick: () => document.getElementById("file-input-update").click(),
        }, "📤 Actualizar datos"),
        canEdit && React.createElement("input", {
          id: "file-input-update",
          type: "file",
          multiple: true,
          accept: ".xlsx,.xls",
          style: { display: "none" },
          onChange: handleUpload,
        }),
      ),
      message && React.createElement("p", { className: `text-sm ${message.includes("Error") ? "text-red-600" : "text-green-600"}` }, message),
    ),

    // ── Banner de recomendaciones (triggers: stock 0 + faltante cuota + nuevos) ──
    aggs && kpis && skuDetail && (function() {
      const recos = [];
      // Trigger 1: SKUs con stock 0 en cliente + sellout reciente (urgencia desabasto)
      const skusUrgentes = (skuDetail || []).filter((s) =>
        Number(s.stock) === 0 && Number(s.promedio90d) > 0 && (Number(s.invActeck) > 0 || Number(s.invTransito) > 0)
      );
      if (skusUrgentes.length > 0) {
        recos.push({
          id: 'urgentes',
          icon: '🚨',
          color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA',
          titulo: skusUrgentes.length + ' SKUs sin stock con venta reciente',
          desc: 'El cliente está vendiendo estos SKUs pero ya se quedó en cero. Puedes surtir desde Acteck.',
        });
      }
      // Trigger 3: faltante de cuota del mes
      const cuotaMesActual = kpis.cuotaMesActual || 0;
      const siMesActual = kpis.siMesActual || 0;
      const faltaMesAct = Math.max(0, cuotaMesActual - siMesActual);
      if (cuotaMesActual > 0 && faltaMesAct > 0) {
        recos.push({
          id: 'cuota-mes',
          icon: '🎯',
          color: '#92400E', bg: '#FFFBEB', border: '#FDE68A',
          titulo: 'Faltan ' + formatMXN(faltaMesAct) + ' para la cuota del mes',
          desc: 'Abre la tarjeta "Cuota del mes" y usa el botón "Para mes" para que el dashboard te sugiera qué SKUs subir.',
        });
      }
      // Trigger 4: productos nuevos sin propuesta inicial
      const nuevosSinProp = (skusOportunidad && skusOportunidad.nuevos)
        ? skusOportunidad.nuevos.filter((s) => {
            const sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido) || 0;
            return sug === 0;  // no le has propuesto nada todavía
          })
        : [];
      if (nuevosSinProp.length > 0) {
        recos.push({
          id: 'nuevos',
          icon: '🆕',
          color: '#065F46', bg: '#ECFDF5', border: '#A7F3D0',
          titulo: nuevosSinProp.length + ' productos nuevos para empujar',
          desc: 'Llegan en tránsito y el cliente nunca los ha comprado. Asígnales una cantidad inicial en "Oportunidades de venta".',
        });
      }
      const visibles = recos.filter((r) => !recoDescartadas.has(r.id));
      if (visibles.length === 0) return null;
      return React.createElement('div', { style: { display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 4 } },
        visibles.map((r) =>
          React.createElement('div', {
            key: r.id,
            style: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', background: r.bg, border: '1px solid ' + r.border, borderRadius: 10 }
          },
            React.createElement('span', { style: { fontSize: 22, lineHeight: 1 } }, r.icon),
            React.createElement('div', { style: { flex: 1, minWidth: 0 } },
              React.createElement('p', { style: { fontSize: 13, fontWeight: 700, color: r.color, margin: 0 } }, r.titulo),
              React.createElement('p', { style: { fontSize: 11, color: r.color, opacity: 0.85, margin: '2px 0 0' } }, r.desc)
            ),
            React.createElement('button', {
              onClick: () => descartarReco(r.id),
              title: 'Descartar — vuelve a aparecer mañana',
              style: { padding: '4px 10px', background: 'transparent', color: r.color, border: '1px solid ' + r.border, borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }
            }, '✓ Entendido')
          )
        )
      );
    })(),

    // ── 5 KPIs que apoyan el sugerido + strip mensual de cuotas ──
    // 1) SKUs en riesgo · 2) Total a sugerir · 3) Cuota del mes · 4) Cumplimiento YTD · 5) Último envío
    aggs && kpis && (function(){
      const cliCfg = clienteKey === 'pcel' ? { cadenciaDias: 14, label: 'PCEL (cada 2 sem)' } : { cadenciaDias: 7, label: 'Digitalife (sem)' };
      const MESES_LBL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
      // 1) SKUs en riesgo
      const numRiesgo = skusRiesgo.length;
      const piezasUrgentes = skusRiesgo.reduce((a, s) => a + (s.sugerido || 0), 0);
      // 2) Total a sugerir — derivado del Detalle por SKU (fuente de verdad)
      const sugMonto = (kpisSugerido && kpisSugerido.sugMonto) || 0;
      const sugPiezas = (kpisSugerido && kpisSugerido.sugPiezas) || 0;
      const sugSkus = (kpisSugerido && kpisSugerido.sugSkus) || 0;
      // 3) Cuota del mes — si el mes actual aún no tiene sell-in cargado,
      // usamos el último mes con datos (avisamos al usuario en el subtítulo).
      const mesActualReal = new Date().getMonth() + 1;
      let mesParaTarjeta = mesActualReal;
      let cuotaMes = kpis.cuotaMesActual || 0;
      let siMes = kpis.siMesActual || 0;
      let mesEsActualReal = true;
      if (siMes === 0 && kpis.cumplimientoMensual) {
        // Buscar el último mes con sell-in registrado
        const ultimoConDatos = [...kpis.cumplimientoMensual]
          .filter(m => m.sellIn > 0 && !m.esFuturo)
          .sort((a, b) => b.mes - a.mes)[0];
        if (ultimoConDatos) {
          mesParaTarjeta = ultimoConDatos.mes;
          mesEsActualReal = false;
          siMes = ultimoConDatos.sellIn;
          cuotaMes = ultimoConDatos.cuota;
        }
      }
      const pctMes = cuotaMes > 0 ? (siMes / cuotaMes) * 100 : null;
      const faltaMes = cuotaMes > 0 ? Math.max(0, cuotaMes - siMes) : 0;
      // 4) Cumplimiento YTD
      const cumplPct = (kpis.cuotaYTD && kpis.cuotaYTD > 0) ? (kpis.siYTD / kpis.cuotaYTD) * 100 : null;
      // 5) Último envío
      const ultPropuesta = (propuestasHist || []).slice().sort((a,b)=>{
        const fa = new Date(a.fecha_propuesta || a.created_at).getTime();
        const fb = new Date(b.fecha_propuesta || b.created_at).getTime();
        return fb - fa;
      })[0];
      const diasSinEnviar = ultPropuesta
        ? Math.floor((Date.now() - new Date(ultPropuesta.fecha_propuesta || ultPropuesta.created_at).getTime()) / 86400000)
        : null;
      const cadenciaVencida = diasSinEnviar != null && diasSinEnviar >= cliCfg.cadenciaDias;

      return React.createElement('div', null,
        // ── Grid de 5 tarjetas ──
        React.createElement('div', {
          style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }
        },
          // 1) SKUs en riesgo
          React.createElement('div', {
            className: 'bg-white rounded-xl shadow-sm p-4 border-t-4',
            style: { borderColor: numRiesgo > 0 ? '#EF4444' : '#10B981' }
          },
            React.createElement('p', { style: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 } }, '\uD83D\uDD34 SKUs en riesgo'),
            React.createElement('p', { style: { fontSize: 28, fontWeight: 700, color: numRiesgo > 0 ? '#B91C1C' : '#065F46', marginBottom: 2 } }, numRiesgo.toLocaleString('es-MX')),
            React.createElement('p', { style: { fontSize: 11, color: '#64748B' } },
              piezasUrgentes > 0
                ? (piezasUrgentes.toLocaleString('es-MX') + ' pzs sugeridas urgentes')
                : (numRiesgo === 0 ? '✓ Sin riesgo de desabasto' : 'Sin sugerido (revisar Acteck)'))
          ),
          // 2) Total a sugerir
          React.createElement('div', {
            className: 'bg-white rounded-xl shadow-sm p-4 border-t-4',
            style: { borderColor: '#10B981', background: sugMonto > 0 ? '#F0FDF4' : '#fff' }
          },
            React.createElement('p', { style: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 } }, '\uD83D\uDCE6 Total a sugerir'),
            React.createElement('p', { style: { fontSize: 22, fontWeight: 700, color: sugMonto > 0 ? '#047857' : '#94A3B8', marginBottom: 2 } }, formatMXN(sugMonto)),
            React.createElement('p', { style: { fontSize: 11, color: '#64748B' } }, sugSkus + ' SKUs · ' + sugPiezas.toLocaleString('es-MX') + ' pzs')
          ),
          // 3) Cuota del mes (clickable → expande detalle Q)
          React.createElement('div', {
            className: 'bg-white rounded-xl shadow-sm p-4 border-t-4',
            style: {
              borderColor: pctMes == null ? '#94A3B8' : pctMes >= 100 ? '#10B981' : pctMes >= 70 ? '#F59E0B' : '#EF4444',
              cursor: 'pointer',
              outline: kpiAbierto === 'cuotaMes' ? '2px solid #1E40AF' : 'none',
            },
            onClick: () => setKpiAbierto(kpiAbierto === 'cuotaMes' ? null : 'cuotaMes'),
            title: 'Click para ver detalle del mes y trimestre'
          },
            React.createElement('p', { style: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 } },
              '\uD83D\uDCC8 Cuota ' + MESES_LBL[mesParaTarjeta - 1] + (mesEsActualReal ? '' : ' (último con datos)') + (kpiAbierto === 'cuotaMes' ? ' ▾' : ' ▸')),
            React.createElement('p', { style: { fontSize: 22, fontWeight: 700, color: pctMes == null ? '#94A3B8' : pctMes >= 100 ? '#047857' : pctMes >= 70 ? '#B45309' : '#B91C1C', marginBottom: 2 } },
              pctMes == null
                ? 'Sin cuota'
                : faltaMes > 0
                  ? ('Faltan ' + formatMXN(faltaMes))
                  : '✓ Cumplida'),
            React.createElement('p', { style: { fontSize: 11, color: '#64748B' } },
              pctMes == null
                ? ''
                : (pctMes.toFixed(0) + '% · ' + formatMXN(siMes) + ' / ' + formatMXN(cuotaMes)))
          ),
          // 4) Cumplimiento YTD (clickable → expande detalle YTD)
          React.createElement('div', {
            className: 'bg-white rounded-xl shadow-sm p-4 border-t-4',
            style: {
              borderColor: cumplPct == null ? '#94A3B8' : cumplPct >= 90 ? '#10B981' : cumplPct >= 70 ? '#F59E0B' : '#EF4444',
              cursor: 'pointer',
              outline: kpiAbierto === 'cumplYTD' ? '2px solid #1E40AF' : 'none',
            },
            onClick: () => setKpiAbierto(kpiAbierto === 'cumplYTD' ? null : 'cumplYTD'),
            title: 'Click para ver detalle YTD'
          },
            React.createElement('p', { style: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 } }, '\uD83C\uDFAF Cumplimiento YTD' + (kpiAbierto === 'cumplYTD' ? ' ▾' : ' ▸')),
            React.createElement('p', { style: { fontSize: 22, fontWeight: 700, color: cumplPct == null ? '#94A3B8' : cumplPct >= 90 ? '#047857' : cumplPct >= 70 ? '#B45309' : '#B91C1C', marginBottom: 2 } },
              cumplPct == null ? 'Sin cuota' : cumplPct.toFixed(0) + '%'),
            React.createElement('p', { style: { fontSize: 11, color: '#64748B' } },
              kpis.cuotaYTD ? formatMXN(kpis.siYTD || 0) + ' / ' + formatMXN(kpis.cuotaYTD) : '')
          ),
          // 5) Último envío
          React.createElement('div', {
            className: 'bg-white rounded-xl shadow-sm p-4 border-t-4',
            style: { borderColor: cadenciaVencida ? '#EF4444' : '#06B6D4' }
          },
            React.createElement('p', { style: { fontSize: 10, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4, fontWeight: 600 } }, '\uD83D\uDCC5 Último envío'),
            React.createElement('p', { style: { fontSize: 22, fontWeight: 700, color: cadenciaVencida ? '#B91C1C' : '#0E7490', marginBottom: 2 } },
              ultPropuesta
                ? (diasSinEnviar === 0 ? 'Hoy' : (diasSinEnviar + ' días'))
                : 'Nunca'),
            React.createElement('p', { style: { fontSize: 11, color: cadenciaVencida ? '#B91C1C' : '#64748B', fontWeight: cadenciaVencida ? 600 : 400 } },
              ultPropuesta
                ? (cadenciaVencida ? '⚠ Toca enviar (' + cliCfg.label + ')' : 'Cadencia: ' + cliCfg.label)
                : 'Cadencia: ' + cliCfg.label)
          )
        ),
        // ── Panel desplegable: detalle de Cuota mes (con info trimestre) ──
        kpiAbierto === 'cuotaMes' && kpis.qActualData && React.createElement('div', {
          className: 'bg-white rounded-xl shadow-sm p-4 mt-3',
          style: { borderLeft: '4px solid #F59E0B' }
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 } },
            React.createElement('p', { style: { fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' } },
              'Detalle ' + MESES_LBL[mesParaTarjeta - 1] + ' + Q' + kpis.trimestreActual),
            React.createElement('button', { onClick: () => setKpiAbierto(null), style: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16 }, title: 'Cerrar' }, '✕')
          ),
          // Grid de 2 columnas: mes vs trimestre
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
            // ─── Columna MES ───
            React.createElement('div', { style: { padding: 14, background: '#FFFBEB', borderRadius: 10, border: '1px solid #FDE68A' } },
              React.createElement('p', { style: { fontSize: 11, fontWeight: 700, color: '#92400E', marginBottom: 8 } }, '📅 ' + MESES_LBL[mesParaTarjeta - 1]),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                React.createElement('span', { style: { color: '#475569' } }, 'Cuota mín.:'),
                React.createElement('span', { style: { fontWeight: 600, color: '#1E293B' } }, formatMXN(cuotaMes))
              ),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                React.createElement('span', { style: { color: '#475569' } }, 'Sell-In real:'),
                React.createElement('span', { style: { fontWeight: 600, color: '#1E40AF' } }, formatMXN(siMes))
              ),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 6, borderTop: '1px solid #FDE68A', marginTop: 4 } },
                React.createElement('span', { style: { fontWeight: 700, color: faltaMes > 0 ? '#B91C1C' : '#065F46' } }, faltaMes > 0 ? 'Falta:' : '✓ Cumplida'),
                React.createElement('span', { style: { fontWeight: 800, color: faltaMes > 0 ? '#B91C1C' : '#065F46' } }, faltaMes > 0 ? formatMXN(faltaMes) : (pctMes ? pctMes.toFixed(0) + '%' : ''))
              )
            ),
            // ─── Columna Q (trimestre) ───
            React.createElement('div', { style: { padding: 14, background: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE' } },
              React.createElement('p', { style: { fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 8 } },
                '📊 Q' + kpis.trimestreActual + ' (' + kpis.qActualData.meses.map(m => MESES_LBL[m-1]).join('-') + ')'),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                React.createElement('span', { style: { color: '#475569' } }, 'Cuota Q total:'),
                React.createElement('span', { style: { fontWeight: 600, color: '#1E293B' } }, formatMXN(kpis.qActualData.cuota))
              ),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                React.createElement('span', { style: { color: '#475569' } }, 'Vendido Q (acum.):'),
                React.createElement('span', { style: { fontWeight: 600, color: '#1E40AF' } }, formatMXN(kpis.qActualData.sellInAcumulado))
              ),
              React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 6, borderTop: '1px solid #BFDBFE', marginTop: 4 } },
                React.createElement('span', { style: { fontWeight: 700, color: kpis.qActualData.falta > 0 ? '#B91C1C' : '#065F46' } }, kpis.qActualData.falta > 0 ? 'Falta para Q:' : '✓ Q cumplido'),
                React.createElement('span', { style: { fontWeight: 800, color: kpis.qActualData.falta > 0 ? '#B91C1C' : '#065F46' } },
                  kpis.qActualData.falta > 0 ? formatMXN(kpis.qActualData.falta) : (kpis.qActualData.pct != null ? kpis.qActualData.pct.toFixed(0) + '%' : ''))
              )
            )
          ),
          // Botones de calculadora reversa
          React.createElement('div', { style: { marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' } },
            React.createElement('span', { style: { fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.04em' } }, '🎯 Sugerencia para llegar a la meta:'),
            faltaMes > 0 && React.createElement('button', {
              onClick: () => calcularParaCuota('mes'),
              title: 'Calcula qué SKUs subir al sugerido agresivo para cubrir el gap del mes',
              style: { padding: '6px 12px', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
            }, 'Para mes (' + formatMXN(faltaMes) + ')'),
            kpis.qActualData && kpis.qActualData.falta > 0 && React.createElement('button', {
              onClick: () => calcularParaCuota('q'),
              title: 'Calcula qué SKUs subir al sugerido agresivo para cubrir el gap del Q',
              style: { padding: '6px 12px', background: '#DBEAFE', color: '#1E40AF', border: '1px solid #BFDBFE', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer' }
            }, 'Para Q (' + formatMXN(kpis.qActualData.falta) + ')'),
            (faltaMes <= 0 && (!kpis.qActualData || kpis.qActualData.falta <= 0)) && React.createElement('span', { style: { fontSize: 11, color: '#065F46', fontStyle: 'italic' } }, '✓ Mes y Q al día — no falta nada')
          ),
          // Tabla pequeña con los 4 trimestres
          React.createElement('div', { style: { marginTop: 14 } },
            React.createElement('p', { style: { fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 } }, 'Resumen por trimestre'),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 } },
              kpis.cuotasQ.map((q) => {
                const isAct = q.esActual;
                const ok = q.pct != null && q.pct >= 100;
                const bg = q.cuota === 0 ? '#F1F5F9'
                  : ok ? '#D1FAE5'
                  : (q.pct != null && q.pct >= 70) ? '#FEF3C7'
                  : '#FEE2E2';
                return React.createElement('div', {
                  key: q.q,
                  style: { padding: 10, background: bg, borderRadius: 8, border: isAct ? '2px solid #1E40AF' : '1px solid #E2E8F0', textAlign: 'center' }
                },
                  React.createElement('p', { style: { fontSize: 10, fontWeight: 600, color: '#475569', marginBottom: 4 } }, 'Q' + q.q),
                  React.createElement('p', { style: { fontSize: 14, fontWeight: 700, color: '#1E293B' } },
                    q.pct == null ? '—' : q.pct.toFixed(0) + '%'),
                  React.createElement('p', { style: { fontSize: 9, color: '#64748B', marginTop: 2 } },
                    formatMXN(q.cuota))
                );
              })
            )
          )
        ),
        // ── Panel desplegable: detalle Cumplimiento YTD ──
        kpiAbierto === 'cumplYTD' && React.createElement('div', {
          className: 'bg-white rounded-xl shadow-sm p-4 mt-3',
          style: { borderLeft: '4px solid #1E40AF' }
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 12 } },
            React.createElement('p', { style: { fontSize: 12, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Detalle YTD ' + new Date().getFullYear()),
            React.createElement('button', { onClick: () => setKpiAbierto(null), style: { background: 'transparent', border: 'none', cursor: 'pointer', color: '#94A3B8', fontSize: 16 }, title: 'Cerrar' }, '✕')
          ),
          (function(){
            const cuotaTotal = (kpis.cuotasQ || []).reduce((s, q) => s + (q.cuota || 0), 0);
            const faltaYTD = Math.max(0, (kpis.cuotaYTD || 0) - (kpis.siYTD || 0));
            const faltaAnio = Math.max(0, cuotaTotal - (kpis.siYTD || 0));
            return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 } },
              // YTD
              React.createElement('div', { style: { padding: 14, background: '#EFF6FF', borderRadius: 10, border: '1px solid #BFDBFE' } },
                React.createElement('p', { style: { fontSize: 11, fontWeight: 700, color: '#1E40AF', marginBottom: 8 } }, '📈 YTD (Ene-' + MESES_LBL[mesActualReal - 1] + ')'),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                  React.createElement('span', { style: { color: '#475569' } }, 'Cuota YTD:'),
                  React.createElement('span', { style: { fontWeight: 600, color: '#1E293B' } }, formatMXN(kpis.cuotaYTD || 0))
                ),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                  React.createElement('span', { style: { color: '#475569' } }, 'Sell-In YTD:'),
                  React.createElement('span', { style: { fontWeight: 600, color: '#1E40AF' } }, formatMXN(kpis.siYTD || 0))
                ),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 6, borderTop: '1px solid #BFDBFE', marginTop: 4 } },
                  React.createElement('span', { style: { fontWeight: 700, color: faltaYTD > 0 ? '#B91C1C' : '#065F46' } }, faltaYTD > 0 ? 'Falta:' : '✓ Al día'),
                  React.createElement('span', { style: { fontWeight: 800, color: faltaYTD > 0 ? '#B91C1C' : '#065F46' } }, faltaYTD > 0 ? formatMXN(faltaYTD) : '')
                )
              ),
              // Anual
              React.createElement('div', { style: { padding: 14, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' } },
                React.createElement('p', { style: { fontSize: 11, fontWeight: 700, color: '#475569', marginBottom: 8 } }, '🎯 Anual (12 meses)'),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                  React.createElement('span', { style: { color: '#475569' } }, 'Cuota anual:'),
                  React.createElement('span', { style: { fontWeight: 600, color: '#1E293B' } }, formatMXN(cuotaTotal))
                ),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 } },
                  React.createElement('span', { style: { color: '#475569' } }, 'Vendido (YTD):'),
                  React.createElement('span', { style: { fontWeight: 600, color: '#1E40AF' } }, formatMXN(kpis.siYTD || 0))
                ),
                React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', fontSize: 14, paddingTop: 6, borderTop: '1px solid #E2E8F0', marginTop: 4 } },
                  React.createElement('span', { style: { fontWeight: 700, color: faltaAnio > 0 ? '#B91C1C' : '#065F46' } }, 'Falta para meta:'),
                  React.createElement('span', { style: { fontWeight: 800, color: faltaAnio > 0 ? '#B91C1C' : '#065F46' } }, formatMXN(faltaAnio))
                )
              )
            );
          })()
        ),
        // ── Mini banner: % acierto últimas propuestas ──
        aciertoPromedio && React.createElement('div', {
          style: { display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', background: aciertoPromedio.pct >= 70 ? '#F0FDF4' : aciertoPromedio.pct >= 50 ? '#FFFBEB' : '#FEF2F2', border: '1px solid ' + (aciertoPromedio.pct >= 70 ? '#A7F3D0' : aciertoPromedio.pct >= 50 ? '#FDE68A' : '#FECACA'), borderRadius: 10, marginTop: 8 }
        },
          React.createElement('span', { style: { fontSize: 18 } }, aciertoPromedio.pct >= 70 ? '🎯' : aciertoPromedio.pct >= 50 ? '📊' : '⚠'),
          React.createElement('div', { style: { flex: 1 } },
            React.createElement('p', { style: { fontSize: 13, fontWeight: 700, color: aciertoPromedio.pct >= 70 ? '#065F46' : aciertoPromedio.pct >= 50 ? '#92400E' : '#991B1B', margin: 0 } },
              'Acierto promedio: ' + aciertoPromedio.pct.toFixed(0) + '% (últimas ' + aciertoPromedio.n + ' propuestas)'),
            React.createElement('p', { style: { fontSize: 11, color: '#64748B', margin: '2px 0 0' } },
              'De lo que sugeriste, qué % efectivamente compró el cliente. Detalle abajo en "Propuestas exportadas".')
          )
        ),
        // ── Strip mensual: 12 meses con cumplimiento de cuota ──
        kpis.cumplimientoMensual && kpis.cumplimientoMensual.some(m => m.cuota > 0) && React.createElement('div', {
          className: 'bg-white rounded-xl shadow-sm p-4 mt-3'
        },
          React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 } },
            React.createElement('p', { style: { fontSize: 11, color: '#475569', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' } }, 'Cumplimiento mensual'),
            React.createElement('p', { style: { fontSize: 10, color: '#94A3B8' } }, 'Cuota mín. vs Sell-In real · ' + new Date().getFullYear())
          ),
          React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 6 } },
            kpis.cumplimientoMensual.map((m) => {
              const isFut = m.esFuturo;
              const isAct = m.esActual;
              const isOk = m.pct != null && m.pct >= 100;
              const isNear = m.pct != null && m.pct >= 70 && m.pct < 100;
              const isLow = m.pct != null && m.pct < 70;
              const bg = isFut ? '#F8FAFC'
                : m.cuota === 0 ? '#F1F5F9'
                : isOk ? '#D1FAE5'
                : isNear ? '#FEF3C7'
                : '#FEE2E2';
              const txt = isFut ? '#94A3B8'
                : m.cuota === 0 ? '#94A3B8'
                : isOk ? '#065F46'
                : isNear ? '#B45309'
                : '#B91C1C';
              return React.createElement('div', {
                key: m.mes,
                style: {
                  background: bg,
                  border: isAct ? '2px solid #1E40AF' : '1px solid #E2E8F0',
                  borderRadius: 8,
                  padding: '8px 4px',
                  textAlign: 'center',
                },
                title: m.cuota === 0
                  ? MESES_LBL[m.mes-1] + ': sin cuota'
                  : MESES_LBL[m.mes-1] + ': ' + formatMXN(m.sellIn) + ' / ' + formatMXN(m.cuota) + ' (' + (m.pct != null ? m.pct.toFixed(0) + '%' : '—') + ')',
              },
                React.createElement('p', { style: { fontSize: 10, color: '#64748B', fontWeight: 600, marginBottom: 2 } }, MESES_LBL[m.mes-1]),
                React.createElement('p', { style: { fontSize: 13, fontWeight: 700, color: txt, lineHeight: 1.1 } },
                  isFut ? '—' : (m.cuota === 0 ? '—' : (isOk ? '✓' : (m.pct != null ? m.pct.toFixed(0) + '%' : '—'))))
              );
            })
          )
        )
      );
    })(),

      // ═══ SECCIÓN OPORTUNIDAD (productos nuevos + no vendidos al cliente) ═══
      // Ayuda al desarrollo de cuenta detectando qué SKUs aún no le has propuesto
      // al cliente. Dos sub-tabs:
      //   🆕 Nuevos — en tránsito, primera vez que llegan
      //   🎯 No vendidos — ya hay stock pero nunca le has facturado
      datos && skusOportunidad && (skusOportunidad.nuevos.length > 0 || skusOportunidad.noVendidos.length > 0) &&
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm" },
        // Header colapsable
        React.createElement("button", {
          onClick: () => setOportunidadAbierta(!oportunidadAbierta),
          style: { width: "100%", padding: "16px 20px", display: "flex", alignItems: "center", gap: 10, background: "transparent", border: "none", cursor: "pointer", textAlign: "left", fontSize: 16, fontWeight: 700, color: "#1E293B" }
        },
          React.createElement("span", null, oportunidadAbierta ? "▾" : "▸"),
          React.createElement("span", null, "🚀 Oportunidades de venta"),
          React.createElement("span", { style: { marginLeft: "auto", fontSize: 12, color: "#64748B", fontWeight: 400 } },
            skusOportunidad.nuevos.length + " nuevos · " + skusOportunidad.noVendidos.length + " sin venderle aún")
        ),
        oportunidadAbierta && React.createElement("div", { style: { padding: "0 20px 20px" } },
          // Tabs
          React.createElement("div", { style: { display: "flex", gap: 4, borderBottom: "1px solid #E2E8F0", marginBottom: 12 } },
            React.createElement("button", {
              onClick: () => setOportunidadTab('nuevos'),
              style: {
                padding: "8px 14px", border: "none", background: "transparent",
                borderBottom: "2px solid " + (oportunidadTab === 'nuevos' ? "#1E40AF" : "transparent"),
                color: oportunidadTab === 'nuevos' ? "#1E40AF" : "#64748B",
                fontWeight: oportunidadTab === 'nuevos' ? 700 : 500, fontSize: 13, cursor: "pointer"
              }
            }, "🆕 Productos nuevos (" + skusOportunidad.nuevos.length + ")"),
            React.createElement("button", {
              onClick: () => setOportunidadTab('noVendidos'),
              style: {
                padding: "8px 14px", border: "none", background: "transparent",
                borderBottom: "2px solid " + (oportunidadTab === 'noVendidos' ? "#1E40AF" : "transparent"),
                color: oportunidadTab === 'noVendidos' ? "#1E40AF" : "#64748B",
                fontWeight: oportunidadTab === 'noVendidos' ? 700 : 500, fontSize: 13, cursor: "pointer"
              }
            }, "🎯 Sin venderle aún (" + skusOportunidad.noVendidos.length + ")")
          ),
          // Descripción del tab activo
          React.createElement("p", { style: { fontSize: 12, color: "#64748B", marginBottom: 12, fontStyle: "italic" } },
            oportunidadTab === 'nuevos'
              ? "SKUs en tránsito que aún no llegan a Acteck y que el cliente nunca ha comprado. Tú decides la cantidad inicial a sugerir."
              : "SKUs en stock Acteck que el cliente nunca ha comprado. Oportunidades para ampliar el catálogo del cliente."),
          // Tabla
          (function() {
            const lista = oportunidadTab === 'nuevos' ? skusOportunidad.nuevos : skusOportunidad.noVendidos;
            if (lista.length === 0) {
              return React.createElement("div", { style: { padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13, background: "#F8FAFC", borderRadius: 8 } },
                oportunidadTab === 'nuevos' ? "Sin productos nuevos en tránsito todavía." : "Le has vendido todos los SKUs disponibles 🎉");
            }
            return React.createElement("div", { style: { overflowX: "auto", maxHeight: 300, overflowY: "auto", border: "1px solid #E2E8F0", borderRadius: 8 } },
              React.createElement("table", { style: { width: "100%", fontSize: 12, borderCollapse: "collapse" } },
                React.createElement("thead", null,
                  React.createElement("tr", { style: { background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0 } },
                    React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "SKU"),
                    React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Roadmap"),
                    React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Descripción"),
                    React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } },
                      oportunidadTab === 'nuevos' ? "Tránsito" : "Inv Acteck"),
                    React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Precio AAA"),
                    React.createElement("th", { style: { width: 130 } })
                  )
                ),
                React.createElement("tbody", null,
                  lista.slice(0, 100).map((s, idx) => {
                    const cantidad = oportunidadTab === 'nuevos' ? Number(s.invTransito) : Number(s.invActeck);
                    const precio = Number(s.precioAAAcd) > 0 ? Number(s.precioAAAcd) : Number(s.precio) || 0;
                    return React.createElement("tr", { key: s.sku, style: { borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFC" } },
                      React.createElement("td", { style: { padding: "8px 10px", fontFamily: "ui-monospace,monospace", fontWeight: 600, color: "#1E293B" } }, s.sku),
                      React.createElement("td", { style: { padding: "8px 10px" } },
                        s.roadmap && (function() {
                          const rmS = roadmapStyle(s.roadmap);
                          return React.createElement("span", {
                            style: { padding: "2px 6px", borderRadius: 4, background: rmS.bg, color: rmS.color, fontSize: 10, fontWeight: 700 }
                          }, s.roadmap);
                        })()
                      ),
                      React.createElement("td", { style: { padding: "8px 10px", color: "#475569", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.descripcion },
                        (s.descripcion || "").slice(0, 60)),
                      React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", color: "#1E293B", fontWeight: 600 } }, cantidad.toLocaleString("es-MX")),
                      React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", color: "#1E40AF" } }, precio > 0 ? formatMXN(precio) : "—"),
                      React.createElement("td", { style: { padding: "6px 10px", textAlign: "right" } },
                        canEdit && React.createElement("button", {
                          onClick: () => {
                            // Abre el modal de propuesta personalizada (o si ya está abierto, agrega)
                            if (!propPersonalizada) {
                              abrirPropPersonalizada();
                              setTimeout(() => agregarSkuAPropPersonalizada(s), 50);
                            } else {
                              agregarSkuAPropPersonalizada(s);
                            }
                          },
                          title: "Agregar a propuesta personalizada para sugerir cantidad",
                          style: { padding: "4px 10px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600, cursor: "pointer" }
                        }, "+ Proponer")
                      )
                    );
                  })
                )
              )
            );
          })()
        )
      ),

          // SKU Detail - Full Table
      (function() {
        // Guard: datos puede ser null en el render inicial (antes de cargar)
        if (!datos) return null;
        // Lista de categorías disponibles desde productos_cliente (ordenadas alfabéticamente)
        const categoriasUnicas = Array.from(new Set((datos.productos || []).map(p => p.categoria).filter(Boolean))).sort();
        return React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
          React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 } },
            React.createElement("h3", { className: "font-bold text-gray-800" },
              "Detalle por SKU",
              categoriaFilter && React.createElement("span", { style: { fontSize: 12, color: "#64748B", fontWeight: 400, marginLeft: 8 } }, "\u00b7 " + categoriaFilter + " (" + skuDetail.length + " SKUs)")
            ),
            React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
              React.createElement("select", {
                value: categoriaFilter,
                onChange: function(e) { setCategoriaFilter(e.target.value); },
                style: { padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, background: "#fff", cursor: "pointer", minWidth: 160 }
              },
                React.createElement("option", { value: "" }, "Todas las categor\u00edas"),
                categoriasUnicas.map(c => React.createElement("option", { key: c, value: c }, c))
              ),
              React.createElement("input", {
                type: "text", placeholder: "Buscar SKU o descripci\u00f3n...",
                value: searchFilter,
                onChange: function(e) { setSearchFilter(e.target.value); },
                style: { padding: "6px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, width: 220 }
              }),
              // Toggle "Solo activos" — sólo PCEL
              (clienteKey === "pcel") && React.createElement("label", {
                style: { display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569", cursor: "pointer", userSelect: "none", padding: "6px 10px", border: "1px solid #E2E8F0", borderRadius: 8, background: soloActivosPcel ? "#EEF2FF" : "#fff" }
              },
                React.createElement("input", {
                  type: "checkbox", checked: soloActivosPcel,
                  onChange: function(e) { setSoloActivosPcel(e.target.checked); },
                  style: { cursor: "pointer" }
                }),
                "Solo activos"
              ),
              // Exportar Excel guarda snapshot en propuestas_compra → requiere edición
              canEdit && React.createElement("button", {
                onClick: exportToExcel,
                style: { padding: "8px 16px", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }
              }, "\uD83D\uDCE5 Exportar Excel"),
            ),
          ),

          // ═══ TOOLBAR DE SUGERIDO EN BULK ═══
          // Botones para aplicar fórmula de cobertura: Mínimo (60d), Normal (90d), Agresivo (120d)
          // Modificadores: Aplicar a filtrados, Solo SKUs sin stock
          // Acciones: Reiniciar, Deshacer
          canEdit && React.createElement("div", {
            style: {
              display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center",
              padding: 10, marginBottom: 12, borderRadius: 8,
              background: "#F8FAFC", border: "1px solid #E2E8F0"
            }
          },
            React.createElement("span", { style: { fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginRight: 4 } }, "\uD83C\uDFC1 Sugerido en bulk:"),
            // Mínimo (60d)
            React.createElement("button", {
              onClick: () => previewBulk('minimo', 2),
              title: "Recalcula con cobertura objetivo de 2 meses (60 días). Lo justo.",
              style: { padding: "6px 12px", background: "#fff", color: "#065F46", border: "1px solid #6EE7B7", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }
            }, "\uD83D\uDFE2 Mínimo (60d)"),
            // Normal (90d)
            React.createElement("button", {
              onClick: () => previewBulk('normal', 3),
              title: "Cobertura objetivo de 3 meses (90 días). Recomendado.",
              style: { padding: "6px 12px", background: "#fff", color: "#1E40AF", border: "1px solid #93C5FD", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }
            }, "\uD83D\uDFE1 Normal (90d)"),
            // Agresivo (120d)
            React.createElement("button", {
              onClick: () => previewBulk('agresivo', 4),
              title: "Cobertura objetivo de 4 meses (120 días). Empuja stock al cliente.",
              style: { padding: "6px 12px", background: "#fff", color: "#B91C1C", border: "1px solid #FCA5A5", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }
            }, "\uD83D\uDD34 Agresivo (120d)"),
            // Separador
            React.createElement("span", { style: { width: 1, height: 22, background: "#E2E8F0" } }),
            // Reiniciar
            React.createElement("button", {
              onClick: () => previewBulk('reiniciar', null),
              title: "Borra todos los overrides manuales. Vuelve al sugerido auto-calculado.",
              style: { padding: "6px 12px", background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }
            }, "↻ Reiniciar"),
            // Deshacer (sólo si hay snapshot)
            React.createElement("button", {
              onClick: deshacerBulk,
              disabled: !undoSnapshot,
              title: undoSnapshot ? ("Deshacer: " + undoSnapshot.etiqueta) : "Nada que deshacer",
              style: {
                padding: "6px 12px",
                background: undoSnapshot ? "#FFFBEB" : "#F1F5F9",
                color: undoSnapshot ? "#92400E" : "#94A3B8",
                border: "1px solid " + (undoSnapshot ? "#FDE68A" : "#E2E8F0"),
                borderRadius: 6, fontSize: 12, fontWeight: 600,
                cursor: undoSnapshot ? "pointer" : "not-allowed"
              }
            }, "↶ Deshacer"),
            // Modificadores
            React.createElement("span", { style: { width: 1, height: 22, background: "#E2E8F0" } }),
            React.createElement("label", {
              style: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", cursor: "pointer", userSelect: "none", padding: "4px 8px", borderRadius: 6, background: bulkSoloFiltrados ? "#EEF2FF" : "transparent" }
            },
              React.createElement("input", {
                type: "checkbox", checked: bulkSoloFiltrados,
                onChange: (e) => setBulkSoloFiltrados(e.target.checked),
                style: { cursor: "pointer" }
              }),
              "Sólo filtrados"
            ),
            React.createElement("label", {
              style: { display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#475569", cursor: "pointer", userSelect: "none", padding: "4px 8px", borderRadius: 6, background: bulkSoloSinStock ? "#FEF2F2" : "transparent" }
            },
              React.createElement("input", {
                type: "checkbox", checked: bulkSoloSinStock,
                onChange: (e) => setBulkSoloSinStock(e.target.checked),
                style: { cursor: "pointer" }
              }),
              "Sólo sin stock"
            ),
            // Botón Propuesta personalizada
            React.createElement("span", { style: { width: 1, height: 22, background: "#E2E8F0" } }),
            React.createElement("button", {
              onClick: abrirPropPersonalizada,
              title: "Genera una propuesta solo con SKUs específicos que tú elijas",
              style: { padding: "6px 12px", background: "#7C3AED", color: "#fff", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }
            }, "✨ Propuesta personalizada"),
            // Excluidos del envío (info badge)
            excluidosSku.size > 0 && React.createElement("span", {
              style: { marginLeft: "auto", fontSize: 11, color: "#92400E", background: "#FEF3C7", padding: "4px 8px", borderRadius: 6, fontWeight: 600 },
              title: "SKUs excluidos del envío: " + [...excluidosSku].join(", ")
            }, "\uD83D\uDEAB " + excluidosSku.size + " excluidos")
          ),

        React.createElement("div", { style: { overflowX: "auto", maxHeight: 600, overflowY: "auto" } },
          React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
            React.createElement("thead", {},
              React.createElement("tr", { style: { position: "sticky", top: 0, background: "#F8FAFC", zIndex: 1 } },
                // Solo PCEL: columna extra "SKU Cliente" (el numérico del archivo venta-marca)
                (clienteKey === "pcel") && React.createElement("th", { key: "th-skuc", style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, "SKU Cliente"),
                React.createElement("th", { style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, "SKU"),
                React.createElement("th", { style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, "Roadmap"),
                React.createElement("th", { style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", minWidth: 140 } }, "Descripci\u00f3n"),
                [1,2,3,4,5,6,7,8,9,10,11,12].map(function(m) {
                  return React.createElement("th", { key: "h"+m, style: { textAlign: "right", padding: "8px 4px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][m-1]);
                }),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", color: sortCol === "stock" ? "#1D4ED8" : "#475569" }, onClick: () => handleSort("stock") }, "Inv Cliente" + sortArrow("stock")),
                thSort("Valor Inv", "valorInv"),
                thSort("Prom 90d", "promedio90d"),
                thSort("Inv Acteck", "invActeck"),
                thSort("Tr\u00e1nsito", "invTransito"),
                // Columnas estandarizadas para PCEL y Digitalife (mismo orden y nombres)
                React.createElement("th", {
                  key: "th-bo", onClick: () => handleSort("backOrder"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "backOrder" ? "#1D4ED8" : "#B91C1C", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#FEF2F2" },
                  title: clienteKey === "pcel" ? "Back orders pendientes en sellout_pcel" : "Back order — no aplica para Digitalife"
                }, "Back Order" + sortArrow("backOrder")),
                React.createElement("th", {
                  key: "th-pc", onClick: () => handleSort("promCompra"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "promCompra" ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#FEF3C7" },
                  title: clienteKey === "pcel"
                    ? "Promedio de piezas por compra (últimos 6 meses, ventas_erp)"
                    : "Promedio de piezas/mes que el cliente compró (últimos 6 meses de sell_in_sku)"
                }, "Prom compra" + sortArrow("promCompra")),
                // ── Último Precio facturado (NUEVA, mismo orden ambos clientes) ──
                React.createElement("th", {
                  key: "th-up", onClick: () => handleSort("ultimoPrecio"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "ultimoPrecio" ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#EFF6FF" },
                  title: "Precio unitario de la última venta facturada al cliente (monto / piezas del último mes con datos)"
                }, "Último precio" + sortArrow("ultimoPrecio")),
                thSort("Sugerido", "sugerido"),
                // Columnas adicionales para PCEL: Precio AAA C/desc + Próx. arribo si falta
                (clienteKey === "pcel" || clienteKey === "digitalife") && React.createElement("th", {
                  key: "th-aaa", onClick: () => handleSort("precioAAAcd"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "precioAAAcd" ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#F0F9FF" },
                  title: "Precio AAA con descuento aplicado"
                }, "Precio" + sortArrow("precioAAAcd")),
                (clienteKey === "pcel" || clienteKey === "digitalife") && React.createElement("th", {
                  key: "th-arr",
                  style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", background: "#FEF3C7" },
                  title: "Fecha de próximo arribo si el sugerido no se completa con inv Acteck"
                }, "Pr\u00f3x. arribo (falta)"),
                // Para PCEL se oculta la columna "Precio" genérica (precio_venta de productos_cliente
                // está casi siempre vacío para PCEL); el precio real es "Precio AAA c/desc" de arriba.
                (clienteKey !== "pcel" && clienteKey !== "digitalife") && React.createElement("th", { key: "th-precio-gen", style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, "Precio"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 6px", fontWeight: 700, color: "#065F46", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", background: "#ECFDF5" } },
                  React.createElement("div", { style: { fontSize: 10, color: "#10B981", fontWeight: 600 } }, "Σ " + formatMXN((skuDetail || []).reduce(function(acc, r){ var sug = sugeridoEdits[r.sku] !== undefined ? Number(sugeridoEdits[r.sku]) : Number(r.sugerido || 0); var precioBase = (clienteKey === "pcel" || clienteKey === "digitalife") ? (precioEdits[r.sku] !== undefined ? Number(precioEdits[r.sku]) : Number(r.precioAAAcd || 0)) : Number(r.precio || 0); return acc + sug * precioBase; }, 0))),
                  React.createElement("div", {}, "Total")
                ),
              ),
            ),
            React.createElement("tbody", {},
              skuDetail.map(function(s, idx) {
                const excluido = excluidosSku.has(s.sku);
                const rowBg = excluido
                  ? "#F1F5F9"
                  : (idx % 2 === 0 ? "#fff" : "#FAFBFC");
                const rowOpacity = excluido ? 0.55 : 1;
                return React.createElement("tr", {
                  key: s.sku,
                  style: { borderBottom: "1px solid #F1F5F9", background: rowBg, opacity: rowOpacity },
                  title: excluido ? "Excluido del envío. Click en 🚫 para incluir." : undefined,
                },
                  // PCEL: primera columna es SKU Cliente (numérico, s.sku), segunda es SKU (modelo = s.modelo)
                  // Otros clientes: una sola columna SKU (= s.sku)
                  (clienteKey === "pcel") && React.createElement("td", { key: "td-skuc", style: { padding: "6px", fontWeight: 500, color: "#475569", whiteSpace: "nowrap", fontSize: 11 } }, s.sku),
                  React.createElement("td", { style: { padding: "6px", fontWeight: 500, color: "#1E293B", whiteSpace: "nowrap", fontSize: 11 } },
                    clienteKey === "pcel" ? (s.modelo || "—") : s.sku),
                  React.createElement("td", { style: { padding: "6px", fontSize: 11, maxWidth: 100, whiteSpace: "nowrap" }, title: s.roadmap || "Sin roadmap" },
                    (function() {
                      var rm = s.roadmap || "";
                      // Colores oficiales del roadmap (src/lib/roadmapColors.js)
                      var rmStyle = roadmapStyle(rm);
                      var rmInfo  = roadmapInfo(rm);
                      return React.createElement("span", {
                        style: { padding: "2px 8px", borderRadius: 4, background: rmStyle.bg, color: rmStyle.color, fontSize: 10, fontWeight: 700, cursor: rmInfo.descripcion ? "help" : "default" },
                        title: rmInfo.descripcion || rm,
                      }, rm || "—");
                    })()
                  ),
                  React.createElement("td", { style: { padding: "6px", color: "#475569", fontSize: 11, maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.descripcion }, s.descripcion),
                  [1,2,3,4,5,6,7,8,9,10,11,12].map(function(m) {
                    var soData = datos.sellOut.filter(function(r) { return r.sku === s.sku && Number(r.mes) === m; });
                    var pzas = soData.reduce(function(sum,r) { return sum + (Number(r.piezas) || 0); }, 0);
                    return React.createElement("td", { key: "m"+m, style: { textAlign: "right", padding: "6px 4px", color: pzas > 0 ? "#1E293B" : "#CBD5E1", fontSize: 11 } }, pzas > 0 ? pzas : "-");
                  }),
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", fontWeight: 500, color: "#1E293B", fontSize: 11 } }, (s.stock || 0).toLocaleString("es-MX")),
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", color: "#64748B", fontSize: 11 } }, s.valorInv > 0 ? "$" + Math.round(s.valorInv).toLocaleString("es-MX") : "-"),
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", color: "#64748B", fontSize: 11 } }, (s.promedio90d || 0).toLocaleString("es-MX")),
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", color: s.invActeck > 0 ? "#1E293B" : "#CBD5E1", fontSize: 11, fontWeight: s.invActeck > 0 ? 500 : 400 } }, (s.invActeck || 0).toLocaleString("es-MX")),
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", color: s.invTransito > 0 ? "#7C3AED" : "#CBD5E1", fontSize: 11 } }, s.invTransito > 0 ? s.invTransito.toLocaleString("es-MX") : "-"),
                  // Columnas estandarizadas (ambos clientes, mismo orden)
                  React.createElement("td", {
                    key: "td-bo",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, background: s.backOrder > 0 ? "#FEE2E2" : "#FEF2F2", color: s.backOrder > 0 ? "#991B1B" : "#CBD5E1", fontWeight: s.backOrder > 0 ? 700 : 400 }
                  }, s.backOrder > 0 ? s.backOrder.toLocaleString("es-MX") : "-"),
                  React.createElement("td", {
                    key: "td-pc",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, background: "#FFFBEB", color: s.promCompra > 0 ? "#78350F" : "#CBD5E1", fontWeight: 500 },
                    title: clienteKey === "pcel"
                      ? (s.facturasHist > 0 ? (s.facturasHist + " compras históricas") : "Sin histórico de compras")
                      : "Promedio sell-in últimos 6 meses"
                  }, s.promCompra > 0 ? s.promCompra.toLocaleString("es-MX") : "-"),
                  // Último precio facturado (NUEVA, ambos clientes)
                  React.createElement("td", {
                    key: "td-up",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, background: "#EFF6FF", color: s.ultimoPrecio > 0 ? "#1E40AF" : "#CBD5E1", fontWeight: 500 },
                    title: s.ultimoPrecio > 0 ? "Precio unitario de la última venta facturada" : "Sin venta registrada"
                  }, s.ultimoPrecio > 0 ? formatMXN(s.ultimoPrecio) : "-"),
                  (function(){
                    // Gate: sin inventario ni tránsito → sugerido = 0 forzado
                    // (ignora override manual). Input disabled para que sea obvio.
                    const sinStock = (clienteKey === "pcel" || clienteKey === "digitalife")
                      && (Number(s.invActeck) || 0) === 0
                      && (Number(s.invTransito) || 0) === 0;
                    const valEff = sinStock ? 0
                      : (sugeridoEdits[s.sku] !== undefined ? sugeridoEdits[s.sku] : (s.sugerido || 0));
                    return React.createElement("td", { style: { textAlign: "right", padding: "6px", fontSize: 11, position: "relative" } },
                      React.createElement("input", {
                        type: "number", min: 0,
                        value: valEff,
                        disabled: sinStock,
                        readOnly: !canEdit,
                        title: !canEdit ? "Solo lectura" : (sinStock ? "Sin inventario ni tránsito Acteck — no se puede sugerir" : undefined),
                        onChange: function(e) {
                          if (sinStock) return;
                          var nv = Number(e.target.value) || 0;
                          var v = {}; v[s.sku] = nv;
                          setSugeridoEdits(Object.assign({}, sugeridoEdits, v));
                          debounceSaveSugerido(s.sku, nv);
                        },
                        onBlur: function(e) {
                          if (sinStock) return;
                          // Flush inmediato al salir (cancela debounce y guarda ya)
                          if (sugeridoTimeouts.current[s.sku]) clearTimeout(sugeridoTimeouts.current[s.sku]);
                          saveSugeridoOverride(s.sku, Number(e.target.value) || 0);
                        },
                        style: {
                          width: 60, padding: "2px 4px",
                          border: "1px solid " + (sinStock ? "#F1F5F9" : "#E2E8F0"),
                          borderRadius: 4, textAlign: "right", fontSize: 11,
                          background: sinStock ? "#F8FAFC" : "#fff",
                          color: sinStock ? "#CBD5E1" : "#1E293B",
                          cursor: sinStock ? "not-allowed" : "text",
                        }
                      }),
                    // Indicador visual del guardado
                    sugeridoSaveState[s.sku] && React.createElement("span", {
                      style: {
                        position: "absolute", right: -2, top: "50%", transform: "translateY(-50%)",
                        fontSize: 10, fontWeight: 700,
                        color: sugeridoSaveState[s.sku] === "saved" ? "#10B981"
                             : sugeridoSaveState[s.sku] === "saving" ? "#94A3B8"
                             : "#EF4444",
                        pointerEvents: "none",
                      },
                      title: sugeridoSaveState[s.sku] === "saved" ? "Guardado" : sugeridoSaveState[s.sku] === "saving" ? "Guardando..." : "Error al guardar"
                    }, sugeridoSaveState[s.sku] === "saved" ? "\u2713" : sugeridoSaveState[s.sku] === "saving" ? "\u2026" : "!"),
                    // Badge de meta dinámica (solo Digitalife). Si se elevó la
                    // meta (120d ó 150d) por crecimiento o roadmap año actual,
                    // se pinta una píldora pequeña a la izquierda del sugerido
                    // para que sepas por qué es más alto.
                    (clienteKey === "digitalife" && s.metaMeses && s.metaMeses > 3) && React.createElement("span", {
                      style: {
                        position: "absolute", left: -2, top: "50%", transform: "translateY(-50%)",
                        fontSize: 9, fontWeight: 700, padding: "1px 4px", borderRadius: 3,
                        background: s.metaMeses >= 5 ? "#FED7AA" : "#DBEAFE",
                        color:      s.metaMeses >= 5 ? "#9A3412" : "#1E40AF",
                        pointerEvents: "none",
                      },
                      title: (s.metaRazon ? s.metaRazon + " · " : "") + "Meta elevada a " + (s.metaMeses * 30) + " días"
                    }, (s.metaMeses * 30) + "d")
                  );
                  })(),
                  // Precio AAA c/desc editable (PCEL y Digitalife): parece texto plano, pero al hover/focus se reveal
                  (clienteKey === "pcel" || clienteKey === "digitalife") && React.createElement("td", {
                    key: "td-aaa",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, whiteSpace: "nowrap", background: "#F0F9FF", position: "relative" }
                  },
                    React.createElement("input", {
                      type: "number", min: 0, step: "1",
                      readOnly: !canEdit,
                      value: precioEdits[s.sku] !== undefined
                        ? Math.round(Number(precioEdits[s.sku]) || 0)
                        : Math.round(Number(s.precioAAAcd) || 0),
                      onChange: function(e) {
                        if (!canEdit) return;
                        var nv = Math.round(Number(e.target.value) || 0);
                        setPrecioEdits(Object.assign({}, precioEdits, { [s.sku]: nv }));
                        debounceSavePrecio(s.sku, nv);
                      },
                      onBlur: function(e) {
                        e.target.style.border = "1px solid transparent";
                        e.target.style.background = "transparent";
                        if (precioTimeouts.current[s.sku]) clearTimeout(precioTimeouts.current[s.sku]);
                        savePrecioOverride(s.sku, Number(e.target.value) || 0);
                      },
                      onFocus: function(e) {
                        e.target.style.border = "1px solid #60A5FA";
                        e.target.style.background = "#fff";
                      },
                      onMouseEnter: function(e) {
                        if (document.activeElement !== e.target) {
                          e.target.style.border = "1px dashed #CBD5E1";
                        }
                      },
                      onMouseLeave: function(e) {
                        if (document.activeElement !== e.target) {
                          e.target.style.border = "1px solid transparent";
                        }
                      },
                      style: {
                        width: 80,
                        padding: "2px 4px",
                        border: "1px solid transparent",
                        borderRadius: 4,
                        textAlign: "right",
                        fontSize: 11,
                        background: "transparent",
                        color: "#1E40AF",
                        fontWeight: 500,
                        outline: "none",
                        MozAppearance: "textfield",
                      },
                      title: !canEdit
                        ? "Solo lectura"
                        : precioEdits[s.sku] !== undefined
                          ? "Precio modificado manualmente · Click para editar"
                          : "Click para editar · Se guarda automáticamente"
                    }),
                    // Mini marca: bullet morado cuando el precio está editado manualmente
                    (precioEdits[s.sku] !== undefined) && React.createElement("span", {
                      style: {
                        position: "absolute",
                        left: 4, top: "50%", transform: "translateY(-50%)",
                        width: 6, height: 6, borderRadius: "50%",
                        background: "#A855F7",
                        pointerEvents: "none",
                      },
                      title: "Precio modificado manualmente"
                    }),
                    precioSaveState[s.sku] && React.createElement("span", {
                      style: {
                        position: "absolute", right: 4, top: "50%", transform: "translateY(-50%)",
                        fontSize: 10, fontWeight: 700,
                        color: precioSaveState[s.sku] === "saved" ? "#10B981"
                             : precioSaveState[s.sku] === "saving" ? "#94A3B8"
                             : "#EF4444",
                        pointerEvents: "none",
                      },
                      title: precioSaveState[s.sku] === "saved" ? "Guardado" : precioSaveState[s.sku] === "saving" ? "Guardando..." : "Error"
                    }, precioSaveState[s.sku] === "saved" ? "\u2713" : precioSaveState[s.sku] === "saving" ? "\u2026" : "!")
                  ),
                  // Próx. arribo (si falta) — mostrar cuando sugerido > invActeck (PCEL y Digitalife)
                  // Si hay fecha → fecha en español. Si hay piezas pero sin fecha → "N pzas en tránsito".
                  (clienteKey === "pcel" || clienteKey === "digitalife") && (function() {
                    const sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
                    const gap = Math.max(0, sug - (Number(s.invActeck) || 0));
                    const hayGap = gap > 0;
                    let contenido = "-";
                    let color = "#CBD5E1";
                    let fw = 400;
                    if (hayGap) {
                      if (s.arriboFecha) {
                        contenido = formatFechaES(s.arriboFecha);
                        color = "#78350F";
                        fw = 600;
                      } else if (s.arriboPiezas > 0) {
                        contenido = `${Number(s.arriboPiezas).toLocaleString("es-MX")} pzas (sin fecha)`;
                        color = "#A16207";
                        fw = 500;
                      }
                    }
                    return React.createElement("td", {
                      key: "td-arr",
                      style: { textAlign: "left", padding: "6px", fontSize: 11, whiteSpace: "nowrap", background: "#FEF3C7", color, fontWeight: fw },
                      title: hayGap
                        ? `Faltan ${gap} piezas · Tránsito: ${s.arriboPiezas || 0} piezas${s.arriboFecha ? ` · Arribo: ${s.arriboFecha}` : " · Sin fecha confirmada"}`
                        : (s.arriboFecha || s.arriboPiezas ? `Stock suficiente (${s.invActeck})` : "Sin tránsito")
                    }, contenido);
                  })(),
                  // TD de "Precio" genérico — oculto para PCEL (su precio es el AAA c/desc de arriba)
                  (clienteKey !== "pcel" && clienteKey !== "digitalife") && React.createElement("td", { key: "td-precio-gen", style: { textAlign: "right", padding: "6px", color: "#64748B", fontSize: 11, whiteSpace: "nowrap" } }, (s.precio && s.precio > 0) ? ("$" + Number(s.precio).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })) : "-"),
                  (function(){
                    var sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
                    // Para PCEL: override o precio AAA con descuento. Otros: precio_venta.
                    var precioBase = (clienteKey === "pcel" || clienteKey === "digitalife")
                      ? (precioEdits[s.sku] !== undefined ? Number(precioEdits[s.sku]) : Number(s.precioAAAcd || 0))
                      : Number(s.precio || 0);
                    var tot = sug * precioBase;
                    return React.createElement("td", { style: { textAlign: "right", padding: "6px", color: tot > 0 ? "#065F46" : "#CBD5E1", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: tot > 0 ? "#F0FDF4" : "transparent" } }, tot > 0 ? ("$" + Math.round(tot).toLocaleString("es-MX")) : "-");
                  })(),
                );
              }),
            ),
          ),
        ),
        // ═══ Historial de propuestas exportadas (PCEL y Digitalife) ═══
        (clienteKey === "pcel" || clienteKey === "digitalife") && React.createElement("div", {
          style: { marginTop: 16, borderTop: "1px solid #E2E8F0", paddingTop: 12 }
        },
          React.createElement("button", {
            onClick: () => setHistAbierto(!histAbierto),
            style: { display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "8px 12px", background: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600, color: "#475569", textAlign: "left" }
          },
            React.createElement("span", { style: { fontSize: 14 } }, histAbierto ? "\u25BE" : "\u25B8"),
            React.createElement("span", null, "\uD83D\uDCC1 Propuestas exportadas"),
            React.createElement("span", { style: { marginLeft: "auto", fontSize: 11, color: "#94A3B8", fontWeight: 400 } },
              propuestasHist.length + " propuesta" + (propuestasHist.length !== 1 ? "s" : "")
            )
          ),
          histAbierto && React.createElement("div", { style: { marginTop: 8 } },
            propuestasHist.length === 0
              ? React.createElement("p", { style: { fontSize: 12, color: "#94A3B8", fontStyle: "italic", padding: "12px", textAlign: "center" } },
                  "No hay propuestas exportadas todavía. Cada vez que uses el bot\u00f3n \"Exportar Excel\" se guarda aqu\u00ed.")
              : React.createElement("div", { style: { maxHeight: 320, overflowY: "auto" } },
                  React.createElement("table", { style: { width: "100%", fontSize: 12, borderCollapse: "collapse" } },
                    React.createElement("thead", null,
                      React.createElement("tr", { style: { background: "#F1F5F9", position: "sticky", top: 0 } },
                        React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "Fecha"),
                        React.createElement("th", { style: { textAlign: "center", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "Estatus"),
                        React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "SKUs"),
                        React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "Piezas"),
                        React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "Monto"),
                        React.createElement("th", { style: { textAlign: "center", padding: "6px 10px", fontSize: 11, color: "#1E40AF", fontWeight: 600, background: "#EFF6FF" }, title: "% de piezas sugeridas que el cliente efectivamente compró en los 14 días siguientes a la propuesta" }, "% Acierto"),
                        React.createElement("th", { style: { textAlign: "center", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "Acciones"),
                      )
                    ),
                    React.createElement("tbody", null,
                      (propuestasConTracking || propuestasHist).map(p => {
                        const esPend = (p.estatus || "pendiente") === "pendiente";
                        return React.createElement("tr", {
                          key: p.id,
                          style: { borderBottom: "1px solid #F1F5F9", background: esPend ? "#EFF6FF" : "#fff", opacity: esPend ? 1 : 0.75 }
                        },
                          React.createElement("td", { style: { padding: "6px 10px", fontSize: 11, color: "#1E293B" } },
                            (function() {
                              try {
                                const d = new Date(p.fecha);
                                return d.toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })
                                  + " \u00B7 " + d.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" });
                              } catch { return String(p.fecha).slice(0, 16); }
                            })()
                          ),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "center" } },
                            esPend
                              ? React.createElement("span", { style: { padding: "2px 8px", borderRadius: 10, background: "#DBEAFE", color: "#1E40AF", fontSize: 10, fontWeight: 700 } }, "\u00b7 Pendiente")
                              : React.createElement("span", { style: { padding: "2px 8px", borderRadius: 10, background: "#D1FAE5", color: "#065F46", fontSize: 10, fontWeight: 700 } }, "\u2713 Cerrada")
                          ),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", fontSize: 11 } }, (p.skus_count || 0).toLocaleString("es-MX")),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", fontSize: 11 } }, (Number(p.piezas_total) || 0).toLocaleString("es-MX")),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", fontSize: 11, fontWeight: 600, color: "#065F46" } },
                            "$" + Math.round(Number(p.monto_total) || 0).toLocaleString("es-MX")
                          ),
                          // % Acierto (Sugerí vs Compraron)
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "center", fontSize: 11, background: "#F8FAFC" } },
                            (function() {
                              const t = p.tracking;
                              if (!t || t.sinFilas) {
                                return React.createElement("span", { style: { color: "#94A3B8", fontStyle: "italic" }, title: "Esta propuesta no guardó el detalle por SKU" }, "—");
                              }
                              if (t.pct == null) return React.createElement("span", { style: { color: "#94A3B8" } }, "—");
                              const c = t.pct >= 70 ? "#065F46" : t.pct >= 50 ? "#92400E" : "#B91C1C";
                              const bg = t.pct >= 70 ? "#D1FAE5" : t.pct >= 50 ? "#FEF3C7" : "#FEE2E2";
                              return React.createElement("span", {
                                style: { padding: "2px 8px", borderRadius: 10, background: bg, color: c, fontWeight: 700 },
                                title: "Sugeriste " + t.totalSug.toLocaleString("es-MX") + " pzs · Compró " + t.totalCompr.toLocaleString("es-MX") +
                                  " (" + t.skusComprados + " de " + t.skusTotales + " SKUs)\n" +
                                  "Ventana: " + (t.ventana || '14d') + "\nMétodo: " + (t.metodoMatch || '—')
                              }, t.pct.toFixed(0) + "%");
                            })()
                          ),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" } },
                            React.createElement("button", {
                              onClick: () => descargarPropuestaHistorica(p),
                              style: { padding: "3px 8px", fontSize: 11, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", marginRight: 6 },
                              title: "Re-descargar Excel"
                            }, "\uD83D\uDCE5"),
                            // Cerrar/Reactivar/Borrar sólo para usuarios con permiso de edición
                            canEdit && (esPend
                              ? React.createElement("button", {
                                  onClick: () => cerrarPropuesta(p.id),
                                  style: { padding: "3px 8px", fontSize: 11, background: "#fff", color: "#059669", border: "1px solid #6EE7B7", borderRadius: 4, cursor: "pointer", marginRight: 6 },
                                  title: "Cerrar propuesta (los SKUs volver\u00e1n a aparecer en riesgo si aplica)"
                                }, "\u2713 Cerrar")
                              : React.createElement("button", {
                                  onClick: () => reactivarPropuesta(p.id),
                                  style: { padding: "3px 8px", fontSize: 11, background: "#fff", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: 4, cursor: "pointer", marginRight: 6 },
                                  title: "Reactivar propuesta"
                                }, "\u21bb Reactivar")),
                            canEdit && React.createElement("button", {
                              onClick: () => borrarPropuestaHistorica(p.id),
                              style: { padding: "3px 8px", fontSize: 11, background: "#fff", color: "#EF4444", border: "1px solid #FCA5A5", borderRadius: 4, cursor: "pointer" },
                              title: "Eliminar"
                            }, "\uD83D\uDDD1\uFE0F")
                          ),
                        );
                      })
                    )
                  )
                )
          )
        )
        );
      })(),

      // SKUs en riesgo de desabasto
      skusRiesgo.length > 0 && React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 } },
          React.createElement("h3", { className: "font-bold text-gray-800" }, "\u26A0\uFE0F SKUs en riesgo de desabasto"),
          React.createElement("div", { style: { fontSize: 12, color: "#64748B", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" } },
            React.createElement("span", null,
              skusRiesgo.length + " SKUs se agotan en menos de 30 d\u00edas con la rotaci\u00f3n actual"
            ),
            skusOcultosEnPropuesta > 0 && React.createElement("span", {
              style: { background: "#DBEAFE", color: "#1E40AF", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 600 },
              title: "SKUs ocultos porque ya están en propuestas exportadas pendientes. Al cerrarlas (cuando llegue la OC del cliente) volverán a aparecer si siguen en riesgo."
            }, "\u00b7 " + skusOcultosEnPropuesta + " en propuesta pendiente")
          )
        ),
        React.createElement("div", { style: { overflowX: "auto", maxHeight: 400, overflowY: "auto" } },
          React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
            React.createElement("thead", null,
              React.createElement("tr", { style: { background: "#FEF2F2", position: "sticky", top: 0 } },
                React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 20 } }, "⚠"),
                React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA" } }, "SKU"),
                React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA" } }, "Descripci\u00f3n"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 90 } }, "Inv Cliente"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 90 } }, "Prom 90d"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 90 } }, "D\u00edas restantes"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 90 } }, "Inv Acteck"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 90 } }, "Tr\u00e1nsito"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", fontWeight: 600, color: "#991B1B", borderBottom: "2px solid #FECACA", width: 90, background: "#FEE2E2" } }, "Sugerido")
              )
            ),
            React.createElement("tbody", null,
              skusRiesgo.map(function(s, i) {
                // Color de la FILA + indicador: se alinea con el estado del Sugerido
                //   sinStock             → rojo  (no se puede surtir)
                //   sugerido > 0         → verde (se puede proponer)
                //   stock 1-19           → ámbar (insuficiente para mínimo 20)
                //   sin stock ni sug     → gris neutro
                var totalDisponible = (s.invActeck || 0) + (s.transito || 0);
                var bg, dot, rowTitle;
                if (s.sinStock) {
                  bg = "#FEE2E2"; dot = "#B91C1C";
                  rowTitle = "⚠ Crítico: sin inventario Acteck ni tránsito — no se puede surtir";
                } else if (s.sugerido > 0) {
                  bg = "#ECFDF5"; dot = "#10B981";
                  rowTitle = "Podemos surtir " + s.sugerido + " piezas";
                } else if (totalDisponible > 0 && totalDisponible < 20) {
                  bg = "#FFFBEB"; dot = "#F59E0B";
                  rowTitle = "Solo " + totalDisponible + " piezas disponibles (mínimo: 20) — no se propone";
                } else {
                  bg = "#F8FAFC"; dot = "#94A3B8";
                  rowTitle = "Sin sugerido";
                }
                // Color de "Días restantes" — independiente, refleja urgencia temporal
                var dotDias = s.urgencia === 3 ? "#EF4444"
                            : s.urgencia === 2 ? "#F59E0B"
                            : "#FBBF24";
                return React.createElement("tr", {
                  key: s.sku,
                  style: { borderBottom: "1px solid #f1f5f9", background: bg },
                  title: rowTitle,
                },
                  React.createElement("td", { style: { padding: "8px 10px", textAlign: "center" } },
                    React.createElement("span", {
                      style: {
                        display: "inline-block", width: 10, height: 10, borderRadius: 5,
                        background: dot,
                        boxShadow: s.sinStock ? "0 0 0 2px #FCA5A5" : "none",
                      }
                    })
                  ),
                  React.createElement("td", { style: { padding: "8px 10px", fontFamily: "ui-monospace,monospace", color: "#1E293B", fontWeight: 600 } }, s.sku),
                  React.createElement("td", { style: { padding: "8px 10px", color: "#475569", maxWidth: 320, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.titulo }, s.titulo.slice(0, 70)),
                  React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", color: "#1E293B", fontWeight: 600 } }, s.stock.toLocaleString("es-MX")),
                  React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", color: "#475569" } }, s.promMes.toLocaleString("es-MX")),
                  React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", color: dotDias, fontWeight: 700 } }, s.diasRestantes + "d"),
                  React.createElement("td", {
                    style: {
                      padding: "8px 10px", textAlign: "right",
                      color: s.invActeck > 0 ? "#10B981" : "#B91C1C",
                      fontWeight: s.invActeck > 0 ? 600 : 700,
                    }
                  }, s.invActeck > 0 ? s.invActeck.toLocaleString("es-MX") : "0"),
                  React.createElement("td", {
                    style: { padding: "8px 10px", textAlign: "right", color: s.transito > 0 ? "#7C3AED" : "#94A3B8" }
                  }, s.transito > 0 ? s.transito.toLocaleString("es-MX") : "—"),
                  (function() {
                    // Tres casos visuales:
                    //   sinStock (invAct=0 && trans=0) → rojo intenso "0 ⚠"
                    //   sugerido = 0 con stock < 20    → ámbar "Insuficiente" (no se propone)
                    //   sugerido > 0                   → verde con el número
                    const totalDisponible = (s.invActeck || 0) + (s.transito || 0);
                    let bgCell, colorCell, textoCell, titleCell, peso;
                    if (s.sinStock) {
                      bgCell = "#FEE2E2";
                      colorCell = "#B91C1C";
                      textoCell = "0 \u26A0";
                      titleCell = "Sin inventario ni tr\u00e1nsito Acteck";
                      peso = 700;
                    } else if (s.sugerido === 0 && totalDisponible > 0 && totalDisponible < 20) {
                      bgCell = "#FFFBEB";
                      colorCell = "#92400E";
                      textoCell = "Insuficiente";
                      titleCell = `Solo ${totalDisponible} piezas disponibles en Acteck (m\u00ednimo: 20). No se propone.`;
                      peso = 500;
                    } else if (s.sugerido > 0) {
                      bgCell = "#ECFDF5";
                      colorCell = "#065F46";
                      textoCell = s.sugerido.toLocaleString("es-MX");
                      titleCell = sugeridoEdits[s.sku] !== undefined
                        ? "Sugerido editado manualmente"
                        : "Sugerido autom\u00e1tico";
                      peso = 700;
                    } else {
                      bgCell = "#F8FAFC";
                      colorCell = "#94A3B8";
                      textoCell = "\u2014";
                      titleCell = "Sin sugerido";
                      peso = 400;
                    }
                    return React.createElement("td", {
                      style: {
                        padding: "8px 10px", textAlign: "right",
                        background: bgCell, color: colorCell, fontWeight: peso,
                      },
                      title: titleCell,
                    }, textoCell);
                  })()
                );
              })
            )
          )
        )
      ),

      // ═══ MODAL DE VISTA PREVIA DEL BULK ═══
      bulkPreview && React.createElement("div", {
        style: {
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        },
        onClick: () => setBulkPreview(null)
      },
        React.createElement("div", {
          style: { background: "#fff", borderRadius: 14, padding: 24, maxWidth: 480, width: "100%", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
          onClick: (e) => e.stopPropagation()
        },
          React.createElement("h3", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 8 } },
            "Vista previa: " + bulkPreview.etiqueta),
          React.createElement("p", { style: { fontSize: 13, color: "#64748B", marginBottom: 16 } },
            bulkPreview.cuentaCambios === 0
              ? "Ningún SKU cambia con esta operación."
              : ("Esto cambiará " + bulkPreview.cuentaCambios + " SKUs (" + bulkPreview.universoSize + " evaluados)")
          ),
          // Modificadores activos
          (bulkPreview.modificadores.soloFiltrados || bulkPreview.modificadores.soloSinStock) &&
            React.createElement("div", {
              style: { fontSize: 11, color: "#92400E", background: "#FEF3C7", padding: "6px 10px", borderRadius: 6, marginBottom: 12 }
            },
              "Filtros activos: ",
              bulkPreview.modificadores.soloFiltrados && React.createElement("span", null, "sólo filtrados"),
              bulkPreview.modificadores.soloFiltrados && bulkPreview.modificadores.soloSinStock && " · ",
              bulkPreview.modificadores.soloSinStock && React.createElement("span", null, "sólo sin stock")
            ),
          // Resumen $
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 } },
            React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 8, padding: 12 } },
              React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 } }, "Total ANTES"),
              React.createElement("p", { style: { fontSize: 18, fontWeight: 700, color: "#475569" } }, formatMXN(bulkPreview.totalAntes))
            ),
            React.createElement("div", { style: { background: bulkPreview.diferencia >= 0 ? "#F0FDF4" : "#FEF2F2", borderRadius: 8, padding: 12 } },
              React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 } }, "Total DESPUÉS"),
              React.createElement("p", { style: { fontSize: 18, fontWeight: 700, color: bulkPreview.diferencia >= 0 ? "#047857" : "#B91C1C" } }, formatMXN(bulkPreview.totalDespues))
            )
          ),
          React.createElement("p", { style: { fontSize: 13, marginBottom: 18, color: bulkPreview.diferencia >= 0 ? "#047857" : "#B91C1C", fontWeight: 600 } },
            (bulkPreview.diferencia >= 0 ? "+" : "") + formatMXN(bulkPreview.diferencia) + " de diferencia"
          ),
          React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end" } },
            React.createElement("button", {
              onClick: () => setBulkPreview(null),
              style: { padding: "8px 16px", background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }
            }, "Cancelar"),
            React.createElement("button", {
              onClick: confirmarBulk,
              disabled: bulkPreview.cuentaCambios === 0,
              style: {
                padding: "8px 18px",
                background: bulkPreview.cuentaCambios === 0 ? "#CBD5E1" : "#1E40AF",
                color: "#fff", border: "none", borderRadius: 8,
                fontSize: 13, fontWeight: 600,
                cursor: bulkPreview.cuentaCambios === 0 ? "not-allowed" : "pointer"
              }
            }, "Aplicar a " + bulkPreview.cuentaCambios + " SKUs")
          )
        )
      ),

      // ═══ MODAL: PROPUESTA PERSONALIZADA ═══
      // Permite seleccionar manualmente algunos SKUs y proponer cantidades
      // específicas (negociación puntual, lanzamiento, etc.)
      propPersonalizada && (function() {
        const totalPiezas = propPersonalizada.skus.reduce((a, s) => a + (Number(s.cantidad) || 0), 0);
        const totalMonto = propPersonalizada.skus.reduce((a, s) => a + (Number(s.cantidad) * Number(s.precio) || 0), 0);
        const q = (propPersonalizada.busqueda || "").toLowerCase().trim();
        const sugerencias = q.length >= 2 && skuDetail
          ? skuDetail.filter((s) =>
              ((s.sku || "").toLowerCase().includes(q) || (s.descripcion || "").toLowerCase().includes(q)) &&
              !propPersonalizada.skus.find((x) => x.sku === s.sku)
            ).slice(0, 8)
          : [];
        return React.createElement("div", {
          style: {
            position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 100,
            display: "flex", alignItems: "center", justifyContent: "center", padding: 20
          },
          onClick: cerrarPropPersonalizada
        },
          React.createElement("div", {
            style: { background: "#fff", borderRadius: 14, padding: 24, maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
            onClick: (e) => e.stopPropagation()
          },
            // Header
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 16 } },
              React.createElement("div", null,
                React.createElement("h3", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: "#1E293B" } }, "✨ Propuesta personalizada"),
                React.createElement("p", { style: { fontSize: 12, color: "#64748B", marginTop: 4 } }, "Selecciona SKUs específicos y cantidades. Genera un Excel separado.")
              ),
              React.createElement("button", { onClick: cerrarPropPersonalizada, style: { background: "transparent", border: "none", cursor: "pointer", color: "#94A3B8", fontSize: 20 }, title: "Cerrar" }, "✕")
            ),
            // Nombre + Notas
            React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 2fr", gap: 12, marginBottom: 16 } },
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 } }, "Nombre"),
                React.createElement("input", {
                  type: "text", placeholder: "Ej. Lanzamiento Q3",
                  value: propPersonalizada.nombre,
                  onChange: (e) => setPropPersonalizada({ ...propPersonalizada, nombre: e.target.value }),
                  style: { width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }
                })
              ),
              React.createElement("div", null,
                React.createElement("label", { style: { fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 } }, "Notas (opcional)"),
                React.createElement("input", {
                  type: "text", placeholder: "Ej. Negociación con descuento especial",
                  value: propPersonalizada.notas,
                  onChange: (e) => setPropPersonalizada({ ...propPersonalizada, notas: e.target.value }),
                  style: { width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }
                })
              )
            ),
            // Buscador SKU
            React.createElement("div", { style: { marginBottom: 8, position: "relative" } },
              React.createElement("label", { style: { fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 } }, "Agregar SKU"),
              React.createElement("input", {
                type: "text", placeholder: "Buscar por SKU o descripción...",
                value: propPersonalizada.busqueda,
                onChange: (e) => setPropPersonalizada({ ...propPersonalizada, busqueda: e.target.value }),
                style: { width: "100%", padding: "8px 10px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13 }
              }),
              sugerencias.length > 0 && React.createElement("div", {
                style: { position: "absolute", top: "100%", left: 0, right: 0, background: "#fff", border: "1px solid #E2E8F0", borderRadius: 8, marginTop: 4, maxHeight: 220, overflowY: "auto", zIndex: 1, boxShadow: "0 4px 14px rgba(0,0,0,0.08)" }
              },
                sugerencias.map((s) =>
                  React.createElement("div", {
                    key: s.sku,
                    onClick: () => agregarSkuAPropPersonalizada(s),
                    style: { padding: "8px 12px", fontSize: 12, cursor: "pointer", borderBottom: "1px solid #F1F5F9", display: "flex", justifyContent: "space-between", gap: 8 }
                  },
                    React.createElement("span", { style: { fontWeight: 600, color: "#1E293B" } }, s.sku),
                    React.createElement("span", { style: { color: "#64748B", flex: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, s.descripcion || "")
                  )
                )
              )
            ),
            // Lista de SKUs agregados
            propPersonalizada.skus.length === 0
              ? React.createElement("div", { style: { padding: 24, textAlign: "center", color: "#94A3B8", fontSize: 13, background: "#F8FAFC", borderRadius: 8, marginTop: 16 } },
                  "Sin SKUs agregados todavía. Busca arriba y haz click para agregar.")
              : React.createElement("div", { style: { marginTop: 16, border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden" } },
                  React.createElement("table", { style: { width: "100%", fontSize: 12, borderCollapse: "collapse" } },
                    React.createElement("thead", null,
                      React.createElement("tr", { style: { background: "#F8FAFC", borderBottom: "1px solid #E2E8F0" } },
                        React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "SKU"),
                        React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Descripción"),
                        React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600, width: 90 } }, "Cantidad"),
                        React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600, width: 110 } }, "Precio"),
                        React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600, width: 100 } }, "Total"),
                        React.createElement("th", { style: { width: 40 } })
                      )
                    ),
                    React.createElement("tbody", null,
                      propPersonalizada.skus.map((s) =>
                        React.createElement("tr", { key: s.sku, style: { borderBottom: "1px solid #F1F5F9" } },
                          React.createElement("td", { style: { padding: "6px 10px", fontFamily: "ui-monospace,monospace", fontWeight: 600, color: "#1E293B" } }, s.sku),
                          React.createElement("td", { style: { padding: "6px 10px", color: "#475569", maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: s.descripcion }, (s.descripcion || "").slice(0, 40)),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "right" } },
                            React.createElement("input", {
                              type: "number", min: 0, value: s.cantidad,
                              onChange: (e) => actualizarSkuPropPersonalizada(s.sku, "cantidad", Number(e.target.value) || 0),
                              style: { width: 70, padding: "4px 6px", border: "1px solid #CBD5E1", borderRadius: 4, textAlign: "right", fontSize: 12 }
                            })
                          ),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "right" } },
                            React.createElement("input", {
                              type: "number", min: 0, step: "0.01", value: s.precio,
                              onChange: (e) => actualizarSkuPropPersonalizada(s.sku, "precio", Number(e.target.value) || 0),
                              style: { width: 90, padding: "4px 6px", border: "1px solid #CBD5E1", borderRadius: 4, textAlign: "right", fontSize: 12 }
                            })
                          ),
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", fontWeight: 600, color: "#065F46" } },
                            formatMXN(Number(s.cantidad) * Number(s.precio))),
                          React.createElement("td", { style: { textAlign: "center" } },
                            React.createElement("button", {
                              onClick: () => quitarSkuDePropPersonalizada(s.sku),
                              title: "Quitar SKU",
                              style: { background: "transparent", border: "none", cursor: "pointer", color: "#EF4444", fontSize: 14, padding: 0 }
                            }, "✕")
                          )
                        )
                      )
                    ),
                    React.createElement("tfoot", null,
                      React.createElement("tr", { style: { background: "#F0FDF4", borderTop: "2px solid #10B981" } },
                        React.createElement("td", { colSpan: 2, style: { padding: "8px 10px", fontWeight: 700, color: "#065F46" } }, "TOTAL"),
                        React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#065F46" } }, totalPiezas.toLocaleString("es-MX")),
                        React.createElement("td", null),
                        React.createElement("td", { style: { padding: "8px 10px", textAlign: "right", fontWeight: 800, color: "#065F46" } }, formatMXN(totalMonto)),
                        React.createElement("td", null)
                      )
                    )
                  )
                ),
            // Footer botones
            React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18, paddingTop: 16, borderTop: "1px solid #F1F5F9" } },
              React.createElement("button", {
                onClick: cerrarPropPersonalizada,
                style: { padding: "8px 16px", background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }
              }, "Cancelar"),
              React.createElement("button", {
                onClick: exportarPropPersonalizada,
                disabled: propPersonalizada.skus.length === 0 || totalPiezas === 0,
                style: {
                  padding: "8px 18px",
                  background: (propPersonalizada.skus.length === 0 || totalPiezas === 0) ? "#CBD5E1" : "#7C3AED",
                  color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600,
                  cursor: (propPersonalizada.skus.length === 0 || totalPiezas === 0) ? "not-allowed" : "pointer"
                }
              }, "📥 Generar Excel")
            )
          )
        );
      })(),

      // ═══ MODAL: CALCULADORA REVERSA DE CUOTA ═══
      cuotaCalc && React.createElement("div", {
        style: {
          position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 100,
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20
        },
        onClick: () => setCuotaCalc(null)
      },
        React.createElement("div", {
          style: { background: "#fff", borderRadius: 14, padding: 24, maxWidth: 720, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.25)" },
          onClick: (e) => e.stopPropagation()
        },
          React.createElement("h3", { style: { margin: 0, fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 4 } },
            "🎯 Para cuota " + (cuotaCalc.meta === 'mes' ? 'del mes' : 'del Q')),
          React.createElement("p", { style: { fontSize: 13, color: "#64748B", marginBottom: 16 } },
            "Faltan " + formatMXN(cuotaCalc.faltaMonto) + " para alcanzar la meta. Calculé qué SKUs subir al sugerido agresivo (×4 = 120d) para cubrir ese monto."),
          // Resumen
          React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 } },
            React.createElement("div", { style: { background: "#F8FAFC", borderRadius: 8, padding: 12 } },
              React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 } }, "Propuesta actual"),
              React.createElement("p", { style: { fontSize: 16, fontWeight: 700, color: "#475569" } }, formatMXN(cuotaCalc.totalActualPropuesta))
            ),
            React.createElement("div", { style: { background: cuotaCalc.cubre ? "#F0FDF4" : "#FEF2F2", borderRadius: 8, padding: 12 } },
              React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", marginBottom: 4 } }, "Después de aplicar"),
              React.createElement("p", { style: { fontSize: 16, fontWeight: 700, color: cuotaCalc.cubre ? "#047857" : "#B91C1C" } }, formatMXN(cuotaCalc.nuevoTotal))
            ),
            React.createElement("div", { style: { background: "#FEF3C7", borderRadius: 8, padding: 12 } },
              React.createElement("p", { style: { fontSize: 10, color: "#92400E", textTransform: "uppercase", marginBottom: 4 } }, "Meta a cubrir"),
              React.createElement("p", { style: { fontSize: 16, fontWeight: 700, color: "#92400E" } }, formatMXN(cuotaCalc.faltaMonto))
            )
          ),
          // Diagnóstico
          !cuotaCalc.cubre && React.createElement("div", { style: { padding: 12, background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#991B1B" } },
            "⚠ Aún subiendo TODOS los SKUs al agresivo (120 días) no se cubre el gap. " +
            "Faltarían " + formatMXN(cuotaCalc.faltaMonto - (cuotaCalc.nuevoTotal - cuotaCalc.totalActualPropuesta) - cuotaCalc.totalActualPropuesta) + " adicionales. Considera negociar promociones extra."),
          cuotaCalc.cubre && cuotaCalc.skusAfectados === 0 && React.createElement("div", { style: { padding: 12, background: "#F0FDF4", border: "1px solid #A7F3D0", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#065F46" } },
            "✓ Si el cliente compra TODA la propuesta actual, la meta queda cubierta. No hace falta subir más SKUs."),
          // Lista de SKUs afectados
          cuotaCalc.skusUsados.length > 0 && React.createElement("div", { style: { border: "1px solid #E2E8F0", borderRadius: 8, overflow: "hidden", maxHeight: 280, overflowY: "auto" } },
            React.createElement("table", { style: { width: "100%", fontSize: 12, borderCollapse: "collapse" } },
              React.createElement("thead", null,
                React.createElement("tr", { style: { background: "#F8FAFC", borderBottom: "1px solid #E2E8F0", position: "sticky", top: 0 } },
                  React.createElement("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "SKU"),
                  React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Actual"),
                  React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Nuevo"),
                  React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Δ pzs"),
                  React.createElement("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Δ monto")
                )
              ),
              React.createElement("tbody", null,
                cuotaCalc.skusUsados.slice(0, 80).map((c) =>
                  React.createElement("tr", { key: c.sku, style: { borderBottom: "1px solid #F1F5F9" } },
                    React.createElement("td", { style: { padding: "6px 10px", fontFamily: "ui-monospace,monospace", fontWeight: 600, color: "#1E293B" } }, c.sku),
                    React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: "#475569" } }, (c.sugActual || 0).toLocaleString("es-MX")),
                    React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: "#047857", fontWeight: 600 } }, (c.sugNuevo || 0).toLocaleString("es-MX")),
                    React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: "#7C3AED" } }, "+" + (c.delta || 0).toLocaleString("es-MX")),
                    React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: "#065F46", fontWeight: 600 } }, "+" + formatMXN(c.montoExtra || 0))
                  )
                )
              )
            )
          ),
          // Footer botones
          React.createElement("div", { style: { display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18, paddingTop: 16, borderTop: "1px solid #F1F5F9" } },
            React.createElement("button", {
              onClick: () => setCuotaCalc(null),
              style: { padding: "8px 16px", background: "#fff", color: "#475569", border: "1px solid #CBD5E1", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }
            }, "Cancelar"),
            cuotaCalc.cubre && cuotaCalc.skusAfectados > 0 && React.createElement("button", {
              onClick: aplicarCuotaCalc,
              style: { padding: "8px 18px", background: "#1E40AF", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }
            }, "Aplicar a " + cuotaCalc.skusAfectados + " SKUs")
          )
        )
      ),

  );
}