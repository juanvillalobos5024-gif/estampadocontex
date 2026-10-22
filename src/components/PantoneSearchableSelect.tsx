import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, X, Palette } from 'lucide-react';
import { PantoneColor } from '../types';

interface PantoneSearchableSelectProps {
  pantones: PantoneColor[];
  value: string;
  onChange: (pantoneCode: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  className?: string;
}

export default function PantoneSearchableSelect({
  pantones,
  value,
  onChange,
  placeholder = 'Selecciona o busca un tono Pantone...',
  required = false,
  disabled = false,
  className = ''
}: PantoneSearchableSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Encontrar el objeto Pantone actualmente seleccionado
  const selectedPantone = useMemo(() => {
    if (!value) return null;
    const clean = value.toLowerCase().trim();
    return pantones.find(p => p.code.toLowerCase().trim() === clean) || null;
  }, [value, pantones]);

  // Filtrar pantones en tiempo real
  const filteredPantones = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return pantones;

    return pantones.filter(p => {
      const codeMatch = p.code.toLowerCase().includes(q);
      const nameMatch = (p.name || '').toLowerCase().includes(q);
      const typeMatch = (p.type || '').toLowerCase().includes(q);
      return codeMatch || nameMatch || typeMatch;
    });
  }, [pantones, searchQuery]);

  // Enfocar el input de búsqueda al abrir
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setHighlightedIndex(0);
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Manejo de teclado (Flechas, Enter, Escape)
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === ' ') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1 < filteredPantones.length ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 >= 0 ? prev - 1 : filteredPantones.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredPantones[highlightedIndex]) {
        handleSelect(filteredPantones[highlightedIndex].code);
      }
    }
  };

  const handleSelect = (code: string) => {
    onChange(code);
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`} onKeyDown={handleKeyDown}>
      {/* Botón Disparador del Selector (Touch Target amigable >= 44px) */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full min-h-[44px] px-3 py-2 bg-white border rounded-xl text-left transition-all flex items-center justify-between gap-2.5 cursor-pointer shadow-2xs select-none ${
          isOpen
            ? 'border-blue-500 ring-2 ring-blue-500/20'
            : selectedPantone
            ? 'border-slate-300 hover:border-slate-400'
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-60 cursor-not-allowed bg-slate-50' : ''}`}
      >
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          {/* Muestra visual de color (Swatch) */}
          <div
            className="w-7 h-7 rounded-lg border border-black/15 shadow-xs shrink-0 flex items-center justify-center transition-transform"
            style={{ backgroundColor: selectedPantone?.hex || '#e2e8f0' }}
            title={selectedPantone ? `Tono: ${selectedPantone.code} (${selectedPantone.hex})` : 'Sin color'}
          >
            {!selectedPantone && (
              <Palette className="w-3.5 h-3.5 text-slate-400" />
            )}
          </div>

          {/* Información del tono */}
          {selectedPantone ? (
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-black text-sm text-slate-900 tracking-tight leading-tight">
                  {selectedPantone.code}
                </span>
                {selectedPantone.type && (
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    selectedPantone.type.toLowerCase() === 'reactivo'
                      ? 'bg-purple-50 text-purple-700 border border-purple-200'
                      : 'bg-orange-50 text-orange-700 border border-orange-200'
                  }`}>
                    {selectedPantone.type}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 truncate leading-tight mt-0.5 font-medium">
                {selectedPantone.name || 'Sin nombre descriptivo'}
              </p>
            </div>
          ) : (
            <span className="text-xs sm:text-sm text-slate-400 font-medium truncate">
              {placeholder}
            </span>
          )}
        </div>

        {/* Acciones de la derecha */}
        <div className="flex items-center gap-1 shrink-0 text-slate-400">
          {selectedPantone && !disabled && (
            <span
              onClick={handleClear}
              className="p-1 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
              title="Limpiar selección"
            >
              <X className="w-3.5 h-3.5" />
            </span>
          )}
          <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-600' : ''}`} />
        </div>
      </button>

      {/* Input oculto para validación de formularios requeridos nativa */}
      {required && (
        <input
          type="text"
          value={value}
          required={required}
          onChange={() => {}}
          tabIndex={-1}
          className="sr-only"
        />
      )}

      {/* Menú Desplegable con Buscador Predictivo */}
      {isOpen && (
        <div className="absolute z-50 left-0 right-0 top-full mt-1.5 bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden animate-fade-in flex flex-col max-h-80 sm:max-h-96">
          {/* Barra de Búsqueda Predictiva */}
          <div className="p-2.5 bg-slate-50 border-b border-slate-100 shrink-0">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Escribe código o nombre (ej: 185, Rojo, Azul)..."
                className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder:text-slate-400"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-slate-600 rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="flex items-center justify-between text-[10px] text-slate-400 font-semibold mt-1.5 px-1">
              <span>{filteredPantones.length} tonos encontrados</span>
              <span>Usa ↑↓ y Enter para navegar</span>
            </div>
          </div>

          {/* Lista de Tonos Pantone con Pastilla de Color (Touch targets >= 44px) */}
          <div ref={listRef} className="overflow-y-auto p-1.5 space-y-1 custom-scrollbar flex-1">
            {filteredPantones.length === 0 ? (
              <div className="py-8 px-4 text-center text-slate-400">
                <Palette className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                <p className="text-xs font-bold text-slate-600">No se encontró ningún Pantone</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Verifica el código o intenta buscar por otro nombre.
                </p>
              </div>
            ) : (
              filteredPantones.map((p, idx) => {
                const isSelected = selectedPantone?.code === p.code;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <button
                    key={p.code + idx}
                    type="button"
                    onClick={() => handleSelect(p.code)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-left flex items-center justify-between gap-3 transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-blue-50 border border-blue-200'
                        : isHighlighted
                        ? 'bg-slate-100/80'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Pastilla / Swatch de Color */}
                      <div
                        className="w-8 h-8 rounded-lg border border-black/15 shadow-xs shrink-0 flex items-center justify-center font-black text-white text-[10px]"
                        style={{ backgroundColor: p.hex || '#ccc' }}
                      />

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-xs sm:text-sm text-slate-900 leading-tight">
                            {p.code}
                          </span>
                          {p.type && (
                            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                              p.type.toLowerCase() === 'reactivo'
                                ? 'bg-purple-100 text-purple-700'
                                : 'bg-orange-100 text-orange-700'
                            }`}>
                              {p.type}
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-500 truncate leading-tight mt-0.5 font-medium">
                          {p.name || 'Sin nombre descriptivo'}
                        </p>
                      </div>
                    </div>

                    {/* Check de seleccionado */}
                    {isSelected && (
                      <span className="w-5 h-5 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
