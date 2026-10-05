// Agenda V4 · pestaña Pendientes: captura en una línea arriba + bloques por horizonte
// (Vencidos · Hoy · Esta semana · Más adelante · Sin fecha).
//
// Lo que YA NO sale aquí (decisión de Fernando, 2026-09-21): las alertas de SKUs / inventario /
// ventas de la tabla `alertas`. Inundaban la bandeja y tapaban los pendientes reales; viven en la
// campana (BandejaAlertas / centro de notificaciones). Aquí sólo hay agenda_items.
import React, { useMemo, useState } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, Boton, toast } from '../../components/kit';
import { CampoEtiquetas, FilaPendiente, Seccion, Vacio, TONE_CLIENTE } from './comun';
import { porHorizonte, isoDia, sumarDias, cuando } from './calculo';
import { parsearEtiquetas, fechaNatural, nombreClienteAgenda } from './etiquetas';
import { crearItem } from './datos';

/** Selector de a quién le veo los pendientes. 'mios' · 'todos' · <user_id> de cada compañero. */
export function opcionesQuien(personas, uid) {
  return [
    { id: 'mios', label: 'Mis pendientes' },
    { id: 'todos', label: 'Todos' },
    ...personas.filter((p) => p.user_id !== uid).map((p) => ({ id: p.user_id, label: (p.nombre || '').split(' ')[0] || p.handle })),
  ];
}

/** Filtra por el selector de arriba (sin tocar los filtros de cliente). */
export function filtrarQuien(items, quien, uid) {
  if (quien === 'todos') return items;
  const objetivo = quien === 'mios' ? uid : quien;
  if (!objetivo) return items;
  return items.filter((it) => (it.responsables || []).includes(objetivo));
}

export default function Pendientes({ items, personas, personasPorId, porId, reuniones, hoy, uid, progreso, puedeEditar, onAbrir, onToggle, onPosponer }) {
  const { theme } = useTheme();
  const [quien, setQuien] = useState('mios');
  const [clientes, setClientes] = useState(() => new Set());
  const [q, setQ] = useState('');
  const [texto, setTexto] = useState('');
  const [busy, setBusy] = useState(false);

  const abiertos = useMemo(() => items.filter((i) => i.estado === 'abierta'), [items]);
  const porQuien = useMemo(() => filtrarQuien(abiertos, quien, uid), [abiertos, quien, uid]);
  const conteoCliente = useMemo(() => {
    const m = new Map();
    for (const it of porQuien) { const k = it.cliente_key || 'interno'; m.set(k, (m.get(k) || 0) + 1); }
    return [...m.entries()].sort((a, b) => b[1] - a[1]);
  }, [porQuien]);
  const visibles = useMemo(() => porQuien.filter((it) =>
    (!clientes.size || clientes.has(it.cliente_key || 'interno'))
    && (!q || `${it.titulo} ${it.notas || ''}`.toLowerCase().includes(q.toLowerCase()))), [porQuien, clientes, q]);
  const bloques = useMemo(() => porHorizonte(visibles, hoy), [visibles, hoy]);

  // ── Captura en una línea ──
  const nat = useMemo(() => fechaNatural(texto, hoy), [texto, hoy]);
  const p = useMemo(() => parsearEtiquetas(nat.texto, personas), [nat.texto, personas]);
  const crear = async () => {
    const t = p.titulo.trim();
    if (!t || busy) return;
    setBusy(true);
    try {
      await crearItem({ texto: nat.texto || texto, tipo: 'tarea', fecha_limite: nat.fecha || null, hora: nat.hora || null, origen: { fuente: 'captura' } }, personas);
      setTexto('');
      toast.ok(nat.fecha ? `Pendiente para ${cuando(nat.fecha, hoy)}` : 'Pendiente creado');
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  const toggleCliente = (k) => setClientes((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const reunionDe = (it) => (it.reunion_id ? reuniones.find((r) => r.id === it.reunion_id) : null);
  const total = bloques.reduce((n, b) => n + b.items.length, 0);

  return (
    <Panel titulo="Pendientes" meta={`${total} abierto${total === 1 ? '' : 's'} · lo vencido primero`} padding="0"
      acciones={<Segmented options={opcionesQuien(personas, uid)} value={quien} onChange={setQuien} />}>

      {puedeEditar && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '9px 12px', borderBottom: `1px solid ${theme.border}` }}>
          <CampoEtiquetas value={texto} onChange={setTexto} personas={personas} size="md" autoFocus={false}
            placeholder="Mandar propuesta a CT mañana @karolina #ct" onEnter={crear} />
          <Boton icon={Plus} primario size="md" onClick={crear} disabled={!p.titulo.trim() || busy}>Agregar</Boton>
        </div>
      )}
      {puedeEditar && texto.trim() && (
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', padding: '6px 12px', borderBottom: `1px solid ${theme.border}`, fontSize: 10.5, color: theme.textMuted }}>
          <span>Entendí:</span>
          <Pill tone="gray" size="xs">{p.titulo || '(sin título)'}</Pill>
          <Pill tone={nat.fecha ? 'blue' : 'gray'} size="xs">{nat.fecha ? `${cuando(nat.fecha, hoy)}${nat.hora ? ` · ${nat.hora}` : ''}` : 'sin fecha'}</Pill>
          {p.cliente_key && <Pill tone={TONE_CLIENTE[p.cliente_key] || 'gray'} size="xs">#{p.cliente_key}</Pill>}
          {p.responsables.map((u) => <Pill key={u} tone="blue" size="xs">@{personasPorId.get(u)?.handle || '…'}</Pill>)}
          {p.categoria && <Pill tone="purple" size="xs">/{p.categoria}</Pill>}
          {p.desconocidas.length > 0 && <span style={{ color: theme.orange }}>{p.desconocidas.join(' ')} no está en el equipo</span>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', padding: '8px 12px', borderBottom: `1px solid ${theme.border}` }}>
        <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 999, padding: '3px 10px', minWidth: 180 }}>
          <Search size={12} style={{ color: theme.textMuted }} />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="buscar en los pendientes" style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text, flex: 1, minWidth: 0 }} />
          {q && <X size={12} style={{ color: theme.textMuted, cursor: 'pointer' }} onClick={() => setQ('')} />}
        </label>
        {conteoCliente.map(([k, n]) => {
          const on = clientes.has(k);
          return <Pill key={k} tone={on ? (TONE_CLIENTE[k] === 'gray' ? 'inverse' : TONE_CLIENTE[k] || 'inverse') : 'gray'} onClick={() => toggleCliente(k)}
            title={nombreClienteAgenda(k)} style={{ cursor: 'pointer', border: on ? 'none' : `1px solid ${theme.border}` }}>#{k} · {n}</Pill>;
        })}
        {clientes.size > 0 && <Pill tone="gray" onClick={() => setClientes(new Set())} style={{ cursor: 'pointer' }}><X size={10} /> limpiar</Pill>}
      </div>

      {bloques.map((b) => (
        <React.Fragment key={b.id}>
          <Seccion tone={b.tone} n={b.items.length}>{b.label}</Seccion>
          {b.items.map((it) => (
            <FilaPendiente key={it.id} item={it} personasPorId={personasPorId} porId={porId} hoy={hoy} progreso={progreso?.get(it.id)}
              reunion={reunionDe(it)} puedeEditar={puedeEditar} onToggle={onToggle} onAbrir={onAbrir} onPosponer={onPosponer}
              onFiltrarCliente={(k) => setClientes(new Set([k]))} />
          ))}
          {!b.items.length && b.id === 'hoy' && <div style={{ padding: '6px 12px 10px', fontSize: 11.5, color: theme.textMuted }}>Nada con fecha de hoy.</div>}
        </React.Fragment>
      ))}
      {!total && <Vacio>Nada abierto {quien === 'mios' ? 'para ti' : ''} 🎉 · captura arriba en una línea.</Vacio>}
      <div style={{ height: 6 }} />
    </Panel>
  );
}

/** Nueva fecha al posponer N días desde HOY (no desde la fecha vieja: "mañana" es mañana). */
export const fechaPospuesta = (hoy, dias) => isoDia(sumarDias(hoy, dias));
