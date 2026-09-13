// Filtros de la tabla de Inventario · botón "Filtros" que abre una hoja con los grupos
// (Estado · CEDIS · Marca · Familia · Roadmap · sólo stock / sólo tránsito) y, junto al botón,
// las pastillas de lo que está activo con su × para quitarlo. Sustituye a la barra de pills
// (Fernando, 2026-09-13: "más limpio, un botón que despliegue lo que puedo filtrar").
import React, { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Modal } from '../../../components/perfil/comun';
import { Pill, Boton } from '../../../components/kit';
import { Grupo } from './FiltrosPills';
import { ESTADOS } from './filtros';
import { CEDIS_CORTO, CEDIS_LISTA, fmtInt } from './constantes';

function Seccion({ theme, titulo, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 0', borderBottom: `1px solid ${theme.border}` }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600 }}>{titulo}</span>
      {children}
    </div>
  );
}

export default function FiltrosHoja({ f, facetas, cedis, cedisConteo, onCedis, onToggle, onSoloStock, onSoloTransito, nActivos, onLimpiar }) {
  const { theme } = useTheme();
  const [abierto, setAbierto] = useState(false);
  const tonoEstado = (id) => ESTADOS.find((e) => e.id === id)?.tone || 'blue';
  const labelEstado = (id) => ESTADOS.find((e) => e.id === id)?.label || id;
  const opcionesEstado = ESTADOS.map((e) => ({ id: e.id, label: e.label, n: facetas.estado.get(e.id)?.n || 0 }));
  const opcionesCedis = CEDIS_LISTA.map((c) => ({ id: c, label: CEDIS_CORTO[c] || c, n: cedisConteo.get(c) || 0 }));

  // Pastillas de lo activo (cada una se quita con su ×)
  const activas = [
    ...[...f.estado].map((id) => ({ k: `e-${id}`, label: labelEstado(id), tone: tonoEstado(id), quitar: () => onToggle('estado', id) })),
    ...(cedis !== 'TODOS' ? [{ k: 'cedis', label: CEDIS_CORTO[cedis] || cedis, tone: 'blue', quitar: () => onCedis('TODOS') }] : []),
    ...[...f.marca].map((id) => ({ k: `m-${id}`, label: id, tone: 'gray', quitar: () => onToggle('marca', id) })),
    ...[...f.familia].map((id) => ({ k: `f-${id}`, label: id, tone: 'gray', quitar: () => onToggle('familia', id) })),
    ...[...f.roadmap].map((id) => ({ k: `r-${id}`, label: id, tone: 'gray', quitar: () => onToggle('roadmap', id) })),
    ...(f.soloStock ? [{ k: 'stock', label: 'Sólo con stock', tone: 'green', quitar: () => onSoloStock(false) }] : []),
    ...(f.soloTransito ? [{ k: 'transito', label: 'Sólo con tránsito', tone: 'blue', quitar: () => onSoloTransito(false) }] : []),
  ];

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        <Boton icon={SlidersHorizontal} onClick={() => setAbierto(true)} primario={nActivos > 0}>
          Filtros{nActivos > 0 ? ` · ${nActivos}` : ''}
        </Boton>
        {activas.map((a) => (
          <Pill key={a.k} tone={a.tone} size="xs" onClick={a.quitar} title="Quitar este filtro"
            style={{ cursor: 'pointer', padding: '2px 6px 2px 8px', gap: 4, border: `1px solid ${theme.border}` }}>
            {a.label}<X size={10} />
          </Pill>
        ))}
        {activas.length > 1 && <Pill tone="gray" size="xs" onClick={onLimpiar} style={{ cursor: 'pointer', padding: '2px 8px' }}>Limpiar todo</Pill>}
      </div>

      <Modal abierto={abierto} onClose={() => setAbierto(false)} theme={theme} ancho={720}
        titulo="Filtrar la tabla" sub="Los conteos son los SKUs que quedan con lo que ya está marcado · se combinan"
        pie={(
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: theme.textMuted }}>{nActivos ? `${nActivos} filtro${nActivos === 1 ? '' : 's'} activo${nActivos === 1 ? '' : 's'}` : 'Sin filtros'}</span>
            <span style={{ display: 'inline-flex', gap: 6 }}>
              {nActivos > 0 && <Boton icon={X} onClick={onLimpiar}>Limpiar</Boton>}
              <Boton primario onClick={() => setAbierto(false)}>Listo</Boton>
            </span>
          </div>
        )}>
        <div style={{ fontFamily: TYPO.fontText, display: 'flex', flexDirection: 'column' }}>
          <Seccion theme={theme} titulo="Estado de cobertura">
            <Grupo theme={theme} titulo="" opciones={opcionesEstado} seleccion={f.estado} onToggle={(id) => onToggle('estado', id)} tonoDe={tonoEstado} titleDe={(id) => ESTADOS.find((e) => e.id === id)?.title} />
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <Pill tone={f.soloStock ? 'green' : 'gray'} size="xs" dot={f.soloStock} onClick={() => onSoloStock(!f.soloStock)} style={{ cursor: 'pointer', border: `1px solid ${f.soloStock ? 'currentColor' : theme.border}`, padding: '2px 8px', gap: 4 }}>
                Sólo con stock<span style={{ opacity: 0.7 }}>{fmtInt(facetas.stock)}</span>
              </Pill>
              <Pill tone={f.soloTransito ? 'blue' : 'gray'} size="xs" dot={f.soloTransito} onClick={() => onSoloTransito(!f.soloTransito)} style={{ cursor: 'pointer', border: `1px solid ${f.soloTransito ? 'currentColor' : theme.border}`, padding: '2px 8px', gap: 4 }}>
                Sólo con tránsito<span style={{ opacity: 0.7 }}>{fmtInt(facetas.transito)}</span>
              </Pill>
            </div>
          </Seccion>
          <Seccion theme={theme} titulo="CEDIS · acota toda la pantalla">
            <Grupo theme={theme} titulo="" opciones={opcionesCedis} seleccion={cedis} onToggle={(id) => onCedis(cedis === id ? 'TODOS' : id)} />
          </Seccion>
          <Seccion theme={theme} titulo="Marca"><Grupo theme={theme} titulo="" opciones={facetas.marca} seleccion={f.marca} onToggle={(id) => onToggle('marca', id)} /></Seccion>
          <Seccion theme={theme} titulo="Familia"><Grupo theme={theme} titulo="" opciones={facetas.familia} seleccion={f.familia} onToggle={(id) => onToggle('familia', id)} /></Seccion>
          <Seccion theme={theme} titulo="Roadmap"><Grupo theme={theme} titulo="" opciones={facetas.roadmap} seleccion={f.roadmap} onToggle={(id) => onToggle('roadmap', id)} /></Seccion>
        </div>
      </Modal>
    </>
  );
}
