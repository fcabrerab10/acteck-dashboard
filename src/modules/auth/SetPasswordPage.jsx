// SetPasswordPage — Landing de invitación por email.
// El usuario aterriza con una sesión activa (Supabase magic link) y solo
// necesita elegir una contraseña. Al guardar, updateUser({ password }) y
// redirect a "/".
import React, { useState, useEffect } from "react";
import { supabase } from '../../lib/supabase';

const APPLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

function medidorFuerza(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p)) s++;
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 14) s++;
  return s; // 0..4
}

const FUERZA_LABEL = ['Muy débil', 'Débil', 'Aceptable', 'Fuerte', 'Excelente'];
const FUERZA_COLOR = ['#FF3B30', '#FF9500', '#FFCC00', '#34C759', '#0A84FF'];

export default function SetPasswordPage() {
  const [user, setUser] = useState(null);
  const [pwd, setPwd] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // Al entrar al link de invite, Supabase deja la sesión activa.
    // Si no hay sesión, mostramos error explicativo.
    supabase.auth.getUser().then(({ data, error }) => {
      if (error || !data?.user) {
        setError("Este link de invitación ya expiró o no es válido. Pídele a Fernando que te reenvíe la invitación.");
      } else {
        setUser(data.user);
      }
      setChecking(false);
    });
  }, []);

  const nombre = user?.user_metadata?.full_name || user?.email?.split('@')[0] || "colaborador";
  const iniciales = nombre.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
  const fuerza = medidorFuerza(pwd);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (pwd.length < 8) return setError("La contraseña debe tener al menos 8 caracteres.");
    if (pwd !== pwd2) return setError("Las contraseñas no coinciden.");
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: pwd });
      if (error) throw error;
      // Redirect al dashboard
      window.location.hash = '';
      window.location.reload();
    } catch (err) {
      setError(err.message || "No se pudo guardar la contraseña.");
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #F5F5F7 0%, #E8E8ED 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#FFFFFF', borderRadius: 20,
        padding: '36px 28px 28px',
        boxShadow: '0 20px 60px rgba(0,0,0,0.08), 0 1px 0 rgba(0,0,0,0.04)',
      }}>
        {/* Avatar iniciales */}
        <div style={{
          width: 60, height: 60, borderRadius: '50%',
          background: '#007AFF', color: '#FFF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: '"SF Pro Display", -apple-system, sans-serif',
          fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em',
          margin: '0 auto 18px',
        }}>{iniciales}</div>

        <h2 style={{
          fontFamily: '"SF Pro Display", -apple-system, sans-serif',
          fontSize: 24, fontWeight: 600, letterSpacing: '-0.025em',
          color: '#1D1D1F', textAlign: 'center', margin: 0,
        }}>
          {checking ? 'Cargando…' : (user ? `Bienvenido, ${nombre.split(' ')[0]}` : 'Sin acceso')}
        </h2>
        <p style={{
          fontSize: 14, color: '#6E6E73',
          textAlign: 'center', margin: '8px 0 24px', lineHeight: 1.5,
        }}>
          {user
            ? <>Elegí una contraseña para acceder al <strong>Dashboard de Acteck</strong>.</>
            : (error || 'Verificando invitación…')}
        </p>

        {user && (
          <form onSubmit={handleSubmit}>
            <div style={{ position: 'relative', marginBottom: 12 }}>
              <input
                type={showPwd ? 'text' : 'password'} value={pwd}
                onChange={e => setPwd(e.target.value)}
                placeholder="Nueva contraseña"
                autoFocus autoComplete="new-password"
                style={{
                  width: '100%', padding: '13px 60px 13px 14px',
                  background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.06)',
                  borderRadius: 12, fontSize: 15, outline: 'none',
                  fontFamily: 'inherit', color: '#1D1D1F',
                }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{
                  position: 'absolute', right: 8, top: 8, background: 'transparent',
                  border: 'none', color: '#6E6E73', fontSize: 12, fontWeight: 500,
                  padding: '6px 10px', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit',
                }}>{showPwd ? 'Ocultar' : 'Mostrar'}</button>
            </div>
            {/* Medidor de fuerza */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 6 }}>
              {[0,1,2,3].map(i => (
                <div key={i} style={{
                  flex: 1, height: 4, borderRadius: 2,
                  background: i < fuerza ? FUERZA_COLOR[Math.max(0, fuerza-1)] : 'rgba(0,0,0,0.08)',
                  transition: `background 200ms ${APPLE_EASE}`,
                }} />
              ))}
            </div>
            <p style={{ fontSize: 11, color: '#6E6E73', margin: '0 0 14px' }}>
              {pwd ? FUERZA_LABEL[fuerza] : 'Mínimo 8 caracteres.'}
            </p>

            <input
              type={showPwd ? 'text' : 'password'} value={pwd2}
              onChange={e => setPwd2(e.target.value)}
              placeholder="Confirmá la contraseña"
              autoComplete="new-password"
              style={{
                width: '100%', padding: '13px 14px', marginBottom: 16,
                background: '#F5F5F7', border: '1px solid rgba(0,0,0,0.06)',
                borderRadius: 12, fontSize: 15, outline: 'none',
                fontFamily: 'inherit', color: '#1D1D1F',
              }}
            />

            {error && (
              <div style={{
                marginBottom: 12, padding: '10px 12px',
                background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.18)',
                borderRadius: 10, color: '#D70015', fontSize: 12.5,
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading}
              style={{
                width: '100%', padding: '14px 20px',
                background: loading ? '#4DA3FF' : '#007AFF', color: '#FFF',
                border: 'none', borderRadius: 999, fontSize: 15, fontWeight: 500,
                cursor: loading ? 'wait' : 'pointer', fontFamily: 'inherit',
                transition: 'background 180ms ease',
              }}>
              {loading ? 'Guardando…' : 'Entrar al dashboard →'}
            </button>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              margin: '20px 0 14px',
            }}>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
              <span style={{ fontSize: 11, color: '#86868B', textTransform: 'uppercase', letterSpacing: '0.06em' }}>o</span>
              <div style={{ flex: 1, height: 1, background: 'rgba(0,0,0,0.08)' }} />
            </div>

            <button type="button"
              onClick={() => supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin } })}
              style={{
                width: '100%', padding: '12px 20px',
                background: '#FFF', color: '#1D1D1F',
                border: '1px solid rgba(0,0,0,0.12)', borderRadius: 999,
                fontSize: 14, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit',
              }}>
              Continuar con Google
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
