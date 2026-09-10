// datos.js — lecturas del armador de propuestas compartidas por escritorio y celular:
//   fetchSellout(clienteKey, mm, anioMin, anioMax) → [{ sku, cantidad, anio, mes }] de los 3 meses cerrados
//   fetchSelloutMesActual(clienteKey)              → $ facturado del mes en curso (Digitalife/Dicotech)
//   fetchSpiffsActivos()                           → { list, byKey, meta }
import { supabase } from '../../../lib/supabase';
import { fetchAllQ, cachedQuery } from '../../../lib/queries';
import { MES_ACTUAL } from './constantes';

export async function fetchSelloutMesActual(clienteKey) {
  const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
  if (clienteKey === 'digitalife') {
    // Vista agregada: monto_bruto = Σ(cantidad × precio) ya calculado en Postgres.
    // Antes: .limit(200000) sobre el detalle diario (PostgREST corta en 1000).
    const { data } = await cachedQuery(
      supabase.from('v_sellout_detalle_sku_mes').select('monto_bruto')
        .eq('cliente', 'digitalife').eq('anio', anio).eq('mes', mes),
    );
    return (data || []).reduce((s, r) => s + (Number(r.monto_bruto) || 0), 0);
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('importe')
      .eq('mayorista', 'DICOTECH')
      .eq('anio', anio).eq('mes', mes)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.importe) || 0), 0);
  }
  return 0;
}

// Devuelve { sku, cantidad, anio, mes } — desglose por mes para poder mostrar Jul/Jun/May
// individualmente en la tabla de propuesta.
export async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const mesesSet = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    // Filtrar por rango de fechas de los 3 meses target (no todo desde
    // anioMin) para reducir volumen antes de paginar. Supabase corta en
    // 1000 aunque pases .limit(200000); hay que paginar sí o sí.
    // Vista agregada por sku+mes (v_sellout_detalle_sku_mes): devuelve
    // directamente {sku, piezas, anio, mes}. Antes: detalle diario paginado.
    const aniosMm = Array.from(new Set(mm.map((m) => m.anio)));
    const data = await fetchAllQ(() =>
      supabase.from('v_sellout_detalle_sku_mes')
        .select('sku,piezas,anio,mes')
        .eq('cliente', 'digitalife')
        .in('anio', aniosMm), { label: 'propuestas' });
    return (data || [])
      .filter((r) => mesesSet.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.piezas, anio: Number(r.anio), mes: Number(r.mes) }));
  }
  if (clienteKey === 'pcel') {
    // sellout_pcel trae los últimos 3 meses en columnas vta_mes_actual, vta_mes_1, vta_mes_2
    // relativo a la SEMANA. `_actual` = mes cursando, `_1` = mes anterior, `_2` = 2 atrás.
    // vta_mes_3 en el archivo siempre viene null, por eso no lo usamos.
    // Además: el SKU del roadmap (AC-XXXX) vive en la columna `modelo`,
    // NO en `sku` (que trae el código interno de PCEL como "345094").
    const { data } = await supabase.from('sellout_pcel')
      .select('modelo,anio,semana,vta_mes_actual,vta_mes_1,vta_mes_2')
      .gte('anio', anioMax - 1).not('modelo', 'is', null).limit(50000);
    const byKey = new Map();
    for (const r of data || []) {
      if (!r.modelo) continue;
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = byKey.get(r.modelo);
      if (!prev || prev.key < key) byKey.set(r.modelo, { key, r });
    }
    const out = [];
    for (const { r } of byKey.values()) {
      // mm[0] = mes anterior a hoy, mm[1] = 2 atrás, mm[2] = 3 atrás
      // Mapeo: vta_mes_1 = mm[0], vta_mes_2 = mm[1], vta_mes_actual = mes en curso (no lo usamos aquí)
      const cols = [Number(r.vta_mes_1) || 0, Number(r.vta_mes_2) || 0, 0];
      mm.forEach((m, i) => {
        if (cols[i] > 0) out.push({ sku: r.modelo, cantidad: cols[i], anio: m.anio, mes: m.mes });
      });
    }
    return out;
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin).limit(200000);
    return (data || [])
      .filter((r) => mesesSet.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad, anio: Number(r.anio), mes: Number(r.mes) }));
  }
  return [];
}

// ═══ Fetch de SPIFFs activos hoy ═══
export async function fetchSpiffsActivos() {
  const hoy = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase.from('spiffs')
    .select('sku,monto,vigencia_inicio,vigencia_fin,descripcion,fuente')
    .lte('vigencia_inicio', hoy).gte('vigencia_fin', hoy);
  if (error) return { list: [], byKey: new Map(), meta: null };
  const byKey = new Map();
  for (const r of data || []) byKey.set(r.sku, r);
  const meta = data && data.length > 0
    ? {
        total: data.length,
        potencial: data.reduce((s, r) => s + Number(r.monto || 0), 0), // suma monto/pz — no potencial real
        vigencia_inicio: data[0].vigencia_inicio,
        vigencia_fin: data[0].vigencia_fin,
        fuente: data[0].fuente,
      }
    : null;
  return { list: data || [], byKey, meta };
}
