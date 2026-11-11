// Acteck PCs en el celular (2026-11-11): envoltorio fino. La pantalla es la MISMA de la computadora
// (modules/comercial/pcs/ActeckPCs con `movil`), para que una mejora nunca quede en un solo lado.
import React from 'react';
import { useNav } from '../nav';
import { Cabecera, TituloGrande } from '../piezas';
import ActeckPCs from '../../modules/comercial/pcs/ActeckPCs';

export default function ActeckPcsM() {
  const nav = useNav();
  return (
    <>
      <Cabecera onVolver={nav.pop} />
      <TituloGrande titulo="Acteck PCs" sub="Proyecto con Grupo DECME" />
      <ActeckPCs movil />
    </>
  );
}
