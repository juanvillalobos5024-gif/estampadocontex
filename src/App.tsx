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
  syncInventoryWithExcel,
  addBatchLog,
  deleteBatchLog,
  addTeamMember,
  deleteTeamMember,
  getWorkOrders,
  addWorkOrder,
  updateWorkOrder,
  deleteWorkOrder,
  getDesigns,
  addDesign,
  updateDesign,
  syncWorkOrdersToProductionRecords,
  removeProductionRecordForOrder,
  getDeletedBatchIds,
  INITIAL_BATCHES,
  subscribeToWorkOrders,
  subscribeToBatches,
  subscribeToStock,
  subscribeToDesigns
} from './lib/dataService';
import { PantoneColor, StockItem, BatchLog, TeamMember, WorkOrder, Design } from './types';
import Sidebar from './components/Sidebar';
import PantoneSelector from './components/PantoneSelector';
import FormulaDetail from './components/FormulaDetail';
import StockManager from './components/StockManager';
import BatchLogList from './components/BatchLogList';
import TeamManager from './components/TeamManager';
import WorkOrderManager from './components/WorkOrderManager';
import AiAssistant from './components/AiAssistant';
import PantoneFormModal from './components/PantoneFormModal';
import Login from './components/Login';
import PantoneGrid from './components/PantoneGrid';
import FormulaModal from './components/FormulaModal';
import CalculatorWorkspace from './components/CalculatorWorkspace';
import DesignManager from './components/DesignManager';
import ImageAnalyzer from './components/ImageAnalyzer';
import { Palette, Scale, AlertCircle, Loader2, Menu, Paintbrush, History, ClipboardList } from 'lucide-react';
// @ts-ignore
import logoUrl from '@/assets/logo.jpeg';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { auth } from './lib/firebase';
import inventoryData from './inventory_data.json';
import pantonesData from './pantones_data.json';

export default function App() {
  // Estado de autenticación
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);

  // Tab activa persistente
  const [activeTab, setActiveTab] = useState<string>(() => {
    const saved = localStorage.getItem('activeTab') || 'pantones';
    return saved === 'proyeccion' ? 'pantones' : saved;
  });

  useEffect(() => {
    localStorage.setItem('activeTab', activeTab);
  }, [activeTab]);
  
  // Usuario activo en sesión del taller
  const [currentUser, setCurrentUser] = useState({
    name: 'Enoc Chatelain',
    role: 'Líder de Pigmentos / Color',
    initials: 'EC'
  });

  // Datos principales del taller
  const [pantones, setPantones] = useState<PantoneColor[]>([]);
  const [selectedPantone, setSelectedPantone] = useState<PantoneColor | null>(null);
  const [stock, setStock] = useState<StockItem[]>([]);
  const [batches, setBatches] = useState<BatchLog[]>(() => {
    const deletedIds = getDeletedBatchIds();
    try {
      const stored = localStorage.getItem('taller_batches_salidas_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed
            .filter((b: any) => b && b.id && !deletedIds.has(b.id))
            .map((b: any) => ({
              ...b,
              timestamp: b.timestamp ? new Date(b.timestamp) : new Date()
            }));
        }
      }
    } catch (e) {}
    return INITIAL_BATCHES.filter(b => b.id && !deletedIds.has(b.id));
  });
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [designs, setDesigns] = useState<Design[]>([]);

  // Estados de carga y error
  const [loading, setLoading] = useState<boolean>(true);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Estados para modal de fórmulas (Crear/Editar)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPantone, setEditingPantone] = useState<PantoneColor | null>(null);

  // Estados para modal de detalle (Visualización)
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  // Control de menú de navegación móvil (drawer)
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);

  // Parámetros iniciales para la calculadora (desde Órdenes de Trabajo)
  const [initialOrderParams, setInitialOrderParams] = useState<{
    grams: number;
    lineType: 'pigmento' | 'reactivo';
    productType: 'Toallas' | 'Otros';
    productRef: string;
    pieces: number;
    workOrderId: string;
    designId?: string;
  } | null>(null);

  // Prompt pre-rellenado para el chat con IA
  const [aiInitialPrompt, setAiInitialPrompt] = useState<string>('');

  // Cargar datos al montar el componente
  useEffect(() => {
    // Escuchar estado de autenticación de Firebase
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUser({
          name: user.email || 'Usuario',
          role: 'Usuario de Taller',
          initials: (user.email || 'US').substring(0, 2).toUpperCase()
        });
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
      setAuthLoading(false);
    });

    async function loadAllData() {
      setLoading(true);
      setErrorMsg('');
      try {
        // 1. Sembrar base de datos si está vacía
        await seedDatabaseIfEmpty();

        // Sincronización automática de inventario (Reporte Excel 7-Oct-2026)
        // Actualiza cantidades existentes, añade nuevos y pone en 0 los que no están
        const syncKey = 'inventorySync_2026_10_07_v1';
        if (localStorage.getItem(syncKey) !== 'true') {
          console.log('Sincronizando inventario con el reporte Excel del 7 de Octubre de 2026...');
          await syncInventoryWithExcel(inventoryData);
          localStorage.setItem(syncKey, 'true');
        }

        // Carga rápida inicial
        let initialPColors = await getPantoneColors(10);
        setPantones(initialPColors);
        
        let sItems = await getStockItems();
        const bLogs = await getBatchLogs();
        const tMembers = await getTeamMembers();
        const wOrders = await getWorkOrders();
        const fetchedDesigns = await getDesigns();

        setStock(sItems);
        setBatches(bLogs);
        setTeam(tMembers);
        setWorkOrders(wOrders);
        setDesigns(fetchedDesigns);
        
        // Auto-sincronizar órdenes de trabajo existentes con la producción diaria y mensual
        if (wOrders && wOrders.length > 0) {
          syncWorkOrdersToProductionRecords(wOrders, fetchedDesigns);
        }
        
        if (initialPColors.length > 0) {
          setSelectedPantone(initialPColors[0]);
        }
        
        setLoading(false);

        // Carga secundaria en segundo plano
        setTimeout(async () => {
          try {
            // One-time import pantones
            let pColors = await getPantoneColors();
            if (localStorage.getItem('pantonesImportedV2') !== 'true' && pColors.length < 100) {
              localStorage.setItem('pantonesImportedV2', 'true');
              
              // Background import in batches of 50 to not block the UI
              (async () => {
                const chunks = [];
                for (let i = 0; i < pantonesData.length; i += 50) {
                  chunks.push(pantonesData.slice(i, i + 50));
                }
                
                for (const chunk of chunks) {
                  await Promise.all(chunk.map(async p => {
                    if (!p.code || p.code.trim().length === 0 || p.code === ',' || p.code.includes('     ')) return;
                    // Avoid duplicates if already partially imported
                    if (pColors.some(existing => existing.code === p.code)) return;
                    
                    await addPantoneColor(p as any).catch(e => console.error(e));
                  }));
                  // Wait 1 second between batches
                  await new Promise(r => setTimeout(r, 1000));
                }
              })();
            }
            
            // sItems refetch inside background worker needed for color update script below
            let bgStock = await getStockItems();

        // Color update script
        if (localStorage.getItem('inventoryColorsUpdatedV1') !== 'true') {
          for (const item of bgStock) {
            let hex = item.hexColor || '#cccccc';
            const nameLower = item.name.toLowerCase();
            
            if (nameLower.includes('amarillo') || nameLower.includes('yellow')) hex = '#eab308';
            else if (nameLower.includes('naranja') || nameLower.includes('orange')) hex = '#f97316';
            else if (nameLower.includes('rojo') || nameLower.includes('red')) hex = '#ef4444';
            else if (nameLower.includes('fucsia') || nameLower.includes('fuchsia') || nameLower.includes('magenta')) hex = '#d946ef';
            else if (nameLower.includes('azul') || nameLower.includes('blue') || nameLower.includes('turquesa')) hex = '#3b82f6';
            else if (nameLower.includes('verde') || nameLower.includes('green')) hex = '#22c55e';
            else if (nameLower.includes('negro') || nameLower.includes('black')) hex = '#1e293b';
            else if (nameLower.includes('blanco') || nameLower.includes('white')) hex = '#f8fafc';
            else if (nameLower.includes('gris') || nameLower.includes('grey') || nameLower.includes('gray')) hex = '#94a3b8';
            else if (nameLower.includes('marron') || nameLower.includes('brown') || nameLower.includes('cafe')) hex = '#78350f';
            else if (nameLower.includes('violeta') || nameLower.includes('morado') || nameLower.includes('purple')) hex = '#8b5cf6';
            
            if (hex !== item.hexColor && item.id) {
              await updateStockItem(item.id, { hexColor: hex });
            }
          }
          localStorage.setItem('inventoryColorsUpdatedV1', 'true');
          // re-fetch after update
          bgStock = await getStockItems();
          setStock(bgStock);
        }

        // Update ALL newly mapped pantone colors from pantonesData
        if (localStorage.getItem('pantonesHexFixV8') !== 'true') {
          let pantonesUpdated = false;
          // Build a quick map from the local json file
          const hexMap = new Map<string, string>();
          pantonesData.forEach(p => {
            if (p.hex && p.hex !== '#999999') {
              hexMap.set(p.code, p.hex);
            }
          });
          
          // Manual overrides requested by user
          const manualOverrides: Record<string, string> = {
            '7590C': '#A34A30',
            '7591C': '#92402E',
            '7603 C': '#4F3629',
            '7603C': '#4F3629',
            '7613C': '#A78B71',
            '7621C': '#AB2328',
            '7624C': '#8B3A3A',
            '7629C': '#91282C',
            '7661C': '#614B66',
            '7663C': '#605268',
            '7678C': '#41538C',
            '7517C': '#9E4714',
            '7527C': '#D6CEBE',
            '7543C': '#92A0A0',
            '7544C': '#89969F',
            '7546C': '#273B4A',
            '7548C': '#FFC72C',
            '7567C': '#7C5035',
            '7581C': '#84695D',
            '7585C': '#8C5A3C',
            '7588 C': '#6E3924',
            '7588C': '#6E3924',
            '3566C': '#8CC63F',
            '3572c': '#006233',
            '3572C': '#006233',
            '3581C': '#00A3A6',
            '3588C': '#00828A',
            '358C': '#A3E798',
            '3590C': '#00A859',
            '3597C': '#4CAE48',
            '360C': '#6CC24A',
            '361C': '#1EB980',
            '362C': '#509E2E',
            '3500C': '#3D5A45',
            '3501C': '#2E4A38',
            '3522C': '#00A389',
            '3529C': '#00B0CA',
            '3534C': '#007A33',
            '3537C': '#488258',
            '354 C': '#00B140',
            '354C': '#00B140',
            '3543C': '#006837',
            '3545C': '#2E7D32',
            '3546C': '#1B5E20',
            '2304': '#C5D4AD',
            '2306C': '#8A9A86',
            '230C': '#FF9BE6',
            '232C': '#F347D8',
            '233 C': '#CE00A6',
            '233C': '#CE00A6',
            '2344C': '#92A0A0',
            '2365C': '#F7C2E7',
            '2389C': '#00A389',
            '2398C': '#00828A',
            '2404C': '#00B2A9',
            '2188C': '#00A3A6',
            '2194 C': '#007298',
            '2194C': '#007298',
            '219C': '#DA1884',
            '2200C': '#00A8B5',
            '2202C': '#00828A',
            '2225C': '#60C5D8',
            '224C': '#FF66C4',
            '225C': '#E4007C',
            '226C': '#D7006D',
            '2303C': '#94A738',
            '2101C': '#3E4059',
            '210C': '#FF72CD',
            '2113 C': '#8C828A',
            '2113C': '#8C828A',
            '211C': '#FF5CBA',
            '212C': '#F63B9B',
            '2132C': '#435260',
            '213C': '#E3007B',
            '2142': '#60697B',
            '2149C': '#546371',
            '214C': '#CE0058',
            '204C': '#E875C6',
            '205C': '#E03C93',
            '2064C': '#5A6B7C',
            '2068C': '#4A5868',
            '2074C': '#3B4856',
            '2087C': '#605268',
            '2095C': '#524558',
            '2096C': '#433748',
            '2099C': '#382E3D',
            '2100C': '#2F2633',
            '1995C': '#D82255',
            '2001C': '#FF9E1B',
            '2002C': '#F2A900',
            '2003C': '#E09B00',
            '2010C': '#E35205',
            '2011C': '#DA291C',
            '201C': '#9D2235',
            '2023C': '#D00027',
            '2036C': '#C8102E',
            '2045C': '#C71585',
            '177C': '#FF828D',
            '1795C': '#EC1C24',
            '1795C.': '#95989A',
            '1797C': '#E01A22',
            '179C': '#FC3D21',
            '18 - 1664 TPX': '#95989A',
            '18-0537TPX': '#95989A',
            '18-1447': '#C45D3E',
            '18-2929TPX': '#95989A',
            '18-4252TPX': '#95989A',
            '16-1364TPX': '#FAB85A',
            '16-1435TPX': '#A95C42',
            '16-1439TPX': '#C27E4B',
            '16-1539TPX': '#EA6B66',
            '16-2126TPX': '#D95383',
            '16-3919TCX': '#7988A1',
            '16-4203TPX': '#B3BCC4',
            '16-4404TCX': '#B0C4DE',
            '16-4529TPX': '#00A3C7',
            '16-4535 TPX': '#00A3C7'
          };
          for (const [code, hex] of Object.entries(manualOverrides)) {
            hexMap.set(code, hex);
          }
          
          for (const p of pColors) {
            // Update if currently has no color or default gray
            if (!p.hex || p.hex === '#999999' || p.hex === '#cccccc') {
              const properHex = hexMap.get(p.code);
              if (properHex && p.id) {
                await updatePantoneColor(p.id, { hex: properHex });
                pantonesUpdated = true;
              }
            }
          }
          localStorage.setItem('pantonesHexFixV8', 'true');
          
          if (localStorage.getItem('pantonesHexFixV9') !== 'true') {
             for (const local of pantonesData) {
               const foundDoc = pColors.find(p => p.code === local.code);
               if (foundDoc && foundDoc.id) {
                 if (foundDoc.type !== local.type) {
                   await updatePantoneColor(foundDoc.id, { type: local.type as 'Reactivo' | 'Pigmento' });
                   pantonesUpdated = true;
                 }
               }
             }
             localStorage.setItem('pantonesHexFixV9', 'true');
          }

          if (pantonesUpdated) {
            pColors = await getPantoneColors();
          }
        }
        const bLogs = await getBatchLogs();
        const tMembers = await getTeamMembers();
        const wOrders = await getWorkOrders();
        const fetchedDesigns = await getDesigns();

        // Actualización de especificaciones técnicas para toallas de pigmento:
        // Medida: 35 x 60 cm, Gramaje: 310 gr., técnica: pigmento, 5 piezas por golpe, 63g/unidad
        if (localStorage.getItem('toallasSpecFixV4') !== 'true') {
          const names35x60 = [
            'FRUTAS ANDU', 'FRUTAS ANDU VIEJAS', 'GRANJA ANDU', 'GRANJAS ANDU',
            'NAVIDAD ANDU', 'NAVIDAD LINEA', 'QE FRUTAS', 'QE UTENCILIOS',
            'QE UTENSILIO', 'QEFRUTAS', 'VACAS ANDU'
          ];
          for (const d of fetchedDesigns) {
            const isTarget = names35x60.includes(d.name?.toUpperCase().trim()) || 
              (d.productType === 'Toallas' && (d.widthCm === 35 || d.lineType === 'pigmento') && (d.heightCm === 60 || !d.heightCm));

            if (isTarget) {
              if (d.id) {
                await updateDesign(d.id, {
                  widthCm: 35,
                  heightCm: 60,
                  gramaje: 310,
                  unitWeight: 63,
                  piezasPorGolpe: 5,
                  areaPorToalla: 0.21,
                  areaTotal: 1.05,
                  lineType: 'pigmento'
                });
              }
            }
          }
          localStorage.setItem('toallasSpecFixV4', 'true');
        }

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
          bgStock = await getStockItems();
          setStock(bgStock);
        }

        setPantones(pColors);

        } catch (bgError) {
          console.error("Error in background fetch:", bgError);
        }
      }, 500);

      } catch (err: any) {
        console.error('Error cargando datos de Firestore:', err);
        setErrorMsg('Error al conectar con la base de datos segura. Por favor, recarga la pestaña.');
        setLoading(false);
      }
    }
    
    if (isAuthenticated) {
      loadAllData();
    }
    
    return () => unsubscribe();
  }, [isAuthenticated]);

  // Sincronización en tiempo real (TV en sala, Tablets, Móviles y PCs)
  useEffect(() => {
    if (!isAuthenticated) return;

    // 1. Suscripción en vivo a Órdenes de Trabajo (Firestore onSnapshot)
    const unsubOrders = subscribeToWorkOrders((liveOrders) => {
      setWorkOrders(liveOrders);
      // Auto-sincronizar con reportes de producción
      if (liveOrders.length > 0) {
        syncWorkOrdersToProductionRecords(liveOrders, designs);
      }
    });

    // 2. Suscripción en vivo a Historial de Mezclas y Lotes
    const unsubBatches = subscribeToBatches((liveBatches) => {
      setBatches(liveBatches);
    });

    // 3. Suscripción en vivo a Stock de Insumos
    const unsubStock = subscribeToStock((liveStock) => {
      setStock(liveStock);
    });

    // 4. Suscripción en vivo a Diseños
    const unsubDesigns = subscribeToDesigns((liveDesigns) => {
      setDesigns(liveDesigns);
    });

    // 5. Heartbeat automático cada 8 segundos (ideal para pantallas TV sin recarga manual)
    const tvHeartbeat = setInterval(async () => {
      try {
        const freshOrders = await getWorkOrders();
        setWorkOrders(freshOrders);
        if (freshOrders.length > 0) {
          syncWorkOrdersToProductionRecords(freshOrders, designs);
        }
      } catch (e) {
        // Silencioso en caso de micro-cortes
      }
    }, 8000);

    // 6. Al reanudar pestaña o visibilidad
    const handleVisibility = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const freshOrders = await getWorkOrders();
          setWorkOrders(freshOrders);
          if (freshOrders.length > 0) {
            syncWorkOrdersToProductionRecords(freshOrders, designs);
          }
        } catch (e) {}
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', handleVisibility);

    return () => {
      unsubOrders();
      unsubBatches();
      unsubStock();
      unsubDesigns();
      clearInterval(tvHeartbeat);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', handleVisibility);
    };
  }, [isAuthenticated, designs]);

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

  const refreshWorkOrders = async () => {
    const wOrders = await getWorkOrders();
    setWorkOrders(wOrders);
  };

  const refreshDesigns = async () => {
    const d = await getDesigns();
    setDesigns(d);
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
          if (activeTab === 'pantones') {
            setIsDetailModalOpen(true);
          }
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

  const handleDeleteTeamMember = async (id: string) => {
    try {
      await deleteTeamMember(id);
      await refreshTeam();
    } catch (err) {
      console.error('Error al eliminar miembro de equipo:', err);
    }
  };

  const handleDeleteBatch = async (id: string) => {
    try {
      // Actualización optimista inmediata en la UI
      setBatches(prev => prev.filter(b => b.id !== id));
      await deleteBatchLog(id);
      await refreshBatches();
    } catch (err) {
      console.error('Error al eliminar lote:', err);
    }
  };

  const handleDeleteWorkOrder = async (id: string) => {
    try {
      const orderToDelete = workOrders.find(o => o.id === id);
      // Actualización optimista inmediata en la UI
      setWorkOrders(prev => prev.filter(o => o.id !== id));
      await deleteWorkOrder(id);
      await removeProductionRecordForOrder(id);

      // Si la orden finalizada generó registros de lote de consumo asociados, también se limpian para consistencia
      if (orderToDelete) {
        const relatedBatches = batches.filter(b => 
          b.type === 'consumo' && (
            (orderToDelete.productReference && b.productReference === orderToDelete.productReference) ||
            (orderToDelete.designName && b.productReference === orderToDelete.designName) ||
            (orderToDelete.pantoneCode && b.pantoneCode === orderToDelete.pantoneCode)
          )
        );
        for (const b of relatedBatches) {
          if (b.id) {
            setBatches(prev => prev.filter(item => item.id !== b.id));
            await deleteBatchLog(b.id);
          }
        }
        if (relatedBatches.length > 0) {
          await refreshBatches();
        }
      }
      await refreshWorkOrders();
    } catch (err) {
      console.error('Error al eliminar orden de trabajo:', err);
    }
  };

  // Redirigir al chat de IA con pregunta pre-rellenada
  const handleAskAi = (prompt: string) => {
    setAiInitialPrompt(prompt);
    setActiveTab('asistente');
  };

  if (authLoading) {
    return (
      <div className="h-screen w-screen bg-slate-50 flex flex-col items-center justify-center font-sans">
        <Loader2 className="w-10 h-10 text-blue-600 animate-spin mb-4" />
        <p className="text-sm font-bold text-slate-500">Verificando sesión...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Login 
        onLogin={() => {
          // Ya no es necesario setear el estado aquí porque onAuthStateChanged lo hará automáticamente
        }} 
      />
    );
  }

  return (
    <div className="h-screen w-screen bg-slate-50 flex font-sans overflow-hidden text-slate-800" id="main-app-container">
      
      {/* Barra de Navegación Lateral (Desktop y Drawer Móvil) */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={(tab) => {
          setActiveTab(tab as any);
          if (tab !== activeTab) {
            setSelectedPantone(null);
          }
        }} 
        currentUser={currentUser} 
        onLogout={() => signOut(auth)}
        isOpenMobile={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
      />

      {/* Área Principal de Contenido */}
      <main className="flex-1 flex flex-col h-full min-w-0 overflow-hidden relative">
        
        {/* Cabecera / Header Superior Adaptable */}
        <header className="h-16 md:h-20 bg-white border-b border-slate-200 px-3 sm:px-6 md:px-8 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Logo en Móvil */}
            <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center bg-blue-900 shadow-sm md:hidden shrink-0 border border-blue-800">
              <img src={logoUrl} alt="CONTEX" className="w-full h-full object-cover" />
            </div>

            <div className="min-w-0">
              <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 truncate">
                <Palette className="w-5 h-5 md:w-6 h-6 text-blue-600 shrink-0 hidden sm:inline-block" />
                <span className="truncate">
                  {activeTab === 'pantones' && 'Catalogo de Pantone'}
                  {activeTab === 'disenos' && 'Diseños'}
                  {activeTab === 'tareas' && 'Tareas Diarias'}
                  {activeTab === 'calculadora' && 'Calculadora de Mezclas'}
                  {activeTab === 'historial' && 'Graficos e Historial'}
                  {activeTab === 'asistente' && 'Consultor Técnico (IA)'}
                  {activeTab === 'stock' && 'Gestión de Stock'}
                  {activeTab === 'equipo' && 'Equipo de Taller'}
                  {activeTab === 'analizador' && 'Analizador de Imágenes (IA)'}
                </span>
              </h1>
              <p className="text-[11px] sm:text-xs md:text-sm text-slate-400 font-medium italic mt-0.5 truncate hidden sm:block">
                Sistema Integrado de Gestión de Laboratorio de Color e Inventario de Insumos Textiles
              </p>
            </div>
          </div>
        </header>

        {/* Workspace de Trabajo */}
        <div className="flex-1 p-3 sm:p-6 md:p-8 pb-20 md:pb-8 overflow-hidden min-h-0 bg-slate-50/50">
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
              {/* Tab Catálogo Pantone (Vista de Cuadrícula) */}
              {activeTab === 'pantones' && (
                <div className="h-full w-full min-h-0">
                  <PantoneGrid 
                    pantones={pantones}
                    onSelectPantone={(p) => {
                      setSelectedPantone(p);
                      setIsDetailModalOpen(true);
                    }}
                    onDeletePantone={handleDeletePantone}
                  />
                </div>
              )}

              {/* Tab Diseños Multi-Color */}
              {activeTab === 'disenos' && (
                <div className="h-full w-full min-h-0">
                  <DesignManager pantones={pantones} onRefreshDesigns={refreshDesigns} />
                </div>
              )}

              {/* Tab Calculadora directa y Edición */}
              {activeTab === 'calculadora' && (
                <div className="h-full w-full min-h-0">
                  <CalculatorWorkspace 
                    pantones={pantones}
                    designs={designs}
                    pantone={selectedPantone}
                    onSelectPantone={setSelectedPantone}
                    team={team}
                    initialOrderParams={initialOrderParams}
                    onClearInitialOrderParams={() => setInitialOrderParams(null)}
                    onAddBatch={async (batch) => {
                      const success = await handleAddBatch(batch);
                      if (success && initialOrderParams?.workOrderId) {
                        const order = workOrders.find(o => o.id === initialOrderParams.workOrderId);
                        if (order) {
                          if (order.designId) {
                            const newCompletedColors = [...(order.completedColors || []), batch.pantoneCode];
                            const design = designs.find(d => d.id === order.designId);
                            if (design && newCompletedColors.length >= design.colors.length) {
                              await updateWorkOrder(order.id!, { completedColors: newCompletedColors, status: 'Completada', completedAt: new Date() });
                            } else {
                              await updateWorkOrder(order.id!, { completedColors: newCompletedColors });
                            }
                          } else {
                            await updateWorkOrder(order.id!, { status: 'Completada', completedAt: new Date() });
                          }
                          await refreshWorkOrders();
                        }
                      }
                      return success;
                    }}
                    onDeletePantone={handleDeletePantone}
                    onEditPantone={(p) => {
                      setEditingPantone(p);
                      setIsModalOpen(true);
                    }}
                    onOpenCreateModal={() => {
                      setEditingPantone(null);
                      setIsModalOpen(true);
                    }}
                  />
                </div>
              )}

              {/* Tab Historial de Lotes */}
              {activeTab === 'historial' && (
                <BatchLogList 
                  batches={batches} 
                  workOrders={workOrders} 
                  pantones={pantones} 
                  team={team} 
                  stock={stock} 
                  designs={designs}
                  onDeleteBatch={handleDeleteBatch} 
                  onDeleteWorkOrder={handleDeleteWorkOrder}
                />
              )}

              {/* Tab Stock de Tintas */}
              {activeTab === 'stock' && (
                <StockManager 
                  stock={stock}
                  currentUser={currentUser}
                  onUpdateStock={handleUpdateStockQty}
                  onUpdateStockItem={handleUpdateStockItem}
                  onDeleteStockItem={handleDeleteStockItem}
                  onAddStockItem={handleAddStockItem}
                  onAddBatch={handleAddBatch}
                  onRefreshStock={async () => {
                    const fresh = await getStockItems();
                    setStock(fresh);
                  }}
                />
              )}

              {/* Tab Consultor AI */}
              {activeTab === 'asistente' && (
                <AiAssistant 
                  initialPrompt={aiInitialPrompt}
                  onClearInitialPrompt={() => setAiInitialPrompt('')}
                />
              )}

              {/* Tab Tareas de Hoy */}
              {activeTab === 'tareas' && (
                <WorkOrderManager 
                  workOrders={workOrders}
                  team={team}
                  pantones={pantones}
                  designs={designs}
                  stock={stock}
                  batches={batches}
                  onAddOrder={async (order) => {
                    const success = await addWorkOrder(order);
                    if (success) {
                      await refreshWorkOrders();
                      const updated = await getWorkOrders();
                      await syncWorkOrdersToProductionRecords(updated, designs);
                    }
                    return success;
                  }}
                  onUpdateOrder={async (id, updates) => {
                    const success = await updateWorkOrder(id, updates);
                    if (success) {
                      await refreshWorkOrders();
                      const updated = await getWorkOrders();
                      await syncWorkOrdersToProductionRecords(updated, designs);
                    }
                    return success;
                  }}
                  onDeleteOrder={handleDeleteWorkOrder}
                  onCompleteOrder={async (id, batch) => {
                    const successBatch = await addBatchLog(batch);
                    if (successBatch) {
                      await updateWorkOrder(id, { status: 'Completada', completedAt: new Date() });
                      await refreshWorkOrders();
                      await refreshBatches();
                      await refreshStock();
                      const updated = await getWorkOrders();
                      await syncWorkOrdersToProductionRecords(updated, designs);
                      return true;
                    }
                    return false;
                  }}
                  onRecordBatch={async (batch) => {
                    const success = await addBatchLog(batch);
                    if (success) {
                      await refreshBatches();
                      await refreshStock();
                      return true;
                    }
                    return false;
                  }}
                  onExecuteOrder={(pantone, orderGrams, orderLine, orderProduct, orderRef, targetPieces, orderId, design) => {
                    if (pantone) {
                      setSelectedPantone(pantone);
                    }
                    setInitialOrderParams({
                      grams: orderGrams,
                      lineType: orderLine as 'pigmento' | 'reactivo',
                      productType: orderProduct as 'Toallas' | 'Otros',
                      productRef: orderRef,
                      pieces: targetPieces,
                      workOrderId: orderId,
                      designId: design?.id
                    });
                    setActiveTab('calculadora');
                  }}
                />
              )}

              {/* Tab Analizador de Imagen */}
              {activeTab === 'analizador' && (
                <ImageAnalyzer 
                  pantones={pantones}
                  onSaveAsDesign={async (newDesign) => {
                    const success = await addDesign(newDesign);
                    if (success) {
                      const updatedDesigns = await getDesigns();
                      setDesigns(updatedDesigns);
                      setActiveTab('disenos');
                    }
                  }}
                />
              )}
            </>
          )}
        </div>

        {/* ── BARRA DE NAVEGACIÓN INFERIOR (Solo visible en dispositivos móviles) ── */}
        <nav 
          className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900/95 backdrop-blur-md border-t border-slate-800/90 flex items-center justify-around py-1.5 px-2 md:hidden shadow-2xl select-none"
          aria-label="Navegación móvil rápida"
        >
          <button
            onClick={() => { setActiveTab('historial'); setSelectedPantone(null); }}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'historial' 
                ? 'text-blue-400 font-extrabold scale-105' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <History className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Dashboard</span>
          </button>

          <button
            onClick={() => { setActiveTab('tareas'); setSelectedPantone(null); }}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'tareas' 
                ? 'text-blue-400 font-extrabold scale-105' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ClipboardList className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Tareas</span>
          </button>

          <button
            onClick={() => { setActiveTab('pantones'); setSelectedPantone(null); }}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'pantones' 
                ? 'text-blue-400 font-extrabold scale-105' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Paintbrush className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Catálogo</span>
          </button>

          <button
            onClick={() => { setActiveTab('calculadora'); setSelectedPantone(null); }}
            className={`flex flex-col items-center py-1 px-2.5 rounded-xl transition-all cursor-pointer ${
              activeTab === 'calculadora' 
                ? 'text-blue-400 font-extrabold scale-105' 
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Scale className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Calculadora</span>
          </button>

          <button
            onClick={() => setIsMobileNavOpen(true)}
            className="flex flex-col items-center py-1 px-2.5 rounded-xl text-slate-400 hover:text-white transition-all cursor-pointer"
          >
            <Menu className="w-5 h-5 mb-0.5" />
            <span className="text-[10px] tracking-tight">Menú</span>
          </button>
        </nav>
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

      {/* Modal para Ver Detalle de Fórmula (Solo Lectura o Edición si se usa desde Calculadora, pero aquí está enfocado al catálogo) */}
      <FormulaModal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
      >
        <FormulaDetail 
          pantone={selectedPantone}
          team={team}
          onAddBatch={handleAddBatch}
          onDeletePantone={(id) => {
            handleDeletePantone(id);
            setIsDetailModalOpen(false);
          }}
          onEditPantone={(p) => {
            setIsDetailModalOpen(false);
            setEditingPantone(p);
            setIsModalOpen(true);
          }}
          onAskAi={handleAskAi}
          readonly={false}
        />
      </FormulaModal>

    </div>
  );
}
