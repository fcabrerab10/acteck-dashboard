// Carga de datos del Home V3 · SOLO vía src/lib/queries.js (fetchAll / cachedQuery / hooks).
// Tablas que la app escribe (pendientes, minutas, marketing_actividades, pagos, inventario_cliente,
// roadmap_sku, sellout_sku) NO pasan por cachedQuery: se leen directo o por fetchAll como los hooks.
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { fetchAll, cachedQuery, useFacturacion, useCuotasMensuales } from '../../../lib/queries';

const isoHace = (dias) => new Date(Date.now() - dias * 86400000).toISOString().slice(0, 10);
const num = (v) => Number(v) || 0;

// ── Sell-out por cliente → forma canónica { mes:[{anio,mes,monto,piezas}], marcaMes, sucursalMes, sku, diario90, ultimaFecha }
async function cargarSellOut(ck, cfg, anio) {
  const anios = [anio - 1, anio];
  if (cfg.sellOut === 'dicotech') {
    const [men, suc, sku] = await Promise.all([
      cachedQuery(supabase.from('v_sellout_dicotech_mensual').select('anio,mes,piezas,monto').in('anio', anios)),
      cachedQuery(supabase.from('v_sellout_dicotech_sucursal_mes').select('sucursal,anio,mes,monto').eq('anio', anio)),
      fetchAll('sellout_sku', 'sku,mes,piezas,monto_pesos', (q) => q.eq('cliente', ck).eq('anio', anio)),
    ]);
    return { mes: men.data || [], marcaMes: null, sucursalMes: suc.data || [], diario90: null,
      sku: sku.map((r) => ({ sku: r.sku, mes: num(r.mes), piezas: num(r.piezas), monto: num(r.monto_pesos) })) };
  }
  if (cfg.sellOut === 'pcel') {
    const [men, mar, sku] = await Promise.all([
      cachedQuery(supabase.from('v_sellout_pcel_mensual').select('anio,mes,piezas,monto').in('anio', anios)),
      cachedQuery(supabase.from('v_sellout_pcel_marca_mes').select('marca,anio,mes,monto').in('anio', anios)),
      fetchAll('sellout_pcel_mensual', 'sku,mes,piezas', (q) => q.eq('anio', anio)),
    ]);
    return { mes: men.data || [], marcaMes: mar.data || [], sucursalMes: null, diario90: null,
      sku: sku.map((r) => ({ sku: r.sku, mes: num(r.mes), piezas: num(r.piezas), monto: 0 })) };
  }
  // 'detalle' (Digitalife y genérico): vista mensual por sku + detalle diario de 90 días
  const [vista, diario] = await Promise.all([
    fetchAll('v_sellout_detalle_sku_mes', 'sku,marca,anio,mes,piezas,monto,ultima_fecha', (q) => q.eq('cliente', ck).in('anio', anios)),
    cfg.diasInventario === 'diario90' ? fetchAll('sellout_detalle', 'fecha,cantidad', (q) => q.eq('cliente', ck).gte('fecha', isoHace(90))) : Promise.resolve(null),
  ]);
  const ultimaFecha = vista.reduce((m, r) => (r.ultima_fecha && r.ultima_fecha > m ? r.ultima_fecha : m), '');
  return {
    mes: vista.map((r) => ({ anio: r.anio, mes: r.mes, monto: num(r.monto), piezas: num(r.piezas) })),
    marcaMes: vista.map((r) => ({ marca: r.marca, anio: r.anio, mes: r.mes, monto: num(r.monto) })),
    sucursalMes: null, diario90: diario, ultimaFecha: ultimaFecha || null,
    sku: vista.filter((r) => num(r.anio) === anio).map((r) => ({ sku: r.sku, marca: r.marca, mes: num(r.mes), piezas: num(r.piezas), monto: num(r.monto) })),
  };
}

// ── Inventario del cliente → { filas:[{sku,titulo,marca,stock,valor,costo,dias_sin_venta,transito}], anio, semana }
async function cargarInventario(ck, cfg) {
  if (cfg.inventario === 'sellout_pcel') {
    const { data: ult } = await cachedQuery(supabase.from('sellout_pcel').select('anio,semana').not('anio', 'is', null).order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1));
    const u = ult?.[0]; if (!u) return { filas: [], anio: null, semana: null };
    const rows = await fetchAll('sellout_pcel', 'sku,producto,marca,inventario,costo_promedio,antiguedad,transito', (q) => q.eq('anio', u.anio).eq('semana', u.semana));
    return { anio: u.anio, semana: u.semana, filas: rows.map((r) => ({ sku: r.sku, titulo: r.producto || r.sku, marca: r.marca, stock: num(r.inventario), costo: num(r.costo_promedio), valor: num(r.inventario) * num(r.costo_promedio), dias_sin_venta: r.antiguedad, transito: num(r.transito) })) };
  }
  const { data: ult } = await supabase.from('inventario_cliente').select('anio,semana').eq('cliente', ck).not('anio', 'is', null).order('anio', { ascending: false, nullsFirst: false }).order('semana', { ascending: false, nullsFirst: false }).limit(1);
  const u = ult?.[0]; if (!u) return { filas: [], anio: null, semana: null };
  const rows = await fetchAll('inventario_cliente', 'sku,marca,titulo,stock,valor,costo_convenio,precio_venta,dias_sin_venta', (q) => q.eq('cliente', ck).eq('anio', u.anio).eq('semana', u.semana));
  return { anio: u.anio, semana: u.semana, filas: rows.map((r) => {
    const costo = num(r.costo_convenio) || num(r.precio_venta);
    return { sku: r.sku, titulo: r.titulo || r.sku, marca: r.marca, stock: num(r.stock), costo, valor: num(r.valor) > 0 ? num(r.valor) : num(r.stock) * costo, dias_sin_venta: r.dias_sin_venta, transito: 0 };
  }) };
}

// ── sku → { marca, precio } para el split de sell-in y el sugerido de reposición
async function cargarMarcas(ck, cfg) {
  const rows = cfg.marcaSellIn === 'roadmap_sku'
    ? await fetchAll('roadmap_sku', 'sku,marca')
    : (await cachedQuery(supabase.from('productos_cliente').select('sku,marca,precio_venta').eq('cliente', ck))).data || [];
  const map = {}; rows.forEach((r) => { map[String(r.sku)] = { marca: r.marca, precio: num(r.precio_venta) }; });
  return map;
}

export function useHomeData(ck, cfg, anio) {
  const fac = useFacturacion(ck, [anio - 1, anio], 'sku,anio,mes,piezas,monto');
  const cuo = useCuotasMensuales(ck, anio);
  const [st, setSt] = useState({ loading: true, error: null, data: null });

  useEffect(() => {
    let cancel = false;
    setSt({ loading: true, error: null, data: null });
    (async () => {
      try {
        const [ec, pend, min, mkt, pagos, invActeck, so, inv, marcas] = await Promise.all([
          cachedQuery(supabase.from('estados_cuenta').select('id,anio,semana,fecha_corte,saldo_actual,saldo_vencido,saldo_a_vencer,notas_credito,dso').eq('cliente', ck).order('fecha_corte', { ascending: true })),
          supabase.from('pendientes').select('id,titulo,descripcion,responsable,fecha_entrega,estado,tipo').eq('cliente', ck).eq('archivado', false).order('fecha_entrega', { ascending: true, nullsFirst: false }),
          supabase.from('minutas').select('id,fecha_reunion,titulo,fuente,contenido').eq('cliente', ck).order('fecha_reunion', { ascending: false }).limit(5),
          supabase.from('marketing_actividades').select('id,nombre,tipo,estatus,fecha,mes,anio,inversion,semana').eq('cliente', ck).eq('anio', anio),
          supabase.from('pagos').select('id,concepto,categoria,monto,estatus,fecha_compromiso').eq('cliente', ck).in('estatus', ['pendiente', 'en_proceso']),
          fetchAll('v_inventario_comercial', 'sku,inventario'),
          cargarSellOut(ck, cfg, anio),
          cargarInventario(ck, cfg),
          cargarMarcas(ck, cfg),
        ]);
        const estados = ec.data || [];
        const ultimoId = estados[estados.length - 1]?.id;
        const det = ultimoId ? await cachedQuery(supabase.from('estados_cuenta_detalle').select('movimiento,referencia,vencimiento,saldo_actual').eq('estado_cuenta_id', ultimoId)) : { data: [] };
        if (cancel) return;
        setSt({ loading: false, error: null, data: {
          estados, detalle: det.data || [], pendientes: pend.data || [], minutas: min.data || [], marketing: mkt.data || [],
          pagos: pagos.data || [], invActeck, so, inv, marcas,
        } });
      } catch (e) {
        if (!cancel) setSt({ loading: false, error: e?.message || String(e), data: null });
      }
    })();
    return () => { cancel = true; };
  }, [ck, anio, cfg.sellOut, cfg.inventario, cfg.marcaSellIn, cfg.diasInventario]);

  return {
    loading: st.loading || fac.isLoading || cuo.isLoading,
    error: st.error || fac.error?.message || cuo.error?.message || null,
    data: st.data ? { ...st.data, facturacion: fac.data || [], cuotas: cuo.data || [] } : null,
  };
}
