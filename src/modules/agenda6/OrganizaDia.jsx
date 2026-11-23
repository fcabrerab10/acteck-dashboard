// Agenda «que te lleva» (V6 · 2026-10-08) · pop-up «Organiza tu día»: sale la primera vez que entras al dashboard cada día
// (en cualquier pestaña). Pasos: (0) si ayer no se cerró, cerrarlo primero · (1) lo que quedó de antes: Hoy · Esta semana ·
// Ya no · (2) el negocio propone: Sí · No · (3) lo nuevo: un renglón por pendiente, chips de lo entendido · «Listo, a trabajar».
// 2026-11-23 · Fernando: «no quiero ver nada de lo que el negocio propone; únicamente qué pendientes tengo, qué voy a hacer
// hoy y en qué orden, y qué voy a agregar, para hoy u otro día… poder poner en qué día se trabajará o agregarlo a mi
// calendario». Ahora: (1) Tus pendientes: Hoy · otro día (fecha) · Ya no · (2) Hoy, en este orden: ↑ ↓ (`orden_dia`) y pasar a
// otro día · (3) Agregar: por renglón, día y «Calendario» con hora (Google Calendar si está conectado). Sin propuestas.
// `OrganizaCuerpo` es el contenido puro (lo usan el Modal web y la HojaM del celular).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { toast } from '../../components/kit';
import { Modal } from '../../components/perfil/comun';
import { fechaLarga } from '../agenda5/base/textos';
import { nombreClienteAgenda } from '../agenda5/base/etiquetas';
import { useGoogleEstado, crearEventoGoogle } from '../agenda5/base/google';
import { interpretarLibre } from './calculo';
import { accionItem, actualizarRapido, cerrarDiaV6, marcarOrganizado, crearLibre } from './datos';
import { ChipsInterp, fechaCorta } from './piezas';

/** Interpreta cada renglón de «Lo nuevo» por separado. */
export function renglonesNuevos(texto, personas, hoy) {
  return String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ texto: l, i: interpretarLibre(l, personas, hoy) }));
}

/** Botón «Otro día»: abre el calendario nativo sin mostrar un campo de fecha vacío. */
function OtroDia({ etiqueta = 'Otro día', min, onElegir, estilo }) {
  const ref = React.useRef(null);
  const abrir = () => { const el = ref.current; if (!el) return; try { el.showPicker ? el.showPicker() : el.focus(); } catch { el.focus(); } };
  return (
    <span style={{ position: 'relative', display: 'inline-flex' }}>
      <button type="button" onClick={abrir} style={estilo}>{etiqueta}</button>
      <input ref={ref} type="date" tabIndex={-1} aria-label={etiqueta} min={min} value="" onChange={(e) => e.target.value && onElegir(e.target.value)}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, pointerEvents: 'none', border: 0, padding: 0 }} />
    </span>
  );
}

export function OrganizaCuerpo({ d, uid, propietario, hoy, hoyIso, horas, estado, puedeEditar, onListo, onAbrirItem, movil = false }) {
  const { theme } = useTheme();
  const google = useGoogleEstado();
  const [paso, setPaso] = useState(estado.ayerSinCerrar ? 0 : 1);
  // El texto de «Agregar» se guarda en la sesión: al abrir o cerrar el teléfono el pop-up cambia de hoja a ventana y se vuelve a montar.
  const LLAVE = `agenda_org_nuevo_${hoyIso}`;
  const [nuevo, setNuevoCrudo] = useState(() => { try { return sessionStorage.getItem(LLAVE) || ''; } catch { return ''; } });
  const setNuevo = (v) => { setNuevoCrudo(v); try { if (v) sessionStorage.setItem(LLAVE, v); else sessionStorage.removeItem(LLAVE); } catch { /* sin storage */ } };
  const [ajustes, setAjustes] = useState({}); // por renglón nuevo: { fecha, cal, hora }
  const [ocupado, setOcupado] = useState(false);
  const renglones = useMemo(() => renglonesNuevos(nuevo, d.personas, hoy), [nuevo, d.personas, hoy]);
  const deHoy = estado.h?.deHoy || [];
  const aj = (k) => ajustes[k] || {};
  const setAj = (k, c) => setAjustes((p) => ({ ...p, [k]: { ...(p[k] || {}), ...c } }));

  const cerrarAyer = async () => {
    setOcupado(true);
    try { await cerrarDiaV6(propietario, estado.ayerIso, { resumen: 'Cerrado al organizar el día siguiente' }, []); toast.ok(`${fechaCorta(estado.ayerIso)} cerrado`); setPaso(1); }
    catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };
  const accion = (it, a, destino = null) => accionItem(it, a, { hoyIso, destino }).catch((e) => toast.error(e.message));
  // Orden del día: se renumera `orden_dia` de toda la lista de hoy (los que tienen hora siguen yendo primero, por su hora).
  const mover = async (idx, delta) => {
    const lista = deHoy.slice(); const k = idx + delta;
    if (k < 0 || k >= lista.length) return;
    [lista[idx], lista[k]] = [lista[k], lista[idx]];
    try { await Promise.all(lista.map((it, n) => (it.orden_dia === n + 1 ? null : actualizarRapido(it.id, { orden_dia: n + 1 })))); }
    catch (e) { toast.error(e.message); }
  };
  const listo = async () => {
    setOcupado(true);
    try {
      let enCalendario = 0;
      for (let k = 0; k < renglones.length; k++) {
        const r = renglones[k], a = aj(k);
        const cuando = a.fecha || r.i.cuando || hoyIso;
        const hora = a.cal ? (a.hora || r.i.hora || '10:00') : (r.i.hora || null);
        await crearLibre(r.texto, { personas: d.personas, propietario, hoy, interp: { ...r.i, cuando, hora, bandeja: false } });
        if (a.cal && google.conectado) {
          try {
            const ini = new Date(`${cuando}T${hora}:00`); const fin = new Date(ini.getTime() + (r.i.duracion_min || 30) * 60000);
            await crearEventoGoogle({ titulo: r.i.titulo || r.texto, inicio: ini.toISOString(), fin: fin.toISOString() }); enCalendario += 1;
          } catch (e) { toast.error(`No se pudo agregar a Google Calendar: ${e.message}`); }
        }
      }
      await marcarOrganizado(propietario, hoyIso);
      setNuevo('');
      toast.ok(`Día organizado${renglones.length ? ` · ${renglones.length} nuevo${renglones.length === 1 ? '' : 's'}` : ''}${enCalendario ? ` · ${enCalendario} en tu calendario` : ''}`);
      onListo?.();
    } catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };

  const alto = movil ? 40 : 30;
  const Tit = ({ children, meta }) => <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 6px' }}><span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 700, color: theme.text }}>{children}</span>{meta && <span style={{ fontSize: 11.5, color: theme.textMuted }}>{meta}</span>}</div>;
  const btn = (primario) => ({ border: primario ? 0 : `1px solid ${theme.border}`, borderRadius: 999, padding: movil ? '10px 16px' : '8px 14px', background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer', minHeight: movil ? 44 : 34 });
  const mini = (tono) => ({ border: `1px solid ${theme.border}`, borderRadius: 999, padding: '0 11px', minHeight: alto, background: tono === 'azul' ? theme.accent : theme.surface, color: tono === 'azul' ? '#fff' : tono === 'rojo' ? theme.red : theme.text, fontFamily: TYPO.fontText, fontSize: 12, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' });
  const campoFecha = { border: `1px solid ${theme.border}`, borderRadius: 999, padding: '0 8px', minHeight: alto, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, colorScheme: theme.mode === 'dark' ? 'dark' : 'light' };
  const fila = { display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', padding: '7px 10px', borderRadius: 11, border: `1px solid ${theme.border}`, background: theme.surface };
  const titulo = (it) => (
    <button type="button" onClick={() => onAbrirItem?.(it)} style={{ flex: movil ? '1 1 120px' : '1 1 180px', minWidth: 0, textAlign: 'left', border: 0, background: 'none', padding: 0, cursor: onAbrirItem ? 'pointer' : 'default', color: theme.text, fontFamily: TYPO.fontText }}>
      <span style={movil ? { display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: 14, lineHeight: 1.25 } : { display: 'block', fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.titulo}</span>
      <span style={{ display: 'block', fontSize: 11, color: theme.textMuted }}>{[it.cliente_key && it.cliente_key !== 'interno' ? nombreClienteAgenda(it.cliente_key) : null, it.hora ? String(it.hora).slice(0, 5) : null, it.duracion_min ? `${it.duracion_min} min` : null].filter(Boolean).join(' · ') || ' '}</span>
    </button>
  );

  if (paso === 0) return (
    <div style={{ padding: movil ? '0 16px 16px' : 0 }}>
      <div style={{ fontSize: 15, color: theme.text, lineHeight: 1.45 }}>
        <b>{fechaLarga(new Date(`${estado.ayerIso}T12:00:00`)).replace(/^./, (c) => c.toUpperCase())}</b> no se cerró. Hiciste <b>{estado.ayer.hechas} de {estado.ayer.total}</b>; lo que quedó abierto lo verás en el siguiente paso.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" disabled={ocupado} onClick={cerrarAyer} style={btn(true)}>Cerrar {estado.ayerIso === estado.hoyIso ? 'hoy' : 'ese día'} y seguir</button>
        <button type="button" onClick={() => setPaso(1)} style={btn(false)}>Dejarlo así</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: movil ? '0 16px' : 0, display: 'flex', flexDirection: 'column' }}>
      {/* Con ancho (teléfono abierto en horizontal, computadora) van dos columnas: lo que ya tienes | lo que agregas. */}
      <div style={{ display: 'grid', gridTemplateColumns: movil ? 'minmax(0, 1fr)' : 'repeat(auto-fit, minmax(min(100%, 330px), 1fr))', columnGap: 22, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
      {/* 1 · Lo que traes pendiente de días anteriores: decide cuándo lo trabajas. */}
      <Tit meta={estado.quedo.length ? `${estado.quedo.length} de días anteriores · elige cuándo` : 'nada atrasado'}>Tus pendientes</Tit>
      {estado.quedo.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted }}>No traes nada pendiente de días anteriores.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {estado.quedo.map((it) => (
          <div key={it.id} style={fila}>
            {titulo(it)}
            <span style={{ fontSize: 11, color: theme.orange, whiteSpace: 'nowrap' }}>{fechaCorta(it.cuando || it.fecha_limite)}</span>
            {puedeEditar && <>
              <button type="button" onClick={() => accion(it, 'hoy')} style={mini('azul')}>Hoy</button>
              <OtroDia min={hoyIso} onElegir={(f) => accion(it, f === hoyIso ? 'hoy' : 'fecha', f)} estilo={mini()} />
              <button type="button" onClick={() => accion(it, 'yano')} style={mini('rojo')}>Ya no</button>
            </>}
          </div>
        ))}
      </div>

      {/* 2 · Lo de hoy, en el orden en que lo vas a hacer. */}
      <Tit meta={deHoy.length ? `${deHoy.length} · acomódalos en el orden en que los harás` : 'todavía nada'}>Hoy, en este orden</Tit>
      {deHoy.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Pasa algo de tus pendientes a «Hoy» o agrégalo abajo.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {deHoy.map((it, idx) => (
          <div key={it.id} style={fila}>
            <span style={{ width: 18, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, color: theme.textMuted }}>{idx + 1}</span>
            {titulo(it)}
            {puedeEditar && <>
              <button type="button" aria-label="Subir" disabled={idx === 0} onClick={() => mover(idx, -1)} style={{ ...mini(), padding: 0, width: alto, opacity: idx === 0 ? 0.35 : 1 }}>↑</button>
              <button type="button" aria-label="Bajar" disabled={idx === deHoy.length - 1} onClick={() => mover(idx, 1)} style={{ ...mini(), padding: 0, width: alto, opacity: idx === deHoy.length - 1 ? 0.35 : 1 }}>↓</button>
              <OtroDia min={hoyIso} onElegir={(f) => f !== hoyIso && accion(it, 'fecha', f)} estilo={mini()} />
            </>}
          </div>
        ))}
      </div>

      </div>
      <div style={{ minWidth: 0 }}>
      {/* 3 · Lo nuevo: un renglón por pendiente; cada uno con su día y, si hace falta, al calendario con hora. */}
      <Tit meta="un renglón por pendiente · elige el día de cada uno">Agregar</Tit>
      <textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} rows={3} disabled={!puedeEditar}
        placeholder={'Pedirle a Karolina los estados de cuenta de Dicotech\nLlamar a Carlos de Digitalife 11am\nRevisar la propuesta de PCEL el viernes'}
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: movil ? 16 : 13.5, lineHeight: 1.45, resize: 'vertical', outline: 'none' }} />
      {renglones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {renglones.map((r, k) => {
            const a = aj(k); const dia = a.fecha || r.i.cuando || hoyIso;
            return (
              <div key={k} style={fila}>
                <span style={{ flex: '1 1 160px', minWidth: 0, fontSize: 13, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.i.titulo || r.texto}</span>
                <ChipsInterp chips={r.i.chips.filter((c) => c.tipo !== 'fecha')} />
                <button type="button" onClick={() => setAj(k, { fecha: hoyIso })} style={mini(dia === hoyIso ? 'azul' : null)}>Hoy</button>
                <input type="date" aria-label="Día" title="Día en que lo trabajarás" min={hoyIso} value={dia} onChange={(e) => setAj(k, { fecha: e.target.value || hoyIso })} style={{ ...campoFecha, width: movil ? 132 : 118 }} />
                <button type="button" onClick={() => setAj(k, { cal: !a.cal })} title={google.conectado ? 'Agregarlo también a tu Google Calendar' : 'Ponerle hora para que salga en tu Horario'} style={mini(a.cal ? 'azul' : null)}>Calendario</button>
                {a.cal && <input type="time" aria-label="Hora" value={a.hora || r.i.hora || '10:00'} onChange={(e) => setAj(k, { hora: e.target.value })} style={{ ...campoFecha, width: movil ? 104 : 92 }} />}
              </div>
            );
          })}
          {renglones.some((_, k) => aj(k).cal) && !google.conectado && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Google Calendar no está conectado: se guardan con su hora y salen en tu Horario del dashboard.</div>}
        </div>
      )}

      </div>
      </div>
      {/* Pie fijo: «Listo» siempre a la vista, aunque la lista de hoy sea larga. */}
      <div style={{ position: 'sticky', bottom: -16, zIndex: 2, display: 'flex', gap: 8, marginTop: 14, padding: '10px 0 14px', alignItems: 'center', flexWrap: 'wrap', background: theme.mode === 'dark' ? 'rgb(34,34,37)' : theme.bg, borderTop: `1px solid ${theme.border}` }}>
        <button type="button" disabled={ocupado || !puedeEditar} onClick={listo} style={{ ...btn(true), flex: movil ? 1 : 'none' }}>Listo, a trabajar{renglones.length ? ` (${renglones.length} nuevo${renglones.length === 1 ? '' : 's'})` : ''}</button>
        {!movil && <span style={{ fontSize: 11.5, color: theme.textMuted }}>Lo que no muevas sigue en Pendientes.</span>}
      </div>
    </div>
  );
}

/** Web: Modal centrado. */
export default function OrganizaDia({ abierto, onClose, d, uid, propietario, hoy, hoyIso, horas, estado, puedeEditar, nombre, onAbrirItem }) {
  const { theme } = useTheme();
  if (!abierto || !estado) return null;
  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} ancho={900} zIndex={95}
      titulo={`${nombre ? `${nombre}, o` : 'O'}rganiza tu día`} sub={fechaLarga(hoy).replace(/^./, (c) => c.toUpperCase())}>
      <OrganizaCuerpo d={d} uid={uid} propietario={propietario} hoy={hoy} hoyIso={hoyIso} horas={horas} estado={estado} puedeEditar={puedeEditar} onListo={onClose} onAbrirItem={onAbrirItem} />
    </Modal>
  );
}
