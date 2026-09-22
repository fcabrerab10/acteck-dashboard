// Agenda V4 · checklist de subtareas de un pendiente (hoja del ítem, web y móvil comparten datos).
// Regla de Fernando (2026-09-21): terminar todas las subtareas NO tacha la actividad grande;
// sólo aparece el aviso «todas las subtareas listas · ¿marcar como hecho?» con su botón.
import React, { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Check } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, Boton, toast } from '../../components/kit';
import { Palomita, IconBtn } from './comun';
import { subtareasDe, progresoSubtareas } from './calculo';
import { crearSubtarea, marcarSubtarea, borrarSubtarea, moverSubtarea, actualizarSubtarea } from './datos';

export default function Subtareas({ item, subtareas = [], puedeEditar, onMarcarHecho, compacto = false }) {
  const { theme } = useTheme();
  const lista = subtareasDe(subtareas, item.id);
  const p = progresoSubtareas(lista);
  const [nueva, setNueva] = useState('');
  const [busy, setBusy] = useState(false);

  const agregar = async () => {
    const t = nueva.trim();
    if (!t || busy) return;
    setBusy(true);
    try { await crearSubtarea(item.id, t, lista.length); setNueva(''); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const marcar = async (s) => { try { await marcarSubtarea(s, !s.hecha); } catch (e) { toast.error(e.message); } };
  const renombrar = async (s, titulo) => { if (titulo.trim() && titulo.trim() !== s.titulo) { try { await actualizarSubtarea(s.id, { titulo: titulo.trim() }); } catch (e) { toast.error(e.message); } } };
  const borrar = async (s) => { try { await borrarSubtarea(s.id); } catch (e) { toast.error(e.message); } };
  const mover = async (s, d) => { try { await moverSubtarea(lista, s.id, d); } catch (e) { toast.error(e.message); } };

  const campo = { border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: '5px 8px', outline: 'none' };
  const abiertoElPadre = item.estado === 'abierta';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600 }}>Subtareas</span>
        {p.total > 0 && <Pill tone={p.completo ? 'green' : 'gray'} size="xs" style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' }}>{`${p.hechas}/${p.total}`}</Pill>}
      </div>
      {p.total > 0 && (
        <div style={{ height: 4, borderRadius: 999, background: `${theme.text}12`, overflow: 'hidden' }}>
          <i style={{ display: 'block', height: '100%', width: `${p.pct}%`, borderRadius: 999, background: p.completo ? theme.green : theme.accent }} />
        </div>
      )}
      {lista.map((s) => (
        <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0' }}>
          <Palomita hecha={s.hecha} disabled={!puedeEditar} size={14} onClick={() => marcar(s)} />
          {puedeEditar
            ? <input defaultValue={s.titulo} onBlur={(e) => renombrar(s, e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                style={{ ...campo, flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: '2px 0', textDecoration: s.hecha ? 'line-through' : 'none', color: s.hecha ? theme.textMuted : theme.text }} />
            : <span style={{ flex: 1, fontSize: 12.5, textDecoration: s.hecha ? 'line-through' : 'none', color: s.hecha ? theme.textMuted : theme.text }}>{s.titulo}</span>}
          {puedeEditar && !compacto && (
            <>
              <IconBtn icon={ChevronUp} title="Subir" onClick={() => mover(s, -1)} />
              <IconBtn icon={ChevronDown} title="Bajar" onClick={() => mover(s, 1)} />
              <IconBtn icon={Trash2} tone="red" title="Eliminar subtarea" onClick={() => borrar(s)} />
            </>
          )}
          {puedeEditar && compacto && <IconBtn icon={Trash2} tone="red" title="Eliminar subtarea" onClick={() => borrar(s)} />}
        </div>
      ))}
      {!lista.length && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Sin subtareas. Parte el pendiente en pasos para ver el avance.</div>}
      {puedeEditar && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          <input value={nueva} onChange={(e) => setNueva(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); agregar(); } }}
            placeholder="Agregar paso…" style={{ ...campo, flex: 1, minWidth: 0 }} />
          <Boton icon={Plus} onClick={agregar} disabled={!nueva.trim() || busy}>Agregar</Boton>
        </div>
      )}
      {p.completo && abiertoElPadre && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 10, border: `1px solid ${theme.green}55`, background: `${theme.green}14`, marginTop: 4 }}>
          <span style={{ flex: 1, fontSize: 11.5, color: theme.text }}>Todas las subtareas listas · ¿marcar como hecho?</span>
          {puedeEditar && <Boton icon={Check} primario onClick={onMarcarHecho}>Marcar hecho</Boton>}
        </div>
      )}
    </div>
  );
}
