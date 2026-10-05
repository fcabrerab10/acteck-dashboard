// Agenda V5 · Pendientes: por horizonte (Vencidos · Hoy · Próximos 7 · Después · Cuando sea · Algún día) o por
// área → proyecto (Things). Captura en línea arriba. Las ideas y notas no están aquí (viven en Ideas).
import React, { useMemo, useState } from 'react';
import { FolderPlus } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Segmented, Boton, Pill, toast } from '../../components/kit';
import { FilaTarea, Titulo, Seccion } from './comun';
import { pendientesDe, porProyecto } from './calculo';
import { completarItem, crearProyecto, crearArea, actualizarItem } from './datos';

const H = [['vencidos', 'Vencidos'], ['hoy', 'Hoy'], ['proximos', 'Próximos 7 días'], ['despues', 'Más adelante'], ['cuandoSea', 'Cuando sea'], ['algunDia', 'Algún día']];

export default function Pendientes({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const [vista, setVista] = useState('horizonte');
  const g = useMemo(() => pendientesDe(d.items, propietario, hoy), [d.items, propietario, hoy]);
  const areasMias = useMemo(() => d.areas.filter((a) => a.propietario === propietario), [d.areas, propietario]);
  const proyMios = useMemo(() => d.proyectos.filter((p) => p.propietario === propietario && p.estado !== 'cerrado'), [d.proyectos, propietario]);
  const arbol = useMemo(() => porProyecto(d.items, proyMios, areasMias, propietario), [d.items, proyMios, areasMias, propietario]);
  const total = Object.values(g).reduce((s, l) => s + l.length, 0);
  const toggle = (it, hecha) => completarItem(it, hecha).catch((e) => toast.error(e.message));
  const nuevoProyecto = async (area) => { const n = window.prompt(`Nuevo proyecto${area ? ` en ${area.nombre}` : ''}:`); if (!n) return; try { await crearProyecto(n.trim(), { area_id: area?.id || null, propietario }); toast.ok('Proyecto creado'); } catch (e) { toast.error(e.message); } };
  const nuevaArea = async () => { const n = window.prompt('Nueva área (p. ej. Digitalife, Equipo, Personal):'); if (!n) return; try { await crearArea(n.trim(), { propietario }); toast.ok('Área creada'); } catch (e) { toast.error(e.message); } };
  const soltar = (e, destino) => { const id = e.dataTransfer.getData('agenda/item'); if (!id) return; actualizarItem(id, destino).catch((err) => toast.error(err.message)); };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta={`${total} abiertos`} acciones={<div style={{ display: 'flex', gap: 8 }}><Segmented size="sm" value={vista} onChange={setVista} options={[{ id: 'horizonte', label: 'Por fecha' }, { id: 'proyectos', label: 'Áreas y proyectos' }]} />{puedeEditar && vista === 'proyectos' && <Boton icon={FolderPlus} onClick={nuevaArea}>Área</Boton>}</div>}>Pendientes</Titulo>
      {vista === 'horizonte' && H.map(([k, label]) => g[k].length > 0 && (
        <div key={k}><Seccion meta={`${g[k].length}`}>{label}</Seccion><div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{g[k].map((it) => <FilaTarea key={it.id} item={it} personasPorId={personasPorId} uid={uid} onToggle={toggle} onAbrir={onAbrirItem} mostrarFecha={k !== 'hoy'} />)}</div></div>
      ))}
      {vista === 'horizonte' && total === 0 && <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Sin pendientes abiertos.</div>}
      {vista === 'proyectos' && arbol.map((a, i) => (
        <div key={a.area?.id || 'sin'} style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: '8px 10px', background: theme.surface }}
          onDragOver={puedeEditar ? (e) => e.preventDefault() : undefined} onDrop={puedeEditar && a.area ? (e) => soltar(e, { area_id: a.area.id, proyecto_id: null }) : undefined}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 10, height: 10, borderRadius: 5, background: a.area?.color || theme.textMuted }} />
            <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 14, color: theme.text }}>{a.area?.nombre || 'Sin área'}</span>
            <span style={{ fontSize: 11.5, color: theme.textMuted }}>{a.abiertos} abiertos</span>
            {puedeEditar && a.area && <Boton size="sm" style={{ marginLeft: 'auto' }} onClick={() => nuevoProyecto(a.area)}>+ proyecto</Boton>}
          </div>
          {a.proyectos.map((p) => (
            <div key={p.proyecto.id} style={{ marginTop: 8, paddingLeft: 10, borderLeft: `2px solid ${a.area?.color || theme.border}` }} onDragOver={puedeEditar ? (e) => { e.preventDefault(); e.stopPropagation(); } : undefined} onDrop={puedeEditar ? (e) => { e.stopPropagation(); soltar(e, { proyecto_id: p.proyecto.id, area_id: a.area?.id || null }); } : undefined}>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, margin: '2px 0 4px', display: 'flex', gap: 8, alignItems: 'center' }}>{p.proyecto.nombre} <Pill size="xs" tone="gray">{p.items.length}</Pill>{p.proyecto.revisar_cada_dias ? <span style={{ fontSize: 10.5, color: theme.textMuted, fontWeight: 400 }}>revisar cada {p.proyecto.revisar_cada_dias} d</span> : null}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>{p.items.map((it) => <div key={it.id} draggable={puedeEditar} onDragStart={(e) => { e.dataTransfer.setData('agenda/item', it.id); }}><FilaTarea item={it} personasPorId={personasPorId} uid={uid} onToggle={toggle} onAbrir={onAbrirItem} mostrarFecha compacta /></div>)}{!p.items.length && <div style={{ fontSize: 11.5, color: theme.textMuted, padding: '2px 8px' }}>sin pendientes · arrastra uno aquí</div>}</div>
            </div>
          ))}
          {a.sueltos.length > 0 && <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 3 }}>{a.sueltos.map((it) => <div key={it.id} draggable={puedeEditar} onDragStart={(e) => { e.dataTransfer.setData('agenda/item', it.id); }}><FilaTarea item={it} personasPorId={personasPorId} uid={uid} onToggle={toggle} onAbrir={onAbrirItem} mostrarFecha compacta /></div>)}</div>}
        </div>
      ))}
      {vista === 'proyectos' && <div style={{ fontSize: 11, color: theme.textMuted, padding: '0 4px' }}>Arrastra un pendiente a un área o a un proyecto para moverlo. Las áreas son permanentes; los proyectos terminan.</div>}
    </div>
  );
}
