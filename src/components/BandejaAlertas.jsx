// BandejaAlertas — card "Qué atender hoy" (bandeja de alertas del cron
// generar-alertas). Estilo Ferruteck: hairlines, SF, dots de severidad.
//
//   <BandejaAlertas clienteKey={null} onNavegar={handleNavegar} />          // global
//   <BandejaAlertas clienteKey="digitalife" compacto onNavegar={...} />     // home cliente
//
// Props:
//   clienteKey  — filtra por cliente; null = todas.
//   compacto    — sin detalle, padding reducido.
//   onNavegar   — (clienteId, paginaId) como App.handleNavegar. Recibe el destino
//                 de `destinoAlerta`; si el destino trae `url` se abre aparte.
//   email       — opcional; si no viene se toma de supabase.auth.
//
// Export nombrado `BadgeAlertas`: pill con críticas+altas activas (Topbar).
import React, { useMemo, useState } from 'react';
import { Check, Clock, ChevronDown, ChevronUp, AlertTriangle, ArrowUpRight } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { supabase } from '../lib/supabase';
import {
  useAlertas, resolverAlerta, posponerAlerta, destinoAlerta, contarPorSeveridad, SEV_LABEL,
} from '../lib/alertas';

const MAX_COMPACTO = 6;
const SALIDA_MS = 160;
const NOMBRE = { digitalife: 'Digitalife', pcel: 'PCEL', dicotech: 'Dicotech', mayoreo: 'Mayoreo', distribuidor: 'Distribuidor', e_commerce: 'E-commerce', mostrador: 'Mostrador', retail_propios: 'Retail propios', retail_representados: 'Retail rep.', otros: 'Otros' };

function colorSev(theme, sev) {
  return {
    critica: theme.red || '#FF3B30',
    alta: theme.orange || '#FF9500',
    media: theme.yellow || '#FFCC00',
    info: theme.accent || '#007AFF',
  }[sev] || theme.textSubtle;
}

async function emailActual(email) {
  if (email) return email;
  try { const { data } = await supabase.auth.getUser(); return data?.user?.email || 'usuario'; }
  catch { return 'usuario'; }
}

export default function BandejaAlertas({ clienteKey = null, compacto = false, onNavegar, email, titulo = 'Qué atender hoy' }) {
  const { theme } = useTheme();
  const { data: alertas = [], isLoading, isError } = useAlertas({ clienteKey });
  const [expandido, setExpandido] = useState(false);
  const [saliendo, setSaliendo] = useState(() => new Set());
  const [ocultas, setOcultas] = useState(() => new Set()); // optimista hasta que refetch confirme

  const visibles = useMemo(() => alertas.filter((a) => !ocultas.has(a.id)), [alertas, ocultas]);
  const conteo = useMemo(() => contarPorSeveridad(visibles), [visibles]);
  const lista = expandido ? visibles : visibles.slice(0, MAX_COMPACTO);
  const restantes = visibles.length - lista.length;

  const salir = (id, accion) => {
    setSaliendo((s) => new Set(s).add(id));
    setTimeout(async () => {
      setOcultas((s) => new Set(s).add(id));
      setSaliendo((s) => { const n = new Set(s); n.delete(id); return n; });
      try { await accion(); }
      catch (e) { console.error('alertas:', e); setOcultas((s) => { const n = new Set(s); n.delete(id); return n; }); }
    }, SALIDA_MS);
  };
  const resolver = (a) => salir(a.id, async () => resolverAlerta(a.id, await emailActual(email)));
  const posponer = (a) => salir(a.id, () => posponerAlerta(a.id, 3));
  const ir = (a) => {
    const d = destinoAlerta(a);
    if (!d) return;
    if (d.url) { window.open(d.url, '_blank', 'noopener'); return; }
    onNavegar?.(d.clienteKey, d.pagina, d);
  };

  const pad = compacto ? '14px 16px' : '18px 22px';
  const card = {
    background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 18,
    boxShadow: theme.shadow, fontFamily: TYPO.fontText, color: theme.text, overflow: 'hidden',
  };
  const btnIcon = (color) => ({
    width: 26, height: 26, borderRadius: 8, border: `1px solid ${theme.border}`, background: 'transparent',
    color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, flexShrink: 0,
  });

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: pad, borderBottom: `1px solid ${theme.border}` }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <AlertTriangle size={14} color={conteo.critica ? colorSev(theme, 'critica') : theme.textMuted} />
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: compacto ? 14 : 15, fontWeight: 600, letterSpacing: '-0.01em' }}>{titulo}</span>
          {clienteKey && <span style={{ fontSize: 11, color: theme.textSubtle }}>· {NOMBRE[clienteKey] || clienteKey}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {['critica', 'alta', 'media', 'info'].map((s) => (
            <span key={s} title={SEV_LABEL[s]} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: conteo[s] ? theme.text : theme.textSubtle, fontVariantNumeric: 'tabular-nums' }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: colorSev(theme, s), opacity: conteo[s] ? 1 : 0.35 }} />
              {conteo[s]}
            </span>
          ))}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div style={{ padding: pad, fontSize: 12.5, color: theme.textSubtle }}>Cargando alertas…</div>
      ) : isError ? (
        <div style={{ padding: pad, fontSize: 12.5, color: theme.red || '#FF3B30' }}>No se pudieron cargar las alertas.</div>
      ) : visibles.length === 0 ? (
        <div style={{ padding: pad, display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.textMuted }}>
          <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.green || '#34C759' }} />
          Todo en orden. Nada pendiente por atender.
        </div>
      ) : (
        <div>
          {lista.map((a, i) => {
            const sale = saliendo.has(a.id);
            const col = colorSev(theme, a.severidad);
            const pill = a.sku || (a.cliente_key ? (NOMBRE[a.cliente_key] || a.cliente_key) : null);
            const navegable = !!destinoAlerta(a);
            return (
              <div
                key={a.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: compacto ? '9px 16px' : '11px 22px',
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.border}`,
                  opacity: sale ? 0 : 1, transform: sale ? 'translateX(12px)' : 'none',
                  transition: `opacity ${SALIDA_MS}ms ease, transform ${SALIDA_MS}ms ease`,
                }}
              >
                <span title={SEV_LABEL[a.severidad]} style={{ width: 8, height: 8, borderRadius: 999, background: col, boxShadow: a.severidad === 'critica' ? `0 0 6px ${col}88` : 'none', flexShrink: 0 }} />
                <div
                  onClick={() => navegable && ir(a)}
                  style={{ flex: 1, minWidth: 0, cursor: navegable ? 'pointer' : 'default' }}
                  title={a.detalle || ''}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                    <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.titulo}</span>
                    {navegable && <ArrowUpRight size={11} color={theme.textSubtle} style={{ flexShrink: 0 }} />}
                  </div>
                  {!compacto && a.detalle && (
                    <div style={{ fontSize: 11.5, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{a.detalle}</div>
                  )}
                </div>
                {pill && (
                  <span style={{
                    fontSize: 10.5, fontWeight: 500, padding: '2px 7px', borderRadius: 999, flexShrink: 0,
                    border: `1px solid ${theme.border}`, color: theme.textMuted, background: theme.bg,
                    fontFamily: a.sku ? '"SF Mono", ui-monospace, Menlo, monospace' : TYPO.fontText,
                    letterSpacing: a.sku ? 0 : '0.01em',
                  }}>{pill}</span>
                )}
                <button onClick={() => posponer(a)} title="Posponer 3 días" style={btnIcon(theme.textMuted)}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <Clock size={13} />
                </button>
                <button onClick={() => resolver(a)} title="Resolver" style={btnIcon(theme.green || '#34C759')}
                  onMouseEnter={(e) => { e.currentTarget.style.background = theme.surfaceHover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
                  <Check size={13} />
                </button>
              </div>
            );
          })}
          {(restantes > 0 || expandido) && visibles.length > MAX_COMPACTO && (
            <button
              onClick={() => setExpandido((v) => !v)}
              style={{
                width: '100%', border: 'none', borderTop: `1px solid ${theme.border}`, background: 'transparent',
                padding: compacto ? '8px 16px' : '10px 22px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 500, color: theme.accent, cursor: 'pointer',
              }}
            >
              {expandido ? <>Ver menos <ChevronUp size={12} /></> : <>Ver todas ({visibles.length}) <ChevronDown size={12} /></>}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Pill pequeño para el Topbar: críticas + altas activas (globales). */
export function BadgeAlertas({ onClick, clienteKey = null, style }) {
  const { theme } = useTheme();
  const { data: alertas = [] } = useAlertas({ clienteKey });
  const c = contarPorSeveridad(alertas);
  const n = c.critica + c.alta;
  if (!n) return null;
  const col = c.critica ? (theme.red || '#FF3B30') : (theme.orange || '#FF9500');
  return (
    <button
      onClick={onClick}
      title={`${c.critica} crítica${c.critica === 1 ? '' : 's'} · ${c.alta} alta${c.alta === 1 ? '' : 's'}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '2px 8px 2px 6px', borderRadius: 999,
        border: `1px solid ${col}55`, background: `${col}1A`, color: col, cursor: onClick ? 'pointer' : 'default',
        fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, lineHeight: 1.4, fontVariantNumeric: 'tabular-nums',
        ...style,
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: 999, background: col, boxShadow: `0 0 6px ${col}88` }} />
      {n > 99 ? '99+' : n}
    </button>
  );
}
