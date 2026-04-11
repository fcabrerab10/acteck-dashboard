export default async function handler(req, res) {
  const { code } = req.query;
  if (!code) return res.status(400).json({ error: 'Missing authorization code' });

  const ML_CLIENT_ID = process.env.ML_CLIENT_ID;
  const ML_CLIENT_SECRET = process.env.ML_CLIENT_SECRET;
  const ML_REDIRECT_URI = process.env.ML_REDIRECT_URI || 'https://acteck-dashboard.vercel.app/auth/mercadolibre';
  const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  try {
    const tokenResp = await fetch('https://api.mercadolibre.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        client_id: ML_CLIENT_ID,
        client_secret: ML_CLIENT_SECRET,
        code,
        redirect_uri: ML_REDIRECT_URI
      })
    });
    const tokenData = await tokenResp.json();
    if (!tokenResp.ok) {
      console.error('ML token error:', tokenData);
      return res.redirect('/?ml_error=' + encodeURIComponent(tokenData.message || 'Token exchange failed'));
    }

    // Store in Supabase via REST
    if (SUPABASE_URL && SUPABASE_KEY) {
      await fetch(SUPABASE_URL + '/rest/v1/ml_tokens?on_conflict=id', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': SUPABASE_KEY,
          'Authorization': 'Bearer ' + SUPABASE_KEY,
          'Prefer': 'resolution=merge-duplicates'
        },
        body: JSON.stringify({
          id: 'primary',
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          token_type: tokenData.token_type || 'Bearer',
          expires_in: tokenData.expires_in,
          user_id: String(tokenData.user_id),
          scope: tokenData.scope,
          updated_at: new Date().toISOString()
        })
      });
    }

    return res.redirect('/?ml_connected=true&ml_user=' + tokenData.user_id);
  } catch (error) {
    console.error('ML OAuth error:', error);
    return res.redirect('/?ml_error=' + encodeURIComponent(error.message));
  }
}
