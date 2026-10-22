import { useState, useEffect, useMemo, useRef } from 'react';
import {
  ClipboardList, Plus, Search, Filter, AlertCircle, AlertTriangle, Clock,
  CheckCircle, PlayCircle, Trash2, Edit2, Calendar, Maximize, Minimize, X,
  Layers, Eye, Kanban, LayoutGrid
} from 'lucide-react';
import WorkOrderKanbanBoard from './WorkOrderKanbanBoard';
import { WorkOrder, PantoneColor, TeamMember, BatchLog, Design, StockItem } from '../types';
import { findMatchingStockItem, findMatchingPantone, findPastaMadreStockItem, syncWorkOrdersToProductionRecords } from '../lib/dataService';

interface WorkOrderManagerProps {
  workOrders: WorkOrder[];
  team: TeamMember[];
  pantones: PantoneColor[];
  designs: Design[];
  stock: StockItem[];
  batches?: BatchLog[];
  onAddOrder: (order: WorkOrder) => Promise<boolean>;
  onUpdateOrder: (id: string, updates: Partial<WorkOrder>) => Promise<boolean>;
  onDeleteOrder: (id: string) => Promise<void>;
  onCompleteOrder: (id: string, batch: BatchLog) => Promise<boolean>;
  onExecuteOrder: (pantone: PantoneColor | null, grams: number, lineType: string, productType: string, productRef: string, targetPieces: number, orderId: string, design?: Design) => void;
  onRecordBatch?: (batch: BatchLog) => Promise<boolean>;
}

// Utilidades de fecha local (YYYY-MM-DD) para evitar desfases de zona horaria
function formatLocalDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTomorrowLocalDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return formatLocalDate(d);
}

export default function WorkOrderManager({
  workOrders,
  team,
  pantones,
  designs = [],
  stock = [],
  batches = [],
  onAddOrder,
  onUpdateOrder,
  onDeleteOrder,
  onCompleteOrder,
  onExecuteOrder,
  onRecordBatch
}: WorkOrderManagerProps) {
  const [showForm, setShowForm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'Pendiente' | 'Preparando Tintas' | 'Tintas Listas' | 'Estampándose' | 'Completada'>('all');
  const [selectedOrderForModal, setSelectedOrderForModal] = useState<WorkOrder | null>(null);
  const [customKilos, setCustomKilos] = useState<Record<number, string>>({});
  const [preparedHistory, setPreparedHistory] = useState<Record<string, number[]>>({});

  // ── Vista activa: Tablero Kanban (5 columnas) o Cuadrícula Clásica ──
  const [viewMode, setViewMode] = useState<'kanban' | 'grid'>(() => {
    try {
      const saved = localStorage.getItem('wo_view_mode');
      return saved === 'grid' ? 'grid' : 'kanban';
    } catch {
      return 'kanban';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('wo_view_mode', viewMode);
    } catch (e) {
      console.warn('No se pudo guardar wo_view_mode en localStorage', e);
    }
  }, [viewMode]);



  // Referencias al estado más reciente de la orden/historial y cola de guardado.
  // Evitan que preparaciones consecutivas lean una copia vieja y se pisen entre sí (progreso 2/3).
  const orderRef = useRef<WorkOrder | null>(null);
  const historyRef = useRef<Record<string, number[]> | null>(null);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  useEffect(() => {
    if (!selectedOrderForModal) {
      orderRef.current = null;
      historyRef.current = null;
    }
  }, [selectedOrderForModal]);
  const [confirmBatch, setConfirmBatch] = useState<{
    idx: number;
    pantoneInfo: PantoneColor;
    kg: number;
    colorCode: string;
    isStockWarning?: boolean;
    missingDetails?: string;
  } | null>(null);
  const [confirmFinishOrder, setConfirmFinishOrder] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [errorAlert, setErrorAlert] = useState<string | null>(null);

  const [designId, setDesignId] = useState('');
  const [productType, setProductType] = useState<'Toallas' | 'Otros'>('Toallas');
  const [productRef, setProductRef] = useState('');
  const [lineType, setLineType] = useState<'pigmento' | 'reactivo'>('pigmento');
  const [targetPieces, setTargetPieces] = useState(100);
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<'Normal' | 'Urgente'>('Normal');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fecha actual y de mañana con actualización automática periódica (para TVs y pantallas 24/7)
  const [currentDateStr, setCurrentDateStr] = useState(() => formatLocalDate());
  useEffect(() => {
    const timer = setInterval(() => {
      const now = formatLocalDate();
      if (now !== currentDateStr) {
        setCurrentDateStr(now);
      }
    }, 30000);
    return () => clearInterval(timer);
  }, [currentDateStr]);

  const todayStr = currentDateStr;
  const tomorrowStr = useMemo(() => getTomorrowLocalDate(), [currentDateStr]);

  // Fecha para programar la orden (por defecto hoy)
  const [scheduledDate, setScheduledDate] = useState(() => formatLocalDate());

  // Filtro de fecha para la lista de órdenes (Predeterminado SIEMPRE las del día actual)
  const [dateFilterMode, setDateFilterMode] = useState<'today' | 'tomorrow' | 'all' | 'custom'>('today');
  const [customFilterDate, setCustomFilterDate] = useState(() => formatLocalDate());

  const getOrderDate = (order: WorkOrder): string => {
    if (order.orderDate) return order.orderDate;
    const raw = order.completedAt || order.createdAt;
    if (typeof raw === 'string') return raw.slice(0, 10);
    if (raw instanceof Date) return formatLocalDate(raw);
    if (raw?.toDate) return formatLocalDate(raw.toDate());
    if (raw?.seconds) return formatLocalDate(new Date(raw.seconds * 1000));
    return todayStr;
  };

  // Manejo de la tecla Escape (Esc) para cerrar modales y cancelar acciones
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (confirmBatch) {
          setConfirmBatch(null);
        } else if (errorAlert) {
          setErrorAlert(null);
        } else if (confirmFinishOrder) {
          setConfirmFinishOrder(false);
        } else if (orderToDelete) {
          setOrderToDelete(null);
        } else if (selectedOrderForModal) {
          setSelectedOrderForModal(null);
        } else if (showForm) {
          setShowForm(false);
        } else if (isFullscreen) {
          setIsFullscreen(false);
        }
      }
    };

    const hasModalOpen = !!(confirmBatch || errorAlert || confirmFinishOrder || orderToDelete || selectedOrderForModal);
    if (hasModalOpen) {
      document.body.style.overflow = 'hidden';
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      if (hasModalOpen) {
        document.body.style.overflow = 'auto';
      }
    };
  }, [confirmBatch, errorAlert, confirmFinishOrder, orderToDelete, selectedOrderForModal, showForm, isFullscreen]);

  const handleRegisterConsumptions = async (order: WorkOrder, history: Record<string, number[]>) => {
    if (!onRecordBatch) return;
    let piecesRegistered = false;
    for (const [pantoneCode, kgArray] of Object.entries(history)) {
      const totalGrams = kgArray.reduce((a, b) => a + b, 0) * 1000;
      if (totalGrams > 0) {
        const pantoneInfo = findMatchingPantone(pantones, pantoneCode);
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        const batchData: BatchLog = {
          id_mezcla: `LOTE-${datePart}-${randomSuffix}`,
          orden_id: order.id || '',
          workOrderId: order.id || '',
          color_codigo: pantoneCode,
          pantoneCode: pantoneCode,
          pantoneHex: pantoneInfo?.hex || '#ccc',
          productType: order.productType,
          productReference: order.productReference || order.designName || '',
          quantity: piecesRegistered ? 0 : order.targetQuantity,
          totalGrammage: totalGrams,
          operator: 'Usuario Sistema',
          type: 'consumo',
          status: 'Completado',
          estado: 'consumido',
          lineType: order.lineType || 'pigmento',
          timestamp: now,
          fecha_hora_registro: now
        };
        piecesRegistered = true;
        await onRecordBatch(batchData);
      }
    }
  };

  // ── CÁLCULO DINÁMICO EN CONSULTA (Mezclas asociadas a la orden) ──
  // SELECT COUNT(DISTINCT color_codigo) FROM mezclas WHERE orden_id = 'A123' AND estado = 'completado'
  const getDynamicOrderProgress = (order: WorkOrder) => {
    const design = designs.find(d =>
      (order.designId && d.id === order.designId) ||
      (order.designName && d.name?.toUpperCase().trim() === order.designName?.toUpperCase().trim())
    );
    const totalColors = design ? design.colors.length : 1;

    // 1. Filtrar mezclas registradas para esta orden con estado completado
    const matchingBatches = (batches || []).filter(b => {
      const bOrderId = b.orden_id || b.workOrderId;
      const matchesOrder = (order.id && bOrderId === order.id) ||
        (order.id && b.productReference && b.productReference.includes(order.id)) ||
        (order.designName && b.productReference && b.productReference.toLowerCase().trim() === order.designName.toLowerCase().trim());

      const isCompleted = b.estado === 'completado' || b.status === 'Completado' || b.status === 'completado';
      return matchesOrder && isCompleted && b.type !== 'consumo';
    });

    // 2. Tonos preparados únicos (DISTINCT color_codigo)
    const distinctPreparedColors = new Set<string>();
    matchingBatches.forEach(b => {
      const code = b.color_codigo || b.pantoneCode;
      if (code) distinctPreparedColors.add(code.trim().toUpperCase());
    });

    // 3. Unificar con completedColors que la orden ya tuviese
    (order.completedColors || []).forEach(c => {
      if (c) distinctPreparedColors.add(c.trim().toUpperCase());
    });

    const framesCount = order.completedFrames?.length || 0;
    const completedCount = Math.min(totalColors, Math.max(distinctPreparedColors.size, framesCount, matchingBatches.length));
    const isFullyCompleted = totalColors > 0 && completedCount >= totalColors;

    return {
      completedCount,
      totalColors,
      isFullyCompleted,
      distinctPreparedColors: Array.from(distinctPreparedColors)
    };
  };

  // ── ESTADO EFECTIVO DE LA ORDEN SEGÚN EL FLUJO INDUSTRIAL ──
  // Pendiente → Preparando Tintas → Tintas Listas → Estampándose → Completada
  const getOrderEffectiveStatus = (
    order: WorkOrder,
    prog: { completedCount: number; totalColors: number; isFullyCompleted: boolean }
  ): 'Pendiente' | 'Preparando Tintas' | 'Tintas Listas' | 'Estampándose' | 'Completada' => {
    // 1. Si el usuario ya finalizó el estampado
    if (order.status === 'Completada') return 'Completada';

    // 2. Si la orden está en máquina estampándose
    if (order.status === 'Estampándose') return 'Estampándose';

    // 3. Si todas las tintas están preparadas pero no se ha iniciado el estampado
    if (prog.isFullyCompleted || order.status === 'Tintas Listas') return 'Tintas Listas';

    // 4. Si se ha preparado al menos 1 color de los requeridos
    if (prog.completedCount > 0 || order.status === 'Preparando Tintas' || order.status === 'En Progreso') return 'Preparando Tintas';

    // 5. Sin preparar
    return 'Pendiente';
  };

  const handleStartStamping = async (order: WorkOrder) => {
    if (!order.id) return;
    try {
      await onUpdateOrder(order.id, { status: 'Estampándose' });
      if (selectedOrderForModal?.id === order.id) {
        setSelectedOrderForModal(prev => prev ? { ...prev, status: 'Estampándose' } : null);
      }
    } catch (err: any) {
      setErrorAlert('Error al iniciar estampado: ' + (err?.message || err));
    }
  };

  const handleFinishStamping = async (order: WorkOrder) => {
    if (!order.id) return;
    try {
      if (order.preparedHistory) {
        await handleRegisterConsumptions(order, order.preparedHistory);
      }
      await onUpdateOrder(order.id, { status: 'Completada', completedAt: new Date() });
      if (selectedOrderForModal?.id === order.id) {
        setSelectedOrderForModal(prev => prev ? { ...prev, status: 'Completada', completedAt: new Date() } : null);
      }
    } catch (err: any) {
      setErrorAlert('Error al finalizar estampado: ' + (err?.message || err));
    }
  };

  const handleOpenOrderModal = (order: WorkOrder) => {
    const initialHistory: Record<string, number[]> = { ...(order.preparedHistory || {}) };
    (batches || [])
      .filter(b => (b.orden_id === order.id || b.workOrderId === order.id) && b.type !== 'consumo')
      .forEach(b => {
        const code = b.color_codigo || b.pantoneCode;
        if (code && !initialHistory[code]) {
          const kgVal = (b.totalGrammage || 0) / 1000;
          if (kgVal > 0) initialHistory[code] = [kgVal];
        }
      });

    if (order.designId) {
      const design = designs.find(d => d.id === order.designId);
      if (design) {
        orderRef.current = order;
        historyRef.current = initialHistory;
        setSelectedOrderForModal(order);
        setCustomKilos({});
        setPreparedHistory(initialHistory);
      } else {
        alert('No se encuentra el Diseño en la biblioteca.');
      }
    } else {
      const pantone = order.pantoneCode ? findMatchingPantone(pantones, order.pantoneCode) : undefined;
      if (pantone) {
        orderRef.current = order;
        historyRef.current = initialHistory;
        setSelectedOrderForModal(order);
        setCustomKilos({});
        setPreparedHistory(initialHistory);
      } else {
        alert('No se encuentra el Pantone en la biblioteca.');
      }
    }
  };

  // Lista de órdenes filtradas por estado y por fecha (por defecto SIEMPRE HOY)
  const pendingOrders = useMemo(() => {
    return workOrders.filter(order => {
      const prog = getDynamicOrderProgress(order);
      const effectiveStatus = getOrderEffectiveStatus(order, prog);

      // 1. Filtro por estado
      if (filterStatus !== 'all' && effectiveStatus !== filterStatus) return false;

      // 2. Filtro por fecha (Predeterminado SIEMPRE HOY)
      const orderDate = getOrderDate(order);
      if (dateFilterMode === 'today') {
        return orderDate === todayStr;
      } else if (dateFilterMode === 'tomorrow') {
        return orderDate === tomorrowStr;
      } else if (dateFilterMode === 'custom') {
        return orderDate === customFilterDate;
      }
      return true; // 'all'
    });
  }, [workOrders, filterStatus, dateFilterMode, customFilterDate, todayStr, tomorrowStr, batches]);

  // Lista de órdenes filtradas únicamente por fecha (para poblar las 5 columnas del Kanban)
  const dateFilteredOrders = useMemo(() => {
    return workOrders.filter(order => {
      const orderDate = getOrderDate(order);
      if (dateFilterMode === 'today') {
        return orderDate === todayStr;
      } else if (dateFilterMode === 'tomorrow') {
        return orderDate === tomorrowStr;
      } else if (dateFilterMode === 'custom') {
        return orderDate === customFilterDate;
      }
      return true; // 'all'
    });
  }, [workOrders, dateFilterMode, customFilterDate, todayStr, tomorrowStr]);

  // Manejador de avance arrastrable en el tablero Kanban
  const handleKanbanUpdateStatus = async (orderId: string, newStatus: WorkOrder['status']) => {
    try {
      const updates: Partial<WorkOrder> = { status: newStatus };
      if (newStatus === 'Completada') {
        updates.completedAt = new Date();
      }
      await onUpdateOrder(orderId, updates);
    } catch (err: any) {
      setErrorAlert('Error al actualizar estado en tablero: ' + (err?.message || err));
    }
  };





  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    let newOrder: Partial<WorkOrder> = {
      productType: productType,
      productReference: productRef,
      targetQuantity: targetPieces,
      priority: priority,
      status: 'Pendiente',
      orderDate: scheduledDate,
      createdAt: new Date(scheduledDate + 'T08:00:00')
    };

    if (assignedTo) {
      newOrder.assignedTo = assignedTo;
    }

    const design = designs.find(d => d.id === designId);
    if (!design) {
      alert("Selecciona un Diseño");
      setIsSubmitting(false);
      return;
    }
    newOrder = {
      ...newOrder,
      designId: design.id,
      designName: design.name,
      lineType: design.lineType,
      targetGrammage: 0, // Set to 0 since grams are per piece per color inside the design
      completedColors: []
    };

    const success = await onAddOrder(newOrder as WorkOrder);
    if (success) {
      setShowForm(false);
      // Reset form
      setDesignId('');
      setProductRef('');
      setTargetPieces(100);
      setAssignedTo('');
      setScheduledDate(todayStr);
    }
    setIsSubmitting(false);
  };

  return (
    <div className={`flex flex-col h-full gap-3 sm:gap-6 w-full transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50 bg-slate-50 p-3 sm:p-8 overflow-y-auto' : 'max-w-7xl mx-auto'}`}>

      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight flex items-center gap-2 truncate">
            <ClipboardList className="w-6 h-6 sm:w-7 sm:h-7 text-blue-600 shrink-0" />
            <span className="truncate">Órdenes de Trabajo</span>
            <span className="hidden sm:inline text-slate-400 font-normal">y Mezcla</span>
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5 truncate">
            Gestión y preparación de fórmulas de color para producción
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Indicador de sincronización en vivo para TV y dispositivos */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-emerald-50 border border-emerald-200/80 rounded-xl text-emerald-700 text-xs font-bold shadow-2xs select-none"
            title="Sincronización en vivo activa: Los cambios desde PC o Tablet se reflejan inmediatamente en este TV"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="hidden sm:inline">En Vivo · TV</span>
            <span className="inline sm:hidden text-[10px]">Vivo</span>
          </div>

          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="flex items-center justify-center bg-white text-slate-600 p-2 sm:p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm cursor-pointer"
            title={isFullscreen ? "Salir de pantalla completa" : "Modo TV / Pantalla Completa"}
          >
            {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
          </button>
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-1.5 sm:gap-2 bg-slate-900 text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-slate-800 transition-colors shadow-sm cursor-pointer"
          >
            {showForm ? (
              <span className="flex items-center gap-1.5"><X className="w-4 h-4" /> Cancelar</span>
            ) : (
              <span className="flex items-center gap-1.5"><Plus className="w-4 h-4" /> <span>Nueva Orden</span></span>
            )}
          </button>
        </div>
      </div>

      {/* Formulario de Supervisor */}
      {showForm && (
        <div className="bg-white rounded-2xl sm:rounded-3xl border border-blue-100 shadow-sm p-4 sm:p-6 shrink-0 animate-fade-in ring-1 ring-blue-500/20">
          <div className="flex items-center justify-between mb-3 sm:mb-4">
            <h3 className="text-sm sm:text-base font-bold text-slate-800 flex items-center gap-2">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" /> Crear Nueva Orden de Trabajo
            </h3>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreate} className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 sm:gap-4">

              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Diseño / Referencia</label>
                <select
                  value={designId}
                  onChange={e => {
                    setDesignId(e.target.value);
                    const selectedDesign = designs.find(d => d.id === e.target.value);
                    if (selectedDesign) {
                      setProductType(selectedDesign.productType as 'Toallas' | 'Otros');
                      setLineType(selectedDesign.lineType);
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                  required
                >
                  <option value="">Seleccionar Diseño...</option>
                  {designs.map(d => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>

              {/* Selector de Fecha Programada */}
              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 text-blue-600" />
                    Fecha Programada
                  </span>
                  <span className="text-[10px] font-bold text-blue-600">
                    {scheduledDate === todayStr ? '📅 Hoy' : scheduledDate === tomorrowStr ? '🚀 Mañana' : scheduledDate}
                  </span>
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="date"
                    value={scheduledDate}
                    onChange={e => setScheduledDate(e.target.value)}
                    className="flex-1 min-w-0 bg-slate-50 border border-slate-200 rounded-xl p-2 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                    required
                  />
                  <div className="flex gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setScheduledDate(todayStr)}
                      className={`px-2 sm:px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${scheduledDate === todayStr
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      title="Programar para hoy"
                    >
                      Hoy
                    </button>
                    <button
                      type="button"
                      onClick={() => setScheduledDate(tomorrowStr)}
                      className={`px-2 sm:px-2.5 py-1 text-xs font-bold rounded-xl border transition-all cursor-pointer ${scheduledDate === tomorrowStr
                          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                          : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      title="Programar para mañana"
                    >
                      Mañana
                    </button>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Prioridad</label>
                <select
                  value={priority}
                  onChange={e => setPriority(e.target.value as 'Normal' | 'Urgente')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Normal">Normal</option>
                  <option value="Urgente">Urgente</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Producto</label>
                <select
                  value={productType}
                  onChange={e => setProductType(e.target.value as 'Toallas' | 'Otros')}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none"
                >
                  <option value="Toallas">Toallas</option>
                  <option value="Otros">Otros</option>
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-2">
                <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Unidades a estampar</label>
                <div className="relative">
                  <input
                    type="number"
                    value={targetPieces}
                    onChange={e => setTargetPieces(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs sm:text-sm font-semibold focus:ring-2 focus:ring-blue-500 outline-none pr-24"
                    min="1" required
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[11px] font-mono font-bold text-slate-400">
                    ≈ {(() => {
                      const selDesign = designs.find(d => d.id === designId);
                      const isReactivo = (lineType || selDesign?.lineType)?.toLowerCase() === 'reactivo';
                      const isPigmentoToalla = productType === 'Toallas' && !isReactivo;
                      const pzGolpe = isPigmentoToalla ? 5 : (selDesign?.piezasPorGolpe || (productType === 'Toallas' ? 3 : 1));
                      return Math.ceil(targetPieces / pzGolpe);
                    })()} golpes
                  </span>
                </div>
              </div>

            </div>

            <div className="flex justify-end pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto bg-blue-600 text-white px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors shadow-sm disabled:opacity-50 cursor-pointer text-center"
              >
                {isSubmitting ? 'Guardando...' : 'Guardar y Asignar'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Kanban / Lista */}
      <div className="bg-slate-200/50 rounded-2xl sm:rounded-3xl p-3 sm:p-5 md:p-6 flex-1 flex flex-col min-h-0 overflow-hidden">

        {/* Filtros de Fecha, Estado, Modo de Vista y Escáner */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 mb-3 sm:mb-5 shrink-0 bg-white p-2 sm:p-2.5 rounded-2xl border border-slate-200 shadow-sm">

          {/* Bloque Izquierdo: Fechas y Estados */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Bloque: Filtro por Fecha (PREDETERMINADO: SIEMPRE HOY) */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1 md:pb-0">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1.5 flex items-center gap-1 shrink-0">
                <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" /> Fecha:
              </span>
              <button
                type="button"
                onClick={() => setDateFilterMode('today')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${dateFilterMode === 'today'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <span>Hoy</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${dateFilterMode === 'today' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {workOrders.filter(o => getOrderDate(o) === todayStr).length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('tomorrow')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 whitespace-nowrap ${dateFilterMode === 'tomorrow'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                <span>Mañana</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-mono ${dateFilterMode === 'tomorrow' ? 'bg-blue-700 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {workOrders.filter(o => getOrderDate(o) === tomorrowStr).length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setDateFilterMode('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-extrabold transition-all cursor-pointer shrink-0 whitespace-nowrap ${dateFilterMode === 'all'
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
              >
                Todas las fechas
              </button>

              {dateFilterMode === 'custom' && (
                <input
                  type="date"
                  value={customFilterDate}
                  onChange={e => setCustomFilterDate(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1 text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 shrink-0"
                />
              )}
              {dateFilterMode !== 'custom' && (
                <button
                  type="button"
                  onClick={() => setDateFilterMode('custom')}
                  className="text-[11px] font-bold text-slate-500 hover:text-blue-600 px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer shrink-0 whitespace-nowrap"
                  title="Elegir otra fecha específica"
                >
                  Otro día...
                </button>
              )}
            </div>

            {/* Bloque: Filtro por Estado */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl overflow-x-auto no-scrollbar shrink-0">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filterStatus === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                Todas
              </button>
              <button
                onClick={() => setFilterStatus('Pendiente')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filterStatus === 'Pendiente' ? 'bg-amber-500 text-white shadow-sm' : 'text-slate-600 hover:text-amber-700'}`}
              >
                Pendientes
              </button>
              <button
                onClick={() => setFilterStatus('Preparando Tintas')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filterStatus === 'Preparando Tintas' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-sky-700'}`}
              >
                Preparando Tintas
              </button>
              <button
                onClick={() => setFilterStatus('Tintas Listas')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filterStatus === 'Tintas Listas' ? 'bg-purple-600 text-white shadow-sm' : 'text-slate-600 hover:text-purple-700'}`}
              >
                Tintas Listas
              </button>
              <button
                onClick={() => setFilterStatus('Estampándose')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filterStatus === 'Estampándose' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-600 hover:text-indigo-700'}`}
              >
                En Máquina
              </button>
              <button
                onClick={() => setFilterStatus('Completada')}
                className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 whitespace-nowrap ${filterStatus === 'Completada' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-600 hover:text-emerald-700'}`}
              >
                Completadas
              </button>
            </div>
          </div>

          {/* Bloque Derecho: Selector de Vista (Kanban / Cuadrícula) */}
          <div className="flex items-center gap-2 ml-auto shrink-0">

            {/* Selector de Vista: Kanban vs Cuadrícula */}
            <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ver en Tablero Kanban con avance arrastrable"
              >
                <Kanban className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Tablero</span>
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-blue-700 shadow-2xs font-black'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Ver en Cuadrícula clásica"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Lista</span>
              </button>
            </div>
          </div>
        </div>

        {/* Vista: Tablero Kanban (5 columnas) o Cuadrícula Clásica */}
        {viewMode === 'kanban' ? (
          <WorkOrderKanbanBoard
            orders={filterStatus === 'all' ? dateFilteredOrders : pendingOrders}
            designs={designs}
            pantones={pantones}
            batches={batches}
            todayStr={todayStr}
            tomorrowStr={tomorrowStr}
            getOrderDate={getOrderDate}
            getDynamicOrderProgress={getDynamicOrderProgress}
            getOrderEffectiveStatus={getOrderEffectiveStatus}
            onUpdateStatus={handleKanbanUpdateStatus}
            onOpenOrderModal={handleOpenOrderModal}
            onDeleteOrder={(orderId) => setOrderToDelete(orderId)}
          />
        ) : (
          /* Grid de Tarjetas */
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 sm:pr-2">
          {pendingOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-slate-400 bg-white/70 rounded-2xl border border-dashed border-slate-300 text-center">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center mb-3">
                <Calendar className="w-6 h-6 sm:w-7 sm:h-7 text-blue-500" />
              </div>
              <p className="font-bold text-sm sm:text-base text-slate-800">
                No hay órdenes para {dateFilterMode === 'today' ? 'el día de hoy' : dateFilterMode === 'tomorrow' ? 'el día de mañana' : 'la fecha seleccionada'}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                {dateFilterMode === 'today' ? 'Puedes programar una nueva orden haciendo clic en "+ Nueva Orden"' : 'Cambia a "Hoy" o "Todas las fechas" para ver más órdenes'}
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                <button
                  onClick={() => setShowForm(true)}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" /> Nueva Orden
                </button>
                {dateFilterMode !== 'today' && (
                  <button
                    onClick={() => setDateFilterMode('today')}
                    className="text-xs font-bold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-slate-200 px-3 py-2 rounded-xl transition-colors cursor-pointer"
                  >
                    Ver órdenes de Hoy
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {pendingOrders.map(order => (
                <div key={order.id} className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm hover:shadow-md transition-shadow group flex flex-col">

                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      {order.designId ? (
                        <>
                          <div className="w-5 h-5 rounded-md border border-slate-200 shadow-sm shrink-0 flex items-center justify-center bg-purple-100 text-purple-600 font-bold text-[10px]">
                            D

                          </div>
                          <span className="font-black text-lg text-slate-800">{order.designName}</span>
                        </>
                      ) : (
                        <>
                          <div className="w-5 h-5 rounded-md border border-slate-200 shadow-sm shrink-0" style={{ backgroundColor: order.pantoneHex }} />
                          <span className="font-black text-lg text-slate-800">{order.pantoneCode}</span>
                        </>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {order.priority === 'Urgente' && (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1">
                          <AlertCircle className="w-3 h-3" /> URGENTE
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setOrderToDelete(order.id);
                        }}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Eliminar Orden"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Detalle */}
                  <div className="space-y-2 mb-4 flex-1">
                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                      <span className="text-slate-500 font-semibold flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-blue-500" /> Fecha:
                      </span>
                      <span className={`font-bold px-2 py-0.5 rounded-md text-[11px] ${getOrderDate(order) === todayStr
                          ? 'bg-blue-100 text-blue-800'
                          : getOrderDate(order) === tomorrowStr
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-slate-200 text-slate-700'
                        }`}>
                        {(() => {
                          const oDate = getOrderDate(order);
                          if (oDate === todayStr) return 'Hoy (' + oDate + ')';
                          if (oDate === tomorrowStr) return 'Mañana (' + oDate + ')';
                          return oDate;
                        })()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                      <span className="text-slate-500 font-semibold">Producto:</span>
                      <span className="font-bold text-slate-800">
                        {order.productType}
                        {(() => {
                          const d = designs.find(item =>
                            (order.designId && item.id === order.designId) ||
                            (order.designName && item.name?.toUpperCase().trim() === order.designName?.toUpperCase().trim())
                          );
                          const isReactivo = (order.lineType || d?.lineType)?.toLowerCase() === 'reactivo';
                          const isPigmentoToalla = order.productType === 'Toallas' && !isReactivo;
                          const w = isPigmentoToalla ? 35 : (d?.widthCm || 60);
                          const h = isPigmentoToalla ? 60 : (d?.heightCm || 120);
                          return <span className="text-[10px] text-slate-500 font-medium ml-1">({w}×{h} cm)</span>;
                        })()}
                      </span>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                      <span className="text-slate-500 font-semibold">Técnica:</span>
                      <span className="font-bold text-xs text-slate-700 capitalize">
                        {(() => {
                          const d = designs.find(item =>
                            (order.designId && item.id === order.designId) ||
                            (order.designName && item.name?.toUpperCase().trim() === order.designName?.toUpperCase().trim())
                          );
                          const isReactivo = (order.lineType || d?.lineType)?.toLowerCase() === 'reactivo';
                          return isReactivo ? 'Estampado Reactivo' : 'Estampado En Pigmento';
                        })()}
                      </span>
                    </div>

                    {order.designId ? (() => {
                      const prog = getDynamicOrderProgress(order);
                      return (
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                          <span className="text-slate-500 font-semibold">Tintas Requeridas:</span>
                          <span className={`font-mono font-bold ${prog.isFullyCompleted ? 'text-purple-700' : 'text-blue-700'}`}>
                            {prog.completedCount} / {prog.totalColors} Colores
                            {prog.isFullyCompleted && (
                              <span className="ml-1 text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded-full font-sans font-bold">✓ Tintas Listas</span>
                            )}
                          </span>
                        </div>
                      );
                    })() : (
                      <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                        <span className="text-slate-500 font-semibold">Objetivo:</span>
                        <span className="font-mono font-bold text-blue-700">{order.targetGrammage}g</span>
                      </div>
                    )}

                    <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                      <span className="text-slate-500 font-semibold">Golpes:</span>
                      <span className="font-mono font-bold text-slate-700">
                        {(() => {
                          const d = designs.find(item =>
                            (order.designId && item.id === order.designId) ||
                            (order.designName && item.name?.toUpperCase().trim() === order.designName?.toUpperCase().trim())
                          );
                          const isReactivo = (order.lineType || d?.lineType)?.toLowerCase() === 'reactivo';
                          const isPigmentoToalla = order.productType === 'Toallas' && !isReactivo;
                          // Para toallas estampadas en pigmento (35x60 cm), la relación es estrictamente 5 unidades por golpe
                          const pzGolpe = isPigmentoToalla ? 5 : (d?.piezasPorGolpe || (order.productType === 'Toallas' ? 3 : 1));
                          const golpes = Math.ceil(order.targetQuantity / pzGolpe);
                          return (
                            <>
                              <span className="text-blue-700 font-black">{golpes}</span>
                              <span className="text-[10px] text-slate-400 font-normal ml-1">
                                ({order.targetQuantity} unds · {pzGolpe} u/golpe)
                              </span>
                            </>
                          );
                        })()}
                      </span>
                    </div>

                    {order.designId && (() => {
                      const d = designs.find(item =>
                        (order.designId && item.id === order.designId) ||
                        (order.designName && item.name?.toUpperCase().trim() === order.designName?.toUpperCase().trim())
                      );
                      const isReactivo = (order.lineType || d?.lineType)?.toLowerCase() === 'reactivo';
                      const isPigmentoToalla = order.productType === 'Toallas' && !isReactivo;
                      const unitWeight = isPigmentoToalla ? 63 : (d?.unitWeight || 63);
                      const gramaje = isPigmentoToalla ? 310 : (d?.gramaje || 280);
                      return (
                        <div className="flex justify-between items-center bg-slate-50 p-2 rounded-lg text-xs">
                          <span className="text-slate-500 font-semibold">Peso Unidad:</span>
                          <span className="font-mono font-bold text-slate-700">
                            {unitWeight}g / pz
                            <span className="text-[10px] text-slate-400 font-normal ml-1">({gramaje}g/m²)</span>
                          </span>
                        </div>
                      );
                    })()}
                  </div>

                  {/* Estado y Acciones según el Flujo Industrial */}
                  {(() => {
                    const prog = getDynamicOrderProgress(order);
                    const effectiveStatus = getOrderEffectiveStatus(order, prog);

                    return (
                      <div className="mt-auto border-t border-slate-100 pt-3 flex flex-wrap items-center justify-between gap-2">
                        {/* Insignia del Estado Actual */}
                        {effectiveStatus === 'Pendiente' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            Pendiente
                          </span>
                        )}
                        {effectiveStatus === 'Preparando Tintas' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-sky-50 text-sky-700 border border-sky-200">
                            Preparando Tintas
                          </span>
                        )}
                        {effectiveStatus === 'Tintas Listas' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200">
                            Tintas Listas
                          </span>
                        )}
                        {effectiveStatus === 'Estampándose' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse" />
                            Estampándose
                          </span>
                        )}
                        {effectiveStatus === 'Completada' && (
                          <span className="text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            Completada
                          </span>
                        )}

                        {/* Botones de Acción */}
                        <div className="flex items-center gap-1.5 ml-auto">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setOrderToDelete(order.id);
                            }}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar Orden"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>

                          {effectiveStatus === 'Pendiente' && (
                            <button
                              onClick={() => handleOpenOrderModal(order)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Preparar Tintas</span>
                            </button>
                          )}

                          {effectiveStatus === 'Preparando Tintas' && (
                            <button
                              onClick={() => handleOpenOrderModal(order)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 shadow-sm bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
                            >
                              <PlayCircle className="w-3.5 h-3.5" />
                              <span>Continuar Preparación</span>
                            </button>
                          )}

                          {effectiveStatus === 'Tintas Listas' && (
                            <>
                              <button
                                onClick={() => handleOpenOrderModal(order)}
                                className="p-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Ver fórmulas de las tintas"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleStartStamping(order)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm bg-purple-600 hover:bg-purple-700 text-white cursor-pointer"
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Iniciar Estampado</span>
                              </button>
                            </>
                          )}

                          {effectiveStatus === 'Estampándose' && (
                            <>
                              <button
                                onClick={() => handleOpenOrderModal(order)}
                                className="p-1.5 rounded-lg text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                                title="Ver fórmulas de las tintas"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleFinishStamping(order)}
                                className="px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                                <span>Finalizar Estampado</span>
                              </button>
                            </>
                          )}

                          {effectiveStatus === 'Completada' && (
                            <button
                              onClick={() => handleOpenOrderModal(order)}
                              className="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200 cursor-pointer"
                            >
                              <CheckCircle className="w-3.5 h-3.5" />
                              <span>Ver Detalles</span>
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </div>
              ))}
            </div>
          )}
        </div>
        )}
      </div>

      {/* Modal de Colores del Diseño */}
      {selectedOrderForModal && selectedOrderForModal.designId && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[60] flex items-center justify-center p-2 sm:p-4"
          onClick={() => setSelectedOrderForModal(null)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-4xl max-h-[92vh] sm:max-h-full overflow-hidden border border-slate-200 flex flex-col animate-fade-in"
            onClick={e => e.stopPropagation()}
          >
            {(() => {
              const design = designs.find(d => d.id === selectedOrderForModal.designId);
              if (!design) return null;
              const modalProg = getDynamicOrderProgress(selectedOrderForModal);
              const modalEffectiveStatus = getOrderEffectiveStatus(selectedOrderForModal, modalProg);

              return (
                <>
                  <div className="p-4 sm:p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50">
                    <div className="min-w-0 flex-1 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-lg sm:text-xl font-black text-slate-800 flex items-center gap-2 truncate">
                          <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-600 flex items-center justify-center text-xs shrink-0">D</div>
                          <span className="truncate">{design.name}</span>
                        </h2>

                        {modalEffectiveStatus === 'Pendiente' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                            Pendiente
                          </span>
                        )}
                        {modalEffectiveStatus === 'Preparando Tintas' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                            Preparando Tintas ({modalProg.completedCount}/{modalProg.totalColors})
                          </span>
                        )}
                        {modalEffectiveStatus === 'Tintas Listas' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-purple-50 text-purple-700 border border-purple-200">
                            ✓ Tintas Listas
                          </span>
                        )}
                        {modalEffectiveStatus === 'Estampándose' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-indigo-600 animate-pulse"></span>
                            Estampándose
                          </span>
                        )}
                        {modalEffectiveStatus === 'Completada' && (
                          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ✓ Completada
                          </span>
                        )}
                      </div>
                      <p className="text-xs sm:text-sm text-slate-500 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span>Orden #{selectedOrderForModal.id?.slice(-4)}</span>
                        <span>•</span>
                        <span className="font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5" />
                          {(() => {
                            const oDate = getOrderDate(selectedOrderForModal);
                            if (oDate === todayStr) return `Hoy (${oDate})`;
                            if (oDate === tomorrowStr) return `Mañana (${oDate})`;
                            return oDate;
                          })()}
                        </span>
                        <span>•</span>
                        <span>{design.colors.length} Colores</span>
                        <span>• Peso: {(() => {
                          const isPigmentoToalla = selectedOrderForModal.productType === 'Toallas' && (selectedOrderForModal.lineType || design.lineType) !== 'reactivo';
                          const w = isPigmentoToalla ? 35 : (design.widthCm || 60);
                          const h = isPigmentoToalla ? 60 : (design.heightCm || 120);
                          const gramaje = isPigmentoToalla ? 310 : (design.gramaje || 280);
                          const areaM2 = (w / 100) * (h / 100);
                          return Math.round(areaM2 * gramaje * 10) / 10;
                        })()}g / pz</span>
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          const id = selectedOrderForModal.id;
                          setSelectedOrderForModal(null);
                          setOrderToDelete(id);
                        }}
                        className="px-2.5 py-1.5 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                        title="Eliminar esta Orden de Trabajo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Eliminar</span>
                      </button>
                      <button
                        onClick={() => setSelectedOrderForModal(null)}
                        className="p-2 hover:bg-slate-200 rounded-full transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
                        title="Cerrar (Esc)"
                      >
                        <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-md">Esc</span>
                        <X className="w-5 h-5 text-slate-500" />
                      </button>
                    </div>
                  </div>

                  <div className="p-3 sm:p-6 overflow-y-auto flex-1 custom-scrollbar">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {design.colors.map((color, idx) => {
                        const pantoneInfo = findMatchingPantone(pantones, color.pantoneCode);
                        const requiredGrams = color.gramsPerPiece * selectedOrderForModal.targetQuantity;
                        const effectiveGrams = customKilos[idx] ? parseFloat(customKilos[idx]) * 1000 : requiredGrams;
                        const targetKilos = effectiveGrams / 1000;
                        const pastaStockItem = findPastaMadreStockItem(stock, selectedOrderForModal.lineType || pantoneInfo?.type?.toLowerCase());

                        // Verificar stock de la fórmula
                        let hasEnoughStock = true;
                        let missingComponent = '';
                        let missingDetails = '';
                        if (pantoneInfo && pantoneInfo.formulas) {
                          for (const c of pantoneInfo.formulas) {
                            const needed = targetKilos * c.percentage;
                            const stockItem = findMatchingStockItem(stock, c.component);
                            if (!stockItem) {
                              hasEnoughStock = false;
                              missingComponent = c.component;
                              missingDetails = `(No se encontró "${c.component}" en el inventario)`;
                              break;
                            } else if (stockItem.quantity < needed) {
                              hasEnoughStock = false;
                              missingComponent = c.component;
                              missingDetails = `(Se requieren ${needed.toFixed(1)} g y hay ${(stockItem.quantity).toFixed(1)} g en stock)`;
                              break;
                            }
                          }
                        }

                        return (
                          <div key={idx} className={`bg-white border border-slate-200 rounded-xl sm:rounded-2xl p-3 sm:p-4 flex flex-col hover:shadow-md transition-shadow relative gap-3`}>
                            {!pantoneInfo && (
                              <div className="absolute -top-2 -right-2 bg-slate-800 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> Pantone no existe
                              </div>
                            )}

                            <div className="flex flex-col gap-3">
                              {/* Fila superior: Color, Detalles, Botón */}
                              <div className="flex gap-3 sm:gap-4 items-center">
                                <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl shadow-inner border border-black/10 shrink-0 overflow-hidden bg-slate-50 flex flex-col items-center justify-center relative" style={{ backgroundColor: pantoneInfo?.hex }}>
                                  {!pantoneInfo && (
                                    <span className="text-[10px] font-bold text-slate-400">N/A</span>
                                  )}
                                </div>
                                <div className="flex-1 min-w-0 flex flex-col justify-center">
                                  <p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase mb-0.5">Marco {idx + 1}</p>
                                  <h4 className="font-black text-slate-800 text-base sm:text-lg leading-tight truncate">{color.pantoneCode}</h4>
                                  <p className="text-xs text-slate-500 truncate">{pantoneInfo?.name || 'Pantone Desconocido'}</p>
                                </div>
                                <div className="flex items-center gap-1.5 justify-center shrink-0">
                                  <button
                                    className="bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white px-3 sm:px-4 py-2 sm:py-2.5 rounded-xl text-xs font-bold transition-colors w-full cursor-pointer"
                                    onClick={async () => {
                                      const kgToPrepare = parseFloat(customKilos[idx] || '0');
                                      if (kgToPrepare <= 0) {
                                        setErrorAlert('Ingresa una cantidad mayor a 0 para preparar.');
                                        return;
                                      }
                                      if (!pantoneInfo) {
                                        setErrorAlert('Pantone no encontrado en la base de datos.');
                                        return;
                                      }

                                      setConfirmBatch({
                                        idx,
                                        pantoneInfo,
                                        kg: kgToPrepare,
                                        colorCode: color.pantoneCode,
                                        isStockWarning: !hasEnoughStock,
                                        missingDetails: missingComponent ? `${missingComponent} ${missingDetails}` : ''
                                      });
                                    }}
                                  >
                                    Preparar
                                  </button>
                                </div>
                              </div>

                              {/* Fila inferior: Inputs */}
                              <div className="flex items-center gap-2 sm:gap-3">
                                <div className="flex-1 bg-blue-50/50 rounded-xl p-2.5 sm:p-3 border-2 border-blue-200 hover:border-blue-400 focus-within:border-blue-500 focus-within:ring-4 focus-within:ring-blue-500/10 transition-all flex flex-col justify-center group cursor-text" onClick={(e) => {
                                  const input = e.currentTarget.querySelector('input');
                                  if (input) input.focus();
                                }}>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-black text-blue-600 uppercase">A preparar</span>
                                    <Edit2 className="w-3.5 h-3.5 text-blue-400 group-focus-within:text-blue-600" />
                                  </div>
                                  <div className="flex items-end gap-1.5">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      placeholder="0"
                                      value={customKilos[idx] ?? ''}
                                      onChange={(e) => setCustomKilos(prev => ({ ...prev, [idx]: e.target.value }))}
                                      className="font-mono font-black text-blue-700 bg-transparent outline-none w-full placeholder-blue-300 text-lg sm:text-xl p-0 h-6"
                                    />
                                    <span className="text-[11px] font-bold text-blue-400 pb-1">Kg</span>
                                  </div>
                                </div>
                                {preparedHistory[color.pantoneCode] && preparedHistory[color.pantoneCode].length > 0 && (
                                  <div className="flex-1 bg-emerald-50/50 rounded-xl p-2.5 sm:p-3 border-2 border-emerald-200 flex flex-col justify-center">
                                    <span className="text-[10px] font-black text-emerald-600 uppercase mb-1">Total Preparado</span>
                                    <div className="flex items-end gap-1.5">
                                      <span className="font-mono font-black text-emerald-700 text-lg sm:text-xl leading-none">
                                        {preparedHistory[color.pantoneCode].reduce((a, b) => a + b, 0).toFixed(2)}
                                      </span>
                                      <span className="text-[11px] font-bold text-emerald-500 pb-0.5">Kg</span>
                                    </div>
                                    <div className="text-[9px] font-semibold text-emerald-500/80 mt-1 truncate">
                                      ({preparedHistory[color.pantoneCode].join(' + ')} Kg)
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Desglose de pasta y tintas */}
                            {pantoneInfo && (
                              <div className="bg-slate-50 rounded-xl p-2.5 sm:p-3 mt-1 border border-slate-100">
                                <div className="flex items-center justify-between mb-2 pb-1 border-b border-slate-200">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase">Fórmula Requerida</p>
                                  <div className="flex gap-2 sm:gap-3 text-[9px] font-bold text-slate-400 uppercase">
                                    <span className="w-10 sm:w-12 text-right">g/Kg</span>
                                    <span className="w-14 sm:w-16 text-right text-blue-500">TOTAL</span>
                                  </div>
                                </div>
                                <div className="space-y-1.5">
                                  {/* Fila Base: Pasta Madre (Preparada) */}
                                  <div className="flex items-center justify-between text-xs py-1.5 px-2 -mx-1 rounded-lg bg-blue-50/70 border border-blue-200/70 mb-2">
                                    <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                                      <div className={`w-2 h-2 rounded-full shrink-0 ${pastaStockItem && pastaStockItem.quantity >= (targetKilos * 1000) ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                                      <span className="truncate font-black text-blue-900 text-[11px] sm:text-xs">
                                        Pasta Madre (Preparada)
                                      </span>
                                      {pastaStockItem ? (
                                        <span className="text-[9px] sm:text-[10px] text-blue-600/80 font-medium shrink-0">
                                          ({(pastaStockItem.quantity / 1000).toFixed(1)}k)
                                        </span>
                                      ) : (
                                        <span className="text-[9px] sm:text-[10px] text-amber-600 font-medium shrink-0">
                                          (Sin stock)
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex gap-2 sm:gap-3 text-[10px] sm:text-[11px] font-mono shrink-0">
                                      <span className="w-10 sm:w-12 text-right text-blue-500 font-bold">Base</span>
                                      <span className="w-14 sm:w-16 text-right font-black text-blue-800">
                                        {targetKilos > 0 ? `${targetKilos.toFixed(2)} Kg` : '—'}
                                      </span>
                                    </div>
                                  </div>

                                  {/* Componentes de Tintas */}
                                  {pantoneInfo.formulas && pantoneInfo.formulas.map((c, i) => {
                                    const gPerKg = c.percentage;
                                    const customKilosValue = customKilos[idx] ? parseFloat(customKilos[idx]) : 0;
                                    const totalPrepared = preparedHistory[color.pantoneCode] ? preparedHistory[color.pantoneCode].reduce((a, b) => a + b, 0) : 0;
                                    const baseKilos = customKilosValue > 0 ? customKilosValue : totalPrepared;
                                    const actualNeeded = baseKilos * gPerKg;

                                    const stockItem = findMatchingStockItem(stock, c.component);
                                    const isMissing = !stockItem || (actualNeeded > 0 ? stockItem.quantity < actualNeeded : stockItem.quantity <= 0);

                                    return (
                                      <div key={i} className="flex items-center justify-between text-xs hover:bg-slate-100/50 rounded px-1 -mx-1 transition-colors">
                                        <div className="flex items-center gap-1.5 truncate flex-1 min-w-0 pr-1">
                                          <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isMissing ? 'bg-red-500' : 'bg-emerald-500'}`} />
                                          <span className={`truncate text-[11px] sm:text-xs ${isMissing ? 'text-red-700 font-semibold' : 'text-slate-600'}`}>
                                            {c.component}
                                          </span>
                                          {stockItem ? (
                                            <span className="text-[9px] sm:text-[10px] text-slate-400 font-normal shrink-0">
                                              ({(stockItem.quantity / 1000).toFixed(1)}k)
                                            </span>
                                          ) : (
                                            <span className="text-[9px] sm:text-[10px] text-red-500 font-normal shrink-0">
                                              (0)
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex gap-2 sm:gap-3 font-mono text-[10px] sm:text-xs shrink-0">
                                          <span className="w-10 sm:w-12 text-right text-slate-400">{gPerKg.toFixed(1)}g</span>
                                          <span className={`w-14 sm:w-16 text-right font-bold ${isMissing ? 'text-red-700' : 'text-blue-600'}`}>
                                            {actualNeeded.toFixed(1)}g
                                          </span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="p-3.5 sm:p-6 border-t border-slate-100 bg-slate-50 shrink-0 flex flex-col sm:flex-row sm:justify-between items-stretch sm:items-center gap-2.5 sm:gap-3">
                    <div className="text-xs sm:text-sm text-slate-500 font-medium text-center sm:text-left flex items-center justify-center sm:justify-start gap-2">
                      {modalEffectiveStatus === 'Pendiente' && (
                        <span>Prepara las fórmulas de tinta requeridas para comenzar.</span>
                      )}
                      {modalEffectiveStatus === 'Preparando Tintas' && (
                        <span>Avance de tintas: <strong className="text-slate-800">{modalProg.completedCount} de {modalProg.totalColors}</strong> listas.</span>
                      )}
                      {modalEffectiveStatus === 'Tintas Listas' && (
                        <span className="text-purple-700 font-bold flex items-center gap-1.5">
                          <span>✨ Tintas completas. Lista para montar en máquina.</span>
                        </span>
                      )}
                      {modalEffectiveStatus === 'Estampándose' && (
                        <span className="text-indigo-700 font-bold flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-indigo-500 animate-ping"></span>
                          Orden estampándose en máquina actualmente.
                        </span>
                      )}
                      {modalEffectiveStatus === 'Completada' && (
                        <span className="text-emerald-700 font-bold">✓ Orden estampada y finalizada. Consumos registrados.</span>
                      )}
                    </div>
                    <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
                      <button
                        type="button"
                        onClick={() => {
                          const id = selectedOrderForModal.id;
                          setSelectedOrderForModal(null);
                          setOrderToDelete(id);
                        }}
                        className="px-3 sm:px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Eliminar esta orden de trabajo"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>Eliminar</span>
                      </button>
                      <button
                        onClick={() => setSelectedOrderForModal(null)}
                        className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer text-center"
                      >
                        Cerrar
                      </button>

                      {modalEffectiveStatus === 'Tintas Listas' && (
                        <button
                          onClick={async () => {
                            await handleStartStamping(selectedOrderForModal);
                          }}
                          className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-purple-600 hover:bg-purple-700 shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        >
                          <Layers className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">Iniciar Estampado</span>
                        </button>
                      )}

                      {modalEffectiveStatus === 'Estampándose' && (
                        <button
                          onClick={() => setConfirmFinishOrder(true)}
                          className="flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-center"
                        >
                          <CheckCircle className="w-4 h-4 shrink-0" /> <span className="whitespace-nowrap">Finalizar Estampado</span>
                        </button>
                      )}
                    </div>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}

      {/* Custom Error Alert Modal */}
      {errorAlert && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4 animate-fade-in"
          onClick={() => setErrorAlert(null)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-in border border-red-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <AlertCircle className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Atención</h3>
              <p className="text-xs sm:text-sm text-slate-500">{errorAlert}</p>
            </div>
            <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-100 flex justify-center">
              <button
                onClick={() => setErrorAlert(null)}
                className="bg-red-600 text-white rounded-xl px-6 py-2.5 text-xs sm:text-sm font-bold hover:bg-red-700 transition-colors w-full cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Modal */}
      {confirmBatch && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4 animate-fade-in"
          onClick={() => setConfirmBatch(null)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-in border border-blue-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 sm:p-6 text-center">
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl flex items-center justify-center mx-auto mb-2.5 shadow-inner border border-black/10"
                style={{ backgroundColor: confirmBatch.pantoneInfo.hex }}
              />
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1">Confirmar Preparación</h3>
              <p className="text-xs text-slate-500 mb-2.5">
                Se registrará y descontará del inventario:
              </p>

              <div className="bg-slate-50 rounded-xl sm:rounded-2xl p-2.5 sm:p-3 border border-slate-200/80 text-left space-y-2 mb-2.5 text-xs">
                <div className="flex justify-between items-center font-bold text-blue-900 pb-1.5 border-b border-slate-200">
                  <span>Pasta Madre:</span>
                  <span className="font-mono text-sm">{confirmBatch.kg} Kg</span>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">
                    Tintas a descontar ({confirmBatch.colorCode}):
                  </span>
                  <div className="space-y-1">
                    {confirmBatch.pantoneInfo.formulas && confirmBatch.pantoneInfo.formulas.length > 0 ? (
                      confirmBatch.pantoneInfo.formulas.map((f, i) => (
                        <div key={i} className="flex justify-between text-slate-600 font-mono text-[11px]">
                          <span className="truncate pr-2">• {f.component}</span>
                          <span className="font-bold shrink-0">{(confirmBatch.kg * f.percentage).toFixed(2)} g</span>
                        </div>
                      ))
                    ) : (
                      <span className="text-slate-400 italic text-[11px]">Sin fórmula desglosada</span>
                    )}
                  </div>
                </div>
              </div>

              {confirmBatch.isStockWarning && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-2 text-left mb-1 text-xs text-amber-800">
                  <div className="flex items-center gap-1.5 font-bold mb-0.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                    <span>Insumos con existencia baja o en 0</span>
                  </div>
                  <p className="text-[10px] text-amber-700 leading-snug">
                    {confirmBatch.missingDetails}. Al confirmar, el inventario registrará el consumo real.
                  </p>
                </div>
              )}
            </div>
            <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-100 flex gap-2 sm:gap-3">
              <button
                onClick={() => setConfirmBatch(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  const { idx, pantoneInfo, kg, colorCode } = confirmBatch;
                  const renderedOrder = selectedOrderForModal;
                  const renderedHistory = preparedHistory;
                  setConfirmBatch(null);

                  if (!renderedOrder) return;

                  // ── 1. ACTUALIZACIÓN OPTIMISTA INMEDIATA (0 ms) ──
                  // Se actualiza la UI de inmediato para que el operario vea el Total Preparado al instante
                  const colorKey = pantoneInfo.code;
                  const newHistoryRecord = [...(renderedHistory[colorKey] || []), kg];
                  const newPreparedHistory = { ...renderedHistory, [colorKey]: newHistoryRecord };

                  historyRef.current = newPreparedHistory;
                  setPreparedHistory(newPreparedHistory);
                  setCustomKilos(prev => ({ ...prev, [idx]: '' }));

                  const currentCompleted = renderedOrder.completedColors || [];
                  const isNewColor = !currentCompleted.includes(colorKey);
                  const newCompleted = isNewColor ? [...currentCompleted, colorKey] : currentCompleted;
                  const currentFrames = renderedOrder.completedFrames || [];
                  const newFrames = currentFrames.includes(idx) ? currentFrames : [...currentFrames, idx];
                  const completedCount = Math.max(newCompleted.length, newFrames.length);

                  let newStatus: WorkOrder['status'] = renderedOrder.status;
                  let newCompletedAt = renderedOrder.completedAt;

                  if (renderedOrder.status === 'Estampándose') {
                    newStatus = 'Estampándose';
                  } else if (renderedOrder.status === 'Completada') {
                    newStatus = 'Completada';
                  } else if (renderedOrder.designId) {
                    const design = designs.find(d => d.id === renderedOrder.designId);
                    if (design && completedCount >= design.colors.length) {
                      newStatus = 'Tintas Listas';
                    } else if (completedCount > 0) {
                      newStatus = 'Preparando Tintas';
                    }
                  } else {
                    newStatus = 'Tintas Listas';
                  }

                  const optimisticallyUpdatedOrder: WorkOrder = {
                    ...renderedOrder,
                    completedColors: newCompleted,
                    completedFrames: newFrames,
                    preparedHistory: newPreparedHistory,
                    status: newStatus,
                    completedAt: newCompletedAt
                  };

                  orderRef.current = optimisticallyUpdatedOrder;
                  setSelectedOrderForModal(optimisticallyUpdatedOrder);

                  // ── 2. PERSISTENCIA Y SINCRONIZACIÓN ASÍNCRONA EN SEGUNDO PLANO ──
                  saveQueueRef.current = saveQueueRef.current.then(async () => {
                    const now = new Date();
                    const datePart = now.toISOString().slice(0, 10).replace(/-/g, '');
                    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
                    const batchId = `LOTE-${datePart}-${randomSuffix}`;
                    const orderId = renderedOrder.id || '';
                    const chosenColor = colorCode || pantoneInfo.code;

                    const batchData: BatchLog = {
                      id_mezcla: batchId,
                      orden_id: orderId,
                      workOrderId: orderId,
                      color_codigo: chosenColor,
                      pantoneCode: pantoneInfo.code,
                      pantoneHex: pantoneInfo.hex,
                      productType: renderedOrder.productType || 'Otros',
                      productReference: renderedOrder.designName || renderedOrder.productReference || '',
                      quantity: renderedOrder.targetQuantity || 0,
                      totalGrammage: kg * 1000,
                      operator: 'Usuario Sistema',
                      type: 'preparacion',
                      lineType: pantoneInfo.type?.toLowerCase().includes('reactivo') ? 'reactivo' : 'pigmento',
                      status: 'Completado',
                      estado: 'completado',
                      timestamp: now,
                      fecha_hora_registro: now
                    };

                    if (onRecordBatch) {
                      try {
                        await onRecordBatch(batchData);
                      } catch (err: any) {
                        console.error('Error registrando batch:', err);
                      }
                    }

                    if (newStatus === 'Completada' && renderedOrder.status !== 'Completada') {
                      await handleRegisterConsumptions(optimisticallyUpdatedOrder, newPreparedHistory);
                    }

                    if (orderId) {
                      const updatesToSave: Partial<WorkOrder> = {
                        completedColors: newCompleted,
                        completedFrames: newFrames,
                        preparedHistory: newPreparedHistory,
                        status: newStatus,
                      };
                      if (newCompletedAt) {
                        updatesToSave.completedAt = newCompletedAt;
                      }

                      try {
                        const success = await onUpdateOrder(orderId, updatesToSave);
                        if (!success) {
                          console.warn('onUpdateOrder devolvió false, conservando estado en memoria.');
                        }
                      } catch (err: any) {
                        setErrorAlert('Error al sincronizar con la nube: ' + err.message);
                      }
                    }
                  }).catch((err: any) => {
                    setErrorAlert('Error al registrar la preparación: ' + (err?.message || err));
                  });
                }}
                className="flex-1 bg-blue-600 text-white rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Finish Order Modal */}
      {confirmFinishOrder && selectedOrderForModal && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4 animate-fade-in"
          onClick={() => setConfirmFinishOrder(false)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-in border border-emerald-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <CheckCircle className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Finalizar Estampado</h3>
              <p className="text-xs sm:text-sm text-slate-500 mb-2">
                ¿Confirmas que el proceso de estampado ha finalizado? La orden quedará como <span className="font-bold text-emerald-600">Completada</span> y se registrarán los consumos en inventario y producción.
              </p>
              <p className="text-[11px] text-slate-400">
                Esta acción registrará las cantidades oficiales en el reporte diario.
              </p>
            </div>
            <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-100 flex gap-2 sm:gap-3">
              <button
                onClick={() => setConfirmFinishOrder(false)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (selectedOrderForModal.preparedHistory) {
                    await handleRegisterConsumptions(selectedOrderForModal, selectedOrderForModal.preparedHistory);
                  }
                  await onUpdateOrder(selectedOrderForModal.id!, { status: 'Completada', completedAt: new Date() });
                  setConfirmFinishOrder(false);
                  setSelectedOrderForModal(null);
                }}
                className="flex-1 bg-emerald-600 text-white rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold hover:bg-emerald-700 transition-colors cursor-pointer"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Custom Confirm Delete Order Modal */}
      {orderToDelete && (
        <div
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-[70] p-3 sm:p-4 animate-fade-in"
          onClick={() => setOrderToDelete(null)}
        >
          <div
            className="bg-white rounded-2xl sm:rounded-3xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col animate-scale-in border border-red-100"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-5 sm:p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 mb-1.5">Eliminar Orden</h3>
              <p className="text-xs sm:text-sm text-slate-500">
                ¿Seguro que deseas eliminar esta orden? Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="bg-slate-50 p-3 sm:p-4 border-t border-slate-100 flex gap-2 sm:gap-3">
              <button
                onClick={() => setOrderToDelete(null)}
                className="flex-1 bg-white border border-slate-200 text-slate-600 rounded-xl px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-bold hover:bg-slate-50 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await onDeleteOrder(orderToDelete);
                  setOrderToDelete(null);
                }}
                className="flex-1 bg-red-600 text-white rounded-xl px-4 py-2.5 text-sm font-bold hover:bg-red-700 transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}



    </div>
  );
}
