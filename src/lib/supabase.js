import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

// True cuando las variables de entorno están configuradas en Vercel
export const DB_CONFIGURED = !!(SUPABASE_URL && SUPABASE_ANON_KEY)

export const SB_URL = SUPABASE_URL || 'https://placeholder.supabase.co'
export const SB_ANON = SUPABASE_ANON_KEY || 'placeholder-anon-key'

export const supabase = createClient(SB_URL, SB_ANON)

// Paginated REST fetch — bypasses supabase-js .range() quirks.
// queryPath: path after /rest/v1/ including filters, e.g. "inventario_acteck?select=*&no_almacen=in.(1,2,3)"
//
// IMPORTANTE: usa el JWT del usuario autenticado cuando existe, cayendo al
// anon key solo si no hay sesión. Sin el JWT, las policies RLS que exigen
// rol `authenticated` (la mayoría después de la migración 20260422_rls_*)
// rechazan las lecturas y esta función devuelve [].
export async function fetchAllPagesREST(queryPath) {
  const PAGE = 1000
  let all = []
  let offset = 0
  // Strip any existing limit/offset from the path
  const cleanPath = queryPath.replace(/([&?])(limit|offset)=[^&]*/g, '').replace(/\?&/, '?')
  const sep = cleanPath.includes('?') ? '&' : '?'
  // Resolver JWT una sola vez al inicio (evita una llamada por página)
  let jwt = SB_ANON
  try {
    const { data } = await supabase.auth.getSession()
    if (data?.session?.access_token) jwt = data.session.access_token
  } catch (_) { /* noop */ }
  while (true) {
    const url = `${SB_URL}/rest/v1/${cleanPath}${sep}limit=${PAGE}&offset=${offset}`
    const r = await fetch(url, {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + jwt },
    })
    if (!r.ok) break
    const batch = await r.json()
    if (!Array.isArray(batch)) break
    all = all.concat(batch)
    if (batch.length < PAGE) break
    offset += PAGE
  }
  return all
}
