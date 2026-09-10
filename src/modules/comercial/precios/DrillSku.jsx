// Drill de un SKU en Estrategia de Precios (renderExpandido de TablaPrecios; uno abierto a la vez). Carga al abrir
// (useDrillPrecios). Conserva precios por lista, evolución 12 m (precio AAA + piezas), top clientes y promos, y añade:
//   (a) precio real facturado por cliente en 3 meses cerrados vs la lista que le corresponde (DeltaPill)
//   (b) "Compartir precio": lista OBLIGATORIA (sin default); texto sin nombrar la lista ni nada sensible (precios/textos.js)
//   (c) evolución del precio por lista desde precios_historico (una línea por lista; con un solo mes: "Histórico desde …")
//   (d) disponibilidad hoy (disponible + próximo arribo de v_transito_sku)
// Segundo paso (aprobado): (e) elasticidad por cambio de precio (PanelElasticidad.jsx) · (f) simulador "Si muevo el precio"
// (Simulador.jsx) · (g) precio de la competencia (Competencia.jsx, tabla precios_competencia) · (h) precio bajo por
// cliente del SKU (PrecioBajoSku.jsx). Cálculo puro en precios/elasticidad.js; capturas sólo para internos/super admin.
// Margen/costo sólo con `sensible`.
import React, { useMemo, useState } from 'react';
import { Share2, Copy, X } from 'lucide-react';
import { BarChart, Bar, LineChart, Line, ComposedChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, ResponsiveContainer } from 'recharts';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { fecha as fmtFecha } from '../../../lib/format';
import { KpiCard, Pill, DeltaPill, Panel, Boton, Cargando, TablaCompacta, toast } from '../../../components/kit';
import { compartir, copiar, fechaCorta } from '../../../lib/whatsapp';
import { usePerfil } from '../../../lib/perfilContext';
import { useRoadmap } from '../../../lib/queries';
import { useDrillPrecios, useElasticidadCategoria, useSupuesto, useGuardarSupuesto } from './datos';
import { precioEfectivo, precioRealPorCliente, serieHistorico, disponibilidad, elasticidadSku, ritmoMensual, precioBajoSku } from './calculo';
import PanelElasticidad from './PanelElasticidad';
import Simulador from './Simulador';
import Competencia from './Competencia';
import PrecioBajoSku from './PrecioBajoSku';
import { LISTAS, listaLbl, listaColor, fmtMoney, fmtInt, fmtPct, fmtMoneyShort, fmtPctDelta, textoPrecio, marcaDe, roadmapTone, MESES, N, periodoLbl } from './textos';

const hoyMes = () => { const d = new Date(); return { anio: d.getFullYear(), mes: d.getMonth() + 1 }; };

function ListaRow({ theme, label, precio, maxPrecio, sub, color, margen, tachado }) {
  const width = maxPrecio > 0 ? Math.max(4, (precio / maxPrecio) * 100) : 0;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto 92px', gap: 8, alignItems: 'center', padding: '5px 2px', fontSize: 11, borderBottom: `1px solid ${theme.divider || theme.border}` }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
      <div style={{ height: 4, background: `${theme.text}0F`, borderRadius: 999, overflow: 'hidden' }}><div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 999 }} /></div>
      <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 12, color: theme.text, fontVariantNumeric: 'tabular-nums', textAlign: 'right' }}>
        {fmtMoney(precio)}{tachado != null && <span style={{ color: theme.textSubtle || theme.textMuted, textDecoration: 'line-through', fontSize: 10, marginLeft: 5, fontWeight: 500 }}>{fmtMoney(tachado)}</span>}
      </span>
      <span style={{ fontSize: 10, color: theme.textMuted, textAlign: 'right', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{margen != null ? `MC ${fmtPct(margen, 1)}` : sub || ''}</span>
    </div>
  );
}

export default function DrillSku({ row, sensible = false, onClose }) {
  const { theme } = useTheme();
  const { data, isLoading, error } = useDrillPrecios(row.sku);
  const [lista, setLista] = useState('');
  const [listaElast, setListaElast] = useState('Mayoreo AAA');
  const { anio } = hoyMes();
  const perfil = usePerfil();
  const interno = !!perfil?.es_super_admin || perfil?.tipo === 'interno';
  // Elasticidad de la categoría: SKUs de la misma categoría (roadmap ya cacheado) → v_precios_cambios + piezas por sku/mes
  const roadmap = useRoadmap();
  const skusCategoria = useMemo(() => (row.categoria ? (roadmap.data || []).filter((r) => r.categoria === row.categoria).map((r) => r.sku) : []), [roadmap.data, row.categoria]);
  const elastCatQ = useElasticidadCategoria(row.categoria, skusCategoria, listaElast);
  const supuestoQ = useSupuesto(row.categoria);
  const guardarSupuesto = useGuardarSupuesto(row.categoria);

  const calc = useMemo(() => {
    if (!data) return null;
    const { fact, historico, promosHist, inv, tr } = data;
    const hist = serieHistorico(historico);
    // Evolución del año: piezas facturadas por mes + precio AAA del histórico (arrastrado hacia adelante)
    const serie = Array.from({ length: 12 }, (_, i) => ({ mes: MESES[i], piezas: 0, monto: 0, precio: null }));
    for (const f of fact) { if (Number(f.anio) !== anio) continue; const m = Number(f.mes) - 1; if (m < 0 || m > 11) continue; serie[m].piezas += N(f.piezas); serie[m].monto += N(f.monto); }
    for (const p of hist.serie) if (p.anio === anio && p['Mayoreo AAA'] != null) serie[p.mes - 1].precio = p['Mayoreo AAA'];
    let ultimo = null; for (const s of serie) { if (s.precio == null) s.precio = ultimo; else ultimo = s.precio; }
    const mesCorte = new Date().getMonth();
    let primero = serie.findIndex((s) => s.piezas > 0 || s.precio != null), fin = -1;
    for (let i = mesCorte; i >= 0; i--) if (serie[i].piezas > 0 || serie[i].precio != null) { fin = i; break; }
    const serieAnio = primero >= 0 && fin >= primero ? serie.slice(primero, fin + 1) : [];
    // Top clientes YTD
    const cli = new Map();
    for (const f of fact) { if (Number(f.anio) !== anio || !f.cliente_nombre) continue; const it = cli.get(f.cliente_nombre) || { cliente: f.cliente_nombre, piezas: 0, monto: 0 }; it.piezas += N(f.piezas); it.monto += N(f.monto); cli.set(f.cliente_nombre, it); }
    const top = [...cli.values()].filter((c) => c.piezas > 0).sort((a, b) => b.piezas - a.piezas);
    const piezasYTD = top.reduce((s, c) => s + c.piezas, 0), montoYTD = top.reduce((s, c) => s + c.monto, 0);
    return {
      hist, serieAnio, top: top.slice(0, 5), restantes: top.slice(5), piezasYTD, montoYTD,
      clientes: precioRealPorCliente(fact, row.precios, row.promo),
      promosHist: [...promosHist].sort((a, b) => b.anio - a.anio || b.mes - a.mes),
      disp: disponibilidad(inv, tr),
      costo: sensible ? N(inv?.costo_promedio) : 0,
      ritmo: ritmoMensual(fact),
      precioBajo: precioBajoSku(fact, row.precios, row.promo, anio),
    };
  }, [data, anio, row, sensible]);
  const elast = useMemo(() => (data && calc ? elasticidadSku({ cambios: calc.hist.cambios, fact: data.fact, lista: listaElast }) : null), [data, calc, listaElast]);

  const wrap = { padding: '12px 14px 14px', background: theme.bg, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: TYPO.fontText };
  if (isLoading || !calc) return <div style={wrap} onClick={(e) => e.stopPropagation()}><Cargando pantalla="preciosDrill" minHeight={320} /></div>;
  if (error) return <div style={{ ...wrap, color: theme.red || '#FF3B30', fontSize: 12 }}>No se pudo cargar el detalle de {row.sku}: {String(error.message || error)}</div>;

  const listasConPrecio = LISTAS.filter((l) => row.precios[l] != null);
  const listaValida = lista && listasConPrecio.includes(lista) ? lista : '';
  const precioSel = listaValida ? precioEfectivo(row.precios, row.promo, listaValida) : null;
  const precioAAA = row.precios['Mayoreo AAA'], precioAAAneto = precioEfectivo(row.precios, row.promo, 'Mayoreo AAA');
  const armarTexto = () => textoPrecio({ sku: row.sku, descripcion: row.descripcion, precio: precioSel, marca: marcaDe(row.marca) });
  const exigirLista = () => { if (!listaValida) { toast.error('Elige una lista de precios para compartir'); return false; } return true; };
  const onCompartir = async () => { if (!exigirLista()) return; const r = await compartir(armarTexto(), { titulo: `Precio ${row.sku}` }); if (r === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (!exigirLista()) return; if (await copiar(armarTexto())) toast.ok('Texto copiado'); else toast.error('No se pudo copiar'); };

  const maxPrecio = Math.max(0, ...listasConPrecio.map((l) => row.precios[l]), row.bajo?.real || 0);
  const tipo = (theme.mode === 'dark');
  const tooltipStyle = { fontSize: 10, padding: '6px 10px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 10, fontFamily: TYPO.fontText };
  const selectStyle = { height: 28, borderRadius: 999, border: `1px solid ${listaValida ? theme.border : (theme.orange || '#FF9500')}`, background: theme.surface, color: listaValida ? theme.text : (theme.orange || '#FF9500'), fontFamily: TYPO.fontText, fontSize: 12, padding: '0 10px', outline: 'none' };
  const { hist, disp } = calc;
  const soloUnMes = hist.meses <= 1;

  const colsClientes = [
    { key: 'cliente', label: 'Cliente', align: 'left', maxWidth: 190, render: (r) => <span title={r.cliente} style={{ fontWeight: 500 }}>{r.cliente}</span> },
    { key: 'lista', label: 'Su lista', align: 'left', render: (r) => <Pill tone="gray" size="xs">{listaLbl(r.lista)}</Pill> },
    { key: 'piezas', label: 'Pz', render: (r) => fmtInt(r.piezas) },
    { key: 'real', label: 'Real', render: (r) => <span style={{ fontWeight: 600 }}>{fmtMoney(r.real)}</span> },
    { key: 'precioLista', label: 'Lista', render: (r) => (r.precioLista != null ? fmtMoney(r.precioLista) : '—') },
    { key: 'difPct', label: 'Desv.', render: (r) => <DeltaPill value={r.difPct} digits={1} /> },
  ];
  const colsCambios = [
    { key: 'periodo', label: 'Mes', align: 'left', render: (r) => periodoLbl(r.anio, r.mes) },
    { key: 'lista', label: 'Lista', align: 'left', render: (r) => <span style={{ color: listaColor(theme, r.lista), fontWeight: 600 }}>{listaLbl(r.lista)}</span> },
    { key: 'de', label: 'De', render: (r) => fmtMoney(r.de) },
    { key: 'a', label: 'A', render: (r) => <span style={{ fontWeight: 600 }}>{fmtMoney(r.a)}</span> },
    { key: 'deltaPct', label: 'Δ', render: (r) => <DeltaPill value={r.deltaPct} digits={1} /> },
  ];

  return (
    <div style={wrap} onClick={(e) => e.stopPropagation()} data-stagger>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 700, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{row.sku}</span>
            {row.marca && <Pill tone="gray" size="xs">{row.marca}</Pill>}
            {row.categoria && <Pill tone="gray" size="xs">{row.categoria}{row.familia ? ` · ${row.familia}` : ''}</Pill>}
            {row.rdmp && <Pill tone={roadmapTone(row.rdmp)} size="xs">{row.rdmp}</Pill>}
            {row.promo && <Pill tone="purple" size="xs" dot>{row.promo.campania} · −{Math.round(row.promo.promo_pct * 100)}%</Pill>}
          </div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.015em', color: theme.text, marginTop: 4 }}>{row.descripcion || row.sku}</div>
        </div>
        <Boton icon={X} onClick={onClose} title="Cerrar">Cerrar</Boton>
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="Precio Mayoreo AAA" badge={row.promo ? { l: `promo −${Math.round(row.promo.promo_pct * 100)}%`, tone: 'purple' } : undefined}
          big={precioAAAneto != null ? fmtMoney(precioAAAneto) : '—'} bigSmall={row.promo && precioAAA != null ? `lista ${fmtMoney(precioAAA)}` : 'sin IVA'}
          sub={sensible && calc.costo > 0 && precioAAAneto > 0 ? `Margen ${fmtPct(((precioAAAneto - calc.costo) / precioAAAneto) * 100, 1)} · costo ${fmtMoney(calc.costo)}` : `${listasConPrecio.length} de ${LISTAS.length} listas con precio`} />
        <KpiCard eyebrow="Precio bajo facturado" badge={row.bajo ? { l: fmtPctDelta(row.bajo.difPct), tone: row.bajo.difPct >= -8 ? 'orange' : 'red' } : undefined}
          big={row.bajo ? fmtMoney(row.bajo.real) : '—'} bigSmall={row.bajo ? `vs ${listaLbl(row.bajo.lista)} ${fmtMoney(row.bajo.precioLista)}` : undefined}
          sub={row.bajo ? `${row.bajo.cliente} · ${fmtInt(row.bajo.piezas)} pz · ${fmtMoneyShort(row.bajo.dejado)} dejados en la mesa` : 'Ningún cliente (≥ 50 pz) debajo de su lista'} />
        <KpiCard eyebrow={`Piezas ${anio} · YTD`} big={fmtInt(calc.piezasYTD)} bigSmall="pz" sub={`Facturado ${fmtMoneyShort(calc.montoYTD)}${calc.piezasYTD > 0 ? ` · ${fmtMoney(calc.montoYTD / calc.piezasYTD)} promedio` : ''}`} />
        <KpiCard eyebrow="Disponible hoy" badge={disp.enCamino > 0 ? { l: `${fmtInt(disp.enCamino)} en camino`, tone: 'blue' } : undefined}
          big={fmtInt(disp.disponible)} bigSmall="pz" bigColor={disp.disponible <= 0 ? (theme.red || '#FF3B30') : undefined}
          sub={disp.proximoArribo ? `Próximo arribo ${fechaCorta(disp.proximoArribo.fecha)} · ${fmtInt(disp.proximoArribo.piezas)} pz${disp.proximoArribo.po ? ` · PO ${disp.proximoArribo.po}` : ''}` : 'Sin tránsito programado'} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(0, 1fr)', gap: 10, alignItems: 'start' }}>
        {/* Columna izquierda */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Panel titulo="Precios por lista" meta={sensible ? 'sin IVA · MC = (precio − costo promedio) / precio' : 'sin IVA'}>
            {row.bajo && <ListaRow theme={theme} label="Precio bajo" precio={row.bajo.real} maxPrecio={maxPrecio} color={theme.orange || '#FF9500'} sub={`${row.bajo.cliente} · ${fmtInt(row.bajo.piezas)} pz`} />}
            {listasConPrecio.map((l) => (
              <ListaRow key={l} theme={theme} label={listaLbl(l)} precio={precioEfectivo(row.precios, row.promo, l)} tachado={l === 'Mayoreo AAA' && row.promo ? precioAAA : null}
                maxPrecio={maxPrecio} color={listaColor(theme, l)} margen={sensible ? row.margen[l] : null} />
            ))}
            {listasConPrecio.length === 0 && <div style={{ fontSize: 11, color: theme.textMuted, padding: '8px 0' }}>Sin precio en ninguna lista.</div>}
          </Panel>

          <Panel titulo="Evolución del precio por lista" meta={soloUnMes ? `Histórico desde ${hist.desde ? fmtFecha(hist.desde) : 'hoy'} · acumula mes a mes` : `${hist.meses} meses · desde ${hist.desde ? fmtFecha(hist.desde) : '—'}`}>
            {hist.serie.length === 0 ? (
              <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '18px 0' }}>Sin histórico de precios para este SKU.</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={150}>
                  <LineChart data={hist.serie.map((p) => ({ ...p, label: periodoLbl(p.anio, p.mes) }))} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                    <CartesianGrid stroke={theme.border} strokeDasharray="2 4" vertical={false} />
                    <XAxis dataKey="label" tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontText }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontText }} axisLine={false} tickLine={false} domain={['auto', 'auto']} tickFormatter={(v) => fmtMoneyShort(v)} />
                    <Tooltip formatter={(v, name) => [fmtMoney(v), listaLbl(name)]} contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: theme.textMuted }} cursor={{ stroke: theme.border }} />
                    {LISTAS.filter((l) => hist.serie.some((p) => p[l] != null)).map((l) => (
                      <Line key={l} type="monotone" dataKey={l} name={l} stroke={listaColor(theme, l)} strokeWidth={l === 'Mayoreo AAA' ? 2.5 : 1.5} dot={{ r: 3, strokeWidth: 0, fill: listaColor(theme, l) }} isAnimationActive={false} connectNulls />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, marginBottom: 8 }}>
                  {LISTAS.filter((l) => hist.serie.some((p) => p[l] != null)).map((l) => (
                    <span key={l} style={{ fontSize: 10, color: theme.textMuted, display: 'inline-flex', alignItems: 'center', gap: 4 }}><span style={{ width: 10, height: 2, background: listaColor(theme, l), display: 'inline-block' }} />{listaLbl(l)}</span>
                  ))}
                </div>
                {soloUnMes ? (
                  <div style={{ fontSize: 11, color: theme.textMuted }}>El histórico se acumula desde {hist.desde ? fmtFecha(hist.desde) : 'hoy'}: a partir del próximo mes se verán los cambios por lista aquí.</div>
                ) : (
                  <TablaCompacta columnas={colsCambios} filas={hist.cambios} rowKey={(r) => `${r.lista}-${r.anio}-${r.mes}`} dense maxHeight={160} vacio="Sin cambios de precio en el histórico." />
                )}
              </>
            )}
          </Panel>

          <Panel titulo={`Evolución ${anio} · precio AAA + piezas`} meta="facturación mensual (todos los clientes)">
            {calc.serieAnio.length === 0 ? (
              <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '18px 0' }}>Sin facturación este año.</div>
            ) : (
              <ResponsiveContainer width="100%" height={130}>
                <ComposedChart data={calc.serieAnio} margin={{ top: 8, right: 6, left: -24, bottom: 0 }}>
                  <defs><linearGradient id={`epFill-${row.sku}`} x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor={theme.accent || '#007AFF'} stopOpacity={tipo ? 0.32 : 0.2} /><stop offset="100%" stopColor={theme.accent || '#007AFF'} stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid stroke={theme.border} strokeDasharray="2 4" vertical={false} />
                  <XAxis dataKey="mes" tick={{ fontSize: 9.5, fill: theme.textMuted, fontFamily: TYPO.fontText }} interval={0} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" hide domain={['auto', 'auto']} />
                  <YAxis yAxisId="right" orientation="right" hide domain={[0, 'auto']} />
                  <Tooltip formatter={(v, name) => (name === 'Precio' ? fmtMoney(v) : `${fmtInt(v)} pz`)} contentStyle={tooltipStyle} labelStyle={{ fontSize: 10, color: theme.textMuted }} cursor={{ stroke: theme.border, strokeDasharray: '3 3' }} />
                  <Bar yAxisId="right" dataKey="piezas" name="Piezas" fill={`${theme.accent || '#007AFF'}1F`} radius={[4, 4, 0, 0]} maxBarSize={26} isAnimationActive={false} />
                  <Area yAxisId="left" type="monotone" dataKey="precio" name="Precio" stroke={theme.accent || '#007AFF'} strokeWidth={2.5} fill={`url(#epFill-${row.sku})`} dot={false} connectNulls isAnimationActive={false} />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Panel>

          <PanelElasticidad elast={elast} elastCat={elastCatQ.data} elastCatLoading={elastCatQ.isLoading} categoria={row.categoria}
            lista={listaElast} onLista={setListaElast} listasConPrecio={null} historicoDesde={hist.desde} soloUnMes={soloUnMes} />
        </div>

        {/* Columna derecha */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>
          <Panel titulo="Compartir precio" meta="elige la lista · el texto no la menciona ni lleva costo">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <select value={listaValida} onChange={(e) => setLista(e.target.value)} style={selectStyle} title="Lista de precios (obligatoria; el texto no la menciona)">
                <option value="">{listasConPrecio.length ? 'Elige una lista' : 'Sin precios de lista'}</option>
                {listasConPrecio.map((l) => <option key={l} value={l}>{listaLbl(l)} · {fmtMoney(precioEfectivo(row.precios, row.promo, l))}</option>)}
              </select>
              <Boton primario icon={Share2} onClick={onCompartir} disabled={!listasConPrecio.length}>Compartir</Boton>
              <Boton icon={Copy} onClick={onCopiar} disabled={!listasConPrecio.length}>Copiar</Boton>
            </div>
            {precioSel != null && (
              <pre style={{ margin: '8px 0 0', padding: '8px 10px', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}`, fontFamily: TYPO.fontText, fontSize: 11, color: theme.text, whiteSpace: 'pre-wrap' }}>{armarTexto()}</pre>
            )}
          </Panel>

          <Simulador row={row} listasConPrecio={listasConPrecio} precioDe={(l) => precioEfectivo(row.precios, row.promo, l)} costo={calc.costo} sensible={sensible}
            ritmo={calc.ritmo} elastSku={elast?.elasticidad ?? null} elastCat={elastCatQ.data?.elasticidad ?? null} supuesto={supuestoQ.data} onGuardarSupuesto={guardarSupuesto} interno={interno} />

          <Panel titulo="Precio real por cliente" meta="3 meses cerrados · vs la lista que le corresponde">
            <TablaCompacta columnas={colsClientes} filas={calc.clientes} rowKey={(r) => r.cliente} dense maxHeight={220} vacio="Sin facturación en los 3 meses cerrados." />
          </Panel>

          <PrecioBajoSku filas={calc.precioBajo} anio={anio} />

          <Competencia sku={row.sku} precioAAA={precioAAAneto} interno={interno} />

          <Panel titulo={`Top clientes ${anio} · YTD`} meta={calc.restantes.length ? `+ ${calc.restantes.length} más · ${fmtInt(calc.restantes.reduce((s, c) => s + c.piezas, 0))} pz` : undefined} plegable abiertoInicial={false}>
            {calc.top.length === 0 ? <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '10px 0' }}>Sin facturación este año.</div> : calc.top.map((c, i) => {
              const prom = c.monto / c.piezas; const d = precioAAAneto > 0 ? ((prom - precioAAAneto) / precioAAAneto) * 100 : null;
              return (
                <div key={c.cliente} style={{ display: 'grid', gridTemplateColumns: '18px 1fr auto auto', gap: 8, alignItems: 'center', padding: '5px 2px', fontSize: 11, borderBottom: `1px solid ${theme.divider || theme.border}` }}>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 10, color: theme.textMuted }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.cliente}</div>
                    <div style={{ fontSize: 10, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{fmtInt(c.piezas)} pz · {fmtMoneyShort(c.monto)}</div>
                  </div>
                  <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{fmtMoney(prom)}</span>
                  <DeltaPill value={d} digits={1} />
                </div>
              );
            })}
          </Panel>

          <Panel titulo="Promos aplicadas" meta={calc.promosHist.length ? `${calc.promosHist.length} registradas` : undefined} plegable abiertoInicial={false}>
            {calc.promosHist.length === 0 ? <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '10px 0' }}>Sin promociones registradas.</div> : calc.promosHist.slice(0, 6).map((p, i) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr auto', gap: 10, alignItems: 'center', padding: '5px 2px', fontSize: 11, borderBottom: `1px solid ${theme.divider || theme.border}` }}>
                <span style={{ fontSize: 9.5, color: theme.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{periodoLbl(Number(p.anio), Number(p.mes))}</span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 500, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.campania}</span>
                <Pill tone="orange" size="xs">−{Math.round(N(p.promo_pct) * 100)}%</Pill>
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </div>
  );
}
