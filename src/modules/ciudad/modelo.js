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
// `mapa` (3.90.12) es al revés: lo que cae dentro del campus (León, Querétaro, Morelia… quedan encima del CEDIS y el patio
// en la Vista Base) sólo se ve de lejos, con el zoom por arriba de DETALLE.mapa; su posición en el mapa no cambia.
// `pin` (Vista Mapa): más lejos que esto la etiqueta de cada ciudad cambia por su pin con tiendas activas y camiones llegando,
// y se oculta la capa `cerca` (3.90.17): lo que de tan lejos no se distingue (casitas de clientes finales, calle del distrito).
export const DETALLE = { gente: 50, fino: 65, mapa: 45, pin: 90 };
export const capasVisibles = (zoom) => ({ gente: !(zoom > DETALLE.gente), fino: !(zoom > DETALLE.fino), mapa: !(zoom <= DETALLE.mapa), cerca: !(zoom > DETALLE.pin) });
// Una pieza puede ir en varias capas ('fino+mapa'): se ve sólo si todas están visibles.
export const juntarCapas = (...cs) => [...new Set(cs.flatMap((c) => String(c || '').split('+')).filter(Boolean))].sort().join('+') || undefined;
export const capaVisible = (capas, detalle) => String(detalle || '').split('+').filter(Boolean).every((k) => capas?.[k] !== false);
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
// Límites del zoom (media altura visible). El máximo deja ver México completo aun en pantallas angostas (Vista Mapa, 3.90.x).
export const ZOOM_MIN = 8, ZOOM_MAX = 180;
export const zoomEnRango = (z) => Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Number.isFinite(z) ? z : ZOOM_MAX));
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
    banco: { x: x - 9, z: z - 18.5, ancho: 11, largo: 7 }, // tesorería (3.90.28): al norte del estacionamiento · x −14.5…−3.5, z −22…−15
    torre: { x: x + 4, z: z - 16.5, ancho: 6, largo: 6 }, // torre de pronóstico (3.90.29): al norte de la barda del CEDIS · x 1…7, z −19.5…−13.5
    bardas: [{ a: { x: x - .4, z: z - 10.7 }, b: { x: x + 32.7, z: z - 10.7 } }, { a: { x: x + 32.7, z: z - 10.7 }, b: { x: x + 32.7, z: avenidaZ - 1.8 } }],
    jardin: { x: x - 18.3, z: z + 1.5, ancho: 3.2, largo: 14 }, // x −19.9…−16.7
    faroles: Array.from({ length: 9 }, (_, i) => ({ x: x - 16 + i * 6, z: avenidaZ + 1.5 })).filter((f) => Math.abs(f.x - (x - 1)) > 1.5),
    // distrito GDL: su borde de arriba sobre la avenida y su borde izquierdo (con casitas, ~2.8 más) a la derecha de x + 2
    distritoGDL: (ancho = 0, largo = 0) => ({ x: x + 5 + (Number(ancho) || 0) / 2, z: avenidaZ + 2 + (Number(largo) || 0) / 2 }),
    // terreno del campus (oficina, estacionamiento, jardín, CEDIS, patio, bardas y la banqueta de los faroles) para saber qué
    // distritos reales le caen encima (3.90.12)
    caja: { x0: x - 20, x1: x + 33, z0: z - 23, z1: avenidaZ + 2 }, // z0 −23: incluye el banco
  };
}

// ¿El distrito { x, z } de ancho × largo (más las casitas, ~2.8 a la izquierda) cae sobre el campus o sobre el distrito GDL
// (otra caja { x0, x1, z0, z1 })? Esos van en la capa `mapa`: de cerca no se dibujan encima de la base.
export function encimaDelCampus(c, d, ancho = 0, largo = 0, gdl = null, margen = 1) {
  if (!c?.caja || !d || !Number.isFinite(d.x) || !Number.isFinite(d.z)) return false;
  const w = Number(ancho) || 0, l = Number(largo) || 0;
  const r = { x0: d.x - w / 2 - 2.8 - margen, x1: d.x + w / 2 + margen, z0: d.z - l / 2 - margen, z1: d.z + l / 2 + margen };
  const choca = (b) => !!b && r.x0 < b.x1 && b.x0 < r.x1 && r.z0 < b.z1 && b.z0 < r.z1;
  return choca(c.caja) || choca(gdl);
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
// Vista Mapa de México (etapa 2): las puntas del país (Tijuana, Mexicali, Juárez, Piedras Negras, Matamoros, Cancún,
// Tapachula, Los Cabos) encuadradas según el giro y el lienzo, para ver el país completo con todas sus ciudades.
export const EXTREMOS_MEXICO = [[32.53, -117.12], [32.72, -114.72], [31.75, -106.48], [28.7, -100.52], [25.87, -97.5], [21.16, -86.85], [14.9, -92.26], [22.89, -109.91]].map(([lat, lon]) => ({ lat, lon }));
// Pin de cada ciudad en la Vista Mapa: tiendas activas (físicas; las virtuales no son un lugar) y camiones que van hacia ella.
export function pinCiudad(distrito, camiones = []) {
  const nombre = distrito?.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : String(distrito?.ciudad || '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
  const activas = (distrito?.tiendas || []).filter((t) => t.vendio && !t.virtual).length;
  const llegando = (camiones || []).filter((c) => c && c.ciudad === distrito?.ciudad).length;
  return { activas, llegando, texto: [nombre, `🏬 ${activas}`, llegando ? `🚚 ${llegando}` : null].filter(Boolean).join(' · ') };
}
// Acceso rápido (minimapa, paso 1): las n ciudades con más actividad = tiendas activas + camiones llegando (empate: más tiendas).
export function ciudadesTop(modelo, n = 5) {
  const ds = modelo?.distritos || [];
  return ds.map((d) => { const p = pinCiudad(d, modelo?.camiones); return { ciudad: d.ciudad, nombre: p.texto.split(' · ')[0], activas: p.activas, llegando: p.llegando, actividad: p.activas + p.llegando, tiendas: (d.tiendas || []).length }; })
    .filter((c) => c.ciudad && c.actividad > 0).sort((x, y) => y.actividad - x.actividad || y.tiendas - x.tiendas).slice(0, n);
}
// Botón único Base/Mapa: estás «en la base» si la cámara está cerca del encuadre de la Vista Base (centro a menos de medio
// encuadre y zoom no más de 1.5× el de la base); si no, estás lejos y el botón ofrece volver. Sin datos cuenta como base.
export function enLaBase(v, b) { if (!v || !b || !Number.isFinite(v.zoom) || !Number.isFinite(b.zoom)) return true; return Math.hypot(v.cx - b.cx, v.cz - b.cz) <= b.zoom * 0.5 && v.zoom <= b.zoom * 1.5; }
// Viajar (3.90.16): Vista Ciudad = encuadre de las manzanas de un distrito ({ x, z, ancho, largo }) con la calle de enfrente;
// el zoom no pasa de DETALLE.gente para que de cerca se vean la gente y las tiendas.
export function vistaCiudad(caja, { ang = Math.PI / 4, aspecto = 1.6 } = {}) {
  if (!caja || !Number.isFinite(caja.x) || !Number.isFinite(caja.z)) return null;
  const w = Number.isFinite(caja.ancho) && caja.ancho > 0 ? caja.ancho : 8, l = Number.isFinite(caja.largo) && caja.largo > 0 ? caja.largo : 8;
  const esq = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: caja.x + a * w / 2, z: caja.z + b * l / 2 + (b > 0 ? 2 : 0), r: 2 }));
  return encuadre(esq, { ang, aspecto, margen: 1.2, min: 14, max: DETALLE.gente - 5 });
}
// Nivel para el botón: 'base' (campus), 'ciudad' (cerca de la ciudad a la que viajaste) o 'lejos' (mapa o en medio).
export function nivelVista(v, base, ciudad = null) {
  if (enLaBase(v, base)) return 'base';
  if (ciudad && Number.isFinite(ciudad.zoom) && enLaBase(v, ciudad)) return 'ciudad';
  return 'lejos';
}
// Minimapa (paso 2): plano chico norte arriba de ancho × alto px con el contorno EXTREMOS_MEXICO, un punto por ciudad y el
// paso escena ↔ plano. aSvg(x, z) → { u, v }; aEscena(u, v) → { x, z }; marco(vista) = { u, v, r } del marcador de la cámara;
// cercana(u, v, maxPx) = la ciudad más cerca del toque (o null si ninguna queda a menos de maxPx).
export function planoMini(distritos = [], { ancho = 150, alto = 96, margen = 6 } = {}) {
  const pts = EXTREMOS_MEXICO.map(posDe);
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x)), z0 = Math.min(...pts.map((p) => p.z)), z1 = Math.max(...pts.map((p) => p.z));
  const s = Math.min((ancho - 2 * margen) / (x1 - x0), (alto - 2 * margen) / (z1 - z0));
  const ox = (ancho - (x1 - x0) * s) / 2, oz = (alto - (z1 - z0) * s) / 2;
  const aSvg = (x, z) => ({ u: ox + (x - x0) * s, v: oz + (z - z0) * s });
  const aEscena = (u, v) => ({ x: x0 + (u - ox) / s, z: z0 + (v - oz) / s });
  const r1 = (n) => Math.round(n * 10) / 10;
  const contorno = pts.map((p) => { const q = aSvg(p.x, p.z); return `${r1(q.u)},${r1(q.v)}`; }).join(' ');
  const puntos = (distritos || []).filter((d) => d?.ciudad && Number.isFinite(d?.pos?.x) && Number.isFinite(d?.pos?.z)).map((d) => { const q = aSvg(d.pos.x, d.pos.z); return { ciudad: d.ciudad, u: r1(q.u), v: r1(q.v) }; });
  const marco = (vista) => { if (!vista || !Number.isFinite(vista.cx) || !Number.isFinite(vista.cz)) return null; const q = aSvg(vista.cx, vista.cz); return { u: r1(Math.max(0, Math.min(ancho, q.u))), v: r1(Math.max(0, Math.min(alto, q.v))), r: r1(Math.max(3, Math.min(alto / 2, (Number.isFinite(vista.zoom) ? vista.zoom : 0) * s))) }; };
  const cercana = (u, v, maxPx = 8) => { let mejor = null, dm = maxPx; for (const p of puntos) { const dd = Math.hypot(p.u - u, p.v - v); if (dd <= dm) { dm = dd; mejor = p.ciudad; } } return mejor; };
  return { ancho, alto, contorno, puntos, aSvg, aEscena, marco, cercana };
}
// Última vista por usuario (localStorage): clave por user_id y lectura tolerante. leerVista(texto) → { cx, cz, zoom } o null si
// el texto no es JSON, faltan números o el centro cae fuera de México (con un margen); el zoom se acota a [ZOOM_MIN, ZOOM_MAX].
export const claveVista = (userId) => `acteck.ciudad.vista.${userId || 'anon'}`;
export function leerVista(texto) {
  let v; try { v = JSON.parse(texto); } catch { return null; }
  if (!v || !Number.isFinite(v.cx) || !Number.isFinite(v.cz) || !Number.isFinite(v.zoom)) return null;
  const pts = EXTREMOS_MEXICO.map(posDe), m = 40;
  if (v.cx < Math.min(...pts.map((p) => p.x)) - m || v.cx > Math.max(...pts.map((p) => p.x)) + m || v.cz < Math.min(...pts.map((p) => p.z)) - m || v.cz > Math.max(...pts.map((p) => p.z)) + m) return null;
  return { cx: v.cx, cz: v.cz, zoom: zoomEnRango(v.zoom) };
}
/** Banco/tesorería (3.90.28): cartera vencida de los propios (`v_vision_cartera_consolidada`, la misma de la Matriz) y pagos
 *  abiertos de Pagos V3 que vencen en 7 días o ya vencieron, con las MISMAS reglas de la bandeja (`venceEn`/`estaVencido` de
 *  `comercial/pagosv3/estados.js`, que `datos.js` pasa en `reglas` para que este archivo siga sin imports); sin reglas, no cuenta pagos. */
export function resumenBanco(cartera = [], pagos = [], hoyIso = new Date().toISOString().slice(0, 10), reglas = null) {
  const conVencido = (cartera || []).filter((c) => N(c.vencido) > 0);
  const abiertos = reglas?.venceEn && reglas?.estaVencido ? (pagos || []).filter((p) => p && p.estado !== 'rechazado') : [];
  const semana = abiertos.filter((p) => reglas.venceEn(p, 7, hoyIso)), vencidos = abiertos.filter((p) => reglas.estaVencido(p, hoyIso));
  return { carteraVencida: conVencido.reduce((s, c) => s + N(c.vencido), 0), cuentasVencidas: conVencido.length, pagosSemana: semana.length, montoSemana: semana.reduce((s, p) => s + N(p.monto), 0), pagosVencidos: vencidos.length, montoVencido: vencidos.reduce((s, p) => s + N(p.monto), 0) };
}

/** Torre de pronóstico (3.90.29): propuestas de forecast no borrador (`forecast_propuestas` + líneas, como Proyectos y forecast)
 *  y avisos de arribo (`forecast_avisos`) de ayer a 7 días. Un aviso con fecha ya pasada = atrasado. */
export function resumenTorre(propuestas = [], avisos = [], hoyIso = new Date().toISOString().slice(0, 10)) {
  const ps = (propuestas || []).filter((p) => p && p.estatus !== 'borrador'); const lineas = ps.flatMap((p) => p.forecast_propuesta_lineas || []);
  const mas7 = new Date(new Date(`${hoyIso}T00:00:00Z`).getTime() + 7 * 86400000).toISOString().slice(0, 10);
  const av = (avisos || []).filter((a) => a?.fecha_arribo && String(a.fecha_arribo).slice(0, 10) <= mas7);
  const atrasados = av.filter((a) => String(a.fecha_arribo).slice(0, 10) < hoyIso);
  return { abiertas: ps.filter((p) => !p.cerrado_at).length, lineas: lineas.length, confirmadas: lineas.filter((l) => l.confirmado).length, compradas: lineas.filter((l) => l.comprado_at).length, arribos7: av.length - atrasados.length, piezas7: av.reduce((s, a) => s + N(a.piezas_a_reservar), 0), atrasados: atrasados.length };
}

// «Hoy en Acteck» (etapa 4, 3.90.46): misiones del día para la lista con «Ir». Junta las alertas de las burbujas (banco,
// puerto, CEDIS), las reuniones de hoy (en curso / próximas; las hechas quedan al final con ✓) y los contenedores que se
// están descargando. Cada misión trae `ir` (a dónde vuela la cámara) y `tarjeta` (qué tarjeta abre). Rojo, ámbar, luego por hora.
export function misionesDelDia(m, hoy = new Date(), max = 8) {
  if (!m) return [];
  const out = [];
  for (const b of burbujasAtencion(m, hoy)) if (b.lugar !== 'oficina') out.push({ id: `alerta-${b.lugar}`, icono: b.icono, nivel: b.nivel, texto: b.texto, ir: b.tag, tarjeta: b.tag, orden: 0 });
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  for (const r of m.oficina?.agenda || []) {
    const hecha = r.estado === 'hecha', falta = r.ini - ahora;
    out.push({ id: `reunion-${r.hora}-${r.titulo}`, icono: '📅', nivel: r.estado === 'en curso' || (falta >= 0 && falta <= 15) ? 'ambar' : null, hecha,
      texto: `${r.hora} · ${r.titulo}${r.estado === 'en curso' ? ' · ahora' : !hecha && falta <= 15 ? ` · en ${falta} min` : ''}`, ir: { tipo: 'oficina' }, tarjeta: { tipo: 'sala', titulo: 'Sala de juntas', sub: 'Reuniones de hoy' }, orden: r.ini });
  }
  for (const t of m.puerto?.tarimas || []) out.push({ id: `tarima-${t.id}`, icono: '📦', nivel: null, texto: `Descargar ${t.id} · ${(Number(t.piezas) || 0).toLocaleString('es-MX')} pz`, ir: { tipo: 'cedis' }, tarjeta: { tipo: 'barco', id: t.id, titulo: `Contenedor ${t.id}` }, orden: 24 * 60 });
  const peso = (x) => (x.hecha ? 3 : x.nivel === 'rojo' ? 0 : x.nivel === 'ambar' ? 1 : 2);
  return out.sort((a, c) => peso(a) - peso(c) || a.orden - c.orden).slice(0, max).map(({ orden, ...x }) => ({ hecha: false, ...x }));
}

// Cuentas sin sucursal repartidas por estado (etapa 5, 3.90.56): con su sell out a clientes finales por estado
// (`mv_sellout_cliente_final_mes`: cuenta, anio, mes, estado, importe) → una tienda «Clientes en <ciudad>» por ciudad
// representativa del estado (`CIUDAD_POR_ESTADO`), sin la `sede` (ahí ya está su Matriz), top `max` por actividad.
export function repartoPorEstado(cuenta, filas = [], { anio, mes, anioPrev, mesPrev, sede = null, max = 6 } = {}) {
  const por = new Map();
  for (const r of filas || []) {
    if (r?.cuenta !== cuenta) continue; const est = norm(r.estado);
    const ciudad = CIUDAD_POR_ESTADO[est]; if (!ciudad || ciudad === sede) continue;
    const a = Number(r.anio), ms = Number(r.mes), imp = Number(r.importe) || 0; const o = por.get(ciudad) || { ciudad, importe: 0, previo: 0 };
    if (a === anio && ms === mes) o.importe += imp; else if (a === anioPrev && ms === mesPrev) o.previo += imp; else continue;
    por.set(ciudad, o);
  }
  return [...por.values()].filter((o) => o.importe > 0 || o.previo > 0).sort((a, c) => (c.importe + c.previo) - (a.importe + a.previo) || (a.ciudad < c.ciudad ? -1 : 1)).slice(0, max);
}

// Barcos por ETA real (etapa 5, 3.90.55): dónde va cada barco sin arribo al CEDIS. ETA vencida o de hoy → en el puerto:
// el más atrasado atraca y descarga (`muelle` 0), los demás esperan en fila (`muelle` 1, 2…); llega en ≤ 7 días → se
// acerca (`avance` = 1 − días/8); más lejos o sin ETA → mar abierto (`avance` ≤ .6, con el progreso de sus fechas).
export function rumboBarcos(barcos = []) {
  const enPuerto = (barcos || []).map((b, i) => ({ b, i })).filter(({ b }) => !b?.arribo && b?.llegaEnDias != null && b.llegaEnDias <= 0).sort((a, c) => a.b.llegaEnDias - c.b.llegaEnDias || a.i - c.i);
  const fila = new Map(enPuerto.map(({ i }, k) => [i, k]));
  return (barcos || []).map((b, i) => {
    if (fila.has(i)) { const k = fila.get(i); return { modo: k === 0 ? 'atracado' : 'esperando', muelle: k, avance: 1 }; }
    const d = b?.llegaEnDias;
    if (!b?.arribo && d != null && d > 0 && d <= 7) return { modo: 'llegando', muelle: null, avance: Math.round((1 - d / 8) * 1000) / 1000 };
    return { modo: 'navegando', muelle: null, avance: Math.min(.6, Math.max(0, Number(b?.progreso) || 0)) };
  });
}

// Cadena de punta a punta (etapa 5, 3.90.58, como Anno 1800 / Factorio): mar → puerto → CEDIS → camiones → tiendas →
// clientes finales, con el volumen de cada tramo y su tono; `atasco` = el primer tramo en rojo (o ámbar si no hay rojo).
// Sólo usa lo que ya trae el modelo (mismos umbrales que las tarjetas: CEDIS 90/120 días, envío > 5 días en ámbar).
export function cadenaSuministro(m, hoyIso = m?.hoyIso) {
  if (!m) return { tramos: [], atasco: null };
  const n = (v) => Number(v) || 0; const pz = (v) => `${Math.round(n(v)).toLocaleString('es-MX')} pzs`;
  const barcos = m.puerto?.barcos || [];
  const mar = barcos.filter((b) => !(b.llegaEnDias != null && b.llegaEnDias <= 0)), enPuerto = barcos.filter((b) => b.llegaEnDias != null && b.llegaEnDias <= 0);
  const tarde = enPuerto.filter((b) => b.llegaEnDias < -3).length;
  const c = m.cedis || {}, d = n(c.dias);
  const cam = m.camiones || [];
  const lentos = cam.filter((x) => x.envio && hoyIso && x.fecha && dias(x.fecha, hoyIso) > 5).length;
  const tiendas = (m.distritos || []).flatMap((x) => x.tiendas || []).filter((t) => !t.reparto);
  const activas = tiendas.filter((t) => t.vendio).length, ratio = tiendas.length ? activas / tiendas.length : 1;
  const cf = (m.distritos || []).reduce((s, x) => ({ n: s.n + n(x.clientesFinales?.n), imp: s.imp + n(x.clientesFinales?.importe) }), { n: 0, imp: 0 });
  const tramos = [
    { clave: 'mar', titulo: 'En el mar', icono: '🚢', volumen: `${mar.length} barcos · ${pz(mar.reduce((s, b) => s + n(b.piezas), 0))}`, estado: mar.length ? 'verde' : 'gris', motivo: null },
    { clave: 'puerto', titulo: 'Puerto', icono: '⚓', volumen: `${enPuerto.length} con ETA vencida · ${(m.puerto?.tarimas || []).length} recién llegados`, estado: tarde ? 'rojo' : enPuerto.length ? 'ambar' : 'verde', motivo: tarde ? `${tarde} barco${tarde === 1 ? '' : 's'} con más de 3 días de atraso` : enPuerto.length ? 'Barcos esperando muelle' : null },
    { clave: 'cedis', titulo: 'CEDIS', icono: '🏭', volumen: `${pz(c.piezas)} · ${Math.round(d)} días`, estado: d > 120 ? 'rojo' : d > 90 ? 'ambar' : 'verde', motivo: d > 90 ? `${Math.round(d)} días de inventario` : null },
    { clave: 'camion', titulo: 'Camiones', icono: '🚚', volumen: `${cam.length} en ruta · ${pz(cam.reduce((s, x) => s + n(x.piezas), 0))}`, estado: lentos ? 'ambar' : cam.length ? 'verde' : 'gris', motivo: lentos ? `${lentos} envío${lentos === 1 ? '' : 's'} con más de 5 días en camino` : null },
    { clave: 'tienda', titulo: 'Tiendas', icono: '🏬', volumen: `${activas} de ${tiendas.length} vendieron`, estado: !tiendas.length ? 'gris' : ratio < 0.4 ? 'rojo' : ratio < 0.7 ? 'ambar' : 'verde', motivo: tiendas.length && ratio < 0.7 ? `${tiendas.length - activas} tiendas sin venta este mes` : null },
    { clave: 'cliente', titulo: 'Clientes finales', icono: '🏠', volumen: `${cf.n.toLocaleString('es-MX')} · ${pesosCorto(cf.imp)}`, estado: cf.n ? 'verde' : 'gris', motivo: null },
  ];
  return { tramos, atasco: tramos.find((t) => t.estado === 'rojo') || tramos.find((t) => t.estado === 'ambar') || null };
}
// Cintas de la cadena en la escena (3.90.59): mar → puerto → CEDIS y CEDIS → las `max` ciudades con más camiones o tiendas.
// `peso` 1–4 (grosor) por volumen relativo; tono del tramo (ciudad: tiendas sin venta como en la tira, ámbar si le va un envío lento).
export function cintasCadena(m, max = 8) {
  const cad = cadenaSuministro(m); if (!cad.tramos.length) return [];
  const est = Object.fromEntries(cad.tramos.map((t) => [t.clave, t.estado]));
  const peso = (v, tope) => (tope > 0 ? 1 + Math.round(3 * Math.min(1, v / tope)) : 1);
  const barcos = (m.puerto?.barcos || []).length;
  const out = [{ de: 'mar', a: 'puerto', tono: est.puerto === 'rojo' ? 'rojo' : est.mar, peso: peso(barcos, 8) }, { de: 'puerto', a: 'cedis', tono: est.puerto, peso: peso(barcos + (m.puerto?.tarimas || []).length, 8) }];
  const cam = new Map(); for (const c of m.camiones || []) { const o = cam.get(c.ciudad) || { n: 0, lento: false }; o.n += 1; if (c.envio && m.hoyIso && c.fecha && dias(c.fecha, m.hoyIso) > 5) o.lento = true; cam.set(c.ciudad, o); }
  const ciudades = (m.distritos || []).map((d) => { const ts = (d.tiendas || []).filter((t) => !t.reparto); const r = ts.length ? ts.filter((t) => t.vendio).length / ts.length : 1; const c = cam.get(d.ciudad) || { n: 0, lento: false };
    return { ciudad: d.ciudad, n: c.n, tiendas: ts.length, tono: ts.length && r < 0.4 ? 'rojo' : c.lento || (ts.length && r < 0.7) ? 'ambar' : c.n || ts.length ? 'verde' : 'gris' }; })
    .filter((x) => x.n || x.tiendas).sort((a, b) => b.n - a.n || b.tiendas - a.tiendas).slice(0, max);
  const tope = Math.max(1, ...ciudades.map((x) => x.n));
  for (const x of ciudades) out.push({ de: 'cedis', a: x.ciudad, tono: x.tono, peso: peso(x.n, tope) });
  return out;
}

// Rutas de vendedores (etapa 5, 3.90.53): el circuito del vendedor por las sedes de sus clientes principales — ciudades
// únicas con carretera (`tieneRuta`), máximo `max`, en el orden de `destinos` (de más a menos facturación). tramoActual()
// reparte un ciclo (0–1) en tramos iguales: CEDIS → 1.ª sede → … → última sede → CEDIS (n paradas = n + 1 tramos).
export function circuitoVendedor(destinos = [], tieneRuta = () => true, max = 3) {
  const out = []; const vistas = new Set();
  for (const d of destinos || []) { if (!d?.ciudad || vistas.has(d.ciudad) || !tieneRuta(d.ciudad)) continue; vistas.add(d.ciudad); out.push(d); if (out.length >= max) break; }
  return out;
}
export function tramoActual(ciclo, paradas) {
  const n = Math.max(1, paradas) + 1; const c = ((Number(ciclo) % 1) + 1) % 1; const i = Math.min(n - 1, Math.floor(c * n));
  return { i, q: c * n - i, tramos: n };
}

// Pensamientos (etapa 4, paso 1, 3.90.52), como RollerCoaster Tycoon: frases cortas en primera persona sobre tiendas con
// reglas del modelo (no por tamaño: se mira la tendencia). Una por ciudad como máximo y `max` en total; primero lo que pide
// atención (rojo), luego lo bueno. Reglas: cuenta con cartera vencida → «Tengo pagos vencidos»; la tienda vendió el mes
// anterior y éste no → «Este mes no he vendido nada»; cae > 30 % → «Vendo N % menos que el mes pasado»; sube > 30 % →
// «¡Voy N % arriba del mes pasado!»; cuenta al ritmo de su cuota (`m.cuotas`) → «Voy arriba de mi cuota».
export function pensamientos(m, max = 5) {
  if (!m) return [];
  const venc = new Set((m.kpis?.cartera || []).filter((c) => Number(c.vencido) > 0).map((c) => c.cuenta));
  const q = m.cuotas instanceof Map ? m.cuotas : new Map(); const h = m.hoyIso ? new Date(`${m.hoyIso}T12:00:00`) : new Date();
  const ritmo = h.getDate() / new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
  const out = [];
  for (const d of m.distritos || []) {
    let mejor = null;
    for (const t of d.tiendas || []) {
      if (t.reparto) continue; // «Clientes en …» (3.90.56) no es una tienda que piense
      const act = Number(t.importe) || 0, prev = Number(t.previo) || 0, cambio = prev > 0 ? Math.round((act / prev - 1) * 100) : null, cu = q.get(t.cuenta);
      const quien = { ciudad: d.ciudad, cuenta: t.cuenta, sucursal: t.sucursal, nombre: `${t.nombreCuenta || t.cuenta} · ${t.sucursal}` };
      let p = null;
      if (venc.has(t.cuenta)) p = { tono: 'rojo', peso: 0, texto: 'Tengo pagos vencidos' };
      else if (prev > 0 && act <= 0) p = { tono: 'rojo', peso: 1, texto: 'Este mes no he vendido nada' };
      else if (cambio != null && cambio < -30) p = { tono: 'ambar', peso: 2, texto: `Vendo ${-cambio} % menos que el mes pasado` };
      else if (cambio != null && cambio > 30) p = { tono: 'verde', peso: 3, texto: `¡Voy ${cambio} % arriba del mes pasado!` };
      else if (cu?.cuota > 0 && cu.venta / cu.cuota >= ritmo) p = { tono: 'verde', peso: 4, texto: 'Voy arriba de mi cuota' };
      if (p && (!mejor || p.peso < mejor.peso)) mejor = { ...quien, ...p };
    }
    if (mejor) out.push(mejor);
  }
  return out.sort((a, c) => a.peso - c.peso).slice(0, max).map(({ peso, ...x }) => x);
}

// Bitácora en vivo (etapa 4, paso 1, 3.90.50): eventos recientes con lo que ya trae el modelo — facturas que salieron
// (camiones), envíos surtidos del Tracking, contenedores que llegaron al CEDIS y reuniones de hoy que ya empezaron. Lo más
// nuevo primero; cada uno con `cuando` (hoy / ayer / hace N d, o la hora) e `ir` para volar al lugar.
export function bitacoraEventos(m, hoy = new Date(), max = 12) {
  if (!m) return [];
  const pesos = (v) => { const n = Number(v) || 0; return n >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} K` : `$${Math.round(n)}`; };
  const hoyIso = m.hoyIso || `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const diasAtras = (f) => Math.round((new Date(`${hoyIso}T12:00:00`) - new Date(`${String(f).slice(0, 10)}T12:00:00`)) / 86400000);
  const cuando = (f) => { const n = diasAtras(f); return n <= 0 ? 'hoy' : n === 1 ? 'ayer' : `hace ${n} d`; };
  const out = [];
  for (const c of m.camiones || []) {
    if (!c?.fecha) continue; const f = String(c.fecha).slice(0, 10); if (f > hoyIso) continue;
    out.push(c.envio
      ? { id: `envio-${c.folio}`, icono: '🚚', texto: `Salió ${c.folio} a ${c.cliente}${c.paqueteria ? ` · ${c.paqueteria}` : ''}`, clave: `${f} 00:01`, cuando: cuando(f), ir: { tipo: 'ciudad', ciudad: c.ciudad } }
      : { id: `factura-${c.folio}`, icono: '🧾', texto: `Factura ${c.folio} · ${c.cliente} · ${pesos(c.monto)}`, clave: `${f} 00:01`, cuando: cuando(f), grande: Number(c.monto) >= 500000, ir: { tipo: 'ciudad', ciudad: c.ciudad } });
  }
  for (const b of [...(m.puerto?.tarimas || []), ...(m.puerto?.barcos || [])]) {
    if (!b?.arribo) continue; const f = String(b.arribo).slice(0, 10); if (f > hoyIso) continue;
    out.push({ id: `arribo-${b.id}`, icono: '📦', texto: `Llegó ${b.id} al CEDIS · ${(Number(b.piezas) || 0).toLocaleString('es-MX')} pz`, clave: `${f} 00:00`, cuando: cuando(f), ir: { tipo: 'cedis' }, tarjeta: { tipo: 'barco', id: b.id, titulo: `Contenedor ${b.id}` } });
  }
  // Paso 2 (3.90.51): pagos registrados (Pagos V3, `pagado_at` de los últimos días) y la última sincronización del puente.
  const fechaHora = (ts) => { const t = new Date(ts); if (Number.isNaN(t.getTime())) return null; const p2 = (n) => String(n).padStart(2, '0'); return { f: `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`, h: `${p2(t.getHours())}:${p2(t.getMinutes())}` }; };
  for (const p of m.pagosHechos || []) {
    const fh = p?.pagado_at ? fechaHora(p.pagado_at) : null; if (!fh || fh.f > hoyIso) continue;
    out.push({ id: `pago-${p.id ?? `${p.pagado_at}-${p.cliente}`}`, icono: '💸', texto: `Pago registrado${p.cliente ? ` · ${p.cliente}` : ''}${p.concepto ? ` · ${p.concepto}` : ''} · ${pesos(p.monto)}`, clave: `${fh.f} ${fh.h}`, cuando: fh.f === hoyIso ? fh.h : cuando(fh.f), grande: Number(p.monto) >= 500000, ir: { tipo: 'banco' }, tarjeta: { tipo: 'banco' } });
  }
  const sy = m.ultimaSync?.created_at ? fechaHora(m.ultimaSync.created_at) : null;
  if (sy && sy.f <= hoyIso) out.push({ id: 'sync', icono: '🔄', texto: `Se actualizaron los datos${m.ultimaSync.status ? ` · ${m.ultimaSync.status}` : ''}`, clave: `${sy.f} ${sy.h}`, cuando: sy.f === hoyIso ? sy.h : cuando(sy.f), ir: null });
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  for (const r of m.oficina?.agenda || []) if (r.ini <= ahora) out.push({ id: `reunion-${r.hora}-${r.titulo}`, icono: '📅', texto: `${r.estado === 'en curso' ? 'Empezó' : 'Fue'} ${r.titulo}`, clave: `${hoyIso} ${r.hora}`, cuando: r.hora, ir: { tipo: 'oficina' }, tarjeta: { tipo: 'sala', titulo: 'Sala de juntas', sub: 'Reuniones de hoy' } });
  const vistos = new Set();
  return out.sort((a, c) => (a.clave < c.clave ? 1 : a.clave > c.clave ? -1 : 0)).filter((x) => !vistos.has(x.id) && vistos.add(x.id)).slice(0, max).map(({ clave, ...x }) => ({ grande: false, tarjeta: null, ir: null, ...x }));
}

// Celebraciones (etapa 6, 3.90.62): `cuota` = { pct } si el total de las cuentas con cuota (`m.cuotas`) ya cruzó el 100 % del mes
// (fuegos artificiales sobre la base); `tiendas` = las que vendieron este mes sin haber vendido el mes anterior (≈ 30 días o más
// sin venta y volvieron; confeti), sin las de reparto, de mayor a menor venta, máximo `max`.
export function celebraciones(m, max = 5) {
  const q = m?.cuotas instanceof Map ? [...m.cuotas.values()] : [];
  const venta = q.reduce((s, x) => s + (Number(x.venta) || 0), 0), cuo = q.reduce((s, x) => s + (Number(x.cuota) || 0), 0);
  const tiendas = (m?.distritos || []).flatMap((d) => (d.tiendas || []).filter((t) => !t.reparto && t.vendioMes && !(Number(t.previo) > 0)).map((t) => ({ ciudad: d.ciudad, cuenta: t.cuenta, sucursal: t.sucursal, importe: Number(t.importe) || 0 })))
    .sort((a, b) => b.importe - a.importe).slice(0, max);
  return { cuota: cuo > 0 && venta >= cuo ? { pct: Math.round(venta / cuo * 100) } : null, tiendas };
}

// Cuota vs ritmo de un grupo de cuentas (3.90.60; la usan la capa «Cuota» y las tarjetas de ciudad y tienda): venta ÷ cuota
// del mes de las cuentas con cuota (sumadas, el % se saca al final) contra el ritmo esperado al día de hoy. null = ninguna tiene cuota.
export function cuotaRitmo(m, cuentas = []) {
  const q = m?.cuotas instanceof Map ? m.cuotas : new Map(); const h = m?.hoyIso ? new Date(`${m.hoyIso}T12:00:00`) : new Date();
  const ritmo = h.getDate() / new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
  const cs = [...new Set(cuentas || [])].filter((c) => q.get(c)?.cuota > 0); if (!cs.length) return null;
  const venta = cs.reduce((s, c) => s + q.get(c).venta, 0), cuo = cs.reduce((s, c) => s + q.get(c).cuota, 0), pct = Math.round(venta / cuo * 100), r = pct / 100 / ritmo;
  return { tono: r >= 1 ? 'verde' : r >= 0.8 ? 'ambar' : 'rojo', pct, ritmo: Math.round(ritmo * 100), n: cs.length, venta, cuota: cuo };
}

// Cuota por cuenta (capa «Cuota», 3.90.49): filas de `v_cuota_erp_mes` del mes (cliente_erp, cuenta_sellout, cuota_venta) y
// de `mv_analisis_cliente_mes` del mes (cliente = código ERP, fact_neta), las mismas de Análisis → Map(cuenta → { venta, cuota }).
// La venta se suma sólo de los clientes ERP con cuota (su cuenta sale de la fila de cuota); el % se saca al agregar, nunca se suma.
export function cuotasPorCuenta(cuotas = [], ventas = []) {
  const cuentaDe = new Map(); const out = new Map();
  for (const r of cuotas || []) {
    if (!r?.cuenta_sellout) continue; const k = String(r.cliente_erp ?? ''); if (k) cuentaDe.set(k, r.cuenta_sellout);
    const o = out.get(r.cuenta_sellout) || { venta: 0, cuota: 0 }; o.cuota += Number(r.cuota_venta) || 0; out.set(r.cuenta_sellout, o);
  }
  for (const v of ventas || []) { const c = cuentaDe.get(String(v?.cliente ?? '')); if (c) out.get(c).venta += Number(v.fact_neta) || 0; }
  return out;
}

// Capas de información (etapa 4, paso 1, 3.90.47): color por ciudad para una capa, sin escalar por tamaño (se pinta la
// tendencia o el estado, no quién es más grande). 'ventas' = sell out del mes vs mes anterior (mismas filas que las tiendas:
// `importe` / `previo`); 'cartera' = cuentas con cartera vencida entre las tiendas de la ciudad (`kpis.cartera`). Devuelve
// { capa, titulo, leyenda: [{ tono, texto }], porCiudad: Map(ciudad → { tono, valor, texto }) }. Capa desconocida → null.
export const CAPA_TONOS = { verde: 0x34c759, ambar: 0xff9f0a, rojo: 0xff3b30, gris: 0x8e8e93 };
export function capaCiudades(m, capa) {
  if (!m || !['ventas', 'cartera', 'cuota'].includes(capa)) return null;
  const pesos = (v) => { const n = Number(v) || 0; return n >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} K` : `$${Math.round(n)}`; };
  const porCiudad = new Map();
  if (capa === 'ventas') {
    for (const d of m.distritos || []) {
      const act = (d.tiendas || []).reduce((s, t) => s + (Number(t.importe) || 0), 0), prev = (d.tiendas || []).reduce((s, t) => s + (Number(t.previo) || 0), 0);
      const pct = prev > 0 ? Math.round((act / prev - 1) * 100) : null;
      const tono = pct == null ? (act > 0 ? 'verde' : 'gris') : pct >= 0 ? 'verde' : pct >= -20 ? 'ambar' : 'rojo';
      porCiudad.set(d.ciudad, { tono, valor: pct, texto: `${pesos(act)}${pct == null ? '' : ` · ${pct > 0 ? '+' : ''}${pct} % vs mes anterior`}` });
    }
    return { capa, titulo: 'Sell out vs mes anterior', leyenda: [{ tono: 'verde', texto: 'Igual o arriba' }, { tono: 'ambar', texto: 'Hasta −20 %' }, { tono: 'rojo', texto: 'Más de −20 %' }, { tono: 'gris', texto: 'Sin venta' }], porCiudad };
  }
  if (capa === 'cuota') {
    // Avance del mes de las cuentas con tiendas en la ciudad (venta ÷ cuota, sumadas) contra el ritmo esperado al día de hoy.
    for (const d of m.distritos || []) {
      const c = cuotaRitmo(m, (d.tiendas || []).map((t) => t.cuenta));
      porCiudad.set(d.ciudad, c ? { tono: c.tono, valor: c.pct, texto: `${c.pct} % de la cuota del mes (${c.n} cuenta${c.n === 1 ? '' : 's'}) · ritmo ${c.ritmo} %` } : { tono: 'gris', valor: null, texto: 'Sus cuentas no tienen cuota este mes' });
    }
    return { capa, titulo: 'Avance de cuota vs ritmo del mes', leyenda: [{ tono: 'verde', texto: 'Al ritmo' }, { tono: 'ambar', texto: 'Hasta 20 % abajo' }, { tono: 'rojo', texto: 'Más abajo' }, { tono: 'gris', texto: 'Sin cuota' }], porCiudad };
  }
  const venc = new Map((m.kpis?.cartera || []).filter((c) => Number(c.vencido) > 0).map((c) => [c.cuenta, Number(c.vencido)]));
  for (const d of m.distritos || []) {
    const cuentas = [...new Set((d.tiendas || []).map((t) => t.cuenta))], malas = cuentas.filter((c) => venc.has(c));
    const monto = malas.reduce((s, c) => s + venc.get(c), 0);
    porCiudad.set(d.ciudad, { tono: malas.length ? 'rojo' : 'verde', valor: monto, texto: malas.length ? `${malas.length} cuenta${malas.length === 1 ? '' : 's'} con vencido · ${pesos(monto)}` : 'Sin cartera vencida' });
  }
  return { capa, titulo: 'Cartera vencida de sus cuentas', leyenda: [{ tono: 'verde', texto: 'Al corriente' }, { tono: 'rojo', texto: 'Con vencido' }], porCiudad };
}

/** Racks del CEDIS por marca (etapa 3 · interior del CEDIS): filas de `v_inventario_almacen_medida` con `en_inv_actual = true`
 *  (SKU × almacén, como Inventario) + marca de `roadmap_sku` (`marcas`: Map u objeto sku → marca). Suma valor (`costoinventario`)
 *  y piezas por marca, cuenta SKUs distintos con existencia; top `n` por valor y el resto junto en «OTRAS». Sin marca → «SIN MARCA». */
// Números de PO por contenedor (3.90.35): filas `{ contenedor, po }` de `embarques_compras` (sólo de los contenedores dibujados)
// → pone `listaPos` (únicas, ordenadas) en cada barco/tarima del puerto. Sin filas no cambia nada (la tarjeta muestra el conteo).
export function ponerPosEnPuerto(puerto, filas = []) {
  if (!puerto) return puerto;
  const por = new Map();
  for (const f of filas || []) {
    const c = String(f?.contenedor || '').trim(), po = String(f?.po ?? '').trim();
    if (!c || !po) continue;
    if (!por.has(c)) por.set(c, new Set());
    por.get(c).add(po);
  }
  for (const b of [...(puerto.barcos || []), ...(puerto.tarimas || [])]) {
    const s = por.get(String(b.id || '').trim());
    if (s) b.listaPos = [...s].sort((a, z) => a.localeCompare(z, 'es', { numeric: true }));
  }
  return puerto;
}
// Lista de POs para la tarjeta: las primeras 3 y «+N» (la tarjeta es angosta).
export function listaCorta(lista, n = 3) {
  if (!lista?.length) return '';
  return lista.slice(0, n).join(', ') + (lista.length > n ? ` +${lista.length - n}` : '');
}

// Interior de la oficina (paso 1, 3.90.37): reuniones de hoy (`agenda_reuniones`, sin viajes) en orden, con hora local y si ya
// pasó, está en curso o viene. Duración por omisión 60 min. Fechas inválidas se omiten.
export function reunionesDelDia(reuniones = [], hoy = new Date()) {
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  return (reuniones || []).map((r) => {
    const t = new Date(r?.fecha); if (Number.isNaN(t.getTime())) return null;
    const ini = t.getHours() * 60 + t.getMinutes(), fin = ini + (Number(r.duracion_min) || 60);
    return { titulo: r.titulo || 'Reunión', cliente_key: r.cliente_key || null, hora: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, ini, fin, estado: ahora >= fin ? 'hecha' : ahora >= ini ? 'en curso' : 'próxima' };
  }).filter(Boolean).sort((a, b) => a.ini - b.ini);
}

// Interior de la oficina (3.90.38): escritorios en rejilla dentro de la planta (`ancho` × `largo`, centrada en 0,0), hasta `max`.
export function acomodoEscritorios(n, { ancho = 7, largo = 5.2, cols = 4, max = 12 } = {}) {
  const k = Math.max(0, Math.min(Number(n) || 0, max)); if (!k) return [];
  const c = Math.min(cols, k), filas = Math.ceil(k / c);
  return Array.from({ length: k }, (_, i) => ({ x: c === 1 ? 0 : -ancho / 2 + (i % c) * (ancho / (c - 1)), z: filas === 1 ? 0 : -largo / 2 + Math.floor(i / c) * (largo / (filas - 1)) }));
}

// Presencia en la oficina (3.90.40, como Gather): pone `presencia` = { estado: 'viaje' | 'reunion' | 'disponible', titulo } en cada
// persona. Viaje = reunión tipo 'viaje' vigente hoy (fecha … fecha_fin); reunión = una que está en curso ahora. Cuenta si la persona
// es asistente (`asistentes[].user_id`) o quien la creó (`creado_por`). El viaje gana a la reunión.
export function presenciaPersonas(personas = [], reuniones = [], viajes = [], hoy = new Date()) {
  const dia = (x) => { const t = new Date(x); return Number.isNaN(t.getTime()) ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const hoyD = dia(hoy), ahora = hoy.getTime();
  const de = (r, id) => r && id && (r.creado_por === id || (Array.isArray(r.asistentes) && r.asistentes.some((a) => a && (a.user_id === id || a === id))));
  const todas = [...(reuniones || []), ...(viajes || [])].filter(Boolean);
  const vistos = new Set(); const unicas = todas.filter((r) => { const k = r.id || `${r.titulo}|${r.fecha}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  const viajeHoy = unicas.filter((r) => r.tipo === 'viaje' && dia(r.fecha) && dia(r.fecha) <= hoyD && (dia(r.fecha_fin || r.fecha) || dia(r.fecha)) >= hoyD);
  const enCurso = unicas.filter((r) => { if (r.tipo === 'viaje') return false; const t = new Date(r.fecha).getTime(); return !Number.isNaN(t) && t <= ahora && ahora < t + (Number(r.duracion_min) || 60) * 60000; });
  for (const p of personas || []) {
    const v = viajeHoy.find((r) => de(r, p.id)); const r = !v && enCurso.find((x) => de(x, p.id));
    p.presencia = v ? { estado: 'viaje', titulo: v.titulo || 'Viaje' } : r ? { estado: 'reunion', titulo: r.titulo || 'Reunión' } : { estado: 'disponible', titulo: null };
  }
  return personas;
}

// Tienda visitable (3.90.41): filas `{ sku, importe, cantidad }` de sell out de una sucursal → top N SKUs por importe
// (SKU en mayúsculas, sumado). Mismo cálculo que Análisis en el celular (useSkusDimension).
export function topSkus(filas = [], n = 5) {
  const m = new Map();
  for (const r of filas || []) { const k = String(r?.sku || '').trim().toUpperCase(); if (!k) continue; const o = m.get(k) || { sku: k, importe: 0, cantidad: 0 }; o.importe += Number(r.importe) || 0; o.cantidad += Number(r.cantidad) || 0; m.set(k, o); }
  return [...m.values()].filter((o) => o.importe > 0 || o.cantidad > 0).sort((a, b) => b.importe - a.importe || b.cantidad - a.cantidad).slice(0, n);
}
export const pesosCorto = (v) => { const n = Number(v) || 0; return n >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} K` : `$${Math.round(n)}`; };

// Barra superior tipo recursos (3.90.42): toma la salida de `calcular()` de Inicio (mismos números) y arma los 4 recursos,
// cada uno con el edificio al que lleva al tocarlo. Lo que no venga se omite.
export function recursosBarra(r) {
  if (!r) return [];
  const n = (v) => Number(v) || 0; const out = [];
  if (r.cur) { const v = n(r.cur.fact_neta), q = n(r.cuotaPeriodo), pct = q > 0 ? Math.round((v / q) * 100) : null; out.push({ clave: 'ventas', icono: '💰', etiqueta: 'Ventas del mes', valor: v, pct, tono: pct == null ? null : pct >= 100 ? 'verde' : pct >= 80 ? 'ambar' : 'rojo', ir: { tipo: 'oficina' } }); }
  if (r.inv) out.push({ clave: 'inventario', icono: '📦', etiqueta: 'Inventario', valor: n(r.inv.valor), extra: r.inv.cobertura != null ? `${r.inv.cobertura} d` : null, ir: { tipo: 'cedis' } });
  if (r.cartera) out.push({ clave: 'cartera', icono: '🏦', etiqueta: 'Cartera vencida', valor: n(r.cartera.vencido), tono: n(r.cartera.vencido) > 0 ? 'rojo' : 'verde', ir: { tipo: 'banco' } });
  if (r.enCamino) out.push({ clave: 'embarques', icono: '🚢', etiqueta: 'En tránsito', valor: n(r.enCamino.valor), extra: r.enCamino.pos ? `${r.enCamino.pos} POs` : null, ir: { tipo: 'puerto' } });
  return out;
}

// Burbujas de atención (etapa 4, paso 1, 3.90.43): qué edificio pide atención y por qué, con reglas sobre el modelo ya armado.
// Cartera o pagos vencidos → banco; contenedor con ETA vencida o que llega en ≤ 3 días → puerto; reunión que empieza en
// ≤ 15 min → oficina. Rojo primero. Cada una trae el `tag` para abrir la tarjeta del edificio.
export function burbujasAtencion(m, hoy = new Date()) {
  if (!m) return [];
  const pesos = (v) => { const n = Number(v) || 0; return n >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} K` : `$${Math.round(n)}`; };
  const out = []; const b = m.banco;
  if (b && Number(b.carteraVencida) > 0) out.push({ lugar: 'banco', icono: '🏦', nivel: 'rojo', texto: `Cartera vencida ${pesos(b.carteraVencida)}` });
  else if (b && Number(b.pagosVencidos) > 0) out.push({ lugar: 'banco', icono: '🏦', nivel: 'rojo', texto: `${b.pagosVencidos} pago${b.pagosVencidos === 1 ? '' : 's'} vencido${b.pagosVencidos === 1 ? '' : 's'}` });
  const barcos = m.puerto?.barcos || [];
  const tarde = barcos.filter((x) => !x.arribo && x.llegaEnDias != null && x.llegaEnDias < 0).length;
  const pronto = barcos.filter((x) => !x.arribo && x.llegaEnDias != null && x.llegaEnDias >= 0 && x.llegaEnDias <= 3).length;
  if (tarde) out.push({ lugar: 'puerto', icono: '🚢', nivel: 'rojo', texto: `${tarde} contenedor${tarde === 1 ? '' : 'es'} con ETA vencida` });
  else if (pronto) out.push({ lugar: 'puerto', icono: '🚢', nivel: 'ambar', texto: `${pronto} contenedor${pronto === 1 ? ' llega' : 'es llegan'} en ≤ 3 días` });
  const oc = Number(m.ocDetenidas) || 0; // alerta `oc_detenida` (pedidos de cliente detenidos) → CEDIS
  if (oc) out.push({ lugar: 'cedis', icono: '📦', nivel: 'rojo', texto: `${oc} pedido${oc === 1 ? '' : 's'} de cliente detenido${oc === 1 ? '' : 's'}` });
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  const prox = (m.oficina?.agenda || []).find((r) => r.estado === 'próxima' && r.ini - ahora <= 15 && r.ini - ahora >= 0);
  if (prox) out.push({ lugar: 'oficina', icono: '📅', nivel: 'ambar', texto: `${prox.titulo} en ${prox.ini - ahora} min` });
  return out.map((x) => ({ ...x, tag: { tipo: x.lugar } })).sort((a, c) => (a.nivel === 'rojo' ? 0 : 1) - (c.nivel === 'rojo' ? 0 : 1));
}

export function racksPorMarca(filas = [], marcas = null, n = 8, demanda = null) {
  const marcaDe = (sku) => norm(marcas instanceof Map ? marcas.get(sku) : marcas?.[sku]) || 'SIN MARCA';
  const por = new Map();
  for (const r of filas || []) {
    if (!r?.articulo || !(N(r.inventario) > 0)) continue;
    const m = marcaDe(r.articulo); const g = por.get(m) || { marca: m, valor: 0, piezas: 0, skus: new Set() };
    g.valor += N(r.costoinventario); g.piezas += N(r.inventario); g.skus.add(r.articulo); por.set(m, g);
  }
  // Días de inventario por marca (3.90.32): piezas / demanda en piezas de los 3 meses cerrados × 90 (la medida del director, en
  // piezas porque el pivote de sell in las trae); sin demanda → null. `demanda`: Map SKU (mayúsculas) → piezas de los 3 meses.
  const dem = (g) => { let s2 = 0; for (const k of g.skus) s2 += N(demanda?.get?.(String(k).toUpperCase())); return s2; };
  const conDias = (o, d3) => ({ ...o, demanda3: d3, dias: d3 > 0 ? Math.round(o.piezas / d3 * 90) : null });
  const todas = [...por.values()].map((g) => conDias({ marca: g.marca, valor: g.valor, piezas: g.piezas, skus: g.skus.size }, demanda ? dem(g) : 0)).sort((a, b) => b.valor - a.valor || b.piezas - a.piezas || a.marca.localeCompare(b.marca));
  const top = todas.slice(0, n), resto = todas.slice(n);
  if (resto.length) { const o = resto.reduce((o2, g) => ({ ...o2, valor: o2.valor + g.valor, piezas: o2.piezas + g.piezas, skus: o2.skus + g.skus, marcas: o2.marcas + 1, d3: o2.d3 + g.demanda3 }), { marca: 'OTRAS', valor: 0, piezas: 0, skus: 0, marcas: 0, d3: 0 }); const { d3, ...rest } = o; top.push(conDias(rest, d3)); }
  return top;
}

/** Demanda de los 3 meses cerrados anteriores a `hoy` por SKU (piezas, suma), desde el pivote `v_sellin_global_sku_anio`
 *  ({ sku, anio, piezas[12] }), igual que Inventario: Map SKU en mayúsculas → piezas. */
export function demanda3Meses(rows = [], hoy = new Date()) {
  const cerrados = [1, 2, 3].map((i) => { const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return { anio: f.getFullYear(), mes: f.getMonth() + 1 }; });
  const m = new Map();
  for (const r of rows || []) {
    const sku = String(r?.sku || '').toUpperCase(); if (!sku) continue;
    let s2 = 0; for (const c of cerrados) if (N(r.anio) === c.anio) s2 += N((r.piezas || [])[c.mes - 1]);
    if (s2) m.set(sku, (m.get(sku) || 0) + s2);
  }
  return m;
}

/** Acomodo de los racks dentro de la nave del CEDIS (interior, 3.90.31): rejilla de `cols` columnas centrada en la nave
 *  (`ancho` × `largo`, centro 0,0) y `niveles` de cajas según el valor de la marca frente a la mayor (1…`maxNiveles`).
 *  Nada escala por tamaño de cliente: aquí escala el inventario propio de Acteck por marca, que es lo que se ve en Inventario. */
export function acomodoRacks(racks = [], { ancho = 14, largo = 9, cols = 3, maxNiveles = 5 } = {}) {
  const rs = (racks || []).filter((r) => r && r.marca); if (!rs.length) return [];
  const max = Math.max(...rs.map((r) => N(r.valor))); const filas = Math.ceil(rs.length / cols);
  const dx = ancho / cols, dz = largo / filas;
  return rs.map((r, i) => ({ ...r, x: -ancho / 2 + dx * ((i % cols) + .5), z: -largo / 2 + dz * (Math.floor(i / cols) + .5), niveles: max > 0 ? Math.max(1, Math.min(maxNiveles, Math.ceil(N(r.valor) / max * maxNiveles))) : 1 }));
}

/** Tarjeta del edificio (una sola plantilla, estilo Hay Day): de un tag tocado → { titulo, sub, estado: 'verde'|'ambar'|'rojo'|null,
 *  numeros: [[etiqueta, valor]] (máx. 4), pagina }. Los números salen del mismo modelo (mismas vistas que el dashboard). */
export function tarjetaDe(tag, modelo) {
  if (!tag) return null;
  const pesos = (v) => { const n = Number(v) || 0; return n >= 1e6 ? `$${(n / 1e6).toFixed(1)} M` : n >= 1e3 ? `$${Math.round(n / 1e3)} K` : `$${Math.round(n)}`; };
  const num = (v) => (Number(v) || 0).toLocaleString('es-MX');
  const t = { titulo: tag.titulo || '', sub: tag.sub || '', estado: null, numeros: [], pagina: tag.pagina || null };
  const m = modelo || {};
  if (tag.tipo === 'oficina' && m.oficina) {
    const o = m.oficina, pend = (o.personas || []).reduce((s, p) => s + (p.pendientes || 0), 0), hechas = (o.personas || []).reduce((s, p) => s + (p.hechas || 0), 0);
    t.numeros = [['Personas', num((o.personas || []).length + (o.genericos || 0))], ['Reuniones hoy', (() => { const p = (o.agenda || []).find((r) => r.estado !== 'hecha'); return p ? `${num(o.reuniones)} · ${p.estado === 'en curso' ? 'en curso' : `próxima ${p.hora}`}` : num(o.reuniones); })()], ['Pendientes', num(pend)], ['Hechas', num(hechas)]];
    t.estado = o.reunionEnCurso ? 'ambar' : 'verde';
  } else if (tag.tipo === 'sala' && m.oficina) {
    // Sala de juntas (interior de la oficina, 3.90.38): las reuniones de hoy en orden; en curso = ámbar.
    const ag = m.oficina.agenda || [];
    t.numeros = ag.length ? ag.slice(0, 5).map((r) => [`${r.hora}${r.estado === 'en curso' ? ' · ahora' : r.estado === 'hecha' ? ' · ✓' : ''}`, r.titulo]) : [['Reuniones hoy', 'ninguna']];
    t.estado = ag.some((r) => r.estado === 'en curso') ? 'ambar' : 'verde';
  } else if ((tag.tipo === 'cedis' || tag.tipo === 'montacargas') && m.cedis) {
    const c = m.cedis, d = Number(c.dias) || 0;
    t.numeros = [['Inventario', pesos(c.valor)], ['Días de inventario', num(Math.round(d))], ['Piezas', num(c.piezas)], ['SKUs con stock', num(c.skus)]];
    t.estado = d > 120 ? 'rojo' : d > 90 ? 'ambar' : 'verde';
  } else if (tag.tipo === 'rack') {
    const r = (m.cedis?.racksMarca || []).find((x) => x.marca === tag.marca);
    if (r) {
      const tot = (m.cedis.racksMarca || []).reduce((s2, x) => s2 + (Number(x.valor) || 0), 0);
      t.numeros = [['Inventario', `${pesos(r.valor)} · ${tot > 0 ? Math.round(r.valor / tot * 100) : 0} %`], ['Días de inventario', r.dias == null ? 'sin demanda' : num(r.dias)], ['Piezas', num(r.piezas)], [r.marcas ? `SKUs · ${num(r.marcas)} marcas` : 'SKUs con stock', num(r.skus)]];
      t.estado = r.dias == null ? null : r.dias > 120 ? 'rojo' : r.dias > 90 ? 'ambar' : 'verde'; // mismos umbrales que el CEDIS
    }
  } else if (tag.tipo === 'barco' && m.puerto) {
    // Contenedor en el mar (interior del puerto, 3.90.34): proveedor, ETA, piezas y POs (`v_embarques_contenedor`). ETA vencida sin arribo = rojo.
    const b = [...(m.puerto.barcos || []), ...(m.puerto.tarimas || [])].find((x) => x.id === tag.id);
    if (b) {
      const f = b.arribo || b.eta; const fc = f ? new Date(`${String(f).slice(0, 10)}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) : null;
      const cuando = b.llegaEnDias == null ? 'sin ETA' : b.llegaEnDias < 0 ? `${fc} · ${-b.llegaEnDias} d tarde` : b.llegaEnDias === 0 ? `${fc} · hoy` : `${fc} · en ${b.llegaEnDias} d`;
      t.numeros = [['Proveedor', b.supplier || '—'], [b.arribo ? 'Arribo CEDIS' : 'ETA puerto', cuando], ['Piezas', num(b.piezas)], ['POs', listaCorta(b.listaPos) || (b.pos ? num(b.pos) : '—')]];
      t.estado = b.llegaEnDias == null ? 'ambar' : b.llegaEnDias < 0 ? 'rojo' : 'verde';
    }
  } else if (tag.tipo === 'puerto' && m.puerto) {
    const p = m.puerto, b = p.barcos || [], pronto = b.filter((x) => x.llegaEnDias != null && x.llegaEnDias <= 7).length;
    t.numeros = [['Navegando', num(b.length)], ['Piezas en el mar', num(p.totalPiezas)], ['Llegan en 7 días', num(pronto)], ['Descargando', num((p.tarimas || []).length)]];
    t.estado = b.some((x) => x.llegaEnDias == null) ? 'ambar' : 'verde';
  } else if (tag.tipo === 'banco' && m.banco) {
    const b = m.banco;
    t.numeros = [['Cartera vencida', pesos(b.carteraVencida)], ['Cuentas con vencido', num(b.cuentasVencidas)], ['Pagos 7 días', `${num(b.pagosSemana)} · ${pesos(b.montoSemana)}`], ['Pagos vencidos', `${num(b.pagosVencidos)} · ${pesos(b.montoVencido)}`]];
    t.estado = b.pagosVencidos > 0 || b.carteraVencida > 0 ? 'rojo' : b.pagosSemana > 0 ? 'ambar' : 'verde';
  } else if (tag.tipo === 'torre' && m.torre) {
    const r = m.torre;
    t.numeros = [['Propuestas abiertas', num(r.abiertas)], ['SKUs confirmados', `${num(r.confirmadas)} de ${num(r.lineas)}`], ['Comprados', num(r.compradas)], ['Arribos 7 días', `${num(r.arribos7)}${r.atrasados ? ` · ${num(r.atrasados)} atrasado${r.atrasados === 1 ? '' : 's'}` : ''}`]];
    t.estado = r.atrasados > 0 ? 'rojo' : r.arribos7 > 0 ? 'ambar' : 'verde';
  } else if (tag.tipo === 'ciudad') {
    const d = (m.distritos || []).find((x) => x.ciudad === tag.ciudad) || tag.distrito;
    if (d) {
      const ts = d.tiendas || [], act = ts.filter((x) => x.vendio).length, venta = ts.reduce((s, x) => s + (Number(x.importe) || 0), 0), r = ts.length ? act / ts.length : 0;
      t.numeros = [['Tiendas activas', `${act} de ${ts.length}`], ['Venta del mes', pesos(venta)], ['Clientes', num((d.cuentas || []).length || new Set(ts.map((x) => x.cuenta)).size)], ['Vendedores', num((d.vendedores || []).length)]];
      const cq = cuotaRitmo(m, ts.map((x) => x.cuenta)); if (cq) { t.numeros.splice(2, 0, ['Cuota del mes', `${cq.pct} % · ritmo ${cq.ritmo} %`]); t.cuota = cq.tono; } // 3.90.60
      t.estado = !ts.length ? null : r >= 0.6 ? 'verde' : r >= 0.3 ? 'ambar' : 'rojo';
    }
  } else if (tag.tipo === 'tienda') {
    const d = (m.distritos || []).find((x) => x.ciudad === tag.ciudad);
    const s = d?.tiendas?.find((x) => x.cuenta === tag.cuenta && `${x.nombreCuenta} · ${x.sucursal}` === tag.titulo);
    if (s) {
      t.numeros = [['Este mes', pesos(s.importe)], ['Mes anterior', pesos(s.previo)]];
      if (s.vendedores) t.numeros.push(['Vendedores', num(s.vendedores)]);
      if (s.cartera?.vencido > 0) t.numeros.push(['Cartera vencida', pesos(s.cartera.vencido)]);
      const cq = cuotaRitmo(m, [s.cuenta]); if (cq) { t.numeros.splice(2, 0, ['Cuota de la cuenta', `${cq.pct} % · ritmo ${cq.ritmo} %`]); t.cuota = cq.tono; } // 3.90.60
      t.estado = s.cartera?.vencido > 0 ? 'rojo' : s.vendioMes ? 'verde' : s.vendio ? 'ambar' : 'rojo';
    }
  } else if (tag.tipo === 'persona' && tag.persona && !tag.persona.generico) {
    const p = tag.persona; t.numeros = [['Pendientes hoy', num(p.pendientes)], ['Hechas', num(p.hechas)]];
    const pr = p.presencia; if (pr) t.numeros.unshift(['Ahora', pr.estado === 'viaje' ? `De viaje · ${pr.titulo}` : pr.estado === 'reunion' ? `En reunión · ${pr.titulo}` : 'Disponible']);
    t.estado = p.actividad ? 'verde' : p.pendientes > p.hechas ? 'ambar' : 'verde';
  } else if (tag.tipo === 'camion') {
    // Camión (etapa 5, 3.90.54): factura (cliente, monto, piezas) o envío del Tracking (paquetería), cuándo salió y destino.
    // Envío con más de 5 días en camino = ámbar.
    const c = (m.camiones || []).find((x) => x.folio === tag.folio);
    if (c) {
      const n = c.fecha ? dias(c.fecha, m.hoyIso || new Date().toISOString().slice(0, 10)) : null;
      const salio = c.fecha ? `${String(c.fecha).slice(0, 10)}${n == null ? '' : n <= 0 ? ' · hoy' : n === 1 ? ' · ayer' : ` · hace ${n} d`}` : '—';
      const destino = String(c.ciudad || '').toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase()) || '—';
      t.numeros = c.envio ? [['Cliente', c.cliente || '—'], ['Paquetería', c.paqueteria || '—'], ['Salió', salio], ['Destino', destino]] : [['Cliente', c.cliente || '—'], ['Factura', pesos(c.monto)], ['Piezas', num(c.piezas)], ['Salió', salio]];
      t.estado = c.envio && n != null && n > 5 ? 'ambar' : 'verde';
    }
  } else if (tag.tipo === 'vendedorErp') {
    // Vendedor del ERP en ruta (etapa 5, 3.90.53): ventas del mes y del año (`v_ventas_vendedor_cliente_mes`) y a quién visita.
    const v = (m.vendedoresRuta || []).find((x) => x.nombre === tag.titulo);
    if (v) { t.numeros = [['Ventas del mes', pesos(v.totalMes)], ['Ventas del año', pesos(v.total)], ['Clientes', num(v.clientes)], ['Ruta', (v.destinos || []).map((x) => x.cliente).slice(0, 3).join(' → ') || '—']]; t.estado = v.totalMes > 0 ? 'verde' : 'ambar'; }
  } else if (tag.tipo === 'barco' && tag.barco) {
    const b = tag.barco; t.numeros = [['Piezas', num(b.piezas)], ['ETA puerto', b.eta || '—'], ['Llega a CEDIS', b.arribo || '—']];
    if (b.estatus) t.numeros.push(['Estatus', b.estatus]);
    t.estado = b.llegaEnDias == null ? 'ambar' : 'verde';
  }
  t.numeros = t.numeros.slice(0, 4);
  return t;
}
export function vistaMapa({ ang = Math.PI / 4, aspecto = 1.6 } = {}) {
  return encuadre(EXTREMOS_MEXICO.map((c) => ({ ...posDe(c), r: 4 })), { ang, aspecto, margen: 1.05, min: ZOOM_MIN, max: ZOOM_MAX });
}

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

// Barra de tiempo (etapa 6, paso 1): momentos a los que se puede regresar la ciudad (Hoy / Ayer / Hace 7 días / Inicio de mes,
// a la misma hora; inicio de mes = día 1 a mediodía). Se quitan los que caen en el mismo día que uno anterior.
const isoLocal = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
export function momentosTiempo(hoy = new Date()) {
  const atras = (n) => { const t = new Date(hoy); t.setDate(t.getDate() - n); return t; };
  const todos = [{ id: 'hoy', texto: 'Hoy', fecha: hoy }, { id: 'ayer', texto: 'Ayer', fecha: atras(1) }, { id: 'semana', texto: 'Hace 7 días', fecha: atras(7) },
    { id: 'mes', texto: 'Inicio de mes', fecha: new Date(hoy.getFullYear(), hoy.getMonth(), 1, 12, 0) }];
  const vistos = new Set();
  return todos.filter((m) => { const k = isoLocal(m.fecha); if (vistos.has(k)) return false; vistos.add(k); return true; }).map((m) => ({ ...m, iso: isoLocal(m.fecha) }));
}
// Los datos crudos de `construirModelo` como estaban en `fecha` (lo que se puede reconstruir): sin facturas, envíos ni
// contenedores que aún no existían; envíos sin entregar y contenedores sin arribo si eso pasó después; ventas mensuales hasta
// el mes de esa fecha (el mes en curso cuenta completo: no hay venta por día de sucursal). Agenda/reuniones sólo existen para
// hoy → vacías. Inventario, cartera, pagos y forecast son foto de hoy: quedan igual y se listan en `_aprox`.
export function datosEnFecha(d, fecha) {
  if (!d || !(fecha instanceof Date) || Number.isNaN(fecha.getTime())) return d;
  const f = isoLocal(fecha), am = fecha.getFullYear() * 12 + fecha.getMonth() + 1;
  const despues = (x) => !!x && String(x).slice(0, 10) > f;
  const hastaMes = (rows) => (rows || []).filter((r) => N(r.anio) * 12 + N(r.mes) <= am);
  const envios = (d.envios || []).filter((e) => !despues(e.fecha_envio_erp || e.fecha_surtida)).map((e) => (despues(e.fecha_entrega_erp || e.fecha_entregada) ? { ...e, fecha_entrega_erp: null, fecha_entregada: null } : e));
  const contenedores = (d.contenedores || []).filter((c) => !despues(c.fecha_emision)).map((c) => (despues(c.arribo_cedis) ? { ...c, arribo_cedis: null, estatus: /CONCLUIDO/i.test(c.estatus || '') ? 'EN TRANSITO' : c.estatus } : c));
  return { ...d, facturas: (d.facturas || []).filter((x) => !despues(x.fecha)), envios, contenedores,
    sucursales: hastaMes(d.sucursales), cuentaMes: hastaMes(d.cuentaMes), clientesFinales: hastaMes(d.clientesFinales), vendedoresMayoristas: hastaMes(d.vendedoresMayoristas), vendedoresErp: hastaMes(d.vendedoresErp),
    agendaHoy: [], reunionesHoy: [], viajesHoy: [], _aprox: ['inventario', 'cartera', 'pagos', 'ventas del mes completas', 'agenda'] };
}

// Calendario comercial (etapa 6, como Animal Crossing; paso 1): avisos según la fecha real. Cierre de mes (cuenta regresiva
// los últimos 7 días), Buen Fin (viernes a lunes del fin de semana largo de la Revolución = 3.er lunes de noviembre; aviso
// desde 14 días antes), regreso a clases (15 jul – 31 ago) y Navidad (1–25 dic). `dias` = cuántos faltan (0 = ya es hoy/en curso).
export function eventosCalendario(hoy = new Date()) {
  const d0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), y = d0.getFullYear(), mo = d0.getMonth();
  const entre = (a, b) => Math.round((b - a) / 86400000), out = [];
  const ultimo = new Date(y, mo + 1, 0), faltan = entre(d0, ultimo);
  if (faltan <= 6) out.push({ id: 'cierre', icono: '⏳', dias: faltan, nivel: faltan <= 2 ? 'ambar' : null, texto: faltan === 0 ? 'Hoy cierra el mes' : `Cierre de mes en ${faltan} día${faltan === 1 ? '' : 's'}` });
  const nov1 = new Date(y, 10, 1), lunes3 = new Date(y, 10, 1 + ((8 - nov1.getDay()) % 7) + 14), bfIni = new Date(y, 10, lunes3.getDate() - 3);
  const aBf = entre(d0, bfIni), finBf = entre(d0, lunes3);
  if (aBf <= 14 && finBf >= 0) out.push({ id: 'buenfin', icono: '🏷️', dias: Math.max(0, aBf), nivel: aBf <= 0 ? 'ambar' : null, texto: aBf <= 0 ? `Buen Fin · hasta el lunes ${lunes3.getDate()}` : `Buen Fin en ${aBf} día${aBf === 1 ? '' : 's'} (${bfIni.getDate()}–${lunes3.getDate()} nov)` });
  if ((mo === 6 && d0.getDate() >= 15) || mo === 7) out.push({ id: 'clases', icono: '🎒', dias: 0, nivel: null, texto: 'Temporada de regreso a clases' });
  if (mo === 11 && d0.getDate() <= 25) { const n = 25 - d0.getDate(); out.push({ id: 'navidad', icono: '🎄', dias: n, nivel: null, texto: n === 0 ? '¡Feliz Navidad!' : `Temporada navideña · faltan ${n} días` }); }
  return out.sort((a, b) => a.dias - b.dias);
}

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
  presenciaPersonas(personas, d.reunionesHoy, d.viajesHoy, hoy); // 3.90.40: en reunión / de viaje / disponible (como Gather)
  const oficina = { personas, genericos: 3, reuniones: reuniones.length, reunionEnCurso: reunionEnCurso ? { titulo: reunionEnCurso.titulo, cliente_key: reunionEnCurso.cliente_key } : null, agenda: reunionesDelDia(reuniones, hoy) };

  // ── CEDIS ──
  const inv = (d.inventario || [])[0] || {};
  const hoyLocal = `${anio}-${String(mes).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`; // salidas de HOY en Guadalajara (hoyIso es UTC: de noche ya es mañana)
  const cedis = { valor: N(inv.inv_actual), piezas: N(inv.inv_actual_piezas), dias: N(inv.dias_inv), skus: N(inv.skus_con_stock), racks: Math.max(3, Math.min(10, Math.round(N(inv.dias_inv) / 18))), actualizado: inv.actualizado || null, racksMarca: racksPorMarca(d.inventarioSku, d.marcasSku, 8, d.demandaSku ? demanda3Meses(d.demandaSku, hoy) : null), salidasHoy: (d.facturas || []).filter((f) => String(f.fecha || '').slice(0, 10) === hoyLocal).length };

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
    const reg = { id: c.contenedor, supplier: c.supplier, naviera: c.naviera || '', piezas: N(c.piezas), pos: N(c.pos), fob: N(c.fob_usd), eta: eta, arribo, llegaEnDias, progreso: p, estatus: c.estatus || '' };
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
    const sede = SEDE_POR_CUENTA[c.cuenta] || 'GUADALAJARA'; // 3.90.56: y una tienda por estado donde vende a clientes finales
    for (const r of repartoPorEstado(c.cuenta, d.clientesFinales, { anio, mes, anioPrev, mesPrev, sede })) tienda(r.ciudad, { cuenta: c.cuenta, nombreCuenta: c.nombre, sucursal: `Clientes en ${r.ciudad.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase())}`, importe: r.importe, previo: r.previo, vendio: r.importe > 0 || (hoy.getDate() <= 10 && r.previo > 0), vendioMes: r.importe > 0, virtual: false, reparto: true, vendedores: 0 });
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
  for (const r of d.vendedoresErp || []) { if (N(r.anio) !== anio) continue; const o = ve.get(r.vendedor) || { nombre: r.vendedor, clientes: new Map(), total: 0, totalMes: 0 }; o.total += N(r.fact_neta); if (N(r.mes) === mes) o.totalMes += N(r.fact_neta); const c = o.clientes.get(r.cliente_key) || { cliente_key: r.cliente_key, nombre: r.cliente_nombre, fact: 0 }; c.fact += N(r.fact_neta); o.clientes.set(r.cliente_key, c); ve.set(r.vendedor, o); }
  const porErp = new Map([...cuentas.values()].filter((c) => c.erp_cliente).map((c) => [String(c.erp_cliente), c]));
  const vendedoresRuta = [...ve.values()].filter((v) => v.nombre && v.total > 0).sort((a, b) => b.total - a.total).slice(0, 10).map((v, i) => {
    const top = [...v.clientes.values()].sort((a, b) => b.fact - a.fact).slice(0, 3);
    const destinos = top.map((c) => { const cu = porErp.get(String(c.cliente_key)) || [...cuentas.values()].find((x) => norm(x.nombre) === norm(c.nombre)); const key = cu?.cuenta || null; return { cliente: c.nombre || c.cliente_key, ciudad: (key && SEDE_POR_CUENTA[key]) || 'CIUDAD DE MEXICO', fact: c.fact }; });
    return { nombre: nombreCorto(v.nombre), nombreCompleto: v.nombre, total: v.total, totalMes: v.totalMes, clientes: v.clientes.size, destinos, fase: i / 10 };
  });

  const clientesFinales = distritos.reduce((s, x) => s + (x.clientesFinales?.n || 0), 0);
  const kpis = { clientesFinales, cartera: [...carteraPor.entries()].map(([k, c]) => ({ cuenta: k, ...c })), tiendas: distritos.reduce((s, x) => s + x.tiendas.filter((t) => !t.reparto).length, 0), tiendasVendieron: distritos.reduce((s, x) => s + x.tiendas.filter((t) => t.vendio && !t.reparto).length, 0), ciudades: distritos.length, barcos: puerto.barcos.length, camiones: camiones.length, vendedores: vendedoresRuta.length, enLinea: virtuales.length };
  const banco = resumenBanco(kpis.cartera, d.pagos, hoyIso, d.reglasPagos); const torre = resumenTorre(d.forecast, d.avisosForecast, hoyIso);
  return { hoyIso, anio, mes, oficina, cedis, puerto, ocDetenidas: (d.alertasOc || []).length, banco, torre, distritos, camiones, vendedoresRuta, kpis, origen: posDe(ORIGEN), puertoPos: posDe(CIUDADES.MANZANILLO) };
}
