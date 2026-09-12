// Disponibilidad de campos por cliente.
//
// Regla de Fernando (2026-09-11): "si la fuente de un cliente NO trae un dato, ese
// KPI / columna / stat NO se muestra". Ni un guion, ni un aviso: simplemente no está.
//
// Cada cliente carga su inventario / sell out con un Excel distinto, así que las
// columnas pobladas cambian de cliente a cliente (hoy: Dicotech no manda
// `dias_sin_venta` ni `precio_venta`; Digitalife manda `valor` vacío y el importe se
// reconstruye con stock × costo_convenio; PCEL no manda ni días sin venta ni fecha de
// última venta). En vez de listar esos casos a mano —que envejecen con cada cambio del
// archivo del cliente— se miran las filas que la pantalla YA tiene en memoria (la última
// semana/foto cargada) y se decide con el dato real.
//
// Uso típico:
//
//   const campos = disponibilidadDeCampos('dicotech', filasUltimaSemana,
//     ['valor', 'costo_convenio', 'dias_sin_venta', 'fecha_ultima_venta']);
//   campos.hay('dias_sin_venta')   // false → no se pinta el KPI "SKUs sin venta 30+ días"
//
// Un campo cuenta como disponible cuando, en las filas revisadas, hay al menos un valor
// que no es null / undefined / '' y que —si es numérico— no es 0 en todas las filas (un
// `valor` todo en ceros es una columna vacía disfrazada, no un inventario que vale $0).

const VACIO = (v) => v == null || v === '' || (typeof v === 'number' && !Number.isFinite(v));

/** Última semana presente en las filas: { anio, semana } o null. */
export function ultimaSemana(filas = [], campoAnio = 'anio', campoSemana = 'semana') {
  let mejor = null;
  for (const f of filas || []) {
    const a = Number(f?.[campoAnio]) || 0, s = Number(f?.[campoSemana]) || 0;
    if (!a && !s) continue;
    if (!mejor || a * 100 + s > mejor.anio * 100 + mejor.semana) mejor = { anio: a, semana: s };
  }
  return mejor;
}

/** Filas de la última semana cargada (si las filas traen anio/semana; si no, todas). */
export function filasUltimaSemana(filas = [], campoAnio = 'anio', campoSemana = 'semana') {
  const u = ultimaSemana(filas, campoAnio, campoSemana);
  if (!u) return filas || [];
  return (filas || []).filter((f) => (Number(f?.[campoAnio]) || 0) === u.anio && (Number(f?.[campoSemana]) || 0) === u.semana);
}

/**
 * ¿Qué campos trae realmente la fuente de este cliente?
 *
 * @param {string}   cliente  cliente_key ('digitalife' | 'pcel' | 'dicotech' | …). Sólo se
 *                            usa para etiquetar el resultado; la decisión sale de los datos.
 * @param {Array}    filas    filas ya cargadas (idealmente la última semana / foto).
 * @param {string[]} campos   campos a revisar. Si se omite, se revisan las llaves de las filas.
 * @param {object}   opts     { soloUltimaSemana = true, campoAnio = 'anio', campoSemana = 'semana' }
 * @returns {{ cliente, filas:number, campos:Record<string,boolean>, hay:(c:string)=>boolean,
 *            falta:(c:string)=>boolean, algunos:(cs:string[])=>boolean, ausentes:string[] }}
 */
export function disponibilidadDeCampos(cliente, filas = [], campos = null, opts = {}) {
  const { soloUltimaSemana = true, campoAnio = 'anio', campoSemana = 'semana' } = opts;
  const base = Array.isArray(filas) ? filas : [];
  const muestra = soloUltimaSemana && base.some((f) => f && f[campoSemana] != null)
    ? filasUltimaSemana(base, campoAnio, campoSemana)
    : base;

  const nombres = campos && campos.length
    ? [...campos]
    : [...new Set(muestra.flatMap((f) => (f && typeof f === 'object' ? Object.keys(f) : [])))];

  const noVacio = {}, noCero = {}, esNumero = {};
  nombres.forEach((c) => { noVacio[c] = 0; noCero[c] = 0; esNumero[c] = true; });

  for (const f of muestra) {
    if (!f || typeof f !== 'object') continue;
    for (const c of nombres) {
      const v = f[c];
      if (VACIO(v)) continue;
      noVacio[c]++;
      const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' && !Number.isNaN(Number(v)) ? Number(v) : null);
      if (n == null) esNumero[c] = false;
      else if (n !== 0) noCero[c]++;
    }
  }

  const mapa = {};
  nombres.forEach((c) => { mapa[c] = noVacio[c] > 0 && (!esNumero[c] || noCero[c] > 0); });

  return {
    cliente: cliente || null,
    filas: muestra.length,
    campos: mapa,
    hay: (c) => mapa[c] === true,
    falta: (c) => mapa[c] !== true,
    algunos: (cs = []) => cs.some((c) => mapa[c] === true),
    ausentes: nombres.filter((c) => !mapa[c]),
  };
}

export default disponibilidadDeCampos;
