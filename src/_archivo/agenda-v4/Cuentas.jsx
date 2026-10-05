// Agenda V4 · pestaña Cuentas: las cuentas que Fernando sigue como gerente de ventas
// (directas o a través de un mayorista: CVA, CT…). Lista con semáforo del próximo seguimiento
// (vencido rojo · esta semana naranja) y hoja lateral con datos, bitácora y acciones.
// Tablas: cuentas_seguimiento + cuentas_seguimiento_notas (migración 20260921_agenda_v4.sql).
import React, { useMemo, useState } from 'react';
import { Plus, Search, X, Phone, MessageCircle, CheckCircle2, Trash2, ListPlus } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented, Pill, Boton, toast } from '../../components/kit';
import { HojaLateral, Grupo, Fila } from '../../components/perfil/comun';
import { Vacio } from './comun';
import { cuentasOrdenadas, ESTADOS_CUENTA, enlacesContacto, cuando, isoDia, sumarDias, registrarContacto } from './calculo';
import { crearCuenta, actualizarCuenta, borrarCuenta, agregarNotaCuenta, registrarContactoCuenta, crearPendienteDeCuenta } from './datos';

const SEGS = ESTADOS_CUENTA.map((e) => ({ id: e.id, label: e.label }));

export default function Cuentas({ cuentas, notasPorCuenta, personas, hoy, puedeEditar, onNavegarPendientes }) {
  const { theme } = useTheme();
  const [estado, setEstado] = useState('activa');
  const [q, setQ] = useState('');
  const [abierta, setAbierta] = useState(null);   // id de la cuenta en la hoja
  const [nueva, setNueva] = useState(false);

  const lista = useMemo(() => cuentasOrdenadas(cuentas, { hoy, estado, q }), [cuentas, hoy, estado, q]);
  const vencidas = useMemo(() => cuentasOrdenadas(cuentas, { hoy, estado: 'activa' }).filter((c) => c.seg.nivel === 'vencido'), [cuentas, hoy]);
  const cuenta = abierta ? cuentas.find((c) => c.id === abierta) : null;

  return (
    <>
      <Panel titulo="Cuentas que sigo" meta={`${lista.length} ${estado === 'activa' ? 'activa' : estado}${lista.length === 1 ? '' : 's'}${vencidas.length ? ` · ${vencidas.length} con seguimiento vencido` : ''}`} padding="0"
        acciones={<>
          <Segmented options={SEGS} value={estado} onChange={setEstado} />
          {puedeEditar && <Boton icon={Plus} primario onClick={() => setNueva(true)}>Cuenta</Boton>}
        </>}>
        <div style={{ padding: '8px 12px', borderBottom: `1px solid ${theme.border}` }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, border: `1px solid ${theme.border}`, background: theme.bg, borderRadius: 999, padding: '3px 10px', minWidth: 240 }}>
            <Search size={12} style={{ color: theme.textMuted }} />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="nombre, empresa, mayorista o vendedor"
              style={{ border: 0, background: 'transparent', outline: 'none', fontFamily: TYPO.fontText, fontSize: 11.5, color: theme.text, flex: 1, minWidth: 0 }} />
            {q && <X size={12} style={{ color: theme.textMuted, cursor: 'pointer' }} onClick={() => setQ('')} />}
          </label>
        </div>
        {lista.map((c) => {
          const tel = enlacesContacto(c.telefono);
          return (
            <div key={c.id} onClick={() => setAbierta(c.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderBottom: `1px solid ${theme.border}`, cursor: 'pointer', fontFamily: TYPO.fontText }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: c.seg.tone === 'red' ? theme.red : c.seg.tone === 'orange' ? theme.orange : theme.border }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {c.nombre}{c.empresa ? <span style={{ fontWeight: 400, color: theme.textMuted }}> · {c.empresa}</span> : null}
                </div>
                <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center', marginTop: 2, fontSize: 10.5, color: theme.textMuted }}>
                  <Pill tone={c.tipo === 'mayorista' ? 'blue' : 'purple'} size="xs">{c.tipo === 'mayorista' ? (c.mayorista || 'mayorista') : 'directa'}</Pill>
                  {c.vendedor && <Pill tone="gray" size="xs">vend. {c.vendedor}</Pill>}
                  <span>{c.ultimo_contacto ? `último contacto ${cuando(c.ultimo_contacto, hoy)}` : 'sin contacto registrado'}</span>
                  <span>· cada {c.recordar_cada_dias} d</span>
                </div>
              </div>
              <Pill tone={c.seg.tone} size="xs" dot={c.seg.nivel === 'vencido'} title="Próximo seguimiento">{c.seg.label}</Pill>
              {tel.tel && <a href={tel.tel} onClick={(e) => e.stopPropagation()} title={`Llamar a ${c.nombre}`} style={{ color: theme.accent, display: 'inline-flex' }}><Phone size={14} /></a>}
              {tel.whatsapp && <a href={tel.whatsapp} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} title="WhatsApp" style={{ color: theme.green, display: 'inline-flex' }}><MessageCircle size={14} /></a>}
            </div>
          );
        })}
        {!lista.length && <Vacio>{q ? 'Ninguna cuenta coincide.' : `Sin cuentas ${estado === 'activa' ? 'activas' : estado + 's'}.`}</Vacio>}
        <div style={{ height: 6 }} />
      </Panel>

      {cuenta && <HojaCuenta cuenta={cuenta} notas={notasPorCuenta?.get(cuenta.id) || []} personas={personas} hoy={hoy} puedeEditar={puedeEditar}
        onClose={() => setAbierta(null)} onNavegarPendientes={onNavegarPendientes} />}
      {nueva && <FormCuenta hoy={hoy} onClose={() => setNueva(false)} onCreada={(c) => { setNueva(false); setAbierta(c.id); }} />}
    </>
  );
}

// ─── Hoja lateral de una cuenta ───
function HojaCuenta({ cuenta: c, notas, personas, hoy, puedeEditar, onClose, onNavegarPendientes }) {
  const { theme } = useTheme();
  const [nota, setNota] = useState('');
  const [notasTxt, setNotasTxt] = useState(c.notas || '');
  const [busy, setBusy] = useState(false);
  const tel = enlacesContacto(c.telefono);
  const seg = c.proximo_seguimiento;

  const guardar = async (cambios) => { try { await actualizarCuenta(c.id, cambios); } catch (e) { toast.error(e.message); } };
  const registrar = async () => {
    setBusy(true);
    try {
      await registrarContactoCuenta(c, nota, hoy);
      setNota('');
      const next = registrarContacto(c, hoy);
      toast.ok(`Contacto registrado · próximo ${cuando(next.proximo_seguimiento, hoy)}`);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const soloNota = async () => { if (!nota.trim()) return; try { await agregarNotaCuenta(c, nota, { hoy }); setNota(''); toast.ok('Nota guardada'); } catch (e) { toast.error(e.message); } };
  const pendiente = async () => {
    try { await crearPendienteDeCuenta(c, {}, personas); toast.ok('Pendiente creado'); onNavegarPendientes?.(); }
    catch (e) { toast.error(e.message); }
  };
  const eliminar = async () => {
    if (!window.confirm(`¿Eliminar la cuenta «${c.nombre}» y su bitácora? No se puede deshacer.`)) return;
    try { await borrarCuenta(c.id); onClose(); toast.ok('Cuenta eliminada'); } catch (e) { toast.error(e.message); }
  };

  const campo = { border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: '5px 8px', outline: 'none' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, marginBottom: 6, display: 'block' };

  return (
    <HojaLateral abierto onClose={onClose} theme={theme} ancho={480} titulo={c.nombre}
      sub={[c.empresa, c.tipo === 'mayorista' ? `vía ${c.mayorista || 'mayorista'}` : 'cuenta directa', c.vendedor ? `vendedor ${c.vendedor}` : null].filter(Boolean).join(' · ')}
      acciones={puedeEditar && <Boton icon={CheckCircle2} primario onClick={registrar} disabled={busy}>Registrar contacto</Boton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 4px 24px', fontFamily: TYPO.fontText }}>

        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          {tel.tel && <Boton icon={Phone} onClick={() => window.location.assign(tel.tel)}>{tel.e164}</Boton>}
          {tel.whatsapp && <Boton icon={MessageCircle} onClick={() => window.open(tel.whatsapp, '_blank', 'noopener')}>WhatsApp</Boton>}
          {puedeEditar && <Boton icon={ListPlus} onClick={pendiente}>Crear pendiente</Boton>}
        </div>

        <Grupo theme={theme}>
          <Fila theme={theme} primera label="Próximo seguimiento" sub={seg ? cuando(seg, hoy) : 'sin fecha'}>
            <input type="date" value={seg || ''} disabled={!puedeEditar} onChange={(e) => guardar({ proximo_seguimiento: e.target.value || null })} style={{ ...campo, width: 140 }} />
          </Fila>
          <Fila theme={theme} label="Recordar cada" sub="días entre un contacto y el siguiente">
            <input type="number" min={1} max={365} value={c.recordar_cada_dias} disabled={!puedeEditar}
              onChange={(e) => guardar({ recordar_cada_dias: Math.max(1, Math.min(365, Number(e.target.value) || 14)) })} style={{ ...campo, width: 72 }} />
          </Fila>
          <Fila theme={theme} label="Último contacto" sub={c.ultimo_contacto ? cuando(c.ultimo_contacto, hoy) : 'nunca'}>
            <input type="date" value={c.ultimo_contacto || ''} disabled={!puedeEditar} onChange={(e) => guardar({ ultimo_contacto: e.target.value || null })} style={{ ...campo, width: 140 }} />
          </Fila>
          <Fila theme={theme} label="Estado">
            <Segmented value={c.estado} onChange={(v) => puedeEditar && guardar({ estado: v })} options={ESTADOS_CUENTA.map((e) => ({ id: e.id, label: e.label.replace(/s$/, '') }))} />
          </Fila>
        </Grupo>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>Teléfono</span><input defaultValue={c.telefono || ''} readOnly={!puedeEditar} onBlur={(e) => e.target.value !== (c.telefono || '') && guardar({ telefono: e.target.value || null })} style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
          <div><span style={lbl}>Correo</span><input defaultValue={c.email || ''} readOnly={!puedeEditar} onBlur={(e) => e.target.value !== (c.email || '') && guardar({ email: e.target.value || null })} style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
          <div><span style={lbl}>Empresa</span><input defaultValue={c.empresa || ''} readOnly={!puedeEditar} onBlur={(e) => e.target.value !== (c.empresa || '') && guardar({ empresa: e.target.value || null })} style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
          <div><span style={lbl}>Vendedor de Acteck</span><input defaultValue={c.vendedor || ''} readOnly={!puedeEditar} onBlur={(e) => e.target.value !== (c.vendedor || '') && guardar({ vendedor: e.target.value || null })} style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
          <div><span style={lbl}>Mayorista</span><input defaultValue={c.mayorista || ''} readOnly={!puedeEditar} onBlur={(e) => e.target.value !== (c.mayorista || '') && guardar({ mayorista: e.target.value || null, tipo: e.target.value ? 'mayorista' : 'directa' })} placeholder="CVA, CT…" style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
          <div><span style={lbl}>Cliente en el ERP</span><input defaultValue={c.cliente_erp || ''} readOnly={!puedeEditar} onBlur={(e) => e.target.value !== (c.cliente_erp || '') && guardar({ cliente_erp: e.target.value || null })} placeholder="código" style={{ ...campo, width: '100%', boxSizing: 'border-box' }} /></div>
        </div>

        <div>
          <span style={lbl}>Qué acordamos</span>
          <textarea value={notasTxt} readOnly={!puedeEditar} onChange={(e) => setNotasTxt(e.target.value)} onBlur={() => notasTxt !== (c.notas || '') && guardar({ notas: notasTxt || null })} rows={4}
            style={{ ...campo, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.45 }} />
        </div>

        <div>
          <span style={lbl}>Bitácora · {notas.length} contacto{notas.length === 1 ? '' : 's'}</span>
          {puedeEditar && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input value={nota} onChange={(e) => setNota(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); registrar(); } }}
                placeholder="Qué pasó en este contacto…" style={{ ...campo, flex: 1, minWidth: 0 }} />
              <Boton onClick={soloNota} disabled={!nota.trim()} title="Guardar la nota sin mover el próximo seguimiento">Sólo nota</Boton>
            </div>
          )}
          {notas.map((n) => (
            <div key={n.id} style={{ padding: '6px 0', borderBottom: `1px solid ${theme.border}`, fontSize: 12 }}>
              <div style={{ fontSize: 10.5, color: theme.textMuted, fontFamily: TYPO.fontDisplay }}>{n.fecha}</div>
              <div style={{ color: theme.text, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{n.texto}</div>
            </div>
          ))}
          {!notas.length && <div style={{ fontSize: 11.5, color: theme.textMuted }}>Sin contactos registrados todavía.</div>}
        </div>

        {puedeEditar && <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Boton icon={Trash2} peligro onClick={eliminar}>Eliminar cuenta</Boton></div>}
      </div>
    </HojaLateral>
  );
}

// ─── Alta de cuenta ───
function FormCuenta({ hoy, onClose, onCreada }) {
  const { theme } = useTheme();
  const [f, setF] = useState({ nombre: '', empresa: '', telefono: '', email: '', tipo: 'directa', mayorista: '', vendedor: '', notas: '', recordar_cada_dias: 14, proximo_seguimiento: isoDia(sumarDias(hoy, 7)) });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }));
  const guardar = async () => {
    if (!f.nombre.trim()) { toast.error('Escribe el nombre del contacto'); return; }
    setBusy(true);
    try { const c = await crearCuenta({ ...f, contacto: f.nombre, recordar_cada_dias: Number(f.recordar_cada_dias) || 14 }); toast.ok('Cuenta creada'); onCreada?.(c); }
    catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const campo = { border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12.5, padding: '6px 8px', outline: 'none', width: '100%', boxSizing: 'border-box' };
  const lbl = { fontFamily: TYPO.fontDisplay, fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 600, marginBottom: 5, display: 'block' };
  return (
    <HojaLateral abierto onClose={onClose} theme={theme} ancho={440} titulo="Nueva cuenta" sub="alguien a quien quieres dar seguimiento"
      acciones={<Boton primario onClick={guardar} disabled={busy || !f.nombre.trim()}>Crear</Boton>}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '4px 4px 24px' }}>
        <div><span style={lbl}>Contacto *</span><input value={f.nombre} onChange={set('nombre')} autoFocus placeholder="Luis De Viana" style={campo} /></div>
        <div><span style={lbl}>Empresa</span><input value={f.empresa} onChange={set('empresa')} style={campo} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>Teléfono</span><input value={f.telefono} onChange={set('telefono')} placeholder="+52 55 1234 5678" style={campo} /></div>
          <div><span style={lbl}>Correo</span><input value={f.email} onChange={set('email')} style={campo} /></div>
        </div>
        <div><span style={lbl}>Tipo</span><Segmented value={f.tipo} onChange={(v) => setF((p) => ({ ...p, tipo: v }))} options={[{ id: 'directa', label: 'Directa' }, { id: 'mayorista', label: 'Vía mayorista' }]} /></div>
        {f.tipo === 'mayorista' && <div><span style={lbl}>Mayorista</span><input value={f.mayorista} onChange={set('mayorista')} placeholder="CVA" style={campo} /></div>}
        <div><span style={lbl}>Vendedor de Acteck</span><input value={f.vendedor} onChange={set('vendedor')} placeholder="Sarahi" style={campo} /></div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <div><span style={lbl}>Próximo seguimiento</span><input type="date" value={f.proximo_seguimiento} onChange={set('proximo_seguimiento')} style={campo} /></div>
          <div><span style={lbl}>Recordar cada (días)</span><input type="number" min={1} max={365} value={f.recordar_cada_dias} onChange={set('recordar_cada_dias')} style={campo} /></div>
        </div>
        <div><span style={lbl}>Qué acordamos</span><textarea value={f.notas} onChange={set('notas')} rows={4} style={{ ...campo, resize: 'vertical', lineHeight: 1.45 }} /></div>
      </div>
    </HojaLateral>
  );
}
