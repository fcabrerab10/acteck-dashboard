// Agenda · disposición A "Bandeja Hoy": lista Vencidas / Hoy / Próximos (tareas, puntos abiertos y avisos del
// sistema) con Segmented Hoy · Semana · Todo, filtros por etiqueta; a la derecha Semana compacta y Equipo.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { Panel, Segmented } from '../../components/kit';
import { FilaItem, FilaAviso, Filtros, Seccion, Vacio } from './comun';
import { segmento, isoDia, diasEntre, PROXIMOS_DIAS } from './calculo';
import Semana from './Semana';
import Equipo from './Equipo';

const SEGS = [{ id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'todo', label: 'Todo' }];

export default function Bandeja(p) {
  const { theme } = useTheme();
  const { items, avisos, reuniones, personas, personasPorId, porId, hoy, filtros, setFiltros, filtrar, toggle, abrirItem, onNavegar, abrirMinuta } = p;
  const [seg, setSeg] = useState('hoy');
  const hoyIso = isoDia(hoy);

  const lista = useMemo(() => filtrar(segmento(items, seg, hoy)), [items, seg, hoy, filtrar]);
  const avisosSeg = useMemo(() => {
    const aplica = (a) => (!filtros.clientes.size || filtros.clientes.has(a.cliente_key || 'interno')) && (!filtros.q || String(`${a.titulo} ${a.sub || ''}`).toLowerCase().includes(filtros.q.toLowerCase())) && !filtros.personas.size && !filtros.categorias.size && !filtros.vencidas;
    return avisos.filter((a) => aplica(a) && (seg === 'todo' || (seg === 'semana' ? diasEntre(hoy, a.fecha) <= 7 : diasEntre(hoy, a.fecha) <= 1 || a.severidad === 'alta' || a.severidad === 'critica')));
  }, [avisos, seg, hoy, filtros]);
  const vencidas = lista.filter((it) => it.fecha_limite && diasEntre(hoy, it.fecha_limite) < 0);
  const deHoy = lista.filter((it) => it.fecha_limite && diasEntre(hoy, it.fecha_limite) === 0);
  const proximos = lista.filter((it) => it.fecha_limite && diasEntre(hoy, it.fecha_limite) > 0);
  const sinFecha = lista.filter((it) => !it.fecha_limite);
  const reunionDe = (it) => (it.reunion_id ? reuniones.find((r) => r.id === it.reunion_id) : null);
  const reunionesHoy = reuniones.filter((r) => r.estado !== 'cerrada' && isoDia(new Date(r.fecha)) === hoyIso);
  const filaItem = (it) => <FilaItem key={it.id} item={it} personasPorId={personasPorId} porId={porId} hoy={hoy} onToggle={toggle} onAbrir={abrirItem} reunion={reunionDe(it)}
    onFiltrarPersona={(u) => setFiltros({ ...filtros, personas: new Set([u]) })} onFiltrarCliente={(c) => setFiltros({ ...filtros, clientes: new Set([c]) })} />;
  const vacio = !vencidas.length && !deHoy.length && !proximos.length && !sinFecha.length && !avisosSeg.length && !reunionesHoy.length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.35fr) minmax(300px, 1fr)', gap: 10, alignItems: 'start' }}>
      <Panel titulo="Hoy" meta="tareas, puntos de reunión y avisos del dashboard" padding="0" acciones={<Segmented options={SEGS} value={seg} onChange={setSeg} />}>
        <Filtros items={items} personas={personas} filtros={filtros} onChange={setFiltros} hoy={hoy} />
        {vencidas.length > 0 && <><Seccion tone="red" n={vencidas.length}>Vencidas</Seccion>{vencidas.map(filaItem)}</>}
        <Seccion n={deHoy.length + avisosSeg.filter((a) => a.fecha === hoyIso).length + reunionesHoy.length}>Hoy</Seccion>
        {reunionesHoy.map((r) => <FilaAviso key={r.id} hoy={hoy} aviso={{ id: r.id, fuente: r.google_event_id ? 'Google' : 'Reunión', titulo: `${r.tipo === 'evento' ? 'Evento' : 'Reunión'} ${r.cliente_key && r.cliente_key !== 'interno' ? r.cliente_key.toUpperCase() : 'interna'} · ${r.titulo}`, sub: `${r.lugar || ''} ${new Date(r.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · ${r.duracion_min} min`, cliente_key: r.cliente_key, fecha: hoyIso, accion: r.tipo === 'reunion' ? { label: 'Abrir minuta' } : null }} onNavegar={r.tipo === 'reunion' ? () => abrirMinuta(r) : undefined} />)}
        {deHoy.map(filaItem)}
        {avisosSeg.filter((a) => a.fecha === hoyIso || a.fecha < hoyIso).map((a) => <FilaAviso key={a.id} aviso={a} onNavegar={onNavegar} hoy={hoy} />)}
        {(proximos.length > 0 || avisosSeg.some((a) => a.fecha > hoyIso)) && <><Seccion n={proximos.length + avisosSeg.filter((a) => a.fecha > hoyIso).length}>{seg === 'hoy' ? `Próximos ${PROXIMOS_DIAS} días` : 'Próximos'}</Seccion>
          {[...proximos.map((it) => ({ f: it.fecha_limite, el: filaItem(it) })), ...avisosSeg.filter((a) => a.fecha > hoyIso).map((a) => ({ f: a.fecha, el: <FilaAviso key={a.id} aviso={a} onNavegar={onNavegar} hoy={hoy} /> }))].sort((a, b) => a.f.localeCompare(b.f)).map((x) => x.el)}</>}
        {sinFecha.length > 0 && <><Seccion n={sinFecha.length}>Sin fecha</Seccion>{sinFecha.map(filaItem)}</>}
        {vacio && <Vacio>Nada pendiente {seg === 'hoy' ? 'para hoy' : seg === 'semana' ? 'esta semana' : ''} 🎉</Vacio>}
        <div style={{ height: 6 }} />
      </Panel>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
        <Semana {...p} compacta />
        <Equipo {...p} />
      </div>
    </div>
  );
}
