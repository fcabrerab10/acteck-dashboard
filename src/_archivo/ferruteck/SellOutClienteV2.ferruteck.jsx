// Archivo: retirado de src/modules/comercial/SellOutClienteV2.jsx (2026-09-09) al quitar Ferruteck del dashboard.
// Contiene el useMemo `copilotRecos` (referencia) y los componentes de la tira de recomendaciones. No se importa desde ningún sitio.

  // Ferruteck recomendaciones
  const copilotRecos = useMemo(() => {
    const out = [];
    if (familiasInvYTD[0]) {
      const f = familiasInvYTD[0];
      out.push({ icon: '🏆', t: `${f.name} concentra ${fmt.money(f.valor)} de inventario`, s: `${fmt.int(f.stock)} pzs · ${f.skus} SKUs` });
    }
    let sinRotacion = 0;
    for (const [sku, inv] of inventarioMap) {
      if (inv.stock > 0 && (inv.dias_sin_venta || 0) > 90) sinRotacion++;
    }
    if (sinRotacion > 0) {
      out.push({ icon: '⚠️', t: `${sinRotacion} SKUs sin sell out >90 días`, s: 'Inventario parado · revisa precio o rotación' });
    }
    if (marcaYTD[0] && marcaYTD[0].yoy != null) {
      const m = marcaYTD[0];
      const yoyStr = `${m.yoy >= 0 ? '+' : ''}${m.yoy.toFixed(0)}%`;
      out.push({ icon: m.yoy >= 0 ? '🔥' : '📉', t: `${m.name} ${yoyStr} YoY`, s: `Marca principal · ${fmt.money(m.monto)}` });
    }
    return out.slice(0, 3);
  }, [familiasInvYTD, inventarioMap, marcaYTD]);

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
