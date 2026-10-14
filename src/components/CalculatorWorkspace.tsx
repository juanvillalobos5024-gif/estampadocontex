import { useState, useEffect } from 'react';
import { 
  Scale, 
  Search,
  ArrowLeft,
  CheckCircle,
  Circle,
  Edit2,
  Trash2,
  Plus,
  Zap,
  Recycle,
  X,
  ChevronRight
} from 'lucide-react';
import { PantoneColor, TeamMember, BatchLog, Design } from '../types';

interface CalculatorWorkspaceProps {
  pantones: PantoneColor[];
  designs?: Design[];
  pantone: PantoneColor | null;
  onSelectPantone: (pantone: PantoneColor | null) => void;
  team: TeamMember[];
  onAddBatch: (batch: BatchLog) => Promise<boolean>;
  onDeletePantone: (id: string) => void;
  onEditPantone: (pantone: PantoneColor) => void;
  onOpenCreateModal: () => void;
  initialOrderParams?: {
    grams: number;
    lineType: 'pigmento' | 'reactivo';
    productType: 'Toallas' | 'Otros';
    productRef: string;
    pieces: number;
    workOrderId: string;
    designId?: string;
  } | null;
  onClearInitialOrderParams?: () => void;
}

export default function CalculatorWorkspace({
  pantones,
  designs = [],
  pantone,
  onSelectPantone,
  team,
  onAddBatch,
  onDeletePantone,
  onEditPantone,
  onOpenCreateModal,
  initialOrderParams,
  onClearInitialOrderParams
}: CalculatorWorkspaceProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  // Design sub-tasks state
  const [activeDesign, setActiveDesign] = useState<Design | null>(null);
  const [completedColors, setCompletedColors] = useState<string[]>([]);
  const [currentDesignColorIndex, setCurrentDesignColorIndex] = useState<number>(0);

  // States for workspace
  const [totalGrams, setTotalGrams] = useState<number>(1000);
  const [checkedIngredients, setCheckedIngredients] = useState<Record<number, boolean>>({});
  
  // Batch logging states
  const [productType, setProductType] = useState<'Toallas' | 'Otros'>('Toallas');
  const [lineType, setLineType] = useState<'pigmento' | 'reactivo'>('pigmento');
  const [productReference, setProductReference] = useState('');
  const [piecesQty, setPiecesQty] = useState<number>(100);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // ── RESCALE STATE ──
  const [showRescale, setShowRescale] = useState(false);
  const [rescaleTarget, setRescaleTarget] = useState<string>('');
  const [rescaleMsg, setRescaleMsg] = useState('');

  // ── WASTE / MERMA STATE ──
  const [wasteGrams, setWasteGrams] = useState<string>('');

  // Manejo de la tecla Escape (Esc) para cerrar modales y cancelar confirmaciones
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (successMsg) {
          setSuccessMsg('');
          if (!activeDesign || (activeDesign && completedColors.length >= activeDesign.colors.length)) {
            onSelectPantone(null);
            if (onClearInitialOrderParams) onClearInitialOrderParams();
          }
        } else if (showDeleteConfirm) {
          setShowDeleteConfirm(false);
        } else if (showRescale) {
          setShowRescale(false);
        }
      }
    };

    if (successMsg) {
      document.body.style.overflow = 'hidden';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (successMsg) {
        document.body.style.overflow = 'auto';
      }
    };
  }, [successMsg, showDeleteConfirm, showRescale, activeDesign, completedColors, onSelectPantone, onClearInitialOrderParams]);
  const [showRecyclePrompt, setShowRecyclePrompt] = useState(false);
  const [recycleAccepted, setRecycleAccepted] = useState<boolean | null>(null);

  // ── INIT FROM ORDERS ──
  useEffect(() => {
    if (initialOrderParams) {
      if (initialOrderParams.designId) {
        const design = designs.find(d => d.id === initialOrderParams.designId);
        if (design) {
          setActiveDesign(design);
          setLineType(design.lineType);
          setProductType(design.productType as any);
          setProductReference(initialOrderParams.productRef);
          setPiecesQty(initialOrderParams.pieces);
          setCompletedColors([]);
          setCurrentDesignColorIndex(0);
          
          if (design.colors.length > 0) {
            const firstColorCode = design.colors[0].pantoneCode;
            const p = pantones.find(p => p.code === firstColorCode);
            if (p) {
              onSelectPantone(p);
              setTotalGrams(design.colors[0].gramsPerPiece * initialOrderParams.pieces);
            }
          }
        }
      } else if (pantone) {
        setTotalGrams(initialOrderParams.grams);
        setLineType(initialOrderParams.lineType);
        setProductType(initialOrderParams.productType);
        setProductReference(initialOrderParams.productRef);
        setPiecesQty(initialOrderParams.pieces);
      }
      if (onClearInitialOrderParams) onClearInitialOrderParams();
    }
  }, [initialOrderParams, pantone, designs]);



  // Reset checked ingredients when pantone changes or grams change
  useEffect(() => {
    setCheckedIngredients({});
  }, [pantone, totalGrams]);

  // Check if all ingredients (including missing base if any) are weighed
  const allWeighed = (() => {
    if (!pantone || pantone.formulas.length === 0) return false;
    const itemsCount = pantone.formulas.reduce((acc, f) => acc + f.percentage, 0) < 99.9 
      ? pantone.formulas.length + 1 
      : pantone.formulas.length;
    
    let checkedCount = 0;
    pantone.formulas.forEach((_, idx) => { if (checkedIngredients[idx]) checkedCount++; });
    if (checkedIngredients[999]) checkedCount++;
    
    return checkedCount === itemsCount;
  })();

  // ── RESCALE HANDLER ──
  const handleRescale = () => {
    const target = Number(rescaleTarget);
    if (!target || target <= 0) return;
    const factor = (target / totalGrams).toFixed(2);
    setTotalGrams(target);
    setRescaleMsg(`Factor ×${factor} aplicado — Todos los gramos recalculados a ${target}g.`);
    setRescaleTarget('');
    setShowRescale(false);
    setTimeout(() => setRescaleMsg(''), 5000);
  };

  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pantone) return;

    setIsSubmitting(true);
    const newBatch: BatchLog = {
      pantoneCode: pantone.code,
      pantoneHex: pantone.hex,
      productType: productType,
      lineType: lineType,
      quantity: piecesQty,
      totalGrammage: totalGrams,
      operator: 'Laboratorio',
      timestamp: new Date(),
      status: 'Completado',
      type: 'preparacion'
    };
    if (productReference) {
      newBatch.productReference = productReference;
    }

    const success = await onAddBatch(newBatch);
    setIsSubmitting(false);

    if (success) {
      if (activeDesign) {
        const newCompleted = [...completedColors, pantone.code];
        setCompletedColors(newCompleted);
        let msg = `¡Color ${pantone.code} registrado con éxito!`;
        if (Number(wasteGrams) > 0) {
          msg += ` Merma: ${Number(wasteGrams)}g.`;
        }
        
        if (newCompleted.length >= activeDesign.colors.length) {
           msg += ' ¡Diseño completado totalmente!';
           setSuccessMsg(msg);
        } else {
           setSuccessMsg(msg);
           
           // Select next color
           const nextColorIndex = currentDesignColorIndex + 1;
           setCurrentDesignColorIndex(nextColorIndex);
           const nextColorCode = activeDesign.colors[nextColorIndex].pantoneCode;
           const p = pantones.find(x => x.code === nextColorCode);
           if (p) {
             onSelectPantone(p);
             setTotalGrams(activeDesign.colors[nextColorIndex].gramsPerPiece * piecesQty);
             setCheckedIngredients({});
             setWasteGrams('');
             setRecycleAccepted(null);
             setShowRecyclePrompt(false);
           }
        }
      } else {
        let msg = `¡Mezcla de ${totalGrams}g registrada con éxito! El stock ha sido actualizado.`;
        if (Number(wasteGrams) > 0) {
          msg += ` Merma registrada: ${Number(wasteGrams)}g.`;
          if (recycleAccepted) msg += ' Sobrante catalogado como Tinta Reciclada.';
        }
        setSuccessMsg(msg);
        setCheckedIngredients({});
        setProductReference('');
        setWasteGrams('');
        setRecycleAccepted(null);
        setShowRecyclePrompt(false);
      }
    }
  };

  const toggleCheck = (idx: number) => {
    setCheckedIngredients(prev => ({
      ...prev,
      [idx]: !prev[idx]
    }));
  };

  // -----------------------------------------------------
  // VIEW: SEARCH
  // -----------------------------------------------------
  if (!pantone) {
    const filtered = pantones.filter(p => 
      p.code.toLowerCase().includes(searchTerm.toLowerCase()) || 
      p.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="h-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col items-center justify-start p-8 overflow-y-auto custom-scrollbar">
        <div className="w-full max-w-3xl flex flex-col items-center text-center mt-4 sm:mt-12">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mb-6 shrink-0">
            <Scale className="w-10 h-10 text-blue-600" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-3">Laboratorio de Pesaje</h2>
          <p className="text-slate-500 mb-8 max-w-lg">
            Busca la fórmula que deseas preparar. El sistema te guiará paso a paso en el pesaje y descontará los ingredientes del inventario automáticamente.
          </p>
          
          <div className="w-full relative mb-8">
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 w-6 h-6" />
            <input
              type="text"
              placeholder="Buscar código Pantone o nombre..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl pl-14 pr-6 py-4 text-lg font-medium focus:ring-4 focus:ring-blue-100 focus:border-blue-500 outline-none transition-all shadow-inner"
              autoFocus
            />
          </div>

          <div className="w-full text-left space-y-3 max-h-[40vh] overflow-y-auto custom-scrollbar pr-2">
            {searchTerm && filtered.length === 0 && (
              <p className="text-center text-slate-400 py-4">No se encontró ninguna fórmula con ese criterio.</p>
            )}
            {searchTerm && filtered.slice(0, 10).map(p => (
              <button
                key={p.id || p.code}
                onClick={() => onSelectPantone(p)}
                className="w-full bg-white border border-slate-100 p-4 rounded-2xl hover:border-blue-300 hover:shadow-md transition-all flex items-center justify-between cursor-pointer group"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl shadow-inner border border-slate-100" style={{ backgroundColor: p.hex }} />
                  <div className="text-left">
                    <h4 className="text-lg font-bold text-slate-900 group-hover:text-blue-700 transition-colors">{p.code}</h4>
                    <p className="text-xs font-semibold text-slate-500">{p.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-xs text-blue-600 font-bold bg-blue-50 px-2.5 py-1 rounded-lg">Seleccionar</span>
                </div>
              </button>
            ))}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-100 w-full flex justify-center">
            <button
              onClick={onOpenCreateModal}
              className="flex items-center gap-2 text-slate-500 hover:text-blue-600 font-bold text-sm bg-slate-50 hover:bg-blue-50 px-6 py-3 rounded-full transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Crear nueva fórmula desde cero
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------
  // VIEW: WORKSPACE (WEIGHING)
  // -----------------------------------------------------
  return (
    <div className="h-full bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
      
      {/* HEADER */}
      <div className="p-4 sm:p-6 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <button 
            onClick={() => {
              onSelectPantone(null);
              setSuccessMsg('');
            }}
            className="p-2 bg-white rounded-xl border border-slate-200 text-slate-500 hover:text-slate-900 shadow-sm cursor-pointer"
            title="Volver al buscador"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-3">
            {activeDesign ? (
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-12 h-12 rounded-xl shadow-inner border-2 border-white bg-purple-100 text-purple-600 font-bold text-xl">
                  D
                </div>
                <div>
                  <h2 className="text-xl font-black text-slate-900 leading-tight">{activeDesign.name}</h2>
                  <p className="text-xs font-semibold text-slate-500">
                    Color actual: {pantone.code} ({currentDesignColorIndex + 1}/{activeDesign.colors.length})
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="w-12 h-12 rounded-xl shadow-inner border-2 border-white" style={{ backgroundColor: pantone.hex }} />
                <div>
                  <h2 className="text-xl font-black text-slate-900 leading-tight">{pantone.code}</h2>
                  <p className="text-xs font-semibold text-slate-500">{pantone.name}</p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <button 
            onClick={() => onEditPantone(pantone)}
            className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-colors cursor-pointer shadow-sm"
            title="Editar Fórmula"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          {pantone.id && !activeDesign && (
            showDeleteConfirm ? (
              <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 p-1.5 rounded-xl">
                <span className="text-[10px] text-red-700 font-bold px-1.5">¿Borrar?</span>
                <button
                  onClick={() => {
                    onDeletePantone(pantone.id!);
                    setShowDeleteConfirm(false);
                    onSelectPantone(null);
                  }}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer"
                >
                  Sí
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="bg-white border border-slate-200 text-slate-500 rounded-lg px-2 py-1 text-[10px] font-semibold cursor-pointer"
                >
                  No
                </button>
              </div>
            ) : (
              <button 
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2.5 bg-white border border-slate-200 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer shadow-sm"
                title="Eliminar Fórmula"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )
          )}
        </div>
      </div>

      {/* CONTENT */}
      <div className="flex-1 overflow-y-auto flex flex-col lg:flex-row">
        
        {/* Left Column: Settings */}
        <div className="w-full lg:w-1/3 p-6 border-b lg:border-b-0 lg:border-r border-slate-100 bg-slate-50/30 space-y-5">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Scale className="w-4 h-4 text-blue-600" />
            Configuración de Lote
          </h3>

          {activeDesign && (
            <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-sm bg-purple-50/30">
              <label className="block text-xs font-bold text-purple-700 uppercase tracking-wide mb-3">
                Progreso del Diseño
              </label>
              <div className="space-y-2">
                {activeDesign.colors.map((c, idx) => {
                  const isCompleted = completedColors.includes(c.pantoneCode);
                  const isCurrent = currentDesignColorIndex === idx;
                  return (
                    <div key={idx} className={`flex items-center gap-2 text-sm p-2 rounded-lg ${isCurrent ? 'bg-purple-100 border border-purple-200' : ''}`}>
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-emerald-500" />
                      ) : isCurrent ? (
                        <Circle className="w-4 h-4 text-purple-500 fill-purple-100" />
                      ) : (
                        <Circle className="w-4 h-4 text-slate-300" />
                      )}
                      <span className={`font-semibold ${isCompleted ? 'text-slate-400 line-through' : isCurrent ? 'text-purple-900 font-bold' : 'text-slate-600'}`}>
                        {c.pantoneCode}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Kilos + Reescala */}
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Kilos a Preparar
              </label>
              <button
                type="button"
                onClick={() => { setShowRescale(!showRescale); setRescaleMsg(''); }}
                className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg hover:bg-amber-100 transition-colors"
                title="Reescalar fórmula"
              >
                <Zap className="w-3 h-3" /> Reescalar
              </button>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="number"
                value={totalGrams / 1000}
                onChange={(e) => setTotalGrams(Math.max(1, Number(e.target.value) * 1000))}
                className="w-full bg-slate-50 text-slate-900 border border-slate-200 rounded-xl px-4 py-3 text-2xl font-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white text-right transition-all"
                min="0.001"
                step="0.01"
                disabled={activeDesign !== null}
              />
              <span className="text-lg font-bold text-slate-400">Kg</span>
            </div>

            {/* Panel de Reescala */}
            {showRescale && (
              <div className="mt-3 p-3 bg-amber-50 border border-amber-200 rounded-xl space-y-2">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide">Nueva cantidad objetivo</p>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={rescaleTarget}
                    onChange={e => setRescaleTarget(e.target.value)}
                    placeholder="Ej: 3500"
                    className="flex-1 bg-white border border-amber-200 rounded-lg px-3 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-amber-400"
                    min="1"
                    autoFocus
                  />
                  <span className="text-sm font-bold text-amber-700 self-center">g</span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleRescale}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white rounded-lg py-1.5 text-xs font-bold transition-colors"
                  >
                    <ChevronRight className="w-3.5 h-3.5" /> Aplicar Escala
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRescale(false)}
                    className="p-1.5 text-amber-600 hover:bg-amber-100 rounded-lg"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {rescaleMsg && (
              <p className="mt-2 text-[11px] text-amber-700 font-bold bg-amber-50 rounded-lg px-2 py-1.5 border border-amber-100">
                ⚡ {rescaleMsg}
              </p>
            )}

            {!showRescale && !rescaleMsg && (
              <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">
                Modificar este valor reiniciará el checklist de pesaje.
              </p>
            )}
          </div>

        </div>

        {/* Right Column: Weighing Checklist & Submit */}
        <div className="w-full lg:w-2/3 p-6 flex flex-col">


          <div className="mb-4">
            <h3 className="text-sm font-bold text-slate-900">Checklist de Pesaje</h3>
            <p className="text-xs text-slate-500">Marca cada tinta conforme la agregues a la báscula para habilitar el registro.</p>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar mb-6">
            {(() => {
              const items = pantone.formulas.map((f, idx) => {
                const calculatedGrams = ((totalGrams / 1000) * f.percentage).toFixed(2);
                const isChecked = checkedIngredients[idx];
                return {
                  idx,
                  component: f.component,
                  percentage: f.percentage,
                  calculatedGrams,
                  isChecked
                };
              });

              return items.map((item) => (
                <button
                  key={item.idx}
                  onClick={() => toggleCheck(item.idx)}
                  className={`w-full text-left flex items-center gap-4 p-4 rounded-2xl border-2 transition-all cursor-pointer ${
                    item.isChecked 
                      ? 'bg-emerald-50/50 border-emerald-200 shadow-sm' 
                      : 'bg-white border-slate-100 hover:border-slate-200 hover:bg-slate-50 shadow-sm'
                  }`}
                >
                  <div className="shrink-0">
                    {item.isChecked ? (
                      <CheckCircle className="w-7 h-7 text-emerald-500" />
                    ) : (
                      <Circle className="w-7 h-7 text-slate-300" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className={`text-lg font-bold ${item.isChecked ? 'text-emerald-900' : 'text-slate-800'}`}>
                      {item.component}
                    </h4>
                    <p className={`text-xs ${item.isChecked ? 'text-emerald-700/70' : 'text-slate-500'}`}>
                      {item.percentage.toFixed(2)} g/Kg
                    </p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black font-mono tracking-tight ${item.isChecked ? 'text-emerald-700' : 'text-blue-600'}`}>
                      {item.calculatedGrams}g
                    </span>
                  </div>
                </button>
              ));
            })()}
          </div>

          {/* Modal de reciclaje */}
          {showRecyclePrompt && (
            <div className="mb-4 bg-emerald-50 border border-emerald-300 rounded-2xl p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Recycle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-emerald-900">Sobrante de {wasteGrams}g detectado</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    ¿Deseas catalogar este sobrante como <strong>Tinta Reciclada (Gris/Oscuro)</strong> y sumarlo al stock para reutilizar en bases o tonos oscuros?
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => { setRecycleAccepted(true); setShowRecyclePrompt(false); }}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 text-xs font-bold transition-colors"
                >
                  ✓ Sí, añadir al stock
                </button>
                <button
                  type="button"
                  onClick={() => { setRecycleAccepted(false); setShowRecyclePrompt(false); }}
                  className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-xl py-2 text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  No, solo registrar merma
                </button>
              </div>
            </div>
          )}

          <div className="mt-auto bg-slate-50 rounded-2xl p-5 border border-slate-200">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div>
                <p className="text-sm font-bold text-slate-900">
                  {allWeighed ? '¡Pesaje Completado!' : 'Pesaje en proceso...'}
                </p>
                <p className="text-[11px] text-slate-500">
                  Total en báscula: <strong className="font-mono">{totalGrams.toFixed(1)}g</strong>
                  {Number(wasteGrams) > 0 && (
                    <span className="ml-2 text-emerald-600">· Merma: {wasteGrams}g</span>
                  )}
                </p>
              </div>
              <button
                onClick={handleRegisterBatch}
                disabled={!allWeighed || isSubmitting}
                className={`px-8 py-3.5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 shadow-lg cursor-pointer ${
                  allWeighed
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-600/20'
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                }`}
              >
                {isSubmitting ? 'Registrando...' : 'Confirmar Lote y Descontar Tintas'}
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-3 text-right">
              Nota: Solo presiona este botón si preparaste la mezcla físicamente. Esto descontará el inventario y generará un reporte de producción.
            </p>
          </div>

        </div>
      </div>

      {/* Modal de Éxito */}
      {successMsg && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => {
            setSuccessMsg('');
            if (!activeDesign || (activeDesign && completedColors.length >= activeDesign.colors.length)) {
              onSelectPantone(null);
              if (onClearInitialOrderParams) onClearInitialOrderParams();
            }
          }}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center border border-emerald-100 flex flex-col items-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <CheckCircle className="w-10 h-10 text-emerald-600" />
            </div>
            <h3 className="text-2xl font-black text-slate-900 mb-2">¡Lote Confirmado!</h3>
            <p className="text-slate-500 mb-8 font-medium">{successMsg}</p>
            <button
              onClick={() => {
                setSuccessMsg('');
                if (!activeDesign || (activeDesign && completedColors.length >= activeDesign.colors.length)) {
                  onSelectPantone(null);
                  if (onClearInitialOrderParams) onClearInitialOrderParams();
                }
              }}
              className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 transition-all cursor-pointer flex items-center justify-center gap-2"
              title="Cerrar (Esc)"
            >
              <span>{activeDesign && completedColors.length < activeDesign.colors.length ? 'Siguiente Color' : 'Cerrar Calculadora'}</span>
              <span className="text-xs bg-emerald-700/60 text-white px-2 py-0.5 rounded-md font-mono">Esc</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
