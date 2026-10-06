// Pantalla Propuesta (celular · desde la calculadora de precios · 3.82.0 · 2026-10-05) · mockup pantalla 5.
// Hero: total · piezas · SKUs · margen total (sólo sensible, con el costo del director; nunca va en el jsonb).
// Líneas del borrador (propuestas_borradores.lineas) y los tres botones CONECTADOS:
//   WhatsApp → propuestas/textos.js#textoPropuesta (sin costo ni lista, mismo formato que el armador) + lib/whatsapp.js#compartir
//   Excel    → propuestas/excelPropuesta.js#propuestaExcelBlob (xlsx-js-style bajo demanda, el MISMO Excel que la web)
//              + lib/compartirArchivo.js; anota exported_filename sin cambiar el estado
//   Enviar   → recientes.js#marcarEnviada (estado enviada + enviada_at; el trigger asigna el folio) y olvida el «en curso»
// «Editar en Propuestas» abre PropuestaEditor (el editor móvil de siempre) con este id.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MessageCircle, FileSpreadsheet, Send, Pencil, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { puedeVerSensible } from '../../../lib/permisos';
import { compartir } from '../../../lib/whatsapp';
import { compartirArchivo, puedeCompartirArchivos } from '../../../lib/compartirArchivo';
import { useNav } from '../../nav';
import { TituloGrande, Cabecera, HeroM, ListaAgrupada, Fila, BotonGrande, Vacio, Skeleton, Pill, toast } from '../../piezas';
import { money, int, MONO, N } from '../../util';
import { obtenerPropuesta } from '../../../modules/comercial/propuestas/recientes';
import { CLIENTES, estadoInfo, MES_FULL } from '../../../modules/comercial/propuestas/constantes';
import { textoPropuesta, vigenciaTexto } from '../../../modules/comercial/propuestas/textos';
import { propuestaExcelBlob } from '../../../modules/comercial/propuestas/excelPropuesta';
import { useDatosPrecios } from '../../../modules/comercial/precios/datos';
import { listaLbl } from '../../../modules/comercial/precios/textos';
import { margenLineas } from '../../../modules/comercial/precios/calculadora';
import { descuentoLinea } from './calculo';
import { marcarEnviada, anotarExcel, filasExcel, QK_PROPUESTAS } from './propuesta';
import PropuestaEditor from '../PropuestaEditor';

const TONO = { borrador: 'orange', enviada: 'blue', cerrada: 'green' };
// Tres botones en una fila: caben a 375 px (fuente 14, sin desbordar; el texto se recorta antes que la fila).
const B3 = { fontSize: 14, gap: 6, padding: '0 6px', minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap' };
const fmt2 = (n) => `$${N(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtPct = (n, d = 1) => (n == null || !Number.isFinite(n) ? '—' : `${n.toFixed(d)} %`);

/** Vista pura (sin red) para SSR y para la pantalla. `m` = modelo de recientes.js#filaAModelo; `costoDe(sku)` sólo con sensible. */
export function PropuestaVista({ m, sensible = false, costoDe, ocupado = null, onWhatsApp, onExcel, onEnviar, onEditar, soporteShare = true }) {
  const { theme } = useTheme();
  const lineas = m?.lineas || [];
  const cli = CLIENTES.find((c) => c.key === m?.clienteKey);
  const mg = margenLineas(lineas.map((l) => ({ ...l, costo: sensible ? costoDe?.(l.sku) : 0 })));
  const pz = lineas.reduce((s, l) => s + N(l.piezas), 0);
  const est = estadoInfo(m?.estado);
  const listas = [...new Set(lineas.map((l) => l.listaBase || l.lista).filter(Boolean))];
  const texto = useMemo(() => textoPropuesta({ clienteLabel: m?.clienteLabel || cli?.label, nombre: m?.nombre, anio: m?.anio, mes: m?.mes, lineas, vigencia: m?.vigencia }), [m, lineas, cli]);
  const enviada = m?.estado !== 'borrador';
  return (
    <>
      <HeroM eyebrow={`${est.label} ${m?.folio || ''} · ${listas.length ? listas.map(listaLbl).join(' · ') : 'sin lista'} · vigencia ${vigenciaTexto(m?.vigencia)}`} frase={money(mg.monto)}
        sub={`${int(pz)} pz · ${int(lineas.length)} SKU${lineas.length === 1 ? '' : 's'}${sensible && mg.margenPct != null ? ` · margen ${fmtPct(mg.margenPct)} (${money(mg.utilidad)}) · sólo tú lo ves` : ''}`}
        stats={[{ k: 'Total', v: money(mg.monto), sub: '+ IVA' }, { k: 'Piezas', v: int(pz) }, sensible ? { k: 'Margen', v: fmtPct(mg.margenPct), sub: mg.sinCosto ? `${mg.sinCosto} sin costo` : money(mg.utilidad), color: mg.margenPct == null ? undefined : mg.margenPct < 0 ? theme.red : undefined } : { k: 'SKUs', v: int(lineas.length) }]} />

      <ListaAgrupada titulo="Líneas" meta={lineas.length} style={{ marginTop: 16 }}>
        {lineas.length === 0 && <Vacio icon={null} titulo="Sin líneas" style={{ padding: '22px 16px' }} />}
        {lineas.map((l) => {
          const d = descuentoLinea(l);
          return <Fila key={l.sku} chevron={false} titulo={<span><span style={{ fontFamily: TYPO.fontDisplay }}>{l.sku}</span>{l.descripcion ? <span style={{ color: theme.textMuted, fontWeight: 400 }}> · {String(l.descripcion).split(' / ')[0]}</span> : null}</span>}
            sub={`${int(l.piezas)} pz × ${fmt2(l.precio)}${d ? ` (−${d % 1 ? d.toFixed(1) : d} %)` : ''}`} valor={money(N(l.piezas) * N(l.precio))} />;
        })}
      </ListaAgrupada>

      <div style={{ margin: '14px 16px 0' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted, padding: '0 12px 6px' }}>Texto de WhatsApp</div>
        <pre style={{ margin: 0, padding: '12px 14px', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, fontFamily: MONO, fontSize: 11.5, lineHeight: 1.5, color: theme.textMuted, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{texto}</pre>
      </div>

      <div style={{ padding: '14px 16px 0', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <BotonGrande primario icon={MessageCircle} disabled={!lineas.length || !!ocupado} onClick={() => onWhatsApp?.(texto)} style={B3}>WhatsApp</BotonGrande>
        <BotonGrande icon={FileSpreadsheet} disabled={!lineas.length || !!ocupado} onClick={onExcel} style={B3}>{ocupado === 'excel' ? 'Generando…' : soporteShare ? 'Excel' : 'Descargar'}</BotonGrande>
        <BotonGrande icon={enviada ? CheckCircle2 : Send} disabled={!lineas.length || !!ocupado || enviada} onClick={onEnviar} style={{ ...B3, ...(enviada ? { color: theme.green } : {}) }}>{enviada ? est.label : ocupado === 'enviar' ? 'Enviando…' : 'Enviar'}</BotonGrande>
      </div>
      <div style={{ padding: '10px 16px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        <BotonGrande icon={Pencil} onClick={onEditar}>Editar en Propuestas</BotonGrande>
        <div style={{ fontSize: 11.5, color: theme.textSubtle || theme.textMuted, textAlign: 'center', lineHeight: 1.4 }}>WhatsApp manda el texto de arriba (sin costo ni lista). Excel genera el mismo archivo que la computadora. Enviar la marca como enviada{m?.folio ? '' : ' y le asigna folio'}; cuando el cliente facture se cierra sola.</div>
      </div>
    </>
  );
}

export default function PropuestaPrecios({ id, onCambio }) {
  const { theme } = useTheme();
  const nav = useNav();
  const qc = useQueryClient();
  const sensible = puedeVerSensible(nav.perfil);
  const { data: m, isLoading, error } = useQuery({ queryKey: ['movil', 'propuesta-precios', id], enabled: !!id, staleTime: 0, queryFn: () => obtenerPropuesta(id) });
  const { datos } = useDatosPrecios(sensible);   // misma consulta cacheada que la pantalla de precios: costo por SKU
  const costoPorSku = useMemo(() => new Map((datos?.costos || []).map((c) => [c.articulo ?? c.sku, N(c.costo_promedio)])), [datos]);
  const costoDe = (sku) => costoPorSku.get(sku) || 0;
  const [ocupado, setOcupado] = useState(null);
  const xlsxListo = useRef(false);
  useEffect(() => { if (!xlsxListo.current) import('xlsx-js-style').then(() => { xlsxListo.current = true; }).catch(() => {}); }, []);

  const refrescar = (nuevo) => { qc.setQueryData(['movil', 'propuesta-precios', id], nuevo); qc.invalidateQueries({ queryKey: QK_PROPUESTAS }); onCambio?.(nuevo); };
  const cli = CLIENTES.find((c) => c.key === m?.clienteKey) || CLIENTES[0];

  const onWhatsApp = async (texto) => {
    const r = await compartir(texto, { titulo: `Propuesta ${cli.label}` });
    if (r === 'share') toast.ok('Compartido');
  };
  const onExcel = async () => {
    if (!m?.lineas?.length) return;
    if (m.lineas.some((l) => !(N(l.precio) > 0))) { toast.error('Hay líneas sin precio'); return; }
    setOcupado('excel');
    try {
      const { blob, filename } = await propuestaExcelBlob({ cliente: cli, propuestaLista: filasExcel(m.lineas), nombre: m.nombre || 'Cierre', vigencia: m.vigencia });
      const r = await compartirArchivo(blob, filename, { titulo: filename, texto: `Propuesta ${cli.label} · ${m.lineas.length} SKUs · ${money(m.resumen?.total)}` });
      if (!r) { toast.info('Se canceló el envío'); return; }
      const nuevo = await anotarExcel(m.id, filename);
      refrescar(nuevo);
      toast.ok(r === 'share' ? 'Excel compartido' : 'Excel descargado');
    } catch (e) { toast.error(`No se pudo exportar: ${e?.message || e}`); }
    finally { setOcupado(null); }
  };
  const onEnviar = async () => {
    if (!m || m.estado !== 'borrador') return;
    setOcupado('enviar');
    try { const nuevo = await marcarEnviada(m); refrescar(nuevo); toast.ok(`Propuesta enviada · ${nuevo.folio || ''}`.trim()); }
    catch (e) { toast.error(`No se pudo marcar como enviada: ${e?.message || e}`); }
    finally { setOcupado(null); }
  };
  const onEditar = () => nav.push(<PropuestaEditor id={id} />, `propuesta-${id}`, 'propuestas');

  const sub = m ? <><span style={{ width: 8, height: 8, borderRadius: 999, background: theme.accent, display: 'inline-block' }} /> {m.clienteLabel || cli.label} · {m.mes ? `${MES_FULL[m.mes - 1]} ${m.anio}` : ''} · <Pill tone={TONO[m.estado] || 'gray'} size="xs">{estadoInfo(m.estado).label}</Pill></> : 'Cargando…';
  if (error) return (<><Cabecera onVolver={nav.pop} etiqueta="Precios" /><Vacio icon={AlertTriangle} color={theme.red} titulo="No se encontró la propuesta" sub={error.message} /></>);
  if (isLoading || !m) return (<><Cabecera onVolver={nav.pop} etiqueta="Precios" /><TituloGrande titulo="Propuesta" sub={sub} /><div style={{ padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 10 }}><Skeleton h={150} r={12} /><Skeleton h={200} r={12} /></div></>);

  return (
    <>
      <Cabecera onVolver={nav.pop} etiqueta="Precios" />
      <TituloGrande titulo={`Propuesta ${m.clienteLabel || cli.label}`} sub={sub} />
      <PropuestaVista m={m} sensible={sensible} costoDe={costoDe} ocupado={ocupado} onWhatsApp={onWhatsApp} onExcel={onExcel} onEnviar={onEnviar} onEditar={onEditar}
        soporteShare={puedeCompartirArchivos(new Blob([''], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'x.xlsx')} />
    </>
  );
}
