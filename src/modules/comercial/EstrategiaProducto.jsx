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
      const [productos, sellIn, sellOut, inventario, invActeck, transito, roadmap] = await Promise.all([
        fetchAllPagesREST(`productos_cliente?select=*&cliente=eq.${clienteKey}`),
        fetchAllPagesREST(`sell_in_sku?select=*&cliente=eq.${clienteKey}&anio=eq.2026`),
        fetchAllPagesREST(`sellout_sku?select=*&cliente=eq.${clienteKey}&anio=eq.2026`),
        fetchAllPagesREST(`inventario_cliente?select=*&cliente=eq.${clienteKey}`),
        fetchAllPagesREST(`inventario_acteck?select=articulo,no_almacen,disponible&no_almacen=in.(${ACTECK_ALMACENES.join(',')})`),
        fetchAllPagesREST(`transito_sku?select=sku,inventario_transito,siguiente_arribo,payload,sort_order`),
        fetchAllPagesREST(`roadmap_sku?select=sku,rdmp,descripcion,payload,sort_order&order=sort_order.asc`),
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

      // Filter inventario_cliente to most recent snapshot week (avoid stale history)
      let maxA = 0, maxS = 0;
      inventario.forEach(inv => {
        const a = Number(inv.anio) || 0, s = Number(inv.semana) || 0;
        if (a > maxA || (a === maxA && s > maxS)) { maxA = a; maxS = s; }
      });
      const inventarioLatest = maxA > 0 ? inventario.filter(inv =>
        Number(inv.anio) === maxA && Number(inv.semana) === maxS
      ) : inventario;

      setDatos({
        productos, sellIn, sellOut,
        inventario: inventarioLatest,
        inventarioAll: inventario,   // preserved for future historical views
        latestWeek: { anio: maxA, semana: maxS },
        actStockBySku, transitoBySku,
        transito,
        roadmap,
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
        roadmapCruce.nuevos.length > 0 && React.createElement("div", { style: { background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: 14, marginBottom: 16 } },
          React.createElement("div", { style: { fontSize: 13, fontWeight: 700, color: "#065F46", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 } },
            "\uD83C\uDD95 Productos NUEVOS detectados (en tr\u00e1nsito, no est\u00e1n en roadmap) \u2014 " + roadmapCruce.nuevos.length + " SKUs"
          ),
          React.createElement("div", { style: { overflowX: "auto" } },
            React.createElement("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
              React.createElement("thead", null,
                React.createElement("tr", { style: { background: "#D1FAE5", borderBottom: "1px solid #A7F3D0" } },
                  React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#065F46" } }, "SKU"),
                  React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#065F46" } }, "Descripci\u00f3n"),
                  React.createElement("th", { style: { textAlign: "right", padding: "6px 10px", fontWeight: 600, color: "#065F46", width: 90 } }, "Piezas"),
                  React.createElement("th", { style: { textAlign: "left", padding: "6px 10px", fontWeight: 600, color: "#065F46", width: 160 } }, "Arribo a CEDIS")
                )
              ),
              React.createElement("tbody", null,
                roadmapCruce.nuevos.slice(0, 20).map(function(t) {
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
          ),
          roadmapCruce.nuevos.length > 20 && React.createElement("div", { style: { fontSize: 11, color: "#065F46", marginTop: 6, fontStyle: "italic" } }, "Y " + (roadmapCruce.nuevos.length - 20) + " m\u00e1s...")
        ),
        // En camino (roadmap + tránsito) — ahora con Inv Acteck actual
        roadmapCruce.enCamino.length > 0 && React.createElement("div", { style: { marginBottom: 16 } },
          React.createElement("div", { style: { fontSize: 13, fontWeight: 600, color: "#1E40AF", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 } },
            "\uD83D\uDEA2 En camino (llegando seg\u00fan roadmap) \u2014 " + roadmapCruce.enCamino.length + " SKUs"
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
                roadmapCruce.enCamino.map(function(r, i) {
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
        )
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
