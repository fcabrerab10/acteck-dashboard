// Barra inferior flotante estilo iPhone (44 px, blur 24, radio 999, ELEV.flotante) con 5 entradas fijas:
// Inicio · Clientes · Alertas · Buscar · Más. "Clientes" y "Más" abren hojas desde abajo (340 ms).
// "Buscar" abre ⌘K y "Alertas" abre el centro de notificaciones (slot `campana`: CuerpoNotificaciones; recibe onCerrar).
import React, { useMemo, useState } from 'react';
import { LayoutGrid, Users, Bell, Search, Grid2x2, ChevronRight, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { esNodoActivo, irANodo, resolverFavoritos, CLIENTES_NAV } from './arbol';
import { Hoja, IconoApp, FilaAjustes, TituloSeccion, BotonFav, hairline, hoverBg, esMidnight, esMarfil } from './comun';
import { useResaltadoDeslizante, estiloVidrio } from './Resaltado';

export const IPHONE_PADDING_INFERIOR = 88;

export default function BarraIphone({ arbol, favoritos, toggleFavorito, estado, onNavegar, onAbrirPaleta, campana, datosClientes }) {
  const { theme } = useTheme();
  const dark = esMidnight(theme);
  const [hoja, setHoja] = useState(null); // 'clientes' | 'mas' | 'alertas'

  const inicio = useMemo(() => arbol.find((g) => g.id === 'inicio')?.nodos?.[0] || null, [arbol]);
  const clientes = useMemo(() => arbol.flatMap((g) => g.clientes || []), [arbol]);
  const activoId = useMemo(() => {
    if (estado.vistaActual === 'configuracion') return 'mas';
    if (estado.clienteActivo) return 'clientes';
    if (estado.paginaActiva === 'inicio') return 'inicio';
    return 'mas';
  }, [estado]);

  const navegar = (c, p) => { setHoja(null); onNavegar?.(c, p); };
  // Pastilla de vidrio deslizante (sustituye a la pastilla negra). La barra ya es de vidrio: variante translúcida.
  const activoBarra = hoja == null ? activoId : hoja;
  const res = useResaltadoDeslizante(activoBarra, { theme, radio: 999 });
  const entradas = [
    { id: 'inicio',   label: 'Inicio',   icon: LayoutGrid, onClick: () => inicio && irANodo(inicio, navegar) },
    { id: 'clientes', label: 'Clientes', icon: Users,      onClick: () => setHoja('clientes') },
    { id: 'alertas',  label: 'Alertas',  icon: Bell,       onClick: () => setHoja('alertas') },
    { id: 'buscar',   label: 'Buscar',   icon: Search,     onClick: () => onAbrirPaleta?.() },
    { id: 'mas',      label: 'Más',      icon: Grid2x2,    onClick: () => setHoja('mas') },
  ];

  return (
    <>
      <nav ref={res.refContenedor} aria-label="Navegación" style={{
        position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(14px + env(safe-area-inset-bottom))', zIndex: 50,
        height: 56, padding: '0 8px', borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 4, minWidth: 440,
        background: dark ? 'rgba(28,28,30,0.78)' : esMarfil(theme) ? 'rgba(255,251,244,0.82)' : 'rgba(255,255,255,0.80)',
        backdropFilter: 'saturate(180%) blur(24px)', WebkitBackdropFilter: 'saturate(180%) blur(24px)',
        border: bordeFlotante(theme), boxShadow: elevation(theme, 'flotante'), fontFamily: TYPO.fontText,
      }}>
        {res.pastilla}
        {entradas.map((e) => {
          const on = activoId === e.id && hoja == null ? true : hoja === e.id;
          const Icon = e.icon;
          return (
            <button key={e.id} ref={res.refItem(e.id)} type="button" onClick={e.onClick} title={e.label}
              style={{
                position: 'relative',
                height: 44, minWidth: 80, padding: '0 14px', border: 0, borderRadius: 999, cursor: 'pointer',
                display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
                background: 'transparent', color: on ? theme.text : theme.textMuted,
                transition: `color ${DUR.state}ms ${EASE}`,
              }}>
              <Icon size={19} strokeWidth={on ? 2.2 : 1.9} />
              <span style={{ fontSize: 10.5, fontWeight: on ? 600 : 500, letterSpacing: '0.01em', fontFamily: TYPO.fontDisplay }}>{e.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Hoja Clientes · lista agrupada estilo Ajustes */}
      <Hoja abierto={hoja === 'clientes'} onClose={() => setHoja(null)} titulo="Clientes" theme={theme}
        acciones={<BotonCerrar theme={theme} onClick={() => setHoja(null)} />}>
        {clientes.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Sin clientes visibles para tu perfil.</div>}
        {clientes.map((c) => (
          <div key={c.key} style={{ marginBottom: 14 }}>
            <TituloSeccion theme={theme} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: c.color }} />{c.label}
              {datosClientes?.[c.key] && <span style={{ marginLeft: 'auto', textTransform: 'none', letterSpacing: 0, fontFamily: '"SF Mono", ui-monospace, monospace' }}>{datosClientes[c.key]}</span>}
            </TituloSeccion>
            <div style={{ borderRadius: 12, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)', border: `1px solid ${hairline(theme)}` }}>
              {c.nodos.map((n, i) => (
                <FilaAjustes key={n.id} theme={theme} icon={n.icon} color={c.color} label={n.label} activo={esNodoActivo(n, estado)} disabled={n.disabled}
                  sub={n.hint} primera={i === 0} ultima={i === c.nodos.length - 1} onClick={() => irANodo(n, navegar)}
                  trailing={<ChevronRight size={14} style={{ color: theme.textSubtle || theme.textMuted }} />} />
              ))}
            </div>
          </div>
        ))}
      </Hoja>

      {/* Hoja Más · todas las pestañas como iconos de app + buscador */}
      <HojaMas abierto={hoja === 'mas'} onClose={() => setHoja(null)} arbol={arbol} favoritos={favoritos} toggleFavorito={toggleFavorito} estado={estado} onNavegar={navegar} theme={theme} />

      {/* Hoja Alertas · centro de notificaciones (slot) */}
      <Hoja abierto={hoja === 'alertas'} onClose={() => setHoja(null)} titulo="Alertas" theme={theme} alto="70vh"
        acciones={<BotonCerrar theme={theme} onClick={() => setHoja(null)} />}>
        <div style={{ padding: '4px 4px 8px' }}>{React.isValidElement(campana) ? React.cloneElement(campana, { onCerrar: () => setHoja(null) }) : campana}</div>
      </Hoja>
    </>
  );
}

function BotonCerrar({ theme, onClick }) {
  return (
    <button type="button" onClick={onClick} title="Cerrar" style={{ width: 28, height: 28, border: 0, borderRadius: 999, cursor: 'pointer', background: hoverBg(theme), color: theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
      <X size={14} />
    </button>
  );
}

function HojaMas({ abierto, onClose, arbol, favoritos, toggleFavorito, estado, onNavegar, theme }) {
  const [q, setQ] = useState('');
  const dark = esMidnight(theme);
  const favs = useMemo(() => resolverFavoritos(arbol, favoritos), [arbol, favoritos]);
  const nq = q.trim().toLowerCase();
  const filtra = (nodos) => (nq ? nodos.filter((n) => `${n.label} ${n.tipo === 'cliente' ? CLIENTES_NAV[n.clienteKey]?.label : ''}`.toLowerCase().includes(nq)) : nodos);

  const secciones = [];
  if (favs.length) secciones.push({ id: 'fav', titulo: 'Favoritos', nodos: filtra(favs), etiquetaCliente: true });
  for (const g of arbol) {
    const nodos = filtra(g.nodos);
    if (nodos.length) secciones.push({ id: g.id, titulo: g.label, nodos });
    for (const c of g.clientes || []) {
      const cn = filtra(c.nodos);
      if (cn.length) secciones.push({ id: `c-${c.key}`, titulo: c.label, nodos: cn, color: c.color });
    }
  }

  return (
    <Hoja abierto={abierto} onClose={onClose} titulo="Todas las pestañas" theme={theme} alto="82vh"
      acciones={<BotonCerrar theme={theme} onClick={onClose} />}>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, height: 36, padding: '0 12px', borderRadius: 10, margin: '0 4px 10px', background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' }}>
        <Search size={14} style={{ color: theme.textMuted }} />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar pestaña" autoComplete="off"
          style={{ flex: 1, border: 0, outline: 'none', background: 'transparent', fontFamily: TYPO.fontText, fontSize: 14, color: theme.text }} />
      </label>
      {secciones.length === 0 && <div style={{ padding: 20, textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Nada coincide con “{q}”.</div>}
      {secciones.map((s) => (
        <div key={s.id} style={{ marginBottom: 10 }}>
          <TituloSeccion theme={theme} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {s.color && <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color }} />}{s.titulo}
          </TituloSeccion>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(84px, 1fr))', gap: 6, padding: '0 4px' }}>
            {s.nodos.map((n) => {
              const activo = esNodoActivo(n, estado);
              const Icon = n.icon;
              const fav = favoritos.includes(n.id);
              return (
                <div key={`${s.id}-${n.id}`} style={{ position: 'relative' }}>
                  <button type="button" onClick={() => irANodo(n, onNavegar)} disabled={n.disabled} title={n.label}
                    style={{
                      width: '100%', padding: '8px 4px 6px', border: 0, borderRadius: 12, cursor: n.disabled ? 'not-allowed' : 'pointer',
                      opacity: n.disabled ? 0.45 : 1,
                      ...(activo ? estiloVidrio(theme, { plano: true, radio: 12 }) : { background: 'transparent' }),
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5, color: theme.text, fontFamily: TYPO.fontText,
                    }}>
                    <IconoApp icon={Icon} color={n.color} />
                    <span style={{ fontSize: 10.5, fontWeight: activo ? 600 : 500, lineHeight: 1.15, textAlign: 'center', letterSpacing: '-0.01em', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                      {s.etiquetaCliente && n.tipo === 'cliente' ? `${CLIENTES_NAV[n.clienteKey]?.label} · ${n.label}` : n.label}
                    </span>
                  </button>
                  <BotonFav theme={theme} activo={fav} visible onToggle={() => toggleFavorito(n.id)} size={10} style={{ position: 'absolute', top: 2, right: 2, opacity: fav ? 1 : 0.35 }} />
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </Hoja>
  );
}
