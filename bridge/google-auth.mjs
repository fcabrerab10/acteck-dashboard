#!/usr/bin/env node
// Autorización ÚNICA de Google para que el puente lea el Master Embarques con el
// acceso del propio usuario (sin compartir la hoja con nadie).
//
//   node --env-file=credenciales.env google-auth.mjs
//
// Requiere GOOGLE_OAUTH_CLIENT_FILE (JSON del cliente OAuth tipo "Desktop app" de
// Google Cloud, con la Google Sheets API habilitada). Abre el navegador, el usuario
// elige su cuenta y acepta "ver hojas de cálculo"; el refresh token se guarda en
// GOOGLE_OAUTH_TOKEN_FILE (permisos 600). Después, `./run.sh embarques` ya lee el
// Sheet solo, sin la app de Claude.
import { createServer } from 'node:http';
import { writeFileSync, chmodSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { leerClienteOAuth } from './lib/sheets.mjs';

const TOKEN_FILE = process.env.GOOGLE_OAUTH_TOKEN_FILE || './google-oauth-token.json';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
const cli = leerClienteOAuth();
const state = randomBytes(12).toString('hex');

const server = createServer();
await new Promise((res) => server.listen(0, '127.0.0.1', res));
const redirect = `http://127.0.0.1:${server.address().port}/`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: cli.client_id, redirect_uri: redirect, response_type: 'code', scope: SCOPE,
  access_type: 'offline', prompt: 'consent', state,
}).toString();

console.log('\nAbre este enlace en el navegador (se intenta abrir solo), elige tu cuenta y acepta:\n\n  ' + url + '\n');
execFile('open', [url], () => {});

const code = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Se agotaron 10 minutos esperando la autorización')), 600_000);
  server.on('request', (req, res) => {
    const u = new URL(req.url, redirect);
    if (u.pathname !== '/') { res.writeHead(404); res.end(); return; }
    const err = u.searchParams.get('error');
    if (err || u.searchParams.get('state') !== state) { res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('Autorización rechazada: ' + (err || 'state inválido')); clearTimeout(t); reject(new Error(err || 'state inválido')); return; }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end('<h2 style="font-family:sans-serif">✓ Listo. Ya puedes cerrar esta pestaña.</h2>');
    clearTimeout(t); resolve(u.searchParams.get('code'));
  });
});
server.close();

const r = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ code, client_id: cli.client_id, client_secret: cli.client_secret, redirect_uri: redirect, grant_type: 'authorization_code' }).toString(),
});
const j = await r.json();
if (!r.ok || !j.refresh_token) { console.error('✗ Google no devolvió refresh_token:', JSON.stringify(j).slice(0, 300)); process.exit(1); }
writeFileSync(TOKEN_FILE, JSON.stringify({ refresh_token: j.refresh_token, scope: j.scope, obtenido: new Date().toISOString() }, null, 2));
chmodSync(TOKEN_FILE, 0o600);
console.log(`✓ Token guardado en ${TOKEN_FILE}. Prueba:  node --env-file=credenciales.env sync.mjs test`);
