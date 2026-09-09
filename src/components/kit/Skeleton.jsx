// Skeleton con brillo 1.3 s · sustituye al loader central cuando la estructura ya se conoce.
import React from 'react';
import { useTheme } from '../../lib/themeContext';

export default function Skeleton({ w = '100%', h = 12, r = 6, style }) {
  const { theme } = useTheme();
  const dark = theme.mode === 'dark';
  const a = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', b = dark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  return (
    <>
      <style>{`@keyframes kitShimmer{to{background-position:-200% 0}}`}</style>
      <span style={{ display: 'block', width: w, height: h, borderRadius: r, background: `linear-gradient(90deg, ${a} 25%, ${b} 50%, ${a} 75%)`, backgroundSize: '200% 100%', animation: 'kitShimmer 1.3s linear infinite', ...style }} />
    </>
  );
}

export function SkeletonPantalla() {
  const { theme } = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <Skeleton h={88} r={12} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 8 }}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={82} r={12} />)}</div>
      <div style={{ background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[60, 85, 70, 90, 55].map((w, i) => <Skeleton key={i} w={`${w}%`} h={11} />)}
      </div>
    </div>
  );
}
