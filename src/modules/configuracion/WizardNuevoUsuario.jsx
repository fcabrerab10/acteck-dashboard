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

  const titulos = {
    1: 'Datos del colaborador.',
    2: 'Elegí a qué clientes tendrá acceso.',
    3: 'Configurá el nivel de acceso por pestaña.',
    4: datos.tipo === 'interno' ? 'Permisos globales y resumen.' : 'Revisá y confirmá.',
  };
  const totalPasos = 4;

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

  // Validaciones por paso
  const validoP1 = datos.nombre.trim() && /\S+@\S+\.\S+/.test(datos.email) &&
    (datos.metodo === 'invite' || (datos.password.length >= 8));
  const validoP2 = clientesElegidos.length > 0;

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
        <h2 style={H2}>{titulos[paso]}</h2>
        {/* Stepper */}
        <div style={{ display: 'flex', gap: 8, marginTop: 24, flexWrap: 'wrap' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '6px 12px', borderRadius: 999,
              background: i === paso ? '#FFF' : (i < paso ? 'rgba(52,199,89,0.18)' : 'rgba(255,255,255,0.08)'),
              color: i === paso ? '#000' : (i < paso ? '#34C759' : 'rgba(255,255,255,0.55)'),
              fontSize: 12, fontWeight: 600, transition: `all 240ms ${APPLE_EASE}`,
            }}>
              <span>{i < paso ? '✓' : i}</span>
              <span>{['Datos','Clientes','Permisos', datos.tipo === 'interno' ? 'Globales' : 'Resumen'][i-1]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px 80px' }}>
        {paso === 1 && (
          <PasoDatos datos={datos} setDatos={setDatos} />
        )}
        {paso === 2 && (
          <PasoClientes elegidos={clientesElegidos} toggle={toggleCliente} />
        )}
        {paso === 3 && (
          <PasoPermisosClientes
            clientesElegidos={clientesElegidos}
            permisos={permisos}
            onNivel={actualizarNivelCliente}
            onTodas={todasCliente}
          />
        )}
        {paso === 4 && (
          <PasoResumen
            datos={datos}
            clientesElegidos={clientesElegidos}
            permisos={permisos}
            onGlobal={actualizarGlobal}
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
              disabled={(paso === 1 && !validoP1) || (paso === 2 && !validoP2)}
              onClick={() => setPaso(paso+1)}
              style={{
                ...btnPrimary,
                opacity: ((paso === 1 && !validoP1) || (paso === 2 && !validoP2)) ? 0.4 : 1,
              }}>
              {paso === 1 && 'Siguiente · Elegir clientes →'}
              {paso === 2 && 'Siguiente · Permisos →'}
              {paso === 3 && (datos.tipo === 'interno' ? 'Siguiente · Globales →' : 'Siguiente · Resumen →')}
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
          desc="Vas a tener que compartirla vos por otro canal seguro." />
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
        Elegí uno o más clientes. Solo verá los que aparezcan acá.
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
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '12px 18px',
            borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 500, color: '#1D1D1F' }}>{p.label}</div>
              <div style={{ fontSize: 11.5, color: '#86868B', marginTop: 2 }}>{p.desc}</div>
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

// ── Paso 4 ─────────────────────────────────────────────────────────
function PasoResumen({ datos, clientesElegidos, permisos, onGlobal }) {
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
      {datos.tipo === 'interno' && (
        <div style={{ marginBottom: 32 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: '0 0 12px' }}>
            Pestañas globales (solo internos)
          </h3>
          <div style={{
            background: '#FFF', borderRadius: 14, overflow: 'hidden',
            border: '1px solid rgba(0,0,0,0.06)',
          }}>
            {PESTANAS_GLOBALES.map((p, idx) => (
              <div key={p.id} style={{
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '11px 16px',
                borderTop: idx === 0 ? 'none' : '1px solid rgba(0,0,0,0.05)',
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 500, color: '#1D1D1F' }}>{p.label}</div>
                  <div style={{ fontSize: 11, color: '#86868B', marginTop: 1 }}>{p.desc}</div>
                </div>
                <PillsNivel
                  valor={p.id === 'configuracion' ? 'oculto' : (permisos.globales[p.id] || 'oculto')}
                  onChange={n => p.id !== 'configuracion' && onGlobal(p.id, n)} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#86868B', marginTop: 8 }}>
            Configuración solo la ve Fernando (Super Admin) — no se puede compartir.
          </p>
        </div>
      )}

      <h3 style={{ fontSize: 15, fontWeight: 600, color: '#1D1D1F', margin: '0 0 12px' }}>
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
