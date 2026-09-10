// Ferruteck · piezas retiradas de src/components/Topbar.jsx (V3, 2026-09-09).
// Contiene: la pastilla "Ferruteck" del Topbar (JSX), el CTA "Preguntarle a Ferruteck" del SearchDropdown,
// la notificación "Copilot Operaciones" (OCs listas para marcar como entregadas), detectarOutfit (modo Chivas),
// FerrutekGhost (SVG con outfits), CopilotOverlay (modal de chat simulado) y FerrutekStars.
// Estados que vivían en Topbar: copilotOpen, ferrutekBusy, ferrutekQuery; keyframes ferrutekBusyRing/Think/In.
// NO se importa desde ningún sitio. Para reactivar: volver a montar <CopilotOverlay/> y la pastilla en Topbar.

/* ── Pastilla Ferruteck (dentro del contenedor de la pill izquierda) ──
          {/* Copilot pill · hermana del pill de módulos */}
          <button
            onClick={() => setCopilotOpen(true)}
            title="Pídele ayuda a Ferruteck"
            style={{
              ...pillStyle,
              padding: '0 12px 0 10px', gap: 6, cursor: 'pointer',
              background: `
                radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%),
                radial-gradient(circle at 80% 70%, rgba(100,210,255,0.25) 0%, transparent 55%),
                linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
              border: '1px solid rgba(255,255,255,0.10)',
              color: '#FFF',
              boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
            }}
          >
            {/* Mini fantasmita en lugar del sparkle */}
            <span style={{ position: 'relative', display: 'inline-flex', width: 20, height: 20, alignItems: 'center', justifyContent: 'center' }}>
              <FerrutekGhost outfit={detectarOutfit()} size={20} />
              {ferrutekBusy && (
                <span aria-hidden style={{
                  position: 'absolute', inset: -3, borderRadius: 999,
                  border: `1.5px solid ${theme.accent}`,
                  animation: 'ferrutekBusyRing 1.4s cubic-bezier(0.4, 0, 0.2, 1) infinite',
                }} />
              )}
            </span>
            <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 11.5, fontWeight: 600, color: '#FFF', letterSpacing: '-0.005em' }}>Ferruteck</span>
            {ferrutekBusy && (
              <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center', marginLeft: 4 }}>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.accent, animation: 'ferrutekThink 1.2s ease-in-out infinite' }}/>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.accent, animation: 'ferrutekThink 1.2s ease-in-out 0.2s infinite' }}/>
                <span style={{ width: 3, height: 3, borderRadius: 999, background: theme.accent, animation: 'ferrutekThink 1.2s ease-in-out 0.4s infinite' }}/>
              </span>
            )}
          </button>

── Render del overlay (al final del fragment del Topbar) ──
      {copilotOpen && (
        <CopilotOverlay
          theme={theme} isMidnight={isMidnight}
          onClose={() => { setCopilotOpen(false); setFerrutekQuery(''); }}
          initialQuery={ferrutekQuery}
          onBusyChange={setFerrutekBusy}
        />
      )}

── CTA del SearchDropdown (recibía onAskFerruteck) ──
      {/* CTA: escalar a Ferruteck */}
      <div style={{ borderTop: `1px solid ${isMidnight ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`, padding: 6 }}>
        <button
          onClick={onAskFerruteck}
          style={{
            width: '100%', border: 0, cursor: 'pointer',
            padding: '10px 12px', borderRadius: 10,
            background: `
              radial-gradient(circle at 20% 30%, rgba(191,90,242,0.35) 0%, transparent 55%),
              radial-gradient(circle at 80% 70%, rgba(100,210,255,0.28) 0%, transparent 55%),
              linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
            display: 'flex', alignItems: 'center', gap: 12,
            color: '#FFF',
            boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
            transition: 'transform 180ms',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = 'none'; }}
        >
          <span style={{ display: 'inline-flex', width: 22, height: 22, flexShrink: 0 }}>
            <FerrutekGhost outfit={outfit} size={22} />
          </span>
          <span style={{ flex: 1, textAlign: 'left', minWidth: 0 }}>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, letterSpacing: '-0.005em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {q ? `Preguntarle a Ferruteck sobre "${q.length > 28 ? q.slice(0, 28) + '…' : q}"` : 'Pídele ayuda a Ferruteck'}
            </div>
            <div style={{ fontFamily: TYPO.fontText, fontSize: 10, color: 'rgba(255,255,255,0.55)', marginTop: 1 }}>
              {q ? 'Escala a tu asistente inteligente' : 'Resúmenes, comparativas, fútbol y más'}
            </div>
          </span>
          <span style={{
            fontFamily: '"SF Mono", ui-monospace, monospace', fontSize: 9,
            color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.10)',
            padding: '2px 6px', borderRadius: 5, flexShrink: 0,
          }}>⌘ ↵</span>
        </button>
      </div>

── Notificación Copilot (dentro del useEffect de notifs, sección "Copilot" del NotifPanel con severidad 'info') ──
      const listas = ocs.filter(oc => {
        const enviosDeEsta = enviosPorOc.get(oc.id) || [];
        if (enviosDeEsta.length === 0) return false;
        return enviosDeEsta.every(e => e.fecha_surtida) && enviosDeEsta.some(e => !e.fecha_entregada);
      });
      if (listas.length >= 2) {
        alertas.push({
          id: 'copilot-cerrar', severidad: 'info',
          titulo: `${listas.length} OCs listas para marcar como Entregadas`,
          subtitulo: 'Copilot Operaciones', navegarA: () => onNavegar(null, 'ordenesCompra'), tiempo: 'ahora',
        });
      }
*/

// ═══════════════ Ferruteck · Ghostie con outfits ═══════════════

// Detecta si hoy hay partido de Chivas (Guadalajara)
// TODO: reemplazar con API real de fixtures Liga MX
function detectarOutfit() {
  const d = new Date();
  const day = d.getDay(); // 0=dom, 5=vie, 6=sab
  if (day === 5 || day === 6 || day === 0) return 'chivas'; // vie/sab/dom = modo Chivas
  return 'default';
}

// SVG del Ferruteck fantasmita — con outfits variables
function FerrutekGhost({ outfit = 'default', size = 140 }) {
  const chivas = outfit === 'chivas';
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="ferrutekBody" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF"/>
          <stop offset="40%" stopColor="#D0A8F0"/>
          <stop offset="100%" stopColor="#AF52DE"/>
        </radialGradient>
        <filter id="ferrutekGlow"><feGaussianBlur stdDeviation="3"/></filter>
        <clipPath id="ferrutekBodyClip">
          <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"/>
        </clipPath>
      </defs>
      {/* Glow externo — más rojo si Chivas */}
      <ellipse cx="70" cy="75" rx="52" ry="60"
        fill={chivas ? '#EF4444' : '#AF52DE'} opacity="0.3" filter="url(#ferrutekGlow)"/>
      {/* Cuerpo con colita ondulada */}
      <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z"
        fill="url(#ferrutekBody)" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>

      {/* JERSEY DE CHIVAS — rayas verticales rojas + blancas */}
      {chivas && (
        <g clipPath="url(#ferrutekBodyClip)">
          {/* Fondo blanco */}
          <rect x="25" y="72" width="90" height="35" fill="#FFF" opacity="0.95"/>
          {/* Rayas verticales rojas */}
          <rect x="30" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="50" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="70" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="90" y="72" width="10" height="35" fill="#DC2626"/>
          <rect x="110" y="72" width="10" height="35" fill="#DC2626"/>
          {/* Cuello del jersey */}
          <path d="M 60 72 Q 70 78 80 72 L 80 74 Q 70 80 60 74 Z" fill="#1a1a2e"/>
          {/* "C" de Chivas en el pecho */}
          <text x="70" y="93" textAnchor="middle" fontFamily="'SF Pro Display', sans-serif" fontSize="11" fontWeight="800" fill="#FFF" stroke="#1a1a2e" strokeWidth="0.3">C</text>
        </g>
      )}

      {/* Cachetitos */}
      <ellipse cx="45" cy="65" rx="8" ry="5" fill="#FFB4E0" opacity="0.6"/>
      <ellipse cx="95" cy="65" rx="8" ry="5" fill="#FFB4E0" opacity="0.6"/>
      {/* Ojo izq */}
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e"/>
      <ellipse cx="54" cy="47" rx="3" ry="4" fill="#FFF"/>
      <circle cx="55.5" cy="46" r="1" fill="#FFF"/>
      {/* Ojo der */}
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e"/>
      <ellipse cx="90" cy="47" rx="3" ry="4" fill="#FFF"/>
      <circle cx="91.5" cy="46" r="1" fill="#FFF"/>
      {/* Sonrisita */}
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round"/>
    </svg>
  );
}

function CopilotOverlay({ theme, isMidnight, onClose, initialQuery = '', onBusyChange }) {
  const [msg, setMsg] = useState(initialQuery);
  const [thinking, setThinking] = useState(false);
  const [outfit] = useState(detectarOutfit);
  const chivasDay = outfit === 'chivas';

  const enviar = () => {
    if (!msg.trim() || thinking) return;
    setThinking(true);
    onBusyChange?.(true);
    // Simula procesamiento — cuando conectemos IA, reemplazar por await
    setTimeout(() => {
      setThinking(false);
      onBusyChange?.(false);
    }, 2400);
  };

  const suggestions = [
    { ico: '⚡', txt: 'Oye Ferruteck, ¿qué OCs están más atrasadas?' },
    { ico: '📊', txt: 'Dame el fill del mes por cliente' },
    { ico: '🏢', txt: 'Ferruteck, hazme un resumen de Digitalife' },
    { ico: '🏢', txt: 'Y ahora uno de PCEL' },
    { ico: '⏱', txt: '¿Cuánto tardamos de recibir a entregar?' },
    chivasDay
      ? { ico: '⚽', txt: '¿Cómo van las Chivas hoy?' }
      : { ico: '⚽', txt: 'Ferruteck, ¿qué resultado tuvieron las Chivas?' },
  ];

  const saludo = chivasDay
    ? <>¡Arriba las Chivas, mi <em>Ferru</em>! 🔴⚪ Tienes <strong>18 OCs abiertas</strong> y fill del mes en <strong>92.4%</strong>. ¿Vemos algo antes del partido?</>
    : <>Todo bajo control, <em>Ferru</em>. Tienes <strong>18 OCs abiertas</strong> y fill del mes en <strong>92.4%</strong>. ¿En qué te ayudo?</>;

  return (
    <div onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.55)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '6vh', paddingLeft: 16, paddingRight: 16,
      }}
    >
      <div onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 22,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          padding: '28px 24px 24px', fontFamily: TYPO.fontText,
          position: 'relative', overflow: 'hidden',
          color: '#EDEDF0',
          animation: 'ferrutekIn 400ms cubic-bezier(0.34, 1.56, 0.64, 1) both',
        }}
      >
        {/* Nebulosa + estrellas fondo */}
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          background:
            'radial-gradient(circle at 20% 30%, rgba(191,90,242,0.18) 0%, transparent 50%),' +
            'radial-gradient(circle at 80% 70%, rgba(100,210,255,0.14) 0%, transparent 50%)',
        }}/>
        <FerrutekStars />

        {/* Close */}
        <button onClick={onClose} style={{
          position: 'absolute', top: 14, right: 14, zIndex: 5,
          width: 28, height: 28, borderRadius: 999, border: 0,
          background: 'rgba(255,255,255,0.08)', color: '#FFF', cursor: 'pointer',
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(10px)',
        }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.16)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
        ><X size={13} /></button>

        {/* Header */}
        <div style={{ textAlign: 'center', position: 'relative', zIndex: 2, marginBottom: 6 }}>
          <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#FFF' }}>
            Hola, soy{' '}
            <span style={{
              background: chivasDay
                ? 'linear-gradient(135deg, #EF4444, #FBBF24)'
                : 'linear-gradient(135deg, #BF5AF2, #64D2FF)',
              WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
              backgroundClip: 'text', fontWeight: 700,
            }}>Ferruteck</span>{' '}
            <span style={{ display: 'inline-block' }}>{chivasDay ? '🐐' : '👋'}</span>
          </div>
          <div style={{ fontFamily: TYPO.fontText, fontSize: 11.5, color: 'rgba(237,237,240,0.55)', marginTop: 3 }}>
            {chivasDay ? 'Modo Chivas · listos para el partido' : 'Tu asistente fantasmita · dime en qué te ayudo'}
          </div>
        </div>

        {/* Fantasmita bobbing */}
        <div style={{
          position: 'relative', zIndex: 2, alignSelf: 'center',
          margin: '18px auto 16px', width: 'fit-content',
          animation: 'ferrutekBob 3s ease-in-out infinite',
        }}>
          <FerrutekGhost outfit={outfit} size={130} />
          {/* Sombra */}
          <div style={{
            position: 'absolute', bottom: -14, left: '50%',
            transform: 'translateX(-50%)', width: 78, height: 12,
            background: 'radial-gradient(ellipse, rgba(0,0,0,0.55), transparent 70%)',
            borderRadius: '50%',
            animation: 'ferrutekShadow 3s ease-in-out infinite',
          }}/>
        </div>

        {/* Speech bubble */}
        <div style={{
          position: 'relative', zIndex: 2, alignSelf: 'center', margin: '0 auto 16px', width: 'fit-content',
          maxWidth: 420,
          background: 'rgba(255,255,255,0.08)',
          border: '1px solid rgba(255,255,255,0.14)',
          padding: '10px 16px', borderRadius: 18, borderBottomLeftRadius: 4,
          fontFamily: TYPO.fontText, fontSize: 13, color: '#FFF', backdropFilter: 'blur(10px)',
          animation: 'ferrutekSpeech 500ms cubic-bezier(0.34, 1.56, 0.64, 1) 200ms both',
        }}>
          {saludo}
        </div>

        {/* Sugerencias */}
        <div style={{ position: 'relative', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 12 }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => setMsg(s.txt)}
              style={{
                width: '100%', textAlign: 'left', border: '1px solid rgba(255,255,255,0.10)',
                background: 'rgba(255,255,255,0.05)', cursor: 'pointer',
                padding: '9px 14px', borderRadius: 11,
                fontFamily: TYPO.fontText, fontSize: 12.5, color: 'rgba(237,237,240,0.92)',
                display: 'flex', alignItems: 'center', gap: 10,
                backdropFilter: 'blur(10px)', transition: 'all 200ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = chivasDay ? 'rgba(239,68,68,0.14)' : 'rgba(191,90,242,0.14)';
                e.currentTarget.style.borderColor = chivasDay ? 'rgba(239,68,68,0.35)' : 'rgba(191,90,242,0.35)';
                e.currentTarget.style.transform = 'translateX(4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)';
                e.currentTarget.style.transform = 'translateX(0)';
              }}
            >
              <span style={{ fontSize: 13, flexShrink: 0 }}>{s.ico}</span>
              <span style={{ flex: 1 }}>{s.txt}</span>
            </button>
          ))}
        </div>

        {/* Input */}
        <div style={{
          position: 'relative', zIndex: 2,
          background: 'rgba(255,255,255,0.06)',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 999,
          padding: '7px 7px 7px 18px',
          display: 'flex', alignItems: 'center', gap: 10,
          backdropFilter: 'blur(20px)',
        }}>
          <input
            autoFocus
            value={msg}
            onChange={(e) => setMsg(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') enviar(); }}
            placeholder={thinking ? 'Ferruteck está pensando…' : 'Oye Ferruteck, ¿qué…?'}
            disabled={thinking}
            style={{
              flex: 1, border: 0, background: 'transparent', outline: 'none',
              fontFamily: TYPO.fontText, fontSize: 13.5, color: '#FFF',
              opacity: thinking ? 0.6 : 1,
            }}
          />
          {thinking && (
            <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', paddingRight: 4 }}>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: '#BF5AF2', animation: 'ferrutekThink 1.2s ease-in-out infinite' }}/>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: '#BF5AF2', animation: 'ferrutekThink 1.2s ease-in-out 0.2s infinite' }}/>
              <span style={{ width: 4, height: 4, borderRadius: 999, background: '#BF5AF2', animation: 'ferrutekThink 1.2s ease-in-out 0.4s infinite' }}/>
            </span>
          )}
          <button
            onClick={enviar}
            disabled={!msg.trim() || thinking}
            style={{
              width: 32, height: 32, borderRadius: 999, border: 0, cursor: (!msg.trim() || thinking) ? 'default' : 'pointer',
              background: (msg.trim() && !thinking)
                ? (chivasDay ? 'linear-gradient(135deg, #EF4444, #FBBF24)' : 'linear-gradient(135deg, #AF52DE, #64D2FF)')
                : 'rgba(255,255,255,0.10)',
              color: '#FFF', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: (msg.trim() && !thinking) ? '0 4px 12px rgba(175,82,222,0.4)' : 'none',
              transition: 'background 200ms',
            }}>
            <Send size={13} />
          </button>
        </div>

        <div style={{
          position: 'relative', zIndex: 2, marginTop: 12,
          fontFamily: TYPO.fontText, fontSize: 10.5, color: 'rgba(237,237,240,0.4)', textAlign: 'center',
        }}>
          El Ferruteck todavía está calentando motores · pronto responde en vivo
        </div>

        <style>{`
          @keyframes ferrutekIn { from { opacity: 0; transform: translateY(20px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes ferrutekBob { 0%,100% { transform: translateY(0) rotate(-2deg); } 50% { transform: translateY(-12px) rotate(2deg); } }
          @keyframes ferrutekShadow { 0%,100% { width: 78px; opacity: 0.5; } 50% { width: 58px; opacity: 0.3; } }
          @keyframes ferrutekSpeech { from { opacity: 0; transform: translateY(6px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }
          @keyframes ferrutekTwinkle { 0%,100% { opacity: 0.3; transform: scale(0.8); } 50% { opacity: 1; transform: scale(1.4); } }
          @keyframes ferrutekThink { 0%,80%,100% { opacity: 0.3; transform: scale(0.8); } 40% { opacity: 1; transform: scale(1.2); } }
        `}</style>
      </div>
    </div>
  );
}

function FerrutekStars() {
  const stars = [
    { top: '10%', left: '15%', d: 0 }, { top: '25%', left: '80%', d: 0.4 },
    { top: '40%', left: '45%', d: 0.8 }, { top: '60%', left: '20%', d: 1.2 },
    { top: '75%', left: '70%', d: 1.6 }, { top: '15%', left: '55%', d: 2.0 },
    { top: '50%', left: '90%', d: 2.4 }, { top: '80%', left: '40%', d: 2.8 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 6px rgba(255,255,255,0.8)',
          animation: `ferrutekTwinkle 3s ease-in-out ${s.d}s infinite`,
        }}/>
      ))}
    </div>
  );
}
