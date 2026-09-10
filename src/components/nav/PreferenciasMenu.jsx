// Tarjeta "Menú" para Configuración: modo (Barra / Sidebar / iPhone), densidad y pestaña al entrar.
// Usa el kit (Panel + Segmented) y las preferencias del usuario (perfiles.preferencias).
import React from 'react';
import { PanelTop, LayoutPanelLeft, Smartphone } from 'lucide-react';
import { useTheme } from '../../lib/themeContext';
import { TYPO } from '../../lib/themeTokens';
import { Panel, Segmented } from '../kit';
import { usePreferencias, MODOS_MENU } from '../../lib/preferencias';

const ICONO = { barra: PanelTop, sidebar: LayoutPanelLeft, iphone: Smartphone };

export default function PreferenciasMenu({ style }) {
  const { theme } = useTheme();
  const { menu, setPreferencia, favoritos } = usePreferencias();
  const dark = theme.mode === 'dark';

  const Fila = ({ titulo, desc, children }) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '10px 0', borderTop: `1px solid ${theme.border}` }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: TYPO.fontDisplay, fontSize: 13, fontWeight: 600, color: theme.text, letterSpacing: '-0.01em' }}>{titulo}</div>
        {desc && <div style={{ fontSize: 11.5, color: theme.textMuted, marginTop: 2 }}>{desc}</div>}
      </div>
      {children}
    </div>
  );

  return (
    <Panel titulo="Menú" meta="Cómo navegas el dashboard · se guarda en tu perfil" style={{ marginBottom: 24, ...style }}>
      {/* Modo · tres tarjetas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, paddingBottom: 12 }}>
        {MODOS_MENU.map((m) => {
          const Icon = ICONO[m.id];
          const on = menu.modo === m.id;
          return (
            <button key={m.id} type="button" onClick={() => setPreferencia('menu.modo', m.id)}
              style={{
                textAlign: 'left', padding: '12px 12px 10px', borderRadius: 12, cursor: 'pointer',
                border: `1.5px solid ${on ? theme.accent : theme.border}`, background: on ? `${theme.accent}12` : (dark ? 'rgba(255,255,255,0.03)' : theme.bg),
                color: theme.text, fontFamily: TYPO.fontText,
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ width: 28, height: 28, borderRadius: 8, background: on ? theme.accent : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'), color: on ? '#FFF' : theme.textMuted, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} />
                </span>
                <span style={{ fontFamily: TYPO.fontDisplay, fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>{m.label}</span>
              </div>
              <div style={{ fontSize: 11.5, color: theme.textMuted, lineHeight: 1.35 }}>{m.desc}</div>
            </button>
          );
        })}
      </div>

      <Fila titulo="Densidad" desc="Altura de las filas del menú.">
        <Segmented value={menu.densidad} onChange={(v) => setPreferencia('menu.densidad', v)}
          options={[{ id: 'comoda', label: 'Cómoda' }, { id: 'compacta', label: 'Compacta' }]} />
      </Fila>
      <Fila titulo="Abrir en" desc="Qué pestaña se abre al entrar al dashboard.">
        <Segmented value={menu.inicio} onChange={(v) => setPreferencia('menu.inicio', v)}
          options={[{ id: 'inicio', label: 'Inicio' }, { id: 'ultima', label: 'Última pestaña' }]} />
      </Fila>
      <Fila titulo="Favoritos" desc={favoritos.length ? `${favoritos.length} pestaña${favoritos.length === 1 ? '' : 's'} · ⌘1-9 para saltar a ellas.` : 'Pulsa ☆ junto a cualquier pestaña del menú para añadirla.'}>
        {favoritos.length > 0 && (
          <button type="button" onClick={() => setPreferencia('menu.favoritos', ['inicio'])}
            style={{ height: 28, padding: '0 12px', borderRadius: 999, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, fontFamily: TYPO.fontText, fontSize: 12, cursor: 'pointer' }}>
            Restablecer
          </button>
        )}
      </Fila>
    </Panel>
  );
}
