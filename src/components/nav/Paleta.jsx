// Paleta ⌘K · busca pestañas, clientes propios, SKUs (roadmap_sku) y clientes finales del ERP.
// Flotante 520 px, radio 12, ELEV.flotante. Teclado ↑↓ ↵ Esc.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Package, Building2, CornerDownLeft, ArrowUp, ArrowDown } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { cachedQuery, fetchAll } from '../../lib/queries';
import { nodosPlanos, etiquetaNodo, irANodo, CLIENTES_NAV, CLIENTES_ORDEN } from './arbol';
import { Kbd, PuntoCliente, Overlay, vidrio, hoverBg, hairline } from './comun';

const normalizar = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

// Clientes finales del ERP que son clientes propios con pestaña
const ERP_A_CLIENTE = { 'API GLOBAL': 'digitalife', 'CAJADL01': 'digitalife', 'PC ONLINE': 'pcel', 'DICOTECH': 'dicotech' };

// Cache en módulo (una sola precarga por sesión; fetchAll ya cachea la URL 5 min).
let clientesFinalesCache = null;
async function cargarClientesFinales() {
  if (clientesFinalesCache) return clientesFinalesCache;
  if (!DB_CONFIGURED) return [];
  try {
    const filas = await fetchAll('v_vision_factura_clientes', 'cliente_nombre,canal', (q) => q.order('cliente_nombre'));
    const mapa = new Map();
    for (const f of filas || []) if (f.cliente_nombre && !mapa.has(f.cliente_nombre)) mapa.set(f.cliente_nombre, f.canal);
    clientesFinalesCache = [...mapa.entries()].map(([nombre, canal]) => ({ nombre, canal, n: normalizar(nombre) }));
  } catch { clientesFinalesCache = []; }
  return clientesFinalesCache;
}

export default function Paleta({ abierto, onClose, arbol, onNavegar, perfil }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const [skus, setSkus] = useState([]);
  const [finales, setFinales] = useState([]);
  const inputRef = useRef(null);
  const listaRef = useRef(null);

  useEffect(() => {
    if (!abierto) return;
    setQ(''); setSel(0); setSkus([]); setFinales([]);
    const t = setTimeout(() => inputRef.current?.focus(), 30);
    return () => clearTimeout(t);
  }, [abierto]);

  const nodos = useMemo(() => nodosPlanos(arbol || []).filter((n) => !n.disabled), [arbol]);
  const clientes = useMemo(() => {
    const keys = new Set(nodos.filter((n) => n.tipo === 'cliente').map((n) => n.clienteKey));
    return CLIENTES_ORDEN.filter((k) => keys.has(k)).map((k) => CLIENTES_NAV[k]);
  }, [nodos]);

  const nq = normalizar(q.trim());

  // Pestañas y clientes propios: filtro local
  const resPestanas = useMemo(() => {
    if (!nq) return nodos.slice(0, 8);
    const terms = nq.split(/\s+/).filter(Boolean);
    return nodos
      .map((n) => ({ n, texto: normalizar(`${etiquetaNodo(n)} ${n.grupoLabel || ''}`) }))
      .filter(({ texto }) => terms.every((t) => texto.includes(t)))
      .slice(0, 8).map(({ n }) => n);
  }, [nodos, nq]);
  const resClientes = useMemo(() => (nq ? clientes.filter((c) => normalizar(c.label).includes(nq)) : []), [clientes, nq]);

  // SKUs (roadmap_sku) · cachedQuery, límite 8, debounce 160 ms
  useEffect(() => {
    if (!abierto || !DB_CONFIGURED || nq.length < 2) { setSkus([]); return; }
    let cancel = false;
    const t = setTimeout(async () => {
      try {
        const patron = `%${q.trim().replace(/[%_]/g, '')}%`;
        const { data } = await cachedQuery(
          supabase.from('roadmap_sku').select('sku,descripcion,marca').or(`sku.ilike.${patron},descripcion.ilike.${patron}`).limit(8)
        );
        if (!cancel) setSkus(data || []);
      } catch { if (!cancel) setSkus([]); }
    }, 160);
    return () => { cancel = true; clearTimeout(t); };
  }, [abierto, nq, q]);

  // Clientes finales · precarga una vez, filtro local
  useEffect(() => {
    if (!abierto || nq.length < 2) { setFinales([]); return; }
    let cancel = false;
    cargarClientesFinales().then((lista) => {
      if (cancel) return;
      setFinales(lista.filter((c) => c.n.includes(nq)).slice(0, 6));
    });
    return () => { cancel = true; };
  }, [abierto, nq]);

  // Lista unificada
  const items = useMemo(() => {
    const out = [];
    resPestanas.forEach((n) => out.push({ tipo: 'pestana', key: `p:${n.id}`, nodo: n, label: etiquetaNodo(n), sub: n.tipo === 'cliente' ? 'Pestaña de cliente' : n.grupoLabel }));
    resClientes.forEach((c) => out.push({ tipo: 'cliente', key: `c:${c.key}`, cliente: c, label: c.label, sub: `Cliente · ${c.marca}` }));
    skus.forEach((s) => out.push({ tipo: 'sku', key: `s:${s.sku}`, sku: s, label: s.sku, sub: [s.marca, s.descripcion].filter(Boolean).join(' · ') }));
    finales.forEach((f) => out.push({ tipo: 'final', key: `f:${f.nombre}`, final: f, label: f.nombre, sub: `Cliente final · ${f.canal || 'ERP'}` }));
    return out;
  }, [resPestanas, resClientes, skus, finales]);

  useEffect(() => { setSel(0); }, [items.length, nq]);
  useEffect(() => {
    const el = listaRef.current?.querySelector(`[data-idx="${sel}"]`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [sel]);

  const ejecutar = (it) => {
    if (!it) return;
    onClose?.();
    if (it.tipo === 'pestana') { irANodo(it.nodo, onNavegar); return; }
    if (it.tipo === 'cliente') { onNavegar?.(it.cliente.key, 'home'); return; }
    if (it.tipo === 'sku') {
      // Sell In global con búsqueda prellenada: la pantalla aún no lee este valor; queda disponible en sessionStorage.
      try { sessionStorage.setItem('nav_busqueda_sku', it.sku.sku); } catch {}
      onNavegar?.(null, 'sellIn'); return;
    }
    if (it.tipo === 'final') {
      const propio = ERP_A_CLIENTE[String(it.final.nombre).toUpperCase()];
      try { sessionStorage.setItem('nav_busqueda_cliente', it.final.nombre); } catch {}
      if (propio && nodos.some((n) => n.id === `${propio}:home`)) onNavegar?.(propio, 'home');
      else onNavegar?.(null, 'sellIn');
    }
  };

  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(items.length - 1, s + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); ejecutar(items[sel]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
  };

  const secciones = [
    { id: 'pestana', label: nq ? 'Ir a…' : 'Sugerencias' }, { id: 'cliente', label: 'Clientes' }, { id: 'sku', label: 'SKUs' }, { id: 'final', label: 'Clientes finales (ERP)' },
  ];

  return (
    <Overlay abierto={abierto} onClose={onClose} zIndex={70} alinear="flex-start">
      <div role="dialog" aria-modal="true" aria-label="Buscar" onKeyDown={onKey}
        style={{
          width: 'min(520px, calc(100vw - 24px))', marginTop: 'min(14vh, 120px)', borderRadius: 12, overflow: 'hidden',
          ...vidrio(theme, 'popover'), fontFamily: TYPO.fontText, color: theme.text,
          animation: `paletaIn ${DUR.state}ms ${EASE} both`,
        }}>
        <style>{`@keyframes paletaIn { from { opacity: 0; transform: translateY(-6px) scale(0.985); } to { opacity: 1; transform: none; } }`}</style>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderBottom: `1px solid ${hairline(theme)}` }}>
          <Search size={16} style={{ color: theme.textMuted, flexShrink: 0 }} />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pestañas, clientes, SKUs…"
            autoComplete="off" spellCheck={false}
            style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 15, color: theme.text }} />
          <Kbd theme={theme}>esc</Kbd>
        </label>

        <div ref={listaRef} style={{ maxHeight: 'min(52vh, 420px)', overflowY: 'auto', padding: 6 }}>
          {items.length === 0 && (
            <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 12.5 }}>
              {nq.length < 2 ? 'Escribe para buscar pestañas, clientes o SKUs' : `Sin resultados para “${q.trim()}”`}
            </div>
          )}
          {secciones.map((sec) => {
            const lista = items.map((it, idx) => ({ it, idx })).filter(({ it }) => it.tipo === sec.id);
            if (!lista.length) return null;
            return (
              <div key={sec.id} style={{ marginBottom: 4 }}>
                <div style={{ padding: '8px 10px 4px', fontSize: 9.5, fontWeight: 600, letterSpacing: '0.09em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{sec.label}</div>
                {lista.map(({ it, idx }) => {
                  const on = idx === sel;
                  return (
                    <div key={it.key} data-idx={idx} onMouseEnter={() => setSel(idx)} onClick={() => ejecutar(it)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                        background: on ? theme.accent : 'transparent', color: on ? '#FFF' : theme.text,
                        transition: `background ${DUR.tap}ms ${EASE}`,
                      }}>
                      <ResultadoIcono it={it} on={on} theme={theme} />
                      <span style={{ flex: 1, minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 500, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: it.tipo === 'sku' ? '"SF Mono", ui-monospace, monospace' : TYPO.fontText }}>{it.label}</span>
                        {it.sub && <span style={{ display: 'block', fontSize: 11, color: on ? 'rgba(255,255,255,0.8)' : theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.sub}</span>}
                      </span>
                      {on && <CornerDownLeft size={13} style={{ opacity: 0.8 }} />}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 14px', borderTop: `1px solid ${hairline(theme)}`, fontSize: 10.5, color: theme.textMuted }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd theme={theme}><ArrowUp size={9} /></Kbd><Kbd theme={theme}><ArrowDown size={9} /></Kbd> navegar</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Kbd theme={theme}>↵</Kbd> abrir</span>
          <span style={{ flex: 1 }} />
          {perfil?.nombre && <span style={{ opacity: 0.7 }}>{perfil.nombre.split(' ')[0]}</span>}
        </div>
      </div>
    </Overlay>
  );
}

function ResultadoIcono({ it, on, theme }) {
  const base = { width: 26, height: 26, borderRadius: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    background: on ? 'rgba(255,255,255,0.18)' : hoverBg(theme), color: on ? '#FFF' : theme.textMuted };
  if (it.tipo === 'pestana') {
    const Icon = it.nodo.icon;
    return <span style={base}>{it.nodo.tipo === 'cliente' ? <PuntoCliente color={it.nodo.color} size={9} /> : Icon ? <Icon size={14} /> : null}</span>;
  }
  if (it.tipo === 'cliente') return <span style={base}><PuntoCliente color={it.cliente.color} size={9} /></span>;
  if (it.tipo === 'sku') return <span style={base}><Package size={14} /></span>;
  return <span style={base}><Building2 size={14} /></span>;
}
