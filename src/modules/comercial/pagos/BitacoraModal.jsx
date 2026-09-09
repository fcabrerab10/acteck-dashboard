// Bitácora de cambios (pagos_audit) · de un pago o de todos los pagos del cliente.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TablaCompacta, Pill, Boton } from '../../../components/kit';
import { Modal } from './pagosUI';

export default function BitacoraModal({ historial, onClose }) {
  const { theme } = useTheme();
  const { pago, entries, conceptoDe } = historial;
  const tone = (a) => (a === 'insert' ? 'green' : a === 'delete' ? 'red' : 'blue');
  const columnas = [
    { key: 'changed_at', label: 'Fecha', align: 'left', mono: true, render: (e) => new Date(e.changed_at).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) },
    ...(pago ? [] : [{ key: 'pago_id', label: 'Pago', align: 'left', maxWidth: 200, render: (e) => conceptoDe?.(e.pago_id) || e.pago_id }]),
    { key: 'user', label: 'Usuario', align: 'left', maxWidth: 160, render: (e) => e.user_name || e.user_email || '—' },
    { key: 'accion', label: 'Campo', align: 'left', render: (e) => <Pill tone={tone(e.accion)} size="xs">{e.accion === 'update' ? e.field_name : e.accion}</Pill> },
    { key: 'old_value', label: 'De', align: 'left', maxWidth: 160, render: (e) => (e.accion === 'update' ? (e.old_value || '∅') : '') },
    { key: 'new_value', label: 'A', align: 'left', maxWidth: 160, bold: true, render: (e) => (e.accion === 'update' ? (e.new_value || '∅') : '') },
  ];
  return (
    <Modal titulo="Bitácora de cambios" sub={pago ? pago.concepto : 'Últimos cambios en los pagos de este cliente'} onClose={onClose} width={760}
      footer={<Boton onClick={onClose}>Cerrar</Boton>}>
      {entries.length === 0
        ? <div style={{ textAlign: 'center', padding: 20, fontSize: 12, color: theme.textMuted, fontStyle: 'italic' }}>Sin cambios registrados (creado antes del audit, o no ha sido editado).</div>
        : <TablaCompacta dense columnas={columnas} filas={entries} rowKey={(e, i) => e.id ?? i} maxHeight={420} />}
    </Modal>
  );
}
