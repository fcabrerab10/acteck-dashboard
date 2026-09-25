// Proyectos y abasto · celular (push · nodo forecastReservas).
//
// Mismo motor que la computadora (modules/comercial/proyectos/calculo.js): la cobertura,
// el faltante y la fecha límite de compra salen idénticos. Aquí caben dos vistas:
//   · Proyectos → chips de los 6 meses + lista agrupada; tocar uno abre su ficha (HojaM)
//                 con sus SKUs, cambiar estado y editar piezas.
//   · Faltantes → qué falta comprar y antes de cuándo.
// "＋ Nuevo proyecto" es otra HojaM con el formulario (nombre, cliente, mes, probabilidad
// y SKUs con CampoBusqueda contra el roadmap/catálogo).
import React, { useMemo, useState } from 'react';
import { Plus, Lock, Package, Trash2, Share2 } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeEditarPestanaGlobal } from '../../lib/permisos';
import {
  calcular, mesesHorizonte, arribosDeTransito,
  CLIENTES, CLIENTE_LABEL, PROBABILIDADES, PROB_LABEL, PROB_TONE, etiquetaMesLarga,
} from '../../modules/comercial/proyectos/calculo';
import { fraseHero, subHero, pctCorto, fechaCortaISO, textoCompartir } from '../../modules/comercial/proyectos/textos';
import { useProyectos, useAbasto, crearProyecto, actualizarProyecto, eliminarProyecto, guardarLinea, eliminarLinea } from '../../modules/comercial/proyectos/datos';
import { useNav } from '../nav';
import { Cabecera, TituloGrande, HeroM, ListaAgrupada, Fila, BotonGrande, CampoBusqueda, Vacio, HojaM, Segmented, Pill, toast } from '../piezas';
import { Cargando } from '../../components/kit';
import { int, MONO } from '../util';
import { moneyCompact } from '../../lib/format';
import { compartir } from '../../lib/whatsapp';

const VISTAS = [{ id: 'proyectos', label: 'Proyectos' }, { id: 'faltantes', label: 'Faltantes' }];
const colorCliente = (k) => CLIENTES.find((c) => c.key === k)?.color || '#8E8E93';
const tonoPct = (p) => (p == null ? 'gray' : p >= 99.5 ? 'green' : p >= 70 ? 'orange' : 'red');

export default function Proyectos() {
  const { theme } = useTheme();
  const nav = useNav();
  const perfil = usePerfil();
  const puedeVer = puedeVerPestanaGlobal(perfil, 'forecast_reservas');
  const puedeEditar = puedeEditarPestanaGlobal(perfil, 'forecast_reservas');
  const hoy = useMemo(() => new Date(), []);
  const horizonte = useMemo(() => mesesHorizonte(hoy, 6), [hoy]);

  const [vista, setVista] = useState('proyectos');
  const [mesSel, setMesSel] = useState(null);     // null = todos
  const [abierto, setAbierto] = useState(null);   // id del proyecto
  const [nuevo, setNuevo] = useState(false);

  const pr = useProyectos();
  const ab = useAbasto();

  const res = useMemo(() => calcular({
    proyectos: pr.data?.proyectos || [], lineas: pr.data?.lineas || [],
    inventario: ab.data?.inventario || [], transito: ab.data?.transito || [],
    leadTimes: ab.data?.leadTimes || [], leadProveedor: ab.data?.leadProveedor || [],
    descripciones: ab.data?.descripciones || null, meses: horizonte, hoy,
  }), [pr.data, ab.data, horizonte, hoy]);

  const stock = useMemo(() => {
    const m = new Map();
    for (const r of ab.data?.inventario || []) if (r.sku) m.set(r.sku, Number(r.disponible ?? r.inventario) || 0);
    return m;
  }, [ab.data]);
  const arribos = useMemo(() => arribosDeTransito(ab.data?.transito || []), [ab.data]);

  const proyecto = abierto ? res.porProyecto.find((p) => p.id === abierto) || null : null;
  const cargando = pr.isLoading || ab.isLoading;

  if (!puedeVer) {
    return (<><Cabecera onVolver={nav?.pop} /><TituloGrande titulo="Proyectos" /><Vacio icon={Lock} color={theme.textMuted} titulo="Sin acceso" sub="Tu perfil no tiene esta pestaña." /></>);
  }

  const r = res.resumen;
  const porMes = horizonte.map((m) => ({ ...m, proyectos: res.porProyecto.filter((p) => p.clave === m.clave) }));
  const visibles = mesSel ? porMes.filter((m) => m.clave === mesSel) : porMes;
  const fuera = res.porProyecto.filter((p) => !p.clave || !horizonte.some((m) => m.clave === p.clave));

  const guardar = async (fn, ok) => {
    try { await fn(); if (ok) toast.ok(ok); }
    catch (e) { toast.error(e?.message || 'No se pudo guardar'); }
  };

  return (
    <>
      <Cabecera onVolver={nav?.pop} />
      <TituloGrande titulo="Proyectos" sub={cargando ? 'Calculando cobertura…' : subHero(r)} />

      {cargando && <Cargando pantalla="movilProyectos" />}

      {!cargando && (
        <>
          <HeroM eyebrow="Proyectos y forecast" frase={fraseHero(r)}
            stats={[
              { k: 'Proyectos', v: int(r.proyectos), sub: `${r.confirmados} conf.` },
              { k: 'Piezas', v: int(r.piezas), sub: 'comprometidas' },
              { k: 'Cubierto', v: pctCorto(r.cubiertoPct), sub: 'inv + tránsito' },
              { k: 'Por comprar', v: int(r.skusPorComprar), sub: r.vencidos ? `${r.vencidos} vencidos` : 'SKUs', color: r.vencidos ? theme.red : undefined },
            ]} />

          <div style={{ padding: '12px 16px 0', display: 'flex', justifyContent: 'center' }}>
            <Segmented options={VISTAS} value={vista} onChange={setVista} style={{ width: '100%' }} />
          </div>

          {vista === 'proyectos' && (
            <>
              <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '12px 16px 4px' }}>
                <Pill tone={mesSel == null ? 'blue' : 'gray'} onClick={() => setMesSel(null)} style={{ cursor: 'pointer', flexShrink: 0 }}>Todos</Pill>
                {horizonte.map((m) => (
                  <Pill key={m.clave} tone={mesSel === m.clave ? 'blue' : 'gray'} onClick={() => setMesSel(m.clave)} style={{ cursor: 'pointer', flexShrink: 0 }}>{m.label}</Pill>
                ))}
              </div>

              {puedeEditar && (
                <div style={{ padding: '10px 16px 4px' }}>
                  <BotonGrande icon={Plus} primario onClick={() => setNuevo(true)}>Nuevo proyecto</BotonGrande>
                </div>
              )}

              {visibles.map((m) => (m.proyectos.length ? (
                <ListaAgrupada key={m.clave} titulo={m.labelLargo || m.label} meta={`${m.proyectos.length} · ${int(m.proyectos.reduce((s, p) => s + p.pz, 0))} pz`} style={{ marginTop: 14 }}>
                  {m.proyectos.map((p) => (
                    <Fila key={p.id} tono={colorCliente(p.cliente)} titulo={p.nombre}
                      sub={`${CLIENTE_LABEL[p.cliente] || p.cliente} · ${p.monto > 0 ? moneyCompact(p.monto) + ' · ' : ''}${int(p.pz)} pz · ${PROB_LABEL[p.probabilidad]}`}
                      valor={pctCorto(p.cubiertoPct)} valorSub={p.faltante > 0 ? `faltan ${int(p.faltante)}` : 'cubierto'}
                      onClick={() => setAbierto(p.id)} />
                  ))}
                </ListaAgrupada>
              ) : null))}

              {fuera.length > 0 && mesSel == null && (
                <ListaAgrupada titulo="Más adelante" meta={fuera.length} style={{ marginTop: 14 }}>
                  {fuera.map((p) => (
                    <Fila key={p.id} tono={colorCliente(p.cliente)} titulo={p.nombre}
                      sub={`${CLIENTE_LABEL[p.cliente] || p.cliente} · ${p.anio && p.mes ? etiquetaMesLarga(p.anio, p.mes) : 'sin mes'}`}
                      valor={`${int(p.pz)} pz`} onClick={() => setAbierto(p.id)} />
                  ))}
                </ListaAgrupada>
              )}

              {!res.porProyecto.length && (
                <Vacio icon={Package} color={theme.textMuted} titulo="Todavía no hay proyectos"
                  sub="Un proyecto es una venta comprometida: cliente, mes y SKUs. Al crearlo, el tablero calcula solo si alcanza el inventario." />
              )}
            </>
          )}

          {vista === 'faltantes' && res.comprasSugeridas.length > 0 && (
            <div style={{ padding: '12px 16px 0' }}>
              <BotonGrande icon={Share2} onClick={async () => { if (await compartir(textoCompartir(r, res.comprasSugeridas), { titulo: 'Proyectos y forecast' }) === 'share') toast.ok('Compartido'); }}>Compartir faltantes</BotonGrande>
            </div>
          )}

          {vista === 'faltantes' && (
            res.comprasSugeridas.length ? (
              <ListaAgrupada titulo="Qué falta comprar" meta={`${res.comprasSugeridas.length} · ${int(r.piezasPorComprar)} pz`} style={{ marginTop: 14 }}
                pie="La fecha límite es el mes objetivo menos el lead time real del proveedor (104 días cuando el SKU no tiene historia).">
                {res.comprasSugeridas.map((c) => (
                  <Fila key={c.sku} titulo={c.sku} sub={`${c.descripcion || c.proveedor || 'sin proveedor'} · para ${c.mesLabel}`}
                    valor={`${int(c.falta)} pz`} valorSub={`límite ${fechaCortaISO(c.limite)}`}
                    pill={{ tone: c.llegaTarde ? 'red' : c.diasAlLimite <= 15 ? 'orange' : 'gray', label: c.llegaTarde ? 'Vencido' : `${c.diasAlLimite} d` }}
                    chevron={false} />
                ))}
              </ListaAgrupada>
            ) : (
              <Vacio icon={Package} color={theme.textMuted} titulo="No falta comprar nada"
                sub="Todo lo comprometido tiene respaldo en inventario o en tránsito." />
            )
          )}
        </>
      )}

      <FichaProyecto abierto={!!proyecto} proyecto={proyecto} stock={stock} arribos={arribos} puedeEditar={puedeEditar}
        onCerrar={() => setAbierto(null)}
        onEstado={(prob) => guardar(() => actualizarProyecto(proyecto.id, { probabilidad: prob }), 'Estado actualizado')}
        onPiezas={(l, pz) => guardar(() => guardarLinea(proyecto.id, { sku: l.sku, piezas: pz, reservado: l.reservado }))}
        onQuitar={(l) => guardar(() => eliminarLinea(l.id), 'SKU quitado')}
        onEliminar={() => guardar(async () => { await eliminarProyecto(proyecto.id); setAbierto(null); }, 'Proyecto eliminado')} />

      <FormNuevo abierto={nuevo} horizonte={horizonte} catalogoSkus={ab.data?.catalogoSkus || []}
        onCerrar={() => setNuevo(false)}
        onCrear={(campos) => guardar(async () => { await crearProyecto(campos, perfil); setNuevo(false); }, 'Proyecto creado')} />
    </>
  );
}

// ─── Ficha del proyecto ───
function FichaProyecto({ abierto, proyecto, stock, arribos, puedeEditar, onCerrar, onEstado, onPiezas, onQuitar, onEliminar }) {
  const { theme } = useTheme();
  if (!proyecto) return <HojaM abierto={abierto} onClose={onCerrar} titulo="Proyecto" />;
  const faltaPorSku = new Map((proyecto.faltantes || []).map((f) => [f.sku, f.faltante]));

  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo={proyecto.nombre}
      sub={`${CLIENTE_LABEL[proyecto.cliente] || proyecto.cliente} · ${proyecto.anio && proyecto.mes ? etiquetaMesLarga(proyecto.anio, proyecto.mes) : 'sin mes'} · ${int(proyecto.pz)} pz`}
      alto="86vh">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 16px 12px' }}>
        <Pill tone={tonoPct(proyecto.cubiertoPct)}>{pctCorto(proyecto.cubiertoPct)} cubierto</Pill>
        {proyecto.faltante > 0 && <Pill tone="red">faltan {int(proyecto.faltante)} pz</Pill>}
        {proyecto.responsable && <span style={{ fontSize: 12, color: theme.textMuted, fontFamily: TYPO.fontText }}>{proyecto.responsable}</span>}
      </div>

      {puedeEditar && (
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', padding: '0 16px 14px' }}>
          {PROBABILIDADES.map((p) => (
            <Pill key={p.id} tone={proyecto.probabilidad === p.id ? PROB_TONE[p.id] : 'gray'} onClick={() => onEstado?.(p.id)} style={{ cursor: 'pointer', flexShrink: 0 }}>{p.label}</Pill>
          ))}
        </div>
      )}

      <ListaAgrupada titulo="SKUs" meta={proyecto.lineas?.length || 0}
        pie="Disponible = inventario comercial de hoy. Tránsito = embarques en camino; sólo cuentan los que llegan antes de que acabe el mes del proyecto.">
        {(proyecto.lineas || []).map((l) => {
          const disp = Math.round(Number(stock?.get(l.sku) || 0));
          const arr = arribos?.get(l.sku) || [];
          const prox = arr.find((a) => a.eta) || null;
          const falta = faltaPorSku.get(l.sku) || 0;
          return (
            <Fila key={l.id || l.sku} titulo={l.sku}
              sub={`${int(disp)} disp.${prox ? ` · llega ${fechaCortaISO(prox.eta)}` : ''}${falta ? ` · faltan ${int(falta)}` : ''}`}
              valor={puedeEditar ? undefined : `${int(l.piezas)} pz`}
              chevron={false}
              trailing={puedeEditar ? (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  <input type="number" min={0} defaultValue={l.piezas} inputMode="numeric"
                    onBlur={(e) => { const v = Math.round(Number(e.target.value)) || 0; if (v !== Number(l.piezas)) onPiezas?.(l, v); }}
                    style={{ width: 74, height: 32, textAlign: 'right', borderRadius: 9, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: MONO, fontSize: 14, padding: '0 8px' }} />
                  <button type="button" onClick={() => onQuitar?.(l)} aria-label="Quitar"
                    style={{ border: 0, background: 'transparent', color: theme.textMuted, padding: 4, cursor: 'pointer' }}><Trash2 size={15} /></button>
                </span>
              ) : undefined} />
          );
        })}
        {!(proyecto.lineas || []).length && <Fila titulo="Sin SKUs" sub="Agrégalos desde la computadora." chevron={false} />}
      </ListaAgrupada>

      {proyecto.notas && (
        <div style={{ padding: '14px 20px 0', fontFamily: TYPO.fontText, fontSize: 13, color: theme.textMuted, lineHeight: 1.45 }}>{proyecto.notas}</div>
      )}

      {puedeEditar && (
        <div style={{ padding: '18px 16px 8px' }}>
          <BotonGrande icon={Trash2} peligro onClick={() => { if (window.confirm(`¿Eliminar “${proyecto.nombre}”?`)) onEliminar?.(); }}>Eliminar proyecto</BotonGrande>
        </div>
      )}
    </HojaM>
  );
}

// ─── Alta de proyecto ───
function FormNuevo({ abierto, horizonte, catalogoSkus, onCerrar, onCrear }) {
  const { theme } = useTheme();
  const [nombre, setNombre] = useState('');
  const [cliente, setCliente] = useState('digitalife');
  const [mesClave, setMesClave] = useState(horizonte[0]?.clave || '');
  const [probabilidad, setProbabilidad] = useState('prospecto');
  const [busca, setBusca] = useState('');
  const [piezas, setPiezas] = useState('');
  const [lineas, setLineas] = useState([]);

  React.useEffect(() => {
    if (!abierto) return;
    setNombre(''); setCliente('digitalife'); setMesClave(horizonte[0]?.clave || '');
    setProbabilidad('prospecto'); setBusca(''); setPiezas(''); setLineas([]);
  }, [abierto, horizonte]);

  const sugerencias = useMemo(() => {
    const q = busca.trim().toUpperCase();
    if (q.length < 2) return [];
    return catalogoSkus.filter((s) => s.sku.toUpperCase().includes(q) || String(s.descripcion || '').toUpperCase().includes(q)).slice(0, 6);
  }, [busca, catalogoSkus]);

  const agregar = (s) => {
    const pz = Math.round(Number(piezas)) || 0;
    if (pz <= 0) { toast.error('Pon las piezas antes de agregar el SKU'); return; }
    setLineas((ls) => [...ls.filter((l) => l.sku !== s.sku), { sku: s.sku, piezas: pz, descripcion: s.descripcion }]);
    setBusca(''); setPiezas('');
  };

  const [anio, mes] = (mesClave || '-').split('-').map(Number);
  const crear = () => {
    if (!nombre.trim()) { toast.error('Ponle nombre al proyecto'); return; }
    onCrear?.({ nombre, cliente, anio: anio || null, mes: mes || null, probabilidad, lineas });
  };

  return (
    <HojaM abierto={abierto} onClose={onCerrar} titulo="Nuevo proyecto" alto="90vh">
      <div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del proyecto"
          style={{ height: 44, borderRadius: 11, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: TYPO.fontText, fontSize: 16, padding: '0 12px' }} />

        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {CLIENTES.map((c) => (
            <Pill key={c.key} tone={cliente === c.key ? 'blue' : 'gray'} onClick={() => setCliente(c.key)} style={{ cursor: 'pointer', flexShrink: 0 }}>{c.label}</Pill>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {horizonte.map((m) => (
            <Pill key={m.clave} tone={mesClave === m.clave ? 'blue' : 'gray'} onClick={() => setMesClave(m.clave)} style={{ cursor: 'pointer', flexShrink: 0 }}>{m.label}</Pill>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
          {PROBABILIDADES.filter((p) => p.demanda).map((p) => (
            <Pill key={p.id} tone={probabilidad === p.id ? PROB_TONE[p.id] : 'gray'} onClick={() => setProbabilidad(p.id)} style={{ cursor: 'pointer', flexShrink: 0 }}>{p.label}</Pill>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <div style={{ flex: 1 }}><CampoBusqueda value={busca} onChange={setBusca} placeholder="Buscar SKU" /></div>
          <input type="number" min={0} inputMode="numeric" value={piezas} onChange={(e) => setPiezas(e.target.value)} placeholder="pz"
            style={{ width: 86, height: 38, textAlign: 'right', borderRadius: 11, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.text, fontFamily: MONO, fontSize: 16, padding: '0 10px' }} />
        </div>

        {sugerencias.length > 0 && (
          <ListaAgrupada titulo="Resultados" style={{ padding: 0 }}>
            {sugerencias.map((s) => (
              <Fila key={s.sku} titulo={s.sku} sub={s.descripcion || 'sin descripción'} onClick={() => agregar(s)}
                pill={s.enTransito && !s.enRoadmap
                  ? { tone: 'orange', label: s.etaTransito ? `en tránsito · llega ${fechaCortaISO(s.etaTransito)}` : 'en tránsito' }
                  : null} />
            ))}
          </ListaAgrupada>
        )}
      </div>

      {lineas.length > 0 && (
        <ListaAgrupada titulo="SKUs del proyecto" meta={`${lineas.length} · ${int(lineas.reduce((s, l) => s + l.piezas, 0))} pz`} style={{ marginTop: 14 }}>
          {lineas.map((l) => (
            <Fila key={l.sku} titulo={l.sku} sub={l.descripcion || ''} valor={`${int(l.piezas)} pz`} chevron={false}
              trailing={<button type="button" onClick={() => setLineas((ls) => ls.filter((x) => x.sku !== l.sku))} aria-label="Quitar"
                style={{ border: 0, background: 'transparent', color: theme.textMuted, padding: 4, cursor: 'pointer' }}><Trash2 size={15} /></button>} />
          ))}
        </ListaAgrupada>
      )}

      <div style={{ padding: '18px 16px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BotonGrande primario icon={Plus} onClick={crear}>Crear proyecto</BotonGrande>
      </div>
    </HojaM>
  );
}
