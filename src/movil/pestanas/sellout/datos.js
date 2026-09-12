// Datos propios de Sell Out por cliente (móvil). SOLO vía src/lib/queries.js.
//
//   preciosPcel()            → Map sku Acteck → precio de lista vigente para valuar el sell-out de PCEL.
//                              PCEL no reporta importe: se valúa piezas × precio de lista "PCEL PROVISIONAL"
//                              (v_estrategia_precios_lista = el precio más reciente de cada sku+lista) y, si el
//                              sku no está en esa lista, × "Mayoreo AAA". Es la MISMA cascada que usa la vista
//                              v_sellout_unificado, así que la app y la BD valúan igual.
//   mesDeSemana(anio, sem)   → mes ISO de una semana (jueves de la semana): inventario_cliente y sellout_pcel
//                              se cargan por semana, no por mes.
//   useInventarioSkuAnio(…)  → historial semanal del inventario del cliente para UN sku en el año en curso
//                              → stock al cierre de cada mes (última semana cargada de ese mes).
//
// Nada sensible viaja de más: el costo/valor se lee aquí pero la pantalla sólo lo muestra con puedeVerSensible().
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { fetchAll } from '../../../lib/queries';
import { N } from '../../util';

const STALE = 5 * 60 * 1000;
export const LISTA_PCEL = 'PCEL PROVISIONAL';
const LISTA_RESPALDO = 'Mayoreo AAA';

/** Map sku → { precio, lista } con la cascada PCEL PROVISIONAL → Mayoreo AAA. */
export async function preciosPcel() {
  const rows = await fetchAll('v_estrategia_precios_lista', 'sku,lista,precio', (q) => q.in('lista', [LISTA_PCEL, LISTA_RESPALDO]));
  const m = new Map();
  rows.forEach((r) => {
    const p = N(r.precio); if (!(p > 0)) return;
    const hay = m.get(r.sku);
    if (!hay || (hay.lista !== LISTA_PCEL && r.lista === LISTA_PCEL)) m.set(r.sku, { precio: p, lista: r.lista });
  });
  return m;
}

/** Mes (1-12) al que pertenece una semana ISO: el mes de su jueves. */
export function mesDeSemana(anio, semana) {
  const s = N(semana); if (!s) return null;
  const d = new Date(Date.UTC(N(anio), 0, 4));           // el 4 de enero siempre cae en la semana 1
  const dow = (d.getUTCDay() + 6) % 7;                    // 0 = lunes
  d.setUTCDate(d.getUTCDate() - dow + (s - 1) * 7 + 3);   // jueves de la semana `s`
  return d.getUTCMonth() + 1;
}

/**
 * Stock al cierre de cada mes del año para UN sku del cliente.
 *   · digitalife / dicotech → inventario_cliente (cliente, sku, anio, semana)
 *   · pcel                  → sellout_pcel (códigos PCEL del sku, columna `inventario`)
 * Devuelve { porMes: number[12] (null donde no hay semana cargada), semanas: [{ semana, mes, stock }] }.
 */
export function useInventarioSkuAnio(clienteKey, sku, anio, codigosPcel = null) {
  const codigos = codigosPcel ? [...codigosPcel] : null;
  return useQuery({
    queryKey: ['movil', 'sellout-inv-sku', clienteKey, sku, anio, codigos],
    staleTime: STALE,
    enabled: !!clienteKey && !!sku && (clienteKey !== 'pcel' || (codigos?.length > 0)),
    queryFn: async () => {
      const esPcel = clienteKey === 'pcel';
      const rows = esPcel
        ? await fetchAll('sellout_pcel', 'anio,semana,inventario,costo_promedio', (q) => q.eq('anio', anio).in('sku', codigos))
        : await fetchAll('inventario_cliente', 'anio,semana,stock,valor,costo_convenio', (q) => q.eq('cliente', clienteKey).eq('sku', sku).eq('anio', anio));
      // Una semana puede traer varios renglones (varios códigos PCEL del mismo sku): se suman.
      const porSemana = new Map();
      rows.forEach((r) => {
        const sem = N(r.semana); if (!sem) return;
        const o = porSemana.get(sem) || (porSemana.set(sem, { semana: sem, mes: mesDeSemana(anio, sem), stock: 0, valor: 0 }), porSemana.get(sem));
        o.stock += N(esPcel ? r.inventario : r.stock);
        o.valor += esPcel ? N(r.inventario) * N(r.costo_promedio) : (r.valor != null ? N(r.valor) : N(r.stock) * N(r.costo_convenio));
      });
      const semanas = [...porSemana.values()].sort((a, b) => a.semana - b.semana);
      const porMes = Array.from({ length: 12 }, () => null);
      const valorMes = Array.from({ length: 12 }, () => null);
      semanas.forEach((s) => { if (s.mes >= 1 && s.mes <= 12) { porMes[s.mes - 1] = s.stock; valorMes[s.mes - 1] = s.valor; } }); // orden asc → gana la última semana del mes
      return { porMes, valorMes, semanas };
    },
  });
}
