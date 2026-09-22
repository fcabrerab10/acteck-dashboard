// Modo visita · "Preparar visita" (2026-09-22).
//
// Antes de salir a ver a un cliente se baja TODO lo de ese cliente de una sentada, estando
// todavía en la oficina con buen internet. Al llegar, aunque no haya señal, las pantallas
// del cliente abren igual.
//
// Dos capas, a propósito:
//   1. React Query — las mismas llamadas que hacen las pantallas (`fetchAll` / `cachedQuery`
//      de lib/queries.js), así que al abrir la pantalla la cache ya está caliente y persiste
//      en IndexedDB (PersistQueryClientProvider, maxAge 7 días).
//   2. Service worker — esas llamadas viajan por la red de verdad, así que el runtime
//      caching de Workbox (`supabase-rest`, NetworkFirst con caída a cache, 7 días) se queda
//      con la respuesta. Ésa es la capa que sobrevive a recargar la app sin señal.
//
// OJO · lo que NO se puede precargar:
//   · los RPC de Supabase van por POST y la Cache API sólo guarda GET: Workbox no los puede
//     cachear (ver docs/SIN_CONEXION.md). Hoy ninguna pantalla de cliente depende de un RPC
//     de lectura; `inicio_datos` es de la portada de dirección general, no del cliente.
//   · Storage (fotos de marketing, PDFs de notas de crédito) queda NetworkOnly.
//
//   import { prepararVisita } from '../../lib/modoVisita';
//   await prepararVisita('pcel', { onProgreso: (hecho, total, paso) => … });
//
import { supabase } from './supabase';
import { fetchAll, cachedQuery } from './queries';
import { queryClient } from './queryClient';

const SIETE_DIAS = 7 * 24 * 60 * 60 * 1000;

// Claves de hook (lib/queries.js y agenda) que se dejan vivas una semana para que el
// persister de IndexedDB las conserve aunque nadie tenga la pantalla abierta.
const CLAVES_LARGAS = [
  ['facturacion_clientes'], ['cuotas_mensuales'], ['roadmap_sku'], ['precios_sku'],
  ['inventario_cliente'], ['sellout_sku'], ['lineamientos_cliente'], ['agenda'],
  ['visita'],
];

export const LISTAS_PRECIOS_SELECT = 'sku,lista,moneda,precio,anio,mes';

function alargarCache() {
  for (const k of CLAVES_LARGAS) queryClient.setQueryDefaults(k, { gcTime: SIETE_DIAS });
}

/** Los pasos de la preparación, por cliente. Cada uno es { label, run }. */
export function pasosDeVisita(clienteKey, { anio = new Date().getFullYear() } = {}) {
  const anioPrev = anio - 1;
  const anios = [anioPrev, anio];
  const pasos = [];

  // ── 1 · Resumen del cliente (Home V3) ──
  pasos.push({
    label: 'Resumen del cliente',
    run: async () => {
      const [{ cargarHomeData }, { configDe }] = await Promise.all([
        import('../modules/comercial/home/useHomeData'),
        import('../modules/comercial/home/config'),
      ]);
      await cargarHomeData(clienteKey, configDe(clienteKey, null), anio);
    },
  });

  // ── 2 · Sell In (las 3 pantallas comparten estas fuentes) ──
  pasos.push({
    label: 'Sell In',
    run: () => Promise.all([
      // SellInClienteV2 (Digitalife) pide más columnas; Dicotech/PCEL el select corto.
      queryClient.fetchQuery({
        queryKey: ['facturacion_clientes', clienteKey, anios, 'sku,anio,mes,piezas,monto,cliente_nombre,canal'],
        queryFn: () => fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto,cliente_nombre,canal', (q) => q.eq('cliente_key', clienteKey).in('anio', anios)),
        gcTime: SIETE_DIAS,
      }),
      fetchAll('facturacion_clientes', 'sku,anio,mes,piezas,monto', (q) => q.eq('cliente_key', clienteKey).in('anio', anios)),
      fetchAll('roadmap_sku', 'sku,marca,descripcion,categoria,familia,rdmp'),
      fetchAll('cuotas_mensuales', 'mes,anio,cuota_min,cuota_ideal', (q) => q.eq('cliente', clienteKey).eq('anio', anio)),
      queryClient.fetchQuery({
        queryKey: ['cuotas_mensuales', clienteKey, anio],
        queryFn: () => fetchAll('cuotas_mensuales', '*', (q) => q.eq('cliente', clienteKey).eq('anio', anio)),
        gcTime: SIETE_DIAS,
      }),
    ]),
  });

  // ── 3 · Sell Out (una receta por cliente, igual que las pantallas) ──
  pasos.push({ label: 'Sell Out', run: () => sellOutDeCliente(clienteKey, anio, anioPrev) });

  // ── 4 · Inventario del cliente ──
  pasos.push({
    label: 'Inventario del cliente',
    run: () => Promise.all([
      queryClient.fetchQuery({
        queryKey: ['inventario_cliente', clienteKey],
        queryFn: () => fetchAll('v_inventario_cliente_ultimo', 'sku,marca,titulo,stock,valor,costo_convenio,precio_venta,fecha_ultima_venta,dias_sin_venta,anio,semana', (q) => q.eq('cliente', clienteKey)),
        gcTime: SIETE_DIAS,
      }),
      fetchAll('v_inventario_cliente_sucursal_ultimo', 'sku,sucursal,stock,valor,costo_convenio,anio,semana', (q) => q.eq('cliente', clienteKey)),
      fetchAll('v_inventario_comercial', 'sku,disponible,inventario'),
      fetchAll('v_transito_sku', 'sku,cantidad,eta_mas_cercana,embarques_detalle', (q) => q.gt('cantidad', 0)),
    ]),
  });

  // ── 5 · Precios de lista (armar una propuesta en la mesa del cliente) ──
  pasos.push({
    label: 'Listas de precios',
    run: () => Promise.all([
      fetchAll('v_estrategia_precios_lista', LISTAS_PRECIOS_SELECT),
      fetchAll('v_estrategia_precios_lista', 'sku,lista,precio'),
      queryClient.fetchQuery({ queryKey: ['precios_sku'], queryFn: () => fetchAll('precios_sku', '*'), gcTime: SIETE_DIAS }),
    ]),
  });

  // ── 6 · Propuestas recientes del cliente ──
  pasos.push({
    label: 'Propuestas recientes',
    run: async () => {
      const { listarPropuestas } = await import('../modules/comercial/propuestas/recientes');
      const datos = await listarPropuestas({ clienteKey, limit: 50 });
      queryClient.setQueryData(['visita', 'propuestas', clienteKey], datos);
    },
  });

  // ── 7 · Reuniones, minutas y pendientes del cliente ──
  pasos.push({
    label: 'Reuniones y minutas',
    run: async () => {
      const { fetchAgenda, fetchPersonas, fetchComentarios, KEY_AGENDA, KEY_PERSONAS, KEY_COMENTARIOS } = await import('../modules/agenda/datos');
      await Promise.all([
        queryClient.fetchQuery({ queryKey: KEY_AGENDA, queryFn: fetchAgenda, gcTime: SIETE_DIAS }),
        queryClient.fetchQuery({ queryKey: KEY_PERSONAS, queryFn: fetchPersonas, gcTime: SIETE_DIAS }),
        queryClient.fetchQuery({ queryKey: KEY_COMENTARIOS, queryFn: fetchComentarios, gcTime: SIETE_DIAS }),
        // Las 5 últimas minutas del cliente, con la MISMA consulta que useMinutasCliente.
        cachedQuery(supabase.from('agenda_reuniones').select('id,titulo,fecha,estado,cliente_key,tipo').eq('cliente_key', clienteKey).eq('tipo', 'reunion').order('fecha', { ascending: false }).limit(5)),
      ]);
    },
  });

  return pasos;
}

async function sellOutDeCliente(clienteKey, anio, anioPrev) {
  const anios = [anioPrev, anio];
  if (clienteKey === 'dicotech') {
    return Promise.all([
      fetchAll('v_sellout_dicotech_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas'),
      fetchAll('v_sellout_dicotech_sku_mes', 'sku,anio,mes,piezas,monto', (q) => q.in('anio', anios)),
      fetchAll('v_sellout_dicotech_sucursal_mes', 'sucursal,anio,mes,piezas,monto,tx,clientes_distintos', (q) => q.eq('anio', anio)),
      // sellout_general de Dicotech son ~2 años de renglones: es lo más pesado de la visita.
      fetchAll('sellout_general', 'anio,mes,sku,cliente_nombre,vendedor_nombre,sucursal,cantidad,precio_unitario,importe', (q) => q.ilike('mayorista', '%dicotech%').in('anio', anios)),
    ]);
  }
  if (clienteKey === 'pcel') {
    return Promise.all([
      fetchAll('v_sellout_pcel_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas,skus_sin_mapear,piezas_sin_mapear'),
      fetchAll('v_sellout_pcel_sku_mes', 'sku,anio,mes,piezas,monto', (q) => q.in('anio', anios)),
      fetchAll('v_sellout_pcel_marca_mes', 'marca,anio,mes,piezas,monto,tx,skus_distintos', (q) => q.in('anio', anios)),
    ]);
  }
  return Promise.all([
    fetchAll('v_sellout_digitalife_mensual', 'anio,mes,piezas,monto,tx,skus_distintos,clientes_distintos,facturas'),
    fetchAll('v_sellout_digitalife_sku_mes', 'sku,anio,mes,piezas,monto', (q) => q.in('anio', anios)),
    fetchAll('v_sellout_digitalife_marca_mes', 'marca,anio,mes,piezas,monto,tx,skus_distintos', (q) => q.in('anio', anios)),
    fetchAll('v_sellout_detalle_sku_mes', 'sku,anio,mes,piezas,monto', (q) => q.eq('cliente', clienteKey).in('anio', anios)),
  ]);
}

/**
 * Corre la preparación. Nunca lanza: un paso que falla se apunta en `fallos` y el resto sigue
 * (mejor llegar con 6 de 7 pantallas que con ninguna).
 *   → { ok, fallos: [{ label, error }], hora: Date, segundos }
 */
export async function prepararVisita(clienteKey, { anio, onProgreso } = {}) {
  alargarCache();
  const pasos = pasosDeVisita(clienteKey, { anio });
  const fallos = [];
  const t0 = Date.now();
  let hechos = 0;
  for (const paso of pasos) {
    onProgreso?.(hechos, pasos.length, paso.label);
    try { await paso.run(); }
    catch (e) { fallos.push({ label: paso.label, error: String(e?.message || e) }); }
    hechos += 1;
    onProgreso?.(hechos, pasos.length, paso.label);
  }
  return { ok: fallos.length === 0, fallos, pasos: pasos.length, hora: new Date(), segundos: Math.round((Date.now() - t0) / 100) / 10 };
}

/** "Listo para visitar sin conexión · datos al 14:32" */
export function textoListo(hora = new Date()) {
  return `Listo para visitar sin conexión · datos al ${hora.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`;
}

export const LS_VISITA = 'acteck_visita_preparada';

/** Deja constancia (localStorage) de cuándo se preparó cada cliente, para pintarlo en el botón. */
export function marcarVisita(clienteKey, hora = new Date()) {
  try {
    const todo = JSON.parse(localStorage.getItem(LS_VISITA) || '{}');
    todo[clienteKey] = hora.toISOString();
    localStorage.setItem(LS_VISITA, JSON.stringify(todo));
  } catch { /* modo privado */ }
}

export function ultimaVisita(clienteKey) {
  try {
    const todo = JSON.parse(localStorage.getItem(LS_VISITA) || '{}');
    return todo[clienteKey] ? new Date(todo[clienteKey]) : null;
  } catch { return null; }
}
