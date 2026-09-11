// Agenda móvil · Reuniones: línea del tiempo (próximas arriba, pasadas abajo) con filtro por cliente; tarjeta con
// conteos, "Abrir minuta" en la de hoy / en curso, "Preparar" (arrastrados) en la próxima; crear reunión desde "+"
// (hoja con título, cliente, fecha/hora, duración, lugar y asistentes → crearReunion, que arrastra lo abierto).
import React, { useMemo, useState } from 'react';
import { Plus, Check } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { ordenarReuniones, resumenReunion, cuando, isoDia, fmtHora, vecesArrastrado, ordinal } from '../../../modules/agenda/calculo';
import { CLIENTES_AGENDA, nombreClienteAgenda } from '../../../modules/agenda/etiquetas';
import { LUGARES } from '../../../modules/agenda/textos';
import { crearReunion, prepararReunion } from '../../../modules/agenda/datos';
import { Segmented, Pill, HojaM, BotonGrande, Vacio, toast } from '../../piezas';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { CatPill, ChipM, CampoM, lbl, primerNombre, FAB } from './comun';

const CLIENTES_SEG = [{ id: 'todas', label: 'Todas' }, { id: 'pcel', label: '#pcel' }, { id: 'digitalife', label: '#digitalife' }, { id: 'dicotech', label: '#dicotech' }, { id: 'interno', label: 'Internas' }];
const MAX = 12;

export default function Reuniones() {
  const { theme } = useTheme();
  const a = useAgenda();
  const { items, reuniones, personas, personasPorId, porId, hoy, puedeEditar, abrirMinuta, abrirItem } = a;
  const [cli, setCli] = useState('todas');
  const [verTodas, setVerTodas] = useState(false);
  const [form, setForm] = useState(false);
  const ord = useMemo(() => ordenarReuniones(reuniones, hoy).filter((r) => cli === 'todas' || (r.cliente_key || 'interno') === cli), [reuniones, hoy, cli]);
  const visibles = verTodas ? ord : ord.slice(0, MAX);
  const hoyIso = isoDia(hoy);
  const preparar = async (r) => { try { const n = await prepararReunion(r.id); toast.ok(n ? `${n} punto${n === 1 ? '' : 's'} arrastrado${n === 1 ? '' : 's'} a esta reunión` : 'Nada pendiente de reuniones anteriores'); abrirMinuta(r); } catch (e) { toast.error(e.message); } };

  return (
    <>
      <div style={{ padding: '0 16px 10px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        <Segmented size="md" value={cli} onChange={setCli} options={CLIENTES_SEG} />
      </div>
      <div style={{ padding: '0 16px 80px' }}>
        {!visibles.length && <Vacio titulo="Sin reuniones" sub={puedeEditar ? 'Crea la primera con el botón +.' : 'Nada programado con este cliente.'} />}
        {visibles.map((r, i) => {
          const res = resumenReunion(r, items, porId);
          const f = new Date(r.fecha); const iso = isoDia(f); const esHoy = iso === hoyIso;
          const pasada = r.estado === 'cerrada' || (f < hoy && !esHoy);
          const esEvento = r.tipo === 'evento';
          const activa = esHoy || r.estado === 'en_curso';
          const puntosVer = (r.estado === 'cerrada' ? [...res.abiertos, ...res.arrastradosFuera] : res.abiertos).slice(0, 3);
          return (
            <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '16px 1fr', gap: 10 }}>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', left: 7, top: 0, bottom: 0, width: 2, background: theme.border, borderRadius: i === 0 ? '2px 2px 0 0' : 0 }} />
                <span style={{ position: 'absolute', left: 2, top: 12, width: 12, height: 12, borderRadius: 999, background: pasada ? theme.textMuted : esEvento ? theme.purple || theme.indigo : theme.accent, border: `2px solid ${theme.bg}`, boxShadow: activa ? `0 0 0 3px ${theme.accent}33` : 'none' }} />
              </div>
              <div onClick={() => (esEvento ? null : abrirMinuta(r))} role="button" style={{ background: theme.surface, border: `1px solid ${activa ? theme.accent : theme.border}`, borderRadius: 12, padding: '10px 12px', marginBottom: 10, fontFamily: TYPO.fontText, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <b style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: esHoy ? theme.accent : theme.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{esHoy ? 'Hoy' : cuando(iso, hoy).replace(/^./, (c) => c.toUpperCase())} {fmtHora(f)} · {nombreClienteAgenda(r.cliente_key)}</b>
                  {esEvento && <Pill tone="purple" size="xs">evento</Pill>}
                </div>
                <div style={{ fontSize: 13, color: theme.text, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.titulo}</div>
                <div style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, marginTop: 3 }}>
                  {[r.lugar, r.estado === 'en_curso' ? 'en curso' : r.estado === 'cerrada' ? 'cerrada' : null, !esEvento && r.estado !== 'cerrada' ? `${res.abiertos.length} abierto${res.abiertos.length === 1 ? '' : 's'}` : null, r.estado === 'cerrada' && !esEvento ? `${res.resueltos.length} resuelto${res.resueltos.length === 1 ? '' : 's'}` : null, res.arrastradosFuera.length ? `${res.arrastradosFuera.length} arrastrado${res.arrastradosFuera.length === 1 ? '' : 's'}` : null, res.arrastradosAqui.length && r.estado !== 'cerrada' ? `${res.arrastradosAqui.length} arrastrado${res.arrastradosAqui.length === 1 ? '' : 's'} aquí` : null].filter(Boolean).join(' · ')}
                </div>
                {puntosVer.map((p) => {
                  const n = vecesArrastrado(p, porId);
                  return (
                    <div key={p.id} onClick={(e) => { e.stopPropagation(); abrirItem(p); }} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '7px 0 0', marginTop: 6, borderTop: `1px dashed ${theme.border}`, fontSize: 12.5 }}>
                      <span style={{ width: 14, height: 14, borderRadius: 999, marginTop: 2, flexShrink: 0, border: `1.5px solid ${p.estado === 'arrastrada' ? theme.textMuted : theme.orange}`, background: p.estado === 'arrastrada' ? 'transparent' : `${theme.orange}40` }} />
                      <span style={{ flex: 1, minWidth: 0, color: theme.text, opacity: p.estado === 'arrastrada' ? 0.6 : 1 }}>{p.titulo}<span style={{ display: 'block', fontSize: 10.5, color: theme.textMuted }}>{(p.responsables || []).length ? (p.responsables || []).map((u) => `@${personasPorId.get(u)?.handle || ''}`).join(' ') : 'sin responsable'}{p.fecha_limite ? ` · ${cuando(p.fecha_limite, hoy)}` : ''}{n ? ` · ${ordinal(n)}` : ''}</span></span>
                      <CatPill categoria={p.categoria} />
                    </div>
                  );
                })}
                {r.estado !== 'cerrada' && !esEvento && res.arrastradosAqui.length > 0 && !esHoy && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>Preparar: {res.arrastradosAqui.slice(0, 2).map((p) => `«${p.titulo.slice(0, 40)}»`).join(', ')}{res.arrastradosAqui.length > 2 ? ` y ${res.arrastradosAqui.length - 2} más` : ''}</div>}
                {!esEvento && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <button type="button" onClick={(e) => { e.stopPropagation(); abrirMinuta(r); }} style={btn(theme, activa)}>{r.estado === 'cerrada' ? 'Ver minuta' : 'Abrir minuta'}</button>
                    {r.estado !== 'cerrada' && puedeEditar && !pasada && !esHoy && <button type="button" onClick={(e) => { e.stopPropagation(); res.arrastradosAqui.length ? abrirMinuta(r) : preparar(r); }} style={btn(theme, false)}>{res.arrastradosAqui.length ? `Preparar · ${res.arrastradosAqui.length}` : 'Preparar'}</button>}
                  </div>
                )}
                {esEvento && r.notas && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>{String(r.notas).slice(0, 140)}</div>}
              </div>
            </div>
          );
        })}
        {ord.length > MAX && <BotonGrande onClick={() => setVerTodas((v) => !v)}>{verTodas ? 'Ver menos' : `Ver las ${ord.length} reuniones`}</BotonGrande>}
      </div>
      {puedeEditar && <FAB onClick={() => setForm(true)} label="Nueva reunión" />}
      <HojaM abierto={form} onClose={() => setForm(false)} titulo="Nueva reunión" sub="con minuta en vivo · lo abierto del cliente se arrastra" alto="92vh">
        {form && <FormReunionM personas={personas} hoy={hoy} onClose={() => setForm(false)} onCreada={(r) => { setForm(false); if (r?.tipo === 'reunion') abrirMinuta(r); }} />}
      </HojaM>
    </>
  );
}

const btn = (theme, primario) => ({ flex: 1, height: 38, borderRadius: 10, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#FFF' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' });
const pad = (n) => String(n).padStart(2, '0');

export function FormReunionM({ personas, hoy, inicial = {}, onClose, onCreada }) {
  const { theme } = useTheme();
  const base = new Date(hoy); base.setMinutes(0, 0, 0); base.setHours(base.getHours() + 1);
  const [tipo, setTipo] = useState(inicial.tipo || 'reunion');
  const [titulo, setTitulo] = useState('');
  const [cliente, setCliente] = useState(inicial.cliente_key || 'interno');
  const [fecha, setFecha] = useState(inicial.fecha || isoDia(base));
  const [hora, setHora] = useState(`${pad(base.getHours())}:${pad(base.getMinutes())}`);
  const [duracion, setDuracion] = useState(60);
  const [lugar, setLugar] = useState('');
  const [asistentes, setAsistentes] = useState([]);
  const [busy, setBusy] = useState(false);
  const esEvento = tipo === 'evento';
  const guardar = async () => {
    setBusy(true);
    try {
      const inicio = new Date(`${fecha}T${hora || '10:00'}:00`);
      const lista = asistentes.map((u) => { const p = personas.find((x) => x.user_id === u); return { user_id: u, nombre: p?.nombre || '', email: p?.email || null }; });
      const nueva = await crearReunion({ tipo, titulo: titulo.trim() || (esEvento ? 'Evento' : `Reunión ${nombreClienteAgenda(cliente)}`), cliente_key: cliente, fecha: inicio.toISOString(), duracion_min: Number(duracion) || 60, lugar: lugar.trim() || null, asistentes: lista });
      toast.ok(nueva.arrastrados ? `Reunión creada · ${nueva.arrastrados} punto${nueva.arrastrados === 1 ? '' : 's'} arrastrado${nueva.arrastrados === 1 ? '' : 's'}` : esEvento ? 'Evento creado' : 'Reunión creada');
      onCreada?.(nueva);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  return (
    <div style={{ padding: '0 16px 12px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
      <Segmented size="md" value={tipo} onChange={setTipo} options={[{ id: 'reunion', label: 'Reunión' }, { id: 'evento', label: 'Evento' }]} style={{ display: 'flex', width: '100%' }} />
      <div><span style={lbl(theme)}>Título</span><CampoM value={titulo} onChange={setTitulo} placeholder={esEvento ? 'Feria, salida, visita…' : 'Revisión de sell-out y promos'} autoFocus /></div>
      <div><span style={lbl(theme)}>Cliente</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CLIENTES_AGENDA.map((c) => <ChipM key={c.key} on={cliente === c.key} onClick={() => setCliente(c.key)}>#{c.key}</ChipM>)}</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr 1fr', gap: 8 }}>
        <div><span style={lbl(theme)}>Fecha</span><CampoM type="date" value={fecha} onChange={setFecha} /></div>
        <div><span style={lbl(theme)}>Hora</span><CampoM type="time" value={hora} onChange={setHora} /></div>
        <div><span style={lbl(theme)}>Duración</span>
          <select value={duracion} onChange={(e) => setDuracion(e.target.value)} style={{ width: '100%', height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 16, padding: '0 8px' }}>{[15, 30, 45, 60, 90, 120].map((m) => <option key={m} value={m}>{m} min</option>)}</select>
        </div>
      </div>
      <div><span style={lbl(theme)}>Lugar</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{LUGARES.map((l) => <ChipM key={l} on={lugar === l} onClick={() => setLugar(lugar === l ? '' : l)}>{l}</ChipM>)}</div></div>
      <div><span style={lbl(theme)}>Asistentes</span><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{personas.map((p) => { const on = asistentes.includes(p.user_id); return <ChipM key={p.user_id} on={on} tone="blue" onClick={() => setAsistentes((s) => (on ? s.filter((u) => u !== p.user_id) : [...s, p.user_id]))}>{on && <Check size={12} />}{primerNombre(p.nombre)}</ChipM>; })}</div></div>
      <div style={{ display: 'flex', gap: 8 }}>
        <BotonGrande onClick={onClose} style={{ flex: 1 }}>Cancelar</BotonGrande>
        <BotonGrande primario icon={Plus} onClick={guardar} disabled={busy} style={{ flex: 1.4 }}>{esEvento ? 'Crear evento' : 'Crear reunión'}</BotonGrande>
      </div>
      <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center' }}>Google Calendar se sincroniza desde la computadora.</div>
    </div>
  );
}
