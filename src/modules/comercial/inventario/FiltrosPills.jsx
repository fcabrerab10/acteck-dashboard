// Barra de filtros de la tabla · pills con conteo facetado (Marca, Familia, Roadmap, CEDIS,
// estado de cobertura, sólo con stock, sólo con tránsito), combinables, y Limpiar.
// Sustituye al panel FiltrosInventario (botón "Filtros") de la V3 inicial.
import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, Boton } from '../../../components/kit';
import { ESTADOS } from './filtros';
import { CEDIS_CORTO, CEDIS_LISTA, fmtInt } from './constantes';

const MAX_VISIBLES = 8;

function Grupo({ theme, titulo, opciones, seleccion, onToggle, tonoDe, titleDe }) {
  const [todas, setTodas] = useState(false);
  const activa = (id) => (seleccion instanceof Set ? seleccion.has(id) : seleccion === id);
  // Se muestran las que dejan resultados (n > 0) o están activas; el resto no aporta.
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
          <Pill key={o.id} tone={tone} size="xs" onClick={() => onToggle(o.id)} title={titleDe ? titleDe(o.id) : undefined}
            style={{ cursor: 'pointer', border: `1px solid ${on ? 'currentColor' : theme.border}`, padding: '2px 8px', opacity: o.n === 0 && !on ? 0.5 : 1, gap: 4 }}>
            {o.label}<span style={{ opacity: 0.7, fontWeight: 500 }}>{fmtInt(o.n)}</span>
          </Pill>
        );
      })}
      {ocultas > 0 && <Pill tone="gray" size="xs" onClick={() => setTodas(true)} style={{ cursor: 'pointer', padding: '2px 8px' }}>+{ocultas} más</Pill>}
      {todas && utiles.length > MAX_VISIBLES && <Pill tone="gray" size="xs" onClick={() => setTodas(false)} style={{ cursor: 'pointer', padding: '2px 8px' }}>menos</Pill>}
    </div>
  );
}

export default function FiltrosPills({ f, facetas, cedis, cedisConteo, onCedis, onToggle, onSoloStock, onSoloTransito, nActivos, onLimpiar }) {
  const { theme } = useTheme();
  const tonoEstado = (id) => ESTADOS.find((e) => e.id === id)?.tone || 'blue';
  const titleEstado = (id) => ESTADOS.find((e) => e.id === id)?.title;
  const opcionesEstado = ESTADOS.map((e) => ({ id: e.id, label: e.label, n: facetas.estado.get(e.id)?.n || 0 }));
  const opcionesCedis = CEDIS_LISTA.map((c) => ({ id: c, label: CEDIS_CORTO[c] || c, n: cedisConteo.get(c) || 0 }));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px', borderBottom: `1px solid ${theme.border}`, fontFamily: TYPO.fontText }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Grupo theme={theme} titulo="Estado" opciones={opcionesEstado} seleccion={f.estado} onToggle={(id) => onToggle('estado', id)} tonoDe={tonoEstado} titleDe={titleEstado} />
        <Grupo theme={theme} titulo="CEDIS" opciones={opcionesCedis} seleccion={cedis} onToggle={(id) => onCedis(cedis === id ? 'TODOS' : id)} titleDe={() => 'Acota toda la pantalla (hero, KPIs y tabla) a ese CEDIS'} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <Pill tone={f.soloStock ? 'green' : 'gray'} size="xs" dot={f.soloStock} onClick={() => onSoloStock(!f.soloStock)} style={{ cursor: 'pointer', border: `1px solid ${f.soloStock ? 'currentColor' : theme.border}`, padding: '2px 8px', gap: 4 }}>
            Sólo con stock<span style={{ opacity: 0.7, fontWeight: 500 }}>{fmtInt(facetas.stock)}</span>
          </Pill>
          <Pill tone={f.soloTransito ? 'blue' : 'gray'} size="xs" dot={f.soloTransito} onClick={() => onSoloTransito(!f.soloTransito)} style={{ cursor: 'pointer', border: `1px solid ${f.soloTransito ? 'currentColor' : theme.border}`, padding: '2px 8px', gap: 4 }}>
            Sólo con tránsito<span style={{ opacity: 0.7, fontWeight: 500 }}>{fmtInt(facetas.transito)}</span>
          </Pill>
        </div>
        {nActivos > 0 && <Boton icon={X} onClick={onLimpiar} style={{ marginLeft: 'auto' }}>Limpiar · {nActivos}</Boton>}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <Grupo theme={theme} titulo="Marca" opciones={facetas.marca} seleccion={f.marca} onToggle={(id) => onToggle('marca', id)} />
        <Grupo theme={theme} titulo="Familia" opciones={facetas.familia} seleccion={f.familia} onToggle={(id) => onToggle('familia', id)} />
        <Grupo theme={theme} titulo="Roadmap" opciones={facetas.roadmap} seleccion={f.roadmap} onToggle={(id) => onToggle('roadmap', id)} />
      </div>
    </div>
  );
}
