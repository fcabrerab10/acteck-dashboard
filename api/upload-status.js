// api/upload-status.js
// Devuelve el estado de "última actualización" de cada fuente del uploader,
// incluyendo:
//   - last_updated_at (cuándo se modificó la tabla por última vez)
//   - data_until      (la fecha más reciente DE DATOS en esa tabla — ej. la
//                      última venta registrada, la última semana de estado
//                      de cuenta, el último mes facturado, etc.)
//
// Es la base del panel de uploads para que el usuario sepa de un vistazo
// "qué tan al día está cada cliente".

const SB_URL = process.env.VITE_SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function sb(path) {
  const r = await fetch(SB_URL + '/rest/v1/' + path, {
    headers: { apikey: SRK, Authorization: 'Bearer ' + SRK },
  });
  if (!r.ok) return null;
  return r.json();
}

export default async function handler(req, res) {
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  try {
    const out = {};

    const fetchMax = async (key, query) => {
      try {
        const j = await sb(query);
        out[key] = (j && j[0]) || null;
      } catch { out[key] = null; }
    };

    // Sellout por cliente — última fecha de venta + cuántas filas hay
    await Promise.all([
      fetchMax('sellout_digitalife',
        `sellout_detalle?cliente=eq.digitalife&select=fecha,updated_at&order=fecha.desc&limit=1`),
      fetchMax('sellout_dicotech',
        `sellout_detalle?cliente=eq.dicotech&select=fecha,updated_at&order=fecha.desc&limit=1`),
      fetchMax('sellout_pcel_mensual',
        `sellout_pcel_mensual?select=anio,mes,updated_at&order=anio.desc,mes.desc&limit=1`),
      fetchMax('sellout_pcel_semanal',
        `sellout_pcel?select=anio,semana&order=anio.desc,semana.desc&limit=1`),
      // Estados de cuenta — última semana cargada por cliente
      fetchMax('ec_digitalife',
        `estados_cuenta?cliente=eq.digitalife&select=anio,semana,fecha_corte,updated_at&order=anio.desc,semana.desc&limit=1`),
      fetchMax('ec_pcel',
        `estados_cuenta?cliente=eq.pcel&select=anio,semana,fecha_corte,updated_at&order=anio.desc,semana.desc&limit=1`),
      fetchMax('ec_dicotech',
        `estados_cuenta?cliente=eq.dicotech&select=anio,semana,fecha_corte,updated_at&order=anio.desc,semana.desc&limit=1`),
      // Facturación ERP — último mes con datos (cliente×SKU×mes)
      fetchMax('facturacion_global',
        `facturacion_clientes?select=anio,mes&order=anio.desc,mes.desc&limit=1`),
      fetchMax('facturacion_digitalife',
        `facturacion_clientes?cliente_key=eq.digitalife&select=anio,mes&order=anio.desc,mes.desc&limit=1`),
      fetchMax('facturacion_pcel',
        `facturacion_clientes?cliente_key=eq.pcel&select=anio,mes&order=anio.desc,mes.desc&limit=1`),
      fetchMax('facturacion_dicotech',
        `facturacion_clientes?cliente_key=eq.dicotech&select=anio,mes&order=anio.desc,mes.desc&limit=1`),
      // Inventario Digitalife — última semana
      fetchMax('inv_digitalife',
        `inventario_cliente?cliente=eq.digitalife&select=anio,semana,updated_at&order=anio.desc,semana.desc&limit=1`),
      // Inventario Acteck — última actualización global (replace total)
      fetchMax('inventario_acteck',
        `inventario_acteck?select=updated_at&order=updated_at.desc&limit=1`),
      // Catálogo
      fetchMax('roadmap',
        `roadmap_sku?select=updated_at&order=updated_at.desc&limit=1`),
      fetchMax('precios',
        `precios_sku?select=updated_at&order=updated_at.desc&limit=1`),
      // Master Embarques
      fetchMax('embarques',
        `embarques_compras?select=updated_at&order=updated_at.desc&limit=1`),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
