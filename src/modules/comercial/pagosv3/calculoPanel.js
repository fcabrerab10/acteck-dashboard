// Pagos · lo que pintan los paneles «Cálculo» y «Marketing», ya armado (puro: sin React ni red).
// Lo comparten la web (PanelCalculo.jsx, PanelMarketing.jsx) y el celular (movil/pestanas/pagos/SeccionesM.jsx).
// Extraído de los componentes web el 2026-11-18 (congruencia web ↔ celular); las fórmulas siguen en motor.js.
import M, { mesDeActividad } from './motor';
import { reglaDe } from './reglas';

/** Meses que ofrece el panel de Cálculo: el del período y los dos anteriores del mismo año. */
export function mesesCalculo(mes) {
  const arr = [];
  for (let m = Math.max(1, mes - 2); m <= mes; m++) arr.push(m);
  return arr;
}

/** Factor para proyectar al cierre un mes en curso (días del mes ÷ día de hoy); 1 si el mes ya cerró. */
export function factorProyeccion(anio, mes, hoy = new Date()) {
  const diasMes = new Date(anio, mes, 0).getDate();
  const diaHoy = (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) ? hoy.getDate() : diasMes;
  return diaHoy > 0 ? diasMes / diaHoy : 1;
}

/** Rebate y SPIFF de cada cliente para (anio, mes) con la regla vigente. */
export function bloquesCalculo({ clientes = [], reglas = [], datosMotor = {}, anio, mes }) {
  const per = M.periodoMes(anio, mes);
  const q = M.qDeMes(mes);
  return clientes.map((cliente) => {
    const rReb = reglaDe(reglas, cliente, 'rebate');
    const rSpiff = reglaDe(reglas, cliente, 'spiff');
    const sellIn = datosMotor.sellInMes?.[cliente]?.[per] || 0;
    const cuota = datosMotor.cuotaMes?.[cliente]?.[per] || 0;
    const sellOut = datosMotor.sellOutMes?.[cliente]?.[per] || 0;

    let rebate = null;
    if (rReb?.frecuencia === 'mensual') {
      rebate = M.rebateMensual({ cliente, anio, mes, sellIn, cuota, regla: rReb });
    } else if (rReb?.frecuencia === 'trimestral' && rReb.modo === 'niveles') {
      const ms = M.mesesDeQ(q);
      const siQ = ms.reduce((s, m) => s + (datosMotor.sellInMes?.[cliente]?.[M.periodoMes(anio, m)] || 0), 0);
      const cuQ = ms.reduce((s, m) => s + (datosMotor.cuotaMes?.[cliente]?.[M.periodoMes(anio, m)] || 0), 0);
      rebate = M.rebateTrimestralNiveles({ cliente, anio, q, sellInQ: siQ, cuotaQ: cuQ, regla: rReb });
    } else if (rReb?.frecuencia === 'trimestral') {
      rebate = M.rebateTrimestralCategorias({ cliente, anio, q, porCategoria: datosMotor.sellInQCategorias?.[cliente]?.[M.periodoQ(anio, q)], regla: rReb });
    }

    const spiff = rSpiff?.base === 'sell_out'
      ? M.spiffSellOut({ cliente, anio, mes, sellOut, cuotaSellIn: cuota, regla: rSpiff })
      : (rSpiff ? M.spiffSellIn({ cliente, anio, mes, sellIn, cuota, regla: rSpiff }) : null);

    const etiquetaRebate = rReb?.frecuencia === 'mensual' ? `Rebate ${M.MESES_CORTOS[mes - 1]}` : `Rebate Q${q}`;
    const etiquetaSpiff = spiff?.detalle?.cuota_sell_out != null ? `SPIFF sell out ${M.MESES_CORTOS[mes - 1]}` : `SPIFF ${M.MESES_CORTOS[mes - 1]}`;
    return { cliente, rebate, spiff, rReb, sellIn, cuota, sellOut, q, etiquetaRebate, etiquetaSpiff };
  });
}

/** Renglón de explicación de una propuesta del motor: «Base $1.2M × 2.00 % · alcance 104 % · Nivel 2». */
export function explicaPropuesta(p, { dinero = (n) => String(n), pct = (n) => `${Math.round(n * 100)} %` } = {}) {
  const d = p?.detalle || {};
  return [
    d.base != null ? `Base ${dinero(d.base)}${d.pct != null ? ` × ${(d.pct * 100).toFixed(2)} %` : ''}` : (d.pct != null ? `${(d.pct * 100).toFixed(2)} %` : null),
    d.alcance != null ? `alcance ${pct(d.alcance)}` : null,
    d.nivel || null,
  ].filter(Boolean).join(' · ');
}

/** Dinámica de vendedores de Dicotech del mes, con la meta y los premios guardados (pagos_dinamica_mes). */
export function calculoDinamica({ anio, mes, reglas = [], datosMotor = {}, dinamica = [], meta = null, premios = null }) {
  const cfg = (dinamica || []).find((d) => Number(d.anio) === anio && Number(d.mes) === mes) || null;
  const vendedores = datosMotor.vendedoresDicotech?.[M.periodoMes(anio, mes)] || [];
  const calc = M.dinamicaVendedores({
    anio, mes, vendedores,
    meta: Number(meta ?? cfg?.meta) || 0,
    premios: (premios ?? cfg?.premios ?? []).map((p) => ({ pos: p.pos, premio: p.premio, monto: Number(p.monto) || 0 })),
    regla: reglaDe(reglas, 'dicotech', 'dinamica'),
  });
  return { cfg, calc, meta: Number(meta ?? cfg?.meta) || 0 };
}

/** Actividades de marketing del mes de los clientes dados + la propuesta de pago «lo paga la empresa» por cliente. */
export function marketingDelPeriodo({ actividades = [], clientes = [], anio, mes, pagos = [] }) {
  const delMes = (actividades || []).filter((a) => clientes.includes(a.cliente) && Number(a.anio) === anio && mesDeActividad(a) === mes);
  const porCliente = clientes.map((c) => {
    const acts = delMes.filter((a) => a.cliente === c);
    const prop = M.marketingDelMes({ cliente: c, anio, mes, actividades: acts }).pago;
    const fondo = acts.filter((a) => a.cobro === 'fondo').reduce((s, a) => s + (Number(a.inversion ?? a.costo) || 0), 0);
    return { cliente: c, acts, prop, fondo, yaHay: (pagos || []).some((p) => p.clave_calculo === prop.clave) };
  }).filter((x) => x.acts.length > 0);
  return { delMes, porCliente };
}
