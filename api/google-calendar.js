// api/google-calendar.js — Google Calendar por usuario, dos sentidos (Agenda).
//
// OAuth propio (no el proveedor Google de Supabase Auth, que no guarda refresh_token de Calendar):
//   GET  ?action=auth      (JWT)  → { url } para redirigir a Google (state firmado con HMAC del user_id)
//   GET  ?action=callback  (Google) code + state → guarda refresh_token en agenda_google (service role)
//                                  y redirige a APP_URL/?google=ok|error
//   GET  ?action=events&from&to (JWT) → { events:[…] } del calendario primario del usuario
//   POST ?action=create    (JWT)  { titulo, descripcion, inicio, fin, lugar, asistentes:[email] } → { id, htmlLink }
//   POST ?action=update    (JWT)  { id, …mismos campos } → { id, htmlLink }
//   POST ?action=delete    (JWT)  { id } → { ok }
//   POST ?action=disconnect(JWT)  → borra la conexión del usuario
//
// Variables en Vercel (y .env.local para probar):
//   GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET   — OAuth 2.0 Client ID "Web application" en Google Cloud Console
//   GOOGLE_REDIRECT_URI (opcional)            — default `${APP_URL}/api/google-calendar?action=callback`
//   APP_URL (opcional)                        — default https://acteck-dashboard.vercel.app
// En Google Cloud: habilitar "Google Calendar API"; en la pantalla de consentimiento agregar el scope
// https://www.googleapis.com/auth/calendar.events y a los usuarios de prueba (o publicar la app);
// en el Client ID agregar la redirect URI exacta de arriba.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { requireAuth } from './_auth.js';

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const APP_URL = process.env.APP_URL || 'https://acteck-dashboard.vercel.app';
const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || `${APP_URL}/api/google-calendar?action=callback`;
const SCOPE = 'https://www.googleapis.com/auth/calendar.events';
const TZ = 'America/Mexico_City';

const SB_HEADERS = () => ({ apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json' });

// ─── state firmado (user_id.exp.hmac) ───
function firmar(userId) {
  const exp = Date.now() + 10 * 60 * 1000;
  const cuerpo = `${userId}.${exp}`;
  const mac = createHmac('sha256', CLIENT_SECRET).update(cuerpo).digest('base64url');
  return `${cuerpo}.${mac}`;
}
function verificar(state) {
  const [userId, exp, mac] = String(state || '').split('.');
  if (!userId || !exp || !mac) return null;
  const esperado = createHmac('sha256', CLIENT_SECRET).update(`${userId}.${exp}`).digest('base64url');
  const a = Buffer.from(mac), b = Buffer.from(esperado);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (Number(exp) < Date.now()) return null;
  return userId;
}

// ─── agenda_google (service role) ───
async function conexionDe(userId) {
  const r = await fetch(`${SB_URL}/rest/v1/agenda_google?user_id=eq.${userId}&select=user_id,email,refresh_token,calendar_id`, { headers: SB_HEADERS() });
  if (!r.ok) throw new Error(`agenda_google → HTTP ${r.status}`);
  const rows = await r.json();
  return rows[0] || null;
}
async function guardarConexion(row) {
  const r = await fetch(`${SB_URL}/rest/v1/agenda_google?on_conflict=user_id`, { method: 'POST', headers: { ...SB_HEADERS(), Prefer: 'resolution=merge-duplicates,return=minimal' }, body: JSON.stringify(row) });
  if (!r.ok) throw new Error(`guardar agenda_google → HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
}
async function tocarConexion(userId, campos) {
  await fetch(`${SB_URL}/rest/v1/agenda_google?user_id=eq.${userId}`, { method: 'PATCH', headers: { ...SB_HEADERS(), Prefer: 'return=minimal' }, body: JSON.stringify(campos) }).catch(() => {});
}

// ─── Google ───
async function tokenDesdeRefresh(refreshToken) {
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: CLIENT_SECRET, refresh_token: refreshToken, grant_type: 'refresh_token' }),
  });
  const js = await r.json();
  if (!r.ok || !js.access_token) { const e = new Error(js.error_description || js.error || `token HTTP ${r.status}`); e.google = js.error; throw e; }
  return js.access_token;
}
async function gapi(accessToken, path, init = {}) {
  const r = await fetch(`https://www.googleapis.com/calendar/v3/${path}`, { ...init, headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json', ...(init.headers || {}) } });
  if (r.status === 204) return {};
  const js = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = js.error?.message || `Google HTTP ${r.status}`;
    const e = new Error(/has not been used|is disabled|accessNotConfigured/i.test(msg) ? 'Falta habilitar la API de Calendar en Google Cloud' : msg);
    e.status = r.status; throw e;
  }
  return js;
}

function eventoGoogle(b) {
  const inicio = new Date(b.inicio); const fin = b.fin ? new Date(b.fin) : new Date(inicio.getTime() + (Number(b.duracion_min) || 60) * 60000);
  return {
    summary: b.titulo || 'Reunión', description: b.descripcion || undefined, location: b.lugar || undefined,
    start: { dateTime: inicio.toISOString(), timeZone: TZ }, end: { dateTime: fin.toISOString(), timeZone: TZ },
    attendees: Array.isArray(b.asistentes) ? b.asistentes.filter((e) => /@/.test(e)).map((email) => ({ email })) : undefined,
    reminders: { useDefault: true },
  };
}

const json = (res, status, body) => res.status(status).json(body);
const sinConfig = () => !CLIENT_ID || !CLIENT_SECRET;

export default async function handler(req, res) {
  const action = req.query?.action || '';
  if (sinConfig()) return json(res, 503, { error: 'Google no está configurado: faltan GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET en Vercel', codigo: 'sin_config' });
  if (!SRK) return json(res, 500, { error: 'SUPABASE_SERVICE_ROLE_KEY missing' });

  // Callback de Google: sin JWT (viene del navegador tras el consentimiento).
  if (action === 'callback') {
    const { code, state, error } = req.query || {};
    const volver = (q) => { res.setHeader('Location', `${APP_URL}/?${q}`); return res.status(302).end(); };
    if (error) return volver(`google=error&motivo=${encodeURIComponent(error)}`);
    const userId = verificar(state);
    if (!userId || !code) return volver('google=error&motivo=state');
    try {
      const r = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ code, client_id: CLIENT_ID, client_secret: CLIENT_SECRET, redirect_uri: REDIRECT_URI, grant_type: 'authorization_code' }),
      });
      const js = await r.json();
      if (!r.ok) return volver(`google=error&motivo=${encodeURIComponent(js.error_description || js.error || 'token')}`);
      let refresh = js.refresh_token;
      if (!refresh) {
        // Google sólo manda refresh_token la primera vez (o con prompt=consent): si ya había uno, se conserva.
        const prev = await conexionDe(userId);
        if (!prev?.refresh_token) return volver('google=error&motivo=sin_refresh_token');
        refresh = prev.refresh_token;
      }
      let email = null;
      try { const ui = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${js.access_token}` } }); email = (await ui.json()).email || null; } catch {}
      await guardarConexion({ user_id: userId, email, refresh_token: refresh, calendar_id: 'primary', scope: js.scope || SCOPE, conectado_at: new Date().toISOString(), ultimo_error: null });
      return volver('google=ok');
    } catch (e) { return volver(`google=error&motivo=${encodeURIComponent(e.message)}`); }
  }

  const perfil = await requireAuth(req, res);
  if (!perfil) return;
  const userId = perfil.user_id;

  try {
    if (action === 'auth') {
      const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      u.searchParams.set('client_id', CLIENT_ID);
      u.searchParams.set('redirect_uri', REDIRECT_URI);
      u.searchParams.set('response_type', 'code');
      u.searchParams.set('scope', `${SCOPE} email`);
      u.searchParams.set('access_type', 'offline');
      u.searchParams.set('prompt', 'consent');
      u.searchParams.set('include_granted_scopes', 'true');
      u.searchParams.set('state', firmar(userId));
      if (perfil.email) u.searchParams.set('login_hint', perfil.email);
      return json(res, 200, { url: u.toString() });
    }
    if (action === 'disconnect') {
      await fetch(`${SB_URL}/rest/v1/agenda_google?user_id=eq.${userId}`, { method: 'DELETE', headers: SB_HEADERS() });
      return json(res, 200, { ok: true });
    }

    const con = await conexionDe(userId);
    if (!con) return json(res, 409, { error: 'Google no está conectado', codigo: 'no_conectado' });
    let token;
    try { token = await tokenDesdeRefresh(con.refresh_token); }
    catch (e) {
      if (e.google === 'invalid_grant') { await tocarConexion(userId, { ultimo_error: 'invalid_grant' }); return json(res, 409, { error: 'La conexión con Google caducó: vuelve a conectar', codigo: 'reconectar' }); }
      throw e;
    }
    const cal = encodeURIComponent(con.calendar_id || 'primary');

    if (action === 'events') {
      const from = req.query.from ? new Date(req.query.from) : new Date(Date.now() - 7 * 86400000);
      const to = req.query.to ? new Date(req.query.to) : new Date(Date.now() + 35 * 86400000);
      const qs = new URLSearchParams({ timeMin: from.toISOString(), timeMax: to.toISOString(), singleEvents: 'true', orderBy: 'startTime', maxResults: '250', timeZone: TZ });
      const js = await gapi(token, `calendars/${cal}/events?${qs}`);
      await tocarConexion(userId, { ultima_sync: new Date().toISOString(), ultimo_error: null });
      const events = (js.items || []).filter((e) => e.status !== 'cancelled').map((e) => ({ id: e.id, summary: e.summary, description: e.description, location: e.location, start: e.start, end: e.end, htmlLink: e.htmlLink, hangoutLink: e.hangoutLink, attendees: (e.attendees || []).map((a) => ({ email: a.email, nombre: a.displayName || null, estado: a.responseStatus })), organizer: e.organizer?.email || null, updated: e.updated }));
      return json(res, 200, { events, email: con.email });
    }
    if (req.method !== 'POST') return json(res, 405, { error: 'POST requerido' });
    const b = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    if (action === 'create') {
      const ev = await gapi(token, `calendars/${cal}/events?sendUpdates=${b.avisar ? 'all' : 'none'}`, { method: 'POST', body: JSON.stringify(eventoGoogle(b)) });
      return json(res, 200, { id: ev.id, htmlLink: ev.htmlLink });
    }
    if (action === 'update') {
      if (!b.id) return json(res, 400, { error: 'id requerido' });
      const ev = await gapi(token, `calendars/${cal}/events/${encodeURIComponent(b.id)}?sendUpdates=${b.avisar ? 'all' : 'none'}`, { method: 'PATCH', body: JSON.stringify(eventoGoogle(b)) });
      return json(res, 200, { id: ev.id, htmlLink: ev.htmlLink });
    }
    if (action === 'delete') {
      if (!b.id) return json(res, 400, { error: 'id requerido' });
      try { await gapi(token, `calendars/${cal}/events/${encodeURIComponent(b.id)}?sendUpdates=none`, { method: 'DELETE' }); }
      catch (e) { if (e.status !== 404 && e.status !== 410) throw e; }
      return json(res, 200, { ok: true });
    }
    return json(res, 400, { error: 'action inválida', usage: 'auth | callback | events&from&to | create | update | delete | disconnect' });
  } catch (e) {
    console.error('[google-calendar]', e);
    return json(res, e.status === 403 ? 403 : 500, { error: e.message || String(e) });
  }
}
