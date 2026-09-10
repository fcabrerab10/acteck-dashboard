// Landing — Hero narrativo + acciones (Importar Excel, Excel de SPIFFs, Gestionar SPIFFs, Actualizar) · tres
// TarjetaCliente (cuota / facturado / gap / última propuesta; "Nueva propuesta" entra directo a Armar, "Continuar"
// retoma el borrador abierto) · KPIs (Borradores · Enviadas · Cerradas · Conversión ⌀) · Segmented Todas · Borrador ·
// Enviada · Cerrada + cliente + buscador, y las propuestas agrupadas por mes objetivo (anio/mes) con TarjetaPropuesta.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Settings2, RefreshCw } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { Hero, KpiCard, Panel, Segmented, Boton, Cargando } from '../../../components/kit';
import { moneyCompact, int, pct } from '../../../lib/format';
import Buscador from '../sellin/Buscador';
import { normalizar, tokens as aTokens, coincide } from '../sellin/textos';
import { CLIENTES, ESTADOS, MES_FULL, MES_ACTUAL } from './constantes';
import { fetchKpisClientes } from './datos';
import TarjetaPropuesta from './TarjetaPropuesta';
import TarjetaCliente from './TarjetaCliente';

export const SILUETA_LANDING = [
  { tipo: 'hero', stats: 3 }, { tipo: 'kpis', n: 4 }, { tipo: 'fila', items: 3, alto: 30 },
  { tipo: 'grid', cols: 'repeat(3, minmax(0,1fr))', items: [{ tipo: 'panel', lineas: 4 }, { tipo: 'panel', lineas: 4 }, { tipo: 'panel', lineas: 4 }] },
  { tipo: 'grid', cols: 'repeat(3, minmax(0,1fr))', items: [{ tipo: 'panel', lineas: 4 }, { tipo: 'panel', lineas: 4 }, { tipo: 'panel', lineas: 4 }] },
];

function agruparPorMes(list) {
  const groups = new Map();
  for (const r of list) {
    let anio = r.anio, mes = r.mes;
    if (!anio || !mes) { const d = new Date(r.tstamp || Date.now()); anio = d.getFullYear(); mes = d.getMonth() + 1; }
    const key = `${anio}-${String(mes).padStart(2, '0')}`;
    if (!groups.has(key)) groups.set(key, { key, label: `${MES_FULL[mes - 1]} ${anio}`, items: [] });
    groups.get(key).items.push(r);
  }
  return [...groups.values()].sort((a, b) => b.key.localeCompare(a.key));
}

export default function Landing({ propuestas, efectividades, cargando, ocupado, onNueva, onAbrir, onImportar, onSubirSpiffs, onGestionarSpiffs, onEliminar, onDuplicar, onCompartir, onExcelFinal, onRefrescar }) {
  const { theme } = useTheme();
  const [filtroEst, setFiltroEst] = useState('todas');
  const [filtroCli, setFiltroCli] = useState('todos');
  const [busqueda, setBusqueda] = useState('');
  const [kpisCli, setKpisCli] = useState({});
  const importRef = useRef(null), spiffRef = useRef(null);
  useEffect(() => { fetchKpisClientes().then(setKpisCli).catch((e) => console.warn('[Propuestas] kpis clientes', e)); }, []);

  const porEstado = useMemo(() => Object.fromEntries(ESTADOS.map((e) => [e.id, propuestas.filter((p) => p.estado === e.id).length])), [propuestas]);
  const filtradas = useMemo(() => {
    const toks = aTokens(busqueda);
    return propuestas.filter((r) => {
      if (filtroCli !== 'todos' && r.clienteKey !== filtroCli) return false;
      if (filtroEst !== 'todas' && r.estado !== filtroEst) return false;
      if (toks.length && !coincide(normalizar(`${r.nombre} ${r.clienteLabel || ''} ${r.clienteKey} ${r.folio || ''} ${(r.lineas || []).map((l) => l.sku).join(' ')}`), toks)) return false;
      return true;
    });
  }, [propuestas, filtroCli, filtroEst, busqueda]);
  const grupos = useMemo(() => agruparPorMes(filtradas), [filtradas]);

  const mesActualKey = `${MES_ACTUAL.anio}-${String(MES_ACTUAL.mes).padStart(2, '0')}`;
  const delMes = propuestas.filter((p) => `${p.anio}-${String(p.mes).padStart(2, '0')}` === mesActualKey);
  const conEf = propuestas.map((p) => efectividades.get(p.id)).filter((e) => e && e.pct != null);
  const convProm = conEf.length ? conEf.reduce((s, e) => s + e.montoProp, 0) > 0
    ? (conEf.reduce((s, e) => s + Math.min(e.montoFact, e.montoProp), 0) / conEf.reduce((s, e) => s + e.montoProp, 0)) * 100 : null : null;
  const totalMes = delMes.reduce((s, p) => s + (Number(p.resumen?.total) || 0), 0);

  return (
    <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Hero
        eyebrow={`Dirección Comercial · Propuestas · ${MES_FULL[MES_ACTUAL.mes - 1]} ${MES_ACTUAL.anio}`}
        titulo="Cierra el mes con una propuesta ganadora."
        sub="Elige el cliente abajo y entras directo al armador con su inventario, precios y sell-out. Al exportar o compartir quedan enviadas; cuando el cliente factura, se cierran solas y ves cuánto se convirtió."
        stats={[
          { k: 'Este mes', v: int(delMes.length), sub: `${moneyCompact(totalMes)} propuestos` },
          { k: 'Enviadas', v: int(porEstado.enviada + porEstado.cerrada), sub: `${int(porEstado.cerrada)} cerradas` },
          { k: 'Convertido ⌀', v: convProm != null ? pct(convProm, 0) : '—', sub: conEf.length ? `${conEf.length} con facturación` : 'sin enviadas aún', color: convProm != null ? (convProm >= 60 ? (theme.green || '#34C759') : (theme.orange || '#FF9500')) : undefined },
        ]}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
          <Boton icon={Upload} onClick={() => importRef.current?.click()} title="Importa un Excel de propuesta (SKU, Descripción, Piezas, Precio) como borrador">Importar Excel</Boton>
          <Boton icon={Upload} onClick={() => spiffRef.current?.click()} title="Sube el Excel de SPIFFs (vigencia detectada del nombre: Spiff Q3 2026)">Excel de SPIFFs</Boton>
          <Boton icon={Settings2} onClick={onGestionarSpiffs} title="Editar SPIFFs cargados: monto, vigencia, agregar/quitar SKUs">Gestionar SPIFFs</Boton>
          <Boton icon={RefreshCw} onClick={onRefrescar} title="Volver a leer propuestas y facturación" disabled={cargando}>{cargando ? 'Actualizando…' : 'Actualizar'}</Boton>
          <input ref={importRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onImportar(f); }} />
          <input ref={spiffRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) onSubirSpiffs(f); }} />
        </div>
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {CLIENTES.map((c) => <TarjetaCliente key={c.key} c={c} kpi={kpisCli[c.key]} propuestas={propuestas} ocupado={ocupado} onNueva={onNueva} onContinuar={onAbrir} />)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
        <KpiCard eyebrow="Borradores" badge={{ l: 'en edición', tone: 'orange' }} big={int(porEstado.borrador)} sub="se abren con un click para seguir armando" onClick={() => setFiltroEst('borrador')} />
        <KpiCard eyebrow="Enviadas" badge={{ l: 'esperando OC', tone: 'blue' }} big={int(porEstado.enviada)} sub="marcadas al exportar el Excel o compartir" onClick={() => setFiltroEst('enviada')} />
        <KpiCard eyebrow="Cerradas" badge={{ l: 'facturaron', tone: 'green' }} big={int(porEstado.cerrada)} sub="el cliente facturó ≥ 1 SKU en la ventana" onClick={() => setFiltroEst('cerrada')} />
        <KpiCard eyebrow="Conversión ⌀" big={convProm != null ? pct(convProm, 0) : '—'} bigColor={convProm != null ? (convProm >= 60 ? (theme.green || '#34C759') : (theme.orange || '#FF9500')) : undefined} sub="Σ min(vendido, propuesto) / Σ propuesto · mes siguiente al envío" progress={convProm ?? undefined} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Segmented value={filtroEst} onChange={setFiltroEst} options={[{ id: 'todas', label: 'Todas', badge: propuestas.length }, ...ESTADOS.map((e) => ({ id: e.id, label: e.label, badge: porEstado[e.id] }))]} />
        <Segmented value={filtroCli} onChange={setFiltroCli} options={[{ id: 'todos', label: 'Todos' }, ...CLIENTES.map((c) => ({ id: c.key, label: c.label }))]} />
        <Buscador value={busqueda} onChange={setBusqueda} resultados={busqueda ? int(filtradas.length) : null} placeholder="Buscar por nombre, cliente, folio o SKU…" width={300} />
        <span style={{ marginLeft: 'auto', fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{filtradas.length} de {propuestas.length}</span>
      </div>

      {cargando && propuestas.length === 0 && <Cargando silueta={SILUETA_LANDING.slice(3)} minHeight={200} />}
      {!cargando && filtradas.length === 0 && (
        <Panel padding="28px 16px">
          <div style={{ textAlign: 'center', color: theme.textMuted, fontSize: 12 }}>
            {propuestas.length === 0 ? 'Todavía no hay propuestas. Pulsa “Nueva propuesta” en la tarjeta del cliente: aceptas sugeridos o marcas SKUs y la exportas.' : 'Ninguna propuesta con los filtros actuales.'}
          </div>
        </Panel>
      )}
      {grupos.map((g) => {
        const totalGrupo = g.items.reduce((s, r) => s + (Number(r.resumen?.total) || 0), 0);
        const enviadas = g.items.filter((r) => r.estado !== 'borrador').length;
        return (
          <Panel key={g.key} titulo={g.label} meta={`${g.items.length} propuesta${g.items.length === 1 ? '' : 's'} · ${moneyCompact(totalGrupo)}${enviadas ? ` · ${enviadas} enviada${enviadas === 1 ? '' : 's'}` : ''}`} plegable>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 10 }}>
              {g.items.map((p) => (
                <TarjetaPropuesta key={p.id} p={p} ef={efectividades.get(p.id) || null} ocupado={ocupado}
                  onAbrir={() => onAbrir(p)} onEliminar={() => onEliminar(p)} onDuplicar={onDuplicar} onCompartir={onCompartir} onExcelFinal={onExcelFinal} />
              ))}
            </div>
          </Panel>
        );
      })}
    </div>
  );
}
