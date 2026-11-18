// Forecast · reservas por cliente (push, sólo consulta · sin captura ni compartir).
// Segmented Digitalife / PCEL / Dicotech → SKUs con reserva o pedido en curso de ese cliente (necesidad_dgl/pce/dct > 0
// en las líneas de propuestas generadas/cerradas), cantidad, fecha estimada de arribo y estado del seguimiento;
// y "Próximos arribos" (7 días): fechas de arribo capturadas en las líneas (forecast_avisos) + ETAs de tránsito
// (v_transito_sku) de esos SKUs. Fuentes = las de ForecastReservas.jsx (forecast_propuestas, forecast_propuesta_lineas,
// forecast_avisos: la app las escribe → supabase directo bajo useQuery; v_transito_sku → cachedQuery).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Ship, PackageCheck, CalendarClock } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { cachedQuery } from '../../lib/queries';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { useNav } from '../nav';
import { TituloGrande, KpiM, KpiGrid, ListaAgrupada, Cabecera, Skeleton, Segmented, Pill, Vacio } from '../piezas';
import { PROPIOS, nombreCliente, colorCliente } from '../datos';
import { int, fechaCorta, hoyISO, N, MESES } from '../util';
import { nombreCorto } from '../../lib/whatsapp';
import FichaProducto from '../FichaProducto';

const COL_NECESIDAD = { digitalife: 'necesidad_dgl', pcel: 'necesidad_pce', dicotech: 'necesidad_dct' };
// Estado de la línea (forecast_propuesta_lineas.estado + hitos crm_subido_at / comprado_at) → pill.
const ESTADOS = {
  draft:          { label: 'Borrador',   tone: 'gray' },
  pend_confirmar: { label: 'Pendiente',  tone: 'blue' },
  confirmado:     { label: 'Confirmado', tone: 'green' },
  parcial:        { label: 'Parcial',    tone: 'orange' },
  no_aplica:      { label: 'N/A',        tone: 'red' },
  subido_crm:     { label: 'En CRM',     tone: 'purple' },
  comprado:       { label: 'Comprado',   tone: 'green' },
};
const estadoDe = (l) => (l.comprado_at ? { label: 'Comprado', tone: 'green' } : l.crm_subido_at ? { label: 'En CRM', tone: 'purple' } : ESTADOS[l.estado] || ESTADOS.draft);
const sumaDias = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return hoyISO(d); };

function useForecast() {
  return useQuery({
    queryKey: ['movil', 'forecast'], staleTime: 60 * 1000, enabled: DB_CONFIGURED,
    queryFn: async () => {
      const { data: props, error } = await supabase.from('forecast_propuestas')
        .select('id,nombre,estatus,meta_anio,meta_mes,generado_at,cerrado_at, forecast_propuesta_lineas(id,sku,descripcion,marca,necesidad_dgl,necesidad_pce,necesidad_dct,recomendado,reservo,confirmado,estado,crm_subido_at,comprado_at,fecha_arribo_estimada,piezas_a_reservar_arribo,updated_at)')
        .neq('estatus', 'borrador').order('generado_at', { ascending: false, nullsFirst: false });
      if (error) throw error;
      const propuestas = props || [];
      const lineas = propuestas.flatMap((p) => (p.forecast_propuesta_lineas || []).map((l) => ({ ...l, propuesta: p })));
      const skus = [...new Set(lineas.map((l) => l.sku).filter(Boolean))];
      const hoy = hoyISO();
      const [avisos, transito] = await Promise.all([
        lineas.length ? supabase.from('forecast_avisos').select('id,linea_id,propuesta_id,tipo,fecha_arribo,piezas_a_reservar').gte('fecha_arribo', sumaDias(hoy, -1)).then((r) => r.data || []).catch(() => []) : [],
        skus.length ? cachedQuery(supabase.from('v_transito_sku').select('sku,cantidad,eta_mas_cercana,embarques,embarques_detalle').in('sku', skus)).then((r) => r.data || []).catch(() => []) : [],
      ]);
      return { propuestas, lineas, avisos, transito };
    },
  });
}

export default function ForecastCliente({ clienteKey }) {
  const { theme } = useTheme();
  const nav = useNav();
  const [ck, setCk] = useState(PROPIOS.includes(clienteKey) ? clienteKey : PROPIOS[0]);
  const { data, isLoading, error } = useForecast();
  const hoy = hoyISO();
  const limite = sumaDias(hoy, 7);

  const r = useMemo(() => {
    if (!data) return null;
    const col = COL_NECESIDAD[ck];
    const trBy = new Map((data.transito || []).map((t) => [t.sku, t]));
    const avisosPorLinea = new Map();
    (data.avisos || []).forEach((a) => { if (a.linea_id && (!avisosPorLinea.has(a.linea_id) || a.tipo === 'dia')) avisosPorLinea.set(a.linea_id, a); });
    const skus = data.lineas.filter((l) => N(l[col]) > 0).map((l) => {
      const t = trBy.get(l.sku);
      const det = (Array.isArray(t?.embarques_detalle) ? t.embarques_detalle : []).filter((e) => N(e.cantidad) > 0 && e.eta).sort((a, b) => String(a.eta).localeCompare(String(b.eta)));
      const proximo = det.find((e) => e.eta >= hoy) || det[0] || null;
      const eta = l.fecha_arribo_estimada || proximo?.eta || null;
      return { ...l, necesidad: N(l[col]), reserva: N(l.reservo), enCamino: N(t?.cantidad), eta, etaOrigen: l.fecha_arribo_estimada ? 'capturada' : proximo ? 'tránsito' : null, proximo, st: estadoDe(l) };
    }).sort((a, b) => String(a.eta || '9999').localeCompare(String(b.eta || '9999')) || b.necesidad - a.necesidad);
    // Próximos arribos (7 días) del cliente: fechas capturadas en la línea/avisos + ETAs de tránsito de sus SKUs.
    const arribos = [];
    const vistos = new Set();
    skus.forEach((l) => {
      const av = avisosPorLinea.get(l.id);
      const fechaCap = l.fecha_arribo_estimada || av?.fecha_arribo || null;
      if (fechaCap && fechaCap >= hoy && fechaCap <= limite && !vistos.has(`c-${l.sku}-${fechaCap}`)) {
        vistos.add(`c-${l.sku}-${fechaCap}`);
        arribos.push({ key: `c-${l.id}`, sku: l.sku, descripcion: l.descripcion, fecha: fechaCap, piezas: N(l.piezas_a_reservar_arribo) || N(av?.piezas_a_reservar) || l.reserva, origen: 'Reserva', necesidad: l.necesidad });
      }
      const t = trBy.get(l.sku);
      (Array.isArray(t?.embarques_detalle) ? t.embarques_detalle : []).forEach((e) => {
        if (!e.eta || e.eta < hoy || e.eta > limite || N(e.cantidad) <= 0) return;
        const k = `t-${l.sku}-${e.eta}-${e.po || ''}`; if (vistos.has(k)) return; vistos.add(k);
        arribos.push({ key: k, sku: l.sku, descripcion: l.descripcion, fecha: e.eta, piezas: N(e.cantidad), origen: e.po ? `PO ${e.po}` : 'Tránsito', estatus: e.estatus, necesidad: l.necesidad });
      });
    });
    arribos.sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || b.piezas - a.piezas);
    const necesidadTotal = skus.reduce((s, l) => s + l.necesidad, 0);
    const conFecha = skus.filter((l) => l.eta).length;
    const propuestasCk = [...new Set(skus.map((l) => l.propuesta?.id))].length;
    const ultima = skus[0]?.propuesta || data.propuestas[0] || null;
    return { skus, arribos, necesidadTotal, conFecha, propuestasCk, ultima };
  }, [data, ck, hoy, limite]);

  const abrirSku = (sku) => { nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha', 'inventarioGlobal'); };
  const label = nombreCliente(ck);
  const color = colorCliente(ck, theme);
  const subTitulo = (() => {
    const u = r?.ultima; if (!u) return 'Reservas y pedidos en curso';
    const mesTxt = u.meta_mes ? `${MESES[u.meta_mes - 1]} ${u.meta_anio}` : '';
    const nombre = u.nombre || 'Propuesta';
    return [nombre, mesTxt && !nombre.includes(mesTxt) ? mesTxt : null, u.estatus === 'cerrada' ? 'cerrada' : 'generada'].filter(Boolean).join(' · ');
  })();

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Comercial" />
      <TituloGrande titulo="Forecast" sub={subTitulo} />
      <div style={{ padding: '0 16px 12px' }}>
        <Segmented size="md" value={ck} onChange={setCk} style={{ width: '100%', display: 'flex' }} options={PROPIOS.map((k) => ({ id: k, label: nombreCliente(k) }))} />
      </div>
      {error && <Vacio titulo="No se pudo cargar el forecast" sub={error.message} />}
      {(isLoading || !r) && !error && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
          <Skeleton h={320} r={12} />
        </div>
      )}
      {r && (
        <>
          <KpiGrid>
            <KpiM eyebrow="SKUs con reserva" big={String(r.skus.length)} sub={r.skus.length ? `${int(r.necesidadTotal)} pz para ${label}` : 'sin reservas en curso'} />
            <KpiM eyebrow="Próximos 7 días" big={String(r.arribos.length)} bigColor={r.arribos.length ? theme.green : undefined} sub={r.arribos.length ? `${int(r.arribos.reduce((s, a) => s + a.piezas, 0))} pz por llegar` : `hasta el ${fechaCorta(limite)}`} />
          </KpiGrid>

          <ListaAgrupada titulo="Próximos arribos" meta="7 días" style={{ marginTop: 16 }} pie={r.arribos.length ? 'Fechas capturadas en la reserva y ETAs de tránsito (v_transito_sku) de los SKUs de este cliente.' : undefined}>
            {r.arribos.length === 0 && <Vacio icon={CalendarClock} color={theme.textMuted} titulo="Nada por llegar esta semana" sub={`Ningún SKU reservado para ${label} tiene arribo entre hoy y el ${fechaCorta(limite)}.`} />}
            {r.arribos.map((a) => (
              <button key={a.key} type="button" onClick={() => abrirSku(a.sku)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 58, padding: '8px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 34, height: 34, borderRadius: 9, background: `${theme.green}22`, color: theme.green, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Ship size={17} strokeWidth={1.9} /></span>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.sku}<span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 13 }}>{nombreCorto(a.descripcion)}</span></span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.origen}{a.estatus ? ` · ${a.estatus}` : ''} · necesidad {int(a.necesidad)} pz</span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{int(a.piezas)} pz</span>
                  <Pill tone={a.fecha === hoy ? 'green' : 'blue'} size="xs">{a.fecha === hoy ? 'hoy' : fechaCorta(a.fecha)}</Pill>
                </span>
              </button>
            ))}
          </ListaAgrupada>

          <ListaAgrupada titulo={`Reservas · ${label}`} meta={r.skus.length ? `${r.skus.length} · ${r.conFecha} con fecha` : undefined} style={{ marginTop: 18 }}
            pie={r.skus.length ? 'Cantidad = necesidad del cliente en la propuesta · reserva total entre los 3 clientes. Fecha = arribo capturado o ETA de tránsito más cercana. Toca un SKU para ver disponibilidad y precio. La captura se hace desde la computadora.' : undefined}>
            {r.skus.length === 0 && <Vacio icon={PackageCheck} color={theme.textMuted} titulo={`Sin reservas para ${label}`} sub="Ninguna propuesta generada tiene necesidad de este cliente. Las propuestas se arman en Forecast · Reservas desde la computadora." />}
            {r.skus.map((l) => (
              <button key={l.id} type="button" onClick={() => abrirSku(l.sku)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 62, padding: '9px 12px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, textAlign: 'left', cursor: 'pointer', boxSizing: 'border-box' }}>
                <span style={{ width: 8, height: 8, borderRadius: 999, background: color, flexShrink: 0, marginLeft: 2 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.sku}{l.marca ? <span style={{ fontWeight: 500, color: theme.textMuted, marginLeft: 8, fontFamily: TYPO.fontText, fontSize: 12.5 }}>{l.marca}</span> : null}</span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{nombreCorto(l.descripcion) || 'Sin descripción'}</span>
                  <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontVariantNumeric: 'tabular-nums' }}>
                    {l.eta ? `arribo ${fechaCorta(l.eta)}${l.etaOrigen === 'tránsito' ? ' (ETA)' : ''}` : 'sin fecha de arribo'}{l.enCamino > 0 ? ` · ${int(l.enCamino)} pz en camino` : ''}
                  </span>
                </span>
                <span style={{ textAlign: 'right', flexShrink: 0 }}>
                  <span style={{ display: 'block', fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{int(l.necesidad)} pz</span>
                  <span style={{ display: 'block', fontSize: 11, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', marginBottom: 3 }}>de {int(l.reserva)} reservadas</span>
                  <Pill tone={l.st.tone} size="xs">{l.st.label}</Pill>
                </span>
              </button>
            ))}
          </ListaAgrupada>
        </>
      )}
    </>
  );
}
