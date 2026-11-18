// Inicio en tarjetas · catálogo y orden (puro, sin React). Lo comparten la web (InicioTarjetas.jsx) y el celular
// (movil/pestanas/inicio/InicioTarjetasM.jsx): mismas tarjetas, mismos cálculos (`calcular` de calc.js) y la misma
// preferencia (`preferencias.inicio.tarjetas`). Extraído de InicioTarjetas.jsx el 2026-11-18.
import { moneyCompact as $c, int, pct, fechaCorta as fecha } from '../../../lib/format';
import { PAGINAS } from './config';

const signo = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(v))} %`;
const tono = (v) => (v >= 0 ? 'green' : 'red');

/** Catálogo: cada tarjeta dice su tamaño (g = 2×2 · m = 2×1 · c = 1×1), si se puede ver y qué pinta. */
export function catalogo({ r, ve, anio, labelPeriodo }) {
  const c = r.cur, so = r.sellOut, inv = r.inv, ec = r.enCamino, cart = r.cartera;
  return [
    { id: 'cuota', label: 'Cuota del período', tam: 'g', inversa: true, pagina: PAGINAS.sellIn,
      eyebrow: `Cuota · ${labelPeriodo}`, big: r.pctCuota != null ? `${Math.round(r.pctCuota)} %` : '—',
      sub: `${$c(c.fact_neta)}${r.cuotaPeriodo ? ` de ${$c(r.cuotaPeriodo)}` : ''}${r.yoy != null ? ` · ${signo(r.yoy)} ${r.yoyLabel}` : ''}`, progreso: r.pctCuota },
    { id: 'sellin', label: 'Sell in', tam: 'c', pagina: PAGINAS.sellIn, eyebrow: 'Sell in', big: $c(c.fact_neta),
      pill: r.yoy != null ? { l: signo(r.yoy), tone: tono(r.yoy) } : null, trazo: r.serie.map((m) => m.fn || null) },
    { id: 'sellout', label: 'Sell out', tam: 'c', pagina: 'sellOut', eyebrow: 'Sell out', big: so.total > 0 ? $c(so.total) : '—',
      pill: so.yoy != null ? { l: signo(so.yoy), tone: tono(so.yoy) } : null, sub: so.soSi != null ? `SO/SI ${so.soSi.toFixed(2)}` : null, trazo: so.serie.map((m) => m.so || null) },
    { id: 'margen', label: 'Margen', tam: 'c', ver: r.sensible, eyebrow: 'Margen', big: c.mc != null ? pct(c.mc) : '—',
      pill: r.dMc != null ? { l: `${r.dMc >= 0 ? '+' : ''}${r.dMc.toFixed(1)} pp`, tone: tono(r.dMc) } : null, sub: `${$c(c.contribucion)} contribución`, trazo: r.serie.map((m) => m.mc) },
    { id: 'inventario', label: 'Inventario', tam: 'c', ver: ve.inventario, pagina: PAGINAS.inventario, eyebrow: 'Inventario', big: $c(inv.valor),
      pill: inv.cobertura != null ? { l: `${inv.cobertura} d`, tone: inv.cobertura > 150 ? 'orange' : 'gray' } : null, sub: `${int(inv.piezas)} pz` },
    { id: 'camino', label: 'En camino', tam: 'c', ver: ve.inventario, pagina: PAGINAS.inventario, eyebrow: ec.porMes[0] ? `Llega en ${ec.porMes[0].label}` : 'En camino', big: $c(ec.porMes[0]?.valor ?? ec.valor),
      sub: `${$c(ec.valor)} en ${ec.pos} PO${ec.proximos[0] ? ` · próximo ${fecha(ec.proximos[0].eta)}` : ''}`, pill: ec.atrasados.pos > 0 ? { l: `${ec.atrasados.pos} con ETA vencida`, tone: 'red' } : null },
    { id: 'cartera', label: 'Cartera', tam: 'c', ver: ve.cobranza, pagina: PAGINAS.cobranza, eyebrow: 'Por cobrar', big: $c(cart.saldo),
      pill: cart.vencido > 0 ? { l: `${$c(cart.vencido)} vencido`, tone: cart.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al corriente', tone: 'green' }, sub: cart.dso != null ? `DSO ${cart.dso} días` : null },
    { id: 'anio', label: `${anio} frente a ${anio - 1}`, tam: 'm', pagina: PAGINAS.sellIn, eyebrow: `${anio} acumulado`, big: $c(r.modo === 'mes' ? r.otro?.fact_neta : c.fact_neta),
      sub: (r.modo === 'mes' ? r.pctOtro : r.pctCuota) != null ? `${Math.round(r.modo === 'mes' ? r.pctOtro : r.pctCuota)} % de la cuota a la fecha` : null, trazo: r.serie.map((m) => m.fn || null), trazoAlto: 34 },
    { id: 'decidir', label: 'Para decidir', tam: 'm', eyebrow: 'Requiere decisión', lista: r.decision.slice(0, 3).map((a) => ({ t: a.titulo, tone: a.severidad === 'critica' ? 'red' : 'orange' })), vacio: 'Nada urgente hoy.' },
    { id: 'agenda', label: 'Próximos 7 días', tam: 'm', eyebrow: 'Próximos 7 días · pagos, arribos y eventos', lista: (r.agenda || []).slice(0, 3).map((a) => ({ t: a.titulo || a.texto || a.label, tone: 'blue', d: a.fecha ? fecha(a.fecha) : null })), vacio: 'Sin pendientes próximos.' },
  ].filter((t) => t.ver !== false);
}

export const ORDEN_DEFAULT = ['cuota', 'sellin', 'sellout', 'inventario', 'camino', 'cartera', 'margen', 'anio', 'decidir', 'agenda'];

/** Ids que se pintan, en orden: lo que se está arrastrando → lo guardado → el default; sólo los que el catálogo permite ver. */
export function idsVisibles(todas, guardadas, orden = null) {
  const base = orden || (Array.isArray(guardadas) ? guardadas : null) || ORDEN_DEFAULT;
  const vistos = new Set();
  return base.filter((id) => todas.some((t) => t.id === id) && !vistos.has(id) && vistos.add(id));
}

/** Tarjetas del catálogo que no están en la selección (para «agregar»). */
export const tarjetasFuera = (todas, ids) => todas.filter((t) => !ids.includes(t.id));

/** Mueve `id` al lugar que ocupa `destino` (reordenado en vivo al arrastrar). */
export function moverTarjeta(ids, id, destino) {
  const i = ids.indexOf(destino);
  if (i < 0 || id === destino || !ids.includes(id)) return ids;
  const l = ids.filter((x) => x !== id);
  l.splice(i, 0, id);
  return l;
}
