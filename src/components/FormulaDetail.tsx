import { useState, useEffect } from 'react';
import { 
  Scale, 
  Settings, 
  Flame, 
  Trash2, 
  Edit2, 
  Calendar, 
  Activity, 
  CheckCircle,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { PantoneColor, TeamMember, BatchLog } from '../types';

interface FormulaDetailProps {
  pantone: PantoneColor | null;
  team: TeamMember[];
  onAddBatch: (batch: BatchLog) => Promise<boolean>;
  onDeletePantone: (id: string) => void;
  onEditPantone: (pantone: PantoneColor) => void;
  onAskAi: (prompt: string) => void;
}

export default function FormulaDetail({
  pantone,
  team,
  onAddBatch,
  onDeletePantone,
  onEditPantone,
  onAskAi
}: FormulaDetailProps) {
  // Estado para la calculadora de peso
  const [totalGrams, setTotalGrams] = useState<number>(1000);
  
  // Estado para registrar preparación de lote
  const [showLogForm, setShowLogForm] = useState(false);
  const [productType, setProductType] = useState<'Toallas' | 'Hamacas'>('Toallas');
  const [piecesQty, setPiecesQty] = useState<number>(100);
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  
  // Estado para confirmación de eliminación segura de color
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Ocultar confirmación de borrado si cambia el tono seleccionado
  useEffect(() => {
    setShowDeleteConfirm(false);
  }, [pantone]);

  // Sincronizar operador inicial del equipo
  useEffect(() => {
    if (team.length > 0 && !selectedOperator) {
      setSelectedOperator(team[0].name);
    }
  }, [team]);

  if (!pantone) {
    return (
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-12 flex flex-col items-center justify-center text-center h-full">
        <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4">
          <Scale className="w-8 h-8 text-blue-500 animate-pulse" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">Ningún Tono Seleccionado</h3>
        <p className="text-sm text-slate-500 max-w-md">
          Selecciona un color Pantone de la lista izquierda para ver su formulación base, calcular mezclas exactas y registrar lotes de producción.
        </p>
      </div>
    );
  }

  // Manejo de guardado de lote de producción
  const handleRegisterBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOperator) return;

    setIsSubmitting(true);
    const newBatch: BatchLog = {
      pantoneCode: pantone.code,
      pantoneHex: pantone.hex,
      productType: productType,
      quantity: piecesQty,
      totalGrammage: totalGrams,
      operator: selectedOperator,
      timestamp: new Date(),
      status: 'Completado'
    };

    const success = await onAddBatch(newBatch);
    setIsSubmitting(false);

    if (success) {
      setSuccessMsg(`¡Mezcla de ${totalGrams}g registrada con éxito! El stock de las tintas ha sido actualizado de manera automática.`);
      setShowLogForm(false);
      setTimeout(() => setSuccessMsg(''), 6000);
    }
  };

  // Generar prompt automático para preguntar a la IA sobre este color específico
  const handleAskConsultant = () => {
    const prompt = `Hola. Necesitamos estampar el tono Pantone ${pantone.code} (${pantone.name}) sobre un lote de ${productType === 'Toallas' ? 'toallas de rizo' : 'hamacas de hilo grueso'}. La fórmula actual es:\n${pantone.formulas.map(f => `- ${f.component}: ${f.percentage}%`).join('\n')}\n¿Qué recomendaciones de malla, temperatura de curado, velocidad de rasero y aditivos nos das para que quede perfecto y no se decolore en las lavadas?`;
    onAskAi(prompt);
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col h-full overflow-hidden" id="formula-detail-card">
      
      {/* Header del Tono */}
      <div className="p-6 bg-slate-50 border-b border-slate-200">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
          <div className="flex gap-4 items-center">
            {/* Color Visual Block */}
            <div 
              className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shadow-md border-4 border-white flex-shrink-0" 
              style={{ backgroundColor: pantone.hex }}
            />
            <div>
              <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-bold uppercase tracking-wider">
                Fórmula Activa
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-slate-900 my-1">{pantone.code}</h2>
              <p className="text-sm text-slate-500 font-semibold">{pantone.name}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 self-stretch sm:self-auto justify-end">
            <button 
              onClick={() => onEditPantone(pantone)}
              className="p-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl hover:text-blue-600 hover:border-blue-200 transition-colors cursor-pointer"
              title="Editar Fórmula"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            {pantone.id && (
              showDeleteConfirm ? (
                <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 p-1.5 rounded-xl animate-fade-in">
                  <span className="text-[10px] text-red-700 font-bold px-1.5">¿Borrar?</span>
                  <button
                    type="button"
                    onClick={() => {
                      onDeletePantone(pantone.id!);
                      setShowDeleteConfirm(false);
                    }}
                    className="bg-red-600 hover:bg-red-700 text-white rounded-lg px-2.5 py-1 text-[10px] font-bold cursor-pointer transition-colors"
                  >
                    Sí
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="bg-white border border-slate-200 text-slate-500 rounded-lg px-2 py-1 text-[10px] font-semibold cursor-pointer hover:bg-slate-50"
                  >
                    No
                  </button>
                </div>
              ) : (
                <button 
                  onClick={() => setShowDeleteConfirm(true)}
                  className="p-2.5 bg-white border border-slate-200 text-red-500 rounded-xl hover:bg-red-50 hover:border-red-200 transition-colors cursor-pointer"
                  title="Eliminar Fórmula"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Notificación de éxito */}
        {successMsg && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 rounded-2xl flex items-start gap-3 shadow-sm animate-fade-in">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="text-xs font-semibold">{successMsg}</div>
          </div>
        )}

        {/* Tabla de Formulación y Calculadora */}
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Formulación y Pesaje de Color</h3>
              <p className="text-xs text-slate-400">Introduce el peso total para recalcular los gramos de cada ingrediente.</p>
            </div>
            
            {/* Input de gramos rápidos */}
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-1.5 border border-slate-200 self-start sm:self-auto">
              <Scale className="w-4 h-4 text-slate-500" />
              <input
                type="number"
                value={totalGrams}
                onChange={(e) => setTotalGrams(Math.max(1, Number(e.target.value)))}
                className="w-16 bg-transparent text-slate-800 border-none font-mono text-sm focus:outline-none text-right font-bold"
                min="1"
              />
              <span className="text-xs font-bold text-slate-500">gramos</span>
            </div>
          </div>

          <div className="overflow-x-auto border border-slate-100 rounded-2xl">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest">
                  <th className="py-3 px-4 font-semibold">Componente / Tinta</th>
                  <th className="py-3 px-4 font-semibold">Función</th>
                  <th className="py-3 px-4 font-semibold text-right">Proporción (%)</th>
                  <th className="py-3 px-4 font-semibold text-right">Peso Calculado (g)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {pantone.formulas.map((f, idx) => {
                  const calculatedGrams = ((f.percentage * totalGrams) / 100).toFixed(1);
                  return (
                    <tr key={idx} className="hover:bg-slate-50/40">
                      <td className="py-3.5 px-4 font-bold text-slate-800">{f.component}</td>
                      <td className="py-3.5 px-4 text-slate-500">{f.description}</td>
                      <td className="py-3.5 px-4 text-right font-mono text-slate-600">{f.percentage.toFixed(2)}%</td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-blue-600 bg-blue-50/30">{calculatedGrams}g</td>
                    </tr>
                  );
                })}
                <tr className="bg-slate-50 font-bold text-slate-900 border-t border-slate-200">
                  <td className="py-3 px-4">Total</td>
                  <td className="py-3 px-4 text-slate-400 font-normal">Fórmula completa</td>
                  <td className="py-3 px-4 text-right font-mono">100.00%</td>
                  <td className="py-3 px-4 text-right font-mono text-blue-700">{totalGrams.toFixed(1)}g</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Sección de Acción: Registrar Mezcla de Lote */}
        <div className="bg-slate-50 border border-slate-200 rounded-3xl p-5">
          {!showLogForm ? (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wide">¿Preparar esta mezcla en taller?</h4>
                <p className="text-[11px] text-slate-500 mt-1">Registra la mezcla para guardar historial de lotes y descontar inventario de tintas.</p>
              </div>
              <button 
                onClick={() => setShowLogForm(true)}
                className="bg-slate-900 text-white hover:bg-slate-800 transition-colors px-4 py-2 rounded-xl text-xs font-bold cursor-pointer shrink-0"
              >
                Registrar Preparación
              </button>
            </div>
          ) : (
            <form onSubmit={handleRegisterBatch} className="space-y-4">
              <h4 className="text-xs font-extrabold text-slate-900 uppercase border-b border-slate-200 pb-2">Registrar Lote de Producción</h4>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Producto</label>
                  <select 
                    value={productType}
                    onChange={(e) => setProductType(e.target.value as 'Toallas' | 'Hamacas')}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none"
                  >
                    <option value="Toallas">Toallas</option>
                    <option value="Hamacas">Hamacas</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cantidad Piezas</label>
                  <input 
                    type="number"
                    value={piecesQty}
                    onChange={(e) => setPiecesQty(Math.max(1, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none font-semibold text-slate-800"
                    min="1"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Operador / Mezclador</label>
                  <select 
                    value={selectedOperator}
                    onChange={(e) => setSelectedOperator(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-lg p-2 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none font-semibold text-slate-800"
                    required
                  >
                    <option value="" disabled>Seleccionar...</option>
                    {team.map((t) => (
                      <option key={t.name} value={t.name}>{t.name} ({t.role})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center bg-blue-50/50 rounded-xl p-3 border border-blue-100 text-xs">
                <span className="text-blue-800 font-medium">Se descontarán proporcionalmente de inventario <strong>{totalGrams}g</strong> de tintas.</span>
              </div>

              <div className="flex justify-end gap-2">
                <button 
                  type="button"
                  onClick={() => setShowLogForm(false)}
                  className="bg-white border border-slate-200 text-slate-500 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-blue-600 text-white rounded-xl px-4 py-1.5 text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Guardando...' : 'Confirmar y Descontar Stock'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Nota de laboratorio y recomendación de IA */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" />
              <p className="text-[10px] text-amber-800 font-bold uppercase tracking-wider italic">⚠️ Nota de Laboratorio</p>
            </div>
            <p className="text-xs text-amber-700 leading-relaxed font-medium">
              {pantone.notes || 'No hay notas técnicas ingresadas para este color. Se aconseja registrar las particularidades del tejido de toalla o hamaca aquí.'}
            </p>
          </div>

          <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="w-4 h-4 text-blue-600" />
                <p className="text-[10px] text-blue-800 font-bold uppercase tracking-wider italic">Consultar Experto en Serigrafía</p>
              </div>
              <p className="text-xs text-blue-700 leading-relaxed mb-3">
                ¿Tienes dudas sobre cómo adherir este Pantone sobre felpa rizada de toalla o hilos de hamacas de algodón? Consulta a nuestro experto de IA.
              </p>
            </div>
            <button 
              onClick={handleAskConsultant}
              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-3 rounded-xl transition-all self-start flex items-center gap-1.5 cursor-pointer shadow-sm shadow-blue-500/10"
            >
              Preguntar a la IA ⚡
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
