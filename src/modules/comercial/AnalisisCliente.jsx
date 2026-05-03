import React, { useState, useEffect } from "react";
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { clientes } from '../../lib/constants';
import { Target } from 'lucide-react';
import { fetchSelloutSku, fetchSelloutSkuRango, fetchInventarioCliente } from '../../lib/pcelAdapter';

export default function AnalisisCliente({ cliente, clienteKey }) {
  var el = React.createElement;
  var MESES = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
  var MESES_FULL = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

  var _s = React.useState;
  var [ventas, setVentas] = _s([]);
  var [marketing, setMarketing] = _s([]);
  var [productos, setProductos] = _s([]);
  var [sellInSku, setSellInSku] = _s([]);           // año actual
  var [sellOutSku, setSellOutSku] = _s([]);         // año actual
  var [sellInSkuAll, setSellInSkuAll] = _s([]);     // últimos 2 años (para comparativas)
  var [sellOutSkuAll, setSellOutSkuAll] = _s([]);   // últimos 2 años
  var [inventario, setInventario] = _s([]);
  var [loading, setLoading] = _s(true);
  var [anio, setAnio] = _s(2026);
  var [cuotasMens, setCuotasMens] = _s([]);
  var [estadoCuenta, setEstadoCuenta] = _s(null);
  // Period comparison state
  var [compA, setCompA] = _s({ tipo: 'ytd', anio: 2026, mes: null });
  var [compB, setCompB] = _s({ tipo: 'ytd', anio: 2025, mes: null });
  var [vistaModo, setVistaModo] = _s('simple');  // 'simple' | 'trimestre' | 'mes'

  // Paginated fetch helper (PostgREST caps at 1000 rows)
  // Factory pattern: each page creates a fresh query (supabase-js builders are single-use)
  async function fetchAllPages(queryFactory) {
    var PAGE = 1000, all = [], from = 0;
    while (true) {
      var res = await queryFactory().range(from, from + PAGE - 1);
      if (res.error || !res.data) break;
      all = all.concat(res.data);
      if (res.data.length < PAGE) break;
      from += PAGE;
    }
    return all;
  }

  React.useEffect(function() {
    if (!DB_CONFIGURED) { setLoading(false); return; }
    setLoading(true);
    var ck = clienteKey || cliente;
    (async function() {
      var results = await Promise.all([
        supabase.from("ventas_mensuales").select("*").eq("cliente", ck).eq("anio", anio),
        supabase.from("marketing_actividades").select("*").eq("cliente", ck).eq("anio", anio),
        fetchAllPages(function() { return supabase.from("productos_cliente").select("*").eq("cliente", ck); }),
        fetchAllPages(function() { return supabase.from("sell_in_sku").select("*").eq("cliente", ck).eq("anio", anio); }),
        fetchSelloutSku(ck, anio),
        fetchInventarioCliente(ck),
        supabase.from("cuotas_mensuales").select("*").eq("cliente", ck).eq("anio", anio),
        // Para comparativas: últimos 2 años (actual y anterior)
        fetchAllPages(function() { return supabase.from("sell_in_sku").select("*").eq("cliente", ck).gte("anio", anio - 1).lte("anio", anio); }),
        fetchSelloutSkuRango(ck, anio - 1, anio),
        // Último estado de cuenta
        supabase.from("estados_cuenta").select("*").eq("cliente", ck).order("anio", { ascending: false }).order("semana", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (results[0].data) setVentas(results[0].data);
      if (results[1].data) setMarketing(results[1].data);
      setProductos(Array.isArray(results[2]) ? results[2] : (results[2].data || []));
      setSellInSku(Array.isArray(results[3]) ? results[3] : (results[3].data || []));
      setSellOutSku(Array.isArray(results[4]) ? results[4] : (results[4].data || []));
      setInventario(Array.isArray(results[5]) ? results[5] : (results[5].data || []));
      if (results[6] && results[6].data) setCuotasMens(results[6].data);
      setSellInSkuAll(Array.isArray(results[7]) ? results[7] : (results[7].data || []));
      setSellOutSkuAll(Array.isArray(results[8]) ? results[8] : (results[8].data || []));
      setEstadoCuenta(results[9]?.data || null);
      setLoading(false);
    })();
  }, [cliente, clienteKey, anio]);

  // —— Helpers ——
  var fmtM = function(v) { return "$" + (Number(v||0)/1000000).toFixed(2) + "M"; };
  var fmtK = function(v) { return "$" + (Number(v||0)/1000).toFixed(0) + "K"; };
  var fmtMoney = function(v) { return "$" + Number(v||0).toLocaleString("es-MX", {minimumFractionDigits:0}); };
  var fmtPct = function(v) { return (Number(v||0)).toFixed(1) + "%"; };
  var fmtNum = function(v) { return Number(v||0).toLocaleString("es-MX"); };

  // —— Sell-through by month ——
  // ── Comparativa por Marca / Categoría (movido desde Estrategia de Producto) ──
  // Agregamos sell-in, sell-out e inventario por marca y por categoría.
  // Spectrum se consolida en "Balam Rush" (es modelo, no marca).
  var aggsByMarcaCat = React.useMemo(function() {
    var esPcel = clienteKey === 'pcel';
    var consolidaMarca = function(m) { return m === 'Balam Rush Spectrum' ? 'Balam Rush' : m; };
    var normLabel = function(s) { return (s || '').toString().trim(); };

    // Index por SKU (productos_cliente) para mapear marca+categoría
    var prodBySku = {};
    productos.forEach(function(p) {
      var sku = (p.sku || '').toString();
      if (!prodBySku[sku]) prodBySku[sku] = p;
    });

    // Sumas por SKU
    var siMonto = {}, siPiezas = {}, soMonto = {}, soPiezas = {};
    sellInSku.forEach(function(r) {
      var k = (r.sku || '').toString();
      siMonto[k] = (siMonto[k] || 0) + (Number(r.monto_pesos) || 0);
      siPiezas[k] = (siPiezas[k] || 0) + (Number(r.piezas) || 0);
    });
    sellOutSku.forEach(function(r) {
      var k = (r.sku || '').toString();
      soMonto[k] = (soMonto[k] || 0) + (Number(r.monto_pesos) || 0);
      soPiezas[k] = (soPiezas[k] || 0) + (Number(r.piezas) || 0);
    });

    // Inventario: tomar sólo el snapshot más reciente
    var maxA = 0, maxS = 0;
    inventario.forEach(function(r) {
      var a = Number(r.anio) || 0, s = Number(r.semana) || 0;
      if (a > maxA || (a === maxA && s > maxS)) { maxA = a; maxS = s; }
    });
    var invLatest = maxA > 0
      ? inventario.filter(function(r) { return Number(r.anio) === maxA && Number(r.semana) === maxS; })
      : inventario;
    var invBySku = {};
    invLatest.forEach(function(r) {
      var k = (r.sku || '').toString();
      var stock = Number(r.stock) || 0;
      var valor = Number(r.valor) || 0;
      if (valor === 0) valor = stock * (Number(r.costo_convenio || r.costo_promedio) || 0);
      if (!invBySku[k]) invBySku[k] = { stock: 0, valor: 0 };
      invBySku[k].stock += stock;
      invBySku[k].valor += valor;
    });

    var byMarca = {}, byCategoria = {};
    var skusAll = new Set();
    [].concat(Object.keys(siMonto), Object.keys(siPiezas), Object.keys(soMonto), Object.keys(soPiezas), Object.keys(invBySku))
      .forEach(function(s) { skusAll.add(s); });

    skusAll.forEach(function(sku) {
      var p = prodBySku[sku] || {};
      var marca = consolidaMarca(normLabel(p.marca)) || 'Sin Marca';
      var cat = normLabel(p.categoria) || 'Sin Categoría';
      var inv = invBySku[sku] || { stock: 0, valor: 0 };

      if (!byMarca[marca]) byMarca[marca] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      byMarca[marca].siPiezas += siPiezas[sku] || 0;
      byMarca[marca].siMonto  += siMonto[sku]  || 0;
      byMarca[marca].soPiezas += soPiezas[sku] || 0;
      byMarca[marca].soMonto  += soMonto[sku]  || 0;
      byMarca[marca].invPiezas += inv.stock;
      byMarca[marca].invValor  += inv.valor;

      if (!byCategoria[cat]) byCategoria[cat] = { siPiezas: 0, siMonto: 0, soPiezas: 0, soMonto: 0, invPiezas: 0, invValor: 0 };
      byCategoria[cat].siPiezas += siPiezas[sku] || 0;
      byCategoria[cat].siMonto  += siMonto[sku]  || 0;
      byCategoria[cat].soPiezas += soPiezas[sku] || 0;
      byCategoria[cat].soMonto  += soMonto[sku]  || 0;
      byCategoria[cat].invPiezas += inv.stock;
      byCategoria[cat].invValor  += inv.valor;
    });

    return { byMarca: byMarca, byCategoria: byCategoria, esPcel: esPcel };
  }, [productos, sellInSku, sellOutSku, inventario, clienteKey]);

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
  // Para calcular promedios mensuales saludables, EXCLUIMOS el mes actual
  // si está corriendo (datos parciales harían bajar el promedio artificialmente).
  var ytd = React.useMemo(function() {
    var now = new Date();
    var mesActualReal = now.getMonth() + 1;
    var esAnioActual = anio === now.getFullYear();
    var si = ventasPorMes.reduce(function(s,v) { return s + v.sell_in; }, 0);
    var so = ventasPorMes.reduce(function(s,v) { return s + v.sell_out; }, 0);
    var st = si > 0 && so > 0 ? (so / si * 100) : 0;
    // Meses completos con datos (excluyendo el mes actual si es año actual)
    var mesesCompletos = ventasPorMes.filter(function(v) {
      var tieneDatos = v.sell_in > 0 || v.sell_out > 0;
      if (!tieneDatos) return false;
      if (esAnioActual && v.mes === mesActualReal) return false;  // excluye mes corriendo
      return true;
    });
    var mesesConDatos = mesesCompletos.length;
    // Suma solo de meses completos (para el promedio)
    var siCompletos = mesesCompletos.reduce(function(s,v) { return s + v.sell_in; }, 0);
    var soCompletos = mesesCompletos.reduce(function(s,v) { return s + v.sell_out; }, 0);
    var avgSI = mesesConDatos > 0 ? siCompletos / mesesConDatos : 0;
    var avgSO = mesesConDatos > 0 ? soCompletos / mesesConDatos : 0;
    // Proyección: YTD completo + promedio × meses restantes
    var mesesTotales = ventasPorMes.filter(function(v) { return v.sell_in > 0 || v.sell_out > 0; }).length;
    var projSI = si + avgSI * (12 - mesesTotales);
    var projSO = so + avgSO * (12 - mesesTotales);
    return { si: si, so: so, st: st, mesesConDatos: mesesConDatos, avgSI: avgSI, avgSO: avgSO, projSI: projSI, projSO: projSO, mesActual: mesActualReal };
  }, [ventasPorMes, anio]);

  // —— COMPARATIVA: filtrar data por periodo ——
  var labelPeriodo = function(comp) {
    var mesNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    if (comp.tipo === 'ytd') return "YTD " + comp.anio;
    if (comp.tipo === 'anio') return "Año " + comp.anio;
    if (comp.tipo === 'mes') return mesNames[comp.mes - 1] + " " + comp.anio;
    if (comp.tipo === 'trimestre') return "Q" + Math.ceil(comp.mes / 3) + " " + comp.anio;
    return "";
  };
  var filterPeriodo = function(rows, comp) {
    var now = new Date();
    var curMes = now.getMonth() + 1;
    var curYear = now.getFullYear();
    return rows.filter(function(r) {
      var rA = Number(r.anio) || 0, rM = Number(r.mes) || 0;
      if (rA !== comp.anio) return false;
      if (comp.tipo === 'anio') return true;
      if (comp.tipo === 'ytd') return rA !== curYear ? true : rM <= curMes;
      if (comp.tipo === 'mes') return rM === comp.mes;
      if (comp.tipo === 'trimestre') {
        var q = Math.ceil(comp.mes / 3);
        var mesIni = (q - 1) * 3 + 1, mesFin = q * 3;
        return rM >= mesIni && rM <= mesFin;
      }
      return false;
    });
  };
  var computePeriodo = function(comp) {
    var siRows = filterPeriodo(sellInSkuAll, comp);
    var soRows = filterPeriodo(sellOutSkuAll, comp);
    var si = siRows.reduce(function(s, r) { return s + (Number(r.monto_pesos) || 0); }, 0);
    var so = soRows.reduce(function(s, r) { return s + (Number(r.monto_pesos) || 0); }, 0);
    var siPz = siRows.reduce(function(s, r) { return s + (Number(r.piezas) || 0); }, 0);
    var soPz = soRows.reduce(function(s, r) { return s + (Number(r.piezas) || 0); }, 0);
    var skus = new Set();
    siRows.forEach(function(r) { if (r.sku) skus.add(r.sku); });
    soRows.forEach(function(r) { if (r.sku) skus.add(r.sku); });
    var ef = si > 0 && so > 0 ? (so / si * 100) : 0;
    // Top producto (SKU) por venta de sellout
    var soBySku = {};
    soRows.forEach(function(r) {
      if (!soBySku[r.sku]) soBySku[r.sku] = 0;
      soBySku[r.sku] += Number(r.monto_pesos) || 0;
    });
    var topSku = Object.entries(soBySku).sort(function(a,b) { return b[1] - a[1]; })[0];
    return { si: si, so: so, ef: ef, skus: skus.size, piezasSO: soPz, topSku: topSku ? topSku[0] : null, topSkuMonto: topSku ? topSku[1] : 0, soBySku: soBySku };
  };
  var compAData = React.useMemo(function() { return computePeriodo(compA); }, [sellInSkuAll, sellOutSkuAll, compA]);
  var compBData = React.useMemo(function() { return computePeriodo(compB); }, [sellInSkuAll, sellOutSkuAll, compB]);

  // —— PRODUCTO CON MAYOR CRECIMIENTO entre periodos A y B ——
  var productoCrecimiento = React.useMemo(function() {
    var crecimiento = [];
    var skusUnion = new Set([...Object.keys(compAData.soBySku || {}), ...Object.keys(compBData.soBySku || {})]);
    skusUnion.forEach(function(sku) {
      var a = compAData.soBySku[sku] || 0;
      var b = compBData.soBySku[sku] || 0;
      if (b > 0 && a > b) {  // creció de B a A
        var pct = (a - b) / b * 100;
        crecimiento.push({ sku: sku, a: a, b: b, pct: pct });
      }
    });
    return crecimiento.sort(function(x, y) { return y.pct - x.pct; })[0] || null;
  }, [compAData, compBData]);

  // —— INSIGHTS: "Cosas por Hacer" ——
  var insights = React.useMemo(function() {
    var lista = [];
    var ck = clienteKey || cliente;

    // Saldo vencido
    if (estadoCuenta && Number(estadoCuenta.saldo_vencido) > 0) {
      lista.push({
        tipo: 'critico', icono: '🔴', titulo: 'Saldo vencido',
        descripcion: 'El cliente debe ' + fmtMoney(Number(estadoCuenta.saldo_vencido)) + ' vencido.',
        accion: 'Priorizar cobranza con el cliente esta semana.',
      });
    }

    // Sobreinventario + SKUs más lentos para acelerar (solo semana más reciente)
    var _maxA = 0, _maxS = 0;
    inventario.forEach(function(inv) {
      var a = Number(inv.anio) || 0, s = Number(inv.semana) || 0;
      if (a > _maxA || (a === _maxA && s > _maxS)) { _maxA = a; _maxS = s; }
    });
    var _invLatestI = _maxA > 0 ? inventario.filter(function(inv) {
      return Number(inv.anio) === _maxA && Number(inv.semana) === _maxS;
    }) : inventario;
    var invValorTotal = _invLatestI.reduce(function(s, r) {
      var v = Number(r.valor) || 0;
      return s + (v > 0 ? v : (Number(r.stock) || 0) * (Number(r.costo_convenio) || 0));
    }, 0);
    if (ytd.mesesConDatos > 0 && ytd.so > 0 && invValorTotal > 0) {
      var soDiario = ytd.so / (ytd.mesesConDatos * 30);
      var diasCob = soDiario > 0 ? Math.round(invValorTotal / soDiario) : 0;
      if (diasCob > 120) {
        // Top SKUs por inventario parado (stock * costo, con días sin venta > 30)
        var topLentos = (skuAnalysis && skuAnalysis.all ? skuAnalysis.all : [])
          .filter(function(s) { return s.invStock > 0 && s.diasSinVenta > 30; })
          .sort(function(a, b) { return b.invValor - a.invValor; })
          .slice(0, 3);
        var mesesCob = (diasCob / 30).toFixed(1);
        lista.push({
          tipo: 'alerta', icono: '📦', titulo: 'Sobreinventario (' + diasCob + ' días ≈ ' + mesesCob + ' meses)',
          descripcion: 'Inventario de ' + fmtMoney(invValorTotal) + ' con rotación actual cubre demasiado tiempo.',
          accion: 'Acelerar desplazamiento de estos SKUs lentos con promoción/marketing:',
          sublist: topLentos.map(function(s) {
            return { sku: s.sku, desc: s.desc, detail: fmtNum(s.invStock) + ' pzs · ' + fmtMoney(s.invValor) + ' · ' + (s.diasSinVenta||0).toFixed(0) + 'd sin vender' };
          })
        });
      }
    }

    // SKUs en desabasto con venta activa
    if (skuAnalysis && skuAnalysis.all) {
      var desabastoActivo = skuAnalysis.all.filter(function(s) {
        return s.invStock === 0 && s.soTotal > 0;
      });
      if (desabastoActivo.length > 0) {
        var sorted = desabastoActivo.sort(function(a, b) { return b.soTotal - a.soTotal; }).slice(0, 5);
        lista.push({
          tipo: 'alerta', icono: '⚠️', titulo: desabastoActivo.length + ' SKUs agotados con venta activa',
          descripcion: 'Estos SKUs venden pero ya están en 0 piezas — perdiendo ventas.',
          accion: 'Reponer urgente:',
          sublist: sorted.map(function(s) { return { sku: s.sku, desc: s.desc, detail: fmtNum(s.soTotal) + ' pzs vendidas YTD' }; })
        });
      }
    }

    // Caída en sell-out vs periodo B
    if (compBData.so > 0 && compAData.so > 0) {
      var deltaSO = (compAData.so - compBData.so) / compBData.so * 100;
      if (deltaSO < -10) {
        lista.push({
          tipo: 'alerta', icono: '📉', titulo: 'Sell Out cayó ' + Math.abs(deltaSO).toFixed(1) + '%',
          descripcion: labelPeriodo(compA) + ' (' + fmtMoney(compAData.so) + ') vs ' + labelPeriodo(compB) + ' (' + fmtMoney(compBData.so) + ').',
          accion: 'Investigar causas: rotación, precios, marketing o competencia.'
        });
      }
    }

    // Producto con mayor crecimiento
    if (productoCrecimiento && productoCrecimiento.pct > 20) {
      var desc = productos.find(function(p) { return p.sku === productoCrecimiento.sku; });
      lista.push({
        tipo: 'positivo', icono: '🚀', titulo: 'Producto con crecimiento destacado',
        descripcion: productoCrecimiento.sku + (desc && desc.descripcion ? ' · ' + desc.descripcion.slice(0, 60) : '') +
          ' creció +' + productoCrecimiento.pct.toFixed(1) + '% (' + fmtMoney(productoCrecimiento.b) + ' → ' + fmtMoney(productoCrecimiento.a) + ').',
        accion: 'Reforzar: más inventario, exhibición y promoción en este producto.'
      });
    }

    // Oportunidad de reposición pendiente (usa skuAnalysis para sugerencia rápida)
    if (skuAnalysis && skuAnalysis.all) {
      var ultMes = Math.max.apply(null, (sellOutSku || []).map(function(r) { return Number(r.mes) || 0; }).concat([0]));
      var tres = Math.max(1, ultMes - 2);
      var rot = {};
      (sellOutSku || []).forEach(function(r) {
        var m = Number(r.mes) || 0;
        if (m < tres || m > ultMes) return;
        rot[r.sku] = (rot[r.sku] || 0) + Number(r.piezas) || 0;
      });
      var stockBy = {};
      (skuAnalysis.all || []).forEach(function(s) { stockBy[s.sku] = s.invStock; });
      var precioBy = {};
      productos.forEach(function(p) { precioBy[p.sku] = Number(p.precio_venta) || 0; });
      var sugPiezas = 0, sugMonto = 0, sugSkus = 0;
      Object.entries(rot).forEach(function(e) {
        var sku = e[0], piezas = e[1];
        var promMes = piezas / 3;
        if (promMes <= 0) return;
        var stk = stockBy[sku] || 0;
        var sug = Math.max(0, Math.round(promMes * 3 - stk));
        if (clienteKey === 'digitalife' && stk < promMes && sug < 11) sug = 11;
        if (sug > 0) { sugPiezas += sug; sugMonto += sug * (precioBy[sku] || 0); sugSkus++; }
      });
      if (sugMonto > 0) {
        lista.push({
          tipo: 'positivo', icono: '💰', titulo: 'Oportunidad de reposición',
          descripcion: sugSkus + ' SKUs necesitan reponerse con ' + fmtNum(sugPiezas) + ' piezas.',
          accion: 'Cerrar propuesta con el cliente por ' + fmtMoney(sugMonto) + '.'
        });
      }
    }

    return lista;
  }, [estadoCuenta, inventario, ytd, skuAnalysis, compAData, compBData, productoCrecimiento, productos, sellOutSku, clienteKey]);

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

  // —— SKU-level analysis (builds skuMap from union of all sources) ——
  var skuAnalysis = React.useMemo(function() {
    // If no data anywhere, skip
    if (productos.length === 0 && inventario.length === 0 && sellInSku.length === 0 && sellOutSku.length === 0) return null;
    // Filter inventario to most recent week snapshot only (avoid summing historical weeks)
    var maxA = 0, maxS = 0;
    inventario.forEach(function(inv) {
      var a = Number(inv.anio) || 0, s = Number(inv.semana) || 0;
      if (a > maxA || (a === maxA && s > maxS)) { maxA = a; maxS = s; }
    });
    var inventarioLatest = maxA > 0 ? inventario.filter(function(inv) {
      return Number(inv.anio) === maxA && Number(inv.semana) === maxS;
    }) : inventario;
    var skuMap = {};
    var ensure = function(sku) {
      if (!skuMap[sku]) {
        skuMap[sku] = { sku: sku, desc: sku, marca: "", categoria: "", costo: 0, precio: 0, siTotal: 0, soTotal: 0, invStock: 0, invValor: 0, diasSinVenta: 0 };
      }
      return skuMap[sku];
    };
    // Seed with productos_cliente (master data with descripcion, marca, precio, costo)
    productos.forEach(function(p) {
      var s = ensure(p.sku);
      s.desc = p.descripcion || p.sku;
      s.marca = p.marca || "";
      s.categoria = p.categoria || "";
      s.costo = Number(p.costo_promedio || 0);
      s.precio = Number(p.precio_venta || 0);
    });
    // Enrich with inventario_cliente LATEST WEEK only (has titulo as descripcion fallback)
    inventarioLatest.forEach(function(inv) {
      var s = ensure(inv.sku);
      s.invStock = Number(inv.stock || 0);
      // If valor is null, compute from stock × costo_convenio as fallback
      var rawValor = Number(inv.valor || 0);
      var costoConv = Number(inv.costo_convenio || 0);
      s.invValor = rawValor > 0 ? rawValor : (s.invStock * costoConv);
      s.diasSinVenta = Number(inv.dias_sin_venta || 0);
      if (!s.desc || s.desc === s.sku) s.desc = inv.titulo || inv.descripcion || s.sku;
      if (!s.marca) s.marca = inv.marca || "";
      if (!s.precio) s.precio = Number(inv.precio_venta || 0);
      if (!s.costo) s.costo = costoConv;
    });
    sellInSku.forEach(function(s) { ensure(s.sku).siTotal += Number(s.piezas || 0); });
    sellOutSku.forEach(function(s) { ensure(s.sku).soTotal += Number(s.piezas || 0); });
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
    // Inventory health — only count SKUs with actual stock (invStock > 0)
    // SKUs with stock=0 already sold out, not "dead inventory"
    var sinVenta60 = all.filter(function(s){return s.diasSinVenta>60 && s.invStock>0;});
    var sinVenta90 = all.filter(function(s){return s.diasSinVenta>90 && s.invStock>0;});
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
    // Only sum most recent week snapshot (avoid historical double-counting)
    var _maxA = 0, _maxS = 0;
    inventario.forEach(function(inv) {
      var a = Number(inv.anio) || 0, s = Number(inv.semana) || 0;
      if (a > _maxA || (a === _maxA && s > _maxS)) { _maxA = a; _maxS = s; }
    });
    var _invLatest = _maxA > 0 ? inventario.filter(function(inv) {
      return Number(inv.anio) === _maxA && Number(inv.semana) === _maxS;
    }) : inventario;
    var invValorTotal = _invLatest.reduce(function(s, r) {
      var v = Number(r.valor) || 0;
      if (v > 0) return s + v;
      return s + (Number(r.stock) || 0) * (Number(r.costo_convenio) || 0);
    }, 0);
    var soTotal = ytd.so;
    var mesesConDatos = ytd.mesesConDatos || 1;
    var soDiario = mesesConDatos > 0 ? soTotal / (mesesConDatos * 30) : 0;
    var diasInv = soDiario > 0 ? Math.round(invValorTotal / soDiario) : 0;
    // Rango saludable: 90-110 días. <70 desabasto, >130 sobreinventario
    var diasColor = (diasInv >= 80 && diasInv <= 120) ? "#10b981" : (diasInv >= 60 && diasInv <= 140) ? "#f59e0b" : "#ef4444";
    var diasDetalle = diasInv < 70 ? "⚠ Riesgo de desabasto" : diasInv > 130 ? "⚠ Sobreinventario" : diasInv >= 90 && diasInv <= 110 ? "✓ Saludable (90-110d)" : "Cercano a rango ideal";
    items.push({ label: "D\u00edas de Inventario", value: diasInv + " d\u00edas", color: diasColor, detail: diasDetalle });
    // 3. Valor del inventario (stock × costo_convenio)
    items.push({ label: "Valor del Inventario", value: fmtMoney(invValorTotal), color: "#3B82F6", detail: "Stock \u00d7 Costo Convenio" });
    // 4. Rotación Mensual: % del inventario que se vende al mes (ideal ~33% = 3 meses de stock)
    var rotMensual = invValorTotal > 0 && ytd.avgSO > 0 ? (ytd.avgSO / invValorTotal * 100) : 0;
    var rotColor = (rotMensual >= 28 && rotMensual <= 38) ? "#10b981" : (rotMensual >= 20 && rotMensual <= 45) ? "#f59e0b" : "#ef4444";
    var rotDetalle = rotMensual < 20 ? "⚠ Rotación lenta" : rotMensual > 45 ? "⚠ Rotación muy alta" : rotMensual >= 28 && rotMensual <= 38 ? "✓ Ideal (~33%)" : "Cercano a rango ideal";
    items.push({ label: "Rotación Mensual", value: rotMensual.toFixed(1) + "%", color: rotColor, detail: rotDetalle });
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
          "Un balance ideal es ~100% (entra lo mismo que sale y mantiene 90-110 días de inventario). <90% = cliente acumulando stock; >110% = reduciendo inventario hacia rango saludable."
        ),
      el("div", null,
        // YTD summary row
        el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
          metricBox("Sell In YTD", fmtM(ytd.si), null, "#3b82f6"),
          metricBox("Sell Out YTD", fmtM(ytd.so), null, "#10b981"),
          metricBox("Eficiencia de Venta YTD", fmtPct(ytd.st), ytd.st >= 90 && ytd.st <= 110 ? "✓ Balance ideal (~100%)" : ytd.st > 110 ? "Vendiendo más del stock (reducir sobreinv.)" : ytd.st >= 70 ? "Acumulando stock" : "Acumulando mucho stock", ytd.st >= 90 && ytd.st <= 110 ? "#10b981" : ytd.st >= 70 || ytd.st > 110 ? "#f59e0b" : "#ef4444")
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

    // === 3. COMPARATIVA PERIODO A vs B ===
    section("Comparativa entre Periodos", "\uD83D\uDD04",
      el("div", null,
        // Selector de modo
        el("div", { style: { display: "flex", gap: 6, marginBottom: 12 } },
          ['simple', 'trimestre', 'mes'].map(function(m) {
            return el("button", {
              key: m,
              onClick: function() { setVistaModo(m); },
              style: {
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: vistaModo === m ? "2px solid #4472c4" : "1px solid #e2e8f0",
                background: vistaModo === m ? "#eff6ff" : "#fff",
                color: vistaModo === m ? "#4472c4" : "#64748b"
              }
            }, m === 'simple' ? 'A vs B' : m === 'trimestre' ? 'Por Trimestre' : 'Por Mes');
          })
        ),
        // Selectores (solo en modo simple)
        vistaModo === 'simple' && el("div", { style: { display: "flex", gap: 12, marginBottom: 14, flexWrap: "wrap" } },
          el("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            el("span", { style: { fontSize: 12, color: "#475569", fontWeight: 600 } }, "A:"),
            el("select", { value: compA.tipo, onChange: function(e) { setCompA(Object.assign({}, compA, { tipo: e.target.value, mes: e.target.value === 'mes' || e.target.value === 'trimestre' ? (compA.mes || 1) : null })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              el("option", { value: "ytd" }, "YTD"),
              el("option", { value: "anio" }, "Año completo"),
              el("option", { value: "trimestre" }, "Trimestre"),
              el("option", { value: "mes" }, "Mes")
            ),
            el("select", { value: compA.anio, onChange: function(e) { setCompA(Object.assign({}, compA, { anio: Number(e.target.value) })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              el("option", { value: 2025 }, "2025"), el("option", { value: 2026 }, "2026")
            ),
            compA.tipo === 'mes' && el("select", { value: compA.mes || 1, onChange: function(e) { setCompA(Object.assign({}, compA, { mes: Number(e.target.value) })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              MESES.map(function(m, i) { return el("option", { key: i, value: i + 1 }, m); })
            ),
            compA.tipo === 'trimestre' && el("select", { value: Math.ceil((compA.mes || 1) / 3), onChange: function(e) { setCompA(Object.assign({}, compA, { mes: (Number(e.target.value) - 1) * 3 + 1 })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              [1,2,3,4].map(function(q) { return el("option", { key: q, value: q }, "Q" + q); })
            )
          ),
          el("span", { style: { fontSize: 18, color: "#94a3b8" } }, "vs"),
          el("div", { style: { display: "flex", alignItems: "center", gap: 6 } },
            el("span", { style: { fontSize: 12, color: "#475569", fontWeight: 600 } }, "B:"),
            el("select", { value: compB.tipo, onChange: function(e) { setCompB(Object.assign({}, compB, { tipo: e.target.value, mes: e.target.value === 'mes' || e.target.value === 'trimestre' ? (compB.mes || 1) : null })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              el("option", { value: "ytd" }, "YTD"),
              el("option", { value: "anio" }, "Año completo"),
              el("option", { value: "trimestre" }, "Trimestre"),
              el("option", { value: "mes" }, "Mes")
            ),
            el("select", { value: compB.anio, onChange: function(e) { setCompB(Object.assign({}, compB, { anio: Number(e.target.value) })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              el("option", { value: 2025 }, "2025"), el("option", { value: 2026 }, "2026")
            ),
            compB.tipo === 'mes' && el("select", { value: compB.mes || 1, onChange: function(e) { setCompB(Object.assign({}, compB, { mes: Number(e.target.value) })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              MESES.map(function(m, i) { return el("option", { key: i, value: i + 1 }, m); })
            ),
            compB.tipo === 'trimestre' && el("select", { value: Math.ceil((compB.mes || 1) / 3), onChange: function(e) { setCompB(Object.assign({}, compB, { mes: (Number(e.target.value) - 1) * 3 + 1 })); },
              style: { padding: "5px 8px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 12 } },
              [1,2,3,4].map(function(q) { return el("option", { key: q, value: q }, "Q" + q); })
            )
          )
        ),
        // Tabla comparativa A vs B (modo simple)
        vistaModo === 'simple' && el("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 13 } },
          el("thead", null,
            el("tr", { style: { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" } },
              el("th", { style: { textAlign: "left", padding: "8px 12px", color: "#475569", fontWeight: 600 } }, "Métrica"),
              el("th", { style: { textAlign: "right", padding: "8px 12px", color: "#3b82f6", fontWeight: 600 } }, labelPeriodo(compA)),
              el("th", { style: { textAlign: "right", padding: "8px 12px", color: "#8b5cf6", fontWeight: 600 } }, labelPeriodo(compB)),
              el("th", { style: { textAlign: "right", padding: "8px 12px", color: "#475569", fontWeight: 600, width: 120 } }, "Δ%")
            )
          ),
          el("tbody", null,
            [
              { label: "Sell In", a: compAData.si, b: compBData.si, money: true },
              { label: "Sell Out", a: compAData.so, b: compBData.so, money: true },
              { label: "Eficiencia SI/SO", a: compAData.ef, b: compBData.ef, pct: true },
              { label: "Piezas Sell Out", a: compAData.piezasSO, b: compBData.piezasSO, num: true },
              { label: "SKUs activos", a: compAData.skus, b: compBData.skus, num: true }
            ].map(function(row, i) {
              var fmt = row.money ? fmtMoney : (row.pct ? fmtPct : fmtNum);
              var delta = row.b > 0 ? ((row.a - row.b) / row.b * 100) : null;
              var color = delta === null ? "#94a3b8" : delta >= 5 ? "#10b981" : delta <= -5 ? "#ef4444" : "#64748b";
              var arrow = delta === null ? "—" : delta > 0 ? "▲ +" + delta.toFixed(1) + "%" : "▼ " + delta.toFixed(1) + "%";
              return el("tr", { key: i, style: { borderBottom: "1px solid #f1f5f9" } },
                el("td", { style: { padding: "10px 12px", color: "#1e293b", fontWeight: 500 } }, row.label),
                el("td", { style: { padding: "10px 12px", textAlign: "right", color: "#1e293b" } }, fmt(row.a)),
                el("td", { style: { padding: "10px 12px", textAlign: "right", color: "#475569" } }, fmt(row.b)),
                el("td", { style: { padding: "10px 12px", textAlign: "right", color: color, fontWeight: 700 } }, arrow)
              );
            })
          )
        ),
        // === Vista POR TRIMESTRE (2026 Q1-Q4 vs 2025 Q1-Q4) ===
        vistaModo === 'trimestre' && (function() {
          var periodos = [];
          for (var q = 1; q <= 4; q++) {
            periodos.push({ label: "Q" + q, a: computePeriodo({ tipo: 'trimestre', anio: 2026, mes: (q-1)*3 + 1 }), b: computePeriodo({ tipo: 'trimestre', anio: 2025, mes: (q-1)*3 + 1 }) });
          }
          return el("div", { style: { overflowX: "auto" } },
            el("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 12 } },
              el("thead", null,
                el("tr", { style: { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" } },
                  el("th", { style: { textAlign: "left", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Trimestre"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#3b82f6", fontWeight: 600 } }, "SI 2026"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#8b5cf6", fontWeight: 600 } }, "SI 2025"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600, width: 90 } }, "Δ% SI"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#10b981", fontWeight: 600 } }, "SO 2026"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#059669", fontWeight: 600 } }, "SO 2025"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600, width: 90 } }, "Δ% SO"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Efi 2026"),
                  el("th", { style: { textAlign: "right", padding: "8px 10px", color: "#475569", fontWeight: 600 } }, "Efi 2025")
                )
              ),
              el("tbody", null,
                periodos.map(function(p, i) {
                  var dSI = p.b.si > 0 ? (p.a.si - p.b.si) / p.b.si * 100 : null;
                  var dSO = p.b.so > 0 ? (p.a.so - p.b.so) / p.b.so * 100 : null;
                  var cSI = dSI === null ? "#94a3b8" : dSI >= 0 ? "#10b981" : "#ef4444";
                  var cSO = dSO === null ? "#94a3b8" : dSO >= 0 ? "#10b981" : "#ef4444";
                  return el("tr", { key: i, style: { borderBottom: "1px solid #f1f5f9" } },
                    el("td", { style: { padding: "8px 10px", fontWeight: 600, color: "#1e293b" } }, p.label),
                    el("td", { style: { padding: "8px 10px", textAlign: "right" } }, p.a.si > 0 ? fmtMoney(p.a.si) : "—"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right", color: "#64748b" } }, p.b.si > 0 ? fmtMoney(p.b.si) : "—"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right", color: cSI, fontWeight: 600 } }, dSI === null ? "—" : (dSI >= 0 ? "+" : "") + dSI.toFixed(1) + "%"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right" } }, p.a.so > 0 ? fmtMoney(p.a.so) : "—"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right", color: "#64748b" } }, p.b.so > 0 ? fmtMoney(p.b.so) : "—"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right", color: cSO, fontWeight: 600 } }, dSO === null ? "—" : (dSO >= 0 ? "+" : "") + dSO.toFixed(1) + "%"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right", color: p.a.ef >= 80 ? "#10b981" : p.a.ef >= 50 ? "#f59e0b" : p.a.ef > 0 ? "#ef4444" : "#94a3b8" } }, p.a.ef > 0 ? fmtPct(p.a.ef) : "—"),
                    el("td", { style: { padding: "8px 10px", textAlign: "right", color: "#64748b" } }, p.b.ef > 0 ? fmtPct(p.b.ef) : "—")
                  );
                })
              )
            )
          );
        })(),
        // === Vista POR MES (2026 vs 2025, 12 meses) ===
        vistaModo === 'mes' && (function() {
          var mesesArr = [];
          for (var m = 1; m <= 12; m++) {
            mesesArr.push({ label: MESES[m-1], a: computePeriodo({ tipo: 'mes', anio: 2026, mes: m }), b: computePeriodo({ tipo: 'mes', anio: 2025, mes: m }) });
          }
          return el("div", { style: { overflowX: "auto" } },
            el("table", { style: { width: "100%", borderCollapse: "collapse", fontSize: 11 } },
              el("thead", null,
                el("tr", { style: { background: "#f8fafc", borderBottom: "2px solid #e2e8f0" } },
                  el("th", { style: { textAlign: "left", padding: "6px 8px", color: "#475569", fontWeight: 600 } }, "Mes"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#3b82f6", fontWeight: 600 } }, "SI 2026"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#8b5cf6", fontWeight: 600 } }, "SI 2025"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#475569", fontWeight: 600, width: 80 } }, "Δ SI"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#10b981", fontWeight: 600 } }, "SO 2026"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#059669", fontWeight: 600 } }, "SO 2025"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#475569", fontWeight: 600, width: 80 } }, "Δ SO"),
                  el("th", { style: { textAlign: "right", padding: "6px 8px", color: "#475569", fontWeight: 600 } }, "Efi 2026")
                )
              ),
              el("tbody", null,
                mesesArr.map(function(p, i) {
                  var dSI = p.b.si > 0 ? (p.a.si - p.b.si) / p.b.si * 100 : null;
                  var dSO = p.b.so > 0 ? (p.a.so - p.b.so) / p.b.so * 100 : null;
                  var cSI = dSI === null ? "#94a3b8" : dSI >= 0 ? "#10b981" : "#ef4444";
                  var cSO = dSO === null ? "#94a3b8" : dSO >= 0 ? "#10b981" : "#ef4444";
                  var hasData = p.a.si > 0 || p.a.so > 0 || p.b.si > 0 || p.b.so > 0;
                  return el("tr", { key: i, style: { borderBottom: "1px solid #f1f5f9", opacity: hasData ? 1 : 0.4 } },
                    el("td", { style: { padding: "6px 8px", fontWeight: 600, color: "#1e293b" } }, p.label),
                    el("td", { style: { padding: "6px 8px", textAlign: "right" } }, p.a.si > 0 ? fmtK(p.a.si) : "—"),
                    el("td", { style: { padding: "6px 8px", textAlign: "right", color: "#64748b" } }, p.b.si > 0 ? fmtK(p.b.si) : "—"),
                    el("td", { style: { padding: "6px 8px", textAlign: "right", color: cSI, fontWeight: 600 } }, dSI === null ? "—" : (dSI >= 0 ? "+" : "") + dSI.toFixed(0) + "%"),
                    el("td", { style: { padding: "6px 8px", textAlign: "right" } }, p.a.so > 0 ? fmtK(p.a.so) : "—"),
                    el("td", { style: { padding: "6px 8px", textAlign: "right", color: "#64748b" } }, p.b.so > 0 ? fmtK(p.b.so) : "—"),
                    el("td", { style: { padding: "6px 8px", textAlign: "right", color: cSO, fontWeight: 600 } }, dSO === null ? "—" : (dSO >= 0 ? "+" : "") + dSO.toFixed(0) + "%"),
                    el("td", { style: { padding: "6px 8px", textAlign: "right", color: p.a.ef >= 80 ? "#10b981" : p.a.ef >= 50 ? "#f59e0b" : p.a.ef > 0 ? "#ef4444" : "#94a3b8" } }, p.a.ef > 0 ? fmtPct(p.a.ef) : "—")
                  );
                })
              )
            )
          );
        })()
      )
    ),

    // === 4. PROYECCIÓN ===
    section("Proyecci\u00F3n de Cierre Anual", "\uD83D\uDD2E",
      el("div", null,
        ytd.mesesConDatos >= 2 ? el("div", null,
          // Banner cuotas con gap para superar ideal
          (function() {
            var cuotaMin = totalCuotaMinA > 0 ? totalCuotaMinA : 0;
            var cuotaIdeal = totalCuotaIdealA > 0 ? totalCuotaIdealA : 0;
            var mesesRest = 12 - ytd.mesesConDatos;
            var gapMin = cuotaMin - ytd.si;
            var gapIdeal = cuotaIdeal - ytd.si;
            var mensualParaMin = mesesRest > 0 && gapMin > 0 ? gapMin / mesesRest : 0;
            var mensualParaIdeal = mesesRest > 0 && gapIdeal > 0 ? gapIdeal / mesesRest : 0;
            return el("div", { style: { background: "linear-gradient(135deg, #fef3c7, #fde68a)", borderRadius: 10, padding: "14px 18px", marginBottom: 14 } },
              el("div", { style: { fontSize: 13, fontWeight: 700, color: "#92400e", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 } },
                el(Target, { style: { width: 14, height: 14 } }), "Esfuerzo para superar cuotas"),
              el("div", { style: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 } },
                el("div", null,
                  el("div", { style: { fontSize: 10, color: "#78350f", fontWeight: 600 } }, "CUOTA MÍNIMA"),
                  el("div", { style: { fontSize: 18, fontWeight: 700, color: "#b45309" } }, fmtM(cuotaMin))
                ),
                el("div", null,
                  el("div", { style: { fontSize: 10, color: "#78350f", fontWeight: 600 } }, "CUOTA IDEAL"),
                  el("div", { style: { fontSize: 18, fontWeight: 700, color: "#d97706" } }, fmtM(cuotaIdeal))
                ),
                el("div", null,
                  el("div", { style: { fontSize: 10, color: "#78350f", fontWeight: 600 } }, "PARA CERRAR EN MÍN (prom/mes)"),
                  el("div", { style: { fontSize: 16, fontWeight: 700, color: gapMin <= 0 ? "#065f46" : "#b45309" } },
                    gapMin <= 0 ? "✓ Ya superado" : (fmtM(mensualParaMin) + "/mes en " + mesesRest + " m"))
                ),
                el("div", null,
                  el("div", { style: { fontSize: 10, color: "#78350f", fontWeight: 600 } }, "PARA SUPERAR IDEAL (prom/mes)"),
                  el("div", { style: { fontSize: 16, fontWeight: 700, color: gapIdeal <= 0 ? "#065f46" : "#d97706" } },
                    gapIdeal <= 0 ? "✓ Ya superado" : (fmtM(mensualParaIdeal) + "/mes en " + mesesRest + " m"))
                )
              )
            );
          })(),
          // Proyección base: usa CUOTA MÍNIMA como referencia
          el("div", { style: { display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" } },
            metricBox("Promedio Mensual SI", fmtM(ytd.avgSI), ytd.mesesConDatos + " meses completos (excluye mes en curso)", "#3b82f6"),
            metricBox("Proyección SI Anual", fmtM(ytd.projSI),
              totalCuotaMinA > 0 ? "vs Mín: " + fmtPct(ytd.projSI / totalCuotaMinA * 100) + (ytd.projSI >= totalCuotaMinA ? " ✓" : " ⚠") : "Estimado cierre " + anio,
              ytd.projSI >= totalCuotaMinA ? "#10b981" : "#ef4444"),
            metricBox("Ratio SI/SO", ytd.so > 0 ? fmtPct(ytd.so/ytd.si*100) : "—",
              ytd.st < 50 ? "⚠️ Riesgo sobreinventario" : ytd.st < 70 ? "⚠️ Inventario acumulado" : "Rotación saludable",
              ytd.st < 50 ? "#ef4444" : ytd.st < 70 ? "#f59e0b" : "#10b981"),
            metricBox("Promedio Mensual SO", fmtM(ytd.avgSO), ytd.mesesConDatos + " meses completos (excluye mes en curso)", "#10b981"),
            metricBox("Proyección SO Anual", fmtM(ytd.projSO),
              totalCuotaMinA > 0 ? "vs Mín: " + fmtPct(ytd.projSO / totalCuotaMinA * 100) + (ytd.projSO >= totalCuotaMinA ? " ✓" : " ⚠") : "Estimado cierre " + anio,
              ytd.projSO >= totalCuotaMinA ? "#10b981" : "#ef4444")
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
    ),

    // === 5. INSIGHTS / COSAS POR HACER ===
    section("Cosas por Hacer", "\uD83D\uDCA1",
      insights.length === 0
        ? el("div", { style: { textAlign: "center", padding: 20, color: "#10b981", fontSize: 13, fontStyle: "italic" } }, "✓ Todo en orden. Sin acciones pendientes detectadas.")
        : el("div", { style: { display: "flex", flexDirection: "column", gap: 10 } },
          insights.map(function(ins, i) {
            var bg = ins.tipo === 'critico' ? "#fef2f2" : ins.tipo === 'alerta' ? "#fffbeb" : "#ecfdf5";
            var borderColor = ins.tipo === 'critico' ? "#fecaca" : ins.tipo === 'alerta' ? "#fde68a" : "#a7f3d0";
            var titleColor = ins.tipo === 'critico' ? "#991b1b" : ins.tipo === 'alerta' ? "#92400e" : "#065f46";
            return el("div", { key: i, style: { background: bg, border: "1px solid " + borderColor, borderRadius: 10, padding: "12px 14px" } },
              el("div", { style: { display: "flex", alignItems: "flex-start", gap: 10 } },
                el("span", { style: { fontSize: 22, lineHeight: 1 } }, ins.icono),
                el("div", { style: { flex: 1 } },
                  el("div", { style: { fontSize: 13, fontWeight: 700, color: titleColor, marginBottom: 2 } }, ins.titulo),
                  el("div", { style: { fontSize: 12, color: "#334155", marginBottom: 4 } }, ins.descripcion),
                  ins.accion && el("div", { style: { fontSize: 12, color: titleColor, fontWeight: 600 } }, "→ " + ins.accion),
                  ins.sublist && el("ul", { style: { margin: "6px 0 0 16px", padding: 0, fontSize: 11 } },
                    ins.sublist.map(function(item, j) {
                      return el("li", { key: j, style: { color: "#475569", padding: "2px 0" } },
                        el("span", { style: { fontFamily: "ui-monospace,monospace", color: "#1e293b", marginRight: 6 } }, item.sku),
                        el("span", null, (item.desc || '').slice(0, 50)),
                        item.detail ? el("span", { style: { color: "#94a3b8", marginLeft: 6 } }, "— " + item.detail) : null
                      );
                    })
                  )
                )
              )
            );
          })
        )
    ),

    // ═══ Comparativa por Marca (movido desde Estrategia) ═══
    aggsByMarcaCat && Object.keys(aggsByMarcaCat.byMarca).length > 0 && el("div", { style: { background:"#ffffff", borderRadius:12, padding:"16px 20px", marginTop:24, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" } },
      el("h3", { style: { margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#1e293b" } }, "Comparativa por Marca"),
      el("div", { style: { overflowX: "auto" } },
        (function() {
          var esPcel = aggsByMarcaCat.esPcel;
          return el("table", { style: { width: "100%", fontSize: 13, borderCollapse: "collapse" } },
            el("thead", null,
              el("tr", { style: { borderBottom: "1px solid #e2e8f0" } },
                el("th", { style: { textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Marca"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Sell-In pzs"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Sell-In $"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Sell-Out pzs"),
                !esPcel && el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Sell-Out $"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Inv pzs"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Inv $")
              )
            ),
            el("tbody", null,
              Object.entries(aggsByMarcaCat.byMarca).sort(function(a,b){return b[1].soMonto-a[1].soMonto;}).map(function(entry) {
                var marca = entry[0], m = entry[1];
                return el("tr", { key: marca, style: { borderBottom: "1px solid #f1f5f9" } },
                  el("td", { style: { padding: "10px 12px", color: "#1e293b", fontWeight: 600 } }, marca),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, m.siPiezas.toLocaleString("es-MX")),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, fmtMoney(m.siMonto)),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, m.soPiezas.toLocaleString("es-MX")),
                  !esPcel && el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, fmtMoney(m.soMonto)),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, m.invPiezas.toLocaleString("es-MX")),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, fmtMoney(m.invValor))
                );
              })
            )
          );
        })()
      )
    ),

    // ═══ Por Categoría (movido desde Estrategia) ═══
    aggsByMarcaCat && Object.keys(aggsByMarcaCat.byCategoria).length > 0 && el("div", { style: { background:"#ffffff", borderRadius:12, padding:"16px 20px", marginTop:24, boxShadow:"0 1px 3px rgba(0,0,0,0.04)" } },
      el("h3", { style: { margin: "0 0 12px", fontSize: 14, fontWeight: 700, color: "#1e293b" } }, "Por Categoría (ambas marcas)"),
      el("div", { style: { overflowX: "auto" } },
        (function() {
          var esPcel = aggsByMarcaCat.esPcel;
          var metric = function(c) { return esPcel ? c.soPiezas : c.soMonto; };
          var totalSO = Object.values(aggsByMarcaCat.byCategoria).reduce(function(s,c){return s+metric(c);},0);
          return el("table", { style: { width: "100%", fontSize: 13, borderCollapse: "collapse" } },
            el("thead", null,
              el("tr", { style: { borderBottom: "1px solid #e2e8f0" } },
                el("th", { style: { textAlign: "left", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Categoría"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "Valor Inventario"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, esPcel ? "Sell-Out pzs" : "Sell-Out $"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "% SO"),
                el("th", { style: { textAlign: "right", padding: "8px 12px", fontWeight: 600, color: "#475569" } }, "SKUs c/Inv")
              )
            ),
            el("tbody", null,
              Object.entries(aggsByMarcaCat.byCategoria).sort(function(a,b){return metric(b[1])-metric(a[1]);}).map(function(entry) {
                var cat = entry[0], c = entry[1];
                var pctTxt = totalSO > 0 ? (metric(c)/totalSO*100).toFixed(1) + "%" : "0.0%";
                var soDisplay = esPcel ? c.soPiezas.toLocaleString("es-MX") : fmtMoney(c.soMonto);
                return el("tr", { key: cat, style: { borderBottom: "1px solid #f1f5f9" } },
                  el("td", { style: { padding: "10px 12px", color: "#1e293b", fontWeight: 600 } }, cat),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, fmtMoney(c.invValor)),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, soDisplay),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, pctTxt),
                  el("td", { style: { textAlign: "right", padding: "10px 12px", color: "#475569" } }, c.invPiezas > 0 ? c.invPiezas.toLocaleString("es-MX") : "0")
                );
              })
            )
          );
        })()
      )
    )
  );
}

// ==================== FORECAST CLIENTE ====================

