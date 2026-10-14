import React, { useState, useEffect } from 'react';
import { Layers, Plus, TrendingDown, ArrowUpRight, AlertTriangle, ShieldCheck, Filter, Trash2, Edit2, Search, Beaker, X, Check, RefreshCw, RotateCcw, Sliders } from 'lucide-react';
import { StockItem, BatchLog } from '../types';
import { syncInventoryWithExcel, addBatchLog } from '../lib/dataService';
import inventoryData from '../inventory_data.json';

export interface PastaMadreIngredient {
  id: string;
  name: string;
  stockId?: string;
  type: string;
  percentage: number;
  grams?: number;
}

const DEFAULT_PASTA_MADRE_FORMULA: PastaMadreIngredient[] = [
  { id: 'urea', name: 'Urea', type: 'urea', percentage: 7.5, grams: 15000 },
  { id: 'asutol', name: 'Asutol', type: 'asutol', percentage: 1.0, grams: 2000 },
  { id: 'bicarbonato', name: 'Bicarbonato', type: 'bicarbonato', percentage: 3.5, grams: 7000 },
  { id: 'espesante', name: 'Espesante', type: 'pasta', percentage: 4.5, grams: 9000 },
];

interface StockManagerProps {
  stock: StockItem[];
  currentUser: { name: string; role: string; initials: string };
  onUpdateStock: (id: string, newQty: number) => void;
  onUpdateStockItem: (id: string, item: Partial<StockItem>) => void;
  onDeleteStockItem: (id: string) => void;
  onAddStockItem: (item: StockItem) => void;
  onRefreshStock?: () => Promise<void> | void;
  onAddBatch?: (batch: BatchLog) => Promise<boolean>;
}

export default function StockManager({ stock, currentUser, onUpdateStock, onUpdateStockItem, onDeleteStockItem, onAddStockItem, onRefreshStock, onAddBatch }: StockManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPastaMadreModal, setShowPastaMadreModal] = useState(false);
  const [pastaMadreKg, setPastaMadreKg] = useState<number>(200);
  const [pastaMadreError, setPastaMadreError] = useState<string | null>(null);
  const [pastaMadreSuccess, setPastaMadreSuccess] = useState<boolean>(false);

  // Fórmula editable de Pasta Madre
  const [pastaMadreFormula, setPastaMadreFormula] = useState<PastaMadreIngredient[]>(DEFAULT_PASTA_MADRE_FORMULA);
  const [showAddCustomIngredient, setShowAddCustomIngredient] = useState(false);
  const [selectedStockIdToAdd, setSelectedStockIdToAdd] = useState('');
  const [newIngredientPct, setNewIngredientPct] = useState<number>(1.0);
  
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<string>('pigmento');
  const [newCategory, setNewCategory] = useState<'pigmento' | 'reactivo'>('pigmento');
  const [newQty, setNewQty] = useState<number>(1000);
  const [newMin, setNewMin] = useState<number>(500);
  const [newColor, setNewColor] = useState<string>('#000000');

  // Estados para sincronización manual de inventario Excel
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<string | null>(null);

  const handleSyncExcelInventory = async () => {
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncInventoryWithExcel(inventoryData);
      if (onRefreshStock) {
        await onRefreshStock();
      }
      setSyncFeedback(`¡Inventario sincronizado con Excel 7-Oct! ${res.updated} actualizados, ${res.added} nuevos, ${res.zeroed} que no estaban quedaron en 0.`);
      setTimeout(() => setSyncFeedback(null), 8000);
    } catch (e: any) {
      setSyncFeedback('Error al sincronizar el inventario.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Filtro de categorías y búsqueda
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'todos' | 'pigmentos' | 'reactivos' | 'inventario' | 'preparadas'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Paginación
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Resetea la página al cambiar filtros


  // Estados para actualizar stock de manera interactiva (campos completos)
  const [editingId, setEditingId] = useState<string | null>(null);

  // Manejo de la tecla Escape (Esc) para cerrar modales y formularios
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showPastaMadreModal) {
          setShowPastaMadreModal(false);
        } else if (showAddForm) {
          setShowAddForm(false);
        } else if (editingId) {
          setEditingId(null);
        }
      }
    };

    if (showPastaMadreModal) {
      document.body.style.overflow = 'hidden';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (showPastaMadreModal) {
        document.body.style.overflow = 'auto';
      }
    };
  }, [showPastaMadreModal, showAddForm, editingId]);
  const [editName, setEditName] = useState<string>('');
  const [editType, setEditType] = useState<string>('pigmento');
  const [editCategory, setEditCategory] = useState<'pigmento' | 'reactivo'>('pigmento');
  const [editVal, setEditVal] = useState<number>(0);
  const [editMin, setEditMin] = useState<number>(0);
  const [editColor, setEditColor] = useState<string>('#000000');

  // Estado para confirmación de eliminación segura
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const lowStockItems = stock.filter(item => item.quantity <= item.minRequired);

  const handleTypeChange = (type: 'base' | 'pasta' | 'pigmento' | 'colorante_reactivo' | 'aditivo') => {
    setNewType(type);
    // Auto-ajustar categoría basada en el tipo seleccionado
    if (type === 'colorante_reactivo' || type === 'pasta') {
      setNewCategory('reactivo');
    } else if (type === 'base' || type === 'pigmento') {
      setNewCategory('pigmento');
    }
  };

  const handleEditTypeChange = (type: string) => {
    setEditType(type);
    if (['colorante_reactivo', 'pasta', 'urea', 'asutol', 'bicarbonato', 'sal_alginato'].includes(type)) {
      setEditCategory('reactivo');
    } else {
      setEditCategory('pigmento');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName) return;

    const newItem: StockItem = {
      name: newName,
      type: newType,
      category: newCategory,
      quantity: newQty,
      minRequired: newMin,
      hexColor: newColor
    };

    onAddStockItem(newItem);
    setNewName('');
    setNewQty(1000);
    setNewMin(500);
    setNewColor('#000000');
    setShowAddForm(false);
  };

  const handleStartEdit = (item: StockItem) => {
    setEditingId(item.id || null);
    setEditName(item.name);
    setEditType(item.type);
    setEditCategory(item.category || 'pigmento');
    setEditVal(item.quantity);
    setEditMin(item.minRequired);
    setEditColor(item.hexColor || '#000000');
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    onUpdateStockItem(id, {
      name: editName,
      type: editType,
      category: editCategory,
      quantity: editVal,
      minRequired: editMin,
      hexColor: editColor
    });
    setEditingId(null);
  };

  // Utilidades para la fórmula editable de Pasta Madre
  const findStockItemForIngredient = (ing: PastaMadreIngredient) => {
    if (ing.stockId) {
      const match = stock.find(s => s.id === ing.stockId);
      if (match) return match;
    }
    const lowerName = ing.name.toLowerCase();
    if (ing.type === 'urea' || lowerName.includes('urea')) {
      return stock.find(i => i.type === 'urea' || i.name.toLowerCase().includes('urea'));
    }
    if (ing.type === 'asutol' || lowerName.includes('asutol')) {
      return stock.find(i => i.type === 'asutol' || i.name.toLowerCase().includes('asutol'));
    }
    if (ing.type === 'bicarbonato' || lowerName.includes('bicarbonato')) {
      return stock.find(i => i.type === 'bicarbonato' || i.name.toLowerCase().includes('bicarbonato'));
    }
    if (ing.type === 'pasta' || lowerName.includes('espesante') || lowerName.includes('alginato')) {
      return stock.find(i => i.type === 'pasta' || i.name.toLowerCase().includes('espesante') || i.type === 'sal_alginato');
    }
    return stock.find(i => i.name.toLowerCase().includes(lowerName));
  };

  const handleKgChange = (newKg: number) => {
    const validKg = Math.max(1, newKg);
    setPastaMadreKg(validKg);
    const newTotalGrams = validKg * 1000;
    setPastaMadreFormula(prev => prev.map(item => ({
      ...item,
      grams: Math.round((newTotalGrams * item.percentage) / 100)
    })));
  };

  const handleUpdateIngredientPct = (id: string, newPct: number) => {
    const validPct = Math.max(0, newPct);
    const totalGrams = (pastaMadreKg || 1) * 1000;
    setPastaMadreFormula(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          percentage: validPct,
          grams: Math.round((totalGrams * validPct) / 100)
        };
      }
      return item;
    }));
  };

  const handleUpdateIngredientGrams = (id: string, newGrams: number) => {
    const validGrams = Math.max(0, newGrams);
    const totalGrams = (pastaMadreKg || 1) * 1000;
    const computedPct = totalGrams > 0 ? parseFloat(((validGrams / totalGrams) * 100).toFixed(2)) : 0;
    setPastaMadreFormula(prev => prev.map(item => {
      if (item.id === id) {
        return {
          ...item,
          grams: validGrams,
          percentage: computedPct
        };
      }
      return item;
    }));
  };

  const handleRemoveIngredient = (id: string) => {
    setPastaMadreFormula(prev => prev.filter(item => item.id !== id));
  };

  const handleResetFormula = () => {
    const totalGrams = (pastaMadreKg || 1) * 1000;
    setPastaMadreFormula(DEFAULT_PASTA_MADRE_FORMULA.map(item => ({
      ...item,
      grams: Math.round((totalGrams * item.percentage) / 100)
    })));
    setPastaMadreError(null);
  };

  const handleAddIngredientToFormula = () => {
    if (!selectedStockIdToAdd) return;
    const stockItem = stock.find(s => s.id === selectedStockIdToAdd);
    if (!stockItem) return;
    if (pastaMadreFormula.some(i => i.stockId === stockItem.id || i.name.toLowerCase() === stockItem.name.toLowerCase())) {
      setPastaMadreError(`"${stockItem.name}" ya está presente en la fórmula.`);
      return;
    }
    const totalGrams = (pastaMadreKg || 1) * 1000;
    const computedGrams = Math.round((totalGrams * newIngredientPct) / 100);
    setPastaMadreFormula(prev => [
      ...prev,
      {
        id: `custom_${Date.now()}`,
        name: stockItem.name,
        stockId: stockItem.id,
        type: stockItem.type,
        percentage: newIngredientPct,
        grams: computedGrams
      }
    ]);
    setSelectedStockIdToAdd('');
    setShowAddCustomIngredient(false);
    setPastaMadreError(null);
  };

  const totalPastaGrams = (pastaMadreKg || 0) * 1000;
  const sumOfIngredientGrams = pastaMadreFormula.reduce((acc, curr) => {
    const g = curr.grams !== undefined ? curr.grams : Math.round((totalPastaGrams * curr.percentage) / 100);
    return acc + (Number(g) || 0);
  }, 0);
  const totalComponentsPct = pastaMadreFormula.reduce((acc, curr) => acc + (Number(curr.percentage) || 0), 0);
  const waterGrams = Math.max(0, totalPastaGrams - sumOfIngredientGrams);
  const waterPct = totalPastaGrams > 0 ? Math.max(0, parseFloat(((waterGrams / totalPastaGrams) * 100).toFixed(2))) : 0;

  const handlePreparePastaMadre = async () => {
    setPastaMadreError(null);
    setPastaMadreSuccess(false);
    
    if (pastaMadreKg <= 0) {
      setPastaMadreError('La cantidad total a preparar debe ser mayor a 0 kg.');
      return;
    }

    if (totalComponentsPct > 100 || sumOfIngredientGrams > totalPastaGrams) {
      setPastaMadreError(`La suma de los componentes (${sumOfIngredientGrams.toLocaleString()} g / ${totalComponentsPct.toFixed(1)}%) supera los ${totalPastaGrams.toLocaleString()} g del lote.`);
      return;
    }

    const totalGrams = pastaMadreKg * 1000;
    const deductions: { stockItem: StockItem; requiredGrams: number }[] = [];

    for (const ing of pastaMadreFormula) {
      const requiredGrams = ing.grams !== undefined ? ing.grams : (totalGrams * (Number(ing.percentage) || 0)) / 100;
      if (requiredGrams <= 0) continue;

      const item = findStockItemForIngredient(ing);
      if (!item) {
        setPastaMadreError(`No se encontró en el inventario un insumo correspondiente a "${ing.name}".`);
        return;
      }
      if (item.quantity < requiredGrams) {
        setPastaMadreError(`Stock insuficiente de "${item.name}". Se necesitan ${Math.round(requiredGrams).toLocaleString()}g y hay ${(item.quantity).toLocaleString()}g disponibles.`);
        return;
      }
      deductions.push({ stockItem: item, requiredGrams });
    }

    // Descontar insumos según los gramos editados
    for (const d of deductions) {
      onUpdateStock(d.stockItem.id!, Math.max(0, d.stockItem.quantity - d.requiredGrams));
    }

    // Añadir Pasta Madre (Preparada) al inventario
    const existingPastaMadre = stock.find(i => i.name === 'Pasta Madre (Preparada)');
    if (existingPastaMadre) {
      onUpdateStock(existingPastaMadre.id!, existingPastaMadre.quantity + totalGrams);
    } else {
      onAddStockItem({
        name: 'Pasta Madre (Preparada)',
        type: 'pasta',
        category: 'reactivo',
        quantity: totalGrams,
        minRequired: 50000,
        hexColor: '#FDFBF7'
      });
    }

    // Registrar el lote en el historial de mezclas para que se refleje en Gráficos & Tintas (Aditivos)
    const pastaBatch: BatchLog = {
      pantoneCode: 'PASTA MADRE',
      pantoneHex: '#FDFBF7',
      productType: 'Otros',
      productReference: `Lote ${pastaMadreKg} kg Pasta Madre`,
      lineType: 'reactivo',
      quantity: 1,
      totalGrammage: totalGrams,
      operator: currentUser?.name || 'Laboratorio',
      timestamp: new Date(),
      status: 'Completado',
      type: 'preparacion'
    };

    try {
      if (onAddBatch) {
        await onAddBatch(pastaBatch);
      } else {
        await addBatchLog(pastaBatch);
      }
    } catch (batchErr) {
      console.warn('Error al registrar lote de Pasta Madre en base de datos:', batchErr);
    }

    setPastaMadreSuccess(true);
    setTimeout(() => {
      setShowPastaMadreModal(false);
      setPastaMadreSuccess(false);
    }, 2000);
  };

  // Filtrado de stock basado en categoría y búsqueda
  const filteredStock = stock.filter(item => {
    if (activeCategoryFilter !== 'todos') {
      if (activeCategoryFilter === 'pigmentos') {
        if (item.type !== 'pigmento') return false;
      } else if (activeCategoryFilter === 'reactivos') {
        if (item.type !== 'colorante_reactivo') return false;
      } else if (activeCategoryFilter === 'inventario') {
        if (['pigmento', 'colorante_reactivo', 'tinta_preparada'].includes(item.type)) return false;
      } else if (activeCategoryFilter === 'preparadas') {
        if (item.type !== 'tinta_preparada') return false;
      }
    } else {
      // Si estamos en 'todos', de igual forma podemos ocultar las tintas preparadas para no ensuciar la materia prima, 
      // o simplemente mostrarlas. Ocultémoslas de "todos" para separar la bodega.
      if (item.type === 'tinta_preparada') return false;
    }
    
    // 2. Filtrar por término de búsqueda
    if (searchTerm.trim() !== '') {
      const termLower = searchTerm.toLowerCase();
      if (!item.name.toLowerCase().includes(termLower)) return false;
    }
    
    return true;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategoryFilter, searchTerm]);

  const totalPages = Math.ceil(filteredStock.length / itemsPerPage);
  const paginatedStock = filteredStock.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);


  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start overflow-hidden" id="stock-manager-view">
      
      {/* Columna Principal - Lista de Insumos */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Inventario y Lista de Insumos</h3>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar insumo..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none w-48 sm:w-56 transition-all focus:w-64"
              />
            </div>
            <button
              onClick={() => {
                setPastaMadreKg(200);
                setPastaMadreError(null);
                setPastaMadreSuccess(false);
                setShowPastaMadreModal(true);
              }}
              className="bg-teal-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-teal-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Beaker className="w-4 h-4" />
              <span className="hidden sm:inline">Preparar Pasta Madre</span>
              <span className="sm:hidden">Pasta</span>
            </button>
            <button
              onClick={handleSyncExcelInventory}
              disabled={isSyncing}
              className="bg-indigo-600 text-white rounded-xl px-3.5 py-2 text-xs font-bold hover:bg-indigo-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
              title="Sincronizar con el reporte Excel 7-Oct-2026 (las que no estén quedarán en 0)"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">{isSyncing ? 'Sincronizando...' : 'Actualizar Excel 7-Oct'}</span>
              <span className="sm:hidden">{isSyncing ? '...' : '7-Oct'}</span>
            </button>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{showAddForm ? 'Cerrar' : 'Agregar Insumo Fijo'}</span>
              <span className="sm:hidden">{showAddForm ? 'Cerrar' : 'Agregar'}</span>
            </button>
          </div>
        </div>

        {/* Notificación de resultado de sincronización */}
        {syncFeedback && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center justify-between animate-fade-in shadow-sm">
            <span className="flex items-center gap-2">
              <Check className="w-4 h-4 text-emerald-600 shrink-0" />
              {syncFeedback}
            </span>
            <button 
              type="button"
              onClick={() => setSyncFeedback(null)} 
              className="text-emerald-500 hover:text-emerald-700 cursor-pointer p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Separación por Pestañas */}
        <div className="flex border-b border-slate-100 mb-6 gap-2 overflow-x-auto custom-scrollbar">
          <button
            onClick={() => setActiveCategoryFilter('todos')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'todos' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Materia Prima Cruda ({stock.filter(i => i.type !== 'tinta_preparada').length})
          </button>

          <div className="w-px h-4 bg-slate-200 my-auto ml-2 mr-2 hidden sm:block"></div>
          
          <button
            onClick={() => setActiveCategoryFilter('preparadas')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'preparadas' 
                ? 'text-emerald-600 border-b-2 border-emerald-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Bodega de Preparadas ({stock.filter(i => i.type === 'tinta_preparada').length})
          </button>
          
          <div className="w-px h-4 bg-slate-200 my-auto ml-2 mr-2 hidden sm:block"></div>
          <button
            onClick={() => setActiveCategoryFilter('pigmentos')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'pigmentos' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Pigmentos ({stock.filter(i => i.type === 'pigmento').length})
          </button>

          <button
            onClick={() => setActiveCategoryFilter('reactivos')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'reactivos' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Reactivos ({stock.filter(i => i.type === 'colorante_reactivo').length})
          </button>

          <div className="w-px h-4 bg-slate-200 my-auto ml-2 mr-2 hidden sm:block"></div>

          <button
            onClick={() => setActiveCategoryFilter('inventario')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer whitespace-nowrap ${
              activeCategoryFilter === 'inventario' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Inventario ({stock.filter(i => !['pigmento', 'colorante_reactivo'].includes(i.type)).length})
          </button>
        </div>

        {/* Formulario de Agregar Insumo */}
        {showAddForm && (
          <form onSubmit={handleSubmit} className="bg-slate-50 border border-slate-100 rounded-2xl p-5 mb-6 space-y-4 animate-fade-in">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wide">Nuevo Insumo de Taller</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Nombre Comercial / Insumo</label>
                <input
                  type="text"
                  placeholder="Ej: Azul Reactivo H-EXL o Pasta Espesante Alginato"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-medium"
                  required
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Componente</label>
                <select
                  value={newType}
                  onChange={(e) => {
                    const val = e.target.value;
                    setNewType(val as any);
                    // Asignación automática de categoría para los tabs
                    if (['colorante_reactivo', 'pasta', 'urea', 'asutol', 'bicarbonato', 'sal_alginato'].includes(val)) {
                      setNewCategory('reactivo');
                    } else {
                      setNewCategory('pigmento');
                    }
                  }}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-semibold"
                >
                  <option value="pigmento">Pigmento</option>
                  <option value="colorante_reactivo">Reactivo</option>
                  <option value="base">Base Clear / Copaje</option>
                  <option value="urea">Urea</option>
                  <option value="asutol">Asutol</option>
                  <option value="bicarbonato">Bicarbonato</option>
                  <option value="pasta">Pasta / Espesante</option>
                  <option value="sal_alginato">Sal / Alginato</option>
                  <option value="aditivo">Aditivo / Auxiliar Genérico</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:col-span-2">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Cantidad (g)</label>
                  <input
                    type="number"
                    value={newQty}
                    onChange={(e) => setNewQty(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Alerta Mín. (g)</label>
                  <input
                    type="number"
                    value={newMin}
                    onChange={(e) => setNewMin(Math.max(0, Number(e.target.value)))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-mono"
                    required
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Color Referencia (Opcional)</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="w-12 h-10 rounded-lg cursor-pointer bg-white border border-slate-200 p-1"
                    />
                    <input
                      type="text"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      placeholder="#HEX"
                      className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-mono"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="bg-white border border-slate-200 text-slate-500 rounded-xl px-3 py-1.5 text-xs font-semibold hover:bg-slate-100 cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="bg-blue-600 text-white rounded-xl px-4 py-1.5 text-xs font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Registrar Insumo Constante
              </button>
            </div>
          </form>
        )}

        {/* Tabla / Lista de Stock */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredStock.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
              <Filter className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-500">No hay insumos registrados para esta línea.</p>
              <p className="text-[11px] text-slate-400 mt-1">Usa el botón "Agregar Insumo Fijo" para dar de alta tus materiales.</p>
            </div>
          ) : (
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest bg-slate-50/50">
                  <th className="py-3 px-4 font-semibold w-1/3">Insumo / Material</th>
                  <th className="py-3 px-4 font-semibold">Tipo</th>
                  <th className="py-3 px-4 font-semibold text-right">Cantidad (g / kg)</th>
                  <th className="py-3 px-4 font-semibold text-right">Alerta Mín. (g / kg)</th>
                  <th className="py-3 px-4 font-semibold text-right w-[180px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedStock.map((item) => {
                  const isLow = item.quantity <= item.minRequired;
                  const isEditing = editingId === item.id;
                  
                  // Helper para parsear tipo
                  const typeLabel = (type: string) => {
                    const map: Record<string, string> = {
                      'pigmento': 'Pigmento',
                      'colorante_reactivo': 'Reactivo',
                      'base': 'Base Clear',
                      'urea': 'Urea',
                      'asutol': 'Asutol',
                      'bicarbonato': 'Bicarbonato',
                      'pasta': 'Pasta Espesante',
                      'sal_alginato': 'Sal / Alginato',
                      'aditivo': 'Aditivo'
                    };
                    return map[type] || type;
                  };
                  
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 ${isLow ? 'bg-amber-50/20' : ''}`}>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Nombre del insumo"
                              className="w-full bg-white border border-blue-400 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                              required
                            />
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                className="w-6 h-6 rounded cursor-pointer bg-white border border-slate-200 p-0"
                              />
                              <input
                                type="text"
                                value={editColor}
                                onChange={(e) => setEditColor(e.target.value)}
                                placeholder="#HEX"
                                className="w-20 bg-white border border-blue-400 rounded-lg px-2 py-1 text-[10px] text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                              />
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                            {item.hexColor && (
                              <div 
                                className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0" 
                                style={{ backgroundColor: item.hexColor }}
                                title={item.hexColor}
                              />
                            )}
                            {item.name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={(e) => handleEditTypeChange(e.target.value)}
                            className="w-full bg-white border border-blue-400 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none"
                          >
                            <option value="pigmento">Pigmento</option>
                            <option value="colorante_reactivo">Reactivo</option>
                            <option value="base">Base Clear / Copaje</option>
                            <option value="urea">Urea</option>
                            <option value="asutol">Asutol</option>
                            <option value="bicarbonato">Bicarbonato</option>
                            <option value="pasta">Pasta / Espesante</option>
                            <option value="sal_alginato">Sal / Alginato</option>
                            <option value="aditivo">Aditivo</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            item.category === 'reactivo' ? 'bg-teal-50 text-teal-700 border-teal-100' :
                            'bg-purple-50 text-purple-700 border-purple-100'
                          }`}>
                            {typeLabel(item.type)}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-extrabold text-slate-900">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editVal}
                              onChange={(e) => setEditVal(Math.max(0, Number(e.target.value)))}
                              className="w-20 border border-blue-400 bg-white rounded-xl p-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                              required
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">g</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span>{(item.quantity).toLocaleString()} g</span>
                            <span className="text-[10px] text-slate-400 font-normal mt-0.5">{(item.quantity / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-slate-400">
                        {isEditing ? (
                          <div className="flex items-center justify-end gap-1">
                            <input
                              type="number"
                              value={editMin}
                              onChange={(e) => setEditMin(Math.max(0, Number(e.target.value)))}
                              className="w-20 border border-blue-400 bg-white rounded-xl p-1 text-xs text-right font-mono focus:outline-none focus:ring-1 focus:ring-blue-400"
                              required
                            />
                            <span className="text-[10px] text-slate-400 font-semibold">g</span>
                          </div>
                        ) : (
                          <div className="flex flex-col items-end">
                            <span>{(item.minRequired).toLocaleString()} g</span>
                            <span className="text-[10px] text-slate-400 font-normal mt-0.5">{(item.minRequired / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 3 })} kg</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {isEditing ? (
                          <div className="flex justify-end items-center gap-1.5">
                            {confirmDeleteId === item.id ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-100 p-1 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteStockItem(item.id!);
                                    setEditingId(null);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-[10px] font-bold cursor-pointer"
                                >
                                  Sí, Borrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded px-2 py-1 text-[10px] font-bold cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(item.id!)}
                                  title="Eliminar insumo por completo"
                                  className="bg-red-50 hover:bg-red-100 text-red-600 p-1.5 rounded-xl transition-all cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingId(null)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded-xl px-2.5 py-1.5 text-[10px] font-bold cursor-pointer"
                                >
                                  X
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEdit(item.id!)}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl px-2.5 py-1.5 text-[10px] font-bold cursor-pointer"
                                >
                                  Guardar
                                </button>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex justify-end items-center gap-2">
                            <button
                              type="button"
                              onClick={() => handleStartEdit(item)}
                              className="text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              <Edit2 className="w-3 h-3" />
                              Editar
                            </button>
                            {item.type === 'tinta_preparada' && (
                              <button
                                type="button"
                                onClick={() => {
                                  const newGramsStr = prompt(`¿Cuántos gramos sobraron en el ${item.name}? \nEsto ajustará el tarro a esta nueva cantidad exacta.`);
                                  if (newGramsStr) {
                                    const newGrams = parseInt(newGramsStr);
                                    if (!isNaN(newGrams) && newGrams >= 0) {
                                      onUpdateStock(item.id!, newGrams);
                                    } else {
                                      alert("Por favor ingresa un número válido mayor o igual a 0.");
                                    }
                                  }
                                }}
                                className="text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 px-2 py-1 rounded-lg text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer border border-emerald-200"
                              >
                                Registrar Retorno
                              </button>
                            )}
                            
                            {confirmDeleteId === item.id ? (
                              <div className="flex items-center gap-1 bg-red-50 border border-red-100 p-1 rounded-xl">
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteStockItem(item.id!);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="bg-red-600 hover:bg-red-700 text-white rounded px-2 py-1 text-[10px] font-bold cursor-pointer"
                                >
                                  Sí, Borrar
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(null)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-500 rounded px-2 py-1 text-[10px] font-bold cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(item.id!)}
                                title="Eliminar insumo"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1.5 rounded-lg transition-all cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
          
          {/* Controles de paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between py-4 px-2 border-t border-slate-100 mt-2">
              <span className="text-xs text-slate-500">
                Mostrando {(currentPage - 1) * itemsPerPage + 1} a {Math.min(currentPage * itemsPerPage, filteredStock.length)} de {filteredStock.length}
              </span>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  Anterior
                </button>
                <div className="flex items-center gap-1 px-2">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-bold transition-colors ${
                        currentPage === page 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-white hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed bg-slate-50 hover:bg-slate-100 text-slate-600"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Columna Lateral - Alertas y Consejos */}
      <div className="lg:col-span-4 space-y-6">
        
        {/* Panel de Alertas Críticas */}
        <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-amber-500" />
            Alertas de Inventario
          </h4>

          {lowStockItems.length === 0 ? (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-start gap-3">
              <ShieldCheck className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-bold text-emerald-800">Todo en Orden</p>
                <p className="text-[11px] text-emerald-600 mt-0.5">Todos los componentes e insumos de color superan el stock mínimo de seguridad.</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4">
                <p className="text-xs font-bold text-amber-800 mb-1">Hay {lowStockItems.length} insumo(s) crítico(s)</p>
                <p className="text-[11px] text-amber-600 leading-relaxed">
                  Realiza un pedido pronto para evitar detener el estampado en prensa o el área de reactivos.
                </p>
              </div>

              <div className="space-y-2 max-h-[220px] overflow-y-auto">
                {lowStockItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{item.name}</p>
                      <p className="text-[10px] text-slate-400 capitalize">
                        {item.category === 'reactivo' ? 'Reactivo' : 'Pigmentos'} • {item.type}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-extrabold text-red-600 font-mono">{item.quantity.toLocaleString()} g</p>
                      <p className="text-[9px] text-slate-400 font-mono">Mín. {item.minRequired.toLocaleString()} g</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Tarjeta de Control de Tintas */}
        <div className="bg-gradient-to-br from-blue-900 to-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -mr-12 -mt-12" />
          <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Recomendaciones de {currentUser.name.split('@')[0]}</h4>
          <p className="text-sm font-semibold mb-3 leading-relaxed">Instrucciones para el control del inventario:</p>
          <ul className="text-xs space-y-2.5 text-slate-300">
            <li className="flex gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Pigmentos:</strong> Pesar siempre las bases clear y pigmentos antes de preparar el lote para toallas y hamacas.</span>
            </li>
            <li className="flex gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Reactivos:</strong> Al usar Alginato de Sodio como espesante, prepáralo con anticipación para asegurar la viscosidad adecuada.</span>
            </li>
            <li className="flex gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Control alcalino:</strong> Recuerda agregar el Carbonato de Sodio (fijador reactivo) justo antes de iniciar la estampación, ya que inicia la reacción del colorante.</span>
            </li>
          </ul>
        </div>

      </div>

      {/* Modal Pasta Madre con Fórmula Editable */}
      {showPastaMadreModal && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowPastaMadreModal(false)}
        >
          <div 
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh] border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 shrink-0">
              <h3 className="font-extrabold text-slate-800 flex items-center gap-2 text-base">
                <Beaker className="w-5 h-5 text-teal-600" />
                Preparar Lote de Pasta Madre
              </h3>
              <button 
                onClick={() => setShowPastaMadreModal(false)}
                className="text-slate-400 hover:text-slate-600 p-1 flex items-center gap-1.5 cursor-pointer rounded-lg hover:bg-slate-200/50 transition-colors"
                title="Cerrar (Esc)"
              >
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">Esc</span>
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-5 sm:p-6 overflow-y-auto custom-scrollbar">
              {pastaMadreSuccess ? (
                <div className="flex flex-col items-center justify-center py-10 animate-scale-in">
                  <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4 text-emerald-600">
                    <Check className="w-8 h-8" />
                  </div>
                  <h4 className="text-xl font-black text-slate-800">¡Lote Preparado con Éxito!</h4>
                  <p className="text-sm text-slate-500 mt-2 text-center max-w-sm">
                    Se han descontado los insumos según la fórmula personalizada y se añadieron <strong className="text-slate-800">{pastaMadreKg} kg</strong> de "Pasta Madre (Preparada)" al stock.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-5 leading-relaxed">
                    Esta acción descontará automáticamente los insumos seleccionados de tu inventario según la receta y creará el ítem <strong>"Pasta Madre (Preparada)"</strong>. El agua no descuenta stock.
                  </p>
                  
                  {/* Selector de Cantidad Total */}
                  <div className="mb-5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                      Cantidad Total a Preparar (Kg)
                    </label>
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1">
                        <input 
                          type="number" 
                          min="1"
                          value={pastaMadreKg}
                          onChange={(e) => handleKgChange(Number(e.target.value))}
                          className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xl font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500 text-center shadow-inner"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          Kg
                        </span>
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        {[100, 200, 300, 500].map(kgVal => (
                          <button
                            key={kgVal}
                            type="button"
                            onClick={() => handleKgChange(kgVal)}
                            className={`px-2.5 py-2 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                              pastaMadreKg === kgVal
                                ? 'bg-teal-600 text-white border-teal-600 shadow-sm'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {kgVal}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* FÓRMULA EDITABLE */}
                  <div className="bg-slate-50/70 rounded-2xl p-4 border border-slate-200 mb-5">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <h5 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                          <Sliders className="w-3.5 h-3.5 text-teal-600" />
                          Fórmula Editable de Componentes
                        </h5>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Modifica los porcentajes (%) para ajustar la viscosidad y dosificación.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleResetFormula}
                        className="text-[11px] text-slate-600 hover:text-teal-700 font-bold flex items-center gap-1 bg-white border border-slate-200 hover:bg-slate-100 px-2.5 py-1 rounded-xl transition-colors cursor-pointer shrink-0 shadow-sm"
                        title="Restablecer a valores por defecto (7.5%, 1%, 3.5%, 4.5%)"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Restablecer</span>
                      </button>
                    </div>

                    <div className="space-y-2.5">
                      {pastaMadreFormula.map(ing => {
                        const itemInStock = findStockItemForIngredient(ing);
                        const ingGrams = (totalPastaGrams * (Number(ing.percentage) || 0)) / 100;
                        const hasEnough = itemInStock ? itemInStock.quantity >= ingGrams : false;

                        return (
                          <div 
                            key={ing.id} 
                            className={`p-2.5 rounded-xl border transition-all ${
                              hasEnough 
                                ? 'bg-white border-slate-200 shadow-sm' 
                                : 'bg-red-50/70 border-red-200 shadow-sm'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              {/* Nombre y stock disponible */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="font-bold text-xs text-slate-800 truncate">
                                    {ing.name}
                                  </span>
                                  {itemInStock && itemInStock.name !== ing.name && (
                                    <span className="text-[10px] text-slate-400 font-normal truncate" title={itemInStock.name}>
                                      ({itemInStock.name})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                                  <span>Disponible:</span>
                                  <span className={`font-mono font-bold ${hasEnough ? 'text-slate-700' : 'text-red-600'}`}>
                                    {itemInStock ? `${(itemInStock.quantity / 1000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 2 })} kg` : 'No encontrado'}
                                  </span>
                                  {!hasEnough && (
                                    <span className="text-red-600 font-bold text-[9px] bg-red-100 px-1.5 py-0.2 rounded">Falta stock</span>
                                  )}
                                </div>
                              </div>

                              {/* Input de porcentaje y cálculo/edición de gramos */}
                              <div className="flex items-center gap-2 shrink-0">
                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus-within:border-teal-500 focus-within:bg-white transition-all">
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    max="100"
                                    value={ing.percentage}
                                    onChange={e => handleUpdateIngredientPct(ing.id, parseFloat(e.target.value) || 0)}
                                    className="w-14 bg-transparent text-xs font-black text-slate-900 text-right focus:outline-none"
                                    title="Porcentaje (%)"
                                  />
                                  <span className="text-xs font-bold text-slate-400">%</span>
                                </div>

                                <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 focus-within:border-teal-500 focus-within:bg-white transition-all">
                                  <input
                                    type="number"
                                    step="1"
                                    min="0"
                                    value={ing.grams !== undefined ? ing.grams : Math.round(ingGrams)}
                                    onChange={e => handleUpdateIngredientGrams(ing.id, parseFloat(e.target.value) || 0)}
                                    className="w-20 bg-transparent text-xs font-black text-slate-900 text-right focus:outline-none font-mono"
                                    title="Gramos (g) a dosificar"
                                  />
                                  <span className="text-xs font-bold text-slate-400">g</span>
                                </div>

                                {pastaMadreFormula.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveIngredient(ing.id)}
                                    className="p-1 text-slate-300 hover:text-red-500 transition-colors cursor-pointer"
                                    title="Quitar de la fórmula"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Fila del Agua (Balance automático) */}
                      <div className="p-2.5 rounded-xl bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                        <div>
                          <span className="font-bold text-xs text-teal-900">Agua (Balance)</span>
                          <p className="text-[10px] text-teal-600">Calculada automáticamente para completar el 100%</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-black text-xs text-teal-800 bg-teal-100 px-2 py-0.5 rounded-md font-mono">
                            {waterPct.toFixed(1)}%
                          </span>
                          <span className="font-mono font-black text-xs text-teal-900 w-24 text-right">
                            {Math.round(waterGrams).toLocaleString()} g
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Resumen de totales */}
                    <div className="mt-3 pt-2.5 border-t border-slate-200 flex items-center justify-between text-xs">
                      <span className="text-slate-500 font-semibold">Total Componentes:</span>
                      <span className={`font-mono font-bold ${totalComponentsPct > 100 ? 'text-red-600' : 'text-slate-700'}`}>
                        {totalComponentsPct.toFixed(1)}% {totalComponentsPct > 100 ? '(¡Supera el 100%!)' : `+ ${waterPct.toFixed(1)}% Agua = 100%`}
                      </span>
                    </div>

                    {/* Botón para añadir insumo adicional de stock */}
                    {!showAddCustomIngredient ? (
                      <button
                        type="button"
                        onClick={() => setShowAddCustomIngredient(true)}
                        className="mt-3 text-xs font-bold text-teal-700 hover:text-teal-800 flex items-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Agregar otro insumo a la fórmula...</span>
                      </button>
                    ) : (
                      <div className="mt-3 p-3 bg-white border border-teal-200 rounded-xl space-y-2 shadow-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-700">Seleccionar insumo de stock</span>
                          <button
                            type="button"
                            onClick={() => setShowAddCustomIngredient(false)}
                            className="text-slate-400 hover:text-slate-600 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                        <div className="flex gap-2">
                          <select
                            value={selectedStockIdToAdd}
                            onChange={e => setSelectedStockIdToAdd(e.target.value)}
                            className="flex-1 bg-slate-50 border border-slate-200 rounded-lg p-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-teal-500"
                          >
                            <option value="">Seleccionar insumo...</option>
                            {stock
                              .filter(s => !pastaMadreFormula.some(f => f.stockId === s.id || f.name.toLowerCase() === s.name.toLowerCase()))
                              .map(s => (
                                <option key={s.id} value={s.id}>
                                  {s.name} ({(s.quantity / 1000).toFixed(1)} kg disp.)
                                </option>
                              ))}
                          </select>
                          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-2 py-1">
                            <input
                              type="number"
                              step="0.1"
                              min="0.1"
                              max="50"
                              value={newIngredientPct}
                              onChange={e => setNewIngredientPct(parseFloat(e.target.value) || 0)}
                              className="w-12 text-xs font-bold text-right focus:outline-none"
                            />
                            <span className="text-xs font-bold text-slate-400">%</span>
                          </div>
                          <button
                            type="button"
                            onClick={handleAddIngredientToFormula}
                            disabled={!selectedStockIdToAdd}
                            className="bg-teal-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-teal-700 disabled:opacity-50 cursor-pointer"
                          >
                            Agregar
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  {pastaMadreError && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-xl text-xs mb-4 border border-red-200 flex gap-2 items-start font-medium animate-fade-in">
                      <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-red-500" />
                      <p>{pastaMadreError}</p>
                    </div>
                  )}

                  <button
                    onClick={handlePreparePastaMadre}
                    disabled={totalComponentsPct > 100}
                    className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3 px-4 rounded-xl transition-all shadow-lg shadow-teal-600/20 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  >
                    <Check className="w-4 h-4" />
                    <span>Confirmar Preparación</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
