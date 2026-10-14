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
  const itemsPerPage = 12;

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
    <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 shadow-sm p-3.5 sm:p-6 md:p-8 flex flex-col h-full overflow-hidden" id="pantone-grid-card">
      {/* Encabezado y Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-6">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-50 rounded-xl sm:rounded-2xl flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg sm:text-2xl font-black text-slate-900 leading-tight">Catálogo de Tonos</h3>
              <span className="text-[10px] sm:text-xs font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-lg sm:hidden">
                {filteredPantones.length}
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium line-clamp-1 sm:line-clamp-none">
              Explora todas las fórmulas Pantone disponibles en el sistema.
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
          <span className="text-xs font-bold bg-slate-100 text-slate-600 px-3 py-2 rounded-xl shadow-sm hidden sm:inline-block shrink-0">
            {filteredPantones.length} Fórmulas
          </span>
          <select
            value={lineTypeFilter}
            onChange={(e) => setLineTypeFilter(e.target.value as any)}
            className="flex-1 sm:flex-initial bg-slate-50 text-slate-800 border border-slate-200 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner truncate"
          >
            <option value="all">Todas las Líneas</option>
            <option value="pigmento">Solo Pigmentos</option>
            <option value="reactivo">Solo Reactivos</option>
            <option value="aditivo">Con Aditivos (Urea...)</option>
          </select>
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-2.5 sm:left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <input
              type="text"
              placeholder="Buscar (ej: 185 C)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 text-slate-800 border border-slate-200 rounded-xl pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

      {/* Grid de Pantones (2 columnas compactas en móvil, escalable en tablets y desktop) */}
      <div className="flex-1 overflow-y-auto custom-scrollbar -mx-1 sm:-mx-2 px-1 sm:px-2 pb-4">
        {filteredPantones.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-slate-400 bg-slate-50/50 rounded-2xl sm:rounded-3xl border border-dashed border-slate-200 p-4">
            <BookOpen className="w-10 h-10 text-slate-300 mb-2" />
            <p className="text-sm font-bold text-slate-600">No se encontraron fórmulas</p>
            <p className="text-xs text-slate-400 mt-1">Intenta buscar con otro código o nombre de Pantone.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2 sm:gap-4 lg:gap-5">
              {currentPantones.map((p) => (
                <div
                  key={p.id || p.code}
                  onClick={() => onSelectPantone(p)}
                  className="group flex flex-col items-start p-2.5 sm:p-4 lg:p-5 bg-white rounded-2xl sm:rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-xl hover:border-blue-200 transition-all text-left relative overflow-hidden cursor-pointer w-full select-none"
                >
                  {/* Muestra de color (swatch) */}
                  <div 
                    className="w-full h-20 sm:h-28 md:h-32 rounded-xl sm:rounded-2xl mb-2 sm:mb-3.5 shadow-inner border border-black/5 transition-transform group-hover:scale-[1.02]" 
                    style={{ backgroundColor: p.hex }}
                  />

                  {/* Código y Nombre */}
                  <div className="w-full relative min-w-0">
                    <div className="flex items-start justify-between gap-1 mb-0.5">
                      <h4 className="text-xs sm:text-base md:text-lg font-black text-slate-900 leading-tight truncate">
                        {p.code}
                      </h4>
                      {onDeletePantone && p.id && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`¿Seguro que deseas eliminar el pantone ${p.code}?`)) {
                              onDeletePantone(p.id!);
                            }
                          }}
                          className="p-1 -mr-1 -mt-1 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                          title="Eliminar Pantone"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <p className="text-[10px] sm:text-xs text-slate-500 font-medium truncate mb-2 sm:mb-3">
                      {p.name}
                    </p>
                  </div>
                  
                  {/* Pie de tarjeta con Tipo y cantidad de tintas */}
                  <div className="mt-auto w-full flex items-center justify-between border-t border-slate-100 pt-2 sm:pt-3">
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate mr-1">
                      {(() => {
                        if (p.type) return p.type;
                        const hasReactivo = p.name.toLowerCase().includes('reactiv') || p.formulas?.some(f => 
                          f.component.toLowerCase().includes('reactiv') || 
                          f.description.toLowerCase().includes('reactiv') ||
                          f.component.toLowerCase().includes('alginato') ||
                          f.description.toLowerCase().includes('alginato')
                        );
                        return hasReactivo ? 'Reactivo' : 'Pigmento';
                      })()}
                    </span>
                    <span className="text-[9px] sm:text-[10px] text-blue-700 font-bold bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-md shadow-xs shrink-0">
                      {p.formulas?.length || 0} Tintas
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* Paginación Adaptada */}
            {totalPages > 1 && (
              <div className="flex justify-center items-center gap-2 sm:gap-4 mt-4 sm:mt-8 pb-3">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-[11px] sm:text-xs disabled:opacity-40 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
                >
                  Anterior
                </button>
                <span className="text-[10px] sm:text-xs font-bold text-slate-600 bg-slate-100 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg whitespace-nowrap">
                  {currentPage} / {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl border border-slate-200 text-slate-600 font-bold text-[11px] sm:text-xs disabled:opacity-40 hover:bg-slate-50 hover:text-blue-600 transition-colors shadow-sm cursor-pointer disabled:cursor-not-allowed"
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
