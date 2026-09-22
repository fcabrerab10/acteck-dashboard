// Hoja lateral del proyecto: los campos arriba, sus SKUs abajo (con lo que hay hoy, lo que
// viene en camino y lo que falta) y las acciones —Reservar · Pedir compra · Cambiar estado ·
// Eliminar—. Sirve igual para crear uno nuevo (proyecto = null).
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, PackageCheck, ShoppingCart, Search } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { int } from '../../../lib/format';
import { PROBABILIDADES, CLIENTES, PROB_TONE, PROB_LABEL, etiquetaMesLarga, claveMes } from './calculo';
import { fechaCortaISO } from './textos';
import { Campo, Entrada, AreaTexto, Selector } from './campos';

const OPC_CLIENTE = CLIENTES.map((c) => ({ id: c.key, label: c.label }));
const OPC_PROB = PROBABILIDADES.map((p) => ({ id: p.id, label: p.label }));

export default function HojaProyecto({
  abierto, proyecto, mesInicial, horizonte = [], catalogoSkus = [], stock, arribos,
  puedeEditar = false, guardando = false,
  onCerrar, onCrear, onActualizar, onEliminar, onGuardarLinea, onEliminarLinea, onReservarTodo, onPedirCompra, onAbrirSku,
}) {
  const { theme } = useTheme();
  const nuevo = !proyecto;
  const [campos, setCampos] = useState({});
  const [lineasNuevas, setLineasNuevas] = useState([]);   // sólo en alta
  const [busca, setBusca] = useState('');
  const [piezasNuevas, setPiezasNuevas] = useState('');
  const [skuSel, setSkuSel] = useState(null);

  const opcMeses = useMemo(() => {
    const base = horizonte.map((m) => ({ id: m.clave, label: m.labelLargo || m.label }));
    if (proyecto?.anio && proyecto?.mes) {
      const k = claveMes(proyecto.anio, proyecto.mes);
      if (!base.some((o) => o.id === k)) base.unshift({ id: k, label: etiquetaMesLarga(proyecto.anio, proyecto.mes) });
    }
    return base;
  }, [horizonte, proyecto?.anio, proyecto?.mes]);

  useEffect(() => {
    if (!abierto) return;
    const m = proyecto?.anio && proyecto?.mes ? claveMes(proyecto.anio, proyecto.mes) : (mesInicial || opcMeses[0]?.id || '');
    setCampos({
      nombre: proyecto?.nombre || '',
      cliente: proyecto?.cliente || 'digitalife',
      mesClave: m,
      probabilidad: proyecto?.probabilidad || 'prospecto',
      responsable: proyecto?.responsable || '',
      notas: proyecto?.notas || '',
    });
    setLineasNuevas([]); setBusca(''); setPiezasNuevas(''); setSkuSel(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, proyecto?.id, mesInicial]);

  const set = (k) => (v) => setCampos((c) => ({ ...c, [k]: v }));
  const [anioSel, mesSel] = (campos.mesClave || '-').split('-').map(Number);

  const sugerencias = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (q.length < 2) return [];
    return catalogoSkus.filter((s) => s.sku.toUpperCase().includes(q) || String(s.descripcion || '').toUpperCase().includes(q)).slice(0, 8);
  }, [busca, catalogoSkus]);

  const faltantePorSku = useMemo(() => new Map((proyecto?.faltantes || []).map((f) => [f.sku, f.faltante])), [proyecto]);

  const guardarCabecera = async (extra = {}) => {
    const payload = {
      nombre: campos.nombre?.trim() || 'Proyecto sin nombre',
      cliente: campos.cliente, anio: anioSel || null, mes: mesSel || null,
      probabilidad: campos.probabilidad, responsable: campos.responsable || null,
      notas: campos.notas || null, ...extra,
    };
    if (nuevo) await onCrear?.({ ...payload, lineas: lineasNuevas });
    else await onActualizar?.(proyecto.id, payload);
  };

  const agregarSku = () => {
    const sku = (skuSel?.sku || busca.trim().toUpperCase());
    const pz = Math.round(Number(piezasNuevas)) || 0;
    if (!sku) { toast.error('Elige un SKU'); return; }
    if (pz <= 0) { toast.error('Pon las piezas'); return; }
    if (nuevo) {
      setLineasNuevas((ls) => [...ls.filter((l) => l.sku !== sku), { sku, piezas: pz, descripcion: skuSel?.descripcion || '' }]);
    } else {
      onGuardarLinea?.(proyecto.id, { sku, piezas: pz });
    }
    setBusca(''); setPiezasNuevas(''); setSkuSel(null);
  };

  const lineas = nuevo ? lineasNuevas : (proyecto?.lineas || []);

  return (
    <HojaLateral abierto={abierto} onClose={onCerrar} theme={theme} ancho={560}
      titulo={nuevo ? 'Nuevo proyecto' : proyecto?.nombre || 'Proyecto'}
      sub={nuevo ? 'Una venta comprometida: cliente, mes y SKUs.' : `${PROB_LABEL[proyecto?.probabilidad] || ''} · ${int(proyecto?.pz || 0)} pz · ${proyecto?.cubiertoPct == null ? '—' : `${Math.round(proyecto.cubiertoPct)} % cubierto`}`}
      acciones={!nuevo && <Pill tone={PROB_TONE[proyecto?.probabilidad] || 'gray'}>{PROB_LABEL[proyecto?.probabilidad]}</Pill>}>

      <div style={{ display: 'grid', gap: 10, padding: '4px 4px 14px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <Campo label="Nombre" style={{ gridColumn: '1 / -1' }}>
            <Entrada valor={campos.nombre} onChange={set('nombre')} placeholder="Licitación SEP · Proyecto Oxxo…" disabled={!puedeEditar} />
          </Campo>
          <Campo label="Cliente"><Selector valor={campos.cliente} onChange={set('cliente')} opciones={OPC_CLIENTE} disabled={!puedeEditar} /></Campo>
          <Campo label="Mes objetivo"><Selector valor={campos.mesClave} onChange={set('mesClave')} opciones={opcMeses} disabled={!puedeEditar} /></Campo>
          <Campo label="Probabilidad"><Selector valor={campos.probabilidad} onChange={set('probabilidad')} opciones={OPC_PROB} disabled={!puedeEditar} /></Campo>
          <Campo label="Responsable"><Entrada valor={campos.responsable} onChange={set('responsable')} placeholder="Quién lo lleva" disabled={!puedeEditar} /></Campo>
          <Campo label="Notas" style={{ gridColumn: '1 / -1' }}>
            <AreaTexto valor={campos.notas} onChange={set('notas')} placeholder="Condiciones, fechas de entrega, quién pidió qué…" />
          </Campo>
        </div>

        {puedeEditar && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <Boton onClick={onCerrar}>Cancelar</Boton>
            <Boton primario onClick={() => guardarCabecera()} disabled={guardando}>{nuevo ? 'Crear proyecto' : 'Guardar cambios'}</Boton>
          </div>
        )}
      </div>

      {/* ── SKUs ── */}
      <div style={{ borderTop: `1px solid ${theme.border}`, paddingTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8, padding: '0 4px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text }}>SKUs del proyecto</span>
          <span style={{ fontSize: 10.5, color: theme.textMuted }}>{lineas.length} · {int(lineas.reduce((s, l) => s + Number(l.piezas || 0), 0))} pz</span>
        </div>

        {puedeEditar && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px auto', gap: 6, alignItems: 'center', padding: '0 4px 8px', position: 'relative' }}>
            <div style={{ position: 'relative' }}>
              <Search size={13} style={{ position: 'absolute', left: 9, top: 9, color: theme.textMuted }} />
              <Entrada valor={busca} onChange={(v) => { setBusca(v); setSkuSel(null); }} placeholder="Buscar SKU" style={{ paddingLeft: 26 }} onEnter={agregarSku} />
              {sugerencias.length > 0 && !skuSel && (
                <div style={{ position: 'absolute', zIndex: 2, top: 34, left: 0, right: 0, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden', maxHeight: 220, overflowY: 'auto' }}>
                  {sugerencias.map((s) => (
                    <button key={s.sku} type="button" onClick={() => { setSkuSel(s); setBusca(s.sku); }}
                      style={{ display: 'block', width: '100%', textAlign: 'left', padding: '6px 10px', border: 0, background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer' }}>
                      <strong style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}</strong>
                      <span style={{ color: theme.textMuted }}> · {s.descripcion || 'sin descripción'}</span>
                      {s.enTransito && !s.enRoadmap && (
                        <Pill tone="orange" size="xs" style={{ marginLeft: 6 }}>
                          {s.etaTransito ? `en tránsito · llega ${fechaCortaISO(s.etaTransito)}` : 'en tránsito'}
                        </Pill>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Entrada tipo="number" min={0} valor={piezasNuevas} onChange={setPiezasNuevas} placeholder="pz" onEnter={agregarSku} />
            <Boton icon={Plus} onClick={agregarSku}>Agregar</Boton>
          </div>
        )}

        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontFamily: TYPO.fontDisplay, fontSize: 11 }}>
          <thead>
            <tr>
              {['SKU', 'Pz', 'Disp. hoy', 'Tránsito', 'Falta', ''].map((h, i) => (
                <th key={h + i} style={{ textAlign: i === 0 ? 'left' : i === 5 ? 'center' : 'right', padding: '4px 6px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.06em', color: theme.textMuted, borderBottom: `1px solid ${theme.border}` }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lineas.map((l) => {
              const disp = Math.round(Number(stock?.get(l.sku) || 0));
              const arr = arribos?.get(l.sku) || [];
              const enCamino = arr.reduce((s, a) => s + Number(a.cantidad || 0), 0);
              const prox = arr.find((a) => a.eta) || null;
              const falta = faltantePorSku.get(l.sku) || 0;
              return (
                <tr key={l.id || l.sku}>
                  <td style={{ padding: '5px 6px', borderBottom: `1px solid ${theme.border}`, maxWidth: 190 }}>
                    <button type="button" onClick={() => onAbrirSku?.(l.sku)}
                      style={{ border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>{l.sku}</button>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontFamily: TYPO.fontText, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{l.descripcion || ''}</div>
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.border}`, fontVariantNumeric: 'tabular-nums' }}>
                    {puedeEditar && !nuevo ? (
                      <Entrada tipo="number" min={0} valor={l.piezas}
                        onChange={(v) => onGuardarLinea?.(proyecto.id, { sku: l.sku, piezas: v, reservado: l.reservado })}
                        style={{ height: 24, width: 74, textAlign: 'right', fontSize: 11 }} />
                    ) : int(l.piezas)}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.border}`, fontVariantNumeric: 'tabular-nums', color: theme.textMuted }}>{int(disp)}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.border}`, fontVariantNumeric: 'tabular-nums', color: theme.textMuted }}>
                    {enCamino ? int(enCamino) : '—'}
                    {prox && <div style={{ fontSize: 9.5 }}>llega {fechaCortaISO(prox.eta)}</div>}
                  </td>
                  <td style={{ padding: '5px 6px', textAlign: 'right', borderBottom: `1px solid ${theme.border}`, fontVariantNumeric: 'tabular-nums', color: falta > 0 ? (theme.red || '#FF3B30') : theme.textMuted }}>{falta > 0 ? int(falta) : '—'}</td>
                  <td style={{ padding: '5px 6px', textAlign: 'center', borderBottom: `1px solid ${theme.border}` }}>
                    {puedeEditar && (
                      <button type="button" title="Quitar del proyecto"
                        onClick={() => (nuevo ? setLineasNuevas((ls) => ls.filter((x) => x.sku !== l.sku)) : onEliminarLinea?.(l.id))}
                        style={{ border: 0, background: 'transparent', color: theme.textMuted, cursor: 'pointer', padding: 2 }}>
                        <Trash2 size={12} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {!lineas.length && (
              <tr><td colSpan={6} style={{ padding: '14px 6px', textAlign: 'center', color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 11.5 }}>Todavía no tiene SKUs.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Acciones ── */}
      {!nuevo && puedeEditar && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14, paddingTop: 12, borderTop: `1px solid ${theme.border}` }}>
          <Boton icon={PackageCheck} onClick={() => onReservarTodo?.(proyecto)} title="Marca como reservadas las piezas que ya tienen respaldo">Reservar</Boton>
          <Boton icon={ShoppingCart} onClick={() => onPedirCompra?.(proyecto)} disabled={!proyecto.faltantes?.length}>Pedir compra</Boton>
          <span style={{ flex: 1 }} />
          <Boton peligro icon={Trash2} onClick={() => onEliminar?.(proyecto)}>Eliminar</Boton>
        </div>
      )}
    </HojaLateral>
  );
}
