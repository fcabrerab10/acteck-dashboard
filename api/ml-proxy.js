export default async function handler(req, res) {
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  // Get ML token from Supabase
  const tokResp = await fetch(SUPABASE_URL + '/rest/v1/ml_tokens?select=access_token&id=eq.primary', {
    headers: { 'apikey': SUPABASE_KEY, 'Authorization': 'Bearer ' + SUPABASE_KEY }
  });
  const tokData = await tokResp.json();
  if (!tokData[0] || !tokData[0].access_token) {
    return res.status(401).json({ error: 'No ML token found' });
  }
  const mlToken = tokData[0].access_token;
  
  // Proxy the request to ML API
  const path = req.query.path || 'users/me';
  const mlResp = await fetch('https://api.mercadolibre.com/' + path, {
    headers: { 'Authorization': 'Bearer ' + mlToken }
  });
  const data = await mlResp.json();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(mlResp.status).json(data);
}
