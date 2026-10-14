import React, { useState, useEffect } from 'react';
import { Calculator, Factory, Droplet, Package, BarChart, ArrowRight, Save, Plus, Trash2, CheckCircle, AlertTriangle } from 'lucide-react';
import { PantoneColor, StockItem } from '../types';
import { findMatchingStockItem } from '../lib/dataService';

interface ProyeccionConsumoProps {
  pantones: PantoneColor[];
  stock: StockItem[];
  onExecuteProduction: (consumosCalculados: {stockId: string, qty: number}[], batchLogsData: any[]) => Promise<boolean>;
}

export default function ProyeccionConsumo({ pantones, stock, onExecuteProduction }: ProyeccionConsumoProps) {
  const [unidades, setUnidades] = useState<number>(10000);
  const [selectedColors, setSelectedColors] = useState<{pantoneId: string, gramsPerUnit: number}[]>([
    { pantoneId: '', gramsPerUnit: 201 }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  const handleAddColor = () => {
    setSelectedColors([...selectedColors, { pantoneId: '', gramsPerUnit: 0 }]);
  };

  const handleRemoveColor = (index: number) => {
    setSelectedColors(selectedColors.filter((_, i) => i !== index));
  };

  const updateColor = (index: number, field: string, value: any) => {
    const newColors = [...selectedColors];
    newColors[index] = { ...newColors[index], [field]: value };
    setSelectedColors(newColors);
  };

  const isBaseComponent = (componentName: string, description: string) => {
    const term = `${componentName} ${description}`.toLowerCase();
    return term.includes('base') || term.includes('espesante') || term.includes('clear') || term.includes('vehiculo') || term.includes('agua');
  };

  // --- CÁLCULOS MULTICOLOR ---
  let totalKgAllColors = 0;
  
  // Mapa para acumular ingredientes idénticos de diferentes marcos
  // Clave: nombre del componente, Valor: { description, totalKg, isBase, matchStockId }
  const ingredientAggregation = new Map<string, { description: string, totalKg: number, isBase: boolean, matchStockId?: string, currentStockKg?: number }>();
  const validSelections = selectedColors.filter(c => c.pantoneId !== '' && c.gramsPerUnit > 0);

  const batchLogsToCreate: any[] = [];

  validSelections.forEach(selection => {
    const p = pantones.find(pant => pant.id === selection.pantoneId);
    if (!p) return;

    const consumoTotalKg = (unidades * selection.gramsPerUnit) / 1000;
    totalKgAllColors += consumoTotalKg;

    // Inferir si es Reactivo o Pigmentos basado en la fórmula
    const isReactive = p.formulas.some(f => 
      f.component.toLowerCase().includes('reactivo') || 
      f.description.toLowerCase().includes('reactivo') ||
      f.component.toLowerCase().includes('alginato') ||
      f.description.toLowerCase().includes('alginato')
    );
    const inferredLineType = isReactive ? 'reactivo' : 'pigmento';

    // Para el historial de lotes (Dashboard)
    batchLogsToCreate.push({
      pantoneCode: p.code,
      pantoneHex: p.hex,
      productType: 'Toallas',
      lineType: inferredLineType,
      quantity: unidades,
      totalGrammage: consumoTotalKg * 1000,
      operator: 'Proyección Masiva',
      timestamp: new Date(),
      status: 'Completado',
      type: 'consumo'
    });

    let totalPercentage = 0;
    p.formulas.forEach(f => {
      totalPercentage += f.percentage;
      const kg = (consumoTotalKg * f.percentage) / 100;
      const baseFlag = isBaseComponent(f.component, f.description);
      
      // Intentar vincularlo con un item del stock real por nombre
      const matchedStock = findMatchingStockItem(stock, f.component);

      if (ingredientAggregation.has(f.component)) {
        const current = ingredientAggregation.get(f.component)!;
        current.totalKg += kg;
      } else {
        ingredientAggregation.set(f.component, {
          description: f.description,
          totalKg: kg,
          isBase: baseFlag,
          matchStockId: matchedStock?.id,
          currentStockKg: matchedStock ? (matchedStock.quantity / 1000) : 0
        });
      }
    });

    // Autocompletar la diferencia hasta el 100% como la base faltante
    // para fórmulas incompletas en la base de datos
    if (totalPercentage < 99.9) {
      const missingPercentage = 100 - totalPercentage;
      const missingKg = (consumoTotalKg * missingPercentage) / 100;
      const missingComponentName = p.type === 'Reactivo' ? 'Pasta Espesante (Alginato)' : p.type === 'Pigmento' ? 'Base Transparente (Pasta Madre)' : 'Base Transparente / Pasta Madre';
      
      if (ingredientAggregation.has(missingComponentName)) {
        const current = ingredientAggregation.get(missingComponentName)!;
        current.totalKg += missingKg;
      } else {
        ingredientAggregation.set(missingComponentName, {
          description: `Relleno automático de la base faltante (${missingPercentage.toFixed(2)}% en ${p.code})`,
          totalKg: missingKg,
          isBase: true,
          matchStockId: undefined,
          currentStockKg: 0
        });
      }
    }
  });

  const aggregatedList = Array.from(ingredientAggregation.entries()).map(([name, data]) => ({
    name,
    ...data
  }));

  const totalBasesKg = aggregatedList.filter(i => i.isBase).reduce((acc, i) => acc + i.totalKg, 0);
  const totalActivosKg = aggregatedList.filter(i => !i.isBase).reduce((acc, i) => acc + i.totalKg, 0);

  const [errorMsg, setErrorMsg] = useState('');

  // Manejo de la tecla Escape (Esc) para cerrar modales de notificación/error
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (successMsg) {
          setSuccessMsg('');
          setUnidades(10000);
          setSelectedColors([{ pantoneId: '', gramsPerUnit: 201 }]);
        } else if (errorMsg) {
          setErrorMsg('');
        }
      }
    };

    const hasModal = !!(successMsg || errorMsg);
    if (hasModal) {
      document.body.style.overflow = 'hidden';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hasModal) {
        document.body.style.overflow = 'auto';
      }
    };
  }, [successMsg, errorMsg]);

  const handleExecute = async () => {
    if (validSelections.length === 0) return;
    setErrorMsg('');
    
    // 1. VALIDACIÓN DE TINTAS PREPARADAS
    const missingStock: string[] = [];
    const deductions: { stockId: string, qty: number }[] = [];
    
    for (const selection of validSelections) {
      const p = pantones.find(p => p.id === selection.pantoneId);
      if (!p) continue;
      
      const requiredGrams = unidades * selection.gramsPerUnit;
      const preparedInkName = `Tarro Pantone ${p.code}`;
      const preparedInk = stock.find(s => s.name === preparedInkName && s.type === 'tinta_preparada');
      
      if (!preparedInk) {
        missingStock.push(`"${preparedInkName}" (Faltan ${(requiredGrams/1000).toFixed(2)} Kg)`);
      } else if (preparedInk.quantity < requiredGrams) {
        const faltante = ((requiredGrams - preparedInk.quantity) / 1000).toFixed(2);
        missingStock.push(`"${preparedInkName}" (Hay ${(preparedInk.quantity/1000).toFixed(2)} Kg, faltan ${faltante} Kg)`);
      } else {
        // Tenemos suficiente tinta preparada
        deductions.push({
          stockId: preparedInk.id!,
          qty: requiredGrams
        });
      }
    }

    if (missingStock.length > 0) {
      setErrorMsg(`STOCK INSUFICIENTE DE TINTAS PREPARADAS. Debes ir al "Laboratorio de Pesaje" (Calculadora) para mezclar: ${missingStock.join(', ')}.`);
      return;
    }

    setIsSubmitting(true);
    
    // Ya no usamos aggregatedList para las deducciones, usamos los tarros de tinta preparada.
    const success = await onExecuteProduction(deductions, batchLogsToCreate);
    setIsSubmitting(false);

    if (success) {
      setSuccessMsg('¡Producción registrada con éxito! El inventario ha sido descontado y los lotes guardados en el historial.');
      setTimeout(() => setSuccessMsg(''), 5000);
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-full">
      <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <Factory className="w-6 h-6 text-emerald-400" />
            Proyección de Consumos Masivos
          </h2>
          <p className="text-sm text-slate-400 mt-1">Calcula y descuenta requerimientos para tirajes multicolor.</p>
        </div>
      </div>

      <div className="p-6 flex flex-col lg:flex-row gap-8 overflow-y-auto">
        
        {/* Panel de Configuración */}
        <div className="lg:w-2/5 flex flex-col gap-6">
          <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
            
            {successMsg && (
              <div 
                className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
                onClick={() => {
                  setSuccessMsg('');
                  setUnidades(10000);
                  setSelectedColors([{ pantoneId: '', gramsPerUnit: 201 }]);
                }}
              >
                <div 
                  className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border border-slate-100 transform scale-100 animate-scale-up relative overflow-hidden"
                  onClick={e => e.stopPropagation()}
                >
                  <div className="absolute top-0 left-0 w-full h-2 bg-emerald-500" />
                  <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                    <CheckCircle className="w-10 h-10 text-emerald-600" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">¡Operación Exitosa!</h3>
                  <p className="text-slate-500 font-medium leading-relaxed mb-8">{successMsg}</p>
                  
                  <button 
                    onClick={() => {
                      setSuccessMsg('');
                      setUnidades(10000);
                      setSelectedColors([{ pantoneId: '', gramsPerUnit: 201 }]);
                    }}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                    title="Cerrar (Esc)"
                  >
                    <span>Cerrar y Continuar</span>
                    <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">Esc</span>
                  </button>
                </div>
              </div>
            )}

            <h3 className="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Calculator className="w-4 h-4 text-slate-500" />
              Parámetros de Producción
            </h3>
            
            <div className="space-y-4">
              {errorMsg && (
                <div 
                  className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm animate-fade-in"
                  onClick={() => setErrorMsg('')}
                >
                  <div 
                    className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl text-center border border-slate-100 transform scale-100 animate-scale-up relative overflow-hidden"
                    onClick={e => e.stopPropagation()}
                  >
                    <div className="absolute top-0 left-0 w-full h-2 bg-red-500" />
                    <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                      <AlertTriangle className="w-10 h-10 text-red-600" />
                    </div>
                    <h3 className="text-2xl font-black text-slate-800 mb-3 tracking-tight">Error de Validación</h3>
                    <p className="text-slate-500 font-medium leading-relaxed mb-8">{errorMsg}</p>
                    
                    <button 
                      onClick={() => setErrorMsg('')}
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-3.5 px-6 rounded-xl transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2"
                      title="Cerrar (Esc)"
                    >
                      <span>Cerrar y Revisar</span>
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-300 px-2 py-0.5 rounded font-mono">Esc</span>
                    </button>
                  </div>
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">Total Unidades de la Orden</label>
                <input 
                  type="number" 
                  value={unidades || ''} 
                  onChange={(e) => setUnidades(Number(e.target.value))}
                  className="w-full p-2.5 rounded-xl border border-slate-200 text-sm font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              <div className="border-t border-slate-200 pt-4 mt-4">
                <label className="block text-xs font-bold text-slate-800 mb-3 uppercase tracking-wider">Marcos / Colores a Estampar</label>
                
                <div className="space-y-3">
                  {selectedColors.map((colorItem, idx) => (
                    <div key={idx} className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 shadow-sm relative">
                      <div className="flex-1">
                        <select 
                          value={colorItem.pantoneId}
                          onChange={(e) => updateColor(idx, 'pantoneId', e.target.value)}
                          className="w-full bg-transparent text-sm font-bold text-slate-800 focus:outline-none mb-2 border-b border-slate-100 pb-1"
                        >
                          <option value="">Seleccione un color...</option>
                          {pantones
                            .filter(p => {
                              const preparedInkName = `Tarro Pantone ${p.code}`;
                              const preparedInk = stock.find(s => s.name === preparedInkName && s.type === 'tinta_preparada');
                              return preparedInk && preparedInk.quantity > 0;
                            })
                            .map(p => {
                              const preparedInkName = `Tarro Pantone ${p.code}`;
                              const preparedInk = stock.find(s => s.name === preparedInkName && s.type === 'tinta_preparada');
                              const qtyKg = preparedInk ? (preparedInk.quantity / 1000).toFixed(2) : 0;
                              
                              return (
                                <option key={p.id} value={p.id}>
                                  {p.code} - {p.name} ✅ (Hay {qtyKg} Kg listos)
                                </option>
                              );
                            })}
                        </select>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-slate-500 uppercase font-semibold">Gramos x Unidad:</span>
                          <input 
                            type="number" 
                            value={colorItem.gramsPerUnit || ''} 
                            onChange={(e) => updateColor(idx, 'gramsPerUnit', Number(e.target.value))}
                            className="w-20 p-1 rounded-lg border border-slate-200 text-xs font-bold text-right outline-none focus:border-emerald-500"
                          />
                        </div>
                      </div>
                      <button 
                        onClick={() => handleRemoveColor(idx)}
                        disabled={selectedColors.length === 1}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={handleAddColor}
                  className="w-full mt-3 py-2 border-2 border-dashed border-slate-300 text-slate-500 hover:border-emerald-400 hover:text-emerald-600 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-colors"
                >
                  <Plus className="w-4 h-4" /> Añadir Otro Color
                </button>
              </div>

            </div>

            <div className="mt-6 pt-6 border-t border-slate-200">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-center">
                <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mb-1">Volumen Total Proyectado</p>
                <p className="text-3xl font-black text-emerald-800">{totalKgAllColors.toLocaleString(undefined, {minimumFractionDigits: 1, maximumFractionDigits: 1})} <span className="text-base font-bold text-emerald-600">Kg</span></p>
              </div>
            </div>
          </div>
        </div>

        {/* Panel de Resultados y Desglose */}
        <div className="lg:w-3/5 flex flex-col">
          {validSelections.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50 p-12 text-center h-full">
              <BarChart className="w-16 h-16 text-slate-300 mb-4" />
              <h3 className="text-lg font-bold text-slate-700">Configura tus colores</h3>
              <p className="text-sm text-slate-500 max-w-sm mt-2">Agrega los marcos que vas a estampar y sus respectivos consumos para generar el listado de insumos requeridos.</p>
            </div>
          ) : (
            <div className="space-y-6 flex-1">
              
              <div className="flex flex-wrap gap-2">
                {validSelections.map(sel => {
                  const p = pantones.find(pant => pant.id === sel.pantoneId);
                  if (!p) return null;
                  return (
                    <div key={sel.pantoneId} className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200 shadow-sm text-xs font-bold text-slate-700">
                      <div className="w-4 h-4 rounded-full border border-black/10" style={{ backgroundColor: p.hex }}></div>
                      {p.code}
                    </div>
                  );
                })}
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-blue-500" />
                    Listado Consolidado de Insumos (Bodega)
                  </div>
                </h3>
                <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-[10px] text-slate-500 uppercase tracking-widest">
                        <th className="py-3 px-4 font-bold">Insumo Consolidado</th>
                        <th className="py-3 px-4 font-bold text-center">Estado Stock</th>
                        <th className="py-3 px-4 font-bold text-right">Stock Disponible</th>
                        <th className="py-3 px-4 font-bold text-right">Requerimiento Neto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {aggregatedList.sort((a,b) => b.totalKg - a.totalKg).map((item, idx) => {
                        const isMissing = item.matchStockId && item.totalKg > item.currentStockKg;
                        
                        return (
                          <tr key={idx} className={`hover:bg-slate-50/50 ${isMissing ? 'bg-red-50/30' : ''}`}>
                            <td className="py-3 px-4">
                              <p className="font-bold text-slate-800 flex items-center gap-2">
                                {item.name}
                                {item.isBase ? (
                                  <span className="text-[9px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded uppercase">Base</span>
                                ) : (
                                  <span className="text-[9px] bg-purple-50 text-purple-600 px-1.5 py-0.5 rounded uppercase">Activo</span>
                                )}
                              </p>
                              <p className="text-[10px] text-slate-500">{item.description}</p>
                            </td>
                            <td className="py-3 px-4 text-center">
                              {item.matchStockId ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-lg">
                                  Vinculado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded-lg" title="El nombre del componente no coincide exactamente con ningún item en el inventario">
                                  Manual
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-slate-600">
                              {item.matchStockId ? `${item.currentStockKg.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg` : 'N/A'}
                            </td>
                            <td className={`py-3 px-4 text-right font-mono font-black ${isMissing ? 'text-red-700 bg-red-100/50' : 'text-blue-700 bg-blue-50/30'}`}>
                              {item.totalKg.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg
                              {isMissing && <div className="text-[9px] text-red-500 font-bold mt-1 uppercase">¡Falta Stock!</div>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 mt-2">
                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Total Bases Consolidadas</span>
                  <span className="text-2xl font-black text-slate-700">
                    {totalBasesKg.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg
                  </span>
                </div>
                <div className="bg-purple-50 border border-purple-100 p-4 rounded-2xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-purple-600 uppercase tracking-widest mb-1">Total Activos / Pigmentos</span>
                  <span className="text-2xl font-black text-purple-800">
                    {totalActivosKg.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})} Kg
                  </span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={handleExecute}
                  disabled={isSubmitting}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/20 transition-all disabled:opacity-50"
                >
                  {isSubmitting ? (
                    'Procesando...'
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Registrar Producción y Descontar Stock
                    </>
                  )}
                </button>
              </div>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
