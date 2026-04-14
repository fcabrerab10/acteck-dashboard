// Endpoint consolidado de subidas para la pestaña "Actualización de datos"
// Acepta body: { type, rows, meta, mode?, chunkIndex?, totalChunks? }
// Si type requiere replace (sellout_pcel por semana, edc por cliente+semana, inventario_digitalife, etc.)
// se borra el subconjunto en la primera chunk (chunkIndex === 0) y después se insertan los chunks.

import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supa = createClient(url, key, { auth: { persistSession: false } });

const TYPES = {
  erp_sell_in: {
    table: 'sell_in_sku',
    onConflict: 'no_parte,fecha',         // upsert por SKU+fecha
    replace: false
  },
  erp_inventario: {
    table: 'inventario_cliente',
    replace: true,                         // snapshot: borrar todo inventario de cliente='acteck_erp'
    replaceFilter: { column: 'cliente', value: 'acteck_erp' }
  },
  roadmap: {
    table: 'roadmap_sku',
    replace: true                          // reemplazo total
  },
  precios: {
    table: 'precios_sku',
    replace: true
  },
  sellout_digitalife: {
    table: 'sellout_sku',
    onConflict: 'cliente,fecha,no_parte',
    replace: false
    // historial: cuando mode='replace_all' se borra todo lo de cliente=digitalife
  },
  sellout_pcel: {
    table: 'sellout_pcel',
    onConflict: 'anio,semana,sku,marca',
    replace: false
    // cuando se sube semana: en chunk 0 se borran los registros de (anio, semana)
  },
  inventario_digitalife: {
    table: 'inventario_cliente',
    replace: true,
    replaceFilter: { column: 'cliente', value: 'digitalife' }
  },
  edc_header: {
    // header del EdC: devuelve el id para que el cliente envíe el detalle con estado_cuenta_id
    table: 'estados_cuenta',
    onConflict: 'cliente,anio,semana',
    replace: false
  },
  edc_detalle: {
    table: 'estados_cuenta_detalle',
    replace: false
    // en chunk 0 se borran los detalles existentes del estado_cuenta_id provisto
  }
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!url || !key) return res.status(500).json({ error: 'Supabase env vars missing' });

  try {
    const { type, rows = [], meta = {}, mode = 'append', chunkIndex = 0, totalChunks = 1 } = req.body || {};
    const cfg = TYPES[type];
    if (!cfg) return res.status(400).json({ error: 'Unknown type: ' + type });

    // 1) Borrados previos (solo en chunk 0)
    if (chunkIndex === 0) {
      if (type === 'sellout_digitalife' && mode === 'replace_all') {
        const d = await supa.from('sellout_sku').delete().eq('cliente', 'digitalife');
        if (d.error) return res.status(500).json({ error: 'delete digitalife failed', detail: d.error });
      } else if (type === 'sellout_pcel' && meta.anio && meta.semana) {
        const d = await supa.from('sellout_pcel').delete().eq('anio', meta.anio).eq('semana', meta.semana);
        if (d.error) return res.status(500).json({ error: 'delete sellout_pcel failed', detail: d.error });
      } else if (type === 'edc_header' && meta.cliente && meta.anio && meta.semana) {
        const d = await supa.from('estados_cuenta').delete().eq('cliente', meta.cliente).eq('anio', meta.anio).eq('semana', meta.semana);
        if (d.error) return res.status(500).json({ error: 'delete edc_header failed', detail: d.error });
      } else if (type === 'edc_detalle' && meta.estado_cuenta_id) {
        const d = await supa.from('estados_cuenta_detalle').delete().eq('estado_cuenta_id', meta.estado_cuenta_id);
        if (d.error) return res.status(500).json({ error: 'delete edc_detalle failed', detail: d.error });
      } else if (cfg.replace) {
        let q = supa.from(cfg.table).delete();
        if (cfg.replaceFilter) {
          q = q.eq(cfg.replaceFilter.column, cfg.replaceFilter.value);
        } else {
          q = q.neq('id', -1);  // delete-all trick para tablas con id
        }
        const d = await q;
        if (d.error) return res.status(500).json({ error: 'delete all failed', detail: d.error, table: cfg.table });
      }
    }

    // 2) Inserción de los rows del chunk
    if (!rows.length) {
      return res.status(200).json({ ok: true, inserted: 0, chunkIndex });
    }

    let result;
    if (type === 'edc_header') {
      // upsert y devolver id de vuelta
      const up = await supa.from('estados_cuenta').upsert(rows, { onConflict: cfg.onConflict }).select('id, cliente, anio, semana');
      if (up.error) return res.status(500).json({ error: 'upsert edc_header failed', detail: up.error });
      return res.status(200).json({ ok: true, inserted: up.data.length, ids: up.data, chunkIndex });
    } else if (cfg.onConflict) {
      result = await supa.from(cfg.table).upsert(rows, { onConflict: cfg.onConflict, ignoreDuplicates: false });
    } else {
      result = await supa.from(cfg.table).insert(rows);
    }

    if (result.error) return res.status(500).json({ error: 'insert failed', detail: result.error, table: cfg.table, chunkIndex });

    // 3) Bitácora (solo en último chunk)
    if (chunkIndex + 1 === totalChunks) {
      const fuente = {
        erp_sell_in: 'erp_sell_in',
        erp_inventario: 'erp_inventario',
        roadmap: 'roadmap',
        precios: 'precios',
        sellout_digitalife: 'sellout_digitalife',
        sellout_pcel: 'sellout_pcel',
        inventario_digitalife: 'inventario_digitalife',
        edc_header: meta.cliente === 'digitalife' ? 'edc_digitalife' : 'edc_pcel',
        edc_detalle: null
      }[type];
      if (fuente) {
        await supa.from('sync_status').upsert({
          fuente,
          ultima_actualizacion: new Date().toISOString(),
          registros: meta.totalRegistros || rows.length * totalChunks,
          meta
        }, { onConflict: 'fuente' });
      }
    }

    return res.status(200).json({ ok: true, inserted: rows.length, chunkIndex });
  } catch (e) {
    return res.status(500).json({ error: 'server error', detail: String(e && e.message || e) });
  }
}
