// Acteck Ciudad · edificios: oficina, CEDIS y puerto de Acteck, y un distrito (manzana con tiendas) por ciudad.
// Cada función recibe el contexto de la escena (ctx) y regresa la posición que usan cámara y carreteras.
import * as THREE from 'three';
import { COLOR_CUENTA, DETALLE, encimaDelCampus, juntarCapas, pinCiudad, acomodoRacks, acomodoEscritorios, burbujasAtencion, pensamientos, cuotaRitmo, CAPA_TONOS, celebraciones, eventosCalendario, ventanasOficina } from '../modelo.js';
import { ACC } from './luz-clima.js';
import { arbol, carretera } from './terreno.js';
import { persona, caminar } from './gente.js';
import { etiqueta, fmtK, capital } from './etiquetas.js';
import { instanciar, geo } from './instancias.js';

// Oficina + sala de juntas + equipo caminando entre oficina, sala y CEDIS.
export function oficina(ctx) {
  const { P, M, G, box, add, oscuro, modelo, esc, animados } = ctx;
  const ofiPos = { ...(ctx.campus?.oficina || { x: esc.x - 7, z: esc.z + 2 }) };
  const g = new THREE.Group(); g.position.set(ofiPos.x, 0, ofiPos.z);
  const base = box(14, .5, 14, P.banqueta); g.add(base);
  // Cascarón (cuerpo, techo, letrero, ventanas, puerta y la sala de juntas) en su propio grupo: «Entrar» lo oculta (3.90.38).
  const casco = new THREE.Group(); g.add(casco);
  const cuerpo = new THREE.Mesh(cajaBiselada(9, 9, 7, .3), M(P.oficina)); cuerpo.castShadow = cuerpo.receiveShadow = true; cuerpo.position.set(0, 4.75, 0); casco.add(cuerpo); // biselada (3.90.70)
  const techo = box(9.8, .6, 7.8, P.oficinaTecho); techo.position.set(0, 9.6, 0); casco.add(techo);
  const letrero = box(5, .9, .3, ACC.azul, { emissive: ACC.azul, emissiveIntensity: oscuro ? 1.6 : .35 }); letrero.position.set(0, 10.4, 3.6); casco.add(letrero);
  const vm = M(P.ventana, { roughness: .4 }); const vOn = M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.4 : .15, roughness: .4 });
  const prendidas = ventanasOficina(modelo.oficina?.personas || [], 12); // según quién está en la oficina (3.90.70)
  for (let f = 0; f < 3; f++) for (let i = 0; i < 4; i++) { const v = new THREE.Mesh(G(1.2, 1.4, .12), prendidas[f * 4 + i] ? vOn : vm); v.userData.detalle = 'fino'; v.position.set(-3 + i * 2, 1.8 + f * 2.8, 3.56); casco.add(v); const v2 = v.clone(); v2.rotation.y = Math.PI / 2; v2.position.set(4.56, 1.8 + f * 2.8, -2.2 + i * 1.5); casco.add(v2); } // ventanas: sin instanciar desde 3.90.38 (se ocultan con el cascarón al «Entrar»)
  const puerta = new THREE.Mesh(G(1.6, 2.2, .12), M(0x5A4636)); puerta.position.set(0, 1.35, 3.56); casco.add(puerta);
  // sala de juntas (anexo bajo) que se enciende con reunión
  const sala = box(4.5, 3.2, 4.5, P.oficina); sala.position.set(-6, 1.85, -3); casco.add(sala);
  const salaTecho = box(5, .4, 5, P.oficinaTecho); salaTecho.position.set(-6, 3.65, -3); casco.add(salaTecho);
  const salaVent = new THREE.Mesh(G(3, 1.4, .12), modelo.oficina.reunionEnCurso ? vOn : vm); salaVent.position.set(-6, 1.9, -.7); casco.add(salaVent);
  if (oscuro && modelo.oficina.reunionEnCurso) { const l = new THREE.PointLight(0xFFD66B, 1.4, 14); l.position.set(-6, 3, .5); g.add(l); }
  for (const [x, z] of [[6, 5.5], [-6, 5.5], [6.2, -5.8]]) arbol(ctx, g, x, z, 1.1);
  add(g, { tipo: 'oficina', titulo: 'Oficina Acteck', sub: `${modelo.oficina.personas.length + modelo.oficina.genericos} personas · ${modelo.oficina.reuniones} reunión${modelo.oficina.reuniones === 1 ? '' : 'es'} hoy`, pagina: 'agenda' });
  try { interiorOficina(ctx, g, casco, ofiPos); } catch (e) { console.warn('[ciudad] interior oficina', e); } // capa nueva: si falla, la oficina sigue cerrada
  // gente: equipo con nombre + genéricos, caminando entre oficina, sala y CEDIS
  const rutasOf = [[0, 5.5], [-6, 1.2], [3, 7], [9, 2], [12, -3], [0, 5.5]];
  const todos = [...modelo.oficina.personas.map((p) => ({ ...p, generico: false })), ...Array.from({ length: modelo.oficina.genericos }, (_, i) => ({ nombre: ['Ventas', 'Almacén', 'Administración'][i % 3], generico: true, rol: ['comercial', 'almacen', 'finanzas'][i % 3] }))];
  // presencia (3.90.40, como Gather): de viaje no aparece en la base; en reunión se queda de pie junto a la sala de juntas
  let enSala = 0;
  todos.forEach((p, i) => {
    const pr = p.presencia?.estado; if (pr === 'viaje') return;
    const col = { direccion: ACC.azul, comercial: ACC.morado, finanzas: ACC.verde, almacen: ACC.naranja }[p.rol] || ACC.gris;
    const per = persona(ctx, col, p.generico ? .9 : 1); per.position.set(ofiPos.x + rutasOf[0][0], .5, ofiPos.z + rutasOf[0][1]);
    add(per, { tipo: 'persona', titulo: p.nombre, sub: p.generico ? 'equipo' : pr === 'reunion' ? `en reunión: ${p.presencia.titulo}` : (p.actividad ? `ahora: ${p.actividad}` : `${p.pendientes} pendiente${p.pendientes === 1 ? '' : 's'} hoy · ${p.hechas} hecha${p.hechas === 1 ? '' : 's'}`), pagina: 'agenda', persona: p });
    if (pr === 'reunion') { const k = enSala++; per.position.set(ofiPos.x - 7 + (k % 4) * .9, .5, ofiPos.z - .2 + Math.floor(k / 4) * .9); per.rotation.y = Math.PI; return; }
    const fase = i * 1.37, vel = .22 + (i % 3) * .05;
    animados.push((t) => caminar(per, rutasOf, t * vel + fase, ofiPos));
  });
  return ofiPos;
}

// Interior de la oficina (3.90.38): piso, un escritorio por persona (nombre y pendiente principal, tocable con su tarjeta) y la mesa
// de la sala de juntas con las reuniones de hoy. Nace oculto; `ctx.oficinaAdentro(true)` oculta el cascarón y lo muestra.
function interiorOficina(ctx, g, casco, ofiPos) {
  const { box, add, raiz, modelo } = ctx;
  const dentro = []; const etiquetas = []; const fotos = [];
  const piso = box(8.6, .06, 6.6, 0xE4DED2); piso.position.set(0, .53, 0); g.add(piso); dentro.push(piso);
  const gente = (modelo.oficina?.personas || []);
  acomodoEscritorios(gente.length, { ancho: 6, largo: 4.4, cols: 4 }).forEach((pos, i) => {
    const p = gente[i]; const eg = new THREE.Group(); eg.position.set(ofiPos.x + pos.x, .56, ofiPos.z + pos.z);
    const mesa = box(1.5, .08, .8, 0xC9A27A); mesa.position.set(0, .72, 0); eg.add(mesa);
    for (const [x, z] of [[-.65, -.32], [.65, -.32], [-.65, .32], [.65, .32]]) { const pata = box(.07, .72, .07, 0x6B5A48); pata.position.set(x, .36, z); eg.add(pata); }
    const monitor = box(.7, .45, .05, 0x1D1D1F); monitor.position.set(0, 1.02, -.25); eg.add(monitor);
    const silla = box(.5, .5, .5, p.presencia?.estado === 'viaje' ? 0xD5D9E0 : p.presencia?.estado === 'reunion' ? ACC.morado : p.actividad ? ACC.verde : p.pendientes ? ACC.naranja : ACC.gris); silla.position.set(0, .25, .65); eg.add(silla);
    add(eg, { tipo: 'persona', titulo: p.nombre, sub: p.presencia?.estado === 'viaje' ? `de viaje: ${p.presencia.titulo}` : p.actividad ? `pendiente principal: ${p.actividad}` : `${p.pendientes} pendiente${p.pendientes === 1 ? '' : 's'} hoy · ${p.hechas} hecha${p.hechas === 1 ? '' : 's'}`, pagina: 'agenda', persona: p });
    eg.traverse((o) => { if (o.isMesh) dentro.push(o); });
    const foto = fotoPersona(p, ACC); foto.position.set(eg.position.x, 2.05, eg.position.z - .25); foto.visible = false; raiz.add(foto); fotos.push(foto); // 3.90.39: foto (o inicial) sobre el escritorio
    const et = etiqueta(ctx, String(p.nombre || '').split(' ')[0], '#1D1D1F'); et.position.set(eg.position.x, 3.4, eg.position.z); et.userData.prioridad = 2; et.userData.minZoom = -1; raiz.add(et); etiquetas.push(et);
  });
  // sala de juntas: mesa con sillas bajo el techo del anexo (que se oculta con el cascarón)
  const ag = modelo.oficina?.agenda || []; const enCurso = ag.some((r) => r.estado === 'en curso');
  const sg = new THREE.Group(); sg.position.set(ofiPos.x - 6, .25, ofiPos.z - 3);
  const pisoSala = box(4.5, .06, 4.5, 0xE4DED2); pisoSala.position.set(0, .28, 0); sg.add(pisoSala);
  const mesa = box(2.6, .1, 1.3, 0x8A6A4E); mesa.position.set(0, .8, 0); sg.add(mesa);
  const pie = box(.3, .75, .3, 0x5A4636); pie.position.set(0, .4, 0); sg.add(pie);
  for (const [x, z] of [[-.8, -1], [0, -1], [.8, -1], [-.8, 1], [0, 1], [.8, 1]]) { const s2 = box(.45, .5, .45, enCurso ? ACC.naranja : 0x9AA3B2); s2.position.set(x, .25, z); sg.add(s2); }
  const prox = ag.find((r) => r.estado !== 'hecha');
  add(sg, { tipo: 'sala', titulo: 'Sala de juntas', sub: !ag.length ? 'sin reuniones hoy' : prox ? `${prox.estado === 'en curso' ? 'ahora' : prox.hora}: ${prox.titulo}` : `${ag.length} reunión${ag.length === 1 ? '' : 'es'} hoy · todas hechas`, pagina: 'agenda' });
  sg.traverse((o) => { if (o.isMesh) dentro.push(o); });
  const mallasCasco = []; casco.traverse((o) => { if (o.isMesh) mallasCasco.push(o); });
  const poner = (on) => {
    casco.visible = !on; for (const o of mallasCasco) o.visible = !on;
    for (const o of dentro) o.visible = on;
    for (const et of etiquetas) et.userData.minZoom = on ? 40 : -1;
    for (const f of fotos) { f.visible = on; if (on) f.userData.cargar?.(); }
  };
  poner(false);
  ctx.oficinaAdentro = poner;
}

// Foto de la persona (3.90.39): círculo con su inicial (color de su rol) y, la primera vez que se entra a la oficina, su
// `avatar_url` encima. Si la imagen no carga (CORS, 404) se queda la inicial.
function fotoPersona(p, ACC) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d');
  const col = { direccion: ACC.azul, comercial: ACC.morado, finanzas: ACC.verde, almacen: ACC.naranja }[p.rol] || ACC.gris;
  g2.fillStyle = `#${new THREE.Color(col).getHexString()}`; g2.beginPath(); g2.arc(64, 64, 60, 0, Math.PI * 2); g2.fill();
  g2.fillStyle = '#FFFFFF'; g2.font = 'bold 64px -apple-system, system-ui, sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(String(p.nombre || '?').trim().charAt(0).toUpperCase() || '?', 64, 68);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: true })); sp.scale.set(1, 1, 1);
  let pedida = false;
  sp.userData.cargar = () => {
    if (pedida || !p.avatar) return; pedida = true;
    const img = new Image(); img.crossOrigin = 'anonymous';
    img.onload = () => { try { g2.save(); g2.beginPath(); g2.arc(64, 64, 60, 0, Math.PI * 2); g2.clip(); const k = Math.max(128 / img.width, 128 / img.height); g2.drawImage(img, 64 - img.width * k / 2, 64 - img.height * k / 2, img.width * k, img.height * k); g2.restore(); tex.needsUpdate = true; } catch { /* lienzo contaminado: se queda la inicial */ } };
    img.src = p.avatar;
  };
  return sp;
}

// Burbujas de atención (etapa 4, paso 2, 3.90.44): un globo con icono sobre el edificio que pide atención (reglas en
// `burbujasAtencion`), rojo o ámbar, flotando. Tocarlo abre la tarjeta del edificio con el motivo como subtítulo.
const BURBUJA = { banco: { titulo: 'Banco', pagina: 'pagos', y: 9 }, puerto: { titulo: 'Puerto de Manzanillo', pagina: 'inventarioGlobal', y: 11 }, oficina: { titulo: 'Oficina Acteck', pagina: 'agenda', y: 14 }, cedis: { titulo: 'CEDIS', pagina: 'ordenesCompra', y: 12.5 } };
export function burbujas(ctx, posiciones) {
  const { add, modelo, animados } = ctx;
  burbujasAtencion(modelo, new Date()).forEach((b, i) => {
    const pos = posiciones[b.lugar]; const cfg = BURBUJA[b.lugar]; if (!pos || !cfg) return;
    const c = document.createElement('canvas'); c.width = c.height = 128; const g2 = c.getContext('2d');
    g2.fillStyle = b.nivel === 'rojo' ? '#FF453A' : '#FF9F0A'; g2.beginPath(); g2.arc(64, 56, 50, 0, Math.PI * 2); g2.fill();
    g2.beginPath(); g2.moveTo(48, 98); g2.lineTo(80, 98); g2.lineTo(64, 124); g2.closePath(); g2.fill(); // piquito hacia el edificio
    g2.fillStyle = '#FFFFFF'; g2.beginPath(); g2.arc(64, 56, 38, 0, Math.PI * 2); g2.fill();
    g2.font = '44px -apple-system, "Apple Color Emoji", "Segoe UI Emoji", sans-serif'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(b.icono, 64, 60);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.renderOrder = 5; sp.scale.set(3, 3, 1);
    const y0 = cfg.y; sp.position.set(pos.x, y0, pos.z);
    const tag = { tipo: b.lugar, titulo: cfg.titulo, sub: `${b.nivel === 'rojo' ? 'Urgente' : 'Atención'}: ${b.texto}`, pagina: cfg.pagina };
    add(sp); sp.userData.tag = tag; ctx.interact.push(sp); // add() sólo etiqueta mallas: el sprite se registra a mano para poder tocarlo
    animados.push((t) => { sp.position.y = y0 + Math.sin(t * 2 + i) * .35; });
  });
}

// Pensamientos (etapa 4, paso 2, 3.90.52): nube blanca con la frase de `pensamientos()` sobre la tienda (borde del tono,
// burbujitas de «pensar» hacia abajo), flotando. Pocas a la vez; tocarla abre la tarjeta de la tienda.
const TONO_PENSAR = { rojo: '#FF453A', ambar: '#FF9F0A', verde: '#30D158' };
// Celebraciones (etapa 6, 3.90.62): fuegos artificiales sobre la base si la cuota del mes ya se cruzó y confeti cayendo sobre
// las tiendas que volvieron a vender (`celebraciones()`); puntos baratos (un Points por efecto), sin tag, discretos.
export function celebrar(ctx, basePos) {
  const { raiz, modelo, animados } = ctx; const c = celebraciones(modelo, 5);
  const puntos = (n, f, colores, tam) => { const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); const tmp = new THREE.Color();
    for (let i = 0; i < n; i++) { const [x, y, z] = f(i); pos.set([x, y, z], i * 3); tmp.set(colores[i % colores.length]); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return new THREE.Points(g, new THREE.PointsMaterial({ size: tam, vertexColors: true, transparent: true, depthWrite: false })); };
  if (c.cuota && basePos) for (let k = 0; k < 3; k++) { // tres cohetes desfasados: estallan, se abren y se apagan
    const p = puntos(40, () => { const u = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, r = Math.sqrt(1 - u * u); return [r * Math.cos(a), u, r * Math.sin(a)]; }, [[0xFF453A, 0xFFD60A], [0x30D158, 0x0A84FF], [0xBF5AF2, 0xFF9F0A]][k], 1.1);
    const cx = basePos.x + (k - 1) * 7, cz = basePos.z - 4 + (k % 2) * 5; p.renderOrder = 7; raiz.add(p);
    animados.push((t) => { const f = (t / 2.6 + k / 3) % 1; p.position.set(cx, 16 + k * 2 - f * 2, cz); p.scale.setScalar(.3 + f * 4.5); p.material.opacity = f < .15 ? f / .15 : 1 - (f - .15) / .85; });
  }
  c.tiendas.forEach((t, i) => { // confeti en bucle sobre la tienda que volvió a vender
    const pos = ctx.tiendaPos?.get(`${t.cuenta}|${t.sucursal}`); if (!pos) return;
    const p = puntos(36, () => [(Math.random() - .5) * 2.6, Math.random() * 3, (Math.random() - .5) * 2.6], [0xFF453A, 0xFFD60A, 0x30D158, 0x0A84FF, 0xBF5AF2], .45);
    p.userData.detalle = 'fino'; raiz.add(p);
    animados.push((tt) => { const f = (tt / 3 + i * .37) % 1; p.position.set(pos.x, 3 + (1 - f) * 2.5, pos.z); p.rotation.y = tt * .8 + i; p.material.opacity = f > .8 ? (1 - f) / .2 : 1; });
  });
}

// Calendario comercial en la escena (etapa 6, 3.90.66): letrero flotante con la cuenta regresiva del cierre de mes sobre la
// base, banderín «BUEN FIN» sobre cada ciudad con tiendas que venden (máx. 8, de cerca) y una guirnalda de foquitos alrededor de la base
// en temporada navideña. La fecha es la de la barra de tiempo (`modelo.momento`) o hoy. Sin tags: sólo decoración.
export function calendario(ctx, basePos) {
  const { raiz, modelo, animados } = ctx; const f = modelo?.momento?.fecha ? new Date(modelo.momento.fecha) : new Date();
  const ev = new Map(eventosCalendario(f).map((e) => [e.id, e]));
  const flota = (sp, x, y, z, fase) => { sp.position.set(x, y, z); raiz.add(sp); animados.push((t) => { sp.position.y = y + Math.sin(t * 1.4 + fase) * .3; }); };
  const cierre = ev.get('cierre');
  if (cierre && basePos) { const sp = etiqueta(ctx, `${cierre.icono} ${cierre.texto}`, cierre.nivel ? '#FF9F0A' : '#1D1D1F'); sp.userData.prioridad = 5; flota(sp, basePos.x, 19, basePos.z + 2, 0); }
  if (ev.has('buenfin')) (modelo.distritos || []).filter((d) => d.tiendas.some((t) => t.vendio && !t.virtual)).slice(0, 8).forEach((d, i) => { // un banderín por ciudad con tiendas que venden
    const ps = d.tiendas.map((t) => ctx.tiendaPos?.get(`${t.cuenta}|${t.sucursal}`)).filter(Boolean); if (!ps.length) return;
    const sp = etiqueta(ctx, '🏷️ BUEN FIN', '#FF453A'); sp.userData.minZoom = 60; sp.userData.prioridad = 1.5;
    flota(sp, ps.reduce((a, p) => a + p.x, 0) / ps.length, 8.5, ps.reduce((a, p) => a + p.z, 0) / ps.length, i);
  });
  if (ev.has('navidad') && basePos) {
    const n = 90, pos = new Float32Array(n * 3), col = new Float32Array(n * 3), tmp = new THREE.Color(), cs = [0xFF453A, 0x30D158, 0xFFD60A, 0x0A84FF];
    for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; pos.set([basePos.x + Math.cos(a) * 9, 1.2 + Math.sin(i * 1.7) * .2, basePos.z + Math.sin(a) * 7.5], i * 3); tmp.set(cs[i % cs.length]); col.set([tmp.r, tmp.g, tmp.b], i * 3); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const p = new THREE.Points(g, new THREE.PointsMaterial({ size: 5, sizeAttenuation: false, vertexColors: true, transparent: true, depthWrite: false })); p.userData.detalle = 'fino'; raiz.add(p);
    animados.push((t) => { p.material.opacity = .65 + Math.sin(t * 3) * .35; });
  }
}

export function pensar(ctx) {
  const { add, modelo, animados } = ctx;
  pensamientos(modelo, 5).forEach((p, i) => {
    const pos = ctx.tiendaPos?.get(`${p.cuenta}|${p.sucursal}`); if (!pos) return;
    const c = document.createElement('canvas'); const g2 = c.getContext('2d'); const fuente = '600 30px -apple-system, "Segoe UI", sans-serif';
    g2.font = fuente; const w = Math.min(560, Math.ceil(g2.measureText(p.texto).width) + 44); c.width = w; c.height = 110;
    const borde = TONO_PENSAR[p.tono] || '#8E8E93';
    g2.fillStyle = '#FFFFFF'; g2.strokeStyle = borde; g2.lineWidth = 5;
    g2.beginPath(); g2.roundRect(4, 4, w - 8, 62, 30); g2.fill(); g2.stroke();
    for (const [cx, cy, r] of [[w / 2 - 10, 80, 9], [w / 2 - 22, 98, 6]]) { g2.beginPath(); g2.arc(cx, cy, r, 0, Math.PI * 2); g2.fill(); g2.stroke(); }
    g2.font = fuente; g2.fillStyle = '#1D1D1F'; g2.textAlign = 'center'; g2.textBaseline = 'middle'; g2.fillText(p.texto, w / 2, 36, w - 36);
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); sp.renderOrder = 5;
    const alto = 2.6; sp.scale.set(alto * w / 110, alto, 1);
    const y0 = 4.4; sp.position.set(pos.x, y0, pos.z);
    add(sp); sp.userData.tag = { tipo: 'tienda', titulo: p.nombre, sub: `«${p.texto}»`, ciudad: p.ciudad, cuenta: p.cuenta, sucursal: p.sucursal, pagina: 'sellOut' }; ctx.interact.push(sp);
    animados.push((t) => { sp.position.y = y0 + Math.sin(t * 1.6 + i * 1.3) * .2; });
  });
}

// Banco/tesorería (3.90.28): edificio de columnas al norte del estacionamiento; bandera roja si hay pagos vencidos o cartera vencida.
export function banco(ctx) {
  const { P, G, M, box, add, oscuro, modelo, esc } = ctx;
  const b = ctx.campus?.banco || { x: esc.x - 9, z: esc.z - 18.5, ancho: 11, largo: 7 }; const r = modelo.banco || {};
  const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
  g.add(box(b.ancho, .5, b.largo, P.banqueta));
  const escalon = box(7.4, .35, 1.2, P.oficinaTecho); escalon.position.set(0, .68, 2.3); g.add(escalon);
  const cuerpo = box(6.4, 3.6, 3.6, P.oficina); cuerpo.position.set(0, 2.3, -.4); g.add(cuerpo);
  const col = M(P.oficina, { roughness: .6 });
  for (let i = 0; i < 5; i++) { const c = new THREE.Mesh(G(.45, 3.2, .45), col); c.position.set(-2.8 + i * 1.4, 2.45, 1.75); c.userData.detalle = 'fino'; g.add(c); instanciar(ctx, c); }
  const friso = box(7, .5, 4.9, P.oficinaTecho); friso.position.set(0, 4.3, .2); g.add(friso);
  const remate = box(4.6, .55, 3.4, P.oficinaTecho); remate.position.set(0, 4.82, .2); g.add(remate); // frontón escalonado
  const alerta = r.pagosVencidos > 0 || r.carteraVencida > 0;
  const letrero = box(3.4, .7, .25, alerta ? ACC.rojo : ACC.verde, { emissive: alerta ? ACC.rojo : ACC.verde, emissiveIntensity: oscuro ? 1.5 : .3 }); letrero.position.set(0, 3.55, 1.95); g.add(letrero);
  if (alerta) { const asta = box(.12, 2.4, .12, 0x8E8E93); asta.position.set(2.6, 6.2, -.8); g.add(asta); const bandera = box(1.2, .7, .06, ACC.rojo, { emissive: ACC.rojo, emissiveIntensity: oscuro ? 1.2 : .2 }); bandera.position.set(3.2, 7, -.8); g.add(bandera); }
  for (const [x, z] of [[-4.6, 2.4], [4.6, 2.4]]) arbol(ctx, g, x, z, .9);
  const pesos = (v) => `$${fmtK(v)}`;
  add(g, { tipo: 'banco', titulo: 'Banco · Tesorería', sub: `cartera vencida ${pesos(r.carteraVencida || 0)} · ${r.pagosSemana || 0} pago${r.pagosSemana === 1 ? '' : 's'} esta semana${r.pagosVencidos ? ` · ${r.pagosVencidos} vencido${r.pagosVencidos === 1 ? '' : 's'}` : ''}`, pagina: 'pagos' });
  return { x: b.x, z: b.z };
}

// Torre de pronóstico (3.90.29): torre de control delgada con antena; la luz de arriba parpadea con el estado del forecast.
export function torre(ctx) {
  const { P, box, add, oscuro, modelo, esc, animados } = ctx;
  const b = ctx.campus?.torre || { x: esc.x + 4, z: esc.z - 16.5, ancho: 6, largo: 6 }; const r = modelo.torre || {};
  const g = new THREE.Group(); g.position.set(b.x, 0, b.z);
  g.add(box(b.ancho, .5, b.largo, P.banqueta));
  const fuste = box(2.2, 10, 2.2, P.oficina); fuste.position.y = 5.5; g.add(fuste);
  const mirador = box(3.6, 1.6, 3.6, P.ventana, { roughness: .35 }); mirador.position.y = 11.3; g.add(mirador);
  const techo = box(4, .4, 4, P.oficinaTecho); techo.position.y = 12.3; g.add(techo);
  const antena = box(.14, 2.6, .14, 0x8E8E93); antena.position.y = 13.8; g.add(antena);
  const color = r.atrasados > 0 ? ACC.rojo : r.arribos7 > 0 ? ACC.naranja : ACC.verde;
  const foco = box(.5, .5, .5, color, { emissive: color, emissiveIntensity: oscuro ? 1.8 : .6 }); foco.position.y = 15.2; g.add(foco);
  animados.push((t) => { foco.visible = Math.sin(t * 3) > -.3; }); // parpadeo suave
  arbol(ctx, g, 2.2, 2.2, .8);
  add(g, { tipo: 'torre', titulo: 'Torre de pronóstico', sub: `${r.abiertas || 0} propuesta${r.abiertas === 1 ? '' : 's'} abierta${r.abiertas === 1 ? '' : 's'} · ${r.arribos7 || 0} arribo${r.arribos7 === 1 ? '' : 's'} en 7 días${r.atrasados ? ` · ${r.atrasados} atrasado${r.atrasados === 1 ? '' : 's'}` : ''}`, pagina: 'forecastReservas' });
  return { x: b.x, z: b.z };
}

// CEDIS: nave, racks, tarimas descargando y montacargas.
export function cedis(ctx) {
  const { P, M, G, box, add, oscuro, modelo, esc, animados } = ctx;
  const cedisPos = { ...(ctx.campus?.cedis || { x: esc.x + 9, z: esc.z - 2 }) };
  const g = new THREE.Group(); g.position.set(cedisPos.x, 0, cedisPos.z);
  g.add(box(22, .5, 16, P.banqueta));
  // Cascarón (nave, techo, claraboyas, portones, ventanas y rótulo) en su propio grupo: «Entrar» lo oculta y deja ver los racks por marca (3.90.31).
  const casco = new THREE.Group(); g.add(casco);
  const nave = new THREE.Mesh(cajaBiselada(16, 6, 11, .3), M(P.cedis)); nave.castShadow = nave.receiveShadow = true; nave.position.set(0, 3.25, -1); casco.add(nave); // biselada (3.90.70)
  const techo = box(17, .7, 12, P.cedisTecho); techo.position.set(0, 6.6, -1); casco.add(techo);
  for (let i = 0; i < 3; i++) { const cl = box(2.2, .4, 3, P.cedisTecho); cl.position.set(-5 + i * 5, 7.1, -1); casco.add(cl); } // sin instanciar: se ocultan con el cascarón
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(G(2.4, 2.6, .14), M(0x4A4F5C)); p.position.set(-5 + i * 5, 1.5, 4.57); casco.add(p); }
  for (let i = 0; i < 6; i++) { const v = new THREE.Mesh(G(1.6, .8, .12), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.2 : .12, roughness: .4 })); v.userData.detalle = 'fino'; v.position.set(-6.5 + i * 2.6, 4.6, 4.57); casco.add(v); }
  const rotulo = box(5.5, .9, .25, ACC.azul, { emissive: ACC.azul, emissiveIntensity: oscuro ? 1.6 : .35 }); rotulo.position.set(0, 7.4, 4.6); casco.add(rotulo);
  // racks al frente (altura por días de inventario) y tarimas descargando
  for (let i = 0; i < modelo.cedis.racks; i++) { const col = i % 2 ? 0xC58A3A : 0xD49A4A; for (let k = 0; k < 1 + (i % 3); k++) { const c = box(1.3, 1, 1.3, col); c.position.set(-9 + (i % 5) * 2.2, .75 + k * 1.05, 6.5 + Math.floor(i / 5) * 2); g.add(c); instanciar(ctx, c); } } // racks, claraboyas y portones: InstancedMesh con el tag del CEDIS (3.90.20)
  modelo.puerto.tarimas.slice(0, 6).forEach((tp, i) => { const c = box(1.3, 1, 1.3, 0xA86A2E); c.position.set(6 + (i % 3) * 2, .75, 6 + Math.floor(i / 3) * 2); c.userData.detalle = 'fino'; g.add(c); instanciar(ctx, c, { tipo: 'barco', id: tp.id, titulo: `Contenedor ${tp.id}`, sub: `descargando · ${(Number(tp.piezas) || 0).toLocaleString('es-MX')} pz`, pagina: 'inventarioGlobal' }); }); // tarimas: capa fina (3.90.7); cada una tocable con la tarjeta del contenedor (3.90.36)
  for (const [x, z] of [[-10.5, -6.5], [10.5, -6.5]]) arbol(ctx, g, x, z, 1.2);
  add(g, { tipo: 'cedis', titulo: 'CEDIS', sub: `$${(modelo.cedis.valor / 1e6).toFixed(1)} M · ${Math.round(modelo.cedis.dias)} días · ${modelo.puerto.tarimas.length} contenedor${modelo.puerto.tarimas.length === 1 ? '' : 'es'} descargando`, pagina: 'inventarioGlobal' });
  try { interiorCedis(ctx, g, casco, cedisPos); } catch (e) { console.warn('[ciudad] interior CEDIS', e); } // capa nueva: si falla, el CEDIS sigue cerrado
  // montacargas
  const mc = new THREE.Group(); const cuerpo = box(1.6, 1, 1.1, ACC.naranja); mc.add(cuerpo); const mastil = box(.2, 2.2, .2, 0x444444); mastil.position.set(.9, 1.1, 0); mc.add(mastil); const carga = box(1, .8, 1, 0xC58A3A); carga.position.set(1.4, .6, 0); mc.add(carga);
  [[-.5, .5], [-.5, -.5], [.5, .5], [.5, -.5]].forEach(([x, z]) => { const r = new THREE.Mesh(geo(ctx, 'ruedaMc', () => new THREE.CylinderGeometry(.3, .3, .25, 10)), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .3, z); mc.add(r); });
  mc.traverse((o) => { if (o.isMesh) instanciar(ctx, o, null, true); }); // montacargas: instancias dinámicas (3.90.22)
  mc.position.set(cedisPos.x - 2, 0, cedisPos.z + 5); const salidas = Number(modelo.cedis.salidasHoy) || 0; add(mc, { tipo: 'montacargas', titulo: 'Montacargas', sub: salidas ? `moviendo tarimas · ${salidas} salida${salidas === 1 ? '' : 's'} hoy` : 'estacionado · sin salidas hoy', pagina: 'inventarioGlobal' });
  if (salidas) animados.push((t) => { const p = (t * .18) % 1; const x = cedisPos.x - 6 + Math.abs(Math.sin(p * Math.PI * 2)) * 12; mc.position.x = x; mc.rotation.y = Math.cos(p * Math.PI * 2) > 0 ? 0 : Math.PI; });
  return cedisPos;
}

// Interior del CEDIS (3.90.31): piso y un rack por marca (`modelo.cedis.racksMarca`, top 8 + «otras») con niveles de cajas según su
// inventario y etiqueta; tocable con su tarjeta. Todo nace oculto; `ctx.cedisAdentro(true)` oculta el cascarón y lo muestra.
// Las mallas se ocultan una por una (no sólo el grupo) porque el raycast de interaccion.js descarta por `visible` de cada malla.
const COL_RACK = [0x0A84FF, 0xFF9F0A, 0x30D158, 0xBF5AF2, 0xFF453A, 0x5AC8FA, 0xFFD60A, 0x64D2FF, 0x8E8E93];
function interiorCedis(ctx, g, casco, cedisPos) {
  const { P, box, add, raiz, modelo } = ctx;
  const racks = acomodoRacks(modelo.cedis?.racksMarca, { ancho: 14, largo: 8.4, cols: 3, maxNiveles: 5 });
  const dentro = []; const etiquetas = [];
  const piso = box(15.6, .06, 10.6, 0xD9D4C7); piso.position.set(0, .53, -1); g.add(piso); dentro.push(piso);
  racks.forEach((r, i) => {
    const rg = new THREE.Group(); rg.position.set(cedisPos.x + r.x, .56, cedisPos.z - 1 + r.z);
    const alto = r.niveles * .95 + .2;
    for (const [x, z] of [[-1.25, -.5], [1.25, -.5], [-1.25, .5], [1.25, .5]]) { const poste = box(.12, alto, .12, 0x3A4A6B); poste.position.set(x, alto / 2, z); rg.add(poste); }
    for (let k = 0; k < r.niveles; k++) {
      const repisa = box(2.6, .08, 1.1, 0xE58A2E); repisa.position.set(0, .1 + k * .95, 0); rg.add(repisa);
      const caja = box(2.2, .7, .9, COL_RACK[i % COL_RACK.length]); caja.position.set(0, .5 + k * .95, 0); rg.add(caja);
    }
    add(rg, { tipo: 'rack', marca: r.marca, titulo: capital(r.marca), sub: `$${fmtK(r.valor)} · ${r.dias == null ? 'sin demanda' : `${r.dias} días`} · ${r.skus} SKU${r.skus === 1 ? '' : 's'}${r.marcas ? ` de ${r.marcas} marcas` : ''}`, pagina: 'inventarioGlobal' });
    rg.traverse((o) => { if (o.isMesh) dentro.push(o); });
    const et = etiqueta(ctx, capital(r.marca), '#1D1D1F'); et.position.set(rg.position.x, .56 + alto + 1, rg.position.z); et.userData.prioridad = 2; et.userData.minZoom = -1; raiz.add(et); etiquetas.push(et);
  });
  const mallasCasco = []; casco.traverse((o) => { if (o.isMesh) mallasCasco.push(o); });
  const poner = (on) => {
    casco.visible = !on; for (const o of mallasCasco) o.visible = !on;
    for (const o of dentro) o.visible = on;
    for (const et of etiquetas) et.userData.minZoom = on ? 40 : -1; // fuera: nunca (escalarEtiquetas compara con el zoom)
  };
  poner(false);
  ctx.cedisAdentro = poner; ctx.hayRacks = racks.length > 0;
}

// Campus de la base: calles con banqueta y raya punteada (avenida al frente, calle interior entre oficina y CEDIS) y el
// patio de maniobras al oriente del CEDIS con 3 andenes; en cada andén se forma un tráiler por factura reciente (hasta 3).
// Detalle: estacionamiento (un coche por persona del equipo), barda, jardín y faroles; lo chico va en la capa fina.
export function campusCalles(ctx, cedisPos) {
  const { P, M, G, box, add, raiz, modelo, campus: c } = ctx;
  if (!c) return;
  const g = new THREE.Group();
  for (const k of c.calles) {
    const dx = k.b.x - k.a.x, dz = k.b.z - k.a.z, L = Math.hypot(dx, dz); if (!L) continue;
    const ang = -Math.atan2(dz, dx); const cx = (k.a.x + k.b.x) / 2, cz = (k.a.z + k.b.z) / 2;
    const banq = box(L + 1.2, .22, k.ancho + 1.2, P.banqueta); banq.position.set(cx, .11, cz); banq.rotation.y = ang; banq.castShadow = false; g.add(banq);
    const asf = new THREE.Mesh(G(L, .02, k.ancho), M(P.calle, { roughness: 1 })); asf.position.set(cx, .23, cz); asf.rotation.y = ang; asf.receiveShadow = true; g.add(asf);
    for (let s = 1.2; s < L - .6; s += 2.4) { const r = box(1.1, .02, .14, 0xF2E6C8); r.castShadow = false; r.position.set(k.a.x + dx * s / L, .25, k.a.z + dz * s / L); r.rotation.y = ang; r.userData.detalle = 'fino'; g.add(r); instanciar(ctx, r); }
  }
  raiz.add(g);
  // patio de maniobras: asfalto con cajones pintados, andenes pegados a la nave y tráileres formados
  const pt = c.patio; const pg = new THREE.Group();
  const piso = box(pt.ancho, .22, pt.largo, P.calle); piso.castShadow = false; piso.position.set(pt.x, .11, pt.z); pg.add(piso);
  const cajones = [...pt.andenes.map((z) => z - 2), pt.andenes[pt.andenes.length - 1] + 2];
  for (const z of cajones) { const l = box(7, .02, .14, 0xF2E6C8); l.castShadow = false; l.position.set(pt.x - pt.ancho / 2 + 3.5, .23, cedisPos.z + z); l.userData.detalle = 'fino'; pg.add(l); instanciar(ctx, l); }
  pt.andenes.forEach((z) => {
    const anden = box(3, 1.1, 3, P.banqueta); anden.position.set(cedisPos.x + 9.5, .55, cedisPos.z + z); pg.add(anden); instanciar(ctx, anden);
    const cortina = new THREE.Mesh(G(.14, 2.4, 2.4), M(0x4A4F5C)); cortina.position.set(cedisPos.x + 8.08, 1.7, cedisPos.z + z); pg.add(cortina); instanciar(ctx, cortina); // andenes y cortinas instanciados (3.90.21)
  });
  const formados = Math.min(pt.andenes.length, (modelo.camiones || []).length);
  for (let i = 0; i < formados; i++) {
    const cam = modelo.camiones[i]; const z = cedisPos.z + pt.andenes[i]; const x0 = cedisPos.x + 11;
    const tr = new THREE.Group(); const caja = box(6, 2.4, 2.2, 0xF2F2F2); caja.position.set(x0 + 3.2, 1.6, z); tr.add(caja); instanciar(ctx, caja);
    const cabina = box(1.8, 2, 2.1, ACC.azul); cabina.position.set(x0 + 7.3, 1.2, z); tr.add(cabina); instanciar(ctx, cabina); // tráileres formados: caja y cabina instanciadas, cada una con el tag de su envío
    add(tr, { tipo: 'patio', titulo: 'Patio de maniobras', sub: `cargando para ${cam.cliente} · ${cam.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : capital(cam.ciudad)}${cam.piezas ? ` · ${cam.piezas.toLocaleString('es-MX')} pz` : ''}`, pagina: 'sellIn' });
  }
  add(pg, { tipo: 'patio', titulo: 'Patio de maniobras', sub: `${pt.andenes.length} andenes · ${formados} tráiler${formados === 1 ? '' : 'es'} cargando · ${(modelo.camiones || []).length} envíos recientes`, pagina: 'sellIn' });
  // detalle del campus (3.90.11): estacionamiento con un coche por persona del equipo, barda, jardín y faroles
  const { oscuro } = ctx; const dg = new THREE.Group(); const est = c.estacionamiento;
  const lote = box(est.ancho, .22, est.largo, P.calle); lote.castShadow = false; lote.position.set(est.x, .11, est.z); dg.add(lote);
  const porFila = est.cajones / 2, paso = est.ancho / porFila;
  for (let f = 0; f < 2; f++) for (let k = 0; k <= porFila; k++) { const l = box(.12, .02, 2.6, 0xF2E6C8); l.castShadow = false; l.position.set(est.x - est.ancho / 2 + k * paso, .23, est.z + (f ? 1.9 : -1.9)); l.userData.detalle = 'fino'; dg.add(l); instanciar(ctx, l); }
  const coches = Math.min(est.cajones, (modelo.oficina?.personas?.length || 0) + (modelo.oficina?.genericos || 0));
  for (let i = 0; i < coches; i++) {
    const f = i % 2, k = Math.floor(i / 2); const x = est.x - est.ancho / 2 + paso * (k + .5), z = est.z + (f ? 1.9 : -1.9);
    const col = [0xD9534F, 0xF2F2F2, 0x4A6FA5, 0x6B6E76, 0xE0B04A][i % 5];
    const cuerpo = box(1, .6, 1.8, col); cuerpo.position.set(x, .55, z); dg.add(cuerpo); instanciar(ctx, cuerpo);
    const cab = box(.9, .45, 1, 0x2B3340); cab.position.set(x, 1.05, z + (f ? .15 : -.15)); cab.userData.detalle = 'fino'; dg.add(cab); instanciar(ctx, cab);
  }
  add(dg, { tipo: 'estacionamiento', titulo: 'Estacionamiento Acteck', sub: `${coches} de ${est.cajones} cajones ocupados · el equipo de hoy`, pagina: 'agenda' });
  const bg = new THREE.Group();
  for (const b of c.bardas) { const dx = b.b.x - b.a.x, dz = b.b.z - b.a.z, L = Math.hypot(dx, dz); if (!L) continue; const m = box(L, .9, .25, 0xB9AD96); m.position.set((b.a.x + b.b.x) / 2, .45, (b.a.z + b.b.z) / 2); m.rotation.y = -Math.atan2(dz, dx); bg.add(m); }
  const jd = c.jardin; const pasto = box(jd.ancho, .3, jd.largo, P.cerro); pasto.castShadow = false; pasto.position.set(jd.x, .15, jd.z); bg.add(pasto);
  for (let i = 0; i < 4; i++) arbol(ctx, bg, jd.x + (i % 2 ? .6 : -.6), jd.z - jd.largo / 2 + 2 + i * (jd.largo - 4) / 3, i % 2 ? .7 : .85); // chicos: capa fina
  raiz.add(bg);
  for (const fz of c.faroles) {
    const farol = box(.12, 2.6, .12, 0x6b6e76); farol.position.set(fz.x, 1.3, fz.z); raiz.add(farol);
    const foco = new THREE.Mesh(geo(ctx, 'foco', () => new THREE.SphereGeometry(.22, 8, 6)), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.6 : .2 })); foco.position.set(fz.x, 2.7, fz.z); raiz.add(foco);
    for (const pz of [farol, foco]) { pz.userData.detalle = 'fino'; instanciar(ctx, pz); }
  }
}

// Puerto de Manzanillo: muelle, grúa y contenedores (los barcos viven en vehiculos.js).
export function puerto(ctx) {
  const { P, box, add, modelo } = ctx;
  const puertoPos = modelo.puertoPos;
  const g = new THREE.Group(); g.position.set(puertoPos.x, 0, puertoPos.z);
  const muelle = box(10, .6, 4, P.banqueta); muelle.position.set(0, .3, 2); g.add(muelle);
  const grua = new THREE.Group(); const pata1 = box(.5, 7, .5, ACC.rojo); pata1.position.set(-2, 3.5, 0); const pata2 = pata1.clone(); pata2.position.x = 2; const viga = box(7, .5, .5, ACC.rojo); viga.position.set(0, 7.2, 0); grua.add(pata1, pata2, viga); instanciar(ctx, pata1); instanciar(ctx, pata2); grua.position.set(0, .6, 2); g.add(grua);
  for (let i = 0; i < 3; i++) { const c = box(2.2, 1, 1.2, [ACC.azul, ACC.naranja, ACC.verde][i]); c.position.set(-3 + i * 3, 1.1, 1.2); g.add(c); }
  add(g, { tipo: 'puerto', titulo: 'Puerto de Manzanillo', sub: `${modelo.puerto.barcos.length} contenedores navegando · ${modelo.puerto.totalPiezas.toLocaleString('es-MX')} pz`, pagina: 'inventarioGlobal' });
  return puertoPos;
}

// Distritos: una manzana por ciudad con sus tiendas, clientes finales, vendedores, peatones, etiqueta y carretera desde el CEDIS.
export function distritos(ctx, cedisPos) {
  const { P, M, G, box, add, oscuro, noche, modelo, esc, raiz, interact, animados } = ctx;
  const distritoPos = new Map(); const rutas = new Map();
  const medidas = (n) => { const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(Math.max(1, n) * 1.5)))); const filas = Math.max(1, Math.ceil(n / cols)); return { cols, ancho: cols * 2.7 + 1.6, largo: filas * 2.9 + 1.6 }; };
  // distritos reales que caen sobre el campus o el distrito GDL (3.90.12): capa `mapa`, sólo se ven de lejos
  const dGDL = modelo.distritos.find((d) => d.ciudad === 'GUADALAJARA'); let cajaGDL = null;
  if (dGDL && ctx.campus) { const m = medidas(dGDL.tiendas.length); const p = ctx.campus.distritoGDL(m.ancho, m.largo); cajaGDL = { x0: p.x - m.ancho / 2 - 2.8, x1: p.x + m.ancho / 2, z0: p.z - m.largo / 2, z1: p.z + m.largo / 2 + 4 }; }
  modelo.distritos.forEach((d) => {
    const esGDL = d.ciudad === 'GUADALAJARA';
    const n = d.tiendas.length; const { cols, ancho, largo } = medidas(n);
    const base = esGDL ? (ctx.campus ? ctx.campus.distritoGDL(ancho, largo) : { x: esc.x - 4, z: esc.z + 16 }) : d.pos; // GDL: abajo de la avenida del campus
    const enMapa = !esGDL && encimaDelCampus(ctx.campus, base, ancho, largo, cajaGDL);
    const aMapa = (o) => { if (enMapa) o.traverse((x) => { x.userData.detalle = juntarCapas(x.userData.detalle, 'mapa'); }); return o; };
    distritoPos.set(d.ciudad, { x: base.x, z: base.z, ancho, largo }); // con medidas: la Vista Ciudad las encuadra
    const g = new THREE.Group(); g.position.set(base.x, 0, base.z);
    const piso = box(1, .3, 1, P.banqueta); piso.scale.set(ancho, 1, largo); piso.position.y = .15; g.add(piso); // caja unitaria escalada: todos los pisos van en un InstancedMesh
    piso.userData.tag = { tipo: 'ciudad', titulo: d.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : capital(d.ciudad), sub: `${d.tiendas.filter((t) => t.vendio).length} de ${d.tiendas.length} tiendas vendieron este mes · ${d.cuentas.length} cliente${d.cuentas.length === 1 ? '' : 's'}${d.vendedores.length ? ` · ${d.vendedores.length} vendedores` : ''}`, ciudad: d.ciudad, pagina: 'sellOut', distrito: { ciudad: d.ciudad, tiendas: d.tiendas.map((t) => ({ nombre: `${t.nombreCuenta} · ${t.sucursal}`, vendio: t.vendio, importe: t.importe })) } }; instanciar(ctx, piso); // tocable por su tag en userData.tags (3.90.18)
    const calleH = new THREE.Mesh(new THREE.PlaneGeometry(ancho + 2, 1.4), M(P.calle, { roughness: 1 })); calleH.rotation.x = -Math.PI / 2; calleH.position.set(0, .32, largo / 2 + .9); g.add(calleH); calleH.userData.detalle = 'cerca';
    d.tiendas.forEach((t, i) => {
      const c = i % cols, f = Math.floor(i / cols);
      const x = -ancho / 2 + 2.1 + c * 2.7, z = -largo / 2 + 2.1 + f * 2.9;
      const col = COLOR_CUENTA[t.cuenta] || ACC.gris;
      const tg = new THREE.Group(); tg.position.set(x, .3, z);
      (ctx.tiendaPos ||= new Map()).set(`${t.cuenta}|${t.sucursal}`, { x: base.x + x, z: base.z + z }); // pensamientos (3.90.52)
      const tag = { tipo: 'tienda', titulo: `${t.nombreCuenta} · ${t.sucursal}`, sub: `${t.vendioMes ? `vendió este mes $${fmtK(t.importe)}` : t.vendio ? 'vendió el mes pasado; este mes aún no' : 'sin venta este mes'}${t.previo ? ` · mes anterior $${fmtK(t.previo)}` : ''}${t.vendedores ? ` · ${t.vendedores} vendedores` : ''}${t.cartera && t.cartera.vencido > 0 ? ` · 🚩 cartera vencida $${fmtK(t.cartera.vencido)}` : ''}`, pagina: 'sellOut', cuenta: t.cuenta, sucursal: t.sucursal, ciudad: d.ciudad };
      const cuerpo = new THREE.Mesh(geo(ctx, 'tiendaBisel', () => cajaBiselada(2, 1.9, 2, .12)), M(P.tienda)); cuerpo.castShadow = cuerpo.receiveShadow = true; cuerpo.position.y = .95; tg.add(cuerpo); // kit low-poly (3.90.68): esquinas biseladas
      // ventanas laterales: de noche se prenden (todas si la tienda vendió, una sí y una no si no); de día, vidrio oscuro
      const prendida = (k) => noche && (t.vendio || (i + k) % 2 === 0);
      for (const [k, sx, sz] of [[0, -1, -.45], [1, -1, .45], [2, 1, -.45], [3, 1, .45]]) { const on = prendida(k); const vl = new THREE.Mesh(G(.08, .5, .42), M(on ? P.ventanaOn : P.ventana, { emissive: on ? P.ventanaOn : 0x000000, emissiveIntensity: on ? 1 : 0, roughness: .4 })); vl.position.set(sx * 1.02, 1.15, sz); vl.userData.detalle = 'fino'; tg.add(vl); instanciar(ctx, vl, tag); }
      const techo = box(2.3, .3, 2.3, P.tiendaTecho); techo.position.y = 2.05; tg.add(techo);
      const toldo = box(2.2, .16, .8, col); toldo.position.set(0, 1.5, 1.35); tg.add(toldo);
      const letrero = box(1.5, .34, .12, t.vendio ? col : P.ventana, { emissive: t.vendio ? col : 0x000000, emissiveIntensity: t.vendio ? (oscuro ? 1.6 : .3) : 0 }); letrero.position.set(0, 1.78, 1.06); tg.add(letrero);
      const vit = new THREE.Mesh(G(1.1, .75, .1), M(t.vendio ? P.ventanaOn : P.ventana, { emissive: t.vendio ? P.ventanaOn : 0x000000, emissiveIntensity: t.vendio ? (oscuro ? 1.2 : .1) : 0, roughness: .4 })); vit.position.set(-.3, .75, 1.05); tg.add(vit);
      const puerta = new THREE.Mesh(G(.5, 1.1, .1), M(0x5A4636)); puerta.position.set(.6, .55, 1.05); tg.add(puerta);
      for (const pz of [letrero, vit, puerta]) pz.userData.detalle = 'fino'; // de lejos la tienda es volumen + toldo de color
      // azotea (3.90.69): tinaco negro en unas, antena en otras (por índice, estable entre recargas); de cerca
      if (i % 3 !== 1) { const tin = new THREE.Mesh(geo(ctx, 'tinaco', () => new THREE.CylinderGeometry(.24, .24, .42, 8)), M(0x2B2D33, { roughness: .6 })); tin.castShadow = true; tin.position.set(i % 2 ? .55 : -.55, 2.41, -.5); tin.userData.detalle = 'fino'; tg.add(tin); instanciar(ctx, tin, tag); }
      else { const ant = box(.05, .7, .05, 0x8A8F99); ant.position.set(.6, 2.55, -.6); const plato = new THREE.Mesh(geo(ctx, 'plato', () => new THREE.CylinderGeometry(.2, .05, .08, 8)), M(0xD8D8DC)); plato.rotation.x = Math.PI / 3; plato.position.set(-.5, 2.35, -.5); for (const pz of [ant, plato]) { pz.userData.detalle = 'fino'; tg.add(pz); instanciar(ctx, pz, tag); } }
      const pretil = box(2.3, .14, .1, P.tiendaTecho); pretil.position.set(0, 2.27, 1.1); pretil.userData.detalle = 'fino'; tg.add(pretil); instanciar(ctx, pretil, tag); // pretil al frente
      for (const pz of [cuerpo, techo, toldo, letrero, vit, puerta]) instanciar(ctx, pz, tag); // un InstancedMesh por pieza+color (3.90.3)
      if (oscuro && t.vendio) { const l = new THREE.PointLight(col, .8, 6); l.position.set(0, 2.2, 1.8); tg.add(l); }
      if (t.cartera && t.cartera.vencido > 0) { const palo = box(.1, 3.2, .1, 0x6b6e76); palo.position.set(-1.1, 1.6, -1.1); tg.add(palo); const bandera = box(.9, .55, .06, ACC.rojo, { emissive: ACC.rojo, emissiveIntensity: oscuro ? 1.2 : .3 }); bandera.position.set(-.65, 2.9, -1.1); tg.add(bandera); animados.push((tt) => { bandera.rotation.y = Math.sin(tt * 3) * .25; }); }
      g.add(tg);
      tg.traverse((o) => { if (o.isMesh && !o.userData.tag) { o.userData.tag = tag; interact.push(o); } }); // sólo palo y bandera siguen sueltos
    });
    const tagCasa = d.casas ? { tipo: 'clientesFinales', titulo: `Clientes finales · ${capital(d.ciudad)}`, sub: `${d.clientesFinales.n.toLocaleString('es-MX')} clientes compraron en los últimos 2 meses · $${fmtK(d.clientesFinales.importe)} · vía ${d.clientesFinales.cuentas.length} mayorista${d.clientesFinales.cuentas.length === 1 ? '' : 's'}`, pagina: 'sellOut', ciudad: d.ciudad } : null;
    for (let i = 0; i < (d.casas || 0); i++) { const cg = new THREE.Group(); const cuerpo = box(1.1, .9, 1.1, P.tienda); cuerpo.position.y = .45; cg.add(cuerpo); const dosAguas = i % 2 === 1; const techo = new THREE.Mesh(dosAguas ? geo(ctx, 'dosAguas', () => techoDosAguas(.72, 1.3)) : (ctx.conoCasa ||= new THREE.ConeGeometry(.95, .7, 4)), M(P.tiendaTecho)); if (dosAguas) techo.position.y = .9; else { techo.rotation.y = Math.PI / 4; techo.position.y = 1.25; } techo.castShadow = true; cg.add(techo); const v = new THREE.Mesh(G(.3, .3, .08), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.2 : .1 })); v.position.set(.2, .5, .56); cg.add(v); cg.position.set(-ancho / 2 - 2.2, .3, -largo / 2 + .8 + i * 1.6); g.add(cg); for (const pz of [cuerpo, techo, v]) { pz.userData.detalle = 'cerca'; instanciar(ctx, pz, tagCasa); } } // de muy lejos las casitas no se distinguen
    // Banderín de cuota vs ritmo (3.90.61): verde-ámbar-rojo en la esquina de la manzana, de cerca y sin prender la capa; se toca = tarjeta de la ciudad.
    try { const cq = cuotaRitmo(modelo, d.tiendas.filter((t) => !t.reparto).map((t) => t.cuenta)); if (cq) { const tono = CAPA_TONOS[cq.tono];
      const asta = box(.1, 3.4, .1, 0x6b6e76); asta.position.set(-ancho / 2 - .5, 1.7, -largo / 2 + .8); const ban = box(1, .6, .06, tono, { emissive: tono, emissiveIntensity: oscuro ? 1 : .25 }); ban.position.set(-ancho / 2 - .5 + .55, 3.05, -largo / 2 + .8);
      const tagB = { ...piso.userData.tag, sub: `${cq.pct} % de la cuota del mes · ritmo ${cq.ritmo} %` };
      for (const pz of [asta, ban]) { pz.userData.detalle = 'fino'; pz.userData.tag = tagB; interact.push(pz); g.add(pz); } } } catch (e) { console.warn('[ciudad] banderín de cuota', e); } // falla sola
    // árboles y farol
    arbol(ctx, g, -ancho / 2 - 1.2, -largo / 2 - 1.2, .9); arbol(ctx, g, ancho / 2 + 1.2, largo / 2 + 1.2, 1); if (n > 6) arbol(ctx, g, ancho / 2 + 1.2, -largo / 2 - 1.2, .8);
    const farol = box(.12, 2.6, .12, 0x6b6e76); farol.position.set(ancho / 2 + .6, 1.3, largo / 2 + .6); g.add(farol); const foco = new THREE.Mesh(geo(ctx, 'foco', () => new THREE.SphereGeometry(.22, 8, 6)), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.6 : .2 })); foco.position.set(ancho / 2 + .6, 2.7, largo / 2 + .6); g.add(foco);
    for (const pz of [farol, foco]) { pz.userData.detalle = 'fino'; instanciar(ctx, pz); } // faroles: un InstancedMesh por pieza y capa fina (3.90.7)
    // vendedores del cliente en su ciudad
    d.vendedores.forEach((v, i) => { const per = persona(ctx, COLOR_CUENTA[v.cuenta] || ACC.gris, .85); per.position.set(base.x - ancho / 2 + 1 + i * 1.6, .3, base.z + largo / 2 + 2.6); add(per, { tipo: 'vendedor', titulo: v.nombre, sub: `${v.nombreCuenta} · ${v.activo ? 'vendiendo este mes' : 'sin venta reciente'} · $${fmtK(v.importe)} en el año`, pagina: 'sellOut', cuenta: v.cuenta }); aMapa(per); const ruta = [[0, 0], [ancho * .6, 0], [ancho * .6, 1.2], [0, 1.2]]; animados.push((t) => caminar(per, ruta, t * .15 + i * .9, { x: base.x - ancho / 2 + 1 + i * 1.6, z: base.z + largo / 2 + 2.6 })); });
    raiz.add(aMapa(g));
    if (n >= 3) { const cuantos = Math.min(4, Math.ceil(n / 3)); for (let i = 0; i < cuantos; i++) { const per = persona(ctx, [0x9AA0AB, 0xC9B79C, 0x7A8AA6, 0xB58A7A][i % 4], .8); const o = { x: base.x - ancho / 2 + 1 + i * 2.4, z: base.z + largo / 2 + 1.1 }; per.position.set(o.x, .3, o.z); raiz.add(aMapa(per)); const ruta = [[0, 0], [ancho - 2, 0], [ancho - 2, .9], [0, .9]]; animados.push((t) => caminar(per, ruta, t * .12 + i * 1.7 + n, o)); } }
    // etiqueta de ciudad (sprite de texto)
    const et = etiqueta(ctx, d.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : capital(d.ciudad), d.vendio ? '#1D1D1F' : '#8E8E93'); et.position.set(base.x, 3.6, base.z - largo / 2 - .8); et.userData.minZoom = n >= 4 ? 999 : 40; et.userData.prioridad = (d.vendio ? 2 : 1) + Math.min(n, 99) / 100; if (enMapa) { et.userData.minZoom = 999; et.userData.desdeZoom = DETALLE.mapa; } raiz.add(et);
    // Vista Mapa: de muy lejos la etiqueta se cambia por el pin de la ciudad (tiendas activas y camiones llegando).
    et.userData.minZoom = Math.min(et.userData.minZoom, DETALLE.pin); const pin = pinCiudad(d, ctx.modelo.camiones);
    const etPin = etiqueta(ctx, pin.texto, pin.activas ? '#1D1D1F' : '#8E8E93'); etPin.position.copy(et.position); etPin.userData.desdeZoom = DETALLE.pin; etPin.userData.prioridad = et.userData.prioridad + pin.llegando / 1000; raiz.add(etPin);
    etPin.userData.tag = piso.userData.tag; interact.push(etPin); // el pin se toca: en el mapa lleva a la ciudad (Viajar, 3.90.16)
    if (!esGDL) rutas.set(d.ciudad, carretera(ctx, { x: cedisPos.x, z: cedisPos.z + 8 }, { x: base.x, z: base.z + largo / 2 + 2.2 }));
    else rutas.set(d.ciudad, carretera(ctx, { x: cedisPos.x, z: cedisPos.z + 8 }, { x: base.x + ancho / 2 + 3, z: base.z }, 1.2));
  });
  return { distritoPos, rutas };
}

// Kit low-poly (3.90.68): caja con las aristas verticales y la orilla de arriba/abajo biseladas (un solo bisel plano,
// se ve facetada con flatShading). Centrada como BoxGeometry, así reemplaza a box() sin mover nada.
export function cajaBiselada(w, h, d, b) {
  const s = new THREE.Shape(); const x = w / 2 - b, z = d / 2 - b;
  s.moveTo(-x, -z); s.lineTo(x, -z); s.lineTo(x, z); s.lineTo(-x, z); s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: h - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: 1, curveSegments: 1 });
  g.rotateX(-Math.PI / 2); g.center(); g.computeVertexNormals(); return g;
}

// Techo de dos aguas (3.90.69): prisma triangular con la cumbrera a lo largo de z y la base en y = 0.
export function techoDosAguas(r, largo) {
  const g = new THREE.CylinderGeometry(r, r, largo, 3); g.rotateX(-Math.PI / 2); g.scale(1, .75, 1); g.translate(0, r * .5 * .75, 0); g.computeVertexNormals(); return g;
}
