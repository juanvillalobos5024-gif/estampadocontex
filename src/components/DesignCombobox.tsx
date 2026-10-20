import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, ChevronDown, Check, X, Layers, Sparkles } from 'lucide-react';
import { Design } from '../types';

interface DesignComboboxProps {
  designs: Design[];
  selectedDesignId: string;
  onSelectDesign: (design: Design | null) => void;
  required?: boolean;
}

export default function DesignCombobox({
  designs,
  selectedDesignId,
  onSelectDesign,
  required = false
}: DesignComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Ordenar los diseños alfabéticamente de la A a la Z
  const sortedDesigns = useMemo(() => {
    return [...designs].sort((a, b) => 
      a.name.localeCompare(b.name, 'es', { sensitivity: 'base' })
    );
  }, [designs]);

  // Diseño actualmente seleccionado
  const selectedDesign = useMemo(() => {
    return designs.find(d => d.id === selectedDesignId) || null;
  }, [designs, selectedDesignId]);

  // Normalización para búsquedas insensibles a tildes y mayúsculas
  const normalize = (str: string) => 
    (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();

  // Filtrado reactivo en tiempo real con autocompletado
  const filteredDesigns = useMemo(() => {
    const q = normalize(searchQuery);
    if (!q) return sortedDesigns;
    return sortedDesigns.filter(d => {
      const matchName = normalize(d.name).includes(q);
      const matchLine = normalize(d.lineType).includes(q);
      const matchProduct = normalize(d.productType).includes(q);
      return matchName || matchLine || matchProduct;
    });
  }, [sortedDesigns, searchQuery]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset del highlightedIndex cuando cambia el filtrado
  useEffect(() => {
    setHighlightedIndex(0);
  }, [filteredDesigns]);

  // Desplazar automáticamente el elemento resaltado a la vista
  useEffect(() => {
    if (isOpen && listRef.current) {
      const activeItem = listRef.current.children[highlightedIndex] as HTMLElement;
      if (activeItem) {
        activeItem.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [highlightedIndex, isOpen]);

  const handleOpen = () => {
    setIsOpen(true);
    setSearchQuery('');
    setTimeout(() => {
      inputRef.current?.focus();
    }, 50);
  };

  const handleSelect = (design: Design) => {
    onSelectDesign(design);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectDesign(null);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleOpen();
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev + 1) % (filteredDesigns.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev - 1 + filteredDesigns.length) % (filteredDesigns.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredDesigns.length > 0 && highlightedIndex < filteredDesigns.length) {
        handleSelect(filteredDesigns[highlightedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div className="relative w-full" ref={containerRef}>
      {/* Input oculto para soporte nativo de formulario required */}
      <input 
        type="text" 
        value={selectedDesignId} 
        onChange={() => {}} 
        required={required} 
        className="sr-only" 
        tabIndex={-1} 
        aria-hidden="true" 
      />

      {/* Botón / Campo disparador del Combobox */}
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={handleOpen}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        className={`w-full bg-slate-50 border rounded-xl p-2.5 text-xs sm:text-sm font-semibold flex items-center justify-between gap-2 cursor-pointer transition-all ${
          isOpen 
            ? 'border-blue-500 ring-2 ring-blue-500/20 bg-white shadow-sm' 
            : 'border-slate-200 hover:border-slate-300 hover:bg-slate-100/60'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <Layers className="w-4 h-4 text-slate-400 shrink-0" />
          {selectedDesign ? (
            <div className="flex items-center gap-2 min-w-0 flex-1 truncate">
              <span className="font-bold text-slate-900 truncate">{selectedDesign.name}</span>
              <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold uppercase shrink-0 ${
                selectedDesign.lineType === 'reactivo' 
                  ? 'bg-purple-100 text-purple-700' 
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {selectedDesign.lineType}
              </span>
              <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-medium shrink-0 hidden sm:inline">
                {selectedDesign.productType}
              </span>
            </div>
          ) : (
            <span className="text-slate-400 font-normal">Buscar diseño ({designs.length} disponibles A-Z)...</span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {selectedDesign && (
            <button
              type="button"
              onClick={handleClear}
              className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-200/60 transition-colors"
              title="Borrar selección"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Menú Flotante con Barra de Búsqueda y Lista */}
      {isOpen && (
        <div 
          className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-80 animate-in fade-in zoom-in-95 duration-150"
          onKeyDown={handleKeyDown}
        >
          {/* Header con Buscador en tiempo real */}
          <div className="p-2.5 border-b border-slate-100 bg-slate-50/80 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-600 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Escribe para buscar diseño..."
              className="w-full bg-transparent text-xs sm:text-sm font-semibold text-slate-800 placeholder:text-slate-400 outline-none"
            />
            {searchQuery && (
              <button 
                type="button" 
                onClick={() => setSearchQuery('')}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Lista de Opciones Ordenadas Alfabéticamente */}
          <ul 
            ref={listRef}
            role="listbox"
            className="flex-1 overflow-y-auto p-1.5 custom-scrollbar divide-y divide-slate-50"
          >
            {filteredDesigns.length === 0 ? (
              <li className="p-4 text-center text-xs text-slate-400 flex flex-col items-center gap-1">
                <Search className="w-5 h-5 text-slate-300" />
                <span>No se encontraron diseños que coincidan con <strong>"{searchQuery}"</strong></span>
              </li>
            ) : (
              filteredDesigns.map((design, idx) => {
                const isSelected = design.id === selectedDesignId;
                const isHighlighted = idx === highlightedIndex;

                return (
                  <li
                    key={design.id || idx}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => handleSelect(design)}
                    onMouseEnter={() => setHighlightedIndex(idx)}
                    className={`p-2 sm:p-2.5 rounded-xl cursor-pointer text-xs sm:text-sm flex items-center justify-between gap-2 transition-all ${
                      isSelected 
                        ? 'bg-blue-50 text-blue-900 font-bold' 
                        : isHighlighted 
                          ? 'bg-slate-100/80 text-slate-900 font-semibold' 
                          : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="truncate">{design.name}</span>
                      <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono font-bold uppercase shrink-0 ${
                        design.lineType === 'reactivo' 
                          ? 'bg-purple-100 text-purple-700' 
                          : 'bg-blue-100 text-blue-700'
                      }`}>
                        {design.lineType}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono shrink-0 hidden sm:inline">
                        {design.productType}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {design.frames ? (
                        <span className="text-[10px] text-slate-400 font-mono">
                          {design.frames} {design.frames === 1 ? 'color' : 'colores'}
                        </span>
                      ) : null}
                      {isSelected && (
                        <Check className="w-4 h-4 text-blue-600 shrink-0" />
                      )}
                    </div>
                  </li>
                );
              })
            )}
          </ul>

          {/* Footer Informativo con Conteo de Diseños */}
          <div className="px-3 py-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-mono">
            <span>Mostrando {filteredDesigns.length} de {sortedDesigns.length} diseños (A-Z)</span>
            <span className="hidden sm:inline">Usa ↑ ↓ y Enter para elegir</span>
          </div>
        </div>
      )}
    </div>
  );
}
