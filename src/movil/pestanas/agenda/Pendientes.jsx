// Agenda móvil V4 · Pendientes: captura en una línea arriba + bloques por horizonte
// (Vencidos · Hoy · Esta semana · Más adelante · Sin fecha). Gestos: deslizar a la derecha = hecho,
// a la izquierda = posponer a mañana (con deshacer en el toast); tocar abre la hoja del pendiente.
// Aquí NO salen las alertas de SKUs: viven en la campana (decisión de Fernando, 2026-09-21).
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { porHorizonte, cuando } from '../../../modules/agenda/calculo';
import { parsearEtiquetas, fechaNatural } from '../../../modules/agenda/etiquetas';
import { crearItem } from '../../../modules/agenda/datos';
import { HeroM, Segmented, Vacio, Pill, toast } from '../../piezas';
import { nombreCorto, diaLargo } from '../../util';
import { useAgenda } from './Agenda';
import { FilaGesto, TarjetaItem, SeccionM, ChipM, CampoM } from './comun';

export default function Pendientes() {
  const { theme } = useTheme();
  const a = useAgenda();
  const { items, reuniones, personas, personasPorId, porId, progreso, hoy, uid, puedeEditar, perfil, abrirItem, toggle, posponer } = a;
  const [quien, setQuien] = useState('mios');
  const [cliente, setCliente] = useState(null);
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);

  // Míos · Karolina · Todos (David Millán no entra a la Agenda: `personas` ya viene sin él, ver
  // CORREOS_SIN_AGENDA en etiquetas.js). El orden lo pidió Fernando: primero yo, luego el equipo.
  const opciones = useMemo(() => [
    { id: 'mios', label: 'Míos' },
    ...personas.filter((p) => p.user_id !== uid).map((p) => ({ id: p.user_id, label: (p.nombre || '').split(' ')[0] })),
    { id: 'todos', label: 'Todos' },
  ], [personas, uid]);

  const abiertos = useMemo(() => items.filter((i) => i.estado === 'abierta'), [items]);
  const porQuien = useMemo(() => (quien === 'todos' ? abiertos : abiertos.filter((it) => (it.responsables || []).includes(quien === 'mios' ? uid : quien))), [abiertos, quien, uid]);
  const clientesConteo = useMemo(() => {
    const m = new Map();
    for (const it of porQuien) { const k = it.cliente_key || 'interno'; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((x, y) => y[1] - x[1]);
  }, [porQuien]);
  const visibles = useMemo(() => (cliente ? porQuien.filter((it) => (it.cliente_key || 'interno') === cliente) : porQuien), [porQuien, cliente]);
  const bloques = useMemo(() => porHorizonte(visibles, hoy), [visibles, hoy]);
  const total = bloques.reduce((n, b) => n + b.items.length, 0);
  const venc = bloques.find((b) => b.id === 'vencidos')?.items.length || 0;
  const deHoy = bloques.find((b) => b.id === 'hoy')?.items.length || 0;

  const nat = useMemo(() => fechaNatural(texto, hoy), [texto, hoy]);
  const p = useMemo(() => parsearEtiquetas(nat.texto, personas), [nat.texto, personas]);
  const crear = async () => {
    if (!p.titulo.trim() || busy) return;
    setBusy(true);
    try {
      await crearItem({ texto: nat.texto || texto, tipo: 'tarea', fecha_limite: nat.fecha || null, hora: nat.hora || null, origen: { fuente: 'movil' } }, personas);
      setTexto('');
      toast.ok(nat.fecha ? `Pendiente para ${cuando(nat.fecha, hoy)}` : 'Pendiente creado');
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const reunionDe = (it) => (it.reunion_id ? reuniones.find((r) => r.id === it.reunion_id) : null);
  const fila = (it) => {
    const pr = progreso?.get(it.id);
    const card = (
      <div style={{ position: 'relative' }}>
        <TarjetaItem item={it} personasPorId={personasPorId} porId={porId} hoy={hoy} reunion={reunionDe(it)} onToggle={puedeEditar ? toggle : undefined} onAbrir={abrirItem} />
        {pr?.total > 0 && <span style={{ position: 'absolute', right: 10, bottom: 8, fontFamily: TYPO.fontDisplay, fontSize: 10.5, fontWeight: 600, color: pr.completo ? theme.green : theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{pr.hechas}/{pr.total}</span>}
      </div>
    );
    if (!puedeEditar) return <div key={it.id} style={{ marginBottom: 8 }}>{card}</div>;
    return <FilaGesto key={it.id} onDerecha={() => toggle(it, true)} onIzquierda={() => posponer(it, 1)}>{card}</FilaGesto>;
  };

  return (
    <>
      <HeroM eyebrow={`${diaLargo(hoy).replace(/^./, (c) => c.toUpperCase())} · ${nombreCorto(perfil) || 'Agenda'}`}
        frase={venc || deHoy ? `${venc ? `${venc} vencido${venc === 1 ? '' : 's'} y ` : ''}${deHoy} para hoy` : 'Nada pendiente para hoy'}
        sub={puedeEditar ? 'Desliza a la derecha para marcar hecho, a la izquierda para posponer.' : 'Sólo lectura.'}
        stats={[{ k: 'Hoy', v: deHoy }, { k: 'Vencidos', v: venc, color: venc ? theme.red : undefined }, { k: 'Abiertos', v: total }]} />

      {puedeEditar && (
        <div style={{ padding: '12px 16px 0', display: 'flex', gap: 8, alignItems: 'center' }}>
          <CampoM value={texto} onChange={setTexto} onEnter={crear} placeholder="Mandar propuesta a CT mañana @karolina #ct" autoCapitalize="sentences" />
          <button type="button" onClick={crear} disabled={!p.titulo.trim() || busy} aria-label="Agregar pendiente"
            style={{ width: 40, height: 40, borderRadius: 999, flexShrink: 0, border: 0, background: p.titulo.trim() ? theme.accent : theme.border, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Plus size={20} /></button>
        </div>
      )}
      {puedeEditar && texto.trim() && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', padding: '8px 16px 0', fontSize: 11, color: theme.textMuted, alignItems: 'center' }}>
          <Pill tone={nat.fecha ? 'blue' : 'gray'} size="xs">{nat.fecha ? `${cuando(nat.fecha, hoy)}${nat.hora ? ` · ${nat.hora}` : ''}` : 'sin fecha'}</Pill>
          {p.cliente_key && <Pill tone="green" size="xs">#{p.cliente_key}</Pill>}
          {p.responsables.map((u) => <Pill key={u} tone="blue" size="xs">@{personasPorId.get(u)?.handle || '…'}</Pill>)}
          {p.desconocidas.length > 0 && <span style={{ color: theme.orange }}>{p.desconocidas.join(' ')} no está en el equipo</span>}
        </div>
      )}

      <div style={{ padding: '12px 16px 4px' }}>
        <Segmented size="md" value={quien} onChange={setQuien} options={opciones} style={{ display: 'flex', width: '100%' }} />
      </div>
      {clientesConteo.length > 1 && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '4px 16px 0', scrollbarWidth: 'none' }}>
          {clientesConteo.map(([k, n]) => <ChipM key={k} on={cliente === k} tone="green" onClick={() => setCliente(cliente === k ? null : k)} style={{ flexShrink: 0 }}>#{k} · {n}</ChipM>)}
        </div>
      )}

      <div style={{ padding: '0 16px 80px' }}>
        {bloques.map((b) => (
          <React.Fragment key={b.id}>
            <SeccionM tone={b.tone} n={b.items.length}>{b.label}</SeccionM>
            {b.items.map(fila)}
            {!b.items.length && b.id === 'hoy' && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: '2px 4px 8px' }}>Nada con fecha de hoy.</div>}
          </React.Fragment>
        ))}
        {!total && <Vacio titulo={quien === 'mios' ? 'Nada pendiente para ti' : 'Nada pendiente'} sub="Captura arriba en una línea: «Llamar a CVA mañana»." />}
      </div>
    </>
  );
}
