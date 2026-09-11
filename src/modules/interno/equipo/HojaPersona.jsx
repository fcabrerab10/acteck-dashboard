// Hoja lateral por persona: línea del tiempo de la semana (sesiones + pantallas + acciones de auditoría),
// pendientes abiertos de Agenda, qué hizo en 4 semanas, y (sólo se_evalua) evaluación mensual + bono + facturado vs cuota.
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { fechaCorta, relativo } from '../../../lib/format';
import { Panel, Pill, Segmented, TablaCompacta } from '../../../components/kit';
import { HojaLateral, hairline, suaveBg } from '../../../components/perfil/comun';
import { AvatarImg } from '../../../lib/avatar';
import { isoDia, sumarDias, inicioSemana } from './calculo.js';
import { fmtHm, fmtHmCorto, fmtHora, fmtDiaLargo, plural, textoInactividad, PAGINA_LABEL, CLIENTE_LABEL, MESES_CORTO } from './textos.js';
import { useDetalleMes, useInvalidarEquipo } from './datos.js';
import Evaluacion from './Evaluacion.jsx';

export default function HojaPersona({ u, datos, abierto, onClose, agendaDisponible, evaluaciones }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const hoy = new Date();
  const { tele, acc, agenda, inact } = datos || {};
  const [vista, setVista] = useState('semana');
  const [mesRef, setMesRef] = useState({ anio: hoy.getFullYear(), mes: hoy.getMonth() + 1 });
  const invalidar = useInvalidarEquipo();

  const meses = useMemo(() => {
    const arr = []; let a = hoy.getFullYear(), m = hoy.getMonth() + 1;
    for (let i = 0; i < 6; i++) { arr.push({ id: `${a}-${m}`, anio: a, mes: m, label: a === hoy.getFullYear() ? MESES_CORTO[m - 1] : `${MESES_CORTO[m - 1]} ${String(a).slice(2)}` }); m -= 1; if (m < 1) { m = 12; a -= 1; } }
    return arr.reverse();
  }, []);
  const detalle = useDetalleMes(u?.user_id, mesRef.anio, mesRef.mes, abierto && !!u?.se_evalua);

  if (!u) return null;
  const inactTxt = textoInactividad(inact);
  const opciones = [{ id: 'semana', label: 'Semana' }, { id: 'acciones', label: '4 semanas', badge: acc?.total || 0 }];
  if (u.se_evalua) opciones.push({ id: 'evaluacion', label: 'Evaluación' });

  return (
    <HojaLateral abierto={abierto} onClose={onClose} theme={theme} ancho={560}
      titulo={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}><AvatarImg perfil={u} size={32} />{u.nombre || u.email}</span>}
      sub={`${u.puesto || u.rol}${u.tipo === 'externo' ? ' · externo' : ''} · ${tele?.ultimo ? `última actividad ${relativo(tele.ultimo)}` : 'sin actividad en 28 días'}`}
      acciones={inactTxt ? <Pill tone={inact.sinEntrar ? 'red' : 'orange'} dot>{inactTxt}</Pill> : tele?.activoHoy ? <Pill tone="green" dot>activo hoy</Pill> : null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 4 }}>
        <Segmented options={opciones} value={vista} onChange={setVista} style={{ display: 'flex' }} />

        {vista === 'semana' && <SeccionSemana tele={tele} acc={acc} agenda={agenda} agendaDisponible={agendaDisponible} hoy={hoy} />}
        {vista === 'acciones' && <SeccionAcciones acc={acc} />}
        {vista === 'evaluacion' && u.se_evalua && (
          <>
            <Segmented options={meses} value={`${mesRef.anio}-${mesRef.mes}`} onChange={(id) => { const m = meses.find((x) => x.id === id); if (m) setMesRef({ anio: m.anio, mes: m.mes }); }} style={{ display: 'flex' }} />
            <Evaluacion user={u} anio={mesRef.anio} mes={mesRef.mes} detalle={detalle.data} cargando={detalle.isLoading} perfilId={perfil?.user_id}
              agenda={agenda} evaluaciones={evaluaciones} onGuardado={() => { detalle.refetch(); invalidar(); }} />
          </>
        )}
      </div>
    </HojaLateral>
  );
}

// ─── Semana: línea del tiempo por día (últimos 7 días, hoy arriba) ───
function SeccionSemana({ tele, acc, agenda, agendaDisponible, hoy }) {
  const { theme } = useTheme();
  const dias = useMemo(() => {
    const out = [];
    for (let i = 0; i < 7; i++) out.push(isoDia(sumarDias(hoy, -i)));
    return out;
  }, [hoy]);
  const sesPorDia = useMemo(() => {
    const m = new Map();
    for (const s of tele?.sesiones || []) { if (!m.has(s.dia)) m.set(s.dia, []); m.get(s.dia).push(s); }
    return m;
  }, [tele]);
  const accPorDia = useMemo(() => new Map((acc?.porDia || []).map((d) => [d.dia, d.items])), [acc]);
  const sub = { fontSize: 11, color: theme.textMuted };
  const semIso = isoDia(inicioSemana(hoy));

  return (
    <>
      <Panel titulo="Esta semana" meta={`desde el ${fechaCorta(semIso)}`}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>
          <Dato k="Días" v={`${tele?.diasActivosSemana ?? 0}/5`} />
          <Dato k="Tiempo" v={fmtHmCorto(tele?.minutosSemana || 0)} />
          <Dato k="Sesiones" v={tele?.sesionesSemana ?? 0} />
          <Dato k="Acciones" v={acc?.semana ?? 0} />
        </div>
        {tele?.paginasTop?.length > 0 && (
          <div style={{ marginTop: 8, display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={sub}>Pantallas:</span>
            {tele.paginasTop.map(([p, n]) => <Pill key={p} tone="gray" size="xs">{PAGINA_LABEL[p] || `p${p}`} · {fmtHmCorto(n)}</Pill>)}
            {tele.clienteTop && <Pill tone="blue" size="xs">{CLIENTE_LABEL[tele.clienteTop]} · {tele.pctClienteTop}%</Pill>}
          </div>
        )}
      </Panel>

      <Panel titulo="Línea del tiempo" meta="últimos 7 días" padding="6px 12px">
        {dias.map((d) => {
          const ses = sesPorDia.get(d) || [];
          const accs = accPorDia.get(d) || [];
          const vacio = !ses.length && !accs.length;
          const eventos = [
            ...ses.map((s) => ({ ts: s.inicio, tipo: 'sesion', s })),
            ...accs.map((a) => ({ ts: a.ts, tipo: 'accion', a })),
          ].sort((x, y) => String(y.ts).localeCompare(String(x.ts)));
          return (
            <div key={d} style={{ padding: '6px 0', borderBottom: `1px solid ${hairline(theme)}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: vacio ? theme.textMuted : theme.text, textTransform: 'capitalize' }}>{fmtDiaLargo(d)}{d === isoDia(hoy) ? ' · hoy' : ''}</span>
                <span style={sub}>{vacio ? 'sin actividad' : `${fmtHm(ses.reduce((s, x) => s + x.minutos, 0))}${accs.length ? ` · ${plural(accs.length, 'acción', 'acciones')}` : ''}`}</span>
              </div>
              {eventos.map((e, i) => e.tipo === 'sesion' ? (
                <div key={`s${i}`} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8, fontSize: 11.5, padding: '2px 0', color: theme.text }}>
                  <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>{fmtHora(e.s.inicio)}–{fmtHora(e.s.fin)}</span>
                  <span>Sesión de {fmtHm(e.s.minutos)}{topPaginas(e.s.paginas)}</span>
                </div>
              ) : (
                <div key={`a${i}`} style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8, fontSize: 11.5, padding: '2px 0', color: theme.text }}>
                  <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>{fmtHora(e.a.ts)}</span>
                  <span><span style={{ width: 6, height: 6, borderRadius: 999, background: theme.accent, display: 'inline-block', marginRight: 6, verticalAlign: 'middle' }} />{e.a.label}{e.a.cliente_key ? <span style={sub}> · {e.a.cliente_key}</span> : null}</span>
                </div>
              ))}
            </div>
          );
        })}
      </Panel>

      <Panel titulo="Pendientes abiertos" meta={!agendaDisponible ? 'Agenda no disponible' : agenda ? `${agenda.abiertos} abiertos · ${agenda.vencidos} vencidos · ${agenda.pctATiempo != null ? `${agenda.pctATiempo}% a tiempo en 30 d` : 'sin cierres en 30 d'}` : ''} padding="0">
        {!agendaDisponible
          ? <div style={{ padding: 12, fontSize: 12, color: theme.textMuted }}>Agenda no disponible.</div>
          : <TablaCompacta dense vacio="Sin pendientes abiertos." maxHeight={260}
              columnas={[
                { key: 'titulo', label: 'Pendiente', align: 'left', maxWidth: 280, render: (r) => <span>{r.tipo === 'punto' ? <Pill tone="purple" size="xs" style={{ marginRight: 4 }}>punto</Pill> : null}{r.titulo || '—'}</span> },
                { key: 'cliente_key', label: 'Cliente', align: 'left', render: (r) => r.cliente_key || '—' },
                { key: 'fecha_limite', label: 'Límite', render: (r) => r.fecha_limite ? <Pill tone={String(r.fecha_limite) < isoDia(hoy) ? 'red' : String(r.fecha_limite) === isoDia(hoy) ? 'orange' : 'gray'} size="xs">{fechaCorta(r.fecha_limite)}</Pill> : <span style={sub}>sin fecha</span> },
              ]}
              filas={agenda?.listaAbiertos || []} rowKey={(r) => r.id} />}
      </Panel>
    </>
  );
}

function topPaginas(paginas) {
  const top = Object.entries(paginas || {}).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([p]) => PAGINA_LABEL[p] || `p${p}`);
  return top.length ? ` · ${top.join(', ')}` : '';
}

function Dato({ k, v }) {
  const { theme } = useTheme();
  return (
    <div style={{ background: suaveBg(theme), borderRadius: 8, padding: '6px 8px' }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{v}</div>
    </div>
  );
}

// ─── 4 semanas: tabla semana × total + principales, y lista completa por día ───
function SeccionAcciones({ acc }) {
  const { theme } = useTheme();
  const sub = { fontSize: 11, color: theme.textMuted };
  return (
    <>
      <Panel titulo="Qué hizo · 4 semanas" meta={`${acc?.total || 0} acciones registradas`} padding="0">
        <TablaCompacta dense vacio="Sin acciones en 4 semanas."
          columnas={[
            { key: 'inicio', label: 'Semana', align: 'left', render: (r) => `${fechaCorta(r.inicio)} – ${fechaCorta(r.fin)}` },
            { key: 'total', label: 'Acciones', width: 70 },
            { key: 'principales', label: 'Principales', align: 'left', render: (r) => r.principales.length ? <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }}>{r.principales.map((p) => <Pill key={p.label} tone="gray" size="xs">{p.label} · {p.n}</Pill>)}</span> : <span style={sub}>—</span> },
          ]}
          filas={acc?.semanas || []} rowKey={(r) => r.inicio} />
      </Panel>
      <Panel titulo="Lista completa" meta="por día" padding="6px 12px">
        {!(acc?.porDia?.length) && <div style={{ padding: '8px 0', fontSize: 12, color: theme.textMuted }}>Sin acciones registradas.</div>}
        {(acc?.porDia || []).map((d) => (
          <div key={d.dia} style={{ padding: '6px 0', borderBottom: `1px solid ${hairline(theme)}` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, textTransform: 'capitalize' }}>{fmtDiaLargo(d.dia)}</span>
              <span style={sub}>{plural(d.items.length, 'acción', 'acciones')}</span>
            </div>
            {d.items.map((a, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 8, fontSize: 11.5, padding: '2px 0', color: theme.text, alignItems: 'baseline' }}>
                <span style={{ ...sub, fontVariantNumeric: 'tabular-nums' }}>{fmtHora(a.ts)}</span>
                <span>{a.label}{a.cliente_key ? <span style={sub}> · {a.cliente_key}</span> : null}</span>
                <span style={{ ...sub, fontSize: 10 }}>{a.area}</span>
              </div>
            ))}
          </div>
        ))}
      </Panel>
    </>
  );
}
