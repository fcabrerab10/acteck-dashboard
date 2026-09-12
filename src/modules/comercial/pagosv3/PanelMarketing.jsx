// Marketing del mes · cada actividad se marca "cargo a fondo" o "paga la empresa".
//   · fondo   → descuenta del fondo del cliente (movimiento en pagos_fondos_movimientos)
//   · empresa → entra al flujo como pago de marketing
// Vive aquí (y no sólo en la pestaña Marketing) porque es la decisión que cambia el dinero.
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Boton, Pill, Segmented, TablaCompacta, toast } from '../../../components/kit';
import { supabase } from '../../../lib/supabase';
import { invalidateDataCache } from '../../../lib/queries';
import M from './motor';
import { CLIENTE_LABEL } from './reglas';
import { mxn, MONO, Nota, ClientePill } from './ui';

const mesDe = (a) => {
  if (a.fecha) return Number(String(a.fecha).slice(5, 7));
  const n = Number(a.mes);
  if (Number.isFinite(n) && n >= 1 && n <= 12) return n;
  const i = M.MESES_LARGOS.findIndex((x) => x.toLowerCase() === String(a.mes || '').toLowerCase());
  return i >= 0 ? i + 1 : 0;
};

export default function PanelMarketing({ actividades, clientes, anio, mes, fondos, puedeEditar, onCambio, onCrearPago, pagos }) {
  const { theme } = useTheme();
  const [guardando, setGuardando] = useState(null);

  const delMes = useMemo(
    () => (actividades || []).filter((a) => clientes.includes(a.cliente) && Number(a.anio) === anio && mesDe(a) === mes),
    [actividades, clientes.join(','), anio, mes],
  );

  const cambiarCobro = async (act, cobro) => {
    setGuardando(act.id);
    try {
      const { error } = await supabase.from('marketing_actividades').update({ cobro }).eq('id', act.id);
      if (error) throw error;
      // "fondo" descuenta del saldo; "empresa" entra al flujo de pagos.
      if (cobro === 'fondo') {
        const fondo = (fondos || []).find((f) => f.cliente === act.cliente && f.fondo_key === 'mkt');
        const monto = Number(act.inversion ?? act.costo) || 0;
        if (fondo && monto > 0) {
          if (Number(fondo.saldo) < 0) {
            toast.error(`El fondo de ${CLIENTE_LABEL[act.cliente]} está en negativo: autoriza el sobregiro en el panel de Fondos.`);
          } else {
            await supabase.from('pagos_fondos_movimientos').insert({
              fondo_id: fondo.fondo_id, cliente: act.cliente,
              fecha: act.fecha || `${anio}-${String(mes).padStart(2, '0')}-01`, anio, mes,
              tipo: 'cargo', monto, concepto: act.nombre, actividad_id: act.id, origen: 'marketing',
            });
          }
        }
      } else {
        await supabase.from('pagos_fondos_movimientos').delete().eq('actividad_id', act.id).eq('origen', 'marketing');
      }
      invalidateDataCache();
      toast.ok(cobro === 'fondo' ? 'Cargada al fondo del cliente' : 'La paga la empresa · entra al flujo de pagos');
      await onCambio?.();
    } catch (e) {
      toast.error(e.message || String(e));
    } finally { setGuardando(null); }
  };

  const porCliente = clientes.map((c) => {
    const acts = delMes.filter((a) => a.cliente === c);
    const prop = M.marketingDelMes({ cliente: c, anio, mes, actividades: acts }).pago;
    const yaHay = (pagos || []).some((p) => p.clave_calculo === prop.clave);
    return { cliente: c, acts, prop, yaHay };
  }).filter((x) => x.acts.length > 0);

  const columnas = [
    { key: 'nombre', label: 'Actividad', align: 'left' },
    { key: 'cliente', label: 'Cliente', align: 'left', width: 104, render: (a) => <ClientePill clienteKey={a.cliente} /> },
    { key: 'inversion', label: 'Monto', width: 96, render: (a) => <span style={MONO}>{mxn(a.inversion ?? a.costo)}</span> },
    { key: 'cobro', label: 'Quién paga', align: 'left', width: 210, render: (a) => (
      puedeEditar(a.cliente)
        ? <Segmented size="sm"
            options={[{ id: 'empresa', label: 'Paga la empresa' }, { id: 'fondo', label: 'Cargo a fondo' }]}
            value={a.cobro || 'empresa'}
            onChange={(v) => { if (v !== (a.cobro || 'empresa') && guardando !== a.id) cambiarCobro(a, v); }} />
        : <Pill tone={a.cobro === 'fondo' ? 'purple' : 'green'} size="xs">{a.cobro === 'fondo' ? 'Cargo a fondo' : 'Paga la empresa'}</Pill>
    ) },
  ];

  return (
    <Panel titulo="Marketing del mes" plegable abiertoInicial={false}
           meta={`${delMes.length} actividad(es) · cada una se carga al fondo o la paga la empresa`}>
      {delMes.length === 0
        ? <Nota>Sin actividades de marketing registradas en este mes.</Nota>
        : (
          <>
            <TablaCompacta columnas={columnas} filas={delMes} rowKey={(a) => a.id} dense />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
              {porCliente.map(({ cliente, prop, yaHay }) => (
                <span key={cliente} style={{ display: 'inline-flex', gap: 6, alignItems: 'center', border: `1px solid ${theme.border}`, borderRadius: 10, padding: '5px 8px', fontFamily: TYPO.fontText, fontSize: 11.5 }}>
                  <ClientePill clienteKey={cliente} />
                  <span style={MONO}>{mxn(prop.monto)}</span>
                  <span style={{ color: theme.textMuted }}>lo paga la empresa</span>
                  {yaHay
                    ? <Pill tone="green" size="xs">Pago creado</Pill>
                    : (puedeEditar(cliente) && prop.aplica && <Boton icon={Plus} onClick={() => onCrearPago?.(prop)}>Crear pago</Boton>)}
                </span>
              ))}
            </div>
          </>
        )}
      <Nota style={{ marginTop: 6 }}>El mismo interruptor vive en la pestaña Marketing de cada cliente; aquí se ve el efecto en el dinero (fondo vs flujo de pagos).</Nota>
    </Panel>
  );
}
