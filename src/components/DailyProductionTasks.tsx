import { useState, useMemo, useEffect } from 'react';
import { 
  Calendar, Plus, Edit2, Trash2, Search, Table, Award, TrendingUp, 
  ChevronLeft, ChevronRight, X, ArrowRight, Check
} from 'lucide-react';
import { DailyProductionRecord, Design, WorkOrder } from '../types';
import { 
  getProductionRecords, 
  addProductionRecord, 
  updateProductionRecord, 
  deleteProductionRecord,
  syncWorkOrdersToProductionRecords 
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
      const totalGolpes = records.reduce((acc, r) => acc + (r.golpes || (r.widthM <= 0.4 ? Math.round(r.units / 5) : Math.round(r.units / 3))), 0);
      const totalUnits = records.reduce((acc, r) => acc + (r.units || 0), 0);
      const totalKg = records.reduce((acc, r) => acc + (r.kgDay || 0), 0);
      return {
        date,
        records,
        totalGolpes,
        totalUnits,
        totalKg
      };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // Paginación de tarjetas diarias
  const totalCardPages = Math.max(1, Math.ceil(groupedDailyTasks.length / cardsPerPage));
  const displayedDailyTasks = useMemo(() => {
    const start = (pageCards - 1) * cardsPerPage;
    return groupedDailyTasks.slice(start, start + cardsPerPage);
  }, [groupedDailyTasks, pageCards, cardsPerPage]);

  // Métricas acumuladas del período
  const totalPeriodGolpes = filteredRecords.reduce((acc, r) => acc + (r.golpes || (r.widthM <= 0.4 ? Math.round(r.units / 5) : Math.round(r.units / 3))), 0);
  const totalPeriodUnits = filteredRecords.reduce((acc, r) => acc + (r.units || 0), 0);
  const totalPeriodKg = filteredRecords.reduce((acc, r) => acc + (r.kgDay || 0), 0);
  const totalDaysCount = groupedDailyTasks.length;

  // Manejo de selección de diseño en formulario
  const handleSelectDesign = (name: string) => {
    setTaskDesignName(name);
    const d = designs.find(item => item.name.toUpperCase() === name.toUpperCase());
    if (d) {
      const wM = d.widthCm ? Number((d.widthCm / 100).toFixed(2)) : 0.60;
      const hM = d.heightCm ? Number((d.heightCm / 100).toFixed(2)) : 1.20;
      setTaskWidthM(wM);
      setTaskHeightM(hM);
      if (d.gramaje) setTaskGramaje(d.gramaje);
      if (d.lineType) setTaskProcess(d.lineType === 'reactivo' ? 'REACTIVO' : 'PIGMENTO');

      const ratio = (wM <= 0.40) ? 5 : 3;
      setTaskUnits(taskGolpes * ratio);
    }
  };

  const handleGolpesChange = (val: number) => {
    setTaskGolpes(val);
    const ratio = (taskWidthM <= 0.40) ? 5 : 3;
    setTaskUnits(val * ratio);
  };

  const handleOpenNewTask = (defaultDate?: string) => {
    setEditingRecordId(null);
    setTaskDate(defaultDate || new Date().toISOString().slice(0, 10));
    const firstDesign = designs.length > 0 ? designs[0] : null;
    const wM = firstDesign?.widthCm ? Number((firstDesign.widthCm / 100).toFixed(2)) : 0.60;
    const hM = firstDesign?.heightCm ? Number((firstDesign.heightCm / 100).toFixed(2)) : 1.20;
    setTaskDesignName(firstDesign ? firstDesign.name : '');
    setTaskShift(1);
    setTaskGolpes(800);
    setTaskWidthM(wM);
    setTaskHeightM(hM);
    setTaskGramaje(firstDesign?.gramaje || 280);
    setTaskProcess(firstDesign?.lineType === 'reactivo' ? 'REACTIVO' : 'PIGMENTO');
    const ratio = (wM <= 0.40) ? 5 : 3;
    setTaskUnits(800 * ratio);
    setIsModalOpen(true);
  };

  const handleOpenEditTask = (r: DailyProductionRecord) => {
    setEditingRecordId(r.id || null);
    setTaskDate(r.date);
    setTaskDesignName(r.designName);
    setTaskShift(r.shift);
    const g = r.golpes || (r.widthM <= 0.40 ? Math.round(r.units / 5) : Math.round(r.units / 3));
    setTaskGolpes(g);
    setTaskUnits(r.units);
    setTaskWidthM(r.widthM);
    setTaskHeightM(r.heightM);
    setTaskGramaje(r.gramaje);
    setTaskProcess(r.process);
    setIsModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskDesignName.trim() || taskUnits <= 0) {
      alert("Por favor selecciona un diseño y las unidades.");
      return;
    }

    const area = Number((taskWidthM * taskHeightM).toFixed(2));
    const unitWeight = Number((area * taskGramaje).toFixed(1));
    const kg = Number(((taskUnits * unitWeight) / 1000).toFixed(2));

    const recordData: DailyProductionRecord = {
      date: taskDate,
      designName: taskDesignName.toUpperCase().trim(),
      shift: Number(taskShift) || 1,
      golpes: Number(taskGolpes) || 0,
      widthM: Number(taskWidthM) || 0,
      heightM: Number(taskHeightM) || 0,
      gramaje: Number(taskGramaje) || 0,
      process: taskProcess,
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
    setProductionRecords(prev => prev.filter(r => r.id !== id));
    setDeleteConfirmId(null);
    await deleteProductionRecord(id);
    loadData();
  };

  return (
    <div className="space-y-6 h-full flex flex-col overflow-y-auto custom-scrollbar pr-2 pb-10" id="daily-production-tasks-view">
      
      {/* ── ENCABEZADO Y CONTROLES PRINCIPALES ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="bg-sky-500 text-white p-2 rounded-xl shadow-sm">
              <Calendar className="w-5 h-5" />
            </span>
            <div>
              <h2 className="text-xl font-extrabold text-slate-900 tracking-tight">
                Reporte Diario de Golpes y Unidades
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Tareas diarias de estampado · Cada golpe registrado auto-llena el Reporte Mensual de Producción
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {onNavigateToMonthlySheet && (
            <button
              type="button"
              onClick={onNavigateToMonthlySheet}
              className="flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-2 rounded-xl text-xs font-bold transition-colors border border-slate-200 shadow-sm"
              title="Ir a la planilla de kilos de tela"
            >
              <Table className="w-3.5 h-3.5 text-blue-600" />
              Ver Planilla en Kilos
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenNewTask()}
            className="flex items-center gap-2 bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-xs font-extrabold transition-all shadow-md shadow-sky-600/20 active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            Nueva Tarea / Registrar Golpes
          </button>
        </div>
      </div>

      {/* ── BARRA DE FILTROS TEMPORALES ── */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          
          {/* Selector de Período */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mr-1">Periodo:</span>
            {[
              { id: 'month', label: timeFilter === 'month' ? `Mes (${MONTH_NAMES[selectedMonth]})` : 'Mes' },
              { id: 'year',  label: timeFilter === 'year' ? `Año (${selectedYear})` : 'Año' },
              { id: 'all',   label: 'Todo el 2026' },
              { id: 'custom', label: 'Rango de Fechas' }
            ].map(f => (
              <button
                key={f.id}
                onClick={() => setTimeFilter(f.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === f.id
                    ? 'bg-sky-600 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Buscador de diseños */}
          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              placeholder="Buscar diseño o proceso..."
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-8 pr-3 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Selectores contextuales */}
        {timeFilter === 'month' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-sky-50/50 p-3 rounded-2xl border border-sky-100/70">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-sky-600 shrink-0" />
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Mes a consultar:</span>
              <div className="flex items-center bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 0) {
                      setSelectedMonth(11);
                      setSelectedYear(y => y - 1);
                    } else setSelectedMonth(m => m - 1);
                  }}
                  className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  className="bg-transparent text-slate-800 text-xs font-bold px-2 py-1.5 outline-none cursor-pointer"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={idx} value={idx}>{m}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    if (selectedMonth === 11) {
                      setSelectedMonth(0);
                      setSelectedYear(y => y + 1);
                    } else setSelectedMonth(m => m + 1);
                  }}
                  className="p-1.5 text-slate-500 hover:text-sky-600 hover:bg-slate-50 cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Año:</span>
              <select
                value={selectedYear}
                onChange={e => setSelectedYear(Number(e.target.value))}
                className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 shadow-sm outline-none cursor-pointer"
              >
                {availableYears.map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

            <div className="ml-auto text-xs font-bold text-sky-800 bg-sky-100/90 px-3 py-1.5 rounded-xl border border-sky-200">
              Mostrando tareas de: <strong>{MONTH_NAMES[selectedMonth]} {selectedYear}</strong>
            </div>
          </div>
        )}

        {timeFilter === 'year' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-sky-50/50 p-3 rounded-2xl border border-sky-100/70">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">Año a consultar:</span>
            <select
              value={selectedYear}
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-white border border-slate-200 text-slate-800 text-xs font-bold rounded-xl px-3 py-1.5 shadow-sm outline-none cursor-pointer"
            >
              {availableYears.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <div className="ml-auto text-xs font-bold text-sky-800 bg-sky-100/90 px-3 py-1.5 rounded-xl border border-sky-200">
              Mostrando todas las tareas del año: <strong>{selectedYear}</strong>
            </div>
          </div>
        )}

        {timeFilter === 'custom' && (
          <div className="flex flex-wrap items-center gap-3 pt-3 border-t border-slate-100 bg-slate-50/70 p-3 rounded-2xl border border-slate-100">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Desde</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-bold text-slate-500 uppercase">Hasta</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-semibold" />
            </div>
          </div>
        )}
      </div>

      {/* ── TARJETAS KPI RESUMEN DE GOLPES Y PRENDAS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 shrink-0">
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
            <Award className="w-5 h-5 text-sky-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Golpes Totales</p>
            <p className="text-xl font-extrabold text-slate-900 font-mono">
              {totalPeriodGolpes.toLocaleString()}
            </p>
            <p className="text-[9px] text-slate-400 font-medium">Golpes de estampación</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
            <Table className="w-5 h-5 text-blue-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Unidades Producidas</p>
            <p className="text-xl font-extrabold text-blue-900 font-mono">
              {totalPeriodUnits.toLocaleString()} pz
            </p>
            <p className="text-[9px] text-blue-600 font-medium">Prendas / Toallas</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5 text-amber-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
              {weightUnit === 'kg' ? 'Kilos de Tela' : 'Gramos de Tela'}
            </p>
            <p className="text-xl font-extrabold text-amber-950 font-mono">
              {weightUnit === 'kg'
                ? `${totalPeriodKg.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kg`
                : `${(totalPeriodKg * 1000).toLocaleString('es-ES', { minimumFractionDigits: 0, maximumFractionDigits: 0 })} g`}
            </p>
            <p className="text-[9px] text-amber-600 font-medium">Auto-llenado en reporte mensual</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center shrink-0">
            <Calendar className="w-5 h-5 text-purple-700" />
          </div>
          <div>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Días Registrados</p>
            <p className="text-xl font-extrabold text-purple-900 font-mono">
              {totalDaysCount} días
            </p>
            <p className="text-[9px] text-purple-600 font-medium">{filteredRecords.length} tareas totales</p>
          </div>
        </div>
      </div>

      {/* ── CUADRÍCULA DE TARJETAS DIARIAS (DISEÑO IDÉNTICO AL EXCEL DIARIO) ── */}
      {groupedDailyTasks.length === 0 ? (
        <div className="bg-white rounded-3xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
          <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <p className="text-base font-bold text-slate-700">No hay tareas de producción registradas para este período</p>
          <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
            Haz clic en "+ Nueva Tarea / Registrar Golpes" para ingresar la primera tarea de estampado de la jornada.
          </p>
          <button
            type="button"
            onClick={() => handleOpenNewTask()}
            className="mt-4 inline-flex items-center gap-2 bg-sky-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-sky-700 shadow-sm cursor-pointer"
          >
            <Plus className="w-4 h-4" /> Registrar Tarea de Hoy
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {displayedDailyTasks.map(day => (
            <div
              key={day.date}
              className="bg-white rounded-2xl border border-slate-300/80 shadow-sm overflow-hidden flex flex-col hover:shadow-md transition-shadow"
            >
              {/* Encabezado Celeste Superior Estilo Excel */}
              <div className="bg-sky-500 text-white font-extrabold uppercase py-2 px-3 text-center text-[11px] tracking-wider border-b border-sky-600 shadow-inner flex items-center justify-between">
                <span className="flex-1 text-center font-black">REPORTE DIARIO DE PRODUCCIÒN</span>
                <button
                  type="button"
                  onClick={() => handleOpenNewTask(day.date)}
                  className="bg-sky-600/80 hover:bg-sky-700 p-1 rounded text-white cursor-pointer"
                  title="Añadir diseño a este día"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Subencabezado de Fecha y Unidades */}
              <div className="bg-sky-100 py-1.5 px-3 flex justify-between items-center text-xs font-bold text-sky-950 border-b border-sky-200">
                <span className="flex items-center gap-1.5">
                  <span className="text-sky-800 font-extrabold uppercase text-[10px]">FECHA:</span>
                  <span className="font-mono font-black text-slate-900 bg-white/70 px-1.5 py-0.5 rounded border border-sky-200">
                    {formatProductionDate(day.date)}
                  </span>
                </span>
                <span className="text-[10px] font-black uppercase text-sky-800 tracking-wider">
                  UNIDADES
                </span>
              </div>

              {/* Fila de Títulos de Columna */}
              <div className="grid grid-cols-12 bg-slate-50 px-3 py-1.5 text-[10px] font-black text-slate-600 uppercase border-b border-slate-200">
                <div className="col-span-6">DISEÑO</div>
                <div className="col-span-3 text-center">Nº GOLPES</div>
                <div className="col-span-3 text-right">UNIDADES</div>
              </div>

              {/* Lista de Diseños Estampados en el Día */}
              <div className="divide-y divide-slate-100 font-medium text-xs flex-1">
                {day.records.map(r => {
                  const golpesVal = r.golpes || (r.widthM <= 0.40 ? Math.round(r.units / 5) : Math.round(r.units / 3));
                  return (
                    <div
                      key={r.id}
                      className="grid grid-cols-12 items-center px-3 py-2 hover:bg-slate-50/80 transition-colors group"
                    >
                      <div className="col-span-6 font-bold text-slate-900 truncate flex items-center gap-1.5" title={r.designName}>
                        <span className="truncate">{r.designName}</span>
                        <span className={`text-[8px] px-1 py-0.2 rounded font-black uppercase ${
                          r.process === 'REACTIVO'
                            ? 'bg-purple-100 text-purple-700 border border-purple-200'
                            : 'bg-orange-100 text-orange-700 border border-orange-200'
                        }`}>
                          {r.process === 'REACTIVO' ? 'R' : 'P'}
                        </span>
                      </div>

                      <div className="col-span-3 text-center font-mono font-bold text-slate-700">
                        {golpesVal.toLocaleString()}
                      </div>

                      <div className="col-span-3 text-right font-mono font-extrabold text-sky-800 flex items-center justify-end gap-1">
                        <span>{r.units.toLocaleString()}</span>
                        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 ml-1">
                          <button
                            type="button"
                            onClick={() => handleOpenEditTask(r)}
                            className="p-0.5 text-slate-400 hover:text-blue-600 cursor-pointer"
                            title="Editar tarea"
                          >
                            <Edit2 className="w-3 h-3" />
                          </button>
                          {deleteConfirmId === r.id ? (
                            <button
                              type="button"
                              onClick={() => handleDeleteTask(r.id!)}
                              className="text-[9px] font-bold text-red-600 bg-red-50 border border-red-200 px-1 rounded cursor-pointer"
                            >
                              Sí
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(r.id!)}
                              className="p-0.5 text-slate-400 hover:text-red-600 cursor-pointer"
                              title="Eliminar tarea"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fila Amarilla de Totales Diarios Estilo Excel */}
              <div className="grid grid-cols-12 bg-yellow-400 text-slate-950 font-black px-3 py-2 text-xs border-t-2 border-yellow-500 shadow-sm">
                <div className="col-span-6 tracking-wider uppercase flex items-center gap-1.5">
                  <span>TOTAL</span>
                  <span className="text-[9px] font-bold text-slate-700 font-sans">
                    ({day.records.length} ref{day.records.length > 1 ? 's' : ''})
                  </span>
                </div>
                <div className="col-span-3 text-center font-mono text-sm">
                  {day.totalGolpes.toLocaleString()}
                </div>
                <div className="col-span-3 text-right font-mono text-sm">
                  {day.totalUnits.toLocaleString()}
                </div>
              </div>

              {/* Sub-barra informativa de Kilos de tela calculados */}
              <div className="bg-slate-50 px-3 py-1 text-[10px] text-slate-500 font-medium flex justify-between border-t border-slate-200">
                <span>Peso tela generado:</span>
                <span className="font-mono font-bold text-slate-800">
                  {weightUnit === 'kg'
                    ? `${day.totalKg.toFixed(2).replace('.', ',')} kg`
                    : `${(day.totalKg * 1000).toLocaleString('es-ES', { maximumFractionDigits: 0 })} g`}
                </span>
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
            <div className="bg-sky-500 text-white p-5 flex items-center justify-between">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2">
                  <Calendar className="w-5 h-5 text-white" />
                  {editingRecordId ? 'Editar Tarea Diaria de Golpes' : 'Nueva Tarea Diaria de Producción'}
                </h3>
                <p className="text-xs text-sky-100 mt-0.5">
                  Al guardar, se auto-completa de inmediato la planilla mensual de kilos.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-sky-100 hover:text-white rounded-xl hover:bg-sky-600 transition-colors cursor-pointer"
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

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 rounded-xl text-xs font-extrabold text-white bg-sky-600 hover:bg-sky-700 shadow-md shadow-sky-600/20 transition-all flex items-center gap-1.5 cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  {editingRecordId ? 'Guardar Cambios' : 'Registrar Tarea y Auto-llenar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
