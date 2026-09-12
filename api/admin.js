// api/admin.js — UNA sola función serverless para todos los endpoints de administración.
// Vercel (plan Hobby) permite 12 funciones por deploy; antes eran 5 archivos aquí. Las rutas
// públicas no cambian: vercel.json reescribe /api/admin/<accion> → /api/admin?accion=<accion>.
// Cada acción vive en api/admin/_<accion>.js (el guion bajo evita que Vercel lo cuente como función).
import createUser from './admin/_create-user.js';
import resendInvitation from './admin/_resend-invitation.js';
import sync from './admin/_sync.js';
import toggleSuspend from './admin/_toggle-suspend.js';
import updateUser from './admin/_update-user.js';

const ACCIONES = {
  'create-user': createUser,
  'resend-invitation': resendInvitation,
  'sync': sync,
  'toggle-suspend': toggleSuspend,
  'update-user': updateUser,
};

export default async function handler(req, res) {
  const accion = String(req.query?.accion || '').trim()
    || String(req.url || '').replace(/\?.*$/, '').split('/api/admin/')[1] || '';
  const fn = ACCIONES[accion];
  if (!fn) return res.status(404).json({ error: `Acción desconocida: ${accion || '(vacía)'}`, acciones: Object.keys(ACCIONES) });
  return fn(req, res);
}
