// "＋ Pago manual" · protección de precio, bonificaciones, apoyos de evento, ajustes.
// Protección de precio la calcula Fernando: el formulario le muestra el inventario del
// cliente y la diferencia contra la lista de precios como apoyo, pero no crea el pago solo.
import React, { useEffect, useState } from 'react';
import { Calculator } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, TablaCompacta, toast } from '../../../components/kit';
import { Modal } from '../../../components/perfil/comun';
import { traerApoyoProteccion, detallePagoManual } from './datos';
import M from './motor';
import { TIPOS_MANUALES, TIPO_META } from './estados';
import { CLIENTE_LABEL } from './reglas';
import { mxn, MONO, Nota, CampoInline, Entrada, Selector, AreaTexto } from './ui';

export default function FormPagoManual({ abierto, onCerrar, clientes, clienteInicial, anio, mes, onGuardar }) {
  const { theme } = useTheme();
  const [f, setF] = useState({
    cliente: clienteInicial || clientes[0], tipo: 'proteccion_precio', concepto: '', monto: '',
    periodo: M.periodoMes(anio, mes), fecha_programada: '', notas: '',
  });
  const [apoyo, setApoyo] = useState(null);
  const [cargandoApoyo, setCargandoApoyo] = useState(false);

  useEffect(() => {
    if (abierto) setF((x) => ({ ...x, cliente: clienteInicial || clientes[0], periodo: M.periodoMes(anio, mes) }));
  }, [abierto, clienteInicial, anio, mes]);

  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  // Apoyo de protección de precio: inventario del cliente × diferencia contra la lista vigente.
  const calcularApoyo = async () => {
    setCargandoApoyo(true);
    try {
      // Consulta + motor en ./datos.js (la usa también el celular).
      const r = await traerApoyoProteccion(f.cliente);
      setApoyo(r);
      if (r.total > 0 && !f.monto) setF((x) => ({ ...x, monto: String(r.total) }));
      if (r.filas.length === 0) toast.ok(`Inventario de ${CLIENTE_LABEL[f.cliente]}: ${r.inventario} SKU. Sin bajas de lista detectadas — captura el monto.`);
    } catch (e) {
      toast.error('No se pudo traer el apoyo: ' + (e.message || e));
    } finally { setCargandoApoyo(false); }
  };

  const guardar = async () => {
    if (!f.concepto.trim() || !(Number(f.monto) > 0)) { toast.error('Concepto y monto son obligatorios.'); return; }
    try {
      await onGuardar?.({
        ...f, monto: Number(f.monto),
        detalle: detallePagoManual({ concepto: f.concepto, monto: f.monto, apoyo }),
      });
      onCerrar?.();
      setF((x) => ({ ...x, concepto: '', monto: '', notas: '' }));
      setApoyo(null);
    } catch (e) { toast.error(e.message || String(e)); }
  };

  return (
    <Modal abierto={abierto} onClose={onCerrar} theme={theme} ancho={560} titulo="Pago manual" sub="Entra al mismo flujo: calculado → solicitado → autorizado → folio → pagado">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: TYPO.fontText }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <CampoInline label="Cliente">
            <Selector value={f.cliente} onChange={set('cliente')}>
              {clientes.map((k) => <option key={k} value={k}>{CLIENTE_LABEL[k]}</option>)}
            </Selector>
          </CampoInline>
          <CampoInline label="Categoría">
            <Selector value={f.tipo} onChange={set('tipo')}>
              {TIPOS_MANUALES.map((t) => <option key={t} value={t}>{TIPO_META[t].label}</option>)}
            </Selector>
          </CampoInline>
        </div>
        <CampoInline label="Concepto"><Entrada value={f.concepto} onChange={set('concepto')} placeholder="Protección de precio · lista septiembre" /></CampoInline>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
          <CampoInline label="Monto"><Entrada type="number" step="0.01" value={f.monto} onChange={set('monto')} /></CampoInline>
          <CampoInline label="Periodo"><Entrada value={f.periodo} onChange={set('periodo')} placeholder="2026-09" /></CampoInline>
          <CampoInline label="Fecha de pago"><Entrada type="date" value={f.fecha_programada} onChange={set('fecha_programada')} /></CampoInline>
        </div>
        <CampoInline label="Notas"><AreaTexto rows={2} value={f.notas} onChange={set('notas')} /></CampoInline>

        {f.tipo === 'proteccion_precio' && (
          <div style={{ border: `1px solid ${theme.border}`, borderRadius: 10, padding: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>Apoyo de cálculo</span>
              <Boton icon={Calculator} onClick={calcularApoyo} disabled={cargandoApoyo}>
                {cargandoApoyo ? 'Calculando…' : 'Traer inventario del cliente'}
              </Boton>
            </div>
            <Nota>Inventario reportado por el cliente × diferencia contra la lista de precios. El monto final lo decides tú.</Nota>
            {apoyo && (
              <div style={{ marginTop: 6 }}>
                <Nota>{apoyo.inventario} SKU con existencia · {apoyo.filas.length} con baja de precio · apoyo {mxn(apoyo.total)}</Nota>
                {apoyo.filas.length > 0 && (
                  <TablaCompacta dense maxHeight={200}
                    columnas={[
                      { key: 'sku', label: 'SKU', align: 'left' },
                      { key: 'piezas', label: 'Piezas' },
                      { key: 'precio_anterior', label: 'Antes', render: (r) => mxn(r.precio_anterior) },
                      { key: 'precio_nuevo', label: 'Ahora', render: (r) => mxn(r.precio_nuevo) },
                      { key: 'monto', label: 'Apoyo', render: (r) => mxn(r.monto) },
                    ]}
                    filas={apoyo.filas} rowKey={(r) => r.sku} />
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
          <Boton onClick={onCerrar}>Cancelar</Boton>
          <Boton primario onClick={guardar}>Crear pago</Boton>
        </div>
      </div>
    </Modal>
  );
}
