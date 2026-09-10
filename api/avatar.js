// api/avatar.js — foto de perfil ilustrada.
//
// POST   { selfie: dataURL jpeg ≤ 2 MB, fondo: 'noche'|'dia', avatar?: dataURL png }
//        1) guarda la selfie original en el bucket privado `avatares-privado/selfies/{user_id}.jpg`
//        2) si hay IMAGE_API_KEY → genera la ilustración con el proveedor (IMAGE_PROVIDER, 'openai' por defecto)
//           si NO hay clave → usa `avatar` (PNG compuesto en el navegador: selfie en círculo sobre
//           public/avatares/fondo-*.svg; `sharp` no está en package.json, por eso se compone en el cliente)
//        3) sube el PNG a `avatares/{user_id}.png` (upsert) y actualiza perfiles.avatar_url (+ ?v=timestamp)
//        → { avatar_url, generado_por: 'openai' | 'fallback' }
// DELETE quita el avatar (borra el PNG y deja avatar_url = null).
//
// Requiere sesión (requireAuth). Sólo el service role escribe en Storage: los buckets no tienen
// policies de escritura para `authenticated` (migración 20260911_perfil_avatar.sql).
import { requireAuth } from './_auth.js';

export const config = { api: { bodyParser: { sizeLimit: '8mb' } } };

const SB_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://hrhccvuhnedahznewgaj.supabase.co';
const SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BUCKET_PUBLICO = 'avatares';
const BUCKET_PRIVADO = 'avatares-privado';
const MAX_SELFIE = 2 * 1024 * 1024;
const MAX_AVATAR = 4 * 1024 * 1024;
const FONDOS = ['noche', 'dia'];

// ─── Prompt fijo por fondo ───
const ESTILO = [
  'Flat cartoon illustration of the person in the reference photo, keeping their facial features, hair, skin tone and glasses recognizable.',
  'Clean vector-like linework, flat solid colors, soft cel shading, no gradients, no texture, no photorealism.',
  'The person is seated in a black high-back office chair, wearing a black suit jacket over a white shirt, hands clasped together resting on a wooden desk, an open laptop on the desk to their right.',
  'Framing: centered medium bust shot (head and shoulders to the desk), facing the camera, slight friendly smile.',
  'Square 1024x1024 composition, no text, no watermark, no logos, no caption.',
].join(' ');

export const PROMPT_AVATAR = {
  noche: `${ESTILO} Background: a modern office with a large floor-to-ceiling window behind the chair showing a city skyline of skyscrapers at night, illuminated windows, dark blue tones, a few stars. Ambient palette: deep navy and black with warm yellow window lights.`,
  dia: `${ESTILO} Background: a modern office with a large floor-to-ceiling window behind the chair showing a city skyline of skyscrapers in daylight, clear light-blue sky, a couple of white clouds and the sun. Ambient palette: bright, airy, light blue and warm beige.`,
};

// ─── Utilidades ───
function parseDataURL(s, { tipos, max }) {
  if (typeof s !== 'string') return null;
  const m = /^data:(image\/(?:jpeg|jpg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(s);
  if (!m) return null;
  const mime = m[1] === 'image/jpg' ? 'image/jpeg' : m[1];
  if (tipos && !tipos.includes(mime)) return null;
  const buf = Buffer.from(m[2].replace(/\s/g, ''), 'base64');
  if (!buf.length || buf.length > max) return null;
  return { mime, buf };
}

async function storagePut(bucket, path, buf, contentType) {
  const r = await fetch(`${SB_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'POST',
    headers: {
      apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': contentType,
      'x-upsert': 'true', 'cache-control': '3600',
    },
    body: buf,
  });
  if (!r.ok) throw new Error(`Storage ${bucket}/${path}: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

async function storageDelete(bucket, path) {
  await fetch(`${SB_URL}/storage/v1/object/${bucket}/${path}`, {
    method: 'DELETE', headers: { apikey: SRK, Authorization: `Bearer ${SRK}` },
  }).catch(() => {});
}

async function perfilPatch(userId, body) {
  const r = await fetch(`${SB_URL}/rest/v1/perfiles?user_id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: { apikey: SRK, Authorization: `Bearer ${SRK}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`perfiles PATCH: ${r.status} ${(await r.text()).slice(0, 200)}`);
}

// ─── Proveedores de imagen ───
// Cada uno recibe { selfie: {mime, buf}, prompt } y devuelve un Buffer PNG 1024×1024.
async function generarOpenAI({ selfie, prompt }) {
  const form = new FormData();
  form.append('model', 'gpt-image-1');
  form.append('prompt', prompt);
  form.append('size', '1024x1024');
  form.append('quality', 'medium');
  form.append('n', '1');
  form.append('image', new Blob([selfie.buf], { type: selfie.mime }), selfie.mime === 'image/png' ? 'selfie.png' : 'selfie.jpg');
  const r = await fetch('https://api.openai.com/v1/images/edits', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.IMAGE_API_KEY}` },
    body: form,
    signal: AbortSignal.timeout(110_000),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j?.error?.message || 'error'}`);
  const b64 = j?.data?.[0]?.b64_json;
  if (b64) return Buffer.from(b64, 'base64');
  const url = j?.data?.[0]?.url;
  if (url) return Buffer.from(await (await fetch(url)).arrayBuffer());
  throw new Error('OpenAI: respuesta sin imagen');
}

// Para añadir otro proveedor: implementar generarX({ selfie, prompt }) → Buffer PNG y registrarlo aquí.
const PROVEEDORES = { openai: generarOpenAI };

function proveedorActivo() {
  if (!process.env.IMAGE_API_KEY) return null;
  const nombre = (process.env.IMAGE_PROVIDER || 'openai').toLowerCase();
  return PROVEEDORES[nombre] ? { nombre, generar: PROVEEDORES[nombre] } : null;
}

// ─── Handler ───
export default async function handler(req, res) {
  if (!SRK) return res.status(500).json({ error: 'SUPABASE_SERVICE_ROLE_KEY missing' });
  const perfil = await requireAuth(req, res);
  if (!perfil) return;
  const uid = perfil.user_id;

  if (req.method === 'DELETE') {
    try {
      await storageDelete(BUCKET_PUBLICO, `${uid}.png`);
      await perfilPatch(uid, { avatar_url: null, avatar_estado: null });
      return res.status(200).json({ ok: true });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST o DELETE' });

  const { selfie: selfieRaw, fondo, avatar: avatarRaw } = req.body || {};
  if (!FONDOS.includes(fondo)) return res.status(400).json({ error: "fondo debe ser 'noche' o 'dia'" });
  const selfie = parseDataURL(selfieRaw, { tipos: ['image/jpeg', 'image/png'], max: MAX_SELFIE });
  if (!selfie) return res.status(400).json({ error: 'selfie debe ser un dataURL JPEG/PNG de hasta 2 MB' });

  const proveedor = proveedorActivo();
  const avatarCliente = avatarRaw ? parseDataURL(avatarRaw, { tipos: ['image/png', 'image/jpeg'], max: MAX_AVATAR }) : null;
  if (!proveedor && !avatarCliente) {
    return res.status(422).json({ error: 'Sin proveedor de imagen configurado: envía `avatar` (PNG compuesto en el cliente)', sin_proveedor: true });
  }

  try {
    await perfilPatch(uid, { avatar_estado: 'pendiente', avatar_fondo: fondo });
    await storagePut(BUCKET_PRIVADO, `selfies/${uid}.jpg`, selfie.buf, selfie.mime);

    let png; let generado_por;
    if (proveedor) {
      try {
        png = await proveedor.generar({ selfie, prompt: PROMPT_AVATAR[fondo] });
        generado_por = proveedor.nombre;
      } catch (e) {
        console.warn('[avatar] proveedor falló, usando fallback:', e.message);
        if (!avatarCliente) throw e;
      }
    }
    if (!png) { png = avatarCliente.buf; generado_por = 'fallback'; }

    await storagePut(BUCKET_PUBLICO, `${uid}.png`, png, 'image/png');
    const avatar_url = `${SB_URL}/storage/v1/object/public/${BUCKET_PUBLICO}/${uid}.png?v=${Date.now()}`;
    await perfilPatch(uid, { avatar_url, avatar_estado: 'listo', avatar_fondo: fondo });
    return res.status(200).json({ avatar_url, generado_por, meta: { generado_por, fondo } });
  } catch (e) {
    console.error('[avatar]', e);
    await perfilPatch(uid, { avatar_estado: 'error' }).catch(() => {});
    return res.status(500).json({ error: e.message || 'No se pudo generar el avatar' });
  }
}
