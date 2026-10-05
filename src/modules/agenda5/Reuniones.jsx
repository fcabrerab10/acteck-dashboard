// Agenda V5 · Reuniones como HILO por cliente (Granola / Fellow): a la izquierda los hilos (cliente o interno) con su
// última reunión, la próxima y los acuerdos abiertos; a la derecha el hilo elegido: acuerdos abiertos de todas sus
// reuniones (→ tarea con responsable), las reuniones en orden y «Nueva reunión» que nace con lo que quedó de la anterior
// (la minuta V4 ya trae «Reunión anterior» y «Traer puntos abiertos»; aquí se ve el hilo completo).
import React, { useMemo, useState } from 'react';
import { CalendarPlus, ArrowRight } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { Panel, Pill, Boton, toast } from '../../components/kit';
import { Titulo, Seccion, Palomita, Avatar } from './comun';
import { resumenReunion } from './base/calculo';
import { crearPendienteDePunto, actualizarItem } from './base/datos';
import { nombreClienteAgenda } from './base/etiquetas';

const abierto = (it) => it.estado === 'abierta' || it.estado === 'arrastrada';
const fmt = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' }) + (d.getHours() || d.getMinutes() ? ` ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}` : ''); };

/** Puro: hilos por cliente con su resumen. */
export function hilosDe(reuniones = [], items = [], porId, hoy = new Date()) {
  const m = new Map();
  for (const r of reuniones) {
    if (r.tipo !== 'reunion') continue;
    const k = r.cliente_key || 'interno';
    const h = m.get(k) || { key: k, nombre: nombreClienteAgenda(k), reuniones: [], abiertos: [], ultima: null, proxima: null };
    h.reuniones.push(r);
    const res = resumenReunion(r, items, porId);
    h.abiertos.push(...res.abiertos.map((p) => ({ ...p, _reunion: r })));
    m.set(k, h);
  }
  const ahora = hoy.getTime();
  for (const h of m.values()) {
    h.reuniones.sort((a, b) => new Date(b.fecha) - new Date(a.fecha));
    h.ultima = h.reuniones.find((r) => new Date(r.fecha).getTime() <= ahora) || null;
    h.proxima = [...h.reuniones].reverse().find((r) => new Date(r.fecha).getTime() > ahora && r.estado !== 'cerrada') || null;
    h.abiertos.sort((a, b) => String(a.fecha_limite || '9').localeCompare(String(b.fecha_limite || '9')));
  }
  return [...m.values()].sort((a, b) => b.abiertos.length - a.abiertos.length || new Date(b.ultima?.fecha || 0) - new Date(a.ultima?.fecha || 0));
}

export default function Reuniones({ d, uid, puedeEditar, personasPorId, onAbrirMinuta, onNuevaReunion, onAbrirItem }) {
  const { theme } = useTheme();
  const hoy = useMemo(() => new Date(), []);
  const hilos = useMemo(() => hilosDe(d.reuniones, d.items, d.porId, hoy), [d.reuniones, d.items, d.porId, hoy]);
  const [sel, setSel] = useState(null);
  const hilo = hilos.find((h) => h.key === sel) || hilos[0] || null;
  const aTarea = async (p) => { try { await crearPendienteDePunto(p, {}, d.personas); toast.ok('Pendiente creado desde el acuerdo'); } catch (e) { toast.error(e.message); } };
  const cerrarPunto = async (p, hecha) => { try { await actualizarItem(p.id, hecha ? { estado: 'hecha', completado_en: new Date().toISOString() } : { estado: 'abierta', completado_en: null }); } catch (e) { toast.error(e.message); } };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Titulo meta={`${hilos.length} hilos · ${hilos.reduce((s, h) => s + h.abiertos.length, 0)} acuerdos abiertos`} acciones={puedeEditar && <Boton primario icon={CalendarPlus} onClick={() => onNuevaReunion?.({ cliente_key: hilo?.key || 'interno' })}>Nueva reunión{hilo ? ` · ${hilo.nombre}` : ''}</Boton>}>Reuniones</Titulo>
      <div style={{ display: 'grid', gridTemplateColumns: '250px minmax(0, 1fr)', gap: 12, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {hilos.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted, padding: 10 }}>Sin reuniones aún.</div>}
          {hilos.map((h) => { const on = h.key === hilo?.key; return (
            <button key={h.key} type="button" onClick={() => setSel(h.key)} style={{ textAlign: 'left', border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? `${theme.accent}10` : theme.surface, borderRadius: 11, padding: '9px 11px', cursor: 'pointer', fontFamily: TYPO.fontText, transition: `all ${DUR.state}ms ${EASE}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, fontSize: 13.5, color: theme.text }}>{h.nombre}</span>{h.abiertos.length > 0 && <Pill size="xs" tone="orange">{h.abiertos.length}</Pill>}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{h.reuniones.length} reunión{h.reuniones.length === 1 ? '' : 'es'}{h.ultima ? ` · última ${fmt(h.ultima.fecha)}` : ''}{h.proxima ? ` · próxima ${fmt(h.proxima.fecha)}` : ''}</div>
            </button>); })}
        </div>
        {hilo && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
            <Panel titulo={`Acuerdos abiertos · ${hilo.nombre}`} meta={hilo.abiertos.length ? `${hilo.abiertos.length} de ${hilo.reuniones.length} reuniones · lo que quedó pendiente se arrastra a la siguiente` : 'todo cerrado'}>
              {hilo.abiertos.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted }}>No hay acuerdos pendientes en este hilo.</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {hilo.abiertos.slice(0, 30).map((p) => { const resp = (p.responsables || []).map((u) => personasPorId.get(u)).filter(Boolean); return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 10, background: theme.surface2 || 'rgba(120,120,128,0.06)' }}>
                    <Palomita hecha={false} onClick={() => puedeEditar && cerrarPunto(p, true)} />
                    <span onClick={() => onAbrirItem?.(p)} style={{ flex: 1, minWidth: 0, fontSize: 13, color: theme.text, cursor: 'pointer' }}>{p.titulo}<span style={{ color: theme.textMuted, fontSize: 11 }}> · {fmt(p._reunion.fecha)}{p.fecha_limite ? ` · vence ${p.fecha_limite.slice(5)}` : ''}</span></span>
                    {resp.map((r) => <Avatar key={r.user_id} persona={r} size={18} />)}
                    {puedeEditar && <Boton size="sm" icon={ArrowRight} onClick={() => aTarea(p)} title="Crear pendiente ligado a este acuerdo">Tarea</Boton>}
                  </div>); })}
              </div>
            </Panel>
            <Seccion meta={`${hilo.reuniones.length}`}>Reuniones del hilo</Seccion>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {hilo.reuniones.map((r) => { const res = resumenReunion(r, d.items, d.porId); const futura = new Date(r.fecha) > hoy; return (
                <div key={r.id} onClick={() => onAbrirMinuta?.(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 11, background: theme.surface, border: `1px solid ${futura ? theme.accent : theme.border}`, cursor: 'pointer' }}>
                  <div style={{ minWidth: 0, flex: 1 }}><div style={{ fontSize: 13.5, fontWeight: 600, color: theme.text }}>{r.titulo}</div><div style={{ fontSize: 11, color: theme.textMuted }}>{fmt(r.fecha)}{r.lugar ? ` · ${r.lugar}` : ''}{r.google_event_id ? ' · Google' : ''}</div></div>
                  {futura && <Pill size="xs" tone="blue">próxima</Pill>}
                  {r.estado === 'cerrada' ? <Pill size="xs" tone="gray">cerrada</Pill> : null}
                  <span style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap' }}>{res.abiertos.length} abiertos · {res.resueltos.length} resueltos</span>
                </div>); })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
