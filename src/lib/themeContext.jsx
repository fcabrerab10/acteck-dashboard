// ThemeContext — provee el tema visual actual a toda la app.
// Se hidrata desde perfiles.tema_ui al montar App.jsx.
import { createContext, useContext, useEffect, useState } from 'react';
import { getTheme, DEFAULT_THEME, applyThemeToRoot, THEME_MIGRATIONS } from './themeTokens';
import { supabase } from './supabase';

// Migra keys viejos (airy/puro/hibrida) a los nuevos (claro/midnight/marfil).
const migrate = (k) => THEME_MIGRATIONS[k] || k || DEFAULT_THEME;

export const ThemeContext = createContext({
  theme: getTheme(DEFAULT_THEME),
  setThemeKey: () => {},
});

export const useTheme = () => useContext(ThemeContext);

// ¿El sistema está en oscuro? (para themeKey === 'auto')
const sistemaOscuro = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-color-scheme: dark)').matches;

export function ThemeProvider({ perfil, children }) {
  const [themeKey, setThemeKey] = useState(migrate(perfil?.tema_ui));
  const [oscuroSistema, setOscuroSistema] = useState(sistemaOscuro);

  // Cuando cambia el perfil (login), sincroniza el tema (con migración)
  useEffect(() => {
    if (perfil?.tema_ui) setThemeKey(migrate(perfil.tema_ui));
  }, [perfil?.tema_ui]);

  // 'auto' = seguir prefers-color-scheme (claro ↔ midnight) y reaccionar si el sistema cambia.
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!mq?.addEventListener) return;
    const on = (e) => setOscuroSistema(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);

  const theme = getTheme(themeKey === 'auto' ? (oscuroSistema ? 'midnight' : 'claro') : themeKey);

  // Aplica tokens como CSS vars al <html>
  useEffect(() => { applyThemeToRoot(theme); }, [theme]);

  // Persiste cambio en Supabase
  const changeTheme = async (newKey) => {
    setThemeKey(newKey);
    if (perfil?.user_id) {
      const { error } = await supabase.from('perfiles').update({ tema_ui: newKey }).eq('user_id', perfil.user_id);
      if (error) console.warn('[tema] no se pudo persistir tema_ui:', error.message);
    }
  };

  // themeKey = clave elegida ('claro' | 'midnight' | 'marfil' | 'auto'); theme = tokens resueltos.
  return (
    <ThemeContext.Provider value={{ theme, themeKey, setThemeKey: changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
