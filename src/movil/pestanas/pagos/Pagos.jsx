// Pagos (móvil) · diseño B (2026-09-12): arriba una tira con las TRES cuentas (mini resumen y selector);
//   todo lo de abajo es de UN cliente a la vez. La pantalla principal sigue siendo una BANDEJA POR ACCIÓN.
//   Segmented: Hoy · Calendario · Fondo · Historial
//   Hoy      — grupos por etapa: Por solicitar · Por autorizar · Sin folio · Por registrar (folio sin pago) ·
//              Vence en 7 días · Rechazados. Chips de cliente y hero con comprometido / pagado / vence 7 d.
//   Gestos   — derecha = acción principal de la etapa (abre la hoja que toca) · izquierda = Copiar correo
//              (siempre; si ya está solicitado copia el mismo texto para reenviar). Toast con Deshacer al
//              solicitar y al autorizar.
//   Calendario — mes en cuadrícula con puntos por tipo; tocar un día lista sus pagos.
// Sin edición de reglas (sólo lectura): el candado vive en la web.
import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Send, Check, Hash, FileText, XCircle, Mail, RotateCcw } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../../../lib/supabase';
import { useTheme } from '../../../lib/themeContext';
import { usePerfil } from '../../../lib/perfilContext';
import { TituloGrande, HeroM, ListaAgrupada, Fila, Segmented, Vacio, HojaM, toast } from '../../piezas';
import { Cargando } from '../../../components/kit';
import { money, moneyCompact, MESES_LARGO, N } from '../../util';
import { FilaGesto, ChipM } from '../agenda/comun';
import { clientesVisibles, puedeEditarPagos, cambiarEstado } from '../../../modules/comercial/pagosv3/datos';
import { CLIENTE_LABEL, CLIENTE_COLOR } from '../../../modules/comercial/pagosv3/reglas';
import { ESTADO_META, TIPO_META, estaVencido, venceEn, diasParaPago } from '../../../modules/comercial/pagosv3/estados';
import { SIL_MOVIL_PAGOS } from '../../../modules/comercial/pagosv3/siluetas';
import DetallePago from './DetallePago';
import CalendarioM, { fechaDe } from './CalendarioM';
import { HojaCorreo, HojaFolio, HojaRegistrar, HojaConfirmar } from './hojas';

const STALE = 2 * 60 * 1000;
const hoyISO = () => new Date().toISOString().slice(0, 10);
const pad = (n) => String(n).padStart(2, '0');

// Acción principal de cada etapa: la que dispara el deslizar a la derecha.
const ACCION = {
  calculado:  { label: 'Solicitar',      icon: Send,     hoja: 'correo' },
  solicitado: { label: 'Autorizar',      icon: Check,    hoja: 'autorizar' },
  autorizado: { label: 'Capturar folio', icon: Hash,     hoja: 'folio' },
  folio:      { label: 'Registrar pago', icon: FileText, hoja: 'registrar' },
  rechazado:  { label: 'Reabrir',        icon: RotateCcw, hoja: 'reabrir' },
};

function usePagosMovil(clientes) {
  return useQuery({
    queryKey: ['movil', 'pagos', clientes.join(',')],
    staleTime: STALE,
    enabled: clientes.length > 0 && DB_CONFIGURED,
    queryFn: async () => {
      const [pagos, fondos, reglas, movs] = await Promise.all([
        supabase.from('pagos').select('*').in('cliente', clientes).order('fecha_programada', { ascending: true }),
        supabase.from('v_pagos_fondos_saldo').select('*'),
        supabase.from('pagos_reglas').select('cliente,seccion,config,vigente_hasta').is('vigente_hasta', null),
        supabase.from('pagos_fondos_movimientos').select('id,fondo_id,cliente,fecha,tipo,monto,concepto,origen,notas').in('cliente', clientes).order('fecha', { ascending: false }).limit(600),
      ]);
      if (pagos.error) throw pagos.error;
      return { pagos: pagos.data || [], fondos: fondos.data || [], reglas: reglas.data || [], movs: movs.data || [] };
    },
  });
}

export default function PagosMovil({ clienteKey = null, inicial = null }) {
  // `clienteKey` (ruta vieja de cliente) e `inicial.cliente` sólo PREELIGEN la cuenta: la pantalla es global.
  const perfil = usePerfil();
  const { theme } = useTheme();
  const hoy = hoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [dia, setDia] = useState(hoy);
  const [vista, setVista] = useState('hoy');
  const [cliente, setCliente] = useState(inicial?.cliente || clienteKey || null);
  const [abierto, setAbierto] = useState(null);   // DetallePago
  const [hoja, setHoja] = useState(null);         // { tipo, pago }
  const [ocupado, setOcupado] = useState(false);
  const [fondoFoco, setFondoFoco] = useState(null);
  const [fondoAbierto, setFondoAbierto] = useState(null);   // estado de cuenta del fondo (hoja)
  const [histTipo, setHistTipo] = useState(null);            // filtros del historial
  const [histRango, setHistRango] = useState('anio');

  const visibles = useMemo(() => clientesVisibles(perfil), [perfil]);

  const { data, isLoading, refetch } = usePagosMovil(visibles);
  const todos = data?.pagos || [];
  const per = `${anio}-${pad(mes)}`;

  // Alerta → pantalla: { pagoId } abre el pago · { fondoId } abre Fondos con ese fondo arriba.
  useEffect(() => {
    if (!inicial || !data) return;
    if (inicial.pagoId) {
      const p = todos.find((x) => String(x.id) === String(inicial.pagoId));
      if (p) { setAbierto(p); return; }
      toast.info('Ese pago ya no está en tu bandeja');
    }
    if (inicial.fondoId) { setVista('fondos'); setFondoFoco(String(inicial.fondoId)); }
  }, [inicial, data]); // eslint-disable-line react-hooks/exhaustive-deps

  const esDelMes = (p) => { const f = fechaDe(p); return f ? f.slice(0, 7) === per : p.periodo === per; };
  const abiertoDe = (p) => !['pagado', 'cancelado', 'rechazado'].includes(p.estado);

  // ── Mini resumen de las tres cuentas (tira de arriba, también selector) ──
  const cuentas = useMemo(() => visibles.map((k) => {
    const mios = todos.filter((p) => p.cliente === k);
    const mesK = mios.filter(esDelMes).filter((p) => p.estado !== 'cancelado');
    const fondo = (data?.fondos || []).filter((f) => f.cliente === k && f.activo !== false).reduce((s, f) => s + N(f.saldo), 0);
    return {
      key: k,
      comprometido: mesK.reduce((s, p) => s + N(p.monto), 0),
      porHacer: mios.filter(abiertoDe).filter((p) => p.estado !== 'calculado' || N(p.monto) > 0).length,
      vencidos: mios.filter(abiertoDe).filter((p) => estaVencido(p, hoy)).length,
      fondo,
    };
  }), [visibles, todos, data?.fondos, per, hoy]); // eslint-disable-line react-hooks/exhaustive-deps

  // Cuenta inicial: la que tenga algo por hacer; si no, la primera.
  useEffect(() => {
    if (cliente && visibles.includes(cliente)) return;
    if (!visibles.length || !data) return;
    setCliente((cuentas.find((c) => c.porHacer > 0) || cuentas[0])?.key || visibles[0]);
  }, [visibles, cuentas, cliente, data]);
  const clienteSel = cliente && visibles.includes(cliente) ? cliente : visibles[0];
  const totalTres = {
    comprometido: cuentas.reduce((s, c) => s + c.comprometido, 0),
    porHacer: cuentas.reduce((s, c) => s + c.porHacer, 0),
    vencidos: cuentas.reduce((s, c) => s + c.vencidos, 0),
  };

  const pagos = useMemo(() => todos.filter((p) => p.cliente === clienteSel), [todos, clienteSel]);
  const delMes = useMemo(() => pagos.filter(esDelMes), [pagos, per]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Grupos de la bandeja (sin repetir: lo que vence sale de su etapa y va al grupo de urgencia) ──
  const grupos = useMemo(() => {
    const abiertos = pagos.filter((p) => !['pagado', 'cancelado', 'rechazado'].includes(p.estado));
    const urge = abiertos.filter((p) => estaVencido(p, hoy) || venceEn(p, 7, hoy));
    const urgeIds = new Set(urge.map((p) => p.id));
    const resto = abiertos.filter((p) => !urgeIds.has(p.id));
    const g = [
      { id: 'solicitar', titulo: 'Por solicitar', color: theme.accent, filas: resto.filter((p) => p.estado === 'calculado' && N(p.monto) > 0) },
      { id: 'autorizar', titulo: 'Por autorizar', color: theme.purple || theme.accent, filas: resto.filter((p) => p.estado === 'solicitado') },
      { id: 'folio', titulo: 'Sin folio', color: theme.orange, filas: resto.filter((p) => p.estado === 'autorizado' && !String(p.folio || '').trim()) },
      { id: 'registrar', titulo: 'Por registrar (folio sin pago)', color: theme.green, filas: resto.filter((p) => p.estado === 'folio') },
      { id: 'vence', titulo: 'Vence en 7 días', color: theme.red, filas: urge.sort((a, b) => (diasParaPago(a, hoy) ?? 99) - (diasParaPago(b, hoy) ?? 99)) },
      { id: 'rechazados', titulo: 'Rechazados', color: theme.red, filas: pagos.filter((p) => p.estado === 'rechazado') },
    ];
    return g.filter((x) => x.filas.length > 0);
  }, [pagos, hoy, theme]);

  const comprometido = delMes.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + N(p.monto), 0);
  const pagado = delMes.filter((p) => p.estado === 'pagado').reduce((s, p) => s + N(p.monto), 0);
  const porVencer = pagos.filter((p) => estaVencido(p, hoy) || venceEn(p, 7, hoy)).reduce((s, p) => s + N(p.monto), 0);
  const porHacer = grupos.reduce((s, g) => s + g.filas.length, 0);

  // ── Escrituras ──
  const editable = (p) => puedeEditarPagos(perfil, p.cliente);
  const mover = async (pago, hacia, extra, nota) => {
    setOcupado(true);
    try { await cambiarEstado({ pago, hacia, perfil, extra, nota }); await refetch(); return true; }
    catch (e) { toast.error(e.message || String(e)); return false; }
    finally { setOcupado(false); }
  };
  // Deshacer: regresa el pago a la etapa anterior y limpia los sellos que puso el avance.
  // `actual` es la etapa a la que acabamos de moverlo (para que la bitácora quede con el anterior correcto).
  const deshacer = async (pago, atras, actual) => {
    const limpia = atras === 'calculado'
      ? { solicitado_at: null, solicitado_por: null, autorizado_at: null, autorizado_por: null, estatus: 'pendiente' }
      : { autorizado_at: null, autorizado_por: null };
    await mover({ ...pago, estado: actual }, atras, limpia, 'Deshacer desde el celular');
  };
  const conDeshacer = (pago, atras, actual, msg) => toast.ok(msg, { ms: 7000, accion: 'Deshacer', onAccion: () => deshacer(pago, atras, actual) });

  const solicitar = async (pago) => {
    const ok = await mover(pago, 'solicitado', {}, 'Correo copiado desde el celular');
    if (ok) conDeshacer(pago, 'calculado', 'solicitado', 'Marcado como solicitado');
  };
  const autorizar = async (pago) => {
    const ok = await mover(pago, 'autorizado');
    setHoja(null);
    if (ok) conDeshacer(pago, 'solicitado', 'autorizado', 'Autorizado');
  };
  const capturarFolio = async (pago, folio) => {
    const ok = await mover(pago, 'folio', { folio }, `Folio ${folio}`);
    setHoja(null);
    if (ok) toast.ok(`Folio ${folio} capturado`);
  };
  const reabrir = async (pago) => {
    const ok = await mover(pago, 'calculado', { motivo_rechazo: null }, 'Reabierto desde el celular');
    setHoja(null);
    if (ok) toast.ok('Pago reabierto');
  };

  // Deslizar a la derecha: la acción de la etapa (la mayoría abre una hoja; Solicitar abre Copiar correo).
  const alDerecha = (pago) => {
    if (!editable(pago)) { toast.error(`Sólo lectura en ${CLIENTE_LABEL[pago.cliente] || pago.cliente}`); return; }
    const a = ACCION[pago.estado];
    if (!a) return;
    setHoja({ tipo: a.hoja, pago });
  };

  if (visibles.length === 0) return <Vacio titulo="Sin acceso" sub="No tienes permiso de Pagos en ningún cliente." />;
  if (isLoading) return <Cargando silueta={SIL_MOVIL_PAGOS} style={{ padding: '0 16px' }} />;

  const fila = (p, grupo) => {
    const dias = diasParaPago(p, hoy);
    const vencido = dias !== null && dias < 0 && !['pagado', 'cancelado'].includes(p.estado);
    const a = ACCION[p.estado];
    const meta = ESTADO_META[p.estado];
    const col = grupo?.color || theme.accent;
    return (
      <FilaGesto key={p.id} mantener style={{ borderRadius: 0, marginBottom: 0 }}
        onDerecha={a ? () => alDerecha(p) : null} labelDerecha={a?.label || ''} iconoDerecha={a?.icon || Check} colorDerecha={col}
        onIzquierda={() => setHoja({ tipo: 'correo', pago: p })} labelIzquierda="Copiar correo" iconoIzquierda={Mail} colorIzquierda={theme.accent}>
        <Fila
          alto={58}
          style={{ background: theme.surface }}
          titulo={p.concepto}
          sub={[
            TIPO_META[p.tipo]?.label || p.tipo,
            p.origen === 'auto' ? 'auto' : 'manual',
            fechaDe(p) ? fechaDe(p).slice(5, 10).replace('-', '/') : null,
            vencido ? `vencido ${Math.abs(dias)} d` : dias !== null && dias <= 7 ? `en ${dias} d` : null,
          ].filter(Boolean).join(' · ')}
          valor={money(p.monto)}
          pill={{ tone: vencido ? 'red' : (meta?.tone || 'gray'), label: vencido ? 'vencido' : (meta?.label || p.estado) }}
          tono={CLIENTE_COLOR[p.cliente]}
          onClick={() => setAbierto(p)}
        />
      </FilaGesto>
    );
  };

  const fechaHist = (p) => String(p.pagado_at || p.updated_at || fechaDe(p) || '').slice(0, 10);
  const historialBase = pagos
    .filter((p) => ['pagado', 'cancelado'].includes(p.estado))
    .sort((a, b) => fechaHist(b).localeCompare(fechaHist(a)));
  const desdeRango = (() => {
    const d = new Date(hoy);
    if (histRango === 'mes') return `${anio}-${pad(mes)}-01`;
    if (histRango === '3m') { d.setMonth(d.getMonth() - 3); return d.toISOString().slice(0, 10); }
    if (histRango === 'anio') return `${hoy.slice(0, 4)}-01-01`;
    return '0000-00-00';
  })();
  const tiposHist = Object.keys(TIPO_META).filter((t) => historialBase.some((p) => p.tipo === t));
  const historial = historialBase
    .filter((p) => fechaHist(p) >= desdeRango)
    .filter((p) => !histTipo || p.tipo === histTipo)
    .slice(0, 120);
  const totalHist = historial.filter((p) => p.estado === 'pagado').reduce((s, p) => s + N(p.monto), 0);

  // Estado de cuenta del fondo abierto: movimientos con saldo acumulado (del más viejo al más nuevo, mostrado al revés).
  const fondoSel = (data?.fondos || []).find((f) => String(f.fondo_id) === String(fondoAbierto)) || null;
  const movsFondo = (() => {
    if (!fondoSel) return [];
    const lista = (data?.movs || []).filter((m) => String(m.fondo_id) === String(fondoSel.fondo_id))
      .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)) || N(a.id) - N(b.id));
    let acum = 0;
    return lista.map((m) => { const signo = m.tipo === 'cargo' ? -1 : 1; acum += signo * N(m.monto); return { ...m, signo, acum }; }).reverse();
  })();

  return (
    <>
      <TituloGrande titulo="Pagos"
        sub={visibles.length > 1
          ? `Las tres cuentas · ${moneyCompact(totalTres.comprometido)} este mes${totalTres.porHacer ? ` · ${totalTres.porHacer} por atender` : ' · todo al día'}${totalTres.vencidos ? ` · ${totalTres.vencidos} vencido(s)` : ''}`
          : (porHacer > 0 ? `${porHacer} por atender · desliza una fila para actuar` : 'Todo al día')} />

      {/* Tira de cuentas: mini resumen de las tres y selector (desliza) */}
      {visibles.length > 1 && (
        <div style={{ display: 'flex', gap: 8, padding: '4px 16px 10px', overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollSnapType: 'x proximity' }}>
          {cuentas.map((c) => {
            const on = c.key === clienteSel;
            const color = CLIENTE_COLOR[c.key] || theme.accent;
            return (
              <button key={c.key} onClick={() => { setCliente(c.key); setAbierto(null); }}
                style={{ flex: '0 0 auto', minWidth: 138, scrollSnapAlign: 'start', textAlign: 'left', padding: '9px 11px', borderRadius: 14, cursor: 'pointer',
                  border: `1px solid ${on ? color : theme.border}`, background: on ? `${color}18` : theme.surface, color: theme.text,
                  boxShadow: on ? `inset 0 0 0 1px ${color}` : 'none', transition: 'background 160ms, border-color 160ms' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: color }} />{CLIENTE_LABEL[c.key] || c.key}
                </div>
                <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 17, fontWeight: 600, letterSpacing: '-0.02em', marginTop: 2, lineHeight: 1.1 }}>{moneyCompact(c.comprometido)}</div>
                <div style={{ fontSize: 10.5, color: c.vencidos ? theme.red : theme.textMuted, marginTop: 2, whiteSpace: 'nowrap' }}>
                  {c.vencidos ? `${c.vencidos} vencido${c.vencidos > 1 ? 's' : ''}` : c.porHacer ? `${c.porHacer} por atender` : 'al día'} · fondo {moneyCompact(c.fondo)}
                </div>
              </button>
            );
          })}
        </div>
      )}

      <HeroM
        eyebrow={`${CLIENTE_LABEL[clienteSel] || clienteSel} · ${MESES_LARGO[mes - 1]} ${anio}`}
        frase={`${moneyCompact(comprometido)} comprometidos este mes`}
        sub={porHacer > 0 ? `${porHacer} cosa(s) que atender · desliza una fila para actuar` : 'Nada pendiente por ahora'}
        stats={[
          { k: 'Comprometido', v: moneyCompact(comprometido) },
          { k: 'Pagado', v: moneyCompact(pagado) },
          { k: 'Vence 7 d', v: moneyCompact(porVencer), color: porVencer > 0 ? theme.red : undefined },
        ]}
      />

      <div style={{ padding: '12px 16px 0' }}>
        <Segmented size="md" style={{ display: 'flex', width: '100%' }} value={vista} onChange={setVista}
          options={[
            { id: 'hoy', label: 'Hoy', badge: porHacer || undefined },
            { id: 'calendario', label: 'Calendario' },
            { id: 'fondos', label: 'Fondo' },
            { id: 'historial', label: 'Historial' },
          ]} />
      </div>

      {vista === 'hoy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}>
          {grupos.length === 0
            ? <Vacio titulo="Todo al día" sub="No hay pagos por solicitar, autorizar, con folio pendiente ni por registrar." />
            : grupos.map((g) => (
                <ListaAgrupada key={g.id} titulo={g.titulo} meta={g.filas.length}>
                  {g.filas.map((p) => fila(p, g))}
                </ListaAgrupada>
              ))}
        </div>
      )}

      {vista === 'calendario' && (
        <div style={{ padding: '12px 0' }}>
          <CalendarioM pagos={delMes} anio={anio} mes={mes} hoy={hoy} dia={dia} onDia={setDia} onPago={setAbierto}
            onMes={(d) => {
              const m = mes + d;
              if (m < 1) { setMes(12); setAnio(anio - 1); } else if (m > 12) { setMes(1); setAnio(anio + 1); } else setMes(m);
            }} />
        </div>
      )}

      {vista === 'fondos' && (
        <div style={{ padding: '12px 0' }}>
          <ListaAgrupada titulo={`Fondo de ${CLIENTE_LABEL[clienteSel] || clienteSel}`} pie="Saldo = abonos − cargos. Un fondo en negativo bloquea cargos nuevos.">
            {(data?.fondos || [])
              .filter((f) => f.cliente === clienteSel)
              .sort((a, b) => (String(a.fondo_id) === fondoFoco ? 0 : 1) - (String(b.fondo_id) === fondoFoco ? 0 : 1))
              .map((f) => (
                <Fila key={f.fondo_id}
                  titulo={f.nombre}
                  sub={`Abonos ${moneyCompact(f.abonos_ytd)} · cargos ${moneyCompact(f.cargos_ytd)}`}
                  valor={money(f.saldo)}
                  tono={String(f.fondo_id) === fondoFoco ? theme.accent : CLIENTE_COLOR[f.cliente]}
                  onClick={() => setFondoAbierto(f.fondo_id)}
                  pill={N(f.saldo) < 0 ? { tone: 'red', label: 'negativo' } : undefined} />
              ))}
          </ListaAgrupada>
        </div>
      )}

      {vista === 'historial' && (
        <div style={{ padding: '12px 0' }}>
          <div style={{ padding: '0 16px 10px' }}>
            <Segmented size="sm" style={{ display: 'flex', width: '100%' }} value={histRango} onChange={setHistRango}
              options={[{ id: 'mes', label: 'Este mes' }, { id: '3m', label: '3 meses' }, { id: 'anio', label: hoy.slice(0, 4) }, { id: 'todo', label: 'Todo' }]} />
          </div>
          {tiposHist.length > 1 && (
            <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto' }}>
              <ChipM on={!histTipo} onClick={() => setHistTipo(null)}>Todos</ChipM>
              {tiposHist.map((t) => (
                <ChipM key={t} on={histTipo === t} onClick={() => setHistTipo(histTipo === t ? null : t)}>{TIPO_META[t].label}</ChipM>
              ))}
            </div>
          )}
          {historial.length === 0
            ? <Vacio icon={XCircle} color={theme.textMuted} titulo="Sin historial" sub={historialBase.length ? 'Nada con esos filtros.' : 'Aquí aparecen los pagos ya aplicados o cancelados.'} />
            : (
              <ListaAgrupada titulo="Pagados y cancelados" meta={`${historial.length} · ${moneyCompact(totalHist)} pagados`}>
                {historial.map((p) => (
                  <Fila key={p.id}
                    titulo={p.concepto}
                    sub={[TIPO_META[p.tipo]?.label || p.tipo, p.nc_folio ? `NC ${p.nc_folio}` : null, String(p.pagado_at || '').slice(0, 10) || null].filter(Boolean).join(' · ')}
                    valor={money(p.monto)}
                    tono={CLIENTE_COLOR[p.cliente]}
                    pill={{ tone: ESTADO_META[p.estado]?.tone || 'gray', label: ESTADO_META[p.estado]?.label || p.estado }}
                    onClick={() => setAbierto(p)} />
                ))}
              </ListaAgrupada>
            )}
        </div>
      )}

      {/* Estado de cuenta del fondo */}
      <HojaM abierto={!!fondoSel} onClose={() => setFondoAbierto(null)} titulo={fondoSel?.nombre || 'Fondo'}
        sub={fondoSel ? `${CLIENTE_LABEL[fondoSel.cliente] || fondoSel.cliente} · saldo ${money(fondoSel.saldo)}` : ''} alto="82vh">
        {fondoSel && (
          <div style={{ padding: '4px 0 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: '0 16px 12px' }}>
              {[
                { k: 'Saldo', v: money(fondoSel.saldo), color: N(fondoSel.saldo) < 0 ? theme.red : theme.text },
                { k: `Abonos ${hoy.slice(0, 4)}`, v: moneyCompact(fondoSel.abonos_ytd) },
                { k: `Cargos ${hoy.slice(0, 4)}`, v: moneyCompact(fondoSel.cargos_ytd) },
              ].map((x) => (
                <div key={x.k} style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '8px 10px', minWidth: 0 }}>
                  <div style={{ fontSize: 10, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{x.k}</div>
                  <div style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 600, color: x.color || theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{x.v}</div>
                </div>
              ))}
            </div>
            {fondoSel.regla && <div style={{ padding: '0 16px 10px', fontSize: 11.5, color: theme.textMuted }}>{fondoSel.regla}</div>}
            {movsFondo.length === 0
              ? <Vacio icon={null} titulo="Sin movimientos" sub="Los abonos y cargos aparecerán aquí con su saldo." style={{ padding: 18 }} />
              : (
                <ListaAgrupada titulo="Estado de cuenta" meta={movsFondo.length} pie="Saldo después de cada movimiento. Cargo = actividad o pago que se descuenta del fondo.">
                  {movsFondo.map((m) => (
                    <Fila key={m.id} chevron={false}
                      titulo={m.concepto || (m.signo < 0 ? 'Cargo' : 'Abono')}
                      sub={[String(m.fecha || '').slice(0, 10), m.origen, m.notas].filter(Boolean).join(' · ')}
                      valor={<span style={{ color: m.signo < 0 ? theme.red : theme.green }}>{m.signo < 0 ? '−' : '+'}{money(m.monto)}</span>}
                      valorSub={`saldo ${money(m.acum)}`}
                      tono={m.signo < 0 ? theme.red : theme.green} />
                  ))}
                </ListaAgrupada>
              )}
          </div>
        )}
      </HojaM>

      {/* Hojas de acción (las abre el gesto o el detalle) */}
      <HojaCorreo pago={hoja?.tipo === 'correo' ? hoja.pago : null} abierto={hoja?.tipo === 'correo'} onCerrar={() => setHoja(null)}
        perfil={perfil} reglas={data?.reglas || []} puedeEditar={hoja?.pago ? editable(hoja.pago) : false}
        onSolicitado={solicitar} />

      <HojaFolio pago={hoja?.tipo === 'folio' ? hoja.pago : null} abierto={hoja?.tipo === 'folio'} onCerrar={() => setHoja(null)}
        ocupado={ocupado} onGuardar={(f) => capturarFolio(hoja.pago, f)} />

      <HojaRegistrar pago={hoja?.tipo === 'registrar' ? hoja.pago : null} abierto={hoja?.tipo === 'registrar'} onCerrar={() => setHoja(null)}
        perfil={perfil} onHecho={refetch} />

      <HojaConfirmar abierto={hoja?.tipo === 'autorizar'} onCerrar={() => setHoja(null)} ocupado={ocupado}
        titulo="Autorizar el pago" sub={hoja?.pago ? `${CLIENTE_LABEL[hoja.pago.cliente]} · ${money(hoja.pago.monto)}` : ''}
        texto={hoja?.pago ? `"${hoja.pago.concepto}" pasará a Autorizado. Podrás deshacerlo desde el aviso.` : ''}
        label="Autorizar" icon={Check} onOk={() => autorizar(hoja.pago)} />

      <HojaConfirmar abierto={hoja?.tipo === 'reabrir'} onCerrar={() => setHoja(null)} ocupado={ocupado}
        titulo="Reabrir el pago" sub={hoja?.pago ? `${CLIENTE_LABEL[hoja.pago.cliente]} · ${money(hoja.pago.monto)}` : ''}
        texto={hoja?.pago?.motivo_rechazo ? `Motivo del rechazo: ${hoja.pago.motivo_rechazo}` : 'Vuelve al inicio del flujo (Calculado) para corregirlo y solicitarlo de nuevo.'}
        label="Reabrir" icon={RotateCcw} onOk={() => reabrir(hoja.pago)} />

      <DetallePago
        pago={abierto} abierto={!!abierto} onCerrar={() => setAbierto(null)}
        perfil={perfil} reglas={data?.reglas || []}
        puedeEditar={abierto ? editable(abierto) : false}
        onCambio={async () => { await refetch(); setAbierto(null); }}
      />
    </>
  );
}
