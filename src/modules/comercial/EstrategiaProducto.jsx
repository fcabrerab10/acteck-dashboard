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

  const formatMXN = (n) => {
    if (n == null || isNaN(n)) return "â";
    return "$" + Number(n).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const MARCA_COLORES = {
    "ACTECK": "#3B82F6",
    "Balam Rush": "#8B5CF6",
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
      const [productos, sellIn, sellOut, inventario, invActeck, transito] = await Promise.all([
        fetchAllPagesREST(`productos_cliente?select=*&cliente=eq.${clienteKey}`),
        fetchAllPagesREST(`sell_in_sku?select=*&cliente=eq.${clienteKey}&anio=eq.2026`),
        fetchAllPagesREST(`sellout_sku?select=*&cliente=eq.${clienteKey}&anio=eq.2026`),
        fetchAllPagesREST(`inventario_cliente?select=*&cliente=eq.${clienteKey}`),
        fetchAllPagesREST(`inventario_acteck?select=articulo,no_almacen,disponible&no_almacen=in.(${ACTECK_ALMACENES.join(',')})`),
        fetchAllPagesREST(`transito_sku?select=sku,inventario_transito`),
      ]);

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

      setDatos({
        productos, sellIn, sellOut, inventario,
        actStockBySku, transitoBySku,
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

    // By marca
    const byMarca = {};
    datos.productos.forEach(p => {
      if (!byMarca[p.marca]) byMarca[p.marca] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      const siForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const siMontoForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const soForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const soMontoForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const invForSku = datos.inventario.find(r => r.sku === p.sku);
      byMarca[p.marca].siPiezas += siForSku;
      byMarca[p.marca].siMonto += siMontoForSku;
      byMarca[p.marca].soPiezas += soForSku;
      byMarca[p.marca].soMonto += soMontoForSku;
      if (invForSku) {
        byMarca[p.marca].invPiezas += invForSku.stock || 0;
        byMarca[p.marca].invValor += invForSku.valor || 0;
      }
    });

    // By categoria
    const byCategoria = {};
    datos.productos.forEach(p => {
      const cat = p.categoria || "Sin CategorÃ­a";
      if (!byCategoria[cat]) byCategoria[cat] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      const siForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const siMontoForSku = datos.sellIn.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const soForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.piezas || 0), 0);
      const soMontoForSku = datos.sellOut.filter(r => r.sku === p.sku).reduce((s, r) => s + (r.monto_pesos || 0), 0);
      const invForSku = datos.inventario.find(r => r.sku === p.sku);
      byCategoria[cat].siPiezas += siForSku;
      byCategoria[cat].siMonto += siMontoForSku;
      byCategoria[cat].soPiezas += soForSku;
      byCategoria[cat].soMonto += soMontoForSku;
      if (invForSku) { byCategoria[cat].invPiezas += invForSku.stock || 0; byCategoria[cat].invValor += (Number(invForSku.stock || 0)) * (Number(invForSku.costo_convenio || invForSku.costo_promedio || 0)); }
    });

    return {
      sellInTotal, sellInPiezas, sellOutTotal, sellOutPiezas, invTotal, invPiezas,
      maxSIMes, maxSOMes, byMarca, byCategoria,
    };
  }, [datos]);

  // Filtered & sorted SKUs
  const skuDetail = React.useMemo(() => {
    if (!datos) return [];
    return datos.productos
      .filter(p => !searchFilter || p.sku.toUpperCase().includes(searchFilter.toUpperCase()) || p.descripcion.toUpperCase().includes(searchFilter.toUpperCase()))
      .map(p => {
        const siData = datos.sellIn.filter(r => r.sku === p.sku);
        const soData = datos.sellOut.filter(r => r.sku === p.sku);
        const invData = datos.inventario.find(r => r.sku === p.sku);

        const siPiezasTotal = siData.reduce((s, r) => s + (r.piezas || 0), 0);
        const soMontoTotal = soData.reduce((s, r) => s + (r.monto_pesos || 0), 0);
        const mesActual = new Date().getMonth() + 1;
        const soSinMesActual = soData.filter(r => Number(r.mes) < mesActual);
        // promedio90d = promedio mensual de piezas vendidas en últimos 3 meses completos
        const promedio90d = soSinMesActual.slice(-3).length > 0 ? Math.round(soSinMesActual.slice(-3).reduce((s, r) => s + (r.piezas || 0), 0) / Math.min(3, soSinMesActual.slice(-3).length)) : 0;
        const stock = invData?.stock || 0;
        const valorInv = invData?.valor || 0;

        // Acteck inventory (9 almacenes) + tránsito
        const invActeck = (datos.actStockBySku && datos.actStockBySku[p.sku]) || 0;
        const invTransito = (datos.transitoBySku && datos.transitoBySku[p.sku]) || 0;
        const disponibleReponer = invActeck + invTransito;

        // Sugerido = reponer 90 días de venta basado en rotación (promedio_mensual × 3) − stock cliente
        // Mínimo 11 solo si Digitalife tiene venta activa Y stock < 1 mes de rotación
        let sugerido = 0;
        if (promedio90d > 0) {
          const necesidad = (promedio90d * 3) - stock;
          sugerido = Math.max(0, necesidad);
          // Aplicar mínimo 11 solo si Digitalife tiene stock bajo (< 1 mes)
          if (clienteKey === "digitalife" && stock < promedio90d && sugerido < 11) {
            sugerido = 11;
          }
          // Limitar al disponible en Acteck + tránsito (no podemos enviar lo que no tenemos)
          sugerido = Math.min(sugerido, disponibleReponer);
        }

        const precioSku = Number(p.precio_venta) > 0 ? Number(p.precio_venta) : Number(invData && invData.precio_venta || 0);
        return {
          sku: p.sku,
          descripcion: p.descripcion,
          marca: p.marca,
          estado: p.estado,
          roadmap: p.roadmap || "",
          precio: precioSku,
          siPiezasTotal,
          promedio90d,
          stock,
          valorInv,
          invActeck,
          invTransito,
          sugerido,
          soMontoTotal,
        };
      })
      .sort((a, b) => {
        const valA = a[sortCol] || 0;
        const valB = b[sortCol] || 0;
        return sortDir === "asc" ? valA - valB : valB - valA;
      });
    }, [datos, searchFilter, sortCol, sortDir]);

  // Export to Excel
  const handleSort = (col) => { if (sortCol === col) { setSortDir(sortDir === "desc" ? "asc" : "desc"); } else { setSortCol(col); setSortDir("desc"); } };
    const sortArrow = (col) => sortCol === col ? (sortDir === "desc" ? " \u25BC" : " \u25B2") : " \u25B7";
    const thSort = (label, col) => React.createElement("th", { onClick: () => handleSort(col), style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: sortCol === col ? "#1D4ED8" : "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", cursor: "pointer", userSelect: "none" } }, label + sortArrow(col));

      const exportToExcel = async () => {
    const XLSX = await loadSheetJS();
    if (!XLSX) { alert("Error cargando librerÃ­a Excel"); return; }
    const rows = skuDetail.map(function(s) {
      var sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0);
      var precio = Number(s.precio || 0);
      var total = sug * precio;
      return {
        SKU: s.sku,
        Descripcion: s.descripcion,
        Marca: s.marca,
        Roadmap: s.roadmap || "",
        Estado: s.estado,
        "SI Piezas": s.siPiezasTotal,
        "Prom 90d": s.promedio90d,
        "Stock Cliente": s.stock,
        "Valor Inv": s.valorInv,
        "Inv Acteck": s.invActeck,
        "Transito": s.invTransito,
        "SO Monto": s.soMontoTotal,
        "Sugerido": sug,
        "Precio": precio,
        "Total": total,
      };
    }).filter(function(r) {
      // No exportar renglones en 0
      return (Number(r.Sugerido) || 0) > 0 && (Number(r.Total) || 0) > 0;
    });
    // Fila de totales al final
    if (rows.length > 0) {
      var sumSug = rows.reduce(function(a,r){ return a + (Number(r.Sugerido)||0); }, 0);
      var sumTot = rows.reduce(function(a,r){ return a + (Number(r.Total)||0); }, 0);
      rows.push({ SKU: "TOTAL", Descripcion: "", Marca: "", Roadmap: "", Estado: "", "SI Piezas": "", "Prom 90d": "", "Stock Cliente": "", "Valor Inv": "", "Inv Acteck": "", "Transito": "", "SO Monto": "", "Sugerido": sumSug, "Precio": "", "Total": sumTot });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Estrategia");
    XLSX.writeFile(wb, "Estrategia_" + (clienteKey || cliente) + ".xlsx");
  };

  // ââââ RENDER ââââ

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
            React.createElement("p", { className: "text-blue-700 font-semibold mb-2" }, "ð Selecciona archivos Excel"),
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

  return React.createElement("div", { className: "max-w-7xl mx-auto p-6 space-y-6" },
    // Header
    React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
      React.createElement("div", { className: "flex justify-between items-start mb-4" },
        React.createElement("h2", { className: "text-2xl font-bold text-gray-800" }, "Estrategia de Producto"),
        React.createElement("button", {
          className: "px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium",
          onClick: () => document.getElementById("file-input-update").click(),
        }, "ð¤ Actualizar datos"),
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

    // Summary Cards
    aggs && React.createElement("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6 border-t-4", style: { borderColor: "#4472C4" } },
        React.createElement("p", { className: "text-xs text-gray-400 uppercase tracking-wide mb-2" }, "Sell In"),
        React.createElement("p", { className: "text-2xl font-bold text-gray-800 mb-1" }, formatMXN(aggs.sellInTotal)),
        React.createElement("p", { className: "text-xs text-gray-600 mb-3" }, `${aggs.sellInPiezas.toLocaleString("es-MX")} piezas YTD`),
        React.createElement("p", { className: "text-xs text-gray-500" }, `Mayor: ${MESES_ABREV[aggs.maxSIMes] || "â"}`),
      ),
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6 border-t-4", style: { borderColor: "#8B5CF6" } },
        React.createElement("p", { className: "text-xs text-gray-400 uppercase tracking-wide mb-2" }, "Sell Out"),
        React.createElement("p", { className: "text-2xl font-bold text-gray-800 mb-1" }, formatMXN(aggs.sellOutTotal)),
        React.createElement("p", { className: "text-xs text-gray-600 mb-3" }, `${aggs.sellOutPiezas.toLocaleString("es-MX")} piezas YTD`),
        React.createElement("p", { className: "text-xs text-gray-500" }, `Mayor: ${MESES_ABREV[aggs.maxSOMes] || "â"}`),
      ),
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
      // SKU Detail - Full Table
      React.createElement("div", { className: "bg-white rounded-2xl shadow-sm p-6" },
        React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 } },
          React.createElement("h3", { className: "font-bold text-gray-800" }, "Detalle por SKU"),
          React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center" } },
            React.createElement("input", {
              type: "text", placeholder: "Buscar SKU o descripci\u00f3n...",
              value: searchFilter,
              onChange: function(e) { setSearchFilter(e.target.value); },
              style: { padding: "6px 12px", border: "1px solid #E2E8F0", borderRadius: 8, fontSize: 13, width: 220 }
            }),
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
                thSort("Sugerido", "sugerido"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 6px", fontWeight: 600, color: "#475569", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap" } }, "Precio"),
                React.createElement("th", { style: { textAlign: "right", padding: "8px 6px", fontWeight: 700, color: "#065F46", borderBottom: "2px solid #E2E8F0", whiteSpace: "nowrap", background: "#ECFDF5" } },
                  React.createElement("div", { style: { fontSize: 10, color: "#10B981", fontWeight: 600 } }, "Σ " + formatMXN((skuDetail || []).reduce(function(acc, r){ var sug = sugeridoEdits[r.sku] !== undefined ? Number(sugeridoEdits[r.sku]) : Number(r.sugerido || 0); return acc + sug * Number(r.precio || 0); }, 0))),
                  React.createElement("div", {}, "Total")
                ),
              ),
            ),
            React.createElement("tbody", {},
              skuDetail.map(function(s, idx) {
                return React.createElement("tr", { key: s.sku, style: { borderBottom: "1px solid #F1F5F9", background: idx % 2 === 0 ? "#fff" : "#FAFBFC" } },
                  React.createElement("td", { style: { padding: "6px", fontWeight: 500, color: "#1E293B", whiteSpace: "nowrap", fontSize: 11 } }, s.sku),
                  React.createElement("td", { style: { padding: "6px", color: "#475569", fontSize: 11, maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }, title: (s.roadmap || "") + (s.estado ? " · " + s.estado : "") },
                    s.roadmap && s.roadmap.length > 0 ? React.createElement("span", { style: { color: "#1E293B", fontWeight: 500 } }, s.roadmap) : React.createElement("span", { style: { padding: "2px 6px", borderRadius: 4, background: s.estado === "D" ? "#D1FAE5" : s.estado === "NVS" ? "#FEF3C7" : "#DBEAFE", color: s.estado === "D" ? "#065F46" : s.estado === "NVS" ? "#92400E" : "#1E40AF", fontSize: 10, fontWeight: 600 } }, s.estado || "-")
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
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", fontSize: 11 } },
                    React.createElement("input", {
                      type: "number", min: 0,
                      value: sugeridoEdits[s.sku] !== undefined ? sugeridoEdits[s.sku] : (s.sugerido || 0),
                      onChange: function(e) { var v = {}; v[s.sku] = Number(e.target.value) || 0; setSugeridoEdits(Object.assign({}, sugeridoEdits, v)); },
                      style: { width: 60, padding: "2px 4px", border: "1px solid #E2E8F0", borderRadius: 4, textAlign: "right", fontSize: 11 }
                    })
                  ),
                  React.createElement("td", { style: { textAlign: "right", padding: "6px", color: "#64748B", fontSize: 11, whiteSpace: "nowrap" } }, (s.precio && s.precio > 0) ? ("$" + Number(s.precio).toLocaleString("es-MX", { minimumFractionDigits: 0, maximumFractionDigits: 0 })) : "-"),
                  (function(){ var sug = sugeridoEdits[s.sku] !== undefined ? Number(sugeridoEdits[s.sku]) : Number(s.sugerido || 0); var tot = sug * Number(s.precio || 0); return React.createElement("td", { style: { textAlign: "right", padding: "6px", color: tot > 0 ? "#065F46" : "#CBD5E1", fontSize: 11, fontWeight: 600, whiteSpace: "nowrap", background: tot > 0 ? "#F0FDF4" : "transparent" } }, tot > 0 ? ("$" + Math.round(tot).toLocaleString("es-MX")) : "-"); })(),
                );
              }),
            ),
          ),
        ),
      ),
  );
}



// âââ APP PRINCIPAL ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ

// âââ MARKETING (Supabase) âââ
const TIPO_ACTIVIDAD = {
  banner:     { label: "Banner",      color: "#8b5cf6", icon: "ð¼ï¸", tipo: "digital" },
  mailing:    { label: "Mailing",     color: "#3b82f6", icon: "ð§", tipo: "digital" },
  reel:       { label: "Reel",        color: "#ec4899", icon: "ð¬", tipo: "digital" },
  google_ads: { label: "Google Ads",  color: "#f59e0b", icon: "ð¢", tipo: "digital" },
  meta_ads:   { label: "Meta Ads",    color: "#6366f1", icon: "ð±", tipo: "digital" },
  demo:       { label: "Demo Tienda", color: "#10b981", icon: "ðª", tipo: "presencial" },
  pop:        { label: "Material POP",color: "#14b8a6", icon: "ðª§", tipo: "presencial" },
  taller:     { label: "Taller",      color: "#f97316", icon: "ð§", tipo: "presencial" },
};

const MKT_ESTATUS = [
  { value: "planeado",   label: "Planeado" },
  { value: "en_curso",   label: "En Curso" },
  { value: "completado", label: "Completado" },
  { value: "cancelado",  label: "Cancelado" },
];

const TEMPORALIDADES = {
  semana_santa: { label: "Semana Santa", emoji: "ð£", color: "#ffeaa7" },
  dia_nino:     { label: "DÃ­a del NiÃ±o", emoji: "ð", color: "#fd79a8" },
  dia_madres:   { label: "DÃ­a Madres",   emoji: "ð", color: "#fab1a0" },
  dia_maestro:  { label: "DÃ­a Maestro",  emoji: "ð", color: "#74b9ff" },
  hot_sale:     { label: "HOT SALE",     emoji: "ð¥", color: "#ff7675" },
  lluvias:      { label: "Temp. Lluvias",emoji: "ð§ï¸", color: "#a29bfe" },
  buen_fin:     { label: "Buen Fin",     emoji: "ð", color: "#e17055" },
  navidad:      { label: "Navidad",      emoji: "ð", color: "#00b894" },
  regreso_clases:{ label: "Regreso Clases",emoji: "ð", color: "#fdcb6e" },
};

// rebuild 1776356434
