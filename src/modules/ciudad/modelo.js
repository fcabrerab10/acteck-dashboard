// Acteck Ciudad · modelo (puro, sin React ni three). Pruebas: scripts/test-ciudad-modelo.mjs
//
// Convierte los datos del dashboard en un «mapa-ciudad»: México estilizado donde cada ciudad real es un distrito
// con las tiendas (sucursales) de los clientes que venden ahí, Acteck está en Guadalajara (oficina + CEDIS),
// Manzanillo es el puerto por donde llegan los contenedores, y por las carreteras van los camiones (facturas)
// y los vendedores (equipo comercial del ERP) hacia los clientes que atienden.
// Regla de Fernando: NADA escala por el tamaño del cliente; lo que se ve es actividad (luces, movimiento).

const N = (v) => Number(v) || 0;
export const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();

/** Ciudades (lat, lon) · la escena usa x = (lon − lonGDL)·ESC, z = −(lat − latGDL)·ESC. */
export const CIUDADES = {
  GUADALAJARA: { lat: 20.67, lon: -103.35, estado: 'JALISCO' },
  'CIUDAD DE MEXICO': { lat: 19.43, lon: -99.13, estado: 'CIUDAD DE MEXICO' },
  MONTERREY: { lat: 25.67, lon: -100.31, estado: 'NUEVO LEON' },
  HERMOSILLO: { lat: 29.07, lon: -110.96, estado: 'SONORA' },
  ZACATECAS: { lat: 22.77, lon: -102.58, estado: 'ZACATECAS' },
  PUEBLA: { lat: 19.04, lon: -98.2, estado: 'PUEBLA' },
  MERIDA: { lat: 20.97, lon: -89.62, estado: 'YUCATAN' },
  TIJUANA: { lat: 32.51, lon: -117.04, estado: 'BAJA CALIFORNIA' },
  MEXICALI: { lat: 32.62, lon: -115.45, estado: 'BAJA CALIFORNIA' },
  ENSENADA: { lat: 31.87, lon: -116.6, estado: 'BAJA CALIFORNIA' },
  CHIHUAHUA: { lat: 28.63, lon: -106.08, estado: 'CHIHUAHUA' },
  'CIUDAD JUAREZ': { lat: 31.74, lon: -106.49, estado: 'CHIHUAHUA' },
  CULIACAN: { lat: 24.8, lon: -107.39, estado: 'SINALOA' },
  MAZATLAN: { lat: 23.25, lon: -106.41, estado: 'SINALOA' },
  'LA PAZ': { lat: 24.14, lon: -110.31, estado: 'BAJA CALIFORNIA SUR' },
  TORREON: { lat: 25.54, lon: -103.41, estado: 'COAHUILA' },
  SALTILLO: { lat: 25.42, lon: -100.99, estado: 'COAHUILA' },
  DURANGO: { lat: 24.02, lon: -104.66, estado: 'DURANGO' },
  'SAN LUIS POTOSI': { lat: 22.15, lon: -100.98, estado: 'SAN LUIS POTOSI' },
  AGUASCALIENTES: { lat: 21.88, lon: -102.29, estado: 'AGUASCALIENTES' },
  LEON: { lat: 21.12, lon: -101.68, estado: 'GUANAJUATO' },
  QUERETARO: { lat: 20.59, lon: -100.39, estado: 'QUERETARO' },
  MORELIA: { lat: 19.7, lon: -101.19, estado: 'MICHOACAN' },
  TOLUCA: { lat: 19.29, lon: -99.66, estado: 'ESTADO DE MEXICO' },
  PACHUCA: { lat: 20.12, lon: -98.73, estado: 'HIDALGO' },
  CUERNAVACA: { lat: 18.92, lon: -99.23, estado: 'MORELOS' },
  XALAPA: { lat: 19.54, lon: -96.91, estado: 'VERACRUZ' },
  VERACRUZ: { lat: 19.17, lon: -96.13, estado: 'VERACRUZ' },
  TAMPICO: { lat: 22.25, lon: -97.86, estado: 'TAMAULIPAS' },
  REYNOSA: { lat: 26.08, lon: -98.29, estado: 'TAMAULIPAS' },
  OAXACA: { lat: 17.07, lon: -96.72, estado: 'OAXACA' },
  ACAPULCO: { lat: 16.86, lon: -99.88, estado: 'GUERRERO' },
  'TUXTLA GUTIERREZ': { lat: 16.75, lon: -93.12, estado: 'CHIAPAS' },
  VILLAHERMOSA: { lat: 17.99, lon: -92.93, estado: 'TABASCO' },
  CANCUN: { lat: 21.16, lon: -86.85, estado: 'QUINTANA ROO' },
  TEPIC: { lat: 21.5, lon: -104.89, estado: 'NAYARIT' },
  COLIMA: { lat: 19.24, lon: -103.72, estado: 'COLIMA' },
  MANZANILLO: { lat: 19.05, lon: -104.32, estado: 'COLIMA' },
  CAMPECHE: { lat: 19.85, lon: -90.53, estado: 'CAMPECHE' },
  TLAXCALA: { lat: 19.31, lon: -98.24, estado: 'TLAXCALA' },
  IRAPUATO: { lat: 20.67, lon: -101.35, estado: 'GUANAJUATO' },
  CELAYA: { lat: 20.52, lon: -100.81, estado: 'GUANAJUATO' },
};
// Nivel de detalle por zoom (escena/detalle.js): con la cámara más lejos que esto (zoom = media altura visible) se ocultan
// la gente y lo fino (ventanas, letreros, vitrinas, puertas). Lejos sólo quedan volúmenes y etiquetas de ciudad.
export const DETALLE = { gente: 50, fino: 65 };
export const capasVisibles = (zoom) => ({ gente: !(zoom > DETALLE.gente), fino: !(zoom > DETALLE.fino) });
// Árbol chico (escala menor a 1): adorno que va en la capa fina y se oculta de lejos (3.90.7).
export const esChico = (s) => Number.isFinite(s) && s < 1;

// Etiquetas sin encimarse: cajas en pixeles de pantalla { x, y (centro), w, h, prioridad }; se quedan las de mayor prioridad
// (empate: la primera) y se esconden las que chocan con una ya puesta. Regresa un arreglo de booleanos en el orden recibido.
export function etiquetasSinEncimar(cajas, margen = 4) {
  const orden = cajas.map((c, i) => i).sort((a, b) => (cajas[b].prioridad || 0) - (cajas[a].prioridad || 0) || a - b);
  const vis = cajas.map(() => false); const puestas = [];
  for (const i of orden) {
    const c = cajas[i]; if (!c || ![c.x, c.y, c.w, c.h].every(Number.isFinite)) continue;
    const choca = puestas.some((p) => Math.abs(p.x - c.x) * 2 < p.w + c.w + margen * 2 && Math.abs(p.y - c.y) * 2 < p.h + c.h + margen * 2);
    if (!choca) { vis[i] = true; puestas.push(c); }
  }
  return vis;
}

// Vista Base (etapa 2): encuadrar varios puntos del suelo { x, z, r } con la cámara isométrica ortográfica. La cámara mira
// desde (cos ang, sin ang)·300 a 240 de altura (escena/camara.js); el ancho visible es 2·zoom·aspecto y el alto 2·zoom.
// Regresa { cx, cz, zoom } (zoom = media altura visible, con margen y dentro de [min, max]) o null si no hay puntos válidos.
export const ELEV_CAM = Math.atan2(240, 300);
export function encuadre(puntos, { ang = Math.PI / 4, aspecto = 1.6, margen = 1.15, alto = 12, min = 8, max = 120 } = {}) {
  const ok = (puntos || []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  if (!ok.length) return null;
  const asp = Number.isFinite(aspecto) && aspecto > 0 ? aspecto : 1.6;
  const der = { x: Math.sin(ang), z: -Math.cos(ang) }; const fondo = { x: -Math.cos(ang), z: -Math.sin(ang) };
  let h0 = Infinity, h1 = -Infinity, v0 = Infinity, v1 = -Infinity;
  for (const p of ok) {
    const r = Number.isFinite(p.r) && p.r > 0 ? p.r : 0; const h = p.x * der.x + p.z * der.z; const v = p.x * fondo.x + p.z * fondo.z;
    h0 = Math.min(h0, h - r); h1 = Math.max(h1, h + r); v0 = Math.min(v0, v - r); v1 = Math.max(v1, v + r);
  }
  const hc = (h0 + h1) / 2, vc = (v0 + v1) / 2;
  const medioAlto = ((v1 - v0) / 2) * Math.sin(ELEV_CAM) + (alto * Math.cos(ELEV_CAM)) / 2; const medioAncho = (h1 - h0) / 2;
  const zoom = Math.max(min, Math.min(max, Math.max(medioAlto, medioAncho / asp) * margen));
  return { cx: hc * der.x + vc * fondo.x, cz: hc * der.z + vc * fondo.z, zoom };
}

// Campus de la Vista Base (etapa 2): oficina y CEDIS separados por una calle interior, una avenida al frente que los une,
// el patio de maniobras con andenes al oriente del CEDIS y el distrito «Guadalajara» debajo de la avenida, lejos del puerto
// (antes se enciman). Todo relativo a `esc` (Guadalajara en la escena). Calles: { a, b, ancho } en línea recta.
export function campus(esc = { x: 0, z: 0 }) {
  const x = Number.isFinite(esc?.x) ? esc.x : 0, z = Number.isFinite(esc?.z) ? esc.z : 0;
  const avenidaZ = z + 10.5;
  return {
    oficina: { x: x - 9, z: z + 2 }, // base 14 × 14 → x −16…−2
    cedis: { x: x + 11, z: z - 2 }, // base 22 × 16 → x 0…22
    patio: { x: x + 27, z: z - .25, ancho: 10, largo: 19.5, andenes: [-6, -2, 2] }, // x 22…32, z −10…9.5; andenes en z relativas al CEDIS
    calles: [
      { nombre: 'avenida', a: { x: x - 18, z: avenidaZ }, b: { x: x + 33, z: avenidaZ }, ancho: 2 },
      { nombre: 'interior', a: { x: x - 1, z: z - 10 }, b: { x: x - 1, z: avenidaZ - 1 }, ancho: 1.6 },
    ],
    // detalle (3.90.11): estacionamiento al norte de la oficina pegado a la calle interior, barda al norte y oriente del
    // CEDIS + patio, jardín al poniente de la oficina y faroles sobre la banqueta sur de la avenida (sin el cruce interior)
    estacionamiento: { x: x - 9, z: z - 10, ancho: 12, largo: 7, cajones: 10 }, // x −15…−3, z −13.5…−6.5
    bardas: [{ a: { x: x - .4, z: z - 10.7 }, b: { x: x + 32.7, z: z - 10.7 } }, { a: { x: x + 32.7, z: z - 10.7 }, b: { x: x + 32.7, z: avenidaZ - 1.8 } }],
    jardin: { x: x - 18.3, z: z + 1.5, ancho: 3.2, largo: 14 }, // x −19.9…−16.7
    faroles: Array.from({ length: 9 }, (_, i) => ({ x: x - 16 + i * 6, z: avenidaZ + 1.5 })).filter((f) => Math.abs(f.x - (x - 1)) > 1.5),
    // distrito GDL: su borde de arriba sobre la avenida y su borde izquierdo (con casitas, ~2.8 más) a la derecha de x + 2
    distritoGDL: (ancho = 0, largo = 0) => ({ x: x + 5 + (Number(ancho) || 0) / 2, z: avenidaZ + 2 + (Number(largo) || 0) / 2 }),
  };
}

export const ESC = 11; // unidades de escena por grado de longitud (México ≈ 330 × 180 unidades; Fernando: «muy amontonado»)
export const ORIGEN = CIUDADES.GUADALAJARA;
// Proyección del mapa de Sell Out (sellout/mexico-estados.json, viewBox 1000 × 626.6), ajustada por mínimos cuadrados
// contra los centroides de 16 estados (error medio 9.5 px): X = 32.1003·lon + 3792.67 · Y = −33.3885·lat + 1099.92.
// La escena usa esos píxeles escalados (K unidades por px) con Guadalajara en el origen, así el terreno (contorno real
// de México) y las ciudades caen en el mismo sistema.
export const PX = { a: 32.1003, b: 3792.67, c: -33.3885, d: 1099.92 };
export const K = ESC / PX.a;
export const aPx = (lon, lat) => ({ X: PX.a * lon + PX.b, Y: PX.c * lat + PX.d });
export const PX_ORIGEN = aPx(ORIGEN.lon, ORIGEN.lat);
export const pxAEscena = (X, Y) => ({ x: (X - PX_ORIGEN.X) * K, z: (Y - PX_ORIGEN.Y) * K });
export const posDe = (c) => { const p = aPx(c.lon, c.lat); return pxAEscena(p.X, p.Y); };

/** Color de cada cuenta (toldo y letrero de sus tiendas, sus vendedores, la leyenda). */
export const COLOR_CUENTA = { ct: 0x0A84FF, cva: 0xFF9F0A, dicotech: 0x30D158, digitalife: 0xBF5AF2, pcel: 0xFF453A, ingram: 0x5AC8FA, pch: 0xFFD60A, loma: 0x64D2FF, guc: 0xFF6482, kabik: 0xA2845E, dcmayorista: 0x7D8BFF, exel: 0x30B0C7, techsmart: 0xAC8E68, arroba: 0xD4A5FF, ingram_retail: 0x5AC8FA, directo: 0x8E8E93 };
export const hexCss = (n) => `#${Number(n).toString(16).padStart(6, '0')}`;

/** Sede de cada cuenta de sell out (de dónde es el cliente). Las que reportan estado en el sell out lo usan primero. */
export const SEDE_POR_CUENTA = {
  ct: 'HERMOSILLO', cva: 'GUADALAJARA', dicotech: 'ZACATECAS', digitalife: 'GUADALAJARA', pcel: 'MONTERREY',
  ingram: 'CIUDAD DE MEXICO', ingram_retail: 'CIUDAD DE MEXICO', pch: 'CIUDAD DE MEXICO', loma: 'MONTERREY', guc: 'MONTERREY',
  kabik: 'MERIDA', dcmayorista: 'PUEBLA', exel: 'MONTERREY', techsmart: 'GUADALAJARA', arroba: 'GUADALAJARA', directo: 'GUADALAJARA',
};
// Alias de nombres de sucursal → ciudad del catálogo (lo que no cae aquí se busca por coincidencia de palabras).
const ALIAS = {
  CDMX: 'CIUDAD DE MEXICO', MEXICO: 'CIUDAD DE MEXICO', 'CD DE MEXICO': 'CIUDAD DE MEXICO', AZCAPOTZALCO: 'CIUDAD DE MEXICO', VALLEJO: 'CIUDAD DE MEXICO',
  CEYLAN: 'CIUDAD DE MEXICO', AEROPUERTO: 'CIUDAD DE MEXICO', 'FACTURACION AEROPUERTO': 'CIUDAD DE MEXICO', NAUCALPAN: 'CIUDAD DE MEXICO', TLALNEPANTLA: 'CIUDAD DE MEXICO',
  GDL: 'GUADALAJARA', ZAPOPAN: 'GUADALAJARA', TLAQUEPAQUE: 'GUADALAJARA', 'NUEVO LEON': 'MONTERREY', MTY: 'MONTERREY', 'SAN NICOLAS': 'MONTERREY', GUADALUPE: 'MONTERREY', APODACA: 'MONTERREY',
  'BAJA CALIFORNIA NORTE': 'TIJUANA', 'BAJA CALIFORNIA': 'TIJUANA', 'BAJA CALIFORNIA SUR': 'LA PAZ', COAHUILA: 'SALTILLO', JALISCO: 'GUADALAJARA', SONORA: 'HERMOSILLO',
  SINALOA: 'CULIACAN', YUCATAN: 'MERIDA', 'QUINTANA ROO': 'CANCUN', 'JUAREZ': 'CIUDAD JUAREZ', 'CD JUAREZ': 'CIUDAD JUAREZ', 'SLP': 'SAN LUIS POTOSI', TUXTLA: 'TUXTLA GUTIERREZ',
  VERACRUZ: 'VERACRUZ', 'EDO MEX': 'TOLUCA', 'ESTADO DE MEXICO': 'TOLUCA', PUEBLA: 'PUEBLA', MERIDA: 'MERIDA', 'SAN LUIS': 'SAN LUIS POTOSI',
};
/** Ciudad representativa de cada estado (para clientes finales, que vienen por estado). */
export const CIUDAD_POR_ESTADO = (() => { const m = {}; for (const [k, v] of Object.entries(CIUDADES)) if (!m[v.estado]) m[v.estado] = k; m['ESTADO DE MEXICO'] = 'TOLUCA'; m.GUANAJUATO = 'LEON'; m['BAJA CALIFORNIA'] = 'TIJUANA'; m.COAHUILA = 'SALTILLO'; m.SINALOA = 'CULIACAN'; m.TAMAULIPAS = 'TAMPICO'; m.VERACRUZ = 'VERACRUZ'; return m; })();
const VIRTUAL = /E-?COMMERCE|AMAZON|MERCADO ?LIBRE|ONLINE|EN LINEA|WEB|DIGITAL|CORPORATIVO|MATRIZ|GENERAL|CEDIS|SIN SUCURSAL/;

/** Ciudad de una sucursal por su nombre. `null` si es virtual (e-commerce) o no se reconoce. */
export function ciudadDeSucursal(nombre) {
  const s = norm(nombre);
  if (!s) return null;
  if (VIRTUAL.test(s)) return { ciudad: null, virtual: true };
  if (ALIAS[s]) return { ciudad: ALIAS[s], virtual: false };
  if (CIUDADES[s]) return { ciudad: s, virtual: false };
  for (const [k, v] of Object.entries(ALIAS)) if (s.includes(k)) return { ciudad: v, virtual: false };
  for (const k of Object.keys(CIUDADES)) if (s.includes(k) || (k.length > 5 && k.includes(s))) return { ciudad: k, virtual: false };
  return { ciudad: null, virtual: false };
}

const dias = (a, b) => Math.round((new Date(`${String(b).slice(0, 10)}T12:00:00`) - new Date(`${String(a).slice(0, 10)}T12:00:00`)) / 86400000);
const nombreCorto = (s) => { const p = norm(s).split(/\s+/).filter(Boolean); if (!p.length) return ''; const cap = (w) => w.charAt(0) + w.slice(1).toLowerCase(); return p.length >= 3 ? `${cap(p[0])} ${cap(p[p.length - 2])}` : p.map(cap).join(' '); };

/**
 * @param d  { perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, cuentaMes }
 * @returns  modelo para la escena
 */
export function construirModelo(d, hoy = new Date()) {
  const hoyIso = hoy.toISOString().slice(0, 10);
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const mesPrev = mes === 1 ? 12 : mes - 1, anioPrev = mes === 1 ? anio - 1 : anio;
  const cuentas = new Map((d.cuentas || []).map((c) => [c.cuenta, c]));

  // ── Oficina: equipo del dashboard + genéricos ──
  const items = d.agendaHoy || [];
  const personas = (d.perfiles || []).filter((p) => p.activo && p.tipo !== 'externo' && !/prueba/i.test(p.nombre || '')).map((p) => {
    const mios = items.filter((it) => it.propietario === p.user_id || (Array.isArray(it.responsables) && it.responsables.includes(p.user_id)));
    const abiertas = mios.filter((it) => it.estado === 'abierta' || it.estado === 'arrastrada');
    const enCurso = abiertas.find((it) => it.inicio_real);
    return { id: p.user_id, nombre: p.nombre || p.email, puesto: p.puesto || p.rol || '', rol: /millan|finanz/i.test(`${p.nombre} ${p.puesto}`) ? 'finanzas' : /karolina|comercial/i.test(`${p.nombre} ${p.puesto}`) ? 'comercial' : 'direccion',
      pendientes: abiertas.length, hechas: mios.filter((it) => it.estado === 'hecha').length, actividad: enCurso ? enCurso.titulo : abiertas[0]?.titulo || null, avatar: p.avatar_url || null };
  });
  const reuniones = (d.reunionesHoy || []).filter((r) => r.tipo !== 'viaje');
  const ahoraMin = hoy.getHours() * 60 + hoy.getMinutes();
  const reunionEnCurso = reuniones.find((r) => { const t = new Date(r.fecha); const ini = t.getHours() * 60 + t.getMinutes(); return ini <= ahoraMin && ahoraMin < ini + (N(r.duracion_min) || 60); }) || null;
  const oficina = { personas, genericos: 3, reuniones: reuniones.length, reunionEnCurso: reunionEnCurso ? { titulo: reunionEnCurso.titulo, cliente_key: reunionEnCurso.cliente_key } : null };

  // ── CEDIS ──
  const inv = (d.inventario || [])[0] || {};
  const cedis = { valor: N(inv.inv_actual), piezas: N(inv.inv_actual_piezas), dias: N(inv.dias_inv), skus: N(inv.skus_con_stock), racks: Math.max(3, Math.min(10, Math.round(N(inv.dias_inv) / 18))), actualizado: inv.actualizado || null };

  // ── Puerto: contenedores en camino o llegando ──
  const barcos = []; const tarimas = [];
  for (const c of d.contenedores || []) {
    if (/CONCLUIDO|CANCELADO/i.test(c.estatus || '')) continue;
    const arribo = c.arribo_cedis || null; const eta = c.eta_puerto || null;
    if (arribo && dias(hoyIso, arribo) < -3) continue; // llegó hace días: ya no se dibuja
    const inicio = c.etd || c.fin_produccion || c.fecha_emision || null;
    const fin = arribo || eta || null;
    let p = 0.5;
    if (inicio && fin) { const tot = Math.max(1, dias(inicio, fin)); p = Math.max(0.02, Math.min(0.98, dias(inicio, hoyIso) / tot)); }
    const llegaEnDias = fin ? dias(hoyIso, fin) : null;
    const reg = { id: c.contenedor, supplier: c.supplier, naviera: c.naviera || '', piezas: N(c.piezas), fob: N(c.fob_usd), eta: eta, arribo, llegaEnDias, progreso: p, estatus: c.estatus || '' };
    if (arribo && dias(hoyIso, arribo) <= 0) tarimas.push(reg); else barcos.push(reg);
  }
  barcos.sort((a, b) => b.progreso - a.progreso);
  const puerto = { barcos: barcos.slice(0, 12), tarimas: tarimas.slice(0, 8), totalPiezas: barcos.reduce((s, b) => s + b.piezas, 0), totalFob: barcos.reduce((s, b) => s + b.fob, 0) };

  // ── Distritos (ciudades) con tiendas por cuenta ──
  const porCiudad = new Map();
  const tienda = (ciudad, t) => { if (!porCiudad.has(ciudad)) porCiudad.set(ciudad, { ciudad, pos: posDe(CIUDADES[ciudad]), estado: CIUDADES[ciudad].estado, tiendas: [], vendedores: [] }); porCiudad.get(ciudad).tiendas.push(t); };
  const sucAgr = new Map(); // cuenta|sucursal → { actual, previo, estado }
  for (const r of d.sucursales || []) {
    const k = `${r.cuenta}|${r.sucursal}`; const o = sucAgr.get(k) || { cuenta: r.cuenta, sucursal: r.sucursal, actual: 0, previo: 0, estado: r.estado || null, vendedores: 0 };
    if (N(r.anio) === anio && N(r.mes) === mes) o.actual += N(r.importe);
    if (N(r.anio) === anioPrev && N(r.mes) === mesPrev) o.previo += N(r.importe);
    o.vendedores = Math.max(o.vendedores, N(r.vendedores));
    sucAgr.set(k, o);
  }
  const cuentasConSucursal = new Set();
  const virtuales = [];
  for (const s of sucAgr.values()) {
    if (s.actual + s.previo <= 0) continue;
    const c = ciudadDeSucursal(s.sucursal);
    const sede = SEDE_POR_CUENTA[s.cuenta] || 'GUADALAJARA';
    const nombreCuenta = cuentas.get(s.cuenta)?.nombre || s.cuenta;
    // Luz encendida = vendió este mes; los primeros 10 días del mes también cuenta el mes anterior (si no, la ciudad amanece apagada el día 1).
    const activa = s.actual > 0 || (hoy.getDate() <= 10 && s.previo > 0);
    const t = { cuenta: s.cuenta, nombreCuenta, sucursal: s.sucursal, importe: s.actual, previo: s.previo, vendio: activa, vendioMes: s.actual > 0, virtual: !!c?.virtual, vendedores: s.vendedores };
    cuentasConSucursal.add(s.cuenta);
    if (c?.virtual) { virtuales.push(t); tienda(sede, { ...t, sucursal: `${s.sucursal} (en línea)` }); continue; }
    tienda(c?.ciudad || sede, t);
  }
  // cuentas sin sucursal: una tienda en su sede
  for (const c of d.cuentas || []) {
    if (cuentasConSucursal.has(c.cuenta) || !c.tiene_sellout && !c.propio) continue;
    const m = (d.cuentaMes || []).filter((r) => r.cuenta === c.cuenta);
    const act = m.filter((r) => N(r.anio) === anio && N(r.mes) === mes).reduce((s, r) => s + N(r.importe), 0);
    const prev = m.filter((r) => N(r.anio) === anioPrev && N(r.mes) === mesPrev).reduce((s, r) => s + N(r.importe), 0);
    tienda(SEDE_POR_CUENTA[c.cuenta] || 'GUADALAJARA', { cuenta: c.cuenta, nombreCuenta: c.nombre, sucursal: 'Matriz', importe: act, previo: prev, vendio: act > 0 || (hoy.getDate() <= 10 && prev > 0), vendioMes: act > 0, virtual: false, vendedores: 0 });
  }
  // vendedores de los mayoristas → en la ciudad de su sucursal (o la sede de la cuenta)
  const vm = new Map();
  for (const r of d.vendedoresMayoristas || []) { if (N(r.anio) !== anio) continue; const k = `${r.cuenta}|${r.vendedor}`; const o = vm.get(k) || { cuenta: r.cuenta, nombre: r.vendedor, importe: 0, sucursal: r.sucursal || null, ultimoMes: 0 }; o.importe += N(r.importe); if (N(r.mes) >= o.ultimoMes && N(r.importe) > 0) { o.ultimoMes = N(r.mes); o.sucursal = r.sucursal || o.sucursal; } vm.set(k, o); }
  for (const v of vm.values()) {
    if (!v.nombre || /^(SIN|N\/?A|-)/i.test(v.nombre)) continue;
    const c = v.sucursal ? ciudadDeSucursal(v.sucursal) : null;
    const ciudad = (c && c.ciudad) || SEDE_POR_CUENTA[v.cuenta] || 'GUADALAJARA';
    if (!porCiudad.has(ciudad)) tienda(ciudad, { cuenta: v.cuenta, nombreCuenta: cuentas.get(v.cuenta)?.nombre || v.cuenta, sucursal: 'Matriz', importe: 0, previo: 0, vendio: false, virtual: false, vendedores: 0 });
    porCiudad.get(ciudad).vendedores.push({ nombre: nombreCorto(v.nombre), nombreCompleto: v.nombre, cuenta: v.cuenta, nombreCuenta: cuentas.get(v.cuenta)?.nombre || v.cuenta, importe: v.importe, activo: v.ultimoMes >= mesPrev });
  }
  // Cartera (propios): saldo vencido → bandera roja en su Matriz / primera tienda de la sede.
  const carteraPor = new Map((d.cartera || []).map((c) => [c.cliente, { vencido: N(c.saldo_vencido), saldo: N(c.saldo_actual), dso: N(c.dso), corte: c.fecha_corte }]));
  for (const [cuenta, c] of carteraPor) {
    const sede = SEDE_POR_CUENTA[cuenta] || 'GUADALAJARA';
    if (!porCiudad.has(sede)) continue;
    const t = porCiudad.get(sede).tiendas.find((x) => x.cuenta === cuenta); if (t) t.cartera = c;
  }
  // Clientes finales por estado → ciudad representativa (casitas junto a la manzana).
  const cfPor = new Map();
  for (const r of d.clientesFinales || []) { const est = norm(r.estado); if (!est || est === 'SIN ESTADO') continue; const ciudad = CIUDAD_POR_ESTADO[est]; if (!ciudad) continue; const o = cfPor.get(ciudad) || { n: 0, importe: 0, cuentas: new Set() }; o.n += 1; o.importe += N(r.importe); o.cuentas.add(r.cuenta); cfPor.set(ciudad, o); }
  for (const [ciudad, o] of cfPor) { if (!porCiudad.has(ciudad)) porCiudad.set(ciudad, { ciudad, pos: posDe(CIUDADES[ciudad]), estado: CIUDADES[ciudad].estado, tiendas: [], vendedores: [] }); porCiudad.get(ciudad).clientesFinales = { n: o.n, importe: o.importe, cuentas: [...o.cuentas] }; }
  const distritos = [...porCiudad.values()].map((dist) => {
    dist.tiendas.sort((a, b) => b.importe - a.importe);
    dist.vendedores.sort((a, b) => b.importe - a.importe); dist.vendedores = dist.vendedores.slice(0, 6);
    dist.vendio = dist.tiendas.some((t) => t.vendio);
    dist.importe = dist.tiendas.reduce((s, t) => s + t.importe, 0);
    dist.cuentas = [...new Set(dist.tiendas.map((t) => t.cuenta))];
    dist.casas = dist.clientesFinales ? Math.min(6, Math.max(1, Math.ceil(dist.clientesFinales.n / 60))) : 0;
    return dist;
  }).sort((a, b) => b.importe - a.importe);

  // ── Camiones: facturas recientes del CEDIS a la sede del cliente ──
  const camiones = (d.facturas || []).filter((f) => dias(f.fecha, hoyIso) <= 10).map((f) => {
    const cuenta = [...cuentas.values()].find((c) => c.erp_cliente && String(c.erp_cliente) === String(f.cliente_key)) || null;
    const key = cuenta?.cuenta || f.cliente_key;
    const ciudad = SEDE_POR_CUENTA[key] || 'CIUDAD DE MEXICO';
    const edad = dias(f.fecha, hoyIso);
    return { folio: f.folio, cliente: cuenta?.nombre || f.cliente_key, ciudad, monto: N(f.monto), piezas: N(f.piezas), fecha: f.fecha, progreso: Math.min(0.95, 0.1 + edad * 0.12) };
  }).sort((a, b) => b.monto - a.monto).slice(0, 14);
  for (const e of d.envios || []) {
    const salida = e.fecha_envio_erp || e.fecha_surtida; const entrega = e.fecha_entrega_erp || e.fecha_entregada;
    if (!salida || entrega) continue;
    const key = e.oc_clientes?.cliente_key || 'digitalife';
    const edad = dias(salida, hoyIso); if (edad > 20) continue;
    camiones.push({ folio: e.guia_rastreo ? `guía ${e.guia_rastreo}` : `envío OC ${e.oc_clientes?.numero_oc || ''}`.trim(), cliente: cuentas.get(key)?.nombre || key, ciudad: SEDE_POR_CUENTA[key] || 'CIUDAD DE MEXICO', monto: 0, piezas: 0, fecha: salida, progreso: Math.min(0.9, 0.15 + edad * 0.15), envio: true, paqueteria: e.paqueteria || null });
  }

  // ── Vendedores del ERP (equipo comercial): de la oficina a sus clientes ──
  const ve = new Map();
  for (const r of d.vendedoresErp || []) { if (N(r.anio) !== anio) continue; const o = ve.get(r.vendedor) || { nombre: r.vendedor, clientes: new Map(), total: 0 }; o.total += N(r.fact_neta); const c = o.clientes.get(r.cliente_key) || { cliente_key: r.cliente_key, nombre: r.cliente_nombre, fact: 0 }; c.fact += N(r.fact_neta); o.clientes.set(r.cliente_key, c); ve.set(r.vendedor, o); }
  const porErp = new Map([...cuentas.values()].filter((c) => c.erp_cliente).map((c) => [String(c.erp_cliente), c]));
  const vendedoresRuta = [...ve.values()].filter((v) => v.nombre && v.total > 0).sort((a, b) => b.total - a.total).slice(0, 10).map((v, i) => {
    const top = [...v.clientes.values()].sort((a, b) => b.fact - a.fact).slice(0, 3);
    const destinos = top.map((c) => { const cu = porErp.get(String(c.cliente_key)) || [...cuentas.values()].find((x) => norm(x.nombre) === norm(c.nombre)); const key = cu?.cuenta || null; return { cliente: c.nombre || c.cliente_key, ciudad: (key && SEDE_POR_CUENTA[key]) || 'CIUDAD DE MEXICO', fact: c.fact }; });
    return { nombre: nombreCorto(v.nombre), nombreCompleto: v.nombre, total: v.total, clientes: v.clientes.size, destinos, fase: i / 10 };
  });

  const clientesFinales = distritos.reduce((s, x) => s + (x.clientesFinales?.n || 0), 0);
  const kpis = { clientesFinales, cartera: [...carteraPor.entries()].map(([k, c]) => ({ cuenta: k, ...c })), tiendas: distritos.reduce((s, x) => s + x.tiendas.length, 0), tiendasVendieron: distritos.reduce((s, x) => s + x.tiendas.filter((t) => t.vendio).length, 0), ciudades: distritos.length, barcos: puerto.barcos.length, camiones: camiones.length, vendedores: vendedoresRuta.length, enLinea: virtuales.length };
  return { hoyIso, anio, mes, oficina, cedis, puerto, distritos, camiones, vendedoresRuta, kpis, origen: posDe(ORIGEN), puertoPos: posDe(CIUDADES.MANZANILLO) };
}
