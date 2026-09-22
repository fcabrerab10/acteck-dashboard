// Hoja lateral del SKU: qué proyectos lo consumen, qué arribos vienen (con fecha) y el
// sugerido de compra con su fecha límite = mes objetivo − lead time real del proveedor.
import React from 'react';
import { ShoppingCart } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Boton, Pill } from '../../../components/kit';
import { HojaLateral } from '../../../components/perfil/comun';
import { int } from '../../../lib/format';
import { PROB_LABEL, CLIENTE_LABEL, etiquetaMesLarga } from './calculo';
import { fechaCortaISO, fechaLargaISO, TONOS } from './textos';

const Seccion = ({ theme, titulo, meta, children }) => (
  <section style={{ marginTop: 14 }}>
    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', padding: '0 4px 6px' }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.textMuted }}>{titulo}</span>
      {meta && <span style={{ fontSize: 10.5, color: theme.textMuted }}>{meta}</span>}
    </div>
    <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, overflow: 'hidden' }}>{children}</div>
  </section>
);

const Fila = ({ theme, izq, sub, der, derSub, tone, primera }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderTop: primera ? 0 : `1px solid ${theme.border}` }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: theme.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{izq}</div>
      {sub && <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 1 }}>{sub}</div>}
    </div>
    {tone && <Pill tone={tone} size="xs">{TONOS[tone === 'green' ? 'verde' : tone === 'orange' ? 'naranja' : 'rojo']?.label}</Pill>}
    {der != null && (
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12.5, fontWeight: 600, color: theme.text, fontVariantNumeric: 'tabular-nums' }}>{der}</div>
        {derSub && <div style={{ fontSize: 10, color: theme.textMuted }}>{derSub}</div>}
      </div>
    )}
  </div>
);

export default function HojaSku({ abierto, detalle, stock, arribos, descripcion, onCerrar, onAbrirProyecto, onPedirCompra, puedeEditar }) {
  const { theme } = useTheme();
  if (!detalle) return <HojaLateral abierto={abierto} onClose={onCerrar} theme={theme} titulo="SKU" ancho={520} />;
  const { sku, celdas, proyectos, compra } = detalle;
  const disp = Math.round(Number(stock?.get(sku) || 0));
  const arr = arribos?.get(sku) || [];
  const enCamino = arr.reduce((s, a) => s + Number(a.cantidad || 0), 0);

  return (
    <HojaLateral abierto={abierto} onClose={onCerrar} theme={theme} ancho={520}
      titulo={sku} sub={descripcion || `${int(disp)} pz disponibles · ${int(enCamino)} en camino`}>

      <Seccion theme={theme} titulo="Cobertura por mes" meta={`${celdas.length} mes${celdas.length === 1 ? '' : 'es'} con demanda`}>
        {celdas.length ? celdas.map((c, i) => (
          <Fila key={c.clave} theme={theme} primera={i === 0}
            izq={etiquetaMesLarga(c.anio, c.mes)}
            sub={`disponible ${int(c.disponible)} · tránsito a tiempo ${int(c.transitoAntes)}${c.transitoDespues ? ` · ${int(c.transitoDespues)} llega después` : ''}`}
            der={`${int(c.necesidad)} pz`}
            derSub={c.faltante > 0 ? `faltan ${int(c.faltante)}` : 'cubierto'}
            tone={c.tono === 'verde' ? 'green' : c.tono === 'naranja' ? 'orange' : 'red'} />
        )) : <Fila theme={theme} primera izq="Sin demanda de proyectos" />}
      </Seccion>

      <Seccion theme={theme} titulo="Proyectos que lo consumen" meta={`${proyectos.length}`}>
        {proyectos.length ? proyectos.map((p, i) => (
          <div key={p.id} onClick={() => onAbrirProyecto?.(p)} style={{ cursor: 'pointer' }}>
            <Fila theme={theme} primera={i === 0}
              izq={p.nombre}
              sub={`${CLIENTE_LABEL[p.cliente] || p.cliente} · ${p.anio && p.mes ? etiquetaMesLarga(p.anio, p.mes) : 'sin mes'} · ${PROB_LABEL[p.probabilidad]}`}
              der={`${int(p.linea?.piezas || 0)} pz`}
              derSub={p.linea?.reservado ? `${int(p.linea.reservado)} reservadas` : null} />
          </div>
        )) : <Fila theme={theme} primera izq="Ningún proyecto lo pide" />}
      </Seccion>

      <Seccion theme={theme} titulo="Arribos en camino" meta={enCamino ? `${int(enCamino)} pz` : 'ninguno'}>
        {arr.length ? arr.map((a, i) => (
          <Fila key={i} theme={theme} primera={i === 0}
            izq={a.po ? `PO ${a.po}` : 'Embarque'}
            sub={a.supplier || 'proveedor sin identificar'}
            der={`${int(a.cantidad)} pz`}
            derSub={a.eta ? `llega ${fechaCortaISO(a.eta)}` : 'sin fecha'} />
        )) : <Fila theme={theme} primera izq="Nada en tránsito" />}
      </Seccion>

      <Seccion theme={theme} titulo="Sugerido de compra">
        {compra ? (
          <>
            <Fila theme={theme} primera izq={`Comprar ${int(compra.falta)} pz`}
              sub={`${compra.proveedor || 'proveedor por definir'} · lead time ${compra.leadTime} d${compra.leadTimeFuente === 'default' ? ' (estimado)' : ''}`}
              der={fechaCortaISO(compra.limite)}
              derSub={compra.llegaTarde ? 'la fecha ya pasó' : `en ${compra.diasAlLimite} d`} />
            <div style={{ padding: '10px 12px', borderTop: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ flex: 1, fontSize: 10.5, color: theme.textMuted, fontFamily: TYPO.fontText }}>
                Para llegar en {compra.mesLabel} hay que colocar la PO antes del {fechaLargaISO(compra.limite)}.
              </span>
              {puedeEditar && <Boton icon={ShoppingCart} onClick={() => onPedirCompra?.([compra])}>Mandar al S&OP</Boton>}
            </div>
          </>
        ) : <Fila theme={theme} primera izq="No falta comprar nada" sub="El inventario y el tránsito alcanzan para lo comprometido." />}
      </Seccion>
    </HojaLateral>
  );
}
