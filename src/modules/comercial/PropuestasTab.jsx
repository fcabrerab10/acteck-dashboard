// PropuestasTab.jsx — Armador de propuestas de venta por cliente.
// Flujo wizard: landing → cliente → contexto → catálogo → ajustes → revisar.

import React, { useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { formatMXN } from '../../lib/utils';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { ClipboardList, Search, ChevronRight, Download, X } from 'lucide-react';

// ═══ Constantes ═══
const CLIENTES = [
  { key: 'digitalife', label: 'Digitalife', iniciales: 'D' },
  { key: 'pcel',       label: 'PCEL',       iniciales: 'P' },
  { key: 'dicotech',   label: 'Dicotech',   iniciales: 'Di' },
];

const FAMILIA_DIGITALIFE_HOJA = {
  'Monitor':        'Monitores',
  'Sillas y Mesas': 'Sillas',
};
const familiaHoja = (familia) => FAMILIA_DIGITALIFE_HOJA[familia] || 'Todo lo demás';

const PASOS = ['Cliente', 'Contexto', 'Catálogo', 'Ajustes', 'Revisar'];

// Meses cerrados anteriores al actual (los últimos 3)
function mesesCerrados() {
  const hoy = new Date();
  const arr = [];
  for (let i = 1; i <= 3; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    arr.push({ anio: d.getFullYear(), mes: d.getMonth() + 1 });
  }
  return arr;
}
const MES_ACTUAL = { anio: new Date().getFullYear(), mes: new Date().getMonth() + 1 };
const MES_LABEL = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

// ═══ Paleta derivada del tema ═══
function paletteFromTheme(theme) {
  return {
    accent: theme.accent  || '#007AFF',
    green:  theme.green   || '#34C759',
    orange: theme.orange  || '#FF9500',
    red:    theme.red     || '#FF3B30',
    purple: theme.purple  || '#AF52DE',
    teal:   theme.teal    || '#5AC8FA',
  };
}
function clienteColor(theme, key) {
  const P = paletteFromTheme(theme);
  const map = { digitalife: P.accent, pcel: P.red, dicotech: P.purple };
  return map[key] || P.accent;
}

// ═══ Componente principal ═══
export default function PropuestasTab() {
  const { theme } = useTheme();
  const isDark = theme.mode === 'dark';

  // Estados del wizard
  const [paso, setPaso] = useState(0); // 0 = landing, 1..5 = pasos
  const [clienteKey, setClienteKey] = useState(null);
  const [propuesta, setPropuesta] = useState({}); // { sku: { piezas, precio, listaSel } }

  // Data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [skus, setSkus] = useState([]);
  const [contexto, setContexto] = useState(null);

  // Fetch al pasar de paso 1 → 2
  useEffect(() => {
    if (paso < 2 || !clienteKey) return;
    if (skus.length > 0) return;
    fetchAll(clienteKey).then(({ skus: rows, contexto: ctx }) => {
      setSkus(rows);
      setContexto(ctx);
      setLoading(false);
    }).catch((e) => {
      console.warn('[Propuestas]', e);
      setError(e.message || 'Error al cargar');
      setLoading(false);
    });
    setLoading(true);
  }, [paso, clienteKey, skus.length]);

  const reiniciar = () => {
    setPaso(0);
    setClienteKey(null);
    setPropuesta({});
    setSkus([]);
    setContexto(null);
    setError(null);
  };

  const iniciar = (cli) => {
    setPropuesta({});
    setSkus([]);
    setContexto(null);
    setError(null);
    setClienteKey(cli);
    setPaso(2);
  };

  const cliente = CLIENTES.find((c) => c.key === clienteKey);

  // ═══ Landing ═══
  if (paso === 0) {
    return <Landing theme={theme} onIniciar={() => setPaso(1)} />;
  }

  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }} className="space-y-3">
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, padding: '0 4px', marginBottom: 4, flexWrap: 'wrap' }}>
        <div>
          <button onClick={reiniciar}
            style={{ background: 'transparent', border: 0, padding: 0, fontSize: 11, color: theme.textMuted, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}
            onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
            onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}>
            ← Propuestas
          </button>
          <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
            Nueva propuesta.
          </h2>
          {cliente && (
            <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText, fontVariantNumeric: 'tabular-nums' }}>
              Para <strong style={{ color: theme.text, fontWeight: 500 }}>{cliente.label}</strong> · {MES_LABEL[MES_ACTUAL.mes - 1]} {MES_ACTUAL.anio}
            </p>
          )}
        </div>
      </div>

      {/* Stepper */}
      <Stepper theme={theme} paso={paso} isDark={isDark} />

      {/* Contexto card (visible desde paso 2) */}
      {paso >= 2 && contexto && (
        <ContextoCard theme={theme} cliente={cliente} contexto={contexto} isDark={isDark} />
      )}

      {loading && (
        <div style={{ padding: 40, textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
          Cargando data de {cliente?.label}…
        </div>
      )}
      {error && (
        <div style={{ padding: 14, background: `${paletteFromTheme(theme).red}14`, border: `1px solid ${paletteFromTheme(theme).red}40`, borderRadius: 12, color: paletteFromTheme(theme).red, fontSize: 12 }}>
          {error}
        </div>
      )}

      {/* Contenido por paso */}
      {!loading && !error && paso === 1 && (
        <Paso1Cliente theme={theme} onElegir={iniciar} isDark={isDark} />
      )}
      {!loading && !error && paso === 2 && contexto && (
        <Paso2Contexto theme={theme} contexto={contexto} onSiguiente={() => setPaso(3)} onPrev={() => setPaso(1)} />
      )}
      {!loading && !error && paso === 3 && (
        <Paso3Catalogo theme={theme} skus={skus} propuesta={propuesta} setPropuesta={setPropuesta}
          onSiguiente={() => setPaso(4)} onPrev={() => setPaso(2)} isDark={isDark} />
      )}
      {!loading && !error && paso === 4 && (
        <Paso4Ajustes theme={theme} skus={skus} propuesta={propuesta} setPropuesta={setPropuesta}
          cliente={cliente} onSiguiente={() => setPaso(5)} onPrev={() => setPaso(3)} isDark={isDark} />
      )}
      {!loading && !error && paso === 5 && (
        <Paso5Revisar theme={theme} skus={skus} propuesta={propuesta} cliente={cliente}
          onPrev={() => setPaso(4)} isDark={isDark} />
      )}
    </div>
  );
}

// ═══ Landing ═══
function Landing({ theme, onIniciar }) {
  const P = paletteFromTheme(theme);
  const isDark = theme.mode === 'dark';
  return (
    <div style={{ padding: '10px 6px', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, minHeight: '100%' }}>
      <div style={{ padding: '0 4px', marginBottom: 20 }}>
        <p style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.12em', color: theme.textMuted, marginBottom: 4, fontFamily: TYPO.fontText, fontWeight: 500 }}>
          Dirección Comercial · Armador
        </p>
        <h2 style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', fontFamily: TYPO.fontDisplay, color: theme.text, margin: 0, lineHeight: 1.1 }}>
          Propuestas.
        </h2>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, fontFamily: TYPO.fontText }}>
          Arma propuestas de venta por cliente con inventario, precios y sell-out en un solo flujo.
        </p>
      </div>

      <div style={{
        background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 20,
        padding: '48px 32px', textAlign: 'center', maxWidth: 640, margin: '32px auto',
        fontFamily: TYPO.fontText,
      }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, background: `${P.accent}18`, color: P.accent,
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
        }}>
          <ClipboardList style={{ width: 26, height: 26 }} strokeWidth={1.5} />
        </div>
        <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
          Iniciar una propuesta nueva
        </h3>
        <p style={{ fontSize: 13, color: theme.textMuted, marginTop: 8, marginBottom: 28, maxWidth: 420, marginLeft: 'auto', marginRight: 'auto', lineHeight: 1.5 }}>
          Elige el cliente, revisa su contexto de venta y arma la propuesta paso a paso.
        </p>
        <button onClick={onIniciar}
          style={{
            padding: '11px 24px', background: P.accent, color: '#FFFFFF',
            border: 0, borderRadius: 999, fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            cursor: 'pointer', letterSpacing: '-0.01em',
            transition: 'transform 120ms',
          }}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
          Nueva propuesta
        </button>
      </div>
    </div>
  );
}

// ═══ Stepper — pills iOS ═══
function Stepper({ theme, paso, isDark }) {
  const P = paletteFromTheme(theme);
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14,
      padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 4,
      overflowX: 'auto', fontFamily: TYPO.fontText,
    }}>
      {PASOS.map((label, i) => {
        const n = i + 1;
        const state = paso > n ? 'done' : paso === n ? 'active' : 'pending';
        const dotBg = state === 'done' ? P.green : state === 'active' ? P.accent : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)');
        const dotFg = state === 'pending' ? theme.textMuted : '#FFFFFF';
        const lblColor = state === 'done' ? P.green : state === 'active' ? theme.text : theme.textMuted;
        return (
          <React.Fragment key={label}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <span style={{
                width: 22, height: 22, borderRadius: 999, background: dotBg, color: dotFg,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '-0.01em',
              }}>{state === 'done' ? '✓' : n}</span>
              <span style={{
                fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: state === 'active' ? 600 : 500,
                letterSpacing: '-0.01em', color: lblColor,
              }}>{label}</span>
            </div>
            {i < PASOS.length - 1 && (
              <div style={{ flex: 1, minWidth: 20, height: 1, background: paso > n ? P.green : theme.border }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ═══ Card contexto cliente (persiste en pasos 2-5) ═══
function ContextoCard({ theme, cliente, contexto, isDark }) {
  const P = paletteFromTheme(theme);
  const col = clienteColor(theme, cliente.key);
  const cuotaPct = contexto.cuota > 0 ? (contexto.facturado / contexto.cuota * 100) : 0;
  const toneGap = cuotaPct >= 100 ? P.green : cuotaPct >= 70 ? P.orange : P.red;

  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderLeft: `4px solid ${col}`,
      borderRadius: 14, padding: '12px 14px', fontFamily: TYPO.fontText,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 10, background: col, color: '#FFFFFF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, letterSpacing: '-0.02em',
          }}>{cliente.iniciales}</div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{cliente.label}</div>
            <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1 }}>{MES_LABEL[MES_ACTUAL.mes - 1]} {MES_ACTUAL.anio}</div>
          </div>
        </div>
        <span style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 500 }}>
          Contexto de venta del mes
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
        <KpiMini theme={theme} label="Cuota" value={formatMXN(contexto.cuota)} />
        <KpiMini theme={theme} label="Facturado" value={formatMXN(contexto.facturado)} sub={`${cuotaPct.toFixed(0)}% cuota`} />
        <KpiMini theme={theme} label="Gap" value={formatMXN(Math.max(0, contexto.cuota - contexto.facturado))} color={toneGap} />
        <KpiMini theme={theme} label="Días restantes" value={String(contexto.diasRestantes)} sub="para cerrar mes" />
        <KpiMini theme={theme} label="SKUs disponibles" value={contexto.skusConInv?.toLocaleString('es-MX') || '—'} sub="con inv Acteck" />
      </div>
      {contexto.topVendidos && contexto.topVendidos.length > 0 && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px dashed ${theme.border}`, fontSize: 11, color: theme.textMuted }}>
          <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600, marginRight: 10 }}>
            Top 5 vendidos 90d:
          </span>
          {contexto.topVendidos.slice(0, 5).map((s, i) => (
            <span key={s.sku}>
              {i > 0 && <span style={{ color: theme.textSubtle || theme.textMuted, margin: '0 6px' }}>·</span>}
              <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontWeight: 500, color: theme.text }}>{s.sku}</span>
              <span style={{ color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}> ({s.piezas}pz)</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function KpiMini({ theme, label, value, sub, color }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>{label}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: color || theme.text, fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{sub}</div>}
    </div>
  );
}

// ═══ Paso 1: Elegir cliente ═══
function Paso1Cliente({ theme, onElegir, isDark }) {
  return (
    <div style={{
      background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16,
      padding: '32px 24px', textAlign: 'center', fontFamily: TYPO.fontText,
    }}>
      <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
        ¿Para qué cliente?
      </h3>
      <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 6, marginBottom: 24 }}>
        Selecciona el cliente para el que armarás la propuesta.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, maxWidth: 720, margin: '0 auto' }}>
        {CLIENTES.map((c) => {
          const col = clienteColor(theme, c.key);
          return (
            <button key={c.key} onClick={() => onElegir(c.key)}
              style={{
                padding: 20, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 14,
                textAlign: 'left', cursor: 'pointer', fontFamily: 'inherit',
                transition: 'transform 120ms, border-color 120ms, background 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.borderColor = col;
                e.currentTarget.style.background = `${col}0A`;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.borderColor = theme.border;
                e.currentTarget.style.background = theme.bg;
              }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: col, color: '#FFFFFF',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 15, letterSpacing: '-0.02em',
                marginBottom: 12,
              }}>{c.iniciales}</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, letterSpacing: '-0.02em' }}>{c.label}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                Iniciar propuesta <ChevronRight style={{ width: 12, height: 12 }} strokeWidth={2} />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══ Paso 2: Confirmar contexto ═══
function Paso2Contexto({ theme, contexto, onSiguiente, onPrev }) {
  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '18px 20px', fontFamily: TYPO.fontText }}>
      <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
        Contexto del cliente
      </h3>
      <p style={{ fontSize: 12, color: theme.textMuted, marginTop: 6, marginBottom: 14, lineHeight: 1.5 }}>
        Revisa la información de venta antes de elegir SKUs. La card de arriba muestra cuota, facturado, gap y los
        productos con más movimiento en los últimos 90 días.
      </p>
      <div style={{
        background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12,
        padding: '12px 14px', fontSize: 11, color: theme.textMuted, display: 'grid', gap: 5,
      }}>
        <div><strong style={{ color: theme.text, fontWeight: 500 }}>Cuota del mes:</strong> lo que te propusiste facturar en {MES_LABEL[MES_ACTUAL.mes - 1]}.</div>
        <div><strong style={{ color: theme.text, fontWeight: 500 }}>Facturado:</strong> lo que llevas facturado hasta hoy.</div>
        <div><strong style={{ color: theme.text, fontWeight: 500 }}>Gap:</strong> lo que falta para cerrar la cuota.</div>
        <div><strong style={{ color: theme.text, fontWeight: 500 }}>Top vendidos 90d:</strong> productos con más venta en los últimos 3 meses cerrados.</div>
      </div>
      <NavBotones theme={theme} onPrev={onPrev} onSiguiente={onSiguiente} labelNext="Ver catálogo" />
    </div>
  );
}

// ═══ Paso 3: Elegir SKUs ═══
function Paso3Catalogo({ theme, skus, propuesta, setPropuesta, onSiguiente, onPrev, isDark }) {
  const P = paletteFromTheme(theme);
  const [busqueda, setBusqueda] = useState('');
  const [filtroFamilia, setFiltroFamilia] = useState('todas');
  const [soloConInv, setSoloConInv] = useState(false);
  // { col: 'invCliente' | 'invActeck' | 'promSellout' | null, dir: 'asc' | 'desc' }
  // Default: sell-out 90d descendente (los más movidos primero)
  const [orden, setOrden] = useState({ col: 'sellout90', dir: 'desc' });

  const familias = useMemo(() => {
    const s = new Set();
    for (const r of skus) if (r.familia) s.add(r.familia);
    return ['todas', ...Array.from(s).sort()];
  }, [skus]);

  const filtrados = useMemo(() => {
    const q = busqueda.trim().toUpperCase();
    const arr = skus.filter((r) => {
      if (filtroFamilia !== 'todas' && r.familia !== filtroFamilia) return false;
      if (soloConInv && (r.invActeck || 0) <= 0) return false;
      if (q && !(String(r.sku).toUpperCase().includes(q) || String(r.descripcion).toUpperCase().includes(q))) return false;
      return true;
    });
    if (orden.col) {
      const mult = orden.dir === 'asc' ? 1 : -1;
      arr.sort((a, b) => ((Number(a[orden.col]) || 0) - (Number(b[orden.col]) || 0)) * mult);
    }
    return arr;
  }, [skus, busqueda, filtroFamilia, soloConInv, orden]);

  // Ciclo asc → desc → sin orden (vuelve al default sellout90 desc)
  const toggleOrden = (col) => {
    setOrden((prev) => {
      if (prev.col !== col) return { col, dir: 'desc' };
      if (prev.dir === 'desc') return { col, dir: 'asc' };
      return { col: 'sellout90', dir: 'desc' };
    });
  };

  const toggleSku = (sku) => {
    setPropuesta((prev) => {
      const next = { ...prev };
      if (sku in next) { delete next[sku]; return next; }
      const meta = skus.find((r) => r.sku === sku);
      const precioDefault = meta ? Object.values(meta.precios)[0] || 0 : 0;
      const listaDefault = meta ? Object.keys(meta.precios)[0] || '' : '';
      next[sku] = {
        piezas: Math.max(1, meta?.promSellout || 1),
        precio: precioDefault,
        listaSel: listaDefault,
      };
      return next;
    });
  };

  const seleccionados = Object.keys(propuesta).length;

  const thStyle = { position: 'sticky', top: 0, background: theme.surface, zIndex: 1, textAlign: 'right', padding: '8px 6px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  const thLeft = { ...thStyle, textAlign: 'left' };
  const tdStyle = { padding: '5px 6px', borderTop: `1px solid ${theme.border}`, fontSize: 11, whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '12px 14px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
          Elige los productos
        </h3>
        <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{seleccionados}</strong> seleccionado{seleccionados !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 999, height: 32, flex: 1, minWidth: 240, maxWidth: 320 }}>
          <Search style={{ width: 12, height: 12, color: theme.textMuted }} strokeWidth={2} />
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar SKU o descripción…"
            style={{ border: 0, outline: 0, background: 'transparent', fontFamily: 'inherit', fontSize: 12, color: theme.text, flex: 1 }} />
        </div>
        <select value={filtroFamilia} onChange={(e) => setFiltroFamilia(e.target.value)}
          style={{ height: 32, padding: '0 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 12, color: theme.text, fontFamily: 'inherit', cursor: 'pointer' }}>
          {familias.map((f) => <option key={f} value={f}>{f === 'todas' ? 'Todas las familias' : f}</option>)}
        </select>
        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, height: 32, padding: '0 14px',
          background: soloConInv ? `${P.accent}18` : theme.surface, border: `1px solid ${soloConInv ? P.accent : theme.border}`,
          borderRadius: 999, fontSize: 12, color: soloConInv ? P.accent : theme.text, cursor: 'pointer', fontWeight: soloConInv ? 600 : 500,
        }}>
          <input type="checkbox" checked={soloConInv} onChange={(e) => setSoloConInv(e.target.checked)} style={{ margin: 0 }} />
          Solo con inventario
        </label>
        <span style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginLeft: 'auto' }}>
          {filtrados.length.toLocaleString('es-MX')} SKUs
        </span>
      </div>

      {/* Tabla */}
      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{ maxHeight: 'calc(100vh - 480px)', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
            <thead>
              <tr>
                <th style={{ ...thLeft, width: 110 }}>SKU</th>
                <th style={thLeft}>Descripción</th>
                <th style={{ ...thLeft, width: 120 }}>Familia</th>
                <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="invCliente" width={64}>Inv cli</SortableTh>
                <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="invActeck" width={64}>Inv Ack</SortableTh>
                <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="sellout90" width={72}>SO 90d</SortableTh>
                <SortableTh theme={theme} P={P} orden={orden} onToggle={toggleOrden} col="promSellout" width={72}>Prom 90d</SortableTh>
                <th style={{ ...thStyle, width: 84 }}>Precio ref.</th>
                <th style={{ ...thStyle, width: 42, textAlign: 'center' }}></th>
              </tr>
            </thead>
            <tbody>
              {filtrados.map((r) => {
                const sel = r.sku in propuesta;
                const precioRef = Object.values(r.precios)[0];
                const fmtNum = (v) => v != null && v !== 0 ? Number(v).toLocaleString('es-MX') : null;
                const invCli = fmtNum(r.invCliente);
                const invAck = fmtNum(r.invActeck);
                const so90 = fmtNum(r.sellout90);
                const prom = fmtNum(r.promSellout);
                return (
                  <tr key={r.sku}
                    onClick={() => toggleSku(r.sku)}
                    style={{
                      cursor: 'pointer',
                      background: sel ? `${P.accent}${isDark ? '1F' : '0D'}` : 'transparent',
                      height: 32,
                      transition: 'background 100ms',
                    }}
                    onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)'; }}
                    onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = 'transparent'; }}>
                    <td style={{ ...tdStyle, textAlign: 'left', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: theme.text, paddingLeft: 12 }}>{r.sku}</td>
                    <td style={{ ...tdStyle, textAlign: 'left', fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 500, color: theme.text, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }} title={r.descripcion}>{r.descripcion || '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'left', color: theme.textMuted, fontSize: 10.5 }}>{r.familia || '—'}</td>
                    <td style={tdStyle}>{invCli || <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                    <td style={tdStyle}>{invAck || <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                    <td style={{ ...tdStyle, fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text }}>{so90 || <span style={{ color: theme.textSubtle || theme.textMuted, fontWeight: 400 }}>—</span>}</td>
                    <td style={{ ...tdStyle, color: theme.textMuted }}>{prom || <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                    <td style={{ ...tdStyle, color: theme.textMuted }}>{precioRef != null ? formatMXN(precioRef) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>}</td>
                    <td style={{ ...tdStyle, textAlign: 'center', paddingRight: 12 }}>
                      <span aria-hidden style={{
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        width: 20, height: 20, borderRadius: 999,
                        background: sel ? P.accent : 'transparent',
                        border: sel ? `1px solid ${P.accent}` : `1.5px solid ${isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.20)'}`,
                        color: '#FFFFFF', fontSize: 11, lineHeight: 1, fontWeight: 700,
                        transition: 'background 120ms, border-color 120ms',
                      }}>{sel ? '✓' : ''}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <NavBotones theme={theme} onPrev={onPrev} onSiguiente={onSiguiente}
        disabledSiguiente={seleccionados === 0}
        labelNext={`Ajustar precios (${seleccionados})`} />
    </div>
  );
}

// ═══ Header ordenable (asc / desc / clear) ═══
function SortableTh({ theme, P, orden, onToggle, col, width, children }) {
  const active = orden.col === col;
  const dir = active ? orden.dir : null;
  const color = active ? P.accent : theme.textMuted;
  const arrow = dir === 'asc' ? '▲' : dir === 'desc' ? '▼' : '↕';
  return (
    <th
      onClick={() => onToggle(col)}
      style={{
        position: 'sticky', top: 0, background: theme.surface, zIndex: 1,
        textAlign: 'right', padding: '8px 6px',
        fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase',
        letterSpacing: '0.06em', color,
        borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap',
        width, cursor: 'pointer', userSelect: 'none',
      }}
      onMouseEnter={(e) => { if (!active) e.currentTarget.style.color = theme.text; }}
      onMouseLeave={(e) => { if (!active) e.currentTarget.style.color = theme.textMuted; }}
      title={active
        ? (dir === 'desc' ? 'Ordenado de mayor a menor · click para invertir' : 'Ordenado de menor a mayor · click para quitar')
        : 'Ordenar por esta columna'}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {children}
        <span style={{ fontSize: 8, opacity: active ? 1 : 0.4, fontWeight: 700 }}>{arrow}</span>
      </span>
    </th>
  );
}

// ═══ Paso 4: Ajustar piezas y precio ═══
function Paso4Ajustes({ theme, skus, propuesta, setPropuesta, cliente, onSiguiente, onPrev, isDark }) {
  const P = paletteFromTheme(theme);
  const propuestaLista = useMemo(() => Object.entries(propuesta)
    .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
    .filter((r) => r.sku), [propuesta, skus]);
  const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);

  const editPropuesta = (sku, patch) => setPropuesta((prev) => ({ ...prev, [sku]: { ...(prev[sku] || {}), ...patch } }));
  const removePropuesta = (sku) => setPropuesta((prev) => { const n = { ...prev }; delete n[sku]; return n; });

  const thStyle = { textAlign: 'right', padding: '8px 10px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  const thLeft = { ...thStyle, textAlign: 'left' };

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '12px 14px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
          Ajusta piezas y precio
        </h3>
        <div style={{ fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
          {propuestaLista.length} SKU · {piezas.toLocaleString('es-MX')} pz · <strong style={{ color: theme.text, fontFamily: TYPO.fontDisplay, fontWeight: 600 }}>{formatMXN(total)}</strong>
        </div>
      </div>

      <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead>
            <tr>
              <th style={{ ...thLeft, width: 110 }}>SKU</th>
              <th style={thLeft}>Descripción</th>
              <th style={{ ...thStyle, width: 60 }}>Inv cli</th>
              <th style={{ ...thStyle, width: 60 }}>Inv Ack</th>
              <th style={{ ...thStyle, width: 66 }}>SO 90d</th>
              <th style={{ ...thStyle, width: 90 }}>Piezas</th>
              <th style={{ ...thLeft, width: 240 }}>Precio</th>
              <th style={{ ...thStyle, width: 110 }}>Total</th>
              <th style={{ ...thStyle, width: 32 }}></th>
            </tr>
          </thead>
          <tbody>
            {propuestaLista.map((r) => (
              <AjusteRow key={r.sku} theme={theme} P={P} r={r}
                onEdit={(patch) => editPropuesta(r.sku, patch)}
                onRemove={() => removePropuesta(r.sku)} />
            ))}
            <tr style={{ background: isDark ? '#0F0F0F' : '#1D1D1F', color: '#FFFFFF' }}>
              <td colSpan={5} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, letterSpacing: '-0.01em' }}>Total propuesta</td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{piezas.toLocaleString('es-MX')}</td>
              <td></td>
              <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{formatMXN(total)}</td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <NavBotones theme={theme} onPrev={onPrev} onSiguiente={onSiguiente}
        disabledSiguiente={propuestaLista.length === 0} labelNext="Revisar propuesta" />
    </div>
  );
}

function AjusteRow({ theme, P, r, onEdit, onRemove }) {
  const listas = Object.entries(r.precios);
  const [modo, setModo] = useState(r.listaSel === 'personalizado' || !r.listaSel ? 'personalizado' : r.listaSel);
  const subtotal = (Number(r.piezas) || 0) * (Number(r.precio) || 0);

  const setLista = (l) => {
    setModo(l);
    if (l === 'personalizado') { onEdit({ listaSel: 'personalizado' }); return; }
    const precio = r.precios[l];
    if (precio != null) onEdit({ listaSel: l, precio });
    else onEdit({ listaSel: l });
  };

  const inputStyle = {
    width: '100%', padding: '5px 8px', textAlign: 'right', fontSize: 11, fontFamily: 'inherit',
    background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text,
    outline: 'none', fontVariantNumeric: 'tabular-nums',
  };
  const selectStyle = {
    flex: 1, minWidth: 0, padding: '5px 8px', fontSize: 10, fontFamily: 'inherit',
    background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 8, color: theme.text,
    outline: 'none', cursor: 'pointer',
  };

  return (
    <tr style={{ borderTop: `1px solid ${theme.border}` }}>
      <td style={{ padding: '6px 10px', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, fontWeight: 600, color: theme.text }}>{r.sku}</td>
      <td style={{ padding: '6px 10px', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
      <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.textMuted, fontSize: 11 }}>{(r.invCliente || 0).toLocaleString('es-MX')}</td>
      <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.textMuted, fontSize: 11 }}>{(r.invActeck || 0).toLocaleString('es-MX')}</td>
      <td style={{ padding: '6px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12 }}>{(r.sellout90 || 0).toLocaleString('es-MX')}</td>
      <td style={{ padding: '6px 10px' }}>
        <input type="number" min="0" value={r.piezas ?? ''}
          onChange={(e) => onEdit({ piezas: e.target.value === '' ? '' : Math.max(0, parseInt(e.target.value) || 0) })}
          style={inputStyle} />
      </td>
      <td style={{ padding: '6px 10px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={modo} onChange={(e) => setLista(e.target.value)} style={selectStyle}>
            {listas.map(([l, p]) => (
              <option key={l} value={l}>{l} · ${Math.round(p).toLocaleString('es-MX')}</option>
            ))}
            <option value="personalizado">Personalizado…</option>
          </select>
          {modo === 'personalizado' && (
            <input type="number" min="0" step="0.01" value={r.precio ?? ''}
              onChange={(e) => onEdit({ precio: e.target.value === '' ? '' : parseFloat(e.target.value) || 0 })}
              placeholder="$" style={{ ...inputStyle, width: 80 }} />
          )}
        </div>
      </td>
      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{formatMXN(subtotal)}</td>
      <td style={{ padding: '6px 10px', textAlign: 'center' }}>
        <button onClick={onRemove}
          style={{ background: 'transparent', border: 0, padding: 4, color: theme.textMuted, cursor: 'pointer', borderRadius: 6, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = P.red; e.currentTarget.style.background = `${P.red}14`; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = theme.textMuted; e.currentTarget.style.background = 'transparent'; }}
          title="Quitar SKU">
          <X style={{ width: 12, height: 12 }} strokeWidth={2} />
        </button>
      </td>
    </tr>
  );
}

// ═══ Paso 5: Revisar + Exportar ═══
function Paso5Revisar({ theme, skus, propuesta, cliente, onPrev, isDark }) {
  const P = paletteFromTheme(theme);
  const propuestaLista = useMemo(() => Object.entries(propuesta)
    .map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val }))
    .filter((r) => r.sku), [propuesta, skus]);
  const total = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
  const piezas = propuestaLista.reduce((s, r) => s + (Number(r.piezas) || 0), 0);

  const grupos = useMemo(() => {
    if (cliente.key !== 'digitalife') return { 'Propuesta': propuestaLista };
    const g = { 'Monitores': [], 'Sillas': [], 'Todo lo demás': [] };
    for (const r of propuestaLista) g[familiaHoja(r.familia)].push(r);
    return g;
  }, [propuestaLista, cliente]);

  const exportar = () => alert('Export Excel — próximo push. Ya podemos verificar el flujo.');

  const thStyle = { textAlign: 'right', padding: '8px 10px', fontFamily: TYPO.fontText, fontWeight: 600, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#FFFFFF', whiteSpace: 'nowrap' };
  const thLeft = { ...thStyle, textAlign: 'left' };
  const heroBg = isDark ? '#0F0F0F' : '#1D1D1F';

  return (
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: '12px 14px', fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12, flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, margin: 0 }}>
          Revisar propuesta
        </h3>
        <button onClick={exportar}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px',
            background: P.accent, color: '#FFFFFF', border: 0, borderRadius: 999,
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', letterSpacing: '-0.01em',
          }}>
          <Download style={{ width: 12, height: 12 }} strokeWidth={2} />
          Exportar Excel
        </button>
      </div>

      {/* Resumen KPIs */}
      <div style={{
        background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 12,
        padding: '14px 16px', marginBottom: 14, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20,
      }}>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>SKUs</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{propuestaLista.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Piezas</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{piezas.toLocaleString('es-MX')}</div>
        </div>
        <div>
          <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, fontWeight: 600 }}>Total propuesta</div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums', marginTop: 4 }}>{formatMXN(total)}</div>
        </div>
      </div>

      {Object.entries(grupos).map(([nombreGrupo, filas]) => {
        if (filas.length === 0) return null;
        const totalGrupo = filas.reduce((s, r) => s + (Number(r.piezas) || 0) * (Number(r.precio) || 0), 0);
        const piezasGrupo = filas.reduce((s, r) => s + (Number(r.piezas) || 0), 0);
        return (
          <div key={nombreGrupo} style={{ marginBottom: 14 }}>
            {cliente.key === 'digitalife' && (
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginBottom: 6, padding: '0 4px' }}>
                {nombreGrupo}
                <span style={{ color: theme.textMuted, fontWeight: 400, marginLeft: 6, fontVariantNumeric: 'tabular-nums' }}>
                  · {filas.length} SKU · {piezasGrupo}pz · {formatMXN(totalGrupo)}
                </span>
              </div>
            )}
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
                <thead>
                  <tr style={{ background: heroBg }}>
                    <th style={{ ...thLeft, width: 110 }}>SKU</th>
                    <th style={thLeft}>Descripción</th>
                    <th style={{ ...thStyle, width: 66 }}>Inv cli</th>
                    <th style={{ ...thStyle, width: 66 }}>Inv Ack</th>
                    <th style={{ ...thStyle, width: 72 }}>SO 90d</th>
                    <th style={{ ...thStyle, width: 72 }}>Prom 90d</th>
                    <th style={{ ...thStyle, width: 70 }}>Piezas</th>
                    <th style={{ ...thStyle, width: 90 }}>Precio</th>
                    <th style={{ ...thStyle, width: 110 }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {filas.map((r) => (
                    <tr key={r.sku} style={{ borderTop: `1px solid ${theme.border}`, height: 30 }}>
                      <td style={{ padding: '5px 10px', fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10, fontWeight: 600, color: theme.text }}>{r.sku}</td>
                      <td style={{ padding: '5px 10px', fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 500, color: theme.text, maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={r.descripcion}>{r.descripcion}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.textMuted, fontSize: 11 }}>{(r.invCliente || 0).toLocaleString('es-MX')}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.textMuted, fontSize: 11 }}>{(r.invActeck || 0).toLocaleString('es-MX')}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontSize: 12 }}>{(r.sellout90 || 0).toLocaleString('es-MX')}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: theme.textMuted, fontSize: 11 }}>{(r.promSellout || 0).toLocaleString('es-MX')}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{r.piezas}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', color: theme.text, fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>{formatMXN(r.precio)}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums', fontSize: 12, letterSpacing: '-0.01em' }}>{formatMXN((r.piezas || 0) * (r.precio || 0))}</td>
                    </tr>
                  ))}
                  <tr style={{ background: theme.bg, borderTop: `2px solid ${theme.borderStrong || theme.border}` }}>
                    <td colSpan={6} style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.textMuted, letterSpacing: '-0.01em' }}>
                      Total {cliente.key === 'digitalife' ? nombreGrupo.toLowerCase() : 'propuesta'}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{piezasGrupo}</td>
                    <td></td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 13, color: theme.text, fontVariantNumeric: 'tabular-nums', letterSpacing: '-0.01em' }}>{formatMXN(totalGrupo)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      <NavBotones theme={theme} onPrev={onPrev} hideNext />
    </div>
  );
}

// ═══ Navegación paso ═══
function NavBotones({ theme, onPrev, onSiguiente, labelNext = 'Siguiente', disabledSiguiente = false, hideNext = false }) {
  const P = paletteFromTheme(theme);
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      marginTop: 20, paddingTop: 14, borderTop: `1px solid ${theme.border}`,
    }}>
      <button onClick={onPrev}
        style={{
          background: 'transparent', border: 0, padding: '8px 4px', color: theme.textMuted,
          fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
        }}
        onMouseEnter={(e) => e.currentTarget.style.color = theme.text}
        onMouseLeave={(e) => e.currentTarget.style.color = theme.textMuted}>
        ← Atrás
      </button>
      {!hideNext && (
        <button onClick={onSiguiente} disabled={disabledSiguiente}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '9px 18px', borderRadius: 999, border: 0,
            background: disabledSiguiente ? (theme.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)') : P.accent,
            color: disabledSiguiente ? theme.textMuted : '#FFFFFF',
            fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            cursor: disabledSiguiente ? 'not-allowed' : 'pointer',
            letterSpacing: '-0.01em',
            transition: 'transform 120ms',
          }}
          onMouseEnter={(e) => { if (!disabledSiguiente) e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'none'}>
          {labelNext} <ChevronRight style={{ width: 12, height: 12 }} strokeWidth={2} />
        </button>
      )}
    </div>
  );
}

// ═══ Fetch principal ═══
async function fetchAll(clienteKey) {
  const mm = mesesCerrados();
  const anioMin = Math.min(...mm.map((m) => m.anio));
  const anioMax = Math.max(...mm.map((m) => m.anio));

  const [roadmapRes, invAckRes, invCliRes, preciosRes, sellout90, selloutMes, cuotaRes] = await Promise.all([
    supabase.from('roadmap_sku').select('sku,marca,familia,categoria,descripcion,rdmp'),
    supabase.from('inventario_acteck').select('articulo,disponible'),
    supabase.from('inventario_cliente').select('sku,stock,titulo,anio,semana').eq('cliente', clienteKey),
    supabase.from('precios_sku')
      .select('sku,lista,precio,anio,mes')
      .gte('anio', anioMax - 1)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false }),
    fetchSellout(clienteKey, mm, anioMin, anioMax),
    fetchSelloutMesActual(clienteKey),
    supabase.from('cuotas_mensuales')
      .select('cuota_min,cuota_meta')
      .eq('cliente', clienteKey)
      .eq('anio', MES_ACTUAL.anio).eq('mes', MES_ACTUAL.mes),
  ]);

  const invAck = new Map();
  for (const r of invAckRes.data || []) {
    invAck.set(r.articulo, (invAck.get(r.articulo) || 0) + (Number(r.disponible) || 0));
  }
  // Redondeo a entero: ERP tiene decimales de piezas heredados de conversiones
  // (piezas por caja), pero para presentar mostramos siempre número cerrado.
  for (const [k, v] of invAck.entries()) invAck.set(k, Math.round(v));
  const invCli = new Map();
  const invCliTitulos = new Map();
  for (const r of invCliRes.data || []) {
    const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
    const prev = invCli.get(r.sku);
    if (!prev || prev.key < key) {
      invCli.set(r.sku, { key, stock: Number(r.stock) || 0 });
      if (r.titulo) invCliTitulos.set(r.sku, r.titulo);
    }
  }
  const preciosPorSku = new Map();
  for (const r of preciosRes.data || []) {
    if (!preciosPorSku.has(r.sku)) preciosPorSku.set(r.sku, {});
    const lst = preciosPorSku.get(r.sku);
    if (!(r.lista in lst)) lst[r.lista] = Number(r.precio) || 0;
  }
  const sellout = new Map();
  for (const r of sellout90) sellout.set(r.sku, (sellout.get(r.sku) || 0) + (Number(r.cantidad) || 0));

  const rows = (roadmapRes.data || []).map((r) => ({
    sku: r.sku,
    marca: r.marca || '',
    familia: r.familia || '',
    categoria: r.categoria || '',
    descripcion: r.descripcion || invCliTitulos.get(r.sku) || '',
    rdmp: r.rdmp || '',
    invActeck: invAck.get(r.sku) || 0,
    invCliente: invCli.get(r.sku)?.stock || 0,
    sellout90: sellout.get(r.sku) || 0,
    promSellout: Math.round((sellout.get(r.sku) || 0) / 3),
    precios: preciosPorSku.get(r.sku) || {},
  }));
  rows.sort((a, b) => b.sellout90 - a.sellout90);

  const cuota = (cuotaRes.data || []).reduce((s, r) => s + (Number(r.cuota_min) || Number(r.cuota_meta) || 0), 0);
  const facturado = selloutMes;
  const hoy = new Date();
  const finMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
  const diasRestantes = Math.max(0, Math.ceil((finMes - hoy) / 86400000));
  const skusConInv = rows.filter((r) => r.invActeck > 0).length;
  const topVendidos = rows.slice(0, 5).map((r) => ({ sku: r.sku, piezas: r.sellout90 }));

  return {
    skus: rows,
    contexto: { cuota, facturado, gap: Math.max(0, cuota - facturado), diasRestantes, skusConInv, topVendidos },
  };
}

async function fetchSelloutMesActual(clienteKey) {
  const anio = MES_ACTUAL.anio, mes = MES_ACTUAL.mes;
  if (clienteKey === 'digitalife') {
    const ini = `${anio}-${String(mes).padStart(2, '0')}-01`;
    const finM = new Date(anio, mes, 0);
    const fin = `${anio}-${String(mes).padStart(2, '0')}-${String(finM.getDate()).padStart(2, '0')}`;
    const { data } = await supabase.from('sellout_detalle')
      .select('cantidad,precio')
      .eq('cliente', 'digitalife')
      .gte('fecha', ini).lte('fecha', fin)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.cantidad) || 0) * (Number(r.precio) || 0), 0);
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('importe')
      .eq('mayorista', 'DICOTECH')
      .eq('anio', anio).eq('mes', mes)
      .limit(200000);
    return (data || []).reduce((s, r) => s + (Number(r.importe) || 0), 0);
  }
  return 0;
}

async function fetchSellout(clienteKey, mm, anioMin, anioMax) {
  const meses = new Set(mm.map((m) => `${m.anio}-${String(m.mes).padStart(2, '0')}`));

  if (clienteKey === 'digitalife') {
    const { data } = await supabase.from('sellout_detalle')
      .select('no_parte,cantidad,fecha')
      .eq('cliente', 'digitalife')
      .gte('fecha', `${anioMin}-01-01`).limit(200000);
    return (data || [])
      .filter((r) => meses.has(String(r.fecha).slice(0, 7)))
      .map((r) => ({ sku: r.no_parte, cantidad: r.cantidad }));
  }
  if (clienteKey === 'pcel') {
    const { data } = await supabase.from('sellout_pcel')
      .select('sku,anio,semana,vta_mes_1,vta_mes_2,vta_mes_3')
      .gte('anio', anioMax - 1).limit(50000);
    const byKey = new Map();
    for (const r of data || []) {
      const key = (Number(r.anio) || 0) * 100 + (Number(r.semana) || 0);
      const prev = byKey.get(r.sku);
      if (!prev || prev.key < key) byKey.set(r.sku, { key, r });
    }
    const out = [];
    for (const { r } of byKey.values()) {
      const total = (Number(r.vta_mes_1) || 0) + (Number(r.vta_mes_2) || 0) + (Number(r.vta_mes_3) || 0);
      if (total > 0) out.push({ sku: r.sku, cantidad: total });
    }
    return out;
  }
  if (clienteKey === 'dicotech') {
    const { data } = await supabase.from('sellout_general')
      .select('sku,cantidad,anio,mes')
      .eq('mayorista', 'DICOTECH')
      .gte('anio', anioMin).limit(200000);
    return (data || [])
      .filter((r) => meses.has(`${r.anio}-${String(r.mes).padStart(2, '0')}`))
      .map((r) => ({ sku: r.sku, cantidad: r.cantidad }));
  }
  return [];
}
