// «Mi ritmo» · web. Modal de 4 pasos la primera vez que la persona entra a su Agenda (sin horas guardadas) y desde el
// botón «Mi ritmo». Guarda las horas en preferencias.agenda.horas (setPreferencia → RPC set_preferencias) y crea los
// pendientes de hoy con crearDesdeCaptura (cuando = hoy).
import React, { useState } from 'react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Modal } from '../../../components/perfil/comun';
import { Boton, toast } from '../../../components/kit';
import { setPreferencia } from '../../../lib/preferencias';
import { crearDesdeCaptura } from '../datos';
import { isoDia } from '../calculo';
import { PASOS_RITMO, normalizarRitmo, resumenRitmo, renglonesHoy, tienePausa } from './ritmo';
import { HORAS_DEFAULT } from './proponer';

export default function Ritmo({ abierto, onClose, horas, personas = [], propietario = null, hoy = new Date() }) {
  const { theme } = useTheme();
  const h0 = { ...HORAS_DEFAULT, ...(horas || {}) };
  const [paso, setPaso] = useState(0);
  const [f, setF] = useState({ armar: h0.armar, pausa: h0.pausa, retomar: h0.retomar, cierre: h0.cierre, sinPausa: !tienePausa(h0), hoyTexto: '' });
  const [ocupado, setOcupado] = useState(false);
  const p = PASOS_RITMO[paso];
  const campo = { height: 36, borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 14, padding: '0 10px' };
  const terminar = async () => {
    const { horas: hs, error } = normalizarRitmo(f);
    if (error) { toast.error(error); setPaso(0); return; }
    setOcupado(true);
    try {
      setPreferencia('agenda.horas', hs);
      const renglones = renglonesHoy(f.hoyTexto);
      for (const r of renglones) await crearDesdeCaptura(r, { personas, propietario, hoy, extra: { cuando: isoDia(hoy), bandeja: false } });
      toast.ok(`Ritmo guardado · ${resumenRitmo(hs)}${renglones.length ? ` · ${renglones.length} para hoy` : ''}`);
      onClose?.(hs);
    } catch (e) { toast.error(e.message || String(e)); } finally { setOcupado(false); }
  };
  return (
    <Modal abierto={abierto} onClose={() => onClose?.(null)} theme={theme} ancho={460} titulo="Mi ritmo" sub={`Paso ${paso + 1} de ${PASOS_RITMO.length}`}
      pie={<div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>{paso > 0 && <Boton onClick={() => setPaso(paso - 1)}>Atrás</Boton>}{paso < PASOS_RITMO.length - 1 ? <Boton primario onClick={() => setPaso(paso + 1)}>Siguiente</Boton> : <Boton primario disabled={ocupado} onClick={terminar}>Listo</Boton>}</div>}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 19, fontWeight: 700, letterSpacing: '-0.02em', color: theme.text }}>{p.pregunta}</div>
      <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 4, marginBottom: 14 }}>{p.ayuda}</div>
      {p.id === 'armar' && <input type="time" value={f.armar} onChange={(e) => setF({ ...f, armar: e.target.value })} style={campo} />}
      {p.id === 'cierre' && <input type="time" value={f.cierre} onChange={(e) => setF({ ...f, cierre: e.target.value })} style={campo} />}
      {p.id === 'pausa' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.text }}><input type="checkbox" checked={!f.sinPausa} onChange={(e) => setF({ ...f, sinPausa: !e.target.checked })} /> Sí, hago pausa</label>
          {!f.sinPausa && <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.textMuted }}>de <input type="time" value={f.pausa} onChange={(e) => setF({ ...f, pausa: e.target.value })} style={campo} /> a <input type="time" value={f.retomar} onChange={(e) => setF({ ...f, retomar: e.target.value })} style={campo} /></div>}
        </div>
      )}
      {p.id === 'hoy' && <textarea value={f.hoyTexto} onChange={(e) => setF({ ...f, hoyTexto: e.target.value })} rows={6} placeholder={'llamar a Mauricio de Dicotech 11am 20 min #dicotech\nrevisar precios de monitores\n…'} style={{ ...campo, height: 'auto', padding: 10, width: '100%', resize: 'vertical', lineHeight: 1.4 }} />}
      {p.id === 'hoy' && <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 10 }}>Tu ritmo: {resumenRitmo(normalizarRitmo(f).horas || h0)}</div>}
    </Modal>
  );
}
