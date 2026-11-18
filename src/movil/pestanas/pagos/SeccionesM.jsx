// Pagos (celular) · secciones que ya existían en la web y faltaban aquí (2026-11-18, congruencia web ↔ celular):
//   Cálculo   — lo que el motor calcula solo (rebate y SPIFF del cliente elegido, dinámica de vendedores de Dicotech)
//               con «Crear pago» → entra al flujo como pago calculado (guardarPropuestas, igual que la web).
//   Marketing — actividades del mes: cada una «la paga la empresa» o «cargo a fondo» (cambiarCobroActividad) y el pago
//               de marketing del mes.
//   Reglas    — resumen de las reglas vigentes del cliente; se editan con la hoja del cliente propio (HojaReglasM).
//   ＋ Pago manual — HojaPagoManualM: mismos campos y la misma `crearPagoManual` de la web.
// El celular sólo pinta: cálculo en pagosv3/calculoPanel.js + motor.js, escrituras en pagosv3/datos.js.
// Este archivo se descarga al abrir una de esas secciones (lazy desde Pagos.jsx); Cálculo y Marketing piden además los
// datos del motor (useDatosPagos) sólo entonces.
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Calculator, Lock, SlidersHorizontal } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Cargando } from '../../../components/kit';
import { HojaM, ListaAgrupada, Fila, BotonGrande, Segmented, Pill, Vacio, toast } from '../../piezas';
import { money, moneyCompact, MONO, N } from '../../util';
import { ChipM, CampoM, lbl } from '../agenda5/comun';
import M from '../../../modules/comercial/pagosv3/motor';
import { CLIENTE_LABEL, SECCIONES, reglaDe, resumenReglas } from '../../../modules/comercial/pagosv3/reglas';
import { TIPOS_MANUALES, TIPO_META } from '../../../modules/comercial/pagosv3/estados';
import { useDatosPagos, guardarPropuestas, crearPagoManual, cambiarCobroActividad, traerApoyoProteccion, detallePagoManual } from '../../../modules/comercial/pagosv3/datos';
import { mesesCalculo, bloquesCalculo, factorProyeccion, explicaPropuesta, calculoDinamica, marketingDelPeriodo } from '../../../modules/comercial/pagosv3/calculoPanel';
import { SIL_MOVIL_PAGOS } from '../../../modules/comercial/pagosv3/siluetas';
import { HojaReglasM } from '../cliente/PagosPropio';

const pctTxt = (v) => `${Math.round(N(v) * 100)} %`;
const pct2 = (v) => `${(N(v) * 100).toFixed(2).replace(/\.?0+$/, '')} %`;
const avisar = (e) => toast.error(e?.message || String(e));
const CHIP_44 = { minHeight: 44, padding: '0 14px', fontSize: 13.5 }; // objetivo táctil

function Tarjeta({ children, style }) {
  const { theme } = useTheme();
  return <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 16, padding: 14, fontFamily: TYPO.fontText, color: theme.text, minWidth: 0, ...style }}>{children}</div>;
}
function Nota({ children, color, style }) {
  const { theme } = useTheme();
  return <div style={{ fontSize: 12, lineHeight: 1.4, color: color || theme.textMuted, ...style }}>{children}</div>;
}
/** Botón de 44 px. */
function BotonM({ children, onClick, primario, disabled, icon: Icon, style }) {
  const { theme } = useTheme();
  return (
    <button type="button" disabled={disabled} onClick={onClick} style={{ minHeight: 44, padding: '0 14px', borderRadius: 12, border: primario ? 0 : `1px solid ${theme.border}`, background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, ...style }}>
      {Icon && <Icon size={15} strokeWidth={2.4} />}{children}
    </button>
  );
}

// ───────────────────────── Cálculo ─────────────────────────
function BarraNiveles({ niveles, alcance }) {
  const { theme } = useTheme();
  const orden = (niveles || []).slice().sort((a, b) => N(a.min_alcance) - N(b.min_alcance));
  const max = Math.max(N(orden[orden.length - 1]?.min_alcance) * 1.2 || 1.5, N(alcance));
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ position: 'relative', height: 8, borderRadius: 999, background: `${theme.text}12` }}>
        <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${Math.min(100, (N(alcance) / max) * 100)}%`, background: theme.accent, borderRadius: 999 }} />
        {orden.map((n) => <span key={n.min_alcance} style={{ position: 'absolute', left: `${Math.min(100, (N(n.min_alcance) / max) * 100)}%`, top: -2, width: 2, height: 12, background: theme.textMuted, opacity: 0.6 }} />)}
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 5 }}>
        {orden.map((n) => <span key={n.min_alcance} style={{ fontSize: 11, color: theme.textMuted, fontFamily: MONO }}>{pctTxt(n.min_alcance)} → {pct2(n.pct)}</span>)}
      </div>
    </div>
  );
}

function LineaPropuesta({ p, etiqueta, factor, existe, puedeEditar, onCrearPago, ocupado }) {
  const { theme } = useTheme();
  if (!p) return null;
  const explica = explicaPropuesta(p, { dinero: moneyCompact, pct: pctTxt });
  return (
    <div style={{ paddingTop: 12, marginTop: 12, borderTop: `1px solid ${theme.border}` }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600 }}>{etiqueta}</span>
        <span style={{ fontFamily: TYPO.fontRounded, fontSize: 19, fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: p.aplica ? theme.text : theme.textMuted }}>{money(p.monto)}</span>
      </div>
      {explica && <Nota style={{ marginTop: 3 }}>{explica}</Nota>}
      {!p.aplica && p.motivo && <Nota color={theme.orange} style={{ marginTop: 3 }}>{p.motivo}</Nota>}
      {p.aplica && factor > 1.02 && <Nota style={{ marginTop: 3 }}>Proyección al cierre del mes: {money(p.monto * factor)}</Nota>}
      {p.detalle?.niveles?.length > 0 && <BarraNiveles niveles={p.detalle.niveles} alcance={p.detalle.alcance} />}
      <div style={{ marginTop: 10 }}>
        {existe
          ? <Pill tone="green">Pago ya creado</Pill>
          : (puedeEditar && p.aplica
            ? <BotonM primario icon={Plus} disabled={ocupado} onClick={() => onCrearPago?.(p)} style={{ width: '100%' }}>Crear pago</BotonM>
            : <Pill tone="gray">{p.aplica ? 'Sólo lectura' : 'Sin pago'}</Pill>)}
      </div>
    </div>
  );
}

/** Vista pura. `bloques` = bloquesCalculo(...) del cliente elegido; `dinamica` = calculoDinamica(...) o null. */
export function CalculoVista({ bloques = [], dinamica = null, anio, mes, meses = [], onMes, factor = 1, yaExiste = () => false, puedeEditar = () => false, onCrearPago, ocupado = false }) {
  const { theme } = useTheme();
  return (
    <div style={{ padding: '12px 16px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <Nota style={{ marginBottom: 8 }}>Lo que el motor calcula solo. «Crear pago» lo mete al flujo como pago calculado.</Nota>
        {meses.length > 1 && <Segmented size="md" style={{ display: 'flex', width: '100%' }} value={String(mes)} onChange={(v) => onMes?.(Number(v))} options={meses.map((m) => ({ id: String(m), label: M.MESES_CORTOS[m - 1] }))} />}
      </div>
      {bloques.map((b) => (
        <Tarjeta key={b.cliente}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600 }}>{CLIENTE_LABEL[b.cliente] || b.cliente}</span>
            <span style={{ fontSize: 12, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>Sell in {moneyCompact(b.sellIn)}{b.cuota > 0 ? ` de ${moneyCompact(b.cuota)}` : ''}</span>
          </div>
          {b.rReb?.nombre_oficial && <Nota style={{ marginTop: 3 }}>{b.rReb.nombre_oficial}</Nota>}
          <LineaPropuesta p={b.rebate} etiqueta={b.etiquetaRebate} factor={factor} existe={b.rebate ? yaExiste(b.rebate.clave) : false} puedeEditar={puedeEditar(b.cliente)} onCrearPago={onCrearPago} ocupado={ocupado} />
          <LineaPropuesta p={b.spiff} etiqueta={b.etiquetaSpiff} factor={factor} existe={b.spiff ? yaExiste(b.spiff.clave) : false} puedeEditar={puedeEditar(b.cliente)} onCrearPago={onCrearPago} ocupado={ocupado} />
          {!b.rebate && !b.spiff && <Nota style={{ marginTop: 8 }}>Sin reglas de rebate ni SPIFF para este cliente.</Nota>}
        </Tarjeta>
      ))}
      {dinamica && (
        <Tarjeta>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600 }}>Dinámica de vendedores · {M.MESES_LARGOS[mes - 1]}</div>
          <Nota style={{ marginTop: 3 }}>Meta del mes {money(dinamica.meta)} sin IVA · {dinamica.calc.detalle.participantes} de {dinamica.calc.detalle.total_vendedores} vendedores la alcanzaron</Nota>
          {dinamica.calc.detalle.ganadores.length > 0
            ? (
              <div style={{ marginTop: 8 }}>
                {dinamica.calc.detalle.ganadores.map((g) => (
                  <div key={g.posicion} style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 44, borderTop: `1px solid ${theme.border}` }}>
                    <b style={{ width: 22, fontFamily: TYPO.fontDisplay, fontSize: 14, color: theme.textMuted }}>{g.posicion}</b>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{g.nombre}</span>
                      <span style={{ fontSize: 12, color: theme.textMuted }}>{money(g.importe)}{g.premio ? ` · ${g.premio}` : ''}</span>
                    </span>
                    {g.monto ? <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600 }}>{money(g.monto)}</span> : null}
                  </div>
                ))}
              </div>
            )
            : <Nota style={{ marginTop: 8 }}>{dinamica.calc.motivo || 'Sin vendedores que alcancen la meta este mes.'}</Nota>}
          <div style={{ marginTop: 10 }}>
            {yaExiste(dinamica.calc.clave)
              ? <Pill tone="green">Pago ya creado</Pill>
              : (puedeEditar('dicotech') && dinamica.calc.aplica && <BotonM primario icon={Plus} disabled={ocupado} onClick={() => onCrearPago?.(dinamica.calc)} style={{ width: '100%' }}>Crear pago de premios</BotonM>)}
          </div>
          <Nota style={{ marginTop: 8 }}>La meta y los premios del mes se capturan desde la computadora.</Nota>
        </Tarjeta>
      )}
    </div>
  );
}

// ───────────────────────── Marketing ─────────────────────────
/** Vista pura. `delMes` y `porCliente` = marketingDelPeriodo(...). */
export function MarketingVista({ delMes = [], porCliente = [], mesLabel = '', puedeEditar = () => false, guardando = null, onCobro, onCrearPago, ocupado = false }) {
  const { theme } = useTheme();
  if (delMes.length === 0) return <Vacio icon={null} titulo="Sin actividades de marketing" sub={`No hay actividades registradas en ${mesLabel}.`} style={{ padding: '26px 16px' }} />;
  return (
    <div style={{ padding: '12px 0 0' }}>
      <ListaAgrupada titulo={`Marketing de ${mesLabel}`} meta={`${delMes.length}`} pie="Cargo a fondo descuenta del fondo de marketing del cliente; si la paga la empresa entra al flujo de pagos.">
        {delMes.map((a) => {
          const cobro = a.cobro || 'empresa';
          return (
            <div key={a.id} style={{ background: theme.surface, padding: '10px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                <span style={{ fontSize: 15, fontWeight: 500, minWidth: 0, color: theme.text }}>{a.nombre}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 15, fontWeight: 600, flexShrink: 0, color: theme.text }}>{money(a.inversion ?? a.costo)}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                {puedeEditar(a.cliente)
                  ? <Segmented size="md" style={{ display: 'flex', width: '100%', opacity: guardando === a.id ? 0.5 : 1 }} value={cobro}
                      onChange={(v) => { if (v !== cobro && guardando !== a.id) onCobro?.(a, v); }}
                      options={[{ id: 'empresa', label: 'Paga la empresa' }, { id: 'fondo', label: 'Cargo a fondo' }]} />
                  : <Pill tone={cobro === 'fondo' ? 'purple' : 'green'}>{cobro === 'fondo' ? 'Cargo a fondo' : 'Paga la empresa'}</Pill>}
              </div>
            </div>
          );
        })}
      </ListaAgrupada>
      <div style={{ padding: '14px 16px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {porCliente.map(({ cliente, prop, fondo, yaHay }) => (
          <Tarjeta key={cliente}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600 }}>Lo paga la empresa</span>
              <span style={{ fontFamily: TYPO.fontRounded, fontSize: 19, fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{money(prop.monto)}</span>
            </div>
            <Nota style={{ marginTop: 3 }}>{CLIENTE_LABEL[cliente] || cliente}{fondo > 0 ? ` · ${money(fondo)} con cargo a su fondo` : ''}</Nota>
            <div style={{ marginTop: 10 }}>
              {yaHay
                ? <Pill tone="green">Pago creado</Pill>
                : (puedeEditar(cliente) && prop.aplica
                  ? <BotonM primario icon={Plus} disabled={ocupado} onClick={() => onCrearPago?.(prop)} style={{ width: '100%' }}>Crear pago de marketing</BotonM>
                  : <Pill tone="gray">{prop.aplica ? 'Sólo lectura' : 'Sin pago'}</Pill>)}
            </div>
          </Tarjeta>
        ))}
      </div>
    </div>
  );
}

/** Cálculo y Marketing: piden los datos del motor (los mismos de la web) sólo al abrirse. */
export function MotorM({ seccion, clienteSel, anio, mes, perfil, puedeEditar, onCambio }) {
  const d = useDatosPagos({ perfil, anio, mes });
  const [mesSel, setMesSel] = useState(mes);
  const [ocupado, setOcupado] = useState(false);
  const [guardando, setGuardando] = useState(null);
  useEffect(() => { setMesSel(mes); }, [mes]);
  const clientes = useMemo(() => [clienteSel], [clienteSel]);
  const claves = useMemo(() => new Set((d.pagos || []).map((p) => p.clave_calculo).filter(Boolean)), [d.pagos]);
  const bloques = useMemo(() => bloquesCalculo({ clientes, reglas: d.reglas, datosMotor: d.datosMotor, anio, mes: mesSel }), [clientes, d.reglas, d.datosMotor, anio, mesSel]);
  const dinamica = useMemo(() => (clienteSel === 'dicotech' ? calculoDinamica({ anio, mes: mesSel, reglas: d.reglas, datosMotor: d.datosMotor, dinamica: d.dinamica }) : null), [clienteSel, anio, mesSel, d.reglas, d.datosMotor, d.dinamica]);
  const mkt = useMemo(() => marketingDelPeriodo({ actividades: d.actividades, clientes, anio, mes, pagos: d.pagos }), [d.actividades, clientes, anio, mes, d.pagos]);

  const recargar = async () => { await d.recargar(); await onCambio?.(); };
  const crear = async (propuesta) => {
    setOcupado(true);
    try { await guardarPropuestas({ propuestas: [propuesta], perfil }); await recargar(); toast.ok('Pago creado en estado calculado'); }
    catch (e) { avisar(e); } finally { setOcupado(false); }
  };
  const cobro = async (act, v) => {
    setGuardando(act.id);
    try {
      const r = await cambiarCobroActividad({ act, cobro: v, fondos: d.fondos, anio, mes });
      if (r.fondoNegativo) toast.error(`El fondo de ${CLIENTE_LABEL[act.cliente]} está en negativo: el sobregiro se autoriza en la computadora.`);
      toast.ok(v === 'fondo' ? 'Cargada al fondo del cliente' : 'La paga la empresa · entra al flujo de pagos');
      await recargar();
    } catch (e) { avisar(e); } finally { setGuardando(null); }
  };

  if (d.cargando && !(d.pagos || []).length) return <Cargando silueta={SIL_MOVIL_PAGOS} style={{ padding: '12px 16px' }} />;
  if (d.error) return <Vacio titulo="No se pudo calcular" sub={String(d.error)} />;
  if (seccion === 'marketing') {
    return <MarketingVista delMes={mkt.delMes} porCliente={mkt.porCliente} mesLabel={`${M.MESES_LARGOS[mes - 1].toLowerCase()} ${anio}`} puedeEditar={puedeEditar} guardando={guardando} onCobro={cobro} onCrearPago={crear} ocupado={ocupado} />;
  }
  return <CalculoVista bloques={bloques} dinamica={dinamica} anio={anio} mes={mesSel} meses={mesesCalculo(mes)} onMes={setMesSel} factor={factorProyeccion(anio, mesSel)}
    yaExiste={(c) => claves.has(c)} puedeEditar={puedeEditar} onCrearPago={crear} ocupado={ocupado} />;
}

// ───────────────────────── Reglas ─────────────────────────
/** Renglones de lectura de las reglas vigentes de un cliente. Puro. */
function filasReglas(reglas, cliente) {
  const out = [];
  const reb = reglaDe(reglas, cliente, 'rebate');
  if (reb) {
    const det = reb.modo === 'por_categoria'
      ? Object.entries(reb.por_categoria || {}).map(([k, v]) => `${k} ${pct2(v)}`).join(' · ')
      : (reb.tiers || []).map((t) => `desde ${pctTxt(t.min_alcance)} paga ${pct2(t.pct)}`).join(' · ');
    out.push({ id: 'rebate', titulo: reb.nombre_oficial || 'Rebate', sub: `${reb.frecuencia || ''}${det ? ` · ${det}` : ''}` });
  }
  const sp = reglaDe(reglas, cliente, 'spiff');
  if (sp) {
    const p = sp.pct_fijo ?? sp.compradora_pct ?? sp.flat_pct;
    out.push({ id: 'spiff', titulo: 'SPIFF', sub: `${sp.frecuencia || 'mensual'} · ${p != null ? `${pct2(p)} ` : ''}sobre ${sp.base === 'sell_out' ? 'sell out' : 'sell in'}${sp.tope_mensual ? ` · tope ${money(sp.tope_mensual)}` : ''}` });
  }
  if (reglaDe(reglas, cliente, 'dinamica')) out.push({ id: 'dinamica', titulo: 'Dinámica de vendedores', sub: 'meta y premios por mes' });
  const fon = reglaDe(reglas, cliente, 'fondo');
  if (fon?.fondos?.length) out.push({ id: 'fondo', titulo: 'Fondos', sub: fon.fondos.map((f) => f.nombre).join(' · ') });
  const fij = reglaDe(reglas, cliente, 'fijos');
  if (fij?.conceptos?.length) out.push({ id: 'fijos', titulo: 'Pagos fijos', sub: fij.conceptos.map((c) => `${c.concepto} ${money(c.monto)}`).join(' · ') });
  return out.map((f) => ({ ...f, etiqueta: SECCIONES.find((s) => s.id === f.id)?.label || f.titulo }));
}

export function ReglasVista({ cliente, reglas = [], puedeEditar = false, onEditar }) {
  const { theme } = useTheme();
  const filas = filasReglas(reglas, cliente);
  return (
    <div style={{ padding: '12px 0 0' }}>
      <div style={{ padding: '0 20px 10px', fontSize: 13, lineHeight: 1.45, color: theme.textMuted }}>{resumenReglas(reglas, cliente)}</div>
      <ListaAgrupada titulo={`Reglas de ${CLIENTE_LABEL[cliente] || cliente}`} meta={puedeEditar ? 'vigentes' : 'sólo lectura'} pie="Fondos, pagos fijos, dinámica y destinatarios de correo se editan desde la computadora.">
        {filas.length === 0 && <Vacio icon={null} titulo="Sin reglas configuradas" style={{ padding: 16 }} />}
        {filas.map((f) => <Fila key={f.id} alto={58} chevron={false} titulo={f.titulo} sub={f.sub} pill={f.etiqueta !== f.titulo ? { tone: 'gray', label: f.etiqueta } : undefined} />)}
      </ListaAgrupada>
      <div style={{ padding: '14px 16px 0' }}>
        <BotonGrande icon={puedeEditar ? SlidersHorizontal : Lock} onClick={onEditar}>{puedeEditar ? 'Editar rebate y SPIFF' : 'Ver porcentajes'}</BotonGrande>
      </div>
    </div>
  );
}

export function ReglasM({ cliente, reglas, perfil, puedeEditar, onCambio }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <>
      <ReglasVista cliente={cliente} reglas={reglas} puedeEditar={puedeEditar} onEditar={() => setAbierta(true)} />
      <HojaReglasM abierto={abierta} onClose={() => setAbierta(false)} ck={cliente} nombre={CLIENTE_LABEL[cliente] || cliente} reglas={reglas} perfil={perfil} puedeEditar={puedeEditar} onGuardado={onCambio} />
    </>
  );
}

// ───────────────────────── ＋ Pago manual ─────────────────────────
/** Formulario del pago manual (los campos de FormPagoManual de la web). Vista pura. */
export function PagoManualVista({ f, clientes = [], onCampo, apoyo = null, cargandoApoyo = false, onApoyo, onGuardar, guardando = false }) {
  const { theme } = useTheme();
  const L = lbl(theme);
  const valido = String(f.concepto || '').trim() && N(f.monto) > 0;
  return (
    <div style={{ padding: '4px 16px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      {clientes.length > 1 && (
        <div><span style={L}>Cliente</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{clientes.map((k) => <ChipM key={k} on={f.cliente === k} onClick={() => onCampo('cliente', k)} style={CHIP_44}>{CLIENTE_LABEL[k] || k}</ChipM>)}</div>
        </div>
      )}
      <div><span style={L}>Categoría</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{TIPOS_MANUALES.map((t) => <ChipM key={t} on={f.tipo === t} onClick={() => onCampo('tipo', t)} style={CHIP_44}>{TIPO_META[t]?.label || t}</ChipM>)}</div>
      </div>
      <div><span style={L}>Concepto</span><CampoM value={f.concepto} onChange={(v) => onCampo('concepto', v)} placeholder="Protección de precio · lista de noviembre" /></div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 10 }}>
        <div><span style={L}>Monto</span><CampoM value={f.monto} onChange={(v) => onCampo('monto', String(v).replace(/[^\d.]/g, ''))} placeholder="0.00" inputMode="decimal" style={{ fontFamily: MONO }} /></div>
        <div><span style={L}>Periodo</span><CampoM value={f.periodo} onChange={(v) => onCampo('periodo', v)} placeholder="2026-11" /></div>
      </div>
      <div><span style={L}>Fecha de pago</span><CampoM type="date" value={f.fecha_programada} onChange={(v) => onCampo('fecha_programada', v)} /></div>
      <div><span style={L}>Notas</span><CampoM multiline value={f.notas} onChange={(v) => onCampo('notas', v)} placeholder="Opcional" /></div>

      {f.tipo === 'proteccion_precio' && (
        <div style={{ border: `1px solid ${theme.border}`, borderRadius: 14, padding: 12 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 600, color: theme.text }}>Apoyo de cálculo</div>
          <Nota style={{ margin: '3px 0 10px' }}>Inventario reportado por el cliente × la baja de su lista de precios. El monto final lo decides tú.</Nota>
          <BotonM icon={Calculator} disabled={cargandoApoyo} onClick={onApoyo} style={{ width: '100%' }}>{cargandoApoyo ? 'Calculando…' : 'Traer inventario del cliente'}</BotonM>
          {apoyo && (
            <div style={{ marginTop: 10 }}>
              <Nota>{apoyo.inventario} SKU con existencia · {apoyo.filas.length} con baja de precio · apoyo {money(apoyo.total)}</Nota>
              {apoyo.filas.slice(0, 30).map((r) => (
                <div key={r.sku} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '8px 0', borderTop: `1px solid ${theme.border}`, marginTop: 6 }}>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: 'block', fontFamily: MONO, fontSize: 13, color: theme.text }}>{r.sku}</span>
                    <span style={{ fontSize: 12, color: theme.textMuted }}>{r.piezas} pz · {money(r.precio_anterior)} → {money(r.precio_nuevo)}</span>
                  </span>
                  <span style={{ fontVariantNumeric: 'tabular-nums', fontSize: 14, fontWeight: 600, color: theme.text, flexShrink: 0 }}>{money(r.monto)}</span>
                </div>
              ))}
              {apoyo.filas.length > 30 && <Nota style={{ marginTop: 6 }}>y {apoyo.filas.length - 30} SKU más (van completos en el detalle del pago).</Nota>}
            </div>
          )}
        </div>
      )}

      <BotonGrande primario icon={Plus} disabled={!valido || guardando} onClick={onGuardar}>{guardando ? 'Creando…' : 'Crear pago'}</BotonGrande>
      <Nota>Entra al mismo flujo: calculado → solicitado → autorizado → folio → pagado.</Nota>
    </div>
  );
}

const formVacio = (cliente, anio, mes) => ({ cliente, tipo: 'proteccion_precio', concepto: '', monto: '', periodo: M.periodoMes(anio, mes), fecha_programada: '', notas: '' });

/** Hoja «＋ Pago manual». `clientes` = sólo los que la persona puede editar. */
export function HojaPagoManualM({ abierto, onClose, clientes = [], clienteInicial, anio, mes, perfil, onGuardado }) {
  const inicial = clientes.includes(clienteInicial) ? clienteInicial : clientes[0];
  const [f, setF] = useState(() => formVacio(inicial, anio, mes));
  const [apoyo, setApoyo] = useState(null);
  const [cargandoApoyo, setCargandoApoyo] = useState(false);
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (abierto) { setF((x) => ({ ...x, cliente: inicial, periodo: M.periodoMes(anio, mes) })); setApoyo(null); } }, [abierto, inicial, anio, mes]);
  const campo = (k, v) => { setF((x) => ({ ...x, [k]: v })); if (k === 'cliente') setApoyo(null); };

  const traer = async () => {
    setCargandoApoyo(true);
    try {
      const r = await traerApoyoProteccion(f.cliente);
      setApoyo(r);
      if (r.total > 0 && !f.monto) setF((x) => ({ ...x, monto: String(r.total) }));
      if (r.filas.length === 0) toast.ok(`Inventario de ${CLIENTE_LABEL[f.cliente]}: ${r.inventario} SKU. Sin bajas de lista: captura el monto.`);
    } catch (e) { toast.error(`No se pudo traer el apoyo: ${e?.message || e}`); } finally { setCargandoApoyo(false); }
  };
  const guardar = async () => {
    if (!f.concepto.trim() || !(N(f.monto) > 0)) { toast.error('Concepto y monto son obligatorios.'); return; }
    setGuardando(true);
    try {
      await crearPagoManual({ datos: { ...f, monto: Number(f.monto), detalle: detallePagoManual({ concepto: f.concepto, monto: f.monto, apoyo }) }, perfil });
      toast.ok('Pago manual creado');
      setF(formVacio(f.cliente, anio, mes)); setApoyo(null);
      await onGuardado?.();
      onClose?.();
    } catch (e) { avisar(e); } finally { setGuardando(false); }
  };

  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Pago manual" sub="Protección de precio, bonificación, promoción, marketing u otro" alto="92vh">
      <PagoManualVista f={f} clientes={clientes} onCampo={campo} apoyo={apoyo} cargandoApoyo={cargandoApoyo} onApoyo={traer} onGuardar={guardar} guardando={guardando} />
    </HojaM>
  );
}
