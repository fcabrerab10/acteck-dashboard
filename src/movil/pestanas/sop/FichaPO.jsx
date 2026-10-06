// S&OP del celular · ficha de una PO (push desde «Lo que viene», la tarjeta «Siguiente arribo» o un SKU). 2026-10-05.
// Contenedor, naviera, estatus, ETA a puerto y a CEDIS, y los SKUs que trae con piezas y qué tanto urgen (cobertura
// del motor del S&OP). Tocar un SKU abre Producto 360 en la cara Abasto. «Compartir arribo» manda el texto por WhatsApp.
import React from 'react';
import { Share2, Boxes } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { useNav } from '../../nav';
import { Cabecera, TituloGrande, HeroM, ListaAgrupada, Fila, BotonGrande, Pill, toast } from '../../piezas';
import { compartir } from '../../../lib/whatsapp';
import { int } from '../../util';
import { fechaLarga, fechaCorta, cedisCorto, estatusCorto, usdCompact } from './calculo';
import Producto360 from '../producto/Producto360';

const TONO_LABEL = { red: 'urge', orange: 'justo', green: 'holgado', gray: '—' };

export function textoArribo(po) {
  const l = [`PO ${po.po}${po.supplier ? ` · ${po.supplier}` : ''}`, po.eta ? `Llega el ${fechaLarga(po.eta)}${po.cedis ? ` a ${cedisCorto(po.cedis)}` : ''}` : 'Sin ETA', `${po.nSkus} SKU${po.nSkus === 1 ? '' : 's'} · ${int(po.piezas)} pz${po.estatus ? ` · ${estatusCorto(po.estatus)}` : ''}`, ''];
  for (const s of po.skus.slice(0, 12)) l.push(`• ${s.sku}${s.descripcion ? ` ${s.descripcion.slice(0, 40)}` : ''} · ${int(s.piezas)} pz`);
  if (po.skus.length > 12) l.push(`… y ${po.skus.length - 12} más`);
  return l.join('\n');
}

export function FichaPOVista({ po, sensible = false, onSku, onCompartir, onInventario }) {
  const { theme } = useTheme();
  const frase = po.eta
    ? `${po.vencida ? 'Debió llegar' : 'Llega'} el ${fechaLarga(po.eta)}${po.cedis ? ` a ${cedisCorto(po.cedis)}` : ''} con ${po.nSkus} SKU${po.nSkus === 1 ? '' : 's'} y ${int(po.piezas)} pz${po.urgen ? `; ${po.urgen === 1 ? 'resuelve 1 SKU que urge' : `resuelve ${po.urgen} SKUs que urgen`}` : ''}.`
    : `${po.nSkus} SKU${po.nSkus === 1 ? '' : 's'} y ${int(po.piezas)} pz sin fecha de arribo todavía.`;
  const sub = [po.etd ? `ETD ${fechaCorta(po.etd)}` : null, po.estatus ? estatusCorto(po.estatus) : null, sensible && po.usd > 0 ? `${usdCompact(po.usd)} USD${po.sinCosto ? ' (parcial)' : ''}` : null, po.vencida ? `ETA vencida ${Math.abs(po.dias)} d` : po.dias != null ? `en ${po.dias} d` : null].filter(Boolean).join(' · ');
  return (
    <div style={{ paddingBottom: 24 }}>
      <TituloGrande titulo={`PO ${po.po}`} sub={[po.supplier, po.contenedor, po.naviera].filter(Boolean).join(' · ') || 'Orden de compra'} />
      <HeroM eyebrow={po.vencida ? 'Arribo vencido' : 'Arribo'} frase={frase} sub={sub} />
      <ListaAgrupada titulo="SKUs en la PO" meta={`${po.nSkus} · ${int(po.piezas)} pz`} style={{ marginTop: 18 }} pie="Urge = agotado o con menos de 30 días de cobertura hoy. Toca un SKU para ver su abasto completo.">
        {po.skus.map((s) => (
          <Fila key={s.sku} titulo={s.sku} sub={[s.descripcion || 'Sin descripción', s.dias != null ? `${int(s.dias)} d de cobertura` : s.inv > 0 ? `${int(s.inv)} pz en stock` : null].filter(Boolean).join(' · ')}
            valor={`${int(s.piezas)} pz`} valorSub={s.tono !== 'gray' ? <Pill tone={s.tono} size="xs">{TONO_LABEL[s.tono]}</Pill> : null}
            onClick={onSku ? () => onSku(s.sku) : undefined} chevron={!!onSku} />
        ))}
      </ListaAgrupada>
      <div style={{ display: 'flex', gap: 8, margin: '18px 16px 0' }}>
        <BotonGrande icon={Share2} onClick={onCompartir} style={{ flex: 1 }}>Compartir arribo</BotonGrande>
        <BotonGrande icon={Boxes} onClick={onInventario} style={{ flex: 1 }}>Ver en Inventario</BotonGrande>
      </div>
    </div>
  );
}

export default function FichaPO({ po, sensible = false }) {
  const nav = useNav();
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <FichaPOVista po={po} sensible={sensible}
        onSku={(sku) => nav.push(<Producto360 sku={sku} cara="abasto" />, `producto-${sku}`)}
        onCompartir={async () => { const r = await compartir(textoArribo(po), { titulo: `PO ${po.po}` }); if (r === 'share') toast.ok('Compartido'); else if (r) toast.ok('Texto copiado'); }}
        onInventario={() => nav.navegar({ pagina: 'inventarioGlobal' })} />
    </>
  );
}
