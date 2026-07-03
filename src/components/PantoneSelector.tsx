import { useState } from 'react';
import { Search, BookOpen, Plus } from 'lucide-react';
import { PantoneColor } from '../types';

interface PantoneSelectorProps {
  pantones: PantoneColor[];
  selectedPantone: PantoneColor | null;
  onSelectPantone: (pantone: PantoneColor) => void;
  onOpenCreateModal: () => void;
}

export default function PantoneSelector({
  pantones,
  selectedPantone,
  onSelectPantone,
  onOpenCreateModal
}: PantoneSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPantones = pantones.filter(p => {
    const matchesSearch = 
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 flex flex-col h-full" id="pantone-selector-card">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-blue-600" />
          <h3 className="text-lg font-bold text-slate-900">Catálogo de Tonos</h3>
        </div>
        <span className="text-xs font-semibold bg-slate-100 text-slate-600 px-2.5 py-1 rounded-full">
          {pantones.length} Fórmulas
        </span>
      </div>

      {/* Controles de Búsqueda */}
      <div className="flex flex-col gap-3 mb-4">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Buscar por Pantone (ej: 185 C)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-100 text-slate-800 border-none rounded-xl pl-10 pr-4 py-2 text-sm focus:ring-2 focus:ring-blue-400 focus:outline-none"
          />
        </div>
      </div>

      {/* Lista de Pantones */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
        {filteredPantones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center text-slate-400">
            <p className="text-sm">No se encontraron fórmulas</p>
            <p className="text-xs text-slate-300">Intenta buscar otro código Pantone</p>
          </div>
        ) : (
          filteredPantones.map((p) => {
            const isSelected = selectedPantone?.id ? selectedPantone.id === p.id : selectedPantone?.code === p.code;
            return (
              <button
                key={p.id || p.code}
                onClick={() => onSelectPantone(p)}
                className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all border text-left ${
                  isSelected
                    ? 'bg-blue-50/50 border-blue-200 shadow-sm'
                    : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  {/* Círculo de Color */}
                  <div 
                    className="w-10 h-10 rounded-xl shadow-inner border border-white flex items-center justify-center font-bold text-white text-xs" 
                    style={{ backgroundColor: p.hex }}
                  />
                  <div>
                    <p className="text-sm font-bold text-slate-900 leading-tight">{p.code}</p>
                    <p className="text-xs text-slate-500 font-medium truncate max-w-[130px]">{p.name}</p>
                  </div>
                </div>
                
                <div className="text-right">
                  <span className="text-[10px] font-bold text-slate-400 block uppercase">{p.mesh}</span>
                  <span className="text-[9px] text-blue-600 font-semibold bg-blue-50 px-1.5 py-0.5 rounded">
                    {p.formulas.length} Tintas
                  </span>
                </div>
              </button>
            );
          })
        )}
      </div>

      {/* Acción de agregar rápida */}
      <button
        onClick={onOpenCreateModal}
        className="mt-4 w-full bg-blue-600 text-white rounded-xl py-2.5 px-4 text-xs font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/10 flex items-center justify-center gap-2 cursor-pointer"
      >
        <Plus className="w-4 h-4" />
        Agregar Nueva Fórmula
      </button>
    </div>
  );
}
