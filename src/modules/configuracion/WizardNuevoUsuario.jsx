// WizardNuevoUsuario — 4 pasos: Datos · Clientes · Permisos · Globales+Resumen
// Hero editorial negro + stepper horizontal. Estilo Apple/iOS.
import React, { useState, useMemo } from "react";
import { supabase } from '../../lib/supabase';
import {
  CLIENTES, PESTANAS_CLIENTE, PESTANAS_GLOBALES,
} from '../../lib/permisos';
import { toast } from '../../lib/toast';

const APPLE_EASE = 'cubic-bezier(0.32, 0.72, 0, 1)';

const permisosVacios = () => ({
  clientes: Object.fromEntries(
    CLIENTES.map(c => [c.id, Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, "oculto"]))])
  ),
  globales: Object.fromEntries(PESTANAS_GLOBALES.map(p => [p.id, "oculto"])),
});

const NIVEL_COLOR = {
  oculto: { bg: '#6E6E73', fg: '#FFF' },
  ver:    { bg: '#007AFF', fg: '#FFF' },
  edit:   { bg: '#34C759', fg: '#FFF' },
};
const CLIENTE_COLOR = {
  digitalife: '#0A84FF',
  dicotech:   '#5856D6',
  pcel:       '#FF9500',
};

// Agrupación de pestañas globales según el sidebar del dashboard.
// Los ids referencian PESTANAS_GLOBALES.
const GLOBAL_SECCIONES = [
  {
    id: 'direccionGeneral',
    label: 'Dirección General',
    emoji: '🏛️',
    color: '#0F7A34',
    items: ['estado_resultados'],
  },
  {
    id: 'direccionComercial',
    label: 'Dirección Comercial',
    emoji: '📊',
    color: '#0A56C0',
    items: [
      'vision_general', 'analisis_clientes',
      'sell_in', 'sell_out',
      'inventario_global', 'cobranza_global',
      'forecast_clientes', 'forecast_solicitudes',
      'resumen_clientes', 'propuestas',
      'estrategia_precios', 'ordenes_compra',
    ],
  },
  {
    id: 'internaGrupo',
    label: 'Administración Interna',
    emoji: '🏢',
    color: '#B36600',
    items: ['admin_interna'],
  },
  {
    id: 'axonGrupo',
    label: 'Axon de México',
    emoji: '🛒',
    color: '#7F3AB0',
    items: ['axon_mexico'],
  },
];

const H2 = {
  fontFamily: '"SF Pro Display", -apple-system, sans-serif',
  fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05,
  color: '#FFF', fontSize: 'clamp(28px, 4vw, 44px)', margin: 0,
};
const EYEBROW = {
  fontSize: 11, fontWeight: 600, letterSpacing: '0.12em',
  textTransform: 'uppercase', color: 'rgba(255,255,255,0.55)',
  marginBottom: 10,
};

export default function WizardNuevoUsuario({ onCancel, onCreated }) {
  const [paso, setPaso] = useState(1);
  const [datos, setDatos] = useState({
    nombre: '', email: '', puesto: '', tipo: 'interno',
    metodo: 'invite', password: '',
  });
  const [clientesElegidos, setClientesElegidos] = useState([]);
  const [permisos, setPermisos] = useState(permisosVacios());
  const [saving, setSaving] = useState(false);

  // Los pasos dependen del tipo: los externos saltan "Globales" porque no
  // tienen acceso a pestañas globales.
  const stepsList = datos.tipo === 'interno'
    ? [
        { key: 'datos',    label: 'Datos',    titulo: 'Datos del colaborador.' },
        { key: 'globales', label: 'Globales', titulo: 'Elige qué pestañas globales podrá ver.' },
        { key: 'clientes', label: 'Clientes', titulo: 'Elige a qué clientes tendrá acceso.' },
        { key: 'permisos', label: 'Permisos', titulo: 'Nivel de acceso por pestaña y resumen final.' },
      ]
    : [
        { key: 'datos',    label: 'Datos',    titulo: 'Datos del colaborador.' },
        { key: 'clientes', label: 'Clientes', titulo: 'Elige a qué clientes tendrá acceso.' },
        { key: 'permisos', label: 'Permisos', titulo: 'Nivel de acceso por pestaña y resumen final.' },
      ];
  const totalPasos = stepsList.length;
  const stepActual = stepsList[paso - 1];

  function actualizarNivelCliente(clienteId, pestanaId, nivel) {
    setPermisos(p => ({
      ...p,
      clientes: {
        ...p.clientes,
        [clienteId]: { ...p.clientes[clienteId], [pestanaId]: nivel },
      },
    }));
  }
  function todasCliente(clienteId, nivel) {
    setPermisos(p => ({
      ...p,
      clientes: {
        ...p.clientes,
        [clienteId]: Object.fromEntries(PESTANAS_CLIENTE.map(pp => [pp.id, nivel])),
      },
    }));
  }
  function actualizarGlobal(id, nivel) {
    setPermisos(p => ({ ...p, globales: { ...p.globales, [id]: nivel } }));
  }

  function toggleCliente(id) {
    setClientesElegidos(list => list.includes(id) ? list.filter(x => x !== id) : [...list, id]);
    // Si lo estoy quitando, resetear permisos de ese cliente
    if (clientesElegidos.includes(id)) todasCliente(id, 'oculto');
  }

  // Validaciones por step (por key, no por índice)
  const validoDatos = datos.nombre.trim() && /\S+@\S+\.\S+/.test(datos.email) &&
    (datos.metodo === 'invite' || (datos.password.length >= 8));
  const validoClientes = clientesElegidos.length > 0;
  const validoActual =
    stepActual.key === 'datos' ? validoDatos :
    stepActual.key === 'clientes' ? validoClientes :
    true;
  // Cambia el tipo → volver al paso 1 para evitar quedar en un step inexistente
  React.useEffect(() => { setPaso(1); }, [datos.tipo]);

  async function submit() {
    setSaving(true);
    try {
      // Antes de enviar, forzamos que clientes NO elegidos queden todos ocultos
      const permisosClean = {
        clientes: Object.fromEntries(
          CLIENTES.map(c => [c.id,
            clientesElegidos.includes(c.id) ? permisos.clientes[c.id]
              : Object.fromEntries(PESTANAS_CLIENTE.map(p => [p.id, 'oculto']))
          ])
        ),
        globales: datos.tipo === 'interno' ? permisos.globales
          : Object.fromEntries(PESTANAS_GLOBALES.map(p => [p.id, 'oculto'])),
      };
      const token = (await supabase.auth.getSession()).data.session?.access_token;
      const body = {
        nombre: datos.nombre.trim(),
        email: datos.email.trim().toLowerCase(),
        puesto: datos.puesto || null,
        tipo: datos.tipo,
        permisos: permisosClean,
        metodo: datos.metodo,
      };
      if (datos.metodo === 'password') body.password = datos.password;

      const res = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error creando usuario');
      toast.success(datos.metodo === 'invite' ? 'Invitación enviada' : 'Usuario creado');
      onCreated?.();
    } catch (e) {
      toast.error('Error: ' + e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh', margin: '-4px -24px 0', background: '#F5F5F7',
      fontFamily: '-apple-system, "SF Pro Text", sans-serif',
    }}>
      {/* Hero negro */}
      <div style={{ background: '#000', padding: '36px 32px 44px', color: '#FFF' }}>
        <div style={EYEBROW}>Configuración · Nuevo colaborador</div>
        <h2 style={H2}>{stepActual.titulo}</h2>
        {/* Stepper dinámico según tipo */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          {stepsList.map((s, i) => {
            const n = i + 1;
            return (
              <div key={s.key} style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '6px 12px', borderRadius: 999,
                background: n === paso ? '#FFF' : (n < paso ? 'rgba(52,199,89,0.18)' : 'rgba(255,255,255,0.08)'),
                color: n === paso ? '#000' : (n < paso ? '#34C759' : 'rgba(255,255,255,0.55)'),
                fontSize: 12, fontWeight: 600, transition: `all 240ms ${APPLE_EASE}`,
              }}>
                <span>{n < paso ? '✓' : n}</span>
                <span>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 80px' }}>
        {stepActual.key === 'datos' && (
          <PasoDatos datos={datos} setDatos={setDatos} />
        )}
        {stepActual.key === 'globales' && (
          <PasoGlobales permisos={permisos} onGlobal={actualizarGlobal} />
        )}
        {stepActual.key === 'clientes' && (
          <PasoClientes elegidos={clientesElegidos} toggle={toggleCliente} />
        )}
        {stepActual.key === 'permisos' && (
          <PasoPermisosYResumen
            datos={datos}
            clientesElegidos={clientesElegidos}
            permisos={permisos}
            onNivel={actualizarNivelCliente}
            onTodas={todasCliente}
          />
        )}

        {/* Nav */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', gap: 12,
          marginTop: 40, paddingTop: 20, borderTop: '1px solid rgba(0,0,0,0.08)',
        }}>
          <button onClick={paso === 1 ? onCancel : () => setPaso(paso-1)}
            style={btnGhost}>
            {paso === 1 ? 'Cancelar' : '← Atrás'}
          </button>
          {paso < totalPasos ? (
            <button
              disabled={!validoActual}
              onClick={() => setPaso(paso+1)}
              style={{ ...btnPrimary, opacity: validoActual ? 1 : 0.4 }}>
              {(() => {
                const next = stepsList[paso];
                const labels = { datos: 'Datos', globales: 'Globales', clientes: 'Clientes', permisos: 'Permisos y resumen' };
                return `Siguiente · ${labels[next.key]} →`;
              })()}
            </button>
          ) : (
            <button disabled={saving} onClick={submit} style={{ ...btnPrimary, fontSize: 15 }}>
              {saving ? 'Creando…' : (datos.metodo === 'invite' ? '✉  Crear y enviar invitación' : '＋  Crear usuario')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

const btnPrimary = {
  background: '#007AFF', color: '#FFF', border: 'none',
  padding: '12px 22px', borderRadius: 999, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 180ms ease',
};
const btnGhost = {
  background: 'transparent', color: '#1D1D1F',
  border: '1px solid rgba(0,0,0,0.15)',
  padding: '12px 22px', borderRadius: 999, fontSize: 14, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
};

// ── Paso 1 ─────────────────────────────────────────────────────────
function PasoDatos({ datos, setDatos }) {
  const upd = (k, v) => setDatos(d => ({ ...d, [k]: v }));
  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        <Field label="Nombre completo" value={datos.nombre} onChange={v => upd('nombre', v)} placeholder="Ej. Juan Pérez" />
        <Field label="Email corporativo" type="email" value={datos.email} onChange={v => upd('email', v)} placeholder="juan@acteck.com" />
      </div>
      <Field label="Puesto" value={datos.puesto} onChange={v => upd('puesto', v)}
        placeholder="Ej. Gerente Comercial, Analista de Compras" full />
      <p style={{ fontSize: 11, color: '#86868B', marginTop: -8, marginBottom: 24 }}>
        Solo informativo. No afecta permisos.
      </p>

      <label style={labelStyle}>Tipo de colaborador</label>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 8 }}>
        {[
          { v:'interno', t:'Interno',  d:'Equipo de Acteck. Accede a pestañas globales.' },
          { v:'externo', t:'Externo',  d:'Empleado del cliente. Solo ve lo que le asignes.' },
        ].map(o => (
          <button key={o.v} type="button" onClick={() => upd('tipo', o.v)}
            style={{
              padding: '14px 16px', borderRadius: 12, textAlign: 'left',
              background: datos.tipo === o.v ? '#000' : '#FFF',
              color: datos.tipo === o.v ? '#FFF' : '#1D1D1F',
              border: '1px solid ' + (datos.tipo === o.v ? '#000' : 'rgba(0,0,0,0.1)'),
              cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 180ms ease',
            }}>
            <div style={{ fontWeight: 600, fontSize: 15 }}>{o.t}</div>
            <div style={{ fontSize: 12, opacity: 0.72, marginTop: 4 }}>{o.d}</div>
          </button>
        ))}
      </div>

      <div style={{ height: 20 }} />
      <label style={labelStyle}>Método de acceso</label>
      <div style={{
        background: '#FFF', border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 14, padding: 4,
      }}>
        <SwitchRow
          on={datos.metodo === 'invite'}
          onChange={v => upd('metodo', v ? 'invite' : 'password')}
          title={<>Enviar invitación por email <BadgeRec /></>}
          desc="El colaborador recibe un email y elige su contraseña. No compartís passwords." />
        <div style={{ height: 1, background: 'rgba(0,0,0,0.06)' }} />
        <SwitchRow
          on={datos.metodo === 'password'}
          onChange={v => upd('metodo', v ? 'password' : 'invite')}
          title="Definir contraseña ahora"
          desc="Tendrás que compartirla tú por otro canal seguro." />
        {datos.metodo === 'password' && (
          <div style={{ padding: '4px 14px 14px' }}>
            <input type="password" value={datos.password}
              onChange={e => upd('password', e.target.value)}
              placeholder="Mínimo 8 caracteres"
              style={inputStyle} />
          </div>
        )}
      </div>
    </div>
  );
}

function BadgeRec() {
  return <span style={{
    marginLeft: 6, fontSize: 9, fontWeight: 700, letterSpacing: '0.08em',
    padding: '2px 6px', borderRadius: 4, background: '#34C759', color: '#FFF',
    verticalAlign: 'middle',
  }}>RECOMENDADO</span>;
}
function SwitchRow({ on, onChange, title, desc }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1D1D1F' }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6E6E73', marginTop: 2 }}>{desc}</div>
      </div>
      <button type="button" onClick={() => onChange(!on)} style={{
        width: 44, height: 26, borderRadius: 999, border: 'none',
        background: on ? '#34C759' : '#E5E5EA', position: 'relative',
        cursor: 'pointer', transition: 'background 200ms ease', padding: 0, flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: on ? 20 : 2,
          width: 22, height: 22, borderRadius: '50%', background: '#FFF',
          boxShadow: '0 1px 3px rgba(0,0,0,0.15)', transition: `left 200ms ${APPLE_EASE}`,
        }} />
      </button>
    </div>
  );
}
function Field({ label, value, onChange, placeholder, type = 'text', full }) {
  return (
    <div style={{ gridColumn: full ? '1 / -1' : undefined }}>
      <label style={labelStyle}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        placeholder={placeholder} style={inputStyle} />
    </div>
  );
}
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#6E6E73',
  letterSpacing: '0.02em', marginBottom: 6, textTransform: 'uppercase',
};
const inputStyle = {
  width: '100%', padding: '11px 14px', background: '#FFF',
  border: '1px solid rgba(0,0,0,0.1)', borderRadius: 12,
  fontSize: 14, outline: 'none', fontFamily: 'inherit', color: '#1D1D1F',
};

// ── Paso 2 ─────────────────────────────────────────────────────────
function PasoClientes({ elegidos, toggle }) {
  return (
    <div>
      <p style={{ color: '#6E6E73', fontSize: 14, marginTop: 0, marginBottom: 20 }}>
        Elige uno o más clientes. Solo verá los que aparezcan aquí.
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
        {CLIENTES.map(c => {
          const on = elegidos.includes(c.id);
          const color = CLIENTE_COLOR[c.id] || '#007AFF';
          return (
            <button key={c.id} onClick={() => toggle(c.id)}
              style={{
                padding: '28px 20px', borderRadius: 16,
                background: on ? color : '#FFF',
                color: on ? '#FFF' : '#1D1D1F',
                border: '1px solid ' + (on ? color : 'rgba(0,0,0,0.08)'),
                cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit',
                transition: `all 220ms ${APPLE_EASE}`,
                boxShadow: on ? `0 6px 20px ${color}55` : '0 1px 0 rgba(0,0,0,0.02)',
              }}>
              <div style={{
                width: 10, height: 10, borderRadius: '50%',
                background: on ? '#FFF' : color, marginBottom: 12,
              }} />
              <div style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>{c.label}</div>
              <div style={{ fontSize: 12, opacity: 0.72, marginTop: 6 }}>
                {on ? 'Seleccionado' : 'Tocar para seleccionar'}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Paso 3 ─────────────────────────────────────────────────────────
function PasoPermisosClientes({ clientesElegidos, permisos, onNivel, onTodas }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {clientesElegidos.map(cid => {
        const cliente = CLIENTES.find(c => c.id === cid);
        return (
          <BloqueCliente key={cid} cliente={cliente} valores={permisos.clientes[cid]}
            onNivel={(pid, n) => onNivel(cid, pid, n)}
            onTodas={n => onTodas(cid, n)} />
        );
      })}
    </div>
  );
}
function BloqueCliente({ cliente, valores, onNivel, onTodas }) {
  const color = CLIENTE_COLOR[cliente.id] || '#007AFF';
  return (
    <div style={{
      background: '#FFF', borderRadius: 16, overflow: 'hidden',
      border: '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', background: '#000', color: '#FFF',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: '-0.015em' }}>{cliente.label}</h3>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          <MiniBtn onClick={() => onTodas('ver')}>Todo Ver</MiniBtn>
          <MiniBtn onClick={() => onTodas('edit')}>Todo Editar</MiniBtn>
          <MiniBtn onClick={() => onTodas('oculto')}>Todo Ocultar</MiniBtn>
        </div>
      </div>
      <div>
        {PESTANAS_CLIENTE.map((p, idx) => (
          <div key={p.id} style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0,1fr) auto',
            alignItems: 'center', gap: 16,
            padding: '16px 20px',
            borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', lineHeight: 1.35 }}>{p.label}</div>
              <div style={{ fontSize: 12, color: '#86868B', marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
            </div>
            <PillsNivel valor={valores[p.id] || 'oculto'} onChange={n => onNivel(p.id, n)} />
          </div>
        ))}
      </div>
    </div>
  );
}
function MiniBtn({ children, onClick }) {
  return (
    <button onClick={onClick} style={{
      background: 'rgba(255,255,255,0.1)', color: '#FFF',
      border: 'none', borderRadius: 999,
      padding: '5px 10px', fontSize: 11, fontWeight: 500,
      cursor: 'pointer', fontFamily: 'inherit',
    }}>{children}</button>
  );
}
function PillsNivel({ valor, onChange }) {
  return (
    <div style={{ display: 'inline-flex', gap: 4, background: '#F5F5F7', padding: 3, borderRadius: 10 }}>
      {['oculto','ver','edit'].map(n => {
        const on = valor === n;
        const col = NIVEL_COLOR[n];
        return (
          <button key={n} onClick={() => onChange(n)} style={{
            background: on ? col.bg : 'transparent',
            color: on ? col.fg : '#6E6E73',
            border: 'none', padding: '6px 12px', borderRadius: 7,
            fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
            transition: 'all 140ms ease',
          }}>
            {n === 'oculto' ? 'Ocultar' : n === 'ver' ? 'Ver' : 'Editar'}
          </button>
        );
      })}
    </div>
  );
}

// ── Paso Globales (solo internos) — agrupa por sección del sidebar ─────
function PasoGlobales({ permisos, onGlobal }) {
  const pestanaMap = useMemo(() => Object.fromEntries(PESTANAS_GLOBALES.map(p => [p.id, p])), []);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <p style={{ color: '#6E6E73', fontSize: 14, marginTop: 0, marginBottom: 0 }}>
        Los grupos siguen la misma estructura del menú del dashboard.
      </p>
      {GLOBAL_SECCIONES.map(sec => {
        const items = sec.items.map(id => pestanaMap[id]).filter(Boolean);
        if (items.length === 0) return null;
        return (
          <div key={sec.id} style={{
            background: '#FFF', borderRadius: 16, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 18px', background: '#000', color: '#FFF',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: sec.color }} />
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, letterSpacing: '-0.015em' }}>
                  {sec.emoji} {sec.label}
                </h3>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <MiniBtn onClick={() => sec.items.forEach(id => id !== 'configuracion' && onGlobal(id, 'ver'))}>Todo Ver</MiniBtn>
                <MiniBtn onClick={() => sec.items.forEach(id => id !== 'configuracion' && onGlobal(id, 'edit'))}>Todo Editar</MiniBtn>
                <MiniBtn onClick={() => sec.items.forEach(id => id !== 'configuracion' && onGlobal(id, 'oculto'))}>Todo Ocultar</MiniBtn>
              </div>
            </div>
            <div>
              {items.map((p, idx) => (
                <div key={p.id} style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0,1fr) auto',
                  alignItems: 'center', gap: 16,
                  padding: '16px 20px',
                  borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
                }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F', lineHeight: 1.35 }}>{p.label}</div>
                    <div style={{ fontSize: 12, color: '#86868B', marginTop: 3, lineHeight: 1.4 }}>{p.desc}</div>
                  </div>
                  <PillsNivel
                    valor={p.id === 'configuracion' ? 'oculto' : (permisos.globales[p.id] || 'oculto')}
                    onChange={n => p.id !== 'configuracion' && onGlobal(p.id, n)} />
                </div>
              ))}
            </div>
          </div>
        );
      })}
      <p style={{ fontSize: 11.5, color: '#86868B', marginTop: -4, lineHeight: 1.5 }}>
        <b>Configuración</b> (gestión de usuarios) es exclusiva del Super Admin —
        no aparece en la lista porque no es asignable.
      </p>
    </div>
  );
}

// ── Paso Permisos por cliente + Resumen final ──────────────────────
function PasoPermisosYResumen({ datos, clientesElegidos, permisos, onNivel, onTodas }) {
  const editables = useMemo(() => {
    const items = [];
    clientesElegidos.forEach(cid => {
      const label = CLIENTES.find(c => c.id === cid)?.label;
      PESTANAS_CLIENTE.forEach(p => {
        if (permisos.clientes[cid][p.id] === 'edit') items.push(`${label} · ${p.label}`);
      });
    });
    if (datos.tipo === 'interno') {
      PESTANAS_GLOBALES.forEach(p => {
        if (permisos.globales[p.id] === 'edit') items.push(`Global · ${p.label}`);
      });
    }
    return items;
  }, [clientesElegidos, permisos, datos.tipo]);

  const nGlob = datos.tipo === 'interno'
    ? Object.values(permisos.globales).filter(v => v === 'ver' || v === 'edit').length
    : 0;

  return (
    <div>
      <PasoPermisosClientes
        clientesElegidos={clientesElegidos}
        permisos={permisos}
        onNivel={onNivel}
        onTodas={onTodas}
      />

      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: '32px 0 12px' }}>
        Resumen final
      </h3>
      <div style={{
        background: '#FFF', borderRadius: 14, overflow: 'hidden',
        border: '1px solid rgba(0,0,0,0.06)',
      }}>
        <ResumenRow k="Nombre" v={datos.nombre} />
        <ResumenRow k="Email" v={datos.email} />
        <ResumenRow k="Puesto"
          v={<>{datos.puesto || '—'} · <span style={{
            background: datos.tipo === 'interno' ? '#E9F0FF' : '#E5FAE8',
            color: datos.tipo === 'interno' ? '#0A56C0' : '#0F7A34',
            padding: '2px 8px', borderRadius: 999, fontSize: 11, fontWeight: 600,
          }}>{datos.tipo === 'interno' ? 'Interno' : 'Externo'}</span></>} />
        <ResumenRow k="Método"
          v={datos.metodo === 'invite' ? '✉  Enviará invitación por email' : '🔑  Contraseña definida ahora'} />
        <ResumenRow k="Accesos"
          v={`${clientesElegidos.length} cliente(s) · ${nGlob} pestaña(s) global(es)`} />
        <ResumenRow k="Puede editar"
          v={editables.length === 0 ? <em style={{ color: '#86868B' }}>Solo lectura</em>
            : <div style={{ fontSize: 12, color: '#1D1D1F' }}>{editables.map((e, i) => (
              <div key={i}>· {e}</div>
            ))}</div>} />
      </div>
    </div>
  );
}
function ResumenRow({ k, v }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '160px 1fr',
      padding: '12px 16px', borderTop: '1px solid rgba(0,0,0,0.05)',
      alignItems: 'baseline',
    }}>
      <span style={{ fontSize: 12, color: '#6E6E73', fontWeight: 600 }}>{k}</span>
      <span style={{ fontSize: 13.5, color: '#1D1D1F' }}>{v}</span>
    </div>
  );
}
