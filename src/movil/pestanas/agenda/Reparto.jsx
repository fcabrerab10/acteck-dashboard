// Agenda móvil · hoja "Repartir": una fila por acuerdo detectado en las notas de la minuta.
// Cada fila = palomita (incluir) · título · quién · cuándo · #cliente. Al tocarla se abren los chips
// de persona (sólo internos con agenda) y de fecha (hoy · mañana · viernes · próxima semana · fecha…).
// Pie: «Crear N pendientes y cerrar minuta» (crea los puntos y llama al RPC agenda_cerrar_reunion)
// y «Sólo guardar notas» (las notas ya se guardaron solas; sólo cierra la hoja).
// La detección y el armado de filas viven en src/modules/agenda/reparto.js (lo comparte la web).
import React, { useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, Lock } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { cuando } from '../../../modules/agenda/calculo';
import { nombreClienteAgenda } from '../../../modules/agenda/etiquetas';
import { opcionesFecha, textoReparto } from '../../../modules/agenda/reparto';
import { repartirAcuerdos } from '../../../modules/agenda/datos';
import { HojaM, BotonGrande, Vacio, toast } from '../../piezas';
import { PalomitaM, ChipM, TagCliente, primerNombre } from './comun';

export default function Reparto({ abierto, onClose, reunion, filas, personas, hoy, orden0 = 0, onListo }) {
  const { theme } = useTheme();
  const [edicion, setEdicion] = useState(() => new Map());   // id → { incluir, persona, fecha }
  const [abierta, setAbierta] = useState(null);
  const [busy, setBusy] = useState(false);
  const fechas = useMemo(() => opcionesFecha(hoy), [hoy]);

  const vista = useMemo(() => filas.map((f) => ({ ...f, ...(edicion.get(f.id) || {}) })), [filas, edicion]);
  const n = vista.filter((f) => f.incluir).length;
  const parchar = (id, cambios) => setEdicion((m) => { const x = new Map(m); x.set(id, { ...(x.get(id) || {}), ...cambios }); return x; });

  const crear = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await repartirAcuerdos({ reunion, filas: vista, orden0, cerrar: true }, personas);
      toast.ok(textoReparto(r.creados), { ms: 5000 });
      onClose?.();
      onListo?.(r);
    } catch (e) { toast.error(e.message); }
    setBusy(false);
  };

  return (
    <HojaM abierto={abierto} onClose={onClose} titulo="Repartir acuerdos" alto="86vh"
      sub={filas.length ? `${filas.length} detectado${filas.length === 1 ? '' : 's'} · toca una fila para cambiar quién y cuándo` : 'Sin acuerdos en las notas'}>
      <div style={{ padding: '0 16px 8px' }}>
        {!filas.length && <Vacio titulo="Nada que repartir" sub="Empieza una línea con «-», menciona a alguien con @ o pon una fecha («el viernes») para que cuente como acuerdo." />}
        {vista.map((f) => {
          const abiertaEsta = abierta === f.id;
          const persona = personas.find((p) => p.user_id === f.persona);
          return (
            <div key={f.id} style={{ borderBottom: `1px solid ${theme.border}`, padding: '10px 0', opacity: f.incluir ? 1 : 0.45 }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <div style={{ paddingTop: 1 }}><PalomitaM hecha={f.incluir} onClick={() => parchar(f.id, { incluir: !f.incluir })} /></div>
                <button type="button" onClick={() => setAbierta(abiertaEsta ? null : f.id)}
                  style={{ flex: 1, minWidth: 0, border: 0, background: 'transparent', padding: 0, textAlign: 'left', cursor: 'pointer', color: theme.text }}>
                  <div style={{ fontFamily: TYPO.fontText, fontSize: 15, lineHeight: 1.3, color: theme.text }}>{f.titulo}</div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 4, fontSize: 11.5, color: theme.textMuted }}>
                    <span>{persona ? primerNombre(persona.nombre) : 'sin responsable'}</span>
                    <span>·</span>
                    <span style={{ color: f.fecha ? theme.text : theme.textMuted }}>{f.fecha ? cuando(f.fecha, hoy) : 'sin fecha'}</span>
                    {f.clienteKey && <TagCliente clienteKey={f.clienteKey} size="sm" />}
                    {f.yaExiste && <span style={{ color: theme.orange }}>ya está en la minuta</span>}
                  </div>
                </button>
                <span style={{ color: theme.textMuted, paddingTop: 2 }}>{abiertaEsta ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</span>
              </div>
              {abiertaEsta && (
                <div style={{ paddingLeft: 32, marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {personas.map((p) => (
                      <ChipM key={p.user_id} on={f.persona === p.user_id} tone="blue" onClick={() => parchar(f.id, { persona: f.persona === p.user_id ? null : p.user_id })}>
                        {f.persona === p.user_id && <Check size={12} />}{primerNombre(p.nombre)}
                      </ChipM>
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    {fechas.map((o) => <ChipM key={o.id} on={(f.fecha || null) === o.fecha} tone="green" onClick={() => parchar(f.id, { fecha: o.fecha })}>{o.label}</ChipM>)}
                    <input type="date" value={f.fecha || ''} onChange={(e) => parchar(f.id, { fecha: e.target.value || null })} aria-label="Fecha"
                      style={{ border: `1px solid ${theme.border}`, borderRadius: 999, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 12, padding: '5px 10px', minHeight: 30 }} />
                  </div>
                  <div style={{ fontSize: 11.5, color: theme.textMuted }}>Queda como acuerdo de {nombreClienteAgenda(f.clienteKey || reunion?.cliente_key)}.</div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div style={{ padding: '10px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BotonGrande primario icon={Lock} disabled={!n || busy} onClick={crear}>
          {n ? `Crear ${n} pendiente${n === 1 ? '' : 's'} y cerrar minuta` : 'Nada seleccionado'}
        </BotonGrande>
        <BotonGrande onClick={onClose}>Sólo guardar notas</BotonGrande>
      </div>
    </HojaM>
  );
}
