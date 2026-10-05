// Acteck Ciudad · escena 3D (three.js, low-poly cálido). Sólo se importa desde Ciudad.jsx dentro de un import()
// dinámico: el chunk `vendor-three` y este archivo no viajan con ninguna otra pestaña.
//   crearEscena(canvas, modelo, { onHover(obj|null, {x,y}), onClick(obj|null), oscuro }) → { destruir(), resize(), irA(tag), setOscuro(b) }
// Cámara isométrica (ortográfica) con arrastre, zoom con rueda y giro suave. Todo el estilo vive aquí (paleta, materiales, luz).
import * as THREE from 'three';
import { pxAEscena, COLOR_CUENTA } from './modelo';
import MEXICO from '../comercial/sellout/mexico-estados.json';

const PAL = {
  dia:   { cielo: 0xEAF2F7, suelo: 0xE8DCC2, suelo2: 0xDFCFAE, calle: 0xCDBFA3, banqueta: 0xE6DCC8, agua: 0x6FB1E8, agua2: 0x5AA0DA, cerro: 0xC9D8C3, cerro2: 0xB4C8B0, arbol: 0x7FA66B, arbol2: 0x6B9458, tronco: 0x8B6D4B,
           oficina: 0xF6EEDC, oficinaTecho: 0xE0C6A2, cedis: 0xE8A77A, cedisTecho: 0xD98F63, tienda: 0xF3E7D3, tiendaTecho: 0xC98B5B, ventana: 0x3B4252, ventanaOn: 0xFFE9A8, camion: 0xF4F1EA, cabina: 0xE05A45, barco: 0xF4F1EA, barcoCab: 0x3B4252, nube: 0xFFFFFF, sol: 1.35, amb: .85, fog: 0xEAF2F7 },
  noche: { cielo: 0x121722, suelo: 0x343644, suelo2: 0x25252D, calle: 0x1B1C22, banqueta: 0x33343C, agua: 0x18324D, agua2: 0x15293F, cerro: 0x25303A, cerro2: 0x1E272F, arbol: 0x2E4A33, arbol2: 0x27402C, tronco: 0x3A2E24,
           oficina: 0x3B3F4B, oficinaTecho: 0x4A4F5C, cedis: 0x5C4335, cedisTecho: 0x6B4E3E, tienda: 0x3C3F4A, tiendaTecho: 0x5A4030, ventana: 0x1D1F26, ventanaOn: 0xFFD66B, camion: 0xC9C6BE, cabina: 0xE05A45, barco: 0xC9C6BE, barcoCab: 0x2A2E38, nube: 0x2A3140, sol: .4, amb: .55, fog: 0x121722 },
};
const ACC = { azul: 0x0A84FF, verde: 0x30D158, naranja: 0xFF9F0A, rojo: 0xFF453A, morado: 0xBF5AF2, gris: 0x8E8E93 };

export function crearEscena(canvas, modelo, { onHover, onClick, oscuro = false } = {}) {
  let P = oscuro ? PAL.noche : PAL.dia;
  const R = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  R.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.outputColorSpace = THREE.SRGBColorSpace; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 600);
  const vista = { cx: 10, cz: -14, zoom: 48, ang: Math.PI / 4, zoomObj: 48, cxObj: 10, czObj: -14 };
  const W = () => canvas.clientWidth || 800, H = () => canvas.clientHeight || 600;
  function resize() { const w = W(), h = H(); R.setSize(w, h, false); const a = w / h; cam.left = -vista.zoom * a; cam.right = vista.zoom * a; cam.top = vista.zoom; cam.bottom = -vista.zoom; cam.updateProjectionMatrix(); }
  function colocarCam() { cam.position.set(vista.cx + Math.cos(vista.ang) * 220, 180, vista.cz + Math.sin(vista.ang) * 220); cam.lookAt(vista.cx, 0, vista.cz); }
  resize(); colocarCam();

  const hemi = new THREE.HemisphereLight(0xffffff, 0x9a8c74, P.amb); scene.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff4e0, P.sol); sol.position.set(60, 110, 50); sol.castShadow = true; sol.shadow.mapSize.set(3072, 3072);
  Object.assign(sol.shadow.camera, { left: -150, right: 150, top: 150, bottom: -150, near: 10, far: 420 }); sol.shadow.bias = -0.0006; sol.shadow.normalBias = .03; scene.add(sol);
  const luzNoche = new THREE.Group(); scene.add(luzNoche);

  const mats = new Map();
  const M = (color, extra = {}) => { const k = `${color}|${JSON.stringify(extra)}`; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, flatShading: true, ...extra })); return mats.get(k); };
  const interact = []; // { mesh, tag }
  const animados = [];
  const sprites = []; // etiquetas (se declaran antes de usarse: las ciudades se dibujan antes que la función etiqueta)
  const raiz = new THREE.Group(); scene.add(raiz);
  const g_cerros = new THREE.Group(); raiz.add(g_cerros); // Sierra Madre, al norte de Guadalajara
  const add = (m, tag) => { raiz.add(m); if (tag) { m.traverse((o) => { if (o.isMesh) { o.userData.tag = tag; interact.push(o); } }); } return m; };
  const box = (w, h, d, color, extra) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), M(color, extra)); m.castShadow = true; m.receiveShadow = true; m.position.y = h / 2; return m; };
  const esc = { x: modelo.origen.x, z: modelo.origen.z };

  // ── Terreno: tierra grande, agua al suroeste (Pacífico) y al este (Golfo), cerros al fondo ──
  // Mar: un plano grande con oleaje suave debajo de todo.
  const aguaG = new THREE.PlaneGeometry(900, 700, 60, 48); const agua = new THREE.Mesh(aguaG, M(P.agua, { roughness: .35, metalness: .05, flatShading: true })); agua.rotation.x = -Math.PI / 2; agua.position.set(20, -.9, -10); raiz.add(agua);
  animados.push((t) => { const pos = aguaG.attributes.position; for (let i = 0; i < pos.count; i++) { const x = pos.getX(i), y = pos.getY(i); pos.setZ(i, Math.sin(x * .08 + t * 1.1) * .35 + Math.cos(y * .11 + t * .8) * .3); } pos.needsUpdate = true; aguaG.computeVertexNormals(); });
  // Tierra: el contorno real de México (32 estados del mapa de Sell Out) extruido como una meseta baja.
  (function tierra() {
    const g = new THREE.Group();
    for (const e of MEXICO.estados) {
      const cmds = e.d.match(/[MLZ][^MLZ]*/gi) || []; let shape = null; const shapes = [];
      for (const c of cmds) { const t = c[0].toUpperCase(); const nums = (c.slice(1).match(/-?\d+(\.\d+)?/g) || []).map(Number); if (t === 'M') { shape = new THREE.Shape(); shapes.push(shape); const p = pxAEscena(nums[0], nums[1]); shape.moveTo(p.x, -p.z); } else if (t === 'L' && shape) { for (let i = 0; i + 1 < nums.length; i += 2) { const p = pxAEscena(nums[i], nums[i + 1]); shape.lineTo(p.x, -p.z); } } }
      for (const sh of shapes) { if (sh.curves.length < 3) continue; const geo = new THREE.ExtrudeGeometry(sh, { depth: 1.2, bevelEnabled: false }); const m = new THREE.Mesh(geo, M(P.suelo, { roughness: 1, flatShading: false })); m.rotation.x = -Math.PI / 2; m.position.y = -1.2; m.receiveShadow = true; g.add(m); }
    }
    raiz.add(g);
  })();
  // Sierras chicas en zonas sin ciudades (desiertos de Sonora/Chihuahua y Sierra Madre Occidental).
  [[-55, -45, 7], [-63, -53, 9], [-38, -71, 8], [-12, -72, 6], [-32, -47, 5], [-20, -12, 5], [-8, -36, 6], [-46, -36, 5]].forEach(([x, z, r], i) => { const c = new THREE.Mesh(new THREE.ConeGeometry(r, r * .9, 6), M(i % 2 ? P.cerro : P.cerro2, { roughness: 1 })); c.position.set(x, 0, z); c.receiveShadow = true; c.castShadow = true; g_cerros.add(c); });
  // nubes
  for (let i = 0; i < 7; i++) { const g = new THREE.Group(); for (let k = 0; k < 4; k++) { const s = new THREE.Mesh(new THREE.SphereGeometry(2.2 + (k % 2) * 1.4, 8, 6), M(P.nube, { roughness: 1 })); s.position.set(k * 2.4 - 3, (k % 2) * .8, (k % 3) * .6); g.add(s); } g.position.set(-120 + i * 42, 34 + (i % 3) * 4, -60 + (i % 4) * 30); raiz.add(g); animados.push((t) => { g.position.x += .006; if (g.position.x > 160) g.position.x = -160; }); }

  // ── Carreteras: de Acteck a cada ciudad (curvas) ──
  const rutas = new Map();
  function carretera(a, b, ancho = 1.6) {
    const mid = new THREE.Vector3((a.x + b.x) / 2 + (b.z - a.z) * .12, 0, (a.z + b.z) / 2 - (b.x - a.x) * .12);
    const curva = new THREE.QuadraticBezierCurve3(new THREE.Vector3(a.x, .05, a.z), mid, new THREE.Vector3(b.x, .05, b.z));
    const pts = curva.getPoints(40); const geo = new THREE.BufferGeometry(); const verts = []; const idx = [];
    for (let i = 0; i < pts.length; i++) { const p = pts[i]; const q = pts[Math.min(pts.length - 1, i + 1)]; const dx = q.x - p.x, dz = q.z - p.z; const l = Math.hypot(dx, dz) || 1; const nx = -dz / l * ancho / 2, nz = dx / l * ancho / 2; verts.push(p.x + nx, .06, p.z + nz, p.x - nx, .06, p.z - nz); if (i < pts.length - 1) { const o = i * 2; idx.push(o, o + 1, o + 2, o + 1, o + 3, o + 2); } }
    geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setIndex(idx); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M(P.calle, { roughness: 1 })); m.receiveShadow = true; raiz.add(m);
    return curva;
  }

  // ── Acteck: oficina + CEDIS + andén en Guadalajara ──
  const ofiPos = { x: esc.x - 7, z: esc.z + 2 };
  (function oficina() {
    const g = new THREE.Group(); g.position.set(ofiPos.x, 0, ofiPos.z);
    const base = box(14, .5, 14, P.banqueta); g.add(base);
    const cuerpo = box(9, 9, 7, P.oficina); cuerpo.position.set(0, 4.75, 0); g.add(cuerpo);
    const techo = box(9.8, .6, 7.8, P.oficinaTecho); techo.position.set(0, 9.6, 0); g.add(techo);
    const letrero = box(5, .9, .3, ACC.azul, { emissive: ACC.azul, emissiveIntensity: oscuro ? 1.6 : .35 }); letrero.position.set(0, 10.4, 3.6); g.add(letrero);
    const vm = M(P.ventana, { roughness: .4 }); const vOn = M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.4 : .15, roughness: .4 });
    for (let f = 0; f < 3; f++) for (let i = 0; i < 4; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.4, .12), (f + i) % 3 ? vOn : vm); v.position.set(-3 + i * 2, 1.8 + f * 2.8, 3.56); g.add(v); const v2 = v.clone(); v2.rotation.y = Math.PI / 2; v2.position.set(4.56, 1.8 + f * 2.8, -2.2 + i * 1.5); g.add(v2); }
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(1.6, 2.2, .12), M(0x5A4636)); puerta.position.set(0, 1.35, 3.56); g.add(puerta);
    // sala de juntas (anexo bajo) que se enciende con reunión
    const sala = box(4.5, 3.2, 4.5, P.oficina); sala.position.set(-6, 1.85, -3); g.add(sala);
    const salaTecho = box(5, .4, 5, P.oficinaTecho); salaTecho.position.set(-6, 3.65, -3); g.add(salaTecho);
    const salaVent = new THREE.Mesh(new THREE.BoxGeometry(3, 1.4, .12), modelo.oficina.reunionEnCurso ? vOn : vm); salaVent.position.set(-6, 1.9, -.7); g.add(salaVent);
    if (oscuro && modelo.oficina.reunionEnCurso) { const l = new THREE.PointLight(0xFFD66B, 1.4, 14); l.position.set(-6, 3, .5); g.add(l); }
    for (const [x, z] of [[6, 5.5], [-6, 5.5], [6.2, -5.8]]) arbol(g, x, z, 1.1);
    add(g, { tipo: 'oficina', titulo: 'Oficina Acteck', sub: `${modelo.oficina.personas.length + modelo.oficina.genericos} personas · ${modelo.oficina.reuniones} reunión${modelo.oficina.reuniones === 1 ? '' : 'es'} hoy`, pagina: 'agenda' });
    // gente: equipo con nombre + genéricos, caminando entre oficina, sala y CEDIS
    const rutasOf = [[0, 5.5], [-6, 1.2], [3, 7], [9, 2], [12, -3], [0, 5.5]];
    const todos = [...modelo.oficina.personas.map((p) => ({ ...p, generico: false })), ...Array.from({ length: modelo.oficina.genericos }, (_, i) => ({ nombre: ['Ventas', 'Almacén', 'Administración'][i % 3], generico: true, rol: ['comercial', 'almacen', 'finanzas'][i % 3] }))];
    todos.forEach((p, i) => {
      const col = { direccion: ACC.azul, comercial: ACC.morado, finanzas: ACC.verde, almacen: ACC.naranja }[p.rol] || ACC.gris;
      const per = persona(col, p.generico ? .9 : 1); per.position.set(ofiPos.x + rutasOf[0][0], .5, ofiPos.z + rutasOf[0][1]);
      add(per, { tipo: 'persona', titulo: p.nombre, sub: p.generico ? 'equipo' : (p.actividad ? `ahora: ${p.actividad}` : `${p.pendientes} pendiente${p.pendientes === 1 ? '' : 's'} hoy · ${p.hechas} hecha${p.hechas === 1 ? '' : 's'}`), pagina: 'agenda', persona: p });
      const fase = i * 1.37, vel = .22 + (i % 3) * .05;
      animados.push((t) => caminar(per, rutasOf, t * vel + fase, ofiPos, p.generico ? .9 : 1));
    });
  })();
  const cedisPos = { x: esc.x + 9, z: esc.z - 2 };
  (function cedis() {
    const g = new THREE.Group(); g.position.set(cedisPos.x, 0, cedisPos.z);
    g.add(box(22, .5, 16, P.banqueta));
    const nave = box(16, 6, 11, P.cedis); nave.position.set(0, 3.25, -1); g.add(nave);
    const techo = box(17, .7, 12, P.cedisTecho); techo.position.set(0, 6.6, -1); g.add(techo);
    for (let i = 0; i < 3; i++) { const cl = box(2.2, .4, 3, P.cedisTecho); cl.position.set(-5 + i * 5, 7.1, -1); g.add(cl); }
    for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.6, .14), M(0x4A4F5C)); p.position.set(-5 + i * 5, 1.5, 4.57); g.add(p); }
    for (let i = 0; i < 6; i++) { const v = new THREE.Mesh(new THREE.BoxGeometry(1.6, .8, .12), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.2 : .12, roughness: .4 })); v.position.set(-6.5 + i * 2.6, 4.6, 4.57); g.add(v); }
    const rotulo = box(5.5, .9, .25, ACC.azul, { emissive: ACC.azul, emissiveIntensity: oscuro ? 1.6 : .35 }); rotulo.position.set(0, 7.4, 4.6); g.add(rotulo);
    // racks al frente (altura por días de inventario) y tarimas descargando
    for (let i = 0; i < modelo.cedis.racks; i++) { const col = i % 2 ? 0xC58A3A : 0xD49A4A; for (let k = 0; k < 1 + (i % 3); k++) { const c = box(1.3, 1, 1.3, col); c.position.set(-9 + (i % 5) * 2.2, .75 + k * 1.05, 6.5 + Math.floor(i / 5) * 2); g.add(c); } }
    modelo.puerto.tarimas.slice(0, 6).forEach((tp, i) => { const c = box(1.3, 1, 1.3, 0xA86A2E); c.position.set(6 + (i % 3) * 2, .75, 6 + Math.floor(i / 3) * 2); g.add(c); });
    for (const [x, z] of [[-10.5, -6.5], [10.5, -6.5]]) arbol(g, x, z, 1.2);
    add(g, { tipo: 'cedis', titulo: 'CEDIS', sub: `$${(modelo.cedis.valor / 1e6).toFixed(1)} M · ${Math.round(modelo.cedis.dias)} días · ${modelo.puerto.tarimas.length} contenedor${modelo.puerto.tarimas.length === 1 ? '' : 'es'} descargando`, pagina: 'inventarioGlobal' });
    // montacargas
    const mc = new THREE.Group(); const cuerpo = box(1.6, 1, 1.1, ACC.naranja); mc.add(cuerpo); const mastil = box(.2, 2.2, .2, 0x444444); mastil.position.set(.9, 1.1, 0); mc.add(mastil); const carga = box(1, .8, 1, 0xC58A3A); carga.position.set(1.4, .6, 0); mc.add(carga);
    [[-.5, .5], [-.5, -.5], [.5, .5], [.5, -.5]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .25, 10), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .3, z); mc.add(r); });
    mc.position.set(cedisPos.x - 2, 0, cedisPos.z + 5); add(mc, { tipo: 'montacargas', titulo: 'Montacargas', sub: 'moviendo tarimas', pagina: 'inventarioGlobal' });
    animados.push((t) => { const p = (t * .18) % 1; const x = cedisPos.x - 6 + Math.abs(Math.sin(p * Math.PI * 2)) * 12; mc.position.x = x; mc.rotation.y = Math.cos(p * Math.PI * 2) > 0 ? 0 : Math.PI; });
  })();
  // ── Puerto Manzanillo: muelle + grúa; barcos en el mar hacia el muelle ──
  const puertoPos = modelo.puertoPos;
  (function puerto() {
    const g = new THREE.Group(); g.position.set(puertoPos.x, 0, puertoPos.z);
    const muelle = box(10, .6, 4, P.banqueta); muelle.position.set(0, .3, 2); g.add(muelle);
    const grua = new THREE.Group(); const pata1 = box(.5, 7, .5, ACC.rojo); pata1.position.set(-2, 3.5, 0); const pata2 = pata1.clone(); pata2.position.x = 2; const viga = box(7, .5, .5, ACC.rojo); viga.position.set(0, 7.2, 0); grua.add(pata1, pata2, viga); grua.position.set(0, .6, 2); g.add(grua);
    for (let i = 0; i < 3; i++) { const c = box(2.2, 1, 1.2, [ACC.azul, ACC.naranja, ACC.verde][i]); c.position.set(-3 + i * 3, 1.1, 1.2); g.add(c); }
    add(g, { tipo: 'puerto', titulo: 'Puerto de Manzanillo', sub: `${modelo.puerto.barcos.length} contenedores navegando · ${modelo.puerto.totalPiezas.toLocaleString('es-MX')} pz`, pagina: 'inventarioGlobal' });
  })();
  // barcos: entran desde el suroeste
  modelo.puerto.barcos.forEach((b, i) => {
    const g = new THREE.Group();
    const casco = box(5, 1.1, 1.8, P.barco); casco.position.y = .5; g.add(casco);
    const proa = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.6, 4), M(P.barco)); proa.rotation.z = -Math.PI / 2; proa.rotation.y = Math.PI / 4; proa.position.set(3.1, .55, 0); proa.castShadow = true; g.add(proa);
    const cab = box(1.3, 1.3, 1.5, P.barcoCab); cab.position.set(-1.6, 1.65, 0); g.add(cab);
    for (let k = 0; k < 3; k++) { const c = box(1, .7, 1.4, [ACC.azul, ACC.naranja, ACC.verde, ACC.morado][(k + i) % 4]); c.position.set(.2 + k * -.0 + (k - 1) * 1.1, 1.4, 0); g.add(c); }
    const ini = { x: puertoPos.x - 52 - (i % 4) * 9, z: puertoPos.z + 46 + (i % 3) * 8 }; const fin = { x: puertoPos.x - 3, z: puertoPos.z + 5 };
    g.position.set(ini.x + (fin.x - ini.x) * b.progreso, 0, ini.z + (fin.z - ini.z) * b.progreso); g.rotation.y = -Math.atan2(fin.z - ini.z, fin.x - ini.x);
    add(g, { tipo: 'barco', titulo: `Contenedor ${b.id}`, sub: `${b.naviera || b.supplier} · ${b.piezas.toLocaleString('es-MX')} pz · ${b.llegaEnDias == null ? 'sin ETA' : b.llegaEnDias <= 0 ? 'llegó' : `llega en ${b.llegaEnDias} d`}`, pagina: 'inventarioGlobal', barco: b });
    const base = g.position.clone();
    animados.push((t) => { g.position.y = Math.sin(t * 1.4 + i) * .12; g.position.x = base.x + Math.sin(t * .11 + i) * .4; g.rotation.z = Math.sin(t * 1.1 + i) * .02; });
  });
  carretera({ x: puertoPos.x, z: puertoPos.z }, { x: cedisPos.x, z: cedisPos.z + 8 }, 1.8);

  // ── Distritos: una manzana por ciudad con sus tiendas ──
  const distritoPos = new Map();
  modelo.distritos.forEach((d) => {
    const esGDL = d.ciudad === 'GUADALAJARA';
    const base = esGDL ? { x: esc.x - 4, z: esc.z + 16 } : d.pos;
    distritoPos.set(d.ciudad, base);
    const n = d.tiendas.length; const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(n * 1.5)))); const filas = Math.ceil(n / cols);
    const g = new THREE.Group(); g.position.set(base.x, 0, base.z);
    const ancho = cols * 2.7 + 1.6, largo = filas * 2.9 + 1.6;
    const piso = box(ancho, .3, largo, P.banqueta); piso.position.y = .15; g.add(piso);
    piso.userData.tag = { tipo: 'ciudad', titulo: d.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : capital(d.ciudad), sub: `${d.tiendas.filter((t) => t.vendio).length} de ${d.tiendas.length} tiendas vendieron este mes · ${d.cuentas.length} cliente${d.cuentas.length === 1 ? '' : 's'}${d.vendedores.length ? ` · ${d.vendedores.length} vendedores` : ''}`, ciudad: d.ciudad, pagina: 'sellOut', distrito: { ciudad: d.ciudad, tiendas: d.tiendas.map((t) => ({ nombre: `${t.nombreCuenta} · ${t.sucursal}`, vendio: t.vendio, importe: t.importe })) } }; interact.push(piso);
    const calleH = new THREE.Mesh(new THREE.PlaneGeometry(ancho + 2, 1.4), M(P.calle, { roughness: 1 })); calleH.rotation.x = -Math.PI / 2; calleH.position.set(0, .32, largo / 2 + .9); g.add(calleH);
    d.tiendas.forEach((t, i) => {
      const c = i % cols, f = Math.floor(i / cols);
      const x = -ancho / 2 + 2.1 + c * 2.7, z = -largo / 2 + 2.1 + f * 2.9;
      const col = COLOR_CUENTA[t.cuenta] || ACC.gris;
      const tg = new THREE.Group(); tg.position.set(x, .3, z);
      const cuerpo = box(2, 1.9, 2, P.tienda); cuerpo.position.y = .95; tg.add(cuerpo);
      const techo = box(2.3, .3, 2.3, P.tiendaTecho); techo.position.y = 2.05; tg.add(techo);
      const toldo = box(2.2, .16, .8, col); toldo.position.set(0, 1.5, 1.35); tg.add(toldo);
      const letrero = box(1.5, .34, .12, t.vendio ? col : P.ventana, { emissive: t.vendio ? col : 0x000000, emissiveIntensity: t.vendio ? (oscuro ? 1.6 : .3) : 0 }); letrero.position.set(0, 1.78, 1.06); tg.add(letrero);
      const vit = new THREE.Mesh(new THREE.BoxGeometry(1.1, .75, .1), M(t.vendio ? P.ventanaOn : P.ventana, { emissive: t.vendio ? P.ventanaOn : 0x000000, emissiveIntensity: t.vendio ? (oscuro ? 1.2 : .1) : 0, roughness: .4 })); vit.position.set(-.3, .75, 1.05); tg.add(vit);
      const puerta = new THREE.Mesh(new THREE.BoxGeometry(.5, 1.1, .1), M(0x5A4636)); puerta.position.set(.6, .55, 1.05); tg.add(puerta);
      if (oscuro && t.vendio) { const l = new THREE.PointLight(col, .8, 6); l.position.set(0, 2.2, 1.8); tg.add(l); }
      g.add(tg);
      interact.push(...(() => { const arr = []; tg.traverse((o) => { if (o.isMesh) { o.userData.tag = { tipo: 'tienda', titulo: `${t.nombreCuenta} · ${t.sucursal}`, sub: `${t.vendio ? `vendió este mes $${fmtK(t.importe)}` : 'sin venta este mes'}${t.previo ? ` · mes anterior $${fmtK(t.previo)}` : ''}${t.vendedores ? ` · ${t.vendedores} vendedores` : ''}`, pagina: 'sellOut', cuenta: t.cuenta, ciudad: d.ciudad }; arr.push(o); } }); return arr; })());
    });
    // árboles y farol
    arbol(g, -ancho / 2 - 1.2, -largo / 2 - 1.2, .9); arbol(g, ancho / 2 + 1.2, largo / 2 + 1.2, 1); if (n > 6) arbol(g, ancho / 2 + 1.2, -largo / 2 - 1.2, .8);
    const farol = box(.12, 2.6, .12, 0x6b6e76); farol.position.set(ancho / 2 + .6, 1.3, largo / 2 + .6); g.add(farol); const foco = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.6 : .2 })); foco.position.set(ancho / 2 + .6, 2.7, largo / 2 + .6); g.add(foco);
    // vendedores del cliente en su ciudad
    d.vendedores.forEach((v, i) => { const per = persona(COLOR_CUENTA[v.cuenta] || ACC.gris, .85); per.position.set(base.x - ancho / 2 + 1 + i * 1.6, .3, base.z + largo / 2 + 2.6); add(per, { tipo: 'vendedor', titulo: v.nombre, sub: `${v.nombreCuenta} · ${v.activo ? 'vendiendo este mes' : 'sin venta reciente'} · $${fmtK(v.importe)} en el año`, pagina: 'sellOut', cuenta: v.cuenta }); const ruta = [[0, 0], [ancho * .6, 0], [ancho * .6, 1.2], [0, 1.2]]; animados.push((t) => caminar(per, ruta, t * .15 + i * .9, { x: base.x - ancho / 2 + 1 + i * 1.6, z: base.z + largo / 2 + 2.6 }, .85)); });
    raiz.add(g);
    if (n >= 3) { const cuantos = Math.min(4, Math.ceil(n / 3)); for (let i = 0; i < cuantos; i++) { const per = persona([0x9AA0AB, 0xC9B79C, 0x7A8AA6, 0xB58A7A][i % 4], .8); const o = { x: base.x - ancho / 2 + 1 + i * 2.4, z: base.z + largo / 2 + 1.1 }; per.position.set(o.x, .3, o.z); raiz.add(per); const ruta = [[0, 0], [ancho - 2, 0], [ancho - 2, .9], [0, .9]]; animados.push((t) => caminar(per, ruta, t * .12 + i * 1.7 + n, o, .8)); } }
    // etiqueta de ciudad (sprite de texto)
    const et = etiqueta(d.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : capital(d.ciudad), d.vendio ? '#1D1D1F' : '#8E8E93'); et.position.set(base.x, 3.6, base.z - largo / 2 - .8); raiz.add(et);
    if (!esGDL) rutas.set(d.ciudad, carretera({ x: cedisPos.x, z: cedisPos.z + 8 }, { x: base.x, z: base.z + largo / 2 + 2.2 }));
    else rutas.set(d.ciudad, carretera({ x: cedisPos.x, z: cedisPos.z + 8 }, { x: base.x + ancho / 2 + 3, z: base.z }, 1.2));
  });
  // etiquetas de Acteck y puerto
  const etA = etiqueta('acteck. · Guadalajara', '#0A84FF'); etA.position.set(esc.x + 1, 17, esc.z - 4); raiz.add(etA);
  const etP = etiqueta('Manzanillo', '#1D1D1F'); etP.position.set(puertoPos.x, 10, puertoPos.z + 2); raiz.add(etP);

  // ── Camiones (facturas) y vendedores del ERP (coches) por las carreteras ──
  modelo.camiones.forEach((c, i) => {
    const curva = rutas.get(c.ciudad); if (!curva) return;
    const g = new THREE.Group(); const caja = box(2.6, 1.4, 1.2, P.camion); caja.position.set(-.4, .95, 0); g.add(caja); const cab = box(1, 1.1, 1.2, P.cabina); cab.position.set(1.5, .8, 0); g.add(cab);
    [[-1.1, .5], [-1.1, -.5], [1.4, .5], [1.4, -.5]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .22, 10), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .3, z); g.add(r); });
    if (oscuro) { const f = new THREE.PointLight(0xFFF2C0, .9, 7); f.position.set(2.2, .8, 0); g.add(f); }
    add(g, { tipo: 'camion', titulo: `Factura ${c.folio}`, sub: `${c.cliente} · $${fmtK(c.monto)} · ${c.piezas.toLocaleString('es-MX')} pz · va a ${capital(c.ciudad)}`, pagina: 'ordenesCompra' });
    animados.push((t) => { const p = (c.progreso + t * .025 + i * .07) % 1; const pt = curva.getPointAt(p); const q = curva.getPointAt(Math.min(1, p + .01)); g.position.set(pt.x, .1, pt.z); g.rotation.y = -Math.atan2(q.z - pt.z, q.x - pt.x); });
  });
  modelo.vendedoresRuta.forEach((v, i) => {
    const dest = v.destinos.find((d) => rutas.has(d.ciudad)); const curva = dest ? rutas.get(dest.ciudad) : null; if (!curva) return;
    const g = new THREE.Group(); const cuerpo = box(1.8, .7, 1, ACC.azul); cuerpo.position.y = .55; g.add(cuerpo); const techo = box(1, .5, .9, 0xDCE6F2); techo.position.set(-.1, 1.1, 0); g.add(techo);
    [[-.55, .45], [-.55, -.45], [.55, .45], [.55, -.45]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .2, 10), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .22, z); g.add(r); });
    add(g, { tipo: 'vendedorErp', titulo: v.nombre, sub: `Equipo comercial · ${v.clientes} clientes · va a ${dest.cliente} (${capital(dest.ciudad)})`, pagina: 'sellIn' });
    animados.push((t) => { const p = (v.fase + t * .04 + i * .03) % 2; const q = p < 1 ? p : 2 - p; const pt = curva.getPointAt(q); const pq = curva.getPointAt(Math.max(0, Math.min(1, q + (p < 1 ? .01 : -.01)))); g.position.set(pt.x + .9, .08, pt.z + .9); g.rotation.y = -Math.atan2(pq.z - pt.z, pq.x - pt.x); });
  });

  // ── helpers de modelos ──
  function arbol(g, x, z, s = 1) { const t = new THREE.Mesh(new THREE.CylinderGeometry(.14 * s, .2 * s, 1.1 * s, 6), M(P.tronco)); t.position.set(x, .55 * s, z); t.castShadow = true; g.add(t); const c = new THREE.Mesh(new THREE.ConeGeometry(.95 * s, 2 * s, 7), M(Math.random() > .5 ? P.arbol : P.arbol2)); c.position.set(x, 1.9 * s, z); c.castShadow = true; g.add(c); const c2 = new THREE.Mesh(new THREE.ConeGeometry(.7 * s, 1.4 * s, 7), M(P.arbol)); c2.position.set(x, 2.8 * s, z); c2.castShadow = true; g.add(c2); }
  function persona(col, s = 1) { const g = new THREE.Group(); const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(.32 * s, .38 * s, 1.1 * s, 8), M(col)); cuerpo.position.y = .95 * s; cuerpo.castShadow = true; const cab = new THREE.Mesh(new THREE.SphereGeometry(.3 * s, 10, 8), M(0xF3CFA8)); cab.position.y = 1.75 * s; cab.castShadow = true; const p1 = new THREE.Mesh(new THREE.CylinderGeometry(.11 * s, .11 * s, .5 * s, 6), M(0x3B4252)); p1.position.set(-.14 * s, .25 * s, 0); const p2 = p1.clone(); p2.position.x = .14 * s; g.add(cuerpo, cab, p1, p2); g.userData.piernas = [p1, p2]; return g; }
  function caminar(per, ruta, s, origen, esc) { const n = ruta.length; const k = Math.floor(s) % n, f = s % 1; const a = ruta[k], b = ruta[(k + 1) % n]; const x = a[0] + (b[0] - a[0]) * f, z = a[1] + (b[1] - a[1]) * f; per.position.set(origen.x + x, per.position.y, origen.z + z); per.rotation.y = Math.atan2(b[0] - a[0], b[1] - a[1]); const mov = Math.hypot(b[0] - a[0], b[1] - a[1]) > .01; const sw = mov ? Math.sin(s * 14) * .5 : 0; per.userData.piernas[0].rotation.x = sw; per.userData.piernas[1].rotation.x = -sw; }
  function etiqueta(texto, color) { const c = document.createElement('canvas'); const ctx = c.getContext('2d'); const f = 'bold 44px -apple-system, BlinkMacSystemFont, "SF Pro Display", Helvetica, Arial, sans-serif'; ctx.font = f; const w = Math.ceil(ctx.measureText(texto).width) + 48; c.width = w; c.height = 72; ctx.font = f; ctx.fillStyle = oscuro ? 'rgba(28,28,30,.92)' : 'rgba(255,255,255,.92)'; ctx.beginPath(); ctx.roundRect(0, 0, w, 72, 36); ctx.fill(); ctx.fillStyle = oscuro && color === '#1D1D1F' ? '#F5F5F7' : color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(texto, w / 2, 38); const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.scale.set(w / 72 * 2.3, 2.3, 1); sp.renderOrder = 10; sp.userData.base = { w: w / 72 * 2.3, h: 2.3 }; sprites.push(sp); return sp; }
  function fmtK(v) { return v >= 1e6 ? `${(v / 1e6).toFixed(1)} M` : v >= 1e3 ? `${Math.round(v / 1e3)} K` : String(Math.round(v)); }
  function capital(s) { return String(s).toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase()); }

  // ── interacción ──
  const ray = new THREE.Raycaster(); const vec = new THREE.Vector2(); let hov = null; let mouse = { x: -1, y: -1 }; let drag = null;
  canvas.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, cx: vista.cxObj, cz: vista.czObj, ang: vista.ang, m: false, btn: e.button, shift: e.shiftKey }; canvas.setPointerCapture?.(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => {
    mouse = { x: e.clientX, y: e.clientY };
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.m = true;
    if (drag.btn === 2 || drag.shift) { vista.ang = drag.ang - dx * .004; colocarCam(); return; }
    const k = (vista.zoom * 2) / H(); // unidades por px
    const ca = Math.cos(vista.ang), sa = Math.sin(vista.ang);
    // arrastrar mueve el plano en la dirección de la cámara (ortográfica inclinada)
    vista.cxObj = drag.cx - (dx * k) * sa * -1 - (dy * k) * ca * 1.6; vista.czObj = drag.cz + (dx * k) * ca * -1 - (dy * k) * sa * 1.6;
  });
  const soltar = (e) => { if (drag && !drag.m) onClick?.(hov ? hov.userData.tag : null); drag = null; };
  canvas.addEventListener('pointerup', soltar); canvas.addEventListener('pointercancel', () => { drag = null; });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('wheel', (e) => { e.preventDefault(); vista.zoomObj = Math.max(8, Math.min(90, vista.zoomObj * (e.deltaY > 0 ? 1.1 : .9))); }, { passive: false });
  // pellizco (iPad) → zoom
  let pinch = null; canvas.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: vista.zoomObj }; }, { passive: true });
  canvas.addEventListener('touchmove', (e) => { if (pinch && e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); vista.zoomObj = Math.max(8, Math.min(90, pinch.z * pinch.d / d)); } }, { passive: true });
  canvas.addEventListener('touchend', () => { pinch = null; });
  const teclas = {}; const onKey = (e) => { if (/INPUT|TEXTAREA/.test(e.target?.tagName || '')) return; teclas[e.key.toLowerCase()] = e.type === 'keydown'; };
  window.addEventListener('keydown', onKey); window.addEventListener('keyup', onKey);

  function irA(tag) { let p = null; if (tag?.tipo === 'oficina') p = ofiPos; else if (tag?.tipo === 'cedis') p = cedisPos; else if (tag?.tipo === 'puerto') p = puertoPos; else if (tag?.ciudad && distritoPos.has(tag.ciudad)) p = distritoPos.get(tag.ciudad); if (!p) return; vista.cxObj = p.x; vista.czObj = p.z; vista.zoomObj = 18; }

  let viva = true; let ultimo = performance.now(); let tiempo = 0; let hovPrev = null;
  function frame(now) {
    if (!viva) return;
    const dt = Math.min(.05, (now - ultimo) / 1000); ultimo = now; tiempo += dt;
    const v = 60 * dt * (vista.zoom / 34); if (teclas.w || teclas.arrowup) { vista.czObj -= v * Math.sin(vista.ang) ; vista.cxObj -= v * Math.cos(vista.ang); } if (teclas.s || teclas.arrowdown) { vista.czObj += v * Math.sin(vista.ang); vista.cxObj += v * Math.cos(vista.ang); } if (teclas.a || teclas.arrowleft) { vista.cxObj += v * Math.sin(vista.ang); vista.czObj -= v * Math.cos(vista.ang); } if (teclas.d || teclas.arrowright) { vista.cxObj -= v * Math.sin(vista.ang); vista.czObj += v * Math.cos(vista.ang); }
    // suavizado de cámara (como iOS)
    const k = 1 - Math.pow(.001, dt); vista.cx += (vista.cxObj - vista.cx) * k; vista.cz += (vista.czObj - vista.cz) * k; const z0 = vista.zoom; vista.zoom += (vista.zoomObj - vista.zoom) * k; if (Math.abs(z0 - vista.zoom) > 1e-4) resize(); colocarCam();
    for (const f of animados) f(tiempo);
    const fz = Math.max(.6, Math.min(2.2, vista.zoom / 30)); for (const sp of sprites) sp.scale.set(sp.userData.base.w * fz, sp.userData.base.h * fz, 1);
    // hover
    if (mouse.x >= 0 && !drag) { const r = canvas.getBoundingClientRect(); vec.set(((mouse.x - r.left) / r.width) * 2 - 1, -((mouse.y - r.top) / r.height) * 2 + 1); ray.setFromCamera(vec, cam); const hs = ray.intersectObjects(interact, false); hov = hs.length ? hs[0].object : null; }
    if (hov !== hovPrev) { hovPrev = hov; canvas.style.cursor = hov ? 'pointer' : 'grab'; }
    if (onHover) { if (hov) { const p = new THREE.Vector3(); hov.getWorldPosition(p); p.y += (hov.geometry?.parameters?.height || 1) + 1.2; const sp = p.project(cam); const r = canvas.getBoundingClientRect(); onHover(hov.userData.tag, { x: r.left + (sp.x + 1) / 2 * r.width, y: r.top + (1 - sp.y) / 2 * r.height }); } else onHover(null); }
    R.render(scene, cam);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  const ro = new ResizeObserver(() => resize()); ro.observe(canvas);
  return {
    resize, irA,
    destruir() { viva = false; ro.disconnect(); window.removeEventListener('keydown', onKey); window.removeEventListener('keyup', onKey); scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) { (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { if (m.map) m.map.dispose(); m.dispose(); }); } }); R.dispose(); },
  };
}
