// "Preparar visita" · baja de una sentada todo lo del cliente para poder verlo sin señal.
// Se monta en el Resumen del cliente (web, dentro del Hero) y en la ficha de cliente del móvil.
// La lógica está en src/lib/modoVisita.js; aquí sólo el botón, el progreso y los avisos.
import React, { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { useTheme } from '../lib/themeContext';
import { TYPO } from '../lib/themeTokens';
import { EASE, DUR } from '../lib/motion';
import { toast } from './kit/Toast';
import { prepararVisita, textoListo, marcarVisita, ultimaVisita } from '../lib/modoVisita';

const cuando = (d) => {
  if (!d) return null;
  const hoy = new Date();
  const mismoDia = d.toDateString() === hoy.toDateString();
  return mismoDia
    ? `datos al ${d.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}`
    : `datos del ${d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short' })}`;
};

export default function BotonPrepararVisita({ clienteKey, nombre, anio, variante = 'hero' }) {
  const { theme } = useTheme();
  const [estado, setEstado] = useState({ corriendo: false, hecho: 0, total: 0, paso: '' });
  const [listo, setListo] = useState(() => ultimaVisita(clienteKey));

  const correr = async () => {
    if (estado.corriendo) return;
    setEstado({ corriendo: true, hecho: 0, total: 1, paso: 'Preparando…' });
    const r = await prepararVisita(clienteKey, {
      anio,
      onProgreso: (hecho, total, paso) => setEstado({ corriendo: true, hecho, total, paso }),
    });
    setEstado({ corriendo: false, hecho: 0, total: 0, paso: '' });
    marcarVisita(clienteKey, r.hora);
    setListo(r.hora);
    if (r.ok) toast.ok(textoListo(r.hora), { ms: 4200 });
    else toast.info(`${textoListo(r.hora)} · faltó ${r.fallos.map((f) => f.label).join(', ')}`, { ms: 5200 });
  };

  const pct = estado.total ? Math.round((estado.hecho / estado.total) * 100) : 0;
  const etiqueta = estado.corriendo
    ? `${estado.paso}… ${estado.hecho}/${estado.total}`
    : listo ? `Visita lista · ${cuando(listo)}` : 'Preparar visita';

  const hero = variante === 'hero';
  const base = {
    position: 'relative', overflow: 'hidden',
    display: 'inline-flex', alignItems: 'center', gap: 6,
    height: hero ? 26 : 40, padding: hero ? '0 10px' : '0 14px', borderRadius: hero ? 999 : 12,
    border: 0, cursor: estado.corriendo ? 'progress' : 'pointer',
    background: hero ? 'rgba(255,255,255,0.14)' : theme.surface,
    color: hero ? (theme.textOnInverse || '#F5F5F7') : theme.text,
    fontFamily: TYPO.fontText, fontSize: hero ? 11 : 13.5, fontWeight: 600, letterSpacing: '-0.005em',
    width: hero ? undefined : '100%', justifyContent: hero ? undefined : 'center',
    transition: `background ${DUR.state}ms ${EASE}`,
  };

  return (
    <button
      type="button"
      onClick={correr}
      disabled={estado.corriendo}
      title={`Baja Resumen, Sell In, Sell Out, inventario, precios, propuestas y minutas de ${nombre || clienteKey} para verlos sin internet.`}
      style={base}
    >
      {/* Barra de progreso dentro del propio botón */}
      {estado.corriendo && (
        <span aria-hidden style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`,
          background: hero ? 'rgba(255,255,255,0.18)' : `${theme.accent || '#007AFF'}22`,
          transition: `width ${DUR.content}ms ${EASE}`,
        }} />
      )}
      <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
        {listo && !estado.corriendo ? <Check size={hero ? 11 : 15} strokeWidth={2.4} /> : <Download size={hero ? 11 : 15} strokeWidth={2.2} />}
        {etiqueta}
      </span>
    </button>
  );
}
