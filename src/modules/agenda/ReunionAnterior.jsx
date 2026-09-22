// Agenda web · panel «Reunión anterior ›» dentro de la Minuta (2026-09-21).
// Fernando: «que se pueda abrir una reunión anterior o los puntos que se verán en una reunión próxima».
// Muestra plegado los puntos de la reunión anterior del mismo cliente (estado + hilo de comentarios),
// deja elegir otra del mismo cliente, traer aquí los puntos que quedaron abiertos
// (RPC agenda_traer_puntos vía datos.js#traerPuntosDeReunion) y saltar a la lista de reuniones.
import React, { useMemo, useState } from 'react';
import { ChevronRight, ChevronDown, ArrowDownToLine, ExternalLink } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, Boton, toast } from '../../components/kit';
import { resumenReunion, reunionAnterior, reunionesDeCliente, hiloComentarios, cuando, isoDia, fmtHora } from './calculo';
import { nombreClienteAgenda } from './etiquetas';
import { traerPuntosDeReunion } from './datos';
import { Palomita } from './comun';
import Hilo from './Comentarios';

export default function ReunionAnterior({ reunion, reuniones = [], items = [], porId, comentariosPor, personasPorId, hoy, puedeEditar = false, onAbrirMinuta, onVerTodas }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const [busy, setBusy] = useState(false);
  const anteriores = useMemo(() => reunionesDeCliente(reuniones, reunion.cliente_key).filter((r) => r.id !== reunion.id && new Date(r.fecha) < new Date(reunion.fecha)), [reuniones, reunion]);
  const [elegida, setElegida] = useState(null);
  const previa = useMemo(() => (elegida ? anteriores.find((r) => r.id === elegida) : reunionAnterior(reuniones, reunion)) || null, [elegida, anteriores, reuniones, reunion]);
  const res = useMemo(() => (previa ? resumenReunion(previa, items, porId) : null), [previa, items, porId]);

  if (!previa) {
    return (
      <div style={{ fontSize: 11, color: theme.textMuted, display: 'flex', gap: 8, alignItems: 'center' }}>
        Es la primera reunión con {nombreClienteAgenda(reunion.cliente_key)}.
        {onVerTodas && <span onClick={onVerTodas} style={{ color: theme.accent, cursor: 'pointer' }}>Ver todas las reuniones</span>}
      </div>
    );
  }

  const fPrevia = new Date(previa.fecha);
  const traer = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const n = await traerPuntosDeReunion(reunion.id, previa.id);
      toast.ok(n ? `${n} punto${n === 1 ? '' : 's'} traído${n === 1 ? '' : 's'} a esta reunión` : 'No quedaban puntos abiertos en esa reunión');
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', cursor: 'pointer' }} onClick={() => setAbierto((v) => !v)}>
        {abierto ? <ChevronDown size={14} style={{ color: theme.textMuted }} /> : <ChevronRight size={14} style={{ color: theme.textMuted }} />}
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: theme.text }}>
          Reunión anterior · {cuando(isoDia(fPrevia), hoy)} {fmtHora(fPrevia)}
        </span>
        <Pill tone={res.abiertos.length ? 'orange' : 'green'} size="xs">{res.abiertos.length} abierto{res.abiertos.length === 1 ? '' : 's'} · {res.resueltos.length} resuelto{res.resueltos.length === 1 ? '' : 's'}</Pill>
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: theme.textMuted }}>{previa.titulo}</span>
      </div>

      {abierto && (
        <div style={{ borderTop: `1px solid ${theme.border}`, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {anteriores.length > 1 && (
              <select value={previa.id} onChange={(e) => setElegida(e.target.value)} aria-label="Elegir reunión anterior"
                style={{ border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, padding: '2px 6px', maxWidth: 260 }}>
                {anteriores.map((r) => <option key={r.id} value={r.id}>{cuando(isoDia(new Date(r.fecha)), hoy)} · {r.titulo}</option>)}
              </select>
            )}
            {puedeEditar && reunion.estado !== 'cerrada' && <Boton icon={ArrowDownToLine} onClick={traer} disabled={busy || !res.abiertos.length} title="Copia aquí los puntos que quedaron abiertos">Traer puntos abiertos{res.abiertos.length ? ` · ${res.abiertos.length}` : ''}</Boton>}
            {onAbrirMinuta && <Boton icon={ExternalLink} onClick={() => onAbrirMinuta(previa.id)}>Abrir esa minuta</Boton>}
            {onVerTodas && <Boton onClick={onVerTodas}>Ver todas las reuniones de este cliente</Boton>}
          </div>

          {!res.puntos.length && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Esa reunión no tuvo puntos{previa.notas ? `. Notas: ${String(previa.notas).slice(0, 160)}` : '.'}</div>}
          {res.puntos.map((p) => {
            const hilo = hiloComentarios([], p, porId, { porItem: comentariosPor });
            return (
              <div key={p.id} style={{ borderTop: `1px dashed ${theme.border}`, paddingTop: 6 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <Palomita hecha={p.estado === 'hecha'} size={13} disabled />
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: theme.text, textDecoration: p.estado === 'hecha' ? 'line-through' : 'none' }}>{p.titulo}</span>
                  {p.estado === 'arrastrada' && <Pill tone="gray" size="xs">arrastrado</Pill>}
                  {p.estado === 'abierta' && <Pill tone="orange" size="xs">abierto</Pill>}
                  {hilo.length > 0 && <Pill tone="blue" size="xs">{hilo.length} comentario{hilo.length === 1 ? '' : 's'}</Pill>}
                </div>
                {p.resolucion && <div style={{ fontSize: 11, color: theme.textMuted, paddingLeft: 19 }}>quedó: {p.resolucion}</div>}
                {hilo.length > 0 && <Hilo item={p} hilo={hilo} personasPorId={personasPorId} puedeEditar={false} compacto />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
