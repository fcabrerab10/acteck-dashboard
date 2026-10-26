// Página del cliente · «Sell in vs sell out del año, con la cuota» (2026-10-26). Puro.
// Serie de los 12 meses del año elegido: sell in del cliente (cliente.mensual), sell out de la cuenta ligada
// (v_sellout_cuenta_mes), sell in del año anterior y cuota mensual (v_cuota_erp_mes → mapaCuotas). Y la frase de lectura.
import { MESES, N, idxMes } from './calc';

const mesLbl = (m) => MESES[m - 1].toLowerCase();
const fmtM = (n) => { const a = Math.abs(n); const s = a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `$${Math.round(a / 1e3)}K` : `$${Math.round(a)}`; return (n < 0 ? '−' : '') + s; };

/**
 * 12 filas { x, mes, sellIn, sellOut, anterior, cuota }. Los meses después de `hastaMes` llevan sellIn/sellOut null
 * (la línea se detiene); cuota y año anterior van completos. Sin cuenta → sellOut null; sin cuota → cuota null.
 */
export function serieSiSoAnio({ mensual, mensualSO = [], cuenta = null, cuotas = null, cliente, anio, hastaMes = 12 }) {
  const so = new Map();
  if (cuenta) for (const r of mensualSO) if (r.cuenta === cuenta && N(r.anio) === anio) so.set(N(r.mes), N(so.get(N(r.mes))) + N(r.importe));
  return Array.from({ length: 12 }, (_, i) => {
    const mes = i + 1, k = idxMes(anio, mes);
    const futuro = mes > hastaMes;
    const cuota = cuotas ? cuotas.get(`${cliente}|${anio}|${mes}`) : undefined;
    return {
      x: MESES[i], mes,
      sellIn: futuro ? null : N(mensual?.get(k)?.fact_neta),
      sellOut: cuenta ? (futuro ? null : N(so.get(mes))) : null,
      anterior: N(mensual?.get(k - 12)?.fact_neta),
      cuota: cuota == null ? null : N(cuota),
    };
  });
}

/** Frase corta: racha contra la cuota + último mes con sell out (desplazó / le vendimos / SO/SI). */
export function fraseSiSo(serie = [], { anio, hastaMes = 12 } = {}) {
  const conSI = serie.filter((d) => d.mes <= hastaMes && (d.sellIn || 0) > 0);
  if (!conSI.length) return `Sin facturación en ${anio}.`;
  const ult = conSI.at(-1);
  const partes = [];
  // Racha contra la cuota, hacia atrás desde el último mes con venta.
  const conCuota = serie.filter((d) => d.mes <= ult.mes && d.cuota > 0);
  if (conCuota.length && ult.cuota > 0) {
    const arriba = ult.sellIn >= ult.cuota;
    let desde = ult.mes;
    for (let m = ult.mes - 1; m >= 1; m -= 1) {
      const d = serie[m - 1];
      if (!(d.cuota > 0)) break;
      if ((d.sellIn || 0) >= d.cuota !== arriba) break;
      desde = m;
    }
    const pctUlt = Math.round((ult.sellIn / ult.cuota) * 100);
    partes.push(desde === ult.mes
      ? `${arriba ? 'arriba' : 'debajo'} de cuota en ${mesLbl(ult.mes)} (${pctUlt} %)`
      : `${arriba ? 'arriba' : 'debajo'} de cuota desde ${mesLbl(desde)} (${mesLbl(ult.mes)} al ${pctUlt} %)`);
  }
  const conSO = serie.filter((d) => d.mes <= hastaMes && (d.sellOut || 0) > 0);
  if (conSO.length) {
    const u = conSO.at(-1);
    const si = u.sellIn || 0;
    const ratio = si > 0 ? (u.sellOut / si).toFixed(1) : null;
    partes.push(`en ${mesLbl(u.mes)} desplazó ${fmtM(u.sellOut)} y le vendimos ${fmtM(si)}${ratio ? `: SO/SI ${ratio}` : ' (sin sell in ese mes)'}`);
  } else {
    const prev = ult.anterior || 0;
    const yoy = prev > 0 ? Math.round(((ult.sellIn - prev) / prev) * 100) : null;
    partes.push(`en ${mesLbl(ult.mes)} le vendimos ${fmtM(ult.sellIn)}${yoy != null ? ` (${yoy >= 0 ? '+' : '−'}${Math.abs(yoy)} % vs ${mesLbl(ult.mes)} ${anio - 1})` : ''}`);
  }
  const f = partes.join('; ');
  return f.charAt(0).toUpperCase() + f.slice(1) + '.';
}
