// proyectos/calculo.js — motor PURO de "Proyectos y abasto".
//
// Una sola pasada resuelve las tres vistas de la pantalla (Tablero · Matriz SKU × mes ·
// "Qué falta comprar") y también la alimenta el cron (api/cron.js → generar-alertas),
// para que la web, el celular y las alertas no puedan discrepar.
//
// Regla de reparto (FIFO por mes):
//   los meses se atienden en orden cronológico; cada mes toma primero del inventario
//   DISPONIBLE que quede y luego de los embarques en tránsito cuya ETA cae dentro de ese
//   mes o antes. Lo que un mes se lleva ya no está para los siguientes — es lo que pasa
//   en la realidad, y evita pintar dos proyectos distintos como cubiertos por las mismas
//   piezas.
//
// Nada de red ni de React aquí: entra data cruda, sale data. Pruebas en
// scripts/test-proyectos-calculo.mjs.

export const N = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);
/** División segura: sin denominador devuelve null (la UI pinta "—"), nunca 0. */
export const divide = (a, b) => (!b ? null : a / b);

// ─── Probabilidad ───
export const PROBABILIDADES = [
  { id: 'prospecto',  label: 'Propuesto',  tone: 'gray',   demanda: true },
  { id: 'probable',   label: 'Probable',   tone: 'blue',   demanda: true },
  { id: 'confirmado', label: 'Confirmado', tone: 'green',  demanda: true },
  { id: 'entregado',  label: 'Entregado',  tone: 'purple', demanda: false },
  { id: 'cancelado',  label: 'Cancelado',  tone: 'red',    demanda: false },
];
export const PROB_LABEL = Object.fromEntries(PROBABILIDADES.map((p) => [p.id, p.label]));
export const PROB_TONE  = Object.fromEntries(PROBABILIDADES.map((p) => [p.id, p.tone]));
/** Estados que comprometen inventario (los que consumen disponible y tránsito). */
export const ESTADOS_DEMANDA = PROBABILIDADES.filter((p) => p.demanda).map((p) => p.id);

export const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', color: '#FF3B30' },
  { key: 'pcel',       label: 'PCEL',       color: '#FF9500' },
  { key: 'dicotech',   label: 'Dicotech',   color: '#0EA5E9' },
];
export const CLIENTE_LABEL = Object.fromEntries(CLIENTES.map((c) => [c.key, c.label]));

export const MESES_CORTO = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Lead time por defecto cuando el SKU no tiene historia de embarques (días puerta a puerta). */
export const LEAD_TIME_DEFAULT = 104;
/** Holgura mínima para pintar un mes en verde; por debajo va en naranja ("justo"). */
export const HOLGURA_MINIMA = 0.15;

export const claveMes = (anio, mes) => `${anio}-${String(mes).padStart(2, '0')}`;
export const etiquetaMes = (anio, mes) => `${MESES_CORTO[(N(mes) || 1) - 1]} ${String(anio).slice(2)}`;
export const etiquetaMesLarga = (anio, mes) => `${MESES_LARGO[(N(mes) || 1) - 1]} ${anio}`;

/** Último instante del mes (ms UTC) — el corte para decidir si un arribo llega "a tiempo". */
export const finDeMes = (anio, mes) => Date.UTC(anio, mes, 1) - 1;
/** Primer día del mes (ms UTC) — la fecha contra la que se descuenta el lead time. */
export const inicioDeMes = (anio, mes) => Date.UTC(anio, mes - 1, 1);

const msDeISO = (s) => {
  if (!s) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s));
  if (!m) return null;
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
};
const isoDeMs = (ms) => (ms == null ? null : new Date(ms).toISOString().slice(0, 10));

/** Los próximos `n` meses empezando por el de `hoy`. */
export function mesesHorizonte(hoy = new Date(), n = 6) {
  const a0 = hoy.getFullYear(), m0 = hoy.getMonth(); // 0-based
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(Date.UTC(a0, m0 + i, 1));
    const anio = d.getUTCFullYear(), mes = d.getUTCMonth() + 1;
    out.push({ anio, mes, clave: claveMes(anio, mes), label: etiquetaMes(anio, mes), labelLargo: etiquetaMesLarga(anio, mes) });
  }
  return out;
}

/** Arribos por SKU a partir de v_transito_sku (usa embarques_detalle si viene; si no, la fila). */
export function arribosDeTransito(transito = []) {
  const m = new Map();
  for (const t of transito) {
    const sku = t?.sku;
    if (!sku) continue;
    const det = Array.isArray(t.embarques_detalle) ? t.embarques_detalle : null;
    const lista = m.get(sku) || [];
    if (det && det.length) {
      for (const e of det) {
        const cantidad = N(e.cantidad);
        if (cantidad <= 0) continue;
        lista.push({ cantidad, eta: e.eta || e.eta_puerto || null, etaMs: msDeISO(e.eta || e.eta_puerto), po: e.po || null, supplier: t.supplier || null });
      }
    } else if (N(t.cantidad) > 0) {
      lista.push({ cantidad: N(t.cantidad), eta: t.eta_mas_cercana || null, etaMs: msDeISO(t.eta_mas_cercana), po: null, supplier: t.supplier || null });
    }
    // Sin ETA = no se sabe cuándo llega: va al final, nunca cubre un mes concreto.
    lista.sort((a, b) => (a.etaMs ?? Infinity) - (b.etaMs ?? Infinity));
    m.set(sku, lista);
  }
  return m;
}

/** Lead time real del SKU (v_lead_time_sku) con respaldo por proveedor y default de 104 d. */
export function leadTimeDe(sku, leadTimes, porProveedor = null) {
  const lt = leadTimes instanceof Map ? leadTimes.get(sku) : (leadTimes || []).find((l) => l.sku === sku);
  const dias = N(lt?.dias_promedio);
  if (dias > 0) return { dias: Math.round(dias), proveedor: lt?.supplier_principal || null, fuente: 'sku' };
  const prov = lt?.supplier_principal || null;
  if (prov && porProveedor) {
    const p = porProveedor instanceof Map ? porProveedor.get(prov) : (porProveedor || []).find((x) => x.supplier === prov);
    const d = N(p?.dias_promedio ?? p?.dias_total_med ?? p?.dias_total_prom);
    if (d > 0) return { dias: Math.round(d), proveedor: prov, fuente: 'proveedor' };
  }
  return { dias: LEAD_TIME_DEFAULT, proveedor: prov, fuente: 'default' };
}

/**
 * Motor principal.
 *
 * @param proyectos   filas de `proyectos`
 * @param lineas      filas de `proyecto_lineas`
 * @param inventario  v_inventario_comercial ({ sku, disponible, inventario })
 * @param transito    v_transito_sku
 * @param leadTimes   v_lead_time_sku
 * @param leadProveedor v_lead_time_supplier | v_embarques_proveedor (respaldo)
 * @param meses       horizonte a pintar (mesesHorizonte); los proyectos fuera del
 *                    horizonte igual se reparten, sólo no se muestran en la matriz
 * @param filtros     { clientes: Set|array, soloConfirmados: bool }
 */
export function calcular({
  proyectos = [], lineas = [], inventario = [], transito = [], leadTimes = [],
  leadProveedor = [], descripciones = null, meses = null, hoy = new Date(), filtros = {},
} = {}) {
  const horizonte = meses && meses.length ? meses : mesesHorizonte(hoy, 6);
  const clavesHorizonte = new Set(horizonte.map((m) => m.clave));
  const hoyMs = Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const setClientes = filtros.clientes instanceof Set ? filtros.clientes
    : Array.isArray(filtros.clientes) && filtros.clientes.length ? new Set(filtros.clientes) : null;

  // ── 1. Proyectos que cuentan ──
  const visibles = proyectos.filter((p) => {
    if (setClientes && !setClientes.has(p.cliente)) return false;
    if (filtros.soloConfirmados) return p.probabilidad === 'confirmado';
    return true;
  });
  // Sólo los estados de demanda comprometen inventario (entregado y cancelado no).
  const conDemanda = visibles.filter((p) => ESTADOS_DEMANDA.includes(p.probabilidad));
  const idsDemanda = new Set(conDemanda.map((p) => p.id));

  const lineasPorProyecto = new Map();
  for (const l of lineas) {
    const arr = lineasPorProyecto.get(l.proyecto_id) || [];
    arr.push(l);
    lineasPorProyecto.set(l.proyecto_id, arr);
  }

  // ── 2. Demanda por SKU y mes ──
  // sku → clave mes → { anio, mes, necesidad, reservado, lineas: [{ proyectoId, piezas }] }
  const demanda = new Map();
  const clavesConDemanda = new Set();
  for (const p of conDemanda) {
    if (!p.anio || !p.mes) continue;
    const clave = claveMes(p.anio, p.mes);
    clavesConDemanda.add(clave);
    for (const l of lineasPorProyecto.get(p.id) || []) {
      const piezas = N(l.piezas);
      if (piezas <= 0 && N(l.reservado) <= 0) continue;
      if (!demanda.has(l.sku)) demanda.set(l.sku, new Map());
      const porMes = demanda.get(l.sku);
      const cel = porMes.get(clave) || { anio: p.anio, mes: p.mes, clave, necesidad: 0, reservado: 0, lineas: [] };
      cel.necesidad += piezas;
      cel.reservado += N(l.reservado);
      cel.lineas.push({ proyectoId: p.id, lineaId: l.id, piezas });
      porMes.set(clave, cel);
    }
  }

  // Orden cronológico de TODOS los meses con demanda (aunque caigan fuera del horizonte:
  // un proyecto de este mes debe consumir antes que uno de dentro de seis).
  const ordenMeses = [...new Set([...clavesConDemanda, ...clavesHorizonte])].sort();

  // ── 3. Reparto FIFO por mes ──
  const stock = new Map();
  for (const r of inventario) {
    const sku = r?.sku;
    if (!sku) continue;
    stock.set(sku, N(r.disponible ?? r.inventario ?? r.inv_actual_disponible));
  }
  const arribos = arribosDeTransito(transito);
  const ltProv = leadProveedor instanceof Map ? leadProveedor
    : new Map((leadProveedor || []).map((r) => [r.supplier, r]));
  const ltSku = leadTimes instanceof Map ? leadTimes : new Map((leadTimes || []).map((r) => [r.sku, r]));

  const celdas = [];                        // sku × mes (todas, incluidas fuera del horizonte)
  const cubiertoPorLinea = new Map();       // `${proyectoId}|${sku}` → piezas cubiertas

  const skus = [...demanda.keys()].sort();
  for (const sku of skus) {
    let pool = Math.max(0, N(stock.get(sku)));
    const pend = (arribos.get(sku) || []).map((a) => ({ ...a, resto: a.cantidad }));
    const porMes = demanda.get(sku);

    for (const clave of ordenMeses) {
      const cel = porMes.get(clave);
      if (!cel) continue;
      const corte = finDeMes(cel.anio, cel.mes);
      const nec = cel.necesidad;

      const usaDisponible = Math.min(pool, nec);
      pool -= usaDisponible;
      let resto = nec - usaDisponible;

      let usaTransito = 0;
      for (const a of pend) {
        if (resto <= 0) break;
        if (a.resto <= 0) continue;
        if (a.etaMs == null || a.etaMs > corte) continue;   // llega tarde (o sin fecha): no cuenta para este mes
        const toma = Math.min(a.resto, resto);
        a.resto -= toma; resto -= toma; usaTransito += toma;
      }

      const faltante = Math.max(0, resto);
      const cubierto = nec - faltante;
      // Holgura = lo que queda libre para este mes después de servirlo.
      const sobrante = pool + pend.reduce((s, a) => s + (a.etaMs != null && a.etaMs <= corte ? a.resto : 0), 0);
      const transitoDespues = pend.reduce((s, a) => s + (a.etaMs == null || a.etaMs > corte ? a.resto : 0), 0);
      const proxEtaTarde = pend.find((a) => a.resto > 0 && a.etaMs != null && a.etaMs > corte) || null;

      const tono = faltante > 0 ? 'rojo'
        : nec > 0 && divide(sobrante, nec) < HOLGURA_MINIMA ? 'naranja'
        : 'verde';

      // Reparto proporcional de lo cubierto entre las líneas del mes (para el % del proyecto).
      for (const ln of cel.lineas) {
        const parte = nec > 0 ? (cubierto * ln.piezas) / nec : 0;
        const k = `${ln.proyectoId}|${sku}`;
        cubiertoPorLinea.set(k, (cubiertoPorLinea.get(k) || 0) + parte);
      }

      celdas.push({
        sku, clave, anio: cel.anio, mes: cel.mes,
        necesidad: nec, reservado: cel.reservado,
        disponible: usaDisponible, transitoAntes: usaTransito, transitoDespues,
        cubierto, faltante, sobrante, tono,
        etaTarde: proxEtaTarde?.eta || null,
        proyectos: cel.lineas.length,
        enHorizonte: clavesHorizonte.has(clave),
        descripcion: descripciones?.get?.(sku) || null,
      });
    }
  }
  const celdaPorSkuMes = new Map(celdas.map((c) => [`${c.sku}|${c.clave}`, c]));

  // ── 4. Cobertura por proyecto ──
  const porProyecto = visibles.map((p) => {
    const ls = lineasPorProyecto.get(p.id) || [];
    const clave = p.anio && p.mes ? claveMes(p.anio, p.mes) : null;
    let pz = 0, cubierto = 0, reservado = 0, monto = 0, montoCubierto = 0, sinPrecio = 0;
    const faltantes = [];
    for (const l of ls) {
      const piezas = N(l.piezas);
      pz += piezas; reservado += N(l.reservado);
      // Dinero: piezas × precio de la línea (lista del cliente o personalizado). Sin precio no suma y se cuenta aparte.
      const precio = N(l.precio);
      if (precio > 0) monto += piezas * precio; else if (piezas > 0) sinPrecio += 1;
      const cub = idsDemanda.has(p.id) ? Math.min(piezas, cubiertoPorLinea.get(`${p.id}|${l.sku}`) || 0) : piezas;
      cubierto += cub;
      if (precio > 0) montoCubierto += cub * precio;
      const falta = Math.max(0, piezas - cub);
      if (falta > 0.5) {
        const cel = clave ? celdaPorSkuMes.get(`${l.sku}|${clave}`) : null;
        faltantes.push({
          sku: l.sku, piezas, faltante: Math.round(falta),
          descripcion: l.descripcion || descripciones?.get?.(l.sku) || null,
          transitoDespues: cel?.transitoDespues || 0,
          etaTarde: cel?.etaTarde || null,
        });
      }
    }
    faltantes.sort((a, b) => b.faltante - a.faltante);
    return {
      ...p,
      clave, skus: ls.length, lineas: ls,
      monto: Math.round(monto), montoCubierto: Math.round(montoCubierto), sinPrecio,
      pz, reservado, cubierto: Math.round(cubierto),
      cubiertoPct: pz > 0 ? Math.min(100, (cubierto / pz) * 100) : null,
      faltante: Math.max(0, Math.round(pz - cubierto)),
      faltantes,
      enHorizonte: clave ? clavesHorizonte.has(clave) : false,
      // Un proyecto "en riesgo": le faltan piezas y su mes ya está a ≤ 30 días.
      diasAlMes: p.anio && p.mes ? Math.round((inicioDeMes(p.anio, p.mes) - hoyMs) / 86400000) : null,
    };
  }).sort((a, b) => String(a.clave || '9999').localeCompare(String(b.clave || '9999')) || b.pz - a.pz);

  // ── 5. Qué falta comprar ──
  const faltaPorSku = new Map();
  for (const c of celdas) {
    if (c.faltante <= 0) continue;
    const f = faltaPorSku.get(c.sku) || { sku: c.sku, falta: 0, primerMes: c.clave, anio: c.anio, mes: c.mes, meses: [] };
    f.falta += c.faltante;
    f.meses.push({ clave: c.clave, faltante: c.faltante });
    if (c.clave < f.primerMes) { f.primerMes = c.clave; f.anio = c.anio; f.mes = c.mes; }
    faltaPorSku.set(c.sku, f);
  }
  const comprasSugeridas = [...faltaPorSku.values()].map((f) => {
    const lt = leadTimeDe(f.sku, ltSku, ltProv);
    const limiteMs = inicioDeMes(f.anio, f.mes) - lt.dias * 86400000;
    return {
      sku: f.sku,
      descripcion: descripciones?.get?.(f.sku) || null,
      falta: Math.round(f.falta),
      mes: f.mes, anio: f.anio, mesClave: f.primerMes, mesLabel: etiquetaMes(f.anio, f.mes),
      leadTime: lt.dias, leadTimeFuente: lt.fuente,
      proveedor: lt.proveedor,
      limite: isoDeMs(limiteMs),
      diasAlLimite: Math.round((limiteMs - hoyMs) / 86400000),
      llegaTarde: limiteMs < hoyMs,
    };
  }).sort((a, b) => String(a.limite || '9999').localeCompare(String(b.limite || '9999')) || b.falta - a.falta);

  // ── 6. Resumen del hero ──
  const activos = porProyecto.filter((p) => ESTADOS_DEMANDA.includes(p.probabilidad));
  const piezas = activos.reduce((s, p) => s + p.pz, 0);
  const cubiertoTotal = activos.reduce((s, p) => s + p.cubierto, 0);
  const proximo = comprasSugeridas.find((c) => c.limite) || null;
  const mesActualClave = claveMes(hoy.getFullYear(), hoy.getMonth() + 1);
  const montoActivos = activos.reduce((s, p) => s + p.monto, 0);
  const resumen = {
    monto: montoActivos,
    montoMesActual: activos.filter((p) => p.clave === mesActualClave).reduce((s, p) => s + p.monto, 0),
    montoConfirmado: activos.filter((p) => p.probabilidad === 'confirmado').reduce((s, p) => s + p.monto, 0),
    sinPrecio: activos.reduce((s, p) => s + p.sinPrecio, 0),
    proyectos: activos.length,
    confirmados: activos.filter((p) => p.probabilidad === 'confirmado').length,
    piezas,
    cubierto: cubiertoTotal,
    // % NUNCA promediado: se recalcula sobre los totales.
    cubiertoPct: piezas > 0 ? (cubiertoTotal / piezas) * 100 : null,
    skusPorComprar: comprasSugeridas.length,
    piezasPorComprar: comprasSugeridas.reduce((s, c) => s + c.falta, 0),
    limiteProximo: proximo?.limite || null,
    vencidos: comprasSugeridas.filter((c) => c.llegaTarde).length,
    enRiesgo: activos.filter((p) => p.faltante > 0 && p.diasAlMes != null && p.diasAlMes <= 30).length,
  };

  return { horizonte, meses: horizonte, celdas, celdaPorSkuMes, porProyecto, comprasSugeridas, resumen, skus };
}

/** Filas de la Matriz SKU × mes: un renglón por SKU con una celda por mes del horizonte. */
export function matriz(res, { medida = 'necesidad', soloFaltante = false } = {}) {
  const { horizonte, celdas } = res;
  const porSku = new Map();
  for (const c of celdas) {
    if (!c.enHorizonte) continue;
    const r = porSku.get(c.sku) || { sku: c.sku, descripcion: c.descripcion, celdas: {}, total: 0, faltante: 0 };
    r.celdas[c.clave] = c;
    r.total += c.necesidad;
    r.faltante += c.faltante;
    r.descripcion = r.descripcion || c.descripcion;
    porSku.set(c.sku, r);
  }
  let filas = [...porSku.values()];
  if (soloFaltante) filas = filas.filter((r) => r.faltante > 0);
  const valor = (c) => (!c ? null : medida === 'faltante' ? c.faltante : medida === 'reservado' ? c.reservado : c.necesidad);
  for (const r of filas) {
    for (const m of horizonte) r[m.clave] = valor(r.celdas[m.clave]);
  }
  filas.sort((a, b) => b.faltante - a.faltante || b.total - a.total || a.sku.localeCompare(b.sku));
  return filas;
}

/** Tablero: proyectos agrupados por mes del horizonte (+ columna "Después" para lo que cae fuera). */
export function tablero(res) {
  const vacia = () => ({ proyectos: [], piezas: 0, monto: 0, montoPorCliente: {}, montoPorProb: { prospecto: 0, probable: 0, confirmado: 0 } });
  const cols = res.horizonte.map((m) => ({ ...m, ...vacia() }));
  const porClave = new Map(cols.map((c) => [c.clave, c]));
  const fuera = { clave: 'fuera', label: 'Más adelante', anio: null, mes: null, ...vacia() };
  for (const p of res.porProyecto) {
    const col = (p.clave && porClave.get(p.clave)) || fuera;
    col.proyectos.push(p);
    col.piezas += p.pz;
    // El dinero del mes: sólo lo que compromete (propuesto · probable · confirmado); entregado y cancelado no suman.
    if (ESTADOS_DEMANDA.includes(p.probabilidad)) {
      col.monto += p.monto;
      col.montoPorCliente[p.cliente] = (col.montoPorCliente[p.cliente] || 0) + p.monto;
      col.montoPorProb[p.probabilidad] = (col.montoPorProb[p.probabilidad] || 0) + p.monto;
    }
  }
  for (const c of [...cols, fuera]) c.proyectos.sort((a, b) => (a.cubiertoPct ?? 101) - (b.cubiertoPct ?? 101) || b.pz - a.pz);
  return fuera.proyectos.length ? [...cols, fuera] : cols;
}

/** Cobertura de un SKU en un mes, con los proyectos que la piden (hoja lateral del SKU). */
export function detalleSku(res, sku) {
  const celdas = res.celdas.filter((c) => c.sku === sku).sort((a, b) => a.clave.localeCompare(b.clave));
  const proyectos = res.porProyecto
    .filter((p) => (p.lineas || []).some((l) => l.sku === sku))
    .map((p) => ({ ...p, linea: p.lineas.find((l) => l.sku === sku) }));
  const compra = res.comprasSugeridas.find((c) => c.sku === sku) || null;
  return { sku, celdas, proyectos, compra };
}

// ── Días hábiles y arribos próximos (avisos 3 días hábiles antes y el día que llega · 2026-09-25) ──
const esHabil = (d) => { const w = d.getUTCDay(); return w !== 0 && w !== 6; };
const utcDe = (iso) => { const [a, m, d] = String(iso).slice(0, 10).split('-').map(Number); return new Date(Date.UTC(a, m - 1, d)); };
/** Suma n días hábiles (L–V) a una fecha ISO; devuelve ISO. */
export function sumarDiasHabiles(iso, n) {
  const d = utcDe(iso); let k = 0;
  while (k < n) { d.setUTCDate(d.getUTCDate() + 1); if (esHabil(d)) k++; }
  return d.toISOString().slice(0, 10);
}
/** Días hábiles entre dos fechas ISO (desde excluido, hasta incluido). Negativo si hasta < desde. */
export function diasHabilesEntre(desdeIso, hastaIso) {
  const a = utcDe(desdeIso), b = utcDe(hastaIso);
  const sig = a <= b ? 1 : -1; let n = 0; const d = new Date(a);
  while (d.getTime() !== b.getTime()) { d.setUTCDate(d.getUTCDate() + sig); if (esHabil(d)) n += sig; }
  return n;
}
/**
 * Arribos que le importan a los proyectos activos: por proyecto y SKU, el embarque más próximo cuya ETA
 * aún no pasó. → [{ proyectoId, nombre, cliente, sku, piezas, eta, cantidad, diasHabiles, po }]
 */
export function arribosProximos(res, transito = [], hoy = new Date()) {
  const hoyIso = new Date(Date.UTC(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())).toISOString().slice(0, 10);
  const arribos = arribosDeTransito(transito);
  const out = [];
  for (const p of res.porProyecto) {
    if (!ESTADOS_DEMANDA.includes(p.probabilidad)) continue;
    for (const l of p.lineas || []) {
      const prox = (arribos.get(l.sku) || []).filter((a) => a.eta && a.eta >= hoyIso).sort((a, b) => a.eta.localeCompare(b.eta))[0];
      if (!prox) continue;
      out.push({ proyectoId: p.id, nombre: p.nombre, cliente: p.cliente, sku: l.sku, piezas: N(l.piezas), eta: prox.eta, cantidad: N(prox.cantidad), po: prox.po || null, diasHabiles: diasHabilesEntre(hoyIso, prox.eta) });
    }
  }
  return out.sort((a, b) => a.eta.localeCompare(b.eta));
}
