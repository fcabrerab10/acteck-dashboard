// Agenda móvil · captura rápida (hoja desde el FAB) y edición de un ítem existente.
// Una línea de texto con #cliente @persona /categoría y fecha en lenguaje natural ("el viernes", "mañana", "15 sep",
// "a las 4 pm") → etiquetas.js (parsearEtiquetas + fechaNatural). Chips confirman lo entendido y se pueden cambiar a
// mano; toggles Tarea / Punto de reunión (elige la reunión de hoy o la próxima), prioridad, micrófono (es-MX).
//   <CapturaHoja cfg={{ tipo:'tarea' } | { item } | null} personas reuniones hoy onClose onGuardado onAbrirMinuta />
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Trash2, CalendarDays, ChevronRight, RotateCcw } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HojaM, BotonGrande, Segmented, toast } from '../../piezas';
import { crearItem, guardarItemDesdeTexto, actualizarItem, borrarItem } from '../../../modules/agenda/datos';
import { parsearEtiquetas, fechaNatural, textoConEtiquetas, CLIENTES_AGENDA, CATEGORIAS, nombreClienteAgenda, conHandles } from '../../../modules/agenda/etiquetas';
import { cuando, isoDia, sumarDias, fmtHora, proximaReunion } from '../../../modules/agenda/calculo';
import { PRIORIDAD_LABEL } from '../../../modules/agenda/textos';
import { ChipM, BotonMic, CampoM, lbl, primerNombre } from './comun';

const TIPOS = [{ id: 'tarea', label: 'Tarea' }, { id: 'punto', label: 'Punto de reunión' }];

export default function CapturaHoja({ cfg, personas = [], reuniones = [], hoy = new Date(), onClose, onGuardado, onAbrirMinuta }) {
  return (
    <HojaM abierto={!!cfg} onClose={onClose} titulo={cfg?.item ? (cfg.item.tipo === 'punto' ? 'Punto de reunión' : 'Tarea') : 'Nueva'} sub={cfg?.item ? `${cfg.item.estado === 'hecha' ? 'Resuelta' : 'Abierta'}${cfg.item.fecha_limite ? ` · ${cuando(cfg.item.fecha_limite, hoy)}` : ''}` : 'se guarda al tocar Guardar'} alto="92vh">
      {cfg && <Captura key={cfg.item?.id || 'nueva'} cfg={cfg} personas={personas} reuniones={reuniones} hoy={hoy} onClose={onClose} onGuardado={onGuardado} onAbrirMinuta={onAbrirMinuta} />}
    </HojaM>
  );
}

function Captura({ cfg, personas, reuniones, hoy, onClose, onGuardado, onAbrirMinuta }) {
  const { theme } = useTheme();
  const item = cfg.item || null;
  const [texto, setTexto] = useState(() => (item ? textoConEtiquetas(item, personas) : cfg.texto || ''));
  const [tipo, setTipo] = useState(item?.tipo || cfg.tipo || 'tarea');
  const [reunionId, setReunionId] = useState(item?.reunion_id || cfg.reunion_id || null);
  const [prioridad, setPrioridad] = useState(item?.prioridad || 'media');
  const [fechaManual, setFechaManual] = useState(item ? (item.fecha_limite || '') : cfg.fecha_limite ?? null);   // null = usar la del texto
  const [horaManual, setHoraManual] = useState(item ? (item.hora ? String(item.hora).slice(0, 5) : '') : null);
  // Al editar, el texto ya trae #cliente @persona /categoría (textoConEtiquetas): las etiquetas del texto mandan; null = usar las del texto.
  const [clienteManual, setClienteManual] = useState(cfg.cliente_key ?? null);
  const [categoriaManual, setCategoriaManual] = useState(null);
  const [personasManual, setPersonasManual] = useState(null);
  const [verPersonas, setVerPersonas] = useState(false);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);
  const baseDictado = useRef('');
  useEffect(() => { if (!item) { const t = setTimeout(() => inputRef.current?.focus(), 400); return () => clearTimeout(t); } return undefined; }, [item]);

  // ── Lo entendido ──
  const nat = useMemo(() => fechaNatural(texto, hoy), [texto, hoy]);
  const p = useMemo(() => parsearEtiquetas(nat.texto, personas), [nat.texto, personas]);
  const fecha = fechaManual != null ? (fechaManual || null) : nat.fecha;
  const hora = horaManual != null ? (horaManual || null) : nat.hora;
  const cliente = clienteManual != null ? (clienteManual || null) : p.cliente_key;
  const categoria = categoriaManual != null ? (categoriaManual || null) : p.categoria;
  const responsables = personasManual != null ? personasManual : p.responsables;
  const lista = useMemo(() => conHandles(personas), [personas]);
  // Una fecha/hora escrita en el texto manda sobre la elegida a mano (también al editar un ítem existente).
  useEffect(() => { if (nat.fecha) setFechaManual(nat.fecha); if (nat.hora) setHoraManual(nat.hora); }, [nat.fecha, nat.hora]);
  const titulo = p.titulo.trim();

  // Reuniones candidatas para un punto: hoy / en curso primero, luego próximas (no cerradas), luego las últimas.
  const candidatas = useMemo(() => {
    const abiertas = reuniones.filter((r) => r.tipo === 'reunion' && r.estado !== 'cerrada').sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    const hoyIso = isoDia(hoy);
    const deHoy = abiertas.filter((r) => isoDia(new Date(r.fecha)) === hoyIso || r.estado === 'en_curso');
    const futuras = abiertas.filter((r) => !deHoy.includes(r) && new Date(r.fecha) >= hoy);
    return [...deHoy, ...futuras].slice(0, 6);
  }, [reuniones, hoy]);
  useEffect(() => { if (tipo === 'punto' && !reunionId) setReunionId((cliente && proximaReunion(reuniones, cliente, hoy)?.id) || candidatas[0]?.id || null); }, [tipo]); // eslint-disable-line react-hooks/exhaustive-deps

  const guardar = async () => {
    if (!titulo && !texto.trim()) { toast.error('Escribe qué hay que hacer'); return; }
    setBusy(true);
    try {
      if (item) {
        await guardarItemDesdeTexto(item, nat.texto || texto, personas, { fecha_limite: fecha, hora, prioridad, categoria, cliente_key: cliente ?? (item.tipo === 'punto' ? null : 'interno'), responsables, reunion_id: tipo === 'punto' ? reunionId : item.reunion_id, tipo });
        toast.ok('Guardado');
        onGuardado?.(item);
      } else {
        const creado = await crearItem({ texto: nat.texto || texto, tipo, fecha_limite: fecha, hora, prioridad, reunion_id: tipo === 'punto' ? reunionId : null, cliente_key: cliente ?? (tipo === 'punto' ? (reuniones.find((r) => r.id === reunionId)?.cliente_key ?? null) : 'interno'), categoria, responsables, origen: { fuente: 'movil' } }, personas);
        const r = tipo === 'punto' ? reuniones.find((x) => x.id === reunionId) : null;
        toast.ok(tipo === 'punto' ? `Punto agregado${r ? ` a ${r.titulo}` : ''}` : fecha ? `Tarea para ${cuando(fecha, hoy)}` : 'Tarea creada');
        onGuardado?.(creado);
      }
      onClose?.();
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const toggleHecha = async () => { try { await actualizarItem(item.id, item.estado === 'hecha' ? { estado: 'abierta', completado_en: null } : { estado: 'hecha', completado_en: new Date().toISOString() }); toast.ok(item.estado === 'hecha' ? 'Reabierta' : 'Hecho'); onClose?.(); } catch (e) { toast.error(e.message); } };
  const eliminar = async () => { if (!window.confirm('¿Eliminar este ítem? No se puede deshacer.')) return; try { await borrarItem(item.id); toast.ok('Eliminado'); onClose?.(); } catch (e) { toast.error(e.message); } };
  const onDictado = (t, final) => { setTexto(`${baseDictado.current}${baseDictado.current && !/\s$/.test(baseDictado.current) ? ' ' : ''}${t}`); if (final) baseDictado.current = `${baseDictado.current}${baseDictado.current && !/\s$/.test(baseDictado.current) ? ' ' : ''}${t}`; };
  const onEstadoMic = (on) => { if (on) baseDictado.current = texto; };
  const cicloCliente = () => { const ks = ['', ...CLIENTES_AGENDA.map((c) => c.key)]; const i = ks.indexOf(cliente || ''); setClienteManual(ks[(i + 1) % ks.length]); };
  const chipFecha = fecha ? `${cuando(fecha, hoy)}${hora ? ` · ${hora}` : ''}` : 'sin fecha';
  const reunionSel = reuniones.find((r) => r.id === reunionId);
  const dark = theme.mode === 'dark';
  const resaltado = useMemo(() => resaltar(texto, theme), [texto, theme]);

  return (
    <div style={{ padding: '0 16px 10px', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
      {!item && <Segmented size="md" value={tipo} onChange={setTipo} options={TIPOS} style={{ display: 'flex', width: '100%' }} />}

      {/* Texto con etiquetas resaltadas: capa de texto debajo, textarea transparente encima (mismo padding/fuente). */}
      <div style={{ position: 'relative', background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(120,120,128,0.10)', borderRadius: 12 }}>
        <div aria-hidden style={{ position: 'absolute', inset: 0, padding: '10px 12px', border: '1px solid transparent', fontSize: 16, lineHeight: 1.4, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', pointerEvents: 'none', fontFamily: TYPO.fontText, overflow: 'hidden' }}>{texto ? resaltado : <span style={{ color: theme.textSubtle || theme.textMuted }}>{tipo === 'punto' ? 'Punto… #cliente @persona /categoría, fecha' : 'Mandar muestras a @karolina #pcel el viernes'}</span>}{texto.endsWith('\n') ? ' ' : ''}</div>
        <CampoM multiline inputRef={inputRef} value={texto} onChange={setTexto} onEnter={guardar} placeholder={tipo === 'punto' ? 'Punto… #cliente @persona /categoría, fecha' : 'Mandar muestras a @karolina #pcel el viernes'} autoCapitalize="sentences" autoCorrect="on" spellCheck={false}
          style={{ background: 'transparent', color: 'transparent', caretColor: theme.text, border: `1px solid ${theme.border}`, minHeight: 74, position: 'relative' }} />
      </div>

      {/* Chips: lo entendido */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <ChipM on={!!cliente} onClick={cicloCliente} tone="green">{cliente ? `#${cliente}` : '#cliente'}</ChipM>
        <ChipM on={responsables.length > 0} onClick={() => setVerPersonas((v) => !v)} tone="blue">{responsables.length ? responsables.map((u) => `@${lista.find((x) => x.user_id === u)?.handle || '…'}`).join(' ') : '@persona'}</ChipM>
        <label style={{ position: 'relative' }}>
          <ChipM on={!!fecha} tone="gray"><CalendarDays size={13} />{chipFecha}</ChipM>
          <input type="date" value={fecha || ''} onChange={(e) => setFechaManual(e.target.value)} aria-label="Fecha límite" style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%' }} />
        </label>
        {fecha && <ChipM onClick={() => { setFechaManual(''); setHoraManual(''); }} tone="gray" style={{ padding: '5px 8px' }}><RotateCcw size={12} /></ChipM>}
        {!fecha && <ChipM onClick={() => setFechaManual(isoDia(hoy))} tone="gray">hoy</ChipM>}
        {!fecha && <ChipM onClick={() => setFechaManual(isoDia(sumarDias(hoy, 1)))} tone="gray">mañana</ChipM>}
        {p.desconocidas.length > 0 && <span style={{ fontSize: 11, color: theme.orange }}>{p.desconocidas.join(' ')} no es del equipo</span>}
      </div>
      {verPersonas && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {lista.map((per) => { const on = responsables.includes(per.user_id); return <ChipM key={per.user_id} on={on} tone="blue" onClick={() => setPersonasManual(on ? responsables.filter((u) => u !== per.user_id) : [...responsables, per.user_id])}>{primerNombre(per.nombre)}</ChipM>; })}
        </div>
      )}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {CATEGORIAS.map((c) => <ChipM key={c.id} on={categoria === c.id} tone={c.tone} onClick={() => setCategoriaManual(categoria === c.id ? '' : c.id)}>/{c.id === 'administracion' ? 'admin' : c.id}</ChipM>)}
        <ChipM on={prioridad === 'alta'} tone="red" onClick={() => setPrioridad(prioridad === 'alta' ? 'media' : 'alta')}>alta</ChipM>
      </div>

      {tipo === 'punto' && (
        <div>
          <span style={lbl(theme)}>Reunión</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {candidatas.map((r) => {
              const on = r.id === reunionId; const f = new Date(r.fecha);
              return (
                <button key={r.id} type="button" onClick={() => setReunionId(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: 44, padding: '6px 12px', borderRadius: 12, border: `1px solid ${on ? theme.accent : theme.border}`, background: on ? (theme.accentBg || 'rgba(0,122,255,0.08)') : theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 14, textAlign: 'left', cursor: 'pointer' }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombreClienteAgenda(r.cliente_key)} · {r.titulo}</span>
                  <span style={{ fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap' }}>{cuando(isoDia(f), hoy)} {fmtHora(f)}</span>
                  {on && <Check size={16} color={theme.accent} />}
                </button>
              );
            })}
            {!candidatas.length && !reunionSel && <div style={{ fontSize: 12.5, color: theme.textMuted }}>No hay reuniones abiertas: crea una en Reuniones o guárdalo como tarea.</div>}
            {reunionSel && !candidatas.includes(reunionSel) && <div style={{ fontSize: 12.5, color: theme.textMuted }}>En la reunión «{reunionSel.titulo}».</div>}
          </div>
        </div>
      )}

      {item && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <div><span style={lbl(theme)}>Hora</span><CampoM type="time" value={hora || ''} onChange={setHoraManual} /></div>
          <div><span style={lbl(theme)}>Prioridad</span><Segmented size="md" value={prioridad} onChange={setPrioridad} options={Object.entries(PRIORIDAD_LABEL).map(([id, label]) => ({ id, label }))} style={{ display: 'flex', width: '100%' }} /></div>
        </div>
      )}
      {item?.reunion_id && onAbrirMinuta && (
        <button type="button" onClick={() => { onClose?.(); onAbrirMinuta(item.reunion_id); }} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, padding: '0 12px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 14, cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ flex: 1 }}>Reunión · {reuniones.find((r) => r.id === item.reunion_id)?.titulo || 'ver minuta'}</span><ChevronRight size={16} color={theme.textMuted} />
        </button>
      )}

      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
        <BotonMic onTexto={onDictado} onEstado={onEstadoMic} />
        {item && <BotonGrande icon={item.estado === 'hecha' ? RotateCcw : Check} onClick={toggleHecha} style={{ flex: 1 }}>{item.estado === 'hecha' ? 'Reabrir' : 'Hecha'}</BotonGrande>}
        <BotonGrande primario onClick={guardar} disabled={busy} style={{ flex: 1.4 }}>{item ? 'Guardar' : tipo === 'punto' ? 'Agregar punto' : 'Guardar'}</BotonGrande>
      </div>
      {item && <button type="button" onClick={eliminar} style={{ alignSelf: 'center', border: 0, background: 'transparent', color: theme.red, fontFamily: TYPO.fontText, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', cursor: 'pointer' }}><Trash2 size={14} />Eliminar</button>}
      {!item && <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', lineHeight: 1.4 }}>Escribe o dicta con #cliente, @persona, /categoría y la fecha en palabras: «el viernes», «mañana», «15 sep», «a las 4 pm».</div>}
    </div>
  );
}

/** Resalta #cliente @persona /categoría en azul (capa transparente sobre el textarea). */
function resaltar(texto, theme) {
  const partes = String(texto || '').split(/((?:^|\s)[#@/][^\s#@/]+)/);
  return partes.map((s, i) => (/^\s?[#@/]/.test(s) ? <span key={i} style={{ color: theme.accent, fontWeight: 600 }}>{s}</span> : s));
}
