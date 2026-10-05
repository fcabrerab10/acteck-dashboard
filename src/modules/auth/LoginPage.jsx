// LoginPage · pantalla de bloqueo «Grafito» (3.68.0 · 2026-10-04, elegida por Fernando en el prototipo
// «Entrada Acteck»): como la pantalla de bloqueo de un Mac. Hora y fecha grandes arriba, en medio el avatar y el
// nombre de quien entró la última vez en este navegador (lib/entrada.js) con una sola pastilla de contraseña;
// si no se conoce a nadie, pastillas de correo y contraseña. Debajo «Entrar con Google» y, al pie, «acteck.».
// Fondo = el del tema (--t-bg que index.html pinta antes de React) con un gradiente gris apenas visible que
// respira muy despacio; en temas claros, gris perla. Nada sigue al mouse. Al entrar, el formulario se disuelve y
// el dashboard entra tarjeta por tarjeta (iniciarEntrada). Respeta «reducir movimiento».
import React, { useEffect, useRef, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { inicialesDe, colorInicialesDe } from '../../lib/avatar';
import { leerUltimoUsuario, guardarUltimoUsuario, olvidarUltimoUsuario, iniciarEntrada } from '../../lib/entrada';
import { reduceMotion } from '../../lib/motion';

const EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const SUAVE = 'cubic-bezier(0.22, 1, 0.36, 1)';
const ACCENT = '#0A84FF';

function temaClaro() {
  if (typeof document === 'undefined') return false;
  const k = document.documentElement.getAttribute('data-theme');
  if (k) return k === 'claro' || k === 'marfil';
  return !(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
}

function horaFecha(d) {
  const hh = d.getHours();
  const mm = String(d.getMinutes()).padStart(2, '0');
  let fecha = d.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' });
  fecha = fecha.charAt(0).toUpperCase() + fecha.slice(1);
  return { hora: `${hh}:${mm}`, fecha };
}

export default function LoginPage({ onLogin }) {
  const [ultimo, setUltimo] = useState(() => leerUltimoUsuario());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [saliendo, setSaliendo] = useState(false);
  const [ahora, setAhora] = useState(() => new Date());
  const [angosto, setAngosto] = useState(() => typeof window !== 'undefined' && window.innerWidth < 700);
  const [bajo, setBajo] = useState(() => typeof window !== 'undefined' && window.innerHeight < 720);
  const pillRef = useRef(null);
  const claro = temaClaro();
  const sinAnim = reduceMotion();

  useEffect(() => {
    const t = setInterval(() => setAhora(new Date()), 15000);
    const r = () => { setAngosto(window.innerWidth < 700); setBajo(window.innerHeight < 720); };
    window.addEventListener('resize', r);
    return () => { clearInterval(t); window.removeEventListener('resize', r); };
  }, []);

  const { hora, fecha } = horaFecha(ahora);
  const correo = ultimo ? ultimo.email : email.trim();
  const texto = claro ? '#1D1D1F' : '#F5F5F7';
  const pill = claro ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.16)';
  const pillFoco = claro ? 'rgba(0,0,0,0.11)' : 'rgba(255,255,255,0.24)';
  const sombra = claro ? 'none' : '0 2px 20px rgba(0,0,0,0.35)';
  const fondo = claro
    ? 'radial-gradient(55% 45% at 65% 30%, rgba(255,255,255,0.9), transparent 70%), radial-gradient(45% 40% at 25% 80%, rgba(0,0,0,0.05), transparent 70%)'
    : 'radial-gradient(55% 45% at 65% 30%, rgba(255,255,255,0.07), transparent 70%), radial-gradient(45% 40% at 25% 80%, rgba(255,255,255,0.04), transparent 70%)';

  const sacudir = () => {
    const el = pillRef.current;
    if (!el || sinAnim) return;
    el.style.animation = 'none';
    void el.offsetWidth;
    el.style.animation = `loginShake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97)`;
  };

  const entrar = async (e) => {
    e?.preventDefault?.();
    if (loading) return;
    if (!correo) { setError('Escribe tu correo.'); sacudir(); return; }
    if (!password) { setError('Escribe tu contraseña.'); sacudir(); return; }
    setError('');
    setLoading(true);
    try {
      const { data, error: e1 } = await supabase.auth.signInWithPassword({ email: correo, password });
      if (e1) throw e1;
      const { data: perfil, error: e2 } = await supabase.from('perfiles').select('*').eq('user_id', data.user.id).single();
      if (e2 || !perfil) throw new Error('No se encontró tu perfil. Contacta al administrador.');
      if (!perfil.activo) throw new Error('Tu cuenta está desactivada.');
      guardarUltimoUsuario(perfil, data.user.email || correo);
      iniciarEntrada();
      setSaliendo(true);
      // El formulario se disuelve (350 ms) y debajo ya entran las tarjetas.
      setTimeout(() => onLogin({ user: data.user, perfil }), sinAnim ? 0 : 320);
    } catch (err) {
      const msg = /invalid login|credentials/i.test(err?.message || '') ? 'Contraseña incorrecta.' : (err?.message || 'No pudimos iniciar sesión.');
      setError(msg);
      setPassword('');
      sacudir();
      setLoading(false);
    }
  };

  const conGoogle = () => {
    setError('');
    supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } });
  };

  const otraPersona = () => { olvidarUltimoUsuario(); setUltimo(null); setError(''); setPassword(''); };

  const perfilVis = ultimo ? { nombre: ultimo.nombre, email: ultimo.email } : null;
  const nombreCorto = (ultimo?.nombre || '').split(/\s+/)[0];

  const inputBase = {
    width: '100%', height: 38, border: 0, outline: 'none', borderRadius: 19, background: pill, color: texto,
    textAlign: 'center', fontFamily: 'inherit', fontSize: 15, padding: '0 42px 0 18px',
    backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', transition: `background 200ms ${EASE}`,
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, overflow: 'hidden', zIndex: 250,
      background: 'var(--t-bg, #000)', color: texto,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", sans-serif',
      WebkitFontSmoothing: 'antialiased',
      opacity: saliendo ? 0 : 1, transition: `opacity 400ms ${EASE} ${saliendo ? '200ms' : '0ms'}`,
      animation: sinAnim ? 'none' : `loginIn 500ms ${EASE} both`,
    }}>
      <style>{`
        @keyframes loginIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes loginRespira { 0% { transform: translate(-2%, 1%) scale(1); } 100% { transform: translate(2%, -1%) scale(1.05); } }
        @keyframes loginShake { 10%, 90% { transform: translateX(-2px); } 20%, 80% { transform: translateX(3px); } 30%, 50%, 70% { transform: translateX(-5px); } 40%, 60% { transform: translateX(5px); } }
        @keyframes loginGira { to { transform: rotate(360deg); } }
        .login-in::placeholder { color: ${texto}; opacity: .55; }
        .login-in:focus { background: ${pillFoco} !important; }
        .login-lk { background: none; border: 0; padding: 0; color: inherit; font: inherit; cursor: pointer; opacity: .7; }
        .login-lk:hover { opacity: 1; }
        @media (prefers-reduced-motion: reduce) { .login-fondo { animation: none !important; } }
      `}</style>

      {/* Luz gris que respira (Grafito) */}
      <div className="login-fondo" aria-hidden style={{ position: 'absolute', inset: '-25%', pointerEvents: 'none', background: fondo, animation: `loginRespira 16s ease-in-out infinite alternate` }} />

      <form onSubmit={entrar} style={{
        position: 'relative', zIndex: 1, height: '100dvh', minHeight: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between',
        // Safe areas de cada iPhone (notch / Dynamic Island / home indicator); en pantallas bajas (SE) los márgenes se encogen.
        padding: angosto ? 'calc(18px + env(safe-area-inset-top)) 20px calc(22px + env(safe-area-inset-bottom))' : 'calc(40px + env(safe-area-inset-top)) 20px calc(44px + env(safe-area-inset-bottom))',
        boxSizing: 'border-box', overflow: 'hidden',
        transform: saliendo ? 'translateY(-16px) scale(0.97)' : 'none', opacity: saliendo ? 0 : 1,
        transition: `transform 500ms ${SUAVE}, opacity 350ms ${EASE}`,
      }}>
        {/* Reloj */}
        <div style={{ textAlign: 'center', textShadow: sombra, userSelect: 'none' }}>
          <div style={{ fontSize: angosto ? 16 : 17, fontWeight: 600, opacity: 0.85 }}>{fecha}</div>
          <div style={{ fontSize: bajo ? 60 : angosto ? 72 : 84, fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{hora}</div>
        </div>

        {/* Quién entra */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, width: '100%', maxWidth: 300 }}>
          <div style={{
            width: bajo ? 60 : 72, height: bajo ? 60 : 72, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center',
            background: perfilVis ? colorInicialesDe(perfilVis) : `linear-gradient(145deg, #8ec5ff, ${ACCENT})`,
            color: '#fff', fontSize: 26, fontWeight: 700, boxShadow: '0 10px 30px rgba(0,0,0,0.3)',
          }}>
            {ultimo?.avatar_url
              ? <img src={ultimo.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : (perfilVis ? inicialesDe(perfilVis) : <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.04em' }}>a<span style={{ color: '#fff' }}>.</span></span>)}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, textShadow: sombra }}>{ultimo?.nombre || (ultimo ? ultimo.email : 'Dashboard de clientes')}</div>

          {!ultimo && (
            <div style={{ width: 240 }}>
              <input className="login-in" type="email" autoComplete="email" autoFocus value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Correo" style={{ ...inputBase, padding: '0 18px' }} />
            </div>
          )}

          <div ref={pillRef} style={{ position: 'relative', width: 240 }}>
            <input className="login-in" type="password" autoComplete="current-password" autoFocus={!!ultimo} value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña" aria-label="Contraseña" style={inputBase} />
            <button type="submit" aria-label="Entrar" disabled={loading} style={{
              position: 'absolute', right: 5, top: 5, width: 28, height: 28, borderRadius: '50%', border: 0, cursor: loading ? 'wait' : 'pointer',
              background: password ? ACCENT : pill, color: password ? '#fff' : texto, display: 'grid', placeItems: 'center', fontSize: 14, padding: 0,
              transition: `background 200ms ${EASE}, transform 140ms ${EASE}`,
            }}>
              {loading
                ? <span style={{ width: 14, height: 14, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.35)', borderTopColor: '#fff', animation: 'loginGira 800ms linear infinite' }} />
                : '→'}
            </button>
          </div>

          <div style={{ minHeight: 18, fontSize: 12.5, color: '#FF453A', textAlign: 'center', opacity: error ? 1 : 0, transition: `opacity 200ms ${EASE}` }}>{error || ' '}</div>

          <button type="button" className="login-lk" onClick={conGoogle} style={{ fontSize: 12.5, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span aria-hidden style={{ width: 16, height: 16, borderRadius: 4, background: 'conic-gradient(#4285F4 0 25%, #34A853 0 50%, #FBBC05 0 75%, #EA4335 0)' }} />
            Entrar con Google
          </button>
          {ultimo && (
            <button type="button" className="login-lk" onClick={otraPersona} style={{ fontSize: 12 }}>
              {nombreCorto ? `No soy ${nombreCorto}` : 'Entrar con otra cuenta'}
            </button>
          )}
        </div>

        {/* Marca al pie */}
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '-0.03em', opacity: 0.55, userSelect: 'none' }}>acteck<span style={{ color: ACCENT }}>.</span></div>
      </form>
    </div>
  );
}
