// Novedades cortas por versión (Administración → Sistema). Lista estática: se agrega una entrada
// por cada minor/major que sube package.json (regla de versionado en CLAUDE.md → Flujo de trabajo).
// Orden: la más reciente primero.
export const NOVEDADES = [
  {
    version: '3.3.0', fecha: '2026-09-10', titulo: 'Administración',
    items: [
      'Configuración pasa a Administración: Usuarios y permisos · Datos · Notificaciones del equipo · Sistema.',
      'Permisos por pestaña con guardado al instante, "Copiar permisos de…" y "Ver como" (menú que vería el usuario).',
      'Preferencias de notificación de cada usuario interno editables por el super admin.',
      'Retención de auditoría (purga a 365 días) y estado de servicios desde el dashboard.',
    ],
  },
  {
    version: '3.2.0', fecha: '2026-09-10', titulo: 'Importador central',
    items: [
      'El importador vive dentro del dashboard: automáticas con latido del puente y "Pedir corrida", manuales por grupo con anillo de frescura y arrastrar y soltar.',
      'Parsers compartidos en src/lib/parsers/; uploads.html queda como respaldo técnico.',
    ],
  },
  {
    version: '3.1.0', fecha: '2026-09-11', titulo: 'Menú, Inicio, notificaciones y perfil',
    items: [
      'Menú de tres modos (Barra · iPad · iPhone) y paleta ⌘K; preferencias guardadas en el perfil.',
      'Pestaña Inicio de dirección general (Mes/Año) sobre las medidas del ERP.',
      'Centro de notificaciones estilo iOS con pilas por área y resumen programado a las 09/13/18.',
      'Perfil con foto ilustrada y panel rápido desde el avatar.',
    ],
  },
  {
    version: '3.0.0', fecha: '2026-09-09', titulo: 'V3',
    items: [
      'Kit de piezas (Hero, KPI, Pill, Segmented, Panel, Tabla compacta, Toast) y loader de silueta.',
      'Home único por cliente, frescura de datos por pantalla y versionado visible.',
      'Ferruteck retirado de la interfaz; arranque 6× más ligero (bundle por pantalla).',
    ],
  },
];
