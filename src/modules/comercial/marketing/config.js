// Marketing · configuración compartida (tipos, marcas, redes, helpers).
// Los hex de TIPOS/MARCAS/REDES son la única excepción al "todo desde theme.*":
// se usan para puntos, tiles de icono (`${color}22`) y nada más. Los pills usan `tone`.
import { Mail, Video, Image as ImageIcon, Smartphone, Search, PartyPopper, Megaphone } from 'lucide-react';

export const TIPOS = {
  mailing:    { label: 'Mailing',    color: '#34C759', tone: 'green',  Icon: Mail,        metricas: [
    { key: 'envios', label: 'Envíos' },
    { key: 'aperturas', label: 'Aperturas' },
    { key: 'clics', label: 'Clics' },
  ]},
  reel:       { label: 'Reel',       color: '#AF52DE', tone: 'purple', Icon: Video, redSocial: true, metricas: [
    { key: 'visualizaciones', label: 'Visualizaciones' },
    { key: 'interaccion', label: 'Interacción' },
    { key: 'cuentas_alcanzadas', label: 'Cuentas alcanzadas' },
    { key: 'retencion', label: 'Retención (%)' },
    { key: 'me_gusta', label: 'Me gusta' },
  ]},
  banner:     { label: 'Banner',     color: '#007AFF', tone: 'blue',   Icon: ImageIcon,   metricas: [
    { key: 'usuarios_activos', label: 'Usuarios activos' },
    { key: 'sesiones', label: 'Sesiones' },
    { key: 'vistas', label: 'Vistas' },
  ]},
  meta_ads:   { label: 'Meta Ads',   color: '#CC9A06', tone: 'yellow', Icon: Smartphone,  metricas: [
    { key: 'importe_gastado', label: 'Importe gastado ($)', money: true },
    { key: 'alcance', label: 'Alcance' },
    { key: 'impresiones', label: 'Impresiones' },
    { key: 'clics_enlace', label: 'Clics en enlace' },
    { key: 'compras', label: 'Compras' },
    { key: 'valor_conversion', label: 'Valor conversión ($)', money: true },
  ]},
  google_ads: { label: 'Google Ads', color: '#FF9500', tone: 'orange', Icon: Search,      metricas: [
    { key: 'calidad', label: 'Calidad (1-10)' },
    { key: 'clics', label: 'Clics' },
    { key: 'impresiones', label: 'Impresiones' },
    { key: 'conversiones', label: 'Conversiones' },
    { key: 'valor_conversion', label: 'Valor conversión ($)', money: true },
    { key: 'costo', label: 'Costo ($)', money: true },
    { key: 'nivel_optimizacion', label: 'Nivel optimización (%)' },
  ]},
  evento:     { label: 'Evento',     color: '#FF3B30', tone: 'red',    Icon: PartyPopper, evento: true, metricas: [
    { key: 'asistentes', label: 'Asistentes' },
    { key: 'contactos', label: 'Contactos capturados' },
    { key: 'ventas', label: 'Ventas ($)', money: true },
  ]},
};

export const MARCAS = {
  acteck:     { label: 'Acteck',     color: '#007AFF', tone: 'blue' },
  balam_rush: { label: 'Balam Rush', color: '#AF52DE', tone: 'purple' },
};

export const REDES_SOCIALES = {
  tiktok:    { label: 'TikTok',    color: '#000000' },
  facebook:  { label: 'Facebook',  color: '#1877F2' },
  instagram: { label: 'Instagram', color: '#E4405F' },
  youtube:   { label: 'YouTube',   color: '#FF0000' },
};

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
export const MESES_CORTOS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
export const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

const TIPO_DESCONOCIDO = { label: '?', color: '#8E8E93', tone: 'gray', Icon: Megaphone, metricas: [] };
export const tipoMeta = (tipo) => TIPOS[tipo] || { ...TIPO_DESCONOCIDO, label: tipo || '?' };

// Parse YYYY-MM-DD sin timezone shift
export const parseFecha = (f) => {
  if (!f) return null;
  const p = String(f).slice(0, 10).split('-').map((n) => parseInt(n, 10));
  if (p.length !== 3 || !p[0]) return null;
  return { y: p[0], m: p[1], d: p[2] };
};
// Mes/año efectivos de una actividad (fecha manda; si no hay, columnas mes/anio).
export const mesAnioDe = (a) => {
  const pf = parseFecha(a.fecha);
  return { m: pf ? pf.m : Number(a.mes) || 0, y: pf ? pf.y : Number(a.anio) || 0, d: pf ? pf.d : 0 };
};
export const fechaCorta = (f) => { const p = parseFecha(f); return p ? `${p.d} ${MESES_CORTOS[p.m - 1]}` : ''; };
export const isoHoy = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
export const diasEntre = (isoA, isoB) => { const a = parseFecha(isoA), b = parseFecha(isoB); if (!a || !b) return null; return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000); };

export const fmtMXN = (v) => '$' + Number(v || 0).toLocaleString('es-MX', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
export const fmtNum = (v) => Number(v || 0).toLocaleString('es-MX');
export const money = (n) => {
  if (n == null || !isFinite(n)) return '—';
  const a = Math.abs(Number(n)), s = n < 0 ? '−' : '';
  if (a >= 1e6) return `${s}$${(a / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${s}$${(a / 1e3).toFixed(0)}K`;
  return `${s}$${Math.round(a).toLocaleString('es-MX')}`;
};

export const esCerrada = (a) => a.estatus === 'completado' || a.estatus === 'archivado';

// Estatus visual: { label, tone, dot, lock }
export const estatusDe = (a, hoy) => {
  if (a.estatus === 'archivado') return { label: 'Archivada', tone: 'gray' };
  if (a.estatus === 'completado') return { label: 'Completada', tone: 'gray' };
  if (a.pago_id) return { label: 'En pago', tone: 'orange', lock: true };
  if (a.fecha && String(a.fecha).slice(0, 10) > hoy) return { label: 'Programada', tone: 'gray' };
  return { label: 'Activa', tone: 'green', dot: true };
};

// Métricas capturadas en una línea: "Envíos 1,200 · Aperturas 300"
export const metricasLinea = (a) => {
  const tm = tipoMeta(a.tipo); const m = a.metricas || {};
  return tm.metricas.filter((x) => m[x.key] != null && m[x.key] !== '').map((x) => `${x.label.replace(/ \(.*\)$/, '')} ${x.money ? fmtMXN(m[x.key]) : fmtNum(m[x.key])}`);
};

export const emptyForm = () => ({
  tipo: 'mailing',
  marca: 'acteck',
  fecha: isoHoy(),
  nombre: '',
  mensaje: '',
  red_social: '',
  inversion: 0,
  metricas: {},
  evento_sucursal: '',
  evento_pop: '',
  notas: '',
  responsable: '',
});
