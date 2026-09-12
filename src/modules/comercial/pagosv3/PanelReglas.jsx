// Panel "Reglas por cliente" · muestra los porcentajes vigentes (copiados de
// lineamientos_cliente) en sólo lectura. "Desbloquear para editar" pide confirmación;
// cada cambio se guarda con vigencia desde/hasta, quién y cuándo (pagos_reglas_historial).
import React, { useMemo, useState } from 'react';
import { Lock, Unlock, Save, History } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Panel, Boton, Pill, Segmented, toast } from '../../../components/kit';
import { reglaDe, CLIENTE_LABEL, SECCIONES } from './reglas';
import { historialRegla } from './datos';
import { mxn, MONO, Nota, CampoInline, Entrada, ClientePill } from './ui';

const pctIn = (v) => (v == null ? '' : String(Number((Number(v) * 100).toFixed(4))));
const pctOut = (v) => (v === '' || v == null ? 0 : Number(v) / 100);

export default function PanelReglas({ clientes, reglas, puedeEditar, onGuardar, abiertoInicial = false }) {
  const { theme } = useTheme();
  const [cliente, setCliente] = useState(clientes[0] || 'digitalife');
  const [desbloqueado, setDesbloqueado] = useState(false);
  const [historial, setHistorial] = useState(null);

  React.useEffect(() => { setDesbloqueado(false); setHistorial(null); }, [cliente]);
  const editable = desbloqueado && puedeEditar(cliente);

  const desbloquear = () => {
    if (desbloqueado) { setDesbloqueado(false); return; }
    const ok = window.confirm(
      `Vas a editar las reglas de ${CLIENTE_LABEL[cliente]}.\n\n` +
      'Los porcentajes de aquí son los que usa el motor para calcular rebates y SPIFFs. ' +
      'Cada cambio se guarda con vigencia (desde hoy), quién lo hizo y cuándo, y los periodos anteriores ' +
      'se siguen calculando con la regla que estaba vigente entonces.\n\n¿Continuar?'
    );
    if (ok) setDesbloqueado(true);
  };

  const verHistorial = async (seccion) => {
    const h = await historialRegla(cliente, seccion);
    setHistorial({ seccion, filas: h });
  };

  const rReb = reglaDe(reglas, cliente, 'rebate');
  const rSpiff = reglaDe(reglas, cliente, 'spiff');
  const rFondo = reglaDe(reglas, cliente, 'fondo');
  const rDin = reglaDe(reglas, cliente, 'dinamica');
  const rFijos = reglaDe(reglas, cliente, 'fijos');
  const vigente = (seccion) => (reglas || []).find((r) => r.cliente === cliente && r.seccion === seccion && !r.vigente_hasta);

  const guardarSeccion = async (seccion, config) => {
    try {
      await onGuardar?.({ cliente, seccion, config });
      toast.ok(`Regla de ${seccion} guardada · vigente desde hoy`);
      setDesbloqueado(false);
    } catch (e) { toast.error(e.message || String(e)); }
  };

  return (
    <Panel
      titulo="Reglas por cliente" plegable={!abiertoInicial} abiertoInicial={abiertoInicial}
      meta="lo que el motor calcula solo · con candado"
      acciones={
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {clientes.length > 1 && <Segmented size="sm" options={clientes.map((k) => ({ id: k, label: CLIENTE_LABEL[k] }))} value={cliente} onChange={setCliente} />}
          {puedeEditar(cliente) && (
            <Boton icon={desbloqueado ? Unlock : Lock} primario={desbloqueado} onClick={desbloquear}>
              {desbloqueado ? 'Editando' : 'Desbloquear para editar'}
            </Boton>
          )}
        </span>
      }
    >
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, flexWrap: 'wrap' }}>
        <ClientePill clienteKey={cliente} />
        {!puedeEditar(cliente) && <Pill tone="gray" size="xs">Sólo lectura</Pill>}
        {desbloqueado && <Pill tone="orange" size="xs" dot>Campos abiertos</Pill>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px,1fr))', gap: 10 }}>
        {rReb && (
          <Seccion titulo="Rebate" vigente={vigente('rebate')} onHistorial={() => verHistorial('rebate')}>
            <Nota>{rReb.nombre_oficial ? `${rReb.nombre_oficial} · ` : ''}{rReb.frecuencia} · base {rReb.base || 'sell in'}</Nota>
            {rReb.modo === 'por_categoria' && (
              <EditorPorCategoria regla={rReb} editable={editable} onGuardar={(c) => guardarSeccion('rebate', c)} />
            )}
            {rReb.modo === 'niveles' && (
              <EditorNiveles regla={rReb} editable={editable} onGuardar={(c) => guardarSeccion('rebate', c)} />
            )}
          </Seccion>
        )}

        {rSpiff && (
          <Seccion titulo="SPIFF" vigente={vigente('spiff')} onHistorial={() => verHistorial('spiff')}>
            <Nota>{rSpiff.base === 'sell_out' ? 'sobre sell out' : 'sobre sell in'} · {rSpiff.frecuencia || 'mensual'}</Nota>
            <EditorCampos
              editable={editable}
              campos={[
                rSpiff.pct_fijo != null && { k: 'pct_fijo', label: '% del sell in', valor: pctIn(rSpiff.pct_fijo), sufijo: '%' },
                rSpiff.compradora_pct != null && { k: 'compradora_pct', label: '% compradora', valor: pctIn(rSpiff.compradora_pct), sufijo: '%' },
                rSpiff.flat_pct != null && { k: 'flat_pct', label: '% del sell out', valor: pctIn(rSpiff.flat_pct), sufijo: '%' },
                rSpiff.cuota_so_factor != null && { k: 'cuota_so_factor', label: 'Cuota SO = % de la SI', valor: pctIn(rSpiff.cuota_so_factor), sufijo: '%' },
                rSpiff.min_alcance != null && { k: 'min_alcance', label: 'Paga desde alcance', valor: pctIn(rSpiff.min_alcance), sufijo: '%' },
                rSpiff.requiere_alcance_minimo != null && { k: 'requiere_alcance_minimo', label: 'Alcance mínimo', valor: pctIn(rSpiff.requiere_alcance_minimo), sufijo: '%' },
              ].filter(Boolean)}
              onGuardar={(vals) => {
                const c = { ...rSpiff };
                for (const [k, v] of Object.entries(vals)) c[k] = pctOut(v);
                guardarSeccion('spiff', c);
              }}
            />
          </Seccion>
        )}

        {rDin && (
          <Seccion titulo="Dinámica de vendedores" vigente={vigente('dinamica')} onHistorial={() => verHistorial('dinamica')}>
            <Nota>Premia a los {rDin.premiados || 5} primeros vendedores que alcancen la meta del mes. Meta y premios se capturan cada mes en el panel de Cálculo.</Nota>
          </Seccion>
        )}

        {rFondo && (
          <Seccion titulo="Fondos" vigente={vigente('fondo')} onHistorial={() => verHistorial('fondo')}>
            {(rFondo.fondos || []).map((f) => (
              <div key={f.fondo_key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 11.5, padding: '3px 0' }}>
                <span>{f.nombre}</span>
                <span style={{ ...MONO, color: theme.textMuted }}>
                  {f.regla?.tipo === 'pct_sell_in' ? `${(f.regla.pct * 100).toFixed(2)} % sell in`
                    : f.regla?.tipo === 'pct_sell_in_tiers' ? 'por nivel de alcance Q'
                    : 'manual'}
                </span>
              </div>
            ))}
            {rFondo.plan_mkt_contratado && (
              <Nota style={{ marginTop: 4 }}>Plan de marketing contratado: {mxn(rFondo.plan_mkt_contratado.monto_mensual)} al mes · se descuenta primero de {(rFondo.plan_mkt_contratado.orden_descuento || []).join(' y luego ')}.</Nota>
            )}
          </Seccion>
        )}

        {rFijos && (
          <Seccion titulo="Pagos fijos" vigente={vigente('fijos')} onHistorial={() => verHistorial('fijos')}>
            {(rFijos.conceptos || []).map((c, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, padding: '3px 0' }}>
                <span>{c.concepto}</span><span style={MONO}>{mxn(c.monto)} · día {c.dia}</span>
              </div>
            ))}
          </Seccion>
        )}
      </div>

      {historial && (
        <div style={{ marginTop: 10, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, marginBottom: 6 }}>Historial · {historial.seccion}</div>
          {historial.filas.length === 0 ? <Nota>Sin cambios registrados.</Nota> : historial.filas.map((h) => (
            <div key={h.id} style={{ fontSize: 11, color: theme.textMuted, padding: '3px 0', borderBottom: `1px solid ${theme.border}` }}>
              <span style={MONO}>{String(h.cambiado_at).slice(0, 16).replace('T', ' ')}</span> · {h.cambiado_por || '—'}{h.nota ? ` · ${h.nota}` : ''}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Seccion({ titulo, vigente, onHistorial, children }) {
  const { theme } = useTheme();
  return (
    <div style={{ border: `1px solid ${theme.border}`, borderRadius: 12, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
        <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600 }}>{titulo}</span>
        <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
          {vigente?.vigente_desde && <span style={{ fontSize: 10, color: theme.textMuted, ...MONO }}>desde {vigente.vigente_desde}</span>}
          <Boton icon={History} onClick={onHistorial} title="Ver historial de cambios" />
        </span>
      </div>
      {children}
    </div>
  );
}

function EditorCampos({ campos, editable, onGuardar }) {
  const [vals, setVals] = useState(() => Object.fromEntries(campos.map((c) => [c.k, c.valor])));
  React.useEffect(() => { setVals(Object.fromEntries(campos.map((c) => [c.k, c.valor]))); }, [JSON.stringify(campos.map((c) => c.valor))]);
  const cambiado = campos.some((c) => String(vals[c.k]) !== String(c.valor));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px,1fr))', gap: 6 }}>
        {campos.map((c) => (
          <CampoInline key={c.k} label={c.label}>
            <Entrada type="number" step="0.01" value={vals[c.k]} disabled={!editable}
                     onChange={(e) => setVals((v) => ({ ...v, [c.k]: e.target.value }))} />
          </CampoInline>
        ))}
      </div>
      {editable && cambiado && <Boton primario icon={Save} onClick={() => onGuardar(vals)}>Guardar cambios</Boton>}
    </div>
  );
}

function EditorPorCategoria({ regla, editable, onGuardar }) {
  const cats = Object.keys(regla.por_categoria || {});
  return (
    <EditorCampos
      editable={editable}
      campos={cats.map((c) => ({ k: c, label: c.charAt(0).toUpperCase() + c.slice(1), valor: pctIn(regla.por_categoria[c]) }))}
      onGuardar={(vals) => onGuardar({ ...regla, por_categoria: Object.fromEntries(cats.map((c) => [c, pctOut(vals[c])])) })}
    />
  );
}

function EditorNiveles({ regla, editable, onGuardar }) {
  const { theme } = useTheme();
  const tiers = regla.tiers || [];
  const [vals, setVals] = useState(() => tiers.map((t) => ({ min: pctIn(t.min_alcance), pct: pctIn(t.pct), label: t.label })));
  React.useEffect(() => { setVals(tiers.map((t) => ({ min: pctIn(t.min_alcance), pct: pctIn(t.pct), label: t.label }))); }, [JSON.stringify(tiers)]);
  const cambiado = JSON.stringify(vals) !== JSON.stringify(tiers.map((t) => ({ min: pctIn(t.min_alcance), pct: pctIn(t.pct), label: t.label })));
  const minimo = regla.alcance_minimo_pago ?? regla.requiere_alcance_minimo;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {vals.map((t, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 74px 74px', gap: 6, alignItems: 'end' }}>
          <span style={{ fontSize: 11, color: theme.textMuted }}>{t.label || `Nivel ${i + 1}`}</span>
          <CampoInline label="Desde">
            <Entrada type="number" step="0.01" value={t.min} disabled={!editable}
                     onChange={(e) => setVals((v) => v.map((x, k) => k === i ? { ...x, min: e.target.value } : x))} />
          </CampoInline>
          <CampoInline label="%">
            <Entrada type="number" step="0.01" value={t.pct} disabled={!editable}
                     onChange={(e) => setVals((v) => v.map((x, k) => k === i ? { ...x, pct: e.target.value } : x))} />
          </CampoInline>
        </div>
      ))}
      {minimo != null && <Nota>Alcance mínimo para pagar: {(Number(minimo) * 100).toFixed(0)} %.</Nota>}
      {editable && cambiado && (
        <Boton primario icon={Save} onClick={() => onGuardar({
          ...regla,
          tiers: vals.map((t, i) => ({ ...tiers[i], min_alcance: pctOut(t.min), pct: pctOut(t.pct), label: t.label })),
        })}>Guardar niveles</Boton>
      )}
    </div>
  );
}
