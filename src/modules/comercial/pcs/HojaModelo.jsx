// Acteck PCs · hoja del modelo: especificaciones, lista de componentes (cuáles son nuestros, con su clave) y
// el historial de costos de DECME. Cada actualización de costos es una versión nueva: así se ve cómo se mueve
// el equipo completo y cada componente, y qué tan competitivo sigue el precio.
import React, { useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { money, pct, fecha, hoyISO } from '../../../lib/format.js';
import { Campo, Entrada, AreaTexto, Selector } from '../proyectos/campos';
import CampoNumero from '../propuestas/CampoNumero';
import { TIPOS_COMPONENTE, TIPOS_PROPIOS, historialCostos } from './calculo.js';
import { guardarModelo, guardarComponentes, agregarCosto, eliminarCosto } from './datos';

const OPC_TIPO = TIPOS_COMPONENTE.map((t) => ({ id: t, label: t.charAt(0).toUpperCase() + t.slice(1) }));
const OPC_LIC = ['Windows Home', 'Windows Pro'].map((l) => ({ id: l, label: l }));

export default function HojaModelo({ sku, datos, sensible, perfil, onClose }) {
  const { theme } = useTheme();
  const m = datos.modelos.find((x) => x.sku === sku) || { sku };
  const [c, setC] = useState({ nombre: m.nombre || '', licencia: m.licencia || 'Windows Home', procesador: m.procesador || '', memoria: m.memoria || '', almacenamiento: m.almacenamiento || '', notas: m.notas || '' });
  const [comps, setComps] = useState(() => datos.componentes.filter((x) => x.sku_modelo === sku).map((x) => ({ tipo: x.tipo, descripcion: x.descripcion, sku_propio: x.sku_propio || '', cantidad: x.cantidad })));
  const [nuevoCosto, setNuevoCosto] = useState(null); // { vigente_desde, costo, nota, desglose }
  const [ocupado, setOcupado] = useState(false);
  const set = (k) => (v) => setC((x) => ({ ...x, [k]: v }));
  const hist = useMemo(() => historialCostos(datos.costos, sku), [datos.costos, sku]);
  const precio = datos.precios[sku];
  const cambiarComp = (i, cambios) => setComps((ls) => ls.map((l, j) => (j === i ? { ...l, ...cambios } : l)));

  const guardar = async () => {
    setOcupado(true);
    try { await guardarModelo(sku, c); await guardarComponentes(sku, comps); toast.ok('Modelo guardado'); onClose(); }
    catch (e) { toast.error(`No se guardó: ${e.message}`); } finally { setOcupado(false); }
  };
  const abrirCosto = () => setNuevoCosto({
    vigente_desde: hoyISO(), costo: hist[0]?.costo ?? null, nota: '',
    desglose: comps.filter((x) => x.descripcion).map((x) => ({ tipo: x.tipo, descripcion: x.descripcion, costo: hist[0]?.desglose?.find((d) => d.descripcion === x.descripcion)?.costo ?? null })),
  });
  const sumaDesglose = (nuevoCosto?.desglose || []).reduce((s, d) => s + (Number(d.costo) || 0), 0);
  const guardarCosto = async () => {
    const costo = nuevoCosto.costo ?? (sumaDesglose || null);
    if (!(costo > 0)) { toast.error('Falta el costo del equipo'); return; }
    setOcupado(true);
    try { await agregarCosto(sku, { ...nuevoCosto, costo }, perfil); toast.ok('Costo registrado'); setNuevoCosto(null); }
    catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };

  const h3 = { fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, margin: '18px 4px 8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 };
  const g2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10, padding: '0 4px' };
  const alto = { height: 40, fontSize: 14 };
  const caja = { background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 14, padding: 10 };

  return (
    <HojaLateral abierto onClose={onClose} theme={theme} ancho={600} titulo={sku} sub={`${m.upc ? `UPC ${m.upc} · ` : ''}${precio ? `lista ${money(precio)}` : 'sin precio de lista'}${sensible && hist[0] && precio ? ` · margen ${pct(((precio - hist[0].costo) / precio) * 100)}` : ''}`}>
      <div style={g2}>
        <Campo label="Procesador"><Entrada valor={c.procesador} onChange={set('procesador')} placeholder="Ryzen 5 5600G" style={alto} /></Campo>
        <Campo label="Memoria"><Entrada valor={c.memoria} onChange={set('memoria')} placeholder="16 GB" style={alto} /></Campo>
        <Campo label="Almacenamiento"><Entrada valor={c.almacenamiento} onChange={set('almacenamiento')} placeholder="SSD 512 GB" style={alto} /></Campo>
        <Campo label="Licencia"><Selector valor={c.licencia} onChange={set('licencia')} opciones={OPC_LIC} style={alto} /></Campo>
        <Campo label="Nombre comercial" style={{ gridColumn: '1 / -1' }}><Entrada valor={c.nombre} onChange={set('nombre')} style={alto} /></Campo>
      </div>

      <div style={h3}><span>Componentes</span><Boton icon={Plus} size="md" onClick={() => setComps((ls) => [...ls, { tipo: 'otro', descripcion: '', sku_propio: '', cantidad: 1 }])}>Componente</Boton></div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
        {!comps.length && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Agrega lo que lleva este equipo. En gabinete, fuente y enfriamiento pon nuestra clave (AC- o BR-) para medir cuántas tarimas alcanzan.</div>}
        {comps.map((x, i) => (
          <div key={i} style={{ ...caja, display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8, alignItems: 'end' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 8, minWidth: 0 }}>
              <Campo label="Tipo"><Selector valor={x.tipo} onChange={(v) => cambiarComp(i, { tipo: v })} opciones={OPC_TIPO} style={alto} /></Campo>
              <Campo label="Descripción" style={{ gridColumn: 'span 2' }}><Entrada valor={x.descripcion} onChange={(v) => cambiarComp(i, { descripcion: v })} style={alto} /></Campo>
              {TIPOS_PROPIOS.has(x.tipo) && <Campo label="Nuestra clave"><Entrada valor={x.sku_propio} onChange={(v) => cambiarComp(i, { sku_propio: v })} placeholder="AC-935777" style={alto} /></Campo>}
            </div>
            <Boton icon={Trash2} peligro size="md" onClick={() => setComps((ls) => ls.filter((_, j) => j !== i))} title="Quitar" style={{ height: 40 }} />
          </div>
        ))}
      </div>

      {sensible && (
        <>
          <div style={h3}><span>Costos de DECME</span>{!nuevoCosto && <Boton icon={Plus} size="md" onClick={abrirCosto}>Actualizar costo</Boton>}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 4px' }}>
            {nuevoCosto && (
              <div style={{ ...caja, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                  <Campo label="Vigente desde"><Entrada tipo="date" valor={nuevoCosto.vigente_desde} onChange={(v) => setNuevoCosto((n) => ({ ...n, vigente_desde: v }))} style={alto} /></Campo>
                  <Campo label="Costo del equipo" hint={sumaDesglose ? `suma de componentes ${money(sumaDesglose)}` : null}><CampoNumero value={nuevoCosto.costo} onChange={(v) => setNuevoCosto((n) => ({ ...n, costo: v }))} decimales={2} ancho="100%" alto={40} /></Campo>
                </div>
                {nuevoCosto.desglose.map((d, i) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 130px', gap: 8, alignItems: 'center', fontSize: 12.5, color: theme.text }}>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descripcion}</span>
                    <CampoNumero value={d.costo} onChange={(v) => setNuevoCosto((n) => ({ ...n, desglose: n.desglose.map((y, j) => (j === i ? { ...y, costo: v } : y)) }))} decimales={2} ancho="100%" alto={40} placeholder="costo" />
                  </div>
                ))}
                <Campo label="Nota"><Entrada valor={nuevoCosto.nota} onChange={(v) => setNuevoCosto((n) => ({ ...n, nota: v }))} placeholder="Cotización de DECME del…" style={alto} /></Campo>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}><Boton size="md" onClick={() => setNuevoCosto(null)} style={{ height: 40 }}>Cancelar</Boton><Boton primario size="md" disabled={ocupado} onClick={guardarCosto} style={{ height: 40 }}>Registrar costo</Boton></div>
              </div>
            )}
            {!hist.length && !nuevoCosto && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Sin costos todavía. Registra el primero y cada actualización quedará en el historial con su cambio.</div>}
            {hist.map((h) => (
              <div key={h.id} style={caja}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: theme.text }}><b style={{ fontVariantNumeric: 'tabular-nums' }}>{money(h.costo)}</b> · desde {fecha(h.vigente_desde)}</span>
                  <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {h.delta != null && h.delta !== 0 && <Pill tone={h.delta > 0 ? 'red' : 'green'}>{h.delta > 0 ? '▲' : '▼'} {money(Math.abs(h.delta))} · {pct(Math.abs(h.deltaPct))}</Pill>}
                    {h.delta === 0 && <Pill tone="gray">sin cambio</Pill>}
                    <Boton icon={Trash2} onClick={async () => { if (window.confirm('¿Quitar esta versión de costo?')) { try { await eliminarCosto(h.id); } catch (e) { toast.error(e.message); } } }} title="Quitar" />
                  </span>
                </div>
                {h.nota && <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{h.nota}</div>}
                {!!h.desglose.length && (
                  <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {h.desglose.map((d, i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>
                        <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{d.descripcion}</span>
                        <span>{money(d.costo)}{d.delta ? <span style={{ color: d.delta > 0 ? theme.red : theme.green, marginLeft: 6 }}>{d.delta > 0 ? '+' : '−'}{money(Math.abs(d.delta))}</span> : null}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      <div style={{ padding: '14px 4px 0' }}><Campo label="Notas"><AreaTexto valor={c.notas} onChange={set('notas')} filas={2} /></Campo></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '18px 4px 0' }}>
        <Boton primario size="md" disabled={ocupado} onClick={guardar} style={{ height: 44, padding: '0 24px' }}>{ocupado ? 'Guardando…' : 'Guardar modelo'}</Boton>
      </div>
    </HojaLateral>
  );
}
