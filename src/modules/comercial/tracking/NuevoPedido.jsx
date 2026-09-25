// «Nuevo pedido» (2026-09-24, acuerdo con Fernando): un solo botón y dos caminos.
//   1. Desde la OC del cliente → captura manual (formulario o pegar correo): cada cliente manda la OC distinto (PDF, Excel…).
//   2. Desde una factura del ERP → eliges una o varias facturas del mismo cliente y los productos, piezas y precios se
//      cargan solos; el pedido queda identificado por la referencia de la factura (número de OC) o, si no trae, por el folio.
// Al guardar se abre el pedido en la tabla para registrar envíos (guía, paquetería, entrega). Un pedido acepta varias
// facturas y varios envíos parciales.
import React, { useMemo, useState } from 'react';
import { FileText, ClipboardList, ClipboardPaste, Search, Check } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, TablaCompacta, toast } from '../../../components/kit';
import { Modal } from '../../../components/perfil/comun';
import { fmtInt, fmtFecha, fmtMoney, nombreCliente, normalizar } from './textos';
import { guardarOC } from './datos';
import { ClientePill, Input, Nota } from './ui';

export default function NuevoPedido({ abierto, onClose, facturasSinPedido = [], email, onElegirOC, onCreado }) {
  const { theme } = useTheme();
  const [camino, setCamino] = useState(null);        // null · 'factura'
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(() => new Set());
  const [busy, setBusy] = useState(false);
  const cerrar = () => { setCamino(null); setQ(''); setSel(new Set()); onClose?.(); };

  const lista = useMemo(() => {
    const t = normalizar(q.trim());
    return facturasSinPedido.filter((f) => !t || normalizar(`${f.folio} ${f.referencia || ''} ${nombreCliente(f.cliente_key)}`).includes(t));
  }, [facturasSinPedido, q]);
  const elegidas = facturasSinPedido.filter((f) => sel.has(f.folio));
  const cliente = elegidas[0]?.cliente_key || null;
  const partidas = useMemo(() => {
    const m = new Map();
    for (const f of elegidas) for (const p of f.partidas || []) { const c = m.get(p.sku) || { sku: p.sku, descripcion: p.descripcion || '', piezas: 0, monto: 0 }; c.piezas += Number(p.piezas) || 0; c.monto += Number(p.monto) || 0; m.set(p.sku, c); }
    return [...m.values()].sort((a, b) => b.monto - a.monto);
  }, [elegidas]);
  const totalPz = partidas.reduce((s, p) => s + p.piezas, 0), totalMonto = partidas.reduce((s, p) => s + p.monto, 0);
  const referencia = elegidas.map((f) => f.referencia).find((r) => r && !/^sin\s+orden/i.test(r)) || null;
  const numeroPedido = referencia ? String(referencia).trim() : (elegidas[0]?.folio || '');

  const toggle = (f) => setSel((prev) => {
    const n = new Set(prev);
    if (n.has(f.folio)) { n.delete(f.folio); return n; }
    if (cliente && f.cliente_key !== cliente) { toast.error(`Sólo facturas del mismo cliente (${nombreCliente(cliente)})`); return prev; }
    n.add(f.folio); return n;
  });

  const crear = async () => {
    if (!elegidas.length) return;
    setBusy(true);
    try {
      const fechas = elegidas.map((f) => String(f.fecha).slice(0, 10)).sort();
      const skus = partidas.map((p) => ({ sku: p.sku, cantidad_ordenada: p.piezas, precio_unitario: p.piezas ? p.monto / p.piezas : 0 }));
      const id = await guardarOC({ cliente_key: cliente, numero_oc_cliente: numeroPedido, fecha_recibida: fechas[0], facturas: elegidas.map((f) => f.folio), fuente: 'factura', notas: `Pedido creado desde ${elegidas.length === 1 ? `la factura ${elegidas[0].folio}` : `las facturas ${elegidas.map((f) => f.folio).join(', ')}`}${referencia ? ` · referencia ${referencia}` : ' · sin referencia de OC'}` }, skus, email);
      toast.ok(`Pedido ${numeroPedido} creado con ${partidas.length} producto${partidas.length === 1 ? '' : 's'} · ahora registra el envío`);
      cerrar(); onCreado?.(id);
    } catch (e) { toast.error(`No se pudo crear el pedido: ${e.message}`); }
    setBusy(false);
  };

  const tarjeta = (icon, titulo, sub, onClick, primario) => {
    const Icon = icon;
    return (
      <button type="button" onClick={onClick} style={{ flex: 1, minWidth: 0, textAlign: 'left', border: `1px solid ${primario ? theme.accent : theme.border}`, background: primario ? (theme.accentBg || 'rgba(0,122,255,0.08)') : theme.surface, borderRadius: 12, padding: '14px 14px', cursor: 'pointer', color: theme.text, fontFamily: TYPO.fontText }}>
        <span style={{ display: 'inline-flex', width: 32, height: 32, borderRadius: 9, alignItems: 'center', justifyContent: 'center', background: theme.accent, color: '#FFF', marginBottom: 8 }}><Icon size={16} /></span>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em' }}>{titulo}</div>
        <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 3, lineHeight: 1.4 }}>{sub}</div>
      </button>
    );
  };

  return (
    <Modal abierto={abierto} onClose={cerrar} theme={theme} ancho={camino === 'factura' ? 860 : 640} titulo="Nuevo pedido" sub={camino === 'factura' ? 'Elige la factura del ERP: los productos, piezas y precios se cargan solos' : 'Un pedido puede tener varias facturas y varios envíos parciales'}>
      {camino !== 'factura' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', gap: 10 }}>
            {tarjeta(ClipboardList, 'Desde la OC del cliente', 'Ya nos compartieron la orden de compra (PDF, Excel, correo). Capturas número de OC, fecha y productos; las facturas del ERP se ligan solas después.', () => { cerrar(); onElegirOC?.('oc'); }, true)}
            {tarjeta(FileText, 'Desde una factura del ERP', `Ya se facturó sin OC registrada. Eliges la factura y el pedido nace con sus productos. ${facturasSinPedido.length ? `${facturasSinPedido.length} factura${facturasSinPedido.length === 1 ? '' : 's'} sin pedido.` : 'Hoy no hay facturas sin pedido.'}`, () => setCamino('factura'), false)}
          </div>
          <button type="button" onClick={() => { cerrar(); onElegirOC?.('pegar'); }} style={{ alignSelf: 'flex-start', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 0' }}><ClipboardPaste size={13} />Tengo el correo de la OC: pegarlo y que se lea solo</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: 8, color: theme.textMuted }} />
              <Input value={q} onChange={setQ} placeholder="Buscar por folio, referencia o cliente" style={{ paddingLeft: 28, width: '100%', boxSizing: 'border-box' }} autoFocus />
            </div>
            {cliente && <ClientePill k={cliente} size="sm" />}
            <Boton onClick={() => setCamino(null)}>Atrás</Boton>
          </div>
          <TablaCompacta dense maxHeight={260} filas={lista} rowKey={(r) => r.folio} onRowClick={toggle} vacio="No hay facturas del ERP sin pedido en los últimos 30 días."
            columnas={[
              { key: 'sel', label: '', width: 28, render: (r) => <span style={{ display: 'inline-flex', width: 16, height: 16, borderRadius: 999, border: `1.5px solid ${sel.has(r.folio) ? theme.accent : theme.border}`, background: sel.has(r.folio) ? theme.accent : 'transparent', color: '#FFF', alignItems: 'center', justifyContent: 'center' }}>{sel.has(r.folio) && <Check size={10} strokeWidth={3} />}</span> },
              { key: 'folio', label: 'Factura', align: 'left', mono: true, bold: true },
              { key: 'cliente', label: 'Cliente', align: 'left', render: (r) => <ClientePill k={r.cliente_key} /> },
              { key: 'referencia', label: 'Referencia (OC)', align: 'left', maxWidth: 180, render: (r) => <span title={r.referencia || ''} style={{ color: r.referencia && !/^sin\s+orden/i.test(r.referencia) ? theme.text : theme.textMuted }}>{r.referencia || 'sin referencia'}</span> },
              { key: 'fecha', label: 'Fecha', align: 'left', render: (r) => fmtFecha(r.fecha) },
              { key: 'n_partidas', label: 'Prod.', render: (r) => fmtInt(r.n_partidas || (r.partidas || []).length) },
              { key: 'piezas', label: 'Pz', render: (r) => fmtInt(r.piezas) },
              { key: 'monto', label: 'Monto', render: (r) => fmtMoney(r.monto) },
            ]} />
          {elegidas.length > 0 && (
            <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600 }}>Pedido {numeroPedido}</span>
                <Pill tone="gray" size="xs">{referencia ? 'número de OC = referencia de la factura' : 'sin referencia: se identifica por el folio'}</Pill>
                <span style={{ marginLeft: 'auto', fontSize: 11.5, color: theme.textMuted }}>{elegidas.length} factura{elegidas.length === 1 ? '' : 's'} · {partidas.length} productos · {fmtInt(totalPz)} pz · {fmtMoney(totalMonto)}</span>
              </div>
              <TablaCompacta dense maxHeight={220} filas={partidas} rowKey={(r) => r.sku} columnas={[
                { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true },
                { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 360, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
                { key: 'piezas', label: 'Piezas', render: (r) => fmtInt(r.piezas) },
                { key: 'precio', label: 'Precio', render: (r) => fmtMoney(r.piezas ? r.monto / r.piezas : 0) },
                { key: 'monto', label: 'Monto', render: (r) => fmtMoney(r.monto) },
              ]} />
              <Nota>Estos productos ya están facturados: el pedido nace en etapa «facturada». Lo que sigue es registrar el envío (guía, paquetería, fecha) y la entrega.</Nota>
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
            <Boton onClick={cerrar}>Cancelar</Boton>
            <Boton primario onClick={crear} disabled={!elegidas.length || busy}>{busy ? 'Creando…' : `Crear pedido${elegidas.length ? ` · ${fmtInt(totalPz)} pz` : ''}`}</Boton>
          </div>
        </div>
      )}
    </Modal>
  );
}
