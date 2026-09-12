// Panel "Fondos por cliente" · saldo = abonos − cargos. Cada fondo abre su estado de cuenta.
// Un fondo en negativo se marca y bloquea cargos nuevos hasta autorizar el sobregiro.
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Boton, Pill, TablaCompacta, toast } from '../../../components/kit';
import { Modal } from '../../../components/perfil/comun';
import { mxn, MONO, Nota, CampoInline, Entrada, Selector, ClientePill } from './ui';

export default function PanelFondos({ fondos, movimientos, clientes, puedeEditar, onMovimiento }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(null);      // fondo_id del estado de cuenta
  const [form, setForm] = useState(null);            // { fondo, tipo }

  const visibles = useMemo(() => (fondos || []).filter((f) => clientes.includes(f.cliente) && f.activo !== false), [fondos, clientes]);

  const columnas = [
    { key: 'nombre', label: 'Cliente · fondo', align: 'left', render: (f) => (
      <span style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
        <ClientePill clienteKey={f.cliente} />
        <span style={{ color: theme.textMuted }}>·</span>
        <span>{f.nombre}</span>
        {f.regla?.visible_para_cliente === false && <Pill tone="gray" size="xs">interno</Pill>}
      </span>
    ) },
    { key: 'abonos_ytd', label: 'Abonos YTD', render: (f) => mxn(f.abonos_ytd) },
    { key: 'cargos_ytd', label: 'Cargos YTD', render: (f) => mxn(f.cargos_ytd) },
    { key: 'saldo', label: 'Saldo', render: (f) => (
      <span style={{ ...MONO, color: Number(f.saldo) < 0 ? theme.red : theme.text, fontWeight: 600 }}>{mxn(f.saldo)}</span>
    ) },
    { key: 'ultimo_movimiento', label: 'Último movimiento', align: 'left', render: (f) => {
      const ult = (movimientos || []).find((m) => m.fondo_id === f.fondo_id);
      if (!ult) return '—';
      return <span style={{ fontSize: 11 }}>{ult.concepto} · <span style={MONO}>{ult.tipo === 'cargo' ? '−' : '+'}{mxn(ult.monto)}</span> · {String(ult.fecha).slice(0, 10)}</span>;
    } },
    { key: 'acc', label: '', align: 'right', width: 110, render: (f) => (
      <span style={{ display: 'inline-flex', gap: 4 }}>
        {puedeEditar(f.cliente) && <Boton icon={Plus} onClick={(e) => { e?.stopPropagation?.(); setForm({ fondo: f, tipo: 'abono' }); }}>Movimiento</Boton>}
      </span>
    ) },
  ];

  const negativos = visibles.filter((f) => Number(f.saldo) < 0);
  const detalle = visibles.find((f) => f.fondo_id === abierto);
  const movsDetalle = (movimientos || []).filter((m) => m.fondo_id === abierto);

  return (
    <Panel titulo="Fondos por cliente" meta="saldo = abonos − cargos · las actividades de Marketing cargan al fondo o las paga la empresa">
      {negativos.length > 0 && (
        <div style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${theme.red}`, color: theme.red, fontSize: 11, marginBottom: 8, fontFamily: TYPO.fontText }}>
          {negativos.length === 1 ? 'Un fondo está' : `${negativos.length} fondos están`} en negativo: {negativos.map((f) => `${f.nombre} (${mxn(f.saldo)})`).join(' · ')}. Los cargos nuevos quedan bloqueados hasta autorizar el sobregiro.
        </div>
      )}

      <TablaCompacta
        columnas={columnas} filas={visibles} rowKey={(f) => f.fondo_id}
        onRowClick={(f) => setAbierto((a) => (a === f.fondo_id ? null : f.fondo_id))}
        vacio="Sin fondos configurados para los clientes que ves."
      />

      {detalle && (
        <div style={{ marginTop: 8, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>Estado de cuenta · {detalle.nombre}</div>
            <span style={{ ...MONO, fontSize: 12, color: Number(detalle.saldo) < 0 ? theme.red : theme.text }}>Saldo {mxn(detalle.saldo)}</span>
          </div>
          <TablaCompacta
            dense
            columnas={[
              { key: 'fecha', label: 'Fecha', align: 'left', render: (m) => String(m.fecha).slice(0, 10) },
              { key: 'concepto', label: 'Concepto', align: 'left' },
              { key: 'origen', label: 'Origen', align: 'left', render: (m) => <Pill tone="gray" size="xs">{m.origen || '—'}</Pill> },
              { key: 'monto', label: 'Monto', render: (m) => (
                <span style={{ ...MONO, color: m.tipo === 'cargo' ? theme.red : theme.green }}>{m.tipo === 'cargo' ? '−' : '+'}{mxn(m.monto)}</span>
              ) },
            ]}
            filas={movsDetalle} rowKey={(m) => m.id} maxHeight={260}
            vacio="Sin movimientos registrados."
          />
          <Nota style={{ marginTop: 6 }}>
            Regla de abono: {describirRegla(detalle.regla)}
          </Nota>
        </div>
      )}

      {form && (
        <Modal abierto onClose={() => setForm(null)} theme={theme} ancho={420}
               titulo={`Movimiento · ${form.fondo.nombre}`} sub={`Saldo actual ${mxn(form.fondo.saldo)}`}>
          <FormMovimiento fondo={form.fondo} onCerrar={() => setForm(null)} onGuardar={onMovimiento} />
        </Modal>
      )}
    </Panel>
  );
}

function describirRegla(regla) {
  if (!regla || regla.tipo === 'manual') return 'manual (los abonos se capturan a mano).';
  if (regla.tipo === 'pct_sell_in') return `${(Number(regla.pct) * 100).toFixed(2)} % del sell in${regla.frecuencia ? ` (${regla.frecuencia})` : ''}.`;
  if (regla.tipo === 'pct_sell_in_tiers') return `% del sell in por nivel de alcance del trimestre (respaldo ${(Number(regla.pct_fallback_q_bajo) * 100).toFixed(2)} %).`;
  return JSON.stringify(regla);
}

function FormMovimiento({ fondo, onCerrar, onGuardar }) {
  const { theme } = useTheme();
  const [tipo, setTipo] = useState('abono');
  const [monto, setMonto] = useState('');
  const [concepto, setConcepto] = useState('');
  const [fecha, setFecha] = useState(new Date().toISOString().slice(0, 10));
  const [forzar, setForzar] = useState(false);
  const bloqueado = tipo === 'cargo' && Number(fondo.saldo) < 0 && !forzar;

  const guardar = async () => {
    if (!concepto.trim() || !(Number(monto) > 0)) { toast.error('Concepto y monto son obligatorios.'); return; }
    try {
      await onGuardar?.({ fondo, tipo, monto: Number(monto), concepto: concepto.trim(), fecha, forzar });
      onCerrar?.();
    } catch (e) { toast.error(e.message || String(e)); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <CampoInline label="Tipo">
          <Selector value={tipo} onChange={(e) => setTipo(e.target.value)}>
            <option value="abono">Abono (entra al fondo)</option>
            <option value="cargo">Cargo (sale del fondo)</option>
          </Selector>
        </CampoInline>
        <CampoInline label="Fecha"><Entrada type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></CampoInline>
      </div>
      <CampoInline label="Concepto"><Entrada value={concepto} onChange={(e) => setConcepto(e.target.value)} placeholder="Generación septiembre · 1 % del sell in" /></CampoInline>
      <CampoInline label="Monto"><Entrada type="number" step="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} /></CampoInline>
      {tipo === 'cargo' && Number(fondo.saldo) < 0 && (
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: theme.red }}>
          <input type="checkbox" checked={forzar} onChange={(e) => setForzar(e.target.checked)} />
          El fondo está en negativo: autorizo el sobregiro.
        </label>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
        <Boton onClick={onCerrar}>Cancelar</Boton>
        <Boton primario disabled={bloqueado} onClick={guardar}>Guardar movimiento</Boton>
      </div>
    </div>
  );
}
