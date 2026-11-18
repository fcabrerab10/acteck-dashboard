// Marketing del mes · cada actividad se marca "cargo a fondo" o "paga la empresa".
//   · fondo   → descuenta del fondo del cliente (movimiento en pagos_fondos_movimientos)
//   · empresa → entra al flujo como pago de marketing
// Vive aquí (y no sólo en la pestaña Marketing) porque es la decisión que cambia el dinero.
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Boton, Pill, Segmented, TablaCompacta, toast } from '../../../components/kit';
import { cambiarCobroActividad } from './datos';
import { marketingDelPeriodo } from './calculoPanel';
import M from './motor';
import { CLIENTE_LABEL } from './reglas';
import { mxn, MONO, Nota, ClientePill } from './ui';

export default function PanelMarketing({ actividades, clientes, anio, mes, fondos, puedeEditar, onCambio, onCrearPago, pagos, abiertoInicial = false }) {
  const { theme } = useTheme();
  const [guardando, setGuardando] = useState(null);

  const { delMes, porCliente } = useMemo(
    () => marketingDelPeriodo({ actividades, clientes, anio, mes, pagos }),
    [actividades, clientes.join(','), anio, mes, pagos],
  );

  const cambiarCobro = async (act, cobro) => {
    setGuardando(act.id);
    try {
      // La escritura vive en ./datos.js (la usa también el celular).
      const r = await cambiarCobroActividad({ act, cobro, fondos, anio, mes });
      if (r.fondoNegativo) toast.error(`El fondo de ${CLIENTE_LABEL[act.cliente]} está en negativo: autoriza el sobregiro en el panel de Fondos.`);
      toast.ok(cobro === 'fondo' ? 'Cargada al fondo del cliente' : 'La paga la empresa · entra al flujo de pagos');
      await onCambio?.();
    } catch (e) {
      toast.error(e.message || String(e));
    } finally { setGuardando(null); }
  };

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
    <Panel titulo="Marketing del mes" plegable={!abiertoInicial} abiertoInicial={abiertoInicial}
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
