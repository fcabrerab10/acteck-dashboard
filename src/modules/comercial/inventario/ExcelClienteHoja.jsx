// "Excel para cliente" · disponibilidad para mandar a un cliente: SKU, EAN, descripción, marca,
// familia, disponible, próximo arribo y (opcional) precio de UNA lista sin IVA. Nunca costos ni
// valor a costo, aunque el usuario tenga permiso sensible. Fuente: la canasta si tiene SKUs;
// si no, la tabla tal como está filtrada.
import React, { useEffect, useMemo, useState } from 'react';
import { FileSpreadsheet, Tag } from 'lucide-react';
import { useTheme } from '../../../lib/themeContext';
import { TYPO } from '../../../lib/themeTokens';
import { Modal } from '../../../components/perfil/comun';
import { Pill, Boton, Skeleton, toast } from '../../../components/kit';
import { exportarExcel } from '../../../lib/exportar';
import { useEan } from '../../../lib/ean';
import { usePreciosLista, proximoArriboDe } from './compartir';
import { fmtInt } from './constantes';

const pad = (n) => String(n).padStart(2, '0');

export default function ExcelClienteHoja({ abierto, onClose, rows = [], origen = 'tabla' }) {
  const { theme } = useTheme();
  const [lista, setLista] = useState('');       // '' = sin precio
  const [conArribo, setConArribo] = useState(true);
  const [soloConStock, setSoloConStock] = useState(true);
  const [generando, setGenerando] = useState(false);
  useEffect(() => { if (abierto) { setLista(''); setGenerando(false); } }, [abierto]);

  const skus = useMemo(() => rows.map((r) => r.sku), [rows]);
  const { porSku, listas, cargando } = usePreciosLista(skus, abierto);
  const eanPorSku = useEan(abierto ? skus : []);   // Map sku → ean (vacío mientras carga)

  const filas = useMemo(() => rows.filter((r) => !soloConStock || Number(r.totalDisp) > 0), [rows, soloConStock]);
  const conPrecio = lista ? filas.filter((r) => porSku.get(r.sku)?.[lista]).length : 0;

  const generar = async () => {
    if (!filas.length) { toast.error('No hay SKUs que exportar.'); return; }
    setGenerando(true);
    try {
      const columnas = [
        { key: 'sku', label: 'SKU', tipo: 'texto', ancho: 14 },
        { key: 'ean', label: 'EAN', tipo: 'texto', ancho: 16 },
        { key: 'descripcion', label: 'Descripción', tipo: 'texto', ancho: 48 },
        { key: 'marca', label: 'Marca', tipo: 'texto', ancho: 14 },
        { key: 'familia', label: 'Familia', tipo: 'texto', ancho: 20 },
        { key: 'disponible', label: 'Disponible (pz)', tipo: 'numero', ancho: 14 },
        ...(conArribo ? [
          { key: 'arribo', label: 'Próximo arribo', tipo: 'texto', ancho: 14 },
          { key: 'enCamino', label: 'Pz en camino', tipo: 'numero', ancho: 12 },
        ] : []),
        ...(lista ? [{ key: 'precio', label: `Precio ${lista} (sin IVA)`, tipo: 'moneda', ancho: 18 }] : []),
      ];
      const datos = filas.map((r) => {
        const arr = proximoArriboDe(r);
        return {
          sku: r.sku, ean: eanPorSku?.get?.(r.sku) || eanPorSku?.[r.sku] || '',
          descripcion: r.descripcion || '', marca: r.marca || '', familia: r.familia || '',
          disponible: Number(r.totalDisp || 0),
          arribo: arr?.fecha || '', enCamino: arr ? arr.piezas : Number(r.transitoPz || 0),
          precio: lista ? (porSku.get(r.sku)?.[lista] ?? '') : '',
        };
      });
      const hoy = new Date();
      await exportarExcel({
        titulo: 'Disponibilidad Acteck · Balam Rush',
        archivo: `Disponibilidad ${pad(hoy.getDate())} ${pad(hoy.getMonth() + 1)} ${hoy.getFullYear()}`,
        hojas: [{ nombre: 'Disponibilidad', subtitulo: `${fmtInt(datos.length)} SKUs · ${pad(hoy.getDate())}/${pad(hoy.getMonth() + 1)}/${hoy.getFullYear()}${lista ? ` · precios ${lista} sin IVA` : ' · sin precios'}`, columnas, filas: datos }],
      });
      toast.ok(`Excel para cliente · ${fmtInt(datos.length)} SKUs`);
      onClose?.();
    } catch (e) {
      toast.error('No se pudo generar el Excel: ' + (e.message || e));
    } finally { setGenerando(false); }
  };

  const chip = (on, onClick, children) => (
    <Pill tone={on ? 'blue' : 'gray'} size="xs" dot={on} onClick={onClick} style={{ cursor: 'pointer', border: `1px solid ${on ? 'currentColor' : theme.border}`, padding: '3px 9px' }}>{children}</Pill>
  );

  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} ancho={520}
      titulo="Excel para cliente" sub="Sin costos ni valores internos · sólo disponibilidad y, si quieres, precio de una lista"
      pie={(
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 11, color: theme.textMuted }}>{fmtInt(filas.length)} SKUs{lista ? ` · ${fmtInt(conPrecio)} con precio` : ''}</span>
          <Boton icon={FileSpreadsheet} primario onClick={generar} disabled={generando || !filas.length}>{generando ? 'Generando…' : 'Generar Excel'}</Boton>
        </div>
      )}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: TYPO.fontText, fontSize: 12 }}>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>Qué va</div>
          <div style={{ color: theme.text }}>
            {origen === 'canasta' ? `Los ${fmtInt(rows.length)} SKUs de la canasta` : `Los ${fmtInt(rows.length)} SKUs de la tabla con los filtros de ahora`}
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            {chip(soloConStock, () => setSoloConStock((v) => !v), 'Sólo con disponible')}
            {chip(conArribo, () => setConArribo((v) => !v), 'Incluir próximo arribo')}
          </div>
        </div>
        <div>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: theme.textMuted, fontWeight: 600, marginBottom: 4 }}>Precio · opcional</div>
          {cargando ? <Skeleton h={28} /> : (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {chip(!lista, () => setLista(''), 'Sin precio')}
              {listas.map((l) => chip(lista === l, () => setLista(l), <><Tag size={10} />{l}</>))}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: theme.textMuted, marginTop: 4 }}>El precio va sin IVA y el archivo no dice de qué lista sale.</div>
        </div>
      </div>
    </Modal>
  );
}
