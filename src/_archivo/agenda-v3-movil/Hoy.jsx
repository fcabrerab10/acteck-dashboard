// Agenda móvil · A "Hoy en lista": hero (día, frase, hoy/vencidas/puntos abiertos), Segmented Mías · Equipo · Todo,
// secciones Vencidas / Hoy / Próximos / Sin fecha con tareas, puntos, reuniones de hoy y avisos del sistema.
// Gestos: deslizar a la derecha = hecho · a la izquierda = posponer a mañana (FilaGesto, con deshacer en el toast);
// palomita al tocar; tocar la tarjeta abre el ítem (Captura en modo edición).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { bandeja as calcBandeja, fraseHero, isoDia, diasEntre, PROXIMOS_DIAS } from '../../../modules/agenda/calculo';
import { HeroM, Segmented, Vacio } from '../../piezas';
import { nombreCorto, diaLargo } from '../../util';
import { useAgenda } from './Agenda';
import { FilaGesto, TarjetaItem, TarjetaAviso, TarjetaReunion, SeccionM, filtrarPor } from './comun';

const SEGS = [{ id: 'mias', label: 'Mías' }, { id: 'equipo', label: 'Equipo' }, { id: 'todo', label: 'Todo' }];

export default function Hoy() {
  const { theme } = useTheme();
  const a = useAgenda();
  const { items, reuniones, personasPorId, porId, hoy, avisos, uid, puedeEditar, perfil, abrirItem, abrirMinuta, toggle, posponer, navegarAviso } = a;
  const [seg, setSeg] = useState('mias');
  const hoyIso = isoDia(hoy);

  const base = useMemo(() => filtrarPor(items, seg, uid), [items, seg, uid]);
  const b = useMemo(() => calcBandeja(base, hoy), [base, hoy]);
  const avisosSeg = useMemo(() => (seg === 'equipo' ? [] : avisos.filter((x) => diasEntre(hoy, x.fecha) <= PROXIMOS_DIAS || x.severidad === 'alta' || x.severidad === 'critica')), [avisos, seg, hoy]);
  const reunionesHoy = useMemo(() => reuniones.filter((r) => r.estado !== 'cerrada' && isoDia(new Date(r.fecha)) === hoyIso).sort((x, y) => new Date(x.fecha) - new Date(y.fecha)), [reuniones, hoyIso]);
  const puntosAbiertos = useMemo(() => base.filter((i) => i.tipo === 'punto' && i.estado === 'abierta'), [base]);
  const hechasHoy = useMemo(() => base.filter((i) => i.estado === 'hecha' && i.completado_en && isoDia(new Date(i.completado_en)) === hoyIso).slice(0, 6), [base, hoyIso]);
  const hero = useMemo(() => fraseHero({ b, avisos: avisosSeg, reunionesHoy, equipoRes: [], personasPorId, reuniones, porId, hoy }), [b, avisosSeg, reunionesHoy, personasPorId, reuniones, porId, hoy]);
  const reunionDe = (it) => (it.reunion_id ? reuniones.find((r) => r.id === it.reunion_id) : null);
  const avisosHoy = avisosSeg.filter((x) => diasEntre(hoy, x.fecha) <= 0);
  const avisosProx = avisosSeg.filter((x) => diasEntre(hoy, x.fecha) > 0);
  const proximos = [...b.proximos.map((it) => ({ f: it.fecha_limite, el: fila(it) })), ...avisosProx.map((x) => ({ f: x.fecha, el: <TarjetaAviso key={x.id} aviso={x} hoy={hoy} onNavegar={navegarAviso} style={{ marginBottom: 8 }} /> }))].sort((x, y) => String(x.f).localeCompare(String(y.f)));
  const vacio = !b.vencidas.length && !b.hoy.length && !proximos.length && !b.sinFecha.length && !avisosHoy.length && !reunionesHoy.length;

  function fila(it) {
    const card = <TarjetaItem item={it} personasPorId={personasPorId} porId={porId} hoy={hoy} reunion={reunionDe(it)} onToggle={puedeEditar ? toggle : undefined} onAbrir={abrirItem} />;
    if (!puedeEditar) return <div key={it.id} style={{ marginBottom: 8 }}>{card}</div>;
    return <FilaGesto key={it.id} onDerecha={() => toggle(it, true)} onIzquierda={() => posponer(it, 1)}>{card}</FilaGesto>;
  }

  return (
    <>
      <HeroM eyebrow={`${diaLargo(hoy).replace(/^./, (c) => c.toUpperCase())} · ${nombreCorto(perfil) || 'Agenda'}`} frase={hero.titulo}
        sub={hero.sub || (seg === 'mias' ? 'Lo tuyo de hoy: desliza a la derecha para marcar hecho, a la izquierda para posponer.' : seg === 'equipo' ? 'Lo que trae el equipo (sin lo tuyo).' : 'Todo lo abierto, del equipo y tuyo.')}
        stats={[{ k: 'Hoy', v: hero.nHoy }, { k: 'Vencidas', v: b.vencidas.length, color: b.vencidas.length ? theme.red : undefined }, { k: 'Puntos abiertos', v: puntosAbiertos.length }]} />
      <div style={{ padding: '12px 16px 4px' }}>
        <Segmented size="md" value={seg} onChange={setSeg} options={SEGS} style={{ display: 'flex', width: '100%' }} />
      </div>

      <div style={{ padding: '0 16px' }}>
        {b.vencidas.length > 0 && <><SeccionM tone="red" n={b.vencidas.length}>Vencidas</SeccionM>{b.vencidas.map(fila)}</>}
        <SeccionM n={b.hoy.length + reunionesHoy.length + avisosHoy.length}>Hoy</SeccionM>
        {reunionesHoy.map((r) => <TarjetaReunion key={r.id} reunion={r} items={items} porId={porId} hoy={hoy} onMinuta={abrirMinuta} style={{ marginBottom: 8 }} />)}
        {b.hoy.map(fila)}
        {avisosHoy.map((x) => <TarjetaAviso key={x.id} aviso={x} hoy={hoy} onNavegar={navegarAviso} style={{ marginBottom: 8 }} />)}
        {!b.hoy.length && !reunionesHoy.length && !avisosHoy.length && !vacio && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '2px 4px 8px' }}>Nada con fecha de hoy.</div>}
        {proximos.length > 0 && <><SeccionM n={proximos.length}>Próximos {PROXIMOS_DIAS} días</SeccionM>{proximos.map((x) => x.el)}</>}
        {b.sinFecha.length > 0 && <><SeccionM n={b.sinFecha.length}>Sin fecha</SeccionM>{b.sinFecha.map(fila)}</>}
        {vacio && <Vacio titulo={seg === 'mias' ? 'Nada pendiente para ti' : 'Nada pendiente'} sub="Sin tareas, puntos ni avisos. Captura una tarea con el botón +." />}
        {hechasHoy.length > 0 && (
          <>
            <SeccionM tone="green" n={hechasHoy.length}>Hecho hoy</SeccionM>
            {hechasHoy.map((it) => <div key={it.id} style={{ marginBottom: 8 }}><TarjetaItem item={it} personasPorId={personasPorId} porId={porId} hoy={hoy} onToggle={puedeEditar ? toggle : undefined} onAbrir={abrirItem} compacta /></div>)}
          </>
        )}
        <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, textAlign: 'center', padding: '14px 0 70px', fontFamily: TYPO.fontText }}>{puedeEditar ? '→ hecho · ← posponer a mañana · tocar abre' : 'Sólo lectura'}</div>
      </div>
    </>
  );
}
