// Drill del SKU · "Elasticidad por cambio de precio": por cada cambio en precios_historico (lista elegible, Mayoreo AAA
// por defecto) piezas 3 meses antes vs 3 meses después (ventana cerrada) → Δprecio %, Δpz %, elasticidad = Δpz% / Δprecio%.
// Pills: elasticidad promedio del SKU y la de su categoría (useElasticidadCategoria). Con un solo mes de histórico o sin
// cambios: bloque vacío con la fecha desde la que acumula el histórico. Cálculo puro en precios/elasticidad.js
// (el archivo se llama PanelElasticidad.jsx porque en macOS './Elasticidad' resolvería a elasticidad.js).
import React from 'react';
import { useTheme } from '../../../lib/themeContext';
import { fecha as fmtFecha } from '../../../lib/format';
import { Panel, Pill, DeltaPill, TablaCompacta } from '../../../components/kit';
import { LISTAS, ordenarListas, listaLbl, fmtMoney, fmtInt, periodoLbl, fmtElast, selectPill } from './textos';

export default function PanelElasticidad({ elast, elastCat, elastCatLoading, categoria, lista, onLista, listas, listasConPrecio, historicoDesde, soloUnMes }) {
  const { theme } = useTheme();
  const cols = [
    { key: 'periodo', label: 'Cambio', align: 'left', render: (r) => periodoLbl(r.anio, r.mes) },
    { key: 'de', label: 'De', render: (r) => fmtMoney(r.de) },
    { key: 'a', label: 'A', render: (r) => <span style={{ fontWeight: 600 }}>{fmtMoney(r.a)}</span> },
    { key: 'deltaPrecioPct', label: 'Δ precio', render: (r) => <DeltaPill value={r.deltaPrecioPct} digits={1} /> },
    { key: 'antes', label: 'Pz antes', render: (r) => (r.antes != null ? `${fmtInt(r.antes)}/m` : '—') },
    { key: 'despues', label: 'Pz después', render: (r) => (r.despues != null ? `${fmtInt(r.despues)}/m` : '—') },
    { key: 'deltaPzPct', label: 'Δ piezas', render: (r) => (r.cerrado ? <DeltaPill value={r.deltaPzPct} digits={1} /> : <Pill tone="gray" size="xs">ventana abierta</Pill>) },
    { key: 'elasticidad', label: 'Elasticidad', render: (r) => <span style={{ fontWeight: 600, color: r.elasticidad == null ? theme.textMuted : theme.text }}>{fmtElast(r.elasticidad)}</span> },
  ];
  const vacio = soloUnMes || !elast || elast.filas.length === 0;
  const meta = vacio ? undefined : `${elast.filas.length} cambio${elast.filas.length === 1 ? '' : 's'} · ${elast.cerrados} con ventana cerrada${elast.pendientes ? ` · ${elast.pendientes} en curso` : ''}`;

  return (
    <Panel titulo="Elasticidad por cambio de precio" meta={meta}
      acciones={(
        <select value={lista} onChange={(e) => onLista(e.target.value)} style={selectPill(theme)} title="Lista sobre la que se miden los cambios">
          {ordenarListas(listas?.length ? listas : LISTAS).map((l) => <option key={l} value={l} disabled={listasConPrecio && !listasConPrecio.includes(l)}>{listaLbl(l)}</option>)}
        </select>
      )}>
      {vacio ? (
        <div style={{ fontSize: 11, color: theme.textMuted, padding: '10px 0', textAlign: 'center' }}>
          Se calculará cuando haya cambios de precio (histórico desde {historicoDesde ? fmtFecha(historicoDesde) : '10 sep 2026'}).
          <div style={{ fontSize: 10, marginTop: 4 }}>Piezas 3 meses antes vs 3 meses después de cada cambio · elasticidad = Δ piezas % ÷ Δ precio %.</div>
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            <Pill tone={elast.elasticidad == null ? 'gray' : 'blue'}>SKU {fmtElast(elast.elasticidad)}{elast.n ? ` · ${elast.n} cambio${elast.n === 1 ? '' : 's'}` : ' · sin ventana cerrada'}</Pill>
            {categoria && (
              <Pill tone={elastCat?.elasticidad != null ? 'purple' : 'gray'}>
                {categoria} {elastCatLoading ? '…' : fmtElast(elastCat?.elasticidad)}{elastCat?.n ? ` · ${elastCat.n} SKU${elastCat.n === 1 ? '' : 's'}` : ''}
              </Pill>
            )}
            <span style={{ fontSize: 10, color: theme.textMuted }}>Δ piezas % ÷ Δ precio % · −1.2 = subir 10 % el precio baja 12 % las piezas</span>
          </div>
          <TablaCompacta columnas={cols} filas={elast.filas} rowKey={(r) => `${r.anio}-${r.mes}`} dense maxHeight={180} vacio="Sin cambios en esta lista." />
        </>
      )}
    </Panel>
  );
}
