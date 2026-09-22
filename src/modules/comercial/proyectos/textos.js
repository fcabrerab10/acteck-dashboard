// proyectos/textos.js — todo el lenguaje de la pantalla en un solo lugar (web y celular).
// Puro: no importa React ni toca red, así lo pueden usar las pruebas y el cron.
import { int } from '../../../lib/format';
import { MESES_CORTO, MESES_LARGO, PROB_LABEL, CLIENTE_LABEL } from './calculo';

export { PROB_LABEL, CLIENTE_LABEL };

export const TONOS = {
  verde:   { tone: 'green',  label: 'Cubierto' },
  naranja: { tone: 'orange', label: 'Justo' },
  rojo:    { tone: 'red',    label: 'Falta' },
};

export const fechaCortaISO = (iso) => {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  return `${Number(m[3])} ${MESES_CORTO[Number(m[2]) - 1]}`;
};

export const fechaLargaISO = (iso) => {
  if (!iso) return '—';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  if (!m) return String(iso);
  return `${Number(m[3])} de ${MESES_LARGO[Number(m[2]) - 1]}`;
};

export const pctCorto = (v) => (v == null ? '—' : `${Math.round(v)} %`);

/** Frase del hero: qué hay, qué tan cubierto está y qué hay que comprar antes de cuándo. */
export function fraseHero(resumen) {
  if (!resumen || !resumen.proyectos) return 'Todavía no hay proyectos en el horizonte. Crea el primero para empezar a reservar piezas.';
  const p = `${resumen.proyectos} proyecto${resumen.proyectos === 1 ? '' : 's'} por ${int(resumen.piezas)} pz`;
  const cob = resumen.cubiertoPct == null ? '' : `: el ${Math.round(resumen.cubiertoPct)} % ya tiene inventario o tránsito`;
  if (!resumen.skusPorComprar) return `${p}${cob}. No falta comprar nada.`;
  const s = resumen.skusPorComprar === 1 ? 'falta 1 SKU por comprar' : `faltan ${resumen.skusPorComprar} SKUs por comprar`;
  const cuando = resumen.limiteProximo
    ? (resumen.vencidos ? ` — ${resumen.vencidos} ya pasó su fecha límite` : ` antes del ${fechaLargaISO(resumen.limiteProximo)}`)
    : '';
  return `${p}${cob}; ${s}${cuando}.`;
}

export function subHero(resumen) {
  if (!resumen?.proyectos) return 'Un proyecto es una venta comprometida: cliente, mes y SKUs. El tablero calcula solo si alcanza el inventario.';
  const partes = [`${resumen.confirmados} confirmado${resumen.confirmados === 1 ? '' : 's'}`];
  if (resumen.enRiesgo) partes.push(`${resumen.enRiesgo} en riesgo a 30 días`);
  if (resumen.piezasPorComprar) partes.push(`${int(resumen.piezasPorComprar)} pz por comprar`);
  return partes.join(' · ');
}

/** Texto para compartir por WhatsApp desde el celular. */
export function textoCompartir(resumen, compras = []) {
  const l = ['*Proyectos y abasto*', fraseHero(resumen)];
  if (compras.length) {
    l.push('', '*Qué falta comprar*');
    for (const c of compras.slice(0, 10)) {
      l.push(`• ${c.sku} — ${int(c.falta)} pz · límite ${fechaCortaISO(c.limite)}${c.llegaTarde ? ' (vencido)' : ''}`);
    }
    if (compras.length > 10) l.push(`…y ${compras.length - 10} SKUs más.`);
  }
  return l.join('\n');
}

/** Columnas del Excel de "Qué falta comprar" (src/lib/exportar.js). */
export const COLUMNAS_COMPRAS = [
  { key: 'sku',         label: 'SKU',          tipo: 'texto' },
  { key: 'descripcion', label: 'Descripción',  tipo: 'texto' },
  { key: 'falta',       label: 'Falta (pz)',   tipo: 'numero' },
  { key: 'mesLabel',    label: 'Mes objetivo', tipo: 'texto' },
  { key: 'proveedor',   label: 'Proveedor',    tipo: 'texto' },
  { key: 'leadTime',    label: 'Lead time (d)', tipo: 'numero' },
  { key: 'limite',      label: 'Comprar antes de', tipo: 'fecha' },
];

export const COLUMNAS_PROYECTOS = [
  { key: 'nombre',       label: 'Proyecto',    tipo: 'texto' },
  { key: 'clienteLabel', label: 'Cliente',     tipo: 'texto' },
  { key: 'mesLabel',     label: 'Mes',         tipo: 'texto' },
  { key: 'probLabel',    label: 'Probabilidad', tipo: 'texto' },
  { key: 'responsable',  label: 'Responsable', tipo: 'texto' },
  { key: 'skus',         label: 'SKUs',        tipo: 'numero' },
  { key: 'pz',           label: 'Piezas',      tipo: 'numero' },
  { key: 'cubierto',     label: 'Cubierto',    tipo: 'numero' },
  { key: 'faltante',     label: 'Faltante',    tipo: 'numero' },
];
