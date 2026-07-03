import { useState } from 'react';
import { Layers, Plus, TrendingDown, ArrowUpRight, AlertTriangle, ShieldCheck, Filter, Trash2, Edit2 } from 'lucide-react';
import { StockItem } from '../types';

interface StockManagerProps {
  stock: StockItem[];
  onUpdateStock: (id: string, newQty: number) => void;
  onUpdateStockItem: (id: string, item: Partial<StockItem>) => void;
  onDeleteStockItem: (id: string) => void;
  onAddStockItem: (item: StockItem) => void;
}

export default function StockManager({ stock, onUpdateStock, onUpdateStockItem, onDeleteStockItem, onAddStockItem }: StockManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newType, setNewType] = useState<'base' | 'pasta' | 'pigmento' | 'colorante_reactivo' | 'aditivo'>('base');
  const [newCategory, setNewCategory] = useState<'serigrafia' | 'reactivo'>('serigrafia');
  const [newQty, setNewQty] = useState<number>(1000);
  const [newMin, setNewMin] = useState<number>(500);

  // Filtro de categorías: todos, serigrafia, reactivo
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'todos' | 'serigrafia' | 'reactivo'>('todos');

  // Estados para actualizar stock de manera interactiva (campos completos)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState<string>('');
  const [editType, setEditType] = useState<'base' | 'pasta' | 'pigmento' | 'colorante_reactivo' | 'aditivo'>('base');
  const [editCategory, setEditCategory] = useState<'serigrafia' | 'reactivo'>('serigrafia');
  const [editVal, setEditVal] = useState<number>(0);
  const [editMin, setEditMin] = useState<number>(0);

  // Estado para confirmación de eliminación segura
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const lowStockItems = stock.filter(item => item.quantity <= item.minRequired);

  const handleTypeChange = (type: 'base' | 'pasta' | 'pigmento' | 'colorante_reactivo' | 'aditivo') => {
    setNewType(type);
    // Auto-ajustar categoría basada en el tipo seleccionado
    if (type === 'colorante_reactivo' || type === 'pasta') {
      setNewCategory('reactivo');
    } else if (type === 'base' || type === 'pigmento') {
      setNewCategory('serigrafia');
    }
  };

  const handleEditTypeChange = (type: 'base' | 'pasta' | 'pigmento' | 'colorante_reactivo' | 'aditivo') => {
    setEditType(type);
    // Auto-ajustar categoría basada en el tipo seleccionado
    if (type === 'colorante_reactivo' || type === 'pasta') {
      setEditCategory('reactivo');
    } else if (type === 'base' || type === 'pigmento') {
      setEditCategory('serigrafia');
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
      minRequired: newMin
    };

    onAddStockItem(newItem);
    setNewName('');
    setNewQty(1000);
    setNewMin(500);
    setShowAddForm(false);
  };

  const handleStartEdit = (item: StockItem) => {
    setEditingId(item.id || null);
    setEditName(item.name);
    setEditType(item.type);
    setEditCategory(item.category || 'serigrafia');
    setEditVal(item.quantity);
    setEditMin(item.minRequired);
    setConfirmDeleteId(null);
  };

  const handleSaveEdit = (id: string) => {
    if (!editName.trim()) return;
    onUpdateStockItem(id, {
      name: editName,
      type: editType,
      category: editCategory,
      quantity: editVal,
      minRequired: editMin
    });
    setEditingId(null);
  };

  // Filtrado de stock basado en la pestaña de categoría seleccionada
  const filteredStock = stock.filter(item => {
    if (activeCategoryFilter === 'todos') return true;
    const cat = item.category || 'serigrafia'; // Por defecto los preexistentes son de serigrafía
    return cat === activeCategoryFilter;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-start overflow-hidden" id="stock-manager-view">
      
      {/* Columna Principal - Lista de Insumos */}
      <div className="lg:col-span-8 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm flex flex-col h-full overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-bold text-slate-900">Inventario y Lista de Insumos</h3>
          </div>
          
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="bg-blue-600 text-white rounded-xl px-4 py-2 text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            {showAddForm ? 'Cerrar' : 'Agregar Insumo Fijo'}
          </button>
        </div>

        {/* Separación por Pestañas / Filtro de Líneas de Trabajo */}
        <div className="flex border-b border-slate-100 mb-6 gap-2">
          <button
            onClick={() => setActiveCategoryFilter('todos')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer ${
              activeCategoryFilter === 'todos' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Todos ({stock.length})
          </button>
          <button
            onClick={() => setActiveCategoryFilter('serigrafia')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer ${
              activeCategoryFilter === 'serigrafia' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Línea Serigrafía / Pigmentos ({stock.filter(i => (i.category || 'serigrafia') === 'serigrafia').length})
          </button>
          <button
            onClick={() => setActiveCategoryFilter('reactivo')}
            className={`pb-3 px-4 text-xs font-bold transition-all relative cursor-pointer ${
              activeCategoryFilter === 'reactivo' 
                ? 'text-blue-600 border-b-2 border-blue-600' 
                : 'text-slate-400 hover:text-slate-600'
            }`}
          >
            Línea Reactiva ({stock.filter(i => i.category === 'reactivo').length})
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

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Tipo de Componente</label>
                <select
                  value={newType}
                  onChange={(e) => handleTypeChange(e.target.value as any)}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-semibold"
                >
                  <option value="base">Base Clear / Copaje (Serigrafía)</option>
                  <option value="pigmento">Pigmento Concentrado (Serigrafía)</option>
                  <option value="pasta">Pasta / Espesante (Reactivos)</option>
                  <option value="colorante_reactivo">Colorante Reactivo (Reactivos)</option>
                  <option value="aditivo">Aditivo / Auxiliar (Ambos)</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Línea de Trabajo / Sistema</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as 'serigrafia' | 'reactivo')}
                  className="w-full bg-white border border-slate-200 rounded-xl p-2.5 text-xs focus:ring-1 focus:ring-blue-400 focus:outline-none text-slate-800 font-semibold"
                >
                  <option value="serigrafia">Estampado Pigmentado (Serigrafía)</option>
                  <option value="reactivo">Colorantes Reactivos (Estampación/Teñido)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
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
                  <th className="py-3 px-4 font-semibold">Línea</th>
                  <th className="py-3 px-4 font-semibold text-right">Cantidad (g)</th>
                  <th className="py-3 px-4 font-semibold text-right">Alerta Mín. (g)</th>
                  <th className="py-3 px-4 font-semibold text-right w-[180px]">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filteredStock.map((item) => {
                  const isLow = item.quantity <= item.minRequired;
                  const isEditing = editingId === item.id;
                  const categoryName = item.category === 'reactivo' ? 'Reactivo' : 'Serigrafía';
                  
                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/50 ${isLow ? 'bg-amber-50/20' : ''}`}>
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {isEditing ? (
                          <input
                            type="text"
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            placeholder="Nombre del insumo"
                            className="w-full bg-white border border-blue-400 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-blue-400"
                            required
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            {isLow && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                            {item.name}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editType}
                            onChange={(e) => handleEditTypeChange(e.target.value as any)}
                            className="w-full bg-white border border-blue-400 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none"
                          >
                            <option value="base">Base Clear</option>
                            <option value="pigmento">Pigmento</option>
                            <option value="pasta">Pasta Espesante</option>
                            <option value="colorante_reactivo">Colorante Reactivo</option>
                            <option value="aditivo">Aditivo</option>
                          </select>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            item.type === 'base' ? 'bg-sky-50 text-sky-700 border-sky-100' :
                            item.type === 'pasta' ? 'bg-teal-50 text-teal-700 border-teal-100' :
                            item.type === 'pigmento' ? 'bg-purple-50 text-purple-700 border-purple-100' :
                            item.type === 'colorante_reactivo' ? 'bg-rose-50 text-rose-700 border-rose-100' :
                            'bg-amber-50 text-amber-700 border-amber-100'
                          }`}>
                            {item.type === 'base' ? 'Base Clear' :
                             item.type === 'pasta' ? 'Pasta Espesante' :
                             item.type === 'pigmento' ? 'Pigmento' :
                             item.type === 'colorante_reactivo' ? 'Colorante Reactivo' :
                             'Aditivo'}
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isEditing ? (
                          <select
                            value={editCategory}
                            onChange={(e) => setEditCategory(e.target.value as any)}
                            className="w-full bg-white border border-blue-400 rounded-xl px-2 py-1.5 text-xs text-slate-800 font-semibold focus:outline-none"
                          >
                            <option value="serigrafia">Serigrafía</option>
                            <option value="reactivo">Reactivo</option>
                          </select>
                        ) : (
                          <span className={`text-[11px] font-semibold ${item.category === 'reactivo' ? 'text-teal-600' : 'text-slate-500'}`}>
                            {categoryName}
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
                          `${(item.quantity).toLocaleString()} g`
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
                          `${(item.minRequired).toLocaleString()} g`
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
                        {item.category === 'reactivo' ? 'Reactivo' : 'Serigrafía'} • {item.type}
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
          <h4 className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-3">Recomendaciones de Enoc</h4>
          <p className="text-sm font-semibold mb-3 leading-relaxed">Instrucciones para el control del inventario:</p>
          <ul className="text-xs space-y-2.5 text-slate-300">
            <li className="flex gap-2">
              <ArrowUpRight className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <span><strong>Serigrafía:</strong> Pesar siempre las bases clear y pigmentos antes de preparar el lote para toallas y hamacas.</span>
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
    </div>
  );
}
