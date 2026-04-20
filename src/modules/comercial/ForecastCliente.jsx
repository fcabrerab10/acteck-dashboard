import React, { useState, useEffect } from "react";
import { supabase } from '../../lib/supabase';
import { fetchSelloutSku, fetchInventarioCliente } from '../../lib/pcelAdapter';

export default function ForecastCliente({ cliente, clienteKey }) {
  const [loading, setLoading] = React.useState(true);
  const [ventas, setVentas] = React.useState([]);
  const [sellInSku, setSellInSku] = React.useState([]);
  const [sellOutSku, setSellOutSku] = React.useState([]);
  const [inventario, setInventario] = React.useState([]);
  const [enCamino, setEnCamino] = React.useState([]);
  const [productos, setProductos] = React.useState([]);
  const [seccionActiva, setSeccionActiva] = React.useState('resumen');
  const [busqueda, setBusqueda] = React.useState('');
  const [ordenSku, setOrdenSku] = React.useState('riesgo');

  React.useEffect(function() {
    if (!clienteKey) return;
    setLoading(true);
    const anioActual = new Date().getFullYear();
    Promise.all([
      supabase.from('ventas_mensuales').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('sell_in_sku').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      fetchSelloutSku(clienteKey, anioActual),
      fetchInventarioCliente(clienteKey),
      supabase.from('inventario_en_camino').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; }),
      supabase.from('productos_cliente').select('*').eq('cliente', clienteKey).then(function(r) { return r.data || []; })
    ]).then(function(results) {
      setVentas(results[0] || []);
      setSellInSku(results[1] || []);
      setSellOutSku(results[2] || []);
      setInventario(results[3] || []);
      setEnCamino(results[4] || []);
      setProductos(results[5] || []);
      setLoading(false);
    });
  }, [clienteKey]);

  // ===== HELPER FUNCTIONS =====
  var currentMonth = new Date().getMonth() + 1;
  var currentYear = new Date().getFullYear();

  var fmt = function(n) {
    if (n === null || n === undefined || isNaN(n)) return '$0';
    return '$' + Math.round(n).toLocaleString('es-MX');
  };

  var fmtN = function(n) {
    if (n === null || n === undefined || isNaN(n)) return '0';
    return Math.round(n).toLocaleString('es-MX');
  };

  // Calculate weighted average demand per SKU (last 3 months sell-out, weighted: recent months heavier)
  var calcDemandaSku = function(sku) {
    var soRows = sellOutSku.filter(function(r) { return r.sku === sku; });
    if (soRows.length === 0) {
      // Fallback to sell-in as proxy
      var siRows = sellInSku.filter(function(r) { return r.sku === sku; });
      if (siRows.length === 0) return { promMensual: 0, tendencia: 0, meses: 0 };
      siRows.sort(function(a, b) { return (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes); });
      var recSi = siRows.slice(0, 3);
      var wSi = [0.5, 0.33, 0.17];
      var totalW = 0; var sumW = 0;
      recSi.forEach(function(r, i) { sumW += (r.piezas || 0) * wSi[i]; totalW += wSi[i]; });
      return { promMensual: totalW > 0 ? sumW / totalW : 0, tendencia: 0, meses: recSi.length, fuente: 'sell-in' };
    }
    soRows.sort(function(a, b) { return (b.anio * 12 + b.mes) - (a.anio * 12 + a.mes); });
    var rec = soRows.slice(0, 3);
    var weights = [0.5, 0.33, 0.17];
    var tW = 0; var sW = 0;
    rec.forEach(function(r, i) { sW += (r.piezas || 0) * weights[i]; tW += weights[i]; });
    var prom = tW > 0 ? sW / tW : 0;
    // Tendencia: diferencia entre mes más reciente y promedio
    var tend = rec.length >= 2 ? ((rec[0].piezas || 0) - (rec[rec.length - 1].piezas || 0)) / rec.length : 0;
    return { promMensual: prom, tendencia: tend, meses: rec.length, fuente: 'sell-out' };
  };

  // Seasonality index by month (from ventas_mensuales)
  var calcSeasonality = function() {
    if (ventas.length === 0) return {};
    var byMonth = {};
    var total = 0;
    ventas.forEach(function(v) {
      var m = parseInt(v.mes);
      var so = parseFloat(v.sell_out) || parseFloat(v.sell_in) || 0;
      if (!byMonth[m]) byMonth[m] = { sum: 0, count: 0 };
      byMonth[m].sum += so;
      byMonth[m].count += 1;
      total += so;
    });
    var avgMonth = total / 12;
    var indices = {};
    for (var m = 1; m <= 12; m++) {
      if (byMonth[m] && avgMonth > 0) {
        indices[m] = (byMonth[m].sum / byMonth[m].count) / avgMonth;
      } else {
        indices[m] = 1;
      }
    }
    return indices;
  };

  var seasonality = calcSeasonality();

  // Get all unique SKUs
  var allSkus = React.useMemo(function() {
    var set = {};
    productos.forEach(function(p) { set[p.sku] = true; });
    inventario.forEach(function(i) { set[i.sku] = true; });
    sellInSku.forEach(function(s) { set[s.sku] = true; });
    sellOutSku.forEach(function(s) { set[s.sku] = true; });
    return Object.keys(set);
  }, [productos, inventario, sellInSku, sellOutSku]);

  // Build forecast data per SKU
  var forecastData = React.useMemo(function() {
    return allSkus.map(function(sku) {
      var prod = productos.find(function(p) { return p.sku === sku; }) || {};
      var inv = inventario.find(function(i) { return i.sku === sku; }) || {};
      var transit = enCamino.filter(function(e) { return e.sku === sku && e.estatus !== 'entregado'; });
      var transitPzas = transit.reduce(function(s, t) { return s + (t.piezas || 0); }, 0);
      var demanda = calcDemandaSku(sku);
      var stockActual = inv.stock || 0;
      var stockTotal = stockActual + transitPzas;
      var coberturaSemanas = demanda.promMensual > 0 ? (stockTotal / demanda.promMensual) * 4.33 : 999;
      var coberturaActualSemanas = demanda.promMensual > 0 ? (stockActual / demanda.promMensual) * 4.33 : 999;

      // Sugerido de compra: 8 semanas de cobertura target
      var targetSemanas = 8;
      var necesario = Math.ceil(demanda.promMensual * (targetSemanas / 4.33));
      var sugerido = Math.max(0, necesario - stockTotal);

      // Risk level
      var riesgo = 'ok';
      if (coberturaSemanas < 2) riesgo = 'critico';
      else if (coberturaSemanas < 4) riesgo = 'bajo';
      else if (coberturaSemanas > 16) riesgo = 'sobrestock';

      // Proyección next 6 months
      var proyeccion = [];
      for (var i = 1; i <= 6; i++) {
        var mesP = ((currentMonth - 1 + i) % 12) + 1;
        var seasonIdx = seasonality[mesP] || 1;
        var demMes = Math.round(demanda.promMensual * seasonIdx);
        proyeccion.push({ mes: mesP, demanda: demMes });
      }

      return {
        sku: sku,
        descripcion: prod.descripcion || inv.titulo || sku,
        marca: prod.marca || inv.marca || '',
        categoria: prod.categoria || '',
        stockActual: stockActual,
        enTransito: transitPzas,
        stockTotal: stockTotal,
        demandaMensual: Math.round(demanda.promMensual),
        tendencia: demanda.tendencia,
        fuenteDemanda: demanda.fuente || 'sell-out',
        coberturaSemanas: Math.round(coberturaSemanas * 10) / 10,
        coberturaActualSemanas: Math.round(coberturaActualSemanas * 10) / 10,
        sugerido: sugerido,
        riesgo: riesgo,
        costoUnitario: parseFloat(prod.costo_promedio) || parseFloat(inv.costo_convenio) || 0,
        valorSugerido: sugerido * (parseFloat(prod.costo_promedio) || parseFloat(inv.costo_convenio) || 0),
        proyeccion: proyeccion,
        transitDetail: transit
      };
    }).filter(function(d) { return d.demandaMensual > 0 || d.stockActual > 0 || d.enTransito > 0; });
  }, [allSkus, productos, inventario, enCamino, sellInSku, sellOutSku, seasonality]);

  // ===== AGGREGATIONS =====
  var totalDemanda = forecastData.reduce(function(s, d) { return s + d.demandaMensual; }, 0);
  var totalStock = forecastData.reduce(function(s, d) { return s + d.stockActual; }, 0);
  var totalTransito = forecastData.reduce(function(s, d) { return s + d.enTransito; }, 0);
  var totalSugerido = forecastData.reduce(function(s, d) { return s + d.sugerido; }, 0);
  var totalValorSugerido = forecastData.reduce(function(s, d) { return s + d.valorSugerido; }, 0);
  var coberturaGlobal = totalDemanda > 0 ? ((totalStock + totalTransito) / totalDemanda) * 4.33 : 0;
  var criticos = forecastData.filter(function(d) { return d.riesgo === 'critico'; }).length;
  var bajos = forecastData.filter(function(d) { return d.riesgo === 'bajo'; }).length;
  var sobrestock = forecastData.filter(function(d) { return d.riesgo === 'sobrestock'; }).length;

  // Filter and sort
  var filteredData = forecastData.filter(function(d) {
    if (!busqueda) return true;
    var b = busqueda.toLowerCase();
    return (d.sku && d.sku.toLowerCase().indexOf(b) >= 0) ||
           (d.descripcion && d.descripcion.toLowerCase().indexOf(b) >= 0) ||
           (d.marca && d.marca.toLowerCase().indexOf(b) >= 0);
  });

  filteredData.sort(function(a, b) {
    if (ordenSku === 'riesgo') {
      var riskOrder = { critico: 0, bajo: 1, ok: 2, sobrestock: 3 };
      return (riskOrder[a.riesgo] || 2) - (riskOrder[b.riesgo] || 2);
    }
    if (ordenSku === 'demanda') return b.demandaMensual - a.demandaMensual;
    if (ordenSku === 'cobertura') return a.coberturaSemanas - b.coberturaSemanas;
    if (ordenSku === 'sugerido') return b.sugerido - a.sugerido;
    return 0;
  });

  // Month names
  var meses = ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

  // Risk badge helper
  var riskBadge = function(riesgo) {
    var colors = {
      critico: { bg: '#fef2f2', color: '#dc2626', border: '#fecaca', label: 'Cr\u00edtico' },
      bajo: { bg: '#fffbeb', color: '#d97706', border: '#fde68a', label: 'Stock Bajo' },
      ok: { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0', label: 'OK' },
      sobrestock: { bg: '#eff6ff', color: '#2563eb', border: '#bfdbfe', label: 'Sobrestock' }
    };
    var c = colors[riesgo] || colors.ok;
    return React.createElement('span', {
      style: { padding: '2px 10px', borderRadius: '9999px', fontSize: '11px', fontWeight: 600,
               backgroundColor: c.bg, color: c.color, border: '1px solid ' + c.border }
    }, c.label);
  };

  // Semaphore bar
  var semaphoreBar = function(semanas) {
    var pct = Math.min(100, (semanas / 16) * 100);
    var color = semanas < 2 ? '#dc2626' : semanas < 4 ? '#d97706' : semanas <= 12 ? '#16a34a' : '#2563eb';
    return React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '8px' } },
      React.createElement('div', { style: { flex: 1, height: '8px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' } },
        React.createElement('div', { style: { width: pct + '%', height: '100%', backgroundColor: color, borderRadius: '4px', transition: 'width 0.5s' } })
      ),
      React.createElement('span', { style: { fontSize: '12px', fontWeight: 600, color: color, minWidth: '50px' } },
        semanas >= 999 ? 'Sin demanda' : semanas.toFixed(1) + ' sem')
    );
  };

  // ===== SECTIONS =====
  var secciones = [
    { key: 'resumen', label: 'Resumen de Forecast', icon: '\uD83D\uDCCA' },
    { key: 'demanda', label: 'Demanda Proyectada', icon: '\uD83D\uDCC8' },
    { key: 'cobertura', label: 'Cobertura de Inventario', icon: '\uD83D\uDEE1\uFE0F' },
    { key: 'sugerido', label: 'Sugerido de Compra', icon: '\uD83D\uDED2' },
    { key: 'temporalidad', label: 'Temporalidad', icon: '\uD83D\uDCC5' },
    { key: 'alertas', label: 'Alertas y Riesgos', icon: '\u26A0\uFE0F' }
  ];

  if (loading) {
    return React.createElement('div', { style: { minHeight: '100vh', backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center' } },
      React.createElement('div', { style: { textAlign: 'center' } },
        React.createElement('div', { style: { fontSize: '48px', marginBottom: '16px', animation: 'pulse 2s infinite' } }, '\uD83D\uDD2E'),
        React.createElement('p', { style: { color: '#64748b', fontSize: '16px' } }, 'Calculando forecast...')
      )
    );
  }

  // ===== SECTION: RESUMEN =====
  var renderResumen = function() {
    var kpis = [
      { label: 'Demanda Mensual Prom.', value: fmtN(totalDemanda) + ' pzas', sub: 'Basado en sell-out ponderado', color: '#6366f1' },
      { label: 'Stock Disponible', value: fmtN(totalStock) + ' pzas', sub: fmt(totalStock * (forecastData.length > 0 ? forecastData.reduce(function(s,d){return s+d.costoUnitario;},0)/forecastData.length : 0)), color: '#10b981' },
      { label: 'En Tr\u00e1nsito', value: fmtN(totalTransito) + ' pzas', sub: enCamino.length + ' pedidos activos', color: '#f59e0b' },
      { label: 'Cobertura Global', value: coberturaGlobal.toFixed(1) + ' semanas', sub: coberturaGlobal < 4 ? 'Nivel bajo' : coberturaGlobal > 12 ? 'Sobrestock' : 'Nivel saludable', color: coberturaGlobal < 4 ? '#dc2626' : '#10b981' },
      { label: 'Sugerido de Compra', value: fmtN(totalSugerido) + ' pzas', sub: fmt(totalValorSugerido), color: '#8b5cf6' },
      { label: 'SKUs en Riesgo', value: criticos + bajos, sub: criticos + ' cr\u00edticos, ' + bajos + ' bajos', color: criticos > 0 ? '#dc2626' : '#f59e0b' }
    ];

    return React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' } },
      kpis.map(function(k, i) {
        return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '4px solid ' + k.color } },
          React.createElement('p', { style: { fontSize: '13px', color: '#64748b', marginBottom: '4px', fontWeight: 500 } }, k.label),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#1e293b', margin: '4px 0' } }, k.value),
          React.createElement('p', { style: { fontSize: '12px', color: '#94a3b8' } }, k.sub)
        );
      })
    );
  };

  // ===== SECTION: DEMANDA PROYECTADA =====
  var renderDemanda = function() {
    return React.createElement('div', null,
      // Search and sort bar
      React.createElement('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' } },
        React.createElement('input', {
          type: 'text', placeholder: 'Buscar SKU, descripci\u00f3n o marca...',
          value: busqueda, onChange: function(e) { setBusqueda(e.target.value); },
          style: { flex: 1, minWidth: '200px', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', outline: 'none', backgroundColor: '#ffffff' }
        }),
        React.createElement('select', {
          value: ordenSku, onChange: function(e) { setOrdenSku(e.target.value); },
          style: { padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '14px', backgroundColor: '#ffffff', cursor: 'pointer' }
        },
          React.createElement('option', { value: 'riesgo' }, 'Ordenar: Mayor riesgo'),
          React.createElement('option', { value: 'demanda' }, 'Ordenar: Mayor demanda'),
          React.createElement('option', { value: 'cobertura' }, 'Ordenar: Menor cobertura'),
          React.createElement('option', { value: 'sugerido' }, 'Ordenar: Mayor sugerido')
        )
      ),
      // SKU cards
      React.createElement('div', { style: { display: 'grid', gap: '12px' } },
        filteredData.slice(0, 50).map(function(d, i) {
          return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.06)', border: '1px solid #f1f5f9' } },
            React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' } },
              React.createElement('div', null,
                React.createElement('span', { style: { fontSize: '14px', fontWeight: 700, color: '#1e293b' } }, d.sku),
                React.createElement('span', { style: { fontSize: '12px', color: '#64748b', marginLeft: '8px' } }, d.marca),
                React.createElement('p', { style: { fontSize: '12px', color: '#94a3b8', marginTop: '2px', maxWidth: '400px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, d.descripcion)
              ),
              riskBadge(d.riesgo)
            ),
            // Mini projection bars
            React.createElement('div', { style: { display: 'flex', gap: '6px', alignItems: 'flex-end', height: '40px', marginBottom: '8px' } },
              d.proyeccion.map(function(p, j) {
                var maxD = Math.max.apply(null, d.proyeccion.map(function(x) { return x.demanda; }));
                var h = maxD > 0 ? (p.demanda / maxD) * 36 + 4 : 4;
                return React.createElement('div', { key: j, style: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 } },
                  React.createElement('div', { style: { width: '100%', height: h + 'px', backgroundColor: '#c7d2fe', borderRadius: '3px' } }),
                  React.createElement('span', { style: { fontSize: '9px', color: '#94a3b8', marginTop: '2px' } }, meses[p.mes])
                );
              })
            ),
            React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px' } },
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Demanda/mes: '),
                React.createElement('span', { style: { fontWeight: 600, color: '#1e293b' } }, fmtN(d.demandaMensual))
              ),
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Stock: '),
                React.createElement('span', { style: { fontWeight: 600, color: '#1e293b' } }, fmtN(d.stockActual))
              ),
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Tr\u00e1nsito: '),
                React.createElement('span', { style: { fontWeight: 600, color: '#1e293b' } }, fmtN(d.enTransito))
              ),
              React.createElement('div', { style: { backgroundColor: '#f1f5f9', padding: '6px 8px', borderRadius: '8px' } },
                React.createElement('span', { style: { color: '#64748b' } }, 'Tendencia: '),
                React.createElement('span', { style: { fontWeight: 600, color: d.tendencia > 0 ? '#16a34a' : d.tendencia < 0 ? '#dc2626' : '#64748b' } },
                  d.tendencia > 0 ? '\u2191' : d.tendencia < 0 ? '\u2193' : '\u2194')
              )
            )
          );
        })
      ),
      filteredData.length > 50 ? React.createElement('p', { style: { textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '12px' } },
        'Mostrando 50 de ' + filteredData.length + ' SKUs. Usa el buscador para filtrar.') : null
    );
  };

  // ===== SECTION: COBERTURA =====
  var renderCobertura = function() {
    var sorted = filteredData.slice().sort(function(a, b) { return a.coberturaSemanas - b.coberturaSemanas; });
    return React.createElement('div', null,
      // Legend
      React.createElement('div', { style: { display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', padding: '12px', backgroundColor: '#f8fafc', borderRadius: '12px' } },
        [{ color: '#dc2626', label: 'Cr\u00edtico (<2 sem)' }, { color: '#d97706', label: 'Bajo (2-4 sem)' },
         { color: '#16a34a', label: 'Saludable (4-12 sem)' }, { color: '#2563eb', label: 'Sobrestock (>12 sem)' }].map(function(l, i) {
          return React.createElement('div', { key: i, style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('div', { style: { width: '12px', height: '12px', borderRadius: '50%', backgroundColor: l.color } }),
            React.createElement('span', { style: { fontSize: '12px', color: '#64748b' } }, l.label)
          );
        })
      ),
      // Coverage list
      React.createElement('div', { style: { display: 'grid', gap: '8px' } },
        sorted.slice(0, 60).map(function(d, i) {
          return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '10px', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' } },
            React.createElement('div', { style: { minWidth: '140px' } },
              React.createElement('span', { style: { fontSize: '13px', fontWeight: 600, color: '#1e293b' } }, d.sku),
              React.createElement('p', { style: { fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '140px' } }, d.marca)
            ),
            React.createElement('div', { style: { flex: 1 } }, semaphoreBar(d.coberturaSemanas)),
            React.createElement('div', { style: { minWidth: '100px', textAlign: 'right', fontSize: '12px' } },
              React.createElement('span', { style: { color: '#64748b' } }, fmtN(d.stockTotal) + ' pzas'),
              React.createElement('span', { style: { color: '#94a3b8', marginLeft: '4px' } }, '/ ' + fmtN(d.demandaMensual) + ' dem')
            )
          );
        })
      )
    );
  };

  // ===== SECTION: SUGERIDO DE COMPRA =====
  var renderSugerido = function() {
    var need = filteredData.filter(function(d) { return d.sugerido > 0; }).sort(function(a, b) { return b.valorSugerido - a.valorSugerido; });
    var totalPzas = need.reduce(function(s, d) { return s + d.sugerido; }, 0);
    var totalVal = need.reduce(function(s, d) { return s + d.valorSugerido; }, 0);

    return React.createElement('div', null,
      // Summary banner
      React.createElement('div', { style: { backgroundColor: '#f5f3ff', borderRadius: '16px', padding: '20px', marginBottom: '16px', border: '1px solid #e9d5ff', display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '12px' } },
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '13px', color: '#7c3aed' } }, 'SKUs por comprar'),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#5b21b6' } }, need.length)
        ),
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '13px', color: '#7c3aed' } }, 'Total piezas'),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#5b21b6' } }, fmtN(totalPzas))
        ),
        React.createElement('div', { style: { textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '13px', color: '#7c3aed' } }, 'Inversi\u00f3n estimada'),
          React.createElement('p', { style: { fontSize: '28px', fontWeight: 700, color: '#5b21b6' } }, fmt(totalVal))
        )
      ),
      // Table
      React.createElement('div', { style: { backgroundColor: '#ffffff', borderRadius: '12px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.08)' } },
        React.createElement('table', { style: { width: '100%', borderCollapse: 'collapse', fontSize: '13px' } },
          React.createElement('thead', null,
            React.createElement('tr', { style: { backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0' } },
              ['SKU', 'Marca', 'Demanda/mes', 'Stock', 'Tr\u00e1nsito', 'Cobertura', 'Sugerido', 'Valor'].map(function(h, i) {
                return React.createElement('th', { key: i, style: { padding: '10px 12px', textAlign: i > 1 ? 'right' : 'left', color: '#64748b', fontWeight: 600 } }, h);
              })
            )
          ),
          React.createElement('tbody', null,
            need.slice(0, 50).map(function(d, i) {
              return React.createElement('tr', { key: i, style: { borderBottom: '1px solid #f1f5f9' } },
                React.createElement('td', { style: { padding: '10px 12px', fontWeight: 600, color: '#1e293b' } }, d.sku),
                React.createElement('td', { style: { padding: '10px 12px', color: '#64748b' } }, d.marca),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#1e293b' } }, fmtN(d.demandaMensual)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#1e293b' } }, fmtN(d.stockActual)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#f59e0b' } }, fmtN(d.enTransito)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right' } }, riskBadge(d.riesgo)),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: '#7c3aed' } }, fmtN(d.sugerido) + ' pzas'),
                React.createElement('td', { style: { padding: '10px 12px', textAlign: 'right', color: '#5b21b6' } }, fmt(d.valorSugerido))
              );
            })
          )
        )
      )
    );
  };

  // ===== SECTION: TEMPORALIDAD =====
  var renderTemporalidad = function() {
    // Ventas mensuales aggregated
    var monthlyData = [];
    for (var m = 1; m <= 12; m++) {
      var vRow = ventas.find(function(v) { return parseInt(v.mes) === m; });
      var si = vRow ? (parseFloat(vRow.sell_in) || 0) : 0;
      var so = vRow ? (parseFloat(vRow.sell_out) || 0) : 0;
      var idx = seasonality[m] || 1;
      monthlyData.push({ mes: m, label: meses[m], si: si, so: so, index: idx });
    }
    var maxVal = Math.max.apply(null, monthlyData.map(function(d) { return Math.max(d.si, d.so); }).concat([1]));

    return React.createElement('div', null,
      // Seasonality chart
      React.createElement('div', { style: { backgroundColor: '#ffffff', borderRadius: '16px', padding: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', marginBottom: '16px' } },
        React.createElement('h3', { style: { fontSize: '16px', fontWeight: 700, color: '#1e293b', marginBottom: '16px' } }, '\uD83D\uDCC5 Patr\u00f3n de Estacionalidad'),
        React.createElement('div', { style: { display: 'flex', gap: '4px', alignItems: 'flex-end', height: '160px', padding: '0 8px' } },
          monthlyData.map(function(d, i) {
            var barH = maxVal > 0 ? (d.si / maxVal) * 140 : 0;
            var barHso = maxVal > 0 ? (d.so / maxVal) * 140 : 0;
            var isFuture = d.mes > currentMonth;
            return React.createElement('div', { key: i, style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' } },
              React.createElement('div', { style: { display: 'flex', gap: '2px', alignItems: 'flex-end', height: '140px' } },
                React.createElement('div', { style: { width: '14px', height: Math.max(barH, 2) + 'px', backgroundColor: isFuture ? '#bfdbfe' : '#3b82f6', borderRadius: '3px 3px 0 0', opacity: isFuture ? 0.5 : 1 } }),
                React.createElement('div', { style: { width: '14px', height: Math.max(barHso, 2) + 'px', backgroundColor: isFuture ? '#bbf7d0' : '#10b981', borderRadius: '3px 3px 0 0', opacity: isFuture ? 0.5 : 1 } })
              ),
              React.createElement('span', { style: { fontSize: '10px', color: '#64748b', marginTop: '4px' } }, d.label),
              React.createElement('span', { style: { fontSize: '9px', color: d.index > 1.15 ? '#dc2626' : d.index < 0.85 ? '#2563eb' : '#94a3b8', fontWeight: d.index > 1.15 || d.index < 0.85 ? 600 : 400 } },
                (d.index * 100).toFixed(0) + '%')
            );
          })
        ),
        // Legend
        React.createElement('div', { style: { display: 'flex', gap: '16px', justifyContent: 'center', marginTop: '12px' } },
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('div', { style: { width: '12px', height: '12px', backgroundColor: '#3b82f6', borderRadius: '2px' } }),
            React.createElement('span', { style: { fontSize: '12px', color: '#64748b' } }, 'Sell In')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('div', { style: { width: '12px', height: '12px', backgroundColor: '#10b981', borderRadius: '2px' } }),
            React.createElement('span', { style: { fontSize: '12px', color: '#64748b' } }, 'Sell Out')
          ),
          React.createElement('div', { style: { display: 'flex', alignItems: 'center', gap: '6px' } },
            React.createElement('span', { style: { fontSize: '12px', color: '#94a3b8' } }, '\u00cdndice < 100% = mes bajo | > 100% = mes alto')
          )
        )
      ),
      // Insight cards
      React.createElement('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '12px' } },
        React.createElement('div', { style: { backgroundColor: '#fff7ed', borderRadius: '12px', padding: '16px', border: '1px solid #fed7aa' } },
          React.createElement('p', { style: { fontWeight: 700, color: '#c2410c', fontSize: '14px', marginBottom: '4px' } }, '\uD83D\uDD25 Meses Pico'),
          React.createElement('p', { style: { fontSize: '13px', color: '#9a3412' } },
            monthlyData.filter(function(d) { return d.index > 1.15; }).map(function(d) { return d.label + ' (' + (d.index * 100).toFixed(0) + '%)'; }).join(', ') || 'Sin datos suficientes')
        ),
        React.createElement('div', { style: { backgroundColor: '#eff6ff', borderRadius: '12px', padding: '16px', border: '1px solid #bfdbfe' } },
          React.createElement('p', { style: { fontWeight: 700, color: '#1d4ed8', fontSize: '14px', marginBottom: '4px' } }, '\u2744\uFE0F Meses Valle'),
          React.createElement('p', { style: { fontSize: '13px', color: '#1e40af' } },
            monthlyData.filter(function(d) { return d.index < 0.85 && d.si > 0; }).map(function(d) { return d.label + ' (' + (d.index * 100).toFixed(0) + '%)'; }).join(', ') || 'Sin datos suficientes')
        ),
        React.createElement('div', { style: { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '16px', border: '1px solid #bbf7d0' } },
          React.createElement('p', { style: { fontWeight: 700, color: '#15803d', fontSize: '14px', marginBottom: '4px' } }, '\uD83D\uDCCA Ratio SI/SO Promedio'),
          React.createElement('p', { style: { fontSize: '13px', color: '#166534' } },
            (function() {
              var totalSI = monthlyData.reduce(function(s, d) { return s + d.si; }, 0);
              var totalSO = monthlyData.reduce(function(s, d) { return s + d.so; }, 0);
              var ratio = totalSO > 0 ? (totalSI / totalSO).toFixed(2) : 'N/A';
              return 'Ratio: ' + ratio + 'x' + (ratio > 1.5 ? ' \u2014 Posible sobreabastecimiento' : ratio < 0.8 ? ' \u2014 Demanda supera oferta' : ' \u2014 Balance saludable');
            })()
          )
        )
      )
    );
  };

  // ===== SECTION: ALERTAS =====
  var renderAlertas = function() {
    var alertas = [];

    // Critical stockout
    forecastData.filter(function(d) { return d.riesgo === 'critico'; }).forEach(function(d) {
      alertas.push({ tipo: 'critico', icon: '\uD83D\uDEA8', titulo: 'Riesgo de desabasto: ' + d.sku, desc: d.descripcion + ' \u2014 Cobertura: ' + d.coberturaSemanas.toFixed(1) + ' semanas. Stock: ' + d.stockActual + ' pzas, demanda: ' + d.demandaMensual + ' pzas/mes', accion: 'Compra urgente: ' + d.sugerido + ' pzas (' + fmt(d.valorSugerido) + ')' });
    });

    // Low stock
    forecastData.filter(function(d) { return d.riesgo === 'bajo'; }).forEach(function(d) {
      alertas.push({ tipo: 'bajo', icon: '\u26A0\uFE0F', titulo: 'Stock bajo: ' + d.sku, desc: 'Cobertura: ' + d.coberturaSemanas.toFixed(1) + ' semanas. Se agota en ~' + Math.round(d.coberturaSemanas / 4.33) + ' meses.', accion: 'Sugerido: ' + d.sugerido + ' pzas' });
    });

    // Overstock
    forecastData.filter(function(d) { return d.riesgo === 'sobrestock'; }).slice(0, 10).forEach(function(d) {
      var mesesStock = d.demandaMensual > 0 ? Math.round(d.stockTotal / d.demandaMensual) : 999;
      alertas.push({ tipo: 'sobrestock', icon: '\uD83D\uDCE6', titulo: 'Sobrestock: ' + d.sku, desc: d.stockTotal + ' pzas = ' + mesesStock + ' meses de inventario. Capital inmovilizado: ' + fmt(d.stockTotal * d.costoUnitario), accion: 'Evaluar promoci\u00f3n o redistribuci\u00f3n' });
    });

    // Dead inventory (stock > 0, demanda = 0)
    forecastData.filter(function(d) { return d.stockActual > 0 && d.demandaMensual === 0; }).slice(0, 5).forEach(function(d) {
      alertas.push({ tipo: 'muerto', icon: '\uD83D\uDC80', titulo: 'Inventario muerto: ' + d.sku, desc: d.stockActual + ' pzas sin demanda. Valor: ' + fmt(d.stockActual * d.costoUnitario), accion: 'Liquidar o regresar a proveedor' });
    });

    var colorMap = { critico: { bg: '#fef2f2', border: '#fecaca', text: '#991b1b' }, bajo: { bg: '#fffbeb', border: '#fde68a', text: '#92400e' }, sobrestock: { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' }, muerto: { bg: '#f8fafc', border: '#e2e8f0', text: '#334155' } };

    return React.createElement('div', null,
      // Summary
      React.createElement('div', { style: { display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' } },
        [{ label: 'Cr\u00edticos', count: criticos, color: '#dc2626' },
         { label: 'Stock Bajo', count: bajos, color: '#d97706' },
         { label: 'Sobrestock', count: sobrestock, color: '#2563eb' },
         { label: 'Inv. Muerto', count: forecastData.filter(function(d) { return d.stockActual > 0 && d.demandaMensual === 0; }).length, color: '#64748b' }
        ].map(function(s, i) {
          return React.createElement('div', { key: i, style: { backgroundColor: '#ffffff', borderRadius: '12px', padding: '12px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)', textAlign: 'center', minWidth: '120px', borderTop: '3px solid ' + s.color } },
            React.createElement('p', { style: { fontSize: '24px', fontWeight: 700, color: s.color } }, s.count),
            React.createElement('p', { style: { fontSize: '12px', color: '#64748b' } }, s.label)
          );
        })
      ),
      // Alert list
      alertas.length === 0 ?
        React.createElement('div', { style: { backgroundColor: '#f0fdf4', borderRadius: '12px', padding: '24px', textAlign: 'center' } },
          React.createElement('p', { style: { fontSize: '32px' } }, '\u2705'),
          React.createElement('p', { style: { fontSize: '16px', fontWeight: 600, color: '#16a34a' } }, 'Sin alertas activas'),
          React.createElement('p', { style: { fontSize: '13px', color: '#4ade80' } }, 'Todos los SKUs tienen cobertura saludable')
        ) :
        React.createElement('div', { style: { display: 'grid', gap: '10px' } },
          alertas.slice(0, 30).map(function(a, i) {
            var c = colorMap[a.tipo] || colorMap.bajo;
            return React.createElement('div', { key: i, style: { backgroundColor: c.bg, borderRadius: '10px', padding: '14px 16px', border: '1px solid ' + c.border } },
              React.createElement('div', { style: { display: 'flex', alignItems: 'flex-start', gap: '10px' } },
                React.createElement('span', { style: { fontSize: '20px' } }, a.icon),
                React.createElement('div', { style: { flex: 1 } },
                  React.createElement('p', { style: { fontWeight: 700, color: c.text, fontSize: '14px' } }, a.titulo),
                  React.createElement('p', { style: { fontSize: '12px', color: c.text, opacity: 0.8, marginTop: '2px' } }, a.desc),
                  React.createElement('p', { style: { fontSize: '12px', fontWeight: 600, color: c.text, marginTop: '6px', backgroundColor: 'rgba(255,255,255,0.5)', display: 'inline-block', padding: '2px 8px', borderRadius: '6px' } }, '\u2192 ' + a.accion)
                )
              )
            );
          })
        )
    );
  };

  // ===== MAIN RENDER =====
  var renderMap = {
    resumen: renderResumen,
    demanda: renderDemanda,
    cobertura: renderCobertura,
    sugerido: renderSugerido,
    temporalidad: renderTemporalidad,
    alertas: renderAlertas
  };

  return React.createElement('div', { style: { minHeight: '100vh', backgroundColor: '#f8fafc', padding: '24px' } },
    // Header
    React.createElement('div', { style: { backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', marginBottom: '20px', boxShadow: '0 1px 3px rgba(0,0,0,0.08)', borderTop: '4px solid #6366f1' } },
      React.createElement('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' } },
        React.createElement('div', null,
          React.createElement('h2', { style: { fontSize: '24px', fontWeight: 700, color: '#1e293b', margin: 0 } }, '\uD83D\uDD2E Forecast \u2014 ' + cliente),
          React.createElement('p', { style: { fontSize: '14px', color: '#64748b', marginTop: '4px' } }, 'Proyecci\u00f3n de demanda, cobertura de inventario y sugeridos de compra')
        ),
        React.createElement('div', { style: { display: 'flex', gap: '8px', alignItems: 'center' } },
          React.createElement('span', { style: { fontSize: '12px', color: '#94a3b8' } }, 'Actualizado: ' + new Date().toLocaleDateString('es-MX')),
          React.createElement('span', { style: { fontSize: '12px', padding: '4px 10px', backgroundColor: '#f0fdf4', color: '#16a34a', borderRadius: '8px', fontWeight: 500 } }, allSkus.length + ' SKUs')
        )
      )
    ),
    // Section tabs
    React.createElement('div', { style: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' } },
      secciones.map(function(s) {
        var isActive = seccionActiva === s.key;
        return React.createElement('button', {
          key: s.key,
          onClick: function() { setSeccionActiva(s.key); },
          style: { padding: '10px 18px', borderRadius: '12px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: isActive ? 700 : 500,
                   backgroundColor: isActive ? '#6366f1' : '#ffffff', color: isActive ? '#ffffff' : '#64748b',
                   boxShadow: isActive ? '0 2px 8px rgba(99,102,241,0.3)' : '0 1px 2px rgba(0,0,0,0.05)', transition: 'all 0.2s' }
        }, s.icon + ' ' + s.label);
      })
    ),
    // Active section content
    React.createElement('div', null, renderMap[seccionActiva] ? renderMap[seccionActiva]() : null)
  );
}
// ==================== FIN FORECAST CLIENTE ====================
// ── PanelActualizacion ── Central update panel (slide-over)

