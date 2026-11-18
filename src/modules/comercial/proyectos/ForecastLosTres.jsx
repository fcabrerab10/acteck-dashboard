// Proyectos y forecast · vista «Los tres» de la web (2026-11-18, congruencia web ↔ celular).
// Suma Digitalife + PCEL + Dicotech por SKU × mes con el REPARTO POR CLIENTE en cada SKU, igual que el chip «Los tres»
// del celular: mismo motor (forecastEstado.js: estadoCliente · sumarClientes · fraseForecast) y mismos hooks
// (forecastEstadoDatos.js#useForecastCliente). Sólo lectura: capturar y exportar sigue siendo por cliente (clic en el
// nombre de un cliente cambia el selector).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { KpiCard, Panel, Pill, Segmented, Boton, TablaCompacta, Cargando } from '../../../components/kit';
import { useForecastCliente, PROPIOS_LISTA } from './forecastEstadoDatos';
import { sumarClientes, fraseForecast, ORIGEN_LABEL, ORIGEN_TONE } from './forecastEstado';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const FILTROS = [{ id: 'capturado', label: 'Capturado' }, { id: 'sugerido', label: 'Sugerido' }, { id: 'todo', label: 'Todo' }];
const TOPE = 120;

/** Filas de «Los tres» con el reparto por cliente indexado (piezas del SKU en la ventana y su origen). */
export function filasLosTres(estado, { filtro = 'capturado', q = '' } = {}) {
  const t = String(q || '').trim().toUpperCase();
  return (estado?.filas || [])
    .filter((f) => (filtro === 'todo' ? true : filtro === 'sugerido' ? f.origen === 'sugerido' : f.origen !== 'sugerido'))
    .filter((f) => !t || f.sku.includes(t) || String(f.descripcion || '').toUpperCase().includes(t) || String(f.marca || '').toUpperCase().includes(t))
    .map((f) => ({ ...f, reparto: Object.fromEntries((f.porCliente || []).map((c) => [c.key, c])) }));
}

/** Vista pura (SSR en pruebas). */
export function ForecastLosTresVista({ estado, ventana = [], clientes = PROPIOS_LISTA, filtro = 'capturado', onFiltro, q = '', onQ, onCliente, sugeridoTotal = null }) {
  const { theme } = useTheme();
  const [todas, setTodas] = useState(false);
  const r = estado.resumen;
  const filas = useMemo(() => filasLosTres(estado, { filtro, q }), [estado, filtro, q]);
  const visibles = todas ? filas : filas.slice(0, TOPE);
  const totales = useMemo(() => ({
    sku: `${int(filas.length)} SKUs`, total: int(filas.reduce((s, f) => s + f.total, 0)),
    ...Object.fromEntries(clientes.map((c) => [`c_${c.key}`, int(filas.reduce((s, f) => s + N(f.reparto[c.key]?.pz), 0))])),
    ...Object.fromEntries(ventana.map((m) => [`m${m.key}`, int(filas.reduce((s, f) => s + N(f.meses[m.key]), 0))])),
  }), [filas, clientes, ventana]);
  const dash = <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>;
  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, width: 100 },
    { key: 'descripcion', label: 'Descripción', align: 'left', maxWidth: 200, render: (f) => <span style={{ color: theme.textMuted }} title={f.descripcion}>{f.descripcion || f.marca || '—'}</span> },
    { key: 'origen', label: 'Estado', align: 'left', width: 84, render: (f) => <Pill tone={ORIGEN_TONE[f.origen] || 'gray'} size="xs">{ORIGEN_LABEL[f.origen] || f.origen}</Pill> },
    ...clientes.map((c) => ({ key: `c_${c.key}`, label: c.label, width: 78, render: (f) => {
      const x = f.reparto[c.key];
      if (!x || !(x.pz > 0)) return dash;
      return <span title={`${c.label}: ${int(x.pz)} pz · ${ORIGEN_LABEL[x.origen] || x.origen}`} style={{ color: x.origen === 'sugerido' ? theme.textMuted : theme.text, fontStyle: x.origen === 'sugerido' ? 'italic' : 'normal' }}>{int(x.pz)}</span>;
    } })),
    ...ventana.map((m) => ({ key: `m${m.key}`, label: m.label.split(' ')[0], width: 58, render: (f) => (N(f.meses[m.key]) > 0 ? int(f.meses[m.key]) : dash) })),
    { key: 'total', label: 'Total', width: 70, bold: true, render: (f) => int(f.total) },
  ];
  return (
    <>
      <Panel padding="10px 14px">
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, lineHeight: 1.4 }}>{fraseForecast(estado).replace(' Captura el primero desde el botón de abajo.', '')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
          {(r.porCliente || []).map((c) => (
            <Pill key={c.key} tone="gray" onClick={onCliente ? () => onCliente(c.key) : undefined} title={`Capturar o exportar el forecast de ${c.label}`} style={{ cursor: onCliente ? 'pointer' : 'default' }}>
              {c.label} · {int(c.skus)} SKU{c.skus === 1 ? '' : 's'} · {int(c.pz)} pz{c.porCapturar ? ` · ${c.porCapturar} por capturar` : ''}
            </Pill>
          ))}
        </div>
      </Panel>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 8 }}>
        <KpiCard eyebrow="En el CRM" big={`${int(r.enCrm.skus)} SKUs`} sub={r.enCrm.skus ? `${int(r.enCrm.pz)} pz · ya enviados` : 'nada enviado para esta ventana'} />
        <KpiCard eyebrow="Por capturar" big={`${int(r.porCapturar.skus)} SKUs`} bigColor={r.porCapturar.skus ? theme.orange : undefined}
          sub={r.porCapturar.skus ? `${int(r.porCapturar.pz)} pz sugeridas · ${r.diasLimite === 0 ? 'hoy es el día 10' : `día 10 en ${r.diasLimite} d`}` : 'todo lo sugerido está capturado'} onClick={() => onFiltro?.('sugerido')} />
        <KpiCard eyebrow="Borrador" big={`${int(r.borrador.skus)} SKUs`} bigColor={r.borrador.skus ? theme.orange : undefined} sub={r.borrador.skus ? `${int(r.borrador.pz)} pz sin exportar` : 'nada pendiente de exportar'} />
        <KpiCard eyebrow="Proyectos" big={int(r.proyectos.n)} sub={r.proyectos.n ? `${int(r.proyectos.pz)} pz en la ventana${r.proyectos.confirmados ? ` · ${r.proyectos.confirmados} confirmado${r.proyectos.confirmados === 1 ? '' : 's'}` : ''}` : 'sin proyectos en la ventana'} />
      </div>
      <Panel titulo="Forecast · SKU × mes · los tres" padding="0 0 2px"
        meta={`${int(filas.length)} SKUs · ${totales.total} pz · reparto por cliente en cada SKU · sólo lectura${sugeridoTotal ? ` · sugerido del dashboard: ${int(sugeridoTotal.skus)} SKUs · ${int(sugeridoTotal.pz)} pz` : ''}`}
        acciones={(
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <input value={q} onChange={(e) => onQ?.(e.target.value)} placeholder="SKU o descripción…" aria-label="Buscar SKU"
              style={{ height: 28, padding: '0 10px', border: `1px solid ${theme.border}`, borderRadius: 999, fontSize: 11.5, background: theme.surface, color: theme.text, fontFamily: 'inherit', outline: 'none', minWidth: 160 }} />
            <Segmented options={FILTROS} value={filtro} onChange={onFiltro} />
          </div>
        )}>
        <TablaCompacta dense dividir={false} maxHeight="min(560px, calc(100dvh - 240px))" rowKey={(f) => f.sku} filas={visibles} columnas={columnas} totales={filas.length ? totales : null}
          vacio={filtro === 'sugerido' ? 'Todo lo que el dashboard sugiere ya está en el CRM o en borrador.' : 'Sin forecast capturado para los tres clientes en esta ventana.'} />
        {filas.length > TOPE && !todas && <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}><Boton onClick={() => setTodas(true)}>Mostrar los {int(filas.length)}</Boton></div>}
        <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '6px 10px 4px', lineHeight: 1.45 }}>
          Por SKU, lo capturado hoy manda sobre la copia del CRM y ambos sobre el sugerido. En cursiva, piezas que todavía son sugerido. Para capturar, ajustar o exportar la plantilla del CRM elige un cliente arriba: aquí sólo se consulta la suma.
        </div>
      </Panel>
    </>
  );
}

export default function ForecastLosTres({ ventana, onCliente }) {
  const hoy = useMemo(() => new Date(), []);
  const [filtro, setFiltro] = useState('capturado');
  const [q, setQ] = useState('');
  const a = useForecastCliente('digitalife', ventana, { hoy });
  const b = useForecastCliente('pcel', ventana, { hoy });
  const c = useForecastCliente('dicotech', ventana, { hoy });
  const estado = useMemo(() => sumarClientes([a.estado, b.estado, c.estado]), [a.estado, b.estado, c.estado]);
  const sugeridoTotal = useMemo(() => {
    const ls = [a, b, c]; const skus = ls.reduce((s, x) => s + x.sugerido.length, 0);
    return skus ? { skus, pz: ls.reduce((s, x) => s + x.sugerido.reduce((t, f) => t + N(f.total), 0), 0) } : null;
  }, [a.sugerido, b.sugerido, c.sugerido]); // eslint-disable-line react-hooks/exhaustive-deps
  if (a.loading || b.loading || c.loading) return <Cargando pantalla="forecast" minHeight={320} />;
  return <ForecastLosTresVista estado={estado} ventana={ventana} filtro={filtro} onFiltro={setFiltro} q={q} onQ={setQ} onCliente={onCliente} sugeridoTotal={sugeridoTotal} />;
}
