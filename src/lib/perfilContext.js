import { createContext, useContext } from 'react';

/**
 * Contexto global del perfil autenticado.
 * Cualquier componente puede leerlo con usePerfil().
 */
export const PerfilContext = createContext(null);

export const usePerfil = () => useContext(PerfilContext);
