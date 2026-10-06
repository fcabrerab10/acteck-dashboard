// «Mi ritmo» · celular (HojaM de 4 pasos). Mismo contrato que la web (modules/agenda5/dia/ritmo.js).
import React, { useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HojaM, BotonGrande, toast } from '../../piezas';
import { setPreferencia } from '../../../lib/preferencias';
import { crearDesdeCaptura } from '../../../modules/agenda5/datos';
import { isoDia } from '../../../modules/agenda5/calculo';
import { PASOS_RITMO, normalizarRitmo, resumenRitmo, renglonesHoy, tienePausa } from '../../../modules/agenda5/dia/ritmo';
import { HORAS_DEFAULT } from '../../../modules/agenda5/dia/proponer';

export default function RitmoM({ abierto, onClose, horas, personas = [], propietario = null, hoy = new Date() }) {
  const { theme } = useTheme();
  const h0 = { ...HORAS_DEFAULT, ...(horas || {}) };
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState({ armar: h0.armar, pausa: h0.pausa, retomar: h0.retomar, cierre: h0.cierre, sinPausa: !tienePausa(h0), hoyTexto: '' });
  const [ocupado, setOcupado] = useState(false);
  const p = PASOS_RITMO[paso];
  const campo = { height: 44, borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 16, padding: '0 12px' };
  const terminar = async () => {
    const { horas: hs, error } = normalizarRitmo(f);
    if (error) { toast.error(error); setPaso(0); return; }
    setOcupado(true);
    try {
      setPreferencia('agenda.horas', hs);
      const renglones = renglonesHoy(f.hoyTexto);
      for (const r of renglones) await crearDesdeCaptura(r, { personas, propietario, hoy, extra: { cuando: isoDia(hoy), bandeja: false } });
      toast.ok(`Ritmo guardado · ${resumenRitmo(hs)}`);
      onClose?.(hs);
    } catch (e) { toast.error(e.message || String(e)); } finally { setOcupado(false); }
  };
  return (
    <HojaM abierto={abierto} onClose={() => onClose?.(null)} titulo="Mi ritmo" sub={`Paso ${paso + 1} de ${PASOS_RITMO.length}`} alto="70vh">
      <div style={{ padding: '4px 16px 16px' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text }}>{p.pregunta}</div>
        <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4, marginBottom: 16 }}>{p.ayuda}</div>
        {p.id === 'armar' && <input type="time" value={f.armar} onChange={(e) => setF({ ...f, armar: e.target.value })} style={campo} />}
        {p.id === 'cierre' && <input type="time" value={f.cierre} onChange={(e) => setF({ ...f, cierre: e.target.value })} style={campo} />}
        {p.id === 'pausa' && (<div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 15, color: theme.text }}><input type="checkbox" checked={!f.sinPausa} onChange={(e) => setF({ ...f, sinPausa: !e.target.checked })} style={{ width: 20, height: 20 }} /> Sí, hago pausa</label>
          {!f.sinPausa && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, color: theme.textMuted }}>de <input type="time" value={f.pausa} onChange={(e) => setF({ ...f, pausa: e.target.value })} style={campo} /> a <input type="time" value={f.retomar} onChange={(e) => setF({ ...f, retomar: e.target.value })} style={campo} /></div>}
        </div>)}
        {p.id === 'hoy' && <textarea value={f.hoyTexto} onChange={(e) => setF({ ...f, hoyTexto: e.target.value })} rows={6} placeholder={'llamar a Mauricio de Dicotech 11am 20 min #dicotech\nrevisar precios de monitores'} style={{ ...campo, height: 'auto', padding: 12, width: '100%', resize: 'vertical', lineHeight: 1.4 }} />}
        {p.id === 'hoy' && <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 10 }}>Tu ritmo: {resumenRitmo(normalizarRitmo(f).horas || h0)}</div>}
        <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
          {paso > 0 && <BotonGrande onClick={() => setPaso(paso - 1)}>Atrás</BotonGrande>}
          {paso < PASOS_RITMO.length - 1 ? <BotonGrande primario onClick={() => setPaso(paso + 1)}>Siguiente</BotonGrande> : <BotonGrande primario disabled={ocupado} onClick={terminar}>Listo</BotonGrande>}
        </div>
      </div>
    </HojaM>
  );
}
