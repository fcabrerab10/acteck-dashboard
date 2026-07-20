// LoginPage — estilo Apple.com. Sin dependencia de ThemeContext porque aún no
// hay perfil (default Airy). Fondo gris muy claro, card blanca centrada, tipografía
// SF Pro Display grande.
import React, { useState } from "react";
import { supabase } from '../../lib/supabase';

export default function LoginPage({ onLogin }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

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
      setError(err.message || "Error al iniciar sesión");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#F5F5F7',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", sans-serif',
      WebkitFontSmoothing: 'antialiased',
    }}>
      <div style={{
        background: 'white', borderRadius: 22, padding: '48px 40px',
        width: '100%', maxWidth: 440,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04), 0 4px 20px rgba(0,0,0,0.06)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#6E6E73', marginBottom: 6 }}>
            Balam Rush
          </div>
          <h1 style={{
            fontFamily: '-apple-system, "SF Pro Display", sans-serif',
            fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em',
            color: '#1D1D1F', margin: 0, lineHeight: 1.1,
          }}>Dashboard Acteck.</h1>
          <p style={{
            fontSize: 15, color: '#6E6E73', margin: '10px 0 0',
          }}>Ingresa con tu cuenta corporativa.</p>
        </div>

        {error && (
          <div style={{
            marginBottom: 16, padding: '12px 14px',
            background: 'rgba(255,59,48,0.08)',
            border: '1px solid rgba(255,59,48,0.2)',
            borderRadius: 12, color: '#B00020', fontSize: 13,
          }}>{error}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>Correo electrónico</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              style={inputStyle} placeholder="usuario@acteck.com"
              autoComplete="email" required autoFocus />
          </div>
          <div style={{ marginBottom: 24 }}>
            <label style={labelStyle}>Contraseña</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              style={inputStyle} placeholder="••••••••"
              autoComplete="current-password" required />
          </div>
          <button type="submit" disabled={loading}
            style={{
              width: '100%', background: loading ? '#4DA3FF' : '#0071E3',
              color: 'white', border: 'none',
              padding: '13px 24px', borderRadius: 999,
              fontSize: 15, fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
              fontFamily: 'inherit',
              transition: 'background 200ms',
            }}
            onMouseEnter={(e) => !loading && (e.currentTarget.style.background = '#0077ED')}
            onMouseLeave={(e) => !loading && (e.currentTarget.style.background = '#0071E3')}>
            {loading ? "Verificando…" : "Entrar"}
          </button>
        </form>

        <div style={{
          textAlign: 'center', marginTop: 28, paddingTop: 20,
          borderTop: '1px solid rgba(0,0,0,0.06)',
        }}>
          <p style={{ fontSize: 12, color: '#86868B', margin: 0 }}>
            ¿Olvidaste tu contraseña? Contacta al administrador.
          </p>
          <p style={{ fontSize: 11, color: '#C7C7CC', margin: '6px 0 0' }}>v2.0 · 2026</p>
        </div>
      </div>
    </div>
  );
}

const labelStyle = {
  display: 'block', fontSize: 13, fontWeight: 500,
  color: '#1D1D1F', marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '12px 14px', borderRadius: 12,
  border: '1px solid rgba(0,0,0,0.1)', fontSize: 14,
  outline: 'none', fontFamily: 'inherit', color: '#1D1D1F',
  background: '#FBFBFD',
  transition: 'border-color 160ms, background 160ms',
};
