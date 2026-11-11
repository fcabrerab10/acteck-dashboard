// Barra flotante por grupos (2026-11-11 · diseño A). Menú del iPhone Duo abierto: una pastilla de vidrio abajo con
// los grupos del árbol POR NOMBRE; tocar un grupo sube la hoja con sus pantallas (y los clientes propios); un grupo
// de una sola pantalla navega directo. Se esconde al bajar y vuelve al subir. Deja todo el ancho para el contenido.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, ChevronRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { esNodoActivo, irANodo } from './arbol';
import { Hoja, FilaAjustes, TituloSeccion, hairline, esMidnight, esMarfil } from './comun';

export const GRUPOS_PADDING_INFERIOR = 76;
const CORTO = { inicio: 'Inicio', direccionGeneral: 'Dirección', direccionComercial: 'Comercial', clientesPropios: 'Clientes', interno: 'Interno', axon: 'Axon' };

export default function BarraGruposWeb({ arbol, estado, onNavegar, onAbrirPaleta, scrollRef }) {
  const { theme } = useTheme();
  const dark = esMidnight(theme);
  const [abierto, setAbierto] = useState(null);
  const [oculta, setOculta] = useState(false);
  const navegar = (c, p) => { setAbierto(null); onNavegar?.(c, p); };
  const grupoActivo = useMemo(() => arbol.find((g) => g.nodos.some((n) => esNodoActivo(n, estado)) || (g.clientes || []).some((c) => c.nodos.some((n) => esNodoActivo(n, estado))))?.id, [arbol, estado]);

  // Se esconde al bajar (histéresis) y vuelve al subir o al cambiar de pantalla.
  useEffect(() => {
    const el = scrollRef?.current; if (!el) return undefined;
    let ultimo = el.scrollTop, acum = 0;
    const fn = () => {
      const d = el.scrollTop - ultimo; ultimo = el.scrollTop;
      acum = Math.sign(d) === Math.sign(acum) ? acum + d : d;
      if (acum > 28 && el.scrollTop > 80) setOculta(true); else if (acum < -12 || el.scrollTop < 40) setOculta(false);
    };
    el.addEventListener('scroll', fn, { passive: true });
    return () => el.removeEventListener('scroll', fn);
  }, [scrollRef]);
  useEffect(() => { setOculta(false); }, [estado]);

  const g = arbol.find((x) => x.id === abierto);
  const caja = { borderRadius: 14, background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.85)', border: `1px solid ${hairline(theme)}` };
  const btn = (on, color) => ({
    height: 44, padding: '0 14px', border: 0, borderRadius: 999, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap',
    background: on ? (color || theme.accent) : 'transparent', color: on ? '#FFF' : theme.textMuted,
    fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', transition: `background ${DUR.state}ms ${EASE}, color ${DUR.state}ms ${EASE}`,
  });
  return (
    <>
      <nav aria-label="Navegación" style={{
        position: 'fixed', left: '50%', bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 50, maxWidth: 'calc(100vw - 24px)', overflowX: 'auto',
        transform: `translateX(-50%) translateY(${oculta && !abierto ? '140%' : '0'})`, transition: `transform ${DUR.page}ms ${EASE}`,
        padding: 5, borderRadius: 999, display: 'inline-flex', alignItems: 'center', gap: 2,
        background: `var(--vidrio-bg, ${dark ? 'rgba(28,28,30,0.78)' : esMarfil(theme) ? 'rgba(255,251,244,0.82)' : 'rgba(255,255,255,0.80)'})`,
        backdropFilter: 'var(--vidrio-blur, saturate(180%) blur(24px))', WebkitBackdropFilter: 'var(--vidrio-blur, saturate(180%) blur(24px))',
        border: `var(--vidrio-border, ${bordeFlotante(theme)})`, boxShadow: elevation(theme, 'flotante'),
      }}>
        {arbol.map((x) => {
          const directo = x.nodos.length === 1 && !(x.clientes || []).length;
          const Icon = x.icon;
          const on = abierto ? abierto === x.id : grupoActivo === x.id;
          return (
            <button key={x.id} type="button" style={btn(on, x.color)} onClick={() => (directo ? irANodo(x.nodos[0], navegar) : setAbierto(abierto === x.id ? null : x.id))}>
              {Icon && <Icon size={16} strokeWidth={2} />}{CORTO[x.id] || x.label}
            </button>
          );
        })}
        <button type="button" style={btn(false)} onClick={() => onAbrirPaleta?.()} title="Buscar"><Search size={16} strokeWidth={2} />Buscar</button>
      </nav>

      <Hoja abierto={!!g} onClose={() => setAbierto(null)} titulo={g?.label || ''} theme={theme} alto="70vh">
        {g && (
          <>
            {g.nodos.length > 0 && (
              <div style={{ ...caja, marginBottom: 14 }}>
                {g.nodos.map((n, i) => (
                  <FilaAjustes key={n.id} theme={theme} icon={n.icon} color={g.color} label={n.label} activo={esNodoActivo(n, estado)} disabled={n.disabled}
                    primera={i === 0} ultima={i === g.nodos.length - 1} onClick={() => irANodo(n, navegar)} trailing={<ChevronRight size={14} style={{ color: theme.textMuted }} />} />
                ))}
              </div>
            )}
            {(g.clientes || []).map((c) => (
              <div key={c.key} style={{ marginBottom: 14 }}>
                <TituloSeccion theme={theme} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 999, background: c.color }} />{c.label}</TituloSeccion>
                <div style={caja}>
                  {c.nodos.map((n, i) => (
                    <FilaAjustes key={n.id} theme={theme} icon={n.icon} color={c.color} label={n.label} activo={esNodoActivo(n, estado)} disabled={n.disabled} sub={n.hint}
                      primera={i === 0} ultima={i === c.nodos.length - 1} onClick={() => irANodo(n, navegar)} trailing={<ChevronRight size={14} style={{ color: theme.textMuted }} />} />
                  ))}
                </div>
              </div>
            ))}
          </>
        )}
      </Hoja>
    </>
  );
}
