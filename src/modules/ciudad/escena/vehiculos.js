// Acteck Ciudad · vehículos: barcos (contenedores navegando a Manzanillo), camiones (facturas y envíos) y coches del equipo comercial.
import * as THREE from 'three';
import { ACC } from './luz-clima.js';
import { fmtK } from './etiquetas.js';
import { instanciar, geo } from './instancias.js';
import { circuitoVendedor, tramoActual, rumboBarcos, camionesTemporada, nombreCiudad } from '../modelo.js';

// Barcos: entran desde el suroeste hacia el muelle según su progreso.
export function barcos(ctx, puertoPos) {
  const { P, M, box, add, modelo, animados } = ctx;
  const rumbo = rumboBarcos(modelo.puerto.barcos); // 3.90.55: posición por ETA real (atracado / en fila / llegando / mar abierto)
  modelo.puerto.barcos.forEach((b, i) => {
    const g = new THREE.Group(); const cajas = [];
    const casco = box(5, 1.1, 1.8, P.barco); casco.position.y = .5; g.add(casco);
    const proa = new THREE.Mesh(geo(ctx, 'proa', () => new THREE.ConeGeometry(.9, 1.6, 4)), M(P.barco)); proa.rotation.z = -Math.PI / 2; proa.rotation.y = Math.PI / 4; proa.position.set(3.1, .55, 0); proa.castShadow = true; g.add(proa);
    const cab = box(1.3, 1.3, 1.5, P.barcoCab); cab.position.set(-1.6, 1.65, 0); g.add(cab);
    for (let k = 0; k < 3; k++) { const c = box(1, .7, 1.4, [ACC.azul, ACC.naranja, ACC.verde, ACC.morado][(k + i) % 4]); c.position.set(.2 + k * -.0 + (k - 1) * 1.1, 1.4, 0); g.add(c); cajas.push(c); }
    const ini = { x: puertoPos.x - 52 - (i % 4) * 9, z: puertoPos.z + 46 + (i % 3) * 8 }; const fin = { x: puertoPos.x - 3, z: puertoPos.z + 5 };
    const ru = rumbo[i]; const lx = fin.x - ini.x, lz = fin.z - ini.z, largo = Math.hypot(lx, lz) || 1;
    if (ru.muelle != null) { const atras = ru.muelle * 6.5; g.position.set(fin.x - lx / largo * atras, 0, fin.z - lz / largo * atras); } // la fila se forma mar adentro
    else { const a = Math.min(ru.avance, .9); g.position.set(ini.x + lx * a, 0, ini.z + lz * a); }
    g.rotation.y = -Math.atan2(lz, lx);
    const estado = ru.modo === 'atracado' ? 'en el puerto · descargando' : ru.modo === 'esperando' ? 'en el puerto · esperando muelle' : b.llegaEnDias == null ? 'sin ETA' : `llega en ${b.llegaEnDias} d`;
    add(g, { tipo: 'barco', id: b.id, titulo: `Contenedor ${b.id}`, sub: `${b.naviera || b.supplier} · ${b.piezas.toLocaleString('es-MX')} pz · ${estado}`, pagina: 'inventarioGlobal', barco: b });
    g.traverse((o) => { if (o.isMesh) instanciar(ctx, o, null, true); }); // 3.90.22: piezas del barco como instancias dinámicas (tag de su contenedor)
    const base = g.position.clone();
    const quieto = ru.muelle != null; // atracado o en fila: no deriva
    // Descarga (atracado): una caja a la vez sube, cruza hacia el muelle y desaparece; luego vuelve a su lugar (ciclo de 4 s).
    const descarga = ru.modo === 'atracado' ? cajas.map((c) => c.position.clone()) : null;
    animados.push((t) => {
      g.position.y = Math.sin(t * 1.4 + i) * (quieto ? .05 : .12); if (!quieto) g.position.x = base.x + Math.sin(t * .11 + i) * .4; g.rotation.z = Math.sin(t * 1.1 + i) * (quieto ? .008 : .02);
      if (descarga) { const ciclo = (t / 4) % cajas.length, k = Math.floor(ciclo), f = ciclo - k; cajas.forEach((c, j) => { const o = descarga[j]; if (j !== k) { c.position.copy(o); c.scale.setScalar(1); return; } c.position.set(o.x, o.y + Math.min(1, f * 3) * 2.2, o.z - Math.max(0, f * 3 - 1) * 2.2); c.scale.setScalar(f < .95 ? 1 : .001); }); } // instancias: copian la matriz, no `visible`
    });
  });
}

// Camiones (facturas y envíos) y vendedores del ERP (coches) por las carreteras de cada ciudad.
export function camiones(ctx, rutas) {
  const { P, M, box, add, oscuro, modelo, animados } = ctx;
  // 3.90.67: facturas que salieron en Buen Fin / semana del cierre → caja roja de promoción (fecha de la barra de tiempo o hoy).
  let temporada = new Map(); try { temporada = camionesTemporada(modelo, modelo.momento?.fecha ? new Date(modelo.momento.fecha) : new Date()); } catch (e) { console.warn('[ciudad] camiones de temporada', e); }
  modelo.camiones.forEach((c, i) => {
    const promo = temporada.get(c.folio);
    const curva = rutas.get(c.ciudad); if (!curva) return;
    const g = new THREE.Group(); const caja = box(2.6, 1.4, 1.2, c.envio ? 0xDCE6F2 : promo ? 0xFF453A : P.camion); caja.position.set(-.4, .95, 0); g.add(caja); const cab = box(1, 1.1, 1.2, c.envio ? ACC.azul : P.cabina); cab.position.set(1.5, .8, 0); g.add(cab);
    [[-1.1, .5], [-1.1, -.5], [1.4, .5], [1.4, -.5]].forEach(([x, z]) => { const r = new THREE.Mesh(geo(ctx, 'ruedaCamion', () => new THREE.CylinderGeometry(.28, .28, .22, 10)), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .3, z); g.add(r); });
    g.traverse((o) => { if (o.isMesh) instanciar(ctx, o, null, true); }); // 3.90.4: el tag lo pone add() y se lee al plantar
    if (oscuro) { const f = new THREE.PointLight(0xFFF2C0, .9, 7); f.position.set(2.2, .8, 0); g.add(f); }
    add(g, { tipo: 'camion', folio: c.folio, titulo: c.envio ? `Envío · ${c.folio}` : `Factura ${c.folio}${promo ? ` · ${promo.texto}` : ''}`, sub: c.envio ? `${c.cliente}${c.paqueteria ? ` · ${c.paqueteria}` : ''} · salió ${c.fecha} · va a ${nombreCiudad(c.ciudad)}` : `${c.cliente} · $${fmtK(c.monto)} · ${c.piezas.toLocaleString('es-MX')} pz · va a ${nombreCiudad(c.ciudad)}`, pagina: 'ordenesCompra' });
    animados.push((t) => { const p = (c.progreso + t * .025 + i * .07) % 1; const pt = curva.getPointAt(p); const q = curva.getPointAt(Math.min(1, p + .01)); g.position.set(pt.x, .1, pt.z); g.rotation.y = -Math.atan2(q.z - pt.z, q.x - pt.x); });
  });
}

export function vendedoresRuta(ctx, rutas) {
  const { M, box, add, modelo, animados } = ctx;
  // Etapa 5 (3.90.53): circuito real CEDIS → sedes de sus clientes principales → CEDIS (`circuitoVendedor`); entre sedes va
  // en línea recta. La etiqueta (hover) dice a quién va ahora; tocarlo abre su tarjeta con las ventas del mes.
  modelo.vendedoresRuta.forEach((v, i) => {
    const paradas = circuitoVendedor(v.destinos, (c) => rutas.has(c)); if (!paradas.length) return;
    const fin = (c) => rutas.get(c).getPointAt(1);
    const tramos = [{ at: (q) => rutas.get(paradas[0].ciudad).getPointAt(q) }];
    for (let k = 1; k < paradas.length; k++) { const l = new THREE.LineCurve3(fin(paradas[k - 1].ciudad), fin(paradas[k].ciudad)); tramos.push({ at: (q) => l.getPointAt(q) }); }
    tramos.push({ at: (q) => rutas.get(paradas[paradas.length - 1].ciudad).getPointAt(1 - q) });
    const g = new THREE.Group(); const cuerpo = box(1.8, .7, 1, ACC.azul); cuerpo.position.y = .55; g.add(cuerpo); const techo = box(1, .5, .9, 0xDCE6F2); techo.position.set(-.1, 1.1, 0); g.add(techo);
    [[-.55, .45], [-.55, -.45], [.55, .45], [.55, -.45]].forEach(([x, z]) => { const r = new THREE.Mesh(geo(ctx, 'ruedaCoche', () => new THREE.CylinderGeometry(.22, .22, .2, 10)), M(0x222222)); r.rotation.x = Math.PI / 2; r.position.set(x, .22, z); g.add(r); });
    g.traverse((o) => { if (o.isMesh) instanciar(ctx, o, null, true); });
    const subDe = (k) => `Equipo comercial · ${v.clientes} clientes · ${k < paradas.length ? `va a ${paradas[k].cliente} (${nombreCiudad(paradas[k].ciudad)})` : 'regresa al CEDIS'}`;
    const tag = { tipo: 'vendedorErp', titulo: v.nombre, sub: subDe(0), pagina: 'sellIn' }; let tramoVisto = 0;
    add(g, tag);
    animados.push((t) => {
      const { i: k, q } = tramoActual((v.fase + t * .04 + i * .03) / tramos.length, paradas.length); // misma velocidad por tramo que antes
      if (k !== tramoVisto) { tramoVisto = k; tag.sub = subDe(k); }
      const pt = tramos[k].at(q), pq = tramos[k].at(Math.min(1, q + .01)); g.position.set(pt.x + .9, .08, pt.z + .9);
      if (pq.distanceToSquared(pt) > 1e-8) g.rotation.y = -Math.atan2(pq.z - pt.z, pq.x - pt.x);
    });
  });
}
