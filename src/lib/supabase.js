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
export async function fetchAllPagesREST(queryPath) {
  const PAGE = 1000
  let all = []
  let offset = 0
  // Strip any existing limit/offset from the path
  const cleanPath = queryPath.replace(/([&?])(limit|offset)=[^&]*/g, '').replace(/\?&/, '?')
  const sep = cleanPath.includes('?') ? '&' : '?'
  while (true) {
    const url = `${SB_URL}/rest/v1/${cleanPath}${sep}limit=${PAGE}&offset=${offset}`
    const r = await fetch(url, {
      headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
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
