import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { queryClient, createIDBPersister } from './lib/queryClient'
import { BUILD_ID } from './lib/version'
import { toast } from './components/kit/Toast'

// Aviso de versión nueva (V3). El SW se registra en modo 'prompt' (vite.config.js):
// cuando Vercel publica un build nuevo, onNeedRefresh muestra un toast persistente
// y "Recargar" activa el SW nuevo y recarga. Sin esto el usuario seguiría con el
// bundle viejo hasta cerrar todas las pestañas.
const updateSW = registerSW({
  onNeedRefresh() {
    toast.info('Hay una versión nueva del dashboard', { accion: 'Recargar', onAccion: () => updateSW(true), ms: 0 })
  },
  onOfflineReady() {
    toast.ok('El dashboard ya funciona sin conexión')
  },
})

// ── Versión vieja en el navegador ──
// Vercel no conserva los assets de deploys anteriores: si alguien tiene la app abierta con la versión
// vieja y entra a una pestaña que aún no había cargado, el chunk da 404 y React tira "Se rompió algo".
// Aquí se detecta ese caso (vite:preloadError o error de import dinámico) y, en vez del error, se
// activa el SW nuevo y se recarga. Guardia de 60 s en sessionStorage para no entrar en bucle.
const esErrorDeVersion = (err) => /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically|Failed to fetch/i.test(String(err?.message || err || ''));
let recuperando = false;
async function recuperarVersion() {
  if (recuperando) return;
  recuperando = true;
  const k = 'acteck_recarga_version';
  let ultimo = 0;
  try { ultimo = Number(sessionStorage.getItem(k) || 0); } catch { /* sin storage */ }
  if (Date.now() - ultimo < 60_000) { recuperando = false; return; } // ya lo intentamos hace nada: que se vea el error
  try { sessionStorage.setItem(k, String(Date.now())); } catch { /* sin storage */ }
  try { const reg = await navigator.serviceWorker?.getRegistration(); await reg?.update(); } catch { /* sin SW */ }
  try { await updateSW(true); } catch { /* sin SW nuevo esperando */ }
  setTimeout(() => window.location.reload(), 1200);
}
window.addEventListener('vite:preloadError', (e) => { e.preventDefault(); recuperarVersion(); });

// ErrorBoundary temporal para diagnosticar crashes en producción
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null, info: null, actualizando: false }; }
  static getDerivedStateFromError(err) { return { err, actualizando: esErrorDeVersion(err) }; }
  componentDidCatch(err, info) {
    this.setState({ info });
    console.error('[App crash]', err, info);
    if (esErrorDeVersion(err)) recuperarVersion();
  }
  render() {
    if (this.state.err && this.state.actualizando) {
      return (
        <div style={{ padding: 40, fontFamily: '-apple-system, sans-serif', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: '#6E6E73' }}>
          <div style={{ fontSize: 17, fontWeight: 600, color: '#1D1D1F' }}>Actualizando el dashboard…</div>
          <div style={{ fontSize: 13 }}>Hay una versión nueva. Se recarga sola en un momento.</div>
          <button onClick={() => window.location.reload()} style={{ marginTop: 10, padding: '8px 18px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>Recargar ahora</button>
        </div>
      );
    }
    if (this.state.err) {
      return (
        <div style={{ padding: 40, fontFamily: '-apple-system, sans-serif', background: '#FFF5F5', minHeight: '100vh' }}>
          <h1 style={{ color: '#B00020', fontSize: 24, marginBottom: 12 }}>Se rompió algo en el dashboard</h1>
          <p style={{ color: '#6E6E73', marginBottom: 16 }}>Manda esta info a Fernando para que lo arregle:</p>
          <pre style={{ background: 'white', padding: 16, borderRadius: 12, fontSize: 13, overflow: 'auto', color: '#1D1D1F', border: '1px solid rgba(0,0,0,0.08)' }}>
{String(this.state.err?.message || this.state.err)}

{this.state.err?.stack?.slice(0, 500)}

Component:
{this.state.info?.componentStack?.slice(0, 400)}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: '10px 20px', background: '#0071E3', color: 'white', border: 'none', borderRadius: 999, cursor: 'pointer', fontSize: 14, fontWeight: 500 }}>
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const persister = createIDBPersister();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 7 * 24 * 60 * 60 * 1000, // 1 semana
          buster: BUILD_ID,                 // invalida cache al cambiar versión/commit
          dehydrateOptions: {
            // No persistir queries que están fallando
            shouldDehydrateQuery: (q) => q.state.status === 'success',
          },
        }}
      >
        <App />
        {import.meta.env.DEV && <ReactQueryDevtools initialIsOpen={false} />}
      </PersistQueryClientProvider>
    </ErrorBoundary>
  </StrictMode>,
)
