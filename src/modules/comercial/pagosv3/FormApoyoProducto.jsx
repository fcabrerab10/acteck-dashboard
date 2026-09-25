// «＋ Apoyo por producto» (2026-09-24, diseño B). El apoyo entra a Pagos como un pago más (tipo apoyo_producto)
// con sus productos en el detalle: SKU · inventario apoyado · precio de factura · apoyo por pieza → nuevo costo ·
// inventario restante en el cliente. Se liga a la bonificación del ERP (por folio) y se muestra el cuadre.
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Plus, X, Link2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, toast } from '../../../components/kit';
import { Modal } from '../../../components/perfil/comun';
import CampoNumero from '../propuestas/CampoNumero';
import M from './motor';
import { CLIENTE_LABEL } from './reglas';
import { mxn, mxn2, MONO, Nota, CampoInline, Selector, AreaTexto, Entrada } from './ui';
import { calcularApoyo, conceptoApoyo, detalleApoyo, historialSku } from './apoyos';
import { buscarSkus, datosProducto, bonificacionesErp, bonificacionesLigadas } from './datosApoyos';
import { PillCuadre } from './TablaApoyo';

export default function FormApoyoProducto({ abierto, onCerrar, clientes, clienteInicial, anio, mes, pagos = [], onGuardar }) {
  const { theme } = useTheme();
  const [cliente, setCliente] = useState(clienteInicial || clientes[0]);
  const [productos, setProductos] = useState([]);
  const [bonif, setBonif] = useState(null);
  const [lista, setLista] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [busca, setBusca] = useState('');
  const [sugs, setSugs] = useState([]);
  const [notas, setNotas] = useState('');
  const [fechaPago, setFechaPago] = useState('');
  const [guardando, setGuardando] = useState(false);
  const ligadas = useMemo(() => bonificacionesLigadas(pagos), [pagos]);

  useEffect(() => { if (abierto) { setCliente(clienteInicial || clientes[0]); setProductos([]); setBonif(null); setBusca(''); setSugs([]); setNotas(''); } }, [abierto, clienteInicial, clientes]);
  useEffect(() => {
    if (!abierto || !cliente) return undefined;
    let vivo = true; setCargandoLista(true);
    bonificacionesErp(cliente).then((l) => { if (vivo) { setLista(l); setCargandoLista(false); } }).catch(() => { if (vivo) { setLista([]); setCargandoLista(false); } });
    return () => { vivo = false; };
  }, [abierto, cliente]);
  useEffect(() => {
    if (busca.trim().length < 2) { setSugs([]); return undefined; }
    let vivo = true;
    const t = setTimeout(() => buscarSkus(busca).then((r) => { if (vivo) setSugs(r.filter((s) => !productos.some((p) => p.sku === s.sku))); }).catch(() => {}), 180);
    return () => { vivo = false; clearTimeout(t); };
  }, [busca, productos]);

  const agregar = async (s) => {
    setBusca(''); setSugs([]);
    const base = { sku: s.sku, descripcion: s.descripcion || '', piezas: null, precio_factura: 0, apoyo_pz: null, inv_restante: null, cargando: true };
    setProductos((prev) => [...prev, base]);
    try {
      const d = await datosProducto(cliente, s.sku);
      setProductos((prev) => prev.map((p) => (p.sku === s.sku ? { ...p, precio_factura: d.precio_factura, factura_fecha: d.factura_fecha, inv_restante: d.inv_restante, inv_semana: d.inv_semana, piezas: p.piezas ?? d.inv_restante ?? null, cargando: false } : p)));
    } catch { setProductos((prev) => prev.map((p) => (p.sku === s.sku ? { ...p, cargando: false } : p))); }
  };
  const editar = (sku, patch) => setProductos((prev) => prev.map((p) => (p.sku === sku ? { ...p, ...patch } : p)));
  const quitar = (sku) => setProductos((prev) => prev.filter((p) => p.sku !== sku));
  const calc = useMemo(() => calcularApoyo(productos, bonif), [productos, bonif]);

  const guardar = async () => {
    if (!productos.length) { toast.error('Agrega al menos un producto.'); return; }
    if (calc.lineas.some((l) => !(l.piezas > 0) || !(l.apoyo_pz > 0))) { toast.error('Cada producto necesita piezas y apoyo por pieza.'); return; }
    if (bonif && calc.cuadre.estado === 'difiere' && !window.confirm(`La suma de los productos (${mxn(calc.total)}) no cuadra con la bonificación ${bonif.folio} (${mxn(bonif.monto)}): ${calc.cuadre.label}. ¿Guardar de todos modos?`)) return;
    setGuardando(true);
    try {
      await onGuardar?.({
        cliente, tipo: 'apoyo_producto', concepto: conceptoApoyo(productos, bonif), monto: calc.total,
        periodo: bonif?.fecha ? bonif.fecha.slice(0, 7) : M.periodoMes(anio, mes), fecha_programada: fechaPago || null, notas,
        detalle: detalleApoyo(productos, bonif),
      });
      onCerrar?.();
    } catch (e) { toast.error(e.message || String(e)); }
    setGuardando(false);
  };

  const th = { textAlign: 'right', padding: '4px 6px', fontFamily: TYPO.fontDisplay, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted, borderBottom: `1px solid ${theme.border}`, whiteSpace: 'nowrap' };
  const td = { textAlign: 'right', padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, fontSize: 11.5, ...MONO, whiteSpace: 'nowrap' };

  return (
    <Modal abierto={abierto} onClose={onCerrar} theme={theme} ancho={860} titulo="Apoyo por producto" sub="Entra al flujo de pagos con sus productos; la suma debe cuadrar con la bonificación del ERP">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText }}>
        <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 8 }}>
          <CampoInline label="Cliente">
            <Selector value={cliente} onChange={(e) => { setCliente(e.target.value); setProductos([]); setBonif(null); }}>
              {clientes.map((k) => <option key={k} value={k}>{CLIENTE_LABEL[k]}</option>)}
            </Selector>
          </CampoInline>
          <CampoInline label="Bonificación del ERP">
            <Selector value={bonif?.venta_id ?? ''} onChange={(e) => setBonif(lista.find((b) => String(b.venta_id) === e.target.value) || null)}>
              <option value="">{cargandoLista ? 'Cargando bonificaciones…' : 'Todavía no hay bonificación · ligar después'}</option>
              {lista.map((b) => { const ya = ligadas.get(b.venta_id); return <option key={b.venta_id} value={b.venta_id} disabled={!!ya}>{b.fecha} · {b.folio} · {String(b.concepto || '').toLowerCase()} · {mxn(b.monto)}{ya ? ' · ya ligada' : ''}</option>; })}
            </Selector>
          </CampoInline>
        </div>

        <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>Productos apoyados</span>
            <div style={{ position: 'relative', marginLeft: 'auto', width: 320 }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: 8, color: theme.textMuted }} />
              <Entrada value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Agregar producto: SKU o descripción" style={{ paddingLeft: 28, width: '100%', boxSizing: 'border-box' }} />
              {sugs.length > 0 && (
                <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', zIndex: 5, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, padding: 4, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
                  {sugs.map((s) => <button key={s.sku} type="button" onClick={() => agregar(s)} style={{ display: 'flex', width: '100%', gap: 8, alignItems: 'center', border: 0, background: 'transparent', color: theme.text, padding: '6px 8px', borderRadius: 7, cursor: 'pointer', textAlign: 'left', fontFamily: TYPO.fontText, fontSize: 12 }}><Plus size={12} style={{ color: theme.accent }} /><span style={{ ...MONO, fontWeight: 600 }}>{s.sku}</span><span style={{ color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.descripcion}</span></button>)}
                </div>
              )}
            </div>
          </div>
          {!productos.length ? <Nota>Busca el producto que se alentó. Se trae solo el precio de su última factura a este cliente y el inventario que hoy reporta; tú pones cuántas piezas se apoyan y el apoyo por pieza.</Nota> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr><th style={{ ...th, textAlign: 'left' }}>Producto</th><th style={th}>Inv apoyado</th><th style={th}>Precio factura</th><th style={th}>Apoyo / pz</th><th style={th}>Nuevo costo</th><th style={th}>Monto</th><th style={th}>Inv restante</th><th style={th} /></tr></thead>
                <tbody>
                  {calc.lineas.map((l) => (
                    <tr key={l.sku}>
                      <td style={{ ...td, textAlign: 'left' }}>
                        <span style={{ fontWeight: 600 }}>{l.sku}</span>
                        <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.textMuted, maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.descripcion}</div>
                        {(() => { const h = historialSku(pagos, cliente, l.sku); if (!h.length) return null; const tot = h.reduce((s, x) => s + x.monto, 0); return <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: theme.orange || '#FF9500' }} title={h.map((x) => `${x.fecha} · ${x.piezas} pz × ${mxn2(x.apoyo_pz)} = ${mxn(x.monto)}${x.folio ? ` · NC ${x.folio}` : ''} · ${x.estado}`).join('\n')}>Ya lleva {h.length} apoyo{h.length === 1 ? '' : 's'} · {mxn(tot)} · último {h[0].fecha}</div>; })()}
                      </td>
                      <td style={td}><CampoNumero value={l.piezas} onChange={(n) => editar(l.sku, { piezas: n })} ancho={68} invalido={!(l.piezas > 0)} ariaLabel={`Piezas apoyadas de ${l.sku}`} /></td>
                      <td style={td}><CampoNumero value={l.precio_factura} decimales={2} onChange={(n) => editar(l.sku, { precio_factura: n })} ancho={84} title={l.factura_fecha ? `Última factura ${l.factura_fecha}` : 'Sin factura reciente: captúralo'} ariaLabel={`Precio de factura de ${l.sku}`} /></td>
                      <td style={td}><CampoNumero value={l.apoyo_pz} decimales={2} onChange={(n) => editar(l.sku, { apoyo_pz: n })} ancho={76} acento invalido={!(l.apoyo_pz > 0)} ariaLabel={`Apoyo por pieza de ${l.sku}`} /></td>
                      <td style={{ ...td, fontWeight: 600 }}>{mxn2(l.nuevo_costo)}</td>
                      <td style={td}>{mxn(l.monto)}</td>
                      <td style={{ ...td, color: l.inv_restante == null ? theme.textMuted : theme.text }} title={l.inv_semana ? `Foto ${l.inv_semana}` : ''}>{l.cargando ? '…' : l.inv_restante == null ? '—' : `${l.inv_restante.toLocaleString('es-MX')} pz`}</td>
                      <td style={{ ...td, borderBottom: `1px solid ${theme.border}` }}><button type="button" onClick={() => quitar(l.sku)} aria-label={`Quitar ${l.sku}`} style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', padding: 2 }}><X size={13} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 10px', borderRadius: 10, background: theme.surfaceHover || 'rgba(0,0,0,0.04)' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600 }}>Total {mxn(calc.total)} · {calc.piezas.toLocaleString('es-MX')} pz</span>
          {bonif ? <>
            <span style={{ fontSize: 11, color: theme.textMuted, display: 'inline-flex', gap: 4, alignItems: 'center' }}><Link2 size={11} />bonificación {bonif.folio} {mxn(bonif.monto)}</span>
            <div style={{ flex: 1, minWidth: 120, height: 6, borderRadius: 99, background: theme.border, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, bonif.monto > 0 ? calc.total / bonif.monto * 100 : 0)}%`, height: '100%', background: calc.cuadre.estado === 'cuadra' ? (theme.green || '#34C759') : calc.total > bonif.monto ? (theme.red || '#FF3B30') : (theme.accent || '#007AFF') }} /></div>
          </> : <span style={{ fontSize: 11, color: theme.textMuted }}>Sin bonificación: se guarda y la ligas cuando el ERP la emita.</span>}
          <PillCuadre cuadre={calc.cuadre} bonificacion={bonif} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', gap: 8 }}>
          <CampoInline label="Fecha de pago"><Entrada type="date" value={fechaPago} onChange={(e) => setFechaPago(e.target.value)} /></CampoInline>
          <CampoInline label="Notas"><AreaTexto rows={1} value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Por qué se apoyó, acuerdo con el cliente…" /></CampoInline>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton primario onClick={guardar} disabled={guardando || !productos.length}>{guardando ? 'Guardando…' : `Crear apoyo · ${mxn(calc.total)}`}</Boton>
        </div>
      </div>
    </Modal>
  );
}
