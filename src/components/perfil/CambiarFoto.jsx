// CambiarFoto · onboarding de la foto de perfil ilustrada (modal, 4 pasos):
//   1 subir/arrastrar selfie o tomar con cámara → 2 recorte circular con zoom (canvas, sin librerías)
//   → 3 fondo (Ciudad de noche / de día; preselección por género) → 4 "Generar mi avatar" → resultado.
// Uso: <CambiarFoto abierto={v} onClose={…} perfil={perfil} onListo={(avatar_url) => …} />
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Camera, Upload, ImagePlus, RotateCcw, Check, ChevronRight, ZoomIn } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { EASE, DUR } from '../../lib/motion';
import { supabase, DB_CONFIGURED } from '../../lib/supabase';
import { archivoAImagen, subirSelfie, aplicarPerfilLocal, usePerfilVivo, componerFallback, FONDOS, fondoPorGenero, COMPOSICION } from '../../lib/avatar';
import { Boton, Segmented, toast } from '../kit';
import { Modal, Spinner, suaveBg, hairline, esOscuro } from './comun';

const PASOS = ['Foto', 'Recorte', 'Fondo', 'Avatar'];
const LADO_PREVIEW = 260;

export default function CambiarFoto({ abierto, onClose, perfil: perfilProp, onListo }) {
  const { theme } = useTheme();
  const perfil = usePerfilVivo(perfilProp);
  const [paso, setPaso] = useState(0);
  const [img, setImg] = useState(null);
  const [recorte, setRecorte] = useState(null);       // canvas 1024 cuadrado
  const [fondo, setFondo] = useState(null);
  const [genero, setGenero] = useState(null);         // 'masculino' | 'femenino' | 'elegir'
  const [estado, setEstado] = useState('idle');       // idle | preparando | subiendo | listo | error
  const [resultado, setResultado] = useState(null);   // { avatar_url, generado_por }
  const [error, setError] = useState(null);

  // Reset al abrir
  useEffect(() => {
    if (!abierto) return;
    setPaso(0); setImg(null); setRecorte(null); setResultado(null); setError(null); setEstado('idle');
    setGenero(perfil?.genero === 'masculino' || perfil?.genero === 'femenino' ? perfil.genero : null);
    setFondo(perfil?.avatar_fondo || fondoPorGenero(perfil?.genero) || null);
  }, [abierto]); // eslint-disable-line react-hooks/exhaustive-deps

  const cargarArchivo = useCallback(async (file) => {
    if (!file || !file.type.startsWith('image/')) { toast.error('Elige una imagen (JPG, PNG o HEIC convertido)'); return; }
    try { setImg(await archivoAImagen(file)); setPaso(1); }
    catch (e) { toast.error(e.message || 'No se pudo leer la imagen'); }
  }, []);

  const elegirGenero = async (g) => {
    setGenero(g);
    if (g === 'masculino' || g === 'femenino') {
      setFondo(fondoPorGenero(g));
      if (DB_CONFIGURED && perfil?.user_id && perfil.genero !== g) {
        const { error: e } = await supabase.rpc('set_perfil_propio', { p: { genero: g } });
        if (!e) aplicarPerfilLocal(perfil.user_id, { genero: g });
      }
    }
  };

  const generar = async () => {
    if (!recorte || !fondo) return;
    setError(null); setEstado('preparando');
    try {
      const r = await subirSelfie(recorte, fondo, { userId: perfil?.user_id, onEstado: setEstado });
      setResultado(r); setEstado('listo');
    } catch (e) {
      setError(e.message || 'No se pudo generar el avatar'); setEstado('error');
    }
  };

  const usar = () => { if (resultado?.avatar_url) onListo?.(resultado.avatar_url, resultado); onClose?.(); };
  const repetir = () => { setPaso(0); setImg(null); setRecorte(null); setResultado(null); setEstado('idle'); setError(null); };

  const puedeSeguirFondo = !!fondo;

  return (
    <Modal abierto={abierto} onClose={onClose} theme={theme} titulo="Tu foto de perfil" ancho={520}
      sub="Todas las fotos del equipo son ilustraciones con el mismo estilo: tú, en tu oficina."
      pie={
        paso === 0 ? null
        : paso === 1 ? <><Boton onClick={() => setPaso(0)}>Atrás</Boton><Boton primario icon={ChevronRight} onClick={() => setPaso(2)} disabled={!recorte}>Continuar</Boton></>
        : paso === 2 ? <><Boton onClick={() => setPaso(1)}>Atrás</Boton><Boton primario icon={ChevronRight} onClick={() => { setPaso(3); generar(); }} disabled={!puedeSeguirFondo}>Generar mi avatar</Boton></>
        : estado === 'listo' ? <><Boton icon={RotateCcw} onClick={repetir}>Repetir</Boton><Boton primario icon={Check} onClick={usar}>Usar esta foto</Boton></>
        : estado === 'error' ? <><Boton icon={RotateCcw} onClick={repetir}>Repetir</Boton><Boton primario onClick={generar}>Reintentar</Boton></>
        : null
      }>
      <Pasos theme={theme} actual={paso} />
      {paso === 0 && <PasoSubir theme={theme} onArchivo={cargarArchivo} />}
      {paso === 1 && img && <PasoRecorte theme={theme} img={img} onRecorte={setRecorte} />}
      {paso === 2 && <PasoFondo theme={theme} perfil={perfil} fondo={fondo} setFondo={setFondo} genero={genero} onGenero={elegirGenero} recorte={recorte} />}
      {paso === 3 && <PasoResultado theme={theme} estado={estado} resultado={resultado} error={error} />}
    </Modal>
  );
}

// ─── Indicador de pasos ───
function Pasos({ theme, actual }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
      {PASOS.map((p, i) => {
        const on = i === actual; const hecho = i < actual;
        return (
          <React.Fragment key={p}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: on ? 600 : 500, color: on ? theme.text : hecho ? theme.textMuted : theme.textSubtle || theme.textMuted, transition: `color ${DUR.state}ms ${EASE}` }}>
              <span style={{ width: 16, height: 16, borderRadius: 999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 9.5, fontWeight: 600, fontVariantNumeric: 'tabular-nums',
                background: on || hecho ? theme.accent : suaveBg(theme), color: on || hecho ? (theme.textOnDark || theme.surface) : theme.textMuted }}>{hecho ? <Check size={9} strokeWidth={3} /> : i + 1}</span>
              {p}
            </span>
            {i < PASOS.length - 1 && <span style={{ flex: 1, height: 1, background: hairline(theme) }} />}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Paso 1 · subir ───
function PasoSubir({ theme, onArchivo }) {
  const [sobre, setSobre] = useState(false);
  const inputRef = useRef(null); const camRef = useRef(null);
  const onDrop = (e) => { e.preventDefault(); setSobre(false); onArchivo(e.dataTransfer.files?.[0]); };
  return (
    <div>
      <div onDragOver={(e) => { e.preventDefault(); setSobre(true); }} onDragLeave={() => setSobre(false)} onDrop={onDrop}
        onClick={() => inputRef.current?.click()} role="button" tabIndex={0}
        style={{
          border: `1.5px dashed ${sobre ? theme.accent : theme.borderStrong || theme.border}`, borderRadius: 14, padding: '34px 20px', textAlign: 'center', cursor: 'pointer',
          background: sobre ? (theme.accentBg || 'rgba(0,122,255,0.08)') : suaveBg(theme), transition: `background ${DUR.state}ms ${EASE}, border-color ${DUR.state}ms ${EASE}`,
        }}>
        <ImagePlus size={28} strokeWidth={1.5} style={{ color: theme.textMuted }} />
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 10, color: theme.text }}>Arrastra una selfie aquí</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>o haz clic para elegirla · JPG o PNG · de frente y con buena luz</div>
      </div>
      <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
        <Boton icon={Upload} onClick={() => inputRef.current?.click()}>Elegir archivo</Boton>
        <Boton icon={Camera} onClick={() => camRef.current?.click()}>Tomar con la cámara</Boton>
      </div>
      <input ref={inputRef} type="file" accept="image/*" hidden onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={camRef} type="file" accept="image/*" capture="user" hidden onChange={(e) => { onArchivo(e.target.files?.[0]); e.target.value = ''; }} />
      <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, textAlign: 'center', marginTop: 12 }}>
        La selfie se guarda en privado y sólo se usa para dibujar tu avatar.
      </div>
    </div>
  );
}

// ─── Paso 2 · recorte circular con zoom y arrastre ───
function PasoRecorte({ theme, img, onRecorte }) {
  const canvasRef = useRef(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const L = LADO_PREVIEW;
  const base = L / Math.min(img.naturalWidth, img.naturalHeight); // cover
  const escala = base * zoom;
  const w = img.naturalWidth * escala; const h = img.naturalHeight * escala;
  const limitar = useCallback((o) => ({
    x: Math.max(-(w - L) / 2, Math.min((w - L) / 2, o.x)),
    y: Math.max(-(h - L) / 2, Math.min((h - L) / 2, o.y)),
  }), [w, h, L]);

  // Dibuja preview + máscara circular
  useEffect(() => {
    const c = canvasRef.current; if (!c) return;
    const ctx = c.getContext('2d');
    const o = limitar(off);
    ctx.clearRect(0, 0, L, L);
    ctx.drawImage(img, L / 2 - w / 2 + o.x, L / 2 - h / 2 + o.y, w, h);
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, L, L); ctx.arc(L / 2, L / 2, L / 2 - 2, 0, Math.PI * 2, true); ctx.closePath();
    ctx.fillStyle = esOscuro(theme) ? 'rgba(0,0,0,0.62)' : 'rgba(255,255,255,0.72)'; ctx.fill();
    ctx.restore();
    ctx.beginPath(); ctx.arc(L / 2, L / 2, L / 2 - 2, 0, Math.PI * 2);
    ctx.lineWidth = 2; ctx.strokeStyle = theme.accent; ctx.stroke();
  }, [img, w, h, off, limitar, theme, L]);

  // Exporta el recorte (1024) cada vez que cambia
  useEffect(() => {
    const o = limitar(off);
    const out = document.createElement('canvas'); out.width = COMPOSICION.lado; out.height = COMPOSICION.lado;
    const k = COMPOSICION.lado / L;
    out.getContext('2d').drawImage(img, (L / 2 - w / 2 + o.x) * k, (L / 2 - h / 2 + o.y) * k, w * k, h * k);
    onRecorte(out);
  }, [img, w, h, off, limitar, onRecorte, L]);

  const inicio = (x, y) => { drag.current = { x, y, o: limitar(off) }; };
  const mover = (x, y) => { if (!drag.current) return; const d = drag.current; setOff(limitar({ x: d.o.x + (x - d.x), y: d.o.y + (y - d.y) })); };
  const fin = () => { drag.current = null; };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
      <canvas ref={canvasRef} width={L} height={L}
        onMouseDown={(e) => inicio(e.clientX, e.clientY)} onMouseMove={(e) => mover(e.clientX, e.clientY)} onMouseUp={fin} onMouseLeave={fin}
        onTouchStart={(e) => { const t = e.touches[0]; inicio(t.clientX, t.clientY); }} onTouchMove={(e) => { const t = e.touches[0]; mover(t.clientX, t.clientY); e.preventDefault(); }} onTouchEnd={fin}
        onWheel={(e) => { e.preventDefault(); setZoom((z) => Math.max(1, Math.min(3, z - e.deltaY * 0.002))); }}
        style={{ width: L, height: L, borderRadius: 14, cursor: drag.current ? 'grabbing' : 'grab', touchAction: 'none', background: suaveBg(theme) }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, width: L }}>
        <ZoomIn size={14} strokeWidth={2} style={{ color: theme.textMuted }} />
        <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} aria-label="Zoom" style={{ flex: 1, accentColor: theme.accent }} />
        <span style={{ fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 10.5, color: theme.textMuted, fontVariantNumeric: 'tabular-nums', width: 34, textAlign: 'right' }}>{zoom.toFixed(1)}×</span>
      </div>
      <div style={{ fontSize: 11.5, color: theme.textMuted }}>Arrastra para centrar tu cara; la rueda o el control ajustan el zoom.</div>
    </div>
  );
}

// ─── Paso 3 · fondo (+ género si no lo sabemos) ───
function PasoFondo({ theme, perfil, fondo, setFondo, genero, onGenero, recorte }) {
  const preguntar = !(perfil?.genero === 'masculino' || perfil?.genero === 'femenino');
  const [previews, setPreviews] = useState({});
  useEffect(() => {
    if (!recorte) return;
    let vivo = true;
    (async () => {
      const out = {};
      for (const f of FONDOS) { try { out[f.id] = await componerFallback(recorte, f.id); } catch { out[f.id] = f.src; } }
      if (vivo) setPreviews(out);
    })();
    return () => { vivo = false; };
  }, [recorte]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      {preguntar && (
        <div>
          <div style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 6 }}>¿Cómo te identificas?</div>
          <Segmented size="md" value={genero || ''} onChange={onGenero} options={[
            { id: 'masculino', label: 'Hombre' }, { id: 'femenino', label: 'Mujer' }, { id: 'elegir', label: 'Prefiero elegir el fondo' },
          ]} />
          <div style={{ fontSize: 11, color: theme.textSubtle || theme.textMuted, marginTop: 6 }}>Sólo sirve para sugerir el fondo: noche para hombres, día para mujeres. Puedes cambiarlo abajo.</div>
        </div>
      )}
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: theme.text, marginBottom: 8 }}>Fondo de tu oficina</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {FONDOS.map((f) => {
            const on = fondo === f.id;
            return (
              <button key={f.id} type="button" onClick={() => setFondo(f.id)} aria-pressed={on}
                style={{ padding: 6, borderRadius: 14, cursor: 'pointer', background: on ? (theme.accentBg || 'rgba(0,122,255,0.10)') : 'transparent',
                  border: `2px solid ${on ? theme.accent : hairline(theme)}`, transition: `border-color ${DUR.state}ms ${EASE}, background ${DUR.state}ms ${EASE}`, textAlign: 'center' }}>
                <img src={previews[f.id] || f.src} alt={f.label} style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 10, display: 'block', objectFit: 'cover' }} />
                <div style={{ fontSize: 12.5, fontWeight: on ? 600 : 500, color: theme.text, marginTop: 8, marginBottom: 2 }}>{f.label}</div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Paso 4 · generando / resultado ───
function PasoResultado({ theme, estado, resultado, error }) {
  const generando = estado === 'preparando' || estado === 'subiendo';
  if (generando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '36px 0' }}>
        <Spinner theme={theme} size={30} />
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>Dibujando tu avatar…</div>
        <div style={{ fontSize: 12, color: theme.textMuted }}>{estado === 'preparando' ? 'Preparando tu foto' : 'Generando la ilustración (puede tardar hasta un minuto)'}</div>
      </div>
    );
  }
  if (estado === 'error') {
    return (
      <div style={{ padding: '20px 0', textAlign: 'center' }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, color: theme.red }}>No se pudo generar</div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>{error}</div>
      </div>
    );
  }
  if (estado === 'listo' && resultado) {
    const fallback = resultado.generado_por === 'fallback';
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, padding: '8px 0' }}>
        <img src={resultado.avatar_url} alt="Tu avatar" style={{ width: 220, height: 220, borderRadius: 999, objectFit: 'cover', border: `1px solid ${hairline(theme)}` }} />
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', color: theme.text }}>{fallback ? 'Vista previa lista' : 'Tu avatar está listo'}</div>
        <div style={{ fontSize: 12, color: theme.textMuted, textAlign: 'center', maxWidth: 360 }}>
          {fallback ? 'Vista previa; el avatar ilustrado se generará cuando se active el servicio.' : 'Ilustración generada a partir de tu selfie. Si no te convence, repite con otra foto.'}
        </div>
      </div>
    );
  }
  return null;
}
