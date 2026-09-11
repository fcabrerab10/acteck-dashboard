// Agenda · disposición C "Tablero por etiqueta": columnas por Cliente · Persona · Categoría · Estado (Segmented),
// tarjetas = tareas, puntos, reuniones (botón Minuta) y avisos del sistema; drag & drop nativo (HTML5) entre columnas
// reasigna la etiqueta; zona "Hecho" cierra. Debajo: tira horizontal de reuniones, Semana compacta y Equipo.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, Boton, toast, EASE, DUR } from '../../components/kit';
import { elevation } from '../../lib/elevation';
import { columnasTablero, cambioAlSoltar, MODOS_TABLERO, isoDia, diasEntre, vencido, cuando, vecesArrastrado, ordinal, resumenReunion, sumarDias, inicioSemana } from './calculo';
import { actualizarItem } from './datos';
import { TagCliente, TagPersona, CatPill, FuenteLabel, Filtros, Palomita, TONE_FUENTE } from './comun';
import { CATEGORIAS } from './etiquetas';
import { toneColors } from '../../components/kit';
import Semana from './Semana';
import Equipo from './Equipo';

const SEGS = [{ id: 'abiertas', label: 'Abiertas' }, { id: 'hoy', label: 'Hoy' }, { id: 'semana', label: 'Semana' }, { id: 'todas', label: 'Todas' }];

export default function Tablero(p) {
  const { theme } = useTheme();
  const { items, avisos, reuniones, reunionesOrd, personas, personasPorId, porId, hoy, filtros, setFiltros, filtrar, toggle, abrirItem, abrirMinuta, onNavegar, puedeEditar } = p;
  const [modo, setModo] = useState('cliente');
  const [seg, setSeg] = useState('abiertas');
  const [over, setOver] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);
  const hoyIso = isoDia(hoy);

  const tarjetas = useMemo(() => {
    const finSem = sumarDias(inicioSemana(hoy), 6);
    const pasaSeg = (f) => seg === 'todas' || seg === 'abiertas' || !f || (seg === 'hoy' ? diasEntre(hoy, f) <= 0 : new Date(f) <= finSem);
    const its = filtrar(items.filter((i) => (i.estado === 'abierta' && pasaSeg(i.fecha_limite)) || (seg === 'todas' && i.estado === 'hecha' && i.completado_en && isoDia(new Date(i.completado_en)) === hoyIso))).map((i) => ({ ...i, clave: 'item' }));
    const sinFiltroEtiquetas = !filtros.personas.size && !filtros.categorias.size && !filtros.vencidas;
    const reus = sinFiltroEtiquetas ? reuniones.filter((r) => r.estado !== 'cerrada' && (!filtros.clientes.size || filtros.clientes.has(r.cliente_key || 'interno')) && pasaSeg(isoDia(new Date(r.fecha))) && new Date(r.fecha) >= sumarDias(hoy, -1)).map((r) => ({ clave: 'reunion', id: `r:${r.id}`, ref: r, cliente_key: r.cliente_key, fecha: isoDia(new Date(r.fecha)), responsables: [], categoria: null })) : [];
    const avs = sinFiltroEtiquetas ? avisos.filter((a) => (!filtros.clientes.size || filtros.clientes.has(a.cliente_key || 'interno')) && pasaSeg(a.fecha)).map((a) => ({ ...a, clave: 'sistema', responsables: [], categoria: null })) : [];
    return [...its, ...reus, ...avs];
  }, [items, reuniones, avisos, filtros, filtrar, seg, hoy, hoyIso]);
  const columnas = useMemo(() => columnasTablero(tarjetas, modo, personas, hoy), [tarjetas, modo, personas, hoy]);

  const onDrop = async (e, col) => {
    e.preventDefault(); setOver(null);
    const id = e.dataTransfer.getData('agenda/item'); setArrastrando(null);
    const it = items.find((x) => x.id === id); if (!it) return;
    const cambio = cambioAlSoltar(modo, col.id, { ...it, clave: 'item' });
    if (!cambio) return;
    if (modo === 'persona' && col.id !== '__hecho__' && col.id !== '__sin__') cambio.responsables = [...new Set([...(it.responsables || []).filter((u) => u !== arrastrando?.desde), col.id])];
    try { await actualizarItem(id, cambio, { prevResponsables: it.responsables || [] }); toast.ok(cambio.estado === 'hecha' ? 'Hecho' : `Movido a ${col.label}`); } catch (err) { toast.error(err.message); }
  };
  const abiertas = tarjetas.filter((t) => t.clave === 'item' && t.estado === 'abierta').length;

  return (
    <>
      <Panel titulo="Tablero" meta="agrupar por" padding="0"
        acciones={<><Segmented options={MODOS_TABLERO} value={modo} onChange={setModo} /><Segmented options={SEGS} value={seg} onChange={setSeg} /></>}>
        <Filtros items={items} personas={personas} filtros={filtros} onChange={setFiltros} hoy={hoy} extra={<span style={{ marginLeft: 'auto', fontSize: 10.5, color: theme.textMuted }}>{abiertas} abiertas · {tarjetas.length} tarjetas</span>} />
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(auto-fit, minmax(${columnas.length > 5 ? 200 : 220}px, 1fr))`, gap: 8, padding: 10, alignItems: 'start' }}>
          {columnas.map((col) => {
            const zonaHecho = col.id === '__hecho__' || (modo === 'estado' && col.id === 'hecha');
            const puedeSoltar = puedeEditar && arrastrando && !(modo === 'estado' && col.id === 'vencida');
            return (
              <div key={col.id} onDragOver={puedeSoltar ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setOver(col.id); } : undefined} onDragLeave={() => setOver((o) => (o === col.id ? null : o))} onDrop={puedeSoltar ? (e) => onDrop(e, col) : undefined}
                style={{ background: over === col.id ? (zonaHecho ? toneColors(theme, 'green')[0] : (theme.accentBg || 'rgba(0,122,255,0.08)')) : theme.bg, border: `1px ${zonaHecho ? 'dashed' : 'solid'} ${over === col.id ? theme.accent : theme.border}`, borderRadius: 12, padding: 8, minHeight: zonaHecho ? 72 : 120, display: 'flex', flexDirection: 'column', gap: 6, transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 4px 4px' }}>
                  {col.tag && modo === 'cliente' && <TagCliente clienteKey={col.id} />}
                  {modo === 'persona' && col.id !== '__sin__' && <TagPersona persona={personasPorId.get(col.id)} />}
                  {modo === 'categoria' && col.id !== '__sin__' && <CatPill categoria={col.id} />}
                  <b style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{col.label}</b>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{col.tarjetas.length}</span>
                </div>
                {zonaHecho && !col.tarjetas.length && <div style={{ fontSize: 10.5, color: theme.textMuted, textAlign: 'center', padding: '10px 4px' }}>suelta aquí para cerrar</div>}
                {col.tarjetas.map((t) => <Tarjeta key={`${t.clave}:${t.id}`} t={t} theme={theme} personasPorId={personasPorId} porId={porId} items={items} hoy={hoy} puedeEditar={puedeEditar} colId={col.id} modo={modo}
                  onDragStart={(e) => { e.dataTransfer.setData('agenda/item', t.id); e.dataTransfer.effectAllowed = 'move'; setArrastrando({ id: t.id, desde: modo === 'persona' ? col.id : null }); }} onDragEnd={() => { setArrastrando(null); setOver(null); }}
                  onAbrir={() => (t.clave === 'item' ? abrirItem(t) : t.clave === 'reunion' && t.ref.tipo === 'reunion' ? abrirMinuta(t.ref) : null)} onToggle={toggle} onMinuta={abrirMinuta} onNavegar={onNavegar} />)}
              </div>
            );
          })}
        </div>
      </Panel>

      <Panel titulo="Reuniones" meta="tarjetas en el tiempo · clic abre la minuta · lo abierto se arrastra a la siguiente del mismo cliente" padding="8px 10px">
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4 }}>
          {reunionesOrd.filter((r) => r.tipo === 'reunion').slice(0, 12).map((r) => {
            const res = resumenReunion(r, items, porId);
            const esHoy = isoDia(new Date(r.fecha)) === hoyIso;
            return (
              <div key={r.id} onClick={() => abrirMinuta(r)} style={{ minWidth: 190, border: `1px solid ${esHoy || r.estado === 'en_curso' ? theme.accent : theme.border}`, borderRadius: 10, padding: '8px 10px', background: theme.bg, cursor: 'pointer', fontSize: 10.5, color: theme.textMuted, flexShrink: 0 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{cuando(isoDia(new Date(r.fecha)), hoy)} {new Date(r.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {r.cliente_key === 'interno' || !r.cliente_key ? 'Interna' : r.cliente_key.toUpperCase()}</div>
                <div style={{ fontFamily: TYPO.fontDisplay, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.lugar ? `${r.lugar} · ` : ''}{r.estado === 'cerrada' ? `${res.resueltos.length} resueltos${res.arrastradosFuera.length ? ` · ${res.arrastradosFuera.length} arrastrado${res.arrastradosFuera.length === 1 ? '' : 's'}` : ''}` : r.estado === 'en_curso' ? 'en curso' : `${res.abiertos.length} abierto${res.abiertos.length === 1 ? '' : 's'}${res.arrastradosAqui.length ? ` · ${res.arrastradosAqui.length} arrastrado${res.arrastradosAqui.length === 1 ? '' : 's'}` : ''}`}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 5, flexWrap: 'wrap' }}>
                  {CATEGORIAS.filter((c) => res.porCategoria.get(c.id)).map((c) => <Pill key={c.id} tone={c.tone} size="xs" title={c.label}>{res.porCategoria.get(c.id)}</Pill>)}
                  {res.porCategoria.get('__sin__') && <Pill tone="gray" size="xs" title="sin categoría">{res.porCategoria.get('__sin__')}</Pill>}
                </div>
              </div>
            );
          })}
          {!reunionesOrd.some((r) => r.tipo === 'reunion') && <div style={{ fontSize: 12, color: theme.textMuted, padding: 6 }}>Sin reuniones todavía. Crea una con «＋ Reunión».</div>}
        </div>
      </Panel>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 10, alignItems: 'start' }}>
        <Semana {...p} compacta />
        <Equipo {...p} />
      </div>
    </>
  );
}

function Tarjeta({ t, theme, personasPorId, porId, hoy, puedeEditar, onDragStart, onDragEnd, onAbrir, onToggle, onMinuta, onNavegar, items }) {
  const [hover, setHover] = useState(false);
  const esItem = t.clave === 'item';
  const venc = esItem && vencido(t, hoy);
  const hecha = esItem && t.estado === 'hecha';
  const borde = venc ? theme.red : t.clave === 'reunion' ? theme.purple || theme.indigo : t.clave === 'sistema' ? theme.orange : 'transparent';
  const n = esItem ? vecesArrastrado(t, porId) : 0;
  const base = { background: t.clave === 'sistema' ? theme.bg : theme.surface, border: `1px solid ${theme.border}`, borderLeft: `3px solid ${borde === 'transparent' ? theme.border : borde}`, borderRadius: 10, padding: '7px 9px', boxShadow: elevation(theme, hover ? 'hover' : 'reposo'), fontSize: 11.5, display: 'flex', flexDirection: 'column', gap: 4, cursor: esItem && puedeEditar ? 'grab' : 'pointer', opacity: hecha ? 0.55 : 1, transition: `box-shadow ${DUR.state}ms ${EASE}`, fontFamily: TYPO.fontText };
  if (t.clave === 'reunion') {
    const r = t.ref; const res = resumenReunion(r, items, porId);
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onAbrir} style={base}>
        <div style={{ fontWeight: 500, color: theme.text, lineHeight: 1.3 }}>{r.tipo === 'evento' ? 'Evento' : 'Reunión'} {cuando(t.fecha, hoy)} {new Date(r.fecha).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })} · {r.titulo}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', color: theme.textMuted, fontSize: 10 }}>
          {r.google_event_id && <Pill tone="blue" size="xs">Google</Pill>}
          {r.tipo === 'reunion' && <span>{res.abiertos.length} punto{res.abiertos.length === 1 ? '' : 's'} abierto{res.abiertos.length === 1 ? '' : 's'}{res.arrastradosAqui.length ? ` · ${res.arrastradosAqui.length} arrastrado${res.arrastradosAqui.length === 1 ? '' : 's'}` : ''}</span>}
          {r.tipo === 'reunion' && <Boton size="sm" onClick={(e) => { e.stopPropagation(); onMinuta(r); }} style={{ height: 20, padding: '0 8px', fontSize: 10.5 }}>{res.arrastradosAqui.length && r.estado === 'programada' ? 'Preparar' : 'Minuta'}</Boton>}
        </div>
      </div>
    );
  }
  if (t.clave === 'sistema') {
    return (
      <div onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} style={{ ...base, cursor: 'default' }}>
        <div style={{ fontWeight: 500, color: theme.text, lineHeight: 1.3 }}>{t.titulo}</div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', color: theme.textMuted, fontSize: 10 }}>
          <FuenteLabel fuente={t.fuente} /><span>{cuando(t.fecha, hoy)}</span>
          {t.severidad && (t.severidad === 'alta' || t.severidad === 'critica') && <Pill tone={t.severidad === 'critica' ? 'red' : 'orange'} size="xs" dot>{t.severidad}</Pill>}
          {t.accion && onNavegar && <Boton size="sm" onClick={() => onNavegar(t.accion.clienteKey ?? null, t.accion.pagina, { aviso: t })} style={{ height: 20, padding: '0 8px', fontSize: 10.5 }}>{t.accion.label}</Boton>}
        </div>
      </div>
    );
  }
  return (
    <div draggable={puedeEditar} onDragStart={onDragStart} onDragEnd={onDragEnd} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)} onClick={onAbrir} style={base}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <div style={{ paddingTop: 2 }}><Palomita hecha={hecha} onClick={() => onToggle(t, !hecha)} size={13} /></div>
        <div style={{ fontWeight: 500, color: theme.text, lineHeight: 1.3, textDecoration: hecha ? 'line-through' : 'none', flex: 1 }}>{t.titulo}</div>
      </div>
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center', color: theme.textMuted, fontSize: 10 }}>
        {t.tipo === 'punto' && <Pill tone="gray" size="xs">punto</Pill>}
        {(t.responsables || []).map((u) => <TagPersona key={u} persona={personasPorId.get(u)} />)}
        <CatPill categoria={t.categoria} />
        {t.fecha_limite && <span style={{ color: venc ? theme.red : theme.textMuted, fontWeight: venc ? 600 : 400 }}>{venc ? `vencida ${cuando(t.fecha_limite, hoy)}` : cuando(t.fecha_limite, hoy)}</span>}
        {n > 0 && <Pill tone="orange" size="xs">{ordinal(n)}</Pill>}
        {hecha && <span>✓ hoy</span>}
      </div>
      {n >= 2 && <div style={{ height: 3, borderRadius: 2, background: theme.border, overflow: 'hidden' }}><i style={{ display: 'block', height: '100%', width: `${Math.min(100, 30 * (n + 1))}%`, background: theme.orange }} /></div>}
    </div>
  );
}
