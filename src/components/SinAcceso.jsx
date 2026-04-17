import React from 'react';

export default function SinAcceso({ motivo }) {
  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-md text-center">
        <p className="text-5xl mb-4">🔒</p>
        <h2 className="text-xl font-bold text-gray-800 mb-2">Sin acceso a esta sección</h2>
        <p className="text-sm text-gray-500 mb-1">
          {motivo || "No tienes permiso para ver esta parte del dashboard."}
        </p>
        <p className="text-xs text-gray-400 mt-4">
          Si crees que necesitas acceso, contacta al administrador.
        </p>
      </div>
    </div>
  );
}
