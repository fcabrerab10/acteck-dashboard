// Sell Out consolidado de la empresa en el celular (página global `sellOut`, clienteKey == null).
//
//   1. Hero del mes: sell out sin IVA, YoY a mismo día, YTD, sell out / sell in e inventario en clientes.
//      Selector de mes, filtro de canal (Todos · Mayoreo · Distribuidores · Directo), FrescuraPill
//      detallado y "Compartir resumen del mes" con el MISMO texto de la web (textoResumenMes).
//   2. 4 KPIs: inventario en clientes · clientes finales · vendedores · sin estado.
//   3. Evolución de 12 meses (GraficaLineas compacto): sell out total + sell in punteado.
//   4. Composición del mes por canal · marca · categoría.
//   5. Lista de cuentas agrupada por canal; tocar una abre Cuenta.jsx (push).
//
// Todo el cálculo es el de la web: src/modules/comercial/sellout/calculo.js (puro, sin layout)
// y los mismos hooks de src/modules/comercial/sellout/datos.js (MVs agregadas en Postgres).
// El mapa de México NO se importa aquí: en el celular los estados van como lista.
// NADA sensible: ni costo, ni margen, ni contribución.
import React, { useEffect, useMemo, useState } from 'react';
import { Share2, Copy, AlertTriangle } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando, GraficaLineas } from '../../../components/kit';
import FrescuraPill from '../../../components/FrescuraPill';
import { compartir, copiar } from '../../../lib/whatsapp';
import { useNav } from '../../nav';
import {
  TituloGrande, HeroM, KpiM, KpiGrid, ListaAgrupada, Fila, Cabecera, Vacio, HojaM, BotonGrande, Segmented, toast,
} from '../../piezas';
import { moneyCompact, int, deltaPct, tonoDelta, MESES, MESES_LARGO, MONO, N } from '../../util';
import { SelectorMes } from '../SellInCliente';
import { useCuentas, useDias, useMensual, useSkuMes } from '../../../modules/comercial/sellout/datos';
import {
  CANALES, canalLabel, construirFilas, totalesDeFilas, porCanal, composicion, serie12,
  ultimoDiaConVenta, ultimoMesConVenta,
} from '../../../modules/comercial/sellout/calculo';
import { fraseHero, textoResumenMes, fmtMoney, fmtInt, fmtPct } from '../../../modules/comercial/sellout/textos';
import { PillHero, Composicion, Fuente, PillSinFuente } from './piezas';
import Cuenta from './Cuenta';

const CANAL_OPC = [{ id: 'todos', label: 'Todos' }, ...CANALES.map((c) => ({ id: c.id, label: c.label }))];
const DIMENSIONES = [{ id: 'canal', label: 'Canal' }, { id: 'marca', label: 'Marca' }, { id: 'categoria', label: 'Categoría' }];

export default function SellOutGlobal() {
  const { theme } = useTheme();
  const nav = useNav();
  const hoy = useMemo(() => new Date(), []);
  const anioActual = hoy.getFullYear(), mesActual = hoy.getMonth() + 1;

  const [sel, setSel] = useState({ anio: anioActual, mes: mesActual });
  const [mesTocado, setMesTocado] = useState(false);
  const [canalSel, setCanalSel] = useState('todos');
  const [dimension, setDimension] = useState('canal');
  const [compartiendo, setCompartiendo] = useState(false);

  const { data: cuentas = [], isLoading: lCuentas, error: eCuentas } = useCuentas();
  const { data: dias = [], isLoading: lDias, error: eDias } = useDias(sel.anio);
  const { data: mensual = [], isLoading: lMes } = useMensual(sel.anio);
  const { data: skuMes = [] } = useSkuMes(sel.anio, sel.mes);

  // Mes por defecto = el último con venta (casi siempre el mes en curso, pero el puente
  // puede ir un día atrás y entonces el mes en curso arrancaría vacío).
  useEffect(() => {
    if (mesTocado || !dias.length) return;
    const u = ultimoMesConVenta(dias);
    if (u && (u.anio !== sel.anio || u.mes !== sel.mes)) setSel({ anio: u.anio, mes: u.mes });
  }, [dias]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargando = lCuentas || lDias || lMes;
  const error = eCuentas || eDias;

  const r = useMemo(() => {
    if (!cuentas.length) return null;
    const { anio, mes } = sel;
    const corteDia = ultimoDiaConVenta(dias, anio, mes) || 31;
    const filasBase = construirFilas({ cuentas, mensual, dias, anio, mes, corteDia });
    const filas = canalSel === 'todos' ? filasBase : filasBase.filter((f) => f.canal === canalSel);
    const tot = totalesDeFilas(filas);
    const totGlobal = totalesDeFilas(filasBase);
    const canales = porCanal(filasBase);
    const cuentasSel = canalSel === 'todos' ? null : new Set(filas.map((f) => f.cuenta));
    const serie = serie12(mensual, anio, mes, cuentasSel);

    const comp = dimension === 'canal'
      ? porCanal(filas).map((c) => ({ id: c.id, label: c.label, importe: c.importe, pct: c.pct }))
      : composicion(skuMes.filter((x) => N(x.anio) === anio && N(x.mes) === mes), dimension, cuentasSel, 8);

    // Cuentas por canal para la lista (sólo las que tienen algo que enseñar en el mes o en el año).
    const grupos = CANALES
      .map((c) => ({
        ...c,
        filas: filas.filter((f) => f.canal === c.id && (f.importe > 0 || f.ytd > 0 || f.sinFuente))
          .sort((a, b) => (b.importe - a.importe) || N(b.sellIn) - N(a.sellIn)),
      }))
      .filter((g) => g.filas.length);

    const activas = filasBase.filter((f) => f.importe > 0).length;
    const conFuente = filasBase.filter((f) => !f.sinFuente).length;
    const conInv = filasBase.filter((f) => f.invValor != null);
    const disponibles = new Set();
    for (const d of dias) if (N(d.importe) > 0) disponibles.add(`${N(d.anio)}-${N(d.mes)}`);

    return {
      anio, mes, corteDia, filasBase, filas, tot, totGlobal, canales, serie, comp, grupos,
      activas, conFuente, conInv, disponibles,
      enCurso: anio === anioActual && mes === mesActual,
    };
  }, [cuentas, mensual, dias, skuMes, sel, canalSel, dimension, anioActual, mesActual]);

  const textoCompartir = useMemo(() => (r ? textoResumenMes({
    anio: r.anio, mes: r.mes, tot: r.totGlobal, canales: r.canales,
    top: [...r.filasBase].sort((a, b) => b.importe - a.importe),
    corteDia: r.corteDia < 28 ? r.corteDia : null,
    cuentasActivas: r.activas, cuentasTotal: r.conFuente,
  }) : ''), [r]);

  const onCompartir = async () => { if (await compartir(textoCompartir, { titulo: `Sell Out ${MESES_LARGO[sel.mes - 1]} ${sel.anio}` }) === 'share') toast.ok('Compartido'); };
  const onCopiar = async () => { if (await copiar(textoCompartir)) toast.ok('Resumen copiado'); else toast.error('No se pudo copiar'); };

  const sub = <><span>Todas las cuentas · sin IVA</span><span>·</span><FrescuraPill pantalla="sellOutGlobal" detallado etiquetas={{ sellout_general: 'Puente', sellout_pcel: 'PCEL', inventario_cliente: 'Inv. clientes' }} /></>;

  if (error) {
    return (<><Cabecera onVolver={nav.pop} /><TituloGrande titulo="Sell Out" sub={sub} />
      <Vacio icon={AlertTriangle} color={theme.red} titulo="No se pudo cargar el Sell Out" sub={error.message} /></>);
  }

  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Sell Out" sub={sub}
        derecha={<SelectorMes valor={sel} onChange={(v) => { setSel(v); setMesTocado(true); }} anioActual={anioActual} mesActual={mesActual} disponibles={r?.disponibles} />} />

      {(cargando || !r) && <div style={{ padding: '0 16px' }}><Cargando pantalla="movilSellOutGlobal" /></div>}

      {r && !cargando && (
        <>
          <HeroM
            eyebrow={`Consolidado · ${MESES[r.mes - 1]} ${r.anio}${r.corteDia < 28 ? ` · al día ${r.corteDia}` : ''}`}
            frase={fraseHero(r.totGlobal, r.anio, r.mes, r.activas, r.conFuente)}
            sub={`${r.activas} de ${r.conFuente} cuentas con venta · ${fmtInt(r.totGlobal.cantidad)} pz${r.totGlobal.conInventario ? ` · inventario en clientes ${fmtMoney(r.totGlobal.invValor)}` : ''}`}
            stats={[
              { k: `Sell out ${MESES[r.mes - 1]}`, v: moneyCompact(r.tot.importe), sub: canalSel === 'todos' ? `${fmtInt(r.tot.cantidad)} pz` : canalLabel(canalSel) },
              { k: `YTD ${r.anio}`, v: moneyCompact(r.tot.ytd), sub: r.tot.yoyYtd == null ? `sin ${r.anio - 1}` : `${deltaPct(r.tot.yoyYtd)} vs ${r.anio - 1}` },
              { k: `vs ${r.anio - 1}`, v: r.tot.yoy == null ? '—' : deltaPct(r.tot.yoy), sub: 'a mismo día', color: r.tot.yoy == null ? undefined : r.tot.yoy >= 0 ? theme.green : theme.red },
            ]}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, flexWrap: 'wrap' }}>
              {CANAL_OPC.map((c) => (
                <PillHero key={c.id} on={canalSel === c.id} onClick={() => setCanalSel(c.id)} theme={theme}>{c.label}</PillHero>
              ))}
              <PillHero onClick={() => setCompartiendo(true)} theme={theme} style={{ marginLeft: 'auto' }}><Share2 size={12} strokeWidth={2.4} />Compartir</PillHero>
            </div>
          </HeroM>

          <KpiGrid style={{ marginTop: 12 }}>
            <KpiM eyebrow="Inventario en clientes" big={r.tot.conInventario ? moneyCompact(r.tot.invValor) : '—'}
              sub={r.tot.conInventario ? `${fmtInt(r.tot.invPiezas)} pz · ${r.tot.conInventario} clientes` : 'ningún cliente reporta'}
              pill={r.tot.soSi != null ? { tone: r.tot.soSi < 60 ? 'orange' : 'green', label: `SO/SI ${fmtPct(r.tot.soSi)}` } : undefined} />
            <KpiM eyebrow={`Clientes finales · ${MESES[r.mes - 1]}`} big={fmtInt(r.tot.clientesFinales)}
              sub={`${fmtInt(sumar(r.filas, 'cfNuevos'))} nuevos · ${fmtInt(sumar(r.filas, 'cfPerdidos'))} perdidos`} />
            <KpiM eyebrow="Vendedores activos" big={fmtInt(r.tot.vendedores)}
              sub={`${fmtInt(sumar(r.filas, 'vendRecurrentes'))} venden los últimos 3 m`} />
            <KpiM eyebrow="Sin estado" big={r.tot.sinEstado ? moneyCompact(r.tot.sinEstado) : '—'}
              bigColor={r.tot.pctSinEstado > 25 ? theme.orange : undefined}
              sub={r.tot.pctSinEstado == null ? 'el mayoreo reporta estado' : `${fmtPct(r.tot.pctSinEstado)} del mayoreo`} />
          </KpiGrid>

          <div style={{ padding: '18px 16px 0' }}>
            <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px' }}>
              <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 6 }}>
                Evolución 12 meses · sell out y sell in
              </div>
              <GraficaLineas compacto alto={170} formato={moneyCompact}
                datos={r.serie.map((d) => ({ x: d.x, total: d.total, sellIn: d.sellIn || null }))}
                series={[{ key: 'total', label: 'Sell out', tipo: 'principal' }, { key: 'sellIn', label: 'Sell in', tipo: 'anterior' }]} />
            </div>
          </div>

          <div style={{ padding: '18px 16px 0' }}>
            <Segmented value={dimension} onChange={setDimension} options={DIMENSIONES} />
          </div>
          <Composicion filas={r.comp} titulo={`Composición · ${MESES[r.mes - 1]}`} style={{ marginTop: 10 }}
            pie={dimension === 'canal'
              ? 'Reparto del sell out del mes por canal (montos sin IVA).'
              : `${dimension === 'marca' ? 'Marca' : 'Categoría'} del catálogo · % del sell out del mes; las que no caben van en "Otros".`} />

          {r.grupos.map((g) => (
            <ListaAgrupada key={g.id} titulo={g.label} meta={`${g.filas.length}`} style={{ marginTop: 18 }}
              pie={g.id === 'mayoreo' ? 'Monto del mes a mismo día que el año pasado · pastilla = YoY · línea = 6 meses. Toca una cuenta para abrirla.' : undefined}>
              {g.filas.map((f) => (
                <Fila key={f.cuenta}
                  titulo={f.nombre}
                  sub={[
                    f.erp ? `Nº ${f.erp}` : null,
                    f.sinFuente ? `sólo sell in ${moneyCompact(f.sellIn)}` : null,
                    !f.sinFuente && f.invValor != null ? `inv ${moneyCompact(f.invValor)}${f.invSemanas != null ? ` · ${f.invSemanas.toFixed(1)} sem` : ''}` : null,
                  ].filter(Boolean).join(' · ') || undefined}
                  valor={f.sinFuente ? '—' : moneyCompact(f.importe)}
                  valorSub={f.sinFuente ? undefined : `${int(f.cantidad)} pz`}
                  pill={f.sinFuente ? undefined : { tone: tonoDelta(f.yoy), label: f.yoy != null ? deltaPct(f.yoy) : 'nuevo' }}
                  trailing={f.sinFuente ? <PillSinFuente /> : (
                    <div style={{ width: 56, height: 26 }}>
                      <GraficaLineas mini alto={26} datos={f.tendencia.map((v, i) => ({ x: String(i), v: Number(v) || 0 }))}
                        series={[{ key: 'v', label: 'Mes', tipo: 'principal' }]} />
                    </div>
                  )}
                  chevron={!f.sinFuente}
                  onClick={f.sinFuente ? undefined : () => nav.push(<Cuenta fila={f} anio={r.anio} mes={r.mes} corteDia={r.corteDia} />, `sellout-cuenta-${f.cuenta}`)}
                  style={{ gap: 8 }} />
              ))}
            </ListaAgrupada>
          ))}

          <Fuente>
            Sell out sin IVA de <span style={{ fontFamily: MONO }}>mv_sellout_cuenta_dia</span> y{' '}
            <span style={{ fontFamily: MONO }}>v_sellout_cuenta_mes</span> (año en curso y anterior) · sell in = Fact Neta del
            código de cliente en el ERP. Las cuentas marcadas «sin fuente» facturan pero no reportan sell out a nadie.
          </Fuente>

          <div style={{ padding: '18px 16px 0' }}>
            <BotonGrande primario icon={Share2} disabled={!r.totGlobal.importe} onClick={() => setCompartiendo(true)}>Compartir resumen del mes</BotonGrande>
          </div>
        </>
      )}

      <HojaM abierto={compartiendo} onClose={() => setCompartiendo(false)} titulo="Resumen del mes" sub={`${MESES_LARGO[sel.mes - 1]} ${sel.anio} · sin márgenes ni costos`} alto="76vh">
        <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 12, lineHeight: 1.5, color: theme.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{textoCompartir}</pre>
          <BotonGrande primario icon={Share2} onClick={onCompartir}>Compartir por WhatsApp</BotonGrande>
          <BotonGrande icon={Copy} onClick={onCopiar}>Copiar texto</BotonGrande>
        </div>
      </HojaM>
    </>
  );
}

const sumar = (filas, campo) => filas.reduce((s, f) => s + (f[campo] == null ? 0 : Number(f[campo])), 0);
