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
import { useCiudadData } from './datos';
import Carga from './Carga';
import { COLOR_CUENTA, hexCss, ciudadesTop, planoMini } from './modelo';

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
  const [sel, setSel] = useState(null);
  const [busca, setBusca] = useState('');
  const [listo, setListo] = useState(false);
  const [nivel, setNivel] = useState('base'); // 'base' | 'ciudad' | 'lejos': un solo botón que ofrece ir al otro nivel
  const [fallo, setFallo] = useState(null);
  const [vistaCam, setVistaCam] = useState(null); // { cx, cz, zoom } de la cámara para el marcador del minimapa
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
          onHover: (tag, pos) => setHover(tag ? { tag, pos } : null),
          onClick: (tag) => setSel(tag),
          onNivel: setNivel, onVista: setVistaCam,
        });
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
      <div style={{ position: 'absolute', right: 14, top: 12, zIndex: 3, ...card, padding: '7px 12px', fontSize: 11.5, color: theme.textMuted }}>Arrastra para moverte · rueda = zoom hacia el cursor · clic derecho = girar · flechas</div>
      {/* Leyenda: color por cliente */}
      <div style={{ position: 'absolute', right: 14, top: 52, zIndex: 3, ...card, padding: '8px 10px', display: 'flex', flexWrap: 'wrap', gap: '4px 10px', maxWidth: 420, fontSize: 11 }}>
        {[...new Set(modelo.distritos.flatMap((d) => d.tiendas.map((t) => `${t.cuenta}|${t.nombreCuenta}`)))].map((k) => { const [c, n] = k.split('|'); return <span key={c} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><i style={{ width: 9, height: 9, borderRadius: 3, background: hexCss(COLOR_CUENTA[c] || 0x8E8E93), display: 'inline-block' }} />{n}</span>; })}
      </div>
      {/* Hoy en la ciudad: lo que está pasando ahora mismo */}
      <div style={{ position: 'absolute', right: 14, bottom: 14, width: 270, zIndex: 3, ...card, padding: '10px 12px', fontSize: 12, lineHeight: 1.45, maxHeight: '42%', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700, marginBottom: 4 }}>Hoy en la ciudad</div>
        {modelo.oficina.reunionEnCurso && <div>🟡 En la sala: <b>{modelo.oficina.reunionEnCurso.titulo}</b></div>}
        {modelo.oficina.personas.filter((p) => p.actividad).map((p) => <div key={p.id}>👤 <b>{p.nombre.split(' ')[0]}</b>: {p.actividad}</div>)}
        {modelo.puerto.tarimas.slice(0, 3).map((t) => <div key={t.id}>📦 Descargando <b>{t.id}</b> · {t.piezas.toLocaleString('es-MX')} pz</div>)}
        {modelo.puerto.barcos.slice(0, 3).map((b) => <div key={b.id}>🚢 <b>{b.id}</b> llega {b.llegaEnDias == null ? 'sin ETA' : b.llegaEnDias <= 0 ? 'hoy' : `en ${b.llegaEnDias} d`}</div>)}
        {modelo.camiones.slice(0, 4).map((c) => <div key={c.folio}>🚚 <b>{c.folio}</b> → {c.cliente} · {fmtM(c.monto)}</div>)}
        {modelo.kpis.cartera.filter((c) => c.vencido > 0).map((c) => <div key={c.cuenta}>🚩 <b>{capital(c.cuenta)}</b>: cartera vencida {fmtM(c.vencido)} · DSO {c.dso} d</div>)}
        {modelo.distritos.slice(0, 3).map((d) => <div key={d.ciudad}>🏬 {capital(d.ciudad)}: {d.tiendas.filter((t) => t.vendio).length} de {d.tiendas.length} tiendas activas</div>)}
        {!modelo.camiones.length && !modelo.puerto.barcos.length && <div style={{ color: theme.textMuted }}>Sin movimiento registrado hoy.</div>}
      </div>
      {/* Minimapa + KPIs (columna abajo a la izquierda para que no se encimen) */}
      <div style={{ position: 'absolute', left: 14, bottom: 14, right: 298, display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 8, zIndex: 3, pointerEvents: 'none' }}>
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
      {/* hover */}
      {hover && !sel && (
        <div style={{ position: 'fixed', left: hover.pos.x, top: hover.pos.y, transform: 'translate(-50%,-100%)', zIndex: 60, ...card, padding: '6px 10px', pointerEvents: 'none', boxShadow: '0 8px 24px rgba(0,0,0,.14)', maxWidth: 320 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>{hover.tag.titulo}</div>
          <div style={{ fontSize: 11.5, color: theme.textMuted }}>{hover.tag.sub}</div>
        </div>
      )}
      {/* panel de selección */}
      {sel && (
        <div style={{ position: 'absolute', right: 14, top: 56, width: 300, zIndex: 4, ...card, padding: 14, boxShadow: '0 18px 50px rgba(0,0,0,.16)' }}>
          <button type="button" onClick={() => setSel(null)} aria-label="Cerrar" style={{ position: 'absolute', right: 10, top: 10, border: 0, background: theme.border, color: theme.text, width: 24, height: 24, borderRadius: 12, cursor: 'pointer' }}>×</button>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em', paddingRight: 28 }}>{sel.titulo}</div>
          <div style={{ fontSize: 12.5, color: theme.textMuted, marginTop: 2, lineHeight: 1.4 }}>{sel.sub}</div>
          {sel.persona && !sel.persona.generico && <div style={{ fontSize: 12.5, marginTop: 8 }}>{sel.persona.pendientes} pendientes hoy · {sel.persona.hechas} hechas</div>}
          {sel.distrito && <div style={{ marginTop: 8, maxHeight: 180, overflowY: 'auto', fontSize: 12 }}>{sel.distrito.tiendas.slice(0, 14).map((t) => <div key={t.nombre} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '3px 0', borderTop: `1px solid ${theme.border}` }}><span style={{ color: t.vendio ? theme.text : theme.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.nombre}</span><b style={{ fontVariantNumeric: 'tabular-nums', color: t.vendio ? theme.green : theme.textMuted }}>{t.vendio ? `$${t.importe >= 1e6 ? `${(t.importe / 1e6).toFixed(1)} M` : `${Math.round(t.importe / 1e3)} K`}` : '—'}</b></div>)}</div>}
          {sel.barco && <div style={{ fontSize: 12.5, marginTop: 8 }}>{sel.barco.supplier}<br />ETA puerto {sel.barco.eta || '—'} · CEDIS {sel.barco.arribo || '—'} · {sel.barco.estatus}</div>}
          <div style={{ display: 'flex', gap: 6, marginTop: 12 }}>
            {sel.pagina && <button type="button" onClick={() => navegar(sel)} style={{ flex: 1, height: 36, border: 0, borderRadius: 10, background: theme.accent, color: '#fff', fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Abrir en el dashboard</button>}
            <button type="button" onClick={() => escenaRef.current?.irA(sel)} style={{ height: 36, padding: '0 12px', border: `1px solid ${theme.border}`, borderRadius: 10, background: 'transparent', color: theme.text, fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Ir ahí</button>
          </div>
        </div>
      )}
      </>}
    </div>
  );
}
