// Fondos · Dicotech (Fondo MKT cliente + Fondo interno, tabla mensual de saldos y
// aplicaciones) y PCEL (ledger de Fondo MKT / Fondo Directo con aportes y gastos).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { formatMXN } from '../../../lib/utils';
import { Panel, TablaCompacta, Pill, Boton, KpiCard } from '../../../components/kit';
import { MESES_LARGOS, Campo, Input, Select, Modal, MONO, Nota } from './pagosUI';

// ═══ Dicotech ═══
export function FondosDicotech({ dicoFondoTablaMensual, revertirMovimientoFondo, canEdit, anio }) {
  const { theme } = useTheme();
  const mesAct = new Date().getMonth() + 1;
  const COL_CLI = theme.green, COL_INT = theme.purple, COL_NEG = theme.red;
  const saldo = (n, bold) => <span style={{ fontWeight: bold ? 700 : 400, color: n < 0 ? COL_NEG : bold ? theme.text : theme.textMuted }}>{formatMXN(n)}</span>;
  const gen = (n, col) => (n > 0 ? <span style={{ fontWeight: 600, color: col }}>{formatMXN(n)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>);
  const apli = (n) => (n > 0 ? <span style={{ color: COL_NEG }}>−{formatMXN(n)}</span> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>);
  const hdr = (txt, col) => <span style={{ color: col }}>{txt}</span>;
  const columnas = [
    { key: 'mes', label: 'Mes', align: 'left', render: (f) => <span style={{ fontWeight: 600, color: f.mes > mesAct ? theme.textMuted : theme.text }}>{MESES_LARGOS[f.mes - 1]}{f.mes === mesAct && <Pill tone="blue" size="xs" style={{ marginLeft: 6 }}>Actual</Pill>}</span> },
    { key: 'saldoCliInicio', label: hdr('Cli · inicio', COL_CLI), align: 'right', render: (f) => saldo(f.saldoCliInicio) },
    { key: 'genCli', label: hdr('Cli · generación', COL_CLI), align: 'right', render: (f) => gen(f.genCli, COL_CLI) },
    { key: 'apliCli', label: hdr('Cli · aplicación', COL_CLI), align: 'right', render: (f) => apli(f.apliCli) },
    { key: 'saldoCliFinal', label: hdr('Cli · final', COL_CLI), align: 'right', render: (f) => saldo(f.saldoCliFinal, true) },
    { key: 'saldoIntInicio', label: hdr('Int · inicio', COL_INT), align: 'right', render: (f) => saldo(f.saldoIntInicio) },
    { key: 'genInt', label: hdr('Int · generación', COL_INT), align: 'right', render: (f) => gen(f.genInt, COL_INT) },
    { key: 'apliInt', label: hdr('Int · aplicación', COL_INT), align: 'right', render: (f) => apli(f.apliInt) },
    { key: 'saldoIntFinal', label: hdr('Int · final', COL_INT), align: 'right', render: (f) => saldo(f.saldoIntFinal, true) },
    { key: '_apl', label: 'Aplicaciones', align: 'left', render: (f) => {
      if (f.mes > mesAct) return <span style={{ fontSize: 10, color: theme.textSubtle || theme.textMuted }}>Futuro</span>;
      if (!f.aplicaciones.length) return <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
      return (
        <span style={{ display: 'inline-flex', flexDirection: 'column', gap: 3 }}>
          {f.aplicaciones.map((a) => (
            <span key={a.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Pill tone={a.tipo_fondo === 'interno' ? 'purple' : 'green'} size="xs" title={a.notas || ''}>{a.tipo_fondo === 'interno' ? 'Int' : 'Cli'} · {formatMXN(Number(a.monto))}</Pill>
              {canEdit && <button onClick={() => revertirMovimientoFondo(a.id)} title="Revertir aplicación (no borra el pago, solo el movimiento del fondo)" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, fontSize: 11, padding: 0 }}>✕</button>}
            </span>
          ))}
        </span>
      );
    } },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Fondo MKT cliente" big={formatMXN(dicoFondoTablaMensual.saldoCliActual)} bigColor={dicoFondoTablaMensual.saldoCliActual < 0 ? COL_NEG : undefined} sub="Tier % según alcance Q acumulado · visible al cliente" />
        <KpiCard eyebrow="Fondo interno" big={formatMXN(dicoFondoTablaMensual.saldoIntActual)} bigColor={dicoFondoTablaMensual.saldoIntActual < 0 ? COL_NEG : undefined} sub="1% × sell-in del mes · interno Acteck" />
        <KpiCard eyebrow="Plan MKT contratado" big={formatMXN(dicoFondoTablaMensual.planMonto)} bigSmall="/ mes" sub="Sale del fondo cliente primero, del interno si no alcanza" />
      </div>
      <Panel titulo={`Detalle mensual de fondos ${anio}`} meta="Saldos iniciales, generaciones y aplicaciones por mes" acciones={<><Pill tone="green" size="xs">Cliente</Pill><Pill tone="purple" size="xs">Interno</Pill></>}>
        <TablaCompacta columnas={columnas} filas={dicoFondoTablaMensual.filas} rowKey={(f) => f.mes} />
        <Nota style={{ marginTop: 8 }}>
          <strong style={{ color: theme.text }}>Esta tabla solo muestra los saldos.</strong> Para registrar un pago que descuente de los fondos usa <strong style={{ color: theme.text }}>+ Pago</strong> y el bloque "¿De qué fondo sale el pago?" (auto split cliente → interno, todo del cliente, todo del interno o un monto a la medida).
          Los movimientos quedan vinculados al pago vía <code style={{ fontFamily: TYPO.fontDisplay }}>pago_id</code>; si borras el pago, las aplicaciones se revierten automáticamente.
        </Nota>
      </Panel>
    </div>
  );
}

// ═══ PCEL · ledger ═══
export function FondosPcel({ fondoResumen, fondoLoading, canEdit, setFondoForm, setShowFondoForm, eliminarMovimientoFondo }) {
  const { theme } = useTheme();
  const abrir = (tipo, tipo_mov) => { setFondoForm((f) => ({ ...f, tipo_fondo: tipo, tipo_mov, fecha: new Date().toISOString().slice(0, 10), concepto: '', monto: '', folio: '', notas: '' })); setShowFondoForm(true); };
  const tonoMov = (m) => (m === 'inicial' ? 'gray' : m === 'aporte' ? 'green' : 'red');
  const columnas = [
    { key: 'fecha', label: 'Fecha', align: 'left', mono: true, render: (m) => new Date(m.fecha + 'T00:00:00').toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: '2-digit' }) },
    { key: 'tipo_mov', label: 'Tipo', align: 'left', render: (m) => <Pill tone={tonoMov(m.tipo_mov)} size="xs">{m.tipo_mov}</Pill> },
    { key: 'concepto', label: 'Concepto', align: 'left', maxWidth: 300, render: (m) => <span title={m.notas || ''}>{m.concepto}{m.notas && <span style={{ color: theme.textMuted, fontSize: 10 }}> · {m.notas}</span>}</span> },
    { key: 'q', label: 'Q', align: 'center', render: (m) => (m.trimestre ? `Q${m.trimestre} ${m.anio}` : '—') },
    { key: 'entrada', label: 'Entrada', align: 'right', render: (m) => (m.tipo_mov !== 'gasto' ? <span style={{ color: theme.green, fontWeight: 600 }}>{formatMXN(Number(m.monto))}</span> : '—') },
    { key: 'salida', label: 'Salida', align: 'right', render: (m) => (m.tipo_mov === 'gasto' ? <span style={{ color: theme.red, fontWeight: 600 }}>{formatMXN(Number(m.monto))}</span> : '—') },
    { key: 'saldo_running', label: 'Saldo', align: 'right', render: (m) => <span style={{ fontWeight: 700 }}>{formatMXN(m.saldo_running)}</span> },
    { key: 'folio', label: 'Folio', align: 'left', mono: true, render: (m) => m.folio || '—' },
    ...(canEdit ? [{ key: '_x', label: '', align: 'center', width: 30, render: (m) => (m.tipo_mov !== 'inicial' ? <button onClick={() => eliminarMovimientoFondo(m.id)} title="Eliminar movimiento" style={{ background: 'transparent', border: 0, cursor: 'pointer', color: theme.textMuted, fontSize: 11 }}>✕</button> : null) }] : []),
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Fondo MKT" big={formatMXN(fondoResumen.saldoMkt)} sub={`+${formatMXN(fondoResumen.aporteMktAnio)} aportado · −${formatMXN(fondoResumen.gastoMktAnio)} gastado este año`} progress={fondoResumen.entradasMkt > 0 ? (fondoResumen.gastosMkt / fondoResumen.entradasMkt) * 100 : null} progressColor={theme.orange} />
        <KpiCard eyebrow="Fondo Directo" big={formatMXN(fondoResumen.saldoDirecto)} sub={`+${formatMXN(fondoResumen.aporteDirectoAnio)} aportado · −${formatMXN(fondoResumen.gastoDirectoAnio)} gastado este año`} progress={fondoResumen.entradasDirecto > 0 ? (fondoResumen.gastosDirecto / fondoResumen.entradasDirecto) * 100 : null} progressColor={theme.orange} />
        <KpiCard eyebrow="Total fondos PCEL" big={formatMXN(fondoResumen.entradasMkt + fondoResumen.entradasDirecto)} bigSmall="aportado" sub={`${formatMXN(fondoResumen.gastosMkt + fondoResumen.gastosDirecto)} gastado en total`} />
      </div>
      {['mkt', 'directo'].map((tipo) => {
        const filas = [...fondoResumen.ledger[tipo]].reverse();
        const titulo = tipo === 'mkt' ? 'Fondo de Marketing' : 'Fondo Directo (Generación Sell Out)';
        const saldoAct = tipo === 'mkt' ? fondoResumen.saldoMkt : fondoResumen.saldoDirecto;
        return (
          <Panel key={tipo} plegable abiertoInicial={tipo === 'mkt'} titulo={titulo} meta={`${filas.length} movimientos · saldo ${formatMXN(saldoAct)}`}
            acciones={canEdit && <><Boton onClick={() => abrir(tipo, 'aporte')} title="Agregar dinero al fondo (incluso si no se cumplió cuota)">+ Aportar</Boton><Boton peligro onClick={() => abrir(tipo, 'gasto')} title="Registrar gasto / salida del fondo">− Gasto</Boton></>}>
            {fondoLoading ? <Nota>Cargando movimientos…</Nota> : <TablaCompacta dense columnas={columnas} filas={filas} rowKey={(m) => m.id} vacio="Sin movimientos." maxHeight={420} />}
          </Panel>
        );
      })}
    </div>
  );
}

export function FondoPcelModal({ fondoForm, setFondoForm, onClose, onSave }) {
  const esAporte = fondoForm.tipo_mov === 'aporte';
  const set = (k) => (e) => setFondoForm((f) => ({ ...f, [k]: e.target.value }));
  return (
    <Modal titulo={esAporte ? 'Agregar aporte al fondo' : 'Registrar gasto del fondo'} width={460}
      sub={esAporte ? 'Suma dinero al fondo. Útil para aportes manuales cuando no se cumplió cuota pero decides aportar de todas formas.' : 'Registra una salida del fondo (evento, promoción, material, etc.)'}
      onClose={onClose} footer={<><Boton onClick={onClose}>Cancelar</Boton><Boton primario peligro={!esAporte} onClick={onSave} style={!esAporte ? { color: '#FFF' } : undefined}>{esAporte ? 'Guardar aporte' : 'Guardar gasto'}</Boton></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Campo label="Fondo"><Select value={fondoForm.tipo_fondo} onChange={set('tipo_fondo')}><option value="mkt">Fondo MKT</option><option value="directo">Fondo Directo</option></Select></Campo>
        <Campo label="Tipo de movimiento"><Select value={fondoForm.tipo_mov} onChange={set('tipo_mov')}><option value="aporte">Aporte (entrada)</option><option value="gasto">Gasto (salida)</option></Select></Campo>
        <Campo label="Fecha"><Input type="date" value={fondoForm.fecha} onChange={set('fecha')} /></Campo>
        <Campo label="Monto *"><Input type="number" value={fondoForm.monto} onChange={set('monto')} placeholder="0.00" style={MONO} /></Campo>
        <Campo label="Concepto *" style={{ gridColumn: 'span 2' }}><Input type="text" value={fondoForm.concepto} onChange={set('concepto')} placeholder={esAporte ? 'Ej. Aporte discrecional Q2, Generación extra de marketing' : 'Ej. Hot Sale, Promociones Mar 26, Rebate Q1'} /></Campo>
        <Campo label="Folio"><Input type="text" value={fondoForm.folio} onChange={set('folio')} placeholder="—" /></Campo>
        <Campo label="Notas / motivo"><Input type="text" value={fondoForm.notas} onChange={set('notas')} placeholder={esAporte ? 'Ej. Aporte autorizado por dirección' : ''} /></Campo>
      </div>
    </Modal>
  );
}
