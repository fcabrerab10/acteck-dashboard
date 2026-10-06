// Ficha de una persona en el celular (pantalla empujada desde Equipo.jsx) · 3.88.0 (2026-10-06, mockup 2c58bf4c):
//   TituloGrande (nombre · puesto · ritmo · «activa hace 8 min») → chips Su día · Semana · Pendientes · Evaluación →
//   HeroM «Hoy» (armó su día, hechos, plan vs real, vencidos; si cerró: hora, energía y reflexión) → 4 KpiM (Hoy · Esta
//   semana · A tiempo · Vencidos) → la vista del chip:
//     · Su día     → SuDia (Mi ritmo, la lista de hoy con hora y estado, la reflexión del cierre).
//     · Semana     → entradas por día (L–D con minutos) + «lo que más tocó» + día por día con sesiones y acciones.
//     · Pendientes → abiertos por fecha: palomita cierra, tocar abre en la Agenda, deslizar = Reasignar (HojaM con el equipo).
//     · Evaluación → EvaluacionM.jsx (sólo perfiles.se_evalua).
//   Botones: «Mandar mensaje» (texto con sus vencidos y lo de hoy; con perfiles.telefono abre su chat de WhatsApp directo,
//   si no, la hoja de compartir) · «Reasignar pendientes» (todos los vencidos a otra persona del equipo).
// Todo el cálculo viene de src/modules/interno/equipo/calculo.js (web) y ./calculo.js (celular). Sin costos ni márgenes.
import React, { useMemo, useState } from 'react';
import { CalendarCheck, ChevronRight, MessageCircle, UserPlus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { AvatarImg } from '../../../lib/avatar';
import { fechaCorta } from '../../../lib/format';
import { compartir } from '../../../lib/whatsapp';
import { completarItem, actualizarItem } from '../../../modules/agenda5/base/datos';
import { isoDia, sumarDias, inicioSemana } from '../../../modules/interno/equipo/calculo.js';
import { fmtHm, fmtHmCorto, fmtHora, fmtDiaLargo, plural, nombreCorto, PAGINA_LABEL, CLIENTE_LABEL } from '../../../modules/interno/equipo/textos.js';
import { useInvalidarEquipo } from '../../../modules/interno/equipo/datos.js';
import SuDia, { datosSuDia } from '../../../modules/interno/equipo/SuDia';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Cabecera, Segmented, Pill, Vacio, BotonGrande, HojaM, Fila, FilaDeslizable, toast } from '../../piezas';
import { PalomitaM } from '../agenda5/comun';
import { subPersona, frasePersonaHoy, subPersonaHoy, vencidosPorGrupo, diasSemana, loQueMasToco, textoMensaje, urlWhatsApp } from './calculo';
import EvaluacionM from './EvaluacionM';

export default function Persona({ u, datos, agendaDisponible, evaluaciones, mesActual, registrosHoy = [], internos = [] }) {
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const invalidar = useInvalidarEquipo();
  const [reasignar, setReasignar] = useState(null);   // null | { items: [...] }
  if (!u) return null;

  const mandarMensaje = async () => {
    const s = datosSuDia({ u, agenda: datos?.agenda, registrosHoy });
    const texto = textoMensaje({ u, vencidos: datos?.vencidos || [], deHoy: s.deHoy, hoy });
    // Con celular en el perfil (perfiles.telefono, 3.88.2) abre su chat de WhatsApp directo; si no, la hoja de compartir.
    const url = urlWhatsApp(u.telefono, texto);
    if (url) { const w = window.open(url, '_blank', 'noopener'); if (!w) window.location.href = url; return; }
    const ok = await compartir(texto, { titulo: `Pendientes de ${nombreCorto(u.nombre || u.email)}` });
    if (!ok) toast.info('Texto copiado: pégalo en WhatsApp');
  };
  const reasignarA = async (destino) => {
    const items = reasignar?.items || [];
    setReasignar(null);
    if (!items.length || !destino) return;
    try {
      for (const it of items) await actualizarItem(it.id, { responsables: [destino.user_id] }, { prevResponsables: it.responsables || [] });
      toast.ok(`${plural(items.length, 'pendiente')} ahora de ${nombreCorto(destino.nombre || destino.email)}`);
      invalidar(); nav.pop();
    } catch (e) { toast.error(`No se pudo reasignar: ${e.message || e}`); }
  };

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Equipo" />
      <PersonaVista u={u} datos={datos} agendaDisponible={agendaDisponible} evaluaciones={evaluaciones} mesActual={mesActual} registrosHoy={registrosHoy} hoy={hoy}
        nav={nav} invalidar={invalidar} onMensaje={mandarMensaje} onReasignar={(items) => setReasignar({ items })} />
      <HojaM abierto={!!reasignar} onClose={() => setReasignar(null)} titulo="Reasignar" sub={reasignar ? `${plural(reasignar.items.length, 'pendiente')} de ${nombreCorto(u.nombre || u.email)} · ¿a quién?` : ''} alto="60vh">
        <ListaAgrupada pie="La persona recibe el aviso de «asignado» de la Agenda.">
          {internos.filter((p) => p.user_id !== u.user_id).map((p) => (
            <Fila key={p.user_id} avatar={<AvatarImg perfil={p} size={32} />} titulo={p.nombre || p.email} sub={p.puesto || p.rol || '—'} onClick={() => reasignarA(p)} />
          ))}
          {internos.filter((p) => p.user_id !== u.user_id).length === 0 && <Vacio icon={null} titulo="No hay a quién" sub="No hay más internos activos." style={{ padding: 16 }} />}
        </ListaAgrupada>
      </HojaM>
    </>
  );
}

/** Vista pura: la prueba SSR la renderiza con datos de ejemplo. */
export function PersonaVista({ u, datos, agendaDisponible, evaluaciones, mesActual, registrosHoy = [], hoy, nav, invalidar, onMensaje, onReasignar, vistaInicial = 'dia' }) {
  const { theme } = useTheme();
  const hoyIso = isoDia(hoy);
  const { tele, acc, agenda, vencidos = [] } = datos || {};
  const externo = u?.tipo === 'externo';
  const [vista, setVista] = useState(vistaInicial);
  const s = useMemo(() => datosSuDia({ u, agenda, registrosHoy }), [u, agenda, registrosHoy]);

  const opciones = externo ? [{ id: 'semana', label: 'Semana' }] : [{ id: 'dia', label: 'Su día' }, { id: 'semana', label: 'Semana' }, { id: 'pendientes', label: 'Pendientes', badge: agenda?.abiertos || 0 }];
  if (u?.se_evalua) opciones.push({ id: 'evaluacion', label: 'Evaluación' });
  const vistaActiva = opciones.some((o) => o.id === vista) ? vista : opciones[0].id;
  const totalHoy = s.deHoy.length + s.hechas.length;

  return (
    <>
      <TituloGrande titulo={u.nombre || u.email} sub={subPersona({ u, tele, hoy })} derecha={<AvatarImg perfil={u} size={44} />} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
        <div style={{ padding: '0 16px' }}>
          <Segmented size="md" value={vistaActiva} onChange={setVista} options={opciones} style={{ display: 'flex', width: '100%' }} />
        </div>

        {externo ? (
          <HeroM eyebrow="Externo" frase={tele?.ultimo ? `Entró por última vez ${fmtDiaLargo(isoDia(tele.ultimo))}${tele.clienteTop ? ` y ve sobre todo ${CLIENTE_LABEL[tele.clienteTop]}` : ''}.` : 'No ha entrado en los últimos 28 días.'}
            sub={`${plural(tele?.sesionesSemana || 0, 'sesión', 'sesiones')} esta semana · ${fmtHmCorto(tele?.minutosSemana || 0)}`} />
        ) : (
          <HeroM eyebrow={`Hoy · ${fmtDiaLargo(hoyIso)}`} frase={frasePersonaHoy({ u, s, vencidos, registro: s.registro, hoy })} sub={subPersonaHoy({ registro: s.registro, tele })} />
        )}

        {!externo && (
          <KpiGrid>
            <KpiM eyebrow="Hoy" big={<>{s.hechas.length} <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>de {totalHoy}</span></>}
              sub={s.plan > 0 ? `${fmtHmCorto(s.real || 0)} de ${fmtHmCorto(s.plan)} planeadas` : totalHoy ? 'sin tiempos planeados' : 'sin armar su día'} progress={totalHoy ? Math.round((s.hechas.length / totalHoy) * 100) : undefined} />
            <KpiM eyebrow="Esta semana" big={fmtHmCorto(tele?.minutosSemana || 0)} sub={`${plural(tele?.sesionesSemana || 0, 'sesión', 'sesiones')} · ${plural(tele?.diasActivosSemana || 0, 'día')} de 5`} />
            <KpiM eyebrow="A tiempo" big={agenda?.pctATiempo != null ? `${agenda.pctATiempo} %` : '—'} sub={agenda ? `últimos 30 días · ${plural(agenda.cerrados || 0, 'cerrado')}` : 'Agenda no disponible'} progress={agenda?.pctATiempo ?? undefined} />
            <KpiM eyebrow="Vencidos" big={vencidos.length} bigColor={vencidos.length ? theme.red : theme.green} sub={vencidos.length ? vencidosPorGrupo(vencidos) : 'ninguno'} onClick={vencidos.length ? () => setVista('pendientes') : undefined} />
          </KpiGrid>
        )}

        {vistaActiva === 'dia' && (agendaDisponible
          ? <ListaAgrupada titulo="Su día" meta={totalHoy ? `${totalHoy} · ${s.hechas.length} hechos` : 'Mi ritmo'}><div style={{ padding: '8px 16px 10px' }}><SuDia u={u} agenda={agenda} registrosHoy={registrosHoy} compacto /></div></ListaAgrupada>
          : <Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Agenda no disponible" sub="No se pudieron leer sus pendientes en este dispositivo." />)}
        {vistaActiva === 'semana' && <Semana tele={tele} acc={acc} hoy={hoy} />}
        {vistaActiva === 'pendientes' && <Pendientes agenda={agenda} agendaDisponible={agendaDisponible} hoyIso={hoyIso} nav={nav} invalidar={invalidar} onReasignar={onReasignar} />}
        {vistaActiva === 'evaluacion' && u.se_evalua && <EvaluacionM u={u} agenda={agenda} evaluaciones={evaluaciones} mesActual={mesActual} />}

        {!externo && vistaActiva !== 'evaluacion' && (
          <div style={{ display: 'flex', gap: 8, padding: '0 16px' }}>
            <BotonGrande primario icon={MessageCircle} onClick={onMensaje} style={{ flex: 1 }}>{u.telefono ? 'WhatsApp' : 'Mandar mensaje'}</BotonGrande>
            <BotonGrande icon={UserPlus} disabled={!vencidos.length} onClick={() => onReasignar?.(vencidos)} style={{ flex: 1 }}>Reasignar vencidos</BotonGrande>
          </div>
        )}
        {!externo && vistaActiva !== 'evaluacion' && !u.telefono && (
          <div style={{ padding: '0 20px', fontSize: 11, color: theme.textSubtle || theme.textMuted, textAlign: 'center' }}>Sin celular en su perfil: el mensaje sale por la hoja de compartir. Se captura en Preferencias › Yo o en Administración.</div>
        )}
      </div>
    </>
  );
}

// ─── Semana: L–D con minutos, lo que más tocó, y día por día (hoy arriba) con sesiones y acciones ───
function Semana({ tele, acc, hoy }) {
  const { theme } = useTheme();
  const inicio = useMemo(() => inicioSemana(hoy), [hoy]);
  const semana = useMemo(() => diasSemana(tele, { hoy, inicio }), [tele, hoy, inicio]);
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDia(sumarDias(hoy, -i))), [hoy]);
  const sesPorDia = useMemo(() => {
    const m = new Map();
    for (const s of tele?.sesiones || []) { if (!m.has(s.dia)) m.set(s.dia, []); m.get(s.dia).push(s); }
    return m;
  }, [tele]);
  const accPorDia = useMemo(() => new Map((acc?.porDia || []).map((d) => [d.dia, d.items])), [acc]);
  const sub = { fontSize: 11, color: theme.textMuted };
  const hoyIso = isoDia(hoy);
  const semIso = isoDia(inicio);

  return (
    <>
      <section style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Semana</span>
          <span style={sub}>entradas por día</span>
        </div>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 10px 10px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, textAlign: 'center' }}>
            {semana.map((d) => (
              <div key={d.dia} style={{ opacity: d.futuro ? 0.45 : 1 }}>
                <div style={{ width: 26, height: 26, borderRadius: 999, margin: '0 auto', display: 'grid', placeItems: 'center', fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600,
                  background: d.minutos > 0 ? theme.green : d.futuro ? 'transparent' : `${theme.red}22`, color: d.minutos > 0 ? '#FFF' : d.futuro ? theme.textMuted : theme.red, border: d.hoy ? `2px solid ${theme.accent}` : '2px solid transparent' }}>{d.letra}</div>
                <div style={{ ...sub, marginTop: 4, fontVariantNumeric: 'tabular-nums' }}>{d.minutos > 0 ? fmtHmCorto(d.minutos) : d.futuro ? '' : '—'}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 12, color: theme.text, marginTop: 10, lineHeight: 1.4 }}>{loQueMasToco(acc, tele, { paginaLabel: PAGINA_LABEL })}</div>
          {tele?.clienteTop && <div style={{ ...sub, marginTop: 4 }}>Cliente que más ve: {CLIENTE_LABEL[tele.clienteTop]} · {tele.pctClienteTop} % del tiempo</div>}
        </div>
      </section>

      <section style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Día por día</span>
          <span style={sub}>últimos 7 días</span>
        </div>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>
          {dias.map((d, i) => {
            const ses = sesPorDia.get(d) || [];
            const accs = accPorDia.get(d) || [];
            const vacio = !ses.length && !accs.length;
            const eventos = [
              ...ses.map((s) => ({ ts: s.inicio, tipo: 'sesion', s })),
              ...accs.map((a) => ({ ts: a.ts, tipo: 'accion', a })),
            ].sort((x, y) => String(y.ts).localeCompare(String(x.ts)));
            return (
              <div key={d} style={{ padding: '9px 12px', borderTop: i === 0 ? 0 : `1px solid ${theme.border}`, opacity: d < semIso ? 0.75 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: vacio ? theme.textMuted : theme.text, textTransform: 'capitalize' }}>
                    {fmtDiaLargo(d)}{d === hoyIso ? ' · hoy' : ''}
                  </span>
                  <span style={{ ...sub, whiteSpace: 'nowrap' }}>
                    {vacio ? 'sin actividad' : `${fmtHm(ses.reduce((s, x) => s + x.minutos, 0))}${accs.length ? ` · ${plural(accs.length, 'acción', 'acciones')}` : ''}`}
                  </span>
                </div>
                {eventos.map((e, k) => (
                  <div key={k} style={{ display: 'grid', gridTemplateColumns: '86px 1fr', gap: 8, fontSize: 12, padding: '3px 0', color: theme.text, alignItems: 'baseline' }}>
                    <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>
                      {e.tipo === 'sesion' ? `${fmtHora(e.s.inicio)}–${fmtHora(e.s.fin)}` : fmtHora(e.a.ts)}
                    </span>
                    {e.tipo === 'sesion'
                      ? <span>Sesión de {fmtHm(e.s.minutos)}{topPaginas(e.s.paginas)}</span>
                      : <span><span style={{ width: 6, height: 6, borderRadius: 999, background: theme.accent, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />{e.a.label}{e.a.cliente_key ? <span style={sub}> · {e.a.cliente_key}</span> : null}</span>}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

function topPaginas(paginas) {
  const top = Object.entries(paginas || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => PAGINA_LABEL[p] || `p${p}`);
  return top.length ? ` · ${top.join(', ')}` : '';
}

// ─── Pendientes de Agenda (abiertos): palomita cierra · tocar abre en la Agenda · deslizar = Reasignar ───
function Pendientes({ agenda, agendaDisponible, hoyIso, nav, invalidar, onReasignar }) {
  const { theme } = useTheme();
  const [cerrados, setCerrados] = useState(() => new Set());

  if (!agendaDisponible) return <Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Agenda no disponible" sub="No se pudieron leer los pendientes en este dispositivo." />;
  const lista = (agenda?.listaAbiertos || []).filter((i) => !cerrados.has(i.id));
  if (!lista.length) return <Vacio titulo="Sin pendientes abiertos" sub="No tiene tareas ni puntos de reunión por cerrar." />;

  const cerrar = async (item) => {
    setCerrados((s) => new Set(s).add(item.id));
    try { await completarItem(item, true); toast.ok('Pendiente cerrado'); invalidar?.(); }
    catch (e) { setCerrados((s) => { const n = new Set(s); n.delete(item.id); return n; }); toast.error(e.message || String(e)); }
  };
  const abrirEnAgenda = (item) => nav?.navegar?.({ pagina: 'agenda', label: 'Agenda', extra: { itemId: item.id } });

  const vencidos = lista.filter((i) => i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso);
  const resto = lista.filter((i) => !vencidos.includes(i));

  // Fila propia (no `Fila` del kit): la palomita es un botón y no puede anidarse dentro de otro botón.
  const bloque = (titulo, items, tone) => items.length > 0 && (
    <ListaAgrupada titulo={titulo} meta={String(items.length)}>
      {items.map((i) => (
        <FilaDeslizable key={i.id} acciones={[{ label: 'Reasignar', icon: UserPlus, color: theme.accent, onClick: () => onReasignar?.([i]) }]}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', minHeight: 56, boxSizing: 'border-box', background: theme.surface }}>
            <PalomitaM hecha={false} onClick={() => cerrar(i)} />
            <div role="button" onClick={() => abrirEnAgenda(i)} style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}>
              <div style={{ fontSize: 14.5, fontWeight: 500, letterSpacing: '-0.01em', color: theme.text, lineHeight: 1.25, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{i.titulo || '—'}</div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {[i.cliente_key || null, i.fecha_limite ? `límite ${fechaCorta(i.fecha_limite)}` : 'sin fecha', i.tipo === 'punto' ? 'punto de reunión' : null].filter(Boolean).join(' · ')}
              </div>
            </div>
            {i.prioridad === 'alta' && <Pill tone="red" size="xs" dot>alta</Pill>}
            {tone && <Pill tone={tone} size="xs">vencido</Pill>}
            <ChevronRight size={15} style={{ color: theme.textSubtle || theme.textMuted, flexShrink: 0 }} />
          </div>
        </FilaDeslizable>
      ))}
    </ListaAgrupada>
  );

  return (
    <>
      {bloque('Vencidos', vencidos, 'red')}
      {bloque('Abiertos', resto, null)}
      <div style={{ padding: '0 20px', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, lineHeight: 1.4 }}>
        Palomita = hecho · tocar = abrir en la Agenda · deslizar a la izquierda = reasignar a otra persona.
      </div>
    </>
  );
}
