// Surtir hoy · OCs abiertas con stock completo en almacén comercial, ordenadas por días en etapa. "Compartir lista" por WhatsApp.
import React from 'react';
import { Share2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TablaCompacta, Panel, Boton, toast } from '../../../components/kit';
import { compartir } from '../../../lib/whatsapp';
import { fmtInt, textoListaSurtir, ETAPA_LABEL } from './textos';
import { ClientePill } from './ui';

export default function SurtirHoy({ filas, onOC }) {
  const { theme } = useTheme();
  const compartirLista = async () => { const r = await compartir(textoListaSurtir(filas), { titulo: 'Surtir hoy' }); if (r) toast.ok(r === 'share' ? 'Compartido' : 'Abriendo WhatsApp…'); };
  const columnas = [
    { key: 'cliente', label: 'Cliente', align: 'left', render: (r) => <ClientePill k={r.cliente_key} /> },
    { key: 'numero_oc_cliente', label: 'OC', align: 'left', mono: true, bold: true },
    { key: 'pendiente', label: 'Pz', sum: true, render: (r) => fmtInt(r.pendiente) },
    { key: 'almacen', label: 'Almacén', align: 'left', render: (r) => r.almacen || '—' },
    { key: 'etapa', label: 'Etapa', align: 'left', render: (r) => ETAPA_LABEL[r.etapa] },
    { key: 'diasEnEtapa', label: 'Días', render: (r) => <span style={{ color: r.diasEnEtapa > 3 ? theme.red : theme.text }}>{Math.round(r.diasEnEtapa ?? 0)}</span> },
  ];
  return (
    <Panel titulo="Surtir hoy" meta="OCs con stock completo · por días" acciones={<Boton icon={Share2} onClick={compartirLista} disabled={!filas.length}>Compartir lista</Boton>}>
      <TablaCompacta columnas={columnas} filas={filas} dense maxHeight={300} onRowClick={onOC ? (r) => onOC(r.id) : undefined} vacio="Nada surtible hoy con stock completo." />
    </Panel>
  );
}
