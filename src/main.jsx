import { StrictMode, Component } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// ErrorBoundary temporal para diagnosticar crashes en producción
class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { err: null, info: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  componentDidCatch(err, info) {
    this.setState({ info });
    console.error('[App crash]', err, info);
  }
  render() {
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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
