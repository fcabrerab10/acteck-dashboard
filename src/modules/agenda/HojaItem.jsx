// Agenda · hoja lateral de una tarea o punto: título con etiquetas, notas, fecha/hora, prioridad, estado,
// "en qué quedó", reunión de origen (abre la minuta), veces arrastrado, borrar.
import React, { useState } from 'react';
import { Trash2, Check, CalendarDays } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { HojaLateral, Grupo, Fila } from '../../components/perfil/comun';
import { Pill, Boton, Segmented, toast } from '../../components/kit';
import { guardarItemDesdeTexto, actualizarItem, borrarItem } from './datos';
import { textoConEtiquetas, nombreClienteAgenda } from './etiquetas';
import { vecesArrastrado, ordinal, cuando, isoDia } from './calculo';
import { PRIORIDAD_LABEL, ESTADO_LABEL } from './textos';
import { CampoEtiquetas, TagCliente, TagPersona, CatPill } from './comun';
import { relativo } from '../../lib/format';

export default function HojaItem({ item, personas, personasPorId, porId, reuniones, hoy, puedeEditar, onClose, onAbrirMinuta }) {
  const { theme } = useTheme();
  const [texto, setTexto] = useState(() => textoConEtiquetas(item, personas));
  const [notas, setNotas] = useState(item.notas || '');
  const [quedo, setQuedo] = useState(item.resolucion || '');
  const reunion = item.reunion_id ? reuniones.find((r) => r.id === item.reunion_id) : null;
  const n = vecesArrastrado(item, porId);
  const original = item.arrastrado_desde ? porId.get(item.arrastrado_desde) : null;
  const reunionOriginal = original?.reunion_id ? reuniones.find((r) => r.id === original.reunion_id) : null;

  const guardar = async (cambios) => { try { await actualizarItem(item.id, cambios, { prevResponsables: item.responsables || [] }); } catch (e) { toast.error(e.message); } };
  const guardarTitulo = async () => { if (texto.trim() === textoConEtiquetas(item, personas)) return; try { await guardarItemDesdeTexto(item, texto, personas); toast.ok('Guardado'); } catch (e) { toast.error(e.message); } };
  const borrar = async () => { if (!window.confirm('¿Eliminar este ítem? No se puede deshacer.')) return; try { await borrarItem(item.id); onClose(); toast.ok('Eliminado'); } catch (e) { toast.error(e.message); } };
  const campo = { border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: '5px 8px', outline: 'none' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, marginBottom: 6, display: 'block' };

  return (
    <HojaLateral abierto onClose={onClose} theme={theme} ancho={480} titulo={item.tipo === 'punto' ? 'Punto de reunión' : 'Tarea'} sub={`${ESTADO_LABEL[item.estado]}${item.fecha_limite ? ` · ${cuando(item.fecha_limite, hoy)}` : ''}${item.created_at ? ` · creada ${relativo(item.created_at)}` : ''}`}
      acciones={puedeEditar && <Boton icon={item.estado === 'hecha' ? undefined : Check} primario={item.estado !== 'hecha'} onClick={() => guardar(item.estado === 'hecha' ? { estado: 'abierta', completado_en: null } : { estado: 'hecha', completado_en: new Date().toISOString() })}>{item.estado === 'hecha' ? 'Reabrir' : 'Hecha'}</Boton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 4px 24px', fontFamily: TYPO.fontText }}>
        <div>
          <span style={lbl}>Título · #cliente @persona /categoría</span>
          {puedeEditar ? <CampoEtiquetas value={texto} onChange={setTexto} personas={personas} size="md" onEnter={guardarTitulo} onBlur={guardarTitulo} /> : <div style={{ fontSize: 14, fontWeight: 500 }}>{item.titulo}</div>}
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 8, alignItems: 'center' }}>
            <TagCliente clienteKey={item.cliente_key} size="sm" />
            {(item.responsables || []).map((u) => <TagPersona key={u} persona={personasPorId.get(u)} size="sm" />)}
            {!(item.responsables || []).length && <Pill tone="orange">sin responsable</Pill>}
            <CatPill categoria={item.categoria} size="sm" />
            {n > 0 && <Pill tone="orange" title="Veces arrastrado">{ordinal(n)}</Pill>}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>Fecha límite</span><input type="date" value={item.fecha_limite || ''} disabled={!puedeEditar} onChange={(e) => guardar({ fecha_limite: e.target.value || null })} style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
          <div><span style={lbl}>Hora</span><input type="time" value={item.hora ? String(item.hora).slice(0, 5) : ''} disabled={!puedeEditar} onChange={(e) => guardar({ hora: e.target.value || null })} style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <div><span style={lbl}>Prioridad</span><Segmented value={item.prioridad || 'media'} onChange={(v) => puedeEditar && guardar({ prioridad: v })} options={Object.entries(PRIORIDAD_LABEL).map(([id, label]) => ({ id, label }))} /></div>
          <div><span style={lbl}>Estado</span><Segmented value={item.estado} onChange={(v) => puedeEditar && guardar(v === 'hecha' ? { estado: v, completado_en: new Date().toISOString() } : { estado: v, completado_en: null })} options={[{ id: 'abierta', label: 'Abierto' }, { id: 'hecha', label: 'Resuelto' }, { id: 'cancelada', label: 'Cancelado' }, ...(item.estado === 'arrastrada' ? [{ id: 'arrastrada', label: 'Arrastrado', disabled: true }] : [])]} /></div>
          <div style={{ flex: 1, minWidth: 140 }}><span style={lbl}>Hoy</span><Boton icon={CalendarDays} onClick={() => guardar({ fecha_limite: isoDia(hoy) })} disabled={!puedeEditar || item.fecha_limite === isoDia(hoy)}>Para hoy</Boton></div>
        </div>

        <div>
          <span style={lbl}>En qué quedó</span>
          <input value={quedo} readOnly={!puedeEditar} onChange={(e) => setQuedo(e.target.value)} onBlur={() => quedo !== (item.resolucion || '') && guardar({ resolucion: quedo || null })} placeholder="nota corta al resolver" style={{ ...campo, width: '100%', boxSizing: 'border-box' }} />
        </div>
        <div>
          <span style={lbl}>Notas</span>
          <textarea value={notas} readOnly={!puedeEditar} onChange={(e) => setNotas(e.target.value)} onBlur={() => notas !== (item.notas || '') && guardar({ notas: notas || null })} rows={5} style={{ ...campo, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.45 }} />
        </div>

        {(reunion || original) && (
          <Grupo theme={theme}>
            {reunion && <Fila theme={theme} primera label={`Reunión · ${reunion.titulo}`} sub={`${nombreClienteAgenda(reunion.cliente_key)} · ${cuando(isoDia(new Date(reunion.fecha)), hoy)}`} onClick={reunion.tipo === 'reunion' ? () => onAbrirMinuta(reunion.id) : undefined}><Pill tone="blue">Abrir minuta</Pill></Fila>}
            {original && <Fila theme={theme} primera={!reunion} label="Arrastrado desde" sub={`${reunionOriginal ? `${reunionOriginal.titulo} · ${cuando(isoDia(new Date(reunionOriginal.fecha)), hoy)}` : 'reunión anterior'} · ${n + 1} reuniones sin cerrarse`} onClick={reunionOriginal ? () => onAbrirMinuta(reunionOriginal.id) : undefined} />}
          </Grupo>
        )}
        {item.origen && (item.origen.categoria_original || item.origen.responsable_texto || item.origen.fuente) && (
          <div style={{ fontSize: 10.5, color: theme.textMuted }}>Origen: {[item.origen.fuente, item.origen.categoria_original && `categoría original «${item.origen.categoria_original}»`, item.origen.responsable_texto && `responsable «${item.origen.responsable_texto}»`].filter(Boolean).join(' · ')}{item.migrado_de ? ` · migrado de ${item.migrado_de.tabla}` : ''}</div>
        )}
        {puedeEditar && <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 6 }}><Boton icon={Trash2} peligro onClick={borrar}>Eliminar</Boton></div>}
      </div>
    </HojaLateral>
  );
}
