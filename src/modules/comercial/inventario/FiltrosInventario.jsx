// Panel de filtros de la tabla · marca y roadmap (Pill multi-select), familia
// (select), sólo con stock (Pill toggle) y limpiar (Boton).
import React from 'react';
import { X } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Pill, Boton } from '../../../components/kit';

function Bloque({ theme, titulo, n, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.09em', color: theme.textMuted, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {titulo}
        {n > 0 && <Pill tone="blue" size="xs">{n}</Pill>}
      </div>
      {children}
    </div>
  );
}

export default function FiltrosInventario({ opciones, marca, setMarca, familia, setFamilia, roadmap, setRoadmap, soloConStock, setSoloConStock, nActivos, onLimpiar }) {
  const { theme } = useTheme();
  const toggle = (set, setter, key) => { const next = new Set(set); if (next.has(key)) next.delete(key); else next.add(key); setter(next); };
  const pillStyle = (on) => ({ cursor: 'pointer', border: `1px solid ${on ? theme.accent : theme.border}`, padding: '3px 10px', fontSize: 10.5 });
  return (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${theme.border}`, background: theme.bg, display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText }}>
      <Bloque theme={theme} titulo="Marca" n={marca.size}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {opciones.marcas.length === 0 && <span style={{ fontSize: 11, color: theme.textMuted }}>Sin marcas en roadmap_sku.</span>}
          {opciones.marcas.map((m) => { const k = m.toLowerCase(); const on = marca.has(k); return <Pill key={m} tone={on ? 'blue' : 'gray'} style={pillStyle(on)} onClick={() => toggle(marca, setMarca, k)}>{m}</Pill>; })}
        </div>
      </Bloque>

      <Bloque theme={theme} titulo="Familia" n={familia ? 1 : 0}>
        <select value={familia} onChange={(e) => setFamilia(e.target.value)}
          style={{ padding: '5px 10px', height: 28, borderRadius: 8, border: `1px solid ${familia ? theme.accent : theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 11.5, cursor: 'pointer', minWidth: 200, maxWidth: 320 }}>
          <option value="">Todas las familias</option>
          {opciones.familias.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
      </Bloque>

      <Bloque theme={theme} titulo="Roadmap" n={roadmap.size}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {opciones.roadmaps.length === 0 && <span style={{ fontSize: 11, color: theme.textMuted }}>Sin roadmap en roadmap_sku.</span>}
          {opciones.roadmaps.map((rd) => { const on = roadmap.has(rd); return <Pill key={rd} tone={on ? 'blue' : 'gray'} style={pillStyle(on)} onClick={() => toggle(roadmap, setRoadmap, rd)}>{rd}</Pill>; })}
        </div>
      </Bloque>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, borderTop: `1px solid ${theme.border}`, paddingTop: 10 }}>
        <Pill tone={soloConStock ? 'green' : 'gray'} dot={soloConStock} style={pillStyle(soloConStock)} onClick={() => setSoloConStock(!soloConStock)}>
          Sólo SKUs con stock
        </Pill>
        {nActivos > 0 && <Boton icon={X} onClick={onLimpiar}>Limpiar filtros</Boton>}
      </div>
    </div>
  );
}
