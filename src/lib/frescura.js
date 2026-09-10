// Frescura de datos · lee v_fuentes_frescura (1 fila por fuente: ultima_carga,
// periodo_max, filas, umbral_dias, estado ok|atrasada|sin_datos, dias) y la
// resume por pantalla. La consume <FrescuraPill/>; el cron usa la misma vista.
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from './supabase';
import { cachedQuery } from './queries';

const STALE_MS = 5 * 60 * 1000;

// Fuente de sell-out según el cliente. El token 'sellout_*' en el mapa de abajo
// se expande con esto (sin clienteKey → mayoristas).
export const SELLOUT_POR_CLIENTE = {
  digitalife: ['sellout_detalle'],
  dicotech:   ['sellout_general', 'sellout_sku'],
  pcel:       ['sellout_pcel'],
};
const SELLOUT_DEFAULT = ['sellout_general'];

// pantalla → fuentes que la alimentan. Vacío = la pantalla no muestra pill
// (p. ej. marketing: sus tablas las escribe la propia app, no son cargas).
export const FUENTES_POR_PANTALLA = {
  sellIn:            ['facturacion_clientes'],
  sellOut:           ['sellout_*'],
  inventarioGlobal:  ['inventario_acteck', 'embarques_compras'],
  pagos:             ['facturacion_clientes', 'sellout_*'],
  propuestas:        ['precios_sku', 'inventario_acteck', 'inventario_cliente'],
  visionGeneral:     ['facturacion_clientes', 'inventario_acteck', 'sellout_general'],
  forecastClientes:  ['sellout_*', 'inventario_acteck', 'embarques_compras'],
  cobranza:          ['estados_cuenta'],
  estrategiaPrecios: ['precios_sku', 'roadmap_sku'],
  ventasErp:         ['erp_ventas'],
  home:              ['facturacion_clientes', 'sellout_*'],
  marketing:         [],
};

// Lista final de slugs para una pantalla (o un array explícito) y cliente.
export function fuentesDe(pantalla, clienteKey, fuentes) {
  const base = Array.isArray(fuentes) ? fuentes : (FUENTES_POR_PANTALLA[pantalla] || []);
  const out = [];
  for (const f of base) {
    const exp = f === 'sellout_*' ? (SELLOUT_POR_CLIENTE[clienteKey] || SELLOUT_DEFAULT) : [f];
    for (const s of exp) if (!out.includes(s)) out.push(s);
  }
  return out;
}

const RANGO = { atrasada: 2, sin_datos: 1, ok: 0 };

// Resume un conjunto de filas de la vista en un solo estado para el pill:
//   { estado: 'ok'|'atrasada'|'sin_datos'|'cargando', fila, fecha, filas }
//   · atrasada → fila = la más atrasada (más días); fecha = su ultima_carga
//   · ok       → fecha = la carga MÁS ANTIGUA entre las fuentes (todo está al
//                menos así de fresco); fila = esa fuente
//   · sin_datos→ ninguna fuente tiene carga visible para este usuario
export function resumirFrescura(filas) {
  const rows = (filas || []).filter(Boolean);
  if (!rows.length) return { estado: 'sin_datos', fila: null, fecha: null, filas: rows };
  const atrasadas = rows.filter((r) => r.estado === 'atrasada').sort((a, b) => (b.dias ?? 0) - (a.dias ?? 0));
  if (atrasadas.length) return { estado: 'atrasada', fila: atrasadas[0], fecha: atrasadas[0].ultima_carga, filas: rows };
  const ok = rows.filter((r) => r.estado === 'ok' && r.ultima_carga).sort((a, b) => new Date(a.ultima_carga) - new Date(b.ultima_carga));
  if (ok.length) return { estado: 'ok', fila: ok[0], fecha: ok[0].ultima_carga, filas: rows };
  return { estado: 'sin_datos', fila: null, fecha: null, filas: rows };
}

// Peor fila de un conjunto (para `peor` del hook): atrasada > sin_datos > ok,
// y dentro de atrasadas la de más días.
export function peorDe(filas) {
  let peor = null;
  for (const r of filas || []) {
    if (!peor) { peor = r; continue; }
    const d = (RANGO[r.estado] ?? 0) - (RANGO[peor.estado] ?? 0);
    if (d > 0 || (d === 0 && (r.dias ?? 0) > (peor.dias ?? 0))) peor = r;
  }
  return peor;
}

const TZ = 'America/Mexico_City';
const fmtDia  = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', timeZone: TZ });
const fmtDiaA = new Intl.DateTimeFormat('es-MX', { day: 'numeric', month: 'short', year: 'numeric', timeZone: TZ });
const fmtHora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
const anioDe  = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: TZ });

// '2026-09-09T18:00:00Z' → '9 sep · 13:00' (hora CDMX; agrega el año si no es el actual).
export function formatFrescura(ts, { hora = true } = {}) {
  if (!ts) return '—';
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return '—';
  const mismoAnio = anioDe.format(d) === anioDe.format(new Date());
  const dia = (mismoAnio ? fmtDia : fmtDiaA).format(d).replace(/\.$/, '').replace(' de ', ' ');
  return hora ? `${dia} · ${fmtHora.format(d)}` : dia;
}

// Etiqueta corta para el pill naranja: 'Sell Out detalle (Digitalife)' → 'Sell Out detalle'.
export const etiquetaCorta = (fila) => String(fila?.etiqueta || fila?.fuente || '').replace(/\s*\(.*\)\s*$/, '');

export async function fetchFrescura() {
  const { data, error } = await cachedQuery(supabase.from('v_fuentes_frescura').select('*'));
  if (error) throw error;
  return data || [];
}

// Hook: { porFuente, peor, cargando, filas, error, refetch }
export function useFrescura(enabled = true) {
  const q = useQuery({ queryKey: ['frescura'], queryFn: fetchFrescura, staleTime: STALE_MS, enabled });
  const filas = q.data || [];
  const porFuente = useMemo(() => Object.fromEntries(filas.map((r) => [r.fuente, r])), [filas]);
  const peor = useMemo(() => peorDe(filas), [filas]);
  return { porFuente, peor, cargando: q.isLoading, filas, error: q.error || null, refetch: q.refetch };
}
