// Cobranza general · cálculo puro (2026-10-04). Entrada: cortes de estados_cuenta de los clientes propios, detalle del
// último corte de cada uno, configuración de crédito. Sin React ni red (pruebas en scripts/test-cobranza-calculo.mjs).
//   · por cliente: último corte, saldo, vencido, % vencido, aging por tramo (días de atraso al corte), DSO real
//     (edad ponderada por saldo), uso de la línea de crédito, por vencer en 7 y 30 días, Δ vs corte anterior.
//   · consolidado: sumas, DSO ponderado por saldo, serie de los últimos 12 cortes (saldo, vencido) alineada por fecha.
//   · facturas vencidas de todos los clientes ordenadas por días de atraso.
const N = (v) => Number(v) || 0;
const DIA = 86400000;
export const TRAMOS = [
  { id: 'd0_30', label: '1–30 días', min: 1, max: 30, tone: 'yellow' },
  { id: 'd31_60', label: '31–60 días', min: 31, max: 60, tone: 'orange' },
  { id: 'd61_90', label: '61–90 días', min: 61, max: 90, tone: 'red' },
  { id: 'mas90', label: '+90 días', min: 91, max: Infinity, tone: 'red' },
];
export const CLIENTES = ['digitalife', 'pcel', 'dicotech'];
export const NOMBRE = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech' };
const ms = (iso) => (iso ? new Date(String(iso).slice(0, 10) + 'T00:00:00').getTime() : null);
export const tramoDe = (d) => (d <= 0 ? null : TRAMOS.find((t) => d >= t.min && d <= t.max)?.id || 'mas90');

export function diasAtraso(f, refMs) { const v = ms(f.vencimiento); return v == null ? 0 : Math.max(0, Math.floor((refMs - v) / DIA)); }
export function dsoDe(rows, refMs) {
  let num = 0, den = 0;
  for (const f of rows) { const e = ms(f.fecha_emision); if (e == null) continue; const s = N(f.saldo_actual); const d = Math.floor((refMs - e) / DIA); if (d < 0 || s <= 0) continue; num += s * d; den += s; }
  return den > 0 ? Math.round(num / den) : null;
}

/** Un cliente: cortes (más nuevo primero), facturas del último corte, config de crédito. */
export function resumirCliente(key, cortes, detalle, config, tcDefault = 17) {
  const c = cortes[0] || null, prev = cortes[1] || null;
  if (!c) return { key, nombre: NOMBRE[key] || key, sinDatos: true, saldo: 0, vencido: 0, aging: Object.fromEntries(TRAMOS.map((t) => [t.id, { monto: 0, n: 0 }])), facturas: [], serie: [] };
  const ref = ms(c.fecha_corte);
  const conSaldo = (detalle || []).filter((f) => N(f.saldo_actual) > 0);
  const aging = Object.fromEntries(TRAMOS.map((t) => [t.id, { monto: 0, n: 0, maxDias: 0 }]));
  const facturas = conSaldo.map((f) => ({ ...f, cliente: key, dias: diasAtraso(f, ref), paraVencer: ms(f.vencimiento) != null ? Math.floor((ms(f.vencimiento) - ref) / DIA) : null, saldo: N(f.saldo_actual) }));
  for (const f of facturas) { const id = tramoDe(f.dias); if (!id) continue; aging[id].monto += f.saldo; aging[id].n += 1; aging[id].maxDias = Math.max(aging[id].maxDias, f.dias); }
  const vencidoDet = TRAMOS.reduce((s, t) => s + aging[t.id].monto, 0);
  const saldo = N(c.saldo_actual), vencido = N(c.saldo_vencido) || vencidoDet;
  const tc = N(c.tipo_cambio) || tcDefault;
  const lineaMxn = N(config?.linea_credito_mxn_pagare) || (N(config?.linea_credito_usd) || N(c.linea_credito_usd)) * tc;
  const porVencer = (dias) => facturas.filter((f) => f.paraVencer != null && f.paraVencer >= 0 && f.paraVencer <= dias).reduce((s, f) => s + f.saldo, 0);
  const dsoReal = dsoDe(conSaldo, ref);
  return {
    key, nombre: NOMBRE[key] || key, sinDatos: false, corte: c.fecha_corte, corteId: c.id, saldo, vencido, pctVencido: saldo > 0 ? (vencido / saldo) * 100 : (vencido > 0 ? 100 : 0),
    aging, facturas: facturas.sort((a, b) => b.dias - a.dias || b.saldo - a.saldo), nFacturas: facturas.length, nVencidas: facturas.filter((f) => f.dias > 0).length,
    dso: dsoReal ?? (c.dso != null ? N(c.dso) : null), dsoErp: c.dso != null ? N(c.dso) : null, plazo: N(config?.plazo_dias_credito) || 90,
    lineaMxn: lineaMxn || null, usoLinea: lineaMxn ? (saldo / lineaMxn) * 100 : null, disponibleLinea: lineaMxn ? lineaMxn - saldo : null,
    porVencer7: porVencer(7), porVencer30: porVencer(30),
    dSaldo: prev ? saldo - N(prev.saldo_actual) : null, dVencido: prev ? vencido - N(prev.saldo_vencido) : null,
    serie: [...cortes].reverse().slice(-12).map((x) => ({ fecha: x.fecha_corte, saldo: N(x.saldo_actual), vencido: N(x.saldo_vencido) })),
  };
}

/** Consolidado de los tres. */
export function consolidar(clientes) {
  const con = clientes.filter((c) => !c.sinDatos);
  const saldo = con.reduce((s, c) => s + c.saldo, 0), vencido = con.reduce((s, c) => s + c.vencido, 0);
  const aging = Object.fromEntries(TRAMOS.map((t) => [t.id, { monto: con.reduce((s, c) => s + c.aging[t.id].monto, 0), n: con.reduce((s, c) => s + c.aging[t.id].n, 0) }]));
  const dsoNum = con.reduce((s, c) => s + (c.dso != null ? c.dso * c.saldo : 0), 0), dsoDen = con.reduce((s, c) => s + (c.dso != null ? c.saldo : 0), 0);
  const corte = con.reduce((m, c) => (c.corte > m ? c.corte : m), '') || null;
  // Serie consolidada por fecha de corte (los tres clientes cortan la misma semana).
  const porFecha = new Map();
  for (const c of con) for (const p of c.serie) { const o = porFecha.get(p.fecha) || { fecha: p.fecha, saldo: 0, vencido: 0, n: 0 }; o.saldo += p.saldo; o.vencido += p.vencido; o.n += 1; porFecha.set(p.fecha, o); }
  const serie = [...porFecha.values()].sort((a, b) => a.fecha.localeCompare(b.fecha)).filter((p) => p.n === con.length).slice(-12);
  const vencidas = con.flatMap((c) => c.facturas.filter((f) => f.dias > 0)).sort((a, b) => b.dias - a.dias || b.saldo - a.saldo);
  const porVencer = con.flatMap((c) => c.facturas.filter((f) => f.paraVencer != null && f.paraVencer >= 0 && f.paraVencer <= 30)).sort((a, b) => a.paraVencer - b.paraVencer);
  const peor = con.filter((c) => c.vencido > 0).sort((a, b) => b.vencido - a.vencido)[0] || null;
  return { saldo, vencido, pctVencido: saldo > 0 ? (vencido / saldo) * 100 : 0, aging, dso: dsoDen > 0 ? Math.round(dsoNum / dsoDen) : null, corte, serie, vencidas, porVencer,
    porVencer7: con.reduce((s, c) => s + c.porVencer7, 0), porVencer30: con.reduce((s, c) => s + c.porVencer30, 0), nVencidas: vencidas.length, peor,
    dSaldo: con.every((c) => c.dSaldo != null) ? con.reduce((s, c) => s + c.dSaldo, 0) : null, dVencido: con.every((c) => c.dVencido != null) ? con.reduce((s, c) => s + c.dVencido, 0) : null };
}

/** Frase del hero. */
export function fraseCobranza(t, fmt) {
  if (!t.corte) return 'Sin estados de cuenta cargados.';
  const partes = [];
  partes.push(t.vencido > 0 ? `${fmt(t.vencido)} vencidos (${Math.round(t.pctVencido)} % de ${fmt(t.saldo)})` : `cartera de ${fmt(t.saldo)} sin vencidos`);
  if (t.peor) partes.push(`${t.peor.nombre} concentra ${fmt(t.peor.vencido)}`);
  if (t.dso != null) partes.push(`DSO ${t.dso} d`);
  if (t.porVencer7 > 0) partes.push(`${fmt(t.porVencer7)} vencen en 7 días`);
  const s = partes.join(' · ');
  return s.charAt(0).toUpperCase() + s.slice(1) + '.';
}
