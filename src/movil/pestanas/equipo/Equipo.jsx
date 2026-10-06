// Actividad del equipo en el celular (página global `telemetria`, sólo super admin) · 3.88.0 (2026-10-06), formato
// estándar del celular según el mockup 2c58bf4c aprobado por Fernando:
//   Cabecera → TituloGrande → HeroM (quiénes entraron hoy, vencidos del equipo y quién los concentra, % a tiempo, el más
//   rezagado) → 4 KpiM (Activos hoy · Pendientes a tiempo · Vencidos del equipo · Evaluaciones) → GraficaScrub «actividad
//   por día · 4 semanas» (personas activas y horas) → chips del umbral de inactividad (2 · 3 · 5 días hábiles, el MISMO
//   valor que la web: perfiles.preferencias.equipo.umbralInactividad) → lista de internos (ritmo · día armado · plan vs
//   real · vencidos · pill de estado; deslizar a la izquierda = recordar vencidos una vez al día, ver recordar.js) →
//   externos plegados. Tocar una persona empuja Persona.jsx.
// La lógica es la de la web (src/modules/interno/equipo/{datos,calculo,textos}.js) + la pura del celular en ./calculo.js.
// Sin costos ni márgenes.
import React, { useMemo, useState } from 'react';
import { Users, Lock, ChevronDown, ChevronRight } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando } from '../../../components/kit';
import { useDatosEquipo, useUmbralInactividad, useIndicesPorUsuario, useInvalidarEquipo } from '../../../modules/interno/equipo/datos.js';
import { resumenTelemetria, resumenAcciones, cumplimientoAgenda, inactividad, evaluacionPendiente, pulsoEquipo, ordenarPersonas, isoDia, inicioSemana, UMBRALES_INACTIVIDAD } from '../../../modules/interno/equipo/calculo.js';
import { plural, nombreCorto, MESES_CORTO } from '../../../modules/interno/equipo/textos.js';
import { useNav } from '../../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Cabecera, Vacio, GraficaScrub, LeyendaScrub, ChipsPay, toast } from '../../piezas';
import { Deslizable, FilaPersona } from './piezas';
import { recordarPendientes, yaRecordadoHoy } from './recordar';
import { serieActividadDias, etiquetaDia, vencidosPorPersona, lineaVencidos, masRezagado, ultimoEnEntrar, haceCuanto, fraseEquipo, subEquipo } from './calculo';
import Persona from './Persona';

const DIAS_LARGO = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export default function Equipo() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = nav?.perfil;
  const esAdmin = perfil?.es_super_admin === true || perfil?.rol === 'super_admin';
  const [umbral, setUmbral] = useUmbralInactividad();
  const [recordados, setRecordados] = useState({});   // user_id → true (para pintar la pill al instante)
  const invalidar = useInvalidarEquipo();

  const datos = useDatosEquipo(esAdmin);
  const { usuarios, eventos, auditoria, agenda, evaluaciones, mesActual, cargando, error } = datos;
  const { eventosPor, auditoriaPor } = useIndicesPorUsuario(eventos, auditoria);

  const hoy = useMemo(() => new Date(), []);
  const hoyIso = isoDia(hoy);
  const visibles = useMemo(() => (usuarios || []).filter((u) => u.activo !== false && u.user_id), [usuarios]);
  const internos = useMemo(() => visibles.filter((u) => u.tipo !== 'externo'), [visibles]);
  const externos = useMemo(() => visibles.filter((u) => u.tipo === 'externo'), [visibles]);

  const porUsuario = useMemo(() => {
    const m = new Map();
    const desdeSemana = inicioSemana(hoy);
    for (const u of visibles) {
      const tele = resumenTelemetria(eventosPor.get(u.user_id) || [], { hoy, desdeSemana });
      const acc = resumenAcciones(auditoriaPor.get(u.user_id) || [], { hoy });
      const ag = agenda?.disponible ? cumplimientoAgenda(agenda.items, u.user_id, { hoy }) : null;
      const inact = u.tipo === 'externo' ? null : inactividad({ ultimoEvento: tele.ultimo, agenda: ag, hoy, umbral });
      const vencidos = (ag?.listaAbiertos || []).filter((i) => i.fecha_limite && String(i.fecha_limite).slice(0, 10) < hoyIso);
      m.set(u.user_id, { tele, acc, agenda: ag, vencidos, inact, evalPendiente: evaluacionPendiente(u, evaluaciones, { hoy }) });
    }
    return m;
  }, [visibles, eventosPor, auditoriaPor, agenda, evaluaciones, umbral]); // eslint-disable-line react-hooks/exhaustive-deps

  const pulso = useMemo(() => pulsoEquipo(internos, porUsuario, { agendaItems: agenda?.disponible ? agenda.items : null, hoy }), [internos, porUsuario, agenda]); // eslint-disable-line react-hooks/exhaustive-deps
  const internosOrden = useMemo(() => ordenarPersonas(internos, porUsuario), [internos, porUsuario]);
  const externosOrden = useMemo(() => ordenarPersonas(externos, porUsuario), [externos, porUsuario]);
  const evalsPendientes = useMemo(() => internos.filter((u) => porUsuario.get(u.user_id)?.evalPendiente), [internos, porUsuario]);
  const serie = useMemo(() => serieActividadDias(eventos, { hoy, soloUsuarios: new Set(internos.map((u) => u.user_id)) }), [eventos, internos, hoy]);

  const abrir = (u) => nav.push(<Persona u={u} datos={porUsuario.get(u.user_id)} agendaDisponible={!!agenda?.disponible} evaluaciones={evaluaciones} mesActual={mesActual} registrosHoy={datos.registrosHoy || []} internos={internos} />, `equipo-${u.user_id}`);

  const recordar = async (u) => {
    const d = porUsuario.get(u.user_id);
    const vencidos = d?.vencidos || [];
    if (!vencidos.length) { toast.info(`${nombreCorto(u.nombre || u.email)} no tiene pendientes vencidos`); return; }
    if (recordados[u.user_id] || yaRecordadoHoy(u.user_id)) { toast.info(`Ya le recordaste hoy a ${nombreCorto(u.nombre || u.email)}`); return; }
    try {
      const n = await recordarPendientes(u.user_id, vencidos);
      setRecordados((r) => ({ ...r, [u.user_id]: true }));
      toast.ok(`Aviso en camino a ${nombreCorto(u.nombre || u.email)} · ${plural(n, 'pendiente vencido', 'pendientes vencidos')}`);
      invalidar();
    } catch (e) { toast.error(`No se pudo enviar el recordatorio: ${e.message || e}`); }
  };

  const semana = inicioSemana(hoy);
  const cabecera = (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Actividad del equipo" sub={cargando ? 'Sólo la ves tú' : `Semana del ${semana.getDate()} ${MESES_CORTO[semana.getMonth()].toLowerCase()} · ${plural(internos.length, 'interno')} · ${plural(externos.length, 'externo')}`} />
    </>
  );

  if (!esAdmin) return (<>{cabecera}<Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="La actividad del equipo sólo la ve el super admin." /></>);
  if (cargando) return (<>{cabecera}<div style={{ padding: '0 16px' }}><Cargando pantalla="movilEquipo" /></div></>);

  return (
    <>
      {cabecera}
      <EquipoVista
        hoy={hoy} hoyIso={hoyIso} internos={internos} externos={externos} internosOrden={internosOrden} externosOrden={externosOrden}
        porUsuario={porUsuario} pulso={pulso} evalsPendientes={evalsPendientes} serie={serie} agendaDisponible={!!agenda?.disponible}
        umbral={umbral} onUmbral={setUmbral} error={error} recordados={recordados} onAbrir={abrir} onRecordar={recordar} />
    </>
  );
}

/** Vista pura (sin hooks de datos): la prueba scripts/test-equipo-movil.mjs la renderiza con datos de ejemplo. */
export function EquipoVista({ hoy, hoyIso, internos, externos, internosOrden, externosOrden, porUsuario, pulso, evalsPendientes = [], serie = [], agendaDisponible, umbral, onUmbral, error, recordados = {}, onAbrir, onRecordar }) {
  const { theme } = useTheme();
  const [verExternos, setVerExternos] = useState(false);
  const vencidos = useMemo(() => vencidosPorPersona(internos, porUsuario), [internos, porUsuario]);
  const rezagado = masRezagado(internos, porUsuario);
  const ultimo = ultimoEnEntrar(internos, porUsuario);
  const ultimoExterno = ultimoEnEntrar(externos, porUsuario);
  const mesAnt = (hoy.getMonth() + 11) % 12;
  const visibles = internos.length + externos.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, paddingBottom: 8 }}>
      <HeroM eyebrow={`Hoy · ${DIAS_LARGO[hoy.getDay()]} ${hoy.getDate()} ${MESES_CORTO[hoy.getMonth()].toLowerCase()}`}
        frase={fraseEquipo({ pulso, total: internos.length, vencidos, rezagado, agendaDisponible })}
        sub={subEquipo({ pulso, evalsPendientes, hoy })} />

      {error && <div style={{ padding: '0 18px', fontSize: 11.5, color: theme.orange }}>No se pudo cargar todo: {String(error.message || error)}</div>}

      <KpiGrid>
        <KpiM eyebrow="Activos hoy" big={<>{pulso.activosHoy} <span style={{ fontSize: 13, color: theme.textMuted, fontWeight: 500 }}>de {internos.length}</span></>}
          sub={ultimo ? `último: ${ultimo.nombre} ${haceCuanto(ultimo.ts, hoy)}` : 'nadie ha entrado en 28 días'} />
        <KpiM eyebrow="Pendientes a tiempo" big={pulso.pctATiempo != null ? `${pulso.pctATiempo} %` : '—'} sub={agendaDisponible ? 'últimos 30 días · meta 85 %' : 'Agenda no disponible'} progress={pulso.pctATiempo ?? undefined} />
        <KpiM eyebrow="Vencidos del equipo" big={pulso.vencidosEquipo == null ? '—' : pulso.vencidosEquipo} bigColor={pulso.vencidosEquipo > 0 ? theme.red : theme.green}
          sub={agendaDisponible ? lineaVencidos(vencidos) : 'Agenda no disponible'} />
        <KpiM eyebrow="Evaluaciones" big={evalsPendientes.length} bigColor={evalsPendientes.length ? theme.orange : undefined}
          sub={evalsPendientes.length ? `${MESES_CORTO[mesAnt].toLowerCase()} · ${evalsPendientes.map((u) => nombreCorto(u.nombre || u.email)).join(', ')}` : `${plural(internos.filter((u) => u.se_evalua).length, 'persona')} con evaluación · al día`}
          onClick={evalsPendientes.length ? () => onAbrir?.(evalsPendientes[0]) : undefined} />
      </KpiGrid>

      <section style={{ padding: '0 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Actividad por día · 4 semanas</span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>arrastra para leer</span>
        </div>
        <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '8px 6px 6px' }}>
          <GraficaScrub alto={150} datos={serie} etiqueta={etiquetaDia}
            series={[{ key: 'personas', label: 'Personas activas', color: theme.accent, area: true }, { key: 'horas', label: 'Horas activas', color: theme.purple || '#AF52DE' }]}
            formato={(n) => String(n)}
            tooltip={(f) => <><b>{f.label}</b> · {plural(f.personas, 'persona')} · {f.horas} h activas</>} />
          <LeyendaScrub items={[{ label: 'Personas activas', color: theme.accent }, { label: 'Horas activas', color: theme.purple || '#AF52DE' }]} />
        </div>
      </section>

      <div style={{ padding: '0 16px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>Inactivo a partir de</span>
        <ChipsPay value={umbral} onChange={onUmbral} opciones={UMBRALES_INACTIVIDAD.map((n) => [n, `${n} días`])} />
      </div>

      <ListaAgrupada titulo="Acteck · equipo interno" meta={`${internos.length} · ${pulso.activosHoy} hoy`}
        pie="Desliza a la izquierda para recordarle sus pendientes vencidos; toca para abrir su ficha.">
        {internosOrden.map((u) => {
          const d = porUsuario.get(u.user_id);
          const conVencidos = (d?.vencidos || []).length > 0;
          const yaFue = !!recordados[u.user_id] || yaRecordadoHoy(u.user_id);
          return (
            <Deslizable key={u.user_id} onDerecha={() => onAbrir?.(u)} onIzquierda={conVencidos && !yaFue ? () => onRecordar?.(u) : undefined} labelIzquierda="Recordar">
              <FilaPersona u={u} datos={d} hoy={hoy} hoyIso={hoyIso} onAbrir={() => onAbrir?.(u)} recordado={yaFue} />
            </Deslizable>
          );
        })}
        {internos.length === 0 && <div style={{ padding: 14, fontSize: 12.5, color: theme.textMuted }}>Sin usuarios internos activos.</div>}
      </ListaAgrupada>

      {externos.length > 0 && (
        <section style={{ padding: '0 16px' }}>
          <button type="button" onClick={() => setVerExternos((v) => !v)} aria-expanded={verExternos}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, border: 0, background: 'transparent', padding: '4px 2px', cursor: 'pointer', fontFamily: TYPO.fontText, color: theme.text }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em' }}>Externos · clientes y aliados</span>
            <span style={{ fontSize: 11, color: theme.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              {verExternos ? <ChevronDown size={13} /> : <ChevronRight size={13} />}{externos.length}{ultimoExterno ? ` · último ${haceCuanto(ultimoExterno.ts, hoy)}` : ' · nadie en 28 días'}
            </span>
          </button>
          {verExternos && (
            <ListaAgrupada style={{ padding: 0, marginTop: 6 }} pie="Los externos entran cuando quieren: no se les mide inactividad ni pendientes.">
              {externosOrden.map((u) => (
                <Deslizable key={u.user_id} onDerecha={() => onAbrir?.(u)}>
                  <FilaPersona u={u} datos={porUsuario.get(u.user_id)} hoy={hoy} hoyIso={hoyIso} externo onAbrir={() => onAbrir?.(u)} />
                </Deslizable>
              ))}
            </ListaAgrupada>
          )}
        </section>
      )}

      {visibles === 0 && <Vacio icon={Users} color={theme.textMuted} titulo="Sin usuarios" sub="No hay perfiles activos que mostrar." />}
    </div>
  );
}
