// Ficha de una persona en el celular (pantalla empujada desde Equipo.jsx).
//   Hero: última entrada · sesiones y tiempo de la semana · cumplimiento de pendientes a 30 días.
//   Segmented: Semana · Pendientes · Evaluación (esta última sólo si perfiles.se_evalua).
//     · Semana    → día por día: sesiones (hora, minutos, pantallas) y acciones traducidas de la auditoría.
//     · Pendientes→ ítems abiertos de Agenda: palomita para cerrarlos y toque para abrirlos en la Agenda móvil.
//     · Evaluación→ EvaluacionM.jsx (captura con guardado al momento, cierre y historial de 12 meses).
// Todo el cálculo viene de src/modules/interno/equipo/calculo.js (el mismo de la web). Sin costos ni márgenes.
import React, { useMemo, useState } from 'react';
import { CalendarCheck, ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { AvatarImg } from '../../../lib/avatar';
import { fechaCorta } from '../../../lib/format';
import { completarItem } from '../../../modules/agenda/datos';
import { isoDia, sumarDias, inicioSemana } from '../../../modules/interno/equipo/calculo.js';
import { fmtHm, fmtHmCorto, fmtHora, fmtDiaLargo, plural, textoInactividad, PAGINA_LABEL, CLIENTE_LABEL } from '../../../modules/interno/equipo/textos.js';
import { useInvalidarEquipo } from '../../../modules/interno/equipo/datos.js';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, ListaAgrupada, Cabecera, Segmented, Pill, Vacio, toast } from '../../piezas';
import { PalomitaM } from '../agenda/comun';
import { ultimaEntrada } from './piezas';
import EvaluacionM from './EvaluacionM';

export default function Persona({ u, datos, agendaDisponible, evaluaciones, mesActual }) {
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const { tele, acc, agenda, inact } = datos || {};
  const [vista, setVista] = useState('semana');
  const inactTxt = u?.tipo === 'externo' ? null : textoInactividad(inact);

  const opciones = [{ id: 'semana', label: 'Semana' }, { id: 'pendientes', label: 'Pendientes', badge: agenda?.abiertos || 0 }];
  if (u?.se_evalua) opciones.push({ id: 'evaluacion', label: 'Evaluación' });

  if (!u) return null;

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo={u.nombre || u.email} sub={u.puesto || u.rol || '—'}
        derecha={<AvatarImg perfil={u} size={44} />} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
        <HeroM eyebrow="Última entrada"
          frase={ultimaEntrada(tele?.ultimo, hoyIso)}
          sub={inactTxt ? `Atención · ${inactTxt}` : tele?.activoHoy ? 'Activo hoy.' : `${plural(tele?.diasActivosSemana ?? 0, 'día')} de 5 esta semana.`}
          stats={[
            { k: 'Sesiones', v: tele?.sesionesSemana ?? 0, sub: 'esta semana' },
            { k: 'Tiempo', v: fmtHmCorto(tele?.minutosSemana || 0), sub: 'esta semana' },
            { k: 'A tiempo', v: agenda?.pctATiempo != null ? `${agenda.pctATiempo}%` : '—', sub: '30 días' },
          ]} />

        <div style={{ padding: '0 16px' }}>
          <Segmented size="md" value={vista} onChange={setVista} options={opciones} style={{ display: 'flex', width: '100%' }} />
        </div>

        {vista === 'semana' && <Semana tele={tele} acc={acc} hoy={hoy} />}
        {vista === 'pendientes' && <Pendientes agenda={agenda} agendaDisponible={agendaDisponible} hoyIso={hoyIso} nav={nav} />}
        {vista === 'evaluacion' && u.se_evalua && <EvaluacionM u={u} agenda={agenda} evaluaciones={evaluaciones} mesActual={mesActual} />}
      </div>
    </>
  );
}

// ─── Semana: últimos 7 días (hoy arriba) con sesiones y acciones ───
function Semana({ tele, acc, hoy }) {
  const { theme } = useTheme();
  const dias = useMemo(() => Array.from({ length: 7 }, (_, i) => isoDia(sumarDias(hoy, -i))), [hoy]);
  const sesPorDia = useMemo(() => {
    const m = new Map();
    for (const s of tele?.sesiones || []) { if (!m.has(s.dia)) m.set(s.dia, []); m.get(s.dia).push(s); }
    return m;
  }, [tele]);
  const accPorDia = useMemo(() => new Map((acc?.porDia || []).map((d) => [d.dia, d.items])), [acc]);
  const sub = { fontSize: 11, color: theme.textMuted };
  const hoyIso = isoDia(hoy);
  const semIso = isoDia(inicioSemana(hoy));

  return (
    <>
      <div style={{ padding: '0 20px', display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={sub}>Pantallas de la semana:</span>
        {tele?.paginasTop?.length
          ? tele.paginasTop.map(([p, n]) => <Pill key={p} tone="gray" size="xs">{PAGINA_LABEL[p] || `p${p}`} · {fmtHmCorto(n)}</Pill>)
          : <span style={sub}>sin registro</span>}
        {tele?.clienteTop && <Pill tone="blue" size="xs">{CLIENTE_LABEL[tele.clienteTop]} · {tele.pctClienteTop}%</Pill>}
      </div>

      <section style={{ padding: '0 16px' }}>
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

// ─── Pendientes de Agenda (abiertos) ───
function Pendientes({ agenda, agendaDisponible, hoyIso, nav }) {
  const { theme } = useTheme();
  const invalidar = useInvalidarEquipo();
  const [cerrados, setCerrados] = useState(() => new Set());

  if (!agendaDisponible) return <Vacio icon={CalendarCheck} color={theme.textMuted} titulo="Agenda no disponible" sub="No se pudieron leer los pendientes en este dispositivo." />;
  const lista = (agenda?.listaAbiertos || []).filter((i) => !cerrados.has(i.id));
  if (!lista.length) return <Vacio titulo="Sin pendientes abiertos" sub="No tiene tareas ni puntos de reunión por cerrar." />;

  const cerrar = async (item) => {
    setCerrados((s) => new Set(s).add(item.id));
    try { await completarItem(item, true); toast.ok('Pendiente cerrado'); invalidar(); }
    catch (e) { setCerrados((s) => { const n = new Set(s); n.delete(item.id); return n; }); toast.error(e.message || String(e)); }
  };
  const abrirEnAgenda = (item) => nav.navegar({ pagina: 'agenda', label: 'Agenda', extra: { itemId: item.id } });

  const vencidos = lista.filter((i) => i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso);
  const resto = lista.filter((i) => !vencidos.includes(i));

  // Fila propia (no `Fila` del kit): la palomita es un botón y no puede anidarse dentro de otro botón.
  const bloque = (titulo, items, tone) => items.length > 0 && (
    <ListaAgrupada titulo={titulo} meta={String(items.length)}>
      {items.map((i) => (
        <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 12px', minHeight: 56, boxSizing: 'border-box' }}>
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
      ))}
    </ListaAgrupada>
  );

  return (
    <>
      {bloque('Vencidos', vencidos, 'red')}
      {bloque('Abiertos', resto, null)}
      <div style={{ padding: '0 20px', fontSize: 11.5, color: theme.textSubtle || theme.textMuted, display: 'flex', alignItems: 'center', gap: 4 }}>
        Toca un pendiente para abrirlo en la Agenda <ChevronRight size={13} />
      </div>
    </>
  );
}
