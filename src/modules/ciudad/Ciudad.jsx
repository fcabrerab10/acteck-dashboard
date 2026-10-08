// Acteck Ciudad (etapa 1 · 2026-10-05). Pestaña aparte, sólo super admin: México estilizado en 3D low-poly cálido con
// Acteck en Guadalajara (oficina + CEDIS), el puerto de Manzanillo, una manzana por ciudad con las sucursales reales de los
// clientes, los vendedores (del ERP y de los mayoristas), los camiones con las facturas y los contenedores navegando.
// Nada de esto carga con el resto del dashboard: datos (useCiudadData) y three.js (import() de ./escena) se piden sólo aquí.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Building2, Search, Home, Map as MapaIcono } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { usePerfil } from '../../lib/perfilContext';
import { Cargando, Pill } from '../../components/kit';
import SinAcceso from '../../components/SinAcceso';
import { useCiudadData, useTopSkusTienda } from './datos';
import Carga from './Carga';
import { COLOR_CUENTA, hexCss, ciudadesTop, planoMini, leerVista, claveVista, tarjetaDe, pesosCorto, recursosBarra, misionesDelDia, CAPA_TONOS, bitacoraEventos } from './modelo';
import { useInicioData } from '../general/inicio/useInicioData';
import { calcular } from '../general/inicio/calc';

const fmtM = (v) => `$${(Number(v || 0) / 1e6).toFixed(1)} M`;
const capital = (s) => String(s || '').toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());

export default function Ciudad({ onNavegar }) {
  const { theme } = useTheme();
  const perfil = usePerfil();
  const esSuper = !!perfil?.es_super_admin;
  const { data: modelo, isLoading, error } = useCiudadData(esSuper);
  const canvasRef = useRef(null);
  const escenaRef = useRef(null);
  const [hover, setHover] = useState(null);
  const [sel, setSel] = useState(null); // { tag, pos } · pos = dónde está en pantalla lo tocado (la tarjeta flota ahí y lo sigue)
  const hoverPos = useRef(null);
  const [busca, setBusca] = useState('');
  const [listo, setListo] = useState(false);
  const [nivel, setNivel] = useState('base'); // 'base' | 'ciudad' | 'lejos': un solo botón que ofrece ir al otro nivel
  const [fallo, setFallo] = useState(null);
  const [adentro, setAdentro] = useState(false); // false | 'cedis' (racks por marca) | 'oficina' (escritorios y sala, 3.90.38)
  const [siguiendo, setSiguiendo] = useState(null); // tag que sigue la cámara (3.90.57)
  const [capa, setCapa] = useState(null); // capas de información (3.90.48): null | 'ventas' | 'cuota' | 'cartera'
  const [capaInfo, setCapaInfo] = useState(null); // lo que devolvió escena.capa(): título, leyenda y texto por ciudad
  const capaRef = useRef(null); capaRef.current = capa;
  const [vistaCam, setVistaCam] = useState(null); // { cx, cz, zoom } de la cámara para el marcador del minimapa
  // Última vista por usuario (localStorage, puede fallar en privado): la escena arranca ahí, también al cambiar tema o clima.
  const clave = claveVista(perfil?.user_id);
  const ultimaVista = useRef({ clave: null, v: null }); // se relee si cambia el usuario (el perfil llega después del primer render)
  if (ultimaVista.current.clave !== clave) { let v = null; try { v = leerVista(window.localStorage.getItem(clave)); } catch { v = null; } ultimaVista.current = { clave, v }; }
  const alMoverVista = (v) => { setVistaCam(v); ultimaVista.current = { clave, v }; try { window.localStorage.setItem(clave, JSON.stringify(v)); } catch { /* sin almacenamiento: sólo no se recuerda */ } };
  const [cargaFin, setCargaFin] = useState(false); // la pantalla «descenso desde órbita» ya terminó
  const [clima, setClima] = useState(undefined); // undefined = cargando · null = sin clima
  useEffect(() => {
    // Clima real de Guadalajara (Open-Meteo, sin llave): manda sobre el tema para día/noche, nubes y lluvia.
    const ctl = new AbortController();
    fetch('https://api.open-meteo.com/v1/forecast?latitude=20.67&longitude=-103.35&current=temperature_2m,weather_code,is_day,cloud_cover,precipitation&timezone=America%2FMexico_City', { signal: ctl.signal })
      .then((r) => r.json()).then((j) => { const c = j?.current; if (!c) { setClima(null); return; } const code = Number(c.weather_code); setClima({ esDia: Number(c.is_day) === 1, nubes: Math.max(0, Math.min(1, Number(c.cloud_cover) / 100)), lluvia: Number(c.precipitation) > 0 || (code >= 51 && code <= 99), temp: Number(c.temperature_2m), code }); })
      .catch(() => setClima(null));
    return () => ctl.abort();
  }, []);
  const oscuro = theme.mode === 'dark';

  useEffect(() => {
    if (!modelo || !canvasRef.current || clima === undefined) return undefined;
    let vivo = true; setListo(false); setFallo(null);
    import('./escena').then(({ crearEscena }) => {
      if (!vivo) return;
      try {
        escenaRef.current = crearEscena(canvasRef.current, modelo, {
          oscuro, clima, onError: (e) => setFallo(String(e?.stack || e?.message || e)),
          onHover: (tag, pos) => { hoverPos.current = tag ? pos : null; setHover(tag ? { tag, pos } : null); },
          onClick: (tag) => setSel(tag ? { tag, pos: hoverPos.current } : null),
          onSeleccion: (pos) => setSel((s) => (s ? { ...s, pos } : s)), // la tarjeta sigue al edificio; fuera de cuadro se acomoda arriba a la derecha
          onNivel: setNivel, onAdentro: setAdentro, onSiguiendo: setSiguiendo, onVista: alMoverVista, vistaInicial: ultimaVista.current.v,
        });
        if (capaRef.current) setCapaInfo(escenaRef.current.capa(capaRef.current)); // al rehacer la escena (tema/clima) la capa sigue
        setListo(true);
      } catch (e) { console.error('[ciudad] escena', e); setFallo(String(e?.stack || e?.message || e)); }
    }).catch((e) => { console.error('[ciudad] carga', e); setFallo(String(e?.message || e)); });
    return () => { vivo = false; escenaRef.current?.destruir(); escenaRef.current = null; };
  }, [modelo, oscuro, clima]);

  const navegar = (tag) => {
    if (!tag?.pagina) return;
    const detail = { pagina: tag.pagina, clienteKey: null, extra: null };
    if (tag.tipo === 'tienda' || tag.tipo === 'vendedor') detail.extra = { cuenta: tag.cuenta };
    if (onNavegar) onNavegar(null, tag.pagina, detail.extra); else window.dispatchEvent(new CustomEvent('acteck:navegar', { detail }));
  };
  const ponerCapa = (c) => { setCapa(c); setCapaInfo(escenaRef.current?.capa(c) || null); };
  const bitacora = useMemo(() => { try { return bitacoraEventos(modelo); } catch (e) { console.warn('[ciudad] bitácora', e); return []; } }, [modelo]); // falla sola
  const misiones = useMemo(() => { try { return misionesDelDia(modelo); } catch (e) { console.warn('[ciudad] misiones', e); return []; } }, [modelo]); // falla sola
  const top = useMemo(() => ciudadesTop(modelo, 5), [modelo]); // acceso rápido: las 5 ciudades con más actividad
  const plano = useMemo(() => planoMini(modelo?.distritos), [modelo]); // minimapa: México chico con un punto por ciudad
  const marco = plano.marco(vistaCam);
  const tocarPlano = (e) => {
    // Tocar el minimapa: si cae junto a una ciudad viaja a su Vista Ciudad; si no, mueve la cámara a ese punto sin cambiar el zoom.
    const r = e.currentTarget.getBoundingClientRect(); if (!r.width || !r.height) return;
    const u = (e.clientX - r.left) * plano.ancho / r.width, v = (e.clientY - r.top) * plano.alto / r.height;
    const ciudad = plano.cercana(u, v, 7);
    escenaRef.current?.irA(ciudad ? { tipo: 'ciudad', ciudad } : { tipo: 'punto', ...plano.aEscena(u, v) });
  };
  const resultados = useMemo(() => {
    if (!modelo || !busca.trim()) return [];
    const q = busca.trim().toUpperCase();
    const out = [];
    for (const d of modelo.distritos) { if (d.ciudad.includes(q)) out.push({ tipo: 'ciudad', titulo: capital(d.ciudad), sub: `${d.tiendas.length} tiendas`, ciudad: d.ciudad }); for (const t of d.tiendas) if (`${t.nombreCuenta} ${t.sucursal}`.toUpperCase().includes(q)) out.push({ tipo: 'tienda', titulo: `${t.nombreCuenta} · ${t.sucursal}`, sub: capital(d.ciudad), ciudad: d.ciudad, cuenta: t.cuenta }); for (const v of d.vendedores) if (v.nombreCompleto.toUpperCase().includes(q)) out.push({ tipo: 'vendedor', titulo: v.nombre, sub: `${v.nombreCuenta} · ${capital(d.ciudad)}`, ciudad: d.ciudad }); }
    if ('ACTECK OFICINA CEDIS'.includes(q)) out.push({ tipo: 'cedis', titulo: 'Acteck · CEDIS', sub: 'Guadalajara' });
    if ('MANZANILLO PUERTO'.includes(q)) out.push({ tipo: 'puerto', titulo: 'Puerto de Manzanillo', sub: 'contenedores' });
    return out.slice(0, 8);
  }, [modelo, busca]);

  if (!esSuper) return <SinAcceso motivo="Acteck Ciudad está en construcción y por ahora sólo la ve Fernando." />;
  if (error) return <div style={{ padding: 24, color: theme.red, fontFamily: TYPO.fontText }}>No se pudo cargar la ciudad: {String(error.message || error)}</div>;
  const k = modelo?.kpis;
  const PASOS = ['Saliendo de órbita…', 'Bajando el motor 3D…', 'Trayendo tus sucursales…', 'Contando contenedores en el mar…', 'Leyendo el clima de Guadalajara…', 'Encendiendo las luces…'];
  const card = { background: oscuro ? 'rgba(28,28,30,.86)' : 'rgba(255,255,255,.88)', border: `1px solid ${theme.border}`, borderRadius: 12, backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)', fontFamily: TYPO.fontText, color: theme.text };
  return (
    <div style={{ position: 'relative', height: 'calc(100vh - 92px)', minHeight: 520, borderRadius: 14, overflow: 'hidden', border: `1px solid ${theme.border}`, background: oscuro ? '#121722' : '#EAF2F7' }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none', opacity: listo ? 1 : 0, transition: 'opacity 600ms cubic-bezier(.32,.72,0,1)' }} />
      {!cargaFin && !fallo && <Carga pasos={PASOS} listo={listo} onFin={() => setCargaFin(true)} />}
      {fallo && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', padding: 24, zIndex: 9 }}><pre style={{ ...card, padding: 16, maxWidth: 720, whiteSpace: 'pre-wrap', fontSize: 12, color: theme.red }}>No se pudo dibujar la ciudad:\n{fallo}</pre></div>}
      {/* cabecera */}
      {modelo && <>
      <div style={{ position: 'absolute', left: 14, top: 12, display: 'flex', gap: 8, alignItems: 'center', zIndex: 3 }}>
        <div style={{ ...card, padding: '8px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Building2 size={16} style={{ color: theme.accent }} />
          <span style={{ fontFamily: TYPO.fontDisplay, fontWeight: 700, letterSpacing: '-0.02em' }}>acteck<span style={{ color: theme.accent }}>.</span> Ciudad</span>
          <Pill size="xs" tone="gray">etapa 1</Pill>
          {clima && <span style={{ fontSize: 12, color: theme.textMuted }}>{clima.lluvia ? '🌧' : clima.nubes > .6 ? '☁️' : clima.nubes > .25 ? '⛅' : clima.esDia ? '☀️' : '🌙'} {Math.round(clima.temp)}° en Guadalajara</span>}
        </div>
        <div style={{ ...card, padding: '6px 10px', display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <Search size={14} style={{ color: theme.textMuted }} />
          <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Ciudad, sucursal o vendedor" style={{ border: 0, outline: 'none', background: 'transparent', color: theme.text, fontFamily: TYPO.fontText, fontSize: 13, width: 210 }} />
          {resultados.length > 0 && (
            <div style={{ ...card, position: 'absolute', left: 0, top: 36, width: 300, padding: 4, zIndex: 5 }}>
              {resultados.map((r, i) => <button key={i} type="button" onClick={() => { escenaRef.current?.irA(r); setBusca(''); }} style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: 'transparent', color: theme.text, padding: '7px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: TYPO.fontText, fontSize: 13 }}><div style={{ fontWeight: 600 }}>{r.titulo}</div><div style={{ fontSize: 11.5, color: theme.textMuted }}>{r.sub}</div></button>)}
            </div>
          )}
        </div>
        {adentro && <button type="button" onClick={() => { escenaRef.current?.entrar(false); escenaRef.current?.irA({ tipo: 'base' }); }} title={`Salir ${adentro === 'oficina' ? 'de la oficina' : 'del CEDIS'} y volver a la base`} style={{ ...card, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: theme.text }}>← Salir {adentro === 'oficina' ? 'de la oficina' : 'del CEDIS'}</button>}
        {nivel === 'ciudad'
          ? <button type="button" onClick={() => escenaRef.current?.irA({ tipo: 'mapa' })} title="Regresar al mapa de México" style={{ ...card, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}>← <MapaIcono size={14} />Volver al mapa</button>
          : nivel === 'lejos'
          ? <button type="button" onClick={() => escenaRef.current?.irA({ tipo: 'base' })} title="Volver a la base de Acteck (oficina, CEDIS y puerto)" style={{ ...card, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}><Home size={14} />Base</button>
          : <button type="button" onClick={() => escenaRef.current?.irA({ tipo: 'mapa' })} title="Ver el mapa de México completo con todas las ciudades" style={{ ...card, padding: '7px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600 }}><MapaIcono size={14} />Mapa</button>}
      </div>
      {top.length > 0 && (
        <div style={{ position: 'absolute', left: 14, top: 52, zIndex: 3, display: 'flex', flexWrap: 'wrap', gap: 6, maxWidth: 'calc(50% - 28px)' }}>
          {top.map((c) => <button key={c.ciudad} type="button" onClick={() => escenaRef.current?.irA({ tipo: 'ciudad', ciudad: c.ciudad })} title={`Ir a ${c.nombre}: ${c.activas} tienda${c.activas === 1 ? '' : 's'} activa${c.activas === 1 ? '' : 's'}${c.llegando ? ` · ${c.llegando} camión${c.llegando === 1 ? '' : 'es'} llegando` : ''}`} style={{ ...card, padding: '4px 9px', cursor: 'pointer', fontSize: 11.5, fontWeight: 600, color: theme.text }}>{c.nombre} <span style={{ color: theme.textMuted, fontWeight: 500 }}>{c.actividad}</span></button>)}
        </div>
      )}
      <BarraRecursos card={card} theme={theme} irA={(t) => escenaRef.current?.irA(t)} ayuda="Arrastra para moverte · rueda = zoom hacia el cursor · clic derecho = girar · flechas" />
      {/* Leyenda: color por cliente */}
      <div style={{ position: 'absolute', right: 14, top: 68, zIndex: 3, ...card, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px 10px', maxWidth: 420, fontSize: 11 }}>
        {[...new Set(modelo.distritos.flatMap((d) => d.tiendas.map((t) => `${t.cuenta}|${t.nombreCuenta}`)))].map((k) => { const [c, n] = k.split('|'); return <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: hexCss(COLOR_CUENTA[c] || 0x8E8E93), display: 'inline-block' }} />{n}</span>; })}
      </div>
      {/* «Hoy en Acteck» (3.90.46): misiones del día con «Ir» (misionesDelDia), la bitácora con «Ver» (bitacoraEventos, 3.90.50) y lo que está pasando en la ciudad */}
      <div style={{ position: 'absolute', right: 14, bottom: 14, width: 270, zIndex: 3, ...card, padding: '10px 12px', fontSize: 12, lineHeight: 1.45, maxHeight: '48%', overflowY: 'auto' }}>
        {misiones.length > 0 && <>
          <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, marginBottom: 4 }}>Hoy en Acteck · {misiones.filter((x) => !x.hecha).length} pendiente{misiones.filter((x) => !x.hecha).length === 1 ? '' : 's'}</div>
          {misiones.map((mi) => (
            <div key={mi.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '3px 0', opacity: mi.hecha ? 0.55 : 1 }}>
              {mi.nivel ? <i style={{ width: 7, height: 7, borderRadius: 4, flex: 'none', background: mi.nivel === 'rojo' ? theme.red : (theme.orange || '#FF9F0A') }} /> : <i style={{ width: 7, flex: 'none' }} />}
              <span style={{ flex: 1, minWidth: 0, textDecoration: mi.hecha ? 'line-through' : 'none' }}>{mi.hecha ? '✓' : mi.icono} {mi.texto}</span>
              <button type="button" onClick={() => { escenaRef.current?.irA(mi.ir); setSel({ tag: mi.tarjeta, pos: null }); }} title="Volar al lugar y abrir su tarjeta" style={{ flex: 'none', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, borderRadius: 8, padding: '1px 8px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}>Ir</button>
            </div>
          ))}
          <div style={{ height: 1, background: theme.border, margin: '6px 0' }} />
        </>}
        {bitacora.length > 0 && <>
          <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, marginBottom: 4 }}>Bitácora</div>
          {bitacora.map((ev) => (
            <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '2px 0' }}>
              <span style={{ flex: 'none', width: 46, fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums' }}>{ev.cuando}</span>
              <span style={{ flex: 1, minWidth: 0, fontWeight: ev.grande ? 700 : 400 }}>{ev.icono} {ev.texto}</span>
              {ev.ir && <button type="button" onClick={() => { escenaRef.current?.irA(ev.ir); setSel(ev.tarjeta ? { tag: ev.tarjeta, pos: null } : null); }} title="Volar al lugar" style={{ flex: 'none', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.accent, borderRadius: 8, padding: '1px 7px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}>Ver</button>}
            </div>
          ))}
          <div style={{ height: 1, background: theme.border, margin: '6px 0' }} />
        </>}
        <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, marginBottom: 4 }}>En la ciudad</div>
        {modelo.oficina.personas.filter((p) => p.actividad).map((p) => <div key={p.id}>👤 <b>{p.nombre.split(' ')[0]}</b>: {p.actividad}</div>)}
        {modelo.puerto.barcos.slice(0, 3).map((b) => <div key={b.id}>🚢 <b>{b.id}</b> llega {b.llegaEnDias == null ? 'sin ETA' : b.llegaEnDias <= 0 ? 'hoy' : `en ${b.llegaEnDias} d`}</div>)}
        {modelo.kpis.cartera.filter((c) => c.vencido > 0).map((c) => <div key={c.cuenta}>🚩 <b>{capital(c.cuenta)}</b>: cartera vencida {fmtM(c.vencido)} · DSO {c.dso} d</div>)}
        {modelo.distritos.slice(0, 3).map((d) => <div key={d.ciudad}>🏬 {capital(d.ciudad)}: {d.tiendas.filter((t) => t.vendio).length} de {d.tiendas.length} tiendas activas</div>)}
        {!modelo.camiones.length && !modelo.puerto.barcos.length && <div style={{ color: theme.textMuted }}>Sin movimiento registrado hoy.</div>}
      </div>
      {/* Minimapa + KPIs (columna abajo a la izquierda para que no se encimen) */}
      <div style={{ position: 'absolute', left: 14, bottom: 14, right: 298, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, zIndex: 3, pointerEvents: 'none' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', pointerEvents: 'auto' }}>
        <div style={{ ...card, padding: 3, display: 'flex', gap: 2 }} role="group" aria-label="Capas de información">
          {[[null, 'Sin capa'], ['ventas', 'Ventas'], ['cuota', 'Cuota'], ['cartera', 'Cartera']].map(([c, l]) => <button key={l} type="button" onClick={() => ponerCapa(c)} aria-pressed={capa === c} title={c ? `Pintar las ciudades por ${l.toLowerCase()}` : 'Quitar la capa'} style={{ border: 0, borderRadius: 9, padding: '4px 9px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText, background: capa === c ? theme.accent : 'transparent', color: capa === c ? '#fff' : theme.text }}>{l}</button>)}
        </div>
        {capa && capaInfo && <div style={{ ...card, padding: '5px 9px', display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '3px 9px', fontSize: 11 }}>
          <b style={{ fontWeight: 700 }}>{capaInfo.titulo}</b>
          {capaInfo.leyenda.map((l) => <span key={l.tono} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: theme.textMuted }}><i style={{ width: 9, height: 9, borderRadius: 5, background: hexCss(CAPA_TONOS[l.tono]) }} />{l.texto}</span>)}
        </div>}
      </div>
      <div style={{ ...card, padding: 4, pointerEvents: 'auto' }} title="Minimapa: toca una ciudad para viajar ahí o cualquier punto para mover la cámara">
        <svg width={plano.ancho} height={plano.alto} viewBox={`0 0 ${plano.ancho} ${plano.alto}`} onClick={tocarPlano} style={{ display: 'block', cursor: 'pointer' }} role="img" aria-label="Minimapa de México">
          <polygon points={plano.contorno} fill={oscuro ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.06)'} stroke={theme.border} strokeWidth={1} strokeLinejoin="round" />
          {plano.puntos.map((p) => { const esTop = top.some((c) => c.ciudad === p.ciudad); return <circle key={p.ciudad} cx={p.u} cy={p.v} r={esTop ? 2.6 : 1.7} fill={esTop ? theme.accent : theme.textMuted}><title>{capital(p.ciudad)}</title></circle>; })}
          {marco && <circle cx={marco.u} cy={marco.v} r={marco.r} fill="none" stroke={theme.red} strokeWidth={1.5} pointerEvents="none" />}
          {marco && <circle cx={marco.u} cy={marco.v} r={1.5} fill={theme.red} pointerEvents="none" />}
        </svg>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', pointerEvents: 'auto' }}>
        {[['Tiendas', `${k.tiendasVendieron} de ${k.tiendas} vendieron`], ['Ciudades', `${k.ciudades}`], ['Contenedores', `${k.barcos} navegando`], ['Camiones', `${k.camiones} en ruta`], ['Clientes finales', `${k.clientesFinales.toLocaleString('es-MX')} · 2 meses`], ['CEDIS', `${fmtM(modelo.cedis.valor)} · ${Math.round(modelo.cedis.dias)} d`], ['Oficina', `${modelo.oficina.personas.length + modelo.oficina.genericos} personas · ${modelo.oficina.reuniones} reuniones`]].map(([l, v]) => (
          <div key={l} style={{ ...card, padding: '8px 12px', minWidth: 110 }}><div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>{l}</div><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14.5, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{v}</div></div>
        ))}
      </div>
      </div>
      {siguiendo && (
        <div style={{ position: 'absolute', left: '50%', top: 56, transform: 'translateX(-50%)', zIndex: 4, ...card, padding: '6px 8px 6px 12px', display: 'flex', alignItems: 'center', gap: 10, maxWidth: 'min(520px, calc(100% - 28px))', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>Siguiendo</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{siguiendo.titulo} <span style={{ fontWeight: 400, color: theme.textMuted }}>· {siguiendo.sub}</span></div>
          </div>
          <button type="button" onClick={() => escenaRef.current?.seguir(null)} title="Soltar (o pulsa Esc)" style={{ flex: 'none', border: `1px solid ${theme.border}`, background: 'transparent', color: theme.text, borderRadius: 8, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: TYPO.fontText }}>Soltar</button>
        </div>
      )}
      {/* hover */}
      {hover && !sel && (
        <div style={{ position: 'fixed', left: hover.pos.x, top: hover.pos.y, transform: 'translate(-50%,-100%)', zIndex: 60, ...card, padding: '6px 10px', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.14)', maxWidth: 320 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{hover.tag.titulo}</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted }}>{hover.tag.sub}</div>
          {capa && hover.tag.tipo === 'ciudad' && capaInfo?.porCiudad.get(hover.tag.ciudad) && <div style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2, color: hexCss(CAPA_TONOS[capaInfo.porCiudad.get(hover.tag.ciudad).tono]) }}>{capaInfo.porCiudad.get(hover.tag.ciudad).texto}</div>}
        </div>
      )}
      {/* Tarjeta del edificio (estilo Hay Day): flota junto a lo que tocaste; una sola plantilla para todo (tarjetaDe en modelo.js) */}
      {sel && (() => {
        const tj = tarjetaDe(sel.tag, modelo); const s = sel.tag;
        const ESTADO = { verde: [theme.green, 'Bien'], ambar: [theme.orange || '#FF9F0A', 'Atención'], rojo: [theme.red, 'Urgente'] };
        const W = 280, vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
        const flota = sel.pos ? { position: 'fixed', left: Math.max(W / 2 + 8, Math.min(vw - W / 2 - 8, sel.pos.x)), top: sel.pos.y < 300 ? sel.pos.y + 18 : sel.pos.y - 12, transform: `translate(-50%, ${sel.pos.y < 300 ? '0' : '-100%'})`, zIndex: 60 } : { position: 'absolute', right: 14, top: 72, zIndex: 4 };
        return (
        <div style={{ ...flota, width: W, ...card, padding: 14, boxShadow: '0 18px 50px rgba(0,0,0,.18)' }}>
          <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" style={{ position: 'absolute', right: 10, top: 10, border: 0, background: theme.border, color: theme.text, width: 24, height: 24, borderRadius: 12, cursor: 'pointer' }}>×</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, paddingRight: 28 }}>
            {tj.estado && <i title={ESTADO[tj.estado][1]} style={{ width: 10, height: 10, borderRadius: 5, background: ESTADO[tj.estado][0], flex: 'none', boxShadow: `0 0 0 3px ${ESTADO[tj.estado][0]}33` }} />}
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>{tj.titulo}</div>
          </div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.4 }}>{tj.sub}</div>
          {tj.numeros.length > 0 && <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginTop: 10 }}>{tj.numeros.map(([l, v]) => <div key={l} style={{ background: oscuro ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', borderRadius: 9, padding: '6px 8px' }}><div style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>{l}</div><div style={{ fontFamily: TYPO.fontDisplay, fontSize: 14, fontWeight: 700, fontVariantNumeric: 'tabular-nums', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v}</div></div>)}</div>}
          {s.tipo === 'tienda' && s.sucursal && <TopSkusTienda cuenta={s.cuenta} sucursal={s.sucursal} theme={theme} oscuro={oscuro} />}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {tj.pagina && <button type="button" onClick={() => navegar(s)} style={{ flex: 1, height: 36, border: 0, borderRadius: 10, background: theme.accent, color: '#fff', fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{tj.pagina === 'sellOut' ? 'Abrir en Sell Out' : 'Abrir en el dashboard'}</button>}
            {s.tipo === 'cedis' && escenaRef.current?.hayRacks && !adentro && <button type="button" onClick={() => { escenaRef.current?.entrarCedis(true); setSel(null); }} title="Ver los racks por marca dentro del CEDIS" style={{ height: 36, padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 10, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Entrar</button>}
            {s.tipo === 'oficina' && escenaRef.current?.hayOficina && !adentro && <button type="button" onClick={() => { escenaRef.current?.entrar('oficina'); setSel(null); }} title="Ver los escritorios y la sala de juntas" style={{ height: 36, padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 10, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Entrar</button>}
            {['vendedorErp', 'camion', 'barco'].includes(s.tipo) && <button type="button" onClick={() => escenaRef.current?.seguir(s)} title="La cámara lo sigue; arrastra o pulsa Esc para soltarlo" style={{ height: 36, padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 10, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Seguir</button>}
            <button type="button" onClick={() => escenaRef.current?.irA(s)} style={{ height: 36, padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 10, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ir ahí</button>
          </div>
        </div>
        );
      })()}
      </>}
    </div>
  );
}

// Tienda visitable (3.90.41): top 5 SKUs de la sucursal tocada; se pide sólo al abrir su tarjeta. Si falla, no se muestra.
function TopSkusTienda({ cuenta, sucursal, theme, oscuro }) {
  const { data, isLoading, error } = useTopSkusTienda(cuenta, sucursal);
  if (error) return null;
  return (
    <div style={{ marginTop: 10, background: oscuro ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.04)', borderRadius: 9, padding: '6px 8px' }}>
      <div style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>Top SKUs · {data?.periodo || 'este mes'}</div>
      {isLoading ? <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>Cargando…</div>
        : !data?.lista?.length ? <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 3 }}>Sin venta por SKU</div>
        : data.lista.map((r) => <div key={r.sku} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 12, marginTop: 3, fontVariantNumeric: 'tabular-nums' }}><span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.sku}</span><span style={{ color: theme.textMuted, flex: 'none' }}>{pesosCorto(r.importe)} · {Math.round(r.cantidad).toLocaleString('es-MX')} pz</span></div>)}
    </div>
  );
}

// Barra superior tipo recursos (3.90.42): ventas del mes vs cuota, inventario, cartera vencida y en tránsito con los MISMOS
// números que Inicio (useInicioData + calcular). Tocar un recurso vuela a su edificio. Si Inicio falla, la barra no aparece
// y queda la ayuda de siempre.
function BarraRecursos({ card, theme, irA, ayuda }) {
  const hoy = useMemo(() => new Date(), []);
  const { data } = useInicioData(hoy.getFullYear());
  const recursos = useMemo(() => {
    if (!data) return [];
    try { return recursosBarra(calcular(data, [], { anio: hoy.getFullYear(), mesActual: hoy.getMonth() + 1, hoy, modo: 'mes', sensible: true, enCurso: true })); } catch (e) { console.warn('[ciudad] barra de recursos', e); return []; }
  }, [data, hoy]);
  if (!recursos.length) return <div style={{ position: 'absolute', right: 14, top: 12, zIndex: 3, ...card, padding: '7px 12px', fontSize: 11.5, color: theme.textMuted }}>{ayuda}</div>;
  const TONO = { verde: theme.green, ambar: theme.orange || '#FF9F0A', rojo: theme.red };
  return (
    <div title={ayuda} style={{ position: 'absolute', right: 14, top: 12, zIndex: 3, display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, maxWidth: 'calc(50% - 28px)' }}>
      {recursos.map((r) => (
        <button key={r.clave} type="button" onClick={() => irA(r.ir)} title={`${r.etiqueta} · ir al edificio`} style={{ ...card, padding: '5px 10px', cursor: 'pointer', textAlign: 'left', color: theme.text, minWidth: 92 }}>
          <div style={{ fontSize: 9.5, letterSpacing: '.06em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, whiteSpace: 'nowrap' }}>{r.icono} {r.etiqueta}</div>
          <div style={{ fontSize: 13, fontWeight: 700, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap', color: r.clave === 'cartera' && r.tono === 'rojo' ? TONO.rojo : theme.text }}>
            {fmtM(r.valor)}{r.pct != null && <span style={{ fontSize: 11, fontWeight: 600, color: TONO[r.tono] || theme.textMuted }}> · {r.pct}%</span>}{r.extra && <span style={{ fontSize: 11, fontWeight: 500, color: theme.textMuted }}> · {r.extra}</span>}
          </div>
          {r.pct != null && <div style={{ height: 3, borderRadius: 2, background: theme.border, marginTop: 3, overflow: 'hidden' }}><div style={{ width: `${Math.min(100, r.pct)}%`, height: '100%', background: TONO[r.tono] || theme.accent }} /></div>}
        </button>
      ))}
    </div>
  );
}
