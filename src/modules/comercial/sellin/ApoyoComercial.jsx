// Panel "Apoyo comercial" · el desglose de las bonificaciones por concepto que hasta hoy
// sólo existía como un número agregado ([Bonificaciones], −$34.4 M en 2026).
//
//   Consolidado  → Segmented "Por concepto · Por cliente"; el drill de la fila abre el otro eje.
//   Por cliente  → sólo por concepto; el drill de la fila abre los meses del año.
//
// Montos en POSITIVO (son apoyos, no ventas negativas) · el % es sobre la fact. bruta del
// mismo universo · los % nunca se suman: el total recalcula el suyo (src/lib/medidas.js).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Segmented, TablaCompacta, DeltaPill, Skeleton } from '../../../components/kit';
import { MESES, MESES_LARGO, fmtInt, fmtPct, fmtMoneyShort } from './textos';
import { useApoyoComercial } from './datos';
import { agruparApoyo, totalesApoyo, factBruta, factBrutaPorCliente, pctSobre } from './apoyo';

const EJES = [
  { id: 'concepto', label: 'Por concepto', title: 'Cada tipo de apoyo (rebate, marketing, protección de precios…)' },
  { id: 'cliente', label: 'Por cliente', title: 'Cuánto apoyo se llevó cada cliente' },
];

export default function ApoyoComercial({ anio, mes, clienteKey = null, nombreCliente = '' }) {
  const { theme } = useTheme();
  const anioPrev = anio - 1;
  const [por, setPor] = useState('concepto');
  const [abierta, setAbierta] = useState(null);
  const { data, isLoading } = useApoyoComercial(anio, clienteKey);

  const hijo = clienteKey ? (por === 'cliente' ? 'concepto' : 'mes') : (por === 'concepto' ? 'cliente' : 'concepto');
  const filas = useMemo(() => agruparApoyo(data?.filas || [], { anio, anioPrev, mes, por, hijo }), [data, anio, anioPrev, mes, por, hijo]);
  const tot = useMemo(() => totalesApoyo(data?.filas || [], { anio, anioPrev, mes }), [data, anio, anioPrev, mes]);
  const fb = useMemo(() => factBruta(data?.fb || [], { anio, mes }), [data, anio, mes]);
  const fbCli = useMemo(() => factBrutaPorCliente(data?.fbCliente || [], { anio, mes }), [data, anio, mes]);

  // Denominador de cada fila: por concepto es la fact. bruta del universo; por cliente, la suya.
  const baseDe = (f) => (por === 'cliente' ? (fbCli.get(f.key) ?? null) : fb.ytd);
  const columnas = useMemo(() => [
    {
      key: 'label', label: por === 'cliente' ? 'Cliente' : 'Concepto', align: 'left', maxWidth: 320,
      render: (f) => (
        <span title={`${f.label}${f.sub ? ` · ${f.sub}` : ''}`} style={{ display: 'inline-flex', alignItems: 'baseline', gap: 6, minWidth: 0 }}>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.label}</span>
          {f.sub && <span style={{ fontSize: 9.5, color: theme.textSubtle || theme.textMuted, fontFamily: TYPO.fontDisplay, flexShrink: 0 }}>{f.sub}</span>}
        </span>
      ),
      renderTotal: () => `${filas.length} ${por === 'cliente' ? 'clientes' : 'conceptos'}`,
    },
    { key: 'mes', label: MESES[mes - 1], align: 'right', width: 92, sort: true, render: (f) => (f.mes ? fmtMoneyShort(f.mes) : <span style={{ color: theme.textSubtle }}>—</span>), renderTotal: (v) => fmtMoneyShort(v) },
    { key: 'ytd', label: `YTD ${anio}`, align: 'right', width: 96, sort: true, bold: true, render: (f) => fmtMoneyShort(f.ytd), renderTotal: (v) => fmtMoneyShort(v) },
    { key: 'pct', label: '% fact. bruta', align: 'right', width: 88, sort: true, render: (f) => { const p = pctSobre(f.ytd, baseDe(f)); return p == null ? <span style={{ color: theme.textSubtle }}>—</span> : fmtPct(p, 2); }, renderTotal: () => (fb.ytd ? fmtPct(pctSobre(tot.ytd, fb.ytd), 2) : '—') },
    { key: 'delta', label: `Δ vs ${anioPrev}`, align: 'right', width: 76, render: (f) => (f.ytdPrev || f.ytd ? <span title={`YTD ${anioPrev}: ${fmtMoneyShort(f.ytdPrev)}`}><DeltaPill value={f.delta} /></span> : <span style={{ color: theme.textSubtle }}>—</span>), renderTotal: () => <DeltaPill value={tot.delta} /> },
  ], [por, mes, anio, anioPrev, theme, filas.length, fb.ytd, fbCli, tot]);

  const totales = { mes: tot.mes, ytd: tot.ytd };
  const pctTot = pctSobre(tot.ytd, fb.ytd);
  const meta = isLoading
    ? 'cargando…'
    : `${MESES_LARGO[mes - 1]} ${fmtMoneyShort(tot.mes)} · YTD ${fmtMoneyShort(tot.ytd)}${pctTot != null ? ` · ${fmtPct(pctTot, 1)} de la fact. bruta` : ''} · ${tot.conceptos} conceptos`;

  return (
    <Panel titulo="Apoyo comercial" meta={meta} plegable abiertoInicial={false} padding="8px 10px 10px"
      acciones={!clienteKey ? <Segmented value={por} onChange={(v) => { setPor(v); setAbierta(null); }} options={EJES} /> : null}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 10.5, color: theme.textMuted }}>
          Bonificaciones del ERP (renglones con rama «SERVICIOS») {clienteKey ? `de ${nombreCliente || 'este cliente'}` : 'de todos los clientes'}: rebates, apoyo de marketing, promociones, protección de precios, pronto pago…
          Se muestran en positivo; en el ERP restan de la venta. Toca una fila para ver {hijo === 'mes' ? 'los meses' : hijo === 'cliente' ? 'los clientes' : 'los conceptos'}.
        </div>
        {isLoading ? <Skeleton h={180} r={10} /> : (
          <TablaCompacta columnas={columnas} filas={filas} rowKey={(f) => f.key} totales={totales} dense maxHeight="48vh"
            onRowClick={(f) => setAbierta((k) => (k === f.key ? null : f.key))} expandidoKey={abierta}
            vacio={`Sin bonificaciones cargadas en ${anio}.`}
            renderExpandido={(f) => <Hijos fila={f} hijo={hijo} mes={mes} anio={anio} theme={theme} />} />
        )}
      </div>
    </Panel>
  );
}

/** Drill de la fila: el otro eje (clientes, conceptos o meses) en una rejilla compacta. */
function Hijos({ fila, hijo, mes, anio, theme }) {
  const lista = hijo === 'mes'
    ? fila.meses.map((v, i) => ({ key: String(i + 1), label: `${MESES[i]} ${String(anio).slice(2)}`, ytd: v, mes: i + 1 === mes ? v : 0 })).filter((x) => x.ytd)
    : fila.hijos;
  const total = lista.reduce((s, x) => s + x.ytd, 0);
  return (
    <div style={{ padding: '8px 10px', background: theme.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.015)', display: 'grid', gap: 4, fontFamily: TYPO.fontText }}>
      <div style={{ fontSize: 10.5, color: theme.textMuted, marginBottom: 2 }}>
        {fila.label} · {hijo === 'mes' ? 'mes a mes' : hijo === 'cliente' ? `${lista.length} clientes` : `${lista.length} conceptos`} · {fmtMoneyShort(fila.ytd)} YTD · {fmtInt(fila.renglones)} renglones
      </div>
      {!lista.length && <div style={{ fontSize: 11, color: theme.textMuted }}>Sin desglose en el periodo.</div>}
      {lista.slice(0, 14).map((x) => (
        <div key={x.key} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 56px', gap: 8, alignItems: 'center', fontSize: 11 }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: theme.text }} title={x.label}>{x.label}</div>
            <div style={{ height: 3, borderRadius: 999, background: theme.border, marginTop: 2 }}>
              <div style={{ height: '100%', width: `${total ? Math.max(2, (x.ytd / total) * 100) : 2}%`, background: theme.accent || '#007AFF', borderRadius: 999 }} />
            </div>
          </div>
          <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', fontWeight: 600 }}>{fmtMoneyShort(x.ytd)}</span>
          <span style={{ fontFamily: TYPO.fontDisplay, fontVariantNumeric: 'tabular-nums', textAlign: 'right', color: theme.textMuted }}>{total ? fmtPct((x.ytd / total) * 100, 0) : '—'}</span>
        </div>
      ))}
      {lista.length > 14 && <div style={{ fontSize: 10, color: theme.textMuted, fontStyle: 'italic' }}>+ {lista.length - 14} más</div>}
    </div>
  );
}
