import { useState, useEffect } from 'react';
import { 
  seedDatabaseIfEmpty, 
  getPantoneColors, 
  getStockItems, 
  getBatchLogs, 
  getTeamMembers,
  addPantoneColor,
  updatePantoneColor,
  deletePantoneColor,
  addStockItem,
  updateStockItemQuantity,
  updateStockItem,
  deleteStockItem,
  addBatchLog,
  addTeamMember
} from './lib/dataService';
import { PantoneColor, StockItem, BatchLog, TeamMember } from './types';
import Sidebar from './components/Sidebar';
import PantoneSelector from './components/PantoneSelector';
import FormulaDetail from './components/FormulaDetail';
import StockManager from './components/StockManager';
import BatchLogList from './components/BatchLogList';
import TeamManager from './components/TeamManager';
import AiAssistant from './components/AiAssistant';
import PantoneFormModal from './components/PantoneFormModal';
import { Palette, Scale, AlertCircle, Loader2 } from 'lucide-react';

export default function App() {
  // Tab activa
  const [activeTab, setActiveTab] = useState<string>('pantones');
  
  // Usuario activo en sesión del taller
  const [currentUser] = useState({
    name: 'Enoc Chatelain',
    role: 'Líder de Serigrafía / Color',
    initials: 'EC'
  });

  // Datos principales del taller
  const [pantones, setPantones] = useState<PantoneColor[]>([]);
  const [selectedPantone, setSelectedPantone] = useState<PantoneColor | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [batches, setBatches] = useState<BatchLog[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);

  // Estados de carga y error
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Estados para modal de fórmulas
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPantone, setEditingPantone] = useState<PantoneColor | null>(null);

  // Prompt pre-rellenado para el chat con IA
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>('');

  // Cargar datos al montar el componente
  useEffect(() => {
    async function loadAllData() {
      setLoading(true);
      setErrorMsg('');
      try {
        // 1. Sembrar base de datos si está vacía
        await seedDatabaseIfEmpty();

        // 2. Traer colecciones de Firestore
        let pColors = await getPantoneColors();
        let sItems = await getStockItems();
        const bLogs = await getBatchLogs();
        const tMembers = await getTeamMembers();

        // Limpieza automática de ítems "malla"/"rasero" no deseados y duplicados de Pantone
        let databaseChanged = false;
        const cleanColors: PantoneColor[] = [];
        const codesSeen = new Set<string>();

        for (const p of pColors) {
          const codeLower = (p.code || '').toLowerCase().trim();
          const nameLower = (p.name || '').toLowerCase().trim();

          const isUnwanted = 
            codeLower.includes('malla') || 
            nameLower.includes('malla') || 
            codeLower.includes('rasero') || 
            nameLower.includes('rasero') || 
            codeLower.includes('mall') || 
            nameLower.includes('mall') || 
            codeLower.includes('rasc') || 
            nameLower.includes('rasc') ||
            codeLower.includes('squeegee') ||
            nameLower.includes('squeegee');

          if (isUnwanted) {
            if (p.id) {
              await deletePantoneColor(p.id);
              databaseChanged = true;
            }
            continue;
          }

          if (codesSeen.has(codeLower)) {
            if (p.id) {
              await deletePantoneColor(p.id);
              databaseChanged = true;
            }
            continue;
          }

          codesSeen.add(codeLower);
          cleanColors.push(p);
        }

        // Limpieza de stock de ítems "malla" o "rasero"
        const cleanStock: StockItem[] = [];
        for (const item of sItems) {
          const nameLower = (item.name || '').toLowerCase().trim();
          const isUnwantedStock = 
            nameLower.includes('malla') || 
            nameLower.includes('rasero') || 
            nameLower.includes('mall') || 
            nameLower.includes('rasc') ||
            nameLower.includes('squeegee') ||
            nameLower.includes('mesh');

          if (isUnwantedStock) {
            if (item.id) {
              await deleteStockItem(item.id);
              databaseChanged = true;
            }
            continue;
          }
          cleanStock.push(item);
        }

        if (databaseChanged) {
          pColors = await getPantoneColors();
          sItems = await getStockItems();
        }

        setPantones(pColors);
        setStock(sItems);
        setBatches(bLogs);
        setTeam(tMembers);

        // Seleccionar primer pantone por defecto
        if (pColors.length > 0) {
          setSelectedPantone(pColors[0]);
        }
      } catch (err: any) {
        console.error('Error cargando datos de Firestore:', err);
        setErrorMsg('Error al conectar con la base de datos segura. Por favor, recarga la pestaña.');
      } finally {
        setLoading(false);
      }
    }
    loadAllData();
  }, []);

  // Actualizar listas después de cambios
  const refreshPantones = async (deletedId?: string) => {
    const pColors = await getPantoneColors();
    setPantones(pColors);
    
    // Si se eliminó la selección actual, o si no hay selección, seleccionar el primero disponible
    if (selectedPantone && selectedPantone.id !== deletedId) {
      const updated = pColors.find(p => p.id === selectedPantone.id) || pColors.find(p => p.code === selectedPantone.code);
      if (updated) {
        setSelectedPantone(updated);
        return;
      }
    }
    
    // Seleccionar el primer Pantone disponible de la lista actualizada
    setSelectedPantone(pColors[0] || null);
  };

  const refreshStock = async () => {
    const sItems = await getStockItems();
    setStock(sItems);
  };

  const refreshBatches = async () => {
    const bLogs = await getBatchLogs();
    setBatches(bLogs);
  };

  const refreshTeam = async () => {
    const tMembers = await getTeamMembers();
    setTeam(tMembers);
  };

  // Acciones CRUD disparadas por los subcomponentes
  const handleCreateOrUpdatePantone = async (pantone: PantoneColor) => {
    try {
      let savedPantone: PantoneColor | null = null;
      if (pantone.id) {
        // Actualizar existente
        await updatePantoneColor(pantone.id, pantone);
        savedPantone = pantone;
      } else {
        // Crear nuevo
        const newId = await addPantoneColor(pantone);
        savedPantone = { ...pantone, id: newId };
      }
      setIsModalOpen(false);
      setEditingPantone(null);
      
      // Volver a cargar la lista de Pantones
      const pColors = await getPantoneColors();
      setPantones(pColors);

      // Auto-seleccionar el Pantone que acabamos de registrar o actualizar para que el usuario lo vea de inmediato
      if (savedPantone) {
        const found = pColors.find(p => p.id === savedPantone!.id) || pColors.find(p => p.code === savedPantone!.code);
        if (found) {
          setSelectedPantone(found);
        }
      }
    } catch (err) {
      console.error('Error al guardar Pantone:', err);
    }
  };

  const handleDeletePantone = async (id: string) => {
    try {
      await deletePantoneColor(id);
      await refreshPantones(id);
    } catch (err) {
      console.error('Error al eliminar Pantone:', err);
    }
  };

  const handleUpdateStockQty = async (id: string, newQty: number) => {
    try {
      await updateStockItemQuantity(id, newQty);
      await refreshStock();
    } catch (err) {
      console.error('Error al actualizar stock:', err);
    }
  };

  const handleUpdateStockItem = async (id: string, item: Partial<StockItem>) => {
    try {
      await updateStockItem(id, item);
      await refreshStock();
    } catch (err) {
      console.error('Error al editar insumo:', err);
    }
  };

  const handleDeleteStockItem = async (id: string) => {
    try {
      await deleteStockItem(id);
      await refreshStock();
    } catch (err) {
      console.error('Error al eliminar insumo:', err);
    }
  };

  const handleAddStockItem = async (item: StockItem) => {
    try {
      await addStockItem(item);
      await refreshStock();
    } catch (err) {
      console.error('Error al agregar insumo:', err);
    }
  };

  const handleAddBatch = async (batch: BatchLog): Promise<boolean> => {
    try {
      await addBatchLog(batch);
      // Al registrar un lote, refrescamos stock e historial de lotes
      await refreshBatches();
      await refreshStock();
      return true;
    } catch (err) {
      console.error('Error al registrar lote:', err);
      return false;
    }
  };

  const handleAddMember = async (member: TeamMember) => {
    try {
      await addTeamMember(member);
      await refreshTeam();
    } catch (err) {
      console.error('Error al agregar miembro de equipo:', err);
    }
  };

  // Redirigir al chat de IA con pregunta pre-rellenada
  const handleAskAi = (prompt: string) => {
    setAiInitialPrompt(prompt);
    setActiveTab('asistente');
  };

  return (
    <div className="h-screen w-screen bg-slate-50 flex font-sans overflow-hidden text-slate-800" id="main-app-container">
      
      {/* Barra de Navegación Lateral */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        currentUser={currentUser} 
      />

      {/* Área Principal de Contenido */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        
        {/* Cabecera / Header Superior */}
        <header className="h-20 bg-white border-b border-slate-200 px-6 sm:px-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2">
              <Palette className="w-6 h-6 text-blue-600" />
              {activeTab === 'pantones' && 'Formulación de Color'}
              {activeTab === 'calculadora' && 'Calculadora de Mezclas de Color'}
              {activeTab === 'historial' && 'Historial de Lotes de Estampado'}
              {activeTab === 'asistente' && 'Consultor Técnico de Color (IA)'}
              {activeTab === 'stock' && 'Gestión de Stock de Tintas'}
              {activeTab === 'equipo' && 'Equipo de Taller'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 font-medium italic mt-0.5">
              Sistema Centralizado de Serigrafía — Fábrica de Toallas & Hamacas
            </p>
          </div>

          <div>
            {activeTab === 'pantones' && (
              <button 
                onClick={() => {
                  setEditingPantone(null);
                  setIsModalOpen(true);
                }}
                className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition-all shadow-md shrink-0 cursor-pointer"
              >
                Nueva Fórmula +
              </button>
            )}
          </div>
        </header>

        {/* Workspace de Trabajo */}
        <div className="flex-1 p-6 sm:p-8 overflow-hidden min-h-0 bg-slate-50/50">
          {loading ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-slate-500">
              <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
              <p className="text-sm font-bold">Iniciando base de datos segura y confiable...</p>
              <p className="text-xs text-slate-400 mt-1">Por favor espera un momento.</p>
            </div>
          ) : errorMsg ? (
            <div className="h-full w-full flex flex-col items-center justify-center text-red-500 max-w-md mx-auto text-center p-6 bg-white rounded-3xl border border-red-100 shadow-sm">
              <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
              <h3 className="text-md font-bold mb-1">Error de Conexión</h3>
              <p className="text-xs text-slate-500">{errorMsg}</p>
            </div>
          ) : (
            <>
              {/* Tab Catálogo Pantone */}
              {activeTab === 'pantones' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch">
                  <div className="lg:col-span-4 h-full min-h-0">
                    <PantoneSelector 
                      pantones={pantones}
                      selectedPantone={selectedPantone}
                      onSelectPantone={setSelectedPantone}
                      onOpenCreateModal={() => {
                        setEditingPantone(null);
                        setIsModalOpen(true);
                      }}
                    />
                  </div>
                  <div className="lg:col-span-8 h-full min-h-0">
                    <FormulaDetail 
                      pantone={selectedPantone}
                      team={team}
                      onAddBatch={handleAddBatch}
                      onDeletePantone={handleDeletePantone}
                      onEditPantone={(p) => {
                        setEditingPantone(p);
                        setIsModalOpen(true);
                      }}
                      onAskAi={handleAskAi}
                    />
                  </div>
                </div>
              )}

              {/* Tab Calculadora directa */}
              {activeTab === 'calculadora' && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-full items-stretch">
                  <div className="lg:col-span-4 h-full min-h-0 flex flex-col justify-between p-6 bg-white rounded-3xl border border-slate-200 shadow-sm">
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Scale className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-bold text-slate-900">Calculadora Directa</h3>
                      </div>
                      <p className="text-xs text-slate-500 leading-relaxed">
                        Selecciona un Pantone del catálogo lateral y utiliza los controles de peso en gramos para recalcular de manera automática las proporciones exactas del pesaje de tintas en balanza.
                      </p>
                    </div>
                    <button 
                      onClick={() => setActiveTab('pantones')}
                      className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-xs font-bold text-center w-full transition-all cursor-pointer shadow-md shadow-blue-500/10"
                    >
                      Ir al Catálogo de Mezcla
                    </button>
                  </div>
                  <div className="lg:col-span-8 h-full min-h-0">
                    <FormulaDetail 
                      pantone={selectedPantone}
                      team={team}
                      onAddBatch={handleAddBatch}
                      onDeletePantone={handleDeletePantone}
                      onEditPantone={(p) => {
                        setEditingPantone(p);
                        setIsModalOpen(true);
                      }}
                      onAskAi={handleAskAi}
                    />
                  </div>
                </div>
              )}

              {/* Tab Historial de Lotes */}
              {activeTab === 'historial' && (
                <BatchLogList batches={batches} />
              )}

              {/* Tab Stock de Tintas */}
              {activeTab === 'stock' && (
                <StockManager 
                  stock={stock}
                  onUpdateStock={handleUpdateStockQty}
                  onUpdateStockItem={handleUpdateStockItem}
                  onDeleteStockItem={handleDeleteStockItem}
                  onAddStockItem={handleAddStockItem}
                />
              )}

              {/* Tab Equipo */}
              {activeTab === 'equipo' && (
                <TeamManager 
                  team={team}
                  onAddMember={handleAddMember}
                />
              )}

              {/* Tab Consultor AI */}
              {activeTab === 'asistente' && (
                <AiAssistant 
                  initialPrompt={aiInitialPrompt}
                  onClearInitialPrompt={() => setAiInitialPrompt('')}
                />
              )}
            </>
          )}
        </div>
      </main>

      {/* Modal para Crear/Editar Fórmulas Pantone */}
      <PantoneFormModal 
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingPantone(null);
        }}
        onSubmit={handleCreateOrUpdatePantone}
        stock={stock}
        editingPantone={editingPantone}
      />

    </div>
  );
}
