// Agenda móvil V4 · Cuentas que sigo: lista con semáforo del próximo seguimiento y hoja con
// bitácora, "Registrar contacto", llamar y WhatsApp (tel: / wa.me). Mismos datos que la web.
import React, { useMemo, useState } from 'react';
import { Phone, MessageCircle, CheckCircle2, ListPlus } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { cuentasOrdenadas, ESTADOS_CUENTA, enlacesContacto, cuando, registrarContacto } from '../../../modules/agenda/calculo';
import { registrarContactoCuenta, agregarNotaCuenta, actualizarCuenta, crearPendienteDeCuenta } from '../../../modules/agenda/datos';
import { HojaM, BotonGrande, Segmented, CampoBusqueda, Vacio, Pill, toast } from '../../piezas';
import { MONO } from '../../util';
import { useAgenda } from './Agenda';
import { CampoM, lbl } from './comun';

export default function Cuentas() {
  const { theme } = useTheme();
  const { cuentas, notasPorCuenta, personas, hoy, puedeEditar, setVista } = useAgenda();
  const [estado, setEstado] = useState('activa');
  const [q, setQ] = useState('');
  const [abierta, setAbierta] = useState(null);

  const lista = useMemo(() => cuentasOrdenadas(cuentas, { hoy, estado, q }), [cuentas, hoy, estado, q]);
  const cuenta = abierta ? cuentas.find((c) => c.id === abierta) : null;

  return (
    <>
      <div style={{ padding: '0 16px 4px' }}>
        <Segmented size="md" value={estado} onChange={setEstado} options={ESTADOS_CUENTA.map((e) => ({ id: e.id, label: e.label }))} style={{ display: 'flex', width: '100%' }} />
      </div>
      <div style={{ padding: '10px 16px 4px' }}><CampoBusqueda value={q} onChange={setQ} placeholder="nombre, empresa o mayorista" /></div>
      <div style={{ padding: '4px 16px 80px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {lista.map((c) => {
          const tel = enlacesContacto(c.telefono);
          return (
            <div key={c.id} onClick={() => setAbierta(c.id)} role="button"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, fontFamily: TYPO.fontText, cursor: 'pointer' }}>
              <span style={{ width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: c.seg.tone === 'red' ? theme.red : c.seg.tone === 'orange' ? theme.orange : theme.border }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.nombre}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {[c.empresa, c.mayorista ? `vía ${c.mayorista}` : 'directa', c.vendedor ? `vend. ${c.vendedor}` : null].filter(Boolean).join(' · ')}
                </div>
              </div>
              <Pill tone={c.seg.tone} size="xs" dot={c.seg.nivel === 'vencido'}>{c.seg.label}</Pill>
              {tel.tel && <a href={tel.tel} onClick={(e) => e.stopPropagation()} aria-label={`Llamar a ${c.nombre}`} style={{ color: theme.accent, display: 'inline-flex', padding: 6 }}><Phone size={18} /></a>}
              {tel.whatsapp && <a href={tel.whatsapp} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} aria-label="WhatsApp" style={{ color: theme.green, display: 'inline-flex', padding: 6 }}><MessageCircle size={18} /></a>}
            </div>
          );
        })}
        {!lista.length && <Vacio titulo={q ? 'Ninguna cuenta coincide' : 'Sin cuentas aquí'} sub="Las cuentas se dan de alta desde la computadora." />}
      </div>

      <HojaM abierto={!!cuenta} onClose={() => setAbierta(null)} titulo={cuenta?.nombre || ''}
        sub={cuenta ? [cuenta.empresa, cuenta.mayorista ? `vía ${cuenta.mayorista}` : 'cuenta directa'].filter(Boolean).join(' · ') : ''} alto="88vh">
        {cuenta && <DetalleCuenta cuenta={cuenta} notas={notasPorCuenta?.get(cuenta.id) || []} personas={personas} hoy={hoy} puedeEditar={puedeEditar}
          onClose={() => setAbierta(null)} onVerPendientes={() => { setAbierta(null); setVista?.('pendientes'); }} />}
      </HojaM>
    </>
  );
}

function DetalleCuenta({ cuenta: c, notas, personas, hoy, puedeEditar, onVerPendientes }) {
  const { theme } = useTheme();
  const [nota, setNota] = useState('');
  const [busy, setBusy] = useState(false);
  const tel = enlacesContacto(c.telefono);

  const registrar = async () => {
    setBusy(true);
    try {
      await registrarContactoCuenta(c, nota, hoy);
      setNota('');
      toast.ok(`Contacto registrado · próximo ${cuando(registrarContacto(c, hoy).proximo_seguimiento, hoy)}`);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };
  const soloNota = async () => { if (!nota.trim()) return; try { await agregarNotaCuenta(c, nota, { hoy }); setNota(''); toast.ok('Nota guardada'); } catch (e) { toast.error(e.message); } };
  const pendiente = async () => { try { await crearPendienteDeCuenta(c, {}, personas); toast.ok('Pendiente creado'); onVerPendientes?.(); } catch (e) { toast.error(e.message); } };
  const cadencia = async (d) => { try { await actualizarCuenta(c.id, { recordar_cada_dias: d }); toast.ok(`Recordar cada ${d} días`); } catch (e) { toast.error(e.message); } };

  return (
    <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 14, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', gap: 8 }}>
        {tel.tel && <BotonGrande icon={Phone} onClick={() => window.location.assign(tel.tel)} style={{ flex: 1 }}>Llamar</BotonGrande>}
        {tel.whatsapp && <BotonGrande icon={MessageCircle} onClick={() => window.open(tel.whatsapp, '_blank', 'noopener')} style={{ flex: 1 }}>WhatsApp</BotonGrande>}
      </div>

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 13, color: theme.textMuted }}>
        <span>Próximo: <b style={{ fontFamily: MONO, color: c.seg?.tone === 'red' ? theme.red : theme.text }}>{c.proximo_seguimiento || '—'}</b></span>
        <span>Último: <b style={{ fontFamily: MONO, color: theme.text }}>{c.ultimo_contacto || 'nunca'}</b></span>
      </div>

      {c.notas && <div style={{ fontSize: 13.5, color: theme.text, lineHeight: 1.45, whiteSpace: 'pre-wrap', background: theme.bg, borderRadius: 12, padding: '10px 12px' }}>{c.notas}</div>}

      {puedeEditar && (
        <>
          <div>
            <span style={lbl(theme)}>Registrar contacto</span>
            <CampoM multiline value={nota} onChange={setNota} placeholder="Qué pasó en este contacto…" />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <BotonGrande onClick={soloNota} disabled={!nota.trim()} style={{ flex: 1 }}>Sólo nota</BotonGrande>
            <BotonGrande primario icon={CheckCircle2} onClick={registrar} disabled={busy} style={{ flex: 1.4 }}>Registrar</BotonGrande>
          </div>
          <div>
            <span style={lbl(theme)}>Recordar cada</span>
            <Segmented size="md" value={String(c.recordar_cada_dias)} onChange={(v) => cadencia(Number(v))}
              options={[7, 14, 30, 60].map((d) => ({ id: String(d), label: `${d} d` }))} style={{ display: 'flex', width: '100%' }} />
          </div>
          <BotonGrande icon={ListPlus} onClick={pendiente}>Crear pendiente ligado</BotonGrande>
        </>
      )}

      <div>
        <span style={lbl(theme)}>Bitácora · {notas.length}</span>
        {notas.map((n) => (
          <div key={n.id} style={{ padding: '8px 0', borderBottom: `1px solid ${theme.border}` }}>
            <div style={{ fontFamily: MONO, fontSize: 11, color: theme.textMuted }}>{n.fecha}</div>
            <div style={{ fontSize: 13.5, color: theme.text, lineHeight: 1.45, whiteSpace: 'pre-wrap' }}>{n.texto}</div>
          </div>
        ))}
        {!notas.length && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Sin contactos registrados todavía.</div>}
      </div>
    </div>
  );
}
