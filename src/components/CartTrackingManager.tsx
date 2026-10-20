import React, { useState, useMemo, useEffect } from 'react';
import {
  ShoppingCart, Camera, Printer, QrCode, Search, Filter,
  Layers, CheckCircle2, Clock, AlertTriangle, ArrowRight,
  Gauge, Scale, Sparkles, RefreshCw, Plus, Flame, ShieldCheck,
  Package, Check, ChevronRight, X, Calendar
} from 'lucide-react';
import { WorkOrder, Design, PantoneColor } from '../types';
import ProductionCartLabelModal, { CartProductionStage } from './ProductionCartLabelModal';
import InkBucketScannerModal from './InkBucketScannerModal';

export interface PlantCart {
  id: string;
  cartNumber: number;
  orderId: string;
  orderNumber: string;
  designName: string;
  productReference: string;
  productType: string;
  units: number;
  totalKg: number;
  totalMeters: number;
  technique: 'REACTIVO' | 'PIGMENTO';
  stage: CartProductionStage;
  operator: string;
  updatedAt: string;
  notes?: string;
}

const ALL_STAGES: { id: CartProductionStage; label: string; shortLabel: string; color: string; bg: string; border: string; icon: any }[] = [
  {
    id: 'En Estampado',
    label: '1. En Estampado / Llenándose',
    shortLabel: 'En Estampado',
    color: 'text-sky-700',
    bg: 'bg-sky-50',
    border: 'border-sky-300',
    icon: Layers
  },
  {
    id: 'Estampado Finalizado (Esperando Horno)',
    label: '2. Estampado Finalizado (➔ Horno)',
    shortLabel: 'Esperando Horno',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-300',
    icon: Clock
  },
  {
    id: 'En Horno / Termofijado',
    label: '3. En Horno / Termofijado',
    shortLabel: 'En Horno',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-300',
    icon: Flame
  },
  {
    id: 'En Revisión y Calidad',
    label: '4. En Revisión y Calidad',
    shortLabel: 'En Calidad',
    color: 'text-purple-700',
    bg: 'bg-purple-50',
    border: 'border-purple-300',
    icon: ShieldCheck
  },
  {
    id: 'En Confección / Doblez / Empaque',
    label: '5. En Empaque / Confección',
    shortLabel: 'En Empaque',
    color: 'text-indigo-700',
    bg: 'bg-indigo-50',
    border: 'border-indigo-300',
    icon: Package
  },
  {
    id: 'Empacado / Finalizado',
    label: '6. Empacado / Finalizado',
    shortLabel: 'Finalizado',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-300',
    icon: CheckCircle2
  }
];

interface CartTrackingManagerProps {
  workOrders: WorkOrder[];
  designs: Design[];
  pantones: PantoneColor[];
  onUpdateOrder?: (id: string, updates: Partial<WorkOrder>) => Promise<boolean>;
}

export default function CartTrackingManager({
  workOrders,
  designs,
  pantones
}: CartTrackingManagerProps) {
  // Lista de carros activos en planta guardados en localStorage
  const [carts, setCarts] = useState<PlantCart[]>(() => {
    try {
      const stored = localStorage.getItem('contex_plant_carts_v1');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {
      console.warn('Error leyendo carros de localStorage', e);
    }
    return [];
  });

  // Guardar en localStorage
  useEffect(() => {
    try {
      localStorage.setItem('contex_plant_carts_v1', JSON.stringify(carts));
    } catch (e) {
      console.warn('Error guardando carros en localStorage', e);
    }
  }, [carts]);

  // Si no hay carros aún, inicializar automáticamente carros basados en órdenes completadas o en máquina
  useEffect(() => {
    if (carts.length === 0 && workOrders.length > 0) {
      const initialCarts: PlantCart[] = [];
      const relevantOrders = workOrders.filter(
        o => o.status === 'Completada' || o.status === 'Estampándose' || o.status === 'En Máquina' || o.status === 'Tintas Listas'
      ).slice(0, 6);

      const ordersToSeed = relevantOrders.length > 0 ? relevantOrders : workOrders.slice(0, 4);

      ordersToSeed.forEach((order, index) => {
        const design = order.designId ? designs.find(d => d.id === order.designId) : null;
        const isReactive = (order.lineType || design?.lineType)?.toLowerCase() === 'reactivo';
        const isPigmentoToalla = order.productType === 'Toallas' && !isReactive;
        const widthM = isPigmentoToalla ? 0.35 : ((design?.widthCm || 60) / 100);
        const heightM = isPigmentoToalla ? 0.60 : ((design?.heightCm || 120) / 100);
        const unitWeightG = isPigmentoToalla ? 63 : (design?.unitWeight || Math.round(widthM * heightM * (design?.gramaje || 280)));
        const units = order.targetQuantity || 100;
        const totalKg = Number(((units * unitWeightG) / 1000).toFixed(1));
        const totalMeters = Number((units * heightM).toFixed(1));

        const stageList: CartProductionStage[] = [
          'Estampado Finalizado (Esperando Horno)',
          'En Horno / Termofijado',
          'En Revisión y Calidad',
          'En Confección / Doblez / Empaque'
        ];

        initialCarts.push({
          id: `CART-${Date.now()}-${index + 1}`,
          cartNumber: index + 1,
          orderId: order.id || '',
          orderNumber: `#${order.id ? order.id.slice(-5).toUpperCase() : `0000${index + 1}`}`,
          designName: order.designName || design?.name || 'DISEÑO ESTÁNDAR',
          productReference: order.productReference || order.productType || 'Toalla',
          productType: order.productType || 'Toallas',
          units,
          totalKg,
          totalMeters,
          technique: isReactive ? 'REACTIVO' : 'PIGMENTO',
          stage: stageList[index % stageList.length],
          operator: order.assignedTo || 'Prensista',
          updatedAt: new Date().toISOString()
        });
      });

      if (initialCarts.length > 0) {
        setCarts(initialCarts);
      }
    }
  }, [workOrders, designs, carts.length]);

  // Filtros y búsqueda
  const [stageFilter, setStageFilter] = useState<'ALL' | CartProductionStage>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modales
  const [selectedOrderForLabel, setSelectedOrderForLabel] = useState<{
    order: WorkOrder;
    cartNumber: number;
  } | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState<boolean>(false);
  const [showNewCartModal, setShowNewCartModal] = useState<boolean>(false);

  // Formulario nuevo carro
  const [newCartOrderId, setNewCartOrderId] = useState<string>('');
  const [newCartNumber, setNewCartNumber] = useState<number>(() => {
    return (carts.length > 0 ? Math.max(...carts.map(c => c.cartNumber)) + 1 : 1);
  });
  const [newCartUnits, setNewCartUnits] = useState<string>('');
  const [newCartStage, setNewCartStage] = useState<CartProductionStage>('Estampado Finalizado (Esperando Horno)');

  // Filtrado de carros
  const filteredCarts = useMemo(() => {
    return carts.filter(cart => {
      if (stageFilter !== 'ALL' && cart.stage !== stageFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const cartStr = `carro #${cart.cartNumber} carro ${cart.cartNumber} #${cart.cartNumber}`.toLowerCase();
        const matchesCart = cartStr.includes(q) || String(cart.cartNumber) === q;
        const matchesOrder = cart.orderNumber.toLowerCase().includes(q);
        const matchesDesign = cart.designName.toLowerCase().includes(q);
        const matchesRef = cart.productReference.toLowerCase().includes(q);
        const matchesStage = cart.stage.toLowerCase().includes(q);
        if (!matchesCart && !matchesOrder && !matchesDesign && !matchesRef && !matchesStage) {
          return false;
        }
      }
      return true;
    });
  }, [carts, stageFilter, searchQuery]);

  // KPIs
  const stats = useMemo(() => {
    const totalActive = carts.filter(c => c.stage !== 'Empacado / Finalizado').length;
    const totalUnits = carts.reduce((acc, c) => acc + (c.units || 0), 0);
    const totalKg = Number(carts.reduce((acc, c) => acc + (c.totalKg || 0), 0).toFixed(1));
    const waitingOven = carts.filter(c => c.stage === 'Estampado Finalizado (Esperando Horno)').length;
    const inOven = carts.filter(c => c.stage === 'En Horno / Termofijado').length;
    const inQuality = carts.filter(c => c.stage === 'En Revisión y Calidad').length;
    const inPacking = carts.filter(c => c.stage === 'En Confección / Doblez / Empaque').length;

    return {
      totalActive,
      totalUnits,
      totalKg,
      waitingOven,
      inOven,
      inQuality,
      inPacking
    };
  }, [carts]);

  // Avanzar carro a siguiente etapa
  const handleAdvanceCartStage = (cartId: string) => {
    setCarts(prev =>
      prev.map(c => {
        if (c.id !== cartId) return c;
        const currentIdx = ALL_STAGES.findIndex(s => s.id === c.stage);
        if (currentIdx >= 0 && currentIdx < ALL_STAGES.length - 1) {
          return {
            ...c,
            stage: ALL_STAGES[currentIdx + 1].id,
            updatedAt: new Date().toISOString()
          };
        }
        return c;
      })
    );
  };

  // Cambiar etapa directamente
  const handleChangeCartStage = (cartId: string, newStage: CartProductionStage) => {
    setCarts(prev =>
      prev.map(c => (c.id === cartId ? { ...c, stage: newStage, updatedAt: new Date().toISOString() } : c))
    );
  };

  // Abrir modal de impresión de ficha para un carro
  const handleOpenPrintSheet = (cart: PlantCart) => {
    // Encontrar la orden correspondiente o construir un objeto de orden compatible
    const foundOrder = workOrders.find(o => o.id === cart.orderId);
    const orderToPrint: WorkOrder = foundOrder || {
      id: cart.orderId || 'ORD-001',
      designName: cart.designName,
      productReference: cart.productReference,
      productType: cart.productType as any,
      targetQuantity: cart.units,
      lineType: cart.technique.toLowerCase() as any,
      priority: 'Normal',
      status: 'Completada',
      createdAt: new Date()
    };

    setSelectedOrderForLabel({
      order: orderToPrint,
      cartNumber: cart.cartNumber
    });
  };

  // Crear nuevo carro
  const handleCreateCart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCartOrderId) return;
    const order = workOrders.find(o => o.id === newCartOrderId);
    if (!order) return;

    const design = order.designId ? designs.find(d => d.id === order.designId) : null;
    const isReactive = (order.lineType || design?.lineType)?.toLowerCase() === 'reactivo';
    const isPigmentoToalla = order.productType === 'Toallas' && !isReactive;
    const widthM = isPigmentoToalla ? 0.35 : ((design?.widthCm || 60) / 100);
    const heightM = isPigmentoToalla ? 0.60 : ((design?.heightCm || 120) / 100);
    const unitWeightG = isPigmentoToalla ? 63 : (design?.unitWeight || Math.round(widthM * heightM * (design?.gramaje || 280)));
    const units = parseInt(newCartUnits, 10) > 0 ? parseInt(newCartUnits, 10) : (order.targetQuantity || 100);
    const totalKg = Number(((units * unitWeightG) / 1000).toFixed(1));
    const totalMeters = Number((units * heightM).toFixed(1));

    const newCart: PlantCart = {
      id: `CART-${Date.now()}`,
      cartNumber: newCartNumber,
      orderId: order.id || '',
      orderNumber: `#${order.id ? order.id.slice(-5).toUpperCase() : '00000'}`,
      designName: order.designName || design?.name || 'DISEÑO CONTEX',
      productReference: order.productReference || order.productType || 'Toalla',
      productType: order.productType || 'Toallas',
      units,
      totalKg,
      totalMeters,
      technique: isReactive ? 'REACTIVO' : 'PIGMENTO',
      stage: newCartStage,
      operator: order.assignedTo || 'Prensista',
      updatedAt: new Date().toISOString()
    };

    setCarts(prev => [newCart, ...prev]);
    setShowNewCartModal(false);
    setNewCartOrderId('');
    setNewCartUnits('');

    // Abrir de inmediato la ficha para imprimir
    handleOpenPrintSheet(newCart);
  };

  // Eliminar carro
  const handleDeleteCart = (cartId: string) => {
    if (window.confirm('¿Deseas retirar este carro del control de planta?')) {
      setCarts(prev => prev.filter(c => c.id !== cartId));
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-100 overflow-hidden">
      {/* ── CABECERA PRINCIPAL ── */}
      <div className="bg-white border-b border-slate-200 p-4 sm:p-6 shadow-xs shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-indigo-950 text-white flex items-center justify-center shadow-md border border-indigo-800">
              <ShoppingCart className="w-6 h-6 text-indigo-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  Control de Carros en Planta
                </h1>
                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-800 border border-indigo-200">
                  Hornos · Calidad · Empaque
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Trazabilidad de tela estampada por carros físicos tras salir del taller de estampado
              </p>
            </div>
          </div>

          {/* Acciones principales de planta */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsScannerOpen(true)}
              className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs sm:text-sm font-black transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              title="Escanear código QR de la funda del carro con la cámara"
            >
              <Camera className="w-4 h-4" />
              <span>Escanear Carro con Cámara</span>
            </button>
            <button
              onClick={() => {
                setNewCartNumber(carts.length > 0 ? Math.max(...carts.map(c => c.cartNumber)) + 1 : 1);
                setShowNewCartModal(true);
              }}
              className="px-4 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl text-xs sm:text-sm font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">+ Asignar Nuevo Carro</span>
              <span className="inline sm:hidden">+ Carro</span>
            </button>
          </div>
        </div>

        {/* ── BARRA DE KPIS DE PLANTA ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-2.5 sm:p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-slate-500 block">Carros Activos</span>
            <span className="text-xl sm:text-2xl font-black text-indigo-950 font-mono leading-tight">
              {stats.totalActive}
            </span>
          </div>

          <div className="bg-blue-50/70 border border-blue-200 rounded-xl p-2.5 sm:p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-blue-700 block">Prendas en Rodaje</span>
            <span className="text-xl sm:text-2xl font-black text-blue-950 font-mono leading-tight">
              {stats.totalUnits.toLocaleString('es-CO')}
            </span>
          </div>

          <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-2.5 sm:p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-emerald-700 block">Tela Total (Kg)</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-950 font-mono leading-tight">
              {stats.totalKg} <span className="text-xs font-bold">Kg</span>
            </span>
          </div>

          <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-2.5 sm:p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-amber-700 block">Esperando Horno</span>
            <span className="text-xl sm:text-2xl font-black text-amber-950 font-mono leading-tight">
              {stats.waitingOven}
            </span>
          </div>

          <div className="bg-orange-50/70 border border-orange-200 rounded-xl p-2.5 sm:p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-orange-700 block">En Termofijado</span>
            <span className="text-xl sm:text-2xl font-black text-orange-950 font-mono leading-tight">
              {stats.inOven}
            </span>
          </div>

          <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-2.5 sm:p-3 text-center">
            <span className="text-[10px] font-bold uppercase text-purple-700 block">Calidad / Empaque</span>
            <span className="text-xl sm:text-2xl font-black text-purple-950 font-mono leading-tight">
              {stats.inQuality + stats.inPacking}
            </span>
          </div>
        </div>

        {/* ── BARRA DE BÚSQUEDA Y FILTRO POR ETAPA ── */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 mt-4 pt-3 border-t border-slate-100">
          {/* Pestañas de Etapa */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              onClick={() => setStageFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                stageFilter === 'ALL'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              Todos ({carts.length})
            </button>
            {ALL_STAGES.map(stage => {
              const count = carts.filter(c => c.stage === stage.id).length;
              return (
                <button
                  key={stage.id}
                  onClick={() => setStageFilter(stage.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${
                    stageFilter === stage.id
                      ? `${stage.bg} ${stage.color} border ${stage.border} shadow-2xs font-black`
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span>{stage.shortLabel}</span>
                  <span className="text-[10px] opacity-75 font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Buscador */}
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar # Carro, Lote, Diseño..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>
      </div>

      {/* ── CONTENIDO PRINCIPAL: GRILLA DE CARROS EN PLANTA ── */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
        {filteredCarts.length === 0 ? (
          <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-8 sm:p-12 text-center max-w-md mx-auto my-8">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-200 text-indigo-600 flex items-center justify-center mx-auto mb-4">
              <ShoppingCart className="w-8 h-8" />
            </div>
            <h3 className="text-base sm:text-lg font-black text-slate-900 mb-1">
              No hay carros en esta etapa
            </h3>
            <p className="text-xs text-slate-500 mb-4">
              {searchQuery ? 'Prueba con otro término de búsqueda o limpia los filtros.' : 'Puedes asignar un nuevo carro a cualquier orden haciendo clic en "+ Asignar Nuevo Carro".'}
            </p>
            <button
              onClick={() => {
                setStageFilter('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold cursor-pointer"
            >
              Ver todos los carros
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredCarts.map(cart => {
              const stageConfig = ALL_STAGES.find(s => s.id === cart.stage) || ALL_STAGES[0];
              const StageIcon = stageConfig.icon;
              const nextStageIdx = ALL_STAGES.findIndex(s => s.id === cart.stage) + 1;
              const nextStage = nextStageIdx < ALL_STAGES.length ? ALL_STAGES[nextStageIdx] : null;

              return (
                <div
                  key={cart.id}
                  className="bg-white rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all flex flex-col overflow-hidden group"
                >
                  {/* Encabezado de la Tarjeta */}
                  <div className="p-4 pb-3 border-b border-slate-100 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 rounded-xl bg-indigo-950 text-white font-mono font-black text-base flex items-center justify-center shadow-xs">
                        #{String(cart.cartNumber).padStart(2, '0')}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm leading-tight">
                          CARRO #{String(cart.cartNumber).padStart(2, '0')}
                        </h4>
                        <span className="font-mono text-[10px] text-slate-400 font-bold block">
                          OT {cart.orderNumber}
                        </span>
                      </div>
                    </div>

                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border flex items-center gap-1 ${
                      cart.technique === 'REACTIVO'
                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                        : 'bg-amber-50 text-amber-700 border-amber-200'
                    }`}>
                      {cart.technique}
                    </span>
                  </div>

                  {/* Estado de Etapa Actual */}
                  <div className="px-4 pt-3">
                    <div className={`p-2.5 rounded-xl border flex items-center justify-between ${stageConfig.bg} ${stageConfig.border}`}>
                      <div className="flex items-center gap-2">
                        <StageIcon className={`w-4 h-4 ${stageConfig.color}`} />
                        <span className={`text-xs font-black uppercase ${stageConfig.color}`}>
                          {stageConfig.shortLabel}
                        </span>
                      </div>
                      <span className="w-2 h-2 rounded-full bg-current animate-pulse opacity-80" />
                    </div>
                  </div>

                  {/* Cuerpo: Información de Producto y Métricas */}
                  <div className="p-4 space-y-3 flex-1">
                    <div>
                      <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                        Diseño / Referencia
                      </span>
                      <p className="font-black text-sm text-slate-900 leading-snug truncate">
                        {cart.designName}
                      </p>
                      <p className="text-xs text-slate-500 font-medium truncate mt-0.5">
                        {cart.productReference} ({cart.productType})
                      </p>
                    </div>

                    {/* 3 Métricas en Miniatura */}
                    <div className="grid grid-cols-3 gap-1.5 text-center bg-slate-50 p-2 rounded-xl border border-slate-200/80">
                      <div>
                        <span className="text-[8px] font-black text-blue-600 uppercase block">Unidades</span>
                        <span className="font-mono font-black text-sm text-blue-950">
                          {cart.units}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-emerald-600 uppercase block">Tela (Kg)</span>
                        <span className="font-mono font-black text-sm text-emerald-950">
                          {cart.totalKg}
                        </span>
                      </div>
                      <div>
                        <span className="text-[8px] font-black text-purple-600 uppercase block">Metros</span>
                        <span className="font-mono font-black text-sm text-purple-950">
                          {cart.totalMeters}
                        </span>
                      </div>
                    </div>

                    {/* Operador y última actualización */}
                    <div className="text-[10px] text-slate-400 flex items-center justify-between pt-1">
                      <span>Operador: {cart.operator}</span>
                      <span>{new Date(cart.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>

                  {/* Barra de Acciones del Carro */}
                  <div className="p-3 bg-slate-50/80 border-t border-slate-100 flex items-center justify-between gap-1.5">
                    {/* Botón Imprimir Ficha de Carro */}
                    <button
                      type="button"
                      onClick={() => handleOpenPrintSheet(cart)}
                      className="px-2.5 py-1.5 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-xl text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer"
                      title="Generar e imprimir Ficha Viajera con QR para este carro"
                    >
                      <Printer className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Ficha QR</span>
                    </button>

                    {/* Avanzar Etapa */}
                    {nextStage ? (
                      <button
                        type="button"
                        onClick={() => handleAdvanceCartStage(cart.id)}
                        className="flex-1 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer truncate"
                        title={`Avanzar carro a: ${nextStage.label}`}
                      >
                        <span className="truncate">Avanzar a {nextStage.shortLabel}</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                      </button>
                    ) : (
                      <span className="flex-1 text-center text-[11px] font-black text-emerald-700 bg-emerald-100 py-1.5 rounded-xl border border-emerald-200 flex items-center justify-center gap-1">
                        <Check className="w-3 h-3" /> Completado
                      </span>
                    )}

                    {/* Eliminar Carro */}
                    <button
                      type="button"
                      onClick={() => handleDeleteCart(cart.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Eliminar registro de carro"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── MODAL: CREAR / ASIGNAR NUEVO CARRO A UNA ORDEN ── */}
      {showNewCartModal && (
        <div
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-fade-in"
          onClick={() => setShowNewCartModal(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 p-4 sm:p-5 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center">
                  <ShoppingCart className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base">Asignar Carro a Orden</h3>
                  <p className="text-xs text-slate-400">Genera la ficha para mover la tela en planta</p>
                </div>
              </div>
              <button
                onClick={() => setShowNewCartModal(false)}
                className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateCart} className="p-4 sm:p-6 space-y-4">
              {/* Seleccionar Orden */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Orden de Trabajo / Lote:
                </label>
                <select
                  required
                  value={newCartOrderId}
                  onChange={e => setNewCartOrderId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">-- Selecciona una orden --</option>
                  {workOrders.map(o => (
                    <option key={o.id} value={o.id}>
                      OT #{o.id?.slice(-5).toUpperCase()} · {o.designName || 'Diseño'} ({o.targetQuantity} pz · {o.status})
                    </option>
                  ))}
                </select>
              </div>

              {/* Número de Carro */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Número de Carro:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="99"
                    required
                    value={newCartNumber}
                    onChange={e => setNewCartNumber(Math.max(1, parseInt(e.target.value || '1', 10)))}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-black text-sm text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                    Prendas en Carro:
                  </label>
                  <input
                    type="number"
                    min="1"
                    placeholder="Total orden"
                    value={newCartUnits}
                    onChange={e => setNewCartUnits(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 font-mono font-bold text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-center"
                  />
                </div>
              </div>

              {/* Etapa Inicial */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Etapa de Ingreso del Carro:
                </label>
                <select
                  value={newCartStage}
                  onChange={e => setNewCartStage(e.target.value as CartProductionStage)}
                  className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ALL_STAGES.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Botones */}
              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNewCartModal(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>Crear e Imprimir Ficha</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── MODAL: FICHA / ETIQUETA IMPRIMIBLE DE CARRO ── */}
      {selectedOrderForLabel && (
        <ProductionCartLabelModal
          isOpen={!!selectedOrderForLabel}
          onClose={() => setSelectedOrderForLabel(null)}
          order={selectedOrderForLabel.order}
          designs={designs}
          pantones={pantones}
          defaultCartNumber={selectedOrderForLabel.cartNumber}
        />
      )}

      {/* ── MODAL: ESCÁNER QR DE CARRO CON CÁMARA ── */}
      <InkBucketScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        workOrders={workOrders}
        designs={designs}
        pantones={pantones}
      />
    </div>
  );
}
