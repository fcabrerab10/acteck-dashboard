// Agenda · Reuniones: línea del tiempo (Panel) con filtro por cliente y por categoría, cada reunión con sus puntos
// (estado con clic, categoría, responsable, fecha, "en qué quedó"); botón Preparar en la próxima reunión con arrastrados.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, Boton, toast } from '../../components/kit';
import { resumenReunion, cuando, isoDia, vecesArrastrado, ordinal, fmtHora } from './calculo';
import { CATEGORIAS, CATEGORIA_LABEL, nombreClienteAgenda } from './etiquetas';
import { actualizarItem, prepararReunion } from './datos';
import { TagCliente, TagPersona, CatPill, Palomita } from './comun';

const CLIENTES_SEG = [{ id: 'todas', label: 'Todas' }, { id: 'pcel', label: '#pcel' }, { id: 'digitalife', label: '#digitalife' }, { id: 'dicotech', label: '#dicotech' }, { id: 'interno', label: 'Internas' }];
const MAX = 8;

export default function Reuniones({ id, reunionesOrd, items, personasPorId, porId, hoy, abrirMinuta, editarReunion, nuevaReunion, puedeEditar, abrirItem }) {
  const { theme } = useTheme();
  const [cli, setCli] = useState('todas');
  const [cat, setCat] = useState('todas');
  const [soloAbiertos, setSoloAbiertos] = useState(false);
  const [verTodas, setVerTodas] = useState(false);
  const lista = useMemo(() => reunionesOrd.filter((r) => (cli === 'todas' || (r.cliente_key || 'interno') === cli)), [reunionesOrd, cli]);
  const visibles = verTodas ? lista : lista.slice(0, MAX);
  const hoyIso = isoDia(hoy);

  const togglePunto = async (p) => {
    if (!puedeEditar) return;
    const hecha = p.estado !== 'hecha';
    try { await actualizarItem(p.id, hecha ? { estado: 'hecha', completado_en: new Date().toISOString() } : { estado: 'abierta', completado_en: null }); } catch (e) { toast.error(e.message); }
  };
  const preparar = async (r) => { try { const n = await prepararReunion(r.id); toast.ok(n ? `${n} punto${n === 1 ? '' : 's'} arrastrado${n === 1 ? '' : 's'} a esta reunión` : 'Nada pendiente de reuniones anteriores'); abrirMinuta(r); } catch (e) { toast.error(e.message); } };

  return (
    <Panel id={id} titulo="Reuniones" meta="línea del tiempo · puntos con estado · lo abierto se arrastra a la siguiente del mismo cliente" padding="10px 12px"
      acciones={<>
        <Segmented options={CLIENTES_SEG} value={cli} onChange={setCli} />
        <Segmented options={[{ id: 'todas', label: 'Todo' }, ...CATEGORIAS.map((c) => ({ id: c.id, label: c.corto }))]} value={cat} onChange={setCat} />
        <Segmented options={[{ id: 'todo', label: 'Todo' }, { id: 'abiertos', label: 'Abiertos' }]} value={soloAbiertos ? 'abiertos' : 'todo'} onChange={(v) => setSoloAbiertos(v === 'abiertos')} />
      </>}>
      {!visibles.length && <div style={{ fontSize: 12, color: theme.textMuted, padding: '6px 0' }}>Sin reuniones{cli !== 'todas' ? ' con este cliente' : ''}. {puedeEditar && <span onClick={() => nuevaReunion?.({})} style={{ color: theme.accent, cursor: 'pointer' }}>Crear una</span>}</div>}
      {visibles.map((r) => {
        const res = resumenReunion(r, items, porId);
        const puntos = res.puntos.filter((p) => (cat === 'todas' || p.categoria === cat) && (!soloAbiertos || p.estado === 'abierta'));
        const f = new Date(r.fecha); const iso = isoDia(f); const esHoy = iso === hoyIso; const pasada = r.estado === 'cerrada' || f < hoy;
        const esEvento = r.tipo === 'evento';
        return (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '110px 18px minmax(0, 1fr)', gap: 8 }}>
            <div style={{ textAlign: 'right', paddingTop: 6 }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: esHoy ? theme.accent : theme.text }}>{esHoy ? `Hoy ${fmtHora(f)}` : `${cuando(iso, hoy)}${!pasada || r.estado !== 'cerrada' ? ` ${fmtHora(f)}` : ''}`}</div>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, color: theme.textMuted }}>{nombreClienteAgenda(r.cliente_key)}{r.lugar ? ` · ${r.lugar}` : ''}</div>
            </div>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 2, background: theme.border }} />
              <span style={{ position: 'absolute', left: 4, top: 9, width: 10, height: 10, borderRadius: 999, background: r.estado === 'cerrada' ? theme.textMuted : esEvento ? theme.purple || theme.indigo : theme.accent, border: `2px solid ${theme.surface}` }} />
            </div>
            <div style={{ border: `1px solid ${esHoy || r.estado === 'en_curso' ? theme.accent : theme.border}`, borderRadius: 10, background: theme.bg, padding: '8px 10px', marginBottom: 10, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                <b style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, color: theme.text, cursor: 'pointer' }} onClick={() => (esEvento ? editarReunion?.(r) : abrirMinuta(r))}>{r.titulo}</b>
                <TagCliente clienteKey={r.cliente_key} />
                {esEvento && <Pill tone="purple" size="xs">evento</Pill>}
                {r.google_event_id && <Pill tone="blue" size="xs">Google</Pill>}
                {r.estado === 'en_curso' && <Pill tone="blue" size="xs" dot>en curso</Pill>}
                {r.estado === 'cerrada' && !esEvento && <Pill tone="green" size="xs">{res.resueltos.length} resuelto{res.resueltos.length === 1 ? '' : 's'}</Pill>}
                {res.arrastradosFuera.length > 0 && <Pill tone="orange" size="xs">{res.arrastradosFuera.length} arrastrado{res.arrastradosFuera.length === 1 ? '' : 's'}</Pill>}
                {r.estado !== 'cerrada' && !esEvento && res.abiertos.length > 0 && <Pill tone="orange" size="xs">{res.abiertos.length} abierto{res.abiertos.length === 1 ? '' : 's'}{res.resueltos.length ? ` · ${res.resueltos.length} resuelto${res.resueltos.length === 1 ? '' : 's'}` : ''}</Pill>}
                {res.sinResponsable > 0 && r.estado !== 'cerrada' && <Pill tone="gray" size="xs">{res.sinResponsable} sin responsable</Pill>}
                <span style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {!esEvento && r.estado !== 'cerrada' && res.arrastradosAqui.length > 0 && !pasada && <Boton size="sm" onClick={() => abrirMinuta(r)} style={{ height: 22, fontSize: 10.5 }}>Preparar · {res.arrastradosAqui.length}</Boton>}
                  {!esEvento && r.estado !== 'cerrada' && !res.arrastradosAqui.length && puedeEditar && <Boton size="sm" onClick={() => preparar(r)} style={{ height: 22, fontSize: 10.5 }} title="Traer los puntos abiertos de reuniones anteriores con este cliente">Preparar</Boton>}
                  {!esEvento && <Boton size="sm" primario={esHoy || r.estado === 'en_curso'} onClick={() => abrirMinuta(r)} style={{ height: 22, fontSize: 10.5 }}>{r.estado === 'cerrada' ? 'Ver minuta' : 'Abrir minuta'}</Boton>}
                  {esEvento && puedeEditar && <Boton size="sm" onClick={() => editarReunion?.(r)} style={{ height: 22, fontSize: 10.5 }}>Editar</Boton>}
                </span>
              </div>
              {puntos.map((p) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '5px 0', borderTop: `1px dashed ${theme.border}`, fontSize: 11.5, marginTop: 4 }}>
                  <div style={{ paddingTop: 2 }}><Palomita hecha={p.estado === 'hecha'} onClick={() => togglePunto(p)} size={14} disabled={!puedeEditar || p.estado === 'arrastrada'} title={p.estado === 'arrastrada' ? 'Se arrastró a la siguiente reunión' : undefined} /></div>
                  <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => abrirItem?.(p)}>
                    <div style={{ color: theme.text, textDecoration: p.estado === 'hecha' ? 'line-through' : 'none', opacity: p.estado === 'arrastrada' ? 0.6 : 1 }}>{p.titulo}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 1, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                      {p.estado === 'hecha' && <span>Resuelto{p.responsables?.[0] ? ` por @${personasPorId.get(p.responsables[0])?.handle || ''}` : ''}{p.completado_en ? ` · ${cuando(isoDia(new Date(p.completado_en)), hoy)}` : ''}{p.resolucion ? ` — ${p.resolucion}` : ''}</span>}
                      {p.estado === 'arrastrada' && <span>Arrastrado a la siguiente reunión</span>}
                      {p.estado === 'abierta' && !(p.responsables || []).length && <span style={{ color: theme.orange }}>Sin responsable · asignar</span>}
                      {p.estado === 'abierta' && p.resolucion && <span>{p.resolucion}</span>}
                      {p.fecha_limite && p.estado === 'abierta' && <span>{cuando(p.fecha_limite, hoy)}</span>}
                      {vecesArrastrado(p, porId) > 0 && <Pill tone="orange" size="xs">{ordinal(vecesArrastrado(p, porId))}</Pill>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    <CatPill categoria={p.categoria} />
                    {(p.responsables || []).slice(0, 2).map((u) => <TagPersona key={u} persona={personasPorId.get(u)} />)}
                  </div>
                </div>
              ))}
              {!puntos.length && !esEvento && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{res.puntos.length ? 'Sin puntos con ese filtro' : r.notas ? String(r.notas).slice(0, 140) : 'Sin puntos aún'}</div>}
              {esEvento && r.notas && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>{String(r.notas).slice(0, 140)}</div>}
            </div>
          </div>
        );
      })}
      {lista.length > MAX && <div style={{ textAlign: 'center' }}><Boton onClick={() => setVerTodas((v) => !v)}>{verTodas ? 'Ver menos' : `Ver las ${lista.length} reuniones`}</Boton></div>}
    </Panel>
  );
}
