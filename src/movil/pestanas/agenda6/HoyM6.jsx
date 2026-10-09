// Agenda «que te lleva» (V6 · 2026-10-08) · «Hoy» en el celular: la misma pantalla que cambia con la hora (organiza · ahora ·
// cierra · cerrado), filas de 56 px con palomita de 44, un toque abre, deslizar → hecha / ← mañana, «Lo que mandé» y
// «Movidas hoy» con Deshacer. Sin jalar-para-refrescar en esta pestaña (lo apaga MovilApp).
import React, { useMemo } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, toast } from '../../../components/kit';
import { ListaAgrupada, Fila } from '../../piezas';
import { Ahora } from '../../../modules/agenda5/Hoy';
import { cronometro } from '../../../modules/agenda5/datos';
import { fmtMin } from '../../../modules/agenda5/calculo';
import { nombreClienteAgenda } from '../../../modules/agenda5/base/etiquetas';
import { fraseDia, delegadas, sumarDiasIso } from '../../../modules/agenda6/calculo';
import { accionItem, useMovidas } from '../../../modules/agenda6/datos';
import { useEstadoDia, CierraDia } from '../../../modules/agenda6/Hoy6';
import { MovidasHoy, TarjetaInversa, BotonInv, fechaCorta, primerNombre } from '../../../modules/agenda6/piezas';
import { FilaM6, AccionesM } from './piezasM';

export default function HoyM6({ d, uid, propietario, personasPorId, puedeEditar, hoy, horas, persona, abrirItem, abrirMinuta, onOrganizar, onIrA }) {
  const { theme } = useTheme();
  const { estado: e } = useEstadoDia({ d, propietario, hoy, horas, tickMs: 30000 });
  const hoyIso = e.hoyIso;
  const esMia = uid === propietario;
  const movidas = useMovidas(propietario, hoyIso, esMia);
  const mandadas = useMemo(() => delegadas(d.items, propietario, hoy, { personasPorId }), [d.items, propietario, hoy, personasPorId]);
  const despues = useMemo(() => { const lim = sumarDiasIso(hoyIso, 7); return (d.items || []).filter((it) => (it.estado === 'abierta' || it.estado === 'arrastrada') && ((it.responsables || []).includes(propietario) || (!(it.responsables || []).length && it.propietario === propietario)) && it.cuando && it.cuando > hoyIso && it.cuando <= lim).sort((a, b) => a.cuando.localeCompare(b.cuando)).slice(0, 6); }, [d.items, propietario, hoyIso]);
  const toggle = (it, hecha) => accionItem(it, hecha ? 'hecha' : 'reabrir', { hoyIso }).catch(() => {});
  const crono = (it, acc) => cronometro(it, acc).catch((err) => toast.error(err.message));
  const nombre = primerNombre(persona);
  const fila = (it, opts) => <FilaM6 key={it.id} item={it} uid={uid} personasPorId={personasPorId} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={abrirItem} {...(opts || {})} />;
  const P = ({ children }) => <div style={{ padding: '0 16px' }}>{children}</div>;
  const accionTit = (label, onClick) => <button type="button" onClick={onClick} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, padding: '0 4px', minHeight: 28 }}>{label}</button>;
  return (
    <>
      <P>
        {e.fase === 'organizar' && (
          <TarjetaInversa eyebrow="Antes de empezar" onClick={puedeEditar ? () => onOrganizar?.(e) : undefined}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2 }}>{fraseDia(e, nombre)}</div>
            <div style={{ fontSize: 13, opacity: 0.7 }}>{e.ayerSinCerrar ? `${fechaCorta(e.ayerIso)} quedó sin cerrar (${e.ayer.hechas} de ${e.ayer.total}). ` : ''}{e.h.reunionesHoy.length ? `${e.h.reunionesHoy.length} reunión${e.h.reunionesHoy.length === 1 ? '' : 'es'} hoy.` : ''}</div>
            {puedeEditar && <div><BotonInv primario onClick={() => onOrganizar?.(e)} style={{ minHeight: 44, padding: '0 18px' }}>Organizar mi día</BotonInv></div>}
          </TarjetaInversa>
        )}
        {e.fase === 'trabajar' && <Ahora h={e.h} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrirItem={abrirItem} onAbrirReunion={abrirMinuta} onToggle={toggle} onCrono={crono} compacta />}
        {e.fase === 'cierre' && <CierraDia e={e} propietario={propietario} puedeEditar={puedeEditar} movil />}
        {e.fase === 'cerrado' && (
          <TarjetaInversa eyebrow="Día cerrado">
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{fraseDia(e, nombre)}</div>
            {e.regHoy?.manana_empiezo && <div style={{ fontSize: 13, opacity: 0.75 }}>Mañana empiezas con: {e.regHoy.manana_empiezo}</div>}
          </TarjetaInversa>
        )}
      </P>
      {e.quedo.length > 0 && (
        <ListaAgrupada titulo="De antes" meta={`${e.quedo.length}`} style={{ marginTop: 14 }}>
          {e.quedo.map((it) => <React.Fragment key={it.id}>{fila(it, { mostrarFecha: true, izquierda: 'hoy' })}{puedeEditar && <AccionesM acciones={[{ label: 'Hoy', tone: 'blue', onClick: () => accionItem(it, 'hoy', { hoyIso }).catch(() => {}) }, { label: 'Semana', onClick: () => accionItem(it, 'semana', { hoyIso }).catch(() => {}) }, { label: 'Ya no', tone: 'red', onClick: () => accionItem(it, 'yano', { hoyIso }).catch(() => {}) }]} />}</React.Fragment>)}
        </ListaAgrupada>
      )}
      <ListaAgrupada titulo="Tu día" meta={`${e.h.deHoy.length} abiertas · ${e.h.hechasHoy.length} hechas${e.h.minTareas ? ` · ${fmtMin(e.h.minTareas)}` : ''}`} style={{ marginTop: 14 }}
        accion={puedeEditar && e.fase !== 'organizar' && e.fase !== 'cerrado' ? accionTit('Reorganizar', () => onOrganizar?.(e)) : undefined}>
        {e.h.deHoy.length === 0 && e.h.hechasHoy.length === 0 && <div style={{ padding: '18px 16px', textAlign: 'center', color: theme.textMuted, fontSize: 13.5 }}>Nada para hoy todavía. Toca «Nuevo» abajo y escribe como hablas.</div>}
        {e.h.deHoy.map((it) => fila(it))}
        {e.h.hechasHoy.map((it) => fila(it, { gestos: false }))}
      </ListaAgrupada>
      {(e.h.reunionesHoy.length > 0 || e.h.googleHoy.length > 0) && (
        <ListaAgrupada titulo="Reuniones de hoy" meta={`${e.h.reunionesHoy.length + e.h.googleHoy.length}`} style={{ marginTop: 14 }}>
          {e.h.reunionesHoy.map((r) => <Fila key={r.id} titulo={r.titulo} sub={[r.hora ? String(r.hora).slice(0, 5) : null, r.cliente_key && r.cliente_key !== 'interno' ? nombreClienteAgenda(r.cliente_key) : null].filter(Boolean).join(' · ')} onClick={() => abrirMinuta?.(r)} />)}
          {e.h.googleHoy.map((g) => <Fila key={g.id} titulo={g.titulo || g.summary} sub={g.inicio ? `${new Date(g.inicio).toTimeString().slice(0, 5)} · Google` : 'Google'} chevron={false} />)}
        </ListaAgrupada>
      )}
      <ListaAgrupada titulo="Lo que mandé" meta={mandadas.total ? `${mandadas.total}${mandadas.vencidas.length ? ` · ${mandadas.vencidas.length} vencidas` : ''}` : 'nada'} accion={accionTit('Ver todo', () => onIrA?.('mande'))} style={{ marginTop: 14 }}>
        {mandadas.total === 0 && <div style={{ padding: '12px 16px', color: theme.textMuted, fontSize: 13 }}>No has mandado nada a nadie.</div>}
        {[...mandadas.vencidas, ...mandadas.enCurso].slice(0, 4).map((it) => fila(it, { mostrarFecha: true, gestos: false }))}
      </ListaAgrupada>
      {despues.length > 0 && (
        <ListaAgrupada titulo="Después" meta="7 días" style={{ marginTop: 14 }}>
          {despues.map((it) => fila(it, { mostrarFecha: true, izquierda: 'hoy' }))}
        </ListaAgrupada>
      )}
      {esMia && (movidas.data || []).length > 0 && (
        <ListaAgrupada titulo="Movidas hoy" meta={`${(movidas.data || []).length}`} style={{ marginTop: 14 }}>
          <div style={{ padding: '4px 10px 8px' }}><MovidasHoy movidas={movidas.data || []} compacta /></div>
        </ListaAgrupada>
      )}
      <div style={{ padding: '10px 16px 0', fontSize: 11.5, color: theme.textMuted }}>Desliza → hecha · ← mañana. Toca para abrir. <Pill size="xs" tone="gray">Deshacer en el aviso</Pill></div>
      <div style={{ height: 120 }} />
    </>
  );
}
