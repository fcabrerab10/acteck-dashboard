// Contenido de la hoja de un grupo (modo "barra") · se monta dentro de HojaM vía nav.abrirHoja.
//   <HojaGrupo entrada="direccionGeneral|direccionComercial|clientesPropios|interno" />
// Lista las pestañas del grupo en el orden del árbol (icono de app con el color del grupo, ★ de favorito, hint
// de deshabilitada). "Clientes" muestra los 3 propios con punto de color y, al tocar uno, sus pestañas dentro de la
// misma hoja con "‹ Clientes"; debajo van las pestañas globales del grupo (Resumen de Clientes, Propuestas…).
// "Interno" añade Axon (y Administración ya viene en el grupo) cuando el perfil los tiene.
import React, { useState } from 'react';
import { ChevronLeft } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePreferencias } from '../../lib/preferencias';
import { BotonFav, PuntoCliente } from '../../components/nav/comun';
import { ListaAgrupada, Fila } from '../piezas';
import { useNav } from '../nav';

export function seccionesDe(arbol, entrada) {
  const g = (id) => arbol.find((x) => x.id === id);
  if (entrada === 'interno') {
    const out = [];
    if (g('interno')?.nodos.length) out.push({ id: 'interno', nodos: g('interno').nodos });
    if (g('axon')?.nodos.length) out.push({ id: 'axon', titulo: 'Axon', nodos: g('axon').nodos });
    return { secciones: out, clientes: [] };
  }
  const grupo = g(entrada);
  if (!grupo) return { secciones: [], clientes: [] };
  return {
    secciones: grupo.nodos.length ? [{ id: grupo.id, titulo: entrada === 'clientesPropios' ? 'Clientes propios' : undefined, nodos: grupo.nodos }] : [],
    clientes: grupo.clientes || [],
  };
}

export default function HojaGrupo({ entrada }) {
  const { theme } = useTheme();
  const nav = useNav();
  const { favoritos, toggleFavorito } = usePreferencias();
  const [cliente, setCliente] = useState(null);
  const { secciones, clientes } = seccionesDe(nav.arbol || [], entrada);
  const elegir = (n) => { nav.cerrarHoja(); nav.navegar(n); };

  const fila = (n) => (
    <Fila key={n.id} icon={n.icon} color={n.color} titulo={n.label} sub={n.hint} onClick={n.disabled ? undefined : () => elegir(n)} chevron={false}
      style={{ opacity: n.disabled ? 0.5 : 1, background: nav.activoId === n.id ? `${theme.accent}14` : undefined }}
      trailing={<BotonFav theme={theme} activo={favoritos.includes(n.id)} visible onToggle={() => toggleFavorito(n.id)} size={15} />} />
  );

  const c = cliente ? clientes.find((x) => x.key === cliente) : null;
  if (c) {
    return (
      <div style={{ paddingBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px 6px' }}>
          <button type="button" onClick={() => setCliente(null)} style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 8px 0 4px', border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 15, cursor: 'pointer' }}>
            <ChevronLeft size={22} strokeWidth={2.2} style={{ marginLeft: -4 }} />Clientes
          </button>
          <span style={{ flex: 1 }} />
          <PuntoCliente color={c.color} size={9} activo />
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.015em', paddingRight: 8 }}>{c.label}</span>
        </div>
        <ListaAgrupada>{c.nodos.map(fila)}</ListaAgrupada>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 8 }}>
      {clientes.length > 0 && (
        <ListaAgrupada>
          {clientes.map((k) => (
            <Fila key={k.key} tono={k.color} titulo={k.label} sub={k.marca} onClick={() => setCliente(k.key)} />
          ))}
        </ListaAgrupada>
      )}
      {secciones.map((s) => <ListaAgrupada key={s.id} titulo={s.titulo}>{s.nodos.map(fila)}</ListaAgrupada>)}
    </div>
  );
}
