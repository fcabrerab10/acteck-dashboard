// Agenda «que te lleva» (V6 · 2026-10-08) · UNA pantalla «Hoy» que cambia con la hora: antes de organizar → tarjeta «Organiza
// tu día»; trabajando → Ahora · Tu día · Después · Lo que mandé · Reuniones de hoy; al cierre → tarjeta «Cierra el día»; cerrado →
// resumen. Abajo «Movidas hoy» con Deshacer. Teclado: ↑↓ eligen fila · H hecha · M mañana · ↵ abre · Esc suelta · N captura.
import React, { useEffect, useMemo, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, toast } from '../../components/kit';
import { Titulo, Seccion } from '../agenda5/comun';
import { Ahora } from '../agenda5/Hoy';
import { cronometro } from '../agenda5/datos';
import { fmtMin } from '../agenda5/calculo';
import { nombreClienteAgenda } from '../agenda5/base/etiquetas';
import { estadoDelDia, fraseDia, delegadas, sumarDiasIso } from './calculo';
import { accionItem, cerrarDiaV6, useMovidas, organizadoHoy } from './datos';
import { FilaRapida, MovidasHoy, TarjetaInversa, BotonInv, fechaCorta, primerNombre } from './piezas';

export function useEstadoDia({ d, propietario, hoy, horas, tickMs = 60000 }) {
  const [tick, setTick] = useState(0);
  useEffect(() => { const t = setInterval(() => setTick((x) => x + 1), tickMs); return () => clearInterval(t); }, [tickMs]);
  const ahora = useMemo(() => new Date(), [tick]); // eslint-disable-line react-hooks/exhaustive-deps
  const org = organizadoHoy(propietario);
  const estado = useMemo(() => estadoDelDia({ items: d.items || [], uid: propietario, hoy: ahora, horas, registros: d.registros || [], organizadoHoy: org, reuniones: d.reuniones || [], google: d.google || [] }), [d.items, d.registros, d.reuniones, d.google, propietario, ahora, horas, org]);
  return { estado, ahora };
}

export default function Hoy6({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar, onAbrirReunion, horas, onOrganizar, onIrA, persona }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const { estado: e } = useEstadoDia({ d, propietario, hoy, horas });
  const hoyIso = e.hoyIso;
  const esMia = uid === propietario;
  const movidas = useMovidas(propietario, hoyIso, esMia);
  const mandadas = useMemo(() => delegadas(d.items, propietario, hoy, { personasPorId }), [d.items, propietario, hoy, personasPorId]);
  const despues = useMemo(() => {
    const lim = sumarDiasIso(hoyIso, 7);
    return (d.items || []).filter((it) => (it.estado === 'abierta' || it.estado === 'arrastrada') && ((it.responsables || []).includes(propietario) || (!(it.responsables || []).length && it.propietario === propietario)) && it.cuando && it.cuando > hoyIso && it.cuando <= lim).sort((a, b) => a.cuando.localeCompare(b.cuando) || (a.hora || '99').localeCompare(b.hora || '99')).slice(0, 8);
  }, [d.items, propietario, hoyIso]);
  const lista = useMemo(() => [...e.quedo, ...e.h.deHoy], [e.quedo, e.h.deHoy]);

  // Teclado: ↑↓ H M ↵ Esc
  const [sel, setSel] = useState(-1);
  useEffect(() => { if (sel >= lista.length) setSel(lista.length - 1); }, [lista.length, sel]);
  useEffect(() => {
    const h = (ev) => {
      if (ev.target.closest('input, textarea, [contenteditable], select, [role="dialog"]')) return;
      if (ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const it = sel >= 0 ? lista[sel] : null;
      if (ev.key === 'ArrowDown') { ev.preventDefault(); setSel((s) => Math.min(lista.length - 1, s + 1)); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (ev.key === 'Escape') setSel(-1);
      else if (it && puedeEditar && (ev.key === 'h' || ev.key === 'H')) { ev.preventDefault(); accionItem(it, it.estado === 'hecha' ? 'reabrir' : 'hecha', { hoyIso }).catch(() => {}); }
      else if (it && puedeEditar && (ev.key === 'm' || ev.key === 'M')) { ev.preventDefault(); accionItem(it, 'manana', { hoyIso }).catch(() => {}); }
      else if (it && ev.key === 'Enter') { ev.preventDefault(); onAbrirItem?.(it); }
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [sel, lista, puedeEditar, hoyIso, onAbrirItem]);
  useEffect(() => { if (sel >= 0) document.querySelector(`[data-fila-rapida="${lista[sel]?.id}"]`)?.scrollIntoView({ block: 'nearest' }); }, [sel, lista]);

  const toggle = (it, hecha) => accionItem(it, hecha ? 'hecha' : 'reabrir', { hoyIso }).catch(() => {});
  const crono = (it, acc) => cronometro(it, acc).catch((err) => toast.error(err.message));
  const fila = (it, k, opts = {}) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} seleccionada={k === sel} {...opts} />;
  const nombre = primerNombre(persona);
  const organizar = () => onOrganizar?.(e);
  const meta = e.fase === 'trabajar' ? `${e.avance.hechas} de ${e.avance.total} · ${fmtMin(e.h.minTareas)} planeados` : e.fase === 'cerrado' ? 'día cerrado' : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }} data-hoy6>
      <Titulo meta={meta} acciones={<div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {puedeEditar && e.fase !== 'cerrado' && e.fase !== 'organizar' && <Pill size="sm" tone="gray" style={{ cursor: 'pointer' }} onClick={organizar}>Reorganizar</Pill>}
        {puedeEditar && <Pill size="sm" tone="blue" style={{ cursor: 'pointer' }} onClick={onCapturar}>+ Nuevo (N)</Pill>}
      </div>}>Hoy</Titulo>

      {/* Tarjeta de arriba según la fase */}
      {e.fase === 'organizar' && (
        <TarjetaInversa eyebrow="Antes de empezar">
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{fraseDia(e, nombre)}</div>
          <div style={{ fontSize: 12.5, opacity: 0.7 }}>{e.ayerSinCerrar ? `${fechaCorta(e.ayerIso)} quedó sin cerrar (${e.ayer.hechas} de ${e.ayer.total}). ` : ''}{e.h.reunionesHoy.length ? `${e.h.reunionesHoy.length} reunión${e.h.reunionesHoy.length === 1 ? '' : 'es'} hoy.` : ''}</div>
          {puedeEditar && <div style={{ display: 'flex', gap: 6 }}><BotonInv primario onClick={organizar}>Organizar mi día</BotonInv></div>}
        </TarjetaInversa>
      )}
      {e.fase === 'trabajar' && <Ahora h={e.h} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrirItem={onAbrirItem} onAbrirReunion={onAbrirReunion} onToggle={toggle} onCrono={crono} />}
      {e.fase === 'cierre' && <CierraDia e={e} propietario={propietario} puedeEditar={puedeEditar} onAbrirItem={onAbrirItem} />}
      {e.fase === 'cerrado' && (
        <TarjetaInversa eyebrow="Día cerrado">
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em' }}>{fraseDia(e, nombre)}</div>
          {e.regHoy?.resumen && <div style={{ fontSize: 12.5, opacity: 0.75 }}>«{e.regHoy.resumen}»</div>}
          {e.regHoy?.manana_empiezo && <div style={{ fontSize: 12.5, opacity: 0.75 }}>Mañana empiezas con: {e.regHoy.manana_empiezo}</div>}
        </TarjetaInversa>
      )}

      {/* Tu día */}
      {e.quedo.length > 0 && <div><Seccion meta={`${e.quedo.length}`}>De antes</Seccion><div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{e.quedo.map((it, k) => fila(it, k, { mostrarFecha: true }))}</div></div>}
      <div>
        <Seccion meta={`${e.h.deHoy.length} abiertas · ${e.h.hechasHoy.length} hechas`}>Tu día</Seccion>
        {e.h.deHoy.length === 0 && e.h.hechasHoy.length === 0 && <div style={{ padding: '18px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Nada para hoy todavía. {puedeEditar ? 'Pulsa N y escribe como hablas.' : ''}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {e.h.deHoy.map((it, k) => fila(it, e.quedo.length + k))}
          {e.h.hechasHoy.map((it) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} compacta />)}
        </div>
      </div>

      {/* Reuniones de hoy */}
      {(e.h.reunionesHoy.length > 0 || e.h.googleHoy.length > 0) && (
        <div><Seccion meta={`${e.h.reunionesHoy.length + e.h.googleHoy.length}`}>Reuniones de hoy</Seccion>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {e.h.reunionesHoy.map((r) => <div key={r.id} onClick={() => onAbrirReunion?.(r)} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', borderRadius: 11, cursor: 'pointer', fontSize: 13 }} onMouseEnter={(ev) => { ev.currentTarget.style.background = theme.surfaceHover || 'rgba(120,120,128,0.10)'; }} onMouseLeave={(ev) => { ev.currentTarget.style.background = 'transparent'; }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, width: 44, color: theme.accent }}>{r.hora ? String(r.hora).slice(0, 5) : '—'}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</span>{r.cliente_key && r.cliente_key !== 'interno' && <Pill size="xs" tone="orange">{nombreClienteAgenda(r.cliente_key)}</Pill>}
            </div>)}
            {e.h.googleHoy.map((g) => <div key={g.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '7px 10px', fontSize: 13, color: theme.textMuted }}><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, width: 44 }}>{g.inicio ? String(new Date(g.inicio).toTimeString()).slice(0, 5) : '—'}</span><span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{g.titulo || g.summary}</span><Pill size="xs" tone="gray">Google</Pill></div>)}
          </div>
        </div>
      )}

      {/* Después (7 días) y Lo que mandé */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 14 }}>
        <div>
          <Seccion meta={despues.length ? `${despues.length}` : null}>Después</Seccion>
          {despues.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '4px 10px' }}>Nada con fecha en los próximos 7 días.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>{despues.map((it) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} mostrarFecha compacta acciones={['hoy', 'yano', 'mandar']} />)}</div>
        </div>
        <div>
          <Seccion meta={mandadas.total ? `${mandadas.total} abiertas${mandadas.vencidas.length ? ` · ${mandadas.vencidas.length} vencidas` : ''}` : null}>
            <span onClick={() => onIrA?.('mande')} style={{ cursor: 'pointer' }}>Lo que mandé ›</span>
          </Seccion>
          {mandadas.total === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '4px 10px' }}>No has mandado nada a nadie.</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {[...mandadas.vencidas, ...mandadas.enCurso].slice(0, 6).map((it) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} mostrarFecha compacta acciones={['mandar', 'yano']} />)}
          </div>
        </div>
      </div>

      {/* Movidas hoy */}
      {esMia && (movidas.data || []).length > 0 && (
        <div>
          <Seccion meta={`${(movidas.data || []).length}`}><span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Undo2 size={12} />Movidas hoy</span></Seccion>
          <MovidasHoy movidas={movidas.data || []} />
        </div>
      )}
      <div style={{ fontSize: 11, color: theme.textMuted, padding: '0 4px' }}>Teclas: ↑↓ eligen · <b>H</b> hecha · <b>M</b> mañana · <b>↵</b> abre · <b>N</b> captura · pasa el mouse por una fila para Hoy · Mañana · Semana · Ya no · Mandar.</div>
    </div>
  );
}

/** Tarjeta «Cierra el día»: energía, una línea, «mañana empiezo con»; lo abierto se va a mañana con Deshacer. */
export function CierraDia({ e, propietario, puedeEditar, onAbrirItem, movil = false, onCerrado }) {
  const { theme } = useTheme();
  const [energia, setEnergia] = useState(null);
  const [resumen, setResumen] = useState('');
  const [manana, setManana] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const abiertos = e.h.deHoy;
  const cerrar = async () => {
    setOcupado(true);
    try { await cerrarDiaV6(propietario, e.hoyIso, { energia, resumen, manana_empiezo: manana }, abiertos); toast.ok(`Día cerrado · ${e.avance.hechas} de ${e.avance.total}${abiertos.length ? ` · ${abiertos.length} a mañana` : ''}`); onCerrado?.(); }
    catch (err) { toast.error(err.message); } finally { setOcupado(false); }
  };
  const inp = { width: '100%', boxSizing: 'border-box', border: 0, borderRadius: 10, padding: '9px 11px', background: `${theme.bg}26`, color: 'inherit', fontFamily: TYPO.fontText, fontSize: movil ? 16 : 13, outline: 'none' };
  return (
    <TarjetaInversa eyebrow="Cierra el día">
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{fraseDia(e)}</div>
      {abiertos.length > 0 && <div style={{ fontSize: 12.5, opacity: 0.75 }}>Se van a mañana: {abiertos.slice(0, 3).map((it) => it.titulo).join(' · ')}{abiertos.length > 3 ? ` y ${abiertos.length - 3} más` : ''}.</div>}
      {puedeEditar && <>
        <div style={{ display: 'flex', gap: 6 }}>{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" onClick={() => setEnergia(n)} aria-label={`Energía ${n}`} style={{ flex: 1, height: movil ? 40 : 30, borderRadius: 9, border: 0, background: energia === n ? (theme.bg || '#fff') : `${theme.bg}26`, color: energia === n ? (theme.text || '#000') : 'inherit', fontFamily: TYPO.fontDisplay, fontWeight: 700, cursor: 'pointer' }}>{n}</button>)}</div>
        <input value={resumen} onChange={(ev) => setResumen(ev.target.value)} placeholder="¿Cómo estuvo el día? Una línea." style={inp} />
        <input value={manana} onChange={(ev) => setManana(ev.target.value)} placeholder="Mañana empiezo con…" style={inp} />
        <div style={{ display: 'flex', gap: 6 }}><BotonInv primario disabled={ocupado} onClick={cerrar}>Cerrar el día</BotonInv></div>
      </>}
    </TarjetaInversa>
  );
}
