// Agenda «que te lleva» (V6 · 2026-10-08) · captura libre en el celular: HojaM con campo multilínea, dictado, chips de lo
// entendido (× para quitar), avatares «Mandar a» (44 px, varios) y clientes; Guardar grande. Sin fecha → hoy.
import React, { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { HojaM, BotonGrande, toast } from '../../piezas';
import { CLIENTES_AGENDA } from '../../../modules/agenda5/base/etiquetas';
import { useCapturaLibre } from '../../../modules/agenda6/Captura6';
import { ChipsInterp, AvataresMandar } from '../../../modules/agenda6/piezas';
import { CampoM, BotonMic, lbl } from '../agenda5/comun';

export default function CapturaM6({ abierto, onClose, personas, propietario, uid, hoy, inicial = '' }) {
  const { theme } = useTheme();
  const cap = useCapturaLibre({ personas, hoy, uid });
  const ref = useRef(null);
  useEffect(() => { if (abierto) { cap.reset(); if (inicial) cap.setTexto(inicial); setTimeout(() => ref.current?.focus(), 140); } }, [abierto, inicial]); // eslint-disable-line react-hooks/exhaustive-deps
  const i = cap.i;
  const crear = async () => {
    if (!cap.texto.trim()) return;
    try {
      const r = await cap.crear({ propietario });
      const fecha = r.interpretado.chips.find((c) => c.tipo === 'fecha')?.label || (r.interpretado.cuando ? 'hoy' : 'sin fecha');
      toast.ok(`Guardado · ${fecha}`); onClose?.();
    } catch (e) { toast.error(e.message); }
  };
  const sinFecha = i && !i.cuando && !i.fecha_limite;
  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Nuevo" sub="Escribe como hablas: a quién, de qué cliente, cuándo" alto="72vh">
      <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <CampoM inputRef={ref} multiline value={cap.texto} onChange={cap.setTexto} onEnter={crear} placeholder="Pedirle a Karolina los estados de cuenta de Dicotech para el lunes" style={{ fontSize: 16 }} />
          <BotonMic onTexto={(t) => cap.setTexto((cap.texto ? `${cap.texto} ` : '') + t)} />
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minHeight: 28, alignItems: 'center' }}>
          {!i && <span style={{ fontSize: 12.5, color: theme.textMuted }}>Entiende «mañana», «lunes», «11am», «30m», nombres del equipo y clientes. También #cliente y @persona.</span>}
          {i && <ChipsInterp size={12.5} chips={sinFecha ? [{ tipo: 'fecha', label: 'hoy' }, ...i.chips] : i.chips} onQuitar={(c) => { if (c.label !== 'hoy') cap.quitar(c); }} />}
        </div>
        {i && <>
          <div><span style={lbl(theme)}>Mandar a</span><AvataresMandar personas={personas} uid={uid} valor={i.responsables} compacto size={40} onChange={(r) => cap.setMandarA(r.filter((u) => u !== uid))} /></div>
          <div><span style={lbl(theme)}>Cliente</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CLIENTES_AGENDA.filter((c) => c.key !== 'interno').slice(0, 8).map((c) => { const on = i.clientes.includes(c.key); return (
                <button key={c.key} type="button" onClick={() => cap.toggleCliente(c.key)} aria-pressed={on} style={{ minHeight: 36, border: `1px solid ${on ? '#C77700' : theme.border}`, background: on ? 'rgba(255,159,10,0.16)' : theme.surface, color: on ? '#C77700' : theme.text, borderRadius: 999, padding: '0 12px', fontSize: 13, fontWeight: 600, fontFamily: TYPO.fontDisplay }}>{c.label}</button>); })}
            </div>
          </div>
        </>}
        <BotonGrande primario icon={Check} onClick={crear} disabled={!i}>Guardar</BotonGrande>
      </div>
    </HojaM>
  );
}
