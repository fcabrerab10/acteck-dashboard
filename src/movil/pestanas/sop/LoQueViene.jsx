// S&OP del celular · «Lo que viene» (push): arribos por PO ordenados por fecha (vencidas arriba) o agrupados por
// proveedor; tocar una PO abre su ficha. Abajo, plegados, los tiempos reales por proveedor y naviera (mediana de los
// contenedores ya arribados en el año · v_embarques_*). 2026-10-05.
import React, { useMemo, useState } from 'react';
import { Ship, Factory, Anchor, ChevronDown, ChevronUp } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, ListaAgrupada, Fila, Segmented, Vacio } from '../../piezas';
import { useEmbarquesTiempos, resumen as resumenEmb, nombreProveedor } from '../../../modules/comercial/forecast/useEmbarquesTiempos';
import { int } from '../../util';
import { fechaCorta, cedisCorto, estatusCorto, usdCompact } from './calculo';
import FichaPO from './FichaPO';

const MESES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const VISTAS = [{ id: 'fecha', label: 'Por fecha' }, { id: 'proveedor', label: 'Por proveedor' }];

function FilaPO({ p, theme, onClick }) {
  return (
    <Fila icon={Ship} color={p.vencida ? theme.red : p.dias != null && p.dias <= 7 ? theme.green : theme.accent}
      titulo={`PO ${p.po} · ${p.nSkus} SKU${p.nSkus === 1 ? '' : 's'}`}
      sub={[p.vencida ? `ETA vencida ${Math.abs(p.dias)} d` : estatusCorto(p.estatus) || null, p.naviera, cedisCorto(p.cedis) || null, p.supplier].filter(Boolean).slice(0, 3).join(' · ')}
      valor={`${int(p.piezas)} pz`} valorSub={p.eta ? fechaCorta(p.eta) : 'sin ETA'} pill={p.urgen ? { tone: 'red', label: `resuelve ${p.urgen}` } : null} onClick={onClick} />
  );
}

export function LoQueVieneVista({ arribos = [], sensible = false, vista = 'fecha', onVista, onPo, tiempos = null }) {
  const { theme } = useTheme();
  const [verTiempos, setVerTiempos] = useState(false);
  const grupos = useMemo(() => {
    if (vista === 'proveedor') {
      const m = new Map();
      for (const p of arribos) { const k = p.supplier || 'Sin proveedor'; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
      return [...m.entries()].map(([titulo, lista]) => ({ titulo: nombreProveedor(titulo), lista })).sort((a, b) => b.lista.reduce((s, p) => s + p.piezas, 0) - a.lista.reduce((s, p) => s + p.piezas, 0));
    }
    const vencidas = arribos.filter((p) => p.vencida);
    const m = new Map();
    for (const p of arribos) { if (p.vencida) continue; const k = p.eta ? String(p.eta).slice(0, 7) : 'sin'; if (!m.has(k)) m.set(k, []); m.get(k).push(p); }
    const out = vencidas.length ? [{ titulo: 'Vencidas', lista: vencidas, rojo: true }] : [];
    for (const [k, lista] of [...m.entries()].sort((a, b) => (a[0] === 'sin' ? 1 : b[0] === 'sin' ? -1 : a[0].localeCompare(b[0])))) {
      out.push({ titulo: k === 'sin' ? 'Sin fecha' : `${MESES_LARGO[Number(k.slice(5, 7)) - 1]} ${k.slice(0, 4)}`, lista });
    }
    return out;
  }, [arribos, vista]);
  const totPz = arribos.reduce((s, p) => s + p.piezas, 0);
  const totUsd = arribos.reduce((s, p) => s + p.usd, 0);
  const d = (v) => (v == null ? '—' : `${Math.round(v)} d`);
  return (
    <div style={{ paddingBottom: 24 }}>
      <TituloGrande titulo="Lo que viene" sub={`${arribos.length} PO · ${int(totPz)} pz${sensible && totUsd > 0 ? ` · ${usdCompact(totUsd)} USD` : ''}`} />
      <div style={{ padding: '0 16px' }}><Segmented options={VISTAS} value={vista} onChange={onVista} style={{ display: 'flex', width: '100%' }} /></div>
      {!arribos.length && <Vacio icon={Ship} color={theme.textMuted} titulo="Nada en camino" sub="No hay embarques pendientes en el master." />}
      {grupos.map((g) => (
        <ListaAgrupada key={g.titulo} titulo={g.titulo} meta={`${g.lista.length} · ${int(g.lista.reduce((s, p) => s + p.piezas, 0))} pz`} style={{ marginTop: 16 }}>
          {g.lista.map((p) => <FilaPO key={p.po} p={p} theme={theme} onClick={() => onPo?.(p)} />)}
        </ListaAgrupada>
      ))}
      {tiempos && tiempos.proveedores?.length > 0 && (
        <div style={{ margin: '18px 16px 0' }}>
          <button type="button" onClick={() => setVerTiempos((v) => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '12px 14px', color: theme.text, fontFamily: TYPO.fontText, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
            <span>Tiempos reales <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {tiempos.proveedores.length} proveedores · {tiempos.navieras.length} navieras</span></span>
            {verTiempos ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          {verTiempos && (
            <>
              <ListaAgrupada titulo="Proveedores" meta={tiempos.proveedores.length} style={{ marginTop: 12, padding: 0 }} pie={`Mediana de los contenedores ya arribados en ${tiempos.anio}: producción + tránsito ETD → CEDIS. Ciclo real de una PO ≈ ${d(tiempos.tot.totalMed)}.`}>
                {tiempos.proveedores.slice(0, 10).map((r) => (
                  <Fila key={r.supplier} icon={Factory} color={theme.accent} titulo={nombreProveedor(r.supplier)}
                    sub={[`${int(r.embarques)} cnt`, r.dias_produccion_med != null ? `producción ${d(r.dias_produccion_med)}` : null, r.dias_transito_med != null ? `tránsito ${d(r.dias_transito_med)}` : null].filter(Boolean).join(' · ')}
                    valor={d(r.dias_total_med)} valorSub="ciclo PO" chevron={false} />
                ))}
              </ListaAgrupada>
              {tiempos.navieras.length > 0 && (
                <ListaAgrupada titulo="Navieras" meta={tiempos.navieras.length} style={{ marginTop: 12, padding: 0 }} pie={sensible && tiempos.tot.usdPorCbm ? `Flete ≈ $${Math.round(tiempos.tot.usdPorCbm)}/CBM (capturado por contenedor).` : 'La naviera viene capturada sólo en parte de los embarques.'}>
                  {tiempos.navieras.slice(0, 8).map((r) => (
                    <Fila key={r.naviera} icon={Anchor} color={theme.textMuted} titulo={r.naviera}
                      sub={[`${int(r.contenedores)} cnt`, r.cbm ? `${int(r.cbm)} CBM` : null, sensible && r.usd_por_cbm ? `$${Math.round(r.usd_por_cbm)}/CBM` : null].filter(Boolean).join(' · ')}
                      valor={d(r.dias_transito_med)} valorSub="tránsito" chevron={false} />
                  ))}
                </ListaAgrupada>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function LoQueViene({ arribos = [], sensible = false }) {
  const nav = useNav();
  const [vista, setVista] = useState('fecha');
  const anio = new Date().getFullYear();
  const { loading, proveedores, navieras } = useEmbarquesTiempos(anio, true);
  const tiempos = useMemo(() => (loading || !proveedores.length ? null : { anio, proveedores, navieras, tot: resumenEmb(proveedores) }), [loading, proveedores, navieras, anio]);
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <LoQueVieneVista arribos={arribos} sensible={sensible} vista={vista} onVista={setVista} tiempos={tiempos}
        onPo={(p) => nav.push(<FichaPO po={p} sensible={sensible} />, `po-${p.po}`)} />
    </>
  );
}
