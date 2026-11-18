// Agenda · celular · vistas de «Más» que ya existían en la web (2026-11-18, congruencia web ↔ celular):
//   Semana — L–D con la carga de cada día (hechas · abiertas · reuniones), objetivos de la semana editables, qué revisar
//            y tiempo por área. ‹ › cambian de semana; tocar un día abre su Horario.
//   Ideas  — captura rápida (una línea, con dictado) + lista; cada idea se convierte en pendiente de hoy o «cuando sea».
//   Equipo — sólo para quien puede ver agendas de otros: una tarjeta por persona (hoy, atrasados, check-in) con
//            «Ver agenda», y mi check-in del día.
// Cálculo: modules/agenda5/vistas.js (el mismo de la web). Escrituras: modules/agenda5/datos.js (las de la web).
// Cada vista tiene su `*Vista` pura para SSR; el contenedor sólo pone estado y escrituras.
import React, { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Lightbulb, Users } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill } from '../../../components/kit';
import { Avatar } from '../../../modules/agenda5/comun';
import { semanaDe, ideasDe, parchePromoverIdea, equipoDe, checkinDe } from '../../../modules/agenda5/vistas';
import { isoDia, sumarDias, fmtMin } from '../../../modules/agenda5/calculo';
import { actualizarItem, crearDesdeCaptura, crearObjetivoSemana, marcarObjetivoSemana, borrarObjetivoSemana, guardarCheckin } from '../../../modules/agenda5/datos';
import { nombreClienteAgenda } from '../../../modules/agenda5/base/etiquetas';
import { ListaAgrupada, Fila, Vacio, toast } from '../../piezas';
import { PalomitaM, CampoM, BotonMic } from './comun';

const MESES_C = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (iso) => { const d = new Date(`${String(iso).slice(0, 10)}T12:00:00`); return `${d.getDate()} ${MESES_C[d.getMonth()]}`; };
const avisar = (e) => toast.error(e?.message || String(e));

/** Botón redondo de 44 px (flechas, quitar). */
function BotonIcono({ icon: Icon, label, onClick, color }) {
  const { theme } = useTheme();
  return (
    <button type="button" aria-label={label} onClick={onClick} style={{ width: 44, height: 44, borderRadius: 22, border: 0, background: 'transparent', color: color || theme.text, display: 'inline-grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
      <Icon size={20} />
    </button>
  );
}
/** Botón de texto de 44 px de alto. */
function BotonM({ children, onClick, primario, disabled, style }) {
  const { theme } = useTheme();
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap', ...style }}>{children}</button>
  );
}

// ───────────────────────── Semana ─────────────────────────
/** Vista pura. `sem` = semanaDe(...). */
export function SemanaVista({ sem, puedeEditar = false, esSemanaActual = true, nuevo = '', onNuevo, onAgregar, onMarcar, onBorrar, onSemana, onDia, onAbrirItem }) {
  const { theme } = useTheme();
  const fin = sumarDias(sem.lunes, 6);
  const titulo = `${sem.lunes.getDate()} ${MESES_C[sem.lunes.getMonth()]} – ${fin.getDate()} ${MESES_C[fin.getMonth()]}`;
  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 10px 6px' }}>
        <BotonIcono icon={ChevronLeft} label="Semana anterior" onClick={() => onSemana?.(-1)} />
        <div style={{ flex: 1, textAlign: 'center', minWidth: 0 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text }}>{titulo}</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted }}>{sem.totHechas} hechas · {sem.totAbiertas} abiertas{sem.totMin ? ` · ${fmtMin(sem.totMin)} registradas` : ''}</div>
        </div>
        {!esSemanaActual && <BotonM onClick={() => onSemana?.(0)}>Hoy</BotonM>}
        <BotonIcono icon={ChevronRight} label="Semana siguiente" onClick={() => onSemana?.(1)} />
      </div>

      <ListaAgrupada titulo="Carga por día" meta="toca un día para ver su horario">
        {sem.dias.map((x) => {
          const total = x.hechas + x.abiertas + x.reuniones;
          const w = (n) => `${(n / sem.cargaMax) * 100}%`;
          return (
            <button key={x.iso} type="button" onClick={() => onDia?.(x.iso)} style={{ width: '100%', minHeight: 56, display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px', border: 0, background: x.esHoy ? `${theme.accent}12` : theme.surface, color: theme.text, textAlign: 'left', cursor: 'pointer', fontFamily: TYPO.fontText }}>
              <span style={{ width: 44, flexShrink: 0 }}>
                <b style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 13, color: x.esHoy ? theme.accent : theme.text }}>{x.label}</b>
                <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{Number(x.iso.slice(8))}</span>
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'flex', height: 8, borderRadius: 999, overflow: 'hidden', background: `${theme.text}10` }}>
                  <i style={{ width: w(x.hechas), background: theme.green }} /><i style={{ width: w(x.abiertas), background: theme.accent }} /><i style={{ width: w(x.reuniones), background: theme.orange }} />
                </span>
                <span style={{ display: 'block', marginTop: 5, fontSize: 12, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {total === 0 ? 'sin nada' : [x.hechas ? `${x.hechas} hecha${x.hechas === 1 ? '' : 's'}` : null, x.abiertas ? `${x.abiertas} abierta${x.abiertas === 1 ? '' : 's'}` : null, x.reuniones ? `${x.reuniones} reunión${x.reuniones === 1 ? '' : 'es'}` : null, x.minPlan ? fmtMin(x.minPlan) : null].filter(Boolean).join(' · ')}
                </span>
              </span>
              <ChevronRight size={15} style={{ color: theme.textMuted, flexShrink: 0 }} />
            </button>
          );
        })}
      </ListaAgrupada>

      <ListaAgrupada titulo="Objetivos de la semana" meta={sem.objetivos.length ? `${sem.cumplidos} de ${sem.objetivos.length}` : 'tres cosas que sí o sí'} style={{ marginTop: 14 }}>
        {sem.objetivos.map((o) => (
          <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 52, padding: '4px 6px 4px 14px', background: theme.surface }}>
            <span style={{ width: 44, height: 44, display: 'grid', placeItems: 'center', flexShrink: 0 }}><PalomitaM hecha={!!o.cumplido} size={26} disabled={!puedeEditar} onClick={() => onMarcar?.(o)} /></span>
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, lineHeight: 1.3, color: o.cumplido ? theme.textMuted : theme.text, textDecoration: o.cumplido ? 'line-through' : 'none' }}>{o.texto}</span>
            {puedeEditar && <BotonIcono icon={X} label="Quitar objetivo" color={theme.textMuted} onClick={() => onBorrar?.(o)} />}
          </div>
        ))}
        {sem.objetivos.length === 0 && !puedeEditar && <Vacio icon={null} titulo="Sin objetivos esta semana" style={{ padding: 16 }} />}
        {puedeEditar && (
          <div style={{ display: 'flex', gap: 8, padding: '10px 16px', background: theme.surface }}>
            <CampoM value={nuevo} onChange={onNuevo} placeholder="Nuevo objetivo…" onEnter={onAgregar} />
            <BotonM primario disabled={!String(nuevo).trim()} onClick={onAgregar}>Agregar</BotonM>
          </div>
        )}
      </ListaAgrupada>

      {(sem.acuerdosVencidos.length > 0 || sem.sinContacto.length > 0) && (
        <ListaAgrupada titulo="Qué revisar" meta="acuerdos vencidos y cuentas sin contacto" style={{ marginTop: 14 }}>
          {sem.acuerdosVencidos.slice(0, 8).map((it) => <Fila key={it.id} alto={52} titulo={it.titulo} sub={`venció ${fechaCorta(it.fecha_limite)}`} pill={{ tone: 'red', label: 'acuerdo' }} onClick={() => onAbrirItem?.(it)} />)}
          {sem.sinContacto.slice(0, 8).map((c) => <Fila key={c.id} alto={52} chevron={false} titulo={`${c.nombre}${c.empresa ? ` (${c.empresa})` : ''}`} sub={`toca contactar desde ${fechaCorta(c.proximo_seguimiento)}`} pill={{ tone: 'orange', label: 'cuenta' }} />)}
        </ListaAgrupada>
      )}

      {sem.porArea.length > 0 && (
        <ListaAgrupada titulo="Tiempo por área" meta="de lo hecho esta semana" style={{ marginTop: 14 }}>
          {sem.porArea.map(([k, v]) => (
            <div key={k} style={{ padding: '10px 16px', background: theme.surface }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5, color: theme.text }}><span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k}</span><span style={{ color: theme.textMuted, fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmtMin(v)}</span></div>
              <div style={{ marginTop: 6, height: 6, borderRadius: 999, background: `${theme.text}12` }}><div style={{ height: '100%', width: `${(v / Math.max(1, sem.porArea[0][1])) * 100}%`, background: theme.accent, borderRadius: 999 }} /></div>
            </div>
          ))}
        </ListaAgrupada>
      )}
      <div style={{ height: 110 }} />
    </>
  );
}

export function SemanaM({ d, uid, propietario, puedeEditar, hoy, abrirItem, onDia }) {
  const [desfase, setDesfase] = useState(0);
  const [nuevo, setNuevo] = useState('');
  const ref = useMemo(() => sumarDias(hoy, desfase * 7), [hoy, desfase]);
  const sem = useMemo(() => semanaDe(d, propietario, { hoy, ref, uid }), [d, propietario, hoy, ref, uid]);
  const agregar = async () => {
    const t = nuevo.trim(); if (!t) return;
    try { await crearObjetivoSemana(propietario, sem.semanaIso, t); setNuevo(''); } catch (e) { avisar(e); }
  };
  return (
    <SemanaVista sem={sem} puedeEditar={puedeEditar} esSemanaActual={desfase === 0} nuevo={nuevo} onNuevo={setNuevo} onAgregar={agregar}
      onMarcar={(o) => marcarObjetivoSemana(o.id, !o.cumplido).catch(avisar)}
      onBorrar={(o) => borrarObjetivoSemana(o.id).then(() => toast.ok('Objetivo quitado')).catch(avisar)}
      onSemana={(n) => setDesfase((v) => (n === 0 ? 0 : v + n))} onDia={onDia} onAbrirItem={abrirItem} />
  );
}

// ───────────────────────── Ideas ─────────────────────────
export function IdeasVista({ ideas = [], puedeEditar = false, texto = '', onTexto, onGuardar, guardando = false, onAbrir, onPromover, mic = null }) {
  const { theme } = useTheme();
  return (
    <>
      {puedeEditar && (
        <div style={{ padding: '0 16px 12px', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <CampoM value={texto} onChange={onTexto} placeholder="Una idea o nota, en una línea…" onEnter={onGuardar} />
          {mic}
          <BotonM primario disabled={guardando || !String(texto).trim()} onClick={onGuardar}><Plus size={16} style={{ verticalAlign: '-3px' }} /> Guardar</BotonM>
        </div>
      )}
      {ideas.length === 0
        ? <Vacio icon={Lightbulb} titulo="Sin ideas guardadas" sub={puedeEditar ? 'Escríbela arriba; después la conviertes en pendiente.' : 'Aquí aparecen sus ideas y notas.'} style={{ padding: '26px 16px' }} />
        : (
          <ListaAgrupada titulo="Ideas y notas" meta={`${ideas.length}`}>
            {ideas.map((it) => (
              <div key={it.id} style={{ background: theme.surface, padding: '10px 16px' }}>
                <div role="button" onClick={() => onAbrir?.(it)} style={{ minHeight: 44, display: 'flex', flexDirection: 'column', justifyContent: 'center', cursor: 'pointer' }}>
                  <span style={{ fontSize: 15, fontWeight: 500, lineHeight: 1.3, color: theme.text }}>{it.titulo}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 3, fontSize: 12, color: theme.textMuted }}>
                    <Pill size="xs" tone={it.tipo === 'nota' ? 'gray' : 'purple'}>{it.tipo}</Pill>
                    {it.cliente_key && it.cliente_key !== 'interno' && <span style={{ color: '#C77700', fontWeight: 600 }}>{nombreClienteAgenda(it.cliente_key)}</span>}
                    {it.created_at && <span>{fechaCorta(it.created_at)}</span>}
                  </span>
                </div>
                {puedeEditar && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                    <BotonM primario style={{ flex: 1 }} onClick={() => onPromover?.(it, 'hoy')}>→ Hoy</BotonM>
                    <BotonM style={{ flex: 1 }} onClick={() => onPromover?.(it, null)}>→ Pendiente</BotonM>
                  </div>
                )}
              </div>
            ))}
          </ListaAgrupada>
        )}
      <div style={{ height: 110 }} />
    </>
  );
}

export function IdeasM({ d, propietario, puedeEditar, hoy, abrirItem }) {
  const [texto, setTexto] = useState('');
  const [guardando, setGuardando] = useState(false);
  const ideas = useMemo(() => ideasDe(d.items || [], propietario), [d.items, propietario]);
  const guardar = async () => {
    const t = texto.trim(); if (!t || guardando) return;
    setGuardando(true);
    try {
      // Misma captura de la web con el prefijo «idea:»; `bandeja: false` para que caiga directo en esta lista.
      await crearDesdeCaptura(/^(idea|ideas|nota|apunte)\s*[:\-–]/i.test(t) ? t : `idea: ${t}`, { personas: d.personas, propietario, hoy, extra: { bandeja: false } });
      setTexto(''); toast.ok('Idea guardada');
    } catch (e) { avisar(e); } finally { setGuardando(false); }
  };
  const promover = (it, cuando) => actualizarItem(it.id, parchePromoverIdea(cuando === 'hoy' ? isoDia(hoy) : null))
    .then(() => toast.ok(cuando === 'hoy' ? 'Pendiente para hoy' : 'Ahora es un pendiente')).catch(avisar);
  return <IdeasVista ideas={ideas} puedeEditar={puedeEditar} texto={texto} onTexto={setTexto} onGuardar={guardar} guardando={guardando} onAbrir={abrirItem} onPromover={promover}
    mic={<BotonMic onTexto={(t) => setTexto((v) => (v ? `${v} ${t}` : t))} />} />;
}

// ───────────────────────── Equipo ─────────────────────────
export function EquipoVista({ equipo = [], uid = null, miCheckin = '', onCheckin, onGuardarCheckin, puedeCheckin = true, onVerAgenda }) {
  const { theme } = useTheme();
  return (
    <>
      {puedeCheckin && (
        <ListaAgrupada titulo="Mi check-in de hoy" meta="¿qué hiciste hoy? lo ve el equipo">
          <div style={{ padding: '10px 16px', display: 'flex', gap: 8, background: theme.surface }}>
            <CampoM value={miCheckin} onChange={onCheckin} placeholder="Cerré la propuesta, cuadré apoyos…" onEnter={onGuardarCheckin} />
            <BotonM primario disabled={!String(miCheckin).trim()} onClick={onGuardarCheckin}>Guardar</BotonM>
          </div>
        </ListaAgrupada>
      )}
      {equipo.length === 0 && <Vacio icon={Users} titulo="Sin equipo que mostrar" style={{ padding: '26px 16px' }} />}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px 0' }}>
        {equipo.map(({ persona: p, hechas, abiertas, atrasadas, deHoy, checkin }) => (
          <div key={p.user_id} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14, fontFamily: TYPO.fontText }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Avatar persona={p} size={34} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.nombre}{p.user_id === uid ? ' (yo)' : ''}</div>
                <div style={{ fontSize: 12, color: theme.textMuted }}>{hechas} hecha{hechas === 1 ? '' : 's'} · {abiertas} abierta{abiertas === 1 ? '' : 's'}</div>
              </div>
              {atrasadas > 0 ? <Pill tone="red" size="xs">{atrasadas} atrasada{atrasadas === 1 ? '' : 's'}</Pill> : <Pill tone="green" size="xs">al día</Pill>}
            </div>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
              {deHoy.slice(0, 4).map((it) => <div key={it.id} style={{ fontSize: 13.5, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>· {it.titulo}</div>)}
              {deHoy.length > 4 && <div style={{ fontSize: 12, color: theme.textMuted }}>y {deHoy.length - 4} más</div>}
              {deHoy.length === 0 && <div style={{ fontSize: 13, color: theme.textMuted }}>Sin pendientes para hoy.</div>}
            </div>
            <div style={{ marginTop: 10, paddingTop: 8, borderTop: `1px solid ${theme.border}`, fontSize: 12.5, color: theme.textMuted, lineHeight: 1.4 }}>
              {checkin?.respuesta ? <><b style={{ color: theme.text }}>Check-in:</b> {checkin.respuesta}</> : 'Sin check-in hoy.'}
            </div>
            {onVerAgenda && p.user_id !== uid && <BotonM style={{ width: '100%', marginTop: 10 }} onClick={() => onVerAgenda(p)}>Ver agenda de {String(p.nombre || '').split(' ')[0]}</BotonM>}
          </div>
        ))}
      </div>
      <div style={{ height: 110 }} />
    </>
  );
}

/** `personas` = a quién puede ver quien entra (el mismo criterio del selector de persona de AgendaM). */
export function EquipoM({ d, uid, personas, hoy, puedeCheckin, onVerAgenda }) {
  const hoyIso = isoDia(hoy);
  const [resp, setResp] = useState(() => checkinDe(d.checkins || [], uid, hoyIso)?.respuesta || '');
  const equipo = useMemo(() => equipoDe(d, personas, hoy), [d, personas, hoy]);
  const guardar = () => { if (!resp.trim()) return; guardarCheckin(uid, hoyIso, 'dia', resp.trim()).then(() => toast.ok('Check-in guardado')).catch(avisar); };
  return <EquipoVista equipo={equipo} uid={uid} miCheckin={resp} onCheckin={setResp} onGuardarCheckin={guardar} puedeCheckin={puedeCheckin} onVerAgenda={onVerAgenda} />;
}
