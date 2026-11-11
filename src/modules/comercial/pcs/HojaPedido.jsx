// Acteck PCs · hoja del pedido (alta y edición). Un pedido = la OC interna a DECME para surtir a un cliente.
// Arriba cliente y fechas; en medio los modelos con equipos y precio; abajo el avance (etapa, guía, facturas, cobro y pago).
import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, Segmented, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { money, int, fechaCorta, hoyISO } from '../../../lib/format.js';
import { Campo, Entrada, AreaTexto, Selector } from '../proyectos/campos';
import CampoNumero from '../propuestas/CampoNumero';
import { ESTADOS, TARIMA, avisosTarima, entregaEstimada, costoVigente } from './calculo.js';
import { guardarOrden, eliminarOrden } from './datos';

const VACIO = { folio: '', fecha: '', cliente: '', oc_cliente: '', estado: 'recibida', direct_order: false, fecha_entrega: '', guia: '', factura_cliente: '', factura_cliente_vence: '', cobrado_at: '', factura_decme: '', factura_decme_monto: '', factura_decme_vence: '', pagado_decme_at: '', notas: '' };

export default function HojaPedido({ pedido, datos, sensible, perfil, onClose, enLinea = false }) {
  const { theme } = useTheme();
  const nuevo = !pedido;
  const [c, setC] = useState(() => (pedido ? Object.fromEntries(Object.keys(VACIO).map((k) => [k, pedido[k] ?? VACIO[k]])) : { ...VACIO, fecha: hoyISO() }));
  const [lineas, setLineas] = useState(() => (pedido?.lineas?.length ? pedido.lineas.map((l) => ({ sku_modelo: l.sku_modelo, equipos: l.equipos, precio: l.precio, costo: l.costo })) : [{ sku_modelo: '', equipos: TARIMA, precio: null, costo: null }]));
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (v) => setC((x) => ({ ...x, [k]: v }));
  const opcModelos = [{ id: '', label: 'Elegir modelo…' }, ...datos.modelos.map((m) => ({ id: m.sku, label: `${m.sku} · ${[m.procesador, m.memoria, m.almacenamiento].filter(Boolean).join(' · ') || m.licencia || ''}` }))];
  const cambiarLinea = (i, cambios) => setLineas((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));
  const elegirModelo = (i, sku) => cambiarLinea(i, { sku_modelo: sku, precio: datos.precios[sku] ?? null, costo: costoVigente(datos.costos, sku, c.fecha || hoyISO())?.costo ?? null });
  const equipos = lineas.reduce((s, l) => s + (Number(l.equipos) || 0), 0);
  const monto = lineas.reduce((s, l) => s + (Number(l.equipos) || 0) * (Number(l.precio) || 0), 0);
  const avisos = useMemo(() => avisosTarima(lineas), [lineas]);
  const est = entregaEstimada(c.fecha, equipos);
  const clientes = useMemo(() => Array.from(new Set(datos.ordenes.map((o) => o.cliente).filter(Boolean))).sort(), [datos.ordenes]);

  const guardar = async () => {
    if (!String(c.cliente).trim()) { toast.error('Falta el cliente'); return; }
    if (!lineas.some((l) => l.sku_modelo && Number(l.equipos) > 0)) { toast.error('Agrega al menos un modelo'); return; }
    setOcupado(true);
    try {
      await guardarOrden({ ...(pedido ? { id: pedido.id } : {}), ...c, cliente: String(c.cliente).trim() }, lineas, perfil);
      toast.ok(nuevo ? 'Pedido registrado' : 'Pedido guardado');
      onClose();
    } catch (e) { toast.error(`No se guardó: ${e.message}`); } finally { setOcupado(false); }
  };
  const borrar = async () => {
    if (!window.confirm('¿Eliminar este pedido? No se puede deshacer.')) return;
    setOcupado(true);
    try { await eliminarOrden(pedido.id); toast.ok('Pedido eliminado'); onClose(); } catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };

  const h3 = { fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, margin: '18px 4px 8px' };
  const g2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '0 4px' };
  const inputAlto = { height: 40, fontSize: 14 };

  const titulo = nuevo ? 'Nuevo pedido' : `Pedido ${pedido.folio || pedido.oc_cliente || ''}`.trim();
  const subt = nuevo ? 'OC interna a DECME para surtir a un cliente' : `${pedido.cliente} · ${int(pedido.equipos)} equipos`;
  // Vista dividida: el mismo formulario, pintado a la derecha de la lista en vez de en una hoja.
  const Marco = enLinea
    ? ({ children }) => (<div style={{ padding: '14px 12px 18px', fontFamily: TYPO.fontText }}><div style={{ padding: '0 4px 10px' }}><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>{titulo}</div><div style={{ fontSize: 12, color: theme.textMuted }}>{subt}</div></div>{children}</div>)
    : ({ children }) => (<HojaLateral abierto onClose={onClose} theme={theme} ancho={560} titulo={titulo} sub={subt}>{children}</HojaLateral>);
  return Marco({ children: (<>
      <div style={g2}>
        <Campo label="Cliente"><Entrada valor={c.cliente} onChange={set('cliente')} placeholder="CVA, CT, PCH…" style={inputAlto} /></Campo>
        <Campo label="Fecha de la orden"><Entrada tipo="date" valor={c.fecha} onChange={set('fecha')} style={inputAlto} /></Campo>
        <Campo label="OC a DECME (folio)"><Entrada valor={c.folio} onChange={set('folio')} style={inputAlto} /></Campo>
        <Campo label="OC del cliente"><Entrada valor={c.oc_cliente} onChange={set('oc_cliente')} style={inputAlto} /></Campo>
      </div>
      {!!clientes.length && nuevo && !c.cliente && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '8px 4px 0' }}>{clientes.map((n) => <Pill key={n} tone="blue" onClick={() => set('cliente')(n)} style={{ padding: '6px 12px' }}>{n}</Pill>)}</div>
      )}
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 4px 0', fontSize: 12.5, color: theme.text, minHeight: 44 }}>
        <input type="checkbox" checked={!!c.direct_order} onChange={(e) => set('direct_order')(e.target.checked)} style={{ width: 18, height: 18 }} /> Direct order: se entrega directo al distribuidor del mayorista
      </label>

      <div style={h3}>Modelos</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
        {lineas.map((l, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8, minWidth: 0 }}>
              <Campo label="Modelo" style={{ gridColumn: '1 / -1' }}><Selector valor={l.sku_modelo} onChange={(v) => elegirModelo(i, v)} opciones={opcModelos} style={inputAlto} /></Campo>
              <Campo label="Equipos"><CampoNumero value={l.equipos} onChange={(v) => cambiarLinea(i, { equipos: v })} ancho="100%" alto={40} /></Campo>
              <Campo label="Precio por equipo"><CampoNumero value={l.precio} onChange={(v) => cambiarLinea(i, { precio: v })} decimales={2} ancho="100%" alto={40} /></Campo>
              {sensible && <Campo label="Costo DECME"><CampoNumero value={l.costo} onChange={(v) => cambiarLinea(i, { costo: v })} decimales={2} ancho="100%" alto={40} placeholder="vigente" /></Campo>}
            </div>
            <Boton icon={Trash2} peligro size="md" onClick={() => setLineas((ls) => (ls.length > 1 ? ls.filter((_, j) => j !== i) : ls))} title="Quitar modelo" style={{ height: 40 }} />
          </div>
        ))}
        <div><Boton icon={Plus} size="md" onClick={() => setLineas((ls) => [...ls, { sku_modelo: '', equipos: TARIMA, precio: null, costo: null }])}>Otro modelo</Boton></div>
        <div style={{ fontSize: 12.5, color: theme.text, fontVariantNumeric: 'tabular-nums' }}><b>{int(equipos)} equipos</b> · {(equipos / TARIMA).toFixed(equipos % TARIMA ? 1 : 0)} tarimas · {money(monto)}{est ? ` · entrega estimada ${fechaCorta(est.entrega)} (${est.diasProduccion} día${est.diasProduccion === 1 ? '' : 's'} de producción)` : ''}</div>
        {avisos.map((a) => <Pill key={a} tone="orange" style={{ alignSelf: 'flex-start', whiteSpace: 'normal' }}>{a}</Pill>)}
      </div>

      <div style={h3}>Avance</div>
      <div style={{ padding: '0 4px 10px', overflowX: 'auto' }}>
        <Segmented size="md" value={c.estado} onChange={set('estado')} options={[...ESTADOS.map((e) => ({ id: e.id, label: e.label })), { id: 'cancelada', label: 'Cancelado' }]} />
      </div>
      <div style={g2}>
        <Campo label="Fecha de entrega" hint={est && !c.fecha_entrega ? `estimada ${fechaCorta(est.entrega)}` : null}><Entrada tipo="date" valor={c.fecha_entrega} onChange={set('fecha_entrega')} style={inputAlto} /></Campo>
        <Campo label="Guía"><Entrada valor={c.guia} onChange={set('guia')} style={inputAlto} /></Campo>
      </div>

      <div style={h3}>Factura al cliente</div>
      <div style={g2}>
        <Campo label="Folio"><Entrada valor={c.factura_cliente} onChange={set('factura_cliente')} style={inputAlto} /></Campo>
        <Campo label="Vence"><Entrada tipo="date" valor={c.factura_cliente_vence} onChange={set('factura_cliente_vence')} style={inputAlto} /></Campo>
        <Campo label="Cobrado el"><Entrada tipo="date" valor={c.cobrado_at} onChange={set('cobrado_at')} style={inputAlto} /></Campo>
      </div>

      <div style={h3}>Factura de DECME</div>
      <div style={g2}>
        <Campo label="Folio"><Entrada valor={c.factura_decme} onChange={set('factura_decme')} style={inputAlto} /></Campo>
        <Campo label="Monto"><CampoNumero value={c.factura_decme_monto} onChange={set('factura_decme_monto')} decimales={2} ancho="100%" alto={40} /></Campo>
        <Campo label="Vence"><Entrada tipo="date" valor={c.factura_decme_vence} onChange={set('factura_decme_vence')} style={inputAlto} /></Campo>
        <Campo label="Pagado el"><Entrada tipo="date" valor={c.pagado_decme_at} onChange={set('pagado_decme_at')} style={inputAlto} /></Campo>
      </div>

      <div style={{ padding: '14px 4px 0' }}><Campo label="Notas"><AreaTexto valor={c.notas} onChange={set('notas')} filas={2} /></Campo></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '18px 4px 0' }}>
        {nuevo ? <span /> : <Boton peligro size="md" icon={Trash2} disabled={ocupado} onClick={borrar} style={{ height: 44 }}>Eliminar</Boton>}
        <Boton primario size="md" disabled={ocupado} onClick={guardar} style={{ height: 44, padding: '0 24px' }}>{ocupado ? 'Guardando…' : 'Guardar'}</Boton>
      </div>
  </>) });
}
