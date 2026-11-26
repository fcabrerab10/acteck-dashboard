// Acteck Ciudad · modelo (puro, sin React ni three). Pruebas: scripts/test-ciudad-modelo.mjs
//
// Convierte los datos del dashboard en un «mapa-ciudad»: México estilizado donde cada ciudad real es un distrito
// con las tiendas (sucursales) de los clientes que venden ahí, Acteck está en Guadalajara (oficina + CEDIS),
// Manzanillo es el puerto por donde llegan los contenedores, y por las carreteras van los camiones (facturas)
// y los vendedores (equipo comercial del ERP) hacia los clientes que atienden.
// Regla de Fernando: NADA escala por el tamaño del cliente; lo que se ve es actividad (luces, movimiento).
import { estadoCobertura, PERFILES } from '../../lib/cobertura.js';


// 4.7.15: `numero()` lee montos y conteos en texto con «$», comas o espacios («$5,000», « 1,200 ») como número (antes 0:
// cartera, inventario, piezas y ventas de esas filas no sumaban); vacío, booleano, objeto, NaN o Infinity → 0.
// 4.7.72: también «12%» / « 45 % » (como `porcentaje()`; antes 0).
// 4.12.53: negativo contable entre paréntesis («(1,500)», «$(2,000)») se lee negativo (antes 0: una nota de crédito o un
// ajuste de Sheets no restaba); «()» vacío sigue siendo basura.
function textoNum(s, quita) {
  const t = s.trim().replace(/^\$\s*(?=\()/, ''); const p = /^\((.*)\)$/.exec(t); const c = (p ? p[1] : t).replace(quita, '');
  if (!c) return NaN; const n = Number(c); return p ? (n < 0 ? NaN : -n) : n;
}
export const numero = (v) => { const k = typeof v === 'string' ? textoNum(v, /[\s$,%]/g) : typeof v === 'number' ? v : NaN; return Number.isFinite(k) ? k : 0; };
const N = numero;
// (4.3.19) Lo que no es lista (null, texto, número, objeto) → []: una consulta que regresa algo raro no tumba la capa.
export const comoLista = (x) => (Array.isArray(x) ? x : []);
// (4.3.20) Cuántos mostrar: número o texto ≥ 0 → entero (3.7 → 3); NaN, negativo, null o basura → la omisión. Antes un
// `max`/`n` inválido llegaba a `slice(0, NaN)` y la lista salía vacía (misiones, pensamientos, bitácora, cintas, racks…).
export const cuantos = (x, omision) => { const n = x == null || x === '' ? NaN : Number(x); return Number.isFinite(n) && n >= 0 ? Math.floor(n) : omision; };
// 4.7.73: un objeto, lista, booleano o Infinity ya no sale «[OBJECT OBJECT]» / «TRUE» / «INFINITY» (cuenta, ciudad, nombre): vacío.
export const norm = (s) => String(s && (typeof s === 'string' || (typeof s === 'number' && Number.isFinite(s))) ? s : '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().trim();
// 4.12.54: tipo/estado de agenda, reuniones y perfiles sin importar mayúsculas, acentos ni espacios («Viaje», « hecha », «EXTERNO»).
export const esClase = (v, ...clases) => { const k = norm(v); return !!k && clases.some((c) => norm(c) === k); };

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
  // 4.12.10: ciudades con tiendas que no estaban en el catálogo (antes sus sucursales no salían en el mapa). Van al final para
  // no cambiar la ciudad representativa de su estado (`CIUDAD_POR_ESTADO` toma la primera).
  'PLAYA DEL CARMEN': { lat: 20.63, lon: -87.07, estado: 'QUINTANA ROO' },
  CHETUMAL: { lat: 18.5, lon: -88.3, estado: 'QUINTANA ROO' },
  'LOS CABOS': { lat: 23.06, lon: -109.7, estado: 'BAJA CALIFORNIA SUR' },
  'NUEVO LAREDO': { lat: 27.48, lon: -99.52, estado: 'TAMAULIPAS' },
  MATAMOROS: { lat: 25.87, lon: -97.5, estado: 'TAMAULIPAS' },
  MONCLOVA: { lat: 26.9, lon: -101.42, estado: 'COAHUILA' },
  'CIUDAD OBREGON': { lat: 27.49, lon: -109.94, estado: 'SONORA' },
  'CIUDAD DEL CARMEN': { lat: 18.65, lon: -91.83, estado: 'CAMPECHE' },
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
// Capas de un objeto ('fino+mapa'): sólo texto, cada nombre sin espacios; objetos, listas, números y booleanos no son capa
// (antes un objeto daba la capa «[object Object]» y ' mapa ' no empataba con 'mapa': el objeto se veía de cerca).
const nombresCapa = (c) => (typeof c === 'string' ? c.split('+').map((k) => k.trim()).filter(Boolean) : []);
export const juntarCapas = (...cs) => [...new Set(cs.flatMap(nombresCapa))].sort().join('+') || undefined;
export const capaVisible = (capas, detalle) => nombresCapa(detalle).every((k) => capas?.[k] !== false);
// Árbol chico (escala menor a 1): adorno que va en la capa fina y se oculta de lejos (3.90.7).
// (4.12.7) Número legible para escala/zoom: número finito o texto numérico (« 0.8 »); null, '', booleanos y basura → NaN.
const numLegible = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v.trim()) : NaN);
export const esChico = (s) => { const n = numLegible(s); return Number.isFinite(n) && n < 1; };

// Etiquetas sin encimarse: cajas en pixeles de pantalla { x, y (centro), w, h, prioridad }; se quedan las de mayor prioridad
// (empate: la primera) y se esconden las que chocan con una ya puesta. Regresa un arreglo de booleanos en el orden recibido.
export function etiquetasSinEncimar(cajas, margen = 4) {
  cajas = Array.isArray(cajas) ? cajas : [];
  margen = Number(margen); if (!Number.isFinite(margen) || margen < 0) margen = 4; // margen inválido ya no deja todas encimadas
  const pri = (c) => { const n = Number(c?.prioridad); return Number.isFinite(n) ? n : 0; }; // «alta»/NaN no desordenan el sort
  const orden = cajas.map((c, i) => i).sort((a, b) => pri(cajas[b]) - pri(cajas[a]) || a - b);
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
// (4.12.7) Zoom en texto («50») se lee; -Infinity (rueda sin fin hacia adentro) va al mínimo; ilegible sigue al máximo.
export const zoomEnRango = (z) => { const n = numLegible(z); return Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, n === -Infinity ? ZOOM_MIN : Number.isFinite(n) ? n : ZOOM_MAX)); };
export function encuadre(puntos, op) {
  let { ang = Math.PI / 4, aspecto = 1.6, margen = 1.15, alto = 12, min = 8, max = 120 } = op && typeof op === 'object' ? op : {}; // (4.3.19) opciones null → omisión
  const ok = (Array.isArray(puntos) ? puntos : []).filter((p) => p && Number.isFinite(p.x) && Number.isFinite(p.z));
  if (!ok.length) return null;
  const pos = (v, def) => (Number.isFinite(v) && v > 0 ? v : def);
  const asp = pos(aspecto, 1.6); margen = pos(margen, 1.15); alto = pos(alto, 12); min = pos(min, 8); max = pos(max, 120);
  if (max < min) max = min; if (!Number.isFinite(ang)) ang = Math.PI / 4;
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
  margen = Number.isFinite(Number(margen)) && Number(margen) >= 0 && margen !== null && margen !== '' ? Number(margen) : 1;
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
// Número legible (número o texto numérico finito) o `omision`: null, '', NaN, Infinity, objetos/listas o basura no pasan.
const numO = (v, omision) => { if ((typeof v !== 'number' && typeof v !== 'string') || v.trim?.() === '') return omision; const n = Number(v); return Number.isFinite(n) ? n : omision; };
// lon/lat (o X/Y) ilegibles caen en el origen (Guadalajara) en vez de dar NaN (terreno y objetos fuera de la escena).
export const aPx = (lon, lat) => ({ X: PX.a * numO(lon, ORIGEN.lon) + PX.b, Y: PX.c * numO(lat, ORIGEN.lat) + PX.d });
export const PX_ORIGEN = aPx(ORIGEN.lon, ORIGEN.lat);
export const pxAEscena = (X, Y) => ({ x: (numO(X, PX_ORIGEN.X) - PX_ORIGEN.X) * K, z: (numO(Y, PX_ORIGEN.Y) - PX_ORIGEN.Y) * K });
// Sin lon/lat legibles (null, texto, NaN) cae en el origen (Guadalajara) en vez de dar x/z NaN (objeto fuera de la escena).
export const posDe = (c) => { const lon = Number(c?.lon), lat = Number(c?.lat); if (c?.lon == null || c?.lat == null || c?.lon === '' || c?.lat === '' || !Number.isFinite(lon) || !Number.isFinite(lat)) return { x: 0, z: 0 }; const p = aPx(lon, lat); return pxAEscena(p.X, p.Y); };
// Vista Mapa de México (etapa 2): las puntas del país (Tijuana, Mexicali, Juárez, Piedras Negras, Matamoros, Cancún,
// Tapachula, Los Cabos) encuadradas según el giro y el lienzo, para ver el país completo con todas sus ciudades.
export const EXTREMOS_MEXICO = [[32.53, -117.12], [32.72, -114.72], [31.75, -106.48], [28.7, -100.52], [25.87, -97.5], [21.16, -86.85], [14.9, -92.26], [22.89, -109.91]].map(([lat, lon]) => ({ lat, lon }));
// Pin de cada ciudad en la Vista Mapa: tiendas activas (físicas; las virtuales no son un lugar) y camiones que van hacia ella.
// Nombre legible de una ciudad (pulido de etiquetas): las claves vienen sin acentos y en mayúsculas («SAN LUIS POTOSI»);
// se devuelven con acentos y conectores en minúscula («San Luis Potosí», «Lagos de Moreno»); CDMX abreviada.
const ACENTOS = { MERIDA: 'Mérida', JUAREZ: 'Juárez', CULIACAN: 'Culiacán', MAZATLAN: 'Mazatlán', TORREON: 'Torreón', POTOSI: 'Potosí', LEON: 'León', QUERETARO: 'Querétaro', GUTIERREZ: 'Gutiérrez', CANCUN: 'Cancún', MEXICO: 'México', OBREGON: 'Obregón', TEHUACAN: 'Tehuacán', CORDOBA: 'Córdoba', SAHAGUN: 'Sahagún', ATIZAPAN: 'Atizapán', TONALA: 'Tonalá', MINATITLAN: 'Minatitlán', LAZARO: 'Lázaro', CARDENAS: 'Cárdenas',
  // 4.12.51: más palabras de ciudades/estados/sucursales del ERP (antes «San Nicolás» salía «San Nicolas», «Ciudad Acuña» «Ciudad Acuna»).
  MICHOACAN: 'Michoacán', YUCATAN: 'Yucatán', NICOLAS: 'Nicolás', GARCIA: 'García', JOSE: 'José', RIO: 'Río', GOMEZ: 'Gómez', MARTIN: 'Martín', ANDRES: 'Andrés', CRISTOBAL: 'Cristóbal', CUAUHTEMOC: 'Cuauhtémoc', COYOACAN: 'Coyoacán', ALVARO: 'Álvaro', NEZAHUALCOYOTL: 'Nezahualcóyotl', MARTINEZ: 'Martínez', TECAMAC: 'Tecámac', CUAUTITLAN: 'Cuautitlán', TULTITLAN: 'Tultitlán', TLAHUAC: 'Tláhuac', OCOTLAN: 'Ocotlán', TEPATITLAN: 'Tepatitlán', AUTLAN: 'Autlán', APATZINGAN: 'Apatzingán', ZITACUARO: 'Zitácuaro', PENJAMO: 'Pénjamo', ACAMBARO: 'Acámbaro', RINCON: 'Rincón', JUCHITAN: 'Juchitán', COMITAN: 'Comitán', PATZCUARO: 'Pátzcuaro', TECOMAN: 'Tecomán', QUINTIN: 'Quintín', ACUNA: 'Acuña', PENASCO: 'Peñasco',
  // 4.12.71: más municipios con acento o eñe (antes «Tlajomulco de Zuniga», «Ciudad Guzman», «Ciudad Lopez Mateos», «Chimalhuacan»).
  ZUNIGA: 'Zúñiga', LOPEZ: 'López', GUZMAN: 'Guzmán', CHIMALHUACAN: 'Chimalhuacán', TEZIUTLAN: 'Teziutlán', ZACATLAN: 'Zacatlán', TEOTIHUACAN: 'Teotihuacán', TEPOTZOTLAN: 'Tepotzotlán', ZAPOTLAN: 'Zapotlán', ACATLAN: 'Acatlán', IXTLAN: 'Ixtlán', TIZAPAN: 'Tizapán', MIAHUATLAN: 'Miahuatlán', JALOSTOTITLAN: 'Jalostotitlán', PANUCO: 'Pánuco', GUAMUCHIL: 'Guamúchil', ANAHUAC: 'Anáhuac', VALPARAISO: 'Valparaíso', ALAMOS: 'Álamos', JIMENEZ: 'Jiménez', ZINAPECUARO: 'Zinapécuaro', ENCARNACION: 'Encarnación', CONCEPCION: 'Concepción', ASUNCION: 'Asunción', JESUS: 'Jesús', MARIA: 'María', BAHIA: 'Bahía', CIENEGA: 'Ciénega', ESTACION: 'Estación', PURISIMA: 'Purísima', GONZALEZ: 'González', HERNANDEZ: 'Hernández', PEREZ: 'Pérez', RAMIREZ: 'Ramírez', SANCHEZ: 'Sánchez', DIAZ: 'Díaz', PENON: 'Peñón' };
const CONECTORES = new Set(['DE', 'DEL', 'LA', 'LAS', 'LOS', 'Y', 'EL']);
export function nombreCiudad(ciudad) {
  // 4.12.2: «CDMX» / «Cd. de México» ya no salen «Cdmx» / «Cd de México»; sin letras («123», «-», un número) no es ciudad → ''.
  const k = norm(ciudad); if (!k || !/\p{L}/u.test(k)) return '';
  if (/^(CIUDAD|CD\.?) DE MEXICO$|^CDMX$|^D\.?F\.?$/.test(k)) return 'CDMX';
  return k.split(/\s+/).map((w, i) => ACENTOS[w] || (i > 0 && CONECTORES.has(w) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase())).join(' ');
}
export function pinCiudad(distrito, camiones = []) {
  const nombre = nombreCiudad(distrito?.ciudad);
  // tiendas que no son lista ya no lanzan error; la ciudad empata con norm() (espacios/acentos/mayúsculas) y una ciudad vacía
  // no junta camiones (antes un camión sin ciudad contaba en un distrito sin ciudad: undefined === undefined)
  const activas = comoLista(distrito?.tiendas).filter((t) => t?.vendio && !t.virtual).length, k = norm(distrito?.ciudad);
  const llegando = k ? comoLista(camiones).filter((c) => c && norm(c.ciudad) === k).length : 0;
  // 4.7.63: conteos con miles es-MX («🏬 1,200», antes «🏬 1200») y `nombre` aparte (ciudad en blanco → '').
  const mil = (n) => n.toLocaleString('es-MX');
  return { nombre, activas, llegando, texto: [nombre, `🏬 ${mil(activas)}`, llegando ? `🚚 ${mil(llegando)}` : null].filter(Boolean).join(' · ') };
}
// Acceso rápido (minimapa, paso 1): las n ciudades con más actividad = tiendas activas + camiones llegando (empate: más tiendas).
export function ciudadesTop(modelo, n = 5) {
  n = Math.max(0, Math.floor(Number(n))); if (!Number.isFinite(n)) n = 5; // n en texto/decimal/basura (antes NaN → lista vacía)
  const ds = comoLista(modelo?.distritos).filter(Boolean); // distritos/tiendas que no son lista: vacío, no error ni NaN en el orden
  return ds.map((d) => { const p = pinCiudad(d, modelo?.camiones); const actividad = p.activas + p.llegando;
    // 4.7.67: `cifra` y `titulo` con miles es-MX y `plural()` («León 1,250», «1 tienda activa · 1 camión llegando»; antes «1200 tiendas» y plural a mano en Ciudad.jsx).
    const titulo = `Ir a ${p.nombre}: ${plural(p.activas, 'tienda activa', 'tiendas activas')}${p.llegando ? ` · ${plural(p.llegando, 'camión', 'camiones')} llegando` : ''}`;
    return { ciudad: d.ciudad, nombre: p.nombre, activas: p.activas, llegando: p.llegando, actividad, cifra: actividad.toLocaleString('es-MX'), titulo, tiendas: comoLista(d.tiendas).length }; })
    .filter((c) => c.nombre && c.actividad > 0).sort((x, y) => y.actividad - x.actividad || y.tiendas - x.tiendas).slice(0, n);
}
// Botón único Base/Mapa: estás «en la base» si la cámara está cerca del encuadre de la Vista Base (centro a menos de medio
// encuadre y zoom no más de 1.5× el de la base); si no, estás lejos y el botón ofrece volver. Sin datos cuenta como base.
export function enLaBase(v, b) { if (!v || !b || ![v.zoom, v.cx, v.cz, b.zoom, b.cx, b.cz].every(Number.isFinite)) return true; return Math.hypot(v.cx - b.cx, v.cz - b.cz) <= b.zoom * 0.5 && v.zoom <= b.zoom * 1.5; }
// Viajar (3.90.16): Vista Ciudad = encuadre de las manzanas de un distrito ({ x, z, ancho, largo }) con la calle de enfrente;
// el zoom no pasa de DETALLE.gente para que de cerca se vean la gente y las tiendas.
export function vistaCiudad(caja, op) {
  const { ang = Math.PI / 4, aspecto = 1.6 } = op && typeof op === 'object' ? op : {};
  if (!caja || !Number.isFinite(caja.x) || !Number.isFinite(caja.z)) return null;
  const w = Number.isFinite(caja.ancho) && caja.ancho > 0 ? caja.ancho : 8, l = Number.isFinite(caja.largo) && caja.largo > 0 ? caja.largo : 8;
  const esq = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([a, b]) => ({ x: caja.x + a * w / 2, z: caja.z + b * l / 2 + (b > 0 ? 2 : 0), r: 2 }));
  return encuadre(esq, { ang, aspecto, margen: 1.2, min: 14, max: DETALLE.gente - 5 });
}
// Nivel para el botón: 'base' (campus), 'ciudad' (cerca de la ciudad a la que viajaste) o 'lejos' (mapa o en medio).
export function nivelVista(v, base, ciudad = null) {
  if (enLaBase(v, base)) return 'base';
  // Ciudad con centro ilegible ya no cuenta (antes enLaBase() daba «true» sin datos y el botón decía «ciudad» siempre).
  if (ciudad && [ciudad.zoom, ciudad.cx, ciudad.cz].every(Number.isFinite) && v && [v.zoom, v.cx, v.cz].every(Number.isFinite) && enLaBase(v, ciudad)) return 'ciudad';
  return 'lejos';
}
// Minimapa (paso 2): plano chico norte arriba de ancho × alto px con el contorno EXTREMOS_MEXICO, un punto por ciudad y el
// paso escena ↔ plano. aSvg(x, z) → { u, v }; aEscena(u, v) → { x, z }; marco(vista) = { u, v, r } del marcador de la cámara;
// cercana(u, v, maxPx) = la ciudad más cerca del toque (o null si ninguna queda a menos de maxPx).
export function planoMini(distritos = [], op) {
  let { ancho = 150, alto = 96, margen = 6 } = op && typeof op === 'object' ? op : {};
  ancho = Number.isFinite(ancho) && ancho > 0 ? ancho : 150; alto = Number.isFinite(alto) && alto > 0 ? alto : 96;
  margen = Number.isFinite(margen) && margen >= 0 && margen * 2 < Math.min(ancho, alto) ? margen : Math.min(6, Math.min(ancho, alto) / 4);
  const pts = EXTREMOS_MEXICO.map(posDe);
  const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x)), z0 = Math.min(...pts.map((p) => p.z)), z1 = Math.max(...pts.map((p) => p.z));
  const s = Math.min((ancho - 2 * margen) / (x1 - x0), (alto - 2 * margen) / (z1 - z0));
  const ox = (ancho - (x1 - x0) * s) / 2, oz = (alto - (z1 - z0) * s) / 2;
  const aSvg = (x, z) => ({ u: ox + (x - x0) * s, v: oz + (z - z0) * s });
  // 4.12.9: el toque en el borde del plano (fuera del contorno) ya no lleva la cámara al mar: se acota a las puntas de México;
  // u/v ilegibles (NaN, texto basura) → null (el minimapa no mueve la cámara) en vez de { x: NaN, z: NaN }.
  const aEscena = (u, v) => { u = numO(u, NaN); v = numO(v, NaN); if (!Number.isFinite(u) || !Number.isFinite(v)) return null; return { x: Math.max(x0, Math.min(x1, x0 + (u - ox) / s)), z: Math.max(z0, Math.min(z1, z0 + (v - oz) / s)) }; };
  const r1 = (n) => Math.round(n * 10) / 10;
  const contorno = pts.map((p) => { const q = aSvg(p.x, p.z); return `${r1(q.u)},${r1(q.v)}`; }).join(' ');
  const puntos = (Array.isArray(distritos) ? distritos : []).filter((d) => d?.ciudad && Number.isFinite(d?.pos?.x) && Number.isFinite(d?.pos?.z)).map((d) => { const q = aSvg(d.pos.x, d.pos.z); return { ciudad: d.ciudad, u: r1(q.u), v: r1(q.v) }; });
  const marco = (vista) => { if (!vista || !Number.isFinite(vista.cx) || !Number.isFinite(vista.cz)) return null; const q = aSvg(vista.cx, vista.cz); return { u: r1(Math.max(0, Math.min(ancho, q.u))), v: r1(Math.max(0, Math.min(alto, q.v))), r: r1(Math.max(3, Math.min(alto / 2, (Number.isFinite(vista.zoom) ? vista.zoom : 0) * s))) }; };
  const cercana = (u, v, maxPx = 8) => { let mejor = null, dm = maxPx; for (const p of puntos) { const dd = Math.hypot(p.u - u, p.v - v); if (dd <= dm) { dm = dd; mejor = p.ciudad; } } return mejor; };
  return { ancho, alto, contorno, puntos, aSvg, aEscena, marco, cercana };
}
// Última vista por usuario (localStorage): clave por user_id y lectura tolerante. leerVista(texto) → { cx, cz, zoom } o null si
// el texto no es JSON, faltan números o el centro cae fuera de México (con un margen); el zoom se acota a [ZOOM_MIN, ZOOM_MAX].
// 4.7.75: el user_id se limpia (espacios fuera); si llega como objeto, lista, booleano, NaN o en blanco usa «anon» (antes
// «acteck.ciudad.vista.[object Object]» y « u1 » guardaba otra vista que «u1»).
export const claveVista = (userId) => { const id = typeof userId === 'string' ? userId.trim() : typeof userId === 'number' && Number.isFinite(userId) ? String(userId) : ''; return `acteck.ciudad.vista.${id || 'anon'}`; };
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
// Fecha de «hoy» siempre válida: Date válido tal cual; 'AAAA-MM-DD' (a mediodía local) o número/ISO
// si se pueden leer; cualquier otra cosa (null, texto, fecha inválida) → ahora. Evita que una
// fecha mala tumbe el modelo o una capa de la Ciudad.
export function fechaHoy(h) {
  if (h instanceof Date) return Number.isNaN(h.getTime()) ? new Date() : h;
  if (typeof h === 'string' || typeof h === 'number') {
    const t = typeof h === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(h.trim()) ? new Date(`${h.trim()}T12:00:00`) : new Date(h);
    if (!Number.isNaN(t.getTime())) return t;
  }
  return new Date();
}

export function resumenBanco(cartera = [], pagos = [], hoyIso = diaLocal().iso, reglas = null) {
  // Pulido (4.3.28): «hoy» inválido usa hoy (antes NaN: ningún pago contaba); fechas de pago con `fechaIso()` (« 2026-10-09»
  // con espacios o un Date ya cuentan; una programada ilegible cae a la de compromiso); estado con espacios/mayúsculas
  // («Rechazado », « pagado») se lee; reglas que no son función o que lanzan error con un pago no tiran el banco.
  hoyIso = fechaIso(hoyIso) ?? fechaIso(fechaHoy(hoyIso));
  const conVencido = comoLista(cartera).filter((c) => N(c?.vencido) > 0);
  const fn = (f) => (typeof f === 'function' ? f : null), vence = fn(reglas?.venceEn), vencido = fn(reglas?.estaVencido);
  const seguro = (f, ...a) => { try { return !!f(...a); } catch { return false; } };
  const limpio = (p) => { const est = typeof p.estado === 'string' ? p.estado.trim().toLowerCase() : p.estado; const fp = fechaIso(p.fecha_programada), fc = fechaIso(p.fecha_compromiso); return { ...p, estado: est, fecha_programada: fp ?? fc, fecha_compromiso: fc }; };
  const abiertos = vence && vencido ? comoLista(pagos).filter((p) => p && typeof p === 'object').map(limpio).filter((p) => p.estado !== 'rechazado') : [];
  const semana = abiertos.filter((p) => seguro(vence, p, 7, hoyIso)), vencidos = abiertos.filter((p) => seguro(vencido, p, hoyIso));
  // 4.7.81: saldo total, % vencido y DSO ponderado por saldo (sólo cuentas con saldo > 0 y DSO), igual que la cartera de Inicio
  // (`dsoPonderado(filas, { soloConSaldo: true })`, `pctDe(vencido, saldo)`), para que el banco cuadre con el dashboard.
  const filasC = comoLista(cartera).filter((c) => c && typeof c === 'object');
  const saldo = filasC.reduce((s, c) => s + N(c.saldo), 0), vencTotal = filasC.reduce((s, c) => s + N(c.vencido), 0);
  let num = 0, den = 0; for (const c of filasC) { if (c.dso == null || !(N(c.saldo) > 0)) continue; const k = leeNum(c.dso); if (k == null) continue; num += k * N(c.saldo); den += N(c.saldo); }
  // 4.12.27: cartera a más de 90 días (`aging_mas90`), como la frase de cartera de Inicio («$X con más de 90 días»).
  const mas90 = filasC.reduce((s, c) => s + Math.max(0, N(c.mas90)), 0);
  const dso = den > 0 ? Math.round(num / den) : null, pctVencido = saldo > 0 ? (vencTotal / saldo) * 100 : null;
  return { saldo, pctVencido, dso, mas90, carteraVencida: conVencido.reduce((s, c) => s + N(c.vencido), 0), cuentasVencidas: conVencido.length, pagosSemana: semana.length, montoSemana: semana.reduce((s, p) => s + N(p.monto), 0), pagosVencidos: vencidos.length, montoVencido: vencidos.reduce((s, p) => s + N(p.monto), 0) };
}

/** Torre de pronóstico (3.90.29): propuestas de forecast no borrador (`forecast_propuestas` + líneas, como Proyectos y forecast)
 *  y avisos de arribo (`forecast_avisos`) de ayer a 7 días. Un aviso con fecha ya pasada = atrasado. */
export function resumenTorre(propuestas = [], avisos = [], hoyIso = diaLocal().iso) {
  // Pulido (3.110.4): líneas nulas y una fecha inválida ya no tiran el modelo (la fecha mala usa hoy).
  // Pulido (4.3.27): fechas con `fechaIso()` — « 2026-10-08» (espacios) ya no sale atrasado, una fecha ilegible no cuenta
  // y un Date sí; hoy con espacios/Date se lee; líneas que no son lista (objeto, texto) ya no cuentan como línea.
  hoyIso = fechaIso(hoyIso) ?? fechaIso(fechaHoy(hoyIso)); const t0 = Date.parse(`${hoyIso}T00:00:00Z`);
  // Pulido (4.7.82): estatus con espacios/mayúsculas (« Borrador ») sigue siendo borrador; un cierre en blanco (« ») o
  // ilegible no cierra la propuesta; `confirmado` en texto ('false', '0', '') ya no cuenta como confirmada; un
  // `comprado_at` en blanco ya no cuenta como comprada; piezas negativas no restan; renglones que no son objeto se saltan.
  const esObj = (x) => x && typeof x === 'object' && !Array.isArray(x);
  const si = (v) => (typeof v === 'string' ? ['true', 't', 'si', 'sí', '1'].includes(v.trim().toLowerCase()) : v === true || v === 1);
  const hay = (v) => (typeof v === 'string' ? !!v.trim() : v instanceof Date ? Number.isFinite(v.getTime()) : v != null && v !== false);
  const ps = comoLista(propuestas).filter((p) => esObj(p) && (typeof p.estatus === 'string' ? p.estatus.trim().toLowerCase() : p.estatus) !== 'borrador');
  const lineas = ps.flatMap((p) => comoLista(p.forecast_propuesta_lineas)).filter(esObj);
  const mas7 = new Date(t0 + 7 * 86400000).toISOString().slice(0, 10);
  const av = comoLista(avisos).filter(esObj).map((a) => [a, fechaIso(a.fecha_arribo)]).filter(([, f]) => f && f <= mas7);
  const atrasados = av.filter(([, f]) => f < hoyIso);
  return { abiertas: ps.filter((p) => !hay(p.cerrado_at)).length, lineas: lineas.length, confirmadas: lineas.filter((l) => si(l.confirmado)).length, compradas: lineas.filter((l) => hay(l.comprado_at)).length, arribos7: av.length - atrasados.length, piezas7: av.reduce((s, [a]) => s + Math.max(0, N(a.piezas_a_reservar)), 0), atrasados: atrasados.length };
}

// «Hoy en Acteck» (etapa 4, 3.90.46): misiones del día para la lista con «Ir». Junta las alertas de las burbujas (banco,
// puerto, CEDIS), las reuniones de hoy (en curso / próximas; las hechas quedan al final con ✓) y los contenedores que se
// están descargando. Cada misión trae `ir` (a dónde vuela la cámara) y `tarjeta` (qué tarjeta abre). Rojo, ámbar, luego por hora.
export function misionesDelDia(m, hoy = new Date(), max = 8) {
  max = cuantos(max, 8);
  hoy = fechaHoy(hoy);
  if (!m) return [];
  const out = [];
  for (const b of burbujasAtencion(m, hoy)) if (b.lugar !== 'oficina') out.push({ id: `alerta-${b.lugar}`, icono: b.icono, nivel: b.nivel, texto: b.texto, ir: b.tag, tarjeta: b.tag, orden: 0 });
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  for (const r of comoLista(m.oficina?.agenda)) { // 4.7.71: agenda que no es lista ya no lanza error
    if (!r) continue; const ini = Number.isFinite(r.ini) ? r.ini : null; const hecha = r.estado === 'hecha', falta = ini == null ? NaN : ini - ahora;
    out.push({ id: `reunion-${r.hora}-${r.titulo}`, icono: '📅', nivel: r.estado === 'en curso' || (falta >= 0 && falta <= 15) ? 'ambar' : null, hecha,
      texto: `${unirTexto(r.hora, unirTexto(r.titulo) || 'Reunión') /* 4.7.36: título vacío/null ya no dice «null» */}${r.estado === 'en curso' ? ' · ahora' : !hecha && falta >= 0 && falta <= 15 ? ` · ${enMinutos(falta)}` : ''}`, ir: { tipo: 'oficina' }, tarjeta: { tipo: 'sala', titulo: 'Sala de juntas', sub: 'Reuniones de hoy' }, orden: ini ?? 24 * 60 });
  }
  for (const t of comoLista(m.puerto?.tarimas)) if (t) { const id = unirTexto(t.id); out.push({ id: `tarima-${id || 'sin-id'}`, icono: '📦', nivel: null, texto: unirTexto(`Descargar ${id || 'un contenedor'}`, piezasSiHay(t.piezas)) /* 4.12.67: sin «· 0 pz» */, ir: { tipo: 'cedis' }, tarjeta: { tipo: 'barco', id: t.id, titulo: id ? `Contenedor ${id}` : 'Contenedor' }, orden: 24 * 60 }); } // 4.7.35: sin id ya no dice «undefined»; tarimas que no son lista no truenan
  const peso = (x) => (x.hecha ? 3 : x.nivel === 'rojo' ? 0 : x.nivel === 'ambar' ? 1 : 2);
  return out.sort((a, c) => peso(a) - peso(c) || a.orden - c.orden).slice(0, max).map(({ orden, ...x }) => ({ hecha: false, ...x }));
}

// Cuentas sin sucursal repartidas por estado (etapa 5, 3.90.56): con su sell out a clientes finales por estado
// (`mv_sellout_cliente_final_mes`: cuenta, anio, mes, estado, importe) → una tienda «Clientes en <ciudad>» por ciudad
// representativa del estado (`CIUDAD_POR_ESTADO`), sin la `sede` (ahí ya está su Matriz), top `max` por actividad.
export function repartoPorEstado(cuenta, filas = [], op) {
  let { anio, mes, anioPrev, mesPrev, sede = null, max = 6 } = op && typeof op === 'object' ? op : {}; // (4.3.19) opciones null → omisión
  const por = new Map(); const clave = claveTexto; const cta = clave(cuenta); if (!cta) return [];
  anio = Number(anio); mes = Number(mes); anioPrev = Number(anioPrev); mesPrev = Number(mesPrev); max = cuantos(max, 6);
  for (const r of comoLista(filas)) {
    if (clave(r?.cuenta) !== cta) continue; const est = norm(r.estado);
    const ciudad = CIUDAD_POR_ESTADO[est]; if (!ciudad || ciudad === sede) continue;
    const a = Number(r.anio), ms = Number(r.mes), imp = numero(r.importe); const o = por.get(ciudad) || { ciudad, importe: 0, previo: 0 };
    if (a === anio && ms === mes) o.importe += imp; else if (a === anioPrev && ms === mesPrev) o.previo += imp; else continue;
    por.set(ciudad, o);
  }
  return [...por.values()].filter((o) => o.importe > 0 || o.previo > 0).sort((a, c) => (c.importe + c.previo) - (a.importe + a.previo) || (a.ciudad < c.ciudad ? -1 : 1)).slice(0, max);
}

// Barcos por ETA real (etapa 5, 3.90.55): dónde va cada barco sin arribo al CEDIS. ETA vencida o de hoy → en el puerto:
// el más atrasado atraca y descarga (`muelle` 0), los demás esperan en fila (`muelle` 1, 2…); llega en ≤ 7 días → se
// acerca (`avance` = 1 − días/8); más lejos o sin ETA → mar abierto (`avance` ≤ .6, con el progreso de sus fechas).
// (4.3.10) ETA en texto («3») cuenta igual; vacía o basura («», «abc», NaN) = sin ETA (antes «» se tomaba como 0 y atracaba).
const etaDias = (v) => (v == null || (typeof v === 'string' && !v.trim()) ? null : (Number.isFinite(Number(v)) ? Number(v) : null));
export function rumboBarcos(barcos = []) {
  barcos = Array.isArray(barcos) ? barcos : [];
  const enPuerto = barcos.map((b, i) => ({ b, i, d: etaDias(b?.llegaEnDias) })).filter(({ b, d }) => !b?.arribo && d != null && d <= 0).sort((a, c) => a.d - c.d || a.i - c.i);
  const fila = new Map(enPuerto.map(({ i }, k) => [i, k]));
  return barcos.map((b, i) => {
    if (fila.has(i)) { const k = fila.get(i); return { modo: k === 0 ? 'atracado' : 'esperando', muelle: k, avance: 1 }; }
    const d = etaDias(b?.llegaEnDias);
    if (!b?.arribo && d != null && d > 0 && d <= 7) return { modo: 'llegando', muelle: null, avance: Math.round((1 - d / 8) * 1000) / 1000 };
    return { modo: 'navegando', muelle: null, avance: Math.min(.6, Math.max(0, Number(b?.progreso) || 0)) };
  });
}

// Cadena de punta a punta (etapa 5, 3.90.58, como Anno 1800 / Factorio): mar → puerto → CEDIS → camiones → tiendas →
// clientes finales, con el volumen de cada tramo y su tono; `atasco` = el primer tramo en rojo (o ámbar si no hay rojo).
// Sólo usa lo que ya trae el modelo (mismos umbrales que las tarjetas: CEDIS 90/120 días, envío > 5 días en ámbar).
export function cadenaSuministro(m, hoyIso = m?.hoyIso) {
  if (!m) return { tramos: [], atasco: null };
  const n = numero; const pz = piezasTexto; // 4.12.49: «1,500 pz» como globos, bitácora y puerto (antes «pzs»)
  // ETA en días legible (texto «-2» cuenta; vacía, null o basura = sin ETA, sigue en el mar).
  const eta = (b) => leeNum(b.llegaEnDias);
  const barcos = comoLista(m.puerto?.barcos).filter(Boolean);
  const mar = barcos.filter((b) => !(eta(b) != null && eta(b) <= 0)), enPuerto = barcos.filter((b) => eta(b) != null && eta(b) <= 0);
  const tarde = enPuerto.filter((b) => eta(b) < -3).length;
  // 4.12.31: el que llega hoy (ETA 0) ya no cuenta «con ETA vencida» ni pinta ámbar (como `llegaBarco()`: «llega hoy»).
  const vencidos = enPuerto.filter((b) => eta(b) < 0).length, hoyPuerto = enPuerto.length - vencidos;
  // 4.12.50: el puerto ya no dice «0 con ETA vencida» / «0 recién llegados»: sólo lo que hay; vacío, «Sin movimiento».
  const recien = comoLista(m.puerto?.tarimas).filter(Boolean).length;
  const c = m.cedis || {}, d = diasCedis(c.dias);
  const cam = comoLista(m.camiones).filter(Boolean);
  const lentos = cam.filter((x) => x.envio && hoyIso && x.fecha && dias(x.fecha, hoyIso) > 5).length;
  const distritos = comoLista(m.distritos).filter(Boolean);
  const tiendas = distritos.flatMap((x) => comoLista(x.tiendas)).filter((t) => t && !t.reparto);
  const activas = tiendas.filter((t) => t.vendio).length, ratio = tiendas.length ? activas / tiendas.length : 1;
  const cf = distritos.reduce((s, x) => ({ n: s.n + n(x.clientesFinales?.n), imp: s.imp + n(x?.clientesFinales?.importe) }), { n: 0, imp: 0 });
  // 4.12.66: mar, camiones, tiendas y clientes vacíos dicen «Sin …» (antes «0 barcos · 0 pz», «0 de 0 vendieron»), como el puerto.
  const tramos = [
    { clave: 'mar', titulo: 'En el mar', icono: '🚢', volumen: mar.length ? `${plural(mar.length, 'barco')} · ${pz(mar.reduce((s, b) => s + n(b.piezas), 0))}` : 'Sin barcos en el mar', estado: mar.length ? 'verde' : 'gris', motivo: null },
    { clave: 'puerto', titulo: 'Puerto', icono: '⚓', volumen: [vencidos ? `${vencidos.toLocaleString('es-MX')} con ETA vencida` : '', hoyPuerto ? `${plural(hoyPuerto, 'llega', 'llegan')} hoy` : '', recien ? plural(recien, 'recién llegado') : ''].filter(Boolean).join(' · ') || 'Sin movimiento', estado: tarde ? 'rojo' : vencidos ? 'ambar' : 'verde', motivo: tarde ? `${plural(tarde, 'barco')} con más de 3 días de atraso` : vencidos ? `${plural(vencidos, 'barco')} esperando muelle` : null }, // 4.12.36: cuenta los barcos (antes «Barcos» con uno solo)
    { clave: 'cedis', titulo: 'CEDIS', icono: '🏭', volumen: `${pz(c.piezas)} · ${diasTexto(d)}`, estado: tonoDias(d) || 'gris', motivo: motivoDias(d) },
    { clave: 'camion', titulo: 'Camiones', icono: '🚚', volumen: cam.length ? `${cam.length.toLocaleString('es-MX')} en ruta · ${pz(cam.reduce((s, x) => s + n(x.piezas), 0))}` : 'Sin camiones en ruta', estado: lentos ? 'ambar' : cam.length ? 'verde' : 'gris', motivo: lentos ? `${plural(lentos, 'envío')} con más de 5 días en camino` : null },
    { clave: 'tienda', titulo: 'Tiendas', icono: '🏬', volumen: tiendas.length ? `${activas.toLocaleString('es-MX')} de ${tiendas.length.toLocaleString('es-MX')} vendieron` : 'Sin tiendas', estado: tonoActivas(activas, tiendas.length) || 'gris', motivo: tiendas.length && ratio < 0.7 ? `${plural(tiendas.length - activas, 'tienda')} sin venta este mes` : null },
    { clave: 'cliente', titulo: 'Clientes finales', icono: '🏠', volumen: cf.n ? `${plural(cf.n, 'cliente')} · ${pesosCorto(cf.imp)}` : 'Sin clientes finales', estado: cf.n ? 'verde' : 'gris', motivo: null },
  ];
  return { tramos, atasco: tramos.find((t) => t.estado === 'rojo') || tramos.find((t) => t.estado === 'ambar') || null };
}
// Cintas de la cadena en la escena (3.90.59): mar → puerto → CEDIS y CEDIS → las `max` ciudades con más camiones o tiendas.
// `peso` 1–4 (grosor) por volumen relativo; tono del tramo (ciudad: tiendas sin venta como en la tira, ámbar si le va un envío lento).
export function cintasCadena(m, max = 8) {
  max = cuantos(max, 8);
  const cad = cadenaSuministro(m); if (!cad.tramos.length) return [];
  const est = Object.fromEntries(cad.tramos.map((t) => [t.clave, t.estado]));
  const peso = (v, tope) => (tope > 0 ? 1 + Math.round(3 * Math.min(1, v / tope)) : 1);
  // 4.7.70: barcos, tarimas, camiones, distritos y tiendas que no son lista ya no lanzan error; el camión empata su ciudad con
  // norm() (« leon » = «LEON», como el pin) y un camión o distrito sin ciudad no hace cinta (antes «cedis → undefined»).
  const barcos = comoLista(m.puerto?.barcos).filter(Boolean).length;
  const out = [{ de: 'mar', a: 'puerto', tono: est.puerto === 'rojo' ? 'rojo' : est.mar, peso: peso(barcos, 8) }, { de: 'puerto', a: 'cedis', tono: est.puerto, peso: peso(barcos + comoLista(m.puerto?.tarimas).filter(Boolean).length, 8) }];
  const cam = new Map(); for (const c of comoLista(m.camiones)) { const k = norm(c?.ciudad); if (!k) continue; const o = cam.get(k) || { n: 0, lento: false }; o.n += 1; if (c.envio && m.hoyIso && c.fecha && dias(c.fecha, m.hoyIso) > 5) o.lento = true; cam.set(k, o); }
  const ciudades = comoLista(m.distritos).filter((d) => d && norm(d.ciudad)).map((d) => { const ts = comoLista(d.tiendas).filter((t) => t && !t.reparto); const r = ts.length ? ts.filter((t) => t.vendio).length / ts.length : 1; const c = cam.get(norm(d.ciudad)) || { n: 0, lento: false };
    return { ciudad: d.ciudad, n: c.n, tiendas: ts.length, tono: tonoActivas(r * ts.length, ts.length) === 'rojo' ? 'rojo' : c.lento || tonoActivas(r * ts.length, ts.length) === 'ambar' ? 'ambar' : c.n || ts.length ? 'verde' : 'gris' }; })
    .filter((x) => x.n || x.tiendas).sort((a, b) => b.n - a.n || b.tiendas - a.tiendas).slice(0, max);
  const tope = Math.max(1, ...ciudades.map((x) => x.n));
  for (const x of ciudades) out.push({ de: 'cedis', a: x.ciudad, tono: x.tono, peso: peso(x.n, tope) });
  return out;
}

// Rutas de vendedores (etapa 5, 3.90.53): el circuito del vendedor por las sedes de sus clientes principales — ciudades
// únicas con carretera (`tieneRuta`), máximo `max`, en el orden de `destinos` (de más a menos facturación). tramoActual()
// reparte un ciclo (0–1) en tramos iguales: CEDIS → 1.ª sede → … → última sede → CEDIS (n paradas = n + 1 tramos).
export function circuitoVendedor(destinos = [], tieneRuta = () => true, max = 3) {
  // (4.3.11) Acepta algo que no es lista, `tieneRuta` que no es función (todas tienen ruta) y max 0/decimal/NaN (usa 3).
  const out = []; const vistas = new Set(); const ruta = typeof tieneRuta === 'function' ? tieneRuta : () => true;
  const tope = Number.isFinite(Number(max)) && Number(max) >= 1 ? Math.floor(Number(max)) : 3;
  for (const d of Array.isArray(destinos) ? destinos : []) { if (!d?.ciudad || vistas.has(d.ciudad) || !ruta(d.ciudad)) continue; vistas.add(d.ciudad); out.push(d); if (out.length >= tope) break; }
  return out;
}
export function tramoActual(ciclo, paradas) {
  const n = Math.max(1, Number.isFinite(Number(paradas)) ? Math.floor(Number(paradas)) : 1) + 1; const k = Number(ciclo), c = Number.isFinite(k) ? ((k % 1) + 1) % 1 : 0; const i = Math.min(n - 1, Math.floor(c * n));
  return { i, q: c * n - i, tramos: n };
}

// Pensamientos (etapa 4, paso 1, 3.90.52), como RollerCoaster Tycoon: frases cortas en primera persona sobre tiendas con
// reglas del modelo (no por tamaño: se mira la tendencia). Una por ciudad como máximo y `max` en total; primero lo que pide
// atención (rojo), luego lo bueno. Reglas: cuenta con cartera vencida → «Tengo pagos vencidos»; la tienda vendió el mes
// anterior y éste no → «Este mes no he vendido nada»; cae > 30 % → «Vendo N % menos que el mes pasado»; sube > 30 % →
// «¡Voy N % arriba del ritmo del mes pasado!»; cuenta al ritmo de su cuota (`m.cuotas`) → «Voy a buen ritmo con mi cuota (N %)» o, ya cumplida, «¡Ya llegué a mi cuota!».
export function pensamientos(m, max = 5) {
  max = cuantos(max, 5);
  if (!m) return [];
  // 4.3.3: salta cartera/distritos/tiendas nulos y un hoyIso inválido usa hoy (antes lanzaba error o ritmo NaN).
  // 4.7.71: cartera/distritos/tiendas que no son lista ya no lanzan error; la cuenta vencida empata con espacios (« pcel » = «pcel»)
  // 4.12.24: el tono sale del semáforo de cartera de Inicio (`tonoCartera()`): vencido ≤ 15 % del saldo de la cuenta es ámbar
  // (va tras «no he vendido nada»); más, o sin saldo legible, rojo. Antes cualquier peso vencido decía rojo, distinto de la tienda.
  const venc = new Map();
  for (const c of comoLista(m.kpis?.cartera)) {
    const cta = unirTexto(c?.cuenta), v = numero(c?.vencido), sal = numero(c?.saldo); if (!cta || !(v > 0)) continue;
    const tono = tonoCartera(v, sal > 0 ? (v / sal) * 100 : null); if (venc.get(cta) !== 'rojo') venc.set(cta, tono); // con dos renglones gana el peor
  }
  const q = m.cuotas instanceof Map ? m.cuotas : new Map(); const h = fechaHoy(m.hoyIso);
  const ritmo = h.getDate() / new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
  const out = [];
  for (const d of comoLista(m.distritos)) {
    if (!d) continue; let mejor = null;
    for (const t of comoLista(d.tiendas)) {
      if (!t || t.reparto) continue; // «Clientes en …» (3.90.56) no es una tienda que piense
      // 4.12.14: el mes en curso va a medias, así que se compara contra el mes pasado al mismo ritmo (previo × día/días del
      // mes); antes a principio de mes casi todas decían «Vendo 90 % menos» y el día 1 todas «no he vendido nada».
      const act = numero(t.importe), prev = numero(t.previo), esperado = prev * ritmo, cambio = esperado > 0 ? Math.round((act / esperado - 1) * 100) : null, cta = unirTexto(t.cuenta), cu = q.get(t.cuenta) ?? q.get(cta);
      const quien = { ciudad: d.ciudad, cuenta: t.cuenta, sucursal: t.sucursal, nombre: nombreTienda(t) };
      let p = null;
      if (cta && venc.get(cta) === 'rojo') p = { tono: 'rojo', peso: 0, texto: 'Tengo pagos vencidos' };
      else if (prev > 0 && act <= 0) p = h.getDate() > 10 ? { tono: 'rojo', peso: 1, texto: 'Este mes no he vendido nada' } : null; // como `vendio` de la tienda: los primeros 10 días aún no cuenta
      else if (cta && venc.get(cta) === 'ambar') p = { tono: 'ambar', peso: 1.5, texto: 'Tengo algo de cartera vencida' };
      else if (cambio != null && cambio < -30) p = { tono: 'ambar', peso: 2, texto: `Voy ${porcentaje(-cambio)} abajo del ritmo del mes pasado` };
      else if (cambio != null && cambio > 30) p = { tono: 'verde', peso: 3, texto: `¡Voy ${porcentaje(cambio)} arriba del ritmo del mes pasado!` };
      // 4.12.64: al ritmo de la cuota no es «arriba de mi cuota» (a medio mes con 60 % decía eso): ≥ 100 % «¡Ya llegué a mi
      // cuota!», si no «Voy a buen ritmo con mi cuota (60 %)».
      else if (numero(cu?.cuota) > 0 && numero(cu.venta) / numero(cu.cuota) >= ritmo) { const av = numero(cu.venta) / numero(cu.cuota); p = { tono: 'verde', peso: 4, texto: av >= 1 ? '¡Ya llegué a mi cuota!' : `Voy a buen ritmo con mi cuota (${porcentaje(Math.floor(av * 100))})` }; }
      if (p && (!mejor || p.peso < mejor.peso)) mejor = { ...quien, ...p };
    }
    if (mejor) out.push(mejor);
  }
  return out.sort((a, c) => a.peso - c.peso).slice(0, max).map(({ peso, ...x }) => x);
}

// Bitácora en vivo (etapa 4, paso 1, 3.90.50): eventos recientes con lo que ya trae el modelo — facturas que salieron
// (camiones), envíos surtidos del Tracking, contenedores que llegaron al CEDIS y reuniones de hoy que ya empezaron. Lo más
// nuevo primero; cada uno con `cuando` (hoy / ayer / hace N d, o la hora) e `ir` para volar al lugar.
// 4.7.80: camiones, barcos/tarimas, pagos y agenda que no son lista (objeto, número, texto) se saltan con comoLista() (antes lanzaba error).
export function bitacoraEventos(m, hoy = new Date(), max = 12) {
  max = cuantos(max, 12);
  hoy = fechaHoy(hoy);
  if (!m) return [];
  // 4.3.33: montos con `pesosCorto()` (999 600 ya no sale «$1000 K» sino «$1.0 M»; negativos «-$5 K» en vez de «$-5000»).
  const pesos = pesosCorto;
  // 4.3.30: «hoy» del modelo y fechas de camiones/arribos con `fechaIso()` (« 2026-10-03» o un Date ya cuentan; ilegible se salta, antes «hace NaN d»).
  const hoyIso = fechaIso(m.hoyIso) || isoLocal(hoy);
  const diasAtras = (f) => dias(f, hoyIso);
  const cuando = (f) => haceDias(diasAtras(f)) || 'hoy';
  const out = [];
  // 4.7.61: sin folio/id, cada renglón lleva su propio id (antes dos facturas, envíos o contenedores sin folio daban el mismo
  // «factura-null» y el filtro de repetidos dejaba sólo uno en la bitácora); con folio, el mismo folio sigue saliendo una vez.
  let sinId = 0;
  const idDe = (pre, v, f) => { const k = unirTexto(v); return k ? `${pre}-${k}` : `${pre}-sin-id-${f}-${sinId++}`; };
  for (const c of comoLista(m.camiones)) {
    const f = fechaIso(c?.fecha); if (!f || f > hoyIso) continue;
    out.push(c.envio
      ? { id: idDe('envio', c.folio, f), icono: '🚚', texto: unirTexto(`Salió ${unirTexto(c.folio) || 'un envío'}${unirTexto(c.cliente) ? ` a ${unirTexto(c.cliente)}` : ''}`, c.paqueteria), clave: `${f} 00:01`, cuando: cuando(f), ir: { tipo: 'ciudad', ciudad: c.ciudad } }
      : { id: idDe('factura', c.folio, f), icono: '🧾', texto: unirTexto(unirTexto(c.folio) ? `Factura ${unirTexto(c.folio)}` : 'Factura', c.cliente, pesos(c.monto)), clave: `${f} 00:01`, cuando: cuando(f), grande: numero(c.monto) >= 500000, ir: { tipo: 'ciudad', ciudad: c.ciudad } });
  }
  for (const b of [...comoLista(m.puerto?.tarimas), ...comoLista(m.puerto?.barcos)]) {
    const f = fechaIso(b?.arribo); if (!f || f > hoyIso) continue;
    const bid = unirTexto(b.id);
    out.push({ id: idDe('arribo', b.id, f), icono: '📦', texto: unirTexto(`Llegó ${bid || 'un contenedor'} al CEDIS`, piezasSiHay(b.piezas)), clave: `${f} 00:00`, cuando: cuando(f), ir: { tipo: 'cedis' }, tarjeta: { tipo: 'barco', id: b.id, titulo: bid ? `Contenedor ${bid}` : 'Contenedor' } });
  }
  // 4.7.31: textos con `unirTexto()`: cliente, folio, contenedor, concepto, estado o título vacíos/nulos ya no dicen «null».
  // Paso 2 (3.90.51): pagos registrados (Pagos V3, `pagado_at` de los últimos días) y la última sincronización del puente.
  // 4.3.33: con `instante()`: 'AAAA-MM-DD' sola es ese día local (antes UTC: el pago salía «ayer»), espacios y Date cuentan.
  const fechaHora = (ts) => { const t = instante(ts); if (!t) return null; const p2 = (n) => String(n).padStart(2, '0'); return { f: `${t.getFullYear()}-${p2(t.getMonth() + 1)}-${p2(t.getDate())}`, h: `${p2(t.getHours())}:${p2(t.getMinutes())}` }; };
  for (const p of comoLista(m.pagosHechos)) {
    const fh = p?.pagado_at ? fechaHora(p.pagado_at) : null; if (!fh || fh.f > hoyIso) continue;
    out.push({ id: `pago-${p.id ?? `${p.pagado_at}-${p.cliente}`}`, icono: '💸', texto: unirTexto('Pago registrado', p.cliente, p.concepto, pesos(p.monto)), clave: `${fh.f} ${fh.h}`, cuando: fh.f === hoyIso ? fh.h : cuando(fh.f), grande: numero(p.monto) >= 500000, ir: { tipo: 'banco' }, tarjeta: { tipo: 'banco' } });
  }
  const sy = m.ultimaSync?.created_at ? fechaHora(m.ultimaSync.created_at) : null;
  if (sy && sy.f <= hoyIso) out.push({ id: 'sync', ...textoSync(m.ultimaSync.status, m.ultimaSync.fuente), clave: `${sy.f} ${sy.h}`, cuando: sy.f === hoyIso ? sy.h : cuando(sy.f), ir: null });
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  for (const r of comoLista(m.oficina?.agenda)) if (r && Number.isFinite(r.ini) && r.ini <= ahora) out.push({ id: `reunion-${r.hora}-${r.titulo}`, icono: '📅', texto: `${r.estado === 'en curso' ? 'Empezó' : 'Fue'} ${unirTexto(r.titulo) || 'una reunión'}`, clave: `${hoyIso} ${r.hora}`, cuando: r.hora, ir: { tipo: 'oficina' }, tarjeta: { tipo: 'sala', titulo: 'Sala de juntas', sub: 'Reuniones de hoy' } });
  const vistos = new Set();
  return out.sort((a, c) => (a.clave < c.clave ? 1 : a.clave > c.clave ? -1 : 0)).filter((x) => !vistos.has(x.id) && vistos.add(x.id)).slice(0, max).map(({ clave, ...x }) => ({ grande: false, tarjeta: null, ir: null, ...x }));
}

// Celebraciones (etapa 6, 3.90.62): `cuota` = { pct } si el total de las cuentas con cuota (`m.cuotas`) ya cruzó el 100 % del mes
// (fuegos artificiales sobre la base); `tiendas` = las que vendieron este mes sin haber vendido el mes anterior (≈ 30 días o más
// sin venta y volvieron; confeti), sin las de reparto, de mayor a menor venta, máximo `max`.
export function celebraciones(m, max = 5) {
  max = cuantos(max, 5);
  const q = m?.cuotas instanceof Map ? [...m.cuotas.values()].filter(Boolean) : [];
  // 4.7.16: montos en texto («$5,000») con `numero()` (antes 0: no celebraba la cuota ni ordenaba tiendas).
  const venta = q.reduce((s, x) => s + numero(x.venta), 0), cuo = q.reduce((s, x) => s + numero(x.cuota), 0);
  // 4.7.69: distritos o tiendas que no son lista ya no lanzan error.
  const tiendas = comoLista(m?.distritos).filter(Boolean).flatMap((d) => comoLista(d.tiendas).filter((t) => t && !t.reparto && t.vendioMes && !(numero(t.previo) > 0)).map((t) => ({ ciudad: d.ciudad, cuenta: t.cuenta, sucursal: t.sucursal, importe: numero(t.importe) })))
    .sort((a, b) => b.importe - a.importe).slice(0, max);
  return { cuota: cuo > 0 && venta >= cuo ? { pct: Math.round(venta / cuo * 100) } : null, tiendas };
}

// Cuota vs ritmo de un grupo de cuentas (3.90.60; la usan la capa «Cuota» y las tarjetas de ciudad y tienda): venta ÷ cuota
// del mes de las cuentas con cuota (sumadas, el % se saca al final) contra el ritmo esperado al día de hoy. null = ninguna tiene cuota.
export function cuotaRitmo(m, cuentas = []) {
  // 3.90.85: fecha inválida → hoy y venta faltante → 0 (antes salía «NaN %» y el tono rojo).
  // 4.3.24: cuota en texto se suma como número (antes «1000» se concatenaba y el % salía disparatado); hoyIso con `fechaHoy()`.
  const q = m?.cuotas instanceof Map ? m.cuotas : new Map(); const h = fechaHoy(m?.hoyIso);
  // 4.12.22: el tono se saca del avance sin redondear (antes 99.6 % del ritmo redondeaba a 100 % y salía verde; 79.6 % salía ámbar).
  const ritmo = h.getDate() / new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
  // 4.7.16: cuota y venta en texto con «$», comas o espacios («$1,000») se leen con `numero()` (antes la cuota «$1,000» no contaba).
  const cuotaDe = (c) => { const v = numero(q.get(c)?.cuota); return v > 0 ? v : 0; };
  // 4.7.69: la cuenta se empata aunque traiga espacios o venga como número (« ct », 10 = «10»; las claves de `cuotasPorCuenta()`
  // van recortadas) y no se cuenta doble si llega en dos formas.
  const clave = (c) => (q.has(c) ? c : c == null ? '' : String(c).trim());
  const cs = [...new Set(comoLista(cuentas).map(clave))].filter((c) => cuotaDe(c) > 0); if (!cs.length) return null;
  const venta = cs.reduce((s, c) => s + numero(q.get(c).venta), 0), cuo = cs.reduce((s, c) => s + cuotaDe(c), 0), pct = Math.round(venta / cuo * 100), r = venta / cuo / ritmo;
  return { tono: r >= 1 ? 'verde' : r >= 0.8 ? 'ambar' : 'rojo', pct, ritmo: Math.round(ritmo * 100), n: cs.length, venta, cuota: cuo };
}

// Cuota por cuenta (capa «Cuota», 3.90.49): filas de `v_cuota_erp_mes` del mes (cliente_erp, cuenta_sellout, cuota_venta) y
// de `mv_analisis_cliente_mes` del mes (cliente = código ERP, fact_neta), las mismas de Análisis → Map(cuenta → { venta, cuota }).
// La venta se suma sólo de los clientes ERP con cuota (su cuenta sale de la fila de cuota); el % se saca al agregar, nunca se suma.
export function cuotasPorCuenta(cuotas = [], ventas = []) {
  // 4.7.85: como Análisis (`mapaCuotas` + `conCuota`): la cuota se junta por cliente ERP (renglón sin cliente no cuenta) y
  // sólo los clientes con cuota > 0 suman su venta; antes la venta de un cliente con cuota 0 inflaba el % de su cuenta.
  const porCliente = new Map(); const out = new Map();
  for (const r of comoLista(cuotas)) {
    const cu = claveTexto(r?.cuenta_sellout); if (!cu) continue; // 4.3.24: « ct » = «ct» (antes otra cuenta o sin color)
    const k = claveTexto(r.cliente_erp); if (!k) continue;
    const o = porCliente.get(k) || { cuenta: cu, cuota: 0 }; o.cuenta = cu; o.cuota += numero(r.cuota_venta); porCliente.set(k, o); // 4.7.16: «$1,000» ya suma
  }
  const cuentaDe = new Map();
  for (const [k, { cuenta, cuota }] of porCliente) {
    const o = out.get(cuenta) || { venta: 0, cuota: 0 }; out.set(cuenta, o);
    if (cuota > 0) { o.cuota += cuota; cuentaDe.set(k, cuenta); }
  }
  for (const v of comoLista(ventas)) { const c = cuentaDe.get(claveTexto(v?.cliente)); if (c) out.get(c).venta += numero(v.fact_neta); }
  return out;
}

// Capas de información (etapa 4, paso 1, 3.90.47): color por ciudad para una capa, sin escalar por tamaño (se pinta la
// tendencia o el estado, no quién es más grande). 'ventas' = sell out del mes vs mes anterior (mismas filas que las tiendas:
// `importe` / `previo`); 'cartera' = cuentas con cartera vencida entre las tiendas de la ciudad (`kpis.cartera`). Devuelve
// { capa, titulo, leyenda: [{ tono, texto }], porCiudad: Map(ciudad → { tono, valor, texto }) }. Capa desconocida → null.
export const CAPA_TONOS = { verde: 0x34c759, ambar: 0xff9f0a, rojo: 0xff3b30, gris: 0x8e8e93 };
export function capaCiudades(m, capa) {
  if (!m || !['ventas', 'cartera', 'cuota'].includes(capa)) return null;
  const pesos = pesosCorto; // 4.7.8: antes 999 600 salía «$1000 K» y los negativos «$-5000»
  const porCiudad = new Map();
  // Distritos y tiendas nulos se saltan (4.3.6): antes un renglón null tumbaba la capa y el disco de cada ciudad.
  const distritos = (m.distritos || []).filter((d) => d?.ciudad).map((d) => ({ ...d, tiendas: (d.tiendas || []).filter(Boolean) }));
  if (capa === 'ventas') {
    for (const d of distritos) {
      const act = d.tiendas.reduce((s, t) => s + numero(t.importe), 0), prev = d.tiendas.reduce((s, t) => s + numero(t.previo), 0); // 4.7.17: «$5,000» en texto cuenta
      const crudo = prev > 0 ? (act / prev - 1) * 100 : null, pct = crudo == null ? null : Math.round(crudo) + 0; // 4.12.38: tono con el % sin redondear (−0.4 % ya no verde, −20.4 % ya no ámbar)
      const tono = crudo == null ? (act > 0 ? 'verde' : 'gris') : crudo >= 0 ? 'verde' : crudo >= -20 ? 'ambar' : 'rojo';
      porCiudad.set(d.ciudad, { tono, valor: pct, texto: `${pesos(act)}${pct == null ? '' : ` · ${porcentaje(pct, { signo: true })} vs mes anterior`}` });
    }
    return { capa, titulo: 'Sell out vs mes anterior', leyenda: [{ tono: 'verde', texto: 'Igual o arriba' }, { tono: 'ambar', texto: 'Hasta −20 %' }, { tono: 'rojo', texto: 'Más de −20 %' }, { tono: 'gris', texto: 'Sin venta' }], porCiudad };
  }
  if (capa === 'cuota') {
    // Avance del mes de las cuentas con tiendas en la ciudad (venta ÷ cuota, sumadas) contra el ritmo esperado al día de hoy.
    for (const d of distritos) {
      const c = cuotaRitmo(m, d.tiendas.map((t) => t.cuenta));
      porCiudad.set(d.ciudad, c ? { tono: c.tono, valor: c.pct, texto: `${porcentaje(c.pct)} de la cuota del mes (${plural(c.n, 'cuenta')}) · ritmo ${porcentaje(c.ritmo)}` } : { tono: 'gris', valor: null, texto: 'Sus cuentas no tienen cuota este mes' });
    }
    return { capa, titulo: 'Avance de cuota vs ritmo del mes', leyenda: [{ tono: 'verde', texto: 'Al ritmo' }, { tono: 'ambar', texto: 'Hasta 20 % abajo' }, { tono: 'rojo', texto: 'Más abajo' }, { tono: 'gris', texto: 'Sin cuota' }], porCiudad };
  }
  // 4.12.39: la cuenta se empata sin espacios ni mayúsculas (« PCEL » = «pcel», como `carteraPorCuenta()` y `pensamientos()`) y dos
  // renglones de la misma cuenta suman (antes ganaba el último); cartera que no es lista ya no lanza error.
  const ck = (c) => unirTexto(c).toLowerCase(), venc = new Map(), saldos = new Map();
  for (const c of comoLista(m.kpis?.cartera)) {
    const k = c && ck(c.cuenta); if (!k) continue; const v = numero(c.vencido), s = numero(c.saldo); // 4.7.17: «$5,000» ya es vencido
    if (v > 0) venc.set(k, (venc.get(k) || 0) + v); if (s > 0) saldos.set(k, (saldos.get(k) || 0) + s);
  }
  for (const d of distritos) {
    const cuentas = [...new Set(d.tiendas.map((t) => ck(t.cuenta)).filter(Boolean))], malas = cuentas.filter((c) => venc.has(c));
    const monto = malas.reduce((s, c) => s + venc.get(c), 0);
    // 4.12.21: semáforo de la tarjeta «Cartera» de Inicio (`tonoCartera()`): vencido ≤ 15 % del saldo de sus cuentas ámbar, más (o
    // sin saldo legible) rojo. Antes cualquier peso vencido pintaba la ciudad de rojo, distinto del banco y de Inicio.
    const saldo = cuentas.reduce((s, c) => s + (saldos.get(c) || 0), 0), pct = malas.length && saldo > 0 ? (monto / saldo) * 100 : null;
    porCiudad.set(d.ciudad, { tono: malas.length ? tonoCartera(monto, pct) : 'verde', valor: monto, texto: malas.length ? `${plural(malas.length, 'cuenta')} con vencido · ${pesos(monto)}${pct == null ? '' : ` · ${porcentaje(pct)} del saldo`}` : 'Sin cartera vencida' });
  }
  return { capa, titulo: 'Cartera vencida de sus cuentas', leyenda: [{ tono: 'verde', texto: 'Al corriente' }, { tono: 'ambar', texto: 'Vencido hasta 15 % del saldo' }, { tono: 'rojo', texto: 'Más de 15 %' }], porCiudad };
}

/** Racks del CEDIS por marca (etapa 3 · interior del CEDIS): filas de `v_inventario_almacen_medida` con `en_inv_actual = true`
 *  (SKU × almacén, como Inventario) + marca de `roadmap_sku` (`marcas`: Map u objeto sku → marca). Suma valor (`costoinventario`)
 *  y piezas por marca, cuenta SKUs distintos con existencia; top `n` por valor y el resto junto en «OTRAS». Sin marca → «SIN MARCA». */
// Números de PO por contenedor (3.90.35): filas `{ contenedor, po }` de `embarques_compras` (sólo de los contenedores dibujados)
// → pone `listaPos` (únicas, ordenadas) en cada barco/tarima del puerto. Sin filas no cambia nada (la tarjeta muestra el conteo).
// 4.7.80: barcos/tarimas que no son lista se saltan (antes un objeto lanzaba error y un texto se partía en letras); puerto que no es objeto se regresa igual.
export function ponerPosEnPuerto(puerto, filas = []) {
  if (!puerto || typeof puerto !== 'object') return puerto;
  // 4.12.30: contenedor/PO/id que llega como objeto, lista, booleano o NaN se salta (antes `String()` daba «[object Object]» / «NaN» en las POs del puerto).
  const txt = (v) => (Array.isArray(v) ? '' : unirTexto(v));
  const por = new Map();
  for (const f of comoLista(filas)) {
    const c = txt(f?.contenedor), po = txt(f?.po);
    if (!c || !po) continue;
    if (!por.has(c)) por.set(c, new Set());
    por.get(c).add(po);
  }
  for (const b of [...comoLista(puerto.barcos), ...comoLista(puerto.tarimas)]) {
    if (!b) continue; const s = por.get(txt(b.id));
    if (s) b.listaPos = [...s].sort((a, z) => a.localeCompare(z, 'es', { numeric: true }));
  }
  return puerto;
}
// Lista de POs para la tarjeta: las primeras 3 y «+N» (la tarjeta es angosta).
// Lista corta (3.90.84): sin vacíos ni repetidos (« PO-2 » y «PO-2» cuentan una vez), así el «+N» cuenta lo que de verdad falta.
export function listaCorta(lista, n = 3) {
  n = cuantos(n, 3);
  if (!Array.isArray(lista)) return '';
  const u = [...new Set(lista.map((x) => (typeof x === 'string' || (typeof x === 'number' && Number.isFinite(x)) ? String(x).trim() : '')) /* 4.7.73: objetos, booleanos y NaN fuera (antes «[object Object]») */.filter(Boolean))];
  // 4.7.56: con n = 0 sale «+3» (antes « +3» con espacio al inicio).
  return [u.slice(0, n).join(', '), u.length > n ? `+${u.length - n}` : ''].filter(Boolean).join(' ');
}

// Interior de la oficina (paso 1, 3.90.37): reuniones de hoy (`agenda_reuniones`, sin viajes) en orden, con hora local y si ya
// pasó, está en curso o viene. Duración por omisión 60 min. Fechas inválidas se omiten.
// Instante de una reunión (4.3.31): null/'' ya no se lee como 1970 (antes salía a las 18:00 «hecha» o un viaje sin fecha contaba),
// 'AAAA-MM-DD' sola es ese día local (antes UTC: el viaje terminaba un día antes en Guadalajara) y se aceptan espacios y Date.
function instante(x) {
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : x;
  if (typeof x !== 'string' || !x.trim()) return null;
  const s = x.trim(); if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const t = new Date(`${s}T00:00:00`); return Number.isNaN(t.getTime()) ? null : t; }
  // 4.12.44: fecha con hora de Postgres en forma ISO estricta antes de leerla: zona corta «+00»/«+0000» (antes Invalid Date
  // con «T»: la reunión no salía), espacio en vez de «T» y microsegundos (Safari/iPad no los leía). Sin zona = hora local.
  const z = s.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2})(:\d{2})?(\.\d+)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/i);
  const iso = !z ? s : `${z[1]}T${z[2]}${z[3] || ':00'}${z[4] ? z[4].slice(0, 4).padEnd(4, '0') : ''}${!z[5] ? '' : /^z$/i.test(z[5]) ? 'Z' : z[5].length === 3 ? `${z[5]}:00` : z[5].includes(':') ? z[5] : `${z[5].slice(0, 3)}:${z[5].slice(3)}`}`;
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : t;
}
// Duración en minutos (4.3.31): 0, negativa, texto o basura → 60 (antes -30 dejaba la reunión «hecha» antes de empezar).
const duracionMin = (d) => { const n = Number(d); return Number.isFinite(n) && n > 0 ? n : 60; };
export function reunionesDelDia(reuniones = [], hoy = new Date()) {
  hoy = fechaHoy(hoy);
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  const vistas = new Set(); // 4.7.66: la misma reunión dos veces (mismo id, o mismo título y hora) sale una vez
  return comoLista(reuniones).map((r) => {
    const t = instante(r?.fecha); if (!t) return null;
    // 4.12.32: id/cliente_key que llegan como objeto, lista, booleano o NaN se ignoran (antes «id:[object Object]» juntaba reuniones distintas en una).
    const id = unirTexto(r.id), k = id ? `id:${id}` : `${norm(unirTexto(r.titulo))}|${t.getTime()}`; if (vistas.has(k)) return null; vistas.add(k);
    const ini = t.getHours() * 60 + t.getMinutes(), fin = ini + duracionMin(r.duracion_min);
    return { titulo: unirTexto(r.titulo) || 'Reunión', cliente_key: unirTexto(r.cliente_key) || null, hora: `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`, ini, fin, estado: ahora >= fin ? 'hecha' : ahora >= ini ? 'en curso' : 'próxima' };
  }).filter(Boolean).sort((a, b) => a.ini - b.ini);
}

// Interior de la oficina (3.90.38): escritorios en rejilla dentro de la planta (`ancho` × `largo`, centrada en 0,0), hasta `max`.
export function acomodoEscritorios(n, op) {
  const { ancho = 7, largo = 5.2, cols = 4, max = 12 } = op && typeof op === 'object' ? op : {}; // (4.3.19) opciones null → omisión
  const k = Math.max(0, Math.min(Math.floor(Number(n)) || 0, max)); if (!k) return []; // (4.3.10) 3.7 → 3 escritorios bien repartidos
  const c = Math.max(1, Math.min(Math.floor(cols) || 1, k)), filas = Math.ceil(k / c);
  return Array.from({ length: k }, (_, i) => ({ x: c === 1 ? 0 : -ancho / 2 + (i % c) * (ancho / (c - 1)), z: filas === 1 ? 0 : -largo / 2 + Math.floor(i / c) * (largo / (filas - 1)) }));
}

// Presencia en la oficina (3.90.40, como Gather): pone `presencia` = { estado: 'viaje' | 'reunion' | 'disponible', titulo } en cada
// persona. Viaje = reunión tipo 'viaje' vigente hoy (fecha … fecha_fin); reunión = una que está en curso ahora. Cuenta si la persona
// es asistente (`asistentes[].user_id`) o quien la creó (`creado_por`). El viaje gana a la reunión.
// (3.111.1) Personas nulas se saltan y una fecha `hoy` inválida usa ahora (antes lanzaba error / dejaba todos «disponible»).
export function presenciaPersonas(personas = [], reuniones = [], viajes = [], hoy = new Date()) {
  hoy = fechaHoy(hoy);
  const dia = (x) => { const t = instante(x); return !t ? null : `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`; };
  const hoyD = dia(hoy), ahora = hoy.getTime();
  const de = (r, id) => r && id && (r.creado_por === id || (Array.isArray(r.asistentes) && r.asistentes.some((a) => a && (a.user_id === id || a === id))));
  const todas = [...comoLista(reuniones), ...comoLista(viajes)].filter(Boolean);
  const vistos = new Set(); const unicas = todas.filter((r) => { const k = r.id || `${r.titulo}|${r.fecha}`; if (vistos.has(k)) return false; vistos.add(k); return true; });
  const viajeHoy = unicas.filter((r) => esClase(r.tipo, 'viaje') && dia(r.fecha) && dia(r.fecha) <= hoyD && (dia(r.fecha_fin || r.fecha) || dia(r.fecha)) >= hoyD);
  const enCurso = unicas.filter((r) => { if (esClase(r.tipo, 'viaje')) return false; const t = instante(r.fecha)?.getTime(); return Number.isFinite(t) && t <= ahora && ahora < t + duracionMin(r.duracion_min) * 60000; });
  for (const p of comoLista(personas)) {
    if (!p || typeof p !== 'object') continue;
    const v = viajeHoy.find((r) => de(r, p.id)); const r = !v && enCurso.find((x) => de(x, p.id));
    p.presencia = v ? { estado: 'viaje', titulo: unirTexto(v.titulo) || 'Viaje' } : r ? { estado: 'reunion', titulo: unirTexto(r.titulo) || 'Reunión' } : { estado: 'disponible', titulo: null };
  }
  return personas;
}

// Tienda visitable (3.90.41): filas `{ sku, importe, cantidad }` de sell out de una sucursal → top N SKUs por importe
// (SKU en mayúsculas, sumado). Mismo cálculo que Análisis en el celular (useSkusDimension).
// Clave de SKU (4.12.29): texto limpio en mayúsculas («ac-1 » = «AC-1») o número entero/decimal finito; un SKU que llega como
// objeto, lista, booleano, NaN o en blanco → '' (se salta). Antes `String()` lo volvía «[OBJECT OBJECT]» / «TRUE» / «NAN» en el
// top de la tienda, los racks del CEDIS y la demanda de 3 meses (y todos esos renglones se juntaban en un solo SKU falso).
export function claveSku(v) {
  return typeof v === 'string' ? v.trim().toUpperCase() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}
// Clave de texto (4.12.37): como `claveSku()` pero sin mayúsculas, para cuentas y clientes ERP; un objeto, lista, booleano o
// NaN → '' (se salta). Antes `String()` hacía cuentas falsas «[object Object]» / «true» en la capa de cuota y el reparto por estado.
export function claveTexto(v) {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '';
}
export function topSkus(filas = [], n = 5) {
  const m = new Map();
  n = Number.isFinite(Number(n)) && Number(n) >= 0 ? Math.floor(Number(n)) : 5;
  for (const r of Array.isArray(filas) ? filas : []) { const k = claveSku(r?.sku); if (!k) continue; const o = m.get(k) || { sku: k, importe: 0, cantidad: 0 }; o.importe += numero(r.importe); o.cantidad += numero(r.cantidad); m.set(k, o); }
  return [...m.values()].filter((o) => o.importe > 0 || o.cantidad > 0).sort((a, b) => b.importe - a.importe || b.cantidad - a.cantidad).slice(0, n);
}
// Cifra corta (3.90.83): 999 600 ya no sale «1000 K» sino «1.0 M», 999.6 → «1 K», negativos con signo y basura → 0.
// Singular/plural (4.3.34): «1 barco», «2 barcos», «0 barcos»; n ilegible cuenta como 0. `varios` por omisión = uno + 's'.
// Cuenta regresiva corta (4.7.3): 0 → «empieza ya» (antes «en 0 min»), 1..59 → «en N min», ≥ 60 → «en 1 h 5 min»; ilegible o negativa → ''.
// 4.7.5: cuándo llega un barco en palabras («llega hoy», «llega mañana», «llega en 3 d», «2 d tarde»); sin ETA o ilegible → 'sin ETA'.
export function llegaBarco(dias) {
  // 4.7.77: sólo número o texto; una lista/objeto ya no se lee como 0 («llega hoy» con `[]`).
  if (dias == null || (typeof dias !== 'number' && typeof dias !== 'string') || (typeof dias === 'string' && !dias.trim())) return 'sin ETA';
  // 4.7.29: «1,200» en texto se lee y los días salen con miles es-MX («llega en 1,200 d», «1,200 d tarde»).
  const k = Math.round(Number(typeof dias === 'string' ? dias.replace(/[,\s]/g, '') : dias)); if (!Number.isFinite(k) || typeof dias === 'boolean') return 'sin ETA';
  const m = (n) => n.toLocaleString('es-MX');
  // 4.12.62: desde 60 días en meses y desde 365 en años, como `haceDias()` / `faltanDias()` («llega en 3 meses», «1 año tarde»;
  // antes «llega en 1,200 d» / «1,500 d tarde»).
  if (k <= -60) return `${haceDias(-k).replace(/^hace /, '')} tarde`;
  if (k >= 60) return `llega ${faltanDias(k)}`;
  if (k < 0) return `${m(-k)} d tarde`;
  return k === 0 ? 'llega hoy' : k === 1 ? 'llega mañana' : `llega en ${m(k)} d`;
}

export function enMinutos(min) {
  if (min == null || (typeof min !== 'number' && typeof min !== 'string') || (typeof min === 'string' && !min.trim())) return ''; // 4.7.77: `[]` ya no «empieza ya»
  const k = Math.round(Number(typeof min === 'string' ? min.replace(/[,\s]/g, '') : min)); if (!Number.isFinite(k) || k < 0 || typeof min === 'boolean') return '';
  if (k === 0) return 'empieza ya';
  // 4.12.63: desde 24 h en días y desde 60 días en meses/años, como `faltanDias()` («en 2 d», «en 3 meses»; antes «en 1,200 h»).
  if (k >= 1440) { const d = Math.round(k / 1440); return d < 60 ? `en ${d.toLocaleString('es-MX')} d` : faltanDias(d); }
  const h = Math.floor(k / 60), r = k % 60;
  return h ? `en ${h.toLocaleString('es-MX')} h${r ? ` ${r} min` : ''}` : `en ${k} min`;
}
/** Une partes de un texto con « · » saltando las vacías (null, undefined, '', espacios, NaN, false, 'null'/'undefined'):
 *  el globo del contenedor/camión ya no dice «null · 1,200 pz» ni «salió undefined» (4.7.21). */
// Fecha corta es-MX (4.7.42): «23 nov» para tarjetas; ilegible (null, «pendiente», '2026-99-99') → '' (nunca «Invalid Date»).
// 4.12.3: fuera del año de «hoy» lleva el año («23 nov 2025»; antes una ETA o salida de otro año se confundía con este).
export function fechaCorta(x, hoy) {
  const f = fechaIso(x); if (!f) return '';
  const c = new Date(`${f}T12:00:00`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }).replace(/\.$/, '');
  return Number(f.slice(0, 4)) === fechaHoy(hoy).getFullYear() ? c : `${c} ${f.slice(0, 4)}`;
}
// Última sincronización en la bitácora (4.12.26) con las palabras del importador (`frescura.js`): 'success'/'ok' → «Se
// actualizaron los datos», 'warning' → «… · con avisos», 'error' → ⚠️ «Falló una actualización de datos». Antes salía el
// estado crudo en inglés («Se actualizaron los datos · success») y un error se anunciaba como actualización.
// 4.12.47: con `fuente` (nombre del importador, `fuenteSync()`) dice cuál: «Se actualizaron los datos · Inventario ERP»,
// «Falló una actualización de datos · Ventas ERP (facturación)»; sin fuente queda como antes.
export function textoSync(status, fuente) {
  const st = unirTexto(typeof status === 'string' ? status.toLowerCase() : status), f = unirTexto(fuente);
  if (['error', 'failed', 'fail', 'fallo', 'falló'].includes(st)) return { icono: '⚠️', texto: unirTexto('Falló una actualización de datos', f) };
  if (st === 'warning') return { icono: '🔄', texto: unirTexto('Se actualizaron los datos', f, 'con avisos') };
  return { icono: '🔄', texto: unirTexto('Se actualizaron los datos', f, ['', 'success', 'ok', 'exito', 'éxito'].includes(st) ? '' : st) };
}
// Fuente de la última sincronización (4.12.47): el `status_key` de `sync_events` con el título del catálogo del importador
// (`PUENTE` de `settings/importador/config.js`, que `datos.js` pasa para que este archivo no lo importe): 'erp_inventario' →
// «Inventario ERP». Acepta espacios/mayúsculas; clave desconocida, vacía o catálogo que no es lista → ''.
export function fuenteSync(ev, catalogo) {
  const k = claveTexto(ev?.status_key).toLowerCase(); if (!k) return '';
  const c = comoLista(catalogo).find((x) => x && typeof x === 'object' && claveTexto(x.key ?? x.statusKey).toLowerCase() === k);
  return unirTexto(c?.titulo);
}
export function unirTexto(...partes) {
  return partes.flat().map((x) => (typeof x === 'string' ? x.trim() : typeof x === 'number' && Number.isFinite(x) ? String(x) : ''))
    // 4.12.60: «NULL» / «Null» / «nan» / «Infinity» (como los exporta el ERP o una hoja) también se saltan, no sólo en minúsculas exactas.
    .filter((x) => x && !['null', 'undefined', 'nan', 'infinity', '-infinity', 'none', '#n/a'].includes(x.toLowerCase())).join(' · ');
}
// Estatus del contenedor (4.7.84) con los mismos nombres cortos que el Plan de compras (`ESTATUS_CORTO` de
// `comercial/forecast/sopCalculo.js`): «TRANSITO MARITIMO» → «En el mar», «PROXIMO A ZARPAR» → «Por zarpar»… Acepta
// espacios, minúsculas y acentos («Tránsito marítimo»); uno desconocido sale en minúsculas como allá; vacío → ''.
const ESTATUS_BARCO = { 'TRANSITO MARITIMO': 'en el mar', 'PROXIMO A ZARPAR': 'por zarpar', 'EN PRODUCCION': 'en producción', 'EN ESPERA DE CONSOLIDAR': 'por consolidar', 'EN RESGUARDO': 'en resguardo', 'PENDIENTE MODULAR': 'pendiente', 'EN PUERTO': 'en puerto' };
export function estatusBarco(x) {
  const s = unirTexto(x).replace(/\s+/g, ' '); if (!s) return '';
  const clave = s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const t = ESTATUS_BARCO[clave] || s.toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
// Título del camión (4.7.37): «Factura F1 · promo» / «Envío · F1»; sin folio (null, vacío, «undefined») dice sólo
// «Factura» / «Envío» en vez de «Factura null». El folio numérico cuenta.
export function tituloCamion(c, promo) {
  const f = unirTexto(c?.folio);
  return c?.envio ? unirTexto('Envío', f) : unirTexto(f ? `Factura ${f}` : 'Factura', promo);
}
// Nombre de la persona en la oficina (4.7.38): nombre limpio; sin nombre, la parte del correo antes de «@»
// («ana.lopez»); sin nada, «Persona» (antes `null` en el escritorio, la tarjeta y el globo).
// 4.7.86: el correo sale como nombre legible («ana.lopez» / «ana_lopez» / «ana-lopez» → «Ana Lopez»; antes «ana.lopez»
// en el escritorio y el globo); números y separadores solos no cuentan («123», «.» → «Persona»).
// 4.12.34: el nombre que llega TODO en mayúsculas o TODO en minúsculas («ANA LÓPEZ DE LA CRUZ», «juan pérez») sale legible
// («Ana López de la Cruz», «Juan Pérez»); uno ya escrito con mayúsculas y minúsculas («Ana McGregor») se respeta tal cual.
export function nombrePersona(p) {
  const n = unirTexto(p?.nombre).replace(/\s+/g, ' ');
  if (n && /\p{L}/u.test(n) && (!/\p{Ll}/u.test(n) || !/\p{Lu}/u.test(n))) {
    return n.split(' ').map((w, i) => (i > 0 && CONECTORES.has(norm(w)) ? w.toLocaleLowerCase('es-MX')
      : w.charAt(0).toLocaleUpperCase('es-MX') + w.slice(1).toLocaleLowerCase('es-MX'))).join(' ');
  }
  if (n) return n;
  const e = unirTexto(p?.email).split('@')[0].split(/[._\-+\s]+/).filter((w) => /\p{L}/u.test(w))
    .map((w) => w.charAt(0).toLocaleUpperCase('es-MX') + w.slice(1).toLocaleLowerCase('es-MX')).join(' ');
  return e || 'Persona';
}
// Nombre de la tienda (4.7.39): «Pcel · Centro»; sin nombre de cuenta usa la clave, sin sucursal sólo la cuenta,
// sin nada «Tienda». Es también la llave con que la tarjeta encuentra la tienda tocada (antes «Pcel · null» y la
// tarjeta salía vacía porque el edificio se titulaba «Pcel»).
// 4.12.33: la sucursal que llega toda en mayúsculas («CIUDAD JUAREZ», «PLAZA DEL SOL») sale legible con `nombreSucursal()`
// («Ciudad Juárez», «Plaza del Sol»); antes la tarjeta, el globo y el pensamiento decían «CT Internacional · HERMOSILLO».
export function nombreTienda(t) {
  return unirTexto(unirTexto(t?.nombreCuenta) || t?.cuenta, nombreSucursal(t?.sucursal)) || 'Tienda';
}
// Sucursal legible (4.12.33): sólo toca la que viene TODA en mayúsculas (una ya escrita «Galerías GDL» se respeta). Cada palabra
// como `nombreCiudad()` (acentos conocidos, conectores en minúscula) salvo siglas: palabras cortas sin vocal («CT», «GDL», «MTY»),
// con número («GDL1») o con punto («S.A.») quedan tal cual. CDMX entera se abrevia. Lo que no es texto/número → ''.
export function nombreSucursal(s) {
  const t = unirTexto(s).replace(/\s+/g, ' '); if (!t || !/\p{L}/u.test(t) || /\p{Ll}/u.test(t)) return t;
  if (/^(CIUDAD|CD\.?) DE MEXICO$|^CDMX$/.test(norm(t))) return 'CDMX';
  return t.split(/(\s+|-)/).map((w, i) => {
    if (!/\p{L}/u.test(w) || /[\d.]/.test(w) || (w.length <= 4 && !/[AEIOUÁÉÍÓÚ]/.test(w))) return w;
    const k = norm(w); return ACENTOS[k] || (i > 0 && CONECTORES.has(k) ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase());
  }).join('');
}
// Leyenda de cuentas (4.7.40): una entrada por cuenta (antes se repetía si el nombre venía con espacios distintos
// y la clave chocaba en React; un nombre con «|» se partía y una cuenta nula decía «null»). Salta distritos/tiendas nulos.
// 4.12.52: la misma cuenta con distintas mayúsculas («PCEL» / «Pcel») es una sola entrada, como su color (`colorCuenta()`);
// si la primera tienda no traía nombre de cuenta, toma el de la siguiente que sí (antes la leyenda decía la clave «PCEL»).
export function leyendaCuentas(distritos) {
  const out = new Map();
  for (const d of comoLista(distritos)) for (const t of comoLista(d?.tiendas)) {
    const c = unirTexto(t?.cuenta), k = c.toLowerCase(); if (!c) continue;
    const n = unirTexto(t.nombreCuenta), ya = out.get(k);
    if (!ya) out.set(k, { cuenta: c, nombre: n || c }); else if (n && ya.nombre === ya.cuenta) ya.nombre = n;
  }
  return [...out.values()];
}
// A dónde va el vendedor (4.7.37): «va a Cliente (Guadalajara)»; sin cliente «va a Guadalajara»; sin nada, vacío.
export function vaA(parada) {
  const cl = unirTexto(parada?.cliente), ci = parada?.ciudad ? nombreCiudad(parada.ciudad) : '';
  return cl && ci ? `va a ${cl} (${ci})` : cl || ci ? `va a ${cl || ci}` : '';
}
// Porcentaje legible (4.7.24): entero redondeado con miles es-MX («1,250 %»), `signo` antepone «+» a los positivos
// (sell out vs mes anterior) y lo ilegible (null, NaN, texto basura) dice «—» en vez de «NaN %» o «null %».
export function porcentaje(v, op) { // 4.7.62: opciones null o que no son objeto → sin signo (antes lanzaba error)
  const signo = !!(op && typeof op === 'object' && op.signo);
  // 4.7.55: texto con comas, espacios o «%» («1,250», « 45 %») se lee (antes «—»).
  // 4.7.72: sólo número o texto; una lista u objeto → «—» (antes `[]` salía «0 %»).
  if (v == null || v === '' || (typeof v !== 'number' && typeof v !== 'string')) return '—';
  const k = Math.round(Number(typeof v === 'string' ? (v.trim() ? v.replace(/[\s,%]/g, '') : NaN) : v)); if (!Number.isFinite(k)) return '—';
  const z = k === 0 ? 0 : k; return `${signo && z > 0 ? '+' : ''}${z.toLocaleString('es-MX')} %`;
}
// DSO de la cartera (4.7.26): días redondeados en singular/plural con miles es-MX («DSO 45 días», «DSO 1 día»);
// 0, negativo o ilegible no pone texto (antes «DSO 45.678 d» / «DSO 0 d» en el aviso de cartera del panel).
// Antigüedad en días (4.7.28): «hoy» (0 o futuro), «ayer», «hace 1,200 d» con miles es-MX y redondeada (antes «hace 1200 d»,
// «hace 2.6 d»); ilegible → ''. Bitácora (camiones/arribos) y tarjeta del camión.
export function haceDias(v) {
  // 4.7.77: con `leeNum()`: texto en blanco (« ») y listas (`[]`) ya no dicen «hoy».
  const n = leeNum(v); if (n == null) return ''; const k = Math.round(n);
  // 4.12.59: desde 60 días en meses y desde 365 en años («hace 3 meses», «hace 1 año»; antes «hace 1,200 d»).
  if (k <= 0) return 'hoy'; if (k === 1) return 'ayer';
  if (k < 60) return `hace ${k} d`;
  if (k < 365) return `hace ${Math.min(11, Math.round(k / 30.4))} meses`;
  const a = Math.floor(k / 365); return `hace ${a.toLocaleString('es-MX')} año${a === 1 ? '' : 's'}`;
}
// Lo que falta para una fecha futura (4.12.61), gemelo de `haceDias()`: «hoy» (0 o pasado), «mañana», «en N d», desde 60 días
// «en N meses» y desde 365 «en N año(s)». Antes la tarjeta del camión fechado adelante decía «en 1,200 d». Ilegible → ''.
export function faltanDias(v) {
  const n = leeNum(v); if (n == null) return ''; const k = Math.round(n);
  if (k <= 0) return 'hoy'; if (k === 1) return 'mañana';
  if (k < 60) return `en ${k} d`;
  if (k < 365) return `en ${Math.min(11, Math.round(k / 30.4))} meses`;
  const a = Math.floor(k / 365); return `en ${a.toLocaleString('es-MX')} año${a === 1 ? '' : 's'}`;
}
// Semáforo de la cartera vencida como la tarjeta «Cartera» de Inicio (4.12.17): sin vencido verde; con vencido rojo si pasa
// 15 % del saldo y ámbar si no. Sin % legible (saldo 0, ilegible) queda rojo, como antes. Antes cualquier peso vencido era rojo.
export function tonoCartera(vencido, pctVencido) {
  if (!(numero(vencido) > 0)) return 'verde';
  const p = typeof pctVencido === 'number' || typeof pctVencido === 'string' ? leePct(pctVencido) : null;
  return p != null && Number.isFinite(p) && p <= 15 ? 'ambar' : 'rojo';
}
// Tono de la cartera de una cuenta ({ vencido, saldo }) con `tonoCartera()` (4.12.25): el % sale del saldo de esa cuenta.
// Lo usan las banderas de la tienda y el banco en la escena para que pinten igual que su tarjeta.
export function tonoCarteraCuenta(c) {
  const v = numero(c?.vencido), s = numero(c?.saldo);
  return tonoCartera(v, v > 0 && s > 0 ? (v / s) * 100 : null);
}
// Tono del banco (4.12.25): un pago vencido manda rojo; si no, la cartera con el semáforo de Inicio.
export function tonoBanco(b) {
  if (!b || typeof b !== 'object') return 'verde';
  return numero(b.pagosVencidos) > 0 ? 'rojo' : tonoCartera(b.carteraVencida, b.pctVencido);
}
// Semáforo de «Ventas del mes» como la barra de cuota de Inicio (`toneCuota` / `BarraCuotaM`, 4.12.18): ≥ 100 % verde, 85–99 %
// sin tono (la barra usa el acento, como el azul de Inicio), 60–84 % ámbar y < 60 % rojo. Antes 80–99 % ámbar y < 80 % rojo:
// 70 % salía rojo (Inicio: naranja) y 90 % ámbar (Inicio: en camino). Sin % legible → sin tono.
export function tonoCuota(pct) {
  const p = typeof pct === 'number' || typeof pct === 'string' ? leePct(pct) : null;
  if (p == null || !Number.isFinite(p)) return null;
  return p >= 100 ? 'verde' : p >= 85 ? null : p >= 60 ? 'ambar' : 'rojo';
}
// Semáforo de «tiendas que vendieron este mes» (4.12.19), uno solo para la tira de la cadena, sus cintas por ciudad y la tarjeta
// de la ciudad: < 40 % rojo, < 70 % ámbar, si no verde. Antes la tarjeta usaba 60 % / 30 %: una ciudad con 50 % de tiendas
// activas salía verde en la tarjeta y ámbar en la cadena. Sin tiendas (o conteo ilegible) → null.
export function tonoActivas(activas, total) {
  const t = leeNum(total), a = leeNum(activas);
  if (!Number.isFinite(t) || t <= 0 || !Number.isFinite(a)) return null;
  const r = Math.max(0, a) / t;
  return r < 0.4 ? 'rojo' : r < 0.7 ? 'ambar' : 'verde';
}
export function dsoTexto(v) {
  const k = Math.round(numero(v)); return Number.isFinite(k) && k > 0 ? `DSO ${plural(k, 'día', 'días')}` : '';
}
// Pendientes de la persona (4.7.46): «1 pendiente hoy · 1,200 hechas» con `plural()`; nulo/ilegible cuenta 0
// (antes «undefined pendientes hoy · NaN hechas» y sin miles es-MX). Globo de la persona en la oficina y de viaje.
// 4.7.87: un conteo negativo cuenta 0 (antes «-2 hechas»); son tareas, no pueden ser menos de cero.
export function pendientesTexto(pendientes, hechas) {
  const c = (v) => Math.max(0, numero(v));
  return `${plural(c(pendientes), 'pendiente')} hoy · ${plural(c(hechas), 'hecha')}`;
}
// Temperatura (4.7.45): «24°» redondeada (0 y bajo cero valen: «-3°»); sin dato o ilegible → '' (antes «NaN° en Guadalajara»).
export function temperaturaTexto(v) {
  const k = leeNum(v); if (k == null) return ''; const r = Math.round(k); return `${r === 0 ? 0 : r}°`;
}
// Piezas (4.7.27): enteras con miles es-MX («1,200 pz»; antes «1,200.5 pz» con decimales y texto «$1,200» sí cuenta);
// ilegible → «0 pz». Globos del contenedor/tarima/tráiler, misión de descarga, bitácora de arribos y globo del puerto.
export function piezasTexto(v) { return `${(Math.round(numero(v)) + 0).toLocaleString('es-MX')} pz`; } // 4.7.56: -0.4 → «0 pz» (antes «-0 pz»)
// 4.12.67: piezas sólo si hay (> 0 al redondear); 0, negativas o ilegibles → '' para que `unirTexto()` no agregue «· 0 pz».
export const piezasSiHay = (v) => (Math.round(numero(v)) > 0 ? piezasTexto(v) : '');
export function plural(n, uno, varios) {
  // 4.7.62: palabra que no es texto o vacía → sólo el número (antes «0 undefineds» / «2 null»); `varios` ausente → uno + «s».
  const u = typeof uno === 'string' && uno.trim() ? uno : '', vs = typeof varios === 'string' && varios.trim() ? varios : u ? `${u}s` : '';
  // 4.7.55: «1,200» / « 3 » en texto se leen (antes «0 pedidos»); booleanos y basura → 0 (antes true = «1 barco»).
  const k = typeof n === 'string' ? Math.round(Number(n.trim() ? n.replace(/[\s,]/g, '') : NaN)) : typeof n === 'number' ? Math.round(n) : NaN; const v = Number.isFinite(k) ? k + 0 : 0; // 4.7.56: + 0 quita el «-0» (-0.4 → «0 días», antes «-0 días»)
  const w = Math.abs(v) === 1 ? u : vs; return w ? `${v.toLocaleString('es-MX')} ${w}` : v.toLocaleString('es-MX');
}
// Texto con «$», comas de miles o espacios («$1,200», « 2,500 ») se lee como número; ≥ mil millones sale «1.2 B» como el
// `moneyCompact` del dashboard (antes «1000.0 M»). Booleanos y basura → '0'.
export function cifraCorta(v) {
  const n = typeof v === 'string' ? textoNum(v, /[\s$,]/g) : typeof v === 'number' ? v : NaN; if (!Number.isFinite(n)) return '0';
  const a = Math.abs(n); const s = n < 0 && Math.round(a) > 0 ? '-' : '';
  // 4.12.68: los miles de millones con miles es-MX («1,000.0 B»; antes «1000000.0 B» con montos enormes).
  if (a >= 999.95e6) return `${s}${(a / 1e9).toLocaleString('es-MX', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} B`;
  if (a >= 999500) return `${s}${(a / 1e6).toFixed(1)} M`;
  if (a >= 999.5) return `${s}${Math.round(a / 1e3)} K`;
  return `${s}${Math.round(a)}`;
}
export const pesosCorto = (v) => { const c = cifraCorta(v); return c[0] === '-' ? `-$${c.slice(1)}` : `$${c}`; };

// Barra superior tipo recursos (3.90.42): toma la salida de `calcular()` de Inicio (mismos números) y arma los 4 recursos,
// cada uno con el edificio al que lleva al tocarlo. Lo que no venga se omite. Cobertura sin ritmo (NaN/∞) → sin «d» (3.90.86).
// POs en tránsito: número (o texto numérico) > 0, redondeado y en singular para 1; «0», NaN o basura → sin texto (antes «0 POs» / «NaN POs»).
// 4.7.34: conteos en texto con comas/espacios («1,200») se leen (antes «1,200» → sin POs) y salen con miles es-MX y `plural()`
// («1,200 POs»; antes «1200 POs»); cobertura «1,200» en texto también (antes sin días). Basura, booleanos, ≤ 0 → nada.
const leeNum = (v) => { const k = typeof v === 'string' ? textoNum(v, /[\s$,]/g) : typeof v === 'number' ? v : NaN; return Number.isFinite(k) ? k : null; };
// 4.12.46: porcentaje en texto con «%» al final («12 %», «70%») se lee para los semáforos (antes ilegible: cartera roja y cuota sin tono).
const leePct = (v) => leeNum(typeof v === 'string' ? v.replace(/\s*%\s*$/, '') : v);
const posTexto = (p) => { const n = leeNum(p); return n != null && Math.round(n) > 0 ? plural(n, 'PO') : null; };
// 4.7.58: cobertura -0.4 ya no dice «-0 d» (redondea a «0 d») y una negativa (inventario negativo) no da días: sin texto.
// 4.7.83: días de inventario del CEDIS como «Inventario» del dashboard (`dias_inv` null = sin medida: «sin medida de días»).
// Antes `N(null)` daba 0 y el CEDIS decía «0 días» en verde en el globo, la tarjeta, el panel y la cadena. Ilegible o negativo → null.
export function diasCedis(v) { const k = leeNum(v); return k == null || k < 0 ? null : Math.round(k) + 0; }
export function diasTexto(v) { const d = diasCedis(v); return d == null ? 'sin medida de días' : plural(d, 'día'); }
// 4.12.13: el color sigue el semáforo «Días de Inv» de Inicio (`estadoCobertura` con `PERFILES.direccion`: < 30 bajo en rojo,
// > 120 alto en naranja, lo demás verde). Antes la Ciudad pintaba verde 10 días (Inicio: rojo «Bajo») y ámbar 100 (Inicio: sano).
export function estadoDias(v) { const d = diasCedis(v); return d == null ? null : estadoCobertura(d, PERFILES.direccion); }
export function tonoDias(v) { const e = estadoDias(v); return e == null ? null : e === 'critico' ? 'rojo' : e === 'sobre' ? 'ambar' : 'verde'; }
export function motivoDias(v) { const d = diasCedis(v), e = estadoDias(v); return e === 'critico' ? `Sólo ${plural(d, 'día')} de inventario` : e === 'sobre' ? `${plural(d, 'día')} de inventario (alto)` : null; }
const diasCobertura = (c) => { const k = leeNum(c); return k == null || Math.round(k) < 0 ? null : `${(Math.round(k) + 0).toLocaleString('es-MX')} d`; };
export function recursosBarra(r) {
  if (!r) return [];
  // 4.7.14: montos en texto con «$», comas o espacios («$5,000») se leen como número (antes 0: cartera «verde» y % de ventas 0).
  const n = N, out = [];
  // 4.7.25: `pctTexto` con `porcentaje()` («1,250 %»; antes «1250%» pegado) y días de cobertura con miles es-MX («1,200 d»).
  // 4.12.35: el tono sale del avance sin redondear, como la píldora de cuota de Inicio (`toneCuota(c.pct)`): 99.6 % ya no sale
  // verde ni 84.6 % sin tono (antes se redondeaba a 100 % / 85 % antes de pintar).
  if (r.cur) { const v = n(r.cur.fact_neta), q = n(r.cuotaPeriodo), crudo = q > 0 ? (v / q) * 100 : null, pct = crudo == null ? null : Math.round(crudo); out.push({ clave: 'ventas', icono: '💰', etiqueta: 'Ventas del mes', valor: v, pct, pctTexto: pct == null ? null : porcentaje(pct), tono: tonoCuota(crudo), ir: { tipo: 'oficina' } }); }
  // 4.12.16: los días de cobertura llevan el semáforo «Días de Inv» de Inicio (`tonoDias`: < 30 rojo, > 120 ámbar), como el CEDIS;
  // antes salían siempre en gris. Sin medida (null, ilegible, negativo) → sin tono.
  if (r.inv) out.push({ clave: 'inventario', icono: '📦', etiqueta: 'Inventario', valor: n(r.inv.valor), extra: diasCobertura(r.inv.cobertura), tono: diasCobertura(r.inv.cobertura) ? tonoDias(r.inv.cobertura) : null, ir: { tipo: 'cedis' } });
  if (r.cartera) out.push({ clave: 'cartera', icono: '🏦', etiqueta: 'Cartera vencida', valor: n(r.cartera.vencido), tono: tonoCartera(r.cartera.vencido, r.cartera.pctVencido), ir: { tipo: 'banco' } }); // 4.12.17: semáforo de Inicio
  if (r.enCamino) out.push({ clave: 'embarques', icono: '🚢', etiqueta: 'En tránsito', valor: n(r.enCamino.valor), extra: posTexto(r.enCamino.pos), ir: { tipo: 'puerto' } });
  return out;
}

// Burbujas de atención (etapa 4, paso 1, 3.90.43): qué edificio pide atención y por qué, con reglas sobre el modelo ya armado.
// Cartera o pagos vencidos → banco; contenedor con ETA vencida o que llega en ≤ 3 días → puerto; reunión que empieza en
// ≤ 15 min → oficina. Rojo primero. Cada una trae el `tag` para abrir la tarjeta del edificio.
export function burbujasAtencion(m, hoy = new Date()) {
  hoy = fechaHoy(hoy);
  if (!m) return [];
  const pesos = pesosCorto; // 4.7.8: antes 999 600 salía «$1000 K» y los negativos «$-5000»
  const out = []; const b = m.banco;
  // 4.12.17: la cartera vencida usa el semáforo de Inicio (rojo > 15 % del saldo, si no ámbar); un pago vencido (rojo) gana a la cartera ámbar.
  const tonoC = b ? tonoCartera(b.carteraVencida, b.pctVencido) : 'verde';
  if (b && tonoC === 'rojo') out.push({ lugar: 'banco', icono: '🏦', nivel: 'rojo', texto: `Cartera vencida ${pesos(b.carteraVencida)}` });
  else if (b && numero(b.pagosVencidos) > 0) out.push({ lugar: 'banco', icono: '🏦', nivel: 'rojo', texto: plural(b.pagosVencidos, 'pago vencido', 'pagos vencidos') }); // 4.7.9: «1» en texto ya no dice «1 pagos vencidos»
  else if (tonoC === 'ambar') out.push({ lugar: 'banco', icono: '🏦', nivel: 'ambar', texto: `Cartera vencida ${pesos(b.carteraVencida)}` });
  const barcos = comoLista(m.puerto?.barcos).filter(Boolean); // 4.3.3: renglones nulos no truenan; 4.7.59: algo que no es lista → sin barcos (antes error)
  const tarde = barcos.filter((x) => !x.arribo && x.llegaEnDias != null && x.llegaEnDias < 0).length;
  const pronto = barcos.filter((x) => !x.arribo && x.llegaEnDias != null && x.llegaEnDias >= 0 && x.llegaEnDias <= 3).length;
  if (tarde) out.push({ lugar: 'puerto', icono: '🚢', nivel: 'rojo', texto: `${plural(tarde, 'contenedor', 'contenedores')} con ETA vencida` });
  else if (pronto) out.push({ lugar: 'puerto', icono: '🚢', nivel: 'ambar', texto: `${pronto === 1 ? '1 contenedor llega' : `${plural(pronto, 'contenedor', 'contenedores')} llegan`} en ≤ 3 días` });
  const oc = Math.round(numero(m.ocDetenidas)); // 4.7.19: «1,200» en texto cuenta; alerta `oc_detenida` (pedidos de cliente detenidos) → CEDIS
  if (oc > 0) out.push({ lugar: 'cedis', /* 4.7.59: negativo ya no da «-3 pedidos …» en rojo */ icono: '📦', nivel: 'rojo', texto: plural(oc, 'pedido de cliente detenido', 'pedidos de cliente detenidos') /* 4.7.10: oc decimal/texto con plural() */ });
  const ahora = hoy.getHours() * 60 + hoy.getMinutes();
  const prox = comoLista(m.oficina?.agenda).find((r) => r && r.estado === 'próxima' && r.ini - ahora <= 15 && r.ini - ahora >= 0);
  if (prox) out.push({ lugar: 'oficina', icono: '📅', nivel: 'ambar', texto: `${unirTexto(prox.titulo) || 'Reunión'} ${enMinutos(prox.ini - ahora)}` });
  return out.map((x) => ({ ...x, tag: { tipo: x.lugar } })).sort((a, c) => (a.nivel === 'rojo' ? 0 : 1) - (c.nivel === 'rojo' ? 0 : 1));
}

export function racksPorMarca(filas = [], marcas = null, n = 8, demanda = null) {
  n = cuantos(n, 8);
  // SKU limpio (3.110.3): « abc» y «ABC» son el mismo SKU (cuenta una vez y encuentra su marca y su demanda).
  const get = (k) => (marcas instanceof Map ? marcas.get(k) : marcas?.[k]);
  const marcaDe = (raw, k) => norm(get(raw) ?? get(String(raw).trim()) ?? get(k)) || 'SIN MARCA';
  const por = new Map();
  for (const r of comoLista(filas)) {
    const k = claveSku(r?.articulo);
    if (!k || !(N(r.inventario) > 0)) continue;
    const m = marcaDe(r.articulo, k); const g = por.get(m) || { marca: m, valor: 0, piezas: 0, skus: new Set() };
    g.valor += N(r.costoinventario); g.piezas += N(r.inventario); g.skus.add(k); por.set(m, g);
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
/** Piezas por mes del pivote de sell in (4.7.33): lista tal cual; texto «[1,2]» (JSON) o «{1,2}» (arreglo de Postgres) → lista;
 *  cualquier otra cosa → []. */
export function piezasMes(x) {
  if (Array.isArray(x)) return x;
  if (typeof x !== 'string') return [];
  const s = x.trim(); if (!/^[[{].*[\]}]$/s.test(s)) return [];
  if (s[0] === '{') return /[:"]/.test(s) ? [] : s.slice(1, -1).split(',').map((v) => (/^\s*null\s*$/i.test(v) ? 0 : v.trim()));
  try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch { return []; }
}

export function demanda3Meses(rows = [], hoy = new Date()) {
  hoy = fechaHoy(hoy);
  const cerrados = [1, 2, 3].map((i) => { const f = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1); return { anio: f.getFullYear(), mes: f.getMonth() + 1 }; });
  const m = new Map();
  for (const r of comoLista(rows)) {
    const sku = claveSku(r?.sku); if (!sku) continue;
    // Pulido (4.7.33): `piezas` que no es lista se lee con `piezasMes()` (texto JSON «[10,20]» o «{10,20}» de Postgres; antes se
    // indexaban sus caracteres y «[10,20,30]» sumaba dígitos sueltos); null, objeto o basura → sin demanda. Piezas negativas no restan.
    const pz = piezasMes(r.piezas); let s2 = 0; for (const c of cerrados) if (N(r.anio) === c.anio) s2 += Math.max(0, N(pz[c.mes - 1]));
    if (s2) m.set(sku, (m.get(sku) || 0) + s2);
  }
  return m;
}

/** Acomodo de los racks dentro de la nave del CEDIS (interior, 3.90.31): rejilla de `cols` columnas centrada en la nave
 *  (`ancho` × `largo`, centro 0,0) y `niveles` de cajas según el valor de la marca frente a la mayor (1…`maxNiveles`).
 *  Nada escala por tamaño de cliente: aquí escala el inventario propio de Acteck por marca, que es lo que se ve en Inventario. */
export function acomodoRacks(racks = [], op) {
  const { ancho = 14, largo = 9, cols = 3, maxNiveles = 5 } = op && typeof op === 'object' ? op : {}; // (4.3.19) opciones null → omisión
  // (4.3.11) Acepta algo que no es lista, cols 0/decimal (antes NaN/Infinity en x) y maxNiveles inválido; valor negativo = 1 nivel.
  // 4.12.45: marca que es objeto, lista, booleano o NaN se salta (antes `String()` dibujaba un rack «[object Object]» / «true»); la marca sale limpia.
  const rs = (Array.isArray(racks) ? racks : []).filter((r) => r && typeof r === 'object' && claveTexto(r.marca)).map((r) => ({ ...r, marca: claveTexto(r.marca) })); if (!rs.length) return [];
  const c = Math.max(1, Math.floor(Number(cols)) || 1), tope = Math.max(1, Math.floor(Number(maxNiveles)) || 1);
  const max = Math.max(...rs.map((r) => N(r.valor))); const filas = Math.ceil(rs.length / c);
  const dx = ancho / c, dz = largo / filas;
  return rs.map((r, i) => ({ ...r, x: -ancho / 2 + dx * ((i % c) + .5), z: -largo / 2 + dz * (Math.floor(i / c) + .5), niveles: max > 0 ? Math.max(1, Math.min(tope, Math.ceil(N(r.valor) / max * tope))) : 1 }));
}

/** Tarjeta del edificio (una sola plantilla, estilo Hay Day): de un tag tocado → { titulo, sub, estado: 'verde'|'ambar'|'rojo'|null,
 *  numeros: [[etiqueta, valor]] (máx. 4), pagina }. Los números salen del mismo modelo (mismas vistas que el dashboard). */
export function tarjetaDe(tag, modelo) {
  if (!tag) return null;
  // 4.3.9: mismo formato que el resto (999 600 → «$1.0 M», no «$1000 K»; negativos «-$5 K») y listas sin nulos.
  const pesos = pesosCorto, sn = (l) => (Array.isArray(l) ? l : []).filter(Boolean);
  // 4.12.48: todos los `num()` de las tarjetas son conteos, piezas o días: se redondean (antes «2.5» personas, «1,202.6» pendientes; -0.4 → «0»).
  const num = (v) => (Math.round(numero(v)) + 0).toLocaleString('es-MX');
  const t = { titulo: tag.titulo || '', sub: tag.sub || '', estado: null, numeros: [], pagina: tag.pagina || null };
  const m = modelo || {};
  if (tag.tipo === 'oficina' && m.oficina) {
    // 4.12.1: conteos como número ≥ 0 (antes «2» en texto se concatenaba: «0 2 1» → «21» pendientes; negativos restaban).
    const c0 = (v) => Math.max(0, numero(v)), o = m.oficina, pend = sn(o.personas).reduce((s, p) => s + c0(p.pendientes), 0), hechas = sn(o.personas).reduce((s, p) => s + c0(p.hechas), 0);
    t.numeros = [['Personas', num(sn(o.personas).length + c0(o.genericos))], ['Reuniones hoy', (() => { const p = sn(o.agenda).find((r) => r.estado !== 'hecha'); return p ? `${num(o.reuniones)} · ${p.estado === 'en curso' ? 'en curso' : `próxima ${p.hora}`}` : num(o.reuniones); })()], ['Pendientes', num(pend)], ['Hechas', num(hechas)]];
    t.estado = o.reunionEnCurso ? 'ambar' : 'verde';
  } else if (tag.tipo === 'sala' && m.oficina) {
    // Sala de juntas (interior de la oficina, 3.90.38): las reuniones de hoy en orden; en curso = ámbar.
    const ag = sn(m.oficina.agenda);
    t.numeros = ag.length ? ag.slice(0, 5).map((r) => [`${r.hora}${r.estado === 'en curso' ? ' · ahora' : r.estado === 'hecha' ? ' · ✓' : ''}`, r.titulo]) : [['Reuniones hoy', 'ninguna']];
    t.estado = ag.some((r) => r.estado === 'en curso') ? 'ambar' : 'verde';
  } else if ((tag.tipo === 'cedis' || tag.tipo === 'montacargas') && m.cedis) {
    const c = m.cedis, d = diasCedis(c.dias);
    t.numeros = [['Inventario', pesos(c.valor)], ['Días de inventario', d == null ? 'sin medida' : num(d)], ['Piezas', num(c.piezas)], ['SKUs con stock', num(c.skus)]];
    t.estado = tonoDias(d);
  } else if (tag.tipo === 'rack') {
    const r = sn(m.cedis?.racksMarca).find((x) => x.marca === tag.marca);
    if (r) {
      const tot = sn(m.cedis.racksMarca).reduce((s2, x) => s2 + numero(x.valor), 0);
      t.numeros = [['Inventario', `${pesos(r.valor)} · ${porcentaje(tot > 0 ? numero(r.valor) / tot * 100 : 0)}`], ['Días de inventario', r.dias == null ? 'sin demanda' : num(r.dias)], ['Piezas', num(r.piezas)], [r.marcas ? `SKUs · ${plural(r.marcas, 'marca')}` : 'SKUs con stock', num(r.skus)]];
      // 4.12.15: mismo semáforo que el CEDIS y «Días de Inv» de Inicio (`tonoDias()`: < 30 rojo, > 120 ámbar). Antes el rack seguía con
      // los umbrales viejos (> 120 rojo, > 90 ámbar): 10 días salían en verde y 900 en rojo mientras el CEDIS decía lo contrario.
      t.estado = tonoDias(r.dias);
    }
  } else if (tag.tipo === 'barco' && m.puerto) {
    // Contenedor en el mar (interior del puerto, 3.90.34): proveedor, ETA, piezas y POs (`v_embarques_contenedor`). ETA vencida sin arribo = rojo.
    const b = [...sn(m.puerto.barcos), ...sn(m.puerto.tarimas)].find((x) => x.id === tag.id);
    if (b) {
      const fc = fechaCorta(b.arribo, m.hoyIso) || fechaCorta(b.eta, m.hoyIso) || 's/f'; // 4.3.30: sin «Invalid Date»
      const est = estatusBarco(b.estatus); // 4.7.84: estatus con los nombres del Plan de compras («Por zarpar», «En el mar»)
      const cuando = b.llegaEnDias == null ? (est ? `sin ETA · ${est.toLowerCase()}` : 'sin ETA') : `${fc} · ${llegaBarco(b.llegaEnDias).replace(/^llega /, '')}`; // 4.7.6: «mañana» (antes «en 1 d»)
      if (est && !t.sub.toLowerCase().includes(est.toLowerCase())) t.sub = unirTexto(t.sub, est);
      t.numeros = [['Proveedor', unirTexto(b.supplier) || '—' /* 4.7.42: « » ya no sale vacío */], [b.arribo ? 'Arribo CEDIS' : 'ETA puerto', cuando], ['Piezas', num(b.piezas)], ['POs', listaCorta(b.listaPos) || (b.pos ? num(b.pos) : '—')]];
      t.estado = b.llegaEnDias == null ? 'ambar' : b.llegaEnDias < 0 ? 'rojo' : 'verde';
    }
  } else if (tag.tipo === 'puerto' && m.puerto) {
    const p = m.puerto, b = sn(p.barcos), d = (x) => (Number.isFinite(x.llegaEnDias) ? x.llegaEnDias : null);
    const pronto = b.filter((x) => d(x) != null && d(x) >= 0 && d(x) <= 7).length, tarde = b.filter((x) => !x.arribo && d(x) != null && d(x) < 0).length; // 4.12.20: los atrasados ya no cuentan como «llegan en 7 días»
    t.numeros = [['Navegando', num(b.length)], tarde ? ['ETA vencida', num(tarde)] : ['Piezas en el mar', num(p.totalPiezas)], ['Llegan en 7 días', num(pronto)], ['Descargando', num(sn(p.tarimas).length)]];
    t.estado = tarde ? 'rojo' : b.some((x) => d(x) == null) ? 'ambar' : 'verde'; // 4.12.20: rojo como su globo «con ETA vencida» (antes verde)
  } else if (tag.tipo === 'banco' && m.banco) {
    const b = m.banco;
    // 4.7.81: como la cartera de Inicio, la vencida dice su % del saldo total y las cuentas el DSO ponderado (la tarjeta es de 4 renglones).
    const pct = b.pctVencido != null && numero(b.saldo) > 0 ? `${porcentaje(b.pctVencido)} del saldo` : '';
    // 4.12.27: y la parte a más de 90 días, como la frase de cartera de Inicio.
    const m90 = numero(b.mas90) > 0 ? `${pesosCorto(b.mas90)} a +90 días` : '';
    t.numeros = [['Cartera vencida', unirTexto(pesos(b.carteraVencida), pct, m90)], ['Cuentas con vencido', unirTexto(num(b.cuentasVencidas), dsoTexto(b.dso))], ['Pagos 7 días', `${num(b.pagosSemana)} · ${pesos(b.montoSemana)}`], ['Pagos vencidos', `${num(b.pagosVencidos)} · ${pesos(b.montoVencido)}`]];
    // 4.12.17: pagos vencidos rojo; la cartera vencida con el semáforo de Inicio (> 15 % del saldo rojo, si no ámbar).
    const tc = tonoCartera(b.carteraVencida, b.pctVencido);
    t.estado = numero(b.pagosVencidos) > 0 || tc === 'rojo' ? 'rojo' : tc === 'ambar' || numero(b.pagosSemana) > 0 ? 'ambar' : 'verde';
  } else if (tag.tipo === 'torre' && m.torre) {
    const r = m.torre;
    t.numeros = [['Propuestas abiertas', num(r.abiertas)], ['SKUs confirmados', `${num(r.confirmadas)} de ${num(r.lineas)}`], ['Comprados', num(r.compradas)], ['Arribos 7 días', `${num(r.arribos7)}${numero(r.atrasados) > 0 ? ` · ${plural(numero(r.atrasados), 'atrasado')}` : ''}`]]; // 4.7.23: «1» en texto = singular
    t.estado = numero(r.atrasados) > 0 ? 'rojo' : numero(r.arribos7) > 0 ? 'ambar' : 'verde';
  } else if (tag.tipo === 'ciudad') {
    const d = sn(m.distritos).find((x) => x.ciudad === tag.ciudad) || tag.distrito;
    if (d) {
      const ts = sn(d.tiendas), act = ts.filter((x) => x.vendio).length, venta = ts.reduce((s, x) => s + numero(x.importe), 0), r = ts.length ? act / ts.length : 0;
      t.numeros = [['Tiendas activas', `${num(act)} de ${num(ts.length)}`], ['Venta del mes', pesos(venta)], ['Clientes', num(sn(d.cuentas).length || new Set(ts.map((x) => x.cuenta)).size)], ['Vendedores', num(sn(d.vendedores).length)]];
      const cq = cuotaRitmo(m, ts.map((x) => x.cuenta)); if (cq) { t.numeros.splice(2, 0, ['Cuota del mes', `${porcentaje(cq.pct)} · ritmo ${porcentaje(cq.ritmo)}`]); t.cuota = cq.tono; } // 3.90.60
      t.estado = tonoActivas(act, ts.length); // 4.12.19: mismo semáforo que la cadena y sus cintas (antes 60 % / 30 %)
    }
  } else if (tag.tipo === 'tienda') {
    const d = sn(m.distritos).find((x) => x.ciudad === tag.ciudad);
    const s = sn(d?.tiendas).find((x) => x.cuenta === tag.cuenta && nombreTienda(x) === tag.titulo);
    if (s) {
      t.numeros = [['Este mes', pesos(s.importe)], ['Mes anterior', pesos(s.previo)]];
      if (numero(s.vendedores) > 0) t.numeros.push(['Vendedores', num(s.vendedores)]);
      // 4.12.23: con el % del saldo de la cuenta y el semáforo de Inicio (`tonoCartera()`): vencido ≤ 15 % del saldo es ámbar, no rojo.
      const venc = numero(s.cartera?.vencido), sal = numero(s.cartera?.saldo), pv = venc > 0 && sal > 0 ? (venc / sal) * 100 : null;
      if (venc > 0) t.numeros.push(['Cartera vencida', pv == null ? pesos(venc) : `${pesos(venc)} · ${porcentaje(pv)} del saldo`]); // 4.7.23: «$5,000» en texto ya cuenta
      const cq = cuotaRitmo(m, [s.cuenta]); if (cq) { t.numeros.splice(2, 0, ['Cuota de la cuenta', `${porcentaje(cq.pct)} · ritmo ${porcentaje(cq.ritmo)}`]); t.cuota = cq.tono; } // 3.90.60
      const tv = s.vendioMes ? 'verde' : s.vendio ? 'ambar' : 'rojo', tc = tonoCartera(venc, pv); // gana el peor de venta y cartera
      t.estado = tv === 'rojo' || tc === 'rojo' ? 'rojo' : tv === 'ambar' || tc === 'ambar' ? 'ambar' : 'verde';
    }
  } else if (tag.tipo === 'persona' && tag.persona && !tag.persona.generico) {
    // 4.12.55: conteos negativos cuentan 0, como su globo (`pendientesTexto()`); antes «Hechas -2» y el semáforo se invertía.
    const p = tag.persona, pend = Math.max(0, numero(p.pendientes)), hech = Math.max(0, numero(p.hechas));
    t.numeros = [['Pendientes hoy', num(pend)], ['Hechas', num(hech)]];
    const pr = p.presencia; if (pr) t.numeros.unshift(['Ahora', pr.estado === 'viaje' ? unirTexto('De viaje', pr.titulo) : pr.estado === 'reunion' ? unirTexto('En reunión', pr.titulo) : 'Disponible']);
    t.estado = p.actividad ? 'verde' : pend > hech ? 'ambar' : 'verde';
  } else if (tag.tipo === 'camion') {
    // Camión (etapa 5, 3.90.54): factura (cliente, monto, piezas) o envío del Tracking (paquetería), cuándo salió y destino.
    // Envío con más de 5 días en camino = ámbar.
    const c = sn(m.camiones).find((x) => x.folio === tag.folio);
    if (c) {
      const nd = c.fecha ? dias(c.fecha, m.hoyIso || diaLocal().iso) : null, n = Number.isFinite(nd) ? nd : null; // fecha mala: sin «hace NaN d»
      const fs = fechaIso(c.fecha); // 4.7.23: un Date ya no sale «Wed Oct 07»; ilegible → «—»
      // 4.12.12: con fecha futura (factura/envío fechado adelante) el renglón dice «Sale · 26 nov · mañana» / «· en 3 d» (antes «Salió · 26 nov · hoy»).
      const futuro = n != null && n < 0, cuando = futuro ? faltanDias(-n) : haceDias(n); // 4.12.61: «en 3 meses» (antes «en 400 d»)
      const salio = fs ? unirTexto([fechaCorta(fs, m.hoyIso), cuando]) || fechaCorta(fs, m.hoyIso) : '—'; // 4.7.43: «6 oct · ayer» (antes «2026-10-06» crudo)
      const rSalio = [futuro ? 'Sale' : 'Salió', salio];
      // 4.7.41: destino con `nombreCiudad()` («LEON» → «León», «SAN LUIS POTOSI» → «San Luis Potosí», CDMX; antes «Leon»)
      // y cliente/paquetería con `unirTexto()` (« » o «null» ya no salen como texto: «—»).
      const destino = nombreCiudad(c.ciudad) || '—', txt = (x) => unirTexto(x) || '—';
      t.numeros = c.envio ? [['Cliente', txt(c.cliente)], ['Paquetería', txt(c.paqueteria)], rSalio, ['Destino', destino]] : [['Cliente', txt(c.cliente)], ['Factura', pesos(c.monto)], ['Piezas', num(c.piezas)], rSalio];
      t.estado = c.envio && n != null && n > 5 ? 'ambar' : 'verde';
    }
  } else if (tag.tipo === 'vendedorErp') {
    // Vendedor del ERP en ruta (etapa 5, 3.90.53): ventas del mes y del año (`v_ventas_vendedor_cliente_mes`) y a quién visita.
    const v = sn(m.vendedoresRuta).find((x) => x.nombre === tag.titulo);
    if (v) { t.numeros = [['Ventas del mes', pesos(v.totalMes)], ['Ventas del año', pesos(v.total)], ['Clientes', num(v.clientes)], ['Ruta', sn(v.destinos).map((x) => unirTexto(x.cliente)).filter(Boolean).slice(0, 3).join(' → ') || '—']]; t.estado = numero(v.totalMes) > 0 ? 'verde' : 'ambar'; }
  } else if (tag.tipo === 'barco' && tag.barco) {
    const b = tag.barco; t.numeros = [['Piezas', num(b.piezas)], ['ETA puerto', fechaCorta(b.eta, m.hoyIso) || '—'], ['Llega a CEDIS', fechaCorta(b.arribo, m.hoyIso) || '—']] /* 4.7.42: «23 nov» (antes «2026-11-23» crudo) */;
    const est = estatusBarco(b.estatus); if (est) t.numeros.push(['Estatus', est]); // 4.7.41: « » / «null» ya no salen; 4.7.84: «En el mar» como el Plan de compras
    t.estado = b.llegaEnDias == null ? 'ambar' : b.llegaEnDias < 0 && !b.arribo ? 'rojo' : 'verde'; // 4.12.20: atrasado en rojo como la tarjeta por id
  }
  t.numeros = t.numeros.slice(0, 4);
  return t;
}
export function vistaMapa(op) { // op null/no objeto → omisión (antes la desestructuración lanzaba error)
  const { ang = Math.PI / 4, aspecto = 1.6 } = op && typeof op === 'object' ? op : {};
  return encuadre(EXTREMOS_MEXICO.map((c) => ({ ...posDe(c), r: 4 })), { ang, aspecto, margen: 1.05, min: ZOOM_MIN, max: ZOOM_MAX });
}

/** Color de cada cuenta (toldo y letrero de sus tiendas, sus vendedores, la leyenda). */
export const COLOR_CUENTA = { ct: 0x0A84FF, cva: 0xFF9F0A, dicotech: 0x30D158, digitalife: 0xBF5AF2, pcel: 0xFF453A, ingram: 0x5AC8FA, pch: 0xFFD60A, loma: 0x64D2FF, guc: 0xFF6482, kabik: 0xA2845E, dcmayorista: 0x7D8BFF, exel: 0x30B0C7, techsmart: 0xAC8E68, arroba: 0xD4A5FF, ingram_retail: 0x5AC8FA, directo: 0x8E8E93 };
// 4.12.42: el color se busca con la cuenta sin espacios ni mayúsculas (« PCEL » → rojo de pcel; antes la tienda, su vendedor y
// la leyenda salían grises). Cuenta vacía, objeto, NaN o desconocida → gris de omisión.
export function colorCuenta(cuenta, omision = 0x8E8E93) { const k = unirTexto(cuenta).toLowerCase(); return (k && Object.hasOwn(COLOR_CUENTA, k) && COLOR_CUENTA[k]) || omision; }
// Color inválido (undefined, texto, negativo, > 0xFFFFFF) → gris de omisión; antes salía «#000NaN» (CSS inválido).
// Sólo enteros 0..0xFFFFFF: un decimal (255.7, -0.4) es dato roto y va gris, no un color redondeado.
export const hexCss = (n) => { const v = typeof n === 'number' || (typeof n === 'string' && n.trim() !== '') ? Number(n) : NaN; return `#${(Number.isInteger(v) && v >= 0 && v <= 0xFFFFFF ? v : 0x8E8E93).toString(16).padStart(6, '0')}`; };

/** Sede de cada cuenta de sell out (de dónde es el cliente). Las que reportan estado en el sell out lo usan primero. */
export const SEDE_POR_CUENTA = {
  ct: 'HERMOSILLO', cva: 'GUADALAJARA', dicotech: 'ZACATECAS', digitalife: 'GUADALAJARA', pcel: 'MONTERREY',
  ingram: 'CIUDAD DE MEXICO', ingram_retail: 'CIUDAD DE MEXICO', pch: 'CIUDAD DE MEXICO', loma: 'MONTERREY', guc: 'MONTERREY',
  kabik: 'MERIDA', dcmayorista: 'PUEBLA', exel: 'MONTERREY', techsmart: 'GUADALAJARA', arroba: 'GUADALAJARA', directo: 'GUADALAJARA',
};
// 4.12.41: la sede se busca con la cuenta sin espacios ni mayúsculas (« PCEL » → Monterrey; antes caía en la de omisión y
// la cartera de la cuenta no encontraba su tienda). Cuenta vacía, objeto o NaN → la de omisión.
export function sedeDeCuenta(cuenta, omision = 'GUADALAJARA') { const k = unirTexto(cuenta).toLowerCase(); return (k && Object.hasOwn(SEDE_POR_CUENTA, k) && SEDE_POR_CUENTA[k]) || omision; }
// Alias de nombres de sucursal → ciudad del catálogo (lo que no cae aquí se busca por coincidencia de palabras).
const ALIAS = {
  CDMX: 'CIUDAD DE MEXICO', MEXICO: 'CIUDAD DE MEXICO', 'CD DE MEXICO': 'CIUDAD DE MEXICO', AZCAPOTZALCO: 'CIUDAD DE MEXICO', VALLEJO: 'CIUDAD DE MEXICO',
  CEYLAN: 'CIUDAD DE MEXICO', AEROPUERTO: 'CIUDAD DE MEXICO', 'FACTURACION AEROPUERTO': 'CIUDAD DE MEXICO', NAUCALPAN: 'CIUDAD DE MEXICO', TLALNEPANTLA: 'CIUDAD DE MEXICO',
  GDL: 'GUADALAJARA', ZAPOPAN: 'GUADALAJARA', TLAQUEPAQUE: 'GUADALAJARA', 'NUEVO LEON': 'MONTERREY', MTY: 'MONTERREY', 'SAN NICOLAS': 'MONTERREY', GUADALUPE: 'MONTERREY', APODACA: 'MONTERREY', ESCOBEDO: 'MONTERREY',
  'BAJA CALIFORNIA NORTE': 'TIJUANA', 'BAJA CALIFORNIA': 'TIJUANA', 'BAJA CALIFORNIA SUR': 'LA PAZ', COAHUILA: 'SALTILLO', JALISCO: 'GUADALAJARA', SONORA: 'HERMOSILLO',
  SINALOA: 'CULIACAN', YUCATAN: 'MERIDA', 'QUINTANA ROO': 'CANCUN', 'JUAREZ': 'CIUDAD JUAREZ', 'CD JUAREZ': 'CIUDAD JUAREZ', 'SLP': 'SAN LUIS POTOSI', TUXTLA: 'TUXTLA GUTIERREZ',
  VERACRUZ: 'VERACRUZ', 'EDO MEX': 'TOLUCA', 'ESTADO DE MEXICO': 'TOLUCA', PUEBLA: 'PUEBLA', MERIDA: 'MERIDA', 'SAN LUIS': 'SAN LUIS POTOSI',
  // 4.12.5: municipios conurbados y abreviaturas comunes (antes «San Pedro Garza García», «Tonalá», «Metepec», «QRO» o «AGS» no
  // caían en ninguna ciudad y la tienda no salía en el mapa). Sólo nombres sin ambigüedad: «San Pedro» solo no (hay en Cholula).
  'SAN PEDRO GARZA GARCIA': 'MONTERREY', 'GARZA GARCIA': 'MONTERREY', 'SANTA CATARINA': 'MONTERREY', 'STA CATARINA': 'MONTERREY',
  TONALA: 'GUADALAJARA', TLAJOMULCO: 'GUADALAJARA', METEPEC: 'TOLUCA', ECATEPEC: 'CIUDAD DE MEXICO', NEZAHUALCOYOTL: 'CIUDAD DE MEXICO',
  CUAUTITLAN: 'CIUDAD DE MEXICO', COACALCO: 'CIUDAD DE MEXICO', ATIZAPAN: 'CIUDAD DE MEXICO', HUIXQUILUCAN: 'CIUDAD DE MEXICO',
  'GOMEZ PALACIO': 'TORREON', CHOLULA: 'PUEBLA', QRO: 'QUERETARO', AGS: 'AGUASCALIENTES', CHIH: 'CHIHUAHUA', HMO: 'HERMOSILLO',
  // 4.12.6: más conurbados (antes «Boca del Río», «Cd. Madero», «Coyoacán», «El Marqués» o «Ramos Arizpe» no salían en el mapa).
  // Sólo nombres de municipio/alcaldía sin calle homónima común (no «Miguel Hidalgo», «Benito Juárez», «Corregidora»).
  COYOACAN: 'CIUDAD DE MEXICO', IZTAPALAPA: 'CIUDAD DE MEXICO', TLALPAN: 'CIUDAD DE MEXICO', XOCHIMILCO: 'CIUDAD DE MEXICO', CUAJIMALPA: 'CIUDAD DE MEXICO',
  IZTACALCO: 'CIUDAD DE MEXICO', TLAHUAC: 'CIUDAD DE MEXICO', 'GUSTAVO A MADERO': 'CIUDAD DE MEXICO', CHIMALHUACAN: 'CIUDAD DE MEXICO', IXTAPALUCA: 'CIUDAD DE MEXICO',
  TECAMAC: 'CIUDAD DE MEXICO', TULTITLAN: 'CIUDAD DE MEXICO', 'NICOLAS ROMERO': 'CIUDAD DE MEXICO', ZINACANTEPEC: 'TOLUCA',
  'BOCA DEL RIO': 'VERACRUZ', 'CIUDAD MADERO': 'TAMPICO', 'CD MADERO': 'TAMPICO', ALTAMIRA: 'TAMPICO', 'EL MARQUES': 'QUERETARO',
  'RAMOS ARIZPE': 'SALTILLO', ROSARITO: 'TIJUANA', 'SOLEDAD DE GRACIANO SANCHEZ': 'SAN LUIS POTOSI', 'MINERAL DE LA REFORMA': 'PACHUCA',
  JIUTEPEC: 'CUERNAVACA', 'VILLA DE ALVAREZ': 'COLIMA',
  // 4.12.10: nombres comunes de las ciudades nuevas del catálogo; «Álvaro Obregón» es alcaldía de CDMX, no Cd. Obregón.
  'ALVARO OBREGON': 'CIUDAD DE MEXICO', 'CABO SAN LUCAS': 'LOS CABOS', 'SAN JOSE DEL CABO': 'LOS CABOS', 'CD OBREGON': 'CIUDAD OBREGON', 'CD DEL CARMEN': 'CIUDAD DEL CARMEN',
  'PLAYA DEL CARMEN': 'PLAYA DEL CARMEN', 'NVO LAREDO': 'NUEVO LAREDO',
  // 4.12.69: más municipios conurbados (antes «Texcoco», «Valle de Chalco», «Plaza Satélite», «Interlomas», «Neza», «Temixco»,
  // «Kanasín»… no salían en el mapa). «Satélite» solo no (hay colonias así en otras ciudades); tampoco «Lerma» ni «Lerdo» (calles).
  TEXCOCO: 'CIUDAD DE MEXICO', CHALCO: 'CIUDAD DE MEXICO', 'VALLE DE CHALCO': 'CIUDAD DE MEXICO', HUEHUETOCA: 'CIUDAD DE MEXICO',
  ZUMPANGO: 'CIUDAD DE MEXICO', TULTEPEC: 'CIUDAD DE MEXICO', ACOLMAN: 'CIUDAD DE MEXICO', CHICOLOAPAN: 'CIUDAD DE MEXICO',
  'LOS REYES LA PAZ': 'CIUDAD DE MEXICO', NEZA: 'CIUDAD DE MEXICO', 'CIUDAD SATELITE': 'CIUDAD DE MEXICO', 'CD SATELITE': 'CIUDAD DE MEXICO',
  'PLAZA SATELITE': 'CIUDAD DE MEXICO', INTERLOMAS: 'CIUDAD DE MEXICO', 'SAN MATEO ATENCO': 'TOLUCA', CUAUTLANCINGO: 'PUEBLA',
  TEMIXCO: 'CUERNAVACA', KANASIN: 'MERIDA', TARIMBARO: 'MORELIA',
};
/** Ciudad representativa de cada estado (para clientes finales, que vienen por estado). */
export const CIUDAD_POR_ESTADO = (() => { const m = {}; for (const [k, v] of Object.entries(CIUDADES)) if (!m[v.estado]) m[v.estado] = k; m['ESTADO DE MEXICO'] = 'TOLUCA'; m.GUANAJUATO = 'LEON'; m['BAJA CALIFORNIA'] = 'TIJUANA'; m.COAHUILA = 'SALTILLO'; m.SINALOA = 'CULIACAN'; m.TAMAULIPAS = 'TAMPICO'; m.VERACRUZ = 'VERACRUZ'; return m; })();
// 4.7.54: palabras completas (antes «WEBER PUEBLA» salía virtual) y «GENERAL ESCOBEDO» es municipio de Monterrey, no virtual.
const VIRTUAL = /(^|[^A-Z])(E-?COMMERCE|AMAZON|MERCADO ?LIBRE|ONLINE|EN LINEA|WEB|DIGITAL|CORPORATIVO|MATRIZ|GENERAL(?! ESCOBEDO)|CEDIS|SIN SUCURSAL)($|[^A-Z])/;

/** Ciudad de una sucursal por su nombre. `null` si es virtual (e-commerce) o no se reconoce. */
export function ciudadDeSucursal(nombre) {
  const s = norm(nombre);
  if (!s) return null;
  if (VIRTUAL.test(s)) return { ciudad: null, virtual: true };
  if (ALIAS[s]) return { ciudad: ALIAS[s], virtual: false };
  if (CIUDADES[s]) return { ciudad: s, virtual: false };
  // 4.7.53: palabras completas (antes «NAPOLEON» → León y «MONTE» → Monterrey) y el alias/ciudad más largo primero (antes
  // «SUC ESTADO DE MEXICO» → CDMX por «MEXICO» y «BAJA CALIFORNIA SUR …» → Tijuana). Números y signos separan («GDL1», «MTY-SUR»).
  const t = ` ${s.replace(/[^A-Z]+/g, ' ').trim()} `, w = t.trim();
  for (const [k, v] of ALIAS_LARGOS) if (t.includes(` ${k} `)) return { ciudad: v, virtual: false };
  for (const k of CIUDADES_LARGAS) if (t.includes(` ${k} `)) return { ciudad: k, virtual: false };
  // nombre parcial: palabra completa de la ciudad («CIUDAD» → la primera) o una palabra cortada de ≥ 6 letras («AGUASCAL»)
  if (w.length >= 4) for (const k of Object.keys(CIUDADES)) if (k.length > 5 && (` ${k} `.includes(` ${w} `) || (w.length >= 6 && !w.includes(' ') && k.split(' ').some((p) => p.startsWith(w))))) return { ciudad: k, virtual: false };
  return { ciudad: null, virtual: false };
}
const ALIAS_LARGOS = Object.entries(ALIAS).sort((a, b) => b[0].length - a[0].length);
const CIUDADES_LARGAS = Object.keys(CIUDADES).sort((a, b) => b.length - a.length);

// Fecha 'AAAA-MM-DD' de un valor de la base (texto ISO, con hora o no, o Date) si es una fecha real; si no (null, «pendiente»,
// '2026-13-40', Date inválido) → null. Así una fecha mala cuenta como «sin fecha» y no da NaN en el puerto ni en los camiones.
const MESES_LETRA = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre', 'january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
export function fechaIso(x) {
  if (x instanceof Date) return Number.isNaN(x.getTime()) ? null : isoLocal(x);
  if (typeof x !== 'string') return null;
  // 4.12.70: «26/11/2026» o «5/1/2026 10:30» (día/mes/año como en México y en Sheets) también se lee (antes null: la fecha
  // contaba como «sin fecha»); '31/02/2026' o mes 13 siguen siendo null.
  // 4.12.73: también con guiones o puntos («26-11-2026», «5.1.2027», como algunos ERP y Excel en español); separadores mezclados siguen null.
  const dm = x.trim().match(/^(\d{1,2})([/.-])(\d{1,2})\2(\d{4})(?:[\sT].*)?$/);
  if (dm) { const s = `${dm[4]}-${dm[3].padStart(2, '0')}-${dm[1].padStart(2, '0')}`; const t = new Date(`${s}T12:00:00`); return !Number.isNaN(t.getTime()) && isoLocal(t) === s ? s : null; }
  // 4.12.74: con el mes en letra («26 nov 2026», «26-nov-2026», «5 de enero de 2027», «26/Nov/2026 10:30», como exportan
  // algunos ERP y reportes en español; antes null: contaba como «sin fecha»). Mes desconocido o '31 feb 2026' siguen null.
  const ml = norm(x).match(/^(\d{1,2})(?:\s+de\s+|[\s/.-]+)([a-z]{3,10})\.?(?:\s+de\s+|[\s/.-]+)(\d{4})(?:[\sT].*)?$/i);
  if (ml) {
    const mes = MESES_LETRA.findIndex((m) => ml[2].toLowerCase() === m || (ml[2].length >= 3 && m.startsWith(ml[2].toLowerCase()))) % 12 + 1;
    if (!mes) return null;
    const s = `${ml[3]}-${String(mes).padStart(2, '0')}-${ml[1].padStart(2, '0')}`; const t = new Date(`${s}T12:00:00`); return !Number.isNaN(t.getTime()) && isoLocal(t) === s ? s : null;
  }
  // 4.12.72: año primero sin ceros o con diagonales («2026-1-5», «2026/01/05 10:30», como exportan Sheets y algunos ERP)
  // también se lee (antes null: contaba como «sin fecha»); '2026/02/30' o mes 13 siguen siendo null.
  const ym = x.trim().match(/^(\d{4})([-/])(\d{1,2})\2(\d{1,2})(?:[\sT].*)?$/);
  if (ym && (ym[2] === '/' || ym[3].length < 2 || ym[4].length < 2)) { const s = `${ym[1]}-${ym[3].padStart(2, '0')}-${ym[4].padStart(2, '0')}`; const t = new Date(`${s}T12:00:00`); return !Number.isNaN(t.getTime()) && isoLocal(t) === s ? s : null; }
  const x0 = x.trim(), s = x0.slice(0, 10); if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = new Date(`${s}T12:00:00`); if (Number.isNaN(t.getTime()) || isoLocal(t) !== s) return null;
  // 4.7.57: con hora y zona («…T03:00:00Z», «… 03:00:00+00» de Postgres) cuenta el día local, no el de UTC:
  // a las 21:00 de Guadalajara ya es mañana en UTC y el camión/arribo salía con un día de más («llega mañana» siendo hoy).
  const z = x0.match(/^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)\s*(Z|[+-]\d{2}(?::?\d{2})?)$/i);
  if (z) {
    const off = /^z$/i.test(z[3]) ? 'Z' : z[3].length === 3 ? `${z[3]}:00` : z[3].includes(':') ? z[3] : `${z[3].slice(0, 3)}:${z[3].slice(3)}`;
    const u = new Date(`${z[1]}T${z[2]}${off}`); if (!Number.isNaN(u.getTime())) return isoLocal(u);
  }
  return s;
}
// Cartera por cuenta (4.7.52): la vista trae un corte por `cliente`, pero « digitalife » y «digitalife» son dos renglones que
// se juntan al limpiar la clave; antes ganaba el último que llegaba (podía ser el corte viejo). Ahora gana el de `fecha_corte`
// más reciente (una fecha ilegible pierde contra una legible; empate → el último). Cliente vacío o renglón nulo se salta.
export function carteraPorCuenta(filas) {
  const out = new Map();
  for (const c of comoLista(filas)) {
    // 4.7.74: la clave va en minúsculas como las cuentas de la Ciudad («PCEL» = «pcel»; antes no encontraba su tienda ni su sede)
    // y un cliente que no es texto ni número (objeto, lista, booleano) se salta (antes la clave «[object Object]» / «true»).
    const cl = c?.cliente, k = typeof cl === 'string' || (typeof cl === 'number' && Number.isFinite(cl)) ? String(cl).trim().toLowerCase() : ''; if (!k) continue;
    // 4.7.81: DSO vacío/ilegible queda null (antes 0 y bajaba el DSO ponderado del banco), como Inicio (`e.dso != null`).
    const v = { vencido: N(c.saldo_vencido), saldo: N(c.saldo_actual), mas90: N(c.aging_mas90), dso: leeNum(c.dso), corte: c.fecha_corte };
    const ya = out.get(k), fa = fechaIso(ya?.corte), fb = fechaIso(v.corte);
    if (!ya || (fb && (!fa || fb >= fa)) || (!fa && !fb)) out.set(k, v);
  }
  return out;
}
// Días entre dos fechas con `fechaIso()` (4.3.29): « 2026-10-03» con espacios o un Date ya cuentan (antes NaN: el camión o el barco desaparecía); ilegible → NaN.
const dias = (a, b) => { const x = fechaIso(a), y = fechaIso(b); return x && y ? Math.round((new Date(`${y}T12:00:00`) - new Date(`${x}T12:00:00`)) / 86400000) : NaN; };
const nombreCorto = (s) => { const p = norm(s).split(/\s+/).filter(Boolean); if (!p.length) return ''; const cap = (w) => w.charAt(0) + w.slice(1).toLowerCase(); return p.length >= 3 ? `${cap(p[0])} ${cap(p[p.length - 2])}` : p.map(cap).join(' '); };

// Barra de tiempo (etapa 6, paso 1): momentos a los que se puede regresar la ciudad (Hoy / Ayer / Hace 7 días / Inicio de mes,
// a la misma hora; inicio de mes = día 1 a mediodía). Se quitan los que caen en el mismo día que uno anterior.
const isoLocal = (t) => `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
// Día local 'AAAA-MM-DD' de «hoy» y su rango [desde, hasta) en ISO para filtrar columnas timestamptz (4.7.32): antes `datos.js`
// usaba toISOString() (UTC) y de 18:00 a 23:59 en Guadalajara la Ciudad pedía la agenda, reuniones y viajes de mañana.
export function diaLocal(h) {
  const t = fechaHoy(h), y = t.getFullYear(), m = t.getMonth(), d = t.getDate();
  return { iso: isoLocal(t), desde: new Date(y, m, d).toISOString(), hasta: new Date(y, m, d + 1).toISOString() };
}
export function momentosTiempo(hoy = new Date()) {
  hoy = fechaHoy(hoy);
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
  const despues = (x) => { const i = fechaIso(x); return !!i && i > f; }; // ilegible = sin fecha (antes «pendiente» > f y se borraba)
  const hastaMes = (rows) => comoLista(rows).filter((r) => r && N(r.anio) * 12 + N(r.mes) <= am); // no-lista (texto, objeto) → vacía, no error
  const envios = comoLista(d.envios).filter((e) => e && !despues(e.fecha_envio_erp || e.fecha_surtida)).map((e) => (despues(e.fecha_entrega_erp || e.fecha_entregada) ? { ...e, fecha_entrega_erp: null, fecha_entregada: null } : e));
  const contenedores = comoLista(d.contenedores).filter((c) => c && !despues(c.fecha_emision)).map((c) => (despues(c.arribo_cedis) ? { ...c, arribo_cedis: null, estatus: /CONCLUIDO/i.test(c.estatus || '') ? 'EN TRANSITO' : c.estatus } : c));
  return { ...d, facturas: comoLista(d.facturas).filter((x) => x && !despues(x.fecha)), envios, contenedores,
    sucursales: hastaMes(d.sucursales), cuentaMes: hastaMes(d.cuentaMes), clientesFinales: hastaMes(d.clientesFinales), vendedoresMayoristas: hastaMes(d.vendedoresMayoristas), vendedoresErp: hastaMes(d.vendedoresErp),
    agendaHoy: [], reunionesHoy: [], viajesHoy: [], _aprox: ['inventario', 'cartera', 'pagos', 'ventas del mes completas', 'agenda'] };
}

// Calendario comercial (etapa 6, como Animal Crossing; paso 1): avisos según la fecha real. Cierre de mes (cuenta regresiva
// los últimos 7 días), Buen Fin (viernes a lunes del fin de semana largo de la Revolución = 3.er lunes de noviembre; aviso
// desde 14 días antes), regreso a clases (15 jul – 31 ago) y Navidad (1–25 dic). `dias` = cuántos faltan (0 = ya es hoy/en curso).
export function eventosCalendario(hoy = new Date()) {
  hoy = fechaHoy(hoy);
  const d0 = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()), y = d0.getFullYear(), mo = d0.getMonth();
  const entre = (a, b) => Math.round((b - a) / 86400000), out = [];
  const ultimo = new Date(y, mo + 1, 0), faltan = entre(d0, ultimo);
  const per = mo === 11 ? 'año' : 'mes'; // 4.12.28: la última semana de diciembre es el cierre del año (antes «Cierre de mes»)
  if (faltan <= 6) out.push({ id: 'cierre', icono: '⏳', dias: faltan, desde: isoLocal(new Date(y, mo, ultimo.getDate() - 6)), hasta: isoLocal(ultimo), nivel: faltan <= 2 ? 'ambar' : null, texto: faltan === 0 ? `Hoy cierra el ${per}` : faltan === 1 ? `Mañana cierra el ${per}` : `Cierre de ${per} en ${faltan} días` });
  const nov1 = new Date(y, 10, 1), lunes3 = new Date(y, 10, 1 + ((8 - nov1.getDay()) % 7) + 14), bfIni = new Date(y, 10, lunes3.getDate() - 3);
  const aBf = entre(d0, bfIni), finBf = entre(d0, lunes3);
  if (aBf <= 14 && finBf >= 0) out.push({ id: 'buenfin', icono: '🏷️', dias: Math.max(0, aBf), desde: isoLocal(bfIni), hasta: isoLocal(lunes3), nivel: aBf <= 0 ? 'ambar' : null, texto: aBf <= 0 ? (finBf === 0 ? 'Buen Fin · hoy es el último día' : `Buen Fin · hasta el lunes ${lunes3.getDate()}`) : aBf === 1 ? `Buen Fin empieza mañana (${bfIni.getDate()}–${lunes3.getDate()} nov)` : `Buen Fin en ${aBf} días (${bfIni.getDate()}–${lunes3.getDate()} nov)` });
  if ((mo === 6 && d0.getDate() >= 15) || mo === 7) out.push({ id: 'clases', icono: '🎒', dias: 0, nivel: null, texto: 'Temporada de regreso a clases' });
  if (mo === 11 && d0.getDate() <= 25) { const n = 25 - d0.getDate(); out.push({ id: 'navidad', icono: '🎄', dias: n, nivel: null, texto: n === 0 ? '¡Feliz Navidad!' : n === 1 ? 'Temporada navideña · falta 1 día' : `Temporada navideña · faltan ${n} días` }); }
  return out.sort((a, b) => a.dias - b.dias);
}
// Paso 3 (3.90.67): camiones de facturas que salieron durante la temporada en curso (Buen Fin ya empezado, o la semana del
// cierre de mes) → Map folio → { id, texto } para pintarlos de promoción. Sólo facturas reales de `m.camiones`, sin inventar volumen.
export function camionesTemporada(m, hoy = new Date()) {
  hoy = fechaHoy(hoy);
  const out = new Map(); const evs = eventosCalendario(hoy).filter((e) => e.desde && (e.id === 'cierre' || e.dias === 0));
  for (const c of comoLista(m?.camiones)) {
    // 4.7.65: sin folio legible se salta (antes la clave null pintaba de promoción a TODOS los camiones sin folio).
    if (c?.envio || !unirTexto(c?.folio)) continue; const f = fechaIso(c?.fecha); if (!f) continue;
    const e = evs.find((x) => f >= x.desde && f <= x.hasta); if (e) out.set(c.folio, { id: e.id, texto: e.id === 'buenfin' ? 'Buen Fin' : f.slice(5, 7) === '12' ? 'Cierre de año' : 'Cierre de mes' });
  }
  return out;
}

/**
 * @param d  { perfiles, inventario, contenedores, sucursales, vendedoresMayoristas, vendedoresErp, cuentas, facturas, agendaHoy, reunionesHoy, cuentaMes }
 * @returns  modelo para la escena
 */
// Rebote al tocar (3.90.73, Etapa 7): escala (y, xz) a los `t` segundos; aplasta, estira y se asienta en `dur`. `fin` = ya terminó.
export function rebote(t, dur = .5) {
  if (!(dur > 0) || !Number.isFinite(dur)) dur = .5;
  // 4.7.60: t NaN (un dt inválido) termina el rebote; antes fin quedaba false para siempre y el rebote nunca se soltaba.
  if (!(t >= 0) || t >= dur) return { y: 1, xz: 1, fin: !(t < dur) };
  const p = t / dur; const y = 1 - .16 * Math.sin(p * Math.PI * 3) * (1 - p);
  return { y, xz: 1 - (y - 1) * .5, fin: false };
}

// Paseantes de una manzana (3.90.78): 1 por cada 3 tiendas, máx. 4; en la versión ligera (táctil, `pointer: coarse`) máx. 1.
export const paseantesDistrito = (n, ligera = false) => (n >= 3 ? Math.min(ligera ? 1 : 4, Math.ceil(n / 3)) : 0);

// Gesto de dos dedos (3.90.77, Etapa 8): de la pareja inicial `a` a la actual `b` ([{x,y},{x,y}] en px) → `escala` para el
// zoom (separar los dedos = acercar, < 1) y `giro` en radianes (-π..π) para girar la cámara.
export function gestoDosDedos(a, b) {
  // pareja incompleta o con coordenadas que no son número (4.3.14): sin cambio, para que el zoom/giro no quede NaN (pantalla negra)
  const ok = (p) => Array.isArray(p) && p.length >= 2 && [p[0], p[1]].every((q) => q && Number.isFinite(q.x) && Number.isFinite(q.y));
  if (!ok(a) || !ok(b)) return { escala: 1, giro: 0 };
  const dist = (p) => Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
  // 4.12.58: dedos encimados (< 1 px, al empezar o al juntarlos) no tienen distancia ni ángulo: sin cambio. Antes el `|| 1`
  // daba escala 0.1 o 100 y la cámara brincaba al zoom mínimo/máximo, y el giro salía de un ángulo al azar.
  if (!(dist(a) >= 1) || !(dist(b) >= 1)) return { escala: 1, giro: 0 };
  const ang = (p) => Math.atan2(p[1].y - p[0].y, p[1].x - p[0].x);
  let giro = ang(b) - ang(a); while (giro > Math.PI) giro -= 2 * Math.PI; while (giro < -Math.PI) giro += 2 * Math.PI;
  return { escala: dist(a) / dist(b), giro };
}

// Sonido ambiente (3.90.76, Etapa 7): qué capas suenan y a qué volumen según día/noche y lluvia. `ruido` = rumor de la ciudad
// (ruido café filtrado), `lluvia` = ruido más brillante, `pajaros` de día y `grillos` de noche (cada cuántos segundos, aprox.).
export function capasSonido(op) {
  const esDia = op?.esDia ?? true, lluvia = !!op?.lluvia;
  return {
    ruido: esDia ? .05 : .025,
    lluvia: lluvia ? .06 : 0,
    pajaros: esDia && !lluvia ? 4 : 0,
    grillos: !esDia && !lluvia ? 1.2 : 0,
  };
}

// Recorrido de bienvenida (3.90.75, Etapa 7): 3 pasos la primera vez; el botón «?» lo repite. Se guarda como visto con
// RECORRIDO_CLAVE = '1' en localStorage (si no hay almacenamiento, se muestra una vez por sesión).
export const RECORRIDO_CLAVE = 'acteck-ciudad-recorrido';
export const RECORRIDO = [
  { icono: '🖐️', titulo: 'Así te mueves', texto: 'Arrastra para moverte, usa la rueda (o pellizca) para acercarte y clic derecho o Shift + arrastrar para girar. Las flechas también sirven.' },
  { icono: '👆', titulo: 'Así se toca un edificio', texto: 'Toca un edificio, una tienda o una persona: rebota y se abre su tarjeta con sus números y el botón para ir a su pestaña.' },
  { icono: '✈️', titulo: 'Así se viaja', texto: 'Aléjate hasta el mapa de México y toca una ciudad para volar a ella. El buscador y el botón de arriba te regresan a la base.' },
];
export const recorridoVisto = (v) => v === '1';

// Saludo al pasar el cursor (3.90.74): dos saltitos en `dur` segundos; regresa la altura extra (0 fuera de rango).
export function saltito(t, dur = .7, alto = .45) {
  if (!(dur > 0) || !Number.isFinite(dur)) dur = .7;
  if (!Number.isFinite(alto)) alto = .45;
  if (!(t >= 0) || t >= dur) return 0;
  return alto * Math.abs(Math.sin(t / dur * Math.PI * 2));
}

// Forma de árbol (3.90.71, kit low-poly): estable por posición (misma ciudad = mismos árboles en cada recarga).
// ~45 % pino, 30 % redondo, 15 % palma, 10 % arbusto; `tono` 0/1 para alternar el verde.
export function formaArbol(x = 0, z = 0) {
  x = Number(x); z = Number(z); if (!Number.isFinite(x)) x = 0; if (!Number.isFinite(z)) z = 0; // sin tono NaN (color indefinido)
  const r = Math.abs(Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
  const forma = r < .45 ? 'pino' : r < .75 ? 'redondo' : r < .9 ? 'palma' : 'arbusto';
  return { forma, tono: Math.floor(r * 100) % 2 };
}

// Ventanas de la oficina (3.90.70, kit low-poly): cuántas se prenden según quién está (todos menos los de viaje), repartidas
// parejo entre las `total` ventanas. Sin personas: el patrón de siempre (2 de cada 3).
export function ventanasOficina(personas = [], total = 12) {
  total = Number.isFinite(Number(total)) && Number(total) >= 0 ? Math.round(Number(total)) : 12;
  personas = (Array.isArray(personas) ? personas : []).filter(Boolean);
  if (!personas.length) return Array.from({ length: total }, (_, k) => k % 3 !== 0);
  const n = Math.round(total * personas.filter((p) => p.presencia?.estado !== 'viaje').length / personas.length);
  return Array.from({ length: total }, (_, k) => Math.floor((k + 1) * n / total) > Math.floor(k * n / total));
}

// Datos limpios (4.3.4): cada lista de `d` sin renglones nulos y sin listas que no sean arreglo (una vista que trae un null
// o un campo que no es lista ya no tumba toda la Ciudad). Los demás campos pasan igual.
export function sinNulos(d) {
  const o = {};
  for (const [k, v] of Object.entries(d && typeof d === 'object' ? d : {})) o[k] = Array.isArray(v) ? v.filter((x) => x != null) : v;
  return o;
}

// 4.7.79: listas de datos que construirModelo recorre; si una llega como objeto/texto/número (no lista) se toma vacía
// (antes `.map`/`.filter`/`for…of` lanzaban error y tumbaban toda la Ciudad). reglasPagos (objeto) y marcasSku (Map) no van aquí.
export const LISTAS_DATOS = ['cuentas', 'perfiles', 'agendaHoy', 'reunionesHoy', 'viajesHoy', 'inventario', 'inventarioSku', 'demandaSku', 'facturas', 'contenedores', 'sucursales', 'cuentaMes', 'clientesFinales', 'vendedoresMayoristas', 'vendedoresErp', 'cartera', 'pagos', 'forecast', 'avisosForecast', 'alertasOc', 'envios'];
export function listasDatos(d) {
  const o = sinNulos(d);
  for (const k of LISTAS_DATOS) if (o[k] != null && !Array.isArray(o[k])) o[k] = [];
  return o;
}
export function construirModelo(d, hoy = new Date()) {
  d = listasDatos(d);
  hoy = fechaHoy(hoy);
  const hoyIso = isoLocal(hoy); // 4.7.32: día local (antes UTC: de 18:00 a 23:59 en Guadalajara «hoy» ya era mañana)
  const anio = hoy.getFullYear(), mes = hoy.getMonth() + 1;
  const mesPrev = mes === 1 ? 12 : mes - 1, anioPrev = mes === 1 ? anio - 1 : anio;
  const cuentas = new Map((d.cuentas || []).map((c) => [unirTexto(c.cuenta), c])); // 4.12.4: NaN, objeto o lista no son cuenta (antes «NaN» / «[object Object]») // 4.7.50: « pcel » = «pcel»
  // 4.12.43: nombre de la cuenta sin espacios ni mayúsculas (sell out «PCEL» con catálogo «pcel» ya no sale con la clave cruda)
  const cuentasMin = new Map(); for (const [k, c] of cuentas) { const km = k.toLowerCase(); if (km && !cuentasMin.has(km)) cuentasMin.set(km, c); }
  const cuentaDe = (k) => { const t = unirTexto(k); return cuentas.get(t) || cuentasMin.get(t.toLowerCase()); };

  // ── Oficina: equipo del dashboard + genéricos ──
  const items = d.agendaHoy || [];
  const personas = (d.perfiles || []).filter((p) => p.activo && !esClase(p.tipo, 'externo') && !/prueba/i.test(p.nombre || '')).map((p) => {
    const mios = items.filter((it) => it.propietario === p.user_id || (Array.isArray(it.responsables) && it.responsables.includes(p.user_id)));
    const abiertas = mios.filter((it) => esClase(it.estado, 'abierta', 'arrastrada'));
    const enCurso = abiertas.find((it) => it.inicio_real);
    const quien = unirTexto(p.nombre, p.puesto); // 4.7.38: sin «null» en la búsqueda del rol
    return { id: p.user_id, nombre: nombrePersona(p), puesto: unirTexto(p.puesto) || unirTexto(p.rol), rol: /millan|finanz/i.test(quien) ? 'finanzas' : /karolina|comercial/i.test(quien) ? 'comercial' : 'direccion',
      pendientes: abiertas.length, hechas: mios.filter((it) => esClase(it.estado, 'hecha')).length, actividad: (enCurso ? unirTexto(enCurso.titulo) : unirTexto(abiertas[0]?.titulo)) || null, avatar: p.avatar_url || null };
  });
  const reuniones = (d.reunionesHoy || []).filter((r) => !esClase(r.tipo, 'viaje'));
  // 4.7.66: el conteo y la reunión en curso salen de la agenda limpia (antes una reunión con fecha ilegible o repetida sumaba
  // en «Reuniones hoy» sin aparecer en la sala, y la reunión en curso llevaba el título crudo, «null» incluido).
  const agenda = reunionesDelDia(reuniones, hoy), reunionEnCurso = agenda.find((r) => r.estado === 'en curso') || null; // 4.3.32: fecha nula no está en curso
  presenciaPersonas(personas, d.reunionesHoy, d.viajesHoy, hoy); // 3.90.40: en reunión / de viaje / disponible (como Gather)
  const oficina = { personas, genericos: 3, reuniones: agenda.length, reunionEnCurso: reunionEnCurso ? { titulo: reunionEnCurso.titulo, cliente_key: reunionEnCurso.cliente_key } : null, agenda };

  // ── CEDIS ──
  const inv = (d.inventario || [])[0] || {};
  const hoyLocal = `${anio}-${String(mes).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`; // salidas de HOY en Guadalajara (hoyIso es UTC: de noche ya es mañana)
  const cedis = { valor: N(inv.inv_actual), piezas: N(inv.inv_actual_piezas), dias: diasCedis(inv.dias_inv), skus: N(inv.skus_con_stock), racks: Math.max(3, Math.min(10, Math.round(N(inv.dias_inv) / 18))), actualizado: inv.actualizado || null, racksMarca: racksPorMarca(d.inventarioSku, d.marcasSku, 8, d.demandaSku ? demanda3Meses(d.demandaSku, hoy) : null), salidasHoy: comoLista(d.facturas).filter((f) => fechaIso(f?.fecha) === hoyLocal).length }; // (4.7.20) fecha con espacios o Date cuenta

  // ── Puerto: contenedores en camino o llegando ──
  const barcos = []; const tarimas = [];
  for (const c of d.contenedores || []) {
    if (/CONCLUIDO|CANCELADO/i.test(c.estatus || '')) continue;
    const arribo = fechaIso(c.arribo_cedis); const eta = fechaIso(c.eta_puerto); // fecha mala = sin fecha (antes progreso/llegada NaN)
    if (arribo && dias(hoyIso, arribo) < -3) continue; // llegó hace días: ya no se dibuja
    const inicio = fechaIso(c.etd) || fechaIso(c.fin_produccion) || fechaIso(c.fecha_emision);
    const fin = arribo || eta || null;
    let p = 0.5;
    if (inicio && fin) { const tot = Math.max(1, dias(inicio, fin)); p = Math.max(0.02, Math.min(0.98, dias(inicio, hoyIso) / tot)); }
    const llegaEnDias = fin ? dias(hoyIso, fin) : null;
    const reg = { id: unirTexto(c.contenedor) || null /* 4.12.8: « MSKU1 » = «MSKU1»; NaN/objeto ya no da «Contenedor NaN» */, supplier: c.supplier, naviera: c.naviera || '', piezas: N(c.piezas), pos: N(c.pos), fob: N(c.fob_usd), eta: eta, arribo, llegaEnDias, progreso: p, estatus: c.estatus || '' };
    if (arribo && dias(hoyIso, arribo) <= 0) tarimas.push(reg); else barcos.push(reg);
  }
  barcos.sort((a, b) => b.progreso - a.progreso);
  const puerto = { barcos: barcos.slice(0, 12), tarimas: tarimas.slice(0, 8), totalPiezas: barcos.reduce((s, b) => s + b.piezas, 0), totalFob: barcos.reduce((s, b) => s + b.fob, 0) };

  // ── Distritos (ciudades) con tiendas por cuenta ──
  const porCiudad = new Map();
  const tienda = (ciudad, t) => { if (!porCiudad.has(ciudad)) porCiudad.set(ciudad, { ciudad, pos: posDe(CIUDADES[ciudad]), estado: CIUDADES[ciudad].estado, tiendas: [], vendedores: [] }); porCiudad.get(ciudad).tiendas.push(t); };
  const sucAgr = new Map(); // cuenta|sucursal → { actual, previo, estado }
  // 4.7.47: la sucursal se junta por cuenta sin espacios y `norm()` del nombre (« hermosillo » = «HERMOSILLO»; antes salían dos tiendas encimadas con la venta partida).
  for (const r of d.sucursales || []) {
    const cu = typeof r.cuenta === 'string' ? r.cuenta.trim() : r.cuenta; const su = typeof r.sucursal === 'string' ? r.sucursal.trim().replace(/\s+/g, ' ') : r.sucursal;
    const k = `${cu}|${norm(su).replace(/\s+/g, ' ')}`; const o = sucAgr.get(k) || { cuenta: cu, sucursal: su, actual: 0, previo: 0, estado: r.estado || null, vendedores: 0 };
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
    const sede = sedeDeCuenta(s.cuenta);
    const nombreCuenta = unirTexto(cuentaDe(s.cuenta)?.nombre) || s.cuenta; // 4.12.11: nombre en objeto ya no sale «[object Object]»
    // Luz encendida = vendió este mes; los primeros 10 días del mes también cuenta el mes anterior (si no, la ciudad amanece apagada el día 1).
    const activa = s.actual > 0 || (hoy.getDate() <= 10 && s.previo > 0);
    const t = { cuenta: s.cuenta, nombreCuenta, sucursal: s.sucursal, importe: s.actual, previo: s.previo, vendio: activa, vendioMes: s.actual > 0, virtual: !!c?.virtual, vendedores: s.vendedores };
    cuentasConSucursal.add(unirTexto(s.cuenta).toLowerCase()); // 4.12.43: «PCEL» con sucursales = «pcel» del catálogo (sin Matriz duplicada)
    if (c?.virtual) { virtuales.push(t); tienda(sede, { ...t, sucursal: unirTexto(s.sucursal) ? `${unirTexto(s.sucursal)} (en línea)` : 'En línea' }); continue; }
    tienda(c?.ciudad || sede, t);
  }
  // cuentas sin sucursal: una tienda en su sede
  // 4.7.50: la cuenta y sus ventas mensuales se empatan sin espacios (« pcel » = «pcel»; antes la Matriz salía apagada con venta 0, o doble si ya tenía sucursales) y la cuenta vacía se salta.
  for (const c0 of d.cuentas || []) {
    const cc = unirTexto(c0.cuenta); if (!cc) continue; const c = { ...c0, cuenta: cc };
    if (cuentasConSucursal.has(c.cuenta.toLowerCase()) || !c.tiene_sellout && !c.propio) continue;
    const m = (d.cuentaMes || []).filter((r) => unirTexto(r.cuenta).toLowerCase() === c.cuenta.toLowerCase()); // 4.12.43
    const act = m.filter((r) => N(r.anio) === anio && N(r.mes) === mes).reduce((s, r) => s + N(r.importe), 0);
    const prev = m.filter((r) => N(r.anio) === anioPrev && N(r.mes) === mesPrev).reduce((s, r) => s + N(r.importe), 0);
    tienda(sedeDeCuenta(c.cuenta), { cuenta: c.cuenta, nombreCuenta: unirTexto(c.nombre) || c.cuenta, sucursal: 'Matriz', importe: act, previo: prev, vendio: act > 0 || (hoy.getDate() <= 10 && prev > 0), vendioMes: act > 0, virtual: false, vendedores: 0 });
    const sede = sedeDeCuenta(c.cuenta); // 3.90.56: y una tienda por estado donde vende a clientes finales
    for (const r of repartoPorEstado(c.cuenta, d.clientesFinales, { anio, mes, anioPrev, mesPrev, sede })) tienda(r.ciudad, { cuenta: c.cuenta, nombreCuenta: unirTexto(c.nombre) || c.cuenta, sucursal: `Clientes en ${r.ciudad.toLowerCase().replace(/(^|\s)\S/g, (x) => x.toUpperCase())}`, importe: r.importe, previo: r.previo, vendio: r.importe > 0 || (hoy.getDate() <= 10 && r.previo > 0), vendioMes: r.importe > 0, virtual: false, reparto: true, vendedores: 0 });
  }
  // vendedores de los mayoristas → en la ciudad de su sucursal (o la sede de la cuenta)
  const vm = new Map();
  // 4.7.48: el vendedor del mayorista se junta por cuenta sin espacios y `norm()` del nombre (« JUAN  PEREZ » = «Juan Perez»; antes salían dos vendedores con la venta partida) y sin nombre se salta.
  for (const r of d.vendedoresMayoristas || []) { if (N(r.anio) !== anio) continue; const cu = typeof r.cuenta === 'string' ? r.cuenta.trim() : r.cuenta; const kv = norm(r.vendedor).replace(/\s+/g, ' '); if (!kv) continue; const k = `${cu}|${kv}`; const o = vm.get(k) || { cuenta: cu, nombre: unirTexto(r.vendedor).replace(/\s+/g, ' '), importe: 0, sucursal: r.sucursal || null, ultimoMes: 0 }; o.importe += N(r.importe); if (N(r.mes) >= o.ultimoMes && N(r.importe) > 0) { o.ultimoMes = N(r.mes); o.sucursal = r.sucursal || o.sucursal; } vm.set(k, o); }
  for (const v of vm.values()) {
    if (!v.nombre || /^(SIN|N\/?A|-)/i.test(v.nombre)) continue;
    const c = v.sucursal ? ciudadDeSucursal(v.sucursal) : null;
    const ciudad = (c && c.ciudad) || sedeDeCuenta(v.cuenta);
    if (!porCiudad.has(ciudad)) tienda(ciudad, { cuenta: v.cuenta, nombreCuenta: unirTexto(cuentaDe(v.cuenta)?.nombre) || v.cuenta, sucursal: 'Matriz', importe: 0, previo: 0, vendio: false, virtual: false, vendedores: 0 });
    porCiudad.get(ciudad).vendedores.push({ nombre: nombreCorto(v.nombre), nombreCompleto: v.nombre, cuenta: v.cuenta, nombreCuenta: unirTexto(cuentaDe(v.cuenta)?.nombre) || v.cuenta, importe: v.importe, activo: v.ultimoMes >= mesPrev });
  }
  // Cartera (propios): saldo vencido → bandera roja en su Matriz / primera tienda de la sede.
  const carteraPor = carteraPorCuenta(d.cartera); // 4.7.49: « digitalife » = «digitalife»; 4.7.52: con dos cortes gana el más reciente
  for (const [cuenta, c] of carteraPor) {
    const sede = sedeDeCuenta(cuenta);
    if (!porCiudad.has(sede)) continue;
    const t = porCiudad.get(sede).tiendas.find((x) => unirTexto(x.cuenta).toLowerCase() === cuenta); if (t) t.cartera = c;
  }
  // Clientes finales por estado → ciudad representativa (casitas junto a la manzana).
  const cfPor = new Map();
  for (const r of d.clientesFinales || []) { const est = norm(r.estado); if (!est || est === 'SIN ESTADO') continue; const ciudad = CIUDAD_POR_ESTADO[est]; if (!ciudad) continue; const o = cfPor.get(ciudad) || { n: 0, importe: 0, cuentas: new Set() }; o.n += 1; o.importe += N(r.importe); const cu = unirTexto(r.cuenta); if (cu) o.cuentas.add(cu); cfPor.set(ciudad, o); }
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
  // 4.7.51: la clave ERP se limpia (« 1234 » = «1234») en facturas, envíos y destinos de vendedores; la cuenta sale con la clave limpia del mapa.
  const claveErp = (x) => unirTexto(x); // 4.12.4: NaN, objeto o lista → sin clave (antes cliente «NaN» / «[object Object]» en el camión y la bitácora)
  const cuentaPorErp = new Map([...cuentas.entries()].filter(([k, c]) => k && claveErp(c?.erp_cliente)).map(([k, c]) => [claveErp(c.erp_cliente), k]));
  const camiones = (d.facturas || []).filter((f) => dias(f.fecha, hoyIso) <= 10).map((f) => {
    const ck = claveErp(f.cliente_key), kc = cuentaPorErp.get(ck), cuenta = kc ? cuentas.get(kc) : null;
    const key = kc || ck;
    const ciudad = sedeDeCuenta(key, 'CIUDAD DE MEXICO');
    const edad = dias(f.fecha, hoyIso);
    return { folio: f.folio, cliente: unirTexto(cuenta?.nombre) || ck || null, ciudad, monto: N(f.monto), piezas: N(f.piezas), fecha: f.fecha, progreso: Math.min(0.95, 0.1 + Math.max(0, edad) * 0.12) };
  }).sort((a, b) => b.monto - a.monto).slice(0, 14);
  for (const e of d.envios || []) {
    // 4.7.64: la salida es la primera fecha legible (envío ERP ilegible cae a la surtida) y una entrega en blanco (« ») no cuenta como entregado.
    const salida = fechaIso(e.fecha_envio_erp) || fechaIso(e.fecha_surtida); const entrega = [e.fecha_entrega_erp, e.fecha_entregada].some((x) => x instanceof Date || (x != null && String(x).trim() !== ''));
    if (!salida || entrega) continue;
    const key = claveErp(e.oc_clientes?.cliente_key) || 'digitalife';
    const edad = dias(salida, hoyIso); if (!Number.isFinite(edad) || edad > 20) continue; // salida ilegible: sin camión (antes progreso NaN)
    camiones.push({ folio: unirTexto(e.guia_rastreo) ? `guía ${unirTexto(e.guia_rastreo)}` : unirTexto(e.oc_clientes?.numero_oc) ? `envío OC ${unirTexto(e.oc_clientes.numero_oc)}` : 'envío OC', cliente: unirTexto(cuentas.get(key)?.nombre) || key, ciudad: SEDE_POR_CUENTA[key] || 'CIUDAD DE MEXICO', monto: 0, piezas: 0, fecha: salida, progreso: Math.min(0.9, 0.15 + Math.max(0, edad) * 0.15), envio: true, paqueteria: e.paqueteria || null });
  }

  // ── Vendedores del ERP (equipo comercial): de la oficina a sus clientes ──
  // 4.7.44: el vendedor se junta por `norm()` (« JUAN  PEREZ » = «Juan Perez», espacios dobles incluidos; antes salían dos coches con la misma tarjeta) y sin nombre se salta.
  const ve = new Map();
  for (const r of d.vendedoresErp || []) { if (N(r.anio) !== anio) continue; const kv = norm(r.vendedor).replace(/\s+/g, ' '); if (!kv) continue; const o = ve.get(kv) || { nombre: unirTexto(r.vendedor), clientes: new Map(), total: 0, totalMes: 0 }; ve.set(kv, o); o.total += N(r.fact_neta); if (N(r.mes) === mes) o.totalMes += N(r.fact_neta); const ck = claveErp(r.cliente_key); const c = o.clientes.get(ck) || { cliente_key: ck, nombre: r.cliente_nombre, fact: 0 }; c.fact += N(r.fact_neta); o.clientes.set(ck, c); }
  const vendedoresRuta = [...ve.values()].filter((v) => v.nombre && v.total > 0).sort((a, b) => b.total - a.total).slice(0, 10).map((v, i) => {
    const top = [...v.clientes.values()].sort((a, b) => b.fact - a.fact).slice(0, 3);
    // 4.12.40: el destino usa el nombre de la cuenta del dashboard cuando la cuenta se identificó («va a CT Internacional», como el
    // camión); antes salía el nombre crudo del ERP («va a CT INTERNACIONAL DEL NOROESTE SA DE CV»). Sin cuenta, el del ERP limpio.
    const destinos = top.map((c) => { const ke = cuentaPorErp.get(claveErp(c.cliente_key)) || [...cuentas.entries()].find(([, x]) => norm(x?.nombre) === norm(c.nombre))?.[0]; const key = ke || null; return { cliente: unirTexto(cuentas.get(key)?.nombre) || unirTexto(c.nombre) || unirTexto(c.cliente_key) || null, ciudad: (key && SEDE_POR_CUENTA[key]) || 'CIUDAD DE MEXICO', fact: c.fact }; });
    return { nombre: nombreCorto(v.nombre), nombreCompleto: v.nombre, total: v.total, totalMes: v.totalMes, clientes: v.clientes.size, destinos, fase: i / 10 };
  });

  const clientesFinales = distritos.reduce((s, x) => s + (x.clientesFinales?.n || 0), 0);
  const kpis = { clientesFinales, cartera: [...carteraPor.entries()].map(([k, c]) => ({ cuenta: k, ...c })), tiendas: distritos.reduce((s, x) => s + x.tiendas.filter((t) => !t.reparto).length, 0), tiendasVendieron: distritos.reduce((s, x) => s + x.tiendas.filter((t) => t.vendio && !t.reparto).length, 0), ciudades: distritos.length, barcos: puerto.barcos.length, camiones: camiones.length, vendedores: vendedoresRuta.length, enLinea: virtuales.length };
  const banco = resumenBanco(kpis.cartera, d.pagos, hoyIso, d.reglasPagos); const torre = resumenTorre(d.forecast, d.avisosForecast, hoyIso);
  return { hoyIso, anio, mes, oficina, cedis, puerto, ocDetenidas: (d.alertasOc || []).length, banco, torre, distritos, camiones, vendedoresRuta, kpis, origen: posDe(ORIGEN), puertoPos: posDe(CIUDADES.MANZANILLO) };
}
