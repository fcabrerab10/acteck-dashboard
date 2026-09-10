// api/import-central.js
// Endpoint simple de upsert por chunks. El cliente parsea el Excel y envÃÂ­a
// lotes de filas ya mapeadas: { table, rows, onConflict }
//
// Tablas permitidas y sus unique keys: ver ALLOWED abajo.
//
// Callers:
//   · uploads.html (usuario super_admin con JWT de Supabase)
//   · bridge/ (puente SQL Server → Supabase en la Mac mini de la oficina) con
//     header `x-sync-secret` (ver docs/SYNC_SQL_BRIDGE.md). El puente además
//     manda { table, syncEvent:{...} } al terminar cada fuente para dejar
//     rastro en sync_events / sync_status (mismo historial que el uploader).

import { requireSuperAdmin, isSyncRequest } from './_auth.js';

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED = {
  inventario_acteck:  'articulo,no_almacen',
  ventas_erp:         'venta_id,venta_renglon',
  // Base de ventas del ERP v2 (Vw_TablaH_Ventas por streaming, columnas mínimas).
  // Alimenta v_erp_medidas (medidas del director). Replace por año (deleteAnios).
  erp_ventas:         'venta_id,venta_renglon',
  sellout_detalle:    'cliente,fecha,no_parte,row_hash',
  inventario_cliente: 'cliente,sku,anio,semana',
  roadmap_sku:       'sku',
  precios_sku:       'sku,lista,anio,mes',
  transito_sku:      'sku,row_hash',
  sellout_pcel:          'anio,semana,sku',
  sellout_pcel_mensual:  'anio,mes,sku',
  catalogo_sku_pcel:     'sku',
  estados_cuenta:        'cliente,anio,semana',
  estados_cuenta_detalle:'id',
  // Anchor por recibo: una PO puede llegar en varios shipments legítimos,
  // pero (po, codigo, arribo_cedis, shp_qty) debe ser único. Hay constraint
  // UNIQUE en la BD respaldando esto. Antes usaba (po,codigo,contenedor) y
  // permitía filas duplicadas exactas cuando el Excel origen las tenía.
  embarques_compras:     'po,codigo,arribo_cedis,shp_qty',
  facturacion_clientes:  'cliente_nombre,sku,anio,mes',
  estados_resultados:    'razon_social,anio,mes,cuenta_norm',
  compras_oc:            'movid,articulo',
  promos_temporada:      'sku,anio,mes,campania',
  sellout_general:       'id',
  cuotas_mensuales:      'cliente,mes,anio',
  inventario_cliente_sucursal: 'cliente,sku,sucursal,anio,semana',
  // Fase 3 · hojas adicionales del Master Embarques
  programacion_arribos: 'contenedor',
  series_generadas:     'po,sku',
  proveedores_master:   'codigo,articulo',
  catalogo_articulos:   'articulo',
  // Fase 4 · overrides por SKU del sugerido de compra
  sku_config:           'sku',
  // Guías por factura del ERP · alimenta auto-relleno de Tracking Pedidos
  guias_erp:            'mov,movid',
  // SPIFFs por SKU (incentivo por pieza vendida) — se sube desde Propuestas
  spiffs:               'sku',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  const viaPuente = isSyncRequest(req);
  let perfil = null;
  if (!viaPuente) {
    perfil = await requireSuperAdmin(req, res);
    if (!perfil) return;
  }

  try {
    const { table, rows, deleteAnios, deletePeriodos, deleteAll, deleteCliente, finalize, anios, syncEvent } = req.body || {};
    if (!table || !ALLOWED[table]) return res.status(400).json({ error: 'invalid table. allowed: ' + Object.keys(ALLOWED).join(', ') });

    // syncEvent: bitácora de una corrida del puente (o de cualquier caller).
    // Inserta en sync_events (historial por tarjeta del uploader) y, si fue
    // success, actualiza sync_status.<fuente> (badge "última actualización").
    if (syncEvent && typeof syncEvent === 'object') {
      const status = ['success', 'error', 'warning'].includes(syncEvent.status) ? syncEvent.status : 'warning';
      const hdr = { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
      const ev = {
        src_id: String(syncEvent.src_id || table).slice(0, 100),
        status_key: syncEvent.status_key ? String(syncEvent.status_key).slice(0, 100) : null,
        status,
        filas: syncEvent.filas == null ? null : Math.max(0, parseInt(syncEvent.filas, 10) || 0),
        filename: syncEvent.filename ? String(syncEvent.filename).slice(0, 300) : null,
        duracion_ms: syncEvent.duracion_ms == null ? null : Math.max(0, parseInt(syncEvent.duracion_ms, 10) || 0),
        detalles: syncEvent.detalles && typeof syncEvent.detalles === 'object' ? syncEvent.detalles : null,
        user_id: perfil?.user_id || null,
        user_nombre: perfil?.nombre || perfil?.email || String(syncEvent.origen || 'Puente SQL (Mac mini)').slice(0, 100),
      };
      const er = await fetch(`${SB_URL}/rest/v1/sync_events`, { method: 'POST', headers: hdr, body: JSON.stringify(ev) });
      if (!er.ok) return res.status(er.status).json({ error: 'sync_events insert failed', detail: (await er.text()).slice(0, 300) });
      if (status === 'success' && ev.status_key) {
        await fetch(`${SB_URL}/rest/v1/sync_status?on_conflict=fuente`, {
          method: 'POST',
          headers: { ...hdr, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({ fuente: ev.status_key, ultima_actualizacion: new Date().toISOString(), registros: ev.filas, meta: { origen: ev.user_nombre, ...(ev.detalles || {}) } }),
        }).catch(() => {});
      }
      return res.status(200).json({ ok: true, table, syncEvent: ev.src_id, status });
    }

    // finalize: paso posterior a la carga de erp_ventas. Reconstruye
    // facturacion_clientes (sell-in canónico) desde erp_ventas con la definición
    // oficial (Fact Neta) para los años cargados, y refresca la MV de sellout.
    if (finalize === 'refresh_facturacion_clientes') {
      if (table !== 'erp_ventas') return res.status(400).json({ error: 'finalize sólo aplica a erp_ventas' });
      const p_anios = Array.isArray(anios) ? anios.map((a) => parseInt(a)).filter(Boolean) : null;
      const fr = await fetch(`${SB_URL}/rest/v1/rpc/refresh_facturacion_clientes`, {
        method: 'POST',
        headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json' },
        body: JSON.stringify({ p_anios }),
      });
      const txt = await fr.text();
      if (!fr.ok) return res.status(fr.status).json({ error: 'refresh_facturacion_clientes failed', detail: txt.slice(0, 500) });
      fetch(`${SB_URL}/rest/v1/rpc/refresh_mv_sellout_unificado`, {
        method: 'POST',
        headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: 'params=single-object' },
        body: '{}',
      }).catch(() => {});
      let resumen = []; try { resumen = JSON.parse(txt); } catch { /* texto plano */ }
      return res.status(200).json({ ok: true, table, finalize, resumen });
    }

    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'rows[] required' });

    // deleteAll: borra TODA la tabla antes del primer chunk. Se usa para tablas
    // con replace:true (inventario_acteck, compras_oc, precios_sku, roadmap_sku,
    // guias_erp) donde el snapshot completo llega en cada upload y queremos
    // eliminar las filas que ya no aparezcan en el archivo nuevo.
    if (deleteAll) {
      // Usar el primer campo del onConflict como filtro "not null" (borra todo).
      const pkCol = String(ALLOWED[table]).split(',')[0].trim();
      if (!pkCol) return res.status(500).json({ error: 'deleteAll: no pk col resolvable', table });
      const delUrl = `${SB_URL}/rest/v1/${table}?${pkCol}=not.is.null`;
      const dr = await fetch(delUrl, {
        method: 'DELETE',
        headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'return=minimal' },
      });
      if (!dr.ok) {
        const txt = await dr.text();
        return res.status(dr.status).json({ error: 'deleteAll failed', detail: txt.slice(0, 500), table, pkCol });
      }
    }

    // deleteCliente: borra todas las filas de un cliente antes del primer chunk.
    // Lo usa el importador (Digitalife · "es el histórico completo") para
    // reemplazar el sell out del cliente. Sólo tablas con columna cliente.
    if (deleteCliente) {
      const TABLAS_CLIENTE = new Set(['sellout_detalle', 'inventario_cliente', 'inventario_cliente_sucursal']);
      const cli = String(deleteCliente);
      if (!TABLAS_CLIENTE.has(table) || !/^[a-z_]{2,40}$/.test(cli)) return res.status(400).json({ error: 'deleteCliente no permitido', table, cliente: cli });
      const dr = await fetch(`${SB_URL}/rest/v1/${table}?cliente=eq.${cli}`, {
        method: 'DELETE',
        headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'return=minimal' },
      });
      if (!dr.ok) {
        const txt = await dr.text();
        return res.status(dr.status).json({ error: 'deleteCliente failed', detail: txt.slice(0, 500), table, cliente: cli });
      }
    }

    // Si vienen deleteAnios, borramos esos años de la tabla ANTES del upsert.
    // Solo aplica al primer chunk del cliente (cliente envía deleteAnios:[...] una vez).
    if (Array.isArray(deleteAnios) && deleteAnios.length > 0) {
      for (const a of deleteAnios) {
        const anio = parseInt(a);
        if (!anio) continue;
        const delUrl = `${SB_URL}/rest/v1/${table}?anio=eq.${anio}`;
        const dr = await fetch(delUrl, {
          method: 'DELETE',
          headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'return=minimal' },
        });
        if (!dr.ok) {
          const txt = await dr.text();
          return res.status(dr.status).json({ error: 'delete failed', detail: txt.slice(0, 500), anio });
        }
      }
    }

    // deletePeriodos: [{anio, mes, campania?, mayorista?}, ...] — borra por (anio, mes)
    // opcionalmente filtrado por campania o mayorista. Útil para replace por periodo
    // scoped a un mayorista (Revko sellout) sin afectar otros mayoristas.
    if (Array.isArray(deletePeriodos) && deletePeriodos.length > 0) {
      for (const p of deletePeriodos) {
        const anio = parseInt(p?.anio);
        const mes  = parseInt(p?.mes);
        if (!anio || !mes) continue;
        let delUrl = `${SB_URL}/rest/v1/${table}?anio=eq.${anio}&mes=eq.${mes}`;
        if (p?.campania) {
          delUrl += `&campania=eq.${encodeURIComponent(p.campania)}`;
        }
        if (p?.mayorista) {
          delUrl += `&mayorista=eq.${encodeURIComponent(p.mayorista)}`;
        }
        const dr = await fetch(delUrl, {
          method: 'DELETE',
          headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'return=minimal' },
        });
        if (!dr.ok) {
          const txt = await dr.text();
          return res.status(dr.status).json({ error: 'delete failed', detail: txt.slice(0, 500), anio, mes, campania: p?.campania, mayorista: p?.mayorista });
        }
      }
    }

    const url = `${SB_URL}/rest/v1/${table}?on_conflict=${ALLOWED[table]}`;
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        apikey: SRK,
        Authorization: 'Bearer ' + SRK,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates,return=minimal'
      },
      body: JSON.stringify(rows)
    });
    if (!r.ok) {
      const txt = await r.text();
      return res.status(r.status).json({ error: 'upsert failed', detail: txt.slice(0, 500), table, count: rows.length });
    }

    // Refrescar la vista materializada mv_sellout_unificado cuando se
    // actualiza cualquiera de las tablas que la alimentan. Se hace
    // fire-and-forget para no bloquear la respuesta del cliente.
    const AFECTA_SELLOUT_MV = new Set(['sellout_general', 'sellout_detalle', 'sellout_pcel', 'facturacion_clientes']);
    if (AFECTA_SELLOUT_MV.has(table)) {
      // No await — dispara y sigue
      fetch(`${SB_URL}/rest/v1/rpc/refresh_mv_sellout_unificado`, {
        method: 'POST',
        headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, 'Content-Type': 'application/json', Prefer: 'params=single-object' },
        body: '{}',
      }).catch(() => {});
    }

    res.status(200).json({ ok: true, table, count: rows.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
