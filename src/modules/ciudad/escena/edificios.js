// Acteck Ciudad · edificios: oficina, CEDIS y puerto de Acteck, y un distrito (manzana con tiendas) por ciudad.
// Cada función recibe el contexto de la escena (ctx) y regresa la posición que usan cámara y carreteras.
import * as THREE from 'three';
import { COLOR_CUENTA } from '../modelo.js';
import { ACC } from './luz-clima.js';
import { arbol, carretera } from './terreno.js';
import { persona, caminar } from './gente.js';
import { etiqueta, fmtK, capital } from './etiquetas.js';
import { instanciar } from './instancias.js';

// Oficina + sala de juntas + equipo caminando entre oficina, sala y CEDIS.
export function oficina(ctx) {
  const { P, M, G, box, add, oscuro, modelo, esc, animados } = ctx;
  const ofiPos = { x: esc.x - 7, z: esc.z + 2 };
  const g = new THREE.Group(); g.position.set(ofiPos.x, 0, ofiPos.z);
  const base = box(14, .5, 14, P.banqueta); g.add(base);
  const cuerpo = box(9, 9, 7, P.oficina); cuerpo.position.set(0, 4.75, 0); g.add(cuerpo);
  const techo = box(9.8, .6, 7.8, P.oficinaTecho); techo.position.set(0, 9.6, 0); g.add(techo);
  const letrero = box(5, .9, .3, ACC.azul, { emissive: ACC.azul, emissiveIntensity: oscuro ? 1.6 : .35 }); letrero.position.set(0, 10.4, 3.6); g.add(letrero);
  const vm = M(P.ventana, { roughness: .4 }); const vOn = M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.4 : .15, roughness: .4 });
  for (let f = 0; f < 3; f++) for (let i = 0; i < 4; i++) { const v = new THREE.Mesh(G(1.2, 1.4, .12), (f + i) % 3 ? vOn : vm); v.userData.detalle = 'fino'; v.position.set(-3 + i * 2, 1.8 + f * 2.8, 3.56); g.add(v); const v2 = v.clone(); v2.rotation.y = Math.PI / 2; v2.position.set(4.56, 1.8 + f * 2.8, -2.2 + i * 1.5); g.add(v2); }
  const puerta = new THREE.Mesh(G(1.6, 2.2, .12), M(0x5A4636)); puerta.position.set(0, 1.35, 3.56); g.add(puerta);
  // sala de juntas (anexo bajo) que se enciende con reunión
  const sala = box(4.5, 3.2, 4.5, P.oficina); sala.position.set(-6, 1.85, -3); g.add(sala);
  const salaTecho = box(5, .4, 5, P.oficinaTecho); salaTecho.position.set(-6, 3.65, -3); g.add(salaTecho);
  const salaVent = new THREE.Mesh(G(3, 1.4, .12), modelo.oficina.reunionEnCurso ? vOn : vm); salaVent.position.set(-6, 1.9, -.7); g.add(salaVent);
  if (oscuro && modelo.oficina.reunionEnCurso) { const l = new THREE.PointLight(0xFFD66B, 1.4, 14); l.position.set(-6, 3, .5); g.add(l); }
  for (const [x, z] of [[6, 5.5], [-6, 5.5], [6.2, -5.8]]) arbol(ctx, g, x, z, 1.1);
  add(g, { tipo: 'oficina', titulo: 'Oficina Acteck', sub: `${modelo.oficina.personas.length + modelo.oficina.genericos} personas · ${modelo.oficina.reuniones} reunión${modelo.oficina.reuniones === 1 ? '' : 'es'} hoy`, pagina: 'agenda' });
  // gente: equipo con nombre + genéricos, caminando entre oficina, sala y CEDIS
  const rutasOf = [[0, 5.5], [-6, 1.2], [3, 7], [9, 2], [12, -3], [0, 5.5]];
  const todos = [...modelo.oficina.personas.map((p) => ({ ...p, generico: false })), ...Array.from({ length: modelo.oficina.genericos }, (_, i) => ({ nombre: ['Ventas', 'Almacén', 'Administración'][i % 3], generico: true, rol: ['comercial', 'almacen', 'finanzas'][i % 3] }))];
  todos.forEach((p, i) => {
    const col = { direccion: ACC.azul, comercial: ACC.morado, finanzas: ACC.verde, almacen: ACC.naranja }[p.rol] || ACC.gris;
    const per = persona(ctx, col, p.generico ? .9 : 1); per.position.set(ofiPos.x + rutasOf[0][0], .5, ofiPos.z + rutasOf[0][1]);
    add(per, { tipo: 'persona', titulo: p.nombre, sub: p.generico ? 'equipo' : (p.actividad ? `ahora: ${p.actividad}` : `${p.pendientes} pendiente${p.pendientes === 1 ? '' : 's'} hoy · ${p.hechas} hecha${p.hechas === 1 ? '' : 's'}`), pagina: 'agenda', persona: p });
    const fase = i * 1.37, vel = .22 + (i % 3) * .05;
    animados.push((t) => caminar(per, rutasOf, t * vel + fase, ofiPos));
  });
  return ofiPos;
}

// CEDIS: nave, racks, tarimas descargando y montacargas.
export function cedis(ctx) {
  const { P, M, G, box, add, oscuro, modelo, esc, animados } = ctx;
  const cedisPos = { x: esc.x + 9, z: esc.z - 2 };
  const g = new THREE.Group(); g.position.set(cedisPos.x, 0, cedisPos.z);
  g.add(box(22, .5, 16, P.banqueta));
  const nave = box(16, 6, 11, P.cedis); nave.position.set(0, 3.25, -1); g.add(nave);
  const techo = box(17, .7, 12, P.cedisTecho); techo.position.set(0, 6.6, -1); g.add(techo);
  for (let i = 0; i < 3; i++) { const cl = box(2.2, .4, 3, P.cedisTecho); cl.position.set(-5 + i * 5, 7.1, -1); g.add(cl); }
  for (let i = 0; i < 3; i++) { const p = new THREE.Mesh(G(2.4, 2.6, .14), M(0x4A4F5C)); p.position.set(-5 + i * 5, 1.5, 4.57); g.add(p); }
  for (let i = 0; i < 6; i++) { const v = new THREE.Mesh(G(1.6, .8, .12), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.2 : .12, roughness: .4 })); v.userData.detalle = 'fino'; v.position.set(-6.5 + i * 2.6, 4.6, 4.57); g.add(v); }
  const rotulo = box(5.5, .9, .25, ACC.azul, { emissive: ACC.azul, emissiveIntensity: oscuro ? 1.6 : .35 }); rotulo.position.set(0, 7.4, 4.6); g.add(rotulo);
  // racks al frente (altura por días de inventario) y tarimas descargando
  for (let i = 0; i < modelo.cedis.racks; i++) { const col = i % 2 ? 0xC58A3A : 0xD49A4A; for (let k = 0; k < 1 + (i % 3); k++) { const c = box(1.3, 1, 1.3, col); c.position.set(-9 + (i % 5) * 2.2, .75 + k * 1.05, 6.5 + Math.floor(i / 5) * 2); g.add(c); } }
  modelo.puerto.tarimas.slice(0, 6).forEach((tp, i) => { const c = box(1.3, 1, 1.3, 0xA86A2E); c.position.set(6 + (i % 3) * 2, .75, 6 + Math.floor(i / 3) * 2); g.add(c); });
  for (const [x, z] of [[-10.5, -6.5], [10.5, -6.5]]) arbol(ctx, g, x, z, 1.2);
  add(g, { tipo: 'cedis', titulo: 'CEDIS', sub: `$${(modelo.cedis.valor / 1e6).toFixed(1)} M · ${Math.round(modelo.cedis.dias)} días · ${modelo.puerto.tarimas.length} contenedor${modelo.puerto.tarimas.length === 1 ? '' : 'es'} descargando`, pagina: 'inventarioGlobal' });
  // montacargas
  const mc = new THREE.Group(); const cuerpo = box(1.6, 1, 1.1, ACC.naranja); mc.add(cuerpo); const mastil = box(.2, 2.2, .2, 0x444444); mastil.position.set(.9, 1.1, 0); mc.add(mastil); const carga = box(1, .8, 1, 0xC58A3A); carga.position.set(1.4, .6, 0); mc.add(carga);
  [[-.5, .5], [-.5, -.5], [.5, .5], [.5, -.5]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.3, .3, .25, 10), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .3, z); mc.add(r); });
  mc.position.set(cedisPos.x - 2, 0, cedisPos.z + 5); add(mc, { tipo: 'montacargas', titulo: 'Montacargas', sub: 'moviendo tarimas', pagina: 'inventarioGlobal' });
  animados.push((t) => { const p = (t * .18) % 1; const x = cedisPos.x - 6 + Math.abs(Math.sin(p * Math.PI * 2)) * 12; mc.position.x = x; mc.rotation.y = Math.cos(p * Math.PI * 2) > 0 ? 0 : Math.PI; });
  return cedisPos;
}

// Puerto de Manzanillo: muelle, grúa y contenedores (los barcos viven en vehiculos.js).
export function puerto(ctx) {
  const { P, box, add, modelo } = ctx;
  const puertoPos = modelo.puertoPos;
  const g = new THREE.Group(); g.position.set(puertoPos.x, 0, puertoPos.z);
  const muelle = box(10, .6, 4, P.banqueta); muelle.position.set(0, .3, 2); g.add(muelle);
  const grua = new THREE.Group(); const pata1 = box(.5, 7, .5, ACC.rojo); pata1.position.set(-2, 3.5, 0); const pata2 = pata1.clone(); pata2.position.x = 2; const viga = box(7, .5, .5, ACC.rojo); viga.position.set(0, 7.2, 0); grua.add(pata1, pata2, viga); grua.position.set(0, .6, 2); g.add(grua);
  for (let i = 0; i < 3; i++) { const c = box(2.2, 1, 1.2, [ACC.azul, ACC.naranja, ACC.verde][i]); c.position.set(-3 + i * 3, 1.1, 1.2); g.add(c); }
  add(g, { tipo: 'puerto', titulo: 'Puerto de Manzanillo', sub: `${modelo.puerto.barcos.length} contenedores navegando · ${modelo.puerto.totalPiezas.toLocaleString('es-MX')} pz`, pagina: 'inventarioGlobal' });
  return puertoPos;
}

// Distritos: una manzana por ciudad con sus tiendas, clientes finales, vendedores, peatones, etiqueta y carretera desde el CEDIS.
export function distritos(ctx, cedisPos) {
  const { P, M, G, box, add, oscuro, modelo, esc, raiz, interact, animados } = ctx;
  const distritoPos = new Map(); const rutas = new Map();
  modelo.distritos.forEach((d) => {
    const esGDL = d.ciudad === 'GUADALAJARA';
    const base = esGDL ? { x: esc.x - 4, z: esc.z + 16 } : d.pos;
    distritoPos.set(d.ciudad, base);
    const n = d.tiendas.length; const cols = Math.min(5, Math.max(2, Math.ceil(Math.sqrt(Math.max(1, n) * 1.5)))); const filas = Math.max(1, Math.ceil(n / cols));
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
      const tag = { tipo: 'tienda', titulo: `${t.nombreCuenta} · ${t.sucursal}`, sub: `${t.vendioMes ? `vendió este mes $${fmtK(t.importe)}` : t.vendio ? 'vendió el mes pasado; este mes aún no' : 'sin venta este mes'}${t.previo ? ` · mes anterior $${fmtK(t.previo)}` : ''}${t.vendedores ? ` · ${t.vendedores} vendedores` : ''}${t.cartera && t.cartera.vencido > 0 ? ` · 🚩 cartera vencida $${fmtK(t.cartera.vencido)}` : ''}`, pagina: 'sellOut', cuenta: t.cuenta, ciudad: d.ciudad };
      const cuerpo = box(2, 1.9, 2, P.tienda); cuerpo.position.y = .95; tg.add(cuerpo);
      const techo = box(2.3, .3, 2.3, P.tiendaTecho); techo.position.y = 2.05; tg.add(techo);
      const toldo = box(2.2, .16, .8, col); toldo.position.set(0, 1.5, 1.35); tg.add(toldo);
      const letrero = box(1.5, .34, .12, t.vendio ? col : P.ventana, { emissive: t.vendio ? col : 0x000000, emissiveIntensity: t.vendio ? (oscuro ? 1.6 : .3) : 0 }); letrero.position.set(0, 1.78, 1.06); tg.add(letrero);
      const vit = new THREE.Mesh(G(1.1, .75, .1), M(t.vendio ? P.ventanaOn : P.ventana, { emissive: t.vendio ? P.ventanaOn : 0x000000, emissiveIntensity: t.vendio ? (oscuro ? 1.2 : .1) : 0, roughness: .4 })); vit.position.set(-.3, .75, 1.05); tg.add(vit);
      const puerta = new THREE.Mesh(G(.5, 1.1, .1), M(0x5A4636)); puerta.position.set(.6, .55, 1.05); tg.add(puerta);
      for (const pz of [letrero, vit, puerta]) pz.userData.detalle = 'fino'; // de lejos la tienda es volumen + toldo de color
      for (const pz of [cuerpo, techo, toldo, letrero, vit, puerta]) instanciar(ctx, pz, tag); // un InstancedMesh por pieza+color (3.90.3)
      if (oscuro && t.vendio) { const l = new THREE.PointLight(col, .8, 6); l.position.set(0, 2.2, 1.8); tg.add(l); }
      if (t.cartera && t.cartera.vencido > 0) { const palo = box(.1, 3.2, .1, 0x6b6e76); palo.position.set(-1.1, 1.6, -1.1); tg.add(palo); const bandera = box(.9, .55, .06, ACC.rojo, { emissive: ACC.rojo, emissiveIntensity: oscuro ? 1.2 : .3 }); bandera.position.set(-.65, 2.9, -1.1); tg.add(bandera); animados.push((tt) => { bandera.rotation.y = Math.sin(tt * 3) * .25; }); }
      g.add(tg);
      tg.traverse((o) => { if (o.isMesh && !o.userData.tag) { o.userData.tag = tag; interact.push(o); } }); // sólo palo y bandera siguen sueltos
    });
    const tagCasa = d.casas ? { tipo: 'clientesFinales', titulo: `Clientes finales · ${capital(d.ciudad)}`, sub: `${d.clientesFinales.n.toLocaleString('es-MX')} clientes compraron en los últimos 2 meses · $${fmtK(d.clientesFinales.importe)} · vía ${d.clientesFinales.cuentas.length} mayorista${d.clientesFinales.cuentas.length === 1 ? '' : 's'}`, pagina: 'sellOut', ciudad: d.ciudad } : null;
    for (let i = 0; i < (d.casas || 0); i++) { const cg = new THREE.Group(); const cuerpo = box(1.1, .9, 1.1, P.tienda); cuerpo.position.y = .45; cg.add(cuerpo); const techo = new THREE.Mesh(ctx.conoCasa ||= new THREE.ConeGeometry(.95, .7, 4), M(P.tiendaTecho)); techo.rotation.y = Math.PI / 4; techo.position.y = 1.25; techo.castShadow = true; cg.add(techo); const v = new THREE.Mesh(G(.3, .3, .08), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.2 : .1 })); v.position.set(.2, .5, .56); cg.add(v); cg.position.set(-ancho / 2 - 2.2, .3, -largo / 2 + .8 + i * 1.6); g.add(cg); for (const pz of [cuerpo, techo, v]) instanciar(ctx, pz, tagCasa); }
    // árboles y farol
    arbol(ctx, g, -ancho / 2 - 1.2, -largo / 2 - 1.2, .9); arbol(ctx, g, ancho / 2 + 1.2, largo / 2 + 1.2, 1); if (n > 6) arbol(ctx, g, ancho / 2 + 1.2, -largo / 2 - 1.2, .8);
    const farol = box(.12, 2.6, .12, 0x6b6e76); farol.position.set(ancho / 2 + .6, 1.3, largo / 2 + .6); g.add(farol); const foco = new THREE.Mesh(new THREE.SphereGeometry(.22, 8, 6), M(P.ventanaOn, { emissive: P.ventanaOn, emissiveIntensity: oscuro ? 1.6 : .2 })); foco.position.set(ancho / 2 + .6, 2.7, largo / 2 + .6); g.add(foco);
    // vendedores del cliente en su ciudad
    d.vendedores.forEach((v, i) => { const per = persona(ctx, COLOR_CUENTA[v.cuenta] || ACC.gris, .85); per.position.set(base.x - ancho / 2 + 1 + i * 1.6, .3, base.z + largo / 2 + 2.6); add(per, { tipo: 'vendedor', titulo: v.nombre, sub: `${v.nombreCuenta} · ${v.activo ? 'vendiendo este mes' : 'sin venta reciente'} · $${fmtK(v.importe)} en el año`, pagina: 'sellOut', cuenta: v.cuenta }); const ruta = [[0, 0], [ancho * .6, 0], [ancho * .6, 1.2], [0, 1.2]]; animados.push((t) => caminar(per, ruta, t * .15 + i * .9, { x: base.x - ancho / 2 + 1 + i * 1.6, z: base.z + largo / 2 + 2.6 })); });
    raiz.add(g);
    if (n >= 3) { const cuantos = Math.min(4, Math.ceil(n / 3)); for (let i = 0; i < cuantos; i++) { const per = persona(ctx, [0x9AA0AB, 0xC9B79C, 0x7A8AA6, 0xB58A7A][i % 4], .8); const o = { x: base.x - ancho / 2 + 1 + i * 2.4, z: base.z + largo / 2 + 1.1 }; per.position.set(o.x, .3, o.z); raiz.add(per); const ruta = [[0, 0], [ancho - 2, 0], [ancho - 2, .9], [0, .9]]; animados.push((t) => caminar(per, ruta, t * .12 + i * 1.7 + n, o)); } }
    // etiqueta de ciudad (sprite de texto)
    const et = etiqueta(ctx, d.ciudad === 'CIUDAD DE MEXICO' ? 'CDMX' : capital(d.ciudad), d.vendio ? '#1D1D1F' : '#8E8E93'); et.position.set(base.x, 3.6, base.z - largo / 2 - .8); et.userData.minZoom = n >= 4 ? 999 : 40; raiz.add(et);
    if (!esGDL) rutas.set(d.ciudad, carretera(ctx, { x: cedisPos.x, z: cedisPos.z + 8 }, { x: base.x, z: base.z + largo / 2 + 2.2 }));
    else rutas.set(d.ciudad, carretera(ctx, { x: cedisPos.x, z: cedisPos.z + 8 }, { x: base.x + ancho / 2 + 3, z: base.z }, 1.2));
  });
  return { distritoPos, rutas };
}
