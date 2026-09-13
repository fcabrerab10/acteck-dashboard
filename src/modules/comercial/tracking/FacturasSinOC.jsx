// Facturas del ERP (últimos 30 días) que no ligaron a ninguna OC: "Crear OC desde factura" (con sus partidas) o "Ligar a OC".
import React, { useState } from 'react';
import { Plus, Link2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Panel, Boton, Pill, toast } from '../../../components/kit';
import { Modal } from '../../../components/perfil/comun';
import { fmtInt, fmtFecha, fmtMoney, VENTANA_FACTURAS_SIN_OC_DIAS, nombreCliente } from './textos';
import { candidatasParaFactura } from './calculo';
import { crearOCDesdeFactura, ligarFacturaAOC } from './datos';
import { ClientePill, EtapaPill } from './ui';

export default function FacturasSinOC({ filas, todas, puedeEditar, email }) {
  const { theme } = useTheme();
  const [busy, setBusy] = useState(null);
  const [ligar, setLigar] = useState(null);   // factura elegida para "Ligar a OC"
  const crear = async (f) => {
    setBusy(f.folio);
    try { await crearOCDesdeFactura(f, email); toast.ok(`OC creada desde ${f.folio} con ${f.n_partidas || (f.partidas || []).length} partidas`); }
    catch (e) { toast.error(`No se pudo crear la OC: ${e.message}`); }
    finally { setBusy(null); }
  };
  const ligarA = async (oc) => {
    setBusy(ligar.folio);
    try { await ligarFacturaAOC(oc.id, [ligar.folio], oc.facturas?.map((x) => x.folio).concat(oc.folioPendientes || [])); toast.ok(`${ligar.folio} ligada a la OC ${oc.numero_oc_cliente}`); setLigar(null); }
    catch (e) { toast.error(`No se pudo ligar: ${e.message}`); }
    finally { setBusy(null); }
  };
  const columnas = [
    { key: 'folio', label: 'Factura', align: 'left', mono: true, bold: true, render: (r) => <span title={`${r.n_partidas || (r.partidas || []).length} partidas · ${fmtMoney(r.monto)}`}>{r.folio}</span> },
    { key: 'cliente', label: 'Cliente', align: 'left', render: (r) => <ClientePill k={r.cliente_key} /> },
    { key: 'referencia', label: 'Ref.', align: 'left', maxWidth: 130, render: (r) => <span title={r.referencia || ''}>{r.referencia || '—'}</span> },
    { key: 'fecha', label: 'Fecha', align: 'left', render: (r) => fmtFecha(r.fecha) },
    { key: 'piezas', label: 'Pz', render: (r) => fmtInt(r.piezas) },
    ...(puedeEditar ? [{ key: 'acc', label: '', align: 'left', render: (r) => (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        <Boton icon={Plus} onClick={() => crear(r)} disabled={busy === r.folio} title="Crea la OC con las partidas de la factura como pedido">Crear OC</Boton>
        <Boton icon={Link2} onClick={() => setLigar(r)} disabled={busy === r.folio}>Ligar</Boton>
      </span>) }] : []),
  ];
  const cand = ligar ? candidatasParaFactura(ligar, todas).slice(0, 40) : [];
  return (
    <Panel titulo="Facturas sin OC registrada" meta={`ERP · ${VENTANA_FACTURAS_SIN_OC_DIAS} días · un clic crea la OC con sus partidas`}>
      <TablaCompacta columnas={columnas} filas={filas} rowKey={(r) => r.folio} dense maxHeight={300} vacio="Todas las facturas recientes están ligadas a una OC." />
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 6, fontFamily: TYPO.fontText }}>La liga automática usa la referencia de la factura (= número de OC) o los folios capturados en la OC. Lo que no ligue aparece aquí.</div>
      <Modal abierto={!!ligar} onClose={() => setLigar(null)} theme={theme} titulo={`Ligar ${ligar?.folio || ''} a una OC`} sub={ligar ? `${nombreCliente(ligar.cliente_key)} · ref. ${ligar.referencia || '—'} · ${fmtInt(ligar.piezas)} pz` : ''} ancho={560}>
        <TablaCompacta dense maxHeight={360} filas={cand} rowKey={(r) => r.id} onRowClick={ligarA} vacio="Este cliente no tiene OCs registradas: usa «Crear OC»."
          columnas={[
            { key: 'oc', label: 'OC', align: 'left', mono: true, bold: true, render: (r) => <span>{r.numero_oc_cliente}{r.parecido && <Pill tone="green" size="xs" style={{ marginLeft: 6 }}>referencia coincide</Pill>}</span> },
            { key: 'recibida', label: 'Recibida', align: 'left', render: (r) => fmtFecha(r.fecha_recibida) },
            { key: 'etapa', label: 'Etapa', align: 'left', render: (r) => <EtapaPill oc={r} /> },
            { key: 'pedido', label: 'Pz', render: (r) => fmtInt(r.pedido) },
            { key: 'backorder', label: 'Backorder', render: (r) => fmtInt(r.backorder) },
            { key: 'facturas', label: 'Facturas', align: 'left', mono: true, render: (r) => (r.facturas || []).map((x) => x.folio).join(', ') || '—' },
          ]} />
        <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 8 }}>Clic en la OC: el folio se agrega a sus facturas capturadas y la liga se materializa al recargar.</div>
      </Modal>
    </Panel>
  );
}
