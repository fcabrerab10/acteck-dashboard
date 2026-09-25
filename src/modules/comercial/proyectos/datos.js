// proyectos/datos.js — acceso a datos de "Proyectos y abasto" (web y celular).
//
// Reglas del proyecto (CLAUDE.md · Rendimiento):
//   · `proyectos` y `proyecto_lineas` las ESCRIBE la app → nunca pasan por cachedQuery;
//     van con useQuery propio y se invalidan a mano después de cada escritura.
//   · El abasto (inventario, tránsito, lead times, catálogo) es de sólo lectura y pesado:
//     ahí sí se usa fetchAll de src/lib/queries.js (paginación paralela + cache 5 min).
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../../lib/supabase';
import { queryClient } from '../../../lib/queryClient';
import { fetchAll } from '../../../lib/queries';
import { marcaDeSku, normalizarMarca } from '../../../lib/marcas';
// Buzón de salida: los proyectos se capturan en la visita, muchas veces sin señal.
import { escribir } from '../../../lib/buzon';

const KEY_PROYECTOS = ['proyectos'];
const KEY_ABASTO = ['proyectos', 'abasto'];
const KEY_HISTORIAL = ['proyectos', 'historial'];

export const invalidarProyectos = () => queryClient.invalidateQueries({ queryKey: KEY_PROYECTOS });

// ─── Lectura ───

/** Proyectos + sus líneas (dos queries en paralelo; el volumen es de decenas de filas). */
export function useProyectos() {
  return useQuery({
    queryKey: KEY_PROYECTOS,
    staleTime: 30 * 1000,
    queryFn: async () => {
      const [pr, ln] = await Promise.all([
        supabase.from('proyectos').select('*').order('anio', { ascending: true }).order('mes', { ascending: true }),
        supabase.from('proyecto_lineas').select('*'),
      ]);
      if (pr.error) throw pr.error;
      if (ln.error) throw ln.error;
      return { proyectos: pr.data || [], lineas: ln.data || [] };
    },
  });
}

/** Inventario disponible, tránsito con ETA, lead times y descripciones de SKU. */
export function useAbasto() {
  return useQuery({
    queryKey: KEY_ABASTO,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const opcional = (p) => p.catch(() => []);
      const hoyISO = new Date().toISOString().slice(0, 10);
      const [inventario, transito, leadTimes, leadProveedor, roadmap, catalogo, embarques, preciosLista] = await Promise.all([
        fetchAll('v_inventario_comercial', 'sku,disponible,inventario'),
        fetchAll('v_transito_sku', 'sku,supplier,cantidad,eta_mas_cercana,embarques,embarques_detalle'),
        opcional(fetchAll('v_lead_time_sku', 'sku,dias_promedio,muestras,supplier_principal,familia')),
        opcional(fetchAll('v_lead_time_supplier', 'supplier,dias_promedio,muestras')),
        opcional(fetchAll('roadmap_sku', 'sku,descripcion,marca,categoria')),
        opcional(fetchAll('catalogo_articulos', 'articulo,descripcion')),
        // Mercancía en camino: es la ÚNICA fuente de un SKU estrenado (marca nueva o
        // producto nuevo) antes de que el ERP lo facture y de que entre al roadmap.
        // Es el caso de Audive (AV-*): 19 SKUs en producción con arribo a CEDIS.
        opcional(fetchAll('embarques_compras', 'codigo,descripcion,arribo_cedis,estatus',
          (q) => q.or(`arribo_cedis.gte.${hoyISO},arribo_cedis.is.null`))),
        // Listas de precio por SKU (v_estrategia_precios_lista): el precio de cada línea se elige de aquí o es personalizado.
        opcional(fetchAll('v_estrategia_precios_lista', 'sku,lista,precio')),
      ]);
      const precios = new Map();
      for (const r of preciosLista) { if (!r.sku || !r.lista) continue; const m = precios.get(r.sku) || {}; m[r.lista] = Number(r.precio) || 0; precios.set(r.sku, m); }
      const descripciones = new Map();
      for (const c of catalogo) if (c.articulo) descripciones.set(c.articulo, c.descripcion || '');
      for (const r of roadmap) if (r.sku && r.descripcion) descripciones.set(r.sku, r.descripcion);
      // Catálogo para el buscador de SKUs del formulario (roadmap primero: son los vivos).
      const vistos = new Set();
      const catalogoSkus = [];
      for (const r of roadmap) {
        if (!r.sku || vistos.has(r.sku)) continue;
        vistos.add(r.sku);
        catalogoSkus.push({ sku: r.sku, descripcion: r.descripcion || '', marca: normalizarMarca(r.marca) || marcaDeSku(r.sku), enRoadmap: true });
      }
      for (const c of catalogo) {
        if (!c.articulo || vistos.has(c.articulo)) continue;
        vistos.add(c.articulo);
        catalogoSkus.push({ sku: c.articulo, descripcion: c.descripcion || '', marca: marcaDeSku(c.articulo), enRoadmap: false });
      }
      // Tercera fuente: lo que viene en camino. Se queda con el arribo MÁS CERCANO por SKU
      // y se marca `enTransito` para que el buscador lo distinga con la píldora del ETA.
      const enCamino = new Map();
      for (const e of embarques) {
        const sku = String(e.codigo || '').trim();
        if (!sku) continue;
        if (String(e.estatus || '').toUpperCase().includes('ENTREG')) continue;
        const prev = enCamino.get(sku);
        const eta = e.arribo_cedis || null;
        if (!prev) enCamino.set(sku, { descripcion: e.descripcion || '', eta, estatus: e.estatus || '' });
        else if (eta && (!prev.eta || eta < prev.eta)) { prev.eta = eta; prev.estatus = e.estatus || prev.estatus; }
      }
      for (const [sku, info] of enCamino) {
        if (!descripciones.has(sku) && info.descripcion) descripciones.set(sku, info.descripcion);
        const ya = vistos.has(sku) ? catalogoSkus.find((c) => c.sku === sku) : null;
        if (ya) { ya.enTransito = true; ya.etaTransito = info.eta; continue; }
        vistos.add(sku);
        catalogoSkus.push({
          sku, descripcion: info.descripcion || '', marca: marcaDeSku(sku),
          enRoadmap: false, enTransito: true, etaTransito: info.eta, estatusTransito: info.estatus,
        });
      }
      return { inventario, transito, leadTimes, leadProveedor, descripciones, catalogoSkus, precios };
    },
  });
}

/** Historial de cambios de proyectos (auditoria_cambios, trigger fn_auditoria). */
export function useHistorialProyectos({ limite = 200, enabled = true } = {}) {
  return useQuery({
    queryKey: [...KEY_HISTORIAL, limite],
    enabled,
    staleTime: 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('auditoria_cambios')
        .select('id,tabla,operacion,registro_id,cliente_key,usuario_email,cambios,creado_at')
        .in('tabla', ['proyectos', 'proyecto_lineas'])
        .order('creado_at', { ascending: false })
        .limit(limite);
      if (error) throw error;
      return data || [];
    },
  });
}

// ─── Escritura (siempre invalidando la query de proyectos) ───

export async function crearProyecto(campos, perfil) {
  const payload = {
    nombre: String(campos.nombre || '').trim() || 'Proyecto sin nombre',
    cliente: campos.cliente || 'digitalife',
    anio: campos.anio ?? null,
    mes: campos.mes ?? null,
    probabilidad: campos.probabilidad || 'prospecto',
    responsable: campos.responsable || perfil?.nombre || perfil?.email || null,
    notas: campos.notas || null,
    creado_por: perfil?.email || perfil?.nombre || null,
  };
  const { data, offline } = await escribir({ tabla: 'proyectos', op: 'insert', filas: payload, origen: 'Proyectos', titulo: payload.nombre });
  const lineas = (campos.lineas || []).filter((l) => l.sku && Number(l.piezas) > 0);
  if (lineas.length) {
    // `data.id` puede ser un id temporal (tmp_…): el buzón lo sustituye por el real al sincronizar.
    await escribir({
      tabla: 'proyecto_lineas', op: 'insert', origen: 'Proyectos', titulo: payload.nombre,
      filas: lineas.map((l) => ({ proyecto_id: data.id, sku: l.sku, piezas: Math.round(Number(l.piezas)) || 0, reservado: Math.round(Number(l.reservado)) || 0, precio: l.precio == null || l.precio === '' ? null : Number(l.precio) || 0, lista: l.lista || null, notas: l.notas || null })),
    });
  }
  if (!offline) await invalidarProyectos();
  return data;
}

export async function actualizarProyecto(id, cambios) {
  const { offline } = await escribir({ tabla: 'proyectos', op: 'update', filas: cambios, match: { id }, origen: 'Proyectos' });
  if (!offline) await invalidarProyectos();
}

export async function eliminarProyecto(id) {
  const { offline } = await escribir({ tabla: 'proyectos', op: 'delete', match: { id }, origen: 'Proyectos' });
  if (!offline) await invalidarProyectos();
}

/** Alta o edición de una línea (unique proyecto_id + sku). */
export async function guardarLinea(proyectoId, linea) {
  const payload = {
    proyecto_id: proyectoId,
    sku: linea.sku,
    piezas: Math.round(Number(linea.piezas)) || 0,
    reservado: Math.round(Number(linea.reservado)) || 0,
    notas: linea.notas || null,
    ...(linea.precio !== undefined ? { precio: linea.precio === null || linea.precio === '' ? null : Number(linea.precio) || 0 } : {}),
    ...(linea.lista !== undefined ? { lista: linea.lista || null } : {}),
  };
  const { offline } = await escribir({ tabla: 'proyecto_lineas', op: 'upsert', filas: payload, onConflict: 'proyecto_id,sku', origen: 'Proyectos', titulo: linea.sku });
  if (!offline) await invalidarProyectos();
}

export async function eliminarLinea(id) {
  const { offline } = await escribir({ tabla: 'proyecto_lineas', op: 'delete', match: { id }, origen: 'Proyectos' });
  if (!offline) await invalidarProyectos();
}

/** "Reservar": marca piezas ya apartadas en Acteck para esa línea. */
export async function reservarLinea(id, reservado) {
  const { offline } = await escribir({ tabla: 'proyecto_lineas', op: 'update', filas: { reservado: Math.max(0, Math.round(Number(reservado)) || 0) }, match: { id }, origen: 'Proyectos' });
  if (!offline) await invalidarProyectos();
}

// ─── "Mandar al S&OP" ───
// Reusa el flujo de solicitudes de compra que ya existe (forecast/useSolicitudes.js):
// se busca un borrador abierto del usuario y se le agregan las líneas faltantes; si no
// hay borrador se crea uno. Karolina lo ve en S&OP › Solicitudes con el resto.
export async function mandarAlSop(compras, perfil) {
  const filas = (compras || []).filter((c) => c.sku && c.falta > 0);
  if (!filas.length) return { ok: false, motivo: 'No hay faltantes que mandar.' };

  const uid = perfil?.user_id || perfil?.id || null;
  let solicitud = null;
  const busca = await supabase.from('solicitudes_compra').select('*').eq('estado', 'borrador')
    .order('fecha_creacion', { ascending: false }).limit(1);
  if (busca.error) throw busca.error;
  solicitud = (busca.data || [])[0] || null;

  if (!solicitud) {
    const { data, error } = await supabase.from('solicitudes_compra')
      .insert({ estado: 'borrador', notas: 'Proyectos y abasto', creado_por: uid, anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 })
      .select().single();
    if (error) throw error;
    solicitud = data;
  }

  const prev = await supabase.from('solicitudes_compra_lineas').select('id,sku,orden').eq('solicitud_id', solicitud.id);
  if (prev.error) throw prev.error;
  const yaEstan = new Set((prev.data || []).map((l) => l.sku));
  let orden = Math.max(0, ...(prev.data || []).map((l) => Number(l.orden) || 0));

  const nuevas = filas.filter((c) => !yaEstan.has(c.sku)).map((c) => ({
    solicitud_id: solicitud.id,
    sku: c.sku,
    descripcion: c.descripcion || null,
    cantidad: c.falta,
    proveedor: c.proveedor || null,
    fecha_estimada: c.limite || null,
    orden: ++orden,
  }));
  if (nuevas.length) {
    const { error } = await supabase.from('solicitudes_compra_lineas').insert(nuevas);
    if (error) throw error;
  }
  await queryClient.invalidateQueries({ queryKey: ['solicitudes_compra'] });
  return { ok: true, solicitudId: solicitud.id, agregadas: nuevas.length, repetidas: filas.length - nuevas.length };
}
