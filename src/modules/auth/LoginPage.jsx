// LoginPage — Apple feel real. Mesh gradient que reacciona al mouse,
// labels flotantes, spring animations, botón con press haptic-like.
import React, { useState, useEffect, useRef } from "react";
import { supabase } from '../../lib/supabase';

// Apple standard easing curves
const APPLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';
const APPLE_SPRING = 'cubic-bezier(0.34, 1.56, 0.64, 1)';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);
  const [mouseX, setMouseX] = useState(50);
  const [mouseY, setMouseY] = useState(50);
  const cardRef = useRef(null);

  // Mouse parallax en el fondo
  useEffect(() => {
    const onMove = (e) => {
      const x = (e.clientX / window.innerWidth) * 100;
      const y = (e.clientY / window.innerHeight) * 100;
      setMouseX(x);
      setMouseY(y);
    };
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles").select("*").eq("user_id", data.user.id).single();
      if (perfilError) throw new Error("No se encontró tu perfil. Contacta al administrador.");
      if (!perfil.activo) throw new Error("Tu cuenta está desactivada.");
      onLogin({ user: data.user, perfil });
    } catch (err) {
      setError(err.message || "No pudimos iniciar sesión. Verifica tus datos.");
      // Shake haptic-like en error
      if (cardRef.current) {
        cardRef.current.style.animation = 'none';
        void cardRef.current.offsetWidth;
        cardRef.current.style.animation = 'shake 400ms cubic-bezier(0.36, 0.07, 0.19, 0.97)';
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(24px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(3px); }
          30%, 50%, 70% { transform: translateX(-5px); }
          40%, 60% { transform: translateX(5px); }
        }
        @keyframes gradientDrift {
          0%, 100% { transform: rotate(0deg); }
          50% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 0.7; }
          50% { opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          * { animation-duration: 0.001ms !important; transition-duration: 0.001ms !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#000',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, position: 'relative', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        {/* ── Mesh gradient de fondo, reactivo al mouse ── */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background: `
            radial-gradient(circle at ${mouseX}% ${mouseY}%, rgba(10,132,255,0.35) 0%, transparent 40%),
            radial-gradient(circle at ${100 - mouseX}% ${100 - mouseY}%, rgba(191,90,242,0.28) 0%, transparent 45%),
            radial-gradient(circle at 30% 80%, rgba(255,55,95,0.22) 0%, transparent 40%),
            radial-gradient(circle at 70% 20%, rgba(48,209,88,0.15) 0%, transparent 40%)
          `,
          transition: `background 800ms ${APPLE_EASE}`,
          filter: 'blur(20px)',
        }} />
        {/* Grain overlay */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: 'url("data:image/svg+xml;utf8,<svg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\' /></filter><rect width=\'200\' height=\'200\' filter=\'url(%23n)\' opacity=\'0.5\' /></svg>")',
          opacity: 0.08, mixBlendMode: 'overlay',
        }} />

        {/* ── Card glass ── */}
        <div ref={cardRef} style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(20,20,24,0.55)',
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 28, padding: '52px 44px 40px',
          width: '100%', maxWidth: 440,
          boxShadow: '0 30px 90px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)',
          animation: `fadeInUp 800ms ${APPLE_EASE} both`,
          color: '#F5F5F7',
        }}>

          {/* Logo dot pulse */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '4px 12px', borderRadius: 999,
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.06)',
              fontSize: 11.5, fontWeight: 500, color: 'rgba(245,245,247,0.7)',
              letterSpacing: 0,
              animation: `fadeIn 1000ms ${APPLE_EASE} both`,
              animationDelay: '200ms',
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: 999, background: '#30D158',
                animation: 'pulse 2.4s ease-in-out infinite',
              }} />
              Balam Rush · Acteck
            </div>
            <h1 style={{
              fontFamily: '-apple-system, "SF Pro Display", sans-serif',
              fontSize: 40, fontWeight: 600, letterSpacing: '-0.035em',
              color: '#F5F5F7', margin: '18px 0 0', lineHeight: 1.05,
            }}>Bienvenido.</h1>
            <p style={{
              fontSize: 15, color: 'rgba(245,245,247,0.65)',
              margin: '10px 0 0', lineHeight: 1.4,
            }}>Ingresa con tu cuenta corporativa.</p>
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '11px 14px',
              background: 'rgba(255,69,58,0.14)',
              border: '1px solid rgba(255,69,58,0.25)',
              borderRadius: 12, color: '#FF6B60', fontSize: 13,
              animation: `fadeIn 220ms ${APPLE_EASE}`,
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            <FloatingInput
              label="Correo electrónico"
              type="email" value={email} onChange={setEmail}
              focused={emailFocus} setFocused={setEmailFocus}
              autoComplete="email" autoFocus
            />
            <div style={{ height: 12 }} />
            <FloatingInput
              label="Contraseña"
              type={showPass ? 'text' : 'password'} value={password} onChange={setPassword}
              focused={passFocus} setFocused={setPassFocus}
              autoComplete="current-password"
              rightAdornment={
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(245,245,247,0.5)', fontSize: 11, fontWeight: 500,
                    padding: '6px 10px', borderRadius: 8, fontFamily: 'inherit',
                    transition: `all 200ms ${APPLE_EASE}`,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F5F7'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(245,245,247,0.5)'; e.currentTarget.style.background = 'transparent'; }}>
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              }
            />

            <div style={{ height: 28 }} />

            <SubmitButton loading={loading}>
              {loading ? 'Verificando…' : 'Continuar'}
            </SubmitButton>
          </form>

          <div style={{
            textAlign: 'center', marginTop: 28, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.06)',
          }}>
            <p style={{ fontSize: 12, color: 'rgba(245,245,247,0.4)', margin: 0 }}>
              ¿Problemas para entrar? Contacta al administrador.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Input con label flotante ───
function FloatingInput({ label, type, value, onChange, focused, setFocused, autoComplete, autoFocus, rightAdornment }) {
  const hasValue = value.length > 0;
  const floated = focused || hasValue;

  return (
    <div style={{
      position: 'relative',
      background: focused ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
      border: `1px solid ${focused ? 'rgba(10,132,255,0.5)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 13,
      transition: `all 300ms ${APPLE_EASE}`,
      boxShadow: focused ? '0 0 0 4px rgba(10,132,255,0.12)' : 'none',
    }}>
      <label style={{
        position: 'absolute',
        left: 14,
        top: floated ? 6 : 16,
        fontSize: floated ? 10 : 15,
        color: floated ? 'rgba(245,245,247,0.6)' : 'rgba(245,245,247,0.5)',
        fontWeight: floated ? 600 : 400,
        letterSpacing: floated ? '0.02em' : 0,
        pointerEvents: 'none',
        transition: `all 220ms ${APPLE_EASE}`,
        transformOrigin: 'left top',
      }}>{label}</label>
      <input
        type={type} value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        autoComplete={autoComplete}
        autoFocus={autoFocus}
        required
        style={{
          width: '100%',
          padding: floated ? '22px 14px 8px' : '15px 14px',
          paddingRight: rightAdornment ? 80 : 14,
          background: 'transparent', border: 'none',
          fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#F5F5F7',
          transition: `padding 220ms ${APPLE_EASE}`,
        }}
      />
      {rightAdornment && (
        <div style={{
          position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
        }}>{rightAdornment}</div>
      )}
    </div>
  );
}

// ─── Botón submit con spring haptic-like ───
function SubmitButton({ children, loading }) {
  const [pressed, setPressed] = useState(false);
  const [hover, setHover] = useState(false);
  return (
    <button type="submit" disabled={loading}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => { setHover(false); setPressed(false); }}
      onMouseDown={() => setPressed(true)}
      onMouseUp={() => setPressed(false)}
      style={{
        width: '100%',
        background: loading ? 'rgba(10,132,255,0.55)' : (hover ? '#409CFF' : '#0A84FF'),
        color: 'white', border: 'none',
        padding: '15px 24px', borderRadius: 999,
        fontSize: 15, fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
        fontFamily: 'inherit',
        transition: `transform 180ms ${APPLE_SPRING}, background 200ms ${APPLE_EASE}, box-shadow 300ms ${APPLE_EASE}`,
        transform: pressed ? 'scale(0.96)' : hover ? 'scale(1.02)' : 'scale(1)',
        boxShadow: hover
          ? '0 8px 32px rgba(10,132,255,0.5), 0 0 0 1px rgba(255,255,255,0.15) inset'
          : '0 4px 20px rgba(10,132,255,0.35), 0 0 0 1px rgba(255,255,255,0.1) inset',
      }}>
      {children}
    </button>
  );
}
