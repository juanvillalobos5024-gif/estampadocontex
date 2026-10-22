import React, { useState } from 'react';
import {
  Clock, PlayCircle, CheckCircle2, Layers, Award, AlertCircle,
  Calendar, User, ArrowRight, ArrowLeft, Eye,
  GripVertical, Sparkles, Check, ChevronRight, Trash2
} from 'lucide-react';
import { WorkOrder, Design, PantoneColor, BatchLog } from '../types';

export type KanbanColumnId = 'Pendiente' | 'Preparando Tintas' | 'Tintas Listas' | 'En Máquina' | 'Completada';

interface KanbanColumnConfig {
  id: KanbanColumnId;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  accentColor: string;
  headerBg: string;
  badgeBg: string;
  badgeText: string;
  dropBorder: string;
}

const KANBAN_COLUMNS: KanbanColumnConfig[] = [
  {
    id: 'Pendiente',
    title: 'Pendiente',
    subtitle: 'Por formular',
    icon: Clock,
    accentColor: '#f59e0b', // amber-500
    headerBg: 'from-amber-500/10 to-amber-500/5 text-amber-900 border-amber-200',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-800',
    dropBorder: 'border-amber-400 bg-amber-50/40 ring-4 ring-amber-500/10'
  },
  {
    id: 'Preparando Tintas',
    title: 'Preparando Tintas',
    subtitle: 'Pesando',
    icon: PlayCircle,
    accentColor: '#0ea5e9', // sky-500
    headerBg: 'from-sky-500/10 to-sky-500/5 text-sky-900 border-sky-200',
    badgeBg: 'bg-sky-100',
    badgeText: 'text-sky-800',
    dropBorder: 'border-sky-400 bg-sky-50/40 ring-4 ring-sky-500/10'
  },
  {
    id: 'Tintas Listas',
    title: 'Tintas Listas',
    subtitle: 'Tintas mezcladas',
    icon: CheckCircle2,
    accentColor: '#8b5cf6', // purple-500
    headerBg: 'from-purple-500/10 to-purple-500/5 text-purple-900 border-purple-200',
    badgeBg: 'bg-purple-100',
    badgeText: 'text-purple-800',
    dropBorder: 'border-purple-400 bg-purple-50/40 ring-4 ring-purple-500/10'
  },
  {
    id: 'En Máquina',
    title: 'En Máquina',
    subtitle: 'Estampándose',
    icon: Layers,
    accentColor: '#6366f1', // indigo-500
    headerBg: 'from-indigo-500/10 to-indigo-500/5 text-indigo-900 border-indigo-200',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-800',
    dropBorder: 'border-indigo-400 bg-indigo-50/40 ring-4 ring-indigo-500/10'
  },
  {
    id: 'Completada',
    title: 'Completada',
    subtitle: 'Producción finalizada',
    icon: Award,
    accentColor: '#10b981', // emerald-500
    headerBg: 'from-emerald-500/10 to-emerald-500/5 text-emerald-900 border-emerald-200',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-800',
    dropBorder: 'border-emerald-400 bg-emerald-50/40 ring-4 ring-emerald-500/10'
  }
];

interface WorkOrderKanbanBoardProps {
  orders: WorkOrder[];
  designs: Design[];
  pantones: PantoneColor[];
  batches: BatchLog[];
  todayStr: string;
  tomorrowStr: string;
  getOrderDate: (order: WorkOrder) => string;
  getDynamicOrderProgress: (order: WorkOrder) => {
    completedCount: number;
    totalColors: number;
    isFullyCompleted: boolean;
    distinctPreparedColors: string[];
  };
  getOrderEffectiveStatus: (
    order: WorkOrder,
    prog: { completedCount: number; totalColors: number; isFullyCompleted: boolean }
  ) => 'Pendiente' | 'Preparando Tintas' | 'Tintas Listas' | 'Estampándose' | 'Completada';
  onUpdateStatus: (orderId: string, newStatus: WorkOrder['status']) => Promise<void>;
  onOpenOrderModal: (order: WorkOrder) => void;
  onDeleteOrder?: (orderId: string) => void;
}

export default function WorkOrderKanbanBoard({
  orders,
  designs,
  pantones,
  todayStr,
  tomorrowStr,
  getOrderDate,
  getDynamicOrderProgress,
  getOrderEffectiveStatus,
  onUpdateStatus,
  onOpenOrderModal,
  onDeleteOrder
}: WorkOrderKanbanBoardProps) {
  const [draggedOrderId, setDraggedOrderId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<KanbanColumnId | null>(null);

  // Mapear el estado efectivo a las 5 columnas Kanban
  const mapEffectiveStatusToKanban = (
    order: WorkOrder
  ): KanbanColumnId => {
    const prog = getDynamicOrderProgress(order);
    const eff = getOrderEffectiveStatus(order, prog);
    if (eff === 'Estampándose' || order.status === 'En Máquina') return 'En Máquina';
    return eff;
  };

  // Agrupar órdenes por columna Kanban
  const columnsData = React.useMemo(() => {
    const map: Record<KanbanColumnId, WorkOrder[]> = {
      'Pendiente': [],
      'Preparando Tintas': [],
      'Tintas Listas': [],
      'En Máquina': [],
      'Completada': []
    };

    orders.forEach(order => {
      const colId = mapEffectiveStatusToKanban(order);
      if (map[colId]) {
        map[colId].push(order);
      } else {
        map['Pendiente'].push(order);
      }
    });

    return map;
  }, [orders, getDynamicOrderProgress, getOrderEffectiveStatus]);

  // Manejadores de Drag and Drop
  const handleDragStart = (e: React.DragEvent, orderId?: string) => {
    if (!orderId) return;
    setDraggedOrderId(orderId);
    e.dataTransfer.setData('text/plain', orderId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedOrderId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, colId: KanbanColumnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumn !== colId) {
      setDragOverColumn(colId);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetCol: KanbanColumnId) => {
    e.preventDefault();
    const orderId = e.dataTransfer.getData('text/plain') || draggedOrderId;
    setDraggedOrderId(null);
    setDragOverColumn(null);

    if (!orderId) return;

    // Convertir la columna Kanban al status de base de datos
    let newStatus: WorkOrder['status'] = targetCol;
    if (targetCol === 'En Máquina') {
      newStatus = 'Estampándose';
    }

    await onUpdateStatus(orderId, newStatus);
  };

  // Avanzar o retroceder de columna manualmente (para móviles o clics rápidos)
  const handleShiftColumn = async (order: WorkOrder, direction: 'prev' | 'next') => {
    if (!order.id) return;
    const currentCol = mapEffectiveStatusToKanban(order);
    const colOrder: KanbanColumnId[] = ['Pendiente', 'Preparando Tintas', 'Tintas Listas', 'En Máquina', 'Completada'];
    const curIdx = colOrder.indexOf(currentCol);
    const newIdx = direction === 'next' ? curIdx + 1 : curIdx - 1;

    if (newIdx >= 0 && newIdx < colOrder.length) {
      const targetCol = colOrder[newIdx];
      let newStatus: WorkOrder['status'] = targetCol;
      if (targetCol === 'En Máquina') {
        newStatus = 'Estampándose';
      }
      await onUpdateStatus(order.id, newStatus);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* 5 Columnas Kanban con scroll horizontal suave */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-2 select-none">
        <div className="inline-flex gap-3.5 h-full min-w-full px-1">
          {KANBAN_COLUMNS.map((col, colIdx) => {
            const colOrders = columnsData[col.id] || [];
            const isDropTarget = dragOverColumn === col.id;
            const Icon = col.icon;

            return (
              <div
                key={col.id}
                onDragOver={e => handleDragOver(e, col.id)}
                onDragLeave={() => setDragOverColumn(null)}
                onDrop={e => handleDrop(e, col.id)}
                className={`w-[290px] sm:w-[320px] shrink-0 flex flex-col rounded-3xl bg-slate-100/90 border transition-all duration-150 overflow-hidden ${
                  isDropTarget
                    ? `${col.dropBorder} scale-[1.01]`
                    : 'border-slate-200/90 shadow-2xs'
                }`}
              >
                {/* Cabecera de la columna */}
                <div className={`p-3 sm:p-3.5 bg-gradient-to-b ${col.headerBg} border-b flex items-center justify-between shrink-0`}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-2xs text-white"
                      style={{ backgroundColor: col.accentColor }}
                    >
                      <Icon className="w-4 h-4 stroke-[2.5]" />
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-black text-xs sm:text-sm tracking-tight truncate leading-tight">
                        {col.title}
                      </h4>
                      <p className="text-[10px] text-slate-500 font-medium truncate">
                        {col.subtitle}
                      </p>
                    </div>
                  </div>

                  <span className={`px-2 py-0.5 rounded-full font-mono text-xs font-black ${col.badgeBg} ${col.badgeText} shadow-2xs shrink-0`}>
                    {colOrders.length}
                  </span>
                </div>

                {/* Zona de tarjetas (Scroll vertical independiente por columna) */}
                <div className="flex-1 overflow-y-auto p-2.5 space-y-2.5 custom-scrollbar min-h-[220px]">
                  {colOrders.length === 0 ? (
                    <div
                      className={`h-40 rounded-2xl border-2 border-dashed flex flex-col items-center justify-center p-4 text-center transition-colors ${
                        isDropTarget
                          ? 'border-blue-400 bg-blue-50/50 text-blue-600'
                          : 'border-slate-300/80 bg-white/40 text-slate-400'
                      }`}
                    >
                      <Icon className="w-6 h-6 opacity-40 mb-1" />
                      <p className="text-xs font-bold">Sin órdenes</p>
                      <p className="text-[10px] opacity-75 mt-0.5">Arrastra una tarjeta aquí</p>
                    </div>
                  ) : (
                    colOrders.map(order => {
                      const prog = getDynamicOrderProgress(order);
                      const isDragging = draggedOrderId === order.id;
                      const oDate = getOrderDate(order);
                      const isToday = oDate === todayStr;
                      const isTomorrow = oDate === tomorrowStr;

                      // Encontrar el diseño y los colores
                      const design = order.designId ? designs.find(d => d.id === order.designId) : null;
                      const isReactivo = (order.lineType || design?.lineType)?.toLowerCase() === 'reactivo';

                      // Lista de colores para previsualización en la tarjeta
                      const designColors = design?.colors || (order.pantoneCode ? [{ pantoneCode: order.pantoneCode }] : []);

                      return (
                        <div
                          key={order.id}
                          draggable={true}
                          onDragStart={e => handleDragStart(e, order.id)}
                          onDragEnd={handleDragEnd}
                          className={`bg-white rounded-2xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs hover:shadow-md transition-all group flex flex-col gap-2.5 cursor-grab active:cursor-grabbing relative ${
                            isDragging ? 'opacity-40 scale-95 border-blue-400' : ''
                          }`}
                        >
                          {/* Fila superior: Grip, Título y Prioridad */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <GripVertical className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-400 shrink-0" />
                              <div className="min-w-0">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {order.designId ? (
                                    <div className="w-4 h-4 rounded bg-purple-100 text-purple-700 font-black text-[9px] flex items-center justify-center shrink-0">
                                      D
                                    </div>
                                  ) : (
                                    <div
                                      className="w-4 h-4 rounded border border-black/10 shrink-0"
                                      style={{ backgroundColor: order.pantoneHex || '#cbd5e1' }}
                                    />
                                  )}
                                  <h5 className="font-black text-xs sm:text-sm text-slate-900 truncate leading-tight">
                                    {order.designName || order.pantoneCode || 'Sin Nombre'}
                                  </h5>
                                </div>
                                <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  OT #{order.id?.slice(-5).toUpperCase() || '0000'} · {isReactivo ? 'Reactivo' : 'Pigmento'}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              {order.priority === 'Urgente' && (
                                <span className="bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-md text-[9px] font-black flex items-center gap-1 shrink-0 animate-pulse">
                                  <AlertCircle className="w-2.5 h-2.5" /> URGENTE
                                </span>
                              )}
                              {onDeleteOrder && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteOrder(order.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                                  title="Eliminar Orden"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Medidor visual de avance de tintas / colores preparados */}
                          {order.designId && (
                            <div className="bg-slate-50 rounded-xl p-2 border border-slate-100 space-y-1.5">
                              <div className="flex items-center justify-between text-[10px]">
                                <span className="font-bold text-slate-500">Tintas / Baldes:</span>
                                <span className={`font-mono font-black ${prog.isFullyCompleted ? 'text-purple-700' : 'text-blue-700'}`}>
                                  {prog.completedCount} de {prog.totalColors} listos
                                </span>
                              </div>

                              {/* Barra de progreso */}
                              <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                <div
                                  className={`h-full transition-all duration-300 ${
                                    prog.isFullyCompleted ? 'bg-purple-600' : 'bg-blue-600'
                                  }`}
                                  style={{
                                    width: `${prog.totalColors > 0 ? (prog.completedCount / prog.totalColors) * 100 : 0}%`
                                  }}
                                />
                              </div>

                              {/* Puntos de color de cada marco */}
                              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pt-0.5">
                                {designColors.map((c, i) => {
                                  const pantone = pantones.find(p => p.code.toLowerCase().trim() === c.pantoneCode.toLowerCase().trim());
                                  const isPrepared = prog.distinctPreparedColors.includes(c.pantoneCode.trim().toUpperCase());
                                  return (
                                    <div
                                      key={i}
                                      className="relative group/pill"
                                      title={`${c.pantoneCode} (${isPrepared ? 'Listo' : 'Pendiente'})`}
                                    >
                                      <div
                                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center text-[7px] font-bold text-white shadow-2xs ${
                                          isPrepared ? 'ring-2 ring-emerald-500 ring-offset-1' : 'opacity-60 border-slate-300'
                                        }`}
                                        style={{ backgroundColor: pantone?.hex || '#94a3b8' }}
                                      >
                                        {isPrepared && '✓'}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Metadatos: Unidades, Fecha y Operador */}
                          <div className="flex items-center justify-between text-[10px] text-slate-500 pt-0.5">
                            <span className="font-semibold text-slate-700">
                              {order.targetQuantity} {order.productType || 'pz'}
                            </span>
                            <span className={`px-1.5 py-0.5 rounded font-bold ${
                              isToday ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                              isTomorrow ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              {isToday ? 'Hoy' : isTomorrow ? 'Mañana' : oDate}
                            </span>
                          </div>

                          {/* Barra de Acciones de la Tarjeta */}
                          <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-1.5">
                            {/* Botón principal abrir orden */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => onOpenOrderModal(order)}
                                className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg text-[11px] font-bold transition-colors cursor-pointer flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>Abrir Orden</span>
                              </button>
                              {onDeleteOrder && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteOrder(order.id);
                                  }}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                  title="Eliminar Orden"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>

                            {/* Botones para avanzar o retroceder columna con 1 clic (táctil) */}
                            <div className="flex items-center gap-0.5 ml-auto">
                              {colIdx > 0 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShiftColumn(order, 'prev');
                                  }}
                                  className="w-6 h-6 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center transition-colors cursor-pointer"
                                  title="Mover a columna anterior"
                                >
                                  <ArrowLeft className="w-3 h-3" />
                                </button>
                              )}
                              {colIdx < KANBAN_COLUMNS.length - 1 && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleShiftColumn(order, 'next');
                                  }}
                                  className="w-6 h-6 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center transition-colors cursor-pointer shadow-2xs"
                                  title="Avanzar a siguiente columna"
                                >
                                  <ArrowRight className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
