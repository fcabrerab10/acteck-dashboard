// api/import-central.js
// Endpoint simple de upsert por chunks. El cliente parsea el Excel y envÃÂ­a
// lotes de filas ya mapeadas: { table, rows, onConflict }
//
// Tablas permitidas y sus unique keys:
//   inventario_acteck   -> "articulo,no_almacen"
//   ventas_erp          -> "venta_id,venta_renglon"
//   sellout_detalle     -> "cliente,fecha,no_parte,row_hash"
//   inventario_cliente  -> "cliente,sku"

export const config = { api: { bodyParser: { sizeLimit: '4mb' } } };

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

const ALLOWED = {
  inventario_acteck:  'articulo,no_almacen',
  ventas_erp:         'venta_id,venta_renglon',
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
  embarques_compras:     'po,codigo',
  facturacion_clientes:  'cliente_nombre,sku,anio,mes',
  estados_resultados:    'razon_social,anio,mes,cuenta_norm',
  compras_oc:            'movid,articulo',
  promos_temporada:      'sku,anio,mes,campania',
  sellout_general:       'id',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  try {
    const { table, rows, deleteAnios, deletePeriodos } = req.body || {};
    if (!table || !ALLOWED[table]) return res.status(400).json({ error: 'invalid table. allowed: ' + Object.keys(ALLOWED).join(', ') });
    if (!Array.isArray(rows) || !rows.length) return res.status(400).json({ error: 'rows[] required' });

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

    // deletePeriodos: [{anio, mes, campania?}, ...] — borra por (anio, mes) o (anio, mes, campania)
    // antes del upsert. Útil para replace por mes en promos_temporada / precios_sku.
    if (Array.isArray(deletePeriodos) && deletePeriodos.length > 0) {
      for (const p of deletePeriodos) {
        const anio = parseInt(p?.anio);
        const mes  = parseInt(p?.mes);
        if (!anio || !mes) continue;
        let delUrl = `${SB_URL}/rest/v1/${table}?anio=eq.${anio}&mes=eq.${mes}`;
        if (p?.campania) {
          delUrl += `&campania=eq.${encodeURIComponent(p.campania)}`;
        }
        const dr = await fetch(delUrl, {
          method: 'DELETE',
          headers: { apikey: SRK, Authorization: 'Bearer ' + SRK, Prefer: 'return=minimal' },
        });
        if (!dr.ok) {
          const txt = await dr.text();
          return res.status(dr.status).json({ error: 'delete failed', detail: txt.slice(0, 500), anio, mes, campania: p?.campania });
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
