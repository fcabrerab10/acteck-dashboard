// Agenda web · "Repartir" (2026-09-21, propuesta A «Anota y reparte al cerrar»).
// Hoja lateral con una fila por acuerdo detectado en las Notas de la reunión: palomita para incluir,
// responsable, fecha y #cliente. «Crear N pendientes y cerrar minuta» crea los puntos y cierra con el
// mismo RPC (agenda_cerrar_reunion) que el botón de siempre; «Sólo guardar notas» no crea nada.
// La detección vive en reparto.js y la comparte la app móvil (móvil: src/movil/pestanas/agenda/Reparto.jsx).
import React, { useMemo, useState } from 'react';
import { Lock } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { HojaLateral } from '../../components/perfil/comun';
import { Boton, Pill, toast } from '../../components/kit';
import { cuando } from './calculo';
import { opcionesFecha, textoReparto } from './reparto';
import { repartirAcuerdos } from './datos';
import { Palomita, TagCliente } from './comun';

export default function HojaReparto({ abierto, onClose, reunion, filas, personas, hoy, orden0 = 0, onListo }) {
  const { theme } = useTheme();
  const [edicion, setEdicion] = useState(() => new Map());
  const [busy, setBusy] = useState(false);
  const fechas = useMemo(() => opcionesFecha(hoy), [hoy]);
  const vista = useMemo(() => filas.map((f) => ({ ...f, ...(edicion.get(f.id) || {}) })), [filas, edicion]);
  const n = vista.filter((f) => f.incluir).length;
  const parchar = (id, cambios) => setEdicion((m) => { const x = new Map(m); x.set(id, { ...(x.get(id) || {}), ...cambios }); return x; });

  if (!abierto) return null;
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

  const sel = { border: `1px solid ${theme.border}`, borderRadius: 8, background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, padding: '2px 6px' };
  return (
    <HojaLateral abierto onClose={onClose} theme={theme} ancho={560} titulo="Repartir acuerdos"
      sub={filas.length ? `${filas.length} detectado${filas.length === 1 ? '' : 's'} en las notas` : 'Sin acuerdos en las notas'}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '4px 4px 24px', fontFamily: TYPO.fontText }}>
        {!filas.length && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Empieza una línea con «-», menciona a alguien con @ o pon una fecha («el viernes») para que cuente como acuerdo.</div>}
        {vista.map((f) => (
          <div key={f.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', border: `1px solid ${theme.border}`, borderRadius: 10, background: theme.surface, padding: 10, opacity: f.incluir ? 1 : 0.5 }}>
            <div style={{ paddingTop: 2 }}><Palomita hecha={f.incluir} onClick={() => parchar(f.id, { incluir: !f.incluir })} title="Incluir en el reparto" /></div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: theme.text }}>{f.titulo}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginTop: 6 }}>
                <select value={f.persona || ''} onChange={(e) => parchar(f.id, { persona: e.target.value || null })} style={sel} aria-label="Responsable">
                  <option value="">Sin responsable</option>
                  {personas.map((p) => <option key={p.user_id} value={p.user_id}>{p.nombre}</option>)}
                </select>
                <select value={f.fecha || ''} onChange={(e) => parchar(f.id, { fecha: e.target.value || null })} style={sel} aria-label="Cuándo">
                  <option value="">Sin fecha</option>
                  {fechas.filter((o) => o.fecha).map((o) => <option key={o.id} value={o.fecha}>{o.label}</option>)}
                  {f.fecha && !fechas.some((o) => o.fecha === f.fecha) && <option value={f.fecha}>{cuando(f.fecha, hoy)}</option>}
                </select>
                <input type="date" value={f.fecha || ''} onChange={(e) => parchar(f.id, { fecha: e.target.value || null })} style={{ ...sel, width: 122 }} aria-label="Fecha" />
                <TagCliente clienteKey={f.clienteKey || reunion?.cliente_key} />
                {f.yaExiste && <Pill tone="orange" size="xs">ya está en la minuta</Pill>}
              </div>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 }}>
          <Boton icon={Lock} primario disabled={!n || busy} onClick={crear}>{n ? `Crear ${n} pendiente${n === 1 ? '' : 's'} y cerrar minuta` : 'Nada seleccionado'}</Boton>
          <Boton onClick={onClose}>Sólo guardar notas</Boton>
        </div>
      </div>
    </HojaLateral>
  );
}
