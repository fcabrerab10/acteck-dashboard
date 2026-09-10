// Barra de filtros del S&OP · pills con conteo facetado (Estado, sólo con sugerido · Proveedor, Familia, Marca,
// Cliente, Roadmap), combinables, "+N más" por grupo y Limpiar. Mismo patrón que inventario/FiltrosPills.jsx.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, Boton } from '../../../components/kit';
import { roadmapTone } from '../sellin/textos';
import { fmtInt } from '../inventario/constantes';
import { ESTADOS_SOP } from './motorFiltros';

const MAX_VISIBLES = 8;

function Grupo({ theme, titulo, opciones, seleccion, onToggle, tonoDe, titleDe }) {
  const [todas, setTodas] = useState(false);
  const activa = (id) => seleccion.has(id);
  const utiles = opciones.filter((o) => o.n > 0 || activa(o.id));
  if (!utiles.length) return null;
  const visibles = todas ? utiles : utiles.slice(0, MAX_VISIBLES);
  const ocultas = utiles.length - visibles.length;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap', minWidth: 0 }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, marginRight: 2, whiteSpace: 'nowrap' }}>{titulo}</span>
      {visibles.map((o) => {
        const on = activa(o.id);
        const tone = on ? (tonoDe ? tonoDe(o.id) : 'blue') : 'gray';
        return (
          <Pill key={o.id} tone={tone} size="xs" onClick={() => onToggle(o.id)} title={titleDe ? titleDe(o.id) : o.label}
            style={{ cursor: 'pointer', border: `1px solid ${on ? 'currentColor' : theme.border}`, padding: '2px 8px', opacity: o.n === 0 && !on ? 0.5 : 1, gap: 4, maxWidth: 220 }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{o.label}</span>
            <span style={{ opacity: 0.7, fontWeight: 500 }}>{fmtInt(o.n)}</span>
          </Pill>
        );
      })}
      {ocultas > 0 && <Pill tone="gray" size="xs" onClick={() => setTodas(true)} style={{ cursor: 'pointer', padding: '2px 8px' }}>+{ocultas} más</Pill>}
      {todas && utiles.length > MAX_VISIBLES && <Pill tone="gray" size="xs" onClick={() => setTodas(false)} style={{ cursor: 'pointer', padding: '2px 8px' }}>menos</Pill>}
    </div>
  );
}

export default function FiltrosSOP({ f, facetas, onToggle, onSoloSugerido, nActivos, onLimpiar }) {
  const { theme } = useTheme();
  const tonoEstado = (id) => ESTADOS_SOP.find((e) => e.id === id)?.tone || 'blue';
  const titleEstado = (id) => ESTADOS_SOP.find((e) => e.id === id)?.title;
  const opcionesEstado = ESTADOS_SOP.map((e) => ({ id: e.id, label: e.label, n: facetas.estado.get(e.id) || 0 }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Grupo theme={theme} titulo="Estado" opciones={opcionesEstado} seleccion={f.estado} onToggle={(id) => onToggle('estado', id)} tonoDe={tonoEstado} titleDe={titleEstado} />
        <Pill tone={f.soloSugerido ? 'blue' : 'gray'} size="xs" dot={f.soloSugerido} onClick={() => onSoloSugerido(!f.soloSugerido)} title="Mostrar sólo SKUs con sugerido de compra > 0"
          style={{ cursor: 'pointer', border: `1px solid ${f.soloSugerido ? 'currentColor' : theme.border}`, padding: '2px 8px', gap: 4, opacity: facetas.sugerido === 0 && !f.soloSugerido ? 0.5 : 1 }}>
          Sólo con sugerido<span style={{ opacity: 0.7, fontWeight: 500 }}>{fmtInt(facetas.sugerido)}</span>
        </Pill>
        {nActivos > 0 && <Boton icon={X} onClick={onLimpiar} style={{ marginLeft: 'auto' }}>Limpiar · {nActivos}</Boton>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Grupo theme={theme} titulo="Proveedor" opciones={facetas.proveedor} seleccion={f.proveedor} onToggle={(id) => onToggle('proveedor', id)} />
        <Grupo theme={theme} titulo="Familia" opciones={facetas.familia} seleccion={f.familia} onToggle={(id) => onToggle('familia', id)} />
        <Grupo theme={theme} titulo="Marca" opciones={facetas.marca} seleccion={f.marca} onToggle={(id) => onToggle('marca', id)} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Grupo theme={theme} titulo="Cliente" opciones={facetas.cliente} seleccion={f.cliente} onToggle={(id) => onToggle('cliente', id)} titleDe={() => 'Clientes ERP con consumo del SKU en los últimos 6 meses'} />
        <Grupo theme={theme} titulo="Roadmap" opciones={facetas.roadmap} seleccion={f.roadmap} onToggle={(id) => onToggle('roadmap', id)} tonoDe={roadmapTone} />
      </div>
    </div>
  );
}
