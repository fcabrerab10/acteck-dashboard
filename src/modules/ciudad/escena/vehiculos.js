// Acteck Ciudad · vehículos: barcos (contenedores navegando a Manzanillo), camiones (facturas y envíos) y coches del equipo comercial.
import * as THREE from 'three';
import { ACC } from './luz-clima.js';
import { fmtK, capital } from './etiquetas.js';

// Barcos: entran desde el suroeste hacia el muelle según su progreso.
export function barcos({ P, M, box, add, modelo, animados }, puertoPos) {
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
}

// Camiones (facturas y envíos) y vendedores del ERP (coches) por las carreteras de cada ciudad.
export function camiones({ P, M, box, add, oscuro, modelo, animados }, rutas) {
  modelo.camiones.forEach((c, i) => {
    const curva = rutas.get(c.ciudad); if (!curva) return;
    const g = new THREE.Group(); const caja = box(2.6, 1.4, 1.2, c.envio ? 0xDCE6F2 : P.camion); caja.position.set(-.4, .95, 0); g.add(caja); const cab = box(1, 1.1, 1.2, c.envio ? ACC.azul : P.cabina); cab.position.set(1.5, .8, 0); g.add(cab);
    [[-1.1, .5], [-1.1, -.5], [1.4, .5], [1.4, -.5]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.28, .28, .22, 10), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .3, z); g.add(r); });
    if (oscuro) { const f = new THREE.PointLight(0xFFF2C0, .9, 7); f.position.set(2.2, .8, 0); g.add(f); }
    add(g, { tipo: 'camion', titulo: c.envio ? `Envío · ${c.folio}` : `Factura ${c.folio}`, sub: c.envio ? `${c.cliente}${c.paqueteria ? ` · ${c.paqueteria}` : ''} · salió ${c.fecha} · va a ${capital(c.ciudad)}` : `${c.cliente} · $${fmtK(c.monto)} · ${c.piezas.toLocaleString('es-MX')} pz · va a ${capital(c.ciudad)}`, pagina: 'ordenesCompra' });
    animados.push((t) => { const p = (c.progreso + t * .025 + i * .07) % 1; const pt = curva.getPointAt(p); const q = curva.getPointAt(Math.min(1, p + .01)); g.position.set(pt.x, .1, pt.z); g.rotation.y = -Math.atan2(q.z - pt.z, q.x - pt.x); });
  });
}

export function vendedoresRuta({ M, box, add, modelo, animados }, rutas) {
  modelo.vendedoresRuta.forEach((v, i) => {
    const dest = v.destinos.find((d) => rutas.has(d.ciudad)); const curva = dest ? rutas.get(dest.ciudad) : null; if (!curva) return;
    const g = new THREE.Group(); const cuerpo = box(1.8, .7, 1, ACC.azul); cuerpo.position.y = .55; g.add(cuerpo); const techo = box(1, .5, .9, 0xDCE6F2); techo.position.set(-.1, 1.1, 0); g.add(techo);
    [[-.55, .45], [-.55, -.45], [.55, .45], [.55, -.45]].forEach(([x, z]) => { const r = new THREE.Mesh(new THREE.CylinderGeometry(.22, .22, .2, 10), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .22, z); g.add(r); });
    add(g, { tipo: 'vendedorErp', titulo: v.nombre, sub: `Equipo comercial · ${v.clientes} clientes · va a ${dest.cliente} (${capital(dest.ciudad)})`, pagina: 'sellIn' });
    animados.push((t) => { const p = (v.fase + t * .04 + i * .03) % 2; const q = p < 1 ? p : 2 - p; const pt = curva.getPointAt(q); const pq = curva.getPointAt(Math.max(0, Math.min(1, q + (p < 1 ? .01 : -.01)))); g.position.set(pt.x + .9, .08, pt.z + .9); g.rotation.y = -Math.atan2(pq.z - pt.z, pq.x - pt.x); });
  });
}
