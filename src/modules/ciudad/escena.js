// Acteck Ciudad · escena 3D (three.js, low-poly cálido). Sólo se importa desde Ciudad.jsx dentro de un import()
// dinámico: el chunk `vendor-three`, este archivo y escena/* no viajan con ninguna otra pestaña.
//   crearEscena(canvas, modelo, { onHover(obj|null, {x,y}), onClick(obj|null), onNivel('base'|'ciudad'|'lejos'), onVista({ cx, cz, zoom }), onSeleccion({x,y}|null) = dónde está en pantalla lo tocado, oscuro }) → { destruir(), resize(), irA(tag), entrarCedis(on), entrar('cedis'|'oficina'|false), hayRacks, hayOficina, stats() }; onAdentro(bool) avisa si se está dentro del CEDIS
//   Arranca en la Vista Base (oficina + CEDIS + puerto de cerca); irA({ tipo: 'base' }) regresa a ella e irA({ tipo: 'mapa' }) encuadra México completo.
//   irA({ tipo: 'punto', x, z }) mueve la cámara a ese punto sin cambiar el zoom (minimapa); onVista avisa el centro y zoom
//   de la cámara (como mucho ~4 veces por segundo y sólo si cambió) para el marcador del minimapa.
//   vistaInicial { cx, cz, zoom } (la última vista guardada) arranca ahí en lugar de la Vista Base.
//   Viajar: tocar una ciudad (pin o manzanas) desde lejos acerca la cámara a su Vista Ciudad; irA({ ciudad }) también la usa.
// Este archivo sólo orquesta: arma el contexto compartido (ctx) y llama a los módulos de escena/ en orden
// (camara, luz-clima, terreno, edificios, vehiculos, gente, etiquetas, interaccion, detalle). El estilo vive en luz-clima.js.
import * as THREE from 'three';
import { crearCamara } from './escena/camara.js';
import { PAL, luces, fondo, cielo } from './escena/luz-clima.js';
import { terreno, carretera, plantarArboles, plantarCarreteras } from './escena/terreno.js';
import { plantarInstancias, actualizarInstancias } from './escena/instancias.js';
import { oficina, cedis, puerto, distritos, campusCalles, banco, torre, burbujas, pensar } from './escena/edificios.js';
import { barcos, camiones, vendedoresRuta } from './escena/vehiculos.js';
import { etiqueta, escalarEtiquetas } from './escena/etiquetas.js';
import { crearInteraccion } from './escena/interaccion.js';
import { prepararDetalle, aplicarDetalle } from './escena/detalle.js';
import { encuadre, campus, vistaMapa, vistaCiudad, nivelVista, DETALLE, capaCiudades, CAPA_TONOS } from './modelo.js';

export function crearEscena(canvas, modelo, { onHover, onClick, onError, onNivel, onVista, onSeleccion, onAdentro, onSiguiendo, vistaInicial, oscuro = false, clima = null } = {}) {
  // clima = { esDia, nubes (0-1), lluvia (bool), temp } de Open-Meteo para Guadalajara; si no llega, manda el tema.
  const noche = clima ? !clima.esDia : oscuro;
  const P = noche ? PAL.noche : PAL.dia;
  const nubosidad = clima ? clima.nubes : .3;
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const camara = crearCamara(canvas, R); const { cam, vista, resize } = camara;

  // Contexto compartido por los módulos: materiales cacheados, helpers y listas que recorre cada cuadro.
  const mats = new Map();
  const M = (color, extra = {}) => { const k = `${color}|${JSON.stringify(extra)}`; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, flatShading: true, ...extra })); return mats.get(k); };
  const interact = []; // mallas tocables (userData.tag)
  const animados = []; // f(tiempo) por cuadro
  const sprites = []; // etiquetas
  const raiz = new THREE.Group();
  const add = (m, tag) => { raiz.add(m); if (tag) { m.traverse((o) => { if (o.isMesh) { o.userData.tag = tag; interact.push(o); } }); } return m; };
  const geos = new Map(); // cajas compartidas por medidas (antes cada caja creaba su BoxGeometry)
  const G = (w, h, d) => { const k = `${w}|${h}|${d}`; if (!geos.has(k)) geos.set(k, new THREE.BoxGeometry(w, h, d)); return geos.get(k); };
  const box = (w, h, d, color, extra) => { const m = new THREE.Mesh(G(w, h, d), M(color, extra)); m.castShadow = true; m.receiveShadow = true; m.position.y = h / 2; return m; };
  const ctx = { scene, raiz, P, oscuro: noche, noche, nubosidad, clima, modelo, esc: { x: modelo.origen.x, z: modelo.origen.z }, M, G, box, add, interact, animados, sprites, arboles: [], instancias: [] };
  ctx.campus = campus(ctx.esc); // trazo de la base: oficina, CEDIS, patio, calles y distrito GDL

  luces(ctx);
  scene.add(raiz);
  fondo(ctx);
  terreno(ctx);
  cielo(ctx);
  // Acteck en Guadalajara (oficina + CEDIS) y el puerto de Manzanillo con sus barcos.
  const ofiPos = oficina(ctx);
  const cedisPos = cedis(ctx);
  campusCalles(ctx, cedisPos); // calles, banquetas y patio de maniobras con andenes
  let bancoPos = null; try { bancoPos = banco(ctx); } catch (e) { console.warn('[ciudad] banco', e); } // capa nueva: si falla, la ciudad sigue
  let torrePos = null; try { torrePos = torre(ctx); } catch (e) { console.warn('[ciudad] torre', e); }
  const puertoPos = puerto(ctx);
  barcos(ctx, puertoPos);
  try { burbujas(ctx, { oficina: ofiPos, banco: bancoPos, puerto: puertoPos, cedis: cedisPos }); } catch (e) { console.warn('[ciudad] burbujas', e); } // 3.90.44: capa nueva, falla sola
  carretera(ctx, { x: puertoPos.x, z: puertoPos.z }, { x: cedisPos.x, z: cedisPos.z + 8 }, 1.8);
  const { distritoPos, rutas } = distritos(ctx, cedisPos);
  try { pensar(ctx); } catch (e) { console.warn('[ciudad] pensamientos', e); } // 3.90.52: capa nueva, falla sola
  plantarArboles(ctx); // después de todos los arbol(): oficina, CEDIS y distritos
  plantarCarreteras(ctx); // después de todas las carretera(): una sola malla
  const etA = etiqueta(ctx, 'acteck. · Guadalajara', '#0A84FF'); etA.position.set(ctx.esc.x + 1, 17, ctx.esc.z - 4); etA.userData.prioridad = 4; raiz.add(etA);
  const etP = etiqueta(ctx, 'Manzanillo', '#1D1D1F'); etP.position.set(puertoPos.x, 10, puertoPos.z + 2); etP.userData.prioridad = 3; raiz.add(etP);
  camiones(ctx, rutas);
  vendedoresRuta(ctx, rutas);
  plantarInstancias(ctx); // tiendas, casitas, gente y vehículos: un InstancedMesh por pieza, tocables por instanceId

  const detalle = prepararDetalle(raiz); // gente y piezas finas que se ocultan de lejos

  // Viajar: desde lejos (mapa), tocar una ciudad acerca la cámara a ella; de cerca el clic sólo abre su panel.
  const inter = crearInteraccion(canvas, camara, { onClick: (tag) => { if (tag?.tipo === 'ciudad' && tag.ciudad && vista.zoom > DETALLE.mapa) irA(tag); onClick?.(tag); } });

  // Vista Base (inicial): oficina, CEDIS, banco, torre y puerto encuadrados de cerca según el tamaño del lienzo y el giro actual.
  const puntosBase = [{ ...ofiPos, r: 8 }, { ...cedisPos, r: 8 }, { ...puertoPos, r: 9 }, ...(bancoPos ? [{ ...bancoPos, r: 5 }] : []), ...(torrePos ? [{ ...torrePos, r: 4 }] : [])];
  const vistaBase = () => encuadre(puntosBase, { ang: vista.ang, aspecto: (canvas.clientWidth || 800) / (canvas.clientHeight || 600) });
  const b0 = vistaInicial && Number.isFinite(vistaInicial.cx) && Number.isFinite(vistaInicial.cz) && Number.isFinite(vistaInicial.zoom) ? vistaInicial : vistaBase(); if (b0) { vista.cx = vista.cxObj = b0.cx; vista.cz = vista.czObj = b0.cz; vista.zoom = vista.zoomObj = b0.zoom; resize(); camara.colocarCam(); }

  // Interior del CEDIS (3.90.31): «Entrar» oculta el cascarón, muestra los racks por marca y acerca la cámara; al alejarse sale solo.
  let adentro = false;
  // 3.90.38: también la oficina. `adentro` = false | 'cedis' | 'oficina'; onAdentro recibe ese valor.
  const LUGARES = { cedis: () => ({ poner: ctx.cedisAdentro, x: cedisPos.x, z: cedisPos.z - 1, zoom: 12 }), oficina: () => ({ poner: ctx.oficinaAdentro, x: ofiPos.x - 2.5, z: ofiPos.z - 1, zoom: 11 }) };
  function entrar(lugar) {
    lugar = LUGARES[lugar] ? lugar : false; if (adentro === lugar || (lugar && !LUGARES[lugar]().poner)) return;
    if (adentro) LUGARES[adentro]().poner?.(false);
    adentro = lugar; if (lugar) { const l = LUGARES[lugar](); l.poner(true); vista.cxObj = l.x; vista.czObj = l.z; vista.zoomObj = l.zoom; }
    onAdentro?.(adentro);
  }
  const entrarCedis = (on) => entrar(on ? 'cedis' : false);
  // Seguir a alguien (etapa 5, 3.90.57): la cámara se queda pegada a un vendedor, camión o barco (su malla fuente, que se
  // mueve cada cuadro); cualquier arrastre/clic sobre el lienzo o «Esc» lo suelta y avisa con onSiguiendo(null).
  let siguiendo = null; const _pos = new THREE.Vector3();
  function seguir(tag) {
    let obj = null; if (tag) raiz.traverse((o) => { if (!obj && o.isMesh && o.userData.tag === tag) obj = o; });
    siguiendo = obj; if (obj) vista.zoomObj = Math.min(vista.zoomObj, 24); onSiguiendo?.(obj ? tag : null); return !!obj;
  }
  const soltar = () => { if (siguiendo) { siguiendo = null; onSiguiendo?.(null); } };
  const onSoltarTecla = (e) => { if (e.key === 'Escape') soltar(); };
  canvas.addEventListener('pointerdown', soltar); window.addEventListener('keydown', onSoltarTecla);
  // Capas de información (3.90.48): un disco translúcido por ciudad con el tono de `capaCiudades()`; se arma la primera vez
  // que se pide (no entra en las instancias) y de lejos crece con el zoom para leerse en el mapa. capa(null) las apaga.
  let capaGrupo = null; const capaDiscos = new Map();
  function capa(nombre) {
    try {
      const c = nombre ? capaCiudades(modelo, nombre) : null;
      if (!c) { if (capaGrupo) capaGrupo.visible = false; return null; }
      const matDe = (tono) => { const k = `capa-${tono}`; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color: CAPA_TONOS[tono] ?? CAPA_TONOS.gris, transparent: true, opacity: .5, depthWrite: false })); return mats.get(k); };
      if (!capaGrupo) {
        capaGrupo = new THREE.Group(); capaGrupo.renderOrder = 5; raiz.add(capaGrupo);
        const geo = new THREE.CircleGeometry(1, 40); geo.rotateX(-Math.PI / 2);
        for (const [ciudad, p] of distritoPos) { const d = new THREE.Mesh(geo, matDe('gris')); const r = Math.hypot(p.ancho || 6, p.largo || 6) / 2 + 1.2; d.position.set(p.x, .36, p.z); d.userData.r = r; d.scale.setScalar(r); d.renderOrder = 5; capaGrupo.add(d); capaDiscos.set(ciudad, d); }
        animados.push(() => { if (!capaGrupo.visible) return; const k = Math.max(1, vista.zoom / 45); for (const d of capaDiscos.values()) d.scale.setScalar(d.userData.r * k); });
      }
      for (const [ciudad, d] of capaDiscos) { const v = c.porCiudad.get(ciudad); d.visible = !!v; if (v) d.material = matDe(v.tono); }
      capaGrupo.visible = true; return c;
    } catch (e) { console.warn('[ciudad] capa', e); if (capaGrupo) capaGrupo.visible = false; return null; } // falla sola
  }
  let destino = null; // ciudad a la que viajaste: con ella el botón ofrece «← Volver al mapa»
  const vistaDe = (ciudad) => vistaCiudad(distritoPos.get(ciudad), { ang: vista.ang, aspecto: (canvas.clientWidth || 800) / (canvas.clientHeight || 600) });
  function irA(tag) { if (tag?.tipo === 'punto') { if (Number.isFinite(tag.x) && Number.isFinite(tag.z)) { vista.cxObj = tag.x; vista.czObj = tag.z; } return; } if (tag?.tipo === 'mapa') { const m = vistaMapa({ ang: vista.ang, aspecto: (canvas.clientWidth || 800) / (canvas.clientHeight || 600) }); if (m) { vista.cxObj = m.cx; vista.czObj = m.cz; vista.zoomObj = m.zoom; } return; } if (tag?.tipo === 'base') { const b = vistaBase(); if (b) { vista.cxObj = b.cx; vista.czObj = b.cz; vista.zoomObj = b.zoom; } return; } let p = null; if (tag?.tipo === 'oficina') p = ofiPos; else if (tag?.tipo === 'cedis') p = cedisPos; else if (tag?.tipo === 'puerto') p = puertoPos; else if (tag?.tipo === 'banco' && bancoPos) p = bancoPos; else if (tag?.ciudad && distritoPos.has(tag.ciudad)) { const c = vistaDe(tag.ciudad); if (c) { destino = tag.ciudad; vista.cxObj = c.cx; vista.czObj = c.cz; vista.zoomObj = c.zoom; return; } p = distritoPos.get(tag.ciudad); } if (!p) return; vista.cxObj = p.x; vista.czObj = p.z; vista.zoomObj = 18; }

  // Dibujar sólo cuando hace falta: con la pestaña del navegador oculta se pausa del todo; en calma (15 s sin gestos y la
  // cámara quieta) baja a ~10 fps; cualquier gesto la regresa a 60 al instante.
  const CALMA_MS = 15000, CALMA_CUADRO_MS = 100;
  let viva = true; let ultimo = performance.now(); let tiempo = 0; let ultimoDibujo = 0; let pausada = false;
  // Medidor para el harness (`?fps`): cuadros dibujados en el último segundo y lo que costó el último cuadro.
  const med = { cuadros: 0, desde: performance.now(), fps: 0 };
  function frame(now) {
    if (!viva) return;
    if (document.hidden) { pausada = true; return; }
    const calma = now - inter.st.ultimoInput > CALMA_MS && !camara.moviendose();
    if (calma && now - ultimoDibujo < CALMA_CUADRO_MS) { requestAnimationFrame(frame); return; }
    ultimoDibujo = now;
    try { paso(now); } catch (e) { viva = false; console.error('[ciudad] frame', e); onError?.(e); return; }
    requestAnimationFrame(frame);
  }
  const onVisible = () => { if (!document.hidden && viva && pausada) { pausada = false; ultimo = performance.now(); requestAnimationFrame(frame); } };
  document.addEventListener('visibilitychange', onVisible);
  let cuadros = 0, nivel = 'base', vistaAvisada = '', selAvisada = '';
  function paso(now) {
    // El primer timestamp de rAF puede ser ANTERIOR al performance.now() de la construcción (Chrome fija la hora al inicio del
    // cuadro): sin el tope en 0, `tiempo` quedaba negativo y caminar() pedía ruta[-1] → «reading '0'» (3.76.3).
    const dt = Math.max(0, Math.min(.11, (now - ultimo) / 1000)); // tope .11: en calma (10 fps) el tiempo sigue a velocidad real
    ultimo = now; tiempo += dt; // 3.90.3: desde 3.76.9 esta línea había quedado dentro del comentario y nada se movía
    if (siguiendo) { siguiendo.getWorldPosition(_pos); vista.cxObj = _pos.x; vista.czObj = _pos.z; }
    camara.mover(dt, inter.st);
    aplicarDetalle(detalle, vista.zoom);
    if (++cuadros % 10 === 0) { const nb = nivelVista(vista, vistaBase(), destino ? vistaDe(destino) : null); if (nb !== nivel) { nivel = nb; onNivel?.(nb); } } if (adentro && cuadros % 10 === 0) { const l = LUGARES[adentro](); if (vista.zoomObj > 45 || Math.hypot(vista.cxObj - l.x, vista.czObj - l.z) > 30) entrar(false); } // se alejó: el edificio se cierra // cada 10 cuadros basta para el botón
    if (onVista && cuadros % 15 === 0) { const v = { cx: Math.round(vista.cx), cz: Math.round(vista.cz), zoom: Math.round(vista.zoom) }; const k = `${v.cx}|${v.cz}|${v.zoom}`; if (k !== vistaAvisada) { vistaAvisada = k; onVista(v); } } // minimapa
    for (const f of animados) f(tiempo);
    actualizarInstancias(ctx);
    escalarEtiquetas(sprites, vista.zoom, cam, canvas.clientWidth, canvas.clientHeight);
    inter.hover(interact, onHover);
    if (onSeleccion && inter.st.sel !== undefined && cuadros % 3 === 0) { const p = inter.posSeleccion(); const k = p ? `${Math.round(p.x)}|${Math.round(p.y)}` : ''; if (k !== selAvisada) { selAvisada = k; onSeleccion(p); } } // la tarjeta sigue al edificio
    R.render(scene, cam);
    med.cuadros++; if (now - med.desde >= 1000) { med.fps = Math.round(med.cuadros * 1000 / (now - med.desde)); med.cuadros = 0; med.desde = now; }
  }
  requestAnimationFrame(frame);
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas);
  return {
    resize, irA, entrar, entrarCedis, capa, seguir, get hayRacks() { return !!ctx.hayRacks; }, get hayOficina() { return !!ctx.oficinaAdentro; },
    stats({ dibujar = false } = {}) { if (dibujar) R.render(scene, cam); let mallas = 0; raiz.traverse((o) => { if (o.isMesh && o.visible) mallas++; }); return { fps: med.fps, llamadas: R.info.render.calls, triangulos: R.info.render.triangles, geometrias: R.info.memory.geometries, mallas }; },
    // Liberar memoria al salir (3.90.8): cada geometría, material y textura una sola vez (escena + cachés, aunque ya no estén
    // colgadas), buffers de instancias y mapas de sombra; se sueltan las listas para que la escena vieja no quede retenida.
    // Regresa lo que el renderer aún tenía vivo antes de cerrarse (debe ser 0 · 0; el harness lo revisa).
    destruir() {
      viva = false; ro.disconnect(); inter.quitar(); document.removeEventListener('visibilitychange', onVisible); canvas.removeEventListener('pointerdown', soltar); window.removeEventListener('keydown', onSoltarTecla); siguiendo = null;
      const geoms = new Set([...geos.values(), ...(ctx.geoComp?.values() || [])]); const materiales = new Set(mats.values());
      scene.traverse((o) => { if (o.geometry) geoms.add(o.geometry); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => materiales.add(m)); if (o.isInstancedMesh || o.isLight) o.dispose?.(); });
      geoms.forEach((g) => g.dispose()); materiales.forEach((m) => { m.map?.dispose(); m.dispose(); });
      const quedan = { geometrias: R.info.memory.geometries, texturas: R.info.memory.textures };
      scene.clear(); mats.clear(); geos.clear(); ctx.geoComp?.clear(); for (const l of [interact, animados, sprites]) l.length = 0; ctx.dinamicas = null;
      R.renderLists.dispose(); R.dispose();
      return quedan;
    },
  };
}
