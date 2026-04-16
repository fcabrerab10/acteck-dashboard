import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { clientes } from '../../lib/constants';

export default function AnalisisCliente({ cliente, clienteKey }) {
  var el = React.createElement;
  var MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  var MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  var _s = React.useState;
  var [ventas, setVentas] = _s([]);
  var [marketing, setMarketing] = _s([]);
  var [productos, setProductos] = _s([]);
  var [sellInSku, setSellInSku] = _s([]);
  var [sellOutSku, setSellOutSku] = _s([]);
  var [inventario, setInventario] = _s([]);
  var [loading, setLoading] = _s(true);
  var [anio, setAnio] = _s(2026);
  var [cuotasMens, setCuotasMens] = _s([]);

  React.useEffect(function() {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    var ck = clienteKey || cliente;
    Promise.all([
      supabase.from("ventas_mensuales").select("*").eq("cliente", ck).eq("anio", anio),
      supabase.from("marketing_actividades").select("*").eq("cliente", ck).eq("anio", anio),
      supabase.from("productos_cliente").select("*").eq("cliente", ck),
      supabase.from("sell_in_sku").select("*").eq("cliente", ck).eq("anio", anio).limit(10000),
      supabase.from("sellout_sku").select("*").eq("cliente", ck).eq("anio", anio).limit(10000),
      supabase.from("inventario_cliente").select("*").eq("cliente", ck).limit(10000),
      supabase.from("cuotas_mensuales").select("*").eq("cliente", ck).eq("anio", anio)
    ]).then(function(results) {
      if (results[0].data) setVentas(results[0].data);
      if (results[1].data) setMarketing(results[1].data);
      if (results[2].data) setProductos(results[2].data);
      if (results[3].data) setSellInSku(results[3].data);
      if (results[4].data) setSellOutSku(results[4].data);
      if (results[5].data) setInventario(results[5].data);
    if (results[6] && results[6].data) setCuotasMens(results[6].data);
      setLoading(false);
    });
  }, [cliente, clienteKey, anio]);

  // —— Helpers ——
  var fmtM = function(v) { return "$" + (Number(v||0)/1000000).toFixed(2) + "M"; };
  var fmtK = function(v) { return "$" + (Number(v||0)/1000).toFixed(0) + "K"; };
  var fmtMoney = function(v) { return "$" + Number(v||0).toLocaleString("es-MX", {minimumFractionDigits:0}); };
  var fmtPct = function(v) { return (Number(v||0)).toFixed(1) + "%"; };
  var fmtNum = function(v) { return Number(v||0).toLocaleString("es-MX"); };

  // —— Sell-through by month ——
  var ventasPorMes = React.useMemo(function() {
    var result = [];
    var siMap = {};
    var soMap = {};
    sellInSku.forEach(function(r) { var m = parseInt(r.mes); siMap[m] = (siMap[m] || 0) + (Number(r.monto_pesos) || 0); });
    sellOutSku.forEach(function(r) { var m = parseInt(r.mes); soMap[m] = (soMap[m] || 0) + (Number(r.monto_pesos) || 0); });
    for (var i = 1; i <= 12; i++) {
      var si = siMap[i] || 0;
      var so = soMap[i] || 0;
      var st = si > 0 && so > 0 ? (so / si * 100) : 0;
      result.push({ mes: i, label: MESES[i-1], sell_in: si, sell_out: so, sellThrough: st, cuota: 0, invDias: 0, invValor: 0 });
    }
    return result;
  }, [sellInSku, sellOutSku]);

  // —— YTD Totals ——
  var ytd = React.useMemo(function() {
    var si = ventasPorMes.reduce(function(s,v) { return s + v.sell_in; }, 0);
    var so = ventasPorMes.reduce(function(s,v) { return s + v.sell_out; }, 0);
    var st = si > 0 && so > 0 ? (so / si * 100) : 0;
    var mesesConDatos = ventasPorMes.filter(function(v) { return v.sell_in > 0 || v.sell_out > 0; }).length;
    // Projection
    var avgSI = mesesConDatos > 0 ? si / mesesConDatos : 0;
    var avgSO = mesesConDatos > 0 ? so / mesesConDatos : 0;
    var projSI = si + avgSI * (12 - mesesConDatos);
    var projSO = so + avgSO * (12 - mesesConDatos);
    return { si: si, so: so, st: st, mesesConDatos: mesesConDatos, avgSI: avgSI, avgSO: avgSO, projSI: projSI, projSO: projSO };
  }, [ventasPorMes]);

  // —— Marketing aggregates by month ——
  var mktPorMes = React.useMemo(function() {
    var m = {};
    for (var i = 1; i <= 12; i++) m[i] = { inv: 0, ventas: 0, alcance: 0, count: 0 };
    marketing.forEach(function(a) {
      var mes = Number(a.mes);
      if (m[mes]) {
        m[mes].inv += Number(a.inversion || 0);
        m[mes].ventas += Number(a.ventas || 0);
        m[mes].alcance += Number(a.alcance || 0);
        m[mes].count++;
      }
    });
    return m;
  }, [marketing]);

  var mktTotals = React.useMemo(function() {
    var inv = marketing.reduce(function(s,a) { return s + Number(a.inversion||0); }, 0);
    var ven = marketing.reduce(function(s,a) { return s + Number(a.ventas||0); }, 0);
    return { inv: inv, ven: ven, roi: inv > 0 ? ((ven-inv)/inv*100) : 0 };
  }, [marketing]);

  // —— SKU-level analysis (when data available) ——
  var skuAnalysis = React.useMemo(function() {
    if (productos.length === 0) return null;
    var skuMap = {};
    productos.forEach(function(p) {
      skuMap[p.sku] = { sku: p.sku, desc: p.descripcion || p.sku, marca: p.marca || "", categoria: p.categoria || "", costo: Number(p.costo_promedio || 0), precio: Number(p.precio_venta || 0), siTotal: 0, soTotal: 0, invStock: 0, invValor: 0, diasSinVenta: 0 };
    });
    sellInSku.forEach(function(s) { if (skuMap[s.sku]) skuMap[s.sku].siTotal += Number(s.piezas || 0); });
    sellOutSku.forEach(function(s) { if (skuMap[s.sku]) skuMap[s.sku].soTotal += Number(s.piezas || 0); });
    inventario.forEach(function(inv) {
      if (skuMap[inv.sku]) {
        skuMap[inv.sku].invStock = Number(inv.stock || 0);
        skuMap[inv.sku].invValor = Number(inv.valor || 0);
        skuMap[inv.sku].diasSinVenta = Number(inv.dias_sin_venta || 0);
      }
    });
    var all = Object.values(skuMap);
    // Margins
    all.forEach(function(s) {
      s.margenCliente = s.precio > 0 && s.costo > 0 ? ((s.precio - s.costo) / s.precio * 100) : 0;
      s.margenPesos = (s.precio - s.costo) * s.soTotal;
      s.sellThrough = s.siTotal > 0 && s.soTotal > 0 ? (s.soTotal / s.siTotal * 100) : 0;
    });
    // Sort for top/bottom
    var topSO = all.filter(function(s){return s.soTotal>0;}).sort(function(a,b){return b.soTotal-a.soTotal;}).slice(0,10);
    var bottomSO = all.filter(function(s){return s.siTotal>0 && s.soTotal===0;}).sort(function(a,b){return b.siTotal-a.siTotal;}).slice(0,10);
    // Inventory health
    var sinVenta60 = all.filter(function(s){return s.diasSinVenta>60;});
    var sinVenta90 = all.filter(function(s){return s.diasSinVenta>90;});
    var invMuerto = sinVenta90.reduce(function(s,p){return s+p.invValor;},0);
    // Margins by brand
    var byMarca = {};
    all.forEach(function(s) {
      if (!byMarca[s.marca]) byMarca[s.marca] = { costo: 0, precio: 0, piezas: 0, margenTotal: 0 };
      byMarca[s.marca].piezas += s.soTotal;
      byMarca[s.marca].margenTotal += s.margenPesos;
    });
    return { all: all, topSO: topSO, bottomSO: bottomSO, sinVenta60: sinVenta60, sinVenta90: sinVenta90, invMuerto: invMuerto, byMarca: byMarca, total: all.length };
  }, [productos, sellInSku, sellOutSku, inventario]);

  // Component-level cuota calculations (needed in render)
  var totalCuotaIdealA = cuotasMens.reduce(function(s, cm) { return s + (Number(cm.cuota_ideal) || 0); }, 0);
  var totalCuotaMinA = cuotasMens.reduce(function(s, cm) { return s + (Number(cm.cuota_min) || 0); }, 0);
  var cumpCuotaA = totalCuotaIdealA > 0 ? (ytd.si / totalCuotaIdealA * 100) : 0;

  // —— Scorecard ——
  var scorecard = React.useMemo(function() {
    var items = [];
    if (!skuAnalysis) return items;
    // 1. SKUs con inventario
    var skusConInv = skuAnalysis.all.filter(function(s) { return s.invStock > 0; }).length;
    var totalSkus = skuAnalysis.all.length;
    var skuColor = skusConInv > totalSkus * 0.5 ? "#10b981" : skusConInv > totalSkus * 0.25 ? "#f59e0b" : "#ef4444";
    items.push({ label: "SKUs con Inventario", value: fmtNum(skusConInv), color: skuColor, detail: "de " + fmtNum(totalSkus) + " totales" });
    // 2. Días de inventario
    var invValorTotal = inventario.reduce(function(s, r) { return s + (Number(r.valor) || 0); }, 0);
    var soTotal = ytd.so;
    var mesesConDatos = ytd.mesesConDatos || 1;
    var soDiario = mesesConDatos > 0 ? soTotal / (mesesConDatos * 30) : 0;
    var diasInv = soDiario > 0 ? Math.round(invValorTotal / soDiario) : 0;
    var diasColor = diasInv <= 90 ? "#10b981" : diasInv <= 150 ? "#f59e0b" : "#ef4444";
    items.push({ label: "D\u00edas de Inventario", value: diasInv + " d\u00edas", color: diasColor, detail: "Basado en SO promedio diario" });
    // 3. Valor del inventario (stock × costo_convenio)
    items.push({ label: "Valor del Inventario", value: fmtMoney(invValorTotal), color: "#3B82F6", detail: "Stock \u00d7 Costo Convenio" });
    return items;
  }, [skuAnalysis, inventario, ytd]);

  // —— RENDER ——
  if (loading) return el("div", { style: { textAlign:"center", color:"#64748b", padding:60 } }, "Cargando an\u00E1lisis...");

  // Section card helper
  var section = function(title, icon, children) {
    return el("div", { style: { background:"#ffffff", borderRadius:12, padding:"16px 20px", marginBottom:12 } },
      el("h3", { style: { margin:"0 0 12px", fontSize:14, fontWeight:700, color:"#1e293b", display:"flex", alignItems:"center", gap:8 } }, icon, " ", title),
      children
    );
  };

  // Metric box helper
  var metricBox = function(label, value, sub, color) {
    return el("div", { style: { background:"#f1f5f9", borderRadius:10, padding:"12px 16px", flex:1, minWidth:140, borderTop:"3px solid " + (color || "#3b82f6") } },
      el("div", { style: { fontSize:11, color:"#94a3b8", marginBottom:4 } }, label),
      el("div", { style: { fontSize:20, fontWeight:700, color:"#1e293b" } }, value),
      sub ? el("div", { style: { fontSize:10, color:"#64748b", marginTop:2 } }, sub) : null
    );
  };

  // Bar helper for horizontal bars
  var bar = function(label, value, max, color, subLabel) {
    var pct = max > 0 ? Math.min(value / max * 100, 100) : 0;
    return el("div", { style: { marginBottom:8 } },
      el("div", { style: { display:"flex", justifyContent:"space-between", fontSize:11, marginBottom:3 } },
        el("span", { style: { color:"#cbd5e1" } }, label),
        el("span", { style: { color:"#94a3b8" } }, subLabel || fmtMoney(value))
      ),
      el("div", { style: { height:6, background:"#f1f5f9", borderRadius:3, overflow:"hidden" } },
        el("div", { style: { height:"100%", width: pct + "%", background: color || "#3b82f6", borderRadius:3, transition:"width .5s" } })
      )
    );
  };

  return el("div", { style: { maxWidth:1100, margin:"0 auto", color:"#1e293b" } },
    // Header
    el("div", { style: { display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 } },
      el("h2", { style: { margin:0, fontSize:20, fontWeight:700 } }, "\uD83D\uDCC8 An\u00E1lisis — " + (cliente || clienteKey)),
      el("select", { value: anio, onChange: function(e) { setAnio(Number(e.target.value)); }, style: { padding:"5px 10px", borderRadius:8, border:"1px solid #cbd5e1", background:"#f1f5f9", color:"#1e293b", fontSize:12 } },
        el("option", { value: 2025 }, "2025"), el("option", { value: 2026 }, "2026"), el("option", { value: 2027 }, "2027")
      )
    ),

    // === 1. SCORECARD ===
    section("Scorecard", "\uD83D\uDEA6",
      el("div", { style: { display:"flex", gap:10, flexWrap:"wrap" } },
        scorecard.map(function(s, i) {
          return el("div", { key: i, style: { flex:1, minWidth:150, background:"#f1f5f9", borderRadius:10, padding:"14px 16px", borderLeft:"4px solid " + s.color } },
            el("div", { style: { fontSize:11, color:"#94a3b8", marginBottom:4 } }, s.label),
            el("div", { style: { fontSize:22, fontWeight:700, color: s.color } }, s.value),
            s.detail ? el("div", { style: { fontSize:10, color:"#64748b", marginTop:4 } }, s.detail) : null
          );
        })
      )
    ),

    // === 2. SELL-THROUGH POR MES ===
    section("Eficiencia de Venta Mensual", "\uD83D\uDD04",
        el("div", { style: { background: "#F0F9FF", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 12, color: "#334155", lineHeight: 1.5, border: "1px solid #BAE6FD" } },
          el("strong", null, "\u00bfQu\u00e9 es la Eficiencia de Venta? "),
          "Mide la relaci\u00f3n entre lo que el cliente nos compra (Sell In) y lo que vende a sus clientes (Sell Out). ",
          "Una eficiencia \u2265 80% indica un balance saludable. Valores bajos sugieren sobreinventario; valores muy altos pueden indicar riesgo de desabasto."
        ),
      el("div", null,
        // YTD summary row
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Sell In YTD", fmtM(ytd.si), null, "#3b82f6"),
          metricBox("Sell Out YTD", fmtM(ytd.so), null, "#10b981"),
          metricBox("Eficiencia de Venta YTD", fmtPct(ytd.st), ytd.st >= 80 ? "Saludable" : ytd.st >= 50 ? "Moderado" : "Bajo", ytd.st >= 80 ? "#10b981" : ytd.st >= 50 ? "#f59e0b" : "#ef4444")
        ),
        // Monthly bars
        el("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 } },
          el("div", null,
            el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Sell In por Mes"),
            ventasPorMes.filter(function(v){return v.sell_in>0;}).map(function(v) {
              return el("div", { key: v.mes }, bar(v.label, v.sell_in, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_in;})), "#3b82f6"));
            })
          ),
          el("div", null,
            el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Sell Out por Mes"),
            ventasPorMes.filter(function(v){return v.sell_out>0;}).map(function(v) {
              return el("div", { key: v.mes }, bar(v.label, v.sell_out, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_out;})), "#10b981"));
            }),
            ventasPorMes.filter(function(v){return v.sell_out>0;}).length === 0 ? el("div", { style: { fontSize:12, color:"#475569", fontStyle:"italic", padding:12 } }, "Sin datos de sell out a\u00FAn") : null
          )
        ),
        // Sell-through % per month
        el("div", { style: { marginTop:16 } },
          el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Eficiencia de Venta % por Mes"),
          el("div", { style: { display:"flex", gap:6, flexWrap:"wrap" } },
            ventasPorMes.map(function(v) {
              var hasST = v.sell_in > 0 && v.sell_out > 0;
              var color = !hasST ? "#334155" : v.sellThrough >= 80 ? "#10b981" : v.sellThrough >= 50 ? "#f59e0b" : "#ef4444";
              return el("div", { key: v.mes, style: { textAlign:"center", width:70, background:"#f1f5f9", borderRadius:8, padding:"8px 4px", borderBottom:"3px solid " + color } },
                el("div", { style: { fontSize:10, color:"#94a3b8" } }, v.label),
                el("div", { style: { fontSize:16, fontWeight:700, color: hasST ? color : "#475569" } }, hasST ? fmtPct(v.sellThrough) : "—")
              );
            })
          )
        )
      )
    ),

    // === 3. MARKETING vs VENTAS ===
    section("Marketing vs Ventas", "\uD83D\uDCE3",
      el("div", null,
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Inversi\u00F3n Mkt", fmtMoney(mktTotals.inv), marketing.length + " actividades", "#8b5cf6"),
          metricBox("Sell Out Total", fmtM(ytd.so), null, "#10b981"),
          metricBox("Costo x Peso Vendido", ytd.so > 0 ? "$" + (mktTotals.inv / ytd.so).toFixed(2) : "—", ytd.so > 0 ? "Por cada $1 de sell out" : "Sin sell out", "#f59e0b")
        ),
        // Monthly comparison
        el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Inversi\u00F3n Marketing vs Sell Out por Mes"),
        el("div", { style: { display:"grid", gridTemplateColumns:"repeat(6, 1fr)", gap:6 } },
          ventasPorMes.slice(0, 6).map(function(v) {
            var mktMes = mktPorMes[v.mes];
            var hasMkt = mktMes && mktMes.inv > 0;
            var hasSO = v.sell_out > 0;
            return el("div", { key: v.mes, style: { background:"#f1f5f9", borderRadius:8, padding:"10px 8px", textAlign:"center" } },
              el("div", { style: { fontSize:10, color:"#94a3b8", marginBottom:6 } }, v.label),
              el("div", { style: { fontSize:11, color:"#8b5cf6", fontWeight:600 } }, hasMkt ? fmtK(mktMes.inv) : "—"),
              el("div", { style: { fontSize:9, color:"#64748b", margin:"2px 0" } }, "mkt"),
              el("div", { style: { fontSize:11, color:"#10b981", fontWeight:600 } }, hasSO ? fmtK(v.sell_out) : "—"),
              el("div", { style: { fontSize:9, color:"#64748b" } }, "sell out")
            );
          })
        )
      )
    ),

    // === 5. SALUD DEL INVENTARIO ===
    skuAnalysis ? section("Salud del Inventario", "\uD83D\uDCE6",
      el("div", null,
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Total SKUs", fmtNum(skuAnalysis.total), null, "#3b82f6"),
              metricBox("D\u00edas de Inventario", skuAnalysis.diasCobertura ? fmtNum(skuAnalysis.diasCobertura) + "d" : (inventario.length > 0 && ytd.so > 0 ? fmtNum(Math.round(inventario.reduce(function(s,x){return s+(Number(x.valor)||0);},0) / (ytd.so / ytd.mesesConDatos) * 30)) + "d" : "\u2014"), "Cobertura estimada", "#8b5cf6"),
          metricBox(">60 d\u00EDas sin venta", fmtNum(skuAnalysis.sinVenta60.length), "SKUs en riesgo", skuAnalysis.sinVenta60.length > 10 ? "#ef4444" : "#f59e0b"),
          metricBox(">90 d\u00EDas sin venta", fmtNum(skuAnalysis.sinVenta90.length), "Inventario muerto", skuAnalysis.sinVenta90.length > 5 ? "#ef4444" : "#f59e0b"),
          metricBox("Valor Muerto", fmtMoney(skuAnalysis.invMuerto), ">90 d\u00EDas", "#ef4444")
        ),
        skuAnalysis.sinVenta90.length > 0 ? el("div", null,
          el("div", { style: { fontSize:12, color:"#ef4444", marginBottom:8, fontWeight:600 } }, "SKUs cr\u00EDticos (+90 d\u00EDas sin venta)"),
          skuAnalysis.sinVenta90.slice(0, 8).map(function(s) {
            return el("div", { key: s.sku, style: { display:"flex", alignItems:"center", gap:8, padding:"6px 10px", background:"#f1f5f9", borderRadius:6, marginBottom:4, fontSize:11 } },
              el("span", { style: { color:"#94a3b8", fontFamily:"monospace", fontSize:10, width:80 } }, s.sku),
              el("span", { style: { flex:1, color:"#1e293b" } }, s.desc),
              el("span", { style: { color:"#ef4444" } }, s.diasSinVenta + "d"),
              el("span", { style: { color:"#f59e0b" } }, fmtNum(s.invStock) + " pzas"),
              el("span", { style: { color:"#94a3b8" } }, fmtMoney(s.invValor))
            );
          })
        ) : null
      )
    ) : section("Salud del Inventario", "\uD83D\uDCE6",
      el("div", { style: { textAlign:"center", padding:20, color:"#475569" } },
        el("div", { style: { fontSize:28, marginBottom:8 } }, "\uD83D\uDCE6"),
        el("div", { style: { fontSize:13 } }, "Sube los archivos de Estrategia de Producto para activar el an\u00E1lisis de inventario")
      )
    ),

    // === 7. PROYECCIÓN ===
    section("Proyecci\u00F3n de Cierre Anual", "\uD83D\uDD2E",
      el("div", null,
        ytd.mesesConDatos >= 2 ? el("div", null,
          el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
            metricBox("Promedio Mensual SI", fmtM(ytd.avgSI), "\u00DAltimos " + ytd.mesesConDatos + " meses", "#3b82f6"),
            metricBox("Proyecci\u00F3n SI Anual", fmtM(ytd.projSI), "Estimado cierre " + anio, "#8b5cf6"),
            metricBox("Ratio SI/SO", ytd.so > 0 ? fmtPct(ytd.so/ytd.si*100) : "—", ytd.st < 50 ? "⚠️ Riesgo alto de sobreinventario" : ytd.st < 70 ? "⚠️ Inventario acumulado" : "Rotación saludable", ytd.st < 50 ? "#ef4444" : ytd.st < 70 ? "#f59e0b" : "#10b981"),
          metricBox("Cuota Ideal Anual", totalCuotaIdealA > 0 ? fmtM(totalCuotaIdealA) : "Sin datos", totalCuotaIdealA > 0 ? "Cump: " + fmtPct(cumpCuotaA) : "Subir cuotas", "#F59E0B"),
            metricBox("Promedio Mensual SO", fmtM(ytd.avgSO), "\u00DAltimos " + ytd.mesesConDatos + " meses", "#10b981"),
            metricBox("Proyecci\u00F3n SO Anual", fmtM(ytd.projSO), "Estimado cierre " + anio, "#059669")
          ),
          // Monthly projection bars
          el("div", { style: { fontSize:12, color:"#94a3b8", marginBottom:8, fontWeight:600 } }, "Sell In: Real vs Proyectado"),
          el("div", { style: { display:"flex", gap:4, alignItems:"flex-end", height:120 } },
            ventasPorMes.map(function(v) {
              var isReal = v.sell_in > 0;
              var val = isReal ? v.sell_in : ytd.avgSI;
              var maxVal = Math.max(ytd.avgSI * 1.5, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_in;})));
              var h = maxVal > 0 ? Math.max(val / maxVal * 100, 4) : 4;
              return el("div", { key: v.mes, style: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 } },
                el("div", { style: { fontSize:9, color:"#94a3b8" } }, fmtK(val)),
                el("div", { style: { width:"100%", height: h + "px", background: isReal ? "#3b82f6" : "#dbeafe", borderRadius:3, border: isReal ? "none" : "1px dashed #93c5fd" } }),
                el("div", { style: { fontSize:9, color:"#64748b" } }, v.label)
              );
            })
          ),
          el("div", { style: { fontSize:12, color:"#64748b", marginBottom:8, marginTop:16, fontWeight:600 } }, "Sell Out: Real vs Proyectado"),
          el("div", { style: { display:"flex", gap:4, alignItems:"flex-end", height:120 } },
            ventasPorMes.map(function(v) {
              var isReal = v.sell_out > 0;
              var val = isReal ? v.sell_out : ytd.avgSO;
              var maxVal = Math.max(ytd.avgSO * 1.5, Math.max.apply(null, ventasPorMes.map(function(x){return x.sell_out;})));
              var h = maxVal > 0 ? Math.max(val / maxVal * 100, 4) : 4;
              return el("div", { key: "so"+v.mes, style: { flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:2 } },
                el("div", { style: { fontSize:9, color:"#64748b" } }, fmtK(val)),
                el("div", { style: { width:"100%", height: h + "px", background: isReal ? "#10b981" : "#d1fae5", borderRadius:3, border: isReal ? "none" : "1px dashed #6ee7b7" } }),
                el("div", { style: { fontSize:9, color:"#94a3b8" } }, v.label)
              );
            })
          ),
          ytd.st < 60 ? el("div", { style: { background:"#fef2f2", border:"1px solid #fecaca", borderRadius:10, padding:"12px 16px", marginTop:12, display:"flex", alignItems:"center", gap:10 } },
            el("span", { style: { fontSize:20 } }, "⚠️"),
            el("div", null,
              el("div", { style: { fontSize:13, fontWeight:600, color:"#dc2626" } }, "Alerta: Sell Out proyectado muy por debajo del Sell In"),
              el("div", { style: { fontSize:11, color:"#991b1b" } }, "Posible sobreinventario de " + fmtM(ytd.projSI - ytd.projSO) + ". Considerar ajustar sell in o impulsar sell out.")
            )
          ) : null

        ) : el("div", { style: { textAlign:"center", padding:20, color:"#475569", fontSize:13 } }, "Se necesitan al menos 2 meses de datos para proyectar")
      )
    )
  );
}



// ==================== FORECAST CLIENTE ====================

