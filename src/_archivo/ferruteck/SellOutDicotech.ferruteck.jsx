// Archivo: retirado de src/modules/comercial/SellOutDicotech.jsx (2026-09-09) al quitar Ferruteck del dashboard.
// Contiene el useMemo `copilotRecos` (referencia) y los componentes de la tira de recomendaciones. No se importa desde ningún sitio.

  // Ferruteck recos
  const copilotRecos = useMemo(() => {
    const out = [];
    // Top sucursal online creciente
    const topOnl = sucursalesYTD.filter(s => s.tipo === 'online' && (s.momPct || 0) >= 10).sort((a, b) => (b.momPct || 0) - (a.momPct || 0))[0];
    if (topOnl) {
      out.push({ icon: '🚀', t: `${topOnl.label} +${topOnl.momPct.toFixed(0)}% MoM`, s: `${fmt.money(topOnl.monto)} YTD · canal online en aceleración` });
    }
    // Ticket subiendo
    if (kpis.ticketMomPct != null && kpis.ticketMomPct >= 5) {
      out.push({ icon: '📈', t: `Ticket sube ${kpis.ticketMomPct.toFixed(0)}% en ${MESES[mesActual - 1]}`, s: `${fmt.moneyFull(kpis.ticketMtd)} vs ${fmt.moneyFull(kpis.ticketPrev)} · mix premium jala` });
    }
    // Sucursal en caída
    const sucCae = sucursalesYTD.filter(s => s.momPct != null && s.momPct < -2).sort((a, b) => (a.momPct || 0) - (b.momPct || 0))[0];
    if (sucCae) {
      out.push({ icon: '⚠️', t: `${sucCae.label} ${sucCae.momPct.toFixed(0)}% MoM`, s: 'Revisa piso / precio / rotación' });
    }
    // Sucursal top absoluta si no hemos usado otra reco similar
    if (out.length < 3 && sucursalesYTD[0]) {
      const s = sucursalesYTD[0];
      out.push({ icon: '🏆', t: `${s.label} lidera con ${fmt.money(s.monto)}`, s: `${fmt.int(s.tx)} tx · ${fmt.int(s.clientes)} clientes` });
    }
    return out.slice(0, 3);
  }, [sucursalesYTD, kpis, mesActual]);

// ═══════════════ Ferruteck Strip ═══════════════
function FerruteckStrip({ recos }) {
  if (!recos || recos.length === 0) return null;
  return (
    <div style={{
      borderRadius: 12, padding: '12px 16px', color: '#FFF',
      background: `radial-gradient(120% 130% at 20% 30%, rgba(191,90,242,0.35), transparent 50%),
                   radial-gradient(120% 130% at 90% 90%, rgba(100,210,255,0.28), transparent 55%),
                   linear-gradient(180deg,#0F0B24 0%,#1A0F3E 100%)`,
      display: 'grid', gridTemplateColumns: `auto ${recos.map(() => '1fr').join(' ')}`, gap: 16, alignItems: 'center',
    }}>
      <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 9.5, textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(255,255,255,0.75)', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
        <Sparkles size={12} /> Ferruteck
      </span>
      {recos.map((r, i) => (
        <div key={i} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 10, alignItems: 'center' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'rgba(255,255,255,0.10)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>{r.icon}</div>
          <div>
            <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 12, fontWeight: 600, color: '#FFF', lineHeight: 1.15 }}>{r.t}</div>
            <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.65)' }}>{r.s}</div>
          </div>
        </div>
      ))}
    </div>
  );
}
