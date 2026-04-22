import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED, fetchAllPagesREST } from '../../lib/supabase';
import { formatMXN, loadSheetJS } from '../../lib/utils';

export default function EstrategiaProducto({ cliente, clienteKey, onUploadComplete }) {
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
        const sku = String(f["SKU Cliente"] || "").trim();
        if (sku && sku !== "TOTAL") set.add(sku);
      });
    });
    return set;
  }, [propuestasHist]);

  // Cerrar propuesta (pasa de pendiente → cerrada, sus SKUs vuelven a aparecer en riesgo)
  const cerrarPropuesta = async (id) => {
    if (!confirm("¿Marcar esta propuesta como cerrada? Los SKUs volverán a aparecer en riesgo de desabasto si aplica.")) return;
    const { error } = await supabase.from("propuestas_compra")
      .update({ estatus: "cerrada", cerrada_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { alert("Error: " + error.message); return; }
    await cargarPropuestasCompra();
  };
  const reactivarPropuesta = async (id) => {
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

      const [productos, sellIn, sellOut, inventario, invActeck, transito, roadmap, precios,
             histPcel, snapshotPcel, dglCategoriasRaw] = await Promise.all([
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
      ]);

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

    const sellInTotal = datos.sellIn.reduce((s, r) => s + (r.monto_pesos || 0), 0);
    const sellInPiezas = datos.sellIn.reduce((s, r) => s + (r.piezas || 0), 0);
    const sellOutTotal = datos.sellOut.reduce((s, r) => s + (r.monto_pesos || 0), 0);
    const sellOutPiezas = datos.sellOut.reduce((s, r) => s + (r.piezas || 0), 0);
    const invTotal = datos.inventario.reduce((s, r) => s + (r.valor || 0), 0);
    const invPiezas = datos.inventario.reduce((s, r) => s + (r.stock || 0), 0);

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
    // Eficiencia SI/SO
    const efi = aggs.sellInTotal > 0 && aggs.sellOutTotal > 0 ? (aggs.sellOutTotal / aggs.sellInTotal * 100) : 0;
    // SKUs activos (con ventas YTD o inventario > 0)
    const skusConVenta = new Set();
    datos.sellIn.forEach(r => skusConVenta.add(r.sku));
    datos.sellOut.forEach(r => skusConVenta.add(r.sku));
    const skusActivos = skusConVenta.size;
    const skusConInv = datos.inventario.filter(r => (Number(r.stock) || 0) > 0).length;
    // Días de cobertura
    const mesesConDatos = Math.max(1, new Set(datos.sellOut.map(r => Number(r.mes) || 0).filter(m => m > 0 && m < new Date().getMonth() + 1)).size);
    const soDiario = mesesConDatos > 0 ? aggs.sellOutTotal / (mesesConDatos * 30) : 0;
    const diasCob = soDiario > 0 ? Math.round(aggs.invTotal / soDiario) : null;
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
    return { efi, skusActivos, skusConInv, diasCob, invActeckPiezas, sugPiezas, sugMonto, sugSkus };
  }, [datos, aggs, clienteKey]);

  // SKUs en riesgo de desabasto — reusa el sugerido del Detalle por SKU
  // para consistencia. Usa los mismos overrides (sugeridoEdits) que el usuario
  // haya editado en la tabla principal.
  const skusRiesgo = React.useMemo(() => {
    if (!datos) return [];
    const mesActual = new Date().getMonth() + 1;
    const transitoBySku = datos.transitoBySku || {};
    const actStockBySku = datos.actStockBySku || {};
    const riesgo = [];

    // Iteramos sobre productos (catálogo), igual que skuDetail
    (datos.productos || []).forEach(p => {
      const skuExterno = (clienteKey === 'pcel' && p.modelo) ? p.modelo : p.sku;
      const soData = datos.sellOut.filter(r => r.sku === p.sku);
      const soSinMes = soData.filter(r => Number(r.mes) < mesActual);
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

      // Sugerido: mismo valor que en Detalle por SKU
      // Buscamos en skuDetail (computado en el useMemo paralelo) para tomar
      // el mismo número ya calculado con overrides. Como skuDetail se calcula
      // después, usamos una fórmula equivalente inline pero respetando override.
      const sinStock = clienteKey === "pcel" && invActeck === 0 && invTransito === 0;
      let sugerido = 0;
      if (!sinStock && clienteKey === "pcel") {
        // Fórmula PCEL simplificada: meta 3m cobertura, cap Acteck, mínimo 20
        const disponibleActeck = invActeck + invTransito;
        const META = 3, MIN = 20;
        if (disponibleActeck >= MIN && prom > 0) {
          const base = META * prom;
          const transPcel = 0; // Riesgo no carga transito PCEL aquí (lo tiene skuDetail)
          const ideal = Math.max(0, Math.round(base - stock - transPcel));
          sugerido = Math.min(ideal, disponibleActeck);
          if (sugerido > 0 && sugerido < MIN) sugerido = MIN;
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
  const skuDetail = React.useMemo(() => {
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

        const stock = invData?.stock || 0;
        const valorInv = invData?.valor || 0;

        // Acteck inventory (9 almacenes) + tránsito — usan skuExterno (modelo para PCEL)
        const invActeck = (datos.actStockBySku && datos.actStockBySku[skuExterno]) || 0;
        const invTransito = (datos.transitoBySku && datos.transitoBySku[skuExterno]) || 0;

        // ═══ Campos específicos PCEL ═══
        // backOrder y transito vienen de sellout_pcel (usa SKU numérico = p.sku)
        const backOrder    = (datos.backOrderBySkuPcel && datos.backOrderBySkuPcel[p.sku]) || 0;
        const transPcel    = (datos.transitoPcelBySku  && datos.transitoPcelBySku[p.sku])  || 0;
        // histPcel viene de ventas_erp por articulo (= modelo Acteck)
        const histPcelSku  = (datos.histPcel && (datos.histPcel[skuExterno] || datos.histPcel[p.sku])) || null;
        const promCompra   = histPcelSku ? Math.round(histPcelSku.promedio) : 0;
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
          // FÓRMULA DIGITALIFE/ML v3 (original)
          // Regla 1: si invActeck < 10, sugerido = 0 (no se puede reponer)
          // Regla 2: tránsito NO cuenta (solo invActeck real)
          // Regla 3: cobertura objetivo = 90 días × factor estacional
          // Regla 4: mínimo 20 piezas cuando sugerido > 0
          // Regla 5: cap al invActeck
          if (invActeck >= 10 && promedio90d > 0) {
            const necesidad = (promedio90d * 3 * factorEstacional) - stock;
            sugerido = Math.max(0, Math.round(necesidad));
            if (sugerido > 0 && sugerido < 20) sugerido = 20;
            sugerido = Math.min(sugerido, invActeck);
          }
        }

        const precioSku = Number(p.precio_venta) > 0 ? Number(p.precio_venta) : Number(invData && invData.precio_venta || 0);
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
          facturasHist,
          isActivo,
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
      })
      .sort((a, b) => {
        // Resolver valor efectivo — considerar overrides manuales del usuario
        const resolver = (r) => {
          if (sortCol === "sugerido") {
            return sugeridoEdits[r.sku] !== undefined
              ? Number(sugeridoEdits[r.sku])
              : Number(r.sugerido) || 0;
          }
          if (sortCol === "precioAAAcd" && clienteKey === "pcel") {
            return precioEdits[r.sku] !== undefined
              ? Number(precioEdits[r.sku])
              : Number(r.precioAAAcd) || 0;
          }
          const v = r[sortCol];
          return typeof v === "number" ? v : (Number(v) || 0);
        };
        const valA = resolver(a);
        const valB = resolver(b);
        return sortDir === "asc" ? valA - valB : valB - valA;
      });
    }, [datos, searchFilter, categoriaFilter, sortCol, sortDir, clienteKey, soloActivosPcel, sugeridoEdits, precioEdits]);

  // Export to Excel
  const handleSort = (col) => { if (sortCol === col) { setSortDir(sortDir === "desc" ? "asc" : "desc"); } else { setSortCol(col); setSortDir("desc"); } };
    const sortArrow = (col) => sortCol === col ? (sortDir === "desc" ? " \u25BC" : " \u25B2") : " \u25B7";
    const thSort = (label, col) => React.createElement("th", { onClick: () => handleSort(col), style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === col ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" } }, label + sortArrow(col));

      // Export específico para PCEL: columnas pensadas para la propuesta de
      // compra al cliente + equipo interno.
      const exportToExcelPcel = async () => {
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
    if (clienteKey === "pcel") return exportToExcelPcel();
    const XLSX = await loadSheetJS();
    if (!XLSX) { alert("Error cargando librería Excel"); return; }

    // 1) Armar filas simplificadas para propuesta al cliente
    // Descripción larga (payload 'Descripcion 2') para Excel; fallback a la corta
    const allRows = skuDetail.map(function(s) {
      const sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
      const precio = Number(s.precio || 0);
      const total = sug * precio;
      return {
        SKU: s.sku,
        "Descripción": s.descripcionLarga || s.descripcion || "",
        "Stock Cliente": Number(s.stock) || 0,
        "Promedio 90d": Number(s.promedio90d) || 0,
        "Sugerido": sug,
        "Precio": precio,
        "Total": total,
        _sug: sug, _total: total, _cat: (s.categoria || "").toLowerCase(),
      };
    }).filter(r => r._sug > 0 && r._total > 0);

    // 2) Clasificar por categoría → 3 hojas: Monitores / Sillas / Otros
    const isMonitor = (c) => c.includes("monitor");
    const isSilla = (c) => c.includes("silla");
    const monitores = allRows.filter(r => isMonitor(r._cat));
    const sillas = allRows.filter(r => isSilla(r._cat));
    const otros = allRows.filter(r => !isMonitor(r._cat) && !isSilla(r._cat));

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

    // 3) Hoja Resumen: totales por categoría
    const sumBy = (arr, key) => arr.reduce((a, r) => a + (r[key] || 0), 0);
    const resumenRows = [
      { "Categoría": "Monitores", "# SKUs": monitores.length, "Piezas": sumBy(monitores, "_sug"), "Total $": sumBy(monitores, "_total") },
      { "Categoría": "Sillas", "# SKUs": sillas.length, "Piezas": sumBy(sillas, "_sug"), "Total $": sumBy(sillas, "_total") },
      { "Categoría": "Otros", "# SKUs": otros.length, "Piezas": sumBy(otros, "_sug"), "Total $": sumBy(otros, "_total") },
      { "Categoría": "GRAN TOTAL", "# SKUs": allRows.length, "Piezas": sumBy(allRows, "_sug"), "Total $": sumBy(allRows, "_total") },
    ];

    const wb = XLSX.utils.book_new();
    const resumenWs = XLSX.utils.json_to_sheet(resumenRows);
    applyNumFmt(resumenWs, resumenRows);
    XLSX.utils.book_append_sheet(wb, resumenWs, "Resumen");
    XLSX.utils.book_append_sheet(wb, makeSheet(monitores, "Monitores"), "Monitores");
    XLSX.utils.book_append_sheet(wb, makeSheet(sillas, "Sillas"), "Sillas");
    XLSX.utils.book_append_sheet(wb, makeSheet(otros, "Otros"), "Otros");

    // Nombre del archivo: "Sugerido Digitalife Abril 2026.xlsx"
    const hoy = new Date();
    const mesesCap = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
    const mesNombre = mesesCap[hoy.getMonth()];
    const anioActual = hoy.getFullYear();
    // Nombre legible del cliente
    const nombreCliente = clienteKey === "digitalife" ? "Digitalife"
                        : clienteKey === "mercadolibre" ? "Mercado Libre"
                        : (cliente || clienteKey || "Cliente");
    XLSX.writeFile(wb, `Sugerido ${nombreCliente} ${mesNombre} ${anioActual}.xlsx`);
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
        React.createElement("button", {
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium",
          onClick: () => document.getElementById("file-input-update").click(),
        }, "📤 Actualizar datos"),
        React.createElement("input", {
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

    // Summary Cards — 7 KPIs
    aggs && kpis && React.createElement("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 } },
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: "#3B82F6" } },
        React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "Sell In"),
        React.createElement("p", { style: { fontSize: 22, fontWeight: 700, color: "#1E293B", marginBottom: 2 } }, formatMXN(aggs.sellInTotal)),
        React.createElement("p", { style: { fontSize: 11, color: "#64748B" } }, aggs.sellInPiezas.toLocaleString("es-MX") + " pzs \u00b7 Mayor: " + (MESES_ABREV[aggs.maxSIMes] || "\u2014"))
      ),
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: "#8B5CF6" } },
        React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "Sell Out"),
        React.createElement("p", { style: { fontSize: 22, fontWeight: 700, color: "#1E293B", marginBottom: 2 } }, formatMXN(aggs.sellOutTotal)),
        React.createElement("p", { style: { fontSize: 11, color: "#64748B" } }, aggs.sellOutPiezas.toLocaleString("es-MX") + " pzs \u00b7 Mayor: " + (MESES_ABREV[aggs.maxSOMes] || "\u2014"))
      ),
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: kpis.efi >= 90 && kpis.efi <= 110 ? "#10B981" : (kpis.efi >= 70 || kpis.efi > 110) ? "#F59E0B" : "#EF4444" } },
        React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "Eficiencia SI/SO"),
        React.createElement("p", { style: { fontSize: 22, fontWeight: 700, color: kpis.efi >= 90 && kpis.efi <= 110 ? "#10B981" : (kpis.efi >= 70 || kpis.efi > 110) ? "#F59E0B" : "#EF4444", marginBottom: 2 } }, kpis.efi.toFixed(1) + "%"),
        React.createElement("p", { style: { fontSize: 11, color: "#64748B" } }, kpis.efi >= 90 && kpis.efi <= 110 ? "\u2713 Balance ideal" : kpis.efi > 110 ? "Reduciendo stock" : "Acumulando stock")
      ),
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: "#06B6D4" } },
        React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "SKUs Activos"),
        React.createElement("p", { style: { fontSize: 22, fontWeight: 700, color: "#1E293B", marginBottom: 2 } }, kpis.skusActivos.toLocaleString("es-MX")),
        React.createElement("p", { style: { fontSize: 11, color: "#64748B" } }, kpis.skusConInv + " con inventario")
      ),
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: kpis.diasCob === null ? "#94A3B8" : (kpis.diasCob >= 80 && kpis.diasCob <= 120) ? "#10B981" : (kpis.diasCob >= 60 && kpis.diasCob <= 140) ? "#F59E0B" : "#EF4444" } },
        React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "D\u00edas Cobertura"),
        React.createElement("p", { style: { fontSize: 22, fontWeight: 700, color: "#1E293B", marginBottom: 2 } }, kpis.diasCob === null ? "\u2014" : (kpis.diasCob + "d")),
        React.createElement("p", { style: { fontSize: 11, color: "#64748B" } }, kpis.diasCob === null ? "Sin datos" : (kpis.diasCob >= 90 && kpis.diasCob <= 110) ? "\u2713 Ideal (90-110d)" : kpis.diasCob < 70 ? "\u26a0 Desabasto" : kpis.diasCob > 130 ? "\u26a0 Sobreinventario" : "Cercano al rango")
      ),
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: "#F59E0B" } },
        React.createElement("p", { style: { fontSize: 10, color: "#94A3B8", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "Inventario"),
        React.createElement("p", { style: { fontSize: 18, fontWeight: 700, color: "#1E293B", marginBottom: 2 } }, "Cliente: " + formatMXN(aggs.invTotal)),
        React.createElement("p", { style: { fontSize: 11, color: "#64748B" } }, "Acteck disp: " + kpis.invActeckPiezas.toLocaleString("es-MX") + " pzs")
      ),
      React.createElement("div", { className: "bg-white rounded-xl shadow-sm p-4 border-t-4", style: { borderColor: kpis.sugMonto > 0 ? "#10B981" : "#94A3B8", background: kpis.sugMonto > 0 ? "#F0FDF4" : "#fff" } },
        React.createElement("p", { style: { fontSize: 10, color: "#065F46", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4, fontWeight: 600 } }, "\ud83d\udca1 Sugerido Total"),
        React.createElement("p", { style: { fontSize: 22, fontWeight: 700, color: kpis.sugMonto > 0 ? "#047857" : "#94A3B8", marginBottom: 2 } }, formatMXN(kpis.sugMonto)),
        React.createElement("p", { style: { fontSize: 11, color: "#065F46" } }, kpis.sugSkus + " SKUs \u00b7 " + kpis.sugPiezas.toLocaleString("es-MX") + " pzs")
      )
    ),

    // Marca Comparison
    aggs && React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("h3", { className: "font-bold text-gray-800 mb-4" }, "Comparativa por Marca"),
            // Visual bar chart for brand comparison
            React.createElement("div", { style: { display: "flex", gap: 20, marginBottom: 20, flexWrap: "wrap" } },
              Object.entries(aggs.byMarca).map(function([marca, m]) {
                var total = Object.values(aggs.byMarca).reduce(function(s, x) { return s + x.soMonto; }, 0);
                var pct = total > 0 ? (m.soMonto / total * 100) : 0;
                var color = MARCA_COLORES[marca] || "#64748B";
                return React.createElement("div", { key: "viz_"+marca, style: { flex: 1, minWidth: 200, background: "#F8FAFC", borderRadius: 12, padding: 16, border: "1px solid #E2E8F0" } },
                  React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 } },
                    React.createElement("span", { style: { fontWeight: 700, color: color, fontSize: 14 } }, marca),
                    React.createElement("span", { style: { fontSize: 12, color: "#94A3B8", fontWeight: 600 } }, pct.toFixed(1) + "% del SO")
                  ),
                  React.createElement("div", { style: { height: 8, background: "#E2E8F0", borderRadius: 4, marginBottom: 12 } },
                    React.createElement("div", { style: { height: "100%", width: pct + "%", background: color, borderRadius: 4 } })
                  ),
                  React.createElement("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 12 } },
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Sell In"),
                      React.createElement("div", { style: { fontWeight: 700, color: "#1E293B" } }, formatMXN(m.siMonto))
                    ),
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Sell Out"),
                      React.createElement("div", { style: { fontWeight: 700, color: "#10B981" } }, formatMXN(m.soMonto))
                    ),
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Inventario"),
                      React.createElement("div", { style: { fontWeight: 700, color: "#8B5CF6" } }, formatMXN(m.invValor))
                    ),
                    React.createElement("div", null,
                      React.createElement("div", { style: { color: "#94A3B8" } }, "Eficiencia"),
                      React.createElement("div", { style: { fontWeight: 700, color: m.siMonto > 0 ? (m.soMonto/m.siMonto >= 0.8 ? "#10B981" : "#F59E0B") : "#94A3B8" } }, m.siMonto > 0 ? (m.soMonto/m.siMonto*100).toFixed(0) + "%" : "\u2014")
                    )
                  )
                );
              })
            ),
      React.createElement("div", { className: "overflow-x-auto" },
        React.createElement("table", { className: "w-full text-sm" },
          React.createElement("thead", {},
            React.createElement("tr", { className: "border-b border-gray-200" },
              React.createElement("th", { className: "text-left py-2 px-3 font-semibold text-gray-700" }, "Marca"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SI Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SI $"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SO Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SO $"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Inv Piezas"),
              React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Inv Valor"),
            ),
          ),
          React.createElement("tbody", {},
            Object.entries(aggs.byMarca).map(([marca, m]) =>
              React.createElement("tr", { key: marca, className: "border-b border-gray-100 hover:bg-gray-50" },
                React.createElement("td", { className: "py-3 px-3 text-gray-700 font-medium" }, marca),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, m.siPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(m.siMonto)),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, m.soPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(m.soMonto)),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, m.invPiezas.toLocaleString("es-MX")),
                React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(m.invValor)),
              )
            ),
          ),
        ),
      ),
    ),

    // By Categoria
    aggs && Object.keys(aggs.byCategoria).length > 0 && React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
        React.createElement("h3", { className: "font-bold text-gray-800 mb-4" }, "Por Categor\u00eda (ambas marcas)"),
        React.createElement("div", { className: "overflow-x-auto" },
          React.createElement("table", { className: "w-full text-sm" },
            React.createElement("thead", {},
              React.createElement("tr", { className: "border-b border-gray-200" },
                React.createElement("th", { className: "text-left py-2 px-3 font-semibold text-gray-700" }, "Categor\u00eda"),
                React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Valor Inventario"),
                React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "Sell Out $"),
                React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "% SO"),
                React.createElement("th", { className: "text-right py-2 px-3 font-semibold text-gray-700" }, "SKUs c/Inv"),
              ),
            ),
            React.createElement("tbody", {},
              (function() {
                var totalSO = Object.values(aggs.byCategoria).reduce(function(s,c){return s+c.soMonto;},0);
                return Object.entries(aggs.byCategoria).sort(function(a,b){return b[1].soMonto-a[1].soMonto;}).map(function(entry) {
                  var cat = entry[0]; var c = entry[1];
                  var pct = totalSO > 0 ? (c.soMonto/totalSO*100).toFixed(1) : "0.0";
                  return React.createElement("tr", { key: cat, className: "border-b border-gray-100 hover:bg-gray-50" },
                    React.createElement("td", { className: "py-3 px-3 text-gray-700 font-medium" }, cat),
                    React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(c.invValor)),
                    React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, formatMXN(c.soMonto)),
                    React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, pct + "%"),
                    React.createElement("td", { className: "text-right py-3 px-3 text-gray-600" }, c.invPiezas > 0 ? c.invPiezas.toLocaleString("es-MX") : "0"),
                  );
                });
              })(),
            ),
          ),
        ),
      ),
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

      // Roadmap + Tránsito — catálogo completo con productos nuevos detectados
      roadmapCruce && React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 } },
          React.createElement("h3", { className: "font-bold text-gray-800" }, "\uD83D\uDCCB Roadmap + Tr\u00e1nsito"),
          React.createElement("div", { style: { fontSize: 12, color: "#64748B" } },
            "Roadmap: " + roadmapCruce.total + " SKUs \u00b7 En camino: " + roadmapCruce.enCamino.length + " \u00b7 ",
            React.createElement("span", { style: { color: "#059669", fontWeight: 700 } }, "Nuevos: " + roadmapCruce.nuevos.length)
          )
        ),
        // Productos NUEVOS (en tránsito sin roadmap, solo AC/BR) — al principio, destacados
        roadmapCruce.nuevos.length > 0 && (function() {
          var nuevosFiltrados = nuevosSearch
            ? roadmapCruce.nuevos.filter(function(t) {
                var q = nuevosSearch.toLowerCase();
                return (t.sku || "").toLowerCase().includes(q) || (t.descripcion || "").toLowerCase().includes(q);
              })
            : roadmapCruce.nuevos;
          return React.createElement("div", { style: { background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: 14, marginBottom: 16 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" } },
              React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#065F46", display: "flex", alignItems: "center", gap: 6 } },
                "\uD83C\uDD95 Productos NUEVOS detectados (en tr\u00e1nsito, no est\u00e1n en roadmap) \u2014 " + roadmapCruce.nuevos.length + " SKUs"
              ),
              React.createElement("input", {
                type: "text", placeholder: "Buscar SKU o descripci\u00f3n...",
                value: nuevosSearch,
                onChange: function(e) { setNuevosSearch(e.target.value); },
                style: { padding: "5px 10px", border: "1px solid #A7F3D0", borderRadius: 6, fontSize: 12, width: 220, background: "#fff" }
              })
            ),
            React.createElement("div", { style: { overflowX: "auto", maxHeight: 400, overflowY: "auto" } },
              React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
                React.createElement("thead", null,
                  React.createElement("tr", { style: { background: "#D1FAE5", borderBottom: "1px solid #A7F3D0", position: "sticky", top: 0 } },
                    React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#065F46" } }, "SKU"),
                    React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#065F46" } }, "Descripci\u00f3n"),
                    React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontWeight: 600, color: "#065F46", width: 90 } }, "Piezas"),
                    React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#065F46", width: 160 } }, "Arribo a CEDIS")
                  )
                ),
                React.createElement("tbody", null,
                  nuevosFiltrados.map(function(t) {
                    var arriboTxt = t.arribo ? (t.cedis ? (t.arribo + " \u00b7 " + t.cedis) : t.arribo) : "Sin fecha";
                    return React.createElement("tr", { key: t.sku, style: { borderBottom: "1px solid #D1FAE5" } },
                      React.createElement("td", { style: { padding: "6px 10px", fontWeight: 600, color: "#065F46", fontFamily: "ui-monospace,monospace" } }, t.sku),
                      React.createElement("td", { style: { padding: "6px 10px", color: "#1E293B", maxWidth: 420, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: t.descripcion }, t.descripcion),
                      React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: "#047857", fontWeight: 700 } }, t.piezas.toLocaleString("es-MX")),
                      React.createElement("td", { style: { padding: "6px 10px", color: "#065F46", fontSize: 11 } }, arriboTxt)
                    );
                  })
                )
              )
            )
          );
        })(),
        // En camino (roadmap + tránsito) — ahora con Inv Acteck actual
        roadmapCruce.enCamino.length > 0 && (function() {
          var enCaminoFiltrados = enCaminoSearch
            ? roadmapCruce.enCamino.filter(function(r) {
                var q = enCaminoSearch.toLowerCase();
                return (r.sku || "").toLowerCase().includes(q) || (r.descripcion || "").toLowerCase().includes(q);
              })
            : roadmapCruce.enCamino;
          return React.createElement("div", { style: { marginBottom: 16 } },
            React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" } },
              React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#1E40AF", display: "flex", alignItems: "center", gap: 6 } },
                "\uD83D\uDEA2 En camino (llegando seg\u00fan roadmap) \u2014 " + roadmapCruce.enCamino.length + " SKUs"
              ),
              React.createElement("input", {
                type: "text", placeholder: "Buscar SKU o descripci\u00f3n...",
                value: enCaminoSearch,
                onChange: function(e) { setEnCaminoSearch(e.target.value); },
                style: { padding: "5px 10px", border: "1px solid #BFDBFE", borderRadius: 6, fontSize: 12, width: 220, background: "#fff" }
              })
            ),
            React.createElement("div", { style: { overflowX: "auto", maxHeight: 400, overflowY: "auto" } },
              React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
                React.createElement("thead", null,
                  React.createElement("tr", { style: { background: "#DBEAFE", position: "sticky", top: 0 } },
                    React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#1E40AF" } }, "SKU"),
                    React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#1E40AF" } }, "Descripci\u00f3n"),
                    React.createElement("th", { style: { textAlign: "center", padding: "6px 10px", fontWeight: 600, color: "#1E40AF", width: 80 } }, "Roadmap"),
                    React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontWeight: 600, color: "#1E40AF", width: 100 } }, "Inv Acteck"),
                    React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontWeight: 600, color: "#1E40AF", width: 100 } }, "Piezas"),
                    React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#1E40AF", width: 180 } }, "Arribo a CEDIS")
                  )
                ),
                React.createElement("tbody", null,
                  enCaminoFiltrados.map(function(r, i) {
                    var arriboTxt = r.arribo ? (r.cedis ? (r.arribo + " \u00b7 " + r.cedis) : r.arribo) : "\u2014";
                    return React.createElement("tr", { key: r.sku, style: { borderBottom: "1px solid #f1f5f9", background: i % 2 === 0 ? "#fff" : "#FAFBFC" } },
                      React.createElement("td", { style: { padding: "6px 10px", fontFamily: "ui-monospace,monospace", color: "#1E293B" } }, r.sku),
                      React.createElement("td", { style: { padding: "6px 10px", color: "#475569", maxWidth: 340, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: r.descripcion }, (r.descripcion || "").slice(0, 80)),
                      React.createElement("td", { style: { padding: "6px 10px", textAlign: "center" } },
                        React.createElement("span", { style: { padding: "2px 8px", borderRadius: 6, background: ESTADO_COLORES[r.rdmp] || "#64748B", color: "#fff", fontSize: 10, fontWeight: 600 } }, r.rdmp || "-")
                      ),
                      React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: r.invActeck > 0 ? "#1E293B" : "#94A3B8", fontWeight: r.invActeck > 0 ? 600 : 400 } }, r.invActeck.toLocaleString("es-MX")),
                      React.createElement("td", { style: { padding: "6px 10px", textAlign: "right", color: "#1E40AF", fontWeight: 600 } }, r.piezas.toLocaleString("es-MX")),
                      React.createElement("td", { style: { padding: "6px 10px", color: "#475569", fontSize: 11 } }, arriboTxt)
                    );
                  })
                )
              )
            )
          );
        })()
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
              React.createElement("button", {
                onClick: exportToExcel,
                style: { padding: "8px 16px", background: "#10B981", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer", fontWeight: 600 }
              }, "\uD83D\uDCE5 Exportar Excel"),
            ),
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
                // Columnas específicas PCEL
                (clienteKey === "pcel") && React.createElement("th", {
                  key: "th-bo", onClick: () => handleSort("backOrder"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "backOrder" ? "#1D4ED8" : "#B91C1C", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#FEF2F2" }
                }, "Back Order" + sortArrow("backOrder")),
                (clienteKey === "pcel") && React.createElement("th", {
                  key: "th-pc", onClick: () => handleSort("promCompra"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "promCompra" ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#FEF3C7" },
                  title: "Promedio de piezas por compra (últimos 6 meses, ventas_erp)"
                }, "Prom compra" + sortArrow("promCompra")),
                thSort("Sugerido", "sugerido"),
                // Columnas adicionales para PCEL: Precio AAA C/desc + Próx. arribo si falta
                (clienteKey === "pcel") && React.createElement("th", {
                  key: "th-aaa", onClick: () => handleSort("precioAAAcd"),
                  style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === "precioAAAcd" ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none", background: "#F0F9FF" },
                  title: "Precio AAA con descuento aplicado"
                }, "Precio" + sortArrow("precioAAAcd")),
                (clienteKey === "pcel") && React.createElement("th", {
                  key: "th-arr",
                  style: { textAlign: "left", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", background: "#FEF3C7" },
                  title: "Fecha de próximo arribo si el sugerido no se completa con inv Acteck"
                }, "Pr\u00f3x. arribo (falta)"),
                // Para PCEL se oculta la columna "Precio" genérica (precio_venta de productos_cliente
                // está casi siempre vacío para PCEL); el precio real es "Precio AAA c/desc" de arriba.
                (clienteKey !== "pcel") && React.createElement("th", { key: "th-precio-gen", style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, "Precio"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 6px", fontWeight: 700, color: "#065F46", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", background: "#ECFDF5" } },
                  React.createElement("div", { style: { fontSize: 10, color: "#10B981", fontWeight: 600 } }, "Σ " + formatMXN((skuDetail || []).reduce(function(acc, r){ var sug = sugeridoEdits[r.sku] !== undefined ? Number(sugeridoEdits[r.sku]) : Number(r.sugerido || 0); var precioBase = clienteKey === "pcel" ? (precioEdits[r.sku] !== undefined ? Number(precioEdits[r.sku]) : Number(r.precioAAAcd || 0)) : Number(r.precio || 0); return acc + sug * precioBase; }, 0))),
                  React.createElement("div", {}, "Total")
                ),
              ),
            ),
            React.createElement("tbody", {},
              skuDetail.map(function(s, idx) {
                return React.createElement("tr", { key: s.sku, style: { borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFC" } },
                  // PCEL: primera columna es SKU Cliente (numérico, s.sku), segunda es SKU (modelo = s.modelo)
                  // Otros clientes: una sola columna SKU (= s.sku)
                  (clienteKey === "pcel") && React.createElement("td", { key: "td-skuc", style: { padding: "6px", fontWeight: 500, color: "#475569", whiteSpace: "nowrap", fontSize: 11 } }, s.sku),
                  React.createElement("td", { style: { padding: "6px", fontWeight: 500, color: "#1E293B", whiteSpace: "nowrap", fontSize: 11 } }, clienteKey === "pcel" ? (s.modelo || "—") : s.sku),
                  React.createElement("td", { style: { padding: "6px", fontSize: 11, maxWidth: 100, whiteSpace: "nowrap" }, title: s.roadmap || "Sin roadmap" },
                    (function() {
                      var rm = s.roadmap || "";
                      // Colores por tipo de roadmap
                      var bg, color;
                      if (rm === "D" || rm === "DISC") { bg = "#FEE2E2"; color = "#991B1B"; }           // Descontinuado
                      else if (rm === "NVS" || rm === "NEW") { bg = "#FEF3C7"; color = "#92400E"; }    // Nuevo
                      else if (rm === "RMI") { bg = "#DBEAFE"; color = "#1E40AF"; }                    // Roadmap Importar
                      else if (rm === "RML" || rm === "RMS") { bg = "#EDE9FE"; color = "#5B21B6"; }    // Roadmap Local/Stock
                      else if (rm === "2026" || rm === "2025") { bg = "#D1FAE5"; color = "#065F46"; }  // Activo año
                      else if (rm && rm.length > 0) { bg = "#F1F5F9"; color = "#475569"; }
                      else { bg = "#F8FAFC"; color = "#94A3B8"; }
                      return React.createElement("span", { style: { padding: "2px 8px", borderRadius: 4, background: bg, color: color, fontSize: 10, fontWeight: 700 } }, rm || "—");
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
                  // Columnas específicas PCEL
                  (clienteKey === "pcel") && React.createElement("td", {
                    key: "td-bo",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, background: s.backOrder > 0 ? "#FEE2E2" : "#FEF2F2", color: s.backOrder > 0 ? "#991B1B" : "#CBD5E1", fontWeight: s.backOrder > 0 ? 700 : 400 }
                  }, s.backOrder > 0 ? s.backOrder.toLocaleString("es-MX") : "-"),
                  (clienteKey === "pcel") && React.createElement("td", {
                    key: "td-pc",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, background: "#FFFBEB", color: s.promCompra > 0 ? "#78350F" : "#CBD5E1", fontWeight: 500 },
                    title: s.facturasHist > 0 ? (s.facturasHist + " compras hist\u00f3ricas") : "Sin hist\u00f3rico de compras"
                  }, s.promCompra > 0 ? s.promCompra.toLocaleString("es-MX") : "-"),
                  (function(){
                    // Gate: sin inventario ni tránsito → sugerido = 0 forzado
                    // (ignora override manual). Input disabled para que sea obvio.
                    const sinStock = clienteKey === "pcel"
                      && (Number(s.invActeck) || 0) === 0
                      && (Number(s.invTransito) || 0) === 0;
                    const valEff = sinStock ? 0
                      : (sugeridoEdits[s.sku] !== undefined ? sugeridoEdits[s.sku] : (s.sugerido || 0));
                    return React.createElement("td", { style: { textAlign: "right", padding: "6px", fontSize: 11, position: "relative" } },
                      React.createElement("input", {
                        type: "number", min: 0,
                        value: valEff,
                        disabled: sinStock,
                        title: sinStock ? "Sin inventario ni tránsito Acteck — no se puede sugerir" : undefined,
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
                    }, sugeridoSaveState[s.sku] === "saved" ? "\u2713" : sugeridoSaveState[s.sku] === "saving" ? "\u2026" : "!")
                  );
                  })(),
                  // PCEL: Precio editable — parece texto plano, pero al hover/focus se reveal
                  (clienteKey === "pcel") && React.createElement("td", {
                    key: "td-aaa",
                    style: { textAlign: "right", padding: "6px", fontSize: 11, whiteSpace: "nowrap", background: "#F0F9FF", position: "relative" }
                  },
                    React.createElement("input", {
                      type: "number", min: 0, step: "1",
                      value: precioEdits[s.sku] !== undefined
                        ? Math.round(Number(precioEdits[s.sku]) || 0)
                        : Math.round(Number(s.precioAAAcd) || 0),
                      onChange: function(e) {
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
                      title: precioEdits[s.sku] !== undefined
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
                  // PCEL: Próx. arribo (si falta) — mostrar cuando sugerido > invActeck
                  // Si hay fecha → fecha en español. Si hay piezas pero sin fecha → "N pzas en tránsito".
                  (clienteKey === "pcel") && (function() {
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
                  (clienteKey !== "pcel") && React.createElement("td", { key: "td-precio-gen", style: { textAlign: "right", padding: "6px", color: "#64748B", fontSize: 11, whiteSpace: "nowrap" } }, (s.precio && s.precio > 0) ? ("$" + Number(s.precio).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })) : "-"),
                  (function(){
                    var sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
                    // Para PCEL: override o precio AAA con descuento. Otros: precio_venta.
                    var precioBase = clienteKey === "pcel"
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
        // ═══ Historial de propuestas exportadas (solo PCEL) ═══
        (clienteKey === "pcel") && React.createElement("div", {
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
                        React.createElement("th", { style: { textAlign: "center", padding: "6px 10px", fontSize: 11, color: "#64748B", fontWeight: 600 } }, "Acciones"),
                      )
                    ),
                    React.createElement("tbody", null,
                      propuestasHist.map(p => {
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
                          React.createElement("td", { style: { padding: "6px 10px", textAlign: "center", whiteSpace: "nowrap" } },
                            React.createElement("button", {
                              onClick: () => descargarPropuestaHistorica(p),
                              style: { padding: "3px 8px", fontSize: 11, background: "#3B82F6", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", marginRight: 6 },
                              title: "Re-descargar Excel"
                            }, "\uD83D\uDCE5"),
                            esPend
                              ? React.createElement("button", {
                                  onClick: () => cerrarPropuesta(p.id),
                                  style: { padding: "3px 8px", fontSize: 11, background: "#fff", color: "#059669", border: "1px solid #6EE7B7", borderRadius: 4, cursor: "pointer", marginRight: 6 },
                                  title: "Cerrar propuesta (los SKUs volver\u00e1n a aparecer en riesgo si aplica)"
                                }, "\u2713 Cerrar")
                              : React.createElement("button", {
                                  onClick: () => reactivarPropuesta(p.id),
                                  style: { padding: "3px 8px", fontSize: 11, background: "#fff", color: "#1E40AF", border: "1px solid #BFDBFE", borderRadius: 4, cursor: "pointer", marginRight: 6 },
                                  title: "Reactivar propuesta"
                                }, "\u21bb Reactivar"),
                            React.createElement("button", {
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
  );
}



// ─── APP PRINCIPAL ────────────────────────────────────────────────────────────

// ——— MARKETING (Supabase) ———
const TIPO_ACTIVIDAD = {
  banner:     { label: "Banner",      color: "#8b5cf6", icon: "🖼️", tipo: "digital" },
  mailing:    { label: "Mailing",     color: "#3b82f6", icon: "📧", tipo: "digital" },
  reel:       { label: "Reel",        color: "#ec4899", icon: "🎬", tipo: "digital" },
  google_ads: { label: "Google Ads",  color: "#f59e0b", icon: "📢", tipo: "digital" },
  meta_ads:   { label: "Meta Ads",    color: "#6366f1", icon: "📱", tipo: "digital" },
  demo:       { label: "Demo Tienda", color: "#10b981", icon: "🏪", tipo: "presencial" },
  pop:        { label: "Material POP",color: "#14b8a6", icon: "🪧", tipo: "presencial" },
  taller:     { label: "Taller",      color: "#f97316", icon: "🔧", tipo: "presencial" },
};

const MKT_ESTATUS = [
  { value: "planeado",   label: "Planeado" },
  { value: "en_curso",   label: "En Curso" },
  { value: "completado", label: "Completado" },
  { value: "cancelado",  label: "Cancelado" },
];

const TEMPORALIDADES = {
  semana_santa: { label: "Semana Santa", emoji: "🐣", color: "#ffeaa7" },
  dia_nino:     { label: "Día del Niño", emoji: "🎈", color: "#fd79a8" },
  dia_madres:   { label: "Día Madres",   emoji: "💐", color: "#fab1a0" },
  dia_maestro:  { label: "Día Maestro",  emoji: "📚", color: "#74b9ff" },
  hot_sale:     { label: "HOT SALE",     emoji: "🔥", color: "#ff7675" },
  lluvias:      { label: "Temp. Lluvias",emoji: "🌧️", color: "#a29bfe" },
  buen_fin:     { label: "Buen Fin",     emoji: "🛒", color: "#e17055" },
  navidad:      { label: "Navidad",      emoji: "🎄", color: "#00b894" },
  regreso_clases:{ label: "Regreso Clases",emoji: "📓", color: "#fdcb6e" },
};

// rebuild 1776356434
