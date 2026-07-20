// LoginPage — estilo Apple. Fondo con mesh gradient animado + orbes suaves,
// card glass centrada, tipografía SF Pro Display, botón pill con hover suave.
// Sin dependencia de ThemeContext (aún no hay perfil).
import React, { useState } from "react";
import { supabase } from '../../lib/supabase';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [emailFocus, setEmailFocus] = useState(false);
  const [passFocus, setPassFocus] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;
      const { data: perfil, error: perfilError } = await supabase
        .from("perfiles")
        .select("*")
        .eq("user_id", data.user.id)
        .single();
      if (perfilError) throw new Error("No se encontró tu perfil. Contacta al administrador.");
      if (!perfil.activo) throw new Error("Tu cuenta está desactivada.");
      onLogin({ user: data.user, perfil });
    } catch (err) {
      setError(err.message || "No pudimos iniciar sesión. Verifica tus datos.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Estilos de animación del fondo */}
      <style>{`
        @keyframes orb1 {
          0%, 100% { transform: translate(-15%, -15%) scale(1); }
          50% { transform: translate(15%, 10%) scale(1.15); }
        }
        @keyframes orb2 {
          0%, 100% { transform: translate(10%, 15%) scale(1); }
          50% { transform: translate(-10%, -8%) scale(0.9); }
        }
        @keyframes orb3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-20%, 15%) scale(1.1); }
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @media (prefers-reduced-motion: reduce) {
          .orb, .anim-in { animation: none !important; }
        }
      `}</style>

      <div style={{
        minHeight: '100vh',
        background: '#0A0A0C',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24, position: 'relative', overflow: 'hidden',
        fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
        WebkitFontSmoothing: 'antialiased',
      }}>
        {/* ─── Fondo: mesh gradient con 3 orbes ─── */}
        <div className="orb" style={{
          position: 'absolute', top: '-20%', left: '-10%',
          width: '65vw', height: '65vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(0,113,227,0.45), transparent 60%)',
          filter: 'blur(80px)',
          animation: 'orb1 22s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div className="orb" style={{
          position: 'absolute', bottom: '-20%', right: '-10%',
          width: '60vw', height: '60vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(191,90,242,0.4), transparent 60%)',
          filter: 'blur(90px)',
          animation: 'orb2 26s ease-in-out infinite',
          pointerEvents: 'none',
        }} />
        <div className="orb" style={{
          position: 'absolute', top: '30%', right: '20%',
          width: '35vw', height: '35vw', borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,55,95,0.28), transparent 60%)',
          filter: 'blur(70px)',
          animation: 'orb3 30s ease-in-out infinite',
          pointerEvents: 'none',
        }} />

        {/* ─── Card glass ─── */}
        <div className="anim-in" style={{
          position: 'relative', zIndex: 1,
          background: 'rgba(20,20,24,0.6)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 24, padding: '48px 44px',
          width: '100%', maxWidth: 440,
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.1)',
          animation: 'fadeInUp 700ms cubic-bezier(0.32, 0.72, 0, 1) both',
          color: '#F5F5F7',
        }}>

          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: 'rgba(245,245,247,0.55)', marginBottom: 10 }}>
              Balam Rush · Acteck
            </div>
            <h1 style={{
              fontFamily: '-apple-system, "SF Pro Display", sans-serif',
              fontSize: 36, fontWeight: 600, letterSpacing: '-0.03em',
              color: '#F5F5F7', margin: 0, lineHeight: 1.1,
            }}>Bienvenido de nuevo.</h1>
            <p style={{
              fontSize: 15, color: 'rgba(245,245,247,0.65)',
              margin: '10px 0 0', maxWidth: 320, marginLeft: 'auto', marginRight: 'auto',
            }}>Ingresa con tu cuenta corporativa para continuar.</p>
          </div>

          {error && (
            <div style={{
              marginBottom: 16, padding: '11px 14px',
              background: 'rgba(255,69,58,0.14)',
              border: '1px solid rgba(255,69,58,0.3)',
              borderRadius: 12, color: '#FF6B60', fontSize: 13,
              animation: 'fadeIn 220ms',
            }}>{error}</div>
          )}

          <form onSubmit={handleSubmit}>
            {/* Email */}
            <div style={{ marginBottom: 14 }}>
              <label style={labelStyle}>Correo electrónico</label>
              <div style={inputWrapStyle(emailFocus)}>
                <input type="email" value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onFocus={() => setEmailFocus(true)}
                  onBlur={() => setEmailFocus(false)}
                  style={inputStyle} placeholder="nombre@acteck.com"
                  autoComplete="email" required autoFocus />
              </div>
            </div>

            {/* Password */}
            <div style={{ marginBottom: 28 }}>
              <label style={labelStyle}>Contraseña</label>
              <div style={inputWrapStyle(passFocus)}>
                <input type={showPass ? "text" : "password"} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setPassFocus(true)}
                  onBlur={() => setPassFocus(false)}
                  style={{ ...inputStyle, paddingRight: 60 }} placeholder="••••••••"
                  autoComplete="current-password" required />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  style={{
                    position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
                    background: 'transparent', border: 'none', cursor: 'pointer',
                    color: 'rgba(245,245,247,0.5)', fontSize: 11, fontWeight: 500,
                    padding: '6px 10px', borderRadius: 8,
                    transition: 'color 160ms, background 160ms',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.color = '#F5F5F7'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(245,245,247,0.5)'; e.currentTarget.style.background = 'transparent'; }}>
                  {showPass ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>
            </div>

            {/* Submit */}
            <button type="submit" disabled={loading}
              style={{
                width: '100%', background: loading ? 'rgba(10,132,255,0.6)' : '#0A84FF',
                color: 'white', border: 'none',
                padding: '14px 24px', borderRadius: 999,
                fontSize: 15, fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
                fontFamily: 'inherit',
                transition: 'transform 120ms cubic-bezier(0.32, 0.72, 0, 1), background 200ms',
                boxShadow: '0 4px 20px rgba(10,132,255,0.35)',
              }}
              onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#409CFF')}
              onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#0A84FF')}
              onMouseDown={(e) => !loading && (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}>
              {loading ? 'Verificando…' : 'Continuar'}
            </button>
          </form>

          <div style={{
            textAlign: 'center', marginTop: 32, paddingTop: 20,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            <p style={{ fontSize: 12, color: 'rgba(245,245,247,0.45)', margin: 0 }}>
              ¿Problemas para entrar? Contacta al administrador.
            </p>
            <p style={{ fontSize: 11, color: 'rgba(245,245,247,0.3)', margin: '8px 0 0' }}>
              Dashboard v2.0 · 2026
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const labelStyle = {
  display: 'block', fontSize: 12.5, fontWeight: 500,
  color: 'rgba(245,245,247,0.7)', marginBottom: 8, letterSpacing: 0,
};
const inputStyle = {
  width: '100%', padding: '12px 14px',
  background: 'transparent', border: 'none',
  fontSize: 15, outline: 'none', fontFamily: 'inherit', color: '#F5F5F7',
};
const inputWrapStyle = (focus) => ({
  position: 'relative',
  background: focus ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)',
  border: `1px solid ${focus ? 'rgba(10,132,255,0.6)' : 'rgba(255,255,255,0.08)'}`,
  borderRadius: 12,
  transition: 'background 200ms, border-color 200ms, box-shadow 200ms',
  boxShadow: focus ? '0 0 0 4px rgba(10,132,255,0.12)' : 'none',
});
