// api/ml-sellout.js — Serverless endpoint: agrega sell-out de ML por mes y marca
// Consume la API de ML vía token almacenado en Supabase (ml_tokens)
// Devuelve: { sellOutPorMes: {1: $, 2: $, ...}, sellOutPorMarca: {ACTECK: $, BALAM RUSH: $}, totalOrdenes, periodo }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const SELLER_ID = '537996186';

  // ── 1. Obtener token ML desde Supabase ──
  let mlToken;
  try {
    const tokResp = await fetch(
      SUPABASE_URL + '/rest/v1/ml_tokens?select=access_token&id=eq.primary',
      { headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY } }
    );
    const tokData = await tokResp.json();
    if (!tokData[0] || !tokData[0].access_token) {
      return res.status(401).json({ error: 'No ML token found' });
    }
    mlToken = tokData[0].access_token;
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get ML token', detail: e.message });
  }

  // ── 2. Determinar rango de fechas (año en curso) ──
  const year = parseInt(req.query.year) || new Date().getFullYear();
  const dateFrom = `${year}-01-01T00:00:00.000-00:00`;
  const dateTo = `${year}-12-31T23:59:59.000-00:00`;

  // ── 3. Paginar órdenes de ML ──
  const sellOutPorMes = {};    // { 1: total$, 2: total$, ... }
  const sellOutPorMarca = {};  // { "ACTECK": $, "BALAM RUSH": $ }
  const sellOutPorMesMarca = {}; // { 1: { "ACTECK": $, "BALAM RUSH": $ }, ... }
  let totalOrdenes = 0;
  let totalMonto = 0;
  let offset = 0;
  const limit = 50;
  const maxPages = 200; // Safety limit: 50*200 = 10,000 orders max

  try {
    for (let page = 0; page < maxPages; page++) {
      const path = `orders/search?seller=${SELLER_ID}`
        + `&order.date_created.from=${encodeURIComponent(dateFrom)}`
        + `&order.date_created.to=${encodeURIComponent(dateTo)}`
        + `&order.status=paid`
        + `&sort=date_asc`
        + `&limit=${limit}&offset=${offset}`;

      const mlResp = await fetch('https://api.mercadolibre.com/' + path, {
        headers: { 'Authorization': 'Bearer ' + mlToken }
      });
      const mlData = await mlResp.json();

      if (!mlData.results || mlData.results.length === 0) break;

      for (const order of mlData.results) {
        totalOrdenes++;
        const mes = new Date(order.date_created).getMonth() + 1; // 1-based
        const monto = order.total_amount || 0;
        totalMonto += monto;

        // Por mes
        sellOutPorMes[mes] = (sellOutPorMes[mes] || 0) + monto;

        // Por marca (detectar en título del item)
        if (order.order_items) {
          for (const item of order.order_items) {
            const title = (item.item?.title || '').toUpperCase();
            let marca = 'OTRO';
            if (title.includes('BALAM') || title.includes('BALAM RUSH')) marca = 'BALAM RUSH';
            else if (title.includes('ACTECK') || title.includes('CAPTIVE') || title.includes('POLAR')) marca = 'ACTECK';

            const itemMonto = (item.unit_price || 0) * (item.quantity || 1);
            sellOutPorMarca[marca] = (sellOutPorMarca[marca] || 0) + itemMonto;

            // Por mes y marca
            if (!sellOutPorMesMarca[mes]) sellOutPorMesMarca[mes] = {};
            sellOutPorMesMarca[mes][marca] = (sellOutPorMesMarca[mes][marca] || 0) + itemMonto;
          }
        }
      }

      // ¿Hay más páginas?
      const total = mlData.paging?.total || 0;
      offset += limit;
      if (offset >= total) break;
    }
  } catch (e) {
    return res.status(500).json({
      error: 'Failed fetching ML orders',
      detail: e.message,
      partialData: { sellOutPorMes, totalOrdenes }
    });
  }

  // ── 4. Responder ──
  return res.status(200).json({
    year,
    periodo: `${year}-01-01 → ${year}-12-31`,
    totalOrdenes,
    totalMonto,
    sellOutPorMes,
    sellOutPorMarca,
    sellOutPorMesMarca,
    generadoEn: new Date().toISOString(),
  });
}
