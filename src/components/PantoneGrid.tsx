import { useState, useEffect } from 'react';
import { Search, BookOpen, Trash2 } from 'lucide-react';
import { PantoneColor } from '../types';

interface PantoneGridProps {
  pantones: PantoneColor[];
  onSelectPantone: (pantone: PantoneColor) => void;
  onDeletePantone?: (id: string) => void;
}

export default function PantoneGrid({
  pantones,
  onSelectPantone,
  onDeletePantone
}: PantoneGridProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [lineTypeFilter, setLineTypeFilter] = useState<'all' | 'pigmento' | 'reactivo' | 'aditivo'>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, lineTypeFilter]);

  const filteredPantones = pantones.filter(p => {
    const matchesSearch = p.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          p.name.toLowerCase().includes(searchTerm.toLowerCase());
    
    let matchesLineType = true;
    if (lineTypeFilter !== 'all') {
      if (lineTypeFilter === 'aditivo') {
        matchesLineType = !!p.formulas?.some(f => {
          const comp = f.component.toLowerCase();
          return comp.includes('urea') || comp.includes('asutol') || comp.includes('bicarbonato') || comp.includes('espesante') || comp.includes('aditivo') || comp.includes('fixer') || comp.includes('fijador');
        });
      } else {
        let inferred = '';
        if (p.type) {
          inferred = p.type.toLowerCase() === 'reactivo' ? 'reactivo' : 'pigmento';
        } else {
          const hasReactivo = p.name.toLowerCase().includes('reactiv') || p.formulas?.some(f => 
            f.component.toLowerCase().includes('reactiv') || 
            f.description.toLowerCase().includes('reactiv') ||
            f.component.toLowerCase().includes('alginato') ||
            f.description.toLowerCase().includes('alginato')
          );
          inferred = hasReactivo ? 'reactivo' : 'pigmento';
        }
        matchesLineType = inferred === lineTypeFilter;
      }
    }

    return matchesSearch && matchesLineType;
  }).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));

  const totalPages = Math.ceil(filteredPantones.length / itemsPerPage);
  const currentPantones = filteredPantones.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 flex flex-col h-full overflow-hidden" id="pantone-grid-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center">
            <BookOpen className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl sm:text-2xl font-black text-slate-900">Catálogo de Tonos</h3>
            <p className="text-sm text-slate-500 font-medium">Explora todas las fórmulas Pantone disponibles en el sistema.</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-2 rounded-xl shadow-sm hidden sm:inline-block">
            {filteredPantones.length} Fórmulas
          </span>
          <select
            value={lineTypeFilter}
            onChange={(e) => setLineTypeFilter(e.target.value as any)}
            className="bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-3 py-2.5 text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
          >
            <option value="all">Todas las Líneas</option>
            <option value="pigmento">Solo Pigmentos</option>
            <option value="reactivo">Solo Reactivos</option>
            <option value="aditivo">Con Aditivos (Urea, etc.)</option>
          </select>
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Buscar (ej: 185 C)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Grid de Pantones */}
      <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 pb-4">
        {filteredPantones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 bg-slate-50/50 rounded-3xl border border-dashed border-slate-200">
            <BookOpen className="w-12 h-12 text-slate-300 mb-3" />
            <p className="text-base font-bold text-slate-500">No se encontraron fórmulas</p>
            <p className="text-sm text-slate-400 mt-1">Intenta buscar con otro código o nombre de Pantone.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 lg:gap-6">
              {currentPantones.map((p) => (
                <div
                  key={p.id || p.code}
                  onClick={() => onSelectPantone(p)}
                  className="group flex flex-col items-start p-5 bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left relative overflow-hidden cursor-pointer w-full"
                >
                  <div 
                    className="w-full h-24 sm:h-32 rounded-2xl mb-4 shadow-inner border border-slate-100 transition-transform group-hover:scale-[1.02]" 
                    style={{ backgroundColor: p.hex }}
                  />
                  <div className="w-full relative">
                    <h4 className="text-lg font-black text-slate-900 leading-tight mb-1 pr-8">{p.code}</h4>
                    {onDeletePantone && p.id && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`¿Seguro que deseas eliminar el pantone ${p.code}?`)) {
                            onDeletePantone(p.id!);
                          }
                        }}
                        className="absolute right-0 top-0 p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors z-10"
                        title="Eliminar Pantone"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                    <p className="text-xs text-slate-500 font-semibold truncate mb-3">{p.name}</p>
                  </div>
                  
                  <div className="mt-auto w-full flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {(() => {
                        if (p.type) return p.type;
                        const hasReactivo = p.name.toLowerCase().includes('reactiv') || p.formulas?.some(f => 
                          f.component.toLowerCase().includes('reactiv') || 
                          f.description.toLowerCase().includes('reactiv') ||
                          f.component.toLowerCase().includes('alginato') ||
                          f.description.toLowerCase().includes('alginato')
                        );
                        return hasReactivo ? 'Reactivo' : 'Pigmentos';
                      })()}
                    </span>
                    <span className="text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg shadow-sm">
                      {p.formulas?.length || 0} Tintas
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-4 mt-8 pb-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs disabled:opacity-40 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1.5 rounded-lg">
                  Página {currentPage} de {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-xs disabled:opacity-40 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  Siguiente
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
