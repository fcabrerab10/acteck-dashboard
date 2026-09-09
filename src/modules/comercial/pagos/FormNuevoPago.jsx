// Formulario de alta de pago (no fijos) · incluye "¿de qué fondo sale el pago?" para Dicotech.
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { Panel, Boton, Pill } from '../../../components/kit';
import { CATEGORIA_META, ESTATUS_OPT, TIPOS_ACTIVIDAD_MKT, Campo, Input, Select, MONO } from './pagosUI';

export default function FormNuevoPago({ clienteKey, newRow, setNewRow, onSave, onCancel, dicoFondoTablaMensual }) {
  const { theme } = useTheme();
  const set = (k) => (e) => setNewRow((p) => ({ ...p, [k]: e.target.value }));
  const saldoCli = dicoFondoTablaMensual?.saldoCliActual || 0;
  const saldoInt = dicoFondoTablaMensual?.saldoIntActual || 0;
  const t = parseFloat(newRow.monto) || 0;
  const fc = parseFloat(newRow.monto_fondo_mkt_cliente) || 0;
  const fi = parseFloat(newRow.monto_fondo_interno) || 0;
  const resto = t - fc - fi;
  const excede = resto < 0;

  return (
    <Panel titulo="Nuevo pago" meta="Concepto y categoría son obligatorios" acciones={
      <>
        <Boton onClick={onCancel}>Cancelar</Boton>
        <Boton primario onClick={onSave} disabled={!newRow.concepto?.trim()}>Guardar pago</Boton>
      </>
    }>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        <Campo label="Categoría *">
          <Select value={newRow.categoria} onChange={set('categoria')}>
            {Object.entries(CATEGORIA_META).filter(([, m]) => !m.soloPara || m.soloPara.includes(clienteKey)).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </Select>
        </Campo>
        <Campo label="Concepto *" style={{ gridColumn: 'span 2' }}><Input type="text" value={newRow.concepto || ''} onChange={set('concepto')} placeholder="Descripción del pago" /></Campo>
        <Campo label="Monto (MXN)"><Input type="number" value={newRow.monto || ''} onChange={set('monto')} placeholder="0" style={MONO} /></Campo>
        <Campo label="Fuente de pago">
          <Select value={newRow.fuente || ''} onChange={set('fuente')}>
            <option value="">— Sin asignar —</option>
            {clienteKey === 'pcel' && <option value="fondo_mkt">Fondo MKT</option>}
            <option value="vendor">Vendor (convenio cliente)</option>
            <option value="empresa">Empresa (Revko)</option>
          </Select>
        </Campo>
        {newRow.categoria === 'marketing' && (
          <Campo label="Tipo de actividad">
            <Select value={newRow.tipo_actividad || ''} onChange={set('tipo_actividad')}>
              <option value="">— Sin tipo —</option>
              {TIPOS_ACTIVIDAD_MKT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </Select>
          </Campo>
        )}
        <Campo label="Estatus">
          <Select value={newRow.estatus} onChange={set('estatus')}>
            {ESTATUS_OPT.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </Select>
        </Campo>
        <Campo label="F. compromiso"><Input type="date" value={newRow.fecha_compromiso || ''} onChange={set('fecha_compromiso')} /></Campo>
        <Campo label="F. pago real"><Input type="date" value={newRow.fecha_pago_real || ''} onChange={set('fecha_pago_real')} /></Campo>
        <Campo label="Responsable"><Input type="text" value={newRow.responsable || ''} onChange={set('responsable')} /></Campo>
        <Campo label="Folio (del cliente)"><Input type="text" value={newRow.folio || ''} onChange={set('folio')} placeholder="Folio del cliente" /></Campo>
        <Campo label="Notas" style={{ gridColumn: 'span 2' }}><Input type="text" value={newRow.notas || ''} onChange={set('notas')} /></Campo>
      </div>

      {clienteKey === 'dicotech' && (
        <div style={{ marginTop: 12, padding: '10px 12px', borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.bg }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '-0.005em', color: theme.text }}>¿De qué fondo sale el pago?</span>
            <span style={{ fontSize: 10, color: theme.textMuted }}>Opcional — déjalo en blanco si no toca fondos</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
            <Campo label="Desde Fondo MKT Cliente" hint={`Saldo actual: ${formatMXN(saldoCli)}`}>
              <Input type="number" step="0.01" value={newRow.monto_fondo_mkt_cliente} onChange={set('monto_fondo_mkt_cliente')} placeholder="0.00" style={{ ...MONO, borderColor: theme.green }} />
            </Campo>
            <Campo label="Desde Fondo Interno" hint={`Saldo actual: ${formatMXN(saldoInt)}`}>
              <Input type="number" step="0.01" value={newRow.monto_fondo_interno} onChange={set('monto_fondo_interno')} placeholder="0.00" style={{ ...MONO, borderColor: theme.purple }} />
            </Campo>
            <Campo label="Resto (Acteck directo)" hint="Lo que paga la empresa sin tocar fondos">
              <div style={{ height: 30, display: 'flex', alignItems: 'center', padding: '0 10px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, ...MONO, fontSize: 12, fontWeight: 600, color: excede ? theme.red : theme.text }}>
                {formatMXN(Math.max(0, resto))}{excede && <span style={{ marginLeft: 6, fontSize: 10 }}>(split excede monto)</span>}
              </div>
            </Campo>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            <Boton onClick={() => { const tomaCli = Math.min(t, Math.max(0, saldoCli)); const tomaInt = Math.max(0, t - tomaCli); setNewRow((p) => ({ ...p, monto_fondo_mkt_cliente: tomaCli.toFixed(2), monto_fondo_interno: tomaInt.toFixed(2) })); }}>Auto split (cliente → interno)</Boton>
            <Boton onClick={() => setNewRow((p) => ({ ...p, monto_fondo_mkt_cliente: (parseFloat(p.monto) || 0).toFixed(2), monto_fondo_interno: '' }))}>Todo del cliente</Boton>
            <Boton onClick={() => setNewRow((p) => ({ ...p, monto_fondo_mkt_cliente: '', monto_fondo_interno: (parseFloat(p.monto) || 0).toFixed(2) }))}>Todo del interno</Boton>
            <Boton onClick={() => setNewRow((p) => ({ ...p, monto_fondo_mkt_cliente: '', monto_fondo_interno: '' }))}>Limpiar split</Boton>
            {(fc > 0 || fi > 0) && <Pill tone={excede ? 'red' : 'green'} size="xs" style={{ alignSelf: 'center' }}>{excede ? 'Split excede el monto' : `Cliente ${formatMXN(fc)} · Interno ${formatMXN(fi)}`}</Pill>}
          </div>
        </div>
      )}
    </Panel>
  );
}
