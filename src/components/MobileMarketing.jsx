// MobileMarketing — pestaña interior Marketing mobile-native (read-only).
// Aplica a Digitalife, Dicotech y PCEL — reemplaza MarketingClienteV2 en mobile.
//
// Patrones mobile-native del mockup v3:
//   - Back header
//   - Selector de mes (chips scroll H, 12 meses)
//   - 2×2 KPI tiles (Actividades, Inversión, Con pago, Sin pago)
//   - Bar-list por tipo con color del tipo
//   - Lista de actividades del mes stackeadas (icono + nombre + tipo + $)
//
// La creación/edición se hace desde desktop — mobile es solo consulta.

import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, Mail, Video, Image as ImageIcon, Smartphone, Search, PartyPopper } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const MES_CORTO = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

const TIPOS = {
  mailing:    { label: 'Mailing',    color: '#30D158', Icon: Mail },
  reel:       { label: 'Reel',       color: '#BF5AF2', Icon: Video },
  banner:     { label: 'Banner',     color: '#0071E3', Icon: ImageIcon },
  meta_ads:   { label: 'Meta Ads',   color: '#FFD60A', Icon: Smartphone },
  google_ads: { label: 'Google Ads', color: '#FF9F0A', Icon: Search },
  evento:     { label: 'Evento',     color: '#FF375F', Icon: PartyPopper },
};

const fmtMXN = (n) => {
  if (!isFinite(n) || !n) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n)}`;
};

const parseFecha = (s) => {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || !m || !d) return null;
  return { y, m, d };
};

export default function MobileMarketing({ clienteKey, onBack, onNavegar }) {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';
  const cliente = CLIENTES[clienteKey];
  const anio = new Date().getFullYear();
  const [mesSel, setMesSel] = useState(new Date().getMonth() + 1);
  const [actividades, setActividades] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true); setError(null);
      try {
        const { data, error: e } = await supabase.from('marketing_actividades')
          .select('*').eq('cliente', clienteKey).eq('anio', anio);
        if (!alive) return;
        if (e) throw e;
        setActividades(data || []);
      } catch (e) {
        if (alive) setError(e.message || String(e));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [clienteKey, anio]);

  const mesData = useMemo(() => {
    const out = { total: [], porTipo: new Map(), inversion: 0, conPago: 0, sinPago: 0, invSinPago: 0 };
    for (const a of actividades) {
      const pf = parseFecha(a.fecha);
      const m = pf ? pf.m : Number(a.mes) || 0;
      if (m !== mesSel) continue;
      out.total.push(a);
      const inv = Number(a.inversion) || 0;
      out.inversion += inv;
      if (a.pago_id) out.conPago++;
      else { out.sinPago++; out.invSinPago += inv; }
      const t = a.tipo || 'otros';
      out.porTipo.set(t, (out.porTipo.get(t) || 0) + inv);
    }
    return out;
  }, [actividades, mesSel]);

  const barsPorTipo = useMemo(() => {
    const arr = Array.from(mesData.porTipo.entries())
      .map(([k, v]) => ({ k, monto: v, def: TIPOS[k] || { label: k, color: '#8E8E93' } }))
      .sort((a, b) => b.monto - a.monto);
    const total = arr.reduce((s, r) => s + r.monto, 0);
    return { rows: arr.map(r => ({ ...r, pct: total > 0 ? (r.monto / total) * 100 : 0 })), total };
  }, [mesData.porTipo]);

  // Sort actividades: pendientes primero, luego por fecha
  const actList = useMemo(() => {
    return mesData.total.slice().sort((a, b) => {
      const ap = a.estatus === 'completado' || a.estatus === 'archivado' ? 1 : 0;
      const bp = b.estatus === 'completado' || b.estatus === 'archivado' ? 1 : 0;
      if (ap !== bp) return ap - bp;
      const pa = parseFecha(a.fecha), pb = parseFecha(b.fecha);
      return (pa?.d || 0) - (pb?.d || 0);
    });
  }, [mesData.total]);

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Back header */}
      <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: 10 }}>
        <button onClick={onBack}
          style={{ background: 'transparent', border: 'none', padding: '6px 10px', color: theme.accent, fontSize: 14, fontWeight: 500, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: 'inherit' }}
        >
          <ChevronLeft size={16} strokeWidth={2.2} /> Cliente
        </button>
        <span style={{ fontSize: 12.5, color: theme.textMuted, fontWeight: 600 }}>{cliente?.label || clienteKey}</span>
      </div>

      {/* Título */}
      <div style={{ padding: '2px 18px 6px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Marketing</h1>
        <div style={{ color: theme.textMuted, fontSize: 12.5, marginTop: 2 }}>{anio}</div>
      </div>

      {/* Selector mes */}
      <div style={{ padding: '10px 18px 8px', display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }} className="mmk-hide">
        {MES_CORTO.map((m, i) => {
          const on = mesSel === i + 1;
          return (
            <button key={m}
              onClick={() => setMesSel(i + 1)}
              style={{
                flex: '0 0 auto', padding: '7px 12px', borderRadius: 100,
                background: on ? theme.text : theme.surface,
                border: `1px solid ${on ? theme.text : theme.border}`,
                color: on ? theme.bg : theme.textMuted,
                fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText,
                transition: 'background 200ms cubic-bezier(.4,0,.2,1)',
              }}
            >{m}</button>
          );
        })}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Cargando…</div>
      ) : error ? (
        <div style={{ margin: '4px 18px', padding: 16, background: 'rgba(255,59,48,.10)', border: '1px solid rgba(255,59,48,.22)', borderRadius: 12, color: theme.red || '#FF3B30', fontSize: 12.5 }}>{error}</div>
      ) : (
        <>
          {/* 2×2 KPI tiles */}
          <div style={{ padding: '4px 18px 6px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <KpiTile theme={theme} label="Actividades"
              value={mesData.total.length}
              delta={`${mesData.total.length > 0 ? MES_CORTO[mesSel - 1] : 'nada este mes'}`} />
            <KpiTile theme={theme} label="Inversión"
              value={fmtMXN(mesData.inversion)}
              delta="del mes" />
            <KpiTile theme={theme} label="Con pago"
              value={mesData.conPago}
              delta={mesData.total.length > 0 ? `${Math.round((mesData.conPago / mesData.total.length) * 100)}% pagadas` : '—'}
              positive={mesData.conPago === mesData.total.length && mesData.total.length > 0} />
            <KpiTile theme={theme} label="Sin pago"
              value={mesData.sinPago}
              delta={mesData.invSinPago > 0 ? `${fmtMXN(mesData.invSinPago)} pendientes` : 'todo pagado'}
              positive={mesData.sinPago === 0} />
          </div>

          {/* Bar-list por tipo */}
          {barsPorTipo.rows.length > 0 && (
            <>
              <SectionHead theme={theme} title="Inversión por tipo" sub={fmtMXN(barsPorTipo.total)} />
              <div style={{ margin: '4px 18px 8px', padding: 14, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {barsPorTipo.rows.map((r) => (
                    <div key={r.k} style={{ display: 'grid', gridTemplateColumns: '90px 1fr 78px', alignItems: 'center', gap: 10, fontSize: 12 }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: theme.text, fontWeight: 600 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: r.def.color }} />
                        {r.def.label}
                      </span>
                      <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.06)', borderRadius: 4, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${r.pct}%`, background: r.def.color, borderRadius: 4, transition: 'width 400ms cubic-bezier(.4,0,.2,1)' }} />
                      </div>
                      <span style={{ textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontWeight: 700 }}>{fmtMXN(r.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Lista actividades */}
          <SectionHead theme={theme} title={`Actividades · ${MES_CORTO[mesSel - 1]}`} sub={`${actList.length}`} />
          <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {actList.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: theme.textMuted, fontSize: 13, background: theme.surface, border: `1px dashed ${theme.border}`, borderRadius: 12 }}>
                Sin actividades en {MES_CORTO[mesSel - 1]}
              </div>
            )}
            {actList.map((a) => {
              const tipo = TIPOS[a.tipo] || { label: a.tipo || 'Otro', color: '#8E8E93', Icon: PartyPopper };
              const Icon = tipo.Icon;
              const done = a.estatus === 'completado' || a.estatus === 'archivado';
              const pf = parseFecha(a.fecha);
              return (
                <div key={a.id} style={{
                  background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
                  padding: 12, display: 'flex', alignItems: 'flex-start', gap: 12,
                  opacity: done ? .65 : 1,
                }}>
                  <div style={{
                    width: 34, height: 34, borderRadius: 10,
                    background: `${tipo.color}18`, color: tipo.color,
                    display: 'grid', placeItems: 'center', flex: '0 0 auto',
                  }}>
                    <Icon size={16} strokeWidth={2} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {a.nombre || '(sin nombre)'}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <span style={{ padding: '1px 7px', borderRadius: 100, background: `${tipo.color}18`, color: tipo.color, fontWeight: 700, fontSize: 10 }}>{tipo.label}</span>
                      {pf && <span>{pf.d} {MES_CORTO[pf.m - 1]}</span>}
                      {a.marca && <span>· {a.marca === 'balam_rush' ? 'Balam Rush' : 'Acteck'}</span>}
                      {done && <span style={{ color: theme.green || '#34C759', fontWeight: 700 }}>· ✓ listo</span>}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flex: '0 0 auto' }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>
                      {fmtMXN(Number(a.inversion) || 0)}
                    </div>
                    <div style={{ fontSize: 10, color: a.pago_id ? (theme.green || '#34C759') : theme.textMuted, fontWeight: 600 }}>
                      {a.pago_id ? 'pagada' : 'sin pago'}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <style>{`.mmk-hide::-webkit-scrollbar { display: none; }`}</style>
    </div>
  );
}

function KpiTile({ theme, label, value, delta, positive }) {
  const color = positive === true ? (theme.green || '#34C759') : positive === false ? (theme.pink || theme.red || '#FF3B30') : theme.textMuted;
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
      <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.06em', color: theme.textMuted, fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-.02em', marginTop: 2, color: theme.text, fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay }}>{value}</div>
      {delta && <div style={{ fontSize: 10.5, fontWeight: 600, marginTop: 1, color }}>{delta}</div>}
    </div>
  );
}

function SectionHead({ theme, title, sub }) {
  return (
    <div style={{ padding: '12px 18px 4px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-.01em', color: theme.text, fontFamily: TYPO.fontDisplay }}>{title}</div>
      {sub && <div style={{ fontSize: 11, color: theme.textMuted }}>{sub}</div>}
    </div>
  );
}
