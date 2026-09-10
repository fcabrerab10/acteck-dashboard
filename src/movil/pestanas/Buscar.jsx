// Pestaña Buscar · campo con foco automático; resultados: SKUs (roadmap_sku + disponible comercial),
// clientes (propios y del ERP) y pestañas (árbol de navegación). Recientes en localStorage. SKU → Ficha de producto.
import React, { useMemo, useState } from 'react';
import { Package, Users, LayoutGrid, Clock } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { construirArbol, nodosPlanos, CLIENTES_NAV, CLIENTES_ORDEN } from '../../components/nav/arbol';
import { NOMBRE_CLIENTE } from '../../lib/alertas';
import { useNav } from '../nav';
import { TituloGrande, CampoBusqueda, ListaAgrupada, Fila, Vacio, Skeleton } from '../piezas';
import { useCatalogoBusqueda, colorCliente } from '../datos';
import { leerLS, guardarLS, int, MONO } from '../util';
import FichaCliente from './FichaCliente';
import FichaProducto from '../FichaProducto';

const LS_RECIENTES = 'movil_buscar_recientes_v1';
const norm = (s) => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
const PESTANAS_MOVIL = { inicio: 'inicio', inventarioGlobal: 'ficha', estrategiaPrecios: 'ficha' };

export default function Buscar() {
  const { theme } = useTheme();
  const nav = useNav();
  const [q, setQ] = useState('');
  const [recientes, setRecientes] = useState(() => leerLS(LS_RECIENTES, []));
  const { data: catalogo, isLoading } = useCatalogoBusqueda(true);
  const nq = norm(q.trim());

  const clientes = useMemo(() => {
    const propios = CLIENTES_ORDEN.map((k) => ({ key: k, label: CLIENTES_NAV[k].label, sub: `Cliente propio · ${CLIENTES_NAV[k].marca}`, tipo: 'propio' }));
    const erp = Object.entries(NOMBRE_CLIENTE).filter(([k]) => !CLIENTES_NAV[k]).map(([k, label]) => ({ key: k, label, sub: 'Canal del ERP', tipo: 'otro' }));
    return [...propios, ...erp];
  }, []);
  const pestanas = useMemo(() => { try { return nodosPlanos(construirArbol(nav.perfil)).filter((n) => n.tipo !== 'enlace'); } catch { return []; } }, [nav.perfil]);

  const res = useMemo(() => {
    if (!nq) return null;
    const terms = nq.split(/\s+/).filter(Boolean);
    const coincide = (txt) => { const t = norm(txt); return terms.every((w) => t.includes(w)); };
    const skus = (catalogo || []).filter((s) => coincide(`${s.sku} ${s.descripcion} ${s.marca}`)).sort((a, b) => (norm(b.sku).startsWith(nq) - norm(a.sku).startsWith(nq)) || b.disponible - a.disponible).slice(0, 30);
    return {
      skus,
      clientes: clientes.filter((c) => coincide(`${c.label} ${c.key} ${c.sub}`)).slice(0, 6),
      pestanas: pestanas.filter((n) => coincide(`${n.label} ${n.clienteKey ? CLIENTES_NAV[n.clienteKey]?.label : ''} ${n.grupoLabel || ''}`)).slice(0, 8),
    };
  }, [nq, catalogo, clientes, pestanas]);

  const recordar = (item) => {
    const lista = [item, ...recientes.filter((r) => !(r.tipo === item.tipo && r.id === item.id))].slice(0, 8);
    setRecientes(lista); guardarLS(LS_RECIENTES, lista);
  };
  const abrirSku = (sku, desc) => { recordar({ tipo: 'sku', id: sku, label: sku, sub: desc }); nav.agregarSku(sku); nav.push(<FichaProducto />, 'ficha'); };
  const abrirCliente = (c) => { recordar({ tipo: 'cliente', id: c.key, label: c.label, sub: c.sub, extra: c.tipo }); nav.push(<FichaCliente clienteKey={c.key} tipo={c.tipo} />, `cliente-${c.key}`); };
  const abrirPestana = (n) => {
    recordar({ tipo: 'pestana', id: n.id, label: n.label, sub: n.clienteKey ? CLIENTES_NAV[n.clienteKey]?.label : n.grupoLabel, extra: n.pagina, ck: n.clienteKey || null });
    irAPestana(n.pagina, n.clienteKey, n.label);
  };
  const irAPestana = (pagina, ck, label) => {
    if (ck) { nav.push(<FichaCliente clienteKey={ck} />, `cliente-${ck}`); return; }
    const destino = PESTANAS_MOVIL[pagina];
    if (destino === 'inicio') { nav.irATab('inicio'); return; }
    if (destino === 'ficha') { nav.push(<FichaProducto />, 'ficha'); return; }
    if (pagina === 'configuracion' || pagina === 'actualizacion' || pagina === 'historialCambios') { nav.irATab('mas'); return; }
    nav.abrirProximamente(label);
  };
  const abrirReciente = (r) => {
    if (r.tipo === 'sku') return abrirSku(r.id, r.sub);
    if (r.tipo === 'cliente') return abrirCliente({ key: r.id, label: r.label, sub: r.sub, tipo: r.extra });
    return irAPestana(r.extra, r.ck, r.label);
  };
  const borrarRecientes = () => { setRecientes([]); guardarLS(LS_RECIENTES, []); };

  const iconoDe = { sku: Package, cliente: Users, pestana: LayoutGrid };
  const colorDe = { sku: theme.accent, cliente: theme.green, pestana: theme.indigo };

  return (
    <>
      <TituloGrande titulo="Buscar" sub="SKUs, clientes y pestañas" />
      <div style={{ padding: '0 16px 14px' }}>
        <CampoBusqueda value={q} onChange={setQ} placeholder="SKU, descripción, cliente…" autoFocus onSubmit={() => { if (res?.skus?.[0]) abrirSku(res.skus[0].sku, res.skus[0].descripcion); }} />
      </div>

      {!res && (
        <>
          {recientes.length > 0 && (
            <ListaAgrupada titulo="Recientes" accion={<button type="button" onClick={borrarRecientes} style={{ border: 0, background: 'transparent', color: theme.accent, fontFamily: TYPO.fontText, fontSize: 12.5, padding: 0, cursor: 'pointer' }}>Borrar</button>}>
              {recientes.map((r) => <Fila key={`${r.tipo}-${r.id}`} icon={Clock} color={theme.textSubtle || theme.textMuted} titulo={r.label} sub={r.sub} onClick={() => abrirReciente(r)} />)}
            </ListaAgrupada>
          )}
          {recientes.length === 0 && <Vacio icon={null} titulo="Escribe para buscar" sub={isLoading ? 'Cargando el catálogo…' : `${int(catalogo?.length || 0)} SKUs en el catálogo · también clientes y pestañas`} />}
          {isLoading && <div style={{ padding: '0 16px' }}><Skeleton h={12} w="40%" /></div>}
        </>
      )}

      {res && (
        <>
          {res.skus.length + res.clientes.length + res.pestanas.length === 0 && <Vacio icon={null} titulo={`Nada coincide con “${q}”`} sub={isLoading ? 'El catálogo todavía se está cargando…' : 'Prueba con parte del SKU o una palabra de la descripción.'} />}
          {res.skus.length > 0 && (
            <ListaAgrupada titulo="SKUs" meta={res.skus.length} pie="Toca un SKU para ver disponibilidad, tránsito y precio.">
              {res.skus.map((s) => (
                <Fila key={s.sku} icon={iconoDe.sku} color={colorDe.sku} titulo={<span style={{ fontFamily: TYPO.fontDisplay }}>{s.sku}<span style={{ fontWeight: 400, color: theme.textMuted, fontSize: 12, marginLeft: 8 }}>{s.marca}</span></span>} sub={s.descripcion || 'Sin descripción'}
                  valor={<span style={{ fontFamily: MONO, fontSize: 13 }}>{int(s.disponible)}</span>} valorSub="disp." onClick={() => abrirSku(s.sku, s.descripcion)} />
              ))}
            </ListaAgrupada>
          )}
          {res.clientes.length > 0 && (
            <ListaAgrupada titulo="Clientes" style={{ marginTop: 16 }}>
              {res.clientes.map((c) => <Fila key={c.key} icon={iconoDe.cliente} color={colorCliente(c.key, theme)} titulo={c.label} sub={c.sub} onClick={() => abrirCliente(c)} />)}
            </ListaAgrupada>
          )}
          {res.pestanas.length > 0 && (
            <ListaAgrupada titulo="Pestañas" style={{ marginTop: 16 }}>
              {res.pestanas.map((n) => <Fila key={n.id} icon={n.icon || iconoDe.pestana} color={n.color || colorDe.pestana} titulo={n.label} sub={n.clienteKey ? CLIENTES_NAV[n.clienteKey]?.label : n.grupoLabel} onClick={() => abrirPestana(n)} />)}
            </ListaAgrupada>
          )}
        </>
      )}
    </>
  );
}
