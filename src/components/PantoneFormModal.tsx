import { useState, useEffect } from 'react';
import { X, Plus, Trash2, AlertCircle, Scale, Percent } from 'lucide-react';
import { PantoneColor, StockItem } from '../types';

interface PantoneFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (pantone: PantoneColor) => void;
  stock: StockItem[];
  editingPantone: PantoneColor | null;
}

interface FormulaRow {
  component: string;
  description: string;
  percentage: number;
  grams: number;
}

export default function PantoneFormModal({
  isOpen,
  onClose,
  onSubmit,
  stock,
  editingPantone
}: PantoneFormModalProps) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [hex, setHex] = useState('#3b82f6');
  const [mesh, setMesh] = useState('62 hilos');
  const [squeegee, setSqueegee] = useState('70 Shore');
  const [notes, setNotes] = useState('');
  
  // Modo de ingreso: 'grams' (por gramos) o 'percentage' (por porcentaje)
  const [entryMode, setEntryMode] = useState<'grams' | 'percentage'>('grams');

  // Lista de componentes locales para armar la formulación
  const [formulas, setFormulas] = useState<FormulaRow[]>([]);

  const [validationError, setValidationError] = useState('');

  // Rellenar datos si estamos editando
  useEffect(() => {
    if (editingPantone) {
      setCode(editingPantone.code);
      setName(editingPantone.name);
      setHex(editingPantone.hex);
      setMesh(editingPantone.mesh || '62 hilos');
      setSqueegee(editingPantone.squeegee || '70 Shore');
      setNotes(editingPantone.notes);
      
      // Convertir formulas a las filas locales con gramos (tomamos 1000g de referencia para la visualización inicial de gramos)
      const rows = editingPantone.formulas.map(f => ({
        component: f.component,
        description: f.description,
        percentage: f.percentage,
        grams: Number(((f.percentage * 1000) / 100).toFixed(1))
      }));
      setFormulas(rows);
    } else {
      setCode('');
      setName('');
      setHex('#3b82f6');
      setMesh('62 hilos');
      setSqueegee('70 Shore');
      setNotes('');
      
      setFormulas([
        { component: '', description: '', percentage: 0, grams: 0 }
      ]);
    }
    setValidationError('');
  }, [editingPantone, isOpen]);

  if (!isOpen) return null;

  // Cálculos totales en tiempo real
  const totalPercentage = formulas.reduce((acc, f) => acc + f.percentage, 0);
  const totalGrams = formulas.reduce((acc, f) => acc + f.grams, 0);

  const handleAddComponent = () => {
    setFormulas([
      ...formulas,
      { component: '', description: '', percentage: 0, grams: 0 }
    ]);
  };

  const handleRemoveComponent = (idx: number) => {
    const updated = formulas.filter((_, i) => i !== idx);
    
    // Recalcular porcentajes en base al nuevo total de gramos si estamos en modo gramos
    if (entryMode === 'grams') {
      const totalG = updated.reduce((acc, row) => acc + row.grams, 0);
      if (totalG > 0) {
        updated.forEach(row => {
          row.percentage = Number(((row.grams / totalG) * 100).toFixed(2));
        });
      } else {
        updated.forEach(row => { row.percentage = 0; });
      }
    }
    setFormulas(updated);
  };

  const handleFormulaFieldChange = (idx: number, field: 'component' | 'description' | 'percentage' | 'grams', value: any) => {
    const updated = [...formulas];
    
    if (field === 'component') {
      updated[idx].component = value;
      // Tratar de rellenar descripción automáticamente desde stock si coincide
      const found = stock.find(s => s.name === value);
      if (found) {
        updated[idx].description = 
          found.type === 'base' ? 'Resina o base textil' : 
          found.type === 'pasta' ? 'Pasta espesante reactivos' :
          found.type === 'pigmento' ? 'Pigmento concentrado' : 
          found.type === 'colorante_reactivo' ? 'Colorante reactivo' : 
          'Aditivo de taller';
      }
    } else if (field === 'description') {
      updated[idx].description = value;
    } else if (field === 'grams') {
      updated[idx].grams = Math.max(0, parseFloat(value) || 0);
      
      // Recalcular porcentajes de todas las filas en base al nuevo total de gramos
      const totalG = updated.reduce((acc, row) => acc + row.grams, 0);
      if (totalG > 0) {
        updated.forEach(row => {
          row.percentage = Number(((row.grams / totalG) * 100).toFixed(2));
        });
      } else {
        updated.forEach(row => {
          row.percentage = 0;
        });
      }
    } else if (field === 'percentage') {
      updated[idx].percentage = Math.max(0, parseFloat(value) || 0);
      // Estimar los gramos en base a un lote de referencia de 1000g
      updated[idx].grams = Number(((updated[idx].percentage * 1000) / 100).toFixed(1));
    }
    
    setFormulas(updated);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');

    if (!code.trim() || !name.trim()) {
      setValidationError('Por favor ingresa el código Pantone y el nombre de color.');
      return;
    }

    if (formulas.length === 0) {
      setValidationError('La fórmula debe tener al menos un ingrediente.');
      return;
    }

    // Verificar que todos los componentes tengan un nombre no vacío
    const hasEmptyComponent = formulas.some(f => !f.component || !f.component.trim());
    if (hasEmptyComponent) {
      setValidationError('Por favor, ingresa el nombre de todos los componentes de la fórmula.');
      return;
    }

    let finalFormulas = [];

    if (entryMode === 'grams') {
      if (totalGrams <= 0) {
        setValidationError('La cantidad total de gramos debe ser mayor que 0g para poder calcular la proporción.');
        return;
      }

      // Generar porcentajes exactos de manera proporcional
      finalFormulas = formulas.map(f => ({
        component: f.component,
        description: f.description,
        percentage: Number(((f.grams / totalGrams) * 100).toFixed(2))
      }));

      // Corregir pequeñas diferencias de redondeo para que sume exactamente 100.00%
      const currentSum = finalFormulas.reduce((acc, f) => acc + f.percentage, 0);
      const diff = 100 - currentSum;
      if (Math.abs(diff) > 0 && Math.abs(diff) < 1 && finalFormulas.length > 0) {
        finalFormulas[0].percentage = Number((finalFormulas[0].percentage + diff).toFixed(2));
      }
    } else {
      // Modo porcentaje directo
      if (Math.abs(totalPercentage - 100) > 0.5) {
        setValidationError(`La suma de los porcentajes debe ser exactamente 100%. Actualmente es ${totalPercentage.toFixed(2)}%`);
        return;
      }
      
      finalFormulas = formulas.map(f => ({
        component: f.component,
        description: f.description,
        percentage: f.percentage
      }));
    }

    const payload: PantoneColor = {
      code: code.trim().toUpperCase(),
      name: name.trim(),
      hex,
      mesh,
      squeegee,
      notes: notes.trim(),
      formulas: finalFormulas
    };

    if (editingPantone?.id) {
      payload.id = editingPantone.id;
    }

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-fade-in animate-duration-150">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-2xl w-full flex flex-col max-h-[90vh] overflow-hidden">
        
        {/* Header de modal */}
        <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h3 className="text-md font-bold text-slate-900">
              {editingPantone ? `Editar Fórmula: Pantone ${editingPantone.code}` : 'Agregar Nueva Fórmula Pantone'}
            </h3>
            <p className="text-xs text-slate-500">Registra los componentes y sus proporciones exactas de mezcla.</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 transition-colors cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleFormSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          
          {validationError && (
            <div className="p-3 bg-red-50 border border-red-100 text-red-800 rounded-xl text-xs flex items-start gap-2 animate-pulse">
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
              <div className="font-semibold">{validationError}</div>
            </div>
          )}

          {/* Información General */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-4">
            <div className="sm:col-span-4">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Código Pantone *</label>
              <input
                type="text"
                placeholder="Ej: 300 C"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-bold text-slate-800 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>

            <div className="sm:col-span-5">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Descriptivo *</label>
              <input
                type="text"
                placeholder="Ej: Azul Corporativo"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs font-semibold text-slate-800 focus:ring-1 focus:ring-blue-400 focus:outline-none"
                required
              />
            </div>

            <div className="sm:col-span-3">
              <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Muestra Color *</label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={hex}
                  onChange={(e) => setHex(e.target.value)}
                  className="w-10 h-10 border border-slate-200 rounded-xl p-0.5 cursor-pointer bg-slate-50"
                  required
                />
                <span className="text-xs font-mono font-bold text-slate-500 uppercase">{hex}</span>
              </div>
            </div>
          </div>

          {/* Selector de Método de Formulación */}
          <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl">
            <label className="block text-[10px] font-extrabold text-slate-600 uppercase mb-2">Método para registrar los componentes</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setEntryMode('grams')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  entryMode === 'grams'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Scale className="w-4 h-4" />
                Por Peso en Gramos (g)
              </button>
              
              <button
                type="button"
                onClick={() => setEntryMode('percentage')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                  entryMode === 'percentage'
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Percent className="w-4 h-4" />
                Por Porcentaje Directo (%)
              </button>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">
              {entryMode === 'grams'
                ? 'Introduce los gramos reales que usaste para armar tu muestra de laboratorio (ej: 950g de pasta espesante y 50g de colorante). La app calculará las proporciones exactas en % automáticamente.'
                : 'Introduce los porcentajes directamente. La suma total de los porcentajes debe ser exactamente 100.00%.'}
            </p>
          </div>

          {/* Formulación e ingredientes */}
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Componentes de la Fórmula</h4>
                <p className="text-[11px] text-slate-400">
                  {entryMode === 'grams'
                    ? 'Ingresa el peso en gramos para cada componente.'
                    : 'Los porcentajes deben sumar exactamente 100%.'}
                </p>
              </div>
              
              <button
                type="button"
                onClick={handleAddComponent}
                className="bg-slate-900 text-white hover:bg-slate-800 rounded-xl px-3 py-1.5 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Añadir Componente
              </button>
            </div>

            <div className="space-y-2 max-h-[220px] overflow-y-auto pr-1">
              {formulas.map((f, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 bg-slate-50/50 p-2 border border-slate-100 rounded-2xl items-center">
                  {/* Nombre del Insumo / Colorante (Editable) */}
                  <div className="col-span-5">
                    <input
                      type="text"
                      list="stock-options"
                      placeholder="Nombre del colorante..."
                      value={f.component}
                      onChange={(e) => handleFormulaFieldChange(idx, 'component', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold focus:outline-none text-slate-800 focus:ring-1 focus:ring-blue-400"
                      required
                    />
                  </div>

                  {/* Descripción o Nota */}
                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="Ej: Base principal o pigmento"
                      value={f.description}
                      onChange={(e) => handleFormulaFieldChange(idx, 'description', e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs text-slate-600 focus:outline-none font-medium"
                    />
                  </div>

                  {/* Entrada Numérica (Gramos o Porcentaje) */}
                  <div className="col-span-2 flex items-center gap-1 bg-white border border-slate-200 rounded-xl px-2 py-1.5">
                    {entryMode === 'grams' ? (
                      <>
                        <input
                          type="number"
                          step="0.1"
                          placeholder="g"
                          value={f.grams}
                          onChange={(e) => handleFormulaFieldChange(idx, 'grams', e.target.value)}
                          className="w-full bg-transparent border-none text-xs text-right focus:outline-none font-bold text-blue-600 font-mono"
                          min="0"
                          required
                        />
                        <span className="text-xs font-bold text-slate-400">g</span>
                      </>
                    ) : (
                      <>
                        <input
                          type="number"
                          step="0.01"
                          placeholder="%"
                          value={f.percentage}
                          onChange={(e) => handleFormulaFieldChange(idx, 'percentage', e.target.value)}
                          className="w-full bg-transparent border-none text-xs text-right focus:outline-none font-bold text-blue-600 font-mono"
                          min="0"
                          max="100"
                          required
                        />
                        <span className="text-xs font-bold text-slate-400">%</span>
                      </>
                    )}
                  </div>

                  {/* Borrar */}
                  <div className="col-span-1 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveComponent(idx)}
                      disabled={formulas.length <= 1}
                      className="text-red-500 hover:text-red-700 disabled:opacity-40 p-1 cursor-pointer transition-opacity"
                    >
                      <Trash2 className="w-4 h-4 mx-auto" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Sumador */}
            {entryMode === 'grams' ? (
              <div className="p-3 rounded-2xl flex justify-between items-center text-xs font-extrabold bg-blue-50 text-blue-800 border border-blue-100">
                <span>Peso Total de la Muestra de Laboratorio:</span>
                <span className="font-mono text-sm">{totalGrams.toFixed(1)} g</span>
              </div>
            ) : (
              <div className={`p-3 rounded-2xl flex justify-between items-center text-xs font-extrabold ${
                Math.abs(totalPercentage - 100) < 0.05 
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-100'
                  : 'bg-amber-50 text-amber-800 border border-amber-100'
              }`}>
                <span>Total Porcentajes Formulados:</span>
                <span className="font-mono text-sm">{totalPercentage.toFixed(2)}% / 100.00%</span>
              </div>
            )}

            {/* Resumen de proporciones automáticas si estamos en gramos */}
            {entryMode === 'grams' && totalGrams > 0 && (
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 space-y-1.5">
                <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wide">Proporciones Porcentuales Calculadas en Tiempo Real:</p>
                <div className="flex flex-wrap gap-2">
                  {formulas.map((f, idx) => (
                    <div key={idx} className="bg-white border border-slate-200 rounded-lg px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-xs">
                      <span className="text-slate-900">{f.component}:</span> <span className="text-blue-600 font-mono font-bold">{f.percentage.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Notas de Laboratorio */}
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Notas de Laboratorio / Indicaciones de Estampado</label>
            <textarea
              placeholder="Indica precauciones específicas del tejido de toallas o hamacas, pre-secado intermedio, o aditivos especiales para este tono..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 h-20 focus:ring-1 focus:ring-blue-400 focus:outline-none font-medium leading-relaxed"
            />
          </div>

          {/* Acciones */}
          <div className="border-t border-slate-100 pt-4 flex justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 text-slate-600 rounded-xl px-4 py-2.5 text-xs font-bold hover:bg-slate-200 cursor-pointer transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-blue-600 text-white rounded-xl px-5 py-2.5 text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer shadow-lg shadow-blue-500/10"
            >
              {editingPantone ? 'Guardar Cambios' : 'Registrar Fórmula'}
            </button>
          </div>

          {/* Datalist helper para autocompletar insumos de stock */}
          <datalist id="stock-options">
            {stock.map((s) => (
              <option key={s.name} value={s.name} />
            ))}
          </datalist>

        </form>

      </div>
    </div>
  );
}
