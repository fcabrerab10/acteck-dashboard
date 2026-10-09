// Agenda «que te lleva» (V6 · 2026-10-08) · pop-up «Organiza tu día»: sale la primera vez que entras al dashboard cada día
// (en cualquier pestaña). Pasos: (0) si ayer no se cerró, cerrarlo primero · (1) lo que quedó de antes: Hoy · Esta semana ·
// Ya no · (2) el negocio propone: Sí · No · (3) lo nuevo: un renglón por pendiente, chips de lo entendido · «Listo, a trabajar».
// `OrganizaCuerpo` es el contenido puro (lo usan el Modal web y la HojaM del celular).
import React, { useMemo, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Pill, toast } from '../../components/kit';
import { Modal } from '../../components/perfil/comun';
import { fechaLarga } from '../agenda5/base/textos';
import { nombreClienteAgenda } from '../agenda5/base/etiquetas';
import { useFuentesDia, propuestasDe } from '../agenda5/dia/datos';
import { interpretarLibre } from './calculo';
import { accionItem, decidirPropuesta, cerrarDiaV6, marcarOrganizado, crearLibre } from './datos';
import { FilaRapida, ChipsInterp, fechaCorta } from './piezas';

/** Interpreta cada renglón de «Lo nuevo» por separado. */
export function renglonesNuevos(texto, personas, hoy) {
  return String(texto || '').split('\n').map((l) => l.trim()).filter(Boolean).map((l) => ({ texto: l, i: interpretarLibre(l, personas, hoy) }));
}

export function OrganizaCuerpo({ d, uid, propietario, hoy, hoyIso, horas, estado, puedeEditar, onListo, onAbrirItem, movil = false }) {
  const { theme } = useTheme();
  const [paso, setPaso] = useState(estado.ayerSinCerrar ? 0 : 1);
  const [nuevo, setNuevo] = useState('');
  const [ocupado, setOcupado] = useState(false);
  const fuentes = useFuentesDia({ uid: propietario, hoy, enabled: paso >= 1 });
  const propuestas = useMemo(() => propuestasDe(fuentes.data, { items: d.items, reuniones: d.reuniones, hoyIso, horas }), [fuentes.data, d.items, d.reuniones, hoyIso, horas]);
  const [decididas, setDecididas] = useState(new Set());
  const pendientesProp = propuestas.filter((p) => !decididas.has(p.id));
  const renglones = useMemo(() => renglonesNuevos(nuevo, d.personas, hoy), [nuevo, d.personas, hoy]);

  const cerrarAyer = async () => {
    setOcupado(true);
    try { await cerrarDiaV6(propietario, estado.ayerIso, { resumen: 'Cerrado al organizar el día siguiente' }, []); toast.ok(`${fechaCorta(estado.ayerIso)} cerrado`); setPaso(1); }
    catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };
  const decide = async (p, dec) => {
    setDecididas((s) => new Set([...s, p.id]));
    try { await decidirPropuesta(uid, hoyIso, p, dec, { propietario }); } catch (e) { toast.error(e.message); setDecididas((s) => { const n = new Set(s); n.delete(p.id); return n; }); }
  };
  const listo = async () => {
    setOcupado(true);
    try {
      for (const r of renglones) await crearLibre(r.texto, { personas: d.personas, propietario, hoy, interp: { ...r.i, cuando: r.i.cuando || hoyIso, bandeja: false } });
      await marcarOrganizado(propietario, hoyIso);
      toast.ok(renglones.length ? `Día organizado · ${renglones.length} nuevo${renglones.length === 1 ? '' : 's'}` : 'Día organizado');
      onListo?.();
    } catch (e) { toast.error(e.message); } finally { setOcupado(false); }
  };

  const Tit = ({ children, meta }) => <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, margin: '14px 0 6px' }}><span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 700, color: theme.text }}>{children}</span>{meta && <span style={{ fontSize: 11.5, color: theme.textMuted }}>{meta}</span>}</div>;
  const btn = (primario) => ({ border: primario ? 0 : `1px solid ${theme.border}`, borderRadius: 999, padding: movil ? '10px 16px' : '8px 14px', background: primario ? theme.accent : theme.surface, color: primario ? '#fff' : theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 700, cursor: 'pointer', minHeight: movil ? 44 : 34 });

  if (paso === 0) return (
    <div style={{ padding: movil ? '0 16px 16px' : 0 }}>
      <div style={{ fontSize: 15, color: theme.text, lineHeight: 1.45 }}>
        <b>{fechaLarga(new Date(`${estado.ayerIso}T12:00:00`)).replace(/^./, (c) => c.toUpperCase())}</b> no se cerró. Hiciste <b>{estado.ayer.hechas} de {estado.ayer.total}</b>; lo que quedó abierto lo verás en el siguiente paso.
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
        <button type="button" disabled={ocupado} onClick={cerrarAyer} style={btn(true)}>Cerrar {estado.ayerIso === estado.hoyIso ? 'hoy' : 'ese día'} y seguir</button>
        <button type="button" onClick={() => setPaso(1)} style={btn(false)}>Dejarlo así</button>
      </div>
    </div>
  );

  return (
    <div style={{ padding: movil ? '0 16px 16px' : 0, display: 'flex', flexDirection: 'column' }}>
      <Tit meta={estado.quedo.length ? `${estado.quedo.length} de antes` : 'nada quedó'}>Lo que quedó</Tit>
      {estado.quedo.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Nada pendiente de días anteriores.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {estado.quedo.map((it) => <FilaRapida key={it.id} item={it} uid={uid} personasPorId={d.personasPorId} personas={d.personas} hoyIso={hoyIso} puedeEditar={puedeEditar} onAbrir={onAbrirItem} mostrarFecha seleccionada={movil} acciones={['hoy', 'semana', 'yano']} compacta={!movil} />)}
      </div>

      <Tit meta={fuentes.isLoading ? 'buscando…' : pendientesProp.length ? `${pendientesProp.length}` : 'nada hoy'}>El negocio propone</Tit>
      {!fuentes.isLoading && pendientesProp.length === 0 && <div style={{ fontSize: 12.5, color: theme.textMuted }}>Pagos, cuentas, propuestas, acuerdos y cargas están al corriente.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {pendientesProp.slice(0, 8).map((p) => (
          <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 10px', borderRadius: 11, border: `1px solid ${theme.border}`, background: theme.surface }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.titulo}</div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.porque || p.sub}{p.accion?.clienteKey ? ` · ${nombreClienteAgenda(p.accion.clienteKey)}` : ''}</div>
            </div>
            {puedeEditar && <>
              <button type="button" onClick={() => decide(p, 'aceptada')} style={{ ...btn(true), padding: '5px 12px', minHeight: movil ? 40 : 28, fontSize: 12 }}>Sí</button>
              <button type="button" onClick={() => decide(p, 'descartada')} style={{ ...btn(false), padding: '5px 12px', minHeight: movil ? 40 : 28, fontSize: 12 }}>No</button>
            </>}
          </div>
        ))}
      </div>

      <Tit meta="un renglón por pendiente">Lo nuevo</Tit>
      <textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} rows={movil ? 3 : 3} disabled={!puedeEditar}
        placeholder={'Pedirle a Karolina los estados de cuenta de Dicotech\nLlamar a Carlos de Digitalife 11am\nRevisar la propuesta de PCEL'}
        style={{ width: '100%', boxSizing: 'border-box', border: `1px solid ${theme.border}`, borderRadius: 12, padding: '10px 12px', background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: movil ? 16 : 13.5, lineHeight: 1.45, resize: 'vertical', outline: 'none' }} />
      {renglones.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 6 }}>
          {renglones.map((r, k) => (
            <div key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 12, color: theme.textMuted }}>
              <span style={{ color: theme.text, fontWeight: 500, maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.i.titulo || r.texto}</span>
              <ChipsInterp chips={r.i.chips.length ? r.i.chips : [{ tipo: 'fecha', label: 'hoy' }]} />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginTop: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <button type="button" disabled={ocupado || !puedeEditar} onClick={listo} style={{ ...btn(true), flex: movil ? 1 : 'none' }}>Listo, a trabajar{renglones.length ? ` (${renglones.length} nuevo${renglones.length === 1 ? '' : 's'})` : ''}</button>
        {!movil && <span style={{ fontSize: 11.5, color: theme.textMuted }}>Lo que no decidas hoy sigue en Pendientes.</span>}
        {estado.h.deHoy.length > 0 && <Pill size="xs" tone="blue" style={{ marginLeft: 'auto' }}>{estado.h.deHoy.length} ya para hoy</Pill>}
      </div>
    </div>
  );
}

/** Web: Modal centrado. */
export default function OrganizaDia({ abierto, onClose, d, uid, propietario, hoy, hoyIso, horas, estado, puedeEditar, nombre, onAbrirItem }) {
  const { theme } = useTheme();
  if (!abierto || !estado) return null;
  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} ancho={600} zIndex={95}
      titulo={`${nombre ? `${nombre}, o` : 'O'}rganiza tu día`} sub={fechaLarga(hoy).replace(/^./, (c) => c.toUpperCase())}>
      <OrganizaCuerpo d={d} uid={uid} propietario={propietario} hoy={hoy} hoyIso={hoyIso} horas={horas} estado={estado} puedeEditar={puedeEditar} onListo={onClose} onAbrirItem={onAbrirItem} />
    </Modal>
  );
}
