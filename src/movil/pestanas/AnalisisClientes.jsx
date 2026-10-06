// Análisis por cliente en el celular · lista (3.79.0 · 2026-10-05, mockup scratchpad/analisis-movil.html pantalla 1).
// Formato estándar: TituloGrande (Segmented Mes · YTD + SelectorPeriodoM) → HeroM inversa con la frase de la cartera y
// la barra de cuota global → 4 KpiM (activos, en riesgo, nuevos del año, cuota de clientes) → chips de canal + buscador →
// ListaAgrupada por canal (meta = YTD del canal · nº de clientes), cada Fila con nombre, «YTD $X · ±Y % vs año anterior»,
// mini trazo de 6 meses y pill de cuota. Tocar → AnalisisFicha.
// Datos (2 consultas): mv_analisis_cliente_mes (cliente × mes, 2 años, 7 columnas) + v_cuota_erp_mes del año.
// Cálculo puro en analisis/calculo.js (resumenLista · filtrarLista) sobre el motor de la web (analisis/calc.js).
import React, { useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { canalLabel } from '../../modules/general/inicio/config';
import { puedeVerCliente } from '../../lib/permisos';
import { useNav } from '../nav';
import { TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Skeleton, Vacio, CampoBusqueda, Segmented, SelectorPeriodoM, BarraCuotaM, MiniTrazo } from '../piezas';
import { PROPIOS, nombreCliente, colorCliente } from '../datos';
import { moneyCompact, deltaPct, tonoCuota, MESES } from '../util';
import { useListaAnalisis } from './analisis/datos';
import { resumenLista, filtrarLista, CANALES_CHIP } from './analisis/calculo';
import AnalisisFicha, { nombreBonito } from './AnalisisFicha';

const etiquetaDe = (c) => (PROPIOS.includes(c.key) ? nombreCliente(c.key) : nombreBonito(c.nombre));

/** Chips horizontales (Todos · Mayoreo · Distribuidor · Retail · E-commerce · Mostrador). */
function ChipsCanal({ value, onChange, disponibles }) {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 8px', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}>
      {CANALES_CHIP.filter((c) => !c.canales || !disponibles || c.canales.some((k) => disponibles.has(k))).map((c) => (
        <button key={c.id} type="button" onClick={() => onChange(c.id)}
          style={{ flexShrink: 0, border: 0, borderRadius: 999, padding: '6px 12px', fontFamily: TYPO.fontText, fontSize: 12.5, fontWeight: 500, cursor: 'pointer', background: value === c.id ? theme.accent : `${theme.text}12`, color: value === c.id ? (theme.textOnDark || '#FFF') : theme.text }}>{c.label}</button>
      ))}
    </div>
  );
}

/** Vista pura de la lista (sin red): la prueba scripts/test-analisis-movil-ssr.mjs. */
export function ListaVista({ r, anio, mes, modo, chip, q, onChip, onQ, onAbrir, periodoLbl }) {
  const { theme } = useTheme();
  const k = r.kpis;
  const grupos = useMemo(() => filtrarLista(r.canales, chip, q, canalLabel), [r.canales, chip, q]);
  const disponibles = useMemo(() => new Set(r.canales.map((g) => g.id)), [r.canales]);
  const mesL = MESES[mes - 1];
  return (
    <>
      <HeroM eyebrow={`Dirección comercial · ${periodoLbl}`} frase={r.hero.frase}>
        <BarraCuotaM valor={r.hero.ventaConCuota} cuota={r.hero.cuota} label={modo === 'mes' ? `cuota de ${mesL.toLowerCase()}` : 'cuota a la fecha'} />
      </HeroM>
      <KpiGrid data-entrada-kpis style={{ marginTop: 12 }}>
        <KpiM eyebrow={modo === 'mes' ? `Activos en ${mesL.toLowerCase()}` : `Activos en ${anio}`} big={String(k.activos)} sub={`de ${k.conVentaAnio} con venta en ${anio}`} />
        <KpiM eyebrow="En riesgo" big={String(k.riesgo)} bigColor={k.riesgo ? theme.red : undefined} sub={`bajan más de 30 % vs ${anio - 1}`} />
        <KpiM eyebrow={`Nuevos ${anio}`} big={String(k.nuevos)} sub={k.nuevos ? `${moneyCompact(k.nuevosMonto)} acumulado` : 'ninguno con primera venta'} />
        <KpiM eyebrow="Cuota de clientes" big={k.pctCuotaYtd == null ? '—' : `${Math.round(k.pctCuotaYtd)}%`} bigColor={k.pctCuotaYtd == null ? undefined : k.pctCuotaYtd >= 100 ? theme.green : k.pctCuotaYtd < 85 ? theme.orange : undefined} sub={k.conCuota ? `YTD · ${k.logran} de ${k.conCuota} con cuota la logran` : 'sin cuotas cargadas'} />
      </KpiGrid>
      <div style={{ padding: '16px 16px 8px' }}><CampoBusqueda value={q} onChange={onQ} placeholder="Cliente o canal" /></div>
      <ChipsCanal value={chip} onChange={onChip} disponibles={disponibles} />
      {grupos.length === 0 && <Vacio icon={null} titulo="Sin coincidencias" sub="Prueba con otro nombre o canal." />}
      {grupos.map((g) => (
        <ListaAgrupada key={g.id} titulo={canalLabel(g.id)} meta={`${moneyCompact(g.ytd)} YTD · ${g.n}`} style={{ marginTop: 14 }}>
          {g.clientes.map((c) => {
            const v = modo === 'mes' ? c.cur : c.ytd, yoy = modo === 'mes' ? c.yoy : c.yoyYtd, pct = modo === 'mes' ? c.pctCuota : c.pctCuotaYtd;
            const tono = yoy == null ? theme.textMuted : yoy >= 0 ? theme.green : theme.red;
            return (
              <Fila key={c.cliente} tono={c.propio ? colorCliente(c.key, theme) : undefined} chevron={false} onClick={() => onAbrir(c)}
                titulo={<span>{c.label}{c.nuevo ? <span style={{ fontSize: 10, color: theme.accent, marginLeft: 6, fontFamily: TYPO.fontDisplay, fontWeight: 600, letterSpacing: '0.04em' }}>NUEVO</span> : null}</span>}
                sub={<span>{modo === 'mes' ? `${mesL} ${moneyCompact(v)}` : `YTD ${moneyCompact(v)}`}{yoy != null ? <> · <span style={{ color: tono }}>{deltaPct(yoy)}</span> vs {anio - 1}</> : v > 0 ? ' · sin venta el año pasado' : ' · sin compra'}{modo === 'mes' && c.ytd ? ` · YTD ${moneyCompact(c.ytd)}` : ''}</span>}
                trailing={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 10, flexShrink: 0 }}><MiniTrazo puntos={c.trazo6} color={tono} />{pct != null ? <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, padding: '2px 7px', borderRadius: 999, background: `${theme.text}0D`, color: pct >= 100 ? theme.green : pct >= 85 ? theme.accent : theme.orange, whiteSpace: 'nowrap', minWidth: 54, textAlign: 'center' }} data-tono={tonoCuota(pct)}>{Math.round(pct)}% cuota</span> : <span style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, minWidth: 54, textAlign: 'center' }}>sin cuota</span>}</span>} />
            );
          })}
        </ListaAgrupada>
      ))}
      <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, padding: '8px 28px 0', lineHeight: 1.4 }}>Fact. neta del ERP por cliente · trazo = últimos 6 meses · % vs el año anterior a mismo día · cuota de RevkoBi. Toca un cliente para su página.</div>
    </>
  );
}

export default function AnalisisClientes() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioHoy = hoy.getFullYear(), mesHoy = hoy.getMonth() + 1;
  const [anio, setAnio] = useState(anioHoy);
  const [mes, setMes] = useState(mesHoy);
  const [modo, setModo] = useState('mes');
  const [chip, setChip] = useState('todos');
  const [q, setQ] = useState('');
  const { data, isLoading, error } = useListaAnalisis(anio);
  const perfil = nav.perfil;
  const externo = perfil?.tipo === 'externo' && !perfil?.es_super_admin;
  const r = useMemo(() => (data ? resumenLista({ ...data, anio, mes, modo, hoy, etiqueta: etiquetaDe, filtro: externo ? (c) => PROPIOS.includes(c.key) && puedeVerCliente(perfil, c.key) : null }) : null), [data, anio, mes, modo, hoy, externo, perfil]);

  const periodoLbl = modo === 'mes' ? `${MESES[mes - 1]} ${anio}` : `${anio} a ${MESES[mes - 1].toLowerCase()}`;
  const abrir = (c) => nav.push(<AnalisisFicha codigo={c.cliente} clienteNombre={c.nombre} canal={c.canal} label={c.label} />, `analisis-${c.cliente}`);
  const derecha = (
    <>
      <Segmented value={modo} onChange={setModo} options={[{ id: 'mes', label: 'Mes' }, { id: 'ytd', label: 'YTD' }]} />
      <SelectorPeriodoM anio={anio} mes={mes} anioHoy={anioHoy} mesHoy={mesHoy} conAnio={false} onChange={(a, m) => { setAnio(a); setMes(m); }} />
    </>
  );

  return (
    <div data-stagger>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Análisis por cliente" sub={r ? `${periodoLbl} · ${r.kpis.activos} clientes con venta` : periodoLbl} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 16px 12px' }}>{derecha}</div>
      {error && <Vacio icon={AlertTriangle} titulo="No se pudieron cargar los clientes" sub={error.message} color={theme.red} />}
      {(isLoading || !r) && !error && (
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Skeleton h={150} r={12} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /><Skeleton h={84} r={12} /></div>
          <Skeleton h={320} r={12} />
        </div>
      )}
      {r && <ListaVista r={r} anio={anio} mes={mes} modo={modo} chip={chip} q={q} onChip={setChip} onQ={setQ} onAbrir={abrir} periodoLbl={periodoLbl} />}
    </div>
  );
}
