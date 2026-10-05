// Agenda V5 · Bandeja: lo capturado sin clasificar. Triage con teclas (J/K moverse · 1 tarea hoy · 2 idea · 3 mañana ·
// H posponer 7 días · X descartar · Enter abrir). Nada pide campos al capturar: se clasifica aquí.
import React, { useEffect, useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Pill, toast } from '../../components/kit';
import { Titulo, Seccion, Avatar } from './comun';
import { bandejaDe, isoDia, sumarDias } from './calculo';
import { triage, posponer, descartar } from './datos';
import { nombreClienteAgenda } from '../agenda/etiquetas';

const K = ({ children }) => { const { theme } = useTheme(); return <kbd style={{ font: `600 10.5px ${TYPO.fontText}`, padding: '1px 6px', borderRadius: 5, background: 'rgba(120,120,128,0.18)', color: theme.text }}>{children}</kbd>; };

export default function Bandeja({ d, uid, propietario, personasPorId, puedeEditar, onAbrirItem, onCapturar }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const lista = useMemo(() => bandejaDe(d.items, propietario, hoy), [d.items, propietario, hoy]);
  const [sel, setSel] = useState(0);
  useEffect(() => { setSel((s) => Math.min(s, Math.max(0, lista.length - 1))); }, [lista.length]);
  const run = (fn, msg) => fn().then(() => msg && toast.ok(msg)).catch((e) => toast.error(e.message));
  const acciones = {
    hoy: (it) => run(() => triage(it, { tipo: it.tipo === 'idea' ? 'tarea' : it.tipo, cuando: isoDia(hoy) }), 'A Hoy'),
    manana: (it) => run(() => triage(it, { tipo: it.tipo === 'idea' ? 'tarea' : it.tipo, cuando: isoDia(sumarDias(hoy, 1)) }), 'A mañana'),
    idea: (it) => run(() => triage(it, { tipo: 'idea' }), 'Guardada como idea'),
    cuandoSea: (it) => run(() => triage(it, { tipo: 'tarea' }), 'A Pendientes (cuando sea)'),
    posponer: (it) => run(() => posponer(it, 7), 'Pospuesta 7 días'),
    descartar: (it) => run(() => descartar(it), 'Descartada'),
  };
  useEffect(() => {
    if (!puedeEditar) return undefined;
    const h = (e) => {
      if (e.target.closest('input, textarea, [contenteditable]')) return;
      const it = lista[sel]; const k = e.key.toLowerCase();
      if (k === 'j' || e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(lista.length - 1, s + 1)); }
      else if (k === 'k' || e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(0, s - 1)); }
      else if (!it) return;
      else if (k === '1') acciones.hoy(it); else if (k === '2') acciones.idea(it); else if (k === '3') acciones.manana(it); else if (k === '4') acciones.cuandoSea(it);
      else if (k === 'h') acciones.posponer(it); else if (k === 'x') acciones.descartar(it); else if (e.key === 'Enter') onAbrirItem?.(it);
    };
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h);
  }, [lista, sel, puedeEditar]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta={lista.length ? `${lista.length} por clasificar · ` : 'Nada por clasificar · '} acciones={<span style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11.5, color: theme.textMuted, flexWrap: 'wrap' }}><K>1</K> hoy <K>2</K> idea <K>3</K> mañana <K>4</K> cuando sea <K>H</K> posponer <K>X</K> descartar <K>↵</K> abrir</span>}>Bandeja</Titulo>
      {lista.length === 0 && <div style={{ padding: '26px 12px', textAlign: 'center', color: theme.textMuted, fontSize: 13 }}>Bandeja vacía. Lo que captures sin fecha cae aquí{puedeEditar ? '; pulsa N para capturar.' : '.'}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {lista.map((it, i) => {
          const on = i === sel; const quien = (it.creado_por && it.creado_por !== propietario) ? personasPorId.get(it.creado_por) : null;
          return (
            <div key={it.id} onClick={() => setSel(i)} onDoubleClick={() => onAbrirItem?.(it)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 12, background: on ? `${theme.accent}12` : theme.surface, border: `1px solid ${on ? theme.accent : 'transparent'}`, cursor: 'pointer', transition: `all ${DUR.state}ms ${EASE}` }}>
              <Pill size="xs" tone={it.tipo === 'idea' ? 'purple' : it.tipo === 'nota' ? 'gray' : 'blue'}>{it.tipo}</Pill>
              <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: theme.text }}>{it.titulo}{it.cliente_key && it.cliente_key !== 'interno' ? <span style={{ color: theme.textMuted }}> · {nombreClienteAgenda(it.cliente_key)}</span> : null}</span>
              {quien && <span title={`Lo mandó ${quien.nombre}`}><Avatar persona={quien} size={20} /></span>}
              <span style={{ fontSize: 11, color: theme.textMuted }}>{String(it.created_at || '').slice(5, 10)}</span>
              {puedeEditar && on && <span style={{ display: 'flex', gap: 4 }} onClick={(e) => e.stopPropagation()}>
                <Pill size="xs" tone="blue" style={{ cursor: 'pointer' }} onClick={() => acciones.hoy(it)}>Hoy</Pill><Pill size="xs" tone="gray" style={{ cursor: 'pointer' }} onClick={() => acciones.manana(it)}>Mañana</Pill><Pill size="xs" tone="purple" style={{ cursor: 'pointer' }} onClick={() => acciones.idea(it)}>Idea</Pill><Pill size="xs" tone="gray" style={{ cursor: 'pointer' }} onClick={() => acciones.cuandoSea(it)}>Cuando sea</Pill><Pill size="xs" tone="orange" style={{ cursor: 'pointer' }} onClick={() => acciones.posponer(it)}>7 d</Pill><Pill size="xs" tone="red" style={{ cursor: 'pointer' }} onClick={() => acciones.descartar(it)}>✕</Pill>
              </span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
