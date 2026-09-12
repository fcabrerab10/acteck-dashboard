// Pagos (móvil) · lo que toca hoy + calendario del mes en lista + fondos por cliente.
// Sin edición de reglas (sólo lectura): el candado vive en la web.
// Acciones: Copiar correo · Autorizar · Capturar folio · Registrar pago (adjuntar PDF desde el celular).
import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Send, Check, Hash, FileText, AlertTriangle } from 'lucide-react';
import { supabase, DB_CONFIGURED } from '../../../lib/supabase';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { usePerfil } from '../../../lib/perfilContext';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Segmented, Skeleton, Pill, Vacio, toast } from '../../piezas';
import { money, moneyCompact, MESES_LARGO, N } from '../../util';
import { clientesVisibles, puedeEditarPagos } from '../../../modules/comercial/pagosv3/datos';
import { CLIENTE_LABEL, CLIENTE_COLOR } from '../../../modules/comercial/pagosv3/reglas';
import { ESTADO_META, TIPO_META, estaVencido, venceEn, diasParaPago } from '../../../modules/comercial/pagosv3/estados';
import DetallePago from './DetallePago';

const STALE = 2 * 60 * 1000;
const hoyISO = () => new Date().toISOString().slice(0, 10);

function usePagosMovil(clientes, anio) {
  return useQuery({
    queryKey: ['movil', 'pagos', clientes.join(','), anio],
    staleTime: STALE, enabled: clientes.length > 0 && DB_CONFIGURED,
    queryFn: async () => {
      const [pagos, fondos, reglas] = await Promise.all([
        supabase.from('pagos').select('*').in('cliente', clientes).order('fecha_programada', { ascending: true }),
        supabase.from('v_pagos_fondos_saldo').select('*'),
        supabase.from('pagos_reglas').select('cliente,seccion,config,vigente_hasta').is('vigente_hasta', null),
      ]);
      if (pagos.error) throw pagos.error;
      return { pagos: pagos.data || [], fondos: fondos.data || [], reglas: reglas.data || [] };
    },
  });
}

export default function PagosMovil({ clienteKey = null }) {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const hoy = hoyISO();
  const [anio, setAnio] = useState(Number(hoy.slice(0, 4)));
  const [mes, setMes] = useState(Number(hoy.slice(5, 7)));
  const [vista, setVista] = useState('hoy');
  const [abierto, setAbierto] = useState(null);

  const visibles = useMemo(() => {
    const todos = clientesVisibles(perfil);
    return clienteKey ? todos.filter((k) => k === clienteKey) : todos;
  }, [perfil, clienteKey]);

  const { data, isLoading, refetch } = usePagosMovil(visibles, anio);
  const pagos = data?.pagos || [];
  const per = `${anio}-${String(mes).padStart(2, '0')}`;

  const delMes = useMemo(() => pagos.filter((p) => {
    const f = p.fecha_programada || p.fecha_compromiso;
    return f ? String(f).slice(0, 7) === per : p.periodo === per;
  }), [pagos, per]);

  const abiertos = pagos.filter((p) => !['pagado', 'cancelado'].includes(p.estado));
  const grupos = [
    { id: 'solicitar', titulo: 'Por solicitar', icon: Send, color: theme.accent, filas: abiertos.filter((p) => p.estado === 'calculado' && N(p.monto) > 0) },
    { id: 'autorizar', titulo: 'Por autorizar', icon: Check, color: theme.purple || theme.accent, filas: abiertos.filter((p) => p.estado === 'solicitado') },
    { id: 'folio', titulo: 'Sin folio', icon: Hash, color: theme.orange, filas: abiertos.filter((p) => p.estado === 'autorizado' && !String(p.folio || '').trim()) },
    { id: 'pagar', titulo: 'Por registrar el pago', icon: FileText, color: theme.green, filas: abiertos.filter((p) => p.estado === 'folio') },
    { id: 'vence', titulo: 'Vencen o vencieron', icon: AlertTriangle, color: theme.red, filas: abiertos.filter((p) => estaVencido(p, hoy) || venceEn(p, 7, hoy)) },
  ].filter((g) => g.filas.length > 0);

  const comprometido = delMes.filter((p) => p.estado !== 'cancelado').reduce((s, p) => s + N(p.monto), 0);
  const pagado = delMes.filter((p) => p.estado === 'pagado').reduce((s, p) => s + N(p.monto), 0);
  const porHacer = grupos.reduce((s, g) => s + g.filas.length, 0);

  if (visibles.length === 0) return <Vacio titulo="Sin acceso" sub="No tienes permiso de Pagos en ningún cliente." />;
  if (isLoading) return <Skeleton alto={420} />;

  const fila = (p) => {
    const dias = diasParaPago(p, hoy);
    const vencido = dias !== null && dias < 0 && !['pagado', 'cancelado'].includes(p.estado);
    return (
      <Fila
        key={p.id}
        titulo={p.concepto}
        sub={`${CLIENTE_LABEL[p.cliente]} · ${TIPO_META[p.tipo]?.label || p.tipo}${p.fecha_programada ? ` · ${String(p.fecha_programada).slice(5, 10).replace('-', '/')}` : ''}${vencido ? ` · vencido ${Math.abs(dias)} d` : ''}`}
        valor={money(p.monto)}
        pill={{ tone: vencido ? 'red' : (ESTADO_META[p.estado]?.tone || 'gray'), label: ESTADO_META[p.estado]?.label || p.estado }}
        color={CLIENTE_COLOR[p.cliente]}
        onClick={() => setAbierto(p)}
        chevron
      />
    );
  };

  return (
    <>
      <TituloGrande>Pagos</TituloGrande>

      <HeroM
        eyebrow={`${MESES_LARGO[mes - 1]} ${anio}`}
        frase={`${moneyCompact(comprometido)} comprometidos este mes`}
        sub={porHacer > 0 ? `${porHacer} cosa(s) que atender hoy` : 'Nada pendiente por ahora'}
        stats={[
          { k: 'Comprometido', v: moneyCompact(comprometido) },
          { k: 'Pagado', v: moneyCompact(pagado) },
          { k: 'Por hacer', v: String(porHacer) },
        ]}
      />

      <div style={{ padding: '12px 16px 0' }}>
        <Segmented
          options={[{ id: 'hoy', label: 'Hoy' }, { id: 'mes', label: 'Mes' }, { id: 'fondos', label: 'Fondos' }]}
          value={vista} onChange={setVista}
        />
      </div>

      {vista === 'hoy' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}>
          {grupos.length === 0
            ? <Vacio titulo="Todo al día" sub="No hay pagos por solicitar, autorizar ni registrar." />
            : grupos.map((g) => (
                <ListaAgrupada key={g.id} titulo={g.titulo} meta={g.filas.length}>
                  {g.filas.map(fila)}
                </ListaAgrupada>
              ))}
        </div>
      )}

      {vista === 'mes' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '12px 0' }}>
          <div style={{ display: 'flex', gap: 6, padding: '0 16px' }}>
            <BotonMes label="◀" onClick={() => { const m = mes === 1 ? 12 : mes - 1; setMes(m); if (mes === 1) setAnio(anio - 1); }} />
            <div style={{ flex: 1, textAlign: 'center', fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, alignSelf: 'center', textTransform: 'capitalize' }}>{MESES_LARGO[mes - 1]} {anio}</div>
            <BotonMes label="▶" onClick={() => { const m = mes === 12 ? 1 : mes + 1; setMes(m); if (mes === 12) setAnio(anio + 1); }} />
          </div>
          {delMes.length === 0
            ? <Vacio titulo="Sin pagos" sub="No hay pagos programados para este mes." />
            : <CalendarioLista pagos={delMes} onPago={setAbierto} hoy={hoy} />}
        </div>
      )}

      {vista === 'fondos' && (
        <div style={{ padding: '12px 0' }}>
          <ListaAgrupada titulo="Fondos por cliente" pie="Saldo = abonos − cargos. Un fondo en negativo bloquea cargos nuevos.">
            {(data?.fondos || []).filter((f) => visibles.includes(f.cliente)).map((f) => (
              <Fila key={f.fondo_id}
                titulo={`${CLIENTE_LABEL[f.cliente]} · ${f.nombre}`}
                sub={`Abonos ${moneyCompact(f.abonos_ytd)} · cargos ${moneyCompact(f.cargos_ytd)}`}
                valor={money(f.saldo)}
                color={CLIENTE_COLOR[f.cliente]}
                pill={N(f.saldo) < 0 ? { tone: 'red', label: 'negativo' } : undefined}
              />
            ))}
          </ListaAgrupada>
        </div>
      )}

      <DetallePago
        pago={abierto} abierto={!!abierto} onCerrar={() => setAbierto(null)}
        perfil={perfil} reglas={data?.reglas || []}
        puedeEditar={abierto ? puedeEditarPagos(perfil, abierto.cliente) : false}
        onCambio={async () => { await refetch(); setAbierto(null); }}
      />
    </>
  );
}

function BotonMes({ label, onClick }) {
  const { theme } = useTheme();
  return (
    <button onClick={onClick} style={{ width: 40, height: 32, borderRadius: 10, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, fontSize: 12 }}>{label}</button>
  );
}

/** Calendario del mes como lista: un grupo por día con fecha programada. */
function CalendarioLista({ pagos, onPago, hoy }) {
  const { theme } = useTheme();
  const porDia = useMemo(() => {
    const m = {};
    for (const p of pagos) {
      const f = String(p.fecha_programada || p.fecha_compromiso || '').slice(0, 10) || 'sin fecha';
      (m[f] ||= []).push(p);
    }
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [pagos]);
  return (
    <>
      {porDia.map(([dia, filas]) => {
        const total = filas.reduce((s, p) => s + N(p.monto), 0);
        return (
          <ListaAgrupada key={dia}
            titulo={dia === 'sin fecha' ? 'Sin fecha programada' : `${dia.slice(8, 10)} ${MESES_LARGO[Number(dia.slice(5, 7)) - 1]}${dia === hoy ? ' · hoy' : ''}`}
            meta={money(total)}>
            {filas.map((p) => (
              <Fila key={p.id}
                titulo={p.concepto}
                sub={`${CLIENTE_LABEL[p.cliente]} · ${TIPO_META[p.tipo]?.label || p.tipo}`}
                valor={money(p.monto)}
                color={TIPO_META[p.tipo]?.color || theme.textMuted}
                pill={{ tone: ESTADO_META[p.estado]?.tone || 'gray', label: ESTADO_META[p.estado]?.label || p.estado }}
                onClick={() => onPago(p)} chevron />
            ))}
          </ListaAgrupada>
        );
      })}
    </>
  );
}
