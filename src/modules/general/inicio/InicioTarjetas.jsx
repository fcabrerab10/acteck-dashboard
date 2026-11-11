// Inicio en tarjetas (2026-11-11 · diseño C): las cifras del negocio como tarjetas chicas, medianas y grandes que cada
// quien elige y ordena («Editar»), al estilo de los widgets del iPhone. Mismo cálculo que la página (`calcular`).
// La selección se guarda en la cuenta (`preferencias.inicio.tarjetas`); tocar una tarjeta abre su pantalla.
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { elevation } from '../../../lib/elevation';
import { usePreferencias } from '../../../lib/preferencias';
import { moneyCompact as $c, int, pct, fechaCorta as fecha } from '../../../lib/format';
import { Pill, Boton, Trazo } from '../../../components/kit';
import { PAGINAS } from './config';

const signo = (v) => `${v >= 0 ? '▲' : '▼'} ${Math.abs(Math.round(v))} %`;
const tono = (v) => (v >= 0 ? 'green' : 'red');

/** Catálogo: cada tarjeta dice su tamaño (g = 2×2 · m = 2×1 · c = 1×1), si se puede ver y qué pinta. */
export function catalogo({ r, ve, anio, labelPeriodo }) {
  const c = r.cur, so = r.sellOut, inv = r.inv, ec = r.enCamino, cart = r.cartera;
  return [
    { id: 'cuota', label: 'Cuota del período', tam: 'g', inversa: true, pagina: PAGINAS.sellIn,
      eyebrow: `Cuota · ${labelPeriodo}`, big: r.pctCuota != null ? `${Math.round(r.pctCuota)} %` : '—',
      sub: `${$c(c.fact_neta)}${r.cuotaPeriodo ? ` de ${$c(r.cuotaPeriodo)}` : ''}${r.yoy != null ? ` · ${signo(r.yoy)} ${r.yoyLabel}` : ''}`, progreso: r.pctCuota },
    { id: 'sellin', label: 'Sell in', tam: 'c', pagina: PAGINAS.sellIn, eyebrow: 'Sell in', big: $c(c.fact_neta),
      pill: r.yoy != null ? { l: signo(r.yoy), tone: tono(r.yoy) } : null, trazo: r.serie.map((m) => m.fn || null) },
    { id: 'sellout', label: 'Sell out', tam: 'c', pagina: 'sellOut', eyebrow: 'Sell out', big: so.total > 0 ? $c(so.total) : '—',
      pill: so.yoy != null ? { l: signo(so.yoy), tone: tono(so.yoy) } : null, sub: so.soSi != null ? `SO/SI ${so.soSi.toFixed(2)}` : null, trazo: so.serie.map((m) => m.so || null) },
    { id: 'margen', label: 'Margen', tam: 'c', ver: r.sensible, eyebrow: 'Margen', big: c.mc != null ? pct(c.mc) : '—',
      pill: r.dMc != null ? { l: `${r.dMc >= 0 ? '+' : ''}${r.dMc.toFixed(1)} pp`, tone: tono(r.dMc) } : null, sub: `${$c(c.contribucion)} contribución`, trazo: r.serie.map((m) => m.mc) },
    { id: 'inventario', label: 'Inventario', tam: 'c', ver: ve.inventario, pagina: PAGINAS.inventario, eyebrow: 'Inventario', big: $c(inv.valor),
      pill: inv.cobertura != null ? { l: `${inv.cobertura} d`, tone: inv.cobertura > 150 ? 'orange' : 'gray' } : null, sub: `${int(inv.piezas)} pz` },
    { id: 'camino', label: 'En camino', tam: 'c', ver: ve.inventario, pagina: PAGINAS.inventario, eyebrow: ec.porMes[0] ? `Llega en ${ec.porMes[0].label}` : 'En camino', big: $c(ec.porMes[0]?.valor ?? ec.valor),
      sub: `${$c(ec.valor)} en ${ec.pos} PO${ec.proximos[0] ? ` · próximo ${fecha(ec.proximos[0].eta)}` : ''}`, pill: ec.atrasados.pos > 0 ? { l: `${ec.atrasados.pos} con ETA vencida`, tone: 'red' } : null },
    { id: 'cartera', label: 'Cartera', tam: 'c', ver: ve.cobranza, pagina: PAGINAS.cobranza, eyebrow: 'Por cobrar', big: $c(cart.saldo),
      pill: cart.vencido > 0 ? { l: `${$c(cart.vencido)} vencido`, tone: cart.pctVencido > 15 ? 'red' : 'orange' } : { l: 'al corriente', tone: 'green' }, sub: cart.dso != null ? `DSO ${cart.dso} días` : null },
    { id: 'anio', label: `${anio} frente a ${anio - 1}`, tam: 'm', pagina: PAGINAS.sellIn, eyebrow: `${anio} acumulado`, big: $c(r.modo === 'mes' ? r.otro?.fact_neta : c.fact_neta),
      sub: (r.modo === 'mes' ? r.pctOtro : r.pctCuota) != null ? `${Math.round(r.modo === 'mes' ? r.pctOtro : r.pctCuota)} % de la cuota a la fecha` : null, trazo: r.serie.map((m) => m.fn || null), trazoAlto: 34 },
    { id: 'decidir', label: 'Para decidir', tam: 'm', eyebrow: 'Requiere decisión', lista: r.decision.slice(0, 3).map((a) => ({ t: a.titulo, tone: a.severidad === 'critica' ? 'red' : 'orange' })), vacio: 'Nada urgente hoy.' },
    { id: 'agenda', label: 'Próximos 7 días', tam: 'm', eyebrow: 'Próximos 7 días · pagos, arribos y eventos', lista: (r.agenda || []).slice(0, 3).map((a) => ({ t: a.titulo || a.texto || a.label, tone: 'blue', d: a.fecha ? fecha(a.fecha) : null })), vacio: 'Sin pendientes próximos.' },
  ].filter((t) => t.ver !== false);
}

export const ORDEN_DEFAULT = ['cuota', 'sellin', 'sellout', 'inventario', 'camino', 'cartera', 'margen', 'anio', 'decidir', 'agenda'];

export default function InicioTarjetas({ r, ve, anio, labelPeriodo, onNavegar, onVerTodo, izquierda, derecha }) {
  const { theme } = useTheme();
  const { prefs, setPreferencia } = usePreferencias();
  const [editando, setEditando] = useState(false);
  const [orden, setOrden] = useState(null);      // orden local mientras se arrastra
  const [arrastre, setArrastre] = useState(null); // { id, x, y, gx, gy }
  const rejilla = useRef(null), elems = useRef({}), pulso = useRef(null), ultimoCambio = useRef(0), seMovio = useRef(false);
  const todas = catalogo({ r, ve, anio, labelPeriodo });
  const guardadas = Array.isArray(prefs?.inicio?.tarjetas) ? prefs.inicio.tarjetas : null;
  const ids = (orden || guardadas || ORDEN_DEFAULT).filter((id) => todas.some((t) => t.id === id));
  const visibles = ids.map((id) => todas.find((t) => t.id === id));
  const fuera = todas.filter((t) => !ids.includes(t.id));
  const guardar = (lista) => { setOrden(null); setPreferencia('inicio.tarjetas', lista); };

  // Estilo iPhone: mantener presionada una tarjeta entra a editar (tiemblan); se arrastran para acomodarlas y la
  // «−» de la esquina las quita. «Listo» o tocar el fondo termina.
  const alBajar = (e, id) => {
    seMovio.current = false;
    if (editando) {
      const el = elems.current[id]; if (!el) return;
      const rc = el.getBoundingClientRect();
      e.currentTarget.setPointerCapture?.(e.pointerId);
      setOrden(ids);
      setArrastre({ id, x: e.clientX, y: e.clientY, gx: e.clientX - rc.left, gy: e.clientY - rc.top });
      return;
    }
    const x0 = e.clientX, y0 = e.clientY;
    clearTimeout(pulso.current);
    pulso.current = setTimeout(() => { seMovio.current = true; setEditando(true); try { navigator.vibrate?.(8); } catch { /* sin vibración */ } }, 450);
    pulso.x = x0; pulso.y = y0;
  };
  const alMover = (e) => {
    if (!arrastre) { if (pulso.current && Math.hypot(e.clientX - pulso.x, e.clientY - pulso.y) > 8) { clearTimeout(pulso.current); pulso.current = null; } return; }
    seMovio.current = true;
    setArrastre((a) => (a ? { ...a, x: e.clientX, y: e.clientY } : a));
    const ahora = Date.now();
    if (ahora - ultimoCambio.current < 160) return;
    for (const id of ids) {
      if (id === arrastre.id) continue;
      const rc = elems.current[id]?.getBoundingClientRect(); if (!rc) continue;
      if (e.clientX > rc.left + rc.width * 0.2 && e.clientX < rc.right - rc.width * 0.2 && e.clientY > rc.top + rc.height * 0.2 && e.clientY < rc.bottom - rc.height * 0.2) {
        const l = ids.filter((x) => x !== arrastre.id); l.splice(ids.indexOf(id), 0, arrastre.id);
        ultimoCambio.current = ahora; setOrden(l); break;
      }
    }
  };
  const alSoltar = () => {
    clearTimeout(pulso.current); pulso.current = null;
    if (arrastre) { setArrastre(null); if (orden) guardar(orden); }
  };
  useEffect(() => () => clearTimeout(pulso.current), []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: TYPO.fontText }} onClick={(e) => { if (editando && e.target === e.currentTarget) setEditando(false); }}>
      <style>{'@keyframes tarjetaTiembla{0%{transform:rotate(-0.7deg)}50%{transform:rotate(0.7deg)}100%{transform:rotate(-0.7deg)}}@media (prefers-reduced-motion: reduce){.tarjeta-tiembla{animation:none!important}}'}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', paddingRight: 'var(--hueco-avatar, 0px)' }}>
        <span style={{ minWidth: 0 }}>{editando ? <span style={{ fontSize: 12, color: theme.textMuted }}>Arrastra para acomodar · «−» quita la tarjeta</span> : izquierda}</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {!editando && derecha}
          {!editando && <Boton onClick={onVerTodo}>Ver todo</Boton>}
          <Boton primario={editando} onClick={() => setEditando((v) => !v)}>{editando ? 'Listo' : 'Editar'}</Boton>
        </span>
      </div>
      <div ref={rejilla} data-entrada-kpis onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gridAutoRows: 'minmax(100px, 1fr)', gridAutoFlow: 'dense', gap: 10, minHeight: 'calc(100dvh - 150px - env(safe-area-inset-bottom, 0px))' }}>
        {visibles.map((t, n) => {
          const inv = t.inversa;
          const fg = inv ? (theme.textOnInverse || '#F5F5F7') : theme.text;
          const mut = inv ? (theme.mode === 'dark' ? 'rgba(29,29,31,0.62)' : 'rgba(245,245,247,0.66)') : theme.textMuted;
          const bg = inv ? (theme.surfaceInverse || '#000') : theme.surface;
          const mio = arrastre?.id === t.id;
          let transform;
          if (mio) {
            const el = elems.current[t.id], g = rejilla.current?.getBoundingClientRect();
            if (el && g) transform = `translate(${arrastre.x - (g.left + el.offsetLeft) - arrastre.gx}px, ${arrastre.y - (g.top + el.offsetTop) - arrastre.gy}px) scale(1.04)`;
          }
          return (
            <div key={t.id} ref={(el) => { elems.current[t.id] = el; }} role={t.pagina && !editando ? 'button' : undefined} className={editando && !mio ? 'tarjeta-tiembla' : undefined}
              onPointerDown={(e) => alBajar(e, t.id)} onContextMenu={(e) => e.preventDefault()}
              onClick={() => { if (!editando && !seMovio.current && t.pagina) onNavegar?.(null, t.pagina); }}
              style={{
                gridColumn: t.tam === 'c' ? 'span 1' : 'span 2', gridRow: t.tam === 'g' ? 'span 2' : 'span 1', minWidth: 0, position: 'relative',
                backgroundColor: bg, backgroundImage: inv ? `radial-gradient(120% 140% at 0% 0%, color-mix(in srgb, ${bg} 86%, #8A90A8), ${bg} 62%)` : 'none', color: fg,
                border: inv ? 0 : `1px solid ${theme.border}`, borderRadius: 18, padding: 14, boxShadow: mio ? elevation(theme, 'flotante') : elevation(theme, 'tarjeta'),
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 8, cursor: editando ? 'grab' : t.pagina ? 'pointer' : 'default',
                userSelect: 'none', WebkitUserSelect: 'none', WebkitTouchCallout: 'none', touchAction: editando ? 'none' : 'manipulation',
                transform, zIndex: mio ? 5 : 1, opacity: mio ? 0.96 : 1,
                animation: editando && !mio ? `tarjetaTiembla ${0.26 + (n % 3) * 0.03}s ease-in-out ${(n % 4) * -0.07}s infinite` : 'none',
                transition: mio ? 'box-shadow 160ms' : 'box-shadow 160ms, opacity 160ms',
              }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: mut, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.eyebrow}</span>
                {!editando && t.pill && <Pill tone={t.pill.tone} size="xs">{t.pill.l}</Pill>}
              </div>
              {t.lista ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {!t.lista.length && <span style={{ fontSize: 12.5, color: mut }}>{t.vacio}</span>}
                  {t.lista.map((x, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 12.5, minWidth: 0 }}>
                      <Pill tone={x.tone} dot size="xs">{x.d || ' '}</Pill><span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.t}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: TYPO.fontRounded, fontSize: t.tam === 'g' ? 44 : 24, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{t.big}</div>
                  {t.sub && <div style={{ fontSize: 11.5, color: mut, marginTop: 5, fontVariantNumeric: 'tabular-nums' }}>{t.sub}</div>}
                  {t.trazo && <Trazo puntos={t.trazo} h={t.trazoAlto || 22} style={{ marginTop: 6 }} />}
                  {t.progreso != null && <div style={{ marginTop: 10, height: 6, borderRadius: 999, background: 'rgba(127,127,140,0.3)', overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.min(100, Math.max(0, t.progreso))}%`, borderRadius: 999, background: t.progreso >= 100 ? theme.green : t.progreso >= 85 ? theme.accent : t.progreso >= 60 ? theme.orange : theme.red }} /></div>}
                </div>
              )}
              {editando && !mio && (
                <button type="button" title="Quitar" onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); guardar(ids.filter((x) => x !== t.id)); }}
                  style={{ position: 'absolute', top: -8, left: -8, width: 26, height: 26, borderRadius: 999, border: `1px solid ${theme.border}`, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: theme.mode === 'dark' ? '#3A3A3C' : '#E5E5EA', color: theme.text, boxShadow: elevation(theme, 'hover') }}>
                  <Minus size={15} strokeWidth={2.6} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {editando && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {fuera.map((t) => <Boton key={t.id} icon={Plus} onClick={() => guardar([...ids, t.id])}>{t.label}</Boton>)}
          {guardadas && <Boton onClick={() => guardar(null)}>Restablecer</Boton>}
        </div>
      )}
    </div>
  );
}
