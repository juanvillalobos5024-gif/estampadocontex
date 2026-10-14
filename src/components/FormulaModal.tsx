import { ReactNode, useEffect } from 'react';
import { X } from 'lucide-react';

interface FormulaModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
}

export default function FormulaModal({ isOpen, onClose, children }: FormulaModalProps) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      // Prevenir scroll en el body cuando el modal está abierto
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'auto';
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      {/* Overlay clickeable para cerrar */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Contenedor del Modal */}
      <div className="relative w-full max-w-5xl h-[90vh] md:h-[80vh] flex flex-col bg-transparent shadow-2xl rounded-3xl overflow-hidden animate-slide-up z-10 pointer-events-none">
        
        {/* Contenido (hacemos que los hijos capturen los clicks) */}
        <div className="flex-1 w-full h-full pointer-events-auto bg-white rounded-3xl overflow-hidden relative">
          
          {/* Botón flotante para cerrar (superpuesto arriba a la derecha) */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 px-2.5 py-1.5 bg-white/80 backdrop-blur-md hover:bg-white text-slate-500 hover:text-slate-900 rounded-full shadow-sm transition-colors border border-slate-200 cursor-pointer flex items-center gap-1.5"
            aria-label="Cerrar detalle"
            title="Cerrar (Esc)"
          >
            <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">Esc</span>
            <X className="w-4 h-4" />
          </button>
          
          {/* Aquí inyectamos el FormulaDetail */}
          <div className="w-full h-full overflow-hidden">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
