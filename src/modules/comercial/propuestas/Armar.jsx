// Armar — vista one-page del armador: Hero de contexto (cuota, facturado, total, días; pills de datos faltantes con
// enlace al importador) · catálogo con buscador, pills de filtro con conteo y TablaCompacta (orden por columna, fila
// seleccionable, piezas/precio editables, memoria "última vez propuesto") · tarjeta Mi propuesta a la derecha.
// Sugeridos (sugeridos.js): nada se marca solo. Los SKUs con cobertura crítica en el cliente van AL PRINCIPIO del
// catálogo con sombreado suave y pill "Sugerido · N pz"; Aceptar (o clic en la fila) los agrega con esa cantidad y la
// fila vuelve a su orden normal. "Aceptar todos los sugeridos (N)" en la toolbar; "Sombreado" apaga el resaltado.
import React, { useMemo, useState } from 'react';
import { ArrowLeft, Check, ExternalLink } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Hero, Panel, Pill, Boton, TablaCompacta } from '../../../components/kit';
import { money, moneyCompact, int, fechaCorta } from '../../../lib/format';
import Buscador from '../sellin/Buscador';
import Filtros from '../sellin/Filtros';
import { roadmapTone } from '../sellin/textos';
import { MES_ACTUAL, MES_LABEL, MES_FULL, clienteColor, listaShort } from './constantes';
import { FILTROS_VACIOS, tokens as aTokens, pasaTodos, facetas as calcFacetas, nActivos } from './filtros';
import { calcularSugeridos } from './sugeridos';
import PrecioPicker from './PrecioPicker';
import MiPropuesta from './MiPropuesta';

const N = (v) => Number(v) || 0;
const LIMITE = 300;
const irAlImportador = (pagina = 'actualizacion') => window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina } }));

/** Pill sobre el Hero (fondo inverso): vidrio claro + punto de color según severidad; clic → importador. */
function PillHero({ tipo, children, onClick, title }) {
  const { theme } = useTheme();
  const dot = tipo === 'error' ? (theme.red || '#FF3B30') : tipo === 'warn' ? (theme.orange || '#FF9500') : (theme.accent || '#007AFF');
  const text = theme.textOnInverse || '#F5F5F7';
  const bg = theme.mode === 'dark' ? 'rgba(29,29,31,0.10)' : 'rgba(245,245,247,0.14)';
  return (
    <Pill size="xs" onClick={onClick} title={title} style={{ background: bg, color: text, gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, display: 'inline-block', flexShrink: 0 }} />
      {children}
      {onClick && <ExternalLink size={10} style={{ opacity: 0.7 }} />}
    </Pill>
  );
}

export default function Armar({ cliente, contexto, skus, propuesta, setPropuesta, nombre, setNombre, folio, memoria, sensible, autosave, onBack, onGuardar, onRevisar }) {
  const { theme } = useTheme();
  const cliCol = clienteColor(theme, cliente.key);
  const accent = theme.accent || '#007AFF';
  const [busqueda, setBusqueda] = useState('');
  const [f, setF] = useState(() => ({ ...FILTROS_VACIOS(), soloStock: true }));
  const [orden, setOrden] = useState({ col: 'sellout90', dir: 'desc' });
  const [sombreado, setSombreado] = useState(true);

  // Sugeridos sólo cuando hay sell-out e inventario del cliente (sin ellos todo parecería "sin stock").
  const sugeridos = useMemo(() => calcularSugeridos(skus, { activo: !!(contexto?.fuentes?.sellout && contexto?.fuentes?.invCliente) }), [skus, contexto]);
  const esSugeridoPendiente = (r) => sugeridos.has(r.sku) && !(r.sku in propuesta);

  const filtro = useMemo(() => ({ ...f, tokens: aTokens(busqueda) }), [f, busqueda]);
  const facetas = useMemo(() => calcFacetas(skus, filtro), [skus, filtro]);
  const filtrados = useMemo(() => {
    const arr = skus.filter((r) => pasaTodos(r, filtro));
    if (orden.col) {
      const mult = orden.dir === 'asc' ? 1 : -1;
      const esTexto = ['sku', 'descripcion', 'familia'].includes(orden.col);
      arr.sort((a, b) => {
        if (orden.col === 'ultima') return ((memoria?.get(a.sku) ? Date.parse(memoria.get(a.sku).fecha) : 0) - (memoria?.get(b.sku) ? Date.parse(memoria.get(b.sku).fecha) : 0)) * mult;
        if (esTexto) return String(a[orden.col] || '').localeCompare(String(b[orden.col] || ''), 'es') * mult;
        return (N(a[orden.col]) - N(b[orden.col])) * mult;
      });
    }
    // Sugeridos pendientes al principio (estable: conservan entre sí el orden de la columna); al aceptarlos vuelven a su sitio.
    if (sugeridos.size === 0) return arr;
    const pend = [], resto = [];
    for (const r of arr) (sugeridos.has(r.sku) && !(r.sku in propuesta) ? pend : resto).push(r);
    return pend.length ? [...pend, ...resto] : arr;
  }, [skus, filtro, orden, memoria, sugeridos, propuesta]);
  const pendientesVisibles = useMemo(() => filtrados.filter(esSugeridoPendiente), [filtrados, sugeridos, propuesta]); // eslint-disable-line react-hooks/exhaustive-deps

  const onSort = (col) => setOrden((prev) => (prev.col !== col ? { col, dir: col === 'sku' || col === 'descripcion' || col === 'familia' ? 'asc' : 'desc' } : { col, dir: prev.dir === 'desc' ? 'asc' : 'desc' }));
  const toggleGrupo = (g, id) => setF((prev) => { const s = new Set(prev[g]); s.has(id) ? s.delete(id) : s.add(id); return { ...prev, [g]: s }; });
  const toggleFlag = (id) => setF((prev) => ({ ...prev, [id]: !prev[id] }));
  const limpiar = () => { setF(FILTROS_VACIOS()); setBusqueda(''); };

  const mesesKeys = contexto?.mesesKeys || [];
  const mesLbl = (k) => { const [, m] = String(k).split('-').map(Number); return MES_LABEL[(m || 1) - 1]; };

  const lineaNueva = (meta, piezas) => {
    const listaDefault = meta ? Object.keys(meta.precios)[0] || '' : '';
    return { piezas, precio: meta ? meta.precios[listaDefault] || 0 : 0, listaSel: listaDefault };
  };
  const toggleSku = (sku) => {
    setPropuesta((prev) => {
      const next = { ...prev };
      if (sku in next) { delete next[sku]; return next; }
      const meta = skus.find((r) => r.sku === sku);
      const sug = sugeridos.get(sku);
      next[sku] = lineaNueva(meta, sug ? sug.piezas : Math.max(1, meta?.promSellout || 1));
      return next;
    });
  };
  const aceptarSugerido = (sku) => {
    const sug = sugeridos.get(sku); if (!sug) return;
    const meta = skus.find((r) => r.sku === sku);
    setPropuesta((prev) => (sku in prev ? prev : { ...prev, [sku]: lineaNueva(meta, sug.piezas) }));
  };
  const aceptarTodos = () => {
    const lote = pendientesVisibles;
    if (!lote.length) return;
    setPropuesta((prev) => { const next = { ...prev }; for (const r of lote) if (!(r.sku in next)) next[r.sku] = lineaNueva(r, sugeridos.get(r.sku).piezas); return next; });
  };
  const editarSku = (sku, cambios) => setPropuesta((prev) => (sku in prev ? { ...prev, [sku]: { ...prev[sku], ...cambios } } : prev));

  const propuestaLista = useMemo(() => Object.entries(propuesta).map(([sku, val]) => ({ ...skus.find((r) => r.sku === sku), ...val })).filter((r) => r.sku), [propuesta, skus]);
  const totalPropuesta = propuestaLista.reduce((s, r) => s + N(r.piezas) * N(r.precio), 0);
  const piezasTotal = propuestaLista.reduce((s, r) => s + N(r.piezas), 0);
  const spiffTotal = propuestaLista.reduce((s, r) => s + N(r.piezas) * N(r.spiff), 0);
  const spiffSkusCount = propuestaLista.filter((r) => N(r.spiff) > 0 && N(r.piezas) > 0).length;
  const spiffDisponiblesCount = skus.filter((r) => N(r.spiff) > 0).length;
  const margenProm = useMemo(() => {
    let num = 0, den = 0;
    for (const r of propuestaLista) { const px = N(r.precio), tot = px * N(r.piezas); if (r.costo > 0 && px > 0) { num += ((px - r.costo) / px) * tot; den += tot; } }
    return den > 0 ? (num / den) * 100 : null;
  }, [propuestaLista]);

  const cuotaPct = contexto?.cuota > 0 ? Math.min(100, Math.round((contexto.facturado / contexto.cuota) * 100)) : 0;
  const mono = { fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums' };
  const muted = (v) => (v ? int(v) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>);
  const sugTitle = (s) => `Vendió ${int(s.ritmo)} pz/mes en los 3 meses cerrados · stock del cliente ${int(s.stock)} pz (${s.stock ? `${s.dias} días de cobertura` : 'sin stock'}) → sugerido ${int(s.piezas)} pz para 1 mes`;

  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', width: 96, sort: true, mono: true, render: (r) => <span style={{ ...mono, fontWeight: 600, color: r.sku in propuesta ? accent : theme.text }}>{r.sku}</span> },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 260, sort: true, render: (r) => <span title={r.descripcion}>{r.descripcion || '—'}</span> },
    { key: 'familia', label: 'Familia', align: 'left', width: 100, sort: true, render: (r) => <span style={{ color: theme.textMuted, fontSize: 10.5 }}>{r.familia || '—'}{r.rdmp ? <Pill tone={roadmapTone(r.rdmp)} size="xs" style={{ marginLeft: 5 }}>{r.rdmp}</Pill> : null}</span> },
    { key: 'invCliente', label: 'Inv cli', width: 60, sort: true, render: (r) => { const s = sugeridos.get(r.sku); return s ? <span style={{ color: theme.red || '#FF3B30', fontWeight: 600 }} title={s.stock ? `${s.dias} días de cobertura` : 'Sin stock en el cliente'}>{int(s.stock)}</span> : muted(r.invCliente); } },
    ...[2, 1, 0].map((idx) => ({ key: `m${idx}`, label: mesLbl(mesesKeys[idx]), width: 52, render: (r) => <span style={{ color: theme.textMuted }}>{muted(N(r.selloutMes?.[mesesKeys[idx]]))}</span> })),
    { key: 'promSellout', label: '⌀ 3m', width: 56, sort: true, bold: true, render: (r) => muted(r.promSellout) },
    { key: 'invActeck', label: 'Inv Ack', width: 62, sort: true, render: (r) => muted(r.invActeck) },
    { key: 'spiff', label: 'SPIFF', width: 60, sort: true, render: (r) => (r.spiff > 0 ? <Pill tone="yellow" size="xs">${r.spiff}/pz</Pill> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'ultima', label: 'Últ. vez', align: 'left', width: 118, sort: true, render: (r) => {
      const m = memoria?.get(r.sku);
      if (!m) return <span style={{ color: theme.textSubtle || theme.textMuted, fontSize: 10 }}>nunca</span>;
      const sel = propuesta[r.sku];
      const difiere = sel && N(sel.precio) > 0 && Math.abs(N(sel.precio) - m.precio) > 0.005;
      return (
        <span title={`Última propuesta enviada: ${m.nombre} · ${fechaCorta(m.fecha)} · ${int(m.piezas)} pz · ${money(m.precio)} · ${m.lista || 'sin lista'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, color: theme.textMuted, ...mono }}>
          {fechaCorta(m.fecha)} · {money(m.precio)} <span style={{ fontSize: 9, opacity: 0.8 }}>{listaShort(m.lista)}</span>
          {difiere && <Pill tone={N(sel.precio) < m.precio ? 'orange' : 'blue'} size="xs" title={`Precio elegido ${N(sel.precio) < m.precio ? 'menor' : 'mayor'} que el último propuesto (${money(m.precio)})`}>≠</Pill>}
        </span>
      );
    } },
    { key: 'piezas', label: 'Piezas', width: 76, render: (r) => (r.sku in propuesta ? (
      <input type="number" min="0" value={propuesta[r.sku].piezas ?? ''} onClick={(e) => e.stopPropagation()}
        onChange={(e) => editarSku(r.sku, { piezas: Number(e.target.value) || 0 })}
        style={{ width: 62, height: 24, padding: '0 8px', textAlign: 'right', fontSize: 11, ...mono, background: theme.bg, border: `1px solid ${theme.border}`, borderRadius: 7, color: theme.text, outline: 'none' }} />
    ) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'precio', label: 'Precio', align: 'left', width: 168, render: (r) => {
      if (r.sku in propuesta) return <PrecioPicker r={r} val={propuesta[r.sku]} onChange={(patch) => editarSku(r.sku, patch)} />;
      const s = sugeridos.get(r.sku);
      if (!s) return <span style={{ fontSize: 10, color: theme.textSubtle || theme.textMuted }}>Marcar para editar</span>;
      return (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <Pill tone="blue" size="xs" dot title={sugTitle(s)}>Sugerido · {int(s.piezas)} pz</Pill>
          <Boton onClick={() => aceptarSugerido(r.sku)} title={sugTitle(s)} style={{ height: 22, padding: '0 9px', fontSize: 11 }}>Aceptar</Boton>
        </span>
      );
    } },
    { key: 'total', label: 'Total', width: 88, bold: true, render: (r) => (r.sku in propuesta ? money(N(propuesta[r.sku].piezas) * N(propuesta[r.sku].precio)) : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
    { key: 'sel', label: '', align: 'center', width: 36, render: (r) => {
      const sel = r.sku in propuesta;
      return <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 20, height: 20, borderRadius: 999, background: sel ? accent : 'transparent', border: `1.5px solid ${sel ? accent : (theme.borderStrong || theme.border)}`, color: '#FFF' }}>{sel && <Check size={11} strokeWidth={3} />}</span>;
    } },
  ];

  const grupos = [
    { id: 'marca', label: 'Marca', opciones: facetas.marca.filter((o) => o.n > 0 || f.marca.has(o.id)).slice(0, 10), sel: f.marca },
    { id: 'familia', label: 'Familia', opciones: facetas.familia.filter((o) => o.n > 0 || f.familia.has(o.id)).slice(0, 14), sel: f.familia },
    { id: 'roadmap', label: 'Roadmap', opciones: facetas.roadmap.filter((o) => o.n > 0 || f.roadmap.has(o.id)).map((o) => ({ ...o, tone: roadmapTone(o.id) })), sel: f.roadmap },
  ];
  const toggles = [
    { id: 'soloStock', label: 'Con stock', on: f.soloStock, n: facetas.stock },
    { id: 'soloSellout', label: 'Con sell-out reciente', on: f.soloSellout, n: facetas.sellout },
    { id: 'soloSpiff', label: 'Con SPIFF', on: f.soloSpiff, n: facetas.spiff },
  ];
  const warnings = contexto?.warnings || [];
  const sugeridosTotales = sugeridos.size;
  const sugeridosPendientes = [...sugeridos.keys()].filter((k) => !(k in propuesta)).length;

  return (
    <div data-stagger style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Boton icon={ArrowLeft} onClick={onBack} title="Guarda el borrador y regresa a Propuestas">Propuestas</Boton>
        <span style={{ width: 26, height: 26, borderRadius: 8, background: cliCol, color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontFamily: TYPO.fontDisplay, fontWeight: 600, fontSize: 11 }}>{cliente.iniciales}</span>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: theme.text }}>Propuesta {cliente.label} ·</span>
        <input type="text" value={nombre || ''} onChange={(e) => setNombre?.(e.target.value)} placeholder="Nombre de la propuesta (obligatorio para enviar)" aria-label="Nombre de la propuesta"
          style={{ height: 28, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 8, padding: '0 10px', fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, letterSpacing: '-0.01em', color: accent, minWidth: 260, maxWidth: 340, outline: 'none' }} />
        {folio && <Pill tone="gray" size="xs" title="Folio automático (referencia)">{folio}</Pill>}
      </div>

      <Hero
        eyebrow={`Dirección Comercial · Armador · ${MES_FULL[MES_ACTUAL.mes - 1]} ${MES_ACTUAL.anio}`}
        titulo={`${int(skus.length)} SKUs disponibles · ${propuestaLista.length} en la propuesta${sugeridosPendientes ? ` · ${int(sugeridosPendientes)} sugeridos por aceptar` : ''}.`}
        sub="Nada se marca solo: acepta los sugeridos (vendidos en los 3 meses cerrados y con cobertura crítica en el cliente) o marca SKUs del catálogo. Las piezas parten del sell-out promedio y el precio de la primera lista disponible; cada línea puede cambiar de lista o llevar precio personalizado."
        stats={contexto ? [
          { k: `Cuota ${MES_LABEL[MES_ACTUAL.mes - 1]}`, v: moneyCompact(contexto.cuota), sub: contexto.cuota > 0 ? 'meta del mes' : 'sin capturar' },
          { k: 'Facturado', v: moneyCompact(contexto.facturado), sub: `${cuotaPct}% de la cuota` },
          { k: 'Total propuesta', v: totalPropuesta > 0 ? moneyCompact(totalPropuesta) : '$0', sub: `${propuestaLista.length} SKUs · ${int(piezasTotal)} pz`, color: totalPropuesta > 0 ? (theme.green || '#34C759') : undefined },
          { k: 'Días', v: `${contexto.diasRestantes}d`, sub: 'hasta corte' },
        ] : []}>
        {(warnings.length > 0 || sugeridosTotales > 0) && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {warnings.map((w, i) => <PillHero key={i} tipo={w.tipo} title={`${w.msg} · Ir a Actualización de datos`} onClick={w.pagina ? () => irAlImportador(w.pagina) : undefined}>{w.titulo}</PillHero>)}
            {sugeridosTotales > 0 && <PillHero tipo="info" title="Vendidos en los 3 meses cerrados y hoy con cobertura < 30 días o sin stock en el cliente">{int(sugeridosTotales)} sugerido{sugeridosTotales === 1 ? '' : 's'} por cobertura</PillHero>}
          </div>
        )}
      </Hero>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 10, alignItems: 'start' }}>
        <Panel padding="0" titulo="Catálogo" meta={`${int(filtrados.length)} de ${int(skus.length)} SKUs · ${propuestaLista.length} seleccionados`}
          acciones={<Buscador value={busqueda} onChange={setBusqueda} resultados={int(filtrados.length)} placeholder="Buscar: mouse inalámbrico, AC-93, balam, RMI…" width={300} />}>
          <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}` }}>
            <Filtros grupos={grupos} toggles={toggles} onToggle={toggleGrupo} onToggleFlag={toggleFlag} onLimpiar={limpiar} activos={nActivos(f) + (busqueda ? 1 : 0)} />
          </div>
          {sugeridosTotales > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderBottom: `1px solid ${theme.border}`, background: sombreado && pendientesVisibles.length ? `${accent}${theme.mode === 'dark' ? '12' : '08'}` : 'transparent', flexWrap: 'wrap' }}>
              <Pill tone="blue" dot>Sugeridos · {int(pendientesVisibles.length)}{pendientesVisibles.length !== sugeridosPendientes ? ` de ${int(sugeridosPendientes)}` : ''}</Pill>
              <span style={{ fontSize: 10.5, color: theme.textMuted }}>vendidos en los 3 meses cerrados y hoy con cobertura &lt; 30 días o sin stock en el cliente · piezas = 1 mes de venta − stock, en múltiplos de 5</span>
              <span style={{ marginLeft: 'auto', display: 'inline-flex', gap: 6, alignItems: 'center' }}>
                <Pill tone={sombreado ? 'blue' : 'gray'} size="xs" onClick={() => setSombreado((v) => !v)} title={sombreado ? 'Ocultar el sombreado de los sugeridos' : 'Mostrar el sombreado de los sugeridos'}>Sombreado {sombreado ? 'on' : 'off'}</Pill>
                <Boton primario disabled={!pendientesVisibles.length} onClick={aceptarTodos} title="Agrega todos los sugeridos visibles con sus piezas sugeridas">Aceptar todos los sugeridos ({int(pendientesVisibles.length)})</Boton>
              </span>
            </div>
          )}
          <div style={{ padding: 0 }}>
            <TablaCompacta dense columnas={columnas} filas={filtrados.slice(0, LIMITE)} rowKey={(r) => r.sku} orden={orden} onSort={onSort}
              onRowClick={(r) => toggleSku(r.sku)} maxHeight="calc(100vh - 330px)" vacio="Ningún SKU coincide con la búsqueda y los filtros."
              rowStyle={(r) => (r.sku in propuesta ? { background: `${accent}${theme.mode === 'dark' ? '1F' : '0D'}` } : sombreado && esSugeridoPendiente(r) ? { background: `${accent}14` } : null)} />
            {filtrados.length > LIMITE && <div style={{ padding: 10, textAlign: 'center', fontSize: 11, color: theme.textMuted }}>Mostrando {LIMITE} de {int(filtrados.length)} · afina la búsqueda o los filtros</div>}
          </div>
        </Panel>
        <MiPropuesta cliente={cliente} propuestaLista={propuestaLista} totalPropuesta={totalPropuesta} piezasTotal={piezasTotal}
          spiffTotal={spiffTotal} spiffSkusCount={spiffSkusCount} spiffDisponiblesCount={spiffDisponiblesCount}
          margenProm={margenProm} sensible={sensible} autosave={autosave} onGuardar={onGuardar} onRevisar={onRevisar} />
      </div>
    </div>
  );
}
