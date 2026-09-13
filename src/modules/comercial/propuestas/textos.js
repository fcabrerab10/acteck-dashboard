// textos.js — resumen limpio de la propuesta para WhatsApp (variante de src/lib/whatsapp.js, que NO se toca).
// Nunca lleva costo, margen ni nombre de lista. Precio sin IVA ($#,##0.00 + IVA). Total sin IVA.
import { piezas as fmtPz, precio as fmtPx, nombreCorto } from '../../../lib/whatsapp';
import { MES_FULL, finDeMesISO } from './constantes';

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** 'YYYY-MM-DD' → '30 sep 2026'. Si no parsea, devuelve el texto tal cual. */
export function vigenciaTexto(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
  if (!m) return String(iso || '');
  return `${Number(m[3])} ${MESES[Number(m[2]) - 1]} ${m[1]}`;
}

/** Vigencia por defecto (texto): último día del mes objetivo de la propuesta. */
export function vigenciaDe(anio, mes) {
  const a = anio || new Date().getFullYear(), m = mes || new Date().getMonth() + 1;
  return vigenciaTexto(finDeMesISO(a, m));
}

/**
 * textoPropuesta({ clienteLabel, nombre, anio, mes, lineas, marca, vigencia, eanPorSku }) → string
 *   vigencia: 'YYYY-MM-DD' (columna propuestas_borradores.vigencia) o texto ya formateado.
 *   eanPorSku: Map sku → ean (opcional, de src/lib/ean.js). Si hay EAN se imprime bajo la línea del SKU.
 *
 *   *Acteck · Propuesta Digitalife*
 *   Cierre Septiembre 2026 · vigencia al 30 sep 2026
 *
 *   • AC-928984 · Mouse Óptico · 100 pz · $92.00 + IVA
 *     EAN 7506215289845
 *   …
 *   Total: $9,200.00 + IVA · 1 SKU · 100 pz
 */
export function textoPropuesta({ clienteLabel, nombre, anio, mes, lineas = [], marca = 'Acteck', vigencia, eanPorSku } = {}) {
  const a = anio || new Date().getFullYear(), m = mes || new Date().getMonth() + 1;
  const vig = vigencia ? vigenciaTexto(vigencia) : vigenciaDe(a, m);
  const titulo = [(nombre || '').trim(), `${MES_FULL[m - 1]} ${a}`].filter(Boolean).join(' ');
  const out = [`*${marca} · Propuesta ${clienteLabel || ''}*`.trim(), `${titulo} · vigencia al ${vig}`, ''];
  let total = 0, pz = 0;
  for (const l of lineas) {
    const n = Number(l.piezas) || 0, p = Number(l.precio) || 0;
    total += n * p; pz += n;
    const nom = nombreCorto(l.descripcion);
    out.push(`• ${l.sku}${nom ? ` · ${nom}` : ''} · ${fmtPz(n)} pz · ${fmtPx(p)} + IVA`);
    const ean = l.ean || eanPorSku?.get?.(l.sku);
    if (ean) out.push(`  EAN ${ean}`);
  }
  out.push('', `Total: ${fmtPx(total)} + IVA · ${lineas.length} SKU${lineas.length === 1 ? '' : 's'} · ${fmtPz(pz)} pz`);
  return out.join('\n');
}
