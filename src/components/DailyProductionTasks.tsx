import { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Plus, Edit2, Trash2, Search, Table, Award, TrendingUp, 
  ChevronLeft, ChevronRight, X, ArrowRight, Check, BarChart2, Eye, EyeOff
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, ResponsiveContainer 
} from 'recharts';
import { DailyProductionRecord, Design, WorkOrder } from '../types';
import { 
  getProductionRecords, 
  addProductionRecord, 
  updateProductionRecord, 
  deleteProductionRecord,
  syncWorkOrdersToProductionRecords,
  getRecordKg,
  getRecordGolpes,
  isToallaDesign
} from '../lib/dataService';

interface DailyProductionTasksProps {
  designs?: Design[];
  workOrders?: WorkOrder[];
  weightUnit?: 'kg' | 'g';
  onNavigateToMonthlySheet?: () => void;
}

const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

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

function formatDateNice(dateStr: string): string {
  try {
    const parts = dateStr.split('-');
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      const d = new Date(year, month, day);
      const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
      const monthName = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
      return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${day} ${monthName}`;
    }
    const d = new Date(dateStr);
    const weekday = d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
    const monthName = d.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '');
    return `${weekday.charAt(0).toUpperCase() + weekday.slice(1)}, ${d.getDate()} ${monthName}`;
  } catch (e) {
    return dateStr;
  }
}

export default function DailyProductionTasks({
  designs = [],
  workOrders = [],
  weightUnit = 'kg',
  onNavigateToMonthlySheet
}: DailyProductionTasksProps) {
  const [productionRecords, setProductionRecords] = useState<DailyProductionRecord[]>([]);
  const [timeFilter, setTimeFilter] = useState<'month' | 'year' | 'all' | 'custom'>('month');
  const [selectedMonth, setSelectedMonth] = useState<number>(() => new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(() => new Date().getFullYear());
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  // Paginación de tarjetas diarias
  const [pageCards, setPageCards] = useState(1);
  const [cardsPerPage, setCardsPerPage] = useState(12);

  // Métrica para la mini gráfica de tendencia diaria
  const [chartMetric, setChartMetric] = useState<'golpes' | 'units'>('golpes');
  const [showMiniChart, setShowMiniChart] = useState(true);

  // Reiniciar a la página 1 al cambiar filtros o tamaño de página
  useEffect(() => {
    setPageCards(1);
  }, [timeFilter, selectedMonth, selectedYear, dateFrom, dateTo, searchTerm, cardsPerPage]);

  // Modal de Crear / Editar Tarea Diaria de Golpes
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<string | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Campos del formulario
  const [taskDate, setTaskDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [taskDesignName, setTaskDesignName] = useState('');
  const [taskGolpes, setTaskGolpes] = useState<number>(800);
  const [taskUnits, setTaskUnits] = useState<number>(2400);
  const [taskShift, setTaskShift] = useState<number>(1);
  const [taskWidthM, setTaskWidthM] = useState<number>(0.60);
  const [taskHeightM, setTaskHeightM] = useState<number>(1.20);
  const [taskGramaje, setTaskGramaje] = useState<number>(280);
  const [taskProcess, setTaskProcess] = useState<'PIGMENTO' | 'REACTIVO'>('REACTIVO');

  const loadData = async () => {
    if (workOrders && workOrders.length > 0) {
      const synced = await syncWorkOrdersToProductionRecords(workOrders, designs);
      setProductionRecords(synced);
    } else {
      const records = await getProductionRecords();
      setProductionRecords(records);
    }
  };

  useEffect(() => {
    loadData();
  }, [workOrders, designs]);

  useEffect(() => {
    const handleUpdate = () => {
      loadData();
    };
    window.addEventListener('production-records-updated', handleUpdate);
    return () => window.removeEventListener('production-records-updated', handleUpdate);
  }, [workOrders, designs]);

  // Manejo de la tecla Escape para cerrar modales
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isModalOpen) setIsModalOpen(false);
        if (deleteConfirmId) setDeleteConfirmId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, deleteConfirmId]);

  // Años disponibles
  const availableYears = useMemo(() => {
    const currentY = new Date().getFullYear();
    const yearsSet = new Set<number>([currentY, currentY - 1, currentY - 2]);
    productionRecords.forEach(r => {
      const y = parseInt(r.date.slice(0, 4), 10);
      if (!isNaN(y)) yearsSet.add(y);
    });
    return Array.from(yearsSet).sort((a, b) => b - a);
  }, [productionRecords]);

  // Filtrado de registros
  const filteredRecords = useMemo(() => {
    return productionRecords.filter(r => {
      if (timeFilter === 'month') {
        const parts = r.date.split('-');
        if (parts.length === 3) {
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10) - 1;
          if (m !== selectedMonth || y !== selectedYear) return false;
        }
      } else if (timeFilter === 'year') {
        const y = parseInt(r.date.slice(0, 4), 10);
        if (y !== selectedYear) return false;
      } else if (timeFilter === 'custom' && (dateFrom || dateTo)) {
        if (dateFrom && r.date < dateFrom) return false;
        if (dateTo && r.date > dateTo) return false;
      }

      if (searchTerm.trim()) {
        const q = searchTerm.toLowerCase();
        const matches = 
          r.designName.toLowerCase().includes(q) ||
          r.process.toLowerCase().includes(q);
        if (!matches) return false;
      }

      return true;
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [productionRecords, timeFilter, selectedMonth, selectedYear, dateFrom, dateTo, searchTerm]);

  // Agrupar por día (tarjetas diarias)
  const groupedDailyTasks = useMemo(() => {
    const map: Record<string, DailyProductionRecord[]> = {};
    filteredRecords.forEach(r => {
      if (!map[r.date]) map[r.date] = [];
      map[r.date].push(r);
    });

    return Object.entries(map).map(([date, records]) => {
      const totalGolpes = records.reduce((acc, r) => acc + getRecordGolpes(r), 0);
      const totalUnits = records.reduce((acc, r) => acc + (r.units || 0), 0);
      const totalKg = records.reduce((acc, r) => acc + getRecordKg(r), 0);
      return {
        date,
        records,
        totalGolpes,
        totalUnits,
        totalKg
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // Datos diarios para la mini-gráfica de tendencia de producción
  const dailyChartData = useMemo(() => {
    return groupedDailyTasks.map(d => {
      const parts = d.date.split('-');
      const dayNum = parts.length === 3 ? parseInt(parts[2], 10) : d.date;
      return {
        date: d.date,
        dayNum: `${dayNum}`,
        label: formatProductionDate(d.date),
        golpes: d.totalGolpes,
        units: d.totalUnits,
        kg: Number(d.totalKg.toFixed(1))
      };
    });
  }, [groupedDailyTasks]);

  // Paginación de tarjetas diarias
  const totalCardPages = Math.max(1, Math.ceil(groupedDailyTasks.length / cardsPerPage));
  const displayedDailyTasks = useMemo(() => {
    const start = (pageCards - 1) * cardsPerPage;
    return groupedDailyTasks.slice(start, start + cardsPerPage);
  }, [groupedDailyTasks, pageCards, cardsPerPage]);

  // Métricas acumuladas del período
  const totalPeriodGolpes = filteredRecords.reduce((acc, r) => acc + getRecordGolpes(r), 0);
  const totalPeriodUnits = filteredRecords.reduce((acc, r) => acc + (r.units || 0), 0);
  const totalPeriodKg = filteredRecords.reduce((acc, r) => acc + getRecordKg(r), 0);
  const totalDaysCount = groupedDailyTasks.length;

  // Manejo de selección de diseño en formulario
  const handleSelectDesign = (name: string) => {
    setTaskDesignName(name);
    const d = designs.find(item => item.name.toUpperCase() === name.toUpperCase());
    const isToalla = isToallaDesign(name);
    if (d) {
      const wM = isToalla ? 0.35 : (d.widthCm ? Number((d.widthCm / 100).toFixed(2)) : 0.60);
      const hM = isToalla ? 0.60 : (d.heightCm ? Number((d.heightCm / 100).toFixed(2)) : 1.20);
      setTaskWidthM(wM);
      setTaskHeightM(hM);
      setTaskGramaje(isToalla ? 310 : (d.gramaje || 280));
      setTaskProcess(isToalla ? 'PIGMENTO' : (d.lineType === 'reactivo' ? 'REACTIVO' : 'PIGMENTO'));

      const ratio = (wM <= 0.40 || isToalla) ? 5 : 3;
      setTaskUnits(taskGolpes * ratio);
    }
  };

  const handleGolpesChange = (val: number) => {
    setTaskGolpes(val);
    const isToalla = isToallaDesign(taskDesignName, taskWidthM, taskProcess);
    const ratio = (taskWidthM <= 0.40 || isToalla) ? 5 : 3;
    setTaskUnits(val * ratio);
  };

  const handleOpenNewTask = (defaultDate?: string) => {
    setEditingRecordId(null);
    setTaskDate(defaultDate || new Date().toISOString().slice(0, 10));
    const firstDesign = designs.length > 0 ? designs[0] : null;
    const isToalla = firstDesign ? isToallaDesign(firstDesign.name) : false;
    const wM = isToalla ? 0.35 : (firstDesign?.widthCm ? Number((firstDesign.widthCm / 100).toFixed(2)) : 0.60);
    const hM = isToalla ? 0.60 : (firstDesign?.heightCm ? Number((firstDesign.heightCm / 100).toFixed(2)) : 1.20);
    setTaskDesignName(firstDesign ? firstDesign.name : '');
    setTaskShift(1);
    setTaskGolpes(800);
    setTaskWidthM(wM);
    setTaskHeightM(hM);
    setTaskGramaje(isToalla ? 310 : (firstDesign?.gramaje || 280));
    setTaskProcess(isToalla ? 'PIGMENTO' : (firstDesign?.lineType === 'reactivo' ? 'REACTIVO' : 'PIGMENTO'));
    const ratio = (wM <= 0.40 || isToalla) ? 5 : 3;
    setTaskUnits(800 * ratio);
    setIsModalOpen(true);
  };

  const handleOpenEditTask = (r: DailyProductionRecord) => {
    setEditingRecordId(r.id || null);
    setTaskDate(r.date);
    setTaskDesignName(r.designName);
    setTaskShift(r.shift);
    const g = getRecordGolpes(r);
    setTaskGolpes(g);
    setTaskUnits(r.units);
    const isToalla = isToallaDesign(r.designName, r.widthM, r.process);
    setTaskWidthM(isToalla ? 0.35 : r.widthM);
    setTaskHeightM(isToalla ? 0.60 : r.heightM);
    setTaskGramaje(isToalla ? 310 : r.gramaje);
    setTaskProcess(isToalla ? 'PIGMENTO' : r.process);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesignName.trim() || taskUnits <= 0) {
      alert("Por favor selecciona un diseño y las unidades.");
      return;
    }

    const isToalla = isToallaDesign(taskDesignName, taskWidthM, taskProcess);
    const area = isToalla ? 0.21 : Number((taskWidthM * taskHeightM).toFixed(2));
    const matchedDesign = designs.find(item => item.name.toUpperCase() === taskDesignName.toUpperCase().trim());
    const unitWeight = isToalla ? 63 : (matchedDesign?.unitWeight || Number((area * taskGramaje).toFixed(1)));
    const kg = Number(((taskUnits * unitWeight) / 1000).toFixed(2));
    const pxg = isToalla ? 5 : (taskWidthM <= 0.40 ? 5 : 3);
    const golpes = Number(taskGolpes) || Math.round(taskUnits / pxg);

    const recordData: DailyProductionRecord = {
      date: taskDate,
      designName: taskDesignName.toUpperCase().trim(),
      shift: Number(taskShift) || 1,
      golpes,
      widthM: isToalla ? 0.35 : Number(taskWidthM) || 0,
      heightM: isToalla ? 0.60 : Number(taskHeightM) || 0,
      gramaje: isToalla ? 310 : Number(taskGramaje) || 0,
      process: isToalla ? 'PIGMENTO' : taskProcess,
      areaM2: area,
      unitWeightG: unitWeight,
      units: Number(taskUnits) || 0,
      kgDay: kg,
    };

    if (editingRecordId) {
      await updateProductionRecord(editingRecordId, recordData);
    } else {
      await addProductionRecord(recordData);
    }

    setIsModalOpen(false);
    loadData();
  };

  const handleDeleteTask = async (id: string) => {
    setProductionRecords(prev => prev.filter(r => r.id !== id && `${r.date}__${r.designName}` !== id));
    setDeleteConfirmId(null);
    await deleteProductionRecord(id);
    await loadData();
  };

  const handleDeleteEntireDay = async (date: string, dayRecords: DailyProductionRecord[]) => {
    if (window.confirm(`¿Estás seguro de eliminar todo el reporte de producción del día ${formatProductionDate(date)}?`)) {
      setProductionRecords(prev => prev.filter(r => r.date !== date));
      for (const r of dayRecords) {
        const idToDelete = r.id || `${r.date}__${r.designName}`;
        await deleteProductionRecord(idToDelete);
      }
      await loadData();
    }
  };

  return (
    <div className="space-y-6 h-full flex flex-col overflow-y-auto custom-scrollbar pr-2 pb-10" id="daily-production-tasks-view">
      
      {/* ── ENCABEZADO Y CONTROLES PRINCIPALES COMPACTOS ── */}
      <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col gap-3 shrink-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-sky-600 text-white flex items-center justify-center shadow-xs">
              <Calendar className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                Reporte Diario de Golpes
                <span className="text-[10px] font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-100 hidden sm:inline-block">
                  {totalDaysCount} {totalDaysCount === 1 ? 'día' : 'días'}
                </span>
              </h2>
              <p className="text-[11px] text-slate-400 font-medium hidden sm:block">
                Registro diario por diseño · Sincronizado automáticamente con la planilla mensual de kilos
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            {onNavigateToMonthlySheet && (
              <button
                type="button"
                onClick={onNavigateToMonthlySheet}
                className="flex items-center gap-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50/80 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-colors border border-slate-200 shadow-2xs cursor-pointer"
                title="Ir a la planilla de kilos de tela"
              >
                <Table className="w-3.5 h-3.5 text-blue-600" />
                <span className="hidden sm:inline">Ver</span> Planilla
                <ArrowRight className="w-3 h-3 text-slate-400" />
              </button>
            )}

            <button
              type="button"
              onClick={() => handleOpenNewTask()}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white px-3.5 py-1.5 rounded-xl text-xs font-extrabold transition-all shadow-sm shadow-blue-600/20 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Nueva Tarea</span>
            </button>
          </div>
        </div>

        {/* ── BARRA UNIFICADA DE NAVEGACIÓN TEMPORAL Y BÚSQUEDA ── */}
        <div className="pt-2.5 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2.5">
          {/* Navegador de Fecha y Período */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {timeFilter === 'month' && (
              <div className="flex items-center bg-slate-100/90 border border-slate-200/80 rounded-xl p-0.5 shadow-2xs">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11);
                      setSelectedYear(y => y - 1);
                    } else setSelectedMonth(m => m - 1);
                  }}
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
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0);
                      setSelectedYear(y => y + 1);
                    } else setSelectedMonth(m => m + 1);
                  }}
                  className="p-1 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors cursor-pointer"
                  title="Mes siguiente"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Chips de Período */}
            <div className="flex items-center gap-1 bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/60">
              {[
                { id: 'month', label: 'Mes' },
                { id: 'year',  label: 'Año' },
                { id: 'all',   label: 'Todo 2026' },
                { id: 'custom', label: 'Rango' }
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
          </div>

          {/* Buscador de Diseños */}
          <div className="relative flex-1 min-w-[170px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Filtrar diseño o proceso..."
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

        {/* Fila extra para cuando timeFilter sea 'custom' o 'year' */}
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

      {/* ── TARJETAS KPI RESUMEN DE GOLPES Y PRENDAS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-50 text-sky-600 flex items-center justify-center shrink-0 border border-sky-100/80">
            <Award className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Golpes Totales</p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 font-mono tracking-tight">
              {totalPeriodGolpes.toLocaleString()}
            </p>
            <p className="text-[9px] text-slate-400 font-medium truncate">Estampación en máquina</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/80">
            <Table className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Unidades Producidas</p>
            <p className="text-lg sm:text-2xl font-black text-blue-700 font-mono tracking-tight">
              {totalPeriodUnits.toLocaleString()} <span className="text-xs font-bold text-blue-500">pz</span>
            </p>
            <p className="text-[9px] text-blue-600/80 font-medium truncate">Prendas y toallas</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center shrink-0 border border-amber-100/80">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">
              {weightUnit === 'kg' ? 'Kilos de Tela' : 'Gramos de Tela'}
            </p>
            <p className="text-lg sm:text-2xl font-black text-amber-900 font-mono tracking-tight">
              {weightUnit === 'kg'
                ? `${totalPeriodKg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
                : `${(totalPeriodKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
            </p>
            <p className="text-[9px] text-amber-600/80 font-medium truncate">Auto-llenado mensual</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center shrink-0 border border-purple-100/80">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider truncate">Días Registrados</p>
            <p className="text-lg sm:text-2xl font-black text-purple-900 font-mono tracking-tight">
              {totalDaysCount} <span className="text-xs font-bold text-purple-600">días</span>
            </p>
            <p className="text-[9px] text-purple-600/80 font-medium truncate">{filteredRecords.length} tareas totales</p>
          </div>
        </div>
      </div>

      {/* ── MINI-GRÁFICA DE TENDENCIA DIARIA DEL MES ── */}
      {groupedDailyTasks.length > 0 && timeFilter === 'month' && (
        <div className="bg-white p-3 sm:p-4 rounded-2xl border border-slate-200/90 shadow-xs shrink-0">
          <div className="flex items-center justify-between mb-2 gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center text-sky-600">
                <BarChart2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-xs font-extrabold text-slate-800">
                  Tendencia Diaria · {MONTH_NAMES[selectedMonth]} {selectedYear}
                </h3>
                <p className="text-[10px] text-slate-400 font-medium">
                  {groupedDailyTasks.length} días con producción registrada
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold">
                <button
                  type="button"
                  onClick={() => setChartMetric('golpes')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    chartMetric === 'golpes'
                      ? 'bg-white text-sky-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Golpes
                </button>
                <button
                  type="button"
                  onClick={() => setChartMetric('units')}
                  className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                    chartMetric === 'units'
                      ? 'bg-white text-blue-700 shadow-2xs font-black'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Unidades
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowMiniChart(!showMiniChart)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
                title={showMiniChart ? 'Ocultar gráfica' : 'Mostrar gráfica'}
              >
                {showMiniChart ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>

          {showMiniChart && (
            <div className="h-28 sm:h-32 w-full pt-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <XAxis
                    dataKey="dayNum"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickLine={false}
                    axisLine={{ stroke: '#f1f5f9' }}
                  />
                  <YAxis
                    stroke="#94a3b8"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
                  />
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const data = payload[0].payload;
                        return (
                          <div className="bg-slate-900 text-white text-xs p-2.5 rounded-xl shadow-xl border border-slate-700">
                            <p className="font-extrabold text-sky-400 mb-1">{data.label}</p>
                            <p className="text-[11px] font-medium"><span className="text-slate-400">Golpes:</span> <strong className="text-white font-mono">{data.golpes.toLocaleString()}</strong></p>
                            <p className="text-[11px] font-medium"><span className="text-slate-400">Unidades:</span> <strong className="text-sky-300 font-mono">{data.units.toLocaleString()} pz</strong></p>
                            <p className="text-[11px] font-medium"><span className="text-slate-400">Tela:</span> <strong className="text-amber-300 font-mono">{data.kg} kg</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar
                    dataKey={chartMetric}
                    fill={chartMetric === 'golpes' ? '#0ea5e9' : '#3b82f6'}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── CUADRÍCULA DE TARJETAS DIARIAS MODERNAS ── */}
      {groupedDailyTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-10 text-center text-slate-400">
          <Calendar className="w-10 h-10 text-slate-300 mx-auto mb-2.5" />
          <p className="text-sm font-bold text-slate-700">No hay tareas de producción registradas para este período</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Haz clic en "+ Nueva Tarea" para ingresar la primera tarea de estampado de la jornada.
          </p>
          <button
            type="button"
            onClick={() => handleOpenNewTask()}
            className="mt-3.5 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-700 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Registrar Tarea de Hoy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5 sm:gap-4">
          {displayedDailyTasks.map(day => (
            <div
              key={day.date}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col hover:shadow-md hover:border-slate-300 transition-all duration-200"
            >
              {/* Encabezado limpio de la tarjeta por Día */}
              <div className="bg-slate-50/90 px-3.5 py-2.5 border-b border-slate-100 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 border border-blue-100 flex flex-col items-center justify-center text-blue-700 shrink-0">
                    <span className="text-[9px] font-extrabold uppercase leading-none text-blue-500">
                      {formatProductionDate(day.date).split('-')[1]}
                    </span>
                    <span className="text-xs font-black font-mono leading-none mt-0.5">
                      {day.date.split('-')[2]}
                    </span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-xs text-slate-800 capitalize truncate">
                      {formatDateNice(day.date)}
                    </h4>
                    <p className="text-[10px] text-slate-400 font-medium">
                      {day.records.length} {day.records.length === 1 ? 'referencia' : 'referencias'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleOpenNewTask(day.date)}
                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-200 cursor-pointer"
                    title="Añadir diseño a este día"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteEntireDay(day.date, day.records)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-red-100 cursor-pointer"
                    title="Eliminar todo este día"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Lista de Diseños Estampados en el Día */}
              <div className="divide-y divide-slate-100 font-medium text-xs flex-1">
                {day.records.map(r => {
                  const golpesVal = getRecordGolpes(r);
                  const recordKey = r.id || `${r.date}__${r.designName}`;
                  return (
                    <div
                      key={recordKey}
                      className="px-3.5 py-2.5 hover:bg-slate-50/70 transition-colors flex items-center justify-between gap-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-extrabold text-xs text-slate-900 truncate" title={r.designName}>
                            {r.designName}
                          </span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-black tracking-wider uppercase shrink-0 ${
                            r.process === 'REACTIVO'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200/70'
                              : 'bg-amber-50 text-amber-700 border border-amber-200/70'
                          }`}>
                            {r.process === 'REACTIVO' ? 'REACTIVO' : 'PIGMENTO'}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-500">
                          <span className="font-mono text-slate-700">
                            <strong>{golpesVal.toLocaleString()}</strong> <span className="text-[10px] text-slate-400">golpes</span>
                          </span>
                          <span className="text-slate-300">·</span>
                          <span className="font-mono font-bold text-blue-700">
                            {r.units.toLocaleString()} <span className="text-[10px] font-normal text-blue-500">pz</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleOpenEditTask(r)}
                          className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Editar tarea"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        {deleteConfirmId === recordKey ? (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(recordKey)}
                              className="text-[10px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 px-1.5 py-0.5 rounded cursor-pointer"
                              title="Confirmar eliminación"
                            >
                              Sí
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(null)}
                              className="text-[10px] font-bold text-slate-500 bg-slate-100 hover:bg-slate-200 px-1 py-0.5 rounded cursor-pointer"
                              title="Cancelar"
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(recordKey)}
                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Eliminar tarea"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fila de Totales Diarios Moderna y Sutil (Adiós amarillo chillón) */}
              <div className="bg-slate-50/90 px-3.5 py-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total</span>
                  <span className="font-mono font-black text-slate-900 text-xs">
                    {day.totalGolpes.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">golpes</span>
                  <span className="text-slate-300">·</span>
                  <span className="font-mono font-black text-blue-700 text-xs">
                    {day.totalUnits.toLocaleString()}
                  </span>
                  <span className="text-[10px] text-blue-500 font-medium">pz</span>
                </div>
                <div className="text-right font-mono font-bold text-slate-700 text-[11px] shrink-0">
                  {weightUnit === 'kg'
                    ? `${day.totalKg.toFixed(2).replace('.', ',')} kg`
                    : `${(day.totalKg * 1000).toLocaleString('es-ES', { maximumFractionDigits: 0 })} g`}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── BARRA DE PAGINACIÓN DE TARJETAS DIARIAS ── */}
      {groupedDailyTasks.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3.5 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-500 font-semibold">
              Mostrando días <span className="font-bold text-slate-900">{(pageCards - 1) * cardsPerPage + 1}</span> a{' '}
              <span className="font-bold text-slate-900">{Math.min(pageCards * cardsPerPage, groupedDailyTasks.length)}</span> de{' '}
              <span className="font-bold text-slate-900">{groupedDailyTasks.length}</span> días
            </p>

            <div className="flex items-center gap-1.5 ml-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Por pág:</span>
              <select
                value={cardsPerPage}
                onChange={e => {
                  setCardsPerPage(Number(e.target.value));
                  setPageCards(1);
                }}
                className="bg-slate-50 border border-slate-200 text-xs font-bold text-slate-700 rounded-lg px-2 py-1 outline-none cursor-pointer"
              >
                <option value={9}>9 días</option>
                <option value={12}>12 días</option>
                <option value={18}>18 días</option>
                <option value={24}>24 días</option>
                <option value={36}>36 días</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setPageCards(1)}
              disabled={pageCards === 1}
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none cursor-pointer"
              title="Primera página"
            >
              «
            </button>
            <button
              type="button"
              onClick={() => setPageCards(p => Math.max(1, p - 1))}
              disabled={pageCards === 1}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none cursor-pointer"
              title="Página anterior"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-extrabold text-slate-700 px-3">
              Página {pageCards} de {totalCardPages}
            </span>

            <button
              type="button"
              onClick={() => setPageCards(p => Math.min(totalCardPages, p + 1))}
              disabled={pageCards === totalCardPages}
              className="p-1.5 rounded-lg text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none cursor-pointer"
              title="Página siguiente"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setPageCards(totalCardPages)}
              disabled={pageCards === totalCardPages}
              className="px-2 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-white hover:text-slate-900 disabled:opacity-40 disabled:hover:bg-transparent transition-colors shadow-sm disabled:shadow-none cursor-pointer"
              title="Última página"
            >
              »
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL: NUEVA TAREA / REGISTRAR GOLPES ── */}
      {isModalOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="bg-slate-900 text-white p-5 flex items-center justify-between border-b border-slate-800">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-blue-400" />
                  {editingRecordId ? 'Editar Tarea Diaria de Golpes' : 'Nueva Tarea Diaria de Producción'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Al guardar, se auto-completa de inmediato la planilla mensual de kilos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Fecha de Trabajo
                  </label>
                  <input
                    type="date"
                    value={taskDate}
                    onChange={e => setTaskDate(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                    Turno
                  </label>
                  <select
                    value={taskShift}
                    onChange={e => setTaskShift(Number(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  >
                    <option value={1}>Turno 1</option>
                    <option value={2}>Turno 2</option>
                    <option value={3}>Turno 3</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-500 uppercase mb-1">
                  Diseño a Estampar
                </label>
                <select
                  value={taskDesignName}
                  onChange={e => handleSelectDesign(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold outline-none focus:ring-2 focus:ring-sky-500 cursor-pointer"
                  required
                >
                  <option value="">-- Seleccionar diseño del catálogo --</option>
                  {designs.map(d => (
                    <option key={d.id} value={d.name}>
                      {d.name} ({d.lineType?.toUpperCase() || 'REACTIVO'} · {d.widthCm || 60}x{d.heightCm || 120}cm)
                    </option>
                  ))}
                </select>
              </div>

              {/* Parámetros de golpes y unidades */}
              <div className="grid grid-cols-2 gap-3 bg-sky-50/60 p-3.5 rounded-2xl border border-sky-100">
                <div>
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase mb-1">
                    Nº de Golpes
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={taskGolpes || ''}
                    onChange={e => handleGolpesChange(Number(e.target.value))}
                    placeholder="Ej: 800"
                    className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-sm font-black font-mono text-slate-900 outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                  <span className="text-[10px] text-sky-600 font-medium">Golpes de la máquina</span>
                </div>

                <div>
                  <label className="block text-[11px] font-extrabold text-sky-950 uppercase mb-1">
                    Unidades (Prendas)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={taskUnits || ''}
                    onChange={e => setTaskUnits(Number(e.target.value))}
                    placeholder="Ej: 2400"
                    className="w-full bg-white border border-sky-300 rounded-xl px-3 py-2 text-sm font-black font-mono text-blue-900 outline-none focus:ring-2 focus:ring-sky-500"
                    required
                  />
                  <span className="text-[10px] text-sky-600 font-medium">
                    Auto-calculado ({taskWidthM <= 0.40 ? '5 toallas/golpe' : '3 toallas/golpe'})
                  </span>
                </div>
              </div>

              {/* Especificaciones técnicas del diseño (automáticas) */}
              <div className="grid grid-cols-3 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-100 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Medidas</span>
                  <p className="font-mono font-bold text-slate-800">{taskWidthM.toFixed(2)} x {taskHeightM.toFixed(2)} m</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Gramaje</span>
                  <p className="font-mono font-bold text-slate-800">{taskGramaje} g/m²</p>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Proceso</span>
                  <p className="font-extrabold text-slate-800">{taskProcess}</p>
                </div>
              </div>

              {/* Resumen de Auto-llenado en Producción */}
              <div className="bg-amber-50 p-3.5 rounded-2xl border border-amber-200/80 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-extrabold text-amber-900 uppercase">
                    Auto-llenado en Planilla de Producción:
                  </p>
                  <p className="text-xs text-amber-800 font-medium mt-0.5">
                    Área: {(taskWidthM * taskHeightM).toFixed(2)} m² · Peso Unidad: {((taskWidthM * taskHeightM) * taskGramaje).toFixed(1)} g
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-bold text-amber-700 uppercase">Kilos Tela:</span>
                  <p className="text-base font-black font-mono text-amber-950">
                    {(((taskUnits * ((taskWidthM * taskHeightM) * taskGramaje)) / 1000)).toFixed(2).replace('.', ',')} kg
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-2">
                {editingRecordId ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm("¿Seguro que deseas eliminar este registro de producción?")) {
                        handleDeleteTask(editingRecordId);
                        setIsModalOpen(false);
                      }
                    }}
                    className="px-3.5 py-2.5 rounded-xl text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Eliminar Registro</span>
                  </button>
                ) : <div />}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-blue-600 hover:bg-blue-700 shadow-md shadow-blue-600/20 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer"
                  >
                    <Check className="w-4 h-4" />
                    {editingRecordId ? 'Guardar Cambios' : 'Registrar Tarea y Auto-llenar'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
