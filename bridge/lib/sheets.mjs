// Lectura del Google Sheet "Master Embarques".
//   A) Service account (recomendado): Sheets API v4 con JWT firmado localmente
//      (sin librerías). La hoja se comparte como Lector al correo del SA.
//   B) Sin credenciales: exportación CSV (gviz). Requiere hoja compartida con
//      "cualquier persona con el enlace". Es lo que usa hoy api/cron.js.
import { readFileSync, existsSync } from 'node:fs';
import { createSign } from 'node:crypto';
import { parseCSV } from '../../api/_embarques.js';
import { log } from './util.mjs';

const SHEET_ID = process.env.MASTER_EMBARQUES_SHEET_ID;
const SA_FILE = process.env.GOOGLE_SERVICE_ACCOUNT_FILE;

function b64url(buf) { return Buffer.from(buf).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_'); }

let tokenCache = null;
async function accessToken() {
  if (tokenCache && tokenCache.exp > Date.now() + 60_000) return tokenCache.token;
  const sa = JSON.parse(readFileSync(SA_FILE, 'utf8'));
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets.readonly',
    aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
  }));
  const signer = createSign('RSA-SHA256'); signer.update(`${header}.${claim}`);
  const jwt = `${header}.${claim}.${b64url(signer.sign(sa.private_key))}`;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=${encodeURIComponent('urn:ietf:params:oauth:grant-type:jwt-bearer')}&assertion=${jwt}`,
  });
  if (!r.ok) throw new Error(`Google token: HTTP ${r.status} ${(await r.text()).slice(0, 200)}`);
  const j = await r.json();
  tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in || 3600) * 1000 };
  return tokenCache.token;
}

export function usaServiceAccount() { return Boolean(SA_FILE && existsSync(SA_FILE)); }

/** Títulos de todas las pestañas (sólo con service account). */
export async function listarHojas() {
  if (!usaServiceAccount()) return null;
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
  if (usaServiceAccount()) {
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
  return usaServiceAccount() ? `service account (${SA_FILE})` : 'CSV público (gviz) — requiere "cualquiera con el enlace"';
}
