// Configuración → Actualización de datos · importador central (kit V3).
//   Hero (estado global) · Cargas automáticas (puente Mac mini) · Cargas manuales por grupo.
// Datos: /api/status?type=sync|upload (useImportadorData). Parsers: src/lib/parsers/.
// Solicitudes al puente: tabla sync_solicitudes (la atiende bridge/sync.mjs solicitudes).
// Se monta lazy desde App.jsx (paginaActiva === 'actualizacion', sólo super admin).
import React, { useMemo } from 'react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { puedeActualizarDatos } from '../../lib/permisos';
import SinAcceso from '../../components/SinAcceso';
import { Hero, Panel, SkeletonPantalla } from '../../components/kit';
import { useImportadorData } from './importador/useImportadorData';
import { PUENTE } from './importador/config';
import { useFuentesConfig } from './importador/fuentesConfig';
import { frescuraManual, latidoPuente, estadoAutomatica, relTiempo, fmtHora, fmtFechaHora } from './importador/frescura';
import CargasAutomaticas from './importador/CargasAutomaticas';
import CargasManuales from './importador/CargasManuales';

const fmtDia = new Intl.DateTimeFormat('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });

export default function ActualizacionDatos({ perfil }) {
  const { theme } = useTheme();
  const { status, upload, error, loading, refetch } = useImportadorData();
  const { fuentes } = useFuentesConfig();

  const r = useMemo(() => {
    if (!status) return null;
    const ahora = new Date();
    const manuales = fuentes.map((f) => ({ f, fr: frescuraManual(f, status, ahora, upload?.[f.statusKey]) }));
    // Sólo `atrasada` cuenta como atrasada (por_vencer sigue al día para el hero).
    const atrasadas = manuales.filter((m) => m.fr.estado === 'atrasada');
    const porVencer = manuales.filter((m) => m.fr.estado === 'por_vencer').length;
    const alDia = manuales.length - atrasadas.length;
    const autos = PUENTE.map((row) => { const item = (status.items || []).find((x) => x.fuente === row.key); return { row, item, st: estadoAutomatica(row, item, status.eventos?.[row.key], ahora) }; });
    const autosOk = autos.filter((a) => a.st.texto === 'OK').length;
    const autosMal = autos.filter((a) => a.st.texto !== 'OK');
    const hoy0 = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()).getTime();
    const corridasHoy = (status.puente || []).filter((e) => e.status === 'success' && Date.parse(e.created_at) >= hoy0).length;
    const latido = latidoPuente(status, ahora.getTime());
    const cargas = [...manuales.map((m) => ({ t: m.fr.ultima, quien: m.fr.ev?.user_nombre, que: m.f.titulo })), ...autos.map((a) => ({ t: a.item?.ultima_actualizacion ? Date.parse(a.item.ultima_actualizacion) : null, quien: a.item?.meta?.origen, que: a.row.titulo }))].filter((c) => c.t).sort((a, b) => b.t - a.t);
    const ultima = cargas[0] || null;

    let titulo, sub, dot = false;
    if (!latido.enLinea) {
      titulo = latido.t ? `Puente sin señal desde ${fmtFechaHora(latido.t)}.` : 'Puente sin latido todavía.';
      sub = latido.t ? 'La Mac mini no reporta corridas: revisa que esté encendida y con sesión iniciada (launchctl list | grep acteck).' : 'Los agentes nuevos escriben un latido cada 5 minutos; hay que hacer git pull y reinstalar agentes en la Mac mini.';
      dot = true;
    } else if (atrasadas.length || autosMal.length) {
      const nombres = [...atrasadas.map((m) => m.f.titulo), ...autosMal.map((a) => a.row.titulo)];
      titulo = `${nombres.length} fuente${nombres.length > 1 ? 's' : ''} atrasada${nombres.length > 1 ? 's' : ''}: ${nombres.slice(0, 3).join(', ')}${nombres.length > 3 ? ` y ${nombres.length - 3} más` : ''}.`;
      sub = `Automáticas ${autosOk}/${autos.length} al día · manuales ${alDia}/${manuales.length} al día · arrastra el archivo a su fila para ponerla al día.`;
      dot = atrasadas.some((m) => m.fr.diasAtraso >= 7) || autosMal.some((a) => a.st.texto === 'Error');
    } else {
      titulo = `Todo al día. Próxima corrida a las ${fmtHora(latido.proxima)}.`;
      sub = `Automáticas ${autosOk}/${autos.length} · manuales ${alDia}/${manuales.length}${porVencer ? ` (${porVencer} por vencer)` : ''} · ${corridasHoy} corrida${corridasHoy === 1 ? '' : 's'} del puente hoy.`;
    }
    return { manuales, atrasadas, porVencer, alDia, autos, autosOk, corridasHoy, latido, ultima, titulo, sub, dot };
  }, [status, upload, fuentes]);

  if (!puedeActualizarDatos(perfil)) return <SinAcceso motivo="Solo el Super Admin puede actualizar datos." />;
  if (loading) return <SkeletonPantalla pantalla="actualizacion" />;
  if (error && !status) return <Panel titulo="No se pudo cargar el importador"><div style={{ fontSize: 12, color: theme.red }}>{error}</div></Panel>;

  const total = r.manuales.length + r.autos.length;
  const stats = [
    { k: 'Al día', v: `${r.alDia + r.autosOk}/${total}`, sub: `${r.autosOk}/${r.autos.length} automáticas · ${r.alDia}/${r.manuales.length} manuales`, color: r.alDia + r.autosOk === total ? theme.green : undefined },
    { k: 'Corridas hoy', v: String(r.corridasHoy), sub: 'automáticas del puente' },
    { k: 'Pendientes', v: String(r.atrasadas.length), sub: r.porVencer ? `manuales atrasadas · ${r.porVencer} por vencer` : 'manuales atrasadas', color: r.atrasadas.length ? theme.red : r.porVencer ? theme.orange : undefined },
    { k: 'Última carga', v: r.ultima ? relTiempo(r.ultima.t) : '—', sub: r.ultima ? `${r.ultima.que}${r.ultima.quien ? ` · ${r.ultima.quien}` : ''}` : 'sin cargas' },
  ];
  const diaTxt = fmtDia.format(new Date()).replace(',', '');
  const latidoTxt = r.latido.t ? `puente ${r.latido.enLinea ? 'en línea' : 'sin señal'} ${relTiempo(r.latido.t)}` : 'puente sin latido';

  return (
    <div data-stagger style={{ fontFamily: TYPO.fontText, color: theme.text, display: 'flex', flexDirection: 'column', gap: 10, fontVariantNumeric: 'tabular-nums' }}>
      <Hero eyebrow={`Configuración · Importador central · ${latidoTxt} · ${diaTxt}`} titulo={r.titulo} sub={r.sub} dot={r.dot} stats={stats} />
      <CargasAutomaticas status={status} perfil={perfil} onRefetch={refetch} />
      <CargasManuales status={status} upload={upload} fuentes={fuentes} perfil={perfil} onRefetch={refetch} />
      <p style={{ fontSize: 10.5, color: theme.textSubtle || theme.textMuted, margin: '0 4px' }}>
        Se actualiza cada minuto. Ventas ERP trae sólo los últimos 45 días en cada corrida (carga completa: ./run.sh ventas --anios 2026). Los parsers de las cargas manuales viven en src/lib/parsers/; uploads.html queda como respaldo técnico.
      </p>
    </div>
  );
}
