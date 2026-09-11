// Agenda móvil · Clientes: "antes de entrar con un cliente". Lista por cliente (abiertas, vencidas, próxima reunión,
// arrastrados, última minuta); tocar abre su detalle (pantalla empujada: abiertos + últimas reuniones).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando } from '../../../components/kit';
import { useAgendaDatos, completarItem } from '../../../modules/agenda/datos';
import { vencido, abierto, proximaReunion, resumenReunion, ordenarReuniones, cuando, isoDia, fmtHora, vecesArrastrado } from '../../../modules/agenda/calculo';
import { CLIENTES_AGENDA, nombreClienteAgenda } from '../../../modules/agenda/etiquetas';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, HeroM, Pill, Vacio, toast } from '../../piezas';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { TagCliente, TarjetaItem, TarjetaReunion, SeccionM, FilaGesto } from './comun';
import CapturaHoja from './Captura';
import Minuta from './Minuta';

/** Resumen por cliente (lógica sobre calculo.js). */
export function resumenClientes(items, reuniones, hoy) {
  const keys = [...new Set([...CLIENTES_AGENDA.map((c) => c.key), ...items.filter(abierto).map((i) => i.cliente_key || 'interno'), ...reuniones.map((r) => r.cliente_key || 'interno')])];
  return keys.map((k) => {
    const abiertas = items.filter((i) => abierto(i) && (i.cliente_key || 'interno') === k);
    const venc = abiertas.filter((i) => vencido(i, hoy));
    const arrastrados = abiertas.filter((i) => i.tipo === 'punto' && i.arrastrado_desde);
    const prox = proximaReunion(reuniones, k, hoy);
    const ultima = reuniones.filter((r) => r.tipo === 'reunion' && (r.cliente_key || 'interno') === k && r.estado === 'cerrada').sort((a, b) => new Date(b.fecha) - new Date(a.fecha))[0] || null;
    return { key: k, label: nombreClienteAgenda(k), abiertas: abiertas.length, vencidas: venc.length, arrastrados: arrastrados.length, proxima: prox, ultima, masArrastrado: arrastrados[0] || null };
  }).filter((c) => c.abiertas || c.proxima || c.ultima || CLIENTES_AGENDA.some((x) => x.key === c.key));
}

export default function Clientes() {
  const { theme } = useTheme();
  const nav = useNav();
  const { items, reuniones, hoy, porId } = useAgenda();
  const lista = useMemo(() => resumenClientes(items, reuniones, hoy), [items, reuniones, hoy]);
  return (
    <div style={{ padding: '0 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      {lista.map((c) => {
        const prox = c.proxima ? new Date(c.proxima.fecha) : null;
        const sub = [prox ? `Reunión ${cuando(isoDia(prox), hoy)} ${fmtHora(prox)}` : 'Sin reunión programada', c.arrastrados ? `${c.arrastrados} punto${c.arrastrados === 1 ? '' : 's'} arrastrado${c.arrastrados === 1 ? '' : 's'}` : null, c.ultima ? `última minuta ${cuando(isoDia(new Date(c.ultima.fecha)), hoy)}` : null].filter(Boolean).join(' · ');
        const detalle = c.masArrastrado ? `«${c.masArrastrado.titulo.slice(0, 44)}» lleva ${vecesArrastrado(c.masArrastrado, porId) + 1} reuniones` : null;
        return (
          <button key={c.key} type="button" onClick={() => nav.push(<DetalleCliente clienteKey={c.key} />, `agenda-cliente-${c.key}`)}
            style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%' }}>
              <TagCliente clienteKey={c.key} size="sm" />
              <b style={{ flex: 1, fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 600, letterSpacing: '-0.01em' }}>{c.label}</b>
              {c.vencidas > 0 && <Pill tone="red" size="xs">{c.vencidas} vencida{c.vencidas === 1 ? '' : 's'}</Pill>}
              <Pill tone="gray" size="xs">{c.abiertas} abierta{c.abiertas === 1 ? '' : 's'}</Pill>
            </div>
            <div style={{ fontSize: 12.5, color: theme.textMuted, lineHeight: 1.4 }}>{sub}{detalle ? <><br />{detalle}</> : null}</div>
          </button>
        );
      })}
      {!lista.length && <Vacio titulo="Sin clientes con pendientes" />}
    </div>
  );
}

/** Detalle de un cliente (pantalla empujada): abiertos (vencidos primero) + últimas reuniones con sus puntos. */
export function DetalleCliente({ clienteKey }) {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const { items, reuniones, personas, personasPorId, porId, cargando } = useAgendaDatos();
  const [cap, setCap] = useState(null);
  const perfil = nav.perfil;
  const puedeEditar = !!perfil?.es_super_admin || perfil?.tipo === 'interno';
  const abiertas = useMemo(() => items.filter((i) => abierto(i) && (i.cliente_key || 'interno') === clienteKey).sort((a, b) => (vencido(b, hoy) - vencido(a, hoy)) || String(a.fecha_limite || '9999').localeCompare(String(b.fecha_limite || '9999'))), [items, clienteKey, hoy]);
  const reus = useMemo(() => ordenarReuniones(reuniones.filter((r) => (r.cliente_key || 'interno') === clienteKey), hoy), [reuniones, clienteKey, hoy]);
  const prox = proximaReunion(reuniones, clienteKey, hoy);
  const venc = abiertas.filter((i) => vencido(i, hoy)).length;
  const arr = abiertas.filter((i) => i.arrastrado_desde).length;
  const abrirMinuta = (r) => nav.push(<Minuta reunionId={r.id} />, `minuta-${r.id}`);
  const toggle = async (item, hecha) => { try { await completarItem(item, hecha); if (hecha) toast.ok('Hecho', { accion: 'Deshacer', onAccion: () => completarItem(item, false) }); } catch (e) { toast.error(e.message); } };
  if (cargando && !items.length) return (<><Cabecera onVolver={nav.pop} /><div style={{ padding: '0 16px' }}><Cargando pantalla="movilAgenda" /></div></>);
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo={nombreClienteAgenda(clienteKey)} sub="Lo abierto y lo arrastrado, antes de entrar" />
      <HeroM eyebrow={`Agenda · ${nombreClienteAgenda(clienteKey)}`} frase={prox ? `Próxima reunión ${cuando(isoDia(new Date(prox.fecha)), hoy)} a las ${fmtHora(new Date(prox.fecha))}` : 'Sin reunión programada'} sub={prox ? prox.titulo : 'Crea una desde Reuniones para arrastrar lo abierto.'}
        onClick={prox ? () => abrirMinuta(prox) : undefined}
        stats={[{ k: 'Abiertas', v: abiertas.length }, { k: 'Vencidas', v: venc, color: venc ? theme.red : undefined }, { k: 'Arrastrados', v: arr, color: arr ? theme.orange : undefined }]} />
      <div style={{ padding: '4px 16px 40px' }}>
        <SeccionM n={abiertas.length}>Abiertos</SeccionM>
        {abiertas.map((it) => {
          const card = <TarjetaItem item={it} personasPorId={personasPorId} porId={porId} hoy={hoy} reunion={it.reunion_id ? reuniones.find((r) => r.id === it.reunion_id) : null} onToggle={puedeEditar ? toggle : undefined} onAbrir={(x) => setCap({ item: x })} mostrarCliente={false} />;
          return puedeEditar ? <FilaGesto key={it.id} onDerecha={() => toggle(it, true)}>{card}</FilaGesto> : <div key={it.id} style={{ marginBottom: 8 }}>{card}</div>;
        })}
        {!abiertas.length && <div style={{ fontSize: 13, color: theme.textMuted, padding: '4px 4px 8px' }}>Nada abierto con este cliente.</div>}
        <SeccionM n={reus.length}>Reuniones</SeccionM>
        {reus.slice(0, 8).map((r) => {
          const res = resumenReunion(r, items, porId);
          return (
            <div key={r.id} style={{ marginBottom: 8 }}>
              <TarjetaReunion reunion={r} items={items} porId={porId} hoy={hoy} onMinuta={abrirMinuta} />
              {r.estado === 'cerrada' && (res.resueltos.length || res.arrastradosFuera.length) ? <div style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted, padding: '4px 12px 0' }}>{res.resueltos.length} resueltos · {res.arrastradosFuera.length} arrastrados</div> : null}
            </div>
          );
        })}
        {!reus.length && <div style={{ fontSize: 13, color: theme.textMuted, padding: '4px 4px 8px' }}>Sin reuniones con este cliente.</div>}
      </div>
      <CapturaHoja cfg={cap} personas={personas} reuniones={reuniones} hoy={hoy} onClose={() => setCap(null)} onAbrirMinuta={(id) => abrirMinuta({ id })} />
    </>
  );
}
