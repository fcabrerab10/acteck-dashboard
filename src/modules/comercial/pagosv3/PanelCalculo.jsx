// Panel "Cálculo" · lo que el motor calcula solo, antes de convertirse en pago:
// rebates por cliente con proyección al cierre, barra de niveles (PCEL), SPIFFs,
// y la dinámica de vendedores de Dicotech con su editor de meta y premios.
import React, { useMemo, useState } from 'react';
import { Plus, Share2, Lock, Unlock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Boton, Pill, Segmented, TablaCompacta, toast } from '../../../components/kit';
import M from './motor';
import { reglaDe, CLIENTE_LABEL } from './reglas';
import { mxn, mxnCorto, pctTxt, MONO, Nota, CampoInline, Entrada, ClientePill } from './ui';

const MESES_CORTOS = M.MESES_CORTOS;

export default function PanelCalculo({
  clientes, reglas, datosMotor, anio, mes, dinamica, puedeEditar,
  onCrearPago, onGuardarDinamica, pagos,
}) {
  const { theme } = useTheme();
  const [mesSel, setMesSel] = useState(mes);
  const per = M.periodoMes(anio, mesSel);
  const q = M.qDeMes(mesSel);

  const opcionesMes = useMemo(() => {
    const arr = [];
    for (let m = Math.max(1, mes - 2); m <= mes; m++) arr.push({ id: String(m), label: `${MESES_CORTOS[m - 1]}` });
    return arr;
  }, [mes]);

  const clavesExistentes = useMemo(() => new Set(pagos.map((p) => p.clave_calculo).filter(Boolean)), [pagos]);

  const bloques = clientes.map((cliente) => {
    const rReb = reglaDe(reglas, cliente, 'rebate');
    const rSpiff = reglaDe(reglas, cliente, 'spiff');
    const sellIn = datosMotor.sellInMes?.[cliente]?.[per] || 0;
    const cuota = datosMotor.cuotaMes?.[cliente]?.[per] || 0;
    const sellOut = datosMotor.sellOutMes?.[cliente]?.[per] || 0;

    let rebate = null;
    if (rReb?.frecuencia === 'mensual') {
      rebate = M.rebateMensual({ cliente, anio, mes: mesSel, sellIn, cuota, regla: rReb });
    } else if (rReb?.frecuencia === 'trimestral' && rReb.modo === 'niveles') {
      const ms = M.mesesDeQ(q);
      const siQ = ms.reduce((s, m) => s + (datosMotor.sellInMes?.[cliente]?.[M.periodoMes(anio, m)] || 0), 0);
      const cuQ = ms.reduce((s, m) => s + (datosMotor.cuotaMes?.[cliente]?.[M.periodoMes(anio, m)] || 0), 0);
      rebate = M.rebateTrimestralNiveles({ cliente, anio, q, sellInQ: siQ, cuotaQ: cuQ, regla: rReb });
    } else if (rReb?.frecuencia === 'trimestral') {
      rebate = M.rebateTrimestralCategorias({ cliente, anio, q, porCategoria: datosMotor.sellInQCategorias?.[cliente]?.[M.periodoQ(anio, q)], regla: rReb });
    }

    const spiff = rSpiff?.base === 'sell_out'
      ? M.spiffSellOut({ cliente, anio, mes: mesSel, sellOut, cuotaSellIn: cuota, regla: rSpiff })
      : (rSpiff ? M.spiffSellIn({ cliente, anio, mes: mesSel, sellIn, cuota, regla: rSpiff }) : null);

    return { cliente, rebate, spiff, rReb, sellIn, cuota, sellOut };
  });

  return (
    <Panel titulo="Cálculo" meta="lo que el motor calcula solo · entra al flujo como pago calculado"
           acciones={<Segmented size="sm" options={opcionesMes} value={String(mesSel)} onChange={(v) => setMesSel(Number(v))} />}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 10 }}>
        {bloques.map((b) => (
          <BloqueCliente key={b.cliente} {...b} anio={anio} mes={mesSel} q={q}
                         puedeEditar={puedeEditar(b.cliente)} onCrearPago={onCrearPago}
                         yaExiste={(clave) => clavesExistentes.has(clave)} />
        ))}
      </div>

      {clientes.includes('dicotech') && (
        <DinamicaVendedores
          anio={anio} mes={mesSel} reglas={reglas} datosMotor={datosMotor} dinamica={dinamica}
          puedeEditar={puedeEditar('dicotech')} onCrearPago={onCrearPago} onGuardar={onGuardarDinamica}
          yaExiste={(clave) => clavesExistentes.has(clave)}
        />
      )}
    </Panel>
  );
}

function BloqueCliente({ cliente, rebate, spiff, rReb, sellIn, cuota, anio, mes, q, puedeEditar, onCrearPago, yaExiste }) {
  const { theme } = useTheme();
  const hair = `1px solid ${theme.border}`;
  const hoy = new Date();
  const diasMes = new Date(anio, mes, 0).getDate();
  const diaHoy = (hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes) ? hoy.getDate() : diasMes;
  const factorProy = diaHoy > 0 ? diasMes / diaHoy : 1;

  const linea = (p, etiqueta) => {
    if (!p) return null;
    const existe = yaExiste(p.clave);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 6, borderTop: hair }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'baseline' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>{etiqueta}</span>
          <span style={{ ...MONO, fontSize: 13, color: p.aplica ? theme.text : theme.textMuted }}>{mxn(p.monto)}</span>
        </div>
        <div style={{ fontSize: 10.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>
          {p.detalle.base != null && `Base ${mxnCorto(p.detalle.base)}`}
          {p.detalle.pct != null && ` × ${(p.detalle.pct * 100).toFixed(2)} %`}
          {p.detalle.alcance != null && ` · alcance ${pctTxt(p.detalle.alcance)}`}
          {p.detalle.nivel && ` · ${p.detalle.nivel}`}
        </div>
        {!p.aplica && p.motivo && <Nota style={{ color: theme.orange }}>{p.motivo}</Nota>}
        {p.aplica && factorProy > 1.02 && (
          <Nota>Proyección al cierre del mes: {mxn(p.monto * factorProy)}</Nota>
        )}
        {p.detalle.niveles?.length > 0 && <BarraNiveles niveles={p.detalle.niveles} alcance={p.detalle.alcance} />}
        <div>
          {existe
            ? <Pill tone="green" size="xs">Pago ya creado</Pill>
            : (puedeEditar && p.aplica
                ? <Boton icon={Plus} onClick={() => onCrearPago?.(p)}>Crear pago</Boton>
                : <Pill tone="gray" size="xs">{p.aplica ? 'Sin permiso de edición' : 'Sin pago'}</Pill>)}
        </div>
      </div>
    );
  };

  const etiquetaRebate = rReb?.frecuencia === 'mensual'
    ? `Rebate ${MESES_CORTOS[mes - 1]}`
    : `Rebate Q${q}`;

  return (
    <div style={{ border: hair, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <ClientePill clienteKey={cliente} />
        <span style={{ fontSize: 10.5, color: theme.textMuted, ...MONO }}>
          Sell in {mxnCorto(sellIn)}{cuota > 0 ? ` / cuota ${mxnCorto(cuota)}` : ''}
        </span>
      </div>
      {rReb?.nombre_oficial && <Nota>{rReb.nombre_oficial}</Nota>}
      {linea(rebate, etiquetaRebate)}
      {linea(spiff, spiff?.detalle?.cuota_sell_out != null ? `SPIFF sell out ${MESES_CORTOS[mes - 1]}` : `SPIFF ${MESES_CORTOS[mes - 1]}`)}
    </div>
  );
}

function BarraNiveles({ niveles, alcance }) {
  const { theme } = useTheme();
  const orden = (niveles || []).slice().sort((a, b) => Number(a.min_alcance) - Number(b.min_alcance));
  const max = Math.max(Number(orden[orden.length - 1]?.min_alcance) * 1.2 || 1.5, Number(alcance) || 0);
  return (
    <div style={{ marginTop: 2 }}>
      <div style={{ position: 'relative', height: 6, borderRadius: 999, background: `${theme.text}12`, overflow: 'visible' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, ((alcance || 0) / max) * 100)}%`, background: theme.accent || '#007AFF', borderRadius: 999 }} />
        {orden.map((n) => (
          <span key={n.min_alcance} title={`${n.label || ''} · ${(n.pct * 100).toFixed(2)} %`}
                style={{ position: 'absolute', left: `${Math.min(100, (Number(n.min_alcance) / max) * 100)}%`, top: -2, width: 1.5, height: 10, background: theme.textMuted, opacity: 0.6 }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 3 }}>
        {orden.map((n) => (
          <span key={n.min_alcance} style={{ fontSize: 9.5, color: theme.textMuted, ...MONO }}>
            {pctTxt(n.min_alcance)} → {(n.pct * 100).toFixed(2).replace(/0$/, '')} %
          </span>
        ))}
      </div>
    </div>
  );
}

function DinamicaVendedores({ anio, mes, reglas, datosMotor, dinamica, puedeEditar, onCrearPago, onGuardar, yaExiste }) {
  const { theme } = useTheme();
  const per = M.periodoMes(anio, mes);
  const cfgDB = (dinamica || []).find((d) => d.anio === anio && d.mes === mes);
  const [editando, setEditando] = useState(false);
  const [meta, setMeta] = useState(String(cfgDB?.meta ?? ''));
  const [premios, setPremios] = useState(() => {
    const base = cfgDB?.premios || [];
    return Array.from({ length: 5 }, (_, i) => {
      const p = base.find((x) => Number(x.pos) === i + 1) || {};
      return { pos: i + 1, premio: p.premio || '', monto: p.monto ?? '' };
    });
  });
  React.useEffect(() => {
    setMeta(String(cfgDB?.meta ?? ''));
    const base = cfgDB?.premios || [];
    setPremios(Array.from({ length: 5 }, (_, i) => {
      const p = base.find((x) => Number(x.pos) === i + 1) || {};
      return { pos: i + 1, premio: p.premio || '', monto: p.monto ?? '' };
    }));
  }, [cfgDB?.id, anio, mes]);

  const vendedores = datosMotor.vendedoresDicotech?.[per] || [];
  const calc = M.dinamicaVendedores({
    anio, mes, vendedores,
    meta: Number(meta) || 0,
    premios: premios.map((p) => ({ pos: p.pos, premio: p.premio, monto: Number(p.monto) || 0 })),
    regla: reglaDe(reglas, 'dicotech', 'dinamica'),
  });
  const existe = yaExiste(calc.clave);

  const compartir = async () => {
    const lineas = calc.detalle.ganadores.map((g) => `${g.posicion}º ${g.nombre} — ${mxn(g.importe)}${g.premio ? ` · ${g.premio}` : ''}`);
    const texto = `Dinámica de vendedores · ${M.MESES_LARGOS[mes - 1]} ${anio}\nMeta del mes: ${mxn(Number(meta) || 0)} sin IVA\n\n${lineas.join('\n')}\n\n${calc.detalle.participantes} vendedores alcanzaron la meta.`;
    try { await navigator.clipboard.writeText(texto); toast.ok('Ranking copiado'); }
    catch { toast.error('No se pudo copiar'); }
  };

  const guardar = async () => {
    await onGuardar?.({ anio, mes, meta: Number(meta) || 0, premios: premios.filter((p) => p.premio || p.monto).map((p) => ({ pos: p.pos, premio: p.premio, monto: Number(p.monto) || 0 })) });
    setEditando(false);
  };

  const columnas = [
    { key: 'posicion', label: '#', align: 'center', width: 34 },
    { key: 'nombre', label: 'Vendedor', align: 'left' },
    { key: 'importe', label: 'Venta sin IVA', render: (r) => mxn(r.importe) },
    { key: 'premio', label: 'Premio', align: 'left', render: (r) => r.premio || '—' },
    { key: 'monto', label: 'Monto', render: (r) => (r.monto ? mxn(r.monto) : '—') },
  ];

  return (
    <div style={{ marginTop: 10, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
        <div>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>Dinámica de vendedores · Dicotech · {M.MESES_LARGOS[mes - 1]}</div>
          <Nota>
            meta del mes {mxn(Number(meta) || 0)} sin IVA · {calc.detalle.participantes} de {calc.detalle.total_vendedores} vendedores la alcanzaron
            {calc.detalle.sin_premio > 0 ? ` · ${calc.detalle.sin_premio} sin premio` : ''}
          </Nota>
        </div>
        <span style={{ display: 'inline-flex', gap: 6, flexWrap: 'wrap' }}>
          {puedeEditar && <Boton icon={editando ? Unlock : Lock} onClick={() => setEditando((v) => !v)}>{editando ? 'Cerrar editor' : 'Editar meta y premios'}</Boton>}
          <Boton icon={Share2} onClick={compartir}>Compartir ranking</Boton>
          {existe
            ? <Pill tone="green" size="xs">Pago ya creado</Pill>
            : (puedeEditar && calc.aplica && <Boton primario icon={Plus} onClick={() => onCrearPago?.(calc)}>Crear pago de premios</Boton>)}
        </span>
      </div>

      {editando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, borderRadius: 10, background: theme.surfaceHover || 'transparent', marginBottom: 8 }}>
          <CampoInline label="Meta del mes (sin IVA)" ancho={180}>
            <Entrada type="number" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="110000" />
          </CampoInline>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 8 }}>
            {premios.map((p, i) => (
              <div key={p.pos} style={{ display: 'flex', gap: 6 }}>
                <CampoInline label={`${p.pos}º premio`}>
                  <Entrada value={p.premio} onChange={(e) => setPremios((ps) => ps.map((x, k) => k === i ? { ...x, premio: e.target.value } : x))} placeholder="Tarjeta Amazon $2,500" />
                </CampoInline>
                <CampoInline label="Monto" ancho={90}>
                  <Entrada type="number" value={p.monto} onChange={(e) => setPremios((ps) => ps.map((x, k) => k === i ? { ...x, monto: e.target.value } : x))} />
                </CampoInline>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Boton primario onClick={guardar}>Guardar meta y premios</Boton></div>
        </div>
      )}

      {calc.detalle.ganadores.length > 0
        ? <TablaCompacta columnas={columnas} filas={calc.detalle.ganadores} rowKey={(r) => r.posicion} dense />
        : <Nota>{calc.motivo || 'Sin vendedores que alcancen la meta este mes.'}</Nota>}
      <Nota style={{ marginTop: 6 }}>El ranking sale del sell out del puente (mes cerrado, sin IVA) — vista v_sellout_general_dicotech.</Nota>
    </div>
  );
}
