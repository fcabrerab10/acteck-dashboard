// S&OP web · arribos por PO y ficha de PO (2026-11-18, congruencia web ↔ celular: «Lo que viene» y FichaPO del celular).
//   ArribosVista  → tabla de POs en camino (v_transito_sku.embarques_detalle agrupado con sopCalculo.js#arribosPorPo),
//                   vencidas arriba; clic en una fila abre la ficha.
//   FichaPOHoja   → HojaLateral con contenedor, naviera, estatus, ETD/ETA y los SKUs de la PO con piezas y qué tanto
//                   urgen (urge · justo · holgado = cobertura del motor del S&OP). «Compartir arribo» usa el MISMO texto
//                   que el celular (textoArribo): navigator.share si existe; si no, lo copia al portapapeles.
// USD sólo con `sensible`.
import React, { useMemo } from 'react';
import { Share2 } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { TablaCompacta, Pill, Boton, toast } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { compartir, copiar } from '../../../lib/whatsapp';
import { textoArribo, frasePo, TONO_LABEL, fechaCorta, cedisCorto, estatusCorto, usdCompact } from './sopCalculo';

const N = (v) => Number(v) || 0;
const int = (n) => Math.round(N(n)).toLocaleString('es-MX');
const MONO = '"SF Mono", ui-monospace, Menlo, monospace';

/** Comparte el texto del arribo: hoja nativa si el navegador la tiene; si no, portapapeles. */
export async function compartirArribo(po) {
  const texto = textoArribo(po);
  if (typeof navigator !== 'undefined' && navigator.share) {
    const r = await compartir(texto, { titulo: `PO ${po.po}` });
    if (r === 'share') toast.ok('Arribo compartido');
    return r;
  }
  const ok = await copiar(texto);
  if (ok) toast.ok('Texto del arribo copiado'); else toast.error('No se pudo copiar el texto');
  return ok ? 'copiado' : false;
}

export function ArribosVista({ arribos = [], sensible = false, onPo, maxHeight = 'min(420px, calc(100dvh - 220px))' }) {
  const { theme } = useTheme();
  // Vencidas arriba; después por ETA (arribosPorPo ya viene por fecha).
  const filas = useMemo(() => [...arribos.filter((p) => p.vencida), ...arribos.filter((p) => !p.vencida)], [arribos]);
  const columnas = [
    { key: 'po', label: 'PO', align: 'left', width: 96, render: (p) => <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: theme.accent }}>{p.po}</span> },
    { key: 'supplier', label: 'Proveedor · contenedor', align: 'left', maxWidth: 260, render: (p) => <span title={[p.supplier, p.contenedor, p.naviera].filter(Boolean).join(' · ')} style={{ color: theme.textMuted }}>{[p.supplier, p.contenedor, p.naviera].filter(Boolean).join(' · ') || '—'}</span> },
    { key: 'estatus', label: 'Estatus', align: 'left', width: 112, render: (p) => (p.vencida ? <Pill tone="red" size="xs">ETA vencida {Math.abs(p.dias)} d</Pill> : <span style={{ color: theme.textMuted }}>{estatusCorto(p.estatus) || '—'}</span>) },
    { key: 'eta', label: 'ETA', width: 70, render: (p) => (p.eta ? fechaCorta(p.eta) : 'sin ETA') },
    { key: 'nSkus', label: 'SKUs', width: 54, render: (p) => int(p.nSkus) },
    { key: 'piezas', label: 'Piezas', width: 78, bold: true, sum: true, render: (p) => int(p.piezas) },
    ...(sensible ? [{ key: 'usd', label: 'USD', width: 70, render: (p) => (p.usd > 0 ? usdCompact(p.usd) : '—') }] : []),
    { key: 'urgen', label: 'Resuelve', align: 'center', width: 84, render: (p) => (p.urgen ? <Pill tone="red" size="xs" title="SKUs agotados o con menos de 30 días de cobertura que vienen en esta PO">{p.urgen} que urge{p.urgen === 1 ? '' : 'n'}</Pill> : <span style={{ color: theme.textSubtle || theme.textMuted }}>—</span>) },
  ];
  return <TablaCompacta dense dividir={false} maxHeight={maxHeight} rowKey={(p) => p.po} filas={filas} columnas={columnas} onRowClick={onPo} vacio="No hay embarques pendientes en el master." />;
}

function Dato({ k, v, theme }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: theme.textSubtle || theme.textMuted }}>{k}</div>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={typeof v === 'string' ? v : undefined}>{v || '—'}</div>
    </div>
  );
}

/** Contenido de la ficha (puro: SSR en pruebas). */
export function FichaPOVistaWeb({ po, sensible = false, onSku, onCompartir }) {
  const { theme } = useTheme();
  if (!po) return null;
  const { frase, sub } = frasePo(po, { sensible });
  const columnas = [
    { key: 'sku', label: 'SKU', align: 'left', width: 100, render: (s) => <span style={{ fontFamily: MONO, fontSize: 11.5, fontWeight: 600, color: onSku ? theme.accent : theme.text }}>{s.sku}</span> },
    { key: 'descripcion', label: 'Producto', align: 'left', maxWidth: 190, render: (s) => <span title={s.descripcion} style={{ color: theme.textMuted }}>{s.descripcion || '—'}</span> },
    { key: 'piezas', label: 'Piezas', width: 70, bold: true, sum: true, render: (s) => int(s.piezas) },
    { key: 'dias', label: 'Cobertura', width: 78, render: (s) => (s.dias != null ? `${int(s.dias)} d` : s.inv > 0 ? `${int(s.inv)} pz` : '—') },
    { key: 'tono', label: '', width: 66, align: 'center', render: (s) => (s.tono !== 'gray' ? <Pill tone={s.tono} size="xs">{TONO_LABEL[s.tono]}</Pill> : null) },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText, color: theme.text }}>
      <div style={{ background: theme.surfaceInverse, color: theme.textOnInverse, borderRadius: 14, padding: '14px 16px' }}>
        <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', opacity: 0.7 }}>{po.vencida ? 'Arribo vencido' : 'Arribo'}</div>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1.35, marginTop: 4 }}>{frase}</div>
        {sub && <div style={{ fontSize: 11.5, opacity: 0.75, marginTop: 6 }}>{sub}</div>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '10px 14px' }}>
        <Dato theme={theme} k="Contenedor" v={po.contenedor} />
        <Dato theme={theme} k="Naviera" v={po.naviera} />
        <Dato theme={theme} k="Estatus" v={estatusCorto(po.estatus)} />
        <Dato theme={theme} k="ETD" v={po.etd ? fechaCorta(po.etd) : null} />
        <Dato theme={theme} k="ETA CEDIS" v={po.eta ? `${fechaCorta(po.eta)}${po.cedis ? ` · ${cedisCorto(po.cedis)}` : ''}` : null} />
        <Dato theme={theme} k="Proveedor" v={po.supplier} />
      </div>
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', padding: '0 2px 6px' }}>
          <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600 }}>SKUs en la PO <span style={{ color: theme.textMuted, fontWeight: 500 }}>· {po.nSkus} · {int(po.piezas)} pz</span></span>
          <span style={{ fontSize: 10.5, color: theme.textMuted }}>urge = agotado o &lt; 30 d de cobertura</span>
        </div>
        <TablaCompacta dense dividir={false} maxHeight="min(380px, calc(100dvh - 420px))" rowKey={(s) => s.sku} filas={po.skus} columnas={columnas} onRowClick={onSku ? (s) => onSku(s.sku) : undefined} vacio="Sin SKUs." />
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Boton primario icon={Share2} size="md" onClick={onCompartir}>Compartir arribo</Boton>
      </div>
    </div>
  );
}

export default function FichaPOHoja({ po, onClose, sensible = false, onSku, zIndex }) {
  const { theme } = useTheme();
  return (
    <HojaLateral abierto={!!po} onClose={onClose} theme={theme} ancho={520} titulo={po ? `PO ${po.po}` : 'PO'} zIndex={zIndex}
      sub={po ? ([po.supplier, po.contenedor, po.naviera].filter(Boolean).join(' · ') || 'Orden de compra') : ''}>
      {po && <FichaPOVistaWeb po={po} sensible={sensible} onSku={onSku} onCompartir={() => compartirArribo(po)} />}
    </HojaLateral>
  );
}
