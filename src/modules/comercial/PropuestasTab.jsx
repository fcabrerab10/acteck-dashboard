// PropuestasTab.jsx — Armador de propuestas de venta por cliente (V3, kit).
// Flujo (2 vistas + hoja): Landing (tarjetas de cliente con "Nueva propuesta" directo + recientes por mes + efectividad
//   + SPIFFs) → Armar (catálogo con sugeridos + Mi propuesta) → Revisar como HojaLateral sobre Armar (edición en sitio,
//   Excel / PDF / Compartir).
// Piezas en ./propuestas/: Landing, TarjetaCliente, TarjetaPropuesta, Armar, MiPropuesta, PrecioPicker, Revisar, SpiffPanel,
//   recientes.js (propuestas_borradores), efectividad.js (ventana + cierre automático), sugeridos.js (cobertura crítica),
//   textos.js (WhatsApp), filtros.js, datos.js, spiffs.js, excelPropuesta.js.
// Persistencia: SÓLO propuestas_borradores (los recientes de localStorage se migran una vez y se borran).
// Autoguardado: ~3 s después de cada cambio (líneas, nombre, vigencia), al salir de Armar y al desmontar la pestaña;
//   el botón Guardar sigue como acción explícita. Nombre lo escribe Fernando (obligatorio para enviar); vigencia =
//   último día del mes en curso, editable en Revisar.
// Sensible: margen/costo sólo con puedeVerSensible(perfil); Excel y WhatsApp nunca llevan costo.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import SinAcceso from '../../components/SinAcceso';
import { Cargando, Panel, Pill, Boton, toast } from '../../components/kit';
import { HojaLateral } from '../../components/perfil/comun';
import { usePerfil } from '../../lib/perfilContext';
import { puedeVerPestanaGlobal, puedeVerSensible } from '../../lib/permisos';
import { compartir } from '../../lib/whatsapp';

import { CLIENTES, MES_ACTUAL, MES_FULL, nuevaPropuestaId, vigenciaPorDefecto } from './propuestas/constantes';
import { fetchCatalogo, fetchPreciosVigentes } from './propuestas/datos';
import { listarPropuestas, guardarPropuesta, actualizarPropuesta, eliminarPropuesta, marcarEnviada, migrarRecientesLocales, lineasDesdeMapa, mapaDesdeLineas, resumenDe } from './propuestas/recientes';
import { cargarFacturacionVentanas, calcularEfectividad, aplicarCierreAutomatico, memoriaPorSku } from './propuestas/efectividad';
import { textoPropuesta } from './propuestas/textos';
import { cargarExcelSpiffs } from './propuestas/spiffs';
import Landing from './propuestas/Landing';
import Armar from './propuestas/Armar';
import Revisar from './propuestas/Revisar';
import SpiffPanel from './propuestas/SpiffPanel';

const SILUETA_ARMAR = [
  { tipo: 'fila', items: 3, alto: 28 }, { tipo: 'hero', stats: 4 },
  { tipo: 'grid', cols: 'minmax(0,1fr) 320px', items: [{ tipo: 'tabla', filas: 16, cols: 12 }, { tipo: 'panel', lineas: 8, alto: 420 }] },
];
const AUTOSAVE_MS = 3000;
const N = (v) => Number(v) || 0;
const fileToDataUrl = (file) => new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(r.result); r.onerror = reject; r.readAsDataURL(file); });
const firma = (map, nom, vig) => JSON.stringify([nom, vig, map]);
/** Modelo persistible a partir del estado de edición (puro: también lo usa el guardado al desmontar). */
const construirModelo = ({ modelo, propuesta, nombre, vigencia, catalogoMap, cliente, perfil }) => {
  const lineas = lineasDesdeMapa(propuesta, catalogoMap);
  return { ...modelo, clienteLabel: cliente?.label || modelo.clienteKey, nombre: (nombre || '').trim(), vigencia: vigencia || null, lineas, resumen: resumenDe(lineas), tstamp: modelo.tstamp || Date.now(), creadoPor: modelo.creadoPor || perfil?.user_id || null };
};

export default function PropuestasTab() {
  const perfil = usePerfil();
  const { theme } = useTheme();
  const sensible = puedeVerSensible(perfil);
  const puedeVer = puedeVerPestanaGlobal(perfil, 'propuestas');

  const [vista, setVista] = useState('landing');          // landing | armar
  const [revisando, setRevisando] = useState(false);      // hoja lateral Revisar sobre Armar
  const [propuestas, setPropuestas] = useState([]);
  const [efectividades, setEfectividades] = useState(new Map());
  const [cargandoLista, setCargandoLista] = useState(true);
  const [ocupado, setOcupado] = useState(false);
  const [spiffPanelOpen, setSpiffPanelOpen] = useState(false);

  const [modelo, setModelo] = useState(null);             // propuesta en edición (modelo de recientes.js)
  const [propuesta, setPropuesta] = useState({});         // mapa sku → { piezas, precio, listaSel }
  const [nombre, setNombre] = useState('');
  const [vigencia, setVigencia] = useState(vigenciaPorDefecto());
  const [skus, setSkus] = useState([]);
  const [contexto, setContexto] = useState(null);
  const [cargandoCatalogo, setCargandoCatalogo] = useState(false);
  const [errorCatalogo, setErrorCatalogo] = useState(null);
  const [snapshot, setSnapshot] = useState('');           // último estado guardado
  const [guardando, setGuardando] = useState(false);
  const [guardadoAt, setGuardadoAt] = useState(null);
  const migracionHecha = useRef(false);
  const ultimo = useRef(null);                            // estado vivo para el guardado al desmontar

  // ── Landing: propuestas + efectividad + cierre automático ──
  const cargarLista = async () => {
    setCargandoLista(true);
    try {
      let lista = await listarPropuestas();
      if (!migracionHecha.current) {
        migracionHecha.current = true;
        const { migrados } = await migrarRecientesLocales(lista);
        if (migrados > 0) { toast.info(`${migrados} propuesta${migrados === 1 ? '' : 's'} guardada${migrados === 1 ? '' : 's'} en este navegador se subieron a la base`); lista = await listarPropuestas(); }
      }
      const fact = await cargarFacturacionVentanas(lista);
      lista = await aplicarCierreAutomatico(lista, fact);
      const ef = new Map();
      for (const p of lista) { const e = calcularEfectividad(p, fact); if (e) ef.set(p.id, e); }
      setPropuestas(lista);
      setEfectividades(ef);
    } catch (e) {
      console.warn('[Propuestas]', e);
      toast.error(`No se pudieron cargar las propuestas: ${e?.message || e}`);
    } finally { setCargandoLista(false); }
  };
  useEffect(() => { if (puedeVer && vista === 'landing') cargarLista(); }, [vista, puedeVer]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Catálogo del cliente (Armar) ──
  useEffect(() => {
    if (vista !== 'armar' || !modelo?.clienteKey || skus.length > 0) return;
    let vivo = true;
    setCargandoCatalogo(true); setErrorCatalogo(null);
    fetchCatalogo(modelo.clienteKey).then(({ skus: rows, contexto: ctx }) => { if (!vivo) return; setSkus(rows); setContexto(ctx); })
      .catch((e) => { if (!vivo) return; console.warn('[Propuestas]', e); setErrorCatalogo(e.message || 'Error al cargar'); })
      .finally(() => { if (vivo) setCargandoCatalogo(false); });
    return () => { vivo = false; };
  }, [vista, modelo?.clienteKey, skus.length]);

  const catalogoMap = useMemo(() => new Map(skus.map((r) => [r.sku, r])), [skus]);
  const cliente = CLIENTES.find((c) => c.key === modelo?.clienteKey);
  const memoria = useMemo(() => (modelo?.clienteKey ? memoriaPorSku(propuestas, modelo.clienteKey) : new Map()), [propuestas, modelo?.clienteKey]);
  const sucio = !!modelo && snapshot !== firma(propuesta, nombre, vigencia);
  const hayQueGuardar = sucio && (Object.keys(propuesta).length > 0 || !!(nombre || '').trim() || (modelo?.lineas?.length || 0) > 0);
  ultimo.current = { modelo, propuesta, nombre, vigencia, catalogoMap, cliente, perfil, hayQueGuardar };

  // ── Acciones sobre la propuesta en edición ──
  const reemplazarEnLista = (m) => setPropuestas((prev) => { const i = prev.findIndex((x) => x.id === m.id); if (i < 0) return [m, ...prev]; const n = [...prev]; n[i] = m; return n; });

  const guardarBorrador = async ({ silencioso = false } = {}) => {
    const u = ultimo.current;
    if (!u.modelo) return null;
    const f = firma(u.propuesta, u.nombre, u.vigencia);
    setGuardando(true);
    try {
      const m = await guardarPropuesta(construirModelo(u));
      setModelo((prev) => (prev && prev.id === m.id ? { ...prev, ...m } : prev));
      reemplazarEnLista(m); setSnapshot(f); setGuardadoAt(Date.now());
      if (!silencioso) toast.ok('Borrador guardado');
      return m;
    } catch (e) { toast.error(`No se pudo guardar: ${e?.message || e}`); return null; }
    finally { setGuardando(false); }
  };
  // Autoguardado: cada cambio reinicia el temporizador (debounce); guarda sólo si hay algo distinto de lo último guardado.
  useEffect(() => {
    if (vista !== 'armar' || !hayQueGuardar) return;
    const t = setTimeout(() => guardarBorrador({ silencioso: true }), AUTOSAVE_MS);
    return () => clearTimeout(t);
  }, [vista, hayQueGuardar, propuesta, nombre, vigencia]); // eslint-disable-line react-hooks/exhaustive-deps
  // Al desmontar la pestaña (cambio de página) con cambios pendientes: guardado silencioso de último momento.
  useEffect(() => () => {
    const u = ultimo.current;
    if (u?.modelo && u.hayQueGuardar) guardarPropuesta(construirModelo(u)).catch((e) => console.warn('[Propuestas] guardado al salir', e));
  }, []);

  const marcarEnviadaActual = async (extra = {}) => {
    const m = await guardarBorrador({ silencioso: true });
    if (!m) return;
    try { const e = await marcarEnviada(m, extra); setModelo((prev) => (prev && prev.id === e.id ? { ...prev, ...e } : prev)); reemplazarEnLista(e); }
    catch (err) { toast.error(`No se pudo marcar como enviada: ${err?.message || err}`); }
  };

  const reiniciar = () => { setVista('landing'); setRevisando(false); setModelo(null); setPropuesta({}); setNombre(''); setVigencia(vigenciaPorDefecto()); setSkus([]); setContexto(null); setErrorCatalogo(null); setSnapshot(''); setGuardadoAt(null); };
  const entrar = (m, map, nom, vig) => {
    setModelo(m); setPropuesta(map); setNombre(nom); setVigencia(vig); setSkus([]); setContexto(null); setErrorCatalogo(null);
    setSnapshot(firma(map, nom, vig)); setGuardadoAt(m.updatedAt ? Date.parse(m.updatedAt) || null : null); setRevisando(false);
    setVista('armar');
  };
  // Nueva propuesta directo desde la tarjeta del cliente: sin nombre, sin líneas pre-marcadas, vigencia = fin de mes.
  const iniciarCliente = (key) => {
    const cli = CLIENTES.find((c) => c.key === key);
    entrar({ id: nuevaPropuestaId(), clienteKey: key, clienteLabel: cli?.label, nombre: '', estado: 'borrador', anio: MES_ACTUAL.anio, mes: MES_ACTUAL.mes, vigencia: vigenciaPorDefecto(), tstamp: Date.now(), lineas: [] }, {}, '', vigenciaPorDefecto());
  };
  const abrir = (p) => entrar(p, mapaDesdeLineas(p.lineas), p.nombre || '', p.vigencia || vigenciaPorDefecto());
  const salirGuardando = async () => { if (ultimo.current?.hayQueGuardar) await guardarBorrador({ silencioso: true }); reiniciar(); };

  // ── Acciones desde la landing ──
  const eliminar = async (p) => {
    if (!window.confirm(`¿Eliminar el borrador "${p.clienteLabel || p.clienteKey} · ${p.nombre || 'Sin nombre'}"?\n\nEsta acción no se puede deshacer.`)) return;
    try { await eliminarPropuesta(p.id); setPropuestas((prev) => prev.filter((x) => x.id !== p.id)); toast.ok('Borrador eliminado'); }
    catch (e) { toast.error(`No se pudo eliminar: ${e?.message || e}`); }
  };
  const duplicar = async (p) => {
    setOcupado(true);
    try {
      const vigentes = await fetchPreciosVigentes((p.lineas || []).map((l) => l.sku));
      const cambiadas = [];
      const lineas = (p.lineas || []).map((l) => {
        if (l.custom || !l.lista) return { ...l };
        const nuevo = vigentes.get(l.sku)?.[l.lista];
        if (nuevo == null || Math.abs(nuevo - N(l.precio)) < 0.005) return { ...l };
        cambiadas.push({ sku: l.sku, de: N(l.precio), a: nuevo });
        return { ...l, precio: nuevo };
      });
      const nuevo = await guardarPropuesta({
        id: nuevaPropuestaId(), clienteKey: p.clienteKey, clienteLabel: p.clienteLabel, nombre: `${p.nombre || 'Propuesta'} (copia)`, estado: 'borrador',
        anio: MES_ACTUAL.anio, mes: MES_ACTUAL.mes, vigencia: vigenciaPorDefecto(), tstamp: Date.now(), lineas, origen: `duplicada de ${p.folio || p.nombre || p.id}`, creadoPor: perfil?.user_id || null,
      });
      setPropuestas((prev) => [nuevo, ...prev]);
      if (cambiadas.length) toast.info(`Borrador duplicado · ${cambiadas.length} precio${cambiadas.length === 1 ? '' : 's'} actualizado${cambiadas.length === 1 ? '' : 's'} a la lista vigente: ${cambiadas.slice(0, 4).map((c) => c.sku).join(', ')}${cambiadas.length > 4 ? '…' : ''}`, { ms: 6000 });
      else toast.ok('Borrador duplicado · precios sin cambios');
      abrir(nuevo);
    } catch (e) { toast.error(`No se pudo duplicar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };
  const compartirPropuesta = async (p) => {
    const cli = CLIENTES.find((c) => c.key === p.clienteKey);
    if (!(p.nombre || '').trim()) { toast.error('Esta propuesta no tiene nombre: ábrela y ponle uno antes de compartirla.'); return; }
    const texto = textoPropuesta({ clienteLabel: cli?.label || p.clienteLabel, nombre: p.nombre, anio: p.anio, mes: p.mes, lineas: p.lineas || [], vigencia: p.vigencia });
    const r = await compartir(texto, { titulo: `Propuesta ${cli?.label || ''}` });
    if (!r) return;
    if (p.estado === 'borrador') { try { reemplazarEnLista(await marcarEnviada(p)); } catch (e) { toast.error(`No se pudo marcar como enviada: ${e?.message || e}`); } }
    toast.ok(r === 'share' ? 'Propuesta compartida' : 'Se abrió WhatsApp con el resumen');
  };
  const excelFinal = async (p, file) => {
    try {
      const patch = file ? { excel_final: { name: file.name, size: file.size, dataUrl: await fileToDataUrl(file), tstamp: Date.now() }, ...(p.estado === 'borrador' ? { estado: 'enviada' } : {}) } : { excel_final: null };
      reemplazarEnLista(await actualizarPropuesta(p.id, patch));
      toast.ok(file ? 'Excel final adjuntado' : 'Excel final quitado');
    } catch (e) { toast.error(`No se pudo actualizar: ${e?.message || e}`); }
  };
  const subirSpiffs = async (file) => {
    setOcupado(true);
    try { const { n, inicio, fin } = await cargarExcelSpiffs(file); toast.ok(`${n} SPIFFs cargados · vigencia ${inicio} → ${fin}`); }
    catch (e) { toast.error(e.message || 'No se pudo cargar el Excel de SPIFFs'); }
    finally { setOcupado(false); }
  };

  // ── Importar Excel de propuesta (SKU, Descripción, Marca, Familia, Piezas, Precio unitario) como borrador ──
  const importarExcel = async (file) => {
    setOcupado(true);
    try {
      const mod = await import('xlsx-js-style');
      const XLSX = mod.default || mod;
      const fname = (file.name || '').toLowerCase();
      const cliDetected = fname.includes('pcel') ? 'pcel' : fname.includes('dicotech') ? 'dicotech' : 'digitalife';
      const wb = XLSX.read(await file.arrayBuffer(), { type: 'array' });
      const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
      if (!rows.length) throw new Error('El archivo está vacío');
      let headerIdx = rows.findIndex((r) => r.some((c) => String(c).trim().toUpperCase() === 'SKU'));
      if (headerIdx < 0) headerIdx = 0;
      const headers = rows[headerIdx].map((c) => String(c).trim().toLowerCase());
      const idx = (fn) => headers.findIndex(fn);
      const iSku = idx((h) => h === 'sku' || h === 'no. parte' || h === 'no parte'), iDesc = idx((h) => h.includes('descripc')), iMarca = idx((h) => h === 'marca');
      const iFam = idx((h) => h.includes('familia') || h.includes('categor')), iPz = idx((h) => h.includes('pieza') || h.includes('cantidad') || h === 'qty'), iPr = idx((h) => h.includes('precio') && !h.includes('total'));
      if (iSku < 0) throw new Error('No encontré la columna "SKU"');
      if (iPz < 0) throw new Error('No encontré la columna "Piezas" o "Cantidad"');
      const lineas = [];
      for (let i = headerIdx + 1; i < rows.length; i++) {
        const r = rows[i]; const sku = String(r[iSku] || '').trim(); const piezas = Number(r[iPz]) || 0;
        if (!sku || piezas <= 0) continue;
        lineas.push({ sku, piezas, precio: iPr >= 0 ? Number(r[iPr]) || 0 : 0, lista: null, custom: true, descripcion: iDesc >= 0 ? String(r[iDesc] || '') : '', marca: iMarca >= 0 ? String(r[iMarca] || '') : '', familia: iFam >= 0 ? String(r[iFam] || '') : '' });
      }
      if (!lineas.length) throw new Error('No encontré filas válidas con piezas > 0');
      const cli = CLIENTES.find((c) => c.key === cliDetected);
      const shortName = file.name.replace(/\.xlsx?$/i, '').replace(new RegExp(`^propuesta\\s+${cli?.label || ''}\\s*`, 'i'), '').replace(new RegExp(`\\s+(${MES_FULL.join('|')})\\s+\\d{4}$`, 'i'), '').trim() || 'Cierre';
      const existente = propuestas.find((p) => p.clienteKey === cliDetected && (p.nombre || '').trim().toLowerCase() === shortName.toLowerCase());
      const m = await guardarPropuesta({
        ...(existente || { id: nuevaPropuestaId(), estado: 'borrador', anio: MES_ACTUAL.anio, mes: MES_ACTUAL.mes, vigencia: vigenciaPorDefecto() }),
        clienteKey: cliDetected, clienteLabel: cli?.label || cliDetected, nombre: shortName, tstamp: Date.now(), lineas,
        origen: existente ? 'Excel re-importado' : 'Excel importado', ultimaImportacion: { filename: file.name, fecha: Date.now(), ...resumenDe(lineas) },
        creadoPor: existente?.creadoPor || perfil?.user_id || null,
      });
      reemplazarEnLista(m);
      toast.ok(`${existente ? 'Borrador actualizado' : 'Borrador creado'} desde ${file.name} · ${lineas.length} líneas`);
      abrir(m);
    } catch (e) { toast.error(`Error al importar: ${e?.message || e}`); }
    finally { setOcupado(false); }
  };

  const shell = (children) => (
    <div style={{ minHeight: '100vh', background: theme.bg, color: theme.text, fontFamily: TYPO.fontText, padding: '10px 6px' }}>{children}</div>
  );

  if (!puedeVer) return <SinAcceso motivo="No tienes acceso a Propuestas." />;

  if (vista === 'landing') {
    return shell(<>
      {cargandoLista && propuestas.length === 0 ? <Cargando pantalla="propuestas" minHeight={480} /> : (
        <Landing propuestas={propuestas} efectividades={efectividades} cargando={cargandoLista} ocupado={ocupado}
          onNueva={iniciarCliente} onAbrir={abrir} onImportar={importarExcel} onSubirSpiffs={subirSpiffs}
          onGestionarSpiffs={() => setSpiffPanelOpen(true)} onEliminar={eliminar} onDuplicar={duplicar} onCompartir={compartirPropuesta}
          onExcelFinal={excelFinal} onRefrescar={cargarLista} />
      )}
      {spiffPanelOpen && <SpiffPanel onClose={() => setSpiffPanelOpen(false)} onSaved={() => {}} />}
    </>);
  }

  if (cargandoCatalogo || (!skus.length && !errorCatalogo)) return shell(<Cargando silueta={SILUETA_ARMAR} label={`Cargando ${cliente?.label || 'cliente'}…`} sub="Trayendo inventario, sell-out, precios y roadmap" minHeight={480} />);
  if (errorCatalogo) {
    return shell(
      <Panel padding="14px 16px">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 12 }}>
          <Pill tone="red" dot>Error</Pill><span style={{ color: theme.textMuted }}>{errorCatalogo}</span>
          <Boton onClick={() => { setErrorCatalogo(null); setSkus([]); }} style={{ marginLeft: 'auto' }}>Reintentar</Boton>
          <Boton onClick={reiniciar}>Volver</Boton>
        </div>
      </Panel>,
    );
  }
  const autosave = { guardando, guardadoAt, sucio: hayQueGuardar };
  return shell(<>
    <Armar cliente={cliente} contexto={contexto} skus={skus} propuesta={propuesta} setPropuesta={setPropuesta} nombre={nombre} setNombre={setNombre} folio={modelo?.folio}
      memoria={memoria} sensible={sensible} autosave={autosave} onBack={salirGuardando} onGuardar={() => guardarBorrador()}
      onRevisar={() => { setRevisando(true); if (ultimo.current?.hayQueGuardar) guardarBorrador({ silencioso: true }); }} />
    <HojaLateral abierto={revisando} onClose={() => setRevisando(false)} ancho={820} theme={theme}
      titulo={`Revisar · ${cliente.label}`} sub="Edita piezas y precios en sitio; al exportar o compartir la propuesta queda enviada.">
      {revisando && (
        <Revisar cliente={cliente} contexto={contexto} skus={skus} propuesta={propuesta} setPropuesta={setPropuesta} nombre={nombre} setNombre={setNombre}
          vigencia={vigencia} setVigencia={setVigencia} modelo={modelo} sensible={sensible} autosave={autosave}
          onGuardar={() => guardarBorrador()} onEnviada={marcarEnviadaActual} />
      )}
    </HojaLateral>
  </>);
}
