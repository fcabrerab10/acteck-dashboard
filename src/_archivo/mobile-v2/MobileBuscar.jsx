// MobileBuscar — búsqueda mobile-native.
// Busca en SKU (roadmap_sku), propuestas recientes (localStorage),
// minutas, y clientes/pestañas para navegación rápida.

import React, { useEffect, useMemo, useState } from 'react';
import { Search, ShoppingCart, FileText, ClipboardList, ChevronRight, Users } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { CLIENTES } from './Sidebar';

const CLIENTE_DOT = { digitalife: '#5856D6', dicotech: '#FF9500', pcel: '#34C759' };

const loadPropuestas = () => {
  try { return JSON.parse(localStorage.getItem('propuestas_recientes_v1') || '[]'); }
  catch { return []; }
};

export default function MobileBuscar({ perfil, onNavegar }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [skus, setSkus] = useState([]);
  const [minutas, setMinutas] = useState([]);
  const [propuestas, setPropuestas] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPropuestas(loadPropuestas());
  }, []);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setSkus([]); setMinutas([]); return; }
    let alive = true;
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const [sk, mn] = await Promise.all([
          supabase.from('roadmap_sku').select('sku,descripcion,marca,familia').or(`sku.ilike.%${term}%,descripcion.ilike.%${term}%`).limit(15),
          supabase.from('minutas').select('id,titulo,fecha_reunion,cliente').or(`titulo.ilike.%${term}%,contenido.ilike.%${term}%`).order('fecha_reunion', { ascending: false }).limit(10),
        ]);
        if (!alive) return;
        setSkus(sk.data || []);
        setMinutas(mn.data || []);
      } finally {
        if (alive) setLoading(false);
      }
    }, 250);
    return () => { alive = false; clearTimeout(t); };
  }, [q]);

  const propuestasFilt = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return propuestas.filter(p =>
      (p.nombre || '').toLowerCase().includes(term)
      || (p.clienteLabel || '').toLowerCase().includes(term)
    ).slice(0, 8);
  }, [q, propuestas]);

  const clientesFilt = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return Object.entries(CLIENTES).filter(([id, c]) =>
      c.activo && (id.includes(term) || (c.label || '').toLowerCase().includes(term))
    );
  }, [q]);

  const hayResultados = skus.length + minutas.length + propuestasFilt.length + clientesFilt.length > 0;

  return (
    <div style={{ background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100vh' }}>
      {/* Título */}
      <div style={{ padding: '10px 18px 4px' }}>
        <h1 style={{ margin: 0, fontFamily: TYPO.fontDisplay, fontSize: 32, fontWeight: 700, letterSpacing: '-.03em', color: theme.text }}>Buscar</h1>
      </div>

      {/* Search input */}
      <div style={{ margin: '10px 18px 12px', padding: '10px 12px', background: theme.mode === 'dark' ? 'rgba(120,120,128,.24)' : 'rgba(120,120,128,.16)', borderRadius: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
        <Search size={16} strokeWidth={2} style={{ color: theme.textMuted, flex: '0 0 auto' }} />
        <input
          autoFocus
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="SKU, propuesta, minuta, cliente…"
          style={{
            flex: 1, background: 'transparent', border: 'none', outline: 'none',
            color: theme.text, fontFamily: TYPO.fontText, fontSize: 15,
          }}
        />
        {q && (
          <button onClick={() => setQ('')}
            style={{ background: 'transparent', border: 'none', color: theme.textMuted, cursor: 'pointer', fontSize: 15 }}
          >✕</button>
        )}
      </div>

      {q.trim().length < 2 ? (
        <div style={{ padding: '20px 18px', textAlign: 'center', color: theme.textMuted, fontSize: 13, lineHeight: 1.5 }}>
          Escribe al menos 2 letras.<br />Busca SKUs, propuestas, minutas o clientes.
        </div>
      ) : loading ? (
        <div style={{ padding: 30, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Buscando…</div>
      ) : !hayResultados ? (
        <div style={{ padding: 30, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Sin resultados para "{q}"</div>
      ) : (
        <>
          {clientesFilt.length > 0 && (
            <>
              <SectionHead theme={theme} title="Clientes" />
              <div style={{ padding: '0 18px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {clientesFilt.map(([id, c]) => (
                  <ResultRow key={id} theme={theme}
                    icon={<Users size={16} />} iconBg={CLIENTE_DOT[id] || theme.accent}
                    label={c.label} sub="Abrir vista de cliente"
                    onClick={() => onNavegar(id, 'home')}
                  />
                ))}
              </div>
            </>
          )}

          {skus.length > 0 && (
            <>
              <SectionHead theme={theme} title={`SKUs · ${skus.length}`} />
              <div style={{ padding: '0 18px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {skus.map((s) => (
                  <ResultRow key={s.sku} theme={theme}
                    icon={<ShoppingCart size={16} />} iconBg={theme.accent}
                    label={s.sku}
                    sub={s.descripcion || (s.marca + (s.familia ? ' · ' + s.familia : ''))}
                    mono
                  />
                ))}
              </div>
            </>
          )}

          {propuestasFilt.length > 0 && (
            <>
              <SectionHead theme={theme} title={`Propuestas · ${propuestasFilt.length}`} />
              <div style={{ padding: '0 18px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {propuestasFilt.map((p) => (
                  <ResultRow key={p.id} theme={theme}
                    icon={<FileText size={16} />} iconBg={theme.purple || '#AF52DE'}
                    label={p.nombre || `Propuesta ${p.clienteLabel || p.clienteKey}`}
                    sub={`${p.clienteLabel || p.clienteKey} · ${p.resumen?.skus || 0} SKUs`}
                    onClick={() => onNavegar(null, 'propuestas')}
                  />
                ))}
              </div>
            </>
          )}

          {minutas.length > 0 && (
            <>
              <SectionHead theme={theme} title={`Minutas · ${minutas.length}`} />
              <div style={{ padding: '0 18px 24px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {minutas.map((m) => (
                  <ResultRow key={m.id} theme={theme}
                    icon={<ClipboardList size={16} />} iconBg={theme.orange || '#FF9500'}
                    label={m.titulo || '(sin título)'}
                    sub={`${CLIENTES[m.cliente]?.label || m.cliente || '—'} · ${m.fecha_reunion || ''}`}
                    onClick={() => onNavegar(null, 'adminInterna')}
                  />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function SectionHead({ theme, title }) {
  return (
    <div style={{ padding: '12px 18px 4px' }}>
      <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '.08em', color: theme.textMuted, fontWeight: 700 }}>{title}</div>
    </div>
  );
}

function ResultRow({ theme, icon, iconBg, label, sub, mono, onClick }) {
  return (
    <button onClick={onClick}
      disabled={!onClick}
      style={{
        width: '100%', background: theme.surface, border: `1px solid ${theme.border}`,
        borderRadius: 12, padding: '10px 12px', cursor: onClick ? 'pointer' : 'default',
        display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left',
        fontFamily: TYPO.fontText, transition: 'transform 160ms cubic-bezier(.34,1.56,.64,1)',
      }}
      onPointerDown={(e) => { if (onClick) e.currentTarget.style.transform = 'scale(.98)'; }}
      onPointerUp={(e) => { e.currentTarget.style.transform = ''; }}
      onPointerLeave={(e) => { e.currentTarget.style.transform = ''; }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 9, background: `${iconBg}18`, color: iconBg,
        display: 'grid', placeItems: 'center', flex: '0 0 auto',
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13.5, fontWeight: 600, color: theme.text,
          fontFamily: mono ? '"SF Mono", ui-monospace, monospace' : TYPO.fontText,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>}
      </div>
      {onClick && <ChevronRight size={14} style={{ color: theme.textSubtle || theme.textMuted, flex: '0 0 auto' }} />}
    </button>
  );
}
