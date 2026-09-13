// Sólo para las pruebas SSR: re-exporta React Query desde DENTRO del grafo de módulos de Vite,
// para que el provider sea la misma instancia que usan los hooks de la app.
// No lo importa ninguna pantalla.
export { QueryClient, QueryClientProvider } from '@tanstack/react-query';
