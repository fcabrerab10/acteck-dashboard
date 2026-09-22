// Barra inferior flotante (modo "barra") · 56 px, vidrio blur, activo en negro (surfaceInverse).
// Entradas en este orden: Inicio · Agenda · General · Comercial · Clientes · Interno · [avatar]. Los grupos sin nodos
// visibles para el perfil (construirArbol) se ocultan; Axon y Administración viven dentro de "Interno".
// "Agenda" NO es un grupo sino una pestaña raíz del shell (src/movil/rutas.js): sale sólo con el permiso global
// `agenda` (puedeVerPaginaGlobal) — David Millán y los externos no la ven — y lleva el badge de vencidos + de hoy.
//   <BarraGrupos arbol activo onEntrada perfil badgeAgenda />   onEntrada(id) · id ∈ 'inicio' | 'agenda' | id de grupo | 'perfil'
import React from 'react';
import { LayoutGrid, CalendarCheck, Landmark, Briefcase, Users, Building2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { elevation, bordeFlotante } from '../../lib/elevation';
import { AvatarImg } from '../../lib/avatar';
import { puedeVerPaginaGlobal } from '../../lib/permisos';
import { useResaltadoDeslizante } from '../../components/nav/Resaltado';
import { ALTO_BARRA } from '../nav';

const ENTRADAS = [
  { id: 'inicio',             label: 'Inicio',    icon: LayoutGrid,    grupos: ['inicio'] },
  { id: 'agenda',             label: 'Agenda',    icon: CalendarCheck, grupos: [], pagina: 'agenda' },
  { id: 'direccionGeneral',   label: 'General',   icon: Landmark,   grupos: ['direccionGeneral'] },
  { id: 'direccionComercial', label: 'Comercial', icon: Briefcase,  grupos: ['direccionComercial'] },
  { id: 'clientesPropios',    label: 'Clientes',  icon: Users,      grupos: ['clientesPropios'] },
  { id: 'interno',            label: 'Interno',   icon: Building2,  grupos: ['interno', 'axon'] },
];

/** Entradas visibles para este árbol y perfil (los grupos por sus nodos; Agenda por su permiso global). */
export function entradasBarra(arbol, perfil) {
  const lista = Array.isArray(arbol) ? arbol : [];
  const tiene = (id) => { const g = lista.find((x) => x.id === id); return !!g && (g.nodos.length > 0 || (g.clientes || []).length > 0); };
  // 'inicio' sólo si el árbol trae el grupo inicio con nodos (construirArbol ya aplica puedeVerInicio).
  return ENTRADAS.filter((e) => (e.pagina ? puedeVerPaginaGlobal(perfil, e.pagina) : e.grupos.some(tiene)));
}

export default function BarraGrupos({ arbol, activo, onEntrada, perfil, badgeAgenda = 0 }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const marfil = theme.key === 'marfil';
  const entradas = entradasBarra(arbol, perfil);
  // Pastilla de vidrio deslizante (sustituye al fondo negro). La barra ya es de vidrio: variante translúcida.
  const res = useResaltadoDeslizante(activo, { theme, radio: 999, deps: entradas.map((e) => e.id).join(',') });
  return (
    <nav ref={res.refContenedor} aria-label="Menú" style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)', bottom: 'calc(12px + env(safe-area-inset-bottom))', zIndex: 60,
      width: 'min(calc(100% - 24px), 440px)', height: ALTO_BARRA, padding: '0 6px', borderRadius: 999, boxSizing: 'border-box',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2,
      // Deslizador de vidrio (src/lib/vidrio.js); en "Opaco" no hay variables y queda el literal de siempre.
      background: `var(--vidrio-bg, ${dark ? 'rgba(28,28,30,0.82)' : marfil ? 'rgba(255,251,244,0.86)' : 'rgba(255,255,255,0.84)'})`,
      backdropFilter: 'var(--vidrio-blur, saturate(180%) blur(24px))', WebkitBackdropFilter: 'var(--vidrio-blur, saturate(180%) blur(24px))',
      border: `var(--vidrio-border, ${bordeFlotante(theme)})`,
      boxShadow: `var(--vidrio-shine, 0 0 0 0 rgba(0,0,0,0)), ${elevation(theme, 'flotante')}`, fontFamily: TYPO.fontText,
    }}>
      {res.pastilla}
      {entradas.map(({ id, label, icon: Icon }) => {
        const on = activo === id;
        const badge = id === 'agenda' ? Number(badgeAgenda) || 0 : 0;
        return (
          <button key={id} ref={res.refItem(id)} type="button" onClick={() => onEntrada(id)} aria-current={on ? 'page' : undefined} aria-label={label}
            style={{
              position: 'relative',
              flex: 1, height: 44, minWidth: 0, padding: '0 4px', border: 0, borderRadius: 999, cursor: 'pointer',
              display: 'inline-flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2,
              background: 'transparent', color: on ? theme.text : theme.textMuted,
              transition: `color ${DUR.state}ms ${EASE}`,
            }}>
            <span style={{ position: 'relative', display: 'inline-flex' }}>
              <Icon size={20} strokeWidth={on ? 2.2 : 1.9} />
              {badge > 0 && (
                <span aria-hidden style={{
                  position: 'absolute', top: -4, right: -7, minWidth: 15, height: 15, padding: '0 4px', borderRadius: 999, boxSizing: 'border-box',
                  background: theme.red, color: theme.textOnDark || '#FFF', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 700, lineHeight: '15px', textAlign: 'center', fontVariantNumeric: 'tabular-nums',
                }}>{badge > 9 ? '9+' : badge}</span>
              )}
            </span>
            <span style={{ fontSize: 10, fontWeight: on ? 600 : 500, letterSpacing: '0.01em', fontFamily: TYPO.fontDisplay, whiteSpace: 'nowrap', maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          </button>
        );
      })}
      <button ref={res.refItem('perfil')} type="button" onClick={() => onEntrada('perfil')} aria-label="Perfil y preferencias" aria-current={activo === 'perfil' ? 'page' : undefined}
        style={{ position: 'relative', width: 48, height: 44, flexShrink: 0, border: 0, borderRadius: 999, padding: 0, cursor: 'pointer', background: 'transparent', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        <AvatarImg perfil={perfil} size={28} />
      </button>
    </nav>
  );
}
