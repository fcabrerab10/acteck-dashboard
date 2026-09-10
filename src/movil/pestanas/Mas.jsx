// Pestaña Más · tarjeta de perfil (abre PreferenciasHoja de src/components/perfil) + biblioteca de pestañas como
// iconos de app (44 px, radio 11) con buscador. Inventario y Precios abren la Ficha de producto; Historial y el
// Importador (sólo lectura: frescura por fuente) son pantallas propias; el resto abre "Próximamente".
import React, { Suspense, lazy, useMemo, useState } from 'react';
import { Boxes, Tag, History, Upload, LogOut, ChevronRight, SlidersHorizontal, Sun, Moon, Palette, Monitor } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { versionLabel } from '../../lib/version';
import { AvatarImg, usePerfilVivo } from '../../lib/avatar';
import { cargoDe } from '../../components/perfil/comun';
import { construirArbol } from '../../components/nav/arbol';
import { setPreferencia } from '../../lib/preferencias';
import { useFrescura, formatFrescura } from '../../lib/frescura';
import { useNav } from '../nav';
import { TituloGrande, ListaAgrupada, Fila, CampoBusqueda, Cabecera, IconoApp, Segmented, Skeleton, Vacio, TituloSeccionM } from '../piezas';
import { useHistorial, nombreCliente } from '../datos';
import { relativo, int } from '../util';
import FichaProducto from '../FichaProducto';
import FichaCliente from './FichaCliente';

const PreferenciasHoja = lazy(() => import('../../components/perfil/PreferenciasHoja'));
const TEMAS = [{ id: 'claro', icon: Sun, title: 'Claro' }, { id: 'midnight', icon: Moon, title: 'Midnight' }, { id: 'marfil', icon: Palette, title: 'Marfil' }, { id: 'auto', icon: Monitor, title: 'Auto' }];

export default function Mas() {
  const { theme, themeKey, setThemeKey } = useTheme();
  const nav = useNav();
  const perfil = usePerfilVivo(nav.perfil);
  const [q, setQ] = useState('');
  const [prefs, setPrefs] = useState(false);
  const nq = q.trim().toLowerCase();

  const secciones = useMemo(() => {
    const herramientas = [
      { id: 'inventario', label: 'Inventario', icon: Boxes, color: theme.accent, onClick: () => nav.push(<FichaProducto />, 'ficha') },
      { id: 'precios', label: 'Precios', icon: Tag, color: theme.green, onClick: () => nav.push(<FichaProducto />, 'ficha') },
      { id: 'historial', label: 'Historial', icon: History, color: theme.purple, onClick: () => nav.push(<Historial />, 'historial') },
      { id: 'importador', label: 'Importador', icon: Upload, color: theme.orange, onClick: () => nav.push(<Fuentes />, 'fuentes') },
    ];
    let arbol = []; try { arbol = construirArbol(nav.perfil); } catch { arbol = []; }
    const out = [{ id: 'movil', titulo: 'En el celular', nodos: herramientas }];
    for (const g of arbol) {
      const nodos = g.nodos.filter((n) => !['inicio', 'inventarioGlobal', 'estrategiaPrecios', 'historialCambios', 'actualizacion'].includes(n.pagina))
        .map((n) => ({ id: n.id, label: n.label, icon: n.icon, color: n.color, onClick: n.pagina === 'configuracion' ? () => setPrefs(true) : () => nav.abrirProximamente(n.label) }));
      if (nodos.length) out.push({ id: g.id, titulo: g.label, nodos });
      for (const c of g.clientes || []) out.push({ id: `c-${c.key}`, titulo: c.label, color: c.color, nodos: c.nodos.map((n) => ({ id: n.id, label: n.label, icon: n.icon, color: c.color, onClick: () => nav.push(<FichaCliente clienteKey={c.key} />, `cliente-${c.key}`) })) });
    }
    if (!nq) return out;
    return out.map((s) => ({ ...s, nodos: s.nodos.filter((n) => `${n.label} ${s.titulo}`.toLowerCase().includes(nq)) })).filter((s) => s.nodos.length);
  }, [nav, theme, nq]);

  return (
    <>
      <TituloGrande titulo="Más" sub={versionLabel()} />

      <section style={{ padding: '0 16px' }}>
        <button type="button" onClick={() => setPrefs(true)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px', border: `1px solid ${theme.border}`, borderRadius: 12, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer' }}>
          <AvatarImg perfil={perfil} size={56} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{perfil?.nombre || perfil?.email}</span>
            <span style={{ display: 'block', fontSize: 13, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cargoDe(perfil) || 'Sin cargo'}{perfil?.es_super_admin ? ' · Super admin' : ''}</span>
            <span style={{ display: 'block', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, marginTop: 2 }}>Cuenta, foto y preferencias</span>
          </span>
          <ChevronRight size={16} style={{ color: theme.textSubtle || theme.textMuted }} />
        </button>
      </section>

      <ListaAgrupada style={{ marginTop: 12 }}>
        <Fila icon={Palette} color={theme.indigo} titulo="Tema" chevron={false} trailing={<Segmented value={themeKey || theme.key} onChange={(v) => { setThemeKey(v); setPreferencia('tema', v); }} options={TEMAS.map((t) => ({ id: t.id, title: t.title, label: <t.icon size={13} strokeWidth={2} aria-label={t.title} /> }))} />} />
        <Fila icon={SlidersHorizontal} color={theme.textMuted} titulo="Todas las preferencias" sub="Notificaciones, menú, atajos" onClick={() => setPrefs(true)} />
        <Fila icon={LogOut} color={theme.red} titulo={<span style={{ color: theme.red }}>Cerrar sesión</span>} sub={perfil?.email} chevron={false} onClick={() => nav.onCerrarSesion?.()} />
      </ListaAgrupada>

      <div style={{ padding: '18px 16px 10px' }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="Buscar pestaña" />
      </div>
      {secciones.length === 0 && <Vacio icon={null} titulo={`Nada coincide con “${q}”`} />}
      {secciones.map((s) => (
        <section key={s.id} style={{ padding: '0 16px 14px' }}>
          <TituloSeccionM style={{ padding: '0 4px 8px', display: 'flex', alignItems: 'center', gap: 6 }}>{s.color && <span style={{ width: 7, height: 7, borderRadius: 999, background: s.color, display: 'inline-block', marginRight: 4 }} />}{s.titulo}</TituloSeccionM>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
            {s.nodos.map((n) => (
              <button key={n.id} type="button" onClick={n.onClick} title={n.label}
                style={{ padding: '8px 2px 6px', border: 0, borderRadius: 12, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer', minWidth: 0 }}>
                <IconoApp icon={n.icon} color={n.color} size={44} radius={11} />
                <span style={{ fontSize: 10.5, fontWeight: 500, lineHeight: 1.15, textAlign: 'center', letterSpacing: '-0.01em', maxWidth: '100%', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.label}</span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {prefs && (
        <Suspense fallback={null}>
          <PreferenciasHoja abierto={prefs} onClose={() => setPrefs(false)} perfil={nav.perfil} onCerrarSesion={nav.onCerrarSesion} />
        </Suspense>
      )}
    </>
  );
}

// ── Historial de cambios (últimos 40 de auditoria_cambios) ──
export function Historial() {
  const { theme } = useTheme();
  const nav = useNav();
  const { data, isLoading } = useHistorial(true);
  const OPER = { INSERT: ['green', 'alta'], UPDATE: ['blue', 'cambio'], DELETE: ['red', 'baja'] };
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Más" />
      <TituloGrande titulo="Historial" sub="Últimos cambios que la app escribió" />
      {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={300} r={12} /></div>}
      {!isLoading && !data?.length && <Vacio icon={History} color={theme.textMuted} titulo="Sin cambios registrados" sub="O tu perfil no puede ver la auditoría." />}
      {!!data?.length && (
        <ListaAgrupada>
          {data.map((c) => {
            const [tone, label] = OPER[String(c.operacion).toUpperCase()] || ['gray', c.operacion];
            const campos = c.cambios && typeof c.cambios === 'object' ? Object.keys(c.cambios).slice(0, 4).join(', ') : '';
            return <Fila key={c.id} chevron={false} titulo={`${c.tabla}${c.cliente_key ? ` · ${nombreCliente(c.cliente_key)}` : ''}`} sub={`${c.usuario_email || 'sistema'} · ${relativo(c.creado_at)}${campos ? ` · ${campos}` : ''}`} pill={{ tone, label }} />;
          })}
        </ListaAgrupada>
      )}
    </>
  );
}

// ── Importador (sólo lectura): frescura por fuente de datos ──
export function Fuentes() {
  const { theme } = useTheme();
  const nav = useNav();
  const { filas, cargando } = useFrescura(true);
  const tone = { ok: 'green', atrasada: 'orange', sin_datos: 'gray' };
  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Más" />
      <TituloGrande titulo="Importador" sub="Sólo lectura · las cargas se hacen desde la computadora" />
      {cargando && <div style={{ padding: '0 16px' }}><Skeleton h={300} r={12} /></div>}
      {!cargando && !filas.length && <Vacio icon={Upload} color={theme.textMuted} titulo="Sin fuentes visibles" sub="Tu perfil no puede ver el estado de las cargas." />}
      {!!filas.length && (
        <ListaAgrupada titulo="Fuentes" meta={filas.length} pie="Estado según el umbral de días de cada fuente (v_fuentes_frescura).">
          {[...filas].sort((a, b) => (b.estado === 'atrasada') - (a.estado === 'atrasada')).map((f) => (
            <Fila key={f.fuente} chevron={false} titulo={f.etiqueta || f.fuente} sub={`${f.ultima_carga ? formatFrescura(f.ultima_carga) : 'sin carga'}${f.periodo_max ? ` · hasta ${f.periodo_max}` : ''}${f.filas != null ? ` · ${int(f.filas)} filas` : ''}`}
              pill={{ tone: tone[f.estado] || 'gray', label: f.estado === 'atrasada' ? `${f.dias} d` : f.estado === 'ok' ? 'al día' : 'sin datos' }} />
          ))}
        </ListaAgrupada>
      )}
      <div style={{ padding: '12px 28px 0', fontSize: 12, color: theme.textSubtle || theme.textMuted }}>
        {nav.perfil?.es_super_admin ? <a href="/uploads.html" target="_blank" rel="noopener" style={{ color: theme.accent, textDecoration: 'none' }}>Abrir el importador completo (uploads.html) ›</a> : 'Sólo el super admin carga datos.'}
      </div>
    </>
  );
}
