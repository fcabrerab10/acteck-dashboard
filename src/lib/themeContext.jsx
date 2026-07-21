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

export function ThemeProvider({ perfil, children }) {
  const [themeKey, setThemeKey] = useState(migrate(perfil?.tema_ui));

  // Cuando cambia el perfil (login), sincroniza el tema (con migración)
  useEffect(() => {
    if (perfil?.tema_ui) setThemeKey(migrate(perfil.tema_ui));
  }, [perfil?.tema_ui]);

  const theme = getTheme(themeKey);

  // Aplica tokens como CSS vars al <html>
  useEffect(() => { applyThemeToRoot(theme); }, [theme]);

  // Persiste cambio en Supabase
  const changeTheme = async (newKey) => {
    setThemeKey(newKey);
    if (perfil?.user_id) {
      await supabase.from('perfiles').update({ tema_ui: newKey }).eq('user_id', perfil.user_id);
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setThemeKey: changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
