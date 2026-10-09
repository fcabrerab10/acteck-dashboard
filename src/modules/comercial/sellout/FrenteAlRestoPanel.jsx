// «<Cuenta> frente al resto» en la web (2026-10-08; del celular, 3.79.0). Posición en el ranking de las 17 cuentas, peso en
// su canal, SO/SI contra el promedio del canal y OPORTUNIDADES: SKUs que venden ≥ 2 cuentas pares del mismo canal en los
// 3 meses cerrados y esta cuenta no vende ni tiene en inventario (sellout/oportunidades.js, puro). «Armar propuesta» sólo
// en propios. Mismos hooks que el consolidado; los pares salen de vs_sellout_cuenta_sku_mes (movil/analisis/datos.js).
import React, { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { useRoadmap } from '../../../lib/queries';
import { Panel, TablaCompacta, Pill, Boton } from '../../../components/kit';
import { useCuentas, useDias, useMensual, useDrillInventario } from './datos';
import { construirFilas, ultimosMeses, canalLabel } from './calculo';
import { paresDe, oportunidades, ranking, pesoEnCanal } from './oportunidades';
import { useSkuMesCuentas } from '../../../movil/pestanas/analisis/datos';
import { fraseFrente } from '../../../movil/pestanas/analisis/calculo';
import { moneyCompact } from '../../../movil/util';

const PROPIOS = ['digitalife', 'pcel', 'dicotech'];
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const int = (n) => Math.round(Number(n) || 0).toLocaleString('es-MX');

function Dato({ k, v, sub, color }) {
  const { theme } = useTheme();
  return (
    <div style={{ minWidth: 0, padding: '8px 10px', borderRadius: 10, background: theme.bg, border: `1px solid ${theme.border}` }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{k}</div>
      <div style={{ fontSize: 18, fontWeight: 600, letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: color || theme.text, lineHeight: 1.2 }}>{v}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
    </div>
  );
}

export default function FrenteAlRestoPanel({ cuenta, nombre, anio, mes, corteDia = 31, clienteKey = null }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const hoy = useMemo(() => new Date(), []);
  const { data: cuentas = [] } = useCuentas();
  const { data: mensual = [] } = useMensual(anio);
  const { data: dias = [] } = useDias(anio);
  const pares = useMemo(() => paresDe(cuentas, cuenta), [cuentas, cuenta]);
  const enCurso = anio === hoy.getFullYear() && mes === hoy.getMonth() + 1;
  const meses3 = useMemo(() => { const fin = enCurso ? (mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }) : { anio, mes }; return ultimosMeses(fin.anio, fin.mes, 3); }, [anio, mes, enCurso]);
  const skuParesQ = useSkuMesCuentas([cuenta, ...pares], meses3, abierto && cuentas.length > 0);
  const invQ = useDrillInventario(cuenta, abierto);
  const { data: roadmap } = useRoadmap();
  const rd = useMemo(() => new Map((roadmap || []).map((r) => [r.sku, r])), [roadmap]);
  const filas = useMemo(() => construirFilas({ cuentas, mensual, dias, anio, mes, corteDia }), [cuentas, mensual, dias, anio, mes, corteDia]);
  const filasPrev = useMemo(() => { const p = mes === 1 ? { anio: anio - 1, mes: 12 } : { anio, mes: mes - 1 }; return construirFilas({ cuentas, mensual, dias, anio: p.anio, mes: p.mes, corteDia: 31 }); }, [cuentas, mensual, dias, anio, mes]);
  const rank = useMemo(() => ranking(filas, cuenta), [filas, cuenta]);
  const rankPrev = useMemo(() => ranking(filasPrev, cuenta), [filasPrev, cuenta]);
  const peso = useMemo(() => pesoEnCanal(filas, cuenta), [filas, cuenta]);
  const oport = useMemo(() => {
    const r = oportunidades({ skuMes: skuParesQ.data || [], cuenta, pares, meses: meses3, inventario: invQ.data || [] });
    return { ...r, lista: r.lista.map((o) => ({ ...o, descripcion: rd.get(o.sku)?.descripcion || '' })) };
  }, [skuParesQ.data, cuenta, pares, meses3, invQ.data, rd]);
  const paresNombre = useMemo(() => pares.map((p) => { const c = cuentas.find((x) => x.cuenta === p); const n = String(c?.nombre || p).split(' ')[0]; return n.length <= 3 ? n : n.charAt(0) + n.slice(1).toLowerCase(); }), [pares, cuentas]);
  const corto = String(nombre || cuenta).split(' (')[0];
  const canalLbl = peso?.canal ? canalLabel(peso.canal).toLowerCase() : 'su canal';
  const mesL = MESES[mes - 1];
  const movRank = rank?.pos && rankPrev?.pos ? rankPrev.pos - rank.pos : null;
  const propio = PROPIOS.includes(cuenta) || !!clienteKey;
  const armar = () => window.dispatchEvent(new CustomEvent('acteck:navegar', { detail: { pagina: 'propuestas', clienteKey: clienteKey || cuenta, extra: { clienteKey: clienteKey || cuenta, skus: oport.lista.map((o) => o.sku) } } }));
  const cols = [
    { key: 'sku', label: 'SKU', align: 'left', mono: true, bold: true, width: 110 },
    { key: 'descripcion', label: 'Producto', align: 'left', maxWidth: 280, render: (o) => <span style={{ color: theme.textMuted }}>{o.descripcion || '—'}</span> },
    { key: 'categoria', label: 'Categoría', align: 'left', render: (o) => o.categoria || '—' },
    { key: 'nPares', label: 'Lo mueven', render: (o) => `${o.nPares} de ${o.dePares} pares` },
    { key: 'pzMes', label: 'Pz/mes en pares', bold: true, render: (o) => int(Math.round(o.pzMes)) },
    { key: 'importeMes', label: '$/mes en pares', render: (o) => moneyCompact(o.importeMes) },
  ];
  const meta = abierto
    ? fraseFrente({ nombre: corto, pos: rank?.pos, de: rank?.de, pct: peso?.pct, canalLbl, soSi: peso?.soSi, soSiCanal: peso?.soSiCanal, nOport: oport?.total || 0 })
    : 'ranking entre las cuentas, peso en su canal, SO/SI contra el promedio y los SKUs que sus pares mueven y aquí faltan';
  return (
    <Panel titulo={`${corto} frente al resto`} meta={meta} plegable abiertoInicial={false} onToggle={(o) => { if (o) setAbierto(true); }}
      acciones={abierto && propio && oport?.lista?.length > 0 ? <Boton primario icon={Plus} onClick={armar}>Armar propuesta con estos SKUs</Boton> : null}>
      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8 }}>
            <Dato k="Ranking" v={rank?.pos ? `${rank.pos} de ${rank.de}` : '—'} sub={movRank == null ? `${mesL.toLowerCase()} ${anio}` : movRank === 0 ? `igual que en ${MESES[(mes + 10) % 12].toLowerCase()}` : movRank > 0 ? `sube ${movRank} vs ${MESES[(mes + 10) % 12].toLowerCase()}` : `baja ${-movRank} vs ${MESES[(mes + 10) % 12].toLowerCase()}`} />
            <Dato k={`Peso en ${canalLbl}`} v={peso?.pct != null ? `${Math.round(peso.pct)} %` : '—'} sub={peso?.deltaPp != null ? `${peso.deltaPp >= 0 ? '+' : ''}${peso.deltaPp.toFixed(1)} pp vs ${anio - 1}` : 'del sell out del canal'} color={peso?.deltaPp != null ? (peso.deltaPp >= 0 ? theme.green : theme.red) : undefined} />
            <Dato k="SO/SI vs promedio" v={peso?.soSi != null ? (peso.soSi / 100).toFixed(2) : '—'} sub={peso?.soSiCanal != null ? `promedio del canal ${(peso.soSiCanal / 100).toFixed(2)}` : 'sin promedio'} color={peso?.soSi != null && peso?.soSiCanal != null ? (peso.soSi >= peso.soSiCanal ? theme.green : theme.red) : undefined} />
            <Dato k="Oportunidades" v={oport ? `${oport.total} SKU${oport.total === 1 ? '' : 's'}` : '—'} sub={oport?.total ? `${moneyCompact(oport.importeMes)}/mes en cuentas pares` : 'nada que sus pares muevan y aquí falte'} />
          </div>
          <div style={{ fontSize: 11, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Oportunidades · {paresNombre.length ? `mueven ${paresNombre.join(', ')} y aquí no` : 'sin cuentas pares'}</div>
          <TablaCompacta dense maxHeight={360} columnas={cols} filas={oport?.lista || []} rowKey={(o) => o.sku} vacio={skuParesQ.isLoading ? 'Calculando…' : pares.length ? 'Vende todo lo que mueven sus pares.' : 'No hay otras cuentas en su canal para comparar.'} />
          <div style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted }}>SKUs con venta en ≥ 2 de las {pares.length} cuentas pares (mismo canal) en los 3 meses cerrados, que {corto} no vendió ni tiene en inventario. Piezas = promedio mensual de las pares.</div>
        </div>
      )}
    </Panel>
  );
}
