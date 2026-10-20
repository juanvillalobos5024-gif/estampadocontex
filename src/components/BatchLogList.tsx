import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import {
  History, Calendar, Award, Scissors, ShoppingBag, CheckCircle, TrendingUp,
  Filter, Search, X, Download, Eye, Trash2, Clock, AlertCircle, Zap, FileText, Table, ChevronDown, ChevronLeft, ChevronRight,
  Plus, Edit2, Layers, Check, Droplets, ExternalLink, ShieldAlert, Loader2
} from 'lucide-react';
import { BatchLog, PantoneColor, TeamMember, StockItem, WorkOrder, Design, DailyProductionRecord } from '../types';
import { findMatchingStockItem, getProductionRecords, addProductionRecord, updateProductionRecord, deleteProductionRecord, syncWorkOrdersToProductionRecords, INITIAL_BATCHES, getDeletedBatchIds, getRecordKg, getRecordGolpes, isToallaDesign } from '../lib/dataService';
import { FULL_YEAR_PRODUCTION_RECORDS } from '../lib/initialProductionData';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer, Cell
} from 'recharts';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import DailyProductionTasks from './DailyProductionTasks';

// Carga perezosa para evitar inflar el bundle inicial
const ProductionCharts = lazy(() => import('./ProductionCharts'));
const InkCharts = lazy(() => import('./InkCharts'));
const SegundasDashboard = lazy(() => import('./SegundasDashboard'));

function DashboardLoadingSkeleton() {
  return (
    <div className="w-full min-h-[300px] flex flex-col items-center justify-center p-8 text-slate-400 bg-white rounded-2xl border border-slate-100 shadow-xs">
      <div className="w-9 h-9 rounded-xl bg-slate-50 text-slate-600 flex items-center justify-center mb-2 animate-pulse border border-slate-200">
        <Loader2 className="w-4 h-4 animate-spin" />
      </div>
      <p className="text-xs font-bold text-slate-600">Cargando gráficos y datos...</p>
    </div>
  );
}

interface BatchLogListProps {
  batches: BatchLog[];
  workOrders?: WorkOrder[];
  pantones: PantoneColor[];
  team: TeamMember[];
  stock: StockItem[];
  designs?: Design[];
  onDeleteBatch: (id: string) => void;
  onDeleteWorkOrder?: (id: string) => void;
}

const COLORS = ['#0ea5e9', '#f59e0b', '#10b981', '#6366f1', '#ec4899', '#ef4444', '#14b8a6'];

type TimeFilter = 'today' | 'week' | 'month' | 'year' | 'all' | 'custom';
type MetricType = 'kg' | 'inks';

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
    'Completado': { bg: 'bg-emerald-50 text-emerald-700 border border-emerald-100', text: 'Completado', icon: <CheckCircle className="w-3 h-3 text-emerald-500" /> },
    'En Mezclado': { bg: 'bg-blue-50 text-blue-700 border border-blue-100', text: 'En Mezclado', icon: <Clock className="w-3 h-3 text-blue-500" /> },
    'Pendiente': { bg: 'bg-amber-50 text-amber-700 border border-amber-100', text: 'Pendiente', icon: <AlertCircle className="w-3 h-3 text-amber-500" /> },
  };
  const cfg = map[status] ?? map['Completado'];
  return (
    <span className={`inline-flex items-center gap-1 ${cfg.bg} px-2 py-0.5 rounded-full text-[10px] font-bold`}>
      {cfg.icon}
      {cfg.text}
    </span>
  );
}

function formatProductionDate(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const dayNum = d.getDate();
      const monthName = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
      return `${dayNum}-${monthName}`;
    }
    const d = new Date(dateStr);
    return `${d.getDate()}-${d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')}`;
  } catch (e) {
    return dateStr;
  }
}

function isAdditiveComponent(name: string, stockList: StockItem[] = []): boolean {
  const n = (name || '').toLowerCase();
  if (
    n.includes('urea') ||
    n.includes('asutol') ||
    n.includes('bicarbonato') ||
    n.includes('espesante') ||
    n.includes('aditivo') ||
    n.includes('fixer') ||
    n.includes('fijador') ||
    n.includes('sal ') ||
    n.includes('alginato') ||
    n.includes('carbonato') ||
    n.includes('sulfato') ||
    n.includes('fosfato') ||
    n.includes('silicona') ||
    n.includes('lubricante') ||
    n.includes('bicromato') ||
    n.includes('auxiliar') ||
    n.includes('retardante') ||
    n.includes('antiespumante') ||
    n.includes('concentrate') ||
    n.includes('prestovil') ||
    n.includes('alcohol') ||
    n.includes('pva') ||
    n.includes('auxilube') ||
    n.includes('suncoat') ||
    n.includes('glicerina') ||
    n.includes('rfs')
  ) {
    return true;
  }
  const matched = stockList.find(s => s.name.toLowerCase() === n || s.name.toLowerCase().includes(n));
  if (matched && ['urea', 'asutol', 'bicarbonato', 'pasta', 'aditivo', 'sal_alginato', 'base'].includes(matched.type)) {
    return true;
  }
  return false;
}

export default function BatchLogList({ batches, workOrders = [], pantones, team, stock, designs = [], onDeleteBatch, onDeleteWorkOrder }: BatchLogListProps) {
  const [activeDashboardTab, setActiveDashboardTab] = useState<'daily_golpes' | 'production_sheet' | 'production_charts' | 'analytics' | 'segundas'>('daily_golpes');
  const [productionRecords, setProductionRecords] = useState<DailyProductionRecord[]>(() => FULL_YEAR_PRODUCTION_RECORDS);
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [deleteRecordConfirmId, setDeleteRecordConfirmId] = useState<string | null>(null);

  // Formulario de Registro Diario de Producción
  const [recordDate, setRecordDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [recordDesignName, setRecordDesignName] = useState('');
  const [recordShift, setRecordShift] = useState<number>(1);
  const [recordGolpes, setRecordGolpes] = useState<number>(800);
  const [recordWidthM, setRecordWidthM] = useState<number>(0.60);
  const [recordHeightM, setRecordHeightM] = useState<number>(1.20);
  const [recordGramaje, setRecordGramaje] = useState<number>(280);
  const [recordProcess, setRecordProcess] = useState<'PIGMENTO' | 'REACTIVO'>('REACTIVO');
  const [recordUnits, setRecordUnits] = useState<number>(2400);
  const [recordUnitWeightG, setRecordUnitWeightG] = useState<number>(201.6);

  const [timeFilter, setTimeFilter] = useState<TimeFilter>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [metricType, setMetricType] = useState<MetricType>('inks');
  const [weightUnit, setWeightUnit] = useState<'kg' | 'g'>('kg');
  const [searchTerm, setSearchTerm] = useState('');
  const [productFilter, setProductFilter] = useState<'all' | 'Toallas' | 'Otros'>('all');
  const [lineTypeFilter, setLineTypeFilter] = useState<'all' | 'pigmento' | 'reactivo' | 'aditivo'>('all');
  const [logTypeFilter, setLogTypeFilter] = useState<'all' | 'preparacion' | 'consumo'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedBatch, setSelectedBatch] = useState<BatchLog | null>(null);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<WorkOrder | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [deleteOrderConfirmId, setDeleteOrderConfirmId] = useState<string | null>(null);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [pageMezclas, setPageMezclas] = useState(1);
  const [pageConsumo, setPageConsumo] = useState(1);
  const [pageProduction, setPageProduction] = useState(1);
  const [productionPerPage, setProductionPerPage] = useState(25);
  const [mobilePlanillaView, setMobilePlanillaView] = useState<'cards' | 'table'>('cards');

  const [deletedBatchIds, setDeletedBatchIds] = useState<Set<string>>(() => getDeletedBatchIds());

  // Lotes efectivos: se basa en batches entregado por App (o INITIAL_BATCHES si aún no carga), excluyendo siempre los lotes eliminados
  const effectiveBatches = useMemo(() => {
    const baseSource = (batches && batches.length > 0) ? batches : INITIAL_BATCHES;
    const list = baseSource.filter(b => b && b.id && !deletedBatchIds.has(b.id));

    // Si baseSource es INITIAL_BATCHES y además hay lotes de batches que no están en list, fusionar
    if (baseSource === INITIAL_BATCHES && batches && batches.length > 0) {
      const existing = new Set(list.map(b => b.id));
      for (const b of batches) {
        if (b && b.id && !existing.has(b.id) && !deletedBatchIds.has(b.id)) {
          list.push(b);
        }
      }
    }

    const hasPastaMadreBatch = list.some(b => (b.pantoneCode || '').toUpperCase().includes('PASTA MADRE'));
    const pastaMadreStock = stock.find(s => s.name === 'Pasta Madre (Preparada)' && s.quantity > 0);

    if (!hasPastaMadreBatch && pastaMadreStock && !deletedBatchIds.has('stock-pasta-madre-lote')) {
      list.push({
        id: 'stock-pasta-madre-lote',
        pantoneCode: 'PASTA MADRE',
        pantoneHex: '#FDFBF7',
        productType: 'Otros',
        productReference: 'Lote Pasta Madre en Bodega',
        lineType: 'reactivo',
        quantity: 1,
        totalGrammage: pastaMadreStock.quantity,
        operator: 'Laboratorio',
        timestamp: pastaMadreStock.lastUpdated || new Date(),
        status: 'Completado',
        type: 'preparacion'
      });
    }
    return list;
  }, [batches, stock, deletedBatchIds]);

  const loadProductionData = async () => {
    const data = await getProductionRecords();
    setProductionRecords(data);
  };

  useEffect(() => {
    loadProductionData();
    const handleUpdate = () => {
      loadProductionData();
    };
    window.addEventListener('production-records-updated', handleUpdate);
    return () => window.removeEventListener('production-records-updated', handleUpdate);
  }, []);

  useEffect(() => {
    if (workOrders && workOrders.length > 0) {
      syncWorkOrdersToProductionRecords(workOrders, designs).then(data => {
        setProductionRecords(data);
      });
    }
  }, [workOrders, designs]);

  // Reiniciar página de producción al cambiar cualquier filtro de tiempo o búsqueda
  useEffect(() => {
    setPageProduction(1);
  }, [timeFilter, selectedMonth, selectedYear, dateFrom, dateTo, searchTerm]);

  // Años disponibles en base a los registros existentes y el año actual
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const yearsSet = new Set<number>([currentY, currentY - 1, currentY - 2]);
    effectiveBatches.forEach(b => {
      if (b.timestamp) {
        const d = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        if (!isNaN(d.getFullYear())) yearsSet.add(d.getFullYear());
      }
    });
    workOrders.forEach(w => {
      if (w.completedAt) {
        const d = w.completedAt.toDate ? w.completedAt.toDate() : new Date(w.completedAt);
        if (!isNaN(d.getFullYear())) yearsSet.add(d.getFullYear());
      }
    });
    productionRecords.forEach(r => {
      const y = parseInt(r.date.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [effectiveBatches, workOrders, productionRecords]);

  const handlePrevMonth = () => {
    if (selectedMonth === 0) {
      setSelectedMonth(11);
      setSelectedYear(y => y - 1);
    } else {
      setSelectedMonth(m => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 11) {
      setSelectedMonth(0);
      setSelectedYear(y => y + 1);
    } else {
      setSelectedMonth(m => m + 1);
    }
  };

  const handleSelectDesign = (name: string) => {
    setRecordDesignName(name);
    const d = designs.find(item => item.name.toUpperCase() === name.toUpperCase());
    const isToalla = isToallaDesign(name);
    if (d) {
      const wM = isToalla ? 0.35 : (d.widthCm ? Number((d.widthCm / 100).toFixed(2)) : 0.60);
      const hM = isToalla ? 0.60 : (d.heightCm ? Number((d.heightCm / 100).toFixed(2)) : 1.20);
      setRecordWidthM(wM);
      setRecordHeightM(hM);
      setRecordGramaje(isToalla ? 310 : (d.gramaje || 280));
      setRecordProcess(isToalla ? 'PIGMENTO' : (d.lineType === 'reactivo' ? 'REACTIVO' : 'PIGMENTO'));
      const uWeight = isToalla ? 63 : (d.unitWeight || Number(((wM * hM) * (d.gramaje || 280)).toFixed(1)));
      setRecordUnitWeightG(uWeight);
      const ratio = (wM <= 0.40 || isToalla) ? 5 : 3;
      setRecordUnits(recordGolpes * ratio);
    } else if (isToalla) {
      setRecordWidthM(0.35);
      setRecordHeightM(0.60);
      setRecordGramaje(310);
      setRecordProcess('PIGMENTO');
      setRecordUnitWeightG(63);
      setRecordUnits(recordGolpes * 5);
    }
  };

  const handleOpenAddRecord = () => {
    setEditingRecordId(null);
    setRecordDate(new Date().toISOString().slice(0, 10));
    const firstDesign = designs.length > 0 ? designs[0] : null;
    const isToalla = firstDesign ? isToallaDesign(firstDesign.name) : false;
    const wM = isToalla ? 0.35 : (firstDesign?.widthCm ? Number((firstDesign.widthCm / 100).toFixed(2)) : 0.60);
    const hM = isToalla ? 0.60 : (firstDesign?.heightCm ? Number((firstDesign.heightCm / 100).toFixed(2)) : 1.20);
    setRecordDesignName(firstDesign ? firstDesign.name : '');
    setRecordShift(1);
    setRecordGolpes(800);
    setRecordWidthM(wM);
    setRecordHeightM(hM);
    setRecordGramaje(isToalla ? 310 : (firstDesign?.gramaje || 280));
    setRecordProcess(isToalla ? 'PIGMENTO' : (firstDesign?.lineType === 'reactivo' ? 'REACTIVO' : 'PIGMENTO'));
    const uWeight = isToalla ? 63 : (firstDesign?.unitWeight || Number(((wM * hM) * (firstDesign?.gramaje || 280)).toFixed(1)));
    setRecordUnitWeightG(uWeight);
    const ratio = (wM <= 0.40 || isToalla) ? 5 : 3;
    setRecordUnits(800 * ratio);
    setIsRecordModalOpen(true);
  };

  const handleOpenEditRecord = (r: DailyProductionRecord) => {
    setEditingRecordId(r.id || null);
    setRecordDate(r.date);
    setRecordDesignName(r.designName);
    setRecordShift(r.shift);
    const g = getRecordGolpes(r);
    setRecordGolpes(g);
    const isToalla = isToallaDesign(r.designName, r.widthM, r.process);
    setRecordWidthM(isToalla ? 0.35 : r.widthM);
    setRecordHeightM(isToalla ? 0.60 : r.heightM);
    setRecordGramaje(isToalla ? 310 : r.gramaje);
    setRecordProcess(isToalla ? 'PIGMENTO' : r.process);
    setRecordUnits(r.units);
    setRecordUnitWeightG(isToalla ? 63 : (r.unitWeightG || Number(((r.widthM * r.heightM) * r.gramaje).toFixed(1))));
    setIsRecordModalOpen(true);
  };

  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recordDesignName.trim() || recordUnits <= 0) {
      alert("Por favor completa el diseño y las unidades.");
      return;
    }

    const isToalla = isToallaDesign(recordDesignName, recordWidthM, recordProcess);
    const area = isToalla ? 0.21 : Number((recordWidthM * recordHeightM).toFixed(2));
    const matchedDesign = designs.find(item => item.name.toUpperCase() === recordDesignName.toUpperCase().trim());
    const unitWeight = isToalla ? 63 : (recordUnitWeightG || matchedDesign?.unitWeight || Number((area * recordGramaje).toFixed(1)));
    const kg = Number(((recordUnits * unitWeight) / 1000).toFixed(2));
    const pxg = isToalla ? 5 : (recordWidthM <= 0.40 ? 5 : 3);
    const golpes = Number(recordGolpes) || Math.round(recordUnits / pxg);

    const recordData: DailyProductionRecord = {
      date: recordDate,
      designName: recordDesignName.toUpperCase().trim(),
      shift: Number(recordShift) || 1,
      golpes,
      widthM: isToalla ? 0.35 : Number(recordWidthM) || 0,
      heightM: isToalla ? 0.60 : Number(recordHeightM) || 0,
      gramaje: isToalla ? 310 : Number(recordGramaje) || 0,
      process: isToalla ? 'PIGMENTO' : recordProcess,
      areaM2: area,
      unitWeightG: unitWeight,
      units: Number(recordUnits) || 0,
      kgDay: kg,
    };

    if (editingRecordId) {
      await updateProductionRecord(editingRecordId, recordData);
    } else {
      await addProductionRecord(recordData);
    }

    setIsRecordModalOpen(false);
    loadProductionData();
  };

  const handleDeleteRecord = async (id: string) => {
    setProductionRecords(prev => prev.filter(r => r.id !== id));
    setDeleteRecordConfirmId(null);
    await deleteProductionRecord(id);
    loadProductionData();
  };

  const filteredProductionRecords = useMemo(() => {
    const now = new Date();
    return productionRecords.filter(r => {
      // Date filter
      if (timeFilter !== 'all' && timeFilter !== 'custom') {
        const parts = r.date.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          const d = parseInt(parts[2], 10);
          const dateObj = new Date(y, m, d);

          if (timeFilter === 'today') {
            const isToday =
              dateObj.getDate() === now.getDate() &&
              dateObj.getMonth() === now.getMonth() &&
              dateObj.getFullYear() === now.getFullYear();
            if (!isToday) return false;
          } else if (timeFilter === 'week') {
            const diffDays = (now.getTime() - dateObj.getTime()) / (1000 * 60 * 60 * 24);
            if (diffDays > 7 || diffDays < 0) return false;
          } else if (timeFilter === 'month') {
            if (m !== selectedMonth || y !== selectedYear) return false;
          } else if (timeFilter === 'year') {
            if (y !== selectedYear) return false;
          }
        }
      }

      if (timeFilter === 'custom' && (dateFrom || dateTo)) {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
      }

      // Line filter (Proceso)
      if (lineTypeFilter !== 'all') {
        if (lineTypeFilter === 'reactivo' && r.process !== 'REACTIVO') return false;
        if (lineTypeFilter === 'pigmento' && r.process !== 'PIGMENTO') return false;
      }

      // Search term
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          r.designName.toLowerCase().includes(q) ||
          r.process.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [productionRecords, timeFilter, selectedMonth, selectedYear, dateFrom, dateTo, lineTypeFilter, searchTerm]);

  // Paginación activa para periodos 'all', 'custom' o cuando hay más registros que el límite por página
  const isProductionPagingActive = timeFilter === 'all' || timeFilter === 'custom' || filteredProductionRecords.length > productionPerPage;
  const totalProductionPages = isProductionPagingActive
    ? Math.max(1, Math.ceil(filteredProductionRecords.length / productionPerPage))
    : 1;
  const displayedProductionRecords = isProductionPagingActive
    ? filteredProductionRecords.slice((pageProduction - 1) * productionPerPage, pageProduction * productionPerPage)
    : filteredProductionRecords;

  const totalProductionGolpes = filteredProductionRecords.reduce((acc, r) => acc + getRecordGolpes(r), 0);
  const totalProductionUnits = filteredProductionRecords.reduce((acc, r) => acc + (r.units || 0), 0);
  const totalProductionKg = filteredProductionRecords.reduce((acc, r) => acc + getRecordKg(r), 0);
  const totalReactivoKg = filteredProductionRecords
    .filter(r => r.process === 'REACTIVO')
    .reduce((acc, r) => acc + getRecordKg(r), 0);
  const totalPigmentoKg = filteredProductionRecords
    .filter(r => r.process === 'PIGMENTO')
    .reduce((acc, r) => acc + getRecordKg(r), 0);
  const uniqueDatesCount = new Set(filteredProductionRecords.map(r => r.date)).size;
  const avgKgPerProductionDay = uniqueDatesCount > 0 ? (totalProductionKg / uniqueDatesCount).toFixed(2) : '0';

  const handleExportProductionExcel = () => {
    const currentMonthLabel = timeFilter === 'month'
      ? MONTH_NAMES[selectedMonth].toUpperCase()
      : 'PRODUCCION';

    const rows = filteredProductionRecords.map(r => ({
      'FECHA': formatProductionDate(r.date),
      'DISEÑO': r.designName,
      'TURNO': r.shift,
      'MEDIDA': r.widthM,
      'MEDIDA 2': r.heightM,
      'GR/M2': r.gramaje,
      'PROCESO': r.process,
      'AREA': r.areaM2,
      'PESO UNIDAD (g)': r.unitWeightG,
      'Nº GOLPES': getRecordGolpes(r),
      'UNIDADES': r.units,
      [weightUnit === 'kg' ? 'KLS DIA' : 'GRS DIA']: weightUnit === 'kg' ? getRecordKg(r) : Number((getRecordKg(r) * 1000).toFixed(1))
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, currentMonthLabel);
    XLSX.writeFile(wb, `Reporte_Mensual_Produccion_${currentMonthLabel}_${selectedYear}.xlsx`);
  };

  // Manejo de la tecla Escape (Esc) para cerrar modales y menús rápidamente
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isRecordModalOpen) {
          setIsRecordModalOpen(false);
        } else if (selectedBatch) {
          setSelectedBatch(null);
        } else if (selectedOrderDetails) {
          setSelectedOrderDetails(null);
        } else if (showExportMenu) {
          setShowExportMenu(false);
        } else if (deleteConfirmId) {
          setDeleteConfirmId(null);
        } else if (deleteOrderConfirmId) {
          setDeleteOrderConfirmId(null);
        } else if (deleteRecordConfirmId) {
          setDeleteRecordConfirmId(null);
        }
      }
    };

    const hasModalOpen = !!(selectedBatch || selectedOrderDetails || isRecordModalOpen);
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
  }, [selectedBatch, selectedOrderDetails, isRecordModalOpen, showExportMenu, deleteConfirmId, deleteOrderConfirmId, deleteRecordConfirmId]);

  // Filter batches
  const filteredBatches = useMemo(() => {
    const now = new Date();
    return effectiveBatches.filter(b => {
      // Time filter
      if (timeFilter !== 'all' && timeFilter !== 'custom') {
        if (!b.timestamp) return false;
        const date = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

        if (timeFilter === 'today') {
          const isSameDay =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();
          if (!isSameDay) return false;
        } else if (timeFilter === 'week') {
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (timeFilter === 'month') {
          if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return false;
        } else if (timeFilter === 'year') {
          if (date.getFullYear() !== selectedYear) return false;
        }
      }

      // Custom date range
      if (timeFilter === 'custom' && (dateFrom || dateTo)) {
        if (!b.timestamp) return false;
        const date = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
        if (dateFrom && date < new Date(dateFrom)) return false;
        if (dateTo && date > new Date(dateTo + 'T23:59:59')) return false;
      }

      // Product filter
      if (productFilter !== 'all' && b.productType !== productFilter) return false;

      // Line type filter
      if (lineTypeFilter !== 'all') {
        let inferredLineType: 'pigmento' | 'reactivo' | 'aditivo' = 'pigmento';
        if (b.lineType) {
          const raw = b.lineType.toLowerCase();
          if (raw.includes('aditiv')) inferredLineType = 'aditivo';
          else if (raw.includes('reactiv')) inferredLineType = 'reactivo';
          else if (raw.includes('pigment')) inferredLineType = 'pigmento';
        }

        const codeUpper = (b.pantoneCode || '').toUpperCase();
        const refLower = (b.productReference || '').toLowerCase();
        if (codeUpper.includes('PASTA MADRE') || codeUpper.includes('ADITIVO') || refLower.includes('pasta madre') || isAdditiveComponent(b.pantoneCode, stock)) {
          inferredLineType = 'aditivo';
        } else if (!b.lineType) {
          const p = pantones.find(pant => pant.code === b.pantoneCode);
          const hasReactivo = p?.name.toLowerCase().includes('reactiv') || p?.formulas?.some(f =>
            f.component.toLowerCase().includes('reactiv') ||
            f.description.toLowerCase().includes('reactiv') ||
            f.component.toLowerCase().includes('alginato') ||
            f.description.toLowerCase().includes('alginato')
          );
          inferredLineType = hasReactivo ? 'reactivo' : 'pigmento';
        }

        if (lineTypeFilter === 'aditivo') {
          if (inferredLineType !== 'aditivo') {
            const p = pantones.find(pant => pant.code === b.pantoneCode);
            const hasAdditives = p?.formulas?.some(f => isAdditiveComponent(f.component, stock));
            if (!hasAdditives) return false;
          }
        } else {
          if (inferredLineType !== lineTypeFilter) return false;
        }
      }

      // Log type filter
      if (logTypeFilter === 'preparacion') {
        if (b.type === 'consumo' && !b.id?.startsWith('salida-')) return false;
      } else if (logTypeFilter === 'consumo') {
        if (b.type !== 'consumo' && !b.id?.startsWith('salida-')) return false;
      }

      // Search filter (pantone code, operator, reference)
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches =
          b.pantoneCode.toLowerCase().includes(q) ||
          (b.productReference || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [effectiveBatches, timeFilter, selectedMonth, selectedYear, dateFrom, dateTo, productFilter, lineTypeFilter, searchTerm, logTypeFilter, stock, pantones]);

  const filteredWorkOrders = useMemo(() => {
    const now = new Date();
    return workOrders.filter(w => {
      if (w.status !== 'Completada') return false;

      // Time filter
      if (timeFilter !== 'all' && timeFilter !== 'custom') {
        if (!w.completedAt) return false;
        const date = w.completedAt.toDate ? w.completedAt.toDate() : new Date(w.completedAt);
        const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);

        if (timeFilter === 'today') {
          const isSameDay =
            date.getDate() === now.getDate() &&
            date.getMonth() === now.getMonth() &&
            date.getFullYear() === now.getFullYear();
          if (!isSameDay) return false;
        } else if (timeFilter === 'week') {
          if (diffDays > 7 || diffDays < 0) return false;
        } else if (timeFilter === 'month') {
          if (date.getMonth() !== selectedMonth || date.getFullYear() !== selectedYear) return false;
        } else if (timeFilter === 'year') {
          if (date.getFullYear() !== selectedYear) return false;
        }
      }

      // Custom date range
      if (timeFilter === 'custom' && (dateFrom || dateTo)) {
        if (!w.completedAt) return false;
        const date = w.completedAt.toDate ? w.completedAt.toDate() : new Date(w.completedAt);
        if (dateFrom && date < new Date(dateFrom)) return false;
        if (dateTo && date > new Date(dateTo + 'T23:59:59')) return false;
      }

      // Product filter
      if (productFilter !== 'all' && w.productType !== productFilter) return false;

      // Line type filter
      if (lineTypeFilter !== 'all') {
        if (lineTypeFilter === 'aditivo') {
          const isAdd = (w.designName || '').toLowerCase().includes('pasta madre') ||
            (w.pantoneCode || '').toUpperCase().includes('PASTA MADRE') ||
            (w.productReference || '').toLowerCase().includes('aditivo');
          if (!isAdd) return false;
        } else if (w.lineType !== lineTypeFilter) {
          return false;
        }
      }

      // Search filter
      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches = (w.productReference || '').toLowerCase().includes(q) || (w.designName || '').toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    });
  }, [workOrders, timeFilter, selectedMonth, selectedYear, dateFrom, dateTo, productFilter, lineTypeFilter, searchTerm]);

  const chartBatches = filteredBatches;

  // KPIs
  const kpiBatches = logTypeFilter === 'consumo'
    ? chartBatches.filter(b => b.type === 'consumo' || b.id?.startsWith('salida-'))
    : chartBatches.filter(b => b.type !== 'consumo' || b.id?.startsWith('salida-'));

  const totalGramsMixed = kpiBatches.reduce((acc, b) => acc + b.totalGrammage, 0);
  const totalKgMixed = weightUnit === 'kg' ? (totalGramsMixed / 1000).toFixed(2) : totalGramsMixed.toLocaleString();
  const avgKgPerBatch = kpiBatches.length > 0
    ? (weightUnit === 'kg'
      ? (totalGramsMixed / 1000 / kpiBatches.length).toFixed(2)
      : (totalGramsMixed / kpiBatches.length).toFixed(0))
    : '0';
  const totalPieces = totalProductionUnits > 0
    ? totalProductionUnits
    : filteredWorkOrders.reduce((acc, w) => acc + (w.targetQuantity || 0), 0);
  const numLotesDisplay = kpiBatches.length;
  const inkPerUnitGrams = totalPieces > 0 ? (totalGramsMixed / totalPieces).toFixed(2) : '0.00';
  const inkPerKgTelaGrams = totalProductionKg > 0 ? (totalGramsMixed / totalProductionKg).toFixed(2) : '0.00';

  // Timeline data grouped by day or month
  const timelineDataMap: Record<string, { pantoneWeight: number; inkWeight: number; pieces: number }> = {};
  chartBatches.forEach(b => {
    // Si estamos en 'all', no queremos duplicar sumando tanto preparación como consumo.
    // Usaremos "preparación" como la métrica base para todo si es 'all'.
    if (logTypeFilter === 'all' && b.type === 'consumo' && !b.id?.startsWith('salida-')) return;

    if (!b.timestamp) return;
    const dateObj = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
    const key = (timeFilter === 'year' || timeFilter === 'all')
      ? dateObj.toLocaleDateString('es-ES', { month: 'short', year: 'numeric' })
      : dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
    if (!timelineDataMap[key]) timelineDataMap[key] = { pantoneWeight: 0, inkWeight: 0, pieces: 0 };

    // Para tintas/aditivos, sumamos la cantidad (ya no duplicamos)
    timelineDataMap[key].inkWeight += b.totalGrammage;
    timelineDataMap[key].pantoneWeight += b.totalGrammage;
  });

  const timelineData = Object.entries(timelineDataMap)
    .map(([date, data]) => {
      const w = metricType === 'inks' ? data.inkWeight : data.pantoneWeight;
      return {
        date,
        kg: weightUnit === 'kg' ? Number((w / 1000).toFixed(2)) : w,
        pieces: data.pieces
      };
    });

  // Top Pantones / Inks / Aditivos
  const pantoneConsumption = chartBatches.reduce((acc: Record<string, { weight: number; pieces: number; hex?: string }>, b) => {
    if (logTypeFilter === 'all' && b.type === 'consumo' && !b.id?.startsWith('salida-')) return acc;
    if (!acc[b.pantoneCode]) {
      const p = pantones.find(pant => pant.code === b.pantoneCode);
      acc[b.pantoneCode] = { weight: 0, pieces: 0, hex: p?.hex || b.pantoneHex };
    }
    acc[b.pantoneCode].weight += b.totalGrammage;
    acc[b.pantoneCode].pieces += b.quantity || 0;
    return acc;
  }, {});
  const topPantonesData = Object.entries(pantoneConsumption)
    .map(([code, d]) => ({ code, kg: weightUnit === 'kg' ? Number((d.weight / 1000).toFixed(2)) : d.weight, pieces: d.pieces, hex: d.hex }))
    .sort((a, b) => b.kg - a.kg);

  const inkConsumption = chartBatches.reduce((acc: Record<string, { grams: number; hex?: string; isAdditive?: boolean; category?: string }>, b) => {
    if (logTypeFilter === 'all' && b.type === 'consumo' && !b.id?.startsWith('salida-')) return acc;

    // Desglose especial si es lote de Pasta Madre
    if (b.pantoneCode.toUpperCase().includes('PASTA MADRE')) {
      const pastaComponents = [
        { name: 'Urea (46%)', pct: 7.5, hex: '#f1f5f9' },
        { name: 'Espesante Novaprint TC Ultra', pct: 4.5, hex: '#cbd5e1' },
        { name: 'Bicarbonato de Sodio', pct: 3.5, hex: '#94a3b8' },
        { name: 'Asutol PTR Granos', pct: 1.0, hex: '#64748b' },
      ];
      pastaComponents.forEach(comp => {
        if (lineTypeFilter === 'pigmento') return; // no mostrar en solo pigmentos
        if (!acc[comp.name]) {
          const s = stock.find(item => item.name.toLowerCase().includes(comp.name.toLowerCase().slice(0, 5)) || item.type === comp.name.toLowerCase());
          acc[comp.name] = { grams: 0, hex: s?.hexColor || comp.hex, isAdditive: true, category: 'Aditivo' };
        }
        acc[comp.name].grams += b.totalGrammage * (comp.pct / 100);
      });
      return acc;
    }

    const pantone = pantones.find(p => p.code === b.pantoneCode);
    if (pantone?.formulas && pantone.formulas.length > 0) {
      pantone.formulas.forEach(f => {
        const isAdd = isAdditiveComponent(f.component, stock);
        if (lineTypeFilter === 'aditivo' && !isAdd) return;

        if (!acc[f.component]) {
          const s = findMatchingStockItem(stock, f.component);
          acc[f.component] = {
            grams: 0,
            hex: s?.hexColor || (isAdd ? '#0ea5e9' : undefined),
            isAdditive: isAdd,
            category: isAdd ? 'Aditivo' : 'Tinta'
          };
        }
        acc[f.component].grams += b.totalGrammage * (f.percentage / 100);
      });
    } else {
      const isAdd = isAdditiveComponent(b.pantoneCode, stock);
      if (lineTypeFilter === 'aditivo' && !isAdd) return acc;
      if (lineTypeFilter === 'pigmento' && isAdd) return acc;

      if (!acc[b.pantoneCode]) {
        const s = findMatchingStockItem(stock, b.pantoneCode);
        acc[b.pantoneCode] = {
          grams: 0,
          hex: s?.hexColor || b.pantoneHex || (isAdd ? '#0ea5e9' : undefined),
          isAdditive: isAdd,
          category: isAdd ? 'Aditivo' : 'Tinta'
        };
      }
      acc[b.pantoneCode].grams += b.totalGrammage;
    }
    return acc;
  }, {});

  const topInksData = Object.entries(inkConsumption)
    .map(([code, data]) => ({
      code,
      kg: weightUnit === 'kg' ? Number((data.grams / 1000).toFixed(2)) : data.grams,
      pieces: 0,
      hex: data.hex,
      isAdditive: data.isAdditive,
      category: data.category
    }))
    .sort((a, b) => b.kg - a.kg);

  const displayBarData = metricType === 'inks' ? topInksData : topPantonesData;

  // ── Datos para las gráficas mejoradas de tintas ──
  const inferBatchLineType = (b: BatchLog): 'pigmento' | 'reactivo' | 'aditivo' => {
    const codeUpper = (b.pantoneCode || '').toUpperCase();
    const refLower = (b.productReference || '').toLowerCase();
    if (codeUpper.includes('PASTA MADRE') || codeUpper.includes('ADITIVO') || refLower.includes('pasta madre') || isAdditiveComponent(b.pantoneCode, stock)) {
      return 'aditivo';
    }
    if (b.lineType) {
      const raw = b.lineType.toLowerCase();
      if (raw.includes('aditiv')) return 'aditivo';
      if (raw.includes('reactiv')) return 'reactivo';
      return 'pigmento';
    }
    const p = pantones.find(pant => pant.code === b.pantoneCode);
    const hasReactivo = p?.name.toLowerCase().includes('reactiv') || p?.formulas?.some(f =>
      f.component.toLowerCase().includes('reactiv') ||
      f.description.toLowerCase().includes('reactiv') ||
      f.component.toLowerCase().includes('alginato') ||
      f.description.toLowerCase().includes('alginato')
    );
    return hasReactivo ? 'reactivo' : 'pigmento';
  };

  const inkToUnit = (grams: number) => weightUnit === 'kg' ? Number((grams / 1000).toFixed(2)) : Math.round(grams);
  const inkGroupByMonth = timeFilter === 'year' || timeFilter === 'all';
  const inkBatchDate = (b: BatchLog): Date | null => {
    if (!b.timestamp) return null;
    const d = b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp);
    return isNaN(d.getTime()) ? null : d;
  };
  const inkBucketKey = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return inkGroupByMonth ? `${y}-${m}` : `${y}-${m}-${dd}`;
  };
  const inkBucketLabel = (d: Date) => inkGroupByMonth
    ? `${MONTH_NAMES[d.getMonth()].slice(0, 3)} ${String(d.getFullYear()).slice(2)}`
    : `${d.getDate()}-${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;

  // Mapa de producción por fecha para correlacionar con las tintas
  const productionBucketMap = new Map<string, { units: number; golpes: number; kgTela: number }>();
  filteredProductionRecords.forEach(r => {
    const parts = r.date.split('-');
    if (parts.length === 3) {
      const y = parts[0];
      const m = parts[1];
      const d = parts[2];
      const key = inkGroupByMonth ? `${y}-${m}` : `${y}-${m}-${d}`;
      const curr = productionBucketMap.get(key) || { units: 0, golpes: 0, kgTela: 0 };
      curr.units += r.units || 0;
      curr.golpes += getRecordGolpes(r);
      curr.kgTela += getRecordKg(r);
      productionBucketMap.set(key, curr);
    }
  });

  const inkTimelineMap = new Map<string, { label: string; Pigmento: number; Reactivo: number; Aditivo: number }>();
  const inkComparisonMap = new Map<string, { label: string; Preparado: number; Consumido: number }>();
  const pantoneLots: Record<string, number> = {};
  chartBatches.forEach(b => {
    const d = inkBatchDate(b);
    if (!d) return;
    const key = inkBucketKey(d);
    const label = inkBucketLabel(d);

    const cmp = inkComparisonMap.get(key) || { label, Preparado: 0, Consumido: 0 };
    if (b.type === 'consumo') cmp.Consumido += b.totalGrammage; else cmp.Preparado += b.totalGrammage;
    inkComparisonMap.set(key, cmp);

    if (logTypeFilter === 'all' && b.type === 'consumo' && !b.id?.startsWith('salida-')) return;
    const lt = inferBatchLineType(b);
    const entry = inkTimelineMap.get(key) || { label, Pigmento: 0, Reactivo: 0, Aditivo: 0 };
    if (lt === 'reactivo') entry.Reactivo += b.totalGrammage;
    else if (lt === 'aditivo') entry.Aditivo += b.totalGrammage;
    else entry.Pigmento += b.totalGrammage;
    inkTimelineMap.set(key, entry);
    pantoneLots[b.pantoneCode] = (pantoneLots[b.pantoneCode] || 0) + 1;
  });

  // Asegurar que días con producción también aparezcan en la gráfica
  productionBucketMap.forEach((_, key) => {
    if (!inkTimelineMap.has(key)) {
      const parts = key.split('-');
      let label = key;
      if (parts.length === 3) {
        const dObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        label = `${dObj.getDate()}-${MONTH_NAMES[dObj.getMonth()].slice(0, 3)}`;
      } else if (parts.length === 2) {
        label = `${MONTH_NAMES[parseInt(parts[1], 10) - 1].slice(0, 3)} ${parts[0].slice(2)}`;
      }
      inkTimelineMap.set(key, { label, Pigmento: 0, Reactivo: 0, Aditivo: 0 });
    }
  });

  let inkAccumulated = 0;
  const inkTimeline = Array.from(inkTimelineMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, e]) => {
      const prod = productionBucketMap.get(key) || { units: 0, golpes: 0, kgTela: 0 };
      const dayInk = e.Pigmento + e.Reactivo + e.Aditivo;
      inkAccumulated += dayInk;
      return {
        label: e.label,
        Pigmento: inkToUnit(e.Pigmento),
        Reactivo: inkToUnit(e.Reactivo),
        Aditivo: inkToUnit(e.Aditivo),
        acumulado: inkToUnit(inkAccumulated),
        unidades: prod.units,
        golpes: prod.golpes,
        kgTela: Number(prod.kgTela.toFixed(2)),
        rendimientoGPorPrenda: prod.units > 0 ? Number(((dayInk) / prod.units).toFixed(2)) : 0,
      };
    });
  const inkComparison = Array.from(inkComparisonMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, e]) => ({ label: e.label, Preparado: inkToUnit(e.Preparado), Consumido: inkToUnit(e.Consumido) }));
  const pantoneChartData = topPantonesData.map(p => ({ code: p.code, kg: p.kg, hex: p.hex, lots: pantoneLots[p.code] || 0 }));

  const totalWasteGrams = kpiBatches.reduce((acc, b) => acc + (b.wasteGrams || 0), 0);
  const wastePct = totalGramsMixed > 0 ? ((totalWasteGrams / totalGramsMixed) * 100).toFixed(1) : '0';
  const totalWasteDisplay = weightUnit === 'kg' ? (totalWasteGrams / 1000).toFixed(2) : totalWasteGrams.toLocaleString();

  // CSV export
  const handleExportCSV = () => {
    const header = ['Código Pantone', 'Producto', 'Referencia', 'Mezcla (g)', 'Piezas', 'Operario', 'Fecha', 'Estado'];
    const rows = filteredBatches.map(b => {
      const dateStr = b.timestamp
        ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)).toLocaleDateString('es-ES')
        : '';
      return [
        b.pantoneCode,
        b.productType,
        b.productReference || '',
        b.totalGrammage,
        b.type === 'consumo' ? (b.quantity || 0) : '',
        b.operator,
        dateStr,
        b.status
      ].join(',');
    });
    const csv = [header.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `historial_lotes_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // ── EXCEL EXPORT ──
  const handleExportExcel = () => {
    const dateLabel = new Date().toISOString().slice(0, 10);

    // Sheet 1: Lotes detallados
    const lotsRows = filteredBatches.map(b => {
      const d = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : null;
      return {
        'Código Pantone': b.pantoneCode,
        'Producto': b.productType,
        'Referencia': b.productReference || '',
        'Mezcla (g)': b.totalGrammage,
        'Piezas': b.type === 'consumo' ? (b.quantity || 0) : '',
        'Merma (g)': b.wasteGrams ?? '',
        'Operario': b.operator,
        'Fecha': d ? d.toLocaleDateString('es-ES') : '',
        'Estado': b.status,
      };
    });

    // Sheet 2: Consumo por ingrediente y aditivos (para reabastecimiento)
    const inkMap: Record<string, number> = {};
    filteredBatches.forEach(b => {
      if (b.pantoneCode.toUpperCase().includes('PASTA MADRE')) {
        const pastaComponents = [
          { name: 'Urea (46%)', pct: 7.5 },
          { name: 'Espesante Novaprint TC Ultra', pct: 4.5 },
          { name: 'Bicarbonato de Sodio', pct: 3.5 },
          { name: 'Asutol PTR Granos', pct: 1.0 },
        ];
        pastaComponents.forEach(comp => {
          if (!inkMap[comp.name]) inkMap[comp.name] = 0;
          inkMap[comp.name] += b.totalGrammage * (comp.pct / 100);
        });
        return;
      }

      const p = pantones.find(p => p.code === b.pantoneCode);
      if (p?.formulas && p.formulas.length > 0) {
        p.formulas.forEach(f => {
          if (!inkMap[f.component]) inkMap[f.component] = 0;
          inkMap[f.component] += b.totalGrammage * (f.percentage / 100);
        });
      } else {
        if (!inkMap[b.pantoneCode]) inkMap[b.pantoneCode] = 0;
        inkMap[b.pantoneCode] += b.totalGrammage;
      }
    });
    const inkRows = Object.entries(inkMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, grams]) => ({
        'Insumo / Aditivo / Tinta': name,
        'Tipo': isAdditiveComponent(name, stock) ? 'Aditivo / Auxiliar' : 'Tinta / Colorante',
        'Consumo (g)': Math.round(grams),
        'Consumo (kg)': (grams / 1000).toFixed(3)
      }));

    // Sheet 3: Consumo por Pantone / Lote
    const pantoneMap: Record<string, { kg: number; pieces: number }> = {};
    filteredBatches.forEach(b => {
      if (!pantoneMap[b.pantoneCode]) pantoneMap[b.pantoneCode] = { kg: 0, pieces: 0 };
      pantoneMap[b.pantoneCode].kg += b.totalGrammage;
      pantoneMap[b.pantoneCode].pieces += b.type === 'consumo' ? (b.quantity || 0) : 0;
    });
    const pantoneRows = Object.entries(pantoneMap)
      .sort((a, b) => b[1].kg - a[1].kg)
      .map(([code, d]) => ({ 'Pantone / Producto': code, 'Consumo (g)': Math.round(d.kg), 'Consumo (kg)': (d.kg / 1000).toFixed(3), 'Piezas': d.pieces }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lotsRows), 'Lotes');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(inkRows), 'Consumo Insumos y Aditivos');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pantoneRows), 'Consumo por Pantone');
    XLSX.writeFile(wb, `reporte_consumos_${dateLabel}.xlsx`);
  };

  // ── PDF EXPORT ──
  const handleExportPDF = () => {
    const dateLabel = new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTEX — Reporte de Consumos e Insumos', 14, 18);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Generado: ${dateLabel}   ·   Lotes mostrados: ${filteredBatches.length}   ·   Total mezclado: ${(filteredBatches.reduce((a, b) => a + b.totalGrammage, 0) / 1000).toFixed(2)} kg`, 14, 25);

    // Table 1: Consumo por ingrediente
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Consumo por Insumo, Tinta y Aditivo (para reabastecimiento)', 14, 35);

    const inkMap2: Record<string, number> = {};
    filteredBatches.forEach(b => {
      if (b.pantoneCode.toUpperCase().includes('PASTA MADRE')) {
        const pastaComponents = [
          { name: 'Urea (46%)', pct: 7.5 },
          { name: 'Espesante Novaprint TC Ultra', pct: 4.5 },
          { name: 'Bicarbonato de Sodio', pct: 3.5 },
          { name: 'Asutol PTR Granos', pct: 1.0 },
        ];
        pastaComponents.forEach(comp => {
          if (!inkMap2[comp.name]) inkMap2[comp.name] = 0;
          inkMap2[comp.name] += b.totalGrammage * (comp.pct / 100);
        });
        return;
      }

      const p = pantones.find(p => p.code === b.pantoneCode);
      if (p?.formulas && p.formulas.length > 0) {
        p.formulas.forEach(f => {
          if (!inkMap2[f.component]) inkMap2[f.component] = 0;
          inkMap2[f.component] += b.totalGrammage * (f.percentage / 100);
        });
      } else {
        if (!inkMap2[b.pantoneCode]) inkMap2[b.pantoneCode] = 0;
        inkMap2[b.pantoneCode] += b.totalGrammage;
      }
    });
    const inkTableData = Object.entries(inkMap2)
      .sort((a, b) => b[1] - a[1])
      .map(([name, grams]) => [
        name,
        isAdditiveComponent(name, stock) ? 'Aditivo / Auxiliar' : 'Tinta / Colorante',
        `${Math.round(grams).toLocaleString()} g`,
        `${(grams / 1000).toFixed(3)} kg`
      ]);

    autoTable(doc, {
      startY: 38,
      head: [['Insumo / Aditivo / Tinta', 'Clase', 'Consumo (g)', 'Consumo (kg)']],
      body: inkTableData,
      theme: 'striped',
      headStyles: { fillColor: [14, 165, 233] },
      styles: { fontSize: 9 },
    });

    // Table 2: Lotes
    const afterInk = (doc as any).lastAutoTable?.finalY ?? 100;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('Detalle de Lotes', 14, afterInk + 10);

    const lotsData = filteredBatches.map(b => {
      const d = b.timestamp ? (b.timestamp.toDate ? b.timestamp.toDate() : new Date(b.timestamp)) : null;
      return [
        b.pantoneCode,
        b.productType,
        b.productReference || '—',
        `${b.totalGrammage}g`,
        b.type === 'consumo' && b.quantity ? `${b.quantity}` : '—',
        b.wasteGrams ? `${b.wasteGrams}g` : '—',
        b.operator,
        d ? d.toLocaleDateString('es-ES') : '',
        b.status,
      ];
    });

    autoTable(doc, {
      startY: afterInk + 13,
      head: [['Pantone', 'Producto', 'Referencia', 'Mezcla', 'Piezas', 'Merma', 'Operario', 'Fecha', 'Estado']],
      body: lotsData,
      theme: 'striped',
      headStyles: { fillColor: [99, 102, 241] },
      styles: { fontSize: 8 },
    });

    doc.save(`reporte_consumos_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const hasActiveFilters = searchTerm || productFilter !== 'all' || lineTypeFilter !== 'all' || timeFilter !== 'all';

  const clearFilters = () => {
    setSearchTerm('');
    setProductFilter('all');
    setLineTypeFilter('all');
    setTimeFilter('all');
    setDateFrom('');
    setDateTo('');
  };

  const renderTable = (
    title: string,
    data: BatchLog[],
    emptyMsg: string,
    currentPage: number,
    setPage: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const itemsPerPage = 5;
    const totalPages = Math.max(1, Math.ceil(data.length / itemsPerPage));
    const validPage = Math.min(Math.max(1, currentPage), totalPages);
    const startIndex = (validPage - 1) * itemsPerPage;
    const currentData = data.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="bg-white rounded-2xl sm:rounded-3xl border border-slate-200 p-3.5 sm:p-6 shadow-sm shrink-0">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-md font-bold text-slate-800">{title}</h3>
          <span className="text-xs font-bold text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
            {data.length} Lotes
          </span>
        </div>

        <div className="overflow-x-auto">
          {data.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-slate-400 text-center">
              <Filter className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-sm font-medium">{emptyMsg}</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] text-slate-400 uppercase tracking-widest">
                  <th className="py-2.5 px-4 font-semibold sticky top-0 bg-white z-10">Tono Pantone</th>
                  <th className="py-2.5 px-4 font-semibold sticky top-0 bg-white z-10">Orden de Trabajo</th>
                  <th className="py-2.5 px-4 font-semibold sticky top-0 bg-white z-10">Tipo</th>
                  <th className="py-2.5 px-4 font-semibold sticky top-0 bg-white z-10">Producto</th>
                  <th className="py-2.5 px-4 font-semibold text-right sticky top-0 bg-white z-10">Cantidad (g)</th>
                  <th className="py-2.5 px-4 font-semibold text-right sticky top-0 bg-white z-10">Piezas</th>
                  <th className="py-2.5 px-4 font-semibold sticky top-0 bg-white z-10">Fecha y Hora</th>
                  <th className="py-2.5 px-4 font-semibold text-center sticky top-0 bg-white z-10">Estado</th>
                  <th className="py-2.5 px-4 font-semibold text-center sticky top-0 bg-white z-10">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 text-xs">
                {currentData.map(batch => {
                  let dateStr = 'Reciente';
                  let timeStr = '';
                  const rawDate = batch.fecha_hora_registro || batch.timestamp;
                  if (rawDate) {
                    const d = rawDate.toDate ? rawDate.toDate() : new Date(rawDate);
                    dateStr = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });
                    timeStr = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                  }
                  const orderId = batch.orden_id || batch.workOrderId;
                  const linkedOrder = orderId ? workOrders?.find(o => o.id === orderId) : undefined;

                  return (
                    <tr
                      key={batch.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedBatch(batch)}
                    >
                      {/* Pantone */}
                      <td className="py-3 px-4 font-bold text-slate-800">
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-slate-200 shadow-sm shrink-0" style={{ backgroundColor: batch.pantoneHex }} />
                          <div className="flex flex-col">
                            <span>{batch.color_codigo || batch.pantoneCode}</span>
                            {batch.id_mezcla && (
                              <span className="text-[9px] font-mono text-slate-400 font-normal">{batch.id_mezcla}</span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Orden de Trabajo */}
                      <td className="py-3 px-4" onClick={e => e.stopPropagation()}>
                        {orderId ? (
                          <button
                            type="button"
                            onClick={() => {
                              if (linkedOrder) {
                                setSelectedOrderDetails(linkedOrder);
                              } else {
                                setSelectedBatch(batch);
                              }
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold font-mono bg-blue-50 text-blue-700 hover:bg-blue-100 hover:text-blue-900 border border-blue-200 transition-colors shadow-2xs cursor-pointer group"
                            title={linkedOrder ? `Ver Orden ${orderId} (${linkedOrder.designName || linkedOrder.productReference || 'Ver detalles'})` : `Orden de Trabajo ${orderId}`}
                          >
                            <span>{orderId}</span>
                            <ExternalLink className="w-3 h-3 text-blue-400 group-hover:text-blue-600 shrink-0" />
                          </button>
                        ) : (
                          <span className="text-slate-300 text-xs italic font-medium">—</span>
                        )}
                      </td>

                      {/* Tipo */}
                      <td className="py-3 px-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${batch.type === 'consumo' ? 'bg-orange-50 text-orange-700 border-orange-100' : 'bg-indigo-50 text-indigo-700 border-indigo-100'
                          }`}>
                          {batch.type === 'consumo' ? 'Consumo' : 'Mezcla'}
                        </span>
                      </td>

                      {/* Producto */}
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${batch.productType === 'Toallas' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                            {batch.productType}
                          </span>
                          {batch.productReference && (
                            <span className="text-[10px] text-slate-400 font-medium mt-0.5 ml-0.5">
                              {batch.productReference}
                            </span>
                          )}
                          {batch.lineType && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${batch.lineType === 'reactivo'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-blue-50 text-blue-700'
                              }`}>
                              {batch.lineType === 'reactivo' ? 'Reactivo' : 'Pigmentos'}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-700">{batch.totalGrammage.toLocaleString()}g</td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-500">{(batch.type === 'consumo' && batch.quantity) ? batch.quantity.toLocaleString() : '-'}</td>
                      
                      {/* Fecha y Hora */}
                      <td className="py-3 px-4 text-slate-500 font-medium whitespace-nowrap">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-slate-700 font-semibold">
                            <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>{dateStr}</span>
                          </div>
                          {timeStr && (
                            <div className="flex items-center gap-1.5 text-[10px] text-slate-400 font-mono">
                              <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                              <span>{timeStr}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        <StatusBadge status={batch.estado || batch.status} />
                      </td>

                      {/* Acciones */}
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedBatch(batch)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Ver detalle"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {deleteConfirmId === batch.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  const idToDelete = batch.id!;
                                  setDeletedBatchIds(prev => {
                                    const next = new Set(prev);
                                    next.add(idToDelete);
                                    return next;
                                  });
                                  setDeleteConfirmId(null);
                                  onDeleteBatch(idToDelete);
                                }}
                                className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                              >Sí</button>
                              <button
                                onClick={() => setDeleteConfirmId(null)}
                                className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200"
                              >No</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirmId(batch.id!)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Eliminar lote"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data.length > 0 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
            <p className="text-xs text-slate-500 font-medium">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, data.length)} de {data.length}
            </p>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderConsumoTable = (
    title: string,
    data: WorkOrder[],
    emptyMessage: string,
    currentPage: number,
    setPage: React.Dispatch<React.SetStateAction<number>>
  ) => {
    const itemsPerPage = 5;
    const totalPages = Math.ceil(data.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const paginatedData = data.slice(startIndex, startIndex + itemsPerPage);

    return (
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <h3 className="font-bold text-slate-800 text-sm">{title}</h3>
          <span className="bg-blue-50 text-blue-700 text-[10px] font-bold px-2.5 py-1 rounded-lg border border-blue-100">
            {data.length} Órdenes Finalizadas
          </span>
        </div>

        <div className="overflow-x-auto">
          {data.length === 0 ? (
            <div className="p-8 text-center text-slate-500 font-medium text-sm flex flex-col items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100 mb-2">
                <History className="w-6 h-6 text-slate-300" />
              </div>
              {emptyMessage}
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-3 px-4 w-[25%]">Referencia</th>
                  <th className="py-3 px-4 w-[20%]">Producto</th>
                  <th className="py-3 px-4 w-[15%] text-right">Piezas Totales</th>
                  <th className="py-3 px-4 w-[20%]">Fecha Finalizada</th>
                  <th className="py-3 px-4 w-[20%] text-center">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100/80">
                {paginatedData.map((order, index) => {
                  const dateObj = order.completedAt?.toDate ? order.completedAt.toDate() : new Date(order.completedAt);
                  const dateStr = dateObj.toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' });

                  return (
                    <tr
                      key={order.id || index}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => setSelectedOrderDetails(order)}
                    >
                      <td className="py-3 px-4 font-bold text-slate-800">
                        {order.designId ? (
                          <div className="flex flex-col gap-0.5">
                            <span>{order.designName || 'Diseño Multi-color'}</span>
                            {order.productReference && <span className="text-[10px] text-slate-500 font-medium">{order.productReference}</span>}
                          </div>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span>{order.pantoneCode || 'Color Único'}</span>
                            {order.productReference && <span className="text-[10px] text-slate-500 font-medium">{order.productReference}</span>}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex flex-col gap-0.5 items-start">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${order.productType === 'Toallas' ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700'}`}>
                            {order.productType}
                          </span>
                          {order.lineType && (
                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold mt-0.5 ${order.lineType === 'reactivo'
                                ? 'bg-violet-50 text-violet-700'
                                : 'bg-blue-50 text-blue-700'
                              }`}>
                              {order.lineType === 'reactivo' ? 'Reactivo' : 'Pigmentos'}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">{order.targetQuantity?.toLocaleString() || '-'}</td>
                      <td className="py-3 px-4 text-slate-400 font-medium whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Calendar className="w-3.5 h-3.5" />
                          {dateStr}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => setSelectedOrderDetails(order)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors inline-flex items-center justify-center"
                            title="Ver detalles de consumo"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                          {onDeleteWorkOrder && (
                            deleteOrderConfirmId === order.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={async () => {
                                    if (order.id) {
                                      await onDeleteWorkOrder(order.id);
                                      setDeleteOrderConfirmId(null);
                                      if (selectedOrderDetails?.id === order.id) {
                                        setSelectedOrderDetails(null);
                                      }
                                    }
                                  }}
                                  className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg hover:bg-red-100"
                                >Sí</button>
                                <button
                                  onClick={() => setDeleteOrderConfirmId(null)}
                                  className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded-lg hover:bg-slate-200"
                                >No</button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setDeleteOrderConfirmId(order.id || null)}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors inline-flex items-center justify-center"
                                title="Eliminar orden completada"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {data.length > 0 && (
          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100 px-4 pb-4">
            <p className="text-xs text-slate-500 font-medium">
              Mostrando {startIndex + 1} a {Math.min(startIndex + itemsPerPage, data.length)} de {data.length}
            </p>
            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-xs font-bold text-slate-700 px-3">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-50 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-5 h-full flex flex-col overflow-y-auto custom-scrollbar pr-2 pb-8" id="batches-history-view">

      {/* ── SELECTOR DE VISTA DEL DASHBOARD ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200 shadow-xs shrink-0">
        <div className="flex bg-slate-100/90 p-1 rounded-2xl gap-1 overflow-x-auto max-w-full border border-slate-200/60 scrollbar-none [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setActiveDashboardTab('daily_golpes')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeDashboardTab === 'daily_golpes'
                ? 'bg-white text-sky-800 font-black shadow-xs'
                : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Calendar className={`w-3.5 h-3.5 ${activeDashboardTab === 'daily_golpes' ? 'text-sky-600' : 'text-slate-400'}`} />
            Reporte Diario
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardTab('production_sheet')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeDashboardTab === 'production_sheet'
                ? 'bg-white text-blue-800 font-black shadow-xs'
                : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Table className={`w-3.5 h-3.5 ${activeDashboardTab === 'production_sheet' ? 'text-blue-600' : 'text-slate-400'}`} />
            Planilla
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardTab('production_charts')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeDashboardTab === 'production_charts'
                ? 'bg-white text-emerald-800 font-black shadow-xs'
                : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <Layers className={`w-3.5 h-3.5 ${activeDashboardTab === 'production_charts' ? 'text-emerald-600' : 'text-slate-400'}`} />
            Producción
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardTab('analytics')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeDashboardTab === 'analytics'
                ? 'bg-white text-indigo-800 font-black shadow-xs'
                : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <TrendingUp className={`w-3.5 h-3.5 ${activeDashboardTab === 'analytics' ? 'text-indigo-600' : 'text-slate-400'}`} />
            Consumo
          </button>
          <button
            type="button"
            onClick={() => setActiveDashboardTab('segundas')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs transition-all cursor-pointer whitespace-nowrap shrink-0 ${activeDashboardTab === 'segundas'
                ? 'bg-white text-rose-800 font-black shadow-xs'
                : 'text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-200/50'
              }`}
          >
            <ShieldAlert className={`w-3.5 h-3.5 ${activeDashboardTab === 'segundas' ? 'text-rose-600' : 'text-slate-400'}`} />
            Segundas
          </button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS (EXCLUSIVA PARA CONSUMO / ANALYTICS) ── */}
      {activeDashboardTab === 'analytics' && (
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3 shrink-0">
          {/* Fila 1: Título, Lotes KPI, Limpiar y Menú Exportar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center shadow-xs shrink-0">
                <TrendingUp className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  Consumo de Tintas
                  <span className="text-[10px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                    {numLotesDisplay} lotes
                  </span>
                </h2>
                <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                  Balance de formulaciones, correlación con producción y métricas de insumos
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 ml-auto">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200/80 px-2.5 py-1.5 rounded-xl transition-colors cursor-pointer"
                  title="Restablecer filtros"
                >
                  <X className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Limpiar filtros</span>
                  <span className="sm:hidden">Limpiar</span>
                </button>
              )}

              {/* Menú exportar */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 px-3 py-1.5 rounded-xl hover:bg-slate-50 transition-colors shadow-2xs cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>Exportar</span>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} />
                </button>

                {showExportMenu && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setShowExportMenu(false)}
                    />
                    <div className="absolute right-0 top-full mt-1.5 w-48 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden py-1">
                      <button
                        onClick={() => { handleExportCSV(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left cursor-pointer"
                      >
                        <Download className="w-4 h-4 text-slate-400" /> Archivo CSV
                      </button>
                      <button
                        onClick={() => { handleExportExcel(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-emerald-700 hover:bg-emerald-50 transition-colors text-left cursor-pointer"
                      >
                        <Table className="w-4 h-4 text-emerald-500" /> Libro de Excel
                      </button>
                      <button
                        onClick={() => { handleExportPDF(); setShowExportMenu(false); }}
                        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 transition-colors text-left border-t border-slate-100 cursor-pointer"
                      >
                        <FileText className="w-4 h-4 text-red-500" /> Reporte PDF
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Fila 2: Selectores compactos y chips de período */}
          <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Mes navigator */}
              {timeFilter === 'month' && (
                <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={handlePrevMonth}
                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Mes anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-2 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1">
                    <span>{MONTH_NAMES[selectedMonth]}</span>
                    <span className="text-slate-400 font-semibold">{selectedYear}</span>
                  </div>
                  <button
                    type="button"
                    onClick={handleNextMonth}
                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Mes siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Año navigator */}
              {timeFilter === 'year' && (
                <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setSelectedYear(y => y - 1)}
                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Año anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <div className="px-2 py-0.5 text-xs font-black text-slate-800">
                    <span>{selectedYear}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedYear(y => y + 1)}
                    className="p-1 text-slate-500 hover:text-indigo-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                    title="Año siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Period chips */}
              <div className="flex items-center gap-0.5 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                {[
                  { id: 'month', label: 'Mes' },
                  { id: 'year', label: 'Año' },
                  { id: 'week', label: '7 Días' },
                  { id: 'all', label: 'Todo' },
                  { id: 'custom', label: 'Rango' },
                ].map(f => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setTimeFilter(f.id as TimeFilter)}
                    className={`px-2 sm:px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                      timeFilter === f.id
                        ? 'bg-white text-indigo-700 shadow-2xs font-black'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Selector Operación */}
              <select
                value={logTypeFilter}
                onChange={(e) => setLogTypeFilter(e.target.value as any)}
                className="bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
              >
                <option value="all">Todas Operaciones</option>
                <option value="preparacion">Solo Mezclas</option>
                <option value="consumo">Solo Consumo</option>
              </select>

              {/* Selector Línea */}
              <select
                value={lineTypeFilter}
                onChange={e => setLineTypeFilter(e.target.value as any)}
                className="bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
              >
                <option value="all">Todas las Líneas</option>
                <option value="pigmento">Solo Pigmentos</option>
                <option value="reactivo">Solo Reactivos</option>
                <option value="aditivo">Solo Aditivos</option>
              </select>

              {/* Selector Producto */}
              <select
                value={productFilter}
                onChange={e => setProductFilter(e.target.value as any)}
                className="bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
              >
                <option value="all">Todo producto</option>
                <option value="Toallas">Toallas</option>
              </select>

              {/* Toggle Kg / Gramos */}
              <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-[11px] font-bold">
                <button
                  type="button"
                  onClick={() => setWeightUnit('kg')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${weightUnit === 'kg' ? 'bg-white text-slate-800 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Kg
                </button>
                <button
                  type="button"
                  onClick={() => setWeightUnit('g')}
                  className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${weightUnit === 'g' ? 'bg-white text-slate-800 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  Gramos
                </button>
              </div>
            </div>

            {/* Buscador */}
            <div className="relative flex-1 min-w-[170px] max-w-xs">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                placeholder="Buscar Pantone, ref u operario..."
                className="w-full pl-8 pr-7 py-1 bg-slate-50 border border-slate-200/80 rounded-xl text-xs font-medium text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all shadow-2xs"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Fila 3: Rango de fecha personalizado */}
          {timeFilter === 'custom' && (
            <div className="flex flex-wrap items-center gap-2.5 pt-2.5 border-t border-slate-100 bg-slate-50/70 p-2.5 rounded-xl border border-slate-200/60">
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Desde</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-indigo-400 focus:outline-none shadow-2xs"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Hasta</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold focus:ring-2 focus:ring-indigo-400 focus:outline-none shadow-2xs"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA 0: REPORTE DIARIO DE GOLPES (TAREAS DIARIAS) ── */}
      {activeDashboardTab === 'daily_golpes' && (
        <DailyProductionTasks
          designs={designs}
          workOrders={workOrders}
          weightUnit={weightUnit}
          onNavigateToMonthlySheet={() => setActiveDashboardTab('production_sheet')}
        />
      )}

      {/* ── VISTA 1: PLANILLA DIARIA DE PRODUCCIÓN (KILOS DE TELA) ── */}
      {activeDashboardTab === 'production_sheet' && (
        <div className="space-y-4">

          {/* ── CONTROLES Y FILTROS DEDICADOS DE PLANILLA ── */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center shadow-xs">
                  <Table className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Planilla de Producción
                    <span className="text-[10px] font-extrabold text-amber-800 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 hidden sm:inline-block">
                      {filteredProductionRecords.length} {filteredProductionRecords.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                    Kilos de tela procesada, golpes y especificaciones técnicas por turno
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Botón Excel */}
                <button
                  type="button"
                  onClick={handleExportProductionExcel}
                  className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-xl transition-colors shadow-2xs cursor-pointer"
                  title="Descargar archivo Excel con este formato"
                >
                  <Download className="w-3.5 h-3.5 text-emerald-600" />
                  <span className="hidden sm:inline">Descargar</span> Excel
                </button>

                {/* Botón Nuevo Registro */}
                <button
                  type="button"
                  onClick={handleOpenAddRecord}
                  className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm shadow-blue-600/20 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo Registro</span>
                </button>
              </div>
            </div>

            {/* Fila 2: Navegación de Fecha, Chips de Período, Proceso, Unidad de Peso y Búsqueda */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Mes anterior / actual / siguiente */}
                {timeFilter === 'month' && (
                  <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="Mes anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-2 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>{MONTH_NAMES[selectedMonth]}</span>
                      <span className="text-slate-400 font-semibold">{selectedYear}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="Mes siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Period chips */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                  {[
                    { id: 'month', label: 'Mes' },
                    { id: 'year', label: 'Año' },
                    { id: 'all', label: 'Todo' },
                    { id: 'custom', label: 'Rango' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTimeFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        timeFilter === f.id
                          ? 'bg-white text-blue-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Filtro Proceso (Reactivo / Pigmento) */}
                <select
                  value={lineTypeFilter}
                  onChange={e => setLineTypeFilter(e.target.value as any)}
                  className="bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
                >
                  <option value="all">Todo proceso</option>
                  <option value="reactivo">Solo Reactivos</option>
                  <option value="pigmento">Solo Pigmentos</option>
                </select>

                {/* Toggle Kg / Gramos */}
                <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setWeightUnit('kg')}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${weightUnit === 'kg' ? 'bg-white text-slate-800 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightUnit('g')}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${weightUnit === 'g' ? 'bg-white text-slate-800 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Gramos
                  </button>
                </div>
              </div>

              {/* Buscador */}
              <div className="relative flex-1 min-w-[170px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Buscar diseño o proceso..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Fila contextual para fecha personalizada o año */}
            {timeFilter === 'custom' && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Rango:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold"
                />
              </div>
            )}

            {timeFilter === 'year' && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Año a consultar:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {/* ── KPI CARDS DE PRODUCCIÓN MODERNAS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/80">
                <Table className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">
                  {weightUnit === 'kg' ? 'Kilos Totales' : 'Gramos Totales'}
                </p>
                <p className="text-lg sm:text-2xl font-black text-amber-950 font-mono tracking-tight">
                  {weightUnit === 'kg'
                    ? `${totalProductionKg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
                    : `${(totalProductionKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
                </p>
                <p className="text-[9px] text-amber-600/80 font-medium truncate">Tela procesada en taller</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/80">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Unidades</p>
                <p className="text-lg sm:text-2xl font-black text-blue-700 font-mono tracking-tight">
                  {totalProductionUnits.toLocaleString()} <span className="text-xs font-bold text-blue-500">pz</span>
                </p>
                <p className="text-[9px] text-blue-600/80 font-medium truncate">Prendas estampadas</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Reactivo</p>
                <p className="text-lg sm:text-2xl font-black text-purple-900 font-mono tracking-tight">
                  {weightUnit === 'kg'
                    ? `${totalReactivoKg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
                    : `${(totalReactivoKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
                </p>
                <p className="text-[9px] text-purple-600/80 font-medium truncate">Línea Reactivos</p>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center shrink-0 border border-orange-100/80">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Pigmento</p>
                <p className="text-lg sm:text-2xl font-black text-orange-900 font-mono tracking-tight">
                  {weightUnit === 'kg'
                    ? `${totalPigmentoKg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
                    : `${(totalPigmentoKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
                </p>
                <p className="text-[9px] text-orange-600/80 font-medium truncate">Línea Pigmentos</p>
              </div>
            </div>
          </div>

          {/* ── CONTENEDOR PRINCIPAL DE REGISTROS ── */}
          <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden flex flex-col">
            <div className="p-3 sm:p-4 border-b border-slate-100 flex items-center justify-between gap-2 flex-wrap bg-slate-50/70">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="bg-slate-900 text-white font-extrabold text-xs px-2.5 py-1 rounded-lg uppercase tracking-wider shadow-2xs flex items-center gap-1.5">
                  <Table className="w-3.5 h-3.5 text-amber-400" />
                  {timeFilter === 'month' ? `${MONTH_NAMES[selectedMonth].toUpperCase()} ${selectedYear}` : timeFilter === 'year' ? `AÑO ${selectedYear}` : 'PLANILLA DE PRODUCCIÓN'}
                </span>
                <span className="text-xs font-semibold text-slate-500">
                  {filteredProductionRecords.length} registros
                  {isProductionPagingActive && filteredProductionRecords.length > productionPerPage && (
                    <span className="text-slate-400 font-medium ml-1">
                      (Pág. {pageProduction} de {totalProductionPages})
                    </span>
                  )}
                </span>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                {/* Conmutador de vista solo en Móvil */}
                <div className="flex bg-slate-200/70 p-0.5 rounded-xl text-xs font-bold md:hidden">
                  <button
                    type="button"
                    onClick={() => setMobilePlanillaView('cards')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                      mobilePlanillaView === 'cards'
                        ? 'bg-white text-blue-700 shadow-2xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tarjetas
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobilePlanillaView('table')}
                    className={`px-2.5 py-0.5 rounded-lg transition-all cursor-pointer ${
                      mobilePlanillaView === 'table'
                        ? 'bg-white text-blue-700 shadow-2xs font-black'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    Tabla
                  </button>
                </div>

                <div className="text-xs font-bold text-slate-600 font-mono hidden sm:block">
                  {weightUnit === 'kg' ? 'Total Kilos:' : 'Total Gramos:'}{' '}
                  <span className="text-blue-700 font-black">
                    {weightUnit === 'kg'
                      ? `${totalProductionKg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
                      : `${(totalProductionKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
                  </span>
                </div>
              </div>
            </div>

            {/* ── VISTA DE TARJETAS PARA MÓVIL (Por defecto en celulares) ── */}
            {mobilePlanillaView === 'cards' && (
              <div className="p-3 space-y-2.5 md:hidden">
                {filteredProductionRecords.length === 0 ? (
                  <div className="py-10 text-center text-slate-400">
                    <Table className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                    <p className="font-semibold text-sm">No hay registros de producción</p>
                    <p className="text-xs text-slate-400 mt-1">Haz clic en "+ Nuevo Registro" para añadir una fila.</p>
                  </div>
                ) : (
                  displayedProductionRecords.map(r => (
                    <div
                      key={r.id}
                      className="bg-white rounded-xl border border-slate-200/90 shadow-2xs p-3 hover:border-slate-300 transition-all space-y-2"
                    >
                      {/* Cabecera de la tarjeta: Fecha, Turno, Proceso y Acciones */}
                      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-black text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200/80">
                            {formatProductionDate(r.date)}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-100">
                            T{r.shift}
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase ${
                            r.process === 'REACTIVO'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                          }`}>
                            {r.process}
                          </span>
                        </div>

                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditRecord(r)}
                            className="p-1 text-slate-400 hover:text-blue-600 rounded-lg transition-colors cursor-pointer"
                            title="Editar registro"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {deleteRecordConfirmId === r.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => handleDeleteRecord(r.id!)}
                                className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                Sí
                              </button>
                              <button
                                type="button"
                                onClick={() => setDeleteRecordConfirmId(null)}
                                className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded cursor-pointer"
                              >
                                No
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteRecordConfirmId(r.id!)}
                              className="p-1 text-slate-400 hover:text-red-600 rounded-lg transition-colors cursor-pointer"
                              title="Eliminar registro"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Título del diseño */}
                      <div>
                        <h4 className="font-extrabold text-xs text-slate-900 truncate">
                          {r.designName}
                        </h4>
                      </div>

                      {/* 3 Métricas Clave */}
                      <div className="grid grid-cols-3 gap-2 py-1.5 px-2 bg-slate-50/90 rounded-xl border border-slate-100 text-center">
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Golpes</span>
                          <span className="font-mono font-black text-xs text-blue-900">
                            {getRecordGolpes(r).toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Unidades</span>
                          <span className="font-mono font-black text-xs text-sky-700">
                            {r.units.toLocaleString()} <span className="text-[9px] font-normal text-sky-500">pz</span>
                          </span>
                        </div>
                        <div>
                          <span className="text-[9px] font-bold text-slate-400 uppercase block">Kilos Tela</span>
                          <span className="font-mono font-black text-xs text-amber-900">
                            {weightUnit === 'kg'
                              ? `${getRecordKg(r).toFixed(2).replace('.', ',')} kg`
                              : `${(getRecordKg(r) * 1000).toLocaleString('es-ES', { maximumFractionDigits: 0 })} g`}
                          </span>
                        </div>
                      </div>

                      {/* Ficha técnica compacta */}
                      <div className="flex items-center justify-between text-[10px] text-slate-400 font-medium px-0.5">
                        <span>📐 {r.widthM.toFixed(2)}x{r.heightM.toFixed(2)}m · {r.gramaje} g/m²</span>
                        <span>⚖️ {r.unitWeightG.toFixed(1)} g/ud</span>
                      </div>
                    </div>
                  ))
                )}

                {/* Resumen Total para Móvil */}
                {filteredProductionRecords.length > 0 && (
                  <div className="bg-slate-900 text-white rounded-xl p-3 shadow-2xs mt-3 space-y-1.5 border border-slate-800">
                    <div className="flex items-center justify-between text-[11px] font-black uppercase tracking-wider text-slate-400 border-b border-slate-800 pb-1">
                      <span>Totales del Periodo</span>
                      <span className="text-slate-300 font-mono text-[10px]">{filteredProductionRecords.length} reg.</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center pt-0.5">
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold uppercase">Golpes</span>
                        <span className="text-xs font-mono font-black text-sky-400">{totalProductionGolpes.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold uppercase">Unidades</span>
                        <span className="text-xs font-mono font-black text-blue-400">{totalProductionUnits.toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-[9px] text-slate-400 block font-semibold uppercase">Kilos Tela</span>
                        <span className="text-xs font-mono font-black text-amber-400">
                          {weightUnit === 'kg'
                            ? `${totalProductionKg.toFixed(2).replace('.', ',')} kg`
                            : `${(totalProductionKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TABLA COMPLETA (Visible en escritorio O cuando el usuario selecciona 'Tabla' en móvil) ── */}
            <div className={`overflow-x-auto ${mobilePlanillaView === 'cards' ? 'hidden md:block' : 'block'}`}>
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100/90 text-slate-700 font-extrabold uppercase text-[10px] border-b border-slate-200">
                    <th className="py-2.5 px-3 border-r border-slate-200">Fecha</th>
                    <th className="py-2.5 px-4 border-r border-slate-200">Diseño</th>
                    <th className="py-2.5 px-2 text-center border-r border-slate-200">Turno</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Ancho</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Alto</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Gr/m²</th>
                    <th className="py-2.5 px-3 text-center border-r border-slate-200">Proceso</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Área</th>
                    <th className="py-2.5 px-3 text-right border-r border-slate-200">Peso Ud</th>
                    <th className="py-2.5 px-3 text-right bg-blue-50 text-blue-900 border-r border-blue-100">Nº Golpes</th>
                    <th className="py-2.5 px-4 text-right bg-sky-50 text-sky-900 border-r border-sky-100">Unidades</th>
                    <th className="py-2.5 px-4 text-right bg-amber-50 text-amber-950 border-r border-amber-100">
                      {weightUnit === 'kg' ? 'Kls Día' : 'Grs Día'}
                    </th>
                    <th className="py-2.5 px-3 text-center bg-slate-50">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium">
                  {filteredProductionRecords.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="py-12 text-center text-slate-400">
                        <Table className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                        <p className="font-semibold text-sm">No hay registros de producción para el periodo seleccionado</p>
                        <p className="text-xs text-slate-400 mt-1">Haz clic en "+ Nuevo Registro" para añadir una fila a la planilla.</p>
                      </td>
                    </tr>
                  ) : (
                    displayedProductionRecords.map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-3 font-semibold text-slate-700 border-r border-slate-100 whitespace-nowrap">
                          {formatProductionDate(r.date)}
                        </td>
                        <td className="py-2 px-4 font-bold text-slate-900 border-r border-slate-100">
                          {r.designName}
                        </td>
                        <td className="py-2 px-2 text-center border-r border-slate-100 font-mono">
                          {r.shift}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                          {r.widthM.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                          {r.heightM.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                          {r.gramaje}
                        </td>
                        <td className="py-2 px-3 text-center border-r border-slate-100">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${r.process === 'REACTIVO'
                              ? 'bg-purple-100 text-purple-800 border border-purple-200'
                              : 'bg-orange-100 text-orange-800 border border-orange-200'
                            }`}>
                            {r.process}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                          {r.areaM2.toFixed(2).replace('.', ',')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono border-r border-slate-100">
                          {r.unitWeightG.toFixed(1).replace('.', ',')}
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-blue-900 bg-blue-50/40 border-r border-blue-100">
                          {getRecordGolpes(r).toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-bold text-sky-800 bg-sky-50/40 border-r border-sky-100">
                          {r.units.toLocaleString()}
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-black text-amber-950 bg-amber-50/50 border-r border-amber-100">
                          {weightUnit === 'kg'
                            ? getRecordKg(r).toFixed(2).replace('.', ',')
                            : (getRecordKg(r) * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                        </td>
                        <td className="py-2 px-3 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenEditRecord(r)}
                              className="p-1 text-slate-400 hover:text-blue-600 transition-colors"
                              title="Editar registro"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            {deleteRecordConfirmId === r.id ? (
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteRecord(r.id!)}
                                  className="text-[10px] font-bold text-red-600 bg-red-50 border border-red-200 px-1.5 py-0.5 rounded hover:bg-red-100"
                                >
                                  Sí
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeleteRecordConfirmId(null)}
                                  className="text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded hover:bg-slate-200"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setDeleteRecordConfirmId(r.id!)}
                                className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                                title="Eliminar registro"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredProductionRecords.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-100/90 font-black border-t-2 border-slate-300 text-xs">
                      <td colSpan={9} className="py-3 px-4 text-right uppercase tracking-wider text-slate-700 border-r border-slate-200">
                        Totales del Periodo:
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-black text-blue-900 bg-blue-100/90 border-r border-blue-200 text-sm">
                        {totalProductionGolpes.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-sky-900 bg-sky-100/90 border-r border-sky-200 text-sm">
                        {totalProductionUnits.toLocaleString()}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-black text-amber-950 bg-amber-200/90 border-r border-amber-300 text-sm">
                        {weightUnit === 'kg'
                          ? `${totalProductionKg.toFixed(2).replace('.', ',')} kg`
                          : `${(totalProductionKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
                      </td>
                      <td className="bg-slate-100"></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>

            {/* Controles de paginación para Todo, Rango o listas extensas */}
            {isProductionPagingActive && filteredProductionRecords.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 sm:p-4 bg-slate-50/90 border-t border-slate-200">
                <div className="flex items-center gap-3">
                  <p className="text-xs text-slate-500 font-medium">
                    Mostrando <span className="font-bold text-slate-700">{((pageProduction - 1) * productionPerPage) + 1}</span> a <span className="font-bold text-slate-700">{Math.min(pageProduction * productionPerPage, filteredProductionRecords.length)}</span> de <span className="font-bold text-slate-700">{filteredProductionRecords.length}</span>
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-slate-500">
                    <span className="text-[10px] font-semibold text-slate-400">Por pág:</span>
                    <select
                      value={productionPerPage}
                      onChange={(e) => {
                        setProductionPerPage(Number(e.target.value));
                        setPageProduction(1);
                      }}
                      className="bg-white border border-slate-200 text-slate-700 rounded-lg px-2 py-1 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer shadow-2xs"
                    >
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => setPageProduction(1)}
                    disabled={pageProduction === 1}
                    className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Primera página"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageProduction(p => Math.max(1, p - 1))}
                    disabled={pageProduction === 1}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Página anterior"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-xs font-extrabold text-slate-800 px-3">
                    {pageProduction} / {totalProductionPages}
                  </span>
                  <button
                    type="button"
                    onClick={() => setPageProduction(p => Math.min(totalProductionPages, p + 1))}
                    disabled={pageProduction === totalProductionPages}
                    className="p-1.5 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Página siguiente"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPageProduction(totalProductionPages)}
                    disabled={pageProduction === totalProductionPages}
                    className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-colors cursor-pointer"
                    title="Última página"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── VISTA 1B: GRÁFICOS DE PRODUCCIÓN (golpes, unidades, kilos de tela) ── */}
      {activeDashboardTab === 'production_charts' && (
        <div className="space-y-4">
          {/* ── CONTROLES Y FILTROS DEDICADOS DE GRÁFICOS DE PRODUCCIÓN ── */}
          <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3 shrink-0">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-xs">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                    Gráficos de Producción
                    <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 hidden sm:inline-block">
                      {filteredProductionRecords.length} {filteredProductionRecords.length === 1 ? 'registro' : 'registros'}
                    </span>
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                    Tendencias de golpes, unidades y kilos de tela por día, proceso y turno
                  </p>
                </div>
              </div>
            </div>

            {/* Fila 2: Navegación de Fecha, Chips de Período, Proceso, Unidad de Peso y Búsqueda */}
            <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
              <div className="flex items-center gap-1.5 flex-wrap">
                {/* Mes anterior / actual / siguiente */}
                {timeFilter === 'month' && (
                  <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
                    <button
                      type="button"
                      onClick={handlePrevMonth}
                      className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="Mes anterior"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="px-2 py-0.5 text-xs font-black text-slate-800 flex items-center gap-1">
                      <span>{MONTH_NAMES[selectedMonth]}</span>
                      <span className="text-slate-400 font-semibold">{selectedYear}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleNextMonth}
                      className="p-1 text-slate-500 hover:text-emerald-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                      title="Mes siguiente"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Period chips */}
                <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
                  {[
                    { id: 'month', label: 'Mes' },
                    { id: 'year', label: 'Año' },
                    { id: 'all', label: 'Todo' },
                    { id: 'custom', label: 'Rango' },
                  ].map(f => (
                    <button
                      key={f.id}
                      onClick={() => setTimeFilter(f.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                        timeFilter === f.id
                          ? 'bg-white text-emerald-700 shadow-2xs font-black'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Filtro Proceso (Reactivo / Pigmento) */}
                <select
                  value={lineTypeFilter}
                  onChange={e => setLineTypeFilter(e.target.value as any)}
                  className="bg-slate-100/90 border border-slate-200/80 text-slate-700 text-xs font-bold rounded-xl px-2.5 py-1 outline-none cursor-pointer"
                >
                  <option value="all">Todo proceso</option>
                  <option value="reactivo">Solo Reactivos</option>
                  <option value="pigmento">Solo Pigmentos</option>
                </select>

                {/* Toggle Kg / Gramos */}
                <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60 text-[11px] font-bold">
                  <button
                    type="button"
                    onClick={() => setWeightUnit('kg')}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${weightUnit === 'kg' ? 'bg-white text-slate-800 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Kg
                  </button>
                  <button
                    type="button"
                    onClick={() => setWeightUnit('g')}
                    className={`px-2 py-0.5 rounded-lg transition-all cursor-pointer ${weightUnit === 'g' ? 'bg-white text-slate-800 shadow-2xs font-black' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    Gramos
                  </button>
                </div>
              </div>

              {/* Buscador */}
              <div className="relative flex-1 min-w-[170px] max-w-xs">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Filtrar por diseño..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-7 py-1 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
                {searchTerm && (
                  <button
                    onClick={() => setSearchTerm('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>

            {/* Fila contextual para fecha personalizada o año */}
            {timeFilter === 'custom' && (
              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Rango:</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={e => setDateFrom(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold"
                />
                <span className="text-slate-400">-</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={e => setDateTo(e.target.value)}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-semibold"
                />
              </div>
            )}

            {timeFilter === 'year' && (
              <div className="pt-2 border-t border-slate-100 flex items-center gap-2 text-xs">
                <span className="text-[10px] font-bold text-slate-400 uppercase">Año a consultar:</span>
                <select
                  value={selectedYear}
                  onChange={e => setSelectedYear(Number(e.target.value))}
                  className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-700"
                >
                  {availableYears.map(y => (
                    <option key={y} value={y}>{y}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <Suspense fallback={<DashboardLoadingSkeleton />}>
            <ProductionCharts
              records={filteredProductionRecords}
              allRecords={productionRecords}
              weightUnit={weightUnit}
              selectedMonth={selectedMonth}
              selectedYear={selectedYear}
              timeFilter={timeFilter}
              periodLabel={
                timeFilter === 'month' ? `${MONTH_NAMES[selectedMonth]} ${selectedYear}`
                  : timeFilter === 'year' ? `Año ${selectedYear}`
                    : timeFilter === 'today' ? 'Hoy'
                      : timeFilter === 'week' ? 'Últimos 7 días'
                        : timeFilter === 'custom' ? 'Rango personalizado'
                          : 'Todo el histórico'
              }
            />
          </Suspense>
        </div>
      )}

      {/* ── VISTA 2: GRÁFICOS Y ANALYTICS ── */}
      {activeDashboardTab === 'analytics' && (
        <div className="space-y-6">
          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5 sm:gap-4 shrink-0">
            {/* Card 1: Total Registrado / Mezclado */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-3 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <History className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">
                  {logTypeFilter === 'preparacion' ? 'Total Mezclado' : logTypeFilter === 'consumo' ? 'Total Consumido' : 'Total Tintas'}
                </p>
                <p className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{totalKgMixed} <span className="text-xs sm:text-sm font-bold text-slate-500">{weightUnit}</span></p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">{numLotesDisplay} lotes reg.</p>
              </div>
            </div>

            {/* Card 2: Promedio / Lote */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-3 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                <Zap className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Prom. / Lote</p>
                <p className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{avgKgPerBatch} <span className="text-xs sm:text-sm font-bold text-slate-500">{weightUnit}</span></p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">Eficiencia x lote</p>
              </div>
            </div>

            {/* Card 3: Unidades Estampadas */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-3 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Award className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Prendas Estampadas</p>
                <p className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{totalPieces.toLocaleString()} <span className="text-xs sm:text-sm font-bold text-slate-500">pz</span></p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">{totalProductionGolpes.toLocaleString()} golpes</p>
              </div>
            </div>

            {/* Card 4: Tela Procesada */}
            <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-3 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Tela Procesada</p>
                <p className="text-base sm:text-xl font-black text-slate-900 tracking-tight">
                  {weightUnit === 'kg'
                    ? `${totalProductionKg.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}`
                    : `${(totalProductionKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0 })}`}
                  <span className="text-xs sm:text-sm font-bold text-slate-500 ml-1">{weightUnit}</span>
                </p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">Toalla en taller</p>
              </div>
            </div>

            {/* Card 5: Rendimiento de Tinta (col-span-2 on mobile, col-span-1 on desktop) */}
            <div className="col-span-2 lg:col-span-1 bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-2.5 sm:gap-3 hover:shadow-sm transition-shadow">
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
                <Droplets className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-wider truncate">Rendimiento Tinta</p>
                <p className="text-base sm:text-xl font-black text-slate-900 tracking-tight">{inkPerUnitGrams} <span className="text-xs sm:text-sm font-bold text-slate-500">g / pz</span></p>
                <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium truncate">{inkPerKgTelaGrams} g / kg tela</p>
              </div>
            </div>
          </div>

          {/* ── GRÁFICOS ── */}
          <Suspense fallback={<DashboardLoadingSkeleton />}>
            <InkCharts
              weightUnit={weightUnit}
              logTypeFilter={logTypeFilter}
              lineTypeFilter={lineTypeFilter}
              onLineTypeChange={setLineTypeFilter}
              timeline={inkTimeline}
              groupedByMonth={inkGroupByMonth}
              inks={topInksData}
              pantones={pantoneChartData}
              comparison={inkComparison}
              totalProductionUnits={totalProductionUnits}
              totalProductionKg={totalProductionKg}
              totalProductionGolpes={totalProductionGolpes}
            />
          </Suspense>

          {/* ── TABLAS DE HISTORIAL ── */}
          <div className="space-y-6">
            {renderTable("Registro de Mezclas", filteredBatches.filter(b => b.type !== 'consumo'), "No hay mezclas registradas para los filtros aplicados", pageMezclas, setPageMezclas)}
            {renderConsumoTable("Registro de Consumo de Órdenes", filteredWorkOrders, "No hay consumos registrados para los filtros aplicados", pageConsumo, setPageConsumo)}
          </div>
        </div>
      )}

      {/* ── VISTA 5: SEGUNDAS Y CONTROL DE CALIDAD ── */}
      {activeDashboardTab === 'segundas' && (
        <Suspense fallback={<DashboardLoadingSkeleton />}>
          <SegundasDashboard />
        </Suspense>
      )}

      {/* ── MODAL DE DETALLE ── */}
      {selectedBatch && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedBatch(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del modal */}
            <div className="p-6 border-b border-slate-100 flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl shadow-sm border border-slate-200" style={{ backgroundColor: selectedBatch.pantoneHex }} />
                <div>
                  <p className="text-lg font-extrabold text-slate-900">{selectedBatch.pantoneCode}</p>
                  <p className="text-xs text-slate-400 font-medium">{selectedBatch.productType} {selectedBatch.productReference ? `· ${selectedBatch.productReference}` : ''}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedBatch(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"
                title="Cerrar (Esc)"
              >
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">Esc</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Datos del lote */}
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'ID Lote (Mezcla)', value: selectedBatch.id_mezcla || selectedBatch.id || 'N/A' },
                  { label: 'Orden de Trabajo', value: selectedBatch.orden_id || selectedBatch.workOrderId || 'N/A' },
                  { label: 'Tono Preparado', value: selectedBatch.color_codigo || selectedBatch.pantoneCode },
                  { label: 'Mezcla Preparada', value: `${selectedBatch.totalGrammage.toLocaleString()} g` },
                  { label: 'Estado', value: selectedBatch.estado || selectedBatch.status },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-slate-50 rounded-2xl p-3 border border-slate-100">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
                    <p className="text-xs font-bold text-slate-800 break-all font-mono">{value}</p>
                  </div>
                ))}
              </div>

              {/* Fecha y Hora Exacta de Registro */}
              {(() => {
                const raw = selectedBatch.fecha_hora_registro || selectedBatch.timestamp;
                if (!raw) return null;
                const d = raw.toDate ? raw.toDate() : new Date(raw);
                const fullDate = d.toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' });
                const fullTime = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                return (
                  <div className="bg-blue-50/60 rounded-2xl p-3 border border-blue-100 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide mb-0.5">Fecha y Hora de Registro</p>
                      <p className="text-xs font-bold text-slate-800">{fullDate}</p>
                    </div>
                    <span className="text-xs font-mono font-bold text-blue-700 bg-white px-2.5 py-1 rounded-lg border border-blue-200 shadow-2xs">
                      {fullTime}
                    </span>
                  </div>
                );
              })()}

              {/* Fórmula de ingredientes */}
              {(() => {
                if (selectedBatch.pantoneCode.toUpperCase().includes('PASTA MADRE')) {
                  const pastaIngredients = [
                    { component: 'Urea (46%)', description: 'Aditivo retenedor de humedad / higroscópico', pct: 7.5 },
                    { component: 'Espesante Novaprint TC Ultra', description: 'Polímero sintético para viscosidad', pct: 4.5 },
                    { component: 'Bicarbonato de Sodio', description: 'Álcali para fijación del reactivo', pct: 3.5 },
                    { component: 'Asutol PTR Granos', description: 'Dispersante y agente desaireante', pct: 1.0 },
                    { component: 'Agua (Balance)', description: 'Vehículo diluyente de balance para 100%', pct: 83.5 },
                  ];
                  return (
                    <div>
                      <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                        <Scissors className="w-3.5 h-3.5 text-blue-500" /> Desglose de Aditivos e Insumos del Lote
                      </p>
                      <div className="space-y-2">
                        {pastaIngredients.map((f, i) => {
                          const grams = (selectedBatch.totalGrammage * f.pct / 100).toFixed(1);
                          return (
                            <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                              <div>
                                <p className="text-xs font-bold text-slate-800">{f.component}</p>
                                <p className="text-[10px] text-slate-400">{f.description}</p>
                              </div>
                              <div className="text-right shrink-0 ml-2">
                                <p className="text-sm font-extrabold text-blue-700 font-mono">{grams}g</p>
                                <p className="text-[10px] text-slate-400">{f.pct}%</p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }

                const pantone = pantones.find(p => p.code === selectedBatch.pantoneCode);
                if (!pantone?.formulas?.length) return (
                  <div className="bg-slate-50 rounded-2xl p-4 border border-dashed border-slate-200 text-center text-xs text-slate-400">
                    No hay fórmula registrada para este Pantone
                  </div>
                );
                return (
                  <div>
                    <p className="text-xs font-bold text-slate-700 mb-2 flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-blue-500" /> Desglose de Ingredientes
                    </p>
                    <div className="space-y-2">
                      {pantone.formulas.map((f, i) => {
                        const grams = (selectedBatch.totalGrammage * f.percentage / 100).toFixed(1);
                        return (
                          <div key={i} className="flex items-center justify-between bg-slate-50 rounded-xl p-3 border border-slate-100">
                            <div>
                              <p className="text-xs font-bold text-slate-800">{f.component}</p>
                              <p className="text-[10px] text-slate-400">{f.description}</p>
                            </div>
                            <div className="text-right shrink-0 ml-2">
                              <p className="text-sm font-extrabold text-blue-700 font-mono">{grams}g</p>
                              <p className="text-[10px] text-slate-400">{f.percentage}%</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {/* Notas del Pantone */}
              {(() => {
                const pantone = pantones.find(p => p.code === selectedBatch.pantoneCode);
                if (!pantone?.notes) return null;
                return (
                  <div className="bg-amber-50 border border-amber-100 rounded-2xl p-3">
                    <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wide mb-1">Notas de Laboratorio</p>
                    <p className="text-xs text-amber-800 leading-relaxed">{pantone.notes}</p>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL DE DETALLES DE ORDEN (CONSUMO) ── */}
      {selectedOrderDetails && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setSelectedOrderDetails(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-scale-in"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-6 border-b border-slate-100 flex items-start justify-between bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-500">
                  <CheckCircle className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900">
                    {selectedOrderDetails.designName || selectedOrderDetails.pantoneCode || 'Orden de Trabajo'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    {selectedOrderDetails.productReference ? `Referencia: ${selectedOrderDetails.productReference} · ` : ''}
                    {selectedOrderDetails.targetQuantity} Piezas Totales
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-xl transition-colors flex items-center gap-1.5"
                title="Cerrar (Esc)"
              >
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block bg-slate-200 border border-slate-300 px-1.5 py-0.5 rounded-md">Esc</span>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                  Desglose de Consumo por Pantone
                </h4>
                <div className="space-y-3">
                  {selectedOrderDetails.completedColors?.map((colorCode) => {
                    const pantoneInfo = pantones.find(p => p.code === colorCode);
                    const history = selectedOrderDetails.preparedHistory?.[colorCode] || [];
                    const totalKg = history.reduce((acc, curr) => acc + curr, 0);

                    return (
                      <div key={colorCode} className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-10 h-10 rounded-xl shadow-sm border border-black/10 shrink-0"
                            style={{ backgroundColor: pantoneInfo?.hex || '#ccc' }}
                          />
                          <div>
                            <p className="text-sm font-bold text-slate-800">{colorCode}</p>
                            <p className="text-[10px] text-slate-500 font-medium">
                              {history.length} {history.length === 1 ? 'preparación' : 'preparaciones'}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-800 font-mono tracking-tight">
                            {totalKg.toFixed(2)} <span className="text-xs text-slate-400">Kg</span>
                          </p>
                          <p className="text-[10px] font-medium text-slate-400">Total Consumido</p>
                        </div>
                      </div>
                    );
                  })}
                  {(!selectedOrderDetails.completedColors || selectedOrderDetails.completedColors.length === 0) && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-sm font-medium text-slate-500">
                      No hay pantones registrados en esta orden.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
              {onDeleteWorkOrder && selectedOrderDetails.id ? (
                deleteOrderConfirmId === selectedOrderDetails.id ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-red-600">¿Eliminar esta orden?</span>
                    <button
                      onClick={async () => {
                        if (selectedOrderDetails.id) {
                          await onDeleteWorkOrder(selectedOrderDetails.id);
                          setDeleteOrderConfirmId(null);
                          setSelectedOrderDetails(null);
                        }
                      }}
                      className="px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg hover:bg-red-700 transition-colors"
                    >
                      Sí, eliminar
                    </button>
                    <button
                      onClick={() => setDeleteOrderConfirmId(null)}
                      className="px-3 py-1.5 bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg hover:bg-slate-300 transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setDeleteOrderConfirmId(selectedOrderDetails.id!)}
                    className="px-3 py-2 text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
                    title="Eliminar orden completada"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Registro</span>
                  </button>
                )
              ) : <div />}

              <button
                onClick={() => setSelectedOrderDetails(null)}
                className="px-6 py-2.5 bg-slate-800 text-white text-sm font-bold rounded-xl hover:bg-slate-700 transition-colors flex items-center gap-2"
                title="Cerrar (Esc)"
              >
                <span>Cerrar</span>
                <span className="text-[10px] text-slate-400 font-normal bg-slate-700 px-1.5 py-0.5 rounded">Esc</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVO / EDITAR REGISTRO DE PRODUCCIÓN ── */}
      {isRecordModalOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setIsRecordModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-xl max-h-[92vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}
          >
            {/* Header del Modal */}
            <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-amber-500/10 via-sky-500/10 to-transparent">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-900 flex items-center justify-center font-black shadow-sm">
                  <Table className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {editingRecordId ? 'Editar Registro de Producción' : 'Nuevo Registro de Producción'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium">
                    Reporte Mensual de Kilos de Tela y Estampado
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center gap-1.5"
                title="Cerrar (Esc)"
              >
                <span className="text-[10px] font-semibold text-slate-400 hidden sm:inline-block bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded-md">Esc</span>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Formulario */}
            <form onSubmit={handleSaveRecord} className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Fecha */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Fecha
                  </label>
                  <input
                    type="date"
                    required
                    value={recordDate}
                    onChange={e => setRecordDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                </div>

                {/* Turno */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Turno
                  </label>
                  <select
                    value={recordShift}
                    onChange={e => setRecordShift(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value={1}>Turno 1</option>
                    <option value={2}>Turno 2</option>
                    <option value={3}>Turno 3</option>
                  </select>
                </div>
              </div>

              {/* Diseño */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wide">
                    Diseño
                  </label>
                  {designs.length > 0 && (
                    <span className="text-[10px] text-slate-400">
                      Sugerencias de tus diseños registrados
                    </span>
                  )}
                </div>
                <div className="relative">
                  <input
                    type="text"
                    required
                    list="designs-datalist"
                    placeholder="Ej: FRUTAS ANDU, MINNIE MOUSE, STITCH NIÑA..."
                    value={recordDesignName}
                    onChange={e => handleSelectDesign(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                  />
                  <datalist id="designs-datalist">
                    {designs.map(d => (
                      <option key={d.id || d.name} value={d.name}>
                        {d.lineType ? `(${d.lineType.toUpperCase()})` : ''} {d.widthCm && d.heightCm ? `${d.widthCm}x${d.heightCm} cm` : ''}
                      </option>
                    ))}
                  </datalist>
                </div>
              </div>

              {/* Medidas y Proceso */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {/* Medida 1 (Ancho en m) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Medida 1 (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={recordWidthM}
                    onChange={e => setRecordWidthM(parseFloat(e.target.value) || 0)}
                    placeholder="0.60"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400">Ancho (ej: 0,60)</span>
                </div>

                {/* Medida 2 (Largo en m) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Medida 2 (m)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    value={recordHeightM}
                    onChange={e => setRecordHeightM(parseFloat(e.target.value) || 0)}
                    placeholder="1.20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400">Largo (ej: 1,20)</span>
                </div>

                {/* Gramaje (Gr/m2) */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Gr / m²
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={recordGramaje}
                    onChange={e => setRecordGramaje(parseInt(e.target.value, 10) || 0)}
                    placeholder="280"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-slate-400">Tela (ej: 280)</span>
                </div>

                {/* Proceso */}
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase tracking-wide mb-1">
                    Proceso
                  </label>
                  <select
                    value={recordProcess}
                    onChange={e => setRecordProcess(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  >
                    <option value="REACTIVO">REACTIVO</option>
                    <option value="PIGMENTO">PIGMENTO</option>
                  </select>
                  <span className="text-[9px] text-slate-400">Línea química</span>
                </div>
              </div>

              {/* Golpes y Unidades */}
              <div className="grid grid-cols-2 gap-3 bg-sky-50/60 p-3 rounded-2xl border border-sky-100">
                <div>
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase mb-1">
                    Nº de Golpes
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={recordGolpes || ''}
                    onChange={e => {
                      const g = parseInt(e.target.value, 10) || 0;
                      setRecordGolpes(g);
                      const isToalla = isToallaDesign(recordDesignName, recordWidthM, recordProcess);
                      const ratio = (recordWidthM <= 0.40 || isToalla) ? 5 : 3;
                      setRecordUnits(g * ratio);
                    }}
                    placeholder="Ej: 800"
                    className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-xs font-bold font-mono text-slate-800 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-sky-600 font-medium">Golpes de máquina</span>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase mb-1">
                    Unidades (Prendas)
                  </label>
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={recordUnits}
                    onChange={e => setRecordUnits(parseInt(e.target.value, 10) || 0)}
                    placeholder="2400"
                    className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-xs font-extrabold font-mono text-sky-950 focus:ring-2 focus:ring-sky-500 focus:outline-none"
                  />
                  <span className="text-[9px] text-sky-600 font-medium">
                    Auto-calculado ({isToallaDesign(recordDesignName, recordWidthM, recordProcess) || recordWidthM <= 0.40 ? '5/golpe' : '3/golpe'})
                  </span>
                </div>
              </div>

              {/* Tarjetas de Cálculo en Vivo (Fórmulas Automáticas) */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-2">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  Cálculo Automático según Medidas y Gramaje
                </p>
                <div className="grid grid-cols-3 gap-3 pt-1">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <p className="text-[9px] font-bold text-slate-400 uppercase">Área (m²)</p>
                    <p className="text-sm font-extrabold text-slate-800 font-mono">
                      {(recordWidthM * recordHeightM).toFixed(2).replace('.', ',')} m²
                    </p>
                    <p className="text-[8px] text-slate-400">{recordWidthM} × {recordHeightM}</p>
                  </div>
                  <div className="bg-white p-2.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <p className="text-[9px] font-bold text-slate-400 uppercase">Peso Unidad</p>
                      {isToallaDesign(recordDesignName, recordWidthM, recordProcess) && (
                        <span className="text-[8px] font-bold text-amber-600 bg-amber-50 px-1 rounded">Toalla 63g</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-0.5">
                      <input
                        type="number"
                        step="0.1"
                        min="1"
                        value={recordUnitWeightG}
                        onChange={e => setRecordUnitWeightG(parseFloat(e.target.value) || 0)}
                        className="w-20 font-extrabold text-slate-800 font-mono text-sm bg-slate-50 border border-slate-200 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                      <span className="text-xs font-bold text-slate-500">g</span>
                    </div>
                    <p className="text-[8px] text-slate-400 mt-0.5">
                      {isToallaDesign(recordDesignName, recordWidthM, recordProcess) ? 'Fijo Toallas (63g)' : 'Área × Gr/m²'}
                    </p>
                  </div>
                  <div className="bg-amber-50 p-2.5 rounded-xl border border-amber-200">
                    <p className="text-[9px] font-bold text-amber-700 uppercase">Kls Día Total</p>
                    <p className="text-sm font-black text-amber-950 font-mono">
                      {(((recordUnits * (recordUnitWeightG || ((recordWidthM * recordHeightM) * recordGramaje))) / 1000) || 0).toFixed(2).replace('.', ',')} kg
                    </p>
                    <p className="text-[8px] text-amber-600 font-medium">(Unid × Peso) / 1000</p>
                  </div>
                </div>
              </div>

              {/* Botones de acción */}
              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsRecordModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" />
                  {editingRecordId ? 'Actualizar Fila' : 'Agregar a la Planilla'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
