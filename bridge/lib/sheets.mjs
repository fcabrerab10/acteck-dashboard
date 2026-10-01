// Lectura del Google Sheet "Master Embarques".
//   A) OAuth del propio usuario (recomendado desde 2026-10-01): el puente usa el
//      acceso de Fernando a la hoja, sin compartirla con nadie. Una sola vez:
//      `node google-auth.mjs` (abre el navegador, autoriza, guarda el refresh
//      token en GOOGLE_OAUTH_TOKEN_FILE). Necesita el JSON del cliente OAuth
//      "Desktop app" de Google Cloud en GOOGLE_OAUTH_CLIENT_FILE.
//   B) Service account: Sheets API v4 con JWT firmado localmente. La hoja se
//      comparte como Lector al correo del SA (GOOGLE_SERVICE_ACCOUNT_FILE).
//   C) Sin credenciales: exportación CSV (gviz). Requiere hoja compartida con
//      "cualquier persona con el enlace".
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { parseCSV } from '../../api/_embarques.js';
import { log } from './util.mjs';

const SHEET_ID = process.env.MASTER_EMBARQUES_SHEET_ID;
const SA_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;
const OAUTH_CLIENT_FILE = process.env.GOOGLE_OAUTH_CLIENT_FILE;
const OAUTH_TOKEN_FILE = process.env.GOOGLE_OAUTH_TOKEN_FILE;

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }

let tokenCache = null;
async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  let body;
  if (usaOAuth()) {
    const cli = leerClienteOAuth();
    const tok = JSON.parse(readFileSync(OAUTH_TOKEN_FILE, 'utf8'));
    if (!tok.refresh_token) throw new Error(`Google OAuth: ${OAUTH_TOKEN_FILE} no tiene refresh_token; corre node google-auth.mjs`);
    body = new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tok.refresh_token, client_id: cli.client_id, client_secret: cli.client_secret }).toString();
  } else {
    const sa = JSON.parse(readFileSync(SA_FILE, 'utf8'));
    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({
      iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
      aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
    }));
    const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claim}`);
    const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key))}`;
    body = `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body,
  });
  if (!r.ok) throw new Error(`Google token: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

/** Cliente OAuth "Desktop app" bajado de Google Cloud ({installed:{client_id,client_secret}} o plano). */
export function leerClienteOAuth() {
  const j = JSON.parse(readFileSync(OAUTH_CLIENT_FILE, 'utf8'));
  const c = j.installed || j.web || j;
  if (!c.client_id || !c.client_secret) throw new Error(`Google OAuth: ${OAUTH_CLIENT_FILE} no trae client_id/client_secret`);
  return c;
}
export function usaOAuth() { return Boolean(OAUTH_CLIENT_FILE && OAUTH_TOKEN_FILE && existsSync(OAUTH_CLIENT_FILE) && existsSync(OAUTH_TOKEN_FILE)); }
export function usaServiceAccount() { return Boolean(SA_FILE && existsSync(SA_FILE)); }
/** Hay credenciales para la Sheets API (OAuth del usuario o service account). */
export function tieneAcceso() { return usaOAuth() || usaServiceAccount(); }

/** Títulos de todas las pestañas (sólo con service account). */
export async function listarHojas() {
  if (!tieneAcceso()) return null;
  const tok = await accessToken();
  const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}?fields=sheets.properties.title`, { headers: { Authorization: `Bearer ${tok}` } });
  if (!r.ok) throw new Error(`Sheets meta: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  return (j.sheets || []).map((s) => s.properties.title);
}

/**
 * Devuelve la pestaña como arrays (header en [0]) con los valores FORMATEADOS
 * (mismo texto que el CSV: fechas dd/mm/yyyy, etc.). null si no existe.
 */
export async function leerHoja(nombre) {
  if (!SHEET_ID) throw new Error('MASTER_EMBARQUES_SHEET_ID no configurado');
  if (tieneAcceso()) {
    const tok = await accessToken();
    const range = encodeURIComponent(`'${nombre.replace(/'/g, "''")}'`);
    const r = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}/values/${range}?valueRenderOption=FORMATTED_VALUE&majorDimension=ROWS`, { headers: { Authorization: `Bearer ${tok}` } });
    if (r.status === 400 || r.status === 404) return null;   // pestaña inexistente
    if (!r.ok) throw new Error(`Sheets values ${nombre}: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
    const j = await r.json();
    return j.values || [];
  }
  // Fallback CSV público
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(nombre)}`;
  const resp = await fetch(url, { redirect: 'follow' });
  if (!resp.ok) return null;
  const csv = await resp.text();
  if (csv.startsWith('<') || csv.length < 50) return null;
  return parseCSV(csv);
}

export function describirModo() {
  if (usaOAuth()) return `OAuth del usuario (${OAUTH_TOKEN_FILE})`;
  return usaServiceAccount() ? `service account (${SA_FILE})` : 'CSV público (gviz) — requiere "cualquiera con el enlace"';
}
