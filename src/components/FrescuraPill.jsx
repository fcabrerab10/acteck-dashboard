// Pill de frescura de datos · "Datos al 9 sep · 13:00" (verde) / "Sell Out hace
// 12 d" (naranja) / "Sin datos" (gris). Tooltip nativo con el detalle por fuente.
//   <FrescuraPill pantalla="sellIn" clienteKey={clienteKey} />           en superficie normal
//   <Hero … children={<FrescuraPill pantalla="sellIn" inverso />} />     dentro del Hero (fondo negro)
// Props: pantalla (clave de FUENTES_POR_PANTALLA) o fuentes (array de slugs),
// clienteKey (elige la fuente de sell-out), inverso (colores para fondo inverso),
// onClick (si no se da: super admin → abre /uploads.html), style.
import React from 'react';
import { Pill, toneColors } from './kit';
import { useTheme } from '../lib/themeContext';
import { usePerfil } from '../lib/perfilContext';
import { puedeActualizarDatos } from '../lib/permisos';
import { useFrescura, fuentesDe, resumirFrescura, formatFrescura, etiquetaCorta } from '../lib/frescura';

const ESTADO_TXT = { ok: 'ok', atrasada: 'atrasada', sin_datos: 'sin datos' };
const fmtN = (n) => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 0 }).format(Number(n) || 0);

// Tonos sobre fondo inverso. En Claro/Marfil el Hero es negro: fondo translúcido
// claro + texto claro con matiz del semáforo (contraste AA sobre negro). En
// Midnight el Hero es la superficie clara/elevada, así que ahí van los tonos de
// modo claro (ver abajo, toneColors con mode 'light').
const INVERSO = {
  green:  { background: 'rgba(48,209,88,0.18)',   color: '#7EE2A0' },
  orange: { background: 'rgba(255,159,10,0.20)',  color: '#FFC46B' },
  gray:   { background: 'rgba(255,255,255,0.10)', color: 'rgba(245,245,247,0.78)' },
};

// Etiqueta cortísima por fuente para el modo detallado (una pill por fuente).
const CORTA = {
  erp_ventas: 'ERP', facturacion_clientes: 'Sell In', inventario_acteck: 'Inventario', precios_sku: 'Precios',
  estados_cuenta: 'Edo. cuenta', sellout_general: 'Sell Out', sellout_detalle: 'Sell Out', sellout_sku: 'Sell Out',
  sellout_pcel: 'Sell Out PCEL', inventario_cliente: 'Inv. cliente', embarques_compras: 'Embarques', cuotas_mensuales: 'Cuotas',
  programacion_arribos: 'Arribos', compras_oc: 'OC compras', guias_erp: 'Guías', roadmap_sku: 'Roadmap', estados_resultados: 'P&L',
};
const cortaDe = (r) => CORTA[r.fuente] || etiquetaCorta(r);

// Hora si fue hoy, "ayer · 19:29" si fue ayer, si no "8 sep · 11:45".
const TZ = 'America/Mexico_City';
const diaISO = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
function cuando(ts) {
  if (!ts) return 'sin carga';
  const d = new Date(ts); if (Number.isNaN(d.getTime())) return '—';
  const hoy = new Date(), ayer = new Date(Date.now() - 86400000);
  const hora = new Intl.DateTimeFormat('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ }).format(d);
  if (diaISO(d) === diaISO(hoy)) return `hoy · ${hora}`;
  if (diaISO(d) === diaISO(ayer)) return `ayer · ${hora}`;
  return formatFrescura(ts);
}

export default function FrescuraPill({ pantalla, fuentes, clienteKey, inverso = false, onClick, style, detallado = false }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const slugs = fuentesDe(pantalla, clienteKey, fuentes);
  const { porFuente, cargando, error } = useFrescura(slugs.length > 0);
  if (!slugs.length) return null;

  const filas = slugs.map((s) => porFuente[s]).filter(Boolean);
  const res = resumirFrescura(filas);

  let tone = 'gray', texto = 'Sin datos';
  if (cargando) texto = 'Datos…';
  else if (error) texto = 'Frescura n/d';
  else if (res.estado === 'ok') { tone = 'green'; texto = `Datos al ${formatFrescura(res.fecha)}`; }
  else if (res.estado === 'atrasada') { tone = 'orange'; texto = `${etiquetaCorta(res.fila)} hace ${res.fila.dias} d`; }

  // Tooltip: una línea por fuente (las que este usuario puede ver).
  const lineas = slugs.map((s) => {
    const r = porFuente[s];
    if (!r) return `${s}: sin acceso o sin datos`;
    const partes = [`${r.etiqueta}: ${r.ultima_carga ? formatFrescura(r.ultima_carga) : 'sin carga'}`];
    if (r.periodo_max) partes.push(`hasta ${r.periodo_max}`);
    if (r.filas != null) partes.push(`${fmtN(r.filas)} filas`);
    partes.push(r.estado === 'atrasada' ? `atrasada ${r.dias} d (umbral ${r.umbral_dias})` : ESTADO_TXT[r.estado] || r.estado);
    return partes.join(' · ');
  });
  const puedeSubir = puedeActualizarDatos(perfil);
  const title = lineas.join('\n') + (puedeSubir && !onClick ? '\n\nClic para abrir el importador' : '');

  const click = onClick || (puedeSubir ? () => window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina: 'actualizacion' } })) : undefined);
  let colores = null;
  if (inverso) {
    if (theme.mode === 'dark') {
      const [background, color] = toneColors({ mode: 'light', textMuted: '#6E6E73' }, tone);
      colores = { background, color };
    } else colores = INVERSO[tone];
  }
  const estilo = { fontVariantNumeric: 'tabular-nums', ...colores, ...style };
  // Modo detallado: una pill por fuente con SU última carga (en vez de resumir en la más vieja).
  if (detallado && !cargando && !error) {
    return (
      <span style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, ...style }} title={title}>
        {slugs.map((sl) => {
          const r = porFuente[sl];
          if (!r) return null;
          const t = r.estado === 'atrasada' ? 'orange' : r.estado === 'ok' ? 'green' : 'gray';
          return <Pill key={sl} tone={t} dot size="xs" onClick={click} style={{ fontVariantNumeric: 'tabular-nums', ...(inverso ? (theme.mode === 'dark' ? null : INVERSO[t]) : null) }}>{cortaDe(r)} {cuando(r.ultima_carga)}</Pill>;
        })}
      </span>
    );
  }
  return (
    <Pill tone={tone} dot size="sm" onClick={click} title={title} style={estilo}>
      {texto}
    </Pill>
  );
}
