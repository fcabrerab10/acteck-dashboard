// Archivo: retirado de src/modules/comercial/SellInClienteV2.jsx (2026-09-09) al quitar Ferruteck del dashboard.
// Contiene el useMemo `copilotRecos` (referencia) y los componentes de la tira de recomendaciones. No se importa desde ningún sitio.

  // Copilot recos
  const copilotRecos = useMemo(() => {
    const arr = [];
    if (pctMTD != null && pctMTD >= 100) {
      arr.push({ sev: 'info', title: `Arriba de cuota · +${(pctMTD - 100).toFixed(1)}%`, sub: 'Considera subir meta trimestral' });
    } else if (pctMTD != null && pctMTD < 85) {
      const cuotaIdeal = mesActualData.cuota?.ideal || 0;
      const falta = cuotaIdeal - (mesActualData.monto || 0);
      arr.push({ sev: 'warn', title: `MTD al ${Math.round(pctMTD)}% de cuota`, sub: `Faltan ${fmt.money(falta)} para meta del mes` });
    }
    // Top familia crecimiento
    if (familiasYTD.length > 0) {
      arr.push({ sev: 'info', title: `${familiasYTD[0].name} lidera con ${fmt.money(familiasYTD[0].monto)}`, sub: `${familiasYTD[0].skus} SKUs · ${fmt.int(familiasYTD[0].piezas)}pz` });
    }
    // SKUs sin sell out (con SI pero SO = 0)
    const sinSO = filasSKU.filter((r) => r.montoSI > 0 && r.montoSO === 0);
    if (sinSO.length >= 3) {
      arr.push({ sev: 'urgente', title: `${sinSO.length} SKUs no rotaron`, sub: 'Sell In sin Sell Out · revisa precio o rotación' });
    }
    return arr.slice(0, 3);
  }, [pctMTD, mesActualData, familiasYTD, filasSKU]);

// ═══════════════ Ferruteck cosmic strip ═══════════════
function FerruMini({ size = 14 }) {
  return (
    <svg width={size} height={size * 1.07} viewBox="0 0 140 150">
      <defs>
        <radialGradient id="fSellInMini" cx="35%" cy="30%">
          <stop offset="0%" stopColor="#F5E6FF" />
          <stop offset="100%" stopColor="#AF52DE" />
        </radialGradient>
      </defs>
      <path d="M 25 40 Q 25 15 70 15 Q 115 15 115 40 L 115 100 Q 115 105 110 105 Q 105 100 100 105 Q 95 110 90 105 Q 85 100 80 105 Q 75 110 70 105 Q 65 100 60 105 Q 55 110 50 105 Q 45 100 40 105 Q 35 110 30 105 Q 25 100 25 95 Z" fill="url(#fSellInMini)" />
      <ellipse cx="52" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <ellipse cx="88" cy="50" rx="7" ry="9" fill="#1a1a2e" />
      <path d="M 60 72 Q 70 80 80 72" stroke="#1a1a2e" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function FerruteckStrip({ recos }) {
  if (recos.length === 0) return null;
  return (
    <div style={{
      borderRadius: 12, padding: '12px 16px',
      background: `
        radial-gradient(circle at 15% 40%, rgba(191,90,242,0.30) 0%, transparent 50%),
        radial-gradient(circle at 85% 60%, rgba(100,210,255,0.22) 0%, transparent 50%),
        linear-gradient(180deg, #1e1e2e 0%, #0d0d19 100%)`,
      color: '#FFF', border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 2px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
      position: 'relative', overflow: 'hidden',
      display: 'grid', gridTemplateColumns: `auto ${recos.map(() => '1fr').join(' ')}`, gap: 16, alignItems: 'center',
    }}>
      <FerruStars />
      <span style={{
        padding: '4px 10px 4px 8px', borderRadius: 999, background: 'rgba(255,255,255,0.10)',
        border: '1px solid rgba(191,90,242,0.3)', fontFamily: TYPO.fontDisplay, fontSize: 10, fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', display: 'inline-flex', alignItems: 'center', gap: 6, zIndex: 1,
      }}>
        <FerruMini size={14} />
        Ferruteck
      </span>
      {recos.map((r, i) => (
        <FerruReco key={i} r={r} first={i === 0} />
      ))}
    </div>
  );
}

function FerruReco({ r, first }) {
  const bg = r.sev === 'urgente' ? '#FF453A' : r.sev === 'warn' ? '#FF9F0A' : '#64D2FF';
  const iconColor = r.sev === 'info' ? '#000' : '#FFF';
  const Icon = r.sev === 'urgente' ? AlertTriangle : r.sev === 'warn' ? Clock : TrendingUp;
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '6px 12px',
      borderLeft: first ? 'none' : '1px solid rgba(255,255,255,0.10)',
      cursor: 'pointer', zIndex: 1, minWidth: 0,
    }}>
      <span style={{ width: 26, height: 26, borderRadius: 6, background: bg, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: iconColor, flexShrink: 0 }}>
        <Icon size={14} strokeWidth={2.4} />
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 11, fontWeight: 600, color: '#FFF', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</div>
        <div style={{ fontFamily: TYPO.fontText, fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{r.sub}</div>
      </div>
    </div>
  );
}

function FerruStars() {
  const stars = [
    { top: '20%', left: '10%', d: 0 }, { top: '60%', left: '25%', d: 0.5 },
    { top: '30%', left: '55%', d: 1 }, { top: '75%', left: '75%', d: 1.5 },
    { top: '15%', left: '85%', d: 2 },
  ];
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <style>{`@keyframes fSellInTwinkle { 0%,100% { opacity:0.35; transform:scale(0.8); } 50% { opacity:1; transform:scale(1.3); } }`}</style>
      {stars.map((s, i) => (
        <span key={i} style={{
          position: 'absolute', top: s.top, left: s.left,
          width: 2, height: 2, borderRadius: 999, background: '#FFF',
          boxShadow: '0 0 6px rgba(255,255,255,0.7)',
          animation: `fSellInTwinkle 3s ease-in-out ${s.d}s infinite`,
        }} />
      ))}
    </div>
  );
}
