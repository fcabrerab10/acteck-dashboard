// Agenda V4 · pestaña Archivados: lo hecho y lo cancelado, con buscador, fecha de cierre y
// «Desarchivar» (vuelve a estado 'abierta' y reaparece en Pendientes).
// Se cargan los últimos 120 días de ítems cerrados (DIAS_HISTORIAL_HECHAS en datos.js).
import React, { useMemo, useState } from 'react';
import { Search, X, RotateCcw } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, Boton, toast } from '../../components/kit';
import { Vacio, TagCliente, CatPill, Avatar, ProgresoPill } from './comun';
import { archivados, cuando, isoDia } from './calculo';
import { actualizarItem } from './datos';

const SEGS = [{ id: 'todo', label: 'Todo' }, { id: 'hecha', label: 'Hechos' }, { id: 'cancelada', label: 'Cancelados' }];

export default function Archivados({ items, personasPorId, hoy, progreso, puedeEditar, onAbrir }) {
  const { theme } = useTheme();
  const [q, setQ] = useState('');
  const [seg, setSeg] = useState('todo');

  const lista = useMemo(() => archivados(items, { q, personasPorId }).filter((it) => seg === 'todo' || it.estado === seg), [items, q, personasPorId, seg]);
  const desarchivar = async (it) => {
    try { await actualizarItem(it.id, { estado: 'abierta', completado_en: null }); toast.ok('Devuelto a Pendientes'); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <Panel titulo="Archivados" meta={`${lista.length} ítem${lista.length === 1 ? '' : 's'} · últimos 120 días`} padding="0"
      acciones={<Segmented options={SEGS} value={seg} onChange={setSeg} />}>
      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}` }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 999, padding: '3px 10px', minWidth: 240 }}>
          <Search size={12} style={{ color: theme.textMuted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar en lo archivado · #cliente · @persona"
            style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text, flex: 1, minWidth: 0 }} />
          {q && <X size={12} style={{ color: theme.textMuted, cursor: 'pointer' }} onClick={() => setQ('')} />}
        </label>
      </div>
      {lista.map((it) => {
        const cerrado = it.completado_en || it.updated_at;
        return (
          <div key={it.id} onClick={() => onAbrir?.(it)}
            style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 12px', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', fontFamily: TYPO.fontText }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: theme.textMuted, textDecoration: 'line-through', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.titulo}</div>
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 2, fontSize: 10.5, color: theme.textMuted }}>
                <Pill tone={it.estado === 'hecha' ? 'green' : 'gray'} size="xs">{it.estado === 'hecha' ? 'hecho' : 'cancelado'}</Pill>
                <span>{cerrado ? `cerrado ${cuando(isoDia(new Date(cerrado)), hoy)}` : 'sin fecha de cierre'}</span>
                <TagCliente clienteKey={it.cliente_key} />
                <CatPill categoria={it.categoria} />
                {it.tipo === 'punto' && <Pill tone="gray" size="xs">punto</Pill>}
              </div>
            </div>
            <ProgresoPill progreso={progreso?.get(it.id)} />
            <div style={{ display: 'flex', gap: 3, flexShrink: 0 }}>
              {(it.responsables || []).map((u) => <Avatar key={u} persona={personasPorId?.get(u)} size={20} />)}
            </div>
            {puedeEditar && <Boton icon={RotateCcw} onClick={(e) => { e.stopPropagation(); desarchivar(it); }} title="Volver a abrirlo">Desarchivar</Boton>}
          </div>
        );
      })}
      {!lista.length && <Vacio>{q ? 'Nada archivado coincide con esa búsqueda.' : 'Todavía no has archivado nada. Palomea un pendiente y aparecerá aquí.'}</Vacio>}
      <div style={{ height: 6 }} />
    </Panel>
  );
}
