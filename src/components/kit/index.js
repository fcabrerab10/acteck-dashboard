// Kit V3 · piezas base + utilidades. Toda pantalla nueva o migrada se arma sólo con esto.
export { default as Hero, HeroStat } from './Hero';
export { default as KpiCard } from './KpiCard';
export { default as Pill, DeltaPill, toneColors } from './Pill';
export { default as Segmented } from './Segmented';
export { default as TablaCompacta } from './TablaCompacta';
export { default as HeatCell, nivel } from './HeatCell';
export { default as Panel } from './Panel';
export { default as Boton } from './Boton';
export { default as Skeleton, SkeletonPantalla } from './Skeleton';
export { default as Cargando } from './Cargando';
export { toast, ToastHost } from './Toast';
// GraficaLineas va por el envoltorio perezoso: recharts (117 KB gz) se carga en el
// ralentí, no dentro del chunk de cada pantalla. Ver GraficaLineasLazy.jsx.
export { default as GraficaLineas, prefetchGraficas } from './GraficaLineasLazy';
export { default as SelectorTrimestres, TRIMESTRES, Q_MESES, qDe, mesesDeTrimestres, etiquetaTrimestres, usePersistTrimestres } from './SelectorTrimestres';
export { EASE, DUR, STAGGER, t as transition } from '../../lib/motion';
export { ELEV, elevation, bordeFlotante } from '../../lib/elevation';
