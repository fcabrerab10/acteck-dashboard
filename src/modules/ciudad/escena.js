// Acteck Ciudad · escena 3D (three.js, low-poly cálido). Sólo se importa desde Ciudad.jsx dentro de un import()
// dinámico: el chunk `vendor-three`, este archivo y escena/* no viajan con ninguna otra pestaña.
//   crearEscena(canvas, modelo, { onHover(obj|null, {x,y}), onClick(obj|null), oscuro }) → { destruir(), resize(), irA(tag) }
// Este archivo sólo orquesta: arma el contexto compartido (ctx) y llama a los módulos de escena/ en orden
// (camara, luz-clima, terreno, edificios, vehiculos, gente, etiquetas, interaccion). El estilo vive en luz-clima.js.
import * as THREE from 'three';
import { crearCamara } from './escena/camara.js';
import { PAL, luces, fondo, cielo } from './escena/luz-clima.js';
import { terreno, carretera } from './escena/terreno.js';
import { oficina, cedis, puerto, distritos } from './escena/edificios.js';
import { barcos, camiones, vendedoresRuta } from './escena/vehiculos.js';
import { etiqueta, escalarEtiquetas } from './escena/etiquetas.js';
import { crearInteraccion } from './escena/interaccion.js';

export function crearEscena(canvas, modelo, { onHover, onClick, onError, oscuro = false, clima = null } = {}) {
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
  const box = (w, h, d, color, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, extra)); m.castShadow = true; m.receiveShadow = true; m.position.y = h / 2; return m; };
  const ctx = { scene, raiz, P, oscuro: noche, noche, nubosidad, clima, modelo, esc: { x: modelo.origen.x, z: modelo.origen.z }, M, box, add, interact, animados, sprites };

  luces(ctx);
  scene.add(raiz);
  fondo(ctx);
  terreno(ctx);
  cielo(ctx);
  // Acteck en Guadalajara (oficina + CEDIS) y el puerto de Manzanillo con sus barcos.
  const ofiPos = oficina(ctx);
  const cedisPos = cedis(ctx);
  const puertoPos = puerto(ctx);
  barcos(ctx, puertoPos);
  carretera(ctx, { x: puertoPos.x, z: puertoPos.z }, { x: cedisPos.x, z: cedisPos.z + 8 }, 1.8);
  const { distritoPos, rutas } = distritos(ctx, cedisPos);
  const etA = etiqueta(ctx, 'acteck. · Guadalajara', '#0A84FF'); etA.position.set(ctx.esc.x + 1, 17, ctx.esc.z - 4); raiz.add(etA);
  const etP = etiqueta(ctx, 'Manzanillo', '#1D1D1F'); etP.position.set(puertoPos.x, 10, puertoPos.z + 2); raiz.add(etP);
  camiones(ctx, rutas);
  vendedoresRuta(ctx, rutas);

  const inter = crearInteraccion(canvas, camara, { onClick });

  function irA(tag) { let p = null; if (tag?.tipo === 'oficina') p = ofiPos; else if (tag?.tipo === 'cedis') p = cedisPos; else if (tag?.tipo === 'puerto') p = puertoPos; else if (tag?.ciudad && distritoPos.has(tag.ciudad)) p = distritoPos.get(tag.ciudad); if (!p) return; vista.cxObj = p.x; vista.czObj = p.z; vista.zoomObj = 18; }

  let viva = true; let ultimo = performance.now(); let tiempo = 0;
  function frame(now) {
    if (!viva) return;
    try { paso(now); } catch (e) { viva = false; console.error('[ciudad] frame', e); onError?.(e); return; }
    requestAnimationFrame(frame);
  }
  function paso(now) {
    // El primer timestamp de rAF puede ser ANTERIOR al performance.now() de la construcción (Chrome fija la hora al inicio del
    // cuadro): sin el tope en 0, `tiempo` quedaba negativo y caminar() pedía ruta[-1] → «reading '0'» (3.76.3).
    const dt = Math.max(0, Math.min(.05, (now - ultimo) / 1000)); ultimo = now; tiempo += dt;
    camara.mover(dt, inter.st);
    for (const f of animados) f(tiempo);
    escalarEtiquetas(sprites, vista.zoom);
    inter.hover(interact, onHover);
    R.render(scene, cam);
  }
  requestAnimationFrame(frame);
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas);
  return {
    resize, irA,
    destruir() { viva = false; ro.disconnect(); inter.quitar(); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); R.dispose(); },
  };
}
