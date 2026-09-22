// Agenda móvil V4 · Archivados: lo hecho y lo cancelado (últimos 120 días) con buscador,
// fecha de cierre y "Desarchivar" (vuelve a Pendientes). Deslizar a la derecha desarchiva.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { RotateCcw } from 'lucide-react';
import { archivados, cuando, isoDia } from '../../../modules/agenda/calculo';
import { actualizarItem } from '../../../modules/agenda/datos';
import { CampoBusqueda, Vacio, Pill, toast } from '../../piezas';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { FilaGesto, TagCliente, CatPill, SeccionM } from './comun';

export default function Archivados() {
  const { theme } = useTheme();
  const { items, personasPorId, progreso, hoy, puedeEditar, abrirItem } = useAgenda();
  const [q, setQ] = useState('');
  const lista = useMemo(() => archivados(items, { q, personasPorId }), [items, q, personasPorId]);

  const desarchivar = async (it) => {
    try { await actualizarItem(it.id, { estado: 'abierta', completado_en: null }); toast.ok('Devuelto a Pendientes'); }
    catch (e) { toast.error(e.message); }
  };

  const fila = (it) => {
    const cerrado = it.completado_en || it.updated_at;
    const pr = progreso?.get(it.id);
    const card = (
      <div onClick={() => abrirItem?.(it)} role="button"
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, fontFamily: TYPO.fontText, cursor: 'pointer' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 500, color: theme.textMuted, textDecoration: 'line-through', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{it.titulo}</div>
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 5, fontSize: 11, color: theme.textMuted }}>
            <Pill tone={it.estado === 'hecha' ? 'green' : 'gray'} size="xs">{it.estado === 'hecha' ? 'hecho' : 'cancelado'}</Pill>
            <TagCliente clienteKey={it.cliente_key} />
            <CatPill categoria={it.categoria} />
            {pr?.total > 0 && <span style={{ fontFamily: MONO }}>{pr.hechas}/{pr.total}</span>}
          </div>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap' }}>{cerrado ? cuando(isoDia(new Date(cerrado)), hoy) : '—'}</span>
      </div>
    );
    if (!puedeEditar) return <div key={it.id} style={{ marginBottom: 8 }}>{card}</div>;
    return <FilaGesto key={it.id} onDerecha={() => desarchivar(it)} labelDerecha="Reabrir" iconoDerecha={RotateCcw}>{card}</FilaGesto>;
  };

  return (
    <>
      <div style={{ padding: '4px 16px 8px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="buscar en lo archivado" /></div>
      <div style={{ padding: '0 16px 80px' }}>
        <SeccionM n={lista.length}>Archivados · últimos 120 días</SeccionM>
        {lista.map(fila)}
        {!lista.length && <Vacio titulo={q ? 'Nada coincide' : 'Todavía no archivas nada'} sub="Palomea un pendiente y aparecerá aquí." />}
      </div>
    </>
  );
}
