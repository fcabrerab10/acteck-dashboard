// Resumen de Clientes · cálculo puro (sin React). Todo respeta el periodo elegido { anio, mes }.
//   calcularResumen(clienteKey, data, periodo)  → medidas de un cliente en ese mes
//   calcularConsolidado / calcularShareEmpresa   → los 3 juntos y share vs empresa
//   calcularTendencia(data, filtro, periodo)     → 12 meses del año del periodo (sell in · cuotas · año anterior)
//   estatusCliente(resumen)                      → 'bad' | 'warn' | 'neutral' | 'good'
import { PCEL_REAL } from '../../../lib/constants';

export const CLIENTES = [
  { key: 'digitalife', nombre: 'Digitalife', marca: 'Acteck · Balam Rush', letter: 'D' },
  { key: 'pcel',       nombre: 'PCEL',       marca: 'Acteck',              letter: 'P' },
  { key: 'dicotech',   nombre: 'Dicotech',   marca: 'Acteck · Balam Rush', letter: 'Di' },
];
export const CLIENTE_KEYS = CLIENTES.map((c) => c.key);
export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

const N = (v) => Number(v) || 0;
export const hoy = new Date();
export const anioActual = hoy.getFullYear();
export const mesActual = hoy.getMonth() + 1;

// ── Periodo ──
export const periodoId = (p) => `${p.anio}-${String(p.mes).padStart(2, '0')}`;
export const esPeriodoActual = (p) => p.anio === anioActual && p.mes === mesActual;
export const diasDelMes = (p) => new Date(p.anio, p.mes, 0).getDate();
export const finDeMes = (p) => new Date(p.anio, p.mes, 0, 23, 59, 59);
export const mesAnterior = (p) => (p.mes === 1 ? { anio: p.anio - 1, mes: 12 } : { anio: p.anio, mes: p.mes - 1 });
export const labelPeriodo = (p) => `${MESES_CORTO[p.mes - 1]} ${p.anio}`;

/** Últimos 12 meses (el actual primero). */
export function opcionesPeriodo(n = 12) {
  const out = [];
  let a = anioActual, m = mesActual;
  for (let i = 0; i < n; i++) {
    out.push({ anio: a, mes: m });
    m -= 1; if (m === 0) { m = 12; a -= 1; }
  }
  return out;
}

/** Lunes de la semana ISO (para comparar snapshots semanales contra el fin de mes). */
export function lunesSemanaISO(anio, semana) {
  const jan4 = new Date(anio, 0, 4);
  const dia = jan4.getDay() || 7;
  const lunes1 = new Date(jan4);
  lunes1.setDate(jan4.getDate() - (dia - 1));
  const d = new Date(lunes1);
  d.setDate(lunes1.getDate() + (N(semana) - 1) * 7);
  return d;
}

/** Última semana (anio, semana) cuyo lunes cae ≤ fin del periodo. */
function ultimaSemanaHasta(rows, periodo) {
  const fin = finDeMes(periodo).getTime();
  let best = null;
  const vistos = new Set();
  for (const r of rows) {
    if (r.anio == null || r.semana == null) continue;
    const k = `${r.anio}-${r.semana}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    const t = lunesSemanaISO(N(r.anio), N(r.semana)).getTime();
    if (t > fin) continue;
    if (!best || t > best.t) best = { t, anio: N(r.anio), semana: N(r.semana) };
  }
  return best;
}

// ── Cuotas ──
/** { min, ideal } del cliente en el periodo; PCEL cae a PCEL_REAL si no hay filas en BD para ese año. */
export function cuotasDe(cuotas, clienteKey, anio, mes) {
  const rowsAnio = cuotas.filter((r) => r.cliente === clienteKey && N(r.anio) === anio);
  const r = rowsAnio.find((x) => N(x.mes) === mes);
  if (r) {
    const min = N(r.cuota_min) || null, ideal = N(r.cuota_ideal) || null;
    return { min: min ?? ideal, ideal: ideal ?? min };
  }
  if (clienteKey === 'pcel' && rowsAnio.length === 0 && anio === anioActual && PCEL_REAL?.cuota50M) {
    return { min: N(PCEL_REAL.cuota45M?.[mes]) || null, ideal: N(PCEL_REAL.cuota50M[mes]) || null };
  }
  return { min: null, ideal: null };
}
/** ¿Las dos cuotas son distintas (se muestran ambas)? */
export const dosCuotas = (c) => c.min != null && c.ideal != null && Math.abs(c.ideal - c.min) > 1;

const pctDe = (v, base) => (base > 0 ? (v / base) * 100 : null);

// ── Cálculo por cliente ──
export function calcularResumen(clienteKey, data, periodo) {
  const { anio, mes } = periodo;
  const prev = mesAnterior(periodo);
  const va = data.ventasMes.filter((r) => r.cliente_key === clienteKey);
  const montoEn = (a, m) => va.filter((r) => N(r.anio) === a && N(r.mes) === m).reduce((s, r) => s + N(r.monto), 0);

  const siMes = montoEn(anio, mes);
  const siMesPrev = montoEn(prev.anio, prev.mes);
  const siMesAnt = montoEn(anio - 1, mes);
  const siYTD = va.filter((r) => N(r.anio) === anio && N(r.mes) <= mes).reduce((s, r) => s + N(r.monto), 0);
  const siYTDAnt = va.filter((r) => N(r.anio) === anio - 1 && N(r.mes) <= mes).reduce((s, r) => s + N(r.monto), 0);
  const siMoM = siMesPrev > 0 ? ((siMes - siMesPrev) / siMesPrev) * 100 : null;
  const siYoY = siMesAnt > 0 ? ((siMes - siMesAnt) / siMesAnt) * 100 : null;

  // Cuotas del mes y acumuladas (mínima e ideal)
  const cuota = cuotasDe(data.cuotas, clienteKey, anio, mes);
  let cuotaYTDMin = 0, cuotaYTDIdeal = 0, cuotaAnualIdeal = 0;
  for (let m = 1; m <= 12; m++) {
    const c = cuotasDe(data.cuotas, clienteKey, anio, m);
    cuotaAnualIdeal += N(c.ideal);
    if (m <= mes) { cuotaYTDMin += N(c.min); cuotaYTDIdeal += N(c.ideal); }
  }
  const cumplMin = pctDe(siMes, N(cuota.min));
  const cumplIdeal = pctDe(siMes, N(cuota.ideal));
  const cumplYTDMin = pctDe(siYTD, cuotaYTDMin);
  const cumplYTDIdeal = pctDe(siYTD, cuotaYTDIdeal);

  // Costo promedio por SKU (facturación de los 3 clientes, año del periodo y anterior)
  const costoPromedioSku = {};
  {
    const agg = new Map();
    for (const r of data.facturacion) {
      if (r.cliente_key !== clienteKey) continue;
      const sku = String(r.sku || ''); if (!sku) continue;
      const cur = agg.get(sku) || { p: 0, m: 0 };
      cur.p += N(r.piezas); cur.m += N(r.monto); agg.set(sku, cur);
    }
    agg.forEach((v, k) => { if (v.p > 0 && v.m > 0) costoPromedioSku[k] = v.m / v.p; });
  }

  // Top SKUs del mes (para el texto de avance)
  const topSkus = (() => {
    const m = new Map();
    for (const r of data.facturacion) {
      if (r.cliente_key !== clienteKey || N(r.anio) !== anio || N(r.mes) !== mes) continue;
      const sku = String(r.sku || ''); if (!sku) continue;
      m.set(sku, (m.get(sku) || 0) + N(r.piezas));
    }
    return [...m.entries()].filter(([, p]) => p > 0).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sku, piezas]) => ({ sku, piezas }));
  })();

  // Inventario al corte ≤ fin de mes
  let inventarioValor = 0, inventarioPiezas = 0, inventarioSemana = null, costoInvPorSku = {};
  if (clienteKey === 'pcel') {
    const sem = ultimaSemanaHasta(data.selloutPcel, periodo);
    if (sem) {
      const vistos = new Set();
      for (const r of data.selloutPcel) {
        if (N(r.anio) !== sem.anio || N(r.semana) !== sem.semana) continue;
        const sku = String(r.sku || ''); if (!sku || vistos.has(sku)) continue;
        vistos.add(sku);
        const stock = N(r.inventario), costo = N(r.costo_promedio);
        if (costo > 0) costoInvPorSku[sku] = costo;
        inventarioPiezas += stock;
        inventarioValor += stock * (costo || costoPromedioSku[sku] || 0);
      }
      inventarioSemana = `${sem.anio}-${String(sem.semana).padStart(2, '0')}`;
    }
  } else {
    const inv = data.inventarioCliente.filter((r) => r.cliente === clienteKey);
    const sem = ultimaSemanaHasta(inv, periodo);
    if (sem) {
      for (const r of inv) {
        if (N(r.anio) !== sem.anio || N(r.semana) !== sem.semana) continue;
        const sku = String(r.sku || '');
        const stock = N(r.stock);
        const cp = costoPromedioSku[sku];
        inventarioPiezas += stock;
        inventarioValor += cp != null ? stock * cp : (N(r.valor) > 0 ? N(r.valor) : stock * N(r.costo_convenio));
      }
      inventarioSemana = `${sem.anio}-${String(sem.semana).padStart(2, '0')}`;
    }
  }

  // Sell out SIN IVA. Digitalife/Dicotech: sellout_sku (Σ subtotal − descuento).
  // PCEL: v_sellout_pcel_sku_mes, la única valuación oficial (piezas × precio de lista),
  // ya calculada en Postgres — antes cada pantalla inventaba la suya (aquí era a costo).
  const selloutEstimado = clienteKey === 'pcel';
  const soPorMes = new Map(); // `${a}-${m}` → monto
  const addSo = (a, m, v) => { const k = `${a}-${m}`; soPorMes.set(k, (soPorMes.get(k) || 0) + v); };
  if (selloutEstimado) {
    for (const r of data.selloutPcelMensual) addSo(N(r.anio), N(r.mes), N(r.monto));
  } else {
    for (const r of data.selloutSku) if (r.cliente === clienteKey) addSo(N(r.anio), N(r.mes), N(r.monto_pesos));
  }
  const soEn = (a, m) => soPorMes.get(`${a}-${m}`) || 0;
  const soMes = soEn(anio, mes);
  const soMesAnt = soEn(anio - 1, mes);
  const soYoY = soMesAnt > 0 ? ((soMes - soMesAnt) / soMesAnt) * 100 : null;
  let soYTD = 0; for (let m = 1; m <= mes; m++) soYTD += soEn(anio, m);
  // Últimos 3 meses (terminando en el periodo) para cobertura
  let so3m = 0, n3 = 0;
  { let a = anio, m = mes; for (let i = 0; i < 3; i++) { const v = soEn(a, m); if (v > 0) { so3m += v; n3++; } m--; if (m === 0) { m = 12; a--; } } }
  let coberturaDias = null;
  if (inventarioValor > 0) {
    const diario = n3 > 0 ? so3m / (n3 * 30) : (soYTD > 0 ? soYTD / (mes * 30) : 0);
    if (diario > 0) coberturaDias = Math.round(inventarioValor / diario);
  }

  // Cartera al corte más cercano ≤ fin de mes
  const fin = finDeMes(periodo).getTime();
  const cortes = data.estadosCuenta.filter((r) => r.cliente === clienteKey && r.fecha_corte && new Date(r.fecha_corte).getTime() <= fin);
  const corte = cortes.reduce((b, r) => (!b || r.fecha_corte > b.fecha_corte ? r : b), null);
  const plazo = N(data.creditoConfig.find((r) => r.cliente === clienteKey)?.plazo_dias_credito) || 90;
  const saldoActual = N(corte?.saldo_actual);
  const saldoVencido = N(corte?.saldo_vencido);
  const pctVencido = saldoActual > 0 ? (saldoVencido / saldoActual) * 100 : (saldoVencido > 0 ? 100 : 0);
  let dsoReal = null, facturasAbiertas = 0;
  if (corte) {
    const det = data.estadosCuentaDetalle.filter((r) => r.estado_cuenta_id === corte.id && N(r.saldo_actual) > 0);
    facturasAbiertas = det.length;
    const tCorte = new Date(corte.fecha_corte).getTime();
    let num = 0, den = 0;
    for (const r of det) {
      if (!r.fecha_emision) continue;
      const dias = Math.max(0, Math.round((tCorte - new Date(r.fecha_emision).getTime()) / 86400000));
      num += N(r.saldo_actual) * dias; den += N(r.saldo_actual);
    }
    dsoReal = den > 0 ? Math.round(num / den) : (corte.dso != null ? N(corte.dso) : null);
  }

  return {
    periodo,
    siMes, siMesPrev, siMesAnt, siYTD, siYTDAnt, siMoM, siYoY,
    cuotaMin: cuota.min, cuotaIdeal: cuota.ideal, dosCuotas: dosCuotas(cuota),
    cuotaYTDMin, cuotaYTDIdeal, cuotaAnualIdeal,
    cumplMin, cumplIdeal, cumplYTDMin, cumplYTDIdeal,
    // compat: "cumplimiento" = contra la ideal (la que se comparte)
    cumplimientoMes: cumplIdeal, cumplimientoYTD: cumplYTDIdeal,
    soMes, soMesAnt, soYoY, soYTD, selloutEstimado,
    inventarioValor, inventarioPiezas, inventarioSemana, coberturaDias,
    corteFecha: corte?.fecha_corte || null, saldoActual, saldoVencido, pctVencido, facturasAbiertas,
    dsoReal, dsoErp: corte?.dso != null ? N(corte.dso) : null, dsoPlazo: plazo,
    topSkus,
  };
}

// ── Consolidado ──
export function calcularConsolidado(resumenes) {
  const z = { siMes: 0, siYTD: 0, siMesAnt: 0, soMes: 0, soMesAnt: 0, cuotaMin: 0, cuotaIdeal: 0, cuotaYTDMin: 0, cuotaYTDIdeal: 0,
    inventarioValor: 0, saldoVencido: 0, saldoActual: 0, facturasAbiertas: 0, coberturaSum: 0, coberturaN: 0, algunaDoble: false };
  const c = resumenes.reduce((a, { resumen: r }) => ({
    siMes: a.siMes + r.siMes, siYTD: a.siYTD + r.siYTD, siMesAnt: a.siMesAnt + r.siMesAnt,
    soMes: a.soMes + r.soMes, soMesAnt: a.soMesAnt + r.soMesAnt,
    cuotaMin: a.cuotaMin + N(r.cuotaMin), cuotaIdeal: a.cuotaIdeal + N(r.cuotaIdeal),
    cuotaYTDMin: a.cuotaYTDMin + r.cuotaYTDMin, cuotaYTDIdeal: a.cuotaYTDIdeal + r.cuotaYTDIdeal,
    inventarioValor: a.inventarioValor + r.inventarioValor,
    saldoVencido: a.saldoVencido + r.saldoVencido, saldoActual: a.saldoActual + r.saldoActual,
    facturasAbiertas: a.facturasAbiertas + r.facturasAbiertas,
    coberturaSum: a.coberturaSum + (r.coberturaDias || 0), coberturaN: a.coberturaN + (r.coberturaDias != null ? 1 : 0),
    algunaDoble: a.algunaDoble || r.dosCuotas,
  }), z);
  return {
    ...c,
    cumplIdeal: pctDe(c.siMes, c.cuotaIdeal), cumplMin: pctDe(c.siMes, c.cuotaMin),
    cumplYTDIdeal: pctDe(c.siYTD, c.cuotaYTDIdeal), cumplYTDMin: pctDe(c.siYTD, c.cuotaYTDMin),
    siYoY: c.siMesAnt > 0 ? ((c.siMes - c.siMesAnt) / c.siMesAnt) * 100 : null,
    soYoY: c.soMesAnt > 0 ? ((c.soMes - c.soMesAnt) / c.soMesAnt) * 100 : null,
    coberturaProm: c.coberturaN > 0 ? Math.round(c.coberturaSum / c.coberturaN) : null,
    pctVencido: c.saldoActual > 0 ? (c.saldoVencido / c.saldoActual) * 100 : 0,
  };
}

export function calcularShareEmpresa(data, periodo) {
  const mios = new Set(CLIENTE_KEYS);
  let eMes = 0, mMes = 0, eYTD = 0, mYTD = 0;
  for (const r of data.ventasMes) {
    if (N(r.anio) !== periodo.anio) continue;
    const v = N(r.monto), m = N(r.mes);
    if (m === periodo.mes) { eMes += v; if (mios.has(r.cliente_key)) mMes += v; }
    if (m <= periodo.mes) { eYTD += v; if (mios.has(r.cliente_key)) mYTD += v; }
  }
  return { empresaMes: eMes, misMes: mMes, shareMes: pctDe(mMes, eMes), empresaYTD: eYTD, misYTD: mYTD, shareYTD: pctDe(mYTD, eYTD) };
}

// ── Tendencia: 12 meses del año del periodo ──
export function calcularTendencia(data, filtro, periodo) {
  const claves = filtro === 'todos' ? CLIENTE_KEYS : [filtro];
  const { anio, mes } = periodo;
  const ultimoConDatos = anio === anioActual ? mesActual : 12;
  const rows = Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    let ideal = 0, min = 0, si = 0, prev = 0;
    for (const k of claves) {
      const c = cuotasDe(data.cuotas, k, anio, m);
      ideal += N(c.ideal); min += N(c.min);
    }
    for (const r of data.ventasMes) {
      if (!claves.includes(r.cliente_key) || N(r.mes) !== m) continue;
      if (N(r.anio) === anio) si += N(r.monto);
      else if (N(r.anio) === anio - 1) prev += N(r.monto);
    }
    const futuro = m > ultimoConDatos;
    return { mes: m, label: MESES_CORTO[i], cuotaIdeal: ideal || null, cuotaMin: min || null, sellIn: futuro ? null : si, sellInPrev: prev || null, esSeleccionado: m === mes, esFuturo: futuro };
  });
  const conMin = rows.some((r) => r.cuotaIdeal != null && r.cuotaMin != null && Math.abs(r.cuotaIdeal - r.cuotaMin) > 1);
  return { rows, conMin, anio };
}

// ── Estatus ──
export function estatusCliente(r) {
  const c = r.cumplIdeal ?? r.cumplYTDIdeal;
  const venc = r.pctVencido || 0, cob = r.coberturaDias;
  if (venc > 15 || (c != null && c < 70) || (cob != null && cob < 15)) return { key: 'bad', label: 'Requiere atención', tone: 'red' };
  if ((c != null && c < 90) || (cob != null && cob < 30) || venc > 5) return { key: 'warn', label: 'Vigilar', tone: 'orange' };
  if (r.siYTD === 0) return { key: 'neutral', label: 'Sin datos aún', tone: 'gray' };
  return { key: 'good', label: 'Al día', tone: 'green' };
}

/** MC % del mes y YTD desde v_erp_medidas_cliente_mes (sólo con permiso sensible). */
export function calcularMargen(medidas, clienteKey, periodo) {
  if (!medidas) return null;
  const rows = medidas.filter((r) => r.cliente_key === clienteKey && N(r.anio) === periodo.anio);
  const m = rows.find((r) => N(r.mes) === periodo.mes);
  const ytd = rows.filter((r) => N(r.mes) <= periodo.mes);
  const fN = N(m?.fact_neta), cN = N(m?.contribucion);
  const fY = ytd.reduce((s, r) => s + N(r.fact_neta), 0), cY = ytd.reduce((s, r) => s + N(r.contribucion), 0);
  return { mcMes: fN > 0 ? (cN / fN) * 100 : null, mcYTD: fY > 0 ? (cY / fY) * 100 : null, contribucionMes: cN, contribucionYTD: cY };
}
