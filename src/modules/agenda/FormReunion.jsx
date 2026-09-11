// Agenda · crear / editar reunión o evento (Modal). Si Google está conectado, "Crear también en Google Calendar"
// (guarda google_event_id; al editar/borrar se sincroniza). Al crear una reunión, los puntos abiertos de las
// anteriores cerradas del mismo cliente se arrastran (RPC agenda_arrastrar_pendientes, ver datos.js).
import React, { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Modal, Interruptor } from '../../components/perfil/comun';
import { Boton, Segmented, Pill, toast } from '../../components/kit';
import { crearReunion, actualizarReunion, borrarReunion } from './datos';
import { crearEventoGoogle, actualizarEventoGoogle, borrarEventoGoogle, MENSAJES_GOOGLE } from './google';
import { CLIENTES_AGENDA } from './etiquetas';
import { LUGARES } from './textos';
import { isoDia } from './calculo';
import { Avatar } from './comun';

const pad = (n) => String(n).padStart(2, '0');
const horaDe = (d) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export default function FormReunion({ inicial = {}, personas, google, onClose, onCreada }) {
  const { theme } = useTheme();
  const r = inicial.reunion || null;
  const base = r ? new Date(r.fecha) : inicial.fecha ? new Date(inicial.fecha) : new Date();
  if (!r && inicial.fecha) base.setHours(10, 0, 0, 0);
  else if (!r) { base.setMinutes(0, 0, 0); base.setHours(base.getHours() + 1); }
  const [tipo, setTipo] = useState(r?.tipo || inicial.tipo || 'reunion');
  const [titulo, setTitulo] = useState(r?.titulo || '');
  const [cliente, setCliente] = useState(r?.cliente_key || inicial.cliente_key || 'interno');
  const [fecha, setFecha] = useState(isoDia(base));
  const [hora, setHora] = useState(horaDe(base));
  const [duracion, setDuracion] = useState(r?.duracion_min || 60);
  const [fechaFin, setFechaFin] = useState(r?.fecha_fin ? isoDia(new Date(r.fecha_fin)) : '');
  const [lugar, setLugar] = useState(r?.lugar || '');
  const [asistentes, setAsistentes] = useState(() => (r?.asistentes || []).map((a) => a.user_id).filter(Boolean));
  const [externos, setExternos] = useState(() => (r?.asistentes || []).filter((a) => !a.user_id).map((a) => a.nombre).join(', '));
  const [notas, setNotas] = useState(r?.notas || '');
  const [enGoogle, setEnGoogle] = useState(!!r?.google_event_id || (!r && !!google?.conectado));
  const [busy, setBusy] = useState(false);
  const esEvento = tipo === 'evento';
  const campo = { border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 13, padding: '6px 9px', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, marginBottom: 5, display: 'block' };

  const armar = () => {
    const inicio = new Date(`${fecha}T${hora || '10:00'}:00`);
    const fin = esEvento && fechaFin ? new Date(`${fechaFin}T18:00:00`) : null;
    const lista = [...asistentes.map((u) => { const p = personas.find((x) => x.user_id === u); return { user_id: u, nombre: p?.nombre || '', email: p?.email || null }; }), ...externos.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).map((nombre) => ({ nombre, email: /@/.test(nombre) ? nombre : null }))];
    return { tipo, titulo: titulo.trim() || (esEvento ? 'Evento' : `Reunión ${CLIENTES_AGENDA.find((c) => c.key === cliente)?.label || cliente}`), cliente_key: cliente, fecha: inicio.toISOString(), fecha_fin: fin ? fin.toISOString() : null, duracion_min: Number(duracion) || 60, lugar: lugar.trim() || null, asistentes: lista, notas: notas.trim() || null };
  };
  const evGoogle = (d, id) => ({ id, titulo: d.titulo, descripcion: [d.cliente_key && d.cliente_key !== 'interno' ? `Cliente: ${d.cliente_key}` : null, d.notas].filter(Boolean).join('\n'), inicio: d.fecha, fin: d.fecha_fin || new Date(new Date(d.fecha).getTime() + d.duracion_min * 60000).toISOString(), lugar: d.lugar, asistentes: d.asistentes.map((a) => a.email).filter(Boolean) });

  const guardar = async () => {
    setBusy(true);
    try {
      const d = armar();
      if (r) {
        let google_event_id = r.google_event_id || null;
        if (enGoogle && google?.conectado) {
          try { const g = google_event_id ? await actualizarEventoGoogle(evGoogle(d, google_event_id)) : await crearEventoGoogle(evGoogle(d)); google_event_id = g.id; }
          catch (e) { toast.error(`Google: ${MENSAJES_GOOGLE[e.codigo] || e.message}`, { ms: 5000 }); }
        }
        await actualizarReunion(r.id, { ...d, google_event_id });
        toast.ok('Reunión actualizada'); onCreada?.(null);
      } else {
        let google_event_id = null;
        if (enGoogle && google?.conectado) {
          try { google_event_id = (await crearEventoGoogle(evGoogle(d))).id; }
          catch (e) { toast.error(`Se creó aquí pero no en Google: ${MENSAJES_GOOGLE[e.codigo] || e.message}`, { ms: 5000 }); }
        }
        const nueva = await crearReunion({ ...d, google_event_id });
        toast.ok(nueva.arrastrados ? `${esEvento ? 'Evento' : 'Reunión'} creada · ${nueva.arrastrados} punto${nueva.arrastrados === 1 ? '' : 's'} arrastrado${nueva.arrastrados === 1 ? '' : 's'} de reuniones anteriores` : `${esEvento ? 'Evento creado' : 'Reunión creada'}${google_event_id ? ' · también en Google' : ''}`);
        onCreada?.(nueva);
      }
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const borrar = async () => {
    if (!window.confirm('¿Eliminar esta reunión y sus puntos?')) return;
    setBusy(true);
    try { if (r.google_event_id && google?.conectado) { try { await borrarEventoGoogle(r.google_event_id); } catch {} } await borrarReunion(r.id); toast.ok('Eliminada'); onCreada?.(null); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <Modal abierto onClose={onClose} theme={theme} titulo={r ? `Editar ${esEvento ? 'evento' : 'reunión'}` : esEvento ? 'Nuevo evento' : 'Nueva reunión'} sub={esEvento ? 'salida, feria, visita… sin minuta' : 'con minuta en vivo y puntos que se arrastran'} ancho={520}
      pie={<>{r && <Boton icon={Trash2} peligro onClick={borrar} disabled={busy} style={{ marginRight: 'auto' }}>Eliminar</Boton>}<Boton onClick={onClose}>Cancelar</Boton><Boton primario onClick={guardar} disabled={busy}>{r ? 'Guardar' : 'Crear'}</Boton></>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
        {!r && <Segmented value={tipo} onChange={setTipo} options={[{ id: 'reunion', label: 'Reunión' }, { id: 'evento', label: 'Evento' }]} />}
        <div><span style={lbl}>Título</span><input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={esEvento ? 'Feria, salida, visita…' : 'Revisión de sell-out y promos'} autoFocus style={campo} /></div>
        <div><span style={lbl}>Cliente</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CLIENTES_AGENDA.map((c) => <Pill key={c.key} tone={cliente === c.key ? 'inverse' : 'gray'} onClick={() => setCliente(c.key)} style={{ cursor: 'pointer', border: `1px solid ${theme.border}` }}>#{c.key}</Pill>)}</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: esEvento ? '1fr 1fr 1fr' : '1.2fr 1fr 1fr', gap: 8 }}>
          <div><span style={lbl}>{esEvento ? 'Desde' : 'Fecha'}</span><input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} style={campo} /></div>
          {esEvento ? <div><span style={lbl}>Hasta</span><input type="date" value={fechaFin} min={fecha} onChange={(e) => setFechaFin(e.target.value)} style={campo} /></div> : <div><span style={lbl}>Hora</span><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} /></div>}
          {esEvento ? <div><span style={lbl}>Hora</span><input type="time" value={hora} onChange={(e) => setHora(e.target.value)} style={campo} /></div> : <div><span style={lbl}>Duración</span><select value={duracion} onChange={(e) => setDuracion(e.target.value)} style={campo}>{[15, 30, 45, 60, 90, 120, 180].map((m) => <option key={m} value={m}>{m} min</option>)}</select></div>}
        </div>
        <div><span style={lbl}>Lugar</span><input list="agenda-lugares" value={lugar} onChange={(e) => setLugar(e.target.value)} placeholder="Meet · oficina · cliente…" style={campo} /><datalist id="agenda-lugares">{LUGARES.map((l) => <option key={l} value={l} />)}</datalist></div>
        <div><span style={lbl}>Asistentes</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 6 }}>
            {personas.map((p) => { const on = asistentes.includes(p.user_id); return <button key={p.user_id} type="button" onClick={() => setAsistentes((s) => (on ? s.filter((u) => u !== p.user_id) : [...s, p.user_id]))} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '3px 9px 3px 4px', borderRadius: 999, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? (theme.accentBg || 'rgba(0,122,255,0.08)') : theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, cursor: 'pointer', opacity: on ? 1 : 0.65 }}><Avatar persona={p} size={18} />{(p.nombre || '').split(' ')[0]}</button>; })}
          </div>
          <input value={externos} onChange={(e) => setExternos(e.target.value)} placeholder="externos: Luis M. (PCEL), correo@cliente.com …" style={campo} />
        </div>
        <div><span style={lbl}>Notas</span><textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} placeholder="objetivo, contexto…" style={{ ...campo, resize: 'vertical' }} /></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${theme.border}` }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 500 }}>{r?.google_event_id ? 'Sincronizar con Google Calendar' : 'Crear también en Google Calendar'}</div>
            <div style={{ fontSize: 11, color: theme.textMuted }}>{google?.conectado ? `en el calendario de ${google.email || 'tu cuenta'} · invita a los asistentes con correo` : 'Google no está conectado (botón «Conectar Google» en la Agenda)'}</div>
          </div>
          <Interruptor theme={theme} on={enGoogle && !!google?.conectado} onChange={google?.conectado ? setEnGoogle : () => google?.onConectar?.()} />
        </div>
      </div>
    </Modal>
  );
}
