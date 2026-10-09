// Agenda «que te lleva» (V6 · 2026-10-08) · «Organiza tu día» en el celular: HojaM casi completa con el mismo cuerpo que la web.
import React from 'react';
import { HojaM } from '../../piezas';
import { fechaLarga } from '../../../modules/agenda5/base/textos';
import { OrganizaCuerpo } from '../../../modules/agenda6/OrganizaDia';

export default function OrganizaDiaM({ abierto, onClose, onListo, d, uid, propietario, hoy, hoyIso, horas, estado, puedeEditar, nombre, onAbrirItem }) {
  if (!abierto || !estado) return null;
  return (
    <HojaM abierto={abierto} onClose={onClose} alto="92vh" zIndex={95} titulo={`${nombre ? `${nombre}, o` : 'O'}rganiza tu día`} sub={fechaLarga(hoy).replace(/^./, (c) => c.toUpperCase())}>
      <OrganizaCuerpo movil d={d} uid={uid} propietario={propietario} hoy={hoy} hoyIso={hoyIso} horas={horas} estado={estado} puedeEditar={puedeEditar} onListo={onListo || onClose} onAbrirItem={onAbrirItem} />
      <div style={{ height: 24 }} />
    </HojaM>
  );
}
